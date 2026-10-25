//! Small ATEM network adapter for M/E 0 and upstream keyer 0.
//! Wire layouts are documented in docs/protocol-notes.md. State comes only from
//! switcher messages. Commands are acknowledged at the transport layer, not at
//! physical transition completion. Never replay a command across a new session.
use crate::adapter::Adapter;
use async_trait::async_trait;
use control_core::*;
use std::{collections::HashMap, net::SocketAddr, sync::Arc, time::Duration};
use tokio::{
    net::UdpSocket,
    sync::{RwLock, mpsc, oneshot},
    time::Instant,
};
use tokio_util::sync::CancellationToken;

const MODULUS: u16 = 0x8000;
const HELLO: [u8; 20] = [
    0x10, 0x14, 0x53, 0xab, 0, 0, 0, 0, 0, 0x3a, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0,
];
fn error(message: impl std::fmt::Display) -> Error {
    Error::Device(format!("ATEM: {message}"))
}
fn u16_at(bytes: &[u8], offset: usize) -> u16 {
    u16::from_be_bytes([bytes[offset], bytes[offset + 1]])
}
fn u32_at(bytes: &[u8], offset: usize) -> u32 {
    u32::from_be_bytes(bytes[offset..offset + 4].try_into().unwrap())
}
fn packet(flags: u16, session: u16, sequence: u16, payload: &[u8]) -> Vec<u8> {
    let mut result = vec![0; 12];
    result[..2].copy_from_slice(&((flags << 11) | (12 + payload.len()) as u16).to_be_bytes());
    result[2..4].copy_from_slice(&session.to_be_bytes());
    result[10..12].copy_from_slice(&sequence.to_be_bytes());
    result.extend(payload);
    result
}
fn block(name: &[u8; 4], payload: &[u8]) -> Vec<u8> {
    let mut result = vec![0; 8];
    result[..2].copy_from_slice(&((payload.len() + 8) as u16).to_be_bytes());
    result[4..8].copy_from_slice(name);
    result.extend(payload);
    result
}
fn encode(command: &Command) -> Result<Vec<u8>> {
    Ok(match command {
        Command::SetProgram { input } | Command::SetPreview { input } => {
            let mut payload = [0; 4];
            payload[2..4].copy_from_slice(&input.to_be_bytes());
            block(
                if matches!(command, Command::SetProgram { .. }) {
                    b"CPgI"
                } else {
                    b"CPvI"
                },
                &payload,
            )
        }
        Command::Cut => block(b"DCut", &[0; 4]),
        Command::Auto => block(b"DAut", &[0; 4]),
        Command::SetInputName {
            input,
            long_name,
            short_name,
        } => {
            let mut payload = [0; 32];
            payload[0] = 3;
            payload[2..4].copy_from_slice(&input.to_be_bytes());
            payload[4..4 + long_name.len()].copy_from_slice(long_name.as_bytes());
            payload[24..24 + short_name.len()].copy_from_slice(short_name.as_bytes());
            block(b"CInL", &payload)
        }
        Command::SetPip {
            enabled,
            source,
            x,
            y,
            size,
        } => {
            // Configure before on-air. Deliberately do not key off an already
            // on-air source while changing its position.
            let mut result = block(b"CKTp", &[1, 0, 0, 3, 0, 0, 0, 0]);
            let mut fill = [0; 4];
            fill[2..4].copy_from_slice(&source.to_be_bytes());
            result.extend(block(b"CKeF", &fill));
            let mut dve = [0; 64];
            dve[..4].copy_from_slice(&15u32.to_be_bytes());
            let size = (*size * 1000.0).round() as u32;
            dve[8..12].copy_from_slice(&size.to_be_bytes());
            dve[12..16].copy_from_slice(&size.to_be_bytes());
            dve[16..20].copy_from_slice(&((*x * 1000.0).round() as i32).to_be_bytes());
            dve[20..24].copy_from_slice(&((*y * 1000.0).round() as i32).to_be_bytes());
            result.extend(block(b"CKDV", &dve));
            result.extend(block(b"CKOn", &[0, 0, u8::from(*enabled), 0]));
            result
        }
        _ => return Err(error("Unsupported switcher command")),
    })
}
struct Request {
    command: Command,
    reply: oneshot::Sender<Result<()>>,
}
struct Pending {
    sequence: u16,
    bytes: Vec<u8>,
    reply: oneshot::Sender<Result<()>>,
    sent: Instant,
    retries: u8,
}
pub struct Atem {
    sender: mpsc::Sender<Request>,
    state: Arc<RwLock<DeviceState>>,
    stop: CancellationToken,
}
impl Atem {
    pub fn new(device: &Device) -> Self {
        let Connection::Atem { address } = &device.connection else {
            unreachable!()
        };
        let address = SocketAddr::new(address.parse().expect("validated device IP"), 9910);
        Self::start(device.id.clone(), address)
    }
    fn start(id: String, address: SocketAddr) -> Self {
        let state = Arc::new(RwLock::new(DeviceState {
            device_id: id,
            status: ConnectionStatus::Disconnected,
            feedback: Feedback::Unknown,
            error: Some("Connecting and synchronizing switcher state…".into()),
            switcher: None,
            camera: None,
        }));
        let (sender, mut receiver) = mpsc::channel::<Request>(16);
        let stop = CancellationToken::new();
        let task_state = state.clone();
        let task_stop = stop.clone();
        tokio::spawn(async move {
            let mut backoff = 1;
            loop {
                let result = serve(address, &task_state, &mut receiver, &task_stop).await;
                if task_stop.is_cancelled() || receiver.is_closed() {
                    break;
                }
                {
                    let mut state = task_state.write().await;
                    state.status = ConnectionStatus::Disconnected;
                    state.feedback = Feedback::Unknown;
                    state.switcher = None;
                    state.error = Some(
                        result
                            .err()
                            .map(|e| e.to_string())
                            .unwrap_or_else(|| "Disconnected".into()),
                    );
                }
                while let Ok(request) = receiver.try_recv() {
                    let _ = request
                        .reply
                        .send(Err(error("Connection lost; queued command discarded")));
                }
                tokio::select! { _ = task_stop.cancelled() => break, _ = tokio::time::sleep(Duration::from_secs(backoff)) => {} }
                backoff = (backoff * 2).min(15);
            }
            let mut state = task_state.write().await;
            state.status = ConnectionStatus::Disconnected;
            state.feedback = Feedback::Unknown;
            state.switcher = None;
        });
        Self {
            sender,
            state,
            stop,
        }
    }
}
impl Drop for Atem {
    fn drop(&mut self) {
        self.stop.cancel();
    }
}
#[async_trait]
impl Adapter for Atem {
    async fn execute(&self, command: &Command) -> Result<()> {
        if self.state.read().await.status != ConnectionStatus::Connected {
            return Err(error(
                "Switcher has not synchronized; wait for connection before sending commands",
            ));
        }
        let (tx, rx) = oneshot::channel();
        self.sender
            .try_send(Request {
                command: command.clone(),
                reply: tx,
            })
            .map_err(|_| error("Device queue is full or closed"))?;
        rx.await
            .map_err(|_| error("Connection ended; command may have executed"))?
    }
    async fn snapshot(&self) -> DeviceState {
        self.state.read().await.clone()
    }
    async fn close(&self) -> Result<()> {
        self.stop.cancel();
        Ok(())
    }
}

