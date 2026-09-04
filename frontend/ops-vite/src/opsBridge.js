function getHostApp() {
  return typeof window !== 'undefined' ? window.openxnetApp || null : null;
}

const featurePackRuntime = {
  snapshot: null,
  loading: false,
  request: null,
  error: null,
  progress: {},
  unsubscribe: null,
};

const synapxnetMemoryRuntime = {
  status: null,
  recovery: null,
  recoveryAttempted: false,
  items: [],
  selectedMemoryId: '',
  selectedMemory: null,
  history: [],
  integrity: null,
  actorAgent: '',
  query: '',
  includeRetired: false,
  loading: false,
  error: '',
};

const featurePackDefinitions = [
  {
    capabilityId: 'voice',
    icon: 'fa-solid fa-microphone-lines',
    nameZh: '语音与识别',
    nameEn: 'Voice and ASR',
    descriptionZh: '本地语音识别、转写与音频处理运行时。',
    descriptionEn: 'Local speech recognition, transcription, and audio runtime.',
  },
  {
    capabilityId: 'vector-index',
    icon: 'fa-solid fa-vector-square',
    nameZh: '向量索引',
    nameEn: 'Vector Index',
    descriptionZh: '本地向量嵌入、索引与语义检索运行时。',
    descriptionEn: 'Local embedding, indexing, and semantic retrieval runtime.',
  },
  {
    capabilityId: 'memory',
    icon: 'fa-solid fa-brain',
    nameZh: '长期记忆',
    nameEn: 'Long-term Memory',
    descriptionZh: '长期记忆存储、召回与关联处理运行时。',
    descriptionEn: 'Long-term memory storage, recall, and association runtime.',
  },
  {
    capabilityId: 'documents',
    icon: 'fa-solid fa-file-lines',
    nameZh: '文档处理',
    nameEn: 'Document Processing',
    descriptionZh: 'Office、PDF 与结构化文档提取运行时。',
    descriptionEn: 'Office, PDF, and structured document extraction runtime.',
  },
  {
    capabilityId: 'connectors',
    icon: 'fa-solid fa-plug',
    nameZh: '外部连接器',
    nameEn: 'External Connectors',
    descriptionZh: 'QQ、飞书、钉钉、Discord 与 Slack 连接器。',
    descriptionEn: 'QQ, Feishu, DingTalk, Discord, and Slack connectors.',
  },
  {
    capabilityId: 'gitnexus',
    icon: 'fa-solid fa-code-branch',
    nameZh: '代码知识图谱',
    nameEn: 'GitNexus',
    descriptionZh: '代码索引、关系图谱与仓库上下文运行时。',
    descriptionEn: 'Code indexing, relationship graph, and repository context runtime.',
  },
];

/**
 * Return the isolated Desktop Core API when running inside Electron.
 *
 * @returns {object|null} Typed preload API or null in browser preview.
 */
function getDesktopCoreApi() {
  return typeof window !== 'undefined' ? window.openxnetDesktop || null : null;
}

/**
 * Subscribe once to Feature Pack progress emitted by Electron Main.
 */
function ensureFeaturePackSubscription() {
  const api = getDesktopCoreApi();
  if (featurePackRuntime.unsubscribe || !api?.onFeaturePackProgress) return;
  featurePackRuntime.unsubscribe = api.onFeaturePackProgress((event) => {
    if (!event?.capabilityId) return;
    featurePackRuntime.progress = {
      ...featurePackRuntime.progress,
      [event.capabilityId]: { ...event },
    };
    if (event.phase === 'failed' && event.error) {
      featurePackRuntime.error = { ...event.error };
    }
  });
}

/**
 * Load Renderer-safe Feature Pack state while coalescing concurrent refreshes.
 *
 * @param {boolean} refresh Whether to refresh the signed remote catalog.
 * @returns {Promise<object|null>} Latest distribution snapshot.
 */
async function loadFeaturePacks(refresh = true) {
  const api = getDesktopCoreApi();
  if (!api?.listFeaturePacks) return null;
  ensureFeaturePackSubscription();
  if (featurePackRuntime.request) return featurePackRuntime.request;
  featurePackRuntime.loading = true;
  featurePackRuntime.request = api.listFeaturePacks({ refresh: !!refresh })
    .then((snapshot) => {
      featurePackRuntime.snapshot = snapshot;
      featurePackRuntime.error = snapshot?.error || null;
      return snapshot;
    })
    .catch((error) => {
      featurePackRuntime.error = {
        code: 'FEATURE_PACK_OPERATION_FAILED',
        message: String(error?.message || 'Feature Pack state could not be loaded.'),
        retryable: true,
      };
      return null;
    })
    .finally(() => {
      featurePackRuntime.loading = false;
      featurePackRuntime.request = null;
    });
  return featurePackRuntime.request;
}

/**
 * Run one allow-listed Feature Pack mutation through the preload bridge.
 *
 * @param {'install'|'repair'|'uninstall'} operation Requested management operation.
 * @param {string} capabilityId Allow-listed capability ID.
 * @returns {Promise<object|null>} Completed operation result.
 */
async function runFeaturePackOperation(operation, capabilityId) {
  const api = getDesktopCoreApi();
  const methods = {
    install: api?.installFeaturePack,
    repair: api?.repairFeaturePack,
    uninstall: api?.uninstallFeaturePack,
  };
  const method = methods[operation];
  if (typeof method !== 'function') return null;
  featurePackRuntime.error = null;
  featurePackRuntime.progress = {
    ...featurePackRuntime.progress,
    [capabilityId]: {
      capabilityId,
      operation,
      phase: 'preparing',
      percent: null,
      transferredBytes: null,
      totalBytes: null,
    },
  };
  try {
    return await method.call(api, { capabilityId });
  } catch (error) {
    featurePackRuntime.error = {
      code: 'FEATURE_PACK_OPERATION_FAILED',
      message: String(error?.message || 'Feature Pack operation failed.'),
      retryable: true,
    };
    throw error;
  } finally {
    await loadFeaturePacks(false);
  }
}

/**
 * Build localized Feature Pack state for the system settings surface.
 *
 * @param {boolean} isZh Whether the current interface language is Chinese.
 * @returns {object} Localized management model.
 */
function buildFeaturePackSnapshot(isZh) {
  const raw = featurePackRuntime.snapshot;
  const rawItems = new Map((raw?.packs || []).map((item) => [item.capabilityId, item]));
  return {
    available: !!getDesktopCoreApi()?.listFeaturePacks,
    loading: featurePackRuntime.loading,
    feedStatus: raw?.feedStatus || (getDesktopCoreApi() ? 'loading' : 'unavailable'),
    catalogGeneratedAt: raw?.catalogGeneratedAt || null,
    error: featurePackRuntime.error || raw?.error || null,
    items: featurePackDefinitions.map((definition) => {
      const item = rawItems.get(definition.capabilityId) || {};
      return {
        ...item,
        capabilityId: definition.capabilityId,
        icon: definition.icon,
        displayName: isZh ? definition.nameZh : definition.nameEn,
        description: isZh ? definition.descriptionZh : definition.descriptionEn,
        status: item.status || 'not-installed',
        installedVersion: item.installedVersion || null,
        availableVersion: item.availableVersion || null,
        operation: item.operation || null,
        progress: featurePackRuntime.progress[definition.capabilityId] || null,
      };
    }),
  };
}

function isCurrentLanguageZh(host) {
  if (host && typeof host.isCurrentLanguageZh === 'function') {
    try {
      return !!host.isCurrentLanguageZh();
    } catch (error) {
      return true;
    }
  }
  const language = String(host?.currentLanguage || navigator.language || 'zh-CN').toLowerCase();
  return language.startsWith('zh');
}

function getTileLabel(host, tile, isZh) {
  if (!tile) return '';
  if (isZh && tile.prototypeLabelZh) return String(tile.prototypeLabelZh);
  if (!isZh && tile.prototypeLabelEn) return String(tile.prototypeLabelEn);
  if (host && typeof host.t === 'function' && tile.title) {
    try {
      return String(host.t(tile.title) || tile.id || '');
    } catch (error) {
      return String(tile.id || '');
    }
  }
  return String(tile.title || tile.label || tile.id || '');
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function truncate(value, length = 140) {
  const text = String(value || '').trim();
  if (text.length <= length) return text;
  return `${text.slice(0, length - 1)}...`;
}

function formatDateTime(value) {
  if (!value) return '';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString();
  } catch (error) {
    return String(value);
  }
}

function mapStats(cards) {
  return toArray(cards).map((card) => ({
    label: String(card?.label || ''),
    value: String(card?.value ?? ''),
    meta: String(card?.meta || ''),
    emphasis: !!card?.emphasis,
    truncate: !!card?.truncate,
  }));
}

function onOffLabel(value, isZh) {
  return value ? (isZh ? '已启用' : 'Enabled') : (isZh ? '未启用' : 'Disabled');
}

function runningLabel(value, isZh, activeLabelZh = '运行中', activeLabelEn = 'Running') {
  return value ? (isZh ? activeLabelZh : activeLabelEn) : (isZh ? '待启动' : 'Standby');
}

function boolText(value) {
  return value ? 'true' : 'false';
}

function translate(host, key, fallback = '') {
  const value = String(key || '').trim();
  if (!value) return String(fallback || '');
  if (host && typeof host.t === 'function') {
    try {
      const translated = host.t(value);
      if (translated && translated !== value) {
        return String(translated);
      }
    } catch (error) {
      // Fall through to fallback.
    }
  }
  return String(fallback || value);
}

function mapOption(host, option, fallbackLabel = '') {
  if (typeof option === 'string') {
    return { value: option, label: fallbackLabel || option };
  }
  const value = String(option?.value ?? option?.id ?? option?.key ?? '').trim();
  const rawLabel = option?.label ?? option?.name ?? option?.title ?? value;
  return {
    value,
    label: translate(host, rawLabel, fallbackLabel || rawLabel || value),
    description: String(option?.description || option?.desc || ''),
    icon: String(option?.icon || ''),
  };
}

function surfaceMenuMap(surface) {
  const mapping = {
    deploy: 'deploy-bot',
    vrm: 'vrm',
    workbench: 'api-group',
    enterprise: 'enterprise',
    storage: 'storage',
    kernel: 'kernel',
    system: 'system',
    task: 'task-center',
    about: 'logo',
  };
  return mapping[surface] || '';
}

