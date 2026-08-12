import assert from "node:assert/strict";
import test from "node:test";

import type { CapabilityId } from "../contracts/capability";
import { ApplicationDesktopControlRuntimeService } from "./application-desktop-control-runtime";

const RECT = { left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 };
const WINDOW = {
  hwnd: 1234,
  title: "Editor",
  className: "EditorWindow",
  processId: 99,
  processName: "editor.exe",
  visible: true,
  minimized: false,
  maximized: false,
  isActive: true,
  alwaysOnTop: false,
  rect: RECT,
};
const MONITOR = {
  handle: 1,
  index: 0,
  deviceName: "DISPLAY1",
  label: "Primary",
  isPrimary: true,
  bounds: RECT,
  workArea: RECT,
};

/** 记录 capability 激活，不启动真实 Worker。 */
class TestCore {
  public activations: CapabilityId[] = [];

  /** 记录激活请求；输入 capability，返回空元数据，无其他副作用。 */
  public async ensureCapability(capability: CapabilityId): Promise<never> {
    this.activations.push(capability);
    return undefined as never;
  }
}

/** 返回固定 Desktop Control Worker 响应并记录请求。 */
class TestSupervisor {
  public readonly requests: Array<{ method: string; payload: Readonly<Record<string, unknown>> }> = [];

  /** 分派固定响应；输入 capability、方法和载荷，返回对应 schema，未知方法时抛出 Error。 */
  public async request(
    capability: CapabilityId,
    method: string,
    payload: Readonly<Record<string, unknown>>,
  ): Promise<Readonly<Record<string, unknown>>> {
    assert.equal(capability, "desktop-control");
    this.requests.push({ method, payload });
    if (method === "desktop_control.list_windows") {
      return { schema: "openxnet.desktop-control-windows.v1", count: 1, windows: [WINDOW] };
    }
    if (method === "desktop_control.list_monitors") {
      return { schema: "openxnet.desktop-control-monitors.v1", count: 1, monitors: [MONITOR] };
    }
    if (method === "desktop_control.get_active_window") {
      return {
        schema: "openxnet.desktop-control-active-window.v1",
        found: true,
        supported: true,
        detectedAt: "2026-07-29T00:00:00Z",
        reason: "",
        window: WINDOW,
      };
    }
    if (method === "desktop_control.list_history") {
      return {
        schema: "openxnet.desktop-control-history.v1",
        count: 1,
        generatedAt: "2026-07-29T00:00:01Z",
        items: [{
          id: "history-1",
          title: "完成",
          summary: "已完成操作",
          status: "completed",
          statusLabel: "Completed",
          action: "focus",
          actionLabel: "聚焦",
          hwnd: 1234,
          window: WINDOW,
          monitor: MONITOR,
          position: "",
          timestamp: "2026-07-29T00:00:00Z",
        }],
      };
    }
    if (method === "desktop_control.execute_action") {
      return {
        schema: "openxnet.desktop-control-action.v1",
        success: true,
        action: "focus",
        window: WINDOW,
        monitor: null,
        position: "",
      };
    }
    throw new Error("Unknown test method.");
  }
}

test("desktop control Runtime activates only its Worker and returns path-free results", async () => {
  const core = new TestCore();
  const supervisor = new TestSupervisor();
  const runtime = new ApplicationDesktopControlRuntimeService({ core, supervisor });

  const windows = await runtime.listWindows({ limit: 10 });
  const monitors = await runtime.listMonitors();
  const active = await runtime.getActiveWindow();
  const history = await runtime.listHistory({ limit: 8 });
  const action = await runtime.executeAction({ action: "focus", hwnd: 1234, payload: {} });

  assert.equal(windows.windows[0]?.processName, "editor.exe");
  assert.equal(monitors.monitors[0]?.isPrimary, true);
  assert.equal(active.window?.title, "Editor");
  assert.equal(history.items[0]?.actionLabel, "聚焦");
  assert.equal(action.success, true);
  assert.deepEqual(core.activations, Array(5).fill("desktop-control"));
  assert.ok(supervisor.requests.every((request) => !JSON.stringify(request.payload).includes("path")));
});

test("desktop control Runtime rejects malformed requests before Worker activation", async () => {
  const core = new TestCore();
  const supervisor = new TestSupervisor();
  const runtime = new ApplicationDesktopControlRuntimeService({ core, supervisor });

  await assert.rejects(runtime.listWindows({ limit: 101 }), /limit/i);
  await assert.rejects(runtime.executeAction({ action: "move", hwnd: 0, payload: { x: 1, y: 2 } }), /hwnd/i);
  assert.equal(core.activations.length, 0);
  assert.equal(supervisor.requests.length, 0);
});

test("desktop control Runtime rejects Worker response path fields", async () => {
  const core = new TestCore();
  const runtime = new ApplicationDesktopControlRuntimeService({
    core,
    supervisor: {
      request: async () => ({
        schema: "openxnet.desktop-control-windows.v1",
        count: 1,
        windows: [{ ...WINDOW, processPath: "C:\\private\\editor.exe" }],
      }),
    },
  });

  await assert.rejects(runtime.listWindows({}), /fields/i);
  assert.deepEqual(core.activations, ["desktop-control"]);
});
