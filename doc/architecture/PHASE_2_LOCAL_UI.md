# Phase 2: Local UI Boot

## Status

Implemented on 2026-07-22.

## Outcome

Electron now serves the desktop interface through a loopback Local UI Gateway. Python starts as a background capability and no longer owns the main workspace URL.

The Gateway provides:

- static UI delivery from a dedicated shared resource directory;
- safe path resolution and directory traversal protection;
- Host header validation on a loopback-only listener;
- MIME, HEAD, and byte-range support;
- streaming HTTP and SSE proxying to the legacy backend;
- WebSocket tunneling to the legacy backend;
- bounded waiting while the backend capability starts;
- structured proxy and readiness errors.

## Shared Static Resource

Production packaging places the complete UI at `resources/ui`. Electron serves this directory directly and passes the same absolute path to Python through `OPENXNET_STATIC_DIR`. PyInstaller no longer embeds a second complete copy of `static`.

Source development continues to use the repository `static` directory.

## Optional Browser Runtimes

The initial HTML no longer synchronously parses optional heavyweight libraries. `static/js/runtime-loader.js` loads the following runtimes on first use:

- ONNX Runtime and VAD for voice activation;
- ExcelJS for spreadsheet export;
- Mermaid for diagram previews;
- MathJax for messages containing math notation;
- QRCode for QR surfaces;
- Driver.js for onboarding tours.

## Readiness Contract

Vue reports `workspace-renderer-ready` through the allow-listed preload API after mounting. Electron reveals the main window on this event instead of waiting for the complete browser `load` event or Python health readiness.

## Measured Baseline

On the development workstation after implementation:

- Vue Renderer hydration: approximately 8.3 seconds;
- full page load: approximately 8.7 seconds;
- Python backend ready: approximately 12.3 seconds.

These are warm filesystem-cache development measurements and are not release guarantees. Before this phase, the same workflow observed approximately 44 seconds for the page and 67 seconds for Python on a colder run.

## Next Extraction Order

1. Vector index worker, because FAISS, SciPy, Transformers, NumPy, and embedding runtimes form a coherent heavy dependency set.
2. Document worker for PDF, Word, Excel, PowerPoint, and media conversion.
3. Connector pack for optional third-party platform SDKs.

GitNexus extraction was completed in `PHASE_4_GITNEXUS_FEATURE_PACK.md`.
Local Sherpa ASR extraction was completed in `PHASE_4_VOICE_WORKER.md`.
