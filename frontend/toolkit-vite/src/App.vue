<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { createToolkitBridge } from './toolkitBridge';

const bridge = createToolkitBridge();
const snapshot = ref(bridge.snapshot());
let refreshTimer = null;

function refreshSnapshot() {
  snapshot.value = bridge.snapshot();
}

function handleSelectItem(item) {
  bridge.selectSubMenu(item);
  refreshSnapshot();
}

function handleSelectOverview() {
  bridge.selectSubMenu({ id: 'tools' });
  refreshSnapshot();
}

function handleSelectCard(card) {
  bridge.openDetail(card.id);
  refreshSnapshot();
}

function handleCardToggle(card, event) {
  if (event && typeof event.stopPropagation === 'function') {
    event.stopPropagation();
  }
  if (!card?.canToggle) return;
  bridge.toggleEnabled(card.id, !!event?.target?.checked).finally(refreshSnapshot);
}

function handleSearchInput(event) {
  bridge.setSearchQuery(event.target.value);
  refreshSnapshot();
}

function handleClearSearch() {
  bridge.setSearchQuery('');
  refreshSnapshot();
}

function handleToggleSection(sectionId) {
  bridge.toggleSectionCollapse(sectionId);
  refreshSnapshot();
}

function handleField(subMenu, field, event) {
  let value;
  if (event.target.type === 'checkbox') {
    value = event.target.checked;
  } else if (event.target.type === 'number') {
    value = Number(event.target.value);
  } else {
    value = event.target.value;
  }
  bridge.updateField(subMenu, field, value);
}

function handleToggle(subMenu, event) {
  bridge.toggleEnabled(subMenu, !!event?.target?.checked).finally(refreshSnapshot);
}

async function handleSave() {
  await bridge.saveSettings();
  refreshSnapshot();
}

function handleOpenDedicatedConfig() {
  bridge.openDedicatedConfig(activeId.value);
  refreshSnapshot();
}

const isZh = computed(() => snapshot.value.isZh);
const sections = computed(() => snapshot.value.sections || []);
const cards = computed(() => snapshot.value.cards || []);
const activeId = computed(() => snapshot.value.activeSubMenu || '');
const detail = computed(() => snapshot.value.detail || {});
const detailForm = computed(() => snapshot.value.detailForm || { kind: '', enabled: null, fields: {} });
const searchQuery = computed(() => snapshot.value.searchQuery || '');
const collapsedSections = computed(() => new Set(snapshot.value.collapsedSections || []));
const isOverview = computed(() => !activeId.value || activeId.value === 'tools');
const hasDetail = computed(() => !!detail.value?.id);
const detailGuide = computed(() => detail.value?.guide || { intro: '', setupSteps: [], links: [] });
const needsDedicatedConfig = computed(() => ['comfyui', 'mcp', 'a2a', 'llmTool', 'customHttpTool', 'sticker'].includes(detailForm.value.kind));

function statusText(card) {
  return card.statusLabel || (card.status === 'running'
    ? (isZh.value ? '运行中' : 'Running')
    : (card.status === 'not-installed' ? (isZh.value ? '未安装' : 'Not installed') : (isZh.value ? '已安装' : 'Installed')));
}

onMounted(() => {
  refreshSnapshot();
  refreshTimer = window.setInterval(refreshSnapshot, 400);
});

onBeforeUnmount(() => {
  if (refreshTimer) {
    window.clearInterval(refreshTimer);
    refreshTimer = null;
  }
});
</script>

