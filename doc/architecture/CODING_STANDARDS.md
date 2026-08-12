# OpenXnet Coding Standards

## Encoding

- All source, configuration, test, and documentation files use UTF-8.
- New files must not use locale-specific legacy encodings.
- Line endings are LF unless a platform-owned format requires otherwise.
- Repository encoding is validated by `npm run check:utf8`.

## Function Documentation

- Every new or refactored named function, class method, constructor, and accessor requires documentation.
- TypeScript and JavaScript use JSDoc or TSDoc immediately above the declaration.
- Python uses a docstring as the first statement of the function or method.
- 自 Phase 3AJ 起，新增或实质修改的函数说明统一使用中文；协议名、类型名和第三方 API 名称可保留英文原文。
- 修改已有函数行为时必须同步更新其中文说明，明确输入、输出、副作用、安全边界或失败语义。
- Comments describe the contract, side effects, invariants, or non-obvious behavior. They must not merely restate the function name.
- Inline callbacks should be extracted into documented named functions when they contain business logic.
- Trivial framework callbacks in tests may use a descriptive test name instead of a separate doc block.

## Indentation

- `.editorconfig` is the authoritative formatting baseline for editors and automation.
- TypeScript, JavaScript, JSON, Vue, CSS, HTML, and YAML use two spaces per indentation level.
- Python uses four spaces per indentation level.
- Tabs are not used for source indentation.
- Existing files retain their established surrounding style when a narrower local convention is required.

## TypeScript

- Strict mode is mandatory for new desktop architecture modules.
- Public inputs use explicit types and runtime validation at process boundaries.
- Avoid `any`; use `unknown` and narrow it.
- Process APIs return serializable values only.
- Domain code must not import Electron APIs.
- Errors crossing process boundaries use structured error objects.

## Python

- New worker modules use type hints and Python 3.12 syntax.
- Importing a worker module must not initialize models, connect to external services, or write user data.
- Heavy dependencies are imported inside capability activation paths.
- Worker stdout is reserved for protocol messages. Diagnostics use stderr or structured events.
- A worker must handle cancellation and graceful shutdown.

## Architecture Boundaries

- Renderer code does not call `ipcRenderer` or backend URLs directly.
- Preload code exposes allow-listed operations only.
- Electron Main contains platform integration and process supervision only.
- Application Core owns durable desktop state.
- Workers do not share the primary database.
- Large binary data crosses boundaries by artifact reference, not Base64 payloads.

## Legacy Ratchet

The existing application contains undocumented functions and mixed responsibilities. New standards are enforced immediately in `src/desktop` and `py/workers`. A legacy file enters enforcement when it is migrated or materially refactored. Unrelated mass comment changes are prohibited because they obscure behavioral reviews.
