<!--
Copyright (C) 2026 Synapxnet. All rights reserved.
This file is Synapxnet Proprietary and Confidential. It is strictly
forbidden to copy, distribute, or use without explicit authorization.
企业审批提醒后端边界 / Enterprise approval notice backend boundaries
Author: maoyo
Department: 研发部
Date: 2026-09-18
Version: 1.0.0
Security Level: INTERNAL
Maintainer: maoyo
Email: synapxnet@gmail.com
-->

# 企业审批提醒：后端决策边界

需要人工决定时，企业全局提醒使用既有 Competition typed IPC，不创建另一条审批链。普通聊天工具授权与 Kernel ApprovalCenter 仍使用各自的契约；不得将“允许并执行工具”当作企业计划的“仅批准”。

## 请求与身份

- Renderer 提交 `approvalId`、`decision`、`reason`、`executionMode` 和可选 `expectedPlanDigest`。
- `expectedPlanDigest` 是用户实际查看的计划 SHA-256 小写摘要，必须精确匹配当前审批。旧调用可省略，但仍须经过全部当前运行范围检查。
- Main 的 `withTrustedActor` 保留摘要字段并覆盖 `actorId`。Renderer 不提供可信审批人身份。
- 默认 `executionMode: "step"` 仅记录审批。既有 `automatic` 模式仍须显式选择，并由 Main 提供分离的执行人、验证人；不能由弹窗静默启用。

## 原子决策检查

在 Store 同一次串行读改写内，批准和拒绝均检查：

1. 审批仍为 `PENDING`，审批人与申请人不同。
2. 事件的 `activeApprovalId`、`activeTraceId` 与该审批一致；事件、审批、Trace 的 Workspace 和事件标识一致。
3. 事件和 Trace 均仍等待审批，事件没有当前执行动作。旧 Run、已替换审批和终态事件不能通过旧弹窗改变当前 Run。
4. 审批计划标识、主工具、资源、目标版本、预期资源版本与事件当前计划一致。
5. 有序执行步骤、补偿步骤和每一步 scope/参数摘要全部匹配当前计划；摘要也须匹配界面传来的 `expectedPlanDigest`（若提供）。

检查失败时原快照不变，不发送审批投影，不写新的知识记录，不调用执行器。范围或计划变化返回 `APPROVAL_SCOPE_MISMATCH`；已决审批返回 `APPROVAL_STATE_INVALID`。前端刷新内容后要求用户重新审阅。

当前契约没有 `expiresAt`，不得显示虚构的到期时刻。本次失效语义为当前 Run/审批被替换、状态关闭或计划发生变化。若将来增加定时有效期，需要同时扩展持久化契约和事务检查。

## 验收

使用临时用户目录和 Fixture；不连接线上、不发真实群消息、不决定真实审批。覆盖旧 Run 的批准与拒绝都不改变当前 Run、Workspace/Trace/状态不一致、计划和 scope 被替换、用户所见摘要过期、重复/并发决策，以及既有仅审批和自动闭环流程。

## 既有异步入口的账户保护

全局快照应用点新增审批提醒后，原工作台和项目群的读取、创建、调查、审批、执行、验证、切换模式及重置入口也必须冻结调用时的账户标识与观察代数。每次等待返回后以及异常、清理阶段都复核；旧账户结果不能更新快照、重新入队、关闭新账户的忙碌状态或发出旧结果通知。确认框同样受保护，账户切换后才点击旧确认框不得提交重置。直接嵌套的配置、记忆读取和运行详情导航也遵守同一条件。抽取测试宿主未提供生命周期字段时保持原兼容性。
