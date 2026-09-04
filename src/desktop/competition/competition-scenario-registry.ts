import type {
  ApplicationCompetitionScenarioContext,
  ApplicationCompetitionScenarioType,
} from "../contracts/application-competition-runtime";
import type { CompetitionToolName } from "./competition-tool-registry";

/** 场景内一次固定工具调用。 */
export interface CompetitionScenarioToolCall {
  readonly toolName: CompetitionToolName;
  readonly arguments: Readonly<Record<string, unknown>>;
}

/** 场景执行步骤类型，用于区分受审批写操作和执行中的只读质量门。 */
export type CompetitionScenarioExecutionStepKind = "WRITE" | "QUALITY_GATE";

/** 场景执行阶段，用于稳定展示止血、修复、发布、收敛和补偿顺序。 */
export type CompetitionScenarioExecutionPhase =
  | "MITIGATION"
  | "REPAIR"
  | "RELEASE"
  | "CONVERGENCE"
  | "COMPENSATION";

/** 一个固定、可审批、可审计的场景执行步骤。 */
export interface CompetitionScenarioExecutionStep {
  readonly stepId: string;
  readonly title: string;
  readonly description: string;
  readonly phase: CompetitionScenarioExecutionPhase;
  readonly kind: CompetitionScenarioExecutionStepKind;
  readonly toolName: CompetitionToolName;
  readonly resourceId: string;
  readonly targetRevision: number;
  readonly expectedResourceVersion: string;
  readonly arguments: Readonly<Record<string, unknown>>;
  readonly dependsOn: readonly string[];
}

/** 一个场景的完整执行和补偿计划。 */
export interface CompetitionScenarioExecutionPlan {
  readonly planId: string;
  readonly title: string;
  readonly summary: string;
  readonly steps: readonly CompetitionScenarioExecutionStep[];
  readonly compensationSteps: readonly CompetitionScenarioExecutionStep[];
}

/** 场景复盘后发布的稳定企业 Skill 定义。 */
export interface CompetitionScenarioSkillDefinition {
  readonly skillId: string;
  readonly name: string;
  readonly description: string;
  readonly triggerContext: string;
  readonly workflow: readonly string[];
  readonly requiredCapabilities: readonly string[];
  readonly verification: readonly string[];
  readonly rollback: string;
  readonly guardrails: string;
}

/** 三类竞赛场景共享的编排配置。 */
export interface CompetitionScenarioProfile {
  readonly scenarioType: ApplicationCompetitionScenarioType;
  readonly investigationCalls: readonly CompetitionScenarioToolCall[];
  readonly verificationCalls: readonly CompetitionScenarioToolCall[];
  readonly executionPlan: CompetitionScenarioExecutionPlan;
  readonly skill: CompetitionScenarioSkillDefinition;
}

/** 从基础资源版本生成有序步骤版本；输入资源版本和偏移，返回稳定文本版本。 */
function offsetResourceVersion(resourceVersion: string, offset: number): string {
  const numeric = Number.parseInt(resourceVersion, 10);
  return Number.isSafeInteger(numeric) && numeric >= 0
    ? String(numeric + offset)
    : `${resourceVersion}.${offset}`;
}

