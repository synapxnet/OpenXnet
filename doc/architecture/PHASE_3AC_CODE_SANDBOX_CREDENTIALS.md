# Phase 3AC Code-Sandbox Credentials

## Status

Implemented on 2026-07-27. The E2B API key is now owned by an independent
Electron Main `safeStorage` boundary and stored in
`code-sandbox-credentials.bin`. Desktop Renderer state, legacy SQLite, Core
SQLite, compatibility persistence, unrelated child environments, and
application-owned errors do not retain or return its plaintext value.

This phase changes credential ownership and hardens the existing E2B and
remote Sandbox clients. It does not move code execution out of the shared
Execution Engine or explicit legacy compatibility backend.

## Credential Scope

The boundary accepts exactly one `codeSettings` field:

| Runtime | Encrypted field | Plain metadata |
| --- | --- | --- |
| E2B | `e2b_api_key` | enabled state, engine, local or remote sandbox URL |

Home Assistant `HASettings.api_key` and `comfyuiAPIkey` remain separate trust
zones. CLI provider keys under `ccSettings`, `qcSettings`, and `ocSettings`
continue to resolve through their selected Provider records and are not copied
into this sidecar.

The E2B key must be single-line UTF-8 text from 4 to 65,536 characters.
Unknown fields, control characters, conflicting save/clear mutations, and
example placeholders are rejected. Public IPC snapshots return configured
field names and secure-storage availability only.

## Storage And Migration

The encrypted file is independent from Authentication, Provider, Search,
Voice, MCP, custom HTTP, Connector Worker, Telegram, image-host, repository,
and live-platform credentials. Linux `basic_text` storage is rejected and
there is no plaintext fallback. Writes use a mode-0600 temporary file followed
by atomic replacement.

Main composes code-sandbox migration after live-platform normalization. It
captures `e2b_api_key`, clears the compatibility field, adds
`codeSandboxCredentialFieldsConfigured`, and retains `enabled`, `engine`, and
`sandbox_url`. SQLite is rewritten only after secure capture.

If encryption is unavailable or legacy data is invalid, Renderer receives a
redacted view but Main does not destroy the only disk copy. Trusted writes fail
closed.

## Renderer Lifecycle

The E2B password input uses configured-only state. A completed edit is sent
through sender-authorized typed IPC, after which its reactive plaintext value
is cleared. A configured input shows a replacement placeholder and an
icon-only explicit clear control. Enabling E2B accepts either a newly entered
key or configured metadata.

Desktop settings persistence uses a detached code configuration with an empty
`e2b_api_key`. Browser and Server profiles retain their existing plaintext
behavior when the typed Desktop API and Main runtime envelope are absent.

## Runtime Boundary

Main injects one bounded `OPENXNET_CODE_SANDBOX_CREDENTIALS_B64` envelope only
into the independently supervised Execution Engine and an explicitly
activated legacy backend. Renderer, Task Worker, Connector Worker, Voice
Worker, and unrelated capability workers do not receive it. Python removes
the environment variable on first decode and hydrates only the in-memory
`codeSettings` document.

Credential rotation stops both possible credential-bearing Python runtimes.
Their next explicit activation receives a fresh envelope. It does not restart
unrelated optional Workers.

## Sandbox Transport Policy

E2B execution uses `asyncio.to_thread`, bounds source code to 1 MiB and output
to 2 MiB, and replaces provider exceptions with a stable error that cannot
reflect the API key.

The HTTP sandbox client applies these rules:

- cleartext HTTP is allowed only for explicit loopback hosts;
- non-loopback sandboxes require HTTPS;
- URL user information, query strings, and fragments are rejected;
- redirects are disabled;
- requests have a 60-second total timeout;
- source code is limited to 1 MiB and response bodies to 2 MiB;
- transport, HTTP, redirect, and size failures return bounded stable messages.

The default remains `http://127.0.0.1:8080`, preserving the local Sandbox
Fusion workflow without permitting a public cleartext endpoint.

## Verification

Focused coverage passes 9 TypeScript contract/storage/IPC tests, 8 Python
credential/interpreter tests, and 21 Renderer startup tests. Desktop Core
passes 169/169. UTF-8, Python docstring, TypeScript JSDoc, syntax, and Renderer
bootstrap checks pass.

The complete architecture regression passes all Python, Worker,
runtime-profile, Feature Pack, task, and Connector suites with the project
virtual environment placed first on `PATH`.

The real Electron cold-start smoke seeds the E2B key with every previous
credential class. It verifies the eleventh independent encrypted sidecar,
configured-only legacy SQLite state, public metadata retention, cross-file
isolation, plaintext-free database and encrypted-file bytes, and an inactive
`legacy-backend` after the 2.5-second settle window. The budget-gated empty-load
pass completes with process startup at 2.049 seconds and workspace hydration at
1.783 seconds, below the 10-second and 3-second budgets. A run immediately
after the full regression was discarded because the machine remained under
test load. The precompiled Renderer hash is
`99fa3a26d44c29a6c0a47198b66b5f450e10067c56380d1cc0a0c818af1c8ac2`.

## Remaining Trust Zones

- Home Assistant, ComfyUI, and task delivery credentials were subsequently
  completed in Phases 3AD through 3AF. Phase 3AG classified Claude, Qwen, and
  Codex custom execution credentials as consumers of the existing Provider
  boundary; installed CLI login state remains CLI-owned.

Any new domain requires an explicit owner, migration rules, consumer allow-list,
error policy, rotation behavior, and clear semantics.
