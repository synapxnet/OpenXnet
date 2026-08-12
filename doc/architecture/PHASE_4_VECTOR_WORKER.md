# Phase 4: Vector Worker

## Status

Local MiniLM inference, Kernel ephemeral indexing, and all persistent FAISS
ownership were extracted from the base backend on 2026-07-22.

## Outcome

The legacy FastAPI process no longer imports FAISS or owns an in-process FAISS
index. A dedicated Vector Worker now owns:

- ONNX Runtime session creation and CPU MiniLM inference;
- native `tokenizers` processing from the downloaded `tokenizer.json`;
- NumPy pooling and normalized 384-dimensional embeddings;
- the Kernel process-local FAISS `IndexFlatIP`;
- persistent FAISS build, append, search, positional delete, inspect, and delete;
- model and ephemeral-index memory release.

The legacy `/minilm/embeddings` and `/minilm/reload` routes preserve their HTTP
paths and OpenAI-compatible response shape. Kernel callers retain the existing
`VectorIndex` API. Memory-management routes and knowledge-base callers use
compatibility adapters, so this extraction does not require a renderer or
settings migration.

External embedding-provider behavior is unchanged. Knowledge bases still
obtain embeddings from their configured OpenAI-compatible endpoint; only FAISS
storage and search execute in the Vector Worker.

## Request Flow

```text
Kernel, Mem0, or knowledge base
  -> legacy Python compatibility adapter
  -> private UTF-8 JSON or little-endian float32 artifact
  -> authenticated Worker RPC Gateway
  -> Desktop Core ensureCapability("vector-index")
  -> WorkerSupervisor
  -> Vector Worker
  -> ephemeral memory index or persistent user-data .faiss file
```

Embedding text batches and rebuild inputs use private UTF-8 JSON artifacts.
Persistent vector matrices use row-major little-endian float32 artifacts rather
than JSON or Base64. The client sends only bounded control metadata and removes
every temporary artifact in a `finally` block.

## Persistent Storage Contracts

The Worker protocol exposes these allow-listed methods:

- `vector.store.build`
- `vector.store.append`
- `vector.store.search`
- `vector.store.delete-position`
- `vector.store.inspect`
- `vector.store.delete`

Every persistent index path must use the `.faiss` extension and resolve below
the Electron-provided `OPENXNET_USER_DATA_DIR`. Index writes use a sibling
temporary file followed by `os.replace`, and Worker operations are serialized
to prevent concurrent mutation of a file.

Mem0 continues to validate the existing `provider: "faiss"` configuration.
Before `Memory.from_config`, the compatibility registration redirects that
provider to `VectorWorkerStore`. The adapter preserves Mem0's insert, search,
delete, update, get, list, and reset contracts while storing payload and
position metadata as atomic UTF-8 JSON in `agent-party.records.json`.

Existing `agent-party.pkl` metadata is migrated once through a restricted
unpickler that rejects every global class reference. The legacy `.faiss` file
is retained in place and becomes Worker-owned.

Knowledge bases now store positional document metadata in `index.docs.json`.
Existing installations migrate from `bm25_index.json` when available, or from
LangChain `index.pkl` through a strict whitelist limited to
`InMemoryDocstore` and `Document`. Retrieval combines BM25 and Worker vector
rankings with deterministic weighted reciprocal-rank fusion instead of
LangChain `FAISS` and `EnsembleRetriever`.

## Security Boundaries

The shared Worker RPC Gateway retains loopback binding, per-process bearer
authentication, Host validation, body limits, and a fixed method allow-list.
The Vector Worker additionally:

- resolves JSON and float32 artifacts below its configured exchange root;
- resolves persistent `.faiss` paths below its configured storage root;
- validates exact artifact byte counts, vector dimensions, limits, and finite values;
- rejects missing, empty, oversized, malformed, and escaping artifacts;
- limits embedding requests to 2,048 texts and persistent matrices to 100,000 rows;
- reads model files only from the configured external model root;
- keeps protocol stdout separate from diagnostics.

Legacy pickle migration never uses unrestricted `pickle.load`. New metadata is
safe UTF-8 JSON written through sibling temporary files and atomic replacement.

## Lifecycle

