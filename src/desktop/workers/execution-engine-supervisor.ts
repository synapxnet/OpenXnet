import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { request as createHttpRequest } from "node:http";
import { createInterface, type Interface as ReadlineInterface } from "node:readline";

/** Process lifecycle states owned by the execution-engine supervisor. */
export type ExecutionEngineState = "stopped" | "starting" | "ready" | "stopping" | "error";

/** Concrete command resolved immediately before an engine process starts. */
export interface ExecutionEngineLaunch {
  readonly command: string;
  readonly arguments?: readonly string[];
  readonly workingDirectory?: string;
  readonly environment?: Readonly<NodeJS.ProcessEnv>;
}

/** Configuration required to supervise the authenticated HTTP engine. */
export interface ExecutionEngineSupervisorOptions {
  readonly token: string;
  readonly createLaunch: () => ExecutionEngineLaunch | Promise<ExecutionEngineLaunch>;
  readonly startupTimeoutMs?: number;
  readonly shutdownTimeoutMs?: number;
  readonly idleTimeoutMs?: number;
}

/** Observable non-secret execution-engine process state. */
export interface ExecutionEngineSnapshot {
  readonly state: ExecutionEngineState;
  readonly processId: number | null;
  readonly activeRequests: number;
  readonly error: string | null;
}

/** Activity lease that prevents idle shutdown while one broker request is active. */
export interface ExecutionEngineLease {
  readonly origin: string;
  release(): void;
}

/** Listener invoked after an execution-engine lifecycle transition. */
export type ExecutionEngineListener = (snapshot: ExecutionEngineSnapshot) => void;

/** Error used when startup does not reach an authenticated health endpoint in time. */
class ExecutionEngineStartupError extends Error {
  /** Create one stable startup error without child-process diagnostics. */
  public constructor(message: string) {
    super(message);
    this.name = "ExecutionEngineStartupError";
  }
}

/**
 * Supervise the loopback execution engine and stop it after bounded inactivity.
 */
export class ExecutionEngineSupervisor {
  private readonly listeners = new Set<ExecutionEngineListener>();
  private process: ChildProcessWithoutNullStreams | null = null;
  private output: ReadlineInterface | null = null;
  private state: ExecutionEngineState = "stopped";
  private error: string | null = null;
  private originValue: string | null = null;
  private startup: Promise<ExecutionEngineSnapshot> | null = null;
  private idleTimer: NodeJS.Timeout | null = null;
  private activeRequests = 0;

  /**
   * Create an execution-engine supervisor with a process-scoped bearer token.
   *
   * @param options Launch factory, authentication, and lifecycle budgets.
   */
  public constructor(private readonly options: ExecutionEngineSupervisorOptions) {
    if (!options.token.trim()) {
      throw new Error("Execution Engine requires a non-empty bearer token.");
    }
  }

  /** Return the current non-secret process snapshot. */
  public getSnapshot(): ExecutionEngineSnapshot {
    return this.snapshot();
  }

  /** Subscribe to process lifecycle transitions. */
  public subscribe(listener: ExecutionEngineListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Start the engine once and wait for its authenticated health endpoint. */
  public async start(): Promise<ExecutionEngineSnapshot> {
    if (this.state === "ready" && this.process !== null && this.originValue !== null) {
      return this.snapshot();
    }
    if (this.startup !== null) {
      return this.startup;
    }
    const startup = this.spawnAndWaitForReadiness();
    this.startup = startup;
    try {
      return await startup;
    } finally {
      if (this.startup === startup) {
        this.startup = null;
      }
    }
  }

  /** Acquire one request lease, starting the engine when necessary. */
  public async acquire(): Promise<ExecutionEngineLease> {
    await this.start();
    if (this.state !== "ready" || this.originValue === null) {
      throw new Error("Execution Engine is not ready.");
    }
    this.clearIdleTimer();
    this.activeRequests += 1;
    this.notify();
    const origin = this.originValue;
    let released = false;
    return {
      origin,
      release: () => {
        if (released) {
          return;
        }
        released = true;
        this.activeRequests = Math.max(0, this.activeRequests - 1);
        this.notify();
        this.scheduleIdleStop();
      },
    };
  }

  /** Stop the engine and clear every lifecycle timer and request lease. */
  public async stop(): Promise<void> {
    this.clearIdleTimer();
    const child = this.process;
    if (child === null) {
      this.activeRequests = 0;
      this.originValue = null;
      this.setState("stopped", null);
      return;
    }
    this.setState("stopping", null);
    const exit = this.waitForExit(child, this.options.shutdownTimeoutMs ?? 5_000);
    child.kill();
    try {
      await exit;
    } catch {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL");
      }
      await this.waitForExit(child, 1_000).catch(() => undefined);
    } finally {
      if (this.process === child) {
        this.releaseProcess();
      }
      this.activeRequests = 0;
      this.setState("stopped", null);
    }
  }

