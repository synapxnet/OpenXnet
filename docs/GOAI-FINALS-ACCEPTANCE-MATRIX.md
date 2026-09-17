<!--
#!/usr/bin/env markdown
# -*- coding: utf-8 -*-
# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.
#
# 决赛验收矩阵 / Finals Acceptance Matrix
# Author: maoyo
# Department: 研发部
# Date: 2026-09-15
# Version: 1.3.0
# Security Level: INTERNAL
-->

# OpenXnet GOAI 决赛 V1.3.0 验收矩阵

验收以现场可观察的新 Run、统一事件契约和可导出的证据为准。`DONE` 只表示有自动化或现场可复核证据；`PARTIAL` 表示仅 Fixture、规划阶段或本机隔离证据；`OPEN` 表示仍需线上 Live 或现场补验。历史截图或预置 Run 不能替代新建 Run。

| ID | 验收项 | 必须观察到的证据 | 结果 |
| --- | --- | --- | --- |
| R01 | 版本基线 | v1.2.0 优化基线 → Finals v1.3.0 的 commit、构建时间和迁移说明 | DONE |
| R02 | 主场景聚焦 | 主演示只有跨域特征契约漂移恢复，最多两个案例 | DONE |
| R03 | 新 Run | 现场点击创建，产生新的 `runId/incidentId/traceId` | DONE |
| R04 | 来源标签 | 全链路明确 `LIVE-STAGING`；Replay/Simulation 不混用 | PARTIAL |
| R05 | 连接预检 | 三平台、AgentTeams、Credential Hub、版本和时间预检结果可见 | DONE |
| R06 | AIOps 驻场 Agent | 业务指标下降、服务健康、部署 revision、流量和探针证据 | PARTIAL |
| R07 | DataOps 驻场 Agent | Schema/契约 diff、血缘影响、质量门、数据版本和回填边界 | PARTIAL |
| R08 | MLOps 驻场 Agent | 模型输入契约、r18/r19/r17、评估、灰度和回滚证据 | PARTIAL |
| R09 | AgentTeams | Leader 分派、三平台 Agent 回传、上下文版本/TTL、交接事件可见 | DONE |
| R10 | 权限隔离 | 每个 Agent 工具白名单和平台 scope；Executor/Human Gate 明确不是 Agent | DONE |
| R11 | Plan v0 | 证据不足时保持取证，不提前生成可执行写计划 | DONE |
| R12 | 计划修订 | 证据改变假设后出现 Plan v0→v1 diff，旧审批自动失效 | PARTIAL |
| R13 | Human Gate | 审批绑定步骤、参数、资源白名单/版本、TTL、回滚、版本和幂等键 | DONE |
| R14 | 审批锁定 | 批准前 Executor 不可运行；绑定字段变化回到待审批 | DONE |
| R15 | 确定性执行 | 四阶段动作、期望/实际、工具调用、重试和回执可展开 | DONE |
| R16 | 资源版本保护 | 资源版本变化会阻断或重新取证，不覆盖新版本 | DONE |
| R17 | 独立验证 | Verifier 独立身份/只读路径，至少检查五项恢复门槛 | DONE |
| R18 | 成功终态 | `RESOLVED`, `PASSED`, `businessRecovered=true`，成功 Run 才可 Candidate Skill | DONE |
| R19 | 验证失败 | 出现 `VERIFY_FAILED`，不接受 Executor 回执作为关闭依据 | DONE |
| R20 | 补偿语义 | `COMPENSATING→COMPENSATION_VERIFIED→FAILED`，补偿成功不等于业务恢复 | DONE |
| R21 | 失败终态 | `Incident=FAILED`, `Action=VERIFICATION_FAILED`, `compensation=SUCCEEDED`, `businessRecovered=false`, `certificationEligible=false` | DONE |
| R22 | Skill 保护 | 失败 Run 不创建/覆盖 Skill；成功 Skill 需人工认证和环境范围 | DONE |
| R23 | 事件完整性 | 每事件有 event/run/parent、actor/role/agent、state、reason、evidence/tool refs、approval、retry、resource、idempotency、context、时间 | DONE |
| R24 | 证据可追溯 | evidenceId、平台、工具、requestId、时间窗、digest、HTTP 结果和资源版本可展开 | DONE |
| R25 | 工具记录 | 输入/输出 Schema、耗时、重试原因、错误摘要和脱敏请求回执可导出 | DONE |
| R26 | 领域聊天 | 三平台聊天返回证据/版本/来源，并可升级协同 Run；不能直接执行高风险动作 | PARTIAL |
| R27 | Credential Hub | API key 不进入前端、Memory、Trace、Skill、Replay 或导出；平台凭据独立轮换 | DONE |
| R28 | IP 迁移 | 更新 DNS/配置中心后健康检查和重连成功，无需重打包 EXE | DONE |
| R29 | 版本矩阵 | Desktop、Server、三 Adapter、Resident Agent、AgentTeams、Skill、安装包 SHA-256 对应 | PARTIAL |
| R30 | 错误边界 | 认证、权限、版本冲突、超时、5xx、证据不完整、来源混用均可见且不静默降级 | DONE |
| R31 | 断线恢复 | 断线提示不中断账本；重连后可继续未完成 Run 或明确人工接管 | DONE |
| R32 | 审计导出 | 事件账本、证据索引、交接、审批、执行、验证、补偿、健康和版本矩阵可导出 | PARTIAL |
| R33 | Replay 一致性 | 签名 Replay bundle 与当前所有组件版本一致，明确录制元数据 | OPEN |
| R34 | 安全范围 | 现场仅使用 staging 白名单；故障注入隔离且注入记录进入账本 | PARTIAL |
| R35 | UI 交互 | Run 为中心，状态/泳道/diff/抽屉层级清晰；工具细节默认折叠可展开；场景、演示路径与 Live/Fixture 的选中态必须以 Logo 主色背景、边框、勾选和状态文字清晰区分 | DONE |
| R36 | 非主链扩展 | WorldOps、VR、灵巧手只展示复用契约，不宣称未经验证的生产硬件闭环 | PARTIAL |
| R37 | 平台身份校验 | AIOps、DataOps、MLOps 的配置地址除连通性外还必须校验平台身份；错配地址不得显示 `online`，不得计入在线/已配置服务，也不得加载错误平台预览 | DONE |

