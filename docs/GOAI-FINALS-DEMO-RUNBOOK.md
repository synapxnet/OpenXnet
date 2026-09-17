<!--
#!/usr/bin/env markdown
# -*- coding: utf-8 -*-
# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.
#
# 决赛演示运行手册 / Finals Demonstration Runbook
# Author: maoyo
# Department: 研发部
# Date: 2026-09-15
# Version: 1.3.0
# Security Level: INTERNAL
-->

# OpenXnet GOAI 决赛 V1.3.0 演示运行手册

## 1. 演示承诺

演示不是展示预置结果，而是在 `LIVE-STAGING` 中创建一条新的跨域特征契约漂移恢复 Run。系统完整显示：谁发现异常、谁取证、证据如何改变计划、谁批准、谁执行、谁独立验证，以及失败时如何补偿且保留失败终态。

演示期间的屏幕、导出包和口述始终标明运行来源：`LIVE-STAGING`、`REPLAY` 或 `SIMULATION`。网络或上游平台不可用时，只能显式切换到同版本 `REPLAY`，不能将录制结果称为现场运行。

## 2. 会前准备

### 2.1 版本冻结与预检

1. 冻结 `OpenXnet Finals v1.3.0` Desktop/Server、三平台 Adapter、Resident Agent、AgentTeams、Skill 和安装包版本矩阵。
2. 在 Event Center 显示并导出安装包 SHA-256、构建时间、commit、环境 profile 和 Adapter 契约版本。
3. 使用 HTTPS 域名或配置中心引用检查 AgentTeams 和三平台连接；不得配置或显示裸 IP。服务器迁移后验证 DNS 重连，不重新安装 Desktop。
4. Credential Hub 检查每个平台的 `credentialRef` 和短期委派令牌有效性；屏幕、日志和导出包不得出现原始 API key。
5. 在 `goai-staging` 进行只读预检：权限、时钟、版本、资源、AgentTeams Team Template、录制回放包签名和稳定回滚资源均需通过。

### 2.2 准备数据

| 对象 | 成功案例 | 失败补偿案例 |
| --- | --- | --- |
| DataOps | 基线 128 维，当前 120 维；血缘影响 `risk-feature-service` | 同一契约变化和数据证据 |
| MLOps | 当前 `r18` 不匹配；候选 `r19` 满足离线门槛；稳定点 `r17` | `r19` 已执行受控发布但业务门槛仍不满足 |
| AIOps | 业务通过率下降，P99/错误率/资源健康正常 | 独立探针持续显示业务恢复失败 |
| AgentTeams | 五个身份均在线，固定能力 manifest | 同版本 Team Template 和独立 Verifier |
| 来源 | `LIVE-STAGING` 新建 Run | `LIVE-STAGING` 新建 Run；故障注入记录可见 |

故障注入只能作用于 staging 中隔离的业务阈值或验证探针，不能影响真实生产资源。注入开关本身必须进入证据账本，界面明确写明“验证失败演示”。

## 3. 八分钟主演示

### 0:00-0:45 问题与预检

打开 Event Center，展示业务通过率下降与服务健康正常的并存状态。展示环境为 `LIVE-STAGING`，顶部版本与连接预检均为通过。说明三平台不是三个割裂的页面：AIOps 判断业务和服务，DataOps 判断数据契约，MLOps 判断模型契约；OpenXnet 对跨域结果负责。

### 0:45-1:20 创建新 Run

点击 `Start new Run`。界面生成新的 `runId`、`incidentId`、`traceId` 和 `workspaceId`，从 `INGESTED` 进入 `EVIDENCE_COLLECTING`。展开 Run Header，验证时间、来源、环境、包版本与已有历史 Run 不同。

### 1:20-2:40 五身份协作

打开 AgentTeams Element 视图：

1. Leader 建立范围受限的任务。
2. DataOps Resident Agent 提交 `128 → 120` 维契约差异和血缘影响证据。
3. AIOps Resident Agent 提交业务阈值下降且服务健康的独立证据。
4. MLOps Resident Agent 提交 `r18` 输入契约不匹配、`r17` 回滚点和 `r19` 候选评估。
5. Leader 汇总引用；Verifier 此时尚未判断成功。

对每条泳道至少展开一次记录，展示 `agentId`、角色、允许工具、`contextVersion`、TTL、`requestId`、`evidenceId` 和资源版本。强调这不是角色卡：每名驻场 Agent 只能读取本平台 Adapter，AgentTeams 记录交接和最小上下文。

