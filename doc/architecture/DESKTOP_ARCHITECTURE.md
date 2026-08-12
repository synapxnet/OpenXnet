# OpenXnet Desktop Architecture

## Status

This document defines the target architecture for the ongoing desktop refactor. New code must follow these boundaries. Existing code moves behind these boundaries incrementally so that the application remains releasable throughout the migration.

## Goals

- Render the desktop user interface without waiting for Python.
- Keep Electron-specific browser, window, capture, tray, and shortcut capabilities.
- Make application behavior independent from the implementation language of a capability.
- Start heavyweight capabilities only when they are needed.
- Update and roll back the base application and optional capability packs independently.
- Enforce UTF-8 source encoding and documented functions in all new architecture modules.

## Process Model

```text
Renderer (Vue)
    |
    | typed contextBridge API
    v
Electron Main
    |
    | versioned desktop-core protocol
    v
Application Core (TypeScript utility process target)
    |
    | versioned worker protocol
    +---- Python AI worker
    +---- Python voice worker
    +---- Python index worker
    +---- Python document worker
    +---- Python MCP worker
    +---- Python desktop-control worker
    +---- Bundled GitNexus worker
    +---- Optional native workers
```

During the compatibility migration, the legacy Python backend reaches supervised workers through an authenticated loopback Worker RPC Gateway. This bridge carries small JSON control messages only; large inputs are application-owned artifact references. Task Worker provider traffic uses a separate Main-owned Task Execution Broker Gateway with an exact five-route allow-list and an independently supervised Execution Engine. Legacy Vue settings, conversations, and VRM configuration temporarily use a bounded Main-owned SQLite compatibility bridge so Renderer hydration does not activate Python. Model-provider metadata is already Core-owned, while Electron Main stores Provider, Search, Voice, MCP, custom HTTP, Connector Worker, Telegram, image-host, repository, live-platform, code-sandbox, Home Assistant, ComfyUI, and task delivery credentials in separate `safeStorage` files. External CLI custom configuration is a scoped consumer of the existing Provider boundary and does not add another credential file. Each bounded map enters only the runtime that consumes its trust zone; repository credentials currently have no runtime consumer, while task delivery credentials use one request-scoped broker envelope instead of a process environment. These bridges are removed domain by domain as Renderer clients move to typed Desktop Core contracts.

Durable tasks follow this ownership model for persistence and coordination. Application Core creates the stable task before dispatch, while Python holds a temporary execution mirror. Renderer commands use typed IPC, and supervised Worker events reconcile execution state into Core. The Task Worker owns direct workspace task-mirror commands, the desktop schedule clock, recurrence projection, due-task activation, SubAgent job lifecycle, task-bound execution sessions, cancellation-aware cleanup, bounded executor checkpoint delivery, terminal delivery selection, and retry policy. Desktop Main owns the authenticated task gateway and acquires one request lease from the independent Execution Engine for provider, tool, evaluation, cancellation, or terminal-delivery traffic. Dynamic Local UI compatibility requests retain a separate lazy `legacy-backend` activation path. Normal Desktop Chat uses typed preload IPC and Main-held request leases against six exact private Chat Engine routes, while browser and Server profiles retain HTTP fallback. QQ, Feishu, Dingtalk, Discord, Slack, and Telegram lifecycle controls also use typed Main IPC and direct supervised Worker requests; status does not activate a stopped capability. Their ordinary and proactive Chat traffic uses a separate Main-owned Connector Chat Broker with a Connector-only bearer and request-scoped Execution Engine leases. TTS and Connector ASR use a second Connector-only Voice Broker with bounded temporary audio references; desktop microphone ASR uses sender-authorized typed IPC and Main-owned artifacts. Both paths project credential-free settings and invoke the independently supervised Voice Worker directly. Bilibili, YouTube, and Twitch lifecycle controls and events use a dedicated optional Live Worker through typed IPC; status and stop do not activate it, and Browser/Server alone retain the compatibility HTTP and WebSocket routes. Home Assistant, external Chrome, SQL, and generic remote MCP lifecycles use typed MCP Runtime IPC and a dedicated optional MCP Worker. Generic Servers use isolated `generic:<serverId>` integrations with SSE, Streamable HTTP, or WebSocket; external plaintext transport is rejected and Desktop Renderer cannot provide stdio commands or environments. Execution Engine discovers and calls MCP tools through a private Main-owned MCP Tool Broker, receiving only the Broker origin and process bearer. Generic credentials are hydrated by Server scope only inside MCP Worker, while SQL passwords and authorized SQLite paths remain behind their separate Main and Worker boundaries. External Chrome CLI dependencies are installed on first explicit activation from a Pack-hashed lockfile with exact versions, per-tarball integrity, and install scripts disabled; no `npx latest` resolution remains. SQL uses the same frozen Worker entrypoint with pinned `mcp-alchemy`, SQLAlchemy, and database drivers rather than `uvx`. The `connectors`, `live`, and `mcp` capabilities each depend only on Core. The extracted Python broker modules retain read-only provider preflight, provider/tool session adaptation, Chat/model/abort/tool/approval adaptation, and secret-retaining external delivery inside the exact-route engine profile. Executor writes publish native Worker checkpoint events; a 30-second changed-snapshot watcher remains only as a recovery fallback. Browser-oriented task, Connector, live, and MCP lifecycle HTTP commands remain compatibility-only and are absent from the Desktop call path after their domain migration.

