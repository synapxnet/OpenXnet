# MCP 工具边界

- 取证：`aiops.alert.get`、`aiops.service.health`、`aiops.k8s.workload.get`、`dataops.quality.report.get`、`dataops.schema.snapshot.get`、`dataops.lineage.get`、`dataops.workflow.instance.get`、`mlops.deployment.get`、`mlops.inference.probe`。
- 执行：`mlops.feature.fallback.apply`、`dataops.feature.backfill.start`、`dataops.dataset.validation.get`、`mlops.training.search.start`、`mlops.model.evaluation.run`、`mlops.model.register`、`mlops.deployment.canary.apply`、`mlops.deployment.promote`、`mlops.feature.fallback.remove`。
- 验证：`aiops.inference.recovery.status`、`dataops.dataset.validation.get`、`mlops.inference.probe`、`mlops.deployment.get`、`mlops.release.validation.get`。
- 补偿：`mlops.deployment.rollback` 后执行 `mlops.feature.fallback.apply`，恢复稳定修订并继续隔离漂移输入。
- 所有写工具必须携带 Workspace、Incident、Trace、Approval、幂等键、参数摘要和预期资源版本；生产认证需另行积累真实环境证据。
