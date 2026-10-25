//! Image processing for camera calibration and panoramas: measuring how far a
//! picture moved between two frames, and stitching frames into a panorama
//! using the camera angles each was captured at.

/// An 8-bit RGB image, rows top to bottom with no padding.
#[derive(Clone, Debug, PartialEq)]
pub struct Rgb {
    pub width: usize,
    pub height: usize,
    pub data: Vec<u8>,
}

impl Rgb {
    pub fn new(width: usize, height: usize) -> Self {
        Self {
            width,
            height,
            data: vec![0; width * height * 3],
        }
    }
    /// Box-filters RGBX/RGBA rows (with `stride` bytes per row) down to at
    /// most `max_width`, dropping alpha.
    pub fn from_rgbx(
        pixels: &[u8],
        width: usize,
        height: usize,
        stride: usize,
        max_width: usize,
    ) -> Self {
        let w = width.min(max_width).max(1);
        let h = (height * w / width).max(1);
        let mut data = Vec::with_capacity(w * h * 3);
        for y in 0..h {
            let (y0, y1) = span(y, h, height);
            for x in 0..w {
                let (x0, x1) = span(x, w, width);
                let mut sum = [0u32; 3];
                for row in y0..y1 {
                    for column in x0..x1 {
                        let i = row * stride + column * 4;
                        for (channel, total) in sum.iter_mut().enumerate() {
                            *total += u32::from(pixels[i + channel]);
                        }
                    }
                }
                let count = ((y1 - y0) * (x1 - x0)) as u32;
                data.extend(sum.map(|total| (total / count) as u8));
            }
        }
        Self {
            width: w,
            height: h,
            data,
        }
    }
    pub fn gray(&self) -> Gray {
        Gray {
            width: self.width,
            height: self.height,
            data: self
                .data
                .chunks_exact(3)
                .map(|p| {
                    0.299 * f32::from(p[0]) + 0.587 * f32::from(p[1]) + 0.114 * f32::from(p[2])
                })
                .collect(),
        }
    }
    pub fn jpeg(&self, quality: u8) -> Result<Vec<u8>, String> {
        let (width, height) = (
            u16::try_from(self.width).map_err(|_| "image too wide")?,
            u16::try_from(self.height).map_err(|_| "image too tall")?,
        );
        let mut jpeg = vec![];
        jpeg_encoder::Encoder::new(&mut jpeg, quality)
            .encode(&self.data, width, height, jpeg_encoder::ColorType::Rgb)
            .map_err(|e| e.to_string())?;
        Ok(jpeg)
    }
    /// Bilinear sample at a sub-pixel position known to be inside the image.
    fn sample(&self, x: f32, y: f32) -> [f32; 3] {
        let (x0, y0) = (x.floor() as usize, y.floor() as usize);
        let (x1, y1) = ((x0 + 1).min(self.width - 1), (y0 + 1).min(self.height - 1));
        let (fx, fy) = (x - x0 as f32, y - y0 as f32);
        let at = |x: usize, y: usize, c: usize| f32::from(self.data[(y * self.width + x) * 3 + c]);
        std::array::from_fn(|c| {
            let top = at(x0, y0, c) * (1.0 - fx) + at(x1, y0, c) * fx;
            let bottom = at(x0, y1, c) * (1.0 - fx) + at(x1, y1, c) * fx;
            top * (1.0 - fy) + bottom * fy
        })
    }
}

/// Source range covered by output index `i` of `n` when scaling from `size`.
fn span(i: usize, n: usize, size: usize) -> (usize, usize) {
    let start = i * size / n;
    (start, ((i + 1) * size / n).max(start + 1))
}

/// A greyscale image used for matching.
#[derive(Clone, Debug)]
pub struct Gray {
    pub width: usize,
    pub height: usize,
    pub data: Vec<f32>,
}

