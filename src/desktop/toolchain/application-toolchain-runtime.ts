import { spawn } from "node:child_process";

import {
  APPLICATION_DOCKER_CONTAINERS_SCHEMA,
  APPLICATION_DOCKER_MUTATION_SCHEMA,
  APPLICATION_TOOLCHAIN_PROBE_SCHEMA,
  parseApplicationDockerContainerMutationRequest,
  parseApplicationDockerImagePullRequest,
  parseApplicationToolchainProbeRequest,
  type ApplicationDockerContainer,
  type ApplicationDockerContainerListResult,
  type ApplicationDockerMutationResult,
  type ApplicationToolchainProbeResult,
  type ApplicationToolchainTool,
} from "../contracts/application-toolchain-runtime";

const MAX_COMMAND_OUTPUT_BYTES = 2 * 1024 * 1024;
const MAX_DOCKER_CONTAINERS = 100;
type MutableApplicationDockerContainer = {
  -readonly [Key in keyof ApplicationDockerContainer]: ApplicationDockerContainer[Key];
};

/** 一个受限本机命令的完成结果。 */
export interface ToolchainCommandResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

/** 可替换的受限本机命令执行器。 */
export type ToolchainCommandRunner = (
  command: string,
  arguments_: readonly string[],
  timeoutMs: number,
  environment: Readonly<NodeJS.ProcessEnv>,
) => Promise<ToolchainCommandResult>;

/** Toolchain Runtime 固定诊断接口。 */
export interface ApplicationToolchainRuntimeLogger {
  warn(message: string): void;
}

/** Toolchain Runtime 服务依赖。 */
export interface ApplicationToolchainRuntimeServiceOptions {
  readonly runCommand?: ToolchainCommandRunner;
  readonly environment?: Readonly<NodeJS.ProcessEnv>;
  readonly logger?: ApplicationToolchainRuntimeLogger;
}

/** 标识本机命令缺失或执行失败的内部错误。 */
export class ToolchainCommandError extends Error {
  /** 创建内部命令错误；输入缺失标志，返回 Error 实例，不记录原始 stderr。 */
  public constructor(public readonly missing: boolean) {
    super("Toolchain command failed.");
    this.name = "ToolchainCommandError";
  }
}

/** Main 持有的 Node、uv 和 Docker 本机工具边界。 */
export class ApplicationToolchainRuntimeService {
  private readonly runCommand: ToolchainCommandRunner;
  private readonly environment: Readonly<NodeJS.ProcessEnv>;
  private readonly logger: ApplicationToolchainRuntimeLogger;

  /** 创建 Runtime；输入命令执行器、环境和日志，无返回，不启动任何子进程。 */
  public constructor(options: ApplicationToolchainRuntimeServiceOptions = {}) {
    this.runCommand = options.runCommand ?? runBoundedToolchainCommand;
    this.environment = createToolchainChildEnvironment(options.environment ?? process.env);
    this.logger = options.logger ?? console;
  }

  /** 探测一个 allow-list 工具；输入精确工具名，返回 installed/version，失败不暴露路径或 stderr。 */
  public async probe(value: unknown): Promise<ApplicationToolchainProbeResult> {
    const { tool } = parseApplicationToolchainProbeRequest(value);
    const arguments_ = ["--version"];
    try {
      const result = await this.runCommand(tool, arguments_, 5_000, this.environment);
      return {
        schema: APPLICATION_TOOLCHAIN_PROBE_SCHEMA,
        tool,
        installed: result.exitCode === 0,
        version: firstBoundedLine(result.stdout || result.stderr, 128),
      };
    } catch {
      return { schema: APPLICATION_TOOLCHAIN_PROBE_SCHEMA, tool, installed: false, version: "" };
    }
  }

  /** 列出 Docker 容器与只读统计；无输入，返回有界摘要，Docker 缺失时返回空列表。 */
  public async listDockerContainers(): Promise<ApplicationDockerContainerListResult> {
    let result: ToolchainCommandResult;
    try {
      result = await this.runCommand(
        "docker",
        ["ps", "-a", "--format", "{{json .}}"],
        8_000,
        this.environment,
      );
    } catch (error) {
      if (error instanceof ToolchainCommandError && error.missing) {
        return { schema: APPLICATION_DOCKER_CONTAINERS_SCHEMA, installed: false, containers: [] };
      }
      this.logger.warn("Toolchain Runtime Docker container listing failed.");
      throw new Error("Docker runtime is unavailable.");
    }
    const containers = parseDockerContainers(result.stdout);
    await this.hydrateDockerStats(containers);
    return { schema: APPLICATION_DOCKER_CONTAINERS_SCHEMA, installed: true, containers };
  }

