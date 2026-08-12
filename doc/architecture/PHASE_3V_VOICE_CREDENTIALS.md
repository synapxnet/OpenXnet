# Phase 3V Voice Credentials

## Status

Implemented on 2026-07-26. Desktop TTS vendor credentials are now owned by an
independent Electron Main `safeStorage` boundary. The default TTS configuration
and each named `newtts` voice have separate credential scopes. Renderer state,
legacy SQLite, Core SQLite, WebSocket settings payloads, and application logs do
not retain or return plaintext voice credentials.

OpenAI-compatible TTS and ASR continue to reference a selected model Provider.
Their API key remains in the Phase 3S Provider trust zone and is resolved in the
trusted Python process by Provider ID. Phase 3V does not copy that key into the
voice credential file. Local Sherpa ASR, Web Speech, and unauthenticated FunASR
configuration do not create credential entries.

## Credential Classes

The voice contract accepts exactly fifteen vendor fields in a `default` scope
or one of at most 128 bounded named-voice scopes:

| Vendor | Fields |
| --- | --- |
| Azure Speech | `azureSpeechKey` |
| Volcengine | `volcAppId`, `volcAccessKey`, `volcSecretKey`, `volcAppKey` |
| Baidu | `baiduApiKey`, `baiduSecretKey` |
| MiniMax | `minimaxApiKey`, `minimaxGroupId` |
| Xunfei | `xunfeiAppId`, `xunfeiApiKey`, `xunfeiApiSecret` |
| Fish Audio | `fishApiKey` |
| Google Cloud TTS | `googleServiceAccount` |
| ElevenLabs | `elevenLabsApiKey` |

Unknown fields, invalid scope names, control characters, empty mutations,
malformed Google service-account JSON, and oversized credentials are rejected.
The public snapshot exposes configured booleans for known fields and never
returns a credential value.

## Storage And Migration

Voice credentials are encrypted in `voice-credentials.bin`. They are not stored
in the Provider, Search, Auth, Core SQLite, or generic settings stores. Linux
`basic_text` storage is rejected and there is no plaintext fallback.

Main composes legacy normalization in this fixed order:

1. Capture and redact selected model Provider keys.
2. Capture and redact Web Search and crawler keys.
3. Capture and redact default and named-voice vendor credentials.
4. Rewrite legacy SQLite with secure deletion only after every plaintext value
   was safely captured.

If secure encryption is unavailable or a legacy service-account document is
malformed, Renderer receives a redacted view but the only legacy disk copy is
not rewritten. Trusted Renderer writes fail instead of silently losing the
credential. Intentional deletion of a named voice prunes its encrypted scope.

## Renderer Lifecycle

Desktop inputs submit only completed credential edits through authorized typed
IPC. Successful writes clear the reactive credential values and retain only
configured flags and replacement placeholders. Empty committed fields produce
explicit clear operations.

Named-voice drafts collect credential fields until the voice is saved. Every
Desktop compatibility settings payload constructs a detached `ttsSettings`
tree with all fifteen fields empty in both default and named scopes. Voice-list
requests identify their credential scope so stored values can be used without
being returned to Renderer.

Browser and Server profiles retain their existing settings behavior when the
typed Desktop API is absent.

## Runtime Boundary

Main injects a bounded `OPENXNET_VOICE_CREDENTIALS_B64` envelope only into the
explicitly activated legacy compatibility backend, because that process owns
the current TTS and streaming ASR routes. The Execution Engine, Task Worker,
Voice Worker, and Renderer do not receive this envelope.

Python removes the environment value after decoding, hydrates only in-memory
default or named TTS scopes, and resolves OpenAI-compatible TTS/ASR credentials
through the separate Provider envelope. Settings persistence and compatibility
WebSocket output pass through the combined Provider/Search/Voice redactor.

A voice credential rotation stops only an active legacy backend. The next voice
request starts a fresh process with current credentials. TTS, ASR, FunASR,
Tetos, and vendor SDK error paths return generic messages and log exception
types rather than raw response bodies.

## Verification

Coverage includes exact contracts, dynamic scope bounds, encrypted storage,
plaintext-backend rejection, default and named legacy migration, unavailable
encryption preservation, malformed Google JSON, scope pruning, sender
authorization, configured-only Renderer behavior, Python hydration and
redaction, transient Tetos drafts, and Browser-profile compatibility.

The real Electron cold-start smoke seeds Provider, Search, default Azure, and
named Fish Audio plaintext in one legacy SQLite row. It verifies three
independent encrypted credential files, configured metadata, raw database
bytes, Core SQLite, and that `legacy-backend` remains stopped. The final
confirmation run completed with process startup at 1.722 seconds and workspace
hydration at 1.452 seconds. Renderer tests passed 14/14 and Desktop Core tests
passed 109/109 as part of the complete architecture regression.

## Remaining Trust Zones

- Connector, bot, webhook, and live-platform credentials.
- Code sandbox and image-hosting credentials.
- Delivery targets that remain inside their existing backend broker.

Phase 3W subsequently completed independent MCP and custom HTTP credential
boundaries. It did not expand the Voice store.

Each remaining domain needs its own field inventory, migration rules, runtime
consumer, and explicit clear semantics before its plaintext fields can be
removed safely.
