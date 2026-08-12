<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { createChatBridge } from './chatBridge';

const bridge = createChatBridge();
const snapshot = ref(bridge.snapshot());
const draft = ref('');
const streamRef = ref(null);
const inputWrapperRef = ref(null);
const textareaRef = ref(null);
const composerSpace = ref(160);
const COMPOSER_TEXTAREA_MIN_HEIGHT = 48;
const COMPOSER_TEXTAREA_MAX_HEIGHT = 168;
const STREAM_REFRESH_DELAY = 60;
const ACTIVE_REFRESH_DELAY = 240;
const IDLE_REFRESH_DELAY = 680;
const showSettingsPanel = ref(false);
const showMorePopover = ref(false);
const showRoleCardPopover = ref(false);
const showQuestPanel = ref(false);
const questRefreshing = ref(false);
const questStatus = ref(null);
const showConversationsPanel = ref(true);
const liveStatus = ref({
  visible: false,
  tone: 'info',
  text: '',
});

let refreshTimer = null;
let lastMessageSignature = '';
let lastSnapshotSignature = '';
let lastActiveMenu = '';
let statusHideTimer = null;
let composerResizeObserver = null;
let scrollFrame = 0;
let scrollFollowFrame = 0;

const questFallbackStatus = {
  gateway: {
    status: 'unknown',
    protocol_version: 'vr-gateway/unknown',
    recommended_quest_url: '',
    local_quest_url: '/quest3/',
  },
  network: {
    lan_urls: [],
  },
  desktop: {
    connected_device: 'unknown',
  },
  device: {
    connected: false,
    last_seen_at: '',
    age_seconds: null,
    stale_after_seconds: 45,
    session_id: '',
    session_valid: false,
    name: '',
    model: '',
    device: {},
    capabilities: {},
    hardware: {},
    runtime: {},
  },
};

const composerSpaceStyle = computed(() => `${composerSpace.value}px`);

function handleDocumentClick() {
  if (showMorePopover.value) {
    showMorePopover.value = false;
  }
  if (showRoleCardPopover.value) {
    showRoleCardPopover.value = false;
  }
  if (showQuestPanel.value) {
    showQuestPanel.value = false;
  }
  // 关闭 toolbar 上的弹层（点空白处收起）
  if (showPermissionMenu.value) showPermissionMenu.value = false;
  if (showContextPopover.value) showContextPopover.value = false;
  if (showCreditsPopover.value) showCreditsPopover.value = false;
  if (showGitMenu.value) showGitMenu.value = false;
  if (conversationMenu.value.visible) {
    conversationMenu.value = { visible: false, x: 0, y: 0, conversationId: '', conversationTitle: '' };
  }
}

function pushStatus(text, tone = 'info') {
  liveStatus.value = {
    visible: true,
    tone,
    text,
  };
  if (statusHideTimer) {
    window.clearTimeout(statusHideTimer);
  }
  statusHideTimer = window.setTimeout(() => {
    liveStatus.value.visible = false;
  }, 2800);
}

function buildMessageSignature(messages) {
  return messages
    .map((message) => [
      message.id,
      message.role,
      message.time,
      message.typing ? 'typing' : 'content',
      message.text || '',
      message.html || '',
      message.activity?.signature || '',
    ].join('::'))
    .join('||');
}

function buildConversationSignature(items) {
  return (items || [])
    .map((item) => [
      item.id,
      item.title,
      item.preview,
      item.time,
      item.providerName,
      item.model,
      item.isActive ? '1' : '0',
    ].join(':'))
    .join('|');
}

function buildWorkspaceSignature(workspace) {
  if (!workspace) return '';
  const projects = (workspace.projects || [])
    .map((item) => `${item.id}:${item.isActive ? '1' : '0'}:${item.lastUsed || ''}`)
    .join('|');
  const git = workspace.git || {};
  return [
    workspace.loaded ? '1' : '0',
    workspace.path || '',
    workspace.name || '',
    projects,
    git.enabled ? '1' : '0',
    git.branch || '',
    git.dirty ? '1' : '0',
    git.ahead || 0,
    git.behind || 0,
  ].join('::');
}

function buildSettingsSignature(settings) {
  const safe = settings || {};
  const permission = safe.permission || {};
  const contextWindow = safe.contextWindow || {};
  const customCredits = safe.customCredits || {};
  return [
    safe.providerId,
    safe.providerName,
    safe.model,
    safe.temperature,
    safe.maxTokens,
    safe.memoryEnabled ? '1' : '0',
    safe.interpreterEnabled ? '1' : '0',
    safe.asrEnabled ? '1' : '0',
    safe.webSearchEnabled ? '1' : '0',
    safe.browserControlEnabled ? '1' : '0',
    safe.ttsEnabled ? '1' : '0',
    safe.desktopVisionEnabled ? '1' : '0',
    safe.roleCardEnabled ? '1' : '0',
    safe.roleCardSelectedId,
    safe.roleCardAvatarImage,
    safe.roleCardAvatarText,
    permission.current,
    contextWindow.percent,
    customCredits.active ? '1' : '0',
    customCredits.dailyRemaining,
    customCredits.totalRemaining,
    customCredits.planName,
    buildWorkspaceSignature(safe.workspace),
  ].join('::');
}

function buildSnapshotSignature(nextSnapshot, messageSignature) {
  return [
    messageSignature,
    nextSnapshot.isZh ? 'zh' : 'en',
    nextSnapshot.activeMenu || '',
    nextSnapshot.conversationId || '',
    nextSnapshot.title || '',
    nextSnapshot.model || '',
    nextSnapshot.modelDisplay || '',
    nextSnapshot.isEmpty ? '1' : '0',
    nextSnapshot.isSending ? '1' : '0',
    nextSnapshot.historyQuery || '',
    buildConversationSignature(nextSnapshot.conversations || []),
    buildSettingsSignature(nextSnapshot.settings || {}),
    (nextSnapshot.attachments || []).map((item) => `${item.name || ''}:${item.path || ''}`).join('|'),
  ].join('||');
}

function requestUiFrame(callback) {
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    return window.requestAnimationFrame(callback);
  }
  callback();
  return 0;
}

function cancelUiFrame(frameId) {
  if (frameId && typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
    window.cancelAnimationFrame(frameId);
  }
}

function getMorphdom() {
  if (typeof window === 'undefined') return null;
  return typeof window.morphdom === 'function' ? window.morphdom : null;
}

function writeStableHtml(el, value) {
  const nextHtml = String(value || '');
  if (nextHtml === el.__oxcStableHtml) return;
  el.__oxcStableHtml = nextHtml;

  if (el.__oxcStableHtmlFrame) {
    cancelUiFrame(el.__oxcStableHtmlFrame);
  }

  el.__oxcStableHtmlFrame = requestUiFrame(() => {
    el.__oxcStableHtmlFrame = 0;
    if (nextHtml === el.__oxcStableHtmlRendered) return;

    const morphdom = getMorphdom();
    if (morphdom && typeof document !== 'undefined') {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = nextHtml;
      morphdom(el, wrapper, {
        childrenOnly: true,
        onBeforeElUpdated(fromEl, toEl) {
          if (fromEl.isEqualNode(toEl)) return false;
          if (fromEl.matches?.('pre, code, table') && fromEl.textContent === toEl.textContent) {
            return false;
          }
          return true;
        },
      });
    } else {
      el.innerHTML = nextHtml;
    }

    el.__oxcStableHtmlRendered = nextHtml;
  });
}

const vStableHtml = {
  mounted(el, binding) {
    el.__oxcStableHtml = '';
    el.__oxcStableHtmlRendered = '';
    writeStableHtml(el, binding.value);
  },
  updated(el, binding) {
    writeStableHtml(el, binding.value);
  },
  beforeUnmount(el) {
    if (el.__oxcStableHtmlFrame) {
      cancelUiFrame(el.__oxcStableHtmlFrame);
    }
  },
};

function updateComposerSpace() {
  const node = inputWrapperRef.value;
  const height = node ? Math.ceil(node.getBoundingClientRect().height) : 132;
  const next = Math.max(132, height + 28);
  if (Math.abs(composerSpace.value - next) > 1) {
    composerSpace.value = next;
  }
  return next;
}

function getBottomDistance() {
  const container = streamRef.value;
  if (!container) return 0;
  return container.scrollHeight - container.scrollTop - container.clientHeight;
}

function shouldPinToBottom() {
  if (!streamRef.value) return true;
  const threshold = Math.max(140, Math.min(360, composerSpace.value + 72));
  return getBottomDistance() <= threshold;
}

function applyScrollToBottom() {
  const container = streamRef.value;
  if (!container) return;
  container.scrollTop = Math.max(0, container.scrollHeight - container.clientHeight + 2);
}

function scrollToBottom(force = false, passes = 2) {
  if (!streamRef.value) return;
  if (!force && !shouldPinToBottom()) return;
  cancelUiFrame(scrollFrame);
  cancelUiFrame(scrollFollowFrame);
  scrollFrame = requestUiFrame(() => {
    scrollFrame = 0;
    if (!force && !shouldPinToBottom()) return;
    applyScrollToBottom();
    if (passes > 1) {
      scrollFollowFrame = requestUiFrame(() => {
        scrollFollowFrame = 0;
        if (force || shouldPinToBottom()) {
          applyScrollToBottom();
        }
      });
    }
  });
}

function scheduleComposerMeasure() {
  const wasPinned = shouldPinToBottom();
  nextTick(() => {
    requestUiFrame(() => {
      updateComposerSpace();
      if (wasPinned || snapshot.value.isSending) {
        scrollToBottom(true, snapshot.value.isSending ? 3 : 2);
      }
    });
  });
}

function getNextRefreshDelay(nextSnapshot = snapshot.value) {
  if (nextSnapshot?.activeMenu === 'chat' && nextSnapshot?.isSending) {
    return STREAM_REFRESH_DELAY;
  }
  if (nextSnapshot?.activeMenu === 'chat') {
    return ACTIVE_REFRESH_DELAY;
  }
  return IDLE_REFRESH_DELAY;
}

function scheduleRefreshLoop(delay = getNextRefreshDelay()) {
  if (refreshTimer) {
    window.clearTimeout(refreshTimer);
  }
  refreshTimer = window.setTimeout(() => {
    const nextSnapshot = refreshSnapshot(false, { passive: true });
    scheduleRefreshLoop(getNextRefreshDelay(nextSnapshot || snapshot.value));
  }, delay);
}

function refreshSnapshot(forceScroll = false, options = {}) {
  const passive = Boolean(options?.passive);
  const wasPinned = shouldPinToBottom();
  const wasSending = !!snapshot.value.isSending;
  const nextSnapshot = bridge.snapshot();
  const nextSignature = buildMessageSignature(nextSnapshot.messages);
  const nextSnapshotSignature = buildSnapshotSignature(nextSnapshot, nextSignature);
  const hasChanged = nextSnapshotSignature !== lastSnapshotSignature;
  const shouldForceForChatEntry = nextSnapshot.activeMenu === 'chat' && lastActiveMenu !== 'chat';
  const shouldFollowStreaming = nextSnapshot.activeMenu === 'chat' && (nextSnapshot.isSending || wasSending);
  const shouldApplySnapshot = !passive || hasChanged || forceScroll || shouldForceForChatEntry;

  if (shouldApplySnapshot) {
    snapshot.value = nextSnapshot;
    lastMessageSignature = nextSignature;
    lastSnapshotSignature = nextSnapshotSignature;
    nextTick(() => {
      updateComposerSpace();
      scrollToBottom(forceScroll || shouldForceForChatEntry || shouldFollowStreaming || wasPinned, shouldFollowStreaming ? 3 : 2);
    });
  }
  lastActiveMenu = nextSnapshot.activeMenu || '';
  return nextSnapshot;
}

function autoResizeTextarea() {
  const node = textareaRef.value;
  if (!node) return;
  node.style.height = 'auto';
  const nextHeight = Math.min(
    Math.max(node.scrollHeight, COMPOSER_TEXTAREA_MIN_HEIGHT),
    COMPOSER_TEXTAREA_MAX_HEIGHT
  );
  node.style.height = `${nextHeight}px`;
  node.style.overflowY = node.scrollHeight > COMPOSER_TEXTAREA_MAX_HEIGHT ? 'auto' : 'hidden';
  scheduleComposerMeasure();
}

function handleDraftInput(event) {
  draft.value = event.target.value;
  nextTick(autoResizeTextarea);
}

function handleComposerPaste(event) {
  // 把粘贴事件转发给宿主 handleInputPaste，让它统一处理图片 / 文件 / 长文本附件
  bridge.handlePaste(event);
  // 立刻刷一下 snapshot，让附件预览条马上显示
  nextTick(refreshSnapshot);
}

function handleRemoveAttachment(item) {
  bridge.removeAttachment(item);
  refreshSnapshot();
}

function toggleConversationsPanel() {
  showConversationsPanel.value = !showConversationsPanel.value;
}

async function handleSend() {
  const text = String(draft.value || '');
  if (!text.trim() && !snapshot.value.isSending) return;
  // 立即清空输入框，避免宿主 handleSendOrGuidance 抛异常时把内容留在框里
  draft.value = '';
  nextTick(() => {
    if (textareaRef.value) {
      textareaRef.value.style.height = `${COMPOSER_TEXTAREA_MIN_HEIGHT}px`;
      textareaRef.value.style.overflowY = 'hidden';
    }
  });
  try {
    await bridge.sendMessage(text);
  } catch (error) {
    console.warn('sendMessage failed:', error);
  }
  refreshSnapshot(true);
}

function handleComposerKeydown(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    handleSend();
  }
}

async function handleNewChat() {
  await bridge.startNewChat();
  refreshSnapshot(true);
}

function handleHistory() {
  bridge.openHistory();
}

function handleToggleSettings() {
  showSettingsPanel.value = !showSettingsPanel.value;
}

function handleCloseSettings() {
  showSettingsPanel.value = false;
}

function handleModelBadge() {
  showSettingsPanel.value = true;
}

function normalizeQuestStatus(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const body = source.status && typeof source.status === 'object' ? source.status : source;
  const gateway = body.gateway && typeof body.gateway === 'object' ? body.gateway : {};
  const network = body.network && typeof body.network === 'object' ? body.network : {};
  const desktop = body.desktop && typeof body.desktop === 'object' ? body.desktop : {};
  const device = body.device && typeof body.device === 'object' ? body.device : {};
  const local = body.local && typeof body.local === 'object' ? body.local : {};
  const lan = body.lan && typeof body.lan === 'object' ? body.lan : {};
  const lanUrls = Array.isArray(network.lan_urls)
    ? network.lan_urls
    : (Array.isArray(lan.interfaces) ? lan.interfaces : []);
  return {
    ...questFallbackStatus,
    ...body,
    gateway: {
      ...questFallbackStatus.gateway,
      ...gateway,
      status: source.success === true || body.success === true || lan.available ? 'ready' : (gateway.status || questFallbackStatus.gateway.status),
      protocol_version: gateway.protocol_version || 'vr-gateway/v1',
      recommended_quest_url: gateway.recommended_quest_url || lan.recommended_quest_url || local.quest_url || questFallbackStatus.gateway.recommended_quest_url,
      local_quest_url: gateway.local_quest_url || local.quest_url || questFallbackStatus.gateway.local_quest_url,
    },
    network: {
      ...questFallbackStatus.network,
      ...network,
      lan_urls: lanUrls,
    },
    desktop: {
      ...questFallbackStatus.desktop,
      ...desktop,
    },
    device: {
      ...questFallbackStatus.device,
      ...device,
      device: {
        ...questFallbackStatus.device.device,
        ...(device.device && typeof device.device === 'object' ? device.device : {}),
      },
      capabilities: {
        ...questFallbackStatus.device.capabilities,
        ...(device.capabilities && typeof device.capabilities === 'object' ? device.capabilities : {}),
      },
      hardware: {
        ...questFallbackStatus.device.hardware,
        ...(device.hardware && typeof device.hardware === 'object' ? device.hardware : {}),
      },
      runtime: {
        ...questFallbackStatus.device.runtime,
        ...(device.runtime && typeof device.runtime === 'object' ? device.runtime : {}),
      },
    },
  };
}

