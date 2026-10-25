# Rust migration: discovery and implementation plan

Discovery date: 25 October 2026. Status: Tauri + React selected; initial implementation is available. See [implementation status](implementation-status.md) for completed work and outstanding acceptance gates. The phases below preserve the original discovery plan.

## Recommended direction

Build a local desktop application using Tauri 2, a Rust application core, and a modernized React/TypeScript interface. Ship macOS (Apple Silicon and Intel, subject to dependency validation) and Windows x64 installers. Move device networking, state, persistence, command validation, and macro execution into Rust. React remains the presentation layer; this is not an entirely Rust UI. If an entirely Rust codebase is required, evaluate egui/iced in the first phase before committing to the desktop shell.

Use SQLite instead of requiring PostgreSQL and a separate Node server. Keep the Rust core independent of Tauri so a headless service or browser control interface can be added later. Start with ATEM plus VISCA-IP parity; add optional NDI® discovery and control after the core is reliable.

## What exists today

| Area | Observed implementation | Migration requirement |
| --- | --- | --- |
| Desktop/UI | React 17, Create React App, Material UI 4; browser application | Modernize React tooling and host in desktop shell |
| Backend | NestJS 7, Socket.IO 2, TypeORM, PostgreSQL | Rust services, typed desktop commands/events, SQLite |
| ATEM | `atem-connection` 2.x; program/preview, cut, auto transition, input naming, upstream DVE/PiP | Preserve working commands and authoritative switcher state |
| Camera | `sony-visca-connection` Git fork; BirdDog device wrapper; pan/tilt and zoom inquiries every 300 ms | Model-specific VISCA transport/profile, validated coordinates and polling |
| Camera presets | Stored as application macros containing absolute pan/tilt and zoom | Preserve separately from camera-native preset slots |
| Macros | CRUD, device default and per-step target, command properties, stored order/delay | Typed steps, explicit execution semantics, progress and cancellation |
| Shortcuts | Persisted page/slot layout with drag/drop macro assignment | Preserve pages, slots and macro references |
| Livestream | Empty client page, entity, module excluded from app; restreamer Docker configuration | Treat streaming/encoding as separate future scope |
| Local VISCA package | `visca-ip/` contains unfinished socket/receive/connect logic | Reference only; active server uses external VISCA fork |

Primary code references: `atem-server/src/core/devices/`, `atem-server/src/core/actions/`, `atem-server/src/macros/`, `atem-server/src/shortcuts/`, `atem-server/src/database/database.module.ts`, `atem-client/src/core/SocketContext.tsx`, `atem-client/src/containers/Camera/Camera.tsx`, and `atem-client/src/components/CameraControlSimple.tsx`.

### Issues to address during migration

- Macro execution uses `Promise.all`, ignoring stored `order` and `delay`. Existing macros therefore behave as concurrent groups, despite the editor suggesting a sequence. Import must explicitly retain that legacy behavior or require a reviewed conversion; silently making all existing macros sequential changes operation.
- Device cleanup uses `Object.keys` on a `Map`, so removed-device detection does not enumerate connection IDs correctly. Camera `destroy()` throws; reconnect happens on a five-minute schedule. Replace these with owned connection tasks and prompt bounded reconnect.
- Camera polling can overlap and lacks a surrounding error-handling boundary. State contains an unexplained special-case rejection of zoom value 15. Validate this against actual camera firmware before carrying it forward.
- Camera movement uses raw positions and a fixed zoom-to-magnification conversion. Coordinate ranges and optical zoom belong to model profiles; missing feedback must not become position zero.
- PiP's optional-value tests convert `undefined` to a nonempty string. The replacement must distinguish absent properties from explicit values and apply configuration before enabling the keyer.
- Unknown actions fall through to a throwing placeholder. Macro/shortcut recall actions are placeholders. Reject unsupported commands before execution.
- The client references missing `../atem-lib`; the checked-in tree cannot be assumed to install cleanly. Existing tests appear largely scaffolding; they do not establish hardware or macro correctness.
- A hardcoded camera instance exists in the macro gateway. Device addresses must come exclusively from saved device configuration.

