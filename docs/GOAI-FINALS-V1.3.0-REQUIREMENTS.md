<!--
#!/usr/bin/env markdown
# -*- coding: utf-8 -*-
# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.
#
# 决赛 V1.3.0 需求基线 / GOAI Finals V1.3.0 Requirements Baseline
# Author: maoyo
# Department: 研发部
# Date: 2026-09-15
# Version: 1.3.0
# Security Level: INTERNAL
-->

# OpenXnet GOAI 决赛 V1.3.0 需求基线

本文件冻结 OpenXnet 企业智能空间 GOAI 决赛版本的产品范围、技术边界和验收口径。V1.3.0 以已经优化的 `v1.2.0` 运行基线为升级起点，不回到旧分支重做；旧版本保留为回退、历史证据和录屏备用。

## 1. 决赛目标

决赛只把一个完整业务闭环作为主展示：**跨域特征契约漂移恢复**。平台要证明多智能体可以在真实权限和失败条件下，把一个业务异常交付到可验证的终态，而不是只生成诊断文字。

业务触发条件：风控/推荐服务的业务通过率或转化率下降，服务延迟、错误率和基础设施健康不支持“扩容即可解决”的判断。系统需要识别上游特征契约变化，经过证据收集、方案修订、人工授权、受控执行、独立验证和补偿，最终给出可审计的成功或失败结论。

决赛只展示两个连续案例：

1. **恢复成功**：特征契约差异被确认，备用特征止损、数据回填、模型候选评估和灰度发布完成，独立验证通过，事件为 `RESOLVED`。
2. **验证失败并补偿**：执行回执完整，但独立 Verifier 发现业务阈值未恢复；系统回退到稳定模型/备用特征，补偿本身成功，业务事件仍为 `FAILED`，不得把安全回退冒充业务恢复。

DataOps、MLOps、AIOps 的其他能力、WorldOps、VR 和 3D 沙盘作为可复用扩展放在附录，不进入主链路。

## 2. 版本和分支基线

| 项目 | V1.3.0 约定 |
| --- | --- |
| OpenXnet 基线 | 已优化的 `v1.2.0` 桌面/服务运行基线 |
| OpenXnet 决赛版 | `Finals-v1.3.0`，只增加本文件和配套契约要求的能力 |
| 三平台策略 | 保留稳定领域能力；每个平台发布只覆盖决赛场景的集成 Adapter 和驻场 Agent 能力 |
| AgentTeams | 作为多 Agent 协作运行时，不由三个平台各自替代 |
| 旧分支 | 只作为回退和兼容参考，不整体合并旧 UI 或旧直连方式 |
| 主演示环境 | `LIVE-STAGING`，现场新建 Run |
| 备用环境 | 同版本 `REPLAY`，使用签名录制包；不能伪装成 LIVE |
| 开发测试环境 | `SIMULATION`，确定性模拟数据；不能作为现场真实平台调用证明 |

所有页面、事件、导出包和录屏都必须显示上述来源标签。平台不可用时不能静默从 `LIVE-STAGING` 切到 Fixture 或 Replay。

## 3. 分层架构

```text
OpenXnet 控制面
  Run / 权限 / Human Gate / Executor / Verifier / 审计 / 版本矩阵
        │
        ▼
AgentTeams 协作运行时
  任务分派 / 最小上下文 / 交接 / 超时 / 重试 / 冲突 / 计划修订
        │
        ├─ Leader Agent
        ├─ XnetAIOps Resident Agent
        ├─ XnetDataOps Resident Agent
        ├─ XnetMLOps Resident Agent
        └─ Independent Verifier Agent

受控边界（不属于 Agent）
  Controlled Executor：只执行已审批的确定性步骤
  Human Gate：批准或拒绝计划，承担人工授权责任

平台 Adapter
  OpenXnet canonical contract → AIOps/DataOps/MLOps Adapter → 现有平台 API
```

渲染器不能直接调用三平台旧 API。所有兼容逻辑、字段归一化、错误映射、版本校验和平台凭据获取都必须在 Adapter 内完成。

## 4. Agent 身份和职责

| 身份 | 运行位置 | 允许能力 | 禁止能力 |
| --- | --- | --- | --- |
| Leader | AgentTeams | 创建 Run、拆解任务、汇总证据、修订计划、申请 Human Gate | 直接写三平台、绕过审批、直接关闭事件 |
| AIOps Resident Agent | XnetAIOps | 读取业务指标、服务健康、部署和流量；生成本地证据包 | 修改生产流量、扩容、发布或重启 |
| DataOps Resident Agent | XnetDataOps | 读取 Schema、契约差异、血缘、质量门；发起只读检查 | 未审批回填、改写数据产品或血缘 |
| MLOps Resident Agent | XnetMLOps | 读取模型契约、训练/评估、登记和灰度状态；生成候选 | 未审批训练发布、提升流量、删除模型 |
| Independent Verifier | AgentTeams | 用独立只读路径读取业务、数据、模型和部署证据，做最终判断 | 采信 Executor 成功回执作为唯一依据、执行修复 |
| Controlled Executor | OpenXnet 控制面 | 在审批绑定范围内执行确定性动作 | 调用模型自主生成写操作、扩大资源范围 |
| Human Gate | OpenXnet 控制面 | 审阅 diff、参数、资源、TTL、补偿和版本后批准/拒绝 | 口头批准、批准后修改已绑定参数 |

三个驻场 Agent 平时独立管理所属平台。发现跨域因果关系、超出本地权限、证据冲突或高风险写操作时，必须向 Leader 发出协同请求，由 AgentTeams 创建统一 Run。

