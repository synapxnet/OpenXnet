# Phase 3AE ComfyUI Credentials

## Status

Implemented on 2026-07-27. The global Comfy.org API key is now owned by an
independent Electron Main `safeStorage` boundary and stored in
`comfyui-credentials.bin`. Desktop Renderer state, legacy SQLite, Core SQLite,
compatibility persistence, unrelated child environments, logs, and public
errors do not retain or return its plaintext value.

The existing settings model supports several ComfyUI endpoints for load
balancing but only one `comfyuiAPIkey`. The key is forwarded as
`extra_data.api_key_comfy_org` in a submitted workflow rather than as
per-server transport authentication. This phase therefore keeps one global
credential field instead of inventing a server-scoped mapping that the
consumer protocol cannot honor.

## Credential Scope

The boundary accepts exactly one encrypted field:

| Encrypted field | Plain metadata |
| --- | --- |
| `api_key` | validated `comfyuiServers` and configured state |

The key must be single-line UTF-8 text from 4 to 65,536 characters. Unknown
fields, control characters, conflicting save/clear mutations, non-string
legacy values, and example placeholders are rejected. Public IPC snapshots
return configured field names and secure-storage availability only.

Home Assistant, E2B, Provider, MCP, webhook, and delivery credentials are
separate trust zones and are never copied into this sidecar. Webhook and task
delivery credentials are owned by the later Phase 3AF boundary.

## Storage And Migration

The encrypted file is independent from Authentication, Provider, Search,
Voice, MCP, custom HTTP, Connector Worker, Telegram, image-host, repository,
live-platform, code-sandbox, and Home Assistant credentials. Linux
`basic_text` storage is rejected and there is no plaintext fallback. Writes
use a mode-0600 temporary file followed by atomic replacement.

Main composes ComfyUI migration after Home Assistant normalization. It
captures the top-level `comfyuiAPIkey`, clears that compatibility field, adds
`comfyuiCredentialFieldsConfigured`, and retains the endpoint list and
workflow metadata. SQLite is rewritten only after secure capture.

If encryption is unavailable or legacy data is invalid, Renderer receives a
redacted view but Main does not destroy the only disk copy. Trusted writes
fail closed.

## Renderer Lifecycle

The ComfyUI key input uses configured-only state. A completed edit is sent
through sender-authorized typed IPC, after which its reactive plaintext value
is cleared. A configured input shows a replacement placeholder and an
icon-only explicit clear control. Legacy settings payloads contain an empty
`comfyuiAPIkey` and configured field names only.

Renderer endpoint probing validates the scheme and authority, requires HTTPS
outside explicit loopback, rejects URL user information, query strings, and
fragments, disables redirects, and uses a 10-second abort deadline before the
endpoint can become the active iframe URL.

## Runtime Boundary

Main injects one bounded `OPENXNET_COMFYUI_CREDENTIALS_B64` envelope only into
the independently supervised Execution Engine and an explicitly activated
legacy backend. Both runtimes register the ComfyUI workflow tool. Renderer,
Task Worker, Connector Worker, and unrelated capability workers do not receive
the envelope.

Python removes the environment variable on first decode and hydrates only the
in-memory settings document. Credential rotation invalidates the Execution
Engine and legacy backend so the next explicit activation receives a fresh
envelope. Unrelated Workers remain active.

## Transport And File Policy

ComfyUI workflow transport applies these rules:

- cleartext HTTP is allowed only for explicit loopback hosts;
- non-loopback ComfyUI and source-image endpoints require HTTPS;
- URL user information and fragments are rejected, while server query strings
  are also rejected;
- every HTTP operation disables redirects and uses bounded connect/read
  deadlines;
- JSON responses are capped at 2 MiB, source uploads at 32 MiB, and generated
  images at 64 MiB;
- generation polling and server reservation are capped at 180 and 30 seconds;
- workflow files are UTF-8 JSON capped at 4 MiB and must resolve directly below
  the upload directory;
- output filenames reject traversal and are persisted under unique local
  names;
- one workflow is submitted and collected exactly once, and server reservations
  are released in `finally` cleanup;
- public failures use the fixed `ComfyUI 请求失败。` result without response
  bodies, URLs, credentials, or raw exception text.

The old blocking `urllib` calls, automatic redirects, unbounded reads, faulty
wait condition, duplicate workflow execution, response-body prints, and local
output path traversal have been removed. The current consumer uses HTTP
polling and does not open a credential-bearing ComfyUI WebSocket.

## Verification

Focused coverage passes 7 TypeScript contract/storage/IPC tests, 7 Python
credential/URL/prompt tests, and 23 Renderer startup tests. Desktop Core passes
185/185. UTF-8, Python docstring, TypeScript JSDoc, syntax, and Renderer
bootstrap checks pass.

The complete architecture regression passes all Python, Worker,
runtime-profile, Feature Pack, task, REST, and Connector suites with the
project virtual environment placed first on `PATH`.

The real Electron cold-start smoke seeds the ComfyUI key with every previous
credential class. It verifies the thirteenth independent encrypted sidecar,
configured-only legacy SQLite state, endpoint retention, cross-file isolation,
plaintext-free database and encrypted-file bytes, and an inactive
`legacy-backend` after the 2.5-second settle window. The budget-gated pass
completes with process startup at 2.112 seconds and workspace hydration at
1.842 seconds, below the 10-second and 3-second budgets. The precompiled
Renderer hash is
`73bae677f14cadd4203a1fd0c8c8cdd083bc4a49c009dd6ca79152ca242ff92e`.

## Remaining Trust Zones

- Phase 3AG subsequently classified Claude, Qwen, and Codex custom execution
  credentials as consumers of the existing Provider boundary. Installed CLI
  login state remains CLI-owned and is not read or copied by OpenXnet.

Each remaining domain requires an explicit owner, migration rules, consumer
allow-list, error policy, rotation behavior, and clear semantics.
