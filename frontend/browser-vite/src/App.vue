<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { createBrowserBridge } from './browserBridge';

const bridge = createBrowserBridge();
const snapshot = ref(bridge.snapshot());
const streamRef = ref(null);
const draft = ref('');
const panelTab = ref('summary');
const isUrlEditing = ref(false);
const urlDraft = ref('');
const urlInputRef = ref(null);
const newtabQuery = ref('');

let refreshTimer = null;
let lastMessageSignature = '';
let lastTabSignature = '';
let lastCurrentTabId = '';
let lastHasLivePage = false;

function buildMessageSignature(messages) {
  return messages
    .map((message) => [
      message.id,
      message.role,
      message.time,
      message.typing ? 'typing' : 'content',
      message.text || '',
      message.html || '',
    ].join('::'))
    .join('||');
}

function buildTabSignature(tabs) {
  return tabs
    .map((tab) => [
      tab.id,
      tab.title,
      tab.url,
      tab.currentUrl,
      tab.isLoading ? 'loading' : 'idle',
    ].join('::'))
    .join('||');
}

function shouldPinToBottom() {
  const container = streamRef.value;
  if (!container) return true;
  const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
  return distance < 120;
}

function scrollToBottom(force = false) {
  const container = streamRef.value;
  if (!container) return;
  if (!force && !shouldPinToBottom()) return;
  container.scrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
}

function refreshSnapshot(forceScroll = false) {
  const nextSnapshot = bridge.snapshot();
  const nextMessageSignature = buildMessageSignature(nextSnapshot.messages || []);
  const nextTabSignature = buildTabSignature(nextSnapshot.tabs || []);
  const nextHasLivePage = !!nextSnapshot.currentTab?.url;
  const hasChanged = nextMessageSignature !== lastMessageSignature
    || nextTabSignature !== lastTabSignature
    || nextSnapshot.showAssistant !== snapshot.value.showAssistant
    || nextSnapshot.currentTabId !== lastCurrentTabId
    || nextHasLivePage !== lastHasLivePage
    || nextSnapshot.isSending !== snapshot.value.isSending;

  snapshot.value = nextSnapshot;

  if (hasChanged || forceScroll) {
    lastMessageSignature = nextMessageSignature;
    lastTabSignature = nextTabSignature;
    lastCurrentTabId = nextSnapshot.currentTabId || '';
    lastHasLivePage = nextHasLivePage;
    nextTick(() => scrollToBottom(true));
  }
}

async function handleTogglePanel() {
  await bridge.toggleAssistantPanel();
  refreshSnapshot();
}

async function handleSend() {
  const text = String(draft.value || '');
  if (!text.trim() && !snapshot.value.isSending) {
    return;
  }
  if (panelTab.value !== 'ask') {
    panelTab.value = 'ask';
  }
  const sent = hasLivePage.value
    ? await bridge.sendMessage(text)
    : await bridge.submitWelcomeQuery(text);
  if (sent) {
    draft.value = '';
    refreshSnapshot(true);
  }
}

function handleAskKeydown(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    handleSend();
  }
}

async function handlePresetPrompt(prompt) {
  if (!prompt) return;
  panelTab.value = 'ask';
  if (hasLivePage.value) {
    const sent = await bridge.sendPresetPrompt(prompt);
    if (sent) {
      refreshSnapshot(true);
    }
    return;
  }
  draft.value = prompt;
  await handleSend();
}

async function handleCopySummary() {
  const summary = isZh.value
    ? 'OpenXnet 是一个开源的 AI 多智能体协作平台，提供桌面端应用。它基于 Electron 和 TypeScript 构建，支持通过 MCP 协议集成多种工具和技能，打造统一的智能工作流体验。'
    : 'OpenXnet is an open-source AI multi-agent collaboration platform built with Electron and TypeScript, designed to unify tools, models, and workflows through MCP-based integrations.';
  try {
    await navigator.clipboard.writeText(summary);
  } catch (error) {
    console.warn('Failed to copy AI browser summary:', error);
  }
}

function handleDeepAnalysis() {
  panelTab.value = 'ask';
  const prompt = isZh.value ? '请对当前页面进行深入分析，给出关键结论和后续动作建议。' : 'Please deep-analyze the current page and provide key takeaways and recommended next actions.';
  handlePresetPrompt(prompt);
}

async function handleSwitchTab(id) {
  await bridge.switchTab(id);
  refreshSnapshot();
}

async function handleCloseTab(id, event) {
  await bridge.closeTab(id, event);
  refreshSnapshot();
}

async function handleNewTab() {
  await bridge.addNewTab();
  refreshSnapshot();
}

async function handleGoBack() {
  await bridge.goBack();
  refreshSnapshot();
}

async function handleGoForward() {
  await bridge.goForward();
  refreshSnapshot();
}

async function handleReload() {
  await bridge.reloadCurrent();
  refreshSnapshot();
}

async function handleGoHome() {
  await bridge.goHome();
  refreshSnapshot();
}

async function handleToggleFavorite() {
  await bridge.toggleFavorite();
  refreshSnapshot();
}

async function handleReloadWorkspace() {
  await bridge.reloadWorkspaceView();
  refreshSnapshot();
}

async function handleOpenUrl(url) {
  await bridge.openUrlInNewTab(url);
  refreshSnapshot();
}

async function handleQuickNavigate(url) {
  if (!url) return;
  await bridge.navigate(url);
  refreshSnapshot(true);
  nextTick(() => refreshSnapshot(true));
}

async function handleNewtabSubmit() {
  const value = String(newtabQuery.value || '').trim();
  if (!value) return;
  newtabQuery.value = '';
  await bridge.navigate(value);
  refreshSnapshot(true);
  nextTick(() => refreshSnapshot(true));
}

function startUrlEdit() {
  urlDraft.value = currentTab.value?.currentUrl || currentTab.value?.url || '';
  isUrlEditing.value = true;
  nextTick(() => {
    const input = urlInputRef.value;
    if (input) {
      input.focus();
      input.select?.();
    }
  });
}