## 5. 主场景功能需求

### 5.1 取证和计划修订

- AIOps Agent 必须先确认业务指标、服务健康、部署 revision、流量比例和时间窗。
- DataOps Agent 必须返回契约差异、影响血缘、数据版本、质量门和回填范围。
- MLOps Agent 必须返回模型输入契约、当前 revision、候选评估、灰度状态和回滚点。
- Leader 首次生成 `Plan v0`；证据不足时只能保持取证状态。
- 任一证据改变假设或资源范围时，必须生成 `Plan v1+`，显示旧/新差异，并自动使旧审批失效。

### 5.2 Human Gate

批准对象必须绑定：`runId`、完整步骤 ID、参数摘要、资源白名单、资源版本、变更窗口、TTL、回滚步骤、AgentTeams 版本、Skill 版本和 `idempotencyKey`。审批前 Executor 锁定；批准后任何绑定字段变化都必须回到 `PLAN_READY` 重新审批。

### 5.3 受控执行和独立验证

执行分为四个可展开阶段：止损、数据修复、模型修复、受控发布。每一步显示期望值、实际值、工具调用、重试原因、资源版本、幂等键和回执引用。

Verifier 使用独立身份和只读证据路径，至少检查业务恢复、数据质量、输入契约、部署 revision 和灰度/流量五项门槛。Executor 的成功回执不能单独触发关闭。

### 5.4 失败和补偿

验证不通过时进入：

```text
VERIFY_FAILED → COMPENSATING → COMPENSATION_VERIFIED → FAILED
```

补偿成功只表示系统回到安全状态，终态必须保留：

```text
Incident = FAILED
Action = VERIFICATION_FAILED
compensation = SUCCEEDED
businessRecovered = false
certificationEligible = false
```

失败 Run 不得发布或复用 Skill。原始失败证据、补偿证据和 Verifier 判定不可覆盖。

## 6. UI 和交互需求

以 Run 为中心的工作台替代分散的展示页：

1. **事件中心**：业务影响、运行健康、来源标签、连接预检、`Start new Run` 和 `Open replay`。
2. **Run 详情**：固定显示 `runId`、`incidentId`、`traceId`、`workspaceId`、环境、场景、来源和包版本。
3. **AgentTeams 协作时间线**：Leader、AIOps、DataOps、MLOps、Verifier 泳道，显示交接、上下文版本和状态变更。
4. **证据抽屉**：平台、工具、`requestId`、`evidenceId`、时间、来源、摘要哈希、HTTP 结果和资源版本。
5. **计划 diff**：Plan v0 与 Plan v1 的假设、步骤、资源、参数变化；旧审批失效原因可见。
6. **Human Gate**：审批前锁定执行；审批后显示批准者、时间、TTL、幂等键和剩余窗口。
7. **执行/验证**：默认紧凑，命令、请求体、回执和子 Agent 输出可展开；会话结束自动折叠但不隐藏。
8. **补偿/审计**：原动作、失败依据、补偿动作、补偿验证和最终业务判定并列显示。
9. **版本与健康**：客户端、服务端、三个 Adapter、AgentTeams、Skill、安装包和配置环境的版本矩阵。

平台内可以提供轻量驻场 Agent 对话抽屉。对话只能产生证据包、诊断建议或“升级到协同 Run”请求；高风险动作必须回到 OpenXnet Human Gate。

## 7. 配置、密钥和网络

- API key 不由 MLOps 统一托管。OpenXnet Credential Hub 保存加密密钥引用，按平台、Workspace、Run 签发短期委派凭据。
- AIOps、DataOps、MLOps 各自拥有服务身份、权限范围和轮换策略；跨平台只传证据引用和授权意图，不传平台原始密钥。
- 桌面端只保存逻辑环境引用，例如 `goai-staging`、`agentTeamsEndpointRef` 和 `adapterProfile`，不能硬编码 IP。
- 服务入口使用 HTTPS 域名、配置中心或负载均衡。服务器 IP 变化时更新 DNS/服务配置，客户端重连即可，不重新打包 EXE。
- 仅在协议、证书固定策略、IPC 或不可远程更新的运行时发生不兼容时才发布新安装包。

## 8. 版本矩阵和交付物

决赛包必须展示并导出以下对应关系：

| 组件 | 必填字段 |
| --- | --- |
| OpenXnet Desktop/Server | 版本、commit、构建时间、配置 profile |
| AIOps/DataOps/MLOps Adapter | 契约版本、平台 API 版本、能力清单 |
| Resident Agent | agentId、角色、能力 manifest、运行时版本 |
| AgentTeams Runtime | endpoint、协议版本、Team Template 版本 |
| Skills | 名称、版本、输入/输出 Schema、认证环境 |
| 安装包 | 文件名、版本、SHA-256、签名状态 |

交付物必须包含同版本安装包、Adapter 配置样例、Skill manifest、Replay bundle、事件账本、证据索引、审批记录、工具调用记录、版本矩阵和演示录屏。

## 9. 非目标和禁止事项

- 不在决赛主演示同时展开三个独立产品的完整菜单。
- 不把五个身份做成没有权限边界的聊天窗口。
- 不允许 LIVE 失败时静默使用 REPLAY/SIMULATION。
- 不把成功补偿显示为业务恢复。
- 不允许前端保存或展示原始 API key。
- 不声称已验证 VR、灵巧手或物理硬件生产闭环；它们只复用同一治理契约作为后续扩展。
