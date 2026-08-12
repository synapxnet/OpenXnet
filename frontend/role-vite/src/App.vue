<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { createRoleBridge } from './roleBridge';

const bridge = createRoleBridge();
const snapshot = ref(bridge.snapshot());
const roleListRef = ref(null);
let refreshTimer = null;

function resetRoleListScroll() {
  nextTick(() => {
    const node = roleListRef.value;
    if (node) node.scrollTop = 0;
  });
}

function refreshSnapshot() {
  snapshot.value = bridge.snapshot();
}

function handleTabSelect(tabId) {
  bridge.selectTab(tabId);
  refreshSnapshot();
}

function handleCreateRole() {
  bridge.createRole();
  refreshSnapshot();
}

function handleSelectRole(roleId) {
  bridge.selectRole(roleId);
  refreshSnapshot();
  resetRoleListScroll();
}

function handleRoleInput(field, event) {
  bridge.updateRoleField(field, event.target.value);
}

function handleInferToggle(event) {
  bridge.updateRoleField('infer', event.target.checked);
}

function handleMemoryToggle(event) {
  bridge.updateMemorySetting('is_memory', event.target.checked);
}

function handleMemoryLimit(event) {
  bridge.updateMemorySetting('memoryLimit', Number(event.target.value));
}

function handleMemorySettingInput(field, event) {
  bridge.updateMemorySetting(field, event.target.value);
}

function handleProviderChange(event) {
  bridge.updateMemoryProvider(event.target.value);
}

function handleSaveRole() {
  bridge.saveRole();
  refreshSnapshot();
}

function handleDeleteRole() {
  bridge.deleteRole();
  refreshSnapshot();
}

function handleAvatarUpload() {
  bridge.triggerAvatarUpload();
  window.setTimeout(refreshSnapshot, 500);
}

function handleTtsField(field, event) {
  bridge.updateTtsField(field, event.target.value);
  refreshSnapshot();
}

function handlePlaySample() {
  bridge.playVoiceSample();
}

function handleOpenVrmUpload() {
  bridge.openVrmUpload();
}

function handleVrmToggle(field, event) {
  bridge.updateVrmField(field, event.target.checked);
  refreshSnapshot();
}

function handleVrmModel(event) {
  bridge.updateVrmField('selectedModelId', event.target.value);
  refreshSnapshot();
}

function handleBehaviorToggle(index) {
  bridge.toggleBehaviorRule(index);
  refreshSnapshot();
}

function handleOpenBehaviorEditor() {
  bridge.openBehaviorEditor();
}

function handleVisionToggle(field, event) {
  bridge.updateVisionField(field, event.target.checked);
  refreshSnapshot();
}

function handleVisionText(field, event) {
  bridge.updateVisionField(field, event.target.value);
}

function handleVisionProvider(event) {
  bridge.updateVisionProvider(event.target.value);
  refreshSnapshot();
}

const isZh = computed(() => snapshot.value.isZh);
const tabs = computed(() => snapshot.value.tabs || []);
const activeTab = computed(() => snapshot.value.activeTab || 'memory');
const roles = computed(() => snapshot.value.roles || []);
const roleQuery = ref('');
const filteredRoles = computed(() => {
  const query = roleQuery.value.trim().toLowerCase();
  if (!query) return roles.value;
  return roles.value.filter((role) => {
    const haystack = [
      role.name,
      role.description,
      role.meta,
      role.badge,
      role.avatarText,
    ].join(' ').toLowerCase();
    return haystack.includes(query);
  });
});
const memory = computed(() => snapshot.value.memory || {});
const voice = computed(() => snapshot.value.voice || {});
const appearance = computed(() => snapshot.value.appearance || {});
const behavior = computed(() => snapshot.value.behavior || {});
const vision = computed(() => snapshot.value.vision || {});

onMounted(() => {
  refreshSnapshot();
  resetRoleListScroll();
  refreshTimer = window.setInterval(refreshSnapshot, 400);
});

watch(
  () => snapshot.value.activeMenu,
  (menu, previousMenu) => {
    if (menu === 'role' && previousMenu !== 'role') {
      resetRoleListScroll();
    }
  }
);

onBeforeUnmount(() => {
  if (refreshTimer) {
    window.clearInterval(refreshTimer);
    refreshTimer = null;
  }
});
</script>

