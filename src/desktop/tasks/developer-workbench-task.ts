import type {
  CreateDeveloperWorkbenchTaskExecutionRequest,
  DeveloperWorkbenchWorkflowKind,
} from "../contracts/application-task-execution";
import type { CreateApplicationTaskRequest } from "../contracts/application-tasks";

/** Core-owned semantics for one developer-workbench workflow. */
interface DeveloperWorkbenchTemplate {
  readonly label: string;
  readonly requiresWrite: boolean;
  readonly suggestedAcceptance: readonly string[];
  readonly suggestedConstraints: readonly string[];
  readonly executionNotes: readonly string[];
  readonly outputRequirement: string;
}

/** Fixed task semantics shared by every developer-workbench creation request. */
const DEVELOPER_WORKBENCH_TEMPLATES: Readonly<
  Record<DeveloperWorkbenchWorkflowKind, DeveloperWorkbenchTemplate>
> = Object.freeze({
  plan: {
    label: "Plan",
    requiresWrite: false,
    suggestedAcceptance: [
      "列出相关文件、接口和 UI 入口",
      "给出分步实施方案和影响范围",
      "说明风险、依赖和验证路径",
    ],
    suggestedConstraints: [
      "先阅读现有实现，避免重复开发",
      "以审视和规划为主，不要先做大范围改动",
    ],
    executionNotes: [
      "优先梳理当前工作区里的现有实现、菜单入口和数据流。",
      "明确说明哪些能力已经存在，哪些只是部分完成。",
      "输出结果以现状、计划、风险和验证建议为主。",
    ],
    outputRequirement: "输出一份结构化实施计划，明确文件范围、步骤、风险和验证点。",
  },
  review: {
    label: "Review",
    requiresWrite: false,
    suggestedAcceptance: [
      "按严重程度列出主要发现",
      "指出潜在回归、数据一致性或权限风险",
      "说明缺失测试或验证空白",
    ],
    suggestedConstraints: [
      "以 findings-first 方式输出，不要先写长总结",
      "除非任务特别要求，否则不要直接改动源码",
    ],
    executionNotes: [
      "从功能行为、边界条件、权限控制和状态一致性几个角度审查。",
      "优先输出高风险问题，再列出中低风险项和测试缺口。",
      "说明问题对应的文件、接口或页面入口，便于后续修复。",
    ],
    outputRequirement: "输出审查发现清单，按严重程度排序，并附上风险说明与建议验证项。",
  },
  diff: {
    label: "Diff",
    requiresWrite: false,
    suggestedAcceptance: [
      "说明主要差异点和影响范围",
      "指出功能缺口、菜单缺口或实现不一致处",
      "给出建议下一步行动",
    ],
    suggestedConstraints: [
      "优先结合工作区现状、任务轨迹和检查点来分析",
      "输出应突出差异而不是重复罗列无关内容",
    ],
    executionNotes: [
      "尽量基于目标文件、相关模块、任务轨迹或检查点来定位差异。",
      "如果工作区不是 Git 仓库，也要结合现有文件与 Recall 线索进行比较。",
      "最终结果要指出哪些差异需要修复，哪些属于预期变化。",
    ],
    outputRequirement: "输出差异分析报告，包含差异点、影响范围、缺口和建议下一步。",
  },
  patch: {
    label: "Patch",
    requiresWrite: true,
    suggestedAcceptance: [
      "完成最小必要代码修改",
      "说明改动文件与验证结果",
      "指出剩余风险和后续建议",
    ],
    suggestedConstraints: [
      "优先沿用现有模式，不要重造平行实现",
      "修改后要进行必要验证并记录结果",
    ],
    executionNotes: [
      "先确认现有实现和目标缺口，再进行最小必要修改。",
      "优先复用已有接口、组件和任务能力，避免重复造轮子。",
      "完成后要说明改动内容、验证情况和剩余风险。",
    ],
    outputRequirement: "输出补丁结果说明，包含改动点、验证结论、残余风险与后续建议。",
  },
});