  /** Spawn one process, parse its port handshake, and verify authenticated readiness. */
  private async spawnAndWaitForReadiness(): Promise<ExecutionEngineSnapshot> {
    const launch = await this.options.createLaunch();
    if (!launch.command.trim()) {
      throw new ExecutionEngineStartupError("Execution Engine launch command is empty.");
    }
    this.setState("starting", null);
    const child = spawn(launch.command, [...(launch.arguments ?? [])], {
      cwd: launch.workingDirectory,
      env: { ...process.env, ...launch.environment },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    this.process = child;
    const output = createInterface({ input: child.stdout, crlfDelay: Number.POSITIVE_INFINITY });
    this.output = output;
    child.on("exit", this.handleExit.bind(this, child));
    child.stderr.resume();

    try {
      await this.waitForSpawn(child);
      const origin = await this.waitForOrigin(child, output);
      await this.waitForHealthyOrigin(child, origin);
      if (this.process !== child) {
        throw new ExecutionEngineStartupError("Execution Engine exited during startup.");
      }
      this.originValue = origin;
      this.setState("ready", null);
      this.scheduleIdleStop();
      return this.snapshot();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!child.killed) {
        child.kill();
      }
      if (this.process === child) {
        this.releaseProcess();
      }
      this.setState("error", message);
      throw error;
    }
  }

  /** Resolve the loopback origin from the child process port handshake. */
  private waitForOrigin(
    child: ChildProcessWithoutNullStreams,
    output: ReadlineInterface,
  ): Promise<string> {
    const timeoutMs = this.options.startupTimeoutMs ?? 180_000;
    return new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new ExecutionEngineStartupError("Execution Engine port handshake timed out."));
      }, timeoutMs);
      const handleLine = (line: string): void => {
        const match = /^REAL_PORT_FOUND:(\d{1,5})$/.exec(line.trim());
        const port = match === null ? 0 : Number(match[1]);
        if (port < 1 || port > 65_535) {
          return;
        }
        cleanup();
        resolve(`http://127.0.0.1:${port}`);
      };
      const handleExit = (): void => {
        cleanup();
        reject(new ExecutionEngineStartupError("Execution Engine exited before its port handshake."));
      };
      const cleanup = (): void => {
        clearTimeout(timeout);
        output.off("line", handleLine);
        child.off("exit", handleExit);
      };
      output.on("line", handleLine);
      child.once("exit", handleExit);
    });
  }

  /** Poll the authenticated health endpoint until ASGI startup is complete. */
  private async waitForHealthyOrigin(
    child: ChildProcessWithoutNullStreams,
    origin: string,
  ): Promise<void> {
    const deadline = Date.now() + (this.options.startupTimeoutMs ?? 180_000);
    while (Date.now() < deadline) {
      if (this.process !== child || child.exitCode !== null || child.signalCode !== null) {
        throw new ExecutionEngineStartupError("Execution Engine exited before becoming healthy.");
      }
      if (await this.probeHealth(origin)) {
        return;
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 200));
    }
    throw new ExecutionEngineStartupError("Execution Engine health check timed out.");
  }

  /** Send one bounded bearer-authenticated health request. */
  private probeHealth(origin: string): Promise<boolean> {
    const target = new URL("/health", origin);
    return new Promise<boolean>((resolve) => {
      const request = createHttpRequest({
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port,
        path: target.pathname,
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.options.token}`,
          Connection: "close",
        },
      }, (response) => {
        response.resume();
        response.once("end", () => resolve(response.statusCode === 200));
      });
      request.setTimeout(1_000, () => request.destroy());
      request.once("error", () => resolve(false));
      request.end();
    });
  }

  /** Convert unexpected process termination into one stable lifecycle state. */
  private handleExit(
    child: ChildProcessWithoutNullStreams,
    code: number | null,
    signal: NodeJS.Signals | null,
  ): void {
    if (this.process !== child) {
      return;
    }
    const wasStopping = this.state === "stopping";
    this.releaseProcess();
    this.activeRequests = 0;
    this.setState(
      wasStopping ? "stopped" : "error",
      wasStopping ? null : `Execution Engine exited with code ${String(code)} and signal ${String(signal)}.`,
    );
  }

  /** Wait for the operating system to confirm that the child process spawned. */
  private waitForSpawn(child: ChildProcessWithoutNullStreams): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      child.once("spawn", resolve);
      child.once("error", reject);
    });
  }

  /** Wait for one process to exit within a bounded shutdown interval. */
  private waitForExit(child: ChildProcessWithoutNullStreams, timeoutMs: number): Promise<void> {
    if (child.exitCode !== null || child.signalCode !== null) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Execution Engine shutdown timed out.")), timeoutMs);
      child.once("exit", () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  /** Schedule an idle stop only when no broker request owns a lease. */
  private scheduleIdleStop(): void {
    this.clearIdleTimer();
    const idleTimeoutMs = this.options.idleTimeoutMs ?? 5 * 60_000;
    if (idleTimeoutMs <= 0 || this.state !== "ready" || this.activeRequests !== 0) {
      return;
    }
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      void this.stop().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.setState("error", message);
      });
    }, idleTimeoutMs);
    this.idleTimer.unref?.();
  }

  /** Cancel the current idle shutdown timer. */
  private clearIdleTimer(): void {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  /** Release child-process streams and forget the private loopback origin. */
  private releaseProcess(): void {
    this.clearIdleTimer();
    this.output?.close();
    this.output = null;
    this.process = null;
    this.originValue = null;
  }

  /** Apply one state transition and notify observers defensively. */
  private setState(state: ExecutionEngineState, error: string | null): void {
    this.state = state;
    this.error = error;
    this.notify();
  }

  /** Notify lifecycle observers without allowing one to interrupt supervision. */
  private notify(): void {
    const snapshot = this.snapshot();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch {
        // Observers own their failures; process cleanup must continue.
      }
    }
  }

  /** Build one serializable snapshot without exposing origin or credentials. */
  private snapshot(): ExecutionEngineSnapshot {
    return {
      state: this.state,
      processId: this.process?.pid ?? null,
      activeRequests: this.activeRequests,
      error: this.error,
    };
  }
}
