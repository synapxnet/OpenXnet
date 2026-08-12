"use strict";

const { spawn } = require("node:child_process");
const { randomBytes } = require("node:crypto");
const fs = require("node:fs/promises");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const {
  DesktopCore,
  FeaturePackManager,
  registerFeaturePackWorker,
  WorkerRpcGateway,
  WorkerSupervisor,
} = require("../build-ts/desktop");

/** 解析命令行 MCP Pack 目录；无参数时抛出使用说明。 */
function resolvePackDirectory() {
  const argument = process.argv[2];
  if (!argument) throw new Error("Usage: node scripts/smoke_mcp_feature_pack.cjs <pack-directory>");
  return path.resolve(argument);
}

/** 查找 smoke 服务使用的 Python；无输入，返回解释器路径，候选均不存在时抛出异常。 */
async function resolveSmokePython() {
  const projectRoot = path.resolve(__dirname, "..");
  const candidates = [
    process.env.OPENXNET_MCP_SMOKE_PYTHON,
    process.platform === "win32"
      ? path.join(projectRoot, ".venv", "Scripts", "python.exe")
      : path.join(projectRoot, ".venv", "bin", "python3"),
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // 继续检查下一个显式候选。
    }
  }
  throw new Error("MCP smoke Python environment is unavailable.");
}

/** 申请一个临时回环端口；无输入，返回端口号，绑定失败时拒绝 Promise。 */
async function reserveLoopbackPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    server.close();
    throw new Error("Generic MCP smoke server did not receive a TCP port.");
  }
  await new Promise((resolve) => server.close(resolve));
  return address.port;
}

/** 尝试连接一次回环端口；输入端口，返回布尔值，连接失败不向外抛出。 */
async function canConnectToLoopbackPort(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.setTimeout(500, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

/** 等待 smoke 服务监听；输入子进程和端口，无返回，进程退出或超时时抛出有界诊断。 */
async function waitForGenericSmokeServer(child, port, readDiagnostics) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Generic MCP smoke server exited early: ${readDiagnostics()}`);
    }
    if (await canConnectToLoopbackPort(port)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Generic MCP smoke server did not start: ${readDiagnostics()}`);
}

/** 启动带认证的真实通用 MCP 服务；输入 token，返回子进程、端口和 URL，启动失败时清理子进程。 */
async function startGenericSmokeServer(token) {
  const projectRoot = path.resolve(__dirname, "..");
  const python = await resolveSmokePython();
  const port = await reserveLoopbackPort();
  const child = spawn(
    python,
    [path.join(__dirname, "mcp_generic_smoke_server.py"), "--port", String(port)],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8",
        PYTHONUTF8: "1",
        OPENXNET_GENERIC_MCP_SMOKE_TOKEN: token,
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  let diagnostics = "";
  const appendDiagnostics = (chunk) => {
    diagnostics = `${diagnostics}${chunk.toString("utf8")}`.slice(-16 * 1024);
  };
  child.stdout.on("data", appendDiagnostics);
  child.stderr.on("data", appendDiagnostics);
  try {
    await waitForGenericSmokeServer(child, port, () => diagnostics.trim());
    return { child, port, url: `http://127.0.0.1:${port}/mcp` };
  } catch (error) {
    child.kill();
    throw error;
  }
}

/** 停止 smoke 服务进程；输入可空子进程，无返回，先温和停止再强制终止。 */
async function stopGenericSmokeServer(child) {
  if (!child || child.exitCode !== null) return;
  child.kill();
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 3_000)),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

