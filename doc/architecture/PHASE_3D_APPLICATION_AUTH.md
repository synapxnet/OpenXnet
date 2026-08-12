# Phase 3D: Application Authentication Ownership

## Status

Implemented on 2026-07-23. Desktop authentication persistence is now owned by
TypeScript Application Core. The primary and alternate Renderer workspaces no
longer write access tokens or refresh tokens to browser `localStorage`.

## Previous Risk

Both legacy workspaces stored bearer and refresh tokens as plaintext JSON:

- `openxnet-v174-auth-session` in the primary Renderer;
- `openxnet.uiplan.auth` in the alternate UI-plan workspace.

Any script executing in the Renderer origin could read those long-lived tokens.
The browser store also mixed account metadata, subscription state, gateway
credentials, and token expiry into one unversioned payload.

## Storage Boundary

Authentication is split by sensitivity:

| Data | Owner | Storage |
| --- | --- | --- |
| Profile, entitlement, quota metadata, and expiry timestamps | Application Core | `desktop-core.db` document `auth-session-metadata` |
| Access token and refresh token | Application Core credential adapter | Electron `safeStorage` encrypted `auth-credentials.bin` |
| Subscription gateway bootstrap and API Key | Application Core credential adapter | Same OS-encrypted credential payload |
| Passwords and SMS codes | Renderer form only | Never persisted |

The SQLite document contains a credential reference but no token, API Key, or
gateway bootstrap. Authentication state is not included in the first-frame
Desktop bootstrap snapshot; an authorized Renderer requests it after hydration.

`safeStorage` uses the operating-system encryption backend. Authentication save
fails closed when encryption is unavailable or Linux selects the insecure
`basic_text` backend. No plaintext file fallback exists.
The encrypted file is bounded, written with a same-directory temporary file,
and atomically renamed. Logout removes credentials before deleting metadata, so
a crash during clear can produce at most stale non-secret metadata and never a
restorable ghost session.

## IPC Contract

The preload exposes three allow-listed operations:

- `getAuthSession()`;
- `saveAuthSession({ authState, authSession })`;
- `clearAuthSession()`.

Electron Main authorizes every request against the primary workspace sender.
Save requests require exactly two objects, normalize all nested profile,
entitlement, quota, timestamp, token, and gateway fields, and enforce explicit
length and item-count budgets.

## Migration And Lifecycle

On Renderer initialization:

1. Read the Core authentication snapshot.
2. Use it when a valid signed-in session exists.
3. Otherwise inspect the former localStorage key once.
4. Persist the legacy state through Core, splitting secrets from metadata.
5. Remove both historical browser keys only after Core persistence succeeds.

New login, registration, token refresh, profile refresh, and logout operations
write through a single Renderer promise chain. This prevents an older async
response from overwriting a newer token rotation or logout. In-memory state is
updated immediately so UI behavior remains compatible.

The alternate UI-plan entry uses the same Core contract. Browser-only previews
retain sessions in memory for the current page lifetime and remove obsolete
localStorage values instead of creating a plaintext fallback.

## Verification

Automated and runtime coverage includes:

- SQLite document deletion with optimistic revision validation;
- metadata and credential separation;
- exact authorized authentication IPC handlers;
- repeated identical saves without revision churn;
- logout deletion of both metadata and credentials;
- encrypted file write, read, reopen, and clear;
- source contracts preventing both Renderer entries from writing auth tokens to
  `localStorage`;
- a real Electron `safeStorage` smoke proving token recovery across reopen while
  SQLite and the encrypted file contain no plaintext token or gateway API Key.

Desktop Core now passes 42 tests. A development Electron smoke completed with a
1,312 ms workspace and 1,758 ms process startup. Guest startup created
`desktop-core.db` but correctly did not create a credential file.

## Remaining Boundary

This section described the boundary remaining when Phase 3D shipped. Phase 3T
now owns Desktop login and subscription transport in Electron Main, returns
redacted authentication snapshots, and resolves the managed subscription
provider key directly from the authentication credential boundary. The Python
proxy remains only for Browser and Server compatibility profiles.

Phase 3E should move file metadata ownership next. Task persistence should follow
after file artifact identifiers are stable because task inputs and outputs refer
to those artifacts.