impl Gray {
    fn at(&self, x: usize, y: usize) -> f32 {
        self.data[y * self.width + x]
    }
    /// Bilinear resample to `width`×`height`, averaging when shrinking.
    pub fn resize(&self, width: usize, height: usize) -> Gray {
        let mut source = self.clone();
        // Halve first while more than twice too big, so shrinking averages.
        while source.width >= width * 2 && source.height >= height * 2 {
            source = source.half();
        }
        let (sx, sy) = (
            source.width as f32 / width as f32,
            source.height as f32 / height as f32,
        );
        let mut data = Vec::with_capacity(width * height);
        for y in 0..height {
            let fy = ((y as f32 + 0.5) * sy - 0.5).clamp(0.0, (source.height - 1) as f32);
            let (y0, ty) = (fy.floor() as usize, fy.fract());
            let y1 = (y0 + 1).min(source.height - 1);
            for x in 0..width {
                let fx = ((x as f32 + 0.5) * sx - 0.5).clamp(0.0, (source.width - 1) as f32);
                let (x0, tx) = (fx.floor() as usize, fx.fract());
                let x1 = (x0 + 1).min(source.width - 1);
                let top = source.at(x0, y0) * (1.0 - tx) + source.at(x1, y0) * tx;
                let bottom = source.at(x0, y1) * (1.0 - tx) + source.at(x1, y1) * tx;
                data.push(top * (1.0 - ty) + bottom * ty);
            }
        }
        Gray {
            width,
            height,
            data,
        }
    }
    /// The `width`×`height` region starting at (`x`, `y`).
    pub fn crop(&self, x: usize, y: usize, width: usize, height: usize) -> Gray {
        let (width, height) = (width.min(self.width - x), height.min(self.height - y));
        Gray {
            width,
            height,
            data: (y..y + height)
                .flat_map(|row| self.data[row * self.width + x..][..width].iter().copied())
                .collect(),
        }
    }
    /// Halves both dimensions by averaging 2×2 blocks.
    fn half(&self) -> Gray {
        let (width, height) = ((self.width / 2).max(1), (self.height / 2).max(1));
        let mut data = Vec::with_capacity(width * height);
        for y in 0..height {
            for x in 0..width {
                let (x0, y0) = ((x * 2).min(self.width - 1), (y * 2).min(self.height - 1));
                let (x1, y1) = ((x0 + 1).min(self.width - 1), (y0 + 1).min(self.height - 1));
                data.push(
                    (self.at(x0, y0) + self.at(x1, y0) + self.at(x0, y1) + self.at(x1, y1)) / 4.0,
                );
            }
        }
        Gray {
            width,
            height,
            data,
        }
    }
    /// Normalized cross-correlation of `self` against `other` displaced by
    /// (dx, dy), over the central region that stays inside both images.
    fn ncc(&self, other: &Gray, dx: i32, dy: i32, margin: usize) -> f32 {
        let (w, h) = (self.width as i32, self.height as i32);
        let m = margin as i32;
        let (x0, x1) = (m.max(m - dx), (w - m).min(w - m - dx));
        let (y0, y1) = (m.max(m - dy), (h - m).min(h - m - dy));
        if x1 - x0 < 8 || y1 - y0 < 8 {
            return -1.0;
        }
        let (mut sa, mut sb, mut saa, mut sbb, mut sab) = (0.0f64, 0.0, 0.0, 0.0, 0.0);
        let mut n = 0.0;
        for y in y0..y1 {
            for x in x0..x1 {
                let a = f64::from(self.at(x as usize, y as usize));
                let b = f64::from(other.at((x + dx) as usize, (y + dy) as usize));
                sa += a;
                sb += b;
                saa += a * a;
                sbb += b * b;
                sab += a * b;
                n += 1.0;
            }
        }
        let cov = sab - sa * sb / n;
        let var = (saa - sa * sa / n) * (sbb - sb * sb / n);
        if var <= 1e-6 {
            return -1.0;
        }
        (cov / var.sqrt()) as f32
    }
}

/// How far picture content moved from `a` to `b`, in `a`'s pixels:
/// content at (x, y) in `a` appears at (x + dx, y + dy) in `b`.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Shift {
    pub dx: f32,
    pub dy: f32,
    /// Normalized cross-correlation at the match, 1.0 for a perfect match.
    /// Low values mean the scene had too little texture to measure.
    pub score: f32,
}

/// Estimates the shift between two same-sized frames within ±`max_dx`/±`max_dy`
/// pixels, searching coarse-to-fine over an image pyramid.
pub fn estimate_shift(a: &Gray, b: &Gray, max_dx: usize, max_dy: usize) -> Option<Shift> {
    if a.width != b.width || a.height != b.height {
        return None;
    }
    let mut pyramid = vec![(a.clone(), b.clone())];
    while pyramid.last().unwrap().0.width > 160 {
        let (pa, pb) = pyramid.last().unwrap();
        let next = (pa.half(), pb.half());
        pyramid.push(next);
    }
    let levels = pyramid.len();
    let scale = 1 << (levels - 1);
    let (mut best_x, mut best_y) = (0i32, 0i32);
    let mut range = ((max_dx / scale + 1) as i32, (max_dy / scale + 1) as i32);
    let mut score = -1.0;
    for (level, (pa, pb)) in pyramid.iter().enumerate().rev() {
        if level != levels - 1 {
            best_x *= 2;
            best_y *= 2;
            range = (2, 2);
        }
        let margin = pa.width / 16;
        let (cx, cy) = (best_x, best_y);
        score = -1.0;
        for dy in cy - range.1..=cy + range.1 {
            for dx in cx - range.0..=cx + range.0 {
                let s = pa.ncc(pb, dx, dy, margin);
                if s > score {
                    (score, best_x, best_y) = (s, dx, dy);
                }
            }
        }
    }
    // Parabolic sub-pixel refinement at full resolution.
    let (full_a, full_b) = &pyramid[0];
    let margin = full_a.width / 16;
    let refine = |minus: f32, plus: f32| {
        let denominator = minus - 2.0 * score + plus;
        if denominator.abs() < 1e-6 {
            0.0
        } else {
            (0.5 * (minus - plus) / denominator).clamp(-0.5, 0.5)
        }
    };
    let fx = refine(
        full_a.ncc(full_b, best_x - 1, best_y, margin),
        full_a.ncc(full_b, best_x + 1, best_y, margin),
    );
    let fy = refine(
        full_a.ncc(full_b, best_x, best_y - 1, margin),
        full_a.ncc(full_b, best_x, best_y + 1, margin),
    );
    // `a` at (x, y) best matches `b` at (x + dx, y + dy): that is the shift.
    Some(Shift {
        dx: best_x as f32 + fx,
        dy: best_y as f32 + fy,
        score,
    })
}

