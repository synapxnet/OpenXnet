# Phase 3AM Telegram Connector Runtime

## 状态

2026-07-29 完成。Desktop Renderer 的 Telegram 生命周期不再请求
`/start_telegram_bot`、`/stop_telegram_bot`、`/reload_telegram_bot` 或
`/telegram_bot_status`。Telegram 轮询、普通消息、主动行为、图片、ASR 和 TTS 现由
可选 Connector Worker 承载；Browser/Server 继续保留原 HTTP 路由。

## 调用链

```text
Desktop Renderer
  -> typed preload IPC
  -> ApplicationConnectorRuntimeService
  -> Connector Worker RPC
  -> TelegramBotManager / TelegramClient
     -> Telegram Bot API
     -> Connector Chat Broker -> Execution Engine
     -> Connector Voice Broker -> Voice Worker
```

Renderer 启动或重载前先把新 Token 写入 Main 的独立 `safeStorage`，随后只提交有界无密钥
配置。Main 等待 Connector Worker 的凭据失效队列完成，再启动新进程并通过
`OPENXNET_TELEGRAM_CREDENTIALS_B64` 注入 Token。Worker RPC 请求、Renderer 状态和
Manager 状态均不包含 Token。

## Runtime Contract

`ApplicationConnectorRuntimePlatform` 扩展为六个平台，其中 `telegram` 只属于运行时
平台联合类型，不属于 `ApplicationConnectorCredentialPlatform`。这样可复用 Connector
生命周期 IPC，同时保持 `telegram-credentials.bin` 与五个平台的
`connector-credentials.bin` 完全独立。

Telegram 运行时只接受以下无密钥字段：

- `TelegramAgent`；
- `memoryLimit`；
- `separators`；
- `reasoningVisible`；
- `quickRestart`；
- `enableTTS`；
- `wakeWord`；
- `behaviorSettings`；
- `behaviorTargetChatIds`。

任意 `token/secret/password/credential` 风格字段、额外顶层字段、超限字符串、过深对象和
超预算配置都会在 Main Contract 层拒绝。

## Chat 与语音

`TelegramClient` 不再创建指向本地 `/v1` 的 `AsyncOpenAI` 客户端，也不再调用本地
`/tts` 或 `/asr`：

- 普通消息和主动行为统一使用 `create_connector_chat_client()`；
- Telegram 音频使用 `transcribe_connector_audio()`；
- 传统 TTS 使用 `synthesize_connector_speech()`；
- Desktop 二进制音频继续通过私有 artifact 交换目录跨进程；
- Server 模式继续由 Connector Chat/Voice Client 的兼容分支访问原路由。

语音转写先校验空结果再检查唤醒词，避免 `None` 参与字符串判断。Chat、ASR、TTS 和
Telegram API 异常只记录异常类型或固定错误码，Renderer 和聊天用户不接收上游原始诊断。

## 凭据轮换

Telegram Token 更新会失效三个真实消费者：

- Connector Worker；
- Execution Engine 的任务投递能力；
- 仍提供 Browser/Server 兼容路由的 legacy backend。

Voice Worker 不持有 Telegram Token，因此不参与本凭据轮换。Connector Runtime 启动会
等待 Connector Worker 停止队列完成，保证新进程读取最新凭据包。

## 打包

Connector Pack 升级到 `1.5.0`，显式包含：

- `py.telegram_bot_manager`；
- `py.telegram_client`；
- `py.telegram_credentials`。

Telegram 复用 Pack 中已有 `aiohttp`、`openai`、`pydub` 和 FFmpeg 数据，不向基础桌面包
增加新的 Telegram SDK。

实际构建产物：

- 版本：`1.5.0-openxnet.1.0.2`；
- 文件：835；
- 字节：171,780,994；
- 平台：`win32-x64`。

真实 `connector-worker.exe` Pack smoke 已验证六个平台依赖全部可发现，六个平台初始状态
全部为 `stopped`。

## 验证

- Connector Runtime：6/6；
- Connector Chat/Voice Broker：8/8；
- Connector Worker：9/9；
- Connector Chat Client：4/4；
- Connector Voice Client：5/5；
- Telegram Connector Runtime：5/5；
- Desktop Core：192/192；
- Renderer：24/24；
- UTF-8、中文函数说明、TypeScript 编译与 Renderer bootstrap：通过；
- Connector Pack 1.5.0 构建和真实入口 smoke：通过。

全量架构回归全部通过，耗时 `174,405 ms`。最终 Electron 默认预算冷启动复测通过：
进程 `1,812 ms`、workspace `1,533 ms`，观察窗口 `2,500 ms`；Connector Worker、
Voice Worker、Execution Engine 和 `legacy-backend` 均保持停止，无项目残留进程。

大型 Pack 构建后的首次冷启动出现一次 `22,398 ms` 抖动，但运行时边界仍全部保持停止。
按既定约定，该偶发构建后抖动不纳入待解决问题，复测稳定数据作为阶段验收结果。

## 后续边界

Telegram 已不再是 Desktop `legacy-backend` 激活来源。剩余优先域包括动态 Local UI、实时
直播平台、Home Assistant/MCP 兼容功能和少量工具路由；Browser/Server 的 Telegram HTTP
兼容路由不属于 Desktop 迁移阻塞项。
