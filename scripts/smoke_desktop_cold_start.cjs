"use strict";

const assert = require("node:assert/strict");
const {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  writeSync,
} = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { DatabaseSync } = require("node:sqlite");
const {
  checkStartupBudget,
  resolveStartupBudget,
} = require("./check_startup_budget.cjs");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const ELECTRON_TIMEOUT_MS = Number(process.env.OPENXNET_COLD_START_SMOKE_TIMEOUT_MS || 120_000);
const STARTUP_SETTLE_MS = 2_500;
const PROVIDER_SMOKE_SECRET = "phase3s-provider-secret";
const SEARCH_SMOKE_SECRET = "phase3u-search-secret";
const VOICE_SMOKE_SECRET = "phase3v-voice-secret";
const MCP_SMOKE_SECRET = "phase3w-mcp-secret";
const HTTP_TOOL_SMOKE_SECRET = "phase3w-http-tool-secret";
const CONNECTOR_SMOKE_SECRET = "phase3x-connector-secret";
const TELEGRAM_SMOKE_SECRET = "123456:phase3y-telegram-secret";
const IMAGE_HOST_SMOKE_SECRET = "phase3z-image-host-secret";
const REPOSITORY_SMOKE_SECRET = "phase3aa-repository-secret";
const LIVE_PLATFORM_SMOKE_SECRET = "phase3ab-live-platform-secret";
const CODE_SANDBOX_SMOKE_SECRET = "phase3ac-code-sandbox-secret";
const HOME_ASSISTANT_SMOKE_SECRET = "phase3ad-home-assistant-secret";
const SQL_SMOKE_SECRET = "phase3aq-sql-secret";
const COMFYUI_SMOKE_SECRET = "phase3ae-comfyui-secret";
const DELIVERY_WEBHOOK_SMOKE_URL = "https://hooks.example.test/phase3af-secret-path";
const DELIVERY_WEBHOOK_SMOKE_SECRET = "phase3af-webhook-header-secret";
const DELIVERY_DISCORD_SMOKE_URL = "https://discord.example.test/api/phase3af-secret-hook";
const CLAUDE_CLI_SMOKE_SECRET = "phase3ag-claude-cli-secret";
const QWEN_CLI_SMOKE_SECRET = "phase3ag-qwen-cli-secret";
const CODEX_CLI_SMOKE_SECRET = "phase3ag-codex-cli-secret";
const MAX_ELECTRON_OUTPUT_BYTES = 8 * 1024 * 1024;

/** Remove isolated smoke state without replacing a more useful startup failure. */
function cleanupTemporaryRoot(temporaryRoot) {
  try {
    rmSync(temporaryRoot, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 100,
    });
  } catch (error) {
    process.stderr.write(
      `Cold-start smoke state could not be removed and remains at ${temporaryRoot}: `
        + `${error?.message || error}\n`,
    );
  }
}

/** Terminate only the Electron process tree created by this smoke run. */
function terminateElectronProcessTree(child) {
  if (!child || !Number.isInteger(child.pid) || child.pid <= 0 || child.exitCode !== null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      encoding: "utf8",
      timeout: 5_000,
      windowsHide: true,
    });
    return;
  }
  child.kill("SIGKILL");
}

/** Run Electron asynchronously so timeout diagnostics cannot be blocked by inherited pipes. */
function spawnElectronWithDiagnostics(electronExecutable, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(electronExecutable, args, {
      ...options,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;

    /** Complete the process promise once and release its timeout. */
    function finish(callback, value) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback(value);
    }

    /** Capture bounded UTF-8 child output for failure diagnostics. */
    function captureOutput(streamName, chunk) {
      const value = String(chunk);
      if (streamName === "stdout") stdout += value;
      else stderr += value;
      if (Buffer.byteLength(stdout, "utf8") + Buffer.byteLength(stderr, "utf8") > MAX_ELECTRON_OUTPUT_BYTES) {
        terminateElectronProcessTree(child);
        finish(reject, new Error("Electron cold-start output exceeded its byte budget."));
      }
    }

    child.stdout.on("data", (chunk) => captureOutput("stdout", chunk));
    child.stderr.on("data", (chunk) => captureOutput("stderr", chunk));
    child.once("error", (error) => {
      finish(
        reject,
        new Error(
          `Electron cold-start process failed: ${error.message}.\nstdout:\n${stdout}\nstderr:\n${stderr}`,
          { cause: error },
        ),
      );
    });
    child.once("close", (code, signal) => finish(resolve, {
      code,
      signal,
      stdout,
      stderr,
    }));

    const timeout = setTimeout(() => {
      terminateElectronProcessTree(child);
      child.stdout.destroy();
      child.stderr.destroy();
      child.unref();
      finish(
        reject,
        new Error(
          `Electron cold-start process timed out after ${ELECTRON_TIMEOUT_MS} ms.\n`
            + `stdout:\n${stdout}\nstderr:\n${stderr}`,
        ),
      );
    }, ELECTRON_TIMEOUT_MS);
  });
}

