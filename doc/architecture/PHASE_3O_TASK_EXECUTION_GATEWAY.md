# Phase 3O Task Execution Gateway

## Status

Phase 3O removes the supervised Task Worker's startup dependency on the full
legacy Python backend. Desktop Main now owns a lightweight authenticated
Task Execution Broker Gateway that starts before either Python process.

The Task Worker receives only the gateway's ephemeral loopback origin through
the `brokerOrigin` command field. The gateway accepts the five exact preflight,
session, cancellation, evaluation, and delivery routes established in earlier
phases. It rejects unknown paths, query strings, non-POST methods, invalid Host
headers, missing bearer credentials, and request bodies over 2 MiB before any
provider engine is activated.

## Startup Flow

```text
Electron Main
    |
    +--> Desktop Core ready
    +--> Worker RPC Gateway ready
    +--> Task Execution Broker Gateway ready
    +--> Local UI Gateway ready
    +--> Task Worker schedule clock ready
    |
    | no provider request yet
    v
Legacy Python backend remains stopped

first dynamic UI or task provider request
    |
    v
coalesced legacy-backend capability activation
    |
    v
existing provider/tool engine
```

The `tasks` capability now depends only on `core`. Starting the schedule clock
therefore launches the smaller Task Worker without activating
`legacy-backend`. A due execution or delivery request can activate the provider
engine through the gateway. Static UI requests never activate Python; the
Local UI Gateway uses the same on-demand activation callback only for dynamic
HTTP or WebSocket traffic.

## Broker Ownership

`TaskExecutionBrokerGateway` owns the Desktop-facing network boundary:

- process-scoped constant-time bearer authentication;
- an exact five-route allow-list;
- loopback Host and upstream-origin validation;
- a bounded request body read before heavyweight activation;
- coalesced provider-engine activation;
- streamed SSE response forwarding and disconnect propagation;
- generic activation and proxy errors that do not expose credentials.

The Task Worker no longer receives or names a legacy backend origin. Its
preflight, session, cancellation, and terminal-delivery clients all use the
Main-owned broker origin. Provider configuration, target credentials, and raw
adapter diagnostics remain outside Worker, Renderer, Core SQLite, and events.

## Python Module Boundary

The five FastAPI route implementations now live in
`py.task_execution_broker_api`, not `server.py`. The module owns request models,
workspace and task/session validation, preflight result shaping, legacy stream
translation, completion result shaping, cancellation, and idempotent delivery
attempts.

`server.py` supplies explicit adapters for:

- provider readiness;
- the existing provider/tool stream engine;
- the simple completion evaluator;
- provider-stream abort;
- credential-retaining terminal delivery.

This dependency-injected boundary preserves the existing tool-capable task
behavior. It deliberately does not replace task turns with a reduced direct
OpenAI call. Server profile registers the same broker module directly and
continues to register its separate browser task compatibility API.

## Failure Semantics

Starting Desktop Core, the local UI, the Task Execution Gateway, or the Task
Worker does not wait for provider readiness. Provider-engine activation begins
only after an authenticated broker request. Concurrent requests share the same
Core activation promise.

If activation fails, the gateway returns a generic retryable HTTP 503. If the
activated engine cannot complete a request, it returns a generic HTTP 502.
Task Worker keeps scheduled work pending or applies the existing bounded
delivery retry policy. Cancellation remains Core-first and best effort across
the gateway.

## Packaging

The Desktop backend package contains `py.task_execution_broker_api` and its
three typed protocol modules, while Server-only task commands and the legacy
scheduler remain excluded. The Task Worker explicitly excludes the broker
server module, FastAPI, provider SDKs, LangChain, Mem0, document parsers,
NumPy, Torch, Transformers, backend routes, and delivery adapters.

`SessionMemoryStore` now resolves its optional overlay notification adapter
dynamically. This prevents PyInstaller from following an optional UI event
into the complete backend route graph. In the formal Windows build, the Task
Worker executable decreased from 22,057,088 bytes to 10,542,068 bytes while
retaining its complete task execution smoke behavior.

## Verification

Phase 3O coverage verifies:

- lazy activation after authorization and exact-route validation;
- no activation for unknown, unauthorized, or oversized requests;
- SSE streaming through the Main-owned gateway;
- static UI delivery without backend activation;
- `tasks` capability independence from `legacy-backend`;
- `brokerOrigin` use with the removed `backendOrigin` Worker field;
- exact five-route ownership in the extracted Python module;
- secret-free preflight and completion responses;
- session-bound cancellation and idempotent terminal delivery;
- real Desktop and Server route tables;
- Task Worker preflight, session events, cancellation, checkpoints, delivery,
  scheduler ordering, and stdout framing.

## Next Migration

Phase 3P should move the provider/tool adapters behind an independently
supervised execution-engine process. The Main-owned gateway and Task Worker
protocol do not need to change. The next implementation should extract tool
registry initialization and provider client construction from `server.py`,
package the new engine separately, add readiness and idle-shutdown budgets,
and then remove the gateway's transitional activation of `legacy-backend`.
