"use strict";

const { contextBridge, ipcRenderer, webUtils } = require('electron');

const DESKTOP_CORE_CHANNELS = Object.freeze({
  getState: "openxnet:desktop-core:get-state",
  listCapabilities: "openxnet:desktop-core:list-capabilities",
  ensureCapability: "openxnet:desktop-core:ensure-capability",
  listFeaturePacks: "openxnet:desktop-core:list-feature-packs",
  installFeaturePack: "openxnet:desktop-core:install-feature-pack",
  repairFeaturePack: "openxnet:desktop-core:repair-feature-pack",
  uninstallFeaturePack: "openxnet:desktop-core:uninstall-feature-pack",
  featurePackProgress: "openxnet:desktop-core:feature-pack-progress",
  stateChanged: "openxnet:desktop-core:state-changed",
});

const APPLICATION_SETTINGS_CHANNELS = Object.freeze({
  getSystemSettings: "openxnet:application-settings:get-system-settings",
  saveSystemSettings: "openxnet:application-settings:save-system-settings",
});

const APPLICATION_AUTH_CHANNELS = Object.freeze({
  getSession: "openxnet:application-auth:get-session",
  saveSession: "openxnet:application-auth:save-session",
  clearSession: "openxnet:application-auth:clear-session",
});

const APPLICATION_ACCESS_CHANNELS = Object.freeze({
  request: "openxnet:application-access:request",
});

const APPLICATION_SEARCH_CREDENTIAL_CHANNELS = Object.freeze({
  getSnapshot: "openxnet:application-search-credentials:get-snapshot",
  save: "openxnet:application-search-credentials:save",
});

const APPLICATION_VOICE_CREDENTIAL_CHANNELS = Object.freeze({
  getSnapshot: "openxnet:application-voice-credentials:get-snapshot",
  save: "openxnet:application-voice-credentials:save",
});

const APPLICATION_VOICE_RUNTIME_CHANNELS = Object.freeze({
  transcribe: "openxnet:application-voice-runtime:transcribe",
  synthesize: "openxnet:application-voice-runtime:synthesize",
  listSystemVoices: "openxnet:application-voice-runtime:list-system-voices",
  listProviderVoices: "openxnet:application-voice-runtime:list-provider-voices",
  importReference: "openxnet:application-voice-runtime:import-reference",
  removeReference: "openxnet:application-voice-runtime:remove-reference",
});

const APPLICATION_VRM_PRESENTATION_CHANNELS = Object.freeze({
  status: "openxnet:application-vrm-presentation:status",
  publish: "openxnet:application-vrm-presentation:publish",
});
const APPLICATION_SYSTEM_RUNTIME_CHANNELS = Object.freeze({
  applyProxy: "openxnet:application-system-runtime:apply-proxy",
  revealDirectory: "openxnet:application-system-runtime:reveal-directory",
  networkAddress: "openxnet:application-system-runtime:network-address",
});

const APPLICATION_MCP_CREDENTIAL_CHANNELS = Object.freeze({
  getSnapshot: "openxnet:application-mcp-credentials:get-snapshot",
  save: "openxnet:application-mcp-credentials:save",
});

const APPLICATION_MCP_RUNTIME_CHANNELS = Object.freeze({
  status: "openxnet:application-mcp-runtime:status",
  start: "openxnet:application-mcp-runtime:start",
  stop: "openxnet:application-mcp-runtime:stop",
  listTools: "openxnet:application-mcp-runtime:list-tools",
});

const APPLICATION_HTTP_TOOL_CREDENTIAL_CHANNELS = Object.freeze({
  getSnapshot: "openxnet:application-http-tool-credentials:get-snapshot",
  save: "openxnet:application-http-tool-credentials:save",
});

const APPLICATION_CONNECTOR_CREDENTIAL_CHANNELS = Object.freeze({
  getSnapshot: "openxnet:application-connector-credentials:get-snapshot",
  save: "openxnet:application-connector-credentials:save",
});

const APPLICATION_CONNECTOR_RUNTIME_CHANNELS = Object.freeze({
  status: "openxnet:application-connector-runtime:status",
  start: "openxnet:application-connector-runtime:start",
  stop: "openxnet:application-connector-runtime:stop",
  reload: "openxnet:application-connector-runtime:reload",
  update: "openxnet:application-connector-runtime:update",
});

const APPLICATION_TELEGRAM_CREDENTIAL_CHANNELS = Object.freeze({
  getSnapshot: "openxnet:application-telegram-credentials:get-snapshot",
  save: "openxnet:application-telegram-credentials:save",
});

const APPLICATION_IMAGE_HOST_CREDENTIAL_CHANNELS = Object.freeze({
  getSnapshot: "openxnet:application-image-host-credentials:get-snapshot",
  save: "openxnet:application-image-host-credentials:save",
});

const APPLICATION_REPOSITORY_CREDENTIAL_CHANNELS = Object.freeze({
  getSnapshot: "openxnet:application-repository-credentials:get-snapshot",
  save: "openxnet:application-repository-credentials:save",
});

const APPLICATION_LIVE_PLATFORM_CREDENTIAL_CHANNELS = Object.freeze({
  getSnapshot: "openxnet:application-live-platform-credentials:get-snapshot",
  save: "openxnet:application-live-platform-credentials:save",
});

const APPLICATION_LIVE_RUNTIME_CHANNELS = Object.freeze({
  status: "openxnet:application-live-runtime:status",
  start: "openxnet:application-live-runtime:start",
  stop: "openxnet:application-live-runtime:stop",
  reload: "openxnet:application-live-runtime:reload",
  event: "openxnet:application-live-runtime:event",
});

const APPLICATION_CODE_SANDBOX_CREDENTIAL_CHANNELS = Object.freeze({
  getSnapshot: "openxnet:application-code-sandbox-credentials:get-snapshot",
  save: "openxnet:application-code-sandbox-credentials:save",
});

const APPLICATION_HOME_ASSISTANT_CREDENTIAL_CHANNELS = Object.freeze({
  getSnapshot: "openxnet:application-home-assistant-credentials:get-snapshot",
  save: "openxnet:application-home-assistant-credentials:save",
});

const APPLICATION_SQL_CREDENTIAL_CHANNELS = Object.freeze({
  getSnapshot: "openxnet:application-sql-credentials:get-snapshot",
  save: "openxnet:application-sql-credentials:save",
  selectDatabase: "openxnet:application-sql-credentials:select-database",
});

const APPLICATION_COMFYUI_CREDENTIAL_CHANNELS = Object.freeze({
  getSnapshot: "openxnet:application-comfyui-credentials:get-snapshot",
  save: "openxnet:application-comfyui-credentials:save",
});

const APPLICATION_DELIVERY_CREDENTIAL_CHANNELS = Object.freeze({
  getSnapshot: "openxnet:application-delivery-credentials:get-snapshot",
  save: "openxnet:application-delivery-credentials:save",
});

const APPLICATION_ARTIFACT_CHANNELS = Object.freeze({
  list: "openxnet:application-artifacts:list",
  importFiles: "openxnet:application-artifacts:import-files",
  importRendererFiles: "openxnet:application-artifacts:import-renderer-files",
  registerFiles: "openxnet:application-artifacts:register-files",
  delete: "openxnet:application-artifacts:delete",
});

const MAX_RENDERER_INLINE_ARTIFACT_BYTES = 32 * 1024 * 1024;
const MAX_RENDERER_INLINE_ARTIFACT_BATCH_BYTES = 64 * 1024 * 1024;
const MAX_RENDERER_ARTIFACT_BATCH_SIZE = 256;

const APPLICATION_TASK_CHANNELS = Object.freeze({
  list: "openxnet:application-tasks:list",
  get: "openxnet:application-tasks:get",
  create: "openxnet:application-tasks:create",
});

const APPLICATION_TASK_EXECUTION_CHANNELS = Object.freeze({
  refresh: "openxnet:application-task-execution:refresh",
  get: "openxnet:application-task-execution:get",
  createWorkbench: "openxnet:application-task-execution:create-workbench",
  dispatch: "openxnet:application-task-execution:dispatch",
  start: "openxnet:application-task-execution:start",
  resume: "openxnet:application-task-execution:resume",
  cancel: "openxnet:application-task-execution:cancel",
  delete: "openxnet:application-task-execution:delete",
  changed: "openxnet:application-task-execution:changed",
});

const APPLICATION_CHAT_CHANNELS = Object.freeze({
  startStream: "openxnet:application-chat:start-stream",
  complete: "openxnet:application-chat:complete",
  listModels: "openxnet:application-chat:list-models",
  abort: "openxnet:application-chat:abort",
  executeTool: "openxnet:application-chat:execute-tool",
  resolveApproval: "openxnet:application-chat:resolve-approval",
  streamEvent: "openxnet:application-chat:stream-event",
});

const APPLICATION_KNOWLEDGE_BASE_RUNTIME_CHANNELS = Object.freeze({
  build: "openxnet:application-knowledge-base-runtime:build",
  status: "openxnet:application-knowledge-base-runtime:status",
  remove: "openxnet:application-knowledge-base-runtime:remove",
  query: "openxnet:application-knowledge-base-runtime:query",
});

const APPLICATION_DESKTOP_CONTROL_RUNTIME_CHANNELS = Object.freeze({
  listWindows: "openxnet:application-desktop-control-runtime:list-windows",
  listMonitors: "openxnet:application-desktop-control-runtime:list-monitors",
  getActiveWindow: "openxnet:application-desktop-control-runtime:get-active-window",
  listHistory: "openxnet:application-desktop-control-runtime:list-history",
  executeAction: "openxnet:application-desktop-control-runtime:execute-action",
});

const APPLICATION_TOOLCHAIN_RUNTIME_CHANNELS = Object.freeze({
  probe: "openxnet:application-toolchain-runtime:probe",
  listDockerContainers: "openxnet:application-toolchain-runtime:list-docker-containers",
  pullDockerImage: "openxnet:application-toolchain-runtime:pull-docker-image",
  mutateDockerContainer: "openxnet:application-toolchain-runtime:mutate-docker-container",
});