/** Seed one Python-compatible provider settings row containing legacy plaintext copies. */
function seedLegacyProviderSettings(userDataDirectory, workspacePath) {
  mkdirSync(userDataDirectory, { recursive: true });
  const database = new DatabaseSync(path.join(userDataDirectory, "super_agent_party.db"));
  try {
    database.exec("CREATE TABLE settings (id INTEGER PRIMARY KEY, data TEXT NOT NULL)");
    database.prepare("INSERT INTO settings (id, data) VALUES (1, ?)").run(JSON.stringify({
      selectedProvider: "provider-smoke",
      base_url: "https://provider.example.test/v1",
      api_key: PROVIDER_SMOKE_SECRET,
      model: "model-smoke",
      modelProviders: [{
        id: "provider-smoke",
        vendor: "OpenAI",
        url: "https://provider.example.test/v1",
        apiKey: PROVIDER_SMOKE_SECRET,
        modelId: "model-smoke",
        models: ["model-smoke"],
      }, {
        id: "provider-cli-claude",
        vendor: "Anthropic",
        url: "https://anthropic.example.test",
        apiKey: CLAUDE_CLI_SMOKE_SECRET,
        modelId: "claude-smoke",
        models: ["claude-smoke"],
      }, {
        id: "provider-cli-qwen",
        vendor: "aliyun",
        url: "https://qwen.example.test/v1",
        apiKey: QWEN_CLI_SMOKE_SECRET,
        modelId: "qwen-smoke",
        models: ["qwen-smoke"],
      }, {
        id: "provider-cli-codex",
        vendor: "OpenAI",
        url: "https://codex.example.test/v1",
        apiKey: CODEX_CLI_SMOKE_SECRET,
        modelId: "codex-smoke",
        models: ["codex-smoke"],
      }],
      reasoner: {
        selectedProvider: "provider-smoke",
        api_key: PROVIDER_SMOKE_SECRET,
      },
      ccSettings: {
        enabled: true,
        selectedProvider: "provider-cli-claude",
        base_url: "https://anthropic.example.test",
        api_key: CLAUDE_CLI_SMOKE_SECRET,
        model: "claude-smoke",
      },
      qcSettings: {
        enabled: true,
        selectedProvider: "provider-cli-qwen",
        base_url: "https://qwen.example.test/v1",
        api_key: QWEN_CLI_SMOKE_SECRET,
        model: "qwen-smoke",
      },
      ocSettings: {
        enabled: true,
        selectedProvider: "provider-cli-codex",
        base_url: "https://codex.example.test/v1",
        api_key: CODEX_CLI_SMOKE_SECRET,
        model: "codex-smoke",
      },
      webSearch: {
        enabled: true,
        engine: "tavily",
        tavily_api_key: SEARCH_SMOKE_SECRET,
        Crawl4Ai_api_key: "test_api_code",
      },
      ttsSettings: {
        enabled: false,
        engine: "azure",
        azureSpeechKey: VOICE_SMOKE_SECRET,
        newtts: {
          Narrator: {
            enabled: true,
            engine: "fish",
            fishApiKey: `${VOICE_SMOKE_SECRET}-named`,
          },
        },
      },
      mcpServers: {
        "smoke-mcp": {
          type: "sse",
          url: "http://127.0.0.1:65530/sse",
          disabled: true,
          env: { MCP_TOKEN: `${MCP_SMOKE_SECRET}-env` },
          headers: {
            Authorization: `Bearer ${MCP_SMOKE_SECRET}-header`,
            "Content-Type": "text/event-stream",
          },
          input: JSON.stringify({
            mcpServers: {
              "smoke-mcp": {
                url: "http://127.0.0.1:65530/sse",
                env: { MCP_TOKEN: `${MCP_SMOKE_SECRET}-input-env` },
                headers: { Authorization: `Bearer ${MCP_SMOKE_SECRET}-input-header` },
              },
            },
          }),
        },
      },
      custom_http: [{
        id: "smoke-http-tool",
        enabled: false,
        name: "smoke-http",
        url: "https://http-tool.example.test",
        method: "GET",
        headers: JSON.stringify({
          Authorization: `Bearer ${HTTP_TOOL_SMOKE_SECRET}`,
          "Content-Type": "application/json",
        }),
        body: "{}",
      }],
      qqBotConfig: {
        appid: "qq-public-app-id",
        secret: `${CONNECTOR_SMOKE_SECRET}-qq`,
      },
      feishuBotConfig: {
        appid: "feishu-public-app-id",
        secret: `${CONNECTOR_SMOKE_SECRET}-feishu`,
      },
      dingtalkBotConfig: {
        appKey: "dingtalk-public-app-key",
        appSecret: `${CONNECTOR_SMOKE_SECRET}-dingtalk`,
      },
      discordBotConfig: {
        token: `${CONNECTOR_SMOKE_SECRET}-discord`,
      },
      slackBotConfig: {
        bot_token: `${CONNECTOR_SMOKE_SECRET}-slack-bot`,
        app_token: `${CONNECTOR_SMOKE_SECRET}-slack-app`,
      },
      telegramBotConfig: {
        TelegramAgent: "openxnet-model",
        bot_token: TELEGRAM_SMOKE_SECRET,
        behaviorTargetChatIds: ["100"],
      },
      BotConfig: {
        imgHost_enabled: true,
        imgHost: "EI2",
        SMMS_api_key: `${IMAGE_HOST_SMOKE_SECRET}-smms`,
        EI2_base_url: "https://images.example.test/api",
        EI2_api_key: `${IMAGE_HOST_SMOKE_SECRET}-easy-image`,
        gitee_repo_owner: "gitee-owner",
        gitee_repo_name: "gitee-repository",
        gitee_token: `${REPOSITORY_SMOKE_SECRET}-gitee`,
        gitee_branch: "master",
        github_repo_owner: "github-owner",
        github_repo_name: "github-repository",
        github_token: `${REPOSITORY_SMOKE_SECRET}-github`,
        github_branch: "main",
      },
      liveConfig: {
        bilibili_enabled: true,
        bilibili_type: "open_live",
        bilibili_room_id: "12345",
        bilibili_sessdata: `${LIVE_PLATFORM_SMOKE_SECRET}-bilibili-cookie`,
        bilibili_ACCESS_KEY_ID: "public-access-id",
        bilibili_ACCESS_KEY_SECRET: `${LIVE_PLATFORM_SMOKE_SECRET}-bilibili-secret`,
        bilibili_APP_ID: "public-app-id",
        bilibili_ROOM_OWNER_AUTH_CODE: `${LIVE_PLATFORM_SMOKE_SECRET}-owner-code`,
        youtube_enabled: true,
        youtube_vedio_id: "legacy-video-id",
        youtube_api_key: `${LIVE_PLATFORM_SMOKE_SECRET}-youtube`,
        twitch_enabled: true,
        twitch_channel: "openxnet",
        twitch_access_token: `oauth:${LIVE_PLATFORM_SMOKE_SECRET}-twitch`,
      },
      codeSettings: {
        enabled: true,
        engine: "e2b",
        e2b_api_key: CODE_SANDBOX_SMOKE_SECRET,
        sandbox_url: "http://127.0.0.1:8080",
      },
      HASettings: {
        enabled: true,
        api_key: HOME_ASSISTANT_SMOKE_SECRET,
        url: "http://127.0.0.1:8123",
      },
      sqlSettings: {
        enabled: false,
        engine: "postgres",
        user: "openxnet",
        password: SQL_SMOKE_SECRET,
        host: "127.0.0.1",
        port: 5432,
        dbname: "workspace",
        dbPath: "legacy-workspace.db",
        dbpath: "",
      },
      comfyuiServers: ["http://127.0.0.1:8188", "https://comfy.example.test"],
      comfyuiAPIkey: COMFYUI_SMOKE_SECRET,
      CLISettings: {
        cc_path: workspacePath,
      },
    }));
  } finally {
    database.close();
  }
}