Legacy backend credential rotation uses a dedicated lifecycle coordinator. Authentication, Provider, Search, Voice, MCP, and other scoped credential updates mark the current backend exit as expected, wait until the operating system confirms that the old process has closed, transition the Core capability to `stopped`, and only then start a replacement with fresh Main-owned credential envelopes. Repeated changes during shutdown are coalesced into the same restart, while a backend that was already stopped remains lazy. Expected `SIGTERM` exit code `15` never enters the crash-dialog path; only an unmarked exit may set `LEGACY_BACKEND_EXITED` and use automatic crash recovery.

Desktop knowledge-base files enter through Core Artifact import. Build, status, removal, and bounded path-free query operations use sender-authorized typed IPC and four exact request-leased Execution Engine routes. Internal Artifact URLs resolve directly to ordinary files in the controlled application directory instead of looping back through legacy HTTP. Browser/Server keep their compatibility knowledge-base routes, while those routes are absent from the migrated Desktop call path.

General Desktop file intake also enters through Core Artifact. Main-dialog paths retain exact Main authorization; HTML file inputs and drag/drop remain preload-owned and use `webUtils.getPathForFile` without exposing a string-path mutation API to Renderer. Generated screenshots and clipboard files use a separately bounded inline-byte path. Main streams native files into application storage, while the Local UI Gateway serves single-file `/uploaded_files/` reads directly without activating Python. Browser/Server alone retain `/load_file` multipart compatibility.

Developer Workbench overview, repository summaries, bounded code search, snapshot lifecycle, workspace application, and local Agent mapping use a Main-owned TypeScript Runtime through sender-authorized typed IPC. Renderer cannot submit a search root, and workspace mutation requires an exact native-directory grant before Main canonicalizes and persists it. Repository and search scans have independent file, byte, result, and timeout budgets and redact sensitive assignment lines. Snapshot imports reject credential fields before writing. Browser/Server keep the `/v1/dev/workbench/*` compatibility routes, while these migrated Desktop flows never activate Python.

VRM models, VRMA motions, and Gaussian scenes use a Main-owned VR Asset Runtime. preload converts a real File into a private native path or bounded inline bytes; Main validates type-specific budgets, copies to the user asset directory, and updates secret-free VRM configuration. Built-in `/vrm/` files and user `/uploaded_files/` assets stream directly from the Local UI Gateway. Cloud downloads accept only compatible UUIDv5 IDs from a fixed catalog and use bounded manual-redirect Electron fetches. Browser/Server keep compatibility routes, while migrated Desktop asset flows never activate Python.

