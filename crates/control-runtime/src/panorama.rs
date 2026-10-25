//! Camera calibration and panorama scans for cameras with VISCA position
//! readback and an NDI® source. Both run as cancellable jobs that appear as
//! runs, and both return the camera to where it started.
use crate::{Controller, ndi::Stills};
use control_core::*;
use control_vision::{
    Axis, Extent, Rgb, Tile, estimate_shift, focal_from_rotation, most_detailed,
    rotation_from_focal, stitch, zoom_ratio,
};
use std::{
    sync::Arc,
    time::{Duration, Instant},
};
use tokio_util::sync::CancellationToken;

/// Width frames are reduced to for matching and stitching. The camera's
/// low-bandwidth NDI stream (640×360 on the P100) is used, because the full
/// stream stalls on lossy Wi-Fi and a control map needs little detail.
const FRAME_WIDTH: usize = 640;
/// BirdDog P100: ±2266 pan units span ±175°.
const DEFAULT_PAN_UNITS_PER_DEGREE: f32 = 2266.0 / 175.0;
/// Pause after a pan/tilt move before a frame is taken.
const SETTLE: Duration = Duration::from_millis(400);
/// Pause after a zoom change, which also refocuses.
const ZOOM_SETTLE: Duration = Duration::from_millis(1500);
/// Fraction of a frame that neighbouring scan tiles overlap.
const OVERLAP: f32 = 0.3;
/// Pan/tilt speed for calibration and scan moves.
const SPEED: u8 = 20;
/// Size caps for the stitched image; within a browser canvas's limits.
const PANORAMA_MAX_WIDTH: f32 = 9000.0;
const PANORAMA_MAX_HEIGHT: f32 = 4096.0;

struct Camera {
    device: Device,
    range: PtzRange,
    zoom_limit: u16,
    source: String,
}

impl Controller {
    /// Measures how camera units map to the picture at several zooms and
    /// saves the result in the device's configuration.
    pub async fn calibrate_camera(self: &Arc<Self>, device_id: &str) -> Result<String> {
        let camera = self.hybrid_camera(device_id).await?;
        let zooms: Vec<u16> = (0..=8u16)
            .map(|i| i * 2048)
            .filter(|z| *z <= camera.zoom_limit)
            .collect();
        let name = format!("Calibrating {}", camera.device.name);
        self.start_job(
            name,
            zooms.len() + 1,
            move |controller, run_id, token| async move {
                let calibration = controller
                    .calibrate(&camera, &zooms, &run_id, &token)
                    .await?;
                let mut config = controller.config.read().await.clone();
                if let Some(device) = config.devices.iter_mut().find(|d| d.id == camera.device.id) {
                    device.calibration = Some(calibration);
                }
                controller.save_config_unchecked(config).await
            },
        )
        .await
    }

    /// Sweeps the camera across its range, stitches the frames into a
    /// panorama and stores it. A detailed scan zooms in for a sharper image.
    pub async fn scan_camera(
        self: &Arc<Self>,
        device_id: &str,
        detail: ScanDetail,
    ) -> Result<String> {
        let camera = self.hybrid_camera(device_id).await?;
        let calibration = camera.device.calibration.clone().ok_or_else(|| {
            Error::Invalid("Calibrate the camera before scanning a panorama".into())
        })?;
        let zoom = scan_zoom(&calibration, detail, camera.zoom_limit);
        // The grid depends on the camera's real limits, which may first need
        // finding, so the step count is an estimate until the scan starts.
        let estimate = scan_grid(
            &physical_range(&camera.range, &calibration),
            &calibration,
            zoom,
        )
        .len();
        let name = format!("Scanning {}", camera.device.name);
        self.start_job(
            name,
            estimate + 2,
            move |controller, run_id, token| async move {
                let (info, jpeg, reach) = controller
                    .scan(&camera, &calibration, zoom, &run_id, &token)
                    .await?;
                controller.store_panorama(info, jpeg).await?;
                if reach != camera.range {
                    // Record the limits the camera actually stopped at.
                    let mut config = controller.config.read().await.clone();
                    if let Some(device) =
                        config.devices.iter_mut().find(|d| d.id == camera.device.id)
                    {
                        device.ptz_range = Some(reach);
                    }
                    controller.save_config_unchecked(config).await?;
                }
                Ok(())
            },
        )
        .await
    }

