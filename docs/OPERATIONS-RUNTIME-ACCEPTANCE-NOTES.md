<!--
#!/usr/bin/env markdown
# -*- coding: utf-8 -*-
# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.
# 运营运行时验收修正 / Operations runtime acceptance corrections
# Author: maoyo
# Department: 研发部
# Date: 2026-09-16
# Version: 1.3.0
# Security Level: INTERNAL
-->

# 运行时修正设计与验收边界

## 已确认问题

1. 旧事件保存 `ws_goai_demo`，前端把模板筛选转换为真实工作空间，但运行时仍比较原事件范围，产生范围不匹配。
2. 平台检查仅判断 HTTP 状态，404 和其他平台的 200 登录页也被标记为在线；界面的身份状态没有服务端来源。
3. 正式运营页仅展示当前事件审批、并把详情跳回比赛入口。这部分由运营页面改造处理。

## 工作空间契约

- Main 注入企业运行时 `resolveWorkspaceId`，新建事件必须使用已存在的真实工作空间。
- 历史演示别名仅能映射到名称准确为 `GOAI Competition Demo` 的唯一空间，或仅有的一个空间；多个候选时要求明确选择。
- 只允许自动修复尚未开始、没有 Trace/证据/审批/执行等范围记录的 OPEN 事件。
- 已有运行和审计记录不能改属其他空间；需要继续保留原记录，并在正确空间创建新事件。
- 后端团队范围严格比较保留，不能通过放宽 UUID 比较绕开隔离。

## 平台身份契约

- `connectionStatus` 单独描述未检查、地址可达或不可达。
- `identityStatus` 描述待检查、身份核对通过、平台不符、未识别或不可用。
- `identityPlatform` 与 `identitySource` 保留可公开核对的产品身份来源；根页面 title 是部署已验证的产品标识，不代表模型、数据库或驻场 Agent 已健康。
- 只有 HTTP 2xx 且产品身份与配置平台相同，旧兼容字段 `status` 才为 `online`。404、重定向、错误平台和普通网页不算在线。
- 禁止跟随重定向，响应读取有时间和大小上限。地址变化清除旧身份结果。

## 验收方法

运行现有企业/竞赛服务测试，并增加真实服务方法的本地隔离回归：别名解析、模糊/删除空间拒绝、未运行事件校准、历史审计保留、正确/错误平台、404、普通页面、连接失败、状态持久化。

本文件中的自动化结果属于代码与隔离运行时验证。线上仅允许只读检查公开页面产品标识，不冒充真实业务执行；最终桌面布局和操作顺序由主验收任务另行截图确认。

## 本轮已执行的检查

- 2026-09-16：Renderer、沙盘协作和演示空间初始化现有测试 38 项通过；这没有覆盖最初的跨空间审批和平台身份缺口，不能据此宣布整体验收完成。
- 2026-09-16：新增工作空间升级/审计保护、平台身份测试，与原企业及竞赛运行时一起执行，38 项全部通过。业务链使用临时目录和 Fixture，不是线上新 Run。
- 2026-09-16：新运行时在临时配置目录只读请求三个线上公开主页，均识别到各自准确产品标题；故意把 DataOps 配置指向 MLOps 时，结果为 `offline / reachable / mismatch / mlops`。未变更真实账户配置。
- 页面标题核对属于产品页面归属检查，不等于驻场 Agent 已运行、模型已连接、证据已采集或权限认证完成。
- 新增三空间顺序验收：企业运行时创建三个真实 UUID；同一控制面分别运行成功恢复、验证失败并补偿、停在人工审批三条 Fixture。校验自批、自验、跨空间复用幂等键、错误范围资源 URI 均被拒绝，未处理事件的审批/证据完全保留，重启后全部快照一致。此处人类身份沿用 Main 的企业级审批权限，不声称已增加每空间独立 RBAC。
- 本机进程、User、Machine 三层均没有竞赛 AgentTeams 专用启动配置。已只读确认既有公网 Adapter 健康接口可达；服务器上 Adapter `1.1.1-workerlease.6` 健康、Controller `v1.2.0` 与 Manager 运行，Adapter 独立 session 已配置。旧 Worker 当前均退出，未通过只读检查推断其按需唤醒或任务执行已成功。本轮未启动 Worker、创建线上 Team 或发送线上任务。

## 恢复验收后的启动设计

本地管理启动脚本在 Electron 创建前经既有、固定主机指纹 SSH 路由读取唯一的 AgentTeams 委托密钥，只放进新进程环境；不输出凭据、不保存配置、不读取南向写入或审批签发密钥。启动前检查本地模式为 Fixture、产品公开健康接口和已部署请求契约。源代码版与已打包版共用该方式。运行时准备/派发改为动态读取 AgentTeams 开关，兼容 Main 构造后才加载的配置。

已部署 Adapter 的请求 schema 名称仍为 v1，但其任务 context 只接受六个旧字段，不接受新版 `residentContexts`。仅匹配 schema 名称不能宣布兼容；需要明确兼容范围或升级契约后，才能进行实际任务。启动脚本不自动修改线上服务、不替用户发送任务。

## 独立验证结果一致性修正

实际桌面验收暴露 Builtin 路径虽然执行独立只读验证并产生成功审计回执，UI 和 Skill 认证却只查 AgentTeams 的 Matrix 决策，而任务图从 RESOLVED 状态推断成功。三个视图因此产生矛盾，原验收不算通过。

审计回执 `openxnet.remediation.verify` 增加可选 verification 明细：runtime、actionId、decision、evidenceIds、errorCode。新运行在真实验证成功或失败时保存明细；失败回执在补偿之前保存。Builtin 使用独立执行者与确定性业务阈值，不能伪造 AgentTeams 身份或 CLOSE 决策；AgentTeams 除独立探针成功回执外仍须有真实 Verifier CLOSE。

完成门禁、任务图和 Skill 认证须核对相同 Workspace / Incident / Trace / Action、验证者与执行者分离、完整验证工具及对应证据。仅有 RESOLVED 或缺失明细的旧回执不授予通过状态，不回写历史结论。验证失败与通信错误均保留明确失败原因并进入原补偿流程。新增成功、失败、身份/证据不符及重启持久化回归。此修正只证明 Fixture 业务链，不把 Builtin 当作 AgentTeams 现场协同。

- 2026-09-16 修正后：TypeScript 编译通过；运行时、Workspace、企业配置、平台身份、AgentTeams HTTP 契约、Memory 授权与 Main IPC 合计 52 项通过。
- AgentTeams 隔离联验使用实际 Desktop HTTP 请求序列化与维护中 Adapter 的 `parseTaskRequest`，三阶段分别是 ctx-1 / ctx-2 / ctx-3；复验只传 5 个新验证证据，历史调查事件保持完全一致。网络返回为测试替身，因此不作为现场 AgentTeams 新 Run。
- 维护中 Adapter 的加密会话、委托、HTTP 契约、新旧上下文、跨范围拒绝与真实提示词构造合计 7 项通过；线上镜像已完成备份与更新。
- 新镜像 `b952e26598f5…6a599`，公开健康和源码 `AgentTeams + Fixture` 启动预检通过，旧会话保留。完整备份与部署回执参见 `services/openxnet-agentteams-adapter/DEPLOYMENT.md`。实际桌面新 Run 已完成 `.1` 完整闭环；`.2` 仍仅有规划阶段复测，未把健康结果当成 `.2` 完整协同成功。