/** Seed one UTF-8 legacy task file containing webhook and Discord plaintext. */
function seedLegacyDeliveryTask(workspacePath) {
  const taskDirectory = path.join(workspacePath, ".agent", "tasks");
  const taskPath = path.join(taskDirectory, "phase3af-task.json");
  mkdirSync(taskDirectory, { recursive: true });
  writeFileSync(taskPath, `${JSON.stringify({
    task_id: "phase3af-task",
    title: "Delivery credential migration",
    context: {
      delivery_targets: ["webhook", "discord"],
      delivery_records: {
        webhook: {
          target: "webhook",
          config: {
            method: "POST",
            url: DELIVERY_WEBHOOK_SMOKE_URL,
            headers: {
              Authorization: `Bearer ${DELIVERY_WEBHOOK_SMOKE_SECRET}`,
            },
          },
        },
        discord: {
          target: "discord",
          config: {
            channel_id: "public-channel-id",
            webhook_url: DELIVERY_DISCORD_SMOKE_URL,
          },
        },
      },
    },
  }, null, 2)}\n`, "utf8");
  return taskPath;
}

/** Assert that real Electron migration removed search plaintext from durable settings. */
function validateSearchCredentialMigration(userDataDirectory) {
  const legacyDatabasePath = path.join(userDataDirectory, "super_agent_party.db");
  const database = new DatabaseSync(legacyDatabasePath, { readOnly: true });
  let settings;
  try {
    const row = database.prepare("SELECT data FROM settings WHERE id = 1").get();
    settings = JSON.parse(String(row?.data || "{}"));
  } finally {
    database.close();
  }
  assert.equal(settings.webSearch?.tavily_api_key, "");
  assert.equal(settings.webSearch?.tavily_api_key_configured, true);
  assert.equal(settings.webSearch?.Crawl4Ai_api_key, "");
  assert.equal(settings.webSearch?.Crawl4Ai_api_key_configured, false);
  assert.equal(JSON.stringify(settings).includes(SEARCH_SMOKE_SECRET), false);
  assert.equal(readFileSync(legacyDatabasePath).includes(SEARCH_SMOKE_SECRET), false);

  const credentialPath = path.join(userDataDirectory, "search-credentials.bin");
  assert.equal(existsSync(credentialPath), true, "encrypted search credential file is missing");
  assert.equal(readFileSync(credentialPath).includes(SEARCH_SMOKE_SECRET), false);
  const coreDatabasePath = path.join(userDataDirectory, "desktop-core.db");
  assert.equal(readFileSync(coreDatabasePath).includes(SEARCH_SMOKE_SECRET), false);
}

/** Assert that real Electron migration removed scoped voice plaintext from durable settings. */
function validateVoiceCredentialMigration(userDataDirectory) {
  const legacyDatabasePath = path.join(userDataDirectory, "super_agent_party.db");
  const database = new DatabaseSync(legacyDatabasePath, { readOnly: true });
  let settings;
  try {
    const row = database.prepare("SELECT data FROM settings WHERE id = 1").get();
    settings = JSON.parse(String(row?.data || "{}"));
  } finally {
    database.close();
  }
  assert.equal(settings.ttsSettings?.azureSpeechKey, "");
  assert.equal(settings.ttsSettings?.azureSpeechKey_configured, true);
  assert.equal(settings.ttsSettings?.newtts?.Narrator?.fishApiKey, "");
  assert.equal(settings.ttsSettings?.newtts?.Narrator?.fishApiKey_configured, true);
  assert.equal(JSON.stringify(settings).includes(VOICE_SMOKE_SECRET), false);
  assert.equal(readFileSync(legacyDatabasePath).includes(VOICE_SMOKE_SECRET), false);

  const credentialPath = path.join(userDataDirectory, "voice-credentials.bin");
  assert.equal(existsSync(credentialPath), true, "encrypted voice credential file is missing");
  assert.equal(readFileSync(credentialPath).includes(VOICE_SMOKE_SECRET), false);
  const coreDatabasePath = path.join(userDataDirectory, "desktop-core.db");
  assert.equal(readFileSync(coreDatabasePath).includes(VOICE_SMOKE_SECRET), false);
}

/** Assert that real Electron migration removed MCP plaintext from every durable setting copy. */
function validateMcpCredentialMigration(userDataDirectory) {
  const legacyDatabasePath = path.join(userDataDirectory, "super_agent_party.db");
  const database = new DatabaseSync(legacyDatabasePath, { readOnly: true });
  let settings;
  try {
    const row = database.prepare("SELECT data FROM settings WHERE id = 1").get();
    settings = JSON.parse(String(row?.data || "{}"));
  } finally {
    database.close();
  }
  const server = settings.mcpServers?.["smoke-mcp"];
  assert.equal(server?.env?.MCP_TOKEN, "");
  assert.deepEqual(server?.envCredentialsConfigured, ["MCP_TOKEN"]);
  assert.equal(server?.headers?.Authorization, "");
  assert.deepEqual(server?.headerCredentialsConfigured, ["Authorization"]);
  assert.equal(String(server?.input || "").includes(MCP_SMOKE_SECRET), false);
  assert.equal(JSON.stringify(settings).includes(MCP_SMOKE_SECRET), false);
  assert.equal(readFileSync(legacyDatabasePath).includes(MCP_SMOKE_SECRET), false);

  const credentialPath = path.join(userDataDirectory, "mcp-credentials.bin");
  assert.equal(existsSync(credentialPath), true, "encrypted MCP credential file is missing");
  assert.equal(readFileSync(credentialPath).includes(MCP_SMOKE_SECRET), false);
  const coreDatabasePath = path.join(userDataDirectory, "desktop-core.db");
  assert.equal(readFileSync(coreDatabasePath).includes(MCP_SMOKE_SECRET), false);
}

