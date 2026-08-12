# Phase 3AR 通用 MCP Server

## 状态

2026-07-29 完成。Desktop Renderer 的通用 `mcpServers` 生命周期、工具发现和调用不再依赖
`/create_mcp`、`/mcp_status`、`/remove_mcp` 或 Execution Engine 内的全局 `mcp_client_list`。
Desktop 使用 typed MCP Runtime IPC 和独立 MCP Worker；Execution Engine 只通过 Main 私有
MCP Tool Broker 访问工具。Browser/Server 继续保留兼容 HTTP 路由和 stdio 配置能力。

## 调用链

```text
Desktop Renderer
  -> typed MCP Runtime IPC (generic:<serverId>)
  -> Desktop Core mcp capability
  -> MCP Worker
  -> SSE / Streamable HTTP / WebSocket MCP Server

Execution Engine
  -> private MCP Tool Broker origin + bearer
  -> dynamic integration (generic:<serverId>)
  -> MCP Worker list/call
  -> bounded tool schema or result
```

每个通用 Server 使用独立动态 integration 和独立连接。工具归属缓存也按完整 integration
隔离，`generic:docs` 的工具不能被 `generic:issues` 复用。配置发生变化时 Worker 会先关闭旧
连接再建立新连接；单个 Server 发现失败只记录固定类型，不影响其他 Server 的工具清单。

## 传输与命令边界

Desktop 仅允许以下远程传输：

- `sse`；
- `streamable-http`；
- `websocket`。

外部 HTTP 传输必须使用 HTTPS，外部 WebSocket 必须使用 WSS。明文 HTTP/WS 只允许
`localhost`、IPv4 或 IPv6 回环地址。URL 禁止 userinfo、query 和 fragment，并限制为
2,048 UTF-8 字节。公开 header 最多 64 个，名称必须满足 RFC token 形式，值限制为
8,192 字符且禁止控制字符。

Desktop 明确拒绝 Renderer 自定义 `command`、`args` 和 `env`，界面中的 stdio 选项在
Desktop profile 禁用。这样不会把通用 MCP 配置变成任意本机命令执行入口。Browser/Server
仍可使用 stdio，作为部署和迁移兼容能力；该兼容路径不会进入 Desktop typed Runtime。

## 凭据边界

通用 MCP 继续复用独立 `mcp-credentials.bin`：

- Renderer 只持有 configured 名称和用户当前正在编辑的瞬时输入；
- 持久化设置中的敏感 header 和 env 值保持为空；
- typed Runtime、Worker RPC 和私有 Broker 请求只携带无密钥配置；
- `OPENXNET_MCP_CREDENTIALS_B64` 只进入 MCP Worker 或显式兼容 backend；
- Worker 按 `serverId` 只补齐对应 Server 的敏感 header，不把 stdio env 注入远程连接；
- Execution Engine 只接收 Broker origin 和进程 bearer，不接收通用 MCP 凭据封包；
- 凭据变化会先停止 MCP Worker，再允许下一次请求使用新封包重新激活。

Main 和 Worker 都会拒绝 Renderer 提交的 `Authorization`、Cookie、token、secret、password、
credential 或类似敏感 header。Worker 补齐后的私有 header 不进入状态、工具 schema、调用
结果、日志或错误消息。

## Renderer 与兼容边界

新增、重启、启停和删除在 Desktop 下均走 typed Runtime。工具发现由新的
`listApplicationMcpRuntimeTools` 返回有界、可序列化摘要。JSON 配置会保留其显式
`streamable-http` 类型，并在空 Server 或非对象配置时失败关闭。

`pollMCPStatus`、`/create_mcp`、`/mcp_status`、`/remove_mcp` 和开发工作台兼容 toggle 只在
typed Runtime 不可用的 Browser/Server profile 使用。Execution Engine profile 启动时跳过
legacy `McpClient` 初始化，避免重复连接、额外启动成本和 Broker 绕过。

## 打包与验证

MCP Pack 升级为 `1.4.0-openxnet.1.0.2`：

- payload 文件：838；
- payload 字节：88,819,970；
- Python 入口：`runtime/mcp-worker.exe`；
- FastAPI/Uvicorn 文件：0；
- Pack 目录含 manifest 共 839 个文件、88,977,966 字节。

真实冻结 Pack smoke 结果：

- BrowserMCP 启动、12 个工具发现和停止通过；
- SQLite SQL MCP 启动、4 个工具发现、真实表发现、`SELECT` 查询和停止通过；
- 带 Bearer 认证的本地 Streamable HTTP Server 启动通过；
- `generic:pack-smoke` 完成状态、启动、`phase3ar_echo` 工具发现、真实调用和停止；
- 通用 MCP 私有认证 header 由 Worker scope 凭据补齐，公开配置和 smoke 结果不含 token；
- `anyio`、`httpx`、`mcp`、`mcp-alchemy`、`pydantic`、SQLAlchemy 和五类数据库驱动均可导入。

专项与全量回归结果：

- MCP Tool Broker Gateway：3/3；
- MCP Worker/Broker Client：7/7；
- MCP/HTTP 凭据边界：5/5；
- Renderer 启动架构：27/27；
- Desktop Core：213/213；
- UTF-8、LF、Python docstring、TypeScript 函数说明和 Renderer bootstrap：通过；
- 全量架构回归：通过，耗时 `161,265 ms`。

最终 Electron 冷启动：process `2,016 ms`、workspace `1,755 ms`、观察窗口 `2,500 ms`。
Execution Engine、Voice、Connector、Live、MCP 和 legacy backend 均保持 stopped，通用 MCP
迁移没有增加空闲 Python 进程。

## 后续边界

通用 MCP 域完成后，应重新盘点 Desktop 中剩余会激活 `legacy-backend` 的真实用户路径，按
启动频率、依赖重量和安全边界排序后进入下一域。Browser/Server 兼容路由不应仅为追求
代码数量而删除；只有对应 Desktop typed 路径稳定并具备真实 smoke 后才收缩兼容面。
