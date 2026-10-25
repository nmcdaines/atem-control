use control_core::*;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Deserialize)]
struct LegacyConfig {
    devices: Vec<LegacyDevice>,
    macros: Vec<LegacyMacro>,
    shortcuts: Vec<LegacyShortcut>,
}
#[derive(Deserialize)]
struct LegacyDevice {
    id: String,
    name: String,
    #[serde(rename = "ipAddress")]
    address: String,
    #[serde(rename = "type")]
    kind: String,
}
#[derive(Deserialize)]
struct LegacyMacro {
    id: String,
    name: String,
    description: Option<String>,
    device: String,
    steps: Vec<LegacyStep>,
}
#[derive(Deserialize)]
struct LegacyStep {
    device: Option<String>,
    command: String,
    properties: Value,
    #[serde(default)]
    delay: u32,
    #[serde(default)]
    order: u32,
}
#[derive(Deserialize)]
struct LegacyShortcut {
    id: String,
    page: u16,
    slot: u16,
    command: String,
    value: String,
}
#[derive(Serialize)]
pub struct ImportReport {
    pub config: Config,
    pub warnings: Vec<String>,
}

fn field<T: serde::de::DeserializeOwned>(props: &Value, name: &str) -> Result<T> {
    serde_json::from_value(
        props
            .get(name)
            .cloned()
            .ok_or_else(|| Error::Invalid(format!("Missing legacy property {name}")))?,
    )
    .map_err(|e| Error::Invalid(format!("Invalid legacy property {name}: {e}")))
}
fn command(step: &LegacyStep) -> Result<Vec<Command>> {
    let p = &step.properties;
    Ok(match step.command.as_str() {
        "SET_PROGRAM" => vec![Command::SetProgram {
            input: field(p, "input")?,
        }],
        "SET_PREVIEW" => vec![Command::SetPreview {
            input: field(p, "input")?,
        }],
        "TRANSITION_CUT" | "TRANSITION_AUTO" => {
            // Legacy actions implement optional preview selection before the transition.
            // Such compound actions cannot be flattened into a concurrent group safely.
            if p.get("input").is_some_and(|v| !v.is_null() && v != 0) {
                return Err(Error::Invalid("Legacy transition with an input requires manual conversion to a sequential preview + transition macro".into()));
            }
            vec![if step.command == "TRANSITION_CUT" {
                Command::Cut
            } else {
                Command::Auto
            }]
        }
        "SET_INPUT_NAME" => vec![Command::SetInputName {
            input: field(p, "input")?,
            long_name: field(p, "longName")?,
            short_name: field(p, "shortName")?,
        }],
        "VISCA_SET_PAN_TILT" => vec![Command::PanTilt {
            pan: field(p, "pan")?,
            tilt: field(p, "tilt")?,
            pan_speed: field(p, "panSpeed")?,
            tilt_speed: field(p, "tiltSpeed")?,
        }],
        "VISCA_SET_ZOOM" => vec![Command::Zoom {
            position: field(p, "zoom")?,
        }],
        other => {
            return Err(Error::Invalid(format!(
                "Legacy command {other} needs manual conversion; no changes imported"
            )));
        }
    })
}

pub fn import_legacy(json: &str) -> Result<ImportReport> {
    let legacy: LegacyConfig =
        serde_json::from_str(json).map_err(|e| Error::Invalid(e.to_string()))?;
    let mut warnings = vec!["Legacy steps remain concurrent: stored order and delay are intentionally ignored, matching the previous runner. Device transports may serialize commands to respect protocol limits.".into()];
    let devices = legacy.devices.into_iter().map(|d| {
        let connection = match d.kind.as_str() {
            "atem" => Connection::Atem { address: d.address },
            "birddog" => {
                warnings.push(format!("{}: review VISCA framing, port and raw coordinate limits before use. Sony UDP/52381 is a proposed profile, not verified hardware support.", d.name));
                Connection::Visca { address: d.address, port: 52381, framing: Framing::SonyUdp, pan_limit: 32767, tilt_limit: 32767, zoom_limit: 16384 }
            }
            other => return Err(Error::Invalid(format!("Unknown legacy device type {other}"))),
        };
        Ok(Device { id: d.id, name: d.name, connection })
    }).collect::<Result<Vec<_>>>()?;
    let macros = legacy
        .macros
        .into_iter()
        .map(|mac| {
            let mut actions = vec![];
            for step in mac.steps {
                let _ = (step.delay, step.order);
                for cmd in command(&step)? {
                    actions.push(Action {
                        device_id: step
                            .device
                            .clone()
                            .filter(|s| !s.is_empty())
                            .unwrap_or_else(|| mac.device.clone()),
                        command: cmd,
                        delay_ms: 0,
                        timeout_ms: 10000,
                    });
                }
            }
            Ok(Macro {
                id: mac.id,
                name: mac.name,
                description: mac.description.unwrap_or_default(),
                steps: vec![Step::LegacyParallel { actions }],
            })
        })
        .collect::<Result<Vec<_>>>()?;
    let shortcuts = legacy
        .shortcuts
        .into_iter()
        .map(|s| {
            if s.command != "MACRO" && s.command != "RECALL_MACRO" {
                return Err(Error::Invalid(format!(
                    "Shortcut command {} requires manual conversion",
                    s.command
                )));
            }
            Ok(Shortcut {
                id: s.id,
                page: s.page,
                slot: s.slot,
                macro_id: s.value,
            })
        })
        .collect::<Result<Vec<_>>>()?;
    let config = Config {
        devices,
        macros,
        shortcuts,
        ..Config::default()
    };
    config.validate()?;
    Ok(ImportReport { config, warnings })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn preserves_ids_targets_and_legacy_concurrency() {
        let report = import_legacy(r#"{"devices":[{"id":"a","name":"Switcher","ipAddress":"192.168.1.2","type":"atem"}],"macros":[{"id":"m","name":"Take","description":null,"device":"a","steps":[{"command":"SET_PREVIEW","properties":{"input":2},"delay":500,"order":9},{"command":"TRANSITION_CUT","properties":{},"delay":0,"order":0}]}],"shortcuts":[{"id":"s","page":2,"slot":3,"command":"MACRO","value":"m"}]}"#).unwrap();
        let Step::LegacyParallel { actions } = &report.config.macros[0].steps[0] else {
            panic!()
        };
        assert_eq!(actions[0].device_id, "a");
        assert_eq!(actions[0].delay_ms, 0);
        assert_eq!(report.config.shortcuts[0].macro_id, "m");
        assert!(!report.warnings.is_empty());
    }
}
