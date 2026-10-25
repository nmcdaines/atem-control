//! Optional NDI® support: source discovery, a low-resolution camera preview,
//! and cameras controlled by NDI PTZ commands.
//!
//! The NDI runtime is loaded when first needed rather than linked, so a machine
//! without NDI still starts normally and builds need no NDI SDK. Only the small
//! part of the C API used here is declared. Receivers request the sender's
//! reduced-bandwidth stream, and each preview closes after it stops being read.
//!
//! NDI® is a registered trademark of Vizrt NDI AB.
use crate::adapter::Adapter;
use async_trait::async_trait;
use control_core::{
    CameraState, Command, ConnectionStatus, DeviceState, Error, Feedback, NdiPreview, NdiSource,
    Result,
};
use control_vision::Rgb;
use libloading::Library;
use std::{
    collections::HashMap,
    ffi::{CStr, CString},
    path::PathBuf,
    sync::{
        Arc, Mutex, OnceLock,
        atomic::{AtomicBool, Ordering},
    },
    time::{Duration, Instant},
};

/// Longest edge of encoded preview frames.
const PREVIEW_WIDTH: usize = 480;
const PREVIEW_INTERVAL: Duration = Duration::from_millis(100);
/// A preview nobody has read for this long disconnects from the camera.
const PREVIEW_IDLE: Duration = Duration::from_secs(10);

mod ffi {
    use std::ffi::{c_char, c_void};

    #[repr(C)]
    pub struct Source {
        pub ndi_name: *const c_char,
        pub url_address: *const c_char,
    }
    #[repr(C)]
    pub struct FindCreate {
        pub show_local_sources: bool,
        pub groups: *const c_char,
        pub extra_ips: *const c_char,
    }
    #[repr(C)]
    pub struct RecvCreateV3 {
        pub source: Source,
        pub color_format: i32,
        pub bandwidth: i32,
        pub allow_video_fields: bool,
        pub recv_name: *const c_char,
    }
    #[repr(C)]
    pub struct VideoFrameV2 {
        pub xres: i32,
        pub yres: i32,
        pub fourcc: u32,
        pub frame_rate_n: i32,
        pub frame_rate_d: i32,
        pub picture_aspect_ratio: f32,
        pub frame_format_type: i32,
        pub timecode: i64,
        pub data: *mut u8,
        pub line_stride_in_bytes: i32,
        pub metadata: *const c_char,
        pub timestamp: i64,
    }
    pub const COLOR_RGBX_RGBA: i32 = 2;
    pub const BANDWIDTH_LOWEST: i32 = 0;
    pub const BANDWIDTH_METADATA_ONLY: i32 = -10;
    pub const FRAME_VIDEO: i32 = 1;
    pub const FRAME_ERROR: i32 = 4;
    pub const FOURCC_RGBA: u32 = u32::from_le_bytes(*b"RGBA");
    pub const FOURCC_RGBX: u32 = u32::from_le_bytes(*b"RGBX");

    pub type Initialize = unsafe extern "C" fn() -> bool;
    pub type FindCreateV2 = unsafe extern "C" fn(*const FindCreate) -> *mut c_void;
    pub type FindDestroy = unsafe extern "C" fn(*mut c_void);
    pub type FindWait = unsafe extern "C" fn(*mut c_void, u32) -> bool;
    pub type FindSources = unsafe extern "C" fn(*mut c_void, *mut u32) -> *const Source;
    pub type RecvCreateV3Fn = unsafe extern "C" fn(*const RecvCreateV3) -> *mut c_void;
    pub type RecvDestroy = unsafe extern "C" fn(*mut c_void);
    pub type RecvCapture =
        unsafe extern "C" fn(*mut c_void, *mut VideoFrameV2, *mut c_void, *mut c_void, u32) -> i32;
    pub type RecvFreeVideo = unsafe extern "C" fn(*mut c_void, *const VideoFrameV2);
    pub type RecvBool = unsafe extern "C" fn(*mut c_void) -> bool;
    pub type RecvConnections = unsafe extern "C" fn(*mut c_void) -> i32;
    pub type RecvPair = unsafe extern "C" fn(*mut c_void, f32, f32) -> bool;
    pub type RecvValue = unsafe extern "C" fn(*mut c_void, f32) -> bool;
}

