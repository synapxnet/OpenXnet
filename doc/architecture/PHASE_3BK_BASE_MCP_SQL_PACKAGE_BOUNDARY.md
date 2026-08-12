# Phase 3BK Base MCP SQL Package Boundary

## 状态

2026-07-30 完成。Desktop 的 SQL MCP 运行时在 Phase 3AQ 已迁移到独立 MCP Worker，本阶段
进一步完成基础包物理去重：共享 `server/execution-engine` 目录不再包含 MCP SQL Server、
SQLAlchemy、Greenlet 或数据库驱动。Browser/Server 源码运行时的 compatibility routes 保持
原逻辑，仍可从完整 Python 环境按需加载本地 SQL MCP 实现。

本阶段没有移除基础包中的通用 MCP Client 和 FastAPI-MCP。它们仍被 `server.py` 的通用 MCP
兼容初始化和 Server profile 挂载引用，需要在后续阶段完成 profile 延迟加载后再物理排除。

## 所有权边界

```text
Desktop SQL MCP lifecycle and tools
  -> typed Main runtime
  -> private MCP Tool Broker
  -> authenticated MCP Worker RPC
  -> Pack-owned SQL Server / SQLAlchemy / database driver

Browser / standalone Server source fallback
  -> compatibility HTTP route
  -> local MCP runtime from the complete Server environment
```

基础 `server.spec` 不再自动收集 `py.workers.mcp_worker`，并显式排除：

- `mcp_alchemy`；
- `sqlalchemy` 与 `greenlet`；
- `oracledb`；
- `psycopg2`；
- `pymssql`；
- `pymysql`。

这些依赖仍由 `requirements-mcp.txt` 和 `mcp-worker.spec` 固定声明，独立 MCP Pack 保留全部 SQL
方言和驱动。仓库源代码扫描确认除 `py.mcp_runtime` 的 SQL URL 构造与
`py.workers.mcp_worker` 的 SQL Server 入口外，没有基础业务模块直接导入上述依赖。

## 体积证据

Windows x64 基础目录使用同一 Python 3.12.9、PyInstaller 6.19.0 环境重建：

- 调整前：2,918 个文件，237,300,327 字节；
- 调整后：2,903 个文件，218,523,973 字节；
- 本阶段减少：18,776,354 字节（17.91 MiB，7.91%）；
- 相对 Phase 3BJ 审计前原始基线累计减少：253,187,092 字节（241.46 MiB，53.67%）；
- SQL Worker、ORM、驱动文件名扫描：0 命中；
- Voice/FFmpeg 禁止项复扫：0 命中。

## 验证

- MCP Runtime、Worker 与私有 Broker 专项测试：8/8；
- Python 编译与 UTF-8/函数说明规范检查：通过；
- 冻结 `server.exe`：`/health` 返回 `{"status":"ok"}`，SQL 依赖诊断 0；
- 冻结 `execution-engine.exe`：认证和精确路由 smoke 通过，启动 6,140 ms；
- MCP Feature Pack `1.4.0-openxnet.1.0.2`：839 个文件、88,977,966 字节；
- 冻结 MCP Pack smoke：依赖完整，外部 Chrome 12 个工具，SQL 4 个工具且 SQLite 查询通过，
  通用 Streamable HTTP MCP 调用与凭据脱敏通过。

Execution Engine 的单次 6,140 ms 结果只用于冻结产物可启动性，不替代 Electron 冷启动指标。
用户已明确偶发慢启动不纳入当前缺陷，本阶段也不据此建立性能问题。

## 后续边界

下一阶段迁移基础包中的 MCP transport 本体：`server.py` 的通用 MCP 初始化和 `FastApiMCP`
挂载必须只在显式 Server profile 延迟加载，Desktop 与 Execution Engine 继续使用私有 Tool
Broker。完成后才能从基础 Analysis 排除 `py.mcp_clients`、`py.mcp_runtime`、`fastapi_mcp` 和
MCP SDK，并重新验证 Browser/Server 源码回退与冻结 Desktop 路由隔离。
