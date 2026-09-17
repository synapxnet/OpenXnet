<!--
Copyright (C) 2026 Synapxnet. All rights reserved.
This file is Synapxnet Proprietary and Confidential. It is strictly
forbidden to copy, distribute, or use without explicit authorization.
决赛源码交付范围 / Finals source delivery scope.
Author: maoyo
Department: 研发部
Date: 2026-09-17
Version: 1.3.0
Security Level: INTERNAL
__version__: 1.3.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
__maintainer__: maoyo | __email__: synapxnet@gmail.com
-->

# GOAI 决赛 V1.3.0 源码交付

本次提交继续使用 `GOAI-Competition` 分支，桌面和后端产品版本为 `1.3.0`。包含企业空间与运行指挥台、会话交互、审批和独立验证、Memory V3 与上下文、Ollama 检测、应用内协作连接、驻场 Agent、AgentTeams Adapter、部署契约、配套前端资源和回归测试。

## 组件对应

- 桌面产品：`1.3.0`，比赛配置 `goai-staging`。
- 本轮录屏构建标识：`20260917-fixture-compensation-persistence`。
- AgentTeams Adapter：`1.3.0-live.4`。该版本只表示 Adapter，不代表三平台全部组件版本。
- 三个治理 Skill 的运行记录版本：`1.1.0`。
- 本次新产生的经验 Skill 是独立的 `1.0.0` 候选制品，尚待认证，不作为自动发布到生产的能力。

## 仓库内容与本机资料

源码、测试、构建配置、正式设计与部署文档随分支提交。已经纳入版本控制的前端编译资源，以及驻场服务 Docker 构建需要的 `vendor` 文件一并提交。

`artifacts/` 为本机构建包、解包运行时、隔离用户数据、日志与验收输出，保持本地保存，不进入源码仓库。API Key、访问码、密码、私钥和实际用户配置也不随源码提交；部署时使用文档定义的环境配置或应用内凭据入口。

`vrm/vrm/Eku_VRM_v1_0_0/` 中本地第三方模型的内嵌许可声明禁止再分发，且禁止商业使用，因此该资产不进入本次源码提交。本地文件不删除。构建者应自备具有相应使用及分发许可的模型，或调整打包资源清单；源码公开不能被视为该模型的再分发授权。

现有 npm 构建方式继续保留。pnpm 配置固定 `11.19.0`，明确三个既有构建依赖的构建许可，并同步 npm 的依赖覆盖约束；锁文件通过只更新锁与离线冻结检查，未通过此检查运行安装脚本。

## 本次提交前验证

- TypeScript 桌面源码和测试类型检查通过。
- AgentTeams Adapter 与驻场服务 50 项回归通过。
- 运行指挥台、应用内连接、平台身份、Memory 权限、协作投影和打包资源 94 项回归通过。
- Renderer 测试清单完整（19/19），预编译启动资源一致性检查通过。
- 实际演示分别完成 Live Staging 成功闭环、Fixture 数据加真实 AgentTeams 的验证失败补偿闭环，两条均实际点击人工批准。

上述检查不等同于全部产品页面无缺陷。失败门禁的 Verifier 辅助说明仍存在固定的“事件已解决”文案；实际 `FAILED / ROLLBACK_REQUIRED`、禁止关闭与补偿结果正确。该文案问题在录屏交付中如实记录，本次提交不声称已修复。

Live 演示证明实际 Staging 接口和受控生命周期回执；不证明真实企业长期生产收益或真实 GPU 大规模训练。Fixture 失败分支是演练数据，不是生产故障注入。补偿成功与业务恢复成功分别记录。
