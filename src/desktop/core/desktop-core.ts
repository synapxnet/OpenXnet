import { randomUUID } from "node:crypto";

import {
  DESKTOP_CORE_PROTOCOL_VERSION,
  type CapabilityDescriptor,
  type CapabilityId,
  type CapabilitySnapshot,
  type CapabilityState,
  type DesktopCoreSnapshot,
} from "../contracts/capability";
import {
  CapabilityRegistry,
  type CapabilityRegistryListener,
  type CapabilityTransitionOptions,
} from "./capability-registry";

/** Function that starts or restores a capability and returns optional state metadata. */
export type CapabilityActivator = () => Promise<Readonly<Record<string, unknown>> | void>;

const DEFAULT_CAPABILITIES: readonly CapabilityDescriptor[] = [
  { id: "core", displayName: "Desktop Core", runtime: "typescript", optional: false, dependencies: [] },
  {
    id: "legacy-backend",
    displayName: "Legacy Python Backend",
    runtime: "python",
    optional: false,
    dependencies: ["core"],
  },
  {
    id: "execution-engine",
    displayName: "Task Execution Engine",
    runtime: "python",
    optional: false,
    dependencies: ["core"],
  },
  {
    id: "chat",
    displayName: "AI Chat",
    runtime: "python",
    optional: false,
    dependencies: ["execution-engine"],
  },
  {
    id: "tasks",
    displayName: "Task Execution",
    runtime: "python",
    optional: false,
    dependencies: ["core"],
  },
  { id: "voice", displayName: "Voice and ASR", runtime: "python", optional: true, dependencies: ["core"] },
  {
    id: "vector-index",
    displayName: "Vector Index",
    runtime: "python",
    optional: true,
    dependencies: ["core"],
  },
  {
    id: "memory",
    displayName: "Long-term Memory",
    runtime: "python",
    optional: true,
    dependencies: ["core"],
  },
  {
    id: "documents",
    displayName: "Document Processing",
    runtime: "python",
    optional: true,
    dependencies: ["core"],
  },
  {
    id: "connectors",
    displayName: "External Connectors",
    runtime: "python",
    optional: true,
    dependencies: ["core"],
  },
  {
    id: "live",
    displayName: "Live Streaming",
    runtime: "python",
    optional: true,
    dependencies: ["core"],
  },
  {
    id: "mcp",
    displayName: "MCP Integrations",
    runtime: "python",
    optional: true,
    dependencies: ["core"],
  },
  {
    id: "agentteams",
    displayName: "AgentTeams Runtime",
    runtime: "python",
    optional: true,
    dependencies: ["core"],
  },
  {
    id: "desktop-control",
    displayName: "Desktop Window Control",
    runtime: "python",
    optional: true,
    dependencies: ["core"],
  },
  { id: "gitnexus", displayName: "GitNexus", runtime: "node", optional: true, dependencies: ["core"] },
  { id: "vr", displayName: "VR Runtime", runtime: "asset", optional: true, dependencies: ["core"] },
];

/**
 * Coordinate desktop capability state behind a runtime-independent contract.
 */
export class DesktopCore {
  private readonly registry: CapabilityRegistry;
  private readonly activators = new Map<CapabilityId, CapabilityActivator>();
  private readonly activations = new Map<CapabilityId, Promise<CapabilitySnapshot>>();
  private readonly sessionId = randomUUID();
  private startedAt: string | null = null;

  /**
   * Create Desktop Core and register its known capabilities without starting them.
   *
   * @param registry Registry implementation used to persist in-memory lifecycle state.
   */
  public constructor(registry: CapabilityRegistry = new CapabilityRegistry()) {
    this.registry = registry;
    for (const descriptor of DEFAULT_CAPABILITIES) {
      this.registry.register(descriptor, descriptor.id === "core" ? "stopped" : "unavailable");
    }
  }

  /**
   * Start lightweight Core services without activating heavyweight capabilities.
   *
   * @returns Aggregate Core state after startup.
   */
  public async start(): Promise<DesktopCoreSnapshot> {
    const core = this.registry.get("core");
    if (core.state === "ready") {
      return this.getSnapshot();
    }
    this.registry.transition("core", "starting");
    this.startedAt = new Date().toISOString();
    this.registry.transition("core", "ready", { metadata: { processId: process.pid } });
    return this.getSnapshot();
  }

  /**
   * Stop Core after marking active capabilities as stopped where transitions allow it.
   *
   * @returns Aggregate Core state after shutdown transitions.
   */
  public async stop(): Promise<DesktopCoreSnapshot> {
    const core = this.registry.get("core");
    if (core.state === "ready" || core.state === "degraded") {
      this.registry.transition("core", "stopping");
      this.registry.transition("core", "stopped");
    }
    return this.getSnapshot();
  }

