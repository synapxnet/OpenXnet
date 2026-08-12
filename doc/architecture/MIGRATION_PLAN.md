# Desktop Refactor Migration Plan

## Progress

- Phase 1 completed: contracts, Desktop Core, Worker protocol, standards, and compatibility IPC.
- Phase 2 completed: local UI Gateway, background Python activation, shared static resources, and optional browser runtime loading.
- GitNexus extraction completed: integrity-checked feature pack, atomic install/rollback, deferred activation, and self-contained Node runtime.
- Local Sherpa ASR extraction completed: authenticated Core RPC, artifact-based Voice Worker, independent pack, and idle shutdown.
- Vector extraction completed: MiniLM, Kernel indexing, persistent Mem0 and knowledge-base FAISS operations now use the artifact-based Vector Worker and independent pack.
- SciPy removal completed: FunASR PCM conversion and BM25 ranking are dependency-free; NumPy remains behind the documented Mem0 import boundary.
- Memory extraction completed: Mem0 search/add orchestration now runs in an independent Memory Worker; the base backend contains no Mem0, Qdrant Client, or NumPy runtime.
- Document extraction completed: PDF and Office parsing now run in an independent artifact-based Document Worker; parser SDKs are optional dependencies.
- Google REST cleanup completed: YouTube live chat and Google Custom Search now use direct bounded REST clients; Google API Python Client and LangChain Google Community are absent from the base package.
- Connector extraction completed: QQ, Feishu, Dingtalk, Discord, and Slack now run in an authenticated optional Connector Worker and their SDKs are absent from the base package.
- Phase 5 implementation completed: Ed25519-signed catalogs and manifests, anti-rollback state, bounded trusted download, safe tar extraction, atomic install/repair/removal, typed IPC progress, and the Ops Vite management UI.
- Phase 6 implementation completed: one tested BrowserWindow security baseline, sandboxed least-privilege preloads, sender-authorized IPC, safe navigation/webviews, bounded native file and screenshot operations, deny-by-default permissions, security headers, and removal of unauthenticated LAN backend exposure.
- Phase 3A application-settings ownership completed: migration-managed Core SQLite, idempotent legacy imports, authorized settings IPC, Core-first Renderer writes, runtime startup reads, and atomic rollback mirrors.
- Phase 3B priority identified by isolated smoke data: split the monolithic Renderer bootstrap and enforce a first-interactive-frame budget before migrating another state domain.
- Phase 3B Renderer bootstrap completed: build-time Vue template compilation, one Core startup snapshot, on-demand Vite/3D surfaces, structured milestones, and a 10-second regression budget reduced measured hydration from 34.8 seconds to 4.733 seconds.
- Phase 3C route-owned initialization completed: unreachable hidden DOM removal, first-frame idle scheduling, menu-owned service probes, lazy audio creation, and a 3-second workspace budget reduced measured hydration to 1.581 seconds.
- Phase 3D authentication ownership completed: authorized typed IPC, Core SQLite account metadata, OS-encrypted tokens and gateway bootstrap, one-time localStorage migration, serialized Renderer writes, and logout cleanup.
- Phase 3E application-artifact ownership completed: relational Core metadata, stable artifact IDs, lazy legacy reconciliation, authorized native import, compatibility upload registration, deletion tombstones, and Core-owned Renderer storage lanes.
- Phase 3F application-task ownership completed: relational Core tasks, stable UUIDs, optimistic lifecycle transitions, artifact references, append-only events, idempotent Python execution mirrors, stale-snapshot protection, and Core-first Renderer task surfaces.
- Phase 3G task-execution RPC completed: supervised `tasks` capability, authenticated loopback adapter, Worker snapshot events, Core-owned execution coordination, canonical workspace partitions, narrowed Renderer mutation rights, and typed developer-workbench creation.
- Phase 3H Worker scheduler ownership completed: supervised clock startup, dependency-light recurrence projection and due selection, authenticated scheduler adapters, atomic legacy executor activation, and delivery-only desktop compatibility runtime.
- Phase 3I executor checkpoints completed: bounded native progress production, authenticated backend-to-Worker publication, typed checkpoint events, Core merge/stale/cancellation rules, and a 30-second recovery snapshot fallback replacing one-second polling.
- Phase 3J supervised task execution completed: Worker-owned SubAgent jobs, canonical workspace/task deduplication, explicit backend routing, bounded execution options, direct checkpoints, cancellation-aware cleanup, nested-task RPC, and server-profile compatibility.
- Phase 3K execution-session broker completed: authenticated typed turns/evaluation/cancellation, provider-error redaction, Worker-safe event streaming, task-bound session ownership, and role-scoped restart recovery.
- Phase 3L terminal delivery ownership completed: Worker-selected terminal attempts, bounded retry policy, authenticated secret-retaining delivery broker, typed Core outcomes, idempotent delivery events, and disabled desktop compatibility delivery writes.
- Phase 3M direct task commands completed: Worker-local Task Center CRUD, recovery, recurrence projection and activation, read-only provider preflight, zero desktop persistence-route calls, and server-profile HTTP compatibility.
- Phase 3N task HTTP profile isolation completed: Server-only compatibility router, exact Desktop broker allow-list, hidden desktop commands, disabled legacy Desktop scheduler lifecycle, and physical Server task module exclusions from desktop packaging.
- Phase 3O task execution gateway completed: Main-owned authenticated broker origin, Task Worker startup independent from `legacy-backend`, lazy provider-engine activation, extracted broker API module, streamed forwarding, and `brokerOrigin` protocol naming.
- Phase 3P independent execution engine completed: request-leased Main supervision, exact authenticated engine profile, separate executable, readiness and idle budgets, extracted provider client construction and tool registry, and removal of task traffic from `legacy-backend` activation.
- Phase 3Q typed Desktop Chat completed: Response-compatible Renderer transport, authorized typed IPC, Main-owned stream leases, exact private Chat Engine routes, model/abort/tool/approval adapters, and removal of normal Chat traffic from `legacy-backend` activation.
- Phase 3R legacy Renderer-state startup completed: bounded Main-owned reads and writes over the existing SQLite files, typed settings/conversation/VRM IPC, Browser-only startup WebSockets, route-owned Desktop initialization, and a real Electron cold-start invariant that keeps `legacy-backend` stopped.
- Phase 3S provider credential ownership completed: Core-owned redacted metadata, Electron `safeStorage` keys, defensive legacy SQLite migration, typed Desktop validation and Workbench flows, child-scoped runtime injection, rotation invalidation, and plaintext-free real Electron migration smoke.
- Phase 3T account access ownership completed: Main-owned allow-listed transport, automatic token refresh, redacted auth snapshots, managed gateway-key isolation, typed Desktop account/subscription flows, and removal of normal account traffic from Python.
- Phase 3U search credential ownership completed: independent `safeStorage`, exact search/crawler key classes, defensive legacy migration, configured-only Renderer state, child-scoped Python hydration, persistence redaction, and removal of the prefilled Crawl4AI test key.
- Phase 3V voice credential ownership completed: independent `safeStorage`, default and bounded named-voice scopes, configured-only Renderer state, Provider-referenced OpenAI TTS/ASR, scoped Python hydration, persistence redaction, and generic voice vendor errors; Phase 3AK later narrowed Desktop execution to Voice Worker.
- Phase 3W tool credential ownership completed: independent MCP and custom HTTP `safeStorage` boundaries, exact configured-name projections, defensive duplicated-input migration, stable legacy HTTP tool IDs, least-privilege runtime injection, and generic tool errors.
- Phase 3X Connector Worker credential ownership completed: independent `safeStorage`, exact five-platform/six-field contracts, configured-only Renderer state, Worker-only dynamic runtime injection, rotation restart, and plaintext-free cold-start migration.
- Phase 3Y Telegram credential ownership completed: independent `safeStorage`, canonical configuration migration, configured-only Renderer state, exact legacy-backend and Execution Engine injection, rotation invalidation, and redacted manager/delivery errors.
- Phase 3Z image-host credential ownership completed: independent `safeStorage`, exact SM.MS/EasyImage field contracts, configured-only Renderer state, Connector Worker-only injection, upload hardening, repository-token isolation, and plaintext-free cold-start migration.
- Phase 3AA repository credential ownership completed: independent `safeStorage`, exact Gitee/GitHub token contracts, metadata-preserving migration, configured-only Renderer state, explicit no-runtime boundary, and plaintext-free cold-start migration.
- Phase 3AB live-platform credential ownership completed: independent `safeStorage`, exact Bilibili/YouTube/Twitch secret contracts, configured-only Renderer state, initially legacy-backend-only hydration, route normalization, generic transport errors, and plaintext-free cold-start migration; Phase 3AN later narrowed Desktop execution to Live Worker.
- Phase 3AC code-sandbox credential ownership completed: independent `safeStorage`, exact E2B key contract, configured-only Renderer state, Execution Engine and legacy-backend hydration, runtime invalidation, strict sandbox URL policy, bounded responses, and generic execution errors.
- Phase 3AD Home Assistant credential ownership completed: independent `safeStorage`, exact long-lived token contract, configured-only Renderer state, initially legacy-backend-only hydration, strict endpoint and redirect policy, explicit client cleanup, and generic lifecycle errors; Phase 3AO later narrowed Desktop execution to MCP Worker.
- Phase 3AE ComfyUI credential ownership completed: independent `safeStorage`, exact global Comfy.org key contract, configured-only Renderer state, Execution Engine and legacy-backend hydration, runtime invalidation, strict endpoint/redirect/size policy, bounded workflow files, and generic transport errors.
- Phase 3AF task delivery credential ownership completed: independent task-scoped `safeStorage`, pre-persistence Core and legacy-task migration, protected Renderer creation fields, exact Main broker-route injection, Execution Engine scope revalidation, strict webhook transport budgets, and generic delivery errors.
- Phase 3AG external CLI credential ownership completed: configured-only Claude/Qwen/Codex Provider references, reuse of the existing Provider boundary, custom-mode environment-only injection, OpenXnet envelope stripping, secret-free Codex runtime metadata, WSL argument isolation, output redaction, and CLI-native authentication non-ownership.
- Phase 3AH Connector Runtime IPC completed: sender-authorized five-platform lifecycle controls, exact non-secret metadata contracts, status without activation, credential-rotation ordering, direct Main-to-Worker requests, fixed public errors, Browser fallback retention, and Server-only compatibility routes.
- Phase 3AI Connector Chat Broker completed: separate Connector and Execution Engine bearers, exact Chat-only loopback routing, validation before lazy engine activation, bounded UTF-8 streaming, fixed upstream failures, five-platform client migration, and Server compatibility fallback.
- Phase 3AJ Connector Voice and Artifact Broker completed: independent Voice bearer, exact TTS/ASR operations, bounded temporary audio references, Main-owned settings projection, on-demand compatibility upstream, three-platform client migration, and removal of the Connector capability's static legacy-backend dependency.
- Phase 3AK configured Voice Runtime completed: OpenAI/FunASR/Sherpa ASR and all configured TTS engines now run in the independently supervised Voice Worker, Voice/Provider credentials are injected only into that Worker, Connector voice no longer activates `legacy-backend`, desktop `/asr` and `/tts` delegate through authenticated Worker RPC, and Voice Pack `2.0.0` includes verified provider dependencies.
- Phase 3AL Desktop ASR IPC completed: VAD and PTT recordings use sender-authorized typed preload IPC, Main writes bounded private artifacts and invokes Voice Worker, desktop audio no longer enters Base64 JSON or `/ws/asr`, final-result behavior remains shared, and Browser/Server WebSocket compatibility is retained.
- Phase 3AM Telegram Connector Runtime completed: six-platform typed lifecycle control, independent Telegram credential injection into Connector Worker, private Chat/ASR/TTS Broker adoption, direct behavior configuration, Browser/Server fallback retention, scoped three-runtime rotation, and Connector Pack `1.5.0` verification.
- Phase 3AN Live Runtime completed: sender-authorized typed lifecycle IPC, validated event broadcasting, dedicated optional Live Worker, shared framework-free controller, scoped live credential injection and rotation, Browser/Server compatibility adapters, and verified dependency-isolated Live Pack `1.0.0`.
- Phase 3AO MCP Runtime completed: typed Home Assistant lifecycle IPC, dedicated optional MCP Worker, private Main-owned MCP Tool Broker, Execution Engine schema/call adoption, scoped token injection and rotation, Browser/Server compatibility retention, and verified dependency-isolated MCP Pack `1.0.0`.
- Phase 3AP external Chrome MCP completed: typed external lifecycle IPC, shared MCP Worker and private Tool Broker adoption, exact BrowserMCP/Playwright choices, minimal child environment, Pack-hashed npm lock with 100 remote integrity entries, install-script denial, Browser/Server fallback retention, and verified MCP Pack `1.2.0`.
- Phase 3AQ SQL MCP completed: independent safeStorage password ownership, Main-only SQLite file authorization, typed credential/runtime IPC, shared MCP Worker and private Tool Broker adoption, fixed mcp-alchemy/SQLAlchemy/driver supply chain without uvx, Browser/Server fallback retention, and verified MCP Pack `1.3.0`.
- Phase 3AR generic MCP completed: dynamic per-Server typed Runtime integrations, HTTPS/WSS and loopback-only plaintext policy, Desktop stdio command denial, Worker-only scoped header hydration, private Broker discovery/calls, Execution Engine legacy-client suppression, Browser/Server fallback retention, and verified MCP Pack `1.4.0`.
- Phase 3AS Desktop knowledge-base Runtime completed: Core Artifact imports, sender-authorized typed IPC, request-leased private Execution Engine routes, direct bounded local-file reads, per-knowledge-base operation locks, path-free query results, Browser/Server fallback retention, and verified frozen-engine smoke.
- Phase 3AT Desktop Control Runtime completed: sender-authorized typed IPC, an independently supervised pywin32 Worker, exact action payloads, path-free window metadata, 30-second idle shutdown, Browser/Server fallback retention, and verified dependency-isolated Pack `1.0.0`.
- Phase 3AU Toolchain Runtime completed: sender-authorized typed IPC, fixed Node/uv/Docker commands, shell-free bounded process execution, credential-stripped child environments, path- and output-free public results, Browser/Server fallback retention, and verified real read-only smoke.
- Phase 3AV Recall Center Runtime completed: sender-authorized typed IPC, Main-injected workspace scope, local Memory Worker search/timeline/observation/checkpoint operations, Vector activation only for real Mem0 use, direct Desktop overlay focus events, Browser/Server fallback retention, and verified Memory Pack `1.1.0`.
- Phase 3AW general upload and Core Artifact migration completed: preload-owned File path extraction, bounded generated-file bytes, Main streaming imports, Gateway-owned artifact reads, removal of Desktop `/load_file` calls, Browser/Server fallback retention, and verified real Electron smoke with zero backend activations.
- Phase 3AX Developer Workbench Runtime completed: sender-authorized typed IPC for overview, repository summaries, bounded code search, credential-free snapshot lifecycle, native-dialog workspace authorization, local Agent mapping, Browser/Server fallback retention, and verified real Electron smoke with zero backend activations.
- Phase 3AY VR Asset Runtime completed: preload-owned File paths, bounded Main imports, fixed-catalog HTTPS cloud downloads, compatible UUIDv5 model IDs, Gateway-owned `/vrm/` reads, shared Electron extraResources packaging, Browser/Server fallback retention, and verified real Electron smoke with zero backend activations.
- Phase 3AZ Extension and Skill Runtime completed: typed Main-owned catalogs, safe bounded ZIP/GitHub installation, atomic update/rollback, isolated extension Origin, supervised minimal-environment Node processes, authorized workspace-only skill sync, extraResources bundled skills, Browser/Server fallback retention, and verified real Electron smoke with zero backend activations.
- Phase 3BA Enterprise Runtime completed: Main-owned role cards, knowledge-base metadata and redacted versions, workspace metadata, rebuildable sandbox projection, fixed-key Xnet configuration and bounded health checks, complete typed Desktop bridge enforcement, Browser/Server fallback retention, and verified real Electron smoke with zero backend activations.
- Phase 3BB Enterprise Insights Runtime completed: Main read-only Usage SQLite aggregation, request-leased private Neuro/KG Engine routes, exact response projection, rule-delete protection, repaired Browser compatibility contracts, and real Electron/Execution Engine smoke without legacy-backend activation.
- Phase 3BC Kernel Runtime completed: one sender-authorized operation IPC, dual-layer exact payload validation, request-leased private Engine dispatcher, structured inspectors/actions, Desktop event-status polling, lazy compatibility-route imports, Browser/Server fallback retention, and real Electron/Execution Engine smoke without legacy-backend activation.
- Phase 3BD Model Asset Runtime completed: Main-owned fixed-commit Sherpa/MiniLM downloads, exact byte and SHA-256 verification, legacy install recognition, Worker-aware atomic replacement/removal, typed progress IPC, Browser/Server SSE fallback retention, and real Electron smoke without legacy-backend activation.
- Phase 3BE Provider Runtime completed: Main-owned bounded model discovery and embedding-dimension probes, saved Provider ID credential binding, fixed local MiniLM dimensions, Browser/Server fallback retention, and real Electron smoke without Python or credential exposure.
- Phase 3BF Agent and Workflow Runtime completed: Main-owned atomic Agent snapshots, bounded A2A Card discovery, Core Artifact-backed ComfyUI Workflows, fixed Agent path derivation, Browser/Server fallback retention, and real Electron smoke without legacy-backend activation.
- Phase 3BG Memory Management Runtime completed: stable record IDs, sender-authorized typed IPC, Memory/Vector Worker-owned mutations, zero activation for missing collections, Browser/Server fallback retention, and verified frozen Memory Pack `1.2.0`.
- Phase 3BH Voice Presentation Runtime completed: typed TTS synthesis and voice catalogs, Main-owned GPT-SoVITS reference audio, Main-broadcast VRM events and configuration, Browser/Server fallback retention, and verified frozen Voice Pack `2.1.0`.
- Phase 3BI System and Artifact Runtime completed: Main-owned proxy/session application, fixed directory reveal, local network address, Core Artifact-backed sticker packs, strict Desktop bridge failures, Browser/Server fallback retention, and real Electron smoke without backend activation.
- Phase 3BJ Base Voice Package Boundary completed: compatibility voice catalogs prefer authenticated Voice Worker RPC, Voice/FFmpeg payloads and Tetos metadata are physically absent from the base package, the Windows base directory is 49.69% smaller, and frozen Server, Execution Engine, and Voice Pack smoke are verified.
- Phase 3BK Base MCP SQL Package Boundary completed: the independent MCP Worker is excluded from base collection, MCP SQL Server, SQLAlchemy, Greenlet, and database drivers are physically absent, the base directory is cumulatively 53.67% smaller than the Phase 3BJ audit baseline, and frozen base plus MCP Pack smoke are verified.
- Phase 3BL Base MCP Transport Package Boundary completed: local MCP clients are delayed to explicit Server source profiles, Desktop and Execution Engine use typed Runtime/private Broker paths, and MCP/FastAPI-MCP transport payloads are physically absent from the base package.
- Phase 3BM Optional Transitive Dependency Boundary completed: A2A, E2B, and DDG roots remain available while unused AWS, Selenium, Hugging Face, Safetensors, gRPC, and optional MCP/provider branches are excluded from the shared Analysis.
- Phase 3BN Shared Worker Analysis Boundary completed: independent Worker implementations no longer duplicate into shared `PYZ-00`, common protocol/runtime modules remain available, and the combined base directory reached 148,477,286 bytes and 916 files.
- Phase 3BO LangChain-Free Base Boundary completed: knowledge-base chunking and legacy metadata migration are dependency-free, search providers use direct bounded clients, LangChain/LangSmith are absent from the rebuilt base package, and the directory reached 132,837,245 bytes and 865 files.
- Phase 3BP Direct A2A Package Boundary completed: Agent Card discovery and task sending use one bounded direct HTTP client, Python-A2A and its provider/server closure are absent, and the directory reached 118,429,393 bytes and 829 files.
- Phase 3BQ External CLI and Dependency Boundary completed: Claude uses the installed CLI without embedding its SDK or authentication state, dependency groups and the 339-package lock are aligned, and the 127-row license inventory has no stale or mismatched entries.
- Phase 3BR Phase 4 Package Closeout completed: pywin32 is owned by Document/Desktop Control packs, both base archives and the physical directory pass the final exclusion audit, and the directory reached 105,840,058 bytes and 813 files, 77.56% below the original baseline.
- Phase 3BS Connector Settings Snapshot completed: six-platform lifecycle and typed hot-update configuration now projects bounded behavior/tool settings without Worker activation, Desktop Managers no longer read legacy settings, Browser/Server compatibility remains, Connector Pack `1.6.0` is verified, and Connector-owned source modules are absent from the 105,600,338-byte base directory.

