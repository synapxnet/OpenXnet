# Phase 3AH Connector Runtime IPC

## Status

Implemented on 2026-07-29. Desktop controls for QQ, Feishu, Dingtalk,
Discord, and Slack now use sender-authorized typed IPC from Renderer to
Electron Main and Main-owned requests to the supervised Connector Worker.
Desktop no longer sends these lifecycle controls through the Local UI Gateway
or the general FastAPI compatibility backend.

Telegram is not part of this phase. Its Bot token, manager, and compatibility
routes remain in the independent Telegram trust domain.

## Contract

The `openxnet.application-connector-runtime.v1` contract exposes four exact
operations:

| Operation | Process activation | Request fields |
| --- | --- | --- |
| `status` | never | platform |
| `start` | explicit Connector capability activation | platform, non-secret configuration |
| `stop` | never when the capability is inactive | platform |
| `reload` | explicit Connector capability activation | platform, non-secret configuration |

Only the five Connector Worker platforms are accepted. Each platform has an
exact top-level metadata allow-list. Configuration is bounded by byte size,
field count, array size, string length, and nesting depth. Unsupported fields,
dangerous prototype keys, and any nested field whose name contains
`secret`, `token`, `password`, or `credential` are rejected before Worker
activation.

Worker responses are projected to schema, operation, platform, success,
running state, fixed lifecycle state, fixed error code, and retryability. Raw
SDK diagnostics and Worker exception messages never cross Main IPC.

## Credential Ordering

Renderer registers newly entered Connector credentials with the existing
`connector-credentials.bin` boundary and awaits the Core-first settings save
before start or reload. It then builds a detached runtime configuration with
all credential and configured-name fields removed.

Main serializes Connector Worker invalidation after any Connector or image-host
credential rotation. A subsequent start or reload awaits that invalidation so
the new Worker process receives a fresh environment bootstrap. Credentials
continue to enter only the Connector Worker environment and never appear in
Renderer runtime requests.

## Runtime Ownership

Main status checks read the Core capability state first. A stopped,
unavailable, starting, stopping, or failed Connector capability returns a
credential-free projection without activating the Worker or the legacy
backend. Start and reload explicitly activate the `connectors` capability and
then send an exact Worker protocol method. Stop is a no-op when the capability
is inactive.

Browser and Server profiles retain the legacy HTTP routes. Route registration
now separates the five Connector compatibility routes from Telegram routes:
the Connector router is included only for the Server profile, while Desktop
does not expose those twenty paths.

## Remaining Boundary

This phase removed only lifecycle control-plane indirection. Phase 3AI
subsequently moved ordinary and proactive AI Chat through a private Main-owned
Connector Broker to Execution Engine. Connector TTS, transcription,
compatibility settings, and remaining media helpers were left for later work.
Phase 3AJ subsequently moved TTS and transcription behind a private Voice and
artifact Broker and removed the Core `connectors -> legacy-backend` dependency.

## Verification

Focused verification covers exact metadata parsing, credential-field
rejection, status without activation, credential-before-activation ordering,
exact Worker payloads, fixed errors, sender authorization, IPC cleanup,
Server-only route registration, Browser fallback retention, and absence of
five-platform FastAPI calls from Desktop bot controls. UTF-8, Python docstring,
TypeScript JSDoc, Python syntax, JavaScript syntax, and TypeScript compilation
checks pass.

The full architecture regression suite passes, including all 24 Renderer
aggregate suites and all 6 Connector Runtime contract, service, and IPC tests.
Desktop Core, credential, task, Worker, Feature Pack, REST, and Connector
regressions also pass.

The final default-budget cold-start smoke passes with a 2,265 ms process
startup and a 1,590 ms workspace startup. `legacy-backend` remains stopped
through the 2,500 ms observation window. The verified precompiled Renderer
bootstrap SHA-256 is
`225025e0cc70c95cd5d7366c9f7039a6b040704649ef278f35253dd1ecc4db8c`.
