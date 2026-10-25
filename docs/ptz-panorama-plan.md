# Plan: PTZ panorama map, live position overlay and soft limits

Status: **implemented** and verified on a BirdDog P100 over a VPN, with the recommended answers to the open questions: limits keep the visible frame inside a rectangle, scans use the widest zoom, panoramas stay on each machine, and there is no on-air block yet.

What changed from the draft once the hardware was measured:

- The P100 never sends VISCA completion, so motion end comes from position polling (every 150 ms), which also drives the live map.
- Stills use the low-bandwidth NDI stream (640×360): the full stream stalled over the VPN. Frames are taken once two consecutive frames match, not after a fixed delay.
- Calibration measures zoomed-in levels at the most detailed spot in the wide view; plain walls cannot be measured. Result on the P100: 59.8° → 7.0° horizontal, 9.4× (10× nominal).
- Scans discover the real limits from moves that stop short (this P100 tilts only about ±30°), skip unreachable grid points, crop to what was captured, and save the discovered range. 40 frames, about 2 minutes.
- The P100 stops one unit short of targets, so restores aim past by the miss once; the camera returns to its exact start.
- Lost inquiries are retried (Sony framing only), and jobs retry absolute moves, which are idempotent; manual moves are never retried.

Remaining: per-tile brightness matching at seams, polygon limits, optional camera-side VISCA limits, and an on-air check.

## Goal

For a camera that has both VISCA control and an NDI® source (the "hybrid" profile, e.g. the BirdDog P100):

1. **Scan** — one button sweeps the camera across its range, captures frames and stitches a panorama of everything it can see, then returns the camera to the exact pan/tilt/zoom it started at.
2. **Overlay** — the PTZ map shows the panorama as its background, a box for what the camera currently sees (with the live NDI feed inside it), and a box for the desired target.
3. **Animated transition** — when a move is sent, the "current" box travels smoothly towards the target box, tracking the real camera.
4. **Soft limits** — draw an allowed region on the panorama; the application refuses or clamps any move that would show something outside it.

## Why hybrid

Testing on the P100 established:

| Need | VISCA | NDI |
| --- | --- | --- |
| Absolute pan/tilt | Yes | Ignored by the P100 |
| Absolute zoom | Yes | Yes (0.0 = wide on the P100, opposite to the SDK comment) |
| Position readback | Yes (inquiries) | No standard API; the P100 sends no position metadata |
| Video | No | Yes (low-bandwidth 640×360, or full resolution) |

So VISCA provides movement and truth about position; NDI provides pixels. Every feature below requires both. NDI-only cameras keep the existing simple control and are out of scope here.

## The core problem: mapping pixels to camera coordinates

Everything (stitching, the "what it sees" box, soft limits) depends on knowing how big the camera's field of view (FOV) is, in VISCA pan/tilt units, at a given zoom. The current canvas uses a schematic guess. This plan replaces it with a **measured calibration**:

- **Units per degree / direction**: confirm on the P100 which VISCA pan/tilt values correspond to which directions, and the usable range (read back after moving to known positions; cross-check against the P100 VISCA documentation). Stored in the camera profile, replacing the current symmetric ±32767 defaults.
- **FOV versus zoom**: at several zoom positions (e.g. 8 steps from wide to tele), pan by a small known amount, capture before/after frames and measure the image shift by cross-correlation. `shift_pixels / pan_units` gives pixels per unit at that zoom, hence FOV in units. Same for tilt. The result is a small table; FOV at other zoom values is interpolated. Zoom-to-FOV is strongly non-linear, which is why it must be measured rather than assumed.
- Projection: each tile pixel is converted to a pan/tilt offset with a pinhole model (`atan((x − cx) / f)`, `f` from the measured FOV), so the panorama is stored in **pan/tilt unit space** (x = pan, y = tilt). Lens distortion at the wide end is not modelled in the first version; it causes small seams but does not affect control accuracy much.

Calibration runs automatically as the first part of the first scan, and can be re-run on its own. It moves the camera, so the same "restore position afterwards" rule applies.

## Phases

### Phase 0 — Hardware facts (short, needs the camera)

- Switch the BirdDog back to VISCA + NDI and confirm VISCA works on the P100: framing (Sony UDP 52381), position readback, completion messages.
- Confirm the camera answers **position inquiries while it is moving**. This decides how animation works (Phase 2).
- Record the real pan/tilt/zoom ranges and direction signs.
- Measure how long a full-range pan takes at a few speeds (sanity data for scan timing).

*Verification*: a short written record in `docs/protocol-notes.md`; existing VISCA loopback tests stay green.

### Phase 1 — Calibration

- Rust: image-shift measurement on downscaled greyscale frames (search ±N pixels with normalized cross-correlation; no new heavy dependency needed). Unit-tested with synthetic shifted images.
- Rust: calibration routine (move, settle, capture, measure) producing the FOV table; saved in the camera profile config (small JSON). Records firmware/model so a changed camera can be flagged.
- A "full-quality" capture mode for the NDI receiver (highest bandwidth) used only during calibration and scanning.

*Verification*: unit tests with synthetic images; on hardware, panning by exactly one measured FOV should move an object from one edge of the frame to the other.

### Phase 2 — Position telemetry during moves

The UI currently learns positions only after a command finishes. For a smoothly moving "current" box:

