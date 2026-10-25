import type {
  CameraCalibration,
  PanoramaInfo,
  PtzPoint,
  PtzRange,
} from "../bindings";
import { clamp } from "./ptz";

// Map coordinates are "view units": raw camera units flipped so x grows to
// the right of the picture and y grows upwards.
export type Rect = { left: number; right: number; top: number; bottom: number };
export type Position = { pan: number; tilt: number; zoom: number };

/** Focal length in calibration pixels at `zoom`; mirrors the Rust core. */
export function focalAt(calibration: CameraCalibration, zoom: number) {
  const samples = calibration.focal;
  if (!samples.length) return NaN;
  if (zoom <= samples[0].zoom) return samples[0].focal_px;
  for (let i = 1; i < samples.length; i++) {
    const [a, b] = [samples[i - 1], samples[i]];
    if (zoom <= b.zoom) {
      const t = (zoom - a.zoom) / Math.max(1, b.zoom - a.zoom);
      return a.focal_px * Math.pow(b.focal_px / a.focal_px, t);
    }
  }
  return samples[samples.length - 1].focal_px;
}

/**
 * Where the picture centre points at `zoom`, relative to the reported
 * pan/tilt, in raw units: lenses drift slightly as they zoom. Mirrors the core.
 */
export function centreOffset(calibration: CameraCalibration, zoom: number) {
  const samples = calibration.focal;
  if (!samples.length) return { pan: 0, tilt: 0 };
  let [x, y] = [samples[0].centre_x, samples[0].centre_y];
  const after = samples.findIndex((s) => s.zoom >= zoom);
  if (after === -1) {
    const last = samples[samples.length - 1];
    [x, y] = [last.centre_x, last.centre_y];
  } else if (after > 0) {
    const [a, b] = [samples[after - 1], samples[after]];
    const t = (zoom - a.zoom) / Math.max(1, b.zoom - a.zoom);
    [x, y] = [
      a.centre_x + (b.centre_x - a.centre_x) * t,
      a.centre_y + (b.centre_y - a.centre_y) * t,
    ];
  }
  const wide = samples[0].focal_px;
  const degrees = (v: number) => (Math.atan(v / wide) * 180) / Math.PI;
  return {
    pan:
      degrees(x) * calibration.pan_units_per_degree * calibration.pan_direction,
    tilt:
      degrees(-y) *
      calibration.tilt_units_per_degree *
      calibration.tilt_direction,
  };
}

/** Where the picture centre actually points for a camera position. */
function pictureCentre(calibration: CameraCalibration, position: Position) {
  const offset = centreOffset(calibration, position.zoom);
  return { pan: position.pan + offset.pan, tilt: position.tilt + offset.tilt };
}

/** Visible frame size in raw pan/tilt units at `zoom`. */
export function viewUnits(calibration: CameraCalibration, zoom: number) {
  const focal = focalAt(calibration, zoom);
  const degrees = (pixels: number) =>
    (2 * Math.atan(pixels / 2 / focal) * 180) / Math.PI;
  return {
    width: degrees(calibration.frame_width) * calibration.pan_units_per_degree,
    height:
      degrees(calibration.frame_height) * calibration.tilt_units_per_degree,
  };
}

export function toView(
  calibration: CameraCalibration,
  pan: number,
  tilt: number,
) {
  return {
    x: pan * calibration.pan_direction,
    y: tilt * calibration.tilt_direction,
  };
}

export function fromView(calibration: CameraCalibration, x: number, y: number) {
  return {
    pan: x * calibration.pan_direction,
    tilt: y * calibration.tilt_direction,
  };
}

/** A raw-unit range as a view-unit rectangle. */
export function rangeRect(
  calibration: CameraCalibration,
  range: PtzRange,
): Rect {
  const a = toView(calibration, range.pan_min, range.tilt_min);
  const b = toView(calibration, range.pan_max, range.tilt_max);
  return {
    left: Math.min(a.x, b.x),
    right: Math.max(a.x, b.x),
    top: Math.max(a.y, b.y),
    bottom: Math.min(a.y, b.y),
  };
}

