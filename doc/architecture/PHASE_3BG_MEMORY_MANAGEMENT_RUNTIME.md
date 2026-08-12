# Phase 3BG Memory Management Runtime

## 状态

2026-07-29 完成。Desktop Memory 表格查看、编辑、单行删除和集合删除不再调用
`/memory/{id}`、`/memory/{id}/{index}` 或 `/remove_memory`。Browser/Server 保留原 compatibility
transports。

本阶段没有把向量存储移入 Main：Main 只负责 sender 授权、typed contract 校验和 Worker 生命周期调度；
Memory Worker 继续拥有 Mem0 实例、metadata 与 history，Vector Worker 继续拥有向量文件。列表、更新和删除
使用稳定 `recordId`，不再把可变数组下标当成记录身份。

## 调用链

```text
Desktop Memory list/update/delete/remove collection
  -> applicationMemoryManagement typed preload API
  -> sender-authorized Main IPC
  -> Application Memory Management Runtime
  -> Memory Worker management RPC
  -> Vector Worker row/collection mutation when required

Browser / Server
  -> legacy HTTP compatibility transports
```

## 稳定记录身份

Memory Worker 从 metadata 的 `id` 字段投影稳定 `recordId`，并继续返回 `index` 作为只读显示位置。Renderer
打开编辑状态时保存 `recordId`，更新与删除均提交该 ID；即使列表排序或内容发生变化，也不会误操作原下标
对应的另一条记录。输入 ID、文本和集合名均经过 typed contract 的长度与格式约束。

旧的 `addVectorRow()` GET 写入路径已删除。Desktop bridge 缺失时明确失败，不会静默回退 Python；Browser
仍使用现有 HTTP 路由，以保持 Server 部署兼容。

## Worker 所有权

Memory Worker 负责把稳定 ID 解析为当前 metadata 记录，并协调更新或删除操作。删除单行时由 Memory Worker
调用 Vector Worker 删除对应向量，再提交 metadata 变更；删除整个集合时先释放缓存中的 Mem0 实例，再删除
向量集合、metadata 和 history，避免 Windows 文件句柄阻止清理。

Main 在调用 Worker 前检查固定 Memory 集合目录。目录不存在时，列表直接返回空结果，删除集合返回幂等
完成结果，Memory Worker 与 Vector Worker均不激活。这条零激活路径避免仅打开管理界面就承担 Python 启动
成本。

## Feature Pack

Memory Worker 合约随管理 RPC 提升为 `1.2.0`。冻结 Pack
`1.2.0-openxnet.1.0.2-win32-x64` 包含 1,452 个文件、192,000,543 字节，入口为独立
`runtime/memory-worker.exe`。

冻结 Pack smoke 使用真实可执行文件完成 Recall、timeline、status、search、release、记录 list/update 和
集合 remove；更新前后保持稳定 ID `record-one`，Recall 启动后 Vector Worker 状态为 stopped，集合删除后
history 清理语义通过验证。

## 验证

- Memory Management contract、Runtime 与 sender-authorized IPC：5/5；
- Renderer Desktop/Browser 分支架构测试：1/1；
- Python Worker 集合生命周期：1/1；
- UTF-8/LF、缩进和函数中文说明检查：通过；
- 真实 Electron smoke：请求 4、稳定 ID `record123`、Memory 激活 4、backend 激活 0；
- 冻结 Memory Pack `1.2.0` smoke：通过，Recall 启动 `2,136 ms`，Vector 保持 stopped。

Renderer 40/40，Desktop Core 239/239，扩展 post-test 30/30，Memory Worker 7/7。全量
`npm test` 通过，耗时 `190,800 ms`。最终冷启动 process `1,843 ms`、workspace `1,550 ms`、
观察窗口 `2,500 ms`；`legacy-backend`、Execution Engine 和全部可选 capability 保持 stopped。

## 后续边界

继续审计 Renderer 中剩余 Desktop HTTP/WebSocket 调用，优先确认 TTS 状态、声音列表和文件/音频路径操作
是否都已进入 Voice、Artifact 或其他 typed Runtime。带有明确 `!isElectron` 分支的 Browser/Server fallback
保留，不计作 Desktop 遗留。
