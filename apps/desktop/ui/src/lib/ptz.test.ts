import { describe, expect, it } from "vitest";
import { frameFor, targetAt } from "./ptz";
const limits = { pan: 1000, tilt: 500, zoom: 16384 };
describe("PTZ framing map", () => {
  it("shrinks with zoom without moving its center", () => {
    const wide = frameFor({ pan: 600, tilt: 300, zoom: 0 }, limits, 640, 360);
    const tight = frameFor(
      { pan: 600, tilt: 300, zoom: 16384 },
      limits,
      640,
      360,
    );
    expect(tight.width).toBeLessThan(wide.width);
    expect(tight.height).toBeLessThan(wide.height);
    expect(tight.x + tight.width / 2).toBe(wide.x + wide.width / 2);
    expect(tight.y + tight.height / 2).toBe(wide.y + wide.height / 2);
  });
  it("maps positive pan right and positive tilt up, within bounds", () => {
    const frame = frameFor({ pan: 1000, tilt: 500, zoom: 0 }, limits, 640, 360);
    expect(frame.x + frame.width / 2).toBeGreaterThan(320);
    expect(frame.y + frame.height / 2).toBeLessThan(180);
    expect(frame.x + frame.width).toBeLessThanOrEqual(620);
    expect(frame.y).toBeGreaterThanOrEqual(20);
  });
  it("round trips frame centers and clamps dragged targets to device limits", () => {
    const frame = frameFor(
      { pan: -800, tilt: 250, zoom: 8000 },
      limits,
      640,
      360,
    );
    expect(
      targetAt(
        frame.x + frame.width / 2,
        frame.y + frame.height / 2,
        limits,
        640,
        360,
      ),
    ).toEqual({ pan: -800, tilt: 250 });
    expect(targetAt(10000, -10000, limits, 640, 360)).toEqual({
      pan: 1000,
      tilt: 500,
    });
  });
});
