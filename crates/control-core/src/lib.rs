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
    /// Usable pan/tilt range in raw units, e.g. the P100's -394…1181 tilt.
    /// Defaults to the profile's symmetric limits.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub ptz_range: Option<PtzRange>,
    /// Measured optics, required for panoramas and visible-frame soft limits.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub calibration: Option<CameraCalibration>,
    /// Region (raw units) that the camera's visible frame must stay inside.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub soft_limits: Option<PtzRange>,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, TS)]
#[serde(deny_unknown_fields)]
pub struct PtzRange {
    pub pan_min: i16,
    pub pan_max: i16,
    pub tilt_min: i16,
    pub tilt_max: i16,
}
impl PtzRange {
    fn valid(&self) -> bool {
        self.pan_min < self.pan_max && self.tilt_min < self.tilt_max
    }
}

/// How camera units relate to the image, measured by panning/tilting a known
/// amount and finding how far the picture shifts.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, TS)]
#[serde(deny_unknown_fields)]
pub struct CameraCalibration {
    /// Raw pan units per degree. Not measurable from images alone, so it comes
    /// from the camera model (BirdDog P100: 2266 / 175° ≈ 12.95).
    pub pan_units_per_degree: f32,
    /// Raw tilt units per degree, measured relative to pan.
    pub tilt_units_per_degree: f32,
    /// 1 if increasing pan moves the view right, -1 if left.
    pub pan_direction: i8,
    /// 1 if increasing tilt moves the view up, -1 if down.
    pub tilt_direction: i8,
    /// Frame size the focal lengths refer to.
    pub frame_width: u32,
    pub frame_height: u32,
    /// Focal length in pixels at sampled zoom positions, ascending by zoom.
    pub focal: Vec<FocalSample>,
}
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, TS)]
#[serde(deny_unknown_fields)]
pub struct FocalSample {
    pub zoom: u16,
    pub focal_px: f32,
}
impl CameraCalibration {
    /// Focal length at `zoom`, interpolating between samples.
    pub fn focal_at(&self, zoom: u16) -> f32 {
        let samples = &self.focal;
        let Some(first) = samples.first() else {
            return f32::NAN;
        };
        if zoom <= first.zoom {
            return first.focal_px;
        }
        for pair in samples.windows(2) {
            let (a, b) = (pair[0], pair[1]);
            if zoom <= b.zoom {
                // Focal length grows roughly geometrically with zoom position.
                let t = f32::from(zoom - a.zoom) / f32::from(b.zoom - a.zoom).max(1.0);
                return a.focal_px * (b.focal_px / a.focal_px).powf(t);
            }
        }
        samples.last().unwrap().focal_px
    }
    /// Visible frame width and height in raw pan/tilt units at `zoom`.
    pub fn view_units(&self, zoom: u16) -> (f32, f32) {
        let focal = self.focal_at(zoom);
        let width = 2.0 * (self.frame_width as f32 / 2.0 / focal).atan().to_degrees();
        let height = 2.0 * (self.frame_height as f32 / 2.0 / focal).atan().to_degrees();
        (
            width * self.pan_units_per_degree,
            height * self.tilt_units_per_degree,
        )
    }
    fn valid(&self) -> bool {
        let finite = |v: f32| v.is_finite() && v > 0.0;
        finite(self.pan_units_per_degree)
            && finite(self.tilt_units_per_degree)
            && matches!(self.pan_direction, -1 | 1)
            && matches!(self.tilt_direction, -1 | 1)
            && self.frame_width > 0
            && self.frame_height > 0
            && !self.focal.is_empty()
            && self.focal.len() <= 64
            && self.focal.iter().all(|s| finite(s.focal_px))
            && self.focal.windows(2).all(|w| w[0].zoom < w[1].zoom)
    }
}