function cancelUrlEdit() {
  if (!isUrlEditing.value) return;
  isUrlEditing.value = false;
  urlDraft.value = '';
}

let urlCommitInFlight = false;
async function commitUrlEdit() {
  if (!isUrlEditing.value || urlCommitInFlight) return;
  const value = String(urlDraft.value || '').trim();
  isUrlEditing.value = false;
  urlDraft.value = '';
  if (!value) return;
  urlCommitInFlight = true;
  try {
    await bridge.navigate(value);
    // host updates browserTabs[i].url synchronously; refresh now so the
    // <webview> mounts with the correct :src instead of waiting for the tick.
    refreshSnapshot(true);
    nextTick(() => refreshSnapshot(true));
  } finally {
    urlCommitInFlight = false;
  }
}

function handleDidStartLoading(id) {
  bridge.onDidStartLoading(id);
  refreshSnapshot();
}

function handleDidStopLoading(id) {
  bridge.onDidStopLoading(id);
  refreshSnapshot(true);
}

function handlePageTitleUpdated(id, event) {
  bridge.onPageTitleUpdated(id, event);
  refreshSnapshot();
}

function handlePageFaviconUpdated(id, event) {
  bridge.onPageFaviconUpdated(id, event);
  refreshSnapshot();
}

function handleNewWindow(id, event) {
  bridge.onNewWindow(id, event);
  refreshSnapshot();
}

function handleDomReady(id) {
  bridge.onDomReady(id);
  refreshSnapshot();
}

function handleWebviewIpcMessage(event) {
  bridge.handleWebviewIpcMessage(event);
}

const isZh = computed(() => snapshot.value.isZh);
const tabs = computed(() => snapshot.value.tabs || []);
const currentTab = computed(() => snapshot.value.currentTab || null);
const hasLivePage = computed(() => !!currentTab.value?.url);
const showPanel = computed(() => snapshot.value.showAssistant !== false);
const messageItems = computed(() => snapshot.value.messages || []);
const isFavorite = computed(() => snapshot.value.isCurrentTabFavorite);
const isLoading = computed(() => !!currentTab.value?.isLoading);

const panelTabs = computed(() => [
  { id: 'summary', label: isZh.value ? '摘要' : 'Summary' },
  { id: 'ask', label: isZh.value ? '提问' : 'Ask' },
  { id: 'translate', label: isZh.value ? '翻译' : 'Translate' },
]);

const summaryText = computed(() => (
  isZh.value
    ? 'OpenXnet 是一个开源的 AI 多智能体协作平台，提供桌面端应用。它基于 Electron 和 TypeScript 构建，支持通过 MCP 协议集成多种工具和技能，打造统一的智能工作流体验。'
    : 'OpenXnet is an open-source AI multi-agent collaboration platform built with Electron and TypeScript, designed to unify tools, models, and workflows through MCP-based integrations.'
));

const summaryPoints = computed(() => (
  isZh.value
    ? ['支持多种 AI 模型提供商', 'MCP 工具集成架构', '多平台部署能力']
    : ['Supports multiple AI model providers', 'MCP tool integration architecture', 'Cross-platform deployment support']
));

const quickLinks = computed(() => (
  isZh.value
    ? [
        { label: 'GitHub', url: 'https://github.com', icon: 'fa-brands fa-github', color: '#24292F' },
        { label: '百度', url: 'https://www.baidu.com', icon: 'fa-solid fa-paw', color: '#2932E1' },
        { label: 'Bing', url: 'https://www.bing.com', icon: 'fa-solid fa-magnifying-glass', color: '#008373' },
        { label: '维基百科', url: 'https://zh.wikipedia.org', icon: 'fa-brands fa-wikipedia-w', color: '#000000' },
        { label: 'YouTube', url: 'https://www.youtube.com', icon: 'fa-brands fa-youtube', color: '#FF0000' },
        { label: 'Stack Overflow', url: 'https://stackoverflow.com', icon: 'fa-brands fa-stack-overflow', color: '#F48024' },
      ]
    : [
        { label: 'GitHub', url: 'https://github.com', icon: 'fa-brands fa-github', color: '#24292F' },
        { label: 'Google', url: 'https://www.google.com', icon: 'fa-brands fa-google', color: '#4285F4' },
        { label: 'Bing', url: 'https://www.bing.com', icon: 'fa-solid fa-magnifying-glass', color: '#008373' },
        { label: 'Wikipedia', url: 'https://www.wikipedia.org', icon: 'fa-brands fa-wikipedia-w', color: '#000000' },
        { label: 'YouTube', url: 'https://www.youtube.com', icon: 'fa-brands fa-youtube', color: '#FF0000' },
        { label: 'Stack Overflow', url: 'https://stackoverflow.com', icon: 'fa-brands fa-stack-overflow', color: '#F48024' },
      ]
));

const quickPrompts = computed(() => (
  isZh.value
    ? [
        { icon: 'fa-solid fa-file-lines', label: '总结页面', prompt: '请总结当前页面的核心内容和结论。' },
        { icon: 'fa-solid fa-list-check', label: '提取待办', prompt: '请从当前页面中提取所有可执行待办，并按优先级整理。' },
        { icon: 'fa-solid fa-language', label: '翻译内容', prompt: '请将当前页面的重点内容翻译成中文，并保留结构。' },
        { icon: 'fa-solid fa-triangle-exclamation', label: '风险检查', prompt: '请帮我识别当前页面中可能存在的风险、限制和注意事项。' },
      ]
    : [
        { icon: 'fa-solid fa-file-lines', label: 'Summarize', prompt: 'Summarize the current page with the key points and conclusion.' },
        { icon: 'fa-solid fa-list-check', label: 'Action Items', prompt: 'Extract actionable tasks from the current page and sort them by priority.' },
        { icon: 'fa-solid fa-language', label: 'Translate', prompt: 'Translate the most important content on the current page while keeping its structure.' },
        { icon: 'fa-solid fa-triangle-exclamation', label: 'Risks', prompt: 'Identify possible risks, limitations, and caveats on the current page.' },
      ]
));

