<!--
#!/usr/bin/env markdown
# -*- coding: utf-8 -*-
# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.
#
# 三平台 Adapter 与驻场 Agent 契约 / Three-platform Adapter and Resident Agent Contract
# Author: maoyo
# Department: 研发部
# Date: 2026-09-15
# Version: 1.3.0
# Security Level: INTERNAL
-->

# GOAI 决赛 V1.3.0 Adapter 与驻场 Agent 契约

本文件约束 `XnetAIOps`、`XnetDataOps` 和 `XnetMLOps` 的驻场 Agent、Adapter、AgentTeams 和 OpenXnet 控制面之间的边界。三平台可以独立运行和聊天，跨域问题通过 AgentTeams 形成协同 Run。

## 1. 统一结构

```text
平台本地 UI / 驻场 Agent
       ↓ 只调用本平台 Adapter
平台 Adapter（旧 API 兼容、字段归一化、凭据换取、错误映射）
       ↓ OpenXnet canonical contract
AgentTeams（任务分派、上下文、交接、重试）
       ↓
OpenXnet Run / Human Gate / Executor / Verifier / Audit
```

Renderer 不得直接调用任何旧平台 API，也不得将平台 Token、Cookie 或 API key 写入浏览器、Memory、聊天、Trace 或导出包。

## 2. Resident Agent 公共接口

每个平台必须提供以下逻辑能力（可以是 HTTP、IPC 或本地进程，但对 OpenXnet 的字段契约一致）：

| 能力 | 说明 | 写权限 |
| --- | --- | --- |
| `health.preflight` | 连接、契约、权限、时间窗和版本预检 | 无 |
| `evidence.collect` | 收集限定时间窗和资源范围的只读证据 | 无 |
| `diagnosis.explain` | 基于证据生成带引用的本地解释 | 无 |
| `collaboration.request` | 请求 Leader 创建跨平台 Run | 无 |
| `local.check` | 启动可逆、低风险本地检查 | 受平台白名单限制 |
| `chat.respond` | 回答领域问题，必须返回证据引用和上下文版本 | 无 |

高风险写操作不能由 `chat.respond`、Resident Agent 或 LLM 直接触发。它们只能产生 `proposedAction`，由 Leader 形成计划，经 Human Gate 批准后交给 Controlled Executor。

公共响应字段：`requestId`、`workspaceId`、`environment`、`source`、`agentId`、`agentVersion`、`contractVersion`、`contextVersion`、`contextTtl`、`evidenceRefs[]`、`warnings[]`、`occurredAt`。

## 3. AIOps Resident Agent

**职责**：确认业务影响是否真实、排除基础设施故障、提供服务和部署证据。

只读证据最少包含：业务通过率/转化率、队列或错误指标、P99、服务健康、部署 revision、副本就绪、流量比例、探针时间窗和资源版本。

决赛场景能力：

- 判断“业务结果下降但服务健康”的组合事实。
- 引用业务指标的窗口和阈值，不凭单点采样下结论。
- 接收 MLOps/DataOps 的协同请求并返回独立状态。
- 允许低风险探针复测；禁止生产流量切换、扩缩容、重启和发布。

## 4. DataOps Resident Agent

**职责**：确认特征契约、数据血缘、质量门和回填边界。

只读证据最少包含：Schema 当前/基线版本、字段和维度 diff、上游数据产品、血缘影响范围、时间覆盖、缺失/重复/新鲜度、质量门结果、回填估算和数据版本。

决赛场景能力：

- 识别例如 `128 → 120` 维特征向量变化并给出 `evidenceId`。
- 通过血缘将契约变化关联到受影响模型和服务。
- 生成回填提案与质量门要求；未经审批不能执行回填或改变数据产品。
- 上游资源版本变化时使相关计划失效并请求重新取证。

## 5. MLOps Resident Agent

**职责**：确认模型输入契约、训练/评估、登记、灰度和回滚信息。

只读证据最少包含：当前模型 revision、输入 Schema、训练数据版本、候选评估指标、留出集结果、模型登记状态、部署 revision、灰度比例、稳定回滚点和推理探针。

决赛场景能力：

