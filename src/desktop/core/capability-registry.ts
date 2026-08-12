import type {
  CapabilityDescriptor,
  CapabilityError,
  CapabilityId,
  CapabilitySnapshot,
  CapabilityState,
} from "../contracts/capability";

/** Callback invoked after an observable capability transition. */
export type CapabilityRegistryListener = (snapshot: CapabilitySnapshot) => void;

/** Optional values that accompany a capability state transition. */
export interface CapabilityTransitionOptions {
  readonly error?: CapabilityError;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** Clock dependency used to make state transition timestamps deterministic in tests. */
export type Clock = () => Date;

const ALLOWED_TRANSITIONS: Readonly<Record<CapabilityState, readonly CapabilityState[]>> = {
  unavailable: ["installing", "stopped"],
  installing: ["stopped", "error", "unavailable"],
  stopped: ["starting", "unavailable"],
  starting: ["ready", "degraded", "stopped", "error"],
  ready: ["degraded", "stopping", "error"],
  degraded: ["ready", "stopping", "error"],
  stopping: ["stopped", "error"],
  error: ["starting", "stopped", "unavailable", "installing"],
};

/**
 * Store capability descriptors and enforce valid lifecycle transitions.
 */
export class CapabilityRegistry {
  private readonly capabilities = new Map<CapabilityId, CapabilitySnapshot>();
  private readonly listeners = new Set<CapabilityRegistryListener>();

  /**
   * Create a capability registry.
   *
   * @param clock Clock used to timestamp state transitions.
   */
  public constructor(private readonly clock: Clock = () => new Date()) {}

  /**
   * Register a capability before it can be activated or observed.
   *
   * @param descriptor Stable metadata for the capability.
   * @param initialState Initial lifecycle state.
   * @returns The registered immutable snapshot.
   */
  public register(
    descriptor: CapabilityDescriptor,
    initialState: CapabilityState = "stopped",
  ): CapabilitySnapshot {
    if (this.capabilities.has(descriptor.id)) {
      throw new Error(`Capability '${descriptor.id}' is already registered.`);
    }

    const snapshot: CapabilitySnapshot = {
      ...descriptor,
      dependencies: [...descriptor.dependencies],
      state: initialState,
      changedAt: this.clock().toISOString(),
    };
    this.capabilities.set(descriptor.id, snapshot);
    return this.cloneSnapshot(snapshot);
  }

  /**
   * Read one capability snapshot.
   *
   * @param capabilityId Capability to retrieve.
   * @returns A defensive snapshot copy.
   */
  public get(capabilityId: CapabilityId): CapabilitySnapshot {
    const snapshot = this.capabilities.get(capabilityId);
    if (snapshot === undefined) {
      throw new Error(`Capability '${capabilityId}' is not registered.`);
    }
    return this.cloneSnapshot(snapshot);
  }

  /**
   * List all capabilities in deterministic registration order.
   *
   * @returns Defensive copies of all capability snapshots.
   */
  public list(): readonly CapabilitySnapshot[] {
    return [...this.capabilities.values()].map((snapshot) => this.cloneSnapshot(snapshot));
  }

  /**
   * Move a capability to a valid lifecycle state and notify observers.
   *
   * @param capabilityId Capability being transitioned.
   * @param nextState Requested lifecycle state.
   * @param options Optional structured error and metadata.
   * @returns The updated immutable snapshot.
   */
  public transition(
    capabilityId: CapabilityId,
    nextState: CapabilityState,
    options: CapabilityTransitionOptions = {},
  ): CapabilitySnapshot {
    const current = this.get(capabilityId);
    if (current.state === nextState) {
      return current;
    }
    if (!ALLOWED_TRANSITIONS[current.state].includes(nextState)) {
      throw new Error(`Invalid capability transition '${capabilityId}': ${current.state} -> ${nextState}.`);
    }
    if (nextState === "error" && options.error === undefined) {
      throw new Error(`Capability '${capabilityId}' requires a structured error for the error state.`);
    }

    const next: CapabilitySnapshot = {
      id: current.id,
      displayName: current.displayName,
      runtime: current.runtime,
      optional: current.optional,
      dependencies: [...current.dependencies],
      state: nextState,
      changedAt: this.clock().toISOString(),
      ...(options.error === undefined ? {} : { error: { ...options.error } }),
      ...(options.metadata === undefined ? {} : { metadata: { ...options.metadata } }),
    };
    this.capabilities.set(capabilityId, next);
    this.notify(next);
    return this.cloneSnapshot(next);
  }

  /**
   * Subscribe to capability transitions.
   *
   * @param listener Observer that receives the changed capability.
   * @returns A function that removes the observer.
   */
  public subscribe(listener: CapabilityRegistryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all current observers without allowing one observer to stop delivery.
   *
   * @param snapshot Capability state that changed.
   */
  private notify(snapshot: CapabilitySnapshot): void {
    for (const listener of this.listeners) {
      try {
        listener(this.cloneSnapshot(snapshot));
      } catch {
        // Observers own their failures; registry state must remain committed.
      }
    }
  }

  /**
   * Clone serializable snapshot fields so callers cannot mutate registry state.
   *
   * @param snapshot Internal snapshot to copy.
   * @returns A defensive copy suitable for IPC serialization.
   */
  private cloneSnapshot(snapshot: CapabilitySnapshot): CapabilitySnapshot {
    return {
      ...snapshot,
      dependencies: [...snapshot.dependencies],
      ...(snapshot.error === undefined ? {} : { error: { ...snapshot.error } }),
      ...(snapshot.metadata === undefined ? {} : { metadata: { ...snapshot.metadata } }),
    };
  }
}
