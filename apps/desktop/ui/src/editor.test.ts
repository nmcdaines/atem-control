import { describe, expect, it } from "vitest";
import { moveStep, removeMacro, newAction } from "./editor";
import type { Config, Step } from "./bindings";
describe("macro editing", () => {
  it("reorders steps without changing the original array", () => {
    const steps: Step[] = [
      { type: "wait", duration_ms: 200 },
      { type: "wait", duration_ms: 500 },
    ];
    expect(moveStep(steps, 0, 1)).toEqual([steps[1], steps[0]]);
    expect(steps[0]).toEqual({ type: "wait", duration_ms: 200 });
    expect(moveStep(steps, 0, -1)).toBe(steps);
  });
  it("removes shortcut references when deleting a macro", () => {
    const config: Config = {
      version: 1,
      devices: [],
      macros: [],
      shortcuts: [{ id: "s", page: 0, slot: 0, macro_id: "m" }],
    };
    expect(removeMacro(config, "m").shortcuts).toEqual([]);
  });
  it("uses camera commands for camera steps", () => {
    expect(
      newAction({
        id: "c",
        name: "Camera",
        connection: { type: "simulation", kind: "camera" },
      }).command.type,
    ).toBe("pan_tilt");
  });
});
