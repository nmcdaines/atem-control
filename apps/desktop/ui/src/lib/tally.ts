import type { Device, Snapshot } from "../bindings";

export type Tally = "program" | "preview" | null;

// Whether a camera's switcher input is on program or preview on any switcher.
export function tally(device: Device, snapshot: Snapshot): Tally {
  if (device.atem_input === undefined) return null;
  const switchers = snapshot.devices.flatMap((d) =>
    d.switcher ? [d.switcher] : [],
  );
  if (switchers.some((s) => s.program === device.atem_input)) return "program";
  if (switchers.some((s) => s.preview === device.atem_input)) return "preview";
  return null;
}
