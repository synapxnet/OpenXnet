# Phase 3BL Base MCP Transport Package Boundary

## 状态

2026-07-30 完成。Phase 3BK 已把 SQL MCP 实现迁出基础包，本阶段继续移除共享
`server/execution-engine` Analysis 中的通用 MCP Client、MCP SDK 和 FastAPI-MCP 闭包。
Desktop 与 Execution Engine 只使用 typed MCP Runtime 和 Main 私有 Tool Broker；显式
Server profile 仍保留源码环境中的兼容能力。

## Profile 边界

```text
Desktop / Execution Engine
  -> typed Main MCP Runtime
  -> authenticated private Tool Broker
  -> independent MCP Worker

explicit Server source profile
  -> compatibility routes
  -> delayed import of local MCP client
```

`server.py` 不再顶层导入 `FastApiMCP` 或 `McpClient`。只有 `RUNTIME_PROFILE == "server"`
时，兼容初始化才通过 `_create_server_mcp_client` 延迟导入本地 MCP Client；其他 profile
调用该入口会直接失败。Desktop 与 Execution Engine 的 lifespan 不创建本地 MCP 连接，也不
启动 Server-only Task Scheduler。

Electron 启动环境不再向 legacy backend 注入 MCP、Home Assistant 或 SQL 凭据。凭据只进入
拥有对应操作的 MCP Worker；Execution Engine 只接收私有 Broker Origin 和独立 bearer，避免
通过兼容客户端反向获得 Worker 凭据。

## 物理打包边界

`server.spec` 显式排除：

- `py.mcp_clients` 与 `py.mcp_runtime`；
- `fastapi_mcp`、`mcp`、`httpx_sse`、`httpx_ws` 与 `sse_starlette`；
- `py.workers.mcp_worker` 以及 Phase 3BK 已移出的 SQL 依赖。

这些排除项只作用于 Desktop 基础冻结包。独立 MCP Feature Pack 仍从
`requirements-mcp.txt` 和 `mcp-worker.spec` 获得完整 transport、SQL 与浏览器 MCP 能力。
显式 Server 源码模式也仍可在完整开发环境使用 compatibility routes。

## 验证

- MCP Runtime、Worker、私有 Broker 与 profile 路由测试通过；
- MCP Feature Pack `1.4.0-openxnet.1.0.2` 冻结 smoke 通过；
- 基础 PYZ 对 `fastapi_mcp`、`mcp_alchemy`、SQLAlchemy 和 MCP Worker 零命中；
- 冻结 Server `/health` 与 Execution Engine 认证/路由隔离 smoke 通过。

Phase 3BL 至 3BN 使用同一轮连续去重。为避免把后续传递依赖和 Worker Analysis 的收益错误
归入本阶段，单阶段不声明独立体积差值；联合稳定产物记录在 Phase 3BN。

## 后续边界

下一阶段审计仍由保留根依赖自动引入、但 Desktop/Execution Engine 不使用的可选传递闭包。
不得因为某个顶层包仍需保留，就默认打包它的云供应商、模型、浏览器或 MCP extra。
