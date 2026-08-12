const { app, BrowserWindow, ipcMain, screen, shell, dialog, Tray, Menu, session, globalShortcut, safeStorage, net: electronNet } = require('electron')
const { clipboard, nativeImage,desktopCapturer  } = require('electron')
const { autoUpdater } = require('electron-updater')
const { createHash, createHmac, randomBytes } = require('crypto')
const path = require('path')
const { pathToFileURL } = require('url')
const { spawn } = require('child_process')
const { download } = require('electron-dl');
const fs = require('fs')
const os = require('os')
const net = require('net') // 添加 net 模块用于端口检测
const dgram = require('dgram');
const osc = require('osc');
const {
  bootstrapApplicationSettings,
  bootstrapApplicationAuth,
  resolveApplicationAuthProfileSubject,
  ApplicationAccessGateway,
  bootstrapApplicationProviders,
  bootstrapApplicationSearchCredentials,
  bootstrapApplicationVoiceCredentials,
  bootstrapApplicationMcpCredentials,
  bootstrapApplicationHttpToolCredentials,
  bootstrapApplicationConnectorCredentials,
  bootstrapApplicationTelegramCredentials,
  bootstrapApplicationImageHostCredentials,
  bootstrapApplicationRepositoryCredentials,
  bootstrapApplicationLivePlatformCredentials,
  bootstrapApplicationCodeSandboxCredentials,
  bootstrapApplicationHomeAssistantCredentials,
  bootstrapApplicationSqlCredentials,
  bootstrapApplicationComfyUiCredentials,
  bootstrapApplicationDeliveryCredentials,
  bootstrapApplicationArtifacts,
  bootstrapApplicationTasks,
  ApplicationTaskExecutionService,
  ApplicationChatService,
  ApplicationKnowledgeBaseRuntimeService,
  ApplicationDesktopControlRuntimeService,
  ApplicationToolchainRuntimeService,
  ApplicationDeveloperWorkbenchRuntimeService,
  ApplicationVrAssetRuntimeService,
  ApplicationExtensionRuntimeService,
  ApplicationSkillRuntimeService,
  ApplicationEnterpriseRuntimeService,
  ApplicationEnterpriseInsightsRuntimeService,
  ApplicationAgentTeamsRuntimeService,
  ApplicationCompetitionRuntimeService,
  FixtureCompetitionToolAdapter,
  HttpCompetitionToolAdapter,
  HttpCompetitionAgentTeamsAdapter,
  HttpCompetitionApprovalPublisher,
  CompetitionMcpGateway,
  evaluateApplicationNeuroSymbolicPolicy,
  ApplicationKernelRuntimeService,
  ApplicationModelAssetRuntimeService,
  ApplicationAgentRuntimeService,
  ApplicationMemoryManagementRuntimeService,
  getApplicationCloudVrmModelPaths,
  ApplicationRecallRuntimeService,
  ApplicationConnectorRuntimeService,
  ApplicationLiveRuntimeService,
  ApplicationMcpRuntimeService,
  ApplicationVoiceRuntimeService,
  ApplicationVrmPresentationRuntimeService,
  ApplicationSystemRuntimeService,
  LegacyRendererStateService,
  createDesktopCore,
  LegacyBackendLifecycleCoordinator,
  FeaturePackDistributionService,
  FeaturePackManager,
  LocalUiGateway,
  assertSafeDownloadFilename,
  assertSafeDownloadUrl,
  assertSafeExternalUrl,
  createSecureWebPreferences,
  isAllowedApplicationNavigation,
  isAuthorizedRendererPath,
  registerApplicationSettingsIpc,
  registerApplicationAuthIpc,
  registerApplicationAccessIpc,
  registerApplicationArtifactsIpc,
  registerApplicationTasksIpc,
  registerApplicationTaskExecutionIpc,
  registerApplicationChatIpc,
  registerApplicationKnowledgeBaseRuntimeIpc,
  registerApplicationDesktopControlRuntimeIpc,
  registerApplicationToolchainRuntimeIpc,
  registerApplicationDeveloperWorkbenchRuntimeIpc,
  registerApplicationVrAssetIpc,
  registerApplicationExtensionRuntimeIpc,
  registerApplicationSkillRuntimeIpc,
  registerApplicationEnterpriseRuntimeIpc,
  registerApplicationEnterpriseInsightsRuntimeIpc,
  registerApplicationAgentTeamsRuntimeIpc,
  registerApplicationCompetitionRuntimeIpc,
  registerApplicationKernelRuntimeIpc,
  registerApplicationModelAssetIpc,
  registerApplicationAgentRuntimeIpc,
  registerApplicationMemoryManagementIpc,
  registerApplicationRecallRuntimeIpc,
  APPLICATION_RECALL_RUNTIME_CHANNELS,
  registerApplicationProvidersIpc,
  registerApplicationSearchCredentialsIpc,
  registerApplicationVoiceCredentialsIpc,
  registerApplicationVoiceRuntimeIpc,
  registerApplicationVrmPresentationIpc,
  registerApplicationSystemRuntimeIpc,
  registerApplicationMcpCredentialsIpc,
  registerApplicationMcpRuntimeIpc,
  registerApplicationHttpToolCredentialsIpc,
  registerApplicationConnectorCredentialsIpc,
  registerApplicationConnectorRuntimeIpc,
  registerApplicationLiveRuntimeIpc,
  registerApplicationTelegramCredentialsIpc,
  registerApplicationImageHostCredentialsIpc,
  registerApplicationRepositoryCredentialsIpc,
  registerApplicationLivePlatformCredentialsIpc,
  registerApplicationCodeSandboxCredentialsIpc,
  registerApplicationHomeAssistantCredentialsIpc,
  registerApplicationSqlCredentialsIpc,
  registerApplicationComfyUiCredentialsIpc,
  registerApplicationDeliveryCredentialsIpc,
  registerLegacyRendererStateIpc,
  registerDesktopCoreIpc,
  registerDesktopBootstrapIpc,
  registerExecutionEngineCapability,
  registerFeaturePackWorker,
  registerGitNexusFeaturePack,
  registerWorkerCapability,
  sanitizeExtensionWindowRequest,
  sanitizeRendererDownloadRequest,
  ConnectorChatBrokerGateway,
  ConnectorVoiceBrokerGateway,
  McpToolBrokerGateway,
  TaskExecutionBrokerGateway,
  ExecutionEngineSupervisor,
  WorkerRpcGateway,
  WorkerSupervisor,
} = require('./build-ts/desktop')
const OPENXNET_APP_NAME = 'OpenXnet'
const OPENXNET_APP_ID = 'com.openxnet.desktop'
const DESKTOP_PROCESS_STARTED_AT = Date.now()
const OPENXNET_WINDOW_ICON = path.join(
  __dirname,
  process.platform === 'win32' ? 'static/source/icon.ico' : 'static/source/icon.png'
)
const OPENXNET_TRAY_ICON = path.join(__dirname, 'static/source/icon_tray.png')

/**
 * Resolve the desktop data directory, allowing isolated CI and portable launches.
 *
 * @param {string} appDataDirectory Operating-system application data directory.
 * @returns {string} Absolute OpenXnet user data directory.
 */
function resolveDesktopUserDataDirectory(appDataDirectory) {
  const configuredDirectory = String(process.env.OPENXNET_USER_DATA_DIR || '').trim()
  return configuredDirectory
    ? path.resolve(configuredDirectory)
    : path.join(appDataDirectory, OPENXNET_APP_NAME)
}

try {
  if (typeof app.setName === 'function') {
    app.setName(OPENXNET_APP_NAME)
  }
  if (typeof app.setAppUserModelId === 'function') {
    app.setAppUserModelId(OPENXNET_APP_ID)
  }
  const appDataDir = app.getPath('appData')
  const expectedUserDataDir = resolveDesktopUserDataDirectory(appDataDir)
  if (app.getPath('userData') !== expectedUserDataDir) {
    app.setPath('userData', expectedUserDataDir)
  }
} catch (error) {
  console.warn('Failed to normalize OpenXnet app identity:', error)
}
// ★ VMC：UDP 收发资源
let vmcUdpPort = null;          // osc.UDPPort 实例
let vmcReceiverActive = false;  // 接收是否运行
let vrmWindows = []; 
let shotOverlay = null
let dynamicIslandWindow = null
let floatingTaskHudWindow = null
const DYNAMIC_ISLAND_SURFACE_LIMITS = {
  minWidth: 180,
  maxWidth: 500,
  minHeight: 54,
  maxHeight: 448,
}
const DYNAMIC_ISLAND_SURFACE_DEFAULT = {
  width: 188,
  height: 58,
  compact: true,
  interactive: false,
}
let dynamicIslandSurfaceState = { ...DYNAMIC_ISLAND_SURFACE_DEFAULT }
const FLOATING_TASK_HUD_WINDOW_DEFAULT = {
  width: 400,
  height: 640,
  minWidth: 320,
  minHeight: 420,
  margin: 18,
  topOffset: 56,
}
let isMac = process.platform === 'darwin';
const vmcSendSocket = dgram.createSocket('udp4'); // 发送复用同一 socket
const MAX_LOG_LINES = 2000; // 保留最近2000行日志
let logBuffer = []; // 内存日志缓冲区
let activeDownloads = new Map(); 
const brokenPipeStreams = new WeakSet();

const desktopCore = createDesktopCore()
const applicationSettings = bootstrapApplicationSettings({
  userDataDirectory: app.getPath('userData'),
  logger: console,
})
const applicationAuth = bootstrapApplicationAuth({
  userDataDirectory: app.getPath('userData'),
  safeStorage,
})

/** Return whether one provider belongs to the subscription access trust zone. */
function isManagedAccessProvider(provider) {
  const providerId = String(provider?.id || '').trim()
  return providerId === 'openxnet-access-managed-provider'
    || providerId === 'openxnet-access'
    || String(provider?.managedBy || '').trim() === 'openxnet-access'
}

/** Resolve a gateway key only when its authenticated URL matches provider metadata. */
function resolveManagedAccessProviderCredential(provider) {
  if (!isManagedAccessProvider(provider)) return ''
  const bootstrap = applicationAuth.getGatewayCredentialBootstrap()
  const providerUrl = String(provider?.url || '').trim().replace(/\/+$/, '')
  const gatewayUrl = String(bootstrap?.base_url || '').trim().replace(/\/+$/, '')
  return providerUrl && providerUrl === gatewayUrl ? String(bootstrap?.api_key || '').trim() : ''
}

const applicationProviders = bootstrapApplicationProviders({
  userDataDirectory: app.getPath('userData'),
  safeStorage,
  logger: console,
  externalCredentials: {
    isManaged: isManagedAccessProvider,
    resolve: resolveManagedAccessProviderCredential,
  },
})
applicationProviders.synchronizeExternalCredentials()
const applicationSearchCredentials = bootstrapApplicationSearchCredentials({
  userDataDirectory: app.getPath('userData'),
  safeStorage,
  logger: console,
})
const applicationVoiceCredentials = bootstrapApplicationVoiceCredentials({
  userDataDirectory: app.getPath('userData'),
  safeStorage,
  logger: console,
})
const applicationMcpCredentials = bootstrapApplicationMcpCredentials({
  userDataDirectory: app.getPath('userData'),
  safeStorage,
  logger: console,
})
const applicationHttpToolCredentials = bootstrapApplicationHttpToolCredentials({
  userDataDirectory: app.getPath('userData'),
  safeStorage,
  logger: console,
})
const applicationConnectorCredentials = bootstrapApplicationConnectorCredentials({
  userDataDirectory: app.getPath('userData'),
  safeStorage,
  logger: console,
})
const applicationTelegramCredentials = bootstrapApplicationTelegramCredentials({
  userDataDirectory: app.getPath('userData'),
  safeStorage,
  logger: console,
})
const applicationImageHostCredentials = bootstrapApplicationImageHostCredentials({
  userDataDirectory: app.getPath('userData'),
  safeStorage,
  logger: console,
})
const applicationRepositoryCredentials = bootstrapApplicationRepositoryCredentials({
  userDataDirectory: app.getPath('userData'),
  safeStorage,
  logger: console,
})
const applicationLivePlatformCredentials = bootstrapApplicationLivePlatformCredentials({
  userDataDirectory: app.getPath('userData'),
  safeStorage,
  logger: console,
})
const applicationCodeSandboxCredentials = bootstrapApplicationCodeSandboxCredentials({
  userDataDirectory: app.getPath('userData'),
  safeStorage,
  logger: console,
})
const applicationHomeAssistantCredentials = bootstrapApplicationHomeAssistantCredentials({
  userDataDirectory: app.getPath('userData'),
  safeStorage,
  logger: console,
})

/**
 * 让用户通过操作系统对话框选择一个 SQLite 数据库文件。
 *
 * @returns {Promise<string|null>} 用户确认的绝对路径；取消选择时返回 null。
 */
async function selectApplicationSqliteDatabasePath() {
  const result = await dialog.showOpenDialog({
    title: '选择 SQLite 数据库',
    properties: ['openFile'],
    filters: [
      { name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  })
  return result.canceled || result.filePaths.length !== 1
    ? null
    : result.filePaths[0]
}

const applicationSqlCredentials = bootstrapApplicationSqlCredentials({
  userDataDirectory: app.getPath('userData'),
  safeStorage,
  selectSqliteDatabase: selectApplicationSqliteDatabasePath,
  logger: console,
})
const applicationComfyUiCredentials = bootstrapApplicationComfyUiCredentials({
  userDataDirectory: app.getPath('userData'),
  safeStorage,
  logger: console,
})
const applicationDeliveryCredentials = bootstrapApplicationDeliveryCredentials({
  userDataDirectory: app.getPath('userData'),
  safeStorage,
  logger: console,
})

/** Fetch one account request through Electron networking and system proxy settings. */
function fetchApplicationAccess(url, init) {
  return electronNet.fetch(url, init)
}

/**
 * 通过 Electron 系统代理网络栈下载一个固定目录 VR 资源。
 *
 * @param {string} url Runtime 已从固定目录解析的 HTTPS URL。
 * @param {{redirect: 'manual', signal: AbortSignal}} options 手动重定向和取消选项。
 * @returns {Promise<Response>} 可分块读取的 Electron Fetch 响应；网络失败时拒绝 Promise。
 */
function fetchApplicationVrAsset(url, options) {
  return electronNet.fetch(url, options)
}

const applicationAccess = new ApplicationAccessGateway({
  auth: applicationAuth,
  fetch: fetchApplicationAccess,
  serviceBaseUrl: process.env.OPENXNET_LOGIN_SERVICE_URL,
  apiPrefix: process.env.OPENXNET_LOGIN_API_PREFIX,
  logger: console,
})
const applicationArtifacts = bootstrapApplicationArtifacts({
  userDataDirectory: app.getPath('userData'),
  logger: console,
})
const applicationTasks = bootstrapApplicationTasks({
  userDataDirectory: app.getPath('userData'),
  deliveryCredentials: applicationDeliveryCredentials,
})

/** Compose every independent credential migration over one legacy settings value. */
function normalizeLegacyRendererSettings(settings, operation) {
  const requireSecureCapture = operation === 'write'
  const providerResult = applicationProviders.reconcileLegacySettings(
    settings,
    { requireSecureCapture },
  )
  const searchResult = applicationSearchCredentials.reconcileLegacySettings(
    providerResult.settings,
    { requireSecureCapture },
  )
  const voiceResult = applicationVoiceCredentials.reconcileLegacySettings(
    searchResult.settings,
    {
      requireSecureCapture,
      pruneMissingScopes: requireSecureCapture,
    },
  )
  const mcpResult = applicationMcpCredentials.reconcileLegacySettings(
    voiceResult.settings,
    {
      requireSecureCapture,
      pruneMissingScopes: requireSecureCapture,
    },
  )
  const httpToolResult = applicationHttpToolCredentials.reconcileLegacySettings(
    mcpResult.settings,
    {
      requireSecureCapture,
      pruneMissingScopes: requireSecureCapture,
    },
  )
  const connectorResult = applicationConnectorCredentials.reconcileLegacySettings(
    httpToolResult.settings,
    { requireSecureCapture },
  )
  const telegramResult = applicationTelegramCredentials.reconcileLegacySettings(
    connectorResult.settings,
    { requireSecureCapture },
  )
  const imageHostResult = applicationImageHostCredentials.reconcileLegacySettings(
    telegramResult.settings,
    { requireSecureCapture },
  )
  const repositoryResult = applicationRepositoryCredentials.reconcileLegacySettings(
    imageHostResult.settings,
    { requireSecureCapture },
  )
  const livePlatformResult = applicationLivePlatformCredentials.reconcileLegacySettings(
    repositoryResult.settings,
    { requireSecureCapture },
  )
  const codeSandboxResult = applicationCodeSandboxCredentials.reconcileLegacySettings(
    livePlatformResult.settings,
    { requireSecureCapture },
  )
  const homeAssistantResult = applicationHomeAssistantCredentials.reconcileLegacySettings(
    codeSandboxResult.settings,
    { requireSecureCapture },
  )
  const sqlResult = applicationSqlCredentials.reconcileLegacySettings(
    homeAssistantResult.settings,
    { requireSecureCapture },
  )
  const comfyUiResult = applicationComfyUiCredentials.reconcileLegacySettings(
    sqlResult.settings,
    { requireSecureCapture },
  )
  applicationDeliveryCredentials.migrateLegacyWorkspaceTasksFromSettings(comfyUiResult.settings)
  return {
    settings: comfyUiResult.settings,
    persistSanitized: providerResult.persistSanitized
      || searchResult.persistSanitized
      || voiceResult.persistSanitized
      || mcpResult.persistSanitized
      || httpToolResult.persistSanitized
      || connectorResult.persistSanitized
      || telegramResult.persistSanitized
      || imageHostResult.persistSanitized
      || repositoryResult.persistSanitized
      || livePlatformResult.persistSanitized
      || codeSandboxResult.persistSanitized
      || homeAssistantResult.persistSanitized
      || sqlResult.persistSanitized
      || comfyUiResult.persistSanitized,
  }
}

const legacyRendererState = new LegacyRendererStateService({
  userDataDirectory: app.getPath('userData'),
  logger: console,
  normalizeSettings: normalizeLegacyRendererSettings,
})
const applicationAgentRuntime = new ApplicationAgentRuntimeService({
  userDataDirectory: app.getPath('userData'),
  state: legacyRendererState,
})
const workerSupervisor = new WorkerSupervisor()
const workerRpcToken = randomBytes(32).toString('base64url')
const taskRpcToken = randomBytes(32).toString('base64url')
const connectorChatToken = randomBytes(32).toString('base64url')
const connectorVoiceToken = randomBytes(32).toString('base64url')
const mcpToolBrokerToken = randomBytes(32).toString('base64url')
const competitionMcpGatewayToken = String(process.env.OPENXNET_COMPETITION_MCP_TOKEN || '').trim()
  || randomBytes(32).toString('base64url')
const workerCapabilityUnsubscribers = []
let workerRpcGateway = null
let taskExecutionBrokerGateway = null
let connectorChatBrokerGateway = null
let connectorVoiceBrokerGateway = null
let mcpToolBrokerGateway = null
let competitionMcpGateway = null
let executionEngineSupervisor = null
const featurePackRoot = process.env.OPENXNET_FEATURE_PACK_ROOT
  || path.join(app.getPath('userData'), 'feature-packs')
const featurePackManager = new FeaturePackManager({
  rootDirectory: featurePackRoot,
})
const mcpBrowserStorageRoot = path.join(app.getPath('userData'), 'runtime', 'mcp', 'browsers')
const mcpNpmCacheRoot = path.join(app.getPath('userData'), 'runtime', 'mcp', 'npm-cache')
const agentTeamsMappingRoot = path.join(app.getPath('userData'), 'runtime', 'agentteams', 'mappings')

/**
 * 解析应用随包携带或开发依赖中的 npm CLI 路径。
 *
 * @returns {string} npm CLI 的绝对路径；路径是否存在由实际消费者在启动时校验。
 */
function resolveBundledNpmCliPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'npm', 'bin', 'npm-cli.js')
    : path.join(__dirname, 'node_modules', 'npm', 'bin', 'npm-cli.js')
}

/**
 * 构建 MCP Worker 的最小运行环境，外部 Chrome 子进程只会再继承 Python 侧白名单字段。
 *
 * @param {string} nodeRuntimeSourceDirectory 已验证 Pack 或开发目录中的签名 Node lockfile 根目录。
 * @returns {Record<string, string>} MCP Worker 专用路径、运行时与通用 MCP、Home Assistant、SQL 凭据包络。
 */
function getMcpWorkerRuntimeEnvironment(nodeRuntimeSourceDirectory) {
  return {
    PYTHONIOENCODING: 'utf-8',
    PYTHONUTF8: '1',
    OPENXNET_RUNTIME_ROLE: 'mcp-worker',
    OPENXNET_USER_DATA_DIR: app.getPath('userData'),
    OPENXNET_MCP_BROWSER_STORAGE_DIR: mcpBrowserStorageRoot,
    OPENXNET_MCP_NPM_CACHE_DIR: mcpNpmCacheRoot,
    OPENXNET_MCP_NODE_RUNTIME_SOURCE_DIR: nodeRuntimeSourceDirectory,
    OPENXNET_HOME_ASSISTANT_CREDENTIALS_B64: applicationHomeAssistantCredentials.getRuntimeCredentialBootstrap(),
    OPENXNET_SQL_CREDENTIALS_B64: applicationSqlCredentials.getRuntimeCredentialBootstrap(),
    OPENXNET_MCP_CREDENTIALS_B64: applicationMcpCredentials.getRuntimeCredentialBootstrap(),
    ELECTRON_NODE_EXEC: process.execPath,
    ELECTRON_NPM_CLI: resolveBundledNpmCliPath(),
    ...(app.isPackaged ? { OPENXNET_PUBLIC_RELEASE_SANITIZE: '1' } : {}),
  }
}

/**
 * Load immutable Ed25519 public keys from the application-owned trust store.
 *
 * @returns {Record<string, string>} PEM public keys indexed by stable key ID.
 */
function loadFeaturePackTrustedKeys() {
  const staticRoot = app.isPackaged
    ? path.join(process.resourcesPath, 'ui')
    : path.join(__dirname, 'static')
  const trustStorePath = path.join(staticRoot, 'config', 'feature-pack-trust.json')
  try {
    const value = JSON.parse(fs.readFileSync(trustStorePath, 'utf8'))
    if (
      !value
      || value.schema !== 'openxnet.feature-pack.trust.v1'
      || !value.keys
      || typeof value.keys !== 'object'
      || Array.isArray(value.keys)
    ) {
      throw new Error('Feature Pack trust store schema is invalid.')
    }
    const keys = {}
    for (const [keyId, publicKey] of Object.entries(value.keys)) {
      if (typeof publicKey !== 'string' || !publicKey.trim()) {
        throw new Error(`Feature Pack trust store key '${keyId}' is invalid.`)
      }
      keys[keyId] = publicKey
    }
    return keys
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      console.warn('[FeaturePack] Trust store is missing; remote distribution is disabled')
      return {}
    }
    console.error('[FeaturePack] Trust store could not be loaded; remote distribution is disabled')
    return {}
  }
}

/**
 * Stop a registered capability worker before replacing or removing its files.
 *
 * @param {string} capabilityId Allow-listed Feature Pack capability.
 * @returns {Promise<void>} Resolves after the worker no longer owns pack files.
 */
async function stopFeaturePackRuntime(capabilityId) {
  const worker = workerSupervisor
    .listSnapshots()
    .find((candidate) => candidate.capability === capabilityId)
  if (worker && worker.state !== 'stopped') {
    await workerSupervisor.stop(capabilityId)
  }
}

const featurePackDistribution = new FeaturePackDistributionService({
  manager: featurePackManager,
  stagingDirectory: path.join(featurePackRoot, '.distribution-staging'),
  auditLogPath: path.join(app.getPath('userData'), 'logs', 'feature-pack-audit.jsonl'),
  catalogStatePath: path.join(featurePackRoot, '.distribution', 'catalog-state.json'),
  feedUrl: process.env.OPENXNET_FEATURE_PACK_FEED_URL,
  trustedKeys: loadFeaturePackTrustedKeys(),
  allowInsecureLoopback: !app.isPackaged,
  beforeMutation: stopFeaturePackRuntime,
})
const gitNexusRuntimeConfigPath = path.join(
  app.getPath('userData'),
  'runtime-capabilities',
  'gitnexus.json'
)
const voiceExchangeRoot = path.join(app.getPath('userData'), 'runtime', 'voice-exchange')
const connectorVoiceExchangeRoot = path.join(voiceExchangeRoot, 'connectors')
const asrModelRoot = path.join(app.getPath('userData'), 'asr')
const vectorExchangeRoot = path.join(app.getPath('userData'), 'runtime', 'vector-exchange')
const embeddingModelRoot = path.join(app.getPath('userData'), 'ebd')
const documentExchangeRoot = path.join(app.getPath('userData'), 'runtime', 'document-exchange')

/**
 * 在模型删除或原子替换前停止对应 Worker，避免进程继续持有旧模型文件。
 *
 * @param {'sherpa'|'minilm'} kind 固定模型种类。
 * @returns {Promise<void>} Worker 已停止或原本未运行时完成。
 * @throws {Error} Worker 停止失败时抛出，模型文件不会被修改。
 */
async function prepareApplicationModelAssetMutation(kind) {
  const capability = kind === 'sherpa' ? 'voice' : 'vector-index'
  const worker = workerSupervisor.listSnapshots().find((item) => item.capability === capability)
  if (worker && worker.state !== 'stopped') await workerSupervisor.stop(capability)
}

/**
 * 发现已安装的 Feature Pack，并注册不会提前启动进程的延迟激活器。
 *
 * @returns {Promise<{gitnexus: boolean, voice: boolean, vector: boolean, memory: boolean, documents: boolean, connectors: boolean, live: boolean, mcp: boolean, agentteams: boolean, desktopControl: boolean}>} 各 Feature Pack 的可用状态。
 */
