import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface, type Interface as ReadlineInterface } from "node:readline";

import type { CapabilityId } from "../contracts/capability";
import {
  createWorkerEnvelope,
  parseWorkerEnvelope,
  type WorkerEnvelope,
} from "../contracts/worker-protocol";

/** Lifecycle states owned by the worker process supervisor. */
export type WorkerProcessState = "stopped" | "starting" | "ready" | "stopping" | "error";

/** Declarative command used to start one capability worker. */
export interface WorkerDefinition {
  readonly capability: CapabilityId;
  readonly command: string;
  readonly arguments?: readonly string[];
  readonly workingDirectory?: string;
  readonly environment?: Readonly<NodeJS.ProcessEnv> | (() => Readonly<NodeJS.ProcessEnv>);
  readonly requestTimeoutMs?: number;
  readonly shutdownTimeoutMs?: number;
  readonly idleTimeoutMs?: number;
}

/** Observable state emitted when a managed worker changes lifecycle state. */
export interface WorkerProcessSnapshot {
  readonly capability: CapabilityId;
  readonly state: WorkerProcessState;
  readonly processId: number | null;
  readonly error: string | null;
}

/** Listener invoked after a worker process state transition. */
export type WorkerProcessListener = (snapshot: WorkerProcessSnapshot) => void;

/** Listener invoked for one validated uncorrelated worker event. */
export type WorkerEventListener = (event: WorkerEnvelope) => void;

interface PendingRequest {
  readonly resolve: (envelope: WorkerEnvelope) => void;
  readonly reject: (error: Error) => void;
  readonly timeout: NodeJS.Timeout;
}

interface ManagedWorker {
  readonly definition: WorkerDefinition;
  readonly pendingRequests: Map<string, PendingRequest>;
  process: ChildProcessWithoutNullStreams | null;
  output: ReadlineInterface | null;
  state: WorkerProcessState;
  error: string | null;
  startup: Promise<WorkerProcessSnapshot> | null;
  idleTimer: NodeJS.Timeout | null;
}

/**
 * Error returned when a worker responds with a structured protocol failure.
 */
export class WorkerRequestError extends Error {
  /**
   * Create a request error from a worker response.
   *
   * @param code Stable worker error code.
   * @param message Human-readable worker failure.
   * @param retryable Whether retrying the request may succeed.
   */
  public constructor(
    public readonly code: string,
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "WorkerRequestError";
  }
}

/**
 * Supervise optional capability workers and correlate protocol requests.
 */
export class WorkerSupervisor {
  private readonly workers = new Map<CapabilityId, ManagedWorker>();
  private readonly listeners = new Set<WorkerProcessListener>();
  private readonly eventListeners = new Set<WorkerEventListener>();

  /**
   * Register a worker command without starting its process.
   *
   * @param definition Worker launch and timeout configuration.
   */
  public register(definition: WorkerDefinition): void {
    if (this.workers.has(definition.capability)) {
      throw new Error(`Worker '${definition.capability}' is already registered.`);
    }
    if (!definition.command.trim()) {
      throw new Error(`Worker '${definition.capability}' requires a command.`);
    }
    this.workers.set(definition.capability, {
      definition,
      pendingRequests: new Map(),
      process: null,
      output: null,
      state: "stopped",
      error: null,
      startup: null,
      idleTimer: null,
    });
  }

  /**
   * Read the current process state of one registered worker.
   *
   * @param capability Capability implemented by the worker.
   * @returns Serializable worker process snapshot.
   */
  public getSnapshot(capability: CapabilityId): WorkerProcessSnapshot {
    return this.snapshot(this.getWorker(capability));
  }

  /**
   * List process state for all registered workers.
   *
   * @returns Worker snapshots in deterministic registration order.
   */
  public listSnapshots(): readonly WorkerProcessSnapshot[] {
    return [...this.workers.values()].map((worker) => this.snapshot(worker));
  }

