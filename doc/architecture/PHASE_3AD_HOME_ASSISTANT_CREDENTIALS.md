# Phase 3AD Home Assistant Credentials

## Status

Implemented on 2026-07-27. The Home Assistant long-lived access token is now
owned by an independent Electron Main `safeStorage` boundary and stored in
`home-assistant-credentials.bin`. Desktop Renderer state, legacy SQLite, Core
SQLite, compatibility persistence, unrelated child environments, route
requests, and application-owned errors do not retain or return its plaintext
value.

At the end of this phase, Home Assistant remained an explicitly activated
legacy-backend MCP workflow. Phase 3AO subsequently moved the Desktop lifecycle
and tool transport into the independently supervised MCP Worker while retaining
this credential boundary. The Server profile keeps its compatibility backend.

## Credential Scope

The boundary accepts exactly one `HASettings` field:

| Encrypted field | Plain metadata |
| --- | --- |
| `api_key` | enabled state and Home Assistant base URL |

The token must be single-line UTF-8 text from 4 to 65,536 characters. Unknown
fields, control characters, conflicting save/clear mutations, non-string
legacy values, and example placeholders are rejected. Public IPC snapshots
return configured field names and secure-storage availability only.

ComfyUI credentials, generic MCP credentials, E2B, and Provider keys remain
separate trust zones and are never copied into this sidecar.

## Storage And Migration

The encrypted file is independent from Authentication, Provider, Search,
Voice, MCP, custom HTTP, Connector Worker, Telegram, image-host, repository,
live-platform, and code-sandbox credentials. Linux `basic_text` storage is
rejected and there is no plaintext fallback. Writes use a mode-0600 temporary
file followed by atomic replacement.

Main composes Home Assistant migration after code-sandbox normalization. It
captures `HASettings.api_key`, clears the compatibility field, adds
`homeAssistantCredentialFieldsConfigured`, and retains `enabled` and `url`.
SQLite is rewritten only after secure capture.

If encryption is unavailable or legacy data is invalid, Renderer receives a
redacted view but Main does not destroy the only disk copy. Trusted writes fail
closed.

## Renderer Lifecycle

The token input uses configured-only state. A completed edit is sent through
sender-authorized typed IPC, after which its reactive plaintext value is
cleared. A configured input shows a replacement placeholder and an icon-only
explicit clear control. Clearing the token also disables the integration.

Desktop settings persistence and typed MCP Runtime IPC use the same detached
Home Assistant configuration with an empty `api_key`. Enabling accepts either
a newly entered token or configured metadata. Browser and Server profiles
retain `/start_HA` and `/stop_HA` compatibility behavior when the typed Desktop
API and Main runtime envelope are absent.

## Runtime Boundary

Main injects one bounded `OPENXNET_HOME_ASSISTANT_CREDENTIALS_B64` envelope
only into a freshly started MCP Worker and the explicitly activated Server
compatibility backend. Renderer, Execution Engine, Task Worker, Connector
Worker, and unrelated capability workers do not receive it. Python removes the
environment variable on first decode and hydrates only the in-memory Home
Assistant MCP configuration.

Credential rotation stops the MCP Worker and a running compatibility backend.
The next explicit activation receives a fresh envelope. Rotation does not
restart the Execution Engine or unrelated optional Workers. Application
shutdown explicitly closes both MCP transports. The Execution Engine receives
only a private MCP Tool Broker origin and an independent process bearer.

## Transport And Error Policy

Home Assistant MCP transport applies these rules:

- cleartext HTTP is allowed only for explicit loopback hosts;
- non-loopback Home Assistant endpoints require HTTPS;
- URL user information, query strings, and fragments are rejected;
- the base URL is capped at 2,048 UTF-8 bytes;
- MCP HTTP redirects are disabled so Authorization cannot cross a redirect;
- stop is a POST operation rather than a state-changing GET;
- configuration, connection, cleanup, and shutdown errors use bounded stable
  messages and log exception types only;
- a failed startup explicitly closes the credential-bearing MCP client.

The default remains `http://127.0.0.1:8123`, preserving local Home Assistant
operation while rejecting a public cleartext endpoint.

## Verification

Focused coverage passes 9 TypeScript contract/storage/IPC tests, 8 Python
credential/route/transport tests, and 22 Renderer startup tests. Desktop Core
passes 178/178. UTF-8, Python docstring, TypeScript JSDoc, syntax, and Renderer
bootstrap checks pass.

The complete architecture regression passes all Python, Worker,
runtime-profile, Feature Pack, task, and Connector suites with the project
virtual environment placed first on `PATH`.

The real Electron cold-start smoke seeds the Home Assistant token with every
previous credential class. It verifies the twelfth independent encrypted
sidecar, configured-only legacy SQLite state, public URL retention, cross-file
isolation, plaintext-free database and encrypted-file bytes, and an inactive
`legacy-backend` after the 2.5-second settle window. The budget-gated empty-load
pass completes with process startup at 2.130 seconds and workspace hydration at
1.822 seconds, below the 10-second and 3-second budgets. A run immediately
after the full regression was discarded because the machine remained under
test load. The precompiled Renderer hash is
`7ea68d131f72c2fc011f90ffcf47b17d4fcff200c2a9888fc4598d0dad9a6a90`.

## Remaining Trust Zones

- ComfyUI and task delivery credentials were subsequently completed in Phases
  3AE and 3AF. Phase 3AG classified Claude, Qwen, and Codex custom execution
  credentials as consumers of the existing Provider boundary; installed CLI
  login state remains CLI-owned.

Any new domain requires an explicit owner, migration rules, consumer allow-list,
error policy, rotation behavior, and clear semantics.