### 2:40-3:20 证据改变计划

显示 `Plan v0` 仅包含冻结高风险发布与补证。DataOps/MLOps 证据到达后，Leader 创建 `Plan v1`：备用特征止损、受控回填与质量门、候选训练/评估、5% 灰度及退出备用特征。展示 diff、证据引用和旧审批为 `INVALIDATED`。此步骤直接说明证据改变了计划而不是给结论贴证据。

### 3:20-4:05 Human Gate

打开 Human Gate。展示参数摘要、资源白名单、资源版本、窗口、TTL、完整回滚步骤、Skill/Adapter/AgentTeams 版本和 `idempotencyKey`。说明 Executor 在此之前锁定。由演示人员批准完整 `Plan v1`；系统产生审批引用，状态转为 `APPROVED`/`EXECUTING`。

### 4:05-5:25 受控执行

按四个阶段紧凑显示并按需展开：

1. 启用认证备用特征集。
2. 回填受限范围数据并通过质量门。
3. 训练、评估和登记候选 `r19`。
4. 5% 灰度，独立 AIOps 探针满足条件后提升并退出备用特征。

至少展开一个步骤，展示期望/实际、工具调用、重试索引、资源版本、幂等键和回执。说明 Executor 是确定性组件，不是 Agent，不能越过批准范围。

### 5:25-6:20 独立验证与关闭

AgentTeams 把验证任务发送给 Independent Verifier。它不读取 Executor 的“成功”作为结论，而通过独立只读 Adapter 检查五项门槛：业务恢复、数据质量、输入契约、部署 revision、流量/灰度。显示证据引用、判定理由和最终 `RESOLVED`。

显示：

```text
Incident = RESOLVED
Verification = PASSED
businessRecovered = true
certificationEligible = true
```

如展示 Candidate Skill，必须显示它仅由成功 Run 产生、当前认证环境和人工认证状态；不要暗示自动生产执行权。

### 6:20-7:25 同场景验证失败与补偿

切换到第二个新建 Run，明确标注“验证失败演示”。保留相同的取证、Human Gate 和执行语义，压缩展示到 Verifier 判定失败。打开补偿面板，显示：回退稳定 `r17`、保留备用特征、补偿验证成功。

必须停留在如下终态，不能显示为恢复成功：

```text
VERIFY_FAILED → COMPENSATING → COMPENSATION_VERIFIED → FAILED
Incident = FAILED
Action = VERIFICATION_FAILED
compensation = SUCCEEDED
businessRecovered = false
certificationEligible = false
```

展开失败原因、补偿证据和 Verifier 判定，确认没有生成 Skill。

### 7:25-8:00 运维与可复用性

打开版本/健康抽屉和审计导出：客户端、服务端、三个 Adapter、三名 Resident Agent、AgentTeams、Skill、安装包均有关联版本。展示事件账本、证据索引、审批记录、工具调用和 Replay bundle。说明未来 WorldOps/VR 复用同样的证据、审批、执行、验证和恢复契约，不以未验证硬件结果作为本次主张。

## 4. 现场操作边界

- 只用演示 Workspace、白名单资源和 staging 服务。
- 任一计划或资源版本变化自动使审批失效，不临场修改参数继续执行。
- AgentTeams 或上游平台连接失败时，保持错误状态并显示原因；不静默降级到 Builtin、Fixture 或预置 UI。
- 演示者可以暂停 Executor 并使用人工接管，但接管动作、理由和后续恢复均须进入账本。
- 聊天/驻场面板只能查看、解释和升级协同 Run；高风险变更不在聊天框中直接执行。

## 5. 备用 Replay 流程

1. 明确告知评委现场 upstream/网络不可用，并把来源切换为 `REPLAY`。
2. 选择与安装包、Adapter、AgentTeams 和 Skill 完全匹配的签名录制包。
3. Replay UI 固定显示录制时间、来源、录制包 ID、签名校验和版本矩阵。
4. 继续按照第 3 节讲解，但不称其为“现场新建 LIVE Run”。
5. 导出包同时保留原 LIVE 账本和 Replay 元数据，保证可追溯。

## 6. 演示后导出

每个案例导出：Run 事件账本、Evidence index、Tool invocation records、AgentTeams handoff records、Human Gate approval、execution/verification/compensation receipts、版本矩阵和环境健康快照。导出必须脱敏，包含来源标签、哈希和生成时间。
