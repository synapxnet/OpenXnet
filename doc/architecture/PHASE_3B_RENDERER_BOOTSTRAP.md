# Phase 3B: Renderer Bootstrap

## Status

Implemented on 2026-07-23. The first interactive workspace no longer performs
browser-side compilation of the 24,000-line legacy Vue template and no longer
waits for Python health or settings WebSocket state.

## Measured Cause

Phase 3A isolated smoke runs took approximately 34.8 seconds with the development
backend and 32.8 seconds in a packaged build with no Python Server. This ruled
out Python startup as the primary first-frame bottleneck.

The legacy startup inputs were:

| Asset | Approximate size |
| --- | ---: |
| `static/index.html` | 1.42 MB |
| `static/js/vue_methods.js` | 1.42 MB |
| `static/js/vue_data.js` | 142 KB |
| Eager Vite and 3D JavaScript | 1.45 MB |

Vue's full browser build parsed, repaired, and compiled the entire HTML template
on every launch. It also mounted all hidden Vite applications before the home
surface became ready.

## Precompiled Render Pipeline

`scripts/build_renderer_bootstrap.cjs` now performs a deterministic build:

1. Parse `static/index.html` with the HTML5 parsing algorithm so malformed legacy
   nesting is normalized exactly once at build time.
2. Serialize the corrected `#app` template.
3. Compile it with Vue Compiler DOM 3.5.22 using prefixed identifiers, static
   hoisting, and cached handlers.
4. Generate `static/js/openxnet-render.js` with the template SHA-256.
5. Generate `static/index.precompiled.html` with an empty `#app` root and load the
   render function immediately after Vue.

Electron loads the 31.6 KB precompiled HTML. The original HTML remains the
reviewable template and browser compatibility fallback. `npm run
check:renderer-bootstrap` fails when either committed artifact is stale.

All desktop start and package commands run `build:desktop`, which builds both
TypeScript Core and the Renderer artifacts.

## Core Bootstrap Snapshot

The preload now exposes one read-only `getBootstrapSnapshot()` operation. Its
sender-authorized Main handler returns:

- application version, platform, architecture, locale, and packaging state;
- Desktop Core capability snapshot;
- Core-owned system settings revision and value;
- bounded runtime settings.

`startup-bootstrap.js` requests this non-secret snapshot from the document head,
applies the Core theme before Vue mounts, and caches the promise for the legacy
Renderer. The Renderer consumes that snapshot before falling back to the older
individual Core request.

## Lazy Surface Loading

These Vite applications now load on first menu activation:

- Chat;
- Role;
- Model;
- Toolkit;
- Skills;
- Browser;
- Ops for task, system, storage, and VRM surfaces.

Ops mounts only the currently visible root. Previously visited roots remain
mounted for fast return navigation. Enterprise 3D now loads only when the
sandbox view initializes.

Interactive browser verification switched through every migrated menu. All
seven applications mounted on demand. Only the visited task and system Ops
roots mounted; enterprise, storage, deploy, and VRM remained unmounted.

## Startup Budget

Setting `OPENXNET_STARTUP_REPORT` writes `openxnet.startup-report.v1` with Main
and Renderer timings. The report contains bounded, non-secret milestones only:

- Core bootstrap ready;
- Vue runtime ready;
- legacy state scripts ready;
- Vue mount start and completion;
- workspace ready;
- DOM and window load completion.

Phase 3C later split this gate into a default 10-second process budget and a
3-second workspace budget. Core bootstrap presence, precompiled render use, and
milestone ordering remain mandatory.

The final isolated development smoke measured:

| Milestone | Elapsed |
| --- | ---: |
| Core bootstrap | 25.5 ms |
| Vue mount start | 486.3 ms |
| Vue mount complete | 2,101.8 ms |
| Workspace ready | 4,071.1 ms |
| Main workspace hydration | 4,733 ms |

The workspace rendered before the Python backend health check completed. This is
an approximately 86% reduction from the 34.8-second development baseline.

The packaged UI smoke intentionally omitted Python Server. It rendered the same
workspace with 4,382 ms workspace hydration and 7,954 ms total process time, so
both packaged measurements passed the 10-second budget.

## Remaining Work

This boundary was completed in Phase 3C. Unreachable hidden pages no longer
mount, service probes use route-owned idle initialization, and the measured
workspace is below the three-second target. See
`PHASE_3C_ROUTE_OWNED_INITIALIZATION.md`.