    pub async fn panorama_jpeg(&self, device_id: &str) -> Result<Option<Vec<u8>>> {
        let (tx, rx) = tokio::sync::oneshot::channel();
        self.storage
            .send(crate::StorageRequest::PanoramaJpeg(
                device_id.to_owned(),
                tx,
            ))
            .await
            .map_err(|e| Error::Storage(e.to_string()))?;
        rx.await.map_err(|e| Error::Storage(e.to_string()))?
    }

    async fn store_panorama(&self, info: PanoramaInfo, jpeg: Vec<u8>) -> Result<()> {
        let (tx, rx) = tokio::sync::oneshot::channel();
        self.storage
            .send(crate::StorageRequest::SavePanorama(info.clone(), jpeg, tx))
            .await
            .map_err(|e| Error::Storage(e.to_string()))?;
        rx.await.map_err(|e| Error::Storage(e.to_string()))??;
        let mut panoramas = self.panoramas.write().await;
        panoramas.retain(|p| p.device_id != info.device_id);
        panoramas.push(info);
        Ok(())
    }

    /// Refuses jobs that would swing a camera around while it is on air.
    async fn require_off_air(&self, device_id: &str) -> Result<()> {
        let Some((name, input)) = self
            .config
            .read()
            .await
            .devices
            .iter()
            .find(|d| d.id == device_id)
            .and_then(|d| Some((d.name.clone(), d.atem_input?)))
        else {
            return Ok(());
        };
        let snapshot = self.snapshot().await;
        let on_air = snapshot
            .devices
            .iter()
            .filter_map(|d| d.switcher.as_ref())
            .any(|switcher| switcher.program == input);
        if on_air {
            return Err(Error::Invalid(format!(
                "{name} is on air (switcher input {input}); cut to another input before moving it"
            )));
        }
        Ok(())
    }

    async fn hybrid_camera(&self, device_id: &str) -> Result<Camera> {
        self.require_off_air(device_id).await?;
        let config = self.config.read().await;
        let device = config
            .devices
            .iter()
            .find(|d| d.id == device_id)
            .ok_or_else(|| Error::Invalid("Unknown device".into()))?
            .clone();
        let Connection::Visca {
            pan_limit,
            tilt_limit,
            zoom_limit,
            ..
        } = device.connection
        else {
            return Err(Error::Invalid(
                "Panoramas need a VISCA camera, which reports its position".into(),
            ));
        };
        let source = device.ndi_source.clone().ok_or_else(|| {
            Error::Invalid("Set the camera's NDI preview source to capture frames".into())
        })?;
        if !self.ndi.status().0 {
            return Err(Error::Device("NDI runtime not found".into()));
        }
        let (pan, tilt) = (pan_limit as i16, tilt_limit as i16);
        let range = device.ptz_range.unwrap_or(PtzRange {
            pan_min: -pan,
            pan_max: pan,
            tilt_min: -tilt,
            tilt_max: tilt,
        });
        Ok(Camera {
            device,
            range,
            zoom_limit,
            source,
        })
    }

