/** AgentTeams Runtime 的授权 IPC 通道。 */
export const APPLICATION_AGENTTEAMS_RUNTIME_CHANNELS = Object.freeze({
  status: "openxnet:application-agentteams-runtime:status",
  applyTeam: "openxnet:application-agentteams-runtime:apply-team",
  getTeam: "openxnet:application-agentteams-runtime:get-team",
});

/** AgentTeams 公开状态协议。 */
export const APPLICATION_AGENTTEAMS_STATUS_SCHEMA = "openxnet.agentteams.status.v1" as const;

/** AgentTeams 公开 Team 协议。 */
export const APPLICATION_AGENTTEAMS_TEAM_SCHEMA = "openxnet.agentteams.team.v1" as const;

/** AgentTeams 支持的成员运行时。 */
export const APPLICATION_AGENTTEAMS_MEMBER_RUNTIMES = ["openclaw", "copaw", "hermes"] as const;

/** AgentTeams Team 内的成员职责。 */
export const APPLICATION_AGENTTEAMS_MEMBER_ROLES = ["team_leader", "worker"] as const;

/** AgentTeams 适配状态。 */
export type ApplicationAgentTeamsRuntimeState = "unavailable" | "unreachable" | "ready" | "error";

/** AgentTeams 成员运行时。 */
export type ApplicationAgentTeamsMemberRuntime =
  (typeof APPLICATION_AGENTTEAMS_MEMBER_RUNTIMES)[number];

/** AgentTeams 成员职责。 */
export type ApplicationAgentTeamsMemberRole =
  (typeof APPLICATION_AGENTTEAMS_MEMBER_ROLES)[number];

/** OpenXnet 允许投影到 AgentTeams 的成员字段。 */
export interface ApplicationAgentTeamsMember {
  readonly name: string;
  readonly role: ApplicationAgentTeamsMemberRole;
  readonly model: string;
  readonly runtime: ApplicationAgentTeamsMemberRuntime;
  readonly identity: string;
  readonly instructions: string;
  readonly skills: readonly string[];
}

/** OpenXnet 允许同步到 AgentTeams 的 Team 字段。 */
export interface ApplicationAgentTeamsTeamDefinition {
  readonly name: string;
  readonly description: string;
  readonly heartbeatEvery: string;
  readonly members: readonly ApplicationAgentTeamsMember[];
}

/** 同步一个 Team 的结构化请求。 */
export interface ApplyApplicationAgentTeamsTeamRequest {
  readonly workspaceId: string;
  readonly team: ApplicationAgentTeamsTeamDefinition;
}

/** 查询一个 Team 的结构化请求。 */
export interface GetApplicationAgentTeamsTeamRequest {
  readonly teamName: string;
}

/** Renderer 可见的 AgentTeams Controller 状态。 */
export interface ApplicationAgentTeamsStatus {
  readonly schema: typeof APPLICATION_AGENTTEAMS_STATUS_SCHEMA;
  readonly state: ApplicationAgentTeamsRuntimeState;
  readonly cliAvailable: boolean;
  readonly controllerReachable: boolean;
  readonly controllerVersion: string;
  readonly kubeMode: string;
  readonly totalWorkers: number;
  readonly totalTeams: number;
  readonly totalHumans: number;
  readonly errorCode: string | null;
  readonly retryable: boolean;
}

/** Renderer 可见的 AgentTeams Team 状态。 */
export interface ApplicationAgentTeamsTeamResult {
  readonly schema: typeof APPLICATION_AGENTTEAMS_TEAM_SCHEMA;
  readonly operation: "apply" | "get";
  readonly success: boolean;
  readonly workspaceId: string;
  readonly teamName: string;
  readonly phase: string;
  readonly leaderName: string;
  readonly readyWorkers: number;
  readonly totalWorkers: number;
  readonly teamRoomId: string;
  readonly leaderDmRoomId: string;
  readonly workerNames: readonly string[];
  readonly message: string;
  readonly errorCode: string | null;
  readonly retryable: boolean;
}

const RESOURCE_NAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;
const MODEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/u;
const SKILL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,127}$/u;

/** 判断未知值是否为普通对象；输入未知值，返回布尔值，无副作用。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 校验精确字段集合；输入对象和字段，无返回，不一致时抛出 TypeError。 */
function requireFields(value: Record<string, unknown>, fields: readonly string[]): void {
  const actual = Object.keys(value).sort();
  const expected = [...fields].sort();
  if (actual.length !== expected.length || actual.some((field, index) => field !== expected[index])) {
    throw new TypeError("AgentTeams request fields are invalid.");
  }
}

/** 读取有界非空文本；输入值、字段和上限，返回文本，无效时抛出 TypeError。 */
function requireText(value: unknown, field: string, maximumLength: number): string {
  if (typeof value !== "string") {
    throw new TypeError(`AgentTeams field '${field}' is invalid.`);
  }
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maximumLength) {
    throw new TypeError(`AgentTeams field '${field}' is invalid.`);
  }
  return normalized;
}

