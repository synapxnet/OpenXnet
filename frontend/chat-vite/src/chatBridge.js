function getHostApp() {
  return typeof window !== 'undefined' ? window.openxnetApp || null : null;
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

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function textToHtml(value) {
  return escapeHtml(value).replace(/\n/g, '<br>');
}

const assistantHtmlCache = new Map();
const ASSISTANT_HTML_CACHE_LIMIT = 80;
const streamDisplayState = new Map();
const STREAM_DISPLAY_STATE_LIMIT = 24;

function trimAssistantHtmlCache() {
  while (assistantHtmlCache.size > ASSISTANT_HTML_CACHE_LIMIT) {
    const firstKey = assistantHtmlCache.keys().next().value;
    assistantHtmlCache.delete(firstKey);
  }
}

function trimStreamDisplayState() {
  while (streamDisplayState.size > STREAM_DISPLAY_STATE_LIMIT) {
    const firstKey = streamDisplayState.keys().next().value;
    streamDisplayState.delete(firstKey);
  }
}

function getNowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function getSmoothStreamingContent(key, rawContent, streaming) {
  const raw = String(rawContent || '');
  const stableKey = String(key || 'streaming-message');
  if (!streaming || !raw) {
    streamDisplayState.delete(stableKey);
    return raw;
  }

  const now = getNowMs();
  let state = streamDisplayState.get(stableKey);
  if (!state || !raw.startsWith(state.raw || '')) {
    state = {
      raw,
      visibleLength: Math.min(raw.length, 24),
      updatedAt: now,
    };
    streamDisplayState.set(stableKey, state);
    trimStreamDisplayState();
    return raw.slice(0, state.visibleLength);
  }

  state.raw = raw;
  const remaining = Math.max(0, raw.length - state.visibleLength);
  if (remaining <= 0) {
    state.updatedAt = now;
    return raw;
  }

  const elapsed = Math.max(16, Math.min(180, now - state.updatedAt));
  const rate = remaining > 2000 ? 1800 : remaining > 600 ? 900 : 360;
  const maxStep = remaining > 600 ? 120 : 32;
  const step = Math.max(4, Math.min(maxStep, Math.ceil((rate * elapsed) / 1000)));
  state.visibleLength = Math.min(raw.length, state.visibleLength + step);
  state.updatedAt = now;
  return raw.slice(0, state.visibleLength);
}

function stripHtml(value) {
  return String(value || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function getRoleCardAvatarText(host, memory, fallbackName, isZh, maxLength = 2) {
  let text = '';
  try {
    if (host && typeof host.getRoleMemoryAvatarText === 'function') {
      text = String(host.getRoleMemoryAvatarText(memory) || '').trim();
    }
  } catch (error) {
    text = '';
  }
  if (!text) {
    text = String(fallbackName || '').trim() || (isZh ? '角' : 'R');
  }
  return Array.from(text.replace(/\s+/g, '')).slice(0, maxLength).join('').toUpperCase() || (isZh ? '角' : 'R');
}

function getRoleCardAvatarBackground(host, memory) {
  try {
    if (host && typeof host.getRoleMemoryAvatarStyle === 'function') {
      const style = host.getRoleMemoryAvatarStyle(memory);
      if (style?.background) {
        return style.background;
      }
    }
  } catch (error) {}
  return 'linear-gradient(135deg, #73c4ea 0%, #5aa7d1 100%)';
}

function normalizeWorkspacePath(value) {
  return String(value || '').trim();
}

function getWorkspaceKey(value) {
  return normalizeWorkspacePath(value).replace(/[\\/]+$/, '').toLowerCase();
}

function getFallbackTitle(isZh) {
  return isZh ? '实时对话' : 'Live Chat';
}

function getFallbackModel(isZh) {
  return isZh ? '未选择模型' : 'No model';
}

function getProviderOptionValue(host, value) {
  try {
    if (host && typeof host.getProviderModelOptionValue === 'function') {
      return String(host.getProviderModelOptionValue(value) || '').trim();
    }
  } catch (error) {
    // noop
  }
  if (value && typeof value === 'object') {
    return String(value.id || value.value || value.model || value.name || value.label || '').trim();
  }
  return String(value || '').trim();
}

function getProviderOptionLabel(host, value) {
  try {
    if (host && typeof host.getProviderModelOptionLabel === 'function') {
      return String(host.getProviderModelOptionLabel(value) || '').trim();
    }
  } catch (error) {
    // noop
  }
  if (value && typeof value === 'object') {
    return String(value.label || value.name || value.id || value.value || value.model || '').trim();
  }
  return String(value || '').trim();
}

function getCurrentProvider(host) {
  if (!host) return null;
  try {
    if (typeof host.getPrototypeCurrentMainProvider === 'function') {
      const provider = host.getPrototypeCurrentMainProvider();
      if (provider) return provider;
    }
  } catch (error) {
    // noop
  }
  try {
    if (typeof host.findModelProviderById === 'function') {
      return host.findModelProviderById(host?.settings?.selectedProvider) || null;
    }
  } catch (error) {
    // noop
  }
  const providers = toArray(host?.modelProviders);
  const selectedId = String(host?.settings?.selectedProvider || '').trim();
  return providers.find((provider) => String(provider?.id || '').trim() === selectedId) || providers[0] || null;
}

function buildProviderCards(host, isZh) {
  if (!host) {
    return {
      providers: [],
      currentProvider: null,
      configuredCount: 0,
    };
  }

  let sourceProviders = [];
  try {
    if (typeof host.getPrototypeModelProviderCards === 'function') {
      sourceProviders = host.getPrototypeModelProviderCards() || [];
    } else {
      sourceProviders = toArray(host.modelProviders);
    }
  } catch (error) {
    sourceProviders = toArray(host.modelProviders);
  }

  const selectedId = String(host?.settings?.selectedProvider || '').trim();
  const currentProvider = getCurrentProvider(host);
  const providers = sourceProviders.map((provider, index) => {
    const providerId = String(provider?.id || `provider-${index}`);
    let name = String(provider?.displayVendor || provider?.vendor || '').trim();
    let logo = '';
    let summary = String(provider?.summaryText || '').trim();
    let statusLabel = '';

    try {
      if (typeof host.getPrototypeProviderDisplayName === 'function') {
        name = String(host.getPrototypeProviderDisplayName(provider) || name).trim();
      }
    } catch (error) {
      // noop
    }
    try {
      if (typeof host.getPrototypeProviderLogo === 'function') {
        logo = String(host.getPrototypeProviderLogo(provider) || '').trim();
      } else if (typeof host.getProviderDisplayLogo === 'function') {
        logo = String(host.getProviderDisplayLogo(provider) || '').trim();
      }
    } catch (error) {
      // noop
    }
    try {
      if (typeof host.getPrototypeProviderSummaryText === 'function') {
        summary = String(host.getPrototypeProviderSummaryText(provider) || summary).trim();
      }
    } catch (error) {
      // noop
    }
    try {
      if (typeof host.getPrototypeProviderStatusLabel === 'function') {
        statusLabel = String(host.getPrototypeProviderStatusLabel(provider) || '').trim();
      }
    } catch (error) {
      // noop
    }
    let validation = {
      status: '',
      message: '',
      models: [],
    };
    try {
      if (typeof host.getProviderCardValidation === 'function') {
        validation = host.getProviderCardValidation(providerId) || validation;
      }
    } catch (error) {
      validation = {
        status: '',
        message: '',
        models: [],
      };
    }
    const validationModels = toArray(validation?.models)
      .map((item) => ({
        value: getProviderOptionValue(host, item),
        label: getProviderOptionLabel(host, item),
      }))
      .filter((item) => item.value);

    const models = toArray(provider?.models)
      .map((item) => ({
        value: getProviderOptionValue(host, item),
        label: getProviderOptionLabel(host, item),
      }))
      .filter((item) => item.value);

    const modelId = String(provider?.modelId || provider?.model || '').trim();
    const isActive = provider?.isTemplate
      ? Boolean(currentProvider && String(currentProvider?.id || '') === providerId)
      : (selectedId ? providerId === selectedId : Boolean(currentProvider && String(currentProvider?.id || '') === providerId));

    return {
      id: providerId,
      name: name || (isZh ? '未命名服务商' : 'Unnamed provider'),
      vendor: String(provider?.vendor || '').trim(),
      logo,
      summary,
      modelId,
      models,
      validationStatus: String(validation?.status || '').trim(),
      validationMessage: String(validation?.message || '').trim(),
      validationChecks: toArray(validation?.checks),
      matchedModel: !!validation?.matched_model,
      apiKeyConfigured: !!validation?.api_key_configured,
      apiKeyOptional: !!validation?.api_key_optional,
      validationModels,
      isValidating: !!host?.providerCardValidatingById?.[providerId],
      isApplying: !!host?.providerCardApplyingById?.[providerId],
      isActive,
      isTemplate: !!provider?.isTemplate,
      statusLabel: statusLabel || (provider?.isTemplate ? (isZh ? '模板' : 'Template') : (isZh ? '已配置' : 'Configured')),
    };
  });

  // —— 过滤：右侧面板只展示真正配置好的服务商 ——
  // 1. 模板（isTemplate=true）—— 不显示，避免"供应商 / 未配置"占位卡 + 全部 OpenXnet logo
  // 2. 配置不完整（没有 vendor 名 / 没有 API Key 也没有 URL 也没有模型）—— 隐藏
  const visibleProviders = providers.filter((p) => {
    if (p.isTemplate) return false;
    const hasVendor = String(p.vendor || '').trim().length > 0
      && p.name !== (isZh ? '未命名服务商' : 'Unnamed provider')
      && p.name !== (isZh ? '供应商' : 'Provider');
    const hasModel = !!p.modelId || (Array.isArray(p.models) && p.models.length > 0);
    const hasKey = !!p.apiKeyConfigured;
    return hasVendor && (hasModel || hasKey);
  });

  return {
    providers: visibleProviders,
    currentProvider: currentProvider
      ? visibleProviders.find((item) => String(item.id) === String(currentProvider?.id || ''))
        || providers.find((item) => String(item.id) === String(currentProvider?.id || ''))
        || {
          id: String(currentProvider?.id || ''),
          name: String(currentProvider?.displayVendor || currentProvider?.vendor || (isZh ? '当前服务商' : 'Current provider')),
          vendor: String(currentProvider?.vendor || ''),
          logo: '',
          summary: '',
          modelId: String(currentProvider?.modelId || currentProvider?.model || ''),
          models: [],
          validationStatus: '',
          validationMessage: '',
          validationChecks: [],
          matchedModel: false,
          apiKeyConfigured: false,
          apiKeyOptional: false,
          validationModels: [],
          isValidating: false,
          isApplying: false,
          isActive: true,
          isTemplate: !!currentProvider?.isTemplate,
          statusLabel: currentProvider?.isTemplate ? (isZh ? '模板' : 'Template') : (isZh ? '当前服务商' : 'Current'),
        }
      : null,
    configuredCount: visibleProviders.length,
  };
}

function buildRoleCardState(host, isZh) {
  const memorySettings = host?.memorySettings || {};
  const selectedId = String(memorySettings.selectedMemory || '').trim();
  const cards = toArray(host?.memories)
    .map((memory, index) => {
      const id = String(memory?.id || '').trim();
      const name = String(memory?.name || '').trim() || (isZh ? `未命名角色 ${index + 1}` : `Untitled role ${index + 1}`);
      const desc = String(memory?.description || memory?.personality || memory?.note || '').trim();
      const avatarText = getRoleCardAvatarText(host, memory, name, isZh, 2);
      return {
        id,
        name,
        desc: desc || (isZh ? '选择后会作为当前对话角色卡使用' : 'Use this role card for the current chat'),
        tag: memory?.infer ? (isZh ? '自动学习' : 'Learning') : (isZh ? '角色档案' : 'Profile'),
        initial: avatarText,
        avatarText,
        avatarImage: String(memory?.avatar || '').trim(),
        avatarBackground: getRoleCardAvatarBackground(host, memory),
      };
    })
    .filter((card) => card.id);
  const selected = cards.find((card) => String(card.id) === selectedId) || null;
  return {
    cards,
    selectedId: selected ? selected.id : '',
    selectedName: selected ? selected.name : (isZh ? '未启用角色卡' : 'No role card'),
    selectedAvatarText: selected ? selected.avatarText : (isZh ? '角' : 'AI'),
    selectedAvatarImage: selected ? selected.avatarImage : '',
    selectedAvatarBackground: selected ? selected.avatarBackground : 'linear-gradient(135deg, #5BA3C5, #7BB8D4)',
    enabled: !!memorySettings.is_memory && !!selected,
    available: cards.length > 0
      || typeof host?.openChatRoleCardPanel === 'function'
      || typeof host?.selectRoleMemory === 'function',
  };
}

function getConversationTitle(host, isZh) {
  if (!host) return getFallbackTitle(isZh);
  try {
    if (host.conversationId && typeof host.getPrototypeConversationTitle === 'function') {
      const title = host.getPrototypeConversationTitle({
        id: host.conversationId,
        title: host.currentConversation?.title || '',
        messages: host.messages || [],
      });
      if (title && String(title).trim()) return String(title);
    }
  } catch (error) {
    /* fall through */
  }
  return getFallbackTitle(isZh);
}

function getMessageTimeLabel(message, fallback = '') {
  const explicit = String(message?.prototypeTime || message?.time || '').trim();
  if (explicit) return explicit;
  const raw = message?.timestamp || message?.created_at || '';
  if (!raw) return fallback;
  try {
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return String(raw);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (error) {
    return String(raw);
  }
}

function hasRenderableMessages(host) {
  if (!host || !Array.isArray(host.messages)) {
    return false;
  }
  return host.messages.some((message, index) => {
    if (message?.role === 'system' && index === 0) return false;
    return String(message?.content || '').trim().length > 0
      || (message?.role === 'assistant' && host.isTyping)
      || (message?.role === 'assistant' && Array.isArray(message?.activityLog) && message.activityLog.length > 0);
  });
}

function formatAssistantHtml(host, content, index, cacheKey = index, stateKey = '') {
  const raw = String(content || '');
  if (!raw.trim()) return '';
  const stableKey = `${String(cacheKey || index)}::${String(stateKey || '')}`;
  const cached = assistantHtmlCache.get(stableKey);
  if (cached && cached.raw === raw) {
    return cached.html;
  }
  let html = '';
  try {
    if (host && typeof host.formatMessage === 'function') {
      const formatted = host.formatMessage.call(host, raw, index);
      if (formatted && String(formatted).trim()) {
        html = String(formatted);
        assistantHtmlCache.set(stableKey, { raw, html });
        trimAssistantHtmlCache();
        return html;
      }
    }
  } catch (error) {
    html = textToHtml(raw);
    assistantHtmlCache.set(stableKey, { raw, html });
    trimAssistantHtmlCache();
    return html;
  }
  html = textToHtml(raw);
  assistantHtmlCache.set(stableKey, { raw, html });
  trimAssistantHtmlCache();
  return html;
}

function stripRuntimeToolBlocks(content) {
  const raw = String(content || '');
  if (!raw.includes('highlight-block')) return raw;
  try {
    if (typeof document !== 'undefined') {
      const node = document.createElement('div');
      node.innerHTML = raw;
      node.querySelectorAll('.highlight-block, .highlight-block-error').forEach((item) => item.remove());
      return node.innerHTML;
    }
  } catch (error) {
    // Fall through to conservative regex cleanup.
  }
  return raw
    .replace(/<div[^>]*class="[^"]*\bhighlight-block\b[^"]*"[\s\S]*?<\/div>\s*/gi, '')
    .replace(/<div[^>]*class="[^"]*\bhighlight-block-error\b[^"]*"[\s\S]*?<\/div>\s*/gi, '');
}

function splitReadableUnits(value) {
  const text = String(value || '').replace(/\r\n/g, '\n');
  const units = [];
  let current = '';
  for (const char of text) {
    current += char;
    if ('。！？!?；;：:\n'.includes(char)) {
      units.push(current);
      current = '';
    }
  }
  if (current) units.push(current);
  return units;
}

function normalizeRepeatUnit(value) {
  return stripHtml(value)
    .replace(/[`*_#>[\](){}"'“”‘’]/g, '')
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase();
}

function collapseRepeatedText(value) {
  const raw = String(value || '');
  if (!raw.trim()) return raw;
  const units = splitReadableUnits(raw);
  if (units.length < 4) return raw;

  const seen = new Map();
  const result = [];
  let removed = 0;
  for (const unit of units) {
    const normalized = normalizeRepeatUnit(unit);
    const meaningful = normalized.length >= 14;
    const count = seen.get(normalized) || 0;
    if (meaningful && count > 0) {
      removed += 1;
      seen.set(normalized, count + 1);
      continue;
    }
    if (normalized) {
      seen.set(normalized, count + 1);
    }
    result.push(unit);
  }
  if (removed < 2) return raw;
  return result.join('').replace(/\n{3,}/g, '\n\n').trim();
}

function cleanAssistantDisplayContent(content, activityVisible = false) {
  const withoutToolBlocks = activityVisible ? stripRuntimeToolBlocks(content) : String(content || '');
  return collapseRepeatedText(withoutToolBlocks);
}

function cleanPreviewText(value) {
  const withoutBlocks = stripRuntimeToolBlocks(String(value || ''))
    .replace(/<div[^>]*class="[^"]*\bhighlight-block-reasoning\b[^"]*"[^>]*>/gi, '')
    .replace(/<\/div>/gi, ' ');
  const plain = stripHtml(withoutBlocks);
  const compact = collapseRepeatedText(plain).replace(/\s+/g, ' ').trim();
  const maxLength = 42;
  const chars = Array.from(compact);
  return chars.length > maxLength ? `${chars.slice(0, maxLength).join('')}...` : compact;
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.round(Number(ms || 0) / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}m ${seconds}s`;
}

function normalizeActivityTime(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

function buildActivityState(host, message, isLatest, isZh) {
  if (!message || message.role !== 'assistant') {
    return { visible: false, steps: [], signature: '' };
  }
  const now = Date.now();
  const log = Array.isArray(message.activityLog) ? message.activityLog : [];
  const hasRuntime = log.length > 0 || (!!host?.isTyping && isLatest);
  if (!hasRuntime) {
    return { visible: false, steps: [], signature: '' };
  }
  const startedAt = normalizeActivityTime(message.activityStartedAt)
    || normalizeActivityTime(message.createdAt)
    || normalizeActivityTime(message.id)
    || now;
  const endedAt = normalizeActivityTime(message.activityEndedAt);
  const isActive = !!host?.isTyping && isLatest && !message.generationFinished;
  const elapsedMs = (endedAt || now) - startedAt;
  const fallbackStep = {
    id: 'assistant-thinking',
    kind: 'thinking',
    status: isActive ? 'running' : 'done',
    label: isActive ? (isZh ? '正在' : 'Now') : (isZh ? '已完成' : 'Done'),
    title: isActive ? (isZh ? '思考下一步' : 'Thinking about the next step') : (isZh ? '完成回复' : 'Finished'),
    startedAt,
    updatedAt: now,
    endedAt: isActive ? null : (endedAt || now),
  };
  const normalized = (log.length ? log : [fallbackStep]).map((step, index) => {
    const stepStartedAt = normalizeActivityTime(step?.startedAt) || startedAt;
    const stepEndedAt = normalizeActivityTime(step?.endedAt);
    const status = String(step?.status || 'running');
    const duration = stepEndedAt && stepEndedAt >= stepStartedAt ? formatDuration(stepEndedAt - stepStartedAt) : '';
    return {
      id: String(step?.id || `activity-${index}`),
      kind: String(step?.kind || 'status'),
      status,
      label: String(step?.label || (status === 'running' ? (isZh ? '正在' : 'Now') : (isZh ? '已完成' : 'Done'))),
      title: String(step?.title || '').trim(),
      detail: String(step?.detail || '').trim(),
      duration,
      order: index,
      running: status === 'running',
    };
  }).filter((step) => step.title || step.label);
  const sorted = normalized.slice().sort((a, b) => {
    if (a.kind === 'thinking' && b.kind !== 'thinking') return 1;
    if (a.kind !== 'thinking' && b.kind === 'thinking') return -1;
    return a.order - b.order;
  }).slice(-8);
  const signature = [
    Math.floor(elapsedMs / 1000),
    isActive ? 'active' : 'done',
    ...sorted.map((step) => [step.id, step.status, step.label, step.title, step.detail, step.duration].join(':')),
  ].join('|');
  return {
    visible: sorted.length > 0,
    active: isActive || sorted.some((step) => step.running),
    elapsedLabel: isZh ? `已处理 ${formatDuration(elapsedMs)}` : `Processed ${formatDuration(elapsedMs)}`,
    steps: sorted,
    signature,
  };
}

function normalizeLiveMessages(host) {
  const filtered = (host?.messages || []).filter((message, index) => {
    return !(message?.role === 'system' && index === 0);
  });
  const isZh = isCurrentLanguageZh(host);
  return filtered.map((message, index) => {
    const role = message?.role === 'assistant' ? 'assistant' : 'user';
    const isLatest = index === filtered.length - 1;
    const activity = buildActivityState(host, message, isLatest, isZh);
    const content = String(message?.pure_content || message?.content || '');
    const messageKey = message?.id || `live-${index}`;
    const isStreaming = role === 'assistant' && isLatest && !!host?.isTyping && !message?.generationFinished;
    const displayContent = role === 'assistant'
      ? getSmoothStreamingContent(messageKey, content, isStreaming)
      : content;
    const renderContent = role === 'assistant'
      ? cleanAssistantDisplayContent(displayContent, activity.visible)
      : content;
    const renderStateKey = [
      isZh ? 'zh' : 'en',
      isLatest && host?.isTyping ? 'typing' : 'idle',
      message?.generationFinished ? 'done' : 'open',
      activity.visible ? 'activity' : 'plain',
    ].join(':');
    return {
      id: String(message?.id || `live-${index}`),
      role,
      text: role === 'user' ? stripHtml(content) : '',
      html: role === 'assistant'
        ? formatAssistantHtml(host, renderContent, index, messageKey, renderStateKey)
        : '',
      typing: role === 'assistant' && !String(content || '').trim() && !!host?.isTyping && isLatest,
      time: getMessageTimeLabel(message),
      activity,
    };
  });
}

function getEmptyStatePrompt(isZh) {
  return isZh
    ? '从输入框开始你的第一条消息，AI 助手会立刻回应。'
    : 'Send your first message to start chatting with the assistant.';
}

function getSettingsState(host, isZh) {
  if (!host) {
    return {
      model: getFallbackModel(isZh),
      providerName: isZh ? '未选择服务商' : 'No provider',
      temperature: 0.7,
      maxTokens: 8192,
      maxTokensOptions: [1024, 2048, 4096, 8192, 16384, 32768],
      systemPrompt: '',
      memoryEnabled: false,
      memoryAvailable: false,
      interpreterEnabled: false,
      asrEnabled: false,
      webSearchEnabled: false,
      browserControlEnabled: false,
      browserControlAvailable: false,
      ttsEnabled: false,
      ttsAvailable: false,
      desktopVisionEnabled: false,
      desktopVisionAvailable: false,
      screenshotAvailable: false,
      tablePetAvailable: false,
      roleCardAvailable: false,
      roleCardEnabled: false,
      roleCardName: isZh ? '未启用角色卡' : 'No role card',
      roleCardSelectedId: '',
      roleCardAvatarText: 'AI',
      roleCardAvatarImage: '',
      roleCardAvatarBackground: 'linear-gradient(135deg, #5BA3C5, #7BB8D4)',
      roleCards: [],
      isElectron: false,
    };
  }
  const settings = host.settings || {};
  const memorySettings = host.memorySettings || {};
  const codeSettings = host.codeSettings || {};
  const asrSettings = host.asrSettings || {};
  const webSearchSettings = host.webSearchSettings || {};
  const chromeMCPSettings = host.chromeMCPSettings || {};
  const ttsSettings = host.ttsSettings || {};
  const visionSettings = host.visionSettings || {};
  const moreDict = Array.isArray(host.MoreButtonDict) ? host.MoreButtonDict : [];
  const isMoreEnabled = (name) => {
    const entry = moreDict.find((item) => item && item.name === name);
    return !!entry?.enabled;
  };
  const numericTemp = Number(settings.temperature);
  const numericMax = Number(settings.max_tokens);
  const providerBundle = buildProviderCards(host, isZh);
  const currentProvider = providerBundle.currentProvider;
  const roleCardState = buildRoleCardState(host, isZh);
  return {
    model: String(settings.model || '').trim() || getFallbackModel(isZh),
    providerName: String(currentProvider?.name || (isZh ? '未选择服务商' : 'No provider')).trim(),
    providerLogo: String(currentProvider?.logo || '').trim(),
    providerSummary: String(currentProvider?.summary || '').trim(),
    providerId: String(currentProvider?.id || settings.selectedProvider || '').trim(),
    providerCards: providerBundle.providers,
    configuredProviderCount: Number(providerBundle.configuredCount || 0),
    temperature: Number.isFinite(numericTemp) ? numericTemp : 0.7,
    maxTokens: Number.isFinite(numericMax) && numericMax > 0 ? numericMax : 8192,
    maxTokensOptions: [1024, 2048, 4096, 8192, 16384, 32768],
    systemPrompt: String(host.system_prompt || '').trim(),
    memoryEnabled: !!memorySettings.is_memory,
    memoryAvailable: typeof memorySettings.is_memory === 'boolean',
    interpreterEnabled: !!codeSettings.enabled,
    asrEnabled: !!asrSettings.enabled,
    webSearchEnabled: !!webSearchSettings.enabled,
    browserControlEnabled: !!chromeMCPSettings.enabled,
    browserControlAvailable: !!host.isElectron,
    ttsEnabled: !!ttsSettings.enabled,
    ttsAvailable: isMoreEnabled('ttsButton'),
    desktopVisionEnabled: !!visionSettings.desktopVision,
    desktopVisionAvailable: !!host.isElectron && isMoreEnabled('desktopVisionButton'),
    screenshotAvailable: !!host.isElectron && isMoreEnabled('screenshotButton'),
    tablePetAvailable: isMoreEnabled('vrmButton'),
    roleCardAvailable: isMoreEnabled('roleCardButton') || roleCardState.available,
    roleCardEnabled: roleCardState.enabled,
    roleCardName: roleCardState.selectedName,
    roleCardSelectedId: roleCardState.selectedId,
    roleCardAvatarText: roleCardState.selectedAvatarText,
    roleCardAvatarImage: roleCardState.selectedAvatarImage,
    roleCardAvatarBackground: roleCardState.selectedAvatarBackground,
    roleCards: roleCardState.cards,
    isElectron: !!host.isElectron,
    // —— 新增：权限模式 + 上下文进度 + custom 服务商每日积分 ——
    workspace: buildWorkspaceState(host, isZh),
    permission: buildPermissionState(host, isZh),
    contextWindow: buildContextWindowState(host, isZh),
    customCredits: buildCustomCreditsState(host, currentProvider, isZh),
  };
}

function buildWorkspaceState(host, isZh) {
  const cli = host?.CLISettings || {};
  const path = normalizeWorkspacePath(cli.cc_path);
  const name = path ? path.split(/[/\\]/).filter(Boolean).slice(-1)[0] || path : '';
  // 项目历史（最近打开的工作区）
  const recents = Array.isArray(host?.chatRecentProjects) ? host.chatRecentProjects : [];
  const seen = new Set();
  const projects = recents
    .map((p) => {
      const projPath = normalizeWorkspacePath(p?.path || p);
      const key = getWorkspaceKey(projPath);
      if (!projPath || seen.has(key)) return null;
      seen.add(key);
      const projName = projPath.split(/[/\\]/).filter(Boolean).slice(-1)[0] || projPath;
      return {
        id: projPath,
        path: projPath,
        name: projName,
        isActive: getWorkspaceKey(projPath) === getWorkspaceKey(path),
        lastUsed: p?.lastUsed || '',
      };
    })
    .filter(Boolean);
  // 把当前路径如果不在历史中，也加进去置顶
  if (path && !projects.some((p) => getWorkspaceKey(p.path) === getWorkspaceKey(path))) {
    projects.unshift({ id: path, path, name, isActive: true, lastUsed: '' });
  }
  // Git 状态：从 host.gitInfo / host.gitBranch 读取（如果有）
  const gitInfo = host?.gitInfo || host?.workspaceGitInfo || null;
  const gitEnabled = !!(gitInfo && gitInfo.enabled !== false && (gitInfo.branch || gitInfo.currentBranch));
  return {
    loaded: !!path,
    path,
    name: name || (isZh ? '未选择工作区' : 'No workspace'),
    projects,
    git: gitEnabled ? {
      enabled: true,
      branch: String(gitInfo.branch || gitInfo.currentBranch || 'main'),
      branches: Array.isArray(gitInfo.branches) ? gitInfo.branches : [],
      dirty: !!gitInfo.dirty,
      ahead: Number(gitInfo.ahead || 0),
      behind: Number(gitInfo.behind || 0),
    } : { enabled: false },
  };
}

function buildPermissionState(host, isZh) {
  const current = getActivePermissionMode(host);
  const hostOptions = getHostPermissionOptions(host);
  const options = (hostOptions.length ? hostOptions : [
    { value: 'default', label: isZh ? '默认只读模式' : 'Default read-only mode' },
    { value: 'plan', label: isZh ? '计划模式' : 'Plan' },
    { value: 'acceptEdits', label: isZh ? '接受编辑模式' : 'Accept edit mode' },
    { value: 'bypassPermissions', label: isZh ? '最高权限模式' : 'All permissions mode' },
  ]).sort(sortPermissionOptions).map((item) => decoratePermissionOption(item, isZh));
  if (current && !options.some((item) => item.id === current)) {
    options.unshift(decoratePermissionOption({ value: current, label: getPermissionModeLabel(host, current, isZh) }, isZh));
  }
  return { current, options };
}

function sortPermissionOptions(left, right) {
  const order = {
    default: 0,
    plan: 1,
    'auto-approve': 2,
    acceptEdits: 2,
    'auto-edit': 2,
    yolo: 3,
    bypassPermissions: 3,
    cowork: 4,
  };
  const leftValue = String(left?.value || left?.id || '').trim();
  const rightValue = String(right?.value || right?.id || '').trim();
  const leftOrder = Object.prototype.hasOwnProperty.call(order, leftValue) ? order[leftValue] : 99;
  const rightOrder = Object.prototype.hasOwnProperty.call(order, rightValue) ? order[rightValue] : 99;
  return leftOrder - rightOrder;
}

function getHostPermissionOptions(host) {
  if (!host || typeof host.getCliPermissionModeOptions !== 'function') return [];
  try {
    return toArray(host.getCliPermissionModeOptions())
      .map((item) => ({
        value: String(item?.value || item?.id || '').trim(),
        label: String(item?.label || item?.name || item?.value || item?.id || '').trim(),
      }))
      .filter((item) => item.value);
  } catch (error) {
    return [];
  }
}

function getPermissionModeLabel(host, mode, isZh) {
  try {
    if (host && typeof host.getPermissionModeLabel === 'function') {
      const label = host.getPermissionModeLabel(mode);
      if (label) return String(label);
    }
  } catch (error) {
    // noop
  }
  const id = String(mode || 'default').trim();
  const fallback = {
    plan: isZh ? '计划模式' : 'Plan mode',
    default: isZh ? '默认只读模式' : 'Default read-only mode',
    'auto-approve': isZh ? '接受编辑模式' : 'Accept edit mode',
    acceptEdits: isZh ? '接受编辑模式' : 'Accept edit mode',
    'auto-edit': isZh ? '接受编辑模式' : 'Accept edit mode',
    yolo: isZh ? '最高权限模式' : 'All permissions mode',
    bypassPermissions: isZh ? '最高权限模式' : 'All permissions mode',
    cowork: isZh ? 'Cowork模式' : 'Cowork mode',
  };
  return fallback[id] || id || fallback.default;
}

function getActivePermissionMode(host) {
  try {
    if (host && typeof host.getActiveCliPermissionMode === 'function') {
      return String(host.getActiveCliPermissionMode() || 'default').trim() || 'default';
    }
  } catch (error) {
    // noop
  }
  const engine = String(host?.CLISettings?.engine || 'local').trim().toLowerCase();
  const map = {
    ds: host?.dsSettings,
    cc: host?.ccSettings,
    oc: host?.ocSettings,
    qc: host?.qcSettings,
    local: host?.localEnvSettings,
  };
  return String(map[engine]?.permissionMode || host?.CLISettings?.permissionMode || 'default').trim() || 'default';
}

function decoratePermissionOption(item, isZh) {
  const id = String(item?.value || item?.id || 'default').trim() || 'default';
  const normalized = id === 'acceptEdits' || id === 'auto-approve' || id === 'auto-edit'
    ? 'accept'
    : id === 'bypassPermissions' || id === 'yolo'
      ? 'bypass'
      : id;
  const iconMap = {
    plan: 'fa-solid fa-clipboard-list',
    default: 'fa-solid fa-shield-halved',
    accept: 'fa-solid fa-pen-to-square',
    bypass: 'fa-solid fa-bolt',
    cowork: 'fa-solid fa-people-arrows',
  };
  const descMap = {
    plan: isZh ? '只规划不执行，适合先审阅方案' : 'Plan only and review before execution',
    default: isZh ? '执行工具前会保持确认' : 'Keep confirmation before tool execution',
    accept: isZh ? '自动接受编辑类操作，敏感操作仍确认' : 'Auto-accept edit operations, keep sensitive prompts',
    bypass: isZh ? '直接放行工具操作，请确认风险后使用' : 'Allow tool operations directly; use with care',
    cowork: isZh ? '协作模式，适合多人/多智能体流程' : 'Collaboration mode for multi-agent workflows',
  };
  return {
    id,
    label: String(item?.label || id).trim(),
    icon: iconMap[normalized] || 'fa-solid fa-shield-halved',
    desc: descMap[normalized] || (isZh ? '当前引擎提供的权限模式' : 'Permission mode from current engine'),
  };
}

function buildContextWindowState(host, isZh) {
  const settings = host?.settings || {};
  // 1) 配置上限：优先用 max_input_tokens / context_window；缺省 1M
  const limit = Number(settings.max_input_tokens || settings.context_window || settings.contextLimit || 1_000_000);
  // 2) 已用估算：消息总字符数 / 1.8（粗略 zh 平均 token 比）
  const messages = Array.isArray(host?.messages) ? host.messages : [];
  let charCount = 0;
  messages.forEach((m) => {
    charCount += String(m?.pure_content || m?.content || '').length;
  });
  const used = Math.round(charCount / 1.8);
  const ratio = limit > 0 ? Math.min(1, used / limit) : 0;
  // OpenXnet 自动压缩阈值约 92% — 接近时提示
  const warn = ratio >= 0.85;
  const critical = ratio >= 0.92;
  return {
    used,
    limit,
    ratio,
    percent: Math.round(ratio * 100),
    warn,
    critical,
    autoCompactAt: 0.92,
    label: isZh ? `${formatTokens(used)} / ${formatTokens(limit)}` : `${formatTokens(used)} / ${formatTokens(limit)}`,
    summary: isZh
      ? (critical ? '即将自动压缩' : warn ? '上下文较满，注意压缩' : '上下文充足')
      : (critical ? 'About to auto-compact' : warn ? 'Context filling up' : 'Plenty of room'),
  };
}

function formatTokens(n) {
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}

function buildCustomCreditsState(host, currentProvider, isZh) {
  const vendor = String(currentProvider?.vendor || '').toLowerCase();
  const isCustom = vendor === 'custom' || vendor === 'openxnet' || String(currentProvider?.id || '').includes('custom');
  if (!isCustom) {
    return { active: false };
  }
  const credits = host?.subscriptionCredits || {};
  const usage = host?.authState?.gatewayUsage || {};
  const dailyRemaining = Number(credits.dailyRemaining || 0);
  const dailyQuota = Number(credits.dailyQuota || 0);
  const totalRemaining = Number(credits.totalRemaining || credits.dailyRemaining || 0);
  const planName = String(credits.activePlanName || credits.activePlanCode || '').trim();
  const dailyRatio = dailyQuota > 0 ? Math.min(1, (dailyQuota - dailyRemaining) / dailyQuota) : 0;
  return {
    active: true,
    dailyRemaining,
    dailyQuota,
    dailyUsedRatio: dailyRatio,
    totalRemaining,
    bonusCredits: Number(credits.bonusCredits || 0),
    topupCredits: Number(credits.topupCredits || 0),
    planName: planName || (isZh ? '未订阅' : 'Free tier'),
    label: isZh ? `日 ${formatTokens(dailyRemaining)} 剩余` : `Daily ${formatTokens(dailyRemaining)} left`,
    summary: dailyQuota > 0
      ? (isZh ? `今日 ${formatTokens(dailyRemaining)}/${formatTokens(dailyQuota)} 积分剩余` : `${formatTokens(dailyRemaining)}/${formatTokens(dailyQuota)} daily credits left`)
      : (isZh ? '尚未配置每日额度' : 'No daily quota configured'),
  };
}

function buildAttachments(host) {
  // 把宿主 composer 的临时附件区暴露给 chat-vite 渲染。
  // host.files / host.images 来自 addFiles()，每项形如 { path, name, file }。
  // path 是 URL.createObjectURL(file)，可直接当 <img src> 用。
  const files = Array.isArray(host?.files) ? host.files : [];
  const images = Array.isArray(host?.images) ? host.images : [];
  const result = [];
  files.forEach((item, index) => {
    if (!item) return;
    result.push({
      kind: 'file',
      index,
      name: String(item.name || ''),
      path: String(item.path || ''),
    });
  });
  // 注意：host.removeItem 计算 image index 时是 (index - files.length)，
  // 所以这里给 image 的索引保留它在原 images 数组里的下标，
  // 由 bridge.removeAttachment 内部转换。
  images.forEach((item, index) => {
    if (!item) return;
    result.push({
      kind: 'image',
      index,
      name: String(item.name || ''),
      path: String(item.path || ''),
    });
  });
  return result;
}

function buildConversationList(host) {
  if (!host || typeof host.getPrototypeConversationItems !== 'function') {
    return [];
  }
  let items = [];
  try {
    items = host.getPrototypeConversationItems() || [];
  } catch (error) {
    items = [];
  }
  const activeId = host.conversationId == null ? null : String(host.conversationId);
  return items.map((conversation) => {
    const id = conversation?.id == null ? '' : String(conversation.id);
    let title = '';
    let preview = '';
    try {
      title = host.getPrototypeConversationTitle ? host.getPrototypeConversationTitle(conversation) : '';
    } catch (error) { /* ignore */ }
    try {
      preview = host.getPrototypeConversationPreview ? host.getPrototypeConversationPreview(conversation) : '';
    } catch (error) { /* ignore */ }
    let time = '';
    try {
      time = host.formatDate ? host.formatDate(conversation?.timestamp) : '';
    } catch (error) { /* ignore */ }
    return {
      id,
      title: String(title || conversation?.title || '').trim() || (host.t ? host.t('untitled') : 'Untitled'),
      preview: cleanPreviewText(preview || ''),
      time: String(time || ''),
      providerName: String(conversation?.providerName || conversation?.providerVendor || '').trim(),
      model: String(conversation?.model || '').trim(),
      isActive: !!id && id === activeId,
    };
  });
}

function getSnapshot() {
  const host = getHostApp();
  const isZh = isCurrentLanguageZh(host);
  const liveMessages = hasRenderableMessages(host) ? normalizeLiveMessages(host) : [];
  const settingsState = getSettingsState(host, isZh);
  const conversations = buildConversationList(host);
  const attachments = buildAttachments(host);
  const currentProvider = getCurrentProvider(host);
  const providerName = String(settingsState.providerName || currentProvider?.name || '').trim();
  const modelDisplay = providerName
    ? `${providerName} · ${String(settingsState.model || getFallbackModel(isZh)).trim()}`
    : String(settingsState.model || getFallbackModel(isZh)).trim();
  return {
    isZh,
    activeMenu: String(host?.activeMenu || ''),
    conversationId: String(host?.conversationId || '').trim(),
    title: getConversationTitle(host, isZh),
    model: settingsState.model,
    modelDisplay,
    settings: settingsState,
    messages: liveMessages,
    isEmpty: liveMessages.length === 0,
    emptyPrompt: getEmptyStatePrompt(isZh),
    isSending: !!(host?.isSending || host?.isTyping),
    interpreterEnabled: settingsState.interpreterEnabled,
    asrEnabled: settingsState.asrEnabled,
    canUseHost: !!host,
    conversations,
    historyQuery: String(host?.prototypeChatHistoryQuery || ''),
    attachments,
  };
}

async function sendMessage(text) {
  const host = getHostApp();
  if (!host) return false;
  host.userInput = String(text || '');
  await host.handleSendOrGuidance();
  return true;
}

async function saveHostSettings(host) {
  if (!host || typeof host.autoSaveSettings !== 'function') return;
  try {
    await Promise.resolve(host.autoSaveSettings());
  } catch (error) {
    console.warn('[chat-vite] autoSaveSettings failed:', error);
  }
}

function rememberWorkspaceProject(host, path) {
  const projectPath = normalizeWorkspacePath(path);
  if (!host || !projectPath) return [];
  const key = getWorkspaceKey(projectPath);
  const existing = Array.isArray(host.chatRecentProjects) ? host.chatRecentProjects : [];
  const next = [
    { path: projectPath, lastUsed: new Date().toISOString() },
    ...existing.filter((item) => getWorkspaceKey(item?.path || item) !== key),
  ].slice(0, 12);
  host.chatRecentProjects = next;
  return next;
}

function activateCliWorkspace(host, path) {
  const projectPath = normalizeWorkspacePath(path);
  if (!host || !projectPath) return false;
  if (!host.CLISettings) host.CLISettings = {};
  host.CLISettings.enabled = true;
  host.CLISettings.cc_path = projectPath;
  if (!host.CLISettings.visibilityScope) {
    host.CLISettings.visibilityScope = 'workspace';
  }
  if (!host.CLISettings.engine) {
    host.CLISettings.engine = 'local';
  }
  return true;
}

async function startNewChat() {
  const host = getHostApp();
  if (!host) return false;
  if (typeof host.clearMessages === 'function') {
    await Promise.resolve(host.clearMessages());
  }
  host.activeMenu = 'chat';
  return true;
}

function openHistory() {
  const host = getHostApp();
  if (!host) return;
  host.showHistoryDialog = true;
}

function openModelPicker() {
  const host = getHostApp();
  if (!host) return;
  if (typeof host.openModelPicker === 'function') {
    host.openModelPicker();
    return;
  }
  host.showModelDialog = true;
}

async function selectChatProvider(providerId) {
  const host = getHostApp();
  if (!host || !providerId) return;
  let provider = null;
  try {
    if (typeof host.findModelProviderById === 'function') {
      provider = host.findModelProviderById(providerId);
    }
  } catch (error) {
    provider = null;
  }
  if (!provider) {
    provider = toArray(host?.modelProviders).find((item) => String(item?.id || '') === String(providerId || '')) || null;
  }

  if (provider?.isTemplate) {
    if (typeof host.selectModelProviderForUiplan === 'function') {
      host.selectModelProviderForUiplan(provider);
    }
    openModelPicker();
    return;
  }

  if (typeof host.applyProviderCardToMain === 'function') {
    await host.applyProviderCardToMain(provider);
    return;
  }

  if (typeof host.selectMainProvider === 'function') {
    await host.selectMainProvider(providerId);
    return;
  }

  if (provider) {
    if (!host.settings) host.settings = {};
    host.settings.selectedProvider = providerId;
    host.settings.model = String(provider.modelId || '').trim();
    host.settings.base_url = String(provider.url || '').trim();
    host.settings.api_key = String(provider.apiKey || '').trim();
    if (typeof host.autoSaveSettings === 'function') {
      await host.autoSaveSettings();
    }
  }
}

async function selectChatProviderModel(providerId, modelId) {
  const host = getHostApp();
  if (!host || !providerId || !modelId) return;
  let provider = null;
  try {
    if (typeof host.findModelProviderById === 'function') {
      provider = host.findModelProviderById(providerId);
    }
  } catch (error) {
    provider = null;
  }
  if (!provider) {
    provider = toArray(host?.modelProviders).find((item) => String(item?.id || '') === String(providerId || '')) || null;
  }
  if (!provider) return;

  provider.modelId = String(modelId || '').trim();
  const existingModels = toArray(provider.models).map((item) => getProviderOptionValue(host, item)).filter(Boolean);
  provider.models = [provider.modelId, ...existingModels.filter((item) => item !== provider.modelId)];

  if (typeof host.handleProviderDraftChange === 'function') {
    await host.handleProviderDraftChange(provider.id);
  }
  await selectChatProvider(provider.id);
}

async function validateChatProvider(providerId) {
  const host = getHostApp();
  if (!host || !providerId) return;
  let provider = null;
  try {
    if (typeof host.findModelProviderById === 'function') {
      provider = host.findModelProviderById(providerId);
    }
  } catch (error) {
    provider = null;
  }
  if (!provider) {
    provider = toArray(host?.modelProviders).find((item) => String(item?.id || '') === String(providerId || '')) || null;
  }
  if (!provider || typeof host.validateProviderCard !== 'function') return;
  await host.validateProviderCard(provider, { shouldNotify: true });
}

async function browseAllFiles() {
  const host = getHostApp();
  if (!host || typeof host.browseAllFiles !== 'function') return;
  await host.browseAllFiles();
}

async function browseImages() {
  const host = getHostApp();
  if (!host || typeof host.browseImages !== 'function') return;
  await host.browseImages();
}

async function toggleInterpreter() {
  const host = getHostApp();
  if (!host) return;
  if (!host.codeSettings) host.codeSettings = { enabled: false };
  host.codeSettings.enabled = !host.codeSettings.enabled;
  if (typeof host.handleInterpreterToggle === 'function') {
    await host.handleInterpreterToggle(host.codeSettings.enabled);
  } else if (typeof host.autoSaveSettings === 'function') {
    await host.autoSaveSettings();
  }
}

async function toggleAsr() {
  const host = getHostApp();
  if (!host) return;
  if (typeof host.toggleASR === 'function') {
    await host.toggleASR();
    return;
  }
  if (host.asrSettings) {
    host.asrSettings.enabled = !host.asrSettings.enabled;
    if (typeof host.autoSaveSettings === 'function') {
      await host.autoSaveSettings();
    }
  }
}

async function toggleMemory() {
  const host = getHostApp();
  if (!host) return;
  if (!host.memorySettings) {
    host.memorySettings = { is_memory: false };
  }
  host.memorySettings.is_memory = !host.memorySettings.is_memory;
  if (typeof host.autoSaveSettings === 'function') {
    await host.autoSaveSettings();
  }
}

async function setTemperature(value) {
  const host = getHostApp();
  if (!host) return;
  if (!host.settings) host.settings = {};
  const num = Number(value);
  host.settings.temperature = Number.isFinite(num) ? Math.max(0, Math.min(2, num)) : 0.7;
  if (typeof host.autoSaveSettings === 'function') {
    await host.autoSaveSettings();
  }
}

async function setMaxTokens(value) {
  const host = getHostApp();
  if (!host) return;
  if (!host.settings) host.settings = {};
  const num = Number(value);
  host.settings.max_tokens = Number.isFinite(num) && num > 0 ? Math.floor(num) : 8192;
  if (typeof host.autoSaveSettings === 'function') {
    await host.autoSaveSettings();
  }
}

async function setSystemPrompt(value) {
  const host = getHostApp();
  if (!host) return;
  const next = String(value || '');
  host.system_prompt = next;
  if (Array.isArray(host.messages) && host.messages.length > 0 && host.messages[0]?.role === 'system') {
    host.messages[0].content = next;
  }
  if (typeof host.autoSaveSettings === 'function') {
    await host.autoSaveSettings();
  }
}

async function toggleWebSearch() {
  const host = getHostApp();
  if (!host) return;
  if (!host.webSearchSettings) host.webSearchSettings = { enabled: false };
  host.webSearchSettings.enabled = !host.webSearchSettings.enabled;
  if (typeof host.handleWebSearchToggle === 'function') {
    await host.handleWebSearchToggle(host.webSearchSettings.enabled);
    return;
  }
  if (typeof host.autoSaveSettings === 'function') {
    await host.autoSaveSettings();
  }
}

async function toggleBrowserControl() {
  const host = getHostApp();
  if (!host) return;
  if (!host.chromeMCPSettings) host.chromeMCPSettings = { enabled: false };
  host.chromeMCPSettings.enabled = !host.chromeMCPSettings.enabled;
  if (typeof host.changeChromeMCPEnabled === 'function') {
    await host.changeChromeMCPEnabled();
    return;
  }
  if (typeof host.autoSaveSettings === 'function') {
    await host.autoSaveSettings();
  }
}

async function toggleTts() {
  const host = getHostApp();
  if (!host) return;
  if (!host.ttsSettings) host.ttsSettings = { enabled: false };
  host.ttsSettings.enabled = !host.ttsSettings.enabled;
  if (typeof host.changeTTSstatus === 'function') {
    await host.changeTTSstatus();
    return;
  }
  if (typeof host.autoSaveSettings === 'function') {
    await host.autoSaveSettings();
  }
}

async function toggleDesktopVision() {
  const host = getHostApp();
  if (!host) return;
  if (!host.visionSettings) host.visionSettings = { desktopVision: false };
  host.visionSettings.desktopVision = !host.visionSettings.desktopVision;
  if (typeof host.autoSaveSettings === 'function') {
    await host.autoSaveSettings();
  }
}

async function triggerScreenshot() {
  const host = getHostApp();
  if (!host || typeof host.toggleScreenshot !== 'function') return;
  await host.toggleScreenshot(false);
}

async function openTablePet() {
  const host = getHostApp();
  if (!host || typeof host.startVRM !== 'function') return;
  await host.startVRM();
}

function openRoleCardPanel() {
  const host = getHostApp();
  if (!host) return;
  if (typeof host.openChatRoleCardPanel === 'function') {
    host.openChatRoleCardPanel();
    return;
  }
  host.activeMenu = 'role';
  host.subMenu = 'memory';
  host.activeMemoryTab = 'config';
  if (typeof host.ensurePrototypeRoleSelection === 'function') {
    host.ensurePrototypeRoleSelection();
  }
}

async function persistRoleCardSelection(host) {
  if (!host) return;
  if (typeof host.changeMemory === 'function') {
    await host.changeMemory();
    return;
  }
  if (typeof host.autoSaveSettings === 'function') {
    await host.autoSaveSettings();
  }
}

async function selectRoleCard(id) {
  const host = getHostApp();
  if (!host) return false;
  const memoryId = String(id || '').trim();
  const memory = toArray(host.memories).find((item) => String(item?.id || '') === memoryId);
  if (!memory) {
    openRoleCardPanel();
    return false;
  }
  if (!host.memorySettings) {
    host.memorySettings = { selectedMemory: null, is_memory: false };
  }
  host.memorySettings.selectedMemory = memory.id;
  host.memorySettings.is_memory = true;
  if (typeof host.selectRoleMemory === 'function') {
    host.selectRoleMemory(memory, { persist: false });
  }
  await persistRoleCardSelection(host);
  return true;
}

async function disableRoleCard() {
  const host = getHostApp();
  if (!host) return false;
  if (!host.memorySettings) {
    host.memorySettings = { selectedMemory: null, is_memory: false };
  }
  host.memorySettings.is_memory = false;
  await persistRoleCardSelection(host);
  return true;
}

async function loadConversation(id) {
  const host = getHostApp();
  if (!host || typeof host.loadConversation !== 'function') return;
  await host.loadConversation(id);
}

async function deleteConversation(id) {
  const host = getHostApp();
  if (!host || typeof host.confirmDeleteConversation !== 'function') return;
  await host.confirmDeleteConversation(id);
}

function setHistoryQuery(value) {
  const host = getHostApp();
  if (!host) return;
  host.prototypeChatHistoryQuery = String(value || '');
}

async function addProject() {
  const host = getHostApp();
  if (!host) return false;
  const beforePath = normalizeWorkspacePath(host.CLISettings?.cc_path);
  let selectedPath = '';
  if (typeof host.handlePrototypeProjectEntry === 'function') {
    const result = await host.handlePrototypeProjectEntry();
    selectedPath = normalizeWorkspacePath(result);
  } else if (typeof host.browseDirectory === 'function') {
    const result = await host.browseDirectory();
    selectedPath = normalizeWorkspacePath(result);
  }
  const afterPath = normalizeWorkspacePath(host.CLISettings?.cc_path);
  if (!selectedPath && afterPath && getWorkspaceKey(afterPath) !== getWorkspaceKey(beforePath)) {
    selectedPath = afterPath;
  }
  if (!selectedPath) return false;
  activateCliWorkspace(host, selectedPath);
  rememberWorkspaceProject(host, selectedPath);
  await startNewChat();
  await saveHostSettings(host);
  return true;
}

async function selectProject(project) {
  const host = getHostApp();
  const path = normalizeWorkspacePath(project?.path || project);
  if (!host || !path) return false;
  activateCliWorkspace(host, path);
  rememberWorkspaceProject(host, path);
  await startNewChat();
  await saveHostSettings(host);
  return true;
}

function handlePaste(event) {
  // 直接复用宿主的 handleInputPaste：图片走 addFiles('image')，长文本会自动转为 .txt 附件
  const host = getHostApp();
  if (!host || typeof host.handleInputPaste !== 'function') return;
  try {
    host.handleInputPaste(event);
  } catch (error) {
    console.warn('[chat-vite] handleInputPaste failed:', error);
  }
}

function removeAttachment(item) {
  // item: { kind: 'file' | 'image', index }
  // 宿主 removeItem 把 image 的 index 视作 (files.length + image_index)，
  // 这里按它的口径换算。
  const host = getHostApp();
  if (!host || !item || typeof host.removeItem !== 'function') return;
  if (item.kind === 'file') {
    host.removeItem(item.index, 'file');
  } else if (item.kind === 'image') {
    const filesLen = Array.isArray(host.files) ? host.files.length : 0;
    host.removeItem(filesLen + item.index, 'image');
  }
}

async function setPermissionMode(mode) {
  const host = getHostApp();
  if (!host) return false;
  const next = String(mode || 'default').trim() || 'default';
  if (!host.CLISettings) host.CLISettings = {};
  if (host.CLISettings.cc_path) {
    host.CLISettings.enabled = true;
  }
  host.CLISettings.permissionMode = next;
  if (typeof host.setActiveCliPermissionMode === 'function') {
    await Promise.resolve(host.setActiveCliPermissionMode(next));
  } else {
    const engine = String(host.CLISettings.engine || 'local').trim().toLowerCase();
    const map = {
      ds: 'dsSettings',
      cc: 'ccSettings',
      oc: 'ocSettings',
      qc: 'qcSettings',
      local: 'localEnvSettings',
    };
    const key = map[engine] || 'localEnvSettings';
    if (!host[key]) host[key] = {};
    host[key].permissionMode = next;
  }
  await saveHostSettings(host);
  return true;
}

async function renameConversation(id, newTitle) {
  const host = getHostApp();
  if (!host || !id) return false;
  const title = String(newTitle || '').trim();
  if (!title) return false;
  if (typeof host.renameConversationById === 'function') {
    await host.renameConversationById(id, title);
    return true;
  }
  if (typeof host.renameConversation === 'function') {
    await host.renameConversation(id, title);
    return true;
  }
  // 兜底：直接改 conversations 数组
  const list = Array.isArray(host.conversations) ? host.conversations : [];
  const item = list.find((c) => String(c?.id || '') === String(id));
  if (item) {
    item.title = title;
    if (typeof host.persistConversations === 'function') {
      try { await host.persistConversations(); } catch (e) { /* ignore */ }
    }
    return true;
  }
  return false;
}

async function archiveConversation(id) {
  const host = getHostApp();
  if (!host || !id) return false;
  if (typeof host.archiveConversationToMemory === 'function') {
    await host.archiveConversationToMemory(id);
    return true;
  }
  if (typeof host.archiveConversation === 'function') {
    await host.archiveConversation(id);
    return true;
  }
  // 兜底：把 archived 标记加上
  const list = Array.isArray(host.conversations) ? host.conversations : [];
  const item = list.find((c) => String(c?.id || '') === String(id));
  if (item) {
    item.archived = true;
    item.archivedAt = new Date().toISOString();
    if (typeof host.showNotification === 'function') {
      host.showNotification('对话已归档为永久记忆', 'success');
    }
    return true;
  }
  return false;
}

async function copyConversationId(id) {
  if (!id) return false;
  try {
    await navigator.clipboard.writeText(String(id));
    return true;
  } catch (error) {
    return false;
  }
}

function setGitBranch(branch) {
  const host = getHostApp();
  if (!host || !branch) return;
  if (typeof host.switchGitBranch === 'function') {
    host.switchGitBranch(branch);
    return;
  }
  if (host.gitInfo) {
    host.gitInfo.branch = branch;
    host.gitInfo.currentBranch = branch;
  }
}

function openSubscriptionCenter() {
  const host = getHostApp();
  if (!host) return;
  if (typeof host.openUnlockDialog === 'function') {
    host.openUnlockDialog();
  } else {
    host.showUnlockDialog = true;
  }
}

async function refreshCredits() {
  const host = getHostApp();
  if (!host) return false;
  const tasks = [];
  if (typeof host.refreshCurrentAccessProfile === 'function') {
    tasks.push(Promise.resolve(host.refreshCurrentAccessProfile({ silent: true })).catch(() => false));
  }
  if (typeof host.refreshSubscriptionAccountState === 'function') {
    tasks.push(Promise.resolve(host.refreshSubscriptionAccountState({ silent: true })).catch(() => false));
  }
  if (!tasks.length) return false;
  await Promise.all(tasks);
  return true;
}

export function createChatBridge() {
  return {
    snapshot: getSnapshot,
    sendMessage,
    startNewChat,
    openHistory,
    openModelPicker,
    selectChatProvider,
    selectChatProviderModel,
    validateChatProvider,
    browseAllFiles,
    browseImages,
    toggleInterpreter,
    toggleAsr,
    toggleMemory,
    toggleWebSearch,
    toggleBrowserControl,
    toggleTts,
    toggleDesktopVision,
    triggerScreenshot,
    openTablePet,
    openRoleCardPanel,
    selectRoleCard,
    disableRoleCard,
    setTemperature,
    setMaxTokens,
    setSystemPrompt,
    loadConversation,
    deleteConversation,
    setHistoryQuery,
    addProject,
    selectProject,
    handlePaste,
    removeAttachment,
    setPermissionMode,
    openSubscriptionCenter,
    refreshCredits,
    renameConversation,
    archiveConversation,
    copyConversationId,
    setGitBranch,
  };
}
