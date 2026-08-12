import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  APPLICATION_STORE_SCHEMA_VERSION,
  ApplicationDocumentConflictError,
  ApplicationStore,
  MAX_APPLICATION_DOCUMENT_BYTES,
} from "./application-store";

test("ApplicationStore migrates, persists, and enforces optimistic revisions", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-application-store-"));
  const databasePath = path.join(directory, "desktop-core.db");
  try {
    const firstStore = new ApplicationStore({
      databasePath,
      now: () => new Date("2026-07-23T01:02:03.000Z"),
    });
    assert.equal(firstStore.getSchemaVersion(), APPLICATION_STORE_SCHEMA_VERSION);
    const first = firstStore.setDocument("system-settings", { theme: "dark" }, 0);
    assert.equal(first.revision, 1);
    assert.equal(first.updatedAt, "2026-07-23T01:02:03.000Z");
    assert.throws(
      () => firstStore.setDocument("system-settings", { theme: "light" }, 0),
      ApplicationDocumentConflictError,
    );
    const second = firstStore.setDocument("system-settings", { theme: "light" }, 1);
    assert.equal(second.revision, 2);
    firstStore.close();

    const reopenedStore = new ApplicationStore({ databasePath });
    assert.deepEqual(reopenedStore.getDocument("system-settings"), {
      key: "system-settings",
      revision: 2,
      value: { theme: "light" },
      updatedAt: second.updatedAt,
    });
    assert.equal(reopenedStore.deleteDocument("system-settings", 2), true);
    assert.equal(reopenedStore.getDocument("system-settings"), null);
    assert.equal(reopenedStore.deleteDocument("system-settings"), false);
    assert.throws(
      () => reopenedStore.deleteDocument("system-settings", 2),
      ApplicationDocumentConflictError,
    );
    reopenedStore.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("ApplicationStore rejects invalid keys, circular values, oversized JSON, and corrupt rows", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-application-store-invalid-"));
  const databasePath = path.join(directory, "desktop-core.db");
  try {
    const store = new ApplicationStore({ databasePath });
    assert.throws(() => store.setDocument("Invalid Key", {}), /key is invalid/);
    const circular: { self?: unknown } = {};
    circular.self = circular;
    assert.throws(() => store.setDocument("circular", circular), /JSON serializable/);
    assert.throws(
      () => store.setDocument("oversized", "x".repeat(MAX_APPLICATION_DOCUMENT_BYTES + 1)),
      /storage budget/,
    );
    store.setDocument("corrupt", { valid: true });
    store.close();

    const database = new DatabaseSync(databasePath);
    database.prepare(
      "UPDATE application_documents SET payload = ? WHERE document_key = ?",
    ).run("{invalid", "corrupt");
    database.close();

    const reopenedStore = new ApplicationStore({ databasePath });
    assert.throws(() => reopenedStore.getDocument("corrupt"), /contains invalid JSON/);
    reopenedStore.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("ApplicationStore upgrades a version-one database without changing documents", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-application-store-upgrade-"));
  const databasePath = path.join(directory, "desktop-core.db");
  try {
    const legacyDatabase = new DatabaseSync(databasePath);
    legacyDatabase.exec(`
      CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      ) STRICT;
      CREATE TABLE application_documents (
        document_key TEXT PRIMARY KEY,
        revision INTEGER NOT NULL CHECK (revision >= 1),
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;
      INSERT INTO schema_migrations (version, name, applied_at)
      VALUES (1, 'create-application-documents', '2026-07-22T00:00:00.000Z');
      INSERT INTO application_documents (document_key, revision, payload, updated_at)
      VALUES ('system-settings', 1, '{"theme":"ink"}', '2026-07-22T00:00:00.000Z');
    `);
    legacyDatabase.close();

    const upgraded = new ApplicationStore({ databasePath });
    assert.equal(upgraded.getSchemaVersion(), APPLICATION_STORE_SCHEMA_VERSION);
    assert.deepEqual(upgraded.getDocument("system-settings")?.value, { theme: "ink" });
    upgraded.close();

    const inspected = new DatabaseSync(databasePath, { readOnly: true });
    const artifactTable = inspected.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'application_artifacts'",
    ).get();
    const taskTable = inspected.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'application_tasks'",
    ).get();
    inspected.close();
    assert.ok(artifactTable !== undefined);
    assert.ok(taskTable !== undefined);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
