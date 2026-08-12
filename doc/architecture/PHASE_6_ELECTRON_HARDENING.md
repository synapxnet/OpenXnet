# Phase 6: Electron Hardening

## Status

The Electron trust-boundary hardening implementation was completed on
2026-07-23. All application-owned windows now inherit one tested security
baseline, privileged IPC is restricted to the window that owns the operation,
and untrusted browser content remains isolated behind a forced webview policy.

No private key, credential file, or test secret was added. The repository
ignores `.env`, PEM, and release-secret paths, and `@electron/remote` is not a
runtime dependency.

## Window Trust Matrix

| Window | Preload | Sandbox | Web security | Node integration | Webview |
| --- | --- | --- | --- | --- | --- |
| Main workspace | `preload.js` | on | on | off | explicitly enabled |
| Startup screen | `skeleton-preload.js` | on | on | off | off |
| Dynamic island | `surface-preload.js` | on | on | off | off |
| Floating task HUD | `surface-preload.js` | on | on | off | off |
| Extension window | none | on | on | off | off |
| VRM window | `vrm-preload.js` | on | on | off | off |
| Screenshot overlay | `shotPreload.js` | on | on | off | off |

`createSecureWebPreferences()` owns the baseline. Security-critical fields are
applied after caller overrides, so a future window cannot disable sandboxing,
context isolation, web security, or Node isolation by passing an unsafe
override. A regression test verifies this behavior.

The main workspace retains `webviewTag` because the embedded browser is a
product capability. `will-attach-webview` overwrites every guest preference:
only the application-owned preload is accepted, Node and nested Node
integration are disabled, sandbox and web security are enabled, and the first
URL must be HTTP(S) or `about:blank`. Later navigation and redirects apply the
same protocol policy.

## Renderer And IPC Boundary

The main preload no longer imports filesystem, path, shell, or compiled Core
modules. Desktop Core channels are declared in the isolated preload and all
event subscriptions remove the Electron event object before invoking page
callbacks.

The following direct capabilities were removed:

- arbitrary shell command execution;
- arbitrary `readFile` access;
- Renderer access to `app.getAppPath()` and path joining;
- direct `shell.openExternal()` and `shell.openPath()` calls;
- broad main preload reuse by helper windows.

Native Open dialogs now create bounded in-memory grants. File reads require an
exact selected-file grant and a regular file below the size budget. Directory
opening accepts only application-owned roots or an explicitly selected
directory. Uploaded-file links provide one leaf filename; Main resolves it
below `userData/uploaded_files` after traversal and reserved-name checks.

External URLs accept only HTTP, HTTPS, or mailto without embedded credentials.
Downloads accept only HTTP(S), a safe leaf filename, and the primary workspace
sender. Extension windows accept only the current local UI origin and bounded
screen dimensions. Custom protocol install requests have explicit type,
length, and character allow-lists.

Desktop Core performs sender authorization inside its IPC adapter before
capability activation or Feature Pack mutation. Core state and Feature Pack
progress are published only to the main workspace instead of every window.

## Screenshot, VMC, And Native Actions

Screenshot IPC validates sender identity, binary size, image decodability, and
crop bounds. Screenshot selection events are accepted only from the active
overlay WebContents. Native context-menu image operations reject filesystem
paths and bound network image downloads before decoding.

VRM uses a dedicated preload exposing only VMC configuration, bounded frame
delivery, raw OSC events, and mouse hit testing. VMC ports, destination hosts,
bone counts, blend counts, names, and numeric values are validated before OSC
serialization. VMC receive remains opt-in because it intentionally supports an
external motion source.

Window, updater, file, download, restart, login-item, dynamic-surface, log, and
Core operations validate their owning window. Window dimensions and extension
dimensions are clamped to the active display.

## Navigation, Permissions, And Network

Application BrowserWindows may navigate only within the active loopback UI
origins or their specific application-owned file roots. Native popup creation
is denied globally. HTTP(S) popup requests become validated internal browser
tabs, mailto is handed to the operating system, and active-content schemes are
blocked.

Electron sessions use a deny-by-default permission broker. Only the main and
VRM application windows on trusted local origins may request the small
allow-list of media, fullscreen, pointer-lock, notification, and sanitized
clipboard permissions. The isolated external-browser session denies permission
requests until a site-facing permission UI is implemented.

The legacy `networkVisible=global` mode no longer binds the Python backend to
`0.0.0.0`. The backend remains on `127.0.0.1`; restoring LAN access requires a
separate authenticated gateway. The Worker RPC Gateway already uses a random
process-lifetime bearer token and loopback binding. Chromium flags that disabled
COOP and SameSite cookie protections, plus the wildcard remote-debugging
origin, were removed.

Static UI responses now include CSP, COOP, Permissions-Policy,
Referrer-Policy, and MIME-sniffing protections. The transitional CSP blocks
remote script execution, objects, foreign base URLs, and embedding while
retaining inline script/style and eval compatibility for the legacy monolithic
UI.

## Validation

The hardening has dedicated coverage for:

- immutable secure BrowserWindow preferences;
- external, download, navigation, and credential-bearing URL policy;
- application-owned and dialog-granted filesystem paths;
- extension dimensions and download filenames;
- Desktop Core sender authorization;
- Local UI Gateway security headers;
- development Electron startup under sandbox and CSP;
- packaged ASAR preload inclusion and packaged UI startup without Python.

Development and packaged startup screenshots both rendered the full main UI.
The packaged UI smoke intentionally omits `resources/server`; its expected
backend-start failure confirmed that local UI startup remains independent from
Python availability.

Final verification completed with:

- 32 of 32 Desktop Core tests passing;
- every Worker protocol, Feature Pack, Voice, audio, Vector, Memory, Document,
  Google REST, and Connector Python suite passing;
- 8 of 8 kernel regression surfaces passing;
- UTF-8 and function-documentation standards passing;
- `git diff --check` reporting no whitespace errors;
- `npm audit --omit=dev` reporting zero production vulnerabilities.

## Remaining Hardening

- Move the remaining legacy `main.js` IPC registrations into typed modules so
  sender policy and payload schemas are mechanically reviewable.
- Remove CSP `unsafe-inline` and `unsafe-eval` after inline scripts/styles and
  runtime template compilation are eliminated.
- Add a user-facing per-site permission broker before external webviews may use
  camera, microphone, notifications, or device APIs.
- Add N-1 fixtures when protocol `2.x` is introduced. Protocol `1.0` has no
  older supported contract to migrate today; unknown versions remain rejected.
- Restore LAN access only through an authenticated, rate-limited gateway with
  explicit audit events and revocable credentials.