/** Assert that real Electron migration removed custom HTTP plaintext from durable settings. */
function validateHttpToolCredentialMigration(userDataDirectory) {
  const legacyDatabasePath = path.join(userDataDirectory, "super_agent_party.db");
  const database = new DatabaseSync(legacyDatabasePath, { readOnly: true });
  let settings;
  try {
    const row = database.prepare("SELECT data FROM settings WHERE id = 1").get();
    settings = JSON.parse(String(row?.data || "{}"));
  } finally {
    database.close();
  }
  const tool = settings.custom_http?.find((candidate) => candidate?.id === "smoke-http-tool");
  const headers = JSON.parse(String(tool?.headers || "{}"));
  assert.equal(headers.Authorization, "");
  assert.equal(headers["Content-Type"], "application/json");
  assert.deepEqual(tool?.headerCredentialsConfigured, ["Authorization"]);
  assert.equal(JSON.stringify(settings).includes(HTTP_TOOL_SMOKE_SECRET), false);
  assert.equal(readFileSync(legacyDatabasePath).includes(HTTP_TOOL_SMOKE_SECRET), false);

  const credentialPath = path.join(userDataDirectory, "http-tool-credentials.bin");
  assert.equal(existsSync(credentialPath), true, "encrypted HTTP tool credential file is missing");
  assert.equal(readFileSync(credentialPath).includes(HTTP_TOOL_SMOKE_SECRET), false);
  const coreDatabasePath = path.join(userDataDirectory, "desktop-core.db");
  assert.equal(readFileSync(coreDatabasePath).includes(HTTP_TOOL_SMOKE_SECRET), false);
}

/** Assert that real Electron migration removed Connector Worker plaintext from durable settings. */
function validateConnectorCredentialMigration(userDataDirectory) {
  const legacyDatabasePath = path.join(userDataDirectory, "super_agent_party.db");
  const database = new DatabaseSync(legacyDatabasePath, { readOnly: true });
  let settings;
  try {
    const row = database.prepare("SELECT data FROM settings WHERE id = 1").get();
    settings = JSON.parse(String(row?.data || "{}"));
  } finally {
    database.close();
  }
  assert.equal(settings.qqBotConfig?.appid, "qq-public-app-id");
  assert.equal(settings.qqBotConfig?.secret, "");
  assert.deepEqual(settings.qqBotConfig?.credentialFieldsConfigured, ["secret"]);
  assert.equal(settings.feishuBotConfig?.appid, "feishu-public-app-id");
  assert.equal(settings.feishuBotConfig?.secret, "");
  assert.deepEqual(settings.feishuBotConfig?.credentialFieldsConfigured, ["secret"]);
  assert.equal(settings.dingtalkBotConfig?.appKey, "dingtalk-public-app-key");
  assert.equal(settings.dingtalkBotConfig?.appSecret, "");
  assert.deepEqual(settings.dingtalkBotConfig?.credentialFieldsConfigured, ["appSecret"]);
  assert.equal(settings.discordBotConfig?.token, "");
  assert.deepEqual(settings.discordBotConfig?.credentialFieldsConfigured, ["token"]);
  assert.equal(settings.slackBotConfig?.bot_token, "");
  assert.equal(settings.slackBotConfig?.app_token, "");
  assert.deepEqual(settings.slackBotConfig?.credentialFieldsConfigured, ["bot_token", "app_token"]);
  assert.equal(JSON.stringify(settings).includes(CONNECTOR_SMOKE_SECRET), false);
  assert.equal(readFileSync(legacyDatabasePath).includes(CONNECTOR_SMOKE_SECRET), false);

  const credentialPath = path.join(userDataDirectory, "connector-credentials.bin");
  assert.equal(existsSync(credentialPath), true, "encrypted Connector Worker credential file is missing");
  assert.equal(readFileSync(credentialPath).includes(CONNECTOR_SMOKE_SECRET), false);
  const coreDatabasePath = path.join(userDataDirectory, "desktop-core.db");
  assert.equal(readFileSync(coreDatabasePath).includes(CONNECTOR_SMOKE_SECRET), false);
}

/** Assert that real Electron migration removed Telegram plaintext from durable settings. */
function validateTelegramCredentialMigration(userDataDirectory) {
  const legacyDatabasePath = path.join(userDataDirectory, "super_agent_party.db");
  const database = new DatabaseSync(legacyDatabasePath, { readOnly: true });
  let settings;
  try {
    const row = database.prepare("SELECT data FROM settings WHERE id = 1").get();
    settings = JSON.parse(String(row?.data || "{}"));
  } finally {
    database.close();
  }
  assert.equal(settings.telegramBotConfig?.bot_token, "");
  assert.equal(settings.telegramBotConfig?.TelegramAgent, "openxnet-model");
  assert.deepEqual(settings.telegramBotConfig?.behaviorTargetChatIds, ["100"]);
  assert.deepEqual(
    settings.telegramBotConfig?.credentialFieldsConfigured,
    ["bot_token"],
  );
  assert.equal(JSON.stringify(settings).includes(TELEGRAM_SMOKE_SECRET), false);
  assert.equal(readFileSync(legacyDatabasePath).includes(TELEGRAM_SMOKE_SECRET), false);

  const credentialPath = path.join(userDataDirectory, "telegram-credentials.bin");
  assert.equal(existsSync(credentialPath), true, "encrypted Telegram credential file is missing");
  assert.equal(readFileSync(credentialPath).includes(TELEGRAM_SMOKE_SECRET), false);
  const coreDatabasePath = path.join(userDataDirectory, "desktop-core.db");
  assert.equal(readFileSync(coreDatabasePath).includes(TELEGRAM_SMOKE_SECRET), false);
}

/** Assert that real Electron migration isolates image-host and repository credentials. */
function validateImageHostCredentialMigration(userDataDirectory) {
  const legacyDatabasePath = path.join(userDataDirectory, "super_agent_party.db");
  const database = new DatabaseSync(legacyDatabasePath, { readOnly: true });
  let settings;
  try {
    const row = database.prepare("SELECT data FROM settings WHERE id = 1").get();
    settings = JSON.parse(String(row?.data || "{}"));
  } finally {
    database.close();
  }
  assert.equal(settings.BotConfig?.SMMS_api_key, "");
  assert.equal(settings.BotConfig?.EI2_api_key, "");
  assert.equal(settings.BotConfig?.EI2_base_url, "https://images.example.test/api");
  assert.deepEqual(
    settings.BotConfig?.imageHostCredentialFieldsConfigured,
    ["SMMS_api_key", "EI2_api_key"],
  );
  assert.equal(settings.BotConfig?.gitee_token, "");
  assert.equal(settings.BotConfig?.github_token, "");
  assert.equal(JSON.stringify(settings).includes(IMAGE_HOST_SMOKE_SECRET), false);
  assert.equal(readFileSync(legacyDatabasePath).includes(IMAGE_HOST_SMOKE_SECRET), false);

  const credentialPath = path.join(userDataDirectory, "image-host-credentials.bin");
  assert.equal(existsSync(credentialPath), true, "encrypted image-host credential file is missing");
  assert.equal(readFileSync(credentialPath).includes(IMAGE_HOST_SMOKE_SECRET), false);
  assert.equal(readFileSync(credentialPath).includes(REPOSITORY_SMOKE_SECRET), false);
  const coreDatabasePath = path.join(userDataDirectory, "desktop-core.db");
  assert.equal(readFileSync(coreDatabasePath).includes(IMAGE_HOST_SMOKE_SECRET), false);
}