    async fn calibrate(
        &self,
        camera: &Camera,
        zooms: &[u16],
        run_id: &str,
        token: &CancellationToken,
    ) -> Result<CameraCalibration> {
        let stills = self.ndi.stills(&camera.source, FRAME_WIDTH)?;
        let start = self.observe(&camera.device.id).await?;
        let result = async {
            let pan_units = camera
                .device
                .calibration
                .as_ref()
                .map_or(DEFAULT_PAN_UNITS_PER_DEGREE, |c| c.pan_units_per_degree);
            let too_plain = || {
                Error::Device(
                    "The picture was too plain to measure. Point the camera at a detailed scene and retry"
                        .into(),
                )
            };
            // 1. At the widest zoom: focal length and direction from a pan,
            //    tilt scale and direction from a tilt.
            self.camera_move(camera, Command::Zoom { position: zooms[0] }, token)
                .await?;
            let base = self
                .camera_move(camera, pan_tilt(start.pan, start.tilt), token)
                .await?;
            let a = self.capture(&stills, ZOOM_SETTLE, token).await?;
            // Aim for the picture to shift by about an eighth of its width,
            // guessing a 60° view until measured.
            let guess = a.width as f32 / 2.0 / 30f32.to_radians().tan();
            let degrees = (a.width as f32 / 8.0 / guess).atan().to_degrees();
            let pan_step = units_step(degrees * pan_units, base.pan, camera.range.pan_min, camera.range.pan_max);
            let moved = self
                .camera_move(camera, pan_tilt(base.pan + pan_step, base.tilt), token)
                .await?;
            let b = self.capture(&stills, SETTLE, token).await?;
            let angle = ((f32::from(moved.pan) - f32::from(base.pan)) / pan_units).to_radians();
            let (wide_focal, shift) = focal_from_rotation(&a.gray(), &b.gray(), angle, Axis::Pan)
                .filter(|(_, s)| s.score > 0.6 && s.dx.abs() > 4.0)
                .ok_or_else(too_plain)?;
            // Content moving left means the view turned right.
            let pan_direction = if shift.dx * angle < 0.0 { 1 } else { -1 };
            let tilt_step = units_step(degrees * pan_units, base.tilt, camera.range.tilt_min, camera.range.tilt_max);
            let raised = self
                .camera_move(camera, pan_tilt(base.pan, base.tilt + tilt_step), token)
                .await?;
            let c = self.capture(&stills, SETTLE, token).await?;
            let (turned, shift) = rotation_from_focal(&a.gray(), &c.gray(), wide_focal, Axis::Tilt)
                .filter(|(_, s)| s.score > 0.6 && s.dy.abs() > 4.0)
                .ok_or_else(too_plain)?;
            let raised_by = f32::from(raised.tilt) - f32::from(base.tilt);
            let tilt_units = raised_by.abs() / turned.to_degrees();
            // Content moving down means the view tilted up.
            let tilt_direction = if shift.dy * raised_by > 0.0 { 1 } else { -1 };
            self.progress(run_id, 1).await;

            // 2. Zoom in step by step at the most detailed spot, measuring
            //    each level's magnification and centre drift against the last
            //    good one. A fully zoomed-in view is about a tenth as wide.
            let (x, y) = most_detailed(&a.gray(), a.width / 10, a.height / 10);
            let right = ((x - a.width as f32 / 2.0) / wide_focal).atan().to_degrees();
            let up = ((a.height as f32 / 2.0 - y) / wide_focal).atan().to_degrees();
            let clamp = |v: f32, min: i16, max: i16| v.round().clamp(min.into(), max.into()) as i16;
            let aim = (
                clamp(
                    f32::from(base.pan) + right * pan_units * f32::from(pan_direction),
                    camera.range.pan_min,
                    camera.range.pan_max,
                ),
                clamp(
                    f32::from(base.tilt) + up * tilt_units * f32::from(tilt_direction),
                    camera.range.tilt_min,
                    camera.range.tilt_max,
                ),
            );
            self.camera_move(camera, pan_tilt(aim.0, aim.1), token).await?;
            let mut previous = self.capture(&stills, SETTLE, token).await?;
            // Magnification and centre (zoom-0 pixels) of the last good level.
            let (mut magnification, mut centre) = (1.0f32, (0.0f32, 0.0f32));
            let mut samples = vec![FocalSample {
                zoom: zooms[0],
                focal_px: wide_focal,
                centre_x: 0.0,
                centre_y: 0.0,
            }];
            for (index, zoom) in zooms.iter().enumerate().skip(1) {
                self.camera_move(camera, Command::Zoom { position: *zoom }, token)
                    .await?;
                let frame = self.capture(&stills, ZOOM_SETTLE, token).await?;
                // Allow for skipped (too plain) levels in between.
                let Some(step) = zoom_ratio(&previous.gray(), &frame.gray(), 1.02, 4.0)
                    .filter(|s| s.score > 0.6)
                else {
                    self.progress(run_id, index + 1).await;
                    continue;
                };
                // The step's centre is in the previous level's pixels, which
                // are `magnification` times larger than zoom-0 pixels.
                centre = (
                    centre.0 + step.centre.0 / magnification,
                    centre.1 + step.centre.1 / magnification,
                );
                magnification *= step.ratio;
                samples.push(FocalSample {
                    zoom: *zoom,
                    focal_px: wide_focal * magnification,
                    centre_x: centre.0,
                    centre_y: centre.1,
                });
                previous = frame;
                self.progress(run_id, index + 1).await;
            }
            if samples.len() < 2 {
                return Err(Error::Device(
                    "Too few zoom levels could be measured. Point the camera at a detailed scene and retry".into(),
                ));
            }
            Ok(CameraCalibration {
                pan_units_per_degree: pan_units,
                tilt_units_per_degree: tilt_units,
                pan_direction,
                tilt_direction,
                frame_width: a.width as u32,
                frame_height: a.height as u32,
                focal: samples,
            })
        }
        .await;
        drop(stills);
        self.restore(camera, &start).await?;
        result
    }