Enterprise role cards, knowledge-base metadata and redacted version summaries, workspace metadata, sandbox projection, and fixed Xnet service configuration use a Main-owned Enterprise Runtime through 15 sender-authorized typed IPC channels. Role cards are authoritative and the sandbox is a rebuildable projection, so a projection write failure cannot turn a completed role-card write into an ambiguous failure. Xnet health checks accept only a fixed service key and use the Main-saved HTTPS or loopback URL with a five-second timeout and manual redirects. Browser/Server keep `/v1/enterprise/*` compatibility routes; Usage, Neuro/Knowledge Graph, Docker/SSH execution, and writable sandbox commands remain separate future domains.

Enterprise Usage uses a separate Main-owned read-only Insights Runtime over the existing `usage_tracking.db`; missing storage returns an empty dashboard and never activates a capability. NeuroSymbol and Temporal Knowledge Graph remain single-writer cognitive domains inside the independently supervised Execution Engine. Renderer requests cross seven typed IPC channels, then six exact private POST routes under one request lease. Main and Engine validate requests independently, and public responses omit external references, source symbols, Prompt/config fields, database paths, and private errors. Browser/Server retain `/v1/usage/*` and `/v1/neuro/*` compatibility routes.

Windows shell control uses a separate optional `desktop-control` capability. Renderer window, monitor, active-window, history, and action requests cross exact typed IPC into a supervised pywin32 Worker. Main and Worker both validate action-specific payloads, and public window metadata excludes executable paths. The Worker starts only on an explicit surface request and stops after a 30-second idle window; Browser/Server keep the FastAPI compatibility adapter.

Node, uv, and Docker operations use a Main-owned Toolchain Runtime. Renderer can select only fixed typed probes and Docker actions; it cannot provide commands, argument arrays, environments, working directories, or shell fragments. Main uses `spawn` with `shell: false`, strips OpenXnet and credential-like environment variables, enforces per-operation timeouts and a shared output ceiling, and returns only bounded summaries. Browser/Server keep the FastAPI compatibility routes, while Desktop startup performs no automatic tool probe.

Recall Center uses the optional Memory Worker through sender-authorized typed IPC. Main injects the workspace directory and provider name from its own secret-free settings snapshot; Renderer supplies only bounded queries, anchors, IDs, and limits. Bootstrap coalesces interrupted turns, history, checkpoints, decisions, Temporal KG versions, and memory overview into one request. Search combines local ObservationStore, SessionMemoryProvider, and Decision Log results. Recall does not statically activate Vector Worker; only real Mem0 operations cross the existing Vector RPC boundary. Browser/Server keep the remote federation, HTTP, SSE, and WebSocket compatibility routes.

The initial migration hosts Application Core in the Electron main process. Its public contract does not depend on that location, so it can move to an Electron utility process without changing Renderer APIs.

## Layer Responsibilities

### Renderer

- Owns presentation and transient view state.
- Calls only the typed preload API.
- Must not spawn processes, access Node.js, or depend on a backend port.
- Must not call legacy FastAPI routes directly after the corresponding domain has migrated.
- Must not open legacy HTTP or WebSocket connections as a side effect of Desktop mount or Home idle initialization.
- Receives only redacted credential metadata and configured booleans or names; newly typed secrets are cleared after a successful Main save.
- Reconstructs Desktop Chat SSE from ordered bounded Base64 IPC events through a Response-compatible adapter.
- Cannot reconcile, transition, or delete task rows through low-level storage IPC.

### Preload Bridge

- Exposes a narrow, allow-listed API through `contextBridge`.
- Validates channel names and payload shapes.
- Converts Electron events into explicit subscribe/unsubscribe functions.
- Converts real Renderer `File` objects into private native-path imports and applies 32 MiB per-file/64 MiB per-batch limits to generated files before typed IPC.
- Converts VR asset Files into a separate single-file typed request with an independent 64 MiB generated-file limit.
- Converts real extension and skill ZIP Files into private native-path imports, with separate 32 MiB and 16 MiB generated-file limits.

### Electron Main

