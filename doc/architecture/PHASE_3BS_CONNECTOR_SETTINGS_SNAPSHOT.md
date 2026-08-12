# Phase 3BS Connector Settings Snapshot

## 状态

2026-07-30 完成。Desktop Connector Worker 的行为设置、工具链接开关和 TTS 元数据不再由
QQ、Feishu、Dingtalk、Discord 或 Slack Manager 直接读取 legacy settings。Renderer 通过
生命周期配置和 sender-authorized typed update IPC 投影无密钥设置；已停止的 Connector
Worker 不会因此被激活。Browser/Server 源码运行模式继续保留 legacy settings 兼容读取。

## 设置所有权

`py.connector_settings` 统一解析三个有界设置域：

- 行为设置与平台目标会话列表；
- `toolMemorandumEnabled` 工具链接留存开关；
- Connector TTS 兼容元数据。

只要进程环境中出现任一 Connector Chat/Voice 私有变量，即判定为 Desktop 私有模式。完整、
部分或空值私有配置都禁止降级读取 `load_settings()`，防止错误 Broker 配置绕回兼容镜像。
Desktop TTS 快照固定为空，由 Main Connector Voice Broker 读取无密钥设置并调用 Voice Worker。

没有任何私有 Connector 环境变量时，解析器才读取 legacy settings，使 Browser/Server 的旧
HTTP 生命周期和源码 Worker 部署保持兼容。返回的目标列表与 TTS 映射均为分离副本。

## Runtime Update

Application Connector Runtime 新增 `update` operation 和
`openxnet:application-connector-runtime:update` IPC：

- Contract 只接受六个平台允许的无密钥字段；
- `toolMemorandumEnabled` 必须位于平台顶层配置；
- 已停止或不可用 capability 直接返回 stopped，不调用 `ensureCapability()`；
- 已运行 capability 只请求 `connectors.update`；
- update 不等待凭据刷新、不读取后端端口、不传 `backendPort`；
- 公开结果继续使用固定错误码，不暴露 Worker 或 SDK 诊断。

Renderer 在 Main 完成设置和凭据持久化后，按固定平台顺序把最新配置投影到活动 Manager。
串行更新避免共享行为引擎被多个平台并发修改。启动和重载仍先持久化凭据，再走原有凭据失效
队列；update 本身不会触发凭据轮换。

## Manager 迁移

六个平台配置统一增加 `toolMemorandumEnabled`。Feishu、Dingtalk、Discord、Slack 和
Telegram 还由 Renderer 强制注入全局 `behaviorSettings`；QQ 只消费工具链接开关。

QQ 新增与其他 Manager 一致的 `update_behavior_config()`，运行中可更新模型展示配置和工具
链接开关。Feishu、Discord、Slack 和 Telegram 的消息流改为读取本地配置快照，不再为每条
消息读取磁盘设置。Feishu、Discord 和 Slack 的 TTS 调用统一经过共享设置解析器。

兼容 `ConnectorWorkerClient.update_running()` 同时投影行为与工具开关，并覆盖 QQ；QQ 不接收
无关行为字段。Telegram Client 也遵守工具链接开关，不再无条件留存链接。

## 包边界

Connector Pack 升级为 `1.6.0-openxnet.1.0.2`，显式包含
`py.connector_settings`。Windows x64 实际构建结果为 835 个文件、171,791,290 字节，PYZ
确认包含设置模块。真实 Pack 安装 smoke 验证六个平台 SDK 全部可导入，六个平台初始状态均为
stopped。

基础 Server/Execution Engine 重新构建后，Connector Chat/Voice 私有客户端、设置解析器、
六个平台 Manager 和 Telegram Client 不再进入共享 PYZ：

- 基础目录：105,600,338 字节（100.71 MiB）、813 个文件；
- 共享 PYZ：3,341 个模块，Connector 独占模块 0 命中；
- Task Worker PYZ：1,227 个模块，Connector 独占模块 0 命中；
- 物理目录：Connector 独占模块 0 命中；
- 相比 Phase 3BR 再减少 239,720 字节和 31 个共享模块。

这些排除只作用于 Desktop 冻结基础包。Browser/Server 源码环境仍可使用完整 Manager 和兼容
设置读取，不改变其部署合同。

## 验证

- Connector Runtime Contract、Service、IPC：8/8；
- Connector settings：4/4；
- Connector Chat/Voice Broker：8/8；
- Connector Worker：10/10；
- Connector Chat Client：4/4；Connector Voice Client：5/5；
- Telegram Connector Runtime：5/5；Renderer 聚合：45/45；
- Connector Pack `1.6.0` 构建、PYZ 审计和真实入口 smoke：通过；
- 冻结 Execution Engine 完整认证与路由 smoke：通过，启动 3,656 ms；
- 冻结 desktop-legacy Server `/health`：返回 `ok`；
- `npm test`：通过，239.6 秒；
- `uv lock --check`、UTF-8 无 BOM、LF、Python/TypeScript 函数说明和 diff 格式：通过。

最终 Electron 冷启动复测通过：进程 1,810 ms、workspace 1,415 ms，观察窗口 2,500 ms；
Connector、Voice、Execution Engine 和 legacy backend 均保持 stopped。大型冻结构建和全量回归
后的首次冷启动为 11,935 ms，按既定项目决定记录但不列为待解决缺陷。

## 结论

Connector Worker 现在只消费生命周期请求携带的有界设置快照和 Main 私有 Broker，不再把
legacy Renderer settings 当作 Desktop 运行时配置源。后续新增 Connector 设置必须先加入精确
Runtime Contract 和 Renderer 投影，禁止在 Manager 中重新引入 `load_settings()`。