    async fn scan(
        &self,
        camera: &Camera,
        calibration: &CameraCalibration,
        zoom: u16,
        run_id: &str,
        token: &CancellationToken,
    ) -> Result<(PanoramaInfo, Vec<u8>, PtzRange)> {
        let stills = self.ndi.stills(&camera.source, FRAME_WIDTH)?;
        let start = self.observe(&camera.device.id).await?;
        let mut grid = vec![];
        let result = async {
            self.camera_move(camera, Command::Zoom { position: zoom }, token)
                .await?;
            let known = if camera.device.ptz_range.is_some() {
                camera.range
            } else {
                self.find_limits(camera, calibration, &start, token).await?
            };
            grid = scan_grid(&known, calibration, zoom);
            self.set_total(run_id, grid.len() + 2).await;
            let mut tiles = vec![];
            // The configured range can exceed what the camera allows (this
            // P100's tilt stops near ±30°, not +90°). Moves that stop short
            // reveal the real limits, and grid points beyond them are skipped.
            let mut reach = known;
            let mut captured: Vec<(i16, i16)> = vec![];
            let (view_pan, view_tilt) = calibration.view_units(zoom);
            for (index, (pan, tilt)) in grid.iter().enumerate() {
                let target = (
                    (*pan).clamp(reach.pan_min, reach.pan_max),
                    (*tilt).clamp(reach.tilt_min, reach.tilt_max),
                );
                let duplicate = captured.iter().any(|(p, t)| {
                    (f32::from(*p) - f32::from(target.0)).abs() < view_pan / 4.0
                        && (f32::from(*t) - f32::from(target.1)).abs() < view_tilt / 4.0
                });
                if duplicate {
                    self.progress(run_id, index + 1).await;
                    continue;
                }
                let at = self
                    .camera_move(camera, pan_tilt(target.0, target.1), token)
                    .await?;
                discover_limit(&mut reach.pan_min, &mut reach.pan_max, target.0, at.pan);
                discover_limit(&mut reach.tilt_min, &mut reach.tilt_max, target.1, at.tilt);
                captured.push((at.pan, at.tilt));
                let settle = if index == 0 { ZOOM_SETTLE } else { SETTLE };
                let image = self.capture(&stills, settle, token).await?;
                // Frames are scaled to the calibrated width, so focal lengths apply.
                let focal_px = calibration.focal_at(at.zoom) * image.width as f32
                    / calibration.frame_width as f32;
                // Zoomed in, the picture centre drifts from the reported position.
                let (shift_pan, shift_tilt) = calibration.centre_offset(at.zoom);
                let (yaw, pitch) = view_angles(
                    calibration,
                    f32::from(at.pan) + shift_pan,
                    f32::from(at.tilt) + shift_tilt,
                );
                tiles.push(Tile {
                    image,
                    yaw,
                    pitch,
                    focal_px,
                });
                self.progress(run_id, index + 1).await;
            }
            Ok((tiles, reach))
        }
        .await;
        drop(stills);
        self.restore(camera, &start).await?;
        let (tiles, reach) = result?;
        self.progress(run_id, grid.len() + 1).await;
        let (extent, pixels_per_degree) = panorama_extent(calibration, &tiles, zoom);
        let tile_count = tiles.len() as u32;
        let image = tokio::task::spawn_blocking(move || stitch(&tiles, extent, pixels_per_degree))
            .await
            .map_err(|e| Error::Device(e.to_string()))?;
        let jpeg = image.jpeg(80).map_err(Error::Device)?;
        let (pan_left, tilt_top) = units_at(calibration, extent.left, extent.top);
        let (pan_right, tilt_bottom) = units_at(calibration, extent.right, extent.bottom);
        let info = PanoramaInfo {
            device_id: camera.device.id.clone(),
            width: image.width as u32,
            height: image.height as u32,
            pan_left,
            pan_right,
            tilt_top,
            tilt_bottom,
            tiles: tile_count,
            created_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map_or(0, |d| d.as_secs()),
        };
        self.progress(run_id, grid.len() + 2).await;
        Ok((info, jpeg, reach))
    }

    /// Moves and returns the read-back position, honouring cancellation.
    async fn camera_move(
        &self,
        camera: &Camera,
        command: Command,
        token: &CancellationToken,
    ) -> Result<CameraState> {
        tokio::select! { biased;
            _ = token.cancelled() => return Err(Error::Cancelled),
            result = self.absolute(&camera.device.id, &command) => result?,
        }
        self.observed(&camera.device.id).await
    }