/// Centre of the `window_width`×`window_height` window with the most edge
/// detail, ignoring a border of one window. Used to aim zoomed-in
/// measurements at something with texture rather than a plain wall.
pub fn most_detailed(image: &Gray, window_width: usize, window_height: usize) -> (f32, f32) {
    let (w, h) = (image.width, image.height);
    let (ww, wh) = (window_width.clamp(2, w), window_height.clamp(2, h));
    // Integral image of gradient magnitude.
    let mut integral = vec![0f64; (w + 1) * (h + 1)];
    for y in 0..h {
        let mut row = 0.0;
        for x in 0..w {
            let gx = image.at((x + 1).min(w - 1), y) - image.at(x.saturating_sub(1), y);
            let gy = image.at(x, (y + 1).min(h - 1)) - image.at(x, y.saturating_sub(1));
            row += f64::from(gx.abs() + gy.abs());
            integral[(y + 1) * (w + 1) + x + 1] = integral[y * (w + 1) + x + 1] + row;
        }
    }
    let sum = |x: usize, y: usize| {
        let at = |x: usize, y: usize| integral[y * (w + 1) + x];
        at(x + ww, y + wh) - at(x, y + wh) - at(x + ww, y) + at(x, y)
    };
    let (mut best, mut centre) = (-1.0, (w as f32 / 2.0, h as f32 / 2.0));
    let (x_end, y_end) = (w.saturating_sub(2 * ww), h.saturating_sub(2 * wh));
    for y in (wh.min(y_end)..=y_end.max(wh.min(y_end))).step_by((wh / 4).max(1)) {
        for x in (ww.min(x_end)..=x_end.max(ww.min(x_end))).step_by((ww / 4).max(1)) {
            let energy = sum(x, y);
            if energy > best {
                best = energy;
                centre = (x as f32 + ww as f32 / 2.0, y as f32 + wh as f32 / 2.0);
            }
        }
    }
    centre
}

/// Which way a calibration move turned the camera.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Axis {
    Pan,
    Tilt,
}

/// The central part of a pan/tilt move: how far content in the middle of
/// the frame moved, and the geometry needed to undo the lens's edge stretch.
///
/// Matching the whole frame overstates focal length, because a pinhole lens
/// magnifies the edges: content there moves further than at the centre. So
/// only a central window half the frame long is matched, and its remaining
/// stretch is modelled exactly.
struct CentralShift {
    shift: Shift,
    /// Distance content moved within the window, in pixels.
    moved: f32,
    /// Range of positions (from the frame centre) the match was made over.
    span: (f32, f32),
}

fn central_shift(a: &Gray, b: &Gray, axis: Axis) -> Option<CentralShift> {
    let along = match axis {
        Axis::Pan => a.width,
        Axis::Tilt => a.height,
    };
    let window = |image: &Gray| match axis {
        Axis::Pan => image.crop(a.width / 4, a.height / 5, a.width / 2, a.height * 3 / 5),
        Axis::Tilt => image.crop(a.width / 5, a.height / 4, a.width * 3 / 5, a.height / 2),
    };
    let (wa, wb) = (window(a), window(b));
    let (max_dx, max_dy) = match axis {
        Axis::Pan => (wa.width * 2 / 5, wa.height / 6),
        Axis::Tilt => (wa.width / 6, wa.height * 2 / 5),
    };
    let shift = estimate_shift(&wa, &wb, max_dx, max_dy)?;
    let moved = match axis {
        Axis::Pan => shift.dx.abs(),
        Axis::Tilt => shift.dy.abs(),
    };
    // Content that left the window, and the 1/16 margin `estimate_shift`
    // ignores, take no part in the match.
    let half = along as f32 / 4.0;
    let margin = (2.0 * half / 16.0).floor();
    Some(CentralShift {
        shift,
        moved,
        span: (-half + margin + moved, half - margin),
    })
}

