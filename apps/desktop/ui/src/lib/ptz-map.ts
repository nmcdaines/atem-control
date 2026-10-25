import type { CameraCalibration, PanoramaInfo, PtzRange } from "../bindings";
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
  const { x, y } = toView(calibration, position.pan, position.tilt);
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
  const area = rangeRect(calibration, range);
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

/**
 * Moves a target so its visible frame stays inside the soft limits, as the
 * core enforces. If the frame is larger than the limits at this zoom it is
 * centred, and the core will refuse it until zoomed in.
 */
export function clampToLimits(
  calibration: CameraCalibration,
  limits: PtzRange | null | undefined,
  target: Position,
): Position {
  if (!limits) return target;
  const { width, height } = viewUnits(calibration, target.zoom);
  const fit = (value: number, half: number, min: number, max: number) =>
    max - min < half * 2
      ? Math.round((min + max) / 2)
      : Math.round(clamp(value, min + half, max - half));
  return {
    ...target,
    pan: fit(target.pan, width / 2, limits.pan_min, limits.pan_max),
    tilt: fit(target.tilt, height / 2, limits.tilt_min, limits.tilt_max),
  };
}

/** Whether a target's frame fits inside the limits, matching the core. */
export function withinLimits(
  calibration: CameraCalibration,
  limits: PtzRange | null | undefined,
  target: Position,
) {
  if (!limits) return true;
  const { width, height } = viewUnits(calibration, target.zoom);
  return (
    target.pan - width / 2 >= limits.pan_min - 0.5 &&
    target.pan + width / 2 <= limits.pan_max + 0.5 &&
    target.tilt - height / 2 >= limits.tilt_min - 0.5 &&
    target.tilt + height / 2 <= limits.tilt_max + 0.5
  );
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
