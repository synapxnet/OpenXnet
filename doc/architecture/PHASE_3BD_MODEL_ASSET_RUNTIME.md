# Phase 3BD Model Asset Runtime

## 状态

2026-07-30 完成。Desktop Sherpa 与 MiniLM 模型状态、下载、删除和下载进度不再调用
`/sherpa-model/*`、`/minilm-model/*`、`/minilm/reload` 或 EventSource。Renderer 通过 sender-authorized
typed IPC 进入 Main-owned Model Asset Runtime；Browser/Server 保留原 HTTP/SSE compatibility routes。

Voice Pack 和 Vector Pack 继续拥有模型加载与推理，Main 只拥有外部模型资产的安装生命周期。模型文件
不打入 Feature Pack：它们仍位于用户数据 `asr` 和 `ebd` 目录，可独立更新；Pack 只包含受签名清单保护
的 Worker 运行时和依赖。

## 调用链

```text
Desktop Renderer
  -> get/download/removeApplicationModelAsset
  -> sender-authorized Main IPC
  -> fixed kind/source contract
  -> Main download + SHA-256 + exact byte count
  -> stop Voice or Vector Worker before mutation
  -> atomic directory replacement

Desktop progress
  <- bounded typed IPC events

Browser / Server
  -> legacy model HTTP + SSE compatibility routes
```

状态读取只检查 Main-owned 文件和安装 manifest，不启动 Python、Voice Worker 或 Vector Worker。首次遇到
没有 manifest 的旧模型目录时，会按固定版本做大小和 SHA-256 识别；识别成功后补写 manifest，失败则
标记 `damaged`，不会把未知 ONNX 文件当作已安装。

## 固定供应链

Renderer 只能提交 `kind = sherpa|minilm` 和 `source = modelscope|huggingface`，不能提交 URL、commit、
文件名、目录、大小或哈希。四个源版本都固定到不可变 commit：

- Sherpa ModelScope `73eca47697f980daa3d16112404174b6b950b514`；
- Sherpa Hugging Face `355f4d4884d8afd08aef04b9007a8556d7b463b2`；
- MiniLM ModelScope `3d26be06a662164d54f7ffe720321c69d67b3766`；
- MiniLM Hugging Face `e8f8c211226b894fcb81acc59f3b34ba3efd5f42`。

每个 ONNX/tokenizer 文件都有固定字节数和 SHA-256。MiniLM 两个源内容一致；Sherpa 两个源是两个独立
受支持版本。下载只接受 HTTPS（测试可显式开启 loopback HTTP），拒绝凭据 URL，最终响应必须符合固定
大小和哈希。

## 原子安装

下载写入模型根目录下唯一 `.downloading-*` 暂存目录，单个文件使用独占创建并在完成后 `sync`。全部文件
通过大小和哈希校验后写入 UTF-8 manifest。提交前 Main 停止 `voice` 或 `vector-index` Worker，再执行：

```text
existing target -> .replacing-* backup
verified staging -> target
delete backup
```

任一步骤失败都会删除新目标并恢复 backup。哈希失败发生在 Worker 停止和目录替换之前，因此现有可用
模型保持不变。删除也先停止对应 Worker，再把目标重命名为 `.removing-*` 后递归删除。每个模型种类只
允许一个并发 mutation。

MiniLM 不再需要 Desktop `/minilm/reload`：原子替换前 Vector Worker 已停止，下一次真实向量请求会按
原有按需激活规则加载新模型。

## 进度边界

Main 发布 `preparing/downloading/verifying/installing/completed/failed` 六个固定阶段。事件只包含 operation
ID、kind/source、百分比、已传输/总字节、当前固定文件名和公开错误码；不包含下载 URL、磁盘路径、
redirect、HTTP header 或底层异常。进度按百分比和 100 ms 时间窗口节流，Renderer 取消订阅不会中止
下载或影响其他窗口。

Desktop bridge 缺失时明确报告模型管理不可用，不回退旧 HTTP。Browser 分支仍保留原 SSE 行为。

## 验证

- Model Asset contract、Runtime 和 IPC：5/5；
- Renderer 架构与启动套件：37/37；
- 哈希替换失败保留原安装、非法字段零网络/零 Worker、原子删除：通过；
- 真实 Electron smoke：2 个固定文件、8 个进度事件、下载/删除两次 Worker mutation、backend 激活 0；
- UTF-8、Python docstring、TypeScript 函数说明和 Renderer 预编译检查：通过。

Desktop Core 基础套件 238/238，扩展阶段 post-test 20/20。全量 `npm test` 通过，耗时
`158,972 ms`。最终冷启动 process `1,628 ms`、workspace `1,297 ms`、观察窗口 `2,500 ms`；
`legacy-backend`、Execution Engine 和全部可选 capability 保持 stopped。

## 后续边界

继续审计旧 Agent/MCP/工作流/Memory 工具页，以及少量 TTS、模型列表和文件兼容路径。已迁移模块中的
Browser fallback 不计为 Desktop 遗留；后续按页面实际入口和 Gateway 激活记录确定迁移优先级。
