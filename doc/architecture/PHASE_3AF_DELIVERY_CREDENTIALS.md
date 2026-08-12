# Phase 3AF Task Delivery Credentials

## Status

Implemented on 2026-07-27. Generic webhook and Discord webhook credentials
are now owned by an independent Electron Main `safeStorage` boundary in
`delivery-credentials.bin`. Renderer state, Desktop Core SQLite, legacy
SQLite, workspace task JSON, Task Worker requests and events, unrelated child
environments, logs, and public errors do not retain or return plaintext.

## Credential Scope

Every entry is isolated by the exact compound scope
`workspacePath + taskId + target`.

| Target | Encrypted fields | Plain metadata |
| --- | --- | --- |
| `webhook` | `url`, sensitive `headers` | method, configured URL flag, configured header names |
| `discord` | `webhook_url` | channel ID, configured webhook flag |

Telegram Bot tokens remain in the Telegram boundary, Discord Bot tokens
remain in the Connector boundary, and chat/channel identifiers remain ordinary
task metadata. Cross-target fields, unknown fields, invalid task identifiers,
conflicting duplicate legacy values, more than 512 scopes, and more than 64
headers per webhook are rejected. Each serialized scope is capped at 192 KiB
so it always fits the 256 KiB private runtime envelope.

Header names are normalized to lowercase. Transport-owned fields including
`Host`, `Content-Length`, `Transfer-Encoding`, `Connection`, proxy
authentication, `TE`, `Trailer`, `Upgrade`, and `Keep-Alive` are forbidden.

## Storage And Migration

The sidecar is independent from the previous thirteen credential files. Linux
`basic_text` storage is rejected and there is no plaintext fallback. Writes
use a mode-0600 temporary file and atomic replacement. Removing the last scope
removes the sidecar.

Main scans only the selected `CLISettings.cc_path/.agent/tasks` directory. The
scan accepts at most 2,000 regular non-symlink JSON files, each at most 1 MiB,
with bounded task identifiers. It recognizes both array records and maps keyed
by target, captures valid plaintext, and atomically rewrites UTF-8 task JSON
with configured-only flags. A workspace is marked migrated only after a
successful protected scan, so unavailable OS encryption and failed files can
be retried without destroying the only legacy copy.

Desktop Core applies the same reconciliation before create, import,
checkpoint, transition, startup migration, and public read. Task deletion
clears all matching target scopes. Windows workspace fingerprints are compared
case-insensitively.

## Renderer Lifecycle

The task creation dialog exposes protected Webhook URL, request-header, and
Discord Webhook URL fields. Renderer validates the URL and header policy, then
creates the durable Core task without those fields. It saves credentials
through sender-authorized typed IPC using the returned canonical workspace and
legacy task ID. Execution dispatch occurs only after every scope is committed.

Partial writes are cleared in reverse order. A failed secure save also deletes
the undispatched Core task, whose Core cleanup removes any remaining scopes.
Successful save, dialog close, and completed form reset clear all Renderer
plaintext fields.

## Request Boundary

Task Worker continues to send the exact secret-free terminal-delivery request.
The Main-owned Task Execution Broker Gateway rejects Worker-supplied private
credential fields. Only on the exact
`/v1/tasks/executor/delivery/dispatch` route does Main resolve one compound
scope and add one bounded Base64 envelope to its private request body. The
other four broker routes receive the original request bytes.

Execution Engine decodes at most one 256 KiB envelope, canonicalizes and
compares workspace, task ID, and target again, then hydrates a detached record
immediately before `dispatch_delivery`. No process-wide environment variable
contains the task credential collection.

## Transport Policy

- non-loopback endpoints require HTTPS; HTTP is allowed only for explicit
  loopback hosts;
- URL user information and fragments are rejected;
- webhook methods are limited to `POST` and `PUT`;
- redirects are disabled;
- connect, read, and write deadlines are bounded;
- outbound JSON is capped at 128 KiB and excludes delivery configuration and
  internal settings;
- response bodies are streamed and discarded with a 64 KiB cap;
- response text, target URLs, headers, raw exceptions, and transport errors
  never enter public results or logs;
- Discord webhook and generic webhook paths share the same transport policy.

## Verification

Focused coverage includes strict TypeScript contract, storage, migration,
configured-only snapshot, clear, IPC authorization, Core SQLite, and exact
broker-route tests; Python covers envelope decoding, scope mismatch, hydration,
URL/header policy, redirect denial, byte budgets, payload redaction, and fixed
errors. Renderer startup coverage asserts Core-create, credential-save, and
dispatch ordering and verifies that the Core request excludes every plaintext
field.

The complete architecture regression passes Renderer `24/24`, Desktop Core
`187/187`, delivery-boundary TypeScript `10/10`, delivery credential Python
`6/6`, and webhook transport Python `5/5`, together with all Task Worker,
Execution Engine, Worker, Feature Pack, REST, and connector suites. UTF-8,
Python docstring, TypeScript JSDoc, syntax, and generated Renderer checks pass.

The real Electron cold-start smoke seeds both targets into a workspace task
file alongside all previous credential classes. It verifies the fourteenth
independent sidecar, configured-only task JSON, plaintext-free Core and legacy
SQLite, cross-sidecar isolation, an inactive `legacy-backend`, and the existing
startup budgets. The budget-gated pass completes with process startup at 1.788
seconds and workspace hydration at 1.532 seconds. The precompiled Renderer hash
is `225025e0cc70c95cd5d7366c9f7039a6b040704649ef278f35253dd1ecc4db8c`.

## Remaining Trust Zones

- Phase 3AG subsequently classified Claude, Qwen, and Codex custom execution
  credentials as consumers of the existing Provider boundary. Installed CLI
  login state remains CLI-owned and is not read or copied by OpenXnet.

Any new credential class requires its own owner, typed scope, migration,
consumer allow-list, rotation behavior, clear semantics, and error policy.
