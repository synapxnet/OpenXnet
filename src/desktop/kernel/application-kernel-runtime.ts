import { request as createHttpRequest } from "node:http";

import {
  APPLICATION_KERNEL_RUNTIME_SCHEMA,
  parseApplicationKernelCommandRequest,
  type ApplicationKernelCommandResult,
  type ApplicationKernelOperation,
} from "../contracts/application-kernel-runtime";
import type { ExecutionEngineLease } from "../workers/execution-engine-supervisor";

const KERNEL_ENGINE_PATH = "/v1/desktop/kernel/command";
const MAX_KERNEL_REQUEST_BYTES = 256 * 1024;
const MAX_KERNEL_RESPONSE_BYTES = 4 * 1024 * 1024;

/** Kernel Runtime 构造依赖。 */
export interface ApplicationKernelRuntimeOptions {
  readonly token: string;
  readonly acquireEngine: () => Promise<ExecutionEngineLease>;
}

/** 通过短请求租约访问私有 Execution Engine Kernel dispatcher。 */
export class ApplicationKernelRuntimeService {
  /**
   * 创建 Kernel Runtime；输入私有 token 和租约工厂，仅保存依赖，不启动 Python；token 为空时抛错且不产生副作用。
   */
  public constructor(private readonly options: ApplicationKernelRuntimeOptions) {
    if (!options.token.trim()) throw new Error("Kernel Runtime requires a non-empty engine token.");
  }

  /**
   * 执行一个固定 Kernel 操作；输入不可信命令，返回有界公开结果；验证失败时不获取租约，请求结束或失败时始终释放租约。
   */
  public async invoke(value: unknown): Promise<ApplicationKernelCommandResult> {
    const command = parseApplicationKernelCommandRequest(value);
    const response = await this.requestEngine(command.operation, command.payload);
    return parseKernelEngineResponse(response, command.operation);
  }

  /**
   * 发送一次私有认证请求；输入固定操作和规范载荷，返回 JSON；超时、超限、非成功状态或无效 JSON 时抛出固定错误并释放租约。
   */
  private async requestEngine(operation: ApplicationKernelOperation, payload: Readonly<Record<string, unknown>>): Promise<unknown> {
    const body = Buffer.from(JSON.stringify({ operation, payload }), "utf8");
    if (body.length > MAX_KERNEL_REQUEST_BYTES) throw new Error("Kernel Runtime request is too large.");
    const lease = await this.options.acquireEngine();
    const target = new URL(KERNEL_ENGINE_PATH, lease.origin);
    try {
      return await new Promise<unknown>((resolve, reject) => {
        let settled = false;

        /** 完成一次私有请求；输入回调和值，无返回；重复完成会被忽略且不产生额外副作用。 */
        function settle(callback: (value: unknown) => void, value: unknown): void {
          if (settled) return;
          settled = true;
          callback(value);
        }

        const upstream = createHttpRequest(target, {
          method: "POST",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${this.options.token}`,
            "Cache-Control": "no-store",
            "Content-Length": String(body.length),
            "Content-Type": "application/json; charset=utf-8",
            Host: target.host,
          },
        }, (response) => {
          const chunks: Buffer[] = [];
          let totalBytes = 0;
          response.on("data", (chunk: Buffer | string) => {
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            totalBytes += buffer.length;
            if (totalBytes > MAX_KERNEL_RESPONSE_BYTES) {
              const error = new Error("Kernel Runtime response is too large.");
              response.destroy(error);
              upstream.destroy(error);
              settle(reject, error);
              return;
            }
            chunks.push(buffer);
          });
          response.once("end", () => {
            const statusCode = response.statusCode ?? 500;
            if (statusCode < 200 || statusCode >= 300) {
              settle(reject, new Error("Kernel Runtime engine is unavailable."));
              return;
            }
            try {
              settle(resolve, JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown);
            } catch {
              settle(reject, new Error("Kernel Runtime engine returned invalid JSON."));
            }
          });
        });
        upstream.setTimeout(20_000, () => {
          const error = new Error("Kernel Runtime engine request timed out.");
          upstream.destroy(error);
          settle(reject, error);
        });
        upstream.once("error", () => settle(reject, new Error("Kernel Runtime engine request failed.")));
        upstream.end(body);
      });
    } finally {
      lease.release();
    }
  }
}

/**
 * 解析私有 Engine 响应；输入未知值和预期操作，返回公开结果；schema、操作或 JSON 结构漂移时抛出固定错误且不修改输入。
 */
function parseKernelEngineResponse(value: unknown, expectedOperation: ApplicationKernelOperation): ApplicationKernelCommandResult {
  const response = requireExactRecord(value, ["schema", "success", "operation", "data"], "Kernel Runtime response");
  if (
    response.schema !== APPLICATION_KERNEL_RUNTIME_SCHEMA
    || response.success !== true
    || response.operation !== expectedOperation
  ) {
    throw new Error("Kernel Runtime engine response is invalid.");
  }
  return {
    schema: APPLICATION_KERNEL_RUNTIME_SCHEMA,
    success: true,
    operation: expectedOperation,
    data: readPublicJson(response.data, 0),
  };
}

/** 校验精确普通对象；输入值、字段和标签，返回记录；类型、原型或字段漂移时抛错。 */
function requireExactRecord(value: unknown, fields: readonly string[], label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${label} is invalid.`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new Error(`${label} prototype is invalid.`);
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== fields.length || Object.keys(record).some((field) => !fields.includes(field))) {
    throw new Error(`${label} fields are invalid.`);
  }
  return record;
}

/**
 * 递归复制公开 JSON；输入值和深度，返回无危险原型的有界副本；超深、超量、非有限数或危险键会抛错。
 */
function readPublicJson(value: unknown, depth: number): unknown {
  if (depth > 16) throw new Error("Kernel Runtime response is too deep.");
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Kernel Runtime response contains an invalid number.");
    return value;
  }
  if (typeof value === "string") {
    if (value.length > 128_000 || /[\u0000\u007F]/.test(value)) throw new Error("Kernel Runtime response contains invalid text.");
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length > 2_000) throw new Error("Kernel Runtime response contains too many items.");
    return value.map((item) => readPublicJson(item, depth + 1));
  }
  if (typeof value !== "object" || value === null) throw new Error("Kernel Runtime response contains a non-JSON value.");
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new Error("Kernel Runtime response prototype is invalid.");
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > 2_000) throw new Error("Kernel Runtime response contains too many fields.");
  const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const [key, item] of entries) {
    if (!key || key.length > 256 || key === "__proto__" || key === "prototype" || key === "constructor") {
      throw new Error("Kernel Runtime response contains an invalid field.");
    }
    result[key] = readPublicJson(item, depth + 1);
  }
  return result;
}
