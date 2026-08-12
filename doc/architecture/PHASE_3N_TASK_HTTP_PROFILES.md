# Phase 3N Task HTTP Profile Isolation

## Status

Phase 3N separates browser/server task commands from the Desktop task broker
surface. Both deployments still share Task Center and execution primitives,
but they no longer register or package the same HTTP route set.

Desktop profile exposes only the exact provider preflight, execution-session,
and terminal-delivery broker routes required by Task Worker. Server profile
dynamically registers the browser compatibility router and starts the legacy
Task Scheduler runtime.

## Route Matrix

| Route family | Desktop profile | Server profile |
| --- | --- | --- |
| `/v1/tasks/executor/preflight` | Bearer-authenticated | Available |
| `/v1/tasks/executor/session/*` | Bearer-authenticated | Available |
| `/v1/tasks/executor/delivery/*` | Bearer-authenticated | Available |
| `/v1/tasks/list`, get, and create | Not registered, HTTP 404 | Compatible |
| start, resume, cancel, and delete | Not registered, HTTP 404 | Compatible |
| scheduler project and activate | Not registered, HTTP 404 | Compatible |
| developer-workbench task create | Not registered, HTTP 404 | Compatible |
| legacy Task Scheduler runtime | Not started | Started |

Unknown `/v1/tasks/executor/*` paths are not treated as brokers. In Desktop
they belong to the hidden server-compatibility family and return HTTP 404.
This prevents future compatibility routes from accidentally inheriting the
Desktop bearer surface through a broad prefix match.

## Server Compatibility Module

`py.server_task_api` owns all browser-oriented request models, normalization,
Task Center commands, recovery selection, scheduler adapters, consensus
loading, and server-owned executor launches. `server.py` injects settings,
provider readiness, workbench prompt construction, Task Center access, bounded
executor options, and the loopback origin.

The module registers only when `RUNTIME_PROFILE == "server"`. Its descriptor
route, `/v1/tasks/capabilities`, returns
`openxnet.server-task-api.v1` with public commands, scheduler adapters, and an
explicit `desktopAvailable: false` marker. Existing task response bodies and
paths remain compatible.

Readiness failures from create and developer-workbench commands now preserve
their intended HTTP 503 status instead of being converted into a generic HTTP
500 by a broad exception handler.

## Desktop Runtime

`server.py` contains direct decorators only for the five exact typed broker
routes. Profile middleware resolves each request through the pure
`task_http_profile` policy:

- hidden Server commands return non-cacheable HTTP 404;
- Desktop brokers require the process-scoped Task RPC bearer token;
- unrelated routes retain their existing behavior;
- Server profile does not require the Desktop process token.

The Desktop lifespan no longer constructs `TaskSchedulerRuntime`. Task Worker
already owns recurrence projection, activation, terminal delivery, and retry,
so a disabled compatibility object has no remaining Desktop responsibility.

## Packaging

`server.spec` filters `py.server_task_api` and `py.task_scheduler` out of the
Desktop backend's collected `py` modules and lists both as explicit Analysis
exclusions. Server source deployments load them dynamically from the shared
codebase. The packaged Desktop backend therefore cannot be switched into a
partial Server profile by changing an environment variable; Server deployment
must use the Server runtime distribution.

Task Worker packaging is unchanged and continues to include direct Task Center,
preflight, session, checkpoint, and terminal-delivery code.

## Verification

Phase 3N coverage verifies:

- exact broker classification and unknown-path rejection;
- Desktop command invisibility and broker bearer requirements;
- Server command and broker visibility without a Desktop token;
- absence of compatibility decorators from `server.py`;
- explicit Desktop packaging exclusions;
- the versioned Server capability descriptor;
- Server create, list, get, start, cancel, resume, delete, workbench, projection,
  and scheduled activation behavior;
- readiness HTTP 503 preservation;
- real `server.py` route tables under both runtime profiles.

Formal packaging must also inspect the packaged archive and prove that
`py.server_task_api` and `py.task_scheduler` are absent before the temporary
validation root is removed.

## Next Migration

Completed in Phase 3O: Desktop Main now owns a lightweight authenticated Task
Execution Broker Gateway, Task Worker starts without the legacy backend, and
the five broker route implementations live in a dependency-injected Python
module outside `server.py`.
