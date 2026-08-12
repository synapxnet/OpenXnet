# Phase 4: Google REST Client Removal

## Status

Google API Python Client and LangChain Google Community were removed from the
base backend on 2026-07-23.

## Outcome

The two Google-backed features keep their existing application entrypoints but
no longer require either Google client SDK:

- `YouTubeDMClient` calls YouTube Data API v3 directly for live-chat discovery
  and message polling;
- `Google_search` calls Google Custom Search JSON API directly and preserves
  its formatted JSON text result.

This is a dependency cleanup inside the base backend. Message-platform
connectors remain unchanged because their inbound event, callback, and behavior
engine lifecycles need a separate extraction phase.

## REST Contracts

YouTube uses the following allow-listed resources:

- `GET /youtube/v3/videos` with `liveStreamingDetails`;
- `GET /youtube/v3/liveChat/messages` with `snippet,authorDetails`;
- `nextPageToken` for subsequent polling pages.

The callback still receives the legacy fields `id`, `type`, `content`,
`danmu_type`, and `platform`. Polling remains non-blocking and uses the existing
`start()` and `stop()` lifecycle.

Google Custom Search uses:

- `GET https://www.googleapis.com/customsearch/v1`;
- at most 10 results per request and 100 results per search;
- the existing `title`, `link`, and `snippet` result fields.

Both clients enforce request timeouts and validate top-level JSON structures.
Transport failures expose only a bounded status description and never include
the API key. No default API key or CSE identifier is stored in source.

## Dependency Boundary

The base dependency graph no longer contains:

- `google-api-python-client`;
- `langchain-google-community`;
- `google-auth-httplib2`;
- `google-cloud-core` and `google-cloud-modelarmor` pulled by the removed
  LangChain integration;
- `httplib2`, `pyparsing`, and `uritemplate` pulled by those SDKs.

`server.spec` explicitly excludes `googleapiclient` and
`langchain_google_community` so optional imports in `langchain_community`
cannot restore them during broad PyInstaller analysis. `google-api-core` and
`google-auth` remain because other base dependencies still require them; they
are not the removed Google API Python Client.

The corresponding stale rows were removed from
`LICENSE-third-party/py_licenses.csv`. The lock file resolves 375 packages and
passes `uv lock --check`.

## Base Package Result

The rebuilt Windows x64 base backend contains:

- 2,925 files;
- 420,653,393 bytes;
- zero paths matching `googleapiclient` or
  `langchain_google_community`;
- a 49,063,937-byte `server.exe` entrypoint.

Compared with the Document Worker base of 3,515 files and 517,595,992 bytes,
this phase removed 590 files and 96,942,599 bytes, approximately 92.45 MiB or
18.7%. Compared with the 804,491,139-byte output recorded after the original
Voice Worker extraction, the cumulative reduction is 383,837,746 bytes,
approximately 47.7%.

## Validation

The final validation confirmed:

- five direct REST tests for URL parameters, pagination, normalization, legacy
  JSON output, and credential-safe errors;
- UTF-8 and Python/TypeScript function documentation standards;
- all 15 Desktop Core tests and all Worker and feature-pack test suites;
- all eight Kernel regression checks;
- project dependency lock consistency;
- packaged directory and PyInstaller analysis audits;
- production-contract startup with `OPENXNET_STATIC_DIR` supplied by Electron;
- rebuilt base `/health` returning `{"status":"ok"}` in approximately 4.64
  seconds on the validation workstation.

The backend intentionally does not embed the approximately 95 MiB `static`
directory. Phase 2 packages that directory once at `resources/ui`; Electron's
Local UI Gateway serves it and passes its absolute path to Python.

## Rollback And Remaining Work

Rollback is limited to restoring the two SDK-backed adapters and the two direct
dependencies. No persisted data or protocol migration is involved.

Remaining work:

- add optional live credential smoke tests outside the default test suite;
- extract message-platform connector SDKs as independent capabilities;
- generate the complete third-party license inventory from the locked build
  environment instead of maintaining a historical CSV manually.
