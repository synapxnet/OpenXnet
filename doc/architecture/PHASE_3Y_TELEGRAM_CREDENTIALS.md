# Phase 3Y Telegram Credentials

## Status

Implemented on 2026-07-27. The Telegram Bot token is now owned by an
independent Electron Main `safeStorage` boundary and stored in
`telegram-credentials.bin`. Renderer state, legacy SQLite, Core SQLite, Task
Worker protocol, Worker RPC, status responses, compatibility payloads, and
application-owned error messages do not retain or return its plaintext value.

Telegram remains an in-process legacy-backend transport. This phase changes
credential ownership without moving its polling and media lifecycle into a
Feature Pack or Connector Worker.

## Canonical Configuration

`telegramBotConfig` is the only canonical settings key. Task terminal delivery
previously read `telegramBot`, which did not match the settings template or
Renderer and could prevent delivery even with valid configuration. Delivery
now reads `telegramBotConfig` and uses `telegramBot` only as a bounded fallback
for obsolete persisted data.

Migration inspects and clears `bot_token` under both keys. Equal copies are
captured once. Conflicting non-empty values fail trusted writes instead of
silently choosing one. Telegram agent selection, behavior target chat IDs,
memory limits, separators, TTS settings, and wake-word metadata remain plain
configuration.

## Storage And Migration

The strict contract accepts one `botToken` value containing single-line UTF-8
text from 4 to 65,536 characters. Unknown fields, control characters,
undersized values, and combined save/clear mutations are rejected. Public IPC
snapshots return only a boolean `configured` state and secure-storage status.

The encrypted file is independent from Authentication, Provider, Search,
Voice, MCP, custom HTTP, and Connector Worker credentials. Linux `basic_text`
storage is rejected and there is no plaintext fallback. Writes use a mode-0600
temporary file followed by atomic replacement.

Main composes Telegram migration after the other credential normalizers. It
captures the token before clearing compatibility settings and adds
`credentialFieldsConfigured: ["bot_token"]`. SQLite is rewritten only after
secure capture. If encryption is unavailable or legacy data is invalid,
Renderer receives a redacted view but the only disk copy is not destroyed;
trusted writes fail closed.

## Renderer Lifecycle

The Telegram password input now follows the configured-only pattern used by
other Main-owned credentials. A completed edit is sent through authorized IPC,
then the reactive token value is cleared. The input shows a replacement
placeholder and an icon-only explicit clear control while configured.

Compatibility settings, bot start requests, and bot reload requests are built
from detached Telegram metadata with an empty `bot_token`. The legacy backend
hydrates the token after request receipt. Bot validity accepts either a new
input value or configured state, so removing Renderer plaintext does not
disable an existing bot.

Browser and Server profiles retain their existing plaintext configuration
behavior when the typed Desktop API and Main runtime envelope are absent. This
is an explicit deployment boundary rather than a Desktop plaintext fallback.

## Runtime Consumers

Main passes a bounded `OPENXNET_TELEGRAM_CREDENTIALS_B64` envelope to exactly
two trusted Python processes:

- The legacy backend consumes it for Telegram polling, callback handling,
  media operations, and behavior updates.
- The on-demand Execution Engine consumes it for authenticated task terminal
  delivery through the Telegram Bot API.

The envelope is not passed to Renderer, Task Worker, Connector Worker,
document, memory, vector, voice, or other capability workers. Each trusted
Python process removes the environment variable on first decode and hydrates
only in-memory settings or an individual Telegram route configuration.

Credential rotation stops both the Execution Engine and a running legacy
backend. Their next activation receives a fresh envelope. Stopping the legacy
backend also ends the credential-bearing Telegram thread, preventing an old
polling client from surviving token replacement.

## Error And Status Policy

Telegram manager status no longer returns its `config` object or raw startup
exception. It exposes only credential-free lifecycle flags and an exception
type code. Start, stop, reload, behavior synchronization, polling, media, LLM,
and autonomous behavior logs record exception types or HTTP status rather than
raw exception and response text.

Task delivery no longer returns Telegram API `description` or transport
exception strings. It emits stable generic errors and status codes, allowing
retry classification without reflecting a token-bearing request URL. The
generic delivery dispatcher and other built-in adapters also replace raw
exception text before broker responses are built.

## Verification

Focused tests cover strict parsing, atomic encrypted storage, plaintext-backend
rejection, canonical and obsolete-key migration, conflicting-token rejection,
configured-only IPC, sender authorization, process hydration, environment
removal, Server compatibility, persistence redaction, manager status
redaction, canonical terminal delivery, Telegram API response redaction, and
transport exception redaction.

The focused run passed 8 TypeScript service/storage/IPC tests, 7 Python
credential/delivery tests, 6 task terminal-delivery tests, and 17 Renderer
startup tests. UTF-8 validation, Python docstrings, TypeScript function JSDoc,
JavaScript syntax, Python compilation, and Renderer bootstrap checks passed.

The complete architecture regression passed Desktop Core at 136/136 together
with all Python, Worker, runtime-profile, Feature Pack, and connector suites.
The test command ran with the project virtual environment placed first on
`PATH`.

The real Electron cold-start smoke seeded the Telegram token with all previous
credential classes. It verified the seventh independent credential-class
sidecar, configured-only SQLite metadata, plaintext-free database and encrypted
file bytes, and an inactive legacy backend after a 2.5-second settle window.
The budget-gated run completed with process startup at 1.659 seconds and
workspace hydration at 1.413 seconds, below the 10-second and 3-second budgets.
The precompiled Renderer hash is
`90b41d9d0a994f723177c5f0fdb9d309a4027098dd5dd61768281ccfb276f1b8`.

## Residual Boundary

The Bot token must exist briefly in trusted Python process memory and Telegram
API request URLs because the protocol requires it. It is removed when either
consumer exits and is never included in public diagnostics. Moving Telegram
polling into an independently packaged Worker remains a separate lifecycle and
dependency-isolation phase, not a credential-storage requirement.

## Remaining Trust Zones

- Image-hosting API keys and repository tokens.
- Bilibili, YouTube, and Twitch live-platform credentials.
- Generic webhook credentials and per-target terminal-delivery secrets.
- Code sandbox and external execution credentials.

Each remaining domain requires an explicit owner, migration rules, consumer
allow-list, error policy, rotation behavior, and clear semantics.
