# Phase 5: Feature Pack Distribution

## Status

The signed Feature Pack distribution client, release tooling, lifecycle IPC,
and management UI were completed on 2026-07-23. Production distribution stays
disabled until a release feed URL and at least one application-trusted public
key are provisioned.

## Trust Model

Feature Pack distribution uses two independent detached Ed25519 signatures:

```text
catalog.json  <- exact UTF-8 bytes signed by catalog.sig
manifest.json <- exact UTF-8 bytes signed by manifest.sig
```

Both signature files use `openxnet.feature-pack.signature.v1` and contain a
stable `keyId`, the fixed `ed25519` algorithm, and a base64 signature. Public
keys come only from `static/config/feature-pack-trust.json`, which is packaged
as application-owned UI data. Downloaded content cannot add or replace trust
keys. The trust store intentionally contains no default key in source control.

Private keys are never accepted as command arguments or repository files. The
release command reads them from `OPENXNET_FEATURE_PACK_SIGNING_KEY_FILE` or
`OPENXNET_FEATURE_PACK_SIGNING_KEY_PEM` and requires
`OPENXNET_FEATURE_PACK_SIGNING_KEY_ID`.

The client persists the last accepted catalog timestamp and SHA-256 digest. An
older timestamp, or different catalog bytes with the same timestamp, is
rejected as `ROLLBACK_DETECTED`. Installing a catalog release older than any
valid locally installed version is also blocked.

## Download And Extraction Boundary

The catalog supplies the archive URL, exact byte count, and SHA-256 digest.
The client applies this sequence:

1. Require HTTPS. Plain HTTP is accepted only for explicit loopback
   development endpoints.
2. Reject URL credentials and re-check the final redirect URL.
3. Stream into an application-private staging file under both the signed size
   and configured maximum archive budget.
4. Verify exact size and SHA-256 before reading the archive.
5. Scan every tar entry without writing and reject absolute paths, `..`, dot or
   empty segments, backslashes, NUL bytes, links, special entries, excessive
   file counts, or excessive extracted bytes.
6. Extract only after the complete scan succeeds.
7. Verify `manifest.sig`, platform, architecture, desktop protocol, every
   payload size, every payload SHA-256, and the exact declared file set.
8. Copy to private version staging, verify again, atomically promote the
   version, and atomically update `current.json`.

Repair moves the existing version to a temporary backup before promotion and
restores it if validation or pointer update fails. Uninstall first stops a
registered Worker, atomically moves the capability directory out of service,
and then removes it recursively. A damaged `current.json` does not block
inventory, repair, or uninstall.

## Catalog Contract

`catalog.json` uses `openxnet.feature-pack.catalog.v1`:

```json
{
  "schema": "openxnet.feature-pack.catalog.v1",
  "generatedAt": "2026-07-23T00:00:00.000Z",
  "entries": [
    {
      "id": "voice",
      "version": "1.2.3",
      "platform": "win32",
      "architecture": "x64",
      "archiveUrl": "voice-1.2.3-win32-x64.tar.gz",
      "archiveSize": 123456,
      "archiveSha256": "...64 lower-case hex characters..."
    }
  ]
}
```

Only `voice`, `vector-index`, `memory`, `documents`, `connectors`, and
`gitnexus` may cross the management IPC boundary. The desktop chooses the
highest numeric-aware compatible release for the current platform and
architecture.

## Renderer Boundary And UI

The preload API exposes only list, install, repair, uninstall, and sanitized
progress methods. Main validates exact request fields and capability IDs. It
never accepts source directories, archive URLs, signing keys, or filesystem
paths from Renderer.

Progress events contain an operation ID, capability ID, operation, stable
phase, percentage, and byte counts. Errors are mapped to stable public codes
and messages before IPC. Local paths, feed URLs, response bodies, credentials,
and internal exception text are not published.

The Ops Vite System Settings page contains one Feature Packs tab with a dense
six-row management list. Each row shows installed and available versions,
explicit text health, restart state, one-line progress, and contextual
install/update, repair, or uninstall controls. The layout was checked at
1440x1000, 1280x720, 720x900, and 390x844 without horizontal overflow or row
overlap.

Runtime activators are still registered during application startup. Successful
mutations therefore return `restartRequired: true`; the UI does not claim that
a newly installed or removed runtime was hot-registered.

## Release Workflow

Generate and retain the release key outside the repository:

```powershell
openssl genpkey -algorithm Ed25519 -out release-private.pem
openssl pkey -in release-private.pem -pubout -out release-public.pem
```

Add only the public PEM to the packaged trust store under its stable key ID.
For every Pack directory:

```powershell
$env:OPENXNET_FEATURE_PACK_SIGNING_KEY_ID = 'release-2026'
$env:OPENXNET_FEATURE_PACK_SIGNING_KEY_FILE = 'D:\release-secrets\release-private.pem'
npm run sign:feature-pack -- dist\feature-packs\voice-1.2.3
npm run package:feature-pack -- dist\feature-packs\voice-1.2.3 dist\feed\voice-1.2.3-win32-x64.tar.gz
```

Merge generated descriptors and sign the catalog:

```powershell
npm run build:feature-pack:catalog -- dist\feed\catalog.json dist\feed
npm run sign:feature-pack -- dist\feed\catalog.json
```

Publish `catalog.json`, `catalog.sig`, and the archives to the same HTTPS
origin, then configure `OPENXNET_FEATURE_PACK_FEED_URL` with either the feed
directory URL or the full `catalog.json` URL.

## Validation

Automated coverage confirms:

- valid signed catalog and Pack installation;
- corrupted payload detection and atomic repair;
- malformed active-pointer repair and uninstall;
- invalid signature and unknown `keyId` rejection;
- signed archive hash substitution rejection;
- signed catalog replay rejection;
- tar traversal and symbolic-link rejection;
- HTTPS and credential-bearing URL policy;
- exact IPC request allow-lists and progress broadcasting;
- UTF-8, TypeScript compilation, and function documentation standards;
- zero production dependency advisories from `npm audit --omit=dev`.

## Remaining Operations Work

- Provision the production Ed25519 public key during the signed release build.
- Publish the first catalog and configure the production feed URL.
- Add opt-in CDN failover and N-1 desktop protocol fixtures after the initial
  feed is operating.
- Upgrade the build-only Electron Builder chain separately to remove its
  remaining development dependency advisories without changing release output
  in this runtime-focused phase.
- Decide whether a later Desktop Core version should support safe hot
  registration; until then restart remains an explicit contract.
