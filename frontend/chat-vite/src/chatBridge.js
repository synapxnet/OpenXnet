import '../../../static/js/openxnet-conversation-model.js';

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

/** 使用共用模型展示真实活动；project authoritative activity through the shared model. */
function buildActivityState(host, message, isLatest, isZh) {
  return globalThis.OpenXnetConversationModel.projectMessageActivity(message, {
    isZh, active: !!host?.isTyping && isLatest && !message?.generationFinished,
  });
}

/** 仅使用消息自带身份，历史消息不追随当前角色；use message-owned identity without relabeling history. */
function getMessageIdentity(message, role) {
  return globalThis.OpenXnetConversationModel.normalizeIdentity(message?.identity, {
    fallbackName: String(message?.agentName || (role === 'user' ? 'User' : 'Assistant')),
    fallbackKind: role,
  });
}

/** 映射已经发送的附件，不使用输入框草稿；map sent attachments independently of composer drafts. */
function getSentAttachments(message) {
  return [...toArray(message?.fileLinks).map((item) => ({ ...item, kind: 'file' })),
    ...toArray(message?.imageLinks).map((item) => ({ ...item, kind: 'image' }))]
    .map((item, index) => ({
      id: String(item.artifact_id || item.id || `attachment-${index}`),
      name: String(item.name || item.originalName || 'Attachment'), kind: item.kind,
      path: globalThis.OpenXnetConversationModel.normalizeIdentity({ image: String(item.path || '') }).image,
    }));
}

