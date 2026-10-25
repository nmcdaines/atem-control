use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use ts_rs::TS;

pub const CONFIG_VERSION: u32 = 1;

/// Transient import credentials, excluded from workspace Config and Debug.
#[derive(Deserialize, TS)]
#[serde(deny_unknown_fields)]
pub struct PostgresImportSettings {
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    pub password: String,
    pub schema: String,
    pub require_tls: bool,
}

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("{0}")]
    Invalid(String),
    #[error("{0}")]
    Device(String),
    #[error("{0}")]
    Storage(String),
    #[error("A macro is running; cancel it before editing or sending another command")]
    Busy,
    #[error("Cancelled")]
    Cancelled,
}
pub type Result<T> = std::result::Result<T, Error>;

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq, TS)]
#[serde(rename_all = "snake_case")]
pub enum DeviceKind {
    Atem,
    Camera,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq, TS)]
#[serde(rename_all = "snake_case")]
pub enum Framing {
    SonyUdp,
    RawUdp,
    RawTcp,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, TS)]
#[serde(tag = "type", rename_all = "snake_case", deny_unknown_fields)]
pub enum Connection {
    Simulation {
        kind: DeviceKind,
    },
    Atem {
        address: String,
    },
    Visca {
        address: String,
        port: u16,
        framing: Framing,
        pan_limit: u16,
        tilt_limit: u16,
        zoom_limit: u16,
    },
    /// A camera driven by NDI® PTZ commands, which give no position readback.
    /// Positions use the default raw scale: pan/tilt ±32767, zoom 0–16384.
    Ndi {
        source: String,
    },
}
impl Connection {
    pub fn kind(&self) -> DeviceKind {
        match self {
            Self::Simulation { kind } => *kind,
            Self::Atem { .. } => DeviceKind::Atem,
            Self::Visca { .. } | Self::Ndi { .. } => DeviceKind::Camera,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, TS)]
#[serde(deny_unknown_fields)]
pub struct Device {
    pub id: String,
    pub name: String,
    pub connection: Connection,
    /// NDI® source name for a camera's preview feed, e.g. "CAMERA (Channel 1)".
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub ndi_source: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, TS)]
#[serde(tag = "type", rename_all = "snake_case", deny_unknown_fields)]
pub enum Command {
    SetProgram {
        input: u16,
    },
    SetPreview {
        input: u16,
    },
    Cut,
    Auto,
    SetInputName {
        input: u16,
        long_name: String,
        short_name: String,
    },
    SetPip {
        enabled: bool,
        source: u16,
        x: f64,
        y: f64,
        size: f64,
    },
    PanTilt {
        pan: i16,
        tilt: i16,
        pan_speed: u8,
        tilt_speed: u8,
    },
    Zoom {
        position: u16,
    },
    Stop,
    Refresh,
}
impl Command {
    pub fn validate(&self, device: &Device) -> Result<()> {
        let camera = matches!(
            self,
            Self::PanTilt { .. } | Self::Zoom { .. } | Self::Stop | Self::Refresh
        );
        if camera != (device.connection.kind() == DeviceKind::Camera) {
            return Err(Error::Invalid(format!(
                "Command does not apply to {}",
                device.name
            )));
        }
        match self {
            Self::SetInputName {
                long_name,
                short_name,
                ..
            } if !long_name.is_ascii()
                || !short_name.is_ascii()
                || long_name.len() > 20
                || short_name.len() > 4
                || long_name.contains('\0')
                || short_name.contains('\0') =>
            {
                return invalid("ATEM labels must be ASCII, without NUL, at most 20/4 characters");
            }
            Self::SetPip { x, y, size, .. }
                if !x.is_finite()
                    || !y.is_finite()
                    || !size.is_finite()
                    || !(-16.0..=16.0).contains(x)
                    || !(-9.0..=9.0).contains(y)
                    || !(0.01..=1.0).contains(size) =>
            {
                return invalid("PiP position or size is out of range");
            }
            Self::PanTilt {
                pan,
                tilt,
                pan_speed,
                tilt_speed,
            } => {
                let (pl, tl) = match device.connection {
                    Connection::Visca {
                        pan_limit,
                        tilt_limit,
                        ..
                    } => (pan_limit, tilt_limit),
                    _ => (32767, 32767),
                };
                if pan.unsigned_abs() > pl
                    || tilt.unsigned_abs() > tl
                    || !(1..=24).contains(pan_speed)
                    || !(1..=20).contains(tilt_speed)
                {
                    return invalid(
                        "Pan/tilt target or speed is outside the configured camera profile",
                    );
                }
            }
            Self::Zoom { position } => {
                let limit = match device.connection {
                    Connection::Visca { zoom_limit, .. } => zoom_limit,
                    _ => 16384,
                };
                if *position > limit {
                    return invalid("Zoom is outside the configured camera profile");
                }
            }
            _ => {}
        }
        Ok(())
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, TS)]
#[serde(deny_unknown_fields)]
pub struct Action {
    pub device_id: String,
    pub command: Command,
    pub delay_ms: u32,
    pub timeout_ms: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, TS)]
