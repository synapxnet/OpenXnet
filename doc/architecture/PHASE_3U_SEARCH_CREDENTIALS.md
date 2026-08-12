# Phase 3U Search Credentials

## Status

Implemented on 2026-07-26. Desktop Web Search and crawler credentials are now
owned by an independent Electron Main `safeStorage` boundary. Search keys are
removed from Renderer state and legacy SQLite persistence, while Browser and
Server profiles retain their existing in-process settings behavior.

This phase deliberately does not include model providers, account tokens,
TTS/ASR vendors, MCP headers, connectors, code sandboxes, or delivery targets.
Those remain separate trust zones; later phases complete Voice, MCP, and custom
HTTP ownership without merging them into the Search store.

## Credential Classes

The contract accepts exactly ten stable credential identifiers:

| ID | Legacy field |
| --- | --- |
| `tavily` | `tavily_api_key` |
| `jina` | `jina_api_key` |
| `crawl4ai` | `Crawl4Ai_api_key` |
| `bing` | `bing_api_key` |
| `google` | `google_api_key` |
| `brave` | `brave_api_key` |
| `exa` | `exa_api_key` |
| `serper` | `serper_api_key` |
| `bochaai` | `bochaai_api_key` |
| `firecrawl` | `firecrawl_api_key` |

Unknown IDs, empty mutation values, control characters, values over 16 KiB,
and requests that save and clear the same ID are rejected. Public IPC snapshots
contain one configured boolean per ID and never contain secret values.

## Storage And Migration

Search credentials are encrypted in `search-credentials.bin`. They are not
stored in `provider-credentials.bin`, `auth-credentials.bin`, Core SQLite, or a
generic cross-domain vault. Linux `basic_text` storage is rejected and there is
no plaintext fallback.

The Main-owned legacy settings normalizer composes Provider migration followed
by Search migration. On the first bounded settings read it:

1. Inspects only the known `webSearch` fields.
2. Ignores known documentation placeholders such as `test_api_code`.
3. Encrypts valid keys into the Search credential sidecar.
4. Replaces legacy values with empty strings and configured booleans.
5. Rewrites the SQLite row with secure deletion only after safe capture.

If encryption is unavailable, Renderer still receives a redacted view but the
only disk copy is not rewritten. A Renderer write containing an uncaptured key
fails. Oversized or malformed legacy values follow the same preservation rule
instead of crashing startup or being silently destroyed.

The previous Crawl4AI `test_api_code` default was removed from both Renderer
defaults and Python request fallback behavior.

## Renderer Lifecycle

Desktop credential inputs commit on completed edits rather than on every
keystroke. Only explicitly committed fields enter the typed save IPC. After a
successful save, Renderer clears all key values and retains configured flags.
Stored credentials are represented by a configured placeholder and may be
replaced without reading the previous value.

Every Desktop legacy settings payload constructs a detached `webSearch` object
with empty key fields. This prevents unrelated autosave activity from copying a
partially typed value into SQLite. Search enablement checks newly entered values
or configured flags. The contract also supports explicit per-ID clearing.

## Python Runtime Boundary

Main injects a bounded `OPENXNET_SEARCH_CREDENTIALS_B64` envelope only when it
starts the Execution Engine or explicit legacy compatibility backend. Python
accepts the exact schema and credential ID list, removes the environment value,
and hydrates only the in-memory `webSearch` settings object.

Before any Python settings write, search credentials are removed again and
configured booleans are restored. Browser and Server processes without the Main
envelope retain their current settings behavior. A search credential rotation
invalidates active provider runtimes so the next explicit request receives the
current credential map.

Desktop compatibility WebSocket `settings` and `settings_update` payloads pass
through the combined Provider/Search/Voice redactor before leaving Python. Search SDK
exceptions log only their exception class, and crawler errors return generic
messages instead of raw response or exception text that may contain a key.

## Verification

Coverage includes strict mutation parsing, encrypted store read/write/clear,
plaintext-backend rejection, legacy capture and placeholder removal, unavailable
storage preservation, malformed legacy input, sender authorization, Renderer
configured-only behavior, Python schema validation, runtime hydration, and
persistence redaction.

The real Electron cold-start smoke seeds Provider and Search plaintext in one
legacy SQLite row. It verifies both independent encrypted files, configured
metadata, raw database bytes, Core SQLite, and that `legacy-backend` remains
stopped. The final confirmation run completed with process startup at 1.949
seconds and workspace hydration at 1.667 seconds.

Phase 3V subsequently completed TTS vendor credentials while retaining
OpenAI-compatible TTS/ASR keys in the Provider trust zone.

## Remaining Trust Zones

- Connector, bot, webhook, and live-platform credentials.
- Code sandbox and image-hosting credentials.
- Delivery targets that remain inside their existing backend broker.

Phase 3W subsequently completed independent MCP and custom HTTP credential
boundaries. It did not expand the Search store.

Each remaining domain needs its own field inventory, migration rules, runtime
consumer, and explicit clear semantics before its plaintext fields can be
removed safely.