impl CentralShift {
    /// Mean displacement over the matched span for a focal length and
    /// rotation: a point x from the centre moves to f·tan(atan(x/f) − angle).
    fn mean_move(&self, focal: f32, angle: f32) -> f32 {
        let samples = 64;
        let (start, end) = self.span;
        (0..samples)
            .map(|i| {
                let x = start + (end - start) * (i as f32 + 0.5) / samples as f32;
                x - focal * ((x / focal).atan() - angle).tan()
            })
            .sum::<f32>()
            / samples as f32
    }
}

/// Focal length (in `a`'s pixels) from two frames taken `angle` radians
/// apart by a pan or tilt, with the measured shift.
pub fn focal_from_rotation(a: &Gray, b: &Gray, angle: f32, axis: Axis) -> Option<(f32, Shift)> {
    let central = central_shift(a, b, axis)?;
    let angle = angle.abs();
    let mut focal = central.moved / angle.tan();
    for _ in 0..8 {
        focal *= central.moved / central.mean_move(focal, angle);
    }
    focal.is_finite().then_some((focal, central.shift))
}

/// The angle (radians) a pan or tilt turned between two frames, given the
/// focal length, with the measured shift. The inverse of
/// [`focal_from_rotation`], used to scale tilt units once pan has given the
/// focal length.
pub fn rotation_from_focal(a: &Gray, b: &Gray, focal: f32, axis: Axis) -> Option<(f32, Shift)> {
    let central = central_shift(a, b, axis)?;
    let mut angle = (central.moved / focal).atan();
    for _ in 0..8 {
        angle *= central.moved / central.mean_move(focal, angle);
    }
    angle.is_finite().then_some((angle, central.shift))
}

/// How one zoom level relates to another, both taken from the same direction.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct ZoomStep {
    /// How much more magnified the second frame is.
    pub ratio: f32,
    /// Where the second frame's centre lies in the first, relative to the
    /// first's centre, in its pixels (right and down positive). Lenses often
    /// drift slightly off-centre as they zoom.
    pub centre: (f32, f32),
    pub score: f32,
}

/// Measures `b` against `a`, taken from the same direction at a higher zoom,
/// searching ratios `min..=max`. Zooming is a magnification about (nearly) the
/// picture centre, so `b` shrunk by the ratio matches the middle of `a`, up to
/// a small drift that the match also finds.
pub fn zoom_ratio(a: &Gray, b: &Gray, min: f32, max: f32) -> Option<ZoomStep> {
    let measure = |ratio: f32| {
        let (w, h) = (
            (b.width as f32 / ratio).round() as usize,
            (b.height as f32 / ratio).round() as usize,
        );
        if w < 32 || h < 18 || w > a.width || h > a.height {
            return None;
        }
        let small = b.resize(w, h);
        let centre = a.crop((a.width - w) / 2, (a.height - h) / 2, w, h);
        let shift = estimate_shift(&centre, &small, w / 12 + 2, h / 12 + 2)?;
        // Content at the middle of `a` appears `shift` away in the shrunk `b`,
        // so `b`'s centre is the opposite way from `a`'s.
        Some(ZoomStep {
            ratio,
            centre: (-shift.dx, -shift.dy),
            score: shift.score,
        })
    };
    // Coarse logarithmic search, then refine around the best.
    let mut best: Option<ZoomStep> = None;
    let better = |candidate: Option<ZoomStep>, best: &mut Option<ZoomStep>| {
        if let Some(c) = candidate
            && best.is_none_or(|b| c.score > b.score)
        {
            *best = Some(c);
        }
    };
    let steps = 40;
    for i in 0..=steps {
        better(
            measure(min * (max / min).powf(i as f32 / steps as f32)),
            &mut best,
        );
    }
    let mut step = (max / min).powf(1.0 / steps as f32);
    for _ in 0..12 {
        step = step.sqrt();
        let around = best?.ratio;
        better(measure(around / step), &mut best);
        better(measure(around * step), &mut best);
    }
    best
}

/// One captured frame and where the camera pointed: yaw is degrees towards
/// the right of the view, pitch degrees upwards.
pub struct Tile {
    pub image: Rgb,
    pub yaw: f32,
    pub pitch: f32,
    /// Focal length in this image's pixels.
    pub focal_px: f32,
}

/// The angular area a panorama covers, in degrees (left < right, top > bottom).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Extent {
    pub left: f32,
    pub right: f32,
    pub top: f32,
    pub bottom: f32,
}

