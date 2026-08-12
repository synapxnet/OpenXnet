# Phase 4: Voice Worker

> Superseded for configured voice execution by Phase 3AK. This document records
> the original Sherpa-only extraction; OpenAI/FunASR upload transcription and
> all configured TTS engines now run in Voice Worker `2.0.0`.

## Status

Local Sherpa ASR extraction implemented on 2026-07-22.

## Outcome

Sherpa model loading and inference no longer run inside the legacy FastAPI process. A dedicated Voice Worker owns:

- `sherpa_onnx` native runtime loading;
- SoundFile audio decoding;
- SenseVoice recognizer construction and caching;
- local audio artifact validation;
- CPU inference and model-memory release.

The legacy `/asr` and `/ws/asr` routes keep their existing frontend contracts. Only their `engine == "sherpa"` branches are proxied to Desktop Core. OpenAI ASR, FunASR, Web Speech, and TTS remain on their current paths until their own migration phases.

## Request Flow

```text
Renderer
  -> Local UI Gateway
  -> legacy /asr or /ws/asr
  -> VoiceWorkerClient writes a private audio artifact
  -> authenticated Worker RPC Gateway
  -> Desktop Core ensureCapability("voice")
  -> WorkerSupervisor
  -> Voice Worker
  -> Sherpa model and external ASR model directory
```

Binary audio is never embedded in the NDJSON worker protocol. The legacy adapter writes a unique file under `runtime/voice-exchange`, sends only its absolute path, and deletes it in a `finally` block after the request.

## Security Boundaries

The Core Worker RPC Gateway:

- listens on an ephemeral `127.0.0.1` port;
- requires a random per-process bearer token;
- validates the Host header;
- accepts only a fixed capability and method allow-list;
- limits JSON control bodies to 64 KiB;
- returns structured retryable errors.

The Voice Worker:

- accepts artifacts only below its configured exchange root;
- rejects missing, empty, oversized, and escaping paths;
- restricts model names to one safe path segment;
- caps audio artifacts at 64 MiB by default;
- keeps protocol stdout separate from diagnostics.

## Lifecycle

Worker startup is lazy. Lightweight application startup, Core startup, and Voice Worker `system.ping` do not import Sherpa, NumPy, or SoundFile.

The recognizer loads only on the first transcription. After five minutes without a non-system request, WorkerSupervisor gracefully stops the Voice Worker and releases its process memory. Activity during transcription cancels the idle timer.

## Packaging

Voice dependencies moved from base project requirements to the `voice` optional dependency group and `requirements-voice.txt`.

Build the independent pack with:

```powershell
npm run build:feature-pack:voice
```

The Windows x64 validation pack contained:

- 168 integrity-protected files;
- 84,263,634 payload bytes;
- a self-contained PyInstaller `voice-worker.exe`;
- Sherpa ONNX Runtime, SoundFile, libsndfile, NumPy, and Python 3.12 runtime files.

ASR model files are not embedded. They remain versionable user assets under the OpenXnet user-data `asr` directory.

The base `server.spec` excludes `sherpa_onnx` and `soundfile`. Its validated output contained 6,360 files and 804,491,139 bytes. This build is not directly comparable with the earlier baseline because other application modules and environment packages changed concurrently. The subsequent Vector Worker phase removed ONNX Runtime and persistent FAISS from the base package. The numeric-runtime follow-up replaced FunASR conversion and BM25 ranking, removing SciPy while retaining NumPy for Mem0's import-time Qdrant configuration.

## Validation

The validation pass confirmed:

- source Voice Worker status without heavyweight imports;
- artifact traversal rejection and cleanup;
- RPC authentication and method allow-list enforcement;
- full manifest hash verification and atomic installation;
- packaged Worker activation through Desktop Core;
- real SenseVoice inference from the packaged executable;
- base packaged backend health without Sherpa startup logs;
- automatic idle shutdown.

The final packaged-worker inference test with Sherpa 1.12.40 loaded the model and returned a transcription in approximately 5.6 seconds on the development workstation. This is a cold diagnostic measurement, not a release guarantee.

## Remaining Work

- Add signed Voice Pack distribution and installer UI.
- Move local and remote TTS engines behind a voice-domain contract.
- Keep remote streaming FunASR in the connector path unless local processing requirements change.
- Add streaming worker events before migrating live partial transcription.
- Add cancellation and per-request progress for long audio.
