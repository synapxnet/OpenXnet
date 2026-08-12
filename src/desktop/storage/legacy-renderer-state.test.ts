import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  LEGACY_RENDERER_STATE_CHANGED_SCHEMA,
  LEGACY_RENDERER_STATE_SCHEMA,
  type LegacyRendererStateChangedEvent,
} from "../contracts/legacy-renderer-state";
import { LegacyRendererStateService } from "./legacy-renderer-state";

/** Read one raw JSON document using the legacy Python table shape. */
function readLegacyDocument(databasePath: string): Readonly<Record<string, unknown>> {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const row = database.prepare("SELECT data FROM settings WHERE id = 1").get() as { data: string };
    return JSON.parse(row.data) as Readonly<Record<string, unknown>>;
  } finally {
    database.close();
  }
}

test("LegacyRendererStateService reads and writes Python-compatible SQLite without eager creation", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-legacy-renderer-state-"));
  const settingsPath = path.join(directory, "super_agent_party.db");
  const conversationsPath = path.join(directory, "conversations.db");
  const service = new LegacyRendererStateService({
    userDataDirectory: directory,
    now: () => new Date("2026-07-26T08:00:00.000Z"),
  });
  const events: LegacyRendererStateChangedEvent[] = [];
  const unsubscribe = service.subscribe((event) => events.push(event));
  try {
    const initial = service.getSnapshot();
    assert.equal(initial.schema, LEGACY_RENDERER_STATE_SCHEMA);
    assert.equal(initial.generatedAt, "2026-07-26T08:00:00.000Z");
    assert.deepEqual(initial.settings, {});
    assert.deepEqual(initial.conversations, []);
    assert.equal(existsSync(settingsPath), false);
    assert.equal(existsSync(conversationsPath), false);

    const settings = service.saveSettings({
      settings: {
        mainAgent: "openxnet-model",
        nested: { enabled: true },
        conversations: [{ id: "embedded-conversation", messages: [] }],
      },
    });
    assert.equal(service.getSnapshot().conversations[0]?.id, "embedded-conversation");
    const conversations = service.saveConversations({
      conversations: [{ id: "conversation-1", messages: [] }],
    });
    const vrm = service.saveVrmConfig({ vrmConfig: { selectedModel: "model.vrm" } });

    assert.equal(settings.settingsRevision, 1);
    assert.equal(conversations.conversationsRevision, 1);
    assert.equal(vrm.settingsRevision, 2);
    assert.deepEqual(readLegacyDocument(settingsPath), {
      mainAgent: "openxnet-model",
      nested: { enabled: true },
      conversations: [{ id: "embedded-conversation", messages: [] }],
      VRMConfig: { selectedModel: "model.vrm" },
    });
    assert.deepEqual(readLegacyDocument(conversationsPath), {
      conversations: [{ id: "conversation-1", messages: [] }],
    });
    assert.equal(events.length, 3);
    assert.ok(events.every((event) => event.schema === LEGACY_RENDERER_STATE_CHANGED_SCHEMA));
  } finally {
    unsubscribe();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("LegacyRendererStateService rejects request drift and unbounded compatibility payloads", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-legacy-renderer-state-"));
  const service = new LegacyRendererStateService({ userDataDirectory: directory });
  try {
    assert.throws(
      () => service.saveSettings({ settings: {}, unexpected: true }),
      /fields are invalid/,
    );
    assert.throws(
      () => service.saveConversations({ conversations: new Array(10_001).fill({}) }),
      /conversations are invalid/,
    );
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    assert.throws(
      () => service.saveSettings({ settings: circular }),
      /JSON serializable/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("LegacyRendererStateService persists only normalized provider-safe settings", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-legacy-provider-redaction-"));
  const settingsPath = path.join(directory, "super_agent_party.db");
  const operations: string[] = [];
  const service = new LegacyRendererStateService({
    userDataDirectory: directory,
    normalizeSettings: (settings, operation) => {
      operations.push(operation);
      return {
        settings: {
          ...settings,
          api_key: "",
          api_key_configured: Boolean(settings.api_key),
        },
        persistSanitized: true,
      };
    },
  });
  try {
    const saved = service.saveSettings({ settings: { api_key: "provider-secret" } });
    assert.equal(saved.settings.api_key, "");
    const stored = readLegacyDocument(settingsPath);
    assert.equal(stored.api_key, "");
    assert.equal(JSON.stringify(stored).includes("provider-secret"), false);
    assert.ok(operations.includes("write"));
    assert.ok(operations.includes("read"));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