  /** 拉取一个精确镜像引用；输入镜像请求，返回固定结果，命令失败时抛出脱敏错误。 */
  public async pullDockerImage(value: unknown): Promise<ApplicationDockerMutationResult> {
    const { image } = parseApplicationDockerImagePullRequest(value);
    await this.executeDockerMutation(["pull", image], 180_000, "pull");
    return { schema: APPLICATION_DOCKER_MUTATION_SCHEMA, success: true, operation: "pull", target: image };
  }

  /** 执行 start/stop/restart；输入精确容器请求，返回固定结果，失败时抛出脱敏错误。 */
  public async mutateDockerContainer(value: unknown): Promise<ApplicationDockerMutationResult> {
    const request = parseApplicationDockerContainerMutationRequest(value);
    const timeoutMs = request.action === "stop" ? 45_000 : request.action === "restart" ? 60_000 : 30_000;
    await this.executeDockerMutation([request.action, request.container], timeoutMs, request.action);
    return {
      schema: APPLICATION_DOCKER_MUTATION_SCHEMA,
      success: true,
      operation: request.action,
      target: request.container,
    };
  }

  /** 读取运行中容器统计；输入可变容器摘要，无返回，只更新 cpu/memory，失败时保留占位值。 */
  private async hydrateDockerStats(containers: MutableApplicationDockerContainer[]): Promise<void> {
    const identifiers = containers
      .filter((container) => container.statusKind === "active")
      .map((container) => container.id || container.name)
      .filter(isSafeDockerContainerIdentifier);
    if (!identifiers.length) return;
    try {
      const result = await this.runCommand(
        "docker",
        ["stats", "--no-stream", "--format", "{{json .}}", ...identifiers],
        8_000,
        this.environment,
      );
      const stats = parseDockerStats(result.stdout);
      for (const container of containers) {
        const stat = stats.get(container.id) ?? stats.get(container.name);
        if (stat !== undefined) {
          container.cpu = stat.cpu;
          container.memory = stat.memory;
        }
      }
    } catch {
      this.logger.warn("Toolchain Runtime Docker stats were unavailable.");
    }
  }

  /** 执行 Docker 写操作；输入固定参数、超时和操作名，无返回，失败时抛出固定公开错误。 */
  private async executeDockerMutation(
    arguments_: readonly string[],
    timeoutMs: number,
    operation: string,
  ): Promise<void> {
    try {
      await this.runCommand("docker", arguments_, timeoutMs, this.environment);
    } catch {
      this.logger.warn(`Toolchain Runtime Docker '${operation}' failed.`);
      throw new Error("Docker runtime operation failed.");
    }
  }
}

/** 构建无 OpenXnet 凭据的子进程环境；输入环境映射，返回副本，不修改原对象。 */
export function createToolchainChildEnvironment(
  source: Readonly<NodeJS.ProcessEnv>,
): Readonly<NodeJS.ProcessEnv> {
  const environment: NodeJS.ProcessEnv = {};
  for (const [name, value] of Object.entries(source)) {
    const normalizedName = name.toUpperCase();
    if (
      normalizedName.startsWith("OPENXNET_")
      || normalizedName.endsWith("_CREDENTIALS_B64")
      || normalizedName === "NODE_OPTIONS"
      || normalizedName === "NODE_PATH"
      || normalizedName.startsWith("UV_")
      || normalizedName.startsWith("PIP_")
      || normalizedName.startsWith("NPM_")
      || /(?:^|_)(?:API_?KEY|ACCESS_?TOKEN|AUTH_?TOKEN|TOKEN|SECRET|PASSWORD)$/.test(normalizedName)
    ) {
      continue;
    }
    environment[name] = value;
  }
  return environment;
}