async function configureInstalledFeaturePacks() {
  let gitnexusRegistered = false
  let voiceRegistered = false
  let vectorRegistered = false
  let memoryRegistered = false
  let documentsRegistered = false
  let connectorsRegistered = false
  let liveRegistered = false
  let mcpRegistered = false
  let agentTeamsRegistered = false
  let desktopControlRegistered = false
  try {
    gitnexusRegistered = await registerGitNexusFeaturePack({
      core: desktopCore,
      manager: featurePackManager,
      runtimeConfigPath: gitNexusRuntimeConfigPath,
    })
    console.log(
      gitnexusRegistered
        ? '[FeaturePack] GitNexus is installed and available on demand'
        : '[FeaturePack] GitNexus is not installed; base startup will continue'
    )
  } catch (error) {
    console.error('[FeaturePack] GitNexus discovery failed:', error)
  }

  try {
    let unsubscribe = await registerFeaturePackWorker({
      core: desktopCore,
      manager: featurePackManager,
      supervisor: workerSupervisor,
      capability: 'voice',
      createDefinition: (pack) => ({
        capability: 'voice',
        command: pack.entrypointPath,
        arguments: [
          '--exchange-root', voiceExchangeRoot,
          '--model-root', asrModelRoot,
          '--user-data-root', app.getPath('userData'),
        ],
        workingDirectory: pack.rootDirectory,
        environment: () => ({
          PYTHONIOENCODING: 'utf-8',
          PYTHONUTF8: '1',
          OPENXNET_RUNTIME_ROLE: 'voice-worker',
          OPENXNET_USER_DATA_DIR: app.getPath('userData'),
          OPENXNET_VOICE_EXCHANGE_DIR: voiceExchangeRoot,
          OPENXNET_ASR_MODEL_DIR: asrModelRoot,
          OPENXNET_VOICE_CREDENTIALS_B64: applicationVoiceCredentials.getRuntimeCredentialBootstrap(),
          OPENXNET_PROVIDER_CREDENTIALS_B64: applicationProviders.getRuntimeCredentialBootstrap(),
        }),
        requestTimeoutMs: 180_000,
        shutdownTimeoutMs: 5_000,
        idleTimeoutMs: 5 * 60_000,
      }),
    })
    const installedVoicePack = unsubscribe !== null

    if (unsubscribe === null && isDev) {
      unsubscribe = registerWorkerCapability({
        core: desktopCore,
        supervisor: workerSupervisor,
        definition: {
          capability: 'voice',
          command: path.resolve(__dirname, pythonExec),
          arguments: [
            '-m', 'py.workers.voice_worker',
            '--exchange-root', voiceExchangeRoot,
            '--model-root', asrModelRoot,
            '--user-data-root', app.getPath('userData'),
          ],
          workingDirectory: __dirname,
          environment: () => ({
            PYTHONIOENCODING: 'utf-8',
            PYTHONUTF8: '1',
            OPENXNET_RUNTIME_ROLE: 'voice-worker',
            OPENXNET_USER_DATA_DIR: app.getPath('userData'),
            OPENXNET_VOICE_EXCHANGE_DIR: voiceExchangeRoot,
            OPENXNET_ASR_MODEL_DIR: asrModelRoot,
            OPENXNET_VOICE_CREDENTIALS_B64: applicationVoiceCredentials.getRuntimeCredentialBootstrap(),
            OPENXNET_PROVIDER_CREDENTIALS_B64: applicationProviders.getRuntimeCredentialBootstrap(),
          }),
          requestTimeoutMs: 180_000,
          shutdownTimeoutMs: 5_000,
          idleTimeoutMs: 5 * 60_000,
        },
      })
      console.log('[FeaturePack] Voice Worker will use the development Python environment')
    }

    if (installedVoicePack) {
      console.log('[FeaturePack] Voice Worker is installed and available on demand')
    }

    if (unsubscribe !== null) {
      workerCapabilityUnsubscribers.push(unsubscribe)
      voiceRegistered = true
    }
    if (!voiceRegistered) {
      console.log('[FeaturePack] Voice Worker is not installed; configured ASR and TTS are unavailable')
    }
  } catch (error) {
    console.error('[FeaturePack] Voice Worker discovery failed:', error)
  }

  try {
    let unsubscribe = await registerFeaturePackWorker({
      core: desktopCore,
      manager: featurePackManager,
      supervisor: workerSupervisor,
      capability: 'vector-index',
      createDefinition: (pack) => ({
        capability: 'vector-index',
        command: pack.entrypointPath,
        arguments: [
          '--exchange-root', vectorExchangeRoot,
          '--model-root', embeddingModelRoot,
          '--storage-root', app.getPath('userData'),
        ],
        workingDirectory: pack.rootDirectory,
        environment: {
          PYTHONIOENCODING: 'utf-8',
          PYTHONUTF8: '1',
          OPENXNET_USER_DATA_DIR: app.getPath('userData'),
          OPENXNET_VECTOR_EXCHANGE_DIR: vectorExchangeRoot,
          OPENXNET_EMBEDDING_MODEL_DIR: embeddingModelRoot,
        },
        requestTimeoutMs: 120_000,
        shutdownTimeoutMs: 5_000,
        idleTimeoutMs: 5 * 60_000,
      }),
    })
    const installedVectorPack = unsubscribe !== null

    if (unsubscribe === null && isDev) {
      unsubscribe = registerWorkerCapability({
        core: desktopCore,
        supervisor: workerSupervisor,
        definition: {
          capability: 'vector-index',
          command: path.resolve(__dirname, pythonExec),
          arguments: [
            '-m', 'py.workers.vector_worker',
            '--exchange-root', vectorExchangeRoot,
            '--model-root', embeddingModelRoot,
            '--storage-root', app.getPath('userData'),
          ],
          workingDirectory: __dirname,
          environment: {
            PYTHONIOENCODING: 'utf-8',
            PYTHONUTF8: '1',
            OPENXNET_USER_DATA_DIR: app.getPath('userData'),
            OPENXNET_VECTOR_EXCHANGE_DIR: vectorExchangeRoot,
            OPENXNET_EMBEDDING_MODEL_DIR: embeddingModelRoot,
          },
          requestTimeoutMs: 120_000,
          shutdownTimeoutMs: 5_000,
          idleTimeoutMs: 5 * 60_000,
        },
      })
      console.log('[FeaturePack] Vector Worker will use the development Python environment')
    }

    if (installedVectorPack) {
      console.log('[FeaturePack] Vector Worker is installed and available on demand')
    }
    if (unsubscribe !== null) {
      workerCapabilityUnsubscribers.push(unsubscribe)
      vectorRegistered = true
    }
    if (!vectorRegistered) {
      console.log('[FeaturePack] Vector Worker is not installed; local MiniLM is unavailable')
    }
  } catch (error) {
    console.error('[FeaturePack] Vector Worker discovery failed:', error)
  }

  try {
    let unsubscribe = await registerFeaturePackWorker({
      core: desktopCore,
      manager: featurePackManager,
      supervisor: workerSupervisor,
      capability: 'memory',
      createDefinition: (pack) => ({
        capability: 'memory',
        command: pack.entrypointPath,
        arguments: [
          '--storage-root', app.getPath('userData'),
        ],
        workingDirectory: pack.rootDirectory,
        environment: {
          PYTHONIOENCODING: 'utf-8',
          PYTHONUTF8: '1',
          OPENXNET_USER_DATA_DIR: app.getPath('userData'),
          OPENXNET_VECTOR_EXCHANGE_DIR: vectorExchangeRoot,
          OPENXNET_EMBEDDING_MODEL_DIR: embeddingModelRoot,
          OPENXNET_WORKER_RPC_ORIGIN: workerRpcGateway ? workerRpcGateway.origin : '',
          OPENXNET_WORKER_RPC_TOKEN: workerRpcToken,
          MEM0_TELEMETRY: 'False',
        },
        requestTimeoutMs: 180_000,
        shutdownTimeoutMs: 5_000,
        idleTimeoutMs: 5 * 60_000,
      }),
    })
    const installedMemoryPack = unsubscribe !== null

    if (unsubscribe === null && isDev) {
      unsubscribe = registerWorkerCapability({
        core: desktopCore,
        supervisor: workerSupervisor,
        definition: {
          capability: 'memory',
          command: path.resolve(__dirname, pythonExec),
          arguments: [
            '-m', 'py.workers.memory_worker',
            '--storage-root', app.getPath('userData'),
          ],
          workingDirectory: __dirname,
          environment: {
            PYTHONIOENCODING: 'utf-8',
            PYTHONUTF8: '1',
            OPENXNET_USER_DATA_DIR: app.getPath('userData'),
            OPENXNET_VECTOR_EXCHANGE_DIR: vectorExchangeRoot,
            OPENXNET_EMBEDDING_MODEL_DIR: embeddingModelRoot,
            OPENXNET_WORKER_RPC_ORIGIN: workerRpcGateway ? workerRpcGateway.origin : '',
            OPENXNET_WORKER_RPC_TOKEN: workerRpcToken,
            MEM0_TELEMETRY: 'False',
          },
          requestTimeoutMs: 180_000,
          shutdownTimeoutMs: 5_000,
          idleTimeoutMs: 5 * 60_000,
        },
      })
      console.log('[FeaturePack] Memory Worker will use the development Python environment')
    }

    if (installedMemoryPack) {
      console.log('[FeaturePack] Memory Worker is installed and available on demand')
    }
    if (unsubscribe !== null) {
      workerCapabilityUnsubscribers.push(unsubscribe)
      memoryRegistered = true
    }
    if (!memoryRegistered) {
      console.log('[FeaturePack] Memory Worker is not installed; long-term memory is unavailable')
    }
  } catch (error) {
    console.error('[FeaturePack] Memory Worker discovery failed:', error)
  }

  try {
    let unsubscribe = await registerFeaturePackWorker({
      core: desktopCore,
      manager: featurePackManager,
      supervisor: workerSupervisor,
      capability: 'documents',
      createDefinition: (pack) => ({
        capability: 'documents',
        command: pack.entrypointPath,
        arguments: [
          '--exchange-root', documentExchangeRoot,
        ],
        workingDirectory: pack.rootDirectory,
        environment: {
          PYTHONIOENCODING: 'utf-8',
          PYTHONUTF8: '1',
          OPENXNET_USER_DATA_DIR: app.getPath('userData'),
          OPENXNET_DOCUMENT_EXCHANGE_DIR: documentExchangeRoot,
        },
        requestTimeoutMs: 120_000,
        shutdownTimeoutMs: 5_000,
        idleTimeoutMs: 5 * 60_000,
      }),
    })
    const installedDocumentPack = unsubscribe !== null

    if (unsubscribe === null && isDev) {
      unsubscribe = registerWorkerCapability({
        core: desktopCore,
        supervisor: workerSupervisor,
        definition: {
          capability: 'documents',
          command: path.resolve(__dirname, pythonExec),
          arguments: [
            '-m', 'py.workers.document_worker',
            '--exchange-root', documentExchangeRoot,
          ],
          workingDirectory: __dirname,
          environment: {
            PYTHONIOENCODING: 'utf-8',
            PYTHONUTF8: '1',
            OPENXNET_USER_DATA_DIR: app.getPath('userData'),
            OPENXNET_DOCUMENT_EXCHANGE_DIR: documentExchangeRoot,
          },
          requestTimeoutMs: 120_000,
          shutdownTimeoutMs: 5_000,
          idleTimeoutMs: 5 * 60_000,
        },
      })
      console.log('[FeaturePack] Document Worker will use the development Python environment')
    }

    if (installedDocumentPack) {
      console.log('[FeaturePack] Document Worker is installed and available on demand')
    }
    if (unsubscribe !== null) {
      workerCapabilityUnsubscribers.push(unsubscribe)
      documentsRegistered = true
    }
    if (!documentsRegistered) {
      console.log('[FeaturePack] Document Worker is not installed; office extraction is unavailable')
    }
  } catch (error) {
    console.error('[FeaturePack] Document Worker discovery failed:', error)
  }

  try {
    let unsubscribe = await registerFeaturePackWorker({
      core: desktopCore,
      manager: featurePackManager,
      supervisor: workerSupervisor,
      capability: 'connectors',
      createDefinition: (pack) => ({
        capability: 'connectors',
        command: pack.entrypointPath,
        arguments: [],
        workingDirectory: pack.rootDirectory,
        environment: () => ({
          PYTHONIOENCODING: 'utf-8',
          PYTHONUTF8: '1',
          OPENXNET_APP_NAME: OPENXNET_APP_NAME,
          OPENXNET_RUNTIME_ROLE: 'connector-worker',
          OPENXNET_USER_DATA_DIR: app.getPath('userData'),
          OPENXNET_PUBLIC_RELEASE_SANITIZE: '1',
          ...getConnectorChatRuntimeEnvironment(),
          ...getConnectorVoiceRuntimeEnvironment(),
          OPENXNET_CONNECTOR_CREDENTIALS_B64: applicationConnectorCredentials.getRuntimeCredentialBootstrap(),
          OPENXNET_TELEGRAM_CREDENTIALS_B64: applicationTelegramCredentials.getRuntimeCredentialBootstrap(),
          OPENXNET_IMAGE_HOST_CREDENTIALS_B64: applicationImageHostCredentials.getRuntimeCredentialBootstrap(),
        }),
        requestTimeoutMs: 120_000,
        shutdownTimeoutMs: 15_000,
        idleTimeoutMs: 0,
      }),
    })
    const installedConnectorPack = unsubscribe !== null

    if (unsubscribe === null && isDev) {
      unsubscribe = registerWorkerCapability({
        core: desktopCore,
        supervisor: workerSupervisor,
        definition: {
          capability: 'connectors',
          command: path.resolve(__dirname, pythonExec),
          arguments: ['-m', 'py.workers.connector_worker'],
          workingDirectory: __dirname,
          environment: () => ({
            PYTHONIOENCODING: 'utf-8',
            PYTHONUTF8: '1',
            OPENXNET_APP_NAME: OPENXNET_APP_NAME,
            OPENXNET_RUNTIME_ROLE: 'connector-worker',
            OPENXNET_USER_DATA_DIR: app.getPath('userData'),
            ...getConnectorChatRuntimeEnvironment(),
            ...getConnectorVoiceRuntimeEnvironment(),
            OPENXNET_CONNECTOR_CREDENTIALS_B64: applicationConnectorCredentials.getRuntimeCredentialBootstrap(),
            OPENXNET_TELEGRAM_CREDENTIALS_B64: applicationTelegramCredentials.getRuntimeCredentialBootstrap(),
            OPENXNET_IMAGE_HOST_CREDENTIALS_B64: applicationImageHostCredentials.getRuntimeCredentialBootstrap(),
          }),
          requestTimeoutMs: 120_000,
          shutdownTimeoutMs: 15_000,
          idleTimeoutMs: 0,
        },
      })
      console.log('[FeaturePack] Connector Worker will use the development Python environment')
    }

    if (installedConnectorPack) {
      console.log('[FeaturePack] Connector Worker is installed and available on demand')
    }
    if (unsubscribe !== null) {
      workerCapabilityUnsubscribers.push(unsubscribe)
      connectorsRegistered = true
    }
    if (!connectorsRegistered) {
      console.log('[FeaturePack] Connector Worker is not installed; optional bot platforms are unavailable')
    }
  } catch (error) {
    console.error('[FeaturePack] Connector Worker discovery failed:', error)
  }

  try {
    let unsubscribe = await registerFeaturePackWorker({
      core: desktopCore,
      manager: featurePackManager,
      supervisor: workerSupervisor,
      capability: 'live',
      createDefinition: (pack) => ({
        capability: 'live',
        command: pack.entrypointPath,
        arguments: [],
        workingDirectory: pack.rootDirectory,
        environment: () => ({
          PYTHONIOENCODING: 'utf-8',
          PYTHONUTF8: '1',
          OPENXNET_RUNTIME_ROLE: 'live-worker',
          OPENXNET_USER_DATA_DIR: app.getPath('userData'),
          OPENXNET_PUBLIC_RELEASE_SANITIZE: '1',
          OPENXNET_LIVE_PLATFORM_CREDENTIALS_B64: applicationLivePlatformCredentials.getRuntimeCredentialBootstrap(),
        }),
        requestTimeoutMs: 60_000,
        shutdownTimeoutMs: 15_000,
        idleTimeoutMs: 0,
      }),
    })
    const installedLivePack = unsubscribe !== null

    if (unsubscribe === null && isDev) {
      unsubscribe = registerWorkerCapability({
        core: desktopCore,
        supervisor: workerSupervisor,
        definition: {
          capability: 'live',
          command: path.resolve(__dirname, pythonExec),
          arguments: ['-m', 'py.workers.live_worker'],
          workingDirectory: __dirname,
          environment: () => ({
            PYTHONIOENCODING: 'utf-8',
            PYTHONUTF8: '1',
            OPENXNET_RUNTIME_ROLE: 'live-worker',
            OPENXNET_USER_DATA_DIR: app.getPath('userData'),
            OPENXNET_LIVE_PLATFORM_CREDENTIALS_B64: applicationLivePlatformCredentials.getRuntimeCredentialBootstrap(),
          }),
          requestTimeoutMs: 60_000,
          shutdownTimeoutMs: 15_000,
          idleTimeoutMs: 0,
        },
      })
      console.log('[FeaturePack] Live Worker will use the development Python environment')
    }

    if (installedLivePack) {
      console.log('[FeaturePack] Live Worker is installed and available on demand')
    }
    if (unsubscribe !== null) {
      workerCapabilityUnsubscribers.push(unsubscribe)
      liveRegistered = true
    }
    if (!liveRegistered) {
      console.log('[FeaturePack] Live Worker is not installed; live transports are unavailable')
    }
  } catch (error) {
    console.error('[FeaturePack] Live Worker discovery failed:', error)
  }

  try {
    let unsubscribe = await registerFeaturePackWorker({
      core: desktopCore,
      manager: featurePackManager,
      supervisor: workerSupervisor,
      capability: 'desktop-control',
      createDefinition: (pack) => ({
        capability: 'desktop-control',
        command: pack.entrypointPath,
        arguments: [],
        workingDirectory: pack.rootDirectory,
        environment: {
          PYTHONIOENCODING: 'utf-8',
          PYTHONUTF8: '1',
          OPENXNET_RUNTIME_ROLE: 'desktop-control-worker',
          OPENXNET_PUBLIC_RELEASE_SANITIZE: '1',
        },
        requestTimeoutMs: 15_000,
        shutdownTimeoutMs: 5_000,
        idleTimeoutMs: 30_000,
      }),
    })
    const installedDesktopControlPack = unsubscribe !== null

    if (unsubscribe === null && isDev) {
      unsubscribe = registerWorkerCapability({
        core: desktopCore,
        supervisor: workerSupervisor,
        definition: {
          capability: 'desktop-control',
          command: path.resolve(__dirname, pythonExec),
          arguments: ['-m', 'py.workers.desktop_control_worker'],
          workingDirectory: __dirname,
          environment: {
            PYTHONIOENCODING: 'utf-8',
            PYTHONUTF8: '1',
            OPENXNET_RUNTIME_ROLE: 'desktop-control-worker',
          },
          requestTimeoutMs: 15_000,
          shutdownTimeoutMs: 5_000,
          idleTimeoutMs: 30_000,
        },
      })
      console.log('[FeaturePack] Desktop Control Worker will use the development Python environment')
    }

    if (installedDesktopControlPack) {
      console.log('[FeaturePack] Desktop Control Worker is installed and available on demand')
    }
    if (unsubscribe !== null) {
      workerCapabilityUnsubscribers.push(unsubscribe)
      desktopControlRegistered = true
    }
    if (!desktopControlRegistered) {
      console.log('[FeaturePack] Desktop Control Worker is not installed; window control is unavailable')
    }
  } catch (error) {
    console.error('[FeaturePack] Desktop Control Worker discovery failed:', error)
  }

  try {
    let unsubscribe = await registerFeaturePackWorker({
      core: desktopCore,
      manager: featurePackManager,
      supervisor: workerSupervisor,
      capability: 'mcp',
      createDefinition: (pack) => ({
        capability: 'mcp',
        command: pack.entrypointPath,
        arguments: [],
        workingDirectory: pack.rootDirectory,
        environment: () => getMcpWorkerRuntimeEnvironment(path.join(pack.rootDirectory, 'node-runtime')),
        requestTimeoutMs: 210_000,
        shutdownTimeoutMs: 15_000,
        idleTimeoutMs: 0,
      }),
    })
    const installedMcpPack = unsubscribe !== null

    if (unsubscribe === null && isDev) {
      unsubscribe = registerWorkerCapability({
        core: desktopCore,
        supervisor: workerSupervisor,
        definition: {
          capability: 'mcp',
          command: path.resolve(__dirname, pythonExec),
          arguments: ['-m', 'py.workers.mcp_worker'],
          workingDirectory: __dirname,
          environment: () => getMcpWorkerRuntimeEnvironment(path.join(__dirname, 'mcp-node-runtime')),
          requestTimeoutMs: 210_000,
          shutdownTimeoutMs: 15_000,
          idleTimeoutMs: 0,
        },
      })
      console.log('[FeaturePack] MCP Worker will use the development Python environment')
    }

    if (installedMcpPack) {
      console.log('[FeaturePack] MCP Worker is installed and available on demand')
    }
    if (unsubscribe !== null) {
      workerCapabilityUnsubscribers.push(unsubscribe)
      mcpRegistered = true
    }
    if (!mcpRegistered) {
      console.log('[FeaturePack] MCP Worker is not installed; MCP integrations are unavailable')
    }
  } catch (error) {
    console.error('[FeaturePack] MCP Worker discovery failed:', error)
  }

  try {
    let unsubscribe = await registerFeaturePackWorker({
      core: desktopCore,
      manager: featurePackManager,
      supervisor: workerSupervisor,
      capability: 'agentteams',
      createDefinition: (pack) => ({
        capability: 'agentteams',
        command: pack.entrypointPath,
        arguments: ['--mapping-root', agentTeamsMappingRoot],
        workingDirectory: pack.rootDirectory,
        environment: {
          PYTHONIOENCODING: 'utf-8',
          PYTHONUTF8: '1',
          OPENXNET_RUNTIME_ROLE: 'agentteams-worker',
          OPENXNET_USER_DATA_DIR: app.getPath('userData'),
        },
        requestTimeoutMs: 120_000,
        shutdownTimeoutMs: 10_000,
        idleTimeoutMs: 10 * 60_000,
      }),
    })
    const installedAgentTeamsPack = unsubscribe !== null
    if (unsubscribe === null && isDev) {
      unsubscribe = registerWorkerCapability({
        core: desktopCore,
        supervisor: workerSupervisor,
        definition: {
          capability: 'agentteams',
          command: path.resolve(__dirname, pythonExec),
          arguments: [
            '-m', 'py.workers.agentteams_worker',
            '--mapping-root', agentTeamsMappingRoot,
          ],
          workingDirectory: __dirname,
          environment: {
            PYTHONIOENCODING: 'utf-8',
            PYTHONUTF8: '1',
            OPENXNET_RUNTIME_ROLE: 'agentteams-worker',
            OPENXNET_USER_DATA_DIR: app.getPath('userData'),
          },
          requestTimeoutMs: 120_000,
          shutdownTimeoutMs: 10_000,
          idleTimeoutMs: 10 * 60_000,
        },
      })
      console.log('[FeaturePack] AgentTeams Worker will use the development Python environment')
    }
    if (installedAgentTeamsPack) {
      console.log('[FeaturePack] AgentTeams Worker is installed and available on demand')
    }
    if (unsubscribe !== null) {
      workerCapabilityUnsubscribers.push(unsubscribe)
      agentTeamsRegistered = true
    }
    if (!agentTeamsRegistered) {
      console.log('[FeaturePack] AgentTeams Worker is not installed; builtin orchestration remains available')
    }
  } catch (error) {
    console.error('[FeaturePack] AgentTeams Worker discovery failed:', error)
  }

  return {
    gitnexus: gitnexusRegistered,
    voice: voiceRegistered,
    vector: vectorRegistered,
    memory: memoryRegistered,
    documents: documentsRegistered,
    connectors: connectorsRegistered,
    live: liveRegistered,
    mcp: mcpRegistered,
    agentteams: agentTeamsRegistered,
    desktopControl: desktopControlRegistered,
  }
}

/**
 * Start the authenticated loopback bridge used by legacy backend worker adapters.
 *
 * @returns {Promise<string>} Bound Worker RPC origin.
 */
async function startWorkerRpcGateway() {
  if (workerRpcGateway) {
    return workerRpcGateway.origin
  }
  const gateway = new WorkerRpcGateway({
    core: desktopCore,
    supervisor: workerSupervisor,
    token: workerRpcToken,
    allowedMethods: {
      voice: [
        'voice.status',
        'voice.transcribe',
        'voice.transcribe-configured',
        'voice.synthesize',
        'voice.release',
      ],
      'vector-index': [
        'vector.status',
        'vector.embed',
        'vector.rebuild',
        'vector.add',
        'vector.search',
        'vector.release',
        'vector.store.build',
        'vector.store.append',
        'vector.store.search',
        'vector.store.delete-position',
        'vector.store.inspect',
        'vector.store.delete',
      ],
      memory: [
        'memory.status',
        'memory.search',
        'memory.add',
        'memory.release',
        'recall.bootstrap',
        'recall.search',
        'recall.timeline',
        'recall.observations',
        'recall.resume',
        'recall.rollback',
        'recall.close',
      ],
      documents: [
        'documents.status',
        'documents.extract',
      ],
      connectors: [
        'connectors.status',
        'connectors.dependencies',
        'connectors.start',
        'connectors.stop',
        'connectors.reload',
        'connectors.update',
        'connectors.stop-all',
      ],
      tasks: [
        'tasks.executor.checkpoint',
        'tasks.executor.start',
        'tasks.executor.status',
        'tasks.executor.cancel',
      ],
    },
    maxBodyBytes: 3 * 1024 * 1024,
  })
  const origin = await gateway.start()
  workerRpcGateway = gateway
  console.log(`[Startup] Worker RPC Gateway ready at ${origin}`)
  return origin
}

/**
 * Acquire one request lease from the independently supervised provider engine.
 *
 * @returns {Promise<{origin: string, release: Function}>} Ready engine lease.
 */
async function acquireTaskProviderEngine() {
  if (!executionEngineSupervisor) {
    throw new Error('Execution Engine supervisor is not configured.')
  }
  await desktopCore.ensureCapability('execution-engine')
  return executionEngineSupervisor.acquire()
}

/**
 * Acquire one Chat lease after activating the typed Chat capability contract.
 *
 * @returns {Promise<{origin: string, release: Function}>} Ready Chat engine lease.
 */
async function acquireApplicationChatEngine() {
  if (!executionEngineSupervisor) {
    throw new Error('Execution Engine supervisor is not configured.')
  }
  await desktopCore.ensureCapability('chat')
  return executionEngineSupervisor.acquire()
}

/**
 * 激活 Execution Engine 并获取一个知识库请求租约。
 *
 * @returns {Promise<{origin: string, release: Function}>} 已就绪的私有引擎租约。
 */
async function acquireApplicationKnowledgeBaseEngine() {
  if (!executionEngineSupervisor) {
    throw new Error('Execution Engine supervisor is not configured.')
  }
  await desktopCore.ensureCapability('execution-engine')
  return executionEngineSupervisor.acquire()
}

/**
 * 激活 Execution Engine 并获取一个企业洞察请求租约。
 *
 * @returns {Promise<{origin: string, release: Function}>} 已就绪的私有引擎租约。
 */
async function acquireApplicationEnterpriseInsightsEngine() {
  if (!executionEngineSupervisor) {
    throw new Error('Execution Engine supervisor is not configured.')
  }
  await desktopCore.ensureCapability('execution-engine')
  return executionEngineSupervisor.acquire()
}

/**
 * 激活 Execution Engine 并获取一个 Kernel 请求租约。
 *
 * @returns {Promise<{origin: string, release: Function}>} 已就绪的私有引擎租约。
 * @throws {Error} Supervisor 未配置或引擎启动失败时抛出，且不会返回半初始化租约。
 */
async function acquireApplicationKernelEngine() {
  if (!executionEngineSupervisor) {
    throw new Error('Execution Engine supervisor is not configured.')
  }
  await desktopCore.ensureCapability('execution-engine')
  return executionEngineSupervisor.acquire()
}

/**
 * Start the lightweight authenticated task broker without starting Python backend.
 *
 * @returns {Promise<string>} Bound Task Execution Broker origin.
 */
async function startTaskExecutionBrokerGateway() {
  if (taskExecutionBrokerGateway) {
    return taskExecutionBrokerGateway.origin
  }
  const gateway = new TaskExecutionBrokerGateway({
    token: taskRpcToken,
    acquireProviderEngine: acquireTaskProviderEngine,
    resolveDeliveryCredentialBootstrap: (scope) => (
      applicationDeliveryCredentials.getRequestCredentialBootstrap(scope)
    ),
    maxBodyBytes: 2 * 1024 * 1024,
  })
  const origin = await gateway.start()
  taskExecutionBrokerGateway = gateway
  console.log(`[Startup] Task Execution Broker Gateway ready at ${origin}`)
  return origin
}

/**
 * 启动 Execution Engine 专用 MCP Tool Broker，且不提前激活 MCP Worker。
 *
 * @returns {Promise<string>} 已绑定的回环 Broker origin。
 */
async function startMcpToolBrokerGateway() {
  if (mcpToolBrokerGateway) {
    return mcpToolBrokerGateway.origin
  }
  const gateway = new McpToolBrokerGateway({
    token: mcpToolBrokerToken,
    core: desktopCore,
    supervisor: workerSupervisor,
    waitForCredentialRefresh: () => mcpCredentialRuntimeInvalidation,
    maxBodyBytes: 512 * 1024,
    maxResponseBytes: 2 * 1024 * 1024,
  })
  const origin = await gateway.start()
  mcpToolBrokerGateway = gateway
  console.log(`[Startup] MCP Tool Broker ready at ${origin}`)
  return origin
}

/**
 * 启动竞赛北向 MCP 2026-07-28 Gateway，不激活任何 Python Worker。
 *
 * @returns {Promise<string>} 已绑定的回环 MCP origin。
 */
async function startCompetitionMcpGateway() {
  if (competitionMcpGateway) {
    return competitionMcpGateway.origin
  }
  const gateway = new CompetitionMcpGateway({
    token: competitionMcpGatewayToken,
    principal: {
      actorId: 'openxnet-local-mcp-operator',
      workspaceId: String(process.env.OPENXNET_COMPETITION_WORKSPACE_ID || '').trim() || 'ws_goai_demo',
      scopes: ['openxnet:competition:admin'],
    },
    runtime: applicationCompetitionRuntime,
    allowedOrigins: String(process.env.OPENXNET_COMPETITION_MCP_ALLOWED_ORIGINS || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  })
  const origin = await gateway.start()
  competitionMcpGateway = gateway
  console.log(`[Startup] Competition MCP Gateway ready at ${origin}/mcp`)
  return origin
}

/**
 * 只向 Execution Engine 启动环境返回私有 MCP Broker 地址和进程令牌。
 *
 * @returns {{OPENXNET_MCP_TOOL_BROKER_ORIGIN: string, OPENXNET_MCP_TOOL_BROKER_TOKEN: string}} 私有环境变量。
 */
function getMcpToolBrokerRuntimeEnvironment() {
  if (!mcpToolBrokerGateway) {
    throw new Error('MCP Tool Broker is not configured.')
  }
  return {
    OPENXNET_MCP_TOOL_BROKER_ORIGIN: mcpToolBrokerGateway.origin,
    OPENXNET_MCP_TOOL_BROKER_TOKEN: mcpToolBrokerToken,
  }
}

/**
 * Start the private Connector Chat broker without activating Execution Engine.
 *
 * @returns {Promise<string>} Bound Connector Chat Broker origin.
 */
async function startConnectorChatBrokerGateway() {
  if (connectorChatBrokerGateway) {
    return connectorChatBrokerGateway.origin
  }
  const gateway = new ConnectorChatBrokerGateway({
    token: connectorChatToken,
    upstreamToken: taskRpcToken,
    acquireChatEngine: acquireApplicationChatEngine,
    maxBodyBytes: 2 * 1024 * 1024,
    maxResponseBytes: 8 * 1024 * 1024,
  })
  const origin = await gateway.start()
  connectorChatBrokerGateway = gateway
  console.log(`[Startup] Connector Chat Broker ready at ${origin}`)
  return origin
}

/** Return private Connector Chat configuration only to the Connector Worker launch. */
function getConnectorChatRuntimeEnvironment() {
  if (!connectorChatBrokerGateway) {
    throw new Error('Connector Chat Broker is not configured.')
  }
  return {
    OPENXNET_CONNECTOR_CHAT_ORIGIN: connectorChatBrokerGateway.origin,
    OPENXNET_CONNECTOR_CHAT_TOKEN: connectorChatToken,
  }
}

/** 只向 Connector Worker 启动环境返回私有语音地址、令牌和交换目录。 */
function getConnectorVoiceRuntimeEnvironment() {
  if (!connectorVoiceBrokerGateway) {
    throw new Error('Connector Voice Broker is not configured.')
  }
  return {
    OPENXNET_CONNECTOR_VOICE_ORIGIN: connectorVoiceBrokerGateway.origin,
    OPENXNET_CONNECTOR_VOICE_TOKEN: connectorVoiceToken,
    OPENXNET_CONNECTOR_VOICE_EXCHANGE_DIR: connectorVoiceExchangeRoot,
  }
}

/**
 * 从 Main 持有的无密钥快照复制一个有界语音设置作用域。
 *
 * @param {'asrSettings' | 'ttsSettings'} fieldName 设置字段名。
 * @param {string} label 用于固定错误消息的设置类型标签。
 * @returns {object} 可发送给 Voice Worker 的独立无密钥设置副本。
 */
function readVoiceRuntimeSettings(fieldName, label) {
  const snapshot = legacyRendererState.getSnapshot()
  const value = snapshot.settings[fieldName]
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }
  const serialized = JSON.stringify(value)
  if (Buffer.byteLength(serialized, 'utf8') > 2 * 1024 * 1024) {
    throw new Error(`Connector Voice ${label} settings exceed their size budget.`)
  }
  return JSON.parse(serialized)
}

/**
 * 组合 VRM 窗口所需的语言、选择状态和 Main-owned 资产目录。
 *
 * @returns {Promise<{language: string, vrmConfig: object}>} 不含本机绝对路径和凭据的配置快照。
 */
async function readVrmPresentationConfiguration() {
  const settings = legacyRendererState.getSnapshot().settings
  const storedConfig = settings.VRMConfig && typeof settings.VRMConfig === 'object' && !Array.isArray(settings.VRMConfig)
    ? settings.VRMConfig
    : {}
  const assets = await applicationVrAssetRuntime.listAssets()
  const cloudModels = assets.cloudModels.map((model) => ({
    ...model,
    path: model.path || model.remoteUrl,
  }))
  const knownModels = [...assets.defaultModels, ...assets.userModels, ...cloudModels]
  const knownModelIds = new Set(knownModels.map((model) => model.id))
  const fallbackModelId = knownModels[0]?.id || ''
  const selectedModelId = knownModelIds.has(String(storedConfig.selectedModelId || ''))
    ? String(storedConfig.selectedModelId)
    : fallbackModelId
  const systemSettings = settings.systemSettings && typeof settings.systemSettings === 'object'
    ? settings.systemSettings
    : {}
  const language = String(settings.currentLanguage || systemSettings.language || 'zh-CN').trim() || 'zh-CN'
  return {
    language,
    vrmConfig: {
      ...storedConfig,
      selectedModelId,
      selectedNewModelId: knownModelIds.has(String(storedConfig.selectedNewModelId || ''))
        ? String(storedConfig.selectedNewModelId)
        : selectedModelId,
      defaultModels: assets.defaultModels,
      userModels: assets.userModels,
      cloudModels,
      defaultMotions: assets.defaultMotions,
      userMotions: assets.userMotions,
      defaultGaussScenes: assets.defaultScenes,
      userGaussScenes: assets.userScenes,
      remoteResourceBaseUrl: assets.remoteBaseUrl,
    },
  }
}

/**
 * 从 Main 持有的无密钥设置读取 Recall 私有工作区作用域。
 *
 * @returns {{workspaceDirectory: string, providerName: string}} 只发送给 Memory Worker 的路径与 Provider 名。
 */
function readRecallRuntimeScope() {
  const settings = legacyRendererState.getSnapshot().settings
  const cliSettings = settings.CLISettings && typeof settings.CLISettings === 'object'
    ? settings.CLISettings
    : {}
  const memorySettings = settings.memorySettings && typeof settings.memorySettings === 'object'
    ? settings.memorySettings
    : {}
  const workspaceDirectory = typeof cliSettings.cc_path === 'string'
    ? cliSettings.cc_path.trim()
    : ''
  const providerName = typeof memorySettings.workspaceProvider === 'string'
    ? memorySettings.workspaceProvider.trim()
    : ''
  if (workspaceDirectory.length > 32767 || workspaceDirectory.includes('\u0000') || providerName.length > 128) {
    throw new Error('Recall runtime scope is invalid.')
  }
  return { workspaceDirectory, providerName }
}

/**
 * 向已存在的 Desktop 浮层发送 Recall 观察焦点，不创建窗口或启动后端。
 *
 * @param {object} request 已通过 typed contract 校验的有界观察焦点。
 * @returns {number} 成功投递的现存浮层窗口数量。
 */
function publishRecallObservationFocus(request) {
  let delivered = 0
  for (const targetWindow of [dynamicIslandWindow, floatingTaskHudWindow]) {
    if (!targetWindow || targetWindow.isDestroyed() || targetWindow.webContents.isDestroyed()) {
      continue
    }
    targetWindow.webContents.send(
      APPLICATION_RECALL_RUNTIME_CHANNELS.observationFocusChanged,
      request,
    )
    delivered += 1
  }
  return delivered
}

/**
 * 确保 Voice Worker 已就绪并执行一个受监督请求；取消只阻止结果继续返回给 Broker。
 *
 * @param {string} method Voice Worker 方法名。
 * @param {object} payload 不含二进制和凭据的请求对象。
 * @param {AbortSignal} signal Connector Broker 请求取消信号。
 * @returns {Promise<object>} Voice Worker 返回的结构化结果。
 */
async function requestConnectorVoiceWorker(method, payload, signal) {
  if (signal.aborted) {
    throw new Error('Connector Voice request was cancelled.')
  }
  await desktopCore.ensureCapability('voice')
  const result = await workerSupervisor.request('voice', method, payload)
  if (signal.aborted) {
    throw new Error('Connector Voice request was cancelled.')
  }
  return result
}

/**
 * 读取并删除 Voice Worker 生成的有界普通文件，拒绝目录穿越、链接和元数据不一致。
 *
 * @param {object} payload Voice Worker 合成结果。
 * @returns {Promise<{audio: Buffer, mediaType: string}>} Broker 可写入 Connector 临时文件的音频。
 */
async function readConnectorVoiceWorkerOutput(payload) {
  const artifactPath = typeof payload.artifactPath === 'string'
    ? path.resolve(payload.artifactPath)
    : ''
  const byteLength = Number(payload.byteLength)
  const mediaType = typeof payload.mediaType === 'string'
    ? payload.mediaType.trim().toLowerCase()
    : ''
  const allowedMediaTypes = new Set([
    'audio/mpeg',
    'audio/ogg',
    'audio/wav',
    'audio/aac',
    'audio/flac',
  ])
  if (
    !artifactPath
    || path.dirname(artifactPath) !== path.resolve(voiceExchangeRoot)
    || !path.basename(artifactPath).startsWith('voice-output-')
    || !Number.isInteger(byteLength)
    || byteLength < 1
    || byteLength > 25 * 1024 * 1024
    || !allowedMediaTypes.has(mediaType)
  ) {
    throw new Error('Connector Voice Worker returned invalid output metadata.')
  }
  try {
    const metadata = await fs.promises.lstat(artifactPath)
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size !== byteLength) {
      throw new Error('Connector Voice Worker returned an invalid output artifact.')
    }
    const [realRoot, realArtifact] = await Promise.all([
      fs.promises.realpath(voiceExchangeRoot),
      fs.promises.realpath(artifactPath),
    ])
    if (path.dirname(realArtifact) !== realRoot) {
      throw new Error('Connector Voice Worker output escaped its exchange root.')
    }
    const audio = await fs.promises.readFile(realArtifact)
    if (audio.length !== byteLength) {
      throw new Error('Connector Voice Worker output changed while it was being read.')
    }
    return { audio, mediaType }
  } finally {
    await fs.promises.unlink(artifactPath).catch(() => undefined)
  }
}

/**
 * 将一个受控临时音频引用交给配置化 Voice Worker，并只返回有界转写文本。
 *
 * @param {{artifactPath: string, filename: string, format: string}} input 已验证的音频引用。
 * @param {AbortSignal} signal Broker 请求取消信号。
 * @returns {Promise<string>} 有界转写文本。
 */
async function transcribeConnectorVoiceThroughWorker(input, signal) {
  const settings = readVoiceRuntimeSettings('asrSettings', 'ASR')
  const payload = await requestConnectorVoiceWorker('voice.transcribe-configured', {
    artifactPath: input.artifactPath,
    filename: input.filename,
    format: input.format,
    settings,
  }, signal)
  const text = payload.text
  if (typeof text !== 'string' || text.length > 100_000 || text.includes('\u0000')) {
    throw new Error('Connector Voice Worker returned an invalid transcription.')
  }
  return text.trim()
}

/**
 * 使用 Main 的无密钥设置快照调用配置化 Voice Worker，并读取其一次性音频文件。
 *
 * @param {{text: string, voice: string, index: number, mobileOptimized: boolean, format: string}} input 已验证的合成参数。
 * @param {AbortSignal} signal Broker 请求取消信号。
 * @returns {Promise<{audio: Buffer, mediaType: string}>} Broker 可写入 Connector 临时文件的音频结果。
 */
async function synthesizeConnectorVoiceThroughWorker(input, signal) {
  const settings = readVoiceRuntimeSettings('ttsSettings', 'TTS')
  const payload = await requestConnectorVoiceWorker('voice.synthesize', {
    text: input.text,
    voice: input.voice,
    index: input.index,
    mobileOptimized: input.mobileOptimized,
    format: input.format,
    settings,
  }, signal)
  return readConnectorVoiceWorkerOutput(payload)
}

/**
 * 启动轻量 Connector Voice Broker，但不提前启动 Voice Worker。
 *
 * @returns {Promise<string>} Broker 绑定的回环地址。
 */
