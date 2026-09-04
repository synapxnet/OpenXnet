import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  APPLICATION_COMPETITION_ADAPTER_MODES,
  APPLICATION_COMPETITION_RUNTIME_SCHEMA,
  type ApplicationCompetitionSnapshot,
  type ApplicationCompetitionAgentTeamBinding,
  type ApplicationCompetitionApproval,
  type ApplicationCompetitionDeploymentAction,
  type ApplicationCompetitionIncident,
  type ApplicationCompetitionToolInvocation,
} from "../contracts/application-competition-runtime";

const MAX_STORE_BYTES = 32 * 1024 * 1024;
const MAX_RECORDS_PER_COLLECTION = 10_000;

/** 竞赛 Store 的文件和时间依赖。 */
export interface CompetitionStoreOptions {
  readonly userDataDirectory: string;
  readonly now?: () => Date;
}

/** 以 UTF-8 原子 JSON 文档持久化竞赛控制面状态。 */
export class CompetitionStore {
  private readonly storePath: string;
  private readonly now: () => Date;
  private operationQueue: Promise<void> = Promise.resolve();

  /** 创建竞赛 Store；输入用户数据目录，不立即创建或读取文件。 */
  public constructor(options: CompetitionStoreOptions) {
    this.storePath = path.join(options.userDataDirectory, "competition", "control-plane.v1.json");
    this.now = options.now ?? (() => new Date());
  }