<template>
  <div class="ox-vite-toolkit-shell">

    <!-- ════════ Left: Category Sidebar ════════ -->
    <aside class="oxt-categories">
      <div class="oxt-categories__title">{{ isZh ? '工具分类' : 'Categories' }}</div>
      <button
        type="button"
        class="oxt-cat-item oxt-cat-item--overview"
        :class="{ 'is-active': isOverview }"
        @click="handleSelectOverview"
      >
        <span class="oxt-cat-item__icon"><i class="fa-solid fa-table-cells-large"></i></span>
        <span class="oxt-cat-item__label">{{ isZh ? '工具概览' : 'Tool Overview' }}</span>
      </button>

      <div
        v-for="section in sections"
        :key="section.id"
        class="oxt-section"
        :class="{ 'is-collapsed': collapsedSections.has(section.id) }"
      >
        <button
          type="button"
          class="oxt-section__header"
          @click="handleToggleSection(section.id)"
        >
          <i class="fa-solid fa-chevron-down"></i>
          <span>{{ section.label }}</span>
        </button>
        <div class="oxt-section__body">
          <button
            v-for="item in section.items"
            :key="item.id"
            type="button"
            class="oxt-cat-item"
            :class="{ 'is-active': activeId === item.id }"
            @click="handleSelectItem(item)"
          >
            <span class="oxt-cat-item__icon"><i :class="item.icon"></i></span>
            <span class="oxt-cat-item__label">{{ item.label }}</span>
            <span
              v-if="item.status === 'running' || item.status === 'installed'"
              class="oxt-cat-item__badge"
              :class="`is-${item.status}`"
            ></span>
          </button>
        </div>
      </div>
    </aside>

    <!-- ════════ Middle: Overview Cards / Configuration ════════ -->
    <section class="oxt-list">
      <div class="oxt-list__header">
        <div class="oxt-search">
          <i class="fa-solid fa-magnifying-glass oxt-search__icon"></i>
          <input
            type="text"
            class="oxt-search__input"
            :placeholder="isZh ? '搜索工具...' : 'Search tools...'"
            :value="searchQuery"
            @input="handleSearchInput"
          />
          <button
            v-if="searchQuery"
            type="button"
            class="oxt-search__clear"
            :title="isZh ? '清除' : 'Clear'"
            @click="handleClearSearch"
          >
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>

      <div class="oxt-grid-wrapper">
        <template v-if="isOverview">
        <div v-if="cards.length === 0" class="oxt-empty">
          <i class="fa-solid fa-toolbox"></i>
          <span>{{ isZh ? '没有匹配的工具' : 'No matching tools' }}</span>
        </div>
        <div v-else class="oxt-grid">
          <article
            v-for="card in cards"
            :key="card.id"
            class="oxt-card"
            :class="[{ 'is-selected': activeId === card.id }]"
            @click="handleSelectCard(card)"
          >
            <div class="oxt-card__top">
              <div class="oxt-card__icon" :class="`oxt-card__icon--${card.iconColor}`">
                <i :class="card.icon"></i>
              </div>
              <div class="oxt-card__info">
                <div class="oxt-card__name-row">
                  <span class="oxt-card__name">{{ card.label }}</span>
                  <label
                    v-if="card.canToggle"
                    class="oxt-card-switch"
                    :title="card.toggleLabel"
                    @click.stop
                  >
                    <input type="checkbox" :checked="card.enabled" @change="handleCardToggle(card, $event)" />
                    <span class="oxt-card-switch__slider"></span>
                  </label>
                  <span v-else class="oxt-card__status" :class="`is-${card.status}`">{{ statusText(card) }}</span>
                </div>
                <div class="oxt-card__desc">{{ card.description }}</div>
              </div>
            </div>
          </article>
        </div>
        </template>

        <div v-else class="oxt-config-panel">
          <div class="oxt-config-panel__head">
            <div class="oxt-config-panel__icon" :class="`oxt-card__icon--${detail.iconColor}`">
              <i :class="detail.icon"></i>
            </div>
            <div>
              <div class="oxt-config-panel__eyebrow">{{ isZh ? '工具配置' : 'Tool Configuration' }}</div>
              <h2>{{ detail.title }}</h2>
            </div>
          </div>

          <div v-if="detailForm.enabled !== null" class="oxt-config-panel__toggle-row">
            <div>
              <strong>{{ isZh ? '启用工具' : 'Enable Tool' }}</strong>
              <span>{{ isZh ? '开关会同步到实时对话工具状态。' : 'This switch syncs to Live Chat tool state.' }}</span>
            </div>
            <label class="oxt-toggle">
              <input type="checkbox" :checked="detailForm.enabled" @change="handleToggle(activeId, $event)" />
              <span class="oxt-toggle__slider"></span>
            </label>
          </div>

          <div class="oxt-config-panel__section">
            <div class="oxt-detail__section-title">{{ isZh ? '需要填写的配置' : 'Required Configuration' }}</div>
            <div class="oxt-detail__fields">
              <template v-if="detailForm.kind === 'websearch'">
                <label class="oxt-field">
                  <span class="oxt-field__label">{{ isZh ? '搜索引擎' : 'Search Engine' }}</span>
                  <select class="oxt-field__input" :value="detailForm.fields.engine" @change="handleField(activeId, 'engine', $event)">
                    <option value="tavily">Tavily</option>
                    <option value="duckduckgo">DuckDuckGo</option>
                    <option value="searxng">SearXNG</option>
                    <option value="bing">Bing</option>
                    <option value="google">Google</option>
                  </select>
                </label>
                <label class="oxt-field">
                  <span class="oxt-field__label">{{ isZh ? '抓取器' : 'Crawler' }}</span>
                  <select class="oxt-field__input" :value="detailForm.fields.crawler" @change="handleField(activeId, 'crawler', $event)">
                    <option value="jina">Jina</option>
                    <option value="simpleRequest">Simple Request</option>
                    <option value="crawl4ai">Crawl4AI</option>
                    <option value="firecrawl">Firecrawl</option>
                  </select>
                </label>
                <label class="oxt-field">
                  <span class="oxt-field__label">{{ isZh ? '注入时机' : 'Injection Timing' }}</span>
                  <select class="oxt-field__input" :value="detailForm.fields.when" @change="handleField(activeId, 'when', $event)">
                    <option value="before_thinking">{{ isZh ? '推理前' : 'Before thinking' }}</option>
                    <option value="after_thinking">{{ isZh ? '推理后' : 'After thinking' }}</option>
                  </select>
                </label>
              </template>

              <template v-else-if="detailForm.kind === 'interpreter'">
                <label class="oxt-field">
                  <span class="oxt-field__label">{{ isZh ? '执行引擎' : 'Execution Engine' }}</span>
                  <select class="oxt-field__input" :value="detailForm.fields.engine" @change="handleField(activeId, 'engine', $event)">
                    <option value="e2b">E2B</option>
                    <option value="sandbox">Sandbox</option>
                  </select>
                </label>
                <label class="oxt-field">
                  <span class="oxt-field__label">Sandbox URL</span>
                  <input class="oxt-field__input" :value="detailForm.fields.sandbox_url" type="text" @input="handleField(activeId, 'sandbox_url', $event)" />
                </label>
                <label class="oxt-field">
                  <span class="oxt-field__label">E2B API Key</span>
                  <input class="oxt-field__input" :value="detailForm.fields.e2b_api_key" type="password" @input="handleField(activeId, 'e2b_api_key', $event)" />
                </label>
              </template>

              <template v-else-if="detailForm.kind === 'CLI'">
                <label class="oxt-field">
                  <span class="oxt-field__label">{{ isZh ? 'CLI 引擎' : 'CLI Engine' }}</span>
                  <select class="oxt-field__input" :value="detailForm.fields.engine" @change="handleField(activeId, 'engine', $event)">
                    <option value="local">Local</option>
                    <option value="ds">Docker Sandbox</option>
                    <option value="cc">Claude Code</option>
                    <option value="oc">Codex</option>
                    <option value="qc">Qwen Code</option>
                  </select>
                </label>
                <label class="oxt-field">
                  <span class="oxt-field__label">{{ isZh ? '工作区路径' : 'Workspace Path' }}</span>
                  <input class="oxt-field__input" :value="detailForm.fields.workspace" type="text" @input="handleField(activeId, 'workspace', $event)" />
                </label>
                <label class="oxt-field">
                  <span class="oxt-field__label">{{ isZh ? '可见范围' : 'Visibility Scope' }}</span>
                  <select class="oxt-field__input" :value="detailForm.fields.visibilityScope" @change="handleField(activeId, 'visibilityScope', $event)">
                    <option value="workspace">{{ isZh ? '工作区' : 'Workspace' }}</option>
                    <option value="global">{{ isZh ? '全局' : 'Global' }}</option>
                  </select>
                </label>
                <div class="oxt-note">{{ isZh ? '当前权限模式' : 'Permission mode' }}: {{ detailForm.fields.permissionMode }}</div>
              </template>

              <template v-else-if="detailForm.kind === 'document'">
                <label class="oxt-field">
                  <span class="oxt-field__label">{{ isZh ? '返回片段数' : 'Top N Chunks' }}</span>
                  <input class="oxt-field__input" :value="detailForm.fields.top_n" type="number" min="1" step="1" @input="handleField(activeId, 'top_n', $event)" />
                </label>
                <label class="oxt-field">
                  <span class="oxt-field__label">{{ isZh ? '检索时机' : 'Retrieval Timing' }}</span>
                  <select class="oxt-field__input" :value="detailForm.fields.when" @change="handleField(activeId, 'when', $event)">
                    <option value="before_thinking">{{ isZh ? '推理前' : 'Before thinking' }}</option>
                    <option value="after_thinking">{{ isZh ? '推理后' : 'After thinking' }}</option>
                  </select>
                </label>
                <label class="oxt-field oxt-field--inline">
                  <span class="oxt-field__label">{{ isZh ? '启用重排' : 'Enable Rerank' }}</span>
                  <label class="oxt-toggle">
                    <input type="checkbox" :checked="detailForm.fields.is_rerank" @change="handleField(activeId, 'is_rerank', $event)" />
                    <span class="oxt-toggle__slider"></span>
                  </label>
                </label>
                <div class="oxt-note">{{ isZh ? '已配置知识库' : 'Knowledge bases' }}: {{ detailForm.fields.kbCount }}</div>
              </template>

              <template v-else-if="detailForm.kind === 'chromeMCP'">
                <label class="oxt-field">
                  <span class="oxt-field__label">{{ isZh ? '接入类型' : 'Route Type' }}</span>
                  <select class="oxt-field__input" :value="detailForm.fields.type" @change="handleField(activeId, 'type', $event)">
                    <option value="external">{{ isZh ? '外部 MCP' : 'External MCP' }}</option>
                    <option value="internal">{{ isZh ? '内置浏览器' : 'Internal Browser' }}</option>
                  </select>
                </label>
                <label class="oxt-field">
                  <span class="oxt-field__label">MCP Name</span>
                  <input class="oxt-field__input" :value="detailForm.fields.mcpName" type="text" @input="handleField(activeId, 'mcpName', $event)" />
                </label>
                <label class="oxt-field">
                  <span class="oxt-field__label">CDP Port</span>
                  <input class="oxt-field__input" :value="detailForm.fields.CDPport" type="number" min="1" step="1" @input="handleField(activeId, 'CDPport', $event)" />
                </label>
              </template>

              <template v-else-if="detailForm.kind === 'sql'">
                <label class="oxt-field">
                  <span class="oxt-field__label">{{ isZh ? '数据库引擎' : 'Database Engine' }}</span>
                  <select class="oxt-field__input" :value="detailForm.fields.engine" @change="handleField(activeId, 'engine', $event)">
                    <option value="sqlite">SQLite</option>
                    <option value="postgres">Postgres</option>
                    <option value="mysql">MySQL</option>
                  </select>
                </label>
                <label class="oxt-field">
                  <span class="oxt-field__label">Host</span>
                  <input class="oxt-field__input" :value="detailForm.fields.host" type="text" @input="handleField(activeId, 'host', $event)" />
                </label>
                <label class="oxt-field">
                  <span class="oxt-field__label">Port</span>
                  <input class="oxt-field__input" :value="detailForm.fields.port" type="number" min="1" step="1" @input="handleField(activeId, 'port', $event)" />
                </label>
                <label class="oxt-field">
                  <span class="oxt-field__label">DB Name</span>
                  <input class="oxt-field__input" :value="detailForm.fields.dbname" type="text" @input="handleField(activeId, 'dbname', $event)" />
                </label>
                <label class="oxt-field">
                  <span class="oxt-field__label">DB Path</span>
                  <input class="oxt-field__input" :value="detailForm.fields.dbpath" type="text" @input="handleField(activeId, 'dbpath', $event)" />
                </label>
              </template>

              <template v-else-if="detailForm.kind === 'HA'">
                <label class="oxt-field">
                  <span class="oxt-field__label">URL</span>
                  <input class="oxt-field__input" :value="detailForm.fields.url" type="text" @input="handleField(activeId, 'url', $event)" placeholder="http://homeassistant.local:8123" />
                </label>
                <label class="oxt-field">
                  <span class="oxt-field__label">Token</span>
                  <input class="oxt-field__input" :value="detailForm.fields.token" type="password" @input="handleField(activeId, 'token', $event)" />
                </label>
              </template>

              <template v-else-if="detailForm.kind === 'comfyui'">
                <label class="oxt-field">
                  <span class="oxt-field__label">{{ isZh ? '服务地址' : 'Service endpoint' }}</span>
                  <input class="oxt-field__input" :value="detailForm.fields.endpoint" type="text" @input="handleField(activeId, 'endpoint', $event)" />
                </label>
                <div class="oxt-note">{{ isZh ? '已登记服务数' : 'Registered services' }}: {{ detailForm.fields.serverCount }}</div>
              </template>

              <template v-else-if="needsDedicatedConfig">
                <div class="oxt-note">
                  {{ isZh ? '该工具由独立管理模块维护，下面显示当前登记数量。' : 'This tool is maintained by a dedicated manager. Counts are shown below.' }}
                </div>
                <div class="oxt-config-metrics">
                  <span>{{ detailForm.fields.serverCount ?? detailForm.fields.toolCount ?? detailForm.fields.packCount ?? 0 }}</span>
                  <small>{{ isZh ? '已登记' : 'Registered' }}</small>
                  <span>{{ detailForm.fields.enabledCount ?? 0 }}</span>
                  <small>{{ isZh ? '已启用' : 'Enabled' }}</small>
                </div>
                <button type="button" class="oxt-btn" @click="handleOpenDedicatedConfig">
                  <i class="fa-solid fa-arrow-up-right-from-square"></i>
                  <span>{{ isZh ? '打开详细配置' : 'Open detailed config' }}</span>
                </button>
              </template>

              <template v-else>
                <div class="oxt-note">{{ detailForm.fields.summary }}</div>
              </template>
            </div>
          </div>

          <div v-if="detailForm.kind && detailForm.kind !== 'overview'" class="oxt-config-panel__actions">
            <button type="button" class="oxt-btn oxt-btn--ghost" @click="handleSave">
              <i class="fa-solid fa-floppy-disk"></i>
              <span>{{ isZh ? '保存' : 'Save' }}</span>
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- ════════ Right: Guide Panel ════════ -->
    <aside class="oxt-detail">
      <div v-if="!hasDetail" class="oxt-detail__empty">
        <i class="fa-solid fa-toolbox"></i>
        <span>{{ isZh ? '选择一个工具查看详情' : 'Select a tool to view details' }}</span>
      </div>

      <div v-else class="oxt-detail__content oxt-guide">
        <div class="oxt-detail__header">
          <div class="oxt-detail__top">
            <div class="oxt-detail__icon" :class="`oxt-card__icon--${detail.iconColor}`">
              <i :class="detail.icon"></i>
            </div>
            <div class="oxt-detail__title-group">
              <div class="oxt-detail__name">
                <span>{{ detail.title }}</span>
                <span v-if="detail.version" class="oxt-detail__version">{{ detail.version }}</span>
              </div>
              <div class="oxt-detail__status" :class="`is-${detail.status}`">
                <span class="oxt-detail__status-dot" :class="`is-${detail.status}`"></span>
                <span>{{ detail.statusLabel }}</span>
              </div>
            </div>
          </div>
        </div>

        <p class="oxt-detail__desc">{{ detail.description }}</p>

        <div v-if="detail.chips && detail.chips.length" class="oxt-guide__chips">
          <span v-for="chip in detail.chips" :key="chip.text" class="oxt-guide-chip" :class="{ 'is-muted': chip.muted }">
            <i :class="chip.icon"></i>
            <span>{{ chip.text }}</span>
          </span>
        </div>

        <div class="oxt-guide__section">
          <div class="oxt-detail__section-title">{{ isZh ? '功能介绍' : 'Feature' }}</div>
          <p class="oxt-guide__text">{{ detailGuide.intro }}</p>
        </div>

        <div class="oxt-guide__section">
          <div class="oxt-detail__section-title">{{ isZh ? '如何配置' : 'Setup' }}</div>
          <ol class="oxt-guide__steps">
            <li v-for="step in detailGuide.setupSteps" :key="step">{{ step }}</li>
          </ol>
        </div>

        <div v-if="detailGuide.links && detailGuide.links.length" class="oxt-guide__section">
          <div class="oxt-detail__section-title">{{ isZh ? '相关网站' : 'Related Sites' }}</div>
          <div class="oxt-guide__links">
            <a
              v-for="link in detailGuide.links"
              :key="link.url"
              class="oxt-guide-link"
              :href="link.url"
              target="_blank"
              rel="noreferrer"
            >
              <i class="fa-solid fa-arrow-up-right-from-square"></i>
              <span>{{ link.label }}</span>
            </a>
          </div>
        </div>

        <div v-if="detail.runtime" class="oxt-guide__section oxt-guide__section--runtime">
          <div class="oxt-detail__section-title">{{ isZh ? '当前线索' : 'Current Clue' }}</div>
          <div class="oxt-meta-row">
            <span class="oxt-meta-row__label">{{ isZh ? '当前配置' : 'Current' }}</span>
            <span class="oxt-meta-row__value">{{ detail.runtime }}</span>
          </div>
          <div v-if="detail.runtimeMeta" class="oxt-meta-row">
            <span class="oxt-meta-row__label">{{ isZh ? '说明' : 'Note' }}</span>
            <span class="oxt-meta-row__value oxt-meta-row__value--muted">{{ detail.runtimeMeta }}</span>
          </div>
        </div>
      </div>
    </aside>

  </div>