#[serde(tag = "type", rename_all = "snake_case", deny_unknown_fields)]
pub enum Step {
    Action { action: Action },
    Wait { duration_ms: u32 },
    Parallel { actions: Vec<Action> },
    LegacyParallel { actions: Vec<Action> },
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, TS)]
#[serde(deny_unknown_fields)]
pub struct Macro {
    pub id: String,
    pub name: String,
    pub description: String,
    pub steps: Vec<Step>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, TS)]
#[serde(deny_unknown_fields)]
pub struct Shortcut {
    pub id: String,
    pub page: u16,
    pub slot: u16,
    pub macro_id: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, TS)]
#[serde(deny_unknown_fields)]
pub struct Config {
    pub version: u32,
    pub devices: Vec<Device>,
    pub macros: Vec<Macro>,
    pub shortcuts: Vec<Shortcut>,
}
impl Default for Config {
    fn default() -> Self {
        Self {
            version: CONFIG_VERSION,
            devices: vec![],
            macros: vec![],
            shortcuts: vec![],
        }
    }
}

fn invalid<T>(message: &str) -> Result<T> {
    Err(Error::Invalid(message.into()))
}
fn check_id(id: &str, ids: &mut HashSet<String>) -> Result<()> {
    if id.trim().is_empty() || id.len() > 128 || !ids.insert(id.to_owned()) {
        return invalid(
            "IDs must be nonempty, unique within their collection, and at most 128 characters",
        );
    }
    Ok(())
}
pub fn validate_action(action: &Action, config: &Config) -> Result<()> {
    if action.delay_ms > 3_600_000 || !(100..=120_000).contains(&action.timeout_ms) {
        return invalid("Action delay must be at most one hour; timeout must be 100–120000 ms");
    }
    let device = config
        .devices
        .iter()
        .find(|d| d.id == action.device_id)
        .ok_or_else(|| Error::Invalid(format!("Unknown device {}", action.device_id)))?;
    action.command.validate(device)
}
impl Config {
    pub fn validate(&self) -> Result<()> {
        if self.version != CONFIG_VERSION {
            return invalid("Unsupported configuration version");
        }
        if self.devices.len() > 64 || self.macros.len() > 1000 || self.shortcuts.len() > 1000 {
            return invalid("Configuration exceeds size limits");
        }
        let mut ids = HashSet::new();
        for device in &self.devices {
            check_id(&device.id, &mut ids)?;
            if device.name.trim().is_empty() || device.name.len() > 100 {
                return invalid("Device name must contain 1–100 characters");
            }
            if let Some(source) = &device.ndi_source
                && (device.connection.kind() != DeviceKind::Camera
                    || source.trim().is_empty()
                    || source.len() > 256
                    || source.contains('\0'))
            {
                return invalid("NDI sources apply to cameras and must contain 1–256 characters");
            }
            if let Connection::Ndi { source } = &device.connection
                && (source.trim().is_empty()
                    || source.len() > 256
                    || source.contains('\0')
                    || device.ndi_source.is_some())
            {
                return invalid(
                    "NDI cameras need a 1–256 character source and use it for their preview",
                );
            }
            match &device.connection {
                Connection::Atem { address } | Connection::Visca { address, .. } => {
                    address
                        .parse::<std::net::IpAddr>()
                        .map_err(|_| Error::Invalid("Use an explicit device IP address".into()))?;
                }
                _ => {}
            }
            if let Connection::Visca {
                port,
                pan_limit,
                tilt_limit,
                zoom_limit,
                ..
            } = device.connection
                && (port == 0
                    || pan_limit == 0
                    || pan_limit > 32767
                    || tilt_limit == 0
                    || tilt_limit > 32767
                    || zoom_limit == 0)
            {
                return invalid(
                    "VISCA profile limits and port must be positive; pan/tilt limits must fit signed 16-bit positions",
                );
            }
        }
        ids.clear();
        for mac in &self.macros {
            check_id(&mac.id, &mut ids)?;
            if mac.name.trim().is_empty()
                || mac.name.len() > 100
                || mac.steps.is_empty()
                || mac.steps.len() > 200
            {
                return invalid("Macro needs a name and 1–200 steps");
            }
            for step in &mac.steps {
                match step {
                    Step::Action { action } => validate_action(action, self)?,
                    Step::Wait { duration_ms } if *duration_ms > 3_600_000 => {
                        return invalid("Wait must be at most one hour");
                    }
                    Step::Wait { .. } => {}
                    Step::Parallel { actions } | Step::LegacyParallel { actions } => {
                        if actions.is_empty() || actions.len() > 64 {
                            return invalid("Parallel group needs 1–64 actions");
                        }
                        let mut targets = HashSet::new();
                        for action in actions {
                            validate_action(action, self)?;
                            if matches!(step, Step::Parallel { .. })
                                && !targets.insert(&action.device_id)
                            {
                                return invalid(
                                    "A parallel group may target each device once; use sequential steps for the same device",
                                );
                            }
                            if matches!(step, Step::LegacyParallel { .. }) && action.delay_ms != 0 {
                                return invalid("Legacy parallel actions must have zero delay");
                            }
                        }
                    }
                }
            }
        }
        let macro_ids = ids;
        let mut shortcut_ids = HashSet::new();
        let mut slots = HashSet::new();
        for shortcut in &self.shortcuts {
            check_id(&shortcut.id, &mut shortcut_ids)?;
            if !macro_ids.contains(&shortcut.macro_id)
                || !slots.insert((shortcut.page, shortcut.slot))
            {
                return invalid("Shortcut references a missing macro or duplicate page/slot");
            }
        }
        Ok(())
    }
}

