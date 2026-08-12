# Phase 3AB Live-Platform Credentials

## Status

Implemented on 2026-07-27. Bilibili, YouTube, and Twitch live-platform secrets
are now owned by an independent Electron Main `safeStorage` boundary and stored
in `live-platform-credentials.bin`. Desktop Renderer state, legacy SQLite, Core
SQLite, compatibility persistence, unrelated child environments, status
responses, and application-owned errors do not retain or return their
plaintext values.

At the time of this phase, live transport remained an explicit legacy-backend
workflow. Phase 3AN subsequently moved Desktop live transport into a dedicated
Live Worker and Feature Pack while preserving this credential boundary.

## Credential Scope

The boundary accepts exactly five `liveConfig` fields:

| Platform | Encrypted fields | Plain metadata |
| --- | --- | --- |
| Bilibili | `bilibili_sessdata`, `bilibili_ACCESS_KEY_SECRET`, `bilibili_ROOM_OWNER_AUTH_CODE` | auth mode, room ID, Access Key ID, App ID |
| YouTube | `youtube_api_key` | video ID |
| Twitch | `twitch_access_token` | channel |

Access Key ID and App ID remain metadata because they identify an application
but do not authenticate without the separately encrypted secret and owner auth
code. Secrets must be single-line UTF-8 text from 4 to 65,536 characters.
Unknown fields, control characters, conflicting save/clear mutations, and
example placeholders are rejected. Public IPC snapshots return configured
field names and secure-storage availability only.

## Storage And Migration

The encrypted file is independent from Authentication, Provider, Search,
Voice, MCP, custom HTTP, Connector Worker, Telegram, image-host, and repository
credentials. Linux `basic_text` storage is rejected and there is no plaintext
fallback. Writes use a mode-0600 temporary file followed by atomic replacement.

Main composes live-platform migration after repository normalization. It
captures the five secrets, clears their compatibility fields, adds
`liveCredentialFieldsConfigured`, and retains only non-secret platform
metadata. SQLite is rewritten only after secure capture.

Migration also corrects two obsolete compatibility identifiers:

- `youtube_vedio_id` becomes the canonical `youtube_video_id`.
- Bilibili auth mode `open_live` becomes the UI and route value `open`.

If encryption is unavailable or legacy data is invalid, Renderer receives a
redacted view but Main does not destroy the only disk copy. Trusted writes fail
closed.

## Renderer Lifecycle

All five password inputs use configured-only state. A completed edit is sent
through sender-authorized typed IPC, after which its reactive plaintext value
is cleared. Configured inputs show a replacement placeholder and an icon-only
explicit clear control.

Desktop settings persistence, `/api/live/start`, and `/api/live/reload` all use
the same detached secret-free live configuration. Browser and Server profiles
retain their existing plaintext behavior when the typed Desktop API and Main
runtime envelope are absent.

Live validation now accepts stored credential state, validates every enabled
platform instead of only the first one, uses the canonical YouTube video field,
and matches Bilibili `web` and `open` modes.

## Runtime Boundary

Main injects one bounded `OPENXNET_LIVE_PLATFORM_CREDENTIALS_B64` envelope only
into a freshly started Live Worker or explicitly activated Server compatibility
backend. Renderer, Execution Engine, Task Worker, Connector Worker, Voice
Worker, and unrelated capability workers do not receive it. Python removes the
environment variable on first decode and hydrates only the in-memory
`liveConfig` or one explicit live operation.

Credential rotation stops the Live Worker and a running compatibility backend
so all Bilibili threads, YouTube pollers, and Twitch tasks end with their
credential-bearing processes. The next explicit live activation receives a
fresh envelope. Rotation does not restart the Execution Engine, Task Worker,
Connector Worker, Voice Worker, or unrelated optional Workers.

## Transport And Error Policy

Bilibili web-cookie and Open Live paths now match the UI modes. YouTube uses
the canonical video ID and its direct bounded REST client. Twitch continues to
authenticate over TLS IRC.

Live start, stop, reload, background Bilibili, YouTube polling, and Twitch
reconnect errors log only exception types or stable status. Remote response
bodies, credential-bearing query URLs, raw transport exceptions, SESSDATA,
Access Key Secret, owner auth code, API keys, and OAuth tokens are not returned
or written to application logs.

## Verification

Focused coverage passed 8 TypeScript contract/storage/IPC tests, 6 Python
credential/route tests, 6 Google REST tests, and 20 Renderer startup tests.
Desktop Core passed 160/160. UTF-8, Python docstring, TypeScript JSDoc, syntax,
and Renderer bootstrap checks passed.

The complete architecture regression passed all Python, Worker,
runtime-profile, Feature Pack, task, and Connector suites with the project
virtual environment placed first on `PATH`.

The real Electron cold-start smoke seeded all five live secrets with every
previous credential class. It verified the tenth independent encrypted
sidecar, configured-only legacy SQLite state, metadata retention, obsolete-key
normalization, cross-file isolation, plaintext-free database and encrypted-file
bytes, and an inactive `legacy-backend` after a 2.5-second settle window. The
budget-gated pass completed with process startup at 1.990 seconds and workspace
hydration at 1.653 seconds, below the 10-second and 3-second budgets. The
precompiled Renderer hash is
`cd7360b9a8b62efdffa3231efe7ea1c964958907ec4520ad0806bc81a879719a`.

## Remaining Trust Zones

- Generic webhook credentials and per-target terminal-delivery secrets.
- Code sandbox, Home Assistant, ComfyUI, and external execution credentials.

Each remaining domain requires an explicit owner, migration rules, consumer
allow-list, error policy, rotation behavior, and clear semantics.

## Phase 3AN Supersession

Phase 3AN is the current Desktop runtime boundary. Desktop Renderer now uses
typed IPC and validated `live.event` broadcasts, while Browser/Server retains
the compatibility routes. See `PHASE_3AN_LIVE_RUNTIME.md` for the dedicated
Worker, packaging, lifecycle, and current verification record.
