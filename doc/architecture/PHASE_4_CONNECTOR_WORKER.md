# Phase 4: Connector Worker Extraction

> Phase 3AK replaced the transitional `/tts` and `/asr` upstream shown in this
> historical phase with the independently supervised Voice Worker.

## Status

QQ, Feishu, Dingtalk, Discord, and Slack connector SDKs moved out of the base
backend on 2026-07-23.

## Outcome

The five existing bot managers now run inside one optional Connector Worker.
Their message parsing, local conversation memory, OpenAI-compatible calls,
behavior engine integration, TTS, image handling, and platform reply logic
remain unchanged. The base FastAPI process retains the existing start, stop,
status, and reload URLs through an authenticated compatibility client.

Telegram remains in the base backend. Its current implementation does not
depend on one of the extracted SDKs and needs a separate transport review
before moving across the process boundary.

## Request Flow

```text
Desktop typed lifecycle IPC or Server compatibility route
  -> Desktop Core ensureCapability("connectors")
  -> WorkerSupervisor
  -> Connector Worker
  -> lazy platform Manager and SDK import
  -> provider WebSocket or Socket Mode connection
  -> existing behavior and reply logic
  -> Chat: Connector-only bearer and Main Connector Chat Broker
       -> request-scoped Execution Engine lease
  -> Voice: separate Connector-only bearer and artifact reference
       -> Main Connector Voice Broker
       -> on-demand transitional /tts or /asr upstream
```

Status requests for a connector that has not started in the current backend
session return a local stopped result. They do not activate the optional Pack.
Once a connector starts, the Worker stays alive until application shutdown;
idle termination is disabled because a provider connection can be active even
when no control RPC is in flight.

## RPC Contract

The allow-listed Connector methods are:

- `connectors.status`
- `connectors.dependencies`
- `connectors.start`
- `connectors.stop`
- `connectors.reload`
- `connectors.update`
- `connectors.stop-all`

The start and reload payloads contain one allow-listed platform, a bounded
configuration object, and the actual backend port selected at runtime. The
Worker accepts at most 256 KiB of connector configuration. The shared gateway
retains its 1 MiB request limit, fixed method allow-list, Host validation, and
timing-safe bearer comparison.

The existing Managers write diagnostics to standard output. Connector Worker
captures that stream to standard error and preserves the original standard
output exclusively for NDJSON protocol responses. Shutdown stops instantiated
Managers concurrently before the process exits.

## Credential Boundary

Phase 3X subsequently moved QQ, Feishu, Dingtalk, Discord, and Slack secrets
into Main-owned `connector-credentials.bin`. The Connector Worker receives a
bounded process environment envelope resolved at each fresh activation. Legacy
HTTP and the random bearer-authenticated loopback RPC now carry redacted
configuration metadata only. The implementation additionally enforces:

- empty token and secret defaults in `config/settings_template.json`;
- no connector configuration in Pack manifests or status responses;
- removal of legacy Manager `config` fields from Worker status;
- recursive redaction of `token`, `secret`, and `password` fields;
- exact-value redaction when a provider exception repeats a submitted secret;
- structured missing-Pack errors that contain no submitted configuration.

Provider SDK diagnostics are redirected to the Worker's private stderr log.
They remain a residual audit surface because third-party libraries control
their own diagnostic text; application responses and protocol output do not
forward those logs.

The independent Connector Feature Pack version is `1.1.0` after adding the
process-scoped credential module. Credential rotation stops an active Connector
Worker so its next activation cannot reuse a stale environment snapshot.
Phase 3Z raised it to `1.2.0` for image-host ownership. Phase 3AI raises it to
`1.3.0` for the private five-platform Chat client. Phase 3AJ raises it to
`1.4.0` for private Voice requests and temporary audio references.

## Dependency Boundary

The following dependencies moved from the base group to the `connectors`
optional group and `requirements-connectors.txt`:

