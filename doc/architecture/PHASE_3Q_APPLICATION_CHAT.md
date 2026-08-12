# Phase 3Q Typed Desktop Chat

## Status

Phase 3Q removes normal Desktop Chat traffic from the Local UI Gateway and the
`legacy-backend` lifecycle. Renderer Chat commands now use the typed
`window.openxnetDesktop` preload API. Electron Main acquires request leases from
the independently supervised `execution-engine`, and the engine owns the
credential-bearing provider and tool adapters.

Browser and Server profiles retain their existing HTTP routes. The Renderer
compatibility shim selects typed IPC only when the isolated Desktop preload is
present, so one UI source continues to support both runtime profiles.

## Request Flow

```text
Renderer Chat UI
    |
    +--> window.openxnetChatFetch Response-compatible adapter
            |
            +--> typed window.openxnetDesktop Chat API
                    |
                    +--> authorized Electron IPC
                            |
                            +--> ApplicationChatService
                                    |
                                    +--> ExecutionEngineSupervisor lease
                                            |
                                            +--> private bearer HTTP
                                                    |
                                                    +--> ChatEngineApi
```

The Renderer creates the stream ID and subscribes before starting the request.
Main forwards ordered events with a sequence number. Raw response chunks cross
IPC as bounded Base64 values, preventing a Node chunk boundary from splitting a
UTF-8 code point. The Renderer reconstructs a native `ReadableStream` and
`Response`, so the existing SSE consumers do not depend on Electron details.

## Typed Surface

The preload contract exposes streaming and non-stream Chat completion, simple
Chat completion, model listing, cancellation, manual tool execution, approval
resolution, and ordered stream event subscription.

Main validates exact top-level request fields, bounded identifiers, a 2 MiB
request and response budget, and 64 KiB stream event chunks. The private engine
origin, process bearer, provider credentials, and raw internal errors never
enter Renderer state, Core SQLite, or stream events.

## Engine Boundary

The execution profile adds these authenticated exact POST routes:

- `/v1/chat/completions`;
- `/simple_chat`;
- `/v1/chat/abort`;
- `/v1/models`;
- `/execute_tool_manually`;
- `/v1/chat/tools/approval`.

`py.chat_engine_api` owns strict Pydantic request models and injected runtime
adapters. The compatibility `/execute_tool_manually` route and private Engine
route share one pure payload handler. Approval resolution uses a narrow adapter
bound to the configured workspace. Unknown routes, queries, hosts, methods, and
bearer credentials remain rejected by the Phase 3P profile boundary.

## Lifecycle

The `chat` capability now depends on `execution-engine`, not `legacy-backend`.
Its lightweight activator reports the typed IPC transport as ready before the
service acquires the request lease, keeping Core snapshots aligned with use.
Each bounded command releases its lease in `finally`. A stream retains its lease
until completion, error, cancellation, or application shutdown. Shutdown closes
active Chat streams before stopping the engine supervisor. The existing
120-second startup and five-minute idle budgets remain unchanged.

## Compatibility

`static/js/desktop-chat-transport.js` captures the native browser `fetch` and
routes only recognized Chat paths through typed IPC. All other paths, and all
Chat paths outside Electron Desktop, use native HTTP. The compatibility alias
`/v1/kernel/approvals/resolve` maps to the private approval command without
exposing the broader Kernel route graph.

## Verification

Phase 3Q coverage verifies exact Main validation and lease release, ordered
Chinese UTF-8 stream reconstruction, request/response budgets, IPC sender
authorization, six private Engine routes, browser fallback, Renderer source
isolation, real Engine process probes, UTF-8/doc comments, and packaging.

The isolated Windows verification build produced `execution-engine.exe` at
35,428,245 bytes and `task-worker.exe` at 10,542,068 bytes. The packaged Engine
reached authenticated readiness in 4.297 seconds and passed model, abort,
validation, authentication, and unknown-route probes. Existing `dist/server`
artifacts were not overwritten.

## Next Migration

Phase 3R should inventory the remaining dynamic Local UI routes and group them
by owning capability. The general backend can stop being a required Desktop
capability after every first-party Renderer workflow has either a typed Core
contract, a supervised worker, or an explicitly documented Server-only route.
