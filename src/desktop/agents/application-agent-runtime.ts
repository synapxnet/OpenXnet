import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  APPLICATION_AGENT_RUNTIME_SCHEMA,
  parseCreateApplicationAgentRequest,
  parseInspectApplicationA2aRequest,
  parseRemoveApplicationAgentRequest,
  type ApplicationA2aInspectionResult,
  type ApplicationA2aSkill,
  type ApplicationAgentMutationResult,
} from "../contracts/application-agent-runtime";
import type { LegacyRendererStateService } from "../storage/legacy-renderer-state";

const MAX_AGENT_SNAPSHOT_BYTES = 16 * 1024 * 1024;
const MAX_A2A_RESPONSE_BYTES = 1024 * 1024;
const A2A_CARD_PATHS = [
  ".well-known/agent.json",
  "agent.json",
  "a2a/agent.json",
] as const;

/** A2A 探测使用的最小 Fetch 响应。 */
export interface ApplicationAgentRuntimeFetchResponse {
  readonly status: number;
  readonly headers: { get(name: string): string | null };
  arrayBuffer(): Promise<ArrayBuffer>;
}

/** A2A 探测使用的可注入 Fetch 实现。 */
export type ApplicationAgentRuntimeFetch = (
  url: string,
  init: {
    readonly method: "GET";
    readonly headers: Readonly<Record<string, string>>;
    readonly redirect: "error";
    readonly signal: AbortSignal;
  },
) => Promise<ApplicationAgentRuntimeFetchResponse>;

/** Agent Runtime 初始化依赖。 */
export interface ApplicationAgentRuntimeOptions {
  readonly userDataDirectory: string;
  readonly state: Pick<LegacyRendererStateService, "getSnapshot" | "saveSettings">;
  readonly fetch?: ApplicationAgentRuntimeFetch;
  readonly createId?: () => string;
}

/** Main-owned Agent 快照与 A2A 卡片发现 Runtime。 */
export class ApplicationAgentRuntimeService {
  private readonly agentsRoot: string;
  private readonly fetchProvider: ApplicationAgentRuntimeFetch;
  private readonly createId: () => string;
  private operation: Promise<void> = Promise.resolve();

  /** 初始化固定 Agent 根目录和可测试依赖；输入选项，无返回，会确保根目录存在。 */
  public constructor(private readonly options: ApplicationAgentRuntimeOptions) {
    this.agentsRoot = path.resolve(options.userDataDirectory, "agents");
    this.fetchProvider = options.fetch ?? (globalThis.fetch as ApplicationAgentRuntimeFetch);
    this.createId = options.createId ?? (() => randomUUID().replace(/-/g, "").slice(0, 8));
    mkdirSync(this.agentsRoot, { recursive: true });
  }

  /**
   * 创建 Agent；输入精确名称和提示词，输出无路径元数据。
   * 本函数原子写入 UTF-8 快照并更新兼容设置；任一步失败会清理新文件并拒绝，不留下可见半成品。
   */
  public createAgent(value: unknown): Promise<ApplicationAgentMutationResult> {
    const request = parseCreateApplicationAgentRequest(value);
    return this.enqueueOperation(async () => {
      const snapshot = this.options.state.getSnapshot();
      const settings = cloneRecord(snapshot.settings, "settings", MAX_AGENT_SNAPSHOT_BYTES);
      const agents = isRecord(settings.agents) ? { ...settings.agents } : {};
      if (Object.keys(agents).length >= 512) {
        throw new Error("Application Agent count exceeds its limit.");
      }
      const agentId = this.nextAgentId(agents);
      const finalPath = this.agentPath(agentId);
      const temporaryPath = `${finalPath}.${randomUUID()}.tmp`;
      const serializedSnapshot = `${JSON.stringify(settings, null, 2)}\n`;
      if (Buffer.byteLength(serializedSnapshot, "utf8") > MAX_AGENT_SNAPSHOT_BYTES) {
        throw new Error("Application Agent snapshot exceeds its byte budget.");
      }
      const internalAgent = {
        id: agentId,
        name: request.name,
        system_prompt: request.systemPrompt,
        source_system_prompt: request.systemPrompt,
        runtime_system_prompt: request.systemPrompt,
        metadata: {},
        config_path: "",
        enabled: false,
      };
      try {
        await writeFile(temporaryPath, serializedSnapshot, { encoding: "utf8", flag: "wx", mode: 0o600 });
        await rename(temporaryPath, finalPath);
        agents[agentId] = internalAgent;
        this.options.state.saveSettings({ settings: { ...settings, agents } });
      } catch (error) {
        await rm(temporaryPath, { force: true });
        await rm(finalPath, { force: true });
        throw error;
      }
      return {
        schema: APPLICATION_AGENT_RUNTIME_SCHEMA,
        action: "created",
        agentId,
        agent: {
          id: agentId,
          name: request.name,
          systemPrompt: request.systemPrompt,
          enabled: false,
        },
      };
    });
  }