/** The view-unit rectangle a camera position shows. */
export function frameRect(
  calibration: CameraCalibration,
  position: Position,
): Rect {
  const { width, height } = viewUnits(calibration, position.zoom);
  const centre = pictureCentre(calibration, position);
  const { x, y } = toView(calibration, centre.pan, centre.tilt);
  return {
    left: x - width / 2,
    right: x + width / 2,
    top: y + height / 2,
    bottom: y - height / 2,
  };
}

/** What the map spans: the panorama, else the range plus half a wide frame. */
export function mapExtent(
  calibration: CameraCalibration,
  range: PtzRange,
  panorama?: PanoramaInfo | null,
): Rect {
  if (panorama) {
    const a = toView(calibration, panorama.pan_left, panorama.tilt_top);
    const b = toView(calibration, panorama.pan_right, panorama.tilt_bottom);
    return { left: a.x, right: b.x, top: a.y, bottom: b.y };
  }
  // Profile limits default to ±32767, far beyond what a camera can turn, so
  // cap them at ±180° pan and ±90° tilt.
  const pan = 180 * calibration.pan_units_per_degree;
  const tilt = 90 * calibration.tilt_units_per_degree;
  const area = rangeRect(calibration, {
    pan_min: Math.max(range.pan_min, -pan),
    pan_max: Math.min(range.pan_max, pan),
    tilt_min: Math.max(range.tilt_min, -tilt),
    tilt_max: Math.min(range.tilt_max, tilt),
  });
  const { width, height } = viewUnits(calibration, 0);
  return {
    left: area.left - width / 2,
    right: area.right + width / 2,
    top: area.top + height / 2,
    bottom: area.bottom - height / 2,
  };
}

/** Fits `extent` into a canvas, centred, preserving its aspect ratio. */
export function layout(extent: Rect, width: number, height: number) {
  const scale = Math.min(
    width / (extent.right - extent.left),
    height / (extent.top - extent.bottom),
  );
  const offsetX = (width - (extent.right - extent.left) * scale) / 2;
  const offsetY = (height - (extent.top - extent.bottom) * scale) / 2;
  return {
    scale,
    toPx: (x: number, y: number) => ({
      x: offsetX + (x - extent.left) * scale,
      y: offsetY + (extent.top - y) * scale,
    }),
    toView: (px: number, py: number) => ({
      x: extent.left + (px - offsetX) / scale,
      y: extent.top - (py - offsetY) / scale,
    }),
    rect: (r: Rect) => ({
      x: offsetX + (r.left - extent.left) * scale,
      y: offsetY + (extent.top - r.top) * scale,
      width: (r.right - r.left) * scale,
      height: (r.top - r.bottom) * scale,
    }),
  };
}

/** Soft limits: a rectangle and/or a polygon, both in raw units. */
export type Limits = {
  rect?: PtzRange | null;
  polygon?: PtzPoint[] | null;
};