## Completion Audit

Completed on 2026-07-30. The implementation exit criteria for Phases 1 through 6 are met: Desktop lifecycle and primary state are Core-owned, ordinary product workflows do not activate the legacy Python backend, optional Python/Node capabilities are independently owned and packaged, the base package contains only proven shared consumers, feature-pack distribution and window hardening are implemented, and the final architecture/full-regression/cold-start gates pass.

The following are explicit non-blocking operational or compatibility boundaries, not unfinished Desktop migration work:

- production release-key provisioning and update-feed publication remain release operations;
- N-1 protocol fixtures begin with protocol `2.x`, because `1.0` has no earlier supported contract;
- Browser/Server source transports and the user-opened Developer Workbench FastAPI documentation tab intentionally retain compatibility activation;
- the recorded post-build first-start timing fluctuation remains excluded from the defect list by project decision, while the stable cold-start budget continues to pass.

New desktop features must preserve the owner-first rules and regression guards documented below. Reintroducing a legacy backend dependency, Renderer credential copy, optional SDK in the base package, or Manager-owned settings read requires a new reviewed migration phase rather than reopening this completed plan implicitly.

## Phase 1: Contracts and Compatibility

- Introduce the Desktop Core capability registry.
- Expose a typed preload bridge while preserving the legacy APIs.
- Define the cross-language worker protocol.
- Add UTF-8 and function-documentation checks.
- Record startup and package-size budgets in CI.

