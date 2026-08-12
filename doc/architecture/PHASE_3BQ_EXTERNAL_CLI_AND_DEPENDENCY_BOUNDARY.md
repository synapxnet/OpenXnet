# Phase 3BQ External CLI and Dependency Boundary

## 状态

2026-07-30 完成。Claude Code 集成改为直接启动用户已安装并登录的 `claude` CLI，基础运行时
不再嵌入 `claude-agent-sdk` 或读取外部 CLI 的登录状态。开发依赖声明、Feature Pack 可选组、
锁文件和第三方许可证清单也完成一致性收口。

## 外部 CLI 边界

- Prompt 只通过 stdin 发送，不进入命令行参数或日志；
- CLI 参数固定为 `stream-json` 输出和受控权限模式；
- 权限模式使用 allow-list，未知值不会传给子进程；
- stderr 不进入应用结果，输出只提取 assistant/result 文本；
- 超时会终止并清理子进程，错误不返回 CLI 登录目录或上游原始诊断；
- 结果继续经过 Provider 密钥脱敏；OpenXnet 不读取、复制或迁移 CLI 自有认证状态。

## 依赖声明

基础直接依赖移除了 Python-A2A、LangChain/LangSmith、DuckDuckGo Search 旧包、
Claude Agent SDK、Voice、MCP/SQL、Live、Memory、Vector、Document 和 Connector 专属依赖。
`pyproject.toml` 以 `connectors`、`desktop-control`、`documents`、`memory`、`mcp`、`live`、
`voice` 和 `vector` 可选组表达 Feature Pack 所有权；Pillow、E2B、DDGS 等实际基础消费者保留。

`uv.lock` 固定为 339 个包并通过 `uv lock --check`。第三方许可证 CSV 包含 127 条记录，
相对锁文件 `stale=0`、`mismatch=0`、字段缺失为 0。`requirements.txt`、
`pyproject.toml` 和许可证 CSV 均为 UTF-8 无 BOM、LF。

## 冻结边界

`server.spec` 排除 `claude_agent_sdk`、`orjson` 和 `zstandard`。Task Worker 进一步排除
HTTPX 可选 Trio/WebSocket 后端，PYZ 从 1,497 个模块降至 1,230 个模块。该阶段结束时基础
目录为 114,724,904 字节、825 个文件；相对 Direct A2A 构建再减少 3,704,489 字节
（3.53 MiB，3.13%）。最终 pywin32 拆分结果由 Phase 3BR 记录。

## 验证

- 外部 CLI 凭据与进程边界：8/8；
- Base Package Boundary 与 Direct A2A：9/9；
- Python 编译、UTF-8、Python docstring 和 TypeScript 函数说明检查：通过；
- 冻结 Server、Execution Engine、Voice Pack `2.1.0` 和 MCP Pack `1.4.0` smoke：通过；
- `claude_agent_sdk`、`orjson`、`zstandard` 和 Task Worker Trio 闭包在最终归档中均为 0。
