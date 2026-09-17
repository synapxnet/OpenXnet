<!--
#!/usr/bin/env markdown
# -*- coding: utf-8 -*-
# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.
# 安装版协同接入设计 / Installed-desktop collaboration setup design
# Author: maoyo | Department: 研发部 | Date: 2026-09-17
# Version: 1.3.0 | Security Level: INTERNAL
# Maintainer: maoyo | Email: synapxnet@gmail.com
-->

# 安装后在软件内接入 AgentTeams

## 问题与交付目标

普通用户不能依赖开发者源码目录、SSH、Python、CMD 或重启时注入环境变量复现 Demo。配置页必须能够填写、测试、保存和清除真实接入配置，普通快捷方式重新启动后仍然可用。公开发行包不得携带部署管理令牌或全局 JWT 签名密钥。

## 用户流程

提供内置演练入口和真实 AgentTeams 接入入口。内置演练明确使用本机模拟证据和内置编排，不能标作真实多 Agent 运行。真实接入填写协同服务地址和管理员签发的演示访问码，测试显示服务身份、授权范围及有效期，再保存启用。用户已有团队和工作空间保留，由范围提示引导绑定。

普通用户不接触服务器管理密钥。用户已确认使用受限演示访问码；不启用公开免登录入口。旧部署环境兼容保留但不作为安装者操作入口。

## 本轮接入协议

- 服务端管理接口 `POST /api/v1/access/grants` 签发随机 `oxdemo_` 前缀访问码；可预绑定工作空间，未绑定时在首次连接原子绑定。有效期不超过七天、请求配额有上限。`DELETE /api/v1/access/grants/:id` 撤销。两者均仅接受现有部署管理授权。
- 用户 `POST /api/v1/access/check` 提交 `{workspaceId}`，携带访问码，仅检查且不绑定；`POST /api/v1/access/connect` 使用相同请求正式绑定。响应统一为 `{schema: 'openxnet.agentteams.access.v1', grantId, label, workspaceId, expiresAt, remainingRequests, modes: ['fixture'], serviceReady}`。
- AgentTeams 业务请求带 `X-OpenXnet-Execution-Mode: fixture`。访问码授权时服务端必须要求工作空间已绑定；任务还要求三平台完整的 staging + SIMULATION/REPLAY 驻场上下文。部署 JWT 流程保持原契约。
- 桌面新增 `getApplicationCompetitionConnection`、`testApplicationCompetitionConnection`、`saveApplicationCompetitionConnection`、`clearApplicationCompetitionConnection`。请求字段 `{endpoint, workspaceId, accessCode?}`，保存另带 `enabled`；留空访问码仅能复用同一地址、同一工作空间已保存码。
- 桌面结果统一为 `{ok, code?, snapshot?, access?}`，固定公开错误码，不携带内部异常。快照为 `{enabled, endpoint, workspaceId, credentialConfigured, storageAvailable, source: 'saved'|'deployment'|'none', access}`；access 为上述安全授权元数据或 null。
- 读取配置不联网；测试不落盘或改变运行模式；保存验证并连接后加密落盘且立即生效；清除只断开本机保存项，不撤销其他使用者的码。

## 前后端契约

- 新增桌面受控 IPC：读取接入配置、测试接入、保存接入、清除接入。只允许可信主窗口和已授权企业身份调用。
- 表单字段为 `enabled`、`endpoint`、一次性传入的 `accessCode`。访问码不回读、不进入 Vue 持久化白名单或日志。用户改地址时不得把旧访问码发送到新地址。
- 公开状态包含配置来源、地址、是否保存访问码、系统加密是否可用、服务身份、允许的工作空间及访问码到期时间；不返回原始密钥。
- Main 使用 Electron safeStorage 加密原子保存到用户资料目录；系统加密不可用时拒绝落盘，不降级明文。更新配置不依赖更改进程环境；正在运行的协作期间禁止替换配置。
- 连接测试只访问公开健康及授权状态，不创建团队、不启动模型、不执行工具。限制 HTTPS（本机回环开发地址可用 HTTP）、超时、响应大小和重定向，按固定错误码展示可操作提示。
- 服务端增加受限访问码的签发、检查和撤销。仅部署管理身份可签发/撤销；用户仅持有范围受限的访问码。服务端只持久化令牌摘要，验证有效期、工作空间、演练模式和请求边界；保留旧的请求级委托方式供受控部署兼容。
- 真实 AgentTeams 准备/任务请求通过新访问码授权时，仍必须通过既有严格请求解析和输出校验，不因此获得三平台写入权限或审批权。

## 验收标准

1. 无任何接入环境变量、无源码/SSH 依赖的全新桌面资料可从软件内保存接入配置。
2. 普通重新启动后仍读取已保存配置；客户端文件及日志没有明文访问码。
3. 错误服务地址、旧协议、过期/撤销/跨工作空间访问码拒绝且原因可见。
4. 测试连接不会创建业务任务；表单变化使过期测试结果失效；清除凭据必须由用户明确触发。
5. 演示访问码不能调用管理接口、Live 任务或无关工作空间；服务器独立实施授权。
6. 配置页浅/深色和窄屏可用；移除开发路径、CMD 和部署环境变量作为主要引导。
7. 构建安装包并核对交付内容；分别记录自动测试、隔离 UI 验收与实际部署验证，不能混称为全流程通过。
