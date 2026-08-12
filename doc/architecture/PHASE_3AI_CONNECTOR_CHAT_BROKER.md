# Phase 3AI Connector Chat Broker

## Status

Implemented on 2026-07-29. Ordinary and proactive Chat requests from QQ,
Feishu, Dingtalk, Discord, and Slack now leave Connector Worker through a
private Main-owned broker and enter the independently supervised Execution
Engine. Connector Chat no longer calls the general FastAPI backend.

This phase does not migrate Connector TTS or ASR. The Core `connectors`
capability therefore retains its transitional `legacy-backend` dependency.

## Request Flow

```text
Platform message or behavior event
  -> Connector Manager
  -> shared Connector Chat client
  -> random Connector-only bearer
  -> Main-owned Connector Chat Broker
  -> acquire Chat capability and Execution Engine request lease
  -> separate Execution Engine bearer
  -> exact /v1/chat/completions route
  -> streamed or non-streamed result
```

Starting the lightweight Broker does not activate Execution Engine or the
legacy backend. The Engine starts only after an authenticated, validated Chat
request acquires a request-scoped lease. The lease remains active until the
upstream response ends, closes, fails, or the caller disconnects.

## Contract

The Broker accepts only `POST /v1/chat/completions` on its exact loopback Host
without a query string. Requests must contain between 1 and 256 messages and
may use only the top-level fields already owned by `ApplicationChatRequest`.
Bodies are limited to 2 MiB and successful response streams to 8 MiB.

Unknown routes, methods, fields, oversized bodies, malformed JSON, invalid
Host headers, and invalid credentials are rejected before Execution Engine
activation. Non-success Engine responses are drained privately and replaced
with fixed Connector Chat errors so provider or tool diagnostics cannot cross
the broker boundary.

## Trust Zones

Main creates a new process-scoped Connector caller token independently from
the Execution Engine token. Only Connector Worker receives
`OPENXNET_CONNECTOR_CHAT_ORIGIN` and `OPENXNET_CONNECTOR_CHAT_TOKEN`; Renderer,
Core SQLite, the compatibility backend, Task Worker, and unrelated optional
Workers do not receive either value. The Broker replaces the caller token with
the Engine token before forwarding a request.

Connector Worker validates that the injected origin is credential-free,
loopback HTTP with an explicit port. Partial private configuration, remote
origins, URL credentials, paths, queries, fragments, and short tokens fail
closed. When both private variables are absent, Server profile retains its
existing active-port compatibility endpoint.

## Platform Migration

All ten ordinary and proactive Chat client constructions across QQ, Feishu,
Dingtalk, Discord, and Slack now use `create_connector_chat_client`. Platform
Managers no longer construct an unauthenticated loopback Chat URL or hard-code
an OpenAI compatibility key.

The Connector Feature Pack version is `1.3.0`. Its PyInstaller specification
explicitly includes the private Chat client module.

## Remaining Boundary

Feishu and Discord transcription still use `/asr`; Feishu, Discord, and Slack
speech replies still use `/tts`. Those exact voice paths remain owned by the
compatibility backend. Connector Managers also continue to read redacted
compatibility settings from the application data directory, while behavior
orchestration runs inside Connector Worker.

Phase 3AJ subsequently introduced typed Connector Voice and artifact requests,
moved TTS and ASR behind a private Main Broker, and removed the Core
`connectors -> legacy-backend` dependency. The Voice Broker still uses an
on-demand compatibility upstream until the full Voice Worker extraction.

## Verification

Focused verification covers exact route and field allow-lists, caller/upstream
token separation, validation before activation, UTF-8 streaming, size budgets,
fixed upstream failures, private-origin validation, Server fallback, and all
five Manager source boundaries. Connector Chat Broker tests pass 4/4, existing
Connector Worker tests pass 8/8, and private client tests pass 4/4.

The full architecture regression suite passes in approximately 186.6 seconds,
including all 24 Renderer aggregate tests and all Desktop Core, credential,
task, Execution Engine, Worker, Feature Pack, REST, and Connector suites.

The final default-budget Electron cold-start smoke passes with a 2,090 ms
process startup and a 1,814 ms workspace startup. The Connector Chat Broker
binds without activating Chat, Execution Engine, Connector Worker, or
`legacy-backend`; the backend remains stopped through the 2,500 ms observation
window. The verified precompiled Renderer bootstrap SHA-256 remains
`225025e0cc70c95cd5d7366c9f7039a6b040704649ef278f35253dd1ecc4db8c`.
