# Phase 3BC Kernel Runtime

## 状态

2026-07-30 完成。Desktop Kernel 控制台、计划检查器、审批中心、实时指导、配置意图和技能生命周期
不再直接调用 `/v1/kernel/*` HTTP 或 SSE。Renderer 只通过一个 sender-authorized typed IPC 通道提交
固定 `operation` 和结构化载荷；Browser/Server 继续保留原 HTTP 与 SSE compatibility routes。

Kernel 状态仍由独立 Execution Engine 单一持有。本阶段没有在 Main 重写 Kernel 存储，也没有引入第二个
计划、追踪、审批或审计写入者。Main 只负责验证、认证、请求租约、响应大小和 IPC 发送者边界。

## 调用链

```text
Desktop Renderer
  -> invokeApplicationKernel({ operation, payload })
  -> sender-authorized Main IPC
  -> exact operation payload validation
  -> request lease
  -> POST /v1/desktop/kernel/command
  -> authenticated Execution Engine dispatcher
  -> existing Kernel domain services

Browser / Server
  -> fixed /v1/kernel/* compatibility routes
  -> EventSource /v1/kernel/events
```

Execution Engine 只新增一条固定私有 POST 路由。旧 `/v1/kernel/*` 路由不在 Engine allow-list 中；
精确 profile smoke 会比较完整路由集合，防止以后误注册兼容 Router。

## 操作契约

Desktop 公开 31 个固定 operation，覆盖状态、运行模式、控制板、动作队列、事件摘要、计划控制/时间线/
运行记录/恢复、审批、审计、追踪、世界状态、计划生成、步骤契约/恢复/执行、技能生命周期、实时指导和
配置意图。Renderer 不能提交 URL、HTTP 方法、endpoint、Host、认证头、引擎 Origin 或本机路径。

- 外层命令只允许 `operation` 和 `payload`；
- 每个 operation 在 Main 与 Engine 两层执行 `extra fields` 拒绝；
- 稳定 ID 禁止路径字符，最大 192 字符；
- 消息最多 200 条，单条内容最多 32,000 字符；
- 工具参数和配置意图限制深度、字段数、数组数量、字符串长度和危险原型键；
- 请求最大 256 KiB，响应最大 4 MiB，私有 HTTP 超时 20 秒；
- 每次调用持有一个短租约，成功、422、传输失败或超时后都释放；
- Pydantic operation 载荷错误转换为固定 422，不返回内部 ValidationError；
- Engine 输出递归脱敏明显密钥，并限制深度、集合和文本大小；Main 再验证 schema、operation 和 JSON。

## Renderer 事件策略

Desktop 不再创建 Kernel `EventSource`。控制台和日志在页面活跃时通过 `event-status` operation 做短轮询，
只在事件游标变化时刷新聚合数据；审批中心保留原 60 秒 typed 读取。关闭页面会幂等清理轮询和游标。

Browser 保留原 SSE 体验。全部 Browser HTTP fallback 集中在 `invokeBrowserKernelOperation` 的固定 switch
中；Desktop bridge 缺失时不会回退 HTTP，因此不会意外激活 `legacy-backend`。

检查器现在保存 `{ operation, payload }`，动作弹窗保存固定 action operation、plan/step/trace ID 和治理
字段；不再保存或执行动态 URL、endpoint 和 HTTP method。

## 路由加载修复

原 `py.routes` 包在初始化时导入全部兼容路由。Execution Engine 仅引用 Kernel 模块也会加载 TTS、MCP、
企业等无关 Router。聚合器已改为函数内懒导入：Server 调用配置/注册函数时仍加载完整兼容集合，Engine
只加载私有 Kernel 所需模块，避免把旧路由依赖带入按需进程。

## 验证

- Kernel TypeScript contract、Main Runtime 和 IPC：5/5；
- 私有 Python Kernel dispatcher：3/3；
- Renderer 架构与启动套件：36/36；
- Desktop Core 基础套件：238/238；
- 扩展阶段 post-test：20/20；
- 真实 Electron smoke：7 次命令、7 次租约、7 次释放、backend 激活 0；
- 真实 Execution Engine smoke：Kernel 200、非法载荷 422、未授权 401、未知路由 404；
- 三 profile 精确路由 smoke：通过，Engine 只增加 `/v1/desktop/kernel/command`。

全量 `npm test` 通过，耗时 `149,201 ms`。最终冷启动 process `1,711 ms`、workspace
`1,352 ms`、观察窗口 `2,500 ms`；`legacy-backend`、Execution Engine 和全部可选 capability 保持
stopped。大型构建后的偶发启动抖动继续按既定约定不计为缺陷，确定性预算或能力激活失败才阻断阶段。

## 后续边界

下一阶段重新审计 Desktop 源码中的剩余 HTTP/WebSocket。仅迁移 Desktop 实际会执行且会激活 Python 的
调用；已经受 `openxnetDesktop` 分支保护的 Browser fallback 不计为遗留。优先检查 Sherpa/MiniLM 模型
下载事件、旧 Agent/MCP/工作流/Memory 工具页以及少量 TTS、模型和文件兼容路径。