/** 返回推荐服务 GPU 拥塞场景；输入资源上下文，输出 AIOps 主导的容量处置闭环。 */
function buildRecommendationCapacityProfile(
  scenario: ApplicationCompetitionScenarioContext,
): CompetitionScenarioProfile {
  return {
    scenarioType: "recommendation-capacity",
    investigationCalls: [
      { toolName: "aiops.alert.get", arguments: { alertUid: scenario.alertUid } },
      { toolName: "aiops.service.health", arguments: { serviceUid: scenario.serviceUid, windowMinutes: 30 } },
      { toolName: "aiops.k8s.workload.get", arguments: { clusterId: scenario.clusterId, namespace: scenario.namespace, kind: "Deployment", name: scenario.workloadName, windowMinutes: 30 } },
      { toolName: "aiops.inference.metrics.get", arguments: { serviceUid: scenario.serviceUid, deploymentUid: scenario.deploymentUid, windowMinutes: 15 } },
      { toolName: "dataops.workflow.instance.get", arguments: { instanceUid: scenario.workflowInstanceUid, includeLogSummary: true } },
      { toolName: "mlops.deployment.get", arguments: { deploymentUid: scenario.deploymentUid, includeRevisions: true } },
    ],
    executionPlan: {
      planId: "recommendation-capacity-recovery-v2",
      title: "推荐推理容量完整恢复计划",
      summary: "依次保障 GPU 节点、收敛运行时、扩容、渐进引流、更新弹性策略并恢复稳定容量。",
      steps: [
        {
          stepId: "gpu-capacity-ensure",
          title: "保障预热 GPU 节点",
          description: "确认 GPU 节点池能够承载扩容后的推理副本。",
          phase: "MITIGATION",
          kind: "WRITE",
          toolName: "aiops.gpu.capacity.ensure",
          resourceId: `${scenario.clusterId}/gpu-prewarmed`,
          targetRevision: 4,
          expectedResourceVersion: offsetResourceVersion(scenario.expectedResourceVersion, 0),
          arguments: { clusterId: scenario.clusterId, nodePool: "gpu-prewarmed", desiredGpuNodes: 4, mode: "ENSURE" },
          dependsOn: [],
        },
        {
          stepId: "runtime-emergency-tune",
          title: "收敛推理运行时",
          description: "临时降低批大小、启用重复请求归并并切换动态形状优化。",
          phase: "MITIGATION",
          kind: "WRITE",
          toolName: "aiops.inference.runtime.tune",
          resourceId: `${scenario.deploymentUid}/runtime`,
          targetRevision: 16,
          expectedResourceVersion: offsetResourceVersion(scenario.expectedResourceVersion, 0),
          arguments: { deploymentUid: scenario.deploymentUid, maxBatchSize: 16, duplicateWindowMs: 500, engineProfile: "DYNAMIC_SHAPE_OPTIMIZED" },
          dependsOn: ["gpu-capacity-ensure"],
        },
        {
          stepId: "replica-scale-out",
          title: "扩容推理副本",
          description: "将推理 Deployment 扩容到审批固定的目标副本数。",
          phase: "MITIGATION",
          kind: "WRITE",
          toolName: "aiops.inference.capacity.apply",
          resourceId: `${scenario.clusterId}/${scenario.namespace}/${scenario.workloadName}`,
          targetRevision: scenario.targetRevision,
          expectedResourceVersion: offsetResourceVersion(scenario.expectedResourceVersion, 0),
          arguments: { clusterId: scenario.clusterId, namespace: scenario.namespace, name: scenario.workloadName, desiredReplicas: scenario.targetRevision, maxBatchSize: 16 },
          dependsOn: ["runtime-emergency-tune"],
        },
        {
          stepId: "progressive-traffic",
          title: "渐进引入流量",
          description: "按 10%、50%、100% 阶梯将请求引入已就绪副本。",
          phase: "RELEASE",
          kind: "WRITE",
          toolName: "aiops.inference.traffic.shift",
          resourceId: `${scenario.serviceUid}/traffic`,
          targetRevision: 100,
          expectedResourceVersion: offsetResourceVersion(scenario.expectedResourceVersion, 0),
          arguments: { serviceUid: scenario.serviceUid, target: `${scenario.workloadName}:expanded`, percentages: [10, 50, 100] },
          dependsOn: ["replica-scale-out"],
        },
        {
          stepId: "queue-aware-autoscaling",
          title: "写入队列弹性策略",
          description: "将队列深度和 P99 作为后续自动扩缩容的触发指标。",
          phase: "REPAIR",
          kind: "WRITE",
          toolName: "aiops.inference.autoscaling.policy.update",
          resourceId: `${scenario.clusterId}/${scenario.namespace}/${scenario.workloadName}/autoscaling`,
          targetRevision: scenario.targetRevision,
          expectedResourceVersion: offsetResourceVersion(scenario.expectedResourceVersion, 0),
          arguments: { clusterId: scenario.clusterId, namespace: scenario.namespace, name: scenario.workloadName, queueDepthTarget: 10, p99TargetMs: 300, minReplicas: scenario.failingRevision, maxReplicas: scenario.targetRevision },
          dependsOn: ["progressive-traffic"],
        },
        {
          stepId: "capacity-convergence",
          title: "收敛临时容量",
          description: "在恢复窗口后把临时副本收敛到稳定容量并恢复正常批大小。",
          phase: "CONVERGENCE",
          kind: "WRITE",
          toolName: "aiops.inference.capacity.converge",
          resourceId: `${scenario.clusterId}/${scenario.namespace}/${scenario.workloadName}`,
          targetRevision: 12,
          expectedResourceVersion: offsetResourceVersion(scenario.expectedResourceVersion, 1),
          arguments: { clusterId: scenario.clusterId, namespace: scenario.namespace, name: scenario.workloadName, stableReplicas: 12, maxBatchSize: 64, observationMinutes: 15 },
          dependsOn: ["queue-aware-autoscaling"],
        },
        {
          stepId: "runtime-normalize",
          title: "恢复稳态运行时",
          description: "恢复稳态批大小，同时保留经过验证的动态形状优化。",
          phase: "CONVERGENCE",
          kind: "WRITE",
          toolName: "aiops.inference.runtime.tune",
          resourceId: `${scenario.deploymentUid}/runtime`,
          targetRevision: 64,
          expectedResourceVersion: offsetResourceVersion(scenario.expectedResourceVersion, 1),
          arguments: { deploymentUid: scenario.deploymentUid, maxBatchSize: 64, duplicateWindowMs: 250, engineProfile: "DYNAMIC_SHAPE_OPTIMIZED" },
          dependsOn: ["capacity-convergence"],
        },
      ],
      compensationSteps: [
        {
          stepId: "capacity-rollback",
          title: "回退容量与批大小",
          description: "验证失败时恢复原副本和原批大小。",
          phase: "COMPENSATION",
          kind: "WRITE",
          toolName: "aiops.inference.capacity.converge",
          resourceId: `${scenario.clusterId}/${scenario.namespace}/${scenario.workloadName}`,
          targetRevision: scenario.rollbackRevision ?? scenario.failingRevision,
          expectedResourceVersion: offsetResourceVersion(scenario.expectedResourceVersion, 2),
          arguments: { clusterId: scenario.clusterId, namespace: scenario.namespace, name: scenario.workloadName, stableReplicas: scenario.failingRevision, maxBatchSize: 64, observationMinutes: 1 },
          dependsOn: [],
        },
        {
          stepId: "gpu-capacity-rollback",
          title: "释放临时 GPU 节点",
          description: "在容量回退后把预热节点池收敛到基线。",
          phase: "COMPENSATION",
          kind: "WRITE",
          toolName: "aiops.gpu.capacity.ensure",
          resourceId: `${scenario.clusterId}/gpu-prewarmed`,
          targetRevision: 2,
          expectedResourceVersion: offsetResourceVersion(scenario.expectedResourceVersion, 1),
          arguments: { clusterId: scenario.clusterId, nodePool: "gpu-prewarmed", desiredGpuNodes: 2, mode: "CONVERGE" },
          dependsOn: ["capacity-rollback"],
        },
      ],
    },
    verificationCalls: [
      { toolName: "aiops.inference.metrics.get", arguments: { serviceUid: scenario.serviceUid, deploymentUid: scenario.deploymentUid, windowMinutes: 10 } },
      { toolName: "aiops.inference.recovery.status", arguments: { serviceUid: scenario.serviceUid, deploymentUid: scenario.deploymentUid } },
      { toolName: "dataops.workflow.instance.get", arguments: { instanceUid: scenario.workflowInstanceUid, includeLogSummary: false } },
      { toolName: "mlops.deployment.get", arguments: { deploymentUid: scenario.deploymentUid, includeRevisions: true } },
      { toolName: "mlops.inference.probe", arguments: { deploymentUid: scenario.deploymentUid, testDatasetRef: scenario.testDatasetRef, sampleLimit: 8, timeoutMs: 15_000 } },
    ],
    skill: {
      skillId: "synapxnet-recommendation-capacity-recovery",
      name: "推荐服务 GPU 拥塞自治恢复",
      description: "在 GPU 饱和、推理队列积压而 CPU 指标未触发 HPA 时执行受治理扩容和验证。",
      triggerContext: "推荐推理 P99、成功率、GPU 利用率和队列深度共同指向容量拥塞时使用。",
      workflow: ["对齐业务、GPU、队列、DataOps 工作流和模型部署证据。", "由 AgentTeams 判断容量瓶颈并申请完整计划审批。", "保障 GPU 节点并热更新批大小、请求归并和引擎优化。", "扩容副本并按阶梯引入流量。", "写入队列感知弹性策略并收敛稳态容量。", "由独立 Verifier 验证延迟、成功率、队列、弹性策略和业务恢复。"],
      requiredCapabilities: ["AIOps 指标与 Kubernetes 工具", "MLOps 部署读取", "AgentTeams 协同", "审批、幂等和审计"],
      verification: ["P99 延迟不超过 300ms。", "推理队列深度回落且 GPU 不再持续饱和。", "工作负载就绪副本达到目标值。", "真实推荐探针返回 8 条 dcn_1 候选且模型摘要与部署一致。"],
      rollback: "任一步骤或独立验证失败时执行已审批的容量和 GPU 节点补偿计划，并将事件保持为 FAILED 交给人工 SRE。",
      guardrails: "扩容属于成本敏感写操作；必须限制最大副本数、使用资源版本和人工审批。",
    },
  };
}

