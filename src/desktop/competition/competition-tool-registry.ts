import type { ApplicationCompetitionPlatform } from "../contracts/application-competition-runtime";

/** 竞赛 P0 固定工具名称。 */
export const COMPETITION_TOOL_NAMES = [
  "aiops.alert.get",
  "aiops.service.health",
  "aiops.k8s.workload.get",
  "aiops.inference.metrics.get",
  "aiops.inference.recovery.status",
  "aiops.gpu.capacity.ensure",
  "aiops.inference.runtime.tune",
  "aiops.inference.capacity.apply",
  "aiops.inference.traffic.shift",
  "aiops.inference.autoscaling.policy.update",
  "aiops.inference.capacity.converge",
  "dataops.quality.report.get",
  "dataops.schema.snapshot.get",
  "dataops.lineage.get",
  "dataops.workflow.instance.get",
  "dataops.training.dataset.build",
  "dataops.feature.backfill.start",
  "dataops.dataset.validation.get",
  "mlops.deployment.get",
  "mlops.attribution.report.get",
  "mlops.inference.probe",
  "mlops.model.iteration.start",
  "mlops.feature.pipeline.publish",
  "mlops.training.search.start",
  "mlops.model.evaluation.run",
  "mlops.model.register",
  "mlops.feature.fallback.apply",
  "mlops.feature.fallback.remove",
  "mlops.deployment.canary.apply",
  "mlops.deployment.promote",
  "mlops.release.validation.get",
  "mlops.deployment.rollback",
] as const;

/** 竞赛 P0 工具名称联合类型。 */
export type CompetitionToolName = (typeof COMPETITION_TOOL_NAMES)[number];

/** 工具风险分级。 */
export type CompetitionToolRiskLevel = "READ" | "COSTLY_READ" | "HIGH_RISK_WRITE";

/** 构建期固定的工具描述。 */
export interface CompetitionToolDescriptor {
  readonly name: CompetitionToolName;
  readonly title: string;
  readonly description: string;
  readonly platform: ApplicationCompetitionPlatform;
  readonly service: string;
  readonly riskLevel: CompetitionToolRiskLevel;
  readonly path: string;
  readonly timeoutMs: number;
  readonly requiresApproval: boolean;
  readonly inputSchema: Readonly<Record<string, unknown>>;
}

/** 通用 string 属性 Schema。 */
const STRING_PROPERTY = Object.freeze({ type: "string", minLength: 1, maxLength: 512 });

