<!--
#!/usr/bin/env markdown
# -*- coding: utf-8 -*-
# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.
# 平台驻场 Agent 服务 / Platform resident Agent service
# Author: maoyo
# Department: 研发部
# Date: 2026-09-16
# Version: 1.3.0
# Security Level: INTERNAL
# __version__ = "1.3.0"; __author__ = "maoyo"; __copyright__ = "Copyright 2026 Synapxnet"
# __maintainer__ = "maoyo"; __email__ = "synapxnet@gmail.com"
-->

# Platform Resident Agent V1.3.0

三份独立 Node 22 服务分别驻于 AIOps、DataOps、MLOps。每份服务拥有自己的数据目录、AES-GCM 密钥文件、模型配置和本平台只读工具清单。反向代理将本平台 `/api/resident/v1/` 路由至对应进程。不会启动 Fixture，不允许模型执行高风险写操作。

## HTTP contract

除 `/health` 外均使用现有平台 `Authorization: Bearer <JWT>`，服务向 `RESIDENT_USER_INFO_URL` 请求用户身份，不信任浏览器自报身份。实际 `userType=admin`、`roles` 包含 `ADMIN` 或部署方在 `RESIDENT_ADMIN_USER_IDS` 显式授权的真实 `userId` 可以配置模型及调用平台证据工具；该授权仅适用于驻场服务，不改变平台角色。普通用户可以使用个人领域聊天。会话和任务按用户 ID 隔离。

| Method | Path | Result |
| --- | --- | --- |
| GET | `/health` | 进程存活、版本及平台，不表示模型或平台已连通 |
| GET | `/api/resident/v1/status` | 模型是否配置、工具连接是否配置、当前权限和作用域 |
| GET/PUT | `/api/resident/v1/model` | 脱敏模型配置；PUT 管理员限定，空 apiKey 保留现有值 |
| GET/POST | `/api/resident/v1/conversations` | 个人会话列表 / 创建 `{title?, workspaceId?}` |
| GET | `/api/resident/v1/conversations/:id` | 消息、事件、任务和明确来源标记 |
| POST | `/api/resident/v1/conversations/:id/messages` | `{content, clientMessageId?}`；202 返回 `{taskId, conversationId, status}` |
| POST | `/api/resident/v1/conversations/:id/escalations` | `{reason}`；保存 `PENDING_HANDOFF` 协同请求，不伪称 Run 已创建 |
| GET | `/api/resident/v1/tasks/:id` | 轮询任务状态和错误码 |
| POST | `/api/resident/v1/tasks/:id/resume` | 显式恢复 `INTERRUPTED/FAILED` 任务；只读工具可重新取证 |
| POST | `/api/resident/v1/tasks/:id/stop` | 中断当前模型请求，任务为 `INTERRUPTED`，保留已取回证据 |

所有响应使用 `{code, data}`；失败使用 `{code, message, errorCode}`。任务状态为 `QUEUED/RUNNING/SUCCEEDED/FAILED/INTERRUPTED`。进程重启把未结束任务标为 `INTERRUPTED`，用户可恢复；不自动重放模型或动作。消息、工具输入/输出、来源和证据引用可在会话展开查看，原始密钥不进入记录。`SUCCEEDED` 只代表这次聊天任务完成，不等于业务事件已恢复。

## Deployment configuration

- `PLATFORM=aiops|dataops|mlops`, `PORT=8090`, `HOST=0.0.0.0`.
- `RESIDENT_DATA_DIR=/data`，三个进程必须各用独立卷。
- `RESIDENT_ENCRYPTION_KEY_FILE=/secrets/resident.key`：32 字节原始密钥文件，不存在时按 0600 创建。
- `MODEL_BOOTSTRAP_FILE=/secrets/model.json`：可选一次性导入 `{baseUrl, model, apiKey}`，导入后以各自加密配置为准。
- `RESIDENT_USER_INFO_URL`：固定本平台身份接口；`RESIDENT_AUTH_HEADER=Authorization`，`RESIDENT_AUTH_SCHEME=Bearer` 可按平台调整。
- `RESIDENT_ADMIN_USER_IDS`：由部署所有者管理的驻场服务管理员真实 userId 白名单，不允许浏览器修改。
- `RESIDENT_TOOL_BASE_URL`：固定本平台 Adapter 的 HTTPS 或容器本地 HTTP origin，不接受模型传入 URL。
- `RESIDENT_ALLOW_HTTP_TOOLS=true`：显式允许固定容器根地址 HTTP；默认仅 HTTPS/loopback。
- `RESIDENT_DELEGATION_SECRET_FILE`：已有平台 Adapter 的 HS256 secret 文件；签发 5 分钟、单工具、单 Workspace 委派。
- `RESIDENT_WORKSPACE_IDS=ws_goai_demo`：服务器批准的工作空间白名单，浏览器无法扩展；未配置禁用平台工具。
- `RESIDENT_MODEL_ALLOWED_HOSTS`：可选模型域名白名单；模型 URL 禁止凭据、查询、片段和重定向；HTTPS 默认，内部 HTTP 需 `RESIDENT_ALLOW_HTTP_MODEL=true`。
- `RESIDENT_SOURCE=LIVE-STAGING`：只接受明确的 `LIVE-STAGING/REPLAY/SIMULATION`。服务从不把预发布描述成生产。

## Runtime and governance

构建脚本从当前 TypeScript 构建产物复制固定 Registry、参数验证器和 HTTP Adapter，避免出现第二套不一致的工具定义。运行时只暴露本平台 `riskLevel=READ` 且无需审批的工具；模型工具名使用兼容的下划线名称映射回原固定名称。普通用户暂不授予工具权限，因为现有身份接口没有可信的工作空间成员关系。

模型使用 OpenAI 兼容 `/chat/completions`，提供有限上下文及固定系统边界，最多六轮、十二次工具调用。每次工具调用保持 `requestId/workspaceId/incidentId/traceId/actorId`，使用既有公共 ToolResponse 严格校验。模型文本仅为建议；协同、审批和业务终态只能由控制面完成。

持久化采用原子写入；每次状态变更按队列串行提交。任务最多四个并行，个人同时最多一个任务，同一会话限制消息与事件数量。客户端消息 ID 支持重试去重。恢复不需要保留浏览器 JWT；每次恢复重新鉴权。关闭时中止网络请求并保存中断状态。

## Deliberate integration boundary

协同请求在本服务持久保存为 `PENDING_HANDOFF`，包含来源 Agent、证据和上下文版本。在 AgentTeams 的入站 Run 创建接口完成接线前，不返回虚构的 `runId`；状态接口明确显示 `handoffAvailable=false`。服务心跳当前由健康探测发现；控制面的在线注册另由部署集成。
