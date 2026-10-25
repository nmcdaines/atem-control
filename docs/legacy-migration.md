# Importing the legacy configuration

The new application stores its own configuration in SQLite. It does not modify the legacy PostgreSQL database.

## Direct PostgreSQL import

Open **Workspace → Import from PostgreSQL**. Enter the database host, port, database, username, password and schema, then choose **Read PostgreSQL & review import**. Review the converted configuration and warnings before choosing **Back up & replace workspace**. The initial read does not modify either database or connect to cameras/switchers. Applying the preview creates a local SQLite backup before replacing the workspace.

Checked against `origin/docker` at `84e4ca4`: its Compose service uses PostgreSQL, publishes `5432:5432`, and reads `POSTGRES_*` values from `docker.env`. Its configured database is `nestjs`. `POSTGRES_HOST=database` is a Docker network alias used by the legacy backend; it is not the address a desktop application should use.

For the Docker instance on this computer use **localhost**, port **5432**, database **nestjs**, schema **public**, and your existing PostgreSQL credentials. For Docker on another computer, use that computer's reachable address and its published PostgreSQL port. The importer does not embed credentials from the branch's environment files.

The Rust importer reads `device`, `macro` and `shortcut` in one **read-only, repeatable-read transaction**, using the quoted `ipAddress` field and JSONB macro steps from that branch's TypeORM entities. A SELECT-only account with access to those tables is sufficient. Livestream keys, pgAdmin configuration and unrelated tables are not imported.

Connection credentials are transient; they are not added to the workspace, saved to SQLite or returned in the import preview. The password field clears after success or failure. TLS is optional for the local Docker configuration; when selected, it is required and verifies the hostname and certificate against system-trusted certificate authorities. Install a private CA into the system trust store if your server uses one.

Connection attempts have a five-second socket timeout; the whole preview has a 30-second deadline and bounded query/lock waits. Workspaces above 2 MB or above the supported device/macro/shortcut counts are rejected. Missing schema, permission, authentication and conversion failures leave the local workspace intact. Conversion limitations below apply equally to direct database import and JSON import.

## JSON export alternative

From `atem-server/`, install its existing dependencies and provide the same `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD` and `POSTGRES_DB` environment variables used by the server. Then run:

```sh
npm run export:workspace -- /absolute/path/to/legacy-workspace.json
```

The script reads `device`, `macro` and `shortcut` in one read-only, repeatable-read transaction. It writes a new file with restricted permissions and refuses to overwrite an existing file. It exports no livestream keys. It has not been run against a deployed database during this migration.

## Review and import

In the new app, open Workspace, select the JSON file and click Review import. Review the converted configuration and warnings. Back up & replace workspace validates the configuration, creates a sibling SQLite backup, and replaces the configuration transactionally. Import can connect saved ATEM devices after it is applied, but it never runs a macro or sends a camera movement command.

IDs, shortcut page/slot positions, macro references and per-step/default device targets are preserved. Legacy camera coordinates remain raw camera units. Imported BirdDog profiles propose Sony UDP on port 52381 with broad coordinate limits: review and correct these for the actual model before issuing commands.

The old runner executed macro steps concurrently and ignored `order` and `delay`. Imported macros use an explicit `legacy_parallel` step with zero action delays. They retain the old scheduling intent; hardware transports serialize traffic where necessary, so simultaneous physical movement is not guaranteed. Use the macro editor to create a reviewed sequential replacement with deliberate waits.

## Supported legacy actions

- `SET_PROGRAM`, `SET_PREVIEW`
- `TRANSITION_CUT`, `TRANSITION_AUTO` without an optional nonzero `input`
- `SET_INPUT_NAME`
- `VISCA_SET_PAN_TILT`, `VISCA_SET_ZOOM`
- Shortcut commands `MACRO` (the value actually written by the existing UI) and `RECALL_MACRO`

Unknown device/action/shortcut types, partial PiP actions, compound preview-and-transition actions, invalid numeric properties and dangling references fail conversion with a message. They do not produce a partially imported workspace. The current converter intentionally requires manual conversion for `SET_PIP`: its optional partial settings cannot be faithfully converted to the new complete PiP command without knowing current switcher state.

For a versioned export from the new app, the same Workspace review/import flow restores devices, macros and shortcuts. An unknown version is rejected without replacing the existing configuration.
