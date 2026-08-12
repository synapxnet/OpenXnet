# Phase 3S Provider Credentials

## Status

Implemented on 2026-07-26. Desktop model-provider metadata is now owned by
Application Core, while provider credentials are encrypted by Electron
`safeStorage`. Legacy plaintext provider keys are migrated defensively and are
not returned by Main IPC or written back to either SQLite database.

This phase covers ordinary model providers represented by `modelProviders` and
the selected-provider copies stored in legacy configuration nodes. It does not
merge unrelated credential classes into one store.

## Ownership Model

| Data | Owner | Durable location | Renderer visibility |
| --- | --- | --- | --- |
| Provider ID, vendor, URL, models, disabled state | Application Core | `desktop-core.db` | Full metadata |
| Provider configured state | Application Core projection | Derived from encrypted store | Boolean only |
| Provider API key | Electron Main | `provider-credentials.bin` through `safeStorage` | Transient user entry only |
| Legacy provider compatibility fields | Main compatibility bridge | `super_agent_party.db` | Redacted values only |
| Account gateway bootstrap | Authentication boundary | Existing auth `safeStorage` store | Existing auth contract |

Renderer may submit a newly typed key to an authorized save or validation IPC
request. A successful save replaces the local draft with redacted metadata and
clears copied `api_key` fields. Main responses never contain the key.

## Migration

When the legacy Renderer-state bridge reads settings, Main performs the
following bounded migration before returning the snapshot:

1. Parse at most 128 strict provider records and normalize numeric IDs to
   strings.
2. Collect `modelProviders[].apiKey` and recursive `api_key` values only from
   nodes that identify a `selectedProvider`.
3. Encrypt the captured provider map through Electron `safeStorage`.
4. Persist only non-secret metadata in the Core provider document.
5. Replace every migrated secret with an empty string and retain only
   `apiKeyConfigured` or `api_key_configured` booleans.
6. Rewrite the legacy SQLite row with `PRAGMA secure_delete = ON` only after the
   secure capture succeeds.

If OS encryption is unavailable, a read does not destroy the only legacy copy.
A Renderer write containing a secret fails rather than silently persisting or
discarding plaintext. The Linux `basic_text` password backend is treated as
unavailable.

## Runtime Boundary

Provider metadata, save, model-list validation, and Workbench apply operations
use authorized typed IPC in Desktop. Browser and Server profiles retain their
existing HTTP fallbacks.

Main validates provider connectivity directly and uses the stored credential
without returning it. When Main starts the Execution Engine or the explicit
legacy compatibility backend, it injects an exact provider credential map into
that child only through `OPENXNET_PROVIDER_CREDENTIALS_B64`. The decoded JSON is
limited to 20 KiB. Python hydrates copied provider fields in process and redacts
them again before any settings write.

A provider metadata change, key rotation, key removal, or provider removal
invalidates active provider runtimes. The next request starts a fresh process
with the current credential map.

## Startup And Shutdown

Provider migration remains part of the typed legacy-state restore and does not
activate Python. Hidden startup no longer creates an invisible skeleton
BrowserWindow. Renderer yields after critical legacy-state restoration and
deferred-task registration so Main diagnostics and lifecycle events cannot be
starved by legacy mounted work.

Shutdown invokes compatibility bot cleanup only when `legacy-backend` was
already running. Windows are destroyed before IPC and storage handlers are
removed, preventing shutdown from activating Python or accepting late Renderer
writes.

## Trust Zone Follow-up

- Phase 3T completed the separate authentication review: Desktop Renderer no
  longer receives account tokens or the gateway key, and managed Provider
  runtime access resolves the key from auth `safeStorage` without copying it.
- Phase 3U completed the independent Web Search credential boundary, Phase 3V
  completed the Voice vendor boundary, and Phase 3W completed separate MCP and
  custom HTTP boundaries. Connector credentials, delivery targets, and other
  feature-specific secrets are not ordinary model-provider credentials. Each
  still needs its own owner, contract, migration, and least-privilege runtime
  injection path.
- Browser and Server compatibility profiles may still hold provider keys in
  their process memory and HTTP payloads; Phase 3S guarantees apply to Desktop.

## Verification

Coverage includes strict contracts, encrypted-store availability, metadata and
credential separation, legacy recursive redaction, sender authorization,
stored-key validation, runtime bootstrap bounds, Python hydration/redaction,
key-rotation notification, and Desktop-vs-Browser Renderer routing.

The real Electron cold-start smoke seeds a legacy plaintext key, waits 2.5
seconds after workspace ready, and verifies that:

- `legacy-backend` remains stopped and no owned legacy process exists;
- the legacy SQLite row and raw database bytes contain no seeded plaintext;
- `desktop-core.db` contains no seeded plaintext;
- `provider-credentials.bin` exists and contains no seeded plaintext; and
- the encrypted credential is available to Main-owned runtime launch code.

The formal Electron run completed with process startup at 1.492 seconds and
workspace hydration at 1.260 seconds on the implementation host.
