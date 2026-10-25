# Migration implementation status

The selected architecture is Tauri 2 + React with an independent Rust core. iOS remains optional future work. No application logic depends on a React timer or browser connection to continue a macro.

## Implemented

| Part | Implementation | Acceptance still required |
| --- | --- | --- |
| 1: platform/protocol foundation | Cargo workspace, pinned toolchain, Tauri host/configuration/icons, macOS local-network usage text, macOS ARM64/Intel and Windows x64 CI build matrix, isolated simulator and protocol tests | Native CI execution, physical model/firmware matrix, signed installers |
| 2: application core | Typed validated commands/configuration, SQLite worker, transactional configuration writes, backups, generated TypeScript types, import/export, legacy conversion, sequential/parallel macro engine, progress, deadline and cancellation behavior | Test a real legacy database export and model-specific coordinate profiles |
| 3: desktop workflows | React/Vite surface, camera control/presets, structured macro editor, reorderable steps, explicit parallel groups, shortcut assignment, device setup, workspace review/import, Rust development host | Native webview behavior on macOS/Windows; physical ATEM/VISCA acceptance |
| 3: protocol adapters | ATEM initial synchronization, 15-bit sequencing, acknowledgments, bounded same-session retransmission, out-of-order buffering, reconnect, switching/labels/PiP; VISCA Sony framed UDP/raw UDP/raw TCP, ACK/completion parsing, inquiries, cancellation/stop | Firmware compatibility, packet loss/network interruption on real devices, simultaneous external controller behavior |
| 4: NDI/image controls | Runtime-loaded NDI (no SDK needed to build), source discovery, per-camera source, low-bandwidth JPEG preview in the framing canvas, NDI PTZ capability reporting | Runtime packaging and licence notices, Windows/Linux runtime checks, NDI PTZ commands (presets, focus, exposure, white balance), camera-specific image controls |
| 5: release | Reproducible lockfiles, CI definitions, platform icon formats and build instructions | Clean-machine installers, signing/notarization, network permissions, sleep/wake, hardware test results |

This is an initial working migration, not a declaration that all five phases have passed their acceptance gates. The legacy application remains available while hardware and native platform acceptance are completed.

Direct PostgreSQL import is now available in Workspace, using the `docker` branch's published port/database and table schema. It previews a read-only snapshot and uses the existing backup-and-replace flow. Connection fields include schema selection and optional verified TLS; credentials are transient. It has been tested against a disposable PostgreSQL 17.6 instance with a SELECT-only account. `make run` starts the native host and `make dev` starts the shared Rust/browser preview with process cleanup.

The control surface now uses shadcn/ui, Tailwind 4 and Lucide icons. Shortcut pagination appears below the grid. The PTZ panel includes horizontal pan/zoom sliders, a vertical tilt slider, and a canvas that distinguishes draft targets from readback. Slider/canvas changes are applied explicitly; schematic zoom size does not claim calibrated optical FOV. The macOS bundle now requires 13.3 for the modern WebKit styling requirements. See [UI notes](ui.md).

## Deliberate initial limits

- ATEM uses M/E 0 and upstream keyer 0. There is no audio mixer, media-pool management, transition-style editor, streaming encoder or switcher-native macro management.
- Simulator auto transitions complete immediately; hardware state is updated only by received switcher messages. An ACK completes a macro action, so use an explicit wait when the next action depends on a completed transition.
- Camera movement uses absolute positions, not continuous joystick velocity. There is no background camera polling. Use Read position for fresh readback after another controller changes the camera.
- Camera profiles currently expose symmetric signed pan/tilt limits, zoom limit and framing/port. Camera address is fixed to VISCA address 1. Models requiring additional headers, asymmetric limits, authentication, or vendor-specific commands need a profile extension.
- Sony UDP session creation sends a sequence reset. Its interaction with another controller must be tested on the target camera.
- The application runs one macro at a time and gates ordinary manual commands/configuration edits during a run. Stop and cancellation bypass that restriction. Hardware actions already sent cannot be rolled back.
- New parallel groups target distinct devices. Imported legacy groups allow multiple actions to one device, but transport serialization can change their physical overlap. The import review explains that limitation.
- Legacy actions that cannot be faithfully mapped are rejected. Nothing is silently discarded. See `legacy-migration.md`.
- The development HTTP server is loopback-only. It is not the proposed iPad remote API and should not be exposed on the LAN.
- Native app build/signing and iOS runtime/lifecycle handling need their own platform validation. Linux GUI execution currently requires WebKitGTK dependencies absent from the development environment.

## Next acceptance work

1. Run the native CI matrix and launch the app on an actual Mac and Windows machine.
2. Record the camera and ATEM models/firmware. Verify framing/limits against their manuals.
3. Validate switcher state, cut/auto/PiP, raw camera positions, movement completion, stop, unplug/reconnect and mixed-device macros on that hardware.
4. Export the real legacy configuration, review conversion results, and address unsupported legacy commands.
5. Integrate optional NDI after the ATEM/VISCA acceptance work, using the camera capability matrix from the discovery plan.