    /// Sends an absolute move or inquiry, retrying after a lost reply. Unlike a
    /// relative move, repeating an absolute target cannot overshoot, and long
    /// jobs send enough packets that one loss on Wi-Fi is likely.
    async fn absolute(&self, device_id: &str, command: &Command) -> Result<()> {
        let mut attempt = 0;
        loop {
            match self.dispatch(device_id, command).await {
                Err(Error::Device(_)) if attempt < 2 => attempt += 1,
                result => return result,
            }
        }
    }

    /// A frame taken once the picture has stopped changing. A fixed delay is
    /// not enough: over a VPN frames arrive late, so a frame received after the
    /// move can still show motion, refocusing or exposure changes.
    async fn capture(
        &self,
        stills: &Stills,
        settle: Duration,
        token: &CancellationToken,
    ) -> Result<Rgb> {
        let mut previous = self.frame(stills, settle, token).await?;
        for _ in 0..8 {
            let next = self
                .frame(stills, Duration::from_millis(150), token)
                .await?;
            let steady = estimate_shift(&previous.gray(), &next.gray(), 16, 16)
                .is_some_and(|s| s.score > 0.9 && s.dx.abs() < 0.7 && s.dy.abs() < 0.7);
            if steady {
                return Ok(next);
            }
            previous = next;
        }
        // Noisy low-light pictures may never look identical; use the latest.
        Ok(previous)
    }

    async fn frame(
        &self,
        stills: &Stills,
        after: Duration,
        token: &CancellationToken,
    ) -> Result<Rgb> {
        tokio::select! { biased;
            _ = token.cancelled() => Err(Error::Cancelled),
            frame = stills.capture_after(Instant::now() + after, after + Duration::from_secs(5)) => frame,
        }
    }

    async fn observe(&self, device_id: &str) -> Result<CameraState> {
        self.absolute(device_id, &Command::Refresh).await?;
        self.observed(device_id).await
    }

    async fn observed(&self, device_id: &str) -> Result<CameraState> {
        let adapter = self
            .adapters
            .read()
            .await
            .get(device_id)
            .cloned()
            .ok_or_else(|| Error::Device("Device adapter unavailable".into()))?;
        adapter
            .snapshot()
            .await
            .camera
            .ok_or_else(|| Error::Device("Camera position unknown".into()))
    }

    /// Returns to `start` even after a cancel or failure, then checks it.
    async fn restore(&self, camera: &Camera, start: &CameraState) -> Result<()> {
        let id = &camera.device.id;
        self.absolute(
            id,
            &Command::Zoom {
                position: start.zoom,
            },
        )
        .await?;
        self.absolute(id, &pan_tilt(start.pan, start.tilt)).await?;
        let mut end = self.observed(id).await?;
        // The P100 stops a unit short (towards zero), so repeated jobs would
        // creep. Aim past the target by the miss, once.
        if (end.pan, end.tilt) != (start.pan, start.tilt) {
            let overshoot = |target: i16, landed: i16| {
                (2 * i32::from(target) - i32::from(landed)).clamp(-32767, 32767) as i16
            };
            self.absolute(
                id,
                &pan_tilt(
                    overshoot(start.pan, end.pan),
                    overshoot(start.tilt, end.tilt),
                ),
            )
            .await?;
            end = self.observed(id).await?;
        }
        // Tilt can land one unit away from its target on the P100.
        if (i32::from(end.pan) - i32::from(start.pan)).abs() > 2
            || (i32::from(end.tilt) - i32::from(start.tilt)).abs() > 2
            || end.zoom.abs_diff(start.zoom) > 16
        {
            return Err(Error::Device(format!(
                "Camera did not return to its start position: expected {}/{}/{}, read {}/{}/{}",
                start.pan, start.tilt, start.zoom, end.pan, end.tilt, end.zoom
            )));
        }
        Ok(())
    }

    /// Finds where the camera actually stops at each end of its range by
    /// moving there, starting from the profile limits capped to what any
    /// camera can do (±180° pan, ±90° tilt).
    async fn find_limits(
        &self,
        camera: &Camera,
        calibration: &CameraCalibration,
        start: &CameraState,
        token: &CancellationToken,
    ) -> Result<PtzRange> {
        let mut range = physical_range(&camera.range, calibration);
        for (pan, tilt) in [
            (range.pan_max, start.tilt),
            (range.pan_min, start.tilt),
            (start.pan, range.tilt_max),
            (start.pan, range.tilt_min),
        ] {
            let at = self.camera_move(camera, pan_tilt(pan, tilt), token).await?;
            discover_limit(&mut range.pan_min, &mut range.pan_max, pan, at.pan);
            discover_limit(&mut range.tilt_min, &mut range.tilt_max, tilt, at.tilt);
        }
        Ok(range)
    }

