# Phase 3J Supervised Task Execution

## Status

Phase 3J moves desktop SubAgent command execution, concurrent job ownership,
deduplication, and cancellation awareness from the legacy backend process into
the supervised Task Worker. The backend remains the provider and tool-streaming
engine during this phase, but it no longer owns desktop executor task lifetime.

## Runtime Flow

```text
Application Core command
    |
    | tasks.create / tasks.start / tasks.resume
    v
Supervised Task Worker
    |
    | authenticated atomic backend mutation
    v
Legacy backend task mirror
    |
    | command response with bounded execution_options
    v
Worker executor job registry
    |
    | detached SubAgent job using explicit backendOrigin
    v
Backend chat/provider/tool stream
    |
    | direct tasks.checkpoint events
    v
Application Core task state
```

Backend task routes use the same state-transition code for desktop and server
profiles. Desktop routes only commit the queue/activation state and return.
Server routes retain the compatibility `asyncio.Task` launch path.

## Executor Ownership

An active job is keyed by the platform-canonical workspace path plus the legacy
task ID. `tasks.executor.start` is idempotent for that key. The Worker returns
the existing lifecycle record when a duplicate start arrives and never creates
two SubAgent loops for the same task mirror.

The registry exposes bounded, secret-free diagnostics through
`tasks.executor.status`. Completed, failed, and cancelled jobs publish their
latest persisted checkpoint and remove themselves from the active registry.
Unexpected Worker-side failures persist a generic task failure without leaking
backend paths or provider data.

## SubAgent Contract

`SubAgentExecutor` no longer loads a full settings object and no longer calls
`get_port()`. Its constructor accepts only:

- an existing workspace path;
- an exact loopback HTTP backend origin;
- a clamped `max_tokens` value from 256 through 65,536;
- an optional in-process checkpoint publisher.

Provider keys, provider records, account tokens, and complete settings objects
do not enter the Task Worker protocol, Renderer, SQLite, or logs. Workspace
consensus is read by the Worker as bounded UTF-8 and cannot resolve outside the
canonical workspace.

## Nested Tasks And Re-entrancy

Backend tools can create or start a nested task while serving the parent
SubAgent stream. They call Main's authenticated Worker RPC Gateway using
`tasks.executor.start` with only the workspace, task ID, exact backend origin,
and bounded token option.

The Worker handler creates a detached job and responds immediately. The stdio
request loop therefore remains available while the parent job is waiting on
the backend stream. This avoids a Worker -> backend -> Main -> same Worker
re-entrancy deadlock. Nested cancellation commits Task Center cancellation
first and then best-effort cancels the Worker-local job.

## Cancellation Authority

Desktop Core remains authoritative. It commits `cancelled` before calling
`tasks.cancel`. The Worker then:

1. mirrors cancellation to the backend Task Center;
2. cancels and joins the matching local `asyncio.Task`;
3. publishes the terminal checkpoint and immediate recovery snapshot.

SubAgent terminal checks and Task Center terminal guards prevent late running
or failure writes from replacing a committed cancellation.

## Packaging

The packaged `task-worker` executable now includes `httpx`, `py.sub_agent`,
`py.task_center`, and checkpoint production. Heavy provider SDKs, FastAPI,
OpenAI, NumPy, Torch, and Transformers remain excluded from this Worker. Build
verification must use temporary PyInstaller work and distribution directories
so existing `dist/server` release artifacts are never overwritten.

## Verification

Regression coverage includes exact loopback origin validation, bearer
authentication, least-privilege nested-start payloads, workspace/task job
deduplication, local cancellation, scheduler activation launch, direct native
checkpoint publication, Task Center persistence, Core cancellation authority,
Worker RPC allow-listing, and WorkerSupervisor event delivery.

## Next Migration

The next task phase should replace backend chat/provider/tool streaming with a
typed execution-session broker. Provider credentials must remain in a dedicated
trusted boundary; they must not be copied into task payloads. Once terminal
delivery and restart recovery also have Worker-owned contracts, desktop task
persistence and execution routes can be retired from the legacy backend.
