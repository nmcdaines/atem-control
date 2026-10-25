//! Explicit VISCA-IP profiles. No movement retries or implicit protocol failover.
//! ACK means accepted; completion (or, for cameras that never report it, the
//! observed position settling) is followed by inquiries for observed position.
use crate::adapter::Adapter;
use async_trait::async_trait;
use control_core::*;
use std::{
    net::SocketAddr,
    sync::atomic::{AtomicBool, AtomicU64, Ordering},
    time::Duration,
};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::{TcpStream, UdpSocket},
    sync::Mutex,
};
use tokio_util::sync::CancellationToken;

enum Transport {
    Udp(UdpSocket),
    Tcp { stream: TcpStream, pending: Vec<u8> },
}
struct Session {
    transport: Transport,
    sequence: u32,
    framing: Framing,
}
pub struct Visca {
    device: Device,
    session: Mutex<Option<Session>>,
    state: Mutex<DeviceState>,
    command_lock: Mutex<()>,
    active: std::sync::Mutex<Option<CancellationToken>>,
    epoch: AtomicU64,
    moving: AtomicBool,
}
fn network(error: impl std::fmt::Display) -> Error {
    Error::Device(format!("VISCA: {error}"))
}
fn nibbles(value: u16) -> [u8; 4] {
    [
        ((value >> 12) & 15) as u8,
        ((value >> 8) & 15) as u8,
        ((value >> 4) & 15) as u8,
        (value & 15) as u8,
    ]
}
fn position(bytes: &[u8]) -> Result<u16> {
    if bytes.len() != 4 || bytes.iter().any(|v| *v > 15) {
        return Err(network("Malformed position response"));
    }
    Ok(bytes
        .iter()
        .fold(0, |value, nibble| (value << 4) | u16::from(*nibble)))
}
fn movement(command: &Command) -> Result<Vec<Vec<u8>>> {
    Ok(match command {
        Command::PanTilt {
            pan,
            tilt,
            pan_speed,
            tilt_speed,
        } => {
            let mut bytes = vec![0x81, 1, 6, 2, *pan_speed, *tilt_speed];
            bytes.extend(nibbles(*pan as u16));
            bytes.extend(nibbles(*tilt as u16));
            bytes.push(0xff);
            vec![bytes]
        }
        Command::Zoom { position } => {
            let mut bytes = vec![0x81, 1, 4, 0x47];
            bytes.extend(nibbles(*position));
            bytes.push(0xff);
            vec![bytes]
        }
        Command::Stop => vec![
            vec![0x81, 1, 6, 1, 1, 1, 3, 3, 0xff],
            vec![0x81, 1, 4, 7, 0, 0xff],
        ],
        Command::Refresh => vec![],
        _ => return Err(network("Unsupported camera command")),
    })
}
impl Visca {
    pub fn new(device: Device) -> Self {
        let state = DeviceState {
            device_id: device.id.clone(),
            status: ConnectionStatus::Disconnected,
            feedback: Feedback::Unknown,
            error: Some("Not connected. Read camera position to verify this VISCA profile.".into()),
            camera: None,
            switcher: None,
        };
        Self {
            device,
            session: Mutex::new(None),
            state: Mutex::new(state),
            command_lock: Mutex::new(()),
            active: std::sync::Mutex::new(None),
            epoch: AtomicU64::new(0),
            moving: AtomicBool::new(false),
        }
    }
    async fn connect(&self) -> Result<Session> {
        let Connection::Visca {
            address,
            port,
            framing,
            ..
        } = &self.device.connection
        else {
            return Err(network("Missing profile"));
        };
        let address = SocketAddr::new(address.parse().map_err(network)?, *port);
        let transport = if *framing == Framing::RawTcp {
            let stream = tokio::time::timeout(Duration::from_secs(2), TcpStream::connect(address))
                .await
                .map_err(network)?
                .map_err(network)?;
            stream.set_nodelay(true).map_err(network)?;
            Transport::Tcp {
                stream,
                pending: vec![],
            }
        } else {
            let bind = if address.is_ipv4() {
                "0.0.0.0:0"
            } else {
                "[::]:0"
            };
            let socket = UdpSocket::bind(bind).await.map_err(network)?;
            socket.connect(address).await.map_err(network)?;
            Transport::Udp(socket)
        };
        let mut session = Session {
            transport,
            sequence: 0,
            framing: *framing,
        };
        if *framing == Framing::SonyUdp {
            let Transport::Udp(socket) = &session.transport else {
                unreachable!()
            };
            socket
                .send(&[2, 0, 0, 1, 0, 0, 0, 0, 1])
                .await
                .map_err(network)?;
            let mut reply = [0u8; 256];
            let len = tokio::time::timeout(Duration::from_secs(2), socket.recv(&mut reply))
                .await
                .map_err(network)?
                .map_err(network)?;
            if len != 9 || reply[..4] != [2, 1, 0, 1] || reply[8] != 1 {
                return Err(network(
                    "Camera did not acknowledge Sony sequence reset; check framing/port",
                ));
            }
            session.sequence = 0;
        }
        Ok(session)
    }
    async fn perform(&self, command: &Command) -> Result<()> {
        // A cancelled operation drops this session, so a late reply can never be
        // mistaken for completion of a later command on the same socket.
        let mut guard = self.session.lock().await;
        let mut session = match guard.take() {
            Some(s) => s,
            None => self.connect().await?,
        };
        // A motion whose completion never arrived leaves a reply that may still
        // turn up on this socket, so the next command starts a fresh session.
        let mut reusable = true;
        let result = async {
            if matches!(command, Command::PanTilt { .. } | Command::Zoom { .. }) {
                self.moving.store(true, Ordering::SeqCst);
                let mut state = self.state.lock().await;
                state.feedback = Feedback::Commanded;
                state.camera = None;
            }
            for bytes in movement(command)? {
                match command {
                    Command::PanTilt { pan, tilt, .. } => {
                        let target = [*pan as u16, *tilt as u16];
                        if !session
                            .motion(&bytes, &[0x81, 9, 6, 0x12, 0xff], &target)
                            .await?
                        {
                            reusable = false;
                        }
                    }
                    Command::Zoom { position } => {
                        if !session
                            .motion(&bytes, &[0x81, 9, 4, 0x47, 0xff], &[*position])
                            .await?
                        {
                            reusable = false;
                        }
                    }
                    _ => session.command(&bytes).await?,
                }
            }
            if matches!(command, Command::Stop) {
                self.moving.store(false, Ordering::SeqCst);
            }
            if matches!(command, Command::PanTilt { .. } | Command::Zoom { .. }) {
                let mut state = self.state.lock().await;
                state.feedback = Feedback::Commanded;
                state.camera = None;
            }
            let pan_tilt = session.inquire(&[0x81, 9, 6, 0x12, 0xff]).await?;
            let zoom = session.inquire(&[0x81, 9, 4, 0x47, 0xff]).await?;
            if pan_tilt.len() != 11 || zoom.len() != 7 {
                return Err(network("Unexpected position inquiry response length"));
            }
            let camera = CameraState {
                pan: position(&pan_tilt[2..6])? as i16,
                tilt: position(&pan_tilt[6..10])? as i16,
                zoom: position(&zoom[2..6])?,
            };
            let mut state = self.state.lock().await;
            state.status = ConnectionStatus::Connected;
            state.feedback = Feedback::Observed;
            state.camera = Some(camera);
            state.error = None;
            Ok(())
        }
        .await;
        if result.is_ok() && reusable {
            *guard = Some(session);
        }
        result
    }
}
impl Session {
    async fn send(&mut self, payload: &[u8], inquiry: bool) -> Result<u32> {
        let sequence = self.sequence;
        self.sequence = self.sequence.wrapping_add(1);
        let mut frame = vec![];
        if self.framing == Framing::SonyUdp {
            frame.extend([1, if inquiry { 0x10 } else { 0 }]);
            frame.extend((payload.len() as u16).to_be_bytes());
            frame.extend(sequence.to_be_bytes());
        }
        frame.extend(payload);
        match &mut self.transport {
            Transport::Udp(socket) => {
                socket.send(&frame).await.map_err(network)?;
            }
            Transport::Tcp { stream, .. } => {
                stream.write_all(&frame).await.map_err(network)?;
            }
        }
        Ok(sequence)
    }
    async fn receive(&mut self, sequence: u32, timeout: Duration) -> Result<Vec<u8>> {
        self.poll(sequence, timeout).await?.ok_or_else(|| {
            network("Response timed out; command may have executed. No automatic retry.")
        })
    }
    /// Like `receive`, but a timeout yields `None` instead of an error.
    async fn poll(&mut self, sequence: u32, timeout: Duration) -> Result<Option<Vec<u8>>> {
        let reply = tokio::time::timeout(timeout, async {
            loop {
                let bytes = match &mut self.transport {
                    Transport::Udp(socket) => {
                        let mut frame = [0u8; 1024];
                        let len = socket.recv(&mut frame).await.map_err(network)?;
                        if self.framing == Framing::SonyUdp {
                            if len < 9
                                || frame[..2] != [1, 0x11]
                                || u16::from_be_bytes([frame[2], frame[3]]) as usize != len - 8
                            {
                                return Err(network("Malformed Sony UDP response"));
                            }
                            if u32::from_be_bytes(frame[4..8].try_into().unwrap()) != sequence {
                                continue;
                            }
                            frame[8..len].to_vec()
                        } else {
                            frame[..len].to_vec()
                        }
                    }
                    Transport::Tcp { stream, pending } => loop {
                        if let Some(end) = pending.iter().position(|b| *b == 0xff) {
                            break pending.drain(..=end).collect();
                        }
                        if pending.len() > 1024 {
                            return Err(network("Oversized VISCA response"));
                        }
                        let mut bytes = [0u8; 256];
                        let len = stream.read(&mut bytes).await.map_err(network)?;
                        if len == 0 {
                            return Err(network("Camera closed connection"));
                        }
                        pending.extend(&bytes[..len]);
                    },
                };
                if bytes.len() < 3 || bytes[0] != 0x90 || bytes.last() != Some(&0xff) {
                    return Err(network("Malformed VISCA response"));
                }
                if bytes[1] & 0xf0 == 0x60 {
                    return Err(network(format!("Camera rejected command: {bytes:02x?}")));
                }
                return Ok(bytes);
            }
        })
        .await;
        match reply {
            Ok(reply) => reply.map(Some),
            Err(_) => Ok(None),
        }
    }
    async fn command(&mut self, payload: &[u8]) -> Result<()> {
        if let Some((sequence, socket)) = self.start(payload).await? {
            let completion = self.receive(sequence, Duration::from_secs(2)).await?;
            Self::complete(&completion, socket)?;
        }
        Ok(())
    }
    /// Sends a command and waits for acceptance. Returns the sequence and
    /// socket still awaiting completion, or `None` if it already completed.
    async fn start(&mut self, payload: &[u8]) -> Result<Option<(u32, u8)>> {
        let sequence = self.send(payload, false).await?;
        let first = self.receive(sequence, Duration::from_secs(2)).await?;
        if first[1] & 0xf0 == 0x40 {
            return Ok(Some((sequence, first[1] & 0x0f)));
        }
        Self::complete(&first, first[1] & 0x0f)?;
        Ok(None)
    }
    fn complete(reply: &[u8], socket: u8) -> Result<()> {
        if reply[1] & 0xf0 != 0x50 {
            return Err(network("Expected command completion"));
        }
        if reply[1] & 0x0f != socket {
            return Err(network("Completion socket did not match ACK"));
        }
        Ok(())
    }
    /// Runs a motion command until it completes. Some cameras never send
    /// completion for absolute moves, so after a grace period the observed
    /// position is polled until it reaches `target` or stops changing.
    /// Returns false when completion was inferred from position, meaning a
    /// late completion may still arrive on this session.
    async fn motion(&mut self, payload: &[u8], inquiry: &[u8], target: &[u16]) -> Result<bool> {
        let Some((sequence, socket)) = self.start(payload).await? else {
            return Ok(true);
        };
        let deadline = tokio::time::Instant::now() + Duration::from_secs(120);
        let mut wait = Duration::from_secs(1);
        let mut last = None;
        let mut unchanged = 0;
        loop {
            if let Some(reply) = self.poll(sequence, wait).await? {
                Self::complete(&reply, socket)?;
                return Ok(true);
            }
            if tokio::time::Instant::now() >= deadline {
                return Err(network("Motion did not complete"));
            }
            let reply = self.inquire(inquiry).await?;
            let observed = reply[2..reply.len() - 1]
                .chunks(4)
                .map(position)
                .collect::<Result<Vec<_>>>()?;
            if observed == target {
                return Ok(false);
            }
            if last.as_ref() == Some(&observed) {
                unchanged += 1;
                if unchanged >= 4 {
                    return Ok(false);
                }
            } else {
                unchanged = 0;
                last = Some(observed);
            }
            wait = Duration::from_millis(250);
        }
    }
    async fn inquire(&mut self, payload: &[u8]) -> Result<Vec<u8>> {
        let sequence = self.send(payload, true).await?;
        loop {
            let reply = self.receive(sequence, Duration::from_secs(2)).await?;
            // Without Sony framing a late motion completion can arrive here;
            // inquiry replies always use socket 0 and carry data.
            if reply.len() == 3 && reply[1] & 0xf0 == 0x50 && reply[1] & 0x0f != 0 {
                continue;
            }
            if reply[1] != 0x50 {
                return Err(network("Expected inquiry response"));
            }
            return Ok(reply);
        }
    }
}

