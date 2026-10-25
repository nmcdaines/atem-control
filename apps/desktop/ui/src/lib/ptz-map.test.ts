import { describe, expect, it } from "vitest";
import type { CameraCalibration } from "../bindings";
import {
  clampToLimits,
  focalAt,
  frameRect,
  layout,
  mapExtent,
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
    { zoom: 0, focal_px: 556.2 },
    { zoom: 8192, focal_px: 1687.7 },
    { zoom: 16384, focal_px: 5214.6 },
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
