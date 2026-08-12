"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

/** Flush promise callbacks queued by the startup scheduler. */
async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

/** Extract one Renderer method body between stable neighboring method declarations. */
function extractRendererMethod(source, methodName, nextMethodName) {
  const start = source.indexOf(methodName);
  const end = source.indexOf(nextMethodName, start + methodName.length);
  assert.ok(start >= 0, `Renderer method '${methodName}' is missing`);
  assert.ok(end > start, `Renderer method boundary '${nextMethodName}' is missing`);
  return source.slice(start, end);
}

/** Assert that one Desktop typed IPC branch appears before its browser HTTP fallback. */
function assertTypedIpcPrecedesFallback(source, typedCall, fallbackCall) {
  const typedIndex = source.indexOf(typedCall);
  const fallbackIndex = source.indexOf(fallbackCall);
  assert.ok(typedIndex >= 0, `Typed IPC call '${typedCall}' is missing`);
  assert.ok(fallbackIndex >= 0, `Browser fallback '${fallbackCall}' is missing`);
  assert.ok(typedIndex < fallbackIndex, `Typed IPC call '${typedCall}' must precede its fallback`);
}

/** Create an isolated browser-like context for the Renderer startup bootstrap. */
function createStartupHarness() {
  const idleCallbacks = [];
  const eventListeners = new Map();
  let elapsedMs = 0;
  const window = {
    /** Record one browser lifecycle listener for the isolated harness. */
    addEventListener(name, listener) {
      eventListeners.set(name, listener);
    },
    /** Capture an idle callback so the test controls when it may run. */
    requestIdleCallback(callback) {
      idleCallbacks.push(callback);
      return idleCallbacks.length;
    },
    /** Run fallback timers synchronously inside the deterministic harness. */
    setTimeout(callback) {
      callback();
      return 1;
    },
  };
  const document = {
    /** Record one document lifecycle listener for the isolated harness. */
    addEventListener(name, listener) {
      eventListeners.set(name, listener);
    },
    documentElement: {
      /** Accept bootstrap theme attributes without requiring a browser DOM. */
      setAttribute() {},
    },
  };
  const context = vm.createContext({
    console,
    document,
    performance: {
      /** Advance deterministic startup time by one millisecond per read. */
      now() {
        elapsedMs += 1;
        return elapsedMs;
      },
    },
    Promise,
    window,
  });
  const sourcePath = path.resolve(__dirname, "../static/js/startup-bootstrap.js");
  vm.runInContext(fs.readFileSync(sourcePath, "utf8"), context, { filename: sourcePath });
  return { idleCallbacks, startup: window.openxnetStartup };
}

test("deferred Renderer tasks wait for workspace readiness and run once per idle slice", async () => {
  const harness = createStartupHarness();
  const executedTasks = [];
  const firstPromise = harness.startup.scheduleIdleTask("first-task", () => {
    executedTasks.push("first");
    return "first-result";
  });
  const duplicatePromise = harness.startup.scheduleIdleTask("first-task", () => {
    executedTasks.push("duplicate");
  });
  const secondPromise = harness.startup.scheduleIdleTask("second-task", () => {
    executedTasks.push("second");
    return "second-result";
  });

  assert.equal(duplicatePromise, firstPromise);
  await flushMicrotasks();
  assert.deepEqual(executedTasks, []);
  assert.equal(harness.idleCallbacks.length, 0);

  harness.startup.releaseDeferredWork();
  await flushMicrotasks();
  assert.equal(harness.idleCallbacks.length, 1);

  harness.idleCallbacks.shift()({ didTimeout: false, timeRemaining: () => 10 });
  await flushMicrotasks();
  assert.deepEqual(executedTasks, ["first"]);
  assert.equal(harness.idleCallbacks.length, 1);

  harness.idleCallbacks.shift()({ didTimeout: false, timeRemaining: () => 10 });
  assert.deepEqual(await Promise.all([firstPromise, secondPromise]), ["first-result", "second-result"]);
  assert.deepEqual(executedTasks, ["first", "second"]);

  const taskStates = harness.startup.snapshot().deferredTasks;
  assert.deepEqual(
    Array.from(taskStates, (entry) => [entry.name, entry.status]),
    [["first-task", "completed"], ["second-task", "completed"]],
  );
});

