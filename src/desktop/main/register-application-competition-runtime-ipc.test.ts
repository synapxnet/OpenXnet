import assert from "node:assert/strict";
import test from "node:test";

import { APPLICATION_COMPETITION_RUNTIME_CHANNELS } from "../contracts/application-competition-runtime";
import { registerApplicationCompetitionRuntimeIpc } from "./register-application-competition-runtime-ipc";

/** 构建可观测 IPC 替身；无输入，返回 handler Map 和注册接口。 */
function createIpcHarness() {
  const handlers = new Map<string, (event: unknown, request?: unknown) => unknown>();
  return {
    handlers,
    ipcMain: {
      handle: (channel: string, handler: (event: unknown, request?: unknown) => unknown) => {
        handlers.set(channel, handler);
      },
      removeHandler: (channel: string) => {
        handlers.delete(channel);
      },
    },
  };
}

test("competition Runtime IPC authorizes and forwards every bounded operation", async () => {
  const harness = createIpcHarness();
  const calls: string[] = [];
  const forwardedActors: string[] = [];
  let authorizations = 0;
  const runtime = {
    getSnapshot: async () => ({ operation: "getSnapshot" }),
    resetDemoData: async () => ({ operation: "resetDemoData" }),
    createIncident: async () => ({ operation: "createIncident" }),
    runInvestigation: async () => ({ operation: "runInvestigation" }),
    decideApproval: async () => ({ operation: "decideApproval" }),
    executeRollback: async () => ({ operation: "executeRollback" }),
    verifyRemediation: async () => ({ operation: "verifyRemediation" }),
    readResource: async () => ({ operation: "readResource" }),
    exportRetrospective: async () => ({ operation: "exportRetrospective" }),
    setAdapterMode: async () => ({ operation: "setAdapterMode" }),
  };
  const proxy = new Proxy(runtime, {
    /** 记录被调用方法；输入目标、属性和接收者，返回包装后的原方法。 */
    get(target, property, receiver) {
      const original = Reflect.get(target, property, receiver) as (...args: unknown[]) => Promise<unknown>;
      return async (...args: unknown[]) => {
        calls.push(String(property));
        const request = args[0];
        if (typeof request === "object" && request !== null && "actorId" in request) {
          forwardedActors.push(String((request as { actorId: unknown }).actorId));
        }
        return original(...args);
      };
    },
  });
  const cleanup = registerApplicationCompetitionRuntimeIpc({
    ipcMain: harness.ipcMain as never,
    runtime: proxy as never,
    authorizeEvent: () => {
      authorizations += 1;
    },
    resolveActorId: (role) => `trusted:${role}`,
  });
  const channels = Object.entries(APPLICATION_COMPETITION_RUNTIME_CHANNELS);
  assert.equal(harness.handlers.size, channels.length);
  for (const [, channel] of channels) {
    const handler = harness.handlers.get(channel);
    assert.notEqual(handler, undefined);
    await handler?.({}, {});
  }
  assert.equal(authorizations, channels.length);
  assert.equal(calls.length, channels.length);
  assert.deepEqual(forwardedActors.sort(), [
    "trusted:approver",
    "trusted:investigator",
    "trusted:investigator",
    "trusted:operator",
    "trusted:verifier",
  ]);
  cleanup();
  assert.equal(harness.handlers.size, 0);
});