const currentDomain = computed(() => {
  const url = currentTab.value?.currentUrl || currentTab.value?.url || '';
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch (error) {
    return url;
  }
});

const displayUrl = computed(() => {
  const url = currentTab.value?.currentUrl || currentTab.value?.url || '';
  return url;
});

const isSecure = computed(() => /^https:\/\//i.test(displayUrl.value));

const sendIconClass = computed(() => (
  snapshot.value.isSending && !String(draft.value || '').trim()
    ? 'fa-solid fa-stop'
    : 'fa-solid fa-arrow-up'
));

const askPlaceholder = computed(() => {
  if (panelTab.value === 'translate') {
    return isZh.value ? '输入要翻译的内容或网址...' : 'Enter text or URL to translate...';
  }
  if (hasLivePage.value) {
    return isZh.value ? '对此页面提问...' : 'Ask about this page...';
  }
  return isZh.value ? '输入网址、搜索词或任务...' : 'Enter a URL, search, or task...';
});

watch(hasLivePage, (next, prev) => {
  if (next && !prev && messageItems.value.length === 0) {
    panelTab.value = 'summary';
  }
});

onMounted(() => {
  refreshSnapshot(true);
  refreshTimer = window.setInterval(() => refreshSnapshot(false), 400);
});

onBeforeUnmount(() => {
  if (refreshTimer) {
    window.clearInterval(refreshTimer);
    refreshTimer = null;
  }
});
</script>

<template>
  <div
    class="ox-vite-browser-shell"
    :class="{
      'is-panel-collapsed': !showPanel,
      'is-live-page': hasLivePage,
    }"
  >
    <!-- Tab strip & address bar are rendered in the host topbar (.integrated-browser-bar) -->

    <!-- ════════ Split Content (Webpage + AI Panel) ════════ -->
    <div class="oxb-split">
      <!-- Left: webview / welcome mock -->
      <section class="oxb-stage">
        <div v-if="!snapshot.canUseHost" class="oxb-empty">
          <div class="oxb-empty__icon"><i class="fa-solid fa-plug-circle-xmark"></i></div>
          <h2>{{ isZh ? '桌面桥接未恢复' : 'Desktop bridge unavailable' }}</h2>
          <p>{{ isZh ? 'AI 浏览器需要桌面端桥接能力，当前页面正在尝试恢复工作区。' : 'The AI browser needs the desktop bridge. The workspace is attempting to recover.' }}</p>
          <button type="button" class="oxb-primary-btn" @click="handleReloadWorkspace">
            <i class="fa-solid fa-rotate-right"></i>
            <span>{{ isZh ? '重新加载工作区' : 'Reload workspace' }}</span>
          </button>
        </div>

        <div v-else-if="!currentTab" class="oxb-empty">
          <div class="oxb-empty__icon"><i class="fa-regular fa-compass"></i></div>
          <h2>{{ isZh ? '正在恢复标签页状态' : 'Restoring tabs' }}</h2>
          <p>{{ isZh ? '浏览器会在恢复完成后继续回到上次的工作流。' : 'The browser will resume your previous workspace flow once tab recovery completes.' }}</p>
          <button type="button" class="oxb-primary-btn" @click="handleNewTab">
            <i class="fa-solid fa-plus"></i>
            <span>{{ isZh ? '新建标签页' : 'Create tab' }}</span>
          </button>
        </div>

        <div v-else-if="!snapshot.isElectron" class="oxb-empty">
          <div class="oxb-empty__icon"><i class="fa-solid fa-globe"></i></div>
          <h2>{{ isZh ? '浏览器预览模式' : 'Browser preview mode' }}</h2>
          <p>{{ isZh ? '当前是外部浏览器预览，AI 浏览器的真实网页承载会在桌面端壳内启用。' : 'You are in external browser preview mode. The live browsing surface is enabled inside the desktop shell.' }}</p>
          <div class="oxb-chip-row">
            <button type="button" class="oxb-chip" @click="handleGoHome">
              {{ isZh ? '回到空白页' : 'Go to blank tab' }}
            </button>
            <button type="button" class="oxb-chip" @click="handleNewTab">
              {{ isZh ? '新建标签页' : 'Create tab' }}
            </button>
          </div>
        </div>

        <!-- Live webviews + new-tab overlay (overlay shown when current tab has no URL) -->
        <div v-else class="oxb-webview-stack">
          <template v-for="tab in tabs" :key="tab.id">
            <webview
              v-if="tab.url"
              :id="'webview-' + tab.id"
              :src="tab.url"
              v-show="currentTab && currentTab.id === tab.id"
              class="oxb-webview"
              :useragent="snapshot.dynamicUserAgent"
              :preload="snapshot.webviewPreloadPath"
              partition="persist:party-browser-session"
              allowpopups
              plugins
              webpreferences="contextIsolation=true, nodeIntegration=false, sandbox=true, webSecurity=true, enableRemoteModule=false"
              @ipc-message="handleWebviewIpcMessage"
              @did-start-loading="handleDidStartLoading(tab.id)"
              @did-stop-loading="handleDidStopLoading(tab.id)"
              @page-title-updated="handlePageTitleUpdated(tab.id, $event)"
              @page-favicon-updated="handlePageFaviconUpdated(tab.id, $event)"
              @new-window="handleNewWindow(tab.id, $event)"
              @dom-ready="handleDomReady(tab.id)"
            ></webview>
          </template>

          <div v-show="!hasLivePage" class="oxb-newtab">
            <div class="oxb-newtab__inner">
              <div class="oxb-newtab__hero">
                <div class="oxb-newtab__icon"><i class="fa-solid fa-globe"></i></div>
                <h1>{{ isZh ? 'OpenXnet AI 浏览器' : 'OpenXnet AI Browser' }}</h1>
                <p>{{ isZh ? '在上方地址栏输入网址或搜索内容开始浏览，AI 助手会跟随你的页面同步分析。' : 'Type a URL or search above to start browsing. The AI assistant will analyse the page alongside you.' }}</p>
              </div>

              <form
                class="oxb-newtab__search"
                @submit.prevent="handleNewtabSubmit"
              >
                <i class="fa-solid fa-magnifying-glass"></i>
                <input
                  v-model="newtabQuery"
                  type="text"
                  :placeholder="isZh ? '输入网址或搜索关键词...' : 'Enter a URL or search query...'"
                />
                <button type="submit" :disabled="!String(newtabQuery || '').trim()">
                  {{ isZh ? '前往' : 'Go' }}
                </button>
              </form>

              <div class="oxb-newtab__shortcuts">
                <button
                  v-for="link in quickLinks"
                  :key="link.url"
                  type="button"
                  class="oxb-newtab__shortcut"
                  @click="handleQuickNavigate(link.url)"
                >
                  <span class="oxb-newtab__shortcut-icon" :style="{ background: link.color }">
                    <i :class="link.icon"></i>
                  </span>
                  <span class="oxb-newtab__shortcut-label">{{ link.label }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Right: AI Side Panel -->
      <aside v-if="showPanel" class="oxb-panel">
        <div class="oxb-panel__header">
          <span class="oxb-panel__title">
            <i class="fa-solid fa-sparkles"></i>
            <span>{{ isZh ? 'AI 助手' : 'AI Assistant' }}</span>
          </span>
          <button
            type="button"
            class="oxb-panel__minimize"
            :title="isZh ? '收起 AI 面板' : 'Minimize AI panel'"
            @click="handleTogglePanel"
          >
            <i class="fa-solid fa-minus"></i>
          </button>
        </div>

        <div class="oxb-panel__tabs">
          <div class="oxb-pill-group">
            <button
              v-for="tab in panelTabs"
              :key="tab.id"
              type="button"
              class="oxb-pill"
              :class="{ 'is-active': panelTab === tab.id }"
              @click="panelTab = tab.id"
            >
              {{ tab.label }}
            </button>
          </div>
        </div>

        <div ref="streamRef" class="oxb-panel__body">
          <!-- Summary tab -->
          <div v-if="panelTab === 'summary'" class="oxb-summary">
            <div class="oxb-summary__head">
              <i class="fa-solid fa-sparkles"></i>
              <span>{{ isZh ? '页面摘要' : 'Page Summary' }}</span>
            </div>
            <p class="oxb-summary__text">{{ summaryText }}</p>
            <ul class="oxb-summary__points">
              <li v-for="point in summaryPoints" :key="point">
                <i class="fa-solid fa-circle-check"></i>
                <span>{{ point }}</span>
              </li>
            </ul>
            <div class="oxb-summary__actions">
              <button type="button" class="oxb-secondary-btn" @click="handleCopySummary">
                <i class="fa-regular fa-copy"></i>
                <span>{{ isZh ? '复制摘要' : 'Copy Summary' }}</span>
              </button>
              <button type="button" class="oxb-primary-btn oxb-primary-btn--sm" @click="handleDeepAnalysis">
                <i class="fa-solid fa-magnifying-glass-plus"></i>
                <span>{{ isZh ? '深入分析' : 'Deep Analysis' }}</span>
              </button>
            </div>
          </div>

          <!-- Ask tab -->
          <div v-else-if="panelTab === 'ask'" class="oxb-ask">
            <div v-if="messageItems.length === 0" class="oxb-empty-chat">
              <h3>{{ hasLivePage ? (isZh ? '对当前页面开始分析' : 'Start analyzing this page') : (isZh ? '从这里开始浏览任务' : 'Start the browsing workflow here') }}</h3>
              <p>
                {{ hasLivePage
                  ? (isZh ? `当前正在浏览 ${currentDomain || '此页面'}，可以直接提问、总结、翻译或提取操作建议。` : `You are currently browsing ${currentDomain || 'this page'}. Ask questions, summarize, translate, or extract actions.`)
                  : (isZh ? '可以输入网址、关键词，或者直接让 AI 帮你规划下一步浏览动作。' : 'Enter a URL, a query, or ask the assistant to plan the next browsing action.') }}
              </p>
              <div class="oxb-chip-grid">
                <button
                  v-for="action in quickPrompts"
                  :key="action.label"
                  type="button"
                  class="oxb-chip oxb-chip--icon"
                  @click="handlePresetPrompt(action.prompt)"
                >
                  <i :class="action.icon"></i>
                  <span>{{ action.label }}</span>
                </button>
              </div>
            </div>

            <div v-else class="oxb-stream">
              <article
                v-for="message in messageItems"
                :key="message.id"
                class="oxb-msg"
                :class="`is-${message.role}`"
              >
                <div v-if="message.role === 'assistant'" class="oxb-msg__avatar">AI</div>
                <div class="oxb-msg__content">
                  <div
                    v-if="message.typing"
                    class="oxb-msg__bubble oxb-msg__bubble--assistant oxb-msg__bubble--typing"
                  >
                    <span></span><span></span><span></span>
                  </div>
                  <div
                    v-else-if="message.role === 'assistant'"
                    class="oxb-msg__bubble oxb-msg__bubble--assistant markdown-body"
                    v-html="message.html"
                  ></div>
                  <div
                    v-else
                    class="oxb-msg__bubble oxb-msg__bubble--user"
                  >
                    {{ message.text }}
                  </div>
                  <div v-if="message.time" class="oxb-msg__time" :class="`is-${message.role}`">
                    {{ message.time }}
                  </div>
                </div>
              </article>
            </div>
          </div>

          <!-- Translate tab -->
          <div v-else class="oxb-translate">
            <div class="oxb-summary__head">
              <i class="fa-solid fa-language"></i>
              <span>{{ isZh ? '翻译与整理' : 'Translate &amp; Reshape' }}</span>
            </div>
            <p class="oxb-summary__text">
              {{ isZh
                ? '在下方输入框输入要翻译的文字或网址，AI 会保留原结构并提供双语对照。'
                : 'Enter text or a URL below. The assistant will translate while keeping the original structure and provide a bilingual view.' }}
            </p>
            <div class="oxb-chip-grid">
              <button type="button" class="oxb-chip" @click="handlePresetPrompt(isZh ? '请将本页内容翻译为英文。' : 'Translate this page into English.')">
                {{ isZh ? '英文翻译' : 'Translate to English' }}
              </button>
              <button type="button" class="oxb-chip" @click="handlePresetPrompt(isZh ? '请将本页内容翻译为中文。' : 'Translate this page into Chinese.')">
                {{ isZh ? '中文翻译' : 'Translate to Chinese' }}
              </button>
              <button type="button" class="oxb-chip" @click="handlePresetPrompt(isZh ? '请把页面中的表格抽取为结构化数据。' : 'Extract tables on this page into structured data.')">
                {{ isZh ? '表格抽取' : 'Extract Tables' }}
              </button>
            </div>
          </div>
        </div>

        <div class="oxb-panel__ask">
          <div class="oxb-panel__ask-row">
            <input
              v-model="draft"
              type="text"
              class="oxb-panel__ask-input"
              :placeholder="askPlaceholder"
              @keydown="handleAskKeydown"
            />
            <button
              type="button"
              class="oxb-panel__ask-send"
              :class="{ 'is-stopping': snapshot.isSending && !String(draft || '').trim() }"
              @click="handleSend"
            >
              <i :class="sendIconClass"></i>
            </button>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<style>
#openxnet-vite-browser-root {
  display: block;
  height: 100%;
  min-height: 0;
  background: var(--ox-bg-base, #F8F9FB);
}

.ox-vite-browser-shell,
.ox-vite-browser-shell * {
  box-sizing: border-box;
}

.ox-vite-browser-shell {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--ox-bg-base, #F8F9FB);
  color: var(--ox-text-primary, #1E293B);
  font-family: var(--ox-font-sans, 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif);
}

/* ─────────────── Tab Bar ─────────────── */
.oxb-tabs {
  width: 100%;
  height: 36px;
  flex-shrink: 0;
  background: var(--ox-bg-sidebar, #F0F2F7);
  display: flex;
  align-items: flex-end;
  padding: 0 var(--ox-space-2, 8px);
  gap: 2px;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
}

.oxb-tabs::-webkit-scrollbar {
  display: none;
}

.oxb-tab {
  display: inline-flex;
  align-items: center;
  gap: var(--ox-space-2, 8px);
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 450;
  color: var(--ox-text-secondary, #64748B);
  border-radius: 8px 8px 0 0;
  cursor: pointer;
  transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
  white-space: nowrap;
  max-width: 180px;
  min-width: 110px;
  border: 1px solid transparent;
  border-bottom: none;
  background: transparent;
  position: relative;
  flex-shrink: 0;
  user-select: none;
}

.oxb-tab:hover {
  background: rgba(255, 255, 255, 0.55);
  color: var(--ox-text-primary, #1E293B);
}

.oxb-tab.is-active {
  background: var(--ox-bg-surface, #FFFFFF);
  border-color: var(--ox-border, rgba(15, 23, 42, 0.08));
  color: var(--ox-text-primary, #1E293B);
  font-weight: 500;
}

.oxb-tab.is-active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--ox-bg-surface, #FFFFFF);
}

.oxb-tab__favicon {
  width: 14px;
  height: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  flex-shrink: 0;
  color: var(--ox-text-muted, #94A3B8);
}

.oxb-tab__favicon img {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  object-fit: cover;
}

.oxb-tab__title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.oxb-tab__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 4px;
  font-size: 9px;
  color: var(--ox-text-muted, #94A3B8);
  flex-shrink: 0;
  transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
  opacity: 0;
}

.oxb-tab:hover .oxb-tab__close,
.oxb-tab.is-active .oxb-tab__close {
  opacity: 1;
}

.oxb-tab__close:hover {
  background: var(--ox-bg-surface-active, #E8EBF4);
  color: var(--ox-text-primary, #1E293B);
}

.oxb-tab--new {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: 8px 8px 0 0;
  font-size: 12px;
  color: var(--ox-text-muted, #94A3B8);
  cursor: pointer;
  transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
  background: transparent;
  border: none;
  align-self: flex-end;
  flex-shrink: 0;
  margin-bottom: 0;
}

.oxb-tab--new:hover {
  background: rgba(255, 255, 255, 0.55);
  color: var(--ox-text-primary, #1E293B);
}

/* ─────────────── Address Bar ─────────────── */
.oxb-address {
  width: 100%;
  height: 40px;
  flex-shrink: 0;
  background: var(--ox-bg-surface, #FFFFFF);
  border-bottom: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  display: flex;
  align-items: center;
  padding: 0 var(--ox-space-3, 12px);
  gap: var(--ox-space-2, 8px);
}

.oxb-address__nav {
  width: 28px;
  height: 28px;
  border-radius: var(--ox-radius-xs, 6px);
  border: none;
  background: transparent;
  color: var(--ox-text-secondary, #64748B);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
  flex-shrink: 0;
}

.oxb-address__nav:hover:not(:disabled):not(.is-disabled) {
  background: var(--ox-bg-surface-hover, #F1F3F9);
  color: var(--ox-text-primary, #1E293B);
}

.oxb-address__nav:disabled,
.oxb-address__nav.is-disabled {
  color: var(--ox-text-disabled, #CBD5E1);
  cursor: default;
}

.oxb-address__url {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--ox-space-2, 8px);
  background: var(--ox-bg-input, #F4F5F9);
  border-radius: var(--ox-radius-full, 9999px);
  padding: 6px 16px;
  font-size: 13px;
  color: var(--ox-text-secondary, #64748B);
  min-width: 0;
  cursor: text;
  transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
  height: 28px;
}

.oxb-address__url:hover {
  background: var(--ox-bg-input-hover, #ECEEF5);
}

.oxb-address__url.is-editing {
  background: var(--ox-bg-surface, #FFFFFF);
  box-shadow: 0 0 0 2px var(--ox-border-accent, rgba(91, 163, 197, 0.40));
}

.oxb-address__lock {
  color: var(--ox-success, #22C55E);
  font-size: 11px;
  flex-shrink: 0;
}

.oxb-address__lock-insecure {
  color: var(--ox-text-muted, #94A3B8);
  font-size: 11px;
  flex-shrink: 0;
}

.oxb-address__text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ox-text-primary, #1E293B);
  font-weight: 400;
  flex: 1;
  min-width: 0;
}

.oxb-address__placeholder {
  color: var(--ox-text-muted, #94A3B8);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.oxb-address__input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  outline: none;
  font: inherit;
  color: var(--ox-text-primary, #1E293B);
  padding: 0;
}

.oxb-address__ai-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  height: 28px;
  border: 1px solid var(--ox-border-accent, rgba(91, 163, 197, 0.40));
  border-radius: var(--ox-radius-xs, 6px);
  background: transparent;
  color: var(--ox-accent, #5BA3C5);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
  white-space: nowrap;
  flex-shrink: 0;
  font-family: inherit;
}

.oxb-address__ai-btn:hover {
  background: var(--ox-accent-soft, rgba(91, 163, 197, 0.12));
}

.oxb-address__ai-btn.is-active {
  background: var(--ox-accent-soft, rgba(91, 163, 197, 0.12));
  color: var(--ox-accent-hover, #4A93B8);
}

.oxb-address__tool {
  width: 28px;
  height: 28px;
  border-radius: var(--ox-radius-xs, 6px);
  border: none;
  background: transparent;
  color: var(--ox-text-muted, #94A3B8);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
  flex-shrink: 0;
}

.oxb-address__tool:hover:not(:disabled) {
  background: var(--ox-bg-surface-hover, #F1F3F9);
  color: var(--ox-text-primary, #1E293B);
}

.oxb-address__tool:disabled {
  color: var(--ox-text-disabled, #CBD5E1);
  cursor: default;
}

.oxb-address__tool.is-active {
  color: var(--ox-accent, #5BA3C5);
}

/* ─────────────── Split content ─────────────── */
.oxb-split {
  width: 100%;
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  overflow: hidden;
}

.ox-vite-browser-shell.is-panel-collapsed .oxb-split {
  /* panel is hidden via v-if; stage takes whole row */
}

/* Left stage */
.oxb-stage {
  flex: 1;
  min-width: 0;
  background: var(--ox-bg-surface, #FFFFFF);
  border-right: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ox-vite-browser-shell.is-panel-collapsed .oxb-stage {
  border-right: 0;
}

.oxb-webview-stack {
  flex: 1;
  min-height: 0;
  background: var(--ox-bg-surface, #FFFFFF);
  position: relative;
  overflow: hidden;
}

.oxb-webview {
  position: absolute;
  inset: 0;
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  background: var(--ox-bg-surface, #FFFFFF);
}

/* Empty / fallback states */
.oxb-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px;
  text-align: center;
}

.oxb-empty__icon {
  width: 52px;
  height: 52px;
  border-radius: var(--ox-radius-lg, 16px);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--ox-accent-soft, rgba(91, 163, 197, 0.12));
  color: var(--ox-accent, #5BA3C5);
  font-size: 22px;
}

.oxb-empty h2 {
  margin: 0;
  font: var(--ox-text-h2, 600 18px/24px var(--ox-font-sans));
  color: var(--ox-text-primary, #1E293B);
}

.oxb-empty p {
  margin: 0;
  font: var(--ox-text-body, 400 14px/20px var(--ox-font-sans));
  color: var(--ox-text-secondary, #64748B);
  max-width: 480px;
  line-height: 1.6;
}

/* New-tab welcome overlay (shown over webview-stack when current tab has no URL) */
.oxb-newtab {
  position: absolute;
  inset: 0;
  z-index: 2;
  background: var(--ox-bg-surface, #FFFFFF);
  overflow-y: auto;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 56px 32px 32px;
  animation: oxbFadeInUp 250ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.oxb-newtab__inner {
  width: 100%;
  max-width: 640px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
}

.oxb-newtab__hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
}

.oxb-newtab__icon {
  width: 56px;
  height: 56px;
  border-radius: var(--ox-radius-lg, 16px);
  background: var(--ox-accent-soft, rgba(91, 163, 197, 0.12));
  color: var(--ox-accent, #5BA3C5);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.oxb-newtab__hero h1 {
  margin: 0;
  font: var(--ox-text-h1, 600 22px/28px var(--ox-font-sans));
  color: var(--ox-text-primary, #1E293B);
}

.oxb-newtab__hero p {
  margin: 0;
  font: var(--ox-text-body, 400 14px/20px var(--ox-font-sans));
  color: var(--ox-text-secondary, #64748B);
  max-width: 420px;
  line-height: 1.6;
}

.oxb-newtab__search {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 8px 8px 16px;
  background: var(--ox-bg-input, #F4F5F9);
  border: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  border-radius: var(--ox-radius-full, 9999px);
  transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.oxb-newtab__search:focus-within {
  background: var(--ox-bg-surface, #FFFFFF);
  border-color: var(--ox-accent, #5BA3C5);
  box-shadow: var(--ox-shadow-glow, 0 0 0 3px rgba(91, 163, 197, 0.15));
}

.oxb-newtab__search > i {
  color: var(--ox-text-muted, #94A3B8);
  font-size: 13px;
}

.oxb-newtab__search input {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  font: inherit;
  font-size: 14px;
  color: var(--ox-text-primary, #1E293B);
  height: 32px;
  min-width: 0;
}

.oxb-newtab__search input::placeholder {
  color: var(--ox-text-muted, #94A3B8);
}

.oxb-newtab__search button {
  height: 32px;
  padding: 0 16px;
  border: 0;
  border-radius: var(--ox-radius-full, 9999px);
  background: var(--ox-accent-gradient, linear-gradient(135deg, #5BA3C5, #7BB8D4));
  color: #FFFFFF;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.oxb-newtab__search button:hover:not(:disabled) {
  background: var(--ox-accent-gradient-hover, linear-gradient(135deg, #4A93B8, #6AADC9));
  box-shadow: var(--ox-shadow-md, 0 4px 12px rgba(15, 23, 42, 0.06));
}

.oxb-newtab__search button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.oxb-newtab__shortcuts {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
  gap: 16px;
}

.oxb-newtab__shortcut {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 14px 8px;
  border: 1px solid transparent;
  border-radius: var(--ox-radius-md, 12px);
  background: transparent;
  cursor: pointer;
  transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
  font-family: inherit;
}

.oxb-newtab__shortcut:hover {
  background: var(--ox-bg-surface-hover, #F1F3F9);
  border-color: var(--ox-border, rgba(15, 23, 42, 0.08));
  transform: translateY(-1px);
  box-shadow: var(--ox-shadow-sm, 0 1px 2px rgba(15, 23, 42, 0.04));
}

.oxb-newtab__shortcut-icon {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #FFFFFF;
  font-size: 18px;
  background: var(--ox-text-muted, #94A3B8);
}

.oxb-newtab__shortcut-label {
  font: var(--ox-text-small, 400 12px/16px var(--ox-font-sans));
  font-weight: 500;
  color: var(--ox-text-secondary, #64748B);
}

/* ─────────────── AI Side Panel ─────────────── */
.oxb-panel {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--ox-bg-surface, #FFFFFF);
  overflow: hidden;
  animation: oxbFadeInRight 250ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.oxb-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--ox-space-3, 12px) var(--ox-space-4, 16px);
  border-bottom: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  flex-shrink: 0;
}

.oxb-panel__title {
  display: inline-flex;
  align-items: center;
  gap: var(--ox-space-2, 8px);
  font: var(--ox-text-h3, 600 15px/20px var(--ox-font-sans));
  color: var(--ox-text-primary, #1E293B);
}

.oxb-panel__title i {
  color: var(--ox-accent, #5BA3C5);
  font-size: 14px;
}

.oxb-panel__minimize {
  width: 24px;
  height: 24px;
  border-radius: var(--ox-radius-xs, 6px);
  border: none;
  background: transparent;
  color: var(--ox-text-muted, #94A3B8);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.oxb-panel__minimize:hover {
  background: var(--ox-bg-surface-hover, #F1F3F9);
  color: var(--ox-text-primary, #1E293B);
}

.oxb-panel__tabs {
  padding: var(--ox-space-3, 12px) var(--ox-space-4, 16px);
  flex-shrink: 0;
}

.oxb-pill-group {
  display: flex;
  gap: 2px;
  background: var(--ox-bg-input, #F4F5F9);
  border-radius: var(--ox-radius-sm, 8px);
  padding: 3px;
}

.oxb-pill {
  flex: 1;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: var(--ox-radius-xs, 6px);
  color: var(--ox-text-secondary, #64748B);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
  font-family: inherit;
}

.oxb-pill:hover {
  color: var(--ox-text-primary, #1E293B);
}

.oxb-pill.is-active {
  background: var(--ox-bg-surface, #FFFFFF);
  color: var(--ox-text-primary, #1E293B);
  box-shadow: var(--ox-shadow-sm, 0 1px 2px rgba(15, 23, 42, 0.04));
}

.oxb-panel__body {
  flex: 1;
  overflow-y: auto;
  padding: 0 var(--ox-space-4, 16px) var(--ox-space-4, 16px);
}

/* Summary card */
.oxb-summary,
.oxb-translate {
  background: var(--ox-bg-base, #F8F9FB);
  border: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  border-radius: var(--ox-radius-md, 12px);
  padding: var(--ox-space-4, 16px);
  margin-bottom: var(--ox-space-4, 16px);
  animation: oxbFadeInUp 250ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.oxb-summary__head {
  display: flex;
  align-items: center;
  gap: var(--ox-space-2, 8px);
  margin-bottom: var(--ox-space-3, 12px);
  font: var(--ox-text-body, 400 14px/20px var(--ox-font-sans));
  font-weight: 600;
  color: var(--ox-text-primary, #1E293B);
}

.oxb-summary__head i {
  color: var(--ox-accent, #5BA3C5);
  font-size: 13px;
}

.oxb-summary__text {
  font: var(--ox-text-small, 400 12px/16px var(--ox-font-sans));
  color: var(--ox-text-secondary, #64748B);
  line-height: 1.7;
  margin: 0 0 var(--ox-space-4, 16px);
}

.oxb-summary__points {
  list-style: none;
  margin: 0 0 var(--ox-space-4, 16px);
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--ox-space-3, 12px);
}

.oxb-summary__points li {
  display: flex;
  align-items: flex-start;
  gap: var(--ox-space-2, 8px);
  font: var(--ox-text-small, 400 12px/16px var(--ox-font-sans));
  color: var(--ox-text-primary, #1E293B);
  line-height: 1.5;
}

.oxb-summary__points li i {
  color: var(--ox-success, #22C55E);
  font-size: 12px;
  margin-top: 2px;
  flex-shrink: 0;
}

.oxb-summary__actions {
  display: flex;
  gap: var(--ox-space-2, 8px);
  flex-wrap: wrap;
}

/* Buttons */
.oxb-primary-btn,
.oxb-secondary-btn,
.oxb-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 12px;
  height: 32px;
  border-radius: var(--ox-radius-xs, 6px);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
  font-family: inherit;
  white-space: nowrap;
}

.oxb-primary-btn {
  border: none;
  background: var(--ox-accent-gradient, linear-gradient(135deg, #5BA3C5, #7BB8D4));
  color: #FFFFFF;
  padding: 0 14px;
  height: 36px;
}

.oxb-primary-btn--sm {
  height: 32px;
  padding: 0 12px;
}

.oxb-primary-btn:hover {
  background: var(--ox-accent-gradient-hover, linear-gradient(135deg, #4A93B8, #6AADC9));
  box-shadow: var(--ox-shadow-md, 0 4px 12px rgba(15, 23, 42, 0.06));
}

.oxb-secondary-btn {
  border: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  background: var(--ox-bg-surface, #FFFFFF);
  color: var(--ox-text-secondary, #64748B);
}

.oxb-secondary-btn:hover {
  background: var(--ox-bg-surface-hover, #F1F3F9);
  color: var(--ox-text-primary, #1E293B);
}

.oxb-chip {
  border: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  background: var(--ox-bg-surface, #FFFFFF);
  color: var(--ox-text-secondary, #64748B);
  height: 32px;
}

.oxb-chip:hover {
  background: var(--ox-bg-surface-hover, #F1F3F9);
  color: var(--ox-text-primary, #1E293B);
  border-color: var(--ox-border-hover, rgba(15, 23, 42, 0.14));
}

.oxb-chip--icon {
  justify-content: flex-start;
}

.oxb-chip-row,
.oxb-chip-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ox-space-2, 8px);
  margin-top: var(--ox-space-3, 12px);
}

.oxb-chip-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
}

/* Ask tab body */
.oxb-ask {
  display: flex;
  flex-direction: column;
  gap: var(--ox-space-3, 12px);
}

.oxb-empty-chat {
  border: 1px dashed var(--ox-border-hover, rgba(15, 23, 42, 0.14));
  border-radius: var(--ox-radius-md, 12px);
  background: var(--ox-bg-surface, #FFFFFF);
  padding: var(--ox-space-4, 16px);
}

.oxb-empty-chat h3 {
  margin: 0 0 6px;
  font: var(--ox-text-h3, 600 15px/20px var(--ox-font-sans));
  color: var(--ox-text-primary, #1E293B);
}

.oxb-empty-chat p {
  margin: 0;
  font: var(--ox-text-small, 400 12px/16px var(--ox-font-sans));
  color: var(--ox-text-secondary, #64748B);
  line-height: 1.6;
}

/* Stream */
.oxb-stream {
  display: flex;
  flex-direction: column;
  gap: var(--ox-space-3, 12px);
}

.oxb-msg {
  display: flex;
  gap: var(--ox-space-2, 8px);
  align-items: flex-start;
}

.oxb-msg.is-user {
  justify-content: flex-end;
}

.oxb-msg__avatar {
  width: 28px;
  height: 28px;
  border-radius: var(--ox-radius-sm, 8px);
  background: var(--ox-accent-soft, rgba(91, 163, 197, 0.12));
  color: var(--ox-accent, #5BA3C5);
  font-size: 11px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.oxb-msg__content {
  max-width: 240px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.oxb-msg__bubble {
  padding: 10px 12px;
  border-radius: var(--ox-radius-md, 12px);
  border: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  font-size: 13px;
  line-height: 1.6;
  word-break: break-word;
}

.oxb-msg__bubble--assistant {
  background: var(--ox-bg-surface, #FFFFFF);
  color: var(--ox-text-primary, #1E293B);
}

.oxb-msg__bubble--user {
  background: var(--ox-accent-soft, rgba(91, 163, 197, 0.12));
  color: var(--ox-text-primary, #1E293B);
  border-color: var(--ox-border-accent, rgba(91, 163, 197, 0.40));
}

.oxb-msg__bubble--typing {
  min-width: 56px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.oxb-msg__bubble--typing span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ox-accent, #5BA3C5);
  animation: oxbTyping 1.1s ease-in-out infinite;
}

.oxb-msg__bubble--typing span:nth-child(2) {
  animation-delay: 0.12s;
}

.oxb-msg__bubble--typing span:nth-child(3) {
  animation-delay: 0.24s;
}

.oxb-msg__time {
  font-size: 11px;
  color: var(--ox-text-muted, #94A3B8);
}

.oxb-msg__time.is-user {
  text-align: right;
}

/* Bottom ask input */
.oxb-panel__ask {
  padding: var(--ox-space-3, 12px) var(--ox-space-4, 16px);
  border-top: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  flex-shrink: 0;
  background: var(--ox-bg-surface, #FFFFFF);
}

.oxb-panel__ask-row {
  display: flex;
  align-items: center;
  gap: var(--ox-space-2, 8px);
}

.oxb-panel__ask-input {
  flex: 1;
  height: 34px;
  padding: 0 14px;
  background: var(--ox-bg-input, #F4F5F9);
  border: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  border-radius: var(--ox-radius-sm, 8px);
  font-size: 13px;
  color: var(--ox-text-primary, #1E293B);
  outline: none;
  transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
  font-family: inherit;
}

.oxb-panel__ask-input::placeholder {
  color: var(--ox-text-muted, #94A3B8);
}

.oxb-panel__ask-input:focus {
  border-color: var(--ox-accent, #5BA3C5);
  background: var(--ox-bg-surface, #FFFFFF);
  box-shadow: var(--ox-shadow-glow, 0 0 0 3px rgba(91, 163, 197, 0.15));
}

.oxb-panel__ask-send {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: none;
  background: var(--ox-accent-gradient, linear-gradient(135deg, #5BA3C5, #7BB8D4));
  color: #FFFFFF;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  flex-shrink: 0;
  transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.oxb-panel__ask-send:hover {
  background: var(--ox-accent-gradient-hover, linear-gradient(135deg, #4A93B8, #6AADC9));
  transform: scale(1.05);
  box-shadow: var(--ox-shadow-md, 0 4px 12px rgba(15, 23, 42, 0.06));
}

.oxb-panel__ask-send:active {
  transform: scale(0.95);
}

.oxb-panel__ask-send.is-stopping {
  background: var(--ox-error, #EF4444);
}

/* Markdown body inside assistant messages */
.markdown-body :deep(pre) {
  white-space: pre-wrap;
  word-break: break-word;
}

.markdown-body :deep(code) {
  font-family: var(--ox-font-mono, 'JetBrains Mono', 'Fira Code', monospace);
  font-size: 12px;
}

/* Animations */
@keyframes oxbFadeInRight {
  from {
    opacity: 0;
    transform: translateX(8px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes oxbFadeInUp {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes oxbTyping {
  0%, 100% {
    transform: scale(0.82);
    opacity: 0.45;
  }
  50% {
    transform: scale(1);
    opacity: 1;
  }
}

/* Responsive */
@media (max-width: 1100px) {
  .oxb-panel {
    width: 280px;
  }
}

@media (max-width: 900px) {
  .oxb-split {
    flex-direction: column;
  }

  .oxb-panel {
    width: 100%;
    max-height: 50%;
    border-top: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  }

  .oxb-stage {
    border-right: 0;
  }
}
</style>