</template>

<style>
#openxnet-vite-toolkit-root {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 0;
  background: var(--ox-bg-base, #F8F9FB);
}

.ox-vite-toolkit-shell,
.ox-vite-toolkit-shell * {
  box-sizing: border-box;
}

.ox-vite-toolkit-shell {
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

/* ─────────── Left: Categories ─────────── */
.oxt-categories {
  width: 220px;
  flex-shrink: 0;
  background: var(--ox-bg-surface, #FFFFFF);
  border-right: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  padding: 16px 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.oxt-categories::-webkit-scrollbar {
  display: none !important;
  width: 0 !important;
  height: 0 !important;
}

.oxt-categories__title {
  padding: 8px 20px;
  font-size: 11px;
  font-weight: 500;
  color: var(--ox-text-muted, #94A3B8);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.oxt-section {
  margin-bottom: 4px;
}

.oxt-section__header {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border: 0;
  background: transparent;
  font-size: 11px;
  font-weight: 600;
  color: var(--ox-text-muted, #94A3B8);
  text-transform: uppercase;
  letter-spacing: 0.6px;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: color 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.oxt-section__header:hover {
  color: var(--ox-text-secondary, #64748B);
}

.oxt-section__header > i {
  font-size: 9px;
  transition: transform 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.oxt-section.is-collapsed .oxt-section__header > i {
  transform: rotate(-90deg);
}

.oxt-section__body {
  display: flex;
  flex-direction: column;
  gap: 1px;
  overflow: hidden;
  max-height: 600px;
  transition: max-height 250ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.oxt-section.is-collapsed .oxt-section__body {
  max-height: 0;
}

.oxt-cat-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 7px 16px 7px 28px;
  border: 0;
  background: none;
  font-size: 14px;
  font-weight: 450;
  color: var(--ox-text-secondary, #64748B);
  cursor: pointer;
  width: 100%;
  text-align: left;
  white-space: nowrap;
  font-family: inherit;
  transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.oxt-cat-item:hover {
  background: var(--ox-bg-surface-hover, #F1F3F9);
  color: var(--ox-text-primary, #1E293B);
}

.oxt-cat-item.is-active {
  background: var(--ox-accent-soft, rgba(91, 163, 197, 0.12));
  color: var(--ox-accent, #5BA3C5);
  font-weight: 500;
}

.oxt-cat-item.is-active:hover {
  background: var(--ox-accent-soft, rgba(91, 163, 197, 0.12));
  color: var(--ox-accent, #5BA3C5);
}

.oxt-cat-item--overview {
  width: calc(100% - 20px);
  margin: 0 10px 8px;
  padding-left: 18px;
  border-radius: var(--ox-radius-sm, 8px);
  background: var(--ox-bg-surface-hover, #F1F3F9);
}

.oxt-cat-item--overview.is-active {
  background: var(--ox-accent-soft, rgba(91, 163, 197, 0.12));
}

.oxt-cat-item__icon {
  width: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  flex-shrink: 0;
}

.oxt-cat-item__label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.oxt-cat-item__badge {
  margin-left: auto;
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.oxt-cat-item__badge.is-running {
  background: var(--ox-success, #22C55E);
  box-shadow: 0 0 0 2px var(--ox-success-soft, rgba(34, 197, 94, 0.10));
}

.oxt-cat-item__badge.is-installed {
  background: var(--ox-info, #3B82F6);
  box-shadow: 0 0 0 2px var(--ox-info-soft, rgba(59, 130, 246, 0.10));
}

/* ─────────── Middle: Tool list ─────────── */
.oxt-list {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.oxt-list__header {
  padding: 20px 20px 16px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 16px;
}

.oxt-search {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
}

.oxt-search__icon {
  position: absolute;
  left: 16px;
  color: var(--ox-text-muted, #94A3B8);
  font-size: 14px;
  pointer-events: none;
}

.oxt-search__input {
  display: block;
  width: 100%;
  padding: 10px 40px 10px 42px;
  background: var(--ox-bg-input, #F4F5F9);
  border: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  border-radius: var(--ox-radius-full, 9999px);
  font-size: 14px;
  color: var(--ox-text-primary, #1E293B);
  outline: none;
  font-family: inherit;
  transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.oxt-search__input::placeholder {
  color: var(--ox-text-muted, #94A3B8);
}

.oxt-search__input:hover {
  background: var(--ox-bg-input-hover, #ECEEF5);
  border-color: var(--ox-border-hover, rgba(15, 23, 42, 0.14));
}

.oxt-search__input:focus {
  background: var(--ox-bg-surface, #FFFFFF);
  border-color: var(--ox-accent, #5BA3C5);
  box-shadow: var(--ox-shadow-glow, 0 0 0 3px rgba(91, 163, 197, 0.15));
}

.oxt-search__clear {
  position: absolute;
  right: 12px;
  width: 22px;
  height: 22px;
  border: 0;
  border-radius: 50%;
  background: var(--ox-bg-surface-hover, #F1F3F9);
  color: var(--ox-text-secondary, #64748B);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.oxt-search__clear:hover {
  background: var(--ox-bg-surface-active, #E8EBF4);
  color: var(--ox-text-primary, #1E293B);
}

.oxt-grid-wrapper {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0 20px 20px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.oxt-detail {
  scrollbar-width: thin;
  scrollbar-color: var(--ox-scrollbar-thumb, rgba(148, 163, 184, 0.56)) transparent;
}

.oxt-grid-wrapper::-webkit-scrollbar {
  display: none !important;
  width: 0 !important;
  height: 0 !important;
}

.oxt-detail::-webkit-scrollbar {
  width: var(--ox-scrollbar-size, 10px);
  height: var(--ox-scrollbar-size, 10px);
  background: transparent;
}

.oxt-detail::-webkit-scrollbar-track,
.oxt-detail::-webkit-scrollbar-corner {
  background: transparent;
}

.oxt-detail::-webkit-scrollbar-thumb {
  background-color: var(--ox-scrollbar-thumb, rgba(148, 163, 184, 0.56));
  border: var(--ox-scrollbar-inset, 2px) solid transparent;
  border-radius: var(--ox-scrollbar-radius, 999px);
  background-clip: padding-box;
  min-height: 36px;
  min-width: 36px;
}

.oxt-detail::-webkit-scrollbar-thumb:hover {
  background-color: var(--ox-scrollbar-thumb-hover, rgba(100, 116, 139, 0.78));
}

.oxt-detail::-webkit-scrollbar-thumb:active {
  background-color: var(--ox-scrollbar-thumb-active, rgba(71, 85, 105, 0.92));
}

.oxt-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  gap: 12px;
  color: var(--ox-text-muted, #94A3B8);
  font-size: 14px;
}

.oxt-empty i {
  font-size: 32px;
  opacity: 0.4;
}

.oxt-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
}

.oxt-card {
  background: var(--ox-bg-surface, #FFFFFF);
  border: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  border-radius: var(--ox-radius-md, 12px);
  padding: 14px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.oxt-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--ox-shadow-card-hover, 0 4px 16px rgba(91, 163, 197, 0.10), 0 1px 3px rgba(15, 23, 42, 0.04));
  border-color: var(--ox-border-hover, rgba(15, 23, 42, 0.14));
}

.oxt-card.is-selected {
  border-color: var(--ox-border-accent, rgba(91, 163, 197, 0.40));
  box-shadow: 0 0 0 1px var(--ox-accent-soft, rgba(91, 163, 197, 0.12)), var(--ox-shadow-sm, 0 1px 2px rgba(15, 23, 42, 0.04));
}

.oxt-card__top {
  display: flex;
  align-items: center;
  gap: 12px;
}

.oxt-card__icon {
  width: 36px;
  height: 36px;
  border-radius: var(--ox-radius-sm, 8px);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  flex-shrink: 0;
}

.oxt-card__icon--green {
  background: var(--ox-success-soft, rgba(34, 197, 94, 0.10));
  color: #16A34A;
}

.oxt-card__icon--blue {
  background: var(--ox-info-soft, rgba(59, 130, 246, 0.10));
  color: var(--ox-info, #3B82F6);
}

.oxt-card__icon--gray {
  background: var(--ox-bg-surface-hover, #F1F3F9);
  color: var(--ox-text-muted, #94A3B8);
}

.oxt-card__icon--accent {
  background: var(--ox-accent-soft, rgba(91, 163, 197, 0.12));
  color: #5BA3C5;
}

.oxt-card__icon--purple {
  background: #EDE9FE;
  color: #7C3AED;
}

.oxt-card__icon--orange {
  background: #FEF3C7;
  color: #D97706;
}

.oxt-card__icon--pink {
  background: #FDF2F8;
  color: #DB2777;
}

.oxt-card__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.oxt-card__name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.oxt-card__name {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: var(--ox-text-primary, #1E293B);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.oxt-card__status {
  display: inline-flex;
  align-items: center;
  padding: 1px 8px;
  border-radius: var(--ox-radius-full, 9999px);
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;
}

.oxt-card__status.is-running {
  background: var(--ox-success-soft, rgba(34, 197, 94, 0.10));
  color: #16A34A;
}

.oxt-card__status.is-installed {
  background: var(--ox-info-soft, rgba(59, 130, 246, 0.10));
  color: var(--ox-info, #3B82F6);
}

.oxt-card__status.is-not-installed {
  background: var(--ox-bg-surface-hover, #F1F3F9);
  color: var(--ox-text-muted, #94A3B8);
}

.oxt-card-switch {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 34px;
  height: 20px;
  cursor: pointer;
  flex-shrink: 0;
}

.oxt-card-switch input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.oxt-card-switch__slider {
  width: 34px;
  height: 20px;
  border-radius: var(--ox-radius-full, 9999px);
  background: var(--ox-border-strong, rgba(148, 163, 184, 0.35));
  transition: background 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.oxt-card-switch__slider::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #FFFFFF;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.22);
  transition: transform 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.oxt-card-switch input:checked + .oxt-card-switch__slider {
  background: var(--ox-accent, #5BA3C5);
}

.oxt-card-switch input:checked + .oxt-card-switch__slider::after {
  transform: translateX(14px);
}

.oxt-card__desc {
  font-size: 12px;
  color: var(--ox-text-muted, #94A3B8);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.4;
}

/* ─────────── Middle: Configuration panel ─────────── */
.oxt-config-panel {
  min-height: 100%;
  background: var(--ox-bg-surface, #FFFFFF);
  border: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  border-radius: var(--ox-radius-md, 12px);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  box-shadow: var(--ox-shadow-sm, 0 1px 2px rgba(15, 23, 42, 0.04));
}

.oxt-config-panel__head {
  display: flex;
  align-items: center;
  gap: 14px;
  padding-bottom: 2px;
}

.oxt-config-panel__icon {
  width: 44px;
  height: 44px;
  border-radius: var(--ox-radius-sm, 8px);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.oxt-config-panel__eyebrow {
  font-size: 11px;
  font-weight: 600;
  color: var(--ox-text-muted, #94A3B8);
  text-transform: uppercase;
  letter-spacing: 0.4px;
  margin-bottom: 4px;
}

.oxt-config-panel__head h2 {
  margin: 0;
  font-size: 22px;
  line-height: 1.25;
  font-weight: 650;
  color: var(--ox-text-primary, #1E293B);
}

.oxt-config-panel__toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
  border: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  border-radius: var(--ox-radius-sm, 8px);
  background: var(--ox-bg-surface-hover, #F1F3F9);
}

.oxt-config-panel__toggle-row > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.oxt-config-panel__toggle-row strong {
  font-size: 14px;
  color: var(--ox-text-primary, #1E293B);
}

.oxt-config-panel__toggle-row span {
  font-size: 12px;
  color: var(--ox-text-muted, #94A3B8);
  line-height: 1.4;
}

.oxt-config-panel__section {
  min-width: 0;
}

.oxt-config-panel__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: auto;
  padding-top: 2px;
}

.oxt-config-metrics {
  display: grid;
  grid-template-columns: auto 1fr auto 1fr;
  align-items: baseline;
  gap: 6px 10px;
  padding: 12px 14px;
  border: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  border-radius: var(--ox-radius-sm, 8px);
  background: var(--ox-bg-input, #F4F5F9);
}

.oxt-config-metrics span {
  font-size: 22px;
  font-weight: 650;
  color: var(--ox-text-primary, #1E293B);
}

.oxt-config-metrics small {
  font-size: 12px;
  color: var(--ox-text-muted, #94A3B8);
}

/* ─────────── Right: Detail panel ─────────── */
.oxt-detail {
  width: 360px;
  flex-shrink: 0;
  background: var(--ox-bg-surface, #FFFFFF);
  border-left: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
}

.oxt-detail__empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--ox-text-muted, #94A3B8);
  padding: 32px;
  text-align: center;
}

.oxt-detail__empty i {
  font-size: 32px;
  opacity: 0.4;
}

.oxt-detail__empty span {
  font-size: 14px;
}

.oxt-detail__content {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.oxt-detail__header {
  padding: 20px 20px 0;
}

.oxt-detail__top {
  display: flex;
  align-items: center;
  gap: 14px;
}

.oxt-detail__icon {
  width: 48px;
  height: 48px;
  border-radius: var(--ox-radius-md, 12px);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.oxt-detail__title-group {
  flex: 1;
  min-width: 0;
}

.oxt-detail__name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 600;
  color: var(--ox-text-primary, #1E293B);
}

.oxt-detail__version {
  display: inline-flex;
  align-items: center;
  padding: 1px 8px;
  border-radius: var(--ox-radius-full, 9999px);
  font-size: 11px;
  font-weight: 500;
  background: var(--ox-accent-soft, rgba(91, 163, 197, 0.12));
  color: var(--ox-accent, #5BA3C5);
}

.oxt-detail__status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  margin-top: 4px;
}

.oxt-detail__status.is-running {
  color: #16A34A;
}

.oxt-detail__status.is-installed {
  color: var(--ox-info, #3B82F6);
}

.oxt-detail__status.is-not-installed {
  color: var(--ox-text-muted, #94A3B8);
}

.oxt-detail__status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.oxt-detail__status-dot.is-running {
  background: var(--ox-success, #22C55E);
  box-shadow: 0 0 0 2px var(--ox-success-soft, rgba(34, 197, 94, 0.10));
}

.oxt-detail__status-dot.is-installed {
  background: var(--ox-info, #3B82F6);
  box-shadow: 0 0 0 2px var(--ox-info-soft, rgba(59, 130, 246, 0.10));
}

.oxt-detail__status-dot.is-not-installed {
  background: var(--ox-text-muted, #94A3B8);
  box-shadow: 0 0 0 2px var(--ox-bg-surface-hover, #F1F3F9);
}

.oxt-detail__desc {
  font-size: 13px;
  line-height: 1.7;
  color: var(--ox-text-secondary, #64748B);
  padding: 16px 20px 0;
  margin: 0;
}

.oxt-guide__chips {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 20px 0;
}

.oxt-guide-chip {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 9px 10px;
  border: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  border-radius: var(--ox-radius-sm, 8px);
  background: var(--ox-bg-surface-hover, #F1F3F9);
  color: var(--ox-text-secondary, #64748B);
  font-size: 12px;
  line-height: 1.45;
}

.oxt-guide-chip i {
  margin-top: 2px;
  color: var(--ox-accent, #5BA3C5);
  flex-shrink: 0;
}

.oxt-guide-chip.is-muted {
  background: transparent;
  color: var(--ox-text-muted, #94A3B8);
}

.oxt-guide__section {
  padding: 18px 20px 0;
}

.oxt-guide__text {
  margin: 0;
  font-size: 13px;
  line-height: 1.75;
  color: var(--ox-text-secondary, #64748B);
}

.oxt-guide__steps {
  margin: 0;
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  color: var(--ox-text-secondary, #64748B);
  font-size: 13px;
  line-height: 1.65;
}

.oxt-guide__steps li::marker {
  color: var(--ox-accent, #5BA3C5);
  font-weight: 650;
}

.oxt-guide__links {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.oxt-guide-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--ox-radius-sm, 8px);
  border: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  background: var(--ox-bg-surface-hover, #F1F3F9);
  color: var(--ox-text-primary, #1E293B);
  text-decoration: none;
  font-size: 13px;
  font-weight: 500;
  transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.oxt-guide-link:hover {
  border-color: var(--ox-border-hover, rgba(15, 23, 42, 0.14));
  background: var(--ox-bg-input-hover, #ECEEF5);
  color: var(--ox-accent, #5BA3C5);
}

.oxt-guide-link i {
  font-size: 11px;
  color: var(--ox-text-muted, #94A3B8);
  flex-shrink: 0;
}

.oxt-guide__section--runtime {
  padding-bottom: 24px;
}

.oxt-divider {
  border: 0;
  border-top: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  margin: 16px 20px;
}

.oxt-detail__toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
}

.oxt-detail__toggle-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--ox-text-secondary, #64748B);
}

.oxt-toggle {
  position: relative;
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  flex-shrink: 0;
}

.oxt-toggle input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}

.oxt-toggle__slider {
  width: 36px;
  height: 20px;
  background: var(--ox-border, rgba(15, 23, 42, 0.08));
  border-radius: 10px;
  position: relative;
  transition: background 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.oxt-toggle__slider::after {
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

.oxt-toggle input:checked + .oxt-toggle__slider {
  background: var(--ox-accent, #5BA3C5);
}

.oxt-toggle input:checked + .oxt-toggle__slider::after {
  transform: translateX(16px);
}

.oxt-detail__section {
  padding: 0 20px;
}

.oxt-detail__section--meta {
  padding-bottom: 24px;
}

.oxt-detail__section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--ox-text-primary, #1E293B);
  margin-bottom: 14px;
}

.oxt-detail__fields {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.oxt-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.oxt-field--inline {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.oxt-field__label {
  font-size: 12px;
  font-weight: 500;
  color: var(--ox-text-secondary, #64748B);
}

.oxt-field__input {
  width: 100%;
  padding: 8px 12px;
  background: var(--ox-bg-input, #F4F5F9);
  border: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  border-radius: var(--ox-radius-sm, 8px);
  font-size: 13px;
  color: var(--ox-text-primary, #1E293B);
  font-family: inherit;
  outline: none;
  transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.oxt-field__input:hover:not(:disabled) {
  background: var(--ox-bg-input-hover, #ECEEF5);
  border-color: var(--ox-border-hover, rgba(15, 23, 42, 0.14));
}

.oxt-field__input:focus {
  background: var(--ox-bg-surface, #FFFFFF);
  border-color: var(--ox-accent, #5BA3C5);
  box-shadow: var(--ox-shadow-glow, 0 0 0 3px rgba(91, 163, 197, 0.15));
}

select.oxt-field__input {
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394A3B8' d='M2.5 4.5L6 8l3.5-3.5'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 32px;
  cursor: pointer;
}

.oxt-note {
  padding: 8px 12px;
  background: var(--ox-bg-surface-hover, #F1F3F9);
  border-radius: var(--ox-radius-sm, 8px);
  font-size: 12px;
  color: var(--ox-text-secondary, #64748B);
  line-height: 1.5;
}

.oxt-detail__actions {
  display: flex;
  gap: 8px;
  padding: 16px 20px;
}

.oxt-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  border-radius: var(--ox-radius-sm, 8px);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
  background: var(--ox-bg-surface, #FFFFFF);
  color: var(--ox-text-secondary, #64748B);
}

.oxt-btn:hover {
  background: var(--ox-bg-surface-hover, #F1F3F9);
  color: var(--ox-text-primary, #1E293B);
  border-color: var(--ox-border-hover, rgba(15, 23, 42, 0.14));
}

.oxt-btn:active {
  transform: scale(0.97);
}

.oxt-btn--ghost {
  background: transparent;
}

.oxt-meta-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;
}

.oxt-meta-row__label {
  font-size: 11px;
  font-weight: 500;
  color: var(--ox-text-muted, #94A3B8);
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.oxt-meta-row__value {
  font-size: 13px;
  color: var(--ox-text-primary, #1E293B);
  word-break: break-word;
}

.oxt-meta-row__value--muted {
  color: var(--ox-text-secondary, #64748B);
  font-size: 12px;
  line-height: 1.5;
}

/* ─────────── Responsive ─────────── */
@media (max-width: 1280px) {
  .oxt-detail {
    width: 320px;
  }
}

@media (max-width: 1100px) {
  .oxt-categories {
    width: 200px;
  }
  .oxt-detail {
    width: 300px;
  }
}

@media (max-width: 900px) {
  .ox-vite-toolkit-shell {
    flex-direction: column;
  }
  .oxt-categories,
  .oxt-detail {
    width: 100%;
    max-height: 240px;
    border-right: 0;
    border-left: 0;
    border-bottom: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
  }
  .oxt-detail {
    border-top: 1px solid var(--ox-border, rgba(15, 23, 42, 0.08));
    border-bottom: 0;
    max-height: 50%;
  }
}
</style>