<template>
  <div class="ox-vite-role-shell">
    <div class="ox-vite-role-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        class="ox-vite-role-tab"
        :class="{ active: activeTab === tab.id }"
        @click="handleTabSelect(tab.id)"
      >
        <i :class="tab.icon"></i>
        <span>{{ tab.label }}</span>
      </button>
    </div>

    <div v-if="activeTab === 'memory'" class="ox-vite-role-content ox-vite-role-content--memory">
      <aside class="ox-vite-role-sidebar">
        <div class="ox-vite-role-sidebar__header">
          <div class="ox-vite-role-sidebar__title-row">
            <h2>{{ isZh ? '角色管理' : 'Role Management' }}</h2>
            <button type="button" class="ox-vite-role-primary-btn" @click="handleCreateRole">
              <i class="fa-solid fa-plus"></i>
              <span>{{ isZh ? '新建角色' : 'New Role' }}</span>
            </button>
          </div>
          <div class="ox-vite-role-search">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input v-model="roleQuery" type="text" :placeholder="isZh ? '搜索角色...' : 'Search roles...'" />
          </div>
        </div>

        <div ref="roleListRef" class="ox-vite-role-list">
          <button
            v-for="role in filteredRoles"
            :key="role.id"
            type="button"
            class="ox-vite-role-card"
            :class="{ active: role.active }"
            @click="handleSelectRole(role.id)"
          >
            <div class="ox-vite-role-card__top">
              <div class="ox-vite-role-card__avatar" :style="{ background: role.avatarBackground }">
                <img v-if="role.avatarImage" :src="role.avatarImage" :alt="role.name" />
                <span v-else>{{ role.avatarText }}</span>
              </div>
              <div class="ox-vite-role-card__copy">
                <div class="ox-vite-role-card__name-row">
                  <span class="ox-vite-role-card__name">{{ role.name }}</span>
                  <span class="ox-vite-role-card__badge" :class="`is-${role.badgeTone}`">{{ role.badge }}</span>
                </div>
                <div class="ox-vite-role-card__desc">{{ role.description }}</div>
              </div>
            </div>
            <div class="ox-vite-role-card__meta">{{ role.meta }}</div>
          </button>
          <div v-if="filteredRoles.length === 0" class="ox-vite-role-empty">
            <i class="fa-regular fa-user"></i>
            <span>{{ isZh ? '没有匹配的角色' : 'No matching roles' }}</span>
          </div>
        </div>
      </aside>

      <main class="ox-vite-role-editor">
        <div class="ox-vite-role-editor__header">
          <h1>{{ memory.title }}</h1>
          <div class="ox-vite-role-editor__actions">
            <button
              v-if="memory.canDelete"
              type="button"
              class="ox-vite-role-danger-btn"
              @click="handleDeleteRole"
            >
              <i class="fa-solid fa-trash-can"></i>
              <span>{{ isZh ? '删除' : 'Delete' }}</span>
            </button>
            <button type="button" class="ox-vite-role-primary-btn" @click="handleSaveRole">
              <i class="fa-solid fa-check"></i>
              <span>{{ isZh ? '保存' : 'Save' }}</span>
            </button>
          </div>
        </div>

        <div class="ox-vite-role-editor__lead">
          <aside class="ox-vite-role-avatar-panel">
            <div class="ox-vite-role-avatar-upload">
              <button type="button" class="ox-vite-role-avatar-upload__circle" :style="{ background: memory.avatarBackground }" @click="handleAvatarUpload">
                <img v-if="memory.avatarImage" :src="memory.avatarImage" :alt="memory.name" />
                <span v-else>{{ memory.avatarText }}</span>
                <div class="ox-vite-role-avatar-upload__overlay">
                  <i class="fa-solid fa-camera"></i>
                  <span>{{ isZh ? '更换头像' : 'Change avatar' }}</span>
                </div>
              </button>
              <button type="button" class="ox-vite-role-avatar-upload__button" @click="handleAvatarUpload">
                <i class="fa-solid fa-cloud-arrow-up"></i>
                <span>{{ isZh ? '上传头像' : 'Upload avatar' }}</span>
              </button>
            </div>
            <div class="ox-vite-role-avatar-panel__copy">
              <strong>{{ isZh ? '角色概览' : 'Role Overview' }}</strong>
              <p>{{ memory.canDelete ? (isZh ? '当前角色已接入角色库，可继续编辑并保存。' : 'This role already exists in the library and can be refined here.') : (isZh ? '新角色会在保存后加入角色库。' : 'A new role will be added to the library after saving.') }}</p>
            </div>
            <div class="ox-vite-role-tags">
              <span class="ox-vite-role-tag">{{ memory.memoryEnabled ? (isZh ? '长记忆开启' : 'Memory On') : (isZh ? '长记忆关闭' : 'Memory Off') }}</span>
              <span class="ox-vite-role-tag">{{ memory.infer ? (isZh ? '自动推理' : 'Infer') : (isZh ? '手动维护' : 'Manual') }}</span>
              <span class="ox-vite-role-tag">{{ memory.backendLabel }}</span>
            </div>
          </aside>

          <div class="ox-vite-role-form">
          <label class="ox-vite-role-field ox-vite-role-field--name">
            <span>{{ isZh ? '角色名称' : 'Role name' }}</span>
            <input :value="memory.name" type="text" :placeholder="isZh ? '例如：智能助手' : 'e.g. Assistant'" @input="handleRoleInput('name', $event)" />
          </label>

          <label class="ox-vite-role-field ox-vite-role-field--full">
            <span>{{ isZh ? '描述' : 'Description' }}</span>
            <textarea :value="memory.description" rows="3" :placeholder="isZh ? '说明这个角色主要负责什么、适合什么场景。' : 'Describe what this role does and when to use it.'" @input="handleRoleInput('description', $event)"></textarea>
          </label>

          <label class="ox-vite-role-field ox-vite-role-field--full">
            <span>{{ isZh ? '性格设定' : 'Personality setting' }}</span>
            <textarea
              :value="memory.personality"
              rows="3"
              :placeholder="isZh ? '例如：表达清晰、耐心、直接，回答前先拆解问题，避免夸张和空泛表述。' : 'e.g. Clear, patient, direct, breaks down the problem first, avoids vague wording.'"
              @input="handleRoleInput('personality', $event)"
            ></textarea>
          </label>

          <label class="ox-vite-role-field ox-vite-role-field--full">
            <span>{{ isZh ? '系统提示词' : 'System prompt' }}</span>
            <textarea :value="memory.systemPrompt" rows="7" :placeholder="isZh ? '定义角色身份、职责边界、决策规则和输出风格。' : 'Define identity, responsibilities, boundaries, decision rules, and output style.'" @input="handleRoleInput('systemPrompt', $event)"></textarea>
          </label>

          <label class="ox-vite-role-field ox-vite-role-field--full">
            <span>{{ isZh ? '开场白' : 'First greeting' }}</span>
            <textarea :value="memory.firstMes" rows="3" @input="handleRoleInput('firstMes', $event)"></textarea>
          </label>

          <label class="ox-vite-role-field">
            <span>{{ isZh ? '绑定记忆模型' : 'Memory model binding' }}</span>
            <select :value="memory.providerId" @change="handleProviderChange">
              <option v-for="option in memory.providerOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </label>

          <div class="ox-vite-role-field">
            <span>{{ isZh ? '长记忆检索数量' : 'Memory result count' }}</span>
            <div class="ox-vite-role-slider-row">
              <input :value="memory.memoryLimit" type="range" min="1" max="20" step="1" @input="handleMemoryLimit" />
              <strong>{{ memory.memoryLimit }}</strong>
            </div>
          </div>

          <div class="ox-vite-role-switch-grid">
            <label class="ox-vite-role-switch">
              <span>
                <strong>{{ isZh ? '启用长记忆' : 'Enable memory' }}</strong>
                <small>{{ memory.backendLabel }}</small>
              </span>
              <input :checked="memory.memoryEnabled" type="checkbox" @change="handleMemoryToggle" />
            </label>
            <label class="ox-vite-role-switch">
              <span>
                <strong>{{ isZh ? '自动推理更新' : 'Auto infer' }}</strong>
                <small>{{ isZh ? '生成时补充角色记忆' : 'Update memory while generating' }}</small>
              </span>
              <input :checked="memory.infer" type="checkbox" @change="handleInferToggle" />
            </label>
          </div>

          <label class="ox-vite-role-field">
            <span>{{ isZh ? '用户称呼' : 'User label' }}</span>
            <input :value="memory.userName" type="text" @input="handleMemorySettingInput('userName', $event)" />
          </label>

          <label class="ox-vite-role-field ox-vite-role-field--full">
            <span>{{ isZh ? '通用系统提示' : 'Generic system prompt' }}</span>
            <textarea :value="memory.genericSystemPrompt" rows="4" @input="handleMemorySettingInput('genericSystemPrompt', $event)"></textarea>
          </label>
        </div>
        </div>
      </main>
    </div>

    <div v-else-if="activeTab === 'voice'" class="ox-vite-role-content ox-vite-role-content--panel">
      <section class="ox-vite-role-panel">
        <div class="ox-vite-role-section-header">
          <h1>{{ isZh ? '多角色语音配置' : 'Multi-role Voice' }}</h1>
          <p>{{ isZh ? '为每个角色配置独立的语音合成方案' : 'Assign voice synthesis settings across roles.' }}</p>
        </div>

        <h2>{{ isZh ? '语音供应商' : 'Voice Providers' }}</h2>
        <div class="ox-vite-role-provider-cards">
          <button
            v-for="provider in voice.providers"
            :key="provider.id"
            type="button"
            class="ox-vite-role-provider-card"
            :class="{ active: provider.active }"
          >
            <i class="fa-solid fa-waveform-lines"></i>
            <span>{{ provider.label }}</span>
          </button>
        </div>

        <h2>{{ isZh ? '角色语音分配' : 'Role Voice Mapping' }}</h2>
        <div class="ox-vite-role-table-wrap">
          <table class="ox-vite-role-table">
            <thead>
              <tr>
                <th>{{ isZh ? '角色' : 'Role' }}</th>
                <th>{{ isZh ? '语音模型' : 'Voice Model' }}</th>
                <th>{{ isZh ? '音色' : 'Tone' }}</th>
                <th>{{ isZh ? '语速' : 'Speed' }}</th>
                <th>{{ isZh ? '音调' : 'Pitch' }}</th>
                <th>{{ isZh ? '试听' : 'Preview' }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in voice.rows" :key="row.id">
                <td><strong>{{ row.name }}</strong></td>
                <td>{{ row.model }}</td>
                <td>{{ row.tone }}</td>
                <td>{{ row.speed }}</td>
                <td>{{ row.pitch }}</td>
                <td><button type="button" class="ox-vite-role-play-btn" @click="handlePlaySample"><i class="fa-solid fa-play"></i></button></td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>{{ isZh ? '全局设置' : 'Global Settings' }}</h2>
        <div class="ox-vite-role-panel-grid ox-vite-role-panel-grid--voice">
          <label class="ox-vite-role-field">
            <span>{{ isZh ? '语言' : 'Language' }}</span>
            <input :value="voice.selectedLanguage" type="text" @input="handleTtsField('edgettsLanguage', $event)" />
          </label>
          <label class="ox-vite-role-field">
            <span>{{ isZh ? '性别' : 'Gender' }}</span>
            <select :value="voice.selectedGender" @change="handleTtsField('edgettsGender', $event)">
              <option value="Female">{{ isZh ? '女声' : 'Female' }}</option>
              <option value="Male">{{ isZh ? '男声' : 'Male' }}</option>
            </select>
          </label>
          <label class="ox-vite-role-field">
            <span>{{ isZh ? '默认音色' : 'Default Voice' }}</span>
            <select :value="voice.selectedVoice" @change="handleTtsField('edgettsVoice', $event)">
              <option v-for="option in voice.voiceOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </label>
          <label class="ox-vite-role-field">
            <span>{{ isZh ? '默认语速' : 'Default Rate' }}</span>
            <input :value="voice.selectedRate" type="number" min="0.5" max="2" step="0.1" @input="handleTtsField('edgettsRate', $event)" />
          </label>
          <label class="ox-vite-role-field ox-vite-role-field--full">
            <span>{{ isZh ? '试听文本' : 'Sample Text' }}</span>
            <textarea :value="voice.sampleText" rows="3" @input="handleTtsField('SampleText', $event)"></textarea>
          </label>
        </div>
      </section>
    </div>

    <div v-else-if="activeTab === 'appearance'" class="ox-vite-role-content ox-vite-role-content--panel">
      <section class="ox-vite-role-panel">
        <div class="ox-vite-role-section-header">
          <h1>{{ isZh ? '多角色外观配置' : 'Multi-role Appearance' }}</h1>
          <p>{{ isZh ? '自定义每个角色的形象和动画表现' : 'Customize each role avatar and motion presence.' }}</p>
        </div>

        <h2>{{ isZh ? '角色形象' : 'Role Avatars' }}</h2>
        <div class="ox-vite-role-avatar-grid">
          <article v-for="avatar in appearance.avatars" :key="avatar.id" class="ox-vite-role-avatar-card">
            <div class="ox-vite-role-avatar-card__img" :style="{ background: avatar.avatarBackground }">
              <img v-if="avatar.avatarImage" :src="avatar.avatarImage" :alt="avatar.name" />
              <span v-else>{{ avatar.shortName }}</span>
            </div>
            <span class="ox-vite-role-avatar-card__name">{{ avatar.name }}</span>
            <button type="button" class="ox-vite-role-secondary-btn" @click="handleAvatarUpload">
              <i class="fa-solid fa-arrows-rotate"></i>
              <span>{{ isZh ? '更换形象' : 'Change' }}</span>
            </button>
          </article>
        </div>

        <h2>{{ isZh ? 'VRM 模型配置' : 'VRM Model' }}</h2>
        <div class="ox-vite-role-vrm-section">
          <button type="button" class="ox-vite-role-vrm-upload" @click="handleOpenVrmUpload">
            <i class="fa-solid fa-cloud-arrow-up"></i>
            <span>{{ isZh ? '拖拽或点击上传 VRM 文件' : 'Upload VRM file' }}</span>
            <small>{{ isZh ? '支持 .vrm 格式，最大 50MB' : 'Supports .vrm up to 50MB' }}</small>
          </button>
          <div class="ox-vite-role-vrm-meta">
            <label class="ox-vite-role-field">
              <span>{{ isZh ? '当前模型' : 'Current Model' }}</span>
              <select :value="appearance.selectedModelId" @change="handleVrmModel">
                <option value="">{{ isZh ? '未选择模型' : 'No model selected' }}</option>
                <option v-for="option in appearance.modelOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
              </select>
            </label>
            <div class="ox-vite-role-inline-stats">
              <div><strong>{{ appearance.motionCount }}</strong><span>{{ isZh ? '动作映射' : 'motions' }}</span></div>
              <div><strong>{{ appearance.windowSize }}</strong><span>{{ isZh ? '窗口尺寸' : 'window size' }}</span></div>
              <div><strong>{{ appearance.selectedScene }}</strong><span>{{ isZh ? '场景' : 'scene' }}</span></div>
            </div>
            <div class="ox-vite-role-switch-grid">
              <label class="ox-vite-role-switch">
                <span>
                  <strong>{{ isZh ? '表情映射' : 'Expressions' }}</strong>
                  <small>{{ isZh ? '跟随角色输出驱动表情' : 'Drive facial expressions from output' }}</small>
                </span>
                <input :checked="appearance.expressionsEnabled" type="checkbox" @change="handleVrmToggle('enabledExpressions', $event)" />
              </label>
              <label class="ox-vite-role-switch">
                <span>
                  <strong>{{ isZh ? '动作映射' : 'Motions' }}</strong>
                  <small>{{ isZh ? '启用动作集合' : 'Enable motion set' }}</small>
                </span>
                <input :checked="appearance.motionsEnabled" type="checkbox" @change="handleVrmToggle('enabledMotions', $event)" />
              </label>
            </div>
          </div>
        </div>
      </section>
    </div>

    <div v-else-if="activeTab === 'behavior'" class="ox-vite-role-content ox-vite-role-content--panel">
      <section class="ox-vite-role-panel">
        <div class="ox-vite-role-section-header">
          <h1>{{ isZh ? '自主行为配置' : 'Autonomous Behavior' }}</h1>
          <p>{{ isZh ? '定义角色在无人操作时的主动行为' : 'Define what roles do proactively when unattended.' }}</p>
        </div>

        <div class="ox-vite-role-behavior-list">
          <article v-for="(rule, index) in behavior.rules" :key="rule.id" class="ox-vite-role-behavior-card">
            <div class="ox-vite-role-behavior-card__icon"><i class="fa-solid fa-bolt"></i></div>
            <div class="ox-vite-role-behavior-card__copy">
              <strong>{{ rule.name }}</strong>
              <p>{{ rule.description }}</p>
            </div>
            <div class="ox-vite-role-behavior-card__meta">
              <span>{{ rule.frequency }}</span>
              <input v-if="behavior.hasRealData" :checked="rule.enabled" type="checkbox" @change="handleBehaviorToggle(index)" />
              <span v-else class="ox-vite-role-demo-badge">{{ rule.enabled ? (isZh ? '已启用' : 'Enabled') : (isZh ? '未启用' : 'Disabled') }}</span>
            </div>
          </article>
        </div>

        <button type="button" class="ox-vite-role-primary-btn" @click="handleOpenBehaviorEditor">
          <i class="fa-solid fa-plus"></i>
          <span>{{ isZh ? '添加行为规则' : 'Add behavior rule' }}</span>
        </button>
      </section>
    </div>

    <div v-else class="ox-vite-role-content ox-vite-role-content--panel">
      <section class="ox-vite-role-panel">
        <div class="ox-vite-role-section-header">
          <h1>{{ isZh ? '桌面视觉' : 'Desktop Vision' }}</h1>
          <p>{{ isZh ? '让角色能够感知和理解桌面内容' : 'Let roles perceive and understand what is on the desktop.' }}</p>
        </div>

        <h2>{{ isZh ? '屏幕捕获设置' : 'Screen Capture' }}</h2>
        <div class="ox-vite-role-settings-grid">
          <label class="ox-vite-role-switch">
            <span>
              <strong>{{ isZh ? '启用桌面视觉' : 'Enable desktop vision' }}</strong>
              <small>{{ isZh ? '开启后角色可以感知屏幕内容' : 'Roles can inspect what is on screen' }}</small>
            </span>
            <input :checked="vision.desktopVision" type="checkbox" @change="handleVisionToggle('desktopVision', $event)" />
          </label>

          <label class="ox-vite-role-field">
            <span>{{ isZh ? '截图频率' : 'Capture frequency' }}</span>
            <input :value="vision.captureFrequency" type="text" readonly />
          </label>

          <label class="ox-vite-role-field">
            <span>{{ isZh ? '识别区域' : 'Capture scope' }}</span>
            <input :value="vision.captureScope" type="text" readonly />
          </label>
        </div>

        <h2>{{ isZh ? '视觉模型绑定' : 'Vision Model' }}</h2>
        <div class="ox-vite-role-settings-grid">
          <label class="ox-vite-role-field">
            <span>{{ isZh ? '视觉供应商' : 'Vision provider' }}</span>
            <select :value="vision.selectedProvider" @change="handleVisionProvider">
              <option value="">{{ isZh ? '请选择视觉供应商' : 'Select a provider' }}</option>
              <option v-for="option in vision.providerOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </label>
          <label class="ox-vite-role-field">
            <span>{{ isZh ? '当前视觉模型' : 'Current vision model' }}</span>
            <input :value="vision.modelLabel" type="text" readonly />
          </label>
        </div>

        <h2>{{ isZh ? '唤醒词与隐私' : 'Wake Words and Privacy' }}</h2>
        <div class="ox-vite-role-settings-grid">
          <label class="ox-vite-role-switch">
            <span>
              <strong>{{ isZh ? '启用视觉唤醒词' : 'Enable vision wake words' }}</strong>
              <small>{{ isZh ? '检测到关键词时读取桌面内容' : 'Read desktop content after wake word matches' }}</small>
            </span>
            <input :checked="vision.enableWakeWord" type="checkbox" @change="handleVisionToggle('enableWakeWord', $event)" />
          </label>
          <label class="ox-vite-role-field ox-vite-role-field--full">
            <span>{{ isZh ? '唤醒词' : 'Wake words' }}</span>
            <textarea :value="vision.wakeWord" rows="4" @input="handleVisionText('wakeWord', $event)"></textarea>
          </label>
          <div class="ox-vite-role-field ox-vite-role-field--full">
            <span>{{ isZh ? '排除应用列表' : 'Excluded apps' }}</span>
            <div class="ox-vite-role-chip-wrap">
              <span v-for="app in vision.excludeApps" :key="app" class="ox-vite-role-chip">{{ app }}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style>
#openxnet-vite-role-root {
  display: block;
  height: 100%;
  min-height: 0;
}

