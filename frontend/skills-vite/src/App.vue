<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { createSkillsBridge } from './skillsBridge';

const bridge = createSkillsBridge();
const snapshot = ref(bridge.snapshot());
let refreshTimer = null;

function refreshSnapshot() {
  snapshot.value = bridge.snapshot();
}

function handleTab(tabId) {
  bridge.openTab(tabId);
  refreshSnapshot();
}

function handleFilter(value) {
  bridge.setLibraryFilter(value);
  refreshSnapshot();
}

function handleQuery(event) {
  bridge.setLibraryQuery(event.target.value);
  refreshSnapshot();
}

function handlePreviewSkill(id) {
  bridge.previewSkill(id);
  refreshSnapshot();
}

function handleRefreshSkills() {
  bridge.refreshSkills();
  refreshSnapshot();
}

function handleOpenSkillsFolder() {
  bridge.openSkillsFolder();
}

function handleGithubUrl(event) {
  bridge.setGithubUrl(event.target.value);
  refreshSnapshot();
}

function handleInstallGithub() {
  bridge.installFromGithub();
  refreshSnapshot();
}

function handleZipInput(event) {
  const files = event.target.files;
  if (files && files.length > 0) {
    bridge.uploadSkillZip(files[0]);
  }
  event.target.value = '';
}

function handleCrystalField(field, event) {
  const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
  bridge.setCrystalField(field, value);
  refreshSnapshot();
}

function handleSeedExample() {
  bridge.seedCrystalExample();
  refreshSnapshot();
}

function handleCrystallize() {
  bridge.crystallizeSkill();
  refreshSnapshot();
}

function handleSleepCycle() {
  bridge.runSleepCycle();
  refreshSnapshot();
}

