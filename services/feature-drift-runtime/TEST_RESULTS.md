<!-- Copyright (C) 2026 Synapxnet. All rights reserved.
This file is Synapxnet Proprietary and Confidential. It is strictly
forbidden to copy, distribute, or use without explicit authorization.
真实执行器验收记录 / Actual execution runtime acceptance record.
Author: maoyo | Department: 研发部 | Date: 2026-09-18
Version: 1.3.0 | Security Level: INTERNAL
__version__: 1.3.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
__maintainer__: maoyo | __email__: synapxnet@gmail.com -->

# 本地真实执行与安装版契约验收

本记录仅覆盖本地隔离集成测试。它不是线上验收Run、比赛录制结果或生产收益证明。

## 冻结制品

| 文件 | SHA256 |
| --- | --- |
| runtime.py | ad491aa2b7c8eec557b921244e07af35ef045628c55f816968aa5d173ab13724 |
| Dockerfile | 23f325141f52407df611551d9302631247551d316acace63fdf84dcb0295c250 |
| requirements.txt | 20f3d77c4e617a60e554e4769b3ceb9a9a3b183d63b9c60f1049b05d0f31df74 |
| DESIGN.md | 0a781fb7f46d90aab580507d33db0610a92fc4647edd5e1b992517b02cb9b7cf |
| 已安装 app.asar | 988a6a403b2565442c8399ee979a1f5946e5dbdbe67cf7173f596e84ab7154f7 |

## 执行结果

`test_runtime.py` 四项集成用例全部通过，最后一次4.460秒。

1. 成功链实际生成1152行源CSV、回填128维、完成12次训练（6 LightGBM + 6 NumPy WideAndDeep）、
   选模、独立持出集评估、5%路由、全量提升、退出备用；CPU训练1.102秒；最终持出集准确率1.0、
   契约错误率0。重新打开SQLite和模型制品后再次推理通过，模型摘要与文件字节一致。
2. 受控`post_release_contract`分支实际在输入处截断8维，独立探针错误率1.0；回滚真实稳定v17
   制品和备用转换，独立回读通过；原修复目标仍标为未完成。不是直接写入一个失败状态。
3. 相同幂等请求可重放；同键改参数、错误参数摘要、过期资源版本均拒绝；不同事件独立；
   dry-run无模型文件、状态或动作台账改动。
4. HTTP无凭据返回401，只读角色写入返回403，不存在事件GET返回404且不创建运行。

`test_installed_contract.py` 两项跨语言用例全部通过，8.939秒。

- 从已安装`E:\Test\OpenXnet\resources\app.asar`直接读取场景常量、固定计划及原始质量门/独立
  验证代码。按原始9步骤参数调用运行时，不手工修正算法、修订、资源版本或参数。
- 成功分支被安装版原始`assertVerificationPassed`判定通过。
- 失败分支被原始判定器拒绝为`VERIFICATION_FAILED`；原批准2条补偿步骤依次执行，恢复修订17，
  根部署版本与备用特征版本均按批准基线44→45推进。
- 只读评估步骤使用真实Java风格的空治理字段，不以伪造人工审批绕过质量门。

## 指标边界

固定数据是合成演练源，36个月为2023-10至2026-09逐月32行；训练800行、验证160行、持出192行。
灰度1000请求重复使用192条持出行，响应明确`sampleReuse=true`与`uniqueSamples=192`。
30分钟为压缩的逻辑演练窗，实际开始/结束时间与毫秒时长单独保留。
P95/P99仅计本进程特征转换与模型推理，`metricScope=MODEL_INFERENCE_COMPUTE`，不代表HTTP
端到端延迟、生产SLO或真实风控业务损益。baselineProbe固定保留，后续采样不会覆盖故障前值。

## 尚需根代理完成

Java签名审批入口与真实HTTP运行时联调、线上备份部署、隔离验收Run、三平台界面验收、
最终成功/失败视频录制均由各自负责人继续执行；本报告不把这些步骤计为已完成。

## 复测

使用Python3.12与requirements固定版本，在本目录运行：

```text
python -m unittest -v test_runtime test_installed_contract
```

安装版契约测试另外需要仓库现有Node、TypeScript与`@electron/asar`。
`OPENXNET_CONTRACT_ASAR`可显式指向待验收安装包；默认读取上述用户已安装路径，仅读文件，
不会连接、控制或修改用户正在运行的OpenXnet进程。
