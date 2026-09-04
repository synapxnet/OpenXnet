# MCP 工具边界

- 取证：`aiops.service.health`、`dataops.quality.report.get`、`dataops.workflow.instance.get`、`mlops.attribution.report.get`、`mlops.deployment.get`、`mlops.inference.probe`。
- 执行：`dataops.training.dataset.build`、`mlops.feature.pipeline.publish`、`mlops.training.search.start`、`mlops.model.evaluation.run`、`mlops.model.register`、`mlops.deployment.canary.apply`、`mlops.deployment.promote`。
- 验证：`aiops.service.health`、`dataops.dataset.validation.get`、`mlops.attribution.report.get`、`mlops.deployment.get`、`mlops.release.validation.get`、`mlops.inference.probe`。
- 补偿：`mlops.deployment.rollback`，必须保持旧模型热备并引用原审批计划。
- 所有写工具必须携带 Workspace、Incident、Trace、Approval、幂等键、参数摘要和预期资源版本；生产实盘流量不在当前认证范围内。
