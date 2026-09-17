<!--
#!/usr/bin/env markdown
# -*- coding: utf-8 -*-
# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.
# 协同配置引导与状态说明 / Collaboration setup guidance and status
# Author: maoyo
# Department: 研发部
# Date: 2026-09-17
# Version: 1.3.0
# Security Level: INTERNAL
# Maintainer: maoyo
# Email: synapxnet@gmail.com
-->

# 协同配置引导修正

## 问题与范围

当前“协同与执行配置”只读页面没有配置表单，只展示聚合状态；用户无法知道配置从何而来。聚合值还被误用于服务地址与委托状态，部分配置缺失时容易把已完成项显示成未配置。

本轮完善现有接入方式的操作路径、分项诊断与重新检查，不将普通刷新伪装成安装服务或保存凭据。服务地址、开关与委托来源仍是桌面启动环境。模型 API Key 不等于 AgentTeams 协同委托授权。

## 交互与对接

- AgentTeams 页首先展示当前桌面进程配置状态，提供“重新读取配置”。分开显示启用开关、服务地址是否已提供、委托授权是否已提供。只显示布尔值，不输出原始 URL 或令牌；有效性仍需运行时检查。
- 本机验收必须明确先选 Fixture，然后从托盘完全退出应用，再运行当前机器的协同启动器。关闭窗口可能仅最小化到托盘；已有实例不会接收新进程环境。
- 启动器连接线上 AgentTeams，不安装或启动本机 AgentTeams；其依赖现有源码、Python 和 SSH 授权，仅用于本机验收。三平台网页在线并非 Fixture 的启动必要条件。
- Live 接入需要部署配置；页面可展开查看变量名和配置位置，明确委托密钥由部署管理员提供，不应填写模型 API Key。任何引导和只读检查均不得切换模式、审批或触发业务任务。
- 通过现有 `getApplicationCompetitionUiProfile` IPC 扩展可选布尔字段 `agentTeamsEnabled`、`agentTeamsEndpointConfigured`、`agentTeamsDelegationConfigured`，兼容旧调用方。聚合就绪不代表远程服务在线。

## 验收

核对未配置、部分配置、完整配置、读取失败四种状态；保留最后成功检查时间但显式呈现读取失败。验证复制路径失败提示、重新读取不修改模式、深色和窄屏展示。当前机器只读预检分别记录本地模式及公开健康结果，不读远程密钥，不主动退出用户进程。

## 当前只读核验

2026-09-17：解包应用存在，线上公开 AgentTeams 健康与 `1.3.0-contract.2` 能力校验通过。默认用户资料被启动器以 `FIXTURE_REQUIRED` 拒绝；没有自动更改运行模式或读取委托凭据。