/** Whether an axis-aligned rectangle lies inside a simple polygon; mirrors the core. */
export function rectInPolygon(
  [left, right, bottom, top]: [number, number, number, number],
  polygon: [number, number][],
) {
  const inside = ([x, y]: [number, number]) => {
    let odd = false;
    polygon.forEach(([x1, y1], i) => {
      const [x2, y2] = polygon[(i + 1) % polygon.length];
      if (y1 > y !== y2 > y && x < x1 + ((y - y1) / (y2 - y1)) * (x2 - x1))
        odd = !odd;
    });
    return odd;
  };
  const corners: [number, number][] = [
    [left, bottom],
    [right, bottom],
    [right, top],
    [left, top],
  ];
  if (!corners.every(inside)) return false;
  if (polygon.some(([x, y]) => x > left && x < right && y > bottom && y < top))
    return false;
  type P = [number, number];
  const side = (p: P, q: P, r: P) =>
    (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const cross = (a: P, b: P, c: P, d: P) =>
    side(c, d, a) * side(c, d, b) < 0 && side(a, b, c) * side(a, b, d) < 0;
  return polygon.every((a, i) => {
    const b = polygon[(i + 1) % polygon.length];
    return corners.every((c, k) => !cross(a, b, c, corners[(k + 1) % 4]));
  });
}

/** Whether a target's frame fits inside the limits, matching the core. */
export function withinLimits(
  calibration: CameraCalibration,
  limits: Limits,
  target: Position,
) {
  const { width, height } = viewUnits(calibration, target.zoom);
  const centre = pictureCentre(calibration, target);
  const frame: [number, number, number, number] = [
    centre.pan - width / 2,
    centre.pan + width / 2,
    centre.tilt - height / 2,
    centre.tilt + height / 2,
  ];
  const { rect, polygon } = limits;
  const inRect =
    !rect ||
    (frame[0] >= rect.pan_min - 0.5 &&
      frame[1] <= rect.pan_max + 0.5 &&
      frame[2] >= rect.tilt_min - 0.5 &&
      frame[3] <= rect.tilt_max + 0.5);
  const inPolygon =
    !polygon ||
    rectInPolygon(
      frame,
      polygon.map((p) => [p.pan, p.tilt]),
    );
  return inRect && inPolygon;
}

/**
 * Moves a target so its visible frame stays inside the soft limits, as the
 * core enforces. A rectangle clamps directly. For a polygon the target moves
 * to the furthest allowed point on the way from the nearest allowed position;
 * if nothing fits at this zoom the target is left (and shown) as is.
 */
export function clampToLimits(
  calibration: CameraCalibration,
  limits: Limits,
  target: Position,
): Position {
  let next = target;
  if (limits.rect) {
    const { width, height } = viewUnits(calibration, target.zoom);
    const offset = centreOffset(calibration, target.zoom);
    // Fit the picture centre, then convert back to the commanded position.
    const fit = (value: number, half: number, min: number, max: number) =>
      max - min < half * 2
        ? (min + max) / 2
        : clamp(value, min + half, max - half);
    next = {
      ...next,
      pan: Math.round(
        fit(
          next.pan + offset.pan,
          width / 2,
          limits.rect.pan_min,
          limits.rect.pan_max,
        ) - offset.pan,
      ),
      tilt: Math.round(
        fit(
          next.tilt + offset.tilt,
          height / 2,
          limits.rect.tilt_min,
          limits.rect.tilt_max,
        ) - offset.tilt,
      ),
    };
  }
  if (limits.polygon?.length && !withinLimits(calibration, limits, next)) {
    // A concave polygon's vertex average can be outside it, so anchor on the
    // allowed position nearest the target from a grid over the polygon, then
    // slide from there towards the target as far as is allowed.
    const pans = limits.polygon.map((p) => p.pan);
    const tilts = limits.polygon.map((p) => p.tilt);
    const [left, right] = [Math.min(...pans), Math.max(...pans)];
    const [bottom, top] = [Math.min(...tilts), Math.max(...tilts)];
    let anchor: Position | null = null;
    let nearest = Infinity;
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      for (let j = 0; j <= steps; j++) {
        const probe = {
          ...next,
          pan: Math.round(left + ((right - left) * i) / steps),
          tilt: Math.round(bottom + ((top - bottom) * j) / steps),
        };
        const distance = Math.hypot(
          probe.pan - next.pan,
          probe.tilt - next.tilt,
        );
        if (distance < nearest && withinLimits(calibration, limits, probe)) {
          anchor = probe;
          nearest = distance;
        }
      }
    }
    if (!anchor) return next;
    let [low, high] = [0, 1];
    const along = (t: number) => ({
      ...next,
      pan: Math.round(anchor.pan + (next.pan - anchor.pan) * t),
      tilt: Math.round(anchor.tilt + (next.tilt - anchor.tilt) * t),
    });
    for (let step = 0; step < 16; step++) {
      const mid = (low + high) / 2;
      if (withinLimits(calibration, limits, along(mid))) low = mid;
      else high = mid;
    }
    next = along(low);
  }
  return next;
}