const isZh = computed(() => snapshot.value.isZh);
const activeTab = computed(() => snapshot.value.activeTab || 'library');
const tabs = computed(() => snapshot.value.tabs || []);
const library = computed(() => snapshot.value.library || { items: [], preview: {} });
const transform = computed(() => snapshot.value.transform || { cards: [] });
const crystal = computed(() => snapshot.value.crystal || { draft: {}, lifecycle: {} });

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
  <div class="ox-vite-skills-shell">
    <div class="ox-vite-skills-header">
      <div>
        <h1>{{ isZh ? '技能中心' : 'Skills Center' }}</h1>
        <p>{{ isZh ? '技能仓库、技能转化和技能结晶的统一入口。' : 'One place for the skill library, transformations, and crystallization.' }}</p>
      </div>
      <div class="ox-vite-skills-header__actions">
        <button type="button" class="ox-vite-skills-primary-btn" @click="handleOpenSkillsFolder">
          <i class="fa-regular fa-folder-open"></i>
          <span>{{ isZh ? '打开技能目录' : 'Open skills folder' }}</span>
        </button>
        <button type="button" class="ox-vite-skills-secondary-btn" @click="handleRefreshSkills">
          <i class="fa-solid fa-rotate-right"></i>
          <span>{{ isZh ? '刷新技能' : 'Refresh skills' }}</span>
        </button>
      </div>
    </div>

    <div class="ox-vite-skills-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        class="ox-vite-skills-tab"
        :class="{ active: activeTab === tab.id }"
        @click="handleTab(tab.id)"
      >
        <i :class="tab.icon"></i>
        <span>{{ tab.label }}</span>
      </button>
    </div>

    <template v-if="activeTab === 'library'">
      <div class="ox-vite-skills-library-toolbar">
        <div class="ox-vite-skills-filter-pills">
          <button type="button" class="ox-vite-skills-filter-pill" :class="{ active: snapshot.filter === 'all' }" @click="handleFilter('all')">{{ isZh ? '全部' : 'All' }}</button>
          <button type="button" class="ox-vite-skills-filter-pill" :class="{ active: snapshot.filter === 'featured' }" @click="handleFilter('featured')">{{ isZh ? '推荐' : 'Featured' }}</button>
          <button type="button" class="ox-vite-skills-filter-pill" :class="{ active: snapshot.filter === 'installed' }" @click="handleFilter('installed')">{{ isZh ? '已安装' : 'Installed' }}</button>
          <button type="button" class="ox-vite-skills-filter-pill" :class="{ active: snapshot.filter === 'custom' }" @click="handleFilter('custom')">{{ isZh ? '自定义' : 'Custom' }}</button>
        </div>
        <label class="ox-vite-skills-search">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input :value="snapshot.query" type="text" :placeholder="isZh ? '搜索技能...' : 'Search skills...'" @input="handleQuery" />
        </label>
      </div>

      <div class="ox-vite-skills-library-layout">
        <section class="ox-vite-skills-grid">
          <article v-for="skill in library.items" :key="skill.id" class="ox-vite-skills-card">
            <div class="ox-vite-skills-card__head">
              <div class="ox-vite-skills-card__icon"><i class="fa-solid fa-wand-magic-sparkles"></i></div>
              <div class="ox-vite-skills-card__copy">
                <div class="ox-vite-skills-card__name">{{ skill.name }}</div>
                <div class="ox-vite-skills-card__alias">{{ skill.alias }}</div>
              </div>
              <span class="ox-vite-skills-card__version">v{{ skill.version }}</span>
            </div>
            <p class="ox-vite-skills-card__desc">{{ skill.description }}</p>
            <div class="ox-vite-skills-chip-wrap">
              <span v-for="tag in skill.tags" :key="tag" class="ox-vite-skills-chip">{{ tag }}</span>
            </div>
            <div class="ox-vite-skills-card__footer">
              <span class="ox-vite-skills-card__status" :class="{ installed: skill.installed }">
                <i :class="skill.installed ? 'fa-solid fa-circle-check' : 'fa-regular fa-circle'"></i>
                <span>{{ skill.installed ? (isZh ? '已安装' : 'Installed') : (isZh ? '未安装' : 'Not installed') }}</span>
              </span>
              <button type="button" class="ox-vite-skills-secondary-btn" @click="handlePreviewSkill(skill.id)">
                <i class="fa-solid fa-eye"></i>
                <span>{{ isZh ? '预览' : 'Preview' }}</span>
              </button>
            </div>
          </article>
        </section>

        <aside class="ox-vite-skills-preview">
          <div v-if="library.preview.current" class="ox-vite-skills-preview__head">
            <div class="ox-vite-skills-preview__icon"><i class="fa-solid fa-gem"></i></div>
            <div>
              <h2>{{ library.preview.current.name }}</h2>
              <p>{{ library.preview.current.previewSummary || library.preview.current.description }}</p>
            </div>
          </div>
          <div v-if="library.preview.current" class="ox-vite-skills-chip-wrap">
            <span v-for="item in library.preview.current.previewHighlights" :key="item" class="ox-vite-skills-chip">{{ item }}</span>
          </div>
          <div v-if="library.preview.renderedContent" class="ox-vite-skills-preview__content markdown-body" v-html="library.preview.renderedContent"></div>
          <div v-else class="ox-vite-skills-preview__empty">{{ library.preview.emptyText }}</div>
        </aside>
      </div>
    </template>

    <template v-else-if="activeTab === 'transform'">
      <div class="ox-vite-skills-transform-grid">
        <section class="ox-vite-skills-transform-card">
          <div class="ox-vite-skills-transform-card__head">
            <i class="fa-brands fa-github"></i>
            <div>
              <h2>{{ isZh ? 'GitHub 仓库' : 'GitHub Repository' }}</h2>
              <p>{{ isZh ? '从 GitHub 仓库直接安装技能。' : 'Install a skill directly from a GitHub repository.' }}</p>
            </div>
          </div>
          <label class="ox-vite-skills-field">
            <span>GitHub URL</span>
            <input :value="transform.githubUrl" type="text" placeholder="https://github.com/owner/repo" @input="handleGithubUrl" />
          </label>
          <div class="ox-vite-skills-transform-actions">
            <button type="button" class="ox-vite-skills-primary-btn" @click="handleInstallGithub">
              <i class="fa-solid fa-download"></i>
              <span>{{ isZh ? '下载并安装' : 'Download and install' }}</span>
            </button>
          </div>
        </section>

        <section class="ox-vite-skills-transform-card">
          <div class="ox-vite-skills-transform-card__head">
            <i class="fa-solid fa-file-zipper"></i>
            <div>
              <h2>{{ isZh ? 'ZIP 技能包' : 'ZIP Skill Package' }}</h2>
              <p>{{ isZh ? '上传 ZIP 技能包到全局技能目录。' : 'Upload a ZIP skill package into the global skills directory.' }}</p>
            </div>
          </div>
          <label class="ox-vite-skills-upload-zone">
            <input type="file" accept=".zip" hidden @change="handleZipInput" />
            <i class="fa-solid fa-cloud-arrow-up"></i>
            <span>{{ isZh ? '点击选择 ZIP 技能包' : 'Click to choose a ZIP skill package' }}</span>
            <small>{{ transform.workspacePath ? transform.workspacePath : (isZh ? '当前未选择工作区' : 'No workspace selected') }}</small>
          </label>
        </section>
      </div>
    </template>

    <template v-else>
      <div class="ox-vite-skills-crystal-layout">
        <section class="ox-vite-skills-crystal-main">
          <div class="ox-vite-skills-crystal-head">
            <div>
              <h2>{{ isZh ? '技能结晶' : 'Skill Crystal' }}</h2>
              <p>{{ isZh ? '把高成功率工作流结晶为标准化技能。' : 'Crystallize high-signal workflows into standardized reusable skills.' }}</p>
            </div>
            <div class="ox-vite-skills-crystal-actions">
              <button type="button" class="ox-vite-skills-secondary-btn" @click="handleSeedExample">
                <i class="fa-solid fa-wand-magic-sparkles"></i>
                <span>{{ isZh ? '填充示例' : 'Seed example' }}</span>
              </button>
              <button type="button" class="ox-vite-skills-secondary-btn" @click="handleSleepCycle">
                <i class="fa-solid fa-moon"></i>
                <span>{{ isZh ? '运行睡眠周期' : 'Run sleep cycle' }}</span>
              </button>
            </div>
          </div>

          <div class="ox-vite-skills-crystal-stats">
            <article v-for="state in crystal.lifecycleStates" :key="state.value" class="ox-vite-skills-crystal-stat">
              <span>{{ state.label }}</span>
              <strong>{{ crystal.lifecycle.counts[state.value] || 0 }}</strong>
            </article>
          </div>

          <div class="ox-vite-skills-crystal-form">
            <label class="ox-vite-skills-field">
              <span>{{ isZh ? '来源' : 'Source' }}</span>
              <select :value="crystal.draft.source" @change="handleCrystalField('source', $event)">
                <option v-for="option in crystal.sourceOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
              </select>
            </label>
            <label class="ox-vite-skills-field">
              <span>{{ isZh ? '技能名称' : 'Skill Name' }}</span>
              <input :value="crystal.draft.name" type="text" @input="handleCrystalField('name', $event)" />
            </label>
            <label class="ox-vite-skills-field">
              <span>{{ isZh ? '技能 ID' : 'Skill ID' }}</span>
              <input :value="crystal.draft.id" type="text" @input="handleCrystalField('id', $event)" />
            </label>
            <label class="ox-vite-skills-field ox-vite-skills-field--full">
              <span>{{ isZh ? '描述' : 'Description' }}</span>
              <textarea :value="crystal.draft.description" rows="3" @input="handleCrystalField('description', $event)"></textarea>
            </label>
            <label class="ox-vite-skills-field ox-vite-skills-field--full">
              <span>{{ isZh ? '触发场景' : 'Trigger Context' }}</span>
              <textarea :value="crystal.draft.trigger" rows="4" @input="handleCrystalField('trigger', $event)"></textarea>
            </label>
            <label class="ox-vite-skills-field ox-vite-skills-field--full">
              <span>{{ isZh ? '工作流步骤' : 'Workflow' }}</span>
              <textarea :value="crystal.draft.workflow" rows="4" @input="handleCrystalField('workflow', $event)"></textarea>
            </label>
            <label class="ox-vite-skills-field ox-vite-skills-field--full">
              <span>{{ isZh ? 'Guardrails / 备注' : 'Guardrails / Notes' }}</span>
              <textarea :value="crystal.draft.notes" rows="3" @input="handleCrystalField('notes', $event)"></textarea>
            </label>
            <label class="ox-vite-skills-checkbox">
              <input :checked="crystal.draft.syncToWorkspace" type="checkbox" @change="handleCrystalField('syncToWorkspace', $event)" />
              <span>{{ isZh ? '同步到当前工作区' : 'Sync to current workspace' }}</span>
            </label>
          </div>

          <div class="ox-vite-skills-transform-actions">
            <button type="button" class="ox-vite-skills-primary-btn" @click="handleCrystallize">
              <i class="fa-solid fa-gem"></i>
              <span>{{ isZh ? '生成技能' : 'Create skill' }}</span>
            </button>
          </div>
        </section>

        <aside class="ox-vite-skills-crystal-preview">
          <h3>SKILL.md</h3>
          <div class="ox-vite-skills-crystal-preview__content markdown-body">
            <pre>{{ crystal.preview }}</pre>
          </div>
        </aside>
      </div>
    </template>
  </div>