struct Api {
    _library: Library,
    find_create: ffi::FindCreateV2,
    find_destroy: ffi::FindDestroy,
    find_wait: ffi::FindWait,
    find_sources: ffi::FindSources,
    recv_create: ffi::RecvCreateV3Fn,
    recv_destroy: ffi::RecvDestroy,
    recv_capture: ffi::RecvCapture,
    recv_free_video: ffi::RecvFreeVideo,
    recv_ptz_supported: ffi::RecvBool,
    recv_connections: ffi::RecvConnections,
    ptz_pan_tilt: ffi::RecvPair,
    ptz_pan_tilt_speed: ffi::RecvPair,
    ptz_zoom: ffi::RecvValue,
    ptz_zoom_speed: ffi::RecvValue,
}

fn candidates() -> Vec<PathBuf> {
    let mut paths = vec![];
    // An explicit library file, e.g. for development against an NDI Tools runtime.
    if let Some(file) = std::env::var_os("NDI_LIBRARY") {
        paths.push(PathBuf::from(file));
    }
    let name = if cfg!(target_os = "windows") {
        "Processing.NDI.Lib.x64.dll"
    } else if cfg!(target_os = "macos") {
        "libndi.dylib"
    } else {
        "libndi.so.6"
    };
    // The NDI runtime installers publish their directory in these variables.
    for var in ["NDI_RUNTIME_DIR_V6", "NDI_RUNTIME_DIR_V5"] {
        if let Some(dir) = std::env::var_os(var) {
            paths.push(PathBuf::from(dir).join(name));
        }
    }
    // A runtime bundled next to, or in the macOS app bundle with, the executable.
    if let Some(dir) = std::env::current_exe()
        .ok()
        .and_then(|e| e.parent().map(PathBuf::from))
    {
        paths.push(dir.join(name));
        paths.push(dir.join("../Frameworks").join(name));
    }
    if cfg!(target_os = "macos") {
        paths.push("/Library/NDI SDK for Apple/lib/macOS/libndi.dylib".into());
        paths.push("/usr/local/lib/libndi.dylib".into());
    } else if !cfg!(target_os = "windows") {
        paths.push("libndi.so.6".into());
        paths.push("libndi.so.5".into());
    }
    paths
}

fn load() -> std::result::Result<Api, String> {
    let mut tried = vec![];
    for path in candidates() {
        // SAFETY: loading runs the library's initializers; these paths name
        // NDI runtimes chosen by the user or installed by the NDI installers.
        let library = match unsafe { Library::new(&path) } {
            Ok(library) => library,
            Err(_) => {
                tried.push(path.display().to_string());
                continue;
            }
        };
        // SAFETY: each symbol is declared with its documented C signature.
        let api = unsafe {
            let initialize = *library
                .get::<ffi::Initialize>(b"NDIlib_initialize\0")
                .map_err(|e| e.to_string())?;
            if !initialize() {
                return Err("NDI runtime refused to initialize on this CPU".into());
            }
            Api {
                find_create: *library
                    .get(b"NDIlib_find_create_v2\0")
                    .map_err(|e| e.to_string())?,
                find_destroy: *library
                    .get(b"NDIlib_find_destroy\0")
                    .map_err(|e| e.to_string())?,
                find_wait: *library
                    .get(b"NDIlib_find_wait_for_sources\0")
                    .map_err(|e| e.to_string())?,
                find_sources: *library
                    .get(b"NDIlib_find_get_current_sources\0")
                    .map_err(|e| e.to_string())?,
                recv_create: *library
                    .get(b"NDIlib_recv_create_v3\0")
                    .map_err(|e| e.to_string())?,
                recv_destroy: *library
                    .get(b"NDIlib_recv_destroy\0")
                    .map_err(|e| e.to_string())?,
                recv_capture: *library
                    .get(b"NDIlib_recv_capture_v2\0")
                    .map_err(|e| e.to_string())?,
                recv_free_video: *library
                    .get(b"NDIlib_recv_free_video_v2\0")
                    .map_err(|e| e.to_string())?,
                recv_ptz_supported: *library
                    .get(b"NDIlib_recv_ptz_is_supported\0")
                    .map_err(|e| e.to_string())?,
                recv_connections: *library
                    .get(b"NDIlib_recv_get_no_connections\0")
                    .map_err(|e| e.to_string())?,
                ptz_pan_tilt: *library
                    .get(b"NDIlib_recv_ptz_pan_tilt\0")
                    .map_err(|e| e.to_string())?,
                ptz_pan_tilt_speed: *library
                    .get(b"NDIlib_recv_ptz_pan_tilt_speed\0")
                    .map_err(|e| e.to_string())?,
                ptz_zoom: *library
                    .get(b"NDIlib_recv_ptz_zoom\0")
                    .map_err(|e| e.to_string())?,
                ptz_zoom_speed: *library
                    .get(b"NDIlib_recv_ptz_zoom_speed\0")
                    .map_err(|e| e.to_string())?,
                _library: library,
            }
        };
        return Ok(api);
    }
    Err(format!(
        "NDI runtime not found. Install the NDI runtime or set NDI_LIBRARY. Tried: {}",
        tried.join(", ")
    ))
}

