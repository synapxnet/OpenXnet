<!-- Copyright (C) 2026 Synapxnet. All rights reserved.
This file is Synapxnet Proprietary and Confidential. It is strictly
forbidden to copy, distribute, or use without explicit authorization.
真实特征漂移演练运行时 / Real feature-drift staging execution runtime.
Author: maoyo | Department: 研发部 | Date: 2026-09-18
Version: 1.3.0 | Security Level: INTERNAL
__version__: 1.3.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
__maintainer__: maoyo | __email__: synapxnet@gmail.com -->

# 真实执行边界与 HTTP 契约

本服务只运行隔离的合成风控演练，来源恒为 `REAL_CPU_SYNTHETIC_STAGING`。
真实执行指实际 CSV 读取/特征重算、CPU 训练、模型制品、预测路由、采样测量和回滚；
不代表真实客户数据、生产业务收益、GPU 训练或修改既有生产部署。
每个 workspace + incident 使用独立目录、SQLite 状态和动作台账。GET 不初始化事件。

## 执行与证据

初始化显式写入 36 个月、每月 32 行的合成源数据（1152 行），时间分为前 25 月训练、
中间 5 月选模、末 6 月独立验证。基线模型在完整 128 维历史特征训练，故障输入实际只提交
120 维，推理器拒绝不兼容输入并记录真实错误。备用转换、回填、模型训练依序执行。
回填真实读取全部源数据并重算缺失 8 维，写出修复 CSV，统计质量和 SHA256。
训练参数严格限定 `LightGBM` 与 `WideAndDeep`，12 trials 分别执行 6 次；后者为 numpy
实现的线性 wide 分支与 ReLU 隐层 deep 分支联合梯度训练。选模仅用验证集，不能用 held-out。
模型文件使用 LightGBM 原生文本或无可执行代码的 JSON 权重，禁止 pickle。
初始化真实训练并冻结稳定修订17与故障基线修订18；训练产物为候选修订19。

灰度实际按固定哈希分桶路由至少1000次请求（192条唯一持出样本，重复采样明确标识）；30分钟为批准的逻辑观察窗，响应
明确 `compressedWindow=true`，同时保留真实起止时间、毫秒时长和真实路由数量，不能把秒级
演练称为真实 30 分钟生产观测。全量发布切换实际模型指针，备用退出切换实际特征路径。
故障分支由初始化时固定 `failureMode=post_release_contract`，退出备用之后故意让候选入口
截断8维，独立探针实际失败。回滚恢复冻结稳定模型v17及备用转换，并记录前后摘要与实际探针。
回滚成功表示服务得到安全缓解；该事件的原修复目标仍失败，不自动宣布业务恢复。

## HTTP

绑定内网并要求不少于 32 字符 `X-Feature-Drift-Token`，服务启动时检查配置。
`FEATURE_DRIFT_TOKEN_FILE` 指向私有JSON：`{"tokens":[{"token":"由部署端生成","role":"mlops","workspaceIds":["明确的UUID"]}]}`。
角色initializer仅允许initialize，dataops仅backfill，mlops仅模型生命周期动作和evaluate，
aiops/resident只读；所有角色仅能读取明确列出的workspace。不能用统一管理员令牌部署。
Docker镜像UID10001，挂载状态目录应归属此UID；仅连接后端内网，不发布宿主机端口。
除无敏感信息的 `/health` 外所有接口鉴权；不允许 CORS、重定向、任意路径或 shell。

| 方法与地址 | 作用 |
| --- | --- |
| GET `/health` | 版本、真实执行来源、服务健康 |
| GET `/v1/incidents?workspaceId=...` | 已存在运行摘要；服务端代理可省略 workspace 查询所有隔离演练 |
| GET `/v1/incidents/{incidentId}?workspaceId=...` | 完整可审计的运行详情 |
| GET `/v1/incidents/{incidentId}/{dataset\|deployment\|training\|probe}?workspaceId=...` | 分域证据；probe 实际推理，参数 sampleLimit=1..2000 |
| POST `/v1/incidents/{incidentId}/actions/{action}` | 显式初始化、经审批操作和可重放动作 |

`action` 固定为 `initialize`, `fallback`, `backfill`, `feature-publish`, `train`,
`evaluate`, `register`, `canary`, `promote`, `fallback-remove`, `rollback`。
`evaluate` 为独立读取型质量门；其余非初始化动作必须含有效审批上下文。
请求字段：`requestId, workspaceId, incidentId, traceId, actorId, toolName, approvalId,
approverId, planId, planDigest, stepId, resourceId, targetRevision, expectedResourceVersion,
argumentsDigest, compensation, dryRun, idempotencyKey, arguments`。
Java 入口先验证完整签名审批，本服务再验证固定动作资源/算法/摘要/版本/幂等范围。
参数摘要是排序紧凑 JSON 的 SHA256（可带 `sha256:` 前缀）。相同幂等键不同请求拒绝409，
版本不符拒绝412；dryRun 不生成任何事件、制品或台账。初始化携带 `initialResourceVersions`
或 `initialResourceVersion`（默认42）、`failureMode`（none/post_release_contract）、固定资源标识、
`baselineRevision=18,targetRevision=19,rollbackRevision=17`。canary/promote同时增加traffic
和部署根版本，42→44；rollback根44→45，与安装版批准计划保持一致。

响应 `{data, resourceVersion, actionReceipt}`；GET 同样含 `data`，`actionReceipt` 为 null。
`data` 公共字段：`schemaVersion, sourceMode, synthetic, workspaceId, incidentId, traceId,
createdAt, updatedAt, phase, resourceVersions, resources, dataset, training, deployment,
latestProbe, compensation, actions`。摘要只描述真实制品；缺失保持 null，不能生成成功值。
`dataset` 包含 `datasetUid, inputRows, outputRows, featureDimension, historyMonths,
timeRange, splits, sourceDigest, datasetDigest, qualityScore, missingValues, status, lineage`。
`training` 包含 `experimentUid, status, trials, selectedTrial, architecture, modelDigest,
datasetDigest, trainRows, validationRows, heldOutRows, startedAt, completedAt, logs`。
`deployment` 包含 `deploymentUid, activeRevision, baselineRevision, targetRevision,
activeModelDigest, candidateModelDigest, trafficPercent, fallbackFeatureActive,
featureDimension, routeVersion, canary, promoted, registered, evaluationPassed`。
`probe` 包含 `sampleCount, errorCount, errorRate, successRate, p95Ms, p99Ms, meanMs,
accuracy, approvalRate, referenceApprovalRate, approvalRateDelta, featureContractPassed,
businessRecovered, startedAt, completedAt, durationMs, modelDigests, datasetDigest,
split, routeCounts, measurementId, sourceMode`。
动作回执包含 `actionId,beforeResourceVersion,afterResourceVersion,startedAt,completedAt,status`。

SQLite WAL 保留动作前 `RUNNING` 状态与全部审批元数据，完成后原子提交状态+回执。
重启发现未完成动作则标为 `INTERRUPTED`，拒绝同键偷偷重跑，需要明确新请求且重新核对版本。
模型与CSV使用临时文件+原子替换，台账只有在制品已经持久化后才引用其摘要。
测试必须覆盖成功真实训练/探针、故障与回滚、跨事件隔离、重启持久化、幂等冲突、错误摘要、
过期版本、dry-run无写入、HTTP鉴权和实际算法产物。