const APPLICATION_DEVELOPER_WORKBENCH_CHANNELS = Object.freeze({
  overview: "openxnet:application-developer-workbench:overview",
  repositories: "openxnet:application-developer-workbench:repositories",
  searchCode: "openxnet:application-developer-workbench:search-code",
  listSnapshots: "openxnet:application-developer-workbench:list-snapshots",
  createSnapshot: "openxnet:application-developer-workbench:create-snapshot",
  importSnapshot: "openxnet:application-developer-workbench:import-snapshot",
  getSnapshot: "openxnet:application-developer-workbench:get-snapshot",
  restoreSnapshot: "openxnet:application-developer-workbench:restore-snapshot",
  deleteSnapshot: "openxnet:application-developer-workbench:delete-snapshot",
  applyWorkspace: "openxnet:application-developer-workbench:apply-workspace",
  applyMapping: "openxnet:application-developer-workbench:apply-mapping",
});

const APPLICATION_VR_ASSET_CHANNELS = Object.freeze({
  list: "openxnet:application-vr-assets:list",
  importAsset: "openxnet:application-vr-assets:import",
  deleteAsset: "openxnet:application-vr-assets:delete",
  downloadCloudModel: "openxnet:application-vr-assets:download-cloud-model",
});

const APPLICATION_EXTENSION_RUNTIME_CHANNELS = Object.freeze({
  list: "openxnet:application-extensions:list",
  listRemote: "openxnet:application-extensions:list-remote",
  installRepository: "openxnet:application-extensions:install-repository",
  importArchive: "openxnet:application-extensions:import-archive",
  update: "openxnet:application-extensions:update",
  remove: "openxnet:application-extensions:remove",
  start: "openxnet:application-extensions:start",
  stop: "openxnet:application-extensions:stop",
});

const APPLICATION_SKILL_RUNTIME_CHANNELS = Object.freeze({
  list: "openxnet:application-skills:list",
  content: "openxnet:application-skills:content",
  installRepository: "openxnet:application-skills:install-repository",
  importArchive: "openxnet:application-skills:import-archive",
  crystallize: "openxnet:application-skills:crystallize",
  uploadMlops: "openxnet:application-skills:upload-mlops",
  remove: "openxnet:application-skills:remove",
  projectStatus: "openxnet:application-skills:project-status",
  syncProject: "openxnet:application-skills:sync-project",
  revealDirectory: "openxnet:application-skills:reveal-directory",
});

const APPLICATION_ENTERPRISE_RUNTIME_CHANNELS = Object.freeze({
  listRoleCards: "openxnet:application-enterprise:list-role-cards",
  saveRoleCard: "openxnet:application-enterprise:save-role-card",
  removeRoleCard: "openxnet:application-enterprise:remove-role-card",
  listTeamTemplates: "openxnet:application-enterprise:list-team-templates",
  saveTeamTemplate: "openxnet:application-enterprise:save-team-template",
  removeTeamTemplate: "openxnet:application-enterprise:remove-team-template",
  listKnowledgeBases: "openxnet:application-enterprise:list-knowledge-bases",
  saveKnowledgeBase: "openxnet:application-enterprise:save-knowledge-base",
  removeKnowledgeBase: "openxnet:application-enterprise:remove-knowledge-base",
  listKnowledgeBaseVersions: "openxnet:application-enterprise:list-knowledge-base-versions",
  listWorkspaces: "openxnet:application-enterprise:list-workspaces",
  saveWorkspace: "openxnet:application-enterprise:save-workspace",
  removeWorkspace: "openxnet:application-enterprise:remove-workspace",
  listProjects: "openxnet:application-enterprise:list-projects",
  saveProject: "openxnet:application-enterprise:save-project",
  removeProject: "openxnet:application-enterprise:remove-project",
  listMessages: "openxnet:application-enterprise:list-messages",
  postMessage: "openxnet:application-enterprise:post-message",
  listSkillBindings: "openxnet:application-enterprise:list-skill-bindings",
  setSkillBinding: "openxnet:application-enterprise:set-skill-binding",
  getSandboxState: "openxnet:application-enterprise:get-sandbox-state",
  listXnetServices: "openxnet:application-enterprise:list-xnet-services",
  saveXnetService: "openxnet:application-enterprise:save-xnet-service",
  checkXnetService: "openxnet:application-enterprise:check-xnet-service",
  checkAllXnetServices: "openxnet:application-enterprise:check-all-xnet-services",
});

const APPLICATION_AGENTTEAMS_RUNTIME_CHANNELS = Object.freeze({
  status: "openxnet:application-agentteams-runtime:status",
  applyTeam: "openxnet:application-agentteams-runtime:apply-team",
  getTeam: "openxnet:application-agentteams-runtime:get-team",
});

const APPLICATION_COMPETITION_RUNTIME_CHANNELS = Object.freeze({
  getUiProfile: "openxnet:application-competition-runtime:get-ui-profile",
  getSnapshot: "openxnet:application-competition-runtime:get-snapshot",
  resetDemoData: "openxnet:application-competition-runtime:reset-demo-data",
  startEnterpriseTask: "openxnet:application-competition-runtime:start-enterprise-task",
  createIncident: "openxnet:application-competition-runtime:create-incident",
  runInvestigation: "openxnet:application-competition-runtime:run-investigation",
  decideApproval: "openxnet:application-competition-runtime:decide-approval",
  executeRollback: "openxnet:application-competition-runtime:execute-rollback",
  verifyRemediation: "openxnet:application-competition-runtime:verify-remediation",
  readResource: "openxnet:application-competition-runtime:read-resource",
  exportRetrospective: "openxnet:application-competition-runtime:export-retrospective",
  exportEvaluation: "openxnet:application-competition-runtime:export-evaluation",
  setAdapterMode: "openxnet:application-competition-runtime:set-adapter-mode",
});

const APPLICATION_ENTERPRISE_INSIGHTS_RUNTIME_CHANNELS = Object.freeze({
  loadUsageDashboard: "openxnet:application-enterprise-insights:load-usage-dashboard",
  loadNeuroDashboard: "openxnet:application-enterprise-insights:load-neuro-dashboard",
  searchNeuroSymbols: "openxnet:application-enterprise-insights:search-neuro-symbols",
  removeNeuroSymbol: "openxnet:application-enterprise-insights:remove-neuro-symbol",
  runNeuroMaintenance: "openxnet:application-enterprise-insights:run-neuro-maintenance",
  loadKnowledgeGraph: "openxnet:application-enterprise-insights:load-knowledge-graph",
  queryKnowledgeGraphEntity: "openxnet:application-enterprise-insights:query-knowledge-graph-entity",
});

const APPLICATION_KERNEL_RUNTIME_CHANNELS = Object.freeze({
  invoke: "openxnet:application-kernel-runtime:invoke",
});

const APPLICATION_MODEL_ASSET_CHANNELS = Object.freeze({
  getStatus: "openxnet:application-model-assets:get-status",
  download: "openxnet:application-model-assets:download",
  remove: "openxnet:application-model-assets:remove",
  progress: "openxnet:application-model-assets:progress",
});

const APPLICATION_RECALL_RUNTIME_CHANNELS = Object.freeze({
  bootstrap: "openxnet:application-recall-runtime:bootstrap",
  search: "openxnet:application-recall-runtime:search",
  timeline: "openxnet:application-recall-runtime:timeline",
  observations: "openxnet:application-recall-runtime:observations",
  resume: "openxnet:application-recall-runtime:resume",
  rollback: "openxnet:application-recall-runtime:rollback",
  publishObservationFocus: "openxnet:application-recall-runtime:publish-observation-focus",
});

const APPLICATION_PROVIDER_CHANNELS = Object.freeze({
  getSnapshot: "openxnet:application-providers:get-snapshot",
  saveProviders: "openxnet:application-providers:save",
  validateProvider: "openxnet:application-providers:validate",
  probeEmbedding: "openxnet:application-providers:probe-embedding",
});

const APPLICATION_AGENT_RUNTIME_CHANNELS = Object.freeze({
  createAgent: "openxnet:application-agent-runtime:create-agent",
  removeAgent: "openxnet:application-agent-runtime:remove-agent",
  inspectA2a: "openxnet:application-agent-runtime:inspect-a2a",
});

const APPLICATION_MEMORY_MANAGEMENT_CHANNELS = Object.freeze({
  listRecords: "openxnet:application-memory-management:list-records",
  updateRecord: "openxnet:application-memory-management:update-record",
  deleteRecord: "openxnet:application-memory-management:delete-record",
  removeCollection: "openxnet:application-memory-management:remove-collection",
});

const APPLICATION_SYNAPXNET_MEMORY_CHANNELS = Object.freeze({
  recover: "openxnet:application-synapxnet-memory:recover",
  status: "openxnet:application-synapxnet-memory:status",
  list: "openxnet:application-synapxnet-memory:list",
  history: "openxnet:application-synapxnet-memory:history",
  create: "openxnet:application-synapxnet-memory:create",
  edit: "openxnet:application-synapxnet-memory:edit",
  rollback: "openxnet:application-synapxnet-memory:rollback",
  retire: "openxnet:application-synapxnet-memory:retire",
  export: "openxnet:application-synapxnet-memory:export",
  import: "openxnet:application-synapxnet-memory:import",
  verify: "openxnet:application-synapxnet-memory:verify",
});

const LEGACY_RENDERER_STATE_CHANNELS = Object.freeze({
  getSnapshot: "openxnet:legacy-renderer-state:get-snapshot",
  saveSettings: "openxnet:legacy-renderer-state:save-settings",
  saveConversations: "openxnet:legacy-renderer-state:save-conversations",
  saveVrmConfig: "openxnet:legacy-renderer-state:save-vrm-config",
  changed: "openxnet:legacy-renderer-state:changed",
});

const DESKTOP_BOOTSTRAP_CHANNEL = "openxnet:desktop-bootstrap:get";

/**
 * Subscribe to an IPC event while hiding the Electron event object.
 *
 * @param {string} channel Main-to-Renderer event channel.
 * @param {Function} callback Renderer callback.
 * @returns {Function} Exact listener unsubscriber.
 */