</template>

<style>
#openxnet-vite-skills-root {
  display: block;
  height: 100%;
  min-height: 0;
}

.ox-vite-skills-shell,
.ox-vite-skills-shell * {
  box-sizing: border-box;
}

.ox-vite-skills-shell {
  height: auto;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  padding: 18px 0 16px;
  background: transparent;
  color: var(--ox-text-primary);
  overflow: visible;
}

.ox-vite-skills-header {
  flex: 0 0 auto;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding: 0 24px 16px;
}

.ox-vite-skills-header h1 {
  margin: 0;
  font-size: 36px;
  line-height: 1.1;
}

.ox-vite-skills-header p {
  margin: 10px 0 0;
  color: #64748b;
  font-size: 16px;
}

.ox-vite-skills-header__actions,
.ox-vite-skills-transform-actions,
.ox-vite-skills-crystal-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ox-vite-skills-tabs {
  flex: 0 0 auto;
  display: flex;
  gap: 8px;
  padding: 0 24px 18px;
}

.ox-vite-skills-tab,
.ox-vite-skills-filter-pill,
.ox-vite-skills-primary-btn,
.ox-vite-skills-secondary-btn {
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

.ox-vite-skills-tab,
.ox-vite-skills-filter-pill,
.ox-vite-skills-secondary-btn {
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: #ffffff;
  color: #64748b;
}

.ox-vite-skills-tab.active,
.ox-vite-skills-filter-pill.active {
  border-color: rgba(91, 163, 197, 0.18);
  background: rgba(91, 163, 197, 0.08);
  color: #1e293b;
  font-weight: 600;
}

.ox-vite-skills-primary-btn {
  border: 0;
  background: linear-gradient(135deg, #5ba3c5, #7bb8d4);
  color: #ffffff;
}

.ox-vite-skills-library-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 24px 16px;
}

.ox-vite-skills-filter-pills,
.ox-vite-skills-chip-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ox-vite-skills-search {
  position: relative;
  width: 300px;
}

.ox-vite-skills-search i {
  position: absolute;
  top: 50%;
  left: 14px;
  transform: translateY(-50%);
  color: #94a3b8;
  font-size: 12px;
}

.ox-vite-skills-search input,
.ox-vite-skills-field input,
.ox-vite-skills-field select,
.ox-vite-skills-field textarea {
  width: 100%;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 14px;
  background: #f4f5f9;
  color: #1e293b;
  font: inherit;
}

.ox-vite-skills-search input {
  min-height: 40px;
  padding: 0 14px 0 36px;
}

.ox-vite-skills-library-layout,
.ox-vite-skills-crystal-layout {
  flex: 0 0 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  grid-template-rows: minmax(0, 1fr);
  gap: 18px;
  padding: 0 24px 0;
  overflow: visible;
  align-items: stretch;
}

.ox-vite-skills-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  align-content: start;
  align-items: start;
  min-height: 0;
  height: auto;
  max-height: none;
  overflow: visible;
  padding-right: 0;
  align-self: stretch;
}