- `qq-botpy`
- `lark-oapi`
- `dingtalk-stream`
- `discord-py`
- `slack-sdk`

`server.spec` explicitly excludes `botpy`, `lark_oapi`, `dingtalk_stream`,
`discord`, and `slack_sdk`. The old Manager source remains in the repository and
is analyzed for Connector Pack construction, but its SDK imports resolve only
inside the optional Worker.

The Pack limits generated imports to Feishu IM v1 and WebSocket modules, Slack
Web and Socket Mode modules, and the required QQ, Dingtalk, and Discord module
graphs. Flask and SQLAlchemy integrations are excluded.

## Connector Pack Result

The final Windows x64 Pack contains:

- 835 integrity-protected payload files;
- 171,696,759 payload bytes;
- a 27,873,746-byte Worker executable;
- 87,638,061 bytes of `imageio_ffmpeg` runtime for existing Feishu and Discord
  voice reply behavior;
- all five Manager and actual provider message module imports available;
- zero FAISS, ONNX Runtime, Tokenizers, Transformers, Mem0, Qdrant Client,
  Sherpa, SoundFile, document parser, Flask, or SQLAlchemy paths.

The manifest itself is not counted as a payload file. Pack installation
verifies every declared size and SHA-256 hash before execution.

## Base Package Result

The rebuilt Windows x64 base backend contains:

- 2,925 files;
- 406,948,829 bytes;
- zero paths matching any of the five extracted SDK module or distribution
  names;
- a 35,359,373-byte `server.exe` entrypoint.

Compared with the Google REST cleanup base of 420,653,393 bytes, this phase
removed 13,704,564 bytes, approximately 13.07 MiB or 3.3%. Compared with the
804,491,139-byte output recorded after the original Voice Worker extraction,
the cumulative reduction is 397,542,310 bytes, approximately 49.4%.

The filesystem package sizes of the five SDKs are larger than the base-package
reduction because most generated Python modules were compressed inside the
previous PYZ archive and several transitive libraries remain required by other
base features.

## Validation

The final validation confirmed:

- eight Connector handler, client, secret-redaction, lazy-import, and legacy
  route tests;
- all 15 Desktop Core tests and all Worker and feature-pack test suites;
- all eight Kernel regression checks;
- UTF-8 and Python/TypeScript function documentation standards;
- lock consistency for 375 resolved packages;
- Pack build, manifest installation, integrity verification, activation, and
  offline import of all five Manager and provider message module graphs;
- all five packaged stopped-status requests through Desktop Core RPC;
- all five legacy base status URLs without the optional Pack;
- missing-Pack start returning a credential-safe structured 503;
- rebuilt base `/health` returning `{"status":"ok"}` in approximately 4.58
  seconds on the validation workstation.

Live provider connections were not attempted because no test credentials are
stored in the repository. They require opt-in account fixtures and should not
be part of the default offline suite.

## Rollback And Remaining Work

Rollback restores the five base dependencies and direct route Manager calls.
No persisted data migration is involved; connector settings keep their current
schema and user-data location.

Remaining work:

- add opt-in live credential smoke tests for all five provider sandboxes;
- provision the production signing key and publish Connector Pack through the
  completed Phase 5 install, repair, removal, and progress workflow;
- split provider SDK diagnostics into rotated per-connector logs with explicit
  credential filters;
- review Telegram transport and move it only after its callback and media
  contracts have equivalent coverage.

Phase 3AH subsequently moved the five-platform Desktop lifecycle control plane
from FastAPI routes to typed Main IPC and direct Worker requests. Phase 3AI
then moved ordinary and proactive Chat requests through a private Main Broker
to Execution Engine. Phase 3AJ moved Connector TTS and ASR through a separate
Voice and artifact Broker and removed the Worker's static `legacy-backend`
dependency. The Voice Broker's compatibility upstream and the read-only
settings mirror remain for the next Voice Worker and settings extractions.
