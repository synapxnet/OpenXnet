# Phase 3BJ Base Voice Package Boundary

## 状态

2026-07-30 完成。Desktop 的 Voice Runtime 在 Phase 3AK、3AL 和 3BH 已迁移到独立
Voice Worker，本阶段进一步完成物理打包去重：基础 `server/execution-engine` 目录不再包含
Voice SDK、FFmpeg 可执行文件或 Tetos 发行版元数据。Browser/Server 的 TTS、ASR 和声音目录
compatibility routes 保持不变；显式运行独立 Server 且未配置 Voice Worker 时仍可使用本地依赖。

本阶段不是 Phase 4 的最终完成标记。基础目录仍包含 MCP、SQL 驱动、Selenium 等依赖，后续需要
按 Desktop、Execution Engine 和独立 Worker 的真实所有权继续拆分。

## 运行边界

```text
Desktop TTS / ASR / voice catalog
  -> typed Main runtime
  -> authenticated Voice Worker RPC
  -> independent Voice Feature Pack

Browser / standalone Server compatibility route
  -> configured Voice Worker RPC when available
  -> local provider implementation only for explicit Server fallback
```

`/tts/tetos/list_voices` 与 `/system/voices` 在配置 Voice Worker 时优先调用有认证的 Worker
RPC。Worker Client 只接受固定 provider、credential scope 和公开目录字段，并限制最多 512 项、
1 MiB；非法路径、私有字段、错误类型和异常 Worker 响应均转换为固定错误，不返回供应商异常或
凭据。

## 物理打包边界

基础 `server.spec` 不再收集 `imageio_ffmpeg` 数据和 FFmpeg 可执行文件，也不再声明
`pyttsx3` hidden import。共享 Analysis 显式排除以下 Voice Pack 所有依赖：

- `edge_tts`；
- `elevenlabs`；
- `imageio_ffmpeg`；
- `pydub`；
- `pyttsx3`；
- `tetos`。

Voice Worker 读取 Tetos 固定目录时，通过包目录定位 `consts.py`，不再查询发行版元数据。
冻结模式继续从 Pack 的 `_MEIPASS/tetos/consts.py` 读取，因此基础包不会被 PyInstaller 的
metadata hook 重新带入 `tetos-*.dist-info`。

## 体积证据

Windows x64 基础目录使用同一 Python 3.12.9、PyInstaller 6.19.0 环境重建：

- 调整前：2,941 个文件，471,711,065 字节；
- 调整后：2,918 个文件，237,300,327 字节；
- 减少：234,410,738 字节（223.55 MiB，49.69%）；
- Voice/FFmpeg 禁止项文件名扫描：0 命中。

目录大小包括共享的 `server.exe`、`execution-engine.exe` 和 `task-worker.exe`，因此这里只记录
完整发行目录的可复现变化，不把它解释为单个进程的内存占用或冷启动耗时。

## 验证

- Voice Worker 专项测试：16/16；
- Python 编译与 UTF-8/函数说明规范检查：通过；
- 冻结 `server.exe`：`/health` 返回 `{"status":"ok"}`，Voice 导入诊断 0；
- 冻结 `execution-engine.exe`：认证、精确路由、知识库、企业洞察和 Kernel smoke 通过，
  启动 5,125 ms；
- Voice Feature Pack `2.1.0-openxnet.1.0.2`：4,367 个文件、245,793,805 字节；
- 冻结 Voice Pack smoke：全部依赖可用，Azure 目录 499 项，Mock TTS 生成 13 字节 WAV。

冻结 Server smoke 按 Electron 实际启动契约注入 `OPENXNET_STATIC_DIR`。不注入时可执行文件会因
找不到桌面静态目录在挂载阶段退出，这属于独立手工启动缺少运行环境，不是 Voice 打包回归。

## 后续边界

下一阶段优先处理基础 Analysis 中的 MCP/SQL 重复依赖。实施前必须先证明 Desktop profile 的
MCP compatibility routes 全部委托独立 Worker，并保留 Server profile 的本地实现；随后才能从
基础包排除 MCP Runtime、SQLAlchemy 和数据库驱动。Execution Engine 仍需要 Provider 与工具
执行依赖，不能直接复用 Worker 排除清单。
