<!--
#!/usr/bin/env markdown
# -*- coding: utf-8 -*-
# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.
# Live 软件内安全接入 / Governed in-app Live connection
# Author: maoyo | Department: 研发部 | Date: 2026-09-17
# Version: 1.3.0 | Security Level: INTERNAL
# Maintainer: maoyo | Email: synapxnet@gmail.com
-->

# 目标与范围

Live 当前仅接受桌面进程环境中的平台签名密钥、审批签发密钥，配置页面只展示缺项。改为桌面内填写受控服务地址、工作空间与独立 Live 授权码，检测、核对范围、保存及清除。服务器保管底层三平台执行凭据及审批发布凭据。更换服务器地址或授权只需修改配置，不需重新打包。

Fixture 演示访问码、Live 授权账本、本机加密文件及公开状态独立。既有受控部署兼容保留，但不得在用户保存的 Live 配置失效时自动降级回部署凭据。连接配置不产生工具写入、模型任务或审批。

# 协议冻结

根地址沿用独立 AgentTeams Adapter，可包含反向代理路径前缀；HTTPS 必须，本机回环开发可 HTTP。`GET health` 必须确认服务身份和 `capabilities.liveAccessCodes`。

| 接口 | 请求与含义 |
| --- | --- |
| POST api/v1/live-access/check | Bearer oxlive_64hex，{workspaceId}，只检查不绑定、不扣业务额度 |
| POST api/v1/live-access/connect | 同上，保存时重新校验范围；不改变运行模式或启动业务 |
| POST api/v1/live/tools/invoke | 原 CompetitionToolAdapterRequest，服务器固定工具表及平台地址，校验授权和治理后转发 |
| POST api/v1/live/actions/read | {request,actionId}，仅允许同授权、同工作空间/事件/Trace产生的动作查询 |
| PUT api/v1/live/approvals/:id | 既有审批发布载荷；核对授权内审批身份和每步范围后使用服务器签发凭据发布 |

授权回执：`{schema:'openxnet.agentteams.live-access.v1',grantId,label,workspaceId,expiresAt,remainingRequests,modes:['live'],requiredTeamRuntime:'agentteams',allowedTools,allowedScenarios,serviceReady,platforms:[{platform,configured,reachable,identityMatched}],approvalReady,checks:[{id,label,ready,code}]}`。三平台就绪和审批就绪必须来自实际有界只读探测；不能用配置字符串非空冒充连通。

桌面四 IPC：get/test/save/clearApplicationCompetitionLiveConnection。请求 `{endpoint,workspaceId,accessCode?}`，save 另有 `enabled`。返回 `{ok,code?,snapshot?,access?}`。snapshot 独立 `saved|none`，包含 enabled/endpoint/workspaceId/credentialConfigured/storageAvailable/storageError/access。密码单向提交，不回显、不入 Vue 持久化。空码仅复用完全相同地址和空间的本机保存项。

# 授权边界

Live 授权由管理员独立签发，预绑定工作空间、允许场景/工具、执行与验证身份白名单、审批身份白名单、资源约束、到期时间和请求额度。服务端只存摘要。默认不开启、没有通用匿名 Live 权限，不把 Fixture 授权升级为 Live。连接码不等于一次操作的人工批准。

客户端 Main 保持原人工审批交互、计划及参数摘要、资源版本、幂等和独立验证；HTTP 网关模式复用现有严格响应及写回执校验。服务器不接受任意目的 URL，不返回平台令牌或签名密钥，审批人不能成为同次请求人/执行人。异步动作只能读取本次授权产生的动作，撤销和到期在每次业务请求重新核对。

首版 Live 网关仅支持 AgentTeams，保存回执明确 requiredTeamRuntime=agentteams，Builtin 必须阻断。AgentTeams 的准备和派发在 Live 模式使用 Live 连接；Fixture 使用已有演示连接。旧环境接入仅在没有本机保存项时兼容。若存在保存项但损坏/禁用/过期/空间不匹配，必须明确阻断，不回退。所有运行途径使用相同路由规则。

# 界面与验收

单页展示连接表单、已保存状态、检测授权范围、工作空间、有效期、三平台和审批健康。草稿变更立即使检测结果失效。服务缺项可以显示，禁止误报已就绪；保存必须重新验证。清除仅断开本机，不撤销服务端授权。配置变更不得抢占进行中的执行。

验收覆盖：Fixture拒绝Live、过期/撤销/跨空间/越权工具与身份拒绝、未批准写入拒绝、审批作用域/幂等/版本不退化、非本授权动作查询拒绝、重定向/过大响应/存储加密不可用拒绝、输入新地址不发送旧码、重启恢复、草稿与保存状态隔离、明暗和窄屏。实际平台写入或审批不作为配置验收自动执行。构建后记录源码/安装包/服务端版本对应关系；部署先备份并保留本次回退路径。
