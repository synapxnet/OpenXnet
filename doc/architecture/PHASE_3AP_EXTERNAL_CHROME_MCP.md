# Phase 3AP External Chrome MCP

## 状态

2026-07-29 完成。Desktop Renderer 的外部浏览器控制不再直接访问
`/start_ChromeMCP` 或 `/stop_ChromeMCP`。BrowserMCP 与 Playwright MCP 连接现由 Phase
3AO 建立的独立 MCP Worker 承载；Execution Engine 继续通过 Main 私有 MCP Tool Broker
发现和调用工具；Browser/Server 保留 HTTP 兼容接口。Electron internal CDP 模式不属于
外部 MCP 子进程，继续保持原 Main/Renderer 边界。

## 调用链

```text
Desktop Renderer
  -> typed MCP Runtime preload IPC
  -> ApplicationMcpRuntimeService (chrome-external)
  -> Desktop Core mcp capability
  -> MCP Worker
  -> locked local Node CLI
     -> BrowserMCP or Playwright MCP

Execution Engine
  -> private MCP Tool Broker origin + bearer
  -> MCP Worker list/call
  -> bounded schema or result
```

Renderer 只能提交固定集成标识 `chrome-external` 和 `mcpName`。`mcpName` 只允许
`browser-mcp` 或 `playwright-mcp`；command、args、env、包名、版本、路径和额外字段不能
由 Renderer 控制。`status` 与 `stop` 不激活停止状态的 Worker，`start` 才按需激活。

## Node 供应链边界

直接把 BrowserMCP 文件放进 Pack 会扩大第三方再分发责任，因为其 npm 包未声明许可证；
继续使用 `npx latest` 又会绕过 Feature Pack 签名和版本审计。因此本阶段采用签名 lock
清单加首次显式安装：

- `mcp-node-runtime/package.json` 固定 `@browsermcp/mcp@0.1.3` 与
  `@playwright/mcp@0.0.78`；
- `package-lock.json` 使用 lockfile v3，包含 101 个 package 条目；
- 100 个远程 tarball 全部为 HTTPS 且有 `sha512` integrity；
- 两份清单进入 MCP Pack manifest 的逐文件 SHA-256；
- 首次明确启用时执行 `npm ci --ignore-scripts --omit=dev --no-audit --no-fund`；
- Playwright 浏览器下载脚本被禁用，浏览器资源使用独立缓存；
- 安装完成后按 lock 摘要写入私有版本目录，后续启动直接运行本地 CLI；
- 不再执行 `npx`，不解析 `latest`，也不接受 Renderer 自定义 npm 包。

安装使用随应用提供的 Node/npm；开发模式可回退到明确的系统 Node 与相邻 npm CLI。
失败、超时、入口缺失和 lock 漂移都只返回固定错误，暂存目录在失败后清理。

## 进程与数据边界

第三方 CLI 只继承操作系统路径、用户目录、临时目录和浏览器/npm 私有缓存等白名单字段。
Home Assistant Token、Provider key、`OPENXNET_*` 包络、Task/Connector/Voice/Live 凭据和
父进程任意 npm 配置都不进入子进程。npm 安装与 MCP stdio 的 stdout/stderr 不向 Renderer
返回；连接错误只记录异常类型，第三方原始栈被丢弃。

BrowserMCP 首次连接使用其扩展通信端口；Playwright MCP 使用本机浏览器。工具清单最多
512 项、工具名最多 128 字符、参数最多 256 KiB、结果最多 2 MiB，沿用 Phase 3AO 的
Worker 与 Broker 双层校验。不同集成使用独立工具归属缓存，Broker 响应还会校验集成和
工具名，避免跨集成混淆。

## 兼容边界

Browser/Server 的 `/start_ChromeMCP` 与 `/stop_ChromeMCP` 继续存在，但复用同一 lockfile
安装和 stdio 配置构造器。停止接口新增 POST，旧 GET 暂时保留兼容。Server 错误不再返回
原始 npm、Node 或 MCP SDK 异常。

Desktop 保存 `enabled`、`type`、`mcpName` 和 internal CDP 元数据，但 external 生命周期
始终走 typed IPC。Execution Engine 只收到私有 Broker origin 与 bearer，不接收 Node
路径、npm lock、浏览器缓存目录或第三方进程环境。

## 打包与验证

MCP Pack 升级为 `1.2.0-openxnet.1.0.2`：

- payload 文件：818；
- payload 字节：66,816,006；
- Python 入口：`runtime/mcp-worker.exe`；
- Node lock：`node-runtime/package.json` 与 `node-runtime/package-lock.json`；
- FastAPI/Uvicorn 文件：0。

真实源码运行时和真实冻结 Pack 均完成空缓存首次 `npm ci`、BrowserMCP 启动、12 个工具
发现和停止。前五个工具为 `browser_navigate`、`browser_go_back`、
`browser_go_forward`、`browser_snapshot` 和 `browser_click`。冻结依赖检查同时确认
`anyio`、`httpx`、`mcp` 与 `pydantic` 可用。

定向验证通过：

- MCP Worker、最小环境与 Broker client：5/5；
- Renderer 启动与 Desktop 路由边界：25/25；
- Desktop Core：208/208；
- Python/TypeScript 编译、UTF-8、中文函数说明与 Renderer bootstrap：通过。

全量架构回归全部通过，耗时 `160,100 ms`。最终 Electron 默认预算冷启动通过：
进程 `1,942 ms`、workspace `1,653 ms`，观察窗口 `2,500 ms`；MCP Worker、
`legacy-backend`、Execution Engine、Connector Worker、Voice Worker 和 Live Worker 均保持
停止。外部 Chrome 支持没有增加空闲启动的 Node/npm 安装、网络请求或子进程。

## 后续边界

下一个域为 SQL MCP。迁移前必须先建立独立数据库密码凭据边界，再把 SQLite 路径与远程
数据库连接元数据纳入 typed contract；密码不得进入 Renderer 持久化、Core SQLite、
Worker RPC 载荷或 Execution Engine。