function buildDeploySnapshot(host, isZh) {
  const tabs = toArray(host?.deployTiles).map((tile) => ({
    id: String(tile?.id || ''),
    icon: String(tile?.icon || 'fa-solid fa-circle'),
    label: getTileLabel(host, tile, isZh),
  }));
  const activeTab = String(host?.subMenu || tabs[0]?.id || 'table_pet');
  const meta = host?.getPrototypeDeployDetailMeta?.(activeTab) || {
    title: isZh ? '部署机器人' : 'Deploy Bots',
    summary: isZh ? '配置多平台机器人连接、权限和消息路由。' : 'Configure multi-platform bot connections, permissions, and message routing.',
    chips: [],
  };
  return {
    title: isZh ? '部署机器人' : 'Deploy Bots',
    subtitle: isZh ? '配置多平台机器人连接、权限和消息路由' : 'Configure multi-platform bot connections, permissions, and message routing.',
    tabs,
    activeTab,
    meta,
    stats: mapStats(host?.getPrototypeDeployDetailStats?.(activeTab)),
    deskPet: {
      online: !!(host?.isVRMRunning || host?.vrmOnline),
      status: runningLabel(!!(host?.isVRMRunning || host?.vrmOnline), isZh, '桌宠在线', 'Online'),
      modelId: String(host?.VRMConfig?.selectedModelId || host?.VRMConfig?.name || (isZh ? '未选择模型' : 'No model')),
      expressions: onOffLabel(!!host?.VRMConfig?.enabledExpressions, isZh),
      motions: onOffLabel(!!host?.VRMConfig?.enabledMotions, isZh),
      width: Number(host?.VRMConfig?.windowWidth || 540),
      height: Number(host?.VRMConfig?.windowHeight || 960),
      userModels: toArray(host?.VRMConfig?.userModels).length,
      motionCount: toArray(host?.VRMConfig?.selectedMotionIds).length,
    },
    imChannels: [
      {
        id: 'qq',
        label: 'QQ',
        running: !!host?.isQQBotRunning,
        status: runningLabel(!!host?.isQQBotRunning, isZh),
        agent: String(host?.qqBotConfig?.QQAgent || 'openxnet-model'),
        memory: `${Number(host?.qqBotConfig?.memoryLimit || 30)} ${isZh ? '轮记忆' : 'turns'}`,
        note: `${toArray(host?.qqBotConfig?.separators).length} ${isZh ? '个分隔符' : 'separators'}`,
      },
      {
        id: 'feishu',
        label: isZh ? '飞书' : 'Feishu',
        running: !!host?.isFeishuBotRunning,
        status: runningLabel(!!host?.isFeishuBotRunning, isZh),
        agent: String(host?.feishuBotConfig?.FeishuAgent || 'openxnet-model'),
        memory: `${Number(host?.feishuBotConfig?.memoryLimit || 30)} ${isZh ? '轮记忆' : 'turns'}`,
        note: onOffLabel(!!host?.feishuBotConfig?.enableTTS, isZh),
      },
      {
        id: 'dingtalk',
        label: isZh ? '钉钉' : 'DingTalk',
        running: !!host?.isDingtalkBotRunning,
        status: runningLabel(!!host?.isDingtalkBotRunning, isZh),
        agent: String(host?.dingtalkBotConfig?.DingtalkAgent || 'openxnet-model'),
        memory: `${Number(host?.dingtalkBotConfig?.memoryLimit || 30)} ${isZh ? '轮记忆' : 'turns'}`,
        note: onOffLabel(!!host?.dingtalkBotConfig?.enableTTS, isZh),
      },
      {
        id: 'telegram',
        label: 'Telegram',
        running: !!host?.isTelegramBotRunning,
        status: runningLabel(!!host?.isTelegramBotRunning, isZh),
        agent: String(host?.telegramBotConfig?.TelegramAgent || 'openxnet-model'),
        memory: `${Number(host?.telegramBotConfig?.memoryLimit || 20)} ${isZh ? '轮记忆' : 'turns'}`,
        note: onOffLabel(!!host?.telegramBotConfig?.enableTTS, isZh),
      },
      {
        id: 'discord',
        label: 'Discord',
        running: !!host?.isDiscordBotRunning,
        status: runningLabel(!!host?.isDiscordBotRunning, isZh),
        agent: String(host?.discordBotConfig?.llm_model || 'openxnet-model'),
        memory: `${Number(host?.discordBotConfig?.memory_limit || 30)} ${isZh ? '轮记忆' : 'turns'}`,
        note: onOffLabel(!!host?.discordBotConfig?.enable_tts, isZh),
      },
      {
        id: 'slack',
        label: 'Slack',
        running: !!host?.isSlackBotRunning,
        status: runningLabel(!!host?.isSlackBotRunning, isZh),
        agent: String(host?.slackBotConfig?.llm_model || 'openxnet-model'),
        memory: `${Number(host?.slackBotConfig?.memory_limit || 30)} ${isZh ? '轮记忆' : 'turns'}`,
        note: onOffLabel(!!host?.slackBotConfig?.enable_tts, isZh),
      },
    ],
    liveChannels: [
      {
        id: 'bilibili',
        label: 'Bilibili',
        enabled: !!host?.liveConfig?.bilibili_enabled,
        status: onOffLabel(!!host?.liveConfig?.bilibili_enabled, isZh),
        note: String(host?.liveConfig?.bilibili_room_id || (isZh ? '未填写房间号' : 'No room id')),
      },
      {
        id: 'youtube',
        label: 'YouTube',
        enabled: !!host?.liveConfig?.youtube_enabled,
        status: onOffLabel(!!host?.liveConfig?.youtube_enabled, isZh),
        note: String(host?.liveConfig?.youtube_vedio_id || (isZh ? '未填写视频 ID' : 'No video id')),
      },
      {
        id: 'twitch',
        label: 'Twitch',
        enabled: !!host?.liveConfig?.twitch_enabled,
        status: onOffLabel(!!host?.liveConfig?.twitch_enabled, isZh),
        note: String(host?.liveConfig?.twitch_channel || (isZh ? '未填写频道' : 'No channel')),
      },
    ],
    liveStrategy: {
      runtime: runningLabel(!!host?.isLiveRunning, isZh, '直播中', 'Live'),
      danmakuOnly: boolText(!!host?.liveConfig?.onlyDanmaku),
      queueLimit: Number(host?.liveConfig?.danmakuQueueLimit || 5),
      wakeWord: String(host?.liveConfig?.wakeWord || (isZh ? '未设置唤醒词' : 'No wake word')),
      obsUrl: `${String(host?.partyURL || '').replace(/\/$/, '')}/vrm.html?mode=render`,
    },
    readBot: {
      runtime: runningLabel(!!host?.isReadRunning, isZh, '朗读中', 'Reading'),
      selectedFile: (() => {
        const selected = toArray(host?.textFiles).find((file) => String(file?.unique_filename || '') === String(host?.selectedFile || ''));
        return String(selected?.original_filename || selected?.unique_filename || (isZh ? '未选择文件' : 'No file selected'));
      })(),
      segments: toArray(host?.readConfig?.longTextList).length,
      preview: truncate(host?.readConfig?.longText || (isZh ? '当前还没有载入朗读内容。' : 'No reading content is loaded yet.'), 140),
      audioState: String(host?.readState?.isPlaying ? (isZh ? '播放中' : 'Playing') : (isZh ? '待播放' : 'Idle')),
    },
    translateBot: {
      runtime: String(host?.targetLangSelected || (isZh ? '系统默认' : 'system')),
      sourceLength: String(host?.sourceText || '').length,
      targetLength: String(host?.translatedText || '').length,
      busy: !!host?.isTranslating,
      sourcePreview: truncate(host?.sourceText || (isZh ? '还没有待翻译内容。' : 'No source text yet.'), 180),
      resultPreview: truncate(host?.translatedText || (isZh ? '翻译结果会显示在这里。' : 'Translated output will appear here.'), 180),
    },
    generalConfig: {
      mediaHostEnabled: onOffLabel(!!host?.BotConfig?.imgHost_enabled, isZh),
      mediaHost: String(host?.BotConfig?.imgHost || 'smms'),
      easyImage: String(host?.BotConfig?.EI2_base_url || (isZh ? '未配置 EasyImage2 地址' : 'No EasyImage2 URL')),
      githubRepo: [host?.BotConfig?.github_repo_owner, host?.BotConfig?.github_repo_name].filter(Boolean).join('/') || (isZh ? '未配置 GitHub 仓库' : 'No GitHub repository'),
      giteeRepo: [host?.BotConfig?.gitee_repo_owner, host?.BotConfig?.gitee_repo_name].filter(Boolean).join('/') || (isZh ? '未配置 Gitee 仓库' : 'No Gitee repository'),
    },
  };
}

function buildWorkbenchSnapshot(host, isZh) {
  const tabs = toArray(host?.apiTiles).map((tile) => ({
    id: String(tile?.id || ''),
    icon: String(tile?.icon || 'fa-solid fa-circle'),
    label: getTileLabel(host, tile, isZh),
  }));
  const activeTab = String(host?.subMenu || 'develop');
  const meta = host?.getPrototypeApiDetailMeta?.(activeTab) || {
    title: isZh ? '开发者工作台' : 'Developer Workbench',
    summary: isZh ? '统一查看 API 接入、开发流与本地工作区状态。' : 'Review API routes, workflows, and local workspace status in one place.',
    chips: [],
  };
  const readiness = toArray(host?.devWorkbenchOverview?.configuration_readiness?.items).map((item) => ({
    id: String(item?.id || item?.label || ''),
    label: host?.formatDevReadinessLabel?.(item?.id) || String(item?.label || ''),
    status: host?.formatDevReadinessStatus?.(item?.status) || String(item?.status || ''),
    note: String(item?.note || item?.summary || ''),
  }));
  const recentTasks = toArray(host?.devWorkbenchOverview?.recent_dev_tasks || host?.recent_dev_tasks || []).map((task) => ({
    id: String(task?.task_id || task?.id || ''),
    title: String(task?.title || task?.goal || (isZh ? '未命名开发任务' : 'Untitled developer task')),
    status: String(task?.status || ''),
    workflow: host?.formatDevWorkflowKind?.(task?.workflow_kind) || String(task?.workflow_kind || ''),
    updatedAt: formatDateTime(task?.updated_at || task?.created_at || task?.timestamp || ''),
  }));
  const overview = host?.devWorkbenchOverview || {};
  const runtimeProfile = overview.runtime_profile || {};
  const configAssistant = overview.configuration_assistant || {};
  const providerSetup = configAssistant.provider_setup || {};
  const gatewaySetup = configAssistant.gateway_provider_setup || {};
  const mappingSetup = configAssistant.mapping_setup || {};
  const workspaceSetup = configAssistant.workspace_setup || {};
  const taskStats = overview.task_stats || {};
  const capabilitySummary = overview.capability_summary || {};
  const workflowSupport = overview.workflow_support || {};
  return {
    title: isZh ? '开发者 · 工作台' : 'Developer Workbench',
    subtitle: isZh ? 'API 接口、智能体管理与开发者工具' : 'API routes, agent management, and developer tools',
    tabs,
    activeTab,
    meta,
    stats: mapStats(host?.getPrototypeApiDetailStats?.(activeTab)),
    topStats: [
      {
        label: isZh ? '运行 Profile' : 'Runtime Profile',
        value: String(runtimeProfile.profile || 'desktop'),
        note: String(runtimeProfile.app_name || 'OpenXnet'),
        emphasis: true,
      },
      {
        label: isZh ? '接入就绪度' : 'Readiness',
        value: String(overview.configuration_readiness?.overall_status || (isZh ? '未检查' : 'unchecked')),
        note: String(overview.configuration_readiness?.next_step || (isZh ? '检查 provider / 工作区状态' : 'Check provider and workspace state')),
      },
      {
        label: isZh ? '开发任务' : 'Developer Tasks',
        value: String(taskStats.developer || 0),
        note: `${taskStats.running || 0} ${isZh ? '个运行中' : 'running'} · ${taskStats.resumable || 0} ${isZh ? '个可恢复' : 'resumable'}`,
      },
      {
        label: isZh ? '插件与模板' : 'Plugins & Templates',
        value: String(overview.plugin_count || 0),
        note: `${toArray(overview.templates).length} ${isZh ? '个模板' : 'templates'}`,
      },
    ],
    readiness,
    warnings: toArray(host?.devWorkbenchOverview?.warnings),
    templates: toArray(host?.devWorkbenchOverview?.templates).map((item) => ({
      id: String(item?.id || ''),
      title: String(item?.label || item?.title || item?.id || ''),
      summary: String(item?.summary || ''),
      suggestedGoal: String(item?.suggested_goal || ''),
    })),
    recentTasks,
    providerCard: {
      status: String(providerSetup.status || ''),
      message: String(providerSetup.message || ''),
      vendor: String(host?.devWorkbenchProviderDraft?.vendor || providerSetup.current_vendor || ''),
      url: String(host?.devWorkbenchProviderDraft?.url || providerSetup.current_base_url || ''),
      model: String(host?.devWorkbenchProviderDraft?.model_id || providerSetup.current_model || ''),
      providerCount: toArray(providerSetup.provider_options).length,
      apiKeyConfigured: !!providerSetup.api_key_configured,
      validationStatus: String(host?.devWorkbenchProviderValidation?.status || ''),
      validationMessage: String(host?.devWorkbenchProviderValidation?.message || ''),
    },
    gatewayCard: {
      enabled: !!gatewaySetup.enabled,
      reachable: !!gatewaySetup.reachable,
      status: String(gatewaySetup.status || ''),
      message: String(gatewaySetup.message || ''),
      vendor: String(host?.devWorkbenchGatewayProviderDraft?.vendor || gatewaySetup.current_vendor || ''),
      url: String(host?.devWorkbenchGatewayProviderDraft?.url || gatewaySetup.current_base_url || ''),
      model: String(host?.devWorkbenchGatewayProviderDraft?.model_id || gatewaySetup.current_model || ''),
      providerCount: toArray(gatewaySetup.provider_options).length,
      apiKeyConfigured: !!gatewaySetup.api_key_configured,
      managementUrl: String(gatewaySetup.management_url || ''),
    },
    mappingCard: {
      status: String(mappingSetup.status || ''),
      message: String(mappingSetup.message || ''),
      agent: String(host?.devWorkbenchMappingDraft?.agent_id || mappingSetup.current_main_agent || ''),
      resolvedModel: String(mappingSetup.resolved_model || ''),
      currentModel: String(mappingSetup.current_model || ''),
      resolutionSource: String(mappingSetup.resolution_source || ''),
      providerModelCount: toArray(mappingSetup.provider_models).length,
      agentCount: toArray(mappingSetup.agent_options).length,
    },
    workspaceCard: {
      status: String(workspaceSetup.status || ''),
      message: String(workspaceSetup.message || ''),
      path: String(host?.devWorkbenchWorkspaceDraft?.workspace_dir || workspaceSetup.workspace_dir || workspaceSetup.recommended_workspace_dir || ''),
      exists: !!workspaceSetup.workspace_exists,
      engine: String(host?.devWorkbenchWorkspaceDraft?.engine || workspaceSetup.engine || 'local'),
      permissionMode: String(host?.devWorkbenchWorkspaceDraft?.permission_mode || workspaceSetup.permission_mode || 'default'),
      visibilityScope: String(host?.devWorkbenchWorkspaceDraft?.visibility_scope || workspaceSetup.visibility_scope || 'workspace'),
      recommendedReason: String(workspaceSetup.recommended_reason || ''),
    },
    capabilitySummary: Object.entries(capabilitySummary).map(([key, value]) => ({
      id: key,
      label: host?.formatDevCapabilityLabel?.(key) || key,
      enabled: !!value,
    })),
    workflowSupport: Object.entries(workflowSupport)
      .filter(([key]) => !['write_enabled', 'collaboration'].includes(key))
      .map(([key, value]) => ({
        id: key,
        label: host?.formatDevWorkflowKind?.(key) || key,
        enabled: !!value,
      })),
  };
}

const ENTERPRISE_TABS = [
  { id: 'usage', icon: 'fa-solid fa-chart-line' },
  { id: 'neuro', icon: 'fa-solid fa-brain' },
  { id: 'kg', icon: 'fa-solid fa-diagram-project' },
  { id: 'dataops', icon: 'fa-solid fa-database' },
  { id: 'mlops', icon: 'fa-solid fa-flask-vial' },
  { id: 'aiops', icon: 'fa-solid fa-server' },
  { id: 'enterprise-kb', icon: 'fa-solid fa-book-open' },
  { id: 'staff-roles', icon: 'fa-solid fa-id-badge' },
  { id: 'enterprise-workspaces', icon: 'fa-solid fa-building' },
  { id: 'enterprise-sandbox', icon: 'fa-solid fa-cube' },
];

