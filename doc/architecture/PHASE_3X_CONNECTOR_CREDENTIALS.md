# Phase 3X Connector Worker Credentials

## Status

Implemented on 2026-07-27. Credentials for the optional QQ, Feishu, Dingtalk,
Discord, and Slack Connector Worker are now owned by an independent Electron
Main `safeStorage` boundary. Desktop Renderer state, legacy SQLite, Core SQLite,
compatibility HTTP payloads, Worker RPC payloads, status responses, and
application-owned logs do not retain or return their plaintext values.

Telegram remains in the legacy backend and is not part of this boundary. Image
hosting, live platforms, generic webhooks, and task delivery also remain
separate trust zones with different runtime consumers.

## Credential Classes

| Platform | Encrypted fields | Plain metadata |
| --- | --- | --- |
| QQ | `secret` | `appid`, agent, sandbox and behavior settings |
| Feishu | `secret` | `appid`, agent and behavior settings |
| Dingtalk | `appSecret` | `appKey`, agent and behavior settings |
| Discord | `token` | agent and behavior settings |
| Slack | `bot_token`, `app_token` | agent and behavior settings |

The contract accepts only these five platform scopes and six fields. Secrets
must be single-line UTF-8 text from 4 to 65,536 characters. Unknown platforms,
cross-platform fields, control characters, conflicting save/clear mutations,
and example placeholders are rejected. Public snapshots contain only configured
field-name arrays.

## Storage And Migration

The six values are encrypted in `connector-credentials.bin`. They are not
stored in Provider, Search, Voice, MCP, custom HTTP, Authentication, or generic
settings stores. Linux `basic_text` storage is rejected and there is no
plaintext fallback.

Main composes Connector migration after Provider, Search, Voice, MCP, and
custom HTTP normalization. It captures exact fields, retains public App IDs and
App Keys, clears plaintext values, and adds `credentialFieldsConfigured` to
each compatibility config. The legacy SQLite row is rewritten with secure
deletion only after every boundary reports safe capture.

If encryption is unavailable or a legacy secret is malformed, Renderer receives
a redacted view but Main does not rewrite the only legacy disk copy. Trusted
writes fail instead of silently dropping a value. Explicit typed clear requests
remove one field or a complete platform scope without reading the old secret
into Renderer.

## Renderer Lifecycle

The six password inputs commit completed edits through sender-authorized typed
IPC. Successful writes clear their reactive values and retain configured names.
Each stored field has an icon-only clear control and a replacement placeholder.
Connector validity checks accept a newly entered or securely configured secret,
so clearing Renderer values does not disable a valid connector.

Every Desktop compatibility payload creates detached Connector configs and
forces all six fields to empty strings. Browser and Server profiles retain their
existing configuration behavior when the typed Desktop API is absent.

## Runtime Boundary

Main injects one bounded `OPENXNET_CONNECTOR_CREDENTIALS_B64` envelope only into
the optional Connector Worker. The legacy backend and authenticated Worker RPC
carry redacted configuration metadata; they do not receive connector secrets.
Renderer, Execution Engine, Task Worker, and unrelated capability workers do
not receive this envelope.

Worker startup removes the environment value after decoding and hydrates only
the requested platform configuration in memory. Worker launch environments are
resolved for every new process so credential rotation can stop the current
Connector Worker and guarantee that the next activation uses current values.
The independent Connector Feature Pack version is now `1.1.0`.

Worker status removes manager configuration, recursively redacts sensitive
fields, and replaces exact secret values in diagnostics. Dingtalk access-token
failures log only HTTP status or exception type instead of remote response text.
Third-party SDK stderr remains a residual local audit surface and is never
forwarded through Worker protocol responses.

## Verification

Focused coverage includes exact field contracts, encrypted storage,
plaintext-backend rejection, five-platform legacy migration, unavailable
encryption preservation, configured-only snapshots, sender authorization,
dynamic process environments, Python schema validation, platform-isolated
hydration, Browser/Server compatibility, and existing Connector Worker
lifecycle/error redaction.

The focused run passed 12 TypeScript service/IPC/Worker tests, 3 Python
credential tests, 8 existing Connector Worker tests, and 16 Renderer startup
tests. UTF-8, Python docstring, TypeScript function documentation, syntax, and
Renderer bootstrap checks passed.

The final full architecture regression passed Desktop Core at 128/128 together
with all Python, Worker, runtime-profile, and Feature Pack suites. The six
credential-class Python run passed 15/15 in the project virtual environment.

The release-side Pack build produced version `1.1.0-openxnet.1.0.2` with 835
integrity-protected files and 171,723,214 payload bytes. Archive inspection
confirmed `py.connector_credentials` inside the 27,900,201-byte Worker
executable. Pack smoke reported all five SDK dependency graphs available and
all five connectors stopped without opening a provider connection.

The real Electron cold-start smoke seeded all six Connector secrets alongside
the five previously migrated credential classes. It verified six independent
encrypted files, retained public App IDs/Keys, plaintext-free database bytes,
and confirmed that `legacy-backend` remained stopped after a 2.5-second settle
window. The run completed with process startup at 1.527 seconds and workspace
hydration at 1.292 seconds.

## Remaining Trust Zones

- Telegram bot token and its legacy callback/media lifecycle.
- Image-hosting API keys and repository tokens.
- Bilibili, YouTube, and Twitch live-platform credentials.
- Generic webhook and task terminal-delivery targets.
- Code sandbox and external execution credentials.

Each remaining domain needs its own owner, migration rules, runtime consumer,
error policy, and explicit clear semantics.
