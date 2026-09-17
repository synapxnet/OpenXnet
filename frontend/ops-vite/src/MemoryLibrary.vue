<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { createMemoryDocumentRenderer } from './memory-document';

const props = defineProps({
  memory: { type: Object, default: () => ({}) },
  bridge: { type: Object, required: true },
  isZh: { type: Boolean, default: true },
});
const emit = defineEmits(['refresh']);
const copy = (zh, en) => props.isZh ? zh : en;
const renderDocument = createMemoryDocumentRenderer(typeof window === 'undefined' ? undefined : window.markdownit);
const actorAgent = ref('');
const query = ref('');
const includeRetired = ref(false);
const busy = ref(false);
const actionError = ref('');
const feedback = ref('');
const editorOpen = ref(false);
const editorMode = ref('create');
const draftActor = ref('');
const draft = ref(emptyDraft());
const titleInput = ref(null);
const importInput = ref(null);
const items = computed(() => props.memory.items || []);
const selected = computed(() => props.memory.selectedMemory || null);
const history = computed(() => [...(props.memory.history || [])].sort((a, b) => Number(b.version) - Number(a.version)));
const available = computed(() => props.memory.available !== false);
const loading = computed(() => busy.value || !!props.memory.loading);
const canEdit = computed(() => !!selected.value && !!props.memory.actorAgent && selected.value.ownerAgent === props.memory.actorAgent);
const filtersLocked = computed(() => loading.value || editorOpen.value);
const actorChanged = computed(() => editorOpen.value && draftActor.value !== String(props.memory.actorAgent || ''));
const canSubmit = computed(() => !loading.value && !actorChanged.value && !!draft.value.title.trim() && !!draft.value.content.trim()
  && (editorMode.value === 'edit' || !!draft.value.taskId.trim()));
const tags = computed(() => (selected.value?.tags || []).filter(tag => !String(tag).startsWith('memory-type:')));
const integrity = computed(() => props.memory.integrity);
const status = computed(() => props.memory.status || {});
const ollama = computed(() => props.memory.ollama || {});
const ollamaResult = computed(() => ollama.value.status || null);
const ollamaModels = computed(() => Array.isArray(ollamaResult.value?.models) ? ollamaResult.value.models : []);
const ollamaStatusKey = computed(() => {
  if (ollama.value.loading) return 'checking';
  if (!ollamaResult.value) return ollama.value.attempted ? 'unavailable' : 'unknown';
  if (ollamaResult.value.status === 'ready' && ollamaModels.value.length) return 'ready';
  if (ollamaResult.value.status === 'ready') return 'empty';
  if (ollamaResult.value.status === 'blocked') return 'blocked';
  return 'offline';
});
const ollamaStatusLabel = computed(() => ({
  checking: copy('检测中', 'Checking'),
  ready: copy('已连接', 'Connected'),
  empty: copy('无本地模型', 'No local models'),
  offline: copy('服务未启动', 'Service offline'),
  blocked: copy('响应无效', 'Invalid response'),
  unavailable: copy('桌面桥接不可用', 'Desktop bridge unavailable'),
  unknown: copy('尚未检测', 'Not checked'),
}[ollamaStatusKey.value] || copy('未知', 'Unknown')));
const ollamaStatusTone = computed(() => ({ ready: 'ready', checking: 'checking', empty: 'warning', offline: 'muted', blocked: 'error', unavailable: 'muted', unknown: 'muted' }[ollamaStatusKey.value] || 'muted'));
const visibleError = computed(() => actionError.value || props.memory.error || '');
const integrityMessage = computed(() => {
  if (!integrity.value) return copy('尚未校验', 'Not verified yet');
  if (!integrity.value.healthy) return copy('完整性校验发现异常', 'Integrity verification found problems');
  const recovery = props.memory.recovery;
  if (recovery?.source === 'bundled-transfer' && Number(recovery.importedVersions) > 0) {
    return copy(`已恢复 ${recovery.importedVersions} 个可信版本，记录链与审计链完整`, `${recovery.importedVersions} trusted versions restored; record and audit chains are healthy`);
  }
  if (recovery?.source === 'competition-history' && Number(recovery.reconciledMemories) > 0) {
    return copy(`已同步 ${recovery.reconciledMemories} 条完成记录，记录链与审计链完整`, `${recovery.reconciledMemories} completed workflows synchronized; record and audit chains are healthy`);
  }
  return copy(`已校验 ${integrity.value.checkedVersions ?? 0} 个版本，记录链与审计链完整`, `${integrity.value.checkedVersions ?? 0} versions verified; record and audit chains are healthy`);
});

// Polling rebuilds snapshots. Synchronize only untouched filters; drafts belong to the editor.
watch(() => [String(props.memory.actorAgent || ''), String(props.memory.query || ''), !!props.memory.includeRetired], (values, previous = []) => {
  if (editorOpen.value || busy.value) return;
  [actorAgent, query, includeRetired].forEach((field, index) => {
    if (previous[index] === undefined || field.value === previous[index]) field.value = values[index];
  });
}, { immediate: true });

function emptyDraft() {
  return { memoryId: '', baseVersion: 0, taskId: '', title: '', content: '', qualityScore: 0.8, permissionsText: '', tagsText: '', reason: '' };
}

function parseList(value) {
  return [...new Set(String(value || '').split(/[,，\n]/).map(item => item.trim()).filter(Boolean))];
}

/** Keep failures visible and retain the current draft; bridge methods throw on failure. */
async function perform(operation, refresh = true) {
  if (loading.value) return { ok: false };
  busy.value = true;
  actionError.value = '';
  feedback.value = '';
  try {
    const result = await operation();
    if (refresh) emit('refresh');
    return { ok: true, result };
  } catch (error) {
    actionError.value = String(error?.message || copy('操作失败，请重试。', 'The operation failed. Please retry.'));
    return { ok: false };
  } finally {
    busy.value = false;
  }
}

async function focusTitle() {
  await nextTick();
  titleInput.value?.focus();
}

function openCreate() {
  if (!available.value || loading.value || editorOpen.value) return;
  editorMode.value = 'create';
  draft.value = emptyDraft();
  draftActor.value = String(props.memory.actorAgent || '');
  actionError.value = '';
  feedback.value = '';
  editorOpen.value = true;
  focusTitle();
}

function openEdit() {
  if (!canEdit.value || loading.value || editorOpen.value) return;
  const record = selected.value;
  editorMode.value = 'edit';
  draft.value = {
    memoryId: String(record.memoryId || ''), baseVersion: Number(record.version || 0), taskId: String(record.taskId || ''),
    title: String(record.title || ''), content: String(record.content || ''), qualityScore: Number(record.qualityScore ?? 0.8),
    permissionsText: (record.permissions || []).join(', '), tagsText: (record.tags || []).join(', '), reason: '',
  };
  draftActor.value = String(props.memory.actorAgent || '');
  actionError.value = '';
  feedback.value = '';
  editorOpen.value = true;
  focusTitle();
}