function onRendererEvent(channel, callback) {
  if (typeof callback !== "function") {
    throw new TypeError("Renderer event callback must be a function.");
  }
  const listener = (_event, ...args) => callback(...args);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

/**
 * 从用户真实选择或生成的 File 构造专用 Artifact 请求；输入 File 数组，返回 Main 写入结果，不暴露本机路径，非法类型或超出预算时抛错。
 *
 * @param {File[]} files Renderer 通过文件框、拖放、粘贴或截图产生的文件。
 * @returns {Promise<Record<string, unknown>>} Desktop Core Artifact 写入结果。
 */
async function importRendererApplicationArtifacts(files) {
  if (!Array.isArray(files) || files.length === 0 || files.length > MAX_RENDERER_ARTIFACT_BATCH_SIZE) {
    throw new TypeError(`Artifact files must contain between 1 and ${MAX_RENDERER_ARTIFACT_BATCH_SIZE} items.`);
  }
  const entries = [];
  let inlineBytes = 0;
  for (const file of files) {
    if (!file || typeof file.name !== "string" || !file.name.trim()) {
      throw new TypeError("Artifact selection contains an invalid File.");
    }
    const nativePath = webUtils.getPathForFile(file);
    if (nativePath) {
      entries.push({ source: "path", path: nativePath });
      continue;
    }
    const size = Number(file.size);
    if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_RENDERER_INLINE_ARTIFACT_BYTES) {
      throw new RangeError("Generated artifact exceeds its byte budget.");
    }
    inlineBytes += size;
    if (inlineBytes > MAX_RENDERER_INLINE_ARTIFACT_BATCH_BYTES) {
      throw new RangeError("Generated artifact batch exceeds its byte budget.");
    }
    if (typeof file.arrayBuffer !== "function") {
      throw new TypeError("Generated artifact cannot expose its bytes.");
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength !== size) {
      throw new Error("Generated artifact size changed while it was read.");
    }
    entries.push({ source: "bytes", originalName: file.name, bytes });
  }
  return ipcRenderer.invoke(APPLICATION_ARTIFACT_CHANNELS.importRendererFiles, { entries });
}

/**
 * 从真实 File 构造专用 Voice 参考音频请求；输入 File，返回 Main 元数据，非法来源或超过 25 MiB 时抛错。
 *
 * @param {File} file Renderer 选择或拖入的音频文件。
 * @returns {Promise<Record<string, unknown>>} 不含绝对路径的参考音频元数据。
 */
