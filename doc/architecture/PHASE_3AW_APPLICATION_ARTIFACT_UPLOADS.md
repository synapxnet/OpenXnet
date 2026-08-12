# Phase 3AW 通用上传与 Core Artifact

## 状态

2026-07-29 完成。Desktop 文件库上传、聊天文档与图片附件、长文本读取、角色卡 PNG 和头像上传
不再调用 `/load_file`。知识库继续使用 Phase 3AS 的 Core Artifact 路径。Renderer 通过 typed preload
API 把用户真实选择的文件交给 Electron Main，Main 流式复制到应用 Artifact 目录并登记稳定 ID；
Browser/Server 继续保留原 FastAPI multipart 路由。

Local UI Gateway 现在直接只读提供 `/uploaded_files/<filename>`。文件预览、聊天内部 URL 和知识库
内部引用不再为了读取已经存在的 Artifact 而激活 `legacy-backend`。本阶段没有增加 Worker、Python
依赖或 Feature Pack。

## 调用链

```text
Desktop 原生文件对话框
  -> Main 登记精确文件授权
  -> importArtifacts({ paths })
  -> ApplicationArtifactService 流式复制、哈希、登记

Desktop <input type=file> / 拖放
  -> preload webUtils.getPathForFile(File)
  -> 专用 import-renderer-files IPC
  -> ApplicationArtifactService 流式复制、哈希、登记

Desktop 截图 / 剪贴板生成 File
  -> preload 有界 ArrayBuffer
  -> 专用 import-renderer-files IPC
  -> ApplicationArtifactService 临时文件、哈希、原子改名、登记

Artifact 读取
  -> Local UI Gateway /uploaded_files/<storageName>
  -> 应用拥有的 uploaded_files 目录

Browser / Server
  -> /load_file
  -> FastAPI compatibility route
```

## 文件选择边界

Renderer 不能向新入口提交字符串路径。实际运行 preload 接收 `File` 对象，并用 Electron
`webUtils.getPathForFile(file)` 提取 Chromium 记录的真实路径；路径只存在于 preload 到 Main 的专用
请求中。Main 原生对话框返回的路径继续使用既有精确授权集合和 `importArtifacts({ paths })`，因此
Renderer 自行构造的任意路径不会通过该入口。

程序生成的截图和剪贴板文件没有本机路径。preload 只在此情况下读取字节，并限制：

- 单个内联文件最多 32 MiB；
- 一批内联文件最多 64 MiB；
- 一批最多 256 个文件；
- 空文件、大小漂移、非法文件名和非 `Uint8Array` 内容直接拒绝；
- Main contract 再次执行同样的数量、字段和字节预算校验。

普通本机文件不会转成 Renderer Blob，也不会通过 IPC 复制大块内容。原生聊天文件选择已删除
`electronAPI.readFile -> Blob -> File` 链路，改为 Main 流式导入后仅把 Artifact 元数据和同源 URL
加入附件栏。

## Artifact 写入与兼容结构

写入仍使用 Phase 3E 的 `application_artifacts` 表和 `uploaded_files` 目录。每个新文件获得稳定 UUID、
独立 storage name、原始显示名、媒体类型、MIME、大小、SHA-256、版本和生命周期状态。源文件保持
不变；失败时清理当前临时文件，已成功完成的此前文件保持有效。

Renderer 的统一适配器把 typed 写入结果转换为旧界面仍使用的 `fileLinks`、`textFiles`、
`imageFiles` 和 `videoFiles` 结构。聊天、角色卡和知识库继续消费 `name/path`，文件库继续消费
`unique_filename/original_filename`，但 Desktop 的权威状态始终来自 Core 快照。

`registerArtifacts` 暂时保留，只用于识别历史 Python 已写入目录的兼容文件和回滚，不再是 Desktop
通用上传主路径。`/load_file` 在 Renderer 中只存在于统一 Browser fallback 和明确的 Browser
知识库分支。

## Gateway 读取安全

Local UI Gateway 只接受 `/uploaded_files/` 下单层文件名，并拒绝：

- URL 解码失败、NUL 和控制字符；
- `.` 开头文件、目录分隔符和路径穿越；
- 子目录、目录对象和符号链接；
- 不存在的文件。

命中 Artifact 路径时返回同源 MIME、安全头、HEAD 和单 Range 支持；非法或缺失文件直接返回 404，
不会回退代理或激活 Python。其他动态 HTTP/WebSocket 请求仍按原规则按需激活兼容后端。

## 验证

专项与完整回归结果：

- Artifact IPC、存储与 Local UI Gateway：8/8；
- Renderer 启动架构：31/31；
- TypeScript Desktop Core 全量：通过；
- UTF-8、LF、Python docstring、TypeScript 函数说明和 Renderer bootstrap：通过；
- 真实 Electron Artifact smoke：原生中文文件名与程序生成文件均通过；
- smoke 中两个文件均可由 Gateway 读取，源文件未修改，后端激活次数为 0；
- 全量 `npm test`：通过，耗时 `182,600 ms`。

最终 Electron 冷启动：process `1,692 ms`、workspace `1,353 ms`、观察窗口 `2,500 ms`。
legacy backend 和全部可选 capability 保持 stopped，通用上传迁移没有增加启动期进程。

## 后续边界

Browser/Server 的 `/load_file` 仍是明确兼容接口，不在本阶段删除。后续若要移除 `registerArtifacts`，
必须先完成历史版本回滚窗口和旧目录迁移策略，不应让 Renderer 获得目录写入或任意路径能力。

下一高价值域是开发工作台的 snapshot、repository、代码搜索和文件导入路径；随后继续处理 VR 资产、
扩展/技能管理和企业控制台。每个域仍按 typed contract、最小进程依赖、真实 smoke、全量回归和
稳定冷启动封板。
