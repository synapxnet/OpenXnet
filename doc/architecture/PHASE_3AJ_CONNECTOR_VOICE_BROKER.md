# Phase 3AJ Connector Voice And Artifact Broker

## Status

Implemented on 2026-07-29. Feishu and Discord transcription plus Feishu,
Discord, and Slack speech synthesis now use a private Main-owned Connector
Voice Broker. Connector startup no longer activates or depends on the general
Python compatibility backend.

Phase 3AK subsequently replaced the compatibility upstream with the
independently supervised Voice Worker while preserving this Broker contract.

## Request Flow

```text
Connector Manager
  -> shared Connector Voice client
  -> input audio written to private exchange directory
  -> Connector-only origin and random bearer
  -> exact Main Connector Voice Broker
  -> validated temporary artifact reference
  -> on-demand Voice Worker
  -> bounded text or temporary output-audio reference
  -> Connector Manager reads and removes output artifact
```

Ordinary Connector lifecycle and Chat requests do not enter this flow. The
lightweight Broker binds during Main startup without activating Connector
Worker, Voice Worker, Execution Engine, or `legacy-backend`.

## Contract

The Broker accepts only `POST /v1/connectors/voice` on its exact loopback Host
without a query string. The `openxnet.connector-voice-request.v1` schema has
two operations:

- `transcribe` accepts one exchange-directory artifact name, a bounded display
  filename, and an allow-listed format;
- `synthesize` accepts bounded text, voice name, index, mobile-optimization
  flag, and output format.

JSON bodies are limited to 256 KiB. Input and output audio are independently
limited to 25 MiB. The Broker rejects unknown fields, path traversal, symbolic
links, non-files, mismatched output sizes, unknown formats, unsupported media
types, malformed JSON, invalid Host headers, and invalid credentials.

## Artifact Boundary

Binary audio never enters Worker protocol JSON, Renderer IPC, Core SQLite, or
logs. Connector Worker creates mode-restricted `connector-input-*` files under
`runtime/voice-exchange/connectors`; Main resolves the real direct-child path
and file size before reading it. Main writes synthesized audio as a
`connector-output-*` file, and the client validates the declared byte length,
real parent, regular-file type, and name before reading and deleting it.

Broker startup removes only stale Broker-owned output files older than one
day. It never deletes caller input files or unrelated Voice Worker artifacts.

## Trust Zones

Main creates a dedicated Connector Voice token separate from Connector Chat,
Worker RPC, Task Broker, and Execution Engine tokens. Only Connector Worker
receives the Voice origin, token, and exchange directory. Renderer, Task
Worker, Execution Engine, the compatibility backend, and unrelated optional
Workers receive none of those values.

Connector Worker never receives Provider or Voice credential envelopes. In
private Desktop mode the client removes `ttsSettings` from its request. Main
reads a detached credential-free settings snapshot, and only Voice Worker
hydrates Voice and Provider credentials inside its process boundary. Raw
upstream response bodies and exception messages are replaced with fixed Broker
or client codes.

## Compatibility

Server profile retains direct `/tts` and `/asr` calls only when all three
private Voice environment values are absent. Partial private configuration,
remote origins, URL credentials, paths, queries, fragments, short tokens, and
relative exchange directories fail closed.

The Core `connectors` capability now depends only on `core`. TTS or ASR calls
activate Voice Worker explicitly through Main, while lifecycle, status, Chat,
behavior, and platform transport remain independent.

The Connector Feature Pack version is `1.4.0` and explicitly includes both
private Chat and Voice clients.

## Remaining Boundary

Phase 3AK completed the stable handler replacement without changing Connector
Managers or their private protocol. Real-time `/ws/asr` remains a separate
streaming-session migration.

Phase 3BS subsequently moved behavior, tool-link presentation, and voice
metadata to a bounded Worker settings snapshot. Desktop Connector Managers no
longer read the redacted legacy settings mirror; Browser/Server source profiles
retain the compatibility fallback only when no private Connector environment
variable exists.

## Verification

Focused verification covers exact auth and route validation before activation,
artifact containment, symbolic-link rejection, size limits, fixed upstream
errors, input/output cleanup, settings exclusion, private configuration
fail-closed behavior, Server fallback, three-platform source isolation, Core
dependency removal, Renderer trust-zone checks, UTF-8, Chinese function
documentation, and indentation standards.

Connector Chat and Voice Broker tests pass 8/8, existing Connector Worker tests
pass 8/8, private Chat client tests pass 4/4, private Voice client tests pass
5/5, Connector Runtime tests pass 6/6, Renderer aggregate tests pass 24/24,
and Desktop Core tests pass 188/188.

The full architecture regression suite passes in approximately 109.5 seconds,
including all credential, task, Execution Engine, Worker, Feature Pack, REST,
and Connector suites.

The default-budget Electron cold-start smoke passes on its first final run with
a 1,763 ms process startup and a 1,451 ms workspace startup. Both Connector
Brokers bind without activating Connector Worker, Execution Engine, Chat,
Voice Worker, or `legacy-backend`; the backend remains stopped through the
2,500 ms observation window. The verified precompiled Renderer bootstrap
SHA-256 remains
`225025e0cc70c95cd5d7366c9f7039a6b040704649ef278f35253dd1ecc4db8c`.