function buildEnterpriseSnapshot(host, isZh) {
  const activeTab = String(host?.enterpriseTab || 'usage');
  const tabs = ENTERPRISE_TABS.map((item) => ({
    ...item,
    label: host?.getPrototypeEnterpriseTitle?.(item.id) || item.id,
  }));
  const usageSummary = host?.usageData?.summary || {};
  const usageTrend = toArray(host?.usageData?.trend).slice().reverse().slice(0, 8).map((item, index) => ({
    id: `${item?.period || 'trend'}-${index}`,
    label: String(item?.period || '').slice(-5) || `#${index + 1}`,
    value: Number(item?.total_tokens || 0),
  }));
  const usageModels = toArray(host?.usageData?.models).slice(0, 6).map((item, index) => ({
    id: `${item?.model || 'model'}-${index}`,
    name: String(item?.model || isZh ? '未命名模型' : 'Unnamed model'),
    requests: Number(item?.requests || 0),
    tokens: Number(item?.total_tokens || 0),
    cost: Number(item?.cost || 0),
  }));
  const usageUsers = toArray(host?.usageData?.users).slice(0, 6).map((item, index) => ({
    id: `${item?.user_id || 'user'}-${index}`,
    name: String(item?.user_id || isZh ? '未命名用户' : 'Unknown user'),
    requests: Number(item?.requests || 0),
    tokens: Number(item?.total_tokens || 0),
    latency: Math.round(Number(item?.avg_duration_ms || 0)),
  }));
  const neuroStats = host?.neuroData?.stats || {};
  const neuroSymbols = toArray(host?.neuroData?.symbols).slice(0, 8).map((item, index) => ({
    id: String(item?.id || `symbol-${index}`),
    operator: String(item?.operator || '-'),
    label: String(item?.label || isZh ? '未命名符号' : 'Unnamed symbol'),
    entities: toArray(item?.K?.entities).slice(0, 4),
    successRate: Number(item?.successRate || 0),
    activations: Number(item?.activationCount || 0),
  }));
  const neuroRules = toArray(host?.neuroData?.rules).slice(0, 6).map((item, index) => ({
    id: String(item?.id || `rule-${index}`),
    name: String(item?.name || isZh ? '未命名规则' : 'Unnamed rule'),
    domain: String(item?.domain || '-'),
    enabled: !!item?.enabled,
    description: String(item?.description || ''),
  }));
  const kgStats = host?.kgData?.stats || {};
  const kgFacts = toArray(host?.kgData?.entityFacts).slice(0, 8).map((item, index) => ({
    id: `fact-${index}`,
    subject: String(item?.subject || item?.source || '-'),
    predicate: String(item?.predicate || item?.label || '-'),
    object: String(item?.object || item?.target || '-'),
  }));
  const kbItems = toArray(host?.enterpriseKBs).map((item, index) => ({
    id: String(item?.id || `kb-${index}`),
    name: String(item?.name || (isZh ? '未命名知识库' : 'Unnamed KB')),
    category: String(item?.category || (isZh ? '未分类' : 'Uncategorized')),
    docs: Number(item?.doc_count || 0),
    description: String(item?.description || ''),
    updatedAt: formatDateTime(item?.updated_at || item?.created_at || ''),
  }));
  const enterpriseRoles = toArray(host?.enterpriseRoleCards || host?.staffRoles);
  const roleItems = enterpriseRoles
    .map((item, index) => ({
      id: String(item?.id || `role-${index}`),
      name: String(item?.name || (isZh ? '未命名角色' : 'Unnamed role')),
      department: String(item?.department || (isZh ? '未分配部门' : 'Unassigned')),
      workspaceId: String(item?.assignedWorkspace || ''),
      workspace: host?.getEnterpriseWorkspaceNameById?.(item?.assignedWorkspace) || String(item?.assignedWorkspace || ''),
      skills: toArray(item?.skills).slice(0, 6),
      summary: String(item?.summaryZh || item?.summaryEn || item?.description || item?.system_prompt || ''),
      icon: String(item?.icon || 'fa-solid fa-user-tie'),
      enabled: item?.enabled !== false,
      templateId: String(item?.templateId || ''),
      category: String(item?.category || ''),
      categoryLabel: String(
        isZh
          ? (item?.categoryZh || item?.categoryEn || item?.category || '未分类')
          : (item?.categoryEn || item?.categoryZh || item?.category || 'Uncategorized')
      ),
      accent: toArray(item?.accent).slice(0, 2),
    }))
    .sort((left, right) => {
      if (left.enabled !== right.enabled) {
        return left.enabled ? -1 : 1;
      }
      return String(left.name || '').localeCompare(String(right.name || ''), 'zh-Hans-CN');
    });
  const roleTemplates = Object.entries(host?.staffRoleTemplates || {})
    .map(([id, item]) => ({
      id,
      name: String(item?.name || id),
      department: String(item?.department || ''),
      summary: String(item?.summaryZh || item?.summaryEn || ''),
      skills: toArray(item?.skills).slice(0, 6),
      icon: String(item?.icon || 'fa-solid fa-user-tie'),
      category: String(item?.category || ''),
      categoryLabel: String(
        isZh
          ? (item?.categoryZh || item?.categoryEn || item?.category || '未分类')
          : (item?.categoryEn || item?.categoryZh || item?.category || 'Uncategorized')
      ),
      categoryZh: String(item?.categoryZh || ''),
      categoryEn: String(item?.categoryEn || ''),
      featured: !!item?.featured,
      priority: Number(item?.priority || 0),
      accent: toArray(item?.accent).slice(0, 2),
    }))
    .sort((left, right) => {
      if (left.featured !== right.featured) {
        return left.featured ? -1 : 1;
      }
      return Number(right.priority || 0) - Number(left.priority || 0);
    });
  const workspaceItems = toArray(host?.enterpriseWorkspaces).map((item, index) => {
    const workspaceId = String(item?.id || '');
    return {
      id: workspaceId || `ws-${index}`,
      name: String(item?.name || isZh ? '未命名工作空间' : 'Unnamed workspace'),
      type: host?.getEnterpriseWorkspaceTypeLabel?.(item) || String(item?.type || '-'),
      permission: String(item?.permission || 'default'),
      projectCount: toArray(host?.enterpriseProjects).filter((project) => String(project?.workspaceId || '') === workspaceId).length,
      roleCount: toArray(host?.staffRoles || host?.enterpriseRoleCards).filter((role) => String(role?.assignedWorkspace || '') === workspaceId).length,
      summary: host?.describeEnterpriseWorkspace?.(item) || String(item?.path || item?.host || '-'),
      path: String(item?.path || item?.host || '-'),
      updatedAt: formatDateTime(item?.updatedAt || item?.createdAt || ''),
    };
  });
  const currentWorkspaceId = String(host?.sandboxCurrentWs || '');
  const currentProjectId = String(host?.sandboxCurrentProject || '');
  const selectedSandboxAgentId = String(host?.selected3DAgent?.id || '');
  const currentWorkspace = toArray(host?.enterpriseWorkspaces).find((item) => String(item?.id || '') === currentWorkspaceId) || null;
  const currentProject = toArray(host?.enterpriseProjects).find((item) => String(item?.id || '') === currentProjectId) || null;
  const sandboxProjects = toArray(host?.enterpriseProjects)
    .filter((item) => !currentWorkspaceId || String(item?.workspaceId || '') === currentWorkspaceId)
    .map((item, index) => ({
      id: String(item?.id || `project-${index}`),
      name: String(item?.name || (isZh ? '未命名项目' : 'Untitled project')),
      workspaceId: String(item?.workspaceId || ''),
      workspace: host?.getEnterpriseWorkspaceNameById?.(item?.workspaceId) || '',
      color: String(item?.color || '#4ecdc4'),
      icon: String(item?.icon || 'fa-solid fa-folder'),
      description: String(item?.description || ''),
      floor: Number(item?.floor || index + 1),
    }));
  const roleLookup = new Map(
    enterpriseRoles.map((item) => [String(item?.id || '').trim(), item])
  );
  const sandboxItemsRaw = toArray(host?.sandboxAgents).map((item, index) => {
    const roleRecord = roleLookup.get(String(item?.id || '').trim()) || null;
    return {
      id: String(item?.id || `agent-${index}`),
      name: String(item?.name || item?.agent_name || roleRecord?.name || (isZh ? '未命名智能体' : 'Unnamed agent')),
      role: String(item?.role || item?.department || roleRecord?.department || '-'),
      department: String(item?.department || item?.role || roleRecord?.department || '-'),
      status: String(item?.status || (isZh ? '未知' : 'unknown')),
      workspaceId: String(item?.workspaceId || roleRecord?.assignedWorkspace || ''),
      workspace: String(item?.workspace_name || host?.getEnterpriseWorkspaceNameById?.(item?.workspaceId || roleRecord?.assignedWorkspace) || item?.workspaceId || roleRecord?.assignedWorkspace || ''),
      projectId: String(item?.projectId || roleRecord?.projectId || ''),
      project: String(item?.project_name || item?.projectId || roleRecord?.projectId || ''),
      icon: String(item?.icon || roleRecord?.icon || 'fa-solid fa-user-tie'),
      skills: toArray(item?.skills || roleRecord?.skills).slice(0, 6),
      summary: String(item?.summary || roleRecord?.summaryZh || roleRecord?.summaryEn || roleRecord?.description || roleRecord?.system_prompt || ''),
      enabled: roleRecord?.enabled !== false,
    };
  });
  const sandboxItems = sandboxItemsRaw.filter((item) => {
    if (currentProjectId) {
      return String(item?.projectId || '') === currentProjectId;
    }
    if (currentWorkspaceId) {
      return String(item?.workspaceId || '') === currentWorkspaceId;
    }
    return true;
  });
  const breadcrumb = [];
  breadcrumb.push({
    id: 'root',
    level: 0,
    label: isZh ? '企业园区' : 'Enterprise Campus',
  });
  if (currentWorkspace) {
    breadcrumb.push({
      id: currentWorkspace.id,
      level: 1,
      label: currentWorkspace.name,
    });
  }
  if (currentProject) {
    breadcrumb.push({
      id: currentProject.id,
      level: 2,
      label: currentProject.name,
    });
  }
  const xnetCards = ['dataops', 'mlops', 'aiops'].map((key) => {
    const item = host?.xnetServices?.[key] || {};
    return {
      id: key,
      title: String(item?.name || key),
      status: String(item?.status || 'offline'),
      url: String(item?.url || ''),
      autoConnect: !!item?.auto_connect,
      lastCheck: formatDateTime(item?.last_check || ''),
    };
  });
  return {
    title: isZh ? '企业空间' : 'Enterprise Space',
    subtitle: isZh ? '统一沉淀企业知识、角色、工作区与运营指标' : 'Unify enterprise knowledge, roles, workspaces, and operating signals',
    tabs,
    activeTab,
    meta: host?.getPrototypeEnterpriseDetailMeta?.(activeTab) || { title: '', summary: '', chips: [] },
    stats: mapStats(host?.getPrototypeEnterpriseDetailStats?.(activeTab)),
    topStats: [
      {
        title: isZh ? '总请求量' : 'Requests',
        value: String(usageSummary.total_requests || 0),
        note: isZh ? '当前企业视图累计请求' : 'Total requests inside the enterprise view',
      },
      {
        title: isZh ? '知识库文档' : 'KB Docs',
        value: String(host?.enterpriseKBTotalDocs || 0),
        note: `${toArray(host?.enterpriseKBs).length} ${isZh ? '个知识库' : 'knowledge bases'}`,
      },
      {
        title: isZh ? '角色卡' : 'Role Cards',
        value: String(enterpriseRoles.length),
        note: `${toArray(host?.enterpriseWorkspaces).length} ${isZh ? '个工作空间' : 'workspaces'}`,
      },
      {
        title: isZh ? '沙盘智能体' : 'Sandbox Agents',
        value: String(toArray(host?.sandboxAgents).length),
        note: `${toArray(host?.enterpriseSkills).length} ${isZh ? '个企业技能' : 'enterprise skills'}`,
      },
    ],
    overviewCards: [
      {
        title: isZh ? '知识库' : 'Knowledge Bases',
        value: String(toArray(host?.enterpriseKBs).length),
        note: isZh ? '企业级共享知识与文档空间' : 'Shared enterprise knowledge and docs',
      },
      {
        title: isZh ? '员工角色卡' : 'Staff Roles',
        value: String(enterpriseRoles.length),
        note: isZh ? '沉淀可复用的企业 AI 岗位能力' : 'Reusable enterprise AI role templates',
      },
      {
        title: isZh ? '工作空间' : 'Workspaces',
        value: String(toArray(host?.enterpriseWorkspaces).length),
        note: isZh ? '按项目或团队隔离资源边界' : 'Project or team level resource boundaries',
      },
      {
        title: isZh ? '沙盘智能体' : 'Sandbox Agents',
        value: String(toArray(host?.sandboxAgents).length),
        note: isZh ? '试运行、演练与隔离实验空间' : 'Dry runs, drills, and isolated experiments',
      },
    ],
    usagePanel: {
      metrics: [
        { label: isZh ? '请求' : 'Requests', value: String(usageSummary.total_requests || 0) },
        { label: isZh ? '总 Tokens' : 'Tokens', value: String(host?.formatNumber?.(usageSummary.total_tokens || 0) || usageSummary.total_tokens || 0) },
        { label: isZh ? '输入' : 'Input', value: String(host?.formatNumber?.(usageSummary.total_input || 0) || usageSummary.total_input || 0) },
        { label: isZh ? '输出' : 'Output', value: String(host?.formatNumber?.(usageSummary.total_output || 0) || usageSummary.total_output || 0) },
        { label: isZh ? '缓存命中' : 'Cache Hit', value: String(host?.formatNumber?.(usageSummary.total_cache_read || 0) || usageSummary.total_cache_read || 0) },
        { label: isZh ? '总成本' : 'Cost', value: `$${Number(usageSummary.total_cost || 0).toFixed(4)}` },
      ],
      trend: usageTrend,
      models: usageModels,
      users: usageUsers,
    },
    neuroPanel: {
      metrics: [
        { label: isZh ? '符号总数' : 'Symbols', value: String(neuroStats.totalSymbols || host?.neuroData?.total || 0) },
        { label: isZh ? '实体数' : 'Entities', value: String(neuroStats.uniqueEntities || 0) },
        { label: isZh ? '平均成功率' : 'Success Rate', value: `${((Number(neuroStats.avgSuccessRate || 0)) * 100).toFixed(1)}%` },
        { label: isZh ? '运算符类型' : 'Operators', value: String(Object.keys(neuroStats.operatorDistribution || {}).length) },
      ],
      symbols: neuroSymbols,
      rules: neuroRules,
    },
    kgPanel: {
      metrics: [
        { label: isZh ? '实体' : 'Entities', value: String(kgStats.entities || toArray(host?.kgData?.graph?.nodes).length || 0) },
        { label: isZh ? '三元组' : 'Triples', value: String(kgStats.triples || 0) },
        { label: isZh ? '节点' : 'Nodes', value: String(toArray(host?.kgData?.graph?.nodes).length || 0) },
        { label: isZh ? '边' : 'Edges', value: String(toArray(host?.kgData?.graph?.edges).length || 0) },
      ],
      facts: kgFacts,
    },
    knowledgePanel: {
      totalDocs: Number(host?.enterpriseKBTotalDocs || 0),
      totalCount: kbItems.length,
      items: kbItems,
    },
    rolePanel: {
      templateCount: roleTemplates.length,
      createdCount: roleItems.length,
      enabledCount: roleItems.filter((item) => item.enabled).length,
      items: roleItems,
      templates: roleTemplates,
    },
    workspacePanel: {
      totalCount: workspaceItems.length,
      items: workspaceItems,
    },
    sandboxPanel: {
      level: Number(host?.sandboxLevel || 0),
      levelLabel: Number(host?.sandboxLevel || 0) === 0
        ? (isZh ? '企业园区' : 'Enterprise Campus')
        : Number(host?.sandboxLevel || 0) === 1
          ? (isZh ? '工作空间层' : 'Workspace Layer')
          : (isZh ? '项目楼层' : 'Project Floor'),
      currentWorkspaceId,
      currentWorkspace: String(currentWorkspace?.name || currentWorkspaceId || ''),
      currentProjectId,
      currentProject: String(currentProject?.name || currentProjectId || ''),
      selectedAgentId: selectedSandboxAgentId,
      breadcrumb,
      workspaceCount: workspaceItems.length,
      projectCount: sandboxProjects.length,
      roleCount: sandboxItems.length,
      workspaces: workspaceItems.slice(0, 8),
      projects: sandboxProjects.slice(0, 8),
      items: sandboxItems,
    },
    xnetPanel: {
      items: xnetCards,
    },
  };
}