- Owns application lifecycle, windows, tray, shortcuts, capture, downloads, and updates.
- Supervises Application Core and capability workers.
- Owns the shell-free allow-listed Toolchain Runtime and its child-process environment, timeout, output, and public-error boundaries.
- Owns Recall workspace-scope injection and direct observation-focus delivery to existing Desktop overlay windows.
- Owns Developer Workbench filesystem budgets, snapshot storage, native-directory grants, and local settings/task aggregation.
- Owns VR asset type/size budgets, fixed cloud catalog downloads, user asset files, and shared extraResources root injection.
- Owns extension/skill catalogs, safe ZIP/repository installation, atomic replacement, bundled-skill synchronization, and authorized workspace-only skill writes.
- Supervises explicit Node extension starts with a fixed entrypoint, bundled npm, install-script denial, minimal environment, bounded logs/health, process-tree shutdown, and an isolated Extension Gateway Origin.
- Owns enterprise role-card, knowledge-base, workspace, sandbox-projection, and Xnet configuration files with bounded UTF-8 reads, exact writes, atomic replacement, and fixed-key health checks.
- Owns read-only Usage SQLite aggregation and the typed Neuro/KG request-lease boundary without becoming a second writer for cognitive stores.
- Owns the Local UI Gateway Artifact root and serves only regular, non-symbolic single-file names without proxy fallback.
- Owns separate OS-encrypted Provider, Search, Voice, MCP, custom HTTP, Connector Worker, Telegram, image-host, repository, live-platform, code-sandbox, Home Assistant, ComfyUI, and task delivery credential boundaries, provider validation, and scoped runtime injection.
- Contains no model, task-planning, memory, or connector business logic.

### Application Core

- Owns capability state, settings, authentication metadata, redacted provider metadata, durable task state, file metadata, and worker activation.
- Is the single writer for the primary desktop database.
- Publishes stable contracts rather than runtime-specific objects.
- Starts optional workers on demand and stops them after an idle timeout.
- Supervises the authenticated Execution Engine with request leases and idle shutdown.
- Owns typed Chat command validation, stream event delivery, and leases without exposing the engine origin or bearer to Renderer.
- Owns typed knowledge-base request validation and request leases without exposing the engine origin, bearer, or local index paths to Renderer.
- Owns typed Desktop Control request validation and Worker activation without exposing process paths or raw Windows API errors to Renderer.
- Owns typed Recall request validation and Memory Worker activation without accepting Renderer workspace paths or exposing checkpoint internals.
- Owns typed Developer Workbench contracts and Core task summaries without accepting Renderer search roots or credential-bearing snapshots.
- Owns typed VR asset contracts without exposing arbitrary paths, download URLs, redirects, or internal resource roots to Renderer.
- Owns typed Enterprise contracts without accepting Docker/SSH commands, temporary Xnet URLs, credentials, or writable sandbox commands from Renderer.
- Owns typed Enterprise Insights contracts, fixed private Engine paths, response projection, and lease release without exposing cognitive storage internals.
- Owns the fixed Kernel operation contract, private dispatcher lease boundary, bounded event-status polling, and structured inspector/action commands without accepting Renderer URLs or HTTP methods.
- Owns fixed-commit Sherpa/MiniLM model installation, byte/hash verification, Worker-aware atomic replacement, and bounded progress IPC without accepting Renderer URLs, paths, versions, filenames, or hashes.
- Owns Artifact file classification, streaming copy, generated-file persistence, hashing, stable identity, snapshots, and tombstones without requiring Python.
- Coordinates task dispatch and Core-first terminal actions through the supervised `tasks` capability.
- Starts the Worker-owned task schedule clock after the lightweight Task Execution Broker Gateway is ready, without waiting for the provider engine.

### Capability Workers

