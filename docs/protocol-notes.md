# Protocol adapters and validation boundaries

The Rust adapters are isolated in `crates/control-runtime/src/atem.rs` and `visca.rs`. No Node sidecar or proprietary SDK is needed for these initial transports. They remain experimental until tested on the actual hardware.

## ATEM

The implementation targets the UDP network protocol on port 9910. Wire layouts were checked against the maintained [Sofie ATEM connection transport](https://github.com/sofie-automation/sofie-atem-connection/blob/master/src/lib/atemSocketChild.ts) and its command definitions. The alternative `petersimonsson/atem-rs` source inspected during discovery exposed receive/event handling without a writable command API, so it was not selected.

Packets use a 12-byte header, an 11-bit datagram length, flags in the high five bits, session IDs and 15-bit sequence numbers. Outbound commands are serialized through a bounded queue. Same-session retries retain the same packet ID; this is protocol retransmission, not a new cut/auto invocation. Pending and queued commands are discarded on session loss, with their outcome reported as potentially unknown. Reconnect synchronizes state without replaying stale commands.

Incoming state packets are ordered, duplicates are acknowledged again, gaps are bounded to 256 packets and a stalled gap ends the session. The UI receives switcher state only after `InCm`, `PrgI` and `PrvI` have arrived. Unsupported command blocks are ignored; malformed framing fails the session.

Implemented command blocks: `CPgI`, `CPvI`, `DCut`, `DAut`, `CInL`, `CKTp`, `CKeF`, `CKDV`, `CKOn`. PiP sends keyer type, source and transform before its on-air setting. M/E and keyer indices are zero. State readback uses `PrgI`, `PrvI`, `InPr`, `KeBP`, `KeDV` and `KeOn`.

Successful execution means acknowledgment of the transport packet. It does not verify that a transition has finished or establish full model compatibility. There is no automatic capability fallback. PiP is rejected when no DVE settings were reported. Firmware-specific input availability and keyer transition behavior remain hardware acceptance work.

## VISCA-IP

The explicit profile chooses Sony framed UDP, raw UDP or raw TCP. All use camera address 1 (`0x81`). Raw TCP responses are buffered and split at VISCA terminators. Sony UDP responses are checked against their payload length, response type and sequence. A new Sony UDP session performs a sequence reset. There are no movement retries or automatic protocol changes.

Commands use absolute signed 16-bit pan/tilt positions and unsigned zoom positions encoded in nibbles. ACK and completion are distinct; command errors reject execution. Position inquiries establish observed feedback after a command. Missing/invalid feedback never becomes position zero.

Movement completion may take longer than an ACK; macro deadlines remain explicit. A manual operation has a 30-second application deadline. Cancellation invalidates its session to prevent a late response from completing a future command. Stop interrupts the active wait, discards stale queued work, and sends both pan/tilt-stop and zoom-stop. Shutdown and macro failure attempt a bounded best-effort stop.

The adapter has no background inquiries, speed joystick control, vendor image adjustments or NDI support. Real-device tests must cover framing, coordinate limits, signed position representation, command completion, stop, loss of network, sequence reset and competing controllers.

## Automated checks

- A local UDP switcher verifies handshake, out-of-order state delivery, synchronization and cut acknowledgment.
- Packet tests cover sequence wrap, malformed block rejection and PiP command ordering.
- A local UDP camera verifies position inquiry parsing and observed state.
- A stop test withholds movement completion to verify that stop interrupts rather than waiting for the movement timeout.
- Macro tests cover order, timing, cancellation, timeout failure, exclusive execution and preflight of disconnected devices.

These tests establish implementation behavior against controlled peers. They do not replace physical hardware tests or native platform acceptance.