async function startConnectorVoiceBrokerGateway() {
  if (connectorVoiceBrokerGateway) {
    return connectorVoiceBrokerGateway.origin
  }
  const gateway = new ConnectorVoiceBrokerGateway({
    token: connectorVoiceToken,
    exchangeRoot: connectorVoiceExchangeRoot,
    transcribe: transcribeConnectorVoiceThroughWorker,
    synthesize: synthesizeConnectorVoiceThroughWorker,
    maxBodyBytes: 256 * 1024,
    maxInputAudioBytes: 25 * 1024 * 1024,
    maxOutputAudioBytes: 25 * 1024 * 1024,
  })
  const origin = await gateway.start()
  connectorVoiceBrokerGateway = gateway
  console.log(`[Startup] Connector Voice Broker ready at ${origin}`)
  return origin
}

/**
 * Return active Renderer web contents for Desktop Core state broadcasts.
 *
 * @returns {Electron.WebContents[]} Active, non-destroyed web contents.
 */
function getDesktopWebContents() {
  return mainWindow && !mainWindow.isDestroyed() ? [mainWindow.webContents] : []
}

/**
 * Return non-secret application metadata for the Renderer bootstrap snapshot.
 *
 * @returns {object} Stable application metadata.
 */
function getDesktopBootstrapApplication() {
  return {
    version: app.getVersion(),
    platform: process.platform,
    architecture: process.arch,
    locale: app.getLocale(),
    packaged: app.isPackaged,
  }
}

const unregisterDesktopCoreIpc = registerDesktopCoreIpc({
  ipcMain,
  core: desktopCore,
  featurePacks: featurePackDistribution,
  authorizeEvent: assertMainRendererSender,
  getWebContents: getDesktopWebContents,
})
const unregisterApplicationSettingsIpc = registerApplicationSettingsIpc({
  ipcMain,
  settings: applicationSettings,
  authorizeEvent: assertMainRendererSender,
})
const unregisterApplicationAuthIpc = registerApplicationAuthIpc({
  ipcMain,
  auth: applicationAuth,
  authorizeEvent: assertMainRendererSender,
})
const unregisterApplicationAccessIpc = registerApplicationAccessIpc({
  ipcMain,
  access: applicationAccess,
  authorizeEvent: assertMainRendererSender,
})
const unregisterApplicationProvidersIpc = registerApplicationProvidersIpc({
  ipcMain,
  providers: applicationProviders,
  authorizeEvent: assertMainRendererSender,
})
const unregisterApplicationAgentRuntimeIpc = registerApplicationAgentRuntimeIpc({
  ipcMain,
  runtime: applicationAgentRuntime,
  authorizeEvent: assertMainRendererSender,
})
const unregisterApplicationSearchCredentialsIpc = registerApplicationSearchCredentialsIpc({
  ipcMain,
  searchCredentials: applicationSearchCredentials,
  authorizeEvent: assertMainRendererSender,
})
const unregisterApplicationVoiceCredentialsIpc = registerApplicationVoiceCredentialsIpc({
  ipcMain,
  voiceCredentials: applicationVoiceCredentials,
  authorizeEvent: assertMainRendererSender,
})
const applicationVoiceRuntime = new ApplicationVoiceRuntimeService({
  core: desktopCore,
  supervisor: workerSupervisor,
  exchangeRoot: voiceExchangeRoot,
  referenceRoot: path.join(app.getPath('userData'), 'uploaded_files'),
  readAsrSettings: () => readVoiceRuntimeSettings('asrSettings', 'ASR'),
  readTtsSettings: () => readVoiceRuntimeSettings('ttsSettings', 'TTS'),
})
const unregisterApplicationVoiceRuntimeIpc = registerApplicationVoiceRuntimeIpc({
  ipcMain,
  runtime: applicationVoiceRuntime,
  authorizeEvent: assertMainRendererSender,
})
const applicationVrmPresentationRuntime = new ApplicationVrmPresentationRuntimeService({
  getTargets: () => vrmWindows
    .filter((window) => window && !window.isDestroyed())
    .map((window) => window.webContents),
  readConfiguration: readVrmPresentationConfiguration,
})
const unregisterApplicationVrmPresentationIpc = registerApplicationVrmPresentationIpc({
  ipcMain,
  runtime: applicationVrmPresentationRuntime,
  authorizeEvent: assertMainRendererSender,
  authorizeVrmEvent: (event) => assertTrustedWindowSender(event, vrmWindows),
})
const applicationSystemRuntime = new ApplicationSystemRuntimeService({
  userDataDirectory: app.getPath('userData'),
  extensionDirectory: path.join(app.getPath('userData'), 'ext'),
  readSettings: () => applicationSettings.getSystemSettings().settings,
  /** 把规范代理同时应用到应用、主窗口和内置浏览器会话。 */
  applySessionProxy: async (configuration) => {
    const sessions = [
      session.defaultSession,
      session.fromPartition('persist:main-session'),
      session.fromPartition('persist:party-browser-session'),
    ]
    await Promise.all(sessions.map((targetSession) => targetSession.setProxy(configuration)))
    await Promise.all(sessions.map((targetSession) => targetSession.closeAllConnections()))
  },
  /** 交给 Electron 打开 Main 选择的固定目录。 */
  revealPath: (directoryPath) => shell.openPath(directoryPath),
  /** 停止持有旧代理环境的网络运行时，使下一次请求按需使用新环境启动。 */
  invalidateRuntimes: async () => {
    if (executionEngineSupervisor.getSnapshot().state !== 'stopped') {
      await executionEngineSupervisor.stop()
    }
    const networkCapabilities = new Set(['voice', 'connectors', 'live', 'mcp'])
    const activeCapabilities = workerSupervisor.listSnapshots()
      .filter((snapshot) => networkCapabilities.has(snapshot.capability) && snapshot.state !== 'stopped')
      .map((snapshot) => snapshot.capability)
    await Promise.all(activeCapabilities.map((capability) => workerSupervisor.stop(capability)))
    if (backendProcess && !backendProcess.killed) {
      await gracefulKillBackend()
    }
  },
  listNetworkInterfaces: () => os.networkInterfaces(),
})
const unregisterApplicationSystemRuntimeIpc = registerApplicationSystemRuntimeIpc({
  ipcMain,
  runtime: applicationSystemRuntime,
  authorizeEvent: assertMainRendererSender,
})
const unregisterApplicationMcpCredentialsIpc = registerApplicationMcpCredentialsIpc({
  ipcMain,
  mcpCredentials: applicationMcpCredentials,
  authorizeEvent: assertMainRendererSender,
})
const unregisterApplicationHttpToolCredentialsIpc = registerApplicationHttpToolCredentialsIpc({
  ipcMain,
  httpToolCredentials: applicationHttpToolCredentials,
  authorizeEvent: assertMainRendererSender,
})
const unregisterApplicationConnectorCredentialsIpc = registerApplicationConnectorCredentialsIpc({
  ipcMain,
  connectorCredentials: applicationConnectorCredentials,
  authorizeEvent: assertMainRendererSender,
})
const applicationConnectorRuntime = new ApplicationConnectorRuntimeService({
  core: desktopCore,
  supervisor: workerSupervisor,
  getBackendPort: () => PORT,
  waitForCredentialRefresh: () => connectorCredentialRuntimeInvalidation,
  logger: console,
})
const unregisterApplicationConnectorRuntimeIpc = registerApplicationConnectorRuntimeIpc({
  ipcMain,
  runtime: applicationConnectorRuntime,
  authorizeEvent: assertMainRendererSender,
})
const applicationLiveRuntime = new ApplicationLiveRuntimeService({
  core: desktopCore,
  supervisor: workerSupervisor,
  waitForCredentialRefresh: () => liveCredentialRuntimeInvalidation,
  logger: console,
})
const unregisterApplicationLiveRuntimeIpc = registerApplicationLiveRuntimeIpc({
  ipcMain,
  runtime: applicationLiveRuntime,
  authorizeEvent: assertMainRendererSender,
  getWebContents: getDesktopWebContents,
})
const applicationDesktopControlRuntime = new ApplicationDesktopControlRuntimeService({
  core: desktopCore,
  supervisor: workerSupervisor,
  logger: console,
})
const unregisterApplicationDesktopControlRuntimeIpc = registerApplicationDesktopControlRuntimeIpc({
  ipcMain,
  runtime: applicationDesktopControlRuntime,
  authorizeEvent: assertMainRendererSender,
})
const applicationToolchainRuntime = new ApplicationToolchainRuntimeService({ logger: console })
const unregisterApplicationToolchainRuntimeIpc = registerApplicationToolchainRuntimeIpc({
  ipcMain,
  runtime: applicationToolchainRuntime,
  authorizeEvent: assertMainRendererSender,
})
const applicationDeveloperWorkbenchRuntime = new ApplicationDeveloperWorkbenchRuntimeService({
  userDataDirectory: app.getPath('userData'),
  applicationName: app.getName(),
  applicationVersion: app.getVersion(),
  state: legacyRendererState,
  tasks: applicationTasks,
})
const unregisterApplicationDeveloperWorkbenchRuntimeIpc = registerApplicationDeveloperWorkbenchRuntimeIpc({
  ipcMain,
  runtime: applicationDeveloperWorkbenchRuntime,
  authorizeEvent: assertMainRendererSender,
  authorizeWorkspacePath: assertAuthorizedDeveloperWorkspacePath,
})
const applicationVrAssetRuntime = new ApplicationVrAssetRuntimeService({
  vrAssetRoot: getDesktopVrAssetRoot(),
  uploadRoot: path.join(app.getPath('userData'), 'uploaded_files'),
  state: legacyRendererState,
  cloudModelPaths: getApplicationCloudVrmModelPaths(),
  remoteBaseUrl: process.env.OPENXNET_VRM_RESOURCE_BASE_URL,
  fetch: fetchApplicationVrAsset,
  logger: console,
})
const unregisterApplicationVrAssetIpc = registerApplicationVrAssetIpc({
  ipcMain,
  runtime: applicationVrAssetRuntime,
  authorizeEvent: assertMainRendererSender,
})
const applicationExtensionRuntime = new ApplicationExtensionRuntimeService({
  extensionRoot: path.join(app.getPath('userData'), 'ext'),
  nodeExecutable: process.execPath,
  npmCliPath: resolveBundledNpmCliPath(),
  logger: console,
})
const unregisterApplicationExtensionRuntimeIpc = registerApplicationExtensionRuntimeIpc({
  ipcMain,
  runtime: applicationExtensionRuntime,
  authorizeEvent: assertMainRendererSender,
})
const persistedSkillWorkspaceDirectories = new Set()
const persistedSkillCliSettings = legacyRendererState.getSnapshot().settings.CLISettings
if (persistedSkillCliSettings && typeof persistedSkillCliSettings === 'object' && typeof persistedSkillCliSettings.cc_path === 'string') {
  const persistedWorkspaceDirectory = persistedSkillCliSettings.cc_path.trim()
  if (persistedWorkspaceDirectory && !persistedWorkspaceDirectory.includes('\u0000')) {
    persistedSkillWorkspaceDirectories.add(path.resolve(persistedWorkspaceDirectory))
  }
}

/**
 * 判断技能同步目录是否来自启动时持久化配置或本次原生目录授权。
 *
 * @param {string} workspaceDirectory Skill Runtime 已解析的 canonical 工作区。
 * @returns {boolean} 仅对已持久化或当前会话明确授权目录返回 true。
 */
function isAuthorizedSkillWorkspaceDirectory(workspaceDirectory) {
  const canonicalPath = path.resolve(workspaceDirectory)
  return persistedSkillWorkspaceDirectories.has(canonicalPath)
    || rendererGrantedDirectories.has(canonicalPath)
}

const applicationSkillRuntime = new ApplicationSkillRuntimeService({
  globalSkillsRoot: path.join(os.homedir(), '.agents', 'skills'),
  bundledSkillsRoot: app.isPackaged
    ? path.join(process.resourcesPath, 'skills')
    : path.join(__dirname, 'skills'),
  state: legacyRendererState,
  authorizeWorkspaceDirectory: isAuthorizedSkillWorkspaceDirectory,
  publishToMlopsRepository: publishApplicationSkillToMlopsRepository,
  logger: console,
})
const unregisterApplicationSkillRuntimeIpc = registerApplicationSkillRuntimeIpc({
  ipcMain,
  runtime: applicationSkillRuntime,
  authorizeEvent: assertMainRendererSender,
  revealDirectory: (directoryPath) => shell.openPath(directoryPath),
})
const applicationEnterpriseRuntime = new ApplicationEnterpriseRuntimeService({
  userDataDirectory: app.getPath('userData'),
  logger: console,
  /** 从 Main-owned 登录态生成稳定领导身份；无凭据和令牌会进入消息记录。 */
  resolveLeaderIdentity: () => {
    const profile = applicationAuth.getSession().authState.profile
    const subject = String(profile.id || profile.phone || profile.email || 'enterprise-leader').trim()
    return {
      id: `leader-${createHash('sha256').update(subject).digest('hex').slice(0, 16)}`,
      name: String(profile.name || profile.phone || '企业领导').trim() || '企业领导',
    }
  },
})
const unregisterApplicationEnterpriseRuntimeIpc = registerApplicationEnterpriseRuntimeIpc({
  ipcMain,
  runtime: applicationEnterpriseRuntime,
  authorizeEvent: assertMainRendererSender,
})

const applicationAgentTeamsRuntime = new ApplicationAgentTeamsRuntimeService({
  core: desktopCore,
  supervisor: workerSupervisor,
  logger: console,
})
const unregisterApplicationAgentTeamsRuntimeIpc = registerApplicationAgentTeamsRuntimeIpc({
  ipcMain,
  runtime: applicationAgentTeamsRuntime,
  authorizeEvent: assertMainRendererSender,
})

/**
 * 读取竞赛 Live Adapter 的已保存平台端点。
 *
 * @param {'aiops'|'dataops'|'mlops'} platform 固定平台键。
 * @returns {Promise<string>} 已校验的服务 URL；未配置时抛出固定错误。
 */
async function resolveCompetitionPlatformEndpoint(platform) {
  const environmentKey = `OPENXNET_${String(platform).toUpperCase()}_BASE_URL`
  const environmentEndpoint = String(process.env[environmentKey] || '').trim()
  if (environmentEndpoint) return environmentEndpoint
  const services = await applicationEnterpriseRuntime.listXnetServices()
  const endpoint = String(services.services[platform]?.url || '').trim()
  if (!endpoint) throw new Error(`Competition platform '${platform}' is not configured.`)
  return endpoint
}

/**
 * 为一次 XnetMLOps Skill 导入签发职责限定令牌。
 *
 * @param {object} publication Main 从本地 Skill 目录构造的候选包。
 * @param {string} subject 已认证企业账户主体。
 * @returns {string} 五分钟有效且绑定 Workspace、Skill 与摘要的 HS256 JWT。
 */
function createMlopsSkillRepositoryDelegationToken(publication, subject) {
  const secret = String(process.env.OPENXNET_AGENT_DELEGATION_SECRET || '').trim()
  if (secret.length < 32) throw new Error('MLOps skill repository signing secret is not configured.')
  /** 将委托 JWT 对象编码为无填充 base64url；输入普通对象，返回 UTF-8 编码段。 */
  const encode = (value) => Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')
  const issuedAt = Math.floor(Date.now() / 1000)
  const header = encode({ alg: 'HS256', typ: 'JWT' })
  const payload = encode({
    iss: 'openxnet-desktop',
    aud: 'openxnet-mlops-skill-registry',
    sub: subject,
    iat: issuedAt,
    exp: issuedAt + 300,
    scopes: ['mlops:skill:import'],
    workspace_id: String(publication.workspaceId),
    skill_id: String(publication.skillId),
    artifact_digest: String(publication.artifactDigest),
  })
  const signingInput = `${header}.${payload}`
  const signature = createHmac('sha256', secret).update(signingInput, 'utf8').digest('base64url')
  return `${signingInput}.${signature}`
}

/**
 * 解析 XnetMLOps 仓库导入地址；输入平台根 URL，返回固定 HTTPS API，非法协议时拒绝。
 *
 * @param {string} endpoint 已保存的 XnetMLOps 根地址。
 * @returns {string} 固定 OpenXnet Skill 导入端点。
 */
function resolveMlopsSkillRepositoryUrl(endpoint) {
  const parsed = new URL(String(endpoint || '').trim())
  const localDevelopment = parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost'
  if (parsed.protocol !== 'https:' && !(localDevelopment && parsed.protocol === 'http:')) {
    throw new Error('XnetMLOps skill repository requires HTTPS.')
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('XnetMLOps skill repository URL is invalid.')
  }
  parsed.pathname = `${parsed.pathname.replace(/\/+$/u, '')}/api/xaa/skills/import/openxnet`
  return parsed.toString()
}

/**
 * 把企业 Skill 候选上传到 XnetMLOps 草稿仓库。
 *
 * @param {object} publication 已校验并计算摘要的本地候选包。
 * @returns {Promise<{repositorySkillUid: string, repositoryStatus: 'draft'}>} MLOps 幂等导入回执。
 */
async function publishApplicationSkillToMlopsRepository(publication) {
  const subject = requireCompetitionSubject()
  const endpoint = resolveMlopsSkillRepositoryUrl(await resolveCompetitionPlatformEndpoint('mlops'))
  const token = createMlopsSkillRepositoryDelegationToken(publication, subject)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
        'Idempotency-Key': publication.artifactDigest,
        'X-Tenant-UID': publication.workspaceId,
        'X-User-ID': subject,
      },
      body: JSON.stringify({
        workspaceId: publication.workspaceId,
        skillId: publication.skillId,
        familyId: publication.familyId,
        name: publication.name,
        description: publication.description,
        version: publication.version,
        contentMd: publication.contentMd,
        manifestJson: publication.manifestJson,
        artifactDigest: publication.artifactDigest,
        lifecycleStatus: publication.lifecycleStatus,
        evidenceOrigin: publication.evidenceOrigin,
        environmentScope: publication.environmentScope,
        productionEligible: publication.productionEligible,
        files: publication.files,
      }),
    })
    const responseText = await response.text()
    if (Buffer.byteLength(responseText, 'utf8') > 2 * 1024 * 1024) {
      throw new Error('XnetMLOps skill repository response is too large.')
    }
    let payload
    try {
      payload = JSON.parse(responseText)
    } catch {
      throw new Error(`XnetMLOps skill repository returned HTTP ${response.status}.`)
    }
    if (!response.ok || Number(payload?.code) !== 0 || !payload?.data) {
      throw new Error(String(payload?.message || `XnetMLOps skill repository returned HTTP ${response.status}.`))
    }
    const repositorySkillUid = String(payload.data.uid || '').trim()
    const repositoryStatus = String(payload.data.status || '').trim()
    if (!repositorySkillUid || repositoryStatus !== 'draft') {
      throw new Error('XnetMLOps skill repository returned an invalid receipt.')
    }
    return { repositorySkillUid, repositoryStatus: 'draft' }
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * 读取平台受众限定的短期委托令牌；输入平台键，返回进程环境中的令牌且不写日志或 Renderer。
 *
 * @param {'aiops'|'dataops'|'mlops'} platform 固定平台键。
 * @param {object} request 已验证的单次工具请求。
 * @returns {Promise<string>} 五分钟有效、Workspace 与工具受限的委托 JWT。
 */
async function resolveCompetitionDelegationToken(platform, request) {
  const platformKey = `OPENXNET_${String(platform).toUpperCase()}_ADAPTER_TOKEN`
  const explicitToken = String(process.env[platformKey] || process.env.OPENXNET_COMPETITION_ADAPTER_TOKEN || '').trim()
  if (explicitToken) return explicitToken
  const secret = String(process.env.OPENXNET_AGENT_DELEGATION_SECRET || '').trim()
  if (secret.length < 32) throw new Error('Competition delegation signing secret is not configured.')
  /** 将平台 JWT 对象编码为无填充 base64url；输入普通对象，返回 UTF-8 编码段。 */
  const encode = (value) => Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')
  const issuedAt = Math.floor(Date.now() / 1000)
  const header = encode({ alg: 'HS256', typ: 'JWT' })
  const payload = encode({
    sub: String(request.actorId),
    aud: 'openxnet-agent-adapter',
    iat: issuedAt,
    exp: issuedAt + 300,
    workspace_id: String(request.workspaceId),
    tools: [String(request.toolName)],
  })
  const signingInput = `${header}.${payload}`
  const signature = createHmac('sha256', secret).update(signingInput, 'utf8').digest('base64url')
  return `${signingInput}.${signature}`
}

/** 读取竞赛专用 AgentTeams 隔离服务端点；无输入，返回配置地址，缺失时抛错。 */
async function resolveCompetitionAgentTeamsEndpoint() {
  const endpoint = String(process.env.OPENXNET_COMPETITION_AGENTTEAMS_BASE_URL || '').trim()
  if (!endpoint) throw new Error('Competition AgentTeams isolated endpoint is not configured.')
  return endpoint
}

/**
 * 签发 AgentTeams Team Prepare 或 Task Dispatch 的短期委托；输入固定请求范围，返回五分钟 HS256 JWT。
 *
 * @param {object} context Main 构建的 request/workspace/incident/trace/template 范围。
 * @returns {Promise<string>} 仅允许一个模板版本操作或单个阶段任务的受众限定委托令牌。
 */
async function resolveCompetitionAgentTeamsDelegationToken(context) {
  const secret = String(process.env.OPENXNET_AGENTTEAMS_DELEGATION_SECRET || '').trim()
  if (secret.length < 32) throw new Error('Competition AgentTeams delegation signing secret is not configured.')
  const subject = requireCompetitionSubject()
  /** 将 AgentTeams JWT 对象编码为无填充 base64url；输入普通对象，返回 UTF-8 编码段。 */
  const encode = (value) => Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')
  const issuedAt = Math.floor(Date.now() / 1000)
  const taskStage = typeof context.stage === 'string' ? context.stage : ''
  const header = encode({ alg: 'HS256', typ: 'JWT' })
  const payload = encode({
    iss: 'openxnet-desktop',
    aud: 'openxnet-agentteams-adapter',
    sub: subject,
    iat: issuedAt,
    exp: issuedAt + 300,
    scopes: [taskStage ? 'agentteams:task:dispatch' : 'agentteams:team:prepare'],
    request_id: String(context.requestId),
    workspace_id: String(context.workspaceId),
    incident_id: String(context.incidentId),
    trace_id: String(context.traceId),
    team_template_id: String(context.teamTemplateId),
    team_template_version: Number(context.teamTemplateVersion),
    ...(taskStage ? { team_name: String(context.teamName), stage: taskStage } : {}),
  })
  const signingInput = `${header}.${payload}`
  const signature = createHmac('sha256', secret).update(signingInput, 'utf8').digest('base64url')
  return `${signingInput}.${signature}`
}

/** 读取服务器审批发布端点；无输入，返回 HTTPS 根地址，缺失时抛错。 */
async function resolveCompetitionApprovalEndpoint() {
  const endpoint = String(process.env.OPENXNET_COMPETITION_APPROVAL_BASE_URL || '').trim()
  if (!endpoint) throw new Error('Competition approval endpoint is not configured.')
  return endpoint
}

/** 读取仅 Main 持有的审批签发令牌；无输入，返回令牌且不写日志或 Renderer。 */
async function resolveCompetitionApprovalIssuerToken() {
  return String(process.env.OPENXNET_APPROVAL_ISSUER_TOKEN || '').trim()
}

const competitionFixtureAdapter = new FixtureCompetitionToolAdapter()
const competitionLiveAdapter = new HttpCompetitionToolAdapter({
  resolveEndpoint: resolveCompetitionPlatformEndpoint,
  resolveDelegationToken: resolveCompetitionDelegationToken,
})
const competitionApprovalPublisher = new HttpCompetitionApprovalPublisher({
  resolveEndpoint: resolveCompetitionApprovalEndpoint,
  resolveIssuerToken: resolveCompetitionApprovalIssuerToken,
})
const competitionAgentTeamsAdapter = new HttpCompetitionAgentTeamsAdapter({
  resolveEndpoint: resolveCompetitionAgentTeamsEndpoint,
  resolveDelegationToken: resolveCompetitionAgentTeamsDelegationToken,
})

/** 构造企业群聊使用的神经符号操作事件；输入策略结果和业务字段，返回严格的结构化审计载荷。 */
function createEnterpriseOperationEvent(config) {
  return {
    operationId: String(config.operationId),
    authorityLevel: config.policy.authorityLevel,
    riskClass: config.policy.riskClass,
    evidenceGrade: config.policy.evidenceGrade,
    decision: config.decision || config.policy.decision,
    phase: config.phase,
    title: String(config.title),
    summary: String(config.summary),
    toolNames: Array.isArray(config.toolNames) ? [...config.toolNames] : [],
    skillName: config.skillName ? String(config.skillName) : null,
    targetResource: config.targetResource ? String(config.targetResource) : null,
    actionDigest: config.actionDigest ? String(config.actionDigest) : null,
    approvalId: config.approvalId ? String(config.approvalId) : null,
    invocationIds: Array.isArray(config.invocationIds) ? [...config.invocationIds] : [],
    evidenceIds: Array.isArray(config.evidenceIds) ? [...config.evidenceIds] : [],
    ruleCodes: [...config.policy.ruleCodes, ...(config.ruleCodes || [])],
    ruleReasons: [...config.policy.ruleReasons, ...(config.ruleReasons || [])],
    verificationSummary: config.verificationSummary ? String(config.verificationSummary) : null,
  }
}

/** 将 AgentTeams 阶段结果转换为产品级 NSX/RK/EV 操作事件；输入阶段上下文和可信回执，返回聊天操作卡载荷。 */
function buildCompetitionAgentOperation(input, task) {
  const isInvestigation = task.stage === 'INVESTIGATION_PLAN'
  const isVerification = task.stage === 'VERIFICATION_CONCLUSION'
  const evidenceGrade = isInvestigation ? 'EV-0' : (isVerification ? 'EV-3' : 'EV-2')
  const policy = evaluateApplicationNeuroSymbolicPolicy({
    operationKind: isInvestigation ? 'observe' : 'execute',
    environment: 'production',
    riskClass: isInvestigation ? 'RK-0' : 'RK-2',
    evidenceGrade,
    permissionGranted: true,
    reversible: true,
    hasRollbackPoint: !isInvestigation,
    hasResourceVersion: !isInvestigation,
    hasIdempotencyKey: !isInvestigation,
    certifiedSkill: false,
    delegatedAuthority: false,
    approvalGranted: isVerification,
  })
  const phase = isInvestigation
    ? 'PROPOSED'
    : isVerification
      ? (task.result.decision === 'CLOSE' ? 'SUCCEEDED' : 'FAILED')
      : 'AWAITING_APPROVAL'
  return createEnterpriseOperationEvent({
    operationId: task.taskId,
    policy,
    phase,
    title: isInvestigation
      ? '跨平台只读取证计划'
      : isVerification ? '独立验证生产变更' : '生产变更审批申请',
    summary: task.result.summary,
    toolNames: task.result.requestedToolNames.length > 0
      ? task.result.requestedToolNames
      : input.availableToolNames,
    skillName: task.result.skillName,
    targetResource: input.action?.actionId || null,
    actionDigest: task.result.outputDigest,
    approvalId: null,
    evidenceIds: task.result.evidenceIds,
    verificationSummary: isVerification ? task.result.summary : null,
  })
}

/** 将审批、执行和验证事件转换为产品级 NSX/RK/EV 操作事件；输入通用投影，返回聊天操作卡载荷。 */
function buildCompetitionGovernanceOperation(event) {
  const isRehearsal = event.eventType === 'REHEARSAL_SUCCEEDED'
  const isVerification = event.eventType === 'VERIFICATION_SUCCEEDED' || event.eventType === 'VERIFICATION_FAILED'
  const approvalGranted = !['APPROVAL_REQUESTED', 'APPROVAL_REJECTED'].includes(event.eventType)
  const policy = evaluateApplicationNeuroSymbolicPolicy({
    operationKind: isRehearsal ? 'rehearse' : 'execute',
    environment: isRehearsal ? 'staging' : 'production',
    riskClass: isRehearsal ? 'RK-1' : 'RK-2',
    evidenceGrade: isVerification ? 'EV-3' : 'EV-2',
    permissionGranted: true,
    reversible: true,
    hasRollbackPoint: true,
    hasResourceVersion: true,
    hasIdempotencyKey: true,
    certifiedSkill: false,
    delegatedAuthority: false,
    approvalGranted,
  })
  const phases = {
    APPROVAL_REQUESTED: 'AWAITING_APPROVAL',
    APPROVAL_APPROVED: 'APPROVED',
    APPROVAL_REJECTED: 'REJECTED',
    REHEARSAL_SUCCEEDED: 'SUCCEEDED',
    ACTION_EXECUTING: 'EXECUTING',
    VERIFICATION_SUCCEEDED: 'SUCCEEDED',
    VERIFICATION_FAILED: 'FAILED',
  }
  const titles = {
    APPROVAL_REQUESTED: '等待生产变更审批',
    APPROVAL_APPROVED: '生产变更审批已通过',
    APPROVAL_REJECTED: '生产变更审批已拒绝',
    REHEARSAL_SUCCEEDED: '隔离预检已完成',
    ACTION_EXECUTING: '生产变更正在执行',
    VERIFICATION_SUCCEEDED: '独立验证已经通过',
    VERIFICATION_FAILED: '独立验证未通过',
  }
  const rejected = event.eventType === 'APPROVAL_REJECTED' || event.eventType === 'VERIFICATION_FAILED'
  const displayPolicy = rejected
    ? { ...policy, decision: 'DENY', ruleCodes: [], ruleReasons: [] }
    : policy
  return createEnterpriseOperationEvent({
    operationId: event.operationId,
    policy: displayPolicy,
    phase: phases[event.eventType],
    title: titles[event.eventType],
    summary: event.summary,
    toolNames: [event.toolName],
    targetResource: event.targetResource,
    approvalId: event.approvalId,
    evidenceIds: event.evidenceIds,
    ruleCodes: rejected ? [event.eventType] : [],
    ruleReasons: rejected ? [event.summary] : [],
    verificationSummary: isVerification ? event.summary : null,
  })
}

/**
 * 把真实 AgentTeams 路由和执行回执投影到企业协作群。
 *
 * @param {object} input AgentTeams 阶段输入，包含 Workspace、Trace 和团队绑定。
 * @param {object} task 已完成且通过身份校验的 AgentTeams 任务回执。
 * @returns {Promise<void>} 消息写入完成；投影失败仅记录诊断，不反向伪造或改变任务结果。
 */
async function recordCompetitionAgentTeamConversation(input, task) {
  try {
    if (task.route) {
      await applicationEnterpriseRuntime.recordTrustedMessage({
        workspaceId: input.incident.workspaceId,
        taskId: task.taskId,
        traceId: input.traceId,
        senderType: 'agent',
        senderId: task.route.leaderRoleCardId,
        senderName: task.route.leaderName,
        recipientIds: [task.route.assigneeRoleCardId],
        content: `已分派 ${task.stage} 阶段任务，任务摘要 ${task.route.taskBriefDigest.slice(0, 12)}。`,
      })
    }
    await applicationEnterpriseRuntime.recordTrustedMessage({
      workspaceId: input.incident.workspaceId,
      taskId: task.taskId,
      traceId: input.traceId,
      senderType: 'agent',
      senderId: task.result.roleCardId,
      senderName: task.result.agentName,
      content: task.result.summary,
      operation: buildCompetitionAgentOperation(input, task),
      status: 'delivered',
    })
  } catch (error) {
    console.warn('AgentTeams enterprise conversation projection failed; the task result remains unchanged.', error)
  }
}

/** 把治理状态变化投影为系统操作卡；输入审批、执行或验证事件，无返回。 */
async function recordCompetitionOperationConversation(event) {
  const operation = buildCompetitionGovernanceOperation(event)
  await applicationEnterpriseRuntime.recordTrustedMessage({
    workspaceId: event.workspaceId,
    taskId: event.actionId || event.approvalId || event.operationId,
    traceId: event.traceId,
    senderType: 'system',
    senderId: 'openxnet-governance',
    senderName: 'OpenXnet Governance',
    content: event.summary,
    operation,
    status: event.eventType === 'VERIFICATION_FAILED' ? 'failed' : 'delivered',
  })
}

const applicationCompetitionRuntime = new ApplicationCompetitionRuntimeService({
  userDataDirectory: app.getPath('userData'),
  fixtureAdapter: competitionFixtureAdapter,
  liveAdapter: competitionLiveAdapter,
  publishApproval: (approval) => competitionApprovalPublisher.publish(approval),
  resolveTeamTemplate: (teamTemplateId) => applicationEnterpriseRuntime.resolveTeamTemplate(teamTemplateId),
  agentTeamsIsolatedServiceEnabled: process.env.OPENXNET_COMPETITION_AGENTTEAMS_ISOLATED_SERVICE_ENABLED === '1',
  prepareAgentTeam: (incident, traceId, teamTemplate) => competitionAgentTeamsAdapter.prepare(incident, traceId, teamTemplate),
  dispatchAgentTeamTask: (input) => competitionAgentTeamsAdapter.dispatch(input),
  /** 把竞赛 Runtime 已接受的 AgentTeams 回执写入企业协作轨迹。 */
  recordAgentTeamConversation: (input, task) => recordCompetitionAgentTeamConversation(input, task),
  /** 把审批、执行和验证状态写入企业协作轨迹。 */
  recordOperationConversation: (event) => recordCompetitionOperationConversation(event),
  synchronizeKnowledge: (projection) => applicationEnterpriseInsightsRuntime.synchronizeCompetitionKnowledge(projection),
  purgeKnowledge: (request) => applicationEnterpriseInsightsRuntime.purgeCompetitionKnowledge(request),
  /** 将竞赛复盘结晶到全局技能目录，并在事件所属企业空间中启用。 */
  publishRetrospectiveSkill: async (request) => {
    const writeResult = await applicationSkillRuntime.crystallizeSkill({
      name: request.name,
      skillId: request.skillId,
      description: request.description,
      triggerContext: request.triggerContext,
      workflow: request.workflow,
      notes: request.notes,
      requiredCapabilities: request.requiredCapabilities,
      verification: request.verification,
      rollback: request.rollback,
      examples: [],
      counterExamples: [],
      sourceEventIds: request.sourceEventIds,
      status: 'candidate',
      source: 'rehearsal',
      familyId: request.familyId,
      problemFingerprint: request.problemFingerprint,
      evidenceOrigin: request.evidenceOrigin,
      derivationMethod: request.derivationMethod,
      environmentScope: request.environmentScope,
      strategies: [{
        strategyId: `retrospective-${request.skillId}`,
        name: request.name,
        workflow: String(request.workflow || '').split(/\r?\n/u).filter(Boolean),
        toolChain: request.requiredCapabilities,
        riskLevel: 'medium',
        costScore: 0,
        sourceEventIds: request.sourceEventIds,
      }],
      certifications: [{
        scope: request.environmentScope,
        status: 'candidate',
        evidenceEventIds: request.sourceEventIds,
      }],
      syncToProject: false,
      overwrite: true,
    })
    const skillId = String(writeResult.installedIds[0] || request.skillId)
    await applicationEnterpriseRuntime.setSkillBinding({
      workspaceId: request.workspaceId,
      skillId,
      enabled: false,
      sourceIncidentId: request.incidentId,
    })
    return { skillId }
  },
  logger: console,
})

