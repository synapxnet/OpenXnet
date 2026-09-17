<!--
Copyright (C) 2026 Synapxnet. All rights reserved.
This file is Synapxnet Proprietary and Confidential. It is strictly
forbidden to copy, distribute, or use without explicit authorization.
项目自述与发布入口 / Project readme and release entry points.
Author: maoyo | Department: 研发部 | Date: 2026-09-18
Version: 1.3.0 | Security Level: INTERNAL
Maintainer: maoyo | Email: synapxnet@gmail.com
-->

# OpenXnet 企业智能空间

[![GOAI release 1.3.0](https://img.shields.io/badge/GOAI_release-1.3.0-6750A4)](https://github.com/synapxnet/OpenXnet/releases/tag/v1.3.0)
[![GOAI-Competition](https://img.shields.io/badge/branch-GOAI--Competition-1769AA)](https://github.com/synapxnet/OpenXnet/tree/GOAI-Competition)

**让多个 Agent 对同一个业务结果共同负责。** OpenXnet 是 SynapXnet 的企业 AI 协作入口，将 AI 员工、团队、工作空间、Skill、工具、人工审批、独立验证与组织记忆放进同一条可追溯任务链。

**[下载 Windows v1.3.0](https://github.com/synapxnet/OpenXnet/releases/download/v1.3.0/OpenXnet-Setup-1.3.0-goai-submission-win-x64.exe) · [发布说明与源码](https://github.com/synapxnet/OpenXnet/releases/tag/v1.3.0) · [English](README.md) · [SynapXnet 官网](https://openxnet.synapxnet.com/index.html)**

## 先找到正确版本

GOAI 决赛版为 **v1.3.0**，主场景固定为“跨域特征漂移恢复”。发布标签对应提交 `c841ef841da8477fc312e27cd390aecac8ed2d7e`；源码 ZIP、安装包与 SHA256 校验文件均在发布页。当前分支会继续追加文档修订，固定版本复现请以发布标签及附件为准。

本次提供 Windows x64 安装包。历史上游的 0.3.8 安装包、便携版和其他系统制品不是本次 GOAI 交付，请勿用它们复现 v1.3.0。当前发布页列出已验证范围和已知限制。

## 企业任务如何协作

| 层次 | 职责 |
|---|---|
| OpenXnet 企业空间 | 组织员工、团队与工作空间，发起任务，查看进度并进行人工决策 |
| AgentTeams | 编排 Leader、Evidence Worker、Independent Verifier 的任务拆解、交接和阶段结论 |
| 三平台驻场 Agent | 承担本平台的专业取证与受控工具接入，向同一个事件和 Run 提交证据 |
| 治理与执行 | 校验审批、资源范围、参数摘要、版本和幂等约束，保留工具与审计记录 |
| 独立验证 | 重新读取业务及技术证据，决定关闭、补证或补偿，不能把工具回执当作业务恢复 |
| Memory V3 与 Skill | 保存有来源、权限和版本的经验；成功任务可产生待认证 Skill 候选 |

一次恢复流程依次经过：业务异常 → 跨域取证 → 方案生成 → 人工批准 → 受控执行 → 独立验证 → 关闭或补偿。当前任务上下文与长期记忆分别管理；Skill 候选不自动取得生产执行权限。

## 安装后开始演示

1. 下载并安装本页链接的 Windows 程序，用自己的账号或管理员发放的演示账号进入。
2. 按顺序准备企业沙盘、企业空间、员工、协作团队和工作空间。团队模板与事件必须属于同一个工作空间。
3. 打开 **企业空间 → 协同与执行配置**，在界面中配置服务连接与管理员发放的演示访问码，测试后保存；普通安装者不需要执行本机启动 CMD。
4. 在 GOAI 演示入口创建“跨域特征漂移恢复”事件，选择对应工作空间、团队和演示路径。
5. 查看取证和计划，人工检查操作对象、参数、资源版本及回滚点并点击批准，继续执行与独立验证。

| 模式 | 适用范围 |
|---|---|
| Fixture + Builtin | 不依赖线上服务熟悉演练流程；不代表真实 AgentTeams 协作 |
| Fixture + AgentTeams | 使用演练平台数据验证真实模型协作与治理；需要演示访问码 |
| Live + AgentTeams | 使用 Staging 平台取证和受控执行；协作接入与同工作空间 Live 授权需要分别就绪 |

访问码、模型 API Key 和内部执行凭据不随源码或安装包公开。服务地址由部署配置管理，变更服务器地址不要求重新打包客户端。

## 三平台在线体验与登录

以下是 GOAI Staging 演示环境的入口，与 GitHub 源码页、软件发布页分别管理。

| 平台 | 在线体验 | 后端 API 基址 | 后端固定源码 | 前端固定源码 |
|---|---|---|---|---|
| XnetAIOps | [https://goai.xnetaiops.synapxnet.online/](https://goai.xnetaiops.synapxnet.online/) | `https://goai.xnetaiops.synapxnet.online/api/usr` | [XnetAIops/tree/v1.3.0](https://github.com/synapxnet/XnetAIops/tree/v1.3.0) | [XnetAIops-web/tree/v1.3.0](https://github.com/synapxnet/XnetAIops-web/tree/v1.3.0) |
| XnetDataOps | [https://goai.xnetdataops.synapxnet.online/](https://goai.xnetdataops.synapxnet.online/) | `https://goai.xnetdataops.synapxnet.online/api` | [XnetDataops/tree/v1.3.0](https://github.com/synapxnet/XnetDataops/tree/v1.3.0) | [XnetDataops-web/tree/v1.3.0](https://github.com/synapxnet/XnetDataops-web/tree/v1.3.0) |
| XnetMLOps | [https://goai.xnetmlops.synapxnet.online/](https://goai.xnetmlops.synapxnet.online/) | `https://goai.xnetmlops.synapxnet.online/api` | [XnetMLops/tree/v1.3.0](https://github.com/synapxnet/XnetMLops/tree/v1.3.0) | [XnetMLops-web/tree/v1.3.0](https://github.com/synapxnet/XnetMLops-web/tree/v1.3.0) |

三平台演示登录：手机号 **17870171303**，六位演示验证码 **000000**。这是管理员指定的演示认证，不是八位密码，也不表示真实短信服务已配置。后端 API 需要登录凭据，浏览器直接打开受保护接口返回 401 不代表平台离线；各业务服务还有独立前缀，以配套仓库最新使用说明为准。

以上登录信息仅用于三平台；OpenXnet 账号、AgentTeams 演示访问码、工作空间 Live 授权和模型 API Key 是不同凭据。AgentTeams 连接地址为 `https://goai.xnetaiops.synapxnet.online/agentteams-adapter/`，访问码和 Live 授权由管理员单独发放。驻场 Agent 在线与 AgentTeams 团队已绑定也不是同一状态，本轮 DataOps 回读的自动跨域移交状态仍为待接入，跨域 Demo 由 OpenXnet / AgentTeams 编排。

固定标签内的 README 保留发行时内容。当前演示地址、认证方式和部署修订以配套仓库 `GOAI-Competition` 的 README 及 Release 顶部使用指南为准。

## 配套平台 v1.3.0

| 平台 | 专业范围 | 后端 | 前端 |
|---|---|---|---|
| XnetAIOps | 运行状态、业务探针与运行保障 | [发布页](https://github.com/synapxnet/XnetAIops/releases/tag/v1.3.0) | [发布页](https://github.com/synapxnet/XnetAIops-web/releases/tag/v1.3.0) |
| XnetDataOps | 数据质量、血缘、DAG 与受控数据集操作 | [发布页](https://github.com/synapxnet/XnetDataops/releases/tag/v1.3.0) | [发布页](https://github.com/synapxnet/XnetDataops-web/releases/tag/v1.3.0) |
| XnetMLOps | 模型契约、制品、评估与部署证据 | [发布页](https://github.com/synapxnet/XnetMLops/releases/tag/v1.3.0) | [发布页](https://github.com/synapxnet/XnetMLops-web/releases/tag/v1.3.0) |

驻场服务实现位于 [services/platform-resident-agent](services/platform-resident-agent/DESIGN.md)，按各平台部署契约独立运行。平台提供各自的 UI 和专业能力，OpenXnet 与 AgentTeams 组织跨平台任务。

## 开发与验证

开发依赖包括 Python 3.12、[uv](https://docs.astral.sh/uv/getting-started/installation/)、Node.js/npm 与各服务需要的外部依赖；运行以下命令前需先安装这些工具，确切版本见 [pyproject.toml](pyproject.toml)、[package.json](package.json) 和锁文件。先按依赖与环境配置准备本地开发环境：

```sh
git clone --branch v1.3.0 --single-branch https://github.com/synapxnet/OpenXnet.git
cd OpenXnet
uv sync
npm ci
npm run dev
```

以上克隆命令直接选定 `v1.3.0` 固定版本。上述命令用于源码开发；不能替代模型配置、数据库及三平台部署，也不是普通安装者的必经步骤。桌面程序和独立服务分别构建，所用命令与资源以当前仓库脚本为准。

已完成的决赛验证包括 OpenXnet 类型检查与 144 项针对性回归；成功路径使用 Live Staging，失败补偿演示使用 Fixture 平台数据，两者均保留真实 AgentTeams 协作和人工批准。不能将 Fixture 称为生产故障注入，也不能将补偿成功称为业务已恢复。

完整结果、跳过项及制品差异见 [v1.3.0 发布说明](https://github.com/synapxnet/OpenXnet/releases/tag/v1.3.0)。[决赛运行手册](docs/GOAI-FINALS-DEMO-RUNBOOK.md)保留演示设计与操作参考，其中设计目标不等于全部已经验收；实际交付以发布说明为准。[复赛手册](docs/GOAI-SEMIFINAL-RUNBOOK.md)为历史材料。

## 数字与物理世界

VR、VRM 交互与 WorldOps 属于持续开发主线，将继续复用感知、风险判断、人工确认、受控执行和结果验证的治理边界。它们不替代本次跨域特征漂移 Demo 的实测证据。分发包已移除禁止再分发的默认 VRM，用户可以导入有权使用的模型。

## 来源、许可证与参与

本仓库保留 heshengtao / AgentParty 历史实现及第三方组件的作者声明。根 [LICENSE](LICENSE) 为 AGPL-3.0，组件差异及 Memory 授权见 [LICENSE-third-party](LICENSE-third-party)。本页文档修订不变更这些许可证，也不把历史上游下载或社区入口作为当前产品入口。

缺陷、需求及贡献请通过 [SynapXnet OpenXnet Issues](https://github.com/synapxnet/OpenXnet/issues) 或 Pull Request 提交。涉及接口、权限或迁移的变更，请同时提供验证范围及对接说明。