- Own one coarse capability with a coherent dependency set.
- Communicate through the versioned newline-delimited JSON protocol.
- Never write directly to the primary desktop database.
- Return artifact identifiers or file references for large payloads.
- Receive only scoped process credentials and never expose them to Renderer payloads or logs.
- Task Worker owns direct compatibility-mirror CRUD, desktop recurrence projection, and due-task activation but cannot write Core state or bypass the read-only backend preflight guard.
- Task Worker validates executor checkpoints and emits typed progress events; only Core can merge them into durable task state.
- Task Worker owns active desktop SubAgent jobs keyed by canonical workspace and task ID; duplicate starts are idempotent and Core cancellation remains authoritative.
- Task Worker consumes only typed execution-session events through the Main-owned broker origin; provider credentials and generic chat/tool payloads remain inside the provider engine.
- Task Worker emits typed terminal delivery outcomes and owns bounded retry timing; it never receives target credentials or raw adapter errors.
- The extracted Python broker API exposes only exact typed task brokers; Server task CRUD, workbench, scheduler adapters, and the compatibility scheduler are separate runtime-profile modules.
- Live Worker owns Bilibili, YouTube, and Twitch transport lifecycles, emits bounded normalized events, and shares only a framework-free controller with the Server compatibility adapter.
- MCP Worker owns Home Assistant, external Chrome, SQL, and generic remote MCP connection lifecycles, scoped credential hydration, bounded tool schemas, and tool calls. Generic remote connections are isolated by dynamic Server integration, and arbitrary Renderer stdio execution is forbidden. It shares only framework-free validation and lifecycle logic with the Server compatibility adapter.
- Desktop Control Worker owns Windows shell enumeration and bounded window actions through pywin32. It has no HTTP framework, model, credential, database, or network dependency and shares only the low-level window-control module with the Browser/Server adapter.

## Capability States

Capabilities use the following lifecycle:

```text
unavailable -> installing -> stopped -> starting -> ready
                                  |          |         |
                                  v          v         v
                                error <--- degraded <-+
                                             |
                                             v
                                          stopping -> stopped
```

Every capability reports its runtime, optional status, dependencies, last transition time, and a structured error when applicable.

## Protocol Rules

- The desktop protocol and worker protocol are versioned independently.
- Requests carry a message identifier and trace identifier.
- Streaming operations return a job identifier and publish progress events.
- Cancellation is explicit and idempotent.
- Compatibility is maintained for the current and immediately previous protocol version.
- Unknown fields are ignored within a compatible protocol version.

## Data Ownership