async function importRendererApplicationVoiceReference(file) {
  if (!file || typeof file.name !== "string" || !file.name.trim()) {
    throw new TypeError("Voice reference selection is invalid.");
  }
  const nativePath = webUtils.getPathForFile(file);
  if (nativePath) {
    return ipcRenderer.invoke(APPLICATION_VOICE_RUNTIME_CHANNELS.importReference, {
      entry: { source: "path", path: nativePath, originalName: file.name },
    });
  }
  const size = Number(file.size);
  if (!Number.isSafeInteger(size) || size < 1 || size > 25 * 1024 * 1024 || typeof file.arrayBuffer !== "function") {
    throw new RangeError("Voice reference exceeds its inline byte budget.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength !== size) {
    throw new Error("Voice reference size changed while it was read.");
  }
  return ipcRenderer.invoke(APPLICATION_VOICE_RUNTIME_CHANNELS.importReference, {
    entry: { source: "bytes", bytes, originalName: file.name },
  });
}

/**
 * 从真实 File 构造专用 VR 资产请求；输入类型、显示名和 File，返回 Main 写入结果，非法来源或内联超限时抛错。
 *
 * @param {{kind: string, displayName: string, file: File}} request Renderer 资产导入请求。
 * @returns {Promise<Record<string, unknown>>} VR Asset Runtime 写入结果。
 */
async function importRendererApplicationVrAsset(request) {
  if (!request || typeof request !== "object" || !["model", "motion", "scene"].includes(request.kind)) {
    throw new TypeError("VR asset import request is invalid.");
  }
  const displayName = String(request.displayName || "").trim();
  const file = request.file;
  if (!displayName || !file || typeof file.name !== "string" || !file.name.trim()) {
    throw new TypeError("VR asset selection is invalid.");
  }
  const nativePath = webUtils.getPathForFile(file);
  if (nativePath) {
    return ipcRenderer.invoke(APPLICATION_VR_ASSET_CHANNELS.importAsset, {
      kind: request.kind,
      displayName,
      entry: { source: "path", path: nativePath, originalName: file.name },
    });
  }
  const size = Number(file.size);
  if (!Number.isSafeInteger(size) || size <= 0 || size > 64 * 1024 * 1024 || typeof file.arrayBuffer !== "function") {
    throw new RangeError("Generated VR asset exceeds its byte budget.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength !== size) throw new Error("Generated VR asset size changed while it was read.");
  return ipcRenderer.invoke(APPLICATION_VR_ASSET_CHANNELS.importAsset, {
    kind: request.kind,
    displayName,
    entry: { source: "bytes", originalName: file.name, bytes },
  });
}

/**
 * 从真实 File 构造扩展或技能 ZIP 请求；输入 File、内联预算和标签，返回 Main 文件项，非法或超限时抛错。
 *
 * @param {File} file Renderer 通过文件框选择的 ZIP。
 * @param {number} maximumInlineBytes 无本机路径时允许的最大字节数。
 * @param {string} label 错误消息标签。
 * @returns {Promise<Record<string, unknown>>} preload 收敛后的路径或字节项。
 */
async function createRendererPackageArchiveEntry(file, maximumInlineBytes, label) {
  if (!file || typeof file.name !== "string" || !file.name.trim().toLowerCase().endsWith(".zip")) {
    throw new TypeError(`${label} selection is invalid.`);
  }
  const nativePath = webUtils.getPathForFile(file);
  if (nativePath) return { source: "path", path: nativePath, originalName: file.name };
  const size = Number(file.size);
  if (!Number.isSafeInteger(size) || size <= 0 || size > maximumInlineBytes || typeof file.arrayBuffer !== "function") {
    throw new RangeError(`${label} exceeds its inline byte budget.`);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength !== size) throw new Error(`${label} size changed while it was read.`);
  return { source: "bytes", originalName: file.name, bytes };
}

/**
 * 导入本机扩展 ZIP；输入真实 File 请求，返回 Main Runtime 写入结果，路径或字节由 preload 收敛。
 *
 * @param {{file: File}} request Renderer 扩展 ZIP 请求。
 * @returns {Promise<Record<string, unknown>>} Extension Runtime 写入结果。
 */
async function importRendererApplicationExtensionArchive(request) {
  const entry = await createRendererPackageArchiveEntry(request?.file, 32 * 1024 * 1024, "Extension ZIP");
  return ipcRenderer.invoke(APPLICATION_EXTENSION_RUNTIME_CHANNELS.importArchive, { entry });
}

/**
 * 导入本机技能 ZIP；输入真实 File 请求，返回 Main Runtime 写入结果，路径或字节由 preload 收敛。
 *
 * @param {{file: File}} request Renderer 技能 ZIP 请求。
 * @returns {Promise<Record<string, unknown>>} Skill Runtime 写入结果。
 */
async function importRendererApplicationSkillArchive(request) {
  const entry = await createRendererPackageArchiveEntry(request?.file, 16 * 1024 * 1024, "Skill ZIP");
  return ipcRenderer.invoke(APPLICATION_SKILL_RUNTIME_CHANNELS.importArchive, { entry });
}

/** 向受信任 Renderer 暴露 allow-list Desktop Core API，不允许任意模块或 IPC 访问。 */
function exposeDesktopCore() {
  contextBridge.exposeInMainWorld("openxnetDesktop", {
    getBootstrapSnapshot: () => ipcRenderer.invoke(DESKTOP_BOOTSTRAP_CHANNEL),
    getAuthSession: () => ipcRenderer.invoke(APPLICATION_AUTH_CHANNELS.getSession),
    saveAuthSession: (request) => ipcRenderer.invoke(APPLICATION_AUTH_CHANNELS.saveSession, request),
    clearAuthSession: () => ipcRenderer.invoke(APPLICATION_AUTH_CHANNELS.clearSession),
    requestAccess: (request) => ipcRenderer.invoke(APPLICATION_ACCESS_CHANNELS.request, request),
    getApplicationSearchCredentials: () => ipcRenderer.invoke(APPLICATION_SEARCH_CREDENTIAL_CHANNELS.getSnapshot),
    saveApplicationSearchCredentials: (request) => ipcRenderer.invoke(APPLICATION_SEARCH_CREDENTIAL_CHANNELS.save, request),
    getApplicationVoiceCredentials: () => ipcRenderer.invoke(APPLICATION_VOICE_CREDENTIAL_CHANNELS.getSnapshot),
    saveApplicationVoiceCredentials: (request) => ipcRenderer.invoke(APPLICATION_VOICE_CREDENTIAL_CHANNELS.save, request),
    transcribeApplicationVoice: (request) => ipcRenderer.invoke(APPLICATION_VOICE_RUNTIME_CHANNELS.transcribe, request),
    synthesizeApplicationVoice: (request) => ipcRenderer.invoke(APPLICATION_VOICE_RUNTIME_CHANNELS.synthesize, request),
    listApplicationSystemVoices: () => ipcRenderer.invoke(APPLICATION_VOICE_RUNTIME_CHANNELS.listSystemVoices),
    listApplicationProviderVoices: (request) => ipcRenderer.invoke(APPLICATION_VOICE_RUNTIME_CHANNELS.listProviderVoices, request),
    importApplicationVoiceReference: (file) => importRendererApplicationVoiceReference(file),
    removeApplicationVoiceReference: (request) => ipcRenderer.invoke(APPLICATION_VOICE_RUNTIME_CHANNELS.removeReference, request),
    getApplicationVrmPresentationStatus: () => ipcRenderer.invoke(APPLICATION_VRM_PRESENTATION_CHANNELS.status),
    publishApplicationVrmPresentation: (request) => ipcRenderer.invoke(APPLICATION_VRM_PRESENTATION_CHANNELS.publish, request),
    /** 应用 Main-owned 代理设置，不向 Renderer 返回代理值。 */
    applyApplicationSystemProxy: () => ipcRenderer.invoke(APPLICATION_SYSTEM_RUNTIME_CHANNELS.applyProxy),
    /** 打开一个固定应用目录，Renderer 只提交目录枚举。 */
    revealApplicationSystemDirectory: (request) => ipcRenderer.invoke(APPLICATION_SYSTEM_RUNTIME_CHANNELS.revealDirectory, request),
    /** 读取 Main 选择的局域网 IPv4 地址。 */
    getApplicationSystemNetworkAddress: () => ipcRenderer.invoke(APPLICATION_SYSTEM_RUNTIME_CHANNELS.networkAddress),
    getApplicationMcpCredentials: () => ipcRenderer.invoke(APPLICATION_MCP_CREDENTIAL_CHANNELS.getSnapshot),
    saveApplicationMcpCredentials: (request) => ipcRenderer.invoke(APPLICATION_MCP_CREDENTIAL_CHANNELS.save, request),
    getApplicationMcpRuntimeStatus: (request) => ipcRenderer.invoke(APPLICATION_MCP_RUNTIME_CHANNELS.status, request),
    startApplicationMcpRuntime: (request) => ipcRenderer.invoke(APPLICATION_MCP_RUNTIME_CHANNELS.start, request),
    stopApplicationMcpRuntime: (request) => ipcRenderer.invoke(APPLICATION_MCP_RUNTIME_CHANNELS.stop, request),
    /** 发现一个 MCP 集成的脱敏工具摘要。 */
    listApplicationMcpRuntimeTools: (request) => ipcRenderer.invoke(APPLICATION_MCP_RUNTIME_CHANNELS.listTools, request),
    getApplicationHttpToolCredentials: () => ipcRenderer.invoke(APPLICATION_HTTP_TOOL_CREDENTIAL_CHANNELS.getSnapshot),
    saveApplicationHttpToolCredentials: (request) => ipcRenderer.invoke(APPLICATION_HTTP_TOOL_CREDENTIAL_CHANNELS.save, request),
    getApplicationConnectorCredentials: () => ipcRenderer.invoke(APPLICATION_CONNECTOR_CREDENTIAL_CHANNELS.getSnapshot),
    saveApplicationConnectorCredentials: (request) => ipcRenderer.invoke(APPLICATION_CONNECTOR_CREDENTIAL_CHANNELS.save, request),
    getApplicationConnectorRuntimeStatus: (request) => ipcRenderer.invoke(APPLICATION_CONNECTOR_RUNTIME_CHANNELS.status, request),
    startApplicationConnectorRuntime: (request) => ipcRenderer.invoke(APPLICATION_CONNECTOR_RUNTIME_CHANNELS.start, request),
    stopApplicationConnectorRuntime: (request) => ipcRenderer.invoke(APPLICATION_CONNECTOR_RUNTIME_CHANNELS.stop, request),
    reloadApplicationConnectorRuntime: (request) => ipcRenderer.invoke(APPLICATION_CONNECTOR_RUNTIME_CHANNELS.reload, request),
    updateApplicationConnectorRuntime: (request) => ipcRenderer.invoke(APPLICATION_CONNECTOR_RUNTIME_CHANNELS.update, request),
    getApplicationTelegramCredentials: () => ipcRenderer.invoke(APPLICATION_TELEGRAM_CREDENTIAL_CHANNELS.getSnapshot),
    saveApplicationTelegramCredentials: (request) => ipcRenderer.invoke(APPLICATION_TELEGRAM_CREDENTIAL_CHANNELS.save, request),
    getApplicationImageHostCredentials: () => ipcRenderer.invoke(APPLICATION_IMAGE_HOST_CREDENTIAL_CHANNELS.getSnapshot),
    saveApplicationImageHostCredentials: (request) => ipcRenderer.invoke(APPLICATION_IMAGE_HOST_CREDENTIAL_CHANNELS.save, request),
    getApplicationRepositoryCredentials: () => ipcRenderer.invoke(APPLICATION_REPOSITORY_CREDENTIAL_CHANNELS.getSnapshot),
    saveApplicationRepositoryCredentials: (request) => ipcRenderer.invoke(APPLICATION_REPOSITORY_CREDENTIAL_CHANNELS.save, request),
    getApplicationLivePlatformCredentials: () => ipcRenderer.invoke(APPLICATION_LIVE_PLATFORM_CREDENTIAL_CHANNELS.getSnapshot),
    saveApplicationLivePlatformCredentials: (request) => ipcRenderer.invoke(APPLICATION_LIVE_PLATFORM_CREDENTIAL_CHANNELS.save, request),
    getApplicationLiveRuntimeStatus: () => ipcRenderer.invoke(APPLICATION_LIVE_RUNTIME_CHANNELS.status),
    startApplicationLiveRuntime: (request) => ipcRenderer.invoke(APPLICATION_LIVE_RUNTIME_CHANNELS.start, request),
    stopApplicationLiveRuntime: () => ipcRenderer.invoke(APPLICATION_LIVE_RUNTIME_CHANNELS.stop),
    reloadApplicationLiveRuntime: (request) => ipcRenderer.invoke(APPLICATION_LIVE_RUNTIME_CHANNELS.reload, request),
    onApplicationLiveRuntimeEvent: (callback) => onRendererEvent(APPLICATION_LIVE_RUNTIME_CHANNELS.event, callback),
    getApplicationCodeSandboxCredentials: () => ipcRenderer.invoke(APPLICATION_CODE_SANDBOX_CREDENTIAL_CHANNELS.getSnapshot),
    saveApplicationCodeSandboxCredentials: (request) => ipcRenderer.invoke(APPLICATION_CODE_SANDBOX_CREDENTIAL_CHANNELS.save, request),
    getApplicationHomeAssistantCredentials: () => ipcRenderer.invoke(APPLICATION_HOME_ASSISTANT_CREDENTIAL_CHANNELS.getSnapshot),
    saveApplicationHomeAssistantCredentials: (request) => ipcRenderer.invoke(APPLICATION_HOME_ASSISTANT_CREDENTIAL_CHANNELS.save, request),
    /** 读取 SQL 脱敏凭据和数据库授权状态。 */
    getApplicationSqlCredentials: () => ipcRenderer.invoke(APPLICATION_SQL_CREDENTIAL_CHANNELS.getSnapshot),
    /** 保存新输入或显式清除的 SQL 口令。 */
    saveApplicationSqlCredentials: (request) => ipcRenderer.invoke(APPLICATION_SQL_CREDENTIAL_CHANNELS.save, request),
    /** 通过 Main 系统对话框选择并授权 SQLite 文件。 */
    selectApplicationSqliteDatabase: () => ipcRenderer.invoke(APPLICATION_SQL_CREDENTIAL_CHANNELS.selectDatabase),
    getApplicationComfyUiCredentials: () => ipcRenderer.invoke(APPLICATION_COMFYUI_CREDENTIAL_CHANNELS.getSnapshot),
    saveApplicationComfyUiCredentials: (request) => ipcRenderer.invoke(APPLICATION_COMFYUI_CREDENTIAL_CHANNELS.save, request),
    getApplicationDeliveryCredentials: () => ipcRenderer.invoke(APPLICATION_DELIVERY_CREDENTIAL_CHANNELS.getSnapshot),
    saveApplicationDeliveryCredentials: (request) => ipcRenderer.invoke(APPLICATION_DELIVERY_CREDENTIAL_CHANNELS.save, request),
    listArtifacts: (request = {}) => ipcRenderer.invoke(APPLICATION_ARTIFACT_CHANNELS.list, request),
    importArtifacts: (request) => ipcRenderer.invoke(APPLICATION_ARTIFACT_CHANNELS.importFiles, request),
    importSelectedArtifacts: (files) => importRendererApplicationArtifacts(files),
    registerArtifacts: (request) => ipcRenderer.invoke(APPLICATION_ARTIFACT_CHANNELS.registerFiles, request),
    deleteArtifacts: (request) => ipcRenderer.invoke(APPLICATION_ARTIFACT_CHANNELS.delete, request),
    listTasks: (request = {}) => ipcRenderer.invoke(APPLICATION_TASK_CHANNELS.list, request),
    getTask: (request) => ipcRenderer.invoke(APPLICATION_TASK_CHANNELS.get, request),
    createTask: (request) => ipcRenderer.invoke(APPLICATION_TASK_CHANNELS.create, request),
    refreshTaskExecutions: (request) => ipcRenderer.invoke(APPLICATION_TASK_EXECUTION_CHANNELS.refresh, request),
    getTaskExecution: (request) => ipcRenderer.invoke(APPLICATION_TASK_EXECUTION_CHANNELS.get, request),
    createDeveloperWorkbenchTaskExecution: (request) => ipcRenderer.invoke(APPLICATION_TASK_EXECUTION_CHANNELS.createWorkbench, request),
    dispatchTaskExecution: (request) => ipcRenderer.invoke(APPLICATION_TASK_EXECUTION_CHANNELS.dispatch, request),
    startTaskExecution: (request) => ipcRenderer.invoke(APPLICATION_TASK_EXECUTION_CHANNELS.start, request),
    resumeTaskExecution: (request) => ipcRenderer.invoke(APPLICATION_TASK_EXECUTION_CHANNELS.resume, request),
    cancelTaskExecution: (request) => ipcRenderer.invoke(APPLICATION_TASK_EXECUTION_CHANNELS.cancel, request),
    deleteTaskExecution: (request) => ipcRenderer.invoke(APPLICATION_TASK_EXECUTION_CHANNELS.delete, request),
    onTaskExecutionChanged: (callback) => onRendererEvent(APPLICATION_TASK_EXECUTION_CHANNELS.changed, callback),
    startApplicationChatStream: (request) => ipcRenderer.invoke(APPLICATION_CHAT_CHANNELS.startStream, request),
    completeApplicationChat: (request) => ipcRenderer.invoke(APPLICATION_CHAT_CHANNELS.complete, request),
    listApplicationChatModels: () => ipcRenderer.invoke(APPLICATION_CHAT_CHANNELS.listModels),
    abortApplicationChat: (request) => ipcRenderer.invoke(APPLICATION_CHAT_CHANNELS.abort, request),
    executeApplicationChatTool: (request) => ipcRenderer.invoke(APPLICATION_CHAT_CHANNELS.executeTool, request),
    resolveApplicationChatApproval: (request) => ipcRenderer.invoke(APPLICATION_CHAT_CHANNELS.resolveApproval, request),
    onApplicationChatStreamEvent: (callback) => onRendererEvent(APPLICATION_CHAT_CHANNELS.streamEvent, callback),
    buildApplicationKnowledgeBase: (request) => ipcRenderer.invoke(APPLICATION_KNOWLEDGE_BASE_RUNTIME_CHANNELS.build, request),
    getApplicationKnowledgeBaseStatus: (request) => ipcRenderer.invoke(APPLICATION_KNOWLEDGE_BASE_RUNTIME_CHANNELS.status, request),
    removeApplicationKnowledgeBase: (request) => ipcRenderer.invoke(APPLICATION_KNOWLEDGE_BASE_RUNTIME_CHANNELS.remove, request),
    queryApplicationKnowledgeBase: (request) => ipcRenderer.invoke(APPLICATION_KNOWLEDGE_BASE_RUNTIME_CHANNELS.query, request),
    /** 列出脱敏窗口；输入有界筛选，返回 typed Runtime 结果。 */
    listApplicationDesktopControlWindows: (request) => ipcRenderer.invoke(APPLICATION_DESKTOP_CONTROL_RUNTIME_CHANNELS.listWindows, request),
    /** 列出显示器；无输入，返回 typed Runtime 结果。 */
    listApplicationDesktopControlMonitors: () => ipcRenderer.invoke(APPLICATION_DESKTOP_CONTROL_RUNTIME_CHANNELS.listMonitors),
    /** 读取活动窗口；无输入，返回不含进程路径的状态。 */
    getApplicationDesktopControlActiveWindow: () => ipcRenderer.invoke(APPLICATION_DESKTOP_CONTROL_RUNTIME_CHANNELS.getActiveWindow),
    /** 读取动作历史；输入有界数量，返回当前 Worker 记录。 */
    listApplicationDesktopControlHistory: (request) => ipcRenderer.invoke(APPLICATION_DESKTOP_CONTROL_RUNTIME_CHANNELS.listHistory, request),
    /** 执行窗口动作；输入精确动作请求，返回脱敏结果。 */
    executeApplicationDesktopControlAction: (request) => ipcRenderer.invoke(APPLICATION_DESKTOP_CONTROL_RUNTIME_CHANNELS.executeAction, request),
    /** 探测 allow-list 本机工具；输入精确工具名，返回无路径结果。 */
    probeApplicationToolchain: (request) => ipcRenderer.invoke(APPLICATION_TOOLCHAIN_RUNTIME_CHANNELS.probe, request),
    /** 列出 Docker 容器；无输入，返回有界摘要。 */
    listApplicationDockerContainers: () => ipcRenderer.invoke(APPLICATION_TOOLCHAIN_RUNTIME_CHANNELS.listDockerContainers),
    /** 拉取 Docker 镜像；输入精确镜像引用，返回固定结果。 */
    pullApplicationDockerImage: (request) => ipcRenderer.invoke(APPLICATION_TOOLCHAIN_RUNTIME_CHANNELS.pullDockerImage, request),
    /** 执行 Docker 容器动作；输入精确容器和动作，返回固定结果。 */
    mutateApplicationDockerContainer: (request) => ipcRenderer.invoke(APPLICATION_TOOLCHAIN_RUNTIME_CHANNELS.mutateDockerContainer, request),
    /** 读取开发工作台概览；无输入，返回无密钥聚合状态，IPC 失败时拒绝 Promise。 */
    getApplicationDeveloperWorkbenchOverview: () => ipcRenderer.invoke(APPLICATION_DEVELOPER_WORKBENCH_CHANNELS.overview),
    /** 扫描已配置仓库；无输入，返回有界摘要，扫描或 IPC 失败时拒绝 Promise。 */
    listApplicationDeveloperWorkbenchRepositories: () => ipcRenderer.invoke(APPLICATION_DEVELOPER_WORKBENCH_CHANNELS.repositories),
    /** 搜索已授权代码；输入有界查询，返回相对路径命中，校验或扫描失败时拒绝 Promise。 */
    searchApplicationDeveloperWorkbenchCode: (request) => ipcRenderer.invoke(APPLICATION_DEVELOPER_WORKBENCH_CHANNELS.searchCode, request),
    /** 列出本地工作台快照；无输入，返回有界摘要，读取失败时拒绝 Promise。 */
    listApplicationDeveloperWorkbenchSnapshots: () => ipcRenderer.invoke(APPLICATION_DEVELOPER_WORKBENCH_CHANNELS.listSnapshots),
    /** 创建本地工作台快照；输入包含范围，返回快照摘要，校验或写盘失败时拒绝 Promise。 */
    createApplicationDeveloperWorkbenchSnapshot: (request) => ipcRenderer.invoke(APPLICATION_DEVELOPER_WORKBENCH_CHANNELS.createSnapshot, request),
    /** 导入无密钥工作台快照；输入 JSON 文档，返回快照摘要，敏感字段或写盘失败时拒绝 Promise。 */
    importApplicationDeveloperWorkbenchSnapshot: (request) => ipcRenderer.invoke(APPLICATION_DEVELOPER_WORKBENCH_CHANNELS.importSnapshot, request),
    /** 读取一个工作台快照；输入稳定 ID，返回 JSON 文档，缺失或损坏时拒绝 Promise。 */
    getApplicationDeveloperWorkbenchSnapshot: (request) => ipcRenderer.invoke(APPLICATION_DEVELOPER_WORKBENCH_CHANNELS.getSnapshot, request),
    /** 恢复一个工作台快照；输入稳定 ID，返回恢复结果，缺失或状态写入失败时拒绝 Promise。 */
    restoreApplicationDeveloperWorkbenchSnapshot: (request) => ipcRenderer.invoke(APPLICATION_DEVELOPER_WORKBENCH_CHANNELS.restoreSnapshot, request),
    /** 删除一个工作台快照；输入稳定 ID，返回删除结果，缺失或删除失败时拒绝 Promise。 */
    deleteApplicationDeveloperWorkbenchSnapshot: (request) => ipcRenderer.invoke(APPLICATION_DEVELOPER_WORKBENCH_CHANNELS.deleteSnapshot, request),
    /** 应用 Main 授权的工作区；输入精确配置，返回规范配置，目录未授权或写盘失败时拒绝 Promise。 */
    applyApplicationDeveloperWorkbenchWorkspace: (request) => ipcRenderer.invoke(APPLICATION_DEVELOPER_WORKBENCH_CHANNELS.applyWorkspace, request),
    /** 应用默认 Agent 映射；输入 Agent ID，返回模型映射，Agent 未知或写盘失败时拒绝 Promise。 */
    applyApplicationDeveloperWorkbenchMapping: (request) => ipcRenderer.invoke(APPLICATION_DEVELOPER_WORKBENCH_CHANNELS.applyMapping, request),
    /** 列出 VR 资产目录；无输入，返回内置、用户和云模型，不激活 Python。 */
    listApplicationVrAssets: () => ipcRenderer.invoke(APPLICATION_VR_ASSET_CHANNELS.list),
    /** 导入一个 VR 资产；输入类型、显示名和真实 File，返回用户资产，非法或超限时拒绝 Promise。 */
    importApplicationVrAsset: (request) => importRendererApplicationVrAsset(request),
    /** 删除一个用户 VR 资产；输入类型和稳定 ID，返回删除结果，内置或缺失资产时拒绝 Promise。 */
    deleteApplicationVrAsset: (request) => ipcRenderer.invoke(APPLICATION_VR_ASSET_CHANNELS.deleteAsset, request),
    /** 下载固定目录中的云 VRM；输入模型 ID，返回用户资产，未知 ID 或下载失败时拒绝 Promise。 */
    downloadApplicationCloudVrmModel: (request) => ipcRenderer.invoke(APPLICATION_VR_ASSET_CHANNELS.downloadCloudModel, request),
    /** 列出本机扩展；无输入，返回有界元数据，不激活 Python。 */
    listApplicationExtensions: () => ipcRenderer.invoke(APPLICATION_EXTENSION_RUNTIME_CHANNELS.list),
    /** 列出固定远程扩展；无输入，返回目录与安装状态。 */
    listRemoteApplicationExtensions: () => ipcRenderer.invoke(APPLICATION_EXTENSION_RUNTIME_CHANNELS.listRemote),
    /** 从固定仓库安装扩展；输入主/备用仓库，返回原子安装结果。 */
    installApplicationExtensionFromRepository: (request) => ipcRenderer.invoke(APPLICATION_EXTENSION_RUNTIME_CHANNELS.installRepository, request),
    /** 导入本机扩展 ZIP；输入真实 File，返回原子安装结果。 */
    importApplicationExtensionArchive: (request) => importRendererApplicationExtensionArchive(request),
    /** 更新一个扩展；输入稳定 ID，返回原子更新结果。 */
    updateApplicationExtension: (request) => ipcRenderer.invoke(APPLICATION_EXTENSION_RUNTIME_CHANNELS.update, request),
    /** 删除一个扩展；输入稳定 ID，先停止进程再删除目录。 */
    removeApplicationExtension: (request) => ipcRenderer.invoke(APPLICATION_EXTENSION_RUNTIME_CHANNELS.remove, request),
    /** 启动扩展；输入稳定 ID，返回独立回环 Origin URL。 */
    startApplicationExtension: (request) => ipcRenderer.invoke(APPLICATION_EXTENSION_RUNTIME_CHANNELS.start, request),
    /** 停止扩展；输入稳定 ID，返回幂等停止结果。 */
    stopApplicationExtension: (request) => ipcRenderer.invoke(APPLICATION_EXTENSION_RUNTIME_CHANNELS.stop, request),
    /** 列出全局技能；无输入，返回有界元数据并补齐内置技能。 */
    listApplicationSkills: () => ipcRenderer.invoke(APPLICATION_SKILL_RUNTIME_CHANNELS.list),
    /** 读取技能 Markdown；输入稳定 ID，返回有界 UTF-8 内容。 */
    getApplicationSkillContent: (request) => ipcRenderer.invoke(APPLICATION_SKILL_RUNTIME_CHANNELS.content, request),
    /** 从固定 GitHub 仓库安装技能；输入仓库或 tree 深链，返回安装结果。 */
    installApplicationSkillFromRepository: (request) => ipcRenderer.invoke(APPLICATION_SKILL_RUNTIME_CHANNELS.installRepository, request),
    /** 导入本机技能 ZIP；输入真实 File，返回安装结果。 */
    importApplicationSkillArchive: (request) => importRendererApplicationSkillArchive(request),
    /** 结晶标准技能；输入有界流程字段，返回写入结果。 */
    crystallizeApplicationSkill: (request) => ipcRenderer.invoke(APPLICATION_SKILL_RUNTIME_CHANNELS.crystallize, request),
    /** 上传企业 Skill 候选到 XnetMLOps；输入 Skill/Workspace ID，返回草稿回执。 */
    uploadApplicationSkillToMlops: (request) => ipcRenderer.invoke(APPLICATION_SKILL_RUNTIME_CHANNELS.uploadMlops, request),
    /** 删除全局技能；输入稳定 ID，返回删除结果。 */
    removeApplicationSkill: (request) => ipcRenderer.invoke(APPLICATION_SKILL_RUNTIME_CHANNELS.remove, request),
    /** 读取 Main-owned 当前工作区技能状态；无输入且 Renderer 不提交路径。 */
    getApplicationProjectSkillStatus: () => ipcRenderer.invoke(APPLICATION_SKILL_RUNTIME_CHANNELS.projectStatus),
    /** 同步当前工作区技能；输入稳定 ID 和固定动作。 */
    syncApplicationProjectSkill: (request) => ipcRenderer.invoke(APPLICATION_SKILL_RUNTIME_CHANNELS.syncProject, request),
    /** 让 Main 打开全局技能目录；无输入且不向 Renderer 返回路径。 */
    revealApplicationSkillsDirectory: () => ipcRenderer.invoke(APPLICATION_SKILL_RUNTIME_CHANNELS.revealDirectory),
    /** 列出企业角色卡；无输入，返回本机记录。 */
    listApplicationEnterpriseRoleCards: () => ipcRenderer.invoke(APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.listRoleCards),
    /** 保存企业角色卡；输入结构化草稿，返回写入记录。 */
    saveApplicationEnterpriseRoleCard: (request) => ipcRenderer.invoke(APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.saveRoleCard, request),
    /** 删除企业角色卡；输入稳定 ID，返回删除结果。 */
    removeApplicationEnterpriseRoleCard: (request) => ipcRenderer.invoke(APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.removeRoleCard, request),
    /** 列出企业团队模板；无输入，返回本机模板且不访问 AgentTeams 服务。 */
    listApplicationEnterpriseTeamTemplates: () => ipcRenderer.invoke(APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.listTeamTemplates),
    /** 保存企业团队模板；输入结构化成员引用，返回递增版本。 */
    saveApplicationEnterpriseTeamTemplate: (request) => ipcRenderer.invoke(APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.saveTeamTemplate, request),
    /** 删除企业团队模板；输入稳定 ID，返回删除结果。 */
    removeApplicationEnterpriseTeamTemplate: (request) => ipcRenderer.invoke(APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.removeTeamTemplate, request),
    /** 列出企业知识库；无输入，返回本机元数据。 */
    listApplicationEnterpriseKnowledgeBases: () => ipcRenderer.invoke(APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.listKnowledgeBases),
    /** 保存企业知识库；输入结构化草稿，返回写入记录。 */
    saveApplicationEnterpriseKnowledgeBase: (request) => ipcRenderer.invoke(APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.saveKnowledgeBase, request),
    /** 删除企业知识库；输入稳定 ID，返回删除结果。 */
    removeApplicationEnterpriseKnowledgeBase: (request) => ipcRenderer.invoke(APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.removeKnowledgeBase, request),
    /** 列出企业知识库版本；输入稳定 ID，返回脱敏摘要。 */
    listApplicationEnterpriseKnowledgeBaseVersions: (request) => ipcRenderer.invoke(APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.listKnowledgeBaseVersions, request),
    /** 列出企业环境元数据；无输入，返回结构化记录。 */
    listApplicationEnterpriseWorkspaces: () => ipcRenderer.invoke(APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.listWorkspaces),
    /** 保存企业环境元数据；输入结构化草稿，返回记录。 */
    saveApplicationEnterpriseWorkspace: (request) => ipcRenderer.invoke(APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.saveWorkspace, request),
    /** 删除企业环境元数据；输入稳定 ID，返回结果。 */
    removeApplicationEnterpriseWorkspace: (request) => ipcRenderer.invoke(APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.removeWorkspace, request),
    /** 列出企业项目楼层；无输入，返回 Main-owned 持久记录。 */
    listApplicationEnterpriseProjects: () => ipcRenderer.invoke(APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.listProjects),
    /** 保存企业项目楼层；输入结构化草稿，返回持久记录。 */
    saveApplicationEnterpriseProject: (request) => ipcRenderer.invoke(APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.saveProject, request),
    /** 删除企业项目楼层；输入稳定 ID，返回删除结果。 */
    removeApplicationEnterpriseProject: (request) => ipcRenderer.invoke(APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.removeProject, request),
    /** 查询企业协作消息；输入 Workspace、项目和数量，返回有界审计轨迹。 */
    listApplicationEnterpriseMessages: (request) => ipcRenderer.invoke(APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.listMessages, request),
    /** 发布企业领导消息；输入内容和 @员工 ID，作者身份由 Main 绑定。 */
    postApplicationEnterpriseMessage: (request) => ipcRenderer.invoke(APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.postMessage, request),
    /** 列出企业空间 Skill 启用绑定；无输入，返回不含技能正文的绑定列表。 */
    listApplicationEnterpriseSkillBindings: () => ipcRenderer.invoke(APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.listSkillBindings),
    /** 设置企业 Skill 启用状态；输入 Workspace、Skill 和可选来源事件。 */
    setApplicationEnterpriseSkillBinding: (request) => ipcRenderer.invoke(APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.setSkillBinding, request),
    /** 读取企业沙盘；无输入，返回角色卡投影和场景。 */
    getApplicationEnterpriseSandboxState: () => ipcRenderer.invoke(APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.getSandboxState),
    /** 列出 Xnet 服务；无输入，返回保存配置且不访问网络。 */
    listApplicationEnterpriseXnetServices: () => ipcRenderer.invoke(APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.listXnetServices),
    /** 保存 Xnet 服务；输入固定键和配置，返回记录。 */
    saveApplicationEnterpriseXnetService: (request) => ipcRenderer.invoke(APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.saveXnetService, request),
    /** 检查 Xnet 服务；输入固定键，返回状态且不接受 URL。 */
    checkApplicationEnterpriseXnetService: (request) => ipcRenderer.invoke(APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.checkXnetService, request),
    /** 批量检查 Xnet 服务；输入 autoOnly，返回完整状态。 */
    checkAllApplicationEnterpriseXnetServices: (request) => ipcRenderer.invoke(APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.checkAllXnetServices, request),
    /** 读取 AgentTeams Runtime 状态；无输入，返回脱敏 Controller 摘要。 */
    getApplicationAgentTeamsStatus: () => ipcRenderer.invoke(APPLICATION_AGENTTEAMS_RUNTIME_CHANNELS.status),
    /** 同步一个有界 AgentTeams Team；输入结构化 Team，不接受命令或凭据。 */
    applyApplicationAgentTeamsTeam: (request) => ipcRenderer.invoke(APPLICATION_AGENTTEAMS_RUNTIME_CHANNELS.applyTeam, request),
    /** 查询一个 AgentTeams Team；输入固定资源名，返回有界状态。 */
    getApplicationAgentTeamsTeam: (request) => ipcRenderer.invoke(APPLICATION_AGENTTEAMS_RUNTIME_CHANNELS.getTeam, request),
    /** 读取竞赛控制面快照；无输入，不访问三平台。 */
    getApplicationCompetitionSnapshot: () => ipcRenderer.invoke(APPLICATION_COMPETITION_RUNTIME_CHANNELS.getSnapshot),
    /** 读取事件中心发布配置；无输入，返回生产或比赛 staging 的公开界面能力。 */
    getApplicationCompetitionUiProfile: () => ipcRenderer.invoke(APPLICATION_COMPETITION_RUNTIME_CHANNELS.getUiProfile),
    /** 重置竞赛演示数据；输入固定确认标记，仅清除竞赛控制面状态。 */
    resetApplicationCompetitionDemoData: (request) => ipcRenderer.invoke(APPLICATION_COMPETITION_RUNTIME_CHANNELS.resetDemoData, request),
    /** 从企业项目群发起主 Demo；输入固定场景和团队选择，返回待审批状态。 */
    startApplicationCompetitionEnterpriseTask: (request) => ipcRenderer.invoke(APPLICATION_COMPETITION_RUNTIME_CHANNELS.startEnterpriseTask, request),
    /** 创建竞赛事件；输入固定场景，操作者由 Main 企业会话注入。 */
    createApplicationCompetitionIncident: (request) => ipcRenderer.invoke(APPLICATION_COMPETITION_RUNTIME_CHANNELS.createIncident, request),
    /** 启动跨域取证；输入事件和 Runtime 选择，返回待审批状态。 */
    runApplicationCompetitionInvestigation: (request) => ipcRenderer.invoke(APPLICATION_COMPETITION_RUNTIME_CHANNELS.runInvestigation, request),
    /** 提交人工审批；输入审批 ID、决策和原因，审批人由 Main 注入。 */
    decideApplicationCompetitionApproval: (request) => ipcRenderer.invoke(APPLICATION_COMPETITION_RUNTIME_CHANNELS.decideApproval, request),
    /** 执行审批后的回滚；输入审批、幂等键和 dry-run，执行人由 Main 注入。 */
    executeApplicationCompetitionRollback: (request) => ipcRenderer.invoke(APPLICATION_COMPETITION_RUNTIME_CHANNELS.executeRollback, request),
    /** 独立验证回滚；输入动作，验证人由 Main 注入。 */
    verifyApplicationCompetitionRemediation: (request) => ipcRenderer.invoke(APPLICATION_COMPETITION_RUNTIME_CHANNELS.verifyRemediation, request),
    /** 读取竞赛 Resource；输入 openxnet URI，返回有界文本。 */
    readApplicationCompetitionResource: (request) => ipcRenderer.invoke(APPLICATION_COMPETITION_RUNTIME_CHANNELS.readResource, request),
    /** 导出复盘 Skill；输入已解决事件 ID，返回本机输出路径。 */
    exportApplicationCompetitionRetrospective: (request) => ipcRenderer.invoke(APPLICATION_COMPETITION_RUNTIME_CHANNELS.exportRetrospective, request),
    /** 导出复赛评测与 OTLP 风格遥测；输入终态事件 ID，返回两个 UTF-8 JSON 路径。 */
    exportApplicationCompetitionEvaluation: (request) => ipcRenderer.invoke(APPLICATION_COMPETITION_RUNTIME_CHANNELS.exportEvaluation, request),
    /** 切换 Fixture/Live Adapter；输入固定模式，返回最新快照。 */
    setApplicationCompetitionAdapterMode: (request) => ipcRenderer.invoke(APPLICATION_COMPETITION_RUNTIME_CHANNELS.setAdapterMode, request),
    /** 读取企业用量面板；输入分组和数量，返回 Main SQLite 聚合且不启动 Python。 */
    loadApplicationEnterpriseUsageDashboard: (request) => ipcRenderer.invoke(APPLICATION_ENTERPRISE_INSIGHTS_RUNTIME_CHANNELS.loadUsageDashboard, request),
    /** 读取认知符号面板；输入数量，返回脱敏符号、统计和规则。 */
    loadApplicationEnterpriseNeuroDashboard: (request) => ipcRenderer.invoke(APPLICATION_ENTERPRISE_INSIGHTS_RUNTIME_CHANNELS.loadNeuroDashboard, request),
    /** 搜索认知符号；输入文本、算子和数量，返回纯读取结果。 */
    searchApplicationEnterpriseNeuroSymbols: (request) => ipcRenderer.invoke(APPLICATION_ENTERPRISE_INSIGHTS_RUNTIME_CHANNELS.searchNeuroSymbols, request),
    /** 删除普通认知符号；输入稳定 ID，返回删除结果。 */
    removeApplicationEnterpriseNeuroSymbol: (request) => ipcRenderer.invoke(APPLICATION_ENTERPRISE_INSIGHTS_RUNTIME_CHANNELS.removeNeuroSymbol, request),
    /** 执行认知符号维护；无输入，返回衰减和清理计数。 */
    runApplicationEnterpriseNeuroMaintenance: () => ipcRenderer.invoke(APPLICATION_ENTERPRISE_INSIGHTS_RUNTIME_CHANNELS.runNeuroMaintenance),
    /** 读取知识图谱面板；输入边数量，返回脱敏节点、边和统计。 */
    loadApplicationEnterpriseKnowledgeGraph: (request) => ipcRenderer.invoke(APPLICATION_ENTERPRISE_INSIGHTS_RUNTIME_CHANNELS.loadKnowledgeGraph, request),
    /** 查询知识图谱实体；输入实体和数量，返回脱敏时序事实。 */
    queryApplicationEnterpriseKnowledgeGraphEntity: (request) => ipcRenderer.invoke(APPLICATION_ENTERPRISE_INSIGHTS_RUNTIME_CHANNELS.queryKnowledgeGraphEntity, request),
    /** 执行固定 Kernel 操作；输入 operation 和结构化载荷，返回脱敏结果，不接受 URL、方法或路径。 */
    invokeApplicationKernel: (request) => ipcRenderer.invoke(APPLICATION_KERNEL_RUNTIME_CHANNELS.invoke, request),
    /** 读取本地模型状态；输入固定 kind，返回无路径摘要且不启动 Worker。 */
    getApplicationModelAssetStatus: (request) => ipcRenderer.invoke(APPLICATION_MODEL_ASSET_CHANNELS.getStatus, request),
    /** 下载固定版本模型；输入 kind/source，返回安装状态且不接受 URL 或路径。 */
    downloadApplicationModelAsset: (request) => ipcRenderer.invoke(APPLICATION_MODEL_ASSET_CHANNELS.download, request),
    /** 删除本地模型；输入固定 kind，返回未安装状态且由 Main 停止对应 Worker。 */
    removeApplicationModelAsset: (request) => ipcRenderer.invoke(APPLICATION_MODEL_ASSET_CHANNELS.remove, request),
    /** 订阅模型下载进度；输入回调，返回精确取消函数。 */
    onApplicationModelAssetProgress: (callback) => onRendererEvent(APPLICATION_MODEL_ASSET_CHANNELS.progress, callback),
    /** 读取 Recall 首屏；无输入，返回聚合结果。 */
    getApplicationRecallBootstrap: () => ipcRenderer.invoke(APPLICATION_RECALL_RUNTIME_CHANNELS.bootstrap),
    /** 搜索 Recall；输入有界查询，返回脱敏结果。 */
    searchApplicationRecall: (request) => ipcRenderer.invoke(APPLICATION_RECALL_RUNTIME_CHANNELS.search, request),
    /** 读取 Recall 时间线；输入查询或锚点，返回有界记录。 */
    getApplicationRecallTimeline: (request) => ipcRenderer.invoke(APPLICATION_RECALL_RUNTIME_CHANNELS.timeline, request),
    /** 读取 Recall 观察流；输入目标字段，返回有界记录。 */
    getApplicationRecallObservations: (request) => ipcRenderer.invoke(APPLICATION_RECALL_RUNTIME_CHANNELS.observations, request),
    /** 恢复中断 turn；输入精确 ID，返回恢复提示。 */
    resumeApplicationRecall: (request) => ipcRenderer.invoke(APPLICATION_RECALL_RUNTIME_CHANNELS.resume, request),
    /** 恢复工作区检查点；输入精确 ID，返回固定结果。 */
    rollbackApplicationRecall: (request) => ipcRenderer.invoke(APPLICATION_RECALL_RUNTIME_CHANNELS.rollback, request),
    /** 发布 Recall 观察焦点；输入有界展示数据，返回投递数量。 */
    publishApplicationRecallObservationFocus: (request) => ipcRenderer.invoke(APPLICATION_RECALL_RUNTIME_CHANNELS.publishObservationFocus, request),
    getApplicationProviders: () => ipcRenderer.invoke(APPLICATION_PROVIDER_CHANNELS.getSnapshot),
    saveApplicationProviders: (request) => ipcRenderer.invoke(APPLICATION_PROVIDER_CHANNELS.saveProviders, request),
    validateApplicationProvider: (request) => ipcRenderer.invoke(APPLICATION_PROVIDER_CHANNELS.validateProvider, request),
    /** 使用 Main 私有 Provider 凭据探测向量维度；输入已保存 Provider ID，返回无密钥结果。 */
    probeApplicationProviderEmbedding: (request) => ipcRenderer.invoke(APPLICATION_PROVIDER_CHANNELS.probeEmbedding, request),
    /** 在 Main 创建 Agent 快照；输入名称和提示词，返回不含路径的公开元数据。 */
    createApplicationAgent: (request) => ipcRenderer.invoke(APPLICATION_AGENT_RUNTIME_CHANNELS.createAgent, request),
    /** 在 Main 删除 Agent 快照；输入稳定 ID，返回删除结果。 */
    removeApplicationAgent: (request) => ipcRenderer.invoke(APPLICATION_AGENT_RUNTIME_CHANNELS.removeAgent, request),
    /** 通过 Main 探测 A2A Agent Card；输入受限 URL，返回有界公开卡片。 */
    inspectApplicationA2a: (request) => ipcRenderer.invoke(APPLICATION_AGENT_RUNTIME_CHANNELS.inspectA2a, request),
    /** 列出一个记忆集合；输入稳定 ID，返回无路径记录。 */
    listApplicationMemoryRecords: (request) => ipcRenderer.invoke(APPLICATION_MEMORY_MANAGEMENT_CHANNELS.listRecords, request),
    /** 更新一个稳定记忆记录；输入 ID 和文本，返回固定变更结果。 */
    updateApplicationMemoryRecord: (request) => ipcRenderer.invoke(APPLICATION_MEMORY_MANAGEMENT_CHANNELS.updateRecord, request),
    /** 删除一个稳定记忆记录；输入集合和记录 ID，返回固定变更结果。 */
    deleteApplicationMemoryRecord: (request) => ipcRenderer.invoke(APPLICATION_MEMORY_MANAGEMENT_CHANNELS.deleteRecord, request),
    /** 删除一个记忆集合；输入稳定集合 ID，返回固定变更结果。 */
    removeApplicationMemoryCollection: (request) => ipcRenderer.invoke(APPLICATION_MEMORY_MANAGEMENT_CHANNELS.removeCollection, request),
    /** 恢复本机可信历史或发行版内置的完整性锁定记忆；输入目标 Agent，返回恢复回执。 */
    recoverSynapxnetMemories: (request) => ipcRenderer.invoke(APPLICATION_SYNAPXNET_MEMORY_CHANNELS.recover, request),
    /** 读取 Memory V3 分层和审计状态；无输入，返回不含正文的统计。 */
    getSynapxnetMemoryStatus: () => ipcRenderer.invoke(APPLICATION_SYNAPXNET_MEMORY_CHANNELS.status),
    listSynapxnetMemories: (request) => ipcRenderer.invoke(APPLICATION_SYNAPXNET_MEMORY_CHANNELS.list, request),
    getSynapxnetMemoryHistory: (request) => ipcRenderer.invoke(APPLICATION_SYNAPXNET_MEMORY_CHANNELS.history, request),
    createSynapxnetMemory: (request) => ipcRenderer.invoke(APPLICATION_SYNAPXNET_MEMORY_CHANNELS.create, request),
    editSynapxnetMemory: (request) => ipcRenderer.invoke(APPLICATION_SYNAPXNET_MEMORY_CHANNELS.edit, request),
    rollbackSynapxnetMemory: (request) => ipcRenderer.invoke(APPLICATION_SYNAPXNET_MEMORY_CHANNELS.rollback, request),
    retireSynapxnetMemory: (request) => ipcRenderer.invoke(APPLICATION_SYNAPXNET_MEMORY_CHANNELS.retire, request),
    exportSynapxnetMemories: (request) => ipcRenderer.invoke(APPLICATION_SYNAPXNET_MEMORY_CHANNELS.export, request),
    importSynapxnetMemories: (request) => ipcRenderer.invoke(APPLICATION_SYNAPXNET_MEMORY_CHANNELS.import, request),
    verifySynapxnetMemory: (request) => ipcRenderer.invoke(APPLICATION_SYNAPXNET_MEMORY_CHANNELS.verify, request),
    getLegacyRendererState: () => ipcRenderer.invoke(LEGACY_RENDERER_STATE_CHANNELS.getSnapshot),
    saveLegacyRendererSettings: (request) => ipcRenderer.invoke(LEGACY_RENDERER_STATE_CHANNELS.saveSettings, request),
    saveLegacyRendererConversations: (request) => ipcRenderer.invoke(LEGACY_RENDERER_STATE_CHANNELS.saveConversations, request),
    saveLegacyRendererVrmConfig: (request) => ipcRenderer.invoke(LEGACY_RENDERER_STATE_CHANNELS.saveVrmConfig, request),
    onLegacyRendererStateChanged: (callback) => onRendererEvent(LEGACY_RENDERER_STATE_CHANNELS.changed, callback),
    getState: () => ipcRenderer.invoke(DESKTOP_CORE_CHANNELS.getState),
    listCapabilities: () => ipcRenderer.invoke(DESKTOP_CORE_CHANNELS.listCapabilities),
    ensureCapability: (request) => ipcRenderer.invoke(DESKTOP_CORE_CHANNELS.ensureCapability, request),
    listFeaturePacks: (request = {}) => ipcRenderer.invoke(DESKTOP_CORE_CHANNELS.listFeaturePacks, request),
    installFeaturePack: (request) => ipcRenderer.invoke(DESKTOP_CORE_CHANNELS.installFeaturePack, request),
    repairFeaturePack: (request) => ipcRenderer.invoke(DESKTOP_CORE_CHANNELS.repairFeaturePack, request),
    uninstallFeaturePack: (request) => ipcRenderer.invoke(DESKTOP_CORE_CHANNELS.uninstallFeaturePack, request),
    onFeaturePackProgress: (callback) => onRendererEvent(DESKTOP_CORE_CHANNELS.featurePackProgress, callback),
    onStateChanged: (callback) => onRendererEvent(DESKTOP_CORE_CHANNELS.stateChanged, callback),
  });
}

exposeDesktopCore();


// 缓存最后一次 VMC 配置（默认关闭）
let vmcCfg = { receive:{enable:false,port:39539,syncExpression: false}, send:{enable:false,host:'127.0.0.1',port:39540} };

// 主进程推送最新配置
onRendererEvent('vmc-config-changed', (cfg) => { vmcCfg = cfg; });

// 与 main.js 保持一致的服务器配置
const HOST = '127.0.0.1'
const PORT = 3456
// 获取从主进程传递的配置数据
const windowConfig = {
    windowName: "default",
};
// 暴露基本的ipcRenderer给骨架屏页面使用
contextBridge.exposeInMainWorld('electron', {
  isMac: process.platform === 'darwin',
  isWindows: process.platform === 'win32',
  ipcRenderer: {
    on: (channel, func) => {
      // 只允许特定的通道
      const validChannels = ['backend-ready', 'trigger-search']; 
      if (validChannels.includes(channel)) {
        return onRendererEvent(channel, func);
      }
      throw new TypeError('Renderer event channel is not allowed.');
    }
  },
  // 暴露服务器配置
  server: {
    host: HOST,
    port: PORT
  },
  requestStopQQBot: () => ipcRenderer.invoke('request-stop-qqbot'),
  requestStopFeishuBot : () => ipcRenderer.invoke('request-stop-feishubot'),
  requestStopDingtalkBot : () => ipcRenderer.invoke('request-stop-dingtalk'),
  requestStopDiscordBot : () => ipcRenderer.invoke('request-stop-discordbot'),
  requestStopTelegramBot : () => ipcRenderer.invoke('request-stop-telegrambot'),
  requestStopSlackBot : () => ipcRenderer.invoke('request-stop-slackbot'), 
  openMainApp: () => ipcRenderer.invoke('open-main-app'),
});

// 暴露安全接口
contextBridge.exposeInMainWorld('electronAPI', {
  onNewTab: (callback) => onRendererEvent('create-tab', callback),
  saveScreenshotDirect: (buffer) => ipcRenderer.invoke('save-screenshot-direct', { buffer }),
  // 系统功能
  openExternal: (url) => ipcRenderer.invoke('open-external-url', url),
  openPath: (filePath) => ipcRenderer.invoke('open-authorized-path', filePath),
  openAppDirectory: () => ipcRenderer.invoke('open-app-directory'),
  openUploadedFile: (filename) => ipcRenderer.invoke('open-uploaded-file', filename),
  getWebviewPreloadUrl: () => ipcRenderer.invoke('get-webview-preload-url'),
  // 窗口控制
  windowAction: (action) => ipcRenderer.invoke('window-action', action),
  getWindowState: () => ipcRenderer.invoke('get-window-state'),
  onWindowState: (callback) => onRendererEvent('window-state', callback),
  onOpenHomeCommandPanel: (callback) => onRendererEvent('open-home-command-panel', callback),

  // 文件对话框
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  openImageDialog: () => ipcRenderer.invoke('open-image-dialog'),
  readFile: (filePath) => ipcRenderer.invoke('read-authorized-file', filePath),
  sendLanguage: (lang) => ipcRenderer.send('set-language', lang),
  // 环境检测
  isElectron: true,

  // 自动更新
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
  onCheckingForUpdate: (callback) => onRendererEvent('checking-for-update', callback),
  onUpdateAvailable: (callback) => onRendererEvent('update-available', callback),
  onUpdateNotAvailable: (callback) => onRendererEvent('update-not-available', callback),
  onUpdateError: (callback) => onRendererEvent('update-error', callback),
  onDownloadProgress: (callback) => onRendererEvent('download-progress', callback),
  onUpdateDownloaded: (callback) => onRendererEvent('update-downloaded', callback),
  showContextMenu: (menuType, data) => ipcRenderer.invoke('show-context-menu', { menuType, data }),
  //保存环境变量
  setNetworkVisibility: (visible) => ipcRenderer.invoke('set-env', { key: 'networkVisible', value: visible }), 
  setLaunchAtStartup: (payload) => ipcRenderer.invoke('set-launch-at-startup', payload),
  getLaunchAtStartup: () => ipcRenderer.invoke('get-launch-at-startup'),
  /** Retrieve the authoritative bounded system settings snapshot. */
  getSystemSettings: () => ipcRenderer.invoke(APPLICATION_SETTINGS_CHANNELS.getSystemSettings),
  /** Persist a complete bounded system settings replacement. */
  saveSystemSettings: (settings) => ipcRenderer.invoke(
    APPLICATION_SETTINGS_CHANNELS.saveSystemSettings,
    { settings },
  ),
  
  saveChromeSettings: (settings) => ipcRenderer.invoke('save-chrome-config', settings),
  getInternalCDPInfo: () => ipcRenderer.invoke('get-internal-cdp-info'),
  //重启app
  restartApp: () => ipcRenderer.invoke('restart-app'),
  startVRMWindow: (windowConfig) => ipcRenderer.invoke('start-vrm-window', windowConfig),
  stopVRMWindow: () => ipcRenderer.invoke('stop-vrm-window'),
  getServerInfo: () => ipcRenderer.invoke('get-server-info'),
  getGlobalShortcutStatus: () => ipcRenderer.invoke('get-global-shortcut-status'),
  setIgnoreMouseEvents: (ignore, options) => ipcRenderer.invoke('set-ignore-mouse-events', ignore, options),
  getIgnoreMouseStatus: () => ipcRenderer.invoke('get-ignore-mouse-status'),
  setDynamicIslandSurfaceState: (payload) => ipcRenderer.invoke('set-dynamic-island-surface-state', payload),
  getDynamicIslandSurfaceState: () => ipcRenderer.invoke('get-dynamic-island-surface-state'),
  downloadFile: (payload) => ipcRenderer.invoke('download-file', payload),
  // 修改：添加回调参数
  getWindowConfig: (callback) => {
      if (windowConfig.windowName !== "default") {
          // 如果配置已更新，直接返回
          callback(windowConfig);
      } else {
          // 如果配置未更新，监听更新事件
          const handler = (event) => {
              callback(event.detail);
              window.removeEventListener('window-config-updated', handler);
          };
          window.addEventListener('window-config-updated', handler);
      }
  },

  setVMCConfig: (cfg) => ipcRenderer.invoke('set-vmc-config', cfg),
  getVMCConfig: () => ipcRenderer.invoke('get-vmc-config'),
  onVMCConfigChanged: (cb) => onRendererEvent('vmc-config-changed', cb),
  captureDesktop: () => ipcRenderer.invoke('capture-desktop'), // 👈 桌面截图
  toggleWindowSize: (width, height) => ipcRenderer.invoke('toggle-window-size', { width, height }),
  setAlwaysOnTop: (flag) => ipcRenderer.invoke('set-always-on-top', flag),
  showScreenshotOverlay: (hideWindow) => ipcRenderer.invoke('show-screenshot-overlay', { hideWindow }),
  cropDesktop:        (opts) => ipcRenderer.invoke('crop-desktop', opts),
  cancelScreenshotOverlay: () => ipcRenderer.invoke('cancel-screenshot-overlay'),
  openDirectoryDialog: () => ipcRenderer.invoke('dialog:openDirectory'),
  getPlatform: () => process.platform,
  getCurrentLanguage: () => ipcRenderer.invoke('get-current-language'),
  notifyWorkspaceReady: () => ipcRenderer.send('workspace-renderer-ready'),
  openDynamicIslandWindow: () => ipcRenderer.invoke('open-dynamic-island-window'),
  closeDynamicIslandWindow: () => ipcRenderer.invoke('close-dynamic-island-window'),
  toggleDynamicIslandWindow: () => ipcRenderer.invoke('toggle-dynamic-island-window'),
  getDynamicIslandWindowState: () => ipcRenderer.invoke('get-dynamic-island-window-state'),
  openFloatingTaskHudWindow: () => ipcRenderer.invoke('open-floating-task-hud-window'),
  closeFloatingTaskHudWindow: () => ipcRenderer.invoke('close-floating-task-hud-window'),
  openExtensionWindow: (url, extension) => ipcRenderer.invoke('open-extension-window', { url, extension }),
  getBackendLogs: () => ipcRenderer.invoke('get-backend-logs'),

  onRemoteInstall: (callback) => onRendererEvent('remote-install-any', callback),
  checkPendingInstall: () => ipcRenderer.invoke('check-pending-install'),

});

contextBridge.exposeInMainWorld('vmcAPI', {
  onVMCBone: (callback) => onRendererEvent('vmc-bone', callback),

  onVMCOscRaw: (cb) => onRendererEvent('vmc-osc-raw', cb),

  sendVMCBone: (data) => {
    if (!vmcCfg.send.enable) return;
    return ipcRenderer.invoke('send-vmc-bone', data);
  },
  sendVMCBlend: (data) => {
    if (!vmcCfg.send.enable) return;
    return ipcRenderer.invoke('send-vmc-blend', data);
  },
  sendVMCBlendApply: () => {
    if (!vmcCfg.send.enable) return;
    return ipcRenderer.invoke('send-vmc-blend-apply');
  },
  sendVMCFrame: (data) => ipcRenderer.invoke('send-vmc-frame', data),
});

contextBridge.exposeInMainWorld('downloadAPI', {
    // 监听下载事件
    onDownloadStarted: (cb) => onRendererEvent('download-started', cb),
    onDownloadUpdated: (cb) => onRendererEvent('download-updated', cb),
    onDownloadDone: (cb) => onRendererEvent('download-done', cb),
    
    // 发送控制指令
    controlDownload: (id, action) => ipcRenderer.invoke('download-control', { id, action }),
    showItemInFolder: (path) => ipcRenderer.invoke('show-item-in-folder', path)
});

// 在文件末尾添加以下代码来接收主进程传递的配置
onRendererEvent('set-window-config', (config) => {
    Object.assign(windowConfig, config);
    console.log('收到窗口配置:', windowConfig);
    
    // 添加：配置更新后发送事件通知页面
    window.dispatchEvent(new CustomEvent('window-config-updated', {
        detail: windowConfig
    }));
});
