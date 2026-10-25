import { describe, expect, it } from "vitest";
import type { CameraCalibration } from "../bindings";
import {
  clampToLimits,
  focalAt,
  frameRect,
  layout,
  limitsBounds,
  mapExtent,
  padRect,
  previewCells,
  centreOffset,
  rangeFromCorners,
  viewUnits,
  withinLimits,
} from "./ptz-map";

// Measured on the BirdDog P100.
const p100: CameraCalibration = {
  pan_units_per_degree: 12.95,
  tilt_units_per_degree: 12.57,
  pan_direction: 1,
  tilt_direction: 1,
  frame_width: 640,
  frame_height: 360,
  focal: [
    { zoom: 0, focal_px: 556.2, centre_x: 0, centre_y: 0 },
    { zoom: 8192, focal_px: 1687.7, centre_x: 0, centre_y: 0 },
    { zoom: 16384, focal_px: 5214.6, centre_x: 0, centre_y: 0 },
  ],
};
const range = { pan_min: -2216, pan_max: 2216, tilt_min: -394, tilt_max: 372 };

describe("calibrated PTZ map", () => {
  it("interpolates focal length geometrically and sizes the view", () => {
    expect(focalAt(p100, 0)).toBeCloseTo(556.2);
    expect(focalAt(p100, 4096)).toBeCloseTo(Math.sqrt(556.2 * 1687.7), 1);
    expect(focalAt(p100, 20000)).toBeCloseTo(5214.6);
    // About 60° wide at the widest zoom.
    expect(viewUnits(p100, 0).width / 12.95).toBeCloseTo(59.8, 0);
  });

  it("places the panorama and frames consistently", () => {
    const extent = mapExtent(p100, range, {
      device_id: "p100",
      width: 3903,
      height: 939,
      pan_left: -2603,
      pan_right: 2603,
      tilt_top: 597,
      tilt_bottom: -618,
      tiles: 40,
      created_at: 0,
    });
    expect(extent).toEqual({
      left: -2603,
      right: 2603,
      top: 597,
      bottom: -618,
    });
    const map = layout(extent, 800, 300);
    // A wide panorama fits the width and is centred vertically.
    expect(map.scale).toBeCloseTo(800 / 5206);
    const centre = map.toPx(0, 0);
    expect(centre.x).toBeCloseTo(400);
    const back = map.toView(centre.x, centre.y);
    expect(back.x).toBeCloseTo(0);
    expect(back.y).toBeCloseTo(0);
    const frame = frameRect(p100, { pan: 0, tilt: 0, zoom: 0 });
    expect(frame.right - frame.left).toBeCloseTo(viewUnits(p100, 0).width);
  });

  it("caps an unscanned map at what a camera can physically turn", () => {
    const huge = {
      pan_min: -32767,
      pan_max: 32767,
      tilt_min: -32767,
      tilt_max: 32767,
    };
    const extent = mapExtent(p100, huge);
    const half = viewUnits(p100, 0);
    expect(extent.right).toBeCloseTo(180 * 12.95 + half.width / 2);
    expect(extent.top).toBeCloseTo(90 * 12.57 + half.height / 2);
  });

  it("mirrors the view when the camera's directions are reversed", () => {
    const mirrored = { ...p100, pan_direction: -1 };
    const extent = mapExtent(mirrored, range);
    const frame = frameRect(mirrored, { pan: 1000, tilt: 0, zoom: 16384 });
    expect(frame.left).toBeLessThan(-900);
    expect(extent.left).toBeLessThan(-2216);
  });

  it("keeps targets' frames inside soft limits", () => {
    const limits = {
      pan_min: -1000,
      pan_max: 1000,
      tilt_min: -300,
      tilt_max: 300,
    };
    const wide = clampToLimits(
      p100,
      { rect: limits },
      { pan: 900, tilt: 0, zoom: 0 },
    );
    expect(withinLimits(p100, { rect: limits }, wide)).toBe(true);
    expect(wide.pan).toBeLessThan(900);
    // Zoomed in, the requested centre already fits.
    const tele = { pan: 900, tilt: 0, zoom: 16384 };
    expect(clampToLimits(p100, { rect: limits }, tele)).toEqual(tele);
    expect(
      withinLimits(p100, { rect: limits }, { pan: 900, tilt: 0, zoom: 0 }),
    ).toBe(false);
  });

  it("keeps targets' frames inside a concave polygon", () => {
    // An L shape: the top-right quarter is excluded.
    const point = (pan: number, tilt: number) => ({ pan, tilt });
    const limits = {
      polygon: [
        point(-1500, -400),
        point(1500, -400),
        point(1500, 0),
        point(0, 0),
        point(0, 400),
        point(-1500, 400),
      ],
    };
    const tele = (pan: number, tilt: number) => ({ pan, tilt, zoom: 16384 });
    expect(withinLimits(p100, limits, tele(-500, 200))).toBe(true);
    expect(withinLimits(p100, limits, tele(500, -200))).toBe(true);
    expect(withinLimits(p100, limits, tele(500, 200))).toBe(false);
    // Aiming into the excluded quarter slides back towards the centre.
    const held = clampToLimits(p100, limits, tele(800, 300));
    expect(withinLimits(p100, limits, held)).toBe(true);
    expect(held.pan).toBeLessThan(800);
  });

  it("frames the map on the soft limits with a margin", () => {
    const whole = { left: -2600, right: 2600, top: 600, bottom: -1200 };
    expect(limitsBounds(p100, {})).toBeNull();
    const rect = limitsBounds(p100, {
      rect: { pan_min: -500, pan_max: 500, tilt_min: -200, tilt_max: 100 },
    })!;
    expect(rect).toEqual({ left: -500, right: 500, top: 100, bottom: -200 });
    expect(padRect(rect, 0.1, whole)).toEqual({
      left: -600,
      right: 600,
      top: 130,
      bottom: -230,
    });
    // A polygon frames on its bounding box; padding stays inside the room.
    const point = (pan: number, tilt: number) => ({ pan, tilt });
    const polygon = limitsBounds(p100, {
      polygon: [point(2000, 0), point(2600, 500), point(2300, 600)],
    })!;
    expect(polygon).toEqual({ left: 2000, right: 2600, top: 600, bottom: 0 });
    expect(padRect(polygon, 0.1, whole).right).toBe(2600);
  });

  it("shifts zoomed frames by the lens's measured centre drift", () => {
    // At full zoom the picture centre lies 10 px right and 20 px down of
    // the widest zoom's centre.
    const drifting = {
      ...p100,
      focal: [
        { zoom: 0, focal_px: 556.2, centre_x: 0, centre_y: 0 },
        { zoom: 16384, focal_px: 5214.6, centre_x: 10, centre_y: 20 },
      ],
    };
    const right = (Math.atan(10 / 556.2) * 180) / Math.PI;
    const down = (Math.atan(20 / 556.2) * 180) / Math.PI;
    expect(centreOffset(drifting, 0)).toEqual({ pan: 0, tilt: -0 });
    const full = centreOffset(drifting, 16384);
    expect(full.pan).toBeCloseTo(right * 12.95);
    expect(full.tilt).toBeCloseTo(-down * 12.57);
    // Halfway, the drift is interpolated.
    expect(centreOffset(drifting, 8192).pan).toBeCloseTo((right * 12.95) / 2);
    const frame = frameRect(drifting, { pan: 0, tilt: 0, zoom: 16384 });
    expect((frame.left + frame.right) / 2).toBeCloseTo(full.pan);
    expect((frame.top + frame.bottom) / 2).toBeCloseTo(full.tilt);
    // The live picture is drawn over the same, shifted frame.
    const cells = previewCells(
      drifting,
      { pan: 0, tilt: 0, zoom: 16384 },
      480,
      270,
    );
    expect(Math.min(...cells.map((c) => c.rect.left))).toBeCloseTo(
      frame.left,
      6,
    );
  });

  it("places live image cells at the angles they show", () => {
    const position = { pan: 100, tilt: -50, zoom: 0 };
    const cells = previewCells(p100, position, 480, 270, 12, 8);
    const frame = frameRect(p100, position);
    // The cells exactly cover the frame the map draws.
    const left = Math.min(...cells.map((c) => c.rect.left));
    const right = Math.max(...cells.map((c) => c.rect.right));
    const top = Math.max(...cells.map((c) => c.rect.top));
    const bottom = Math.min(...cells.map((c) => c.rect.bottom));
    expect(left).toBeCloseTo(frame.left, 6);
    expect(right).toBeCloseTo(frame.right, 6);
    expect(top).toBeCloseTo(frame.top, 6);
    expect(bottom).toBeCloseTo(frame.bottom, 6);
    // Edge columns cover fewer degrees than central ones (pinhole lens).
    const width = (c: (typeof cells)[number]) => c.rect.right - c.rect.left;
    expect(width(cells[0])).toBeLessThan(width(cells[5]) * 0.95);
  });

  it("builds a limit range from dragged corners in any direction", () => {
    expect(
      rangeFromCorners(p100, { x: 50, y: -20 }, { x: -50, y: 40 }),
    ).toEqual({
      pan_min: -50,
      pan_max: 50,
      tilt_min: -20,
      tilt_max: 40,
    });
  });
});