/** 返回量化模型迭代场景；输入资源上下文，输出归因、训练和上线闭环。 */
function buildQuantitativeIterationProfile(
  scenario: ApplicationCompetitionScenarioContext,
): CompetitionScenarioProfile {
  return {
    scenarioType: "quantitative-iteration",
    investigationCalls: [
      { toolName: "aiops.service.health", arguments: { serviceUid: scenario.serviceUid, windowMinutes: 30 } },
      { toolName: "dataops.quality.report.get", arguments: { reportUid: scenario.reportUid } },
      { toolName: "dataops.workflow.instance.get", arguments: { instanceUid: scenario.workflowInstanceUid, includeLogSummary: true } },
      { toolName: "mlops.attribution.report.get", arguments: { deploymentUid: scenario.deploymentUid, reportUid: scenario.reportUid } },
      { toolName: "mlops.deployment.get", arguments: { deploymentUid: scenario.deploymentUid, includeRevisions: true } },
      { toolName: "mlops.inference.probe", arguments: { deploymentUid: scenario.deploymentUid, testDatasetRef: scenario.testDatasetRef, sampleLimit: 100, timeoutMs: 10_000 } },
    ],
    executionPlan: {
      planId: "quantitative-ashare-model-iteration-v3",
      title: "量化模型归因与迭代完整计划",
      summary: "从训练数据集、特征流水线、并行搜索、评估、模型登记到模拟盘灰度和提升形成完整可审计链路。",
      steps: [
        {
          stepId: "training-dataset-build",
          title: "发布真实 A 股因子数据集",
          description: "引用 A-CryptoTrader 公开行情派生的版本化因子矩阵和时间切分。",
          phase: "REPAIR",
          kind: "WRITE",
          toolName: "dataops.training.dataset.build",
          resourceId: "a-share-factor-demo-v1",
          targetRevision: scenario.targetRevision,
          expectedResourceVersion: offsetResourceVersion(scenario.expectedResourceVersion, 0),
          arguments: {
            workflowInstanceUid: scenario.workflowInstanceUid,
            datasetUid: "a-share-factor-demo-v1",
            historyYears: 1,
            addedFactors: ["momentum_5", "momentum_20", "momentum_60", "momentum_120"],
            removedFactors: ["volume_expansion", "amount_expansion"],
          },
          dependsOn: [],
        },
        {
          stepId: "feature-pipeline-publish",
          title: "发布候选特征流水线",
          description: "将因子替换固化为版本化候选流水线。",
          phase: "REPAIR",
          kind: "WRITE",
          toolName: "mlops.feature.pipeline.publish",
          resourceId: `pipeline_quant_${scenario.targetRevision}`,
          targetRevision: scenario.targetRevision,
          expectedResourceVersion: offsetResourceVersion(scenario.expectedResourceVersion, 0),
          arguments: {
            deploymentUid: scenario.deploymentUid,
            datasetUid: "a-share-factor-demo-v1",
            pipelineUid: `pipeline_quant_${scenario.targetRevision}`,
            addedFeatures: ["momentum_5", "momentum_20", "momentum_60", "momentum_120"],
            removedFeatures: ["volume_expansion", "amount_expansion"],
          },
          dependsOn: ["training-dataset-build"],
        },
        {
          stepId: "parallel-training-search",
          title: "执行 30 组受限训练搜索",
          description: "在固定时间切分上搜索可审计逻辑回归的学习率和正则参数。",
          phase: "REPAIR",
          kind: "WRITE",
          toolName: "mlops.training.search.start",
          resourceId: `experiment_quant_${scenario.targetRevision}`,
          targetRevision: scenario.targetRevision,
          expectedResourceVersion: offsetResourceVersion(scenario.expectedResourceVersion, 0),
          arguments: {
            deploymentUid: scenario.deploymentUid,
            datasetUid: "a-share-factor-demo-v1",
            experimentUid: `experiment_quant_${scenario.targetRevision}`,
            targetRevision: scenario.targetRevision,
            trialCount: 30,
            architectures: ["GovernedLogisticRegression"],
            mode: "ITERATION",
          },
          dependsOn: ["feature-pipeline-publish"],
        },
        {
          stepId: "candidate-evaluation",
          title: "执行收益与风险评估",
          description: "核验真实测试集的 AUC、IC、相对候选池模拟 Sharpe、最大回撤和时间切分。",
          phase: "REPAIR",
          kind: "QUALITY_GATE",
          toolName: "mlops.model.evaluation.run",
          resourceId: `experiment_quant_${scenario.targetRevision}`,
          targetRevision: scenario.targetRevision,
          expectedResourceVersion: offsetResourceVersion(scenario.expectedResourceVersion, 0),
          arguments: {
            deploymentUid: scenario.deploymentUid,
            experimentUid: `experiment_quant_${scenario.targetRevision}`,
            targetRevision: scenario.targetRevision,
            testDatasetRef: scenario.testDatasetRef,
            minimumSharpeImprovement: 0.05,
            maximumDrawdownIncrease: 0.02,
          },
          dependsOn: ["parallel-training-search"],
        },
        {
          stepId: "candidate-register",
          title: "登记候选模型",
          description: "将评估通过的修订和模型卡写入模型仓库。",
          phase: "RELEASE",
          kind: "WRITE",
          toolName: "mlops.model.register",
          resourceId: `${scenario.deploymentUid}/revisions/${scenario.targetRevision}`,
          targetRevision: scenario.targetRevision,
          expectedResourceVersion: offsetResourceVersion(scenario.expectedResourceVersion, 0),
          arguments: {
            deploymentUid: scenario.deploymentUid,
            experimentUid: `experiment_quant_${scenario.targetRevision}`,
            targetRevision: scenario.targetRevision,
            modelCardUid: `modelcard_quant_${scenario.targetRevision}`,
          },
          dependsOn: ["candidate-evaluation"],
        },
        {
          stepId: "simulation-canary",
          title: "模拟盘 1% 灰度",
          description: "在历史回测与演示验证环境中执行压缩观察窗灰度。",
          phase: "RELEASE",
          kind: "WRITE",
          toolName: "mlops.deployment.canary.apply",
          resourceId: `${scenario.deploymentUid}/traffic`,
          targetRevision: scenario.targetRevision,
          expectedResourceVersion: offsetResourceVersion(scenario.expectedResourceVersion, 0),
          arguments: { deploymentUid: scenario.deploymentUid, targetRevision: scenario.targetRevision, trafficPercent: 1, environment: "SIMULATION", observationMinutes: 30 },
          dependsOn: ["candidate-register"],
        },
        {
          stepId: "simulation-promote",
          title: "提升模拟信号流",
          description: "灰度门槛通过后把演示环境信号流提升到 100%。",
          phase: "RELEASE",
          kind: "WRITE",
          toolName: "mlops.deployment.promote",
          resourceId: `${scenario.deploymentUid}/traffic`,
          targetRevision: scenario.targetRevision,
          expectedResourceVersion: offsetResourceVersion(scenario.expectedResourceVersion, 1),
          arguments: { deploymentUid: scenario.deploymentUid, targetRevision: scenario.targetRevision, trafficPercent: 100, environment: "SIMULATION" },
          dependsOn: ["simulation-canary"],
        },
      ],
      compensationSteps: [
        {
          stepId: "quantitative-model-rollback",
          title: "回滚至旧模型修订",
          description: "验证失败时保留旧模型热备并恢复原修订。",
          phase: "COMPENSATION",
          kind: "WRITE",
          toolName: "mlops.deployment.rollback",
          resourceId: scenario.deploymentUid,
          targetRevision: scenario.rollbackRevision ?? scenario.failingRevision,
          expectedResourceVersion: offsetResourceVersion(scenario.expectedResourceVersion, 2),
          arguments: { deploymentUid: scenario.deploymentUid, targetRevision: scenario.rollbackRevision ?? scenario.failingRevision, verificationPolicy: { maxErrorRate: 0.05, maxP95Ms: 300 } },
          dependsOn: [],
        },
      ],
    },
    verificationCalls: [
      { toolName: "aiops.service.health", arguments: { serviceUid: scenario.serviceUid, windowMinutes: 10 } },
      { toolName: "dataops.dataset.validation.get", arguments: { datasetUid: "a-share-factor-demo-v1" } },
      { toolName: "mlops.attribution.report.get", arguments: { deploymentUid: scenario.deploymentUid, reportUid: scenario.reportUid } },
      { toolName: "mlops.deployment.get", arguments: { deploymentUid: scenario.deploymentUid, includeRevisions: true } },
      { toolName: "mlops.release.validation.get", arguments: { deploymentUid: scenario.deploymentUid, targetRevision: scenario.targetRevision } },
      { toolName: "mlops.inference.probe", arguments: { deploymentUid: scenario.deploymentUid, testDatasetRef: scenario.testDatasetRef, sampleLimit: 100, timeoutMs: 10_000 } },
    ],
    skill: {
      skillId: "synapxnet-quantitative-model-iteration",
      name: "量化模型归因与受控迭代",
      description: "根据盘后数据就绪事件完成模型归因、迭代审批、训练评估和可审计发布。",
      triggerContext: "行情和交易分区就绪，且线上模型 IC、收益归因或市场状态出现退化时使用。",
      workflow: ["校验 AIOps 服务健康、盘后数据和工作流完整性。", "使用真实测试集完成低波动/量能基线归因。", "由 AgentTeams 形成多周期动量候选计划并提交审批。", "发布 A 股因子数据产品和候选特征流水线。", "执行 30 组受限训练搜索、真实测试集评估并登记模型卡。", "在模拟盘执行 1% 灰度和全量信号提升。", "独立验证数据集摘要、目标修订、发布状态与真实样本推理探针。"],
      requiredCapabilities: ["DataOps 数据质量与工作流", "MLOps 归因、训练和部署", "AgentTeams 协同", "模型风险审批"],
      verification: ["候选模型 IC 和风险指标达到策略门槛。", "部署修订与审批目标一致。", "推理探针和数据契约验证通过。"],
      rollback: "候选模型未通过任一质量门或独立验证时停止流量扩大，执行已审批的旧修订回滚并归档失败实验。",
      guardrails: "真实资金切换必须保留人工审批和交易日观察窗，不得表述为无条件全自动实盘上线。",
    },
  };
}

