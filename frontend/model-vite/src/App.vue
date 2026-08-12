<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { createModelBridge } from './modelBridge';

const bridge = createModelBridge();
const snapshot = ref(bridge.snapshot());
const serviceDetailRef = ref(null);
const actionFeedback = ref({
  visible: false,
  text: '',
});
let refreshTimer = null;
let actionFeedbackTimer = null;

function refreshSnapshot() {
  snapshot.value = bridge.snapshot();
}

function showActionFeedback(text) {
  actionFeedback.value = {
    visible: true,
    text: String(text || '').trim(),
  };
  if (actionFeedbackTimer) {
    window.clearTimeout(actionFeedbackTimer);
  }
  actionFeedbackTimer = window.setTimeout(() => {
    actionFeedback.value.visible = false;
  }, 2600);
}

function handleTabSelect(tabId) {
  bridge.selectTab(tabId);
  refreshSnapshot();
}

function handlePrepareAddProvider() {
  bridge.openAddDialog();
  refreshSnapshot();
}

function handleProviderCardSelect(providerId) {
  bridge.selectProviderCard(providerId);
  refreshSnapshot();
}

function handleServiceField(field, event) {
  bridge.updateServiceField(field, event.target.value);
}

function handleServiceModelChip(modelValue) {
  bridge.updateServiceField('modelId', modelValue);
  refreshSnapshot();
}

function handleServiceVendor(event) {
  bridge.selectServiceVendor(event.target.value);
  refreshSnapshot();
}

function handleModalVendorSelect(value) {
  bridge.selectServiceVendor(value);
  refreshSnapshot();
}

// —— per-card 内联表单：直接读写每张卡的字段 ——
function handleCardField(providerId, field, event) {
  const value = event && event.target ? event.target.value : event;
  bridge.updateProviderFieldById(providerId, field, value);
  refreshSnapshot();
}

function handleCardModelChip(providerId, modelValue) {
  bridge.updateProviderFieldById(providerId, 'modelId', modelValue);
  refreshSnapshot();
}

function handleCopyText(text) {
  if (!text) return;
  bridge.copyToClipboard(text);
  showActionFeedback(isZh.value ? '已复制到剪贴板' : 'Copied to clipboard');
}

function handleCardCopy(providerId) {
  bridge.copyProviderById(providerId);
  refreshSnapshot();
  showActionFeedback(isZh.value ? '已复制为新服务商' : 'Provider duplicated');
}

function handleCardWebsite(providerId) {
  bridge.openProviderWebsiteById(providerId);
}

function handleCardFetch(providerId) {
  bridge.fetchModelsById(providerId);
  refreshSnapshot();
}

function handleCardValidate(providerId) {
  bridge.validateProviderById(providerId);
  refreshSnapshot();
}

function handleCardRemove(providerId) {
  bridge.removeProviderById(providerId);
  refreshSnapshot();
  showActionFeedback(isZh.value ? '服务商已删除' : 'Provider removed');
}

function handleCardSetMain(providerId) {
  bridge.selectProviderAsMain(providerId);
  refreshSnapshot();
  showActionFeedback(isZh.value ? '已设为主模型服务商' : 'Set as main provider');
}

const cardKeyVisibility = ref({}); // providerId -> true/false 控制 API Key 明文

function toggleCardKeyVisible(providerId) {
  cardKeyVisibility.value = {
    ...cardKeyVisibility.value,
    [providerId]: !cardKeyVisibility.value[providerId],
  };
}

// —— Add Provider Dialog ——
const dialogSearch = ref('');
const dialogFilter = ref('all'); // all | cloud | local
const dialogPage = ref(1);
const VENDOR_PAGE_SIZE = 14; // 2 行 × 7 列，固定尺寸避免按钮被遮挡

function handleDialogVendorSelect(vendor) {
  bridge.selectVendorInDialog(vendor);
  refreshSnapshot();
}

function handleDialogField(field, event) {
  const value = event && event.target ? event.target.value : event;
  bridge.setDialogField(field, value);
  refreshSnapshot();
}

function handleDialogClose() {
  bridge.closeAddDialog();
  dialogSearch.value = '';
  dialogFilter.value = 'all';
  dialogPage.value = 1;
  refreshSnapshot();
}

async function handleDialogConfirm() {
  const ok = await bridge.confirmAddDialog();
  refreshSnapshot();
  if (ok) {
    dialogSearch.value = '';
    dialogFilter.value = 'all';
    dialogPage.value = 1;
    showActionFeedback(isZh.value ? '服务商已添加' : 'Provider added');
  }
}

function handleDialogVendorWebsite() {
  bridge.openVendorWebsiteFromDialog();
}

const addDialog = computed(() => snapshot.value.addDialog || { visible: false, vendorOptions: [] });

const filteredVendorOptions = computed(() => {
  const list = addDialog.value.vendorOptions || [];
  const q = String(dialogSearch.value || '').trim().toLowerCase();
  const filterMode = dialogFilter.value;
  return list.filter((item) => {
    if (filterMode === 'cloud' && item.category === 'local') return false;
    if (filterMode === 'local' && item.category !== 'local') return false;
    if (!q) return true;
    return String(item.label || '').toLowerCase().includes(q)
      || String(item.value || '').toLowerCase().includes(q);
  });
});

// 搜索 / 切换 tab 时回到第一页
watch([dialogSearch, dialogFilter], () => {
  dialogPage.value = 1;
});

const totalVendorPages = computed(() => {
  const total = filteredVendorOptions.value.length;
  if (total <= 0) return 1;
  return Math.max(1, Math.ceil(total / VENDOR_PAGE_SIZE));
});

const safeDialogPage = computed(() => {
  const p = Number(dialogPage.value || 1);
  if (!Number.isFinite(p) || p < 1) return 1;
  return Math.min(p, totalVendorPages.value);
});

const pagedVendorOptions = computed(() => {
  const list = filteredVendorOptions.value;
  const start = (safeDialogPage.value - 1) * VENDOR_PAGE_SIZE;
  return list.slice(start, start + VENDOR_PAGE_SIZE);
});

function gotoPage(p) {
  const total = totalVendorPages.value;
  let next = Number(p);
  if (!Number.isFinite(next)) next = 1;
  if (next < 1) next = 1;
  if (next > total) next = total;
  dialogPage.value = next;
}

const selectedVendorOption = computed(() =>
  (addDialog.value.vendorOptions || []).find((item) => item.selected) || null
);

async function handleSaveService() {
  const wasTemplate = !!service.value.current?.isTemplate;
  const result = await bridge.saveServiceProvider();
  refreshSnapshot();
  if (!result?.ok) {
    return;
  }
  showActionFeedback(
    wasTemplate
      ? (isZh.value ? '供应商已加入列表' : 'Provider added to the list')
      : (isZh.value ? '当前服务商已保存/应用' : 'Provider saved/applied')
  );
}

function handleValidateProvider() {
  bridge.validateCurrentProvider();
  refreshSnapshot();
}

function handleFetchModels() {
  bridge.fetchCurrentProviderModels();
  refreshSnapshot();
}

function handleCopyProvider() {
  bridge.copyCurrentProvider();
  refreshSnapshot();
}

function handleRemoveProvider() {
  bridge.removeCurrentProvider();
  refreshSnapshot();
}

function handleOpenWebsite() {
  bridge.openCurrentProviderWebsite();
}

function handleSlotProvider(slotId, event) {
  bridge.selectSlotProvider(slotId, event.target.value);
  refreshSnapshot();
}

function handleSlotField(slotId, field, event) {
  let value = event.target.value;
  if (field === 'temperature' || field === 'top_p') {
    value = Number(value);
  }
  if (field === 'max_tokens') {
    value = Number(value);
  }
  bridge.updateSlotField(slotId, field, value);
}

function handleSlotModelChip(slotId, modelValue) {
  bridge.updateSlotField(slotId, 'model', modelValue);
  refreshSnapshot();
}

const isZh = computed(() => snapshot.value.isZh);
const tabs = computed(() => snapshot.value.tabs || []);
const activeTab = computed(() => snapshot.value.activeTab || 'service');
const service = computed(() => snapshot.value.service || { providers: [], current: {} });
const addProviderOptions = computed(() => service.value.current.addOptions || []);
const slotMap = computed(() => Object.fromEntries((snapshot.value.slots || []).map((slot) => [slot.id, slot])));
const activeSlot = computed(() => slotMap.value[activeTab.value] || null);

onMounted(() => {
  refreshSnapshot();
  refreshTimer = window.setInterval(refreshSnapshot, 400);
});

onBeforeUnmount(() => {
  if (refreshTimer) {
    window.clearInterval(refreshTimer);
    refreshTimer = null;
  }
  if (actionFeedbackTimer) {
    window.clearTimeout(actionFeedbackTimer);
    actionFeedbackTimer = null;
  }
});
</script>

