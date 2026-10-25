//! Loopback-only development host for the same Rust services used by Tauri.
use axum::{
    Json, Router,
    extract::{DefaultBodyLimit, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
};
use control_core::*;
use control_runtime::Controller;
use serde::Deserialize;
use std::{path::PathBuf, sync::Arc};

struct ApiError(Error);
impl From<Error> for ApiError {
    fn from(error: Error) -> Self {
        Self(error)
    }
}
impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let code = match &self.0 {
            Error::Busy => StatusCode::CONFLICT,
            Error::Invalid(_) => StatusCode::BAD_REQUEST,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        };
        (
            code,
            Json(serde_json::json!({ "error": self.0.to_string() })),
        )
            .into_response()
    }
}
type App = State<Arc<Controller>>;
async fn snapshot(State(app): App) -> Json<Snapshot> {
    Json(app.snapshot().await)
}
async fn save(
    State(app): App,
    Json(config): Json<Config>,
) -> std::result::Result<Json<Snapshot>, ApiError> {
    app.save_config(config).await?;
    Ok(Json(app.snapshot().await))
}
async fn import(
    State(app): App,
    Json(config): Json<Config>,
) -> std::result::Result<Json<Snapshot>, ApiError> {
    app.import_config(config).await?;
    Ok(Json(app.snapshot().await))
}
#[derive(Deserialize)]
struct Execute {
    device_id: String,
    command: Command,
}
async fn execute(
    State(app): App,
    Json(request): Json<Execute>,
) -> std::result::Result<Json<Snapshot>, ApiError> {
    app.execute(&request.device_id, request.command).await?;
    Ok(Json(app.snapshot().await))
}
#[derive(Deserialize)]
struct RunRequest {
    macro_id: String,
}
async fn run(
    State(app): App,
    Json(request): Json<RunRequest>,
) -> std::result::Result<Json<String>, ApiError> {
    Ok(Json(app.run_macro(&request.macro_id).await?))
}
#[derive(Deserialize)]
struct Cancel {
    run_id: String,
}
async fn cancel(
    State(app): App,
    Json(request): Json<Cancel>,
) -> std::result::Result<Json<()>, ApiError> {
    app.cancel(&request.run_id).await?;
    Ok(Json(()))
}
async fn demo(State(app): App) -> std::result::Result<Json<Snapshot>, ApiError> {
    if !app.snapshot().await.config.devices.is_empty() {
        return Err(Error::Invalid(
            "Load demo only in an empty workspace; export your existing configuration first".into(),
        )
        .into());
    }
    app.save_config(demo_config()).await?;
    Ok(Json(app.snapshot().await))
}
#[derive(Deserialize)]
struct Legacy {
    json: String,
}
async fn legacy(
    Json(request): Json<Legacy>,
) -> std::result::Result<Json<control_storage::ImportReport>, ApiError> {
    Ok(Json(control_storage::import_legacy(&request.json)?))
}

async fn postgres(
    Json(settings): Json<PostgresImportSettings>,
) -> std::result::Result<Json<control_storage::ImportReport>, ApiError> {
    Ok(Json(control_storage::postgres::preview(settings).await?))
}

#[tokio::main]
async fn main() -> std::result::Result<(), Box<dyn std::error::Error>> {
    let mut database = PathBuf::from(".local/control.sqlite3");
    let mut port = 3847u16;
    let mut demo_mode = false;
    let mut args = std::env::args().skip(1);
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--database" => database = args.next().ok_or("--database requires a path")?.into(),
            "--port" => port = args.next().ok_or("--port requires a number")?.parse()?,
            "--demo" => demo_mode = true,
            _ => return Err(format!("Unknown argument: {arg}. Usage: control-server [--database PATH] [--port PORT] [--demo]").into()),
        }
    }
    if let Some(parent) = database.parent().filter(|p| !p.as_os_str().is_empty()) {
        std::fs::create_dir_all(parent)?;
    }
    let controller = Controller::open(database).await?;
    if demo_mode && controller.snapshot().await.config.devices.is_empty() {
        controller.save_config(demo_config()).await?;
    }
    let router = Router::new()
        .route("/api/snapshot", get(snapshot))
        .route("/api/config", post(save))
        .route("/api/import", post(import))
        .route("/api/execute", post(execute))
        .route("/api/run", post(run))
        .route("/api/cancel", post(cancel))
        .route("/api/demo", post(demo))
        .route("/api/legacy", post(legacy))
        .route("/api/postgres", post(postgres))
        .layer(DefaultBodyLimit::max(2 * 1024 * 1024))
        .with_state(controller.clone());
    let listener = tokio::net::TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, port)).await?;
    eprintln!("Control development API: http://127.0.0.1:{port} (loopback only)");
    axum::serve(listener, router)
        .with_graceful_shutdown(shutdown_signal())
        .await?;
    controller.shutdown().await;
    Ok(())
}

async fn shutdown_signal() {
    #[cfg(unix)]
    {
        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(mut terminate) => {
                tokio::select! { _ = tokio::signal::ctrl_c() => {}, _ = terminate.recv() => {} }
            }
            Err(_) => {
                let _ = tokio::signal::ctrl_c().await;
            }
        }
    }
    #[cfg(not(unix))]
    {
        let _ = tokio::signal::ctrl_c().await;
    }
}