/** Build one durable Core task from a validated developer-workbench request. */
export function buildDeveloperWorkbenchTask(
  request: CreateDeveloperWorkbenchTaskExecutionRequest,
): CreateApplicationTaskRequest {
  const template = DEVELOPER_WORKBENCH_TEMPLATES[request.workflowKind];
  const acceptanceCriteria = request.acceptanceCriteria.length > 0
    ? request.acceptanceCriteria
    : template.suggestedAcceptance;
  const constraints = request.constraints.length > 0
    ? request.constraints
    : template.suggestedConstraints;
  const title = request.title ?? buildDeveloperWorkbenchTitle(
    template.label,
    request.goal,
    request.targetPaths,
  );
  return {
    workspacePath: request.workspacePath,
    title,
    description: buildDeveloperWorkbenchDescription(
      request,
      template,
      acceptanceCriteria,
      constraints,
    ),
    agentType: request.agentType,
    priority: "normal",
    scheduleType: "manual",
    scheduleExpression: "",
    nextRunAt: "",
    source: "developer-workbench",
    inputArtifactIds: [],
    details: {
      context: {
        created_from: "developer_workbench",
        workflow_kind: request.workflowKind,
        target_paths: request.targetPaths,
        acceptance_criteria: acceptanceCriteria,
        constraints,
        additional_context: request.additionalContext ?? "",
        workspace_dir: request.workspacePath,
        engine_name: request.engineName,
        permission_mode: request.permissionMode,
        requires_write: template.requiresWrite,
      },
      delivery_targets: ["task_center"],
      start_immediately: true,
    },
  };
}

/** Derive the historical developer-workbench title without relying on Python. */
function buildDeveloperWorkbenchTitle(
  label: string,
  goal: string,
  targetPaths: readonly string[],
): string {
  const compactGoal = goal.replace(/\s+/g, " ").trim();
  const goalPreview = compactGoal.length > 48
    ? `${compactGoal.slice(0, 47)}...`
    : compactGoal;
  const targetName = targetPaths.length > 0 ? basenameFromAnyPath(targetPaths[0] ?? "") : "";
  const targetSuffix = targetName ? ` @ ${targetName}` : "";
  return `${label}: ${goalPreview || "Workspace task"}${targetSuffix}`.slice(0, 96);
}

/** Build the standardized execution prompt stored in the durable task. */
function buildDeveloperWorkbenchDescription(
  request: CreateDeveloperWorkbenchTaskExecutionRequest,
  template: DeveloperWorkbenchTemplate,
  acceptanceCriteria: readonly string[],
  constraints: readonly string[],
): string {
  const lines = [
    `你正在 OpenXnet 开发工作台中处理一个【${template.label}】任务。`,
    "",
    "【任务目标】",
    request.goal,
    "",
    "【工作区上下文】",
    `- 工作区：${request.workspacePath}`,
    `- CLI 引擎：${request.engineName}`,
    `- 权限模式：${request.permissionMode}`,
  ];
  if (request.targetPaths.length > 0) {
    lines.push("", "【重点文件 / 目录】", ...request.targetPaths.map((item) => `- ${item}`));
  }
  lines.push(
    "",
    "【本次工作要求】",
    ...template.executionNotes.map((item, index) => `${index + 1}. ${item}`),
    "",
    "【完成标准】",
    ...acceptanceCriteria.map((item) => `- ${item}`),
    "",
    "【注意约束】",
    ...constraints.map((item) => `- ${item}`),
  );
  if (request.additionalContext) {
    lines.push("", "【补充上下文】", request.additionalContext);
  }
  lines.push("", "【输出要求】", template.outputRequirement);
  return lines.join("\n").trim();
}

/** Return the final path component for either slash convention. */
function basenameFromAnyPath(value: string): string {
  return value.replace(/\\/g, "/").split("/").filter(Boolean).at(-1) ?? "";
}