Exit criteria: the current product starts normally and can report Core and legacy backend capability state through the new bridge.

## Phase 2: Local User Interface Boot

- Package the main Vue application as local Electron assets.
- Replace backend-relative asset URLs with an application asset resolver.
- Render the workspace before the legacy backend is ready.
- Show capability-specific progress instead of a global blocking splash screen.

Exit criteria: the main workspace is interactive when Python is unavailable.

## Phase 3: Application Core Extraction

- Completed system and startup runtime settings migration into TypeScript Core.
- Completed the single migration-managed SQLite store foundation.
- Completed authentication state persistence in TypeScript Core with OS-protected credentials.
- Completed file metadata and native file lifecycle migration into TypeScript Core.
- Completed task persistence in TypeScript Core using stable artifact input/output references.
- Completed task dispatch, cancellation, deletion, and event delivery migration from Renderer FastAPI calls to authenticated Core Worker RPC.
- Completed scheduler clock, recurrence projection, and due-task decisions behind the Task Worker contract.
- Completed executor-native progress and checkpoint production behind typed Task Worker events.
- Completed SubAgent execution, cancellation-aware job lifecycle, nested-task dispatch, and terminal checkpoint publication in the supervised Task Worker.
- Completed the typed execution-session broker between Task Worker and the backend provider/tool boundary.
- Completed terminal delivery and bounded retry policy behind typed Worker and Core contracts.
- Completed direct desktop task-mirror commands and replaced backend persistence mutations with a read-only provider preflight broker.
- Completed runtime and packaging separation between Desktop task brokers and browser/server task commands.
- Completed the lightweight Main-owned task execution gateway and removed the Task Worker's legacy-backend capability dependency.
- Completed the independently supervised provider/tool Execution Engine and removed task broker activation from the general Desktop backend lifecycle.
- Completed typed Desktop Chat streaming and commands through the independently supervised Execution Engine without starting the general Desktop backend.
- Completed legacy Vue state restoration through Main-owned typed IPC so Desktop hydration and Home idle initialization no longer activate the general Desktop backend.
- Completed model-provider metadata and credential extraction so Desktop Renderer and legacy SQLite retain configured booleans instead of durable plaintext keys.
- Completed Search, Voice, MCP, and custom HTTP credential extraction into four additional independent Main-owned encrypted boundaries.
- Completed configured-only MCP and custom HTTP Renderer state, explicit clear operations, Python runtime hydration, and persistence/WebSocket redaction.
- Completed Connector Worker credential extraction so QQ, Feishu, Dingtalk, Discord, and Slack secrets bypass Renderer persistence, legacy SQLite, and Worker RPC payloads.
- Completed Telegram credential extraction with bounded injection only into Connector Worker, the legacy transport backend, and task-delivery Execution Engine.
- Completed image-host credential extraction so SM.MS and EasyImage keys bypass Renderer persistence, legacy SQLite, and Worker RPC payloads while repository tokens remain independent.
- Completed repository credential extraction so Gitee and GitHub tokens bypass Renderer persistence, legacy SQLite, child-process environments, and Worker RPC while repository metadata remains editable.
- Completed live-platform credential extraction so Bilibili, YouTube, and Twitch secrets bypass Renderer persistence and legacy SQLite, entering only the dedicated Live Worker or explicitly activated Server compatibility backend in memory.
- Completed code-sandbox credential extraction so the E2B key bypasses Renderer persistence and legacy SQLite, entering only the Execution Engine and explicit compatibility backend in memory.
- Completed Home Assistant credential extraction so its long-lived token bypasses Renderer requests, persistence, and legacy SQLite, entering only the dedicated MCP Worker or explicitly activated Server compatibility backend in memory.
- Completed ComfyUI credential extraction so its global Comfy.org key bypasses Renderer persistence and legacy SQLite, entering only the Execution Engine and explicit compatibility backend in memory.
- Completed generic and Discord webhook credential extraction so each exact workspace/task/target scope bypasses Core SQLite, task JSON, Task Worker payloads, and process-wide environments before request-scoped Execution Engine hydration.
- Completed external CLI credential extraction so Claude Code, Qwen Code, and OpenAI Codex custom configuration resolves from the existing Provider boundary without Renderer key copies, additional sidecars, credential-bearing arguments, or OpenXnet private child environment variables.
- Completed direct Desktop lifecycle control for QQ, Feishu, Dingtalk, Discord, Slack, and Telegram so Renderer no longer activates the general backend merely to proxy Connector Worker status/start/stop/reload requests.
- Completed the private Connector Chat Broker so ordinary and proactive six-platform Chat traffic enters Execution Engine without passing through the general backend.
- Completed the private Connector Voice and Artifact Broker and switched its actual TTS or ASR operations directly to the independent Voice Worker without activating the general backend.
- Completed configured upload-style ASR and all TTS extraction into Voice Worker while retaining standalone Browser/Server route compatibility.
- Completed desktop microphone ASR transport through typed IPC and private artifacts, removing the last desktop `/ws/asr` activation path.
- Removed the Core `connectors -> legacy-backend` dependency and raised the independent Connector Feature Pack to version `1.5.0` after Telegram private Chat and Voice client adoption.
- Completed the bounded Connector settings snapshot and typed `update` boundary, raising the independent Connector Feature Pack to `1.6.0` while removing Connector-owned Manager, private-client, and settings modules from the shared base PYZ.
- Completed direct Desktop live lifecycle and event delivery through a dedicated Live Worker, removing `/api/live/*` and `/ws/live/danmu` from the Desktop call path while preserving Browser/Server compatibility.
- Completed direct Desktop Home Assistant lifecycle and tool execution through a dedicated MCP Worker and private Tool Broker, removing `/start_HA` and `/stop_HA` from the Desktop call path while keeping its token out of Execution Engine.
- Completed external Chrome MCP lifecycle and tool execution through the same typed MCP boundary, removing `/start_ChromeMCP` and `/stop_ChromeMCP` from the Desktop call path and replacing runtime `npx latest` resolution with a signed exact lockfile installation.
- Completed SQL MCP lifecycle, file authorization, credential isolation, and tool execution through the typed MCP boundary, removing Desktop SQL lifecycle routes and `uvx` from the runtime supply chain.
- Completed generic remote MCP lifecycle, per-Server tool discovery and calls through dynamic typed integrations, while denying Renderer-controlled stdio commands and retaining Browser/Server compatibility.
- Completed Desktop knowledge-base file import, build, status, removal, and query through Core Artifacts and typed request-leased Execution Engine routes, while retaining Browser/Server compatibility endpoints.
- Completed Desktop window, monitor, active-window, history, and action flows through typed IPC and an optional Desktop Control Worker, removing high-frequency `/api/desktop/*` polling from the Desktop call path.
- Completed Desktop Node, uv, and Docker toolchain flows through typed IPC and a Main-owned shell-free Runtime, removing `/api/node`, `/api/uv`, and `/api/docker` from the Desktop call path.
- Completed Desktop Recall bootstrap, search, timeline, observations, interrupted-turn recovery, checkpoint rollback, and overlay focus through typed IPC and the optional Memory Worker, removing `/v1/memory/*`, `/v1/engine/*`, and observation-focus HTTP from the Desktop Recall call path.
- Completed Desktop storage, Chat attachment, long-text reader, character-card PNG, avatar, and knowledge-base imports through Core Artifact, removing general Desktop `/load_file` traffic and serving internal Artifact URLs directly from the Local UI Gateway.
- Completed Desktop Developer Workbench overview, repository scanning, code search, snapshot lifecycle, workspace application, and Agent mapping through a Main-owned TypeScript Runtime, removing these `/v1/dev/workbench/*` routes from the Desktop call path.
- Completed Desktop VRM model, VRMA motion, and Gaussian scene listing, import, deletion, cloud download, and file serving through a Main-owned TypeScript Runtime and Local UI Gateway, removing these asset routes from the Desktop call path.
- Completed Desktop extension and skill listing, preview, install, update, removal, project sync, crystallization, and Node lifecycle through Main-owned TypeScript Runtimes, removing `/api/extensions/*` and `/api/skills/*` from the Desktop management path.
- Completed Desktop enterprise role-card, knowledge-base metadata/version, workspace metadata, sandbox projection, and Xnet configuration/health flows through a Main-owned TypeScript Runtime, removing these `/v1/enterprise/*` paths from the Desktop enterprise management path.
- Completed Desktop Usage aggregation in Main and Neuro/KG reads and mutations through typed request-leased private Engine routes, removing `/v1/usage/*` and `/v1/neuro/*` from the Desktop enterprise insight path without creating a second cognitive-store writer.
- Completed Desktop LLM model discovery and embedding-dimension probes through the Main-owned Provider boundary, removing `/llm_models` and `/api/embedding_dims` from the Desktop path without activating Python or returning stored credentials.
- Completed Desktop Agent snapshots, A2A Card discovery and ComfyUI Workflow file lifecycle through typed Main and Core Artifact boundaries, removing their legacy WebSocket/HTTP transports from the Desktop path.
- Completed Desktop TTS synthesis, system/provider voice catalogs, GPT-SoVITS reference audio, and VRM event/configuration flows through typed Main and Voice Worker boundaries without activating the general backend.
- Completed Desktop proxy application, fixed application-directory reveal, local network address, sticker-pack image import, and strict file-library fallback behavior through Main System and Core Artifact boundaries.
- Retired desktop task persistence route registration while retaining browser commands in the isolated Server compatibility module.

