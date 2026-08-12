/** Legacy 后端生命周期协调器所需的进程控制边界。 */
export interface LegacyBackendLifecycleOptions {
  readonly isBackendActive: () => boolean;
  readonly isApplicationQuitting: () => boolean;
  readonly stopBackend: () => Promise<void>;
  readonly startBackend: () => Promise<void>;
}

/** 协调 legacy 后端的预期退出和凭据刷新，避免停止与启动并发执行。 */
export class LegacyBackendLifecycleCoordinator {
  private readonly expectedExits = new WeakSet<object>();
  private credentialRevision = 0;
  private credentialRefreshPromise: Promise<void> | null = null;
  private restartAfterCredentialRefresh = false;

  /** 创建协调器；输入后端状态和启停函数，不立即启动任何进程。 */
  public constructor(private readonly options: LegacyBackendLifecycleOptions) {}

  /** 标记即将主动停止的进程；输入进程对象，无返回值。 */
  public markExpectedExit(process: object): void {
    this.expectedExits.add(process);
  }

  /** 消费进程的预期退出标记；输入进程对象，仅第一次返回 true。 */
  public consumeExpectedExit(process: object): boolean {
    const expected = this.expectedExits.has(process);
    if (expected) {
      this.expectedExits.delete(process);
    }
    return expected;
  }

  /**
   * 调度一次凭据刷新；活动后端会在停止完成后重新启动，并合并停止期间的重复刷新。
   *
   * @returns 本轮串行刷新完成后的 Promise；后端未启动时立即完成。
   */
  public scheduleCredentialRefresh(): Promise<void> {
    this.credentialRevision += 1;
    if (this.options.isBackendActive() || this.credentialRefreshPromise !== null) {
      this.restartAfterCredentialRefresh = true;
    }
    if (!this.restartAfterCredentialRefresh) {
      return Promise.resolve();
    }
    if (this.credentialRefreshPromise !== null) {
      return this.credentialRefreshPromise;
    }

    const operation = this.runCredentialRefresh();
    this.credentialRefreshPromise = operation;
    void operation.then(
      () => this.releaseCredentialRefresh(operation),
      () => this.releaseCredentialRefresh(operation),
    );
    return operation;
  }

  /** 串行停止和启动后端；停止期间的新凭据会直接进入同一次启动。 */
  private async runCredentialRefresh(): Promise<void> {
    try {
      while (this.restartAfterCredentialRefresh && !this.options.isApplicationQuitting()) {
        if (this.options.isBackendActive()) {
          await this.options.stopBackend();
        }
        if (this.options.isApplicationQuitting()) {
          return;
        }

        const startupRevision = this.credentialRevision;
        await this.options.startBackend();
        if (startupRevision === this.credentialRevision) {
          return;
        }
      }
    } finally {
      this.restartAfterCredentialRefresh = false;
    }
  }

  /** 释放已完成的刷新任务；输入任务 Promise，避免旧任务覆盖新任务引用。 */
  private releaseCredentialRefresh(operation: Promise<void>): void {
    if (this.credentialRefreshPromise === operation) {
      this.credentialRefreshPromise = null;
    }
  }
}