  /**
   * Return the serializable aggregate state exposed through preload IPC.
   *
   * @returns Current Core and capability state.
   */
  public getSnapshot(): DesktopCoreSnapshot {
    return {
      protocolVersion: DESKTOP_CORE_PROTOCOL_VERSION,
      sessionId: this.sessionId,
      startedAt: this.startedAt,
      capabilities: this.registry.list(),
    };
  }

  /**
   * List capability state without the aggregate Core envelope.
   *
   * @returns Current capability snapshots.
   */
  public listCapabilities(): readonly CapabilitySnapshot[] {
    return this.registry.list();
  }

  /**
   * Read one capability state.
   *
   * @param capabilityId Capability to retrieve.
   * @returns Current capability snapshot.
   */
  public getCapability(capabilityId: CapabilityId): CapabilitySnapshot {
    return this.registry.get(capabilityId);
  }

  /**
   * Apply a lifecycle transition reported by a legacy adapter or worker supervisor.
   *
   * @param capabilityId Capability being updated.
   * @param nextState Requested state.
   * @param options Optional error and state metadata.
   * @returns Updated capability snapshot.
   */
  public setCapabilityState(
    capabilityId: CapabilityId,
    nextState: CapabilityState,
    options: CapabilityTransitionOptions = {},
  ): CapabilitySnapshot {
    return this.registry.transition(capabilityId, nextState, options);
  }

  /**
   * Register the runtime-specific activation function for a capability.
   *
   * @param capabilityId Capability activated by the function.
   * @param activator Activation implementation.
   */
  public registerActivator(capabilityId: CapabilityId, activator: CapabilityActivator): void {
    this.activators.set(capabilityId, activator);
    const current = this.registry.get(capabilityId);
    if (current.state === "unavailable") {
      this.registry.transition(capabilityId, "stopped");
    }
  }

  /**
   * Ensure a capability is ready while coalescing concurrent activation requests.
   *
   * @param capabilityId Capability required by a caller.
   * @returns Ready capability snapshot.
   */
  public async ensureCapability(capabilityId: CapabilityId): Promise<CapabilitySnapshot> {
    const current = this.registry.get(capabilityId);
    if (current.state === "ready") {
      return current;
    }

    const activeRequest = this.activations.get(capabilityId);
    if (activeRequest !== undefined) {
      if (current.state !== "error") {
        return activeRequest;
      }
      try {
        await activeRequest;
      } catch {
        // The failed activation must release its slot before a retry is created.
      }
      return this.ensureCapability(capabilityId);
    }

    const activation = this.activateCapability(capabilityId);
    this.activations.set(capabilityId, activation);
    try {
      return await activation;
    } finally {
      this.activations.delete(capabilityId);
    }
  }

  /**
   * Subscribe to individual capability transitions.
   *
   * @param listener Observer invoked after each committed transition.
   * @returns A function that removes the observer.
   */
  public subscribe(listener: CapabilityRegistryListener): () => void {
    return this.registry.subscribe(listener);
  }

  /**
   * Activate dependencies and invoke the runtime adapter for one capability.
   *
   * @param capabilityId Capability to activate.
   * @returns Ready snapshot after successful activation.
   */
  private async activateCapability(capabilityId: CapabilityId): Promise<CapabilitySnapshot> {
    const current = this.registry.get(capabilityId);
    const activator = this.activators.get(capabilityId);
    if (activator === undefined) {
      throw new Error(`Capability '${capabilityId}' has no registered activator.`);
    }

    for (const dependencyId of current.dependencies) {
      await this.ensureCapability(dependencyId);
    }

    if (current.state === "unavailable") {
      throw new Error(`Capability '${capabilityId}' is not installed.`);
    }
    if (current.state !== "stopped" && current.state !== "error") {
      throw new Error(`Capability '${capabilityId}' cannot activate from state '${current.state}'.`);
    }

    this.registry.transition(capabilityId, "starting");
    try {
      const metadata = await activator();
      return this.registry.transition(
        capabilityId,
        "ready",
        metadata === undefined ? {} : { metadata },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.registry.transition(capabilityId, "error", {
        error: { code: "CAPABILITY_ACTIVATION_FAILED", message, retryable: true },
      });
      throw error;
    }
  }
}

/**
 * Create the default Desktop Core instance used by Electron Main.
 *
 * @returns A Core instance with standard capability descriptors.
 */
export function createDesktopCore(): DesktopCore {
  return new DesktopCore();
}