/**
 * 要求 Main 持有有效企业账号；无输入，返回账户主体，未登录或无企业权限时拒绝。
 *
 * @returns {string} 已认证企业账户主体。
 */
function requireCompetitionSubject() {
  const snapshot = applicationAuth.getSession()
  const state = snapshot.authState
  const subject = resolveApplicationAuthProfileSubject(state.profile)
  if (state.status === 'guest' || !state.enterpriseAccess || !subject) {
    throw new Error('Enterprise competition access requires an authenticated enterprise account.')
  }
  return subject
}

/**
 * 从 Main 持有的企业登录会话生成职责限定主体，Renderer 不能提交或覆盖该身份。
 *
 * @param {'investigator'|'approver'|'operator'|'verifier'} role 固定竞赛职责。
 * @returns {string} 账户摘要与职责组成的有界 actorId。
 */
function resolveCompetitionActorId(role) {
  const subject = requireCompetitionSubject()
  const subjectDigest = createHash('sha256').update(subject, 'utf8').digest('hex').slice(0, 24)
  return `enterprise-${subjectDigest}:${role}`
}

/**
 * 同时验证主 Renderer 和企业账号访问权；输入 IPC 事件，无返回，任一条件失败时拒绝。
 *
 * @param {object} event Electron IPC 事件。
 * @returns {void}
 */
function assertCompetitionRendererSender(event) {
  assertMainRendererSender(event)
  requireCompetitionSubject()
}

const unregisterApplicationCompetitionRuntimeIpc = registerApplicationCompetitionRuntimeIpc({
  ipcMain,
  runtime: applicationCompetitionRuntime,
  authorizeEvent: assertCompetitionRendererSender,
  resolveActorId: resolveCompetitionActorId,
})
const applicationRecallRuntime = new ApplicationRecallRuntimeService({
  core: desktopCore,
  supervisor: workerSupervisor,
  getScope: readRecallRuntimeScope,
  publishObservationFocus: publishRecallObservationFocus,
  logger: console,
})
const unregisterApplicationRecallRuntimeIpc = registerApplicationRecallRuntimeIpc({
  ipcMain,
  runtime: applicationRecallRuntime,
  authorizeEvent: assertMainRendererSender,
})
const applicationMemoryManagementRuntime = new ApplicationMemoryManagementRuntimeService({
  core: desktopCore,
  supervisor: workerSupervisor,
  userDataDirectory: app.getPath('userData'),
  logger: console,
})
const unregisterApplicationMemoryManagementIpc = registerApplicationMemoryManagementIpc({
  ipcMain,
  runtime: applicationMemoryManagementRuntime,
  authorizeEvent: assertMainRendererSender,
})
const applicationMcpRuntime = new ApplicationMcpRuntimeService({
  core: desktopCore,
  supervisor: workerSupervisor,
  waitForCredentialRefresh: () => mcpCredentialRuntimeInvalidation,
  logger: console,
})
const unregisterApplicationMcpRuntimeIpc = registerApplicationMcpRuntimeIpc({
  ipcMain,
  runtime: applicationMcpRuntime,
  authorizeEvent: assertMainRendererSender,
})
const unregisterApplicationTelegramCredentialsIpc = registerApplicationTelegramCredentialsIpc({
  ipcMain,
  telegramCredentials: applicationTelegramCredentials,
  authorizeEvent: assertMainRendererSender,
})
const unregisterApplicationImageHostCredentialsIpc = registerApplicationImageHostCredentialsIpc({
  ipcMain,
  imageHostCredentials: applicationImageHostCredentials,
  authorizeEvent: assertMainRendererSender,
})
const unregisterApplicationRepositoryCredentialsIpc = registerApplicationRepositoryCredentialsIpc({
  ipcMain,
  repositoryCredentials: applicationRepositoryCredentials,
  authorizeEvent: assertMainRendererSender,
})
const unregisterApplicationLivePlatformCredentialsIpc = registerApplicationLivePlatformCredentialsIpc({
  ipcMain,
  livePlatformCredentials: applicationLivePlatformCredentials,
  authorizeEvent: assertMainRendererSender,
})
const unregisterApplicationCodeSandboxCredentialsIpc = registerApplicationCodeSandboxCredentialsIpc({
  ipcMain,
  codeSandboxCredentials: applicationCodeSandboxCredentials,
  authorizeEvent: assertMainRendererSender,
})
const unregisterApplicationHomeAssistantCredentialsIpc = registerApplicationHomeAssistantCredentialsIpc({
  ipcMain,
  homeAssistantCredentials: applicationHomeAssistantCredentials,
  authorizeEvent: assertMainRendererSender,
})
const unregisterApplicationSqlCredentialsIpc = registerApplicationSqlCredentialsIpc({
  ipcMain,
  sqlCredentials: applicationSqlCredentials,
  authorizeEvent: assertMainRendererSender,
})
const unregisterApplicationComfyUiCredentialsIpc = registerApplicationComfyUiCredentialsIpc({
  ipcMain,
  comfyUiCredentials: applicationComfyUiCredentials,
  authorizeEvent: assertMainRendererSender,
})
const unregisterApplicationDeliveryCredentialsIpc = registerApplicationDeliveryCredentialsIpc({
  ipcMain,
  deliveryCredentials: applicationDeliveryCredentials,
  authorizeEvent: assertMainRendererSender,
})
const unregisterApplicationArtifactsIpc = registerApplicationArtifactsIpc({
  ipcMain,
  artifacts: applicationArtifacts,
  authorizeEvent: assertMainRendererSender,
  authorizeImportPath: assertAuthorizedArtifactImportPath,
})
const unregisterApplicationTasksIpc = registerApplicationTasksIpc({
  ipcMain,
  tasks: applicationTasks,
  authorizeEvent: assertMainRendererSender,
})
const unregisterLegacyRendererStateIpc = registerLegacyRendererStateIpc({
  ipcMain,
  state: legacyRendererState,
  authorizeEvent: assertMainRendererSender,
  getWebContents: getDesktopWebContents,
})
const applicationTaskExecution = new ApplicationTaskExecutionService({
  core: desktopCore,
  supervisor: workerSupervisor,
  tasks: applicationTasks,
  getBrokerOrigin: () => {
    if (!taskExecutionBrokerGateway) {
      throw new Error('Task Execution Broker Gateway is not ready.')
    }
    return taskExecutionBrokerGateway.origin
  },
  logger: console,
})
const unregisterApplicationTaskExecutionIpc = registerApplicationTaskExecutionIpc({
  ipcMain,
  execution: applicationTaskExecution,
  authorizeEvent: assertMainRendererSender,
  getWebContents: getDesktopWebContents,
})
const unregisterDesktopBootstrapIpc = registerDesktopBootstrapIpc({
  ipcMain,
  core: desktopCore,
  settings: applicationSettings,
  authorizeEvent: assertMainRendererSender,
  getApplication: getDesktopBootstrapApplication,
})

function monitorBrokenPipe(stream) {
  if (!stream || typeof stream.on !== 'function') return;
  stream.on('error', (error) => {
    if (error && error.code === 'EPIPE') {
      brokenPipeStreams.add(stream);
      return;
    }
    console.error('stdio stream error:', error);
  });
}

function safeProcessWrite(stream, chunk) {
  if (!stream || typeof stream.write !== 'function' || brokenPipeStreams.has(stream)) {
    return false;
  }
  try {
    stream.write(chunk);
    return true;
  } catch (error) {
    if (error && error.code === 'EPIPE') {
      brokenPipeStreams.add(stream);
      return false;
    }
    throw error;
  }
}

monitorBrokenPipe(process.stdout);
monitorBrokenPipe(process.stderr);

function appendLogToBuffer(source, data) {
  const timestamp = new Date().toLocaleTimeString();
  const lines = data.toString().split(/\r?\n/);

  lines.forEach(line => {
    if (line.trim()) {
      logBuffer.push(`[${timestamp}] [${source}] ${line}`);
    }
  });

  // 清理旧日志，防止内存无限增长
  if (logBuffer.length > MAX_LOG_LINES) {
    logBuffer = logBuffer.slice(logBuffer.length - MAX_LOG_LINES);
  }
}

/**
 * Validate and normalize a Renderer-provided screenshot rectangle.
 *
 * @param {unknown} value Candidate rectangle.
 * @returns {{x: number, y: number, width: number, height: number}} Bounded rectangle.
 */
function sanitizeDesktopCropRect(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('A screenshot rectangle is required.')
  }
  const rect = value
  const fields = ['x', 'y', 'width', 'height']
  if (fields.some((field) => typeof rect[field] !== 'number' || !Number.isFinite(rect[field]))) {
    throw new Error('Screenshot rectangle fields must be finite numbers.')
  }
  const normalized = {
    x: Math.floor(rect.x),
    y: Math.floor(rect.y),
    width: Math.floor(rect.width),
    height: Math.floor(rect.height),
  }
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().bounds
  if (
    normalized.x < 0
    || normalized.y < 0
    || normalized.width <= 0
    || normalized.height <= 0
    || normalized.x + normalized.width > screenWidth
    || normalized.y + normalized.height > screenHeight
  ) {
    throw new Error('Screenshot rectangle is outside the primary display.')
  }
  return normalized
}

/**
 * Convert a Renderer binary payload into a bounded Node.js Buffer.
 *
 * @param {unknown} value Renderer binary payload.
 * @returns {Buffer} Validated non-empty buffer.
 */
function toBoundedRendererBuffer(value) {
  let buffer
  if (Buffer.isBuffer(value)) {
    buffer = value
  } else if (value instanceof ArrayBuffer) {
    buffer = Buffer.from(value)
  } else if (ArrayBuffer.isView(value)) {
    buffer = Buffer.from(value.buffer, value.byteOffset, value.byteLength)
  } else {
    throw new Error('A binary screenshot payload is required.')
  }
  if (buffer.byteLength === 0 || buffer.byteLength > MAX_SCREENSHOT_BUFFER_BYTES) {
    throw new Error('Screenshot payload exceeds the allowed size.')
  }
  return buffer
}

/**
 * Fetch and decode one bounded HTTP(S) image for a native context-menu action.
 *
 * @param {string} source Validated network image URL.
 * @returns {Promise<{buffer: Buffer, image: Electron.NativeImage}>} Image bytes and decoded image.
 */
async function fetchBoundedContextImage(source) {
  const response = await fetch(source)
  if (!response.ok) throw new Error(`Image request failed with HTTP ${response.status}.`)
  assertSafeDownloadUrl(response.url)
  const declaredLength = Number(response.headers.get('content-length') || 0)
  if (declaredLength > MAX_SCREENSHOT_BUFFER_BYTES) {
    throw new Error('Image response exceeds the allowed size.')
  }
  if (!response.body) throw new Error('Image response body is unavailable.')
  const reader = response.body.getReader()
  const chunks = []
  let totalBytes = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    totalBytes += value.byteLength
    if (totalBytes > MAX_SCREENSHOT_BUFFER_BYTES) {
      await reader.cancel()
      throw new Error('Image response exceeds the allowed size.')
    }
    chunks.push(Buffer.from(value))
  }
  const buffer = toBoundedRendererBuffer(Buffer.concat(chunks, totalBytes))
  const image = nativeImage.createFromBuffer(buffer)
  if (image.isEmpty()) throw new Error('Image response is invalid.')
  return { buffer, image }
}

/**
 * Capture and crop the primary display to a validated rectangle.
 *
 * @param {unknown} rect Candidate crop rectangle.
 * @returns {Promise<Buffer>} Cropped PNG buffer.
 */
async function cropDesktop(rect) {
  const normalizedRect = sanitizeDesktopCropRect(rect)

  const { width, height } = screen.getPrimaryDisplay().bounds
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width, height }
  })
  if (!sources.length) throw new Error('无法获取屏幕源')

  // 1. 拿到全屏 PNG 缓冲区
  const pngBuffer = sources[0].thumbnail.toPNG()

  // 2. 用 Electron 自带的 nativeImage 裁
  const img  = nativeImage.createFromBuffer(pngBuffer)
  const cropped = img.crop({
    x: normalizedRect.x,
    y: normalizedRect.y,
    width: normalizedRect.width,
    height: normalizedRect.height,
  })

  // 3. 直接返回 Buffer，下游无需改
  return cropped.toPNG()
}

// ★ 替换原来的 startVMCReceiver
async function startVMCReceiver(cfg) {
  if (vmcReceiverActive && vmcUdpPort) {
    return global.vmcCfg?.receive?.port || cfg?.receive?.port
  }

  const requestedPort = Number(cfg?.receive?.port) || 39539
  const reservedPorts = [Number(cfg?.send?.port)].filter(Boolean)
  const resolvedPort = await resolvePreferredVmcReceivePort('0.0.0.0', requestedPort, reservedPorts)

  return await new Promise((resolve, reject) => {
    const nextPort = new osc.UDPPort({
      localAddress: '0.0.0.0',
      localPort: resolvedPort,
      metadata: true,
    })

    const handleMessage = (oscMsg) => {
      /* -------- 1. 骨骼 -------- */
      if (oscMsg.address === '/VMC/Ext/Bone/Pos') {
        if (!Array.isArray(oscMsg.args) || oscMsg.args.length < 8) return;
        const [boneName, x, y, z, qx, qy, qz, qw] = oscMsg.args.map(v => v.value ?? v);
        if (typeof boneName !== 'string') return;

        vrmWindows.forEach(w => {
          if (!w.isDestroyed()) {
            w.webContents.send('vmc-bone', { boneName, position:{x,y,z}, rotation:{x:qx,y:qy,z:qz,w:qw} });
            w.webContents.send('vmc-osc-raw', oscMsg);
          }
        });
        return;
      }

      /* -------- 2. 表情 -------- */
      if (oscMsg.address === '/VMC/Ext/Blend/Val') {
        if (!Array.isArray(oscMsg.args) || oscMsg.args.length < 2) return;
        vrmWindows.forEach(w => {
          if (!w.isDestroyed()) w.webContents.send('vmc-osc-raw', oscMsg);
        });
        return;
      }

      /* -------- 3. 表情 Apply -------- */
      if (oscMsg.address === '/VMC/Ext/Blend/Apply') {
        // Apply 不带参数，长度 0 也合法
        vrmWindows.forEach(w => {
          if (!w.isDestroyed()) w.webContents.send('vmc-osc-raw', oscMsg);
        });
      }
    }

    const cleanupStartupListeners = () => {
      nextPort.removeListener('ready', handleReady)
      nextPort.removeListener('error', handleStartupError)
    }

    const handleStartupError = (error) => {
      cleanupStartupListeners()
      try {
        nextPort.close()
      } catch (_) {}
      reject(error)
    }

    const handleRuntimeError = (error) => {
      console.error('[VMC] UDP receiver error:', error)
      stopVMCReceiver()
    }

    const handleReady = () => {
      cleanupStartupListeners()
      vmcUdpPort = nextPort
      vmcReceiverActive = true
      const actualPort = vmcUdpPort.socket?.address?.().port || resolvedPort || requestedPort
      cfg.receive.port = actualPort
      vmcUdpPort.on('message', handleMessage)
      vmcUdpPort.on('error', handleRuntimeError)
      console.log(`[VMC] 接收已启动 @ ${actualPort}`)
      resolve(actualPort)
    }

    nextPort.once('ready', handleReady)
    nextPort.once('error', handleStartupError)
    nextPort.open()
  })
}

function stopVMCReceiver() {
  if (!vmcReceiverActive || !vmcUdpPort) return;
  try {
    vmcUdpPort.close();
  } catch (error) {
    console.warn('[VMC] 接收关闭时出现异常:', error)
  }
  vmcUdpPort = null;
  vmcReceiverActive = false;
  console.log('[VMC] 接收已停止');
}

// 发送 VMC Bone -------------------------------------------------
function sendVMCBoneMain(data) {
  if (!data) return;
  const { boneName, position, rotation } = data;
  if (!boneName || !position || !rotation) return;

  const { host, port } = global.vmcCfg.send;          // ← 面板配置
  const oscMsg = osc.writePacket({
    address: `/VMC/Ext/Bone/Pos`,
    args: [
      { type: 's', value: boneName },
      { type: 'f', value: position.x || 0 },
      { type: 'f', value: position.y || 0 },
      { type: 'f', value: position.z || 0 },
      { type: 'f', value: rotation.x || 0 },
      { type: 'f', value: rotation.y || 0 },
      { type: 'f', value: rotation.z || 0 },
      { type: 'f', value: rotation.w || 1 },
    ],
  });
  vmcSendSocket.send(oscMsg, port, host, (err) => {
    if (err) console.error('VMC send error:', err);
  });
}

// 发送 VMC Blend ------------------------------------------------
function sendVMCBlendMain(data) {
  if (!data) return;
  const { blendName, weight } = data;
  if (typeof blendName !== 'string' || typeof weight !== 'number') return;

  const { host, port } = global.vmcCfg.send;          // ← 面板配置
  const oscMsg = osc.writePacket({
    address: '/VMC/Ext/Blend/Val',
    args: [
      { type: 's', value: blendName },
      { type: 'f', value: Math.max(0, Math.min(1, weight)) },
    ],
  });
  vmcSendSocket.send(oscMsg, port, host, (err) => {
    if (err) console.error('VMC blend send error:', err);
  });
}

// 发送 VMC Blend Apply ------------------------------------------
function sendVMCBlendApplyMain() {
  const { host, port } = global.vmcCfg.send;          // ← 面板配置
  const oscMsg = osc.writePacket({
    address: '/VMC/Ext/Blend/Apply',
    args: [],
  });
  vmcSendSocket.send(oscMsg, port, host);
}

let isQuitting = false;
let isInstallingUpdate = false;
let backendRestartAttempted = false;

/**
 * Resolve the development Python interpreter without changing packaged execution.
 *
 * @returns {string} Absolute configured interpreter or the project virtual environment.
 */
function resolveDevelopmentPythonExecutable() {
  const configuredExecutable = String(process.env.OPENXNET_PYTHON_EXECUTABLE || '').trim()
  if (!app.isPackaged && configuredExecutable) {
    return path.resolve(configuredExecutable)
  }
  return os.platform() === 'win32'
    ? path.join('.venv', 'Scripts', 'python.exe')
    : path.join('.venv', 'bin', 'python3')
}

const pythonExec = resolveDevelopmentPythonExecutable()

/**
 * Build one on-demand Execution Engine process launch for development or packaging.
 *
 * @returns {{command: string, arguments: string[], workingDirectory: string, environment: object}} Engine launch definition.
 */
function createExecutionEngineLaunch() {
  legacyRendererState.getSnapshot()
  const environment = {
    ...process.env,
    NODE_ENV: app.isPackaged ? 'production' : 'development',
    PYTHONIOENCODING: 'utf-8',
    PYTHONUTF8: '1',
    PYTHONUNBUFFERED: '1',
    OPENXNET_APP_NAME: OPENXNET_APP_NAME,
    OPENXNET_RUNTIME_ROLE: 'execution-engine',
    OPENXNET_USER_DATA_DIR: app.getPath('userData'),
    OPENXNET_STATIC_DIR: getDesktopStaticRoot(),
    OPENXNET_VRM_DIR: getDesktopVrAssetRoot(),
    OPENXNET_FEATURE_PACK_ROOT: process.env.OPENXNET_FEATURE_PACK_ROOT
      || path.join(app.getPath('userData'), 'feature-packs'),
    OPENXNET_GITNEXUS_RUNTIME_CONFIG: gitNexusRuntimeConfigPath,
    OPENXNET_WORKER_RPC_ORIGIN: workerRpcGateway ? workerRpcGateway.origin : '',
    OPENXNET_WORKER_RPC_TOKEN: workerRpcToken,
    OPENXNET_TASK_RPC_TOKEN: taskRpcToken,
    OPENXNET_VOICE_EXCHANGE_DIR: voiceExchangeRoot,
    OPENXNET_ASR_MODEL_DIR: asrModelRoot,
    OPENXNET_VECTOR_EXCHANGE_DIR: vectorExchangeRoot,
    OPENXNET_EMBEDDING_MODEL_DIR: embeddingModelRoot,
    OPENXNET_DOCUMENT_EXCHANGE_DIR: documentExchangeRoot,
    ...getMcpToolBrokerRuntimeEnvironment(),
    OPENXNET_PROVIDER_CREDENTIALS_B64: applicationProviders.getRuntimeCredentialBootstrap(),
    OPENXNET_SEARCH_CREDENTIALS_B64: applicationSearchCredentials.getRuntimeCredentialBootstrap(),
    OPENXNET_HTTP_TOOL_CREDENTIALS_B64: applicationHttpToolCredentials.getRuntimeCredentialBootstrap(),
    OPENXNET_TELEGRAM_CREDENTIALS_B64: applicationTelegramCredentials.getRuntimeCredentialBootstrap(),
    OPENXNET_CODE_SANDBOX_CREDENTIALS_B64: applicationCodeSandboxCredentials.getRuntimeCredentialBootstrap(),
    OPENXNET_COMFYUI_CREDENTIALS_B64: applicationComfyUiCredentials.getRuntimeCredentialBootstrap(),
    ...(app.isPackaged ? { OPENXNET_PUBLIC_RELEASE_SANITIZE: '1' } : {}),
  }
  if (!app.isPackaged) {
    return {
      command: path.resolve(__dirname, pythonExec),
      arguments: ['-u', 'server.py', '--host', '127.0.0.1', '--port', '0'],
      workingDirectory: __dirname,
      environment,
    }
  }
  const executable = path.join(
    process.resourcesPath,
    'server',
    process.platform === 'win32' ? 'execution-engine.exe' : 'execution-engine',
  )
  return {
    command: executable,
    arguments: ['--host', '127.0.0.1', '--port', '0'],
    workingDirectory: path.dirname(executable),
    environment,
  }
}

executionEngineSupervisor = new ExecutionEngineSupervisor({
  token: taskRpcToken,
  createLaunch: createExecutionEngineLaunch,
  startupTimeoutMs: 120_000,
  shutdownTimeoutMs: 10_000,
  idleTimeoutMs: 5 * 60_000,
})
const unregisterExecutionEngineCapability = registerExecutionEngineCapability({
  core: desktopCore,
  supervisor: executionEngineSupervisor,
})
workerCapabilityUnsubscribers.push(unregisterExecutionEngineCapability)

desktopCore.registerActivator('chat', async () => ({
  transport: 'typed-ipc',
  providerRuntime: 'execution-engine',
  activation: 'request-leased',
}))

const applicationChat = new ApplicationChatService({
  token: taskRpcToken,
  acquireEngine: acquireApplicationChatEngine,
})
const unregisterApplicationChatIpc = registerApplicationChatIpc({
  ipcMain,
  chat: applicationChat,
  authorizeEvent: assertMainRendererSender,
  getWebContents: getDesktopWebContents,
})
const applicationKnowledgeBaseRuntime = new ApplicationKnowledgeBaseRuntimeService({
  token: taskRpcToken,
  acquireEngine: acquireApplicationKnowledgeBaseEngine,
})
const unregisterApplicationKnowledgeBaseRuntimeIpc = registerApplicationKnowledgeBaseRuntimeIpc({
  ipcMain,
  runtime: applicationKnowledgeBaseRuntime,
  authorizeEvent: assertMainRendererSender,
})
const applicationEnterpriseInsightsRuntime = new ApplicationEnterpriseInsightsRuntimeService({
  userDataDirectory: app.getPath('userData'),
  token: taskRpcToken,
  acquireEngine: acquireApplicationEnterpriseInsightsEngine,
  logger: console,
})
const unregisterApplicationEnterpriseInsightsRuntimeIpc = registerApplicationEnterpriseInsightsRuntimeIpc({
  ipcMain,
  runtime: applicationEnterpriseInsightsRuntime,
  authorizeEvent: assertMainRendererSender,
})
const applicationKernelRuntime = new ApplicationKernelRuntimeService({
  token: taskRpcToken,
  acquireEngine: acquireApplicationKernelEngine,
})
const unregisterApplicationKernelRuntimeIpc = registerApplicationKernelRuntimeIpc({
  ipcMain,
  runtime: applicationKernelRuntime,
  authorizeEvent: assertMainRendererSender,
})
const applicationModelAssetRuntime = new ApplicationModelAssetRuntimeService({
  modelRoots: { sherpa: asrModelRoot, minilm: embeddingModelRoot },
  prepareMutation: prepareApplicationModelAssetMutation,
  logger: console,
})
const unregisterApplicationModelAssetIpc = registerApplicationModelAssetIpc({
  ipcMain,
  runtime: applicationModelAssetRuntime,
  authorizeEvent: assertMainRendererSender,
  getWebContents: getDesktopWebContents,
})

const taskWorkerExecutable = app.isPackaged
  ? path.join(
      process.resourcesPath,
      'server',
      process.platform === 'win32' ? 'task-worker.exe' : 'task-worker',
    )
  : path.resolve(__dirname, pythonExec)
const unregisterTaskWorkerCapability = registerWorkerCapability({
  core: desktopCore,
  supervisor: workerSupervisor,
  definition: {
    capability: 'tasks',
    command: taskWorkerExecutable,
    arguments: app.isPackaged ? [] : ['-m', 'py.workers.task_execution_worker'],
    workingDirectory: app.isPackaged ? path.dirname(taskWorkerExecutable) : __dirname,
    environment: {
      PYTHONIOENCODING: 'utf-8',
      PYTHONUTF8: '1',
      OPENXNET_APP_NAME: OPENXNET_APP_NAME,
      OPENXNET_RUNTIME_ROLE: 'task-worker',
      OPENXNET_USER_DATA_DIR: app.getPath('userData'),
      OPENXNET_TASK_RPC_TOKEN: taskRpcToken,
    },
    requestTimeoutMs: 60_000,
    shutdownTimeoutMs: 5_000,
    idleTimeoutMs: 0,
  },
})
workerCapabilityUnsubscribers.push(unregisterTaskWorkerCapability)


function getCleanUserAgent() {
  const chromeVersion = '124.0.0.0'; // 必须与前端代码中的版本保持一致！
  const baseUA = `Mozilla/5.0 ({os_info}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
  
  let osInfo = '';
  // Node.js 环境直接用 process.platform
  switch (process.platform) {
    case 'darwin':
      osInfo = 'Macintosh; Intel Mac OS X 10_15_7';
      break;
    case 'win32':
      osInfo = 'Windows NT 10.0; Win64; x64';
      break;
    case 'linux':
      osInfo = 'X11; Linux x86_64';
      break;
    default:
      osInfo = 'Windows NT 10.0; Win64; x64';
  }

  return baseUA.replace('{os_info}', osInfo);
}

// 提前计算好，供后面使用
const REAL_CHROME_UA = getCleanUserAgent();

let mainWindow
let loadingWindow
let tray = null
let updateAvailable = false
let updateDownloaded = false
let backendProcess = null
let localUiGateway = null
let legacyBackendActivationPromise = null
let mainWorkspaceNavigationTimer = null
let pendingMainWindowFocusRequest = false
let mainWorkspaceLoadPromise = null
let mainWorkspaceLoaded = false
let mainWorkspaceLoadStartedAt = 0
let mainWorkspaceReadyAt = 0
let loadingWindowFadeTimer = null
let autoUpdaterConfigured = false
const rendererGrantedFiles = new Set()
const rendererGrantedDirectories = new Set()
const HOST = '127.0.0.1'
let PORT = 3456 // 改为 let，允许修改
const DEFAULT_PORT = 3456 // 保存默认端口
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
const legacyBackendLifecycle = new LegacyBackendLifecycleCoordinator({
  isBackendActive: () => Boolean(
    backendProcess
    && backendProcess.exitCode === null
    && backendProcess.signalCode === null
    && !backendProcess.killed
  ),
  isApplicationQuitting: () => isQuitting,
  stopBackend: () => gracefulKillBackend(),
  startBackend: async () => {
    await desktopCore.ensureCapability('legacy-backend')
  },
})
const DEFAULT_UPDATE_FEED_URL = 'https://download.openxnet.synapxnet.com/releases/latest/'
const UPDATE_FEED_ENV_KEYS = ['OPENXNET_UPDATE_URL', 'OPENXNET_CDN_UPDATE_URL']
const HOME_COMMAND_GLOBAL_SHORTCUT = 'CommandOrControl+Alt+K'
const DYNAMIC_ISLAND_GLOBAL_SHORTCUT = 'CommandOrControl+Alt+D'
const FLOATING_TASK_HUD_GLOBAL_SHORTCUT = 'CommandOrControl+Alt+H'
const HOME_COMMAND_GLOBAL_SHORTCUT_FALLBACKS = ['CommandOrControl+Shift+Space', 'F8']
const DYNAMIC_ISLAND_GLOBAL_SHORTCUT_FALLBACKS = ['F9']
const FLOATING_TASK_HUD_GLOBAL_SHORTCUT_FALLBACKS = ['F10']
const MAIN_WINDOW_MIN_WIDTH = 1024
const MAIN_WINDOW_MIN_HEIGHT = 700
const MAIN_WORKSPACE_PATH = process.env.OPENXNET_UI_ENTRY || '/index.precompiled.html'
const MAIN_WORKSPACE_DEV_VERSION = process.env.OPENXNET_UI_VERSION || (isDev ? `dev-${Date.now()}` : '20260508-uiplan-pages-ui100')
const MAX_RENDERER_FILE_GRANTS = 4096
const MAX_RENDERER_READ_BYTES = 256 * 1024 * 1024
const MAX_SCREENSHOT_BUFFER_BYTES = 25 * 1024 * 1024
const TRUSTED_APPLICATION_PERMISSIONS = new Set([
  'clipboard-sanitized-write',
  'fullscreen',
  'media',
  'notifications',
  'pointerLock',
])

/**
 * Resolve the single static UI directory shared by Electron and Python.
 *
 * @returns {string} Absolute source or packaged UI directory.
 */
function getDesktopStaticRoot() {
  return isDev
    ? path.join(__dirname, 'static')
    : path.join(process.resourcesPath, 'ui')
}

/**
 * 解析 Desktop 与兼容后端共享的 VR 资源根目录。
 *
 * @returns {string} 开发源码或打包 extraResources 中的绝对 VR 目录。
 */
function getDesktopVrAssetRoot() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'vrm')
    : path.join(__dirname, 'vrm')
}

/**
 * Resolve a desktop UI path through the local Gateway with a backend fallback.
 *
 * @param {string} pathname Absolute or relative desktop UI path.
 * @returns {string} Fully qualified local UI URL.
 */
function getLocalUiUrl(pathname) {
  const origin = localUiGateway ? localUiGateway.origin : `http://${HOST}:${PORT}`
  return new URL(pathname, origin).toString()
}

/**
 * Return every loopback origin allowed to host trusted application UI.
 *
 * @returns {string[]} Exact trusted origins for the current process lifetime.
 */
function getTrustedApplicationOrigins() {
  return [...new Set([
    new URL(getLocalUiUrl('/')).origin,
    `http://${HOST}:${PORT}`,
  ])]
}

/**
 * Return application-owned roots that the Renderer may ask the OS to reveal.
 *
 * @returns {string[]} Canonical application and user-data roots.
 */
function getRendererOpenRoots() {
  return [app.getAppPath(), app.getPath('userData')]
}

/**
 * Resolve the effective frame URL behind an IPC event.
 *
 * @param {Electron.IpcMainInvokeEvent|Electron.IpcMainEvent} event IPC event.
 * @returns {string} Sender frame URL or top-level WebContents URL.
 */
function getRendererSenderUrl(event) {
  return event.senderFrame?.url || event.sender.getURL()
}

/**
 * Require an IPC event to originate from one of the supplied trusted windows.
 *
 * @param {Electron.IpcMainInvokeEvent|Electron.IpcMainEvent} event IPC event.
 * @param {Array<Electron.BrowserWindow|null|undefined>} allowedWindows Allowed windows.
 * @param {string[]} allowedFileRoots File roots accepted for local helper windows.
 * @returns {Electron.BrowserWindow} Validated sender window.
 */
function assertTrustedWindowSender(event, allowedWindows, allowedFileRoots = []) {
  const senderWindow = BrowserWindow.fromWebContents(event.sender)
  const matchesWindow = senderWindow && allowedWindows.some((candidate) => (
    candidate && !candidate.isDestroyed() && candidate.id === senderWindow.id
  ))
  const senderUrl = getRendererSenderUrl(event)
  if (
    !matchesWindow
    || !isAllowedApplicationNavigation(senderUrl, getTrustedApplicationOrigins(), allowedFileRoots)
  ) {
    throw new Error('IPC sender is not authorized for this operation.')
  }
  return senderWindow
}

/**
 * Require an IPC event to originate from the primary workspace Renderer.
 *
 * @param {Electron.IpcMainInvokeEvent|Electron.IpcMainEvent} event IPC event.
 * @returns {Electron.BrowserWindow} Validated main window.
 */
function assertMainRendererSender(event) {
  return assertTrustedWindowSender(event, [mainWindow])
}

/**
 * Require an artifact import path to match an exact native-dialog file grant.
 *
 * @param {Electron.IpcMainInvokeEvent} event Artifact import IPC event.
 * @param {string} candidatePath Renderer-supplied source path.
 * @returns {void}
 */
function assertAuthorizedArtifactImportPath(event, candidatePath) {
  assertMainRendererSender(event)
  if (!isAuthorizedRendererPath(candidatePath, [], rendererGrantedFiles, [])) {
    throw new Error('Artifact source path is not authorized.')
  }
}