All application-managed credential domains currently identified in the code
have explicit ownership and consumer boundaries. Installed external CLI login
state remains CLI-owned and is intentionally not read, copied, or migrated by
OpenXnet. Any new feature-specific secret still requires its own classification
and typed contract before implementation.

The Developer Workbench FastAPI documentation tab intentionally remains an
explicit compatibility-backend activation surface. It is not loaded during
startup or ordinary application workflows; Browser/Server compatibility
transports and Local UI Gateway static/artifact reads remain supported.

Exit criteria: Python no longer owns desktop lifecycle or primary application state.

## Phase 4: Capability Workers

- Keep configured upload-style ASR, all TTS engines, and voice catalogs outside the base backend through the completed Voice Worker `2.1.0` boundary.
- Keep Voice provider SDKs, FFmpeg, and Tetos distribution metadata physically absent from the shared Server and Execution Engine directory through the completed Phase 3BJ package boundary.
- Keep desktop VAD/PTT ASR outside the base backend through the completed typed IPC boundary; Browser/Server `/ws/asr` remains a compatibility-only route.
- Keep FAISS, ONNX Runtime, Tokenizers, and Transformers out of the base backend through the completed Vector Worker boundary.
- Keep Mem0, Qdrant Client, and NumPy outside the base backend through the completed Memory Worker boundary.
- Keep PDF and Office parser SDKs outside the base backend through the completed Document Worker boundary.
- Keep Google API Python Client and LangChain Google Community outside the base backend through the completed direct REST boundary.
- Keep QQ, Feishu, Dingtalk, Discord, Slack, and Telegram transport dependencies outside the base backend through the completed Connector Worker boundary.
- Keep Connector Manager, private Chat/Voice client, and settings-snapshot implementations outside shared `PYZ-00` through Phase 3BS; Desktop configuration must enter Connector Worker only through exact lifecycle or update contracts.
- Keep Bilibili, YouTube, and Twitch transport lifecycles outside the base backend through the completed dedicated Live Worker `1.0.0` boundary.
- Keep Home Assistant MCP transport and credentials outside the base backend and Execution Engine through the completed MCP Worker `1.0.0` and private Tool Broker boundary.
- Keep external BrowserMCP and Playwright MCP transport outside the base backend through the completed MCP Worker `1.2.0`, private Tool Broker, and Pack-hashed Node lock boundary.
- Keep SQL and generic remote MCP transports outside the base backend through the completed MCP Worker `1.4.0`, per-Server dynamic integrations, private credential hydration, and private Tool Broker boundary.
- Keep MCP SQL Server, SQLAlchemy, Greenlet, and database drivers physically absent from the shared Server and Execution Engine directory through the completed Phase 3BK package boundary.
- Keep MCP Client, FastAPI-MCP, SDK transport, and Server-only MCP implementations physically absent from Desktop and Execution Engine through the completed Phase 3BL profile boundary.
- Keep unused optional A2A/E2B cloud, browser, model-download, and gRPC branches outside the shared Analysis through Phase 3BM, then remove the Python-A2A root itself through the bounded direct HTTP client completed in Phase 3BP while retaining tested E2B and DDG roots.
- Keep independent Worker implementation modules outside shared `PYZ-00`, while retaining only common protocol/runtime contracts and the separately built Task Worker through Phase 3BN.
- Keep LangChain and LangSmith outside the base runtime through Phase 3BO local knowledge-base primitives, strict legacy pickle migration, and direct bounded search clients.
- Keep pywin32 window-control execution behind the completed optional Desktop Control Worker `1.0.0`; Browser/Server retain the compatibility FastAPI adapter.
- Keep Recall Center reads and Memory Management mutations behind the completed Memory Worker `1.2.0`; Browser/Server retain remote federation and HTTP/SSE compatibility routes.
- Continue validating GitNexus feature-pack distribution independently from the base installer.
- Keep dependency declarations and the license inventory aligned through the completed Phase 3BQ base/Feature Pack groups, 339-package lock, and zero-stale 127-row license audit.
- Keep pywin32 physically outside the base package through Phase 3BR; retain Pillow for desktop-vision image processing, `primp/lxml` for DDGS, and Protobuf for E2B until those proven base consumers move behind another capability boundary.