#[async_trait]
impl Adapter for Visca {
    async fn execute(&self, command: &Command) -> Result<()> {
        let epoch = if matches!(command, Command::Stop) {
            let epoch = self.epoch.fetch_add(1, Ordering::SeqCst) + 1;
            if let Some(token) = self.active.lock().unwrap().as_ref() {
                token.cancel();
            }
            epoch
        } else {
            self.epoch.load(Ordering::SeqCst)
        };
        let _command = self.command_lock.lock().await;
        if epoch != self.epoch.load(Ordering::SeqCst) {
            return Err(Error::Cancelled);
        }
        let token = CancellationToken::new();
        *self.active.lock().unwrap() = Some(token.clone());
        let result = tokio::select! { biased; _ = token.cancelled() => Err(Error::Cancelled), result = self.perform(command) => result };
        *self.active.lock().unwrap() = None;
        if let Err(error) = &result {
            let mut state = self.state.lock().await;
            state.status = ConnectionStatus::Error;
            state.error = Some(error.to_string());
            state.feedback = Feedback::Unknown;
            state.camera = None;
        }
        result
    }
    async fn snapshot(&self) -> DeviceState {
        self.state.lock().await.clone()
    }
    async fn close(&self) -> Result<()> {
        let has_session = self.session.lock().await.is_some();
        if has_session || self.moving.load(Ordering::SeqCst) {
            let _ =
                tokio::time::timeout(Duration::from_secs(2), self.execute(&Command::Stop)).await;
        }
        *self.session.lock().await = None;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn encodes_signed_positions_and_rejects_bad_nibbles() {
        let bytes = movement(&Command::PanTilt {
            pan: -1,
            tilt: 16,
            pan_speed: 8,
            tilt_speed: 8,
        })
        .unwrap();
        assert_eq!(&bytes[0][6..10], &[15, 15, 15, 15]);
        assert_eq!(&bytes[0][10..14], &[0, 0, 1, 0]);
        assert!(position(&[0, 0, 0, 16]).is_err());
    }
    #[tokio::test]
    async fn stop_interrupts_a_motion_waiting_for_completion() {
        let camera = UdpSocket::bind("127.0.0.1:0").await.unwrap();
        let port = camera.local_addr().unwrap().port();
        let (started_tx, started_rx) = tokio::sync::oneshot::channel();
        let server = tokio::spawn(async move {
            let mut buffer = [0u8; 128];
            let (_, peer) = camera.recv_from(&mut buffer).await.unwrap();
            camera.send_to(&[0x90, 0x41, 0xff], peer).await.unwrap();
            started_tx.send(()).unwrap();
            // No motion completion is sent. Stop must cancel that wait and use
            // a fresh session so its replies cannot consume the old response.
            for response in [
                vec![0x90, 0x51, 0xff],
                vec![0x90, 0x51, 0xff],
                vec![0x90, 0x50, 0, 0, 0, 1, 0, 0, 0, 2, 0xff],
                vec![0x90, 0x50, 0, 0, 0, 0, 0xff],
            ] {
                let (_, peer) = camera.recv_from(&mut buffer).await.unwrap();
                camera.send_to(&response, peer).await.unwrap();
            }
        });
        let adapter = std::sync::Arc::new(Visca::new(Device {
            id: "stop-test".into(),
            name: "Stop test".into(),
            connection: Connection::Visca {
                address: "127.0.0.1".into(),
                port,
                framing: Framing::RawUdp,
                pan_limit: 32767,
                tilt_limit: 32767,
                zoom_limit: 16384,
            },
            ndi_source: None,
        }));
        let moving = adapter.clone();
        let motion = tokio::spawn(async move {
            moving
                .execute(&Command::PanTilt {
                    pan: 120,
                    tilt: 30,
                    pan_speed: 8,
                    tilt_speed: 8,
                })
                .await
        });
        started_rx.await.unwrap();
        tokio::time::timeout(Duration::from_secs(1), adapter.execute(&Command::Stop))
            .await
            .unwrap()
            .unwrap();
        assert!(matches!(motion.await.unwrap(), Err(Error::Cancelled)));
        assert_eq!(adapter.snapshot().await.feedback, Feedback::Observed);
        server.await.unwrap();
    }
    #[tokio::test]
    async fn motion_without_completion_finishes_when_position_reaches_target() {
        let camera = UdpSocket::bind("127.0.0.1:0").await.unwrap();
        let port = camera.local_addr().unwrap().port();
        let server = tokio::spawn(async move {
            let mut buffer = [0u8; 128];
            // Two consecutive moves; the camera ACKs each but never sends completion.
            for target in [[0, 0, 7, 8], [0, 0, 1, 2]] {
                let (_, peer) = camera.recv_from(&mut buffer).await.unwrap();
                assert_eq!(&buffer[..4], &[0x81, 1, 6, 2]);
                camera.send_to(&[0x90, 0x41, 0xff], peer).await.unwrap();
                let mut reached = vec![0x90, 0x50];
                reached.extend(target);
                reached.extend([0, 0, 0, 3, 0xff]);
                for response in [reached.clone(), reached, vec![0x90, 0x50, 0, 0, 0, 0, 0xff]] {
                    let (_, peer) = camera.recv_from(&mut buffer).await.unwrap();
                    camera.send_to(&response, peer).await.unwrap();
                }
            }
        });
        let adapter = Visca::new(Device {
            id: "no-completion".into(),
            name: "No completion".into(),
            connection: Connection::Visca {
                address: "127.0.0.1".into(),
                port,
                framing: Framing::RawUdp,
                pan_limit: 32767,
                tilt_limit: 32767,
                zoom_limit: 16384,
            },
            ndi_source: None,
        });
        for (pan, tilt) in [(0x78, 3), (0x12, 3)] {
            tokio::time::timeout(
                Duration::from_secs(3),
                adapter.execute(&Command::PanTilt {
                    pan,
                    tilt,
                    pan_speed: 8,
                    tilt_speed: 8,
                }),
            )
            .await
            .unwrap()
            .unwrap();
            assert_eq!(
                adapter.snapshot().await.camera,
                Some(CameraState { pan, tilt, zoom: 0 })
            );
        }
        server.await.unwrap();
    }
    #[tokio::test]
    async fn raw_udp_reads_observed_state_from_a_loopback_camera() {
        let camera = UdpSocket::bind("127.0.0.1:0").await.unwrap();
        let port = camera.local_addr().unwrap().port();
        let server = tokio::spawn(async move {
            for response in [
                vec![0x90, 0x50, 0, 0, 0, 10, 0, 0, 0, 2, 0xff],
                vec![0x90, 0x50, 0, 1, 0, 0, 0xff],
            ] {
                let mut buffer = [0u8; 128];
                let (_, remote) = camera.recv_from(&mut buffer).await.unwrap();
                camera.send_to(&response, remote).await.unwrap();
            }
        });
        let device = Device {
            id: "camera".into(),
            name: "Loopback".into(),
            connection: Connection::Visca {
                address: "127.0.0.1".into(),
                port,
                framing: Framing::RawUdp,
                pan_limit: 32767,
                tilt_limit: 32767,
                zoom_limit: 16384,
            },
            ndi_source: None,
        };
        let adapter = Visca::new(device);
        adapter.execute(&Command::Refresh).await.unwrap();
        assert_eq!(
            adapter.snapshot().await.camera,
            Some(CameraState {
                pan: 10,
                tilt: 2,
                zoom: 256
            })
        );
        assert_eq!(adapter.snapshot().await.feedback, Feedback::Observed);
        server.await.unwrap();
    }

    #[tokio::test]
    async fn sony_udp_resets_sequence_and_ignores_unrelated_replies() {
        let camera = UdpSocket::bind("127.0.0.1:0").await.unwrap();
        let port = camera.local_addr().unwrap().port();
        let server = tokio::spawn(async move {
            let mut buffer = [0u8; 128];
            let (len, peer) = camera.recv_from(&mut buffer).await.unwrap();
            assert_eq!(&buffer[..len], &[2, 0, 0, 1, 0, 0, 0, 0, 1]);
            camera
                .send_to(&[2, 1, 0, 1, 0, 0, 0, 0, 1], peer)
                .await
                .unwrap();
            for (sequence, payload) in [
                vec![0x90, 0x50, 0, 0, 0, 1, 0, 0, 0, 2, 0xff],
                vec![0x90, 0x50, 0, 0, 0, 3, 0xff],
            ]
            .into_iter()
            .enumerate()
            {
                let (_, peer) = camera.recv_from(&mut buffer).await.unwrap();
                assert_eq!(&buffer[..2], &[1, 0x10]);
                assert_eq!(
                    u32::from_be_bytes(buffer[4..8].try_into().unwrap()),
                    sequence as u32
                );
                let mut response = vec![1, 0x11];
                response.extend((payload.len() as u16).to_be_bytes());
                response.extend(99u32.to_be_bytes());
                response.extend(&payload);
                camera.send_to(&response, peer).await.unwrap();
                response[4..8].copy_from_slice(&(sequence as u32).to_be_bytes());
                camera.send_to(&response, peer).await.unwrap();
            }
        });
        let adapter = Visca::new(Device {
            id: "sony".into(),
            name: "Sony framing test".into(),
            connection: Connection::Visca {
                address: "127.0.0.1".into(),
                port,
                framing: Framing::SonyUdp,
                pan_limit: 32767,
                tilt_limit: 32767,
                zoom_limit: 16384,
            },
            ndi_source: None,
        });
        adapter.execute(&Command::Refresh).await.unwrap();
        assert_eq!(
            adapter.snapshot().await.camera,
            Some(CameraState {
                pan: 1,
                tilt: 2,
                zoom: 3
            })
        );
        server.await.unwrap();
    }

    #[tokio::test]
    async fn raw_tcp_splits_combined_ack_completion_and_partial_inquiries() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let server = tokio::spawn(async move {
            let (mut stream, _) = listener.accept().await.unwrap();
            let mut command = [0u8; 9];
            stream.read_exact(&mut command).await.unwrap();
            assert_eq!(command, [0x81, 1, 4, 0x47, 0, 1, 0, 0, 0xff]);
            stream
                .write_all(&[0x90, 0x41, 0xff, 0x90, 0x51, 0xff])
                .await
                .unwrap();
            for response in [
                vec![0x90, 0x50, 0, 0, 0, 1, 0, 0, 0, 2, 0xff],
                vec![0x90, 0x50, 0, 1, 0, 0, 0xff],
            ] {
                let mut query = [0u8; 5];
                stream.read_exact(&mut query).await.unwrap();
                stream.write_all(&response[..2]).await.unwrap();
                tokio::task::yield_now().await;
                stream.write_all(&response[2..]).await.unwrap();
            }
        });
        let adapter = Visca::new(Device {
            id: "tcp".into(),
            name: "TCP framing test".into(),
            connection: Connection::Visca {
                address: "127.0.0.1".into(),
                port,
                framing: Framing::RawTcp,
                pan_limit: 32767,
                tilt_limit: 32767,
                zoom_limit: 16384,
            },
            ndi_source: None,
        });
        adapter
            .execute(&Command::Zoom { position: 256 })
            .await
            .unwrap();
        assert_eq!(
            adapter.snapshot().await.camera,
            Some(CameraState {
                pan: 1,
                tilt: 2,
                zoom: 256
            })
        );
        server.await.unwrap();
    }
}
