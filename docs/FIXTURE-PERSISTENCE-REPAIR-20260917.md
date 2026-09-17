<!--
Copyright (C) 2026 Synapxnet. All rights reserved.
This file is Synapxnet Proprietary and Confidential. It is strictly
forbidden to copy, distribute, or use without explicit authorization.
Fixture 控制面持久化修复 / Fixture control-plane persistence repair.
Author: maoyo | Department: 研发部 | Date: 2026-09-17 | Version: 1.3.0
Security Level: INTERNAL | Maintainer: maoyo | Email: synapxnet@gmail.com
-->

# 诊断与最小修复设计

## 已确认与未确认

安装版与当前编译版的控制面运行器、存储、Fixture Adapter 和场景计划一致。现场第 5 步模型评估记录为 `UPSTREAM_UNAVAILABLE`，随后预批准的补偿因资源版本不符而拒绝。相同 targetRevision=19、rollbackRevision=17、DryRun 和失败验证数据集，在隔离的完整 Fixture 中可完成全部 9 步，不能直接重现该评估异常。

真实 Windows 测试已确认：另一个只读句柄短暂占用控制面 JSON、未声明删除共享时，原子 rename 会立即失败并返回 EPERM。现有代码不重试，并把工具结果落盘错误归类为上游不可用。现场未保留底层 I/O 错误，因此文件锁是已复现的缺陷与候选触发原因，**不能称为现场唯一根因**。现场 JSON 约 1.27 MB，未达到 32 MB 限制。

## 修复边界

1. 只对 Windows 原子替换的 EPERM/EACCES/EBUSY 做有界退避，复用已经生成的同一份临时快照；不重新执行 mutation，不重跑平台工具，不改审批或幂等键。
2. 退避耗尽后保留原始目标文件，清理临时文件，并抛出独立的 `CONTROL_PLANE_PERSISTENCE_FAILED`。公开错误仅保留系统错误代码，不包含用户目录或秘密。
3. 运行器识别持久化错误，说明平台操作可能已经发生，需要核对回执与状态，不能将其标记为平台离线或直接重复执行。
4. 保留全部参数摘要、资源版本、人工审批和独立验证边界。早期执行失败时，补偿若与冻结审批版本冲突，继续明确拒绝；必须重新取证、生成计划并审批，不能把预批版本 44 动态改为 42。

## 验收计划

- 真实 Windows 短暂只读锁恢复：更新只计算一次，原子替换成功，无遗留临时文件。
- 持续锁耗尽：旧快照保持不变，返回独立持久化错误，无伪成功。
- 精确场景参数与 DryRun：9 步完整成功，独立验证后关闭并记录成功记忆。
- 第 5 步回执落盘期间短暂锁：该工具只调用一次，9 步完成；Verifier 失败后 2 步补偿成功，事件仍 FAILED，不写成功记忆。
- 第 5 步主动失败：冻结补偿版本不改写，版本冲突拒绝，不误报补偿成功。

隔离测试使用临时用户目录和内置 Fixture，不连接平台、不修改用户历史、不作为 AgentTeams 实际运行证据。测试通过后仍需新桌面包与安装版人工流程复验。

## 实际结果（2026-09-17）

- TypeScript 全部桌面源码与测试编译通过，输出到 `artifacts/fixture-store-regression`，未修改打包使用的 `build-ts`。
- 相关 55 项测试全部通过（运行器 30、持久化新增 5、Adapter 与资源版本 20）；日志：`artifacts/fixture-store-regression/regression-results.log`。
- 新增 5 项逐项覆盖上述验收计划。第五步落盘真实持有 Windows 文件锁 400 ms，模型评估工具调用次数为 1，全部 9 步成功后才进入 Verifier；失败路径完成 2 步补偿，终态保留 FAILED，成功记忆发布次数为 0。
- 正常分支通过独立验证后为 RESOLVED，成功记忆发布次数为 1，重建存储实例可读取最终状态。
- 早期错误保留 `CONTROL_PLANE_PERSISTENCE_FAILED`；已批准补偿版本仍为 44，与尚未推进的实际资源版本冲突时返回 `RESOURCE_VERSION_CONFLICT`，补偿状态 FAILED，审批对象未改写。
- 初次将测试输出多放一层目录，导致一个旧测试的固定服务相对路径无法找到；按现有测试约定修正隔离输出目录后，55 项全部通过。没有为此修改产品或既有测试逻辑。

复现命令：

```text
node node_modules/typescript/bin/tsc -p tsconfig.desktop.test.json --outDir artifacts/fixture-store-regression
node --test artifacts/fixture-store-regression/competition/competition-persistence-regression.test.js artifacts/fixture-store-regression/competition/application-competition-runtime.test.js artifacts/fixture-store-regression/competition/competition-tool-adapter.test.js artifacts/fixture-store-regression/competition/competition-resource-versions.test.js
```