<template>
  <div class="ox-vite-model-shell">
    <div class="ox-vite-model-header">
      <div>
        <h1>{{ isZh ? '模型配置' : 'Model Configuration' }}</h1>
        <p>{{ isZh ? '管理 AI 模型提供商和 API 密钥' : 'Manage providers, API keys, and runtime model slots.' }}</p>
      </div>
      <button
        type="button"
        class="ox-vite-model-primary-btn"
        @click="handlePrepareAddProvider"
      >
        <i class="fa-solid fa-plus"></i>
        <span>{{ isZh ? '添加提供商' : 'Add Provider' }}</span>
      </button>
    </div>

    <div class="ox-vite-model-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        class="ox-vite-model-tab"
        :class="{ active: activeTab === tab.id }"
        @click="handleTabSelect(tab.id)"
      >
        {{ tab.label }}
      </button>
    </div>

    <transition name="ox-vite-model-feedback">
      <div v-if="actionFeedback.visible" class="ox-vite-model-feedback">
        <i class="fa-solid fa-circle-check"></i>
        <span>{{ actionFeedback.text }}</span>
      </div>
    </transition>

    <div v-if="activeTab === 'service'" class="ox-vite-model-service">
      <div class="oxm-service-grid">
        <div v-if="!service.providers.length" class="oxm-service-empty">
          <i class="fa-solid fa-plug-circle-plus"></i>
          <strong>{{ isZh ? '还没有已配置的服务商' : 'No configured providers yet' }}</strong>
          <p>{{ isZh ? '点击右下角磁贴添加新服务商，并在卡片里直接填写 API 地址、密钥与模型 ID。' : 'Click the “Add Provider” tile to start; fill in URL, key and model directly on the card.' }}</p>
        </div>

        <!-- 已配置 provider 磁贴：每张卡内嵌完整表单 -->
        <div
          v-for="provider in service.providers"
          :key="provider.id"
          class="oxm-provider-card"
          :class="{ 'is-current-main': provider.active, [`is-${provider.statusTone}`]: !!provider.statusTone }"
        >
          <!-- 顶部：logo + 4 个圆形操作按钮 -->
          <div class="oxm-provider-card__head">
            <div class="oxm-provider-card__brand">
              <img :src="provider.logo" :alt="provider.displayName" class="oxm-provider-card__logo" />
              <div class="oxm-provider-card__name">
                <strong>{{ provider.displayName }}</strong>
                <span v-if="provider.active" class="oxm-provider-card__main-tag">{{ isZh ? '主服务商' : 'Main' }}</span>
              </div>
            </div>
            <div class="oxm-provider-card__actions">
              <button
                type="button"
                class="oxm-icon-btn"
                :title="isZh ? '复制为新卡' : 'Duplicate'"
                @click="handleCardCopy(provider.id)"
              >
                <i class="fa-solid fa-copy"></i>
              </button>
              <button
                v-if="provider.hasWebsite"
                type="button"
                class="oxm-icon-btn"
                :title="isZh ? '获取 API Key' : 'Get API Key'"
                @click="handleCardWebsite(provider.id)"
              >
                <i class="fa-solid fa-key"></i>
              </button>
              <button
                type="button"
                class="oxm-icon-btn oxm-icon-btn--accent"
                :title="isZh ? '拉取模型列表' : 'Fetch model list'"
                :disabled="provider.isValidating"
                @click="handleCardFetch(provider.id)"
              >
                <i class="fa-solid fa-magnifying-glass"></i>
              </button>
              <button
                type="button"
                class="oxm-icon-btn oxm-icon-btn--danger"
                :title="isZh ? '删除' : 'Delete'"
                @click="handleCardRemove(provider.id)"
              >
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>

          <!-- 内联表单 -->
          <div class="oxm-provider-card__form">
            <div class="oxm-field">
              <label>
                <span>{{ isZh ? 'API 地址' : 'API URL' }}</span>
                <button type="button" class="oxm-field-copy" :title="isZh ? '复制' : 'Copy'" @click="handleCopyText(provider.url)">
                  <i class="fa-solid fa-copy"></i>
                </button>
              </label>
              <input
                type="text"
                :value="provider.url"
                :placeholder="isZh ? 'https://api.example.com/v1' : 'https://api.example.com/v1'"
                @input="handleCardField(provider.id, 'url', $event)"
              />
            </div>

            <div class="oxm-field">
              <label>
                <span>{{ isZh ? 'API 密钥' : 'API Key' }}</span>
                <button type="button" class="oxm-field-copy" :title="isZh ? '复制' : 'Copy'" @click="handleCopyText(provider.apiKey)">
                  <i class="fa-solid fa-copy"></i>
                </button>
              </label>
              <div class="oxm-input-with-affix">
                <input
                  :type="cardKeyVisibility[provider.id] ? 'text' : 'password'"
                  :value="provider.apiKey"
                  :placeholder="isZh ? 'sk-...' : 'sk-...'"
                  @input="handleCardField(provider.id, 'apiKey', $event)"
                />
                <button
                  type="button"
                  class="oxm-input-affix"
                  :title="cardKeyVisibility[provider.id] ? (isZh ? '隐藏' : 'Hide') : (isZh ? '显示' : 'Show')"
                  @click="toggleCardKeyVisible(provider.id)"
                >
                  <i :class="cardKeyVisibility[provider.id] ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'"></i>
                </button>
              </div>
            </div>

            <div class="oxm-field">
              <label>
                <span>{{ isZh ? '模型 ID（可手动填写）' : 'Model ID (manual or list)' }}</span>
                <button type="button" class="oxm-field-copy" :title="isZh ? '复制' : 'Copy'" @click="handleCopyText(provider.modelId)">
                  <i class="fa-solid fa-copy"></i>
                </button>
              </label>
              <input
                v-if="!provider.rawModels || !provider.rawModels.length"
                type="text"
                :value="provider.modelId"
                :placeholder="isZh ? '点击放大镜可获取模型列表' : 'Type or click the search icon to fetch'"
                @input="handleCardField(provider.id, 'modelId', $event)"
              />
              <div v-else class="oxm-model-select">
                <input
                  type="text"
                  :value="provider.modelId"
                  :placeholder="isZh ? '选择或输入模型' : 'Select or type a model'"
                  @input="handleCardField(provider.id, 'modelId', $event)"
                />
                <details class="oxm-model-list">
                  <summary>
                    <i class="fa-solid fa-chevron-down"></i>
                  </summary>
                  <div class="oxm-model-list__items">
                    <button
                      v-for="model in provider.rawModels"
                      :key="`${provider.id}-${model.value}`"
                      type="button"
                      class="oxm-model-list__item"
                      :class="{ 'is-active': provider.modelId === model.value }"
                      @click="handleCardModelChip(provider.id, model.value)"
                    >
                      {{ model.label }}
                    </button>
                  </div>
                </details>
              </div>
            </div>

            <div v-if="provider.validationMessage" class="oxm-validation" :class="`is-${provider.validationStatus || 'success'}`">
              <i class="fa-solid fa-circle-info"></i>
              <span>{{ provider.validationMessage }}</span>
            </div>

            <div v-if="!provider.active" class="oxm-card-footer">
              <button type="button" class="oxm-secondary-btn" @click="handleCardSetMain(provider.id)">
                <i class="fa-solid fa-circle-check"></i>
                <span>{{ isZh ? '设为主服务商' : 'Set as main' }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- 添加新供应商：磁贴 -->
        <button type="button" class="oxm-provider-card oxm-provider-card--add" @click="handlePrepareAddProvider">
          <div class="oxm-add-tile__plus">
            <i class="fa-solid fa-plus"></i>
          </div>
          <span class="oxm-add-tile__label">{{ isZh ? '添加新供应商' : 'Add New Provider' }}</span>
        </button>
      </div>

      <!-- ╔════════════════════════════════════════════════════════════╗
           Add Provider Dialog —— vendor 网格 + 搜索 + 全部/云端/本地 + 表单
           ╚════════════════════════════════════════════════════════════╝ -->
      <transition name="oxm-dialog">
        <div v-if="addDialog.visible" class="oxm-dialog-mask" @click.self="handleDialogClose">
          <div class="oxm-dialog-shell">
            <div class="oxm-dialog__head">
              <h2>{{ isZh ? '添加新供应商' : 'Add New Provider' }}</h2>
              <button type="button" class="oxm-icon-btn" :title="isZh ? '关闭' : 'Close'" @click="handleDialogClose">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div class="oxm-dialog__body">
              <div class="oxm-dialog__filter-row">
                <div class="oxm-dialog__search">
                  <i class="fa-solid fa-magnifying-glass"></i>
                  <input
                    v-model="dialogSearch"
                    type="text"
                    :placeholder="isZh ? '搜索供应商' : 'Search providers'"
                  />
                </div>
                <div class="oxm-dialog__filter-tabs">
                  <button type="button" :class="{ 'is-active': dialogFilter === 'all' }" @click="dialogFilter = 'all'">{{ isZh ? '全部' : 'All' }}</button>
                  <button type="button" :class="{ 'is-active': dialogFilter === 'cloud' }" @click="dialogFilter = 'cloud'">{{ isZh ? '云端' : 'Cloud' }}</button>
                  <button type="button" :class="{ 'is-active': dialogFilter === 'local' }" @click="dialogFilter = 'local'">{{ isZh ? '本地' : 'Local' }}</button>
                </div>
              </div>

              <div class="oxm-vendor-grid">
                <button
                  v-for="item in pagedVendorOptions"
                  :key="item.value"
                  type="button"
                  class="oxm-vendor-card"
                  :class="{ 'is-selected': item.selected, 'is-custom': item.isCustom }"
                  @click="handleDialogVendorSelect(item.value)"
                >
                  <div class="oxm-vendor-card__logo-wrap">
                    <img :src="item.logo" :alt="item.label" />
                  </div>
                  <span class="oxm-vendor-card__name">{{ item.label }}</span>
                </button>
                <div v-if="!filteredVendorOptions.length" class="oxm-vendor-empty">
                  <i class="fa-solid fa-circle-info"></i>
                  <span>{{ isZh ? '没有匹配的供应商' : 'No matching providers' }}</span>
                </div>
              </div>

              <!-- 分页器（每页 14 个，2 行 × 7 列）-->
              <div v-if="totalVendorPages > 1" class="oxm-pager">
                <button
                  type="button"
                  class="oxm-pager__btn"
                  :disabled="safeDialogPage <= 1"
                  :title="isZh ? '上一页' : 'Previous'"
                  @click="gotoPage(safeDialogPage - 1)"
                >
                  <i class="fa-solid fa-chevron-left"></i>
                </button>
                <div class="oxm-pager__pages">
                  <button
                    v-for="p in totalVendorPages"
                    :key="`vendor-page-${p}`"
                    type="button"
                    class="oxm-pager__page"
                    :class="{ 'is-active': safeDialogPage === p }"
                    @click="gotoPage(p)"
                  >{{ p }}</button>
                </div>
                <button
                  type="button"
                  class="oxm-pager__btn"
                  :disabled="safeDialogPage >= totalVendorPages"
                  :title="isZh ? '下一页' : 'Next'"
                  @click="gotoPage(safeDialogPage + 1)"
                >
                  <i class="fa-solid fa-chevron-right"></i>
                </button>
                <span class="oxm-pager__hint">
                  {{ filteredVendorOptions.length }} {{ isZh ? '个供应商' : 'providers' }}
                </span>
              </div>

              <!-- 选中后的配置 -->
              <div v-if="selectedVendorOption" class="oxm-dialog__form">
                <div class="oxm-dialog__form-head">
                  <img :src="selectedVendorOption.logo" :alt="selectedVendorOption.label" />
                  <div>
                    <strong>{{ selectedVendorOption.label }}</strong>
                    <p v-if="selectedVendorOption.isCustom">
                      {{ isZh ? '自定义 OpenAI 兼容入口，与 OpenXnet 订阅中心绑定。' : 'Custom OpenAI-compatible endpoint, bound to OpenXnet subscription.' }}
                    </p>
                    <p v-else>
                      {{ isZh ? '已为你预填该供应商默认地址，填入 API Key 即可使用。' : 'Default URL pre-filled. Provide an API key to start using it.' }}
                    </p>
                  </div>
                  <a
                    v-if="addDialog.websiteUrl"
                    href="javascript:void(0)"
                    class="oxm-dialog__form-link"
                    @click="handleDialogVendorWebsite"
                  >
                    <i class="fa-solid fa-key"></i>
                    <span>{{ isZh ? '获取 API Key' : 'Get API key' }}</span>
                  </a>
                </div>

                <div class="oxm-dialog__form-grid">
                  <label class="oxm-field oxm-field--full">
                    <span>{{ isZh ? 'API 地址' : 'API URL' }}{{ selectedVendorOption.isCustom ? ' *' : '' }}</span>
                    <input
                      type="text"
                      :value="addDialog.url"
                      :placeholder="isZh ? 'https://api.example.com/v1' : 'https://api.example.com/v1'"
                      @input="handleDialogField('url', $event)"
                    />
                  </label>
                  <label class="oxm-field">
                    <span>{{ isZh ? 'API 密钥' : 'API Key' }}</span>
                    <input
                      type="password"
                      :value="addDialog.apiKey"
                      :placeholder="isZh ? '可选，先添加再去填写' : 'Optional, can be filled later'"
                      @input="handleDialogField('apiKey', $event)"
                    />
                  </label>
                  <label class="oxm-field">
                    <span>{{ isZh ? '默认模型 ID（可选）' : 'Default Model ID (optional)' }}</span>
                    <input
                      type="text"
                      :value="addDialog.modelId"
                      :placeholder="isZh ? '可留空，添加后可拉取模型列表' : 'Optional, fetch models after adding'"
                      @input="handleDialogField('modelId', $event)"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div class="oxm-dialog__foot">
              <button type="button" class="oxm-secondary-btn" @click="handleDialogClose">
                {{ isZh ? '取消' : 'Cancel' }}
              </button>
              <button
                type="button"
                class="oxm-primary-btn"
                :disabled="!addDialog.vendor"
                @click="handleDialogConfirm"
              >
                <i class="fa-solid fa-check"></i>
                <span>{{ isZh ? '确认添加' : 'Confirm' }}</span>
              </button>
            </div>
          </div>
        </div>
      </transition>

      <!-- 旧的 detail card 保留隐藏（兼容老 selectProviderCard 流程，不再渲染） -->
      <div v-if="false" ref="serviceDetailRef" class="ox-vite-model-detail-card">
        <div class="ox-vite-model-detail-card__header">
          <div class="ox-vite-model-detail-card__title">
            <div class="ox-vite-model-detail-card__badge" :class="`is-${service.current.statusTone || 'muted'}`">
              {{ (service.current.displayName || 'P').charAt(0).toUpperCase() }}
            </div>
            <div>
              <h2>{{ service.current.displayName }}</h2>
              <p>{{ service.current.isTemplate ? (isZh ? '从模板中选择服务商后，直接在右侧补齐地址、API Key 和默认模型。' : 'Pick a provider template, then complete the endpoint, API key, and default model on the right.') : (isZh ? '当前选中的模型服务商详情' : 'Current selected provider detail') }}</p>
            </div>
          </div>
          <div class="ox-vite-model-detail-card__actions">
            <button type="button" class="ox-vite-model-secondary-btn" @click="handleOpenWebsite">
              <i class="fa-solid fa-up-right-from-square"></i>
              <span>{{ isZh ? '官网' : 'Website' }}</span>
            </button>
            <button type="button" class="ox-vite-model-secondary-btn" @click="handleFetchModels">
              <i class="fa-solid fa-magnifying-glass"></i>
              <span>{{ isZh ? '拉取模型' : 'Fetch Models' }}</span>
            </button>
            <button type="button" class="ox-vite-model-secondary-btn" :disabled="service.current.isValidating" @click="handleValidateProvider">
              <i class="fa-solid fa-vial-circle-check"></i>
              <span>{{ service.current.isValidating ? (isZh ? '验证中' : 'Validating') : (isZh ? '验证' : 'Validate') }}</span>
            </button>
            <button v-if="!service.current.isTemplate" type="button" class="ox-vite-model-secondary-btn" @click="handleCopyProvider">
              <i class="fa-solid fa-copy"></i>
              <span>{{ isZh ? '复制' : 'Copy' }}</span>
            </button>
            <button v-if="!service.current.isTemplate" type="button" class="ox-vite-model-danger-btn" @click="handleRemoveProvider">
              <i class="fa-solid fa-trash"></i>
              <span>{{ isZh ? '删除' : 'Delete' }}</span>
            </button>
          </div>
        </div>

        <div v-if="service.current.isTemplate" class="ox-vite-model-template-grid">
          <button
            v-for="item in addProviderOptions"
            :key="item.value"
            type="button"
            class="ox-vite-model-template-card"
            :class="{ selected: item.selected, 'is-unlock': item.isUnlockHub }"
            @click="handleModalVendorSelect(item.value)"
          >
            <template v-if="item.isUnlockHub">
              <div class="ox-vite-model-template-card__lock">
                <i class="fa-solid fa-lock"></i>
              </div>
            </template>
            <img
              v-else
              :src="item.logo"
              :alt="item.label"
              class="ox-vite-model-template-card__logo"
            />
            <strong>{{ item.label }}</strong>
            <span v-if="item.meta">{{ item.meta }}</span>
          </button>
        </div>

        <div class="ox-vite-model-form-grid">
          <label class="ox-vite-model-field">
            <span>{{ isZh ? '供应商 Vendor' : 'Vendor' }}</span>
            <template v-if="service.current.isTemplate">
              <select :value="service.current.vendor" @change="handleServiceVendor">
                <option
                  v-for="item in addProviderOptions.filter((option) => !option.isUnlockHub)"
                  :key="`template-option-${item.value}`"
                  :value="item.value"
                >{{ item.label }}</option>
              </select>
            </template>
            <input v-else :value="service.current.vendor" type="text" @input="handleServiceField('vendor', $event)" />
          </label>
          <label class="ox-vite-model-field">
            <span>Base URL</span>
            <input :value="service.current.url" type="text" @input="handleServiceField('url', $event)" />
          </label>
          <label class="ox-vite-model-field">
            <span>API Key</span>
            <input :value="service.current.apiKey" type="password" @input="handleServiceField('apiKey', $event)" />
          </label>
          <label class="ox-vite-model-field">
            <span>{{ isZh ? '默认模型' : 'Default Model' }}</span>
            <input :value="service.current.modelId" type="text" @input="handleServiceField('modelId', $event)" />
          </label>
        </div>

        <div v-if="service.current.validationMessage" class="ox-vite-model-validation" :class="`is-${service.current.validationStatus || 'success'}`">
          {{ service.current.validationMessage }}
        </div>

        <div v-if="service.current.validationChecks && service.current.validationChecks.length" class="ox-vite-model-diagnostics">
          <div
            v-for="(check, index) in service.current.validationChecks"
            :key="`${service.current.id}-check-${index}`"
            class="ox-vite-model-diagnostics__item"
          >
            <strong>{{ check.label || check.name || check.id || (isZh ? '检查项' : 'Check') }}</strong>
            <span>{{ check.message || check.detail || check.status || '' }}</span>
          </div>
        </div>

        <div class="ox-vite-model-chip-wrap ox-vite-model-chip-wrap--status">
          <span class="ox-vite-model-chip" :class="{ 'is-on': service.current.apiKeyConfigured || service.current.apiKeyOptional }">
            {{ service.current.apiKeyConfigured || service.current.apiKeyOptional ? (isZh ? 'API Key 已就绪' : 'API key ready') : (isZh ? 'API Key 缺失' : 'API key missing') }}
          </span>
          <span class="ox-vite-model-chip" :class="{ 'is-on': service.current.matchedModel }">
            {{ service.current.matchedModel ? (isZh ? '模型已匹配' : 'Model matched') : (isZh ? '模型待确认' : 'Model unresolved') }}
          </span>
          <span v-if="service.current.isCurrentMain" class="ox-vite-model-chip is-on">
            {{ isZh ? '当前主服务商' : 'Current Main' }}
          </span>
        </div>

          <div class="ox-vite-model-detail-card__footer">
            <div class="ox-vite-model-chip-wrap">
              <button
                v-for="model in service.current.models"
              :key="model.value"
              type="button"
              class="ox-vite-model-chip ox-vite-model-chip--button"
              :class="{ active: service.current.modelId === model.value }"
              @click="handleServiceModelChip(model.value)"
            >
              {{ model.label }}
            </button>
            <button
              v-for="model in service.current.validationModels"
              :key="`validated-${model.value}`"
              type="button"
              class="ox-vite-model-chip ox-vite-model-chip--button"
              :class="{ active: service.current.modelId === model.value }"
              @click="handleServiceModelChip(model.value)"
            >
              {{ model.label }}
            </button>
            </div>
            <button type="button" class="ox-vite-model-primary-btn" @click="handleSaveService">
              <i class="fa-solid fa-check"></i>
              <span>{{ service.current.isTemplate ? (isZh ? '添加到服务列表' : 'Add Provider') : (service.current.isCurrentMain ? (isZh ? '保存当前服务商' : 'Save Provider') : (isZh ? '设为主模型服务商' : 'Apply as Main Provider')) }}</span>
            </button>
          </div>
      </div>
    </div>

    <div v-else-if="activeSlot" class="ox-vite-model-slot-panel">
      <div class="ox-vite-model-slot-header">
        <div>
          <h2>{{ activeSlot.label }}</h2>
          <p>{{ activeSlot.selectedProviderName }}</p>
        </div>
        <span class="ox-vite-model-slot-status">{{ activeSlot.selectedProviderStatus }}</span>
      </div>

      <div class="ox-vite-model-slot-grid">
        <label class="ox-vite-model-field">
          <span>{{ isZh ? '绑定供应商' : 'Provider' }}</span>
          <select :value="activeSlot.selectedProvider" @change="handleSlotProvider(activeSlot.id, $event)">
            <option value="">{{ isZh ? '请选择供应商' : 'Select provider' }}</option>
            <option v-for="option in activeSlot.providerOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </label>
        <label class="ox-vite-model-field">
          <span>{{ isZh ? '模型 ID' : 'Model ID' }}</span>
          <input :value="activeSlot.model" type="text" @input="handleSlotField(activeSlot.id, 'model', $event)" />
        </label>
        <div v-if="activeSlot.providerModels && activeSlot.providerModels.length" class="ox-vite-model-slot-models">
          <button
            v-for="model in activeSlot.providerModels"
            :key="`${activeSlot.id}-${model.value}`"
            type="button"
            class="ox-vite-model-chip ox-vite-model-chip--button"
            :class="{ active: activeSlot.model === model.value }"
            @click="handleSlotModelChip(activeSlot.id, model.value)"
          >
            {{ model.label }}
          </button>
        </div>
        <label class="ox-vite-model-field">
          <span>Base URL</span>
          <input :value="activeSlot.base_url" type="text" @input="handleSlotField(activeSlot.id, 'base_url', $event)" />
        </label>
        <label class="ox-vite-model-field">
          <span>API Key</span>
          <input :value="activeSlot.api_key" type="password" @input="handleSlotField(activeSlot.id, 'api_key', $event)" />
        </label>
        <label v-if="activeSlot.temperature !== undefined" class="ox-vite-model-field">
          <span>Temperature</span>
          <input :value="activeSlot.temperature" type="number" min="0" max="2" step="0.1" @input="handleSlotField(activeSlot.id, 'temperature', $event)" />
        </label>
        <label v-if="activeSlot.max_tokens !== undefined" class="ox-vite-model-field">
          <span>Max Tokens</span>
          <input :value="activeSlot.max_tokens" type="number" min="1" step="1" @input="handleSlotField(activeSlot.id, 'max_tokens', $event)" />
        </label>
        <label v-if="activeSlot.top_p !== undefined" class="ox-vite-model-field">
          <span>Top P</span>
          <input :value="activeSlot.top_p" type="number" min="0" max="1" step="0.05" @input="handleSlotField(activeSlot.id, 'top_p', $event)" />
        </label>
        <label v-if="activeSlot.reasoning_effort !== undefined" class="ox-vite-model-field">
          <span>{{ isZh ? '推理强度' : 'Reasoning Effort' }}</span>
          <input :value="activeSlot.reasoning_effort || ''" type="text" @input="handleSlotField(activeSlot.id, 'reasoning_effort', $event)" />
        </label>
        <label v-if="activeSlot.enabled !== null" class="ox-vite-model-switch">
          <span>
            <strong>{{ isZh ? '启用该模型槽位' : 'Enable this slot' }}</strong>
            <small>{{ isZh ? '关闭后当前工作流不会主动使用该模型' : 'The current workflow will not actively use this slot when disabled.' }}</small>
          </span>
          <input :checked="activeSlot.enabled" type="checkbox" @change="handleSlotField(activeSlot.id, 'enabled', $event)" />
        </label>
      </div>
    </div>
  </div>
</template>

<style>
#openxnet-vite-model-root {
  display: block;
  height: 100%;
  min-height: 0;
}