- 证明当前 `r18` 与上游特征契约不一致，并引用 DataOps 证据。
- 生成受限训练/评估候选和发布门槛；不能自行发布或提高流量。
- 提供 `r17` 稳定回滚点和候选 `r19` 的资源版本。
- 评估结果不足或数据版本漂移时拒绝 `proposedAction`。

## 6. 驻场聊天和升级协同

平台内聊天是领域工作台的抽屉，不是第二套控制面。每条回答必须带：证据引用、时间范围、资源版本、`LIVE-STAGING/REPLAY/SIMULATION` 标签、上下文版本和“升级到协同 Run”动作。

升级流程：

```text
领域问题 → Resident Agent 只读取证 → 证据包/诊断建议
→ 用户或 Agent 选择“升级到协同 Run”
→ AgentTeams Leader 创建统一 runId/incidentId/traceId
→ 三平台 Agent 以最小上下文协作
```

本地聊天不得直接批准、执行或关闭跨平台 Incident。聊天内容进入审计时只保存脱敏摘要和引用。

## 7. AgentTeams 交互契约

AgentTeams 为协作运行时，负责：任务分派、成员身份验证、最小上下文注入、交接事件、超时/重试、冲突上报、计划修订和独立 Verifier 调度。它不持有平台生产写权限，也不替代 Human Gate。

每个任务包含：`taskId`、`runId`、`parentTaskId`、`senderAgentId`、`receiverAgentId`、`role`、`scope`、`allowedTools[]`、`contextVersion`、`contextTtl`、`evidenceRefs[]`、`deadline` 和 `idempotencyKey`。

成员身份必须与 `agentId`、角色、平台、AgentTeams Team Template 版本和能力 manifest 一致；不匹配时停止本轮流程，禁止静默切换到 Builtin。

AgentTeams 必须把验证和补偿事件写入同一 Run 账本。Verifier 返回 `VERIFY_FAILED` 时，控制面进入 `COMPENSATING`；补偿完成后只能进入 `COMPENSATION_VERIFIED → FAILED`，并保留 `businessRecovered=false`、`certificationEligible=false`。`compensation=SUCCEEDED` 仅表示安全回退成功，不能改变业务 Incident 的失败终态；失败 Run 不得创建或升级 Skill。

## 8. Adapter 版本和错误

Adapter 必须声明 `contractVersion=finals-v1.3.0`、平台 API 版本、支持能力、运行时版本和配置 profile。至少归一化以下错误：未连接、认证失败、权限不足、资源版本冲突、契约不兼容、超时、上游 5xx、证据不完整和来源混用。

错误响应必须包含可审计的 `errorCode`、`retryable`、`requestId`、资源范围、重试建议和原始平台错误摘要（不得含密钥）。LIVE 失败不能自动换成 REPLAY 或 SIMULATION。

## 9. Credential Hub 边界

OpenXnet Credential Hub 负责加密保存凭据引用、轮换、审计和按平台/Workspace/Run 签发短期令牌。每个平台保留独立服务身份、最小权限和轮换策略；MLOps 只管理模型供应商用途、配额和路由，不托管其他平台密钥。

Adapter 只接收 `credentialRef` 或短期委派令牌。原始 API key 不进入前端、Agent 上下文、事件账本、Skill、Memory、Replay 或版本矩阵。

## 10. 网络和部署

服务使用逻辑环境名和 HTTPS 域名，例如 `goai-staging` 与 `agentteamsEndpointRef`。服务器 IP 变化时更新 DNS、负载均衡或配置中心，Agent 和桌面端执行健康预检及重连即可，不需要重新打包 EXE。协议、证书固定、IPC 或不可远程更新运行时不兼容时，才构建新的安装包。

## 11. 最小示例

```json
{
  "requestId": "req-dataops-001",
  "workspaceId": "ws_goai_demo",
  "environment": "staging",
  "source": "LIVE-STAGING",
  "agentId": "agt-dataops-resident-v130",
  "agentVersion": "1.3.0",
  "contractVersion": "finals-v1.3.0",
  "contextVersion": "ctx-3",
  "contextTtl": "2026-09-15T09:30:00Z",
  "evidenceRefs": ["evd-data-contract-001"],
  "proposedAction": null,
  "warnings": [],
  "occurredAt": "2026-09-15T09:15:00Z"
}
```
