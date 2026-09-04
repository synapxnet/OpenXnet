import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const OFFICIAL_SKILL_ID = "alibabacloud-pai-eas-service-diagnose";
const PROVENANCE_SCHEMA = "openxnet.official-skill-provenance.v1";
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const RESOURCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,159}$/u;
const REGION_PATTERN = /^[a-z]{2}-[a-z0-9]+(?:-[0-9]+)?$/u;
const READ_ONLY_OPERATIONS = Object.freeze([
  "DescribeService",
  "DescribeServiceLog",
  "DescribeServiceEvent",
  "DescribeServiceDiagnosis",
  "DescribeServiceInstanceDiagnosis",
  "ListServiceInstances",
  "ListServiceContainers",
  "ListServices",
  "DescribeResource",
  "DescribeGateway",
] as const);

/** PAI EAS 官方 Skill 允许调用的只读操作。 */
export type CompetitionPaiEasReadOnlyOperation = (typeof READ_ONLY_OPERATIONS)[number];

/** 单次 PAI EAS 只读诊断请求。 */
export interface CompetitionPaiEasDiagnosisRequest {
  readonly region: string;
  readonly serviceName: string;
  readonly operations?: readonly CompetitionPaiEasReadOnlyOperation[];
}

/** 传给受限 Aliyun CLI/SDK 执行器的结构化只读调用。 */
export interface CompetitionPaiEasReadOnlyInvocation {
  readonly operation: CompetitionPaiEasReadOnlyOperation;
  readonly region: string;
  readonly serviceName: string;
  readonly userAgent: string;
}

/** PAI EAS 只读诊断的单项脱敏结果。 */
export interface CompetitionPaiEasDiagnosisObservation {
  readonly operation: CompetitionPaiEasReadOnlyOperation;
  readonly data: Readonly<Record<string, unknown>>;
}

/** 官方 Skill 的供应链和运行配置状态。 */
export interface CompetitionOfficialSkillSnapshot {
  readonly skillId: typeof OFFICIAL_SKILL_ID;
  readonly publisher: string;
  readonly license: "Apache-2.0";
  readonly packageVersion: string;
  readonly contentVersion: string;
  readonly distributionSha256: string;
  readonly assetDigest: string;
  readonly supplyChainVerified: boolean;
  readonly executionStatus: "READY" | "NOT_CONFIGURED";
  readonly allowedOperations: readonly CompetitionPaiEasReadOnlyOperation[];
  readonly allowMutation: false;
  readonly allowCredentialReadback: false;
}

/** PAI EAS 官方 Skill 完整诊断回执。 */
export interface CompetitionPaiEasDiagnosisResult {
  readonly skill: CompetitionOfficialSkillSnapshot;
  readonly sessionId: string;
  readonly observations: readonly CompetitionPaiEasDiagnosisObservation[];
}

/** PAI EAS 官方 Skill 运行边界依赖。 */
export interface CompetitionPaiEasOfficialSkillBoundaryOptions {
  readonly assetDirectory: string;
  readonly invokeReadOnly?: (
    request: CompetitionPaiEasReadOnlyInvocation,
  ) => Promise<Readonly<Record<string, unknown>>>;
}

/** 带公开错误码的官方 Skill 失败。 */
export class CompetitionOfficialSkillError extends Error {
  /** 创建可展示的官方 Skill 错误；输入固定错误码和脱敏信息。 */
  public constructor(
    public readonly code: "OFFICIAL_SKILL_INVALID" | "OFFICIAL_SKILL_NOT_CONFIGURED" | "OFFICIAL_SKILL_OPERATION_DENIED",
    message: string,
  ) {
    super(message);
    this.name = "CompetitionOfficialSkillError";
  }
}

/** 固定阿里云官方 PAI EAS Skill 的供应链，并只允许 Describe/List 诊断。 */
export class CompetitionPaiEasOfficialSkillBoundary {
  private snapshot: CompetitionOfficialSkillSnapshot | null = null;

  /** 创建官方 Skill 边界；输入资产目录和可选只读执行器，不提前读取凭据。 */
  public constructor(private readonly options: CompetitionPaiEasOfficialSkillBoundaryOptions) {}