/** Assert that real Electron migration removes repository tokens without losing metadata. */
function validateRepositoryCredentialMigration(userDataDirectory) {
  const legacyDatabasePath = path.join(userDataDirectory, "super_agent_party.db");
  const database = new DatabaseSync(legacyDatabasePath, { readOnly: true });
  let settings;
  try {
    const row = database.prepare("SELECT data FROM settings WHERE id = 1").get();
    settings = JSON.parse(String(row?.data || "{}"));
  } finally {
    database.close();
  }
  assert.equal(settings.BotConfig?.gitee_token, "");
  assert.equal(settings.BotConfig?.github_token, "");
  assert.equal(settings.BotConfig?.gitee_repo_owner, "gitee-owner");
  assert.equal(settings.BotConfig?.gitee_repo_name, "gitee-repository");
  assert.equal(settings.BotConfig?.gitee_branch, "master");
  assert.equal(settings.BotConfig?.github_repo_owner, "github-owner");
  assert.equal(settings.BotConfig?.github_repo_name, "github-repository");
  assert.equal(settings.BotConfig?.github_branch, "main");
  assert.deepEqual(
    settings.BotConfig?.repositoryCredentialFieldsConfigured,
    ["gitee_token", "github_token"],
  );
  assert.equal(JSON.stringify(settings).includes(REPOSITORY_SMOKE_SECRET), false);
  assert.equal(readFileSync(legacyDatabasePath).includes(REPOSITORY_SMOKE_SECRET), false);

  const credentialPath = path.join(userDataDirectory, "repository-credentials.bin");
  assert.equal(existsSync(credentialPath), true, "encrypted repository credential file is missing");
  assert.equal(readFileSync(credentialPath).includes(REPOSITORY_SMOKE_SECRET), false);
  assert.equal(readFileSync(credentialPath).includes(IMAGE_HOST_SMOKE_SECRET), false);
  const imageHostCredentialPath = path.join(userDataDirectory, "image-host-credentials.bin");
  assert.equal(readFileSync(imageHostCredentialPath).includes(REPOSITORY_SMOKE_SECRET), false);
  const coreDatabasePath = path.join(userDataDirectory, "desktop-core.db");
  assert.equal(readFileSync(coreDatabasePath).includes(REPOSITORY_SMOKE_SECRET), false);
}

/** Assert that real Electron migration isolates live credentials and normalizes metadata. */
function validateLivePlatformCredentialMigration(userDataDirectory) {
  const legacyDatabasePath = path.join(userDataDirectory, "super_agent_party.db");
  const database = new DatabaseSync(legacyDatabasePath, { readOnly: true });
  let settings;
  try {
    const row = database.prepare("SELECT data FROM settings WHERE id = 1").get();
    settings = JSON.parse(String(row?.data || "{}"));
  } finally {
    database.close();
  }
  const configuration = settings.liveConfig || {};
  assert.equal(configuration.bilibili_sessdata, "");
  assert.equal(configuration.bilibili_ACCESS_KEY_SECRET, "");
  assert.equal(configuration.bilibili_ROOM_OWNER_AUTH_CODE, "");
  assert.equal(configuration.youtube_api_key, "");
  assert.equal(configuration.twitch_access_token, "");
  assert.equal(configuration.bilibili_ACCESS_KEY_ID, "public-access-id");
  assert.equal(configuration.bilibili_APP_ID, "public-app-id");
  assert.equal(configuration.bilibili_type, "open");
  assert.equal(configuration.youtube_video_id, "legacy-video-id");
  assert.equal("youtube_vedio_id" in configuration, false);
  assert.equal(configuration.twitch_channel, "openxnet");
  assert.deepEqual(configuration.liveCredentialFieldsConfigured, [
    "bilibili_sessdata",
    "bilibili_ACCESS_KEY_SECRET",
    "bilibili_ROOM_OWNER_AUTH_CODE",
    "youtube_api_key",
    "twitch_access_token",
  ]);
  assert.equal(JSON.stringify(settings).includes(LIVE_PLATFORM_SMOKE_SECRET), false);
  assert.equal(readFileSync(legacyDatabasePath).includes(LIVE_PLATFORM_SMOKE_SECRET), false);

  const credentialPath = path.join(userDataDirectory, "live-platform-credentials.bin");
  assert.equal(existsSync(credentialPath), true, "encrypted live-platform credential file is missing");
  assert.equal(readFileSync(credentialPath).includes(LIVE_PLATFORM_SMOKE_SECRET), false);
  const repositoryCredentialPath = path.join(userDataDirectory, "repository-credentials.bin");
  assert.equal(readFileSync(repositoryCredentialPath).includes(LIVE_PLATFORM_SMOKE_SECRET), false);
  const coreDatabasePath = path.join(userDataDirectory, "desktop-core.db");
  assert.equal(readFileSync(coreDatabasePath).includes(LIVE_PLATFORM_SMOKE_SECRET), false);
}

/** Assert that real Electron migration isolates the E2B key from durable settings. */
function validateCodeSandboxCredentialMigration(userDataDirectory) {
  const legacyDatabasePath = path.join(userDataDirectory, "super_agent_party.db");
  const database = new DatabaseSync(legacyDatabasePath, { readOnly: true });
  let settings;
  try {
    const row = database.prepare("SELECT data FROM settings WHERE id = 1").get();
    settings = JSON.parse(String(row?.data || "{}"));
  } finally {
    database.close();
  }
  const configuration = settings.codeSettings || {};
  assert.equal(configuration.enabled, true);
  assert.equal(configuration.engine, "e2b");
  assert.equal(configuration.e2b_api_key, "");
  assert.equal(configuration.sandbox_url, "http://127.0.0.1:8080");
  assert.deepEqual(configuration.codeSandboxCredentialFieldsConfigured, ["e2b_api_key"]);
  assert.equal(JSON.stringify(settings).includes(CODE_SANDBOX_SMOKE_SECRET), false);
  assert.equal(readFileSync(legacyDatabasePath).includes(CODE_SANDBOX_SMOKE_SECRET), false);

  const credentialPath = path.join(userDataDirectory, "code-sandbox-credentials.bin");
  assert.equal(existsSync(credentialPath), true, "encrypted code-sandbox credential file is missing");
  assert.equal(readFileSync(credentialPath).includes(CODE_SANDBOX_SMOKE_SECRET), false);
  const liveCredentialPath = path.join(userDataDirectory, "live-platform-credentials.bin");
  assert.equal(readFileSync(liveCredentialPath).includes(CODE_SANDBOX_SMOKE_SECRET), false);
  assert.equal(readFileSync(credentialPath).includes(LIVE_PLATFORM_SMOKE_SECRET), false);
  const coreDatabasePath = path.join(userDataDirectory, "desktop-core.db");
  assert.equal(readFileSync(coreDatabasePath).includes(CODE_SANDBOX_SMOKE_SECRET), false);
}

