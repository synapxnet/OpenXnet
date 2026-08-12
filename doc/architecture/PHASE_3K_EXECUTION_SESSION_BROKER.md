# Phase 3K Execution Session Broker

## Status

Phase 3K removes the supervised SubAgent's dependency on the generic chat and
simple-chat HTTP surfaces. Task Worker now consumes a versioned, authenticated
execution-session protocol while provider credentials and the existing tool
engine remain inside the backend trusted boundary.

This phase also fixes cross-process execution ownership. A freshly activated
backend task is no longer mistaken for a prior interrupted Worker task.

## Runtime Flow

```text
Task Worker executor job
    |
    | claim executor_owner_role + executor_session_id
    v
Task Center compatibility mirror
    |
    | authenticated task RPC token
    | openxnet.task-execution-turn.v1
    v
Backend execution-session broker
    |
    | internal provider/tool engine call
    | legacy stream translation
    v
openxnet.task-execution-event.v1
    |
    | text_delta / tool_event / error / done
    v
SubAgent state loop + native Core checkpoints
```

The Worker does not know the provider model ID, provider URL, API key, selected
provider record, or backend tool implementation. It sends only the task-bound
session ID, task/workspace identity, bounded text messages, and `maxTokens`.

## Broker Routes

All broker routes are under `/v1/tasks/executor/session/` and are therefore
protected by the process-scoped desktop Task RPC bearer token.

- `turn` accepts `openxnet.task-execution-turn.v1` and returns typed SSE.
- `evaluate` accepts `openxnet.task-execution-evaluation.v1` and returns only a
  correlated boolean completion decision.
- `cancel` accepts `openxnet.task-execution-cancel.v1` and aborts the bound
  provider stream after task cancellation has been committed.

The backend validates that the requested canonical workspace equals the
configured workspace, the task exists, and the session matches the task's
claimed executor session. Extra request fields are rejected.

## Event Contract

`openxnet.task-execution-event.v1` requires a stable `sessionId` and strictly
increasing sequence number. Supported events are:

- `text_delta`: bounded assistant text;
- `tool_event`: bounded phase, title, and result text;
- `error`: generic code, generic message, and retryable flag;
- `done`: terminal event with no additional payload.

The broker translates the legacy OpenAI-style SSE internally. Arbitrary UTF-8
chunk boundaries are supported. Provider error bodies are replaced by generic
events before crossing into Worker. Each event is capped at 256 KiB and each
turn stream at 8 MiB. Messages are text-only, at most 64 records, 128 KiB per
message, and 1 MiB total.

## Ownership And Restart Recovery

Task Center now persists:

- `executor_owner_role`;
- `executor_session_id` and `last_executor_session_id`;
- executor session start and heartbeat timestamps.

Backend activation clears previous ownership but does not claim execution. The
Task Worker claims the task atomically immediately before opening the broker
session. Desktop backend startup never recovers Worker-owned tasks.

On Task Worker startup, the Worker scans each workspace once. It converts only
active tasks previously owned by `task-worker` into resumable interrupted
failures. Fresh backend activations without an owner are left intact. Server
profile execution uses the same contract with the `server` owner role.

## Cancellation

Cancellation preserves the established authority order:

1. Desktop Core commits cancellation.
2. Backend Task Center persists the compatibility cancellation.
3. Task Worker calls the bound session `cancel` route.
4. Task Worker cancels and joins the local SubAgent coroutine.
5. The terminal checkpoint is emitted to Core.

The provider abort request is best effort. Failure to reach the broker cannot
roll back Core cancellation.

## Process Protocol Safety

Worker stdout remains exclusively reserved for versioned protocol envelopes.
SubAgent and Task Center diagnostics now use stderr, preventing execution logs
or locale-specific text from corrupting WorkerSupervisor framing.

## Packaging

The Task Worker includes `py.task_execution_session` and `httpx`. Provider
SDKs, FastAPI, OpenAI, NumPy, Torch, and Transformers remain excluded from the
Task Worker executable. The backend package retains provider and tool-engine
dependencies until that trusted boundary is extracted independently.

## Verification

Coverage includes message budgets, exact fields, arbitrary SSE chunking,
provider-error redaction, event sequencing, authenticated typed HTTP turns,
completion evaluation, session cancellation, fresh activation handoff,
Worker-owned restart recovery, Core cancellation, native checkpoints, UTF-8,
and function documentation.

## Next Migration

The next phase should move terminal delivery and retry policy behind typed
Worker contracts, then remove desktop task persistence mutations from FastAPI.
The provider/tool broker can later become an independently supervised trusted
capability without changing the SubAgent or Core task contracts.
