# Phase 3L Worker-Owned Terminal Delivery

## Status

Phase 3L moves desktop terminal delivery selection, retry timing, attempt
identity, and outcome publication from the legacy backend scheduler into the
supervised Task Worker. The backend retains only the authenticated external
delivery broker because connector credentials and live overlay services must
remain inside its trusted boundary.

## Ownership

| Concern | Owner in Phase 3L |
| --- | --- |
| Terminal task and delivery target selection | Task Worker |
| Attempt identity, retry timing, and attempt ceiling | Task Worker |
| Bot, webhook, and overlay credentials | Backend delivery broker |
| External delivery side effect | Backend delivery broker |
| Compatibility delivery record | Worker-local Task Center mirror |
| Durable desktop delivery facts and events | Application Core |

The desktop backend compatibility scheduler now has both schedule activation
and terminal delivery disabled. Server profile retains its existing scheduler
and direct delivery behavior for browser and non-Electron clients.

## Runtime Flow

```text
Terminal execution checkpoint
    |
    v
Task Worker scheduler tick
    |
    | deterministic due-attempt policy
    | stable dly_<digest> attempt ID
    v
POST /v1/tasks/executor/delivery/dispatch
    |
    | bearer-authenticated, task-bound request
    v
Backend delivery broker
    |
    | reads private target configuration
    | executes external adapter once per in-process attempt ID
    | returns a generic typed result
    v
Task Worker
    |
    +--> tasks.delivery outcome event
    |        |
    |        v
    |    Application Core SQLite + terminal-delivery event
    |
    +--> compatibility delivery record + checkpoint
```

## Typed Contracts

The broker request uses `openxnet.task-terminal-delivery-request.v1` and
contains only:

- stable attempt, task, workspace, and target identity;
- a one-based attempt number;
- no target configuration, bot token, webhook URL, provider record, or task
  result body.

The broker response uses `openxnet.task-terminal-delivery-result.v1`. Raw
adapter errors are converted into generic retryable or permanent failures.
Successful, retryable, and exhausted outcomes become
`openxnet.task-terminal-delivery-outcome.v1` Worker events.

Application Core strictly validates outcome fields, timestamps, state
combinations, and payload lengths. It merges delivery records without changing
the task's `completed`, `failed`, or `cancelled` execution state. Repeated
attempt IDs and non-increasing attempt numbers are idempotent.

## Retry Policy

Desktop delivery uses a dependency-light bounded policy:

- at most three attempts per target and terminal run;
- retry delays of 15 seconds, 60 seconds, and 300 seconds;
- retry only for transport, rate-limit, server, or explicitly retryable broker
  failures;
- permanent failure for missing configuration, unsupported adapters, and
  rejected credentials;
- stable attempt IDs derived from task, target, attempt number, and terminal
  run timestamp.

Recurring runs reset delivery attempt state before their next activation. A
missing or malformed persisted retry timestamp becomes immediately eligible so
corrupt metadata cannot leave delivery stuck forever.

## Security Boundary

The broker route is covered by the desktop Task RPC bearer-token middleware and
accepts only the configured canonical workspace, an existing terminal task,
and a configured non-local target. Broker responses never reflect adapter
exceptions or target configuration.

`TaskCenter.serialize_task()` removes each delivery record's `config` before a
snapshot can reach Task Worker or Application Core. Core SQLite stores delivery
outcomes and public diagnostics only. The Task RPC token and delivery secrets
remain absent from Renderer, SQLite, task outcome events, and logs.

## Failure Semantics

The broker caches the latest 1,024 attempt results in process memory so a lost
response can be retried with the same attempt ID without repeating the external
side effect while the backend process remains alive. The overall contract is
at-least-once across a simultaneous Worker and backend restart; webhook
consumers can use the stable attempt ID when they require downstream
deduplication.

Core receives the typed outcome before the Worker updates the compatibility
task file. If the compatibility write fails, Core still retains the delivery
fact and the next Worker tick reuses the same broker attempt ID.

## Verification

Phase 3L regression coverage verifies exact broker fields, bearer token use,
loopback origin policy, malformed result rejection, raw error redaction,
three-attempt retry selection, retry persistence, recurring-run reset,
delivery-config isolation, Worker outcome events, Core terminal authority,
Core idempotency, disabled desktop compatibility scheduling, and a full Worker
stdio/session/delivery smoke.

## Next Migration

Completed in Phase 3M: desktop `tasks.create`, `tasks.start`, `tasks.resume`,
`tasks.cancel`, delete, scheduler projection, and scheduler activation now use
direct typed Task Worker persistence plus a read-only provider preflight
broker. Server-profile HTTP task APIs remain until browser clients receive an
equivalent Core boundary.
