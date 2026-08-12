# Phase 4: Memory Worker Extraction

## Status

Mem0 orchestration moved out of the base backend on 2026-07-22.

## Outcome

The base backend no longer imports or packages Mem0, Qdrant Client, or NumPy.
Long-term memory keeps the existing chat behavior through a synchronous
compatibility client while the heavy orchestration runs in an optional Memory
Worker.

The Worker owns:

- lazy `Memory.from_config` construction;
- OpenAI-compatible embedding and LLM clients used by Mem0;
- Mem0 search and add orchestration;
- Qdrant Client, NumPy, and gRPC imports required by Mem0 defaults;
- bounded in-process caching of up to 16 configured memory instances;
- per-memory SQLite history below application user data.

Persistent vectors remain owned by Vector Worker. Memory Worker registers the
existing `VectorWorkerStore`, which calls the authenticated loopback Worker RPC
Gateway and delegates FAISS operations to `vector-index`.

## Request Flow

```text
chat stream or complete response
  -> MemoryWorkerClient compatibility adapter
  -> authenticated loopback Worker RPC Gateway
  -> Desktop Core ensureCapability("memory")
  -> Desktop Core ensureCapability("vector-index")
  -> Memory Worker: Mem0 search/add
  -> VectorWorkerStore
  -> authenticated loopback Worker RPC Gateway
  -> Vector Worker: persistent FAISS
```

The Node gateway and WorkerSupervisor process concurrent requests, so the
nested Vector Worker call does not block Memory Worker's pending stdio
response. The gateway starts before Pack registration and publishes its
ephemeral origin and bearer token only in the Memory Worker and legacy backend
launch environments. Other optional workers do not inherit that credential.

## RPC Contract

The allow-listed Memory methods are:

- `memory.status`
- `memory.search`
- `memory.add`
- `memory.release`

`MemoryWorkerClient` preserves the old synchronous `search` and `add` call
shapes used by both streaming and complete chat paths. Existing callers still
run those methods in background threads and retain their current error
fallbacks. A missing or failed optional Memory Pack therefore does not prevent
chat completion.

The gateway body limit is 1 MiB. Worker validation additionally limits search
queries to 256 KiB, serialized messages to 512 KiB, metadata to 64 KiB, result
limits to 100, model names to 512 characters, and embedding dimensions to
8,192.

## Storage And Security

The RPC configuration contains no caller-selected filesystem path. It carries
only `memoryId`, OpenAI-compatible provider settings, and embedding dimensions.
Memory Worker resolves storage as:

```text
OPENXNET_USER_DATA_DIR/memory_cache/<memoryId>/
```

Traversal outside that root is rejected. The Worker creates `history.db` in
the same per-memory directory instead of accepting Mem0's default home-folder
path. Existing FAISS and safe JSON metadata remain in place under that root.

API keys cross only the bearer-authenticated loopback request and private
worker stdin. They are not returned by status, success payloads, manifests, or
logs. Mem0 telemetry is disabled for this runtime. Host validation, timing-safe
bearer comparison, fixed method allow-lists, and structured errors remain
enforced by the shared gateway.

## Dependency Boundary

`mem0ai==1.0.0` moved from base dependencies to the `memory` optional group and
`requirements-memory.txt`. `server.spec` now excludes `mem0`, `qdrant_client`,
and `numpy`.

The Memory Pack retains Qdrant Client, NumPy, and gRPC even though persistent
storage uses Vector Worker. Mem0 constructs its default Qdrant configuration
before the custom FAISS provider is fully selected, and Qdrant Client imports
those runtimes at module load. Removing them makes packaged memory fail only
when first enabled.

The Pack uses provider-specific hidden imports for the OpenAI embedder, OpenAI
LLM, FAISS configuration, and Qdrant default configuration. It does not use
`collect_submodules("mem0")`, which initially pulled unrelated provider SDKs.
That change reduced the Pack from 4,075 files and 272,630,420 bytes to:

- 1,450 integrity-protected payload files;
- 104,099,611 payload bytes;
- zero FAISS, ONNX Runtime, Tokenizers, Transformers, Torch, Sherpa, SoundFile,
  Google API Client, Botocore, or Selenium runtime paths.

The `numpy.libs/libscipy_openblas64_*.dll` file belongs to NumPy and is not the
SciPy package.

## Base Package Result

The rebuilt Windows x64 base backend contains:

- 3,547 files;
- 521,212,456 bytes;
- zero Mem0, Qdrant Client, NumPy, FAISS, SciPy, rank-bm25, ONNX Runtime, or
  Tokenizers runtime paths.

Compared with the SciPy-removal base of 552,335,672 bytes, this phase removed
31,123,216 bytes, approximately 5.6%. Compared with the 804,491,139-byte output
recorded after the original Voice Worker extraction, the cumulative reduction
is 283,278,683 bytes, approximately 35.2%.

## Validation

The final validation confirmed:

- four Memory Worker handler and compatibility-client tests under system Python
  and the locked project environment;
- path traversal rejection, bounded payloads, cache reuse, and fixed history DB
  placement;
- source UTF-8 and Python/TypeScript function documentation standards;
- all 15 Desktop Core tests and all eight Kernel regression checks;
- 21 Vector tests, including real persistent FAISS coverage;
- manifest verification, Pack installation, dependency activation, and packaged
  Worker RPC;
- packaged real `Memory.from_config`, offline OpenAI-compatible embedding,
  empty-index search, cache release, and history database creation;
- rebuilt base `/health` returning `{"status":"ok"}` in approximately 5.26
  seconds.

## Remaining Work

- Add independent Memory Pack distribution, repair/removal UI, progress, and
  signing.
- Add an end-to-end add/search test against a deterministic local LLM fixture.
- Migrate legacy shared Mem0 history only if product behavior requires its audit
  records; vector memories remain compatible in place.
- Extract optional connector/provider SDKs from the base backend.
