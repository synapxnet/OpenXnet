# Phase 3AG External CLI Credentials

## Status

Implemented on 2026-07-27. Claude Code, Qwen Code, and OpenAI Codex custom
Provider credentials now reuse the existing Main-owned Provider credential
boundary. No fifteenth credential sidecar was added. Renderer and durable
settings retain only the selected Provider ID, endpoint, model, and configured
boolean.

## Ownership Model

Each external CLI has two exclusive authentication modes:

| Mode | Credential owner | OpenXnet behavior |
| --- | --- | --- |
| CLI native authentication | the installed CLI and its local credential facility | does not read, copy, migrate, or rewrite credentials |
| Custom Provider | Electron Main Provider boundary | hydrates only the selected Provider key into the target CLI child environment |

`ccSettings`, `qcSettings`, and `ocSettings` are Provider references. They no
longer copy `modelProviders[].apiKey` into Renderer state. Provider selection
and synchronization clear `api_key` and project only
`api_key_configured`. Python hydrates the selected key in memory from the
existing process-scoped Provider envelope and clears every CLI key before
persistence.

Native CLI authentication remains deliberately outside the OpenXnet
credential inventory. The application does not inspect Claude, Qwen, or Codex
login files, operating-system keychains, OAuth tokens, or CLI-owned config
directories. Disabling custom Provider mode lets the child use its existing
native authentication without migrating it into OpenXnet.

## Child Process Boundary

Before launching any third-party CLI, OpenXnet creates a detached child
environment that removes every `OPENXNET_*` variable and every
`*_CREDENTIALS_B64` envelope. Custom Provider mode also removes ambient native
Claude, Qwen, Google, and OpenAI credential variables before adding the one
selected credential:

| Consumer | Endpoint variable | Credential variable | Model variable |
| --- | --- | --- | --- |
| Claude Code | `ANTHROPIC_BASE_URL` | `ANTHROPIC_API_KEY` | `ANTHROPIC_MODEL` |
| Qwen Code | `OPENAI_BASE_URL` | `OPENAI_API_KEY` | `OPENAI_MODEL` |
| OpenAI Codex | `OPENAI_BASE_URL` | `OPENAI_API_KEY` | `OPENAI_MODEL` |

Custom configuration requires a complete endpoint, model, and key. Remote
endpoints require HTTPS; HTTP is accepted only for explicit loopback hosts.
URL user information, query strings, fragments, invalid ports, overlong
values, and control characters in keys are rejected with a fixed error.

CLI native mode preserves user-owned native credential environment variables
because those credentials remain under the installed CLI's ownership. It
still removes all OpenXnet private runtime variables and credential envelopes.

## Codex Runtime

Custom Codex execution uses an isolated temporary `CODEX_HOME` containing only
secret-free `config.toml` metadata. OpenXnet never creates `auth.json`; the
selected key exists only in the Codex child environment. Native authentication
does not create or override `CODEX_HOME`.

On WSL, the key and temporary home are forwarded through environment
inheritance. `WSLENV` contains variable names only, and the `bash -lc` argument
contains neither an export statement nor a credential value. Prompt and final
message files live under the temporary runtime root and are removed in
`finally` cleanup.

## Output And Rotation

Claude, Qwen, native Codex, WSL Codex, and Codex last-message output redact
every selected credential value before yielding text. Claude, Qwen, and Codex
unexpected failures return fixed public errors without raw exception text.

Credential save, clear, or rotation continues through the Provider service.
The existing Provider rotation path invalidates the Execution Engine and
legacy compatibility runtime, so a subsequent external CLI invocation receives
fresh process memory. No external CLI credential is placed in a process-wide
OpenXnet environment or an additional encrypted store.

## Verification

Focused verification passes 6 external CLI security tests, 2 Python Provider
hydration tests, and 18 Renderer startup contract tests. UTF-8, Python
docstring, TypeScript JSDoc, Python syntax, generated Renderer, and JavaScript
syntax checks pass.

The complete architecture regression passes Renderer `24/24` together with
Desktop Core and all credential, Task Worker, Execution Engine, runtime
profile, Feature Pack, REST, and Connector suites.

The real Electron cold-start smoke seeds independent Claude, Qwen, and Codex
Provider keys alongside the generic Provider and all previous credential
classes. It verifies configured-only CLI settings, plaintext-free legacy and
Core SQLite, encrypted Provider-file bytes, isolation from the other thirteen
sidecars, exactly fourteen credential sidecars, and an inactive
`legacy-backend`. The budget-gated pass completes with process startup at 2.247
seconds and workspace hydration at 1.898 seconds. The final pass after the
complete regression and one discarded machine-load run completes at 1.684 and
1.447 seconds respectively. The precompiled Renderer hash is
`225025e0cc70c95cd5d7366c9f7039a6b040704649ef278f35253dd1ecc4db8c`.

## Remaining Trust Zones

All application-managed credential domains currently identified in the code
have an explicit owner, scope, storage rule, and consumer boundary. Installed
CLI login state remains a CLI-owned trust domain that OpenXnet intentionally
does not read or copy.

Any newly introduced credential class still requires a documented owner,
typed scope, migration, consumer allow-list, rotation behavior, clear
semantics, and error policy before implementation.