/** 返回跨域特征漂移场景；输入资源上下文，输出三平台证据对齐与回滚闭环。 */
function buildFeatureDriftProfile(
  scenario: ApplicationCompetitionScenarioContext,
): CompetitionScenarioProfile {
  return {
    scenarioType: "feature-drift",
    investigationCalls: [
      { toolName: "aiops.alert.get", arguments: { alertUid: scenario.alertUid } },
      { toolName: "aiops.service.health", arguments: { serviceUid: scenario.serviceUid, windowMinutes: 30 } },
      { toolName: "aiops.k8s.workload.get", arguments: { clusterId: scenario.clusterId, namespace: scenario.namespace, kind: "Deployment", name: scenario.workloadName, windowMinutes: 30 } },
      { toolName: "dataops.quality.report.get", arguments: { reportUid: scenario.reportUid } },
      { toolName: "dataops.schema.snapshot.get", arguments: { assetUid: scenario.assetUid } },
      { toolName: "dataops.lineage.get", arguments: { assetUid: scenario.assetUid, direction: "BOTH", depth: 3 } },
      { toolName: "dataops.workflow.instance.get", arguments: { instanceUid: scenario.workflowInstanceUid, includeLogSummary: true } },
      { toolName: "mlops.deployment.get", arguments: { deploymentUid: scenario.deploymentUid, includeRevisions: true } },
      { toolName: "mlops.inference.probe", arguments: { deploymentUid: scenario.deploymentUid, testDatasetRef: scenario.testDatasetRef, sampleLimit: 50, timeoutMs: 10_000 } },
    ],
    executionPlan: {
      planId: "feature-drift-full-recovery-v2",
      title: "跨域特征漂移完整恢复计划",
      summary: "先启用备用特征止损，再完成三年数据回填、重训练、评估、灰度发布和备用特征退出。",
      steps: [
        {
          stepId: "fallback-feature-apply",
          title: "启用备用特征集止损",
          description: "临时屏蔽漂移特征并切换到已经验证的备用特征。",
          phase: "MITIGATION",
          kind: "WRITE",
          toolName: "mlops.feature.fallback.apply",
          resourceId: `${scenario.deploymentUid}/feature-set`,
          targetRevision: scenario.failingRevision,
          expectedResourceVersion: offsetResourceVersion(scenario.expectedResourceVersion, 0),
          arguments: { deploymentUid: scenario.deploymentUid, featureSetUid: "feature_set_risk_fallback_v1", reasonCode: "UPSTREAM_SDK_CONTRACT_DRIFT" },
          dependsOn: [],
        },
        {
          stepId: "feature-history-backfill",
          title: "回填三年特征数据",
          description: "按修正版采集逻辑重算历史数据并生成版本化训练集。",
          phase: "REPAIR",
          kind: "WRITE",
          toolName: "dataops.feature.backfill.start",
          resourceId: `${scenario.assetUid}/backfill`,
          targetRevision: scenario.targetRevision,
          expectedResourceVersion: offsetResourceVersion(scenario.expectedResourceVersion, 0),
          arguments: {
            assetUid: scenario.assetUid,
            workflowInstanceUid: scenario.workflowInstanceUid,
            historyMonths: 36,
            targetSchemaVersion: "2026.08.11-fixed",
            outputDatasetUid: `dataset_risk_repaired_${scenario.targetRevision}`,
          },
          dependsOn: ["fallback-feature-apply"],
        },
        {
          stepId: "repaired-dataset-gate",
          title: "校验修复数据集",
          description: "确认 Schema、质量和时间覆盖满足模型重训练条件。",
          phase: "REPAIR",
          kind: "QUALITY_GATE",
          toolName: "dataops.dataset.validation.get",
          resourceId: `dataset_risk_repaired_${scenario.targetRevision}`,
          targetRevision: scenario.targetRevision,
          expectedResourceVersion: offsetResourceVersion(scenario.expectedResourceVersion, 1),
          arguments: { datasetUid: `dataset_risk_repaired_${scenario.targetRevision}` },
          dependsOn: ["feature-history-backfill"],
        },
        {
          stepId: "risk-model-retrain",
          title: "重训练修复模型",
          description: "在修正版数据集上执行有界并行重训练。",
          phase: "REPAIR",
          kind: "WRITE",
          toolName: "mlops.training.search.start",
          resourceId: `experiment_risk_${scenario.targetRevision}`,
          targetRevision: scenario.targetRevision,
          expectedResourceVersion: offsetResourceVersion(scenario.expectedResourceVersion, 0),
          arguments: {
            deploymentUid: scenario.deploymentUid,
            datasetUid: `dataset_risk_repaired_${scenario.targetRevision}`,
            experimentUid: `experiment_risk_${scenario.targetRevision}`,
            targetRevision: scenario.targetRevision,
            trialCount: 12,
            architectures: ["LightGBM", "WideAndDeep"],
            mode: "RETRAIN",
          },
          dependsOn: ["repaired-dataset-gate"],
        },
        {
          stepId: "risk-model-evaluation",
          title: "评估修复模型",
          description: "验证输入契约、KS、业务通过率和坏账风险没有退化。",
          phase: "REPAIR",
          kind: "QUALITY_GATE",
          toolName: "mlops.model.evaluation.run",
          resourceId: `experiment_risk_${scenario.targetRevision}`,
          targetRevision: scenario.targetRevision,
          expectedResourceVersion: offsetResourceVersion(scenario.expectedResourceVersion, 0),
          arguments: {
            deploymentUid: scenario.deploymentUid,
            experimentUid: `experiment_risk_${scenario.targetRevision}`,
            targetRevision: scenario.targetRevision,
            testDatasetRef: scenario.testDatasetRef,
            minimumSharpeImprovement: 0,
            maximumDrawdownIncrease: 0,
          },
          dependsOn: ["risk-model-retrain"],
        },
        {
          stepId: "risk-model-register",
          title: "登记修复模型",
          description: "固化修订、模型卡、输入契约和修复数据集引用。",
          phase: "RELEASE",
          kind: "WRITE",
          toolName: "mlops.model.register",
          resourceId: `${scenario.deploymentUid}/revisions/${scenario.targetRevision}`,
          targetRevision: scenario.targetRevision,
          expectedResourceVersion: offsetResourceVersion(scenario.expectedResourceVersion, 0),
          arguments: { deploymentUid: scenario.deploymentUid, experimentUid: `experiment_risk_${scenario.targetRevision}`, targetRevision: scenario.targetRevision, modelCardUid: `modelcard_risk_${scenario.targetRevision}` },
          dependsOn: ["risk-model-evaluation"],
        },
        {
          stepId: "risk-canary-release",
          title: "执行 5% 灰度发布",
          description: "在比赛演示环境以压缩观察窗验证业务指标和服务健康。",
          phase: "RELEASE",
          kind: "WRITE",
          toolName: "mlops.deployment.canary.apply",
          resourceId: `${scenario.deploymentUid}/traffic`,
          targetRevision: scenario.targetRevision,
          expectedResourceVersion: offsetResourceVersion(scenario.expectedResourceVersion, 0),
          arguments: { deploymentUid: scenario.deploymentUid, targetRevision: scenario.targetRevision, trafficPercent: 5, environment: "CANARY", observationMinutes: 30 },
          dependsOn: ["risk-model-register"],
        },
        {
          stepId: "risk-full-promotion",
          title: "提升到全量流量",
          description: "灰度门槛通过后将修复模型提升到 100% 流量。",
          phase: "RELEASE",
          kind: "WRITE",
          toolName: "mlops.deployment.promote",
          resourceId: `${scenario.deploymentUid}/traffic`,
          targetRevision: scenario.targetRevision,
          expectedResourceVersion: offsetResourceVersion(scenario.expectedResourceVersion, 1),
          arguments: { deploymentUid: scenario.deploymentUid, targetRevision: scenario.targetRevision, trafficPercent: 100, environment: "CANARY" },
          dependsOn: ["risk-canary-release"],
        },
        {
          stepId: "fallback-feature-remove",
          title: "退出备用特征集",
          description: "全量修复模型稳定后退出临时备用特征。",
          phase: "CONVERGENCE",
          kind: "WRITE",
          toolName: "mlops.feature.fallback.remove",
          resourceId: `${scenario.deploymentUid}/feature-set`,
          targetRevision: scenario.targetRevision,
          expectedResourceVersion: offsetResourceVersion(scenario.expectedResourceVersion, 1),
          arguments: { deploymentUid: scenario.deploymentUid, featureSetUid: "feature_set_risk_fallback_v1", targetRevision: scenario.targetRevision },
          dependsOn: ["risk-full-promotion"],
        },
      ],
      compensationSteps: [
        {
          stepId: "risk-deployment-rollback",
          title: "回滚至稳定模型修订",
          description: "任一验证门失败时恢复最近稳定修订并保持备用特征。",
          phase: "COMPENSATION",
          kind: "WRITE",
          toolName: "mlops.deployment.rollback",
          resourceId: scenario.deploymentUid,
          targetRevision: scenario.rollbackRevision ?? scenario.failingRevision,
          expectedResourceVersion: offsetResourceVersion(scenario.expectedResourceVersion, 2),
          arguments: { deploymentUid: scenario.deploymentUid, targetRevision: scenario.rollbackRevision ?? scenario.failingRevision, verificationPolicy: { maxErrorRate: 0.05, maxP95Ms: 300 } },
          dependsOn: [],
        },
        {
          stepId: "risk-fallback-preserve",
          title: "保持备用特征集",
          description: "回滚后继续使用备用特征，防止漂移输入重新进入模型。",
          phase: "COMPENSATION",
          kind: "WRITE",
          toolName: "mlops.feature.fallback.apply",
          resourceId: `${scenario.deploymentUid}/feature-set`,
          targetRevision: scenario.targetRevision,
          expectedResourceVersion: offsetResourceVersion(scenario.expectedResourceVersion, 2),
          arguments: { deploymentUid: scenario.deploymentUid, featureSetUid: "feature_set_risk_fallback_v1", reasonCode: "VERIFICATION_ROLLBACK" },
          dependsOn: ["risk-deployment-rollback"],
        },
      ],
    },
    verificationCalls: [
      { toolName: "aiops.inference.recovery.status", arguments: { serviceUid: scenario.serviceUid, deploymentUid: scenario.deploymentUid } },
      { toolName: "dataops.dataset.validation.get", arguments: { datasetUid: `dataset_risk_repaired_${scenario.targetRevision}` } },
      { toolName: "mlops.inference.probe", arguments: { deploymentUid: scenario.deploymentUid, testDatasetRef: scenario.testDatasetRef, sampleLimit: 100, timeoutMs: 10_000 } },
      { toolName: "mlops.deployment.get", arguments: { deploymentUid: scenario.deploymentUid, includeRevisions: true } },
      { toolName: "mlops.release.validation.get", arguments: { deploymentUid: scenario.deploymentUid, targetRevision: scenario.targetRevision } },
    ],
    skill: {
      skillId: "synapxnet-feature-drift-recovery",
      name: "跨域特征漂移恢复",
      description: "对齐 DataOps 血缘、MLOps 输入契约和 AIOps 业务状态，完成备用特征止损、数据回填、重训练与灰度恢复。",
      triggerContext: "业务效果下降或模型错误率异常，且基础设施状态不足以解释问题时使用。",
      workflow: ["读取 AIOps 业务与服务证据。", "计算并定位 DataOps 质量、Schema、血缘与上游采集变化。", "对齐 MLOps 部署修订和推理契约。", "由 AgentTeams Leader 申请完整恢复与补偿计划。", "启用备用特征完成即时止损。", "回填三年特征数据并通过数据质量门。", "完成模型重训练、评估、登记、5% 灰度与全量提升。", "退出备用特征并由独立 Verifier 验证业务、数据和模型发布状态。"],
      requiredCapabilities: ["DataOps 质量、Schema 与血缘", "MLOps 部署与推理探针", "AIOps 服务健康", "AgentTeams 协同与审批"],
      verification: ["修复数据集 Schema、质量与历史覆盖全部通过。", "推理探针契约匹配且错误率低于 5%。", "目标修订、灰度门和 100% 流量提升状态一致。", "业务通过率与服务健康恢复。"],
      rollback: "任一质量门或独立验证失败时回滚到最近稳定修订并保持备用特征集，事件保持 FAILED。",
      guardrails: "输入快照、凭据和绝对路径不得进入 Skill；每个写步骤必须命中审批计划、参数摘要、资源版本和幂等范围。",
    },
  };
}

/** 解析场景配置；输入事件资源上下文，返回固定白名单中的编排定义。 */
export function getCompetitionScenarioProfile(
  scenario: ApplicationCompetitionScenarioContext,
): CompetitionScenarioProfile {
  switch (scenario.scenarioType) {
    case "recommendation-capacity":
      return buildRecommendationCapacityProfile(scenario);
    case "quantitative-iteration":
      return buildQuantitativeIterationProfile(scenario);
    case "feature-drift":
      return buildFeatureDriftProfile(scenario);
  }
}
