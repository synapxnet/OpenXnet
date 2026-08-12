# Phase 3BH Voice Presentation Runtime

## 状态

2026-07-29 完成。Desktop 的 TTS 合成、系统与供应商音色目录、GPT-SoVITS 参考音频管理、
VRM TTS 事件传递以及 VRM 启动配置不再经过 `legacy-backend`。Browser/Server 继续保留
`/tts`、声音目录、参考音频上传/删除、`/ws/tts`、`/ws/vrm`、`/cur_language` 和
`/vrm_config` compatibility transports。

本阶段没有把供应商凭据或本机路径交给 Renderer。Main 负责 sender 授权、typed contract、
无密钥设置投影、私有文件生命周期和 VRM 窗口广播；Voice Worker 只在真正执行合成或读取声音
目录时按需激活。

## 调用链

```text
Desktop TTS / voice catalog
  -> typed preload IPC
  -> sender-authorized Main IPC
  -> Application Voice Runtime
  -> Voice Worker
  -> bounded audio bytes / public voice entries

Desktop GPT-SoVITS reference audio
  -> preload-owned File path extraction or bounded bytes
  -> sender-authorized Main IPC
  -> Main-owned uploaded_files storage

Desktop VRM presentation
  -> Main Renderer typed publish IPC
  -> Application VRM Presentation Runtime
  -> trusted VRM window event subscription
  -> Main-composed language and public asset configuration
```

## TTS 合成与声音目录

Renderer 合成请求只包含文本、音色、分段索引和移动端优化标志，不再提交 TTS 设置、Provider
地址或凭据。Main 从无密钥设置快照读取当前 TTS 配置，Voice Worker 通过自身受限环境接收对应
凭据。Worker 生成的私有音频文件由 Main 校验、读取并删除，Renderer 只收到有界 `ArrayBuffer`
和受限媒体类型。

系统音色目录只在显式调用时导入 `pyttsx3`。供应商目录只接受固定 provider 和 credential
scope；Fish 使用固定 HTTPS API，Xunfei 使用固定基础目录。Azure、Volcengine、Baidu、
Minimax 和 Google 直接读取 Pack 中的纯数据常量，避免执行 `tetos/__init__.py` 并提前加载
全部语音 SDK。所有目录最多返回 512 项，总响应最多 1 MiB。

当前 Desktop 不允许使用尚未保存的 TTS 设置草稿进行供应商试听。草稿可能包含未进入 Main
安全边界的凭据和自定义地址，因此 bridge 会明确失败，而不会把完整设置重新暴露给 Renderer
或静默回退到 Python HTTP。

## 参考音频所有权

Desktop 不再调用 `/upload_gsv_ref_audio` 或 `/delete_audio/*`。preload 从真实 `File` 提取
Electron 路径；没有本机路径时只允许提交最多 25 MiB 的内联字节。Main 以 UUID 和固定音频
扩展名原子写入 `userData/uploaded_files`，删除请求只接受 Main 返回的 UUID 存储名。

导入与删除均不激活 Voice Worker，也不会向 Renderer 返回绝对路径。Browser/Server 继续使用
multipart 和删除路由，以保持远程部署兼容。

## VRM 展示边界

主 Renderer 通过 Main IPC 发布固定的 TTS 展示事件。Runtime 校验事件类型、精确字段、音频
大小、文本长度、索引、采样率和表达式后，直接广播给当前受信任 VRM 窗口。VRM preload
只暴露事件订阅和配置读取；窗口关闭后连接数立即归零，不需要 Python WebSocket。

VRM 窗口启动时通过 Main 一次性读取语言、选择状态和公开资产目录。Main 合并
`LegacyRendererState` 的展示设置与 `ApplicationVrAssetRuntime` 的模型、动作和场景目录，过滤
无效选择并避免返回凭据或本机绝对路径。Browser/Server 仍保留原 HTTP 与 WebSocket 分支。

## Feature Pack

Voice Worker 合约提升为 `2.1.0`。冻结 Pack
`2.1.0-openxnet.1.0.2-win32-x64` 包含 4,367 个文件、245,793,698 字节，入口为独立
`runtime/voice-worker.exe`。冻结 Pack smoke 已验证 Azure 499 项声音目录和 Mock TTS 13 字节
WAV 合成。

## 验证

- Application Voice Runtime 与 IPC 合成边界：10/10；
- Voice Worker：12/12；
- VRM Presentation Runtime 与 IPC：5/5；
- Renderer Desktop/Browser 分支：42/42；
- Desktop Core：245/245，扩展 post-test：35/35；
- UTF-8/LF、缩进、Python docstring 和 TypeScript 中文函数说明检查：通过；
- TTS Electron smoke：请求 3、音频 4 字节、私有字段 0、Voice 激活 3、backend 激活 0；
- VRM Electron smoke：配置 `zh-CN/default`、连接数 `1 -> 0`、投递 1、backend 激活 0；
- 冻结 Voice Pack `2.1.0` smoke：通过。

最终跨阶段回归 Renderer 45/45、Desktop Core 245/245、扩展 post-test 39/39；全量
`npm test` 通过，耗时 `197,500 ms`。冷启动复测 process `1,907 ms`、workspace
`1,428 ms`、观察窗口 `2,500 ms`，全部可选能力与 `legacy-backend` 保持 stopped。

## 后续边界

Renderer 中剩余 Desktop `fetch`、WebSocket 和文件路径操作审计已由 Phase 3BI 完成。带有明确
Desktop typed 分支的 Browser/Server fallback 不计作 Desktop 遗留；新的 Desktop 能力必须先确定
Main、Core 或独立 Worker 所有权，再开放最小 preload contract。