Discovery was static source inspection and documentation research. No hardware connections, existing application execution, or macOS/Windows builds were performed. A deployed database/export was not available in this checkout.

## Protocol and dependency findings

### ATEM

`atem-connection` is the existing behavioral reference. Rust candidates include [atem-rs](https://github.com/petersimonsson/atem-rs) and the [oximedia-switcher ATEM protocol module](https://docs.rs/oximedia-switcher/latest/oximedia_switcher/atem_protocol/index.html). Documentation and existence do not prove complete ATEM Mini compatibility. Do not select a crate on that basis alone.

First validate handshake, initial state synchronization, acknowledgments, resend/order handling, reconnect, and the complete required command set, particularly DVE/PiP. Select a reusable Rust implementation if it passes. Otherwise implement the necessary protocol subset in an isolated crate using captured fixtures and the existing library as reference, checking reuse licenses. Do not make a permanent Node sidecar the target architecture. If needed, the official Blackmagic SDK is another candidate to investigate for platform support and distribution terms; it was not evaluated here.

### VISCA-IP

[grafton-visca](https://docs.rs/grafton-visca/latest/grafton_visca/) is a promising pure Rust candidate with async operation, camera profiles, inquiries, and TCP/UDP transport options. Pin a tested release after inspecting the actual camera profile and transport implementation; documentation retrieval showed differing cached versions, so this plan intentionally does not prescribe an exact version.

VISCA-IP implementations vary: Sony-style UDP framing and raw VISCA over TCP/UDP are separate configurations. Store port, framing, camera address, coordinate limits and timeout policy in a camera profile. Confirm the current BirdDog model and firmware rather than assuming a generic Sony profile matches it. Build only the missing functionality behind our adapter.

### NDI: what it adds and what it does not guarantee

The [NDI receiver API](https://docs.ndi.video/all/developing-with-ndi/sdk/ndi-recv) documents discovery-associated receiver control for PTZ, native presets, focus, white balance and exposure. It also provides a PTZ-support flag and an optional camera web-control URL. Camera support still needs hardware validation; the broad PTZ-support flag is not proof that every individual control works.

| Control | NDI standard receiver API | Application approach |
| --- | --- | --- |
| Pan/tilt/zoom | Absolute and speed controls | Optional alternative to VISCA, chosen per camera |
| Presets | Camera-native store/recall | Keep native slots distinct from application position snapshots |
| Focus | Auto/manual and speed | Enable when verified for the camera |
| White balance | Auto, indoor, outdoor, one-shot, manual red/blue | Expose supported modes only |
| Exposure | Auto/manual iris, gain and shutter | Preserve camera mode/range constraints |
| Brightness/contrast | No generic controls in the documented receiver PTZ API | Check model-specific VISCA commands/vendor API; offer camera web UI when available |
| Current position/settled feedback | Not guaranteed by the control API | Track commanded versus observed state; use VISCA feedback where available |
| Live video | Available through receiver/media APIs, with format/runtime constraints | Separate optional preview work from control integration |

VISCA may already expose image controls on a particular model; NDI is not a prerequisite. Adjusting a local NDI preview does not change the camera HDMI image going to the ATEM. Any requested brightness/contrast control must operate on the camera itself to affect that output.

Evaluate [grafton-ndi](https://github.com/GrantSparks/grafton-ndi) behind a narrow adapter; its documented coverage includes PTZ and receiving, but requires SDK headers/tooling. Evaluate runtime loading separately so missing NDI libraries do not prevent normal ATEM/VISCA startup. The [ndi-sdk-rs alternative](https://github.com/vifino/ndi-sdk-rs) documents dynamic loading but currently says send/receive wrappers are unimplemented, so it is not the default choice.

Use the [official dynamic loading guidance](https://docs.ndi.video/all/developing-with-ndi/sdk/dynamic-loading-of-ndi-libraries). Confirm the selected SDK's actual terms and application-local runtime packaging before release; [NDI licensing](https://docs.ndi.video/all/developing-with-ndi/sdk/licensing) and [third-party notices](https://docs.ndi.video/all/developing-with-ndi/sdk/3rd-party-rights) describe distribution requirements. Do not assume the Rust wrapper license covers the proprietary runtime, or that all NDI/HX camera formats can be previewed with the same deployment.

NDI® is a registered trademark of Vizrt NDI AB.

## Proposed architecture

```text
React UI -> Tauri commands/events -> Rust application services
                                      |-- device registry and state
                                      |-- macro runner and command routing
                                      |-- SQLite persistence and import/export
                                      |-- ATEM adapter -> switcher
                                      |-- VISCA adapter -> camera
                                      `-- optional NDI adapter -> camera/source
```

Suggested workspace:

```text
crates/control-core/       IDs, commands, capabilities, state and errors
crates/control-runtime/    device tasks, routing, macro runner
crates/control-storage/    SQLite migrations, backups and legacy import
crates/protocol-atem/      selected crate integration or necessary protocol subset
crates/protocol-visca/     camera profiles and VISCA library adapter
crates/protocol-ndi/       optional SDK boundary and source discovery
apps/desktop/src-tauri/    Tauri host and IPC
apps/desktop/ui/           React interface
```

Start with a pinned Rust toolchain, Tokio, Serde, tracing, and SQLite (candidate: rusqlite with bundled SQLite on a dedicated storage worker). Select exact versions and minimum OS requirements after the platform spike. Keep blocking storage and SDK calls off the UI and async executor threads.

### Devices and state

One logical camera can have a VISCA endpoint, an NDI source association and a vendor-control endpoint. Map this camera explicitly to an ATEM input. Do not infer physical identity from IP alone or assume a camera and switcher share source numbering.

Capabilities record supported operations, ranges, units, readback availability, and the selected route. Distinguish unknown, documented and hardware-verified support. State records observed/commanded values, timestamps and connection health; an accepted command is not proof of physical movement completion.

Use a bounded queue per device with priority stop commands and coalescing for continuous joystick updates. Reconnect with bounded backoff and resynchronize state. Never replay stale movement commands after reconnect. Do not automatically retry an ambiguous cut/toggle or move over another protocol: it may already have executed.

### Macro semantics

New macros are ordered sequences with explicit parallel groups, waits, per-step deadlines and failure policy. Define a delay as a wait before its step, in milliseconds. Commands within a parallel group start together where device queues permit; conflicting commands to the same camera must be rejected or serialized explicitly.

The runner validates devices/capabilities before starting, provides run IDs and per-step progress, and defaults to stopping on failure. Cancellation stops scheduling new work and sends best-effort movement stop to affected cameras. Already executed cuts/moves cannot be rolled back. UI release, focus loss, and shutdown also stop continuous movement; a dead-man timeout handles lost input updates.

Support a movement-settled condition only where feedback can establish it; otherwise require an explicit timed wait labeled as such. Example: recall a camera preset, wait for confirmed settling (or a configured timed wait), set ATEM preview, then cut/auto.

### Data compatibility

Export existing devices, macros and shortcuts through a one-time legacy export command against the running backend/database, then import versioned JSON. Preserve IDs, references, page/slot positions, per-step target and macro default target. Camera presets retain original raw positions and their model/profile association; do not silently convert raw coordinates into NDI normalized positions.

Validate command types, references, numeric ranges and duplicate slots; produce a report and back up before transactional import. Preserve legacy parallel macro behavior using an explicit compatibility representation. Offer a reviewed conversion using stable `order` sorting and delay semantics; flag duplicate/missing order values and unknown actions. Never execute hardware commands during import.

## Implementation in five parts

### Part 1 — Prove protocols and desktop packaging

Tasks:
- Record exact ATEM model/firmware and camera model/firmware, VISCA framing/port, and NDI support.
- Create an isolated Rust workspace and simulator interfaces alongside the legacy app.
- Run small ATEM and VISCA probes with structured logs; validate all existing commands, state synchronization, disconnect and reconnect.
- Compare ATEM candidates; document the selected implementation and any protocol work needed.
- Build a minimal Tauri host on native macOS and Windows CI runners. Verify target architectures and clean-machine prerequisites.
- Perform a small optional NDI source/control/runtime-loading probe. NDI findings do not block the base application.

Exit: written dependency/platform decisions, reproducible protocol fixtures, and basic control demonstrated on actual hardware on both operating systems. If hardware is unavailable, record the unverified checks and do not claim this gate passed.

### Part 2 — Rust core, persistence and deterministic macros

Tasks:
- Implement typed commands, capability/state models and device lifecycle tasks.
- Add SQLite migrations, device/macro/shortcut CRUD, backups, versioned export/import.
- Implement sequential/parallel macro execution, deadlines, progress, cancellation and stop handling.
- Build the legacy exporter/importer with compatibility reporting.
- Test with fake adapters, paused Tokio time, malformed payloads and temporary databases.

Exit: a combined camera/switcher macro executes correctly in simulation; order, delay, failure, cancellation, legacy import, and restart persistence have meaningful automated coverage.

### Part 3 — Desktop feature parity with ATEM and VISCA

Tasks:
- Integrate production ATEM/VISCA adapters selected in Part 1.
- Build device setup and connection status, program/preview surface, cut/auto, input labels and PiP settings.
- Add camera movement/speed controls, observed position, application presets, macro editor/run progress and shortcut pages.
- Replace browser Socket.IO assumptions with typed Tauri commands/events; share generated TypeScript types where practical.
- Add a simulation mode for development and demonstrations without hardware.

Exit: a local installer runs without Node or PostgreSQL; existing core workflows work on macOS and Windows, including configuration persistence, device changes and reconnect. Validate PiP ordering and stop behavior on hardware.

### Part 4 — Optional NDI and camera image controls

Tasks:
- Integrate source discovery, explicit logical-camera association, runtime diagnostics and reconnect.
- Add verified PTZ, native presets, focus, white balance and exposure controls.
- Expose per-camera protocol selection; keep command results and readback provenance visible.
- Inspect target camera documentation for brightness/contrast via VISCA/vendor API. Implement supported controls or provide its advertised web-control link.
- Add ATEM-to-camera tally mapping where supported. Correct tally for PiP/keyer contribution rather than equating program input with every on-air source.
- Keep live preview optional and separately scoped: prototype format support, low-bandwidth receive, bounded frame buffering and renderer performance before committing to it.

Exit: the same logical camera can be controlled through configured VISCA and NDI routes; unsupported controls are explained; missing NDI runtime leaves ATEM/VISCA operational. Hardware tests distinguish standard controls from vendor extensions.

### Part 5 — Platform validation and release

Tasks:
- Run native CI checks, application tests and installer builds for macOS ARM64/x64 and Windows x64, adjusting the published matrix to validated SDK support.
- Verify app-local NDI library loading, architecture matching, notices and signing. Exercise a build without the NDI feature too.
- Test fresh-machine install/upgrade, Windows WebView2 provisioning, macOS network permissions, multiple NICs/VPNs, firewall behavior, sleep/wake and cable loss.
- Run hardware acceptance scenarios with documented firmware: switching, PiP, preset settling, multi-device macro, cancellation, device deletion and reconnection.
- Add crash/log diagnostics, migration recovery instructions and user setup documentation.
- Produce macOS signed/notarized DMG and Windows installer artifacts when signing credentials are available. Updater support is a later explicit decision.

Exit: installers tested on both platforms, known limitations recorded, existing configuration import verified, and no unverified hardware claim presented as supported.

Platform packaging reference: [Tauri distribution](https://v2.tauri.app/distribute/) and [platform prerequisites](https://v2.tauri.app/start/prerequisites/).

## Inputs needed before hardware acceptance

- Exact camera model and firmware, ATEM Mini variant and firmware, and example legacy configuration export.
- Whether “Rust based” permits the recommended React presentation layer or requires a fully Rust UI.
- Target minimum macOS/Windows versions and whether Intel Macs are required.
- Whether NDI is needed for control only or live video previews too.
- Which image adjustments are essential on the actual camera, and whether a vendor web-control link is sufficient when a native API is unavailable.

These inputs refine implementation and hardware acceptance. They do not prevent starting the workspace, simulation core and platform probes.