Exit criteria met: the base application contains no optional-capability heavyweight Python or model dependency. Remaining shared packages have direct Execution Engine consumers, explicit ownership, and regression guards; after the Phase 3BS owner-source cleanup the final directory is 105,600,338 bytes and 813 files, 77.61% below the original package baseline.

## Phase 5: Feature Pack Distribution

- Completed Ed25519 detached signatures for catalogs and manifests while retaining per-file content hashes.
- Completed on-demand installation, progress, atomic repair, removal, local version rollback, and restart signaling.
- Completed independent Feature Pack versions and platform/architecture catalog selection.
- Completed HTTPS, redirect, download-budget, archive safety, compatibility, signature, payload, and anti-rollback checks.
- Completed release-side signing, archive packaging, and catalog assembly commands.

Exit criteria met in implementation: optional capabilities can be updated without rebuilding the base desktop installer. Production enablement requires release-key provisioning and feed publication.

## Phase 6: Hardening

- Completed removal verification for `@electron/remote` and remote-module access.
- Completed Renderer sandboxing and context isolation for every BrowserWindow.
- Completed removal of `webSecurity: false`, Node-enabled VRM, and broad helper-window preloads.
- Completed sender, URL, path, download, extension, screenshot, VMC, navigation, webview, and permission policies.
- Completed authenticated Worker RPC verification and disabled the unauthenticated `0.0.0.0` legacy backend mode.
- Completed development and packaged Electron UI smoke under the hardened policy.
- Defer N-1 fixtures until protocol `2.x`; version `1.0` has no earlier supported contract.

Exit criteria met in implementation: all production windows use least-privilege preload APIs and signed runtime components. Restoring LAN access and external-site permissions requires the dedicated authenticated brokers recorded in the Phase 6 document.
