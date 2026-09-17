<!--
Copyright (C) 2026 Synapxnet. All rights reserved.
This file is Synapxnet Proprietary and Confidential. It is strictly
forbidden to copy, distribute, or use without explicit authorization.
Live 接入界面与交互设计 / Live connection UI and interaction design.
Author: maoyo | Department: 研发部 | Date: 2026-09-17 | Version: 1.3.0
Security Level: INTERNAL | Maintainer: maoyo | Email: synapxnet@gmail.com
-->

# Live 执行链图形化接入

目的：在“企业空间 → 协同与执行配置 → Live 执行链”完成受控执行服务的接入；不再把用户送到只有状态的页面。平台执行凭据与审批签发密钥由服务器保管，客户端仅输入限定工作空间与权限范围的 Live 接入授权。

## 页面与交互

1. 顶部保留已保存执行链的就绪状态，并解释“测试不执行任务，保存不自动批准任务”。平台网页身份、执行服务健康、审批服务健康分别显示。
2. 使用同一表单填写执行服务地址、工作空间、Live 接入授权，以及是否启用。授权使用空的临时密码输入框，不绑定响应式数据、不回显；Fixture 演示访问码不可替代 Live 授权。
3. “测试接入”只读检测服务身份、授权工作空间、允许范围、有效期和依赖健康。失败展示固定可理解说明，不回显原始服务异常。
4. 测试通过后展示“本次检测 · 尚未保存”的授权摘要，启用“保存并应用”；任一输入变化立即使测试失效。点击保存后服务器仍重新校验；只有成功回执才能改变已保存状态。禁用保存时直接解释下一步。
5. 已保存摘要和编辑草稿分离。刷新不覆盖用户编辑；慢响应不能覆盖新草稿或恢复已失效的测试。更换地址或工作空间后必须重新输入授权，旧授权不随新地址发送。
6. 清除本机配置必须二次确认；说明不撤销服务器授权、不批准任务。正在运行或待审批任务期间由主进程阻止改动并给出提示。
7. 保存后入口指向运行指挥台，用户自行选择任务与审批。所有操作不隐式切换 Fixture/Live、不创建运行。

## 接口与验收

接口已确认采用四个固定方法：`getApplicationCompetitionLiveConnection`、`testApplicationCompetitionLiveConnection`、`saveApplicationCompetitionLiveConnection`、`clearApplicationCompetitionLiveConnection`。请求字段为 `endpoint/workspaceId/accessCode/enabled`，只接受脱敏 `snapshot/access` 和固定错误码。`access` 包含 `workspaceId/allowedTools/allowedScenarios/expiresAt/platforms/approvalReady/checks/requiredTeamRuntime`，限定 `modes=['live']`。`test.ok=true` 但 `serviceReady=false` 时仍显示有效授权和缺项，不允许保存。

运行配置公开状态另包含 `liveRequiredTeamRuntime` 与 `liveWorkspaceId`，所以即使尚未打开配置页，事件也不能用 Builtin 代替要求的 AgentTeams，或借用其他工作空间的 Live 授权。Fixture 逻辑保留。

重点验证首次配置、复用同地址授权、换地址强制重输、Fixture 拒绝、失效授权、服务未就绪、刷新保留草稿、旧回包隔离、保存失败保留旧配置、确认清除和账号隔离。布局检查包括明暗主题、窄屏、长地址与长工作空间名。

实现验收：`tests/application_competition_live_connection_renderer.test.cjs` 的 16 项状态与边界检查已通过，Renderer 完整模板编译通过。独立浏览入口 `http://127.0.0.1:4341/` 使用真实模板、样式与方法，但 Main 回执为隔离替身；该入口不证明真实平台业务执行成功。真实网关、加密持久化与运行审批由主进程及服务端回归另行验证。
