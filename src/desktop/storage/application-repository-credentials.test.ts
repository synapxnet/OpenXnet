import assert from "node:assert/strict";
import test from "node:test";

import type { ApplicationRepositoryCredentials } from "../contracts/application-repository-credentials";
import { ApplicationRepositoryCredentialService } from "./application-repository-credentials";
import type { ApplicationRepositoryCredentialStore } from "./safe-storage-repository-credential-store";

/** In-memory repository credential store used by service tests. */
class MemoryRepositoryCredentialStore implements ApplicationRepositoryCredentialStore {
  public credentials: ApplicationRepositoryCredentials = {};

  /** Create one configurable encrypted-store test double. */
  public constructor(private readonly available = true) {}

  /** Report whether the synthetic protected backend is available. */
  public isAvailable(): boolean { return this.available; }

  /** Return the current in-memory repository credential map. */
  public read(): ApplicationRepositoryCredentials { return this.credentials; }

  /** Replace the current in-memory repository credential map. */
  public write(credentials: ApplicationRepositoryCredentials): void { this.credentials = credentials; }

  /** Remove every in-memory repository credential. */
  public clear(): void { this.credentials = {}; }
}

test("ApplicationRepositoryCredentialService saves exact fields and returns names only", () => {
  const store = new MemoryRepositoryCredentialStore();
  const service = new ApplicationRepositoryCredentialService({ credentials: store });
  try {
    const snapshot = service.save({
      credentials: {
        gitee_token: "gitee-secret",
        github_token: "github-secret",
      },
    });
    assert.deepEqual(snapshot.configured, ["gitee_token", "github_token"]);
    assert.equal(JSON.stringify(snapshot).includes("gitee-secret"), false);
    assert.throws(
      () => service.save({ credentials: { EI2_api_key: "wrong-zone" } }),
      /field is invalid/,
    );
  } finally {
    service.close();
  }
});

test("ApplicationRepositoryCredentialService migrates only repository tokens", () => {
  const store = new MemoryRepositoryCredentialStore();
  const service = new ApplicationRepositoryCredentialService({ credentials: store });
  const settings = {
    BotConfig: {
      gitee_repo_owner: "gitee-owner",
      gitee_repo_name: "gitee-repository",
      gitee_token: "gitee-secret",
      gitee_branch: "master",
      github_repo_owner: "github-owner",
      github_repo_name: "github-repository",
      github_token: "github-secret",
      github_branch: "main",
      SMMS_api_key: "image-host-remains-separate",
    },
  };
  try {
    const result = service.reconcileLegacySettings(settings, { requireSecureCapture: true });
    const redacted = result.settings as typeof settings;
    assert.equal(result.persistSanitized, true);
    assert.equal(redacted.BotConfig.gitee_token, "");
    assert.equal(redacted.BotConfig.github_token, "");
    assert.equal(redacted.BotConfig.gitee_repo_owner, "gitee-owner");
    assert.equal(redacted.BotConfig.github_repo_name, "github-repository");
    assert.equal(redacted.BotConfig.SMMS_api_key, "image-host-remains-separate");
    assert.deepEqual(
      (redacted.BotConfig as Record<string, unknown>).repositoryCredentialFieldsConfigured,
      ["gitee_token", "github_token"],
    );
    assert.deepEqual(store.credentials, {
      gitee_token: "gitee-secret",
      github_token: "github-secret",
    });
  } finally {
    service.close();
  }
});

test("ApplicationRepositoryCredentialService preserves plaintext without secure capture", () => {
  const service = new ApplicationRepositoryCredentialService({
    credentials: new MemoryRepositoryCredentialStore(false),
  });
  const settings = { BotConfig: { github_token: "github-secret" } };
  try {
    const readResult = service.reconcileLegacySettings(settings);
    assert.equal(readResult.persistSanitized, false);
    assert.equal((readResult.settings.BotConfig as Record<string, unknown>).github_token, "");
    assert.throws(
      () => service.reconcileLegacySettings(settings, { requireSecureCapture: true }),
      /encryption is unavailable/,
    );
  } finally {
    service.close();
  }
});

test("ApplicationRepositoryCredentialService clears one field without changing another", () => {
  const store = new MemoryRepositoryCredentialStore();
  store.credentials = {
    gitee_token: "gitee-secret",
    github_token: "github-secret",
  };
  const service = new ApplicationRepositoryCredentialService({ credentials: store });
  try {
    const snapshot = service.save({ clear: ["gitee_token"] });
    assert.deepEqual(snapshot.configured, ["github_token"]);
    assert.deepEqual(store.credentials, { github_token: "github-secret" });
  } finally {
    service.close();
  }
});

test("ApplicationRepositoryCredentialService exposes no runtime bootstrap", () => {
  const service = new ApplicationRepositoryCredentialService({
    credentials: new MemoryRepositoryCredentialStore(),
  });
  try {
    assert.equal("getRuntimeCredentialBootstrap" in service, false);
    assert.equal("subscribe" in service, false);
  } finally {
    service.close();
  }
});
