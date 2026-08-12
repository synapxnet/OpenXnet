# Phase 3AK 配置化 Voice Runtime

## 状态

2026-07-29 完成。Connector 语音和桌面兼容 `/asr`、`/tts` 不再由
`legacy-backend` 执行。OpenAI、FunASR、Sherpa ASR 以及现有全部 TTS
引擎统一进入按需启动的 Voice Worker。

纯 Browser/Server 模式未配置 Worker RPC 时仍保留原路由实现，因此本阶段不改变
Server 部署契约。桌面模式只保留 HTTP 路由外壳作为兼容入口，实际执行委托同一个
Voice Worker。

## 调用拓扑

```text
Connector Worker
  -> Connector Voice Broker（独立 Bearer）
  -> Main 读取无密钥 ASR/TTS 设置快照
  -> Desktop Core 激活 voice capability
  -> WorkerSupervisor 请求 voice.transcribe-configured / voice.synthesize
  -> Voice Worker 从进程环境补齐 Voice / Provider 凭据
  -> ASR 文本或 voice-output-* 临时文件
  -> Main 校验、读取并删除 Worker 输出
  -> Broker 写入 connector-output-* 临时文件
  -> Connector Worker 校验、读取并删除
```

Browser/Server 兼容路径在 Worker RPC 已配置时从 `/asr` 或 `/tts` 直接进入相同
Worker 方法。Connector Manager 和 Connector Voice 协议没有变化。

## Worker 协议

Voice capability 新增两个方法：

- `voice.transcribe-configured`：接收交换目录内音频引用、格式和无密钥
  `asrSettings`，返回有界文本；
- `voice.synthesize`：接收有界文本、voice、index、移动端标记、目标格式和无密钥
  `ttsSettings`，返回一次性输出文件引用、字节数、媒体类型和实际格式。

原 `voice.transcribe`、`voice.status`、`voice.release` 保持兼容。非 system 请求继续由
`WorkerSupervisor` 持有活动租约，五分钟空闲后停止 Worker。供应商连接和 Sherpa
模型只在首次真实请求时加载，状态检查只使用 `find_spec`。

## 引擎覆盖

ASR：OpenAI Whisper 兼容接口、FunASR offline WebSocket、本地 Sherpa ONNX。

TTS：EdgeTTS、CustomTTS、GSV、Volcengine、OpenAI、System TTS / pyttsx3、
Tetos Azure/Baidu/Minimax/Xunfei/Fish/Google，以及 ElevenLabs。

移动端 Opus 转换使用 Pack 内的 `pydub` 与 `imageio-ffmpeg`。转换失败时拒绝返回，
不会把 WAV 或 PCM 错误标记为 Opus。

## 凭据和错误边界

Main 只向 Voice Worker 注入：

- `OPENXNET_VOICE_CREDENTIALS_B64`；
- `OPENXNET_PROVIDER_CREDENTIALS_B64`。

Connector Worker 仍不接收这两个 envelope。Voice 或 Provider 凭据轮换会停止 Voice
Worker，使下一次激活从 `safeStorage` 获取新快照。Voice Worker 从环境补齐密钥后才
构造供应商客户端；设置、Worker RPC 和临时文件名均不包含密钥。

供应商原始异常不会穿过 Worker/Broker。Worker 返回固定语音错误，Connector Broker
进一步收敛为 `CONNECTOR_VOICE_UNAVAILABLE`。兼容 HTTP 路由也只返回固定中文错误和
稳定错误码。

## 文件安全

输入音频必须是 `runtime/voice-exchange` 内的普通非链接文件，最大 64 MiB。Connector
Broker 自身继续把输入限制为 25 MiB。TTS 输出最大 25 MiB，只能写为
`voice-output-*`，权限为 `0600`。

Main 和 legacy 兼容客户端都验证输出的直接父目录、名称前缀、普通文件类型、链接、
声明大小、实际大小和媒体类型，并在读取后删除。目录外的恶意 Worker 路径会被拒绝，
且不会被清理代码误删。超过一天的 Worker 自有输出在下次启动时清理。

GSV 和 OpenAI 参考音频只允许读取 `uploaded_files` 内的普通文件。自定义 HTTP、GSV、
OpenAI 和 FunASR 地址拒绝用户信息、非法协议、片段和控制字符；HTTP 客户端禁用环境
代理和重定向，并设置连接数、连接超时、总超时和流式大小预算。

## Feature Pack

Voice Pack 升级为 `2.0.0-openxnet.1.0.2`。`requirements-voice.txt` 和
`voice-worker.spec` 显式包含 OpenAI、httpx、websockets、EdgeTTS、pydub、
imageio-ffmpeg、Tetos、ElevenLabs、pyttsx3、Sherpa、SoundFile 和 NumPy。

Windows x64 实际构建结果为 4,367 个文件、245,781,429 字节。该运行时仍是独立按需
Feature Pack，不进入基础桌面安装包或冷启动路径。Pack smoke 启动真实
`voice-worker.exe`，确认九类配置化依赖均可发现，并通过本地 Mock CustomTTS 完成
真实 HTTP 合成、Worker RPC、13 字节 WAV artifact 读取和清理。

## 验证

- Voice Worker：10/10；
- Connector Chat/Voice Broker：8/8；
- Connector Worker：8/8；
- Connector Chat client：4/4；
- Connector Voice client：5/5；
- Renderer：24/24；
- 架构 UTF-8、Python docstring、TypeScript function docs 和 Renderer hash：通过；
- Renderer bootstrap SHA-256：
  `225025e0cc70c95cd5d7366c9f7039a6b040704649ef278f35253dd1ecc4db8c`。

全量架构回归全部通过，耗时约 `192.9s`，其中 Desktop Core 为 `188/188`。
最终 Electron 默认预算冷启动复测通过：进程 `1,802 ms`，workspace `1,545 ms`，
观察窗口为 `2,500 ms`。Voice Worker、Connector Worker、Execution Engine 和
`legacy-backend` 均保持停止，无项目残留进程。紧接大型 Pack 构建与全量回归的首次
冷启动出现一次已约定不纳入缺陷的系统抖动，复测恢复到稳定预算内。

## 后续边界

Phase 3AL 随后把桌面 VAD/PTT 录音迁移到 typed IPC 和私有 artifact，桌面不再使用
`/ws/asr`；Browser/Server 保留兼容 WebSocket。Phase 3BS 又把 Connector Worker 的行为、
工具链接和语音元数据收敛为生命周期/typed update 设置快照，Desktop Manager 不再读取
legacy settings，兼容读取只保留在无私有 Connector 环境的 Browser/Server 源码模式。