fn api() -> std::result::Result<&'static Api, &'static str> {
    static API: OnceLock<std::result::Result<Api, String>> = OnceLock::new();
    API.get_or_init(load).as_ref().map_err(String::as_str)
}

fn unavailable(error: &str) -> Error {
    Error::Device(error.to_owned())
}

#[derive(Default)]
struct PreviewState {
    jpeg: Option<Arc<Vec<u8>>>,
    width: u32,
    height: u32,
}
struct Preview {
    source: String,
    state: Mutex<PreviewState>,
    last_read: Mutex<Instant>,
    connected: AtomicBool,
    ptz_supported: AtomicBool,
    finished: AtomicBool,
}

/// Discovery and preview receivers. Each runs on its own thread because NDI
/// calls block and its instances are not shared between threads.
#[derive(Default)]
pub struct Ndi {
    sources: Arc<Mutex<Option<Vec<NdiSource>>>>,
    previews: Mutex<HashMap<String, Arc<Preview>>>,
}

impl Ndi {
    pub fn status(&self) -> (bool, Option<String>) {
        match api() {
            Ok(_) => (true, None),
            Err(error) => (false, Some(error.to_owned())),
        }
    }
    /// Sources currently on the network. Discovery starts on first use, so
    /// the first call can return before every source has been seen.
    pub fn sources(&self) -> Result<Vec<NdiSource>> {
        let api = api().map_err(unavailable)?;
        let mut sources = self.sources.lock().unwrap();
        if let Some(list) = sources.as_ref() {
            return Ok(list.clone());
        }
        *sources = Some(vec![]);
        let shared = self.sources.clone();
        std::thread::Builder::new()
            .name("ndi-discovery".into())
            .spawn(move || discover(api, shared))
            .map_err(|e| Error::Device(e.to_string()))?;
        drop(sources);
        // Give the first scan a moment so a fresh list isn't always empty.
        std::thread::sleep(Duration::from_millis(1500));
        Ok(self.sources.lock().unwrap().clone().unwrap_or_default())
    }
    /// The latest preview frame as JPEG, starting a receiver if needed.
    pub fn frame(&self, device_id: &str, source: &str) -> Result<Option<Arc<Vec<u8>>>> {
        let api = api().map_err(unavailable)?;
        let mut previews = self.previews.lock().unwrap();
        let preview = match previews.get(device_id) {
            Some(p) if p.source == source && !p.finished.load(Ordering::SeqCst) => p.clone(),
            _ => {
                if let Some(old) = previews.remove(device_id) {
                    old.finished.store(true, Ordering::SeqCst);
                }
                let preview = Arc::new(Preview {
                    source: source.to_owned(),
                    state: Mutex::default(),
                    last_read: Mutex::new(Instant::now()),
                    connected: AtomicBool::new(false),
                    ptz_supported: AtomicBool::new(false),
                    finished: AtomicBool::new(false),
                });
                let name = CString::new(source)
                    .map_err(|_| Error::Invalid("NDI source contains NUL".into()))?;
                let receiver = preview.clone();
                std::thread::Builder::new()
                    .name("ndi-preview".into())
                    .spawn(move || receive(api, name, receiver))
                    .map_err(|e| Error::Device(e.to_string()))?;
                previews.insert(device_id.to_owned(), preview.clone());
                preview
            }
        };
        *preview.last_read.lock().unwrap() = Instant::now();
        Ok(preview.state.lock().unwrap().jpeg.clone())
    }
    pub fn previews(&self) -> Vec<NdiPreview> {
        let mut previews = self.previews.lock().unwrap();
        previews.retain(|_, p| !p.finished.load(Ordering::SeqCst));
        previews
            .iter()
            .map(|(device_id, p)| {
                let state = p.state.lock().unwrap();
                NdiPreview {
                    device_id: device_id.clone(),
                    source: p.source.clone(),
                    connected: p.connected.load(Ordering::SeqCst),
                    ptz_supported: p.ptz_supported.load(Ordering::SeqCst),
                    width: state.width,
                    height: state.height,
                }
            })
            .collect()
    }
    pub fn close(&self) {
        for preview in self.previews.lock().unwrap().drain().map(|(_, p)| p) {
            preview.finished.store(true, Ordering::SeqCst);
        }
    }
}

