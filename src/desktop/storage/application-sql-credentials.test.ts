import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { tmpdir } from "node:os";
import { mkdtempSync } from "node:fs";

import type { ApplicationSqlCredentials } from "../contracts/application-sql-credentials";
import { ApplicationSqlCredentialService } from "./application-sql-credentials";
import type { ApplicationSqlCredentialStore } from "./safe-storage-sql-credential-store";

/** 提供内存 SQL 密钥存储；测试可观察写入，但不会触碰系统 safeStorage。 */
class MemorySqlCredentialStore implements ApplicationSqlCredentialStore {
  public value: ApplicationSqlCredentials = {};

  /** 返回测试加密能力状态；无输入，始终返回 true，无副作用。 */
  public isAvailable(): boolean {
    return true;
  }

  /** 读取内存密钥；无输入，返回分离副本，无副作用。 */
  public read(): ApplicationSqlCredentials {
    return { ...this.value };
  }

  /** 替换内存密钥；输入密钥，无返回，仅修改测试状态。 */
  public write(credentials: ApplicationSqlCredentials): void {
    this.value = { ...credentials };
  }

  /** 清空内存密钥；无输入和返回，仅修改测试状态。 */
  public clear(): void {
    this.value = {};
  }
}

/** 创建隔离 SQL 服务；输入选择路径，返回服务和内存存储，测试结束由临时目录机制清理。 */
function createService(selectedPath: string) {
  const root = mkdtempSync(path.join(tmpdir(), "openxnet-sql-"));
  const credentials = new MemorySqlCredentialStore();
  const service = new ApplicationSqlCredentialService({
    credentials,
    authorizationPath: path.join(root, "authorization.json"),
    selectSqliteDatabase: async () => selectedPath,
  });
  return { root, credentials, service };
}

test("SQL service migrates legacy passwords into its private runtime bootstrap", () => {
  const root = mkdtempSync(path.join(tmpdir(), "openxnet-sql-migrate-"));
  const databasePath = path.join(root, "workspace.db");
  writeFileSync(databasePath, "sqlite-test", "utf8");
  const { credentials, service } = createService(databasePath);
  const result = service.reconcileLegacySettings({
    sqlSettings: {
      engine: "postgres",
      password: "database-secret",
      dbPath: "legacy.db",
      dbpath: "",
    },
  }, { requireSecureCapture: true });
  assert.equal(credentials.value.password, "database-secret");
  assert.equal((result.settings.sqlSettings as Record<string, unknown>).password, "");
  assert.equal((result.settings.sqlSettings as Record<string, unknown>).dbpath, "legacy.db");
  assert.equal("dbPath" in (result.settings.sqlSettings as Record<string, unknown>), false);
  assert.equal(JSON.stringify(result.settings).includes("database-secret"), false);
  service.close();
});

test("SQL service authorizes only a selected SQLite file and keeps its path out of the snapshot ID", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "openxnet-sql-select-"));
  mkdirSync(root, { recursive: true });
  const databasePath = path.join(root, "workspace.sqlite3");
  writeFileSync(databasePath, "sqlite-test", "utf8");
  const { service } = createService(databasePath);
  service.save({ credentials: { password: "database-secret" } });
  const snapshot = await service.selectDatabase();
  assert.match(snapshot.database?.databaseId ?? "", /^[0-9a-f-]{36}$/i);
  assert.equal(snapshot.database?.displayPath, databasePath);
  assert.deepEqual(snapshot.configured, ["password"]);
  const runtime = JSON.parse(Buffer.from(service.getRuntimeCredentialBootstrap(), "base64").toString("utf8"));
  assert.equal(runtime.credentials.password, "database-secret");
  assert.equal(runtime.databases[snapshot.database?.databaseId ?? ""], databasePath);
  assert.equal(readFileSync(path.join(path.dirname(databasePath), "workspace.sqlite3"), "utf8"), "sqlite-test");
  service.close();
});
