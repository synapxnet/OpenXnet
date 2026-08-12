/** 本机 Toolchain Runtime IPC channels。 */
export const APPLICATION_TOOLCHAIN_RUNTIME_CHANNELS = Object.freeze({
  probe: "openxnet:application-toolchain-runtime:probe",
  listDockerContainers: "openxnet:application-toolchain-runtime:list-docker-containers",
  pullDockerImage: "openxnet:application-toolchain-runtime:pull-docker-image",
  mutateDockerContainer: "openxnet:application-toolchain-runtime:mutate-docker-container",
});

/** Toolchain 探测结果 schema。 */
export const APPLICATION_TOOLCHAIN_PROBE_SCHEMA = "openxnet.toolchain-probe.v1" as const;

/** Docker 容器列表结果 schema。 */
export const APPLICATION_DOCKER_CONTAINERS_SCHEMA = "openxnet.docker-containers.v1" as const;

/** Docker 写操作结果 schema。 */
export const APPLICATION_DOCKER_MUTATION_SCHEMA = "openxnet.docker-mutation.v1" as const;

/** 允许探测的固定本机工具。 */
export type ApplicationToolchainTool = "node" | "uv" | "docker";

/** 允许执行的固定 Docker 容器动作。 */
export type ApplicationDockerContainerAction = "start" | "stop" | "restart";

/** 精确工具探测请求。 */
export interface ApplicationToolchainProbeRequest {
  readonly tool: ApplicationToolchainTool;
}

/** Renderer 可见的工具探测结果，不包含可执行路径。 */
export interface ApplicationToolchainProbeResult {
  readonly schema: typeof APPLICATION_TOOLCHAIN_PROBE_SCHEMA;
  readonly tool: ApplicationToolchainTool;
  readonly installed: boolean;
  readonly version: string;
}

/** 一个有界 Docker 容器摘要。 */
export interface ApplicationDockerContainer {
  readonly id: string;
  readonly name: string;
  readonly image: string;
  readonly status: string;
  readonly statusKind: "active" | "maintenance" | "gray";
  readonly ports: string;
  readonly cpu: string;
  readonly memory: string;
}

/** Renderer 可见的 Docker 容器列表。 */
export interface ApplicationDockerContainerListResult {
  readonly schema: typeof APPLICATION_DOCKER_CONTAINERS_SCHEMA;
  readonly installed: boolean;
  readonly containers: readonly ApplicationDockerContainer[];
}

/** 精确 Docker 镜像拉取请求。 */
export interface ApplicationDockerImagePullRequest {
  readonly image: string;
}

/** 精确 Docker 容器动作请求。 */
export interface ApplicationDockerContainerMutationRequest {
  readonly container: string;
  readonly action: ApplicationDockerContainerAction;
}

/** Renderer 可见的 Docker 写操作结果，不包含命令输出。 */
export interface ApplicationDockerMutationResult {
  readonly schema: typeof APPLICATION_DOCKER_MUTATION_SCHEMA;
  readonly success: true;
  readonly operation: "pull" | ApplicationDockerContainerAction;
  readonly target: string;
}

const TOOLCHAIN_TOOLS = new Set<ApplicationToolchainTool>(["node", "uv", "docker"]);
const DOCKER_ACTIONS = new Set<ApplicationDockerContainerAction>(["start", "stop", "restart"]);
const DOCKER_IMAGE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/@-]{0,254}$/;
const DOCKER_CONTAINER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/;

/** 解析工具探测请求；输入未知值，返回精确工具，额外字段或未知工具时抛出 TypeError。 */
export function parseApplicationToolchainProbeRequest(value: unknown): ApplicationToolchainProbeRequest {
  const record = requireExactRecord(value, ["tool"], "probe request");
  if (typeof record.tool !== "string" || !TOOLCHAIN_TOOLS.has(record.tool as ApplicationToolchainTool)) {
    throw new TypeError("Toolchain probe tool is invalid.");
  }
  return { tool: record.tool as ApplicationToolchainTool };
}

/** 解析 Docker 镜像请求；输入未知值，返回有界镜像引用，额外字段或不安全字符时抛出 TypeError。 */
export function parseApplicationDockerImagePullRequest(value: unknown): ApplicationDockerImagePullRequest {
  const record = requireExactRecord(value, ["image"], "Docker image request");
  const image = requireBoundedText(record.image, "image", 255);
  if (!DOCKER_IMAGE_PATTERN.test(image) || image.startsWith("-") || image.includes("..")) {
    throw new TypeError("Docker image reference is invalid.");
  }
  return { image };
}

/** 解析 Docker 容器动作；输入未知值，返回精确请求，未知动作或不安全容器名时抛出 TypeError。 */
export function parseApplicationDockerContainerMutationRequest(
  value: unknown,
): ApplicationDockerContainerMutationRequest {
  const record = requireExactRecord(value, ["container", "action"], "Docker container request");
  const container = requireBoundedText(record.container, "container", 128);
  if (!DOCKER_CONTAINER_PATTERN.test(container) || container.startsWith("-") || container.includes("..")) {
    throw new TypeError("Docker container identifier is invalid.");
  }
  if (typeof record.action !== "string" || !DOCKER_ACTIONS.has(record.action as ApplicationDockerContainerAction)) {
    throw new TypeError("Docker container action is invalid.");
  }
  return { container, action: record.action as ApplicationDockerContainerAction };
}

/** 校验有界文本；输入未知值、字段和长度，返回去空白文本，空值或超限时抛出 TypeError。 */
function requireBoundedText(value: unknown, field: string, maximumLength: number): string {
  if (typeof value !== "string") throw new TypeError(`Toolchain field '${field}' is invalid.`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maximumLength || /[\u0000-\u001f\u007f\s]/u.test(normalized)) {
    throw new TypeError(`Toolchain field '${field}' is invalid.`);
  }
  return normalized;
}

/** 校验精确对象；输入未知值、键和标签，返回记录，缺失、额外或错误类型时抛出 TypeError。 */
function requireExactRecord(
  value: unknown,
  keys: readonly string[],
  label: string,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`Toolchain ${label} must be an object.`);
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== keys.length || Object.keys(record).some((key) => !keys.includes(key))) {
    throw new TypeError(`Toolchain ${label} fields are invalid.`);
  }
  return record;
}
