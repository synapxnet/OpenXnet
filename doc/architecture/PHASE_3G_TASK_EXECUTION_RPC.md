# Phase 3G: Authenticated Task Execution RPC

## Status

Implemented on 2026-07-23. Renderer task surfaces no longer call
`/v1/tasks/*` or the developer-workbench task creation route. Desktop Core is
the authoritative task writer and coordinates the remaining Python executor
through a supervised, authenticated worker.

## Execution Flow

```text
Renderer
  -> allow-listed preload API
  -> sender-authorized Electron IPC
  -> ApplicationTaskExecutionService
  -> tasks capability / NDJSON Worker protocol
  -> task execution Worker
  -> bearer-authenticated loopback HTTP
  -> legacy Python scheduler and executor
```

Core persists a task before asking Python to create an execution mirror. The
same Core UUID is used as the compatibility `task_id`, which makes retries
idempotent. Python execution state can enrich the Core record but cannot revive
a tombstoned task or reverse an authoritative terminal transition.

Existing workspace directories are canonicalized with the native filesystem
realpath before Core derives their partition ID. Windows 8.3 paths, junctions,
and other directory aliases therefore reconcile into the same task catalog.

## Renderer Contract

The typed preload exposes:

- `refreshTaskExecutions`;
- `getTaskExecution`;
- `createDeveloperWorkbenchTaskExecution`;
- `dispatchTaskExecution`;
- `startTaskExecution`;
- `resumeTaskExecution`;
- `cancelTaskExecution`;
- `deleteTaskExecution`;
- `onTaskExecutionChanged`.

The direct application-task contract is intentionally narrower. Renderer may
list, get, and create durable tasks, but it cannot call Core reconciliation,
transition, or deletion primitives. All execution-related state changes pass
through the coordinator, and every Main handler validates the exact Renderer
sender before parsing the payload.

Developer-workbench creation is also Core-owned. The Renderer sends a bounded
form with a fixed workflow kind. TypeScript Core generates the standardized
title, prompt, scheduling metadata, and context, persists the Core UUID, then
dispatches the mirror. The old HTTP route remains only for non-desktop legacy
profiles and is token-protected in the desktop profile.

## Core Coordinator

`ApplicationTaskExecutionService` serializes commands and Worker events so two
writers cannot reconcile the same task concurrently. It activates the `tasks`
capability only when a task surface needs execution data.

Refresh performs three operations:

1. Read the current Python execution snapshot.
2. Reconcile valid newer records into Core.
3. Retry up to ten missing pending mirrors created by the Renderer, UI-plan, or
   developer workbench.

Dispatch failures do not remove the Core task. Core keeps it pending, appends an
event, and records a bounded compatibility error for a later idempotent retry.
Cancellation and deletion commit to Core first. Their Python operations are
best effort, so an unavailable executor cannot undo the user's durable action.

## Worker Boundary

The task Worker supports `tasks.list`, `tasks.get`, `tasks.create`,
`tasks.start`, `tasks.resume`, `tasks.cancel`, and `tasks.delete`. It publishes
changed task lists as uncorrelated `tasks.snapshot` events. The current watcher
reads the legacy executor once per second; this polling is isolated behind the
Worker contract and can later be replaced with executor-native push without a
Renderer change.

Worker requests accept only an exact loopback HTTP origin with an explicit
port, no credentials, and no path, query, or fragment. Task IDs allow only
bounded alphanumeric, hyphen, and underscore characters. HTTP responses are
limited to 8 MiB, matching the Core reconciliation budget. Backend response
bodies and transport reasons are not copied into Worker errors.

## Authentication

Electron Main generates a new 32-byte base64url token for each application
process. The token exists only in Main memory and in the environment of the
desktop backend and task Worker. It is not exposed through preload, Renderer,
SQLite, command arguments, or application logs.

In the desktop runtime profile, the backend fails closed when the token is
missing or invalid for:

- every `/v1/tasks*` route;
- `/v1/dev/workbench/tasks/create`.

The Worker sends the token as an `Authorization: Bearer` header, and the backend
compares it with `secrets.compare_digest`. Server and browser-oriented runtime
profiles retain their compatibility behavior until they receive an equivalent
typed client.

## Packaging

Development launches `python -m py.workers.task_execution_worker`. A non-packaged
launch may set `OPENXNET_PYTHON_EXECUTABLE` to select a diagnosed interpreter;
packaged execution ignores this override. Packaged Windows builds use
`resources/server/task-worker.exe`. `server.spec` produces
the backend and task Worker executables from the same source collection, while
the task Worker starts only when the `tasks` capability is activated.

## Verification

Automated coverage includes:

- Core-first workbench creation and stable UUID mirror identity;
- missing-mirror repair and Core-authoritative cancellation;
- sender authorization and handler cleanup for every execution channel;
- authenticated Worker requests, strict loopback origins, snapshot events, and
  backend error redaction;
- source-contract checks that both Renderer task surfaces contain no direct
  task HTTP calls and that preload exposes no low-level mutation channels.

At this checkpoint Desktop Core passes 58 tests and Renderer ownership passes 4
tests. Python Worker protocol and execution adapter tests are part of the full
architecture suite.

## Remaining Boundary At Phase 3G

At the end of Phase 3G, Python still owned scheduling, sub-agent execution,
checkpoints, and detailed progress production. Phase 3H subsequently moved the
schedule clock and due policy, while Phase 3I added native bounded checkpoint
events and reduced the one-second watcher to a 30-second recovery fallback.
SubAgent execution itself and the remaining desktop `/v1/tasks*` compatibility
routes still require migration before the backend adapter can be retired.
