<!--
#!/usr/bin/env markdown
# -*- coding: utf-8 -*-
# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.
#
# 决赛 Run 事件契约 / Finals Run Event Contract
# Author: maoyo
# Department: 研发部
# Date: 2026-09-15
# Version: 1.3.0
# Security Level: INTERNAL
-->

# GOAI 决赛 V1.3.0 Run 与事件契约

本文定义 OpenXnet 控制面、AgentTeams 和三平台 Adapter 共享的规范化运行事件。事件是 UI 时间线、审计账本、Replay bundle 和验收脚本的唯一事实来源。

## 1. 标识与来源

每次现场演示必须创建新的 `runId`，不得把历史 Run 伪装为新运行。所有对象均属于一个 `workspaceId` 和 `environment`。

| 字段 | 约束 |
| --- | --- |
| `runId` | `run-<ulid>`，全局唯一，跨重试保持不变 |
| `incidentId` | 一个业务异常的稳定 ID；补偿不创建新 Incident |
| `traceId` | 一次 Run 的端到端链路 ID |
| `eventId` | 单个不可变事件 ID |
| `parentEventId` | 交接或状态因果的父事件；根事件为空 |
| `workspaceId` | OpenXnet 企业空间边界，禁止跨空间引用 |
| `source` | `LIVE-STAGING`、`REPLAY` 或 `SIMULATION`，大小写固定 |
| `occurredAt` | UTC RFC3339，服务端生成；客户端时间仅作展示 |
| `contextVersion` | AgentTeams 上下文快照版本，例如 `ctx-3` |
| `contextTtl` | RFC3339 过期时间；过期后任务必须重新取证 |

## 2. 规范事件对象

```json
{
  "eventId": "evt-01J...<ULID>",
  "runId": "run-01J...<ULID>",
  "incidentId": "inc-feature-contract-20260915-001",
  "traceId": "tr-01J...<ULID>",
  "parentEventId": "evt-01J...",
  "workspaceId": "ws_goai_demo",
  "environment": "staging",
  "source": "LIVE-STAGING",
  "actor": "agent.dataops.resident",
  "role": "DATAOPS_RESIDENT_AGENT",
  "agentId": "agt-dataops-resident-v130",
  "action": "SUBMIT_EVIDENCE",
  "stateBefore": "EVIDENCE_COLLECTING",
  "stateAfter": "PLAN_READY",
  "reason": "Feature vector contract changed from 128 to 120 dimensions",
  "evidenceRefs": ["evd-data-contract-001", "evd-lineage-impact-001"],
  "toolInvocationRefs": ["toolinv-dataops-schema-001"],
  "approvalRef": null,
  "retryIndex": 0,
  "resourceVersion": "feature-contract/v42",
  "idempotencyKey": "run-...:evidence:dataops:0",
  "contextVersion": "ctx-3",
  "contextTtl": "2026-09-15T09:30:00Z",
  "occurredAt": "2026-09-15T09:15:00Z",
  "payloadDigest": "sha256:..."
}
```

`reason` 和 `payloadDigest` 可脱敏；原始请求体、响应体和密钥不得进入事件。完整 payload 通过受保护的 `evidenceRefs` 或 `toolInvocationRefs` 访问。

## 3. Run 状态机

成功路径：

```text
INGESTED
  → EVIDENCE_COLLECTING
  → PLAN_READY
  → WAITING_HUMAN_APPROVAL
  → APPROVED
  → EXECUTING
  → VERIFYING
  → RESOLVED
```

失败和补偿路径：

```text
EXECUTING → EXECUTION_FAILED → COMPENSATING → COMPENSATION_VERIFIED → FAILED
VERIFYING → VERIFY_FAILED → COMPENSATING → COMPENSATION_VERIFIED → FAILED
```

取消、超时、审批拒绝和连接丢失也必须有明确终态或人工接管状态；不得删除事件。只有 Verifier 和 OpenXnet 客观验证器共同满足场景门槛时才能进入 `RESOLVED`。

## 4. AgentTeams 交接事件

跨 Agent 交接至少产生一对 `TASK_DISPATCHED` 和 `TASK_RESULT_SUBMITTED` 事件。事件必须包含：发送者和接收者身份、最小上下文摘要、上下文版本/TTL、任务范围、证据引用、结果状态和父事件。

典型链路：

```text
Leader CREATE_RUN
→ DataOps/AIOps/MLOps RESIDENT_TASK_DISPATCHED
→ resident TASK_RESULT_SUBMITTED
→ Leader PLAN_REVISED (Plan v0 → Plan v1)
→ HumanGate APPROVAL_GRANTED
→ Executor STEP_STARTED / STEP_RECEIPT
→ Verifier VERIFY_STARTED / VERDICT_SUBMITTED
```

驻场 Agent 的本地事件也进入同一账本，但必须带 `scope=PLATFORM_LOCAL`；协同 Run 事件带 `scope=CROSS_PLATFORM`。本地事件不能直接改变 Incident 的跨平台终态。

## 5. 证据、工具和审批引用

`evidenceRefs[]` 指向不可变证据记录；每条记录需有 `evidenceId`、平台、工具名、`requestId`、时间窗、摘要哈希、HTTP 结果和资源版本。`toolInvocationRefs[]` 指向调用记录，记录输入 Schema 版本、输出校验、耗时、重试和错误摘要。

`approvalRef` 只能引用一个完整计划的 **Human Gate** 人工授权记录。授权记录必须绑定计划摘要、步骤 ID、参数摘要、资源白名单、资源版本、TTL、回滚点、Skill/Adapter/AgentTeams 版本和幂等键。计划发生变化时生成新 revision，并将原授权标记为 `INVALIDATED`。

## 6. 幂等、重试和并发

- 写动作的 `idempotencyKey` 由 OpenXnet 生成，不得由模型自由拼接。
- 同一 key 重试必须返回同一确定性回执；参数摘要变化必须拒绝执行。
- `retryIndex` 从 `0` 开始，重试原因和退避窗口必须可见。
- 资源版本变化时停止当前计划并回到 `EVIDENCE_COLLECTING` 或 `PLAN_READY`，不能盲目覆盖新版本。
- 事件账本追加写入，服务端按 `occurredAt` 和序列号提供稳定排序。

## 7. LIVE/REPLAY/SIMULATION 契约

`LIVE-STAGING` 事件必须包含上游真实 `requestId` 和连接预检结果；`REPLAY` 事件必须引用录制包版本和签名；`SIMULATION` 事件必须引用模拟器版本和种子。三者不得在一次 Run 中混用。UI、导出和验收报告均显示来源。

## 8. 终态语义

成功关闭：

```json
{"incident":"RESOLVED","verification":"PASSED","businessRecovered":true,"certificationEligible":true}
```

验证失败但补偿成功：

```json
{"incident":"FAILED","action":"VERIFICATION_FAILED","compensation":"SUCCEEDED","businessRecovered":false,"certificationEligible":false}
```

成功 Run 才能产生 Candidate Skill；Skill 认证仍需人工并绑定环境范围。失败 Run 不得创建、覆盖或升级 Skill。

## 9. 兼容和安全

Adapter 将旧平台 API 响应归一化为本契约，Renderer 不得读取旧字段。原始凭据由 Credential Hub 保存和短期签发；事件、上下文、导出包只保存 `credentialRef` 和授权范围。跨平台交接传证据引用，不传 API key。
