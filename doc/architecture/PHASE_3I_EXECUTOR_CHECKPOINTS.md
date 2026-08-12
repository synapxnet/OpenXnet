# Phase 3I Executor-Native Checkpoints

## Status

Phase 3I moves desktop executor progress and recovery checkpoints from a
one-second full-list polling dependency to a typed, authenticated Task Worker
event path. The legacy backend still runs the SubAgent executor, but every
durable task write now produces a bounded language-neutral checkpoint.

## Runtime Flow

```text
Legacy SubAgent executor
    |
    | TaskCenter durable save
    v
Bounded execution checkpoint
    |
    | authenticated Main Worker RPC Gateway
    | tasks.executor.checkpoint
    v
Supervised Task Worker
    |
    | tasks.checkpoint event
    v
ApplicationTaskExecutionService
    |
    | applyExecutionCheckpoint
    v
Application Core SQLite + append-only task event
```

The checkpoint publish is scheduled only after the Python task file is durable.
It is detached and best-effort so a progress write cannot be blocked by Main or
Worker availability. This also prevents a re-entrant deadlock when the backend
is currently serving a command initiated by the same Task Worker.

## Checkpoint Contract

`openxnet.task-execution-checkpoint.v1` contains:

- canonical workspace path and compatibility task identity;
- bounded task title, description, agent, and schedule identity for recovery;
- status, progress, result/error summaries, and lifecycle timestamps;
- current iteration, runtime session, heartbeat, interruption, activation,
  scheduler, and delivery metadata;
- at most 20 sanitized recent execution-trace entries;
- a 256 KiB total checkpoint budget.

Conversation history, raw model responses, credentials, and unbounded executor
objects are not transported through the checkpoint channel.

## Core Merge Rules

Application Core accepts checkpoints only through a validated `tasks.checkpoint`
event from the supervised Task Worker. Existing Core identity, source, artifact
references, title, description, and agent metadata remain authoritative.

Core applies execution status, progress, lifecycle timestamps, next-run state,
bounded summaries, and a details patch. Each accepted update increments the
task revision and appends an `executor-checkpoint` event. Checkpoints whose
source timestamp is stale are ignored. A running checkpoint cannot overwrite a
Core-committed cancellation.

If a legacy execution has no Core row yet, the self-contained checkpoint can
create its initial migrated record using the workspace-scoped compatibility ID.

## Security And Failure Handling

The backend uses the process-scoped `OPENXNET_WORKER_RPC_ORIGIN` and
`OPENXNET_WORKER_RPC_TOKEN` inherited from Electron Main. Publication accepts
only exact loopback HTTP origins. Main allow-lists only
`tasks.executor.checkpoint` for the tasks capability and enforces a 1 MiB
gateway body limit before the Worker's stricter 256 KiB checkpoint validation.

Checkpoint delivery failure never fails the executor write. The Task Worker
retains a changed-snapshot recovery watcher at a 30-second interval, replacing
the previous one-second full task-list poll. Command responses and scheduler
mutations still force immediate snapshots where compatibility requires them.

## Verification

Regression coverage includes bounded trace production, bearer authentication,
loopback origin policy, Worker field and payload validation, Worker event
forwarding, Core merge behavior, stale checkpoint rejection, Core cancellation
authority, preservation of Core details, and detached publication after durable
task persistence.

## Next Migration

The next task phase moves SubAgent execution commands and cancellation-aware job
lifecycle into the supervised Task Worker. The legacy backend can be removed
from desktop task execution only after provider access, tool streaming, terminal
delivery, and restart recovery have equivalent Worker-owned contracts.