/**
 * 要求 Developer Workbench 工作区与原生目录对话框授权结果精确一致。
 *
 * @param {Electron.IpcMainInvokeEvent} event Developer Workbench IPC 事件。
 * @param {string} candidatePath Renderer 提交的工作区绝对路径。
 * @returns {void} 授权成功时无返回；发送者或目录未授权时抛错且不写入设置。
 */
function assertAuthorizedDeveloperWorkspacePath(event, candidatePath) {
  assertMainRendererSender(event)
  const canonicalPath = path.resolve(candidatePath)
  if (!rendererGrantedDirectories.has(canonicalPath)) {
    throw new Error('Developer Workbench workspace path is not authorized.')
  }
}

/**
 * Retain one bounded file or directory grant from a native dialog.
 *
 * @param {Set<string>} grants Grant collection to update.
 * @param {string} candidatePath User-selected path.
 * @returns {void}
 */
function rememberRendererGrant(grants, candidatePath) {
  const canonicalPath = path.resolve(candidatePath)
  grants.add(canonicalPath)
  while (grants.size > MAX_RENDERER_FILE_GRANTS) {
    grants.delete(grants.values().next().value)
  }
}

/**
 * Retain exact files returned by an Open dialog.
 *
 * @param {Electron.OpenDialogReturnValue} result Native dialog result.
 * @returns {Electron.OpenDialogReturnValue} Original result for IPC serialization.
 */
function rememberRendererFileGrants(result) {
  if (!result.canceled) {
    for (const filePath of result.filePaths) {
      rememberRendererGrant(rendererGrantedFiles, filePath)
    }
  }
  return result
}

/**
 * Retain directory roots returned by an Open dialog.
 *
 * @param {Electron.OpenDialogReturnValue} result Native dialog result.
 * @returns {Electron.OpenDialogReturnValue} Original result for IPC serialization.
 */
function rememberRendererDirectoryGrants(result) {
  if (!result.canceled) {
    for (const directoryPath of result.filePaths) {
      rememberRendererGrant(rendererGrantedDirectories, directoryPath)
    }
  }
  return result
}

/**
 * Attach navigation guards to an application-owned BrowserWindow.
 *
 * @param {Electron.BrowserWindow} window BrowserWindow to protect.
 * @param {string[]} allowedFileRoots Local file roots accepted by this window.
 * @returns {void}
 */
function configureApplicationWindow(window, allowedFileRoots = []) {
  const guardNavigation = (event, url) => {
    if (!isAllowedApplicationNavigation(url, getTrustedApplicationOrigins(), allowedFileRoots)) {
      event.preventDefault()
    }
  }
  window.webContents.on('will-navigate', guardNavigation)
  window.webContents.on('will-redirect', guardNavigation)
}

/**
 * Determine whether an embedded browser may navigate to a candidate URL.
 *
 * @param {unknown} value Candidate webview URL.
 * @returns {boolean} True for HTTP(S) and the initial blank document only.
 */
function isAllowedWebviewNavigation(value) {
  if (value === '' || value === 'about:blank') return true
  try {
    assertSafeDownloadUrl(value)
    return true
  } catch {
    return false
  }
}

/**
 * Force every attached webview onto the application-owned sandboxed preload.
 *
 * @param {Electron.Event} event Webview attachment event.
 * @param {Electron.WebPreferences} webPreferences Mutable guest preferences.
 * @param {Record<string, string>} params Parsed webview element parameters.
 * @returns {void}
 */
function secureWebviewAttachment(event, webPreferences, params) {
  if (!isAllowedWebviewNavigation(params.src || 'about:blank')) {
    event.preventDefault()
    return
  }
  webPreferences.preload = path.join(__dirname, 'static', 'js', 'webview-preload.js')
  webPreferences.nodeIntegration = false
  webPreferences.nodeIntegrationInSubFrames = false
  webPreferences.contextIsolation = true
  webPreferences.sandbox = true
  webPreferences.webSecurity = true
  webPreferences.allowRunningInsecureContent = false
  webPreferences.enableRemoteModule = false
  webPreferences.webviewTag = false
}

/**
 * Decide whether a Chromium permission request belongs to trusted local UI.
 *
 * @param {Electron.WebContents|null} webContents Requesting WebContents.
 * @param {string} permission Chromium permission name.
 * @param {string} requestingOrigin Requesting origin when supplied by Electron.
 * @returns {boolean} True only for allow-listed permissions and application windows.
 */
function isTrustedApplicationPermission(webContents, permission, requestingOrigin = '') {
  if (!webContents || !TRUSTED_APPLICATION_PERMISSIONS.has(permission)) return false
  const senderWindow = BrowserWindow.fromWebContents(webContents)
  const trustedWindow = senderWindow && [mainWindow, ...vrmWindows].some((candidate) => (
    candidate && !candidate.isDestroyed() && candidate.id === senderWindow.id
  ))
  if (!trustedWindow) return false
  try {
    const origin = new URL(requestingOrigin || webContents.getURL()).origin
    return getTrustedApplicationOrigins().includes(origin)
  } catch {
    return false
  }
}

/**
 * Install a deny-by-default permission broker on one Electron session.
 *
 * @param {Electron.Session} targetSession Session to protect.
 * @param {boolean} allowTrustedApplication Whether trusted local UI may request permissions.
 * @returns {void}
 */
function configureSessionPermissions(targetSession, allowTrustedApplication) {
  targetSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => (
    allowTrustedApplication
    && isTrustedApplicationPermission(webContents, permission, requestingOrigin)
  ))
  targetSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const requestingOrigin = details?.requestingUrl || details?.requestingOrigin || ''
    callback(Boolean(
      allowTrustedApplication
      && isTrustedApplicationPermission(webContents, permission, requestingOrigin)
    ))
  })
}

/**
 * Normalize VRM window bounds to the primary display work area.
 *
 * @param {unknown} value Renderer-provided window configuration.
 * @returns {{width: number, height: number, x: number, y: number}} Safe window bounds.
 */
function normalizeVrmWindowBounds(value) {
  const config = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const workArea = screen.getPrimaryDisplay().workArea
  const width = clampDynamicIslandMetric(config.width, 240, workArea.width, Math.min(540, workArea.width))
  const height = clampDynamicIslandMetric(config.height, 240, workArea.height, Math.min(960, workArea.height))
  const defaultX = workArea.x + workArea.width - width - Math.min(40, workArea.width - width)
  const defaultY = workArea.y + workArea.height - height
  return {
    width,
    height,
    x: clampDynamicIslandMetric(config.x, workArea.x, workArea.x + workArea.width - width, defaultX),
    y: clampDynamicIslandMetric(config.y, workArea.y, workArea.y + workArea.height - height, defaultY),
  }
}

/**
 * Normalize one VMC UDP port into the valid user-space range.
 *
 * @param {unknown} value Candidate port.
 * @param {number} fallback Default port.
 * @returns {number} Valid UDP port.
 */
function normalizeVmcPort(value, fallback) {
  const port = Number(value)
  return Number.isInteger(port) && port >= 1024 && port <= 65535 ? port : fallback
}

/**
 * Validate a local-network VMC destination hostname.
 *
 * @param {unknown} value Candidate hostname or IP address.
 * @returns {string} Validated destination hostname.
 */
function normalizeVmcHost(value) {
  const host = typeof value === 'string' ? value.trim() : ''
  if (
    host.length === 0
    || host.length > 253
    || (!net.isIP(host) && !/^(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/.test(host))
  ) {
    throw new Error('VMC destination host is invalid.')
  }
  return host
}

/**
 * Normalize the VMC configuration accepted across the Renderer boundary.
 *
 * @param {unknown} value Candidate configuration.
 * @returns {{receive: object, send: object}} Bounded VMC configuration.
 */
function normalizeVmcConfig(value) {
  const config = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const receive = config.receive && typeof config.receive === 'object' ? config.receive : {}
  const send = config.send && typeof config.send === 'object' ? config.send : {}
  return {
    receive: {
      enable: receive.enable === true,
      port: normalizeVmcPort(receive.port, 39539),
      syncExpression: receive.syncExpression === true,
    },
    send: {
      enable: send.enable === true,
      host: normalizeVmcHost(send.host || '127.0.0.1'),
      port: normalizeVmcPort(send.port, 39540),
    },
  }
}

/**
 * Validate bounded VMC frame collections before OSC serialization.
 *
 * @param {unknown} value Candidate frame payload.
 * @returns {{bones: object[], blends: object[]}} Validated frame collections.
 */
function validateVmcFrame(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('VMC frame payload is invalid.')
  }
  const bones = Array.isArray(value.bones) ? value.bones : []
  const blends = Array.isArray(value.blends) ? value.blends : []
  if (bones.length > 256 || blends.length > 256) {
    throw new Error('VMC frame exceeds the allowed item count.')
  }
  const hasFiniteFields = (record, fields) => fields.every((field) => Number.isFinite(record?.[field]))
  for (const bone of bones) {
    if (
      typeof bone?.name !== 'string'
      || bone.name.length === 0
      || bone.name.length > 128
      || !hasFiniteFields(bone.pos, ['x', 'y', 'z'])
      || !hasFiniteFields(bone.rot, ['x', 'y', 'z', 'w'])
    ) {
      throw new Error('VMC bone payload is invalid.')
    }
  }
  for (const blend of blends) {
    if (
      typeof blend?.name !== 'string'
      || blend.name.length === 0
      || blend.name.length > 128
      || !Number.isFinite(blend.weight)
    ) {
      throw new Error('VMC blend payload is invalid.')
    }
  }
  return { bones, blends }
}

/**
 * Resolve the local workspace URL independently from Python backend readiness.
 *
 * @returns {string} Main Renderer URL served by the local UI Gateway when available.
 */
function getMainWorkspaceUrl() {
  const normalizedPath = MAIN_WORKSPACE_PATH.startsWith('/') ? MAIN_WORKSPACE_PATH : `/${MAIN_WORKSPACE_PATH}`
  const workspaceUrl = new URL(getLocalUiUrl(normalizedPath))
  if (isDev && MAIN_WORKSPACE_DEV_VERSION) {
    workspaceUrl.searchParams.set('ui', MAIN_WORKSPACE_DEV_VERSION)
  }
  return workspaceUrl.toString()
}

/**
 * Determine whether a URL belongs to the current main workspace origin and path.
 *
 * @param {string} url Candidate navigation URL.
 * @returns {boolean} True when the URL belongs to the main workspace.
 */
function isMainWorkspaceUrl(url = '') {
  const targetUrl = getMainWorkspaceUrl()
  const target = new URL(targetUrl)
  const current = new URL(String(url || '').trim(), target)
  const targetPath = target.pathname.endsWith('/') ? target.pathname : `${target.pathname}/`
  const currentPath = current.pathname.endsWith('/') ? current.pathname : `${current.pathname}/`
  return current.origin === target.origin && currentPath.startsWith(targetPath)
}

/**
 * Return the legacy backend origin only after its Core capability is usable.
 *
 * @returns {string|null} Ready backend origin or null while unavailable.
 */
function getReadyLegacyBackendOrigin() {
  const capability = desktopCore.getCapability('legacy-backend')
  if (capability.state !== 'ready' && capability.state !== 'degraded') {
    return null
  }
  return `http://${HOST}:${PORT}`
}

/**
 * 启动先于 Python 可用的回环 UI Gateway；无输入，返回绑定地址，并直接提供静态资源和只读 Artifact 文件。
 *
 * @returns {Promise<string>} 已绑定的本地 UI 地址；端口绑定失败时抛错。
 */
async function startLocalUiGateway() {
  if (localUiGateway) {
    return localUiGateway.origin
  }
  const gateway = new LocalUiGateway({
    staticRoot: getDesktopStaticRoot(),
    artifactRoot: path.join(app.getPath('userData'), 'uploaded_files'),
    vrAssetRoot: getDesktopVrAssetRoot(),
    getBackendOrigin: getReadyLegacyBackendOrigin,
    activateBackend: activateLegacyUiBackend,
  })
  const origin = await gateway.start()
  localUiGateway = gateway
  console.log(`[Startup] Local UI Gateway ready at ${origin}`)
  return origin
}

function resolveMainWindowBounds() {
  const { workArea } = screen.getPrimaryDisplay()
  const width = Math.min(
    workArea.width,
    Math.max(MAIN_WINDOW_MIN_WIDTH, Math.round(workArea.width * 0.88))
  )
  const height = Math.min(
    workArea.height,
    Math.max(MAIN_WINDOW_MIN_HEIGHT, Math.round(workArea.height * 0.88))
  )
  return {
    width,
    height,
    x: Math.round(workArea.x + (workArea.width - width) / 2),
    y: Math.round(workArea.y + (workArea.height - height) / 2),
  }
}

function getWindowStatePayload(win) {
  if (!win || win.isDestroyed()) {
    return {
      state: 'closed',
      isMaximized: false,
      isFullScreen: false,
      isMinimized: false,
      bounds: null,
    }
  }
  const isFullScreen = win.isFullScreen()
  const isMaximized = win.isMaximized()
  const isMinimized = win.isMinimized()
  return {
    state: isFullScreen ? 'fullscreen' : (isMaximized ? 'maximized' : (isMinimized ? 'minimized' : 'normal')),
    isMaximized,
    isFullScreen,
    isMinimized,
    bounds: win.getBounds(),
  }
}

const fullscreenChromeState = new WeakMap()

function applyBorderlessFullscreenChrome(win) {
  if (!win || win.isDestroyed()) return
  if (!fullscreenChromeState.has(win)) {
    fullscreenChromeState.set(win, {
      resizable: typeof win.isResizable === 'function' ? win.isResizable() : undefined,
      hasShadow: typeof win.hasShadow === 'function' ? win.hasShadow() : undefined,
    })
  }
  win.setBackgroundColor('#0a121c')
  try {
    // Windows frameless + resizable windows can keep a native 1px resize frame.
    // During true fullscreen resizing is not needed, so remove that frame and
    // restore it when leaving fullscreen.
    if (process.platform === 'win32' && typeof win.setResizable === 'function') {
      win.setResizable(false)
    }
  } catch (error) {
    console.warn('Failed to disable fullscreen resize frame:', error)
  }
  try {
    if (typeof win.setHasShadow === 'function') {
      win.setHasShadow(false)
    }
  } catch (error) {
    console.warn('Failed to disable fullscreen window shadow:', error)
  }
}

function restoreBorderlessFullscreenChrome(win) {
  if (!win || win.isDestroyed()) return
  const state = fullscreenChromeState.get(win)
  win.setBackgroundColor('#0a121c')
  if (!state) return
  try {
    if (state.resizable !== undefined && typeof win.setResizable === 'function') {
      win.setResizable(state.resizable)
    }
  } catch (error) {
    console.warn('Failed to restore fullscreen resize frame:', error)
  }
  try {
    if (state.hasShadow !== undefined && typeof win.setHasShadow === 'function') {
      win.setHasShadow(state.hasShadow)
    }
  } catch (error) {
    console.warn('Failed to restore fullscreen window shadow:', error)
  }
  fullscreenChromeState.delete(win)
}

function enterBorderlessFullscreen(win) {
  if (!win || win.isDestroyed()) return
  applyBorderlessFullscreenChrome(win)
  win.setFullScreen(true)
}

function exitBorderlessFullscreen(win) {
  if (!win || win.isDestroyed()) return
  win.setBackgroundColor('#0a121c')
  win.setFullScreen(false)
  const restore = () => restoreBorderlessFullscreenChrome(win)
  try {
    win.once('leave-full-screen', restore)
  } catch (_) {
    // setTimeout fallback below still restores the frame.
  }
  setTimeout(restore, 180)
}

function emitWindowState(win) {
  if (!win || win.isDestroyed()) {
    return
  }
  const payload = getWindowStatePayload(win)
  win.webContents.send('window-state', payload.state, payload)
}

function clearScheduledMainWorkspaceNavigation() {
  if (mainWorkspaceNavigationTimer) {
    clearTimeout(mainWorkspaceNavigationTimer)
    mainWorkspaceNavigationTimer = null
  }
}

function focusLoadingWindow() {
  if (!loadingWindow || loadingWindow.isDestroyed()) {
    return false
  }

  if (loadingWindow.isMinimized()) {
    loadingWindow.restore()
  }
  if (!loadingWindow.isVisible()) {
    loadingWindow.show()
  }
  loadingWindow.focus()
  return true
}

function notifyLoadingWindowBackendReady(payload) {
  if (!loadingWindow || loadingWindow.isDestroyed()) {
    return
  }

  const splashWindow = loadingWindow
  const sendReady = () => {
    if (!splashWindow.isDestroyed()) {
      try {
        splashWindow.webContents.send('backend-ready', payload)
      } catch (error) {
        console.warn('Failed to notify launch window that backend is ready:', error)
      }
    }
  }

  const isLoading = typeof splashWindow.webContents.isLoadingMainFrame === 'function'
    ? splashWindow.webContents.isLoadingMainFrame()
    : splashWindow.webContents.isLoading()

  if (isLoading) {
    splashWindow.webContents.once('did-finish-load', sendReady)
    return
  }
  sendReady()
}

function fadeOutLoadingWindow() {
  if (!loadingWindow || loadingWindow.isDestroyed()) {
    return
  }

  const windowToClose = loadingWindow
  loadingWindow = null

  if (loadingWindowFadeTimer) {
    clearInterval(loadingWindowFadeTimer)
    loadingWindowFadeTimer = null
  }

  if (typeof windowToClose.setIgnoreMouseEvents === 'function') {
    windowToClose.setIgnoreMouseEvents(true)
  }

  let opacity = 1
  loadingWindowFadeTimer = setInterval(() => {
    if (windowToClose.isDestroyed()) {
      clearInterval(loadingWindowFadeTimer)
      loadingWindowFadeTimer = null
      return
    }

    opacity = Math.max(0, opacity - 0.1)
    if (typeof windowToClose.setOpacity === 'function') {
      windowToClose.setOpacity(opacity)
    }

    if (opacity <= 0) {
      clearInterval(loadingWindowFadeTimer)
      loadingWindowFadeTimer = null
      windowToClose.destroy()
    }
  }, 24)
}

function revealMainWorkspace() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return false
  }

  if (!mainWorkspaceLoaded) {
    pendingMainWindowFocusRequest = true
    return focusLoadingWindow()
  }

  pendingMainWindowFocusRequest = false
  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }
  if (!mainWindow.isVisible()) {
    mainWindow.show()
  }
  mainWindow.focus()
  fadeOutLoadingWindow()
  return true
}

/**
 * Capture an opt-in startup screenshot after Renderer hydration for CI diagnostics.
 *
 * @returns {Promise<void>} Completion after the optional image is written.
 */
async function captureStartupScreenshotIfRequested() {
  const screenshotPath = String(process.env.OPENXNET_STARTUP_SCREENSHOT || '').trim()
  if (!screenshotPath || !mainWindow || mainWindow.isDestroyed()) {
    return
  }
  await new Promise((resolve) => setTimeout(resolve, 1_500))
  const image = await mainWindow.webContents.capturePage()
  await fs.promises.mkdir(path.dirname(screenshotPath), { recursive: true })
  await fs.promises.writeFile(screenshotPath, image.toPNG())
  console.log(`[Startup] Screenshot captured at ${screenshotPath}`)
}

/** Determine whether one Renderer snapshot contains every required cold-start milestone. */
function isRendererStartupSnapshotSettled(renderer) {
  const milestones = Array.isArray(renderer?.milestones) ? renderer.milestones : []
  const deferredTasks = Array.isArray(renderer?.deferredTasks) ? renderer.deferredTasks : []
  const milestoneNames = new Set(milestones.map((milestone) => milestone?.name))
  const deferredTaskNames = new Set(deferredTasks.map((task) => task?.name))
  return milestoneNames.has('legacy-renderer-state-ready')
    && ['server-port-check', 'auto-update-checks', 'chat-services']
      .every((taskName) => deferredTaskNames.has(taskName))
}

/** Poll bounded Renderer diagnostics until critical deferred startup state is observable. */
async function captureSettledRendererStartupSnapshot(maximumWaitMs = 10_000) {
  const deadline = Date.now() + maximumWaitMs
  let renderer = null
  do {
    if (!mainWindow || mainWindow.isDestroyed()) return renderer
    renderer = await mainWindow.webContents.executeJavaScript(
      'window.openxnetStartup?.snapshot?.() || null',
      true,
    )
    if (isRendererStartupSnapshotSettled(renderer)) return renderer
    await new Promise((resolve) => setTimeout(resolve, 100))
  } while (Date.now() < deadline)
  return renderer
}

/**
 * Write opt-in startup milestones and settled capability state for CI checks.
 *
 * @returns {Promise<void>} Completion after the optional report is persisted.
 */
async function writeStartupReportIfRequested() {
  const reportPath = String(process.env.OPENXNET_STARTUP_REPORT || '').trim()
  if (!reportPath || !mainWindow || mainWindow.isDestroyed()) {
    return
  }
  const configuredSettleMs = Number(process.env.OPENXNET_STARTUP_REPORT_SETTLE_MS || 0)
  const settleMs = Number.isFinite(configuredSettleMs)
    ? Math.min(Math.max(Math.trunc(configuredSettleMs), 0), 30_000)
    : 0
  if (settleMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, settleMs))
  }
  const renderer = await captureSettledRendererStartupSnapshot()
  const report = {
    schema: 'openxnet.startup-report.v1',
    processStartedAt: new Date(DESKTOP_PROCESS_STARTED_AT).toISOString(),
    processElapsedMs: mainWorkspaceReadyAt > 0
      ? mainWorkspaceReadyAt - DESKTOP_PROCESS_STARTED_AT
      : Date.now() - DESKTOP_PROCESS_STARTED_AT,
    workspaceElapsedMs: mainWorkspaceLoadStartedAt > 0 && mainWorkspaceReadyAt > 0
      ? mainWorkspaceReadyAt - mainWorkspaceLoadStartedAt
      : null,
    renderer,
    core: desktopCore.getSnapshot(),
    legacyBackendProcessActive: Boolean(backendProcess && !backendProcess.killed),
  }
  const resolvedPath = path.resolve(reportPath)
  await fs.promises.mkdir(path.dirname(resolvedPath), { recursive: true })
  await fs.promises.writeFile(resolvedPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(`[Startup] Report captured at ${resolvedPath}`)
  if (process.env.OPENXNET_EXIT_AFTER_STARTUP_REPORT === '1') {
    app.quit()
  }
}

/**
 * Report a non-fatal startup screenshot failure.
 *
 * @param {unknown} error Screenshot capture failure.
 */
function reportStartupScreenshotFailure(error) {
  console.error('Startup screenshot capture failed:', error)
}

/** Report a non-fatal structured startup diagnostics failure. */
function reportStartupDiagnosticsFailure(error) {
  console.error('Startup diagnostics capture failed:', error)
}

/**
 * Reveal the main window when the trusted Vue Renderer reports hydration.
 *
 * @param {Electron.IpcMainEvent} event Renderer-ready IPC event.
 */
function handleWorkspaceRendererReady(event) {
  if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) {
    return
  }
  mainWorkspaceReadyAt = Date.now()
  mainWorkspaceLoaded = true
  const workspaceElapsed = mainWorkspaceLoadStartedAt > 0
    ? `${Date.now() - mainWorkspaceLoadStartedAt} ms`
    : 'unknown time'
  console.log(`[Startup] Renderer hydration completed in ${workspaceElapsed}`)
  void captureStartupScreenshotIfRequested().catch(reportStartupScreenshotFailure)
  void writeStartupReportIfRequested().catch(reportStartupDiagnosticsFailure)
  if (!shouldStartHiddenOnLaunch()) {
    revealMainWorkspace()
  }
}

ipcMain.on('workspace-renderer-ready', handleWorkspaceRendererReady)

/**
 * Load the main workspace once and optionally reveal its BrowserWindow.
 *
 * @param {{reveal?: boolean}} options Navigation visibility options.
 * @returns {Promise<boolean>} True when the workspace loaded successfully.
 */
async function navigateMainWindowToWorkspace({ reveal = true } = {}) {
  clearScheduledMainWorkspaceNavigation()
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow({ show: false })
  }

  const currentUrl = typeof mainWindow.webContents?.getURL === 'function'
    ? mainWindow.webContents.getURL()
    : ''

  if (isMainWorkspaceUrl(currentUrl) && mainWorkspaceLoaded) {
    return reveal ? revealMainWorkspace() : true
  }

  if (!mainWorkspaceLoadPromise) {
    mainWorkspaceLoaded = false
    mainWorkspaceLoadPromise = (async () => {
      try {
        if (typeof mainWindow.setBackgroundColor === 'function') {
          mainWindow.setBackgroundColor('#060914')
        }
        const workspaceUrl = getMainWorkspaceUrl()
        const loadStartedAt = Date.now()
        mainWorkspaceLoadStartedAt = loadStartedAt
        mainWorkspaceReadyAt = 0
        if (process.env.OPENXNET_STARTUP_REPORT) {
          console.log(`[Startup] Main workspace navigation requested: ${workspaceUrl}`)
        }
        await mainWindow.loadURL(workspaceUrl)
        mainWorkspaceLoaded = true
        console.log(`[Startup] Main workspace loaded from local UI in ${Date.now() - loadStartedAt} ms`)
        return true
      } catch (error) {
        mainWorkspaceLoaded = false
        console.error('Failed to load main workspace URL:', error)
        return false
      } finally {
        mainWorkspaceLoadPromise = null
      }
    })()
  }

  const loaded = await mainWorkspaceLoadPromise
  return loaded && reveal ? revealMainWorkspace() : loaded
}

/**
 * Schedule one coalesced main workspace navigation.
 *
 * @param {number} delay Delay before navigation in milliseconds.
 * @param {{reveal?: boolean}} options Navigation visibility options.
 */
function scheduleMainWindowWorkspaceNavigation(delay = 140, options = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return
  }

  clearScheduledMainWorkspaceNavigation()
  mainWorkspaceNavigationTimer = setTimeout(() => {
    mainWorkspaceNavigationTimer = null
    void navigateMainWindowToWorkspace(options)
  }, delay)
}

ipcMain.handle('open-main-app', async (event) => {
  assertTrustedWindowSender(event, [loadingWindow], [getDesktopStaticRoot()])
  return navigateMainWindowToWorkspace({ reveal: true })
})
let globalShortcutStatus = {
  homeCommand: {
    accelerator: HOME_COMMAND_GLOBAL_SHORTCUT,
    registered: false,
  },
  dynamicIsland: {
    accelerator: DYNAMIC_ISLAND_GLOBAL_SHORTCUT,
    registered: false,
  },
  floatingTaskHud: {
    accelerator: FLOATING_TASK_HUD_GLOBAL_SHORTCUT,
    registered: false,
  },
}
const locales = {
  'zh-CN': {
    show: '显示窗口',
    exit: '退出',
    cut: '剪切',
    copy: '复制',
    paste: '粘贴',
    copyImage: '复制图片',
    copyImageLink: '复制图片链接',
    saveImageAs: '图片另存为...',
    supportedFiles: '支持的文件',
    allFiles: '所有文件',
    supportedimages: '支持的图片',
    // 新增项
    openNewTab: '在新标签页打开',
    copyLink: '复制链接地址',
    copyLinkText: '复制链接文本',
    selectAll: '全选',
    inspect: '检查元素'
  },
  'en-US': {
    show: 'Show Window',
    exit: 'Exit',
    cut: 'Cut',
    copy: 'Copy',
    paste: 'Paste',
    copyImage: 'Copy Image',
    copyImageLink: 'Copy Image Link',
    saveImageAs: 'Save Image As...',
    supportedFiles: 'Supported Files',
    allFiles: 'All Files',
    supportedimages: 'Supported Images',
    // 新增项
    openNewTab: 'Open in new tab',
    copyLink: 'Copy link address',
    copyLinkText: 'Copy link text',
    selectAll: 'Select All',
    inspect: 'Inspect'
  }
};
const ALLOWED_EXTENSIONS = [
  // 办公文档
    'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'pdf', 'pages', 
    'numbers', 'key', 'rtf', 'odt', 'epub',
  
  // 编程开发
  'js', 'ts', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'go', 'rs',
  'swift', 'kt', 'dart', 'rb', 'php', 'html', 'css', 'scss', 'less',
  'vue', 'svelte', 'jsx', 'tsx', 'json', 'xml', 'yml', 'yaml', 
  'sql', 'sh',
  
  // 数据配置
  'csv', 'tsv', 'txt', 'md', 'log', 'conf', 'ini', 'env', 'toml'
  ];
const ALLOWED_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'];
let currentLanguage = 'zh-CN';

// 构建菜单项
let menu;

// 配置日志文件路径
const logDir = path.join(app.getPath('userData'), 'logs')
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true })
}

/**
 * Return the legacy Electron configuration mirror path.
 *
 * @returns {string} Absolute configuration path.
 */
function getConfigPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

/**
 * Load legacy scalar environment values without treating JSON as authoritative settings.
 *
 * @returns {Record<string, unknown>} Parsed legacy configuration.
 */
function loadEnvVariables() {
  const configPath = getConfigPath();
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      
      // 遍历配置加载到环境变量
      for (const key in config) {
        const val = config[key];
        // ★ 同样只把基本类型加载到 env
        if (typeof val === 'string' || typeof val === 'number') {
          process.env[key] = val;
        }
      }
      return config; // ★ 返回完整配置对象给 CDP 逻辑使用
    } catch (e) {
      console.error('加载配置失败:', e);
    }
  }
  return {};
}

/**
 * Determine whether command-line or Core settings require a hidden startup.
 *
 * @returns {boolean} True when the workspace should remain hidden after hydration.
 */
function shouldStartHiddenOnLaunch() {
  const argvStartHidden = process.argv.some((arg) => {
    const value = String(arg || '').toLowerCase()
    return value === '--hidden' || value === '--start-minimized' || value === '--minimized'
  })
  if (argvStartHidden) return true
  return applicationSettings.getSystemSettings().settings.startMinimized === true
}

/**
 * Apply operating-system login launch settings.
 *
 * @param {{enabled?: boolean, startMinimized?: boolean}} options Login launch options.
 * @returns {Electron.LoginItemSettings|Record<string, unknown>} Effective platform settings.
 */
function updateLoginItemSettings({ enabled = false, startMinimized = false } = {}) {
  const openAtLogin = Boolean(enabled)
  const openHidden = Boolean(startMinimized)
  const args = openAtLogin && openHidden ? ['--hidden'] : []
  if (typeof app.setLoginItemSettings === 'function') {
    app.setLoginItemSettings({
      openAtLogin,
      openAsHidden: openHidden,
      args,
    })
  }
  return typeof app.getLoginItemSettings === 'function'
    ? app.getLoginItemSettings()
    : { openAtLogin, openAsHidden: openHidden, args }
}

loadEnvVariables();
const globalConfig = applicationSettings.getRuntimeSettings();

// 定义全局变量
let SESSION_CDP_PORT = 0; // 初始为0
let IS_INTERNAL_MODE_ACTIVE = false;

if (globalConfig?.chromeMCPSettings?.type === 'internal' && globalConfig?.chromeMCPSettings?.enabled) {
  
  // ★ 修改点 1：使用端口 '0'，让系统自动分配一个绝对安全的空闲端口
  app.commandLine.appendSwitch('remote-debugging-port', '0');
  
  // ★ 修改点 2：显式绑定到 127.0.0.1，防止防火墙报警
  app.commandLine.appendSwitch('remote-debugging-address', '127.0.0.1');
  
  IS_INTERNAL_MODE_ACTIVE = true;
  console.log('[CDP] 已请求系统自动分配内置浏览器调试端口...');
}

// 新增：检测端口是否可用
function isPortAvailable(port, host = HOST) {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.listen(port, host, () => {
      server.once('close', () => resolve(true))
      server.close()
    })
    server.on('error', () => resolve(false))
  })
}

// 新增：查找可用端口
async function findAvailablePort(host = HOST, startPort = DEFAULT_PORT, maxAttempts = 200) {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i
    if (await isPortAvailable(port, host)) {
      return port
    }
  }
  throw new Error(`无法找到可用端口，已尝试 ${startPort} 到 ${startPort + maxAttempts - 1}`)
}

function isUdpPortAvailable(port, host = '0.0.0.0') {
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4')
    let settled = false

    const finish = (available) => {
      if (settled) return
      settled = true
      try {
        socket.close()
      } catch (_) {}
      resolve(available)
    }

    socket.once('error', () => finish(false))
    socket.once('listening', () => finish(true))

    try {
      socket.bind(port, host)
    } catch (_) {
      finish(false)
    }
  })
}

async function findAvailableUdpPort(host = '0.0.0.0', startPort = 39539, maxAttempts = 100, excludedPorts = []) {
  const excludedPortSet = new Set(
    excludedPorts
      .map((port) => Number(port))
      .filter((port) => Number.isInteger(port) && port > 0)
  )
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i
    if (excludedPortSet.has(port)) {
      continue
    }
    if (await isUdpPortAvailable(port, host)) {
      return port
    }
  }
  throw new Error(`无法找到可用 UDP 端口，已尝试 ${startPort} 到 ${startPort + maxAttempts - 1}`)
}

async function resolvePreferredVmcReceivePort(host = '0.0.0.0', preferredPort = 39539, excludedPorts = []) {
  try {
    const resolvedPort = await findAvailableUdpPort(host, preferredPort, 100, excludedPorts)
    if (resolvedPort !== preferredPort) {
      console.warn(`⚠️ VMC 默认接收端口 ${preferredPort} 已被占用，自动切换到 ${resolvedPort}`)
    }
    return resolvedPort
  } catch (error) {
    console.warn(`⚠️ 未能为 VMC 找到固定空闲 UDP 端口，将交给系统随机分配: ${error.message}`)
    return 0
  }
}

async function resolvePreferredBackendPort(host) {
  try {
    const preferredPort = await findAvailablePort(host, DEFAULT_PORT, 200)
    if (preferredPort !== DEFAULT_PORT) {
      console.warn(`⚠️ 默认端口 ${DEFAULT_PORT} 已被占用，自动切换到 ${preferredPort}`)
    }
    return preferredPort
  } catch (error) {
    console.warn(`⚠️ 未能在默认端口区间内找到空闲端口，将交给后端使用系统随机端口: ${error.message}`)
    return 0
  }
}