async function refreshQuestStatus({ silent = false } = {}) {
  if (questRefreshing.value) return questStatus.value;
  questRefreshing.value = true;
  try {
    const response = await fetch('/v1/vr/status', { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    questStatus.value = normalizeQuestStatus(await response.json());
    if (!silent) {
      pushStatus(isZh.value ? 'Quest 3 连接状态已刷新' : 'Quest 3 status refreshed', 'success');
    }
  } catch (error) {
    console.warn('[chat-vite] refresh Quest status failed:', error);
    questStatus.value = normalizeQuestStatus({
      gateway: {
        status: 'offline',
        recommended_quest_url: '/quest3/',
        local_quest_url: '/quest3/',
      },
      network: {
        lan_urls: [],
      },
    });
    if (!silent) {
      pushStatus(isZh.value ? '暂时无法读取 Quest Gateway 状态' : 'Quest Gateway status unavailable', 'warning');
    }
  } finally {
    questRefreshing.value = false;
  }
  return questStatus.value;
}

function toggleQuestPanel(event) {
  if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
  showQuestPanel.value = !showQuestPanel.value;
  if (showQuestPanel.value) {
    showMorePopover.value = false;
    showRoleCardPopover.value = false;
    showPermissionMenu.value = false;
    showContextPopover.value = false;
    showCreditsPopover.value = false;
    refreshQuestStatus({ silent: true });
  }
}

async function copyQuestUrl(url) {
  const target = String(url || questPrimaryUrl.value || '').trim();
  if (!target) {
    pushStatus(isZh.value ? '没有可复制的 Quest 地址' : 'No Quest URL to copy', 'warning');
    return;
  }
  try {
    await navigator.clipboard.writeText(target);
    pushStatus(isZh.value ? 'Quest 访问地址已复制' : 'Quest URL copied', 'success');
  } catch (error) {
    console.warn('[chat-vite] copy Quest URL failed:', error);
    pushStatus(target, 'info');
  }
}

function openQuestEntry() {
  const target = questPrimaryUrl.value || '/quest3/';
  if (typeof window !== 'undefined') {
    window.open(target, '_blank', 'noopener,noreferrer');
  }
}

function handleOpenFullModelConfig() {
  bridge.openModelPicker();
}

function handleSelectProviderCard(provider) {
  if (!provider) return;
  bridge.selectChatProvider(provider.id).then(() => refreshSnapshot()).catch((error) => {
    console.error(error);
  });
}

function handleSelectProviderModel(providerId, modelId) {
  bridge.selectChatProviderModel(providerId, modelId).then(() => refreshSnapshot()).catch((error) => {
    console.error(error);
  });
}

function handleValidateProvider(providerId) {
  bridge.validateChatProvider(providerId).then(() => refreshSnapshot()).catch((error) => {
    console.error(error);
  });
}

function handleAttachFiles() {
  bridge.browseAllFiles();
}

function handleAttachImages() {
  bridge.browseImages();
}

function handleToggleInterpreter() {
  bridge.toggleInterpreter();
  refreshSnapshot();
}

function handleToggleAsr() {
  bridge.toggleAsr();
  refreshSnapshot();
}

function handleToggleMemory() {
  bridge.toggleMemory();
  refreshSnapshot();
}

const conversationTab = ref('chat');

async function handleSelectConversation(id) {
  await bridge.loadConversation(id);
  refreshSnapshot(true);
}

async function handleDeleteConversation(id, event) {
  if (event) {
    event.stopPropagation();
  }
  await bridge.deleteConversation(id);
  refreshSnapshot();
}

function handleHistorySearchInput(event) {
  bridge.setHistoryQuery(event.target.value);
  refreshSnapshot();
}

async function handleAddProject() {
  const added = await bridge.addProject();
  refreshSnapshot(Boolean(added));
}

function handleToggleWebSearch() {
  bridge.toggleWebSearch();
  refreshSnapshot();
}

function handleToggleBrowserControl() {
  bridge.toggleBrowserControl();
  refreshSnapshot();
}

function handleToggleTts() {
  bridge.toggleTts();
  refreshSnapshot();
}

function handleToggleDesktopVision() {
  bridge.toggleDesktopVision();
  refreshSnapshot();
}

function handleScreenshot() {
  bridge.triggerScreenshot();
  showMorePopover.value = false;
}

function handleTablePet() {
  bridge.openTablePet();
  showMorePopover.value = false;
  showRoleCardPopover.value = false;
}

function toggleRoleCardPopover(event) {
  if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
  showRoleCardPopover.value = !showRoleCardPopover.value;
  if (showRoleCardPopover.value) {
    showMorePopover.value = false;
    showQuestPanel.value = false;
    showPermissionMenu.value = false;
    showContextPopover.value = false;
    showCreditsPopover.value = false;
  }
}

async function handleSelectRoleCard(card) {
  if (!card?.id) return;
  await bridge.selectRoleCard(card.id);
  showRoleCardPopover.value = false;
  refreshSnapshot();
}

async function handleDisableRoleCard() {
  await bridge.disableRoleCard();
  showRoleCardPopover.value = false;
  refreshSnapshot();
}

function handleOpenRoleCardConfig() {
  bridge.openRoleCardPanel();
  showRoleCardPopover.value = false;
}

function toggleMorePopover(event) {
  event.stopPropagation();
  showMorePopover.value = !showMorePopover.value;
  if (showMorePopover.value) {
    showRoleCardPopover.value = false;
    showQuestPanel.value = false;
  }
}

function handleTemperatureInput(event) {
  bridge.setTemperature(event.target.value);
  refreshSnapshot();
}

function handleMaxTokensChange(event) {
  bridge.setMaxTokens(event.target.value);
  refreshSnapshot();
}

function handleSystemPromptInput(event) {
  bridge.setSystemPrompt(event.target.value);
  refreshSnapshot();
}

const messageItems = computed(() => snapshot.value.messages || []);
const composerPlaceholder = computed(() => snapshot.value.isZh ? '输入消息...' : 'Type a message...');
const sendIconClass = computed(() => snapshot.value.isSending && !String(draft.value || '').trim()
  ? 'fa-solid fa-stop'
  : 'fa-solid fa-arrow-up');
const settings = computed(() => snapshot.value.settings || {});
const modelProviderCards = computed(() => settings.value.providerCards || []);
const currentProvider = computed(() => {
  const targetId = String(settings.value.providerId || '').trim();
  return modelProviderCards.value.find((item) => String(item?.id || '') === targetId) || modelProviderCards.value[0] || null;
});
const roleCards = computed(() => settings.value.roleCards || []);
const roleCardTitle = computed(() => {
  const name = String(settings.value.roleCardName || '').trim();
  if (settings.value.roleCardEnabled && name) {
    return isZh.value ? `当前角色卡：${name}` : `Current role card: ${name}`;
  }
  return isZh.value ? '角色卡' : 'Role card';
});
const assistantAvatar = computed(() => {
  const enabled = !!settings.value.roleCardEnabled;
  const name = String(settings.value.roleCardName || '').trim();
  const image = enabled ? String(settings.value.roleCardAvatarImage || '').trim() : '';
  const fallback = enabled
    ? Array.from(name.replace(/\s+/g, '')).slice(0, 2).join('')
    : 'AI';
  const text = enabled
    ? (String(settings.value.roleCardAvatarText || '').trim() || fallback || (isZh.value ? '角' : 'R'))
    : 'AI';
  const background = enabled ? String(settings.value.roleCardAvatarBackground || '').trim() : '';
  return {
    image,
    text,
    alt: enabled ? (name || (isZh.value ? '角色卡' : 'Role card')) : 'AI',
    roleCard: enabled,
    style: background ? { background } : {},
  };
});

// —— 权限模式 / 上下文进度 / custom 服务商每日积分 ——
const workspaceState = computed(() => settings.value.workspace || { loaded: false, name: '', path: '' });
const permissionState = computed(() => settings.value.permission || { current: 'default', options: [] });
const contextWindowState = computed(() => settings.value.contextWindow || { used: 0, limit: 1_000_000, ratio: 0, percent: 0, warn: false, critical: false, label: '0 / 1M', summary: '' });
const customCreditsState = computed(() => settings.value.customCredits || { active: false });

const showPermissionMenu = ref(false);
const showContextPopover = ref(false);
const showCreditsPopover = ref(false);

// 积分不足横幅 —— 用户关掉后本会话不再重复出现，除非额度恢复后再下降
const lowCreditsBannerDismissed = ref(false);
const lastLowCreditsRatio = ref(1);

const lowCreditsRatio = computed(() => {
  const c = customCreditsState.value;
  if (!c.active) return 1;
  const quota = Number(c.dailyQuota || 0);
  const remaining = Number(c.dailyRemaining || 0);
  if (quota <= 0) return 1;
  return Math.max(0, Math.min(1, remaining / quota));
});

const showLowCreditsBanner = computed(() => {
  if (!customCreditsState.value.active) return false;
  if (lowCreditsBannerDismissed.value) return false;
  return lowCreditsRatio.value <= 0.10;
});

const lowCreditsMessage = computed(() => {
  const c = customCreditsState.value;
  const remaining = Number(c.dailyRemaining || 0);
  const quota = Number(c.dailyQuota || 0);
  const pct = Math.round(lowCreditsRatio.value * 100);
  return snapshot.value.isZh
    ? `今日剩余 ${remaining}/${quota} 积分（${pct}%），用完前请先充值或切换其它服务商。`
    : `${remaining}/${quota} daily credits left (${pct}%). Top up or switch provider before they run out.`;
});

watch(lowCreditsRatio, (next, prev) => {
  // 额度从低位恢复到 >20% 时，重置 dismiss 状态，下次再低于 10% 还会再次提醒
  if (next > 0.20 && lowCreditsBannerDismissed.value) {
    lowCreditsBannerDismissed.value = false;
  }
  lastLowCreditsRatio.value = next;
});

function dismissLowCreditsBanner() {
  lowCreditsBannerDismissed.value = true;
}

function togglePermissionMenu(event) {
  if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
  showPermissionMenu.value = !showPermissionMenu.value;
  if (showPermissionMenu.value) { showContextPopover.value = false; showCreditsPopover.value = false; showRoleCardPopover.value = false; showQuestPanel.value = false; }
}
async function selectPermissionMode(modeId) {
  showPermissionMenu.value = false;
  const pending = bridge.setPermissionMode(modeId);
  refreshSnapshot(true);
  const changed = await pending;
  refreshSnapshot(Boolean(changed));
}
function getPermissionModeLabel(modeId) {
  const opt = (permissionState.value.options || []).find((o) => o.id === modeId);
  return opt ? opt.label : modeId;
}
function getPermissionModeIcon(modeId) {
  const opt = (permissionState.value.options || []).find((o) => o.id === modeId);
  return opt ? opt.icon : 'fa-solid fa-shield-halved';
}

function toggleContextPopover(event) {
  if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
  showContextPopover.value = !showContextPopover.value;
  if (showContextPopover.value) { showPermissionMenu.value = false; showCreditsPopover.value = false; showRoleCardPopover.value = false; showQuestPanel.value = false; }
}
const creditsRefreshing = ref(false);
async function refreshCreditsAndSnapshot() {
  if (creditsRefreshing.value) return;
  creditsRefreshing.value = true;
  try {
    if (typeof bridge.refreshCredits === 'function') {
      await bridge.refreshCredits();
    }
  } finally {
    creditsRefreshing.value = false;
    refreshSnapshot();
  }
}
function toggleCreditsPopover(event) {
  if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
  showCreditsPopover.value = !showCreditsPopover.value;
  if (showCreditsPopover.value) {
    showPermissionMenu.value = false;
    showContextPopover.value = false;
    showRoleCardPopover.value = false;
    showQuestPanel.value = false;
    // 打开时主动拉一次最新额度，避免读到默认空状态。
    refreshCreditsAndSnapshot();
  }
}
function openSubscriptionCenter() {
  bridge.openSubscriptionCenter();
  showCreditsPopover.value = false;
}
function handleGlobalDismiss() {
  showPermissionMenu.value = false;
  showContextPopover.value = false;
  showCreditsPopover.value = false;
  showRoleCardPopover.value = false;
  showQuestPanel.value = false;
}

// SVG ring 计算
const contextRingDash = computed(() => {
  const r = 9;
  const c = 2 * Math.PI * r;
  const ratio = Math.max(0, Math.min(1, contextWindowState.value.ratio || 0));
  return { circumference: c, offset: c * (1 - ratio) };
});

const questStatusView = computed(() => normalizeQuestStatus(questStatus.value));
const questPrimaryUrl = computed(() => {
  const gateway = questStatusView.value.gateway || {};
  return String(gateway.recommended_quest_url || gateway.local_quest_url || '/quest3/').trim();
});
const questLanUrls = computed(() => questStatusView.value.network?.lan_urls || []);
const questGatewayReady = computed(() => String(questStatusView.value.gateway?.status || '').toLowerCase() === 'ready');
const questDeviceStatus = computed(() => questStatusView.value.device || questFallbackStatus.device);
const questDeviceConnected = computed(() => questDeviceStatus.value.connected === true);
const questStatusTone = computed(() => {
  if (questRefreshing.value) return 'checking';
  if (questDeviceConnected.value) return 'ready';
  return questGatewayReady.value ? 'checking' : 'offline';
});
const questStatusLabel = computed(() => {
  if (questRefreshing.value) return isZh.value ? '检测中' : 'Checking';
  if (questDeviceConnected.value) return isZh.value ? 'Quest 已连接' : 'Quest connected';
  if (questGatewayReady.value) return isZh.value ? '等待 Quest 心跳' : 'Awaiting Quest';
  return isZh.value ? '待启动' : 'Pending';
});
const questDeviceLabel = computed(() => {
  const reportedName = String(questDeviceStatus.value.name || questDeviceStatus.value.runtime?.device_name || '').trim();
  const reportedModel = String(questDeviceStatus.value.model || questDeviceStatus.value.runtime?.device_model || '').trim();
  if (reportedName || reportedModel) return [reportedName, reportedModel].filter(Boolean).join(' / ');
  const value = String(questStatusView.value.desktop?.connected_device || '').trim();
  if (!value || value === 'unknown') return isZh.value ? 'Quest 设备待授权' : 'Quest device pending';
  return value;
});
const questLastSeenLabel = computed(() => {
  const age = Number(questDeviceStatus.value.age_seconds);
  if (Number.isFinite(age)) {
    if (age <= 2) return isZh.value ? '刚刚' : 'Just now';
    if (age < 60) return isZh.value ? `${age} 秒前` : `${age}s ago`;
    return isZh.value ? `${Math.floor(age / 60)} 分钟前` : `${Math.floor(age / 60)}m ago`;
  }
  return isZh.value ? '暂无心跳' : 'No heartbeat';
});
const questRuntimeLabel = computed(() => {
  const runtime = questDeviceStatus.value.runtime || {};
  return String(runtime.xr_loaded_device || runtime.xr_loader || runtime.platform || 'Unity XR').trim();
});
function capabilityTone(capability) {
  if (!capability || typeof capability !== 'object') return 'unknown';
  if (capability.available === true) return 'ready';
  const status = String(capability.status || '').toLowerCase();
  if (status.includes('required') || status.includes('planned') || status.includes('sdk')) return 'planned';
  if (status.includes('not_exposed') || status.includes('not_detected')) return 'offline';
  return 'unknown';
}
function capabilityText(capability) {
  if (!capability || typeof capability !== 'object') return isZh.value ? '未知' : 'Unknown';
  const status = String(capability.status || '').trim();
  if (capability.available === true) return isZh.value ? '可用' : 'Available';
  if (status === 'not_exposed') return isZh.value ? '不开放' : 'Not exposed';
  if (status === 'not_detected') return isZh.value ? '未检测' : 'Not detected';
  if (status.includes('requires')) return isZh.value ? '需 SDK/权限' : 'SDK/permission';
  if (status.includes('permission_required')) return isZh.value ? '需授权' : 'Permission';
  return status || (isZh.value ? '待确认' : 'Pending');
}
const questHardwareItems = computed(() => {
  const hardware = questDeviceStatus.value.hardware || {};
  return [
    { key: 'headset_tracking', icon: 'fa-solid fa-location-crosshairs', zh: '头显 6DoF', en: 'Headset 6DoF' },
    { key: 'controllers', icon: 'fa-solid fa-gamepad', zh: '手柄', en: 'Controllers' },
    { key: 'hand_tracking', icon: 'fa-regular fa-hand', zh: '手部追踪', en: 'Hand tracking' },
    { key: 'passthrough_camera', icon: 'fa-solid fa-camera', zh: '透视摄像头', en: 'Passthrough' },
    { key: 'depth_api', icon: 'fa-solid fa-layer-group', zh: 'Depth API', en: 'Depth API' },
    { key: 'scene_mesh', icon: 'fa-solid fa-border-all', zh: '房间网格', en: 'Scene mesh' },
    { key: 'microphone', icon: 'fa-solid fa-microphone', zh: '麦克风', en: 'Microphone' },
    { key: 'raw_lidar_or_radar', icon: 'fa-solid fa-ban', zh: '原始雷达/LiDAR', en: 'Raw LiDAR/Radar' },
  ].map((item) => {
    const capability = hardware[item.key] || {};
    return {
      ...item,
      capability,
      tone: capabilityTone(capability),
      text: capabilityText(capability),
    };
  });
});

// —— 工作区项目展开 / Git 菜单 / 会话右键菜单 ——
const expandedProjects = ref(new Set());
const showGitMenu = ref(false);
const conversationMenu = ref({ visible: false, x: 0, y: 0, conversationId: '', conversationTitle: '' });

function isProjectExpanded(proj) {
  if (!proj) return false;
  if (proj.isActive) return true; // 当前项目默认展开
  return expandedProjects.value.has(proj.id);
}

async function toggleWorkspaceProject(proj) {
  if (!proj) return;
  if (!proj.isActive) {
    const switched = await bridge.selectProject(proj);
    const next = new Set(expandedProjects.value);
    next.add(proj.id);
    expandedProjects.value = next;
    refreshSnapshot(Boolean(switched));
    return;
  }
  const next = new Set(expandedProjects.value);
  if (next.has(proj.id)) next.delete(proj.id);
  else next.add(proj.id);
  expandedProjects.value = next;
}

function getProjectConversations(proj) {
  // 当前项目下放当前 conversations；其它项目（历史）暂不绑定，留空
  if (!proj || !proj.isActive) return [];
  return conversations.value || [];
}

function toggleGitMenu(event) {
  if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
  showGitMenu.value = !showGitMenu.value;
}

function selectGitBranch(branch) {
  bridge.setGitBranch(branch);
  showGitMenu.value = false;
  refreshSnapshot();
}

function openConversationMenu(event, item) {
  if (!item) return;
  if (event && typeof event.preventDefault === 'function') event.preventDefault();
  if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
  // 限制在视口内
  const x = Math.min(event.clientX || 0, window.innerWidth - 220);
  const y = Math.min(event.clientY || 0, window.innerHeight - 200);
  conversationMenu.value = {
    visible: true,
    x,
    y,
    conversationId: String(item.id || ''),
    conversationTitle: String(item.title || ''),
  };
}

function closeConversationMenu() {
  if (conversationMenu.value.visible) {
    conversationMenu.value = { visible: false, x: 0, y: 0, conversationId: '', conversationTitle: '' };
  }
}

async function handleRenameConversation() {
  const id = conversationMenu.value.conversationId;
  const oldTitle = conversationMenu.value.conversationTitle || '';
  closeConversationMenu();
  const next = window.prompt('重命名对话', oldTitle);
  if (next === null) return;
  const trimmed = String(next || '').trim();
  if (!trimmed || trimmed === oldTitle) return;
  await bridge.renameConversation(id, trimmed);
  refreshSnapshot(true);
}

async function handleCopyConversationId() {
  const id = conversationMenu.value.conversationId;
  closeConversationMenu();
  const ok = await bridge.copyConversationId(id);
  pushStatus(ok ? '对话 ID 已复制' : '复制失败', ok ? 'success' : 'warning');
}

async function handleArchiveConversation() {
  const id = conversationMenu.value.conversationId;
  closeConversationMenu();
  await bridge.archiveConversation(id);
  pushStatus('已归档为永久记忆', 'success');
  refreshSnapshot(true);
}

async function handleDeleteFromMenu() {
  const id = conversationMenu.value.conversationId;
  closeConversationMenu();
  if (!id) return;
  const target = String(id);

  // 1) 调用宿主清理（vue_methods.js 已修复 String 比较）
  try {
    await bridge.deleteConversation(target);
  } catch (e) {
    console.warn('[chat-vite] deleteConversation bridge failed:', e);
  }

  // 2) 防御性兜底：万一 vue_methods.js 因缓存等原因还是旧版本，直接在宿主
  //    conversations 数组上再做一次 String 比较过滤。即使宿主方法没生效，
  //    UI 也能立即看到删除效果。
  try {
    const host = window.openxnetApp;
    if (host && Array.isArray(host.conversations)) {
      const before = host.conversations.length;
      host.conversations = host.conversations.filter((c) => String(c?.id) !== target);
      const after = host.conversations.length;
      if (after === before) {
        // 没匹配到任何 id —— 把当前所有 id 打出来，方便看清差异
        console.warn('[chat-vite] delete fallback found no match; id sent =', target,
          '; ids =', host.conversations.map((c) => `${typeof c?.id}:${c?.id}`));
      }
      if (String(host.conversationId) === target) {
        host.conversationId = null;
        if (Array.isArray(host.messages)) host.messages = [];
      }
      if (typeof host.saveConversations === 'function') {
        host.saveConversations().catch(() => {});
      }
    }
  } catch (e) {
    console.warn('[chat-vite] delete fallback failed:', e);
  }

  refreshSnapshot(true);
}
const providerValidationChip = computed(() => {
  if (!currentProvider.value) return '';
  const status = String(currentProvider.value.validationStatus || '').trim();
  if (!status) return isZh.value ? '未验证' : 'Not validated';
  const mapZh = { success: '验证通过', warning: '需关注', blocked: '阻塞', error: '异常' };
  const mapEn = { success: 'Validated', warning: 'Warning', blocked: 'Blocked', error: 'Error' };
  return isZh.value ? (mapZh[status] || status) : (mapEn[status] || status);
});
const conversations = computed(() => snapshot.value.conversations || []);
const historyQuery = computed(() => snapshot.value.historyQuery || '');
const attachments = computed(() => snapshot.value.attachments || []);
// 输入框不再做硬字数限制；保留 charCount 仅供调试/未来用
const decoratedMessages = computed(() => {
  const items = messageItems.value;
  return items.map((message, index) => {
    const prev = items[index - 1];
    const streaming = message.role === 'assistant'
      && index === items.length - 1
      && !!snapshot.value.isSending;
    const sameRole = !!(prev && prev.role === message.role);
    return { ...message, sameRole, streaming };
  });
});
const isZh = computed(() => snapshot.value.isZh);
const temperatureValue = computed(() => Number(settings.value.temperature || 0).toFixed(1));

function getProviderValidationText(provider) {
  const status = String(provider?.validationStatus || '').trim();
  if (!status) {
    return isZh.value ? '未验证' : 'Not validated';
  }
  return providerValidationChip.value;
}

watch(
  () => [settings.value.providerId, settings.value.model],
  (next, prev) => {
    const nextSignature = `${String(next[0] || '')}::${String(next[1] || '')}`;
    const prevSignature = `${String(prev[0] || '')}::${String(prev[1] || '')}`;
    if (prevSignature && nextSignature !== prevSignature) {
      const providerName = String(settings.value.providerName || '').trim();
      const modelName = String(settings.value.model || snapshot.value.model || '').trim();
      pushStatus(
        providerName ? `${providerName} · ${modelName}` : modelName,
        'success'
      );
    }
  }
);

onMounted(() => {
  refreshSnapshot(true);
  scheduleRefreshLoop(getNextRefreshDelay());
  nextTick(() => {
    autoResizeTextarea();
    updateComposerSpace();
    scrollToBottom(true, 3);
    if (typeof window !== 'undefined' && typeof window.ResizeObserver === 'function' && inputWrapperRef.value) {
      composerResizeObserver = new window.ResizeObserver(scheduleComposerMeasure);
      composerResizeObserver.observe(inputWrapperRef.value);
    }
  });
  window.addEventListener('resize', scheduleComposerMeasure);
  document.addEventListener('mousedown', handleDocumentClick);
});

onBeforeUnmount(() => {
  if (refreshTimer) {
    window.clearTimeout(refreshTimer);
    refreshTimer = null;
  }
  if (statusHideTimer) {
    window.clearTimeout(statusHideTimer);
    statusHideTimer = null;
  }
  if (composerResizeObserver) {
    composerResizeObserver.disconnect();
    composerResizeObserver = null;
  }
  cancelUiFrame(scrollFrame);
  cancelUiFrame(scrollFollowFrame);
  scrollFrame = 0;
  scrollFollowFrame = 0;
  window.removeEventListener('resize', scheduleComposerMeasure);
  document.removeEventListener('mousedown', handleDocumentClick);
});
</script>

<template>
  <div class="ox-vite-chat-shell">

    <!-- ════════ Left: Conversation Panel toggle handle (visible when collapsed) ════════ -->
    <button
      v-if="!showConversationsPanel"
      type="button"
      class="oxc-conversations-handle"
      :title="isZh ? '展开会话栏' : 'Expand conversations'"
      @click="toggleConversationsPanel"
    >
      <i class="fa-solid fa-chevron-right"></i>
    </button>

    <!-- ════════ Left: Conversation Panel ════════ -->
    <aside v-if="showConversationsPanel" class="oxc-conversations">
      <div class="oxc-conversations__header">
        <span class="oxc-conversations__title">{{ isZh ? '会话' : 'Conversations' }}</span>
        <div class="oxc-conversations__header-actions">
          <button
            type="button"
            class="oxc-conversations__new"
            :title="isZh ? '新对话' : 'New chat'"
            @click="handleNewChat"
          >
            <i class="fa-solid fa-plus"></i>
          </button>
          <button
            type="button"
            class="oxc-conversations__collapse"
            :title="isZh ? '收起会话栏' : 'Collapse conversations'"
            @click="toggleConversationsPanel"
          >
            <i class="fa-solid fa-chevron-left"></i>
          </button>
        </div>
      </div>

      <div class="oxc-conversations__tabs">
        <button
          type="button"
          class="oxc-conversations__tab"
          :class="{ 'is-active': conversationTab === 'chat' }"
          @click="conversationTab = 'chat'"
        >
          <i class="fa-solid fa-folder"></i>
          <span>{{ isZh ? '聊天' : 'Chat' }}</span>
        </button>
        <button
          type="button"
          class="oxc-conversations__tab"
          :class="{ 'is-active': conversationTab === 'project' }"
          @click="conversationTab = 'project'"
        >
          <i class="fa-solid fa-folder-tree"></i>
          <span>{{ isZh ? '工作区' : 'Workspace' }}</span>
        </button>
      </div>

      <div v-if="conversationTab === 'chat'" class="oxc-conversations__search">
        <i class="fa-solid fa-magnifying-glass"></i>
        <input
          type="text"
          :value="historyQuery"
          :placeholder="isZh ? '搜索...' : 'Search...'"
          @input="handleHistorySearchInput"
        />
      </div>

      <!-- ────── 聊天 tab：扁平会话列表 ────── -->
      <div v-if="conversationTab === 'chat'" class="oxc-conversations__list">
        <div v-if="conversations.length === 0" class="oxc-conversations__empty">
          {{ isZh ? '暂时还没有会话记录' : 'No conversations yet' }}
        </div>
        <button
          v-for="item in conversations"
          v-else
          :key="item.id"
          type="button"
          class="oxc-conversation-item"
          :class="{ 'is-active': item.isActive }"
          @click="handleSelectConversation(item.id)"
          @contextmenu.prevent="openConversationMenu($event, item)"
        >
          <div class="oxc-conversation-item__head">
            <span class="oxc-conversation-item__title" :title="item.title">{{ item.title }}</span>
            <span
              class="oxc-conversation-item__more"
              :title="isZh ? '更多操作' : 'More'"
              @click.stop="openConversationMenu($event, item)"
            >
              <i class="fa-solid fa-ellipsis"></i>
            </span>
          </div>
          <div v-if="item.preview" class="oxc-conversation-item__preview" :title="item.preview">{{ item.preview }}</div>
          <div v-if="item.providerName || item.model" class="oxc-conversation-item__meta">
            <span v-if="item.providerName">{{ item.providerName }}</span>
            <span v-if="item.model">{{ item.model }}</span>
          </div>
          <div v-if="item.time" class="oxc-conversation-item__time">{{ item.time }}</div>
        </button>
      </div>

      <!-- ────── 工作区 tab：项目列表 + 子会话 ────── -->
      <div v-else class="oxc-workspace">
        <button type="button" class="oxc-workspace__add" @click="handleAddProject">
          <i class="fa-solid fa-plus"></i>
          <span>{{ isZh ? '添加项目' : 'Add Project' }}</span>
        </button>
        <div v-if="!workspaceState.projects.length" class="oxc-conversations__empty">
          {{ isZh ? '暂未连接任何项目，点击上方按钮选择文件夹。' : 'No projects connected yet. Click above to pick a folder.' }}
        </div>
        <div v-for="proj in workspaceState.projects" :key="proj.id" class="oxc-workspace-project">
          <button
            type="button"
            class="oxc-workspace-project__head"
            :class="{ 'is-active': proj.isActive }"
            @click="toggleWorkspaceProject(proj)"
          >
            <i class="fa-solid fa-folder-tree oxc-workspace-project__icon"></i>
            <div class="oxc-workspace-project__copy">
              <strong>{{ proj.name }}</strong>
              <small>{{ proj.path }}</small>
            </div>
            <i class="fa-solid fa-chevron-down oxc-workspace-project__caret"
               :class="{ 'is-open': isProjectExpanded(proj) }"></i>
          </button>
          <div v-show="isProjectExpanded(proj)" class="oxc-workspace-project__body">
            <button
              v-for="item in getProjectConversations(proj)"
              :key="`proj-${proj.id}-${item.id}`"
              type="button"
              class="oxc-conversation-item oxc-conversation-item--nested"
              :class="{ 'is-active': item.isActive }"
              @click="handleSelectConversation(item.id)"
              @contextmenu.prevent="openConversationMenu($event, item)"
            >
              <div class="oxc-conversation-item__head">
                <span class="oxc-conversation-item__title" :title="item.title">{{ item.title }}</span>
                <span class="oxc-conversation-item__more" @click.stop="openConversationMenu($event, item)">
                  <i class="fa-solid fa-ellipsis"></i>
                </span>
              </div>
              <div v-if="item.preview" class="oxc-conversation-item__preview" :title="item.preview">{{ item.preview }}</div>
            </button>
            <button v-if="proj.isActive" type="button" class="oxc-workspace-project__new" @click="handleNewChat">
              <i class="fa-solid fa-plus"></i>
              <span>{{ isZh ? '新建项目对话' : 'New conversation' }}</span>
            </button>
          </div>
        </div>
      </div>
    </aside>

    <!-- ────── 会话右键菜单 ────── -->
    <div
      v-if="conversationMenu.visible"
      class="oxc-conversation-menu"
      :style="{ top: conversationMenu.y + 'px', left: conversationMenu.x + 'px' }"
      @click.stop
      @mousedown.stop
    >
      <button type="button" class="oxc-conversation-menu__item" @click="handleRenameConversation">
        <i class="fa-solid fa-pen-to-square"></i>
        <span>{{ isZh ? '重命名对话' : 'Rename' }}</span>
      </button>
      <button type="button" class="oxc-conversation-menu__item" @click="handleCopyConversationId">
        <i class="fa-solid fa-copy"></i>
        <span>{{ isZh ? '复制对话 ID' : 'Copy conversation ID' }}</span>
      </button>
      <button type="button" class="oxc-conversation-menu__item" @click="handleArchiveConversation">
        <i class="fa-solid fa-box-archive"></i>
        <span>{{ isZh ? '归档为永久记忆' : 'Archive to memory' }}</span>
      </button>
      <div class="oxc-conversation-menu__divider"></div>
      <button type="button" class="oxc-conversation-menu__item is-danger" @click="handleDeleteFromMenu">
        <i class="fa-regular fa-trash-can"></i>
        <span>{{ isZh ? '删除对话' : 'Delete' }}</span>
      </button>
    </div>

    <!-- ════════ Right: Chat column (header + main + composer) ════════ -->
    <div class="oxc-chat-column">

    <!-- ════════ Chat Header ════════ -->
    <header class="oxc-header">
      <div class="oxc-header__left">
        <h1 class="oxc-header__title">{{ snapshot.title }}</h1>
        <button type="button" class="oxc-header__model" @click="handleModelBadge">
          <i class="fa-solid fa-microchip"></i>
          <span>{{ snapshot.modelDisplay || snapshot.model }}</span>
        </button>
        <span class="oxc-header__status" :title="isZh ? '在线' : 'Online'"></span>
      </div>
      <div class="oxc-header__right">
        <button type="button" class="oxc-icon-btn" @click="handleNewChat" :title="isZh ? '新对话' : 'New chat'">
          <i class="fa-solid fa-plus"></i>
        </button>
        <button type="button" class="oxc-icon-btn" @click="handleHistory" :title="isZh ? '对话历史' : 'History'">
          <i class="fa-solid fa-clock-rotate-left"></i>
        </button>
        <div class="oxc-quest-shell" @mousedown.stop @click.stop>
          <button
            type="button"
            class="oxc-icon-btn oxc-quest-trigger"
            :class="{ 'is-active': showQuestPanel, [`is-${questStatusTone}`]: true }"
            @click="toggleQuestPanel"
            :title="isZh ? 'Meta Quest 3 连接' : 'Meta Quest 3 connection'"
          >
            <i class="fa-solid fa-vr-cardboard"></i>
            <span class="oxc-quest-trigger__dot" :class="`is-${questStatusTone}`"></span>
          </button>
          <transition name="oxc-pop">
            <div v-if="showQuestPanel" class="oxc-quest-panel">
              <div class="oxc-quest-panel__head">
                <div class="oxc-quest-panel__title">
                  <i class="fa-brands fa-meta"></i>
                  <div>
                    <strong>{{ isZh ? 'Meta Quest 3' : 'Meta Quest 3' }}</strong>
                    <span>{{ isZh ? 'OpenXnet VR/MR 入口' : 'OpenXnet VR/MR entry' }}</span>
                  </div>
                </div>
                <span class="oxc-quest-status" :class="`is-${questStatusTone}`">
                  <span></span>
                  {{ questStatusLabel }}
                </span>
              </div>

              <div class="oxc-quest-panel__body">
                <div class="oxc-quest-card">
                  <label>{{ isZh ? 'Quest 访问地址' : 'Quest URL' }}</label>
                  <div class="oxc-quest-url">
                    <span :title="questPrimaryUrl">{{ questPrimaryUrl }}</span>
                    <button type="button" @click="copyQuestUrl(questPrimaryUrl)" :title="isZh ? '复制地址' : 'Copy URL'">
                      <i class="fa-regular fa-copy"></i>
                    </button>
                  </div>
                </div>

                <div class="oxc-quest-grid">
                  <div class="oxc-quest-metric">
                    <span>{{ isZh ? '设备' : 'Device' }}</span>
                    <strong>{{ questDeviceLabel }}</strong>
                  </div>
                  <div class="oxc-quest-metric">
                    <span>{{ isZh ? '最后心跳' : 'Last heartbeat' }}</span>
                    <strong>{{ questLastSeenLabel }}</strong>
                  </div>
                  <div class="oxc-quest-metric">
                    <span>{{ isZh ? '协议' : 'Protocol' }}</span>
                    <strong>{{ questStatusView.gateway.protocol_version }}</strong>
                  </div>
                  <div class="oxc-quest-metric">
                    <span>{{ isZh ? '运行时' : 'Runtime' }}</span>
                    <strong>{{ questRuntimeLabel }}</strong>
                  </div>
                </div>

                <div class="oxc-quest-card">
                  <label>{{ isZh ? 'Quest 3 硬件能力' : 'Quest 3 hardware' }}</label>
                  <div class="oxc-quest-hardware-list">
                    <div
                      v-for="item in questHardwareItems"
                      :key="item.key"
                      class="oxc-quest-hardware-item"
                      :class="`is-${item.tone}`"
                    >
                      <i :class="item.icon"></i>
                      <span>{{ isZh ? item.zh : item.en }}</span>
                      <strong>{{ item.text }}</strong>
                    </div>
                  </div>
                  <p class="oxc-quest-empty">
                    {{ isZh ? 'Quest 3 不向普通 Unity App 暴露原始雷达/LiDAR 点云；MR 侧使用 Passthrough、Depth API 与 Scene Mesh。' : 'Quest 3 does not expose raw LiDAR/Radar point clouds to standard Unity apps; MR uses Passthrough, Depth API, and Scene Mesh.' }}
                  </p>
                </div>

                <div class="oxc-quest-card">
                  <label>{{ isZh ? '局域网地址' : 'LAN URLs' }}</label>
                  <div v-if="questLanUrls.length" class="oxc-quest-lan-list">
                    <button
                      v-for="item in questLanUrls"
                      :key="item.quest_url"
                      type="button"
                      class="oxc-quest-lan-item"
                      @click="copyQuestUrl(item.quest_url)"
                    >
                      <i class="fa-solid fa-wifi"></i>
                      <span>{{ item.quest_url }}</span>
                    </button>
                  </div>
                  <p v-else class="oxc-quest-empty">
                    {{ isZh ? '暂无可用局域网地址，Quest 与电脑需在同一 Wi-Fi。' : 'No LAN URL yet. Keep Quest and desktop on the same Wi-Fi.' }}
                  </p>
                </div>
              </div>

              <div class="oxc-quest-panel__actions">
                <button type="button" class="oxc-quest-action" :disabled="questRefreshing" @click="refreshQuestStatus()">
                  <i :class="questRefreshing ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-arrows-rotate'"></i>
                  <span>{{ isZh ? '刷新' : 'Refresh' }}</span>
                </button>
                <button type="button" class="oxc-quest-action" @click="openQuestEntry">
                  <i class="fa-solid fa-arrow-up-right-from-square"></i>
                  <span>{{ isZh ? '打开入口' : 'Open entry' }}</span>
                </button>
              </div>
            </div>
          </transition>
        </div>
        <button
          type="button"
          class="oxc-icon-btn"
          :class="{ 'is-active': showSettingsPanel }"
          @click="handleToggleSettings"
          :title="isZh ? '对话设置' : 'Chat settings'"
        >
          <i class="fa-solid fa-sliders"></i>
        </button>
      </div>
    </header>

    <!-- 旧 oxc-context-strip 已下沉到输入框下方，避免占据顶部高度 -->


    <transition name="oxc-status">
      <div v-if="liveStatus.visible" class="oxc-status-banner" :class="`is-${liveStatus.tone}`">
        <i :class="liveStatus.tone === 'success' ? 'fa-solid fa-circle-check' : (liveStatus.tone === 'warning' ? 'fa-solid fa-triangle-exclamation' : 'fa-solid fa-circle-info')"></i>
        <span>{{ liveStatus.text }}</span>
      </div>
    </transition>

    <!-- ════════ Chat Body (messages + composer) ════════ -->
    <div class="oxc-main" :style="{ '--oxc-composer-space': composerSpaceStyle }">

      <!-- Messages -->
      <div ref="streamRef" class="oxc-stream">
        <div class="oxc-stream__inner">
          <!-- 工作区已加载 + 全新会话 → Codex 风格居中欢迎 -->
          <div v-if="snapshot.isEmpty && workspaceState.loaded" class="oxc-project-welcome">
            <div class="oxc-project-welcome__inner">
              <h2 class="oxc-project-welcome__title">{{ isZh ? `我们该在 ${workspaceState.name} 中做什么？` : `What shall we do in ${workspaceState.name}?` }}</h2>
              <p class="oxc-project-welcome__path">{{ workspaceState.path }}</p>
            </div>
          </div>
          <div v-else-if="snapshot.isEmpty" class="oxc-empty">
            <div class="oxc-empty__icon"><i class="fa-solid fa-comments"></i></div>
            <h2>{{ isZh ? '开始对话' : 'Start a conversation' }}</h2>
            <p>{{ snapshot.emptyPrompt }}</p>
          </div>

          <article
            v-for="message in decoratedMessages"
            v-else
            :key="message.id"
            class="oxc-msg"
            :class="[
              `is-${message.role === 'assistant' ? 'ai' : 'user'}`,
              { 'is-same-role': message.sameRole },
              { 'is-typing': message.typing },
              { 'is-streaming': message.streaming },
            ]"
          >
            <div
              v-if="message.role === 'assistant'"
              class="oxc-msg__avatar"
              :class="{ 'is-role-card': assistantAvatar.roleCard }"
              :style="assistantAvatar.style"
            >
              <img v-if="assistantAvatar.image" :src="assistantAvatar.image" :alt="assistantAvatar.alt" />
              <span v-else>{{ assistantAvatar.text }}</span>
            </div>
            <div class="oxc-msg__content">
              <div
                v-if="message.role === 'assistant' && message.activity?.visible"
                class="oxc-activity"
                :class="{ 'is-active': message.activity.active }"
              >
                <div class="oxc-activity__elapsed">{{ message.activity.elapsedLabel }}</div>
                <div class="oxc-activity__steps">
                  <div
                    v-for="step in message.activity.steps"
                    :key="step.id"
                    class="oxc-activity__step"
                    :class="[`is-${step.status}`, `is-${step.kind}`]"
                  >
                    <span class="oxc-activity__verb">{{ step.label }}</span>
                    <span v-if="step.title" class="oxc-activity__title">{{ step.title }}</span>
                    <span v-if="step.duration" class="oxc-activity__duration">({{ step.duration }})</span>
                    <span v-if="step.detail" class="oxc-activity__detail">{{ step.detail }}</span>
                  </div>
                </div>
              </div>
              <div
                v-if="message.typing && !message.activity?.visible"
                class="oxc-msg__bubble oxc-msg__bubble--ai oxc-msg__bubble--typing"
              >
                <div class="oxc-typing-dots">
                  <span></span><span></span><span></span>
                </div>
              </div>
              <div
                v-else-if="message.role === 'assistant' && message.html"
                class="oxc-msg__bubble oxc-msg__bubble--ai markdown-body"
                v-stable-html="message.html"
              ></div>
              <div
                v-else-if="message.role !== 'assistant'"
                class="oxc-msg__bubble oxc-msg__bubble--user"
              >
                {{ message.text }}
              </div>
              <div v-if="message.time && !message.typing" class="oxc-msg__time">
                {{ message.time }}
              </div>
            </div>
          </article>
        </div>
      </div>

      <!-- Input -->
      <div ref="inputWrapperRef" class="oxc-input-wrapper">
        <!-- 积分不足横幅（custom 服务商日额度 ≤ 10% 时弹出，可关闭） -->
        <transition name="oxc-pop">
          <div v-if="showLowCreditsBanner" class="oxc-low-credits-banner">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <div class="oxc-low-credits-banner__copy">
              <strong>{{ isZh ? '订阅积分不足' : 'Low credits' }}</strong>
              <span>{{ lowCreditsMessage }}</span>
            </div>
            <button type="button" class="oxc-low-credits-banner__cta" @click="openSubscriptionCenter">
              <i class="fa-solid fa-arrow-up-right-from-square"></i>
              <span>{{ isZh ? '充值 / 续费' : 'Top up' }}</span>
            </button>
            <button type="button" class="oxc-low-credits-banner__close" @click="dismissLowCreditsBanner" :title="isZh ? '关闭' : 'Dismiss'">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        </transition>
        <div class="oxc-input-card">
          <!-- 附件预览：粘贴/上传后图片和文件在这里显示 -->
          <div v-if="attachments.length" class="oxc-attachments">
            <div
              v-for="att in attachments"
              :key="att.kind + ':' + att.index + ':' + att.name"
              class="oxc-attachment"
              :class="`is-${att.kind}`"
            >
              <template v-if="att.kind === 'image'">
                <img :src="att.path" :alt="att.name" class="oxc-attachment__thumb" />
              </template>
              <template v-else>
                <span class="oxc-attachment__file-icon">
                  <i class="fa-regular fa-file"></i>
                </span>
                <span class="oxc-attachment__file-name" :title="att.name">{{ att.name }}</span>
              </template>
              <button
                type="button"
                class="oxc-attachment__remove"
                :title="isZh ? '移除' : 'Remove'"
                @click="handleRemoveAttachment(att)"
              >
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
          </div>

          <textarea
            ref="textareaRef"
            :value="draft"
            class="oxc-input-card__textarea"
            :placeholder="composerPlaceholder"
            rows="1"
            @input="handleDraftInput"
            @keydown="handleComposerKeydown"
            @paste="handleComposerPaste"
          ></textarea>
          <div class="oxc-input-toolbar">
            <div class="oxc-input-toolbar__left">
              <button
                type="button"
                class="oxc-toolbar-btn"
                :title="isZh ? '上传文件' : 'Attach file'"
                @click="handleAttachFiles"
              >
                <i class="fa-solid fa-paperclip"></i>
              </button>
              <button
                v-if="settings.tablePetAvailable"
                type="button"
                class="oxc-toolbar-btn"
                :title="isZh ? '桌面宠物' : 'Desktop pet'"
                @click="handleTablePet"
              >
                <i class="fa-solid fa-user-astronaut"></i>
              </button>
              <div
                v-if="settings.roleCardAvailable"
                class="oxc-popover-wrap oxc-role-card-wrap"
                @mousedown.stop
                @click.stop
              >
                <button
                  type="button"
                  class="oxc-toolbar-btn"
                  :class="{ 'is-active': showRoleCardPopover || settings.roleCardEnabled }"
                  :title="roleCardTitle"
                  @click="toggleRoleCardPopover"
                >
                  <i class="fa-solid fa-address-card"></i>
                </button>
                <transition name="oxc-pop">
                  <div v-if="showRoleCardPopover" class="oxc-popover oxc-popover--up oxc-popover--role-card">
                    <div class="oxc-popover__head">
                      <span>{{ isZh ? '角色卡' : 'Role card' }}</span>
                      <small>{{ settings.roleCardEnabled ? settings.roleCardName : (isZh ? '未启用' : 'Off') }}</small>
                    </div>
                    <button
                      v-if="settings.roleCardEnabled"
                      type="button"
                      class="oxc-popover__option"
                      @click="handleDisableRoleCard"
                    >
                      <i class="fa-solid fa-toggle-off"></i>
                      <div class="oxc-popover__option-copy">
                        <strong>{{ isZh ? '停用当前角色卡' : 'Disable current role card' }}</strong>
                        <small>{{ isZh ? '本次对话不再注入角色档案' : 'Stop injecting role profile into this chat' }}</small>
                      </div>
                    </button>
                    <div v-if="roleCards.length" class="oxc-role-card-list">
                      <button
                        v-for="card in roleCards"
                        :key="card.id"
                        type="button"
                        class="oxc-popover__option oxc-role-card-option"
                        :class="{ 'is-active': card.id === settings.roleCardSelectedId && settings.roleCardEnabled }"
                        @click="handleSelectRoleCard(card)"
                      >
                        <span class="oxc-role-card-avatar" :style="{ background: card.avatarBackground }">
                          <img v-if="card.avatarImage" :src="card.avatarImage" :alt="card.name" />
                          <span v-else>{{ card.avatarText || card.initial }}</span>
                        </span>
                        <div class="oxc-popover__option-copy">
                          <strong>{{ card.name }}</strong>
                          <small>{{ card.desc }}</small>
                        </div>
                        <span class="oxc-role-card-tag">{{ card.tag }}</span>
                      </button>
                    </div>
                    <div v-else class="oxc-role-card-empty">
                      {{ isZh ? '还没有可用角色卡' : 'No role cards yet' }}
                    </div>
                    <button type="button" class="oxc-popover__cta" @click="handleOpenRoleCardConfig">
                      <i class="fa-solid fa-sliders"></i>
                      <span>{{ isZh ? '角色卡配置' : 'Configure role cards' }}</span>
                    </button>
                  </div>
                </transition>
              </div>
              <button
                type="button"
                class="oxc-toolbar-btn"
                :class="{ 'is-active': settings.webSearchEnabled }"
                :title="isZh ? '联网搜索' : 'Web search'"
                @click="handleToggleWebSearch"
              >
                <i class="fa-solid fa-globe"></i>
              </button>
              <button
                type="button"
                class="oxc-toolbar-btn"
                :class="{ 'is-active': snapshot.interpreterEnabled }"
                :title="isZh ? '代码解释器' : 'Code interpreter'"
                @click="handleToggleInterpreter"
              >
                <i class="fa-solid fa-code"></i>
              </button>
              <button
                type="button"
                class="oxc-toolbar-btn"
                :class="{ 'is-active': settings.memoryEnabled }"
                v-if="settings.memoryAvailable"
                :title="isZh ? '长期记忆' : 'Memory'"
                @click="handleToggleMemory"
              >
                <i class="fa-solid fa-brain"></i>
              </button>
              <button
                type="button"
                class="oxc-toolbar-btn"
                :class="{ 'is-active': snapshot.asrEnabled }"
                :title="isZh ? '语音输入' : 'Voice input'"
                @click="handleToggleAsr"
              >
                <i class="fa-solid fa-microphone"></i>
              </button>

              <div class="oxc-popover-wrap">
                <button
                  type="button"
                  class="oxc-toolbar-btn"
                  :class="{ 'is-active': showMorePopover || settings.browserControlEnabled || settings.ttsEnabled || settings.desktopVisionEnabled }"
                  :title="isZh ? '更多' : 'More'"
                  @click="toggleMorePopover"
                >
                  <i class="fa-solid fa-ellipsis"></i>
                </button>
                <transition name="oxc-pop">
                  <div v-if="showMorePopover" class="oxc-popover" @mousedown.stop @click.stop>
                    <button
                      type="button"
                      class="oxc-popover-item"
                      @click="handleAttachImages"
                    >
                      <span class="oxc-popover-item__icon"><i class="fa-regular fa-image"></i></span>
                      <span class="oxc-popover-item__label">{{ isZh ? '上传图片' : 'Upload images' }}</span>
                    </button>
                    <button
                      v-if="settings.browserControlAvailable"
                      type="button"
                      class="oxc-popover-item"
                      :class="{ 'is-active': settings.browserControlEnabled }"
                      @click="handleToggleBrowserControl"
                    >
                      <span class="oxc-popover-item__icon"><i class="fa-solid fa-compass"></i></span>
                      <span class="oxc-popover-item__label">{{ isZh ? '浏览器控制' : 'Browser control' }}</span>
                      <span class="oxc-popover-item__badge" :class="{ 'is-on': settings.browserControlEnabled }">
                        {{ settings.browserControlEnabled ? (isZh ? '已开' : 'On') : (isZh ? '已关' : 'Off') }}
                      </span>
                    </button>
                    <button
                      v-if="settings.desktopVisionAvailable"
                      type="button"
                      class="oxc-popover-item"
                      :class="{ 'is-active': settings.desktopVisionEnabled }"
                      @click="handleToggleDesktopVision"
                    >
                      <span class="oxc-popover-item__icon"><i class="fa-solid fa-eye"></i></span>
                      <span class="oxc-popover-item__label">{{ isZh ? '桌面视觉' : 'Desktop vision' }}</span>
                      <span class="oxc-popover-item__badge" :class="{ 'is-on': settings.desktopVisionEnabled }">
                        {{ settings.desktopVisionEnabled ? (isZh ? '已开' : 'On') : (isZh ? '已关' : 'Off') }}
                      </span>
                    </button>
                    <button
                      v-if="settings.ttsAvailable"
                      type="button"
                      class="oxc-popover-item"
                      :class="{ 'is-active': settings.ttsEnabled }"
                      @click="handleToggleTts"
                    >
                      <span class="oxc-popover-item__icon"><i class="fa-solid fa-volume-high"></i></span>
                      <span class="oxc-popover-item__label">{{ isZh ? '语音播报' : 'Text-to-speech' }}</span>
                      <span class="oxc-popover-item__badge" :class="{ 'is-on': settings.ttsEnabled }">
                        {{ settings.ttsEnabled ? (isZh ? '已开' : 'On') : (isZh ? '已关' : 'Off') }}
                      </span>
                    </button>
                    <button
                      v-if="settings.screenshotAvailable"
                      type="button"
                      class="oxc-popover-item"
                      @click="handleScreenshot"
                    >
                      <span class="oxc-popover-item__icon"><i class="fa-solid fa-camera"></i></span>
                      <span class="oxc-popover-item__label">{{ isZh ? '截图' : 'Screenshot' }}</span>
                    </button>
                  </div>
                </transition>
              </div>
            </div>
            <div class="oxc-input-toolbar__right">
              <!-- 权限模式 chip（只在工作区已加载时显示） -->
              <div v-if="workspaceState.loaded" class="oxc-chip-shell" @mousedown.stop @click.stop>
                <button
                  type="button"
                  class="oxc-chip oxc-chip--permission"
                  :class="{
                    'is-bypass': ['bypassPermissions', 'yolo'].includes(permissionState.current),
                    'is-accept': ['acceptEdits', 'auto-approve', 'auto-edit'].includes(permissionState.current),
                    'is-plan': permissionState.current === 'plan'
                  }"
                  :title="isZh ? '权限模式' : 'Permission Mode'"
                  @click="togglePermissionMenu"
                >
                  <i :class="getPermissionModeIcon(permissionState.current)"></i>
                  <span class="oxc-chip__label">{{ getPermissionModeLabel(permissionState.current) }}</span>
                  <i class="fa-solid fa-chevron-down oxc-chip__caret"></i>
                </button>
                <transition name="oxc-pop">
                  <div v-show="showPermissionMenu" class="oxc-popover oxc-popover--up" @mousedown.stop @click.stop>
                    <div class="oxc-popover__head">{{ isZh ? '权限模式' : 'Permission Mode' }}</div>
                    <button
                      v-for="opt in permissionState.options"
                      :key="opt.id"
                      type="button"
                      class="oxc-popover__option"
                      :class="{ 'is-active': opt.id === permissionState.current }"
                      @mousedown.stop
                      @click.stop="selectPermissionMode(opt.id)"
                    >
                      <i :class="opt.icon"></i>
                      <div class="oxc-popover__option-copy">
                        <strong>{{ opt.label }}</strong>
                        <small>{{ opt.desc }}</small>
                      </div>
                      <i v-if="opt.id === permissionState.current" class="fa-solid fa-check oxc-popover__option-check"></i>
                    </button>
                  </div>
                </transition>
              </div>

              <!-- Custom 服务商每日积分 chip -->
              <div v-if="customCreditsState.active" class="oxc-chip-shell" @mousedown.stop @click.stop>
                <button
                  type="button"
                  class="oxc-chip oxc-chip--credits"
                  :title="customCreditsState.summary"
                  @click="toggleCreditsPopover"
                >
                  <i class="fa-solid fa-coins"></i>
                  <span class="oxc-chip__label">{{ customCreditsState.label }}</span>
                </button>
                <transition name="oxc-pop">
                  <div v-show="showCreditsPopover" class="oxc-popover oxc-popover--up oxc-popover--credits">
                    <div class="oxc-popover__head">
                      <strong>{{ isZh ? '订阅积分' : 'Subscription Credits' }}</strong>
                      <small>{{ customCreditsState.planName }}</small>
                      <button
                        type="button"
                        class="oxc-popover__refresh"
                        :class="{ 'is-spinning': creditsRefreshing }"
                        :title="isZh ? '刷新额度' : 'Refresh credits'"
                        :disabled="creditsRefreshing"
                        @click.stop="refreshCreditsAndSnapshot"
                      >
                        <i class="fa-solid fa-arrows-rotate"></i>
                      </button>
                    </div>
                    <div class="oxc-credits-grid">
                      <div class="oxc-credits-item">
                        <span>{{ isZh ? '日剩余' : 'Daily Left' }}</span>
                        <strong>{{ customCreditsState.dailyRemaining }}</strong>
                      </div>
                      <div class="oxc-credits-item">
                        <span>{{ isZh ? '日额度' : 'Daily Quota' }}</span>
                        <strong>{{ customCreditsState.dailyQuota || '—' }}</strong>
                      </div>
                      <div class="oxc-credits-item">
                        <span>{{ isZh ? '赠送' : 'Bonus' }}</span>
                        <strong>{{ customCreditsState.bonusCredits }}</strong>
                      </div>
                      <div class="oxc-credits-item">
                        <span>{{ isZh ? '加油包' : 'Top-up' }}</span>
                        <strong>{{ customCreditsState.topupCredits }}</strong>
                      </div>
                    </div>
                    <button type="button" class="oxc-popover__cta" @click="openSubscriptionCenter">
                      <i class="fa-solid fa-arrow-up-right-from-square"></i>
                      <span>{{ isZh ? '打开订阅中心' : 'Open subscription center' }}</span>
                    </button>
                  </div>
                </transition>
              </div>

              <!-- 上下文进度环 (Claude-Code 风格) -->
              <div class="oxc-chip-shell" @mousedown.stop @click.stop>
                <button
                  type="button"
                  class="oxc-context-ring"
                  :class="{ 'is-warn': contextWindowState.warn, 'is-critical': contextWindowState.critical }"
                  :title="`${contextWindowState.label} (${contextWindowState.percent}%) — ${contextWindowState.summary}`"
                  @click="toggleContextPopover"
                >
                  <svg viewBox="0 0 24 24" class="oxc-context-ring__svg">
                    <circle class="oxc-context-ring__track" cx="12" cy="12" r="9" />
                    <circle
                      class="oxc-context-ring__fill"
                      cx="12" cy="12" r="9"
                      :stroke-dasharray="contextRingDash.circumference"
                      :stroke-dashoffset="contextRingDash.offset"
                      transform="rotate(-90 12 12)"
                    />
                  </svg>
                  <span class="oxc-context-ring__pct">{{ contextWindowState.percent }}%</span>
                </button>
                <transition name="oxc-pop">
                  <div v-show="showContextPopover" class="oxc-popover oxc-popover--up oxc-popover--context">
                    <div class="oxc-popover__head">
                      <strong>{{ isZh ? '上下文窗口' : 'Context Window' }}</strong>
                      <small>{{ contextWindowState.label }} · {{ contextWindowState.percent }}%</small>
                    </div>
                    <div class="oxc-context-bar">
                      <div class="oxc-context-bar__fill" :style="{ width: contextWindowState.percent + '%' }"></div>
                      <div class="oxc-context-bar__threshold" :style="{ left: (contextWindowState.autoCompactAt * 100) + '%' }">
                        <span>{{ Math.round(contextWindowState.autoCompactAt * 100) }}%</span>
                      </div>
                    </div>
                    <p class="oxc-context-note">
                      <i class="fa-solid fa-circle-info"></i>
                      {{ isZh ? 'OpenXnet 在接近 1M 上下文时会自动压缩历史，无需手动操作。' : 'OpenXnet auto-compacts history when context nears 1M — no manual action needed.' }}
                    </p>
                    <div class="oxc-context-rows">
                      <div><span>{{ isZh ? '当前' : 'Used' }}</span><strong>{{ contextWindowState.used }}</strong></div>
                      <div><span>{{ isZh ? '上限' : 'Limit' }}</span><strong>{{ contextWindowState.limit }}</strong></div>
                      <div><span>{{ isZh ? '状态' : 'Status' }}</span><strong>{{ contextWindowState.summary }}</strong></div>
                    </div>
                  </div>
                </transition>
              </div>

              <button
                type="button"
                class="oxc-send-btn"
                :class="{ 'is-stopping': snapshot.isSending && !String(draft || '').trim() }"
                :title="isZh ? '发送' : 'Send'"
                @click="handleSend"
              >
                <i :class="sendIconClass"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- ── 输入框下方状态条（之前在消息上方）+ Git 分支 ── -->
        <div class="oxc-context-strip oxc-context-strip--below">
          <span class="oxc-context-chip is-provider">
            <i class="fa-solid fa-plug-circle-check"></i>
            <span>{{ settings.providerName || (isZh ? '未选择服务商' : 'No provider') }}</span>
          </span>
          <span class="oxc-context-chip is-model">
            <i class="fa-solid fa-microchip"></i>
            <span>{{ settings.model }}</span>
          </span>
          <span class="oxc-context-chip" :class="currentProvider && currentProvider.validationStatus ? `is-${currentProvider.validationStatus}` : 'is-idle'">
            <i class="fa-solid fa-shield-halved"></i>
            <span>{{ providerValidationChip }}</span>
          </span>
          <span class="oxc-context-chip">
            <i class="fa-solid fa-comments"></i>
            <span>{{ snapshot.conversationId ? (isZh ? '记忆已连接' : 'Conversation linked') : (isZh ? '全新会话' : 'Fresh session') }}</span>
          </span>
          <span v-if="settings.memoryEnabled" class="oxc-context-chip is-feature">
            <i class="fa-solid fa-brain"></i>
            <span>{{ isZh ? '长期记忆开启' : 'Memory enabled' }}</span>
          </span>
          <span v-if="settings.webSearchEnabled" class="oxc-context-chip is-feature">
            <i class="fa-solid fa-globe"></i>
            <span>{{ isZh ? '联网搜索' : 'Web search' }}</span>
          </span>
          <span v-if="settings.interpreterEnabled" class="oxc-context-chip is-feature">
            <i class="fa-solid fa-code"></i>
            <span>{{ isZh ? '代码解释器' : 'Interpreter' }}</span>
          </span>

          <!-- Git 分支切换 -->
          <div v-if="workspaceState.git && workspaceState.git.enabled" class="oxc-git-shell" @mousedown.stop @click.stop>
            <button
              type="button"
              class="oxc-context-chip is-git"
              @click="toggleGitMenu"
              :title="isZh ? '切换 Git 分支' : 'Switch Git branch'"
            >
              <i class="fa-solid fa-code-branch"></i>
              <span>{{ workspaceState.git.branch }}</span>
              <span v-if="workspaceState.git.dirty" class="oxc-git-dirty">●</span>
              <i class="fa-solid fa-chevron-down oxc-context-chip__caret"></i>
            </button>
            <transition name="oxc-pop">
              <div v-show="showGitMenu" class="oxc-popover oxc-popover--up oxc-popover--git">
                <div class="oxc-popover__head">
                  <strong>{{ isZh ? 'Git 分支' : 'Git Branches' }}</strong>
                  <small v-if="workspaceState.git.ahead || workspaceState.git.behind">
                    ↑{{ workspaceState.git.ahead }} ↓{{ workspaceState.git.behind }}
                  </small>
                </div>
                <button
                  v-for="b in (workspaceState.git.branches.length ? workspaceState.git.branches : [workspaceState.git.branch])"
                  :key="`git-${b}`"
                  type="button"
                  class="oxc-popover__option"
                  :class="{ 'is-active': b === workspaceState.git.branch }"
                  @click="selectGitBranch(b)"
                >
                  <i class="fa-solid fa-code-branch"></i>
                  <div class="oxc-popover__option-copy">
                    <strong>{{ b }}</strong>
                  </div>
                  <i v-if="b === workspaceState.git.branch" class="fa-solid fa-check oxc-popover__option-check"></i>
                </button>
              </div>
            </transition>
          </div>
        </div>
      </div>
    </div>
    </div><!-- /.oxc-chat-column -->

    <!-- ════════ Settings panel toggle (right edge handle) ════════ -->
    <button
      type="button"
      class="oxc-settings-toggle"
      :class="{ 'is-active': showSettingsPanel }"
      :title="showSettingsPanel ? (isZh ? '收起设置' : 'Hide settings') : (isZh ? '打开设置' : 'Open settings')"
      @click="handleToggleSettings"
    >
      <i :class="showSettingsPanel ? 'fa-solid fa-chevron-right' : 'fa-solid fa-chevron-left'"></i>
    </button>

    <!-- ════════ Settings panel ════════ -->
    <aside class="oxc-settings-panel" :class="{ 'is-open': showSettingsPanel }">
      <div class="oxc-settings-panel__header">
        <span class="oxc-settings-panel__title">{{ isZh ? '对话设置' : 'Chat settings' }}</span>
        <button type="button" class="oxc-settings-panel__close" @click="handleCloseSettings" :title="isZh ? '关闭' : 'Close'">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div class="oxc-settings-panel__body">

        <!-- Model selector -->
        <div class="oxc-setting-group">
          <label class="oxc-setting-group__label">{{ isZh ? '模型选择' : 'Model' }}</label>
          <div class="oxc-model-summary">
            <div class="oxc-model-summary__provider">
              <img v-if="settings.providerLogo" :src="settings.providerLogo" :alt="settings.providerName" class="oxc-model-summary__logo" />
              <span v-else class="oxc-model-summary__fallback">
                <i class="fa-solid fa-microchip"></i>
              </span>
              <div class="oxc-model-summary__copy">
                <strong>{{ settings.providerName }}</strong>
                <span>{{ settings.providerSummary || (isZh ? '当前用于实时会话的模型服务商' : 'The provider currently used for live chat') }}</span>
              </div>
            </div>
            <div class="oxc-model-summary__meta-row">
              <div class="oxc-model-summary__model">{{ settings.model }}</div>
              <button
                v-if="currentProvider && !currentProvider.isTemplate"
                type="button"
                class="oxc-provider-validate-btn"
                :disabled="currentProvider.isValidating"
                @click="handleValidateProvider(currentProvider.id)"
              >
                <i :class="currentProvider.isValidating ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-vial-circle-check'"></i>
                <span>{{ currentProvider.isValidating ? (isZh ? '验证中' : 'Validating') : (isZh ? '验证' : 'Validate') }}</span>
              </button>
            </div>
          </div>
          <button type="button" class="oxc-model-button" @click="handleOpenFullModelConfig">
            <span class="oxc-model-button__name">
              <i class="fa-solid fa-sliders"></i>
              <span>{{ isZh ? '打开完整模型配置' : 'Open full model config' }}</span>
            </span>
            <i class="fa-solid fa-arrow-up-right-from-square oxc-model-button__arrow"></i>
          </button>
          <div v-if="modelProviderCards.length" class="oxc-provider-picker">
            <div class="oxc-provider-picker__head">
              <span>{{ isZh ? '可用服务商' : 'Available providers' }}</span>
              <small>{{ settings.configuredProviderCount }} {{ isZh ? '个已配置' : 'configured' }}</small>
            </div>
            <div class="oxc-provider-grid">
              <button
                v-for="provider in modelProviderCards"
                :key="provider.id"
                type="button"
                class="oxc-provider-card"
                :class="{ 'is-active': provider.isActive, 'is-template': provider.isTemplate }"
                @click="handleSelectProviderCard(provider)"
              >
                <div class="oxc-provider-card__head">
                  <div class="oxc-provider-card__brand">
                    <img v-if="provider.logo" :src="provider.logo" :alt="provider.name" class="oxc-provider-card__logo" />
                    <span v-else class="oxc-provider-card__fallback"><i class="fa-solid fa-microchip"></i></span>
                    <div class="oxc-provider-card__title">
                      <strong>{{ provider.name }}</strong>
                      <small>{{ provider.validationStatus ? getProviderValidationText(provider) : provider.statusLabel }}</small>
                    </div>
                  </div>
                  <span v-if="provider.isActive" class="oxc-provider-card__active">{{ isZh ? '当前' : 'Current' }}</span>
                  <span v-else-if="provider.isTemplate" class="oxc-provider-card__template">{{ isZh ? '模板' : 'Template' }}</span>
                </div>
                <div class="oxc-provider-card__model">{{ provider.modelId || (isZh ? '未设置默认模型' : 'No default model') }}</div>
                <div class="oxc-provider-card__summary">{{ provider.summary || (provider.isTemplate ? (isZh ? '点击进入配置' : 'Open setup') : (isZh ? '点击切换到该服务商' : 'Switch this provider into the live chat runtime')) }}</div>
                <div v-if="provider.validationMessage" class="oxc-provider-card__validation">
                  {{ provider.validationMessage }}
                </div>
              </button>
            </div>
            <div v-if="currentProvider && !currentProvider.isTemplate && (currentProvider.validationStatus || currentProvider.validationMessage || (currentProvider.validationModels && currentProvider.validationModels.length))" class="oxc-provider-diagnostics">
              <div class="oxc-provider-picker__head">
                <span>{{ isZh ? '当前服务商诊断' : 'Current provider diagnostics' }}</span>
                <small>{{ getProviderValidationText(currentProvider) }}</small>
              </div>
              <div v-if="currentProvider.validationMessage" class="oxc-provider-diagnostics__message">
                {{ currentProvider.validationMessage }}
              </div>
              <div v-if="currentProvider.validationModels && currentProvider.validationModels.length" class="oxc-provider-models__chips">
                <button
                  v-for="model in currentProvider.validationModels"
                  :key="`${currentProvider.id}-validated-${model.value}`"
                  type="button"
                  class="oxc-provider-model-chip"
                  :class="{ 'is-active': settings.model === model.value }"
                  @click="handleSelectProviderModel(currentProvider.id, model.value)"
                >
                  {{ model.label }}
                </button>
              </div>
            </div>
            <div v-if="currentProvider && currentProvider.models && currentProvider.models.length" class="oxc-provider-models">
              <div v-if="currentProvider.validationStatus || currentProvider.validationMessage || (currentProvider.validationChecks && currentProvider.validationChecks.length) || (currentProvider.validationModels && currentProvider.validationModels.length)" class="oxc-provider-diagnostics">
                <div class="oxc-provider-picker__head">
                  <span>{{ isZh ? '当前服务商诊断' : 'Current provider diagnostics' }}</span>
                  <small>{{ getProviderValidationText(currentProvider) }}</small>
                </div>
                <div class="oxc-provider-diagnostics__chips">
                  <span class="oxc-provider-diagnostics__chip" :class="{ 'is-on': currentProvider.apiKeyConfigured || currentProvider.apiKeyOptional }">
                    <i class="fa-solid fa-key"></i>
                    <span>{{ currentProvider.apiKeyConfigured || currentProvider.apiKeyOptional ? (isZh ? 'API Key 已就绪' : 'API key ready') : (isZh ? 'API Key 缺失' : 'API key missing') }}</span>
                  </span>
                  <span class="oxc-provider-diagnostics__chip" :class="{ 'is-on': currentProvider.matchedModel }">
                    <i class="fa-solid fa-circle-nodes"></i>
                    <span>{{ currentProvider.matchedModel ? (isZh ? '模型已匹配' : 'Model matched') : (isZh ? '模型待确认' : 'Model unresolved') }}</span>
                  </span>
                </div>
                <div v-if="currentProvider.validationMessage" class="oxc-provider-diagnostics__message">
                  {{ currentProvider.validationMessage }}
                </div>
                <div v-if="currentProvider.validationChecks && currentProvider.validationChecks.length" class="oxc-provider-checks">
                  <div
                    v-for="(check, index) in currentProvider.validationChecks"
                    :key="`${currentProvider.id}-check-${index}`"
                    class="oxc-provider-check"
                  >
                    <strong>{{ check.label || check.name || check.id || (isZh ? '检查项' : 'Check') }}</strong>
                    <span>{{ check.message || check.detail || check.status || '' }}</span>
                  </div>
                </div>
                <div v-if="currentProvider.validationModels && currentProvider.validationModels.length" class="oxc-provider-models__chips">
                  <button
                    v-for="model in currentProvider.validationModels"
                    :key="`${currentProvider.id}-validated-${model.value}`"
                    type="button"
                    class="oxc-provider-model-chip"
                    :class="{ 'is-active': settings.model === model.value }"
                    @click="handleSelectProviderModel(currentProvider.id, model.value)"
                  >
                    {{ model.label }}
                  </button>
                </div>
              </div>
              <div class="oxc-provider-picker__head">
                <span>{{ isZh ? '当前服务商模型' : 'Models in current provider' }}</span>
              </div>
              <div class="oxc-provider-models__chips">
                <button
                  v-for="model in currentProvider.models"
                  :key="`${currentProvider.id}-${model.value}`"
                  type="button"
                  class="oxc-provider-model-chip"
                  :class="{ 'is-active': settings.model === model.value }"
                  @click="handleSelectProviderModel(currentProvider.id, model.value)"
                >
                  {{ model.label }}
                </button>
              </div>
            </div>
          </div>
          <span class="oxc-setting-group__hint">{{ isZh ? '在这里直接切换当前实时会话的服务商和默认模型；需要补 API 地址或 Key 时，再打开完整配置。' : 'Switch the active provider and default model here. Open the full model config only when you need to edit endpoints or API keys.' }}</span>
        </div>

        <!-- Temperature slider -->
        <div class="oxc-setting-group">
          <label class="oxc-setting-group__label">{{ isZh ? '温度 (Temperature)' : 'Temperature' }}</label>
          <div class="oxc-slider-row">
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              :value="settings.temperature"
              @input="handleTemperatureInput"
            />
            <span class="oxc-slider-value">{{ temperatureValue }}</span>
          </div>
          <span class="oxc-setting-group__hint">{{ isZh ? '较低更精确，较高更有创意' : 'Lower = focused, higher = creative' }}</span>
        </div>

        <!-- Max tokens -->
        <div class="oxc-setting-group">
          <label class="oxc-setting-group__label">{{ isZh ? '最大输出长度' : 'Max output tokens' }}</label>
          <select class="oxc-select" :value="settings.maxTokens" @change="handleMaxTokensChange">
            <option v-for="opt in (settings.maxTokensOptions || [])" :key="opt" :value="opt">
              {{ opt.toLocaleString() }} tokens
            </option>
          </select>
        </div>

        <!-- System prompt -->
        <div class="oxc-setting-group">
          <label class="oxc-setting-group__label">{{ isZh ? '系统提示词' : 'System prompt' }}</label>
          <textarea
            class="oxc-textarea"
            :value="settings.systemPrompt"
            :placeholder="isZh ? '设定 AI 的角色和行为规则...' : 'Define the AI role and behavior rules...'"
            @input="handleSystemPromptInput"
          ></textarea>
        </div>

        <!-- Memory toggle -->
        <div class="oxc-setting-group" v-if="settings.memoryAvailable">
          <div class="oxc-toggle-row">
            <label class="oxc-setting-group__label">{{ isZh ? '长期记忆' : 'Long-term memory' }}</label>
            <label class="oxc-toggle">
              <input type="checkbox" :checked="settings.memoryEnabled" @change="handleToggleMemory" />
              <span class="oxc-toggle__slider"></span>
            </label>
          </div>
          <span class="oxc-setting-group__hint">{{ isZh ? '开启后 AI 会跨对话沉淀记忆条目' : 'When on, the assistant persists memory across chats' }}</span>
        </div>

        <!-- Interpreter toggle -->
        <div class="oxc-setting-group">
          <div class="oxc-toggle-row">
            <label class="oxc-setting-group__label">{{ isZh ? '代码解释器' : 'Code interpreter' }}</label>
            <label class="oxc-toggle">
              <input type="checkbox" :checked="settings.interpreterEnabled" @change="handleToggleInterpreter" />
              <span class="oxc-toggle__slider"></span>
            </label>
          </div>
          <span class="oxc-setting-group__hint">{{ isZh ? '允许 AI 在沙箱中执行代码' : 'Lets the assistant execute code in a sandbox' }}</span>
        </div>

      </div>
    </aside>

    <!-- Backdrop for settings panel on small screens -->
    <div
      v-if="showSettingsPanel"
      class="oxc-settings-backdrop"
      @click="handleCloseSettings"
    ></div>
  </div>
