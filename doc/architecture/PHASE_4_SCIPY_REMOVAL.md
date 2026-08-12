# Phase 4: SciPy Removal and Numeric Runtime Boundary

## Status

SciPy and rank-bm25 were removed from the base backend on 2026-07-22.

## Outcome

The base backend no longer imports or packages SciPy. Three compatibility paths
were changed without altering their external HTTP or Python entry points:

- FunASR WAV conversion now uses `py.audio_pcm` instead of NumPy and SciPy;
- the legacy `py.sherpa_asr.sherpa_recognize` API delegates to Voice Worker;
- knowledge-base BM25 ranking uses a dependency-free BM25Okapi implementation.

The FunASR network protocol remains in the base backend because it connects to a
user-configured remote service and must not require installation of the local
Voice Pack. Local Sherpa model inference remains isolated in Voice Worker.

## PCM Conversion Contract

`py.audio_pcm.convert_wav_to_pcm16` accepts uncompressed integer PCM WAV input
with 8-, 16-, 24-, or 32-bit samples. It:

- validates WAV structure, channel count, sample width, and sample rate;
- converts every supported width to signed PCM16;
- averages interleaved channels to mono;
- performs deterministic endpoint-preserving linear resampling when required;
- writes little-endian PCM16 bytes expected by FunASR.

The primary renderer path already creates mono, 16 kHz, 16-bit PCM WAV files, so
that path performs no resampling and preserves sample values exactly. The
legacy server wrapper retains its previous fallback behavior for malformed or
unsupported audio.

## BM25 Contract

Knowledge-base retrieval no longer constructs LangChain `BM25Retriever` or
imports `rank_bm25`. Safe document metadata remains in `bm25_index.json`, and
`rank_bm25_documents` applies the same default BM25Okapi constants:

- `k1 = 1.5`
- `b = 0.75`
- `epsilon = 0.25`

Tokenization remains whitespace splitting to preserve the previous retriever's
default behavior. Deterministic positional tie-breaking replaces NumPy
`argsort` without changing the weighted reciprocal-rank fusion boundary.

## Dependency Decision

At the end of this phase, removing NumPy from the base package was not yet
safe. A clean import-boundary test showed this chain before application memory
configuration was evaluated:

```text
from mem0 import Memory
  -> default MemoryConfig
  -> QdrantConfig
  -> qdrant_client
  -> numpy
```

The existing Mem0 FAISS factory replacement occurs after the `mem0` package
begins importing, so it cannot prevent this dependency. Excluding NumPy in
`server.spec` would make long-term memory fail only when enabled, despite a
successful `/health` check.

NumPy therefore remained an explicit, tested base-runtime boundary until the
following Memory Worker phase. That extraction is now complete: the current
base package contains no Mem0, Qdrant Client, or NumPy runtime path. The file
named `numpy.libs/libscipy_openblas64_*.dll` in Memory Pack belongs to NumPy's
OpenBLAS runtime; it does not indicate that the SciPy package is present.

## Packaging

`pyproject.toml`, `requirements.txt`, and `uv.lock` no longer contain direct
SciPy or rank-bm25 requirements. `server.spec` excludes both names to prevent
broad third-party collection hooks from repackaging stale environment modules.

The rebuilt Windows x64 base backend contained:

- 4,204 files;
- 552,335,672 bytes;
- zero `scipy`, `scipy.libs`, or `rank_bm25` runtime paths;
- the NumPy runtime required by Mem0 and Qdrant configuration imports.

Compared with the prior 632,159,489-byte base, this phase removed 79,823,817
bytes, approximately 12.6%. Compared with the 804,491,139-byte output recorded
after the original Voice Worker extraction, the cumulative reduction is
252,155,467 bytes, approximately 31.3%.

The rebuilt Voice Pack remained stable at 168 integrity-protected payload files
and 84,263,634 payload bytes.

## Validation

The validation pass confirmed:

- four dependency-free PCM conversion tests;
- five Voice Worker and legacy Sherpa compatibility tests;
- 21 Vector, persistent-store, knowledge-base migration, and BM25 tests;
- a blocked-SciPy import test with real Mem0 `Memory.from_config` construction;
- the complete desktop architecture suite and all eight Kernel regression checks;
- rebuilt Voice Pack installation, Core activation, and dependency status;
- zero SciPy and rank-bm25 paths in the rebuilt base package;
- packaged base `/health` returning `{"status":"ok"}` in approximately 5.15 seconds.

No local SenseVoice model was present for the final Pack smoke, so it validated
the packaged dependency and activation boundary. The preceding Voice Worker
phase already recorded real packaged SenseVoice inference.

## Remaining Work

- Decide whether knowledge-base chunking still needs LangChain text splitters.
- Extract document parsing libraries and optional connector SDKs.
- Add PCM property tests for long, multichannel, 24-bit, and 32-bit fixtures.
