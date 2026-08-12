# Phase 3AY VR Asset Runtime

## 状态

2026-07-29 完成。Desktop VRM 模型、VRMA 动作和 Gaussian 场景的目录读取、用户导入、删除以及
固定云 VRM 下载不再调用 Python 资产路由。Renderer 通过 typed preload API 进入 Main 持有的
TypeScript Runtime；Browser/Server 继续保留原 FastAPI 路由。

内置 `/vrm/` 和用户 `/uploaded_files/` 文件都由 Local UI Gateway 直接只读提供。打开 VR 页面、
读取模型/动作/场景和执行本地资产管理不会启动 `legacy-backend`。

## 调用链

```text
Desktop <input type=file> / 拖放
  -> preload webUtils.getPathForFile(File)
  -> typed VR Asset IPC
  -> Main 按类型与字节预算复制
  -> userData/uploaded_files + Main 无密钥 VRMConfig

Desktop 内置资产读取
  -> Local UI Gateway /vrm/<relative-path>
  -> Electron extraResources/vrm

Desktop 固定云模型下载
  -> typed VR Asset IPC(modelId)
  -> 固定目录 UUIDv5 查找
  -> Electron net.fetch + manual redirect + 分块预算
  -> userData/uploaded_files

Browser / Server
  -> 原 VRM/VRMA/Gaussian FastAPI compatibility routes
```

Desktop 缺少任一 VR typed API 时直接显示 Runtime 不可用，不会降级请求 Python。只有非 Electron
环境进入 HTTP fallback。

## 文件与配置边界

Renderer 只能提交类型、显示名和真实 `File`。preload 私下提取 Chromium 持有的本机路径；无本机
路径的生成 File 最多 64 MiB。Main 再次精确校验字段、文件名、扩展名和普通文件状态，并拒绝符号
链接。原生文件使用文件系统复制，不再像旧 multipart 路由一样一次性 `read()` 整个文件。

类型预算：

- VRM 模型最多 512 MiB；
- VRMA 动作最多 128 MiB；
- Gaussian 场景最多 4 GiB；
- 云 VRM 最多 1 GiB，下载超时 10 分钟；
- 每次 typed 导入只处理一个文件。

用户文件名由 Main 生成 UUID 和原扩展名。显示名、用户集合和当前动作/场景选择通过 Main 状态边界
写入 `VRMConfig`。删除只接受类型和稳定 ID，不能提交路径或删除内置资产。导入和下载使用临时文件
与原子改名；失败会清理临时文件。

## 云目录与网络安全

TypeScript 固定云目录保留旧 Server 的全部相对路径，并使用相同 URL namespace UUIDv5 算法，旧
设置和已下载模型 ID 保持兼容。Renderer 只能选择目录中存在的模型 ID，不能提交 URL。

资源基址默认使用 OpenXnet HTTPS CDN。自定义基址只接受 HTTPS，开发环境可使用回环 HTTP；用户
信息、查询和片段被拒绝。下载使用 Electron 系统网络栈、`redirect: manual`、Content-Length 预检和
实际流字节双重预算。未知 ID、重定向、空响应、超限和传输失败都返回固定错误，不暴露内部路径。

## Gateway 与打包

Gateway 对 `/vrm/` 逐段 URL 解码并限制路径长度和深度，拒绝控制字符、反斜杠、空段、点段、隐藏
段、越界路径以及任一层符号链接。合法文件支持 GET、HEAD 和单 Range，并带统一安全头。非法或
缺失文件直接 404，不会代理到 Python。

VR 运行资源从 PyInstaller 内嵌数据移到 Electron `extraResources/vrm`：动作、场景、ASR 资源和一个
默认模型只打包一次。Main 和兼容后端都通过 `OPENXNET_VRM_DIR` 使用同一目录，避免安装包重复资源。
大模型继续按固定目录下载到用户资产目录。

## 验证

- VR Asset Runtime 与 IPC：3/3；
- VR Asset + Local UI Gateway 专项：9/9；
- Renderer 启动架构：33/33；
- Desktop Core 主套件：238/238，随后 Developer Workbench + VR post-test 6/6；
- UTF-8、LF、Python docstring、TypeScript 函数说明和 Renderer bootstrap：通过；
- TypeScript 云模型 UUIDv5 与 Python 旧实现一致；
- 真实 Electron smoke：打包模型、本机中文 `.vrm`、固定云模型分块下载、Range 读取和删除均通过；
- Electron smoke 中 legacy backend 激活次数为 0；
- 全量 `npm test`：通过，耗时 `156,100 ms`。

最终冷启动：process `1,905 ms`、workspace `1,631 ms`、观察窗口 `2,500 ms`。legacy backend 和全部
可选 capability 保持 stopped。

## 后续边界

Quest Gateway、VRM 实时消息和桌宠窗口生命周期不是资产管理，不在本阶段迁移。Browser/Server 的
资产兼容路由继续保留。下一高价值域是扩展与技能管理，其本地扫描、ZIP/GitHub 安装和 Node 子进程
生命周期仍会激活 Python，需拆成 Main-owned 目录/安装边界和受监督运行能力。