function createMainWindow({ show = false } = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow
  }

  const mainWindowBounds = resolveMainWindowBounds()
  mainWindow = new BrowserWindow({
    ...mainWindowBounds,
    minWidth: MAIN_WINDOW_MIN_WIDTH,
    minHeight: MAIN_WINDOW_MIN_HEIGHT,
    backgroundColor: '#0a121c',
    frame: false,
    thickFrame: false,
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    trafficLightPosition: { x: 10, y: 12 },
    show,
    icon: OPENXNET_WINDOW_ICON,
    webPreferences: createSecureWebPreferences({
      preload: path.join(__dirname, 'static/js/preload.js'),
      devTools: isDev,
      partition: 'persist:main-session',
    }, { allowWebviewTag: true })
  })

  mainWindow.setMenuBarVisibility(false)
  configureApplicationWindow(mainWindow)
  if (process.env.OPENXNET_STARTUP_REPORT) {
    mainWindow.webContents.on('console-message', (event) => {
      const text = String(event?.message || '')
      if (text.startsWith('[Startup]')) {
        console.log(`[Renderer] ${text.slice(0, 1000)}`)
      }
    })
    mainWindow.webContents.on('did-start-loading', () => {
      console.log('[Startup] Main workspace WebContents started loading')
    })
    mainWindow.webContents.on('dom-ready', () => {
      console.log('[Startup] Main workspace DOM became ready')
    })
    mainWindow.webContents.on('did-finish-load', () => {
      console.log('[Startup] Main workspace WebContents finished loading')
    })
    mainWindow.webContents.on('did-fail-load', (_event, code, description, url) => {
      console.error(`[Startup] Main workspace load failed (${code}): ${description} at ${url}`)
    })
    mainWindow.on('unresponsive', () => {
      console.error('[Startup] Main workspace BrowserWindow became unresponsive')
    })
  }

  // 设置自动更新
  setupAutoUpdater()

  mainWindow.webContents.on('did-start-navigation', (_event, url, isInPlace, isMainFrame) => {
    if (isMainFrame && !isInPlace && !isMainWorkspaceUrl(url)) {
      mainWorkspaceLoaded = false
    }
  })

  // 窗口状态同步
  mainWindow.on('maximize', () => emitWindowState(mainWindow))
  mainWindow.on('unmaximize', () => emitWindowState(mainWindow))
  mainWindow.on('minimize', () => emitWindowState(mainWindow))
  mainWindow.on('restore', () => emitWindowState(mainWindow))
  mainWindow.on('enter-full-screen', () => {
    applyBorderlessFullscreenChrome(mainWindow)
    emitWindowState(mainWindow)
  })
  mainWindow.on('leave-full-screen', () => {
    restoreBorderlessFullscreenChrome(mainWindow)
    emitWindowState(mainWindow)
  })
  mainWindow.webContents.on('did-finish-load', () => emitWindowState(mainWindow))
  
  // 窗口关闭事件处理 - 最小化到托盘而不是退出
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault()
      mainWindow.hide()
      return false
    }
    return true
  })
  mainWindow.on('closed', () => {
    clearScheduledMainWorkspaceNavigation()
    mainWorkspaceLoadPromise = null
    mainWorkspaceLoaded = false
    mainWindow = null
  })

  return mainWindow
}

/** Create the visible startup skeleton, or skip it entirely for hidden launches. */
function createSkeletonWindow() {
  if (loadingWindow && !loadingWindow.isDestroyed()) {
    focusLoadingWindow()
    return loadingWindow
  }

  const startHidden = shouldStartHiddenOnLaunch()
  if (startHidden) {
    createMainWindow({ show: false })
    return null
  }

  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  loadingWindow = new BrowserWindow({
    width: width,
    height: height,
    backgroundColor: '#060914',
    frame: false,
    titleBarStyle: 'hidden',
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    show: !startHidden,
    icon: OPENXNET_WINDOW_ICON,
    webPreferences: createSecureWebPreferences({
      preload: path.join(__dirname, 'static/js/skeleton-preload.js'),
      devTools: isDev,
      partition: 'persist:main-session',
    })
  })

  // 先展示独立启动页，主工作区隐藏加载，避免同窗口跳转时闪白。
  const splashWindow = loadingWindow
  configureApplicationWindow(loadingWindow, [getDesktopStaticRoot()])
  loadingWindow.loadFile(path.join(__dirname, 'static/skeleton.html'))
  splashWindow.on('closed', () => {
    if (loadingWindow === splashWindow) {
      loadingWindow = null
    }
  })

  createMainWindow({ show: false })
  return loadingWindow
}

// 修改后的启动后端函数
/**
 * 启动后端服务
 * 逻辑：传 port 0 -> 捕获 REAL_PORT_FOUND -> 返回真实端口
 */
function getDynamicIslandBounds() {
  const primaryDisplay = screen.getPrimaryDisplay()
  const workArea = primaryDisplay.workArea
  const width = Math.min(dynamicIslandSurfaceState.width, workArea.width)
  const height = Math.min(dynamicIslandSurfaceState.height, workArea.height)

  return {
    width,
    height,
    x: Math.round(workArea.x + (workArea.width - width) / 2),
    y: Math.max(workArea.y + 8, 0),
  }
}

function getFloatingTaskHudBounds() {
  const primaryDisplay = screen.getPrimaryDisplay()
  const workArea = primaryDisplay.workArea
  const margin = FLOATING_TASK_HUD_WINDOW_DEFAULT.margin
  const maxWidth = Math.max(260, workArea.width - margin * 2)
  const width = Math.min(
    maxWidth,
    Math.max(
      Math.min(FLOATING_TASK_HUD_WINDOW_DEFAULT.minWidth, maxWidth),
      FLOATING_TASK_HUD_WINDOW_DEFAULT.width
    )
  )
  const maxHeight = Math.max(320, workArea.height - margin * 2)
  const height = Math.min(
    maxHeight,
    Math.max(
      Math.min(FLOATING_TASK_HUD_WINDOW_DEFAULT.minHeight, maxHeight),
      FLOATING_TASK_HUD_WINDOW_DEFAULT.height
    )
  )
  const x = Math.round(workArea.x + workArea.width - width - margin)
  const maxY = workArea.y + Math.max(0, workArea.height - height - margin)
  const y = Math.round(Math.min(workArea.y + FLOATING_TASK_HUD_WINDOW_DEFAULT.topOffset, maxY))

  return { width, height, x, y }
}

function clampDynamicIslandMetric(value, minimum, maximum, fallback) {
  const normalized = Number(value)
  if (!Number.isFinite(normalized)) {
    return fallback
  }
  return Math.max(minimum, Math.min(maximum, Math.round(normalized)))
}

function normalizeDynamicIslandSurfaceState(nextState = {}) {
  const compact = typeof nextState.compact === 'boolean'
    ? nextState.compact
    : Boolean(dynamicIslandSurfaceState.compact)
  const interactive = typeof nextState.interactive === 'boolean'
    ? nextState.interactive
    : !compact
  const fallbackWidth = compact ? DYNAMIC_ISLAND_SURFACE_DEFAULT.width : 468
  const fallbackHeight = compact ? DYNAMIC_ISLAND_SURFACE_DEFAULT.height : 220

  return {
    compact,
    interactive,
    width: clampDynamicIslandMetric(
      nextState.width,
      DYNAMIC_ISLAND_SURFACE_LIMITS.minWidth,
      DYNAMIC_ISLAND_SURFACE_LIMITS.maxWidth,
      fallbackWidth
    ),
    height: clampDynamicIslandMetric(
      nextState.height,
      DYNAMIC_ISLAND_SURFACE_LIMITS.minHeight,
      DYNAMIC_ISLAND_SURFACE_LIMITS.maxHeight,
      fallbackHeight
    ),
  }
}

function applyDynamicIslandSurfaceState(nextState = {}) {
  dynamicIslandSurfaceState = normalizeDynamicIslandSurfaceState({
    ...dynamicIslandSurfaceState,
    ...nextState,
  })

  if (!dynamicIslandWindow || dynamicIslandWindow.isDestroyed()) {
    return dynamicIslandSurfaceState
  }

  positionDynamicIslandWindow()
  dynamicIslandWindow.setAlwaysOnTop(true, 'screen-saver')
  dynamicIslandWindow.setIgnoreMouseEvents(
    !dynamicIslandSurfaceState.interactive,
    dynamicIslandSurfaceState.interactive ? undefined : { forward: true }
  )
  return dynamicIslandSurfaceState
}

function positionDynamicIslandWindow() {
  if (!dynamicIslandWindow || dynamicIslandWindow.isDestroyed()) return
  dynamicIslandWindow.setBounds(getDynamicIslandBounds())
}

function isDynamicIslandWindowVisible() {
  return Boolean(
    dynamicIslandWindow
      && !dynamicIslandWindow.isDestroyed()
      && typeof dynamicIslandWindow.isVisible === 'function'
      && dynamicIslandWindow.isVisible()
  )
}

function getDynamicIslandWindowState() {
  return {
    available: Boolean(dynamicIslandWindow && !dynamicIslandWindow.isDestroyed()),
    visible: isDynamicIslandWindowVisible(),
  }
}

function hideDynamicIslandWindow() {
  if (!dynamicIslandWindow || dynamicIslandWindow.isDestroyed()) {
    return {
      success: false,
      ...getDynamicIslandWindowState(),
    }
  }

  dynamicIslandWindow.hide()
  if (tray) {
    updateTrayMenu()
  }

  return {
    success: true,
    ...getDynamicIslandWindowState(),
  }
}

function positionFloatingTaskHudWindow() {
  if (!floatingTaskHudWindow || floatingTaskHudWindow.isDestroyed()) return
  floatingTaskHudWindow.setBounds(getFloatingTaskHudBounds())
}

function closeFloatingTaskHudWindow() {
  const targetWindow = floatingTaskHudWindow
  if (!targetWindow || targetWindow.isDestroyed()) {
    floatingTaskHudWindow = null
    return { success: true, visible: false }
  }

  setTimeout(() => {
    if (!targetWindow.isDestroyed()) {
      targetWindow.destroy()
    }
    if (floatingTaskHudWindow === targetWindow) {
      floatingTaskHudWindow = null
    }
  }, 0)

  return { success: true, visible: false }
}

async function ensureDynamicIslandWindow() {
  if (dynamicIslandWindow && !dynamicIslandWindow.isDestroyed()) {
    positionDynamicIslandWindow()
    if (!dynamicIslandWindow.isVisible()) {
      if (typeof dynamicIslandWindow.showInactive === 'function') {
        dynamicIslandWindow.showInactive()
      } else {
        dynamicIslandWindow.show()
      }
    }
    if (tray) {
      updateTrayMenu()
    }
    return dynamicIslandWindow
  }

  const bounds = getDynamicIslandBounds()
  dynamicIslandWindow = new BrowserWindow({
    ...bounds,
    frame: false,
    transparent: true,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: createSecureWebPreferences({
      preload: path.join(__dirname, 'static/js/surface-preload.js'),
      backgroundThrottling: false,
    })
  })
  configureApplicationWindow(dynamicIslandWindow)

  dynamicIslandWindow.setAlwaysOnTop(true, 'screen-saver')
  dynamicIslandWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  applyDynamicIslandSurfaceState(dynamicIslandSurfaceState)

  dynamicIslandWindow.on('ready-to-show', () => {
    applyDynamicIslandSurfaceState(dynamicIslandSurfaceState)
    if (typeof dynamicIslandWindow.showInactive === 'function') {
      dynamicIslandWindow.showInactive()
    } else {
      dynamicIslandWindow.show()
    }
    if (tray) {
      updateTrayMenu()
    }
  })

  dynamicIslandWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault()
      dynamicIslandWindow.hide()
      if (tray) {
        updateTrayMenu()
      }
    }
  })

  dynamicIslandWindow.on('show', () => {
    if (tray) {
      updateTrayMenu()
    }
  })

  dynamicIslandWindow.on('hide', () => {
    if (tray) {
      updateTrayMenu()
    }
  })

  dynamicIslandWindow.on('closed', () => {
    dynamicIslandWindow = null
    if (tray) {
      updateTrayMenu()
    }
  })

  await dynamicIslandWindow.loadURL(getLocalUiUrl('/dynamic_island'))
  return dynamicIslandWindow
}

async function showDynamicIslandWindow() {
  try {
    await ensureDynamicIslandWindow()
    return {
      success: true,
      ...getDynamicIslandWindowState(),
    }
  } catch (error) {
    console.error('Failed to open dynamic island window:', error)
    return {
      success: false,
      error: error.message,
      ...getDynamicIslandWindowState(),
    }
  }
}

async function toggleDynamicIslandWindow() {
  if (isDynamicIslandWindowVisible()) {
    return hideDynamicIslandWindow()
  }

  return await showDynamicIslandWindow()
}

async function ensureFloatingTaskHudWindow() {
  if (floatingTaskHudWindow && !floatingTaskHudWindow.isDestroyed()) {
    positionFloatingTaskHudWindow()
    if (!floatingTaskHudWindow.isVisible()) {
      if (typeof floatingTaskHudWindow.showInactive === 'function') {
        floatingTaskHudWindow.showInactive()
      } else {
        floatingTaskHudWindow.show()
      }
    }
    return floatingTaskHudWindow
  }

  const bounds = getFloatingTaskHudBounds()
  floatingTaskHudWindow = new BrowserWindow({
    ...bounds,
    frame: false,
    transparent: true,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    acceptFirstMouse: true,
    webPreferences: createSecureWebPreferences({
      preload: path.join(__dirname, 'static/js/surface-preload.js'),
      backgroundThrottling: false,
    })
  })
  configureApplicationWindow(floatingTaskHudWindow)

  floatingTaskHudWindow.setAlwaysOnTop(true, 'screen-saver')
  floatingTaskHudWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  floatingTaskHudWindow.setIgnoreMouseEvents(false)

  floatingTaskHudWindow.on('ready-to-show', () => {
    positionFloatingTaskHudWindow()
    if (typeof floatingTaskHudWindow.showInactive === 'function') {
      floatingTaskHudWindow.showInactive()
    } else {
      floatingTaskHudWindow.show()
    }
  })

  floatingTaskHudWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault()
      floatingTaskHudWindow.hide()
    }
  })

  floatingTaskHudWindow.on('closed', () => {
    floatingTaskHudWindow = null
  })

  await floatingTaskHudWindow.loadURL(getLocalUiUrl('/floating_task_hud'))
  return floatingTaskHudWindow
}

function showFloatingTaskHudWindow() {
  ensureFloatingTaskHudWindow().catch((error) => {
    console.error('Failed to open floating task HUD window:', error)
  })
}

function showAndFocusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return focusLoadingWindow()
  }

  if (!mainWorkspaceLoaded) {
    pendingMainWindowFocusRequest = true
    return focusLoadingWindow()
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }
  if (!mainWindow.isVisible()) {
    mainWindow.show()
  }
  mainWindow.focus()
  return true
}

function sendMainWindowEvent(channel, payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return false

  const deliver = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    mainWindow.webContents.send(channel, payload)
  }

  const isLoading = typeof mainWindow.webContents.isLoadingMainFrame === 'function'
    ? mainWindow.webContents.isLoadingMainFrame()
    : mainWindow.webContents.isLoading()

  if (isLoading) {
    mainWindow.webContents.once('did-finish-load', deliver)
  } else {
    deliver()
  }
  return true
}

function triggerHomeCommandPanelShortcut() {
  if (!showAndFocusMainWindow()) return

  sendMainWindowEvent('open-home-command-panel', {
    source: 'global-shortcut',
    accelerator: globalShortcutStatus.homeCommand?.accelerator || HOME_COMMAND_GLOBAL_SHORTCUT,
  })
}

function registerGlobalShortcuts() {
  const shortcutConfigs = [
    {
      key: 'homeCommand',
      accelerators: [HOME_COMMAND_GLOBAL_SHORTCUT, ...HOME_COMMAND_GLOBAL_SHORTCUT_FALLBACKS],
      label: 'home-command-panel',
      handler: () => {
        triggerHomeCommandPanelShortcut()
      }
    },
    {
      key: 'dynamicIsland',
      accelerators: [DYNAMIC_ISLAND_GLOBAL_SHORTCUT, ...DYNAMIC_ISLAND_GLOBAL_SHORTCUT_FALLBACKS],
      label: 'dynamic-island',
      handler: () => {
        showDynamicIslandWindow()
      }
    },
    {
      key: 'floatingTaskHud',
      accelerators: [FLOATING_TASK_HUD_GLOBAL_SHORTCUT, ...FLOATING_TASK_HUD_GLOBAL_SHORTCUT_FALLBACKS],
      label: 'floating-task-hud',
      handler: () => {
        showFloatingTaskHudWindow()
      }
    }
  ]

  shortcutConfigs.forEach(({ key, accelerators, label, handler }) => {
    let registeredAccelerator = null

    accelerators.some((accelerator) => {
      const registered = globalShortcut.register(accelerator, handler)
      if (registered && globalShortcut.isRegistered(accelerator)) {
        registeredAccelerator = accelerator
        return true
      }
      return false
    })

    globalShortcutStatus[key] = {
      accelerator: registeredAccelerator || accelerators[0],
      registered: Boolean(registeredAccelerator),
    }

    if (!registeredAccelerator) {
      console.warn(`Failed to register global shortcut (${label}): ${accelerators.join(', ')}`)
    }
  })
}

/**
 * 等待指定后端进程退出；输入进程和超时毫秒数，退出返回 true，超时返回 false。
 *
 * @param {import('child_process').ChildProcess} targetProcess 要等待的后端子进程。
 * @param {number} timeoutMs 最大等待时长。
 * @returns {Promise<boolean>} 进程是否已在预算内退出。
 */
function waitForBackendProcessExit(targetProcess, timeoutMs) {
  if (!targetProcess || targetProcess.exitCode !== null || targetProcess.signalCode !== null) {
    return Promise.resolve(true)
  }
  return new Promise((resolve) => {
    let settled = false
    let timeout = null
    const finish = (exited) => {
      if (settled) return
      settled = true
      if (timeout) clearTimeout(timeout)
      targetProcess.off('close', onClose)
      resolve(exited)
    }
    const onClose = () => finish(true)
    targetProcess.once('close', onClose)
    timeout = setTimeout(() => finish(false), timeoutMs)
    if (targetProcess.exitCode !== null || targetProcess.signalCode !== null) {
      finish(true)
    }
  })
}

/** 强制终止未在宽限期内退出的后端进程；输入进程，无返回值。 */
function forceTerminateBackendProcess(targetProcess) {
  if (!targetProcess || targetProcess.exitCode !== null || targetProcess.signalCode !== null) return
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(targetProcess.pid), '/f', '/t'], { windowsHide: true })
  } else {
    targetProcess.kill('SIGKILL')
  }
}

/**
 * 优雅停止 legacy 后端并等待系统确认退出；预期停止不会进入崩溃恢复分支。
 *
 * @returns {Promise<void>} 后端进程退出且 Core 状态变为 stopped 后完成。
 */
async function gracefulKillBackend() {
  const initialCapability = desktopCore.getCapability('legacy-backend')
  if (initialCapability.state === 'ready' || initialCapability.state === 'degraded') {
    desktopCore.setCapabilityState('legacy-backend', 'stopping')
  }
  const targetProcess = backendProcess
  if (!targetProcess) {
    const currentCapability = desktopCore.getCapability('legacy-backend')
    if (currentCapability.state === 'stopping' || currentCapability.state === 'starting') {
      desktopCore.setCapabilityState('legacy-backend', 'stopped')
    }
    return
  }

  legacyBackendLifecycle.markExpectedExit(targetProcess)
  try {
    if (PORT) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 2000)
      await fetch(`http://${HOST}:${PORT}/sys/shutdown`, {
        method: 'POST',
        signal: controller.signal,
      }).catch(() => undefined)
      clearTimeout(timeout)
    }
  } catch {}

  let exited = await waitForBackendProcessExit(targetProcess, 4000)
  if (!exited) {
    forceTerminateBackendProcess(targetProcess)
    exited = await waitForBackendProcessExit(targetProcess, 5000)
  }
  if (!exited) {
    legacyBackendLifecycle.consumeExpectedExit(targetProcess)
    desktopCore.setCapabilityState('legacy-backend', 'error', {
      error: {
        code: 'LEGACY_BACKEND_STOP_TIMEOUT',
        message: 'Legacy backend did not exit within the shutdown budget.',
        retryable: true,
      },
    })
    throw new Error('Legacy 后端未能在停止预算内退出')
  }
  if (backendProcess === targetProcess) {
    backendProcess = null
  }
  const currentCapability = desktopCore.getCapability('legacy-backend')
  if (currentCapability.state === 'stopping' || currentCapability.state === 'starting') {
    desktopCore.setCapabilityState('legacy-backend', 'stopped')
  }
}

/**
 * Mark the Electron lifecycle as terminating for backend restart suppression.
 *
 * @param {string} reason Quit reason used to detect update installation.
 */
function markApplicationQuitting(reason = 'quit') {
  app.isQuitting = true
  if (reason === 'update-install') {
    isInstallingUpdate = true
  }
}

/**
 * Spawn the legacy Python backend and resolve after its port handshake.
 *
 * @returns {Promise<number>} Actual local port selected by the backend.
 */
async function startBackend() {
  if (backendProcess && !backendProcess.killed) {
    return PORT
  }
  legacyRendererState.getSnapshot()

  console.log('🔍 准备启动后端进程...');
  const spawnOptions = {
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: false,
    env: {
      ...process.env,
      NODE_ENV: isDev ? 'development' : 'production',
      PYTHONIOENCODING: 'utf-8',
      PYTHONUTF8: '1',
      PYTHONUNBUFFERED: '1', // 强制 Python 实时刷新缓冲区
      OPENXNET_APP_NAME: OPENXNET_APP_NAME,
      OPENXNET_RUNTIME_ROLE: 'desktop',
      OPENXNET_USER_DATA_DIR: app.getPath('userData'),
      OPENXNET_STATIC_DIR: getDesktopStaticRoot(),
      OPENXNET_VRM_DIR: getDesktopVrAssetRoot(),
      OPENXNET_FEATURE_PACK_ROOT: process.env.OPENXNET_FEATURE_PACK_ROOT
        || path.join(app.getPath('userData'), 'feature-packs'),
      OPENXNET_GITNEXUS_RUNTIME_CONFIG: gitNexusRuntimeConfigPath,
      OPENXNET_WORKER_RPC_ORIGIN: workerRpcGateway ? workerRpcGateway.origin : '',
      OPENXNET_WORKER_RPC_TOKEN: workerRpcToken,
      OPENXNET_TASK_RPC_TOKEN: taskRpcToken,
      OPENXNET_VOICE_EXCHANGE_DIR: voiceExchangeRoot,
      OPENXNET_ASR_MODEL_DIR: asrModelRoot,
      OPENXNET_VECTOR_EXCHANGE_DIR: vectorExchangeRoot,
      OPENXNET_EMBEDDING_MODEL_DIR: embeddingModelRoot,
      OPENXNET_DOCUMENT_EXCHANGE_DIR: documentExchangeRoot,
      OPENXNET_PROVIDER_CREDENTIALS_B64: applicationProviders.getRuntimeCredentialBootstrap(),
      OPENXNET_SEARCH_CREDENTIALS_B64: applicationSearchCredentials.getRuntimeCredentialBootstrap(),
      OPENXNET_VOICE_CREDENTIALS_B64: applicationVoiceCredentials.getRuntimeCredentialBootstrap(),
      OPENXNET_HTTP_TOOL_CREDENTIALS_B64: applicationHttpToolCredentials.getRuntimeCredentialBootstrap(),
      OPENXNET_TELEGRAM_CREDENTIALS_B64: applicationTelegramCredentials.getRuntimeCredentialBootstrap(),
      OPENXNET_LIVE_PLATFORM_CREDENTIALS_B64: applicationLivePlatformCredentials.getRuntimeCredentialBootstrap(),
      OPENXNET_CODE_SANDBOX_CREDENTIALS_B64: applicationCodeSandboxCredentials.getRuntimeCredentialBootstrap(),
      OPENXNET_COMFYUI_CREDENTIALS_B64: applicationComfyUiCredentials.getRuntimeCredentialBootstrap(),
      ...(isDev ? {} : { OPENXNET_PUBLIC_RELEASE_SANITIZE: '1' }),
    }
  };

  if (process.platform === 'win32') {
    spawnOptions.windowsHide = !isDev;
  }

  const BACKEND_HOST = '127.0.0.1';
  if (globalConfig?.networkVisible === 'global') {
    console.warn('[Security] Ignoring legacy global backend exposure until an authenticated LAN gateway is available.')
  }
  const preferredPort = await resolvePreferredBackendPort(BACKEND_HOST)

  let execPath = "";
  let backendArgs = [];

  if (isDev) {
    execPath = pythonExec;
    backendArgs = ['-u', 'server.py', '--host', BACKEND_HOST, '--port', String(preferredPort)];
  } else {
    const serverExecutable = process.platform === 'win32' ? 'server.exe' : 'server';
    const resourcesPath = process.resourcesPath || path.join(process.execPath, '..', 'resources');
    execPath = path.join(resourcesPath, 'server', serverExecutable);
    backendArgs = ['--host', BACKEND_HOST, '--port', String(preferredPort)];
    spawnOptions.cwd = path.dirname(execPath);
  }

  console.log(`🚀 执行路径: ${execPath}`);
  console.log(`🔌 后端预选端口: ${preferredPort || 'system-auto'}`);

  return new Promise((resolve, reject) => {
    let isSettled = false
    let isHandshaked = false
    let startupTimeout = null
    backendProcess = spawn(execPath, backendArgs, spawnOptions);
    const currentBackendProcess = backendProcess

    const cleanup = () => {
      if (startupTimeout) {
        clearTimeout(startupTimeout)
        startupTimeout = null
      }
      if (currentBackendProcess?.stdout) {
        currentBackendProcess.stdout.off('data', onData)
      }
      if (currentBackendProcess?.stderr) {
        currentBackendProcess.stderr.off('data', onData)
      }
    }

    const settle = (resolver, value) => {
      if (isSettled) return
      isSettled = true
      cleanup()
      resolver(value)
    }

    const onData = (data) => {
      const output = data.toString();
      appendLogToBuffer('BACKEND', output);

      if (isDev) {
        safeProcessWrite(process.stdout, `[PY] ${output}`);
      }

      const match = output.match(/REAL_PORT_FOUND:(\d+)/);
      if (match && !isHandshaked) {
        const actualPort = parseInt(match[1], 10);
        if (actualPort > 0) {
          isHandshaked = true;
          PORT = actualPort;
          console.log(`✅ 握手成功！后端运行端口: ${PORT}`);
          settle(resolve, PORT);
        }
      }
    };

    currentBackendProcess.stdout.on('data', onData);
    currentBackendProcess.stderr.on('data', onData);

    currentBackendProcess.on('error', (err) => {
      console.error('❌ 后端启动失败:', err);
      if (backendProcess === currentBackendProcess) {
        backendProcess = null
      }
      settle(reject, err);
    });

    currentBackendProcess.on('close', (code) => {
      console.log(`ℹ️ 后端进程已退出 (code ${code})`);
      const expectedExit = legacyBackendLifecycle.consumeExpectedExit(currentBackendProcess)
      if (backendProcess === currentBackendProcess) {
        backendProcess = null
      }
      if (!isHandshaked) {
        settle(reject, new Error(`后端进程在分配端口前已关闭，退出码: ${code}`));
      } else if (expectedExit) {
        console.log('ℹ️ Legacy 后端已按生命周期请求正常停止。')
      } else if (!isQuitting && !backendRestartAttempted) {
        const capability = desktopCore.getCapability('legacy-backend')
        if (capability.state === 'starting' || capability.state === 'ready' || capability.state === 'degraded') {
          desktopCore.setCapabilityState('legacy-backend', 'error', {
            error: {
              code: 'LEGACY_BACKEND_EXITED',
              message: `Legacy backend exited unexpectedly with code ${code}.`,
              retryable: true,
            },
          })
        }
        backendRestartAttempted = true
        console.error('⚠️ 后端进程意外退出，尝试自动重启...')
        const mw = BrowserWindow.getAllWindows().find(w => !w.isDestroyed())
        if (mw) mw.webContents.send('backend-crashed', { code })
        desktopCore.ensureCapability('legacy-backend')
          .then(() => {
            backendRestartAttempted = false
            const w = BrowserWindow.getAllWindows().find(w => !w.isDestroyed())
            if (w) w.webContents.send('backend-restarted')
          })
          .catch((err) => {
            console.error('❌ 后端自动重启失败:', err.message)
            dialog.showErrorBox('后端服务异常', `后端进程退出 (code ${code})，自动重启失败。请手动重启应用。`)
          })
      }
    });

    startupTimeout = setTimeout(() => {
      if (!isHandshaked) {
        if (currentBackendProcess && !currentBackendProcess.killed) {
          currentBackendProcess.kill();
        }
        settle(reject, new Error('后端启动超时：未能从 Python 日志捕获 REAL_PORT_FOUND 信号'));
      }
    }, 360000 * 5);
  });
}

// 修改等待后端函数
/**
 * Poll the legacy backend until its lightweight health endpoint is available.
 *
 * @returns {Promise<void>} Completion after the backend accepts requests.
 */
async function waitForBackend() {
  const MAX_RETRIES = 240; // 最多等 120 秒 (首次启动需要更久)
  const RETRY_INTERVAL = 500;
  let retries = 0;

  console.log(`⏳ 正在等待 http://127.0.0.1:${PORT}/health 响应...`);
  console.log(`⏳ 更新后的首次启动时会花费更久的时间，请耐心等待...`);
  console.log(`⏳ The first launch after an update may take longer, please be patient...`);
  while (retries < MAX_RETRIES) {
    if (!backendProcess || backendProcess.killed) {
      throw new Error('后端进程在健康检查完成前已退出')
    }
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/health`);
      if (response.ok) {
        console.log('✨ 后端健康检查通过！');
        notifyLoadingWindowBackendReady({ port: PORT });
        scheduleMainWindowWorkspaceNavigation(140, { reveal: false });
        return;
      }
    } catch (err) {
      retries++;
      await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL));
    }
  }
  throw new Error('后端已启动但健康检查响应超时');
}

/**
 * Activate the legacy backend behind the new capability contract.
 *
 * @returns {Promise<{host: string, port: number}>} Serializable endpoint metadata.
 */
async function activateLegacyBackend() {
  await startBackend()
  await waitForBackend()
  return { host: HOST, port: PORT }
}

desktopCore.registerActivator('legacy-backend', activateLegacyBackend)

let voiceWorkerCredentialRuntimeInvalidation = Promise.resolve()

/**
 * 停止 Voice Worker，使下一次请求使用最新 Voice 与 Provider 凭据；失败仅记录固定诊断。
 *
 * @returns {void} 停止操作在串行 Promise 队列中异步执行。
 */
function invalidateVoiceWorkerCredentialRuntime() {
  voiceWorkerCredentialRuntimeInvalidation = voiceWorkerCredentialRuntimeInvalidation
    .catch(() => undefined)
    .then(() => workerSupervisor.stop('voice'))
    .catch(() => {
      console.warn('Failed to stop Voice Worker after credential update.')
    })
}

/**
 * 串行刷新 legacy 后端凭据；活动后端停止完成后自动恢复，未启动时保持按需启动。
 *
 * @returns {void} 刷新任务在生命周期协调器中异步执行。
 */
function refreshLegacyBackendCredentialRuntime() {
  void legacyBackendLifecycle.scheduleCredentialRefresh().catch((error) => {
    console.error('Failed to refresh legacy backend credentials:', error)
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send('backend-start-failed', {
          message: error instanceof Error ? error.message : String(error),
        })
      }
    }
  })
}

/**
 * 在 Provider 元数据或凭据变化后停止所有持有 Provider 视图的 Python 运行时。
 *
 * @returns {void} 各运行时通过自身监督器异步停止。
 */
function invalidateCredentialRuntimes() {
  if (executionEngineSupervisor?.getSnapshot().state !== 'stopped') {
    void executionEngineSupervisor.stop().catch((error) => {
      console.warn('Failed to restart Execution Engine after credential update:', error)
    })
  }
  invalidateVoiceWorkerCredentialRuntime()
  refreshLegacyBackendCredentialRuntime()
}

const unsubscribeApplicationProviderRuntime = applicationProviders.subscribe(invalidateCredentialRuntimes)
const unsubscribeApplicationSearchCredentialRuntime = applicationSearchCredentials.subscribe(
  invalidateCredentialRuntimes,
)

/**
 * 刷新仍消费 legacy 专属凭据的兼容后端。
 *
 * @returns {void} 活动后端异步重启，未启动后端保持按需启动。
 */
function invalidateLegacyCredentialRuntime() {
  refreshLegacyBackendCredentialRuntime()
}

/**
 * Voice 凭据变化后同时停止独立 Voice Worker 和仍提供兼容路由的 legacy 后端。
 *
 * @returns {void} Voice Worker 按需重启，活动 legacy 后端完成串行刷新后恢复。
 */
function invalidateVoiceCredentialRuntimes() {
  invalidateVoiceWorkerCredentialRuntime()
  invalidateLegacyCredentialRuntime()
}

const unsubscribeApplicationVoiceCredentialRuntime = applicationVoiceCredentials.subscribe(
  invalidateVoiceCredentialRuntimes,
)
const unsubscribeApplicationHttpToolCredentialRuntime = applicationHttpToolCredentials.subscribe(
  invalidateCredentialRuntimes,
)

let mcpCredentialRuntimeInvalidation = Promise.resolve()

/**
 * MCP、Home Assistant 或 SQL 凭据变化后停止 MCP Worker 与兼容后端，不影响其他能力。
 *
 * @returns {void} MCP Worker 停止进入可等待队列，兼容后端独立异步停止。
 */
function invalidateMcpCredentialRuntimes() {
  mcpCredentialRuntimeInvalidation = mcpCredentialRuntimeInvalidation
    .catch(() => undefined)
    .then(() => workerSupervisor.stop('mcp'))
    .catch(() => {
      console.warn('Failed to stop MCP Worker after credential update.')
    })
  invalidateLegacyCredentialRuntime()
}

const unsubscribeApplicationMcpCredentialRuntime = applicationMcpCredentials.subscribe(
  invalidateMcpCredentialRuntimes,
)

let connectorCredentialRuntimeInvalidation = Promise.resolve()

/** 停止 Connector Worker，使下一次按需启动时读取最新凭据；失败只记录固定诊断。 */
function invalidateConnectorCredentialRuntime() {
  connectorCredentialRuntimeInvalidation = connectorCredentialRuntimeInvalidation
    .catch(() => undefined)
    .then(() => workerSupervisor.stop('connectors'))
    .catch(() => {
      console.warn('Failed to stop Connector Worker after credential update.')
    })
}

const unsubscribeApplicationConnectorCredentialRuntime = applicationConnectorCredentials.subscribe(
  invalidateConnectorCredentialRuntime,
)

/**
 * Telegram Bot Token 更新后失效三个真实消费者，并保持 Voice Worker 不受影响。
 *
 * @returns {void} Connector 停止进入可等待队列，其余兼容运行时独立异步停止。
 */
function invalidateTelegramCredentialRuntimes() {
  invalidateConnectorCredentialRuntime()
  if (executionEngineSupervisor?.getSnapshot().state !== 'stopped') {
    void executionEngineSupervisor.stop().catch((error) => {
      console.warn('Failed to restart Execution Engine after Telegram credential update:', error)
    })
  }
  invalidateLegacyCredentialRuntime()
}

const unsubscribeApplicationTelegramCredentialRuntime = applicationTelegramCredentials.subscribe(
  invalidateTelegramCredentialRuntimes,
)
const unsubscribeApplicationImageHostCredentialRuntime = applicationImageHostCredentials.subscribe(
  invalidateConnectorCredentialRuntime,
)
let liveCredentialRuntimeInvalidation = Promise.resolve()

/**
 * 直播凭据变化后停止 Live Worker 和兼容后端，使下一次启动读取新凭据且不影响其他 Worker。
 *
 * @returns {void} Live Worker 停止进入可等待队列，兼容后端独立异步停止。
 */
function invalidateLivePlatformCredentialRuntimes() {
  liveCredentialRuntimeInvalidation = liveCredentialRuntimeInvalidation
    .catch(() => undefined)
    .then(() => workerSupervisor.stop('live'))
    .catch(() => {
      console.warn('Failed to stop Live Worker after credential update.')
    })
  invalidateLegacyCredentialRuntime()
}

const unsubscribeApplicationLivePlatformCredentialRuntime = applicationLivePlatformCredentials.subscribe(
  invalidateLivePlatformCredentialRuntimes,
)
const unsubscribeApplicationCodeSandboxCredentialRuntime = applicationCodeSandboxCredentials.subscribe(
  invalidateCredentialRuntimes,
)
const unsubscribeApplicationHomeAssistantCredentialRuntime = applicationHomeAssistantCredentials.subscribe(
  invalidateMcpCredentialRuntimes,
)
const unsubscribeApplicationSqlCredentialRuntime = applicationSqlCredentials.subscribe(
  invalidateMcpCredentialRuntimes,
)
const unsubscribeApplicationComfyUiCredentialRuntime = applicationComfyUiCredentials.subscribe(
  invalidateCredentialRuntimes,
)

/** Synchronize externally owned gateway credentials after any authentication change. */
function synchronizeManagedAccessCredential() {
  applicationProviders.synchronizeExternalCredentials()
}

const unsubscribeApplicationAuthRuntime = applicationAuth.subscribe(synchronizeManagedAccessCredential)

/**
 * Activate the compatibility backend only for one dynamic Local UI request.
 *
 * @returns {Promise<string>} Ready legacy loopback origin.
 */
async function activateLegacyUiBackend() {
  await beginLegacyBackendActivation()
  return `http://${HOST}:${PORT}`
}

/**
 * Start legacy backend activation without blocking Electron UI initialization.
 *
 * @returns {Promise<import('./build-ts/desktop').CapabilitySnapshot>} Shared activation promise.
 */
function beginLegacyBackendActivation() {
  if (legacyBackendActivationPromise) {
    return legacyBackendActivationPromise
  }
  const activation = desktopCore.ensureCapability('legacy-backend')
  legacyBackendActivationPromise = activation
  activation
    .then(() => {
      console.log(`Backend server is running at http://${HOST}:${PORT}`)
    })
    .catch((error) => {
      console.error('Legacy backend capability failed to start:', error)
      for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) {
          window.webContents.send('backend-start-failed', {
            message: error instanceof Error ? error.message : String(error),
          })
        }
      }
    })
    .finally(() => {
      legacyBackendActivationPromise = null
    })
  return activation
}