/** 提取可见助手正文，排除嵌套工具块和隐藏推理；extract visible assistant text without nested tool blocks or hidden reasoning. */
function getAssistantVisibleText(value) {
  const raw = String(value || '');
  const tokens = /```[^\n]*\n[\s\S]*?(?:```|$)|~~~[^\n]*\n[\s\S]*?(?:~~~|$)|`[^`\n]+`|<!--[\s\S]*?(?:-->|$)|<\/?[a-z][a-z0-9-]*(?=[\s/>])(?:[^>"']|"[^"]*"|'[^']*')*>/gi;
  const stack = [];
  let hiddenCount = 0;
  let offset = 0;
  let result = '';
  for (const match of raw.matchAll(tokens)) {
    if (!hiddenCount) result += raw.slice(offset, match.index);
    const token = match[0];
    offset = match.index + token.length;
    if (!token.startsWith('<')) {
      if (!hiddenCount) result += token;
      continue;
    }
    if (token.startsWith('<!--')) continue;
    const tag = /^<\/?([a-z][a-z0-9-]*)/i.exec(token)?.[1]?.toLowerCase() || '';
    if (token.startsWith('</')) {
      const index = stack.map((entry) => entry.tag).lastIndexOf(tag);
      if (index >= 0) {
        for (const entry of stack.splice(index)) if (entry.hidden) hiddenCount -= 1;
      }
      if (!hiddenCount && /^(?:p|div|li|pre|h[1-6]|blockquote|tr)$/.test(tag)) result += '\n';
      continue;
    }
    const className = /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(token);
    const classes = String(className?.[1] || className?.[2] || className?.[3] || '').split(/\s+/);
    const hidden = /^(?:think|thought|analysis|reasoning|script|style|template)$/.test(tag)
      || classes.some((name) => /^(?:highlight-block(?:-[\w-]+)?|approval-card)$/.test(name))
      || /\shidden(?:\s|=|\/?>)/i.test(token)
      || /\baria-hidden\s*=\s*["']?true(?:["'\s>])/i.test(token)
      || /\bstyle\s*=\s*["'][^"']*(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(token);
    const selfClosing = /\/\s*>$/.test(token) || /^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/.test(tag);
    if (!hiddenCount && !hidden && /^(?:br|hr)$/.test(tag)) result += '\n';
    if (!selfClosing) {
      stack.push({ tag, hidden });
      if (hidden) hiddenCount += 1;
    }
  }
  if (!hiddenCount) result += raw.slice(offset);
  /** 只解码文本实体，不再次解析成 HTML；decode text entities without reparsing executable HTML. */
  const decodeEntity = (entity, code) => {
    const normalized = code.toLowerCase();
    const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
    if (Object.prototype.hasOwnProperty.call(named, normalized)) return named[normalized];
    const number = normalized.startsWith('#x') ? parseInt(normalized.slice(2), 16) : parseInt(normalized.slice(1), 10);
    return Number.isInteger(number) && number > 0 && number <= 0x10ffff && !(number >= 0xd800 && number <= 0xdfff)
      ? String.fromCodePoint(number) : entity;
  };
  return result.replace(/&(amp|lt|gt|quot|apos|nbsp|#\d+|#x[0-9a-f]+);/gi, decodeEntity)
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** 保留消息原索引、身份、回执和附件；retain original indices, identity, receipts, and sent attachments. */
function normalizeLiveMessages(host) {
  const filtered = (host?.messages || []).map((message, sourceIndex) => ({ message, sourceIndex }))
    .filter(({ message }) => message?.role !== 'system');
  const isZh = isCurrentLanguageZh(host);
  return filtered.map(({ message, sourceIndex }, index) => {
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
      sourceIndex,
      conversationId: String(message?.conversationId || host?.conversationId || ''),
      identity: getMessageIdentity(message, role),
      attachments: getSentAttachments(message),
      memoryContext: globalThis.OpenXnetConversationModel.normalizeMemoryContext(toArray(message?.memoryContext)
        .filter((receipt) => String(receipt?.conversationId || '') === String(message?.conversationId || host?.conversationId || ''))),
      text: role === 'user' ? stripHtml(content) : getAssistantVisibleText(content),
      html: role === 'assistant'
        ? formatAssistantHtml(host, renderContent, sourceIndex, messageKey, renderStateKey)
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

/** 展示角色记忆与原生记忆各自配置；expose role and native memory controls independently. */
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
      nativeMemoryEnabled: true,
      nativeMemoryAvailable: false,
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
    nativeMemoryEnabled: memorySettings.synapxnetV3Enabled !== false,
    nativeMemoryAvailable: typeof host.autoSaveSettings === 'function',
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
    completionNotificationsEnabled: host.systemSettings?.completionNotificationsEnabled !== false,
    completionNotificationSound: host.systemSettings?.completionNotificationSound === true,
    completionPreferencesAvailable: typeof window.electronAPI?.saveSystemSettings === 'function' && typeof window.openxnetDesktop?.publishCompletionNotice === 'function',
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
      canSwitch: typeof host?.switchGitBranch === 'function',
      branch: String(gitInfo.branch || gitInfo.currentBranch || 'main'),
      branches: Array.isArray(gitInfo.branches) ? gitInfo.branches : [],
      dirty: !!gitInfo.dirty,
      ahead: Number(gitInfo.ahead || 0),
      behind: Number(gitInfo.behind || 0),
    } : { enabled: false },
  };
}

const pendingPermissionChanges = new WeakMap();
const uncertainPermissionScopes = new WeakMap();

/** 读取当前引擎及其真实权限字段。 / Read the current engine and its actual permission settings field. */
function permissionEngine(host) {
  const engine = String(host?.CLISettings?.engine || 'local').trim().toLowerCase();
  const keys = { ds: 'dsSettings', cc: 'ccSettings', oc: 'ocSettings', qc: 'qcSettings', local: 'localEnvSettings' };
  return { id: engine, key: keys[engine] || 'localEnvSettings' };
}

/** 将保存与失败确认绑定到原引擎和工作区。 / Bind saves and uncertain outcomes to their original engine and workspace. */
function permissionScopeKey(host) {
  return JSON.stringify([permissionEngine(host).id, getWorkspaceKey(host?.CLISettings?.cc_path)]);
}

/** 保留未确认状态，让用户能重新保存当前模式。 / Retain uncertainty so the current mode can be explicitly saved again. */
function markPermissionUncertain(host, scope, uncertain) {
  let scopes = uncertainPermissionScopes.get(host);
  if (!scopes) { scopes = new Set(); uncertainPermissionScopes.set(host, scopes); }
  if (uncertain) scopes.add(scope); else scopes.delete(scope);
}

/** 使用现有引擎的模式值补全没有提供选项的宿主。 / Use existing engine mode values when the host does not provide options. */
function permissionOptions(host, isZh) {
  const hostOptions = getHostPermissionOptions(host);
  if (hostOptions.length) return hostOptions;
  const engine = permissionEngine(host).id;
  return [
    { value: 'default', label: isZh ? '默认只读模式' : 'Default read-only mode' },
    { value: 'plan', label: isZh ? '计划模式' : 'Plan' },
    { value: ['cc', 'oc'].includes(engine) ? 'acceptEdits' : engine === 'qc' ? 'auto-edit' : 'auto-approve', label: isZh ? '接受编辑模式' : 'Accept edit mode' },
    { value: ['cc', 'oc'].includes(engine) ? 'bypassPermissions' : 'yolo', label: isZh ? '最高权限模式' : 'All permissions mode' },
    { value: 'cowork', label: isZh ? 'Cowork 模式' : 'Cowork mode' },
  ];
}

/** 展示已确认的权限与适用范围，不依赖工作区是否打开。 / Show confirmed permissions and their scope independently of workspace loading. */
function buildPermissionState(host, isZh) {
  const pending = host ? pendingPermissionChanges.get(host) : null;
  const engine = permissionEngine(host).id;
  const scope = permissionScopeKey(host);
  const current = pending?.scope === scope ? pending.previousMode : getActivePermissionMode(host);
  const uncertain = !!host && !!uncertainPermissionScopes.get(host)?.has(scope);
  const available = !!host && typeof host.autoSaveSettings === 'function';
  const options = permissionOptions(host, isZh).sort(sortPermissionOptions).map((item) => decoratePermissionOption(item, isZh, engine));
  if (current && !options.some((item) => item.id === current)) {
    options.unshift({ ...decoratePermissionOption({ value: current, label: getPermissionModeLabel(host, current, isZh) }, isZh, engine), disabled: true });
  }
  const engineName = ({ local: isZh ? '本地环境' : 'Local', ds: isZh ? 'Docker 沙箱' : 'Docker Sandbox', cc: 'Claude Code', oc: 'Codex', qc: 'Qwen Code' })[engine] || engine;
  let scopeHint = !available
    ? (isZh ? '当前仅显示已保存模式，权限设置暂不可保存。' : 'Showing the saved mode; permission settings cannot currently be saved.')
    : isZh
      ? `适用于${engineName}的受控工具；${host.CLISettings?.enabled ? '代码智能已开启。' : '保存不会自动开启代码智能。'}`
      : `Applies to governed tools in ${engineName}; ${host.CLISettings?.enabled ? 'code intelligence is enabled.' : 'saving does not enable code intelligence.'}`;
  if (uncertain) scopeHint += isZh ? ' 上次保存结果尚未确认，请重新选择当前模式保存。' : ' The last save is unconfirmed. Select the current mode again to save it.';
  return { current, options, available, pending: !!pending, engine, scopeHint, uncertain };
}

/** 保持已有权限模式的显示顺序。 / Retain the established permission mode ordering. */
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

/** 只读取宿主显式提供的权限选项。 / Read only permission options explicitly provided by the host. */
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

/** 优先使用宿主模式名称，保留未知模式原值。 / Prefer host mode names and preserve unknown mode values. */
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

/** 读取真正活动引擎的已配置权限。 / Read configured permissions from the actual active engine. */
function getActivePermissionMode(host) {
  try {
    if (host && typeof host.getActiveCliPermissionMode === 'function') {
      return String(host.getActiveCliPermissionMode() || 'default').trim() || 'default';
    }
  } catch (error) {
    // noop
  }
  return String(host?.[permissionEngine(host).key]?.permissionMode || host?.CLISettings?.permissionMode || 'default').trim() || 'default';
}

/** 用真实引擎语义说明模式，不扩大它的适用范围。 / Describe modes using actual engine semantics without expanding their scope. */
function decoratePermissionOption(item, isZh, engine = 'local') {
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
    plan: isZh ? '先规划和审阅方案，代码工具以只读能力为主' : 'Plan and review first; code tools primarily use read-only capabilities',
    default: isZh ? '只读工具可用，敏感操作按策略确认' : 'Read-only tools remain available; sensitive actions follow approval policy',
    accept: engine === 'oc'
      ? (isZh ? '自动执行工作区编辑与命令，保留沙箱边界' : 'Automate workspace edits and commands within sandbox boundaries')
      : (isZh ? '自动接受编辑类操作，其他敏感操作仍确认' : 'Auto-accept edits while retaining prompts for other sensitive actions'),
    bypass: isZh ? '直接放行当前引擎的工具操作，请审阅后选择' : 'Allow current-engine tool operations directly; review before selecting',
    cowork: isZh ? '多智能体协作，并使用当前引擎的直接放行权限' : 'Multi-agent collaboration with the current engine’s direct tool permissions',
  };
  return {
    id,
    label: String(item?.label || id).trim(),
    icon: iconMap[normalized] || 'fa-solid fa-shield-halved',
    desc: descMap[normalized] || (isZh ? '当前引擎提供的权限模式' : 'Permission mode from current engine'),
  };
}

/** 区分服务用量与字符估算，未知上限保持未知；separate provider usage from estimates and preserve unknown limits. */
function buildContextWindowState(host, isZh) {
  const settings = host?.settings || {};
  const configured = Number(settings.max_input_tokens || settings.context_window || settings.contextLimit || 0);
  const limit = Number.isFinite(configured) && configured > 0 ? configured : null;
  const messages = toArray(host?.messages);
  const latest = messages[messages.length - 1];
  const measured = latest?.contextUsage;
  const actual = measured?.actual === true && measured?.source === 'provider' && Number.isFinite(measured.promptTokens) && measured.promptTokens >= 0;
  const used = actual ? measured.promptTokens : Math.round(messages.reduce((sum, item) => sum + String(item?.pure_content || item?.content || '').length, 0) / 1.8);
  const ratio = limit ? Math.min(1, used / limit) : 0;
  const qualifier = actual ? (isZh ? '上次请求实际输入' : 'Last request input') : (isZh ? '估算' : 'Estimated');
  return {
    used, limit, ratio, percent: limit ? Math.round(ratio * 100) : null,
    actual, estimated: !actual, source: actual ? 'provider' : 'characters',
    warn: !!limit && ratio >= 0.85, critical: !!limit && ratio >= 0.92,
    label: `${qualifier} ${formatTokens(used)} / ${limit ? formatTokens(limit) : (isZh ? '上限未知' : 'unknown limit')}`,
    summary: isZh ? (actual ? '服务返回的输入 token 数' : '按消息字符估算，包含工具结果时可能偏差较大') : (actual ? 'Input tokens reported by the provider' : 'Estimated from message characters; tool output may affect accuracy'),
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
    automations: getConversationAutomations(host),
    recovery: typeof host?.getConversationRecoveryState === 'function' ? host.getConversationRecoveryState() : { available: false, pending: false, error: '', reason: '' },
    guidance: typeof host?.getLiveGuidanceState === 'function' ? host.getLiveGuidanceState() : { available: false, items: [], error: '', notice: '', loading: false, sending: false },
    connection: getConversationConnectionState(host),
  };
}

/** 连接提示仅保留公开短文本，去除凭据、隐藏区和URL查询参数。 / Keep only short public connection text without credentials, hidden sections or URL query parameters. */
function connectionPublicText(value, maximum = 1000) {
  if (typeof value !== 'string') return '';
  return getAssistantVisibleText(value)
    .replace(/\bhttps?:\/\/[^\s<>"']+/gi, /** 去除URL中的认证和查询。 / Remove URL authentication and query data. */ (url) => url.split(/[?#]/)[0].replace(/\/\/[^/@]+@/, '//'))
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/(["']?(?:api[_-]?key|access[_-]?token|refresh[_-]?token|token|password|passwd|secret|authorization)["']?\s*[:=]\s*)(?:["'][^"'\r\n]*["']|[^\s,;\r\n}]+)/gi, '$1[redacted]')
    .replace(/\b(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9_]{16,})\b/g, '[redacted]')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, maximum);
}

/** 投影当前请求的有限连接状态，不从设备在线信号推断服务健康。 / Project bounded connection state for the current request without inferring service health from device connectivity. */
function getConversationConnectionState(host) {
  const idle = { state: 'idle', conversationId: String(host?.conversationId || ''), requestId: '', messageId: '', attempt: 0, maxAttempts: 5, message: '', detail: '', canCheck: false, canContinue: false };
  if (typeof host?.getConversationConnectionState !== 'function') return idle;
  const state = host.getConversationConnectionState();
  if (!state || String(state.conversationId || '') !== idle.conversationId || !['idle', 'offline', 'interrupted', 'checking', 'reachable', 'failed'].includes(state.state)
    || (state.workspacePath !== undefined && getWorkspaceKey(state.workspacePath) !== getWorkspaceKey(host.CLISettings?.cc_path))) return idle;
  const maxAttempts = Number.isInteger(state.maxAttempts) && state.maxAttempts >= 1 && state.maxAttempts <= 5 ? state.maxAttempts : 5;
  const recovery = host.getConversationRecoveryState?.();
  const messageId = typeof state.messageId === 'string' ? state.messageId : recovery?.requestId === state.requestId ? String(recovery.messageId || '') : '';
  return { state: state.state, conversationId: idle.conversationId, requestId: typeof state.requestId === 'string' ? state.requestId : '',
    messageId: (host.messages || []).some(/** 锚点必须属于当前助手回复。 / The anchor must belong to the current assistant reply. */ (message) => message.role === 'assistant' && String(message.id) === messageId && (!message.conversationId || String(message.conversationId) === idle.conversationId)) ? messageId : '',
    workspacePath: String(host.CLISettings?.cc_path || ''),
    kind: ['offline', 'http', 'timeout', 'stream', 'transport', 'auth', 'quota', 'application'].includes(state.kind) ? state.kind : '',
    httpStatus: Number.isInteger(state.httpStatus) && state.httpStatus >= 100 && state.httpStatus <= 599 ? state.httpStatus : null,
    attempt: Number.isInteger(state.attempt) && state.attempt >= 0 && state.attempt <= maxAttempts ? state.attempt : 0, maxAttempts,
    message: connectionPublicText(state.message, 400), detail: connectionPublicText(state.detail, 1600),
    canCheck: state.canCheck === true && typeof host.checkConversationConnection === 'function' && state.state !== 'checking',
    canContinue: state.canContinue === true && recovery?.available === true && recovery?.pending !== true && recovery.requestId === state.requestId && recovery.conversationId === state.conversationId,
    continueReason: recovery?.requestId === state.requestId && recovery?.conversationId === state.conversationId ? connectionPublicText(recovery.reason, 400) : '',
    networkOnline: typeof state.networkOnline === 'boolean' ? state.networkOnline : null, checkedAt: Number.isFinite(state.checkedAt) ? state.checkedAt : null };
}

const connectionChecks = new WeakMap();
/** 显式检查原会话状态，只调用只读宿主入口并拒绝迟到跨范围结果。 / Explicitly check the original conversation through the read-only host entry and reject late cross-scope results. */
async function checkConversationConnection(reference) {
  const host = getHostApp(); const state = getConversationConnectionState(host);
  const scope = JSON.stringify([state.conversationId, state.requestId, getWorkspaceKey(host?.CLISettings?.cc_path)]);
  if (!host || !state.canCheck || reference?.conversationId !== state.conversationId || reference?.requestId !== state.requestId || getWorkspaceKey(reference?.workspacePath) !== getWorkspaceKey(host.CLISettings?.cc_path)) return false;
  let checks = connectionChecks.get(host); if (!checks) { checks = new Set(); connectionChecks.set(host, checks); }
  if (checks.has(scope)) return false;
  checks.add(scope);
  try {
    await host.checkConversationConnection(state.conversationId, state.requestId);
    const current = getConversationConnectionState(host);
    if (host !== getHostApp() || scope !== JSON.stringify([current.conversationId, current.requestId, getWorkspaceKey(host.CLISettings?.cc_path)])) return false;
    return current;
  } catch (error) { throw new Error(isCurrentLanguageZh(host) ? '状态检查未完成，请稍后重试。' : 'The state check did not complete. Please retry.'); }
  finally { checks.delete(scope); }
}

/** 只返回宿主实际接受状态；return only the host's actual acceptance result. */
async function sendMessage(text) {
  const host = getHostApp();
  if (!host || typeof host.handleSendOrGuidance !== 'function') return false;
  if (!host.isSending && !host.isTyping && (!host.mainAgent || host.mainAgent === 'openxnet-model') && !String(host.settings?.model || '').trim()) {
    throw new Error(isCurrentLanguageZh(host) ? '请先选择模型' : 'Select a model first');
  }
  host.userInput = String(text || '');
  return await host.handleSendOrGuidance() === true;
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

/** 独立保存原生记忆开关，失败回滚；persist the native memory flag independently and roll back on failure. */
async function toggleNativeMemory() {
  const host = getHostApp();
  if (!host || typeof host.autoSaveSettings !== 'function') return false;
  if (!host.memorySettings) host.memorySettings = {};
  const previous = host.memorySettings.synapxnetV3Enabled;
  const next = previous === false;
  host.memorySettings.synapxnetV3Enabled = next;
  try {
    await host.autoSaveSettings();
    return true;
  } catch (error) {
    if (host.memorySettings.synapxnetV3Enabled === next) host.memorySettings.synapxnetV3Enabled = previous;
    throw error;
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

/** 打开既有身份配置入口；open the existing identity configuration entry. */
function openIdentityConfig() {
  openRoleCardPanel();
}

/** 将选中文件绑定到当前稳定角色ID；bind a selected file to the currently selected stable role ID. */
async function importRoleAvatar(file) {
  const host = getHostApp();
  const id = String(host?.memorySettings?.selectedMemory || '').trim();
  if (!id || !toArray(host?.memories).some((item) => String(item?.id || '') === id)) throw new Error('请先选择有效角色 / Select a valid role first.');
  if (typeof host.importChatRoleAvatar !== 'function') throw new Error('头像存储不可用 / Avatar storage unavailable.');
  return host.importChatRoleAvatar(id, file);
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
  if (!host || !id || typeof host.confirmDeleteConversation !== 'function') return false;
  return await host.confirmDeleteConversation(id) === true;
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

/** 单独停止当前回复，不把草稿作为停止请求提交。 / Stop the current reply independently without submitting its draft. */
function stopResponse() {
  const host = getHostApp();
  if (!host || typeof host.stopGenerate !== 'function' || (!host.isSending && !host.isTyping)) return false;
  host.stopGenerate(); return true;
}

/** 在聊天内刷新已有引导队列，宿主统一限制频率与范围。 / Refresh guidance only inside chat, with host-controlled throttling and scope. */
async function refreshGuidance(force = false) {
  const host = getHostApp();
  if (!host || host.activeMenu !== 'chat' || !host.conversationId || typeof host.refreshLiveGuidanceStatus !== 'function') return false;
  return !!(await host.refreshLiveGuidanceStatus(true, force));
}

/** 卸载时释放宿主引导轮询，保留真实缓存与在途写入。 / Release guidance polling on unmount while preserving actual cache and in-flight writes. */
function suspendGuidanceRefresh() { getHostApp()?.stopLiveGuidancePolling?.(); }

/** 编辑或撤回只通过已有原子接口，不能改写另一会话。 / Edit or withdraw through the existing atomic API without changing another conversation. */
async function updateGuidance(reference, action, text) {
  const host = getHostApp();
  if (!host || typeof host.updateLiveGuidance !== 'function' || reference?.scope !== host.getLiveGuidanceState?.().scope) throw new Error('引导会话已变化或接口不可用 / Guidance conversation changed or its interface is unavailable.');
  return host.updateLiveGuidance(reference, action, text);
}

/** 明确恢复原会话，不借用发送入口覆盖草稿。 / Explicitly recover the original conversation without overwriting the draft through the send entry point. */
async function resumeConversationRecovery(reference) {
  const host = getHostApp();
  const state = host?.getConversationRecoveryState?.();
  if (!state?.available || state.pending || typeof host.resumeInterruptedConversation !== 'function'
    || reference?.conversationId !== state.conversationId || reference?.requestId !== state.requestId
    || getWorkspaceKey(reference?.workspacePath) !== getWorkspaceKey(host.CLISettings?.cc_path)) return false;
  return await host.resumeInterruptedConversation(state.conversationId, state.requestId) === true;
}

/** 只重试持久化，不触发新模型或工具执行。 / Retry persistence only, without starting a model or tool execution. */
async function retryConversationSave() {
  const host = getHostApp();
  if (typeof host?.retryConversationCheckpoint !== 'function') return false;
  return await host.retryConversationCheckpoint() === true;
}

const completionPreferenceSaves = new WeakSet();
/** 复用原生系统设置保存完成提醒，只在明确持久化确认后更新勾选状态。 / Save completion preferences through native system settings and update checkboxes only after confirmed persistence. */
async function setCompletionPreference(field, enabled) {
  const host = getHostApp();
  if (!host || !['completionNotificationsEnabled', 'completionNotificationSound'].includes(field) || typeof enabled !== 'boolean' || typeof window.electronAPI?.saveSystemSettings !== 'function') return false;
  if (completionPreferenceSaves.has(host)) throw new Error('完成提醒设置正在保存 / Completion preferences are being saved.');
  completionPreferenceSaves.add(host);
  try {
    const settings = { ...(host.systemSettings || {}), completionNotificationsEnabled: host.systemSettings?.completionNotificationsEnabled !== false, completionNotificationSound: host.systemSettings?.completionNotificationSound === true, [field]: enabled };
    const saved = await window.electronAPI.saveSystemSettings(settings);
    if (!saved?.settings || saved.settings[field] !== enabled) throw new Error('完成提醒设置未获保存确认 / Completion preference saving was not confirmed.');
    host.systemSettings = { ...(host.systemSettings || {}), [field]: enabled };
    return true;
  } finally { completionPreferenceSaves.delete(host); }
}

/** 将文件操作绑定到当前会话、步骤和已有回执。 / Bind file operations to the current conversation, step and existing receipt. */
function resolveConversationFile(reference) {
  const host = getHostApp();
  if (!host || !reference || String(reference.conversationId || '').trim() !== String(host.conversationId || '').trim()
    || getWorkspaceKey(reference.workspacePath) !== getWorkspaceKey(host.CLISettings?.cc_path)) throw new Error('文件所属会话或工作区已变化 / The file conversation or workspace has changed.');
  const message = normalizeLiveMessages(host).find((item) => item.id === reference.messageId);
  const step = message?.activity?.steps?.find((item) => item.id === reference.stepId);
  const file = step?.fileChanges?.find((item) => item.id === reference.fileId && item.path === reference.path);
  if (!file) throw new Error('此文件不属于所选步骤的回执 / This file is not part of the selected step receipt.');
  return { workspacePath: String(host.CLISettings?.cc_path || ''), path: file.path };
}

/** 读取绑定当前消息与子任务的真实会话记录。 / Read the actual transcript bound to the current message and child task. */
async function readSubagentTranscript(messageId, stepId) {
  const host = getHostApp();
  const conversationId = String(host?.conversationId || '').trim();
  const workspace = getWorkspaceKey(host?.CLISettings?.cc_path);
  /** 仅从当前会话已有步骤解析任务身份。 / Resolve task identity only from an existing step in the current conversation. */
  const resolve = () => {
    if (!host || host !== getHostApp() || conversationId !== String(host.conversationId || '').trim() || workspace !== getWorkspaceKey(host.CLISettings?.cc_path)) throw new Error('会话或工作区已变化 / Conversation or workspace changed.');
    const message = normalizeLiveMessages(host).find((item) => item.id === messageId && item.conversationId === conversationId);
    const step = message?.activity?.steps?.find((item) => item.id === stepId && item.kind === 'subagent');
    if (!step?.taskId) throw new Error('当前步骤没有可读取的子任务 / No readable child task is attached to this step.');
    return String(step.taskId);
  };
  const taskId = resolve();
  if (typeof window.electronAPI?.readConversationSubagentTranscript !== 'function') throw new Error('当前环境不能读取子任务会话 / Child transcripts are unavailable in this environment.');
  const result = await window.electronAPI.readConversationSubagentTranscript({ taskId, conversationId });
  if (resolve() !== taskId || String(result?.conversationId || '') !== conversationId) throw new Error('子任务会话范围已变化 / Child transcript scope changed.');
  return result?.transcript || null;
}

const automationCaches = new WeakMap();
/** 隔离会话与工作区内的自动任务缓存。 / Isolate automation caches by conversation and workspace. */
function automationScope(host) { return JSON.stringify([String(host?.conversationId || '').trim(), getWorkspaceKey(host?.CLISettings?.cc_path)]); }
/** 保留一个活动范围，旧范围的迟到读取不得合并。 / Keep one active scope so late reads cannot merge across scopes. */
function automationCache(host) {
  const scope = automationScope(host);
  let cache = automationCaches.get(host);
  if (!cache || cache.scope !== scope) { cache = { scope, tasks: [], receipts: [], mutations: new Set(), coveredRefs: new Set(), authoritative: false, loaded: false, pending: false, lastAttempt: 0, error: '', generation: 0 }; automationCaches.set(host, cache); }
  return cache;
}
/** 投影有明确归属的自动任务并保留真实运行历史。 / Project explicitly owned automation tasks and their actual run history. */
function normalizeAutomation(task, host) {
  const details = task?.details || {};
  const context = task?.context || details.context || {};
  const automation = task?.automation || context.automation;
  const origin = String(task?.originConversationId || context.origin_conversation_id || '').trim();
  const workspace = task?.workspacePath || task?.workspace_dir || context.workspace_dir || '';
  if (!automation || !origin || origin !== String(host?.conversationId || '').trim() || (workspace && getWorkspaceKey(workspace) !== getWorkspaceKey(host?.CLISettings?.cc_path))) return null;
  const id = String(task?.id || task?.core_task_id || task?.task_id || task?.taskId || '').trim();
  if (!id) return null;
  const legacyId = String(task?.legacyTaskId || task?.legacy_task_id || task?.taskId || task?.task_id || id);
  return { id, legacyId, originConversationId: origin, scope: automationScope(host),
    title: String(task.title || details.title || ''), description: String(task.description || details.description || ''),
    state: String(automation.state || 'unknown'), status: String(task.status || details.status || 'unknown'),
    scheduleType: String(task.scheduleType || task.schedule_type || details.schedule_type || ''),
    scheduleExpression: String(task.scheduleExpression || task.schedule_expression || details.schedule_expression || ''),
    nextRunAt: String(task.nextRunAt || task.next_run_at || details.next_run_at || ''),
    updatedAt: String(task.updatedAt || task.updated_at || details.updated_at || ''),
    completionCondition: String(automation.completion_condition || ''), notificationPolicy: String(automation.notification_policy || 'changes_only'),
    runs: toArray(automation.runs).slice(-50).map((run) => ({ id: String(run.id || ''), outcome: String(run.outcome || 'unknown'), summary: String(run.summary || ''), evidence: toArray(run.evidence).map((value) => typeof value === 'string' ? value : JSON.stringify(value)), finishedAt: String(run.finished_at || ''), notify: run.notify === true, truncated: run.truncated === true })) };
}
/** 只读取已有数据，不在高频快照中访问任务接口。 / Read existing data without making task requests during high-frequency snapshots. */
function getConversationAutomations(host) {
  if (!host || host.activeMenu !== 'chat' || !host.conversationId) return { tasks: [], error: '', loading: false, canManage: false };
  const cache = automationCache(host);
  const refs = toArray(host.messages).filter((message) => !message.conversationId || String(message.conversationId) === String(host.conversationId)).flatMap((message) => toArray(message.taskRefs));
  const tasks = [];
  // 只合并读取后新收到的回执，已删除任务不能被旧创建回执复活。 / Merge only receipts received after the last read so old creation receipts cannot resurrect deleted tasks.
  for (const raw of [...(cache.authoritative ? [] : toArray(host.taskList)), ...cache.tasks, ...refs.filter((ref) => !cache.coveredRefs.has(JSON.stringify(ref))), ...cache.receipts]) {
    const task = normalizeAutomation(raw, host);
    if (!task) continue;
    const index = tasks.findIndex((item) => item.id === task.id || item.legacyId === task.legacyId || item.id === task.legacyId || item.legacyId === task.id);
    if (index < 0) tasks.push(task); else tasks[index] = { ...tasks[index], ...task, id: tasks[index].id !== tasks[index].legacyId && task.id === task.legacyId ? tasks[index].id : task.id };
  }
  return { tasks: tasks.map((task) => ({ ...task, mutationPending: cache.mutations.has(task.legacyId) })), error: cache.error, loading: cache.pending, canManage: typeof window.openxnetChatFetch === 'function', canOpenCenter: typeof host.openTaskCenter === 'function' };
}
/** 离开聊天或卸载时使未完成的任务读取失效。 / Invalidate unfinished task reads when leaving chat or unmounting. */
function suspendAutomationRefresh() {
  const host = getHostApp();
  const cache = host && automationCaches.get(host);
  if (cache) { cache.generation += 1; cache.pending = false; cache.loaded = false; }
}
/** 仅在聊天内以五秒间隔刷新真实任务，拒绝迟到结果。 / Refresh actual tasks only in chat at five-second intervals and reject stale results. */
async function refreshAutomations({ open = false, force = false } = {}) {
  const host = getHostApp();
  if (!host || host.activeMenu !== 'chat' || !host.conversationId) { suspendAutomationRefresh(); return false; }
  const cache = automationCache(host);
  const now = Date.now();
  if (cache.pending || (!force && cache.loaded && ((!open && !getConversationAutomations(host).tasks.length) || now - cache.lastAttempt < 5000))) return false;
  cache.pending = true; cache.loaded = true; cache.lastAttempt = now;
  const generation = ++cache.generation;
  const readRefs = toArray(host.messages).flatMap((message) => toArray(message.taskRefs)).map((ref) => JSON.stringify(ref));
  /** 检查当前界面仍属于发起读取的范围。 / Verify the interface still owns the requesting scope. */
  const current = () => host === getHostApp() && host.activeMenu === 'chat' && automationCaches.get(host) === cache && automationScope(host) === cache.scope && cache.generation === generation;
  try {
    const desktop = window.openxnetDesktop;
    const workspacePath = String(host.CLISettings?.cc_path || '').trim();
    let result;
    if (typeof desktop?.listTasks === 'function') {
      result = await desktop.listTasks(workspacePath ? { workspacePath } : {});
      if (!current()) return false;
      if (Array.isArray(result?.tasks)) cache.tasks = result.tasks;
      if (workspacePath && typeof desktop.refreshTaskExecutions === 'function') result = await desktop.refreshTaskExecutions({ workspacePath });
    } else if (typeof window.openxnetChatFetch === 'function') {
      const response = await window.openxnetChatFetch('/v1/tasks/list');
      if (!response.ok) throw new Error(`任务读取失败 / Task read failed (${response.status}).`);
      result = await response.json();
    } else return false;
    if (!current()) return false;
    if (result?.error || !Array.isArray(result?.tasks)) throw new Error(String(result?.error || '任务返回格式无效 / Invalid task response.'));
    if (result.workspace_path && getWorkspaceKey(result.workspace_path) !== getWorkspaceKey(workspacePath)) throw new Error('任务工作区不匹配 / Task workspace mismatch.');
    cache.tasks = result.tasks; cache.receipts = []; cache.error = ''; cache.authoritative = true; cache.coveredRefs = new Set(readRefs);
    return true;
  } catch (error) { if (current()) cache.error = error?.message || '任务读取失败 / Task read failed.'; return false; }
  finally { if (current()) cache.pending = false; }
}
/** 从当前可见任务身份解析受控操作，不接受任意任务标识。 / Resolve controlled operations from visible tasks instead of accepting arbitrary task IDs. */
function resolveConversationAutomation(reference) {
  const host = getHostApp();
  if (!host || host.activeMenu !== 'chat' || !reference || reference.scope !== automationScope(host)) throw new Error('自动任务所属会话已变化 / Automation conversation changed.');
  const task = getConversationAutomations(host).tasks.find((item) => item.id === reference.id && item.legacyId === reference.legacyId);
  if (!task) throw new Error('当前会话没有此自动任务 / This automation does not belong to the current conversation.');
  return { host, task };
}
/** 通过既有受控工具暂停、恢复或结束任务，不乐观修改状态。 / Pause, resume or complete through the controlled tool without optimistic state changes. */
async function updateConversationAutomation(reference, action) {
  const { host, task } = resolveConversationAutomation(reference);
  if (!['pause', 'resume', 'complete'].includes(action) || typeof window.openxnetChatFetch !== 'function') throw new Error('自动任务操作不可用 / Automation action unavailable.');
  const cache = automationCache(host);
  if (cache.mutations.has(task.legacyId)) throw new Error('此自动任务正在确认操作 / This automation already has an action pending.');
  cache.mutations.add(task.legacyId);
  try {
    const response = await window.openxnetChatFetch('/execute_tool_manually', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tool_name: 'update_automation_task', tool_params: { task_id: task.legacyId, action }, conversationId: String(host.conversationId), approval_type: 'once' }) });
    const result = await response.json();
    resolveConversationAutomation(reference);
    if (['approval_required', 'awaiting_approval'].includes(result?.status) || ['approval_required', 'awaiting_approval'].includes(result?.type)) return { success: false, awaitingApproval: true };
    if (!response.ok || result?.success !== true || ['error', 'failed', 'rejected'].includes(result?.status)) throw new Error(typeof result?.result === 'string' ? result.result : String(result?.error || '自动任务操作失败 / Automation action failed.'));
    cache.generation += 1; cache.pending = false;
    const updated = normalizeAutomation(result.taskRef, host);
    if (updated) { cache.receipts = cache.receipts.filter((receipt) => normalizeAutomation(receipt, host)?.legacyId !== updated.legacyId); cache.receipts.push(result.taskRef); }
    // 读取下一次快照时保持刚收到的真实状态；后续正常刷新会重新核对。 / Retain the actual receipt in the next snapshot; normal refresh reconciles it later.
    cache.lastAttempt = Date.now();
    return { success: true };
  } finally { cache.mutations.delete(task.legacyId); }
}
/** 打开既有任务中心并定位实际任务。 / Open the existing task center at the actual task. */
async function openAutomationTaskCenter(reference) {
  const { host, task } = resolveConversationAutomation(reference);
  if (typeof host.openTaskCenter !== 'function') return false;
  host.openTaskCenter();
  suspendAutomationRefresh();
  if (typeof host.fetchTasks === 'function') await host.fetchTasks();
  if (automationScope(host) !== reference.scope) return false;
  if (typeof host.fetchTaskDetail === 'function') await host.fetchTaskDetail(task.id);
  return true;
}

const selectedConversationFiles = new Map();
/** 以完整回执身份隔离原生单文件授权。 / Isolate native single-file grants using the complete receipt identity. */
function conversationFileKey(reference) {
  return JSON.stringify([reference.conversationId, reference.workspacePath, reference.messageId, reference.stepId, reference.fileId, reference.path]);
}

/** 仅复用本桥接实际收到的原生文件授权。 / Reuse only native file grants actually received by this bridge. */
function conversationFileRequest(reference, selected = false) {
  const request = resolveConversationFile(reference);
  if (!selected) return request;
  const grant = selectedConversationFiles.get(conversationFileKey(reference));
  if (!grant) throw new Error('原生文件授权已失效 / The native file grant is no longer available.');
  return { ...request, path: grant.path, grantId: grant.grantId };
}

/** 只暴露本机实际提供的文件能力。 / Expose only file capabilities actually provided by the desktop. */
function conversationFileCapabilities() {
  const api = typeof window !== 'undefined' ? window.electronAPI : null;
  return { read: typeof api?.readConversationFile === 'function', actions: typeof api?.actOnConversationFile === 'function', editors: typeof api?.listConversationFileEditors === 'function', select: typeof api?.selectConversationFile === 'function' };
}

/** 明确请求读取受工作区边界约束的当前文件。 / Explicitly read the current file within the workspace boundary. */
async function readConversationFile(reference, selected = false) {
  const request = conversationFileRequest(reference, selected);
  if (!conversationFileCapabilities().read) throw new Error('当前环境不能读取本机文件 / Local file reading is unavailable.');
  const result = await window.electronAPI.readConversationFile(request);
  resolveConversationFile(reference);
  return result;
}

/** 通过原生对话框明确选择单个文件，保留独立来源。 / Explicitly select a single file through the native dialog and retain its distinct source. */
async function selectConversationFile(reference) {
  resolveConversationFile(reference);
  if (!conversationFileCapabilities().select) throw new Error('当前环境没有原生文件选择 / Native file selection is unavailable.');
  const result = await window.electronAPI.selectConversationFile({ path: reference.path });
  resolveConversationFile(reference);
  if (!result?.canceled) {
    if (typeof result?.grantId !== 'string' || typeof result?.path !== 'string') throw new Error('原生文件授权无效 / Invalid native file grant.');
    selectedConversationFiles.set(conversationFileKey(reference), { grantId: result.grantId, path: result.path });
    while (selectedConversationFiles.size > 32) selectedConversationFiles.delete(selectedConversationFiles.keys().next().value);
  }
  return result;
}

/** 查询实际安装的编辑器，不创建固定占位选项。 / Query installed editors without inventing placeholder options. */
async function listConversationFileEditors(reference) {
  resolveConversationFile(reference);
  if (!conversationFileCapabilities().editors) return [];
  const editors = await window.electronAPI.listConversationFileEditors();
  resolveConversationFile(reference);
  return toArray(editors).filter((item) => item && typeof item.id === 'string' && typeof item.label === 'string');
}

/** 仅对已选回执调用原生文件动作，不拼接命令。 / Invoke native file actions only for selected receipts without constructing commands. */
async function actOnConversationFile(reference, action, editorId = '', selected = false) {
  const request = conversationFileRequest(reference, selected);
  if (!['open-default', 'reveal', 'save-as', 'open-editor'].includes(action)) throw new Error('不支持的文件操作 / Unsupported file operation.');
  if (!conversationFileCapabilities().actions) throw new Error('当前环境没有本机文件操作 / Native file actions are unavailable.');
  return window.electronAPI.actOnConversationFile({ ...request, action, ...(action === 'open-editor' ? { editorId: String(editorId) } : {}) });
}

/** 保存明确选择的权限，不启用 CLI，失败恢复原值。 / Save explicitly selected permissions without enabling CLI, restoring prior values on failure. */
async function setPermissionMode(mode) {
  const host = getHostApp();
  if (!host || typeof host.autoSaveSettings !== 'function') return false;
  const isZh = isCurrentLanguageZh(host);
  const next = String(mode || '').trim();
  if (!permissionOptions(host, isZh).some((option) => option.value === next)) throw new Error(isZh ? '当前引擎不支持此权限模式。' : 'This permission mode is not supported by the current engine.');
  if (pendingPermissionChanges.has(host)) throw new Error(isZh ? '权限模式正在保存，请稍候。' : 'A permission change is being saved. Please wait.');
  const previousMode = getActivePermissionMode(host);
  const scope = permissionScopeKey(host);
  const wasUncertain = !!uncertainPermissionScopes.get(host)?.has(scope);
  if (next === previousMode && !wasUncertain) return true;
  const engine = permissionEngine(host);
  const previous = ['CLISettings', engine.key].map((key) => {
    /** 仅保存目标字段的原状态，保留其他设置。 / Snapshot target fields only while preserving unrelated settings. */
    const source = host[key];
    const target = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
    return { key, source, target, hadMode: Object.prototype.hasOwnProperty.call(target, 'permissionMode'), mode: target.permissionMode };
  });
  pendingPermissionChanges.set(host, { previousMode, engine: engine.id, scope });
  for (const entry of previous) { host[entry.key] = entry.target; entry.target.permissionMode = next; }
  try {
    const result = await host.autoSaveSettings();
    if (result === false || result?.success === false) throw new Error(isZh ? '权限模式保存被拒绝。' : 'Permission settings were rejected.');
    markPermissionUncertain(host, scope, false);
    return true;
  } catch (error) {
    for (const entry of previous) {
      const sameScope = permissionScopeKey(host) === scope;
      const current = host[entry.key];
      const target = current === entry.target || sameScope ? current : null;
      if (!target || target.permissionMode !== next || (entry.key === 'CLISettings' && !sameScope)) continue;
      if (entry.hadMode) target.permissionMode = entry.mode; else delete target.permissionMode;
      if (entry.source !== entry.target && !Object.keys(target).length) {
        if (entry.source === undefined) delete host[entry.key]; else host[entry.key] = entry.source;
      }
    }
    try {
      const restored = await host.autoSaveSettings();
      if (restored === false || restored?.success === false) throw new Error('Permission rollback rejected');
      markPermissionUncertain(host, scope, false);
    } catch {
      markPermissionUncertain(host, scope, true);
      throw new Error(isZh ? '权限保存失败，界面已恢复原模式；请重试以确认运行时设置。' : 'Permission saving failed. The previous mode is shown; retry to confirm runtime settings.');
    }
    if (wasUncertain && next === previousMode) return true;
    throw error;
  } finally {
    pendingPermissionChanges.delete(host);
  }
}

async function renameConversation(id, newTitle) {
  const host = getHostApp();
  if (!host || !id) return false;
  const title = String(newTitle || '').trim();
  if (!title) return false;
  if (typeof host.renameConversationById === 'function') {
    return await host.renameConversationById(id, title) === true;
  }
  if (typeof host.renameConversation === 'function') {
    return await host.renameConversation(id, title) === true;
  }
  return false;
}

async function archiveConversation(id) {
  const host = getHostApp();
  if (!host || !id) return false;
  if (typeof host.archiveConversationToMemory === 'function') {
    return await host.archiveConversationToMemory(id) === true;
  }
  if (typeof host.archiveConversation === 'function') {
    return await host.archiveConversation(id) === true;
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

async function setGitBranch(branch) {
  const host = getHostApp();
  if (!host || !branch || typeof host.switchGitBranch !== 'function') return false;
  return await host.switchGitBranch(branch) === true;
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

/** 提供只投影/显式操作的聊天桥；expose projections and explicit chat actions. */
export function createChatBridge() {
  return {
    snapshot: getSnapshot,
    sendMessage,
    checkConversationConnection,
    stopResponse,
    refreshGuidance,
    suspendGuidanceRefresh,
    updateGuidance,
    resumeConversationRecovery,
    retryConversationSave,
    setCompletionPreference,
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
    toggleNativeMemory,
    toggleWebSearch,
    toggleBrowserControl,
    toggleTts,
    toggleDesktopVision,
    triggerScreenshot,
    openTablePet,
    openRoleCardPanel,
    openIdentityConfig,
    importRoleAvatar,
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
    conversationFileCapabilities,
    readConversationFile,
    selectConversationFile,
    listConversationFileEditors,
    actOnConversationFile,
    readSubagentTranscript,
    refreshAutomations,
    suspendAutomationRefresh,
    updateConversationAutomation,
    openAutomationTaskCenter,
    setPermissionMode,
    openSubscriptionCenter,
    refreshCredits,
    renameConversation,
    archiveConversation,
    copyConversationId,
    setGitBranch,
  };
}
