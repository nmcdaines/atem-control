use control_core::*;
use control_runtime::Controller;
use std::sync::Arc;
use tauri::{Manager, State};
type App<'a> = State<'a, Arc<Controller>>;

#[tauri::command]
async fn snapshot(app: App<'_>) -> std::result::Result<Snapshot, String> {
    Ok(app.snapshot().await)
}
#[tauri::command]
async fn save_config(app: App<'_>, config: Config) -> std::result::Result<(), String> {
    app.save_config(config).await.map_err(|e| e.to_string())
}
#[tauri::command]
async fn import_config(app: App<'_>, config: Config) -> std::result::Result<(), String> {
    app.import_config(config).await.map_err(|e| e.to_string())
}
#[tauri::command]
async fn execute(
    app: App<'_>,
    device_id: String,
    command: Command,
) -> std::result::Result<(), String> {
    app.execute(&device_id, command)
        .await
        .map_err(|e| e.to_string())
}
#[tauri::command]
async fn run_macro(app: App<'_>, macro_id: String) -> std::result::Result<String, String> {
    app.inner()
        .run_macro(&macro_id)
        .await
        .map_err(|e| e.to_string())
}
#[tauri::command]
async fn cancel_run(app: App<'_>, run_id: String) -> std::result::Result<(), String> {
    app.cancel(&run_id).await.map_err(|e| e.to_string())
}
#[tauri::command]
async fn load_demo(app: App<'_>) -> std::result::Result<(), String> {
    if !app.snapshot().await.config.devices.is_empty() {
        return Err("Load demo only in an empty workspace".into());
    }
    app.save_config(demo_config())
        .await
        .map_err(|e| e.to_string())
}
#[tauri::command]
async fn preview_legacy(
    json: String,
) -> std::result::Result<control_storage::ImportReport, String> {
    control_storage::import_legacy(&json).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .setup(|app| {
            let directory = app.path().app_data_dir()?;
            std::fs::create_dir_all(&directory)?;
            let controller = tauri::async_runtime::block_on(Controller::open(
                directory.join("control.sqlite3"),
            ))?;
            app.manage(controller);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            snapshot,
            save_config,
            import_config,
            execute,
            run_macro,
            cancel_run,
            load_demo,
            preview_legacy,
            preview_postgres,
            ndi_sources,
            ndi_preview,
            device_state,
            calibrate_camera,
            scan_camera,
            panorama
        ])
        .build(tauri::generate_context!())
        .expect("Unable to start ATEM Control");
    app.run(|app, event| {
        if let tauri::RunEvent::Exit = event {
            tauri::async_runtime::block_on(app.state::<Arc<Controller>>().shutdown());
        }
    });
}

#[tauri::command]
async fn ndi_sources(app: App<'_>) -> std::result::Result<Vec<NdiSource>, String> {
    app.ndi_sources().await.map_err(|e| e.to_string())
}
/// Returns the latest preview JPEG as raw bytes; empty until a frame arrives.
#[tauri::command]
async fn ndi_preview(
    app: App<'_>,
    device_id: String,
) -> std::result::Result<tauri::ipc::Response, String> {
    let jpeg = app
        .ndi_preview(&device_id)
        .await
        .map_err(|e| e.to_string())?;
    Ok(tauri::ipc::Response::new(
        jpeg.map(|j| (*j).clone()).unwrap_or_default(),
    ))
}
#[tauri::command]
async fn device_state(app: App<'_>, device_id: String) -> std::result::Result<DeviceState, String> {
    app.device_state(&device_id)
        .await
        .map_err(|e| e.to_string())
}
#[tauri::command]
async fn calibrate_camera(app: App<'_>, device_id: String) -> std::result::Result<String, String> {
    app.inner()
        .calibrate_camera(&device_id)
        .await
        .map_err(|e| e.to_string())
}
#[tauri::command]
async fn scan_camera(app: App<'_>, device_id: String) -> std::result::Result<String, String> {
    app.inner()
        .scan_camera(&device_id)
        .await
        .map_err(|e| e.to_string())
}
/// The stored panorama JPEG as raw bytes; empty when there is none.
#[tauri::command]
async fn panorama(
    app: App<'_>,
    device_id: String,
) -> std::result::Result<tauri::ipc::Response, String> {
    let jpeg = app
        .panorama_jpeg(&device_id)
        .await
        .map_err(|e| e.to_string())?;
    Ok(tauri::ipc::Response::new(jpeg.unwrap_or_default()))
}
#[tauri::command]
async fn preview_postgres(
    settings: PostgresImportSettings,
) -> std::result::Result<control_storage::ImportReport, String> {
    control_storage::postgres::preview(settings)
        .await
        .map_err(|e| e.to_string())
}