/** 读取 AgentTeams 资源名；输入值和字段，返回规范名称，无效时抛出 TypeError。 */
function requireResourceName(value: unknown, field: string): string {
  const normalized = requireText(value, field, 63);
  if (!RESOURCE_NAME_PATTERN.test(normalized)) {
    throw new TypeError(`AgentTeams field '${field}' is invalid.`);
  }
  return normalized;
}

/** 解析一个 AgentTeams 成员；输入未知值和索引，返回安全副本，无效时抛出 TypeError。 */
function parseMember(value: unknown, index: number): ApplicationAgentTeamsMember {
  if (!isRecord(value)) {
    throw new TypeError("AgentTeams member is invalid.");
  }
  requireFields(value, ["name", "role", "model", "runtime", "identity", "instructions", "skills"]);
  const role = requireText(value.role, `members[${index}].role`, 32);
  const runtime = requireText(value.runtime, `members[${index}].runtime`, 32);
  const model = requireText(value.model, `members[${index}].model`, 128);
  if (!APPLICATION_AGENTTEAMS_MEMBER_ROLES.some((candidate) => candidate === role)) {
    throw new TypeError("AgentTeams member role is invalid.");
  }
  if (!APPLICATION_AGENTTEAMS_MEMBER_RUNTIMES.some((candidate) => candidate === runtime)) {
    throw new TypeError("AgentTeams member runtime is invalid.");
  }
  if (!MODEL_ID_PATTERN.test(model)) {
    throw new TypeError("AgentTeams member model is invalid.");
  }
  if (!Array.isArray(value.skills) || value.skills.length > 32) {
    throw new TypeError("AgentTeams member skills are invalid.");
  }
  const skills = value.skills.map((skill) => {
    const normalized = requireText(skill, `members[${index}].skills`, 128);
    if (!SKILL_ID_PATTERN.test(normalized)) {
      throw new TypeError("AgentTeams member skill is invalid.");
    }
    return normalized;
  });
  if (new Set(skills).size !== skills.length) {
    throw new TypeError("AgentTeams member skills must be unique.");
  }
  return {
    name: requireResourceName(value.name, `members[${index}].name`),
    role: role as ApplicationAgentTeamsMemberRole,
    model,
    runtime: runtime as ApplicationAgentTeamsMemberRuntime,
    identity: requireText(value.identity, `members[${index}].identity`, 16 * 1024),
    instructions: requireText(value.instructions, `members[${index}].instructions`, 32 * 1024),
    skills,
  };
}

/** 解析 Team 同步请求；输入未知值，返回结构化副本，字段或预算无效时抛出 TypeError。 */
export function parseApplyApplicationAgentTeamsTeamRequest(
  value: unknown,
): ApplyApplicationAgentTeamsTeamRequest {
  if (!isRecord(value)) {
    throw new TypeError("AgentTeams apply request is invalid.");
  }
  requireFields(value, ["workspaceId", "team"]);
  if (!isRecord(value.team)) {
    throw new TypeError("AgentTeams team is invalid.");
  }
  requireFields(value.team, ["name", "description", "heartbeatEvery", "members"]);
  if (!Array.isArray(value.team.members) || value.team.members.length < 3 || value.team.members.length > 16) {
    throw new TypeError("AgentTeams team must contain between 3 and 16 members.");
  }
  const members = value.team.members.map(parseMember);
  if (new Set(members.map((member) => member.name)).size !== members.length) {
    throw new TypeError("AgentTeams member names must be unique.");
  }
  const leaders = members.filter((member) => member.role === "team_leader");
  if (leaders.length !== 1 || leaders[0]?.runtime === "hermes") {
    throw new TypeError("AgentTeams team leader layout is invalid.");
  }
  const heartbeatEvery = requireText(value.team.heartbeatEvery, "team.heartbeatEvery", 16);
  if (!/^[1-9][0-9]{0,3}[mh]$/u.test(heartbeatEvery)) {
    throw new TypeError("AgentTeams heartbeat interval is invalid.");
  }
  const request: ApplyApplicationAgentTeamsTeamRequest = {
    workspaceId: requireText(value.workspaceId, "workspaceId", 128),
    team: {
      name: requireResourceName(value.team.name, "team.name"),
      description: requireText(value.team.description, "team.description", 2048),
      heartbeatEvery,
      members,
    },
  };
  if (Buffer.byteLength(JSON.stringify(request), "utf8") > 256 * 1024) {
    throw new TypeError("AgentTeams apply request exceeds its byte budget.");
  }
  return request;
}

/** 解析 Team 查询请求；输入未知值，返回名称副本，额外或非法字段时抛出 TypeError。 */
export function parseGetApplicationAgentTeamsTeamRequest(
  value: unknown,
): GetApplicationAgentTeamsTeamRequest {
  if (!isRecord(value)) {
    throw new TypeError("AgentTeams get request is invalid.");
  }
  requireFields(value, ["teamName"]);
  return { teamName: requireResourceName(value.teamName, "teamName") };
}
