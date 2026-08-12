# Phase 3Z Image-Host Credentials

## Status

Implemented on 2026-07-27. SM.MS and EasyImage 2 API credentials are now
owned by an independent Electron Main `safeStorage` boundary and stored in
`image-host-credentials.bin`. Desktop Renderer state, legacy SQLite, Core
SQLite, compatibility payloads, Worker RPC, status responses, and
application-owned logs do not retain or return their plaintext values.

The image-host upload implementation remains in the optional Connector Worker.
This phase changes credential ownership and hardens its network adapter without
merging image hosting into the five messaging-platform credential scopes.

## Credential Scope

The boundary accepts exactly two `BotConfig` fields:

| Provider | Encrypted field | Plain metadata |
| --- | --- | --- |
| SM.MS | `SMMS_api_key` | enabled state and selected provider |
| EasyImage 2 | `EI2_api_key` | endpoint, enabled state, and selected provider |

Secrets must be single-line UTF-8 text from 4 to 65,536 characters. Unknown
fields, control characters, conflicting save/clear mutations, and example
placeholders are rejected. Public IPC snapshots return configured field names
and secure-storage availability only.

`gitee_token` and `github_token` are deliberately excluded. They authorize
repository synchronization rather than image upload, have no active Desktop
runtime consumer, and require a separate owner and migration contract.

## Storage And Migration

The encrypted file is independent from Authentication, Provider, Search,
Voice, MCP, custom HTTP, Connector Worker, and Telegram credentials. Linux
`basic_text` storage is rejected and there is no plaintext fallback. Writes use
a mode-0600 temporary file followed by atomic replacement.

Main captures the two legacy fields before clearing compatibility settings and
adds `imageHostCredentialFieldsConfigured` to `BotConfig`. SQLite is rewritten
only after secure capture. If encryption is unavailable or legacy data is
invalid, Renderer receives a redacted view but Main does not destroy the only
disk copy; trusted writes fail closed.

Repository tokens remain unchanged during migration and compatibility writes.
This is covered as a negative contract so later work cannot accidentally absorb
them into the image-host sidecar.

## Renderer Lifecycle

Both password inputs use configured-only state. A completed edit is sent
through authorized typed IPC, after which its reactive plaintext value is
cleared. Configured inputs show a replacement placeholder and an icon-only
explicit clear control.

Desktop compatibility payloads detach `BotConfig` and force only
`SMMS_api_key` and `EI2_api_key` to empty strings. Gitee and GitHub repository
tokens are preserved until their own migration. Browser and Server profiles
retain existing plaintext behavior when the typed Desktop API and Main runtime
envelope are absent.

The selected-provider write path now uses the canonical `imgHost` setting.
SM.MS is the default in the settings template, while `EI2` and the obsolete
`easyImage2` identifier both route to the EasyImage 2 adapter.

## Runtime Boundary

Main injects one bounded `OPENXNET_IMAGE_HOST_CREDENTIALS_B64` envelope only
into a freshly started Connector Worker. Renderer, the legacy backend,
Execution Engine, Task Worker, and unrelated capability workers do not receive
it. The Worker removes the environment variable after decoding and hydrates
only the two image-host fields in its in-memory settings.

Credential rotation stops a running Connector Worker. Its next activation
receives a new environment envelope, preventing a process with an old key from
remaining active. Rotation does not restart unrelated workers or the legacy
backend.

The independent Connector Feature Pack version is now `1.2.0`. Its archive
contains both `py.image_host` and `py.image_host_credentials`.

## Upload And Error Policy

The Connector Worker now supports SM.MS upload through a scoped Authorization
header and retains EasyImage 2 compatibility for both provider identifiers.
Blocking downloads and uploads run outside the asyncio event loop. External
image downloads accept known image content types and are limited to 25 MiB.

Remote URLs, local temporary paths, API response bodies, credential-bearing
exception strings, and raw transport errors are not logged or returned.
Application responses use stable generic errors and HTTP status logging where
needed. Application-created temporary files are removed without exposing their
paths.

## Verification

Focused coverage passed 8 TypeScript contract/storage/IPC tests, 7 Python
credential/upload tests, and 18 Renderer startup tests. The full architecture
regression passed Desktop Core at 144/144 together with all Python, Worker,
runtime-profile, Feature Pack, and Connector suites. UTF-8, Python docstring,
TypeScript JSDoc, syntax, and Renderer bootstrap checks passed.

The release-side Connector Pack build produced
`1.2.0-openxnet.1.0.2` with 835 integrity-protected files and 171,732,176
payload bytes. Archive inspection confirmed both image-host modules, and Pack
smoke passed for QQ, Feishu, Dingtalk, Discord, and Slack.

The real Electron cold-start smoke seeded image-host and repository tokens. It
verified that only the image-host fields migrated into the eighth independent
encrypted credential file, repository tokens remained in their separate
domain, encrypted and SQLite bytes contained no migrated plaintext, and
`legacy-backend` remained stopped. Process startup completed in 1.772 seconds
and workspace hydration in 1.468 seconds, below the 10-second and 3-second
budgets. The precompiled Renderer hash is
`3dfe172570018a134b8e6d12f083aa2fef97ae88035fa6566843e833c9936028`.

## Remaining Trust Zones

- Gitee and GitHub repository synchronization credentials.
- Bilibili, YouTube, and Twitch live-platform credentials.
- Generic webhook credentials and per-target terminal-delivery secrets.
- Code sandbox and external execution credentials.

Each remaining domain requires an explicit owner, migration rules, consumer
allow-list, error policy, rotation behavior, and clear semantics.