.ox-vite-model-shell,
.ox-vite-model-shell * {
  box-sizing: border-box;
}

.ox-vite-model-shell {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 18px 12px 16px;
  background: #f8fafc;
  color: #1e293b;
}

.ox-vite-model-header {
  flex: 0 0 auto;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding: 0 12px 16px;
}

.ox-vite-model-header h1 {
  margin: 0;
  font-size: 36px;
  line-height: 1.1;
}

.ox-vite-model-header p {
  margin: 10px 0 0;
  color: #64748b;
  font-size: 16px;
}

.ox-vite-model-tabs {
  flex: 0 0 auto;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 12px 20px;
}

.ox-vite-model-feedback {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0 12px 14px;
  padding: 10px 14px;
  border-radius: 14px;
  background: rgba(34, 197, 94, 0.10);
  color: #15803d;
  font-size: 13px;
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.06);
}

.ox-vite-model-feedback-enter-active,
.ox-vite-model-feedback-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}

.ox-vite-model-feedback-enter-from,
.ox-vite-model-feedback-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.ox-vite-model-modal {
  position: fixed;
  inset: 0;
  z-index: 240;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28px;
  background: rgba(15, 23, 42, 0.22);
  backdrop-filter: blur(10px);
}

.ox-vite-model-modal__dialog {
  width: min(1040px, calc(100vw - 48px));
  max-height: calc(100vh - 48px);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  border-radius: 24px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 28px 64px rgba(15, 23, 42, 0.18);
  overflow: hidden;
}

