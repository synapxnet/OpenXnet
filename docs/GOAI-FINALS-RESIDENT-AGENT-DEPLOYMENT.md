<!--
#!/usr/bin/env markdown
# -*- coding: utf-8 -*-
# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.
#
# 三平台驻场 Agent 部署契约 / Three-platform resident-agent deployment contract
# Author: maoyo
# Department: 研发部
# Date: 2026-09-15
# Version: 1.3.0
# Security Level: INTERNAL
-->

# 三平台驻场 Agent 部署契约

三名驻场 Agent 必须分别运行在 `XnetAIOps`、`XnetDataOps`、`XnetMLOps` 的平台运行环境中。OpenXnet 只提供治理控制面、统一 Run 视图、审批、审计和跨平台上下文投影；OpenXnet 的注册表不能替代平台侧进程。

## 运行边界

| 组件 | 部署位置 | 允许职责 | 禁止职责 |
| --- | --- | --- | --- |
| `agt-aiops-resident-v130` | XnetAIOps Agent Runtime | 业务/服务/部署/容量只读取证、诊断、升级协同 | 直接执行跨平台写操作 |
| `agt-dataops-resident-v130` | XnetDataOps Agent Runtime | Schema、血缘、质量、工作流只读取证、诊断、升级协同 | 直接发布模型或修改 AIOps 资源 |
| `agt-mlops-resident-v130` | XnetMLOps Agent Runtime | 模型输入契约、评估、部署和探针只读取证、诊断、升级协同 | 绕过 Human Gate 发布或回滚 |
| AgentTeams Leader | 独立协同 Runtime | 路由、交接、最小上下文、重试和事件记录 | 持有平台写权限 |
| OpenXnet Executor | OpenXnet 控制面 | 执行已批准且绑定版本的确定性步骤 | 以 Agent 身份自行决策 |

## 平台侧启动要求

每个平台运行自己的 Agent 进程，并向 OpenXnet 注册以下信息：`agentId`、平台、Agent 版本、契约版本、健康状态、只读工具白名单和心跳时间。注册成功不代表在线；只有心跳和预检连续通过后才显示 `ONLINE`。

推荐环境变量：

```text
OPENXNET_RESIDENT_AGENT_ID=agt-<platform>-resident-v130
OPENXNET_RESIDENT_PLATFORM=aiops|dataops|mlops
OPENXNET_RESIDENT_CONTRACT_VERSION=finals-v1.3.0
OPENXNET_CONTROL_PLANE_URL=https://<openxnet-control-plane>
OPENXNET_AGENTTEAMS_URL=https://<agentteams-runtime>
OPENXNET_CREDENTIAL_REF=credential://resident/<platform>/v130
```

`OPENXNET_CREDENTIAL_REF` 只引用 Credential Hub 中的短期凭据，不在平台配置文件或 OpenXnet 快照中保存明文 API Key。

## 演示前验收

1. 在三个平台分别查看 Agent 健康端点和平台本地工具白名单。
2. 在 OpenXnet 事件中心确认三个 `agentId` 均为 `ONLINE`，而非仅 `REGISTERED`。
3. 新建一个 Run，确认三个平台本地事件带同一 `runId/incidentId/traceId`，跨域请求才进入 AgentTeams。
4. 断开任一平台后，OpenXnet 显示对应 Agent `DEGRADED/OFFLINE`，Run 停在取证或等待重试，不得伪造证据或自动执行写操作。

当前桌面安装包包含控制面注册表和 Adapter 契约；三个平台侧 Agent 进程需要按本文件单独部署后，才可宣称“驻场 Agent 已运行”。