impl Device {
    /// Rejects a pan/tilt or zoom command whose visible frame would leave the
    /// soft limits, given the camera's current position. Without calibration
    /// only the frame centre is checked. An unknown current zoom is treated as
    /// the widest, which is the largest frame.
    pub fn check_soft_limits(
        &self,
        command: &Command,
        current: Option<&CameraState>,
    ) -> Result<()> {
        let Some(limits) = self.soft_limits else {
            return Ok(());
        };
        let (pan, tilt, zoom) = match (command, current) {
            (Command::PanTilt { pan, tilt, .. }, current) => {
                (*pan, *tilt, current.map_or(0, |c| c.zoom))
            }
            (Command::Zoom { position }, Some(current)) => (current.pan, current.tilt, *position),
            (Command::Zoom { .. }, None) => {
                return invalid("Read the camera position before zooming within soft limits");
            }
            _ => return Ok(()),
        };
        let (half_pan, half_tilt) = self.calibration.as_ref().map_or((0.0, 0.0), |c| {
            let (w, h) = c.view_units(zoom);
            (w / 2.0, h / 2.0)
        });
        let inside = |centre: i16, half: f32, min: i16, max: i16| {
            f32::from(centre) - half >= f32::from(min) - 0.5
                && f32::from(centre) + half <= f32::from(max) + 0.5
        };
        if inside(pan, half_pan, limits.pan_min, limits.pan_max)
            && inside(tilt, half_tilt, limits.tilt_min, limits.tilt_max)
        {
            Ok(())
        } else {
            invalid("That shot would show outside the camera's soft limits")
        }
    }
}

/// A stored panorama: an equirectangular image whose x axis runs left to
/// right across the view and y axis top to bottom, spanning these raw units.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, TS)]
pub struct PanoramaInfo {
    pub device_id: String,
    pub width: u32,
    pub height: u32,
    /// Pan at the image's left and right edges (left may be numerically larger).
    pub pan_left: f32,
    pub pan_right: f32,
    /// Tilt at the image's top and bottom edges.
    pub tilt_top: f32,
    pub tilt_bottom: f32,
    pub tiles: u32,
    /// Unix seconds. JSON numbers hold these exactly, so TypeScript sees `number`.
    #[ts(type = "number")]
    pub created_at: u64,
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
            if device.ptz_range.is_some_and(|r| !r.valid())
                || device.soft_limits.is_some_and(|r| !r.valid())
                || device.calibration.as_ref().is_some_and(|c| !c.valid())
                || ((device.ptz_range.is_some()
                    || device.calibration.is_some()
                    || device.soft_limits.is_some())
                    && device.connection.kind() != DeviceKind::Camera)
            {
                return invalid(
                    "Camera range, calibration and soft limits must be valid and apply to cameras only",
                );
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
                ptz_range: None,
                calibration: None,
                soft_limits: None,
            },
            Device {
                id: "demo-camera".into(),
                name: "PTZ Camera · simulator".into(),
                connection: Connection::Simulation {
                    kind: DeviceKind::Camera,
                },
                ndi_source: None,
                ptz_range: None,
                calibration: None,
                soft_limits: None,
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
    pub panoramas: Vec<PanoramaInfo>,
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
    fn soft_limits_keep_the_visible_frame_inside_the_region() {
        let mut device = demo_config().devices.remove(1);
        device.soft_limits = Some(PtzRange {
            pan_min: -1000,
            pan_max: 1000,
            tilt_min: -300,
            tilt_max: 300,
        });
        device.calibration = Some(CameraCalibration {
            pan_units_per_degree: 10.0,
            tilt_units_per_degree: 10.0,
            pan_direction: 1,
            tilt_direction: 1,
            frame_width: 640,
            frame_height: 360,
            // 640 px at 320 px focal length: 90° wide and about 59° tall.
            focal: vec![
                FocalSample {
                    zoom: 0,
                    focal_px: 320.0,
                },
                FocalSample {
                    zoom: 16384,
                    focal_px: 3200.0,
                },
            ],
        });
        let at = |pan, tilt, zoom| CameraState { pan, tilt, zoom };
        let pan_tilt = |pan, tilt| Command::PanTilt {
            pan,
            tilt,
            pan_speed: 8,
            tilt_speed: 8,
        };
        // Wide (900 × ~590 units): the centre must stay well inside.
        assert!(
            device
                .check_soft_limits(&pan_tilt(0, 0), Some(&at(0, 0, 0)))
                .is_ok()
        );
        assert!(
            device
                .check_soft_limits(&pan_tilt(600, 0), Some(&at(0, 0, 0)))
                .is_err()
        );
        // Zoomed in, the same centre fits.
        assert!(
            device
                .check_soft_limits(&pan_tilt(600, 0), Some(&at(0, 0, 16384)))
                .is_ok()
        );
        // Zooming out there would show too much.
        let zoom_out = Command::Zoom { position: 0 };
        assert!(
            device
                .check_soft_limits(&zoom_out, Some(&at(600, 0, 16384)))
                .is_err()
        );
        assert!(device.check_soft_limits(&zoom_out, None).is_err());
        // Unknown zoom is treated as widest.
        assert!(device.check_soft_limits(&pan_tilt(600, 0), None).is_err());
        assert!(device.check_soft_limits(&Command::Stop, None).is_ok());
    }
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