.ox-vite-skills-card,
.ox-vite-skills-preview,
.ox-vite-skills-transform-card,
.ox-vite-skills-crystal-main,
.ox-vite-skills-crystal-preview {
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.04);
}

.ox-vite-skills-card {
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.ox-vite-skills-card__head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.ox-vite-skills-card__icon,
.ox-vite-skills-preview__icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(91, 163, 197, 0.08);
  color: #5ba3c5;
}

.ox-vite-skills-card__copy {
  min-width: 0;
  flex: 1;
}

.ox-vite-skills-card__name {
  font-size: 18px;
  font-weight: 700;
}

.ox-vite-skills-card__alias {
  margin-top: 4px;
  color: #94a3b8;
  font-size: 12px;
}

.ox-vite-skills-card__version {
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.12);
  color: #64748b;
  font-size: 11px;
}

.ox-vite-skills-card__desc {
  margin: 0;
  color: #64748b;
  line-height: 1.6;
  font-size: 14px;
}

.ox-vite-skills-chip {
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(91, 163, 197, 0.08);
  color: #64748b;
  font-size: 12px;
}

.ox-vite-skills-card__footer {
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.ox-vite-skills-card__status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #94a3b8;
  font-size: 13px;
}

.ox-vite-skills-card__status.installed {
  color: #15803d;
}

