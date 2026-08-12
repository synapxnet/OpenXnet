import type { CapabilityId, CapabilityState } from "../contracts/capability";
import type { DesktopCore } from "./desktop-core";
import {
  type WorkerDefinition,
  type WorkerProcessSnapshot,
  type WorkerSupervisor,
} from "../workers/worker-supervisor";

/** Dependencies used to bind one supervised worker to a Core capability. */
export interface RegisterWorkerCapabilityOptions {
  readonly core: DesktopCore;
  readonly supervisor: WorkerSupervisor;
  readonly definition: WorkerDefinition;
  readonly beforeStart?: () => Promise<void>;
}

/**
 * Register a worker command as a lazily activated Desktop Core capability.
 *
 * @param options Core, supervisor, and launch definition dependencies.
 * @returns Cleanup function that removes lifecycle synchronization.
 */
export function registerWorkerCapability(options: RegisterWorkerCapabilityOptions): () => void {
  const { core, supervisor, definition } = options;
  supervisor.register(definition);

  /** Start the worker and return serializable activation metadata to Core. */
  async function activateWorker(): Promise<Readonly<Record<string, unknown>>> {
    await options.beforeStart?.();
    const snapshot = await supervisor.start(definition.capability);
    return {
      processId: snapshot.processId,
      runtime: "worker",
    };
  }

  /** Synchronize supervisor lifecycle changes into the public Core state machine. */
  function synchronizeState(snapshot: WorkerProcessSnapshot): void {
    if (snapshot.capability !== definition.capability) {
      return;
    }
    const currentState = core.getCapability(definition.capability).state;
    switch (snapshot.state) {
      case "starting":
        transitionWhen(core, definition.capability, currentState, ["stopped", "error"], "starting");
        break;
      case "ready":
        transitionWhen(core, definition.capability, currentState, ["starting", "degraded"], "ready", {
          processId: snapshot.processId,
        });
        break;
      case "stopping":
        transitionWhen(core, definition.capability, currentState, ["ready", "degraded"], "stopping");
        break;
      case "stopped":
        transitionWhen(core, definition.capability, currentState, ["starting", "stopping", "error"], "stopped");
        break;
      case "error":
        transitionToError(core, definition.capability, currentState, snapshot.error);
        break;
    }
  }

  const unsubscribe = supervisor.subscribe(synchronizeState);
  core.registerActivator(definition.capability, activateWorker);
  return unsubscribe;
}

/**
 * Apply a state transition only when the current state is explicitly allowed.
 *
 * @param core Desktop Core receiving the transition.
 * @param capability Capability being synchronized.
 * @param currentState Current public Core state.
 * @param allowedStates States from which the transition is valid.
 * @param nextState Target public Core state.
 * @param metadata Optional worker process metadata.
 */
function transitionWhen(
  core: DesktopCore,
  capability: CapabilityId,
  currentState: CapabilityState,
  allowedStates: readonly CapabilityState[],
  nextState: CapabilityState,
  metadata?: Readonly<Record<string, unknown>>,
): void {
  if (!allowedStates.includes(currentState)) {
    return;
  }
  core.setCapabilityState(
    capability,
    nextState,
    metadata === undefined ? {} : { metadata },
  );
}

/**
 * Convert a supervisor failure into a structured retryable Core capability error.
 *
 * @param core Desktop Core receiving the failure.
 * @param capability Capability whose worker failed.
 * @param currentState Current public Core state.
 * @param message Supervisor diagnostic message.
 */
function transitionToError(
  core: DesktopCore,
  capability: CapabilityId,
  currentState: CapabilityState,
  message: string | null,
): void {
  if (!["starting", "ready", "degraded", "stopping"].includes(currentState)) {
    return;
  }
  core.setCapabilityState(capability, "error", {
    error: {
      code: "WORKER_PROCESS_FAILED",
      message: message ?? `Worker '${capability}' failed without a diagnostic.`,
      retryable: true,
    },
  });
}