  /**
   * Subscribe to worker lifecycle transitions.
   *
   * @param listener Observer invoked after state changes.
   * @returns Function that removes the observer.
   */
  public subscribe(listener: WorkerProcessListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Subscribe to validated event envelopes emitted outside request correlation.
   *
   * @param listener Observer invoked for each worker event.
   * @returns Function that removes the observer.
   */
  public subscribeEvents(listener: WorkerEventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /**
   * Start a worker once and verify protocol readiness with a ping request.
   *
   * @param capability Capability implemented by the worker.
   * @returns Ready worker process snapshot.
   */
  public async start(capability: CapabilityId): Promise<WorkerProcessSnapshot> {
    const worker = this.getWorker(capability);
    if (worker.state === "ready") {
      return this.snapshot(worker);
    }
    if (worker.startup !== null) {
      return worker.startup;
    }

    const startup = this.spawnAndHandshake(worker);
    worker.startup = startup;
    try {
      return await startup;
    } finally {
      worker.startup = null;
    }
  }

  /**
   * Send a correlated request to a starting or ready worker.
   *
   * @param capability Target worker capability.
   * @param method Worker method name.
   * @param payload Serializable request payload.
   * @returns Successful response payload.
   */
  public async request(
    capability: CapabilityId,
    method: string,
    payload: Readonly<Record<string, unknown>> = {},
  ): Promise<Readonly<Record<string, unknown>>> {
    const worker = this.getWorker(capability);
    const canRequest = worker.state === "starting"
      || worker.state === "ready"
      || (worker.state === "stopping" && method === "system.shutdown");
    if (worker.process === null || !canRequest) {
      throw new Error(`Worker '${capability}' is not running.`);
    }

    const tracksActivity = !method.startsWith("system.");
    if (tracksActivity) {
      this.clearIdleTimer(worker);
    }
    try {
      const envelope = createWorkerEnvelope({ kind: "request", capability, method, payload });
      const response = await this.writeRequest(worker, envelope);
      if (response.kind === "error") {
        const error = response.error;
        throw new WorkerRequestError(
          error?.code ?? "WORKER_ERROR",
          error?.message ?? `Worker '${capability}' returned an unspecified error.`,
          error?.retryable ?? false,
        );
      }
      if (response.kind !== "response") {
        throw new Error(`Worker '${capability}' returned '${response.kind}' for a request.`);
      }
      return response.payload;
    } finally {
      if (tracksActivity && worker.state === "ready") {
        this.scheduleIdleStop(worker);
      }
    }
  }

  /**
   * Gracefully stop a worker and force termination after its configured timeout.
   *
   * @param capability Capability implemented by the worker.
   */
  public async stop(capability: CapabilityId): Promise<void> {
    const worker = this.getWorker(capability);
    this.clearIdleTimer(worker);
    const child = worker.process;
    if (child === null || worker.state === "stopped") {
      return;
    }

    this.setState(worker, "stopping", null);
    const exitPromise = this.waitForExit(child, worker.definition.shutdownTimeoutMs ?? 3_000);
    try {
      await this.request(capability, "system.shutdown");
      await exitPromise;
    } catch {
      if (!child.killed) {
        child.kill();
      }
      await this.waitForExit(child, 1_000).catch(() => undefined);
    } finally {
      this.releaseProcess(worker);
      this.setState(worker, "stopped", null);
    }
  }

  /**
   * Stop all registered workers while allowing every stop attempt to complete.
   */
  public async stopAll(): Promise<void> {
    await Promise.allSettled([...this.workers.keys()].map((capability) => this.stop(capability)));
  }

  /**
   * Spawn one worker and complete only after a successful protocol ping.
   *
   * @param worker Mutable worker record being started.
   * @returns Ready worker snapshot.
   */
  private async spawnAndHandshake(worker: ManagedWorker): Promise<WorkerProcessSnapshot> {
    if (worker.process !== null) {
      throw new Error(`Worker '${worker.definition.capability}' already owns a process.`);
    }
    this.setState(worker, "starting", null);
    const environment = typeof worker.definition.environment === "function"
      ? worker.definition.environment()
      : worker.definition.environment;
    const child = spawn(worker.definition.command, [...(worker.definition.arguments ?? [])], {
      cwd: worker.definition.workingDirectory,
      env: { ...process.env, ...environment },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    worker.process = child;
    worker.output = createInterface({ input: child.stdout, crlfDelay: Number.POSITIVE_INFINITY });
    worker.output.on("line", this.handleLine.bind(this, worker));
    child.on("exit", this.handleExit.bind(this, worker));
    child.stderr.on("data", this.handleDiagnostic.bind(this, worker));

    try {
      await this.waitForSpawn(child);
      await this.request(worker.definition.capability, "system.ping");
      this.setState(worker, "ready", null);
      this.scheduleIdleStop(worker);
      return this.snapshot(worker);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.rejectPendingRequests(worker, new Error(message));
      if (!child.killed) {
        child.kill();
      }
      this.releaseProcess(worker);
      this.setState(worker, "error", message);
      throw error;
    }
  }

  /**
   * Write one request line and await its correlated response or timeout.
   *
   * @param worker Running worker record.
   * @param envelope Request envelope to send.
   * @returns Correlated response envelope.
   */
  private writeRequest(worker: ManagedWorker, envelope: WorkerEnvelope): Promise<WorkerEnvelope> {
    const child = worker.process;
    if (child === null || !child.stdin.writable) {
      return Promise.reject(new Error(`Worker '${worker.definition.capability}' stdin is not writable.`));
    }
    const timeoutMs = worker.definition.requestTimeoutMs ?? 10_000;
    return new Promise<WorkerEnvelope>((resolve, reject) => {
      const timeout = setTimeout(() => {
        worker.pendingRequests.delete(envelope.messageId);
        reject(new Error(`Worker '${worker.definition.capability}' request '${envelope.method}' timed out.`));
      }, timeoutMs);
      worker.pendingRequests.set(envelope.messageId, { resolve, reject, timeout });
      child.stdin.write(`${JSON.stringify(envelope)}\n`, "utf8", (error) => {
        if (error !== null && error !== undefined) {
          const pending = worker.pendingRequests.get(envelope.messageId);
          if (pending !== undefined) {
            clearTimeout(pending.timeout);
            worker.pendingRequests.delete(envelope.messageId);
            pending.reject(error);
          }
        }
      });
    });
  }

  /**
   * Parse one worker output line and resolve its pending request.
   *
   * @param worker Worker that emitted the line.
   * @param line UTF-8 protocol line.
   */
  private handleLine(worker: ManagedWorker, line: string): void {
    let envelope: WorkerEnvelope;
    try {
      envelope = parseWorkerEnvelope(line);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.setState(worker, "error", message);
      return;
    }
    if (envelope.kind === "event") {
      this.notifyEvent(envelope);
      return;
    }
    const pending = worker.pendingRequests.get(envelope.messageId);
    if (pending === undefined) {
      return;
    }
    clearTimeout(pending.timeout);
    worker.pendingRequests.delete(envelope.messageId);
    pending.resolve(envelope);
  }

  /** Notify worker-event observers without allowing one observer to stop delivery. */
  private notifyEvent(envelope: WorkerEnvelope): void {
    for (const listener of this.eventListeners) {
      try {
        listener(envelope);
      } catch {
        // Event observers own their failures; worker supervision must continue.
      }
    }
  }

  /**
   * Convert unexpected worker termination into state and pending-request failures.
   *
   * @param worker Worker whose process exited.
   * @param code Process exit code.
   * @param signal Process termination signal.
   */
  private handleExit(worker: ManagedWorker, code: number | null, signal: NodeJS.Signals | null): void {
    const wasStopping = worker.state === "stopping";
    const message = `Worker '${worker.definition.capability}' exited with code ${String(code)} and signal ${String(signal)}.`;
    this.rejectPendingRequests(worker, new Error(message));
    this.releaseProcess(worker);
    this.setState(worker, wasStopping ? "stopped" : "error", wasStopping ? null : message);
  }

  /**
   * Forward worker diagnostics to stderr without mixing them into protocol stdout.
   *
   * @param worker Worker that emitted diagnostics.
   * @param chunk Diagnostic byte chunk.
   */
  private handleDiagnostic(worker: ManagedWorker, chunk: Buffer): void {
    const text = chunk.toString("utf8").trim();
    if (text) {
      process.stderr.write(`[worker:${worker.definition.capability}] ${text}\n`);
    }
  }

  /**
   * Wait for the operating system to report a successfully spawned process.
   *
   * @param child Child process being started.
   */
  private waitForSpawn(child: ChildProcessWithoutNullStreams): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      child.once("spawn", resolve);
      child.once("error", reject);
    });
  }

  /**
   * Wait for process exit and reject when the shutdown deadline expires.
   *
   * @param child Child process being stopped.
   * @param timeoutMs Maximum wait duration.
   */
  private waitForExit(child: ChildProcessWithoutNullStreams, timeoutMs: number): Promise<void> {
    if (child.exitCode !== null || child.signalCode !== null) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Worker shutdown timed out.")), timeoutMs);
      child.once("exit", () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  /**
   * Reject and clear all requests awaiting a response from one worker.
   *
   * @param worker Worker whose requests can no longer complete.
   * @param error Failure returned to every pending caller.
   */
  private rejectPendingRequests(worker: ManagedWorker, error: Error): void {
    for (const pending of worker.pendingRequests.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    worker.pendingRequests.clear();
  }

  /**
   * Close stream resources and release a worker process reference.
   *
   * @param worker Worker record to release.
   */
  private releaseProcess(worker: ManagedWorker): void {
    this.clearIdleTimer(worker);
    worker.output?.close();
    worker.output = null;
    worker.process = null;
  }

  /**
   * Schedule automatic shutdown after the worker remains unused for its idle budget.
   *
   * @param worker Ready worker whose activity window should be tracked.
   */
  private scheduleIdleStop(worker: ManagedWorker): void {
    this.clearIdleTimer(worker);
    const idleTimeoutMs = worker.definition.idleTimeoutMs ?? 0;
    if (idleTimeoutMs <= 0 || worker.state !== "ready") {
      return;
    }
    worker.idleTimer = setTimeout(() => {
      worker.idleTimer = null;
      void this.stop(worker.definition.capability).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.setState(worker, "error", message);
      });
    }, idleTimeoutMs);
    worker.idleTimer.unref?.();
  }

  /**
   * Cancel a pending idle shutdown before activity or explicit lifecycle changes.
   *
   * @param worker Worker whose idle timer should be cleared.
   */
  private clearIdleTimer(worker: ManagedWorker): void {
    if (worker.idleTimer !== null) {
      clearTimeout(worker.idleTimer);
      worker.idleTimer = null;
    }
  }

  /**
   * Apply a worker state transition and notify observers.
   *
   * @param worker Worker record being updated.
   * @param state New process state.
   * @param error Optional failure summary.
   */
  private setState(worker: ManagedWorker, state: WorkerProcessState, error: string | null): void {
    worker.state = state;
    worker.error = error;
    const snapshot = this.snapshot(worker);
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch {
        // A lifecycle observer cannot prevent supervisor cleanup or state commits.
      }
    }
  }

  /**
   * Resolve one registered worker or fail with a stable diagnostic.
   *
   * @param capability Capability used as the worker key.
   * @returns Mutable worker record owned by this supervisor.
   */
  private getWorker(capability: CapabilityId): ManagedWorker {
    const worker = this.workers.get(capability);
    if (worker === undefined) {
      throw new Error(`Worker '${capability}' is not registered.`);
    }
    return worker;
  }

  /**
   * Create a serializable worker snapshot for clients and observers.
   *
   * @param worker Internal worker record.
   * @returns Defensive process snapshot.
   */
  private snapshot(worker: ManagedWorker): WorkerProcessSnapshot {
    return {
      capability: worker.definition.capability,
      state: worker.state,
      processId: worker.process?.pid ?? null,
      error: worker.error,
    };
  }
}