/// Projects tiles onto an equirectangular panorama covering `extent` at
/// `pixels_per_degree`, matching tile brightness and feathering overlaps.
/// Uncovered areas stay black.
pub fn stitch(tiles: &[Tile], extent: Extent, pixels_per_degree: f32) -> Rgb {
    let width = ((extent.right - extent.left) * pixels_per_degree)
        .round()
        .max(1.0) as usize;
    let height = ((extent.top - extent.bottom) * pixels_per_degree)
        .round()
        .max(1.0) as usize;
    let mut out = Rgb::new(width, height);
    let cameras: Vec<_> = tiles.iter().map(Camera::new).collect();
    let gains = gains(tiles, &cameras, extent, pixels_per_degree);
    let mut accumulated = vec![[0f32; 4]; width];
    for y in 0..height {
        let pitch = (extent.top - (y as f32 + 0.5) / pixels_per_degree).to_radians();
        accumulated.fill([0.0; 4]);
        for (index, (tile, camera)) in tiles.iter().zip(&cameras).enumerate() {
            // Skip tiles whose vertical coverage cannot include this row.
            if (pitch - camera.pitch).abs() > camera.reach {
                continue;
            }
            for (x, total) in accumulated.iter_mut().enumerate() {
                let yaw = (extent.left + (x as f32 + 0.5) / pixels_per_degree).to_radians();
                let Some((u, v)) = camera.project(yaw, pitch) else {
                    continue;
                };
                let (w, h) = (tile.image.width as f32, tile.image.height as f32);
                if u < 0.0 || v < 0.0 || u > w - 1.0 || v > h - 1.0 {
                    continue;
                }
                // Weight falls to zero at the tile edges so seams blend.
                let edge = (u.min(w - 1.0 - u) / (w / 2.0)).min(v.min(h - 1.0 - v) / (h / 2.0));
                let weight = edge.max(1e-3);
                let [r, g, b] = tile.image.sample(u, v).map(|c| c * gains[index]);
                total[0] += r * weight;
                total[1] += g * weight;
                total[2] += b * weight;
                total[3] += weight;
            }
        }
        for (x, total) in accumulated.iter().enumerate() {
            if total[3] > 0.0 {
                let i = (y * width + x) * 3;
                for c in 0..3 {
                    out.data[i + c] = (total[c] / total[3]).round().clamp(0.0, 255.0) as u8;
                }
            }
        }
    }
    out
}

/// Per-tile brightness gains that make overlapping tiles agree, since each
/// frame is exposed separately. Minimises, over sampled overlaps, the
/// squared difference between gained intensities plus a pull towards a gain
/// of 1 (Brown & Lowe's gain compensation), solved as a linear system.
fn gains(tiles: &[Tile], cameras: &[Camera], extent: Extent, pixels_per_degree: f32) -> Vec<f32> {
    let n = tiles.len();
    // sums[i][j]: total intensity of tile i where it overlaps tile j.
    let mut sums = vec![vec![0f64; n]; n];
    let mut counts = vec![vec![0f64; n]; n];
    let step = 4.0 / pixels_per_degree.max(1e-3);
    let mut covering = Vec::with_capacity(n);
    let mut pitch = extent.top;
    while pitch > extent.bottom {
        let mut yaw = extent.left;
        while yaw < extent.right {
            covering.clear();
            for (i, (tile, camera)) in tiles.iter().zip(cameras).enumerate() {
                let Some((u, v)) = camera.project(yaw.to_radians(), pitch.to_radians()) else {
                    continue;
                };
                let (w, h) = (tile.image.width as f32, tile.image.height as f32);
                if u >= 0.0 && v >= 0.0 && u <= w - 1.0 && v <= h - 1.0 {
                    let [r, g, b] = tile.image.sample(u, v);
                    covering.push((i, 0.299 * r + 0.587 * g + 0.114 * b));
                }
            }
            for &(i, intensity) in &covering {
                for &(j, _) in &covering {
                    if i != j {
                        sums[i][j] += f64::from(intensity);
                        counts[i][j] += 1.0;
                    }
                }
            }
            yaw += step;
        }
        pitch -= step;
    }
    // Intensity noise (0–255 units) and allowed gain spread. Brown & Lowe use
    // a spread of 0.1, which only half-corrects auto-exposure differences
    // this large; 0.3 corrects them while still anchoring the average at 1.
    let (noise, spread) = (10f64.powi(2), 0.3f64.powi(2));
    let mut a = vec![vec![0f64; n]; n];
    let mut b = vec![0f64; n];
    for i in 0..n {
        for j in 0..n {
            let count = counts[i][j];
            if i == j || count == 0.0 {
                continue;
            }
            let (mean_i, mean_j) = (sums[i][j] / count, sums[j][i] / count);
            a[i][i] += count * (mean_i * mean_i / noise + 1.0 / spread);
            a[i][j] -= count * mean_i * mean_j / noise;
            b[i] += count / spread;
        }
        if a[i][i] == 0.0 {
            // No overlaps: keep the tile as captured.
            a[i][i] = 1.0;
            b[i] = 1.0;
        }
    }
    solve(a, b).map_or(vec![1.0; n], |g| {
        g.into_iter().map(|g| g.clamp(0.5, 2.0) as f32).collect()
    })
}