</template>

<style>
#openxnet-vite-chat-root {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.ox-vite-chat-shell,
.ox-vite-chat-shell * {
  box-sizing: border-box;
}

.ox-vite-chat-shell {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  display: flex;
  background: var(--ox-bg-base, #F8F9FB);
  color: var(--ox-text-primary, #1E293B);
  font-family: var(--ox-font-sans, 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif);
  overflow: hidden;
}

.oxc-chat-column {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* ─────────── Conversation panel (left) ─────────── */
.oxc-conversations {
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--ox-bg-surface, #FFFFFF);
  border-right: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  overflow: hidden;
}

.oxc-conversations__header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 12px;
}

.oxc-conversations__title {
  font: var(--ox-text-h3, 600 15px/20px var(--ox-font-sans));
  color: var(--ox-text-primary, #1E293B);
}

.oxc-conversations__new {
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 50%;
  background: var(--ox-accent-soft, rgba(91, 163, 197, 0.12));
  color: var(--ox-accent, #5BA3C5);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.oxc-conversations__new:hover {
  background: var(--ox-accent, #5BA3C5);
  color: #FFFFFF;
  transform: scale(1.05);
}

.oxc-conversations__header-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.oxc-conversations__collapse {
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--ox-text-muted, #94A3B8);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.oxc-conversations__collapse:hover {
  background: var(--ox-bg-surface-hover, #F1F3F9);
  color: var(--ox-text-primary, #1E293B);
}

/* 折叠态：左边缘的展开把手按钮 */
.oxc-conversations-handle {
  width: 16px;
  align-self: stretch;
  flex-shrink: 0;
  border: 0;
  border-right: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  background: var(--ox-bg-surface, #FFFFFF);
  color: var(--ox-text-muted, #94A3B8);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.oxc-conversations-handle:hover {
  background: var(--ox-bg-surface-hover, #F1F3F9);
  color: var(--ox-text-primary, #1E293B);
}

.oxc-conversations__tabs {
  flex-shrink: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  padding: 0 12px 8px;
}

.oxc-conversations__tab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 10px;
  border: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  border-radius: var(--ox-radius-sm, 8px);
  background: var(--ox-bg-input, #F4F5F9);
  color: var(--ox-text-secondary, #64748B);
  font-size: 12px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
  white-space: nowrap;
}

.oxc-conversations__tab:hover {
  background: var(--ox-bg-input-hover, #ECEEF5);
  color: var(--ox-text-primary, #1E293B);
}

.oxc-conversations__tab.is-active {
  background: var(--ox-accent-soft, rgba(91, 163, 197, 0.12));
  border-color: var(--ox-border-accent, rgba(91, 163, 197, 0.40));
  color: var(--ox-accent, #5BA3C5);
}

.oxc-conversations__tab i {
  font-size: 11px;
}

.oxc-conversations__search {
  flex-shrink: 0;
  position: relative;
  padding: 0 12px 12px;
}

.oxc-conversations__search > i {
  position: absolute;
  left: 24px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--ox-text-muted, #94A3B8);
  font-size: 12px;
  pointer-events: none;
}

.oxc-conversations__search input {
  width: 100%;
  height: 32px;
  padding: 0 14px 0 32px;
  border: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  border-radius: var(--ox-radius-full, 9999px);
  background: var(--ox-bg-input, #F4F5F9);
  color: var(--ox-text-primary, #1E293B);
  font-size: 13px;
  font-family: inherit;
  outline: none;
  transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.oxc-conversations__search input::placeholder {
  color: var(--ox-text-muted, #94A3B8);
}

.oxc-conversations__search input:focus {
  background: var(--ox-bg-surface, #FFFFFF);
  border-color: var(--ox-accent, #5BA3C5);
  box-shadow: var(--ox-shadow-glow, 0 0 0 3px rgba(91, 163, 197, 0.15));
}

.oxc-conversations__list {
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.oxc-conversation-item {
  min-width: 0;
  max-width: 100%;
  inline-size: 100%;
  overflow: hidden;
}

.oxc-conversation-item__head {
  min-width: 0;
  width: 100%;
  max-width: 100%;
}

.oxc-conversation-item__preview,
.oxc-conversation-item__meta {
  min-width: 0;
  max-width: 100%;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.oxc-conversations__empty {
  padding: 32px 16px;
  text-align: center;
  font-size: 12px;
  color: var(--ox-text-muted, #94A3B8);
}

.oxc-conversation-item {
  position: relative;
  width: 100%;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border: 0;
  border-radius: var(--ox-radius-sm, 8px);
  background: transparent;
  color: var(--ox-text-primary, #1E293B);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.oxc-conversation-item:hover {
  background: var(--ox-bg-surface-hover, #F1F3F9);
}

.oxc-conversation-item.is-active {
  background: var(--ox-accent-soft, rgba(91, 163, 197, 0.12));
}

.oxc-conversation-item__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.oxc-conversation-item__title {
  flex: 1;
  min-width: 0;
  max-width: 100%;
  font-size: 13px;
  font-weight: 600;
  color: var(--ox-text-primary, #1E293B);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.oxc-conversation-item.is-active .oxc-conversation-item__title {
  color: var(--ox-accent, #5BA3C5);
}

.oxc-conversation-item__delete,
.oxc-conversation-item__more {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  color: var(--ox-text-muted, #94A3B8);
  font-size: 11px;
  opacity: 0;
  transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
  flex-shrink: 0;
  cursor: pointer;
}

.oxc-conversation-item:hover .oxc-conversation-item__delete,
.oxc-conversation-item:hover .oxc-conversation-item__more {
  opacity: 1;
}

.oxc-conversation-item__delete:hover {
  background: var(--ox-error-soft, rgba(239, 68, 68, 0.10));
  color: var(--ox-error, #EF4444);
}

.oxc-conversation-item__more:hover {
  background: rgba(91, 163, 197, 0.12);
  color: var(--ox-accent, #5BA3C5);
}

/* ════════ 工作区 tab：项目列表 + 子会话 ════════ */
.oxc-workspace {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
  min-width: 0;
}

.oxc-workspace-project {
  min-width: 0;
}

.oxc-workspace-project__head {
  min-width: 0;
}

.oxc-workspace-project__body {
  min-width: 0;
  overflow: hidden;
}

.oxc-workspace__add {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  height: 34px;
  padding: 0 12px;
  border: 1px dashed rgba(91, 163, 197, 0.4);
  border-radius: 10px;
  background: rgba(91, 163, 197, 0.06);
  color: var(--ox-accent, #5BA3C5);
  font: 600 12px/1 var(--ox-font-sans, system-ui);
  cursor: pointer;
  transition: background 160ms ease, border-color 160ms ease, transform 160ms ease;
}

.oxc-workspace__add:hover {
  background: rgba(91, 163, 197, 0.12);
  border-color: var(--ox-accent, #5BA3C5);
  transform: translateY(-1px);
}

.oxc-workspace-project {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px 0;
}

.oxc-workspace-project__head {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  border-radius: 10px;
  background: var(--ox-bg-surface, #fff);
  cursor: pointer;
  text-align: left;
  transition: border-color 160ms ease, background 160ms ease;
}

.oxc-workspace-project__head:hover {
  border-color: rgba(91, 163, 197, 0.32);
  background: rgba(91, 163, 197, 0.04);
}

.oxc-workspace-project__head.is-active {
  border-color: rgba(91, 163, 197, 0.6);
  background: rgba(91, 163, 197, 0.08);
}

.oxc-workspace-project__icon {
  font-size: 14px;
  color: var(--ox-accent, #5BA3C5);
  flex-shrink: 0;
}

.oxc-workspace-project__copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.oxc-workspace-project__copy strong {
  font: 600 12px/1.3 var(--ox-font-sans, system-ui);
  color: var(--ox-text-primary, #1e293b);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.oxc-workspace-project__copy small {
  font: 400 10px/1.3 var(--ox-font-mono, 'JetBrains Mono', monospace);
  color: var(--ox-text-muted, #94a3b8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
  max-width: 100%;
}

.oxc-workspace-project__caret {
  font-size: 10px;
  color: var(--ox-text-muted, #94a3b8);
  transition: transform 160ms ease;
}

.oxc-workspace-project__caret.is-open {
  transform: rotate(180deg);
}

.oxc-workspace-project__body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-left: 10px;
  padding-left: 10px;
  border-left: 2px solid rgba(148, 163, 184, 0.18);
}

.oxc-conversation-item--nested {
  padding: 8px 10px;
  font-size: 12px;
}

.oxc-workspace-project__new {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 28px;
  padding: 0 10px;
  border: 1px dashed rgba(148, 163, 184, 0.32);
  border-radius: 8px;
  background: transparent;
  color: var(--ox-text-secondary, #475569);
  font: 500 11px/1 var(--ox-font-sans, system-ui);
  cursor: pointer;
  transition: border-color 160ms ease, color 160ms ease;
}

.oxc-workspace-project__new:hover {
  border-color: var(--ox-accent, #5BA3C5);
  color: var(--ox-accent, #5BA3C5);
}

/* ════════ 会话右键菜单 ════════ */
.oxc-conversation-menu {
  position: fixed;
  z-index: 200;
  min-width: 200px;
  padding: 6px;
  border-radius: 12px;
  background: var(--ox-bg-surface, #fff);
  border: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  box-shadow: 0 14px 36px rgba(15, 23, 42, 0.18);
}

.oxc-conversation-menu__item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: transparent;
  border-radius: 8px;
  color: var(--ox-text-secondary, #475569);
  font: 500 12px/1.3 var(--ox-font-sans, system-ui);
  cursor: pointer;
  text-align: left;
  transition: background 160ms ease, color 160ms ease;
}

.oxc-conversation-menu__item:hover {
  background: rgba(91, 163, 197, 0.10);
  color: var(--ox-text-primary, #1e293b);
}

.oxc-conversation-menu__item > i {
  width: 14px;
  color: var(--ox-accent, #5BA3C5);
  font-size: 12px;
}

.oxc-conversation-menu__item.is-danger {
  color: var(--ox-error, #ef4444);
}

.oxc-conversation-menu__item.is-danger:hover {
  background: rgba(239, 68, 68, 0.08);
  color: #dc2626;
}

.oxc-conversation-menu__item.is-danger > i {
  color: var(--ox-error, #ef4444);
}

.oxc-conversation-menu__divider {
  height: 1px;
  background: var(--ox-border, rgba(15, 23, 42, 0.08));
  margin: 4px 6px;
}

/* ════════ 项目欢迎居中（Codex 风） ════════ */
.oxc-project-welcome {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  padding: 32px;
}

.oxc-project-welcome__inner {
  max-width: 720px;
  text-align: center;
}

.oxc-project-welcome__title {
  margin: 0 0 12px;
  font: 700 24px/1.3 var(--ox-font-sans, system-ui);
  color: var(--ox-text-primary, #1e293b);
}

.oxc-project-welcome__path {
  margin: 0;
  font: 500 12px/1.4 var(--ox-font-mono, 'JetBrains Mono', monospace);
  color: var(--ox-text-muted, #94a3b8);
  word-break: break-all;
}

/* ════════ 输入框下方 chip 条（居中、无卡片样式） ════════ */
.oxc-context-strip--below {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 6px 10px;
  padding: 10px 4px 0;
  margin: 6px auto 0;
  width: 100%;
  background: transparent;
  border: none;
}

.oxc-context-strip--below .oxc-context-chip {
  font-size: 11px;
  background: transparent !important;
  border: none !important;
  padding: 2px 4px !important;
  box-shadow: none !important;
}

.oxc-context-strip--below .oxc-context-chip > i {
  color: var(--ox-text-muted, #94a3b8);
}

.oxc-context-strip--below .oxc-context-chip.is-feature > i {
  color: var(--ox-accent, #5BA3C5);
}

/* ════════ Git chip ════════ */
.oxc-git-shell {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.oxc-context-chip.is-git {
  cursor: pointer;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.94), rgba(241, 245, 249, 0.92));
  border-color: rgba(91, 163, 197, 0.32);
  color: var(--ox-accent, #5BA3C5);
}

.oxc-context-chip.is-git:hover {
  background: rgba(91, 163, 197, 0.10);
}

.oxc-context-chip__caret {
  font-size: 9px;
  opacity: 0.6;
  margin-left: 2px;
}

.oxc-git-dirty {
  color: #f59e0b;
  font-size: 9px;
  margin-left: 2px;
}

.oxc-popover--git { min-width: 220px; }

.oxc-conversation-item__preview {
  display: block;
  width: 100%;
  max-width: 100%;
  font-size: 12px;
  color: var(--ox-text-muted, #94A3B8);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.oxc-conversation-item__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-width: 100%;
  overflow: hidden;
  font-size: 11px;
  color: var(--ox-text-secondary, #64748B);
  line-height: 1.35;
}

.oxc-conversation-item__meta span {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  min-height: 20px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(91, 163, 197, 0.08);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.oxc-conversation-item__time {
  font-size: 11px;
  color: var(--ox-text-muted, #94A3B8);
}

/* ─────────── Header ─────────── */
.oxc-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  background: var(--ox-bg-surface, #FFFFFF);
}

.oxc-header__left,
.oxc-header__right {
  display: flex;
  align-items: center;
}

.oxc-header__left {
  gap: 12px;
  min-width: 0;
}

.oxc-header__title {
  margin: 0;
  font: var(--ox-text-h3, 600 15px/20px var(--ox-font-sans));
  color: var(--ox-text-primary, #1E293B);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.oxc-header__model {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 12px;
  border: 0;
  border-radius: var(--ox-radius-full, 9999px);
  background: var(--ox-bg-input, #F4F5F9);
  color: var(--ox-text-secondary, #64748B);
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
  transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
  min-width: 0;
  max-width: 320px;
}

.oxc-header__model:hover {
  background: var(--ox-bg-input-hover, #ECEEF5);
  color: var(--ox-text-primary, #1E293B);
}

.oxc-header__model i {
  font-size: 10px;
  flex-shrink: 0;
}

.oxc-header__model span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.oxc-header__status {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--ox-success, #22C55E);
  box-shadow: 0 0 0 4px var(--ox-success-soft, rgba(34, 197, 94, 0.10));
  flex-shrink: 0;
}

.oxc-header__right {
  gap: 4px;
}

.oxc-icon-btn {
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: var(--ox-radius-sm, 8px);
  background: transparent;
  color: var(--ox-text-secondary, #64748B);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
  font-family: inherit;
}

.oxc-icon-btn:hover {
  background: var(--ox-bg-surface-hover, #F1F3F9);
  color: var(--ox-text-primary, #1E293B);
}

.oxc-icon-btn.is-active {
  background: var(--ox-accent-soft, rgba(91, 163, 197, 0.12));
  color: var(--ox-accent, #5BA3C5);
}

.oxc-quest-shell {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.oxc-quest-trigger {
  position: relative;
}

.oxc-quest-trigger.is-ready {
  color: var(--ox-success, #22C55E);
}

.oxc-quest-trigger__dot {
  position: absolute;
  right: 7px;
  bottom: 7px;
  width: 7px;
  height: 7px;
  border: 2px solid var(--ox-bg-surface, #FFFFFF);
  border-radius: 999px;
  background: var(--ox-text-muted, #94A3B8);
}

.oxc-quest-trigger__dot.is-ready {
  background: var(--ox-success, #22C55E);
}

.oxc-quest-trigger__dot.is-checking {
  background: var(--ox-warning, #F59E0B);
}

.oxc-quest-trigger__dot.is-offline {
  background: var(--ox-text-muted, #94A3B8);
}

.oxc-quest-panel {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  z-index: 220;
  width: min(380px, calc(100vw - 28px));
  border: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  border-radius: 8px;
  background: var(--ox-bg-surface, #FFFFFF);
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.22);
  color: var(--ox-text-primary, #1E293B);
  overflow: hidden;
}

.oxc-quest-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px;
  border-bottom: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  background: linear-gradient(135deg, rgba(91, 163, 197, 0.10), rgba(34, 197, 94, 0.08));
}

.oxc-quest-panel__title {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.oxc-quest-panel__title > i {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.08);
  color: var(--ox-accent, #5BA3C5);
  flex-shrink: 0;
}

.oxc-quest-panel__title div {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.oxc-quest-panel__title strong {
  font-size: 13px;
  line-height: 1.2;
  color: var(--ox-text-primary, #1E293B);
}

.oxc-quest-panel__title span {
  font-size: 11px;
  color: var(--ox-text-secondary, #64748B);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.oxc-quest-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.16);
  color: var(--ox-text-secondary, #64748B);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.oxc-quest-status > span {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: currentColor;
}

.oxc-quest-status.is-ready {
  background: rgba(34, 197, 94, 0.14);
  color: var(--ox-success, #22C55E);
}

.oxc-quest-status.is-checking {
  background: rgba(245, 158, 11, 0.16);
  color: var(--ox-warning, #F59E0B);
}

.oxc-quest-panel__body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
}

.oxc-quest-card {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 10px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 8px;
  background: rgba(248, 250, 252, 0.72);
}

.oxc-quest-card label {
  font-size: 11px;
  font-weight: 700;
  color: var(--ox-text-secondary, #64748B);
}

.oxc-quest-url {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.oxc-quest-url span {
  flex: 1;
  min-width: 0;
  padding: 8px 10px;
  border-radius: 7px;
  background: var(--ox-bg-input, #F4F5F9);
  color: var(--ox-text-primary, #1E293B);
  font-family: var(--ox-font-mono, "JetBrains Mono", monospace);
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.oxc-quest-url button,
.oxc-quest-lan-item {
  border: 0;
  border-radius: 7px;
  background: rgba(91, 163, 197, 0.12);
  color: var(--ox-accent, #5BA3C5);
  cursor: pointer;
  transition: background 150ms ease, transform 150ms ease;
}

.oxc-quest-url button {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
}

.oxc-quest-url button:hover,
.oxc-quest-lan-item:hover {
  background: rgba(91, 163, 197, 0.20);
  transform: translateY(-1px);
}

.oxc-quest-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.oxc-quest-metric {
  min-width: 0;
  padding: 10px;
  border-radius: 8px;
  background: var(--ox-bg-input, #F4F5F9);
}

.oxc-quest-metric span {
  display: block;
  margin-bottom: 5px;
  font-size: 11px;
  color: var(--ox-text-muted, #94A3B8);
}

.oxc-quest-metric strong {
  display: block;
  min-width: 0;
  font-size: 12px;
  color: var(--ox-text-primary, #1E293B);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.oxc-quest-lan-list {
  display: grid;
  gap: 6px;
}

.oxc-quest-hardware-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.oxc-quest-hardware-item {
  min-width: 0;
  min-height: 34px;
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr);
  grid-template-rows: auto auto;
  column-gap: 7px;
  align-items: center;
  padding: 7px 8px;
  border-radius: 7px;
  background: var(--ox-bg-input, #F4F5F9);
  color: var(--ox-text-secondary, #64748B);
}

.oxc-quest-hardware-item i {
  grid-row: 1 / span 2;
  font-size: 12px;
  color: var(--ox-text-muted, #94A3B8);
}

.oxc-quest-hardware-item span,
.oxc-quest-hardware-item strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.oxc-quest-hardware-item span {
  font-size: 11px;
  color: var(--ox-text-secondary, #64748B);
}

.oxc-quest-hardware-item strong {
  font-size: 11px;
  color: var(--ox-text-primary, #1E293B);
}

.oxc-quest-hardware-item.is-ready i,
.oxc-quest-hardware-item.is-ready strong {
  color: var(--ox-success, #22C55E);
}

.oxc-quest-hardware-item.is-planned i,
.oxc-quest-hardware-item.is-planned strong {
  color: var(--ox-warning, #F59E0B);
}

.oxc-quest-hardware-item.is-offline i,
.oxc-quest-hardware-item.is-offline strong {
  color: var(--ox-text-muted, #94A3B8);
}

.oxc-quest-lan-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
  padding: 8px 10px;
  text-align: left;
}

.oxc-quest-lan-item span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--ox-font-mono, "JetBrains Mono", monospace);
  font-size: 11px;
}

.oxc-quest-empty {
  margin: 0;
  color: var(--ox-text-muted, #94A3B8);
  font-size: 12px;
  line-height: 1.45;
}

.oxc-quest-panel__actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  background: rgba(248, 250, 252, 0.72);
}

.oxc-quest-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-width: 0;
  height: 34px;
  border: 0;
  border-radius: 8px;
  background: var(--ox-bg-input, #F4F5F9);
  color: var(--ox-text-secondary, #64748B);
  font: 700 12px/1 var(--ox-font-sans, system-ui);
  cursor: pointer;
  transition: background 150ms ease, color 150ms ease;
}

.oxc-quest-action:hover:not(:disabled) {
  background: var(--ox-accent, #5BA3C5);
  color: #FFFFFF;
}

.oxc-quest-action:disabled {
  cursor: default;
  opacity: 0.7;
}

.oxc-context-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 20px 0;
  background: var(--ox-bg-surface, #FFFFFF);
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
}

.oxc-context-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: var(--ox-bg-input, #F4F5F9);
  color: var(--ox-text-secondary, #64748B);
  font-size: 12px;
}

.oxc-context-chip.is-provider,
.oxc-context-chip.is-model,
.oxc-context-chip.is-feature {
  background: rgba(91, 163, 197, 0.08);
}

.oxc-context-chip.is-success {
  background: rgba(34, 197, 94, 0.12);
  color: var(--ox-success, #22C55E);
}

.oxc-context-chip.is-warning {
  background: rgba(245, 158, 11, 0.14);
  color: var(--ox-warning, #F59E0B);
}

.oxc-context-chip.is-blocked,
.oxc-context-chip.is-error {
  background: rgba(239, 68, 68, 0.12);
  color: var(--ox-error, #EF4444);
}

.oxc-context-chip.is-idle {
  background: rgba(148, 163, 184, 0.12);
}

.oxc-status-banner {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 12px 20px 0;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(91, 163, 197, 0.1);
  color: var(--ox-accent, #5BA3C5);
  font-size: 13px;
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.06);
}

.oxc-status-banner.is-success {
  background: rgba(34, 197, 94, 0.12);
  color: var(--ox-success, #22C55E);
}

.oxc-status-banner.is-warning {
  background: rgba(245, 158, 11, 0.14);
  color: var(--ox-warning, #F59E0B);
}

.oxc-status-enter-active,
.oxc-status-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}

.oxc-status-enter-from,
.oxc-status-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* ─────────── Main / Stream ─────────── */
.oxc-main {
  flex: 1;
  position: relative;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.oxc-stream {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 24px 24px calc(var(--oxc-composer-space, 160px) + 24px);
  scroll-padding-bottom: calc(var(--oxc-composer-space, 160px) + 24px);
  overscroll-behavior: contain;
  overflow-anchor: none;
}

.oxc-stream__inner {
  max-width: 760px;
  min-height: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  overflow-anchor: none;
}

/* Empty state */
.oxc-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 80px 24px 0;
  gap: 12px;
  color: var(--ox-text-muted, #94A3B8);
}

.oxc-empty__icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--ox-accent-soft, rgba(91, 163, 197, 0.12));
  color: var(--ox-accent, #5BA3C5);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.oxc-empty h2 {
  margin: 0;
  font: var(--ox-text-h2, 600 18px/24px var(--ox-font-sans));
  color: var(--ox-text-primary, #1E293B);
}

.oxc-empty p {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  max-width: 360px;
}

/* Message rows */
.oxc-msg {
  display: flex;
  gap: 12px;
  max-width: 100%;
  animation: oxc-fade-in-up 250ms cubic-bezier(0.25, 0.1, 0.25, 1) both;
}

.oxc-msg.is-streaming {
  animation: none;
}

.oxc-msg + .oxc-msg.is-same-role {
  margin-top: 12px;
}

.oxc-msg + .oxc-msg:not(.is-same-role) {
  margin-top: 20px;
}

.oxc-msg:first-child {
  margin-top: 0;
}

.oxc-msg.is-user {
  flex-direction: row-reverse;
}

.oxc-msg.is-ai {
  flex-direction: row;
  align-items: flex-start;
}

.oxc-msg__avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--ox-accent-gradient, linear-gradient(135deg, #5BA3C5, #7BB8D4));
  display: flex;
  align-items: center;
  justify-content: center;
  color: #FFFFFF;
  font-size: 10px;
  font-weight: 700;
  flex-shrink: 0;
  margin-top: 2px;
  overflow: hidden;
  letter-spacing: 0;
  line-height: 1;
}

.oxc-msg__avatar > img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.oxc-msg__avatar > span {
  width: 100%;
  height: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 3px;
  text-align: center;
  line-height: 1.05;
  overflow-wrap: anywhere;
}

.oxc-msg.is-ai.is-same-role .oxc-msg__avatar {
  visibility: hidden;
}

.oxc-msg__content {
  display: flex;
  flex-direction: column;
  flex: 1 1 0;
  min-width: 0;
}

.oxc-msg.is-user .oxc-msg__content {
  align-items: flex-end;
}

.oxc-msg__bubble {
  /* 最大宽度顶到聊天列容器边界（留 24px 防止贴右），让长上下文
     横向铺开、减少纵向滚屏。短消息自动收缩到内容大小。
     用户气泡和 AI 气泡共用同样规则，长用户消息也能铺到聊天边界。 */
  max-width: calc(100% - 24px);
  width: fit-content;
  padding: 12px 18px;
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.oxc-msg__bubble--user {
  background: linear-gradient(135deg, #5BA3C5, #7BB8D4);
  color: #FFFFFF;
  border-radius: 16px 16px 4px 16px;
  box-shadow: 0 2px 8px rgba(91, 163, 197, 0.20);
}

.oxc-msg__bubble--ai {
  background: var(--ox-bg-surface, #FFFFFF);
  border: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  border-radius: 16px 16px 16px 4px;
  color: var(--ox-text-primary, #1E293B);
  box-shadow: var(--ox-shadow-xs, 0 1px 1px rgba(15, 23, 42, 0.03));
}

.oxc-msg.is-streaming .oxc-msg__bubble--ai {
  transition: none;
}

.oxc-msg__bubble--typing {
  padding: 14px 20px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.oxc-typing-dots {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.oxc-typing-dots span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ox-text-muted, #94A3B8);
  animation: oxc-typing-dot 1.4s infinite both;
}

.oxc-typing-dots span:nth-child(2) { animation-delay: 0.2s; }
.oxc-typing-dots span:nth-child(3) { animation-delay: 0.4s; }

.oxc-msg__time {
  margin-top: 4px;
  padding: 0 4px;
  font-size: 12px;
  color: var(--ox-text-muted, #94A3B8);
  line-height: 1.2;
}

.oxc-activity {
  width: min(100%, 720px);
  margin: 0 0 12px;
  padding: 0 0 12px;
  border-bottom: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  color: var(--ox-text-muted, #94A3B8);
  font-size: 13px;
  line-height: 1.55;
}

.oxc-activity__elapsed {
  margin-bottom: 8px;
  color: var(--ox-text-secondary, #64748B);
  font-weight: 500;
}

.oxc-activity__steps {
  display: grid;
  gap: 7px;
}

.oxc-activity__step {
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 6px;
  color: var(--ox-text-muted, #94A3B8);
}

.oxc-activity__verb {
  flex-shrink: 0;
  color: var(--ox-text-secondary, #64748B);
}

.oxc-activity__title,
.oxc-activity__detail {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.oxc-activity__title {
  color: var(--ox-text-muted, #94A3B8);
}

.oxc-activity__duration {
  flex-shrink: 0;
  color: var(--ox-text-muted, #94A3B8);
}

.oxc-activity__detail {
  color: var(--ox-text-muted, #94A3B8);
  opacity: 0.86;
}

.oxc-activity__step.is-running .oxc-activity__verb,
.oxc-activity.is-active .oxc-activity__step.is-thinking .oxc-activity__verb {
  color: var(--ox-accent, #5BA3C5);
}

.oxc-activity__step.is-error .oxc-activity__verb,
.oxc-activity__step.is-error .oxc-activity__title {
  color: var(--ox-error, #EF4444);
}

.oxc-msg.is-user .oxc-msg__time {
  text-align: right;
}

.oxc-msg.is-ai .oxc-msg__time {
  margin-left: 40px;
}

/* Markdown content inside AI bubble */
.oxc-msg__bubble--ai.markdown-body {
  background: var(--ox-bg-surface, #FFFFFF);
  color: var(--ox-text-primary, #1E293B);
  font-size: 14px;
}

.oxc-msg__bubble--ai.markdown-body :deep(h4),
.oxc-msg__bubble--ai.markdown-body h4 {
  font: var(--ox-text-h3, 600 15px/20px var(--ox-font-sans));
  color: var(--ox-text-primary, #1E293B);
  margin: 0 0 8px;
}

.oxc-msg__bubble--ai.markdown-body :deep(p),
.oxc-msg__bubble--ai.markdown-body p {
  margin: 0 0 8px;
}

.oxc-msg__bubble--ai.markdown-body :deep(p:last-child),
.oxc-msg__bubble--ai.markdown-body p:last-child {
  margin-bottom: 0;
}

.oxc-msg__bubble--ai.markdown-body :deep(ul),
.oxc-msg__bubble--ai.markdown-body :deep(ol),
.oxc-msg__bubble--ai.markdown-body ul,
.oxc-msg__bubble--ai.markdown-body ol {
  margin: 8px 0;
  padding-left: 20px;
}

.oxc-msg__bubble--ai.markdown-body :deep(li),
.oxc-msg__bubble--ai.markdown-body li {
  margin-bottom: 4px;
  line-height: 1.6;
}

.oxc-msg__bubble--ai.markdown-body :deep(code),
.oxc-msg__bubble--ai.markdown-body code {
  background: rgba(91, 163, 197, 0.08);
  padding: 1px 6px;
  border-radius: 4px;
  font-family: var(--ox-font-mono, 'JetBrains Mono', monospace);
  font-size: 12.5px;
  color: var(--ox-accent, #5BA3C5);
}

.oxc-msg__bubble--ai.markdown-body :deep(pre),
.oxc-msg__bubble--ai.markdown-body pre {
  background: var(--ox-bg-input, #F4F5F9);
  border-radius: 6px;
  padding: 12px 14px;
  font-family: var(--ox-font-mono, 'JetBrains Mono', monospace);
  font-size: 12.5px;
  line-height: 1.65;
  color: var(--ox-text-primary, #1E293B);
  overflow-x: auto;
  margin: 12px 0;
}

.oxc-msg__bubble--ai.markdown-body :deep(pre):last-child,
.oxc-msg__bubble--ai.markdown-body pre:last-child {
  margin-bottom: 0;
}

.oxc-msg__bubble--ai.markdown-body :deep(pre code),
.oxc-msg__bubble--ai.markdown-body pre code {
  background: transparent;
  padding: 0;
  color: inherit;
}

.oxc-msg__bubble--user :deep(code),
.oxc-msg__bubble--user code {
  background: rgba(255, 255, 255, 0.20);
  color: #FFFFFF;
}

/* ─────────── Input Area ─────────── */
.oxc-input-wrapper {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 0 24px 20px;
  background: linear-gradient(to top, var(--ox-bg-base, #F8F9FB) 70%, transparent);
  z-index: 10;
  pointer-events: none;
}

.oxc-input-card {
  max-width: 760px;
  margin: 0 auto;
  background: var(--ox-bg-surface, #FFFFFF);
  border: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  border-radius: var(--ox-radius-lg, 16px);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);
  padding: 10px 10px 8px;
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: border-color 150ms cubic-bezier(0.25, 0.1, 0.25, 1),
              box-shadow 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.oxc-attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 8px 4px;
}

.oxc-attachment {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.oxc-attachment.is-image {
  width: 56px;
  height: 56px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  background: var(--ox-bg-input, #F4F5F9);
}

.oxc-attachment__thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.oxc-attachment.is-file {
  max-width: 200px;
  padding: 6px 28px 6px 10px;
  border: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  border-radius: 999px;
  background: var(--ox-bg-input, #F4F5F9);
  font-size: 12px;
  color: var(--ox-text-secondary, #64748B);
}

.oxc-attachment__file-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--ox-text-muted, #94A3B8);
}

.oxc-attachment__file-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.oxc-attachment__remove {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 18px;
  height: 18px;
  border: 0;
  border-radius: 50%;
  background: var(--ox-text-secondary, #64748B);
  color: #FFFFFF;
  font-size: 9px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(15, 23, 42, 0.20);
  transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.oxc-attachment.is-file .oxc-attachment__remove {
  top: 50%;
  right: 6px;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  background: transparent;
  color: var(--ox-text-muted, #94A3B8);
  box-shadow: none;
}

.oxc-attachment__remove:hover {
  background: var(--ox-error, #EF4444);
  color: #FFFFFF;
  transform: scale(1.1);
}

.oxc-attachment.is-file .oxc-attachment__remove:hover {
  transform: translateY(-50%) scale(1.1);
}

.oxc-input-card:focus-within {
  border-color: var(--ox-border-accent, rgba(91, 163, 197, 0.40));
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08), var(--ox-shadow-glow, 0 0 0 3px rgba(91, 163, 197, 0.15));
}

.oxc-input-card__textarea {
  display: block;
  width: 100%;
  border: 0;
  background: transparent;
  padding: 12px 14px;
  font-size: 14px;
  font-family: inherit;
  color: var(--ox-text-primary, #1E293B);
  resize: none;
  outline: none;
  height: 48px;
  min-height: 48px;
  max-height: 168px;
  line-height: 1.45;
  overflow-y: hidden;
  scrollbar-width: thin;
}

.oxc-input-card__textarea::placeholder {
  color: var(--ox-text-muted, #94A3B8);
  line-height: 1.45;
}

.oxc-input-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 42px;
  padding: 0 4px 0;
  flex: 0 0 auto;
}

.oxc-input-toolbar__left,
.oxc-input-toolbar__right {
  display: flex;
  align-items: center;
}

.oxc-input-toolbar__left {
  gap: 2px;
}

.oxc-input-toolbar__right {
  gap: 8px;
}

/* ════════ Toolbar chips（权限模式 / 积分） ════════ */
.oxc-chip-shell {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.oxc-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: rgba(241, 245, 249, 0.7);
  color: var(--ox-text-secondary, #475569);
  font: 500 12px/1 var(--ox-font-sans, system-ui);
  cursor: pointer;
  transition: background 160ms ease, border-color 160ms ease, color 160ms ease, transform 160ms ease;
}

.oxc-chip:hover {
  background: rgba(91, 163, 197, 0.10);
  border-color: rgba(91, 163, 197, 0.32);
  color: var(--ox-text-primary, #1e293b);
}

.oxc-chip__label {
  white-space: nowrap;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.oxc-chip__caret {
  font-size: 9px;
  opacity: 0.5;
}

/* Permission chip 各模式色阶 */
.oxc-chip--permission > i:first-child {
  color: var(--ox-accent, #5BA3C5);
  font-size: 11px;
}
.oxc-chip--permission.is-plan {
  background: rgba(245, 158, 11, 0.12);
  border-color: rgba(245, 158, 11, 0.32);
  color: #b45309;
}
.oxc-chip--permission.is-plan > i:first-child { color: #d97706; }
.oxc-chip--permission.is-accept {
  background: rgba(34, 197, 94, 0.10);
  border-color: rgba(34, 197, 94, 0.30);
  color: #15803d;
}
.oxc-chip--permission.is-accept > i:first-child { color: #16a34a; }
.oxc-chip--permission.is-bypass {
  background: rgba(239, 68, 68, 0.10);
  border-color: rgba(239, 68, 68, 0.32);
  color: #b91c1c;
}
.oxc-chip--permission.is-bypass > i:first-child { color: #dc2626; }

/* Credits chip */
.oxc-chip--credits {
  background: linear-gradient(135deg, rgba(254, 243, 199, 0.7), rgba(255, 255, 255, 0.94));
  border-color: rgba(245, 158, 11, 0.32);
  color: #92400e;
}
.oxc-chip--credits > i:first-child { color: #d97706; font-size: 11px; }

/* ════════ Context window SVG ring ════════ */
.oxc-context-ring {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: transform 160ms ease;
}

.oxc-context-ring:hover { transform: scale(1.06); }

.oxc-context-ring__svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.oxc-context-ring__track {
  fill: none;
  stroke: rgba(148, 163, 184, 0.28);
  stroke-width: 2.5;
}

.oxc-context-ring__fill {
  fill: none;
  stroke: var(--ox-accent, #5BA3C5);
  stroke-width: 2.5;
  stroke-linecap: round;
  transition: stroke-dashoffset 320ms cubic-bezier(0.4, 0, 0.2, 1), stroke 200ms ease;
}

.oxc-context-ring.is-warn .oxc-context-ring__fill { stroke: #f59e0b; }
.oxc-context-ring.is-critical .oxc-context-ring__fill { stroke: #ef4444; animation: oxc-ring-pulse 1.4s ease-in-out infinite; }

@keyframes oxc-ring-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}

.oxc-context-ring__pct {
  position: relative;
  z-index: 1;
  font: 600 9px/1 var(--ox-font-mono, 'JetBrains Mono', monospace);
  color: var(--ox-text-secondary, #475569);
}

.oxc-context-ring.is-warn .oxc-context-ring__pct { color: #b45309; }
.oxc-context-ring.is-critical .oxc-context-ring__pct { color: #b91c1c; }

/* ════════ Popover (向上弹) ════════ */
.oxc-popover {
  position: absolute;
  bottom: calc(100% + 10px);
  right: 0;
  min-width: 240px;
  padding: 12px;
  border-radius: 14px;
  background: var(--ox-bg-surface, #fff);
  border: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  box-shadow: 0 14px 32px rgba(15, 23, 42, 0.18);
  z-index: 60;
}

.oxc-popover--up::after {
  content: '';
  position: absolute;
  bottom: -6px;
  right: 14px;
  width: 12px;
  height: 12px;
  background: var(--ox-bg-surface, #fff);
  border-right: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  border-bottom: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  transform: rotate(45deg);
}

.oxc-popover__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px dashed rgba(148, 163, 184, 0.22);
  font: 700 12px/1.4 var(--ox-font-sans, system-ui);
  color: var(--ox-text-primary, #1e293b);
}

.oxc-popover__head small {
  font: 500 11px/1.4 var(--ox-font-sans, system-ui);
  color: var(--ox-text-muted, #94a3b8);
  margin-right: auto;
}

.oxc-popover__refresh {
  width: 24px;
  height: 24px;
  border: 1px solid rgba(148, 163, 184, 0.32);
  background: var(--ox-bg-elev, rgba(255, 255, 255, 0.7));
  color: var(--ox-text-secondary, #64748b);
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 120ms ease, background 120ms ease, color 120ms ease;
  flex-shrink: 0;
}
.oxc-popover__refresh:hover:not(:disabled) {
  background: var(--ox-accent-soft, rgba(91, 163, 197, 0.14));
  color: var(--ox-accent, #5BA3C5);
  transform: rotate(60deg);
}
.oxc-popover__refresh:disabled { opacity: 0.55; cursor: not-allowed; }
.oxc-popover__refresh.is-spinning i { animation: oxc-credits-spin 0.85s linear infinite; }
@keyframes oxc-credits-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.oxc-popover__option {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  background: transparent;
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  transition: background 160ms ease;
}

.oxc-popover__option:hover {
  background: rgba(91, 163, 197, 0.10);
}

.oxc-popover__option.is-active {
  background: rgba(91, 163, 197, 0.14);
}

.oxc-popover__option > i:first-child {
  width: 20px;
  font-size: 13px;
  color: var(--ox-accent, #5BA3C5);
  margin-top: 2px;
}

.oxc-popover__option-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.oxc-popover__option-copy strong {
  font: 600 12px/1.3 var(--ox-font-sans, system-ui);
  color: var(--ox-text-primary, #1e293b);
}

.oxc-popover__option-copy small {
  font: 400 11px/1.45 var(--ox-font-sans, system-ui);
  color: var(--ox-text-muted, #64748b);
}

.oxc-popover__option-check {
  font-size: 11px;
  color: var(--ox-accent, #5BA3C5);
  margin-top: 4px;
}

.oxc-popover__cta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  margin-top: 10px;
  padding: 8px 12px;
  border: none;
  border-radius: 10px;
  background: var(--ox-accent, #5BA3C5);
  color: #fff;
  font: 600 12px/1 var(--ox-font-sans, system-ui);
  cursor: pointer;
  transition: background 160ms ease;
}

.oxc-popover__cta:hover {
  background: #4A93B8;
}

.oxc-popover--role-card {
  left: 0;
  right: auto;
  width: min(320px, calc(100vw - 32px));
}

.oxc-popover--role-card::after {
  left: 14px;
  right: auto;
}

.oxc-role-card-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 220px;
  overflow-y: auto;
  padding-right: 2px;
}

.oxc-role-card-option {
  align-items: center;
}

.oxc-role-card-avatar {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--ox-accent-soft, rgba(91, 163, 197, 0.12));
  color: #fff;
  font: 700 12px/1 var(--ox-font-sans, system-ui);
  letter-spacing: 0;
  overflow: hidden;
}

.oxc-role-card-avatar > img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.oxc-role-card-avatar > span {
  width: 100%;
  height: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 3px;
  text-align: center;
  line-height: 1.05;
  overflow-wrap: anywhere;
}

.oxc-role-card-tag {
  flex-shrink: 0;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.14);
  color: var(--ox-text-muted, #64748b);
  font: 600 10px/1.3 var(--ox-font-sans, system-ui);
}

.oxc-role-card-empty {
  padding: 14px 10px;
  border-radius: 10px;
  background: rgba(148, 163, 184, 0.10);
  color: var(--ox-text-muted, #64748b);
  text-align: center;
  font: 500 12px/1.5 var(--ox-font-sans, system-ui);
}

/* Context popover */
.oxc-popover--context { min-width: 300px; }

.oxc-context-bar {
  position: relative;
  width: 100%;
  height: 6px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.22);
  margin: 8px 0 12px;
  overflow: visible;
}

.oxc-context-bar__fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #5BA3C5, #7BB8D4);
  transition: width 320ms ease;
}

.oxc-context-bar__threshold {
  position: absolute;
  top: -3px;
  width: 2px;
  height: 12px;
  background: #f59e0b;
}

.oxc-context-bar__threshold > span {
  position: absolute;
  top: -16px;
  left: 50%;
  transform: translateX(-50%);
  font: 600 9px/1 var(--ox-font-mono, monospace);
  color: #d97706;
  white-space: nowrap;
}

.oxc-context-note {
  margin: 0 0 10px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(91, 163, 197, 0.08);
  font-size: 11px;
  line-height: 1.5;
  color: var(--ox-text-secondary, #475569);
}
.oxc-context-note i { color: var(--ox-accent, #5BA3C5); margin-right: 4px; }

.oxc-context-rows {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.oxc-context-rows > div {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
}
.oxc-context-rows > div span { color: var(--ox-text-muted, #94a3b8); }
.oxc-context-rows > div strong { color: var(--ox-text-primary, #1e293b); font-weight: 600; }

/* Credits popover */
.oxc-popover--credits { min-width: 280px; }

.oxc-credits-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.oxc-credits-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(241, 245, 249, 0.6);
}

.oxc-credits-item span {
  font-size: 10px;
  color: var(--ox-text-muted, #94a3b8);
  letter-spacing: 0.04em;
}

.oxc-credits-item strong {
  font: 700 14px/1.1 var(--ox-font-sans, system-ui);
  color: var(--ox-text-primary, #1e293b);
}

/* ════════ 积分不足横幅 ════════ */
.oxc-low-credits-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 0 10px;
  padding: 10px 14px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(254, 243, 199, 0.94), rgba(254, 215, 170, 0.86));
  border: 1px solid rgba(245, 158, 11, 0.42);
  color: #92400e;
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.12);
}

.oxc-low-credits-banner > i {
  font-size: 16px;
  color: #d97706;
  flex-shrink: 0;
}

.oxc-low-credits-banner__copy {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1;
  min-width: 0;
}

.oxc-low-credits-banner__copy strong {
  font: 700 12px/1.3 var(--ox-font-sans, system-ui);
  color: #78350f;
}

.oxc-low-credits-banner__copy span {
  font: 500 11px/1.4 var(--ox-font-sans, system-ui);
  color: #92400e;
}

.oxc-low-credits-banner__cta {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 10px;
  border: 1px solid rgba(245, 158, 11, 0.6);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.6);
  color: #b45309;
  font: 600 11px/1 var(--ox-font-sans, system-ui);
  cursor: pointer;
  transition: background 160ms ease, border-color 160ms ease;
}

.oxc-low-credits-banner__cta:hover {
  background: #fff;
  border-color: #d97706;
}

.oxc-low-credits-banner__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  background: transparent;
  color: rgba(146, 64, 14, 0.66);
  border-radius: 6px;
  cursor: pointer;
  font-size: 11px;
  transition: background 160ms ease, color 160ms ease;
}

.oxc-low-credits-banner__close:hover {
  background: rgba(245, 158, 11, 0.18);
  color: #78350f;
}

html[data-theme="dark"] .oxc-low-credits-banner,
html[data-theme="midnight"] .oxc-low-credits-banner {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.16), rgba(180, 83, 9, 0.20));
  border-color: rgba(245, 158, 11, 0.44);
  color: #fed7aa;
}

html[data-theme="dark"] .oxc-low-credits-banner__copy strong,
html[data-theme="midnight"] .oxc-low-credits-banner__copy strong {
  color: #fed7aa;
}

html[data-theme="dark"] .oxc-low-credits-banner__copy span,
html[data-theme="midnight"] .oxc-low-credits-banner__copy span {
  color: #fdba74;
}

html[data-theme="dark"] .oxc-low-credits-banner__cta,
html[data-theme="midnight"] .oxc-low-credits-banner__cta {
  background: rgba(245, 158, 11, 0.22);
  border-color: rgba(245, 158, 11, 0.5);
  color: #fed7aa;
}

html[data-theme="dark"] .oxc-low-credits-banner__cta:hover,
html[data-theme="midnight"] .oxc-low-credits-banner__cta:hover {
  background: rgba(245, 158, 11, 0.32);
}

html[data-theme="dark"] .oxc-low-credits-banner__close,
html[data-theme="midnight"] .oxc-low-credits-banner__close {
  color: rgba(254, 215, 170, 0.7);
}

html[data-theme="dark"] .oxc-low-credits-banner__close:hover,
html[data-theme="midnight"] .oxc-low-credits-banner__close:hover {
  background: rgba(245, 158, 11, 0.22);
  color: #fed7aa;
}

/* —— Dark theme: popover / credits / context ring 等 —— */
html[data-theme="dark"] .oxc-popover,
html[data-theme="midnight"] .oxc-popover,
html[data-theme="neon"] .oxc-popover,
html[data-theme="ink"] .oxc-popover {
  background: rgba(15, 23, 42, 0.97);
  border-color: rgba(148, 163, 184, 0.18);
  color: #e2e8f0;
}

html[data-theme="dark"] .oxc-popover--up::after,
html[data-theme="midnight"] .oxc-popover--up::after {
  background: rgba(15, 23, 42, 0.97);
  border-color: rgba(148, 163, 184, 0.18);
}

html[data-theme="dark"] .oxc-popover__head,
html[data-theme="midnight"] .oxc-popover__head {
  color: #e2e8f0;
  border-bottom-color: rgba(148, 163, 184, 0.18);
}

html[data-theme="dark"] .oxc-popover__head small,
html[data-theme="midnight"] .oxc-popover__head small {
  color: #94a3b8;
}

html[data-theme="dark"] .oxc-popover__option:hover,
html[data-theme="midnight"] .oxc-popover__option:hover {
  background: rgba(91, 163, 197, 0.2);
}

html[data-theme="dark"] .oxc-popover__option-copy strong,
html[data-theme="midnight"] .oxc-popover__option-copy strong {
  color: #e2e8f0;
}

html[data-theme="dark"] .oxc-popover__option-copy small,
html[data-theme="midnight"] .oxc-popover__option-copy small {
  color: #94a3b8;
}

html[data-theme="dark"] .oxc-role-card-avatar,
html[data-theme="midnight"] .oxc-role-card-avatar {
  background: rgba(91, 163, 197, 0.22);
  color: #8fd0ec;
}

html[data-theme="dark"] .oxc-role-card-tag,
html[data-theme="midnight"] .oxc-role-card-tag {
  background: rgba(148, 163, 184, 0.16);
  color: #cbd5e1;
}

html[data-theme="dark"] .oxc-role-card-empty,
html[data-theme="midnight"] .oxc-role-card-empty {
  background: rgba(51, 65, 85, 0.5);
  color: #94a3b8;
}

html[data-theme="dark"] .oxc-credits-item,
html[data-theme="midnight"] .oxc-credits-item {
  background: rgba(51, 65, 85, 0.5);
}

html[data-theme="dark"] .oxc-credits-item strong,
html[data-theme="midnight"] .oxc-credits-item strong {
  color: #f1f5f9;
}

html[data-theme="dark"] .oxc-credits-item span,
html[data-theme="midnight"] .oxc-credits-item span {
  color: #cbd5e1;
}

html[data-theme="dark"] .oxc-context-bar,
html[data-theme="midnight"] .oxc-context-bar {
  background: rgba(51, 65, 85, 0.6);
}

html[data-theme="dark"] .oxc-context-note,
html[data-theme="midnight"] .oxc-context-note {
  background: rgba(91, 163, 197, 0.16);
  color: #cbd5e1;
}

html[data-theme="dark"] .oxc-context-rows > div span,
html[data-theme="midnight"] .oxc-context-rows > div span {
  color: #94a3b8;
}

html[data-theme="dark"] .oxc-context-rows > div strong,
html[data-theme="midnight"] .oxc-context-rows > div strong {
  color: #f1f5f9;
}

html[data-theme="dark"] .oxc-context-ring__pct,
html[data-theme="midnight"] .oxc-context-ring__pct {
  color: #cbd5e1;
}

/* —— Dark theme: error 红框 —— */
html[data-theme="dark"] .highlight-block-error,
html[data-theme="midnight"] .highlight-block-error,
html[data-theme="neon"] .highlight-block-error,
html[data-theme="ink"] .highlight-block-error {
  background: rgba(239, 68, 68, 0.18);
  border-color: rgba(239, 68, 68, 0.42);
  color: #fecaca;
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.16);
}

html[data-theme="dark"] .highlight-block-error *,
html[data-theme="midnight"] .highlight-block-error * {
  color: #fecaca !important;
}

/* Pop transition */
.oxc-pop-enter-active, .oxc-pop-leave-active {
  transition: opacity 180ms ease, transform 180ms cubic-bezier(0.25, 0.1, 0.25, 1);
}
.oxc-pop-enter-from, .oxc-pop-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.96);
}

.oxc-toolbar-btn {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: var(--ox-radius-xs, 6px);
  background: transparent;
  color: var(--ox-text-muted, #94A3B8);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-family: inherit;
  transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.oxc-toolbar-btn:hover {
  background: var(--ox-bg-surface-hover, #F1F3F9);
  color: var(--ox-text-secondary, #64748B);
}

.oxc-toolbar-btn.is-active {
  background: var(--ox-accent-soft, rgba(91, 163, 197, 0.12));
  color: var(--ox-accent, #5BA3C5);
}

/* ─── More popover ─── */
.oxc-popover-wrap {
  position: relative;
  display: inline-flex;
}

.oxc-popover {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  min-width: 220px;
  padding: 6px;
  background: var(--ox-bg-surface, #FFFFFF);
  border: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  border-radius: var(--ox-radius-md, 12px);
  box-shadow: var(--ox-shadow-lg, 0 8px 24px rgba(15, 23, 42, 0.08));
  display: flex;
  flex-direction: column;
  gap: 2px;
  z-index: 30;
}

.oxc-popover-item {
  width: 100%;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 0;
  border-radius: var(--ox-radius-sm, 8px);
  background: transparent;
  color: var(--ox-text-secondary, #64748B);
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  text-align: left;
  transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.oxc-popover-item:hover {
  background: var(--ox-bg-surface-hover, #F1F3F9);
  color: var(--ox-text-primary, #1E293B);
}

.oxc-popover-item.is-active {
  color: var(--ox-accent, #5BA3C5);
  background: var(--ox-accent-soft, rgba(91, 163, 197, 0.12));
}

.oxc-popover-item__icon {
  width: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  flex-shrink: 0;
}

.oxc-popover-item__label {
  flex: 1;
  white-space: nowrap;
}

.oxc-popover-item__badge {
  display: inline-flex;
  align-items: center;
  padding: 1px 8px;
  border-radius: var(--ox-radius-full, 9999px);
  background: var(--ox-bg-surface-hover, #F1F3F9);
  color: var(--ox-text-muted, #94A3B8);
  font-size: 11px;
  font-weight: 500;
  flex-shrink: 0;
}

.oxc-popover-item__badge.is-on {
  background: var(--ox-success-soft, rgba(34, 197, 94, 0.10));
  color: var(--ox-success, #22C55E);
}

.oxc-pop-enter-active,
.oxc-pop-leave-active {
  transition: opacity 150ms cubic-bezier(0.25, 0.1, 0.25, 1),
              transform 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.oxc-pop-enter-from,
.oxc-pop-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

.oxc-char-count {
  font-size: 12px;
  color: var(--ox-text-muted, #94A3B8);
  user-select: none;
}

.oxc-char-count.is-warning { color: var(--ox-warning, #F59E0B); }
.oxc-char-count.is-error { color: var(--ox-error, #EF4444); }

.oxc-send-btn {
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 50%;
  background: linear-gradient(135deg, #5BA3C5, #7BB8D4);
  color: #FFFFFF;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(91, 163, 197, 0.25);
  transition: transform 150ms cubic-bezier(0.34, 1.56, 0.64, 1),
              box-shadow 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.oxc-send-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 16px rgba(91, 163, 197, 0.35);
}

.oxc-send-btn:active {
  transform: scale(0.95);
}

.oxc-send-btn.is-stopping {
  background: linear-gradient(135deg, #EF6B6B, #DC4D4D);
}

/* ─────────── Settings panel + toggle handle ─────────── */
.oxc-settings-toggle {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 56px;
  border: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  border-right: 0;
  border-radius: 8px 0 0 8px;
  background: var(--ox-bg-surface, #FFFFFF);
  color: var(--ox-text-muted, #94A3B8);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  z-index: 12;
  transition: right 250ms cubic-bezier(0.25, 0.1, 0.25, 1), color 150ms;
}

.oxc-settings-toggle:hover {
  color: var(--ox-text-primary, #1E293B);
}

.oxc-settings-toggle.is-active {
  right: 320px;
}

.oxc-settings-panel {
  position: absolute;
  top: 0;
  bottom: 0;
  right: -320px;
  width: 320px;
  background: var(--ox-bg-surface, #FFFFFF);
  border-left: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  box-shadow: var(--ox-shadow-xl, 0 16px 48px rgba(15, 23, 42, 0.10));
  z-index: 11;
  display: flex;
  flex-direction: column;
  transition: right 250ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.oxc-settings-panel.is-open {
  right: 0;
}

.oxc-settings-panel__header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
}

.oxc-settings-panel__title {
  font: var(--ox-text-h3, 600 15px/20px var(--ox-font-sans));
  color: var(--ox-text-primary, #1E293B);
}

.oxc-settings-panel__close {
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: var(--ox-radius-xs, 6px);
  background: transparent;
  color: var(--ox-text-muted, #94A3B8);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.oxc-settings-panel__close:hover {
  background: var(--ox-bg-surface-hover, #F1F3F9);
  color: var(--ox-text-primary, #1E293B);
}

.oxc-settings-panel__body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.oxc-setting-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.oxc-setting-group__label {
  font-size: 12px;
  font-weight: 500;
  color: var(--ox-text-secondary, #64748B);
}

.oxc-setting-group__hint {
  font-size: 12px;
  color: var(--ox-text-muted, #94A3B8);
  line-height: 1.5;
}

.oxc-model-button {
  width: 100%;
  padding: 10px 14px;
  background: var(--ox-bg-input, #F4F5F9);
  border: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  border-radius: var(--ox-radius-sm, 8px);
  color: var(--ox-text-primary, #1E293B);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-family: inherit;
  font-size: 14px;
  transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.oxc-model-button:hover {
  background: var(--ox-bg-input-hover, #ECEEF5);
  border-color: var(--ox-border-hover, rgba(15, 23, 42, 0.14));
}

.oxc-model-button__name {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.oxc-model-button__name span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.oxc-model-button__name i {
  color: var(--ox-accent, #5BA3C5);
  font-size: 12px;
  flex-shrink: 0;
}

.oxc-model-button__arrow {
  color: var(--ox-text-muted, #94A3B8);
  font-size: 11px;
  flex-shrink: 0;
}

.oxc-model-summary {
  display: grid;
  gap: 10px;
  padding: 12px 14px;
  border-radius: var(--ox-radius-sm, 8px);
  border: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(244, 245, 249, 0.94));
}

.oxc-model-summary__provider {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.oxc-model-summary__logo,
.oxc-model-summary__fallback {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(91, 163, 197, 0.12);
  color: var(--ox-accent, #5BA3C5);
  flex-shrink: 0;
}

.oxc-model-summary__logo {
  object-fit: contain;
  padding: 6px;
  background: #fff;
  border: 1px solid rgba(15, 23, 42, 0.06);
}

.oxc-model-summary__copy {
  min-width: 0;
  display: grid;
  gap: 3px;
}

.oxc-model-summary__copy strong {
  font-size: 14px;
  color: var(--ox-text-primary, #1E293B);
}

.oxc-model-summary__copy span {
  color: var(--ox-text-secondary, #64748B);
  font-size: 12px;
  line-height: 1.5;
}

.oxc-model-summary__model {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(91, 163, 197, 0.1);
  color: var(--ox-accent, #5BA3C5);
  font-size: 12px;
  font-weight: 700;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.oxc-model-summary__meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.oxc-provider-picker {
  display: grid;
  gap: 12px;
}

.oxc-provider-picker__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.oxc-provider-picker__head span {
  font-size: 12px;
  font-weight: 600;
  color: var(--ox-text-secondary, #64748B);
}

.oxc-provider-picker__head small {
  color: var(--ox-text-muted, #94A3B8);
  font-size: 11px;
}

.oxc-provider-grid {
  display: grid;
  gap: 10px;
}

.oxc-provider-card {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  border-radius: 12px;
  background: var(--ox-bg-surface, #FFFFFF);
  text-align: left;
  color: var(--ox-text-primary, #1E293B);
  cursor: pointer;
  font: inherit;
  transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.oxc-provider-card:hover {
  border-color: rgba(91, 163, 197, 0.24);
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.06);
}

.oxc-provider-card.is-active {
  border-color: rgba(91, 163, 197, 0.32);
  background: rgba(91, 163, 197, 0.08);
}

.oxc-provider-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.oxc-provider-card__brand {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
}

.oxc-provider-card__logo,
.oxc-provider-card__fallback {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(91, 163, 197, 0.12);
  color: var(--ox-accent, #5BA3C5);
}

.oxc-provider-card__logo {
  object-fit: contain;
  padding: 5px;
  background: #fff;
  border: 1px solid rgba(15, 23, 42, 0.06);
}

.oxc-provider-card__title {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.oxc-provider-card__title strong {
  font-size: 13px;
  line-height: 1.25;
}

.oxc-provider-card__title small {
  color: var(--ox-text-muted, #94A3B8);
  font-size: 11px;
}

.oxc-provider-card__active,
.oxc-provider-card__template {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.oxc-provider-card__active {
  background: rgba(34, 197, 94, 0.12);
  color: var(--ox-success, #22C55E);
}

.oxc-provider-card__template {
  background: rgba(148, 163, 184, 0.12);
  color: var(--ox-text-secondary, #64748B);
}

.oxc-provider-card__model {
  font-size: 12px;
  font-weight: 700;
  color: var(--ox-text-primary, #1E293B);
  line-height: 1.45;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.oxc-provider-card__summary {
  color: var(--ox-text-secondary, #64748B);
  font-size: 12px;
  line-height: 1.55;
}

.oxc-provider-card__validation,
.oxc-provider-diagnostics__message {
  color: var(--ox-text-secondary, #64748B);
  font-size: 12px;
  line-height: 1.55;
}

.oxc-provider-validate-btn {
  min-height: 30px;
  padding: 0 10px;
  border: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  border-radius: 999px;
  background: var(--ox-bg-surface, #FFFFFF);
  color: var(--ox-text-secondary, #64748B);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font: inherit;
  font-size: 12px;
  flex-shrink: 0;
  transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.oxc-provider-validate-btn:hover:not(:disabled) {
  border-color: rgba(91, 163, 197, 0.24);
  color: var(--ox-accent, #5BA3C5);
}

.oxc-provider-validate-btn:disabled {
  cursor: default;
  opacity: 0.72;
}

.oxc-provider-diagnostics {
  display: grid;
  gap: 10px;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  background: rgba(244, 245, 249, 0.92);
}

.oxc-provider-diagnostics__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.oxc-provider-diagnostics__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.12);
  color: var(--ox-text-secondary, #64748B);
  font-size: 12px;
}

.oxc-provider-diagnostics__chip.is-on {
  background: rgba(34, 197, 94, 0.12);
  color: var(--ox-success, #22C55E);
}

.oxc-provider-checks {
  display: grid;
  gap: 8px;
}

.oxc-provider-check {
  display: grid;
  gap: 2px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--ox-bg-surface, #FFFFFF);
  border: 1px solid rgba(15, 23, 42, 0.06);
}

.oxc-provider-check strong {
  font-size: 12px;
  color: var(--ox-text-primary, #1E293B);
}

.oxc-provider-check span {
  font-size: 12px;
  color: var(--ox-text-secondary, #64748B);
  line-height: 1.5;
}

.oxc-provider-models {
  display: grid;
  gap: 10px;
}

.oxc-provider-models__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.oxc-provider-model-chip {
  min-height: 30px;
  padding: 0 12px;
  border: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  border-radius: 999px;
  background: var(--ox-bg-surface, #FFFFFF);
  color: var(--ox-text-secondary, #64748B);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.oxc-provider-model-chip:hover {
  border-color: rgba(91, 163, 197, 0.24);
  color: var(--ox-accent, #5BA3C5);
}

.oxc-provider-model-chip.is-active {
  background: rgba(91, 163, 197, 0.1);
  border-color: rgba(91, 163, 197, 0.24);
  color: var(--ox-accent, #5BA3C5);
  font-weight: 700;
}

.oxc-slider-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.oxc-slider-row input[type="range"] {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--ox-bg-surface-active, #E8EBF4);
  border-radius: 2px;
  outline: none;
}

.oxc-slider-row input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--ox-accent, #5BA3C5);
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(91, 163, 197, 0.30);
  transition: transform 150ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

.oxc-slider-row input[type="range"]::-webkit-slider-thumb:hover {
  transform: scale(1.15);
}

.oxc-slider-value {
  font-size: 14px;
  font-weight: 500;
  color: var(--ox-accent, #5BA3C5);
  min-width: 36px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.oxc-select {
  width: 100%;
  padding: 10px 14px;
  background: var(--ox-bg-input, #F4F5F9);
  border: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  border-radius: var(--ox-radius-sm, 8px);
  color: var(--ox-text-primary, #1E293B);
  font-family: inherit;
  font-size: 14px;
  outline: none;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 32px;
  transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.oxc-select:hover {
  background-color: var(--ox-bg-input-hover, #ECEEF5);
  border-color: var(--ox-border-hover, rgba(15, 23, 42, 0.14));
}

.oxc-select:focus {
  background-color: var(--ox-bg-surface, #FFFFFF);
  border-color: var(--ox-accent, #5BA3C5);
  box-shadow: var(--ox-shadow-glow, 0 0 0 3px rgba(91, 163, 197, 0.15));
}

.oxc-textarea {
  width: 100%;
  padding: 10px 14px;
  background: var(--ox-bg-input, #F4F5F9);
  border: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  border-radius: var(--ox-radius-sm, 8px);
  color: var(--ox-text-primary, #1E293B);
  font-family: inherit;
  font-size: 14px;
  outline: none;
  resize: vertical;
  min-height: 100px;
  line-height: 1.5;
  transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.oxc-textarea::placeholder {
  color: var(--ox-text-muted, #94A3B8);
}

.oxc-textarea:hover {
  background-color: var(--ox-bg-input-hover, #ECEEF5);
  border-color: var(--ox-border-hover, rgba(15, 23, 42, 0.14));
}

.oxc-textarea:focus {
  background-color: var(--ox-bg-surface, #FFFFFF);
  border-color: var(--ox-accent, #5BA3C5);
  box-shadow: var(--ox-shadow-glow, 0 0 0 3px rgba(91, 163, 197, 0.15));
}

.oxc-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.oxc-toggle {
  position: relative;
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  flex-shrink: 0;
}

.oxc-toggle input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}

.oxc-toggle__slider {
  width: 36px;
  height: 20px;
  background: var(--ox-border, rgba(15, 23, 42, 0.08));
  border-radius: 10px;
  position: relative;
  transition: background 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.oxc-toggle__slider::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #FFFFFF;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: transform 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.oxc-toggle input:checked + .oxc-toggle__slider {
  background: var(--ox-accent, #5BA3C5);
}

.oxc-toggle input:checked + .oxc-toggle__slider::after {
  transform: translateX(16px);
}

/* Backdrop for small screens */
.oxc-settings-backdrop {
  display: none;
}

/* ─────────── Animations ─────────── */
@keyframes oxc-fade-in-up {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes oxc-typing-dot {
  0%, 80%, 100% {
    transform: translateY(0);
    opacity: 0.45;
  }
  40% {
    transform: translateY(-4px);
    opacity: 1;
  }
}

/* ─────────── Responsive ─────────── */
@media (max-width: 980px) {
  .oxc-conversations {
    width: 240px;
  }

  .oxc-context-strip {
    padding: 10px 16px 0;
  }

  .oxc-status-banner {
    margin: 12px 16px 0;
  }

  .oxc-stream {
    padding: 20px 16px calc(var(--oxc-composer-space, 160px) + 20px);
    scroll-padding-bottom: calc(var(--oxc-composer-space, 160px) + 20px);
  }

  .oxc-input-wrapper {
    padding: 0 16px 16px;
  }

  .oxc-header {
    padding: 12px 16px;
  }

  .oxc-msg__bubble {
    max-width: 86%;
  }
}

@media (max-width: 820px) {
  .oxc-conversations {
    display: none;
  }
}

@media (max-width: 720px) {
  .oxc-header__model {
    max-width: 180px;
  }

  .oxc-provider-grid {
    grid-template-columns: 1fr;
  }

  .oxc-settings-panel {
    width: 86%;
    max-width: 360px;
  }

  .oxc-settings-toggle.is-active {
    right: 86%;
  }

  .oxc-settings-backdrop {
    display: block;
    position: absolute;
    inset: 0;
    background: rgba(15, 23, 42, 0.40);
    z-index: 10;
  }
}
</style>
