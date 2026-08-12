# Phase 3AL Desktop ASR Typed IPC

## 状态

2026-07-29 完成。桌面 Renderer 的 VAD 和 PTT 录音不再连接 `/ws/asr`，因此启用
桌面 ASR 不再激活 `legacy-backend`。Browser/Server 模式继续使用原 WebSocket，
Web Speech API 路径保持不变。

## 调用链

```text
Renderer microphone / VAD / PTT
  -> 16kHz WAV Blob
  -> typed preload IPC（ArrayBuffer，最大 25 MiB）
  -> sender-authorized Main handler
  -> ApplicationVoiceRuntimeService
  -> renderer-input-* 私有 artifact
  -> voice.transcribe-configured
  -> Voice Worker
  -> 有界最终文本
  -> Renderer 统一 handleASRResult
```

音频不再经过 Base64 或 JSON。IPC 只承载一个受信任 Renderer 产生的有界
`ArrayBuffer`，Main 立即复制到 `runtime/voice-exchange`，后续跨进程边界仍只使用文件
引用。Worker 成功、失败或响应无效时，Main 都会删除输入文件。

## Contract

`openxnet:application-voice-runtime:transcribe` 是唯一新增通道。请求必须精确包含：

- `audio`：非空 `ArrayBuffer` 或其 view，最大 25 MiB；
- `format`：`wav/mp3/flac/ogg/m4a/opus/aac` 之一。

Renderer 不能提交 ASR 设置、Provider ID、供应商地址或凭据。Main 从无密钥
`LegacyRendererState` 快照读取当前 `asrSettings`，最大 2 MiB，并由 Voice Worker
进程环境补齐 Voice/Provider 凭据。

响应只包含最多 100,000 字符的最终文本和最多 64 字符的引擎名。Worker 原始异常在
Service 中替换为固定 `Desktop voice transcription is unavailable.`，Renderer 只显示
已有的通用转写失败提示。

## 行为兼容

桌面 OpenAI、Sherpa 和 FunASR offline 行为保持最终结果语义。FunASR `online/2pass`
在桌面端暂时收敛为语音结束后的 offline 最终结果，不再推送逐帧中间文本；自动发送、
唤醒词、结束词、30 秒免唤醒窗口、TTS 打断和 PTT 自动发送继续复用
`handleASRResult`。

Browser/Server 分支仍初始化 `/ws/asr`，仍可使用原 FunASR 中间结果。此兼容路由不再
属于桌面迁移阻塞项。

## 安全边界

- IPC handler 在解析音频前验证 sender；
- 请求拒绝额外字段、未知格式、空音频和超限音频；
- artifact 使用 UUID 文件名、`wx` 独占创建和 `0600` 权限；
- Renderer 不接收 Voice/Provider 凭据、Worker origin 或 Worker token；
- Main 不记录音频、转写文本、设置或供应商异常；
- 失败路径测试验证输入文件已删除且供应商异常文本未跨 IPC。

## 验证

- Application Voice Runtime 与 IPC：4/4；
- Desktop Core：192/192；
- Renderer：24/24；
- Voice Worker：10/10；
- UTF-8、中文函数说明、TypeScript 编译与 Renderer bootstrap：通过；
- Renderer bootstrap SHA-256：
  `225025e0cc70c95cd5d7366c9f7039a6b040704649ef278f35253dd1ecc4db8c`。

全量架构回归全部通过，耗时约 `134.5s`。最终 Electron 默认预算冷启动一次通过：
进程 `1,646 ms`、workspace `1,412 ms`，观察窗口 `2,500 ms`；Voice Worker、
Connector Worker、Execution Engine 和 `legacy-backend` 均保持停止，无项目残留进程。

## 后续边界

剩余桌面 `legacy-backend` 激活主要来自尚未迁移的动态 Local UI 功能、Telegram、实时
直播平台、Home Assistant/MCP 兼容功能和少量工具路由。下一阶段按实际桌面调用频率、
凭据边界和可独立打包收益继续排序。