.ox-vite-model-modal__header,
.ox-vite-model-modal__footer {
  padding: 18px 22px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
}

.ox-vite-model-modal__footer {
  border-bottom: 0;
  border-top: 1px solid rgba(15, 23, 42, 0.06);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.ox-vite-model-modal__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.ox-vite-model-modal__header h2 {
  margin: 0;
  font-size: 24px;
  line-height: 1.16;
}

.ox-vite-model-modal__header p {
  margin: 8px 0 0;
  color: #64748b;
  line-height: 1.6;
}

.ox-vite-model-modal__close {
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.06);
  color: #64748b;
  cursor: pointer;
}

.ox-vite-model-modal__body {
  min-height: 0;
  overflow: auto;
  display: grid;
  grid-template-columns: minmax(280px, 0.84fr) minmax(0, 1.16fr);
  gap: 0;
}

.ox-vite-model-modal__vendor-grid {
  padding: 20px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  border-right: 1px solid rgba(15, 23, 42, 0.06);
  align-content: start;
}

.ox-vite-model-modal__vendor-card {
  padding: 16px 14px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 18px;
  background: #fff;
  text-align: center;
  cursor: pointer;
  display: grid;
  gap: 8px;
  transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.ox-vite-model-modal__vendor-card:hover,
.ox-vite-model-modal__vendor-card.selected {
  border-color: rgba(91, 163, 197, 0.24);
  background: rgba(91, 163, 197, 0.08);
}

.ox-vite-model-modal__vendor-logo,
.ox-vite-model-modal__vendor-lock {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  margin: 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border: 1px solid rgba(15, 23, 42, 0.06);
  object-fit: contain;
  padding: 6px;
  color: #5ba3c5;
}

.ox-vite-model-modal__vendor-name {
  font-size: 14px;
  font-weight: 700;
  color: #1e293b;
}

.ox-vite-model-modal__vendor-meta {
  font-size: 12px;
  line-height: 1.5;
  color: #64748b;
}

.ox-vite-model-modal__form {
  padding: 20px 22px;
  display: grid;
  gap: 16px;
  align-content: start;
}

.ox-vite-model-modal__hint {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(91, 163, 197, 0.08);
}

.ox-vite-model-modal__hint-copy {
  display: grid;
  gap: 6px;
}

.ox-vite-model-modal__hint-copy strong {
  font-size: 14px;
}

.ox-vite-model-modal__hint-copy p {
  margin: 0;
  color: #64748b;
  line-height: 1.6;
}

.ox-vite-model-modal-enter-active,
.ox-vite-model-modal-leave-active {
  transition: opacity 180ms ease;
}

.ox-vite-model-modal-enter-from,
.ox-vite-model-modal-leave-to {
  opacity: 0;
}

.ox-vite-model-tab {
  min-height: 40px;
  padding: 0 16px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 12px;
  background: #ffffff;
  color: #64748b;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.ox-vite-model-tab.active {
  border-color: rgba(91, 163, 197, 0.18);
  background: rgba(91, 163, 197, 0.08);
  color: #1e293b;
}

.ox-vite-model-service,
.ox-vite-model-slot-panel {
  flex: 1 1 auto;
  min-height: 0;
}

.ox-vite-model-service {
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0 12px 0;
  scrollbar-gutter: stable;
  overscroll-behavior: contain;
}

.ox-vite-model-service-shell {
  display: grid;
  grid-template-columns: minmax(0, 0.92fr) minmax(420px, 1.08fr);
  gap: 18px;
  align-items: start;
  padding: 0 12px 18px;
}

.ox-vite-model-provider-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
  padding: 0;
  align-content: start;
}

