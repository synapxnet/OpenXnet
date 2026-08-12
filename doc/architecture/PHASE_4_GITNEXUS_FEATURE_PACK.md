# Phase 4: GitNexus Feature Pack

## Status

Implemented on 2026-07-22.

## Outcome

GitNexus is no longer copied into every base desktop package. It is built as an independently versioned, platform-specific feature pack and registered as an optional Desktop Core capability.

The base application starts and remains usable when GitNexus is not installed.

## Pack Contract

Every pack contains a UTF-8 `manifest.json` using schema `openxnet.feature-pack.v1`. The manifest records:

- capability and pack version;
- Desktop Core protocol compatibility;
- supported platform and architecture;
- capability entrypoint;
- self-contained runtime executable;
- exact size and SHA-256 for every payload file.

Unknown files, missing files, symbolic links, unsafe relative paths, incompatible platforms, and hash mismatches are rejected.

## Build

Run:

```powershell
npm run build:feature-pack:gitnexus
```

The builder:

- copies only the installed npm production dependency closure;
- strips TypeScript declarations and source maps from compiled output;
- inlines `gitnexus-shared` and rewrites its runtime imports;
- copies a platform Node runtime into the pack;
- generates deterministic per-file integrity records.

Release builders should set `OPENXNET_FEATURE_PACK_NODE_RUNTIME` to a pinned and signed Node binary. Local builds default to the Node executable running the builder.

## Install Layout

Application-owned packs use this layout under the Electron user-data directory:

```text
feature-packs/
  gitnexus/
    current.json
    versions/
      1.6.2-openxnet.1.0.2/
        manifest.json
        runtime/
        dist/
        node_modules/
```

Installation copies into a random staging directory, verifies the staged copy, renames it into the immutable version directory, and atomically updates `current.json`. Selecting an older installed version provides rollback without reinstalling the base application.

## Activation

Startup performs metadata-only discovery so thousands of files are not hashed on the UI critical path. The capability remains stopped until `ensureCapability({ capabilityId: "gitnexus" })` is requested.

Activation then:

1. verifies every declared file and SHA-256;
2. writes a short-lived `runtime-capabilities/gitnexus.json` handoff;
3. marks the Desktop Core capability ready;
4. lets the Python MCP adapter start the pack's private Node runtime on first code-intelligence use.

The runtime handoff is removed on each application startup. Python does not discover the installed directory directly and cannot use an unverified pack through this path.

## Measured Pack

The Windows x64 validation build contained:

- 257 npm production package roots;
- 9,429 integrity-protected files;
- 853,811,523 payload bytes, including the private Node runtime.

The pack is intentionally still large. The architectural gain is that these files no longer affect base installer size, base packaging time, or startup when code intelligence is unused.

## Remaining Distribution Work

Public distribution still requires the Phase 5 trust layer:

- signed manifests and a base-app trust store;
- resumable download and progress reporting;
- installer UI for install, repair, remove, and rollback;
- independent update feed and retention policy.

Unsigned local packs are suitable for development and CI only.
