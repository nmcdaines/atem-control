import { invoke, isTauri } from "@tauri-apps/api/core";
import type {
  Command,
  Config,
  DeviceState,
  NdiSource,
  PostgresImportSettings,
  ScanDetail,
  Snapshot,
} from "./bindings";

export type ImportPreview = { config: Config; warnings: string[] };

async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(
    `/api/${path}`,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(error.error ?? JSON.stringify(error));
  }
  return response.json() as Promise<T>;
}
export const api = {
  snapshot: (): Promise<Snapshot> =>
    isTauri() ? invoke("snapshot") : request("snapshot"),
  save: (config: Config) =>
    isTauri() ? invoke("save_config", { config }) : request("config", config),
  import: (config: Config) =>
    isTauri() ? invoke("import_config", { config }) : request("import", config),
  execute: (device_id: string, command: Command) =>
    isTauri()
      ? invoke("execute", { deviceId: device_id, command })
      : request("execute", { device_id, command }),
  run: (macro_id: string) =>
    isTauri()
      ? invoke<string>("run_macro", { macroId: macro_id })
      : request<string>("run", { macro_id }),
  cancel: (run_id: string) =>
    isTauri()
      ? invoke("cancel_run", { runId: run_id })
      : request("cancel", { run_id }),
  demo: () => (isTauri() ? invoke("load_demo") : request("demo", {})),
  legacy: (json: string) =>
    isTauri()
      ? invoke<{ config: Config; warnings: string[] }>("preview_legacy", {
          json,
        })
      : request<{ config: Config; warnings: string[] }>("legacy", { json }),
  postgres: (settings: PostgresImportSettings) =>
    isTauri()
      ? invoke<ImportPreview>("preview_postgres", { settings })
      : request<ImportPreview>("postgres", settings),
  // One device's state, cheap enough to poll quickly while a camera moves.
  deviceState: (device_id: string) =>
    isTauri()
      ? invoke<DeviceState>("device_state", { deviceId: device_id })
      : request<DeviceState>(`devices/${encodeURIComponent(device_id)}/state`),
  calibrate: (device_id: string) =>
    isTauri()
      ? invoke<string>("calibrate_camera", { deviceId: device_id })
      : request<string>(
          `devices/${encodeURIComponent(device_id)}/calibrate`,
          {},
        ),
  scan: (device_id: string, detail: ScanDetail = "fast") =>
    isTauri()
      ? invoke<string>("scan_camera", { deviceId: device_id, detail })
      : request<string>(`devices/${encodeURIComponent(device_id)}/scan`, {
          detail,
        }),
  // The stored panorama JPEG, or null if the camera has not been scanned.
  panorama: async (device_id: string): Promise<Blob | null> => {
    if (isTauri()) {
      const bytes = await invoke<ArrayBuffer>("panorama", {
        deviceId: device_id,
      });
      return bytes.byteLength
        ? new Blob([bytes], { type: "image/jpeg" })
        : null;
    }
    const response = await fetch(
      `/api/devices/${encodeURIComponent(device_id)}/panorama`,
    );
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(response.statusText);
    return response.blob();
  },
  ndiSources: () =>
    isTauri()
      ? invoke<NdiSource[]>("ndi_sources")
      : request<NdiSource[]>("ndi/sources"),
  // The latest low-resolution preview JPEG, or null before the first frame.
  ndiPreview: async (device_id: string): Promise<Blob | null> => {
    if (isTauri()) {
      const bytes = await invoke<ArrayBuffer>("ndi_preview", {
        deviceId: device_id,
      });
      return bytes.byteLength
        ? new Blob([bytes], { type: "image/jpeg" })
        : null;
    }
    const response = await fetch(
      `/api/ndi/preview/${encodeURIComponent(device_id)}`,
      { cache: "no-store" },
    );
    if (response.status === 204) return null;
    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: response.statusText }));
      throw new Error(error.error ?? response.statusText);
    }
    return response.blob();
  },
};