test("desktop account access uses typed IPC and only consumes redacted auth metadata", () => {
  const rendererMethods = fs.readFileSync(
    path.resolve(__dirname, "../static/js/vue_methods.js"),
    "utf8",
  );
  const uiPlanMethods = fs.readFileSync(
    path.resolve(__dirname, "../static/uiplan/app.js"),
    "utf8",
  );
  const preload = fs.readFileSync(
    path.resolve(__dirname, "../static/js/preload.js"),
    "utf8",
  );
  assert.doesNotMatch(rendererMethods, /localStorage\.setItem\(this\.getAuthSessionStorageKey\(\)/);
  assert.doesNotMatch(uiPlanMethods, /localStorage\.setItem\(ACCESS_AUTH_STORAGE_KEY/);
  assert.match(rendererMethods, /window\.openxnetDesktop\?\.saveAuthSession/);
  assert.match(uiPlanMethods, /window\.openxnetDesktop\.saveAuthSession/);
  assert.match(rendererMethods, /window\.openxnetDesktop\.requestAccess/);
  assert.match(uiPlanMethods, /window\.openxnetDesktop\.requestAccess/);
  assert.match(rendererMethods, /accessTokenConfigured/);
  assert.match(uiPlanMethods, /accessTokenConfigured/);
  assert.doesNotMatch(rendererMethods, /snapshot\.authSession\?\.accessToken\s*\|\|/);
  assert.doesNotMatch(uiPlanMethods, /snapshot\.authSession\?\.accessToken\s*\|\|/);
  assert.match(preload, /openxnet:application-auth:save-session/);
  assert.match(preload, /openxnet:application-access:request/);
});

test("desktop file metadata routes through the typed Core artifact boundary", () => {
  const rendererMethods = fs.readFileSync(
    path.resolve(__dirname, "../static/js/vue_methods.js"),
    "utf8",
  );
  const uiPlanMethods = fs.readFileSync(
    path.resolve(__dirname, "../static/uiplan/app.js"),
    "utf8",
  );
  const preload = fs.readFileSync(
    path.resolve(__dirname, "../static/js/preload.js"),
    "utf8",
  );
  const main = fs.readFileSync(path.resolve(__dirname, "../main.js"), "utf8");
  assert.match(rendererMethods, /window\.openxnetDesktop\?\.listArtifacts/);
  assert.match(rendererMethods, /window\.openxnetDesktop\.importArtifacts\(\{ paths \}\)/);
  assert.match(rendererMethods, /window\.openxnetDesktop\.importSelectedArtifacts\(selectedFiles\)/);
  assert.match(rendererMethods, /window\.openxnetDesktop\.registerArtifacts\(\{ files \}\)/);
  assert.match(rendererMethods, /window\.openxnetDesktop\.deleteArtifacts\(\{ artifactIds \}\)/);
  assert.match(uiPlanMethods, /window\.openxnetDesktop\.listArtifacts\(\{\}\)/);
  assert.match(preload, /openxnet:application-artifacts:import-files/);
  assert.match(preload, /openxnet:application-artifacts:import-renderer-files/);
  assert.match(preload, /webUtils\.getPathForFile\(file\)/);
  assert.match(preload, /openxnet:application-artifacts:delete/);
  assert.equal((rendererMethods.match(/fetch\((?:`|')\/load_file/g) || []).length, 2);
  const nativeComposerPicker = rendererMethods.slice(
    rendererMethods.indexOf('async browseAllFiles()'),
    rendererMethods.indexOf('// 文件验证方法'),
  );
  assert.match(nativeComposerPicker, /addApplicationArtifactPathsToComposer\(paths\)/);
  assert.doesNotMatch(nativeComposerPicker, /electronAPI\.readFile/);
  assert.match(main, /artifactRoot: path\.join\(app\.getPath\('userData'\), 'uploaded_files'\)/);
});

test("desktop task persistence and execution route through typed Core boundaries", () => {
  const rendererMethods = fs.readFileSync(
    path.resolve(__dirname, "../static/js/vue_methods.js"),
    "utf8",
  );
  const uiPlanMethods = fs.readFileSync(
    path.resolve(__dirname, "../static/uiplan/app.js"),
    "utf8",
  );
  const preload = fs.readFileSync(
    path.resolve(__dirname, "../static/js/preload.js"),
    "utf8",
  );
  assert.match(rendererMethods, /window\.openxnetDesktop\?\.listTasks/);
  assert.match(rendererMethods, /window\.openxnetDesktop\?\.getTask/);
  assert.match(rendererMethods, /window\.openxnetDesktop\.createTask/);
  assert.match(rendererMethods, /window\.openxnetDesktop\.refreshTaskExecutions/);
  assert.match(rendererMethods, /window\.openxnetDesktop\.getTaskExecution/);
  assert.match(rendererMethods, /window\.openxnetDesktop\.createDeveloperWorkbenchTaskExecution/);
  assert.match(rendererMethods, /window\.openxnetDesktop\.dispatchTaskExecution/);
  assert.match(rendererMethods, /window\.openxnetDesktop\.startTaskExecution/);
  assert.match(rendererMethods, /window\.openxnetDesktop\.resumeTaskExecution/);
  assert.match(rendererMethods, /window\.openxnetDesktop\.cancelTaskExecution/);
  assert.match(rendererMethods, /window\.openxnetDesktop\.deleteTaskExecution/);
  assert.match(uiPlanMethods, /window\.openxnetDesktop\?\.listTasks/);
  assert.match(uiPlanMethods, /window\.openxnetDesktop\?\.getTask/);
  assert.match(uiPlanMethods, /window\.openxnetDesktop\.createTask/);
  assert.match(uiPlanMethods, /window\.openxnetDesktop\.refreshTaskExecutions/);
  assert.match(uiPlanMethods, /window\.openxnetDesktop\.dispatchTaskExecution/);
  assert.match(uiPlanMethods, /window\.openxnetDesktop\.startTaskExecution/);
  assert.match(uiPlanMethods, /window\.openxnetDesktop\.resumeTaskExecution/);
  assert.match(uiPlanMethods, /window\.openxnetDesktop\.cancelTaskExecution/);
  assert.match(uiPlanMethods, /window\.openxnetDesktop\.deleteTaskExecution/);
  assert.doesNotMatch(rendererMethods, /\/v1\/tasks/);
  assert.doesNotMatch(rendererMethods, /\/v1\/dev\/workbench\/tasks\/create/);
  assert.doesNotMatch(uiPlanMethods, /\/v1\/tasks/);
  assert.match(preload, /openxnet:application-tasks:create/);
  assert.match(preload, /openxnet:application-tasks:get/);
  assert.match(preload, /openxnet:application-task-execution:refresh/);
  assert.match(preload, /openxnet:application-task-execution:create-workbench/);
  assert.match(preload, /openxnet:application-task-execution:changed/);
  assert.doesNotMatch(preload, /openxnet:application-tasks:reconcile/);
  assert.doesNotMatch(preload, /openxnet:application-tasks:transition/);
  assert.doesNotMatch(preload, /openxnet:application-tasks:delete/);
});

test("desktop startup restores legacy Vue state without activating backend WebSockets", () => {
  const renderer = fs.readFileSync(
    path.resolve(__dirname, "../static/js/renderer.js"),
    "utf8",
  );
  const rendererMethods = fs.readFileSync(
    path.resolve(__dirname, "../static/js/vue_methods.js"),
    "utf8",
  );
  const preload = fs.readFileSync(
    path.resolve(__dirname, "../static/js/preload.js"),
    "utf8",
  );
  const mountedStart = renderer.indexOf("async mounted() {");
  const mountedEnd = renderer.indexOf("beforeUnmount()", mountedStart);
  const mountedSource = renderer.slice(mountedStart, mountedEnd);

  assert.match(mountedSource, /await this\.initializeLegacyRendererState\(\)/);
  assert.match(mountedSource, /mark\('legacy-renderer-state-ready'\)/);
  assert.doesNotMatch(mountedSource, /this\.initWebSocket\(\)/);
  assert.match(mountedSource, /if \(!isElectron\) \{\s*this\.loadAccessPlans/);
  assert.match(rendererMethods, /window\.openxnetDesktop\?\.getLegacyRendererState/);
  assert.match(rendererMethods, /window\.openxnetDesktop\.saveLegacyRendererSettings/);
  assert.match(rendererMethods, /window\.openxnetDesktop\.saveLegacyRendererConversations/);
  assert.match(rendererMethods, /window\.openxnetDesktop\.saveLegacyRendererVrmConfig/);
  assert.match(rendererMethods, /if \(isElectron\) return;\s*this\.initTTSWebSocket\(\)/);
  assert.match(rendererMethods, /menu === 'task-center' \|\| \(!isElectron && menu === 'home'\)/);
  const workspaceWatcher = renderer.slice(
    renderer.indexOf("'CLISettings.cc_path': function"),
    renderer.indexOf("'searchEngine': function"),
  );
  assert.match(workspaceWatcher, /skillsSurfaceActive/);
  assert.match(workspaceWatcher, /normalizedPath && skillsSurfaceActive/);
  assert.equal((workspaceWatcher.match(/fetchProjectSkillsStatus/g) || []).length, 1);
  assert.match(preload, /openxnet:legacy-renderer-state:get-snapshot/);
  assert.match(preload, /openxnet:legacy-renderer-state:save-conversations/);
});

test("desktop project directory persistence unwraps Vue proxies and reports the failing stage", () => {
  const rendererMethods = fs.readFileSync(
    path.resolve(__dirname, "../static/js/vue_methods.js"),
    "utf8",
  );
  const autoSave = extractRendererMethod(
    rendererMethods,
    "async autoSaveSettings()",
    "async saveVRMConfig()",
  );
  const browseDirectory = extractRendererMethod(
    rendererMethods,
    "async browseDirectory()",
    "_toggleHighlight(e)",
  );

  assert.match(
    autoSave,
    /const payload = JSON\.parse\(JSON\.stringify\(this\.buildLegacyRendererSettingsPayload\(\)\)\)/,
  );
  assert.match(autoSave, /saveLegacyRendererSettings\(\{ settings: payload \}\)/);
  assert.ok(
    browseDirectory.indexOf("openDirectoryDialog()") < browseDirectory.indexOf("await this.autoSaveSettings()"),
  );
  assert.match(browseDirectory, /const previousPath = String\(this\.CLISettings\?\.cc_path \|\| ''\)/);
  assert.match(browseDirectory, /this\.CLISettings\.cc_path = previousPath/);
  assert.match(browseDirectory, /选择项目目录失败/);
  assert.match(browseDirectory, /项目目录保存失败，请重试/);
});

test("desktop provider credentials use typed IPC and return only configured metadata", () => {
  const rendererMethods = fs.readFileSync(
    path.resolve(__dirname, "../static/js/vue_methods.js"),
    "utf8",
  );
  const preload = fs.readFileSync(
    path.resolve(__dirname, "../static/js/preload.js"),
    "utf8",
  );
  const rendererData = fs.readFileSync(
    path.resolve(__dirname, "../static/js/vue_data.js"),
    "utf8",
  );
  const cliTool = fs.readFileSync(
    path.resolve(__dirname, "../py/cli_tool.py"),
    "utf8",
  );
  assert.match(rendererMethods, /window\.openxnetDesktop\.saveApplicationProviders/);
  assert.match(rendererMethods, /window\.openxnetDesktop\.validateApplicationProvider/);
  assert.match(rendererMethods, /apiKey:\s*''/);
  assert.match(rendererMethods, /apiKeyConfigured:\s*provider\?\.apiKeyConfigured === true/);
  assert.match(preload, /openxnet:application-providers:get-snapshot/);
  assert.match(preload, /openxnet:application-providers:save/);
  assert.match(preload, /openxnet:application-providers:validate/);

  const providerModels = extractRendererMethod(
    rendererMethods,
    "async fetchModelsForProvider(provider)",
    "async validateProviderCard(provider, options = {})",
  );
  const providerValidation = extractRendererMethod(
    rendererMethods,
    "async validateProviderCard(provider, options = {})",
    "async applyProviderCardToMain(provider)",
  );
  const providerApply = extractRendererMethod(
    rendererMethods,
    "async applyProviderCardToMain(provider)",
    "async removeProvider(index)",
  );
  const workbenchValidation = extractRendererMethod(
    rendererMethods,
    "async validateDevWorkbenchProviderDraft()",
    "async applyDevWorkbenchProviderDraft()",
  );
  const workbenchApply = extractRendererMethod(
    rendererMethods,
    "async applyDevWorkbenchProviderDraft()",
    "async validateDevWorkbenchGatewayProviderDraft()",
  );
  assertTypedIpcPrecedesFallback(
    providerModels,
    "validateApplicationProvider",
    "fetch(`/v1/providers/models`",
  );
  assertTypedIpcPrecedesFallback(
    providerValidation,
    "validateApplicationProvider",
    "fetch('/v1/dev/workbench/provider/validate'",
  );
  assertTypedIpcPrecedesFallback(
    providerApply,
    "saveApplicationProviders",
    "fetch('/v1/dev/workbench/provider/apply'",
  );
  assertTypedIpcPrecedesFallback(
    workbenchValidation,
    "validateApplicationProvider",
    "fetch('/v1/dev/workbench/provider/validate'",
  );
  assertTypedIpcPrecedesFallback(
    workbenchApply,
    "saveApplicationProviders",
    "fetch('/v1/dev/workbench/provider/apply'",
  );
  assert.doesNotMatch(rendererMethods, /'Ollama':\s*'ollama'/);
  assert.doesNotMatch(rendererMethods, /'Vllm':\s*'Vllm'/);
  const externalCliSelection = extractRendererMethod(
    rendererMethods,
    "async selectCCProvider(providerId)",
    "async selectBrainProvider(providerId)",
  );
  assert.doesNotMatch(externalCliSelection, /api_key\s*=\s*provider\.apiKey/);
  assert.match(externalCliSelection, /api_key_configured/);
  assert.doesNotMatch(rendererMethods, /getCCSwitchAuthJson|getCCSwitchConfigToml/);
  assert.match(rendererData, /ccSettings:[\s\S]*?api_key_configured:\s*false/);
  assert.match(rendererData, /qcSettings:[\s\S]*?api_key_configured:\s*false/);
  assert.match(rendererData, /ocSettings:[\s\S]*?api_key_configured:\s*false/);
  assert.doesNotMatch(cliTool, /auth\.json|export OPENAI_API_KEY/);
  assert.match(cliTool, /normalized_name\.startswith\("OPENXNET_"\)/);
  assert.match(cliTool, /_build_codex_wsl_environment/);
});

test("desktop search credentials use typed IPC and configured-only Renderer state", () => {
  const rendererData = fs.readFileSync(
    path.resolve(__dirname, "../static/js/vue_data.js"),
    "utf8",
  );
  const rendererMethods = fs.readFileSync(
    path.resolve(__dirname, "../static/js/vue_methods.js"),
    "utf8",
  );
  const preload = fs.readFileSync(
    path.resolve(__dirname, "../static/js/preload.js"),
    "utf8",
  );
  const main = fs.readFileSync(path.resolve(__dirname, "../main.js"), "utf8");
  assert.doesNotMatch(rendererData, /Crawl4Ai_api_key:\s*['"]test_api_code['"]/);
  assert.match(rendererMethods, /window\.openxnetDesktop\.getApplicationSearchCredentials/);
  assert.match(rendererMethods, /window\.openxnetDesktop\.saveApplicationSearchCredentials/);
  assert.match(rendererMethods, /applyApplicationSearchCredentialSnapshot/);
  assert.match(rendererMethods, /isApplicationSearchCredentialConfigured\('tavily'\)/);
  assert.match(preload, /openxnet:application-search-credentials:get-snapshot/);
  assert.match(preload, /openxnet:application-search-credentials:save/);
  assert.match(main, /OPENXNET_SEARCH_CREDENTIALS_B64/);
});

test("desktop voice credentials use scoped typed IPC and configured-only Renderer state", () => {
  const rendererMethods = fs.readFileSync(
    path.resolve(__dirname, "../static/js/vue_methods.js"),
    "utf8",
  );
  const rendererHtml = fs.readFileSync(
    path.resolve(__dirname, "../static/index.html"),
    "utf8",
  );
  const preload = fs.readFileSync(
    path.resolve(__dirname, "../static/js/preload.js"),
    "utf8",
  );
  const main = fs.readFileSync(path.resolve(__dirname, "../main.js"), "utf8");
  const voiceRuntime = main.slice(
    main.indexOf("capability: 'voice'"),
    main.indexOf("capability: 'vector-index'"),
  );
  const desktopVoiceTranscription = rendererMethods.slice(
    rendererMethods.indexOf("async transcribeDesktopVoiceBlob"),
    rendererMethods.indexOf("async initASRWebSocket"),
  );
  assert.match(rendererMethods, /window\.openxnetDesktop\.getApplicationVoiceCredentials/);
  assert.match(rendererMethods, /window\.openxnetDesktop\.saveApplicationVoiceCredentials/);
  assert.match(rendererMethods, /buildLegacyTtsSettingsPayload/);
  assert.match(rendererMethods, /applyApplicationVoiceCredentialSnapshot/);
  assert.match(rendererMethods, /credentialScope:\s*s\.name \|\| 'default'/);
  assert.match(rendererHtml, /markApplicationVoiceCredentialForSave\('default', 'azureSpeechKey'\)/);
  assert.match(rendererHtml, /markApplicationVoiceDraftCredentialForSave\('fishApiKey'\)/);
  assert.match(preload, /openxnet:application-voice-credentials:get-snapshot/);
  assert.match(preload, /openxnet:application-voice-credentials:save/);
  assert.match(preload, /openxnet:application-voice-runtime:transcribe/);
  assert.match(preload, /transcribeApplicationVoice/);
  assert.match(main, /OPENXNET_VOICE_CREDENTIALS_B64/);
  assert.match(voiceRuntime, /OPENXNET_RUNTIME_ROLE: 'voice-worker'/);
  assert.match(voiceRuntime, /OPENXNET_VOICE_CREDENTIALS_B64/);
  assert.match(voiceRuntime, /OPENXNET_PROVIDER_CREDENTIALS_B64/);
  assert.match(main, /applicationVoiceCredentials\.subscribe\(\s*invalidateVoiceCredentialRuntimes/);
  assert.match(main, /workerSupervisor\.stop\('voice'\)/);
  assert.match(main, /ApplicationVoiceRuntimeService/);
  assert.match(main, /registerApplicationVoiceRuntimeIpc/);
  assert.match(rendererMethods, /isDesktopVoiceRuntimeAvailable/);
  assert.match(rendererMethods, /window\.openxnetDesktop\.transcribeApplicationVoice/);
  assert.match(rendererMethods, /audio:\s*await wavBlob\.arrayBuffer\(\)/);
  assert.match(
    rendererMethods,
    /if \(this\.isDesktopVoiceRuntimeAvailable\(\)\) \{\s*this\.asrWs = null;\s*return;/,
  );
  assert.doesNotMatch(desktopVoiceTranscription, /btoa\(|new WebSocket|\/ws\/asr/);
  assert.match(rendererMethods, /const ws_url = `\$\{ws_protocol\}\/\/\$\{window\.location\.host\}\/ws\/asr`/);
});

test("desktop MCP and custom HTTP credentials use independent least-privilege boundaries", () => {
  const rendererMethods = fs.readFileSync(
    path.resolve(__dirname, "../static/js/vue_methods.js"),
    "utf8",
  );
  const rendererHtml = fs.readFileSync(
    path.resolve(__dirname, "../static/index.html"),
    "utf8",
  );
  const preload = fs.readFileSync(
    path.resolve(__dirname, "../static/js/preload.js"),
    "utf8",
  );
  const main = fs.readFileSync(path.resolve(__dirname, "../main.js"), "utf8");
  const customHttp = fs.readFileSync(
    path.resolve(__dirname, "../py/custom_http.py"),
    "utf8",
  );
  assert.match(rendererMethods, /window\.openxnetDesktop\.getApplicationMcpCredentials/);
  assert.match(rendererMethods, /window\.openxnetDesktop\.saveApplicationMcpCredentials/);
  assert.match(rendererMethods, /window\.openxnetDesktop\.getApplicationHttpToolCredentials/);
  assert.match(rendererMethods, /window\.openxnetDesktop\.saveApplicationHttpToolCredentials/);
  assert.match(rendererMethods, /buildLegacyMcpServersPayload/);
  assert.match(rendererMethods, /buildLegacyHttpToolSettingsPayload/);
  assert.match(rendererHtml, /newMCPFormData\.apiKeyConfigured/);
  assert.match(rendererHtml, /getApplicationHttpToolCredentialPlaceholder/);
  assert.match(preload, /openxnet:application-mcp-credentials:get-snapshot/);
  assert.match(preload, /openxnet:application-http-tool-credentials:get-snapshot/);
  assert.match(main, /OPENXNET_MCP_CREDENTIALS_B64/);
  assert.match(main, /OPENXNET_HTTP_TOOL_CREDENTIALS_B64/);
  const executionLaunchStart = main.indexOf("function createExecutionEngineLaunch");
  const executionLaunch = main.slice(
    executionLaunchStart,
    main.indexOf("executionEngineSupervisor = new", executionLaunchStart),
  );
  const mcpLaunch = main.slice(
    main.indexOf("capability: 'mcp'"),
    main.indexOf("async function startWorkerRpcGateway"),
  );
  assert.doesNotMatch(executionLaunch, /OPENXNET_MCP_CREDENTIALS_B64/);
  assert.doesNotMatch(mcpLaunch, /OPENXNET_MCP_CREDENTIALS_B64/);
  assert.doesNotMatch(customHttp, /print\(f?['"]headers:/);
});

test("desktop generic MCP uses typed Runtime and disables legacy direct connections", () => {
  const rendererMethods = fs.readFileSync(
    path.resolve(__dirname, "../static/js/vue_methods.js"),
    "utf8",
  );
  const rendererHtml = fs.readFileSync(
    path.resolve(__dirname, "../static/index.html"),
    "utf8",
  );
  const server = fs.readFileSync(path.resolve(__dirname, "../server.py"), "utf8");
  const executionInit = server.slice(
    server.indexOf("mcp_init_tasks = []"),
    server.indexOf("# --- [Synapse Registry", server.indexOf("mcp_init_tasks = []")),
  );
  assert.match(rendererMethods, /isDesktopGenericMcpRuntimeAvailable/);
  assert.match(rendererMethods, /startApplicationMcpRuntime/);
  assert.match(rendererMethods, /listApplicationMcpRuntimeTools/);
  assert.match(rendererMethods, /Desktop.*stdio MCP/);
  assert.match(rendererHtml, /:disabled="isDesktopGenericMcpRuntimeAvailable\(\)"/);
  assert.match(executionInit, /if RUNTIME_PROFILE != "server":/);
  assert.match(executionInit, /elif settings and settings\.get\('mcpServers'\):/);
  assert.ok(
    executionInit.indexOf('if RUNTIME_PROFILE != "server":')
      < executionInit.indexOf("mcp_init_tasks = [asyncio.create_task"),
  );
});

test("desktop knowledge base uses Core artifacts and typed Execution Engine routes", () => {
  const rendererMethods = fs.readFileSync(
    path.resolve(__dirname, "../static/js/vue_methods.js"),
    "utf8",
  );
  const preload = fs.readFileSync(
    path.resolve(__dirname, "../static/js/preload.js"),
    "utf8",
  );
  const main = fs.readFileSync(path.resolve(__dirname, "../main.js"), "utf8");
  const engineProfile = fs.readFileSync(
    path.resolve(__dirname, "../py/execution_engine_profile.py"),
    "utf8",
  );
  const engineApi = fs.readFileSync(
    path.resolve(__dirname, "../py/knowledge_base_engine_api.py"),
    "utf8",
  );
  const fileLoader = fs.readFileSync(path.resolve(__dirname, "../py/load_files.py"), "utf8");
  assert.match(rendererMethods, /importDesktopKnowledgeBaseArtifacts/);
  assert.match(rendererMethods, /window\.openxnetDesktop\.importArtifacts/);
  assert.match(rendererMethods, /buildApplicationKnowledgeBase/);
  assert.match(rendererMethods, /getApplicationKnowledgeBaseStatus/);
  assert.match(rendererMethods, /removeApplicationKnowledgeBase/);
  assert.match(rendererMethods, /queryApplicationKnowledgeBase/);
  assert.match(rendererMethods, /else \{\s*const startResponse = await fetch\(`\/create_kb`/);
  assert.match(rendererMethods, /else \{\s*const response = await fetch\('\/query_kb'/);
  assert.match(preload, /openxnet:application-knowledge-base-runtime:build/);
  assert.match(main, /ApplicationKnowledgeBaseRuntimeService/);
  assert.match(main, /acquireApplicationKnowledgeBaseEngine/);
  assert.match(engineProfile, /KNOWLEDGE_BASE_ENGINE_PATHS/);
  assert.match(engineApi, /\/v1\/desktop\/knowledge-base\/query/);
  assert.match(fileLoader, /resolve_internal_file_url/);
  const internalFileBranch = fileLoader.slice(
    fileLoader.indexOf("# --- 1. 内部上传文件处理逻辑 ---"),
    fileLoader.indexOf("# --- 2. 外部公网 URL 爬取逻辑 ---"),
  );
  assert.doesNotMatch(internalFileBranch, /ClientSession|session\.get|sanitize_url/);
});

test("desktop window control uses typed Runtime and an isolated Worker", () => {
  const rendererMethods = fs.readFileSync(
    path.resolve(__dirname, "../static/js/vue_methods.js"),
    "utf8",
  );
  const preload = fs.readFileSync(
    path.resolve(__dirname, "../static/js/preload.js"),
    "utf8",
  );
  const main = fs.readFileSync(path.resolve(__dirname, "../main.js"), "utf8");
  const controller = fs.readFileSync(
    path.resolve(__dirname, "../py/desktop_control_runtime.py"),
    "utf8",
  );
  const worker = fs.readFileSync(
    path.resolve(__dirname, "../py/workers/desktop_control_worker.py"),
    "utf8",
  );
  const desktopControlMethods = rendererMethods.slice(
    rendererMethods.indexOf("isDesktopControlRuntimeAvailable()"),
    rendererMethods.indexOf("async submitDevWorkbenchTask()"),
  );
  assert.match(desktopControlMethods, /listApplicationDesktopControlWindows/);
  assert.match(desktopControlMethods, /listApplicationDesktopControlMonitors/);
  assert.match(desktopControlMethods, /getApplicationDesktopControlActiveWindow/);
  assert.match(desktopControlMethods, /listApplicationDesktopControlHistory/);
  assert.match(desktopControlMethods, /executeApplicationDesktopControlAction/);
  assert.match(desktopControlMethods, /else \{\s*const response = await fetch\('\/api\/desktop\/active-window'/);
  assert.match(desktopControlMethods, /else \{\s*const response = await fetch\('\/api\/desktop\/monitors'/);
  assert.match(preload, /openxnet:application-desktop-control-runtime:list-windows/);
  assert.match(main, /ApplicationDesktopControlRuntimeService/);
  assert.match(main, /capability: 'desktop-control'/);
  assert.match(worker, /WorkerRuntime\("desktop-control"/);
  assert.match(controller, /"processName":/);
  assert.doesNotMatch(controller, /process_path|processPath/);
});

test("desktop toolchain probes and Docker operations use typed Main IPC", () => {
  const rendererMethods = fs.readFileSync(
    path.resolve(__dirname, "../static/js/vue_methods.js"),
    "utf8",
  );
  const preload = fs.readFileSync(
    path.resolve(__dirname, "../static/js/preload.js"),
    "utf8",
  );
  const main = fs.readFileSync(path.resolve(__dirname, "../main.js"), "utf8");
  const runtime = fs.readFileSync(
    path.resolve(__dirname, "../src/desktop/toolchain/application-toolchain-runtime.ts"),
    "utf8",
  );
  assert.match(rendererMethods, /probeApplicationToolchain\(\{ tool: 'node' \}\)/);
  assert.match(rendererMethods, /probeApplicationToolchain\(\{ tool: 'uv' \}\)/);
  assert.match(rendererMethods, /probeApplicationToolchain\(\{ tool: 'docker' \}\)/);
  assert.match(rendererMethods, /listApplicationDockerContainers/);
  assert.match(rendererMethods, /pullApplicationDockerImage/);
  assert.match(rendererMethods, /mutateApplicationDockerContainer/);
  assert.match(rendererMethods, /return;\s*}\s*const res = await fetch\('\/api\/node\/probe'/);
  assert.match(rendererMethods, /else \{\s*const response = await fetch\('\/api\/docker\/containers'/);
  assert.match(preload, /openxnet:application-toolchain-runtime:probe/);
  assert.match(main, /ApplicationToolchainRuntimeService/);
  assert.match(runtime, /shell: false/);
  assert.match(runtime, /normalizedName\.startsWith\("OPENXNET_"\)/);
  assert.doesNotMatch(runtime, /exec\(|shell: true/);
});

test("desktop Developer Workbench uses typed Main Runtime with Browser fallback", () => {
  const rendererMethods = fs.readFileSync(
    path.resolve(__dirname, "../static/js/vue_methods.js"),
    "utf8",
  );
  const preload = fs.readFileSync(
    path.resolve(__dirname, "../static/js/preload.js"),
    "utf8",
  );
  const main = fs.readFileSync(path.resolve(__dirname, "../main.js"), "utf8");
  const runtime = fs.readFileSync(
    path.resolve(__dirname, "../src/desktop/developer-workbench/application-developer-workbench-runtime.ts"),
    "utf8",
  );
  const snapshotList = extractRendererMethod(
    rendererMethods,
    "async loadDevPrototypeAgentSnapshots()",
    "async handleDevPrototypeCreateSnapshot()",
  );
  const repositories = extractRendererMethod(
    rendererMethods,
    "async loadDevPrototypeCodeRepos()",
    "async handleDevPrototypeReindexRepo(repo)",
  );
  const codeSearch = extractRendererMethod(
    rendererMethods,
    "async handleDevPrototypeCodeSearch()",
    "async handleDevPrototypeToggleMcp(row, enabled)",
  );
  const mappingApply = extractRendererMethod(
    rendererMethods,
    "async applyDevWorkbenchMappingDraft()",
    "async applyDevWorkbenchWorkspaceDraft()",
  );
  const workspaceApply = extractRendererMethod(
    rendererMethods,
    "async applyDevWorkbenchWorkspaceDraft()",
    "jumpToModelConfig()",
  );
  const overview = extractRendererMethod(
    rendererMethods,
    "async loadDevWorkbench()",
    "async refreshDesktopControlSurface(options = {})",
  );
  assertTypedIpcPrecedesFallback(
    snapshotList,
    "listApplicationDeveloperWorkbenchSnapshots",
    "fetch('/v1/dev/workbench/snapshots'",
  );
  assertTypedIpcPrecedesFallback(
    repositories,
    "listApplicationDeveloperWorkbenchRepositories",
    "fetch('/v1/dev/workbench/repositories'",
  );
  assertTypedIpcPrecedesFallback(
    codeSearch,
    "searchApplicationDeveloperWorkbenchCode",
    "fetch('/v1/dev/workbench/code/search'",
  );
  assertTypedIpcPrecedesFallback(
    mappingApply,
    "applyApplicationDeveloperWorkbenchMapping",
    "fetch('/v1/dev/workbench/mapping/apply'",
  );
  assertTypedIpcPrecedesFallback(
    workspaceApply,
    "applyApplicationDeveloperWorkbenchWorkspace",
    "fetch('/v1/dev/workbench/workspace/apply'",
  );
  assertTypedIpcPrecedesFallback(
    overview,
    "getApplicationDeveloperWorkbenchOverview",
    "fetch('/v1/dev/workbench/overview'",
  );
  assert.match(rendererMethods, /Desktop Developer Workbench Runtime is unavailable\./);
  assert.match(rendererMethods, /getApplicationDeveloperWorkbenchSnapshot/);
  assert.match(rendererMethods, /restoreApplicationDeveloperWorkbenchSnapshot/);
  assert.match(rendererMethods, /deleteApplicationDeveloperWorkbenchSnapshot/);
  assert.match(preload, /openxnet:application-developer-workbench:overview/);
  assert.match(preload, /openxnet:application-developer-workbench:apply-workspace/);
  assert.match(main, /ApplicationDeveloperWorkbenchRuntimeService/);
  assert.match(main, /assertAuthorizedDeveloperWorkspacePath/);
  assert.match(runtime, /MAX_SEARCH_TOTAL_BYTES/);
  assert.match(runtime, /\[redacted sensitive line\]/);
  assert.doesNotMatch(runtime, /spawn\(|exec\(|ensureCapability\(/);
});

test("desktop VR assets use typed Main Runtime and Gateway files with Browser fallback", () => {
  const rendererMethods = fs.readFileSync(
    path.resolve(__dirname, "../static/js/vue_methods.js"),
    "utf8",
  );
  const opsBridge = fs.readFileSync(
    path.resolve(__dirname, "../frontend/ops-vite/src/opsBridge.js"),
    "utf8",
  );
  const preload = fs.readFileSync(path.resolve(__dirname, "../static/js/preload.js"), "utf8");
  const main = fs.readFileSync(path.resolve(__dirname, "../main.js"), "utf8");
  const gateway = fs.readFileSync(
    path.resolve(__dirname, "../src/desktop/gateway/local-ui-gateway.ts"),
    "utf8",
  );
  const serverSpec = fs.readFileSync(path.resolve(__dirname, "../server.spec"), "utf8");
  const packageJson = fs.readFileSync(path.resolve(__dirname, "../package.json"), "utf8");
  const modelList = extractRendererMethod(
    rendererMethods,
    "async loadDefaultModels()",
    "async uploadVrmModel()",
  );
  const modelUpload = extractRendererMethod(
    rendererMethods,
    "async uploadVrmModel()",
    "async deleteModelOption(modelId)",
  );
  const motionList = extractRendererMethod(
    rendererMethods,
    "async loadDefaultMotions()",
    "handleMotionChange(value)",
  );
  const sceneList = extractRendererMethod(
    rendererMethods,
    "async loadGaussScenes()",
    "async handleGaussSceneChange(sceneId)",
  );
  const cloudDownload = opsBridge.slice(
    opsBridge.indexOf("async function downloadVrmModel(modelId)"),
    opsBridge.indexOf("async function toggleVrmMotion(motionId)"),
  );
  assertTypedIpcPrecedesFallback(
    modelList,
    "getApplicationVrAssetCatalog",
    "fetch(`/get_default_vrm_models`)",
  );
  assertTypedIpcPrecedesFallback(
    modelUpload,
    "importApplicationVrAsset",
    "fetch(`/upload_vrm_model`",
  );
  assertTypedIpcPrecedesFallback(
    motionList,
    "getApplicationVrAssetCatalog",
    "fetch(`/get_default_vrma_motions`)",
  );
  assertTypedIpcPrecedesFallback(
    sceneList,
    "getApplicationVrAssetCatalog",
    "fetch('/get_default_gauss_scenes')",
  );
  assertTypedIpcPrecedesFallback(
    cloudDownload,
    "downloadApplicationCloudVrmModel",
    "fetch(`/download_vrm_model/",
  );
  assert.match(rendererMethods, /deleteApplicationVrAsset\(\{ kind: 'model'/);
  assert.match(rendererMethods, /deleteApplicationVrAsset\(\{ kind: 'motion'/);
  assert.match(rendererMethods, /deleteApplicationVrAsset\(\{ kind: 'scene'/);
  assert.match(preload, /openxnet:application-vr-assets:list/);
  assert.match(preload, /webUtils\.getPathForFile\(file\)/);
  assert.match(main, /ApplicationVrAssetRuntimeService/);
  assert.match(main, /vrAssetRoot: getDesktopVrAssetRoot\(\)/);
  assert.match(gateway, /requestUrl\.pathname\.startsWith\("\/vrm\/"\)/);
  assert.match(packageJson, /"from": "vrm\/"/);
  assert.doesNotMatch(serverSpec, /collect_vrm_runtime_datas/);
});

test("desktop extensions and skills use typed Main Runtimes with isolated package boundaries", () => {
  const rendererMethods = fs.readFileSync(
    path.resolve(__dirname, "../static/js/vue_methods.js"),
    "utf8",
  );
  const preload = fs.readFileSync(path.resolve(__dirname, "../static/js/preload.js"), "utf8");
  const main = fs.readFileSync(path.resolve(__dirname, "../main.js"), "utf8");
  const extensionRuntime = fs.readFileSync(
    path.resolve(__dirname, "../src/desktop/extensions/application-extension-runtime.ts"),
    "utf8",
  );
  const extensionGateway = fs.readFileSync(
    path.resolve(__dirname, "../src/desktop/extensions/application-extension-gateway.ts"),
    "utf8",
  );
  const skillRuntime = fs.readFileSync(
    path.resolve(__dirname, "../src/desktop/skills/application-skill-runtime.ts"),
    "utf8",
  );
  const safeArchive = fs.readFileSync(
    path.resolve(__dirname, "../src/desktop/package-management/safe-package-archive.ts"),
    "utf8",
  );
  const indexHtml = fs.readFileSync(path.resolve(__dirname, "../static/index.html"), "utf8");
  const packageJson = fs.readFileSync(path.resolve(__dirname, "../package.json"), "utf8");
  const extensionList = extractRendererMethod(
    rendererMethods,
    "async scanExtensions()",
    "async loadExtension(extension)",
  );
  const extensionInstall = extractRendererMethod(
    rendererMethods,
    "async addExtension()",
    "selectLocalZip()",
  );
  const skillList = extractRendererMethod(
    rendererMethods,
    "async fetchSkills()",
    "async removeSkill(id)",
  );
  const skillInstall = extractRendererMethod(
    rendererMethods,
    "async installSkillFromGithub()",
    "triggerSkillFileSelect()",
  );
  const projectStatus = extractRendererMethod(
    rendererMethods,
    "async fetchProjectSkillsStatus()",
    "async syncToGlobal(skillId)",
  );
  assertTypedIpcPrecedesFallback(
    extensionList,
    "listApplicationExtensions",
    "fetch('/api/extensions/list')",
  );
  assertTypedIpcPrecedesFallback(
    extensionInstall,
    "installApplicationExtensionFromRepository",
    "fetch('/api/extensions/install-from-github'",
  );
  assertTypedIpcPrecedesFallback(
    skillList,
    "listApplicationSkills",
    "fetch('/api/skills/list')",
  );
  assertTypedIpcPrecedesFallback(
    skillInstall,
    "installApplicationSkillFromRepository",
    "fetch('/api/skills/install-from-github'",
  );
  assertTypedIpcPrecedesFallback(
    projectStatus,
    "getApplicationProjectSkillStatus",
    "fetch(`/api/skills/project-status",
  );
  assert.match(rendererMethods, /Desktop Extension Runtime is unavailable\./);
  assert.match(rendererMethods, /Desktop Skill Runtime is unavailable\./);
  assert.match(rendererMethods, /crystallizeApplicationSkill/);
  assert.match(rendererMethods, /importApplicationExtensionArchive/);
  assert.match(rendererMethods, /importApplicationSkillArchive/);
  assert.match(preload, /openxnet:application-extensions:install-repository/);
  assert.match(preload, /openxnet:application-skills:sync-project/);
  assert.match(preload, /webUtils\.getPathForFile\(file\)/);
  assert.match(main, /ApplicationExtensionRuntimeService/);
  assert.match(main, /ApplicationSkillRuntimeService/);
  assert.match(extensionRuntime, /ELECTRON_RUN_AS_NODE: "1"/);
  assert.match(extensionRuntime, /--ignore-scripts/);
  assert.doesNotMatch(extensionRuntime, /shell:\s*true/);
  assert.match(extensionGateway, /delete result\.authorization/);
  assert.match(skillRuntime, /settings\.CLISettings/);
  assert.doesNotMatch(skillRuntime, /project_path|projectPath/);
  assert.match(safeArchive, /ZIP symbolic links are not allowed/);
  assert.match(safeArchive, /maximumExtractedBytes/);
  assert.match(indexHtml, /sandbox="allow-scripts allow-forms allow-downloads allow-popups allow-same-origin"/);
  assert.match(packageJson, /"from": "skills\/"/);
});

test("desktop Recall Center uses typed Memory Worker IPC with Browser fallback", () => {
  const rendererMethods = fs.readFileSync(
    path.resolve(__dirname, "../static/js/vue_methods.js"),
    "utf8",
  );
  const preload = fs.readFileSync(
    path.resolve(__dirname, "../static/js/preload.js"),
    "utf8",
  );
  const main = fs.readFileSync(path.resolve(__dirname, "../main.js"), "utf8");
  const runtime = fs.readFileSync(
    path.resolve(__dirname, "../src/desktop/recall/application-recall-runtime.ts"),
    "utf8",
  );
  const worker = fs.readFileSync(
    path.resolve(__dirname, "../py/workers/memory_worker.py"),
    "utf8",
  );
  assert.match(rendererMethods, /getApplicationRecallBootstrap/);
  assert.match(rendererMethods, /searchApplicationRecall/);
  assert.match(rendererMethods, /getApplicationRecallTimeline/);
  assert.match(rendererMethods, /getApplicationRecallObservations/);
  assert.match(rendererMethods, /resumeApplicationRecall/);
  assert.match(rendererMethods, /rollbackApplicationRecall/);
  assert.match(rendererMethods, /publishApplicationRecallObservationFocus/);
  assert.match(rendererMethods, /else \{\s*const \[interruptedRes,[\s\S]*fetch\('\/v1\/memory\/overview'/);
  assert.match(preload, /openxnet:application-recall-runtime:bootstrap/);
  assert.match(main, /ApplicationRecallRuntimeService/);
  assert.match(main, /readRecallRuntimeScope/);
  assert.match(runtime, /ensureCapability\("memory"\)/);
  assert.match(runtime, /PRIVATE_RESPONSE_FIELDS/);
  assert.match(worker, /runtime\.register_handler\("recall\.bootstrap"/);
  assert.match(worker, /runtime\.register_handler\("recall\.rollback"/);
});

test("desktop Connector Worker credentials use configured-only Renderer state", () => {
  const rendererMethods = fs.readFileSync(
    path.resolve(__dirname, "../static/js/vue_methods.js"),
    "utf8",
  );
  const rendererHtml = fs.readFileSync(
    path.resolve(__dirname, "../static/index.html"),
    "utf8",
  );
  const preload = fs.readFileSync(
    path.resolve(__dirname, "../static/js/preload.js"),
    "utf8",
  );
  const main = fs.readFileSync(path.resolve(__dirname, "../main.js"), "utf8");
  const worker = fs.readFileSync(
    path.resolve(__dirname, "../py/workers/connector_worker.py"),
    "utf8",
  );
  const connectorManagerSources = [
    "qq_bot_manager.py",
    "feishu_bot_manager.py",
    "dingtalk_bot_manager.py",
    "discord_bot_manager.py",
    "slack_bot_manager.py",
  ].map((name) => fs.readFileSync(path.resolve(__dirname, "../py", name), "utf8"));
  const rendererComputed = fs.readFileSync(
    path.resolve(__dirname, "../static/js/renderer.js"),
    "utf8",
  );
  const desktopBotControls = rendererMethods.slice(
    rendererMethods.indexOf("// 启动QQ机器人"),
    rendererMethods.indexOf("// // 启动微信机器人"),
  );
  assert.match(rendererMethods, /window\.openxnetDesktop\.getApplicationConnectorCredentials/);
  assert.match(rendererMethods, /window\.openxnetDesktop\.saveApplicationConnectorCredentials/);
  assert.match(rendererMethods, /requestApplicationConnectorRuntime\(platform, operation\)/);
  assert.match(rendererMethods, /buildApplicationConnectorRuntimeConfiguration/);
  assert.match(rendererMethods, /delete configuration\[field\]/);
  assert.match(rendererMethods, /startApplicationConnectorRuntime/);
  assert.match(rendererMethods, /updateApplicationConnectorRuntime/);
  assert.match(rendererMethods, /configuration\.behaviorSettings/);
  assert.match(rendererMethods, /configuration\.toolMemorandumEnabled/);
  assert.match(rendererMethods, /synchronizeApplicationConnectorRuntimeSettings/);
  assert.match(rendererMethods, /getApplicationConnectorRuntimeStatus/);
  assert.match(rendererMethods, /buildLegacyConnectorSettingsPayload/);
  assert.match(rendererMethods, /credentialFieldsConfigured/);
  assert.match(rendererHtml, /clearApplicationConnectorCredential\('slack', 'app_token'\)/);
  assert.match(preload, /openxnet:application-connector-credentials:get-snapshot/);
  assert.match(preload, /openxnet:application-connector-runtime:status/);
  assert.match(preload, /openxnet:application-connector-runtime:start/);
  assert.match(preload, /openxnet:application-connector-runtime:stop/);
  assert.match(preload, /openxnet:application-connector-runtime:reload/);
  assert.match(preload, /openxnet:application-connector-runtime:update/);
  assert.match(main, /OPENXNET_CONNECTOR_CREDENTIALS_B64/);
  assert.match(main, /OPENXNET_CONNECTOR_CHAT_ORIGIN/);
  assert.match(main, /OPENXNET_CONNECTOR_CHAT_TOKEN/);
  assert.match(main, /ConnectorChatBrokerGateway/);
  assert.match(main, /upstreamToken:\s*taskRpcToken/);
  assert.match(main, /OPENXNET_CONNECTOR_VOICE_ORIGIN/);
  assert.match(main, /OPENXNET_CONNECTOR_VOICE_TOKEN/);
  assert.match(main, /OPENXNET_CONNECTOR_VOICE_EXCHANGE_DIR/);
  assert.match(main, /ConnectorVoiceBrokerGateway/);
  assert.match(main, /voice\.transcribe-configured/);
  assert.match(main, /voice\.synthesize/);
  assert.match(main, /transcribeConnectorVoiceThroughWorker/);
  assert.match(main, /synthesizeConnectorVoiceThroughWorker/);
  assert.doesNotMatch(main, /ensureConnectorVoiceCompatibilityOrigin/);
  assert.doesNotMatch(main, /transcribeConnectorVoiceThroughCompatibility/);
  assert.doesNotMatch(main, /synthesizeConnectorVoiceThroughCompatibility/);
  assert.doesNotMatch(main, /electronNet\.fetch\(`\$\{origin\}\/(?:tts|asr)/);
  assert.equal(
    (main.match(/\.\.\.getConnectorChatRuntimeEnvironment\(\)/g) || []).length,
    2,
  );
  assert.equal(
    (main.match(/\.\.\.getConnectorVoiceRuntimeEnvironment\(\)/g) || []).length,
    2,
  );
  assert.match(main, /ApplicationConnectorRuntimeService/);
  assert.match(main, /waitForCredentialRefresh:\s*\(\)\s*=>\s*connectorCredentialRuntimeInvalidation/);
  assert.match(main, /workerSupervisor\.stop\('connectors'\)/);
  const connectorRuntime = main.slice(
    main.indexOf("capability: 'connectors'"),
    main.indexOf("return {\n    gitnexus:"),
  );
  assert.doesNotMatch(
    connectorRuntime,
    /OPENXNET_VOICE_CREDENTIALS_B64|OPENXNET_PROVIDER_CREDENTIALS_B64/,
  );
  assert.doesNotMatch(
    main.slice(main.indexOf("function createExecutionEngineLaunch"), main.indexOf("executionEngineSupervisor =")),
    /OPENXNET_CONNECTOR_CREDENTIALS_B64|OPENXNET_CONNECTOR_CHAT_|OPENXNET_CONNECTOR_VOICE_|getConnector(?:Chat|Voice)RuntimeEnvironment/,
  );
  assert.match(worker, /apply_connector_credentials/);
  for (const managerSource of connectorManagerSources) {
    assert.doesNotMatch(managerSource, /\bload_settings\b/);
    assert.match(managerSource, /toolMemorandumEnabled/);
  }
  assert.match(rendererComputed, /isApplicationConnectorCredentialConfigured\('slack', 'app_token'\)/);
  assert.doesNotMatch(
    desktopBotControls,
    /\/(?:start|stop|reload)_(?:qq|feishu|dingtalk|discord|slack)_bot|\/(?:qq|feishu|dingtalk|discord|slack)_bot_status/,
  );
});

test("desktop Telegram credentials stay behind Main and hydrate only trusted Python runtimes", () => {
  const rendererMethods = fs.readFileSync(
    path.resolve(__dirname, "../static/js/vue_methods.js"),
    "utf8",
  );
  const rendererHtml = fs.readFileSync(
    path.resolve(__dirname, "../static/index.html"),
    "utf8",
  );
  const preload = fs.readFileSync(
    path.resolve(__dirname, "../static/js/preload.js"),
    "utf8",
  );
  const main = fs.readFileSync(path.resolve(__dirname, "../main.js"), "utf8");
  const delivery = fs.readFileSync(path.resolve(__dirname, "../py/delivery.py"), "utf8");
  const settings = fs.readFileSync(path.resolve(__dirname, "../py/get_setting.py"), "utf8");
  const manager = fs.readFileSync(
    path.resolve(__dirname, "../py/telegram_bot_manager.py"),
    "utf8",
  );
  const client = fs.readFileSync(
    path.resolve(__dirname, "../py/telegram_client.py"),
    "utf8",
  );
  const executionLaunchStart = main.indexOf("function createExecutionEngineLaunch");
  const executionLaunch = main.slice(
    executionLaunchStart,
    main.indexOf("executionEngineSupervisor = new", executionLaunchStart),
  );
  const taskWorkerLaunch = main.slice(
    main.indexOf("const taskWorkerExecutable"),
    main.indexOf("function getCleanUserAgent"),
  );
  const legacyLaunch = main.slice(
    main.indexOf("async function startBackend"),
    main.indexOf("async function waitForBackend"),
  );
  const connectorLaunch = main.slice(
    main.indexOf("capability: 'connectors'"),
    main.indexOf("async function startWorkerRpcGateway"),
  );
  const desktopTelegramControls = rendererMethods.slice(
    rendererMethods.indexOf("async requestTelegramBotStopIfRunning"),
    rendererMethods.indexOf("/* ------- Discord 机器人 ------- */"),
  );
  assert.match(rendererMethods, /window\.openxnetDesktop\.getApplicationTelegramCredentials/);
  assert.match(rendererMethods, /window\.openxnetDesktop\.saveApplicationTelegramCredentials/);
  assert.match(rendererMethods, /buildLegacyTelegramSettingsPayload/);
  assert.match(rendererHtml, /clearApplicationTelegramCredential/);
  assert.match(preload, /openxnet:application-telegram-credentials:get-snapshot/);
  assert.match(executionLaunch, /OPENXNET_TELEGRAM_CREDENTIALS_B64/);
  assert.match(legacyLaunch, /OPENXNET_TELEGRAM_CREDENTIALS_B64/);
  assert.equal(
    (connectorLaunch.match(/OPENXNET_TELEGRAM_CREDENTIALS_B64/g) || []).length,
    2,
  );
  assert.doesNotMatch(taskWorkerLaunch, /OPENXNET_TELEGRAM_CREDENTIALS_B64/);
  assert.match(delivery, /settings\.get\("telegramBotConfig", \{\}\)/);
  assert.doesNotMatch(delivery, /telegram_cfg = settings\.get\("telegramBot", \{\}\)/);
  assert.match(settings, /apply_telegram_credentials/);
  assert.match(settings, /redact_telegram_credentials_for_persistence/);
  assert.doesNotMatch(manager, /"config": self\.config\.model_dump/);
  assert.doesNotMatch(manager, /"startup_error": self\._startup_error/);
  assert.doesNotMatch(manager, /load_settings|get_port|127\.0\.0\.1/);
  assert.match(client, /create_connector_chat_client/);
  assert.match(client, /transcribe_connector_audio/);
  assert.match(client, /synthesize_connector_speech/);
  assert.doesNotMatch(client, /AsyncOpenAI|get_port|load_settings|127\.0\.0\.1|\/(?:tts|asr)/);
  assert.match(desktopTelegramControls, /requestApplicationConnectorRuntime\('telegram', 'start'\)/);
  assert.match(desktopTelegramControls, /requestApplicationConnectorRuntime\('telegram', 'stop'\)/);
  assert.match(desktopTelegramControls, /requestApplicationConnectorRuntime\('telegram', 'reload'\)/);
  assert.match(desktopTelegramControls, /requestApplicationConnectorRuntime\('telegram', 'status'\)/);
  assert.doesNotMatch(
    desktopTelegramControls,
    /\/(?:start|stop|reload)_telegram_bot|\/telegram_bot_status/,
  );
  assert.match(main, /applicationTelegramCredentials\.subscribe\(\s*invalidateTelegramCredentialRuntimes/);
  const telegramInvalidation = main.slice(
    main.indexOf("function invalidateTelegramCredentialRuntimes"),
    main.indexOf("const unsubscribeApplicationTelegramCredentialRuntime"),
  );
  assert.match(telegramInvalidation, /invalidateConnectorCredentialRuntime/);
  assert.match(telegramInvalidation, /executionEngineSupervisor\.stop/);
  assert.match(telegramInvalidation, /invalidateLegacyCredentialRuntime/);
  assert.doesNotMatch(telegramInvalidation, /invalidateVoiceWorkerCredentialRuntime/);
});

test("desktop image-host credentials are isolated from repository and non-connector runtimes", () => {
  const rendererMethods = fs.readFileSync(
    path.resolve(__dirname, "../static/js/vue_methods.js"),
    "utf8",
  );
  const rendererHtml = fs.readFileSync(
    path.resolve(__dirname, "../static/index.html"),
    "utf8",
  );
  const preload = fs.readFileSync(
    path.resolve(__dirname, "../static/js/preload.js"),
    "utf8",
  );
  const main = fs.readFileSync(path.resolve(__dirname, "../main.js"), "utf8");
  const settings = fs.readFileSync(path.resolve(__dirname, "../py/get_setting.py"), "utf8");
  const imageHost = fs.readFileSync(path.resolve(__dirname, "../py/image_host.py"), "utf8");
  const contract = fs.readFileSync(
    path.resolve(__dirname, "../src/desktop/contracts/application-image-host-credentials.ts"),
    "utf8",
  );
  const executionLaunchStart = main.indexOf("function createExecutionEngineLaunch");
  const executionLaunch = main.slice(
    executionLaunchStart,
    main.indexOf("executionEngineSupervisor = new", executionLaunchStart),
  );
  const legacyLaunch = main.slice(
    main.indexOf("async function startBackend"),
    main.indexOf("async function waitForBackend"),
  );
  const connectorLaunch = main.slice(
    main.indexOf("capability: 'connectors'"),
    main.indexOf("async function startWorkerRpcGateway"),
  );
  assert.match(rendererMethods, /window\.openxnetDesktop\.getApplicationImageHostCredentials/);
  assert.match(rendererMethods, /window\.openxnetDesktop\.saveApplicationImageHostCredentials/);
  assert.match(rendererMethods, /buildLegacyImageHostSettingsPayload/);
  assert.match(rendererHtml, /clearApplicationImageHostCredential\('SMMS_api_key'\)/);
  assert.match(rendererHtml, /clearApplicationImageHostCredential\('EI2_api_key'\)/);
  assert.match(preload, /openxnet:application-image-host-credentials:get-snapshot/);
  assert.match(connectorLaunch, /OPENXNET_IMAGE_HOST_CREDENTIALS_B64/);
  assert.doesNotMatch(executionLaunch, /OPENXNET_IMAGE_HOST_CREDENTIALS_B64/);
  assert.doesNotMatch(legacyLaunch, /OPENXNET_IMAGE_HOST_CREDENTIALS_B64/);
  assert.match(settings, /apply_image_host_credentials/);
  assert.match(settings, /redact_image_host_credentials_for_persistence/);
  assert.match(imageHost, /provider in \{"ei2", "easyimage2"\}/);
  assert.match(imageHost, /SMMS_UPLOAD_URL/);
  assert.doesNotMatch(imageHost, /str\(error\)|str\(e\)/);
  assert.doesNotMatch(contract, /gitee_token|github_token/);
});

test("desktop repository credentials remain Main-only without a runtime consumer", () => {
  const rendererMethods = fs.readFileSync(
    path.resolve(__dirname, "../static/js/vue_methods.js"),
    "utf8",
  );
  const rendererHtml = fs.readFileSync(
    path.resolve(__dirname, "../static/index.html"),
    "utf8",
  );
  const preload = fs.readFileSync(
    path.resolve(__dirname, "../static/js/preload.js"),
    "utf8",
  );
  const main = fs.readFileSync(path.resolve(__dirname, "../main.js"), "utf8");
  const contract = fs.readFileSync(
    path.resolve(__dirname, "../src/desktop/contracts/application-repository-credentials.ts"),
    "utf8",
  );
  const service = fs.readFileSync(
    path.resolve(__dirname, "../src/desktop/storage/application-repository-credentials.ts"),
    "utf8",
  );
  assert.match(rendererMethods, /window\.openxnetDesktop\.getApplicationRepositoryCredentials/);
  assert.match(rendererMethods, /window\.openxnetDesktop\.saveApplicationRepositoryCredentials/);
  assert.match(rendererMethods, /buildLegacyRepositorySettingsPayload/);
  assert.match(rendererHtml, /clearApplicationRepositoryCredential\('gitee_token'\)/);
  assert.match(rendererHtml, /clearApplicationRepositoryCredential\('github_token'\)/);
  assert.match(preload, /openxnet:application-repository-credentials:get-snapshot/);
  assert.match(contract, /"gitee_token"/);
  assert.match(contract, /"github_token"/);
  assert.doesNotMatch(contract, /SMMS_api_key|EI2_api_key/);
  assert.doesNotMatch(main, /OPENXNET_REPOSITORY_CREDENTIALS_B64/);
  assert.doesNotMatch(main, /applicationRepositoryCredentials\.getRuntime/);
  assert.doesNotMatch(service, /getRuntimeCredentialBootstrap|subscribe\(/);
});

test("desktop live runtime uses a dedicated Worker and typed event boundary", () => {
  const rendererMethods = fs.readFileSync(
    path.resolve(__dirname, "../static/js/vue_methods.js"),
    "utf8",
  );
  const rendererComputed = fs.readFileSync(
    path.resolve(__dirname, "../static/js/renderer.js"),
    "utf8",
  );
  const rendererHtml = fs.readFileSync(
    path.resolve(__dirname, "../static/index.html"),
    "utf8",
  );
  const preload = fs.readFileSync(
    path.resolve(__dirname, "../static/js/preload.js"),
    "utf8",
  );
  const main = fs.readFileSync(path.resolve(__dirname, "../main.js"), "utf8");
  const settings = fs.readFileSync(path.resolve(__dirname, "../py/get_setting.py"), "utf8");
  const liveRouter = fs.readFileSync(path.resolve(__dirname, "../py/live_router.py"), "utf8");
  const liveRuntime = fs.readFileSync(path.resolve(__dirname, "../py/live_runtime.py"), "utf8");
  const liveWorker = fs.readFileSync(
    path.resolve(__dirname, "../py/workers/live_worker.py"),
    "utf8",
  );
  const contract = fs.readFileSync(
    path.resolve(__dirname, "../src/desktop/contracts/application-live-platform-credentials.ts"),
    "utf8",
  );
  const executionLaunchStart = main.indexOf("function createExecutionEngineLaunch");
  const executionLaunch = main.slice(
    executionLaunchStart,
    main.indexOf("executionEngineSupervisor = new", executionLaunchStart),
  );
  const legacyLaunch = main.slice(
    main.indexOf("async function startBackend"),
    main.indexOf("async function waitForBackend"),
  );
  const connectorLaunch = main.slice(
    main.indexOf("capability: 'connectors'"),
    main.indexOf("capability: 'live'"),
  );
  const liveLaunch = main.slice(
    main.indexOf("capability: 'live'"),
    main.indexOf("return {\n    gitnexus:"),
  );
  const desktopLiveLifecycle = rendererMethods.slice(
    rendererMethods.indexOf("async startLive()"),
    rendererMethods.indexOf("startDanmuProcessor() {", rendererMethods.indexOf("async startLive()")),
  );
  const desktopLiveStatus = rendererMethods.slice(
    rendererMethods.indexOf("async checkLiveStatus()"),
    rendererMethods.indexOf("// 处理弹幕消息"),
  );
  const desktopLiveControls = `${desktopLiveLifecycle}\n${desktopLiveStatus}`;
  assert.match(rendererMethods, /window\.openxnetDesktop\.getApplicationLivePlatformCredentials/);
  assert.match(rendererMethods, /window\.openxnetDesktop\.saveApplicationLivePlatformCredentials/);
  assert.match(rendererMethods, /buildLegacyLivePlatformSettingsPayload/);
  assert.match(rendererMethods, /config: this\.buildLegacyLivePlatformSettingsPayload\(\)/);
  for (const field of [
    "bilibili_sessdata",
    "bilibili_ACCESS_KEY_SECRET",
    "bilibili_ROOM_OWNER_AUTH_CODE",
    "youtube_api_key",
    "twitch_access_token",
  ]) {
    assert.match(rendererHtml, new RegExp(`clearApplicationLivePlatformCredential\\('${field}'\\)`));
    assert.match(contract, new RegExp(`"${field}"`));
  }
  assert.match(preload, /openxnet:application-live-platform-credentials:get-snapshot/);
  assert.match(preload, /openxnet:application-live-runtime:status/);
  assert.match(preload, /openxnet:application-live-runtime:event/);
  assert.match(legacyLaunch, /OPENXNET_LIVE_PLATFORM_CREDENTIALS_B64/);
  assert.equal((liveLaunch.match(/OPENXNET_LIVE_PLATFORM_CREDENTIALS_B64/g) || []).length, 2);
  assert.doesNotMatch(executionLaunch, /OPENXNET_LIVE_PLATFORM_CREDENTIALS_B64/);
  assert.doesNotMatch(connectorLaunch, /OPENXNET_LIVE_PLATFORM_CREDENTIALS_B64/);
  assert.match(settings, /apply_live_platform_credentials/);
  assert.match(settings, /redact_live_platform_credentials_for_persistence/);
  assert.match(liveRuntime, /hydrate_live_platform_config/);
  assert.match(liveWorker, /runtime\.emit_event\("live\.event"/);
  assert.doesNotMatch(liveRouter, /str\(error\)|str\(e\)|message=f".*\{.*error/);
  assert.match(rendererMethods, /onApplicationLiveRuntimeEvent/);
  assert.match(desktopLiveControls, /requestApplicationLiveRuntime\('start'\)/);
  assert.match(desktopLiveControls, /requestApplicationLiveRuntime\('stop'\)/);
  assert.match(desktopLiveControls, /requestApplicationLiveRuntime\('reload'\)/);
  assert.match(desktopLiveControls, /requestApplicationLiveRuntime\('status'\)/);
  assert.doesNotMatch(desktopLiveControls, /\/api\/live|\/ws\/live|new WebSocket/);
  assert.match(main, /applicationLivePlatformCredentials\.subscribe\(\s*invalidateLivePlatformCredentialRuntimes/);
  const liveInvalidation = main.slice(
    main.indexOf("function invalidateLivePlatformCredentialRuntimes"),
    main.indexOf("const unsubscribeApplicationLivePlatformCredentialRuntime"),
  );
  assert.match(liveInvalidation, /workerSupervisor\.stop\('live'\)/);
  assert.match(liveInvalidation, /invalidateLegacyCredentialRuntime/);
  assert.doesNotMatch(liveInvalidation, /connectors|voice|executionEngineSupervisor/);
  assert.doesNotMatch(contract, /bilibili_ACCESS_KEY_ID|bilibili_APP_ID/);
  assert.match(rendererHtml, /liveConfig\.youtube_video_id/);
  assert.doesNotMatch(rendererHtml, /youtube_vedio_id/);
  assert.doesNotMatch(rendererComputed, /bilibili_SECRET_ACCESS_KEY|open_live/);
});

test("desktop code-sandbox credentials hydrate only authorized Python runtimes", () => {
  const rendererMethods = fs.readFileSync(
    path.resolve(__dirname, "../static/js/vue_methods.js"),
    "utf8",
  );
  const rendererHtml = fs.readFileSync(
    path.resolve(__dirname, "../static/index.html"),
    "utf8",
  );
  const preload = fs.readFileSync(
    path.resolve(__dirname, "../static/js/preload.js"),
    "utf8",
  );
  const main = fs.readFileSync(path.resolve(__dirname, "../main.js"), "utf8");
  const settings = fs.readFileSync(path.resolve(__dirname, "../py/get_setting.py"), "utf8");
  const interpreter = fs.readFileSync(
    path.resolve(__dirname, "../py/code_interpreter.py"),
    "utf8",
  );
  const contract = fs.readFileSync(
    path.resolve(__dirname, "../src/desktop/contracts/application-code-sandbox-credentials.ts"),
    "utf8",
  );
  const executionLaunchStart = main.indexOf("function createExecutionEngineLaunch");
  const executionLaunch = main.slice(
    executionLaunchStart,
    main.indexOf("executionEngineSupervisor = new", executionLaunchStart),
  );
  const legacyLaunch = main.slice(
    main.indexOf("async function startBackend"),
    main.indexOf("async function waitForBackend"),
  );
  const taskWorkerLaunch = main.slice(
    main.indexOf("capability: 'tasks'"),
    main.indexOf("function getCleanUserAgent"),
  );
  const connectorLaunch = main.slice(
    main.indexOf("capability: 'connectors'"),
    main.indexOf("async function startWorkerRpcGateway"),
  );
  assert.match(rendererMethods, /window\.openxnetDesktop\.getApplicationCodeSandboxCredentials/);
  assert.match(rendererMethods, /window\.openxnetDesktop\.saveApplicationCodeSandboxCredentials/);
  assert.match(rendererMethods, /buildLegacyCodeSandboxSettingsPayload/);
  assert.match(rendererMethods, /codeSettings: this\.buildLegacyCodeSandboxSettingsPayload\(\)/);
  assert.match(rendererMethods, /isApplicationCodeSandboxCredentialConfigured\('e2b_api_key'\)/);
  assert.match(rendererHtml, /clearApplicationCodeSandboxCredential\('e2b_api_key'\)/);
  assert.match(preload, /openxnet:application-code-sandbox-credentials:get-snapshot/);
  assert.match(executionLaunch, /OPENXNET_CODE_SANDBOX_CREDENTIALS_B64/);
  assert.match(legacyLaunch, /OPENXNET_CODE_SANDBOX_CREDENTIALS_B64/);
  assert.doesNotMatch(taskWorkerLaunch, /OPENXNET_CODE_SANDBOX_CREDENTIALS_B64/);
  assert.doesNotMatch(connectorLaunch, /OPENXNET_CODE_SANDBOX_CREDENTIALS_B64/);
  assert.equal((main.match(/OPENXNET_CODE_SANDBOX_CREDENTIALS_B64/g) || []).length, 2);
  assert.match(settings, /apply_code_sandbox_credentials/);
  assert.match(settings, /redact_code_sandbox_credentials_for_persistence/);
  assert.match(interpreter, /allow_redirects=False/);
  assert.match(interpreter, /MAX_SANDBOX_RESPONSE_BYTES/);
  assert.match(interpreter, /E2B 代码执行失败。/);
  assert.match(contract, /"e2b_api_key"/);
  assert.doesNotMatch(contract, /HASettings|comfyuiAPIkey|ccSettings|qcSettings|ocSettings/);
});

test("desktop Home Assistant runtime uses MCP Worker and a private tool broker", () => {
  const rendererMethods = fs.readFileSync(
    path.resolve(__dirname, "../static/js/vue_methods.js"),
    "utf8",
  );
  const rendererHtml = fs.readFileSync(
    path.resolve(__dirname, "../static/index.html"),
    "utf8",
  );
  const preload = fs.readFileSync(
    path.resolve(__dirname, "../static/js/preload.js"),
    "utf8",
  );
  const main = fs.readFileSync(path.resolve(__dirname, "../main.js"), "utf8");
  const settings = fs.readFileSync(path.resolve(__dirname, "../py/get_setting.py"), "utf8");
  const route = fs.readFileSync(
    path.resolve(__dirname, "../py/routes/mcp_control.py"),
    "utf8",
  );
  const runtime = fs.readFileSync(
    path.resolve(__dirname, "../py/mcp_runtime.py"),
    "utf8",
  );
  const brokerClient = fs.readFileSync(
    path.resolve(__dirname, "../py/mcp_tool_broker_client.py"),
    "utf8",
  );
  const mcpClient = fs.readFileSync(
    path.resolve(__dirname, "../py/mcp_clients.py"),
    "utf8",
  );
  const contract = fs.readFileSync(
    path.resolve(__dirname, "../src/desktop/contracts/application-home-assistant-credentials.ts"),
    "utf8",
  );
  const homeAssistantRoute = route.slice(
    route.indexOf('@router.post("/start_HA")'),
    route.indexOf('@router.post("/start_ChromeMCP")'),
  );
  const executionLaunchStart = main.indexOf("function createExecutionEngineLaunch");
  const executionLaunch = main.slice(
    executionLaunchStart,
    main.indexOf("executionEngineSupervisor = new", executionLaunchStart),
  );
  const legacyLaunch = main.slice(
    main.indexOf("async function startBackend"),
    main.indexOf("async function waitForBackend"),
  );
  const taskWorkerLaunch = main.slice(
    main.indexOf("capability: 'tasks'"),
    main.indexOf("function getCleanUserAgent"),
  );
  const connectorLaunch = main.slice(
    main.indexOf("capability: 'connectors'"),
    main.indexOf("capability: 'live'"),
  );
  const mcpLaunch = main.slice(
    main.indexOf("capability: 'mcp'"),
    main.indexOf("async function startWorkerRpcGateway"),
  );
  assert.match(rendererMethods, /window\.openxnetDesktop\.getApplicationHomeAssistantCredentials/);
  assert.match(rendererMethods, /window\.openxnetDesktop\.saveApplicationHomeAssistantCredentials/);
  assert.match(rendererMethods, /buildLegacyHomeAssistantSettingsPayload/);
  assert.match(rendererMethods, /HASettings: this\.buildLegacyHomeAssistantSettingsPayload\(\)/);
  assert.match(rendererMethods, /data: this\.buildLegacyHomeAssistantSettingsPayload\(\)/);
  assert.match(rendererMethods, /isApplicationHomeAssistantCredentialConfigured\('api_key'\)/);
  assert.match(rendererHtml, /clearApplicationHomeAssistantCredential\('api_key'\)/);
  assert.match(preload, /openxnet:application-home-assistant-credentials:get-snapshot/);
  assert.match(preload, /openxnet:application-mcp-runtime:start/);
  assert.match(rendererMethods, /window\.openxnetDesktop/);
  assert.match(rendererMethods, /startApplicationMcpRuntime/);
  assert.match(rendererMethods, /stopApplicationMcpRuntime/);
  assert.doesNotMatch(legacyLaunch, /OPENXNET_HOME_ASSISTANT_CREDENTIALS_B64/);
  assert.match(mcpLaunch, /environment: \(\) => getMcpWorkerRuntimeEnvironment/);
  assert.match(main, /function getMcpWorkerRuntimeEnvironment\(nodeRuntimeSourceDirectory\)[\s\S]*OPENXNET_HOME_ASSISTANT_CREDENTIALS_B64/);
  assert.doesNotMatch(executionLaunch, /OPENXNET_HOME_ASSISTANT_CREDENTIALS_B64/);
  assert.match(executionLaunch, /getMcpToolBrokerRuntimeEnvironment/);
  assert.match(main, /OPENXNET_MCP_TOOL_BROKER_ORIGIN/);
  assert.match(main, /OPENXNET_MCP_TOOL_BROKER_TOKEN/);
  assert.doesNotMatch(taskWorkerLaunch, /OPENXNET_HOME_ASSISTANT_CREDENTIALS_B64/);
  assert.doesNotMatch(connectorLaunch, /OPENXNET_HOME_ASSISTANT_CREDENTIALS_B64/);
  assert.match(settings, /apply_home_assistant_credentials/);
  assert.match(settings, /redact_home_assistant_credentials_for_persistence/);
  assert.match(homeAssistantRoute, /hydrate_home_assistant_config/);
  assert.match(homeAssistantRoute, /"follow_redirects": False/);
  assert.match(homeAssistantRoute, /@router\.post\("\/stop_HA"\)/);
  assert.doesNotMatch(homeAssistantRoute, /content=\{"error": str\(exc\)\}/);
  assert.match(runtime, /External Home Assistant endpoints require HTTPS/);
  assert.match(runtime, /class McpRuntimeController/);
  assert.match(brokerClient, /MCP_TOOL_BROKER_TOKEN_ENV/);
  assert.doesNotMatch(brokerClient, /HOME_ASSISTANT_CREDENTIAL_ENV/);
  assert.match(mcpClient, /"follow_redirects": False/);
  assert.match(contract, /"api_key"/);
  assert.doesNotMatch(contract, /comfyuiAPIkey|e2b_api_key|HASettings/);
});

test("desktop external Chrome MCP uses typed runtime and private tool broker", () => {
  const rendererMethods = fs.readFileSync(
    path.resolve(__dirname, "../static/js/vue_methods.js"),
    "utf8",
  );
  const route = fs.readFileSync(
    path.resolve(__dirname, "../py/routes/mcp_control.py"),
    "utf8",
  );
  const runtime = fs.readFileSync(
    path.resolve(__dirname, "../py/mcp_runtime.py"),
    "utf8",
  );
  const server = fs.readFileSync(path.resolve(__dirname, "../server.py"), "utf8");
  const main = fs.readFileSync(path.resolve(__dirname, "../main.js"), "utf8");
  const contract = fs.readFileSync(
    path.resolve(__dirname, "../src/desktop/contracts/application-mcp-runtime.ts"),
    "utf8",
  );
  const nodeLock = fs.readFileSync(
    path.resolve(__dirname, "../mcp-node-runtime/package-lock.json"),
    "utf8",
  );
  const chromeMethod = rendererMethods.slice(
    rendererMethods.indexOf("async changeChromeMCPEnabled()"),
    rendererMethods.indexOf("async changeSqlEnabled()"),
  );
  const chromeRoute = route.slice(
    route.indexOf('@router.post("/start_ChromeMCP")'),
    route.indexOf('@router.post("/start_sql")'),
  );
  assert.match(chromeMethod, /integration: 'chrome-external'/);
  assert.match(chromeMethod, /startApplicationMcpRuntime/);
  assert.match(chromeMethod, /stopApplicationMcpRuntime/);
  assert.match(chromeMethod, /desktopMcpRuntime/);
  assert.match(chromeMethod, /fetch\('\/start_ChromeMCP'/);
  assert.match(chromeMethod, /fetch\('\/stop_ChromeMCP'/);
  assert.match(contract, /"chrome-external"/);
  assert.match(contract, /"browser-mcp", "playwright-mcp"/);
  assert.match(runtime, /@browsermcp\/mcp@0\.1\.3/);
  assert.match(runtime, /@playwright\/mcp@0\.0\.78/);
  assert.match(runtime, /allowed_parent_names/);
  assert.doesNotMatch(runtime, /env\s*=\s*os\.environ\.copy/);
  assert.doesNotMatch(runtime, /shutil\.which\("npx"\)/);
  assert.match(runtime, /"ci"[\s\S]*"--ignore-scripts"/);
  assert.match(chromeRoute, /build_external_chrome_stdio_configuration/);
  assert.match(chromeRoute, /@router\.post\("\/stop_ChromeMCP"\)/);
  assert.doesNotMatch(chromeRoute, /content=\{"error": str\(exc\)\}/);
  assert.match(main, /OPENXNET_MCP_BROWSER_STORAGE_DIR/);
  assert.match(main, /OPENXNET_MCP_NPM_CACHE_DIR/);
  assert.match(main, /OPENXNET_MCP_NODE_RUNTIME_SOURCE_DIR/);
  assert.match(nodeLock, /"@browsermcp\/mcp": "0\.1\.3"/);
  assert.match(nodeLock, /"@playwright\/mcp": "0\.0\.78"/);
  assert.match(nodeLock, /"integrity": "sha512-/);
  assert.doesNotMatch(nodeLock, /latest/);
  assert.match(server, /list_external_chrome_tools/);
  assert.match(server, /call_external_chrome_tool/);
});

test("desktop SQL MCP uses Main credentials, file authorization, and the private broker", () => {
  const rendererMethods = fs.readFileSync(
    path.resolve(__dirname, "../static/js/vue_methods.js"),
    "utf8",
  );
  const rendererHtml = fs.readFileSync(
    path.resolve(__dirname, "../static/index.html"),
    "utf8",
  );
  const preload = fs.readFileSync(path.resolve(__dirname, "../static/js/preload.js"), "utf8");
  const main = fs.readFileSync(path.resolve(__dirname, "../main.js"), "utf8");
  const route = fs.readFileSync(
    path.resolve(__dirname, "../py/routes/mcp_control.py"),
    "utf8",
  );
  const runtime = fs.readFileSync(path.resolve(__dirname, "../py/mcp_runtime.py"), "utf8");
  const server = fs.readFileSync(path.resolve(__dirname, "../server.py"), "utf8");
  const settings = fs.readFileSync(path.resolve(__dirname, "../py/get_setting.py"), "utf8");
  const template = fs.readFileSync(
    path.resolve(__dirname, "../config/settings_template.json"),
    "utf8",
  );
  const requirements = fs.readFileSync(
    path.resolve(__dirname, "../requirements-mcp.txt"),
    "utf8",
  );
  const sqlContract = fs.readFileSync(
    path.resolve(__dirname, "../src/desktop/contracts/application-sql-credentials.ts"),
    "utf8",
  );
  const runtimeContract = fs.readFileSync(
    path.resolve(__dirname, "../src/desktop/contracts/application-mcp-runtime.ts"),
    "utf8",
  );
  const sqlMethod = rendererMethods.slice(
    rendererMethods.indexOf("async changeSqlEnabled()"),
    rendererMethods.indexOf("async loadDefaultMotions()"),
  );
  const sqlRoute = route.slice(route.indexOf('@router.post("/start_sql")'));
  const executionLaunchStart = main.indexOf("function createExecutionEngineLaunch");
  const executionLaunch = main.slice(
    executionLaunchStart,
    main.indexOf("executionEngineSupervisor = new", executionLaunchStart),
  );
  const legacyLaunch = main.slice(
    main.indexOf("async function startBackend"),
    main.indexOf("async function waitForBackend"),
  );
  assert.match(rendererMethods, /getApplicationSqlCredentials/);
  assert.match(rendererMethods, /saveApplicationSqlCredentials/);
  assert.match(rendererMethods, /selectApplicationSqliteDatabase/);
  assert.match(rendererMethods, /buildLegacySqlSettingsPayload/);
  assert.match(rendererMethods, /sqlSettings: this\.buildLegacySqlSettingsPayload\(\)/);
  assert.match(rendererHtml, /markApplicationSqlCredentialForSave\('password'\)/);
  assert.match(rendererHtml, /clearApplicationSqlCredential\('password'\)/);
  assert.match(rendererHtml, /selectApplicationSqliteDatabase/);
  assert.doesNotMatch(rendererHtml, /downloadUV|installUv/);
  assert.match(preload, /openxnet:application-sql-credentials:get-snapshot/);
  assert.match(preload, /openxnet:application-sql-credentials:select-database/);
  assert.match(sqlMethod, /integration: 'sql'/);
  assert.match(sqlMethod, /databaseId: settings\.databaseId/);
  assert.doesNotMatch(sqlMethod, /configuration[\s\S]{0,300}password:/);
  assert.match(main, /OPENXNET_SQL_CREDENTIALS_B64/);
  assert.doesNotMatch(legacyLaunch, /OPENXNET_SQL_CREDENTIALS_B64/);
  assert.doesNotMatch(executionLaunch, /OPENXNET_SQL_CREDENTIALS_B64/);
  assert.match(settings, /apply_sql_credentials/);
  assert.match(settings, /redact_sql_credentials_for_persistence/);
  assert.match(sqlRoute, /build_sql_stdio_configuration/);
  assert.match(sqlRoute, /@router\.post\("\/stop_sql"\)/);
  assert.doesNotMatch(sqlRoute, /"command": "uvx"|mcp-alchemy==|content=\{"error": str\(exc\)\}/);
  assert.match(runtime, /def build_sql_stdio_configuration/);
  assert.match(runtime, /--sql-server/);
  assert.match(runtime, /def _build_sql_child_environment/);
  assert.match(server, /list_sql_tools/);
  assert.match(server, /call_sql_tool/);
  assert.match(runtimeContract, /"sql"/);
  assert.match(runtimeContract, /databaseId/);
  assert.doesNotMatch(runtimeContract, /readonly password|readonly dbpath/);
  assert.match(sqlContract, /\["password"\]/);
  assert.doesNotMatch(template, /"dbPath"/);
  assert.match(requirements, /mcp-alchemy==2025\.8\.15\.91819/);
  assert.match(requirements, /SQLAlchemy==2\.0\.51/);
});

test("desktop ComfyUI credentials hydrate only authorized workflow runtimes", () => {
  const rendererMethods = fs.readFileSync(
    path.resolve(__dirname, "../static/js/vue_methods.js"),
    "utf8",
  );
  const rendererHtml = fs.readFileSync(
    path.resolve(__dirname, "../static/index.html"),
    "utf8",
  );
  const preload = fs.readFileSync(
    path.resolve(__dirname, "../static/js/preload.js"),
    "utf8",
  );
  const main = fs.readFileSync(path.resolve(__dirname, "../main.js"), "utf8");
  const settings = fs.readFileSync(path.resolve(__dirname, "../py/get_setting.py"), "utf8");
  const comfyUiTool = fs.readFileSync(
    path.resolve(__dirname, "../py/comfyui_tool.py"),
    "utf8",
  );
  const contract = fs.readFileSync(
    path.resolve(__dirname, "../src/desktop/contracts/application-comfyui-credentials.ts"),
    "utf8",
  );
  const executionLaunchStart = main.indexOf("function createExecutionEngineLaunch");
  const executionLaunch = main.slice(
    executionLaunchStart,
    main.indexOf("executionEngineSupervisor = new", executionLaunchStart),
  );
  const legacyLaunch = main.slice(
    main.indexOf("async function startBackend"),
    main.indexOf("async function waitForBackend"),
  );
  const taskWorkerLaunch = main.slice(
    main.indexOf("capability: 'tasks'"),
    main.indexOf("function getCleanUserAgent"),
  );
  const connectorLaunch = main.slice(
    main.indexOf("capability: 'connectors'"),
    main.indexOf("async function startWorkerRpcGateway"),
  );
  assert.match(rendererMethods, /window\.openxnetDesktop\.getApplicationComfyUiCredentials/);
  assert.match(rendererMethods, /window\.openxnetDesktop\.saveApplicationComfyUiCredentials/);
  assert.match(rendererMethods, /buildLegacyComfyUiCredentialSettingsPayload/);
  assert.match(rendererMethods, /\.\.\.this\.buildLegacyComfyUiCredentialSettingsPayload\(\)/);
  assert.match(rendererMethods, /normalizeComfyUiServerUrl/);
  assert.match(rendererMethods, /redirect: 'manual'/);
  assert.match(rendererHtml, /clearApplicationComfyUiCredential\('api_key'\)/);
  assert.match(preload, /openxnet:application-comfyui-credentials:get-snapshot/);
  assert.match(executionLaunch, /OPENXNET_COMFYUI_CREDENTIALS_B64/);
  assert.match(legacyLaunch, /OPENXNET_COMFYUI_CREDENTIALS_B64/);
  assert.doesNotMatch(taskWorkerLaunch, /OPENXNET_COMFYUI_CREDENTIALS_B64/);
  assert.doesNotMatch(connectorLaunch, /OPENXNET_COMFYUI_CREDENTIALS_B64/);
  assert.equal((main.match(/OPENXNET_COMFYUI_CREDENTIALS_B64/g) || []).length, 2);
  assert.match(settings, /apply_comfyui_credentials/);
  assert.match(settings, /redact_comfyui_credentials_for_persistence/);
  assert.match(comfyUiTool, /allow_redirects=False/);
  assert.match(comfyUiTool, /MAX_COMFYUI_JSON_BYTES/);
  assert.match(comfyUiTool, /MAX_COMFYUI_IMAGE_BYTES/);
  assert.match(comfyUiTool, /External ComfyUI endpoints require HTTPS/);
  assert.match(comfyUiTool, /ComfyUI 请求失败。/);
  assert.equal((comfyUiTool.match(/await get_all\(/g) || []).length, 1);
  assert.doesNotMatch(comfyUiTool, /urllib\.request|urlopen|response\.text|logging\.exception/);
  assert.match(contract, /"api_key"/);
  assert.doesNotMatch(contract, /e2b_api_key|HASettings|comfyuiAPIkey/);
});

test("task delivery credentials persist after Core creation and before execution dispatch", () => {
  const rendererMethods = fs.readFileSync(
    path.resolve(__dirname, "../static/js/vue_methods.js"),
    "utf8",
  );
  const rendererHtml = fs.readFileSync(
    path.resolve(__dirname, "../static/index.html"),
    "utf8",
  );
  const preload = fs.readFileSync(
    path.resolve(__dirname, "../static/js/preload.js"),
    "utf8",
  );
  const submitMethod = extractRendererMethod(
    rendererMethods,
    "async submitCreateTask()",
    "async handleStartTask(",
  );
  const createIndex = submitMethod.indexOf("coreTask = await window.openxnetDesktop.createTask");
  const saveIndex = submitMethod.indexOf("await this.saveTaskDeliveryCredentialDraft");
  const dispatchIndex = submitMethod.indexOf("await this.dispatchApplicationTaskExecution");
  assert.ok(createIndex >= 0 && createIndex < saveIndex);
  assert.ok(saveIndex < dispatchIndex);
  const coreCreateRequest = submitMethod.slice(createIndex, saveIndex);
  assert.doesNotMatch(
    coreCreateRequest,
    /delivery_webhook_url|delivery_webhook_headers|discord_webhook_url|webhook_url/,
  );
  assert.match(rendererMethods, /taskId: coreTask\.legacyTaskId/);
  assert.match(rendererMethods, /saveApplicationDeliveryCredentials\(\{/);
  assert.match(rendererMethods, /clearTaskDeliveryCredentialDraft\(\)/);
  assert.match(rendererMethods, /deleteTaskExecution\(\{ taskId: coreTask\.id \}\)/);
  assert.match(rendererHtml, /label="webhook">Webhook/);
  assert.match(rendererHtml, /label="discord">Discord Webhook/);
  assert.match(rendererHtml, /@closed="clearTaskDeliveryCredentialDraft"/);
  assert.match(rendererHtml, /v-model="newTaskForm\.delivery_webhook_url"[\s\S]*?type="password"/);
  assert.match(rendererHtml, /v-model="newTaskForm\.discord_webhook_url"[\s\S]*?type="password"/);
  assert.match(preload, /openxnet:application-delivery-credentials:get-snapshot/);
  assert.match(preload, /openxnet:application-delivery-credentials:save/);
});

test("desktop enterprise surfaces prefer the complete typed Runtime and never fall back when its bridge is missing", () => {
  const rendererMethods = fs.readFileSync(
    path.resolve(__dirname, "../static/js/vue_methods.js"),
    "utf8",
  );
  const opsBridge = fs.readFileSync(
    path.resolve(__dirname, "../frontend/ops-vite/src/opsBridge.js"),
    "utf8",
  );
  const enterpriseRuntime = extractRendererMethod(
    rendererMethods,
    "getApplicationEnterpriseRuntime()",
    "async openEnterpriseTab(",
  );
  const requiredMethods = [
    "listApplicationEnterpriseRoleCards",
    "saveApplicationEnterpriseRoleCard",
    "removeApplicationEnterpriseRoleCard",
    "listApplicationEnterpriseTeamTemplates",
    "saveApplicationEnterpriseTeamTemplate",
    "removeApplicationEnterpriseTeamTemplate",
    "listApplicationEnterpriseKnowledgeBases",
    "saveApplicationEnterpriseKnowledgeBase",
    "removeApplicationEnterpriseKnowledgeBase",
    "listApplicationEnterpriseKnowledgeBaseVersions",
    "listApplicationEnterpriseWorkspaces",
    "saveApplicationEnterpriseWorkspace",
    "removeApplicationEnterpriseWorkspace",
    "getApplicationEnterpriseSandboxState",
    "listApplicationEnterpriseXnetServices",
    "saveApplicationEnterpriseXnetService",
    "checkApplicationEnterpriseXnetService",
    "checkAllApplicationEnterpriseXnetServices",
    "loadApplicationEnterpriseUsageDashboard",
    "loadApplicationEnterpriseNeuroDashboard",
    "searchApplicationEnterpriseNeuroSymbols",
    "removeApplicationEnterpriseNeuroSymbol",
    "runApplicationEnterpriseNeuroMaintenance",
    "loadApplicationEnterpriseKnowledgeGraph",
    "queryApplicationEnterpriseKnowledgeGraphEntity",
  ];
  for (const method of requiredMethods) {
    assert.match(enterpriseRuntime, new RegExp(`typeof runtime\\.${method} === 'function'`));
  }
  assert.match(enterpriseRuntime, /if \(isElectron\) throw new Error\('Desktop Enterprise Runtime is unavailable\.'\)/);

  const enterpriseRenderer = rendererMethods.slice(
    rendererMethods.indexOf("getApplicationEnterpriseRuntime()"),
    rendererMethods.indexOf("saveKbFile()"),
  );
  const typedFallbackPairs = [
    ["listApplicationEnterpriseRoleCards", "/v1/enterprise/role-cards"],
    ["saveApplicationEnterpriseRoleCard", "/v1/enterprise/role-cards"],
    ["removeApplicationEnterpriseRoleCard", "/v1/enterprise/role-cards/"],
    ["listApplicationEnterpriseKnowledgeBases", "/v1/enterprise/knowledge-bases"],
    ["saveApplicationEnterpriseKnowledgeBase", "/v1/enterprise/knowledge-bases"],
    ["removeApplicationEnterpriseKnowledgeBase", "/v1/enterprise/knowledge-bases/"],
    ["listApplicationEnterpriseKnowledgeBaseVersions", "/versions"],
    ["listApplicationEnterpriseWorkspaces", "/v1/enterprise/workspaces"],
    ["saveApplicationEnterpriseWorkspace", "/v1/enterprise/workspaces"],
    ["removeApplicationEnterpriseWorkspace", "/v1/enterprise/workspaces/"],
    ["getApplicationEnterpriseSandboxState", "/v1/enterprise/sandbox/state"],
    ["listApplicationEnterpriseXnetServices", "/v1/enterprise/xnet/services"],
    ["saveApplicationEnterpriseXnetService", "/v1/enterprise/xnet/services/"],
    ["checkApplicationEnterpriseXnetService", "/v1/enterprise/xnet/health-check/"],
    ["checkAllApplicationEnterpriseXnetServices", "/v1/enterprise/xnet/health-check-all"],
    ["loadApplicationEnterpriseUsageDashboard", "/v1/usage/summary"],
    ["loadApplicationEnterpriseNeuroDashboard", "/v1/neuro/stats"],
    ["searchApplicationEnterpriseNeuroSymbols", "/v1/neuro/match"],
    ["removeApplicationEnterpriseNeuroSymbol", "/v1/neuro/symbols/"],
    ["runApplicationEnterpriseNeuroMaintenance", "/v1/neuro/maintenance"],
    ["loadApplicationEnterpriseKnowledgeGraph", "/v1/neuro/kg/stats"],
    ["queryApplicationEnterpriseKnowledgeGraphEntity", "/v1/neuro/kg/entity/"],
  ];
  for (const [typedCall, fallbackCall] of typedFallbackPairs) {
    assertTypedIpcPrecedesFallback(enterpriseRenderer, typedCall, fallbackCall);
  }

  const opsSave = opsBridge.slice(
    opsBridge.indexOf("async function saveEnterpriseKnowledgeBase("),
    opsBridge.indexOf("async function deleteEnterpriseKnowledgeBase("),
  );
  const opsDelete = opsBridge.slice(
    opsBridge.indexOf("async function deleteEnterpriseKnowledgeBase("),
    opsBridge.indexOf("async function loadEnterpriseKnowledgeBaseVersions("),
  );
  const opsVersions = opsBridge.slice(
    opsBridge.indexOf("async function loadEnterpriseKnowledgeBaseVersions("),
    opsBridge.indexOf("export function createOpsBridge()"),
  );
  assertTypedIpcPrecedesFallback(opsSave, "host.saveEnterpriseKnowledgeBaseRecord", "/v1/enterprise/knowledge-bases");
  assertTypedIpcPrecedesFallback(opsDelete, "host.removeEnterpriseKnowledgeBaseRecord", "/v1/enterprise/knowledge-bases/");
  assertTypedIpcPrecedesFallback(opsVersions, "host.loadEnterpriseKnowledgeBaseVersionRecords", "/versions");
  for (const method of [opsSave, opsDelete, opsVersions]) {
    assert.match(method, /if \(getDesktopCoreApi\(\)\)[\s\S]*Desktop Enterprise host bridge is unavailable\./);
  }

  const insightsRuntime = fs.readFileSync(
    path.resolve(__dirname, "../src/desktop/enterprise/application-enterprise-insights-runtime.ts"),
    "utf8",
  );
  const privateApi = fs.readFileSync(
    path.resolve(__dirname, "../py/enterprise_insights_engine_api.py"),
    "utf8",
  );
  const usageMethod = insightsRuntime.slice(
    insightsRuntime.indexOf("public async loadUsageDashboard("),
    insightsRuntime.indexOf("public async loadNeuroDashboard("),
  );
  assert.match(usageMethod, /readUsageDashboard/);
  assert.doesNotMatch(usageMethod, /requestEngine|acquireEngine/);
  assert.match(privateApi, /ENTERPRISE_INSIGHTS_ENGINE_PATHS/);
  assert.doesNotMatch(privateApi, /usage_tracking\.db|usage_records/);
});

test("登录凭据刷新等待 legacy 后端预期退出后再恢复", () => {
  const main = fs.readFileSync(path.resolve(__dirname, "../main.js"), "utf8");
  const gracefulStopStart = main.indexOf("async function gracefulKillBackend()");
  const gracefulStop = main.slice(
    gracefulStopStart,
    main.indexOf("function markApplicationQuitting", gracefulStopStart),
  );
  const closeHandlerStart = main.indexOf("currentBackendProcess.on('close'");
  const closeHandler = main.slice(
    closeHandlerStart,
    main.indexOf("startupTimeout = setTimeout", closeHandlerStart),
  );
  const credentialRefreshStart = main.indexOf("function refreshLegacyBackendCredentialRuntime()");
  const credentialRefresh = main.slice(
    credentialRefreshStart,
    main.indexOf("const unsubscribeApplicationProviderRuntime", credentialRefreshStart),
  );

  const expectedMark = gracefulStop.indexOf("legacyBackendLifecycle.markExpectedExit(targetProcess)");
  const awaitedExit = gracefulStop.indexOf("await waitForBackendProcessExit(targetProcess");
  assert.ok(expectedMark >= 0 && awaitedExit > expectedMark);
  const expectedBranch = closeHandler.indexOf("else if (expectedExit)");
  const crashBranch = closeHandler.indexOf("else if (!isQuitting && !backendRestartAttempted)");
  assert.ok(expectedBranch >= 0 && crashBranch > expectedBranch);
  assert.doesNotMatch(closeHandler.slice(expectedBranch, crashBranch), /showErrorBox/);
  assert.match(credentialRefresh, /legacyBackendLifecycle\.scheduleCredentialRefresh\(\)/);
  assert.doesNotMatch(credentialRefresh, /gracefulKillBackend\(\)/);
});