.ox-vite-skills-preview {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  height: auto;
  max-height: none;
  overflow: visible;
  align-self: stretch;
}

.ox-vite-skills-preview__head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.ox-vite-skills-preview__head h2 {
  margin: 0;
  font-size: 22px;
}

.ox-vite-skills-preview__head p {
  margin: 8px 0 0;
  color: #64748b;
  font-size: 14px;
  line-height: 1.6;
}

.ox-vite-skills-preview__content,
.ox-vite-skills-preview__empty {
  padding: 16px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 16px;
  background: #f8fafc;
}

.ox-vite-skills-preview__empty {
  color: #64748b;
  line-height: 1.6;
}

.ox-vite-skills-transform-grid {
  flex: 0 0 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-template-rows: minmax(0, 1fr);
  gap: 18px;
  padding: 0 24px;
  align-items: start;
  overflow: visible;
}

.ox-vite-skills-transform-card,
.ox-vite-skills-crystal-main,
.ox-vite-skills-crystal-preview {
  padding: 22px;
}

.ox-vite-skills-transform-card__head,
.ox-vite-skills-crystal-head {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 18px;
}

.ox-vite-skills-transform-card__head i {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(91, 163, 197, 0.08);
  color: #5ba3c5;
  font-size: 18px;
}

.ox-vite-skills-transform-card__head h2,
.ox-vite-skills-crystal-head h2 {
  margin: 0;
  font-size: 26px;
}

.ox-vite-skills-transform-card__head p,
.ox-vite-skills-crystal-head p {
  margin: 8px 0 0;
  color: #64748b;
  line-height: 1.6;
}

.ox-vite-skills-upload-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 220px;
  padding: 24px;
  border: 1px dashed rgba(91, 163, 197, 0.3);
  border-radius: 18px;
  background: rgba(91, 163, 197, 0.03);
  color: #64748b;
  text-align: center;
  cursor: pointer;
}

.ox-vite-skills-upload-zone i {
  font-size: 28px;
  color: #5ba3c5;
}

.ox-vite-skills-crystal-main,
.ox-vite-skills-crystal-preview {
  min-height: 0;
  height: auto;
  overflow: visible;
}

.ox-vite-skills-crystal-stats {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}

.ox-vite-skills-crystal-stat {
  padding: 12px 14px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 16px;
  background: #f8fafc;
}

.ox-vite-skills-crystal-stat span {
  display: block;
  color: #94a3b8;
  font-size: 12px;
}

.ox-vite-skills-crystal-stat strong {
  display: block;
  margin-top: 6px;
  font-size: 18px;
}

.ox-vite-skills-crystal-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.ox-vite-skills-field,
.ox-vite-skills-checkbox {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ox-vite-skills-field--full {
  grid-column: 1 / -1;
}

.ox-vite-skills-field span {
  font-size: 13px;
  font-weight: 600;
  color: #475569;
}

.ox-vite-skills-field input,
.ox-vite-skills-field select {
  min-height: 42px;
  padding: 0 14px;
}

.ox-vite-skills-field textarea {
  min-height: 100px;
  padding: 12px 14px;
  resize: vertical;
  line-height: 1.6;
}

.ox-vite-skills-checkbox {
  grid-column: 1 / -1;
  flex-direction: row;
  align-items: center;
}

.ox-vite-skills-crystal-preview__content {
  height: 100%;
  overflow: auto;
  padding: 16px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 16px;
  background: #f8fafc;
}

.ox-vite-skills-crystal-preview__content pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 1180px) {
  .ox-vite-skills-library-layout,
  .ox-vite-skills-crystal-layout,
  .ox-vite-skills-transform-grid,
  .ox-vite-skills-crystal-form,
  .ox-vite-skills-crystal-stats {
    grid-template-columns: 1fr;
  }

  .ox-vite-skills-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ox-vite-skills-header,
  .ox-vite-skills-library-toolbar,
  .ox-vite-skills-crystal-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .ox-vite-skills-search {
    width: 100%;
  }
}
</style>
