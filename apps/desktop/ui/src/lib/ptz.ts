export type PtzPosition = { pan: number; tilt: number; zoom: number };
export type PtzLimits = { pan: number; tilt: number; zoom: number };
export type Frame = { x: number; y: number; width: number; height: number };

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

// This is a schematic framing map, not an optical lens/FOV calculation. The
// motion area is fixed so changing zoom cannot move the center of the frame.
export function frameFor(
  position: PtzPosition,
  limits: PtzLimits,
  width: number,
  height: number,
): Frame {
  const inset = 20;
  const areaWidth = Math.max(1, width - inset * 2);
  const areaHeight = Math.max(1, height - inset * 2);
  const normalizedZoom = clamp(position.zoom / Math.max(1, limits.zoom), 0, 1);
  const scale = 1 / (1 + normalizedZoom * 4);
  const frameWidth = areaWidth * 0.5 * scale;
  const frameHeight = areaHeight * 0.5 * scale;
  const centerX =
    width / 2 +
    clamp(position.pan / Math.max(1, limits.pan), -1, 1) * areaWidth * 0.25;
  const centerY =
    height / 2 -
    clamp(position.tilt / Math.max(1, limits.tilt), -1, 1) * areaHeight * 0.25;
  return {
    x: centerX - frameWidth / 2,
    y: centerY - frameHeight / 2,
    width: frameWidth,
    height: frameHeight,
  };
}

export function targetAt(
  x: number,
  y: number,
  limits: PtzLimits,
  width: number,
  height: number,
) {
  return {
    pan: Math.round(
      clamp((x - width / 2) / (Math.max(1, width - 40) * 0.25), -1, 1) *
        limits.pan,
    ),
    tilt: Math.round(
      clamp((height / 2 - y) / (Math.max(1, height - 40) * 0.25), -1, 1) *
        limits.tilt,
    ),
  };
}

// Shifts zoom by a fraction of its full range, e.g. 0.1 zooms in 10%.
export function adjustZoom(zoom: number, fraction: number, limit: number) {
  return Math.round(clamp(zoom + fraction * limit, 0, limit));
}
