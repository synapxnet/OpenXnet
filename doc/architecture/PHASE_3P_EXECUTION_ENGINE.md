# Phase 3P Independent Execution Engine

## Status

Phase 3P removes task provider and tool traffic from the Desktop
`legacy-backend` lifecycle. Desktop Main now supervises a dedicated
`execution-engine` process that is started only after an authenticated task
broker request and stopped after five minutes without an active request.

The Task Worker protocol and the five-route Main-owned Task Execution Broker
Gateway remain unchanged. The Gateway now acquires one request lease from the
engine supervisor. A lease stays active through a complete JSON response or SSE
stream, so idle shutdown cannot terminate an in-flight provider or tool turn.

## Process Flow

```text
Desktop Main
    |
    +--> Desktop Core
    +--> Task Execution Broker Gateway
    +--> Task Worker schedule clock
    |
    | no provider request
    v
Execution Engine and legacy backend remain stopped

authenticated task provider request
    |
    v
ExecutionEngineSupervisor.acquire()
    |
    +--> start execution-engine process once
    +--> parse ephemeral port handshake
    +--> verify bearer-authenticated /health
    +--> hold request lease through JSON or SSE completion
    +--> stop after five idle minutes
```

Dynamic Local UI requests still activate `legacy-backend` through their own
compatibility callback. Task requests never use that callback and no longer
start the general Desktop backend.

## Engine Boundary

The `execution-engine` runtime profile creates a fresh FastAPI application
after the shared provider/tool source has loaded. Its route table contains only:

- bearer-authenticated `GET /health`;
- `POST /v1/tasks/executor/preflight`;
- `POST /v1/tasks/executor/session/turn`;
- `POST /v1/tasks/executor/session/evaluate`;
- `POST /v1/tasks/executor/session/cancel`;
- `POST /v1/tasks/executor/delivery/dispatch`.

Unknown routes and query strings return 404. Invalid Host headers return 403,
wrong methods return 405, and missing or invalid process credentials return
401. OpenAPI, documentation, static files, generic chat routes, Server task
commands, and the Local UI route graph are absent from the engine application.

## Provider And Tool Ownership

Provider adapter selection and scoped client construction now live in
`py.execution_provider_runtime`. Both legacy tool-dispatch maps now use the
single lazy registry in `py.execution_tool_registry`. Arbitrary extra tool
callbacks are rejected; only four explicitly owned callbacks can be injected
from the compatibility source.

This keeps the complete existing provider, MCP, policy, approval, CLI, browser,
and task-tool behavior. Phase 3P does not replace task turns with a reduced
direct OpenAI request.

The stream generation implementation is still shared with `server.py` so the
Server and Desktop compatibility profiles retain identical behavior during the
strangler migration. Runtime ownership is now separate even though the two
executables intentionally share one PyInstaller dependency collection.

## Supervision

`ExecutionEngineSupervisor` owns:

- coalesced process startup;
- a 120-second readiness budget;
- exact loopback-origin validation;
- authenticated health polling;
- non-secret lifecycle snapshots;
- active-request reference counting;
- idempotent request-lease release;
- five-minute idle shutdown;
- bounded graceful and forced termination;
- unexpected-exit recovery through Desktop Core capability state.

The private engine origin and bearer token never enter Renderer payloads, Core
SQLite, task events, or logs.

## Packaging

`server.spec` produces separate `server` and `execution-engine` executables
from the shared provider/tool dependency closure. Desktop Main launches the
dedicated executable in packaged builds and uses the same isolated runtime
profile through the project virtual environment in development.

The Task Worker remains the small dependency-excluded executable from Phase 3O.
Phase 3P targets activation and memory isolation, not installer-size reduction;
moving the provider engine into an optional signed feature pack can happen after
the Chat migration establishes a shared engine contract.

## Verification

Phase 3P coverage verifies:

- startup coalescing and one process for concurrent leases;
- no idle shutdown while any JSON or SSE request is active;
- idle shutdown after the final lease releases;
- token-free supervisor errors and Core snapshots;
- exact engine route table across Desktop, Server, and engine profiles;
- Host, method, query, and bearer rejection;
- extracted provider-client selection and tool-registry ownership;
- real ASGI startup, authenticated health, and isolated route probes;
- formal PyInstaller production of the separate engine executable;
- UTF-8, Python docstring, TypeScript JSDoc, and architecture tests.

## Follow-On Migration

Phase 3Q completed the primary Chat migration behind the same independently
supervised engine contract. Renderer model, chat, abort, tool, and approval
requests now use typed preload/Main contracts, so normal Chat use no longer
activates `legacy-backend`. See `PHASE_3Q_APPLICATION_CHAT.md`.