## 1. 自动化验收建议

- `contract`: 对所有事件执行必填字段、枚举、状态转移、Workspace 边界和来源纯度校验。
- `security`: 扫描日志、Renderer、Memory、Replay 和导出包中的 key/token/cookie 形态。
- `live-smoke`: 新建成功 Run 和失败补偿 Run 各一条；检查 AgentTeams 身份、真实 requestId、证据 digest 和终态。
- `adapter`: 三平台 Adapter 分别验证能力 manifest、旧 API 归一化、错误映射和资源版本冲突。
- `replay`: 在无上游服务环境中只以 `REPLAY` 运行签名录制包，确认不会显示 LIVE。
- `network`: 修改 staging 域名解析或服务入口，验证客户端重连、Run 续接和不重打包。

## 2. 放行门槛

决赛候选包至少满足：R01-R25、R27-R35 全部 `DONE`；R26 和 R36 可作为 P1，但若现场展示平台聊天或 WorldOps/VR，则相应项必须 `DONE`。R18 和 R21 必须各有一条现场可复核 Run；任一失败终态被错误标记为成功，版本不得放行。

## 3. 证据包命名

```text
openxnet-finals-v1.3.0-<source>-<scenario>-<date>/
  run-event-ledger.jsonl
  evidence-index.json
  agentteams-handoffs.json
  human-gate-approval.json
  execution-receipts.json
  verification-verdict.json
  compensation-receipts.json
  version-matrix.json
  health-snapshot.json
  replay-manifest.json
```

## 4. 回归缺陷登记

### GOAI-UI-REG-001：三平台服务地址错配仍被判定在线

```text
Status: OPEN
Severity: HIGH
Area: 企业空间 / XnetDataOps、XnetMLOps、XnetAIOps 服务配置与健康检查
Repro: 进入 XnetDataOps，将服务地址配置为 XnetMLOps URL，保存后执行健康检查。
Expected: 客户端或服务端根据平台标识、能力清单或专用健康端点识别地址错配；显示“平台身份不匹配”，保持 DataOps offline，且不加载 MLOps 预览。
Actual: 健康检查仅确认 URL 可访问，页面显示 online、在线服务 3/3，并在 XnetDataOps 页加载 MLOps 分析界面。
Risk: 现场演示可能把错误平台误判为健康；后续证据、工具调用和驻场 Agent 路由可能被归属到错误平台，破坏跨平台 Run 的可追溯性。
Observed: 2026-09-16，OpenXnet Finals v1.3.0 桌面验收。
Workaround: 手工核对三个域名，并确认右侧预览的平台名称与当前菜单一致。
Fix acceptance: 三个平台分别覆盖正确地址、交叉错配地址、不可达地址和重启后持久化；只有身份与菜单匹配的服务可以进入 online，并新增自动化回归测试。
```
