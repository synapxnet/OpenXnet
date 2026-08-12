# Phase 3R Legacy Renderer State

## Status

Implemented on 2026-07-26. Desktop startup now restores the remaining legacy
Vue settings, conversations, and VRM configuration through authorized typed IPC
without opening the legacy `/ws` connection or activating `legacy-backend`.
Browser profile behavior remains unchanged.

This is a temporary strangler boundary. It prevents the monolithic Python
backend from being started by Renderer hydration, but it does not make the
legacy databases part of the primary Application Core data model.

## Startup Audit

The Phase 3R audit found four hidden activation sources:

- `mounted()` opened `/ws` unconditionally to receive settings;
- Home idle initialization opened `/ws/tts`;
- Home idle initialization requested Desktop Control and Kernel approval data;
- `mounted()` requested access plans and refreshed the access session.

Desktop now follows this path:

```text
Renderer mounted
    |
    +--> typed getLegacyRendererState IPC
            |
            +--> Electron Main
                    |
                    +--> bounded read-only SQLite snapshot
                            +--> super_agent_party.db
                            +--> conversations.db
```

Home-owned TTS, Desktop Control, and approval initialization is skipped in the
Electron profile. Access-plan loading and access-session synchronization remain
available for explicit account interactions, but no longer run during Desktop
mount. The Browser profile still opens its WebSockets and performs its existing
startup calls.

The remaining Desktop global idle work is local: the server-port notice reads a
Main-memory value through IPC, and automatic update initialization only creates
timers. Neither operation activates `legacy-backend`.

## Compatibility Store

`LegacyRendererStateService` reads and writes the Python-compatible
`settings(id, data)` tables directly. Missing databases are not created by a
read. Writes use `BEGIN IMMEDIATE`, exact request fields, JSON cloning, and the
following bounds:

| Document | Limit |
| --- | ---: |
| Settings | 16 MiB |
| Conversations | 32 MiB |
| Conversation records | 10,000 |

The service supports the older settings-embedded conversations representation
as a read fallback. Renderer writes for settings, conversations, and VRMConfig
now use typed preload methods. Main publishes a bounded changed event after
writes made through this bridge.

Revisions are process-local compatibility counters, not durable Core revisions.
When the legacy backend is running, SQLite serializes file writes, but semantic
conflicts remain last-writer-wins. New product domains must not be added to this
bridge.

## Remaining Route Classification

| Class | Current examples | Required destination |
| --- | --- | --- |
| Core-owned | system settings, auth persistence, artifacts, tasks, Chat | Keep typed IPC; no Local UI fallback in Desktop |
| Temporary compatibility state | legacy Vue settings, conversations, VRMConfig | Split into typed domain documents, then remove this bridge |
| Existing Worker capability behind legacy UI routes | TTS/ASR, model status, vector index, memory, documents, connector bots | Add capability-specific typed IPC and call the existing supervised Worker directly |
| General legacy feature workflow | agents, skills/extensions, MCP, workflows, knowledge-base orchestration, live/VR helpers | Assign an owner, define a bounded contract, and migrate one workflow at a time |
| Account and Server profile | access plans/login operations and Browser-only HTTP/WebSocket compatibility | Keep explicit and profile-scoped; never run as Desktop cold-start work |

Dynamic Local UI requests still activate `legacy-backend` on demand. This is an
explicit compatibility action, not a startup dependency. Every remaining route
must either move to a Core contract, move to a supervised capability Worker, or
be declared Browser/Server-only before the general backend can be removed.

Phase 3AH subsequently moved QQ, Feishu, Dingtalk, Discord, and Slack lifecycle
controls to typed Desktop IPC and made their HTTP compatibility routes
Server-only. Phases 3AI and 3AJ subsequently moved Connector Chat and Voice
behind private Main Brokers and removed its static legacy-backend dependency;
Connector Managers still read this bounded compatibility settings mirror.

## Security Boundary

The legacy settings payload still contains provider configuration, including
credentials, and is restored into Renderer memory. This preserves existing
behavior but is not the target security model. The bridge intentionally does
not copy these values into `desktop-core.db`.

Phase 3S must extract provider credentials into Electron `safeStorage`, expose
only redacted provider metadata to Renderer, and pass credentials only to the
leased Execution Engine. Settings saved after that migration must not reinsert
secrets into `super_agent_party.db`.

## Verification

Coverage includes missing-database reads, legacy fallback, bounded writes,
sender authorization, changed events, Browser compatibility, and Renderer
startup source assertions. `smoke:desktop-cold-start` launches the real Electron
application with isolated user data, waits 2.5 seconds after workspace ready,
and verifies both the Core capability state and owned process state. It requires
the typed legacy-state restoration milestone and confirms that the Home/global
deferred tasks were registered before asserting that `legacy-backend` remains
stopped. Hidden-start smoke permits those idle tasks to remain scheduled because
Chromium throttles `requestIdleCallback` while the window is not visible.

This invariant concerns the monolithic compatibility backend. The independently
supervised Task Worker may still start for its owned schedule clock and does not
weaken the `legacy-backend` cold-start guarantee.
