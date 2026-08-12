# Phase 3M Direct Task Worker Commands

## Status

Phase 3M removes the Desktop Task Worker's dependency on FastAPI task
persistence commands. Desktop create, read, start, resume, cancel, delete,
recurrence projection, and scheduled activation now operate directly on the
canonical workspace Task Center mirror. The backend retains a read-only
provider preflight broker and does not read or mutate Task Center state for
that check.

Server-profile task HTTP APIs remain compatible for browser and non-Electron
clients. This phase changes desktop ownership, not the public server contract.

## Ownership

| Concern | Owner in Phase 3M |
| --- | --- |
| Durable desktop task identity and lifecycle | Application Core SQLite |
| Compatibility task-mirror commands | Supervised Task Worker |
| Workspace Task Center files | Supervised Task Worker process role |
| Recurrence projection and due activation | Supervised Task Worker |
| Provider readiness and bounded token budget | Backend preflight broker |
| Provider/tool execution session | Backend session broker |
| External terminal delivery side effects | Backend delivery broker |
| Browser and server-profile task HTTP commands | Backend compatibility API |

Python task files remain execution mirrors. They cannot overwrite Core UUID,
cancellation, deletion tombstones, optimistic revisions, or append-only Core
events.

## Command Flow

```text
Renderer typed command
    |
    v
Application Core
    |  commit Core task or terminal fact first
    v
Task Worker stdio command
    |
    +--> direct TaskWorkerTaskStore mutation
    |        |
    |        v
    |    workspace/.agent/tasks/*.json
    |
    +--> tasks.snapshot or tasks.checkpoint event
             |
             v
         Application Core reconciliation
```

Commands that begin model execution add one read-only gate before the direct
mirror mutation:

```text
create-immediate / start / resume / scheduled due run
    |
    v
POST /v1/tasks/executor/preflight
    |  exact task ID + canonical workspace + operation
    |  bearer authenticated, no provider settings
    v
READY + bounded maxTokens
    |
    v
direct Task Center mutation -> local SubAgent job
```

Scheduled terminal delivery still runs before recurring activation. If
preflight is not ready or unavailable, the Worker leaves the task inactive and
persists one generic, deduplicated scheduler diagnostic.

## Direct Store Contract

`TaskWorkerTaskStore` validates the canonical existing workspace, task IDs,
bounded text, exact UTF-8 JSON context, scheduling fields, recovery actions,
and a 256 KiB creation-context budget. It provides:

- list and detail serialization through `TaskCenter.serialize_task()`;
- Core UUID-preserving idempotent creation;
- pending-only manual start and terminal-only resume;
- idempotent cancellation and deletion;
- recurrence projection, generic readiness-block state, and atomic activation;
- a path-contained, UTF-8, 1 MiB consensus read.

Delivery record configuration continues to be stripped from serialized task
objects. Direct persistence does not grant the Worker access to provider,
connector, bot, or webhook credentials.

## Preflight Contract

The request schema is `openxnet.task-execution-preflight-request.v1` and
contains exactly:

- `taskId`;
- canonical `workspacePath`;
- one of `create`, `start`, `resume`, or `scheduled`;
- the schema identifier.

The response schema is `openxnet.task-execution-preflight-result.v1` and
contains only readiness, `READY` or `PROVIDER_NOT_READY`, a generic message,
and bounded `maxTokens`. The route rejects extra fields, requires the desktop
Task RPC bearer token, verifies the configured canonical workspace, and never
returns model IDs, URLs, API keys, headers, or complete settings.

## Startup and Failure Semantics

Desktop starts the schedule clock as soon as the compatibility backend is
healthy. If Main has not supplied a workspace yet, the Worker reports
`waitingForWorkspace` and starts polling automatically after the first typed
task command establishes a canonical workspace. It does not recover the path
through `/v1/tasks/list`.

Immediate creation checks provider readiness before creating its execution
mirror. Once preflight succeeds, creation is idempotent: a Worker restart can
reissue the same Core UUID and continue starting the local job. Start and
resume also preflight before changing mirror state. Cancellation commits the
mirror cancellation before joining the local job, while Core has already
committed its authoritative cancellation.

The remaining generic `_request_json` path in Task Worker is used only for
best-effort execution-session cancellation. Typed preflight and terminal
delivery use their dedicated bounded clients.

## Compatibility

The following server-profile routes are intentionally unchanged:

- `/v1/tasks/list`, `/v1/tasks/{id}`, and `/v1/tasks/create`;
- `/v1/tasks/start/{id}`, `/v1/tasks/resume/{id}`, and
  `/v1/tasks/cancel/{id}`;
- `/v1/tasks/scheduler/project/{id}` and
  `/v1/tasks/scheduler/activate/{id}`.

Desktop Worker code contains no references to those persistence paths. They
can be retired from the desktop package only after browser/server clients have
an equivalent typed ownership boundary.

## Verification

Phase 3M regression coverage verifies exact preflight fields and bearer use,
loopback-only routing, ready and not-ready results, response-smuggling
rejection, secret-free result construction, direct CRUD and idempotency,
stored recovery actions, projection and activation, deduplicated schedule
blocks, consensus limits, Worker snapshots, and terminal-delivery ordering.

The stdio smoke creates and starts a task through direct Worker commands, runs
the typed execution session, delivers its terminal result, executes a
scheduler tick, and fails if any legacy task persistence HTTP path is used.

## Next Migration

Completed in Phase 3N: browser/server task commands now live in a dynamically
registered Server compatibility router, while Desktop exposes only typed
brokers and excludes the Server router and legacy scheduler from packaging.