fn discover(api: &'static Api, shared: Arc<Mutex<Option<Vec<NdiSource>>>>) {
    let settings = ffi::FindCreate {
        show_local_sources: true,
        groups: std::ptr::null(),
        extra_ips: std::ptr::null(),
    };
    // SAFETY: the finder is created, used and destroyed only on this thread, and
    // the source array is copied before the next call can invalidate it.
    unsafe {
        let finder = (api.find_create)(&settings);
        if finder.is_null() {
            return;
        }
        loop {
            (api.find_wait)(finder, 1000);
            let mut count = 0u32;
            let list = (api.find_sources)(finder, &mut count);
            let text = |p: *const std::ffi::c_char| {
                (!p.is_null()).then(|| CStr::from_ptr(p).to_string_lossy().into_owned())
            };
            let mut sources = vec![];
            for index in 0..count as usize {
                let source = &*list.add(index);
                if let Some(name) = text(source.ndi_name) {
                    sources.push(NdiSource {
                        name,
                        address: text(source.url_address),
                    });
                }
            }
            sources.sort_by(|a, b| a.name.cmp(&b.name));
            *shared.lock().unwrap() = Some(sources);
            if Arc::strong_count(&shared) == 1 {
                break;
            }
        }
        (api.find_destroy)(finder);
    }
}