/** Assert that real Electron migration isolates the Home Assistant token. */
function validateHomeAssistantCredentialMigration(userDataDirectory) {
  const legacyDatabasePath = path.join(userDataDirectory, "super_agent_party.db");
  const database = new DatabaseSync(legacyDatabasePath, { readOnly: true });
  let settings;
  try {
    const row = database.prepare("SELECT data FROM settings WHERE id = 1").get();
    settings = JSON.parse(String(row?.data || "{}"));
  } finally {
    database.close();
  }
  const configuration = settings.HASettings || {};
  assert.equal(configuration.enabled, true);
  assert.equal(configuration.api_key, "");
  assert.equal(configuration.url, "http://127.0.0.1:8123");
  assert.deepEqual(configuration.homeAssistantCredentialFieldsConfigured, ["api_key"]);
  assert.equal(JSON.stringify(settings).includes(HOME_ASSISTANT_SMOKE_SECRET), false);
  assert.equal(readFileSync(legacyDatabasePath).includes(HOME_ASSISTANT_SMOKE_SECRET), false);

  const credentialPath = path.join(userDataDirectory, "home-assistant-credentials.bin");
  assert.equal(existsSync(credentialPath), true, "encrypted Home Assistant credential file is missing");
  assert.equal(readFileSync(credentialPath).includes(HOME_ASSISTANT_SMOKE_SECRET), false);
  const codeSandboxCredentialPath = path.join(userDataDirectory, "code-sandbox-credentials.bin");
  assert.equal(readFileSync(codeSandboxCredentialPath).includes(HOME_ASSISTANT_SMOKE_SECRET), false);
  assert.equal(readFileSync(credentialPath).includes(CODE_SANDBOX_SMOKE_SECRET), false);
  const coreDatabasePath = path.join(userDataDirectory, "desktop-core.db");
  assert.equal(readFileSync(coreDatabasePath).includes(HOME_ASSISTANT_SMOKE_SECRET), false);
}

/** 验证真实 Electron 启动会迁移 SQL 口令并统一 SQLite 路径键。 */
function validateSqlCredentialMigration(userDataDirectory) {
  const legacyDatabasePath = path.join(userDataDirectory, "super_agent_party.db");
  const database = new DatabaseSync(legacyDatabasePath, { readOnly: true });
  let settings;
  try {
    const row = database.prepare("SELECT data FROM settings WHERE id = 1").get();
    settings = JSON.parse(String(row?.data || "{}"));
  } finally {
    database.close();
  }
  const configuration = settings.sqlSettings || {};
  assert.equal(configuration.password, "");
  assert.deepEqual(configuration.sqlCredentialFieldsConfigured, ["password"]);
  assert.equal(configuration.dbpath, "legacy-workspace.db");
  assert.equal("dbPath" in configuration, false);
  assert.equal(JSON.stringify(settings).includes(SQL_SMOKE_SECRET), false);
  assert.equal(readFileSync(legacyDatabasePath).includes(SQL_SMOKE_SECRET), false);
  const credentialPath = path.join(userDataDirectory, "sql-credentials.bin");
  assert.equal(existsSync(credentialPath), true, "encrypted SQL credential file is missing");
  assert.equal(readFileSync(credentialPath).includes(SQL_SMOKE_SECRET), false);
  const coreDatabasePath = path.join(userDataDirectory, "desktop-core.db");
  assert.equal(readFileSync(coreDatabasePath).includes(SQL_SMOKE_SECRET), false);
  for (const filename of readdirSync(userDataDirectory)) {
    if (!filename.endsWith("-credentials.bin") || filename === "sql-credentials.bin") continue;
    assert.equal(
      readFileSync(path.join(userDataDirectory, filename)).includes(SQL_SMOKE_SECRET),
      false,
      `${filename} retained SQL plaintext`,
    );
  }
}

/** Assert that real Electron migration isolates the global ComfyUI API key. */
function validateComfyUiCredentialMigration(userDataDirectory) {
  const legacyDatabasePath = path.join(userDataDirectory, "super_agent_party.db");
  const database = new DatabaseSync(legacyDatabasePath, { readOnly: true });
  let settings;
  try {
    const row = database.prepare("SELECT data FROM settings WHERE id = 1").get();
    settings = JSON.parse(String(row?.data || "{}"));
  } finally {
    database.close();
  }
  assert.equal(settings.comfyuiAPIkey, "");
  assert.deepEqual(settings.comfyuiCredentialFieldsConfigured, ["api_key"]);
  assert.deepEqual(settings.comfyuiServers, [
    "http://127.0.0.1:8188",
    "https://comfy.example.test",
  ]);
  assert.equal(JSON.stringify(settings).includes(COMFYUI_SMOKE_SECRET), false);
  assert.equal(readFileSync(legacyDatabasePath).includes(COMFYUI_SMOKE_SECRET), false);

  const credentialPath = path.join(userDataDirectory, "comfyui-credentials.bin");
  assert.equal(existsSync(credentialPath), true, "encrypted ComfyUI credential file is missing");
  assert.equal(readFileSync(credentialPath).includes(COMFYUI_SMOKE_SECRET), false);
  const homeAssistantCredentialPath = path.join(
    userDataDirectory,
    "home-assistant-credentials.bin",
  );
  assert.equal(readFileSync(homeAssistantCredentialPath).includes(COMFYUI_SMOKE_SECRET), false);
  assert.equal(readFileSync(credentialPath).includes(HOME_ASSISTANT_SMOKE_SECRET), false);
  const coreDatabasePath = path.join(userDataDirectory, "desktop-core.db");
  assert.equal(readFileSync(coreDatabasePath).includes(COMFYUI_SMOKE_SECRET), false);
}