Electron discovers an installed Vector Pack, or registers the source worker in
development, without starting it. `system.ping` and `vector.status` do not
import FAISS, NumPy, ONNX Runtime, or Tokenizers.

Kernel bootstrap no longer schedules model loading or index construction. The
first real Kernel query schedules a background build and immediately uses
keyword fallback. Persistent memory and knowledge-base operations activate the
same capability only when storage or search is requested.

After five minutes without a non-system request, WorkerSupervisor stops the
Worker. Persistent indexes survive process restarts. The Kernel adapter retains
its small symbol text set and automatically rebuilds the ephemeral index when a
restarted Worker reports no in-memory index.

## Tokenizer Simplification

The previous implementation used Transformers only to load `tokenizer.json`.
The Worker now uses the lower-level `tokenizers` runtime directly and applies
dynamic padding, 512-token truncation, special-token processing, attention
masks, and token-type IDs.

Large index rebuilds run inference in bounded batches of 128 texts before one
atomic FAISS replacement, preventing tokenizer and ONNX memory use from scaling
as one unbounded batch.

Parity was checked against `PreTrainedTokenizerFast` using the official
multilingual MiniLM tokenizer. Removing Transformers reduced the validated Pack
from 5,225 files and 331,860,289 bytes to 134 files and approximately 172.7 MB.

## Packaging

Vector dependencies are declared only in the `vector` optional dependency group
and `requirements-vector.txt`. The base `requirements.txt` no longer declares
FAISS, and `server.spec` explicitly excludes FAISS, ONNX Runtime, Tokenizers,
and Transformers.

Build the independent pack with:

```powershell
npm run build:feature-pack:vector
```

The final Windows x64 manifest contained:

- 134 integrity-protected payload files;
- 172,678,404 payload bytes;
- a self-contained PyInstaller `vector-worker.exe`;
- FAISS, ONNX Runtime, Tokenizers, NumPy, and Python 3.12 runtime files.

The 235,166,264-byte ONNX model and 9,081,518-byte tokenizer are not embedded.
They remain independently downloadable user assets under the OpenXnet
user-data `ebd` directory.

The final rebuilt base backend contained 4,300 files and 632,159,489 bytes. It
contained no FAISS, `faiss_cpu.libs`, ONNX Runtime, Tokenizers, or Transformers
runtime path. Compared with the prior 707,029,135-byte base, persistent FAISS
extraction removed 74,869,646 bytes, approximately 10.6%. Compared with the
804,491,139-byte output recorded after the Voice Worker phase, the cumulative
reduction is 172,331,650 bytes, approximately 21.4%.

SciPy was subsequently removed by replacing FunASR PCM conversion and BM25
ranking with dependency-free implementations. The following Memory Worker
phase moved Mem0, its default Qdrant configuration, and NumPy out of the base
backend while retaining Vector Worker ownership of persistent FAISS.

## Validation

The validation pass confirmed:

- 20 Vector tests under the locked `.venv`, including real FAISS persistence;
- real Mem0 `Memory.from_config` construction through `VectorWorkerStore` without loading FAISS;
- restricted migration of real LangChain `index.pkl` classes;
- binary artifact validation, traversal rejection, and cleanup;
- memory metadata persistence, filtering, update, and positional deletion;
- source UTF-8 and Python/TypeScript function documentation standards;
- the complete desktop architecture suite and all eight Kernel regression checks;
- manifest verification, Pack installation, Core activation, and packaged Worker RPC;
- packaged persistent build, search, inspect, and delete with an exact first match;
- a rebuilt base backend returning `{"status":"ok"}` from `/health` in approximately 5.24 seconds.

The current machine had no downloaded MiniLM model at final Pack smoke time, so
that smoke validated packaged dependencies and persistent FAISS but reported
`modelAvailable: false`. The preceding extraction validation used the official
model assets and returned a real 384-dimensional packaged-worker embedding.

## Remaining Work

- Extract document parsing dependencies from the base backend.
- Extract connector and provider SDKs that are not required at application boot.
- Add signed Vector Pack distribution, repair/removal UI, progress, and cancellation.
- Add multi-file generation manifests if crash-consistent index/metadata transactions become necessary.
- Add persisted ephemeral-index snapshots only if rebuild latency becomes material.