pub fn demo_config() -> Config {
    Config {
        devices: vec![
            Device {
                id: "demo-atem".into(),
                name: "ATEM Mini · simulator".into(),
                connection: Connection::Simulation {
                    kind: DeviceKind::Atem,
                },
                ndi_source: None,
            },
            Device {
                id: "demo-camera".into(),
                name: "PTZ Camera · simulator".into(),
                connection: Connection::Simulation {
                    kind: DeviceKind::Camera,
                },
                ndi_source: None,
            },
        ],
        macros: vec![Macro {
            id: "demo-shot".into(),
            name: "Camera 1 → program".into(),
            description:
                "Position camera, wait 500 ms, select preview and cut. All devices are simulated."
                    .into(),
            steps: vec![
                Step::Action {
                    action: Action {
                        device_id: "demo-camera".into(),
                        command: Command::PanTilt {
                            pan: 120,
                            tilt: 30,
                            pan_speed: 8,
                            tilt_speed: 8,
                        },
                        delay_ms: 0,
                        timeout_ms: 5000,
                    },
                },
                Step::Wait { duration_ms: 500 },
                Step::Action {
                    action: Action {
                        device_id: "demo-atem".into(),
                        command: Command::SetPreview { input: 1 },
                        delay_ms: 0,
                        timeout_ms: 5000,
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
            ],
        }],
        shortcuts: vec![Shortcut {
            id: "demo-shortcut".into(),
            page: 0,
            slot: 0,
            macro_id: "demo-shot".into(),
        }],
        ..Config::default()
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, TS)]
pub struct Input {
    pub id: u16,
    pub long_name: String,
    pub short_name: String,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, TS)]
pub struct PipState {
    pub enabled: bool,
    pub source: u16,
    pub x: f64,
    pub y: f64,
    pub size: f64,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, TS)]
