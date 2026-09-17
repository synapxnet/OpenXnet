<!-- -*- coding: utf-8 -*-
Copyright (C) 2026 Synapxnet. All rights reserved.
This file is Synapxnet Proprietary and Confidential. It is strictly forbidden to copy, distribute, or use without explicit authorization.
Author: maoyo | Department: 研发部 | Date: 2026-09-17 | Version: 1.3.0 | Security Level: INTERNAL
__maintainer__: maoyo | __email__: synapxnet@gmail.com -->

# Live 接入网关 / Live access gateway

客户端仅保存 `oxlive_` 范围授权，平台委托密钥与审批签发凭据留在服务端。此授权不是审批记录。Fixture 的 `oxdemo_` 账本与 Live 账本相互独立，默认不开启 Live，不自动签发授权。

## 接口 / Interfaces

- `POST /api/v1/live-access/check|connect`：`{workspaceId}`；返回 `openxnet.agentteams.live-access.v1`、授权到期/配额、工具与场景白名单、三平台与审批服务检查。检查不执行任何业务工具。
- `POST /api/v1/live/tools/invoke`：原始 `CompetitionToolAdapterRequest`；保留统一平台回执。
- `POST /api/v1/live/actions/read`：`{request,actionId}`；只允许读取本授权、本 Trace 的执行回执中产生的动作。
- `PUT /api/v1/live/approvals/:approvalId`：既有审批发布载荷；精确校验 Workspace、Trace、请求人与审批人、Leader 接受的计划和所有步骤。
- 原有 Team Prepare / Task Dispatch 支持 Live 访问码，必须明确 `X-OpenXnet-Execution-Mode: live`。
- 管理员可通过 `POST /api/v1/live-access/grants` 签发、`DELETE /api/v1/live-access/grants/:id` 撤销；只能使用既有运维 provisioning 身份。

## 范围与事务 / Scope and transactions

授权预绑定工作空间，明确指定 `actorIds`、`approverIds`、`allowedTools`、`allowedScenarios`、`resourceConstraints`，设置 TTL 与请求上限。审批人与执行主体集合不得相交。资源标识不允许通配符。所有对外端点、平台密钥和审批签发凭据仅由服务器环境定义。

Team Prepare 固化事件/Trace/模板/成员；场景由第一阶段固定；调查结论中通过的计划保存在授权账本。审批只能发布这一计划，执行必须命中已发布审批的逐项摘要、资源版本与补偿标记，平台继续执行独立审批内省和资源版本校验。

请求先串行持久化幂等摘要，再执行上游；不同请求可并发，同一请求返回缓存，冲突拒绝。进程中断留下不确定请求，不自动重复写入。审批与工具日志不记录原始凭证。异步动作只能由此前本 Trace 的回执产生。

## 验收 / Acceptance

隔离假上游覆盖未授权、Fixture/Live混用、Workspace/角色/工具/资源/Trace越界、审批缺失/篡改/过期、动作越界、并发/重放冲突、超时、重定向、上游身份不符，以及正常调用。真实环境只做身份和只读健康检查；部署不自动批准、执行业务变更或签发广泛授权。
