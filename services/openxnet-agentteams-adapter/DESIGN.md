<!--
#!/usr/bin/env markdown
# -*- coding: utf-8 -*-
# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.
# 驻场上下文契约补丁 / Resident-context contract patch
# Author: maoyo
# Department: 研发部
# Date: 2026-09-16
# Version: 1.3.0-contract.2
# Security Level: INTERNAL
-->

# AgentTeams Adapter 1.3.0-contract.2

本次增量版本修正取证规划与实际观测的语义边界。设计先写于 `docs/AGENTTEAMS-STAGE-SEMANTICS-DESIGN.md`：Leader、Worker 及纠错提示均声明规划只选择工具；调查只引用当前证据；复验只引用本次独立证据。保留原始模型回包、同一预算和一次纠错上限，HTTP 字段不变。

## 来源与修改目的

本目录从当前线上 `synapxnet/openxnet-agentteams-adapter:1.1.1-workerlease.6` 的 `/app/src`、包元数据及许可证复制，保留受控 Worker 生命周期、队列、独立登录和加密卷协议。比赛提交归档不作修改。原有许可证和第三方声明保留。

Desktop V1.3.0 已在任务 context 发送 `residentContexts`，原服务只接受六个旧字段，导致实际请求 400。补丁正式接入上下文并进入 Leader/Worker 的实际任务文本；不删除字段、不把忽略字段称为接入。

## 契约

原 prepare/task v1 schema 和旧请求保留；task.context 可选增加 `residentContexts`，存在时必须为 1～3 个唯一平台上下文，总计最多 64 KiB。

每个上下文严格限定 Workspace、Incident、Trace、Run、平台、固定 Agent ID、环境、来源、版本、到期时间、证据引用及只读工具名单。所有运行归属必须与已验证的 task request 一致，Run ID 为 `run-<traceId>`；平台对应唯一 `agt-<platform>-resident-v130`。版本为 `ctx-N`；TTL 必须未过期且不超过当前时间 30 分钟。工具只能是该驻场 Agent 的固定只读能力子集，不能混入其他平台或写工具。

证据引用必须在当前任务 evidence 集合内，且其工具属于同一平台。验证阶段由 Desktop 单独形成 `ctx-3`，引用本次独立验证证据；调查阶段的历史事件和证据不改写。多平台上下文不能混用环境、来源或运行范围。

解析后上下文进入实际 Leader 路由及目标 Agent 的完整上下文。提示词明确其为只读能力和证据来源，不赋予平台执行权。模型输出仍通过原有决策/工具/证据/Matrix 身份校验。排队后和真正发消息前再次检查 TTL，过期不会继续推理。

## 版本与预检

公开 GET `/health` 保留 schema/status，增加 `version: 1.3.0-contract.2`、`capabilities.residentContexts: true`。这些字段不包含部署凭据或独立会话信息；版本以镜像内 package.json 为准，旧环境变量不会覆盖制品版本。

管理启动器通过固定 SSH 路由只在内存中注入 AgentTeams 委托密钥；南向保持 Fixture，不读取平台执行或审批签发凭据。配置就绪不等同实际任务成功。

## 验证与发布顺序

1. 在本地测试旧六字段请求、新上下文及跨空间/平台/身份/TTL/证据/写权限攻击请求。
2. 使用真实 CLI 提示词构建路径配合隔离 Matrix 测试，确认上下文到达 Leader 与 Worker；使用 HTTP 隔离测试确认非法请求在派发前拒绝。
3. 校验 Desktop 三阶段范围与独立验证 ctx-3，不改历史调查引用。
4. 基于当前已部署镜像构建仅替换应用源代码和包版本的新镜像，保留官方 CLI、Worker 保护和基础依赖。
5. 向主验收代理交付差异、测试和备份/更新计划，代码审查通过后才更新当前 Adapter 服务；部署前保留旧镜像、Compose、环境文件及卷的安全备份。日志和回执不输出密钥。
6. 只重建 Adapter，保留相同网络、卷和服务环境；检查健康版本、独立会话仍已配置。先由用户界面触发新的 AgentTeams+Fixture 取证，确认真实身份化回执，再验收后续流程。
7. 回退使用原镜像与配置重新创建同一 Adapter。补丁不变更加密文件和映射格式，不需要降级数据迁移。

## 构建和回滚设计补充（先于构建文件）

2026-09-16 已通过既有固定 SSH 路由只读核对运行容器。基底为 `1.1.1-workerlease.6`，实际 Image ID 为 `sha256:463f3f04dec51cd206f03b8274ed24e81a386eb933df2944d378af6819b63b4a`。Dockerfile 采用已存在的本地标签，构建前必须独立校验该标签的 Image ID；不把配置 ID 拼装成仓库摘要。实际 RepoDigests 单独记录于部署文档。构建仅替换 `/app/src` 和 `/app/package.json`，保留 CLI、依赖、入口、用户、健康检查及原有许可证；不下载安装新依赖。

Compose 项目是 `synapxnet`，服务是 `openxnet-agentteams-adapter`，须启用 `agentteams` profile。现有三层配置为 `/opt/synapxnet/compose.yml`、`compose.override.yml`、`compose.worker-lease.yml`；其中 override 为指向 `compose.competition.yml` 的符号链接，备份须同时保留链接与目标。新交付增加第四层仅覆盖镜像引用，并通过 `--no-build` 禁止误用继承的旧构建配置。

数据卷 `synapxnet_agentteams-data` 挂到 `/data`；共享宿主路径 `/home/ubuntu/.openxnet-worker-activity` 挂到 `/worker-activity`。更新仅重建 Adapter，不删除卷、不变更网络、不重建 Controller/Manager 或三平台。备份须在没有活动任务且 Adapter 已停止后进行，并在 Worker 共同锁内备份共享目录。普通回滚仅退回镜像，不覆盖当前审计或会话数据；完整数据灾难恢复单独评估，不能通过覆盖共享租约状态影响仍运行的 Worker。

复制源码中缺失文件头的文件增加维护元信息及 `SPDX-License-Identifier: AGPL-3.0-only`，原许可证与第三方声明原样保留。已有文件头中的不同声明属于历史来源，本补丁不凭维护元信息改变原许可范围。

完整可审阅步骤见 `DEPLOYMENT.md`。本次交付仅准备构建与回滚材料，不代表已经构建或部署线上镜像。