    async fn set_total(&self, run_id: &str, total: usize) {
        if let Some(run) = self.runs.lock().await.iter_mut().find(|r| r.id == run_id) {
            run.total_steps = total;
        }
    }

    async fn progress(&self, run_id: &str, completed: usize) {
        if let Some(run) = self.runs.lock().await.iter_mut().find(|r| r.id == run_id) {
            run.completed_steps = completed.min(run.total_steps);
        }
    }
}

fn pan_tilt(pan: i16, tilt: i16) -> Command {
    Command::PanTilt {
        pan,
        tilt,
        pan_speed: SPEED,
        tilt_speed: SPEED,
    }
}

/// A move of about `units` from `from` that stays inside `min..=max`.
fn units_step(units: f32, from: i16, min: i16, max: i16) -> i16 {
    let step = units.round().clamp(2.0, 600.0) as i16;
    if from.saturating_add(step) <= max || from.saturating_sub(step) < min {
        step
    } else {
        -step
    }
}

/// Degrees right/up of centre for a raw position.
fn view_angles(calibration: &CameraCalibration, pan: f32, tilt: f32) -> (f32, f32) {
    (
        pan / calibration.pan_units_per_degree * f32::from(calibration.pan_direction),
        tilt / calibration.tilt_units_per_degree * f32::from(calibration.tilt_direction),
    )
}

/// Raw position for view angles; the inverse of [`view_angles`].
fn units_at(calibration: &CameraCalibration, yaw: f32, pitch: f32) -> (f32, f32) {
    (
        yaw * calibration.pan_units_per_degree * f32::from(calibration.pan_direction),
        pitch * calibration.tilt_units_per_degree * f32::from(calibration.tilt_direction),
    )
}

/// Camera centre positions covering the whole range at `zoom`, in a
/// back-and-forth order that keeps moves short.
fn scan_grid(range: &PtzRange, calibration: &CameraCalibration, zoom: u16) -> Vec<(i16, i16)> {
    let (view_pan, view_tilt) = calibration.view_units(zoom);
    let axis = |min: i16, max: i16, view: f32| {
        // In f32: the default ±32767 range spans more than i16 can hold.
        let span = f32::from(max) - f32::from(min);
        let step = view * (1.0 - OVERLAP);
        let count = (span / step).ceil().max(0.0) as usize + 1;
        (0..count)
            .map(|i| {
                let t = if count == 1 {
                    0.5
                } else {
                    i as f32 / (count - 1) as f32
                };
                (f32::from(min) + span * t).round() as i16
            })
            .collect::<Vec<_>>()
    };
    let pans = axis(range.pan_min, range.pan_max, view_pan);
    let tilts = axis(range.tilt_min, range.tilt_max, view_tilt);
    let mut grid = vec![];
    for (row, tilt) in tilts.iter().rev().enumerate() {
        let mut line: Vec<_> = pans.iter().map(|pan| (*pan, *tilt)).collect();
        if row % 2 == 1 {
            line.reverse();
        }
        grid.extend(line);
    }
    grid
}

/// `range` capped to what any camera can turn (±180° pan, ±90° tilt); the
/// default profile allows ±32767 units, about ±2500° on a P100.
fn physical_range(range: &PtzRange, calibration: &CameraCalibration) -> PtzRange {
    let cap = |units_per_degree: f32, degrees: f32| {
        (units_per_degree * degrees).round().min(32767.0) as i16
    };
    let pan = cap(calibration.pan_units_per_degree, 180.0);
    let tilt = cap(calibration.tilt_units_per_degree, 90.0);
    PtzRange {
        pan_min: range.pan_min.max(-pan),
        pan_max: range.pan_max.min(pan),
        tilt_min: range.tilt_min.max(-tilt),
        tilt_max: range.tilt_max.min(tilt),
    }
}

/// Narrows `min..=max` when a move to `target` stopped well short at `landed`.
fn discover_limit(min: &mut i16, max: &mut i16, target: i16, landed: i16) {
    // Moves normally land within a unit or two of their target.
    const SHORT: i16 = 16;
    if landed < target.saturating_sub(SHORT) {
        *max = landed;
    } else if landed > target.saturating_add(SHORT) {
        *min = landed;
    }
}

