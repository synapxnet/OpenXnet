import type { CapabilityState } from "../contracts/capability";
import type { DesktopCore } from "./desktop-core";
import {
  type ExecutionEngineSnapshot,
  type ExecutionEngineSupervisor,
} from "../workers/execution-engine-supervisor";

/** Dependencies used to bind the supervised engine to Desktop Core. */
export interface RegisterExecutionEngineCapabilityOptions {
  readonly core: DesktopCore;
  readonly supervisor: ExecutionEngineSupervisor;
}

/**
 * Register lazy execution-engine activation and synchronize idle lifecycle state.
 *
 * @param options Core and execution-engine supervisor dependencies.
 * @returns Cleanup function that removes lifecycle synchronization.
 */
export function registerExecutionEngineCapability(
  options: RegisterExecutionEngineCapabilityOptions,
): () => void {
  const { core, supervisor } = options;

  /** Start the engine without exposing its private loopback origin to Renderer state. */
  async function activateEngine(): Promise<Readonly<Record<string, unknown>>> {
    const snapshot = await supervisor.start();
    return { processId: snapshot.processId, runtime: "execution-engine" };
  }

  /** Synchronize supervisor transitions into the public capability state machine. */
  function synchronizeState(snapshot: ExecutionEngineSnapshot): void {
    const currentState = core.getCapability("execution-engine").state;
    switch (snapshot.state) {
      case "starting":
        transitionWhen(currentState, ["stopped", "error"], "starting");
        break;
      case "ready":
        transitionWhen(currentState, ["starting", "degraded"], "ready", {
          processId: snapshot.processId,
          runtime: "execution-engine",
        });
        break;
      case "stopping":
        transitionWhen(currentState, ["ready", "degraded"], "stopping");
        break;
      case "stopped":
        transitionWhen(currentState, ["starting", "stopping", "error"], "stopped");
        break;
      case "error":
        transitionToError(currentState, snapshot.error);
        break;
    }
  }

  /** Apply a lifecycle transition only from explicitly valid source states. */
  function transitionWhen(
    currentState: CapabilityState,
    allowedStates: readonly CapabilityState[],
    nextState: CapabilityState,
    metadata?: Readonly<Record<string, unknown>>,
  ): void {
    if (!allowedStates.includes(currentState)) {
      return;
    }
    core.setCapabilityState(
      "execution-engine",
      nextState,
      metadata === undefined ? {} : { metadata },
    );
  }

  /** Convert a supervisor failure into a retryable Core capability error. */
  function transitionToError(currentState: CapabilityState, message: string | null): void {
    if (!["starting", "ready", "degraded", "stopping"].includes(currentState)) {
      return;
    }
    core.setCapabilityState("execution-engine", "error", {
      error: {
        code: "EXECUTION_ENGINE_FAILED",
        message: message ?? "Execution Engine failed without a diagnostic.",
        retryable: true,
      },
    });
  }

  const unsubscribe = supervisor.subscribe(synchronizeState);
  core.registerActivator("execution-engine", activateEngine);
  return unsubscribe;
}
