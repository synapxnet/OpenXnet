# Phase 3BF Agent And Workflow Runtime

## 状态

2026-07-29 完成。Desktop Agent 创建/删除、A2A Agent Card 发现和 ComfyUI Workflow 文件生命周期
不再调用 `save_agent` WebSocket、`/remove_agent`、`/a2a`、`/add_workflow` 或
`/delete_workflow/*`。Browser/Server 保留原 compatibility transports。

本阶段没有引入统一文件或网络代理：Agent 使用专用 Main Runtime，A2A 使用固定 Card 发现协议，
Workflow 复用已经存在的 Core Artifact。三类操作都不启动 `legacy-backend`、Execution Engine 或
可选 Python Worker。

## 调用链

```text
Desktop Agent create/remove
  -> create/removeApplicationAgent
  -> sender-authorized Main IPC
  -> fixed userData/agents/{agentId}.json
  -> Legacy Renderer State atomic settings write

Desktop A2A discovery
  -> inspectApplicationA2a({ url })
  -> sender-authorized Main IPC
  -> bounded standard Agent Card GET
  <- redacted public card

Desktop Workflow import/delete
  -> preload-owned File -> Core Artifact import
  -> settings retain stable artifact_id + legacy workflow metadata
  -> Core Artifact tombstone deletion

Browser / Server
  -> legacy WebSocket and HTTP compatibility transports
```

## Agent 快照

Renderer 只能提交 `name` 和 `systemPrompt`，不能提交 ID、文件名、目录或 `config_path`。Main 生成
8 位稳定随机 ID，将当前无密钥设置快照先写入独占临时文件，再原子重命名到
`userData/agents/{id}.json`，最后提交 Agent 元数据。设置写入失败时清理新快照。

删除只接受 `[A-Za-z0-9_-]` Agent ID。Main 先把固定快照重命名为 `.removing`，再提交设置；提交失败
会恢复文件，成功后删除暂存。公开结果不包含绝对路径。Python compatibility 读取同时收紧：空
`config_path` 会按 Agent ID 推导固定文件，旧 `config_path` 只有仍位于 `AGENT_DIR` 根目录且为普通
文件时才可读取，不能指向任意文件。

快照和设置统一 UTF-8、LF，单份上限 16 MiB，Agent 总数上限 512；名称 256 字符，系统提示词
128 KiB。后续 Provider 密钥仍由对应安全存储在运行时注入，不写入 Agent 快照。

## A2A 边界

远程端点必须使用 HTTPS；HTTP 仅允许 `127.0.0.1`、`localhost` 或 `::1`。URL 禁止用户名、密码、
query 和 fragment。Main 按现有 `python-a2a` 兼容顺序探测：

1. `/.well-known/agent.json`；
2. `/agent.json`；
3. `/a2a/agent.json`。

每次操作共享 10 秒截止时间，禁用 redirect，单个响应限制 1 MiB，只接受 JSON。Renderer 只得到
name、description、version 和最多 64 个有界 skill；authentication、provider、header、响应正文和
底层异常不回传。

## Workflow Artifact

Workflow JSON 由 preload 从真实 `File` 提取受限路径或最多 32 MiB 内联字节，Core Artifact 写入
`uploaded_files/{artifact-id}.json` 并生成 SHA-256 和稳定 Artifact ID。兼容 workflow metadata 保存
`artifact_id`，ComfyUI 工具继续使用不含扩展名的 `unique_filename` 读取同一固定文件。

删除优先使用记录中的 `artifact_id`；旧 Workflow 没有 ID 时只通过 Core Artifact catalog 的精确
storage name 补齐，不让 Renderer 提交路径。删除保留墓碑供历史引用。Desktop bridge 缺失时明确失败，
不会回退 Python；Browser 仍保留 multipart 和 delete route。

## 验证

- Agent contract、Runtime 与 sender-authorized IPC：5/5；
- Renderer 启动与 Desktop/Browser 分支架构测试：39/39；
- Python compatibility 编译、UTF-8/LF、缩进和函数说明检查：通过；
- 真实 Electron smoke：A2A 请求 1、Workflow Artifact 1、Agent 快照残留 0、私有字段回传 0、
  backend 激活 0。

Desktop Core 239/239，扩展与 Agent post-test 25/25。全量 `npm test` 通过，耗时
`189,100 ms`。最终冷启动 process `1,704 ms`、workspace `1,380 ms`、观察窗口 `2,500 ms`；
`legacy-backend`、Execution Engine 和全部可选 capability 保持 stopped。

## 后续边界

下一阶段迁移旧 `/memory/{id}` 表格查看、编辑、行删除和 `/remove_memory`。这些操作属于已提取的
Memory/Vector Worker，不由 Agent Runtime 或 Main 文件 API 接管。