function cancelEditor() {
  if (loading.value) return;
  editorOpen.value = false;
  actionError.value = '';
  actorAgent.value = String(props.memory.actorAgent || '');
}

async function submitEditor() {
  if (!canSubmit.value) return;
  const source = draft.value;
  const payload = {
    memoryId: source.memoryId, baseVersion: source.baseVersion, taskId: source.taskId.trim(),
    title: source.title.trim(), content: source.content.trim(), qualityScore: Number(source.qualityScore ?? 0.8),
    permissions: parseList(source.permissionsText), tags: parseList(source.tagsText), reason: source.reason.trim(),
  };
  const outcome = await perform(() => editorMode.value === 'edit'
    ? props.bridge.editSynapxnetMemory(payload) : props.bridge.createSynapxnetMemory(payload));
  if (outcome.ok) {
    editorOpen.value = false;
    feedback.value = copy('记忆已保存。', 'Memory saved.');
  }
}

async function applyFilters() {
  if (filtersLocked.value || !available.value) return;
  await perform(() => props.bridge.loadSynapxnetMemories({ actorAgent: actorAgent.value, query: query.value, includeRetired: includeRetired.value }));
}

async function selectMemory(memoryId) {
  if (filtersLocked.value || memoryId === props.memory.selectedMemoryId) return;
  await perform(() => props.bridge.selectSynapxnetMemory(memoryId));
}

async function rollback(version) {
  if (!canEdit.value || loading.value || editorOpen.value || Number(version.version) === Number(selected.value.version)) return;
  const record = selected.value;
  if (!window.confirm(copy(`确认从 v${version.version} 创建一个新的回滚版本？历史版本不会被覆盖。`, `Create a new rollback version from v${version.version}? Existing history will remain unchanged.`))) return;
  const outcome = await perform(() => props.bridge.rollbackSynapxnetMemory(record.memoryId, version.version, copy('用户从版本时间线回滚', 'User rollback from version timeline')));
  if (outcome.ok) feedback.value = copy('已创建回滚版本。', 'Rollback version created.');
}

async function retire() {
  if (!canEdit.value || loading.value || editorOpen.value || selected.value.status === 'RETIRED') return;
  const record = selected.value;
  if (!window.confirm(copy('确认退役当前记忆？历史版本仍会保留。', 'Retire this memory? Its version history will be preserved.'))) return;
  const outcome = await perform(() => props.bridge.retireSynapxnetMemory(record.memoryId));
  if (outcome.ok) feedback.value = copy('记忆已退役，历史版本已保留。', 'Memory retired; its version history is preserved.');
}

async function verify() {
  if (!available.value) return;
  const outcome = await perform(() => props.bridge.verifySynapxnetMemory(''));
  if (outcome.ok) feedback.value = outcome.result?.healthy
    ? copy('完整性校验通过。', 'Integrity verification passed.')
    : copy('完整性校验发现异常，请查看运行状态。', 'Integrity verification found problems. See runtime status.');
}

/** Re-run the Main-process Ollama probe and refresh the Memory V3 snapshot. */
async function redetectOllama() {
  if (loading.value || typeof props.bridge.detectApplicationOllama !== 'function') return;
  busy.value = true;
  actionError.value = '';
  feedback.value = '';
  try {
    await props.bridge.detectApplicationOllama(true);
    emit('refresh');
    feedback.value = copy('已重新检测本机 Ollama。', 'Local Ollama was checked again.');
  } catch (error) {
    actionError.value = String(error?.message || copy('Ollama 检测失败，请重试。', 'Ollama detection failed. Please retry.'));
  } finally {
    busy.value = false;
  }
}

async function exportMemory() {
  if (!selected.value || loading.value) return;
  const memoryId = selected.value.memoryId;
  await perform(async () => {
    const document = await props.bridge.exportSynapxnetMemories([memoryId]);
    const url = URL.createObjectURL(new Blob([JSON.stringify(document, null, 2)], { type: 'application/json;charset=utf-8' }));
    const anchor = window.document.createElement('a');
    try {
      anchor.href = url;
      anchor.download = `openxnet-memory-${memoryId.slice(0, 12)}.json`;
      anchor.hidden = true;
      window.document.body.appendChild(anchor);
      anchor.click();
      feedback.value = copy('已交给浏览器下载。', 'Sent to the browser for download.');
    } finally {
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }, false);
}

function chooseImport() {
  if (filtersLocked.value || !available.value) return;
  importInput.value?.click();
}

async function importMemory(event) {
  const input = event.target;
  const file = input.files?.[0];
  if (!file || filtersLocked.value || !available.value) { input.value = ''; return; }
  const outcome = await perform(async () => {
    const document = JSON.parse(await file.text());
    return props.bridge.importSynapxnetMemories(document);
  });
  input.value = '';
  if (outcome.ok) feedback.value = copy('记忆导入完成。', 'Memory import completed.');
}

function formatTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString(props.isZh ? 'zh-CN' : 'en-US');
}

function shortHash(value) {
  const hash = String(value || '');
  return hash ? `${hash.slice(0, 8)}…${hash.slice(-6)}` : '—';
}

function typeLabel(value) {
  return ({ skill: copy('技能记忆', 'Skill'), incident: copy('事件记忆', 'Incident'), collaboration: copy('协作记忆', 'Collaboration'), decision: copy('决策记忆', 'Decision'), manual: copy('人工记忆', 'Manual') })[value] || copy('人工记忆', 'Manual');
}

function operationLabel(value) {
  return ({ CREATE: copy('创建', 'Created'), EDIT: copy('编辑', 'Edited'), ROLLBACK: copy('回滚', 'Rollback'), RETIRE: copy('退役', 'Retired'), IMPORT: copy('导入', 'Imported') })[String(value).toUpperCase()] || value;
}

