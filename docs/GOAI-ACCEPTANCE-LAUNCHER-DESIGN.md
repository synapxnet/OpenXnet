<!--
#!/usr/bin/env markdown
# -*- coding: utf-8 -*-
# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.
# 安全验收启动器设计 / Safe acceptance launcher design
# Author: maoyo
# Department: 研发部
# Date: 2026-09-16
# Version: 1.3.0
# Security Level: INTERNAL
# Maintainer: maoyo
# Email: synapxnet@gmail.com
-->

# GOAI 桌面验收启动器设计

本设计先于代码落盘。启动器用于以已编译源码或 Windows 安装产物开展人工验收，在 Electron 创建之前准备运行环境。它不构建、不部署、不发送任务、不修改用户配置、不结束已有进程。

## 输入与边界

- `--target source|packaged`：默认源码；源码要求已安装 Electron 和已编译的桌面核心，安装产物默认 `E:\SynapXnet\openxnet-desktop\win-unpacked\OpenXnet.exe`。
- `--source-dir`、`--exe`：覆盖明确的目标目录或已解包可执行文件。
- `--user-data-dir`：默认 `%APPDATA%\OpenXnet`；启动器只读检查，不创建或改写该目录。
- `--runtime agentteams|builtin`：默认 AgentTeams 协同；两者都只允许南向 Fixture。Builtin 禁用隔离 AgentTeams、不读取远程凭据、不请求线上健康接口。
- `--validate-only`：完整预检后退出，不创建 Electron 进程。
- 不接受密钥、令牌、任意 SSH 主机或任意服务地址参数；不从 CLI 传递密钥。

## 检查顺序

1. 验证 Windows 目标、构建文件和用户目录选取。
2. 只读检查 `competition/control-plane.v1.json`：文件不存在视为空 Fixture；已存在必须是有效竞赛快照且 `adapterMode=fixture`。Live、损坏或无法识别状态均阻断，不自动重置数据。
3. 检查旧 `config.json` 标量加载。会覆盖启动器控制项或恢复南向凭据的配置必须阻断；错误中仅报告字段名，不输出值。
4. AgentTeams 模式通过公开 HTTPS 健康接口核对产品身份、健康、精确版本 `1.3.0-contract.2` 与 `capabilities.residentContexts=true`；禁止重定向。即使 `1.3.0-contract.1` 宣告相同的驻场上下文能力，也必须阻断本轮新版验收，不读取委托密钥、不启动应用。
5. 仅沿既有 SSH 链 `synapxnet-157 -> python -B D:\synapxnet\.codex-build\goai-deploy\remote_exec.py --host 150.109.52.248 exec` 只读检查固定运行容器 `synapxnet-openxnet-agentteams-adapter-1`。固定远端脚本经 stdin 传入 `sudo -n python3 -B -c`，脚本本身采用 base64 编码，绝不含密钥。
6. 检查容器运行状态、包版本和 `/app/src/contracts.js` 中实际导出的任务 schema、`parseTaskRequest` 字段白名单及驻场上下文映射。不能只凭旧 `v1` schema 名称宣布新版 `residentContexts` 兼容；必须匹配新版契约及公开版本。本预检读取解析函数源码，不构造任务或执行模型。
7. 只读取容器环境中唯一的 `OPENXNET_AGENTTEAMS_DELEGATION_SECRET`；返回内容由父进程捕获在内存，不转发远端 stdout/stderr，不落盘。
8. 建立新进程独立环境：先删除所有 `*_ADAPTER_TOKEN`、`ADAPTER_TOKEN`、`OPENXNET_AGENT_DELEGATION_SECRET`、`OPENXNET_APPROVAL_ISSUER_TOKEN`、已有 AgentTeams 委托值和 `ELECTRON_RUN_AS_NODE`，再按选择注入 AgentTeams 开关、固定 HTTPS 地址与本次读取的唯一密钥。父进程和持久环境均不改动。
9. 启动前再次核对配置快照。使用 `subprocess.Popen`、`CREATE_NO_WINDOW`、标准输入输出与错误接入 `DEVNULL`。成功只返回公开 PID 与启动请求状态；不将“进程已创建”宣称为 UI 或业务验收通过。