struct Received {
    switcher: SwitcherState,
    initialized: bool,
    program: bool,
    preview: bool,
    dve: bool,
}
impl Received {
    fn new() -> Self {
        Self {
            switcher: SwitcherState {
                program: 0,
                preview: 0,
                inputs: vec![],
                pip: SwitcherState::default().pip,
            },
            initialized: false,
            program: false,
            preview: false,
            dve: false,
        }
    }
    fn apply(&mut self, payload: &[u8]) -> Result<()> {
        let mut offset = 0;
        while offset < payload.len() {
            if payload.len() - offset < 8 {
                return Err(error("Truncated command block"));
            }
            let length = u16_at(payload, offset) as usize;
            if length < 8 || offset + length > payload.len() {
                return Err(error("Invalid command length"));
            }
            let name = &payload[offset + 4..offset + 8];
            let data = &payload[offset + 8..offset + length];
            match name {
                b"InCm" => self.initialized = true,
                b"PrgI" | b"PrvI" if data.len() >= 4 && data[0] == 0 => {
                    if name == b"PrgI" {
                        self.switcher.program = u16_at(data, 2);
                        self.program = true;
                    } else {
                        self.switcher.preview = u16_at(data, 2);
                        self.preview = true;
                    }
                }
                b"InPr" if data.len() >= 26 => {
                    let input = Input {
                        id: u16_at(data, 0),
                        long_name: text(&data[2..22]),
                        short_name: text(&data[22..26]),
                    };
                    if let Some(existing) =
                        self.switcher.inputs.iter_mut().find(|i| i.id == input.id)
                    {
                        *existing = input;
                    } else {
                        self.switcher.inputs.push(input);
                        self.switcher.inputs.sort_by_key(|i| i.id);
                    }
                }
                b"KeOn" if data.len() >= 3 && data[..2] == [0, 0] => {
                    self.switcher.pip.enabled = data[2] != 0
                }
                b"KeBP" if data.len() >= 8 && data[..2] == [0, 0] => {
                    self.switcher.pip.source = u16_at(data, 6)
                }
                b"KeDV" if data.len() >= 20 && data[..2] == [0, 0] => {
                    self.dve = true;
                    self.switcher.pip.size = u32_at(data, 4) as f64 / 1000.0;
                    self.switcher.pip.x = (u32_at(data, 12) as i32) as f64 / 1000.0;
                    self.switcher.pip.y = (u32_at(data, 16) as i32) as f64 / 1000.0;
                }
                _ => {}
            }
            offset += length;
        }
        Ok(())
    }
    fn ready(&self) -> bool {
        self.initialized && self.program && self.preview
    }
}
fn text(bytes: &[u8]) -> String {
    String::from_utf8_lossy(&bytes[..bytes.iter().position(|b| *b == 0).unwrap_or(bytes.len())])
        .into_owned()
}
fn covered(ack: u16, sequence: u16) -> bool {
    ack.wrapping_sub(sequence) & (MODULUS - 1) < MODULUS / 2
}
async fn acknowledge(socket: &UdpSocket, session: u16, sequence: u16) -> Result<()> {
    let mut bytes = packet(16, session, 0, &[]);
    bytes[4..6].copy_from_slice(&sequence.to_be_bytes());
    socket.send(&bytes).await.map_err(error)?;
    Ok(())
}
async fn serve(
    address: SocketAddr,
    state: &RwLock<DeviceState>,
    requests: &mut mpsc::Receiver<Request>,
    stop: &CancellationToken,
) -> Result<()> {
    let socket = UdpSocket::bind(if address.is_ipv4() {
        "0.0.0.0:0"
    } else {
        "[::]:0"
    })
    .await
    .map_err(error)?;
    socket.connect(address).await.map_err(error)?;
    socket.send(&HELLO).await.map_err(error)?;
    let mut buffer = [0u8; 2048];
    let mut session = None;
    let mut remote_sequence = 0;
    let mut sequence = 1;
    let mut pending: Option<Pending> = None;
    let mut received = Received::new();
    let mut out_of_order = HashMap::<u16, Vec<u8>>::new();
    let mut gap_since = None;
    let mut last_received = Instant::now();
    let started = Instant::now();
    let mut timer = tokio::time::interval(Duration::from_millis(50));
    loop {
        tokio::select! {
            biased;
            _ = stop.cancelled() => return Ok(()),
            packet_size = socket.recv(&mut buffer) => {
                let length = packet_size.map_err(error)?;
                if length < 12 || usize::from(u16_at(&buffer, 0) & 0x7ff) != length { return Err(error("Invalid packet header")); }
                let flags = u16_at(&buffer, 0) >> 11; let packet_session = u16_at(&buffer, 2); let remote_id = u16_at(&buffer, 10);
                if flags & 2 != 0 {
                    if session.is_some() { return Err(error("Switcher requested a new session; in-flight command outcome is unknown")); }
                    session = Some(packet_session); remote_sequence = remote_id;
                    acknowledge(&socket, packet_session, remote_id).await?; last_received = Instant::now(); continue;
                }
                let Some(session_id) = session else { continue; };
                if session_id != packet_session { continue; }
                last_received = Instant::now();
                if flags & 8 != 0 {
                    let requested = u16_at(&buffer, 6) % MODULUS;
                    if let Some(sent) = pending.as_mut().filter(|p| p.sequence == requested) {
                        if sent.retries >= 10 { return Err(error("Retransmission limit reached; command outcome unknown")); }
                        socket.send(&sent.bytes).await.map_err(error)?; sent.retries += 1; sent.sent = Instant::now();
                    } else { return Err(error("Switcher requested a packet outside the current send window")); }
                }
                if flags & 1 != 0 {
                    if remote_id >= MODULUS { return Err(error("Invalid remote packet sequence")); }
                    let distance = remote_id.wrapping_sub(remote_sequence) & (MODULUS-1);
                    if distance == 1 {
                        received.apply(&buffer[12..length])?; remote_sequence = remote_id;
                        while let Some(payload) = out_of_order.remove(&((remote_sequence + 1) % MODULUS)) { remote_sequence = (remote_sequence + 1) % MODULUS; received.apply(&payload)?; }
                        gap_since = if out_of_order.is_empty() { None } else { Some(Instant::now()) };
                    } else if distance > 1 && distance <= 256 {
                        out_of_order.entry(remote_id).or_insert_with(|| buffer[12..length].to_vec());
                        if gap_since.is_none() { gap_since = Some(Instant::now()); }
                        let mut resend = packet(8, session_id, 0, &[]); resend[6..8].copy_from_slice(&((remote_sequence+1)%MODULUS).to_be_bytes()); socket.send(&resend).await.map_err(error)?;
                    } else if distance < MODULUS / 2 { return Err(error("Inbound packet gap exceeds receive window")); }
                    acknowledge(&socket, session_id, remote_sequence).await?;
                    if received.ready() {
                        let mut current = state.write().await;
                        current.status = ConnectionStatus::Connected; current.feedback = Feedback::Observed; current.error = None; current.switcher = Some(received.switcher.clone());
                    }
                }
                if flags & 16 != 0 && pending.as_ref().is_some_and(|p| covered(u16_at(&buffer, 4), p.sequence))
                    && let Some(sent) = pending.take() { let _ = sent.reply.send(Ok(())); }
            }
            request = requests.recv(), if pending.is_none() => {
                let Some(request) = request else { return Ok(()); };
                if request.reply.is_closed() { continue; }
                if !received.ready() { let _ = request.reply.send(Err(error("Switcher is not synchronized"))); continue; }
                if matches!(request.command, Command::SetPip { .. }) && !received.dve { let _ = request.reply.send(Err(error("No DVE keyer was reported by this switcher"))); continue; }
                let payload = match encode(&request.command) { Ok(payload) => payload, Err(e) => { let _ = request.reply.send(Err(e)); continue; } };
                let bytes = packet(1, session.unwrap(), sequence, &payload);
                socket.send(&bytes).await.map_err(error)?;
                pending = Some(Pending { sequence, bytes, reply: request.reply, sent: Instant::now(), retries: 0 }); sequence = (sequence+1)%MODULUS;
            }
            _ = timer.tick() => {
                if last_received.elapsed() > Duration::from_secs(5) || (!received.ready() && started.elapsed() > Duration::from_secs(10)) || gap_since.is_some_and(|since| since.elapsed() > Duration::from_secs(5)) { return Err(error("Connection or state synchronization timed out; command outcome may be unknown")); }
                if let Some(sent) = pending.as_mut()
                    && sent.sent.elapsed() > Duration::from_millis(100) {
                        if sent.retries >= 10 { return Err(error("Command was not acknowledged; check switcher state before retrying")); }
                        // Same session and same sequence: ATEM deduplicates these
                        // protocol retransmissions, including cut/auto commands.
                        socket.send(&sent.bytes).await.map_err(error)?; sent.retries += 1; sent.sent = Instant::now();
                    }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn packet_sequences_wrap_and_malformed_commands_are_rejected() {
        assert!(covered(0, 32767));
        assert!(!covered(32767, 0));
        let mut received = Received::new();
        assert!(received.apply(&[0, 0, 0]).is_err());
        assert!(received.apply(&[0, 1, 0, 0, 0, 0, 0, 0]).is_err());
        let bytes = encode(&Command::SetPreview { input: 4 }).unwrap();
        assert_eq!(&bytes[4..8], b"CPvI");
        assert_eq!(&bytes[10..12], &[0, 4]);
    }
    #[test]
    fn pip_configuration_precedes_on_air() {
        let payload = encode(&Command::SetPip {
            enabled: true,
            source: 2,
            x: -3.0,
            y: 2.0,
            size: 0.25,
        })
        .unwrap();
        let mut names = vec![];
        let mut offset = 0;
        while offset < payload.len() {
            names.push(&payload[offset + 4..offset + 8]);
            offset += u16_at(&payload, offset) as usize;
        }
        assert_eq!(names, vec![b"CKTp", b"CKeF", b"CKDV", b"CKOn"]);
    }
    #[tokio::test]
    async fn loopback_handshake_orders_state_and_acknowledges_a_cut() {
        let fake = UdpSocket::bind("127.0.0.1:0").await.unwrap();
        let address = fake.local_addr().unwrap();
        let server = tokio::spawn(async move {
            let mut bytes = [0; 2048];
            let (length, peer) = fake.recv_from(&mut bytes).await.unwrap();
            assert_eq!(&bytes[..length], &HELLO);
            fake.send_to(&packet(2, 0x1234, 0, &[]), peer)
                .await
                .unwrap();
            fake.recv_from(&mut bytes).await.unwrap();
            let second = block(b"PrvI", &[0, 0, 0, 2]);
            // Deliberately out of order; InCm must not publish incomplete state.
            fake.send_to(&packet(1, 0x1234, 2, &second), peer)
                .await
                .unwrap();
            let first = block(b"PrgI", &[0, 0, 0, 1]);
            fake.send_to(&packet(1, 0x1234, 1, &first), peer)
                .await
                .unwrap();
            fake.send_to(&packet(1, 0x1234, 3, &block(b"InCm", &[])), peer)
                .await
                .unwrap();
            loop {
                let (length, _) = fake.recv_from(&mut bytes).await.unwrap();
                if length > 12 && &bytes[16..20] == b"DCut" {
                    let mut ack = packet(16, 0x1234, 0, &[]);
                    ack[4..6].copy_from_slice(&bytes[10..12]);
                    fake.send_to(&ack, peer).await.unwrap();
                    break;
                }
            }
        });
        let adapter = Atem::start("loopback".into(), address);
        tokio::time::timeout(Duration::from_secs(2), async {
            loop {
                if adapter.snapshot().await.status == ConnectionStatus::Connected {
                    break;
                }
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();
        let state = adapter.snapshot().await.switcher.unwrap();
        assert_eq!((state.program, state.preview), (1, 2));
        adapter.execute(&Command::Cut).await.unwrap();
        adapter.close().await.unwrap();
        server.await.unwrap();
    }
}