/** A raw-unit range from two view-unit corners, e.g. a dragged rectangle. */
export function rangeFromCorners(
  calibration: CameraCalibration,
  a: { x: number; y: number },
  b: { x: number; y: number },
): PtzRange {
  const p = fromView(calibration, a.x, a.y);
  const q = fromView(calibration, b.x, b.y);
  return {
    pan_min: Math.round(Math.min(p.pan, q.pan)),
    pan_max: Math.round(Math.max(p.pan, q.pan)),
    tilt_min: Math.round(Math.min(p.tilt, q.tilt)),
    tilt_max: Math.round(Math.max(p.tilt, q.tilt)),
  };
}

/** The view-unit bounding box of the soft limits, or null if there are none. */
export function limitsBounds(
  calibration: CameraCalibration,
  limits: Limits,
): Rect | null {
  if (limits.polygon?.length) {
    const points = limits.polygon.map((p) =>
      toView(calibration, p.pan, p.tilt),
    );
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    return {
      left: Math.min(...xs),
      right: Math.max(...xs),
      top: Math.max(...ys),
      bottom: Math.min(...ys),
    };
  }
  return limits.rect ? rangeRect(calibration, limits.rect) : null;
}

/** `rect` grown by `fraction` of its size on every side, kept within `outer`. */
export function padRect(rect: Rect, fraction: number, outer: Rect): Rect {
  const dx = (rect.right - rect.left) * fraction;
  const dy = (rect.top - rect.bottom) * fraction;
  return {
    left: Math.max(outer.left, rect.left - dx),
    right: Math.min(outer.right, rect.right + dx),
    top: Math.min(outer.top, rect.top + dy),
    bottom: Math.max(outer.bottom, rect.bottom - dy),
  };
}

export type PreviewCell = {
  // Source rectangle in the preview image, in its pixels.
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  // Where it belongs on the map, in view units.
  rect: Rect;
};

/**
 * Splits a live camera image into cells placed at the angles they show. A
 * camera image is a flat (pinhole) projection whose edges cover fewer degrees
 * per pixel than its centre, while the map is linear in angle; stretching the
 * whole image evenly over the frame would make its centre look too small.
 */
export function previewCells(
  calibration: CameraCalibration,
  position: Position,
  imageWidth: number,
  imageHeight: number,
  columns = 12,
  rows = 8,
): PreviewCell[] {
  // Focal length in this image's pixels.
  const focal =
    (focalAt(calibration, position.zoom) * imageWidth) /
    calibration.frame_width;
  const picture = pictureCentre(calibration, position);
  const centre = toView(calibration, picture.pan, picture.tilt);
  const degrees = (pixels: number) =>
    (Math.atan(pixels / focal) * 180) / Math.PI;
  const xAt = (px: number) =>
    centre.x + degrees(px - imageWidth / 2) * calibration.pan_units_per_degree;
  const yAt = (py: number) =>
    centre.y +
    degrees(imageHeight / 2 - py) * calibration.tilt_units_per_degree;
  const cells: PreviewCell[] = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const sx = (imageWidth * column) / columns;
      const sy = (imageHeight * row) / rows;
      const sw = imageWidth / columns;
      const sh = imageHeight / rows;
      cells.push({
        sx,
        sy,
        sw,
        sh,
        rect: {
          left: xAt(sx),
          right: xAt(sx + sw),
          top: yAt(sy),
          bottom: yAt(sy + sh),
        },
      });
    }
  }
  return cells;
}
