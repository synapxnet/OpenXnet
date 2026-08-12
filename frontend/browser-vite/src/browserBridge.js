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

function stripHtml(value) {
  return String(value || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function hasRenderableMessages(host) {
  if (!host || !Array.isArray(host.messages)) {
    return false;
  }
  return host.messages.some((message, index) => {
    if (message?.role === 'system' && index === 0) return false;
    return String(message?.content || '').trim().length > 0 || (message?.role === 'assistant' && host.isTyping);
  });
}

function formatAssistantHtml(host, content, index) {
  const raw = String(content || '');
  if (!raw.trim()) {
    return '';
  }
  try {
    if (host && typeof host.formatMessage === 'function') {
      const formatted = host.formatMessage.call(host, raw, index);
      if (formatted && String(formatted).trim()) {
        return String(formatted);
      }
    }
  } catch (error) {
    return textToHtml(raw);
  }
  return textToHtml(raw);
}

function normalizeMessages(host) {
  if (!hasRenderableMessages(host)) {
    return [];
  }

  const filtered = (host?.messages || []).filter((message, index) => {
    return !(message?.role === 'system' && index === 0);
  });

  return filtered.map((message, index) => {
    const role = message?.role === 'assistant' ? 'assistant' : 'user';
    const content = String(message?.pure_content || message?.content || '');
    const explicitTime = String(message?.prototypeTime || message?.time || '').trim();
    return {
      id: String(message?.id || `browser-live-${index}`),
      role,
      text: role === 'user' ? stripHtml(content) : '',
      html: role === 'assistant' ? formatAssistantHtml(host, content, index) : '',
      typing: role === 'assistant' && !String(content || '').trim() && !!host?.isTyping && index === filtered.length - 1,
      time: explicitTime,
    };
  });
}

function normalizeTabs(host) {
  if (!Array.isArray(host?.browserTabs)) {
    return [];
  }
  return host.browserTabs.map((tab, index) => ({
    id: String(tab?.id || `tab-${index}`),
    title: String(tab?.title || ''),
    favicon: String(tab?.favicon || ''),
    url: String(tab?.url || ''),
    currentUrl: String(tab?.currentUrl || tab?.url || ''),
    isLoading: !!tab?.isLoading,
    canGoBack: !!tab?.canGoBack,
    canGoForward: !!tab?.canGoForward,
  }));
}

function getCurrentTab(host, tabs) {
  const currentTabId = String(host?.currentTabId || '');
  return tabs.find((tab) => tab.id === currentTabId) || null;
}

function getSearchProviderLabel(host, isZh) {
  const provider = String(host?.searchEngine || 'bing');
  if (provider === 'google') {
    return 'Google';
  }
  if (provider === 'bing') {
    return 'Bing';
  }
  return isZh ? 'AI 分析' : 'AI analysis';
}

function isFavorite(host) {
  if (!host) return false;
  try {
    if (typeof host.isCurrentTabFavorite === 'boolean') {
      return host.isCurrentTabFavorite;
    }
    if (typeof host.isCurrentTabFavorite === 'function') {
      return !!host.isCurrentTabFavorite();
    }
  } catch (error) {
    return false;
  }
  return !!host.isCurrentTabFavorite;
}

function buildSnapshot() {
  const host = getHostApp();
  const isZh = isCurrentLanguageZh(host);
  const tabs = normalizeTabs(host);
  const currentTab = getCurrentTab(host, tabs);
  return {
    isZh,
    canUseHost: !!host,
    isElectron: !!host?.isElectron,
    activeMenu: String(host?.activeMenu || ''),
    tabs,
    currentTab,
    currentTabId: String(host?.currentTabId || ''),
    showAssistant: host ? host.showBrowserChat !== false : true,
    dynamicUserAgent: String(host?.dynamicUserAgent || ''),
    webviewPreloadPath: String(host?.webviewPreloadPath || ''),
    messages: normalizeMessages(host),
    isSending: !!(host?.isSending || host?.isTyping),
    interpreterEnabled: !!host?.codeSettings?.enabled,
    asrEnabled: !!host?.asrSettings?.enabled,
    searchProviderLabel: getSearchProviderLabel(host, isZh),
    isCurrentTabFavorite: isFavorite(host),
    urlInput: String(host?.urlInput || ''),
  };
}

function callHost(methodName, ...args) {
  const host = getHostApp();
  const method = host?.[methodName];
  if (typeof method !== 'function') {
    return undefined;
  }
  return method.apply(host, args);
}

async function sendMessage(text) {
  const host = getHostApp();
  if (!host) return false;
  host.userInput = String(text || '');
  await host.handleSendOrGuidance();
  return true;
}

async function sendPresetPrompt(prompt) {
  return sendMessage(prompt);
}

async function startFreshAnalysis() {
  const host = getHostApp();
  if (!host) return;
  if (typeof host.clearMessages === 'function') {
    host.clearMessages();
  }
  host.activeMenu = 'ai-browser';
  host.showBrowserChat = true;
}

async function submitWelcomeQuery(query) {
  const host = getHostApp();
  if (!host || typeof host.handleWelcomeSearch !== 'function') return false;
  host.welcomeSearchQuery = String(query || '');
  host.showBrowserChat = true;
  await host.handleWelcomeSearch();
  return true;
}

async function browseAllFiles() {
  return callHost('browseAllFiles');
}

async function browseImages() {
  return callHost('browseImages');
}

async function toggleInterpreter() {
  const host = getHostApp();
  if (!host) return;
  host.codeSettings.enabled = !host.codeSettings.enabled;
  if (typeof host.handleInterpreterToggle === 'function') {
    await host.handleInterpreterToggle(host.codeSettings.enabled);
  }
}

async function toggleAsr() {
  return callHost('toggleASR');
}

async function toggleAssistantPanel() {
  const host = getHostApp();
  if (!host) return;
  host.showBrowserChat = !host.showBrowserChat;
  if (typeof host.autoSaveSettings === 'function') {
    await host.autoSaveSettings();
  }
}

async function setAssistantPanel(visible) {
  const host = getHostApp();
  if (!host) return;
  host.showBrowserChat = !!visible;
  if (typeof host.autoSaveSettings === 'function') {
    await host.autoSaveSettings();
  }
}

async function addNewTab() {
  return callHost('addNewTab');
}

async function switchTab(id) {
  return callHost('switchTab', id);
}

async function closeTab(id, event) {
  return callHost('closeTab', id, event);
}

async function goBack() {
  return callHost('browserGoBack');
}

async function goForward() {
  return callHost('browserGoForward');
}

async function reloadCurrent() {
  return callHost('browserReload');
}

async function goHome() {
  return callHost('goHome');
}

async function toggleFavorite() {
  const host = getHostApp();
  if (!host) return;
  if (typeof host.toggleFavorite === 'function') {
    await host.toggleFavorite(host.currentTab);
  }
}

async function navigate(url) {
  const host = getHostApp();
  if (!host) return;
  host.urlInput = String(url || '');
  if (typeof host.handleUrlEnter === 'function') {
    await host.handleUrlEnter();
  }
}

async function reloadWorkspaceView() {
  return callHost('reloadWorkspaceView');
}

async function openUrlInNewTab(url) {
  const host = getHostApp();
  if (!host || typeof host.openUrlInNewTab !== 'function') return;
  host.openUrlInNewTab(String(url || ''));
}

async function onDidStartLoading(id) {
  return callHost('onDidStartLoading', id);
}

async function onDidStopLoading(id) {
  return callHost('onDidStopLoading', id);
}

async function onPageTitleUpdated(id, event) {
  return callHost('onPageTitleUpdated', id, event);
}

async function onPageFaviconUpdated(id, event) {
  return callHost('onPageFaviconUpdated', id, event);
}

async function onNewWindow(id, event) {
  return callHost('onNewWindow', id, event);
}

async function onDomReady(id) {
  return callHost('onDomReady', id);
}

async function handleWebviewIpcMessage(event) {
  return callHost('handleWebviewIpcMessage', event);
}

export function createBrowserBridge() {
  return {
    snapshot: buildSnapshot,
    sendMessage,
    sendPresetPrompt,
    startFreshAnalysis,
    submitWelcomeQuery,
    browseAllFiles,
    browseImages,
    toggleInterpreter,
    toggleAsr,
    toggleAssistantPanel,
    setAssistantPanel,
    addNewTab,
    switchTab,
    closeTab,
    goBack,
    goForward,
    reloadCurrent,
    goHome,
    toggleFavorite,
    navigate,
    reloadWorkspaceView,
    openUrlInNewTab,
    onDidStartLoading,
    onDidStopLoading,
    onPageTitleUpdated,
    onPageFaviconUpdated,
    onNewWindow,
    onDomReady,
    handleWebviewIpcMessage,
  };
}
