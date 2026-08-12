# Phase 3E: Application Artifact Ownership

## Status

Implemented on 2026-07-23. Desktop file-library metadata and native file
import/delete lifecycle are now owned by TypeScript Application Core. Stable
artifact IDs are available for the upcoming durable task model.

## Previous Risk

The legacy file library used `unique_filename` as both storage locator and
identity. Metadata lived inside the monolithic Python settings JSON, while
`/update_storage` rescanned `uploaded_files` to recreate incomplete entries.
This produced several long-term problems:

- original filenames disappeared when settings and disk diverged;
- metadata had no independent schema, revision, or stable task reference;
- the Renderer first removed rows and only then attempted physical deletion;
- native imports copied the complete file through Renderer memory before an
  HTTP upload to Python;
- missing and intentionally deleted files were indistinguishable.

## SQLite Model

`desktop-core.db` schema version 2 adds `application_artifacts`. Each row owns:

- a stable UUID artifact ID and independent revision;
- the private compatibility storage filename and original display filename;
- document, image, or video classification and MIME type;
- byte size and optional SHA-256;
- available, missing, or deleted lifecycle state;
- created, updated, and deleted timestamps.

Deletion retains a tombstone instead of reusing identity. Future tasks can
therefore report that an input was deleted rather than resolving the same ID to
different bytes. Existing UUID storage stems remain the artifact ID during
migration; non-UUID legacy files receive a new UUID once and retain it.

Legacy files are not hashed during discovery because a large library must not
delay startup or first navigation more than necessary. New native imports and
compatibility upload registrations receive SHA-256 values. Derived hashes for
older files can be added later as an idle maintenance operation.

## Lazy Migration

Creating the artifact service only opens the migration-managed database and
ensures the application artifact directory exists. It does not scan files.
The first artifact-list operation lazily reconciles:

1. legacy Python SQLite settings;
2. the former `settings.json` compatibility file;
3. supported regular files under `uploaded_files`.

Metadata found without a file becomes `missing`. Files found without metadata
are imported with their storage filename as the display fallback. Symbolic
links, nested paths, unsupported extensions, and unrelated VR/audio/workflow
assets are excluded from the file-library domain.

## IPC And File Security

The typed preload exposes four operations:

- `listArtifacts({ includeUnavailable? })`;
- `importArtifacts({ paths })`;
- `registerArtifacts({ files })`;
- `deleteArtifacts({ artifactIds })`.

Electron Main authorizes every call against the primary workspace. Native
imports additionally require every source path to match an exact path returned
by an Electron Open dialog. Core accepts regular allow-listed files only,
rejects symbolic links, limits batches to 256 entries and individual imports to
2 GiB, generates the destination filename, and never exposes an arbitrary local
path to Renderer.

Compatibility registration accepts only bounded basenames already contained by
the application artifact directory. Deletion resolves the physical path from
Core metadata, removes the binary first, and records a tombstone only after the
filesystem operation succeeds or the file is already absent. Mutations are
serialized so import, registration, deletion, and reconciliation cannot reorder
each other.

## Renderer Migration

The primary Renderer now loads storage lanes from Core and maps artifacts into
the former card shape only at the presentation boundary. On Electron, native
file selection goes directly from the authorized dialog to Core without
materializing the complete file in Renderer memory or calling Python. Storage
deletion uses stable artifact IDs and refreshes all lanes from the returned
snapshot.

Browser drag/drop and feature flows that still upload through `/load_file`
remain compatible. After an HTTP upload succeeds, the Renderer immediately
registers the resulting application-owned storage files with Core. Desktop
settings saves no longer include `textFiles`, `imageFiles`, or `videoFiles`, so
Python is no longer a second metadata writer. Browser-only mode preserves those
fields until it gains an equivalent non-Electron storage client.

The alternate UI-plan workspace replaces its sample storage rows with the same
Core catalog when the storage route opens.

## Verification

Automated coverage includes:

- schema version 1 to version 2 upgrade without document loss;
- lazy legacy settings and directory reconciliation;
- stable legacy UUID identity and missing-file state;
- native copy, SHA-256, compatibility registration, and deletion tombstones;
- traversal rejection and authorized native path enforcement;
- exact sender-authorized IPC cleanup;
- source contracts for both Renderer entries and the preload bridge.

Desktop Core passes 46 tests after this phase.

An isolated development smoke completed with a 1,310 ms workspace and 1,742 ms
process startup. A Windows unpacked build without the Python server resource
rendered the workspace and created schema version 2 successfully. Its immediate
repeat completed in 1,196 ms workspace / 1,521 ms process time. The first launch
directly after packaging recorded a 3,551 ms workspace outlier while Windows
populated executable and antivirus caches; this exceeds the 3,000 ms workspace
budget and remains visible as a cold-install measurement rather than being
discarded.

## Remaining Boundary

The compatibility `/load_file`, `/delete_file`, `/delete_files`, and
`/update_storage` FastAPI routes remain for browser-only clients and older
feature flows. The Electron storage workspace no longer depends on them for
native import, catalog reads, or deletion. Retiring the routes completely
requires moving the remaining chat, avatar, and knowledge-base binary upload
transport; metadata ownership does not wait for that transport migration.

Phase 3F should move durable task records into Core. Task inputs and outputs can
now reference artifact IDs instead of mutable URLs or storage filenames.
