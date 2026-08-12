# Phase 3AX Developer Workbench Runtime

## 状态

2026-07-29 完成。Desktop 开发工作台的概览、仓库摘要、代码搜索、快照生命周期、工作区应用和
默认 Agent 映射不再调用 `/v1/dev/workbench/*` 兼容路由。Renderer 通过 typed preload API 进入
Electron Main 持有的 TypeScript Runtime；Browser/Server 继续保留原 FastAPI 路由。

本阶段没有新增 Python Worker、Feature Pack 或基础依赖。打开开发工作台、扫描仓库、搜索代码和
管理快照都不会启动 `legacy-backend`。

## 调用链

```text
Desktop Renderer
  -> typed preload API
  -> sender-authorized Main IPC
  -> ApplicationDeveloperWorkbenchRuntimeService
  -> Main 持有的无密钥设置快照 / Core Task 摘要 / 本地文件系统

Browser / Server
  -> /v1/dev/workbench/*
  -> FastAPI compatibility routes
```

Desktop Renderer 暴露 11 个精确方法：

- 读取工作台概览；
- 列出当前设置中的仓库；
- 在当前工作区中搜索代码；
- 列出、创建、导入、读取、恢复和删除快照；
- 应用原生对话框授权的工作区；
- 应用已注册的默认 Agent 映射。

Desktop 环境只有在 11 个方法全部存在时才认为 Runtime 可用。任一方法缺失会直接显示 Runtime
不可用，不会降级请求 Python；非 Electron 的 Browser/Server 环境才进入 HTTP fallback。

## 设置与任务边界

Runtime 只读取 Main 持有的 `LegacyRendererStateService` 无密钥快照，并通过同一状态边界写回当前
兼容设置。工作台概览聚合：

- CLI 工作区、引擎、权限和可见范围；
- Provider 配置状态和已注册 Agent 摘要；
- Core 持久任务中的开发工作台任务统计；
- 固定的 Plan、Review、Diff 和 Patch 模板；
- 当前配置阻塞项和警告。

Renderer 不能向概览或搜索请求注入工作区根目录。Runtime 始终从 Main 设置快照读取当前根目录，
任务摘要也只按该规范化路径查询。远端 OpenXnet-Server Provider 管理仍属于 Server/企业控制台，
没有并入本地 Runtime。

## 仓库与代码搜索预算

仓库摘要和代码搜索使用异步 Node 文件 API，不执行 shell、Git 命令或 Python：

- 仓库摘要最多遍历 200,000 个普通文件；
- 搜索最多检查 50,000 个普通文件；
- 单个搜索文件最多 1 MiB；
- 单次搜索累计读取最多 256 MiB；
- 单次搜索最多运行 15 秒并返回最多 100 个结果；
- 扫描定期让出事件循环，避免长目录阻塞 Main；
- 符号链接和依赖、构建、缓存、快照等目录被忽略；
- 返回路径始终相对工作区，文件内容预览最多 240 字符；
- 命中 token、password、API key 等敏感赋值行时只返回 `[redacted sensitive line]`。

单个文件或目录在扫描期间消失、不可读或无权限时会被跳过；整体预算耗尽时返回 `truncated`，不会
扩大预算或回退到兼容后端。

## 快照安全与生命周期

快照保存在应用用户目录的 `dev_workbench_snapshots`，不写入工作区。单个 JSON 文档最多 8 MiB，
列表最多返回 500 条。写入使用临时文件和原子改名，ID 与文件名经过固定格式校验。

创建快照只复制用户选中的角色、会话、工具和技能字段，并递归剥离 credential 字段。导入快照在
写盘前递归拒绝 token、password、secret、authorization、cookie 和 API key 等字段，结构深度、
JSON 体积或 schema 非法时也直接失败。读取、恢复和删除只接受稳定快照 ID，不接受任意路径。

恢复通过状态边界写回设置和可选会话，不覆盖技能目录或技能 ID。快照操作进入一个串行队列，防止
并发创建、恢复和删除发生状态竞争。

## 工作区与映射授权

工作区变更必须先经过 Electron 原生目录对话框。Main 记录最多 4,096 个目录授权，应用请求中的目录
必须与授权结果精确一致；Renderer 手工构造的字符串路径不能通过 typed IPC。Runtime 随后再次要求
目录存在、为普通目录且不是符号链接，并把规范 `realpath` 写入设置。

Agent 映射只接受已存在于 Main 设置快照中的 Agent ID，并同步当前模型和选中 Provider 的模型列表。
未知 Agent、额外字段或未要求同步的请求在写设置前失败。

## 验证

专项与完整回归结果：

- Developer Workbench Runtime 与 IPC：3/3；
- Renderer 启动架构：32/32；
- Desktop Core 主套件：237/237，随后专项 post-test 3/3；
- UTF-8、LF、Python docstring、TypeScript 函数说明和 Renderer bootstrap：通过；
- 真实 Electron smoke：中文源码 `src/源码.ts`、敏感行脱敏、快照生命周期、导入拒密、Agent 映射和
  授权工作区应用均通过；
- Electron smoke 中 legacy backend 激活次数为 0；
- 全量 `npm test`：通过，耗时 `153,800 ms`。

最终 Electron 冷启动：process `1,640 ms`、workspace `1,425 ms`、观察窗口 `2,500 ms`。
legacy backend 和全部可选 capability 保持 stopped，工作台 Runtime 没有增加启动期进程。

## 后续边界

Browser/Server 的开发工作台兼容路由继续保留，不在本阶段删除。本地 Provider 配置继续复用既有
Provider typed IPC；Server Gateway Provider 的验证与保存仍属于远端管理边界。

下一阶段先重新审计剩余 Desktop HTTP 调用的真实使用入口和激活成本，再按独立域迁移 VR 资产、
扩展/技能管理或企业控制台。每个域继续执行 typed contract、最小依赖、真实 smoke、全量回归和
冷启动封板。