/** Assert that legacy task delivery secrets migrate into one isolated sidecar. */
function validateDeliveryCredentialMigration(userDataDirectory, taskPath) {
  const task = JSON.parse(readFileSync(taskPath, "utf8"));
  const webhook = task.context?.delivery_records?.webhook;
  const discord = task.context?.delivery_records?.discord;
  assert.equal(webhook?.config?.url, "");
  assert.equal(webhook?.config?.urlConfigured, true);
  assert.deepEqual(webhook?.config?.headers, { authorization: "" });
  assert.deepEqual(webhook?.config?.headerCredentialsConfigured, ["authorization"]);
  assert.equal(webhook?.config?.method, "POST");
  assert.equal(discord?.config?.webhook_url, "");
  assert.equal(discord?.config?.webhookUrlConfigured, true);
  assert.equal(discord?.config?.channel_id, "public-channel-id");

  const deliverySecrets = [
    DELIVERY_WEBHOOK_SMOKE_URL,
    DELIVERY_WEBHOOK_SMOKE_SECRET,
    DELIVERY_DISCORD_SMOKE_URL,
  ];
  const durablePaths = [
    taskPath,
    path.join(userDataDirectory, "super_agent_party.db"),
    path.join(userDataDirectory, "desktop-core.db"),
  ];
  for (const durablePath of durablePaths) {
    const bytes = readFileSync(durablePath);
    for (const secret of deliverySecrets) {
      assert.equal(bytes.includes(secret), false, `${path.basename(durablePath)} retained delivery plaintext`);
    }
  }

  const expectedCredentialFiles = [
    "code-sandbox-credentials.bin",
    "comfyui-credentials.bin",
    "connector-credentials.bin",
    "delivery-credentials.bin",
    "home-assistant-credentials.bin",
    "http-tool-credentials.bin",
    "image-host-credentials.bin",
    "live-platform-credentials.bin",
    "mcp-credentials.bin",
    "provider-credentials.bin",
    "repository-credentials.bin",
    "search-credentials.bin",
    "sql-credentials.bin",
    "telegram-credentials.bin",
    "voice-credentials.bin",
  ];
  const actualCredentialFiles = readdirSync(userDataDirectory)
    .filter((name) => name.endsWith("-credentials.bin"))
    .sort();
  assert.deepEqual(actualCredentialFiles, expectedCredentialFiles);

  const deliveryCredentialPath = path.join(userDataDirectory, "delivery-credentials.bin");
  const deliveryCredentialBytes = readFileSync(deliveryCredentialPath);
  for (const secret of deliverySecrets) {
    assert.equal(deliveryCredentialBytes.includes(secret), false);
  }
  const otherTrustZoneSecrets = [
    PROVIDER_SMOKE_SECRET,
    SEARCH_SMOKE_SECRET,
    VOICE_SMOKE_SECRET,
    MCP_SMOKE_SECRET,
    HTTP_TOOL_SMOKE_SECRET,
    CONNECTOR_SMOKE_SECRET,
    TELEGRAM_SMOKE_SECRET,
    IMAGE_HOST_SMOKE_SECRET,
    REPOSITORY_SMOKE_SECRET,
    LIVE_PLATFORM_SMOKE_SECRET,
    CODE_SANDBOX_SMOKE_SECRET,
    HOME_ASSISTANT_SMOKE_SECRET,
    SQL_SMOKE_SECRET,
    COMFYUI_SMOKE_SECRET,
    CLAUDE_CLI_SMOKE_SECRET,
    QWEN_CLI_SMOKE_SECRET,
    CODEX_CLI_SMOKE_SECRET,
  ];
  for (const secret of otherTrustZoneSecrets) {
    assert.equal(deliveryCredentialBytes.includes(secret), false);
  }
  for (const filename of expectedCredentialFiles.filter((name) => name !== "delivery-credentials.bin")) {
    const bytes = readFileSync(path.join(userDataDirectory, filename));
    for (const secret of deliverySecrets) {
      assert.equal(bytes.includes(secret), false, `${filename} retained delivery plaintext`);
    }
  }
}

/** Assert that real Electron migration removed provider plaintext from every durable store. */
function validateProviderCredentialMigration(userDataDirectory) {
  const legacyDatabasePath = path.join(userDataDirectory, "super_agent_party.db");
  const database = new DatabaseSync(legacyDatabasePath, { readOnly: true });
  let settings;
  try {
    const row = database.prepare("SELECT data FROM settings WHERE id = 1").get();
    settings = JSON.parse(String(row?.data || "{}"));
  } finally {
    database.close();
  }
  assert.equal(settings.api_key, "");
  assert.equal(settings.modelProviders?.[0]?.apiKey, "");
  assert.equal(settings.reasoner?.api_key, "");
  const externalCliProviders = [{
    settingsKey: "ccSettings",
    providerId: "provider-cli-claude",
    secret: CLAUDE_CLI_SMOKE_SECRET,
  }, {
    settingsKey: "qcSettings",
    providerId: "provider-cli-qwen",
    secret: QWEN_CLI_SMOKE_SECRET,
  }, {
    settingsKey: "ocSettings",
    providerId: "provider-cli-codex",
    secret: CODEX_CLI_SMOKE_SECRET,
  }];
  for (const cliProvider of externalCliProviders) {
    const configuration = settings[cliProvider.settingsKey];
    const provider = settings.modelProviders?.find(
      (candidate) => candidate?.id === cliProvider.providerId,
    );
    assert.equal(configuration?.selectedProvider, cliProvider.providerId);
    assert.equal(configuration?.api_key, "");
    assert.equal(configuration?.api_key_configured, true);
    assert.equal(provider?.apiKey, "");
    assert.equal(provider?.apiKeyConfigured, true);
  }

  const providerSecrets = [
    PROVIDER_SMOKE_SECRET,
    ...externalCliProviders.map((provider) => provider.secret),
  ];
  const serializedSettings = JSON.stringify(settings);
  const legacyDatabaseBytes = readFileSync(legacyDatabasePath);
  const coreDatabasePath = path.join(userDataDirectory, "desktop-core.db");
  const coreDatabaseBytes = readFileSync(coreDatabasePath);

  const credentialPath = path.join(userDataDirectory, "provider-credentials.bin");
  assert.equal(existsSync(credentialPath), true, "encrypted provider credential file is missing");
  const providerCredentialBytes = readFileSync(credentialPath);
  const unrelatedCredentialFiles = readdirSync(userDataDirectory)
    .filter((name) => name.endsWith("-credentials.bin") && name !== "provider-credentials.bin");
  assert.equal(unrelatedCredentialFiles.length, 14, "external CLI Providers created a new sidecar");
  for (const secret of providerSecrets) {
    assert.equal(serializedSettings.includes(secret), false);
    assert.equal(legacyDatabaseBytes.includes(secret), false);
    assert.equal(coreDatabaseBytes.includes(secret), false);
    assert.equal(providerCredentialBytes.includes(secret), false);
    for (const filename of unrelatedCredentialFiles) {
      assert.equal(
        readFileSync(path.join(userDataDirectory, filename)).includes(secret),
        false,
        `${filename} retained Provider plaintext`,
      );
    }
  }
}