.ox-vite-model-empty-state {
  grid-column: 1 / -1;
  min-height: 180px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px;
  border: 1px dashed rgba(148, 163, 184, 0.3);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.72);
  text-align: center;
}

.ox-vite-model-empty-state i {
  font-size: 28px;
  color: #5ba3c5;
}

.ox-vite-model-empty-state strong {
  font-size: 16px;
  color: #1e293b;
}

.ox-vite-model-empty-state p {
  margin: 0;
  max-width: 420px;
  line-height: 1.7;
  color: #64748b;
  font-size: 13px;
}

.ox-vite-model-provider-card,
.ox-vite-model-detail-card,
.ox-vite-model-slot-panel {
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.04);
}

.ox-vite-model-provider-card {
  padding: 22px 22px 20px;
  text-align: left;
  cursor: pointer;
}

.ox-vite-model-provider-card.active {
  border-color: rgba(91, 163, 197, 0.18);
  background: rgba(91, 163, 197, 0.08);
}

.ox-vite-model-provider-card.is-current-main {
  box-shadow: 0 14px 30px rgba(91, 163, 197, 0.10);
}

.ox-vite-model-provider-card__header {
  display: flex;
  align-items: center;
  gap: 16px;
}

.ox-vite-model-provider-card__icon,
.ox-vite-model-detail-card__badge {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 22px;
  font-weight: 700;
}