  /** 读取当前快照；无输入，返回安全副本，文件缺失时返回空 Fixture 状态。 */
  public async read(): Promise<ApplicationCompetitionSnapshot> {
    try {
      const info = await lstat(this.storePath);
      if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_STORE_BYTES) {
        throw new Error("Competition control-plane store is invalid.");
      }
      const bytes = await readFile(this.storePath);
      const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
      return parseStoredSnapshot(value);
    } catch (error) {
      if (isMissingFileError(error)) return createEmptySnapshot(this.now().toISOString());
      throw error;
    }
  }

  /** 串行更新完整快照；输入纯变换函数，持久化并返回新快照。 */
  public update(
    mutation: (current: ApplicationCompetitionSnapshot) => ApplicationCompetitionSnapshot | Promise<ApplicationCompetitionSnapshot>,
  ): Promise<ApplicationCompetitionSnapshot> {
    let output: ApplicationCompetitionSnapshot | undefined;

    /** 在前序操作后执行单次读改写；无输入和返回，结果通过外层 Promise 传递。 */
    const operation = async (): Promise<void> => {
      const current = await this.read();
      const next = parseStoredSnapshot(await mutation(current));
      await this.write(next);
      output = cloneSnapshot(next);
    };
    const queued = this.operationQueue.then(operation, operation);
    this.operationQueue = queued.then(() => undefined, () => undefined);
    return queued.then(() => {
      if (output === undefined) throw new Error("Competition store mutation did not produce a snapshot.");
      return output;
    });
  }

  /** 原子重置竞赛控制面；无输入，清空事件链路并返回 Fixture 模式空快照。 */
  public reset(): Promise<ApplicationCompetitionSnapshot> {
    return this.update(() => createEmptySnapshot(this.now().toISOString()));
  }

  /** 原子写入 UTF-8 无 BOM JSON；输入已校验快照，无返回，失败时清理临时文件。 */
  private async write(snapshot: ApplicationCompetitionSnapshot): Promise<void> {
    const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;
    if (Buffer.byteLength(serialized, "utf8") > MAX_STORE_BYTES) {
      throw new Error("Competition control-plane store exceeds its byte budget.");
    }
    const directory = path.dirname(this.storePath);
    await mkdir(directory, { recursive: true });
    const temporaryPath = `${this.storePath}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, serialized, { encoding: "utf8", flag: "wx", mode: 0o600 });
      await rename(temporaryPath, this.storePath);
    } catch (error) {
      await rm(temporaryPath, { force: true });
      throw error;
    }
  }
}

/** 创建空竞赛快照；输入当前时间，返回 Fixture 模式默认状态。 */
export function createEmptySnapshot(now: string): ApplicationCompetitionSnapshot {
  return {
    schema: APPLICATION_COMPETITION_RUNTIME_SCHEMA,
    adapterMode: "fixture",
    incidents: [],
    traces: [],
    invocations: [],
    evidence: [],
    approvals: [],
    actions: [],
    auditReceipts: [],
    teamBindings: [],
    agentDecisions: [],
    skillUsages: [],
    taskGraphs: [],
    reasoningDecisions: [],
    skillEvolutionRuns: [],
    updatedAt: now,
  };
}

/** 校验并深拷贝存储快照；输入未知 JSON，返回有界协议对象，无效时抛出 Error。 */
export function parseStoredSnapshot(value: unknown): ApplicationCompetitionSnapshot {
  if (!isRecord(value) || value.schema !== APPLICATION_COMPETITION_RUNTIME_SCHEMA) {
    throw new Error("Competition control-plane store schema is invalid.");
  }
  const adapterMode = value.adapterMode;
  if (!APPLICATION_COMPETITION_ADAPTER_MODES.some((candidate) => candidate === adapterMode)) {
    throw new Error("Competition adapter mode is invalid.");
  }
  const cloned = cloneSnapshot(value as unknown as ApplicationCompetitionSnapshot);
  const snapshot: ApplicationCompetitionSnapshot = {
    ...cloned,
    incidents: Array.isArray(cloned.incidents)
      ? cloned.incidents.map(normalizeIncident)
      : cloned.incidents,
    approvals: Array.isArray(cloned.approvals)
      ? cloned.approvals.map(normalizeApproval)
      : cloned.approvals,
    invocations: Array.isArray(cloned.invocations)
      ? cloned.invocations.map(normalizeInvocation)
      : cloned.invocations,
    teamBindings: Array.isArray(cloned.teamBindings)
      ? cloned.teamBindings.map(normalizeTeamBinding)
      : cloned.teamBindings,
    actions: Array.isArray(cloned.actions)
      ? cloned.actions.map(normalizeAction)
      : cloned.actions,
    agentDecisions: Array.isArray(cloned.agentDecisions) ? cloned.agentDecisions.map(normalizeAgentDecision) : [],
    skillUsages: Array.isArray(cloned.skillUsages) ? cloned.skillUsages : [],
    taskGraphs: Array.isArray(cloned.taskGraphs) ? cloned.taskGraphs.map(normalizeTaskGraph) : [],
    reasoningDecisions: Array.isArray(cloned.reasoningDecisions) ? cloned.reasoningDecisions : [],
    skillEvolutionRuns: Array.isArray(cloned.skillEvolutionRuns) ? cloned.skillEvolutionRuns : [],
  };
  requireCollection(snapshot.incidents, "incidents");
  requireCollection(snapshot.traces, "traces");
  requireCollection(snapshot.invocations, "invocations");
  requireCollection(snapshot.evidence, "evidence");
  requireCollection(snapshot.approvals, "approvals");
  requireCollection(snapshot.actions, "actions");
  requireCollection(snapshot.auditReceipts, "auditReceipts");
  requireCollection(snapshot.teamBindings, "teamBindings");
  requireCollection(snapshot.agentDecisions, "agentDecisions");
  requireCollection(snapshot.skillUsages, "skillUsages");
  requireCollection(snapshot.taskGraphs, "taskGraphs");
  requireCollection(snapshot.reasoningDecisions, "reasoningDecisions");
  requireCollection(snapshot.skillEvolutionRuns, "skillEvolutionRuns");
  if (typeof snapshot.updatedAt !== "string" || snapshot.updatedAt.length > 128) {
    throw new Error("Competition snapshot timestamp is invalid.");
  }
  return snapshot;
}

/** 迁移 Task Graph；输入旧版或新版记录，为旧数据补齐协同事件列表。 */
function normalizeTaskGraph(value: ApplicationCompetitionSnapshot["taskGraphs"][number]): ApplicationCompetitionSnapshot["taskGraphs"][number] {
  const compatible = value as ApplicationCompetitionSnapshot["taskGraphs"][number] & { readonly events?: unknown };
  return {
    ...value,
    events: Array.isArray(compatible.events) ? compatible.events : [],
  };
}

/** 迁移单个 Incident；输入旧版或新版记录，补齐三场景类型并返回独立对象。 */
function normalizeIncident(value: ApplicationCompetitionIncident): ApplicationCompetitionIncident {
  const compatible = value as ApplicationCompetitionIncident & {
    readonly projectId?: unknown;
    readonly scenario: ApplicationCompetitionIncident["scenario"] & { readonly scenarioType?: unknown };
  };
  const scenarioType = compatible.scenario?.scenarioType;
  return {
    ...value,
    projectId: typeof compatible.projectId === "string" ? compatible.projectId : null,
    scenario: {
      ...value.scenario,
      scenarioType: scenarioType === "recommendation-capacity" || scenarioType === "quantitative-iteration"
        ? scenarioType
        : "feature-drift",
    },
  };
}

/** 迁移单个处置动作；输入旧版或新版记录，补齐工具、资源和通用执行阶段。 */
function normalizeAction(value: ApplicationCompetitionDeploymentAction): ApplicationCompetitionDeploymentAction {
  const compatible = value as ApplicationCompetitionDeploymentAction & {
    readonly toolName?: unknown;
    readonly resourceId?: unknown;
    readonly planId?: unknown;
    readonly planTitle?: unknown;
    readonly planDigest?: unknown;
    readonly steps?: unknown;
    readonly compensationSteps?: unknown;
    readonly compensationStatus?: unknown;
  };
  return {
    ...value,
    toolName: typeof compatible.toolName === "string" ? compatible.toolName : "mlops.deployment.rollback",
    resourceId: typeof compatible.resourceId === "string" ? compatible.resourceId : value.deploymentUid,
    planId: typeof compatible.planId === "string" ? compatible.planId : "legacy-single-remediation",
    planTitle: typeof compatible.planTitle === "string" ? compatible.planTitle : "旧版单步骤处置",
    planDigest: typeof compatible.planDigest === "string" ? compatible.planDigest : "",
    steps: Array.isArray(compatible.steps) ? compatible.steps : [],
    compensationSteps: Array.isArray(compatible.compensationSteps) ? compatible.compensationSteps : [],
    compensationStatus: ["NOT_REQUIRED", "PENDING", "RUNNING", "SUCCEEDED", "FAILED"].includes(
      String(compatible.compensationStatus),
    )
      ? compatible.compensationStatus as ApplicationCompetitionDeploymentAction["compensationStatus"]
      : "NOT_REQUIRED",
  };
}

/** 迁移单个审批；输入旧版或新版记录，补齐计划摘要和精确步骤范围。 */
function normalizeApproval(value: ApplicationCompetitionApproval): ApplicationCompetitionApproval {
  const compatible = value as ApplicationCompetitionApproval & {
    readonly planId?: unknown;
    readonly planDigest?: unknown;
    readonly scopes?: unknown;
  };
  return {
    ...value,
    planId: typeof compatible.planId === "string" ? compatible.planId : "legacy-single-remediation",
    planDigest: typeof compatible.planDigest === "string" ? compatible.planDigest : value.argumentsDigest,
    scopes: Array.isArray(compatible.scopes) ? compatible.scopes : [{
      stepId: "legacy-remediation",
      toolName: value.toolName,
      resourceId: value.resourceId,
      targetRevision: value.targetRevision,
      expectedResourceVersion: value.expectedResourceVersion,
      argumentsDigest: value.argumentsDigest,
      compensation: false,
    }],
  };
}

/** 迁移单个工具调用；输入旧版或新版记录，补齐 Agent 操作者并返回独立对象。 */
function normalizeInvocation(value: ApplicationCompetitionToolInvocation): ApplicationCompetitionToolInvocation {
  const compatible = value as ApplicationCompetitionToolInvocation & { readonly actorId?: unknown };
  return {
    ...value,
    actorId: typeof compatible.actorId === "string" ? compatible.actorId : "legacy-runtime",
  };
}

/** 迁移单个 Team Binding；输入旧版或新版记录，补齐模板与角色快照字段并返回独立对象。 */
function normalizeTeamBinding(value: ApplicationCompetitionAgentTeamBinding): ApplicationCompetitionAgentTeamBinding {
  const compatible = value as ApplicationCompetitionAgentTeamBinding & {
    readonly teamTemplateId?: unknown;
    readonly traceId?: unknown;
    readonly teamTemplateVersion?: unknown;
    readonly teamTemplateName?: unknown;
    readonly memberSnapshots?: unknown;
  };
  return {
    ...value,
    traceId: typeof compatible.traceId === "string" ? compatible.traceId : "",
    teamTemplateId: typeof compatible.teamTemplateId === "string" ? compatible.teamTemplateId : null,
    teamTemplateVersion: Number.isInteger(compatible.teamTemplateVersion) && Number(compatible.teamTemplateVersion) > 0
      ? Number(compatible.teamTemplateVersion)
      : null,
    teamTemplateName: typeof compatible.teamTemplateName === "string" ? compatible.teamTemplateName : "",
    memberSnapshots: Array.isArray(compatible.memberSnapshots) ? compatible.memberSnapshots : [],
  };
}

/** 迁移 AgentTeams 决策；输入旧版或新版记录，为旧数据补齐空事件账本。 */
function normalizeAgentDecision(value: ApplicationCompetitionSnapshot["agentDecisions"][number]): ApplicationCompetitionSnapshot["agentDecisions"][number] {
  const compatible = value as ApplicationCompetitionSnapshot["agentDecisions"][number] & { readonly transportEvents?: unknown };
  return {
    ...value,
    transportEvents: Array.isArray(compatible.transportEvents) ? compatible.transportEvents : [],
  };
}

/** 深拷贝竞赛快照并执行总字节预算；输入快照，返回与调用方隔离的副本。 */
function cloneSnapshot(snapshot: ApplicationCompetitionSnapshot): ApplicationCompetitionSnapshot {
  const serialized = JSON.stringify(snapshot);
  if (Buffer.byteLength(serialized, "utf8") > MAX_STORE_BYTES) {
    throw new Error("Competition control-plane snapshot exceeds its byte budget.");
  }
  return JSON.parse(serialized) as ApplicationCompetitionSnapshot;
}

/** 校验记录集合预算和普通对象元素；输入数组与标签，无返回，无效时抛出 Error。 */
function requireCollection(value: unknown, label: string): void {
  if (
    !Array.isArray(value)
    || value.length > MAX_RECORDS_PER_COLLECTION
    || value.some((item) => !isRecord(item))
  ) {
    throw new Error(`Competition collection '${label}' is invalid.`);
  }
}

/** 判断未知值是否为普通对象；输入未知值，返回类型守卫，无副作用。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 判断文件错误是否表示路径缺失；输入未知错误，返回布尔值，无副作用。 */
function isMissingFileError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
