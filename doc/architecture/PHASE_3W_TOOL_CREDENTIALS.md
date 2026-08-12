# Phase 3W Tool Credentials

## Status

Implemented on 2026-07-27. Desktop MCP credentials and custom HTTP tool
credentials now have independent Electron Main `safeStorage` boundaries. MCP
stdio environment values and remote transport authentication headers no longer
remain in Renderer state or legacy SQLite. Sensitive custom HTTP headers are
removed from the same plaintext surfaces while ordinary request headers remain
editable metadata.

This phase deliberately does not create a generic tool vault. MCP execution and
custom HTTP execution have different consumers and therefore use different
files, contracts, IPC channels, migration rules, and runtime envelopes.

## Trust Zones

| Boundary | Encrypted file | Protected values | Runtime consumers |
| --- | --- | --- | --- |
| MCP | `mcp-credentials.bin` | Every stdio `env` value and sensitive HTTP/SSE/WebSocket header | Explicitly activated legacy compatibility backend only |
| Custom HTTP | `http-tool-credentials.bin` | Sensitive headers for each stable custom HTTP tool ID | Execution Engine and explicit legacy compatibility backend |

MCP server IDs and custom HTTP tool IDs are bounded stable scopes. Each boundary
accepts at most 128 scopes, 128 values per lane, 256-character names or IDs, and
128 KiB per credential. Runtime envelopes are independently schema-checked and
limited to 2 MiB after Base64 decoding.

Sensitive header recognition covers `Authorization`, proxy authorization,
cookies, and token-like names containing API key, token, secret, password,
credential, or auth segments. Headers such as `Content-Type` remain in the
ordinary tool definition. Documentation placeholders are ignored rather than
treated as configured credentials.

## Storage And Migration

Main composes legacy normalization in this fixed order:

1. Provider credentials.
2. Search and crawler credentials.
3. Voice vendor credentials.
4. MCP credentials.
5. Custom HTTP credentials.

MCP migration inspects both the structured server object and its duplicated
`input` JSON. It captures all stdio environment values and only sensitive
transport headers, then reconstructs `input` from the redacted server object so
no hidden plaintext copy survives. Custom HTTP migration assigns a deterministic
`legacy-http-*` ID when an old tool has no ID, captures only sensitive headers,
and keeps ordinary headers in its JSON metadata.

The legacy SQLite row is rewritten with secure deletion only after all five
credential boundaries report safe capture. If operating-system encryption is
unavailable, an input is malformed, or a value exceeds its limit, Renderer gets
a redacted view but Main preserves the only legacy disk copy. Trusted writes
fail instead of silently discarding a secret. Linux `basic_text` storage is
rejected and neither boundary has a plaintext fallback.

Saving or deleting a server or tool prunes obsolete encrypted scopes. Explicit
clear mutations can remove one name or a complete scope without reading the
previous value into Renderer.

## Renderer Lifecycle

Desktop forms submit completed credential edits only through sender-authorized
typed IPC. Successful writes clear local values and retain sorted configured
name arrays. MCP fields expose an explicit clear control for stored values.
Custom HTTP tools retain non-sensitive headers while sensitive values are
represented only by configured metadata.

Compatibility settings payloads are detached and redacted before they reach
SQLite, WebSocket clients, or unrelated autosave paths. Browser and Server
profiles retain their existing configuration behavior when the typed Desktop
API and Main runtime envelopes are absent.

## Runtime Boundary

Main injects `OPENXNET_MCP_CREDENTIALS_B64` only into `legacy-backend`, which
owns the current MCP client lifecycle. Main injects
`OPENXNET_HTTP_TOOL_CREDENTIALS_B64` into the Execution Engine and
`legacy-backend`, the two current custom HTTP consumers. Neither envelope is
provided to Renderer, Task Worker, or unrelated capability workers.

Python removes each environment variable after decoding, hydrates credentials
only in process, and redacts them again before persistence or compatibility
WebSocket output. MCP rotation restarts only an active legacy backend. Custom
HTTP rotation invalidates both active provider runtimes so their next request
receives the current header map.

MCP connection failures and custom HTTP failures return bounded generic errors.
The custom HTTP implementation no longer prints request headers or response
bodies, preventing provider SDK and remote server text from becoming a secret
exfiltration path.

## Verification

Coverage includes exact contracts, scope and entry budgets, encrypted-store
availability, plaintext-backend rejection, duplicated MCP input migration,
deterministic legacy HTTP IDs, sensitive-header classification, unavailable
encryption preservation, pruning and clearing, sender authorization,
configured-only Renderer behavior, Python envelope validation, hydration, and
persistence redaction.

The final focused verification passed 11 TypeScript Phase 3W tests, 12 Python
credential tests across all five credential boundaries, and 15 Renderer startup
tests. The final full architecture regression passed the Desktop Core suite at
120/120 together with all Python, Worker, and Feature Pack suites. UTF-8,
Python docstring, TypeScript function documentation, and Renderer bootstrap
checks passed.

The real Electron cold-start smoke seeded Provider, Search, Voice, MCP, and
custom HTTP plaintext into one legacy SQLite row. It verified five independent
encrypted files, redacted metadata and raw database bytes, and confirmed that
`legacy-backend` remained stopped after a 2.5-second settle window. The final
run completed with process startup at 1.701 seconds and workspace hydration at
1.463 seconds.

## Remaining Trust Zones

- Telegram, webhook, and live-platform credentials.
- Code sandbox and image-hosting credentials.
- Delivery targets that remain inside their existing backend broker.

Phase 3X subsequently completed the independent QQ, Feishu, Dingtalk, Discord,
and Slack Connector Worker credential boundary. It did not expand either Phase
3W tool store.

Each remaining domain still needs its own field inventory, owner, migration
rules, least-privilege runtime consumer, and explicit clear semantics.
