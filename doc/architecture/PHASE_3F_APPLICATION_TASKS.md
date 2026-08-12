# Phase 3F: Application Task Ownership

## Status

Implemented on 2026-07-23. Durable task identity, lifecycle state, artifact
references, and event history are now owned by TypeScript Application Core.
Python remains the compatibility execution engine and scheduler, but its
`.agent/tasks/*.json` files are execution mirrors rather than the application
task database.

## Previous Risk

The legacy task center used short Python IDs and JSON files as both user-facing
identity and execution checkpoint. Renderer pages read and mutated those files
through FastAPI routes. This created long-term ownership problems:

- a task did not exist until Python was running and accepted the request;
- short IDs were unsafe as cross-module identities and could not be referenced
  reliably by artifacts, events, or future workers;
- task state disappeared from the desktop UI when the Python server was down;
- retries could create duplicate tasks after an ambiguous HTTP failure;
- stale worker files could revive a deleted task or overwrite newer UI state;
- task list responses repeatedly transferred complete execution details.

## SQLite Model

`desktop-core.db` schema version 3 adds three relational tables:

- `application_tasks` owns the stable UUID, workspace partition, revision,
  compatibility ID, parent UUID, lifecycle state, scheduling metadata, bounded
  details, result/error summaries, timestamps, source, and deletion tombstone;
- `application_task_artifacts` links ordered input and output artifact UUIDs;
- `application_task_events` stores a monotonically sequenced append-only state
  history.

The lifecycle is `pending`, `running`, `completed`, `failed`, or `cancelled`.
All explicit mutations accept an optional expected revision. Conflicts reject
instead of silently replacing a newer Renderer or worker update. Deletion is
soft and running tasks must first transition to `cancelled`.

Task inputs reference available `application_artifacts` rows. A missing,
deleted, unknown, or malformed input artifact is rejected before task creation.
Output artifact IDs received from a compatibility snapshot are also stored as
relationships rather than mutable paths.

Task list snapshots contain only presentation fields from `details`; the
single-task operation returns complete bounded details and the latest 1,000
Core events. Reconciliation accepts at most 500 entries and 8 MiB of UTF-8 JSON
per call.

## IPC Contract

The authorized preload exposes six operations:

- `listTasks({ workspacePath?, includeDeleted? })`;
- `getTask({ taskId })`;
- `createTask(request)`;
- `reconcileTasks({ workspacePath, tasks })`;
- `transitionTask(request)`;
- `deleteTask({ taskId, expectedRevision? })`.

Electron Main validates the sender before parsing or executing each request.
The Renderer never receives a database handle or a filesystem path mutation
primitive through this contract.

## Compatibility Execution Mirror

New desktop tasks follow a Core-first write sequence:

1. Core creates a durable UUID task in `pending` state.
2. Renderer asks `/v1/tasks/create` to create a Python mirror using that same
   UUID as the compatibility `task_id`.
3. Python validates the supplied ID, rejects traversal characters, and treats
   an identical repeated request as idempotent.
4. Python execution snapshots are reconciled into the existing Core row by the
   workspace-scoped `legacyTaskId`.

If dispatch fails after step 1, Core retains the task as `pending`, appends a
transition event, and records `compatibility_dispatch_pending` plus a bounded
error. Subsequent task polling retries the missing mirror with the same UUID.
This avoids both data loss and duplicate execution records.

Legacy eight-character Python IDs are retained in `legacyTaskId` while Core
assigns a UUID. Legacy parent IDs are resolved to Core UUIDs after each batch,
including when a child appears before its parent. Deleted Core rows retain a
tombstone, so an old Python file cannot recreate them. Snapshots with an equal
or older `updated_at` never overwrite current Core state. Newer snapshots must
also satisfy the Core state machine, so a late `running` update cannot reverse a
Core `cancelled` or `completed` terminal state.

Engine checkpoints are intentionally not stored in these tables. They are
turn-level execution recovery data and belong to the execution capability, not
the user-visible durable task record.

## Renderer Migration

Both the primary Renderer and UI-plan workspace load Core tasks before making
any Python request. The task center therefore remains readable when Python is
starting or unavailable. Python snapshots enrich Core state when available.

Create, cancel, and delete treat a successful Core mutation as authoritative.
Compatibility HTTP operations are best effort after that point. Task detail
loads Core first, then reconciles Python detail and re-reads Core so the newest
event sequence appears immediately.

The compatibility execution ID and Core UUID remain separate at the
presentation boundary. Start, resume, cancel, and legacy delete routes use the
execution ID; Core get, transition, and deletion operations use the UUID.

## Verification

Automated coverage includes:

- schema version 2 to version 3 migration and relational table creation;
- transition rules, optimistic conflicts, events, artifact references, and
  deletion tombstones;
- legacy identity reconciliation, parent UUID resolution, and stale snapshot
  rejection;
- cancellation authority over a newer but state-invalid running snapshot;
- 8 MiB reconciliation rejection, list summaries, and full detail retrieval;
- exact sender authorization and cleanup for all task IPC handlers;
- idempotent and traversal-safe Python task creation;
- source contracts for both Renderer entries and the preload bridge.

Desktop Core passes 53 tests, the Renderer startup/ownership suite passes 4
tests, and Python task persistence passes 2 tests at this phase checkpoint.

The final isolated development launch created schema version 3 with all three
task tables and rendered the precompiled workspace without visual errors. It
reported 1,716 ms process startup, 1,292 ms workspace hydration, a 37.3 ms Core
bootstrap, and a 1,049.2 ms Renderer workspace-ready milestone. Both the
10-second process budget and 3-second workspace budget passed.

## Remaining Boundary

Python still owns execution, scheduling, checkpoints, and detailed progress.
Renderer currently polls FastAPI and calls `reconcileTasks`; this is a staged
compatibility bridge, not the target architecture.

Phase 3G should move task dispatch, cancellation, and execution events behind an
authenticated Core worker RPC. Core should consume versioned worker events
directly and publish bounded task updates to Renderer. Once browser-only and
legacy clients have an equivalent typed client, `/v1/tasks/*` persistence
semantics and Renderer reconciliation can be retired.
