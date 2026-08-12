import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  bootstrapApplicationSettings,
  type ApplicationSettingsLogger,
} from "./application-settings-bootstrap";

test("bootstrap imports Python settings first, config runtime settings, and never overwrites Core", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-settings-bootstrap-"));
  const legacyDatabasePath = path.join(directory, "super_agent_party.db");
  const legacySettingsPath = path.join(directory, "settings.json");
  const legacyConfigPath = path.join(directory, "config.json");
  try {
    const legacyDatabase = new DatabaseSync(legacyDatabasePath);
    legacyDatabase.exec("CREATE TABLE settings (id INTEGER PRIMARY KEY, data TEXT NOT NULL)");
    legacyDatabase.prepare("INSERT INTO settings (id, data) VALUES (1, ?)").run(JSON.stringify({
      systemSettings: { language: "zh-CN", theme: "dark", network: "global" },
      chromeMCPSettings: { enabled: false, type: "external", CDPport: 9222 },
    }));
    legacyDatabase.close();
    writeFileSync(legacySettingsPath, JSON.stringify({
      preserved: "settings-value",
      systemSettings: { theme: "light" },
    }), "utf8");
    writeFileSync(legacyConfigPath, JSON.stringify({
      preserved: "config-value",
      networkVisible: "global",
      chromeMCPSettings: {
        enabled: true,
        mcpName: "playwright-mcp",
        type: "internal",
        CDPport: 9333,
      },
    }), "utf8");

    const first = bootstrapApplicationSettings({ userDataDirectory: directory });
    const imported = first.getSystemSettings();
    assert.equal(imported.revision, 1);
    assert.equal(imported.settings.language, "zh-CN");
    assert.equal(imported.settings.theme, "dark");
    assert.equal(imported.settings.network, "local");
    assert.deepEqual(first.getRuntimeSettings(), {
      networkVisible: "local",
      chromeMCPSettings: {
        enabled: true,
        mcpName: "playwright-mcp",
        type: "internal",
        CDPport: 9333,
      },
    });
    const saved = first.saveSystemSettings({
      settings: { ...imported.settings, theme: "neon" },
    });
    assert.equal(saved.revision, 2);
    assert.equal(first.saveSystemSettings({ settings: saved.settings }).revision, 2);
    first.close();

    const legacyDatabaseUpdate = new DatabaseSync(legacyDatabasePath);
    legacyDatabaseUpdate.prepare("UPDATE settings SET data = ? WHERE id = 1").run(JSON.stringify({
      systemSettings: { theme: "rainbow" },
    }));
    legacyDatabaseUpdate.close();
    writeFileSync(legacyConfigPath, JSON.stringify({
      chromeMCPSettings: { enabled: false, type: "external", CDPport: 9444 },
    }), "utf8");

    const reopened = bootstrapApplicationSettings({ userDataDirectory: directory });
    assert.equal(reopened.getSystemSettings().settings.theme, "neon");
    assert.equal(reopened.getRuntimeSettings().chromeMCPSettings.CDPport, 9333);
    reopened.saveRuntimeSettings({
      networkVisible: "global",
      chromeMCPSettings: {
        enabled: false,
        mcpName: "browser-mcp",
        type: "external",
        CDPport: 9555,
      },
    });
    reopened.close();

    const settingsMirror = JSON.parse(readFileSync(legacySettingsPath, "utf8")) as Record<string, unknown>;
    const configMirror = JSON.parse(readFileSync(legacyConfigPath, "utf8")) as Record<string, unknown>;
    assert.equal(settingsMirror.preserved, "settings-value");
    assert.equal((settingsMirror.systemSettings as { theme: string }).theme, "neon");
    assert.equal(configMirror.networkVisible, "local");
    assert.equal(
      (configMirror.chromeMCPSettings as { CDPport: number }).CDPport,
      9555,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("bootstrap exposes unpersisted defaults and ignores malformed legacy JSON", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-settings-defaults-"));
  const warnings: string[] = [];
  const logger: ApplicationSettingsLogger = {
    warn: (message) => warnings.push(message),
  };
  try {
    writeFileSync(path.join(directory, "settings.json"), "{invalid", "utf8");
    const settings = bootstrapApplicationSettings({ userDataDirectory: directory, logger });
    const snapshot = settings.getSystemSettings();
    assert.equal(snapshot.revision, 0);
    assert.equal(snapshot.updatedAt, null);
    assert.equal(snapshot.settings.network, "local");
    assert.equal(warnings.length, 1);
    settings.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