fn receive(api: &'static Api, source: CString, preview: Arc<Preview>) {
    let receiver_name = c"ATEM Control preview";
    let settings = ffi::RecvCreateV3 {
        source: ffi::Source {
            ndi_name: source.as_ptr(),
            url_address: std::ptr::null(),
        },
        color_format: ffi::COLOR_RGBX_RGBA,
        bandwidth: ffi::BANDWIDTH_LOWEST,
        allow_video_fields: false,
        recv_name: receiver_name.as_ptr(),
    };
    // SAFETY: the receiver is used only on this thread and destroyed before it
    // returns; each captured frame is read before it is freed.
    unsafe {
        let receiver = (api.recv_create)(&settings);
        if receiver.is_null() {
            preview.finished.store(true, Ordering::SeqCst);
            return;
        }
        let mut encoded_at = Instant::now() - PREVIEW_INTERVAL;
        while !preview.finished.load(Ordering::SeqCst)
            && preview.last_read.lock().unwrap().elapsed() < PREVIEW_IDLE
        {
            let mut frame: ffi::VideoFrameV2 = std::mem::zeroed();
            let kind = (api.recv_capture)(
                receiver,
                &mut frame,
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                500,
            );
            preview
                .connected
                .store((api.recv_connections)(receiver) > 0, Ordering::SeqCst);
            preview
                .ptz_supported
                .store((api.recv_ptz_supported)(receiver), Ordering::SeqCst);
            if kind == ffi::FRAME_ERROR {
                break;
            }
            if kind != ffi::FRAME_VIDEO {
                continue;
            }
            if encoded_at.elapsed() >= PREVIEW_INTERVAL
                && matches!(frame.fourcc, ffi::FOURCC_RGBA | ffi::FOURCC_RGBX)
                && !frame.data.is_null()
                && frame.xres > 0
                && frame.yres > 0
                && frame.line_stride_in_bytes >= frame.xres * 4
            {
                let (width, height, stride) = (
                    frame.xres as usize,
                    frame.yres as usize,
                    frame.line_stride_in_bytes as usize,
                );
                let pixels = std::slice::from_raw_parts(frame.data, stride * height);
                let image = Rgb::from_rgbx(pixels, width, height, stride, PREVIEW_WIDTH);
                if let Ok(jpeg) = image.jpeg(70) {
                    let mut state = preview.state.lock().unwrap();
                    state.jpeg = Some(Arc::new(jpeg));
                    state.width = width as u32;
                    state.height = height as u32;
                }
                encoded_at = Instant::now();
            }
            (api.recv_free_video)(receiver, &frame);
        }
        (api.recv_destroy)(receiver);
    }
    preview.connected.store(false, Ordering::SeqCst);
    preview.finished.store(true, Ordering::SeqCst);
}

/// Frames on request, for calibration and panoramas, from the sender's
/// low-bandwidth stream. The receiver stays connected while this is alive.
pub struct Stills {
    shared: Arc<StillShared>,
}
type StillRequest = (Instant, tokio::sync::oneshot::Sender<Rgb>);
struct StillShared {
    request: Mutex<Option<StillRequest>>,
    stop: AtomicBool,
}
impl Ndi {
    /// Starts a receiver whose frames are downscaled to at most `max_width`
    /// when captured.
    pub fn stills(&self, source: &str, max_width: usize) -> Result<Stills> {
        let api = api().map_err(unavailable)?;
        let name =
            CString::new(source).map_err(|_| Error::Invalid("NDI source contains NUL".into()))?;
        let shared = Arc::new(StillShared {
            request: Mutex::new(None),
            stop: AtomicBool::new(false),
        });
        let worker = shared.clone();
        std::thread::Builder::new()
            .name("ndi-stills".into())
            .spawn(move || capture_stills(api, name, worker, max_width))
            .map_err(|e| Error::Device(e.to_string()))?;
        Ok(Stills { shared })
    }
}
impl Stills {
    /// The first frame that arrives after `after`, skipping a couple more so
    /// frames already buffered in the network stack are not returned.
    pub async fn capture_after(&self, after: Instant, timeout: Duration) -> Result<Rgb> {
        let (tx, rx) = tokio::sync::oneshot::channel();
        *self.shared.request.lock().unwrap() = Some((after, tx));
        tokio::time::timeout(timeout, rx)
            .await
            .map_err(|_| {
                Error::Device("No NDI frame arrived; check the camera's NDI source".into())
            })?
            .map_err(|_| Error::Device("NDI still receiver stopped".into()))
    }
}
impl Drop for Stills {
    fn drop(&mut self) {
        self.shared.stop.store(true, Ordering::SeqCst);
    }
}

