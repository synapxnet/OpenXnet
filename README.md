<!--
Copyright (C) 2026 Synapxnet. All rights reserved.
This file is Synapxnet Proprietary and Confidential. It is strictly
forbidden to copy, distribute, or use without explicit authorization.
项目自述与发布入口 / Project readme and release entry points.
Author: maoyo | Department: 研发部 | Date: 2026-09-17
Version: 1.3.0 | Security Level: INTERNAL
Maintainer: maoyo | Email: synapxnet@gmail.com
-->

# OpenXnet · SynapXnet 企业智能空间

[![GOAI release 1.3.0](https://img.shields.io/badge/GOAI_release-1.3.0-6750A4)](https://github.com/synapxnet/OpenXnet/releases/tag/v1.3.0)

**让多个 Agent 对同一个业务结果共同负责。** OpenXnet 将企业 AI 员工、AgentTeams、三平台驻场 Agent、人工审批、受控执行、独立验证与组织记忆连接起来。

## GOAI 决赛 v1.3.0

**[Windows 安装包](https://github.com/synapxnet/OpenXnet/releases/download/v1.3.0/OpenXnet-Setup-1.3.0-goai-submission-win-x64.exe) · [发布说明、源码及校验文件](https://github.com/synapxnet/OpenXnet/releases/tag/v1.3.0) · [中文使用指南](https://github.com/synapxnet/OpenXnet/blob/GOAI-Competition/README_ZH.md) · [English](https://github.com/synapxnet/OpenXnet/blob/GOAI-Competition/README.md)**

主场景为“跨域特征漂移恢复”：围绕同一个业务事件完成跨域取证、方案生成、人工批准、受控执行、独立验证，以及关闭或补偿。Memory V3 保存有来源、权限和版本的经验，Skill 候选经过认证后才能进一步复用。

当前页面来自 `main`，其中保留 [OpenXnet OS 内核目录](os)。桌面与 GOAI 决赛源码在 [GOAI-Competition](https://github.com/synapxnet/OpenXnet/tree/GOAI-Competition)；**v1.3.0 徽章表示 GOAI 发布版本，不表示 main 中全部代码已经切换到该版本。** 固定源码对应 [v1.3.0 标签](https://github.com/synapxnet/OpenXnet/tree/v1.3.0)。

## 配套平台

| 平台 | 专业范围 | 后端 | 前端 |
|---|---|---|---|
| XnetAIOps | 运行状态、业务探针与运行保障 | [v1.3.0](https://github.com/synapxnet/XnetAIops/releases/tag/v1.3.0) | [v1.3.0](https://github.com/synapxnet/XnetAIops-web/releases/tag/v1.3.0) |
| XnetDataOps | 数据质量、血缘、DAG 与受控数据集操作 | [v1.3.0](https://github.com/synapxnet/XnetDataops/releases/tag/v1.3.0) | [v1.3.0](https://github.com/synapxnet/XnetDataops-web/releases/tag/v1.3.0) |
| XnetMLOps | 模型契约、制品、评估与部署证据 | [v1.3.0](https://github.com/synapxnet/XnetMLops/releases/tag/v1.3.0) | [v1.3.0](https://github.com/synapxnet/XnetMLops-web/releases/tag/v1.3.0) |

## 安装与协作

普通安装者从发布页下载 Windows 程序，在 **企业空间 → 协同与执行配置** 中配置协作连接，不需要执行本机启动 CMD。离线演练可使用 Fixture + Builtin；真实 AgentTeams 协作需要管理员发放的演示访问码，Live 执行还需要同工作空间授权。

构建步骤、实际测试和已知问题见[完整自述文件](https://github.com/synapxnet/OpenXnet/blob/GOAI-Competition/README_ZH.md)及发布说明。发布版本不等于重新部署线上服务，也不自动赋予线上执行权限。项目和组件使用范围以所在分支的 [LICENSE](LICENSE) 及组件声明为准。

[SynapXnet 官网](https://openxnet.synapxnet.com/index.html) · [问题反馈](https://github.com/synapxnet/OpenXnet/issues)