function modelSize(value) {
  const size = Number(value);
  if (!Number.isFinite(size) || size <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let index = 0;
  let current = size;
  while (current >= 1024 && index < units.length - 1) { current /= 1024; index += 1; }
  return `${current >= 10 || index === 0 ? current.toFixed(0) : current.toFixed(1)} ${units[index]}`;
}

defineExpose({ openCreate });
</script>

<template>
  <section class="ox-memory-library" :aria-label="copy('原生记忆', 'Native memory')" :aria-busy="loading">
    <div class="ox-memory-library-toolbar ox-vite-memory-toolbar">
      <label class="ox-memory-library-actor ox-vite-memory-actor">
        <i class="fa-regular fa-user" aria-hidden="true"></i>
        <select v-model="actorAgent" :aria-label="copy('记忆身份', 'Memory identity')" :disabled="filtersLocked || !available" @change="applyFilters">
          <option v-if="!actorAgent" value="">{{ copy('选择身份', 'Choose an identity') }}</option>
          <option v-for="agent in memory.agentOptions || []" :key="agent.id" :value="agent.id">{{ agent.name }}</option>
        </select>
      </label>
      <label class="ox-memory-library-search ox-vite-memory-search">
        <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
        <input v-model="query" type="search" :aria-label="copy('搜索记忆', 'Search memories')" :placeholder="copy('搜索标题、内容、任务或标签', 'Search title, content, task, or tags')" :disabled="!available" @keyup.enter="applyFilters" />
      </label>
      <button class="ox-memory-library-button is-primary" type="button" :disabled="filtersLocked || !available" @click="openCreate"><i class="fa-solid fa-plus" aria-hidden="true"></i>{{ copy('新建记忆', 'New Memory') }}</button>
    </div>

    <div class="ox-memory-library-statusline">
      <span>{{ copy('可见记忆', 'Visible memories') }} <strong>{{ items.length }}</strong></span>
      <span v-if="status.tiers?.longTerm">{{ copy('总版本', 'Total versions') }} {{ status.tiers.longTerm.versions }}</span>
      <span v-if="status.auditEvents !== undefined">{{ copy('审计', 'Audit events') }} {{ status.auditEvents }}</span>
      <span v-if="loading" class="ox-memory-library-progress" role="status">{{ copy('正在处理…', 'Working…') }}</span>
      <div class="ox-memory-library-status-actions">
        <label class="ox-memory-library-check ox-vite-memory-check"><input v-model="includeRetired" type="checkbox" :disabled="filtersLocked || !available" @change="applyFilters" />{{ copy('显示已退役', 'Show retired') }}</label>
        <button type="button" class="ox-memory-library-text-button" :disabled="filtersLocked || !available" :title="copy('导入记忆', 'Import memory')" @click="chooseImport">{{ copy('导入', 'Import') }}</button>
        <button type="button" class="ox-memory-library-icon-button" :disabled="filtersLocked || !available" :aria-label="copy('刷新', 'Refresh')" :title="copy('刷新', 'Refresh')" @click="applyFilters"><i class="fa-solid fa-rotate-right" aria-hidden="true"></i></button>
      </div>
      <input ref="importInput" class="ox-memory-library-file-input" type="file" accept=".json,application/json" @change="importMemory" />
    </div>

    <p v-if="visibleError" class="ox-memory-library-notice ox-vite-memory-notice is-error" role="alert"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>{{ visibleError }}</p>
    <p v-else-if="!available" class="ox-memory-library-notice" role="status">{{ copy('记忆服务尚未连接，连接后可查看和管理记忆。', 'The memory service is not connected. Connect it to view and manage memories.') }}</p>
    <p v-if="integrity && !integrity.healthy" class="ox-memory-library-notice is-error" role="alert">{{ integrityMessage }}</p>
    <p v-if="feedback" class="ox-memory-library-feedback" role="status">{{ feedback }}</p>

    <div class="ox-memory-library-layout">
      <aside class="ox-memory-library-index" :aria-label="copy('记忆列表', 'Memory list')">
        <div v-if="items.length" class="ox-memory-library-list">
          <button v-for="item in items" :key="item.memoryId" type="button" class="ox-memory-library-row ox-vite-memory-row" :class="{ active: memory.selectedMemoryId === item.memoryId }" :aria-pressed="memory.selectedMemoryId === item.memoryId" :disabled="filtersLocked" @click="selectMemory(item.memoryId)">
            <div class="ox-memory-library-row-heading ox-vite-memory-row__head"><strong>{{ item.title }}</strong></div>
            <p>{{ item.contentPreview || copy('暂无摘要', 'No preview') }}</p>
            <div class="ox-memory-library-row-meta ox-vite-memory-row__meta">
              <span class="ox-memory-library-type" :data-memory-type="item.memoryType">{{ typeLabel(item.memoryType) }}</span><span>v{{ item.version }}</span><span v-if="item.status === 'RETIRED'">{{ copy('已退役', 'Retired') }}</span>
            </div>
            <span class="ox-memory-library-owner" :title="item.ownerAgent">{{ item.ownerAgent }}</span>
          </button>
        </div>
        <div v-else class="ox-memory-library-empty">
          <i class="fa-regular fa-folder-open" aria-hidden="true"></i>
          <strong>{{ loading ? copy('正在读取记忆…', 'Loading memories…') : query ? copy('没有找到匹配的记忆', 'No matching memories') : copy('还没有可见记忆', 'No visible memories yet') }}</strong>
          <p>{{ query ? copy('试试其他关键词，按回车搜索。', 'Try another keyword and press Enter.') : copy('选择其他身份，或创建第一条记忆。', 'Choose another identity or create your first memory.') }}</p>
        </div>
      </aside>

      <div class="ox-memory-library-reader">
        <form v-if="editorOpen" class="ox-memory-library-editor ox-vite-memory-form" @submit.prevent="submitEditor">
          <div class="ox-memory-library-document-top"><span>{{ editorMode === 'edit' ? copy('编辑为新版本', 'Edit as a new version') : copy('新建长期记忆', 'New long-term memory') }}</span><span v-if="editorMode === 'edit'">v{{ draft.baseVersion }} → v{{ draft.baseVersion + 1 }}</span></div>
          <label class="ox-memory-library-field ox-vite-field"><span>{{ copy('标题', 'Title') }}</span><input ref="titleInput" v-model="draft.title" type="text" required :disabled="loading" :placeholder="copy('给这条记忆一个清楚的标题', 'Give this memory a clear title')" /></label>
          <label v-if="editorMode === 'create'" class="ox-memory-library-field ox-vite-field"><span>{{ copy('任务标识', 'Task ID') }}</span><input v-model="draft.taskId" type="text" required :disabled="loading" :placeholder="copy('关联的任务 ID', 'Associated task ID')" /></label>
          <label class="ox-memory-library-field ox-vite-field"><span>{{ copy('记忆内容', 'Memory Content') }}<small>Markdown</small></span><textarea v-model="draft.content" rows="12" required :disabled="loading" :placeholder="copy('记录事实、决策或可复用的经验…', 'Capture facts, decisions, or reusable knowledge…')"></textarea></label>
          <details class="ox-memory-library-details" data-memory-section="draft-options">
            <summary>{{ copy('共享、标签与质量', 'Sharing, tags, and quality') }}</summary>
            <div class="ox-memory-library-options">
              <label class="ox-memory-library-field ox-vite-field"><span>{{ copy('共享 Agent', 'Shared Agents') }}</span><input v-model="draft.permissionsText" type="text" :disabled="loading" :placeholder="copy('用逗号分隔，* 表示公开', 'Comma-separated; * means public')" /><small>{{ copy('留空时仅所有者可见。', 'Leave empty for owner-only access.') }}</small></label>
              <label class="ox-memory-library-field ox-vite-field"><span>{{ copy('标签', 'Tags') }}</span><input v-model="draft.tagsText" type="text" :disabled="loading" :placeholder="copy('用逗号分隔', 'Comma-separated')" /></label>
              <label class="ox-memory-library-field ox-vite-field"><span>{{ copy('质量评分', 'Quality Score') }} <output>{{ Number(draft.qualityScore).toFixed(2) }}</output></span><input v-model.number="draft.qualityScore" type="range" min="0" max="1" step="0.05" :disabled="loading" /></label>
            </div>
          </details>
          <label v-if="editorMode === 'edit'" class="ox-memory-library-field ox-vite-field"><span>{{ copy('修改原因', 'Change Reason') }}<small>{{ copy('可选', 'Optional') }}</small></span><input v-model="draft.reason" type="text" :disabled="loading" /></label>
          <p v-if="actorChanged" class="ox-memory-library-notice is-error" role="alert">{{ copy('当前身份已变化，草稿已保留。请恢复原身份后提交，或取消编辑。', 'The current identity changed. Your draft is retained. Restore the original identity to save, or cancel editing.') }}</p>
          <div class="ox-memory-library-editor-footer"><span>{{ copy('保存后保留完整版本记录', 'Saving preserves the version history') }}</span><div><button type="button" class="ox-memory-library-button" :disabled="loading" @click="cancelEditor">{{ copy('取消', 'Cancel') }}</button><button type="submit" class="ox-memory-library-button is-primary" :disabled="!canSubmit">{{ loading ? copy('正在保存…', 'Saving…') : copy('提交版本', 'Commit Version') }}</button></div></div>
        </form>

        <article v-else-if="selected" :key="selected.memoryId" class="ox-memory-library-document ox-vite-memory-document">
          <div class="ox-memory-library-document-top"><span :title="selected.taskId">{{ selected.taskId }}</span><div class="ox-memory-library-document-actions ox-vite-memory-header-actions"><button type="button" class="ox-memory-library-text-button" :disabled="loading" :title="copy('导出迁移包', 'Export transfer package')" @click="exportMemory">{{ copy('导出', 'Export') }}</button><button v-if="canEdit" type="button" class="ox-memory-library-button" :disabled="loading" :title="copy('编辑', 'Edit')" @click="openEdit"><i class="fa-solid fa-pen" aria-hidden="true"></i>{{ copy('编辑', 'Edit') }}</button></div></div>
          <h2>{{ selected.title }}</h2>
          <div class="ox-memory-library-document-meta"><span class="ox-memory-library-type" :data-memory-type="selected.memoryType">{{ typeLabel(selected.memoryType) }}</span><span>v{{ selected.version }}</span><span v-if="selected.status === 'RETIRED'">{{ copy('已退役', 'Retired') }}</span><span>{{ formatTime(selected.committedAtUtc) }}</span></div>
          <div v-if="tags.length" class="ox-memory-library-tags"><span v-for="tag in tags" :key="tag">{{ tag }}</span></div>
          <div class="ox-memory-library-prose ox-ops-memory-prose" v-html="renderDocument(selected.content)"></div>

          <details class="ox-memory-library-details" data-memory-section="access">
            <summary>{{ copy('共享与记录信息', 'Sharing and record details') }}<span>{{ (selected.permissions || []).includes('*') ? copy('公开', 'Public') : (selected.permissions || []).length ? copy('指定身份可见', 'Shared with selected identities') : copy('仅所有者', 'Owner only') }}</span></summary>
            <dl class="ox-memory-library-facts"><div><dt>{{ copy('所有者', 'Owner') }}</dt><dd>{{ selected.ownerAgent }}</dd></div><div><dt>{{ copy('共享范围', 'Shared with') }}</dt><dd>{{ (selected.permissions || []).join(', ') || copy('仅所有者', 'Owner only') }}</dd></div><div><dt>{{ copy('记录哈希', 'Record hash') }}</dt><dd :title="selected.recordSha256">{{ shortHash(selected.recordSha256) }}</dd></div><div><dt>{{ copy('提交时间', 'Committed') }}</dt><dd>{{ formatTime(selected.committedAtUtc) }}</dd></div><div><dt>{{ copy('质量评分', 'Quality score') }}</dt><dd>{{ Number(selected.qualityScore ?? 0).toFixed(2) }}</dd></div></dl>
            <button v-if="canEdit && selected.status !== 'RETIRED'" type="button" class="ox-memory-library-text-button is-danger" :disabled="loading" @click="retire">{{ copy('退役记忆', 'Retire Memory') }}</button>
          </details>
          <details class="ox-memory-library-details" data-memory-section="history">
            <summary>{{ copy('版本历史', 'Version history') }}<span>{{ history.length }}</span></summary>
            <div v-if="history.length" class="ox-memory-library-version-list">
              <article v-for="version in history" :key="version.recordSha256 || version.version" class="ox-memory-library-version">
                <div><strong>v{{ version.version }}</strong><span>{{ operationLabel(version.operation) }}</span><span v-if="Number(version.version) === Number(selected.version)" class="ox-memory-library-current">{{ copy('当前', 'Current') }}</span></div>
                <time>{{ formatTime(version.committedAtUtc) }}</time><small :title="version.recordSha256">{{ shortHash(version.recordSha256) }}</small>
                <button v-if="canEdit && Number(version.version) !== Number(selected.version)" type="button" class="ox-memory-library-text-button ox-vite-memory-version__rollback" :disabled="loading" @click="rollback(version)">{{ copy('回滚至此版本', 'Rollback to this version') }}</button>
              </article>
            </div>
            <p v-else class="ox-memory-library-muted">{{ copy('暂无版本记录', 'No version history') }}</p>
          </details>
        </article>
        <div v-else class="ox-memory-library-empty is-reader"><i class="fa-regular fa-file-lines" aria-hidden="true"></i><strong>{{ copy('让经验留下来', 'Keep what you learn') }}</strong><p>{{ copy('选择一条记忆阅读，或新建记忆记录经验。', 'Select a memory to read, or create one to capture what you learn.') }}</p><button type="button" class="ox-memory-library-button" :disabled="loading || !available" @click="openCreate">{{ copy('新建记忆', 'New Memory') }}</button></div>
      </div>
    </div>

    <details class="ox-memory-library-details ox-memory-library-runtime" data-memory-section="runtime">
      <summary>{{ copy('运行状态与完整性', 'Runtime and integrity') }}<span>{{ integrity ? integrity.healthy ? copy('校验通过', 'Verified') : copy('需要检查', 'Needs review') : copy('尚未校验', 'Not verified') }}</span></summary>
      <div class="ox-memory-library-runtime-body"><p>{{ integrityMessage }}</p><button type="button" class="ox-memory-library-button" :disabled="loading || !available" :title="copy('校验完整性', 'Verify integrity')" @click="verify"><i class="fa-solid fa-shield-halved" aria-hidden="true"></i>{{ copy('校验完整性', 'Verify integrity') }}</button></div>
      <dl class="ox-memory-library-facts"><div v-if="status.frameworkVersion"><dt>{{ copy('记忆版本', 'Memory runtime') }}</dt><dd>{{ status.frameworkVersion }}</dd></div><div v-if="status.tiers?.longTerm"><dt>{{ copy('长期记忆', 'Long-term memories') }}</dt><dd>{{ status.tiers.longTerm.memories }}</dd></div><div v-if="status.sharedVersions !== undefined"><dt>{{ copy('共享版本', 'Shared versions') }}</dt><dd>{{ status.sharedVersions }}</dd></div><div v-if="status.tiers?.activeNative"><dt>{{ copy('活跃会话', 'Active sessions') }}</dt><dd>{{ status.tiers.activeNative.sessions }}</dd></div><div v-if="status.tiers?.shortTerm"><dt>{{ copy('短期事件', 'Short-term events') }}</dt><dd>{{ status.tiers.shortTerm.events }}</dd></div><div v-if="status.auditEvents !== undefined"><dt>{{ copy('审计事件', 'Audit events') }}</dt><dd>{{ status.auditEvents }}</dd></div></dl>
      <section class="ox-memory-library-ollama" data-memory-ollama-status :data-status="ollamaStatusTone" :aria-busy="ollama.loading">
        <div class="ox-memory-library-ollama-heading">
          <div><span class="ox-memory-library-ollama-kicker"><i class="fa-solid fa-microchip" aria-hidden="true"></i>{{ copy('可选本地模型增强', 'Optional local model enhancement') }}</span><strong>{{ copy('Ollama 服务', 'Ollama service') }}</strong><p>{{ copy('Memory V3 账本独立运行；Ollama 可用于本地摘要、重排或推理。', 'The Memory V3 ledger runs independently; Ollama can provide local summarization, reranking, or inference.') }}</p></div>
          <div class="ox-memory-library-ollama-actions"><span class="ox-memory-library-ollama-status"><i class="fa-solid fa-circle" aria-hidden="true"></i>{{ ollamaStatusLabel }}</span><button type="button" class="ox-memory-library-icon-button" :disabled="loading" :aria-label="copy('重新检测 Ollama', 'Recheck Ollama')" :title="copy('重新检测 Ollama', 'Recheck Ollama')" @click="redetectOllama"><i class="fa-solid fa-rotate-right" :class="{ 'fa-spin': ollama.loading }" aria-hidden="true"></i></button></div>
        </div>
        <div v-if="ollamaResult?.status === 'ready' && ollamaModels.length" class="ox-memory-library-ollama-models">
          <div v-for="model in ollamaModels" :key="model.name" class="ox-memory-library-ollama-model"><i class="fa-solid fa-cube" aria-hidden="true"></i><span><strong>{{ model.name }}</strong><small>{{ modelSize(model.sizeBytes) || copy('本地模型', 'Local model') }}<template v-if="model.modifiedAt"> · {{ formatTime(model.modifiedAt) }}</template></small></span></div>
        </div>
        <p v-else-if="ollamaStatusKey === 'empty'" class="ox-memory-library-muted">{{ copy('Ollama 已连接，但尚未安装模型。可先运行 ollama pull，再重新检测。', 'Ollama is reachable but has no installed models. Run ollama pull, then check again.') }}</p>
        <p v-else-if="ollamaStatusKey === 'offline'" class="ox-memory-library-muted">{{ copy('未发现本机 Ollama 服务。启动 Ollama 后点击重新检测；这不会影响 Memory V3 账本。', 'Ollama is not running locally. Start Ollama and check again; the Memory V3 ledger is unaffected.') }}</p>
        <p v-else-if="ollamaStatusKey === 'blocked'" class="ox-memory-library-notice is-error">{{ copy('Ollama 返回的数据格式无法确认，请检查服务版本后重试。', 'Ollama returned an invalid response. Check the service version and retry.') }}</p>
        <p v-else-if="ollama.error" class="ox-memory-library-notice is-error">{{ ollama.error }}</p>
      </section>
      <ul v-if="integrity?.failures?.length" class="ox-memory-library-failures"><li v-for="failure in integrity.failures" :key="`${failure.memoryId}:${failure.version}:${failure.reason}`">{{ failure.memoryId }} · v{{ failure.version }} · {{ failure.reason }}</li></ul>
    </details>
  </section>
</template>

<style scoped>
.ox-memory-library {
  --memory-surface: var(--ox-bg-surface, var(--ox-vite-surface, #fff));
  --memory-base: var(--ox-bg-base, var(--ox-vite-shell-bg, #f6f8fa));
  --memory-text: var(--ox-text-primary, var(--ox-vite-text-primary, #202a36));
  --memory-muted: var(--ox-text-secondary, var(--ox-vite-text-secondary, #74808f));
  --memory-border: var(--ox-border, var(--ox-vite-border, #e1e6eb));
  --memory-accent: var(--ox-accent, #4f7cff);
  --memory-radius: var(--ox-radius-sm, 8px);
  --memory-density: var(--ox-density, 1);
  --memory-control-height: max(36px, calc(40px * var(--memory-density)));
  --memory-toolbar-gap: calc(12px * var(--memory-density));
  --memory-row-padding: calc(16px * var(--memory-density)) calc(14px * var(--memory-density));
  --memory-document-padding: calc(26px * var(--memory-density)) calc(34px * var(--memory-density)) calc(32px * var(--memory-density));
  display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden;
  box-sizing: border-box; padding: calc(18px * var(--memory-density)) calc(20px * var(--memory-density)) 0; color: var(--memory-text); min-width: 0; width: 100%; font-family: var(--ox-font-sans, inherit); font-size: 13px;
}
.ox-memory-library-toolbar { display: flex; flex: none; align-items: center; flex-wrap: wrap; gap: var(--memory-toolbar-gap); padding: 0; margin: 0; background: none; border: 0; }
.ox-memory-library-actor, .ox-memory-library-search { display: flex; align-items: center; gap: calc(10px * var(--memory-density)); min-width: 0; min-height: var(--memory-control-height); padding: 0 calc(12px * var(--memory-density)); color: var(--memory-muted); border: 1px solid var(--memory-border); border-radius: var(--ox-radius-md, 8px); background: var(--memory-surface); }
.ox-memory-library-actor { flex: 0 1 220px; }
.ox-memory-library-search { flex: 1 1 230px; }
.ox-memory-library-actor select, .ox-memory-library-search input { width: 100%; min-width: 0; height: calc(var(--memory-control-height) - 2px); border: 0; outline: 0; box-shadow: none; background: transparent; color: var(--memory-text); font: inherit; }
.ox-memory-library-actor select option { background: var(--memory-surface); color: var(--memory-text); }
.ox-memory-library-statusline { display: flex; flex: none; align-items: center; flex-wrap: wrap; gap: calc(7px * var(--memory-density)) calc(18px * var(--memory-density)); min-height: max(40px, calc(48px * var(--memory-density))); color: var(--memory-muted); font-size: 12px; }
.ox-memory-library-statusline strong { margin-left: 4px; color: var(--memory-text); font-weight: 600; }
.ox-memory-library-status-actions { display: flex; align-items: center; gap: calc(16px * var(--memory-density)); margin-left: auto; }
.ox-memory-library-check { display: flex; gap: 7px; align-items: center; white-space: nowrap; }
.ox-memory-library-check input { accent-color: var(--memory-accent); }
.ox-memory-library-file-input { display: none; }
.ox-memory-library-button, .ox-memory-library-icon-button, .ox-memory-library-text-button { display: inline-flex; justify-content: center; align-items: center; gap: calc(8px * var(--memory-density)); min-height: max(32px, calc(34px * var(--memory-density))); padding: calc(7px * var(--memory-density)) calc(12px * var(--memory-density)); border: 1px solid var(--memory-border); border-radius: var(--ox-radius-md, 8px); background: transparent; color: var(--memory-text); font: inherit; line-height: 1.4; cursor: pointer; transition: background .15s ease, border-color .15s ease; white-space: nowrap; }
.ox-memory-library-button:hover { background: var(--memory-base); border-color: color-mix(in srgb, var(--memory-accent) 32%, var(--memory-border)); }
.ox-memory-library-button.is-primary { background: var(--memory-accent); color: var(--ox-on-accent, #fff); border-color: var(--memory-accent); }
.ox-memory-library-button.is-primary:hover { background: var(--ox-accent-hover, var(--memory-accent)); }
.ox-memory-library-text-button { min-height: 30px; padding: 4px 0; border: 0; color: var(--memory-muted); }
.ox-memory-library-text-button:hover { color: var(--memory-accent); }
.ox-memory-library-icon-button { width: 30px; min-height: 30px; padding: 0; border: 0; color: var(--memory-muted); }
.ox-memory-library-icon-button:hover { color: var(--memory-text); background: var(--memory-base); }
.ox-memory-library button:disabled { cursor: default; opacity: .45; }
.ox-memory-library input:disabled, .ox-memory-library select:disabled, .ox-memory-library textarea:disabled { opacity: .65; }
.ox-memory-library button:focus-visible, .ox-memory-library summary:focus-visible { outline: 2px solid var(--memory-accent); outline-offset: 3px; }
.ox-memory-library-actor:focus-within, .ox-memory-library-search:focus-within { border-color: var(--memory-accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--memory-accent) 12%, transparent); }
.ox-memory-library-layout { display: grid; flex: 1; grid-template-columns: minmax(220px, 28%) minmax(0, 1fr); align-items: stretch; min-height: 0; overflow: hidden; border-top: 1px solid var(--memory-border); border-bottom: 1px solid var(--memory-border); }
.ox-memory-library-index { min-width: 0; min-height: 0; overflow-y: auto; scrollbar-width: thin; border-right: 1px solid var(--memory-border); background: color-mix(in srgb, var(--memory-base) 42%, transparent); }
.ox-memory-library-list { display: flex; flex-direction: column; padding: calc(10px * var(--memory-density)) calc(10px * var(--memory-density)) calc(10px * var(--memory-density)) 0; }
.ox-memory-library-row { display: block; flex: 0 0 auto; width: 100%; min-width: 0; margin: 0 0 4px; padding: var(--memory-row-padding); border: 0; border-radius: var(--memory-radius); background: transparent; color: var(--memory-text); text-align: left; font: inherit; cursor: pointer; }
.ox-memory-library-row:hover { background: var(--memory-surface); }
.ox-memory-library-row.active { background: color-mix(in srgb, var(--memory-accent) 8%, var(--memory-surface)); box-shadow: inset 2px 0 var(--memory-accent); }
.ox-memory-library-row-heading { display: block; }
.ox-memory-library-row-heading strong { display: block; font-size: 13px; font-weight: 600; line-height: 1.65; overflow-wrap: anywhere; }
.ox-memory-library-row p { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin: calc(7px * var(--memory-density)) 0 calc(10px * var(--memory-density)); color: var(--memory-muted); font-size: 12px; line-height: 1.65; }
.ox-memory-library-row-meta { display: flex; flex-wrap: wrap; align-items: center; gap: calc(8px * var(--memory-density)); color: var(--memory-muted); font-size: 11px; }
.ox-memory-library-type { color: var(--memory-accent); }
.ox-memory-library-owner { display: block; overflow: hidden; margin-top: 6px; color: var(--memory-muted); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.ox-memory-library-reader { min-width: 0; min-height: 0; overflow-y: auto; scrollbar-width: thin; background: var(--memory-surface); }
.ox-memory-library-document, .ox-memory-library-editor { display: block; max-width: 980px; margin: 0 auto; padding: var(--memory-document-padding); }
.ox-memory-library-document-top { display: flex; align-items: center; justify-content: space-between; gap: calc(16px * var(--memory-density)); margin-bottom: calc(20px * var(--memory-density)); color: var(--memory-muted); font-size: 12px; }
.ox-memory-library-document-top > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ox-memory-library-document-actions { display: flex; flex-shrink: 0; align-items: center; gap: calc(20px * var(--memory-density)); }
.ox-memory-library-document h2 { margin: 0 0 14px; color: var(--memory-text); font-size: clamp(20px, 1.9vw, 26px); font-weight: 600; line-height: 1.5; letter-spacing: -.02em; overflow-wrap: anywhere; }
.ox-memory-library-document-meta { display: flex; flex-wrap: wrap; align-items: center; gap: calc(8px * var(--memory-density)) calc(14px * var(--memory-density)); color: var(--memory-muted); font-size: 12px; }
.ox-memory-library-tags { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 12px; }
.ox-memory-library-tags > span { padding: 2px 6px; border-radius: var(--ox-radius-xs, 4px); background: var(--memory-base); color: var(--memory-muted); font-size: 11px; overflow-wrap: anywhere; }
.ox-memory-library-prose { margin: calc(26px * var(--memory-density)) 0 calc(36px * var(--memory-density)); color: var(--memory-text); font-size: 14px; line-height: 1.85; overflow-wrap: anywhere; }
.ox-memory-library-prose :deep(p) { margin: 0 0 16px; font-size: inherit; line-height: inherit; }
.ox-memory-library-prose :deep(h1), .ox-memory-library-prose :deep(h2), .ox-memory-library-prose :deep(h3), .ox-memory-library-prose :deep(h4) { margin: 24px 0 12px; color: var(--memory-text); font-size: 1.1em; font-weight: 600; line-height: 1.6; }
.ox-memory-library-prose :deep(pre) { max-width: 100%; overflow-x: auto; margin: 16px 0; padding: 14px; background: var(--memory-base); border-radius: var(--memory-radius); color: inherit; font-family: var(--ox-font-mono, monospace); font-size: 12px; white-space: pre-wrap; }
.ox-memory-library-prose :deep(code) { font-family: var(--ox-font-mono, monospace); font-size: .9em; }
.ox-memory-library-prose :deep(blockquote) { margin: 16px 0; padding: 3px 0 3px 16px; border-left: 2px solid var(--memory-border); color: var(--memory-muted); }
.ox-memory-library-prose :deep(table) { display: block; max-width: 100%; overflow-x: auto; border-collapse: collapse; }
.ox-memory-library-prose :deep(th), .ox-memory-library-prose :deep(td) { padding: 8px 12px; border-bottom: 1px solid var(--memory-border); text-align: left; }
.ox-memory-library-prose :deep(ul), .ox-memory-library-prose :deep(ol) { padding-left: 23px; }
.ox-memory-library-details { border: 0; border-top: 1px solid var(--memory-border); background: none; }
.ox-memory-library-details > summary { display: flex; align-items: center; gap: calc(10px * var(--memory-density)); min-height: max(40px, calc(48px * var(--memory-density))); color: var(--memory-muted); list-style: none; font-size: 12px; font-weight: 500; cursor: pointer; }
.ox-memory-library-details > summary::-webkit-details-marker { display: none; }
.ox-memory-library-details > summary::before { content: ''; width: 5px; height: 5px; margin-right: 2px; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: rotate(-45deg); }
.ox-memory-library-details[open] > summary::before { transform: rotate(45deg); }
.ox-memory-library-details > summary > span { margin-left: auto; color: var(--memory-muted); font-size: 11px; font-weight: 400; }
.ox-memory-library-details[open] { padding-bottom: 16px; }
.ox-memory-library-facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: calc(16px * var(--memory-density)) calc(28px * var(--memory-density)); margin: 2px 0 16px; }
.ox-memory-library-facts dt { margin: 0 0 5px; color: var(--memory-muted); font-size: 11px; }
.ox-memory-library-facts dd { margin: 0; color: var(--memory-text); font-size: 12px; line-height: 1.6; overflow-wrap: anywhere; }
.ox-memory-library-version-list { display: flex; flex-direction: column; }
.ox-memory-library-version { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: calc(6px * var(--memory-density)) calc(16px * var(--memory-density)); padding: calc(14px * var(--memory-density)) 0; border-bottom: 1px solid var(--memory-border); font-size: 12px; }
.ox-memory-library-version:last-child { border-bottom: 0; }
.ox-memory-library-version > div { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.ox-memory-library-version > time, .ox-memory-library-version > small, .ox-memory-library-version > div > span { color: var(--memory-muted); font-size: 11px; }
.ox-memory-library-version > time { text-align: right; }
.ox-memory-library-version > button { justify-self: end; min-height: 0; padding: 0; font-size: 11px; }
.ox-memory-library-version > div > .ox-memory-library-current { color: var(--memory-accent); }
.ox-memory-library-field { display: flex; flex-direction: column; gap: calc(9px * var(--memory-density)); min-width: 0; margin-bottom: calc(20px * var(--memory-density)); }
.ox-memory-library-field > span { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 500; }
.ox-memory-library-field small { color: var(--memory-muted); font-size: 11px; font-weight: 400; }
.ox-memory-library-field input:not([type='range']), .ox-memory-library-field textarea { box-sizing: border-box; display: block; width: 100%; min-width: 0; padding: calc(10px * var(--memory-density)) calc(12px * var(--memory-density)); border: 1px solid var(--memory-border); border-radius: var(--memory-radius); background: var(--memory-surface); color: var(--memory-text); font: inherit; line-height: 1.7; outline: 0; }
.ox-memory-library-field textarea { min-height: 250px; resize: vertical; }
.ox-memory-library-field input:focus, .ox-memory-library-field textarea:focus { border-color: var(--memory-accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--memory-accent) 12%, transparent); }
.ox-memory-library-field input[type='range'] { width: 100%; accent-color: var(--memory-accent); }
.ox-memory-library-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 calc(20px * var(--memory-density)); padding-top: 6px; }
.ox-memory-library-editor-footer { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: calc(16px * var(--memory-density)); margin-top: calc(24px * var(--memory-density)); padding-top: calc(20px * var(--memory-density)); border-top: 1px solid var(--memory-border); }
.ox-memory-library-editor-footer > span { color: var(--memory-muted); font-size: 11px; }
.ox-memory-library-editor-footer > div { display: flex; gap: 10px; margin-left: auto; }
.ox-memory-library-empty { display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 12px; min-height: 280px; padding: 32px 22px; text-align: center; }
.ox-memory-library-empty > i { margin-bottom: 6px; color: var(--memory-muted); font-size: 26px; opacity: .6; }
.ox-memory-library-empty > strong { color: var(--memory-text); font-size: 14px; font-weight: 500; }
.ox-memory-library-empty > p { max-width: 320px; margin: 0; color: var(--memory-muted); font-size: 12px; line-height: 1.8; }
.ox-memory-library-empty.is-reader { min-height: 480px; }
.ox-memory-library-notice { display: flex; flex: none; align-items: center; gap: 9px; margin: 0 0 14px; padding: 10px 12px; border-radius: var(--memory-radius); background: var(--memory-base); color: var(--memory-muted); font-size: 12px; line-height: 1.7; overflow-wrap: anywhere; }
.ox-memory-library-notice.is-error { color: var(--el-color-danger, #d46262); background: color-mix(in srgb, var(--el-color-danger, #d46262) 8%, var(--memory-surface)); }
.ox-memory-library-feedback { flex: none; margin: 0 0 12px; color: var(--memory-accent); font-size: 12px; }
.ox-memory-library-runtime { flex: none; max-height: 230px; overflow-y: auto; scrollbar-width: thin; margin-top: 4px; border-top: 0; }
.ox-memory-library-runtime-body { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: calc(12px * var(--memory-density)); margin-bottom: calc(18px * var(--memory-density)); }
.ox-memory-library-runtime-body p { margin: 0; color: var(--memory-muted); font-size: 12px; line-height: 1.8; }
.ox-memory-library-runtime .ox-memory-library-facts { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.ox-memory-library-failures { padding-left: 18px; color: var(--el-color-danger, #d46262); font-size: 12px; line-height: 1.8; overflow-wrap: anywhere; }
.ox-memory-library-muted { color: var(--memory-muted); }
.ox-memory-library .is-danger { color: var(--el-color-danger, #d46262); }
.ox-memory-library-ollama { margin-top: 18px; padding: 14px 16px; border: 1px solid var(--memory-border); border-radius: var(--memory-radius); background: color-mix(in srgb, var(--memory-base) 70%, var(--memory-surface)); }
.ox-memory-library-ollama-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; }
.ox-memory-library-ollama-heading > div:first-child { min-width: 0; }
.ox-memory-library-ollama-kicker { display: flex; align-items: center; gap: 7px; margin-bottom: 5px; color: var(--memory-muted); font-size: 11px; }
.ox-memory-library-ollama-heading strong { display: block; color: var(--memory-text); font-size: 13px; font-weight: 600; }
.ox-memory-library-ollama-heading p { max-width: 680px; margin: 5px 0 0; color: var(--memory-muted); font-size: 11px; line-height: 1.7; }
.ox-memory-library-ollama-actions { display: flex; align-items: center; gap: 10px; flex: none; }
.ox-memory-library-ollama-status { display: inline-flex; align-items: center; gap: 6px; color: var(--memory-muted); font-size: 11px; white-space: nowrap; }
.ox-memory-library-ollama-status > i { color: var(--memory-muted); font-size: 8px; }
.ox-memory-library-ollama[data-status='ready'] .ox-memory-library-ollama-status { color: #2c9b6d; }
.ox-memory-library-ollama[data-status='ready'] .ox-memory-library-ollama-status > i { color: #2c9b6d; }
.ox-memory-library-ollama[data-status='checking'] .ox-memory-library-ollama-status > i { color: var(--memory-accent); }
.ox-memory-library-ollama[data-status='warning'] .ox-memory-library-ollama-status { color: #a97a26; }
.ox-memory-library-ollama[data-status='error'] .ox-memory-library-ollama-status { color: var(--el-color-danger, #d46262); }
.ox-memory-library-ollama-models { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 8px; margin-top: 14px; }
.ox-memory-library-ollama-model { display: flex; align-items: center; gap: 9px; min-width: 0; padding: 9px 10px; border: 1px solid var(--memory-border); border-radius: var(--ox-radius-xs, 5px); background: var(--memory-surface); }
.ox-memory-library-ollama-model > i { color: var(--memory-accent); font-size: 13px; }
.ox-memory-library-ollama-model > span { display: flex; flex-direction: column; min-width: 0; gap: 2px; }
.ox-memory-library-ollama-model strong { overflow: hidden; color: var(--memory-text); font-size: 12px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.ox-memory-library-ollama-model small { color: var(--memory-muted); font-size: 10px; }
.ox-memory-library-ollama > .ox-memory-library-muted, .ox-memory-library-ollama > .ox-memory-library-notice { margin: 12px 0 0; }
/* Compatibility hooks must not inherit the former three-pane workspace styling. */
#app .ox-memory-library .ox-memory-library-toolbar { display: flex; gap: var(--memory-toolbar-gap); padding: 0; border: 0; background: none; }
#app .ox-memory-library .ox-memory-library-actor, #app .ox-memory-library .ox-memory-library-search { min-height: var(--memory-control-height); padding: 0 calc(12px * var(--memory-density)); }
#app .ox-memory-library .ox-memory-library-actor select { height: calc(var(--memory-control-height) - 2px); }
#app .ox-memory-library .ox-memory-library-row { display: block; padding: var(--memory-row-padding); border: 0; border-radius: var(--memory-radius); }
#app .ox-memory-library .ox-memory-library-row.active { background: color-mix(in srgb, var(--memory-accent) 8%, var(--memory-surface)); box-shadow: inset 2px 0 var(--memory-accent); }
#app .ox-memory-library .ox-memory-library-row-heading strong { font-size: 13px; line-height: 1.65; }
#app .ox-memory-library .ox-memory-library-row-meta { gap: calc(8px * var(--memory-density)); }
#app .ox-memory-library .ox-memory-library-document { padding: var(--memory-document-padding); }
#app .ox-memory-library .ox-memory-library-document h2 { font-size: clamp(20px, 1.9vw, 26px); }
#app .ox-memory-library .ox-memory-library-prose :deep(p) { font-size: 14px; line-height: 1.85; }
#app .ox-memory-library .ox-memory-library-editor { display: block; }
@media (max-width: 1359px), (max-height: 739px) {
  .ox-memory-library { flex: 0 0 auto; }
  .ox-memory-library-layout { min-height: 450px; }
  .ox-memory-library-index { max-height: 650px; }
  .ox-memory-library-reader { max-height: 750px; }
}
@media (max-width: 1000px) {
  .ox-memory-library { --memory-document-padding: calc(24px * var(--memory-density)); }
  .ox-memory-library-layout { grid-template-columns: minmax(190px, 30%) minmax(0, 1fr); }
  .ox-memory-library-statusline { gap: calc(6px * var(--memory-density)) calc(12px * var(--memory-density)); }
  .ox-memory-library-options { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 820px) {
  .ox-memory-library { --memory-toolbar-gap: calc(8px * var(--memory-density)); --memory-row-padding: calc(12px * var(--memory-density)); --memory-document-padding: calc(22px * var(--memory-density)) calc(16px * var(--memory-density)); padding: calc(14px * var(--memory-density)) calc(12px * var(--memory-density)) 0; }
  .ox-memory-library-actor, #app .ox-memory-library .ox-memory-library-actor { flex: 1 1 150px; }
  .ox-memory-library-search, #app .ox-memory-library .ox-memory-library-search { flex: 1 1 100%; order: 3; }
  .ox-memory-library-layout { grid-template-columns: minmax(0, 1fr); }
  .ox-memory-library-index { max-height: 280px; border-right: 0; border-bottom: 1px solid var(--memory-border); }
  .ox-memory-library-list { padding: calc(8px * var(--memory-density)) 0; }
  .ox-memory-library-statusline { padding: calc(10px * var(--memory-density)) 0; }
  .ox-memory-library-status-actions { width: 100%; justify-content: flex-end; }
  .ox-memory-library-status-actions > label { margin-right: auto; }
  .ox-memory-library-facts, .ox-memory-library-runtime .ox-memory-library-facts { grid-template-columns: minmax(0, 1fr); }
  .ox-memory-library-version { grid-template-columns: minmax(0, 1fr); }
  .ox-memory-library-version > time { text-align: left; }
  .ox-memory-library-version > button { justify-self: start; }
  .ox-memory-library-empty { min-height: 200px; }
  .ox-memory-library-empty.is-reader { min-height: 320px; }
  .ox-memory-library-ollama-heading { flex-direction: column; gap: 10px; }
  .ox-memory-library-ollama-actions { width: 100%; justify-content: space-between; }
}
@media (prefers-reduced-motion: reduce) {
  .ox-memory-library button { transition: none; }
}
</style>
