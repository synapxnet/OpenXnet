# Phase 3T Application Access Gateway

## Status

Implemented on 2026-07-26. Desktop account, authentication, subscription, and
order requests are now owned by Electron Main. Normal Desktop Renderer flows no
longer receive access tokens, refresh tokens, or the managed subscription
gateway API key. Browser and Server profiles retain their existing HTTP path.

## Trust Zones

| Data or operation | Owner | Renderer visibility |
| --- | --- | --- |
| Profile, entitlement, quota, and expiry metadata | Application Core | Bounded metadata |
| Access and refresh tokens | Authentication `safeStorage` boundary | Configured booleans only |
| Subscription gateway API key | Authentication `safeStorage` boundary | Configured boolean only |
| Ordinary model-provider keys | Provider `safeStorage` boundary | Configured booleans only |
| Login, SMS, profile, subscription, and order transport | Main Access Gateway | Sanitized result only |

SMS and password input remains transient Renderer form data because the user
enters it there. It crosses one sender-authorized IPC request and is forwarded
only to the fixed account origin. It is never persisted or logged by Main.

## Access Contract

`ApplicationAccessGateway` accepts one typed request containing a path, method,
bounded JSON body, and optional timeout. The contract enforces:

- an exact method and route allow list for plans, authentication, profile,
  subscription, credits, expiry, and order operations;
- exact query handling for upgrade previews and bounded order identifiers;
- no Renderer-selected origin, headers, authorization value, redirect policy,
  or arbitrary remote path;
- a 64 KiB request budget, 1 MiB response budget, and 1-30 second timeout;
- `redirect: "error"` so credentials cannot follow a remote redirect; and
- HTTPS remote origins, with HTTP allowed only for explicit loopback
  development services.

Electron networking performs the request so the account transport inherits the
desktop system proxy behavior without starting Python. Remote failures are
returned as tagged, bounded errors. Full response bodies, transport exception
details, authorization headers, tokens, and gateway keys are not included in
the failed IPC result.

## Session Lifecycle

Main attaches the stored access token only to routes that require or optionally
accept authentication. It refreshes an expiring session before use, coalesces
concurrent refresh attempts, and retries one authenticated request after HTTP
401. A rejected refresh clears encrypted credentials and metadata.

Successful login, registration, refresh, profile read, and profile update
responses are normalized and committed by `ApplicationAuthService` before the
result returns to Renderer. Logout clears the Main session. Public auth
snapshots contain only expiry timestamps and `accessTokenConfigured`,
`refreshTokenConfigured`, and `api_key_configured` flags.

The primary Renderer may still submit one old authentication snapshot through
the existing save IPC solely for bounded localStorage migration. It applies the
returned redacted snapshot and removes the legacy browser value immediately.
Normal account operations never use that save path.

## Managed Provider Credential

The subscription provider keeps metadata in the Core provider document using
ID `openxnet-access-managed-provider` and owner `openxnet-access`. Its key is not
copied into `provider-credentials.bin`.

`ApplicationProviderService` resolves that credential from the authentication
boundary only when the provider remains managed and its URL exactly matches the
authenticated gateway bootstrap URL. Public snapshots, validation, and child
runtime bootstrap use the merged effective credential view. Provider writes
ignore a Renderer copy of the managed key and synchronization removes any
historical duplicate from the ordinary provider credential store.

An authentication change re-synchronizes the external credential view and
invalidates active Python provider runtimes. The next explicit request launches
a process with the current bounded credential bootstrap.

## Verification

Automated coverage includes route/method/query/body rejection, sender
authorization, redirect denial, response limits, generic transport errors,
Main-owned refresh and retry, public result redaction, auth metadata/credential
separation, managed-key runtime resolution, copied-key deletion, URL binding,
credential rotation notification, both Renderer typed-IPC paths, UTF-8 checks,
and TypeScript function documentation checks.

The cold-start smoke remains responsible for proving that account ownership
does not activate `legacy-backend` and does not regress the first-workspace
budget. The formal post-change run completed with process startup at 1.729
seconds and workspace hydration at 1.494 seconds; `legacy-backend` remained
stopped after the 2.5-second observation window.