/** 返回 Memory V3 可操作的 Desktop typed API；无输入，缺少完整契约时抛出固定错误。 */
function requireSynapxnetMemoryApi() {
  const api = getDesktopCoreApi();
  const methods = [
    'recoverSynapxnetMemories',
    'getSynapxnetMemoryStatus',
    'listSynapxnetMemories',
    'getSynapxnetMemoryHistory',
    'createSynapxnetMemory',
    'editSynapxnetMemory',
    'rollbackSynapxnetMemory',
    'retireSynapxnetMemory',
    'exportSynapxnetMemories',
    'importSynapxnetMemories',
    'verifySynapxnetMemory',
  ];
  if (!api || methods.some((name) => typeof api[name] !== 'function')) {
    throw new Error('SynapXnet Memory runtime is unavailable.');
  }
  return api;
}

/** 生成可切换的记忆 Agent 身份；输入宿主和语言，返回去重后的主 Agent 与角色卡列表。 */
function buildSynapxnetMemoryAgentOptions(host, isZh) {
  const agents = host?.agents && typeof host.agents === 'object' ? host.agents : {};
  const enterpriseRoles = toArray(host?.enterpriseRoleCards || host?.staffRoles);
  const options = [
    {
      id: String(host?.mainAgent || 'openxnet-model'),
      name: isZh ? '当前主智能体' : 'Current main agent',
    },
    ...Object.entries(agents).map(([id, agent]) => ({
      id: String(id),
      name: String(agent?.name || id),
    })),
    ...enterpriseRoles.map((role) => ({
      id: String(role?.id || ''),
      name: String(role?.name || role?.displayName || role?.id || ''),
    })),
  ];
  const seen = new Set();
  return options.filter((item) => item.id && !seen.has(item.id) && seen.add(item.id));
}

/** 读取一条记忆的完整版本链；输入记忆 ID，更新选中内容和时间线。 */
async function loadSynapxnetMemoryHistory(memoryId) {
  const selectedId = String(memoryId || '').trim();
  if (!selectedId) {
    synapxnetMemoryRuntime.selectedMemoryId = '';
    synapxnetMemoryRuntime.selectedMemory = null;
    synapxnetMemoryRuntime.history = [];
    return null;
  }
  const api = requireSynapxnetMemoryApi();
  const result = await api.getSynapxnetMemoryHistory({
    memoryId: selectedId,
    requesterAgent: synapxnetMemoryRuntime.actorAgent,
  });
  const versions = Array.isArray(result?.versions) ? result.versions : [];
  const selected = [...versions].sort((left, right) => Number(right?.version || 0) - Number(left?.version || 0))[0] || null;
  synapxnetMemoryRuntime.selectedMemoryId = selectedId;
  synapxnetMemoryRuntime.selectedMemory = selected;
  synapxnetMemoryRuntime.history = versions;
  return selected;
}

/** 加载当前 Agent 可见的 Memory V3 数据；输入筛选条件，更新状态、列表和完整选中记录。 */
async function loadSynapxnetMemories(filters = {}) {
  const host = getHostApp();
  const api = requireSynapxnetMemoryApi();
  const agentOptions = buildSynapxnetMemoryAgentOptions(host, isCurrentLanguageZh(host));
  synapxnetMemoryRuntime.actorAgent = String(
    filters.actorAgent
    || synapxnetMemoryRuntime.actorAgent
    || agentOptions[0]?.id
    || 'openxnet-model'
  ).trim();
  synapxnetMemoryRuntime.query = String(filters.query ?? synapxnetMemoryRuntime.query ?? '').trim();
  synapxnetMemoryRuntime.includeRetired = filters.includeRetired === undefined
    ? synapxnetMemoryRuntime.includeRetired
    : !!filters.includeRetired;
  synapxnetMemoryRuntime.loading = true;
  synapxnetMemoryRuntime.error = '';
  try {
    if (!synapxnetMemoryRuntime.recoveryAttempted) {
      synapxnetMemoryRuntime.recovery = await api.recoverSynapxnetMemories({
        actorAgent: synapxnetMemoryRuntime.actorAgent,
      });
      synapxnetMemoryRuntime.recoveryAttempted = true;
      if (synapxnetMemoryRuntime.recovery?.integrity) {
        synapxnetMemoryRuntime.integrity = synapxnetMemoryRuntime.recovery.integrity;
      }
    }
    const [status, listing] = await Promise.all([
      api.getSynapxnetMemoryStatus(),
      api.listSynapxnetMemories({
        requesterAgent: synapxnetMemoryRuntime.actorAgent,
        query: synapxnetMemoryRuntime.query,
        ownerAgent: '',
        includeRetired: synapxnetMemoryRuntime.includeRetired,
        limit: 500,
      }),
    ]);
    synapxnetMemoryRuntime.status = status;
    synapxnetMemoryRuntime.items = Array.isArray(listing?.items) ? listing.items : [];
    const selectedId = synapxnetMemoryRuntime.items.some((item) => item.memoryId === synapxnetMemoryRuntime.selectedMemoryId)
      ? synapxnetMemoryRuntime.selectedMemoryId
      : String(synapxnetMemoryRuntime.items[0]?.memoryId || '');
    await loadSynapxnetMemoryHistory(selectedId);
    return listing;
  } catch (error) {
    synapxnetMemoryRuntime.error = String(error?.message || 'SynapXnet Memory runtime is unavailable.');
    throw error;
  } finally {
    synapxnetMemoryRuntime.loading = false;
  }
}

/** 选择并读取一条 Memory V3 记录；输入记忆 ID，返回含正文的最新版本。 */
async function selectSynapxnetMemory(memoryId) {
  synapxnetMemoryRuntime.error = '';
  return loadSynapxnetMemoryHistory(memoryId);
}

/** 创建当前 Agent 所有的长期记忆；输入编辑器草稿，返回提交后的最新记录。 */
async function createSynapxnetMemory(draft = {}) {
  const api = requireSynapxnetMemoryApi();
  const actorAgent = synapxnetMemoryRuntime.actorAgent || 'openxnet-model';
  const record = await api.createSynapxnetMemory({
    ownerAgent: actorAgent,
    actorAgent,
    taskId: String(draft.taskId || '').trim(),
    title: String(draft.title || '').trim(),
    content: String(draft.content || '').trim(),
    qualityScore: Number(draft.qualityScore ?? 0.8),
    permissions: Array.isArray(draft.permissions) ? draft.permissions : [],
    tags: Array.isArray(draft.tags) ? draft.tags : [],
    source: 'user-created',
  });
  synapxnetMemoryRuntime.selectedMemoryId = record.memoryId;
  await loadSynapxnetMemories();
  return record;
}

/** 把当前记忆编辑为新版本；输入草稿，绑定基础版本防止并发覆盖。 */
async function editSynapxnetMemory(draft = {}) {
  const api = requireSynapxnetMemoryApi();
  const record = await api.editSynapxnetMemory({
    memoryId: String(draft.memoryId || '').trim(),
    baseVersion: Number(draft.baseVersion || 0),
    actorAgent: synapxnetMemoryRuntime.actorAgent || 'openxnet-model',
    title: String(draft.title || '').trim(),
    content: String(draft.content || '').trim(),
    qualityScore: Number(draft.qualityScore ?? 0.8),
    permissions: Array.isArray(draft.permissions) ? draft.permissions : [],
    tags: Array.isArray(draft.tags) ? draft.tags : [],
    reason: String(draft.reason || '').trim(),
  });
  synapxnetMemoryRuntime.selectedMemoryId = record.memoryId;
  await loadSynapxnetMemories();
  return record;
}

/** 从历史版本创建新的回滚版本；输入记忆、版本和原因，保留全部旧版本。 */
async function rollbackSynapxnetMemory(memoryId, targetVersion, reason = '') {
  const api = requireSynapxnetMemoryApi();
  const record = await api.rollbackSynapxnetMemory({
    memoryId: String(memoryId || '').trim(),
    targetVersion: Number(targetVersion || 0),
    actorAgent: synapxnetMemoryRuntime.actorAgent || 'openxnet-model',
    reason: String(reason || '').trim(),
  });
  synapxnetMemoryRuntime.selectedMemoryId = record.memoryId;
  await loadSynapxnetMemories();
  return record;
}

/** 退役一条长期记忆；输入记忆 ID，返回退役后的最新记录。 */
async function retireSynapxnetMemory(memoryId) {
  const api = requireSynapxnetMemoryApi();
  const record = await api.retireSynapxnetMemory({
    memoryId: String(memoryId || '').trim(),
    actorAgent: synapxnetMemoryRuntime.actorAgent || 'openxnet-model',
  });
  synapxnetMemoryRuntime.selectedMemoryId = record.memoryId;
  await loadSynapxnetMemories();
  return record;
}

/** 导出当前 Agent 有权读取的迁移包；输入记忆 ID 数组，返回签名清单。 */
async function exportSynapxnetMemories(memoryIds = []) {
  return requireSynapxnetMemoryApi().exportSynapxnetMemories({
    requesterAgent: synapxnetMemoryRuntime.actorAgent || 'openxnet-model',
    memoryIds: [...memoryIds],
  });
}

/** 导入经完整性校验的迁移包；输入文档，将所有权迁移到当前 Agent。 */
async function importSynapxnetMemories(document) {
  const actorAgent = synapxnetMemoryRuntime.actorAgent || 'openxnet-model';
  const result = await requireSynapxnetMemoryApi().importSynapxnetMemories({
    actorAgent,
    targetOwnerAgent: actorAgent,
    document,
  });
  await loadSynapxnetMemories();
  return result;
}

/** 校验一条或全部 Memory V3 的记录链与审计链；输入可选记忆 ID，返回完整性结果。 */
async function verifySynapxnetMemory(memoryId = '') {
  const result = await requireSynapxnetMemoryApi().verifySynapxnetMemory({
    requesterAgent: synapxnetMemoryRuntime.actorAgent || 'openxnet-model',
    memoryId: String(memoryId || '').trim(),
  });
  synapxnetMemoryRuntime.integrity = result;
  return result;
}

/** 构建 Memory V3 的只读界面快照；输入宿主和语言，返回列表、时间线和审计状态。 */
function buildSynapxnetMemorySnapshot(host, isZh) {
  const agentOptions = buildSynapxnetMemoryAgentOptions(host, isZh);
  if (!synapxnetMemoryRuntime.actorAgent) {
    synapxnetMemoryRuntime.actorAgent = agentOptions[0]?.id || 'openxnet-model';
  }
  return {
    available: !!getDesktopCoreApi()?.listSynapxnetMemories,
    ...synapxnetMemoryRuntime,
    items: [...synapxnetMemoryRuntime.items],
    history: [...synapxnetMemoryRuntime.history],
    agentOptions,
  };
}