/**
 * Start the Task Worker schedule clock through the lightweight broker boundary.
 *
 * @returns {Promise<void>} Completion after startup is logged or reported.
 */
async function beginTaskScheduler() {
  try {
    const snapshot = await applicationTaskExecution.startScheduler()
    console.log(
      `[TaskScheduler] Worker clock ${String(snapshot.status || 'started')} `
      + `(interval=${String(snapshot.pollIntervalSeconds || 'unknown')}s, `
      + `projected=${String(snapshot.projected || 0)}, `
      + `activated=${String(snapshot.activated || 0)}, `
      + `failures=${String(snapshot.failures || 0)}, `
      + `checkpoints=${String(snapshot.checkpointTransport || 'compatibility')}, `
      + `snapshotFallback=${String(snapshot.snapshotFallbackIntervalSeconds || 'unknown')}s)`,
    )
  } catch (error) {
    console.error('[TaskScheduler] Worker clock failed to start:', error)
  }
}
// 通用下载处理函数
function handleDownloadItem(event, item, webContents) {
  // 获取主窗口用于发送消息
  const win = BrowserWindow.getAllWindows()[0];
  if (!win) return;

  const downloadId = Date.now().toString();
  
  // ★ 这里直接使用最上面定义的 activeDownloads
  // 如果这里报错，说明你没在文件顶部加 let activeDownloads = new Map();
  activeDownloads.set(downloadId, item);

  const fileName = item.getFilename();
  const filePath = item.getSavePath();

  // 1. 发送开始事件
  win.webContents.send('download-started', {
      id: downloadId,
      filename: fileName,
      totalBytes: item.getTotalBytes(),
      path: filePath
  });

  // 2. 监听状态更新
  item.on('updated', (event, state) => {
      if (state === 'interrupted') {
          win.webContents.send('download-updated', { id: downloadId, state: 'interrupted' });
      } else if (state === 'progressing') {
          if (item.isPaused()) {
              win.webContents.send('download-updated', { id: downloadId, state: 'paused' });
          } else {
              win.webContents.send('download-updated', {
                  id: downloadId,
                  state: 'progressing',
                  receivedBytes: item.getReceivedBytes(),
                  totalBytes: item.getTotalBytes(),
                  progress: item.getTotalBytes() > 0 ? item.getReceivedBytes() / item.getTotalBytes() : 0
              });
          }
      }
  });

  // 3. 监听完成
  item.once('done', (event, state) => {
      const completedPath = item.getSavePath()
      if (completedPath) {
        rememberRendererGrant(rendererGrantedFiles, completedPath)
      }
      win.webContents.send('download-done', {
          id: downloadId,
          state: state,
          path: completedPath
      });
      // 下载完成，移除引用
      activeDownloads.delete(downloadId);
  });
}

// 2. 修改监听函数，同时监听两个会话
function setupDownloadListener(win) {
    
    // A. 监听主窗口默认会话 (用于应用自身的下载)
    win.webContents.session.on('will-download', (event, item, webContents) => {
        handleDownloadItem(win, event, item, webContents);
    });

    // B. ★★★ 关键修复：监听 Webview 的隔离会话 ★★★
    // 这里的字符串必须和你 HTML 里 <webview partition="..."> 的值一模一样！
    // 你之前的代码里写的是 'persist:party-browser-session'
    const webviewSession = session.fromPartition('persist:party-browser-session');
    
    webviewSession.on('will-download', (event, item, webContents) => {
        // 让主窗口 (win) 去通知渲染进程
        handleDownloadItem(win, event, item, webContents);
    });
}


// 处理前端发来的控制指令 (暂停/继续/取消)
ipcMain.handle('download-control', (event, { id, action }) => {
  assertMainRendererSender(event)
  if (typeof id !== 'string' || !new Set(['pause', 'resume', 'cancel']).has(action)) {
    throw new Error('Download control request is invalid.')
  }
  // ★ 同样使用顶部的 activeDownloads
  const item = activeDownloads.get(id);
  
  if (!item) {
    console.log(`未找到下载任务 ID: ${id}`);
    return;
  }

  switch (action) {
    case 'pause':
      if (!item.isPaused()) item.pause();
      break;
    case 'resume':
      if (item.canResume()) item.resume();
      break;
    case 'cancel':
      item.cancel();
      break;
  }
});

// 打开文件所在文件夹
ipcMain.handle('show-item-in-folder', (event, filePath) => {
    assertMainRendererSender(event)
    const canonicalPath = typeof filePath === 'string' ? path.resolve(filePath) : ''
    if (!canonicalPath || !rendererGrantedFiles.has(canonicalPath)) {
      throw new Error('Download path is not authorized.')
    }
    shell.showItemInFolder(canonicalPath);
});

function normalizeUpdateFeedUrl(url) {
  const rawUrl = String(url || '').trim()
  if (!rawUrl) {
    return DEFAULT_UPDATE_FEED_URL
  }
  return rawUrl.endsWith('/') ? rawUrl : `${rawUrl}/`
}

function getUpdateFeedUrl() {
  for (const envKey of UPDATE_FEED_ENV_KEYS) {
    const envUrl = process.env[envKey]
    if (envUrl && String(envUrl).trim()) {
      return normalizeUpdateFeedUrl(envUrl)
    }
  }
  return DEFAULT_UPDATE_FEED_URL
}

function formatUpdateError(error) {
  const feedUrl = getUpdateFeedUrl()
  const detail = error && error.message ? error.message : String(error || '')
  const base = currentLanguage !== 'zh-CN'
    ? `The official CDN update feed is unavailable. Confirm latest.yml, the versioned installer, and .blockmap have been uploaded to ${feedUrl}`
    : `官网 CDN 更新源暂不可用，请确认 latest.yml、版本化安装包和 .blockmap 已上传到 ${feedUrl}`
  return detail ? `${base}\n[${detail}]` : base
}

// 配置自动更新
function setupAutoUpdater() {
  if (autoUpdaterConfigured) {
    return
  }
  autoUpdaterConfigured = true

  const sendUpdaterEvent = (channel, payload) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, payload)
    }
  }

  const updateFeedUrl = getUpdateFeedUrl()
  autoUpdater.setFeedURL({
    provider: 'generic',
    url: updateFeedUrl,
  })
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false

  const normalizeUpdateInfo = (info = {}) => ({
    version: info.version || null,
    releaseDate: info.releaseDate || null,
    releaseName: info.releaseName || null,
    releaseNotes: info.releaseNotes || null,
  })

  autoUpdater.on('checking-for-update', () => {
    sendUpdaterEvent('checking-for-update', {
      currentVersion: app.getVersion(),
      updateFeedUrl,
    })
  })
  autoUpdater.on('update-available', (info) => {
    updateAvailable = true
    updateDownloaded = false
    sendUpdaterEvent('update-available', normalizeUpdateInfo(info))
  })
  autoUpdater.on('update-not-available', (info) => {
    updateAvailable = false
    updateDownloaded = false
    sendUpdaterEvent('update-not-available', normalizeUpdateInfo(info))
  })
  autoUpdater.on('error', (err) => {
    sendUpdaterEvent('update-error', {
      message: formatUpdateError(err),
      details: err && err.message ? err.message : String(err || 'Update failed'),
      updateFeedUrl,
    })
  })
  autoUpdater.on('download-progress', (progressObj) => {
    sendUpdaterEvent('download-progress', {
      percent: Number(progressObj.percent || 0).toFixed(1),
      transferred: (progressObj.transferred / 1024 / 1024).toFixed(2),
      total: (progressObj.total / 1024 / 1024).toFixed(2)
    })
  })
  autoUpdater.on('update-downloaded', (info) => {
    updateDownloaded = true
    sendUpdaterEvent('update-downloaded', normalizeUpdateInfo(info))
  })

  try {
    require('electron').autoUpdater.on('before-quit-for-update', () => {
      markApplicationQuitting('update-install')
    })
  } catch (error) {
    console.warn('Failed to bind native before-quit-for-update event:', error)
  }
}

const PROTOCOL = 'sap';

// --- 1. 尽早获取单实例锁 ---
const gotTheLock = app.requestSingleInstanceLock();

// --- 2. 如果不是第一个实例，直接退出，不要执行任何其他代码 ---
if (!gotTheLock) {
  // 在 Windows 上，第二个实例启动是因为点击了协议链接
  // 我们需要解析参数传给第一个实例，然后立即退出
  const startUrl = process.argv.find(arg => arg.startsWith(`${PROTOCOL}://`));
  if (startUrl) {
    // 这里其实不需要做什么，因为 second-instance 事件会在第一个实例触发
    // 第二个实例直接退出即可
    console.log('Second instance detected with URL:', startUrl);
  }
  app.quit();
  return; // ← 关键：直接返回，阻止后续所有代码执行
}

// --- 3. 只有第一个实例才会执行到这里 ---
let pendingExtensionUrl = null;

// Windows 冷启动处理（第一个实例启动时就带有协议参数）
const startUrl = process.argv.find(arg => arg.startsWith(`${PROTOCOL}://`));
if (startUrl) {
  pendingExtensionUrl = startUrl;
}

app.on('second-instance', (event, commandLine) => {
  // 第二个实例启动时触发，在这里激活第一个实例的窗口并处理 URL
  if (!showAndFocusMainWindow()) {
    pendingMainWindowFocusRequest = true
  }
  
  // 解析命令行参数中的 URL
  const url = commandLine.find(arg => arg.startsWith(`${PROTOCOL}://`));
  handleProtocolUrl(url);
});

// 注册协议（只在第一个实例中执行）
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

