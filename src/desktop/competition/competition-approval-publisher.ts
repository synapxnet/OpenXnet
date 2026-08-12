import type { ApplicationCompetitionApproval } from "../contracts/application-competition-runtime";

/** OpenXnet 审批发布器的网络依赖和安全预算。 */
export interface HttpCompetitionApprovalPublisherOptions {
  readonly resolveEndpoint: () => Promise<string>;
  readonly resolveIssuerToken: () => Promise<string>;
  readonly fetchResource?: typeof fetch;
  readonly now?: () => Date;
  readonly ttlMs?: number;
}

/** 将本地人工审批发布为服务器可内省的短期、精确范围证明。 */
export class HttpCompetitionApprovalPublisher {
  private readonly fetchResource: typeof fetch;
  private readonly now: () => Date;
  private readonly ttlMs: number;

  /** 创建审批发布器；输入端点、签发令牌和时间依赖，不提前访问网络。 */
  public constructor(private readonly options: HttpCompetitionApprovalPublisherOptions) {
    this.fetchResource = options.fetchResource ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.ttlMs = options.ttlMs ?? 15 * 60 * 1_000;
  }

  /** 发布已通过审批；输入持久记录，无返回，网络或范围无效时失败关闭。 */
  public async publish(approval: ApplicationCompetitionApproval): Promise<void> {
    if (approval.status !== "APPROVED" || approval.decidedBy === null || approval.decidedAt === null) {
      throw new Error("Competition approval has not been approved.");
    }
    const token = (await this.options.resolveIssuerToken()).trim();
    if (token.length < 32) throw new Error("Competition approval issuer identity is not configured.");
    const expiresAt = new Date(Date.parse(approval.decidedAt) + this.ttlMs);
    const now = this.now();
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= now || expiresAt.getTime() > now.getTime() + 30 * 60 * 1_000) {
      throw new Error("Competition approval has expired or exceeds its lifetime budget.");
    }
    const endpoint = this.requireEndpoint(await this.options.resolveEndpoint());
    const url = new URL(`api/v1/approvals/${encodeURIComponent(approval.approvalId)}`, endpoint);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3_000);
    try {
      const response = await this.fetchResource(url, {
        method: "PUT",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({
          approvalId: approval.approvalId,
          status: approval.status,
          expiresAt: expiresAt.toISOString(),
          workspaceId: approval.workspaceId,
          incidentId: approval.incidentId,
          traceId: approval.traceId,
          toolName: approval.toolName,
          resourceId: approval.resourceId,
          targetRevision: approval.targetRevision,
          expectedResourceVersion: approval.expectedResourceVersion,
          planId: approval.planId,
          planDigest: approval.planDigest,
          scopes: approval.scopes.map((scope) => ({
            stepId: scope.stepId,
            toolName: scope.toolName,
            resourceId: scope.resourceId,
            targetRevision: scope.targetRevision,
            expectedResourceVersion: scope.expectedResourceVersion,
            argumentsDigest: scope.argumentsDigest,
            compensation: scope.compensation,
          })),
          requesterId: approval.requestedBy,
          approverId: approval.decidedBy,
        }),
      });
      if (!response.ok || (response.status >= 300 && response.status < 400)) {
        throw new Error(`Competition approval publisher rejected the request with HTTP ${response.status}.`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > 64 * 1024) throw new Error("Competition approval response is too large.");
    } finally {
      clearTimeout(timeout);
    }
  }

  /** 校验审批服务根地址；输入配置值，返回保留路径前缀的 HTTPS URL。 */
  private requireEndpoint(value: string): URL {
    const endpoint = new URL(value.trim().replace(/\/?$/u, "/"));
    const hostname = endpoint.hostname.toLowerCase();
    const loopback = hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1" || hostname === "[::1]";
    if (
      endpoint.username
      || endpoint.password
      || endpoint.search
      || endpoint.hash
      || (endpoint.protocol !== "https:" && !(endpoint.protocol === "http:" && loopback))
    ) {
      throw new Error("Competition approval endpoint is not allowed.");
    }
    return endpoint;
  }
}