  /** 校验官方制品文件、许可证、权限和摘要；无输入，返回运行状态快照。 */
  public async inspect(): Promise<CompetitionOfficialSkillSnapshot> {
    if (this.snapshot !== null) return this.snapshot;
    const provenancePath = path.join(this.options.assetDirectory, "official-skill.provenance.json");
    const provenance = requireRecord(JSON.parse(await readFile(provenancePath, "utf8")), "provenance");
    if (provenance.schema !== PROVENANCE_SCHEMA || provenance.skillId !== OFFICIAL_SKILL_ID) {
      throw new CompetitionOfficialSkillError("OFFICIAL_SKILL_INVALID", "官方 Skill 来源清单无效。");
    }
    const distribution = requireRecord(provenance.distribution, "distribution");
    const security = requireRecord(provenance.securityBoundary, "securityBoundary");
    const upstreamFiles = requireArray(provenance.upstreamFiles, "upstreamFiles");
    const permissions = requireStringArray(security.requiredPermissions, "requiredPermissions");
    if (
      provenance.license !== "Apache-2.0"
      || security.allowMutation !== false
      || security.allowCredentialReadback !== false
      || permissions.length !== READ_ONLY_OPERATIONS.length
      || permissions.some((permission) => !/^eas:(?:Describe|List)[A-Za-z]+$/u.test(permission))
    ) {
      throw new CompetitionOfficialSkillError("OFFICIAL_SKILL_INVALID", "官方 Skill 权限边界不是只读诊断。");
    }
    const verifiedFiles: Array<{ readonly path: string; readonly sha256: string }> = [];
    for (const item of upstreamFiles) {
      const file = requireRecord(item, "upstreamFile");
      const relativePath = requireSafeRelativePath(file.path);
      const expectedDigest = requireSHA256(file.sha256, "upstreamFile.sha256");
      const expectedBytes = requirePositiveInteger(file.bytes, "upstreamFile.bytes");
      const bytes = await readFile(path.join(this.options.assetDirectory, relativePath));
      if (bytes.length !== expectedBytes || sha256(bytes) !== expectedDigest) {
        throw new CompetitionOfficialSkillError("OFFICIAL_SKILL_INVALID", "官方 Skill 文件摘要校验失败。");
      }
      verifiedFiles.push({ path: relativePath, sha256: expectedDigest });
    }
    const skillDocument = await readFile(path.join(this.options.assetDirectory, "SKILL.md"), "utf8");
    if (
      !skillDocument.includes(`name: ${OFFICIAL_SKILL_ID}`)
      || !skillDocument.includes("license: Apache-2.0")
      || !skillDocument.includes("Not for: deploying")
    ) {
      throw new CompetitionOfficialSkillError("OFFICIAL_SKILL_INVALID", "官方 Skill 元数据或用途边界无效。");
    }
    const distributionSha256 = requireSHA256(distribution.sha256, "distribution.sha256");
    this.snapshot = Object.freeze({
      skillId: OFFICIAL_SKILL_ID,
      publisher: requireText(provenance.publisher, "publisher", 160),
      license: "Apache-2.0" as const,
      packageVersion: requireText(distribution.packageVersion, "packageVersion", 32),
      contentVersion: requireText(distribution.contentVersion, "contentVersion", 32),
      distributionSha256,
      assetDigest: sha256(Buffer.from(JSON.stringify(verifiedFiles), "utf8")),
      supplyChainVerified: true,
      executionStatus: this.options.invokeReadOnly === undefined ? "NOT_CONFIGURED" : "READY",
      allowedOperations: READ_ONLY_OPERATIONS,
      allowMutation: false as const,
      allowCredentialReadback: false as const,
    });
    return this.snapshot;
  }

  /** 执行完整 PAI EAS 只读诊断；输入区域、服务和操作集合，返回脱敏观察结果。 */
  public async diagnose(value: unknown): Promise<CompetitionPaiEasDiagnosisResult> {
    const skill = await this.inspect();
    if (this.options.invokeReadOnly === undefined) {
      throw new CompetitionOfficialSkillError(
        "OFFICIAL_SKILL_NOT_CONFIGURED",
        "PAI EAS 官方 Skill 尚未配置 Aliyun CLI 身份，禁止模拟诊断结果。",
      );
    }
    const request = parseDiagnosisRequest(value);
    const sessionId = randomBytes(16).toString("hex");
    const userAgent = `AlibabaCloud-Agent-Skills/${OFFICIAL_SKILL_ID}/${sessionId}`;
    const observations: CompetitionPaiEasDiagnosisObservation[] = [];
    for (const operation of request.operations) {
      observations.push({
        operation,
        data: await this.options.invokeReadOnly({
          operation,
          region: request.region,
          serviceName: request.serviceName,
          userAgent,
        }),
      });
    }
    return Object.freeze({ skill, sessionId, observations: Object.freeze(observations) });
  }
}