  /**
   * 删除 Agent；输入稳定 ID，输出删除结果。
   * 本函数只移动并删除固定根目录下的 `{id}.json`，同时更新兼容设置；设置写入失败会恢复原文件。
   */
  public removeAgent(value: unknown): Promise<ApplicationAgentMutationResult> {
    const request = parseRemoveApplicationAgentRequest(value);
    return this.enqueueOperation(async () => {
      const snapshot = this.options.state.getSnapshot();
      const settings = cloneRecord(snapshot.settings, "settings", MAX_AGENT_SNAPSHOT_BYTES);
      const agents = isRecord(settings.agents) ? { ...settings.agents } : {};
      if (!Object.prototype.hasOwnProperty.call(agents, request.agentId)) {
        throw new Error("Application Agent was not found.");
      }
      const finalPath = this.agentPath(request.agentId);
      const removingPath = `${finalPath}.${randomUUID()}.removing`;
      const hadSnapshot = existsSync(finalPath);
      if (hadSnapshot) await rename(finalPath, removingPath);
      delete agents[request.agentId];
      try {
        this.options.state.saveSettings({ settings: { ...settings, agents } });
        if (hadSnapshot) await rm(removingPath, { force: true });
      } catch (error) {
        if (hadSnapshot && existsSync(removingPath)) await rename(removingPath, finalPath);
        throw error;
      }
      return {
        schema: APPLICATION_AGENT_RUNTIME_SCHEMA,
        action: "removed",
        agentId: request.agentId,
        agent: null,
      };
    });
  }

