<!--
#!/usr/bin/env markdown
# -*- coding: utf-8 -*-
# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.
# 企业运行提醒与浮窗导航 / Enterprise run notices and companion navigation
# Author: maoyo | Department: 研发部 | Date: 2026-09-16
# Version: 1.3.0 | Security Level: INTERNAL
# __version__: 1.3.0 | __author__: maoyo
# __copyright__: Copyright 2026 Synapxnet | __maintainer__: maoyo
# __email__: synapxnet@gmail.com
-->

# 企业运行提醒与浮窗导航契约

复用完成提醒 IPC，增加独立来源 `enterprise_run`。每条企业提醒必须包含 `resultId`、`workspaceId`、`incidentId`、`traceId`，禁止混入会话或普通任务身份。公开内容仅包含短标题、短摘要、状态和时间；不传审批参数、模型思考、工具请求体或凭据。

状态沿用 `action_required`（待人工决定）、`completed`、`failed`，增加仅浮窗显示的 `running`。运行中不发系统完成通知。每次状态变化产生新的结果身份，重复投递不再次提醒。浮窗读取近期快照保持静默，不重放完成通知。

发布与点击均由 Main 的 `validateEnterpriseRun` 回调重新读取真实运行快照，要求事件、空间、Trace 归属一致且 Trace 等于事件的 `activeTraceId`；旧 Trace 和缺失身份拒绝处理。未开始、没有 Trace 的事件不发布运行提醒。终态保留相同 active Trace，因此可以回看；重新运行后旧通知失效。

点击只传近期 `resultId` 回 Main，再用已核验的完整身份打开正式运行指挥台详情。浮窗不调用审批、执行或重试接口，也不把企业运行转换成普通 `task`。详情加载再次核对身份，过期提醒显示状态已更新并提供总览入口。

## 实现分工与验收

- 发布与导航协议、Main IPC 核验、共享浮窗桥接、两个浮窗公开字段保留与边界测试：`release_readiness`。
- Main 注入真实快照核验回调：主任务。
- Renderer 状态变化发布、`openCompletionNoticeTarget` 企业分支、正式详情与失效提示：`ops_console_fix`。

测试覆盖缺失身份、错误来源、跨空间/跨事件/跨 Trace、重复结果身份、过期 Trace、仅浮窗运行中状态、短摘要脱敏、两浮窗真实处理函数及只导航不执行。最终还需在真实桌面检查运行中、待审批、终态的浮窗显示与返回正式详情。

2026-09-16 代码验收：`tsc -p tsconfig.desktop.test.json` 通过；Main 完成提醒与浮窗桥接/真实页面处理函数共 22 项通过；原聊天完成提醒回归 7 项通过。这些结果证明协议与边界行为，尚不代替整包真实窗口验收。
