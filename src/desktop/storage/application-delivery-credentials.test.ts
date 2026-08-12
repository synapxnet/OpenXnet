import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createApplicationDeliveryCredentialScopeId,
  type ApplicationDeliveryCredentials,
} from "../contracts/application-delivery-credentials";
import { ApplicationDeliveryCredentialService } from "./application-delivery-credentials";
import type { ApplicationDeliveryCredentialStore } from "./safe-storage-delivery-credential-store";

/** In-memory protected delivery credential store used by service tests. */
class MemoryDeliveryCredentialStore implements ApplicationDeliveryCredentialStore {
  public credentials: ApplicationDeliveryCredentials = {};
  public available = true;
  public readFailure = false;

  /** Report whether the synthetic protected backend is available. */
  public isAvailable(): boolean { return this.available; }

  /** Return the current in-memory scoped credential map. */
  public read(): ApplicationDeliveryCredentials {
    if (this.readFailure) throw new Error("Synthetic encrypted store failure.");
    return this.credentials;
  }

  /** Replace the current in-memory scoped credential map. */
  public write(credentials: ApplicationDeliveryCredentials): void { this.credentials = credentials; }

  /** Remove every in-memory delivery credential scope. */
  public clear(): void { this.credentials = {}; }
}

test("delivery credential service returns configured-only metadata and one exact envelope", () => {
  const store = new MemoryDeliveryCredentialStore();
  const service = new ApplicationDeliveryCredentialService({
    credentials: store,
    logger: { warn: () => undefined },
  });
  const scope = {
    workspacePath: path.resolve("workspace"),
    taskId: "task-1",
    target: "webhook",
  } as const;
  try {
    const snapshot = service.save({
      scope,
      credentials: {
        url: "https://hooks.example.test/task-1",
        headers: { Authorization: "Bearer delivery-secret" },
      },
    });
    assert.deepEqual(snapshot.configured[0]?.fields, ["url"]);
    assert.deepEqual(snapshot.configured[0]?.headers, ["authorization"]);
    assert.equal(JSON.stringify(snapshot).includes("delivery-secret"), false);

    const envelope = JSON.parse(Buffer.from(
      service.getRequestCredentialBootstrap(scope),
      "base64",
    ).toString("utf8")) as Record<string, unknown>;
    assert.equal(envelope.schema, "openxnet.delivery-credentials.runtime.v1");
    assert.deepEqual(envelope.scope, scope);
    assert.match(JSON.stringify(envelope), /delivery-secret/);
    assert.equal(service.getRequestCredentialBootstrap({ ...scope, taskId: "task-2" }), "");

    assert.deepEqual(service.save({ scope, clear: true }).configured, []);
    assert.deepEqual(store.credentials, {});
  } finally {
    service.close();
  }
});

test("delivery credential service captures array and keyed legacy records without plaintext", () => {
  const store = new MemoryDeliveryCredentialStore();
  const service = new ApplicationDeliveryCredentialService({ credentials: store });
  const workspacePath = path.resolve("workspace");
  try {
    const result = service.reconcileTaskDetails(workspacePath, "legacy-task", {
      delivery_records: [{
        target: "webhook",
        config: {
          url: "https://hooks.example.test/array",
          headers: { "X-Delivery-Key": "array-secret" },
          method: "POST",
        },
      }],
      context: {
        delivery_records: {
          discord: { config: { webhook_url: "https://discord.example.test/keyed" } },
        },
      },
    }, { requireSecureCapture: true });
    assert.equal(result.persistSanitized, true);
    assert.equal(JSON.stringify(result.details).includes("array-secret"), false);
    assert.equal(JSON.stringify(result.details).includes("hooks.example.test"), false);
    assert.equal(JSON.stringify(result.details).includes("discord.example.test"), false);
    assert.match(JSON.stringify(result.details), /urlConfigured/);
    assert.match(JSON.stringify(result.details), /webhookUrlConfigured/);
    assert.equal(Object.keys(store.credentials).length, 2);

    const webhookScopeId = createApplicationDeliveryCredentialScopeId({
      workspacePath,
      taskId: "legacy-task",
      target: "webhook",
    });
    assert.equal(store.credentials[webhookScopeId]?.credentials.headers?.["x-delivery-key"], "array-secret");
    service.clearTask(workspacePath, "legacy-task");
    assert.deepEqual(store.credentials, {});
  } finally {
    service.close();
  }
});

test("delivery credential service rejects conflicting duplicate inline secrets", () => {
  const store = new MemoryDeliveryCredentialStore();
  const service = new ApplicationDeliveryCredentialService({ credentials: store });
  try {
    assert.throws(() => service.reconcileTaskDetails(path.resolve("workspace"), "task-1", {
      delivery_records: [{
        target: "webhook",
        config: { url: "https://hooks.example.test/first" },
      }, {
        target: "webhook",
        config: { url: "https://hooks.example.test/second" },
      }],
    }, { requireSecureCapture: true }), /entry is invalid/);
    assert.deepEqual(store.credentials, {});
  } finally {
    service.close();
  }
});

test("legacy task migration retries after protected storage becomes available", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-delivery-migration-"));
  const workspacePath = path.join(directory, "workspace");
  const taskDirectory = path.join(workspacePath, ".agent", "tasks");
  const taskPath = path.join(taskDirectory, "legacy-1.json");
  mkdirSync(taskDirectory, { recursive: true });
  writeFileSync(taskPath, JSON.stringify({
    task_id: "legacy-1",
    context: {
      delivery_records: {
        webhook: {
          config: {
            url: "https://hooks.example.test/migrate",
            headers: { Authorization: "Bearer migration-secret" },
          },
        },
      },
    },
  }), "utf8");
  const store = new MemoryDeliveryCredentialStore();
  store.available = false;
  const service = new ApplicationDeliveryCredentialService({
    credentials: store,
    logger: { warn: () => undefined },
  });
  try {
    assert.equal(service.migrateLegacyWorkspaceTasksFromSettings({
      CLISettings: { cc_path: workspacePath },
    }), 0);
    assert.match(readFileSync(taskPath, "utf8"), /migration-secret/);
    store.available = true;
    store.readFailure = true;
    assert.equal(service.migrateLegacyWorkspaceTasksFromSettings({
      CLISettings: { cc_path: workspacePath },
    }), 0);
    assert.match(readFileSync(taskPath, "utf8"), /migration-secret/);
    store.readFailure = false;
    assert.equal(service.migrateLegacyWorkspaceTasksFromSettings({
      CLISettings: { cc_path: workspacePath },
    }), 1);
    const sanitized = readFileSync(taskPath, "utf8");
    assert.equal(sanitized.includes("migration-secret"), false);
    assert.equal(sanitized.includes("hooks.example.test"), false);
  } finally {
    service.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
