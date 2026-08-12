# Phase 3AQ SQL MCP

## 状态

2026-07-29 完成。Desktop Renderer 的 SQL 生命周期不再直接访问 `/start_sql` 或
`/stop_sql`，SQL 工具发现和调用不再依赖 legacy backend 全局 `sql_client`。SQLite、
PostgreSQL、MySQL/MariaDB、Microsoft SQL Server 和 Oracle 现由独立 MCP Worker 承载，
Execution Engine 通过 Main 私有 MCP Tool Broker 访问。Browser/Server 保留脱敏 HTTP
兼容接口。

## 调用链

```text
Desktop Renderer
  -> typed SQL credential/file-authorization preload IPC
  -> typed MCP Runtime IPC (sql)
  -> Desktop Core mcp capability
  -> MCP Worker
  -> same frozen mcp-worker --sql-server
  -> pinned mcp-alchemy
  -> SQLAlchemy driver

Execution Engine
  -> private MCP Tool Broker origin + bearer
  -> MCP Worker list/call
  -> bounded SQL tool schema or result
```

Renderer 对 SQLite 只能提交 `engine` 和 `databaseId`，不能提交本机路径；远程数据库只能
提交 `engine`、`user`、`host`、`port` 和 `dbname`，不能提交 `password`、command、args、
env 或数据库 URL。Main/Worker 分别执行一次精确字段校验。

## 凭据与文件授权

- 数据库口令从旧 `sqlSettings.password` 捕获到独立 `sql-credentials.bin`；
- sidecar 使用 Electron `safeStorage`，拒绝 Linux `basic_text` 后端；
- Renderer 快照只返回 `configured: ["password"]`，不返回口令；
- 兼容设置和 Core SQLite 持久化前再次清空 `password`；
- `dbPath` 统一迁移为 `dbpath`，模板不再包含两个大小写不同的键；
- SQLite 文件必须由系统文件选择器明确选择；
- Main 把真实路径写入私有 `sql-database-authorization.json`，Renderer 只持有 UUID；
- MCP Worker 启动包把 UUID 映射为已授权真实路径，未知、伪造、缺失或已删除文件均拒绝；
- SQL 凭据或文件授权变化只停止 MCP Worker 和兼容 backend，不影响 Voice、Connector 或
  Live Worker。

Execution Engine 只接收私有 Broker origin 与 bearer。SQL 口令和 SQLite 路径不会进入
Execution Engine 环境、Worker RPC/Broker 请求、Renderer 设置或日志。

## 冻结运行时与供应链

旧路由通过系统 `uvx` 动态下载 `mcp-alchemy` 和驱动，打包后的 Desktop 无法保证该前置
条件。本阶段移除 `uvx`，由父 MCP Worker 启动同一个已签名冻结入口的
`--sql-server` 模式。第三方进程只接收白名单操作系统环境、UTF-8 设置、结果预算和私有
`DB_URL`，不会继承其他 `OPENXNET_*` 或 Provider 密钥。

MCP Pack 固定以下依赖：

- `mcp-alchemy==2025.8.15.91819`；
- `SQLAlchemy==2.0.51`；
- `PyMySQL==1.2.0`；
- `psycopg2-binary==2.9.12`；
- `pymssql==2.3.13`；
- `oracledb==4.0.2`。

第三方许可证清单进入 Pack manifest。SQL 子进程 stderr 不转发给 Renderer，生命周期和
工具失败只返回固定公开错误。MCP Worker 继续限制配置 128 KiB、工具参数 256 KiB、工具
结果 2 MiB、工具数 512 和工具名 128 字符。

## 兼容边界

Browser/Server `/start_sql` 保留，但复用相同配置构造器、固定依赖和 stdio 子进程，不再
拼接明文 URL、执行 `uvx` 或把原始异常返回客户端。停止接口新增 POST，旧 GET 暂留迁移
窗口。非 Desktop Server 模式仍可从请求内存读取口令；Desktop 模式只从 Main 启动包读取。

`mcp-alchemy` 的 `execute_query` 保留现有读写能力。部署远程数据库时应使用最小权限账号；
本阶段没有在客户端猜测 SQL 方言或自行实现查询解析器。

## 打包与验证

MCP Pack 升级为 `1.3.0-openxnet.1.0.2`：

- payload 文件：838；
- payload 字节：88,811,482；
- Python 入口：`runtime/mcp-worker.exe`；
- FastAPI/Uvicorn 文件：0；
- 第三方许可证清单：已进入 manifest。

真实冻结 Pack 验证结果：

- `anyio`、`httpx`、`mcp`、`mcp-alchemy`、`pydantic`、SQLAlchemy 和五类数据库驱动均可导入；
- BrowserMCP 启动、12 个工具发现和停止通过；
- SQLite SQL MCP 启动、4 个工具发现、表清单、`SELECT` 查询和停止通过；
- SQL 工具为 `all_table_names`、`filter_table_names`、`schema_definitions` 和
  `execute_query`；
- 临时 SQLite 数据库包含的表名和值均由冻结工具调用结果验证。

回归结果：

- SQL TypeScript/Python 专项：11/11；
- MCP Worker/Broker：6/6；
- Renderer 静态架构边界：20/20；
- UTF-8、LF、Python docstring、TypeScript 函数说明和 Renderer bootstrap：通过；
- 全量架构回归：通过，耗时 `182,089 ms`。

最终 Electron 冷启动：进程 `1,749 ms`、workspace `1,471 ms`、观察窗口 `2,500 ms`。
真实旧设置中的 SQL 明文口令已迁入独立加密 sidecar；Execution Engine、Voice、Connector、
Live、MCP 和 legacy backend 均保持 stopped，SQL 支持没有增加空闲 Python 子进程。

## 后续边界

下一个域为通用 `mcpServers` 生命周期、工具发现和调用。该域必须复用当前 Worker/Broker，
但需要为每个 Server 建立独立 allow-list 配置、凭据 scope、工具归属缓存和进程环境边界，
禁止恢复 Renderer 可控的任意 command/env 执行。