fn capture_stills(api: &'static Api, source: CString, shared: Arc<StillShared>, max_width: usize) {
    let receiver_name = c"ATEM Control stills";
    let settings = ffi::RecvCreateV3 {
        source: ffi::Source {
            ndi_name: source.as_ptr(),
            url_address: std::ptr::null(),
        },
        color_format: ffi::COLOR_RGBX_RGBA,
        bandwidth: ffi::BANDWIDTH_LOWEST,
        allow_video_fields: false,
        recv_name: receiver_name.as_ptr(),
    };
    // SAFETY: the receiver is used only on this thread and destroyed before it
    // returns; each captured frame is read before it is freed.
    unsafe {
        let receiver = (api.recv_create)(&settings);
        if receiver.is_null() {
            return;
        }
        let mut skipped = 0;
        while !shared.stop.load(Ordering::SeqCst) {
            let mut frame: ffi::VideoFrameV2 = std::mem::zeroed();
            let kind = (api.recv_capture)(
                receiver,
                &mut frame,
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                200,
            );
            if kind == ffi::FRAME_ERROR {
                break;
            }
            if kind != ffi::FRAME_VIDEO {
                continue;
            }
            let arrived = Instant::now();
            let mut request = shared.request.lock().unwrap();
            let wanted = request.as_ref().is_some_and(|(after, _)| arrived > *after);
            if !wanted {
                skipped = 0;
            } else if skipped < 2 {
                skipped += 1;
            } else if matches!(frame.fourcc, ffi::FOURCC_RGBA | ffi::FOURCC_RGBX)
                && !frame.data.is_null()
                && frame.xres > 0
                && frame.yres > 0
                && frame.line_stride_in_bytes >= frame.xres * 4
            {
                let (width, height, stride) = (
                    frame.xres as usize,
                    frame.yres as usize,
                    frame.line_stride_in_bytes as usize,
                );
                let pixels = std::slice::from_raw_parts(frame.data, stride * height);
                let image = Rgb::from_rgbx(pixels, width, height, stride, max_width);
                if let Some((_, reply)) = request.take() {
                    let _ = reply.send(image);
                }
                skipped = 0;
            }
            drop(request);
            (api.recv_free_video)(receiver, &frame);
        }
        (api.recv_destroy)(receiver);
    }
}

/// NDI PTZ requests, in NDI's normalized units.
enum Ptz {
    /// Pan -1 (left) to 1 (right), tilt -1 (down) to 1 (up).
    PanTilt(f32, f32),
    /// 0 is wide, 1 fully zoomed in (see `normalized`).
    Zoom(f32),
    Stop,
    /// Connects and confirms the sender accepts PTZ, without moving.
    Check,
}
type PtzReply = tokio::sync::oneshot::Sender<Result<()>>;

/// Pan/tilt ±32767 and zoom 0 (wide) to 16384 (tele) in application units.
fn normalized(command: &Command) -> Option<Ptz> {
    Some(match command {
        Command::PanTilt { pan, tilt, .. } => {
            Ptz::PanTilt(f32::from(*pan) / 32767.0, f32::from(*tilt) / 32767.0)
        }
        // The SDK header documents 0.0 as zoomed in, but a BirdDog camera
        // treats 0.0 as wide and 1.0 as fully zoomed in.
        Command::Zoom { position } => Ptz::Zoom(f32::from(*position) / 16384.0),
        Command::Stop => Ptz::Stop,
        Command::Refresh => Ptz::Check,
        _ => return None,
    })
}

