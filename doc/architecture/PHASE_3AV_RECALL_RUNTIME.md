# Phase 3AV Recall Center Runtime

## 状态

2026-07-29 完成。Desktop Recall Center 的首屏聚合、记忆搜索、时间线、Recall/Task 观察流、
中断 turn 恢复和工作区检查点回滚，不再调用 `/v1/memory/*`、`/v1/engine/*` 或
`/v1/neuro/kg/versions` legacy HTTP 路由。Renderer 通过 sender-authorized typed IPC 访问
Main，Main 只从自身无密钥设置快照注入工作区作用域，再按需激活 Memory Worker。

观察焦点发布也不再调用 `/api/overlay/observation-focus`。Main 只向已经存在的 Dynamic Island
和 Floating Task HUD WebContents 发送有界事件，不创建浮层、不启动 Python。Browser/Server 和
旧 preload 继续保留原 HTTP/WebSocket fallback。

## 调用链

```text
Desktop Renderer
  -> typed Recall preload API
  -> authorized Electron Main IPC
  -> ApplicationRecallRuntimeService
  -> Main-owned workspace/provider scope
  -> memory capability
  -> supervised Memory Worker
  -> ObservationStore / SessionMemoryProvider / EngineCheckpoint
  -> Git + File Shadow / Decision Log / Temporal KG

Desktop observation focus
  -> typed Recall preload API
  -> Electron Main
  -> existing Dynamic Island / Task HUD WebContents only

Browser / Server
  -> existing /v1/memory/*, /v1/engine/* and overlay routes
  -> FastAPI compatibility adapters
```

Recall 首屏原本并行执行六次 HTTP 请求，现在由一次 `recall.bootstrap` Worker 请求读取中断 turn、
历史、工作区检查点、决策日志、知识图谱版本和记忆概览。时间线、搜索和观察流仍保持独立 typed
命令，使页面交互可以按目标刷新而不重复读取全部首屏数据。

## Typed Contract

公开 contract 包含七条命令：

- 读取首屏聚合；
- 搜索 1 到 20 条工作区记忆；
- 读取最近、查询或锚定时间线，最多 80 条；
- 按 task、session、digest 或 query 读取最多 120 条观察记录；
- 恢复一个精确中断 turn；
- 恢复一个精确 Git 或 File Shadow 检查点；
- 向已存在的 Desktop 浮层发布最多 6 条观察摘要。

所有 Renderer 请求必须是精确对象。额外字段、控制字符、超长查询、空观察目标、未知来源、越界
数量和计数漂移都会在能力激活前被拒绝。Renderer 不能提交工作区路径、Provider 凭据、数据库
路径、Worker 方法名或 Git 命令。

## 工作区与数据边界

Main 从 `LegacyRendererStateService` 的无密钥兼容快照读取 `CLISettings.cc_path` 和
`memorySettings.workspaceProvider`。工作区路径只存在于 Main 到 Memory Worker 的内部 payload；
Worker 再次解析真实目录并拒绝缺失、非目录、NUL 或超长路径。搜索、时间线和检查点操作不能切换
到 Renderer 指定的任意目录。

Desktop Worker 的搜索只合并三个本地来源：SQLite FTS ObservationStore、
SessionMemoryProvider 和工作区 Decision Log。远程 Hindsight 继续属于 Server 兼容路由，Desktop
Worker 不接收其 API key；NeuroSymbol 和 Hindsight 也不会因此进入 Memory Pack 的静态依赖图。

检查点列表删除 `snapshot_path`、`workspace_key` 和内部 workspace 字段，只保留相对文件名、公开
描述、时间、来源、ID 和 rollback 支持状态。回滚失败不返回 Git stderr、File Shadow 绝对路径或
底层异常，只抛出固定 Runtime 错误。

## 响应与焦点安全

Main 对每个 Worker 响应执行精确顶层 schema 校验，并限制：

- 总响应最多 4 MiB；
- JSON 深度最多 8；
- 单对象最多 128 个键；
- 单数组最多 120 项；
- 单文本最多 16 KiB；
- 数字必须有限。

嵌套记录出现 API key、token、secret、password、`snapshot_path`、`workspace_key`、
`process_path`、stdout 或 stderr 字段时，整个响应会被拒绝。观察焦点从 Renderer 进入 Main 时执行
相同私有字段检查、512 KiB 预算和精确计数校验。

## Vector 延迟激活

Memory capability 的静态依赖从 `core + vector-index` 收敛为 `core`。Recall 查询只读取本地 SQLite、
JSON 和 Git 数据，不启动 Vector Worker。真正的 Mem0 搜索或写入仍通过既有 Vector Worker RPC
按请求激活 `vector-index`，原 Memory/Vector 隔离边界保持不变。

应用启动、Home、普通 Chat 和未打开的 Recall 页面不会激活 Memory Worker。Memory Worker 继续使用
5 分钟空闲回收策略；进程退出时操作系统关闭其 SQLite 连接，不写入 Core 主数据库。

## 冻结 Pack 与构建锁

Memory Pack 升级为 `1.1.0-openxnet.1.0.2`：

- payload 文件：760；
- payload 字节：83,403,982；
- Python 入口：`runtime/memory-worker.exe`；
- FastAPI/Uvicorn 文件：0；
- Recall 冻结 Worker 首次响应：`1,721 ms`；
- 综合 Memory smoke 中 Recall 首次响应：`1,606 ms`；
- Recall 后 Vector capability 保持 stopped/unavailable；
- 原 Mem0 依赖、离线搜索、Vector RPC 和 `history.db` 创建继续通过。

首次使用未锁定的全局 Conda 环境会遗漏 Mem0/Qdrant 并收集 GUI/Jupyter 模块，生成约 900 MB 的
无效产物。现已新增 `requirements-memory-build-win32.txt` 完整构建锁，构建脚本在 PyInstaller
前校验 PyInstaller、Mem0、aiosqlite 和 appdirs 的精确版本；spec 同时排除 PyQt、Tk、ZMQ、
IPython、pytest 和其他非运行时模块。冻结 Pack 必须从隔离环境构建。

## 验证

专项和完整回归结果：

- Python Memory/Recall Worker：6/6；
- TypeScript Recall contract、Runtime、IPC：5/5；
- Renderer 启动架构：31/31；
- Desktop Core：236/236；
- UTF-8、LF、Python docstring、TypeScript 函数说明和 Renderer bootstrap：通过；
- Recall 冻结 Pack smoke：通过；
- 原 Memory 冻结 Pack smoke：通过；
- 全量架构回归：通过，耗时 `170,300 ms`。

最终稳定 Electron 冷启动：process `1,820 ms`、workspace `1,549 ms`、观察窗口 `2,500 ms`。
Memory、Vector、Desktop Control、Execution Engine、Voice、Connector、Live、MCP 和 legacy backend
均保持 stopped。大型冻结构建后的首次测量出现一次已知偶发抖动，复测恢复稳定；按既定约定不作为
本阶段缺陷。

## 后续边界

Server 的远程 Hindsight 联邦、Memory 事件 SSE 和浮层 WebSocket 仍属于兼容运行时，不应进入
Desktop 冷启动。后续若迁移实时观察更新，应建立 Main/Worker typed event channel，而不是让
Desktop Renderer 恢复后端 WebSocket。

剩余高价值域包括开发工作台 snapshots/repository/code search、VR/VRM/VRMA/Gaussian 资产、
扩展与技能管理、企业控制台，以及其他 `/load_file` 通用上传路径。下一域继续按 Desktop 调用
频率、legacy 激活持续时间、依赖重量和可独立验证性排序。
