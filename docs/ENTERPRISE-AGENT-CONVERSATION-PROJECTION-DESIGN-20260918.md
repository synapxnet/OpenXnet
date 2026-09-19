# 企业群聊真实 Agent 运行记录投影

Copyright (C) 2026 Synapxnet. All rights reserved. Proprietary and Confidential.
Author / Maintainer: maoyo · Department: 研发部 · Date: 2026-09-18 · Version: 1.0.0
Security Level: INTERNAL · Contact: synapxnet@gmail.com

## 问题和边界

现有主进程在 AgentTeams 返回任务后、决策持久化前直接写入传输正文；企业消息又根据当前员工启用状态和项目指派解析身份。历史员工变更、收件人范围变化或一次写入失败，都会导致只剩 Governance 通知。没有历史补齐与稳定消息标识。普通发送消息只保存领导留言，不调用模型；本次不把 @ 员工等同于模型已接单，也不让留言触发审批或执行。

## 可信来源和范围

投影以已保存的 agentDecisions、teamBindings.memberSnapshots、incidents 和 evidence 为唯一来源。逐条核对 workspaceId、incidentId、traceId、bindingId、teamName、roleCardId、teamRole；projectId 使用该事件已保存的项目。团队必须为 AgentTeams。展示姓名取运行时绑定快照，不使用自由文本 agentName 授权，不依赖角色卡今天是否存在或启用。

Leader 路由只在持久记录具有 routedByRoleCardId、对应 Leader 快照和任务摘要时出现；阶段输出由真实 Worker / Leader / Verifier 发出。只展示结构化任务分工、阶段结论、工具名与同 Run 证据引用，不显示系统提示词、隐藏推理或原始传输正文。摘要进行凭据和推理标记过滤。缺失真实记录时保留缺失状态，不编造对话。

## 接口和恢复

- Competition Runtime 在 decision 保存后调用 recordAgentConversationProjection；失败仅记录固定诊断，保持运行和审批状态。
- Main 将安全消息批次交给 Enterprise Runtime 的内部 recordAgentConversationProjection；这个接口不注册 IPC。公开 postMessage 仍严格只允许领导输入字段。
- 企业 listMessages 在通过工作空间/项目校验后调用 reconcileAgentConversations，同范围读取历史决策并幂等补齐。固定消息 ID 由工作空间、项目、事件、Run、任务、决策和消息类型计算；批次原子写入，重启/并发刷新不重复。
- 已写入的旧同源 Agent 消息转换为规范投影；系统治理消息仍保留 Governance 身份。落盘成功即 delivered，业务验证失败仍由 operation.phase 表达。
- listMessages 的可选 projectionWarning 说明尚未同步的历史记录，用户刷新可重试；不返回异常堆栈或密钥。

## 验收

验证三个真实角色及路由、历史补齐/重启幂等、项目与 Workspace 隔离、删除或停用员工后仍保留历史身份、拒绝伪造 sender、引用范围异常拒绝投影、敏感正文不泄漏、投影失败不改变治理状态、重新刷新可恢复。

已执行 TypeScript 编译；Competition / Enterprise / 治理卡与新投影测试通过。新增测试覆盖凭据和内部提示词过滤、来源篡改拒绝、读群补齐、并发刷新与重启幂等、公开 sender 注入拒绝、单条损坏来源隔离、旧同源回执替换和批次原子性。Fixture 测试数据不代表新 Live 运行。