.ox-vite-model-provider-card__icon.is-success,
.ox-vite-model-detail-card__badge.is-success { background: #10a37f; }
.ox-vite-model-provider-card__icon.is-muted,
.ox-vite-model-detail-card__badge.is-muted { background: #64748b; }
.ox-vite-model-provider-card__icon.is-warning,
.ox-vite-model-detail-card__badge.is-warning { background: #f59e0b; }
.ox-vite-model-provider-card__icon.is-error,
.ox-vite-model-detail-card__badge.is-error { background: #ef4444; }

.ox-vite-model-provider-card__copy {
  min-width: 0;
  flex: 1;
}

.ox-vite-model-provider-card__name {
  font-size: 18px;
  font-weight: 700;
}

.ox-vite-model-provider-card__status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  color: #64748b;
  font-size: 13px;
}

.ox-vite-model-provider-card__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #cbd5e1;
}

.ox-vite-model-provider-card__dot.is-success { background: #22c55e; }
.ox-vite-model-provider-card__dot.is-warning { background: #f59e0b; }
.ox-vite-model-provider-card__dot.is-error { background: #ef4444; }

.ox-vite-model-provider-card__summary {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid rgba(15, 23, 42, 0.08);
  color: #64748b;
  font-size: 13px;
}

.ox-vite-model-provider-card__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(34, 197, 94, 0.12);
  color: #15803d;
  font-size: 11px;
  font-weight: 700;
  margin-left: auto;
}

.ox-vite-model-provider-card__badge.is-template {
  background: rgba(148, 163, 184, 0.12);
  color: #64748b;
}

.ox-vite-model-provider-card__hint {
  margin-top: 10px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.55;
}

.ox-vite-model-detail-card {
  margin: 0 12px;
  padding: 24px 24px 20px;
  position: sticky;
  top: 12px;
}

.ox-vite-model-detail-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 22px;
}

.ox-vite-model-detail-card__title {
  display: flex;
  align-items: center;
  gap: 16px;
}

.ox-vite-model-detail-card__title h2 {
  margin: 0;
  font-size: 28px;
}

.ox-vite-model-detail-card__title p {
  margin: 8px 0 0;
  color: #64748b;
}

.ox-vite-model-template-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}

.ox-vite-model-template-card {
  display: grid;
  gap: 8px;
  padding: 14px 12px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 18px;
  background: #ffffff;
  cursor: pointer;
  text-align: center;
  transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.ox-vite-model-template-card:hover,
.ox-vite-model-template-card.selected {
  border-color: rgba(91, 163, 197, 0.28);
  background: rgba(91, 163, 197, 0.08);
}

.ox-vite-model-template-card__logo,
.ox-vite-model-template-card__lock {
  width: 40px;
  height: 40px;
  margin: 0 auto;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border: 1px solid rgba(15, 23, 42, 0.06);
  object-fit: contain;
  padding: 6px;
  color: #5ba3c5;
}

.ox-vite-model-template-card strong {
  font-size: 14px;
  color: #1e293b;
}

.ox-vite-model-template-card span {
  font-size: 12px;
  color: #64748b;
  line-height: 1.5;
}

.ox-vite-model-detail-card__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

.ox-vite-model-primary-btn,
.ox-vite-model-secondary-btn,
.ox-vite-model-danger-btn {
  min-height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 16px;
  border-radius: 12px;
  font-size: 14px;
  cursor: pointer;
}

.ox-vite-model-primary-btn {
  border: 0;
  background: linear-gradient(135deg, #5ba3c5, #7bb8d4);
  color: #ffffff;
}

.ox-vite-model-secondary-btn {
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: #ffffff;
  color: #475569;
}

.ox-vite-model-danger-btn {
  border: 1px solid rgba(239, 68, 68, 0.35);
  background: transparent;
  color: #ef4444;
}

.ox-vite-model-form-grid,
.ox-vite-model-slot-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.ox-vite-model-field,
.ox-vite-model-switch {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ox-vite-model-field span {
  font-size: 13px;
  font-weight: 600;
  color: #475569;
}

.ox-vite-model-field input,
.ox-vite-model-field select {
  width: 100%;
  min-height: 42px;
  padding: 0 14px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 14px;
  background: #f4f5f9;
  color: #1e293b;
  font: inherit;
}

.ox-vite-model-validation {
  margin-top: 16px;
  padding: 12px 14px;
  border-radius: 14px;
  font-size: 14px;
}

.ox-vite-model-validation.is-ready,
.ox-vite-model-validation.is-success {
  background: rgba(34, 197, 94, 0.08);
  color: #15803d;
}

.ox-vite-model-validation.is-warning {
  background: rgba(245, 158, 11, 0.08);
  color: #b45309;
}

.ox-vite-model-validation.is-blocked,
.ox-vite-model-validation.is-error {
  background: rgba(239, 68, 68, 0.08);
  color: #dc2626;
}

.ox-vite-model-diagnostics {
  margin-top: 14px;
  display: grid;
  gap: 10px;
}

.ox-vite-model-diagnostics__item {
  display: grid;
  gap: 4px;
  padding: 12px 14px;
  border-radius: 14px;
  background: #f8fafc;
  border: 1px solid rgba(15, 23, 42, 0.06);
}

.ox-vite-model-diagnostics__item strong {
  font-size: 13px;
  color: #1e293b;
}

.ox-vite-model-diagnostics__item span {
  color: #64748b;
  font-size: 12px;
  line-height: 1.55;
}

.ox-vite-model-detail-card__footer {
  margin-top: 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.ox-vite-model-chip-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ox-vite-model-chip-wrap--status {
  margin-top: 14px;
}

.ox-vite-model-chip {
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(91, 163, 197, 0.08);
  color: #64748b;
  font-size: 12px;
  border: 1px solid transparent;
}

.ox-vite-model-chip.is-on {
  background: rgba(34, 197, 94, 0.12);
  color: #15803d;
}

.ox-vite-model-chip--button {
  cursor: pointer;
  font: inherit;
}

.ox-vite-model-chip--button.active {
  border-color: rgba(91, 163, 197, 0.28);
  background: rgba(91, 163, 197, 0.14);
  color: #1e293b;
  font-weight: 700;
}

.ox-vite-model-slot-panel {
  overflow-y: auto;
  padding: 24px;
  margin: 0 12px;
}

.ox-vite-model-slot-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 20px;
}

.ox-vite-model-slot-header h2 {
  margin: 0;
  font-size: 28px;
}

.ox-vite-model-slot-header p {
  margin: 8px 0 0;
  color: #64748b;
}

.ox-vite-model-slot-status {
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(91, 163, 197, 0.08);
  color: #5ba3c5;
  font-size: 12px;
  font-weight: 700;
}

.ox-vite-model-slot-models {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  grid-column: 1 / -1;
}

.ox-vite-model-switch {
  justify-content: space-between;
  padding: 16px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 16px;
  background: #ffffff;
  grid-column: 1 / -1;
}

.ox-vite-model-switch strong {
  display: block;
  font-size: 14px;
}

.ox-vite-model-switch small {
  display: block;
  margin-top: 6px;
  color: #94a3b8;
  line-height: 1.5;
}

@media (max-width: 1180px) {
  .ox-vite-model-service-shell,
  .ox-vite-model-provider-grid,
  .ox-vite-model-form-grid,
  .ox-vite-model-slot-grid {
    grid-template-columns: 1fr;
  }

  .ox-vite-model-detail-card__header,
  .ox-vite-model-detail-card__footer,
  .ox-vite-model-slot-header,
  .ox-vite-model-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .ox-vite-model-detail-card {
    position: static;
  }

  .ox-vite-model-template-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .ox-vite-model-template-grid {
    grid-template-columns: 1fr;
  }
}

/* ════════════════════════════════════════════════════════════
   New Model Service UI（参考 Super-Agent-Party 内联表单磁贴）
   命名空间 .oxm-* 避免与原 .ox-vite-model-* 冲突
   ════════════════════════════════════════════════════════════ */

.oxm-service-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 16px;
  padding: 4px 4px 72px;
  align-items: stretch;
  width: 100%;
}

.oxm-service-empty {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 10px;
  padding: 48px 24px;
  border: 1px dashed var(--ox-border, rgba(148,163,184,0.3));
  border-radius: 16px;
  background: var(--ox-bg-surface, #ffffff);
  color: var(--ox-text-secondary, #64748b);
}
.oxm-service-empty i { font-size: 26px; color: var(--ox-accent, #5BA3C5); }
.oxm-service-empty strong { font-size: 16px; color: var(--ox-text-primary, #1e293b); }
.oxm-service-empty p { margin: 0; font-size: 13px; line-height: 1.5; }

/* ── Provider Card ── */
.oxm-provider-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px 18px 18px;
  border: 1px solid var(--ox-border, rgba(148,163,184,0.22));
  border-radius: 16px;
  background: var(--ox-bg-surface, #ffffff);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  transition: box-shadow 160ms ease, border-color 160ms ease, transform 160ms ease;
  text-align: left;
  font: inherit;
  cursor: default;
}
.oxm-provider-card:hover {
  border-color: var(--ox-border-hover, rgba(91,163,197,0.35));
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08);
}
.oxm-provider-card.is-current-main {
  border-color: var(--ox-accent, #5BA3C5);
  box-shadow: 0 0 0 1px rgba(91,163,197,0.32), 0 8px 22px rgba(91,163,197,0.18);
}
.oxm-provider-card.is-success { border-left: 3px solid #22c55e; }
.oxm-provider-card.is-warning { border-left: 3px solid #f59e0b; }
.oxm-provider-card.is-error,
.oxm-provider-card.is-blocked { border-left: 3px solid #ef4444; }

.oxm-provider-card__head {
  display: flex;
  align-items: center;
  gap: 12px;
}
.oxm-provider-card__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}
.oxm-provider-card__logo {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  object-fit: cover;
  background: var(--ox-bg-input, rgba(148,163,184,0.12));
  flex-shrink: 0;
}
.oxm-provider-card__name {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.oxm-provider-card__name strong {
  font-size: 14px;
  font-weight: 700;
  color: var(--ox-text-primary, #1e293b);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.oxm-provider-card__main-tag {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--ox-accent-soft, rgba(91,163,197,0.14));
  color: var(--ox-accent, #5BA3C5);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.oxm-provider-card__actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

/* 圆形操作按钮 */
.oxm-icon-btn {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--ox-border, rgba(148,163,184,0.28));
  background: var(--ox-bg-input, rgba(248,250,252,0.95));
  color: var(--ox-text-secondary, #64748b);
  border-radius: 50%;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
  font-size: 12px;
}
.oxm-icon-btn:hover:not(:disabled) {
  border-color: var(--ox-border-hover, rgba(91,163,197,0.35));
  color: var(--ox-text-primary, #1e293b);
  background: var(--ox-bg-surface-hover, rgba(91,163,197,0.08));
}
.oxm-icon-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.oxm-icon-btn--accent {
  background: var(--ox-accent, #5BA3C5);
  border-color: var(--ox-accent, #5BA3C5);
  color: #ffffff;
}
.oxm-icon-btn--accent:hover:not(:disabled) {
  filter: brightness(0.95);
  background: var(--ox-accent, #5BA3C5);
  color: #ffffff;
}
.oxm-icon-btn--danger {
  border-color: rgba(239,68,68,0.35);
  color: #ef4444;
  background: rgba(239,68,68,0.08);
}
.oxm-icon-btn--danger:hover:not(:disabled) {
  background: #ef4444;
  border-color: #ef4444;
  color: #ffffff;
}

/* 内联表单 */
.oxm-provider-card__form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.oxm-field { display: flex; flex-direction: column; gap: 6px; }
.oxm-field--full { grid-column: 1 / -1; }
.oxm-field label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--ox-text-secondary, #64748b);
  font-weight: 600;
}
.oxm-field-copy {
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  background: transparent;
  color: var(--ox-text-muted, #94a3b8);
  border-radius: 6px;
  cursor: pointer;
  font-size: 10px;
  transition: background 120ms ease, color 120ms ease;
}
.oxm-field-copy:hover {
  background: var(--ox-bg-surface-hover, rgba(91,163,197,0.08));
  color: var(--ox-text-primary, #1e293b);
}
.oxm-field input,
.oxm-field-copy + .oxm-input-with-affix input {
  width: 100%;
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--ox-border, rgba(148,163,184,0.28));
  border-radius: 10px;
  background: var(--ox-bg-input, #f8fafc);
  color: var(--ox-text-primary, #1e293b);
  font: inherit;
  font-size: 13px;
  transition: border-color 120ms ease, box-shadow 120ms ease, background 120ms ease;
  outline: none;
}
.oxm-field input:hover {
  border-color: var(--ox-border-hover, rgba(91,163,197,0.35));
}
.oxm-field input:focus {
  border-color: var(--ox-accent, #5BA3C5);
  box-shadow: 0 0 0 3px rgba(91,163,197,0.16);
  background: var(--ox-bg-surface, #ffffff);
}
.oxm-field input::placeholder {
  color: var(--ox-text-muted, #94a3b8);
}

.oxm-input-with-affix {
  position: relative;
  display: block;
}
.oxm-input-with-affix input { padding-right: 36px; }
.oxm-input-affix {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 0;
  color: var(--ox-text-muted, #94a3b8);
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
}
.oxm-input-affix:hover {
  background: var(--ox-bg-surface-hover, rgba(91,163,197,0.08));
  color: var(--ox-text-primary, #1e293b);
}

.oxm-model-select {
  position: relative;
  display: block;
}
.oxm-model-select input { padding-right: 36px; }
.oxm-model-list {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
}
.oxm-model-list summary {
  width: 30px;
  height: 30px;
  list-style: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--ox-text-muted, #94a3b8);
  border-radius: 8px;
  transition: background 120ms ease, color 120ms ease;
}
.oxm-model-list summary::-webkit-details-marker { display: none; }
.oxm-model-list summary:hover {
  background: var(--ox-bg-surface-hover, rgba(91,163,197,0.08));
  color: var(--ox-text-primary, #1e293b);
}
.oxm-model-list[open] summary i { transform: rotate(180deg); }
.oxm-model-list summary i { transition: transform 160ms ease; }

.oxm-model-list__items {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  z-index: 10;
  width: 240px;
  max-height: 240px;
  overflow-y: auto;
  padding: 6px;
  background: var(--ox-bg-surface, #ffffff);
  border: 1px solid var(--ox-border, rgba(148,163,184,0.28));
  border-radius: 12px;
  box-shadow: 0 12px 28px rgba(15,23,42,0.14);
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.oxm-model-list__item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 8px 10px;
  border: 0;
  background: transparent;
  color: var(--ox-text-primary, #1e293b);
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.oxm-model-list__item:hover {
  background: var(--ox-bg-surface-hover, rgba(91,163,197,0.08));
}
.oxm-model-list__item.is-active {
  background: var(--ox-accent-soft, rgba(91,163,197,0.16));
  color: var(--ox-accent, #5BA3C5);
}

.oxm-validation {
  display: inline-flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 12px;
  line-height: 1.5;
  border: 1px solid transparent;
}
.oxm-validation.is-success { background: rgba(34,197,94,0.10); color: #16a34a; border-color: rgba(34,197,94,0.24); }
.oxm-validation.is-warning { background: rgba(245,158,11,0.10); color: #d97706; border-color: rgba(245,158,11,0.24); }
.oxm-validation.is-error,
.oxm-validation.is-blocked { background: rgba(239,68,68,0.10); color: #ef4444; border-color: rgba(239,68,68,0.24); }

.oxm-card-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 2px;
}

.oxm-primary-btn,
.oxm-secondary-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 10px;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
}
.oxm-primary-btn {
  border: 0;
  background: var(--ox-accent, #5BA3C5);
  color: #ffffff;
}
.oxm-primary-btn:hover:not(:disabled) { filter: brightness(0.95); }
.oxm-primary-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.oxm-secondary-btn {
  border: 1px solid var(--ox-border, rgba(148,163,184,0.28));
  background: var(--ox-bg-surface, #ffffff);
  color: var(--ox-text-secondary, #64748b);
}
.oxm-secondary-btn:hover {
  border-color: var(--ox-border-hover, rgba(91,163,197,0.35));
  color: var(--ox-text-primary, #1e293b);
  background: var(--ox-bg-surface-hover, rgba(91,163,197,0.06));
}

/* ── Add Tile ── */
.oxm-provider-card--add {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 240px;
  background: var(--ox-bg-surface, #ffffff);
  border: 1px dashed var(--ox-border, rgba(148,163,184,0.4));
  cursor: pointer;
  color: var(--ox-text-secondary, #64748b);
}
.oxm-provider-card--add:hover {
  border-color: var(--ox-accent, #5BA3C5);
  color: var(--ox-accent, #5BA3C5);
  background: var(--ox-accent-soft, rgba(91,163,197,0.06));
  transform: translateY(-2px);
}
.oxm-add-tile__plus {
  width: 56px;
  height: 56px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--ox-bg-input, rgba(91,163,197,0.10));
  color: inherit;
  font-size: 22px;
  transition: background 160ms ease;
}
.oxm-provider-card--add:hover .oxm-add-tile__plus {
  background: var(--ox-accent, #5BA3C5);
  color: #ffffff;
}
.oxm-add-tile__label { font-size: 14px; font-weight: 600; }

/* ════ Add Provider Dialog ════ */
.oxm-dialog-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.42);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9000;
  padding: 24px;
}
/* 固定尺寸：避免内容多寡导致 dialog 高度抖动、footer 被遮挡 */
.oxm-dialog-shell {
  width: min(1180px, 92vw);
  height: min(720px, calc(100vh - 48px));
  background: var(--ox-bg-surface, #ffffff);
  border: 1px solid var(--ox-border, rgba(148,163,184,0.22));
  border-radius: 18px;
  box-shadow: 0 24px 64px rgba(15, 23, 42, 0.28);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;  /* head | body | foot 三段 */
  overflow: hidden;
}
.oxm-dialog__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 1px solid var(--ox-border, rgba(148,163,184,0.22));
  background: var(--ox-bg-surface, #ffffff);
}
.oxm-dialog__head h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--ox-text-primary, #1e293b);
}

.oxm-dialog__body {
  padding: 18px 22px 16px;
  overflow-y: auto;   /* body 内部独立滚动 */
  min-height: 0;
}

.oxm-dialog__filter-row {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.oxm-dialog__search {
  position: relative;
  flex: 1;
  min-width: 240px;
}
.oxm-dialog__search i {
  position: absolute;
  top: 50%;
  left: 14px;
  transform: translateY(-50%);
  color: var(--ox-text-muted, #94a3b8);
  font-size: 12px;
  pointer-events: none;
}
.oxm-dialog__search input {
  width: 100%;
  height: 38px;
  padding: 0 14px 0 36px;
  border: 1px solid var(--ox-border, rgba(148,163,184,0.28));
  border-radius: 999px;
  background: var(--ox-bg-input, #f8fafc);
  color: var(--ox-text-primary, #1e293b);
  font: inherit;
  font-size: 13px;
  outline: none;
}
.oxm-dialog__search input:focus {
  border-color: var(--ox-accent, #5BA3C5);
  box-shadow: 0 0 0 3px rgba(91,163,197,0.16);
}

.oxm-dialog__filter-tabs {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  background: var(--ox-bg-input, rgba(148,163,184,0.10));
  border-radius: 999px;
}
.oxm-dialog__filter-tabs button {
  border: 0;
  background: transparent;
  padding: 6px 14px;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  color: var(--ox-text-secondary, #64748b);
  border-radius: 999px;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}
.oxm-dialog__filter-tabs button:hover { color: var(--ox-text-primary, #1e293b); }
.oxm-dialog__filter-tabs button.is-active {
  background: var(--ox-bg-surface, #ffffff);
  color: var(--ox-accent, #5BA3C5);
  box-shadow: 0 1px 2px rgba(15,23,42,0.06);
}

/* 固定 7 列 × 2 行 = 14 个/页，配合分页器，弹窗尺寸恒定 */
.oxm-vendor-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}
@media (max-width: 1080px) {
  .oxm-vendor-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); }
}
@media (max-width: 720px) {
  .oxm-vendor-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

/* 分页器：相对定位让按钮组居中 + hint 绝对靠右 */
.oxm-pager {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: 14px;
  min-height: 32px;
}
.oxm-pager__btn {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--ox-border, rgba(148,163,184,0.28));
  background: var(--ox-bg-surface, #ffffff);
  color: var(--ox-text-secondary, #64748b);
  border-radius: 8px;
  cursor: pointer;
  font-size: 11px;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
}
.oxm-pager__btn:hover:not(:disabled) {
  border-color: var(--ox-border-hover, rgba(91,163,197,0.35));
  color: var(--ox-text-primary, #1e293b);
  background: var(--ox-bg-surface-hover, rgba(91,163,197,0.06));
}
.oxm-pager__btn:disabled { opacity: 0.4; cursor: not-allowed; }

.oxm-pager__pages {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.oxm-pager__page {
  min-width: 30px;
  height: 30px;
  padding: 0 8px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--ox-text-secondary, #64748b);
  border-radius: 8px;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
}
.oxm-pager__page:hover:not(.is-active) {
  background: var(--ox-bg-surface-hover, rgba(91,163,197,0.08));
  color: var(--ox-text-primary, #1e293b);
}
.oxm-pager__page.is-active {
  background: var(--ox-accent, #5BA3C5);
  color: #ffffff;
  border-color: var(--ox-accent, #5BA3C5);
}
.oxm-pager__hint {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  font-size: 12px;
  color: var(--ox-text-muted, #94a3b8);
}

.oxm-vendor-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 8px 8px;
  border: 1px solid var(--ox-border, rgba(148,163,184,0.22));
  border-radius: 12px;
  background: var(--ox-bg-surface, #ffffff);
  cursor: pointer;
  transition: border-color 120ms ease, transform 120ms ease, box-shadow 120ms ease;
  font: inherit;
  text-align: center;
  min-height: 96px;
}
.oxm-vendor-card:hover {
  border-color: var(--ox-accent, #5BA3C5);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
}
.oxm-vendor-card.is-selected {
  border-color: var(--ox-accent, #5BA3C5);
  background: var(--ox-accent-soft, rgba(91,163,197,0.10));
  box-shadow: 0 0 0 2px rgba(91,163,197,0.22);
}
.oxm-vendor-card.is-custom {
  border-color: rgba(91,163,197,0.45);
  background: linear-gradient(135deg, rgba(91,163,197,0.08), rgba(91,163,197,0.04));
}
.oxm-vendor-card__logo-wrap {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--ox-bg-input, rgba(148,163,184,0.12));
  overflow: hidden;
}
.oxm-vendor-card__logo-wrap img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.oxm-vendor-card__name {
  font-size: 12px;
  font-weight: 600;
  color: var(--ox-text-primary, #1e293b);
  line-height: 1.2;
  word-break: break-word;
}

.oxm-vendor-empty {
  grid-column: 1 / -1;
  padding: 24px 12px;
  text-align: center;
  color: var(--ox-text-muted, #94a3b8);
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.oxm-dialog__form {
  border: 1px solid var(--ox-border, rgba(148,163,184,0.22));
  border-radius: 12px;
  padding: 12px 14px;
  background: var(--ox-bg-input, rgba(248,250,252,0.6));
  margin-bottom: 4px;
}
.oxm-dialog__form-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 10px;
}
.oxm-dialog__form-head img {
  width: 36px;
  height: 36px;
  border-radius: 9px;
  object-fit: cover;
  background: var(--ox-bg-surface, #ffffff);
  flex-shrink: 0;
}
.oxm-dialog__form-head > div {
  flex: 1;
  min-width: 0;
}
.oxm-dialog__form-head strong {
  display: block;
  font-size: 14px;
  font-weight: 700;
  color: var(--ox-text-primary, #1e293b);
}
.oxm-dialog__form-head p {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--ox-text-secondary, #64748b);
}
.oxm-dialog__form-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--ox-accent, #5BA3C5);
  text-decoration: none;
  flex-shrink: 0;
  padding: 6px 10px;
  border-radius: 8px;
  background: var(--ox-accent-soft, rgba(91,163,197,0.12));
  transition: background 120ms ease;
}
.oxm-dialog__form-link:hover {
  background: rgba(91,163,197,0.22);
}

.oxm-dialog__form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 14px;
}

.oxm-dialog__foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 22px;
  border-top: 1px solid var(--ox-border, rgba(148,163,184,0.22));
  background: var(--ox-bg-surface, #ffffff);
}

.oxm-dialog-enter-active,
.oxm-dialog-leave-active { transition: opacity 180ms ease; }
.oxm-dialog-enter-from,
.oxm-dialog-leave-to { opacity: 0; }
.oxm-dialog-enter-active .oxm-dialog-shell,
.oxm-dialog-leave-active .oxm-dialog-shell { transition: transform 180ms ease; }
.oxm-dialog-enter-from .oxm-dialog-shell,
.oxm-dialog-leave-to .oxm-dialog-shell { transform: translateY(8px) scale(0.98); }

/* ── Dark theme ── */
html[data-theme="dark"] .oxm-provider-card,
html[data-theme="midnight"] .oxm-provider-card,
html[data-theme="neon"] .oxm-provider-card,
html[data-theme="ink"] .oxm-provider-card {
  background: rgba(30, 41, 59, 0.84);
  border-color: rgba(71, 85, 105, 0.45);
  color: #E6EDF6;
}
html[data-theme="dark"] .oxm-provider-card__name strong,
html[data-theme="midnight"] .oxm-provider-card__name strong { color: #E6EDF6; }

html[data-theme="dark"] .oxm-provider-card__logo,
html[data-theme="midnight"] .oxm-provider-card__logo {
  background: rgba(15, 23, 42, 0.5);
}

html[data-theme="dark"] .oxm-icon-btn,
html[data-theme="midnight"] .oxm-icon-btn {
  background: rgba(15, 23, 42, 0.6);
  border-color: rgba(71, 85, 105, 0.45);
  color: #CBD5E1;
}
html[data-theme="dark"] .oxm-icon-btn:hover:not(:disabled),
html[data-theme="midnight"] .oxm-icon-btn:hover:not(:disabled) {
  background: rgba(91, 163, 197, 0.18);
  color: #E6EDF6;
  border-color: rgba(91, 163, 197, 0.45);
}
html[data-theme="dark"] .oxm-icon-btn--accent,
html[data-theme="midnight"] .oxm-icon-btn--accent {
  background: var(--ox-accent, #5BA3C5);
  border-color: var(--ox-accent, #5BA3C5);
  color: #ffffff;
}
html[data-theme="dark"] .oxm-icon-btn--danger,
html[data-theme="midnight"] .oxm-icon-btn--danger {
  background: rgba(239, 68, 68, 0.16);
  color: #f87171;
  border-color: rgba(239, 68, 68, 0.4);
}

html[data-theme="dark"] .oxm-field input,
html[data-theme="midnight"] .oxm-field input,
html[data-theme="dark"] .oxm-dialog__search input,
html[data-theme="midnight"] .oxm-dialog__search input {
  background: rgba(15, 23, 42, 0.7);
  border-color: rgba(71, 85, 105, 0.4);
  color: #E6EDF6;
}
html[data-theme="dark"] .oxm-field input::placeholder,
html[data-theme="midnight"] .oxm-field input::placeholder,
html[data-theme="dark"] .oxm-dialog__search input::placeholder,
html[data-theme="midnight"] .oxm-dialog__search input::placeholder {
  color: #64748B;
}

html[data-theme="dark"] .oxm-provider-card--add,
html[data-theme="midnight"] .oxm-provider-card--add {
  background: rgba(15, 23, 42, 0.55);
  border-color: rgba(71, 85, 105, 0.55);
  color: #94A3B8;
}
html[data-theme="dark"] .oxm-provider-card--add:hover,
html[data-theme="midnight"] .oxm-provider-card--add:hover {
  border-color: var(--ox-accent, #5BA3C5);
  color: #E6EDF6;
  background: rgba(91, 163, 197, 0.10);
}
html[data-theme="dark"] .oxm-add-tile__plus,
html[data-theme="midnight"] .oxm-add-tile__plus {
  background: rgba(91, 163, 197, 0.18);
  color: inherit;
}

html[data-theme="dark"] .oxm-dialog-shell,
html[data-theme="midnight"] .oxm-dialog-shell {
  background: rgba(15, 23, 42, 0.96);
  border-color: rgba(71, 85, 105, 0.5);
}
html[data-theme="dark"] .oxm-dialog__head,
html[data-theme="midnight"] .oxm-dialog__head,
html[data-theme="dark"] .oxm-dialog__foot,
html[data-theme="midnight"] .oxm-dialog__foot {
  background: rgba(15, 23, 42, 0.96);
  border-color: rgba(71, 85, 105, 0.5);
}
html[data-theme="dark"] .oxm-dialog__head h2,
html[data-theme="midnight"] .oxm-dialog__head h2 { color: #E6EDF6; }

html[data-theme="dark"] .oxm-vendor-card,
html[data-theme="midnight"] .oxm-vendor-card {
  background: rgba(30, 41, 59, 0.72);
  border-color: rgba(71, 85, 105, 0.4);
}
html[data-theme="dark"] .oxm-vendor-card__name,
html[data-theme="midnight"] .oxm-vendor-card__name { color: #E6EDF6; }
html[data-theme="dark"] .oxm-vendor-card.is-selected,
html[data-theme="midnight"] .oxm-vendor-card.is-selected {
  background: rgba(91, 163, 197, 0.16);
  border-color: var(--ox-accent, #5BA3C5);
}
html[data-theme="dark"] .oxm-vendor-card.is-custom,
html[data-theme="midnight"] .oxm-vendor-card.is-custom {
  background: linear-gradient(135deg, rgba(91,163,197,0.18), rgba(91,163,197,0.06));
  border-color: rgba(91,163,197,0.5);
}

html[data-theme="dark"] .oxm-dialog__form,
html[data-theme="midnight"] .oxm-dialog__form {
  background: rgba(15, 23, 42, 0.55);
  border-color: rgba(71, 85, 105, 0.4);
}
html[data-theme="dark"] .oxm-dialog__form-head strong,
html[data-theme="midnight"] .oxm-dialog__form-head strong { color: #E6EDF6; }
html[data-theme="dark"] .oxm-dialog__form-head p,
html[data-theme="midnight"] .oxm-dialog__form-head p { color: #94A3B8; }

html[data-theme="dark"] .oxm-dialog__filter-tabs,
html[data-theme="midnight"] .oxm-dialog__filter-tabs {
  background: rgba(15, 23, 42, 0.6);
}
html[data-theme="dark"] .oxm-dialog__filter-tabs button.is-active,
html[data-theme="midnight"] .oxm-dialog__filter-tabs button.is-active {
  background: rgba(91, 163, 197, 0.22);
  color: #E6EDF6;
}

html[data-theme="dark"] .oxm-secondary-btn,
html[data-theme="midnight"] .oxm-secondary-btn {
  background: rgba(15, 23, 42, 0.6);
  border-color: rgba(71, 85, 105, 0.45);
  color: #CBD5E1;
}

html[data-theme="dark"] .oxm-pager__btn,
html[data-theme="midnight"] .oxm-pager__btn {
  background: rgba(15, 23, 42, 0.6);
  border-color: rgba(71, 85, 105, 0.4);
  color: #CBD5E1;
}
html[data-theme="dark"] .oxm-pager__btn:hover:not(:disabled),
html[data-theme="midnight"] .oxm-pager__btn:hover:not(:disabled) {
  background: rgba(91, 163, 197, 0.18);
  color: #E6EDF6;
  border-color: rgba(91, 163, 197, 0.45);
}
html[data-theme="dark"] .oxm-pager__page,
html[data-theme="midnight"] .oxm-pager__page { color: #94A3B8; }
html[data-theme="dark"] .oxm-pager__page:hover:not(.is-active),
html[data-theme="midnight"] .oxm-pager__page:hover:not(.is-active) {
  background: rgba(91, 163, 197, 0.18);
  color: #E6EDF6;
}
html[data-theme="dark"] .oxm-pager__page.is-active,
html[data-theme="midnight"] .oxm-pager__page.is-active {
  background: var(--ox-accent, #5BA3C5);
  color: #ffffff;
}
html[data-theme="dark"] .oxm-model-list__items,
html[data-theme="midnight"] .oxm-model-list__items {
  background: rgba(15, 23, 42, 0.95);
  border-color: rgba(71, 85, 105, 0.45);
}
html[data-theme="dark"] .oxm-model-list__item,
html[data-theme="midnight"] .oxm-model-list__item { color: #E6EDF6; }
html[data-theme="dark"] .oxm-model-list__item:hover,
html[data-theme="midnight"] .oxm-model-list__item:hover {
  background: rgba(91, 163, 197, 0.18);
}

html[data-theme="dark"] .oxm-service-empty,
html[data-theme="midnight"] .oxm-service-empty {
  background: rgba(15, 23, 42, 0.55);
  border-color: rgba(71, 85, 105, 0.4);
  color: #94A3B8;
}
html[data-theme="dark"] .oxm-service-empty strong,
html[data-theme="midnight"] .oxm-service-empty strong { color: #E6EDF6; }

@media (max-width: 720px) {
  .oxm-service-grid { grid-template-columns: 1fr; }
  .oxm-dialog__form-grid { grid-template-columns: 1fr; }
}
</style>
