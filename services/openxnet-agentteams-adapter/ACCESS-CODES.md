<!--
#!/usr/bin/env markdown
# -*- coding: utf-8 -*-
# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.
# 演示访问码接入契约 / Demo access-code integration contract
# Author: maoyo | Department: 研发部 | Date: 2026-09-17
# Version: 1.3.0-contract.3 | Security Level: INTERNAL
# __version__: 1.3.0-contract.3 | __author__: maoyo
# __copyright__: Copyright 2026 Synapxnet | __maintainer__: maoyo
# __email__: synapxnet@gmail.com
-->

# Adapter 1.3.0-contract.3 演示访问码

设计依据：`../../docs/AGENTTEAMS-IN-APP-CONNECTION-DESIGN.md`。本文件描述实现契约，不代表已部署。

## 签发与撤销

仅运维 provisioning 身份可调用：

- `POST /api/v1/access/grants`，JSON 为 `{label, workspaceId?, expiresInSeconds?, maximumRequests?}`。label 必填，最多 120 字符；工作空间可暂不绑定；有效期默认 86400 秒，范围 60～604800；请求额度默认 40，范围 1～200。
- 签发返回公开 access 元数据和一次性 `accessCode`，格式为 `oxdemo_` 加 64 位随机十六进制字符。签发响应不得写入日志或公开制品。
- `DELETE /api/v1/access/grants/:grantId` 撤销。保留账本，后续请求包括缓存重取均拒绝。

## 用户连接

`POST /api/v1/access/check`、`POST /api/v1/access/connect` 均接受 Bearer 访问码及 `{workspaceId}`。

响应：`{schema:'openxnet.agentteams.access.v1',grantId,label,workspaceId,expiresAt,remainingRequests,modes:['fixture'],serviceReady}`。

check 不改变绑定，不扣额度；connect 在单一事务内绑定第一个工作空间。预绑定或已绑定的码不能连接其他空间。serviceReady 表示服务内的 Controller/Matrix 会话配置完整，不是一次模型任务成功或三平台 Live 授权。

## 运行与隔离

prepare/dispatch 沿用原请求契约及结果校验。访问码路径必须提供 `X-OpenXnet-Execution-Mode: fixture`；dispatch 必须包含完整 AIOps、DataOps、MLOps 驻场上下文，环境均 staging、来源一致且仅 SIMULATION 或 REPLAY。它不获得平台工具写权限或审批签发权限。

授权在服务端注入内部 `accessGrantId`；客户端不接受该字段。Team 和 Worker 名称额外绑定授权、工作空间、模板和版本，避免公共演示中相同角色 ID 复用其他租户 Worker。旧 JWT 的命名及会话不变。

每个新 requestId 扣一次配额；完整解析后请求摘要必须相同。每码同时最多一个请求。完成和失败回执持久化后才返回，同请求重试返回既有回执，不重复扣费或重复副作用。失败后如需重新执行，需要新 requestId（新一轮任务）；不能通过无限重试绕过配额。进程崩溃遗留 PENDING 时拒绝自动重放，返回 ACCESS_REQUEST_INTERRUPTED；运维确认旧任务状态后应撤销原码并签发新的隔离授权。

## 持久化与部署

`/data/demo-access-grants.json` 只保存访问码 SHA-256 摘要、范围、撤销状态及请求账本，不保存原码。使用 0600 临时文件与原子替换；管理接口读取元数据不回传摘要。现有单 Adapter 进程独占此文件；本实现不支持多个进程/副本共享文件，扩容前需迁移到支持数据库事务的存储。原会话加密文件不变。

升级前按现有部署文档保留镜像、Compose 和数据卷。镜像版本为 `1.3.0-contract.3`，旧 JWT 路径兼容；原 `1.3.0-contract.2` 回滚仍可读取原会话但不提供访问码功能。新账本保留，不应通过回滚恢复旧额度或撤销状态。

## 公开错误码

`ACCESS_INVALID_REQUEST`（400）；`ACCESS_INVALID`（401）；`ACCESS_REVOKED`、`ACCESS_EXPIRED`、`ACCESS_WORKSPACE_MISMATCH`、`ACCESS_NOT_CONNECTED`、`ACCESS_MODE_FORBIDDEN`、`ACCESS_TEAM_MISMATCH`（403）；`ACCESS_NOT_FOUND`（404）；`ACCESS_REQUEST_CONFLICT`、`ACCESS_REQUEST_BUSY`、`ACCESS_REQUEST_INTERRUPTED`（409）；`ACCESS_QUOTA_EXHAUSTED`（429）；`ACCESS_UNAVAILABLE`（503）。既有请求解析、AgentTeams 会话和执行错误码保留。

验证命令：`node --test --test-concurrency=1 test/*.test.js`。所有 HTTP 测试只访问测试进程，CLI/模型派发使用替身；不能当作真实线上协作验收。
