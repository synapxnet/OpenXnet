# Phase 3H Worker-Owned Task Scheduler

## Status

Phase 3H moves the desktop schedule clock and due-task policy from the legacy
backend runtime into the supervised Task Worker. The legacy backend remains an
authenticated execution adapter while task execution is migrated incrementally.

## Ownership

| Concern | Owner in Phase 3H |
| --- | --- |
| Durable task identity, revision, status, and events | Application Core |
| Scheduler process lifecycle | Electron Main and Desktop Core coordinator |
| Polling clock, recurrence projection, and due-task selection | Task Worker |
| Provider-readiness guard and atomic execution activation | Legacy backend |
| Subtask execution and executor-native progress | Legacy backend |
| Terminal delivery adapters | Legacy backend compatibility scheduler |

Desktop profile starts the compatibility scheduler with schedule activation
disabled. This preserves delivery behavior without allowing the backend and the
Task Worker to activate the same due task.

## Runtime Flow

```text
Electron Main
    |
    | legacy backend ready
    v
ApplicationTaskExecutionService.startScheduler()
    |
    | tasks.scheduler.start
    v
Supervised Task Worker
    |
    | every 15 seconds
    +--> GET  /v1/tasks/list
    +--> POST /v1/tasks/scheduler/project/{task_id}
    +--> POST /v1/tasks/scheduler/activate/{task_id}
    +--> tasks.snapshot event
             |
             v
        Application Core reconciliation
```

`tasks.scheduler.start` is idempotent at the Worker-process level and performs
an immediate tick before the long-lived loop starts. `tasks.scheduler.status`
returns bounded clock diagnostics, and `tasks.scheduler.tick` supports
deterministic diagnostics without exposing a Renderer mutation surface.

## Schedule Policy

The dependency-light policy supports:

- `SECONDLY`, `MINUTELY`, `HOURLY`, `DAILY`, and `WEEKLY` RRULE frequencies;
- optional `RRULE:` prefixes and bounded time fields;
- `every N seconds/minutes/hours/days/weeks` natural intervals;
- `hourly`, `daily`, and `weekly` aliases;
- projection of missing recurring `next_run_at` values;
- deterministic due-time ordering for once and recurring tasks;
- a 90-second suppression window after an execution mirror is queued;
- timestamp comparison across timezone-aware and local naive values.

Unsupported or malformed expressions produce a bounded scheduler error instead
of importing a heavyweight scheduling dependency into the base desktop runtime.

## Security Boundary

Main creates one random task RPC token and passes it only through the backend and
Task Worker process environments. Every `/v1/tasks/*` route, including the new
scheduler projection and activation adapters, requires the exact bearer token in
desktop profile. The token is never persisted in SQLite, sent to Renderer, or
written to logs.

The Worker accepts only exact loopback HTTP origins, caps backend responses at
8 MiB, and converts backend failures to generic diagnostics. Projection errors
are normalized and bounded before persistence.

## Activation Semantics

The Worker computes a schedule decision, but it cannot directly launch an
executor. The backend rechecks provider readiness and calls the Task Center's
atomic activation method. Successful activations use
`trigger_source=worker_scheduler_due`, update scheduler metadata, and then start
the existing background executor.

This split prevents policy duplication while retaining one atomic compatibility
gate during migration. A stale or duplicate decision returns a conflict and does
not create another task or executor run.

## Verification

Phase 3H regression coverage verifies schedule projection, due selection,
malformed RRULE handling, Worker bearer authentication, scheduler route
classification, activation metadata, delivery-only legacy behavior, Worker
snapshot publication, and Desktop Core scheduler startup coordination.

## Next Migration

The next task phase moves executor-native progress and checkpoint publication
behind the Task Worker protocol. The backend execution adapter and delivery
compatibility loop can be retired only after equivalent typed Worker contracts
exist for all desktop and server clients.
