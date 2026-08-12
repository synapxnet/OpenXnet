# Phase 3BR Phase 4 Package Closeout

## 状态

2026-07-30 完成。Phase 4 Capability Workers 的依赖声明、剩余共享载荷和许可证清单均已审计。
所有可选大型 SDK、模型运行时、数据库驱动和独立 Worker 实现都位于 Feature Pack 或显式
Server 兼容环境；基础冻结目录只保留有直接 Execution Engine 消费者的运行依赖，不包含模型权重。

## pywin32 最终拆分

pywin32 同时由 Document Worker 的旧 DOC/PPT COM 解析和 Desktop Control Worker 的 Windows
窗口 API 使用。它不再是基础直接依赖，现归入 `documents` 与 `desktop-control` 可选组，并由
`requirements-desktop-control.txt` 明确独立构建输入。

共享 Server/Execution Engine 和 Task Worker Analysis 均排除 `pythoncom`、`pywintypes`、
`pywin32_system32`、`win32com` 及 Win32 原生模块。最终两个 PYZ 和物理目录的上述禁止项均为
0 命中；独立 Desktop Control Pack 仍可导入 win32api、win32con、win32gui、win32process，
真实只读 smoke 启动 811 ms。

## 保留载荷判断

- Pillow：Server 桌面视觉截图、缩放、网格和动作标注的直接消费者；
- DDGS、`primp/lxml`：`ddgs.http_client` 与 `ddgs.base` 的直接搜索依赖；
- E2B 与 Protobuf：E2B 代码解释器是基础执行工具，锁文件明确声明 Protobuf 传递依赖；
- tzlocal Win32 适配：仅使用标准库/注册表读取本地时区，不属于 pywin32 SDK 闭包；
- Worker protocol/runtime：Server 与各独立 Worker 的必要共享合同。

这些载荷不能仅按体积排除。后续若要继续拆分，必须先迁移对应基础能力，并增加真实运行
替代路径；当前直接删除会造成已发布工具能力回归。

## 最终体积

- Phase 3BR 调整前：114,724,904 字节、825 个文件；
- 最终目录：105,840,058 字节（100.94 MiB）、813 个文件；
- pywin32 边界减少：8,884,846 字节（8.47 MiB，7.74%）；
- 相对 Phase 3BO 减少：26,997,187 字节（25.75 MiB）；
- 相对 471,711,065 字节原始基线累计减少：365,871,007 字节（348.92 MiB，77.56%）；
- 共享 PYZ：3,372 个模块；Task Worker PYZ：1,227 个模块；全部禁止项 0 命中。

## 最终验证

- `npm test`：通过，257.0 秒；
- `uv lock --check`、Python 编译、UTF-8/LF、函数说明与许可证一致性：通过；
- Base Package Boundary：4/4；Direct A2A：5/5；外部 CLI：8/8；
- 冻结 Server `/health`：`{"status":"ok"}`，最终构建启动 4,074 ms；
- 冻结 Execution Engine：认证、精确路由、知识库、企业洞察和 Kernel smoke 通过，启动
  4,063 ms；
- Voice Pack `2.1.0`：Azure 声音 499 项，Mock TTS 生成 13 字节 WAV；
- MCP Pack `1.4.0`：浏览器 12 个工具、SQL 4 个工具、通用 MCP 调用与凭据脱敏通过；
- Desktop 冷启动：首次 11,052 ms，缓存后 1,942 ms、workspace 1,564 ms；按项目决定，
  偶发慢启动记录但不作为本阶段缺陷。

Phase 4 退出条件已满足：基础应用不携带可选能力的重量级 Python/模型依赖，所有保留的共享包
都有可复现的基础消费者和回归护栏。新增能力必须继续先确定所有者，再选择 Core、Engine 或
独立 Feature Pack，禁止把可选 SDK 重新加入基础依赖。