  /**
   * 探测 A2A Agent Card；输入受策略限制的端点，输出有界公开卡片。
   * 本函数最多发出三个无重定向 GET；超时、全部端点失败、超限或非 JSON 响应时拒绝，不返回上游正文。
   */
  public async inspectA2a(value: unknown): Promise<ApplicationA2aInspectionResult> {
    const request = parseInspectApplicationA2aRequest(value);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      for (const cardPath of A2A_CARD_PATHS) {
        const cardUrl = `${request.url}/${cardPath}`;
        try {
          const response = await this.fetchProvider(cardUrl, {
            method: "GET",
            headers: { Accept: "application/json" },
            redirect: "error",
            signal: controller.signal,
          });
          if (response.status < 200 || response.status >= 300) continue;
          const declaredLength = Number(response.headers.get("content-length") || 0);
          if (declaredLength > MAX_A2A_RESPONSE_BYTES) {
            throw new Error("Application A2A response exceeds its byte budget.");
          }
          const body = Buffer.from(await response.arrayBuffer());
          if (body.byteLength > MAX_A2A_RESPONSE_BYTES) {
            throw new Error("Application A2A response exceeds its byte budget.");
          }
          return this.parseA2aCard(JSON.parse(body.toString("utf8")), request.url);
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") throw error;
        }
      }
      throw new Error("Application A2A Agent Card is unavailable.");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Application A2A inspection timed out.");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  /** 串行执行 Agent 文件与设置事务；输入任务，输出任务结果，前序失败不会阻断后续任务。 */
  private enqueueOperation<TResult>(operation: () => Promise<TResult>): Promise<TResult> {
    const result = this.operation.then(operation, operation);
    this.operation = result.then(() => undefined, () => undefined);
    return result;
  }

  /** 生成不冲突的短 Agent ID；输入现有映射，输出 8 至 128 位 ID，连续碰撞时抛错。 */
  private nextAgentId(agents: Readonly<Record<string, unknown>>): string {
    for (let attempt = 0; attempt < 32; attempt += 1) {
      const candidate = String(this.createId() || "").trim();
      if (/^[A-Za-z0-9_-]{8,128}$/.test(candidate) && !(candidate in agents)) return candidate;
    }
    throw new Error("Application Agent could not allocate a unique ID.");
  }

  /** 解析固定 Agent 快照路径；输入已校验 ID，输出根目录内绝对路径，无文件系统副作用。 */
  private agentPath(agentId: string): string {
    const resolved = path.resolve(this.agentsRoot, `${agentId}.json`);
    if (path.dirname(resolved) !== this.agentsRoot) {
      throw new Error("Application Agent path is invalid.");
    }
    return resolved;
  }

  /** 解析并裁剪 A2A 卡片；输入未知 JSON 和端点，输出无认证字段公开结果，格式异常时抛错。 */
  private parseA2aCard(value: unknown, url: string): ApplicationA2aInspectionResult {
    if (!isRecord(value)) throw new Error("Application A2A Agent Card is invalid.");
    const skills = Array.isArray(value.skills)
      ? value.skills.slice(0, 64).map((skill, index) => this.parseA2aSkill(skill, index))
      : [];
    return {
      schema: APPLICATION_AGENT_RUNTIME_SCHEMA,
      url,
      name: publicText(value.name, "Unknown Agent", 256),
      description: publicText(value.description, "", 4_096),
      version: publicText(value.version, "unknown", 128),
      skills,
      status: "ready",
      enabled: true,
    };
  }

  /** 解析一条 A2A 技能；输入未知值和索引，输出有界公开字段，非法对象降级为空技能。 */
  private parseA2aSkill(value: unknown, index: number): ApplicationA2aSkill {
    const skill = isRecord(value) ? value : {};
    return {
      id: publicText(skill.id, `skill-${index + 1}`, 128),
      name: publicText(skill.name, "Unknown Skill", 256),
      description: publicText(skill.description, "", 2_048),
      tags: publicTextList(skill.tags, 32, 128),
      examples: publicTextList(skill.examples, 32, 1_024),
    };
  }
}

/** 判断未知值是否为普通记录；输入未知值，输出布尔值，无副作用。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 克隆有界 JSON 记录；输入值、标签和字节预算，输出副本，非法或超限时抛错。 */
function cloneRecord(value: unknown, label: string, maximumBytes: number): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`Application Agent ${label} is invalid.`);
  const serialized = JSON.stringify(value);
  if (Buffer.byteLength(serialized, "utf8") > maximumBytes) {
    throw new Error(`Application Agent ${label} exceeds its byte budget.`);
  }
  return JSON.parse(serialized) as Record<string, unknown>;
}

/** 规范公开文本；输入未知值、默认值和长度，输出去控制字符文本，超长时截断。 */
function publicText(value: unknown, fallback: string, maximumLength: number): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || /[\u0000\u007F]/.test(normalized)) return fallback;
  return normalized.slice(0, maximumLength);
}

/** 规范公开文本数组；输入未知值和预算，输出去重字符串，非法项被忽略。 */
function publicTextList(value: unknown, maximumItems: number, maximumLength: number): readonly string[] {
  if (!Array.isArray(value)) return [];
  const output: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const normalized = publicText(item, "", maximumLength);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      output.push(normalized);
      if (output.length >= maximumItems) break;
    }
  }
  return output;
}