pub struct SwitcherState {
    pub program: u16,
    pub preview: u16,
    pub inputs: Vec<Input>,
    pub pip: PipState,
}
impl Default for SwitcherState {
    fn default() -> Self {
        Self {
            program: 1,
            preview: 2,
            inputs: (0..=4)
                .map(|id| Input {
                    id,
                    long_name: if id == 0 {
                        "Black".into()
                    } else {
                        format!("Camera {id}")
                    },
                    short_name: format!("{id}"),
                })
                .collect(),
            pip: PipState {
                enabled: false,
                source: 2,
                x: 10.0,
                y: -5.0,
                size: 0.25,
            },
        }
    }
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, TS)]
pub struct CameraState {
    pub pan: i16,
    pub tilt: i16,
    pub zoom: u16,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, TS)]
#[serde(rename_all = "snake_case")]
pub enum ConnectionStatus {
    Connected,
    Disconnected,
    Error,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, TS)]
#[serde(rename_all = "snake_case")]
pub enum Feedback {
    Simulated,
    Observed,
    Commanded,
    Unknown,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, TS)]
pub struct DeviceState {
    pub device_id: String,
    pub status: ConnectionStatus,
    pub feedback: Feedback,
    pub error: Option<String>,
    pub switcher: Option<SwitcherState>,
    pub camera: Option<CameraState>,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, TS)]
#[serde(rename_all = "snake_case")]
pub enum RunStatus {
    Running,
    Completed,
    Cancelled,
    Failed,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, TS)]
pub struct Run {
    pub id: String,
    pub macro_id: String,
    pub name: String,
    pub status: RunStatus,
    pub completed_steps: usize,
    pub total_steps: usize,
    pub error: Option<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize, TS)]
pub struct Snapshot {
    pub config: Config,
    pub devices: Vec<DeviceState>,
    pub runs: Vec<Run>,
    pub ndi: NdiSnapshot,
}
#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, TS)]
pub struct NdiSnapshot {
    /// Whether an NDI runtime library could be loaded.
    pub available: bool,
    pub error: Option<String>,
    /// Receivers currently feeding a preview; idle previews are closed.
    pub previews: Vec<NdiPreview>,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, TS)]
pub struct NdiSource {
    pub name: String,
    /// "ip:port" the sender advertises, when known.
    pub address: Option<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, TS)]
pub struct NdiPreview {
    pub device_id: String,
    pub source: String,
    pub connected: bool,
    /// Reported by the sender a few seconds after connecting; false until then.
    pub ptz_supported: bool,
    pub width: u32,
    pub height: u32,
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_wrong_device_ranges_and_dangling_shortcuts() {
        let mut config = demo_config();
        assert!(config.validate().is_ok());
        assert!(Command::Cut.validate(&config.devices[1]).is_err());
        assert!(
            Command::Zoom { position: 20000 }
                .validate(&config.devices[1])
                .is_err()
        );
        config.shortcuts[0].macro_id = "missing".into();
        assert!(config.validate().is_err());
    }
    #[test]
    fn rejects_parallel_conflicts_but_accepts_explicit_legacy_groups() {
        let mut config = demo_config();
        let Step::Action { action } = config.macros[0].steps[0].clone() else {
            panic!()
        };
        let actions = vec![action.clone(), action];
        config.macros[0].steps = vec![Step::Parallel {
            actions: actions.clone(),
        }];
        assert!(config.validate().is_err());
        config.macros[0].steps = vec![Step::LegacyParallel { actions }];
        assert!(config.validate().is_ok());
    }
}
