# Phase 3BN Shared Worker Analysis Boundary

## 状态

2026-07-30 完成。基础 `server.spec` 仍需收集大量 `py` 模块，但不再把独立 Feature Pack 和
单独 Task Worker 已拥有的实现重复放入共享 `PYZ-00`。

## Analysis 边界

`DESKTOP_EXCLUDED_PY_MODULES` 配合 `collect_submodules('py', filter=...)` 排除：

- Voice、Vector、Memory、Document、Connector、Live、MCP 与 Desktop Control Worker 实现；
- 各 Worker 的重量级 Engine、音频、持久向量实现；
- 已由独立 `PYZ-01` 收集的 Task Execution Worker 实现；
- Server-only task scheduler 与 compatibility task API。

共享 Analysis 继续保留 `py.workers.protocol` 与 `py.workers.runtime`，因为基础客户端和独立
Worker 共同依赖稳定 RPC 信封、认证和生命周期工具。Task Worker 仍有独立 Analysis、PYZ 和
`task-worker.exe`，不因共享去重而缺失实现。

`py/worker_capability_contracts.py` 保存 Document 格式和 MiniLM 默认模型等无运行时依赖常量。
基础客户端不再为了读取常量反向导入 Worker Engine，避免 PyInstaller 沿常量引用重新收集整条
重量级实现链。

## 体积证据

Phase 3BL 至 3BN 连续完成后的 Windows x64 稳定基础目录：

- Phase 3BJ 审计前原始基线：2,941 个文件，471,711,065 字节；
- Phase 3BN 联合稳定产物：916 个文件，148,477,286 字节；
- 累计减少：323,233,779 字节（约 308.26 MiB，68.52%）；
- Voice、MCP/SQL、AWS、Selenium、HF 与 gRPC 禁止项文件名扫描均为零命中。

该数字是三个连续边界调整的联合证据，不用于推断单个进程的内存占用或冷启动耗时。

## 验证

- `test:base-package-boundary` 验证独立实现排除和共享协议保留；
- Task Worker 专项测试与独立 `PYZ-01` 构建通过；
- 冻结 Server 与 Execution Engine smoke 通过；
- 独立 Voice Pack 和 MCP Pack smoke 通过。

## 后续边界

共享 PYZ 中仍存在 LangChain 闭包。下一阶段先替换知识库分块、旧 metadata 兼容和搜索包装器，
再排除 LangChain/LangSmith；不得只在 spec 中屏蔽仍被基础业务真实导入的模块。