/// Solves `a x = b` by Gaussian elimination with partial pivoting.
fn solve(mut a: Vec<Vec<f64>>, mut b: Vec<f64>) -> Option<Vec<f64>> {
    let n = b.len();
    for column in 0..n {
        let pivot =
            (column..n).max_by(|&x, &y| a[x][column].abs().total_cmp(&a[y][column].abs()))?;
        if a[pivot][column].abs() < 1e-12 {
            return None;
        }
        a.swap(column, pivot);
        b.swap(column, pivot);
        for row in column + 1..n {
            let factor = a[row][column] / a[column][column];
            let pivot_row = a[column].clone();
            for (value, pivot) in a[row].iter_mut().zip(&pivot_row).skip(column) {
                *value -= factor * pivot;
            }
            b[row] -= factor * b[column];
        }
    }
    let mut x = vec![0.0; n];
    for row in (0..n).rev() {
        let rest: f64 = (row + 1..n).map(|k| a[row][k] * x[k]).sum();
        x[row] = (b[row] - rest) / a[row][row];
    }
    Some(x)
}

/// A pinhole camera at a yaw/pitch, for projecting world directions.
struct Camera {
    pitch: f32,
    /// Largest pitch difference at which the tile can still contribute.
    reach: f32,
    focal: f32,
    centre: (f32, f32),
    right: [f32; 3],
    up: [f32; 3],
    forward: [f32; 3],
}
impl Camera {
    fn new(tile: &Tile) -> Self {
        let (yaw, pitch) = (tile.yaw.to_radians(), tile.pitch.to_radians());
        let (w, h) = (tile.image.width as f32, tile.image.height as f32);
        let diagonal = (w * w + h * h).sqrt() / 2.0;
        Self {
            pitch,
            reach: (diagonal / tile.focal_px).atan() + 0.01,
            focal: tile.focal_px,
            centre: ((w - 1.0) / 2.0, (h - 1.0) / 2.0),
            forward: [
                pitch.cos() * yaw.sin(),
                pitch.sin(),
                pitch.cos() * yaw.cos(),
            ],
            right: [yaw.cos(), 0.0, -yaw.sin()],
            up: [
                -pitch.sin() * yaw.sin(),
                pitch.cos(),
                -pitch.sin() * yaw.cos(),
            ],
        }
    }
    /// Image position of the world direction at `yaw`/`pitch` (radians).
    fn project(&self, yaw: f32, pitch: f32) -> Option<(f32, f32)> {
        let d = [
            pitch.cos() * yaw.sin(),
            pitch.sin(),
            pitch.cos() * yaw.cos(),
        ];
        let dot = |a: &[f32; 3]| a[0] * d[0] + a[1] * d[1] + a[2] * d[2];
        let z = dot(&self.forward);
        if z <= 1e-3 {
            return None;
        }
        Some((
            self.centre.0 + self.focal * dot(&self.right) / z,
            self.centre.1 - self.focal * dot(&self.up) / z,
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A smooth but non-repeating test pattern.
    fn scene(x: f32, y: f32) -> u8 {
        let v = (x * 0.11).sin() * 60.0
            + (y * 0.07).cos() * 50.0
            + ((x + y) * 0.031).sin() * 40.0
            + ((x * 0.013 - y * 0.017).sin() * 30.0);
        (v + 128.0).clamp(0.0, 255.0) as u8
    }
    fn view(width: usize, height: usize, ox: f32, oy: f32) -> Rgb {
        let mut image = Rgb::new(width, height);
        for y in 0..height {
            for x in 0..width {
                let v = scene(x as f32 + ox, y as f32 + oy);
                let i = (y * width + x) * 3;
                image.data[i..i + 3].copy_from_slice(&[v, v / 2, 255 - v]);
            }
        }
        image
    }

    #[test]
    fn measures_known_shifts_to_sub_pixel_accuracy() {
        let a = view(480, 270, 0.0, 0.0).gray();
        // Moving the view right by 37.5 px moves content left by 37.5 px.
        let b = view(480, 270, 37.5, -12.0).gray();
        let shift = estimate_shift(&a, &b, 80, 30).unwrap();
        assert!((shift.dx + 37.5).abs() < 0.6, "{shift:?}");
        assert!((shift.dy - 12.0).abs() < 0.6, "{shift:?}");
        assert!(shift.score > 0.9);
    }

    #[test]
    fn finds_the_detailed_window_in_a_plain_frame() {
        let mut image = Gray {
            width: 320,
            height: 180,
            data: vec![100.0; 320 * 180],
        };
        // A checkerboard patch centred at (230, 60).
        for y in 50..70 {
            for x in 220..240 {
                image.data[y * 320 + x] = if (x / 2 + y / 2) % 2 == 0 { 0.0 } else { 255.0 };
            }
        }
        let (x, y) = most_detailed(&image, 32, 18);
        assert!(
            (x - 230.0).abs() <= 8.0 && (y - 60.0).abs() <= 6.0,
            "({x}, {y})"
        );
    }

    #[test]
    fn flat_images_report_a_low_score() {
        let flat = Gray {
            width: 320,
            height: 180,
            data: vec![100.0; 320 * 180],
        };
        assert!(estimate_shift(&flat, &flat, 40, 10).unwrap().score < 0.5);
    }

    #[test]
    fn rgbx_downscale_skips_row_padding() {
        let mut pixels = vec![];
        for row in 0..2u8 {
            for column in 0..4u8 {
                pixels.extend([column * 10 + row * 100, 50, 200, 255]);
            }
            pixels.extend([9, 9, 9, 9]);
        }
        let image = Rgb::from_rgbx(&pixels, 4, 2, 20, 2);
        assert_eq!((image.width, image.height), (2, 1));
        assert_eq!(image.data, vec![55, 50, 200, 75, 50, 200]);
    }

    const FOCAL: f32 = 300.0;
    fn world(yaw: f32, pitch: f32) -> u8 {
        scene(yaw * 8.0, -pitch * 8.0)
    }
    /// A 320×180 pinhole view of `world`, its brightness scaled by `gain`.
    fn render_tile(yaw: f32, pitch: f32, gain: f32) -> Tile {
        let camera = Camera::new(&Tile {
            image: Rgb::new(320, 180),
            yaw,
            pitch,
            focal_px: FOCAL,
        });
        let mut image = Rgb::new(320, 180);
        for y in 0..180 {
            for x in 0..320 {
                // Inverse of `project`: pixel ray to world yaw/pitch.
                let (u, v) = (
                    (x as f32 - camera.centre.0) / FOCAL,
                    (camera.centre.1 - y as f32) / FOCAL,
                );
                let d: [f32; 3] = std::array::from_fn(|i| {
                    camera.forward[i] + u * camera.right[i] + v * camera.up[i]
                });
                let yaw = d[0].atan2(d[2]).to_degrees();
                let pitch = d[1].atan2((d[0] * d[0] + d[2] * d[2]).sqrt()).to_degrees();
                let value = (f32::from(world(yaw, pitch)) * gain).min(255.0) as u8;
                image.data[(y * 320 + x) * 3..][..3].copy_from_slice(&[value; 3]);
            }
        }
        Tile {
            image,
            yaw,
            pitch,
            focal_px: FOCAL,
        }
    }

    #[test]
    fn stitched_tiles_reproduce_the_scene_they_were_cut_from() {
        // Cut overlapping pinhole tiles out of a known world and check
        // stitching puts their content back in the same place.
        let tiles: Vec<_> = [(-20.0, 0.0), (20.0, 0.0), (-20.0, 25.0), (20.0, 25.0)]
            .into_iter()
            .map(|(yaw, pitch)| render_tile(yaw, pitch, 1.0))
            .collect();
        let extent = Extent {
            left: -40.0,
            right: 40.0,
            top: 35.0,
            bottom: -10.0,
        };
        let panorama = stitch(&tiles, extent, 4.0);
        assert_eq!((panorama.width, panorama.height), (320, 180));
        let mut error = 0.0;
        let mut count = 0.0;
        for y in (10..170).step_by(7) {
            for x in (10..310).step_by(7) {
                let yaw = extent.left + (x as f32 + 0.5) / 4.0;
                let pitch = extent.top - (y as f32 + 0.5) / 4.0;
                let got = f32::from(panorama.data[(y * 320 + x) * 3]);
                error += (got - f32::from(world(yaw, pitch))).abs();
                count += 1.0;
            }
        }
        assert!(error / count < 6.0, "mean error {}", error / count);
    }

    #[test]
    fn brightness_differences_between_tiles_are_evened_out() {
        // The right tile was exposed 30% brighter.
        let tiles = [render_tile(-15.0, 0.0, 1.0), render_tile(15.0, 0.0, 1.3)];
        let extent = Extent {
            left: -40.0,
            right: 40.0,
            top: 15.0,
            bottom: -15.0,
        };
        let cameras: Vec<_> = tiles.iter().map(Camera::new).collect();
        let gains = gains(&tiles, &cameras, extent, 4.0);
        assert!(
            (gains[1] / gains[0] - 1.0 / 1.3).abs() < 0.05,
            "gains {gains:?}"
        );
        // The pull towards 1 keeps overall brightness near the original.
        assert!(
            gains.iter().all(|g| (0.7..1.2).contains(g)),
            "gains {gains:?}"
        );
    }

    #[test]
    fn focal_length_from_a_pan_is_unbiased_at_wide_and_narrow_views() {
        for focal in [556.0f32, 1200.0, 3000.0] {
            let angle = (640.0f32 / 8.0 / focal).atan();
            let a = render_view(0.0, 0.0, focal).gray();
            let b = render_view(angle.to_degrees(), 0.0, focal).gray();
            let (measured, shift) = focal_from_rotation(&a, &b, angle, Axis::Pan).unwrap();
            assert!(shift.score > 0.9);
            assert!(
                (measured / focal - 1.0).abs() < 0.004,
                "{focal}: {measured}"
            );
            // Whole-frame matching overstates focal length at wide views.
            let whole = estimate_shift(&a, &b, 213, 60).unwrap().dx.abs() / angle.tan();
            if focal < 1000.0 {
                assert!(whole / focal - 1.0 > 0.01, "{focal}: {whole}");
            }
        }
        // Tilt works the same way vertically.
        let focal = 556.0f32;
        let angle = (360.0f32 / 8.0 / focal).atan();
        let a = render_view(0.0, 0.0, focal).gray();
        let b = render_view(0.0, angle.to_degrees(), focal).gray();
        let (measured, shift) = focal_from_rotation(&a, &b, angle, Axis::Tilt).unwrap();
        assert!(shift.dy > 0.0, "tilting up moves content down");
        assert!((measured / focal - 1.0).abs() < 0.004, "tilt: {measured}");
        let (turned, _) = rotation_from_focal(&a, &b, focal, Axis::Tilt).unwrap();
        assert!((turned / angle - 1.0).abs() < 0.004, "tilt angle: {turned}");
    }

    #[test]
    fn zoom_ratios_and_centre_drift_are_measured_directly() {
        for (focal, ratio) in [(556.0f32, 1.2f32), (900.0, 1.35), (2500.0, 1.4)] {
            let a = render_view(3.0, -2.0, focal).gray();
            let b = render_view(3.0, -2.0, focal * ratio).gray();
            let step = zoom_ratio(&a, &b, 1.0, 2.0).unwrap();
            assert!(step.score > 0.9, "{step:?}");
            assert!(
                (step.ratio / ratio - 1.0).abs() < 0.005,
                "{focal}×{ratio}: {step:?}"
            );
            assert!(
                step.centre.0.abs() < 0.5 && step.centre.1.abs() < 0.5,
                "{step:?}"
            );
        }
        // A zoomed view whose centre drifted right and down by a known angle.
        let focal = 900.0f32;
        let (right, down) = ((6.0f32 / focal).atan(), (4.0f32 / focal).atan());
        let a = render_view(3.0, -2.0, focal).gray();
        let b = render_view(
            3.0 + right.to_degrees(),
            -2.0 - down.to_degrees(),
            focal * 1.3,
        )
        .gray();
        let step = zoom_ratio(&a, &b, 1.0, 2.0).unwrap();
        // Within a pixel (about 0.06° here) of the true drift.
        assert!(
            (step.centre.0 - 6.0).abs() < 1.0 && (step.centre.1 - 4.0).abs() < 1.0,
            "{step:?}"
        );
    }

    fn render_view(yaw: f32, pitch: f32, focal: f32) -> Rgb {
        let camera = Camera::new(&Tile {
            image: Rgb::new(640, 360),
            yaw,
            pitch,
            focal_px: focal,
        });
        let mut image = Rgb::new(640, 360);
        for y in 0..360 {
            for x in 0..640 {
                let (u, v) = (
                    (x as f32 - camera.centre.0) / focal,
                    (camera.centre.1 - y as f32) / focal,
                );
                let d: [f32; 3] = std::array::from_fn(|i| {
                    camera.forward[i] + u * camera.right[i] + v * camera.up[i]
                });
                let yaw = d[0].atan2(d[2]).to_degrees();
                let pitch = d[1].atan2((d[0] * d[0] + d[2] * d[2]).sqrt()).to_degrees();
                let value = noise(yaw, pitch);
                image.data[(y * 640 + x) * 3..][..3].copy_from_slice(&[value; 3]);
            }
        }
        image
    }
    /// Non-repeating value noise over world angles, several octaves.
    fn noise(yaw: f32, pitch: f32) -> u8 {
        let hash = |x: i32, y: i32| {
            let mut h = (x as u32).wrapping_mul(374761393) ^ (y as u32).wrapping_mul(668265263);
            h = (h ^ (h >> 13)).wrapping_mul(1274126177);
            ((h ^ (h >> 16)) & 0xffff) as f32 / 65535.0
        };
        let mut total = 0.0;
        for (octave, weight) in [(0.5f32, 0.5f32), (1.5, 0.3), (4.0, 0.2)] {
            let (x, y) = (yaw * octave, pitch * octave);
            let (x0, y0) = (x.floor(), y.floor());
            let (fx, fy) = (x - x0, y - y0);
            let (sx, sy) = (fx * fx * (3.0 - 2.0 * fx), fy * fy * (3.0 - 2.0 * fy));
            let (xi, yi) = (x0 as i32, y0 as i32);
            let top = hash(xi, yi) * (1.0 - sx) + hash(xi + 1, yi) * sx;
            let bottom = hash(xi, yi + 1) * (1.0 - sx) + hash(xi + 1, yi + 1) * sx;
            total += weight * (top * (1.0 - sy) + bottom * sy);
        }
        (total * 255.0) as u8
    }
}
