pub mod adapter;
pub mod atem;
pub mod ndi;
pub mod visca;
use adapter::{Adapter, Simulated};
use control_core::*;
use control_storage::Store;
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    sync::Arc,
};
use tokio::sync::{Mutex, RwLock, mpsc, oneshot};
use tokio_util::sync::CancellationToken;

type Adapters = HashMap<String, Arc<dyn Adapter>>;
enum StorageRequest {
    Save(Config, oneshot::Sender<Result<()>>),
    Backup(PathBuf, oneshot::Sender<Result<()>>),
}

/// UI-independent application service; the web development server and Tauri use
/// this same implementation. SQLite runs on a dedicated blocking worker.
pub struct Controller {
    config: RwLock<Config>,
    adapters: RwLock<Adapters>,
    storage: mpsc::Sender<StorageRequest>,
    operation: Mutex<()>,
    active: Mutex<Option<(String, CancellationToken)>>,
    runs: Mutex<Vec<Run>>,
    database: PathBuf,
    ndi: Arc<ndi::Ndi>,
}
impl Controller {
    pub async fn open(path: impl AsRef<Path>) -> Result<Arc<Self>> {
        let path = path.as_ref().to_owned();
        let db_path = path.clone();
        let (ready_tx, ready_rx) = oneshot::channel();
        let (storage, mut rx) = mpsc::channel::<StorageRequest>(8);
        tokio::task::spawn_blocking(move || {
            let opened = Store::open(&db_path).and_then(|store| {
                let config = store.load()?;
                Ok((store, config))
            });
            let (mut store, config) = match opened {
                Ok(v) => v,
                Err(e) => {
                    let _ = ready_tx.send(Err(e));
                    return;
                }
            };
            if ready_tx.send(Ok(config)).is_err() {
                return;
            }
            while let Some(request) = rx.blocking_recv() {
                match request {
                    StorageRequest::Save(config, reply) => {
                        let _ = reply.send(store.save(&config));
                    }
                    StorageRequest::Backup(path, reply) => {
                        let _ = reply.send(store.backup(&path));
                    }
                }
            }
        });
        let config = ready_rx
            .await
            .map_err(|e| Error::Storage(e.to_string()))??;
        let adapters = build_adapters(&config);
        Ok(Arc::new(Self {
            config: RwLock::new(config),
            adapters: RwLock::new(adapters),
            storage,
            operation: Mutex::new(()),
            active: Mutex::new(None),
            runs: Mutex::new(vec![]),
            database: path,
            ndi: Arc::default(),
        }))
    }
    pub async fn snapshot(&self) -> Snapshot {
        let config = self.config.read().await.clone();
        let adapters = self.adapters.read().await;
        let mut devices = vec![];
        for device in &config.devices {
            if let Some(adapter) = adapters.get(&device.id) {
                devices.push(adapter.snapshot().await);
            }
        }
        Snapshot {
            config,
            devices,
            runs: self.runs.lock().await.clone(),
            ndi: self.ndi_snapshot(),
        }
    }
    fn ndi_snapshot(&self) -> NdiSnapshot {
        let (available, error) = self.ndi.status();
        NdiSnapshot {
            available,
            error,
            previews: if available {
                self.ndi.previews()
            } else {
                vec![]
            },
        }
    }
    /// NDI sources visible on the network.
    pub async fn ndi_sources(&self) -> Result<Vec<NdiSource>> {
        let ndi = self.ndi.clone();
        tokio::task::spawn_blocking(move || ndi.sources())
            .await
            .map_err(|e| Error::Device(e.to_string()))?
    }
    /// The latest low-resolution JPEG from a camera's NDI source, if a frame
    /// has arrived yet. Reading keeps the preview receiver connected.
    pub async fn ndi_preview(&self, device_id: &str) -> Result<Option<Arc<Vec<u8>>>> {
        let source = {
            let config = self.config.read().await;
            let device = config
                .devices
                .iter()
                .find(|d| d.id == device_id)
                .ok_or_else(|| Error::Invalid("Unknown device".into()))?;
            match &device.connection {
                Connection::Ndi { source } => source.clone(),
                _ => device
                    .ndi_source
                    .clone()
                    .ok_or_else(|| Error::Invalid("Device has no NDI source".into()))?,
            }
        };
        self.ndi.frame(device_id, &source)
    }
    pub async fn save_config(&self, config: Config) -> Result<()> {
        let _operation = self.operation.lock().await;
        if self.active.lock().await.is_some() {
            return Err(Error::Busy);
        }
        config.validate()?;
        let (tx, rx) = oneshot::channel();
        self.storage
            .send(StorageRequest::Save(config.clone(), tx))
            .await
            .map_err(|e| Error::Storage(e.to_string()))?;
        rx.await.map_err(|e| Error::Storage(e.to_string()))??;
        let new_adapters = {
            let old_config = self.config.read().await;
            let old_adapters = self.adapters.read().await;
            let mut next = HashMap::new();
            for device in &config.devices {
                if old_config.devices.iter().any(|d| d == device)
                    && let Some(adapter) = old_adapters.get(&device.id)
                {
                    next.insert(device.id.clone(), adapter.clone());
                    continue;
                }
                next.insert(device.id.clone(), build_adapter(device));
            }
            for (id, adapter) in old_adapters.iter() {
                if !next.get(id).is_some_and(|a| Arc::ptr_eq(a, adapter)) {
                    adapter.close().await?;
                }
            }
            next
        };
        *self.adapters.write().await = new_adapters;
        *self.config.write().await = config;
        Ok(())
    }
    pub async fn import_config(&self, config: Config) -> Result<()> {
        config.validate()?;
        self.backup().await?;
        self.save_config(config).await
    }
    pub async fn backup(&self) -> Result<String> {
        let path = self
            .database
            .with_extension(format!("{}.backup.sqlite3", uuid::Uuid::new_v4()));
        let (tx, rx) = oneshot::channel();
        self.storage
            .send(StorageRequest::Backup(path.clone(), tx))
            .await
            .map_err(|e| Error::Storage(e.to_string()))?;
        rx.await.map_err(|e| Error::Storage(e.to_string()))??;
        Ok(path.to_string_lossy().into())
    }
    pub async fn execute(&self, device_id: &str, command: Command) -> Result<()> {
        if matches!(command, Command::Stop) {
            {
                let config = self.config.read().await;
                let device = config
                    .devices
                    .iter()
                    .find(|d| d.id == device_id)
                    .ok_or_else(|| Error::Invalid("Unknown device".into()))?;
                command.validate(device)?;
            }
            if let Some((_, token)) = self.active.lock().await.as_ref() {
                token.cancel();
            }
            // Stop bypasses the normal command/edit gate and interrupts the
            // camera adapter's current operation before acquiring its session.
            return self.dispatch(device_id, &command).await;
        }
        let _operation = self.operation.lock().await;
        if self.active.lock().await.is_some() {
            return Err(Error::Busy);
        }
        tokio::time::timeout(std::time::Duration::from_secs(30), self.dispatch(device_id, &command)).await.map_err(|_| Error::Device("Command timed out; execution may have occurred. Check device state before retrying.".into()))?
    }
    async fn dispatch(&self, device_id: &str, command: &Command) -> Result<()> {
        let config = self.config.read().await;
        let device = config
            .devices
            .iter()
            .find(|d| d.id == device_id)
            .ok_or_else(|| Error::Invalid("Unknown device".into()))?;
        command.validate(device)?;
        let adapter = self
            .adapters
            .read()
            .await
            .get(device_id)
            .cloned()
            .ok_or_else(|| Error::Device("Device adapter unavailable".into()))?;
        drop(config);
        adapter.execute(command).await
    }
    pub async fn run_macro(self: &Arc<Self>, macro_id: &str) -> Result<String> {
        let _operation = self.operation.lock().await;
        let mut active = self.active.lock().await;
        if active.is_some() {
            return Err(Error::Busy);
        }
        let config = self.config.read().await;
        config.validate()?;
        let mac = config
            .macros
            .iter()
            .find(|m| m.id == macro_id)
            .cloned()
            .ok_or_else(|| Error::Invalid("Unknown macro".into()))?;
        // Preflight every route before any action can execute.
        let snapshot = self.snapshot().await;
        let mut probed = std::collections::HashSet::new();
        for step in &mac.steps {
            let actions = match step {
                Step::Action { action } => std::slice::from_ref(action),
                Step::Parallel { actions } | Step::LegacyParallel { actions } => actions,
                Step::Wait { .. } => &[],
            };
            for action in actions {
                let state = snapshot
                    .devices
                    .iter()
                    .find(|d| d.device_id == action.device_id)
                    .ok_or_else(|| Error::Device("Device missing".into()))?;
                // Establish a camera route using read-only inquiries before
                // any switcher or motion action in the macro can be sent.
                let lazy_visca = config.devices.iter().any(|d| {
                    d.id == action.device_id
                        && matches!(
                            d.connection,
                            Connection::Visca { .. } | Connection::Ndi { .. }
                        )
                });
                if lazy_visca && probed.insert(action.device_id.clone()) {
                    tokio::time::timeout(
                        std::time::Duration::from_secs(6),
                        self.dispatch(&action.device_id, &Command::Refresh),
                    )
                    .await
                    .map_err(|_| {
                        Error::Device(
                            "Camera preflight timed out; no macro actions were sent".into(),
                        )
                    })??;
                }
                if state.status != ConnectionStatus::Connected && !lazy_visca {
                    return Err(Error::Device(
                        state
                            .error
                            .clone()
                            .unwrap_or_else(|| "Device is disconnected".into()),
                    ));
                }
            }
        }
        drop(config);
        let id = uuid::Uuid::new_v4().to_string();
        let token = CancellationToken::new();
        *active = Some((id.clone(), token.clone()));
        let run = Run {
            id: id.clone(),
            macro_id: mac.id.clone(),
            name: mac.name.clone(),
            status: RunStatus::Running,
            completed_steps: 0,
            total_steps: mac.steps.len(),
            error: None,
        };
        {
            let mut runs = self.runs.lock().await;
            runs.insert(0, run);
            runs.truncate(20);
        }
        let controller = self.clone();
        let run_id = id.clone();
        tokio::spawn(async move {
            let result = controller.run_steps(&run_id, &mac.steps, &token).await;
            if result.is_err() {
                controller.stop_cameras(&mac).await;
            }
            let mut active = controller.active.lock().await;
            let mut runs = controller.runs.lock().await;
            if let Some(run) = runs.iter_mut().find(|r| r.id == run_id) {
                match result {
                    Ok(()) => run.status = RunStatus::Completed,
                    Err(Error::Cancelled) => run.status = RunStatus::Cancelled,
                    Err(e) => {
                        run.status = RunStatus::Failed;
                        run.error = Some(e.to_string());
                    }
                }
            }
            *active = None;
        });
        Ok(id)
    }
    pub async fn cancel(&self, run_id: &str) -> Result<()> {
        let active = self.active.lock().await;
        if let Some((id, token)) = active.as_ref()
            && id == run_id
        {
            token.cancel();
            return Ok(());
        }
        Err(Error::Invalid("Run is no longer active".into()))
    }
    async fn action(&self, action: &Action, token: &CancellationToken) -> Result<()> {
        wait(action.delay_ms, token).await?;
        tokio::select! { biased;
            _ = token.cancelled() => Err(Error::Cancelled),
            result = tokio::time::timeout(std::time::Duration::from_millis(action.timeout_ms.into()), self.dispatch(&action.device_id, &action.command)) => result.map_err(|_| Error::Device("Macro step timed out; the command may have executed".into()))?,
        }
    }
    async fn run_steps(
        &self,
        run_id: &str,
        steps: &[Step],
        token: &CancellationToken,
    ) -> Result<()> {
        for step in steps {
            if token.is_cancelled() {
                return Err(Error::Cancelled);
            }
            match step {
                Step::Action { action } => self.action(action, token).await?,
                Step::Wait { duration_ms } => wait(*duration_ms, token).await?,
                Step::Parallel { actions } | Step::LegacyParallel { actions } => {
                    futures::future::try_join_all(actions.iter().map(|a| self.action(a, token)))
                        .await?;
                }
            }
            if let Some(run) = self.runs.lock().await.iter_mut().find(|r| r.id == run_id) {
                run.completed_steps += 1;
            }
        }
        if token.is_cancelled() {
            return Err(Error::Cancelled);
        }
        Ok(())
    }
    async fn stop_cameras(&self, mac: &Macro) {
        let mut ids = std::collections::HashSet::new();
        for step in &mac.steps {
            let actions = match step {
                Step::Action { action } => std::slice::from_ref(action),
                Step::Parallel { actions } | Step::LegacyParallel { actions } => actions,
                Step::Wait { .. } => &[],
            };
            for action in actions {
                if matches!(
                    action.command,
                    Command::PanTilt { .. } | Command::Zoom { .. } | Command::Stop
                ) {
                    ids.insert(action.device_id.clone());
                }
            }
        }
        let adapters = self.adapters.read().await;
        futures::future::join_all(ids.iter().filter_map(|id| adapters.get(id)).map(|adapter| {
            tokio::time::timeout(
                std::time::Duration::from_secs(2),
                adapter.execute(&Command::Stop),
            )
        }))
        .await;
    }
    pub async fn shutdown(&self) {
        if let Some((_, token)) = self.active.lock().await.as_ref() {
            token.cancel();
        }
        for adapter in self.adapters.read().await.values() {
            let _ = tokio::time::timeout(std::time::Duration::from_secs(2), adapter.close()).await;
        }
        self.ndi.close();
    }
}
async fn wait(ms: u32, token: &CancellationToken) -> Result<()> {
    if token.is_cancelled() {
        return Err(Error::Cancelled);
    }
    if ms == 0 {
        return Ok(());
    }
    tokio::select! { biased; _ = token.cancelled() => Err(Error::Cancelled), _ = tokio::time::sleep(std::time::Duration::from_millis(ms.into())) => Ok(()) }
}
fn build_adapters(config: &Config) -> Adapters {
    config
        .devices
        .iter()
        .map(|d| (d.id.clone(), build_adapter(d)))
        .collect()
}
fn build_adapter(device: &Device) -> Arc<dyn Adapter> {
    match &device.connection {
        Connection::Simulation { .. } => Arc::new(Simulated::new(device)),
        Connection::Visca { .. } => Arc::new(visca::Visca::new(device.clone())),
        Connection::Atem { .. } => Arc::new(atem::Atem::new(device)),
        Connection::Ndi { source } => Arc::new(ndi::NdiCamera::new(&device.id, source)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use std::time::Duration;

    struct DelayedAdapter {
        state: DeviceState,
        calls: Mutex<Vec<Command>>,
        started: tokio::sync::Notify,
    }
    #[async_trait]
    impl Adapter for DelayedAdapter {
        async fn execute(&self, command: &Command) -> Result<()> {
            self.calls.lock().await.push(command.clone());
            self.started.notify_one();
            tokio::time::sleep(Duration::from_secs(30)).await;
            Ok(())
        }
        async fn snapshot(&self) -> DeviceState {
            self.state.clone()
        }
    }
    #[tokio::test]
    async fn deadline_failure_prevents_the_following_cut() {
        let temp = tempfile::tempdir().unwrap();
        let app = Controller::open(temp.path().join("deadline.sqlite3"))
            .await
            .unwrap();
        let mut config = demo_config();
        config.macros[0].steps = vec![
            Step::Action {
                action: Action {
                    device_id: "demo-atem".into(),
                    command: Command::SetPreview { input: 2 },
                    delay_ms: 0,
                    timeout_ms: 100,
                },
            },
            Step::Action {
                action: Action {
                    device_id: "demo-atem".into(),
                    command: Command::Cut,
                    delay_ms: 0,
                    timeout_ms: 5000,
                },
            },
        ];
        app.save_config(config).await.unwrap();
        let state = app.snapshot().await.devices[0].clone();
        let slow = Arc::new(DelayedAdapter {
            state,
            calls: Mutex::new(vec![]),
            started: tokio::sync::Notify::new(),
        });
        app.adapters
            .write()
            .await
            .insert("demo-atem".into(), slow.clone());
        tokio::time::pause();
        app.run_macro("demo-shot").await.unwrap();
        slow.started.notified().await;
        tokio::time::advance(Duration::from_millis(101)).await;
        for _ in 0..100 {
            if app.snapshot().await.runs[0].status != RunStatus::Running {
                break;
            }
            tokio::task::yield_now().await;
        }
        let run = &app.snapshot().await.runs[0];
        assert_eq!(run.status, RunStatus::Failed);
        assert!(run.error.as_ref().unwrap().contains("timed out"));
        assert_eq!(
            *slow.calls.lock().await,
            vec![Command::SetPreview { input: 2 }]
        );
    }
}