/** 执行一个无 shell 的有界命令；输入命令、参数、超时和环境，返回 UTF-8 输出，失败时抛出内部错误。 */
export function runBoundedToolchainCommand(
  command: string,
  arguments_: readonly string[],
  timeoutMs: number,
  environment: Readonly<NodeJS.ProcessEnv>,
): Promise<ToolchainCommandResult> {
  return new Promise<ToolchainCommandResult>((resolve, reject) => {
    const child = spawn(command, [...arguments_], {
      env: { ...environment },
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let totalBytes = 0;
    let settled = false;

    /** 结束 Promise；输入回调，无返回，保证超时、退出和 error 只结算一次。 */
    function settle(callback: () => void): void {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback();
    }

    /** 收集一个输出块；输入目标列表和字节块，无返回，超限时终止进程并拒绝。 */
    function collect(target: Buffer[], chunk: Buffer | string): void {
      if (settled) return;
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, "utf8");
      totalBytes += buffer.length;
      if (totalBytes > MAX_COMMAND_OUTPUT_BYTES) {
        child.kill();
        settle(() => reject(new ToolchainCommandError(false)));
        return;
      }
      target.push(buffer);
    }

    const timeout = setTimeout(() => {
      child.kill();
      settle(() => reject(new ToolchainCommandError(false)));
    }, timeoutMs);
    child.stdout.on("data", (chunk: Buffer | string) => collect(stdout, chunk));
    child.stderr.on("data", (chunk: Buffer | string) => collect(stderr, chunk));
    child.once("error", (error: NodeJS.ErrnoException) => {
      settle(() => reject(new ToolchainCommandError(error.code === "ENOENT")));
    });
    child.once("exit", (code) => {
      settle(() => {
        if (code !== 0) {
          reject(new ToolchainCommandError(false));
          return;
        }
        resolve({
          stdout: Buffer.concat(stdout).toString("utf8"),
          stderr: Buffer.concat(stderr).toString("utf8"),
          exitCode: code ?? 0,
        });
      });
    });
  });
}

/** 解析 Docker ps JSON lines；输入文本，返回最多 100 个有界摘要，非法行被跳过。 */
function parseDockerContainers(output: string): MutableApplicationDockerContainer[] {
  const containers: MutableApplicationDockerContainer[] = [];
  for (const line of output.split(/\r?\n/u)) {
    if (containers.length >= MAX_DOCKER_CONTAINERS) break;
    const value = parseJsonObject(line);
    if (value === null) continue;
    const id = boundedText(value.ID, 128);
    const name = boundedText(value.Names, 128);
    if (!isSafeDockerContainerIdentifier(id) && !isSafeDockerContainerIdentifier(name)) continue;
    const status = boundedText(value.Status ?? value.State, 512) || "--";
    containers.push({
      id,
      name,
      image: boundedText(value.Image, 512),
      status,
      statusKind: classifyDockerStatus(status),
      ports: boundedText(value.Ports, 1_024) || "--",
      cpu: "--",
      memory: "--",
    });
  }
  return containers;
}

/** 解析 Docker stats JSON lines；输入文本，返回按 ID/名称索引的有界统计，非法行被跳过。 */
function parseDockerStats(output: string): Map<string, { cpu: string; memory: string }> {
  const stats = new Map<string, { cpu: string; memory: string }>();
  for (const line of output.split(/\r?\n/u).slice(0, MAX_DOCKER_CONTAINERS)) {
    const value = parseJsonObject(line);
    if (value === null) continue;
    const stat = {
      cpu: boundedText(value.CPUPerc, 128) || "--",
      memory: boundedText(value.MemUsage, 256) || "--",
    };
    for (const key of [value.ID, value.Container, value.Name].map((item) => boundedText(item, 128))) {
      if (isSafeDockerContainerIdentifier(key)) stats.set(key, stat);
    }
  }
  return stats;
}

/** 解析单行 JSON 对象；输入文本，返回记录，空行、数组或语法错误时返回 null。 */
function parseJsonObject(line: string): Record<string, unknown> | null {
  const normalized = line.trim();
  if (!normalized || Buffer.byteLength(normalized, "utf8") > 64 * 1024) return null;
  try {
    const value = JSON.parse(normalized) as unknown;
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

/** 分类 Docker 状态；输入状态文本，返回固定 UI 类型，无副作用。 */
function classifyDockerStatus(status: string): ApplicationDockerContainer["statusKind"] {
  const normalized = status.toLowerCase();
  if (normalized.startsWith("up")) return "active";
  if (normalized.includes("paused") || normalized.includes("restarting")) return "maintenance";
  return "gray";
}

/** 校验 Docker 容器标识；输入文本，返回布尔值，无副作用且不抛出异常。 */
function isSafeDockerContainerIdentifier(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(value) && !value.includes("..");
}

/** 截断一行公开文本；输入未知值和长度，返回移除控制字符后的单行文本。 */
function boundedText(value: unknown, maximumLength: number): string {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/gu, " ").trim().slice(0, maximumLength);
}

/** 提取首个有界输出行；输入文本和长度，返回版本摘要，不暴露后续诊断。 */
function firstBoundedLine(value: string, maximumLength: number): string {
  return boundedText(value.split(/\r?\n/u)[0] ?? "", maximumLength);
}
