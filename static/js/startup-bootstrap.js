(function initializeOpenXnetStartup(global) {
  "use strict";

  const milestones = [];
  const deferredTasks = new Map();
  const deferredTaskQueue = [];
  const startedAt = performance.now();
  let bootstrapSummary = null;
  let deferredWorkReleased = false;
  let deferredTaskDrainScheduled = false;
  let resolveDeferredWork = null;
  const deferredWorkPromise = new Promise((resolve) => {
    resolveDeferredWork = resolve;
  });

  /**
   * Record one bounded Renderer startup milestone.
   *
   * @param {string} name Stable milestone name.
   * @param {Record<string, unknown>} detail Optional non-secret measurement detail.
   */
  function mark(name, detail = {}) {
    const normalizedName = String(name || "").trim();
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(normalizedName) || milestones.length >= 64) {
      return;
    }
    milestones.push({
      name: normalizedName,
      elapsedMs: Number((performance.now() - startedAt).toFixed(2)),
      detail: detail && typeof detail === "object" && !Array.isArray(detail) ? detail : {},
    });
  }

  /**
   * Apply Core-owned theme fields before the legacy Vue application mounts.
   *
   * @param {unknown} snapshot Candidate Desktop bootstrap snapshot.
   */
  function applyBootstrapTheme(snapshot) {
    const settings = snapshot?.systemSettings?.settings;
    if (!settings || typeof settings !== "object") {
      return;
    }
    const theme = String(settings.theme || "party");
    const domTheme = typeof global.normalizeOpenXnetThemeForDom === "function"
      ? global.normalizeOpenXnetThemeForDom(theme)
      : theme;
    document.documentElement.setAttribute("data-theme", domTheme);
    document.documentElement.setAttribute("data-theme-choice", theme);
    try {
      global.localStorage?.setItem("openxnet-theme", theme);
    } catch (error) {
      console.warn("Failed to persist bootstrap theme:", error);
    }
  }

  /** Return a serializable, non-secret startup measurement snapshot. */
  function snapshot() {
    const copiedMilestones = [];
    for (const milestone of milestones) {
      copiedMilestones.push({ ...milestone });
    }
    const copiedDeferredTasks = [];
    for (const entry of deferredTasks.values()) {
      copiedDeferredTasks.push({
        name: entry.name,
        status: entry.status,
        scheduledAtMs: entry.scheduledAtMs,
        startedAtMs: entry.startedAtMs,
        completedAtMs: entry.completedAtMs,
      });
    }
    return {
      elapsedMs: Number((performance.now() - startedAt).toFixed(2)),
      milestones: copiedMilestones,
      bootstrap: bootstrapSummary,
      deferredTasks: copiedDeferredTasks,
      precompiledRender: typeof global.openxnetCompiledRender === "function",
    };
  }

  /**
   * Wait until the first interactive workspace frame has been handed to Main.
   *
   * @returns {Promise<void>} Completion when deferred mounted work may begin.
   */
  function whenWorkspaceReady() {
    return deferredWorkPromise;
  }

  /** Release deferred mounted work once, after the first frame can paint. */
  function releaseDeferredWork() {
    if (deferredWorkReleased) {
      return;
    }
    deferredWorkReleased = true;
    mark("deferred-work-released");
    resolveDeferredWork?.();
    resolveDeferredWork = null;
  }

  /** Schedule the next deferred task after the browser yields an idle slice. */
  function scheduleDeferredTaskDrain() {
    if (deferredTaskDrainScheduled || deferredTaskQueue.length === 0) {
      return;
    }
    deferredTaskDrainScheduled = true;
    void whenWorkspaceReady().then(() => {
      /** Continue the queue after the browser grants an idle slice. */
      const runNextTask = () => {
        deferredTaskDrainScheduled = false;
        runNextDeferredTask();
      };
      if (typeof global.requestIdleCallback === "function") {
        global.requestIdleCallback(runNextTask, { timeout: 1500 });
        return;
      }
      global.setTimeout(runNextTask, 16);
    });
  }

  /** Start one queued task and yield again before starting the following task. */
  function runNextDeferredTask() {
    const entry = deferredTaskQueue.shift();
    if (!entry) {
      return;
    }
    entry.status = "running";
    entry.startedAtMs = Number((performance.now() - startedAt).toFixed(2));
    mark(`idle-${entry.name}-start`);
    try {
      Promise.resolve(entry.task()).then(
        (result) => completeDeferredTask(entry, "completed", result),
        (error) => completeDeferredTask(entry, "failed", error),
      );
    } catch (error) {
      completeDeferredTask(entry, "failed", error);
    }
    scheduleDeferredTaskDrain();
  }

  /**
   * Complete one deferred task and settle the promise returned to its owner.
   *
   * @param {Record<string, unknown>} entry Deferred task record.
   * @param {'completed'|'failed'} status Final task status.
   * @param {unknown} result Task result or failure.
   */
  function completeDeferredTask(entry, status, result) {
    entry.status = status;
    entry.completedAtMs = Number((performance.now() - startedAt).toFixed(2));
    mark(`idle-${entry.name}-${status}`);
    if (status === "completed") {
      entry.resolve(result);
      return;
    }
    entry.reject(result);
  }

  /**
   * Queue non-critical work once and start it in a later browser idle slice.
   *
   * @param {string} name Stable task identifier used for deduplication and diagnostics.
   * @param {() => unknown|Promise<unknown>} task Deferred work callback.
   * @returns {Promise<unknown>} Shared completion promise for the named task.
   */
  function scheduleIdleTask(name, task) {
    const normalizedName = String(name || "").trim();
    if (!/^[a-z][a-z0-9-]{0,47}$/.test(normalizedName)) {
      return Promise.reject(new TypeError("Deferred task name is invalid."));
    }
    if (typeof task !== "function") {
      return Promise.reject(new TypeError(`Deferred task '${normalizedName}' is not callable.`));
    }
    const existingEntry = deferredTasks.get(normalizedName);
    if (existingEntry) {
      return existingEntry.promise;
    }

    const entry = {
      name: normalizedName,
      task,
      status: "scheduled",
      scheduledAtMs: Number((performance.now() - startedAt).toFixed(2)),
      startedAtMs: null,
      completedAtMs: null,
      resolve: null,
      reject: null,
      promise: null,
    };
    entry.promise = new Promise((resolve, reject) => {
      entry.resolve = resolve;
      entry.reject = reject;
    });
    deferredTasks.set(normalizedName, entry);
    deferredTaskQueue.push(entry);
    mark(`idle-${normalizedName}-scheduled`);
    scheduleDeferredTaskDrain();
    return entry.promise;
  }

  /** Record completion of HTML parsing. */
  function handleDomContentLoaded() {
    mark("dom-content-loaded");
  }

  /** Record completion of all eager window resources. */
  function handleWindowLoaded() {
    mark("window-loaded");
  }

  /**
   * Cache and apply one successful Core bootstrap snapshot.
   *
   * @param {unknown} bootstrap Desktop bootstrap response.
   * @returns {unknown} Original response for downstream consumers.
   */
  function handleBootstrapReady(bootstrap) {
    bootstrapSummary = {
      schema: bootstrap?.schema || null,
      settingsRevision: Number(bootstrap?.systemSettings?.revision || 0),
      coreProtocolVersion: bootstrap?.core?.protocolVersion || null,
    };
    applyBootstrapTheme(bootstrap);
    mark("core-bootstrap-ready", { settingsRevision: bootstrapSummary.settingsRevision });
    return bootstrap;
  }

  /**
   * Convert a bootstrap failure into a non-blocking null snapshot.
   *
   * @param {unknown} error Bootstrap request failure.
   * @returns {null} Null compatibility result.
   */
  function handleBootstrapFailure(error) {
    mark("core-bootstrap-failed");
    console.error("Desktop bootstrap snapshot failed:", error);
    return null;
  }

  mark("head-bootstrap-start");
  document.addEventListener("DOMContentLoaded", handleDomContentLoaded, { once: true });
  global.addEventListener("load", handleWindowLoaded, { once: true });

  const bootstrapPromise = typeof global.openxnetDesktop?.getBootstrapSnapshot === "function"
    ? global.openxnetDesktop.getBootstrapSnapshot()
      .then(handleBootstrapReady)
      .catch(handleBootstrapFailure)
    : Promise.resolve(null);

  Object.defineProperty(global, "openxnetBootstrapPromise", {
    configurable: false,
    enumerable: false,
    writable: false,
    value: bootstrapPromise,
  });
  Object.defineProperty(global, "openxnetStartup", {
    configurable: false,
    enumerable: false,
    writable: false,
    value: Object.freeze({
      mark,
      releaseDeferredWork,
      scheduleIdleTask,
      snapshot,
      whenWorkspaceReady,
    }),
  });
}(window));