/**
 * 验证 Electron 稳定启动未激活任何按需 Python 能力。
 *
 * @param {Record<string, unknown>} report Main 输出的结构化启动报告。
 * @returns {void} 校验通过无返回，能力缺失或被激活时抛出断言错误。
 */
function validateColdStartReport(report) {
  assert.equal(report?.schema, "openxnet.startup-report.v1", "startup report schema is invalid");
  assert.equal(
    report?.legacyBackendProcessActive,
    false,
    "legacy backend process was active after cold-start settling",
  );
  const capabilities = Array.isArray(report?.core?.capabilities) ? report.core.capabilities : [];
  const legacyBackend = capabilities.find((capability) => capability?.id === "legacy-backend");
  assert.ok(legacyBackend, "startup report is missing the legacy-backend capability");
  assert.equal(
    legacyBackend.state,
    "stopped",
    `legacy-backend capability entered '${legacyBackend.state}' during cold startup`,
  );
  for (const capabilityId of [
    "execution-engine",
    "voice",
    "connectors",
    "live",
    "mcp",
    "agentteams",
    "desktop-control",
  ]) {
    const capability = capabilities.find((candidate) => candidate?.id === capabilityId);
    assert.ok(capability, `startup report is missing the ${capabilityId} capability`);
    assert.equal(
      capability.state,
      "stopped",
      `${capabilityId} capability entered '${capability.state}' during cold startup`,
    );
  }

  const milestones = Array.isArray(report?.renderer?.milestones) ? report.renderer.milestones : [];
  assert.ok(
    milestones.some((milestone) => milestone?.name === "legacy-renderer-state-ready"),
    "Renderer did not finish restoring legacy state through typed IPC",
  );

  const deferredTasks = Array.isArray(report?.renderer?.deferredTasks)
    ? report.renderer.deferredTasks
    : [];
  for (const taskName of ["server-port-check", "auto-update-checks", "chat-services"]) {
    const task = deferredTasks.find((candidate) => candidate?.name === taskName);
    assert.ok(task, `settled startup report is missing deferred task '${taskName}'`);
    assert.match(
      String(task.status || ""),
      /^(scheduled|running|completed)$/,
      `deferred task '${taskName}' has an invalid state`,
    );
  }
}

/** Run the real Electron application with isolated state and capture its settled startup report. */
async function runElectronColdStart() {
  const electronExecutable = require("electron");
  assert.equal(typeof electronExecutable, "string", "Electron executable path is unavailable");
  const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), "openxnet-cold-start-"));
  const reportPath = path.join(temporaryRoot, "startup-report.json");
  const userDataDirectory = path.join(temporaryRoot, "user-data");
  const workspacePath = path.join(temporaryRoot, "workspace");
  try {
    seedLegacyProviderSettings(userDataDirectory, workspacePath);
    const deliveryTaskPath = seedLegacyDeliveryTask(workspacePath);
    const result = await spawnElectronWithDiagnostics(electronExecutable, [PROJECT_ROOT, "--hidden"], {
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        OPENXNET_EXIT_AFTER_STARTUP_REPORT: "1",
        OPENXNET_SKIP_UTF8_CONSOLE: "1",
        OPENXNET_STARTUP_REPORT: reportPath,
        OPENXNET_STARTUP_REPORT_SETTLE_MS: String(STARTUP_SETTLE_MS),
        OPENXNET_USER_DATA_DIR: userDataDirectory,
        PYTHONIOENCODING: "utf-8",
        PYTHONUTF8: "1",
      },
      windowsHide: true,
    });
    assert.equal(
      result.code,
      0,
      `Electron cold-start smoke failed with signal ${result.signal || "none"}.\n`
        + `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
    const report = JSON.parse(readFileSync(reportPath, "utf8"));
    try {
      checkStartupBudget(
        report,
        resolveStartupBudget("OPENXNET_PROCESS_STARTUP_BUDGET_MS", 10_000),
        resolveStartupBudget("OPENXNET_WORKSPACE_STARTUP_BUDGET_MS", 3_000),
      );
      validateColdStartReport(report);
      validateProviderCredentialMigration(userDataDirectory);
      validateSearchCredentialMigration(userDataDirectory);
      validateVoiceCredentialMigration(userDataDirectory);
      validateMcpCredentialMigration(userDataDirectory);
      validateHttpToolCredentialMigration(userDataDirectory);
      validateConnectorCredentialMigration(userDataDirectory);
      validateTelegramCredentialMigration(userDataDirectory);
      validateImageHostCredentialMigration(userDataDirectory);
      validateRepositoryCredentialMigration(userDataDirectory);
      validateLivePlatformCredentialMigration(userDataDirectory);
      validateCodeSandboxCredentialMigration(userDataDirectory);
      validateHomeAssistantCredentialMigration(userDataDirectory);
      validateSqlCredentialMigration(userDataDirectory);
      validateComfyUiCredentialMigration(userDataDirectory);
      validateDeliveryCredentialMigration(userDataDirectory, deliveryTaskPath);
    } catch (error) {
      throw new Error(
        `${error?.message || error}\nStartup report:\n${JSON.stringify(report, null, 2)}\n`
          + `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
        { cause: error },
      );
    }
    process.stdout.write(
      `Desktop cold-start smoke passed: process ${report.processElapsedMs} ms, `
        + `workspace ${report.workspaceElapsedMs} ms; legacy-backend remained stopped `
        + `after ${STARTUP_SETTLE_MS} ms and provider/external-CLI/search/voice/MCP/HTTP/connector/Telegram/image-host/repository/live-platform/code-sandbox/Home-Assistant/SQL/ComfyUI/delivery credentials migrated to safeStorage.\n`,
    );
  } finally {
    cleanupTemporaryRoot(temporaryRoot);
  }
}

if (require.main === module) {
  runElectronColdStart().catch((error) => {
    writeSync(process.stderr.fd, `${error?.stack || error}\n`);
    process.exit(1);
  });
}

module.exports = { validateColdStartReport };
