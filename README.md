# ATEM Control

A shared control surface for ATEM switchers, VISCA-IP PTZ cameras, presets, macros and shortcut pages. The new application uses a Rust core, SQLite, React and Tauri 2. The legacy NestJS/React application remains in `atem-server/` and `atem-client/` during migration.

The interface uses shadcn/ui and Tailwind 4. Shortcut pages have bottom pagination; camera controls include X/Y/zoom sliders and an interactive target/readback canvas. See [UI controls and behavior](docs/ui.md).

## Try the new application

Install the Rust toolchain specified in `rust-toolchain.toml` and Node.js 24 or newer.

With GNU Make installed (on Windows, use a GNU Make/Git Bash environment):

```sh
make setup    # install frontend dependencies and generate shared types
make run      # native desktop app; install Tauri prerequisites first
make dev      # browser preview + Rust backend together
```

`make dev` prints the preview URL and stops both servers on Ctrl+C or when either server exits. It seeds demo data only if the workspace is empty. You can override ports and the development database:

```sh
make dev API_PORT=3848 UI_PORT=1421 DATABASE=/tmp/atem-preview.sqlite3
```

Use `make help` for build, test and individual server commands. The equivalent commands without Make are below.

For a browser preview, run these in separate terminals from the repository root:

```sh
cargo run -p control-server -- --demo
```

```sh
cd apps/desktop/ui
npm ci
npm run dev
```

Open **http://127.0.0.1:1420**. This preview uses the real Rust services and a local SQLite database; the demo devices are explicitly simulated. `--demo` seeds only an empty workspace. The development API binds to loopback and is not a remote-control server.

For the desktop app, install [Tauri's platform prerequisites](https://v2.tauri.app/start/prerequisites/), then:

```sh
cd apps/desktop/ui
npm ci
npm run desktop
```

The desktop host starts its own Rust core and stores its database in the platform's application data directory. It does not need the development server, Node.js or PostgreSQL at runtime. Run `npm run tauri -- build` to build the desktop application on its target platform.

## Current scope

- Program/preview, cut/auto, input labels and upstream DVE/PiP controls; simulated ATEM and an experimental network adapter for M/E 0/keyer 0.
- Simulated PTZ and an experimental VISCA-IP adapter with explicit Sony UDP, raw UDP or raw TCP profiles, absolute positions, zoom, position inquiries and stop.
- Application camera presets, sequential macros, explicit parallel groups, waits, per-action deadlines, run progress, cancellation and shortcut pages.
- SQLite persistence, direct PostgreSQL import, JSON export/import with a database backup, and legacy export/conversion with compatibility warnings. Use Workspace → Import from PostgreSQL to connect and review an existing installation; the Docker branch defaults to `localhost:5432`, database `nestjs` when running on this computer.

The hardware adapters have automated loopback coverage, **not physical camera/switcher acceptance**. Confirm the model, firmware, VISCA framing and coordinate ranges before using them in production. ATEM command success means transport acknowledgment, not completion of a physical transition. Timed waits do not establish physical settling. Camera positions are queried on request and after commands; continuous polling/joystick control is not yet implemented.

NDI, image controls, iOS, automatic discovery, signing and release installers remain future work. A native macOS/Windows build matrix is configured in CI; those builds have not been run from this Linux environment.

## Development checks

```sh
cargo fmt --all -- --check
cargo test --locked
cargo clippy --locked --all-targets -- -D warnings
cargo run -p control-core --bin export-types
```

```sh
cd apps/desktop/ui
npm run build
npm test
npm run format:check
npx playwright install chromium
npm run test:e2e
```

The browser tests start isolated local servers and use `.local/e2e.sqlite3`; they do not use the desktop database. Protocol tests require permission to bind loopback UDP sockets. TypeScript protocol types are generated from Rust into `apps/desktop/ui/src/bindings.ts`; regenerate after changing the shared model.

The PostgreSQL integration test uses a disposable database and is run separately (also configured in CI):

```sh
ATEM_TEST_POSTGRES_URL=postgres://postgres:password@localhost:5432/test_db make test-postgres
```

It creates temporary fixture tables/roles and verifies read-only snapshot settings, conversion, size/error handling and unchanged source rows. Use a test database with permission to create schemas and roles; do not point this test command at the source database being imported.

See [migration progress and remaining acceptance work](docs/implementation-status.md), [legacy data migration](docs/legacy-migration.md), [protocol notes](docs/protocol-notes.md), and the original [migration plan](docs/rust-migration-plan.md).
