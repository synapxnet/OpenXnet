<!-- -*- coding: utf-8 -*-
Copyright (C) 2026 Synapxnet. All rights reserved.
This file is Synapxnet Proprietary and Confidential. It is strictly forbidden to copy, distribute, or use without explicit authorization.
Author: maoyo | Department: 研发部 | Date: 2026-09-17 | Version: 1.3.0-live.1 | Security Level: INTERNAL
__maintainer__: maoyo | __email__: synapxnet@gmail.com -->

# Live 网关部署 / Live gateway deployment

镜像版本：`synapxnet/openxnet-agentteams-adapter:1.3.0-live.1`。保留现有加密会话卷、Fixture 访问码账本、CLI/Worker 租约组件和原许可证。更新前保存镜像、容器配置、网络连接和 `/data`，回退时恢复旧镜像及对应配置；不得删除新账本或失去不确定写入的审计。

## 服务器配置

默认 `OPENXNET_LIVE_ENABLED` 未设置，所有 Live 入口拒绝使用。显式开启时由受保护服务端环境提供：

| 字段 | 用途 |
| --- | --- |
| `OPENXNET_LIVE_ENABLED=1` | 启用网关；不自动签发授权 |
| `OPENXNET_LIVE_{AIOPS,DATAOPS,MLOPS}_BASE_URL` | 各平台固定工具根地址 |
| `OPENXNET_LIVE_{AIOPS,DATAOPS,MLOPS}_IDENTITY_URL` | 可选只读身份地址，默认平台首页 |
| `OPENXNET_LIVE_{AIOPS,DATAOPS,MLOPS}_DELEGATION_SECRET` | 各平台短期工具委托签名密钥 |
| `OPENXNET_LIVE_{AIOPS,DATAOPS,MLOPS}_ADAPTER_TOKEN` | 可选已限定平台令牌，优先于签名密钥 |
| `OPENXNET_LIVE_APPROVAL_BASE_URL` | 审批服务根地址 |
| `OPENXNET_LIVE_APPROVAL_ISSUER_TOKEN` | 审批发布签发凭据，绝不发给桌面 |
| `OPENXNET_LIVE_ALLOW_HTTP_UPSTREAMS=1` | 仅在明确部署的内网场景允许 HTTP 上游 |

当前已核对的容器根地址为 `http://synapxnet-aiops-web-1/`、`http://synapxnet-dataops-web-1/`、`http://synapxnet-mlops-web-1/`；首页身份各不相同。审批为 `http://openxnet-approval:8080/`，`GET /health` 返回 `{status:"ok"}`。Adapter 要加入审批所在的 `synapxnet_backend` 网络，并保留原 `agentteams-net`、`synapxnet_edge`。地址可修改服务器配置，桌面不需要重打包。

`check` 只验证服务器配置、平台标识、审批存活与 AgentTeams 会话；平台签名密钥是否匹配仍由每次实际平台鉴权裁决。检查通过不代表用户已经批准任何写操作。

## 授权签发

管理入口只接受既有 provisioning 身份。Live 访问码必须提前绑定真实 Workspace，不允许空值、不允许首次任意认领。签发字段全部显式提供：`label/workspaceId/expiresInSeconds/maximumRequests/actorIds/approverIds/allowedTools/allowedScenarios/resourceConstraints`。

`actorIds` 包括所选模板的 `agentteams:<roleCardId>` 和账号主进程生成的执行/验证身份；`approverIds` 仅包含明确审批人身份，两个集合不能重叠。`resourceConstraints` 包括所选场景每次调用实际涉及的所有固定资源字段。所有字段只接受精确值，不接受 `*`。最长七天、最多 2000 次新请求；重复请求不重复扣费。访问码只返回一次，账本仅保存摘要。安装者只填写网关地址、授权工作空间与 Live 访问码，不需要平台/审批原始凭据。

本版本 Live 访问码声明 `requiredTeamRuntime:"agentteams"`；准备 Team 后才能使用登记的 Trace，Builtin 管理员环境方式不使用这一 Live 接入码。Fixture 访问码永远不能调用 Live 网关。

## 检查与限制

部署后只读验证 `/health` 版本及 `capabilities.liveAccessCodes`。使用已审核授权做 `/api/v1/live-access/check`；只有三平台身份、审批与协作会话就绪，`connect` 才保存服务端激活时间。以上不创建模型团队或平台动作。

审批仍须明确人工点击。写操作精确匹配 Leader 接受计划的写步骤，核对参数摘要、资源版本、补偿标记和执行人与审批人分离。异步动作按授权、Workspace、Incident、Trace 和原请求关联。服务中断留下 `PENDING` 的请求必须先人工回读平台状态，不能自动重放不确定写入。

测试运行：`node --test services/openxnet-agentteams-adapter/test/live-gateway.test.js`。测试使用隔离临时目录、假上游和本地 HTTP 服务，不执行真实平台变更。
