import type { CapabilityId } from "./capability";

/** Capabilities that may be installed from the signed Feature Pack feed. */
export const FEATURE_PACK_CAPABILITY_IDS = [
  "voice",
  "vector-index",
  "memory",
  "documents",
  "connectors",
  "live",
  "mcp",
  "agentteams",
  "desktop-control",
  "gitnexus",
] as const satisfies readonly CapabilityId[];

/** User-visible lifecycle operations supported by the distribution service. */
export const FEATURE_PACK_OPERATIONS = ["install", "repair", "uninstall"] as const;

/** Stable phases emitted while a Feature Pack operation is running. */
export const FEATURE_PACK_PROGRESS_PHASES = [
  "preparing",
  "downloading",
  "verifying-archive",
  "extracting",
  "verifying-pack",
  "installing",
  "removing",
  "completed",
  "failed",
] as const;

/** Capability identifier accepted by the Feature Pack management boundary. */
export type FeaturePackCapabilityId = (typeof FEATURE_PACK_CAPABILITY_IDS)[number];

/** Feature Pack management operation. */
export type FeaturePackOperation = (typeof FEATURE_PACK_OPERATIONS)[number];

/** Current phase of one Feature Pack management operation. */
export type FeaturePackProgressPhase = (typeof FEATURE_PACK_PROGRESS_PHASES)[number];

/** Health classification shown by Feature Pack management clients. */
export type FeaturePackStatus = "not-installed" | "installed" | "update-available" | "damaged";

/** Feed availability classification shown without exposing the configured URL. */
export type FeaturePackFeedStatus = "not-configured" | "ready" | "error";

/** Structured and sanitized error safe to expose to a Renderer. */
export interface FeaturePackPublicError {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
}

/** Serializable state for one distributable capability. */
export interface FeaturePackDistributionItem {
  readonly capabilityId: FeaturePackCapabilityId;
  readonly displayName: string;
  readonly status: FeaturePackStatus;
  readonly installedVersion: string | null;
  readonly availableVersion: string | null;
  readonly operation: FeaturePackOperation | null;
  readonly restartRequired: boolean;
  readonly error?: FeaturePackPublicError;
}

/** Aggregate Feature Pack management state returned through IPC. */
export interface FeaturePackDistributionSnapshot {
  readonly feedStatus: FeaturePackFeedStatus;
  readonly catalogGeneratedAt: string | null;
  readonly refreshedAt: string;
  readonly packs: readonly FeaturePackDistributionItem[];
  readonly error?: FeaturePackPublicError;
}

/** Progress event for one allow-listed Feature Pack operation. */
export interface FeaturePackProgressEvent {
  readonly operationId: string;
  readonly capabilityId: FeaturePackCapabilityId;
  readonly operation: FeaturePackOperation;
  readonly phase: FeaturePackProgressPhase;
  readonly percent: number | null;
  readonly transferredBytes: number | null;
  readonly totalBytes: number | null;
  readonly error?: FeaturePackPublicError;
}

/** Request used to refresh or read Feature Pack distribution state. */
export interface ListFeaturePacksRequest {
  readonly refresh?: boolean;
}

/** Request used by install, repair, and uninstall IPC methods. */
export interface MutateFeaturePackRequest {
  readonly capabilityId: FeaturePackCapabilityId;
}

/** Result returned after a Feature Pack mutation completes. */
export interface FeaturePackMutationResult {
  readonly capabilityId: FeaturePackCapabilityId;
  readonly operation: FeaturePackOperation;
  readonly version: string | null;
  readonly restartRequired: boolean;
}

/** Renderer callback invoked for Feature Pack progress updates. */
export type FeaturePackProgressListener = (event: FeaturePackProgressEvent) => void;

/**
 * Determine whether an unknown value is an allow-listed Feature Pack capability.
 *
 * @param value Value received across an untrusted process boundary.
 * @returns True when the capability can be managed by the distribution service.
 */
export function isFeaturePackCapabilityId(value: unknown): value is FeaturePackCapabilityId {
  return typeof value === "string"
    && FEATURE_PACK_CAPABILITY_IDS.some((candidate) => candidate === value);
}
