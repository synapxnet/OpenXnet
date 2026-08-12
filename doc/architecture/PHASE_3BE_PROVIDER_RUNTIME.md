# Phase 3BE Provider Runtime

## 状态

2026-07-29 完成。Desktop LLM 工具模型发现和角色记忆向量维度探测不再调用
`/llm_models` 或 `/api/embedding_dims`。Renderer 通过 sender-authorized typed IPC 进入 Main-owned
Provider 边界；Main 使用安全存储中的 Provider 凭据直接访问 OpenAI-compatible 接口，不启动
`legacy-backend`、Execution Engine 或可选 Python Worker。Browser/Server 保留旧 HTTP compatibility routes。

## 调用链

```text
Desktop LLM tool model discovery
  -> validateApplicationProvider(exact draft)
  -> sender-authorized Main IPC
  -> bounded GET {provider-base}/models
  <- redacted model identifiers and validation checks

Desktop memory embedding probe
  -> probeApplicationProviderEmbedding({ providerId })
  -> sender-authorized Main IPC
  -> resolve saved metadata + Main-only safeStorage credential
  -> bounded POST {saved-provider-base}/embeddings
  <- { providerId, modelId, dimensions }

Local packaged MiniLM
  -> fixed known dimensions = 384

Browser / Server
  -> legacy /llm_models and /api/embedding_dims compatibility routes
```

模型发现沿用现有 Provider 草稿校验能力，因为新建 LLM 工具时密钥本来就是当前 Renderer 表单输入；
IPC 接受精确字段，结果不返回密钥。角色记忆探测只接受已保存 `providerId`，Renderer 不能提交 URL、
模型或密钥，Main 从同一条已保存记录同时解析 URL、模型和凭据，避免跨 Provider 凭据重放。

## 网络边界

- Provider URL 继续由严格 HTTP/HTTPS URL parser 验证，禁止 URL 内嵌用户名或密码；
- 请求禁用 redirect，超时为 10 秒；
- `/models` 和 `/embeddings` 响应均限制为 1 MiB；
- 向量长度必须处于 `1..65536`，响应格式异常直接失败；
- 非本地 Provider 缺少安全凭据时拒绝探测；本地 loopback Provider 可按既有策略无密钥运行；
- 上游响应正文、请求 header、URL 和底层密钥不会进入公开探测结果；
- Provider 被删除、禁用或缺少 URL/模型时，在网络访问前失败。

Desktop bridge 缺失时明确报告能力不可用，不回退到旧 Python HTTP。Browser 分支仍保留原请求，保证
独立 Server 部署兼容。已知的 `paraphrase-multilingual-MiniLM-L12-v2` 维度固定为 384，不再为常量事实
启动 Vector Worker 或 backend；真正的 MiniLM 推理仍由按需 Vector Worker 拥有。

## 验证

- Provider Service 与 sender-authorized IPC：7/7；
- Renderer 启动与 Desktop/Browser 分支架构测试：38/38；
- TypeScript 编译、UTF-8/LF、缩进、函数说明和架构标准检查：通过；
- 真实 Electron smoke：2 个 Main-owned Provider 请求、向量维度 4、密钥回传 0、backend 激活 0。

Desktop Core 239/239，扩展阶段 post-test 20/20。全量 `npm test` 通过，耗时 `186,700 ms`。
最终冷启动 process `1,568 ms`、workspace `1,312 ms`、观察窗口 `2,500 ms`；`legacy-backend`、
Execution Engine 和全部可选 capability 保持 stopped。

## 后续边界

继续迁移旧 Agent/A2A、Workflow 和 Memory 管理页。Provider 模型卡片已有 typed Main 分支，Recall、
Knowledge Base 和 Memory Worker 的已迁移路径不重复改造；只处理仍会在 Desktop 入口实际命中的旧调用。
