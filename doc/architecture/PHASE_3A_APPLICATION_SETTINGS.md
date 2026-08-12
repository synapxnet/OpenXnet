# Phase 3A: Application Settings Ownership

## Status

Implemented on 2026-07-23. Desktop system settings and pre-Renderer runtime
settings are now owned by TypeScript Application Core. The legacy Python
settings database remains a compatibility copy while the remaining Phase 3
domains are migrated.

## Scope

This increment moves these fields into `desktop-core.db`:

- language, theme, timezone, and date format;
- startup and minimized-launch preferences;
- proxy mode and proxy endpoint;
- the local-only network policy;
- Chrome MCP startup mode, implementation, enabled state, and CDP port.

Model providers, prompts, agents, authentication, conversations, file metadata,
and tasks remain outside this increment. They must move through separate typed
contracts rather than expanding the system-settings document.

## Storage Contract

`ApplicationStore` uses the Electron/Node built-in `node:sqlite` implementation,
so this phase adds no native package or runtime dependency. The store enables
WAL, foreign keys, defensive schema handling, a five-second busy timeout, and
migration-managed strict tables.

Application state is stored as bounded versioned JSON documents:

| Document | Owner | Current schema |
| --- | --- | --- |
| `system-settings` | Renderer through authorized Core IPC | `openxnet.system-settings.v1` |
| `runtime-settings` | Electron Main | Internal v1 normalized contract |

Each write is transactional and increments a revision. A missing document is
returned as revision zero so the Renderer can seed Core once from the legacy
backend. JSON documents are limited to 1 MiB, keys are allow-listed by format,
and a database created by a newer schema is rejected instead of modified.

## Migration Order

Bootstrap imports are idempotent. Existing Core documents are never overwritten
by a legacy source.

1. Read `super_agent_party.db`, table `settings`, row `id = 1`, in read-only mode.
2. Use `settings.json` only as a fallback for missing Python settings fields.
3. Import startup runtime configuration from `config.json`, falling back to the
   Python Chrome MCP object only when the config field is absent.
4. Normalize every imported value and force both network fields to `local`.

Malformed or larger-than-16-MiB legacy inputs are ignored with a warning. They
cannot prevent the application from starting and cannot replace valid Core data.

## Compatibility Writes

The save order is:

1. persist the bounded system settings in Core SQLite;
2. atomically update the legacy `settings.json` mirror;
3. persist Chrome runtime settings in Core and atomically update `config.json`;
4. send the existing full settings payload to Python over WebSocket.

The JSON mirrors preserve unrelated fields and use a same-directory temporary
file plus rename. Unchanged values do not create new Core revisions. The first
unchanged save in a process may still repair a missing compatibility mirror.

This dual-write period supports rollback to a legacy build. Core remains the
authority whenever its document revision is greater than zero.

## IPC Boundary

The preload exposes only:

- `getSystemSettings()`;
- `saveSystemSettings(settings)`.

Electron Main authorizes the sender against the primary workspace window before
reading or validating any request. Save payloads accept one `settings` object,
drop unsupported fields, bound text and numeric values, and enforce local-only
network access.

## Shutdown and Recovery

Electron closes the application database after workers and gateways stop and
before the final process exit. SQLite WAL provides crash recovery. Compatibility
mirror failures are non-authoritative and logged; a successful Core commit is
not rolled back because an older JSON mirror could not be updated.

Development, CI, and portable launchers may set `OPENXNET_USER_DATA_DIR` before
Electron starts. Electron Main and every Python or optional worker then receive
the same isolated absolute data root.

## Verification

Automated coverage includes:

- schema creation and reopen persistence;
- optimistic revision conflicts and idempotent saves;
- corrupt rows, circular values, invalid keys, and oversized JSON rejection;
- Python SQLite, JSON fallback, and runtime config imports;
- legacy precedence and protection of existing Core documents;
- atomic compatibility mirrors and preservation of unrelated fields;
- authorized and unauthorized IPC senders;
- request field filtering and local-only network normalization.

The complete `npm test` suite passed with 37 Desktop Core tests, all Python
worker suites, and 8 kernel regressions. `npm audit --omit=dev` reported zero
vulnerabilities. Development and packaged Electron smoke runs both created and
reopened schema version 1 in isolated data directories. The development run
persisted both settings documents at revision 1. The packaged smoke intentionally
omitted Python Server and still rendered the complete local workspace.

## Next Increment

The isolated smoke measurements showed approximately 34.8 seconds to Renderer
hydration with the development backend and 32.8 seconds without any packaged
Python Server. The next increment must therefore address the monolithic legacy
Renderer bootstrap rather than attribute the remaining delay to Python.

Phase 3B should expose one Core bootstrap snapshot, mount the local shell without
waiting for legacy WebSocket state, and lazy-load settings and capability
surfaces from split Vite entry points. Startup timing must be recorded from
process launch to first interactive frame and enforced as a regression budget.

Authentication ownership follows that bootstrap cut. Credentials must use the
operating system credential facility. SQLite may store non-secret account
metadata, session state, and credential references only. Raw access tokens,
refresh tokens, and provider API keys must not be placed in `desktop-core.db`.
