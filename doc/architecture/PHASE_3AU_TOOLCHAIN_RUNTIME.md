# Phase 3AU Toolchain Runtime

## 状态

2026-07-29 完成。Desktop 的 Node、uv 和 Docker 探测，以及 Docker 容器列表、统计、镜像拉取和
容器 start/stop/restart 操作，不再调用 `/api/node`、`/api/uv` 或 `/api/docker` legacy HTTP
路由。Renderer 通过 sender-authorized typed IPC 访问 Main 持有的 Toolchain Runtime；
Browser/Server 继续保留原 FastAPI 路由作为兼容入口。

该域直接执行本机工具，迁移重点不是引入新的常驻 Worker，而是把命令选择、参数校验、子进程
权限和公开结果收敛到 Electron Main。应用启动和普通页面初始化不会执行探测；只有用户进入相关
工具页面或发起明确操作时才会创建短生命周期子进程。

## 调用链

```text
Desktop Renderer
  -> typed Toolchain preload API
  -> authorized Electron Main IPC
  -> ApplicationToolchainRuntimeService
  -> bounded spawn(command, arguments, { shell: false })
  -> Node / uv / Docker CLI

Browser / Server
  -> /api/node, /api/uv, /api/docker compatibility routes
  -> existing FastAPI adapters
```

Toolchain Runtime 不属于 Python capability，也不持有后台端口。每个请求只执行一个固定工具和
固定参数模板；请求完成、失败或超时后子进程立即退出，不改变 Desktop 冷启动依赖图。

## Typed Contract

公开 contract 包含四类命令：

- 探测 `node`、`uv` 或 `docker`，只返回 installed 和首行有界版本文本；
- 列出最多 100 个 Docker 容器，并为运行中容器补充一次无流式 stats 摘要；
- 拉取一个精确 Docker 镜像引用；
- 对一个精确容器标识执行 start、stop 或 restart。

所有请求必须是精确对象。未知工具、未知动作、额外字段、空文本、前导选项、空白或控制字符、
路径穿越形式和超长值都会在启动子进程前被拒绝。Renderer 不能提供命令、参数数组、工作目录、
环境变量或 shell 片段。

## 子进程与凭据边界

Runtime 使用 Node `spawn` 且固定 `shell: false`、stdin ignore、隐藏 Windows 窗口。工具名只来自
`node`、`uv`、`docker` allow-list，Docker 参数只由 contract 校验后的固定模板构造，因此不存在
Renderer 控制的命令拼接或 shell 展开。

每次执行前会复制并清理子进程环境，删除：

- 所有 `OPENXNET_*` 和 `*_CREDENTIALS_B64`；
- `NODE_OPTIONS`、`NODE_PATH`；
- 所有 `UV_*`、`PIP_*` 和 `NPM_*`；
- 名称匹配 API key、access/auth token、token、secret 或 password 的变量。

该清理不修改 Electron Main 自身环境。Toolchain 子进程不能继承 OpenXnet 凭据包、Provider
密钥或包管理器注入选项。

## 预算与公开错误

stdout 与 stderr 合计最多 2 MiB，超限会终止子进程。Node、uv、Docker 版本探测超时为 5 秒，
Docker ps 和一次性 stats 超时为 8 秒；pull、start、stop、restart 分别使用有界写操作预算。

公开结果不包含可执行文件路径、stdout、stderr、环境变量或原始 Docker 错误。探测失败返回
`installed: false`；Docker 列表在命令缺失时返回未安装和空列表，其他执行失败只向 Renderer
抛出固定脱敏错误。Main 日志仅记录操作级固定诊断。

## Renderer 与兼容边界

Desktop Vue 方法优先检查完整 typed API，再执行探测、列表或写操作。只有 Browser/Server 或
旧 preload 不具备该 API 时才调用原 HTTP 路由。兼容 fallback 不会改变 Desktop 新路径的命令
边界，也不会在应用挂载时自动探测工具。

容器结果在 Runtime 内转换为固定摘要，状态映射为 `active`、`maintenance` 或 `gray`。公开列表
只包含 ID、名称、镜像、状态、端口、CPU 和内存摘要，既不返回 Docker 原始 JSON，也不暴露
本机执行细节。

## 验证

专项与真实只读 smoke 结果：

- TypeScript contract、Runtime、IPC：7/7；
- Renderer 启动架构：30/30；
- Desktop Core：231/231；
- UTF-8、LF、Python docstring、TypeScript 函数说明和 Renderer bootstrap：通过；
- 真实 Toolchain smoke 总耗时 `2,645 ms`；
- Node `v24.13.0`，uv 未安装，Docker `29.5.2`；
- 读取 9 个 Docker 容器及一次性 stats；
- smoke 未执行镜像拉取或容器写操作；
- 全量架构回归：通过，耗时 `149,574 ms`。

最终 Electron 冷启动：process `1,760 ms`、workspace `1,479 ms`、观察窗口 `2,500 ms`。
Desktop Control Worker、Execution Engine、Voice、Connector、Live、MCP 和 legacy backend 均保持
stopped，工具链迁移没有增加空闲 Python 进程或启动期 CLI 子进程。

## 后续边界

Toolchain Runtime 只负责固定本机工具操作，不扩展为通用终端、脚本执行器或任意进程代理。
后续新增工具必须单独定义 typed contract、固定参数模板、公开结果 schema、超时和输出预算，并
证明不会扩大凭据继承范围。

剩余高价值域继续按 Desktop 调用频率、legacy 激活持续时间、依赖重量和可独立验证性排序，
优先盘点 Recall/Memory 页面、开发工作台 snapshots/repository/code search、VR 资产、扩展与技能
管理、企业控制台及其他 `/load_file` 通用上传路径。