/** 发送认证 Worker 请求；输入 origin、方法和载荷，返回成功载荷，协议失败时抛出异常。 */
async function requestWorker(origin, method, payload) {
  const response = await fetch(`${origin}/v1/workers/request`, {
    method: "POST",
    headers: {
      Authorization: "Bearer mcp-pack-smoke-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ capability: "mcp", method, payload }),
  });
  const body = await response.json();
  if (!response.ok || body?.ok !== true || typeof body?.payload !== "object") {
    throw new Error(`Packaged MCP Worker request failed: ${JSON.stringify(body)}`);
  }
  return body.payload;
}

/** 安装并验证真实 MCP Worker 入口；无输入和返回，结束时总是删除临时工作区。 */
async function main() {
  const packDirectory = resolvePackDirectory();
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openxnet-mcp-pack-smoke-"));
  const npmCliPath = path.join(path.dirname(require.resolve("npm/package.json")), "bin", "npm-cli.js");
  const core = new DesktopCore();
  const supervisor = new WorkerSupervisor();
  const manager = new FeaturePackManager({ rootDirectory: path.join(temporaryRoot, "installed") });
  const gateway = new WorkerRpcGateway({
    core,
    supervisor,
    token: "mcp-pack-smoke-token",
    allowedMethods: {
      mcp: [
        "mcp.dependencies",
        "mcp.status",
        "mcp.integration.start",
        "mcp.integration.stop",
        "mcp.tools.list",
        "mcp.tools.call",
      ],
    },
  });
  let unsubscribe = null;
  let genericSmokeServer = null;
  try {
    const genericToken = randomBytes(32).toString("hex");
    genericSmokeServer = await startGenericSmokeServer(genericToken);
    const mcpCredentialBootstrap = Buffer.from(JSON.stringify({
      schema: "openxnet.mcp-credentials.runtime.v1",
      credentials: {
        "pack-smoke": {
          headers: { Authorization: `Bearer ${genericToken}` },
        },
      },
    }), "utf8").toString("base64");
    const sqlDatabasePath = path.join(temporaryRoot, "sql-smoke.db");
    const sqlDatabase = new DatabaseSync(sqlDatabasePath);
    try {
      sqlDatabase.exec(
        "CREATE TABLE phase3aq_sql_smoke (id INTEGER PRIMARY KEY, value TEXT NOT NULL);"
        + "INSERT INTO phase3aq_sql_smoke(value) VALUES ('ready');",
      );
    } finally {
      sqlDatabase.close();
    }
    const sqlDatabaseId = "00000000-0000-4000-8000-000000000001";
    const sqlCredentialBootstrap = Buffer.from(JSON.stringify({
      schema: "openxnet.sql-credentials.runtime.v1",
      credentials: {},
      databases: { [sqlDatabaseId]: sqlDatabasePath },
    }), "utf8").toString("base64");
    await core.start();
    const origin = await gateway.start();
    await manager.installFromDirectory(packDirectory);
    unsubscribe = await registerFeaturePackWorker({
      core,
      manager,
      supervisor,
      capability: "mcp",
      createDefinition: (pack) => ({
        capability: "mcp",
        command: pack.entrypointPath,
        arguments: [],
        workingDirectory: pack.rootDirectory,
        environment: {
          PYTHONIOENCODING: "utf-8",
          PYTHONUTF8: "1",
          OPENXNET_RUNTIME_ROLE: "mcp-worker",
          OPENXNET_USER_DATA_DIR: temporaryRoot,
          OPENXNET_MCP_NODE_RUNTIME_SOURCE_DIR: path.join(pack.rootDirectory, "node-runtime"),
          OPENXNET_MCP_CREDENTIALS_B64: mcpCredentialBootstrap,
          OPENXNET_SQL_CREDENTIALS_B64: sqlCredentialBootstrap,
          ELECTRON_NODE_EXEC: process.execPath,
          ELECTRON_NPM_CLI: npmCliPath,
        },
        requestTimeoutMs: 210_000,
        shutdownTimeoutMs: 10_000,
        idleTimeoutMs: 0,
      }),
    });
    if (unsubscribe === null) throw new Error("Installed MCP Pack was not discovered.");
    const dependencies = await requestWorker(origin, "mcp.dependencies", {});
    const homeAssistantStatus = await requestWorker(
      origin,
      "mcp.status",
      { integration: "home-assistant" },
    );
    const externalChromeStatus = await requestWorker(
      origin,
      "mcp.status",
      { integration: "chrome-external" },
    );
    const externalChromeStart = await requestWorker(
      origin,
      "mcp.integration.start",
      { integration: "chrome-external", configuration: { mcpName: "browser-mcp" } },
    );
    const externalChromeTools = await requestWorker(
      origin,
      "mcp.tools.list",
      { integration: "chrome-external", configuration: { mcpName: "browser-mcp" } },
    );
    const externalChromeStop = await requestWorker(
      origin,
      "mcp.integration.stop",
      { integration: "chrome-external" },
    );
    const sqlConfiguration = { engine: "sqlite", databaseId: sqlDatabaseId };
    const sqlStatus = await requestWorker(origin, "mcp.status", { integration: "sql" });
    const sqlStart = await requestWorker(
      origin,
      "mcp.integration.start",
      { integration: "sql", configuration: sqlConfiguration },
    );
    const sqlTools = await requestWorker(
      origin,
      "mcp.tools.list",
      { integration: "sql", configuration: sqlConfiguration },
    );
    const sqlTableResult = await requestWorker(
      origin,
      "mcp.tools.call",
      {
        integration: "sql",
        configuration: sqlConfiguration,
        toolName: "all_table_names",
        arguments: {},
      },
    );
    const sqlQueryResult = await requestWorker(
      origin,
      "mcp.tools.call",
      {
        integration: "sql",
        configuration: sqlConfiguration,
        toolName: "execute_query",
        arguments: { query: "SELECT value FROM phase3aq_sql_smoke" },
      },
    );
    const sqlStop = await requestWorker(origin, "mcp.integration.stop", { integration: "sql" });
    const genericConfiguration = {
      transport: "streamable-http",
      url: genericSmokeServer.url,
    };
    const genericStatus = await requestWorker(
      origin,
      "mcp.status",
      { integration: "generic:pack-smoke" },
    );
    const genericStart = await requestWorker(
      origin,
      "mcp.integration.start",
      { integration: "generic:pack-smoke", configuration: genericConfiguration },
    );
    const genericTools = await requestWorker(
      origin,
      "mcp.tools.list",
      { integration: "generic:pack-smoke", configuration: genericConfiguration },
    );
    const genericEchoResult = await requestWorker(
      origin,
      "mcp.tools.call",
      {
        integration: "generic:pack-smoke",
        configuration: genericConfiguration,
        toolName: "phase3ar_echo",
        arguments: { value: "packaged-worker" },
      },
    );
    const genericStop = await requestWorker(
      origin,
      "mcp.integration.stop",
      { integration: "generic:pack-smoke" },
    );
    const unavailable = Object.entries(dependencies.dependencies ?? {})
      .filter(([, available]) => available !== true)
      .map(([moduleName]) => moduleName);
    if (unavailable.length > 0) {
      throw new Error(`Packaged MCP dependencies are unavailable: ${unavailable.join(", ")}`);
    }
    if (
      homeAssistantStatus?.is_running !== false
      || homeAssistantStatus?.message !== "MCP 集成已停止"
      || externalChromeStatus?.is_running !== false
      || externalChromeStatus?.message !== "MCP 集成已停止"
      || externalChromeStart?.is_running !== true
      || !Array.isArray(externalChromeTools?.tools)
      || externalChromeTools.tools.length < 1
      || externalChromeStop?.is_running !== false
      || sqlStatus?.is_running !== false
      || sqlStart?.is_running !== true
      || !Array.isArray(sqlTools?.tools)
      || sqlTools.tools.length !== 4
      || !JSON.stringify(sqlTableResult).includes("phase3aq_sql_smoke")
      || !JSON.stringify(sqlQueryResult).includes("ready")
      || sqlStop?.is_running !== false
      || genericStatus?.is_running !== false
      || genericStart?.is_running !== true
      || !Array.isArray(genericTools?.tools)
      || !genericTools.tools.some((tool) => tool?.function?.name === "phase3ar_echo")
      || !JSON.stringify(genericEchoResult).includes("phase3ar-ready")
      || !JSON.stringify(genericEchoResult).includes("packaged-worker")
      || genericStop?.is_running !== false
    ) {
      throw new Error(`Unexpected packaged MCP status: ${JSON.stringify({
        homeAssistantStatus,
        externalChromeStatus,
        externalChromeStart,
        externalChromeTools,
        externalChromeStop,
        sqlStatus,
        sqlStart,
        sqlTools,
        sqlTableResult,
        sqlQueryResult,
        sqlStop,
        genericStatus,
        genericStart,
        genericTools,
        genericEchoResult,
        genericStop,
      })}`);
    }
    process.stdout.write(`${JSON.stringify({
      dependencies,
      statuses: {
        homeAssistantStatus,
        externalChromeStatus,
        externalChromeStart,
        externalChromeStop,
        sqlStatus,
        sqlStart,
        sqlStop,
      },
      externalChrome: {
        toolCount: externalChromeTools.tools.length,
        firstTools: externalChromeTools.tools.slice(0, 5).map(
          (tool) => tool?.function?.name ?? null,
        ),
      },
      sql: {
        toolCount: sqlTools.tools.length,
        tools: sqlTools.tools.map((tool) => tool?.function?.name ?? null),
        tableVerified: JSON.stringify(sqlTableResult).includes("phase3aq_sql_smoke"),
        queryVerified: JSON.stringify(sqlQueryResult).includes("ready"),
      },
      generic: {
        transport: genericConfiguration.transport,
        toolCount: genericTools.tools.length,
        tools: genericTools.tools.map((tool) => tool?.function?.name ?? null),
        callVerified: JSON.stringify(genericEchoResult).includes("phase3ar-ready"),
        credentialRedacted: !JSON.stringify({
          genericConfiguration,
          genericStatus,
          genericStart,
          genericTools,
          genericEchoResult,
          genericStop,
        }).includes(genericToken),
      },
    }, null, 2)}\n`);
  } finally {
    unsubscribe?.();
    await gateway.stop();
    await supervisor.stopAll();
    await core.stop();
    await stopGenericSmokeServer(genericSmokeServer?.child);
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