ipcMain.handle('get-window-size', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return win.getSize();
});
const CHROME_VERSION = '124.0.0.0';
const CHROME_MAJOR = '124';
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');
app.commandLine.appendSwitch('enable-features', 'NetworkService,NetworkServiceInProcess');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
// 只有在获得锁（第一个实例）时才执行初始化
app.whenReady().then(async () => {
  try {
    await desktopCore.start()
    await startWorkerRpcGateway()
    await startTaskExecutionBrokerGateway()
    await startMcpToolBrokerGateway()
    await startConnectorChatBrokerGateway()
    await startConnectorVoiceBrokerGateway()
    await configureInstalledFeaturePacks()
    await startCompetitionMcpGateway()
    await startLocalUiGateway()
    void beginTaskScheduler()
    registerGlobalShortcuts();
    const mainSession = session.fromPartition('persist:main-session');

    // DEV: clear main session cache to ensure CSS updates are loaded
    if (process.env.NODE_ENV === 'development') {
      await mainSession.clearCache();
      await mainSession.clearStorageData({
        storages: [
          'appcache',
          'cachestorage',
          'cookies',
          'filesystem',
          'indexdb',
          'localstorage',
          'serviceworkers',
          'shadercache',
          'websql',
        ],
      });
      console.log('✅ [DEV] Main session cache cleared');
    }

    const partySession = session.fromPartition('persist:party-browser-session');
    configureSessionPermissions(mainSession, true)
    configureSessionPermissions(session.defaultSession, true)
    configureSessionPermissions(partySession, false)
    await applicationSystemRuntime.applyProxy()

    // 拦截请求头，进行深度伪装
    partySession.webRequest.onBeforeSendHeaders({ urls: ['*://*/*'] }, (details, callback) => {
        const headers = details.requestHeaders;
        
        // 1. 强制 UA
        headers['User-Agent'] = REAL_CHROME_UA;

        // 2. 伪造 Sec-Ch-Ua (Client Hints)
        // 这是 Google 检查的重点
        const brand = `"Chromium";v="${CHROME_MAJOR}", "Google Chrome";v="${CHROME_MAJOR}", "Not-A.Brand";v="99"`;
        headers['Sec-Ch-Ua'] = brand;
        headers['Sec-Ch-Ua-Mobile'] = '?0';
        headers['Sec-Ch-Ua-Full-Version'] = `"${CHROME_VERSION}"`;
        headers['Sec-Ch-Ua-Full-Version-List'] = brand;
        
        // 3. 平台伪装 (根据 process.platform 动态设置)
        let platform = 'Windows';
        if (process.platform === 'darwin') platform = 'macOS';
        else if (process.platform === 'linux') platform = 'Linux';
        headers['Sec-Ch-Ua-Platform'] = `"${platform}"`;

        // 4. 删除 Electron 特征头
        delete headers['Sec-Ch-Ua-Model']; // 桌面端通常没有 Model
        delete headers['Electron-Major-Version'];
        delete headers['X-Electron-App-Name'];

        callback({ requestHeaders: headers });
    });
    app.on('session-created', (sess) => {
        // console.log('发现新 Session 创建:', sess.getUserAgent()); 
        
        // 给每一个新创建的会话（包括 webview 的）都挂上下载监听
        sess.on('will-download', (event, item, webContents) => {
            console.log('捕获到下载请求 (来自 Webview/Session):', item.getFilename());
            handleDownloadItem(event, item, webContents);
        });
    });
    session.defaultSession.on('will-download', (event, item, webContents) => {
        console.log('捕获到下载请求 (来自主窗口):', item.getFilename());
        handleDownloadItem(event, item, webContents);
    });    
      // 默认配置
    global.vmcCfg = {
      receive: { enable: false, port: 39539,syncExpression: false },
      send:    { enable: false, host: '127.0.0.1', port: 39540 }
    };
    ipcMain.handle('get-vmc-config', (event) => {
      assertTrustedWindowSender(event, [mainWindow, ...vrmWindows])
      // 保证字段存在，避免 undefined
      global.vmcCfg.receive.syncExpression ??= false;
      return global.vmcCfg;
    });
    // 创建骨架屏窗口
    createSkeletonWindow()
    scheduleMainWindowWorkspaceNavigation(0, { reveal: !shouldStartHiddenOnLaunch() })
    screen.on('display-added', positionDynamicIslandWindow)
    screen.on('display-removed', positionDynamicIslandWindow)
    screen.on('display-metrics-changed', positionDynamicIslandWindow)
    screen.on('display-added', positionFloatingTaskHudWindow)
    screen.on('display-removed', positionFloatingTaskHudWindow)
    screen.on('display-metrics-changed', positionFloatingTaskHudWindow)
    if (global.vmcCfg.receive.enable) {
      try {
        const actualVmcPort = await startVMCReceiver(global.vmcCfg)
        global.vmcCfg.receive.port = actualVmcPort
      } catch (error) {
        console.error('[VMC] 启动失败，已自动关闭接收器:', error)
        global.vmcCfg.receive.enable = false
      }
    }
    // 启动后端服务（现在会自动查找可用端口）
    ipcMain.handle('get-backend-logs', (event) => {
      assertMainRendererSender(event)
      return logBuffer.join('\n');
    });
    if (IS_INTERNAL_MODE_ACTIVE) {
        try {
            // Electron 会将活动端口写入 userData 目录下的 DevToolsActivePort 文件
            const portFile = path.join(app.getPath('userData'), 'DevToolsActivePort');
            
            // 给一点点时间确保文件写入（通常 Ready 时已经有了，为了稳妥可以用个简单的轮询，这里直接读通常没问题）
            // 如果读取失败，尝试等待 500ms
            if (!fs.existsSync(portFile)) {
                await new Promise(r => setTimeout(r, 500));
            }
            
            if (fs.existsSync(portFile)) {
                const content = fs.readFileSync(portFile, 'utf8');
                // 文件格式第一行是端口号，第二行是路径
                const realPort = parseInt(content.split('\n')[0], 10);
                
                if (!isNaN(realPort)) {
                    SESSION_CDP_PORT = realPort;
                    console.log(`✅ [CDP] 成功获取系统分配内置浏览器调试端口: ${SESSION_CDP_PORT}`);
                }
            } else {
                console.error('❌ [CDP] 未找到 DevToolsActivePort 文件，无法获取端口');
            }
        } catch (e) {
            console.error('❌ [CDP] 读取端口文件失败:', e);
        }
    }

    ipcMain.handle('open-external-url', async (event, value) => {
      assertMainRendererSender(event)
      return shell.openExternal(assertSafeExternalUrl(value))
    })

    ipcMain.handle('open-authorized-path', async (event, candidatePath) => {
      assertMainRendererSender(event)
      if (!isAuthorizedRendererPath(
        candidatePath,
        getRendererOpenRoots(),
        rendererGrantedFiles,
        [...rendererGrantedDirectories],
      )) {
        throw new Error('Renderer path is not authorized.')
      }
      return shell.openPath(path.resolve(candidatePath))
    })

    ipcMain.handle('open-app-directory', async (event) => {
      assertMainRendererSender(event)
      return shell.openPath(app.getAppPath())
    })

    ipcMain.handle('open-uploaded-file', async (event, value) => {
      assertMainRendererSender(event)
      const filename = assertSafeDownloadFilename(value)
      const uploadPath = path.join(app.getPath('userData'), 'uploaded_files', filename)
      const stat = await fs.promises.stat(uploadPath)
      if (!stat.isFile()) {
        throw new Error('Uploaded file is not a regular file.')
      }
      return shell.openPath(uploadPath)
    })

    ipcMain.handle('read-authorized-file', async (event, candidatePath) => {
      assertMainRendererSender(event)
      if (!isAuthorizedRendererPath(candidatePath, [], rendererGrantedFiles, [])) {
        throw new Error('Renderer file read is not authorized.')
      }
      const canonicalPath = path.resolve(candidatePath)
      const stat = await fs.promises.stat(canonicalPath)
      if (!stat.isFile() || stat.size > MAX_RENDERER_READ_BYTES) {
        throw new Error('Renderer file is not a bounded regular file.')
      }
      return fs.promises.readFile(canonicalPath)
    })

    ipcMain.handle('get-webview-preload-url', (event) => {
      assertMainRendererSender(event)
      return pathToFileURL(path.join(__dirname, 'static', 'js', 'webview-preload.js')).toString()
    })

    // 1. 获取 CDP 状态 (前端初始化用)
    ipcMain.handle('get-internal-cdp-info', (event) => {
      assertMainRendererSender(event)
      return {
        active: IS_INTERNAL_MODE_ACTIVE,
        port: SESSION_CDP_PORT
      };
    });

    // Chrome 启动配置先写 Core，服务同时维护旧 config.json 镜像。
    ipcMain.handle('save-chrome-config', async (event, settings) => {
      assertMainRendererSender(event)
      applicationSettings.saveRuntimeSettings({
        ...applicationSettings.getRuntimeSettings(),
        chromeMCPSettings: settings,
      })
      return true;
    });

    // 添加获取端口信息的 IPC 处理
    ipcMain.handle('get-server-info', (event) => {
      assertMainRendererSender(event)
      return {
        port: PORT,
        defaultPort: DEFAULT_PORT,
        isDefaultPort: PORT === DEFAULT_PORT
      }
    })

    ipcMain.handle('set-launch-at-startup', async (event, payload) => {
      assertMainRendererSender(event)
      const options = payload && typeof payload === 'object'
        ? payload
        : { enabled: Boolean(payload), startMinimized: false }
      return updateLoginItemSettings({
        enabled: Boolean(options.enabled),
        startMinimized: Boolean(options.startMinimized),
      })
    })

    ipcMain.handle('get-launch-at-startup', async (event) => {
      assertMainRendererSender(event)
      return typeof app.getLoginItemSettings === 'function'
        ? app.getLoginItemSettings()
        : { openAtLogin: false }
    })

    ipcMain.handle('set-env', async (event, arg) => {
      assertMainRendererSender(event)
      if (!arg || arg.key !== 'networkVisible' || arg.value !== 'local') {
        throw new Error('Environment update is not allowed.')
      }
      applicationSettings.saveRuntimeSettings({
        ...applicationSettings.getRuntimeSettings(),
        networkVisible: 'local',
      })
    });
    //重启应用
    ipcMain.handle('restart-app', async (event) => {
      assertMainRendererSender(event)
      markApplicationQuitting('restart')
      await gracefulKillBackend()
      app.relaunch()
      app.exit()
    })

    ipcMain.handle('save-screenshot-direct', async (event, { buffer } = {}) => {
      assertMainRendererSender(event)
      // 1. 确定保存路径: userData/uploaded_files
      // 确保这个路径和 Python 后端挂载的静态目录一致
      const uploadDir = path.join(app.getPath('userData'), 'uploaded_files');
      
      // 2. 确保目录存在
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // 3. 生成文件名
      const filename = `screenshot-${Date.now()}-${Math.random().toString(36).substr(2, 6)}.jpg`;
      const filePath = path.join(uploadDir, filename);

      // 4. 写入文件
      const image = nativeImage.createFromBuffer(toBoundedRendererBuffer(buffer))
      if (image.isEmpty()) {
        throw new Error('Screenshot payload is not a valid image.')
      }
      fs.writeFileSync(filePath, image.toJPEG(85));
      
      // 5. 只返回文件名，由前端拼接 URL
      return filename;
    });

    ipcMain.handle('open-extension-window', async (event, request) => {
      assertMainRendererSender(event)
      const extension = sanitizeExtensionWindowRequest(
        request,
        new URL(getLocalUiUrl('/')).origin,
        screen.getPrimaryDisplay().workAreaSize,
      )
      const windowConfig = {
        width: extension.width || 800,
        height: extension.height || 600,
        title: extension.name,
        webPreferences: createSecureWebPreferences({
          devTools: isDev,
        })
      };

      // 如果扩展需要透明和无边框
      if (extension.transparent) {
        Object.assign(windowConfig, {
          frame: false,
          transparent: true,
          alwaysOnTop: true,
          skipTaskbar: false,
          hasShadow: false,
          backgroundColor: 'rgba(0, 0, 0, 0)',
        });
      } else {
        // 普通窗口配置
        Object.assign(windowConfig, {
          frame: true,
          transparent: false,
          titleBarStyle: isMac ? 'hiddenInset' : 'default',
          icon: OPENXNET_WINDOW_ICON
        });
      }

      const extensionWindow = new BrowserWindow(windowConfig);
      extensionWindow.setMenuBarVisibility(false)
      configureApplicationWindow(extensionWindow)
      await extensionWindow.loadURL(extension.url);
      return extensionWindow.id;
    });


    ipcMain.handle('start-vrm-window', async (event, windowConfig = {}) => {
      assertMainRendererSender(event)
      const bounds = normalizeVrmWindowBounds(windowConfig)
      const vrmWindow = new BrowserWindow({
        ...bounds,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        hasShadow: false,
        acceptFirstMouse: true,
        backgroundColor: 'rgba(0, 0, 0, 0)',
        webPreferences: createSecureWebPreferences({
          webgl: true,
          devTools: isDev,
          webAudio: true,
          autoplayPolicy: 'no-user-gesture-required',
          preload: path.join(__dirname, 'static/js/vrm-preload.js')
        })
      });

      configureApplicationWindow(vrmWindow)
      vrmWindows.push(vrmWindow);
      vrmWindow.on('closed', () => {
        vrmWindows = vrmWindows.filter(w => w !== vrmWindow);
      });
      try {
        await vrmWindow.loadURL(getLocalUiUrl('/vrm.html'));
      } catch (error) {
        vrmWindows = vrmWindows.filter(w => w !== vrmWindow)
        if (!vrmWindow.isDestroyed()) vrmWindow.destroy()
        throw error
      }
      // 默认设置（不穿透，可以交互）
      vrmWindow.setIgnoreMouseEvents(false);
      vrmWindow.setAlwaysOnTop(true);

      return vrmWindow.id;  // 可选：返回窗口 ID 用于后续操作
    });
    // 👈 桌面截图
    ipcMain.handle('capture-desktop', async (event) => {
      assertMainRendererSender(event)
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1920, height: 1080 } // 可按需改
      })
      if (!sources.length) throw new Error('无法获取屏幕源')
      const pngBuffer = sources[0].thumbnail.toPNG() // 返回原生 Buffer
      return pngBuffer // 给渲染进程
    })

    ipcMain.handle('crop-desktop', async (event, { rect } = {}) => {
      assertMainRendererSender(event)
      const png = await cropDesktop(rect)          // 不管是 sharp 还是 nativeImage
      return png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength)
    })

    ipcMain.handle('show-screenshot-overlay', async (event, { hideWindow = true } = {}) => {
      assertMainRendererSender(event)
      // 1. 根据 hideWindow 参数决定是否隐藏主窗口
      if (hideWindow) {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide()
      }

      // 2. 创建全屏无框透明窗口
      const { width, height } = screen.getPrimaryDisplay().bounds
      shotOverlay = new BrowserWindow({
        x: 0, y: 0, width, height,
        frame: false, 
        transparent: true, 
        alwaysOnTop: true,
        skipTaskbar: true, 
        resizable: false, 
        movable: false,
        enableLargerThanScreen: true,
        webPreferences: createSecureWebPreferences({
          preload: path.join(__dirname, 'static/js/shotPreload.js')
        })
      })
      const overlayWindow = shotOverlay
      configureApplicationWindow(overlayWindow, [getDesktopStaticRoot()])
      shotOverlay.setIgnoreMouseEvents(false)
      await shotOverlay.loadFile(path.join(__dirname, 'static/shotOverlay.html'))
      shotOverlay.setVisibleOnAllWorkspaces(true)

      return new Promise((resolve) => {
        let settled = false
        const cleanup = () => ipcMain.removeListener('screenshot-selected', handleSelection)
        const finish = (rect) => {
          if (settled) return
          settled = true
          cleanup()
          resolve(rect)
        }
        const handleSelection = (selectionEvent, rect) => {
          if (selectionEvent.sender.id !== overlayWindow.webContents.id) return
          try {
            finish(rect === null ? null : sanitizeDesktopCropRect(rect))
          } catch (error) {
            console.warn('Rejected invalid screenshot selection:', error.message)
            finish(null)
          }
          if (!overlayWindow.isDestroyed()) overlayWindow.close()
          if (shotOverlay === overlayWindow) shotOverlay = null
        }
        ipcMain.on('screenshot-selected', handleSelection)
        overlayWindow.once('closed', () => {
          if (shotOverlay === overlayWindow) shotOverlay = null
          finish(null)
        })
      })
    })

    ipcMain.handle('cancel-screenshot-overlay', (event) => {
      assertMainRendererSender(event)
      if (shotOverlay && !shotOverlay.isDestroyed()) {
        shotOverlay.close()
        shotOverlay = null
      }
    })


    // 添加IPC处理器
    ipcMain.handle('set-ignore-mouse-events', (event, ignore, options) => {
        assertTrustedWindowSender(event, [mainWindow, ...vrmWindows])
        const win = BrowserWindow.fromWebContents(event.sender);
        win.setIgnoreMouseEvents(ignore === true, options && typeof options === 'object' ? options : undefined);
    });
    ipcMain.handle('dialog:openDirectory', async (event) => {
      assertMainRendererSender(event)
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
      });
      return rememberRendererDirectoryGrants(result);
    });
    // 添加新的IPC处理器
    ipcMain.handle('get-ignore-mouse-status', (event) => {
        assertTrustedWindowSender(event, [mainWindow, ...vrmWindows])
        const win = BrowserWindow.fromWebContents(event.sender);
        return win.isIgnoreMouseEvents();
    });
    ipcMain.handle('set-dynamic-island-surface-state', (event, nextState = {}) => {
      const senderWindow = BrowserWindow.fromWebContents(event.sender)
      if (!senderWindow || !dynamicIslandWindow || senderWindow.id !== dynamicIslandWindow.id) {
        return {
          success: false,
          state: dynamicIslandSurfaceState,
        }
      }
      return {
        success: true,
        state: applyDynamicIslandSurfaceState(nextState),
      }
    });
    ipcMain.handle('get-dynamic-island-surface-state', (event) => {
      const senderWindow = BrowserWindow.fromWebContents(event.sender)
      return {
        success: Boolean(senderWindow && dynamicIslandWindow && senderWindow.id === dynamicIslandWindow.id),
        state: dynamicIslandSurfaceState,
      }
    });
    ipcMain.handle('stop-vrm-window', (event, windowId) => {
      assertMainRendererSender(event)
      if (windowId !== undefined) {
        const win = vrmWindows.find(w => w.id === windowId);
        if (win && !win.isDestroyed()) {
          win.close();
        }
        vrmWindows = vrmWindows.filter(w => w.id !== windowId);
      } else {
        // 关闭所有窗口
        vrmWindows.forEach(win => {
          if (!win.isDestroyed()) {
            win.close();
          }
        });
        vrmWindows = [];
      }
    });
    // 统一处理下载
    ipcMain.handle('download-file', async (event, payload) => {
      const senderWindow = assertMainRendererSender(event)
      const request = sanitizeRendererDownloadRequest(payload)
      const dlItem = await download(senderWindow, request.url, {
        filename: request.filename,
        saveAs: true,
        openFolderWhenDone: true
      });
      return { success: true, savePath: dlItem.getSavePath() };
    });
    ipcMain.handle('get-app-version', (event) => {
      assertMainRendererSender(event)
      return app.getVersion()
    })
    // 检查更新IPC
    ipcMain.handle('check-for-updates', async (event) => {
      assertMainRendererSender(event)
      const updateFeedUrl = getUpdateFeedUrl()
      if (isDev) {
        console.log('Auto updates are disabled in development mode.')
        return {
          updateAvailable: false,
          updateDownloaded: false,
          currentVersion: app.getVersion(),
          updateFeedUrl,
          disabledInDev: true,
        }
      }
      try {
        const result = await autoUpdater.checkForUpdates()
        // 只返回必要的可序列化数据
        return {
          updateAvailable: updateAvailable,
          updateDownloaded: updateDownloaded,
          currentVersion: app.getVersion(),
          updateFeedUrl,
          updateInfo: result ? {
            version: result.updateInfo.version,
            releaseDate: result.updateInfo.releaseDate
          } : null
        }
      } catch (error) {
        console.error('检查更新出错:', error)
        return { 
          updateAvailable: false, 
          updateDownloaded: false,
          currentVersion: app.getVersion(),
          updateFeedUrl,
          error: formatUpdateError(error),
          details: error && error.message ? error.message : String(error || '')
        }
      }
    })

    // 下载更新IPC
    ipcMain.handle('download-update', async (event) => {
      assertMainRendererSender(event)
      if (isDev) {
        return {
          success: false,
          disabledInDev: true,
          message: 'Auto updates are disabled in development mode.',
        }
      }
      if (!updateAvailable) {
        return {
          success: false,
          message: 'No update is currently available.',
        }
      }
      try {
        await autoUpdater.downloadUpdate()
        return { success: true }
      } catch (error) {
        console.error('下载更新出错:', error)
        return {
          success: false,
          error: formatUpdateError(error),
          details: error && error.message ? error.message : String(error || ''),
        }
      }
    })

    // 安装更新IPC
    ipcMain.handle('quit-and-install', async (event) => {
      assertMainRendererSender(event)
      if (!updateDownloaded) {
        return {
          success: false,
          message: 'Update has not finished downloading.',
        }
      }
      try {
        markApplicationQuitting('update-install')
        await gracefulKillBackend()
        autoUpdater.quitAndInstall()
        return { success: true }
      } catch (error) {
        console.error('安装更新出错:', error)
        isInstallingUpdate = false
        return {
          success: false,
          error: error && error.message ? error.message : String(error || ''),
        }
      }
    });
            
    // 加载主页面
    ipcMain.handle('open-dynamic-island-window', async (event) => {
      assertTrustedWindowSender(event, [mainWindow, dynamicIslandWindow, floatingTaskHudWindow])
      return await showDynamicIslandWindow()
    })
    ipcMain.handle('close-dynamic-island-window', async (event) => {
      assertTrustedWindowSender(event, [mainWindow, dynamicIslandWindow, floatingTaskHudWindow])
      return hideDynamicIslandWindow()
    })
    ipcMain.handle('toggle-dynamic-island-window', async (event) => {
      assertMainRendererSender(event)
      return await toggleDynamicIslandWindow()
    })
    ipcMain.handle('get-dynamic-island-window-state', (event) => {
      assertMainRendererSender(event)
      return getDynamicIslandWindowState()
    })
    ipcMain.handle('open-floating-task-hud-window', async (event) => {
      assertMainRendererSender(event)
      await ensureFloatingTaskHudWindow()
      return { success: true }
    })
    ipcMain.handle('close-floating-task-hud-window', async (event) => {
      assertTrustedWindowSender(event, [mainWindow, floatingTaskHudWindow])
      return closeFloatingTaskHudWindow()
    })
    ipcMain.handle('get-current-language', (event) => {
      assertTrustedWindowSender(event, [mainWindow, dynamicIslandWindow, floatingTaskHudWindow])
      return currentLanguage
    })
    ipcMain.handle('get-global-shortcut-status', (event) => {
      assertMainRendererSender(event)
      return globalShortcutStatus
    })

    // Dynamic Island 改为按需打开，避免默认随应用启动占用桌面。
    ipcMain.on('set-language', (event, lang) => {
      assertMainRendererSender(event)
      if (!new Set(['auto', 'zh-CN', 'en-US']).has(lang)) return
      if (lang === 'auto') {
        // 获取系统设置，默认是'en-US'，如果系统语言是中文，则设置为'zh-CN'
        const systemLang = app.getLocale().split('-')[0];
        lang = systemLang === 'zh' ? 'zh-CN' : 'en-US';
      }
      currentLanguage = lang;
      updateTrayMenu();
      updatecontextMenu();
    });
    // 创建系统托盘
    createTray();
    updatecontextMenu();
    // ★ 下面这段就是你要放的「主进程 IPC + 默认配置」
    ipcMain.handle('set-vmc-config', async (event, cfg) => {
      assertTrustedWindowSender(event, [mainWindow, ...vrmWindows])
      const nextCfg = normalizeVmcConfig(cfg)

      try {
        if (nextCfg.receive.enable) {
          if (!vmcReceiverActive || nextCfg.receive.port !== global.vmcCfg?.receive?.port) {
            if (vmcReceiverActive) stopVMCReceiver();
            const actualVmcPort = await startVMCReceiver(nextCfg);
            nextCfg.receive.port = actualVmcPort
          }
        } else {
          stopVMCReceiver();
        }
      } catch (error) {
        console.error('[VMC] 更新配置失败:', error)
        nextCfg.receive.enable = false
      }

      global.vmcCfg = nextCfg;
      BrowserWindow.getAllWindows().forEach(w => {
        if (!w.isDestroyed()) w.webContents.send('vmc-config-changed', nextCfg);
      });
      return {
        success: nextCfg.receive.enable === !!cfg?.receive?.enable,
        config: nextCfg,
      };
    });

    ipcMain.handle('send-vmc-frame', (event, frameData) => {
      assertTrustedWindowSender(event, [mainWindow, ...vrmWindows])
      if (!global.vmcCfg?.send.enable) return;

      const { host, port } = global.vmcCfg.send;
      const { bones, blends } = validateVmcFrame(frameData);
      const packets = [];

      // 1. 发送 Root (保持之前修正后的归零逻辑)
      packets.push({
        address: '/VMC/Ext/Root/Pos',
        args: [
          { type: 's', value: 'root' },
          { type: 'f', value: 0 }, { type: 'f', value: 0 }, { type: 'f', value: 0 },
          { type: 'f', value: 0 }, { type: 'f', value: 0 }, { type: 'f', value: 0 }, { type: 'f', value: 1 }
        ]
      });

      // 2. 发送骨骼 (★ 核心修复在这里)
      bones.forEach(b => {
        if (b.name === 'root') return;

        // ★ Warudo 强制要求 PascalCase (大驼峰)
        // Three.js 是 "hips", Warudo 要 "Hips"
        // Three.js 是 "leftUpperArm", Warudo 要 "LeftUpperArm"
        const vmcName = b.name.charAt(0).toUpperCase() + b.name.slice(1);

        packets.push({
          address: '/VMC/Ext/Bone/Pos',
          args: [
            { type: 's', value: vmcName },  // <--- 这里用转换后的大写名字
            { type: 'f', value: b.pos.x },
            { type: 'f', value: b.pos.y },
            { type: 'f', value: b.pos.z },
            { type: 'f', value: b.rot.x },
            { type: 'f', value: b.rot.y },
            { type: 'f', value: b.rot.z },
            { type: 'f', value: b.rot.w }
          ]
        });
      });

      // 3. 发送表情 (BlendShape 名字通常也需要对应)
      blends.forEach(blend => {
        // 表情名字我们在 vrm.js 里已经通过映射表转过了(Joy, A, I...), 这里直接用
        packets.push({
          address: '/VMC/Ext/Blend/Val',
          args: [
            { type: 's', value: blend.name },
            { type: 'f', value: blend.weight }
          ]
        });
      });

      // 4. Apply
      if (blends.length > 0) {
        packets.push({ address: '/VMC/Ext/Blend/Apply', args: [] });
      }

      // 5. OK (Warudo 必须)
      packets.push({ 
        address: '/VMC/Ext/OK', 
        args: [{ type: 'i', value: 1 }] 
      });

      // ... 发送逻辑保持不变 ...
      try {
        const bundleBuffer = osc.writePacket({
          timeTag: osc.timeTag(0),
          packets: packets
        });
        vmcSendSocket.send(bundleBuffer, port, host, (err) => {
            if (err) console.error(err);
        });
      } catch (e) { console.error(e); }
    });

    // 窗口控制事件
    ipcMain.handle('window-action', (event, action) => {
      const senderWindow = assertTrustedWindowSender(
        event,
        [mainWindow, dynamicIslandWindow, floatingTaskHudWindow],
      )
      const targetWindow = action === 'show' ? mainWindow : senderWindow
      if (!targetWindow || targetWindow.isDestroyed()) {
        return false
      }

      switch (action) {
        case 'show':
          showAndFocusMainWindow()
          break
        case 'hide':
          targetWindow.hide()
          break
        case 'minimize':
          targetWindow.minimize()
          break
        case 'maximize':
        case 'toggle-maximize':
          if (targetWindow.isFullScreen()) {
            exitBorderlessFullscreen(targetWindow)
          }
          targetWindow.isMaximized() ? targetWindow.unmaximize() : targetWindow.maximize()
          break
        case 'restore':
          if (targetWindow.isFullScreen()) {
            exitBorderlessFullscreen(targetWindow)
          }
          if (targetWindow.isMaximized()) {
            targetWindow.unmaximize()
          } else if (targetWindow.isMinimized()) {
            targetWindow.restore()
          }
          break
        case 'enter-fullscreen':
          enterBorderlessFullscreen(targetWindow)
          break
        case 'exit-fullscreen':
          exitBorderlessFullscreen(targetWindow)
          break
        case 'toggle-fullscreen':
          if (targetWindow.isFullScreen()) {
            exitBorderlessFullscreen(targetWindow)
          } else {
            enterBorderlessFullscreen(targetWindow)
          }
          break
        case 'close':
          targetWindow.close()
          break
        default:
          return false
      }
      emitWindowState(targetWindow)
      return getWindowStatePayload(targetWindow)
    })
    ipcMain.handle('get-window-state', (event) => {
      return getWindowStatePayload(assertMainRendererSender(event))
    })
    ipcMain.handle('toggle-window-size', async (event, { width, height }) => {
      const win = assertMainRendererSender(event)
      const workArea = screen.getDisplayMatching(win.getBounds()).workAreaSize
      const minimumWidth = Math.min(MAIN_WINDOW_MIN_WIDTH, workArea.width)
      const minimumHeight = Math.min(MAIN_WINDOW_MIN_HEIGHT, workArea.height)
      width = clampDynamicIslandMetric(width, minimumWidth, workArea.width, minimumWidth)
      height = clampDynamicIslandMetric(height, minimumHeight, workArea.height, minimumHeight)

      if (win.isMaximized()) {
        // 1. 开始还原
        win.unmaximize();

        if (isMac){
          // 2. 等到连续 50 ms 内尺寸不再变化，才算“真正还原完成”
          let last = win.getNormalBounds();
          for (let i = 0; i < 10; i++) {          // 最多 500 ms
            await new Promise(r => setTimeout(r, 50));
            const curr = win.getNormalBounds();
            if (curr.width === last.width && curr.height === last.height) break;
            last = curr;
          }
        }else {
          // 2. 等窗口“彻底”变成普通状态
          for (let i = 0; i < 20; i++) {          // 最多 1 s
            await new Promise(r => setTimeout(r, 50));
            if (!win.isMaximized()) break;        // 真正退出后即可跳出
          }
        }


        // 3. 现在再改助手尺寸，系统不会再覆盖
        win.setSize(width, height, true);
      } else {
        if (isMac) {
            win.maximize();
        }else{
            win.setSize(width, height, true);
        }
      }
    });

    ipcMain.handle('set-always-on-top', (e, flag) => {
      const win = assertMainRendererSender(e)
      win.setAlwaysOnTop(flag === true, 'screen-saver');
    });
    mainWindow.on('resize', () => {
      const size = mainWindow.getSize();
      mainWindow.webContents.send('window-resized', size);
      emitWindowState(mainWindow)
    });

    // ★ 新增：增强型复制函数（同时支持粘贴为图片和粘贴为文件）
    function copyImageToClipboardWithFile(image) {
      try {
        // 1. 保存图片到临时目录
        const tempDir = os.tmpdir();
        // 生成带时间戳的文件名，避免冲突
        const fileName = `image_${Date.now()}.png`;
        const filePath = path.join(tempDir, fileName);
        
        // 将 nativeImage 转换为 buffer 并写入磁盘
        const buffer = image.toPNG();
        fs.writeFileSync(filePath, buffer);

        // 2. 准备剪贴板数据对象
        const clipboardData = {
          image: image, // 写入位图数据 (用于粘贴到聊天框/PS)
        };

        // 3. 根据系统添加文件路径数据 (用于粘贴到文件夹)
        if (process.platform === 'win32') {
          // --- Windows (CF_HDROP) ---
          // 构造 DROPFILES 结构体
          // 结构: offset(4) + pt(8) + fNC(4) + fWide(4) + path(UTF16) + double-null
          const pathBuffer = Buffer.from(filePath, 'ucs2');
          const dropFiles = Buffer.alloc(20 + pathBuffer.length + 4);
          
          dropFiles.writeUInt32LE(20, 0); // pFiles (offset)
          dropFiles.writeUInt32LE(1, 16); // fWide (Unicode flag)
          pathBuffer.copy(dropFiles, 20); // 写入路径
          dropFiles.writeUInt32LE(0, 20 + pathBuffer.length); // 结尾的双 null

          clipboardData['CF_HDROP'] = dropFiles;
          
        } else if (process.platform === 'darwin') {
          // --- macOS (NSFilenamesPboardType) ---
          // 写入 Property List XML
          const plist = `
            <?xml version="1.0" encoding="UTF-8"?>
            <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
            <plist version="1.0">
              <array>
                <string>${filePath}</string>
              </array>
            </plist>
          `;
          clipboardData['NSFilenamesPboardType'] = plist;
        }
        // Linux 通常支持 text/uri-list，这里暂从略，如有需要可补充

        // 4. 一次性写入所有格式
        clipboard.write(clipboardData);
        
        console.log(`已复制图片及文件路径: ${filePath}`);

      } catch (err) {
        console.error('增强复制失败，回退到普通复制:', err);
        // 如果出错，至少尝试写入纯图片
        clipboard.writeImage(image);
      }
    }

    // 修改 show-context-menu 的 IPC 处理

    ipcMain.handle('show-context-menu', async (event, request = {}) => {
      const win = assertMainRendererSender(event)
      const menuType = typeof request.menuType === 'string' ? request.menuType : 'default'
      const data = request.data && typeof request.data === 'object' ? request.data : {}
      let menuTemplate = [];
      
      // 直接使用 locales[currentLanguage]
      const lang = locales[currentLanguage]; 

      // --- A. 图片菜单 ---
      if (menuType === 'image') {
        const source = typeof data.src === 'string' ? data.src : ''
        const isDataImage = /^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(source)
          && source.length <= Math.ceil(MAX_SCREENSHOT_BUFFER_BYTES * 1.5)
        const safeNetworkSource = isDataImage ? '' : assertSafeDownloadUrl(source)
        menuTemplate = [
          {
            label: lang.openNewTab,
            click: () => {
              if (safeNetworkSource) win.webContents.send('create-tab', safeNetworkSource);
            }
          },
          { type: 'separator' },
          {
            label: lang.copyImageLink,
            click: () => clipboard.writeText(source)
          },
          {
            label: lang.copyImage,
            click: async () => {
              try {
                if (isDataImage) {
                  const image = nativeImage.createFromDataURL(source);
                  clipboard.writeImage(image);
                } else {
                  const { image } = await fetchBoundedContextImage(safeNetworkSource)
                  clipboard.writeImage(image);
                }
              } catch (error) {
                console.error('复制图片失败:', error);
              }
            }
          },
          {
            label: lang.saveImageAs,
            click: async () => {
              try {
                let buffer = null;
                let defaultExtension = 'png';

                if (isDataImage) {
                  const image = nativeImage.createFromDataURL(source);
                  if (image.isEmpty()) throw new Error('Image data is invalid.')
                  buffer = image.toPNG();
                } else {
                  ({ buffer } = await fetchBoundedContextImage(safeNetworkSource))
                  const lowerSrc = safeNetworkSource.toLowerCase();
                  if (lowerSrc.endsWith('.jpg') || lowerSrc.endsWith('.jpeg')) defaultExtension = 'jpg';
                  else if (lowerSrc.endsWith('.gif')) defaultExtension = 'gif';
                  else if (lowerSrc.endsWith('.webp')) defaultExtension = 'webp';
                }

                const { filePath } = await dialog.showSaveDialog(win, {
                  title: lang.saveImageAs,
                  defaultPath: `image_${Date.now()}.${defaultExtension}`,
                  filters: [
                    { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] },
                    { name: 'All Files', extensions: ['*'] }
                  ]
                });

                if (filePath) {
                  fs.writeFileSync(filePath, buffer);
                }
              } catch (error) {
                console.error('图片另存为失败:', error);
                dialog.showErrorBox('保存失败', '无法保存该图片: ' + error.message);
              }
            }
          }
        ];
      } 
      // --- B. 链接菜单 ---
      else if (menuType === 'link') {
        const safeUrl = assertSafeExternalUrl(data.url)
        const linkText = typeof data.text === 'string' ? data.text.slice(0, 4096) : ''
        menuTemplate = [
          {
            label: lang.openNewTab,
            click: () => {
              if (safeUrl.startsWith('mailto:')) {
                void shell.openExternal(safeUrl)
              } else {
                win.webContents.send('create-tab', safeUrl);
              }
            }
          },
          { type: 'separator' },
          {
            label: lang.copyLink,
            click: () => clipboard.writeText(safeUrl)
          },
          {
            label: lang.copyLinkText,
            click: () => clipboard.writeText(linkText)
          }
        ];
      }
      // --- C. 纯文本/选区菜单 ---
      else if (menuType === 'text') {
        const selectedText = typeof data.text === 'string' ? data.text.slice(0, 4096) : ''
        menuTemplate = [
          { label: lang.copy, role: 'copy' },
          { 
            label: `Search "${selectedText.length > 15 ? selectedText.slice(0, 15) + '...' : selectedText}"`,
            click: () => {
               win.webContents.send('trigger-search', `Search "${selectedText}"`);
            } 
          },
          { type: 'separator' },
          { label: lang.selectAll, role: 'selectAll' }
        ];
      }
      // --- D. 默认/空白处菜单 ---
      else {
        menuTemplate = [
          { label: lang.cut, role: 'cut' },
          { label: lang.copy, role: 'copy' },
          { label: lang.paste, role: 'paste' },
          { type: 'separator' },
          { label: lang.selectAll, role: 'selectAll' }
        ];
      }

      // --- E. 开发模式下添加检查元素 ---
      if (isDev) {
        menuTemplate.push({ type: 'separator' });
        menuTemplate.push({
          label: lang.inspect,
          click: () => {
            win.webContents.openDevTools({ mode: 'detach' });
          }
        });
      }

      menu = Menu.buildFromTemplate(menuTemplate);
      menu.popup({ window: win });
    });

    // 监听关闭事件
    ipcMain.handle('request-stop-qqbot', async (event) => {
      const win = BrowserWindow.getAllWindows()[0]; // 获取主窗口
      if (win && !win.isDestroyed()) {
        // 通过webContents执行渲染进程方法
        await win.webContents.executeJavaScript(`
          window.stopQQBotHandler && window.stopQQBotHandler()
        `);
      }
    });
    ipcMain.handle('request-stop-feishubot', async (event) => {
      const win = BrowserWindow.getAllWindows()[0]; // 获取主窗口
      if (win && !win.isDestroyed()) {
        // 通过webContents执行渲染进程方法
        await win.webContents.executeJavaScript(`
          window.stopFeishuBotHandler && window.stopFeishuBotHandler()
        `);
      }
    });
    ipcMain.handle('request-stop-dingtalk', async (event) => {
      const win = BrowserWindow.getAllWindows()[0];
      if (win && !win.isDestroyed()) {
        // 执行渲染进程(Vue)中挂载的清理方法
        await win.webContents.executeJavaScript(`
          window.stopDingtalkBotHandler && window.stopDingtalkBotHandler()
        `);
      }
    });
    ipcMain.handle('request-stop-telegrambot', async (event) => {
      const win = BrowserWindow.getAllWindows()[0]; // 获取主窗口
      if (win && !win.isDestroyed()) {
        // 通过webContents执行渲染进程方法
        await win.webContents.executeJavaScript(`
          window.stopTelegramBotHandler && window.stopTelegramBotHandler()
        `);
      }
    });
    ipcMain.handle('request-stop-discordbot', async (event) => {
      const win = BrowserWindow.getAllWindows()[0]; // 获取主窗口
      if (win && !win.isDestroyed()) {
        // 通过webContents执行渲染进程方法
        await win.webContents.executeJavaScript(`
          window.stopDiscordBotHandler && window.stopDiscordBotHandler()
        `);
      }
    });
    ipcMain.handle('request-stop-slackbot', async (event) => {
      const win = BrowserWindow.getAllWindows()[0];
      if (win && !win.isDestroyed()) {
        await win.webContents.executeJavaScript(`
          window.stopSlackBotHandler && window.stopSlackBotHandler()
        `);
      }
    });
    // 文件对话框处理器
    ipcMain.handle('open-file-dialog', async (event) => {
      assertMainRendererSender(event)
      const allAllowed = [...ALLOWED_EXTENSIONS, ...ALLOWED_IMAGE_EXTENSIONS];
      const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [
          { name: locales[currentLanguage].supportedFiles, extensions: allAllowed },
          { name: locales[currentLanguage].allFiles, extensions: ['*'] }
        ]
      })
      return rememberRendererFileGrants(result)
    })
    ipcMain.handle('open-image-dialog', async (event) => {
      assertMainRendererSender(event)
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
          { name: locales[currentLanguage].supportedimages, extensions: ALLOWED_IMAGE_EXTENSIONS },
          { name: locales[currentLanguage].allFiles, extensions: ['*'] }
        ]
      })
      // 返回包含文件名和路径的对象数组
      return rememberRendererFileGrants(result)
    });

  } catch (err) {
    console.error('启动失败:', err)
    if (loadingWindow && !loadingWindow.isDestroyed()) {
      loadingWindow.close()
    }
    dialog.showErrorBox('启动失败', `服务启动失败: ${err.message}`)
    app.quit()
  }
})



// 应用退出处理
app.on('before-quit', async (event) => {
  // 防止重复处理退出事件
  if (isQuitting) return;
  
  // 标记退出状态并阻止默认退出行为 (以便我们执行异步操作)
  isQuitting = true;
  app.isQuitting = true;
  event.preventDefault();
  
  console.log(isInstallingUpdate ? '正在准备安装更新并退出应用...' : '正在准备退出应用...');

  try {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    
    // Compatibility bot cleanup must never activate a backend that is already stopped.
    if (mainWindow && !mainWindow.isDestroyed() && backendProcess && !backendProcess.killed) {
      await mainWindow.webContents.executeJavaScript(`
        if (window.stopQQBotHandler) window.stopQQBotHandler();
        if (window.stopFeishuBotHandler) window.stopFeishuBotHandler();
        if (window.stopDingtalkBotHandler) window.stopDingtalkBotHandler();
        if (window.stopDiscordBotHandler) window.stopDiscordBotHandler();
        if (window.stopTelegramBotHandler) window.stopTelegramBotHandler();
        if (window.stopSlackBotHandler) window.stopSlackBotHandler();
      `);
      // 给前端一点时间清理
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Stop Renderer activity before IPC handlers and storage services are closed.
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.destroy()
    }

    // 2. 优雅关闭后端进程
    await gracefulKillBackend()
    applicationTaskExecution.close()
    applicationLiveRuntime.close()
    if (workerRpcGateway) {
      await workerRpcGateway.stop()
      workerRpcGateway = null
    }
    if (taskExecutionBrokerGateway) {
      await taskExecutionBrokerGateway.stop()
      taskExecutionBrokerGateway = null
    }
    if (mcpToolBrokerGateway) {
      await mcpToolBrokerGateway.stop()
      mcpToolBrokerGateway = null
    }
    if (competitionMcpGateway) {
      await competitionMcpGateway.stop()
      competitionMcpGateway = null
    }
    applicationChat.close()
    if (executionEngineSupervisor) {
      await executionEngineSupervisor.stop()
    }
    await workerSupervisor.stopAll()
    if (connectorChatBrokerGateway) {
      await connectorChatBrokerGateway.stop()
      connectorChatBrokerGateway = null
    }
    if (connectorVoiceBrokerGateway) {
      await connectorVoiceBrokerGateway.stop()
      connectorVoiceBrokerGateway = null
    }
    for (const unsubscribe of workerCapabilityUnsubscribers.splice(0)) {
      unsubscribe()
    }
    if (localUiGateway) {
      await localUiGateway.stop()
      localUiGateway = null
    }
    await applicationExtensionRuntime.close()
    await desktopCore.stop()

  } catch (error) {
    console.error('退出时发生错误:', error);
  } finally {
    // 4. 最终退出 Electron
    globalShortcut.unregisterAll();
    if (tray) {
      tray.destroy();
      tray = null;
    }
    unregisterDesktopCoreIpc();
    unregisterApplicationSettingsIpc();
    unregisterApplicationAuthIpc();
    unregisterApplicationAccessIpc();
    unregisterApplicationProvidersIpc();
    unregisterApplicationAgentRuntimeIpc();
    unregisterApplicationSearchCredentialsIpc();
    unregisterApplicationVoiceCredentialsIpc();
    unregisterApplicationVoiceRuntimeIpc();
    unregisterApplicationVrmPresentationIpc();
    unregisterApplicationSystemRuntimeIpc();
    unregisterApplicationMcpCredentialsIpc();
    unregisterApplicationMcpRuntimeIpc();
    unregisterApplicationHttpToolCredentialsIpc();
    unregisterApplicationConnectorCredentialsIpc();
    unregisterApplicationConnectorRuntimeIpc();
    unregisterApplicationLiveRuntimeIpc();
    unregisterApplicationDesktopControlRuntimeIpc();
    unregisterApplicationToolchainRuntimeIpc();
    unregisterApplicationDeveloperWorkbenchRuntimeIpc();
    unregisterApplicationVrAssetIpc();
    unregisterApplicationExtensionRuntimeIpc();
    unregisterApplicationSkillRuntimeIpc();
    unregisterApplicationEnterpriseRuntimeIpc();
    unregisterApplicationAgentTeamsRuntimeIpc();
    unregisterApplicationCompetitionRuntimeIpc();
    unregisterApplicationEnterpriseInsightsRuntimeIpc();
    unregisterApplicationKernelRuntimeIpc();
    unregisterApplicationModelAssetIpc();
    unregisterApplicationRecallRuntimeIpc();
    unregisterApplicationMemoryManagementIpc();
    unregisterApplicationTelegramCredentialsIpc();
    unregisterApplicationImageHostCredentialsIpc();
    unregisterApplicationRepositoryCredentialsIpc();
    unregisterApplicationLivePlatformCredentialsIpc();
    unregisterApplicationCodeSandboxCredentialsIpc();
    unregisterApplicationHomeAssistantCredentialsIpc();
    unregisterApplicationSqlCredentialsIpc();
    unregisterApplicationComfyUiCredentialsIpc();
    unregisterApplicationDeliveryCredentialsIpc();
    unregisterApplicationArtifactsIpc();
    unregisterApplicationTasksIpc();
    unregisterApplicationTaskExecutionIpc();
    unregisterApplicationChatIpc();
    unregisterApplicationKnowledgeBaseRuntimeIpc();
    unregisterLegacyRendererStateIpc();
    unregisterDesktopBootstrapIpc();
    applicationTasks.close();
    applicationArtifacts.close();
    unsubscribeApplicationAuthRuntime();
    applicationAuth.close();
    unsubscribeApplicationProviderRuntime();
    applicationProviders.close();
    unsubscribeApplicationSearchCredentialRuntime();
    applicationSearchCredentials.close();
    unsubscribeApplicationVoiceCredentialRuntime();
    applicationVoiceCredentials.close();
    unsubscribeApplicationMcpCredentialRuntime();
    applicationMcpCredentials.close();
    unsubscribeApplicationHttpToolCredentialRuntime();
    applicationHttpToolCredentials.close();
    unsubscribeApplicationConnectorCredentialRuntime();
    applicationConnectorCredentials.close();
    unsubscribeApplicationTelegramCredentialRuntime();
    applicationTelegramCredentials.close();
    unsubscribeApplicationImageHostCredentialRuntime();
    applicationImageHostCredentials.close();
    applicationRepositoryCredentials.close();
    unsubscribeApplicationLivePlatformCredentialRuntime();
    applicationLivePlatformCredentials.close();
    unsubscribeApplicationCodeSandboxCredentialRuntime();
    applicationCodeSandboxCredentials.close();
    unsubscribeApplicationHomeAssistantCredentialRuntime();
    applicationHomeAssistantCredentials.close();
    unsubscribeApplicationSqlCredentialRuntime();
    applicationSqlCredentials.close();
    unsubscribeApplicationComfyUiCredentialRuntime();
    applicationComfyUiCredentials.close();
    applicationDeliveryCredentials.close();
    applicationSettings.close();
    app.exit(0);
  }
});


// 自动退出处理
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// 处理渲染进程崩溃
app.on('render-process-gone', (event, webContents, details) => {
  console.error('渲染进程崩溃:', details)
  if (details.reason === 'crashed' || details.reason === 'oom' || details.reason === 'killed') {
    const win = BrowserWindow.getAllWindows().find(w => !w.isDestroyed() && w.webContents === webContents)
    if (win) {
      setTimeout(() => {
        if (!win.isDestroyed()) win.webContents.reload()
      }, 1000)
      return
    }
  }
  dialog.showErrorBox('应用崩溃', `渲染进程异常: ${details.reason}`)
})

// 处理主进程未捕获异常
process.on('uncaughtException', (err) => {
  if (err && err.code === 'EPIPE') {
    appendLogToBuffer('MAIN', `Suppressed stdio broken pipe: ${err.message}`);
    return;
  }
  console.error('未捕获异常:', err)
  if (loadingWindow && !loadingWindow.isDestroyed()) {
    loadingWindow.close()
  }
  dialog.showErrorBox('致命错误', `未捕获异常: ${err.message}`)
  app.quit()
})

process.on('unhandledRejection', (reason) => {
  console.error('未处理的 Promise 异常:', reason)
})

function createTray() {
  if (!tray) {
    tray = new Tray(OPENXNET_TRAY_ICON);
    tray.setToolTip('OpenXnet');
    tray.on('click', () => {
      showAndFocusMainWindow()
    });
  }
  updateTrayMenu();
}
function updateTrayMenu() {
  if (!tray) return

  const contextMenu = Menu.buildFromTemplate([
    {
      label: locales[currentLanguage].show,
      click: () => {
        showAndFocusMainWindow()
      }
    },
    {
      label: isDynamicIslandWindowVisible()
        ? (currentLanguage === 'zh-CN' ? '隐藏灵动岛' : 'Hide Dynamic Island')
        : (currentLanguage === 'zh-CN' ? '显示灵动岛' : 'Open Dynamic Island'),
      click: () => {
        toggleDynamicIslandWindow()
      }
    },
    {
      label: currentLanguage === 'zh-CN' ? '显示任务 HUD' : 'Open Task HUD',
      click: () => {
        showFloatingTaskHudWindow()
      }
    },
    { type: 'separator' },
    {
      label: locales[currentLanguage].exit,
      click: () => {
        markApplicationQuitting('tray-exit')
        app.quit()
      }
    }
  ])
  
  tray.setContextMenu(contextMenu);
}

function updatecontextMenu() {
  menu = Menu.buildFromTemplate([
    {
      label: locales[currentLanguage].cut,
      role: 'cut'
    },
    {
      label: locales[currentLanguage].copy,
      role: 'copy'
    },
    {
      label: locales[currentLanguage].paste,
      role: 'paste'
    }
  ]);
}

// app.on('web-contents-created', (e, webContents) => {
//   webContents.on('new-window', (event, url) => {
//   event.preventDefault();
//   shell.openExternal(url);
//   });
// });

app.on('web-contents-created', (event, contents) => {
  contents.on('will-attach-webview', secureWebviewAttachment)

  if (contents.getType() === 'webview') {
    const guardWebviewNavigation = (navigationEvent, url) => {
      if (!isAllowedWebviewNavigation(url)) navigationEvent.preventDefault()
    }
    contents.on('will-navigate', guardWebviewNavigation)
    contents.on('will-redirect', guardWebviewNavigation)
  }

  // 拦截所有新窗口请求（包括 <webview> 内部的 window.open 和 target="_blank"）
  contents.setWindowOpenHandler((details) => {
    try {
      const safeUrl = assertSafeExternalUrl(details.url)
      const parsedUrl = new URL(safeUrl)
      if (parsedUrl.protocol === 'mailto:') {
        void shell.openExternal(safeUrl).catch((error) => {
          console.warn('Failed to open mail link:', error.message)
        })
      } else if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('create-tab', safeUrl);
      }
    } catch (error) {
      console.warn('Blocked unsafe window-open URL:', error.message)
    }
    return { action: 'deny' };
  });

  // (保留你原有的代码：拦截侧键后退等)
  contents.on('input-event', (_ev, input) => {
    if (input.type === 'mouseDown' && (input.button === 3 || input.button === 4)) {
      contents.stopNavigation();
    }
  });
  contents.on('before-input-event', (inputEvent, input) => {
    const { alt, key } = input;
    if (alt && (key === 'Left' || key === 'Right')) {
      inputEvent.preventDefault();
    }
  });
});
app.commandLine.appendSwitch('disable-http-cache');

// --- [修改后的 3] 协议处理核心函数 & IPC ---

/**
 * Parse one bounded custom-protocol installation request.
 *
 * @param {unknown} value Candidate protocol URL.
 * @returns {{type: string, repo: string|null, mcpType: string|null, config: string|null}|null} Safe request.
 */
function parseProtocolInstallRequest(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 65_536) return null
  const url = new URL(value)
  if (url.protocol !== `${PROTOCOL}:` || url.hostname !== 'install') return null
  const type = url.searchParams.get('type')
  const repo = url.searchParams.get('repo')
  const mcpType = url.searchParams.get('mcpType')
  const config = url.searchParams.get('config')
  if (!new Set(['extension', 'mcp', 'skill']).has(type)) return null
  if (repo !== null && (repo.length === 0 || repo.length > 2_048 || /[\u0000-\u001F]/.test(repo))) return null
  if (config !== null && (config.length === 0 || config.length > 32_768 || config.includes('\0'))) return null
  if (mcpType !== null && !/^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(mcpType)) return null
  if (repo === null && config === null) return null
  return { type, repo, mcpType, config }
}

/**
 * Deliver a validated custom-protocol request to the workspace or pending queue.
 *
 * @param {unknown} url Candidate protocol URL.
 * @returns {void}
 */
function handleProtocolUrl(url) {
  if (!url) return;
  try {
    const payload = parseProtocolInstallRequest(url)
    if (!payload) return
    if (mainWindow && mainWindow.webContents && !mainWindow.webContents.isLoading()) {
      mainWindow.webContents.send('remote-install-any', payload);
    } else {
      pendingExtensionUrl = url;
    }
  } catch (e) { console.error('协议解析失败:', e); }
}

// 对应的 check-pending-install 也要改
ipcMain.handle('check-pending-install', (event) => {
  assertMainRendererSender(event)
  if (pendingExtensionUrl) {
    try {
      const res = parseProtocolInstallRequest(pendingExtensionUrl)
      pendingExtensionUrl = null;
      return res;
    } catch (e) { return null; }
  }
  return null;
});

// macOS 监听 (Mac 下点击链接触发这里)
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleProtocolUrl(url);
});
