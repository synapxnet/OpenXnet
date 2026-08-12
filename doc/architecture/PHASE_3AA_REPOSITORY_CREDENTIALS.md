# Phase 3AA Repository Credentials

## Status

Implemented on 2026-07-27. Gitee and GitHub repository tokens are now owned by
an independent Electron Main `safeStorage` boundary and stored in
`repository-credentials.bin`. Desktop Renderer state, legacy SQLite, Core
SQLite, compatibility payloads, child-process environments, Worker RPC, status
responses, and application-owned logs do not retain or return their plaintext
values.

The existing repository configuration is metadata-only. No current Desktop,
Python, Worker, or Feature Pack implementation consumes these tokens. This
phase therefore establishes secure ownership without inventing a runtime
credential injection path.

## Credential Scope

The boundary accepts exactly two `BotConfig` fields:

| Service | Encrypted field | Plain metadata |
| --- | --- | --- |
| Gitee | `gitee_token` | owner, repository name, and branch |
| GitHub | `github_token` | owner, repository name, and branch |

Secrets must be single-line UTF-8 text from 4 to 65,536 characters. Unknown
fields, control characters, conflicting save/clear mutations, and example
placeholders are rejected. Public IPC snapshots return configured field names
and secure-storage availability only.

Image-host credentials remain in `image-host-credentials.bin`. The repository
contract rejects SM.MS and EasyImage fields, while the image-host contract
rejects Gitee and GitHub tokens.

## Storage And Migration

The encrypted file is independent from Authentication, Provider, Search,
Voice, MCP, custom HTTP, Connector Worker, Telegram, and image-host
credentials. Linux `basic_text` storage is rejected and there is no plaintext
fallback. Writes use a mode-0600 temporary file followed by atomic replacement.

Main composes repository migration after image-host normalization. It captures
`gitee_token` and `github_token`, retains owner, repository name, and branch
metadata, clears the two plaintext fields, and adds
`repositoryCredentialFieldsConfigured` to `BotConfig`. SQLite is rewritten
only after secure capture.

If encryption is unavailable or legacy data is invalid, Renderer receives a
redacted view but Main does not destroy the only disk copy. Trusted writes fail
closed. Storage read and write failures cross IPC only as stable generic errors
without filesystem or encrypted-payload details.

## Renderer Lifecycle

Both password inputs use configured-only state. A completed edit is sent
through sender-authorized typed IPC, after which its reactive plaintext value
is cleared. Configured inputs show a replacement placeholder and an icon-only
explicit clear control.

Desktop compatibility payloads detach `BotConfig`, clear both token fields,
and retain only configured field names and plain repository metadata. Browser
and Server profiles retain their existing plaintext configuration behavior
when the typed Desktop API is absent.

## Runtime Boundary

The repository credential service deliberately exposes no runtime bootstrap,
subscription, environment envelope, or child-process injection API. Credential
updates do not restart the legacy backend, Execution Engine, Connector Worker,
Task Worker, or any optional capability.

When repository synchronization is implemented, it must use a dedicated
Main-owned broker with exact operations, host allow-lists, bounded request and
response bodies, generic errors, and auditable side effects. Tokens must not be
added to the legacy backend or a generic Worker environment for convenience.

## Verification

Focused coverage passed 8 TypeScript contract/storage/IPC tests and 19 Renderer
startup tests. Desktop Core passed 152/152. Tests cover exact field parsing,
encrypted storage, plaintext-backend rejection, metadata-preserving migration,
unavailable-encryption behavior, configured-only snapshots, explicit clear,
sender authorization, and the absence of any runtime bootstrap.

The complete architecture regression passed all Python, Worker,
runtime-profile, Feature Pack, task, and Connector suites with the project
virtual environment placed first on `PATH`.

The real Electron cold-start smoke seeded both repository tokens together with
all previously migrated credential classes. It verified the ninth independent
encrypted sidecar, configured-only legacy SQLite state, metadata retention,
cross-file isolation, plaintext-free database and encrypted-file bytes, and an
inactive `legacy-backend` after a 2.5-second settle window. Process startup
completed in 1.584 seconds and workspace hydration in 1.339 seconds, below the
10-second and 3-second budgets. The precompiled Renderer hash is
`09c6a32aa0ed2c33e31d9e80db555d3a785b0285f62be66609d3d2758197a858`.

## Remaining Trust Zones

- Bilibili, YouTube, and Twitch live-platform credentials.
- Generic webhook credentials and per-target terminal-delivery secrets.
- Code sandbox and external execution credentials.

Each remaining domain requires an explicit owner, migration rules, consumer
allow-list, error policy, rotation behavior, and clear semantics.