/** 高风险回滚工具的领域参数 Schema，不包含 MCP governance 包络。 */
const ROLLBACK_INPUT_SCHEMA = Object.freeze({
  type: "object",
  required: ["deploymentUid", "targetRevision", "verificationPolicy"],
  properties: {
    deploymentUid: STRING_PROPERTY,
    targetRevision: { type: "integer", minimum: 1 },
    verificationPolicy: {
      type: "object",
      required: ["maxErrorRate", "maxP95Ms"],
      properties: {
        maxErrorRate: { type: "number", minimum: 0, maximum: 1 },
        maxP95Ms: { type: "integer", minimum: 1 },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
});

/** 唯一工具 Registry；工具名、Owner、路径和 Schema 不从运行时自由文本生成。 */
export const COMPETITION_TOOL_REGISTRY: readonly CompetitionToolDescriptor[] = Object.freeze([
  {
    name: "aiops.alert.get",
    title: "获取 AIOps 告警证据",
    description: "按告警 ID 或 UID 获取监控告警及其关联资源证据。",
    platform: "aiops",
    service: "aiops-mon-service",
    riskLevel: "READ",
    path: "/api/agent/v1/tools/aiops.alert.get:invoke",
    timeoutMs: 3_000,
    requiresApproval: false,
    inputSchema: {
      type: "object",
      oneOf: [{ required: ["alertId"] }, { required: ["alertUid"] }],
      properties: { alertId: STRING_PROPERTY, alertUid: STRING_PROPERTY },
      additionalProperties: false,
    },
  },
  {
    name: "aiops.service.health",
    title: "获取 AIOps 服务健康证据",
    description: "获取服务及角色实例的健康汇总。",
    platform: "aiops",
    service: "aiops-svm-service",
    riskLevel: "READ",
    path: "/api/agent/v1/tools/aiops.service.health:invoke",
    timeoutMs: 5_000,
    requiresApproval: false,
    inputSchema: {
      type: "object",
      required: ["serviceUid"],
      properties: {
        serviceUid: STRING_PROPERTY,
        windowMinutes: { type: "integer", minimum: 1, maximum: 1_440 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "aiops.k8s.workload.get",
    title: "获取 Kubernetes 工作负载证据",
    description: "获取 Kubernetes 工作负载、修订、Pod、事件和指标摘要。",
    platform: "aiops",
    service: "aiops-k8s-service",
    riskLevel: "READ",
    path: "/api/agent/v1/tools/aiops.k8s.workload.get:invoke",
    timeoutMs: 8_000,
    requiresApproval: false,
    inputSchema: {
      type: "object",
      required: ["clusterId", "namespace", "kind", "name"],
      properties: {
        clusterId: STRING_PROPERTY,
        namespace: STRING_PROPERTY,
        kind: { type: "string", enum: ["Deployment", "StatefulSet", "DaemonSet"] },
        name: STRING_PROPERTY,
        windowMinutes: { type: "integer", minimum: 1, maximum: 1_440 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "aiops.inference.metrics.get",
    title: "获取推理容量指标",
    description: "读取 GPU、推理队列、吞吐和延迟等容量证据。",
    platform: "aiops",
    service: "aiops-mon-service",
    riskLevel: "READ",
    path: "/api/agent/v1/tools/aiops.inference.metrics.get:invoke",
    timeoutMs: 5_000,
    requiresApproval: false,
    inputSchema: {
      type: "object",
      required: ["serviceUid", "deploymentUid"],
      properties: {
        serviceUid: STRING_PROPERTY,
        deploymentUid: STRING_PROPERTY,
        windowMinutes: { type: "integer", minimum: 1, maximum: 1_440 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "aiops.inference.recovery.status",
    title: "获取推理恢复状态",
    description: "读取演示环境中推理运行时、GPU 节点、流量、弹性策略和稳定副本的联合状态。",
    platform: "aiops",
    service: "aiops-k8s-service",
    riskLevel: "READ",
    path: "/api/agent/v1/tools/aiops.inference.recovery.status:invoke",
    timeoutMs: 5_000,
    requiresApproval: false,
    inputSchema: {
      type: "object",
      required: ["serviceUid", "deploymentUid"],
      properties: { serviceUid: STRING_PROPERTY, deploymentUid: STRING_PROPERTY },
      additionalProperties: false,
    },
  },
  {
    name: "aiops.gpu.capacity.ensure",
    title: "保障 GPU 节点容量",
    description: "在审批范围内检查并调整预热 GPU 节点池容量。",
    platform: "aiops",
    service: "aiops-k8s-service",
    riskLevel: "HIGH_RISK_WRITE",
    path: "/api/agent/v1/tools/aiops.gpu.capacity.ensure:invoke",
    timeoutMs: 20_000,
    requiresApproval: true,
    inputSchema: {
      type: "object",
      required: ["clusterId", "nodePool", "desiredGpuNodes", "mode"],
      properties: {
        clusterId: STRING_PROPERTY,
        nodePool: STRING_PROPERTY,
        desiredGpuNodes: { type: "integer", minimum: 1, maximum: 64 },
        mode: { type: "string", enum: ["ENSURE", "CONVERGE"] },
      },
      additionalProperties: false,
    },
  },
  {
    name: "aiops.inference.runtime.tune",
    title: "调整推理运行时",
    description: "受控调整批大小、请求归并窗口和推理引擎优化配置。",
    platform: "aiops",
    service: "aiops-k8s-service",
    riskLevel: "HIGH_RISK_WRITE",
    path: "/api/agent/v1/tools/aiops.inference.runtime.tune:invoke",
    timeoutMs: 15_000,
    requiresApproval: true,
    inputSchema: {
      type: "object",
      required: ["deploymentUid", "maxBatchSize", "duplicateWindowMs", "engineProfile"],
      properties: {
        deploymentUid: STRING_PROPERTY,
        maxBatchSize: { type: "integer", minimum: 1, maximum: 1024 },
        duplicateWindowMs: { type: "integer", minimum: 0, maximum: 10_000 },
        engineProfile: { type: "string", enum: ["BASELINE", "DYNAMIC_SHAPE_OPTIMIZED"] },
      },
      additionalProperties: false,
    },
  },
  {
    name: "aiops.inference.capacity.apply",
    title: "应用推理容量处置",
    description: "在审批和资源版本校验后调整推理副本与批处理上限。",
    platform: "aiops",
    service: "aiops-k8s-service",
    riskLevel: "HIGH_RISK_WRITE",
    path: "/api/agent/v1/tools/aiops.inference.capacity.apply:invoke",
    timeoutMs: 15_000,
    requiresApproval: true,
    inputSchema: {
      type: "object",
      required: ["clusterId", "namespace", "name", "desiredReplicas", "maxBatchSize"],
      properties: {
        clusterId: STRING_PROPERTY,
        namespace: STRING_PROPERTY,
        name: STRING_PROPERTY,
        desiredReplicas: { type: "integer", minimum: 1, maximum: 200 },
        maxBatchSize: { type: "integer", minimum: 1, maximum: 1024 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "aiops.inference.traffic.shift",
    title: "渐进切换推理流量",
    description: "按固定阶梯将流量引入已就绪的推理副本，并保留失败回切边界。",
    platform: "aiops",
    service: "aiops-k8s-service",
    riskLevel: "HIGH_RISK_WRITE",
    path: "/api/agent/v1/tools/aiops.inference.traffic.shift:invoke",
    timeoutMs: 15_000,
    requiresApproval: true,
    inputSchema: {
      type: "object",
      required: ["serviceUid", "target", "percentages"],
      properties: {
        serviceUid: STRING_PROPERTY,
        target: STRING_PROPERTY,
        percentages: {
          type: "array",
          minItems: 1,
          maxItems: 8,
          items: { type: "integer", minimum: 0, maximum: 100 },
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "aiops.inference.autoscaling.policy.update",
    title: "更新推理弹性策略",
    description: "将推理队列和延迟指标写入受治理的弹性策略。",
    platform: "aiops",
    service: "aiops-k8s-service",
    riskLevel: "HIGH_RISK_WRITE",
    path: "/api/agent/v1/tools/aiops.inference.autoscaling.policy.update:invoke",
    timeoutMs: 10_000,
    requiresApproval: true,
    inputSchema: {
      type: "object",
      required: ["clusterId", "namespace", "name", "queueDepthTarget", "p99TargetMs", "minReplicas", "maxReplicas"],
      properties: {
        clusterId: STRING_PROPERTY,
        namespace: STRING_PROPERTY,
        name: STRING_PROPERTY,
        queueDepthTarget: { type: "integer", minimum: 0, maximum: 100_000 },
        p99TargetMs: { type: "integer", minimum: 1, maximum: 60_000 },
        minReplicas: { type: "integer", minimum: 1, maximum: 200 },
        maxReplicas: { type: "integer", minimum: 1, maximum: 200 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "aiops.inference.capacity.converge",
    title: "收敛推理容量",
    description: "在恢复验证窗口后将临时容量收敛到稳定副本和批大小。",
    platform: "aiops",
    service: "aiops-k8s-service",
    riskLevel: "HIGH_RISK_WRITE",
    path: "/api/agent/v1/tools/aiops.inference.capacity.converge:invoke",
    timeoutMs: 15_000,
    requiresApproval: true,
    inputSchema: {
      type: "object",
      required: ["clusterId", "namespace", "name", "stableReplicas", "maxBatchSize", "observationMinutes"],
      properties: {
        clusterId: STRING_PROPERTY,
        namespace: STRING_PROPERTY,
        name: STRING_PROPERTY,
        stableReplicas: { type: "integer", minimum: 1, maximum: 200 },
        maxBatchSize: { type: "integer", minimum: 1, maximum: 1024 },
        observationMinutes: { type: "integer", minimum: 1, maximum: 1_440 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "dataops.quality.report.get",
    title: "获取 DataOps 质量报告",
    description: "获取数据质量报告及规则结果。",
    platform: "dataops",
    service: "dataops-dqm-service",
    riskLevel: "READ",
    path: "/api/agent/v1/tools/dataops.quality.report.get:invoke",
    timeoutMs: 5_000,
    requiresApproval: false,
    inputSchema: {
      type: "object",
      required: ["reportUid"],
      properties: { reportUid: STRING_PROPERTY },
      additionalProperties: false,
    },
  },
  {
    name: "dataops.schema.snapshot.get",
    title: "获取 DataOps Schema 快照",
    description: "获取数据资产在指定时间或版本的 Schema 快照。",
    platform: "dataops",
    service: "dataops-dgv-service",
    riskLevel: "READ",
    path: "/api/agent/v1/tools/dataops.schema.snapshot.get:invoke",
    timeoutMs: 5_000,
    requiresApproval: false,
    inputSchema: {
      type: "object",
      required: ["assetUid"],
      properties: { assetUid: STRING_PROPERTY, schemaVersion: STRING_PROPERTY, observedAt: STRING_PROPERTY },
      additionalProperties: false,
    },
  },
  {
    name: "dataops.lineage.get",
    title: "获取 DataOps 血缘",
    description: "获取资产上下游血缘和关联任务。",
    platform: "dataops",
    service: "dataops-dgv-service",
    riskLevel: "READ",
    path: "/api/agent/v1/tools/dataops.lineage.get:invoke",
    timeoutMs: 8_000,
    requiresApproval: false,
    inputSchema: {
      type: "object",
      required: ["assetUid", "direction", "depth"],
      properties: {
        assetUid: STRING_PROPERTY,
        direction: { type: "string", enum: ["UPSTREAM", "DOWNSTREAM", "BOTH"] },
        depth: { type: "integer", minimum: 1, maximum: 5 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "dataops.workflow.instance.get",
    title: "获取 DataOps 工作流实例",
    description: "获取调度实例、节点状态和脱敏日志摘要。",
    platform: "dataops",
    service: "dataops-tsk-service",
    riskLevel: "READ",
    path: "/api/agent/v1/tools/dataops.workflow.instance.get:invoke",
    timeoutMs: 5_000,
    requiresApproval: false,
    inputSchema: {
      type: "object",
      required: ["instanceUid"],
      properties: { instanceUid: STRING_PROPERTY, includeLogSummary: { type: "boolean" } },
      additionalProperties: false,
    },
  },
  {
    name: "dataops.training.dataset.build",
    title: "构建训练数据集",
    description: "基于固定历史窗口和因子变更生成版本化训练数据集。",
    platform: "dataops",
    service: "dataops-tsk-service",
    riskLevel: "HIGH_RISK_WRITE",
    path: "/api/agent/v1/tools/dataops.training.dataset.build:invoke",
    timeoutMs: 30_000,
    requiresApproval: true,
    inputSchema: {
      type: "object",
      required: ["workflowInstanceUid", "datasetUid", "historyYears", "addedFactors", "removedFactors"],
      properties: {
        workflowInstanceUid: STRING_PROPERTY,
        datasetUid: STRING_PROPERTY,
        historyYears: { type: "integer", minimum: 1, maximum: 20 },
        addedFactors: { type: "array", maxItems: 32, items: STRING_PROPERTY },
        removedFactors: { type: "array", maxItems: 32, items: STRING_PROPERTY },
      },
      additionalProperties: false,
    },
  },
  {
    name: "dataops.feature.backfill.start",
    title: "启动特征数据回填",
    description: "按修正版 Schema 对固定历史窗口执行可追溯特征回填。",
    platform: "dataops",
    service: "dataops-tsk-service",
    riskLevel: "HIGH_RISK_WRITE",
    path: "/api/agent/v1/tools/dataops.feature.backfill.start:invoke",
    timeoutMs: 30_000,
    requiresApproval: true,
    inputSchema: {
      type: "object",
      required: ["assetUid", "workflowInstanceUid", "historyMonths", "targetSchemaVersion", "outputDatasetUid"],
      properties: {
        assetUid: STRING_PROPERTY,
        workflowInstanceUid: STRING_PROPERTY,
        historyMonths: { type: "integer", minimum: 1, maximum: 120 },
        targetSchemaVersion: STRING_PROPERTY,
        outputDatasetUid: STRING_PROPERTY,
      },
      additionalProperties: false,
    },
  },
  {
    name: "dataops.dataset.validation.get",
    title: "获取数据集验证结果",
    description: "读取训练数据集的 Schema、质量、时间覆盖和可复现性验证结果。",
    platform: "dataops",
    service: "dataops-tsk-service",
    riskLevel: "READ",
    path: "/api/agent/v1/tools/dataops.dataset.validation.get:invoke",
    timeoutMs: 8_000,
    requiresApproval: false,
    inputSchema: {
      type: "object",
      required: ["datasetUid"],
      properties: { datasetUid: STRING_PROPERTY },
      additionalProperties: false,
    },
  },
  {
    name: "mlops.deployment.get",
    title: "获取 MLOps 部署证据",
    description: "获取模型部署、修订和输入契约证据。",
    platform: "mlops",
    service: "mlops-mep-service",
    riskLevel: "READ",
    path: "/api/agent/v1/tools/mlops.deployment.get:invoke",
    timeoutMs: 5_000,
    requiresApproval: false,
    inputSchema: {
      type: "object",
      required: ["deploymentUid"],
      properties: { deploymentUid: STRING_PROPERTY, includeRevisions: { type: "boolean" } },
      additionalProperties: false,
    },
  },
  {
    name: "mlops.attribution.report.get",
    title: "获取模型归因报告",
    description: "读取因子贡献、市场漂移、模型退化和候选评估摘要。",
    platform: "mlops",
    service: "mlops-mep-service",
    riskLevel: "COSTLY_READ",
    path: "/api/agent/v1/tools/mlops.attribution.report.get:invoke",
    timeoutMs: 30_000,
    requiresApproval: false,
    inputSchema: {
      type: "object",
      required: ["deploymentUid", "reportUid"],
      properties: { deploymentUid: STRING_PROPERTY, reportUid: STRING_PROPERTY },
      additionalProperties: false,
    },
  },
  {
    name: "mlops.inference.probe",
    title: "执行 MLOps 推理探针",
    description: "对部署执行受控推理探针并校验输入契约。",
    platform: "mlops",
    service: "mlops-mep-service",
    riskLevel: "COSTLY_READ",
    path: "/api/agent/v1/tools/mlops.inference.probe:invoke",
    timeoutMs: 60_000,
    requiresApproval: false,
    inputSchema: {
      type: "object",
      required: ["deploymentUid", "testDatasetRef", "sampleLimit"],
      properties: {
        deploymentUid: STRING_PROPERTY,
        testDatasetRef: STRING_PROPERTY,
        sampleLimit: { type: "integer", minimum: 1, maximum: 1_000 },
        timeoutMs: { type: "integer", minimum: 100, maximum: 60_000 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "mlops.model.iteration.start",
    title: "启动模型受控迭代",
    description: "在审批后启动固定数据集、工作流和目标修订的训练评估流程。",
    platform: "mlops",
    service: "mlops-mep-service",
    riskLevel: "HIGH_RISK_WRITE",
    path: "/api/agent/v1/tools/mlops.model.iteration.start:invoke",
    timeoutMs: 15_000,
    requiresApproval: true,
    inputSchema: {
      type: "object",
      required: ["deploymentUid", "workflowInstanceUid", "datasetRef", "targetRevision"],
      properties: {
        deploymentUid: STRING_PROPERTY,
        workflowInstanceUid: STRING_PROPERTY,
        datasetRef: STRING_PROPERTY,
        targetRevision: { type: "integer", minimum: 1 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "mlops.feature.pipeline.publish",
    title: "发布候选特征流水线",
    description: "将固定数据集与因子变更发布为可审计的候选特征流水线。",
    platform: "mlops",
    service: "mlops-mep-service",
    riskLevel: "HIGH_RISK_WRITE",
    path: "/api/agent/v1/tools/mlops.feature.pipeline.publish:invoke",
    timeoutMs: 15_000,
    requiresApproval: true,
    inputSchema: {
      type: "object",
      required: ["deploymentUid", "datasetUid", "pipelineUid", "addedFeatures", "removedFeatures"],
      properties: {
        deploymentUid: STRING_PROPERTY,
        datasetUid: STRING_PROPERTY,
        pipelineUid: STRING_PROPERTY,
        addedFeatures: { type: "array", maxItems: 64, items: STRING_PROPERTY },
        removedFeatures: { type: "array", maxItems: 64, items: STRING_PROPERTY },
      },
      additionalProperties: false,
    },
  },
  {
    name: "mlops.training.search.start",
    title: "启动受限训练搜索",
    description: "在固定数据集和参数边界内启动可审计训练或再训练搜索。",
    platform: "mlops",
    service: "mlops-mep-service",
    riskLevel: "HIGH_RISK_WRITE",
    path: "/api/agent/v1/tools/mlops.training.search.start:invoke",
    timeoutMs: 30_000,
    requiresApproval: true,
    inputSchema: {
      type: "object",
      required: ["deploymentUid", "datasetUid", "experimentUid", "targetRevision", "trialCount", "architectures", "mode"],
      properties: {
        deploymentUid: STRING_PROPERTY,
        datasetUid: STRING_PROPERTY,
        experimentUid: STRING_PROPERTY,
        targetRevision: { type: "integer", minimum: 1 },
        trialCount: { type: "integer", minimum: 1, maximum: 100 },
        architectures: { type: "array", minItems: 1, maxItems: 16, items: STRING_PROPERTY },
        mode: { type: "string", enum: ["ITERATION", "RETRAIN"] },
      },
      additionalProperties: false,
    },
  },
  {
    name: "mlops.model.evaluation.run",
    title: "执行候选模型评估",
    description: "执行效果、风险、漂移和对抗验证，并返回不可变评估摘要。",
    platform: "mlops",
    service: "mlops-mep-service",
    riskLevel: "COSTLY_READ",
    path: "/api/agent/v1/tools/mlops.model.evaluation.run:invoke",
    timeoutMs: 60_000,
    requiresApproval: false,
    inputSchema: {
      type: "object",
      required: ["deploymentUid", "experimentUid", "targetRevision", "testDatasetRef", "minimumSharpeImprovement", "maximumDrawdownIncrease"],
      properties: {
        deploymentUid: STRING_PROPERTY,
        experimentUid: STRING_PROPERTY,
        targetRevision: { type: "integer", minimum: 1 },
        testDatasetRef: STRING_PROPERTY,
        minimumSharpeImprovement: { type: "number", minimum: 0, maximum: 10 },
        maximumDrawdownIncrease: { type: "number", minimum: -1, maximum: 1 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "mlops.model.register",
    title: "登记候选模型",
    description: "将通过评估的候选修订登记到模型仓库并固化模型卡。",
    platform: "mlops",
    service: "mlops-mep-service",
    riskLevel: "HIGH_RISK_WRITE",
    path: "/api/agent/v1/tools/mlops.model.register:invoke",
    timeoutMs: 15_000,
    requiresApproval: true,
    inputSchema: {
      type: "object",
      required: ["deploymentUid", "experimentUid", "targetRevision", "modelCardUid"],
      properties: {
        deploymentUid: STRING_PROPERTY,
        experimentUid: STRING_PROPERTY,
        targetRevision: { type: "integer", minimum: 1 },
        modelCardUid: STRING_PROPERTY,
      },
      additionalProperties: false,
    },
  },
  {
    name: "mlops.feature.fallback.apply",
    title: "启用备用特征集",
    description: "在模型修复期间受控启用已经验证的备用特征集。",
    platform: "mlops",
    service: "mlops-mep-service",
    riskLevel: "HIGH_RISK_WRITE",
    path: "/api/agent/v1/tools/mlops.feature.fallback.apply:invoke",
    timeoutMs: 10_000,
    requiresApproval: true,
    inputSchema: {
      type: "object",
      required: ["deploymentUid", "featureSetUid", "reasonCode"],
      properties: { deploymentUid: STRING_PROPERTY, featureSetUid: STRING_PROPERTY, reasonCode: STRING_PROPERTY },
      additionalProperties: false,
    },
  },
  {
    name: "mlops.feature.fallback.remove",
    title: "退出备用特征集",
    description: "新模型全量稳定后退出临时备用特征集。",
    platform: "mlops",
    service: "mlops-mep-service",
    riskLevel: "HIGH_RISK_WRITE",
    path: "/api/agent/v1/tools/mlops.feature.fallback.remove:invoke",
    timeoutMs: 10_000,
    requiresApproval: true,
    inputSchema: {
      type: "object",
      required: ["deploymentUid", "featureSetUid", "targetRevision"],
      properties: {
        deploymentUid: STRING_PROPERTY,
        featureSetUid: STRING_PROPERTY,
        targetRevision: { type: "integer", minimum: 1 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "mlops.deployment.canary.apply",
    title: "应用模型灰度发布",
    description: "在固定环境、流量比例和观察窗内发布候选模型。",
    platform: "mlops",
    service: "mlops-mep-service",
    riskLevel: "HIGH_RISK_WRITE",
    path: "/api/agent/v1/tools/mlops.deployment.canary.apply:invoke",
    timeoutMs: 15_000,
    requiresApproval: true,
    inputSchema: {
      type: "object",
      required: ["deploymentUid", "targetRevision", "trafficPercent", "environment", "observationMinutes"],
      properties: {
        deploymentUid: STRING_PROPERTY,
        targetRevision: { type: "integer", minimum: 1 },
        trafficPercent: { type: "integer", minimum: 1, maximum: 50 },
        environment: { type: "string", enum: ["SIMULATION", "SHADOW", "CANARY"] },
        observationMinutes: { type: "integer", minimum: 1, maximum: 1_440 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "mlops.deployment.promote",
    title: "提升模型发布流量",
    description: "在灰度门槛通过后将候选修订提升到固定目标流量。",
    platform: "mlops",
    service: "mlops-mep-service",
    riskLevel: "HIGH_RISK_WRITE",
    path: "/api/agent/v1/tools/mlops.deployment.promote:invoke",
    timeoutMs: 15_000,
    requiresApproval: true,
    inputSchema: {
      type: "object",
      required: ["deploymentUid", "targetRevision", "trafficPercent", "environment"],
      properties: {
        deploymentUid: STRING_PROPERTY,
        targetRevision: { type: "integer", minimum: 1 },
        trafficPercent: { type: "integer", minimum: 1, maximum: 100 },
        environment: { type: "string", enum: ["SIMULATION", "SHADOW", "CANARY"] },
      },
      additionalProperties: false,
    },
  },
  {
    name: "mlops.release.validation.get",
    title: "获取模型发布验证",
    description: "读取候选修订的训练、评估、灰度、流量和回滚就绪状态。",
    platform: "mlops",
    service: "mlops-mep-service",
    riskLevel: "READ",
    path: "/api/agent/v1/tools/mlops.release.validation.get:invoke",
    timeoutMs: 8_000,
    requiresApproval: false,
    inputSchema: {
      type: "object",
      required: ["deploymentUid", "targetRevision"],
      properties: { deploymentUid: STRING_PROPERTY, targetRevision: { type: "integer", minimum: 1 } },
      additionalProperties: false,
    },
  },
  {
    name: "mlops.deployment.rollback",
    title: "回滚 MLOps 模型部署",
    description: "在审批、幂等和资源版本校验后将模型部署回滚到指定修订。",
    platform: "mlops",
    service: "mlops-mep-service",
    riskLevel: "HIGH_RISK_WRITE",
    path: "/api/agent/v1/tools/mlops.deployment.rollback:invoke",
    timeoutMs: 10_000,
    requiresApproval: true,
    inputSchema: ROLLBACK_INPUT_SCHEMA,
  },
]);

/** 判断未知值是否为普通对象；输入未知值，返回类型守卫，无副作用。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 根据工具名称返回固定描述；输入未知工具名，返回描述或抛出 TypeError。 */
export function getCompetitionToolDescriptor(name: unknown): CompetitionToolDescriptor {
  if (typeof name !== "string") throw new TypeError("Competition tool name is invalid.");
  const descriptor = COMPETITION_TOOL_REGISTRY.find((candidate) => candidate.name === name);
  if (descriptor === undefined) throw new TypeError("Competition tool is not registered.");
  return descriptor;
}

/** 校验工具参数为有界普通 JSON；输入工具和未知参数，返回安全副本，无效时抛出 TypeError。 */
export function parseCompetitionToolArguments(
  descriptor: CompetitionToolDescriptor,
  value: unknown,
): Readonly<Record<string, unknown>> {
  if (!isRecord(value)) throw new TypeError("Competition tool arguments are invalid.");
  const byteLength = Buffer.byteLength(JSON.stringify(value), "utf8");
  if (byteLength > 64 * 1024) throw new TypeError("Competition tool arguments exceed their byte budget.");
  validateArgumentsByTool(descriptor.name, value);
  return JSON.parse(JSON.stringify(value)) as Readonly<Record<string, unknown>>;
}

/** 按固定工具校验精确参数；输入名称和普通对象，无返回，无效时抛出 TypeError。 */
function validateArgumentsByTool(name: CompetitionToolName, value: Record<string, unknown>): void {
  switch (name) {
    case "aiops.alert.get":
      requireExactAlternative(value, ["alertId"], ["alertUid"]);
      break;
    case "aiops.service.health":
      requireShape(value, ["serviceUid"], ["windowMinutes"]);
      requireIntegerIfPresent(value.windowMinutes, 1, 1_440);
      break;
    case "aiops.k8s.workload.get":
      requireShape(value, ["clusterId", "namespace", "kind", "name"], ["windowMinutes"]);
      requireEnumText(value.kind, ["Deployment", "StatefulSet", "DaemonSet"]);
      requireIntegerIfPresent(value.windowMinutes, 1, 1_440);
      break;
    case "aiops.inference.metrics.get":
      requireShape(value, ["serviceUid", "deploymentUid"], ["windowMinutes"]);
      requireIntegerIfPresent(value.windowMinutes, 1, 1_440);
      break;
    case "aiops.inference.recovery.status":
      requireShape(value, ["serviceUid", "deploymentUid"], []);
      break;
    case "aiops.gpu.capacity.ensure":
      requireShape(value, ["clusterId", "nodePool", "desiredGpuNodes", "mode"], []);
      requireIntegerIfPresent(value.desiredGpuNodes, 1, 64, true);
      requireEnumText(value.mode, ["ENSURE", "CONVERGE"]);
      break;
    case "aiops.inference.runtime.tune":
      requireShape(value, ["deploymentUid", "maxBatchSize", "duplicateWindowMs", "engineProfile"], []);
      requireIntegerIfPresent(value.maxBatchSize, 1, 1_024, true);
      requireIntegerIfPresent(value.duplicateWindowMs, 0, 10_000, true);
      requireEnumText(value.engineProfile, ["BASELINE", "DYNAMIC_SHAPE_OPTIMIZED"]);
      break;
    case "aiops.inference.capacity.apply":
      requireShape(value, ["clusterId", "namespace", "name", "desiredReplicas", "maxBatchSize"], []);
      requireIntegerIfPresent(value.desiredReplicas, 1, 200, true);
      requireIntegerIfPresent(value.maxBatchSize, 1, 1_024, true);
      break;
    case "aiops.inference.traffic.shift":
      requireShape(value, ["serviceUid", "target", "percentages"], []);
      requireIntegerArray(value.percentages, "percentages", 0, 100, 1, 8);
      break;
    case "aiops.inference.autoscaling.policy.update":
      requireShape(value, ["clusterId", "namespace", "name", "queueDepthTarget", "p99TargetMs", "minReplicas", "maxReplicas"], []);
      requireIntegerIfPresent(value.queueDepthTarget, 0, 100_000, true);
      requireIntegerIfPresent(value.p99TargetMs, 1, 60_000, true);
      requireIntegerIfPresent(value.minReplicas, 1, 200, true);
      requireIntegerIfPresent(value.maxReplicas, 1, 200, true);
      if (Number(value.minReplicas) > Number(value.maxReplicas)) {
        throw new TypeError("Competition autoscaling replica range is invalid.");
      }
      break;
    case "aiops.inference.capacity.converge":
      requireShape(value, ["clusterId", "namespace", "name", "stableReplicas", "maxBatchSize", "observationMinutes"], []);
      requireIntegerIfPresent(value.stableReplicas, 1, 200, true);
      requireIntegerIfPresent(value.maxBatchSize, 1, 1_024, true);
      requireIntegerIfPresent(value.observationMinutes, 1, 1_440, true);
      break;
    case "dataops.quality.report.get":
      requireShape(value, ["reportUid"], []);
      break;
    case "dataops.schema.snapshot.get":
      requireShape(value, ["assetUid"], ["schemaVersion", "observedAt"]);
      if (value.schemaVersion !== undefined && value.observedAt !== undefined) {
        throw new TypeError("Schema snapshot accepts a version or observation time, not both.");
      }
      break;
    case "dataops.lineage.get":
      requireShape(value, ["assetUid", "direction", "depth"], []);
      requireEnumText(value.direction, ["UPSTREAM", "DOWNSTREAM", "BOTH"]);
      requireIntegerIfPresent(value.depth, 1, 5, true);
      break;
    case "dataops.workflow.instance.get":
      requireShape(value, ["instanceUid"], ["includeLogSummary"]);
      requireBooleanIfPresent(value.includeLogSummary);
      break;
    case "dataops.training.dataset.build":
      requireShape(value, ["workflowInstanceUid", "datasetUid", "historyYears", "addedFactors", "removedFactors"], []);
      requireIntegerIfPresent(value.historyYears, 1, 20, true);
      requireTextArray(value.addedFactors, "addedFactors", 0, 32);
      requireTextArray(value.removedFactors, "removedFactors", 0, 32);
      break;
    case "dataops.feature.backfill.start":
      requireShape(value, ["assetUid", "workflowInstanceUid", "historyMonths", "targetSchemaVersion", "outputDatasetUid"], []);
      requireIntegerIfPresent(value.historyMonths, 1, 120, true);
      break;
    case "dataops.dataset.validation.get":
      requireShape(value, ["datasetUid"], []);
      break;
    case "mlops.deployment.get":
      requireShape(value, ["deploymentUid"], ["includeRevisions"]);
      requireBooleanIfPresent(value.includeRevisions);
      break;
    case "mlops.attribution.report.get":
      requireShape(value, ["deploymentUid", "reportUid"], []);
      break;
    case "mlops.inference.probe":
      requireShape(value, ["deploymentUid", "testDatasetRef", "sampleLimit"], ["timeoutMs"]);
      requireIntegerIfPresent(value.sampleLimit, 1, 1_000, true);
      requireIntegerIfPresent(value.timeoutMs, 100, 60_000);
      break;
    case "mlops.model.iteration.start":
      requireShape(value, ["deploymentUid", "workflowInstanceUid", "datasetRef", "targetRevision"], []);
      requireIntegerIfPresent(value.targetRevision, 1, 1_000_000, true);
      break;
    case "mlops.feature.pipeline.publish":
      requireShape(value, ["deploymentUid", "datasetUid", "pipelineUid", "addedFeatures", "removedFeatures"], []);
      requireTextArray(value.addedFeatures, "addedFeatures", 0, 64);
      requireTextArray(value.removedFeatures, "removedFeatures", 0, 64);
      break;
    case "mlops.training.search.start":
      requireShape(value, ["deploymentUid", "datasetUid", "experimentUid", "targetRevision", "trialCount", "architectures", "mode"], []);
      requireIntegerIfPresent(value.targetRevision, 1, 1_000_000, true);
      requireIntegerIfPresent(value.trialCount, 1, 100, true);
      requireTextArray(value.architectures, "architectures", 1, 16);
      requireEnumText(value.mode, ["ITERATION", "RETRAIN"]);
      break;
    case "mlops.model.evaluation.run":
      requireShape(value, ["deploymentUid", "experimentUid", "targetRevision", "testDatasetRef", "minimumSharpeImprovement", "maximumDrawdownIncrease"], []);
      requireIntegerIfPresent(value.targetRevision, 1, 1_000_000, true);
      requireNumber(value.minimumSharpeImprovement, "minimumSharpeImprovement", 0, 10);
      requireNumber(value.maximumDrawdownIncrease, "maximumDrawdownIncrease", -1, 1);
      break;
    case "mlops.model.register":
      requireShape(value, ["deploymentUid", "experimentUid", "targetRevision", "modelCardUid"], []);
      requireIntegerIfPresent(value.targetRevision, 1, 1_000_000, true);
      break;
    case "mlops.feature.fallback.apply":
      requireShape(value, ["deploymentUid", "featureSetUid", "reasonCode"], []);
      break;
    case "mlops.feature.fallback.remove":
      requireShape(value, ["deploymentUid", "featureSetUid", "targetRevision"], []);
      requireIntegerIfPresent(value.targetRevision, 1, 1_000_000, true);
      break;
    case "mlops.deployment.canary.apply":
      requireShape(value, ["deploymentUid", "targetRevision", "trafficPercent", "environment", "observationMinutes"], []);
      requireIntegerIfPresent(value.targetRevision, 1, 1_000_000, true);
      requireIntegerIfPresent(value.trafficPercent, 1, 50, true);
      requireIntegerIfPresent(value.observationMinutes, 1, 1_440, true);
      requireEnumText(value.environment, ["SIMULATION", "SHADOW", "CANARY"]);
      break;
    case "mlops.deployment.promote":
      requireShape(value, ["deploymentUid", "targetRevision", "trafficPercent", "environment"], []);
      requireIntegerIfPresent(value.targetRevision, 1, 1_000_000, true);
      requireIntegerIfPresent(value.trafficPercent, 1, 100, true);
      requireEnumText(value.environment, ["SIMULATION", "SHADOW", "CANARY"]);
      break;
    case "mlops.release.validation.get":
      requireShape(value, ["deploymentUid", "targetRevision"], []);
      requireIntegerIfPresent(value.targetRevision, 1, 1_000_000, true);
      break;
    case "mlops.deployment.rollback":
      requireShape(value, ["deploymentUid", "targetRevision", "verificationPolicy"], []);
      requireIntegerIfPresent(value.targetRevision, 1, 1_000_000, true);
      validateVerificationPolicy(value.verificationPolicy);
      break;
  }
}

/** 校验必填和可选字段集合及字符串字段；输入对象和字段列表，无返回，无效时抛错。 */
function requireShape(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[],
): void {
  const allowed = new Set([...required, ...optional]);
  if (Object.keys(value).some((field) => !allowed.has(field))) {
    throw new TypeError("Competition tool arguments contain unknown fields.");
  }
  for (const field of required) {
    if (!(field in value)) throw new TypeError(`Competition tool field '${field}' is required.`);
  }
  for (const field of [...required, ...optional]) {
    if (value[field] !== undefined && typeof value[field] === "string") requireText(value[field]);
  }
}

/** 校验二选一精确字符串参数；输入对象和两个形状，无返回，无效时抛错。 */
function requireExactAlternative(
  value: Record<string, unknown>,
  first: readonly string[],
  second: readonly string[],
): void {
  const keys = Object.keys(value);
  /** 判断当前参数键是否精确匹配候选形状；输入字段列表，返回布尔结果。 */
  const matches = (shape: readonly string[]): boolean =>
    keys.length === shape.length && shape.every((field) => field in value);
  if ((!matches(first) && !matches(second)) || keys.some((field) => typeof value[field] !== "string")) {
    throw new TypeError("Competition tool alternative arguments are invalid.");
  }
  keys.forEach((field) => requireText(value[field]));
}

/** 校验非空有界文本；输入未知值，无返回，无效时抛出 TypeError。 */
function requireText(value: unknown): void {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > 512 || value.includes("\u0000")) {
    throw new TypeError("Competition tool text argument is invalid.");
  }
}

/** 校验可选整数；输入值、范围和是否必填，无返回，无效时抛出 TypeError。 */
function requireIntegerIfPresent(value: unknown, minimum: number, maximum: number, required = false): void {
  if (value === undefined && !required) return;
  if (!Number.isInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw new TypeError("Competition tool integer argument is invalid.");
  }
}

/** 校验可选布尔值；输入未知值，无返回，无效时抛出 TypeError。 */
function requireBooleanIfPresent(value: unknown): void {
  if (value !== undefined && typeof value !== "boolean") {
    throw new TypeError("Competition tool boolean argument is invalid.");
  }
}

/** 校验有界文本数组；输入值、字段、数量范围，无返回，无效或重复时抛出 TypeError。 */
function requireTextArray(
  value: unknown,
  label: string,
  minimumItems: number,
  maximumItems: number,
): void {
  if (
    !Array.isArray(value)
    || value.length < minimumItems
    || value.length > maximumItems
    || value.some((item) => typeof item !== "string" || item.trim().length === 0 || item.length > 512)
    || new Set(value).size !== value.length
  ) {
    throw new TypeError(`Competition tool text array '${label}' is invalid.`);
  }
}

/** 校验有界整数数组；输入值、字段、数值范围和数量范围，无返回，无效时抛出 TypeError。 */
function requireIntegerArray(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
  minimumItems: number,
  maximumItems: number,
): void {
  if (
    !Array.isArray(value)
    || value.length < minimumItems
    || value.length > maximumItems
    || value.some((item) => !Number.isInteger(item) || Number(item) < minimum || Number(item) > maximum)
  ) {
    throw new TypeError(`Competition tool integer array '${label}' is invalid.`);
  }
}

/** 校验有界数字；输入值、字段和闭区间，无返回，无效时抛出 TypeError。 */
function requireNumber(value: unknown, label: string, minimum: number, maximum: number): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new TypeError(`Competition tool number '${label}' is invalid.`);
  }
}

/** 校验枚举文本；输入未知值和白名单，无返回，无效时抛出 TypeError。 */
function requireEnumText(value: unknown, allowed: readonly string[]): void {
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new TypeError("Competition tool enum argument is invalid.");
  }
}

/** 校验回滚验证策略；输入未知值，无返回，额外字段或范围无效时抛出 TypeError。 */
function validateVerificationPolicy(value: unknown): void {
  if (!isRecord(value)) throw new TypeError("Rollback verification policy is invalid.");
  requireShape(value, ["maxErrorRate", "maxP95Ms"], []);
  if (typeof value.maxErrorRate !== "number" || value.maxErrorRate < 0 || value.maxErrorRate > 1) {
    throw new TypeError("Rollback maximum error rate is invalid.");
  }
  requireIntegerIfPresent(value.maxP95Ms, 1, 86_400_000, true);
}