/// The zoom a scan uses: the widest for a fast scan, or about twice the
/// magnification for a detailed one (the smallest zoom reaching it).
fn scan_zoom(calibration: &CameraCalibration, detail: ScanDetail, zoom_limit: u16) -> u16 {
    if detail == ScanDetail::Fast {
        return 0;
    }
    let goal = calibration.focal_at(0) * 2.0;
    let (mut low, mut high) = (0u16, zoom_limit);
    while low < high {
        let middle = low + (high - low) / 2;
        if calibration.focal_at(middle) >= goal {
            high = middle;
        } else {
            low = middle + 1;
        }
    }
    low
}

/// The angular area the captured tiles cover (their centres plus half a
/// frame on each side) and its resolution, capped to a manageable image size.
fn panorama_extent(calibration: &CameraCalibration, tiles: &[Tile], zoom: u16) -> (Extent, f32) {
    let (view_pan, view_tilt) = calibration.view_units(zoom);
    let half_yaw = view_pan / calibration.pan_units_per_degree / 2.0;
    let half_pitch = view_tilt / calibration.tilt_units_per_degree / 2.0;
    let bound = |f: fn(&Tile) -> f32, pick: fn(f32, f32) -> f32, start: f32| {
        tiles.iter().map(f).fold(start, pick)
    };
    let extent = Extent {
        left: bound(|t| t.yaw, f32::min, f32::MAX) - half_yaw,
        right: bound(|t| t.yaw, f32::max, f32::MIN) + half_yaw,
        top: (bound(|t| t.pitch, f32::max, f32::MIN) + half_pitch).min(90.0),
        bottom: (bound(|t| t.pitch, f32::min, f32::MAX) - half_pitch).max(-90.0),
    };
    // The frames' own resolution, so a detailed scan yields a sharper image.
    let native = calibration.focal_at(zoom) * std::f32::consts::PI / 180.0;
    let pixels_per_degree = native
        .min(PANORAMA_MAX_WIDTH / (extent.right - extent.left))
        .min(PANORAMA_MAX_HEIGHT / (extent.top - extent.bottom));
    (extent, pixels_per_degree)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn p100() -> (Camera, CameraCalibration) {
        let device = Device {
            id: "p100".into(),
            name: "P100".into(),
            connection: Connection::Visca {
                address: "192.168.1.28".into(),
                port: 52381,
                framing: Framing::SonyUdp,
                pan_limit: 2266,
                tilt_limit: 1181,
                zoom_limit: 16384,
            },
            ndi_source: Some("CAM".into()),
            ptz_range: None,
            calibration: None,
            soft_limits: None,
            soft_polygon: None,
            atem_input: None,
        };
        let camera = Camera {
            device,
            range: PtzRange {
                pan_min: -2266,
                pan_max: 2266,
                tilt_min: -394,
                tilt_max: 1181,
            },
            zoom_limit: 16384,
            source: "CAM".into(),
        };
        let calibration = CameraCalibration {
            pan_units_per_degree: 12.95,
            tilt_units_per_degree: 13.1,
            pan_direction: 1,
            tilt_direction: 1,
            frame_width: 960,
            frame_height: 540,
            // About a 60° horizontal field of view at the widest zoom.
            focal: vec![
                FocalSample {
                    zoom: 0,
                    focal_px: 831.0,
                    centre_x: 0.0,
                    centre_y: 0.0,
                },
                FocalSample {
                    zoom: 16384,
                    focal_px: 8310.0,
                    centre_x: 0.0,
                    centre_y: 0.0,
                },
            ],
        };
        (camera, calibration)
    }

    #[test]
    fn scan_grid_overlaps_neighbouring_frames_and_snakes() {
        let (camera, calibration) = p100();
        let grid = scan_grid(&camera.range, &calibration, 0);
        let (view_pan, view_tilt) = calibration.view_units(0);
        let pans: Vec<_> = grid
            .iter()
            .filter(|g| g.1 == grid[0].1)
            .map(|g| g.0)
            .collect();
        assert_eq!(pans.first(), Some(&-2266));
        assert_eq!(pans.last(), Some(&2266));
        for pair in pans.windows(2) {
            assert!(f32::from(pair[1] - pair[0]) <= view_pan * (1.0 - OVERLAP) + 1.0);
        }
        // The second row runs back the other way.
        let second: Vec<_> = grid.iter().filter(|g| g.1 != grid[0].1).take(2).collect();
        assert!(second[0].0 > second[1].0);
        let tilts: std::collections::BTreeSet<_> = grid.iter().map(|g| g.1).collect();
        let tilts: Vec<_> = tilts.into_iter().collect();
        for pair in tilts.windows(2) {
            assert!(f32::from(pair[1] - pair[0]) <= view_tilt * (1.0 - OVERLAP) + 1.0);
        }
        assert!(grid.len() < 80, "{} tiles", grid.len());
    }

    #[test]
    fn detailed_scans_zoom_to_twice_the_magnification() {
        let (camera, calibration) = p100();
        assert_eq!(scan_zoom(&calibration, ScanDetail::Fast, 16384), 0);
        let zoom = scan_zoom(&calibration, ScanDetail::Detailed, 16384);
        let magnification = calibration.focal_at(zoom) / calibration.focal_at(0);
        assert!(
            (magnification - 2.0).abs() < 0.01,
            "{zoom}: {magnification}"
        );
        // About four times the frames of a fast scan.
        let fast = scan_grid(&camera.range, &calibration, 0).len();
        let detailed = scan_grid(&camera.range, &calibration, zoom).len();
        assert!(
            detailed > fast * 3 && detailed < fast * 5,
            "{fast} → {detailed}"
        );
    }

    #[test]
    fn panorama_extent_covers_captured_tiles_plus_half_a_frame() {
        let (_, calibration) = p100();
        let tile = |yaw, pitch| Tile {
            image: Rgb::new(1, 1),
            yaw,
            pitch,
            focal_px: 556.0,
        };
        let tiles = [tile(-175.0, -30.0), tile(175.0, 29.0)];
        let (extent, pixels_per_degree) = panorama_extent(&calibration, &tiles, 0);
        // Half the ~60°×36° wide view beyond the outermost tiles.
        assert!((extent.left + 205.0).abs() < 1.0 && (extent.right - 205.0).abs() < 1.0);
        assert!((extent.top - 47.0).abs() < 1.0 && (extent.bottom + 48.0).abs() < 1.0);
        assert!((extent.right - extent.left) * pixels_per_degree <= PANORAMA_MAX_WIDTH + 1.0);
        let (pan, tilt) = units_at(&calibration, extent.left, extent.top);
        let (yaw, pitch) = view_angles(&calibration, pan, tilt);
        assert!((yaw - extent.left).abs() < 1e-3 && (pitch - extent.top).abs() < 1e-3);
    }

    #[test]
    fn moves_that_stop_short_reveal_limits() {
        let (mut min, mut max) = (-394, 1181);
        discover_limit(&mut min, &mut max, 1181, 372);
        assert_eq!((min, max), (-394, 372));
        discover_limit(&mut min, &mut max, -394, -393);
        assert_eq!((min, max), (-394, 372));
        discover_limit(&mut min, &mut max, -394, -200);
        assert_eq!((min, max), (-200, 372));
    }

    #[tokio::test]
    async fn panoramas_survive_a_restart() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("control.sqlite3");
        let info = PanoramaInfo {
            device_id: "demo-camera".into(),
            width: 2,
            height: 1,
            pan_left: -10.0,
            pan_right: 10.0,
            tilt_top: 5.0,
            tilt_bottom: -5.0,
            tiles: 1,
            created_at: 42,
        };
        {
            let app = Controller::open(&path).await.unwrap();
            app.store_panorama(info.clone(), vec![0xff, 0xd8, 1])
                .await
                .unwrap();
            app.shutdown().await;
        }
        let app = Controller::open(&path).await.unwrap();
        assert_eq!(app.snapshot().await.panoramas, vec![info]);
        assert_eq!(
            app.panorama_jpeg("demo-camera").await.unwrap(),
            Some(vec![0xff, 0xd8, 1])
        );
    }

    #[test]
    fn default_profile_limits_do_not_overflow() {
        // The default VISCA profile is ±32767, which spans more than i16 holds.
        let (_, calibration) = p100();
        let huge = PtzRange {
            pan_min: -32767,
            pan_max: 32767,
            tilt_min: -32767,
            tilt_max: 32767,
        };
        let capped = physical_range(&huge, &calibration);
        assert_eq!((capped.pan_max, capped.tilt_min), (2331, -1179));
        assert!(scan_grid(&capped, &calibration, 0).len() < 100);
        assert!(!scan_grid(&huge, &calibration, 0).is_empty());
        let (mut min, mut max) = (-32767, 32767);
        discover_limit(&mut min, &mut max, 32767, 2216);
        discover_limit(&mut min, &mut max, -32767, -2216);
        assert_eq!((min, max), (-2216, 2216));
    }

    #[test]
    fn calibration_steps_stay_inside_the_range() {
        assert_eq!(units_step(40.0, 0, -100, 100), 40);
        assert_eq!(units_step(40.0, 90, -100, 100), -40);
        assert_eq!(units_step(0.2, 0, -100, 100), 2);
    }
}