/** 构建存储工作台快照；输入宿主和语言，返回文件、Recall 与 Memory V3 数据。 */
function buildStorageSnapshot(host, isZh) {
  const tabs = toArray(host?.storageTiles).map((tile) => ({
    id: String(tile?.id || ''),
    icon: String(tile?.icon || 'fa-solid fa-circle'),
    label: getTileLabel(host, tile, isZh),
  }));
  if (!tabs.some((item) => item.id === 'memory-v3')) {
    tabs.push({ id: 'memory-v3', icon: 'fa-solid fa-brain', label: isZh ? 'Memory V3' : 'Memory V3' });
  }
  const activeTab = String(host?.subMenu || 'text');
  const textFiles = toArray(host?.textFiles).slice(0, 8).map((file, index) => ({
    id: String(file?.id || file?.path || `text-${index}`),
    name: String(file?.original_filename || file?.unique_filename || file?.name || (isZh ? '未命名文件' : 'Untitled file')),
    ext: host?.getPrototypeStorageFileExtension?.(file) || '',
    size: host?.getPrototypeStorageFileDisplaySize?.(file) || '',
    time: host?.getPrototypeStorageFileDisplayTime?.(file) || '',
  }));
  const imageFiles = toArray(host?.imageFiles).slice(0, 6).map((file, index) => ({
    id: String(file?.id || file?.path || `image-${index}`),
    name: String(file?.original_filename || file?.unique_filename || file?.name || (isZh ? '未命名图片' : 'Untitled image')),
    size: host?.getPrototypeStorageFileDisplaySize?.(file) || '',
  }));
  const recallItems = toArray(host?.recallResults).slice(0, 6).map((item, index) => ({
    id: String(item?.task_id || item?.id || `recall-${index}`),
    title: truncate(item?.title || item?.summary || item?.query || (isZh ? '续接任务' : 'Recall item'), 56),
    note: truncate(item?.content || item?.description || item?.source || '', 80),
  }));
  return {
    title: isZh ? '存储管理' : 'Storage Manager',
    subtitle: isZh ? '统一管理文本、图片、视频和续接素材' : 'Manage text, images, videos, and recall assets together',
    tabs,
    activeTab,
    meta: activeTab === 'memory-v3'
      ? {
        title: 'SynapXnet Memory V3',
        summary: isZh ? '可共享、可编辑、可追溯、可回滚的长期记忆。' : 'Shareable, editable, traceable, and rollback-capable long-term memory.',
        chips: [],
      }
      : host?.getPrototypeStorageDetailMeta?.(activeTab) || { title: '', summary: '', chips: [] },
    stats: activeTab === 'memory-v3'
      ? [
        { label: isZh ? '长期记忆' : 'Memories', value: String(synapxnetMemoryRuntime.status?.tiers?.longTerm?.memories || 0) },
        { label: isZh ? '版本' : 'Versions', value: String(synapxnetMemoryRuntime.status?.tiers?.longTerm?.versions || 0) },
        { label: isZh ? '共享版本' : 'Shared', value: String(synapxnetMemoryRuntime.status?.sharedVersions || 0) },
        { label: isZh ? '审计事件' : 'Audit Events', value: String(synapxnetMemoryRuntime.status?.auditEvents || 0) },
      ]
      : mapStats(host?.getPrototypeStorageDetailStats?.(activeTab)),
    overviewStats: toArray(host?.getPrototypeStorageOverviewStats?.()),
    textFiles,
    imageFiles,
    videoFiles: [
      { id: 'video-1', name: 'product-demo.mp4', size: '128 MB', duration: '04:32' },
      { id: 'video-2', name: 'training-session.mov', size: '1.2 GB', duration: '45:08' },
      { id: 'video-3', name: 'bug-repro.webm', size: '45 MB', duration: '02:47' },
    ],
    recallItems,
    memoryV3: buildSynapxnetMemorySnapshot(host, isZh),
  };
}

function buildKernelSnapshot(host, isZh) {
  const activeTab = String(host?.kernelConsoleTab || 'overview');
  const tabs = [
    { id: 'overview', label: isZh ? '总览' : 'Overview', icon: 'fa-solid fa-gauge-high' },
    { id: 'actions', label: isZh ? '队列' : 'Queue', icon: 'fa-solid fa-list-check' },
    { id: 'plan', label: isZh ? '计划' : 'Plan', icon: 'fa-solid fa-diagram-project' },
    { id: 'audit', label: isZh ? '审计' : 'Audit', icon: 'fa-solid fa-shield-halved' },
    { id: 'traces', label: isZh ? '追踪' : 'Traces', icon: 'fa-solid fa-route' },
    { id: 'world', label: isZh ? '世界状态' : 'World', icon: 'fa-solid fa-globe' },
  ];
  return {
    title: isZh ? '神经符号内核' : 'Neural-Symbolic Kernel',
    subtitle: host?.getKernelConsoleRuntimeSubtitle?.() || '',
    tabs,
    activeTab,
    metrics: toArray(host?.getKernelConsoleMetrics?.()),
    runtimeRows: toArray(host?.getKernelConsoleRuntimeRows?.()),
    profileRows: toArray(host?.getKernelConsoleProfileRows?.()),
    boardItems: toArray(host?.getKernelConsoleBoardItems?.()),
    actions: toArray(host?.getKernelConsoleVisibleActions?.()).slice(0, 8).map((item) => ({
      id: String(item?.id || item?.task_id || item?.created_at || Math.random()),
      title: String(item?.title || item?.summary || item?.task || (isZh ? '内核动作' : 'Kernel action')),
      type: host?.getKernelConsoleActionLabel?.(item?.type || item?.action_type || '') || String(item?.type || item?.action_type || ''),
      status: host?.getKernelConsoleActionStatusLabel?.(item) || String(item?.status || ''),
      next: host?.getKernelConsoleActionNextLabel?.(item) || '',
    })),
    updatedLabel: host?.getKernelConsoleUpdatedLabel?.() || '',
  };
}

