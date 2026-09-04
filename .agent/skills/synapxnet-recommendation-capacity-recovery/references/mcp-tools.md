# MCP 工具边界

- 取证：`aiops.alert.get`、`aiops.service.health`、`aiops.k8s.workload.get`、`aiops.inference.metrics.get`、`dataops.workflow.instance.get`、`mlops.deployment.get`。
- 执行：`aiops.gpu.capacity.ensure`、`aiops.inference.runtime.tune`、`aiops.inference.capacity.apply`、`aiops.inference.traffic.shift`、`aiops.inference.autoscaling.policy.update`、`aiops.inference.capacity.converge`。
- 验证：`aiops.inference.metrics.get`、`aiops.inference.recovery.status`、`aiops.k8s.workload.get`、`dataops.workflow.instance.get`、`mlops.deployment.get`。
- 所有写工具必须携带 Workspace、Incident、Trace、Approval、幂等键、参数摘要和预期资源版本。
