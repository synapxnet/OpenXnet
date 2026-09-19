<!--
Copyright (C) 2026 Synapxnet. All rights reserved.
This file is Synapxnet Proprietary and Confidential. It is strictly
forbidden to copy, distribute, or use without explicit authorization.
全局企业人工审批提醒设计 / Global enterprise human approval notice design.
Author: maoyo | Department: 研发部 | Date: 2026-09-18
Version: 1.0.0 | Security Level: INTERNAL
__version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
__maintainer__: maoyo | __email__: synapxnet@gmail.com
-->

# 企业人工审批提醒

## 目标和数据范围

审批提醒独立于当前菜单、当前事件、工作空间筛选和运营控制台筛选。每次已认证会话应用真实快照后，从全部工作空间提取需要人工决定的当前审批；首次启动恢复到待审批状态也必须弹出。

候选必须同时满足：Incident.status=AWAITING_APPROVAL、Approval.status=PENDING，且 approvalId/incidentId/workspaceId/traceId 与事件的 activeApprovalId/activeTraceId 精确一致。没有计划 ID、计划摘要、有效授权范围，或存在冲突身份记录时不提供决定入口。所有入口只在 canUseEnterprise===true 且提醒会话已启用时工作；未定义权限视为无权限。

## 冻结审批对象

打开时深冻结 {approvalId,incidentId,workspaceId,traceId,planId,planDigest,scopes}。用户看到的业务标题、工作空间、请求说明、当前 Run 的来源和步骤标题由同一目标的记录投影；不读取全局选中事件。标题、摘要、技术引用、异常及所有可展示的字符串经 getCompetitionApprovalPublicText 清理，不展示原始工具参数。

步骤按审批原 scopes 顺序呈现。任务图必须匹配空间、事件和 Trace，主执行步骤再以 execute:stepId 和 toolName 关联标题；找不到时使用中性说明，不借用别的运行。运行来源仅来自同事件、空间和 Trace 的固化驻场上下文，不回退为当前全局 Live/Fixture 开关。

## 队列和交互

- 第一个未关闭的审批自动弹出。重复轮询不反复弹同一审批计划；关闭只是延后查看，不产生决定。
- 新审批进入待批队列，不替换正在阅读的弹窗。同一 approvalId 的新计划也不能替换旧按钮目标。
- 多项审批通过左侧便签展示，用户明确点击便签才切换；提交期间禁止切换。全部待批便签保持队列顺序，当前已决或失效审批临时保留为当前便签，离开后不形成历史列表。
- 每个完整冻结目标独立保存说明和执行模式草稿。切回同一计划恢复草稿；即使 approvalId 相同，计划摘要或范围变化也不复用草稿。关闭可稍后恢复，成功决定或已决回读清理该项草稿，退出登录清理全部草稿。
- 同一 approvalId 换计划时避免生成重复身份便签：保留当前失效项的标记，用户明确点击该便签后才冻结最新待批计划；轮询本身不替换。
- 待批数始终按全部合法当前审批去重计算；手动入口可重开关闭过的审批。
- 当前审批被其他窗口处理、进入另一 Trace 或计划变化时，保留旧弹窗并标记失效，拒绝旧决定；必须关闭/重新打开才能审阅新项。
- 提交期间禁止重复点击、关闭和切换。成功后保留原项和成功决定说明，不把旧按钮马上换到下一项；关闭后才继续处理队列。
- 退出登录重置队列、关闭弹窗、递增会话代数并禁用提醒；新登录 reset(true) 后恢复。旧会话迟到的读取或写入回执不能修改新会话 UI 或发起后续决定。

## 提交与执行边界

默认 executionMode=step，批准后暂停等待明确后续操作。只有用户在本弹窗明确选择 automatic，批准请求才传 automatic；拒绝始终传 step。模块不调用 execute 接口、不切换当前事件、不打开其他页面。

提交先冻结决定、说明和执行模式，再只读刷新 getApplicationCompetitionSnapshot，逐项比较全部冻结绑定与 scopes。任何状态或绑定差异均停止提交。通过后只调用 decideApplicationCompetitionApproval({approvalId,decision,reason,executionMode,expectedPlanDigest})，服务端继续独立校验摘要、权限和审批状态。

空说明使用清晰的固定说明，例如“用户在人工审批弹窗中选择批准本计划；批准后暂停”，不会伪称用户手工输入了这段文字。请求失败保留原目标和错误，可再次只读检查后重试；网络失败不自动重发决定。

自动模式可能先保存人工决定，再在执行或验证阶段返回异常；也可能被另一个窗口抢先审批。错误分支只读回查一次：完整冻结绑定的决定已经记录时，设置 OutcomeRecovered=true，显示“该计划已有审批决定；本次提交未收到完整回执，请核对审批记录和运行详情”，锁定原按钮，不声称该决定由本次请求产生。只有收到匹配的成功回执才设置 OutcomeRecovered=false。仍待审批则保留重试；回查也失败则明确显示结果暂时无法确认，下一次点击仍先读取再判断。若本次还没有调用决定接口，别人已完成的审批不能成为本次成功回执。

## 接入接口

UMD 导出 root.OpenXnetEnterpriseApprovalNotices 和 CommonJS 的 createState/methods，无独立定时器。主线负责加载模块、注册 Vue、应用快照后的 syncEnterpriseApprovalNotices(snapshot)、HTML/CSS 与登录退出生命周期。

主要状态：enterpriseApprovalNoticeVisible、Target、Pending、Busy、Error、Stale、Reason、ExecutionMode、Dismissed、Enabled、Generation、Outcome、OutcomeRecovered。主要方法：syncEnterpriseApprovalNotices、getEnterpriseApprovalNoticeCount、getEnterpriseApprovalNoticeViewModel、openEnterpriseApprovalNotice、closeEnterpriseApprovalNotice、submitEnterpriseApprovalNotice、resetEnterpriseApprovalNotices(enabled=false)。

ViewModel 字段：title、workspaceName、sourceLabel、summary、requestedBy、requestedAt、approvalId、traceId、planId、planDigest、scopes。每个 scope 包含 stepId、title、toolName、resourceId、targetRevision、expectedResourceVersion、argumentsDigest、compensation。

便签接口：getEnterpriseApprovalNoticeTabs() 返回净化后的 [{approvalId,title,workspaceName,status,current,stale}]，status 为 PENDING / APPROVED / REJECTED / STALE，不携带原始目标或工具数据；selectEnterpriseApprovalNotice(approvalId) 处理显式用户切换。enterpriseApprovalNoticeDrafts 仅保存在当前登录会话内，按完整 targetKey 隔离。

## 验收范围

测试覆盖首次恢复、重复轮询、关闭/重开、多空间队列不抢焦点、重复及冲突记录、读取后已处理/换计划/换范围不提交、重复点击、失败重试、默认暂停和明确自动模式、权限拒绝、退出登录后的迟到回执、输出脱敏，以及不调用执行/页面导航接口。

2026-09-18：`node --test tests/enterprise_approval_notices.test.cjs` 的 26 项行为测试通过，包含多空间便签切换、完整计划草稿隔离、提交中锁定、计划变更不复用旧草稿，以及当前已决/失效便签离开后移除。正常发送夹具使用合法 SHA256 摘要并调用真实后端审批请求解析器验证契约；主线负责真实界面的显示、焦点、关闭与提交联调。
