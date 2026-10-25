use async_trait::async_trait;
use control_core::*;

#[async_trait]
pub trait Adapter: Send + Sync {
    async fn execute(&self, command: &Command) -> Result<()>;
    async fn snapshot(&self) -> DeviceState;
    async fn close(&self) -> Result<()> {
        Ok(())
    }
}

pub struct Simulated {
    state: tokio::sync::Mutex<DeviceState>,
}
impl Simulated {
    pub fn new(device: &Device) -> Self {
        Self {
            state: tokio::sync::Mutex::new(DeviceState {
                device_id: device.id.clone(),
                status: ConnectionStatus::Connected,
                feedback: Feedback::Simulated,
                error: None,
                switcher: (device.connection.kind() == DeviceKind::Atem)
                    .then(SwitcherState::default),
                camera: (device.connection.kind() == DeviceKind::Camera).then_some(CameraState {
                    pan: 0,
                    tilt: 0,
                    zoom: 0,
                }),
            }),
        }
    }
}
#[async_trait]
impl Adapter for Simulated {
    async fn execute(&self, command: &Command) -> Result<()> {
        let mut state = self.state.lock().await;
        match command {
            Command::SetProgram { input } => state.switcher.as_mut().unwrap().program = *input,
            Command::SetPreview { input } => state.switcher.as_mut().unwrap().preview = *input,
            Command::Cut | Command::Auto => {
                let s = state.switcher.as_mut().unwrap();
                std::mem::swap(&mut s.program, &mut s.preview);
            }
            Command::SetInputName {
                input,
                long_name,
                short_name,
            } => {
                let s = state.switcher.as_mut().unwrap();
                if let Some(i) = s.inputs.iter_mut().find(|i| i.id == *input) {
                    i.long_name = long_name.clone();
                    i.short_name = short_name.clone();
                } else {
                    s.inputs.push(Input {
                        id: *input,
                        long_name: long_name.clone(),
                        short_name: short_name.clone(),
                    });
                }
            }
            Command::SetPip {
                enabled,
                source,
                x,
                y,
                size,
            } => {
                state.switcher.as_mut().unwrap().pip = PipState {
                    enabled: *enabled,
                    source: *source,
                    x: *x,
                    y: *y,
                    size: *size,
                }
            }
            Command::PanTilt { pan, tilt, .. } => {
                let c = state.camera.as_mut().unwrap();
                c.pan = *pan;
                c.tilt = *tilt;
            }
            Command::Zoom { position } => state.camera.as_mut().unwrap().zoom = *position,
            Command::Stop | Command::Refresh => {}
        }
        Ok(())
    }
    async fn snapshot(&self) -> DeviceState {
        self.state.lock().await.clone()
    }
}

/// Unimplemented transports fail explicitly; they never fall back to a simulator.
pub struct Unavailable {
    pub device: Device,
    pub reason: String,
}
#[async_trait]
impl Adapter for Unavailable {
    async fn execute(&self, _: &Command) -> Result<()> {
        Err(Error::Device(self.reason.clone()))
    }
    async fn snapshot(&self) -> DeviceState {
        DeviceState {
            device_id: self.device.id.clone(),
            status: ConnectionStatus::Disconnected,
            feedback: Feedback::Unknown,
            error: Some(self.reason.clone()),
            camera: None,
            switcher: None,
        }
    }
}
