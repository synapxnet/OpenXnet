# Phase 3BI System and Artifact Runtime

## 状态

2026-07-30 完成。Desktop 的代理应用、用户/日志/扩展目录打开、局域网地址读取和贴纸包创建
不再调用 `/api/update_proxy`、`/api/get_userfile`、`/api/get_extfile`、`/api/ip` 或
`/create_sticker_pack`。Browser/Server 继续保留 compatibility routes。

本阶段新增 `ApplicationSystemRuntimeService`，并复用既有 Core Artifact 边界承接贴纸图片。
Renderer 不再接收用户数据目录、日志目录或扩展目录的绝对路径，也不能向 Main 提交任意路径。

## 调用链

```text
Desktop proxy / reveal directory / network address
  -> typed preload IPC
  -> sender-authorized Main IPC
  -> Application System Runtime
  -> Electron session / fixed Main-owned directories / OS network interfaces

Desktop sticker pack
  -> preload-owned File path extraction or bounded bytes
  -> Core Artifact IPC
  -> Application Artifact Service
  -> Local UI Gateway artifact URL
  -> Renderer-owned sticker metadata persistence
```

## System Runtime

代理请求不接受 Renderer 参数。Runtime 从 Core system settings 读取 `proxyMode`、`proxy` 和
`isChinaProxy`，只允许 system、none 或 HTTP/HTTPS manual 模式。SOCKS、带路径的 URL 和无效
URL 会在修改会话或环境前失败。结果只返回模式和中国镜像开关，不返回代理 URL。

规范代理同时应用到 Electron 默认会话、主窗口会话和内置浏览器会话，并更新后续子进程继承的
代理与 npm/uv 镜像环境。显式更改代理后，已持有旧环境的 Execution Engine、Voice、Connector、
Live、MCP Worker 和 compatibility backend 会停止，下一次使用时按需重启。

目录打开只接受 `user-data`、`logs` 和 `extensions` 三个枚举。Main 创建缺失目录并直接调用
Electron shell，响应只包含 `opened: true`。局域网地址由 Main 枚举网卡并选择第一个非内部 IPv4，
不可用时返回 `127.0.0.1`。

## Sticker Artifact

Desktop 贴纸包最多包含 64 张 PNG、JPEG、GIF 或 WebP。名称、描述、文件类型和控制字符在导入
前校验；File 路径由 preload 提取，没有本机路径时沿用 Artifact 的有界内联字节预算。

图片进入 Core Artifact 后使用稳定 Artifact ID、revision 和 storage name。贴纸元数据保存相对
`/uploaded_files/<storageName>` URL，避免把动态端口或本机路径持久化。文件库加载、上传和删除也
已收紧：Desktop bridge 缺失时明确失败，只有 Browser/Server 可以进入 compatibility HTTP。

## VRM 回退收紧

VRM 配置和事件 bridge 缺失时，Desktop 不再静默进入 `/cur_language`、`/vrm_config` 或
`/ws/vrm`。配置读取回落到本地安全默认值，事件通道保持断开并记录固定错误；Browser/Server
仍使用原 HTTP/WebSocket。

## 明确保留的动态边界

开发者工作台的 FastAPI 调试页在用户显式打开时仍读取 `/openapi.json`，用于检查 compatibility
backend 自身的 OpenAPI 文档。该操作是明确的调试能力，不属于启动、主状态或普通业务路径。
Renderer 中其余音频 Blob、Local UI Gateway Artifact 和外部服务 fetch 不会激活 Python。

## 验证

- Application System Runtime 与 sender-authorized IPC：4/4；
- Renderer System、Sticker/Artifact 和 VRM 架构测试：4/4；
- Renderer 全量启动测试：45/45；
- Desktop Core：245/245，扩展 post-test：39/39；
- UTF-8/LF、缩进、Python docstring 和 TypeScript 中文函数说明检查：通过；
- System Runtime Electron smoke：manual proxy、固定目录、IPv4、运行时失效 1、backend 激活 0；
- Artifact Electron smoke：原生文本、生成文本和 `sticker.png` 导入成功，backend 激活 0；
- VRM Electron smoke：配置 `zh-CN/default`、连接数 `1 -> 0`、投递 1、backend 激活 0；
- Renderer bootstrap SHA-256：
  `200914d9832be5338f45f404220bf1cb8c1c4e09c6f1997022404487ce748b84`。

全量 `npm test` 通过，耗时 `197,500 ms`。最终冷启动复测 process `1,907 ms`、workspace
`1,428 ms`、观察窗口 `2,500 ms`；`legacy-backend`、Execution Engine 和全部可选 capability
保持 stopped。

## 回归审计结论

代理成功/错误路径、固定目录枚举、网卡回退、贴纸图片导入、Artifact 严格回退和 VRM bridge 缺失
路径均已覆盖并复测通过。本阶段没有新增布局、主题或响应式样式，主题和尺寸回归项不适用。没有
未关闭的功能缺陷。
