import { invoke, isTauri } from "@tauri-apps/api/core";
import type {
  Command,
  Config,
  NdiSource,
  PostgresImportSettings,
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