/// A camera controlled only through NDI PTZ. NDI sends commands without
/// acknowledging completion or reporting position, so state shows the last
/// commanded position and a move is done once it is sent.
pub struct NdiCamera {
    source: String,
    control: Mutex<Option<std::sync::mpsc::Sender<(Ptz, PtzReply)>>>,
    state: tokio::sync::Mutex<DeviceState>,
}
impl NdiCamera {
    pub fn new(device_id: &str, source: &str) -> Self {
        Self {
            source: source.to_owned(),
            control: Mutex::new(None),
            state: tokio::sync::Mutex::new(DeviceState {
                device_id: device_id.to_owned(),
                status: ConnectionStatus::Disconnected,
                feedback: Feedback::Unknown,
                error: None,
                camera: None,
                switcher: None,
            }),
        }
    }
    fn send(&self, request: Ptz) -> Result<tokio::sync::oneshot::Receiver<Result<()>>> {
        let (reply, receiver) = tokio::sync::oneshot::channel();
        let mut control = self.control.lock().unwrap();
        let message = match control.as_ref() {
            Some(tx) => match tx.send((request, reply)) {
                Ok(()) => return Ok(receiver),
                // The control thread ended; start another below.
                Err(std::sync::mpsc::SendError(message)) => message,
            },
            None => (request, reply),
        };
        let api = api().map_err(unavailable)?;
        let source = CString::new(self.source.as_str())
            .map_err(|_| Error::Invalid("NDI source contains NUL".into()))?;
        let (tx, rx) = std::sync::mpsc::channel();
        std::thread::Builder::new()
            .name("ndi-ptz".into())
            .spawn(move || control_camera(api, source, rx))
            .map_err(|e| Error::Device(e.to_string()))?;
        let _ = tx.send(message);
        *control = Some(tx);
        Ok(receiver)
    }
}
#[async_trait]
impl Adapter for NdiCamera {
    async fn execute(&self, command: &Command) -> Result<()> {
        let request = normalized(command)
            .ok_or_else(|| Error::Invalid("Unsupported camera command".into()))?;
        let reply = self.send(request)?;
        let result = tokio::time::timeout(Duration::from_secs(8), reply)
            .await
            .map_err(|_| Error::Device("NDI PTZ did not respond".into()))?
            .map_err(|_| Error::Device("NDI PTZ connection closed".into()))?;
        let mut state = self.state.lock().await;
        match &result {
            Ok(()) => {
                state.status = ConnectionStatus::Connected;
                state.error = None;
                let mut camera = state.camera.clone().unwrap_or(CameraState {
                    pan: 0,
                    tilt: 0,
                    zoom: 0,
                });
                match command {
                    Command::PanTilt { pan, tilt, .. } => (camera.pan, camera.tilt) = (*pan, *tilt),
                    Command::Zoom { position } => camera.zoom = *position,
                    _ => return result,
                }
                state.camera = Some(camera);
                state.feedback = Feedback::Commanded;
            }
            Err(error) => {
                state.status = ConnectionStatus::Error;
                state.error = Some(error.to_string());
            }
        }
        result
    }
    async fn snapshot(&self) -> DeviceState {
        self.state.lock().await.clone()
    }
    async fn close(&self) -> Result<()> {
        // Dropping the sender ends the control thread and its receiver.
        self.control.lock().unwrap().take();
        Ok(())
    }
}