- **Backend**: while a VISCA move is in flight, poll position about 5–10 times per second (the adapter already polls in its no-completion fallback; this generalizes it). Publish samples with timestamps. The VISCA session must then handle inquiry replies arriving between a command's ACK and its completion; with Sony UDP this is keyed by sequence number, with raw UDP/TCP by reply shape, and the existing "skip stray completion" logic becomes "record it".
- **Transport to UI**: a lightweight position endpoint/event rather than the full 350 ms snapshot poll. Tauri events in the desktop app; a small polled endpoint in the browser preview.
- **UI animation**: render at display rate, interpolating between the last two samples and easing to the final readback on completion. If Phase 0 shows the P100 does *not* answer inquiries mid-move, fall back to predicting motion from measured speed and correcting on completion.

So: yes, polling is needed for accuracy; animation smooths between polls.

*Verification*: loopback VISCA test where the fake camera reports intermediate positions and delays completion; UI test that the current box moves through intermediate states.

### Phase 3 — Scan and stitch

- **Plan the sweep**: a grid over the allowed range at a chosen zoom (default: widest) with ~30% overlap between tiles, ordered in a serpentine path to minimize travel.
- **Per tile**: absolute move → wait for completion and readback → discard a few frames for motion blur/auto-exposure → capture one full-quality frame → record its read-back position.
- **Place and blend**: project each tile into pan/tilt space at its read-back position, refine placement against neighbours with the same cross-correlation, compensate per-tile brightness from overlaps, and feather the seams. Output a JPEG (target ~4096 px wide) plus its pan/tilt extent.
- **Always restore**: read pan/tilt/zoom before starting; on completion, cancel (STOP) or error, move back to it and verify by readback. A failed restore is reported loudly.
- **Runs like a macro**: one long operation with progress and Cancel, using the existing single-operation gate so manual commands and macros can't interleave. Estimated duration is shown before starting (likely 1–3 minutes; measured in Phase 0).
- **Safety**: a confirmation before scanning ("the camera will move for about N minutes"). Optional, see open question 3: block scanning while this camera's ATEM input is on program.
- **Storage**: panoramas are large, so they go in a separate SQLite table (`device_id`, JPEG, extent, calibration used, timestamp), not the config JSON. They are excluded from JSON config export at first (open question 4).

*Verification*: stitching unit test from synthetic tiles cut out of a known image; a cancel-mid-scan test confirming the restore move is issued; on hardware, the restored readback equals the starting readback.

### Phase 4 — Map overlay

Replace the schematic canvas with a calibrated map:

- Background: the stored panorama, positioned by its pan/tilt extent (falls back to the current grid when there is no panorama).
- **Current box**: size from the FOV table at the read-back zoom, position from telemetry, with the live NDI feed drawn inside it, animated per Phase 2.
- **Target box**: from the target pan/tilt/zoom; drag to move, wheel/pinch to resize (zoom). Apply buttons stay explicit, as today.
- Soft-limit region shaded (Phase 5); a "Scan" button with age of the current panorama, and "Re-calibrate".
- The map can be zoomed and panned, since a 360° panorama is much wider than the panel.

*Verification*: e2e tests with a mocked panorama, calibration and position samples (as the current NDI test does with a red frame).

### Phase 5 — Soft limits

- **Editing**: draw/adjust a rectangle (optionally a polygon later) on the panorama. Stored in the camera profile in pan/tilt units, so it survives re-scans.
- **Meaning**: the camera's *visible frame* must stay inside the region. Because the frame is smaller when zoomed in, the allowed centre range depends on zoom: `centre_pan ∈ [left + w/2, right − w/2]` where `w` is the FOV width at that zoom. If the region is narrower than the wide FOV, wide shots are not allowed there.
- **Enforcement in the backend**, so it applies to manual moves, dock nudges, presets and macros alike: commands that would violate the limits are rejected with a clear message. The UI clamps the target box while dragging, so violations are rare in practice. Zoom-out commands are checked too, since they enlarge the frame.
- If calibration is missing, limits can only constrain the frame centre; the UI says so.
- Optional later: also set the camera's own VISCA pan/tilt limit (protects against other controllers), if the P100 supports it.

*Verification*: core unit tests for the limit maths at several zooms and edge cases; macro test that a violating step fails before sending anything.

## Changes to existing code (summary)

- `control-core`: camera profile gains calibration (FOV table, ranges, signs) and soft limits; new commands/operations for calibrate and scan; telemetry types.
- `control-runtime`: VISCA in-motion polling; NDI full-quality single-frame capture; calibration, scan and stitch modules; soft-limit validation in command dispatch.
- `control-storage`: panorama table.
- Server/Tauri: scan/calibrate start, progress, cancel; panorama image and telemetry endpoints.
- UI: calibrated map component replacing the schematic canvas; scan flow; limit editor.

## Open questions for you

1. **Soft-limit meaning** — keep *what the camera shows* inside the region (recommended), or only its centre point?
2. **Panorama detail** — scan at the widest zoom (fastest, least detail; recommended to start), or allow a "detail" setting that scans zoomed in with many more tiles?
3. **On-air safety** — should a scan be blocked while this camera's ATEM input is on program? That needs a "which ATEM input is this camera" field on the device.
4. **Export** — include panoramas in workspace export/import (larger files), or keep them per machine and re-scan?
5. **Limit shape** — rectangle only to start (recommended), or polygons?

## Risks

- Mid-move position inquiries may not be supported by the P100, making animation predictive rather than measured (handled by the fallback in Phase 2).
- Auto-exposure and moving people cause visible seams; acceptable for a control map.
- Wide-angle lens distortion limits stitching precision at the edges.
- A scan physically moves the camera for minutes; a power or network loss mid-scan leaves it away from its starting position (the start position is recorded so it can be restored manually).
