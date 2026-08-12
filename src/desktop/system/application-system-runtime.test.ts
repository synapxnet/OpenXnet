import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os, { type NetworkInterfaceInfo } from "node:os";
import path from "node:path";
import test from "node:test";

import { DEFAULT_SYSTEM_SETTINGS, type SystemSettings } from "../contracts/application-settings";
import { ApplicationSystemRuntimeService } from "./application-system-runtime";

/** 创建 Runtime 测试使用的完整系统设置；输入覆盖字段，返回规范设置。 */
function createSettings(overrides: Partial<SystemSettings> = {}): SystemSettings {
  return { ...DEFAULT_SYSTEM_SETTINGS, ...overrides };
}

test("System Runtime applies bounded proxy settings without returning the proxy value", async () => {
  const environment: NodeJS.ProcessEnv = {};
  const configurations: unknown[] = [];
  let invalidations = 0;
  const runtime = new ApplicationSystemRuntimeService({
    userDataDirectory: os.tmpdir(),
    extensionDirectory: path.join(os.tmpdir(), "extensions"),
    readSettings: () => createSettings({
      proxyMode: "manual",
      proxy: "http://127.0.0.1:7890",
      isChinaProxy: true,
    }),
    applySessionProxy: async (configuration) => {
      configurations.push(configuration);
    },
    revealPath: async () => "",
    invalidateRuntimes: async () => {
      invalidations += 1;
    },
    listNetworkInterfaces: () => ({}),
    environment,
  });

  const result = await runtime.applyProxy();
  assert.deepEqual(configurations, [{
    mode: "fixed_servers",
    proxyRules: "http://127.0.0.1:7890",
  }]);
  assert.deepEqual(result, { success: true, mode: "manual", chinaMirror: true });
  assert.equal("proxy" in result, false);
  assert.equal(environment.HTTPS_PROXY, "http://127.0.0.1:7890");
  assert.equal(environment.npm_config_registry, "https://registry.npmmirror.com/");
  assert.equal(invalidations, 1);
});

test("System Runtime applies direct mode and rejects unsupported manual proxy URLs", async () => {
  const environment: NodeJS.ProcessEnv = { HTTPS_PROXY: "old", UV_INDEX_URL: "old" };
  let settings = createSettings({ proxyMode: "none", proxy: "" });
  const runtime = new ApplicationSystemRuntimeService({
    userDataDirectory: os.tmpdir(),
    extensionDirectory: path.join(os.tmpdir(), "extensions"),
    readSettings: () => settings,
    applySessionProxy: async () => undefined,
    revealPath: async () => "",
    invalidateRuntimes: async () => undefined,
    listNetworkInterfaces: () => ({}),
    environment,
  });

  assert.deepEqual(await runtime.applyProxy(), {
    success: true,
    mode: "none",
    chinaMirror: false,
  });
  assert.equal(environment.HTTPS_PROXY, "");
  assert.equal(environment.UV_INDEX_URL, undefined);
  settings = createSettings({ proxyMode: "manual", proxy: "socks5://127.0.0.1:1080" });
  await assert.rejects(runtime.applyProxy(), /manual proxy is invalid/);
});

test("System Runtime reveals fixed directories and returns the first public IPv4 address", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "openxnet-system-runtime-"));
  const revealed: string[] = [];
  const ipv4 = {
    address: "192.168.10.8",
    netmask: "255.255.255.0",
    family: "IPv4",
    mac: "00:00:00:00:00:00",
    internal: false,
    cidr: "192.168.10.8/24",
  } as NetworkInterfaceInfo;
  const runtime = new ApplicationSystemRuntimeService({
    userDataDirectory: root,
    extensionDirectory: path.join(root, "ext"),
    readSettings: () => createSettings(),
    applySessionProxy: async () => undefined,
    revealPath: async (directoryPath) => {
      revealed.push(directoryPath);
      return "";
    },
    invalidateRuntimes: async () => undefined,
    listNetworkInterfaces: () => ({ Ethernet: [ipv4] }),
  });
  try {
    assert.deepEqual(await runtime.revealDirectory({ directory: "logs" }), { opened: true });
    assert.equal(revealed[0], path.join(root, "logs"));
    assert.deepEqual(runtime.getNetworkAddress(), { address: "192.168.10.8" });
    await assert.rejects(
      runtime.revealDirectory({ directory: "arbitrary", path: "C:\\secret" }),
      /directory request is invalid|directory is invalid/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
