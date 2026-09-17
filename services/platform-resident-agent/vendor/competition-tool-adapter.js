// -*- coding: utf-8 -*-
// Copyright (C) 2026 Synapxnet. All rights reserved.
// This file is Synapxnet Proprietary and Confidential. It is strictly
// forbidden to copy, distribute, or use without explicit authorization.
// 驻场服务契约构建 / Resident service contract build
// Author: maoyo
// Department: 研发部
// Date: 2026-09-16
// Version: 1.3.0
// Security Level: INTERNAL
// __version__ = "1.3.0"; __author__ = "maoyo"; __copyright__ = "Copyright 2026 Synapxnet"
// __maintainer__ = "maoyo"; __email__ = "synapxnet@gmail.com"
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpCompetitionToolAdapter = exports.FixtureCompetitionToolAdapter = void 0;
const competition_resource_versions_1 = require("./competition-resource-versions");
const competition_tool_registry_1 = require("./competition-tool-registry");
/** 无外部平台时提供真实流程语义的竞赛 Fixture Adapter。 */
class FixtureCompetitionToolAdapter {
    now;
    activeRevisions = new Map();
    resourceVersions = new Map();
    remediatedIncidents = new Set();
    desiredReplicasByIncident = new Map();
    completedToolsByIncident = new Map();
    /** 创建内存 Fixture；输入可选时间函数，不访问网络或磁盘。 */
    constructor(options = {}) {
        this.now = options.now ?? (() => new Date());
    }
    /** 清空 Fixture 部署修订和资源版本；无输入，无返回。 */
    resetDemoState() {
        this.activeRevisions.clear();
        this.resourceVersions.clear();
        this.remediatedIncidents.clear();
        this.desiredReplicasByIncident.clear();
        this.completedToolsByIncident.clear();
    }
    /** 执行固定 Fixture 工具；输入统一请求，返回跨域证据或回滚受理结果。 */
    async invoke(request) {
        const startedAt = Date.now();
        const descriptor = (0, competition_tool_registry_1.getCompetitionToolDescriptor)(request.toolName);
        const argumentsValue = (0, competition_tool_registry_1.parseCompetitionToolArguments)(descriptor, request.arguments);
        if (descriptor.requiresApproval && request.governance === null) {
            return this.failure(request, "APPROVAL_REQUIRED", "该高风险操作缺少持久化审批。", false);
        }
        const observedAt = this.now().toISOString();
        const deploymentUid = String(argumentsValue.deploymentUid ?? "deploy_risk_prod");
        const defaultRevision = deploymentUid.includes("recommendation") ? 6 : 18;
        const currentRevision = this.activeRevisions.get(deploymentUid) ?? defaultRevision;
        const resourceKey = this.fixtureResourceKey(request, argumentsValue);
        const currentResourceVersion = this.resourceVersions.get(resourceKey) ?? 42;
        const response = this.buildFixtureData(request, argumentsValue, currentRevision, currentResourceVersion);
        const appliesRemediation = descriptor.requiresApproval && response.success && request.governance?.dryRun === false;
        if (appliesRemediation) {
            const completed = this.completedToolsByIncident.get(request.incidentId) ?? new Set();
            completed.add(request.toolName);
            this.completedToolsByIncident.set(request.incidentId, completed);
            if (["aiops.inference.capacity.converge", "mlops.deployment.promote", "mlops.deployment.rollback"].includes(request.toolName)) {
                this.remediatedIncidents.add(request.incidentId);
            }
            if (Number.isInteger(argumentsValue.targetRevision)
                && ["mlops.model.iteration.start", "mlops.deployment.promote", "mlops.deployment.rollback"].includes(request.toolName)) {
                this.activeRevisions.set(deploymentUid, Number(argumentsValue.targetRevision));
            }
            if (Number.isInteger(argumentsValue.desiredReplicas)) {
                this.desiredReplicasByIncident.set(request.incidentId, Number(argumentsValue.desiredReplicas));
            }
            this.resourceVersions.set(resourceKey, currentResourceVersion + 1);
        }
        return {
            ...response,
            meta: {
                ...response.meta,
                durationMs: Math.max(0, Date.now() - startedAt),
                resourceVersion: String(appliesRemediation
                    ? currentResourceVersion + 1
                    : currentResourceVersion),
                observedAt,
                summary: response.success
                    ? this.summaryFor(request.toolName, currentRevision, argumentsValue, this.remediatedIncidents.has(request.incidentId))
                    : response.error?.message ?? "调用失败",
            },
        };
    }
    /** 计算 Fixture 资源版本作用域；输入请求和参数，返回同一逻辑资源共享的稳定键。 */
    fixtureResourceKey(request, argumentsValue) {
        const deploymentUid = String(argumentsValue.deploymentUid ?? "");
        if (["aiops.inference.capacity.apply", "aiops.inference.capacity.converge"].includes(request.toolName)) {
            return `${request.incidentId}:workload:${argumentsValue.clusterId}/${argumentsValue.namespace}/${argumentsValue.name}`;
        }
        if (["aiops.inference.runtime.tune"].includes(request.toolName)) {
            return `${request.incidentId}:runtime:${deploymentUid}`;
        }
        if (["mlops.deployment.canary.apply", "mlops.deployment.promote"].includes(request.toolName)) {
            return `${request.incidentId}:traffic:${deploymentUid}`;
        }
        if (["mlops.feature.fallback.apply", "mlops.feature.fallback.remove"].includes(request.toolName)) {
            return `${request.incidentId}:feature-set:${deploymentUid}`;
        }
        if (request.toolName === "mlops.deployment.rollback") {
            return `${request.incidentId}:traffic:${deploymentUid}`;
        }
        return `${request.incidentId}:${request.toolName}:${deploymentUid || String(argumentsValue.datasetUid ?? argumentsValue.assetUid ?? "default")}`;
    }
    /** 构建工具专属 Fixture 数据；输入请求、参数、修订和资源版本，返回未补齐元数据的统一响应。 */
    buildFixtureData(request, argumentsValue, currentRevision, currentResourceVersion) {
        const recovered = this.remediatedIncidents.has(request.incidentId);
        const completedTools = this.completedToolsByIncident.get(request.incidentId) ?? new Set();
        const identityText = JSON.stringify(argumentsValue);
        const scenarioType = identityText.includes("recommendation") || identityText.includes("rec_")
            ? "recommendation-capacity"
            : identityText.includes("quant")
                ? "quantitative-iteration"
                : "feature-drift";
        const desiredReplicas = this.desiredReplicasByIncident.get(request.incidentId) ?? (recovered ? 3 : 1);
        const forcedVerificationFailure = recovered
            && argumentsValue.testDatasetRef === "fixture://goai/verification-failure-v1";
        /** 包装成功 Fixture 数据；输入领域字段，返回带完整竞赛元数据的成功响应。 */
        const success = (data) => ({
            success: true,
            data,
            error: null,
            meta: {
                requestId: request.requestId,
                workspaceId: request.workspaceId,
                incidentId: request.incidentId,
                traceId: request.traceId,
                toolName: request.toolName,
                contractVersion: "1.0.0",
                durationMs: 0,
                source: "OpenXnetDesktop/fixture",
                platform: (0, competition_tool_registry_1.getCompetitionToolDescriptor)(request.toolName).platform,
                resourceVersion: String(currentResourceVersion),
                observedAt: this.now().toISOString(),
                summary: "",
            },
        });
        switch (request.toolName) {
            case "aiops.alert.get":
                return success({
                    alertUid: argumentsValue.alertUid ?? argumentsValue.alertId,
                    status: recovered ? "RECOVERED" : "FIRING",
                    metric: "prediction_error_rate",
                    value: recovered ? 0.012 : 0.184,
                    threshold: 0.05,
                    serviceUid: "service_risk_inference",
                });
            case "aiops.service.health":
                return success({
                    serviceUid: argumentsValue.serviceUid,
                    health: recovered || scenarioType !== "recommendation-capacity" ? "HEALTHY" : "DEGRADED",
                    errorRate: recovered ? 0.0005 : scenarioType === "recommendation-capacity" ? 0.05 : 0.001,
                    p95Ms: recovered ? 72 : scenarioType === "recommendation-capacity" ? 2_800 : 95,
                    readyInstances: recovered ? 12 : scenarioType === "recommendation-capacity" ? 6 : 3,
                    totalInstances: recovered ? 12 : scenarioType === "recommendation-capacity" ? 6 : 3,
                });
            case "aiops.k8s.workload.get":
                return success({
                    clusterId: argumentsValue.clusterId,
                    namespace: argumentsValue.namespace,
                    kind: argumentsValue.kind,
                    name: argumentsValue.name,
                    revision: currentRevision,
                    readyReplicas: recovered ? desiredReplicas : scenarioType === "recommendation-capacity" ? 6 : 3,
                    replicas: recovered ? desiredReplicas : scenarioType === "recommendation-capacity" ? 6 : 3,
                    restartCount: 0,
                });
            case "aiops.inference.metrics.get":
                return success({
                    serviceUid: argumentsValue.serviceUid,
                    deploymentUid: argumentsValue.deploymentUid,
                    gpuSmUtilization: recovered ? 0.72 : 1,
                    gpuMemoryBandwidthUtilization: recovered ? 0.68 : 1,
                    batchQueueSize: recovered ? 0 : 1000,
                    queueDropRate: recovered ? 0.001 : 0.15,
                    p99Ms: recovered ? 80 : 5000,
                    successRate: recovered ? 0.9995 : 0.95,
                });
            case "aiops.inference.recovery.status":
                return success({
                    serviceUid: argumentsValue.serviceUid,
                    deploymentUid: argumentsValue.deploymentUid,
                    recovered,
                    gpuNodesReady: recovered ? 4 : 2,
                    desiredReplicas: recovered ? 12 : 6,
                    readyReplicas: recovered ? 12 : 6,
                    trafficPercent: recovered ? 100 : 0,
                    maxBatchSize: recovered ? 64 : 64,
                    queueAwareAutoscaling: recovered,
                    businessKpiRecovered: recovered || scenarioType !== "recommendation-capacity",
                });
            case "aiops.gpu.capacity.ensure": {
                const governance = this.requireFixtureGovernance(request, currentResourceVersion);
                if ("success" in governance)
                    return governance;
                return success({
                    actionId: `action-${request.requestId}`,
                    status: governance.dryRun ? "DRY_RUN" : "SUCCEEDED",
                    nodePool: argumentsValue.nodePool,
                    desiredGpuNodes: argumentsValue.desiredGpuNodes,
                    readyGpuNodes: argumentsValue.desiredGpuNodes,
                    mode: argumentsValue.mode,
                });
            }
            case "aiops.inference.runtime.tune": {
                const governance = this.requireFixtureGovernance(request, currentResourceVersion);
                if ("success" in governance)
                    return governance;
                return success({
                    actionId: `action-${request.requestId}`,
                    status: governance.dryRun ? "DRY_RUN" : "SUCCEEDED",
                    deploymentUid: argumentsValue.deploymentUid,
                    maxBatchSize: argumentsValue.maxBatchSize,
                    duplicateWindowMs: argumentsValue.duplicateWindowMs,
                    engineProfile: argumentsValue.engineProfile,
                    hotReloaded: !governance.dryRun,
                });
            }
            case "aiops.inference.capacity.apply": {
                const governance = this.requireFixtureGovernance(request, currentResourceVersion);
                if ("success" in governance)
                    return governance;
                return success({
                    actionId: `action-${request.requestId}`,
                    status: governance.dryRun ? "DRY_RUN" : "SUCCEEDED",
                    desiredReplicas: argumentsValue.desiredReplicas,
                    maxBatchSize: argumentsValue.maxBatchSize,
                    steps: ["capacity-precheck", "replica-scale", "batch-limit", "progressive-traffic"],
                });
            }
            case "aiops.inference.traffic.shift": {
                const governance = this.requireFixtureGovernance(request, currentResourceVersion);
                if ("success" in governance)
                    return governance;
                return success({
                    actionId: `action-${request.requestId}`,
                    status: governance.dryRun ? "DRY_RUN" : "SUCCEEDED",
                    serviceUid: argumentsValue.serviceUid,
                    target: argumentsValue.target,
                    appliedPercentages: argumentsValue.percentages,
                    finalTrafficPercent: Array.isArray(argumentsValue.percentages)
                        ? argumentsValue.percentages.at(-1)
                        : null,
                });
            }
            case "aiops.inference.autoscaling.policy.update": {
                const governance = this.requireFixtureGovernance(request, currentResourceVersion);
                if ("success" in governance)
                    return governance;
                return success({
                    actionId: `action-${request.requestId}`,
                    status: governance.dryRun ? "DRY_RUN" : "SUCCEEDED",
                    queueDepthTarget: argumentsValue.queueDepthTarget,
                    p99TargetMs: argumentsValue.p99TargetMs,
                    minReplicas: argumentsValue.minReplicas,
                    maxReplicas: argumentsValue.maxReplicas,
                    policyStatus: governance.dryRun ? "VALID" : "ACTIVE",
                });
            }
            case "aiops.inference.capacity.converge": {
                const governance = this.requireFixtureGovernance(request, currentResourceVersion);
                if ("success" in governance)
                    return governance;
                return success({
                    actionId: `action-${request.requestId}`,
                    status: governance.dryRun ? "DRY_RUN" : "SUCCEEDED",
                    stableReplicas: argumentsValue.stableReplicas,
                    readyReplicas: argumentsValue.stableReplicas,
                    maxBatchSize: argumentsValue.maxBatchSize,
                    observationMinutes: argumentsValue.observationMinutes,
                });
            }
            case "dataops.quality.report.get":
                return success({
                    reportUid: argumentsValue.reportUid,
                    status: scenarioType === "feature-drift" ? "FAILED" : "PASSED",
                    failedRules: scenarioType === "feature-drift" ? ["feature_vector_dimension", "null_ratio"] : [],
                    expectedDimension: 128,
                    observedDimension: scenarioType === "feature-drift" ? 120 : 128,
                });
            case "dataops.schema.snapshot.get":
                return success({
                    assetUid: argumentsValue.assetUid,
                    schemaVersion: "2026.08.03-17",
                    columns: 120,
                    contractDigest: "sha256:fixture-schema-v17",
                    breakingChange: true,
                });
            case "dataops.lineage.get":
                return success({
                    assetUid: argumentsValue.assetUid,
                    direction: argumentsValue.direction,
                    upstream: ["warehouse.customer_features_v17"],
                    downstream: ["mlops.deployment.risk-scoring"],
                    workflowInstanceUid: "task_risk_features_latest",
                });
            case "dataops.workflow.instance.get":
                return success({
                    instanceUid: argumentsValue.instanceUid,
                    status: scenarioType === "feature-drift" ? "SUCCEEDED_WITH_WARNINGS" : "SUCCEEDED",
                    publishedSchemaVersion: scenarioType === "feature-drift" ? "2026.08.03-17" : "2026.08.11-stable",
                    warning: scenarioType === "feature-drift" ? "feature vector dimension changed from 128 to 120" : null,
                    partitionsReady: true,
                });
            case "dataops.training.dataset.build": {
                const governance = this.requireFixtureGovernance(request, currentResourceVersion);
                if ("success" in governance)
                    return governance;
                return success({
                    actionId: `action-${request.requestId}`,
                    status: governance.dryRun ? "DRY_RUN" : "SUCCEEDED",
                    datasetUid: argumentsValue.datasetUid,
                    historyYears: argumentsValue.historyYears,
                    rowCount: 18_250_000,
                    addedFactors: argumentsValue.addedFactors,
                    removedFactors: argumentsValue.removedFactors,
                    schemaStatus: "VALID",
                });
            }
            case "dataops.feature.backfill.start": {
                const governance = this.requireFixtureGovernance(request, currentResourceVersion);
                if ("success" in governance)
                    return governance;
                return success({
                    actionId: `action-${request.requestId}`,
                    status: governance.dryRun ? "DRY_RUN" : "SUCCEEDED",
                    assetUid: argumentsValue.assetUid,
                    datasetUid: argumentsValue.outputDatasetUid,
                    historyMonths: argumentsValue.historyMonths,
                    targetSchemaVersion: argumentsValue.targetSchemaVersion,
                    rowCount: 21_600_000,
                    failedRows: 0,
                });
            }
            case "dataops.dataset.validation.get": {
                const datasetUid = String(argumentsValue.datasetUid ?? "");
                const quantitativeDataset = datasetUid === "a-share-factor-demo-v1" || datasetUid.includes("quant");
                const ready = quantitativeDataset
                    ? completedTools.has("dataops.training.dataset.build")
                    : completedTools.has("dataops.feature.backfill.start");
                return success({
                    datasetUid,
                    passed: ready,
                    status: ready ? "PASSED" : "FAILED",
                    schemaMatch: ready,
                    qualityPassRate: ready ? 1 : 0,
                    reproducible: ready,
                    historyCoverageMonths: quantitativeDataset ? 10 : 36,
                    ...(quantitativeDataset ? {
                        rowCount: 4_461,
                        symbolCount: 80,
                        sourceDateFrom: "2025-11-10",
                        sourceDateTo: "2026-08-26",
                        usageBoundary: "RESEARCH_ONLY / SIMULATION_ONLY",
                    } : {}),
                });
            }
            case "mlops.deployment.get":
                return success({
                    deploymentUid: argumentsValue.deploymentUid,
                    activeRevision: currentRevision,
                    resourceVersion: String(currentResourceVersion),
                    inputDimension: scenarioType === "quantitative-iteration" ? 5 : currentRevision <= 17 ? 120 : 128,
                    revisions: scenarioType === "quantitative-iteration" ? [2, 1] : [18, 17, 16],
                    ...(scenarioType === "recommendation-capacity" ? {
                        ready: true,
                        modelVersion: "recommendation-dcn-demo-v1",
                        algorithmId: "dcn_1",
                        candidateCount: 8,
                        modelDigestSha256: "be0cc4b7845294b61439469a345944aabea9c0878b94f3ea850230d72d697915",
                        approvalId: "APR-MEP-PROMOTE-20260828-001",
                    } : {}),
                });
            case "mlops.attribution.report.get":
                return success({
                    deploymentUid: argumentsValue.deploymentUid,
                    reportUid: argumentsValue.reportUid,
                    informationCoefficient: recovered ? 0.25228567 : -0.00993273,
                    informationCoefficientThreshold: 0.1,
                    sharpeImprovement: recovered ? 8.98509775 : 0,
                    maximumDrawdownChange: recovered ? 0.04354786 : 0,
                    regimeDrift: recovered ? "CONTROLLED" : "MULTI_PERIOD_MOMENTUM",
                    degradedFactors: recovered ? [] : ["volatility_20", "volume_expansion", "amount_expansion"],
                    recommendedFactors: ["momentum_5", "momentum_20", "momentum_60", "momentum_120", "volatility_20"],
                    usageBoundary: "RESEARCH_ONLY / SIMULATION_ONLY",
                });
            case "mlops.inference.probe":
                return success({
                    deploymentUid: argumentsValue.deploymentUid,
                    passed: (scenarioType === "quantitative-iteration" || recovered) && !forcedVerificationFailure,
                    sampleCount: argumentsValue.sampleLimit,
                    errorRate: (scenarioType === "quantitative-iteration" || recovered) && !forcedVerificationFailure
                        ? scenarioType === "quantitative-iteration" ? 0.4832
                            : scenarioType === "recommendation-capacity" ? 0 : 0.01
                        : 0.82,
                    p95Ms: (scenarioType === "quantitative-iteration" || recovered) && !forcedVerificationFailure
                        ? scenarioType === "quantitative-iteration" ? 0.02 : 112
                        : 870,
                    contractMatch: (scenarioType === "quantitative-iteration" || recovered) && !forcedVerificationFailure,
                    contractStatus: (scenarioType === "quantitative-iteration" || recovered) && !forcedVerificationFailure
                        ? "MATCHED"
                        : "MISMATCHED",
                    ...(scenarioType === "recommendation-capacity" ? {
                        algorithmId: "dcn_1",
                        productVersion: "recommendation-dcn-demo-v1",
                        candidateCount: 8,
                        modelDigestSha256: "be0cc4b7845294b61439469a345944aabea9c0878b94f3ea850230d72d697915",
                        approvalId: "APR-MEP-PROMOTE-20260828-001",
                    } : {}),
                });
            case "mlops.model.iteration.start": {
                const governance = request.governance;
                if (governance === null)
                    return this.failure(request, "APPROVAL_REQUIRED", "该高风险操作缺少持久化审批。", false);
                if (governance.expectedResourceVersion !== String(currentResourceVersion)) {
                    return this.failure(request, "RESOURCE_VERSION_CONFLICT", "模型部署资源版本已变化。", false);
                }
                return success({
                    actionId: `action-${request.requestId}`,
                    status: governance.dryRun ? "DRY_RUN" : "PENDING",
                    targetRevision: argumentsValue.targetRevision,
                    steps: ["dataset-contract-check", "attribution-plan", "training", "evaluation", "candidate-register"],
                });
            }
            case "mlops.feature.pipeline.publish": {
                const governance = this.requireFixtureGovernance(request, currentResourceVersion);
                if ("success" in governance)
                    return governance;
                return success({
                    actionId: `action-${request.requestId}`,
                    status: governance.dryRun ? "DRY_RUN" : "SUCCEEDED",
                    pipelineUid: argumentsValue.pipelineUid,
                    datasetUid: argumentsValue.datasetUid,
                    addedFeatures: argumentsValue.addedFeatures,
                    removedFeatures: argumentsValue.removedFeatures,
                    contractStatus: "VALID",
                });
            }
            case "mlops.training.search.start": {
                const governance = this.requireFixtureGovernance(request, currentResourceVersion);
                if ("success" in governance)
                    return governance;
                return success({
                    actionId: `action-${request.requestId}`,
                    status: governance.dryRun ? "DRY_RUN" : "SUCCEEDED",
                    experimentUid: argumentsValue.experimentUid,
                    targetRevision: argumentsValue.targetRevision,
                    trialCount: argumentsValue.trialCount,
                    completedTrials: governance.dryRun ? 0 : argumentsValue.trialCount,
                    architectures: argumentsValue.architectures,
                    bestTrialUid: governance.dryRun ? null : `${argumentsValue.experimentUid}_best`,
                });
            }
            case "mlops.model.evaluation.run": {
                const trained = completedTools.has("mlops.training.search.start");
                return success({
                    evaluationUid: `evaluation-${request.requestId}`,
                    status: trained ? "PASSED" : "FAILED",
                    passed: trained,
                    informationCoefficient: trained && scenarioType === "quantitative-iteration" ? 0.25228567 : trained ? 0.038 : 0.01,
                    sharpeImprovement: trained && scenarioType === "quantitative-iteration" ? 8.98509775 : trained ? 0.06 : -0.12,
                    maximumDrawdownChange: trained && scenarioType === "quantitative-iteration" ? 0.04354786 : trained ? -0.012 : 0.03,
                    temporalSplitPassed: trained,
                    contractMatched: trained,
                    businessKpiRecovered: trained,
                });
            }
            case "mlops.model.register": {
                const governance = this.requireFixtureGovernance(request, currentResourceVersion);
                if ("success" in governance)
                    return governance;
                return success({
                    actionId: `action-${request.requestId}`,
                    status: governance.dryRun ? "DRY_RUN" : "SUCCEEDED",
                    deploymentUid: argumentsValue.deploymentUid,
                    targetRevision: argumentsValue.targetRevision,
                    modelCardUid: argumentsValue.modelCardUid,
                    registryStatus: governance.dryRun ? "VALID" : "REGISTERED",
                });
            }
            case "mlops.feature.fallback.apply": {
                const governance = this.requireFixtureGovernance(request, currentResourceVersion);
                if ("success" in governance)
                    return governance;
                return success({
                    actionId: `action-${request.requestId}`,
                    status: governance.dryRun ? "DRY_RUN" : "SUCCEEDED",
                    deploymentUid: argumentsValue.deploymentUid,
                    featureSetUid: argumentsValue.featureSetUid,
                    fallbackActive: !governance.dryRun,
                    approvalPassRate: governance.dryRun ? 0.15 : 0.25,
                });
            }
            case "mlops.feature.fallback.remove": {
                const governance = this.requireFixtureGovernance(request, currentResourceVersion);
                if ("success" in governance)
                    return governance;
                return success({
                    actionId: `action-${request.requestId}`,
                    status: governance.dryRun ? "DRY_RUN" : "SUCCEEDED",
                    deploymentUid: argumentsValue.deploymentUid,
                    featureSetUid: argumentsValue.featureSetUid,
                    targetRevision: argumentsValue.targetRevision,
                    fallbackActive: false,
                });
            }
            case "mlops.deployment.canary.apply": {
                const governance = this.requireFixtureGovernance(request, currentResourceVersion);
                if ("success" in governance)
                    return governance;
                return success({
                    actionId: `action-${request.requestId}`,
                    status: governance.dryRun ? "DRY_RUN" : "SUCCEEDED",
                    deploymentUid: argumentsValue.deploymentUid,
                    targetRevision: argumentsValue.targetRevision,
                    trafficPercent: argumentsValue.trafficPercent,
                    environment: argumentsValue.environment,
                    observationMinutes: argumentsValue.observationMinutes,
                    healthGate: "PASSED",
                });
            }
            case "mlops.deployment.promote": {
                const governance = this.requireFixtureGovernance(request, currentResourceVersion);
                if ("success" in governance)
                    return governance;
                return success({
                    actionId: `action-${request.requestId}`,
                    status: governance.dryRun ? "DRY_RUN" : "SUCCEEDED",
                    deploymentUid: argumentsValue.deploymentUid,
                    targetRevision: argumentsValue.targetRevision,
                    trafficPercent: argumentsValue.trafficPercent,
                    environment: argumentsValue.environment,
                    previousRevisionHotStandby: true,
                });
            }
            case "mlops.release.validation.get":
                return success({
                    deploymentUid: argumentsValue.deploymentUid,
                    targetRevision: argumentsValue.targetRevision,
                    passed: recovered,
                    status: recovered ? "PASSED" : "FAILED",
                    trainingCompleted: completedTools.has("mlops.training.search.start"),
                    evaluationPassed: true,
                    modelRegistered: completedTools.has("mlops.model.register"),
                    canaryPassed: completedTools.has("mlops.deployment.canary.apply"),
                    trafficPercent: completedTools.has("mlops.deployment.promote") ? 100 : 0,
                    rollbackReady: true,
                });
            case "mlops.deployment.rollback": {
                const governance = request.governance;
                if (governance === null) {
                    return this.failure(request, "APPROVAL_REQUIRED", "该高风险操作缺少持久化审批。", false);
                }
                if (governance.expectedResourceVersion !== String(currentResourceVersion)) {
                    return this.failure(request, "RESOURCE_VERSION_CONFLICT", "部署资源版本已变化。", false);
                }
                return success({
                    actionId: `action-${request.requestId}`,
                    status: governance.dryRun ? "DRY_RUN" : "PENDING",
                    fromRevision: currentRevision,
                    targetRevision: argumentsValue.targetRevision,
                    actionResourceUri: `openxnet://workspaces/${request.workspaceId}/actions/action-${request.requestId}`,
                });
            }
        }
    }
    /** 校验 Fixture 写步骤治理字段；输入请求和当前版本，返回治理对象或结构化失败响应。 */
    requireFixtureGovernance(request, currentResourceVersion) {
        const governance = request.governance;
        if (governance === null) {
            return this.failure(request, "APPROVAL_REQUIRED", "该高风险操作缺少持久化审批。", false);
        }
        const expectedNumeric = Number.parseInt(governance.expectedResourceVersion, 10);
        const versionMatches = governance.dryRun
            ? Number.isSafeInteger(expectedNumeric) && expectedNumeric >= currentResourceVersion
            : governance.expectedResourceVersion === String(currentResourceVersion);
        if (!versionMatches) {
            return this.failure(request, "RESOURCE_VERSION_CONFLICT", "目标资源版本已变化。", false);
        }
        return governance;
    }
    /** 构建固定失败响应；输入请求、错误码、文案和重试标记，返回脱敏错误。 */
    failure(request, code, message, retryable) {
        const descriptor = (0, competition_tool_registry_1.getCompetitionToolDescriptor)(request.toolName);
        return {
            success: false,
            data: null,
            error: { code, message, retryable, details: {} },
            meta: {
                requestId: request.requestId,
                workspaceId: request.workspaceId,
                incidentId: request.incidentId,
                traceId: request.traceId,
                toolName: request.toolName,
                contractVersion: "1.0.0",
                durationMs: 0,
                source: "OpenXnetDesktop/fixture",
                platform: descriptor.platform,
                resourceVersion: "",
                observedAt: this.now().toISOString(),
                summary: message,
            },
        };
    }
    /** 返回工具结果的人类可读摘要；输入工具名和修订，返回不含敏感信息的中文文本。 */
    summaryFor(toolName, revision, argumentsValue, remediated) {
        const recovered = remediated;
        const forcedVerificationFailure = recovered
            && argumentsValue.testDatasetRef === "fixture://goai/verification-failure-v1";
        const summaries = {
            "aiops.alert.get": recovered ? "告警已恢复。" : "错误率告警仍在触发。",
            "aiops.service.health": recovered ? "服务健康度恢复正常。" : "服务错误率和延迟异常。",
            "aiops.k8s.workload.get": recovered ? "工作负载副本已全部就绪。" : "工作负载存在未就绪副本和重启。",
            "aiops.inference.metrics.get": recovered ? "推理队列、GPU 水位和 P99 已恢复。" : "GPU 饱和且推理队列严重积压。",
            "aiops.inference.recovery.status": recovered ? "推理恢复计划已经收敛到稳定状态。" : "推理恢复计划尚未完成。",
            "aiops.gpu.capacity.ensure": "GPU 节点池容量步骤已完成。",
            "aiops.inference.runtime.tune": "推理运行时配置步骤已完成。",
            "aiops.inference.capacity.apply": "推理容量处置动作已受理。",
            "aiops.inference.traffic.shift": "推理流量已按审批阶梯完成切换。",
            "aiops.inference.autoscaling.policy.update": "队列感知弹性策略已更新。",
            "aiops.inference.capacity.converge": "推理临时容量已收敛。",
            "dataops.quality.report.get": "质量报告发现特征维度与空值规则失败。",
            "dataops.schema.snapshot.get": "Schema 快照确认特征维度从 128 变为 120。",
            "dataops.lineage.get": "血缘已关联特征工作流与模型部署。",
            "dataops.workflow.instance.get": "工作流成功但发布了破坏性 Schema 变更。",
            "dataops.training.dataset.build": "版本化训练数据集已经构建。",
            "dataops.feature.backfill.start": "修正版历史特征数据已经完成回填。",
            "dataops.dataset.validation.get": "训练数据集质量与契约验证已返回。",
            "mlops.deployment.get": `当前部署修订为 ${revision}。`,
            "mlops.attribution.report.get": recovered ? "候选模型归因与风险指标达到门槛。" : "低波动与量能基线弱于多周期动量候选。",
            "mlops.inference.probe": recovered && !forcedVerificationFailure
                ? "推理探针通过。"
                : "推理探针确认输入契约不匹配。",
            "mlops.model.iteration.start": "模型受控迭代动作已受理。",
            "mlops.feature.pipeline.publish": "候选特征流水线已经发布。",
            "mlops.training.search.start": "30 组受限训练搜索已经完成。",
            "mlops.model.evaluation.run": "候选模型评估结果已经生成。",
            "mlops.model.register": "候选模型和模型卡已经登记。",
            "mlops.feature.fallback.apply": "备用特征集已经启用。",
            "mlops.feature.fallback.remove": "备用特征集已经退出。",
            "mlops.deployment.canary.apply": "候选模型灰度发布已经完成。",
            "mlops.deployment.promote": "候选模型已经提升到目标流量。",
            "mlops.release.validation.get": recovered ? "模型发布链路验证通过。" : "模型发布链路尚未完成。",
            "mlops.deployment.rollback": "回滚动作已受理。",
        };
        return summaries[toolName];
    }
}
exports.FixtureCompetitionToolAdapter = FixtureCompetitionToolAdapter;
/** 通过三平台公共 HTTP 契约执行真实调用的 Live Adapter。 */
class HttpCompetitionToolAdapter {
    options;
    fetchResource;
    maxResponseBytes;
    /** 创建 Live Adapter；输入端点、短期委托令牌和网络依赖，不提前访问平台。 */
    constructor(options) {
        this.options = options;
        this.fetchResource = options.fetchResource ?? fetch;
        this.maxResponseBytes = options.maxResponseBytes ?? 2 * 1024 * 1024;
    }
    /** 调用一个真实平台工具；输入统一请求，返回经校验的公共响应，不透传外部 MCP Token。 */
    async invoke(request) {
        const descriptor = (0, competition_tool_registry_1.getCompetitionToolDescriptor)(request.toolName);
        const argumentsValue = (0, competition_tool_registry_1.parseCompetitionToolArguments)(descriptor, request.arguments);
        const origin = this.requireEndpoint(await this.options.resolveEndpoint(descriptor.platform));
        const token = (await this.options.resolveDelegationToken?.(descriptor.platform, request))?.trim() ?? "";
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), descriptor.timeoutMs);
        try {
            const response = await this.fetchResource(new URL(descriptor.path, origin), {
                method: "POST",
                redirect: "manual",
                signal: controller.signal,
                headers: {
                    "Content-Type": "application/json; charset=utf-8",
                    "X-OpenXnet-Workspace-Id": request.workspaceId,
                    "X-OpenXnet-Incident-Id": request.incidentId,
                    "X-OpenXnet-Trace-Id": request.traceId,
                    "X-OpenXnet-Tool-Name": request.toolName,
                    "X-OpenXnet-Actor-Id": request.actorId,
                    "Idempotency-Key": request.governance?.idempotencyKey ?? request.requestId,
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    requestId: request.requestId,
                    toolName: request.toolName,
                    arguments: argumentsValue,
                    dryRun: request.governance?.dryRun ?? false,
                    ...(request.governance === null ? {} : {
                        approvalId: request.governance.approvalId,
                        planId: request.governance.planId,
                        planDigest: request.governance.planDigest,
                        stepId: request.governance.stepId,
                        resourceId: request.governance.resourceId,
                        targetRevision: request.governance.targetRevision,
                        expectedResourceVersion: request.governance.expectedResourceVersion,
                        argumentsDigest: request.governance.argumentsDigest,
                        compensation: request.governance.compensation,
                        reason: request.governance.reason,
                        idempotencyKey: request.governance.idempotencyKey,
                    }),
                }),
            });
            if (response.status >= 300 && response.status < 400) {
                throw new Error("Competition platform redirects are not allowed.");
            }
            const bytes = Buffer.from(await response.arrayBuffer());
            if (bytes.length > this.maxResponseBytes)
                throw new Error("Competition platform response is too large.");
            const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
            return this.parseResponse(value, request, descriptor.platform, response.ok);
        }
        finally {
            clearTimeout(timeout);
        }
    }
    /** 轮询所属平台的持久化动作，成功后返回，失败或 90 秒超时时拒绝后续步骤。 */
    async waitForAction(request, actionId) {
        if (!/^act_[A-Za-z0-9_-]{8,120}$/u.test(actionId)) {
            throw new Error("Competition action ID is invalid.");
        }
        const descriptor = (0, competition_tool_registry_1.getCompetitionToolDescriptor)(request.toolName);
        const origin = this.requireEndpoint(await this.options.resolveEndpoint(descriptor.platform));
        const token = (await this.options.resolveDelegationToken?.(descriptor.platform, request))?.trim() ?? "";
        const deadline = Date.now() + 90_000;
        while (Date.now() < deadline) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3_000);
            try {
                const response = await this.fetchResource(new URL(`/api/agent/v1/actions/${actionId}`, origin), {
                    method: "GET",
                    redirect: "manual",
                    signal: controller.signal,
                    headers: {
                        Accept: "application/json",
                        "X-OpenXnet-Workspace-Id": request.workspaceId,
                        "X-OpenXnet-Incident-Id": request.incidentId,
                        "X-OpenXnet-Trace-Id": request.traceId,
                        "X-OpenXnet-Tool-Name": descriptor.name,
                        "Idempotency-Key": `${request.requestId}:action`,
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                });
                if (!response.ok || (response.status >= 300 && response.status < 400)) {
                    throw new Error(`Competition action status returned HTTP ${response.status}.`);
                }
                const bytes = Buffer.from(await response.arrayBuffer());
                if (bytes.length > 128 * 1024)
                    throw new Error("Competition action response is too large.");
                const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
                const state = this.parseActionState(value, actionId);
                if (state.status === "SUCCEEDED")
                    return state;
                if (state.status === "FAILED") {
                    throw new Error(`Competition action failed: ${state.errorCode ?? "UNKNOWN"}.`);
                }
            }
            finally {
                clearTimeout(timeout);
            }
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
        throw new Error("Competition action timed out.");
    }
    /** 校验平台根地址；输入保存 URL，返回无凭据、查询和片段的安全 origin。 */
    requireEndpoint(value) {
        const parsed = new URL(value.trim());
        const hostname = parsed.hostname.toLowerCase();
        const loopback = hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1" || hostname === "[::1]";
        if (parsed.username
            || parsed.password
            || parsed.search
            || parsed.hash
            || (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && loopback))) {
            throw new Error("Competition platform endpoint is not allowed.");
        }
        return parsed;
    }
    /** 校验公共 ToolResponse；输入未知 JSON、请求、平台和 HTTP 状态，返回有界统一响应。 */
    parseResponse(value, request, platform, httpSuccess) {
        if (!isRecord(value) || typeof value.success !== "boolean" || !isRecord(value.meta)) {
            throw new Error("Competition platform response schema is invalid.");
        }
        const data = value.success
            ? (isRecord(value.data) ? cloneRecord(redactRecord(value.data), this.maxResponseBytes) : null)
            : null;
        if ((value.success && data === null) || (!value.success && value.data !== null)) {
            throw new Error("Competition platform response data is inconsistent.");
        }
        if (!(value.auditReceipt === null || isRecord(value.auditReceipt))) {
            throw new Error("Competition platform audit receipt is invalid.");
        }
        if (value.success && request.governance !== null)
            this.validateGovernedReceipt(value, request);
        const error = value.error === null ? null : this.parseError(value.error);
        if ((value.success && error !== null) || (!value.success && error === null)) {
            throw new Error("Competition platform response outcome is inconsistent.");
        }
        if (!httpSuccess && value.success)
            throw new Error("Competition platform HTTP outcome is inconsistent.");
        if (value.meta.requestId !== request.requestId
            || value.meta.workspaceId !== request.workspaceId
            || value.meta.incidentId !== request.incidentId
            || value.meta.traceId !== request.traceId
            || value.meta.toolName !== request.toolName
            || value.meta.contractVersion !== "1.0.0") {
            throw new Error("Competition platform response context is inconsistent.");
        }
        const durationMs = value.meta.durationMs;
        if (typeof durationMs !== "number" || !Number.isSafeInteger(durationMs) || durationMs < 0) {
            throw new Error("Competition platform response duration is invalid.");
        }
        const observedAt = readText(value.meta.observedAt, "", 128);
        if (!observedAt || !Number.isFinite(Date.parse(observedAt))) {
            throw new Error("Competition platform response timestamp is invalid.");
        }
        const source = readText(value.meta.source, "", 128);
        if (!source)
            throw new Error("Competition platform response source is invalid.");
        const evidenceId = readOptionalText(value.meta.evidenceId, 128);
        return {
            success: value.success,
            data,
            error,
            meta: {
                requestId: request.requestId,
                workspaceId: request.workspaceId,
                incidentId: request.incidentId,
                traceId: request.traceId,
                toolName: request.toolName,
                contractVersion: "1.0.0",
                durationMs,
                source,
                ...(evidenceId === undefined ? {} : { evidenceId }),
                platform,
                resourceVersion: readText(value.meta.resourceVersion, "", 128),
                observedAt,
                summary: redactDiagnostic(readText(value.meta.summary, value.success ? "工具调用成功。" : "工具调用失败。", 2_048)),
            },
        };
    }
    /** 校验真实写回执的作用域、参数摘要和前后版本，再允许形成成功证据。 / Validate the actual write receipt's scope, parameter digest and version transition before recording success evidence. */
    validateGovernedReceipt(value, request) {
        const governance = request.governance;
        const receipt = value.auditReceipt;
        if (governance === null || !isRecord(receipt) || !isRecord(value.meta))
            throw new Error("Competition governed receipt is missing.");
        (0, competition_resource_versions_1.assertCompetitionWriteVersion)(governance.expectedResourceVersion, value.meta.resourceVersion);
        if (receipt.requestId !== request.requestId || receipt.workspaceId !== request.workspaceId
            || receipt.incidentId !== request.incidentId || receipt.traceId !== request.traceId
            || receipt.toolName !== request.toolName || receipt.actorId !== request.actorId
            || receipt.approvalId !== governance.approvalId || receipt.requestDigest !== governance.argumentsDigest
            || receipt.beforeResourceVersion !== governance.expectedResourceVersion
            || receipt.afterResourceVersion !== value.meta.resourceVersion
            || typeof receipt.approverId !== "string" || !receipt.approverId || receipt.approverId === request.actorId
            || !["SUCCEEDED", "ACCEPTED", "DRY_RUN"].includes(String(receipt.actionStatus))) {
            throw new Error("Competition governed receipt does not match the approved write.");
        }
    }
    /** 校验平台错误包络；输入未知值，返回脱敏固定结构，无效时抛出 Error。 */
    parseError(value) {
        if (!isRecord(value) || typeof value.code !== "string" || typeof value.message !== "string") {
            throw new Error("Competition platform error schema is invalid.");
        }
        return {
            code: readText(value.code, "UPSTREAM_ERROR", 128),
            message: redactDiagnostic(readText(value.message, "平台工具调用失败。", 2_048)),
            retryable: value.retryable === true,
            details: isRecord(value.details) ? cloneRecord(redactRecord(value.details), 64 * 1024) : {},
        };
    }
    /** 校验异步动作响应；输入未知 JSON 和预期 ID，返回有界状态。 */
    parseActionState(value, actionId) {
        if (!isRecord(value) || value.actionId !== actionId || typeof value.status !== "string" || typeof value.stage !== "string") {
            throw new Error("Competition action response schema is invalid.");
        }
        return {
            actionId,
            status: readText(value.status, "UNKNOWN", 64),
            stage: readText(value.stage, "UNKNOWN", 64),
            errorCode: value.errorCode === null ? null : readText(value.errorCode, "UNKNOWN", 128),
            errorMessage: value.errorMessage === null ? null : redactDiagnostic(readText(value.errorMessage, "", 2_048)),
        };
    }
}
exports.HttpCompetitionToolAdapter = HttpCompetitionToolAdapter;
/** 判断未知值是否为普通对象；输入未知值，返回类型守卫，无副作用。 */
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
/** 读取有界文本并提供默认值；输入未知值、默认值和上限，返回无 NUL 文本。 */
function readText(value, fallback, maximumLength) {
    if (typeof value !== "string" || value.includes("\u0000"))
        return fallback;
    return value.slice(0, maximumLength);
}
/** 读取可选有界文本；输入未知值和上限，返回文本或 undefined，无效时抛出 Error。 */
function readOptionalText(value, maximumLength) {
    if (value === undefined || value === null)
        return undefined;
    if (typeof value !== "string" || !value || value.length > maximumLength || value.includes("\u0000")) {
        throw new Error("Competition platform optional metadata is invalid.");
    }
    return value;
}
/** 深拷贝有界普通 JSON 对象；输入对象和字节上限，返回副本，超限时抛出 Error。 */
function cloneRecord(value, maximumBytes) {
    const serialized = JSON.stringify(value);
    if (Buffer.byteLength(serialized, "utf8") > maximumBytes) {
        throw new Error("Competition platform data exceeds its byte budget.");
    }
    return JSON.parse(serialized);
}
/** 递归清除平台响应中的常见敏感字段；输入普通 JSON 对象，返回不修改原值的副本。 */
function redactRecord(value) {
    const result = {};
    for (const [key, child] of Object.entries(value)) {
        if (/(?:authorization|credential|password|secret|token|api[_-]?key)/iu.test(key)) {
            result[key] = "[redacted]";
        }
        else if (Array.isArray(child)) {
            result[key] = child.map((item) => isRecord(item) ? redactRecord(item) : redactScalar(item));
        }
        else if (isRecord(child)) {
            result[key] = redactRecord(child);
        }
        else {
            result[key] = redactScalar(child);
        }
    }
    return result;
}
/** 脱敏一个标量；输入未知值，返回清除 Bearer 和键值凭据后的值。 */
function redactScalar(value) {
    return typeof value === "string" ? redactDiagnostic(value) : value;
}
/** 脱敏诊断文本；输入文本，返回不含 Bearer、Token、密码或 API Key 值的文本。 */
function redactDiagnostic(value) {
    return value
        .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/giu, "Bearer [redacted]")
        .replace(/((?:api[_-]?key|password|secret|token)\s*[:=]\s*)[^\s,;]+/giu, "$1[redacted]");
}
//# sourceMappingURL=competition-tool-adapter.js.map