/** 解析 PAI EAS 诊断请求并拒绝白名单外操作。 */
function parseDiagnosisRequest(value: unknown): {
  readonly region: string;
  readonly serviceName: string;
  readonly operations: readonly CompetitionPaiEasReadOnlyOperation[];
} {
  const record = requireRecord(value, "request");
  const keys = Object.keys(record);
  if (keys.some((key) => !["region", "serviceName", "operations"].includes(key))) {
    throw new CompetitionOfficialSkillError("OFFICIAL_SKILL_OPERATION_DENIED", "PAI EAS 诊断请求包含越权字段。");
  }
  const region = requireText(record.region, "region", 64);
  if (!REGION_PATTERN.test(region)) {
    throw new CompetitionOfficialSkillError("OFFICIAL_SKILL_OPERATION_DENIED", "PAI EAS 区域标识无效。");
  }
  const serviceName = requireText(record.serviceName, "serviceName", 160);
  if (!RESOURCE_PATTERN.test(serviceName)) {
    throw new CompetitionOfficialSkillError("OFFICIAL_SKILL_OPERATION_DENIED", "PAI EAS 服务名称无效。");
  }
  const requested = record.operations === undefined
    ? READ_ONLY_OPERATIONS
    : requireStringArray(record.operations, "operations");
  const operations = requested.map((operation) => {
    if (!READ_ONLY_OPERATIONS.includes(operation as CompetitionPaiEasReadOnlyOperation)) {
      throw new CompetitionOfficialSkillError("OFFICIAL_SKILL_OPERATION_DENIED", "PAI EAS 官方 Skill 仅允许只读诊断操作。");
    }
    return operation as CompetitionPaiEasReadOnlyOperation;
  });
  if (operations.length === 0 || new Set(operations).size !== operations.length) {
    throw new CompetitionOfficialSkillError("OFFICIAL_SKILL_OPERATION_DENIED", "PAI EAS 诊断操作集合无效。");
  }
  return Object.freeze({ region, serviceName, operations: Object.freeze(operations) });
}

/** 计算二进制内容的 SHA-256。 */
function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

/** 读取普通对象；输入未知值和字段名，返回无原型要求的记录。 */
function requireRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new CompetitionOfficialSkillError("OFFICIAL_SKILL_INVALID", `${field} 必须是对象。`);
  }
  return value as Record<string, unknown>;
}

/** 读取数组；输入未知值和字段名，返回只读未知数组。 */
function requireArray(value: unknown, field: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new CompetitionOfficialSkillError("OFFICIAL_SKILL_INVALID", `${field} 必须是数组。`);
  }
  return value;
}

/** 读取非空字符串数组；输入未知值和字段名，返回标准化数组。 */
function requireStringArray(value: unknown, field: string): readonly string[] {
  const items = requireArray(value, field);
  if (items.length === 0 || items.some((item) => typeof item !== "string" || item.trim() !== item || item.length === 0)) {
    throw new CompetitionOfficialSkillError("OFFICIAL_SKILL_INVALID", `${field} 必须是非空字符串数组。`);
  }
  return items as readonly string[];
}

/** 读取有限非空文本；输入未知值、字段名和长度上限，返回原文本。 */
function requireText(value: unknown, field: string, maximum: number): string {
  if (typeof value !== "string" || value.trim() !== value || value.length === 0 || value.length > maximum) {
    throw new CompetitionOfficialSkillError("OFFICIAL_SKILL_INVALID", `${field} 无效。`);
  }
  return value;
}

/** 读取固定 SHA-256；输入未知值和字段名，返回小写摘要。 */
function requireSHA256(value: unknown, field: string): string {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
    throw new CompetitionOfficialSkillError("OFFICIAL_SKILL_INVALID", `${field} 无效。`);
  }
  return value;
}

/** 读取正整数；输入未知值和字段名，返回文件字节数。 */
function requirePositiveInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new CompetitionOfficialSkillError("OFFICIAL_SKILL_INVALID", `${field} 无效。`);
  }
  return value;
}

/** 校验制品相对路径；输入未知值，返回禁止目录穿越的 POSIX 风格路径。 */
function requireSafeRelativePath(value: unknown): string {
  const relativePath = requireText(value, "upstreamFile.path", 512);
  if (path.isAbsolute(relativePath) || relativePath.includes("\\") || relativePath.split("/").includes("..")) {
    throw new CompetitionOfficialSkillError("OFFICIAL_SKILL_INVALID", "官方 Skill 文件路径无效。");
  }
  return relativePath;
}