- Application Core owns SQLite migrations and primary data writes.
- The primary desktop database is `desktop-core.db`; bounded versioned documents provide the initial migration surface.
- File-library metadata uses the relational `application_artifacts` table with stable UUID identity, revisions, availability state, and deletion tombstones; task records reference artifact IDs rather than paths.
- Desktop storage, Chat attachments, long-text reads, character-card images, avatars, and knowledge-base inputs all converge on this Artifact table; only Browser/Server compatibility profiles use `/load_file`.
- Durable tasks use relational `application_tasks`, `application_task_artifacts`, and `application_task_events` tables. Core UUIDs, optimistic revisions, tombstones, and append-only events are authoritative; Python task files are idempotent execution mirrors.
- Task list contracts return bounded summaries while task detail returns complete bounded metadata and recent Core events. Large execution outputs belong in application artifacts, not task JSON.
- Task execution snapshots enter Core only through the coordinator. Reconciliation is limited to 500 records and 8 MiB, compatibility dispatch retries reuse the Core UUID, and existing workspace paths are native-realpath canonicalized before partition hashing.
- Desktop task commands and schedule decisions mutate the canonical workspace Task Center directly inside Task Worker. The Worker uses the bearer-authenticated Main-owned broker for provider readiness and bounded `maxTokens`; the backend scheduler has both activation and delivery disabled in desktop profile.
- The Task Execution Broker Gateway validates the exact route, Host header, process bearer, query absence, and 2 MiB request budget before coalescing provider-engine activation. It preserves SSE streaming and aborts the upstream stream when Worker disconnects.
- Desktop task HTTP policy hides all Server compatibility paths with HTTP 404 and authenticates only the exact preflight, session, and delivery broker allow-list. Server profile dynamically registers `openxnet.server-task-api.v1` compatibility commands.
- Backend checkpoint and nested executor controls enter Task Worker only through Main's authenticated, method-allow-listed Worker RPC Gateway. Checkpoints are capped at 256 KiB, preserve Core-owned identity, and cannot regress a Core cancellation. Nested starts carry only exact loopback routing, workspace/task identity, and a bounded token option.
- Task execution turns, completion evaluation, and provider-stream cancellation use task-bound session IDs over bearer-authenticated `/v1/tasks/executor/session/*` routes. Extra fields, workspace mismatches, session mismatches, unbounded messages, and raw provider errors are rejected.
- Terminal delivery side effects use bearer-authenticated `/v1/tasks/executor/delivery/*` routes. Stable attempt IDs, canonical workspace checks, generic results, and stripped delivery configuration keep target credentials outside Worker events and Core SQLite. Main adds one request-scoped credential envelope only on the exact dispatch route, and Execution Engine revalidates the workspace/task/target scope before hydration.
- Core settings are authoritative after revision one, while legacy Python and JSON copies exist only for staged rollback.
- Secrets are stored through the operating system credential facility.
- Authentication tokens and subscription bootstrap credentials never belong in Renderer localStorage or Core SQLite documents.
- Desktop authentication snapshots expose configured booleans and expiry metadata only; Main owns account authorization, refresh, retry, response limits, redirect denial, and error redaction.
- Model-provider credentials are encrypted in `provider-credentials.bin` through Electron `safeStorage`; Core SQLite and legacy SQLite retain metadata and configured booleans only.
- Search and crawler credentials are encrypted independently in `search-credentials.bin`; Desktop legacy settings and Renderer snapshots retain configured booleans only.
- TTS vendor credentials are encrypted independently in `voice-credentials.bin` by default or named-voice scope; OpenAI-compatible TTS/ASR resolve their key from the separate Provider boundary.
- MCP stdio environment credentials and sensitive transport headers are encrypted independently in `mcp-credentials.bin`; Renderer and legacy settings retain configured names only.
- Sensitive custom HTTP headers are encrypted independently in `http-tool-credentials.bin` by stable tool ID; ordinary headers remain editable metadata.
- QQ, Feishu, Dingtalk, Discord, and Slack secrets are encrypted independently in `connector-credentials.bin`; their public App IDs/Keys and configured field names remain metadata.
- The Telegram Bot token is encrypted independently in `telegram-credentials.bin`; Main injects it only into Connector Worker, the legacy compatibility backend, and Execution Engine consumers that require Telegram transport or delivery.
- SM.MS and EasyImage 2 API keys are encrypted independently in `image-host-credentials.bin`; Main injects them only into a freshly started Connector Worker, while Gitee and GitHub repository tokens remain outside this boundary.
- Gitee and GitHub repository tokens are encrypted independently in `repository-credentials.bin`; owner, repository name, branch, and configured field names remain metadata, and no runtime receives the tokens until a dedicated repository broker exists.
- Bilibili, YouTube, and Twitch secrets are encrypted independently in `live-platform-credentials.bin`; Main injects them only into a freshly started Live Worker or explicitly activated Server compatibility backend while room, application, video, and channel identifiers remain metadata.
- The E2B API key is encrypted independently in `code-sandbox-credentials.bin`; Main injects it only into the Execution Engine and explicitly activated legacy backend while engine state and validated sandbox URL remain metadata.
- The Home Assistant long-lived access token is encrypted independently in `home-assistant-credentials.bin`; Main injects it only into the MCP Worker and explicitly activated Server compatibility backend while enabled state and the validated endpoint remain metadata.
- The global Comfy.org API key is encrypted independently in `comfyui-credentials.bin`; Main injects it only into the Execution Engine and explicitly activated legacy backend while validated server endpoints and configured field names remain metadata.
- Generic webhook URLs, sensitive headers, and Discord webhook URLs are encrypted independently in `delivery-credentials.bin` by canonical workspace, task ID, and target. Main injects only one matching scope into one private delivery-dispatch request; Task Worker, Core SQLite, task JSON, and unrelated runtimes receive configured metadata only.
- Provider credentials enter the Execution Engine or explicit legacy compatibility backend only through one bounded child-process environment bootstrap and are redacted before Python persistence.
- Claude Code, Qwen Code, and OpenAI Codex custom configuration resolves one selected key from the Provider boundary immediately before invocation. External CLI children receive no `OPENXNET_*` variables or `*_CREDENTIALS_B64` envelopes; custom mode clears ambient native Provider credentials before injecting the selected key.
- Installed CLI login state and native credential files remain owned by each CLI. OpenXnet does not inspect, copy, migrate, or rewrite them; custom Codex mode writes only secret-free temporary metadata and never creates `auth.json`.
- Voice credentials enter only the independently supervised Voice Worker and the explicitly activated Server compatibility backend. Provider credentials enter Voice Worker only for configured OpenAI ASR/TTS. Both envelopes remain absent from Connector Worker and are redacted before Python persistence or WebSocket output.
- Generic MCP credentials enter only the MCP Worker for the explicitly activated Server scope or the explicit Server compatibility backend. They never enter Execution Engine; custom HTTP credentials enter the Execution Engine and compatibility backend. Both are redacted before Python persistence or WebSocket output.
- Connector credentials enter only a freshly started optional Connector Worker. Renderer, legacy backend, Worker RPC payloads, and unrelated workers receive redacted metadata only.
- Desktop Connector lifecycle requests use exact typed IPC and contain platform plus bounded non-secret metadata only. Status and stop do not activate an inactive capability; start and reload await credential rotation before Main activates the Worker.
- Connector Chat uses an independent process-scoped bearer, exact Main loopback Broker, and a second Engine bearer. Only Connector Worker receives the caller origin and token; provider errors are replaced before returning across the Broker.
- Connector Voice uses another independent bearer and a dedicated exchange subdirectory. Input and output audio cross the process boundary by validated temporary references; only an actual TTS or ASR operation activates the Voice Worker, never `legacy-backend`.
- Desktop microphone ASR uses one sender-authorized typed IPC. Renderer sends a bounded `ArrayBuffer`, Main immediately writes a private artifact, and only the artifact reference enters Voice Worker; Browser/Server alone retain `/ws/asr`.
- Telegram credentials enter only Connector Worker, the legacy compatibility backend, and Execution Engine; rotation invalidates those consumers without stopping Voice Worker.
- Image-host credentials enter only a freshly started optional Connector Worker; rotation stops that Worker without invalidating unrelated runtimes.
- Repository credentials remain Main-only at rest; they have no environment bootstrap, runtime subscriber, or child-process consumer.
- Live-platform credentials enter only the Live Worker and explicit Server compatibility backend; rotation stops those consumers without invalidating Execution Engine, Task Worker, Connector Worker, Voice Worker, or unrelated runtimes.
- Code-sandbox credentials enter only the Execution Engine and explicit legacy backend; rotation invalidates both runtimes while unrelated Workers remain active.
- Home Assistant credentials enter only the MCP Worker and explicit Server compatibility backend; rotation stops those consumers without invalidating Execution Engine or unrelated Workers.
- Execution Engine receives only the private MCP Tool Broker origin and an independent bearer. It never receives Home Assistant credentials, MCP Worker environment, or direct upstream transport details.
- External Chrome MCP receives a minimal child environment and runs only exact BrowserMCP or Playwright MCP entries installed by `npm ci --ignore-scripts` from the Pack-hashed lockfile. OpenXnet credential envelopes, Provider keys, ambient npm scripts, and dynamic `latest` package resolution never enter that child.
- SQL passwords are encrypted independently in `sql-credentials.bin`; SQLite paths require a Main-owned system-file authorization and cross Renderer, Runtime IPC, and Broker boundaries only as opaque UUIDs. The MCP Worker resolves the path or password internally and starts pinned `mcp-alchemy`, SQLAlchemy, and database drivers from the signed Pack without a system `uvx` dependency.
- ComfyUI credentials enter only the Execution Engine and explicit legacy backend; rotation invalidates both workflow-capable runtimes while Task Worker, Connector Worker, and unrelated Workers remain active.
- Task delivery credentials enter only one exact Execution Engine delivery request after Main route and compound-scope validation; they never enter a child-process environment.
- Desktop task RPC tokens live only in Main memory and the provider-engine/Worker process environments.
- Desktop Chat streams carry only ordered Base64 response chunks and bounded public errors; provider credentials and the private engine origin remain Main/Engine-only.
- Desktop knowledge-base files use Core Artifact identity and controlled internal file references. Build, status, removal, and query requests carry only a stable knowledge-base ID plus bounded query fields; query responses exclude local paths and complex metadata.
- Desktop Control state is process-local and non-durable. Typed results retain window handles, process names, bounded geometry, and monitor metadata but remove executable paths; action history is discarded when the optional Worker exits.
- Toolchain state is process-local and non-durable. Typed requests select only fixed Node, uv, or Docker operations; child environments exclude OpenXnet and credential-like variables, while public results exclude executable paths, stdout, stderr, and raw Docker failures.
- Recall workspace selection remains Main-owned. Worker responses are capped at 4 MiB and reject credential fields, internal snapshot paths, process paths, stdout, and stderr; checkpoint rollback receives only the Main-injected workspace and one validated ID.
- Developer Workbench workspace selection remains Main-owned. Repository and search requests derive their root from the secret-free Main settings snapshot, while snapshot files live under the application user-data directory, reject credential fields, and never enter a Python process.
- VR asset identity and type remain Main-owned. User files use generated UUID names under the application asset directory; built-in resources are read-only extraResources, and cloud URLs are derived only from a fixed catalog.
- Extension and skill install targets remain Main-owned. Renderer submits real ZIP Files, repository metadata, stable IDs and fixed actions, never commands, target paths, ports, environments or workspace paths.
- Extension pages use a separate loopback Origin and sandboxed iframe. Node extension code is explicitly user-started third-party code with current-user OS privileges; process supervision and environment filtering are not represented as an OS sandbox.
- Global skills live under `~/.agents/skills`; project skill writes require the Main-owned configured workspace to match a persisted or native-dialog directory grant.
- The temporary legacy Renderer-state bridge may read the Python-compatible SQLite files but must not copy that payload into the primary Core database or accept new state domains.
- Account gateway bootstrap, Provider, Search, Voice, MCP, custom HTTP, Connector Worker, Telegram, image-host, repository, live-platform, code-sandbox, Home Assistant, SQL, ComfyUI, webhook, and delivery credentials are separate trust zones and must not be merged into a generic shared vault.
- Provider, Search, Voice, MCP, custom HTTP, the six-platform Connector Worker, Telegram, image-host, repository, live-platform, code-sandbox, Home Assistant, SQL, ComfyUI, and task delivery credentials now have exact independent boundaries.
- Every application-managed credential domain currently identified in the code has an explicit contract. External CLI custom credentials reuse the Provider contract, while CLI-owned native login state remains outside OpenXnet ownership by design.
- The managed subscription provider resolves its key from the authentication trust zone only for matching managed metadata and gateway URL; it is never copied into the ordinary provider credential sidecar.
- Workers receive scoped inputs and return scoped outputs.
- Models, VRM assets, and media tools are versioned assets, not embedded Python modules.
- Feature packs maintain their own cache and may maintain private derived indexes.

## Packaging

The base desktop package contains Electron, local UI assets, one small shared VR runtime resource set, bundled Agent Skills, Application Core, the worker supervisor, and separate compatibility-server and Execution Engine entrypoints over one shared provider/tool dependency collection. Its backend excludes the Server task compatibility router, legacy Task Scheduler runtime, and duplicate VR resources. Voice, vector indexing, long-term memory and Recall, document processing, connectors, live transports, MCP integrations, Desktop window control, and other heavyweight dependencies are separate signed feature packs. Large VRM models remain on-demand user assets rather than base-package contents.

Each feature pack includes:

- a signed manifest;
- protocol compatibility metadata;
- platform and architecture constraints;
- content hashes;
- an atomic installation layout;
- rollback metadata.

## Migration Rule

The migration follows a strangler pattern. A typed client is introduced in front of the legacy FastAPI service. Domains move one at a time from legacy HTTP routes to Application Core or a worker. The Renderer contract remains stable during each move. Desktop cold start is a protected boundary: new mount-time network calls require an owning typed capability and must not activate `legacy-backend`.