fn control_camera(
    api: &'static Api,
    source: CString,
    requests: std::sync::mpsc::Receiver<(Ptz, PtzReply)>,
) {
    let receiver_name = c"ATEM Control PTZ";
    let settings = ffi::RecvCreateV3 {
        source: ffi::Source {
            ndi_name: source.as_ptr(),
            url_address: std::ptr::null(),
        },
        color_format: ffi::COLOR_RGBX_RGBA,
        bandwidth: ffi::BANDWIDTH_METADATA_ONLY,
        allow_video_fields: false,
        recv_name: receiver_name.as_ptr(),
    };
    // SAFETY: the receiver is created, used and destroyed on this thread only.
    unsafe {
        let receiver = (api.recv_create)(&settings);
        if receiver.is_null() {
            return;
        }
        // Capturing with no frame buffers processes connection and status
        // changes, which is how PTZ support becomes known.
        let pump = |timeout| {
            (api.recv_capture)(
                receiver,
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                timeout,
            )
        };
        loop {
            let (request, reply) = match requests.recv_timeout(Duration::from_millis(500)) {
                Ok(message) => message,
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                    pump(0);
                    continue;
                }
                Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => break,
            };
            // PTZ support is reported a few seconds after connecting.
            let deadline = Instant::now() + Duration::from_secs(6);
            while !((api.recv_connections)(receiver) > 0 && (api.recv_ptz_supported)(receiver))
                && Instant::now() < deadline
            {
                pump(250);
            }
            let result = if (api.recv_connections)(receiver) == 0 {
                Err(Error::Device("NDI source is not reachable".into()))
            } else if !(api.recv_ptz_supported)(receiver) {
                Err(Error::Device(
                    "NDI source does not report PTZ support".into(),
                ))
            } else {
                let sent = match request {
                    Ptz::PanTilt(pan, tilt) => (api.ptz_pan_tilt)(receiver, pan, tilt),
                    Ptz::Zoom(zoom) => (api.ptz_zoom)(receiver, zoom),
                    Ptz::Stop => {
                        (api.ptz_pan_tilt_speed)(receiver, 0.0, 0.0)
                            & (api.ptz_zoom_speed)(receiver, 0.0)
                    }
                    Ptz::Check => true,
                };
                if sent {
                    Ok(())
                } else {
                    Err(Error::Device("NDI PTZ command was not sent".into()))
                }
            };
            let _ = reply.send(result);
        }
        (api.recv_destroy)(receiver);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn frame_layout_matches_the_ndi_c_structs() {
        // Offsets measured by compiling against the NDI SDK headers (64-bit).
        assert_eq!(std::mem::size_of::<ffi::VideoFrameV2>(), 72);
        assert_eq!(std::mem::offset_of!(ffi::VideoFrameV2, data), 40);
        assert_eq!(
            std::mem::offset_of!(ffi::VideoFrameV2, line_stride_in_bytes),
            48
        );
        assert_eq!(std::mem::size_of::<ffi::RecvCreateV3>(), 40);
        assert_eq!(std::mem::offset_of!(ffi::RecvCreateV3, bandwidth), 20);
        assert_eq!(std::mem::offset_of!(ffi::RecvCreateV3, recv_name), 32);
        assert_eq!(std::mem::size_of::<ffi::FindCreate>(), 24);
        // Values from the NDI 6.3.2 SDK headers.
        assert_eq!(
            (ffi::FOURCC_RGBA, ffi::FOURCC_RGBX),
            (1094862674, 1480738642)
        );
    }

    #[test]
    fn maps_application_units_to_ndi_ptz_ranges() {
        let Some(Ptz::PanTilt(pan, tilt)) = normalized(&Command::PanTilt {
            pan: 32767,
            tilt: -32767,
            pan_speed: 8,
            tilt_speed: 8,
        }) else {
            panic!()
        };
        assert_eq!((pan, tilt), (1.0, -1.0));
        // Application zoom 0 is wide, which a BirdDog takes as NDI 0.0.
        let Some(Ptz::Zoom(wide)) = normalized(&Command::Zoom { position: 0 }) else {
            panic!()
        };
        let Some(Ptz::Zoom(tele)) = normalized(&Command::Zoom { position: 16384 }) else {
            panic!()
        };
        assert_eq!((wide, tele), (0.0, 1.0));
    }

    /// Run with an NDI runtime and a live source, e.g.
    /// `NDI_LIBRARY=... NDI_TEST_SOURCE="HOST (Test Pattern)" cargo test -- --ignored`.
    #[test]
    #[ignore]
    fn receives_a_preview_from_a_live_source() {
        let source = std::env::var("NDI_TEST_SOURCE").expect("NDI_TEST_SOURCE");
        let ndi = Ndi::default();
        println!("sources: {:?}", ndi.sources().unwrap());
        let deadline = Instant::now() + Duration::from_secs(15);
        let jpeg = loop {
            if let Some(jpeg) = ndi.frame("camera", &source).unwrap() {
                break jpeg;
            }
            assert!(Instant::now() < deadline, "no frame from {source}");
            std::thread::sleep(Duration::from_millis(200));
        };
        let preview = &ndi.previews()[0];
        println!(
            "{}x{}, ptz {}",
            preview.width, preview.height, preview.ptz_supported
        );
        assert_eq!(&jpeg[..2], &[0xff, 0xd8]);
        std::fs::write(std::env::temp_dir().join("ndi-preview.jpg"), &*jpeg).unwrap();
        ndi.close();
    }
}
