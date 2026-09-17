<!--
Copyright (C) 2026 Synapxnet. All rights reserved.
This file is Synapxnet Proprietary and Confidential. Copying, distribution, or use requires explicit authorization.
AgentTeams 阶段语义与证据表达 / AgentTeams stage semantics and evidence presentation.
Author: maoyo | Department: 研发部 | Date: 2026-09-16 | Version: 1.3.0 | Security Level: INTERNAL
Maintainer: maoyo | Email: synapxnet@gmail.com
-->

# 规划阶段不能呈现为已完成取证

## 实机发现

本次实际 AgentTeams 运行 `trace_1d476ade-ce1f-48b8-a744-bf44c1bec8cb` 的取证规划请求 `context.evidence=[]`，没有已执行工具结果。Leader 路由却把任务描述成“必须调用全部 9 项只读工具，输出结构化证据报告”，Worker 随后声称完成调用，并生成了输入中不存在的服务/副本异常数值。一次格式纠正后，这些无依据状态仍留在摘要中。

实际任务输入和角色卡不包含这些错误指标；它们首先出现在 Worker 返回文本中。此处不能把模型摘要当作证据或修写历史记录。后续真正的 9 次 Fixture 调用成功，独立 Evidence 记录与审批决策使用这些调用结果；规划摘要没有改变受控工具名单。

## 根因

- `agentteams-cli.js` 的 Leader 路由要求明确任务边界，但没有说明规划阶段只选工具、尚未执行。
- Worker 请求统一把 `summary` 描述成“有证据支撑的中文结论”，对证据集合为空的规划阶段也使用相同说明。
- 规划校验已经限制工具全集、空证据引用和固定 `COLLECT_EVIDENCE`，但允许摘要中的自然语言事实声明。这种文本通过语法校验不等于声明有证据。
- `goai-evidence-collect` Skill 原本要求选择计划，由 OpenXnet 随后执行；Leader 生成的 taskBrief 没有被阶段约束明确覆盖。

## 本轮界面表达方案

保持现有请求合同和不可变运行记录。规划卡片的主要文本由实际通过校验的 `requestedToolNames` 生成，例如“已选择 9 项只读工具，等待采集平台证据”；主流程只能根据持久化 Invocation / Evidence 更新“已执行”“有证据”等状态。

原始模型摘要保留在对应阶段的审计展开区，说明其所属阶段为取证规划。不能覆盖原始摘要、把计划数改成证据数，或把尚无证据的模型指标放入真实证据栏。正在查看历史规划时，显示当时的阶段事实，不能用稍后采集成功来为此前的错误声明背书。

## 阶段提示词修正

无需更改 v1 字段集合。Leader 与 Worker 均加入不可被 taskBrief 覆盖的阶段约束：

1. `INVESTIGATION_PLAN`：当前没有任何平台工具结果。只选择原请求的工具全集和说明采集目的；OpenXnet 在该计划通过后才执行工具。`evidenceIds=[]`，摘要只能描述准备采集什么，不得声称调用完成或生成实测数值、健康结论、成功结论。
2. `INVESTIGATION_CONCLUSION`：只能基于当前请求 Evidence 的引用与信号生成处置建议；事故标题、示例、历史记忆和规划摘要不是当前测量结果。
3. `VERIFICATION_CONCLUSION`：只依据本次独立验证证据及确定性门禁决定关闭或补偿；不能把执行回执当恢复证明。

请求中的 JSON 示例也按阶段分别表述摘要含义。纠正提示应明确对应违规点，保留原预算与已有有界纠错次数，不靠扩大重试掩盖失败。

自然语言关键词黑名单不能可靠判断“完成取证计划”和“完成工具调用”的差别，因此不能把简单匹配“完成”当作完整语义防护。当前主要展示采用结构化事实，后续如需要机器严格验证模型事实声明，应通过版本化 claims 字段绑定 Evidence ID，另行升级合同。

## 验收要求

- 规划请求的 Evidence 为空时，UI 不展示生成式测量结论；点击可查看原始模型输出与所属阶段。
- 用实际原请求构建 Leader/Worker 提示词，检查两个入口都明确规划不能执行或声称结果。
- 故意返回“工具已完成、服务异常”等规划摘要，验证主流程仍展示规划事实，真实 Evidence 数量仍为 0。
- 后续真实调用有 9 条 Evidence 时，只有证据视图与调用状态增加，规划原记录保持不变。
- 独立 Verifier 的真实 CLOSE / ROLLBACK_REQUIRED 与确定性门禁继续分别核对。

本文先于代码修正写入。2026-09-16 已在 Adapter `1.3.0-contract.2` 实现阶段边界、分阶段摘要说明与同阶段纠错；HTTP 合同未改，原始运行记录保持不变。

隔离验收共 11 项通过，新增的 4 项覆盖真实 Leader 路由、Worker 的一次工具集合纠错、通用格式纠错、第二次无效输出失败、调查/复验语义隔离、原始摘要保留及伪造证据引用拒绝。真实 Matrix 等待代码由隔离收件箱驱动，未向线上发送消息。

线上更新须等待既有 Run 终止及租约/在途连接归零，先备份 `.1` 镜像、配置和共享卷，再切换 `.2`。提示词只能约束模型行为，不能证明新模型输出正确；部署后另建只读规划探测并审计原始输出，历史 `.1` 运行不能充作 `.2` 提示的通过证据。
