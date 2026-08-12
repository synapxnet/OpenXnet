# Phase 4: Document Worker Extraction

## Status

Office document parsing moved out of the base backend on 2026-07-22.

## Outcome

The `py.load_files.handle_office_document` compatibility entrypoint now sends
document bytes to an optional Document Worker. URL download, SSRF controls,
uploaded-file access, ordinary text decoding, and the existing
`get_file_content` error-string contract remain in the base backend.

Document Worker supports:

- PDF through maintained `pypdf`;
- DOCX through python-docx;
- XLSX/XLSM through OpenPyXL and legacy XLS through xlrd;
- RTF through striprtf;
- ODT through odfpy;
- PPTX through python-pptx;
- EPUB through bounded standard-library ZIP and XML parsing;
- legacy DOC and PPT through Microsoft Office COM on Windows.

The deprecated `PyPDF2` dependency was replaced by `pypdf 6.14.2`. Windows
`pywin32` remains a base dependency because other desktop automation features
still use it; Document Pack also carries the COM runtime required for legacy
Office formats.

## Request Flow

```text
chat attachment or file tool
  -> base backend downloads or reads the file
  -> handle_office_document compatibility entrypoint
  -> DocumentWorkerClient
  -> private input and result artifacts
  -> authenticated Worker RPC Gateway
  -> Desktop Core ensureCapability("documents")
  -> WorkerSupervisor
  -> Document Worker
  -> format-specific DocumentEngine parser
```

The legacy caller still receives one string. Parser failures continue to be
converted by `get_file_content` into the existing `文件解析错误: ...` result.
Plain-text and source-code attachments never activate Document Worker.

## Artifact Contract

The allow-listed methods are:

- `documents.status`
- `documents.extract`

Binary input and extracted text do not cross the JSON protocol. The client
creates a private format-suffixed input artifact and an empty result artifact
below `OPENXNET_DOCUMENT_EXCHANGE_DIR`. RPC carries only those paths and an
allow-listed format. The Worker writes UTF-8 text, returns byte/character
metadata, and the client validates both path and exact byte count before
reading. Both artifacts are removed in a `finally` block.

The Worker enforces:

- a fixed exchange root with path traversal rejection;
- regular-file checks for input and pre-created result artifacts;
- a 64 MiB input limit and 32 MiB UTF-8 result limit;
- platform-aware format allow-lists;
- EPUB member traversal rejection;
- at most 10,000 EPUB entries and 512 MiB total uncompressed EPUB content;
- protocol stdout separation from parser diagnostics.

## Dependency Boundary

The document libraries moved from base dependencies to the `documents`
optional group and `requirements-documents.txt`. `server.spec` explicitly
excludes `pypdf`, legacy `PyPDF2`, `docx`, `openpyxl`, `xlrd`, `striprtf`,
`odf`, and `pptx` so broad collection hooks cannot pull them back into the
base package.

Document Pack is independently built with:

```powershell
npm run build:feature-pack:documents
```

The final Windows x64 Pack contains:

- 206 integrity-protected payload files;
- 68,882,204 payload bytes;
- all ten declared format handlers available;
- zero NumPy, SciPy, FAISS, ONNX Runtime, Tokenizers, Transformers, Torch,
  Mem0, Qdrant, Sherpa, SoundFile, OpenAI, or LangChain runtime paths.

Pillow and lxml remain in Document Pack because PPTX and Open XML processing
need them. Cryptography remains for encrypted PDF support.

## Base Package Result

The rebuilt Windows x64 base backend contains:

- 3,515 files;
- 517,595,992 bytes;
- zero paths for all eight excluded document parser module families;
- zero Mem0, Qdrant Client, NumPy, FAISS, SciPy, ONNX Runtime, or Tokenizers
  paths retained from earlier extraction phases.

Compared with the Memory Worker base of 521,212,456 bytes, this phase removed
3,616,464 bytes, approximately 0.7%. Compared with the 804,491,139-byte output
recorded after the original Voice Worker extraction, the cumulative reduction
is 286,895,147 bytes, approximately 35.7%.

The modest size reduction reflects that most parser Python modules were
compressed inside the prior PYZ archive. The larger architectural benefit is
optional installation, independent upgrades, a bounded parsing process, and
no parser SDK lifecycle in the base backend.

## Validation

The final validation confirmed:

- nine Document handler, compatibility-client, artifact, and parser tests in
  the locked project environment;
- generated source-level PDF, DOCX, XLSX, ODT, PPTX, RTF, and EPUB extraction;
- Pack manifest installation and packaged RTF extraction through Desktop Core;
- direct packaged-worker extraction for all seven portable generated formats;
- path traversal rejection, result metadata validation, and artifact cleanup;
- all 15 Desktop Core tests and all eight Kernel regression checks;
- UTF-8 and Python/TypeScript function documentation standards;
- rebuilt base `/health` returning `{"status":"ok"}` in approximately 6.54
  seconds.

Legacy XLS extraction is covered by the xlrd dependency contract but was not
generated in the packaged smoke because no XLS writer is part of the product.
Legacy DOC/PPT require an installed Microsoft Office application and remain
platform-gated.

## Remaining Work

- Remove the now-unreferenced in-process parser implementations from
  `py.load_files` after one compatibility release.
- Add malicious and highly compressed fixtures for every ZIP-based Office
  format, not only EPUB.
- Add signed Document Pack distribution, repair/removal UI, progress, and
  cancellation.
- Extract optional connector and provider SDKs from the base backend.
