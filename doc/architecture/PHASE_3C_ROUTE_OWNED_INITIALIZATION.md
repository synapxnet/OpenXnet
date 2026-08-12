# Phase 3C: Route-Owned Initialization

## Status

Implemented on 2026-07-23. The legacy Vue workspace now reports its first
interactive frame before non-critical mounted work begins. Hidden dead pages no
longer create DOM nodes, and service probes start only after their owning menu is
first opened.

## First-Frame Boundary

`startup-bootstrap.js` owns the deferred-work boundary. Main releases that
boundary after the workspace-ready frame can paint. Deferred tasks then enter a
named idle queue with these guarantees:

- one task starts per browser idle slice;
- duplicate task names share one completion promise;
- tasks scheduled before workspace readiness cannot run early;
- bounded task status and timing are available in the startup snapshot;
- task failures do not block later queue entries.

`tests/renderer_startup_bootstrap.test.cjs` locks these ordering and
deduplication guarantees into the architecture test chain.

## Route Ownership

| Owner | Deferred initialization |
| --- | --- |
| Home / Chat / VRM / Deploy | TTS WebSocket and optional system voice list |
| Home / Task Center | Desktop-control history, windows, monitors, active window, and approval stream |
| Toolkit / API / System | Node.js, uv, and Docker probes |
| Model Configuration | Sherpa model status |
| Knowledge / Role / Toolkit / Skills | MiniLM model status |
| VRM | VRM connection status poller |
| AI Browser | trusted webview preload URL, favorites, and initial tab state |
| Global idle | backend port notice and automatic update timers |

The scheduler deduplicates shared owners. For example, moving from Home to Chat
does not create another TTS socket, and opening Toolkit after API does not rerun
the toolchain probes.

Audio output has no route-level allocation. `AudioContext` is created only when
PCM or Omni TTS playback is requested. TTS reconnect timers and VRM polling now
have explicit idempotent start and teardown functions.

The startup-time QR initialization was removed because its legacy canvas no
longer exists. QR runtimes remain loaded on demand by the active subscription
and QR surfaces.

## DOM Ownership

Eight legacy pages previously declared with `v-show="false"` still created and
laid out their complete hidden DOM trees. They now use `v-if="false"`, so Vue
does not instantiate unreachable compatibility markup. This reduced the
workspace-ready path before deferred services were introduced.

## Startup Budgets

The performance gate now separates process and workspace budgets:

- `OPENXNET_PROCESS_STARTUP_BUDGET_MS`, default 10,000 ms;
- `OPENXNET_WORKSPACE_STARTUP_BUDGET_MS`, default 3,000 ms;
- `OPENXNET_STARTUP_BUDGET_MS` remains a compatible fallback for both values.

Measured development results on 2026-07-23:

| Checkpoint | Process | Workspace |
| --- | ---: | ---: |
| Phase 3B final | n/a | 4,733 ms |
| Dead hidden DOM removed | 1,843 ms | 1,369 ms |
| Route-owned idle queue | 2,720 ms | 1,581 ms |
| Packaged UI without Python Server | 5,475 ms | 2,198 ms |

The latest run used a 29.3 ms Core bootstrap, mounted Vue from 490.8 ms to
1,104.4 ms, and reported workspace ready at 1,205.0 ms in Renderer time. All
deferred tasks were scheduled only after the deferred-work release milestone.
Normal run-to-run process variation remains below both budgets.
The packaged smoke intentionally omitted `resources/server/server.exe`; the
expected backend activation failure did not delay or prevent workspace render.

## Verification

The following checks passed:

- UTF-8, Python docstring, and TypeScript function-documentation checks;
- deterministic precompiled Renderer artifact check;
- deferred startup scheduler regression test;
- development Electron cold-start report and screenshot inspection;
- interactive first-entry checks for Chat, VRM, Toolkit, System, Task Center,
  AI Browser, Model Configuration, and Knowledge Base;
- the full Desktop Core, worker, feature-pack, and kernel regression suites.

The next Phase 3 boundary is state ownership rather than startup timing:
authentication, file metadata, and task persistence should move into typed
Desktop Core contracts before more UI code is migrated.
