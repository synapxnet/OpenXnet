# Phase 3AO MCP Runtime

## 状态

2026-07-29 完成。Desktop Renderer 的 Home Assistant 生命周期不再访问
`/start_HA` 或 `/stop_HA`。Home Assistant MCP 连接现由独立、可选的 MCP Worker
承载；Execution Engine 通过 Main 私有 Tool Broker 获取工具 schema 和调用结果；
Browser/Server 继续保留原 HTTP 兼容接口。

## 调用链

```text
Desktop Renderer
  -> typed preload IPC
  -> ApplicationMcpRuntimeService
  -> Desktop Core mcp capability
  -> WorkerSupervisor
  -> MCP Worker
  -> McpRuntimeController
  -> Home Assistant MCP SSE

Execution Engine
  -> private MCP Tool Broker origin + bearer
  -> Main validation and request lease
  -> MCP Worker list/call request
  -> bounded schema or result
```

Desktop 的 `status` 和 `stop` 不激活停止状态的 Worker。`start` 先等待凭据轮换
队列，再按需激活 `mcp` capability。MCP capability 只依赖 Core，不依赖
`legacy-backend`、Execution Engine、Connector Worker、Voice Worker 或 Live Worker。
私有 Broker 自身启动不会激活 MCP Worker，只有通过验证的工具请求才会获取 Worker。

## Runtime Contract

Renderer 只能提交固定集成标识 `home-assistant` 和一个无密钥 URL。Main 拒绝额外
字段、密钥风格字段、未知集成、错误类型、控制字符、超长 URL 和超过 128 KiB 的配置。
Worker 只开放 `mcp.status`、`mcp.dependencies`、`mcp.start`、`mcp.stop`、
`mcp.tools.list` 和 `mcp.tools.call`。

工具清单最多 512 项，工具名最多 128 字符；调用参数最多 256 KiB，结果最多
2 MiB。Worker 返回 OpenAI function schema 的有界副本，Execution Engine 仅调用最近
清单声明的工具。未知工具、无效字段、超长请求和上游失败均转换为固定公开错误，不返回
Home Assistant URL、Authorization header、Token 或 SDK 原始诊断。

## Tool Broker 边界

Main 为 Execution Engine 创建独立的进程级 bearer，并只注入
`OPENXNET_MCP_TOOL_BROKER_ORIGIN` 与 `OPENXNET_MCP_TOOL_BROKER_TOKEN`。Broker 只接受
回环 Host、Bearer 认证、无 query 的精确 POST 路由：

- `/v1/mcp/tools/list`；
- `/v1/mcp/tools/call`。

Broker 在激活 Worker 前完成方法、路由、认证、Content-Type、字段和请求体大小校验。
请求体限制为 512 KiB，响应限制为 2 MiB。Execution Engine 不接收 Home Assistant
Token、MCP Worker 环境或上游 SSE 地址；MCP Worker也不接收 Provider、Task、Connector、
Voice、Live 或 Execution Engine 凭据。

Broker 不可用或 Home Assistant 工具发现失败时，Execution Engine 记录固定诊断并继续
提供非 Home Assistant 内置工具，不把单个外部 MCP 故障扩散为整个 Chat/Task 故障。

## 凭据与兼容边界

Home Assistant Token 继续独立保存在 `home-assistant-credentials.bin`。Main 只把有界的
`OPENXNET_HOME_ASSISTANT_CREDENTIALS_B64` 注入新启动的 MCP Worker，以及显式启动的
Server 兼容 backend。Renderer、Core SQLite、Worker RPC 载荷、Execution Engine、Task
Worker、Connector Worker、Voice Worker 和 Live Worker 均不接收 Token。

Home Assistant 凭据轮换只停止 MCP Worker 与兼容 backend。下次显式启动读取新凭据；
Execution Engine 和其他 Worker 不受影响。Browser/Server 的 `/start_HA` 与
`/stop_HA` 继续委托兼容客户端，但这些路由不再属于 Desktop 调用链。

通用 `mcp-credentials.bin` 仍是独立的迁移中边界。本阶段没有把它注入 MCP Worker；
其 stdio 环境变量和敏感 HTTP header 仍只进入兼容 backend。这样不会在通用 MCP Server
生命周期、进程隔离和工具命名契约完成前扩大秘密消费者。

## 打包

MCP Pack `1.0.0` 使用独立 `requirements-mcp.txt` 与 PyInstaller spec，显式排除
FastAPI、Uvicorn、模型、向量、语音、Connector、Live 和执行引擎依赖。

实际 Windows x64 产物：

- 版本：`1.0.0-openxnet.1.0.2`；
- payload 文件：816；
- payload 字节：66,761,877；
- 入口：`runtime/mcp-worker.exe`。

`mcp==1.26.0` 根包会强制导入 `mcp.server.fastmcp`，因此冻结 Pack 必须包含
Starlette 与 SSE-Starlette，即使 Worker 只使用 client API。这是 SDK 导入依赖，不是
OpenXnet HTTP 服务依赖；产物中不存在 FastAPI 或 Uvicorn。

真实冻结入口 smoke 已确认 `anyio`、`httpx`、`mcp` 和 `pydantic` 可导入，初始状态
为停止，中文状态精确为“MCP 集成已停止”。

## 验证

- MCP Worker 与 Broker client：4/4；
- Renderer 启动与 Desktop 路由边界：24/24；
- Desktop Core：206/206；
- Python 编译、UTF-8、中文函数说明、TypeScript 编译与 Renderer bootstrap：通过；
- MCP Pack 依赖、UTF-8 中文状态和 FastAPI/Uvicorn 排除 smoke：通过。

全量架构回归全部通过，耗时 `174,800 ms`。最终 Electron 默认预算冷启动复测通过：
进程 `2,120 ms`、workspace `1,779 ms`，观察窗口 `2,500 ms`；MCP Worker、
`legacy-backend`、Execution Engine、Connector Worker、Voice Worker 和 Live Worker 均保持
停止。

大型全量测试与 Desktop 构建后的首次冷启动出现一次 `12,891 ms` 抖动，但运行时边界
仍全部保持停止。按既定约定，该偶发构建后抖动不纳入待解决问题，复测稳定数据作为阶段
验收结果。

## 后续边界

Home Assistant Runtime 已不再是 Desktop `legacy-backend` 激活来源。外部 Chrome MCP 已在
Phase 3AP 完成迁移。后续按边界依次迁移 SQL MCP（含独立密码凭据）、通用 MCP Server
生命周期与工具调用，然后处理动态 Local UI 和仍直接依赖兼容 backend 的工具/存储路由。
