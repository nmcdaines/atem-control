import type {
  Action,
  Command,
  Config,
  Device,
  DeviceKind,
  Step,
} from "./bindings";

export function kind(device: Device): DeviceKind {
  return device.connection.type === "simulation"
    ? device.connection.kind
    : device.connection.type === "atem"
      ? "atem"
      : "camera";
}
export function defaultCommand(type: Command["type"]): Command {
  switch (type) {
    case "set_program":
    case "set_preview":
      return { type, input: 1 };
    case "set_input_name":
      return { type, input: 1, long_name: "Camera 1", short_name: "CAM1" };
    case "set_pip":
      return { type, enabled: true, source: 2, x: 10, y: -5, size: 0.25 };
    case "pan_tilt":
      return { type, pan: 0, tilt: 0, pan_speed: 8, tilt_speed: 8 };
    case "zoom":
      return { type, position: 0 };
    default:
      return { type };
  }
}
export const commandNames: Record<Command["type"], string> = {
  set_program: "Set program",
  set_preview: "Set preview",
  cut: "Cut",
  auto: "Auto transition",
  set_input_name: "Rename input",
  set_pip: "Picture in picture",
  pan_tilt: "Pan / tilt position",
  zoom: "Zoom position",
  stop: "Stop camera",
  refresh: "Read camera position",
};
export function commands(device?: Device): Command["type"][] {
  return device && kind(device) === "camera"
    ? ["pan_tilt", "zoom", "stop", "refresh"]
    : [
        "set_preview",
        "set_program",
        "cut",
        "auto",
        "set_pip",
        "set_input_name",
      ];
}
export function newAction(device?: Device): Action {
  return {
    device_id: device?.id ?? "",
    command: defaultCommand(
      device && kind(device) === "camera" ? "pan_tilt" : "set_preview",
    ),
    delay_ms: 0,
    timeout_ms: 10000,
  };
}
export function moveStep(
  steps: Step[],
  index: number,
  direction: -1 | 1,
): Step[] {
  const target = index + direction;
  if (target < 0 || target >= steps.length) return steps;
  const result = [...steps];
  [result[index], result[target]] = [result[target], result[index]];
  return result;
}
export function removeMacro(config: Config, id: string): Config {
  return {
    ...config,
    macros: config.macros.filter((m) => m.id !== id),
    shortcuts: config.shortcuts.filter((s) => s.macro_id !== id),
  };
}
