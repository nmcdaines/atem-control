# Control surface UI

The desktop interface uses shadcn/ui's New York components on Radix UI, Tailwind CSS 4, React 19 and Lucide icons. Configuration lives in `apps/desktop/ui/components.json`; component source is owned in `src/components/ui/`, shared class merging in `src/lib/utils.ts`, and theme/layout styles in `src/style.css`.

The component primitives supply form inputs, labels, native selects, buttons, cards, badges, notices, checkboxes, sliders, progress and pagination. Button variants add explicit program/preview colors for the production surface. Native select controls preserve keyboard and form behavior. No externally hosted fonts, styles or UI services are required at runtime.

## Shortcut pages

Twelve shortcut slots appear per page. The page navigator sits below the grid and includes previous/next, numbered pages, a current-page indicator and Add page. The display uses page numbers starting at 1; stored page IDs continue to start at 0 so existing assignments stay intact.

The page count includes the highest imported/saved page. Large page ranges use ellipses, so an imported page 65535 does not create thousands of DOM buttons. New empty pages are drafts; assigning a macro saves that page. Empty drafts disappear after a reload.

## PTZ targets

- X/pan uses a horizontal slider.
- Y/tilt uses a vertical slider; positive tilt moves the frame upwards.
- Zoom uses a horizontal Wide → Tele slider.
- Numeric pan/tilt targets and speed inputs remain available for precise values.

A calibrated camera replaces the canvas with a full-width camera map: its stored panorama, a green box for the current view (with the live NDI feed, gliding between position samples polled every 100 ms while moving), a dashed blue target box (red if it would break the soft limits) and the soft-limit rectangle, outside which the map is dimmed. Click or drag to aim, scroll or pinch to zoom; Set limits switches to drawing the allowed area. Calibrate and Scan panorama ask for confirmation because they move the camera.

Uncalibrated cameras keep the schematic canvas: it plots a blue target frame and an emerald dashed readback frame when observed/simulated state is available. Pan and tilt move the center; increasing zoom shrinks the frame without moving its center. The map respects configured camera coordinate limits. Its zoom scale is schematic, not a calibrated optical field-of-view calculation.

Click or drag the canvas to change X/Y. Arrow keys adjust the focused map; Shift increases the step. Slider thumbs are also keyboard accessible. These operations edit a local draft. Move to position applies X/Y, Set zoom applies zoom, and Use current as target copies readback into the draft. Saving a preset still uses the camera's observed position rather than an unapplied target.

The canvas scales for display density and container resizing. On wide desktop windows it appears beside readback and numeric controls; on smaller screens those sections stack.

## Platform and verification

Tailwind 4 requires modern browser features, including Safari 16.4 or newer and Chrome 111 or newer. The macOS installer minimum is set to 13.3 to match that WebKit generation; Windows uses WebView2. Native webview acceptance remains part of platform release testing. See [Tailwind compatibility](https://tailwindcss.com/docs/compatibility).

Frontend tests cover framing geometry, bounded pagination, page assignment persistence, slider orientation/keyboard input, canvas editing, explicit movement application, small-screen overflow and the existing switcher/macro/import workflows. Run `make build-ui`, `npm --prefix apps/desktop/ui test`, and `make test-e2e`.