## 错误与保密

所有外部调用都有超时；捕获的错误输出不公开。错误只返回预定义代码与明确阻断原因。源代码、测试和说明均不含真实密钥；伪造测试值只在隔离单元测试中使用。运行模式为 Fixture 不等于开启真实南向执行。AgentTeams 协同使用独立委托密钥，也不赋予平台写入或审批签发权限。

Python 字符串和子进程环境无法承诺物理内存零残留；本实现保证不主动输出、写文件、写注册表或写持久配置，并在启动或预检结束后释放引用。读取 Windows 管理权限进程内存不属于本启动器能隔离的威胁边界。

## 验证计划

使用 Python 标准库 `unittest` 与临时目录验证：目标缺失、未编译、损坏/Live 快照、旧配置覆盖、大小写凭据清除、错误产品和版本、旧协议、重定向、远端失败、重复密钥、纯 Fixture 无网络、预检不启动、启动环境与静默标准流。版本回归覆盖 `1.3.0-contract.1`：公开健康能力完整时仍拒绝启动，远端包版本不符时仍不读取密钥。测试不得访问真实密钥、服务器或启动真实桌面进程。

只读真实预检与最终人工 UI/业务验收是独立结论；本启动器测试不替代界面截图、交互流程或线上新 Run 证据。

## 使用命令

在 `E:\SynapXnet\openxnet-source` 中执行，只读检查源码环境与已有 Fixture 数据：

```powershell
python -X utf8 -B scripts/start_goai_acceptance_runtime.py --target source --runtime builtin --validate-only
```

检查解包应用、默认用户目录及新版线上 AgentTeams 协议；不创建进程、不发送任务：

```powershell
python -X utf8 -B scripts/start_goai_acceptance_runtime.py --target packaged --runtime agentteams --validate-only
```

完成上述检查后，以同一目标启动桌面端：

```powershell
python -X utf8 -B scripts/start_goai_acceptance_runtime.py --target packaged --runtime agentteams
```

以源码进行验收时将 `--target packaged` 改为 `--target source`。使用独立用户数据时增加 `--user-data-dir '明确的本地目录'`；启动器不复制旧账户、不修改模式、不迁移数据。默认不隐藏 OpenXnet 的图形窗口；`CREATE_NO_WINDOW` 只避免额外控制台窗口。若已有 OpenXnet 实例，应用可能将请求交给既有实例；需要先正常退出旧实例，再启动本次配置，启动器不会替用户结束进程。

隔离测试命令：

```powershell
python -X utf8 -B scripts/start_goai_acceptance_runtime.test.py
```

## 检查记录

- 2026-09-16：20 项隔离单元测试通过，全部远程调用与应用启动均为模拟。
- 2026-09-16：真实源码 Builtin 只读预检返回 `BUILD_STALE`，要求重新编译当前修改。
- 2026-09-16：真实解包版 AgentTeams 只读预检返回 `ADAPTER_CONTRACT_INCOMPATIBLE`。旧公开健康接口没有新版版本和能力字段，因此没有继续读取远端委托密钥，更没有启动应用。
- 上述阻断均为预期保护结果，不代表人工验收或业务运行已通过。新协议部署和桌面编译完成后应重新执行预检。

### 1.3.0-contract.2 升级边界

本轮将公开健康、远端实际包版本和返回值校验统一到 `1.3.0-contract.2`。此前 `contract.1` 的检查与运行属于历史版本，不作为本轮通过证据。启动器不部署服务，也不干预仍在执行的真实 Run；线上未升级时按版本不一致阻断，新版上线后再由部署验收流程执行真实预检。

2026-09-16：升级后 21 项隔离单元测试全部通过，新增“公开健康为 `contract.1` 时，在读取密钥及创建进程之前阻断”回归；远端实际包为 `contract.1` 且驻场能力字段完整时也确认阻断。全部外部调用均为模拟，本轮未执行真实线上预检或启动桌面应用。