function buildSystemSnapshot(host, isZh) {
  const tabs = toArray(host?.getPrototypeSystemTabs?.()).map((item) => ({
    id: String(item?.id || ''),
    icon: String(item?.icon || 'fa-solid fa-circle'),
    label: String(item?.label || item?.id || ''),
  }));
  if (!tabs.some((item) => item.id === 'feature-packs')) {
    tabs.splice(Math.max(0, tabs.length - 1), 0, {
      id: 'feature-packs',
      icon: 'fa-solid fa-cubes',
      label: isZh ? '功能包' : 'Feature Packs',
    });
  }
  const activeTab = String(host?.prototypeSystemTab || 'general');
  const themeOptions = toArray(host?.themeOptions).length
    ? toArray(host?.themeOptions).map((item) => mapOption(host, item))
    : toArray(host?.themeValues).map((value) => ({
      value: String(value),
      label: typeof host?.getPrototypeThemeLabel === 'function'
        ? host.getPrototypeThemeLabel(value)
        : translate(host, `theme.${value}`, String(value)),
    }));
  const networkOptions = toArray(host?.networkOptions).map((item) => mapOption(host, item));
  const languageOptions = toArray(host?.systemlanguageOptions).map((item) => mapOption(host, item));
  return {
    title: isZh ? '系统设置' : 'System Settings',
    subtitle: isZh ? '统一管理外观、网络、快捷键、更新内容与运行维护配置' : 'Manage appearance, network, shortcuts, update content, and runtime maintenance settings',
    tabs,
    activeTab,
    stats: mapStats(host?.getPrototypeSystemStats?.()),
    currentMeta: activeTab === 'feature-packs'
      ? {
        heading: isZh ? '功能包管理' : 'Feature Pack Management',
        summary: isZh
          ? '按需安装独立运行时，并验证发布签名与文件完整性。'
          : 'Install optional runtimes on demand with release signature and file integrity verification.',
      }
      : (host?.getPrototypeSystemTabMeta?.(activeTab) || { heading: '', summary: '' }),
    settings: {
      language: String(host?.systemSettings?.language || 'auto'),
      theme: String(host?.systemSettings?.theme || 'party'),
      network: String(host?.systemSettings?.network || 'local'),
      timezone: String(host?.systemSettings?.timezone || 'Asia/Shanghai'),
      dateFormat: String(host?.systemSettings?.dateFormat || 'YYYY-MM-DD'),
      proxyMode: String(host?.systemSettings?.proxyMode || 'system'),
      proxy: String(host?.systemSettings?.proxy || ''),
      launchAtStartup: !!host?.systemSettings?.launchAtStartup,
      startMinimized: !!host?.systemSettings?.startMinimized,
    },
    targetLanguage: String(host?.targetLangSelected || 'system'),
    languageOptions: languageOptions.length ? languageOptions : [
      { value: 'auto', label: isZh ? '跟随系统' : 'Auto' },
      { value: 'zh-CN', label: '中文' },
      { value: 'en-US', label: 'English' },
    ],
    targetLanguageOptions: [
      { value: 'system', label: isZh ? '跟随系统语言' : 'System language' },
      { value: '简体中文', label: '简体中文' },
      { value: '繁體中文', label: '繁體中文' },
      { value: 'English', label: 'English' },
      { value: 'Français', label: 'Français' },
      { value: 'Deutsch', label: 'Deutsch' },
      { value: 'Español', label: 'Español' },
      { value: 'Portuguese', label: 'Portuguese' },
      { value: '日本語', label: '日本語' },
      { value: '한국어', label: '한국어' },
    ],
    timezoneOptions: [
      { value: 'Asia/Shanghai', label: 'Asia/Shanghai (UTC+8)' },
      { value: 'UTC', label: 'UTC' },
      { value: 'America/Los_Angeles', label: 'Los Angeles' },
      { value: 'Europe/London', label: 'London' },
    ],
    dateFormatOptions: [
      { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
      { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
      { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
    ],
    themeOptions,
    networkOptions: networkOptions.length ? networkOptions : [
      { value: 'local', label: isZh ? '本机可见' : 'Local only' },
      { value: 'global', label: isZh ? '局域网可见' : 'LAN visible' },
    ],
    proxyOptions: [
      { value: 'system', label: isZh ? '系统代理' : 'System proxy' },
      { value: 'manual', label: isZh ? '手动代理' : 'Manual proxy' },
      { value: 'none', label: isZh ? '不使用代理' : 'No proxy' },
    ],
    shortcutRows: toArray(host?.getPrototypeShortcutRows?.()),
    quickActions: [
      {
        id: 'command-panel',
        icon: 'fa-solid fa-terminal',
        label: isZh ? '命令面板' : 'Command Panel',
        description: isZh ? '打开全局命令搜索面板。' : 'Open the global command search panel.',
      },
      {
        id: 'desktop-control',
        icon: 'fa-solid fa-window-restore',
        label: isZh ? '桌面控制台' : 'Desktop Control',
        description: isZh ? '进入开发者工作台中的桌面控制能力。' : 'Open desktop control inside the developer workbench.',
      },
      {
        id: 'dynamic-island',
        icon: 'fa-solid fa-table-cells-large',
        label: isZh ? '动态岛' : 'Dynamic Island',
        description: isZh ? '打开桌面动态岛浮层。' : 'Open the desktop dynamic island surface.',
      },
      {
        id: 'floating-task-hud',
        icon: 'fa-solid fa-list-check',
        label: isZh ? '任务 HUD' : 'Task HUD',
        description: isZh ? '打开任务执行与跟踪浮层。' : 'Open the task execution and tracking HUD.',
      },
    ],
    isElectron: !!host?.isElectron,
    version: String(host?.updateCurrentVersion || host?.version || '1.0.0'),
    updateMessage: String(host?.updateMessage || ''),
    updateStatus: String(host?.updateStatus || 'idle'),
    updateStatusTitle: String(host?.getUpdateStatusTitle?.() || ''),
    updateStatusDescription: String(host?.getUpdateStatusDescription?.() || ''),
    updateAvailable: !!host?.updateAvailable,
    updateEntries: toArray(host?.getPrototypeSystemUpdateEntries?.()),
    featurePacks: buildFeaturePackSnapshot(isZh),
  };
}

function buildTaskSnapshot(host, isZh) {
  const columns = toArray(host?.getPrototypeTaskBoardColumns?.()).map((column) => ({
    id: String(column?.id || ''),
    title: String(column?.title || ''),
    emptyTitle: String(column?.emptyTitle || ''),
    emptyCopy: String(column?.emptyCopy || ''),
    tasks: toArray(column?.tasks).map((task) => ({
      raw: task,
      id: String(task?.task_id || task?.id || Math.random()),
      title: String(task?.title || task?.goal || (isZh ? '未命名任务' : 'Untitled task')),
      summary: truncate(task?.description || task?.goal || task?.context?.goal || '', 96),
      status: String(task?.status || ''),
      updatedAt: formatDateTime(task?.updated_at || task?.created_at || task?.timestamp || ''),
      progress: Number.isFinite(Number(task?.progress)) ? Number(task.progress) : null,
      assignee: String(task?.agent_name || task?.owner || task?.agent_type || ''),
    })),
  }));
  const detail = host?.viewingTaskDetail || null;
  return {
    title: isZh ? '任务中心' : 'Task Center',
    subtitle: isZh ? '查看待处理、进行中和已完成任务，并继续推进关键工作' : 'Track pending, running, and completed tasks and keep work moving',
    columns,
    detail: detail ? {
      title: String(detail?.title || detail?.goal || (isZh ? '任务详情' : 'Task Detail')),
      status: String(detail?.status || ''),
      summary: truncate(detail?.description || detail?.goal || '', 160),
      trace: toArray(detail?.recent_trace_excerpt || detail?.execution_trace).slice(0, 6).map((item, index) => ({
        id: `${detail?.task_id || 'detail'}-${index}`,
        text: truncate(typeof item === 'string' ? item : (item?.message || item?.summary || JSON.stringify(item)), 120),
      })),
    } : null,
  };
}

function buildAboutSnapshot(host, isZh) {
  return {
    title: 'OpenXnet',
    subtitle: isZh ? '神经符号系统、多智能体协作与企业空间的一体化工作台' : 'A unified workspace for neural-symbolic systems, multi-agent collaboration, and enterprise operations',
    version: String(host?.updateCurrentVersion || host?.version || '1.0.0'),
    features: [
      {
        icon: 'fa-solid fa-comments',
        title: isZh ? '实时协作' : 'Live Collaboration',
        description: isZh ? '对话、工具调用与任务流保持在同一条工作轨道。' : 'Keep conversations, tools, and tasks in one working lane.',
      },
      {
        icon: 'fa-solid fa-brain',
        title: isZh ? '神经符号内核' : 'Neural-Symbolic Kernel',
        description: isZh ? '模型能力、规则约束、记忆和执行控制统一收束。' : 'Unify model power, policy, memory, and execution control.',
      },
      {
        icon: 'fa-solid fa-building',
        title: isZh ? '企业空间' : 'Enterprise Space',
        description: isZh ? '角色、知识、工作区和用量治理放到同一个控制面。' : 'Roles, knowledge, workspaces, and usage share one control plane.',
      },
      {
        icon: 'fa-solid fa-globe',
        title: isZh ? 'AI 浏览器' : 'AI Browser',
        description: isZh ? '把网页理解、自动操作和会话分析连到一起。' : 'Connect page understanding, automation, and chat analysis.',
      },
    ],
    links: [
      { label: 'Community', value: 'developer.synapxnet.com', href: 'https://developer.synapxnet.com/' },
      { label: 'GitHub', value: 'github.com/synapxnet/OpenXnet', href: 'https://github.com/synapxnet/OpenXnet' },
      { label: isZh ? '联系邮箱' : 'Contact', value: 'synapxnet@gmail.com', href: 'mailto:synapxnet@gmail.com' },
      { label: isZh ? '开源许可' : 'License', value: 'GNU AGPL v3.0', href: 'https://www.gnu.org/licenses/agpl-3.0.html' },
    ],
    facts: [
      {
        label: isZh ? '版本说明' : 'Version',
        value: isZh
          ? `当前关于页基于桌面端 v${String(host?.updateCurrentVersion || '1.0.0')} 的新菜单承接结构整理。`
          : `This about page is aligned to desktop build v${String(host?.updateCurrentVersion || '1.0.0')}.`,
      },
      {
        label: isZh ? '产品愿景' : 'Direction',
        value: isZh
          ? '不是堆叠孤立功能，而是围绕统一智能系统持续演进。'
          : 'The direction is a unified intelligent system instead of isolated feature stacks.',
      },
      {
        label: isZh ? '业务承载' : 'Operations',
        value: isZh
          ? '登录、订阅、高级模型、企业空间与额度同步共同构成可持续发布基础。'
          : 'Login, subscription, premium models, enterprise spaces, and quota sync form the operational base.',
      },
    ],
  };
}

function buildVrmSnapshot(host, isZh) {
  const cfg = host?.VRMConfig || {};
  const mapModel = (m, builtin, extra = {}) => ({
    id: String(m?.id || ''),
    name: String(m?.name || m?.id || ''),
    path: String(m?.path || ''),
    builtin,
    cloud: !!m?.cloud || String(m?.source || '') === 'cloud',
    source: String(m?.source || (builtin ? 'packaged' : 'user')),
    downloaded: m?.downloaded !== false,
    downloadable: !!m?.downloadable,
    remoteUrl: String(m?.remoteUrl || ''),
    relativePath: String(m?.relativePath || ''),
    ...extra,
  });
  const defaultModels = toArray(cfg.defaultModels).map((m) => ({
    ...mapModel(m, true, { downloaded: true, downloadable: false }),
  }));
  const cloudModels = toArray(cfg.cloudModels).map((m) => {
    const downloaded = !!m?.downloaded;
    return mapModel(m, false, {
      cloud: true,
      downloaded,
      downloadable: !downloaded,
      source: 'cloud',
    });
  });
  const userModels = toArray(cfg.userModels).map((m) => mapModel(m, false));
  const allModels = [...defaultModels, ...userModels];
  const selectedModelId = String(
    (cfg.name && cfg.name !== 'default' ? cfg.selectedNewModelId : cfg.selectedModelId)
      || cfg.selectedModelId
      || allModels[0]?.id
      || '',
  );
  const selectedModel = allModels.find((m) => m.id === selectedModelId) || allModels[0] || null;

  const defaultMotions = toArray(cfg.defaultMotions).map((m) => ({
    id: String(m?.id || ''),
    name: String(m?.name || m?.id || ''),
    builtin: true,
  }));
  const userMotions = toArray(cfg.userMotions).map((m) => ({
    id: String(m?.id || ''),
    name: String(m?.name || m?.id || ''),
    builtin: false,
  }));
  const allMotions = [...defaultMotions, ...userMotions];
  const selectedMotionIds = new Set(toArray(cfg.selectedMotionIds).map((id) => String(id)));
  const motions = allMotions.map((m) => ({
    ...m,
    selected: selectedMotionIds.has(m.id),
  }));

  const partyURL = String(host?.partyURL || '').replace(/\/$/, '');
  // 用 mode=embed 进入"嵌入预览"模式：vrm.js 会切换到聚焦上半身的近景相机，
  // vrm.css 会隐藏 .life-scene-shell 的装饰图层，预览框背景由外层 panel 控制。
  const previewParams = new URLSearchParams({ mode: 'embed' });
  if (selectedModelId) {
    previewParams.set('model', selectedModelId);
  }
  const motionSignature = Array.from(selectedMotionIds).sort().join(',');
  if (motionSignature) {
    previewParams.set('motions', motionSignature);
  }
  const previewKey = [
    selectedModelId || 'none',
    motionSignature || 'no-motion',
    cfg.enabledExpressions ? 'expr-on' : 'expr-off',
    cfg.enabledMotions ? 'motion-on' : 'motion-off',
  ].join('|');
  const previewUrl = partyURL ? `${partyURL}/vrm.html?${previewParams.toString()}` : '';

  const running = !!host?.isVRMRunning;
  const starting = !!host?.isVRMStarting;
  const stopping = !!host?.isVRMStopping;

  const mainAgent = String(host?.mainAgent || 'super-model');
  const agents = host?.agents && typeof host.agents === 'object' ? host.agents : {};
  const agentOptions = [
    {
      id: 'super-model',
      name: isZh ? '跟随当前主模型' : 'Follow current main model',
    },
    ...Object.entries(agents).map(([id, agent]) => ({
      id: String(id),
      name: String(agent?.name || id),
    })),
  ];

  return {
    title: isZh ? 'VRM 桌宠' : 'VRM Pet',
    subtitle: isZh
      ? '配置 VRM 模型、动作与窗口表现，并预览桌宠形象。'
      : 'Configure the VRM model, motion bindings, and window behavior, then preview the pet.',
    meta: {
      summary: isZh
        ? 'VRM 桌宠从机器人部署里独立成菜单，左侧编排模型、动画与窗口，右侧实时预览模型与动作清单。'
        : 'VRM Pet is now its own menu separate from bot deployment. Configure on the left, preview model and motions on the right.',
      guideNote: isZh
        ? '配置顺序：先确认回答你的主智能体，再选择桌宠模型和动作，最后预览或启动桌宠。'
        : 'Setup order: choose the main agent first, then pick the pet model and motions, and finally preview or start the pet.',
      setupSteps: [
        {
          icon: 'fa-regular fa-user',
          title: isZh ? '主智能体 / 角色卡' : 'Main agent / role card',
          desc: isZh ? '决定人格、系统提示词和回复内容。' : 'Controls persona, system prompt, and responses.',
        },
        {
          icon: 'fa-solid fa-vr-cardboard',
          title: isZh ? 'VRM 模型' : 'VRM model',
          desc: isZh ? '决定桌宠形象，支持内置或上传模型。' : 'Controls the pet appearance, built-in or uploaded.',
        },
        {
          icon: 'fa-solid fa-person-running',
          title: isZh ? '动作 / 窗口 / 预览' : 'Motion / window / preview',
          desc: isZh ? '勾选动作、设置尺寸，再启动检查效果。' : 'Enable motions, set size, then start to check it.',
        },
      ],
      chips: [
        {
          icon: 'fa-solid fa-vr-cardboard',
          text: isZh ? `当前模型 ${selectedModel?.name || '未选择'}` : `Current model: ${selectedModel?.name || 'None'}`,
        },
        {
          icon: 'fa-solid fa-person-running',
          text: isZh ? `${motions.filter((m) => m.selected).length} 个动作已启用` : `${motions.filter((m) => m.selected).length} motions enabled`,
        },
      ],
    },
    stats: [
      {
        label: isZh ? '运行状态' : 'Status',
        value: running ? (isZh ? '运行中' : 'Running') : (isZh ? '已停止' : 'Stopped'),
        meta: isZh ? '桌宠窗口的当前活动状态。' : 'Current activity of the desktop pet window.',
        emphasis: running,
      },
      {
        label: isZh ? '当前模型' : 'Current Model',
        value: selectedModel?.name || (isZh ? '未选择' : 'None'),
        meta: `${defaultModels.length} ${isZh ? '内置 + ' : 'built-in + '}${cloudModels.length} ${isZh ? '资源包 + ' : 'cloud + '}${userModels.length} ${isZh ? '自定义' : 'custom'}`,
        truncate: true,
      },
      {
        label: isZh ? '动作' : 'Motions',
        value: `${motions.filter((m) => m.selected).length} / ${allMotions.length}`,
        meta: isZh ? '已启用 / 全部可用' : 'Enabled / available',
      },
      {
        label: isZh ? '窗口尺寸' : 'Window Size',
        value: `${Number(cfg.windowWidth || 540)} × ${Number(cfg.windowHeight || 960)}`,
        meta: isZh ? '宽 × 高（像素）' : 'Width × Height (px)',
      },
    ],
    vrm: {
      selectedModelId,
      selectedModel,
      models: allModels,
      defaultModels,
      cloudModels,
      userModels,
      remoteResourceBaseUrl: String(cfg.remoteResourceBaseUrl || ''),
      motions,
      selectedMotionIds: Array.from(selectedMotionIds),
      enabledExpressions: !!cfg.enabledExpressions,
      enabledMotions: !!cfg.enabledMotions,
      windowWidth: Number(cfg.windowWidth || 540),
      windowHeight: Number(cfg.windowHeight || 960),
      running,
      starting,
      stopping,
      mainAgent,
      agentOptions,
      previewUrl,
      previewKey,
      partyURL,
      isElectron: !!host?.isElectron,
    },
  };
}

function buildSurfaceSnapshot(surface) {
  const host = getHostApp();
  const isZh = isCurrentLanguageZh(host);
  const surfaceMenu = surfaceMenuMap(surface);
  const base = {
    surface,
    surfaceMenu,
    activeMenu: String(host?.activeMenu || ''),
    isZh,
    isActive: String(host?.activeMenu || '') === surfaceMenu,
  };

  switch (surface) {
    case 'deploy':
      return { ...base, ...buildDeploySnapshot(host, isZh) };
    case 'vrm':
      return { ...base, ...buildVrmSnapshot(host, isZh) };
    case 'workbench':
      return { ...base, ...buildWorkbenchSnapshot(host, isZh) };
    case 'enterprise':
      return { ...base, ...buildEnterpriseSnapshot(host, isZh) };
    case 'storage':
      return { ...base, ...buildStorageSnapshot(host, isZh) };
    case 'kernel':
      return { ...base, ...buildKernelSnapshot(host, isZh) };
    case 'system':
      return { ...base, ...buildSystemSnapshot(host, isZh) };
    case 'task':
      return { ...base, ...buildTaskSnapshot(host, isZh) };
    case 'about':
      return { ...base, ...buildAboutSnapshot(host, isZh) };
    default:
      return base;
  }
}

async function ensureLoaded(surface) {
  if (surface === 'system') {
    await loadFeaturePacks(true);
  }
  const host = getHostApp();
  if (!host) return;
  switch (surface) {
    case 'deploy':
      if (typeof host.ensureDeployBotReady === 'function') {
        await host.ensureDeployBotReady(host.subMenu || 'live_stream');
      }
      break;
    case 'vrm':
      if (typeof host.loadDefaultModels === 'function') {
        await host.loadDefaultModels();
      }
      if (typeof host.loadDefaultMotions === 'function') {
        await host.loadDefaultMotions();
      }
      break;
    case 'workbench':
      host.subMenu = host.subMenu || 'develop';
      if (host.subMenu === 'develop' && typeof host.loadDevWorkbench === 'function') {
        await host.loadDevWorkbench();
      }
      break;
    case 'enterprise':
      if (typeof host.openEnterpriseTab === 'function') {
        await host.openEnterpriseTab(host.enterpriseTab || 'usage');
      }
      break;
    case 'storage':
      if (String(host.subMenu || '') === 'memory-v3') {
        await loadSynapxnetMemories();
      } else if (typeof host.switchStorageTile === 'function') {
        await host.switchStorageTile(host.subMenu || 'text');
      }
      break;
    case 'kernel':
      if (typeof host.openKernelTab === 'function') {
        await host.openKernelTab(host.kernelConsoleTab || 'overview');
      }
      break;
    case 'system':
      if (typeof host.setPrototypeSystemTab === 'function') {
        host.setPrototypeSystemTab(host.prototypeSystemTab || 'general');
      }
      break;
    case 'task':
      if (typeof host.fetchTasks === 'function') {
        await host.fetchTasks();
      }
      break;
    case 'about':
      if (host.isElectron && typeof window !== 'undefined' && window.electronAPI?.getAppVersion) {
        try {
          const version = await window.electronAPI.getAppVersion();
          if (version) host.updateCurrentVersion = String(version);
        } catch (error) {
          // noop
        }
      }
      break;
    default:
      break;
  }
}

async function selectSurfaceTab(surface, tabId) {
  const host = getHostApp();
  if (!host) return;
  switch (surface) {
    case 'deploy':
      host.subMenu = tabId;
      if (typeof host.ensureDeployBotReady === 'function') {
        await host.ensureDeployBotReady(tabId);
      }
      break;
    case 'workbench':
      host.subMenu = tabId;
      if (tabId === 'develop' && typeof host.loadDevWorkbench === 'function') {
        await host.loadDevWorkbench();
      }
      break;
    case 'enterprise':
      if (typeof host.openEnterpriseTab === 'function') {
        await host.openEnterpriseTab(tabId);
      } else {
        host.enterpriseTab = tabId;
      }
      break;
    case 'storage':
      if (tabId === 'memory-v3') {
        host.subMenu = 'memory-v3';
        await loadSynapxnetMemories();
      } else if (typeof host.switchStorageTile === 'function') {
        await host.switchStorageTile(tabId);
      } else {
        host.subMenu = tabId;
      }
      break;
    case 'kernel':
      if (typeof host.openKernelTab === 'function') {
        await host.openKernelTab(tabId);
      } else {
        host.kernelConsoleTab = tabId;
      }
      break;
    case 'system':
      if (tabId === 'feature-packs') {
        host.prototypeSystemTab = tabId;
      } else if (typeof host.setPrototypeSystemTab === 'function') {
        host.setPrototypeSystemTab(tabId);
      } else {
        host.prototypeSystemTab = tabId;
      }
      break;
    default:
      break;
  }
}

async function refreshSurface(surface) {
  const host = getHostApp();
  if (!host) return;
  switch (surface) {
    case 'deploy':
      if (typeof host.refreshPrototypeDeployStatus === 'function') {
        await host.refreshPrototypeDeployStatus(host.subMenu || 'table_pet');
      }
      break;
    case 'vrm':
      await ensureLoaded(surface);
      break;
    case 'workbench':
      if (typeof host.loadDevWorkbench === 'function') {
        await host.loadDevWorkbench();
      }
      break;
    case 'enterprise':
      if (typeof host.refreshPrototypeEnterpriseStatus === 'function') {
        await host.refreshPrototypeEnterpriseStatus(host.enterpriseTab || 'usage');
      }
      break;
    case 'storage':
      if (String(host.subMenu || '') === 'memory-v3') await loadSynapxnetMemories();
      else await ensureLoaded(surface);
      break;
    case 'kernel':
      if (typeof host.loadKernelConsole === 'function') {
        await host.loadKernelConsole();
      }
      break;
    case 'system':
      if (typeof host.refreshPrototypeSystemStatus === 'function') {
        await host.refreshPrototypeSystemStatus();
      }
      await loadFeaturePacks(true);
      break;
    case 'task':
      if (typeof host.fetchTasks === 'function') {
        await host.fetchTasks();
      }
      break;
    default:
      break;
  }
}

async function runSystemUpdateCheck() {
  const host = getHostApp();
  if (!host || typeof host.checkForUpdates !== 'function') return;
  await host.checkForUpdates({ silent: false });
}

async function openAboutSurface() {
  const host = getHostApp();
  if (!host || typeof host.handleSelect !== 'function') return;
  await host.handleSelect('logo');
}

async function persistSystemSettings(host) {
  if (!host) return;
  if (typeof host.autoSaveSettings === 'function') {
    await host.autoSaveSettings();
  }
}

async function syncLaunchSettings(host) {
  if (!host?.isElectron || typeof window === 'undefined' || !window.electronAPI?.setLaunchAtStartup) {
    return;
  }
  try {
    await window.electronAPI.setLaunchAtStartup({
      enabled: !!host?.systemSettings?.launchAtStartup,
      startMinimized: !!host?.systemSettings?.startMinimized,
    });
  } catch (error) {
    console.warn('Sync launch settings failed:', error);
  }
}

async function updateSystemSetting(key, value) {
  const host = getHostApp();
  if (!host) return;
  if (!host.systemSettings || typeof host.systemSettings !== 'object') {
    host.systemSettings = {};
  }

  const settingKey = String(key || '').trim();
  if (!settingKey) return;
  const booleanKeys = new Set(['launchAtStartup', 'startMinimized']);
  const nextValue = booleanKeys.has(settingKey) ? !!value : String(value ?? '');

  if (settingKey === 'language' && typeof host.handleSystemLanguageChange === 'function') {
    await host.handleSystemLanguageChange(nextValue);
    return;
  }

  if (settingKey === 'theme' && typeof host.handleThemeChange === 'function') {
    await host.handleThemeChange(nextValue);
    return;
  }

  if (settingKey === 'network') {
    if (host.isElectron && typeof window !== 'undefined' && window.electronAPI?.setNetworkVisibility && typeof host.handleNetworkChange === 'function') {
      await host.handleNetworkChange(nextValue);
      return;
    }
    host.systemSettings.network = nextValue;
    await persistSystemSettings(host);
    return;
  }

  host.systemSettings[settingKey] = nextValue;

  if (settingKey === 'proxyMode' || settingKey === 'proxy') {
    if (typeof host.updateProxy === 'function') {
      await host.updateProxy();
    } else {
      await persistSystemSettings(host);
      if (!host.isElectron) {
        await fetch('/api/update_proxy', { method: 'POST' }).catch(() => null);
      }
    }
    return;
  }

  await persistSystemSettings(host);
  if (settingKey === 'launchAtStartup' || settingKey === 'startMinimized') {
    await syncLaunchSettings(host);
  }
}

async function setSystemTargetLanguage(value) {
  const host = getHostApp();
  if (!host) return;
  host.targetLangSelected = String(value || 'system');
  if (typeof host.changeLanguage === 'function') {
    host.changeLanguage();
  } else {
    await persistSystemSettings(host);
  }
}

async function clearSystemRuntimeCache() {
  const host = getHostApp();
  if (!host) return;
  if (typeof host.clearPrototypeRuntimeCache === 'function') {
    await host.clearPrototypeRuntimeCache();
  }
}

async function runSystemQuickAction(action) {
  const host = getHostApp();
  if (!host) return;
  const target = String(action || '').trim();
  if (target === 'command-panel' && typeof host.openHomeCommandPanel === 'function') {
    host.openHomeCommandPanel();
    return;
  }
  if (target === 'desktop-control' && typeof host.openDesktopControlWorkbench === 'function') {
    await host.openDesktopControlWorkbench();
    return;
  }
  if (target === 'dynamic-island' && typeof host.openDynamicIslandSurface === 'function') {
    await host.openDynamicIslandSurface();
    return;
  }
  if (target === 'floating-task-hud' && typeof host.openFloatingTaskHudSurface === 'function') {
    await host.openFloatingTaskHudSurface();
  }
}

async function openSystemPath(kind) {
  const host = getHostApp();
  if (!host) return;
  const target = String(kind || '').trim();
  if (target === 'user' && typeof host.openUserfile === 'function') {
    await host.openUserfile();
    return;
  }
  if (target === 'logs' && typeof host.openLogfile === 'function') {
    await host.openLogfile();
    return;
  }
  if (target === 'extensions' && typeof host.openExtfile === 'function') {
    await host.openExtfile();
  }
}

async function resetSystemSettings() {
  const host = getHostApp();
  if (!host) return;
  host.systemSettings = {
    ...(host.systemSettings || {}),
    language: 'auto',
    theme: 'party',
    network: 'local',
    timezone: 'Asia/Shanghai',
    dateFormat: 'YYYY-MM-DD',
    launchAtStartup: false,
    startMinimized: false,
    proxy: '',
    proxyMode: 'system',
  };
  host.targetLangSelected = 'system';
  if (typeof host.handleSystemLanguageChange === 'function') {
    await host.handleSystemLanguageChange('auto');
  }
  if (typeof host.handleThemeChange === 'function') {
    await host.handleThemeChange('party');
  }
  await persistSystemSettings(host);
  await syncLaunchSettings(host);
  if (typeof host.updateProxy === 'function') {
    await host.updateProxy();
  } else if (!host.isElectron) {
    await fetch('/api/update_proxy', { method: 'POST' }).catch(() => null);
  }
  notify(isCurrentLanguageZh(host) ? '系统设置已恢复默认值' : 'System settings reset to defaults', 'success');
}

async function startPrimaryDeployAction() {
  const host = getHostApp();
  if (!host) return;
  if (typeof host.ensureDeployBotReady === 'function') {
    await host.ensureDeployBotReady('live_stream');
  }
}

async function startVrm() {
  const host = getHostApp();
  if (!host) return;
  if (typeof host.startVRM === 'function') {
    await host.startVRM();
  }
}

async function startVrmWeb() {
  const host = getHostApp();
  if (!host) return;
  if (typeof host.startVRMweb === 'function') {
    await host.startVRMweb();
  }
}

async function setVrmModel(modelId) {
  const host = getHostApp();
  if (!host || !host.VRMConfig) return;
  const nextModelId = String(modelId || '');
  host.VRMConfig.name = 'default';
  host.VRMConfig.selectedModelId = nextModelId;
  host.VRMConfig.selectedNewModelId = nextModelId;
  if (typeof host.saveVRMConfig === 'function') {
    await host.saveVRMConfig();
  } else if (typeof host.handleModelChange === 'function') {
    await host.handleModelChange(nextModelId);
  } else if (typeof host.autoSaveSettings === 'function') {
    await host.autoSaveSettings();
  }
}

function notify(message, type = 'info') {
  if (typeof window !== 'undefined' && typeof window.showNotification === 'function') {
    window.showNotification(message, type);
  }
}

/** 下载固定目录 VRM；输入模型 ID，返回模型或 null，Desktop 使用 typed Runtime，Browser/Server 保留 HTTP。 */
async function downloadVrmModel(modelId) {
  const host = getHostApp();
  if (!host || !host.VRMConfig) return null;
  const isZh = isCurrentLanguageZh(host);
  const nextModelId = String(modelId || '');
  if (!nextModelId) return null;

  notify(isZh ? '开始下载 VRM 模型...' : 'Downloading VRM model...', 'info');
  let result;
  if (host.isElectron) {
    if (typeof window.openxnetDesktop?.downloadApplicationCloudVrmModel !== 'function') {
      throw new Error('Desktop VR Asset Runtime is unavailable.');
    }
    const written = await window.openxnetDesktop.downloadApplicationCloudVrmModel({ modelId: nextModelId });
    result = { success: written.success, model: written.asset };
    if (typeof host.invalidateApplicationVrAssetCatalog === 'function') {
      host.invalidateApplicationVrAssetCatalog();
    }
  } else {
    const response = await fetch(`/download_vrm_model/${encodeURIComponent(nextModelId)}`, {
      method: 'POST',
    });
    result = await response.json().catch(() => ({}));
    if (!response.ok || !result?.success) {
      const message = result?.message || `Download failed (${response.status})`;
      notify(message, 'error');
      throw new Error(message);
    }
  }

  const model = result.model || null;
  if (model?.id) {
    if (!Array.isArray(host.VRMConfig.userModels)) {
      host.VRMConfig.userModels = [];
    }
    const index = host.VRMConfig.userModels.findIndex((item) => String(item?.id || '') === String(model.id));
    if (index >= 0) {
      host.VRMConfig.userModels.splice(index, 1, model);
    } else {
      host.VRMConfig.userModels.push(model);
    }
    host.VRMConfig.selectedModelId = String(model.id);
    host.VRMConfig.selectedNewModelId = String(model.id);

    if (Array.isArray(host.VRMConfig.cloudModels)) {
      host.VRMConfig.cloudModels = host.VRMConfig.cloudModels.map((item) => (
        String(item?.id || '') === String(model.id)
          ? { ...item, downloaded: true, downloadable: false, path: model.path }
          : item
      ));
    }

    if (typeof host.saveVRMConfig === 'function') {
      await host.saveVRMConfig();
    } else if (typeof host.autoSaveSettings === 'function') {
      await host.autoSaveSettings();
    }
  }

  if (typeof host.loadDefaultModels === 'function') {
    await host.loadDefaultModels();
  }
  notify(isZh ? 'VRM 模型已下载并选中' : 'VRM model downloaded and selected', 'success');
  return result;
}

async function toggleVrmMotion(motionId) {
  const host = getHostApp();
  if (!host || !host.VRMConfig) return;
  if (!Array.isArray(host.VRMConfig.selectedMotionIds)) {
    host.VRMConfig.selectedMotionIds = [];
  }
  const list = host.VRMConfig.selectedMotionIds;
  const idx = list.indexOf(motionId);
  if (idx === -1) {
    list.push(motionId);
  } else {
    list.splice(idx, 1);
  }
  if (typeof host.handleMotionChange === 'function') {
    await host.handleMotionChange();
  } else if (typeof host.autoSaveSettings === 'function') {
    await host.autoSaveSettings();
  }
}

async function setVrmExpressionsEnabled(enabled) {
  const host = getHostApp();
  if (!host || !host.VRMConfig) return;
  host.VRMConfig.enabledExpressions = !!enabled;
  if (typeof host.autoSaveSettings === 'function') {
    await host.autoSaveSettings();
  }
}

async function setVrmMotionsEnabled(enabled) {
  const host = getHostApp();
  if (!host || !host.VRMConfig) return;
  host.VRMConfig.enabledMotions = !!enabled;
  if (typeof host.autoSaveSettings === 'function') {
    await host.autoSaveSettings();
  }
}

async function setVrmWindowWidth(width) {
  const host = getHostApp();
  if (!host || !host.VRMConfig) return;
  const value = Number(width);
  if (!Number.isFinite(value)) return;
  host.VRMConfig.windowWidth = Math.max(300, Math.min(3840, Math.floor(value)));
  if (typeof host.autoSaveSettings === 'function') {
    await host.autoSaveSettings();
  }
}

async function setVrmWindowHeight(height) {
  const host = getHostApp();
  if (!host || !host.VRMConfig) return;
  const value = Number(height);
  if (!Number.isFinite(value)) return;
  host.VRMConfig.windowHeight = Math.max(300, Math.min(3840, Math.floor(value)));
  if (typeof host.autoSaveSettings === 'function') {
    await host.autoSaveSettings();
  }
}

async function setVrmAgent(agentId) {
  const host = getHostApp();
  if (!host) return;
  host.mainAgent = String(agentId || 'super-model');
  if (typeof host.autoSaveSettings === 'function') {
    await host.autoSaveSettings();
  }
}

async function openAddVrmModel() {
  const host = getHostApp();
  if (!host) return;
  host.showVrmModelDialog = true;
}

async function openAddVrmMotion() {
  const host = getHostApp();
  if (!host) return;
  host.showVrmaMotionDialog = true;
}

async function deleteVrmUserModel(modelId) {
  const host = getHostApp();
  if (!host) return;
  if (typeof host.deleteModelOption === 'function') {
    await host.deleteModelOption(modelId);
    if (typeof host.loadDefaultModels === 'function') {
      await host.loadDefaultModels();
    }
  }
}

async function deleteVrmUserMotion(motionId) {
  const host = getHostApp();
  if (!host) return;
  if (typeof host.deleteMotionOption === 'function') {
    await host.deleteMotionOption(motionId);
  }
}

async function openTaskCenter() {
  const host = getHostApp();
  if (!host) return;
  if (typeof host.openTaskCenter === 'function') {
    host.openTaskCenter();
  } else {
    host.activeMenu = 'task-center';
  }
}

async function openTask(task) {
  const host = getHostApp();
  if (!host || !task) return;
  if (typeof host.openTaskDetailView === 'function') {
    await host.openTaskDetailView(task);
  }
}

async function jumpToMenu(targetMenu, targetSubMenu = '') {
  const host = getHostApp();
  if (!host) return;
  if (typeof host.handleSelect === 'function') {
    await host.handleSelect(targetMenu);
  } else {
    host.activeMenu = targetMenu;
  }
  if (targetSubMenu) {
    if (targetMenu === 'enterprise') {
      host.enterpriseTab = targetSubMenu;
    } else if (targetMenu === 'kernel') {
      host.kernelConsoleTab = targetSubMenu;
    } else {
      host.subMenu = targetSubMenu;
    }
  }
}

async function openEnterpriseStaffRoleForm(roleId = '') {
  const host = getHostApp();
  if (!host) return;
  const targetId = String(roleId || '').trim();
  const role = targetId
    ? toArray(host?.enterpriseRoleCards || host?.staffRoles).find((item) => String(item?.id || '') === targetId) || null
    : null;
  if (typeof host.openStaffRoleForm === 'function') {
    host.openStaffRoleForm(role || null);
    return;
  }
  if (typeof host.createEmptyStaffRoleDraft === 'function') {
    host.newStaffRole = host.createEmptyStaffRoleDraft({ department: '' });
  }
  host.newSkillInput = '';
  host.showStaffRoleForm = true;
}

async function createEnterpriseStaffRoleFromTemplate(templateId) {
  const host = getHostApp();
  if (!host) return;
  if (typeof host.createStaffFromTemplate === 'function') {
    host.createStaffFromTemplate(templateId);
    return;
  }
  await openEnterpriseStaffRoleForm();
}

async function deleteEnterpriseStaffRole(roleId) {
  const host = getHostApp();
  if (!host || !roleId) return;
  if (typeof host.removeStaffRole === 'function') {
    await host.removeStaffRole(roleId);
    return;
  }
  if (typeof host.deleteRoleCard === 'function') {
    await host.deleteRoleCard(roleId);
  }
}

async function openEnterpriseWorkspaceForm(workspaceId = '') {
  const host = getHostApp();
  if (!host) return;
  const targetId = String(workspaceId || '').trim();
  const workspace = targetId
    ? toArray(host?.enterpriseWorkspaces).find((item) => String(item?.id || '') === targetId) || null
    : null;
  if (typeof host.openWorkspaceForm === 'function') {
    host.openWorkspaceForm(workspace || null);
    return;
  }
  host.showWorkspaceForm = true;
}

async function openEnterpriseWorkspace(workspaceId) {
  const host = getHostApp();
  if (!host || !workspaceId) return;
  if (typeof host.openEnterpriseWorkspace === 'function') {
    await host.openEnterpriseWorkspace(workspaceId);
    return;
  }
  if (typeof host.openEnterpriseTab === 'function') {
    await host.openEnterpriseTab('enterprise-sandbox');
  } else {
    host.enterpriseTab = 'enterprise-sandbox';
  }
  host.sandboxLevel = 1;
  host.sandboxCurrentWs = workspaceId;
}

async function deleteEnterpriseWorkspace(workspaceId) {
  const host = getHostApp();
  if (!host || !workspaceId) return;
  if (typeof host.removeWorkspace === 'function') {
    await host.removeWorkspace(workspaceId);
  }
}

async function openEnterpriseProjectForm(workspaceId = '', projectId = '') {
  const host = getHostApp();
  if (!host) return;
  const targetProjectId = String(projectId || '').trim();
  const project = targetProjectId
    ? toArray(host?.enterpriseProjects).find((item) => String(item?.id || '') === targetProjectId) || null
    : null;
  if (typeof host.openProjectForm === 'function') {
    host.openProjectForm(project || null, String(workspaceId || host.sandboxCurrentWs || ''));
    return;
  }
  host.newProject = {
    ...(host.newProject || {}),
    id: '',
    name: '',
    workspaceId: String(workspaceId || host.sandboxCurrentWs || ''),
    color: '#4ecdc4',
    icon: 'fa-solid fa-folder',
    description: '',
  };
  host.showProjectFloatPanel = true;
}

async function deleteEnterpriseProject(projectId) {
  const host = getHostApp();
  if (!host || !projectId) return;
  if (typeof host.removeProject === 'function') {
    await host.removeProject(projectId);
  }
}

async function openEnterpriseProject(projectId) {
  const host = getHostApp();
  if (!host || !projectId) return;
  const project = toArray(host?.enterpriseProjects).find((item) => String(item?.id || '') === String(projectId || '')) || null;
  if (!project) return;
  if (typeof host.openEnterpriseTab === 'function') {
    await host.openEnterpriseTab('enterprise-sandbox');
  } else {
    host.enterpriseTab = 'enterprise-sandbox';
  }
  host.sandboxLevel = 2;
  host.sandboxCurrentWs = String(project.workspaceId || host.sandboxCurrentWs || '');
  host.sandboxCurrentProject = String(project.id || '');
  host.selected3DAgent = null;
  if (host.enterprise3DScene && typeof host.enterprise3DScene.showFloorView === 'function') {
    host.enterprise3DScene.showFloorView(project.id);
    if (typeof host.enterprise3DScene.resize === 'function') {
      host.enterprise3DScene.resize();
    }
  }
}

async function navigateEnterpriseSandbox(level = 0, targetId = '') {
  const host = getHostApp();
  if (!host) return;
  const targetLevel = Math.max(0, Math.min(2, Number(level || 0)));
  if (targetLevel === 0) {
    host.sandboxLevel = 0;
    host.sandboxCurrentWs = null;
    host.sandboxCurrentProject = null;
    host.selected3DAgent = null;
    if (host.enterprise3DScene && typeof host.enterprise3DScene.showCityView === 'function') {
      host.enterprise3DScene.showCityView();
      if (typeof host.enterprise3DScene.resize === 'function') {
        host.enterprise3DScene.resize();
      }
    }
    return;
  }

  if (targetLevel === 1) {
    const workspaceId = String(targetId || host.sandboxCurrentWs || '').trim();
    if (!workspaceId) return;
    host.sandboxLevel = 1;
    host.sandboxCurrentWs = workspaceId;
    host.sandboxCurrentProject = null;
    host.selected3DAgent = null;
    if (host.enterprise3DScene && typeof host.enterprise3DScene.showBuildingView === 'function') {
      host.enterprise3DScene.showBuildingView(workspaceId);
      if (typeof host.enterprise3DScene.resize === 'function') {
        host.enterprise3DScene.resize();
      }
    }
    return;
  }

  const projectId = String(targetId || host.sandboxCurrentProject || '').trim();
  const project = toArray(host?.enterpriseProjects).find((item) => String(item?.id || '') === projectId) || null;
  if (!project) return;
  host.sandboxLevel = 2;
  host.sandboxCurrentWs = String(project.workspaceId || host.sandboxCurrentWs || '').trim();
  host.sandboxCurrentProject = String(project.id || '').trim();
  host.selected3DAgent = null;
  if (host.enterprise3DScene && typeof host.enterprise3DScene.showFloorView === 'function') {
    host.enterprise3DScene.showFloorView(project.id);
    if (typeof host.enterprise3DScene.resize === 'function') {
      host.enterprise3DScene.resize();
    }
  }
}

async function openEnterpriseSandboxAgentChat(agentId) {
  const host = getHostApp();
  if (!host || !agentId) return;
  const agent = toArray(host?.sandboxAgents).find((item) => String(item?.id || '') === String(agentId || ''))
    || toArray(host?.staffRoles).find((item) => String(item?.id || '') === String(agentId || ''))
    || null;
  if (!agent) return;
  host.selected3DAgent = agent;
  if (typeof host.onAgent3DDblClick === 'function') {
    host.onAgent3DDblClick(agent);
    return;
  }
  host.showSandboxChatPanel = true;
}

async function openEnterpriseStaffRoleForProject(workspaceId = '', projectId = '') {
  const host = getHostApp();
  if (!host) return;
  if (typeof host.createEmptyStaffRoleDraft === 'function') {
    host.newStaffRole = host.createEmptyStaffRoleDraft({
      department: '',
      assignedWorkspace: String(workspaceId || host.sandboxCurrentWs || ''),
      projectId: String(projectId || host.sandboxCurrentProject || ''),
    });
  }
  host.newSkillInput = '';
  if (host.enterprise3DScene && host.enterprise3DScene._isFullscreen) {
    host.showSandboxFloatPanel = true;
  } else {
    host.showStaffRoleForm = true;
  }
}

async function sandboxGoBack() {
  const host = getHostApp();
  if (!host) return;
  if (typeof host.sandboxGoBack === 'function') {
    host.sandboxGoBack();
    return;
  }
  host.sandboxLevel = Math.max(0, Number(host.sandboxLevel || 0) - 1);
}

/**
 * 保存企业知识库；输入含可选 ID 的草稿，返回成功标志，Desktop 经宿主 typed Runtime 写入，宿主缺失时抛错，Browser 使用 HTTP。
 */
async function saveEnterpriseKnowledgeBase(draft = {}) {
  const host = getHostApp();
  if (!host) return false;
  const targetId = String(draft?.id || '').trim();
  const payload = {
    name: String(draft?.name || '').trim(),
    description: String(draft?.description || '').trim(),
    category: String(draft?.category || '').trim(),
  };
  if (typeof host.saveEnterpriseKnowledgeBaseRecord === 'function') {
    await host.saveEnterpriseKnowledgeBaseRecord({ ...payload, ...(targetId ? { id: targetId } : {}) });
  } else {
    if (getDesktopCoreApi()) {
      throw new Error('Desktop Enterprise host bridge is unavailable.');
    }
    const method = targetId ? 'PUT' : 'POST';
    const url = targetId
      ? `/v1/enterprise/knowledge-bases/${targetId}`
      : '/v1/enterprise/knowledge-bases';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error || `Failed to save KB (${res.status})`);
    }
  }
  if (typeof host.loadEnterpriseKBs === 'function') {
    await host.loadEnterpriseKBs();
  }
  return true;
}

/**
 * 删除企业知识库；输入知识库 ID，无返回，Desktop 经宿主 typed Runtime 删除，宿主缺失时抛错，Browser 使用 HTTP。
 */
async function deleteEnterpriseKnowledgeBase(kbId) {
  const host = getHostApp();
  if (!host || !kbId) return;
  if (typeof host.removeEnterpriseKnowledgeBaseRecord === 'function') {
    await host.removeEnterpriseKnowledgeBaseRecord(kbId);
  } else {
    if (getDesktopCoreApi()) {
      throw new Error('Desktop Enterprise host bridge is unavailable.');
    }
    const res = await fetch(`/v1/enterprise/knowledge-bases/${kbId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error || `Failed to delete KB (${res.status})`);
    }
  }
  if (typeof host.loadEnterpriseKBs === 'function') {
    await host.loadEnterpriseKBs();
  }
}

/**
 * 读取企业知识库版本；输入知识库 ID，返回版本数组，Desktop 经宿主 typed Runtime 读取，宿主缺失时抛错，Browser 使用 HTTP。
 */
async function loadEnterpriseKnowledgeBaseVersions(kbId) {
  if (!kbId) return [];
  const host = getHostApp();
  if (typeof host?.loadEnterpriseKnowledgeBaseVersionRecords === 'function') {
    return host.loadEnterpriseKnowledgeBaseVersionRecords(kbId);
  }
  if (getDesktopCoreApi()) {
    throw new Error('Desktop Enterprise host bridge is unavailable.');
  }
  const res = await fetch(`/v1/enterprise/knowledge-bases/${kbId}/versions`);
  if (!res.ok) {
    throw new Error(`Failed to load versions (${res.status})`);
  }
  const data = await res.json();
  return Array.isArray(data?.versions) ? data.versions : [];
}

export function createOpsBridge() {
  return {
    snapshot: buildSurfaceSnapshot,
    ensureLoaded,
    selectSurfaceTab,
    refreshSurface,
    runSystemUpdateCheck,
    openAboutSurface,
    updateSystemSetting,
    setSystemTargetLanguage,
    clearSystemRuntimeCache,
    runSystemQuickAction,
    openSystemPath,
    resetSystemSettings,
    loadFeaturePacks,
    runFeaturePackOperation,
    startPrimaryDeployAction,
    openTaskCenter,
    openTask,
    jumpToMenu,
    // VRM actions
    startVrm,
    startVrmWeb,
    setVrmModel,
    downloadVrmModel,
    toggleVrmMotion,
    setVrmExpressionsEnabled,
    setVrmMotionsEnabled,
    setVrmWindowWidth,
    setVrmWindowHeight,
    setVrmAgent,
    openAddVrmModel,
    openAddVrmMotion,
    deleteVrmUserModel,
    deleteVrmUserMotion,
    openEnterpriseStaffRoleForm,
    createEnterpriseStaffRoleFromTemplate,
    deleteEnterpriseStaffRole,
    openEnterpriseWorkspaceForm,
    openEnterpriseWorkspace,
    deleteEnterpriseWorkspace,
    openEnterpriseProjectForm,
    deleteEnterpriseProject,
    openEnterpriseProject,
    navigateEnterpriseSandbox,
    openEnterpriseSandboxAgentChat,
    openEnterpriseStaffRoleForProject,
    sandboxGoBack,
    saveEnterpriseKnowledgeBase,
    deleteEnterpriseKnowledgeBase,
    loadEnterpriseKnowledgeBaseVersions,
    loadSynapxnetMemories,
    selectSynapxnetMemory,
    createSynapxnetMemory,
    editSynapxnetMemory,
    rollbackSynapxnetMemory,
    retireSynapxnetMemory,
    exportSynapxnetMemories,
    importSynapxnetMemories,
    verifySynapxnetMemory,
  };
}
