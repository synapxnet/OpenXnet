# Phase 3AN Live Runtime

## 状态

2026-07-29 完成。Desktop Renderer 的直播生命周期不再访问
`/api/live/start`、`/api/live/stop`、`/api/live/reload`、`/api/live/status` 或
`/ws/live/danmu`。Bilibili、YouTube 和 Twitch 传输现由独立、可选的 Live Worker
承载；Browser/Server 继续保留原 HTTP 与 WebSocket 兼容接口。

## 调用链

```text
Desktop Renderer
  -> typed preload IPC
  -> ApplicationLiveRuntimeService
  -> Desktop Core live capability
  -> WorkerSupervisor
  -> Live Worker
  -> LiveRuntimeController
     -> Bilibili / YouTube / Twitch
  -> live.event
  -> Main 校验与广播
  -> Renderer
```

Desktop 的 `status` 和 `stop` 不激活停止状态的 Worker。`start` 和 `reload` 先等待凭据
轮换队列，再按需激活 `live` capability。Live capability 只依赖 Core，不依赖
`legacy-backend`、Execution Engine、Connector Worker 或 Voice Worker。

## Runtime Contract

Renderer 只能提交九个无密钥配置字段：

- Bilibili enabled、认证模式、房间 ID、Access Key ID 和 App ID；
- YouTube enabled 和视频 ID；
- Twitch enabled 和频道名。

Main 拒绝额外字段、密钥风格字段、错误类型、非法认证模式、超长字符串和超过 128 KiB
的配置。Worker 只开放 `live.status`、`live.dependencies`、`live.start`、`live.stop` 和
`live.reload`；公开结果只有固定状态、三平台运行标志和稳定错误码，不返回供应商诊断。

直播事件在 Python 与 TypeScript 两侧分别校验。事件只允许 `message` 或 `error`，平台只
允许 Bilibili、YouTube 或 Twitch，正文限制为 16 KiB，ID 和弹幕类型限制为 128 字符。
无效事件被丢弃并只记录固定诊断，单个 Renderer 监听器异常不会影响其他订阅者。

## Worker 生命周期

框架无关的 `LiveRuntimeController` 同时供 Live Worker 和 Server 兼容路由使用。控制器使用
操作锁串行化启动、停止和重载；失败启动会回滚已打开的平台。Bilibili task、HTTP session、
YouTube poller 和 Twitch task 都有显式停止路径，单个平台清理失败只记录异常类型并继续
释放其余资源。

Live Worker 导入时不启动网络连接。冻结入口把 stdin、stdout 和 stderr 显式配置为
UTF-8 与 LF，stdout 只承载逐行 JSON Worker 协议，从而避免 Windows 本地代码页破坏中文
状态或事件。

## 凭据与兼容边界

五个直播密钥继续独立保存在 `live-platform-credentials.bin`。Main 只把有界的
`OPENXNET_LIVE_PLATFORM_CREDENTIALS_B64` 注入新启动的 Live Worker，以及显式启动的
Server 兼容 backend；Renderer、Core SQLite、Worker RPC 载荷、Execution Engine、Task
Worker、Connector Worker 和 Voice Worker 均不接收密钥。

凭据轮换只停止 Live Worker 与兼容 backend。下次显式启动读取新凭据；其他 Worker 不受
影响。Browser/Server 的 `/api/live/*` 与 `/ws/live/danmu` 继续由薄适配器委托同一个
`LiveRuntimeController`，但这些路由不再注册为 Desktop 调用链。

## 打包

Live Pack `1.0.0` 使用独立 `requirements-live.txt` 与 PyInstaller spec，显式排除
FastAPI、Starlette、Uvicorn、模型、向量、语音、Connector 和执行引擎依赖。

实际 Windows x64 产物：

- 版本：`1.0.0-openxnet.1.0.2`；
- 文件：712；
- 字节：48,097,283；
- 入口：`runtime/live-worker.exe`。

真实冻结入口 smoke 已确认 `aiohttp`、`py.blivedm`、`py.ytdm` 和
`py.twitch_service` 均可导入，初始三平台全部停止，中文状态精确为“直播监听已停止”。
产物目录中不存在 FastAPI、Starlette 或 Uvicorn 文件。

## 验证

- Live Worker：4/4；
- 直播凭据与 Server 兼容路由：6/6；
- Renderer 启动与 Desktop 路由边界：24/24；
- Desktop Core：199/199；
- Python 编译、UTF-8、中文函数说明、TypeScript 编译与 Renderer bootstrap：通过；
- Live Pack 构建、依赖检查、UTF-8 中文状态和框架排除 smoke：通过。

全量架构回归全部通过，耗时 `159,300 ms`。最终 Electron 默认预算冷启动复测通过：
进程 `1,794 ms`、workspace `1,536 ms`，观察窗口 `2,500 ms`；Live Worker、Connector
Worker、Voice Worker、Execution Engine 和 `legacy-backend` 均保持停止。

大型 Pack 构建后的首次冷启动出现一次 `15,826 ms` 抖动，但运行时边界仍全部保持停止。
按既定约定，该偶发构建后抖动不纳入待解决问题，复测稳定数据作为阶段验收结果。

## 后续边界

Live Runtime 已不再是 Desktop `legacy-backend` 激活来源。剩余优先域为 Home
Assistant/MCP 生命周期与工具注册、Chrome MCP、SQL MCP、动态 Local UI，以及仍直接依赖
兼容 backend 的少量工具和存储路由。
