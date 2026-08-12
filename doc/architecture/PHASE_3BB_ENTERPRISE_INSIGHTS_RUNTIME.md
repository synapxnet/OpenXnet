# Phase 3BB Enterprise Insights Runtime

## 状态

2026-07-29 完成。Desktop Usage、NeuroSymbol 和 Temporal Knowledge Graph 页面不再直接调用
`/v1/usage/*` 或 `/v1/neuro/*`。Renderer 通过 7 个 sender-authorized typed IPC 通道进入 Main-owned
Enterprise Insights Runtime；Browser/Server 保留 HTTP compatibility routes。

Usage 与 Neuro/KG 使用不同所有权：Usage 是 Main 对已有 SQLite 的只读聚合；Neuro/KG 是认知执行域，
由独立 Execution Engine 继续作为单一写入者。Main 不直接修改 `neuro-symbols.json` 或
`knowledge_graph.db`，避免 Electron 和 Python 对同一数据源并发写入。

## 调用链

```text
Desktop Usage
  -> typed preload IPC
  -> Main read-only usage_tracking.db
  -> fixed SQL aggregates
  -> no capability activation

Desktop Neuro / KG
  -> typed preload IPC
  -> validated bounded request
  -> request lease
  -> authenticated private Execution Engine route
  -> SymbolStore / TemporalKnowledgeGraph single writer

Browser / Server
  -> /v1/usage/* and /v1/neuro/* compatibility routes
```

Execution Engine 只增加 6 条固定 POST 路由。Usage 路由不在引擎 allow-list 中，真实进程 smoke 对
`/v1/usage/summary` 返回 404，防止只读统计反向依赖 Python。

## Usage 边界

Main 仅在用户打开 Usage 页面时以 `readOnly` 和 1 秒 busy timeout 打开 `usage_tracking.db`。数据库缺失
等价于空面板，不创建文件；链接、非普通文件或超过 512 MiB 时拒绝。SQL 文本固定在代码中，Renderer
只能选择 `hour/day/month` 和 1 到 90 的趋势数量，不能提交 SQL、过滤表达式或数据库路径。

汇总、趋势、模型和用户分组都转换为非负安全数值。模型和用户维度各限制 500 条。Execution Engine 的
Chat 路径继续写入兼容 Usage 数据库，因此本阶段不引入第二套计量存储或跨进程写入者。

## Neuro 与 KG 边界

Neuro 公开面板、纯读取搜索、普通符号删除和睡眠维护；KG 公开有界图与实体事实查询。Renderer 不能
提交本机路径、数据库字段、Prompt、外部引用、source symbol、任意引擎路径或 HTTP 选项。

- Neuro dashboard 最多 200 个符号和 100 条规则；
- Neuro search 最多 100 个结果，搜索不会增加 `activationCount`；
- `rule-*` 内置规则在 Main 和 Engine 两层拒绝删除；
- KG graph 最多 500 条边和 1,000 个节点；
- KG entity 最多 100 条事实；
- 私有请求 64 KiB、响应 2 MiB、HTTP 操作 15 秒超时；
- 每次操作持有一个请求租约并在成功、失败或超时后释放。

私有 Python API 先做 Pydantic `extra=forbid` 校验，再投影公开字段；Main 对响应 schema、exact fields、
数量和数值范围再次校验。内部异常不会作为 Renderer 响应透传。

## 兼容修复

原 Renderer 使用 GET query 调用只接受 POST body 的 Neuro match 路由，导致搜索不可用；原 KG 页面还
调用了不存在的 `/v1/neuro/kg/graph`，实体查询也使用了错误的 query 参数形式。本阶段统一了 POST 搜索
字段、补充有界 Browser KG graph，并把实体查询改为路径参数兼容契约。

## 验证

- Main Insights Runtime 与 IPC 专项：4/4；
- 私有 Python Insights API：3/3；
- Execution Engine profile 回归：4/4；
- Renderer 架构专项：29/29；
- 真实 Electron smoke：Usage 42 tokens、6 次 Insights 请求、6 次租约释放、backend 激活 0；
- 真实 Execution Engine smoke：Neuro/KG 200、非法字段 422、未授权 401、Usage route 404；
- UTF-8、Python docstring、TypeScript 函数说明和 JavaScript/Python 语法检查：通过。

Desktop Core 主套件 238/238，扩展阶段 post-test 20/20，Renderer 总套件 35/35。全量 `npm test`
通过，耗时 `164,600 ms`。最终冷启动 process `1,583 ms`、workspace `1,322 ms`、观察窗口
`2,500 ms`；`legacy-backend` 和全部可选 capability 保持 stopped。

## 后续边界

Kernel 控制台仍是最大的 Desktop legacy HTTP/SSE 域，下一阶段迁移到 typed 请求租约与私有 Engine
路由。Execution Engine 的首次显式启动在源码 smoke 中约 25 秒；它不影响冷启动，但后续可把 Neuro/KG
拆成独立轻量 Worker Pack，前提是先定义 SymbolStore 与 Kernel 的跨进程写入协议。