.ox-vite-role-shell,
.ox-vite-role-shell * {
  box-sizing: border-box;
}

.ox-vite-role-shell {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 14px 12px 16px;
  background: var(--ox-bg-base);
  color: var(--ox-text-primary);
}

.ox-vite-role-tabs {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 8px 14px;
}

.ox-vite-role-tab {
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: transparent;
  color: var(--ox-text-secondary, #64748b);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
}

.ox-vite-role-tab:hover {
  background: var(--ox-accent-soft, rgba(91, 163, 197, 0.08));
  color: var(--ox-text-primary, #1e293b);
}

.ox-vite-role-tab.active {
  border-color: var(--ox-border-accent, rgba(91, 163, 197, 0.32));
  background: var(--ox-accent-soft, rgba(91, 163, 197, 0.12));
  color: var(--ox-accent, #5BA3C5);
}

.ox-vite-role-content {
  flex: 1 1 auto;
  min-height: 0;
}

.ox-vite-role-content--memory {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  align-items: stretch;
  min-height: 0;
  height: 100%;
  border: 1px solid var(--ox-border);
  border-radius: 18px;
  background: var(--ox-bg-surface);
  overflow: hidden;
}

.ox-vite-role-shell .ox-vite-role-sidebar {
  position: relative;
  border-right: 1px solid var(--ox-border);
  background: var(--ox-bg-surface);
  display: flex !important;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.ox-vite-role-shell .ox-vite-role-sidebar__header {
  position: relative !important;
  flex: 0 0 auto;
  width: 100%;
  height: auto !important;
  min-height: 0 !important;
  max-height: none !important;
  padding: 14px 16px 12px !important;
  border-bottom: 1px solid var(--ox-border);
  display: flex !important;
  flex-direction: column !important;
  gap: 10px !important;
  align-items: stretch !important;
  justify-content: flex-start !important;
  z-index: 1;
  background: var(--ox-bg-surface);
  box-sizing: border-box !important;
}

.ox-vite-role-sidebar__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 36px;
}

.ox-vite-role-sidebar__title-row h2 {
  margin: 0;
  font-size: 16px;
  line-height: 1.2;
  font-weight: 700;
}

.ox-vite-role-search {
  position: relative;
  flex: 0 0 auto;
  width: 100%;
  margin: 0;
}

.ox-vite-role-search i {
  position: absolute;
  top: 50%;
  left: 14px;
  transform: translateY(-50%);
  color: var(--ox-text-muted);
  font-size: 12px;
}

.ox-vite-role-search input,
.ox-vite-role-field input,
.ox-vite-role-field textarea,
.ox-vite-role-field select {
  width: 100%;
  border: 1px solid var(--ox-border);
  border-radius: 14px;
  background: var(--ox-bg-input);
  color: var(--ox-text-primary);
  font: inherit;
}

.ox-vite-role-search input {
  padding: 10px 14px 10px 36px;
}

.ox-vite-role-shell .ox-vite-role-list {
  position: relative !important;
  flex: 1 1 0;
  align-self: stretch;
  min-height: 0;
  height: auto !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
  padding: 10px !important;
  display: block !important;
  margin: 0 !important;
}

.ox-vite-role-shell .ox-vite-role-list > .ox-vite-role-card {
  display: block !important;
  width: 100% !important;
  margin: 0 0 6px 0 !important;
}

.ox-vite-role-shell .ox-vite-role-list > .ox-vite-role-card:last-child {
  margin-bottom: 0 !important;
}

.ox-vite-role-card {
  width: 100%;
  min-height: 92px;
  padding: 12px 12px;
  border: 0;
  border-left: 3px solid transparent;
  border-radius: 14px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.ox-vite-role-card.active {
  border-left-color: #5ba3c5;
  background: rgba(91, 163, 197, 0.08);
}

.ox-vite-role-card__top {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.ox-vite-role-card__avatar,
.ox-vite-role-avatar-upload__circle,
.ox-vite-role-avatar-card__img {
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-weight: 700;
}

.ox-vite-role-card__avatar > span,
.ox-vite-role-avatar-upload__circle > span,
.ox-vite-role-avatar-card__img > span {
  width: 100%;
  height: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  text-align: center;
  line-height: 1.05;
  letter-spacing: 0;
  white-space: normal;
  overflow-wrap: anywhere;
}

.ox-vite-role-card__avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex: 0 0 auto;
}

.ox-vite-role-card__avatar > span {
  padding: 4px;
  font-size: 12px;
}

.ox-vite-role-card__avatar img,
.ox-vite-role-avatar-upload__circle img,
.ox-vite-role-avatar-card__img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ox-vite-role-card__copy {
  min-width: 0;
  flex: 1;
}

.ox-vite-role-card__name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ox-vite-role-card__name {
  font-size: 16px;
  font-weight: 700;
}

.ox-vite-role-card__badge {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
}

.ox-vite-role-card__badge.is-info { background: rgba(96, 165, 250, 0.12); color: #2563eb; }
.ox-vite-role-card__badge.is-success { background: rgba(34, 197, 94, 0.12); color: #16a34a; }
.ox-vite-role-card__badge.is-warning { background: rgba(245, 158, 11, 0.12); color: #d97706; }
.ox-vite-role-card__badge.is-error { background: rgba(244, 63, 94, 0.12); color: #e11d48; }
.ox-vite-role-card__badge.is-accent { background: rgba(91, 163, 197, 0.12); color: #2f6f8f; }
.ox-vite-role-card__badge.is-muted { background: rgba(148, 163, 184, 0.12); color: #64748b; }

.ox-vite-role-card__desc {
  margin-top: 6px;
  color: var(--ox-text-secondary);
  font-size: 13px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.ox-vite-role-card__meta {
  margin-top: 8px;
  padding-left: 52px;
  color: var(--ox-text-muted);
  font-size: 12px;
}

.ox-vite-role-empty {
  min-height: 160px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--ox-text-muted);
  font-size: 13px;
}

.ox-vite-role-empty i {
  font-size: 22px;
}

.ox-vite-role-editor {
  min-height: 0;
  overflow-y: auto;
  padding: 26px 32px 34px;
  background: var(--ox-bg-surface);
  display: flex;
  flex-direction: column;
}

.ox-vite-role-editor__header {
  width: min(100%, 1120px);
  margin: 0 auto 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.ox-vite-role-editor__header h1 {
  margin: 0;
  font-size: 22px;
}

.ox-vite-role-editor__actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ox-vite-role-primary-btn,
.ox-vite-role-secondary-btn,
.ox-vite-role-danger-btn,
.ox-vite-role-play-btn {
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 16px;
  border-radius: 12px;
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}

.ox-vite-role-primary-btn {
  border: 0;
  background: linear-gradient(135deg, #5ba3c5, #7bb8d4);
  color: #ffffff;
}

.ox-vite-role-secondary-btn {
  border: 1px solid var(--ox-border);
  background: var(--ox-bg-surface);
  color: var(--ox-text-secondary);
}

.ox-vite-role-danger-btn {
  border: 1px solid rgba(239, 68, 68, 0.4);
  background: transparent;
  color: #ef4444;
}

.ox-vite-role-editor__lead {
  width: min(100%, 1120px);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 22px;
  align-items: stretch;
}

.ox-vite-role-avatar-panel {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  align-self: start;
}

.ox-vite-role-avatar-panel__copy {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  max-width: 560px;
  text-align: center;
}

.ox-vite-role-avatar-panel__copy strong {
  font-size: 14px;
  color: var(--ox-text-primary);
}

.ox-vite-role-avatar-panel__copy p {
  margin: 0;
  font-size: 12px;
  line-height: 1.65;
  color: var(--ox-text-secondary);
}

.ox-vite-role-avatar-upload {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
  margin-bottom: 0;
}

.ox-vite-role-avatar-upload__circle {
  width: 92px;
  height: 92px;
  border-radius: 50%;
  position: relative;
  border: 0;
  cursor: pointer;
  padding: 0;
}

.ox-vite-role-avatar-upload__circle > span {
  padding: 10px;
  font-size: 20px;
}

.ox-vite-role-avatar-upload__button {
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 12px;
  border: 1px solid var(--ox-border);
  border-radius: 10px;
  background: var(--ox-bg-elevated, var(--ox-bg-surface));
  color: var(--ox-text-primary);
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.ox-vite-role-avatar-upload__overlay {
  position: absolute;
  inset: 0;
  opacity: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.4);
  color: #ffffff;
  font-size: 11px;
}

.ox-vite-role-avatar-upload__circle:hover .ox-vite-role-avatar-upload__overlay {
  opacity: 1;
}

.ox-vite-role-avatar-card__img > span {
  padding: 6px;
  font-size: 13px;
}

.ox-vite-role-form {
  width: min(100%, 960px);
  max-width: 960px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px 20px;
  align-items: start;
}

.ox-vite-role-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ox-vite-role-field--full {
  grid-column: 1 / -1;
}

.ox-vite-role-field--name {
  grid-column: 1 / -1;
  width: min(100%, 540px);
  justify-self: center;
}

.ox-vite-role-field--name > span {
  text-align: center;
}

.ox-vite-role-field span {
  font-size: 13px;
  font-weight: 600;
  color: var(--ox-text-primary);
}

.ox-vite-role-field input,
.ox-vite-role-field select {
  min-height: 42px;
  padding: 0 14px;
}

.ox-vite-role-field textarea {
  padding: 12px 14px;
  resize: vertical;
  line-height: 1.6;
}

.ox-vite-role-tags {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}

.ox-vite-role-tag,
.ox-vite-role-chip {
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--ox-accent-soft);
  color: var(--ox-text-secondary);
  font-size: 12px;
}

.ox-vite-role-slider-row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.ox-vite-role-slider-row input[type="range"] {
  flex: 1;
}

.ox-vite-role-switch-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  grid-column: 1 / -1;
}

.ox-vite-role-switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid var(--ox-border);
  border-radius: 16px;
  background: var(--ox-bg-surface);
}

.ox-vite-role-switch strong {
  display: block;
  font-size: 14px;
}

.ox-vite-role-switch small {
  display: block;
  margin-top: 4px;
  color: var(--ox-text-muted);
  line-height: 1.5;
}

.ox-vite-role-content--panel {
  min-height: 0;
}

.ox-vite-role-panel {
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  padding: 24px 28px;
  border: 1px solid var(--ox-border);
  border-radius: 18px;
  background: var(--ox-bg-surface);
}

.ox-vite-role-section-header {
  margin-bottom: 22px;
}

.ox-vite-role-section-header h1 {
  margin: 0;
  font-size: 28px;
}

.ox-vite-role-section-header p {
  margin: 8px 0 0;
  color: var(--ox-text-secondary);
}

.ox-vite-role-panel h2 {
  margin: 0 0 14px;
  font-size: 18px;
}

.ox-vite-role-provider-cards,
.ox-vite-role-avatar-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  margin-bottom: 28px;
}

.ox-vite-role-provider-card,
.ox-vite-role-avatar-card {
  padding: 16px;
  border: 1px solid var(--ox-border);
  border-radius: 16px;
  background: var(--ox-bg-surface);
}

.ox-vite-role-provider-card.active {
  border-color: var(--ox-border-accent);
  background: var(--ox-accent-softer);
}

.ox-vite-role-provider-card {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #475569;
}

.ox-vite-role-avatar-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.ox-vite-role-avatar-card__img {
  width: 72px;
  height: 72px;
  border-radius: 20px;
}

.ox-vite-role-avatar-card__name {
  font-weight: 700;
}

.ox-vite-role-vrm-section {
  display: grid;
  grid-template-columns: minmax(260px, 320px) minmax(0, 1fr);
  gap: 18px;
  margin-bottom: 28px;
}

.ox-vite-role-vrm-upload {
  min-height: 220px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  border: 1px dashed var(--ox-border-accent);
  border-radius: 18px;
  background: var(--ox-bg-surface-hover);
  color: var(--ox-text-secondary);
  text-align: center;
  cursor: pointer;
}

.ox-vite-role-vrm-upload i {
  font-size: 28px;
  color: #5ba3c5;
}

.ox-vite-role-vrm-meta {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ox-vite-role-inline-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.ox-vite-role-inline-stats > div {
  padding: 14px 16px;
  border: 1px solid var(--ox-border);
  border-radius: 16px;
  background: var(--ox-bg-surface-hover);
}

.ox-vite-role-inline-stats strong {
  display: block;
  font-size: 16px;
}

.ox-vite-role-inline-stats span {
  display: block;
  margin-top: 6px;
  color: var(--ox-text-muted);
  font-size: 12px;
}

.ox-vite-role-table-wrap {
  margin-bottom: 28px;
  border: 1px solid var(--ox-border);
  border-radius: 16px;
  background: var(--ox-bg-surface);
  overflow: hidden;
}

.ox-vite-role-table {
  width: 100%;
  border-collapse: collapse;
}

.ox-vite-role-table th,
.ox-vite-role-table td {
  padding: 14px 16px;
  border-bottom: 1px solid var(--ox-border);
  text-align: left;
}

.ox-vite-role-play-btn {
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--ox-accent-soft);
  color: var(--ox-accent);
}

.ox-vite-role-panel-grid,
.ox-vite-role-settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 28px;
}

.ox-vite-role-panel-grid--voice .ox-vite-role-field--full,
.ox-vite-role-settings-grid .ox-vite-role-field--full {
  grid-column: 1 / -1;
}

.ox-vite-role-behavior-list {
  display: grid;
  gap: 14px;
  margin-bottom: 20px;
}

.ox-vite-role-behavior-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  padding: 16px;
  border: 1px solid var(--ox-border);
  border-radius: 16px;
  background: var(--ox-bg-surface);
}

.ox-vite-role-behavior-card__icon {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(91, 163, 197, 0.08);
  color: #5ba3c5;
}

.ox-vite-role-behavior-card__copy strong {
  display: block;
  font-size: 15px;
}

.ox-vite-role-behavior-card__copy p {
  margin: 6px 0 0;
  color: var(--ox-text-secondary);
  line-height: 1.5;
}

.ox-vite-role-behavior-card__meta {
  display: flex;
  align-items: center;
  gap: 14px;
  color: var(--ox-text-muted);
  font-size: 12px;
}

.ox-vite-role-demo-badge {
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--ox-accent-soft);
  color: var(--ox-accent);
}

.ox-vite-role-chip-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

@media (max-width: 1180px) {
  .ox-vite-role-editor__lead,
  .ox-vite-role-content--memory,
  .ox-vite-role-vrm-section,
  .ox-vite-role-panel-grid,
  .ox-vite-role-settings-grid,
  .ox-vite-role-switch-grid {
    grid-template-columns: 1fr;
  }

  .ox-vite-role-form {
    grid-template-columns: 1fr;
  }

  .ox-vite-role-shell {
    padding-inline: 8px;
  }
}
</style>
