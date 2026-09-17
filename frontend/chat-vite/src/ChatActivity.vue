<!--
Copyright (C) 2026 Synapxnet. All rights reserved.
This file is Synapxnet Proprietary and Confidential. It is strictly
forbidden to copy, distribute, or use without explicit authorization.
紧凑会话活动 / Compact conversation activity.
Author: maoyo | Department: 研发部 | Date: 2026-09-14
Version: 1.0.0 | Security Level: INTERNAL
__version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
__maintainer__: maoyo | __email__: synapxnet@gmail.com
-->
<script setup>
import { computed, ref, watch, useId, onBeforeUnmount } from 'vue';
import '../../../static/js/openxnet-conversation-model.js';

const props = defineProps({ activity: { type: Object, default: null }, isZh: { type: Boolean, default: true } });
const emit = defineEmits(['inspect']);
const model = globalThis.OpenXnetConversationModel;
const expanded = ref(false);
const detailsOpen = ref(props.activity?.active === true);
const expandedSteps = ref(new Set());
const expandedFiles = ref(new Set());
const copyStates = ref(new Map());
let activityEpoch = 0;
let copyAttempt = 0;
const listId = `chat-activity-${useId()}`;
/** 接收完整活动列表，不修改原始数据。 / Read complete activity without mutating its source. */
const steps = computed(() => Array.isArray(props.activity?.steps) ? props.activity.steps : []);
/** 默认显示最近三步，完整记录仍可展开。 / Show the latest three steps while keeping the full record expandable. */
const visibleSteps = computed(() => expanded.value ? steps.value : steps.value.slice(-3));
/** 按可见步骤预先格式化只读记录。 / Prepare inert disclosure records for visible steps. */
const displaySteps = computed(() => visibleSteps.value.map((step) => ({ step, sections: detailSections(step) })));
/** 用文字提示错误，不只依赖颜色。 / Expose failure counts in text as well as color. */
const failureCount = computed(() => steps.value.filter((step) => model.normalizeActivityStatus(step.status) === 'error').length);
/** 汇总真实文件路径，不将待执行申请说成已完成变更。 / Count actual file paths without describing pending requests as completed changes. */
const fileCount = computed(() => new Set(steps.value.flatMap((step) => (step.fileChanges || []).map((file) => file.path))).size);
/** 即使过程已收起仍保留待确认提示。 / Keep approval notices visible even when activity is collapsed. */
const approvalCount = computed(() => steps.value.filter((step) => model.normalizeActivityStatus(step.status) === 'awaiting_approval').length);
/** 新消息活动更换时重置展开状态。 / Reset expansion when the activity belongs to a different message. */
watch(() => steps.value[0]?.id, resetDisclosure);
/** 回复结束仅自动收起一次，之后尊重用户重新展开。 / Collapse once when a reply ends and then respect manual reopening. */
watch(() => props.activity?.active, (active, previous) => {
  if (previous === true && active !== true) {
    detailsOpen.value = false;
    expandedSteps.value = new Set();
    expandedFiles.value = new Set();
  } else if (active === true && previous !== true) detailsOpen.value = true;
});
/** 组件卸载后丢弃尚未结束的复制反馈。 / Discard pending clipboard feedback after unmount. */
onBeforeUnmount(() => { activityEpoch += 1; });

/** 消息活动更换时清除局部展示状态。 / Clear local disclosure state when message activity changes. */
function resetDisclosure() {
  expanded.value = false;
  detailsOpen.value = props.activity?.active === true;
  expandedSteps.value = new Set();
  expandedFiles.value = new Set();
  copyStates.value = new Map();
  activityEpoch += 1;
}
/** 区分缺失字段与明确的空字符串、零及 false。 / Distinguish missing fields from explicit empty strings, zero and false. */
function hasValue(source, key) {
  return !!source && Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined && source[key] !== null;
}
/** 仅从明确的 cmd 或 command 字段识别命令。 / Recognize commands only from explicit cmd or command fields. */
function commandRecord(step) {
  for (const source of [step, step.input]) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) continue;
    for (const key of ['cmd', 'command']) {
      if (hasValue(source, key)) return { value: source[key], key, nested: source === step.input };
    }
  }
  return null;
}
/** 生成命令、参数和真实回执区块，不推断执行结果。 / Build command, argument and actual receipt sections without inferring outcomes. */
function detailSections(step) {
  const command = commandRecord(step);
  const sections = [];
  if (command) sections.push({ key: 'command', present: true, text: model.formatDetail(command.value) });
  if (hasValue(step, 'input')) {
    let input = step.input;
    if (command?.nested) {
      /** 保留命令之外的原始输入字段。 / Preserve original input fields other than the displayed command. */
      input = Object.fromEntries(Object.entries(input).filter(([key]) => key !== command.key));
    }
    if (!command?.nested || Object.keys(input).length) sections.push({ key: 'input', present: true, text: model.formatDetail(input) });
  } else if (!command) sections.push({ key: 'input', present: false, text: '' });
  sections.push({ key: 'output', present: hasValue(step, 'output'), text: model.formatDetail(step.output) });
  if (hasValue(step, 'error')) sections.push({ key: 'error', present: true, text: model.formatDetail(step.error) });
  return sections;
}
/** 为每段回执提供本地化标题。 / Provide localized titles for receipt sections. */
function sectionLabel(key) {
  return (props.isZh ? { command: '命令', input: '参数', output: '输出', error: '错误' } : { command: 'Command', input: 'Arguments', output: 'Output', error: 'Error' })[key];
}
/** 区分明确空内容与尚未提供的回执。 / Distinguish explicit empty content from unavailable receipts. */
function emptyLabel(section) {
  if (!section.present) return section.key === 'output' ? (props.isZh ? '暂无输出回执' : 'No output receipt available') : (props.isZh ? '暂无输入记录' : 'No input record available');
  return props.isZh ? `${sectionLabel(section.key)}为空` : `${sectionLabel(section.key)} is empty`;
}
/** 建立稳定的无执行含义的面板标识。 / Build stable panel identifiers with no execution semantics. */
function detailId(step) {
  return `${listId}-detail-${encodeURIComponent(String(step.id))}`;
}
/** 仅切换当前步骤的内联记录。 / Toggle only the current step's inline record. */
function toggleStep(step) {
  if (expandedSteps.value.has(step.id)) expandedSteps.value.delete(step.id);
  else expandedSteps.value.add(step.id);
}
/** 隔离相同步骤或不同步骤中的文件展开状态。 / Isolate file disclosure state within and across steps. */
function fileKey(step, file) {
  return JSON.stringify([step.id, file.id || file.path, file.operation]);
}
/** 为文件详情提供稳定的可访问标识。 / Provide a stable accessible identifier for file details. */
function fileDetailId(step, file) {
  return `${listId}-file-${encodeURIComponent(fileKey(step, file))}`;
}
/** 点击文件行只展开只读变更记录。 / Clicking a file row only opens its read-only change record. */
function toggleFile(step, file) {
  const key = fileKey(step, file);
  if (expandedFiles.value.has(key)) expandedFiles.value.delete(key);
  else expandedFiles.value.add(key);
}
/** 在侧栏查看对应文件，不执行或修改文件。 / Preview the corresponding file in the side panel without executing or editing it. */
function inspectFile(step, file) {
  emit('inspect', { kind: 'file', stepId: step.id, fileId: file.id, path: file.path });
}
/** 操作与成功状态分开表达，避免把申请显示为执行完成。 / Distinguish the requested operation from confirmed success. */
function fileOperation(file) {
  const labels = props.isZh
    ? { create: '创建', modify: '修改', delete: '删除', rename: '重命名', write: '写入' }
    : { create: 'Create', modify: 'Modify', delete: 'Delete', rename: 'Rename', write: 'Write' };
  const label = labels[file.operation] || (props.isZh ? '文件操作' : 'File operation');
  return props.isZh && file.confirmed ? `已${label}` : label;
}
/** 只展示合法的已知行数。 / Display only valid known line counts. */
function knownLineCount(value) {
  return Number.isSafeInteger(value) && value >= 0;
}
/** 将实际差异或前后快照转换为可复制的纯文本段落。 / Convert diffs or before/after snapshots into copyable inert text sections. */
function fileSections(file) {
  const sections = [];
  for (const key of ['diff', 'before', 'after']) {
    if (typeof file[key] !== 'string') continue;
    const labels = props.isZh ? { diff: '差异', before: '变更前', after: '变更后' } : { diff: 'Diff', before: 'Before', after: 'After' };
    sections.push({ key: `file-${file.id || file.path}-${key}`, kind: key, label: labels[key], present: true, text: file[key] });
  }
  return sections;
}
/** 限定一次渲染的行数，完整已收到文本仍可复制。 / Bound rendered lines while allowing the received text to be copied. */
function fileLines(section) {
  return section.text.split('\n').slice(0, 500);
}
/** 根据统一差异标记设置辅助颜色，文字前缀仍可辨识。 / Color unified diff markers while retaining readable textual prefixes. */
function diffLineClass(line, kind) {
  if (kind !== 'diff') return '';
  if (line.startsWith('@@')) return 'is-hunk';
  if (line.startsWith('+') && !line.startsWith('+++')) return 'is-added';
  if (line.startsWith('-') && !line.startsWith('---')) return 'is-removed';
  return '';
}
/** 隔离每段文本的复制反馈。 / Isolate clipboard feedback for each text section. */
function copyKey(step, section) {
  return JSON.stringify([step.id, section.key]);
}
/** 读取当前复制状态，不改变运行回执。 / Read clipboard state without changing runtime receipts. */
function copyStatus(step, section) {
  const state = copyStates.value.get(copyKey(step, section));
  return state?.text === section.text ? state.status : '';
}
/** 复制用户明确选择的纯文本并保留失败反馈。 / Copy explicitly selected plain text and retain failure feedback. */
async function copySection(step, section) {
  const key = copyKey(step, section);
  const epoch = activityEpoch;
  const attempt = ++copyAttempt;
  copyStates.value.set(key, { status: 'copying', attempt, text: section.text });
  try {
    if (!globalThis.navigator?.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await globalThis.navigator.clipboard.writeText(section.text);
    if (activityEpoch === epoch && copyStates.value.get(key)?.attempt === attempt) copyStates.value.set(key, { status: 'copied', attempt, text: section.text });
  } catch {
    if (activityEpoch === epoch && copyStates.value.get(key)?.attempt === attempt) copyStates.value.set(key, { status: 'error', attempt, text: section.text });
  }
}

/** 用结构字段识别子智能体。 / Recognize subagents using structural fields. */
function isSubagent(step) {
  return !!step.agentId || ['subagent', 'sub_agent', 'agent'].includes(step.kind);
}
/** 展示可读的真实状态。 / Display readable actual status. */
function statusLabel(step) {
  return model.getActivityStatusLabel(step.status, props.isZh);
}
/** 根据状态选择辅助图标。 / Select a supporting icon for each status. */
function statusIcon(step) {
  const status = model.normalizeActivityStatus(step.status);
  if (status === 'error') return 'fa-solid fa-circle-exclamation';
  if (status === 'done') return 'fa-solid fa-check';
  if (status === 'running') return 'fa-solid fa-circle-notch';
  if (status === 'awaiting_approval') return 'fa-regular fa-hand';
  if (status === 'interrupted' || status === 'cancelled') return 'fa-solid fa-pause';
  return 'fa-regular fa-circle';
}
/** 只请求查看，绝不触发执行。 / Request inspection without triggering execution. */
function inspectStep(step) {
  emit('inspect', { kind: 'activity', stepId: step.id });
}
/** 智能体名称打开协作详情，普通工具展开内联回执。 / Agent names open collaboration details while ordinary tools expand inline receipts. */
function activateStep(step) {
  if (isSubagent(step)) inspectStep(step);
  else toggleStep(step);
}
</script>

<template>
  <section v-if="steps.length || activity?.active" class="oxc-worklog" :aria-label="isZh ? '执行过程' : 'Execution activity'">
    <div class="oxc-worklog__head">
      <button v-if="steps.length" type="button" class="oxc-worklog__toggle" :aria-expanded="detailsOpen" :aria-controls="`${listId}-body`" @click="detailsOpen = !detailsOpen">
        <i :class="detailsOpen ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-right'" aria-hidden="true"></i>
        <span>{{ activity?.active ? (isZh ? '正在处理' : 'Working') : (isZh ? '执行过程' : 'Activity') }}</span>
        <span>{{ isZh ? `${steps.length} 项` : `${steps.length} steps` }}</span>
        <span v-if="fileCount" class="oxc-worklog__file-count">{{ isZh ? `${fileCount} 个文件` : `${fileCount} files` }}</span>
      </button>
      <span v-else>{{ isZh ? '正在处理' : 'Working' }}</span>
      <span v-if="activity?.elapsedLabel" class="oxc-worklog__duration">{{ activity.elapsedLabel }}</span>
      <span v-if="failureCount" class="oxc-worklog__failure">{{ isZh ? `${failureCount} 项失败` : `${failureCount} failed` }}</span>
      <span v-if="approvalCount" class="oxc-worklog__approval">{{ isZh ? `${approvalCount} 项待确认` : `${approvalCount} awaiting approval` }}</span>
      <button v-if="detailsOpen && steps.length > 3" type="button" class="oxc-worklog__expand" :aria-expanded="expanded" :aria-controls="listId" @click="expanded = !expanded">
        {{ expanded ? (isZh ? '收起' : 'Collapse') : (isZh ? `全部 ${steps.length} 项` : `All ${steps.length} steps`) }}
        <i :class="expanded ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'" aria-hidden="true"></i>
      </button>
    </div>
    <div v-if="detailsOpen" :id="`${listId}-body`" class="oxc-worklog__body">
    <ol :id="listId" class="oxc-worklog__list">
      <li v-for="{ step, sections } in displaySteps" :key="step.id">
        <div class="oxc-worklog__row">
        <button type="button" class="oxc-worklog__step" :class="`is-${model.normalizeActivityStatus(step.status)}`" :title="`${step.title || ''} · ${statusLabel(step)}`" :aria-expanded="isSubagent(step) ? undefined : expandedSteps.has(step.id)" :aria-controls="isSubagent(step) ? undefined : detailId(step)" @click="activateStep(step)">
          <svg v-if="isSubagent(step)" class="oxc-agent-glyph" :class="`is-tone-${model.agentGlyph(step.agentId || step.taskId || step.id).tone}`" viewBox="0 0 24 24" aria-hidden="true"><path :d="model.agentGlyph(step.agentId || step.taskId || step.id).path" :transform="`rotate(${model.agentGlyph(step.agentId || step.taskId || step.id).rotation} 12 12)`" /></svg>
          <i v-else :class="statusIcon(step)" class="oxc-worklog__icon" aria-hidden="true"></i>
          <span class="oxc-worklog__copy">
            <span class="oxc-worklog__title">{{ step.title || (isZh ? '未命名活动' : 'Untitled activity') }}</span>
            <span class="oxc-worklog__meta"><span v-if="isSubagent(step)">{{ isZh ? '子智能体 · ' : 'Subagent · ' }}</span>{{ statusLabel(step) }}<span v-if="step.duration"> · {{ step.duration }}</span></span>
          </span>
          <i :class="expandedSteps.has(step.id) ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-right'" class="oxc-worklog__chevron" aria-hidden="true"></i>
        </button>
        <button type="button" class="oxc-worklog__inspect" :aria-label="`${isZh ? '查看详情' : 'Inspect details'} · ${step.title || (isZh ? '未命名活动' : 'Untitled activity')}`" @click="inspectStep(step)">{{ isZh ? '详情' : 'Details' }}</button>
        </div>
        <div v-for="file in step.fileChanges || []" :key="fileKey(step, file)" class="oxc-worklog__file">
          <div class="oxc-worklog__file-row">
            <button type="button" class="oxc-worklog__file-toggle" :aria-expanded="expandedFiles.has(fileKey(step, file))" :aria-controls="fileDetailId(step, file)" :aria-label="`${isZh ? '展开文件变更' : 'Expand file change'} · ${file.path}`" @click="toggleFile(step, file)">
              <i :class="expandedFiles.has(fileKey(step, file)) ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-right'" aria-hidden="true"></i>
            </button>
            <i :class="file.operation === 'delete' ? 'fa-regular fa-trash-can' : 'fa-regular fa-file-lines'" aria-hidden="true"></i>
            <span class="oxc-worklog__file-operation">{{ fileOperation(file) }}</span>
            <button type="button" class="oxc-worklog__file-path" :title="file.path" :aria-label="`${isZh ? '查看文件' : 'View file'} · ${file.path}`" @click="inspectFile(step, file)">{{ file.path }}</button>
            <span v-if="knownLineCount(file.additions)" class="oxc-worklog__line-count is-added">+{{ file.additions }}</span>
            <span v-if="knownLineCount(file.deletions)" class="oxc-worklog__line-count is-removed">−{{ file.deletions }}</span>
            <span v-if="!file.confirmed" class="oxc-worklog__file-status">{{ statusLabel(file) }}</span>
          </div>
          <div v-if="expandedFiles.has(fileKey(step, file))" :id="fileDetailId(step, file)" class="oxc-worklog__file-detail">
            <div class="oxc-worklog__status"><span>{{ file.contentSource === 'request' ? (isZh ? '拟议变更' : 'Proposed change') : (isZh ? '变更详情' : 'Change details') }}</span><span>{{ statusLabel(file) }}</span></div>
            <p v-if="file.previousPath" class="oxc-worklog__file-origin">{{ file.previousPath }} → {{ file.path }}</p>
            <div v-for="section in fileSections(file)" :key="section.key" class="oxc-worklog__section">
              <div class="oxc-worklog__section-head"><span>{{ section.label }}</span><button type="button" class="oxc-worklog__copy-action" :disabled="copyStatus(step, section) === 'copying'" :aria-label="`${isZh ? '复制' : 'Copy '}${section.label} · ${file.path}`" @click="copySection(step, section)">{{ copyStatus(step, section) === 'copied' ? (isZh ? '已复制' : 'Copied') : (isZh ? '复制' : 'Copy') }}</button></div>
              <pre class="oxc-worklog__record oxc-worklog__diff" tabindex="0"><code><span v-for="(line, index) in fileLines(section)" :key="index" :class="diffLineClass(line, section.kind)">{{ line || ' ' }}</span></code></pre>
              <p v-if="section.text.split('\n').length > 500" class="oxc-worklog__empty">{{ isZh ? '展示前 500 行，可复制已收到的完整内容。' : 'Showing the first 500 lines. Copy to access all received text.' }}</p>
              <span v-if="copyStatus(step, section) === 'error'" class="oxc-worklog__copy-feedback is-error" role="status">{{ isZh ? '复制失败，请选择文本复制' : 'Copy failed; select the text to copy it' }}</span>
            </div>
            <p v-if="!fileSections(file).length" class="oxc-worklog__empty">{{ isZh ? '此操作未提供可显示的内容差异。' : 'No content diff was provided for this operation.' }}</p>
            <p v-if="file.truncated" class="oxc-worklog__empty">{{ isZh ? '变更记录较长，当前仅保留部分内容。' : 'This change record is long; only part of it is available.' }}</p>
          </div>
        </div>
        <div v-if="expandedSteps.has(step.id)" :id="detailId(step)" class="oxc-worklog__disclosure">
          <div class="oxc-worklog__status"><span>{{ isZh ? '状态' : 'Status' }}</span><span :class="`is-${model.normalizeActivityStatus(step.status)}`">{{ statusLabel(step) }}</span></div>
          <div v-for="section in sections" :key="section.key" class="oxc-worklog__section" :data-section="section.key">
            <div class="oxc-worklog__section-head">
              <span>{{ sectionLabel(section.key) }}</span>
              <button v-if="section.present" type="button" class="oxc-worklog__copy-action" :disabled="copyStatus(step, section) === 'copying'" :aria-label="`${isZh ? '复制' : 'Copy '}${sectionLabel(section.key)}`" @click="copySection(step, section)"><i class="fa-regular fa-copy" aria-hidden="true"></i>{{ copyStatus(step, section) === 'copied' ? (isZh ? '已复制' : 'Copied') : copyStatus(step, section) === 'copying' ? (isZh ? '复制中' : 'Copying') : (isZh ? '复制' : 'Copy') }}</button>
            </div>
            <pre v-if="section.present && section.text !== ''" class="oxc-worklog__record" tabindex="0">{{ section.text }}</pre>
            <p v-else class="oxc-worklog__empty">{{ emptyLabel(section) }}</p>
            <span class="oxc-worklog__copy-feedback" :class="{ 'is-error': copyStatus(step, section) === 'error' }" role="status" aria-live="polite">{{ copyStatus(step, section) === 'error' ? (isZh ? '复制失败，请选择文本复制' : 'Copy failed; select the text to copy it') : copyStatus(step, section) === 'copied' ? (isZh ? '已复制到剪贴板' : 'Copied to clipboard') : '' }}</span>
          </div>
        </div>
      </li>
    </ol>
    </div>
    <div v-if="!steps.length && activity?.active" class="oxc-worklog__waiting"><i class="fa-regular fa-clock" aria-hidden="true"></i>{{ isZh ? '等待运行回执' : 'Waiting for runtime updates' }}</div>
  </section>
</template>

<style scoped>
.oxc-worklog { --worklog-accent: var(--ox-accent, #2494be); margin: 0 0 14px; max-width: 640px; color: var(--ox-text-primary, #243548); font-size: 12px; }
.oxc-worklog__head { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; min-height: 32px; color: var(--ox-text-secondary, #67788b); font-size: 11px; }
.oxc-worklog__duration { font-variant-numeric: tabular-nums; }
.oxc-worklog__failure { color: var(--ox-danger, #ce5260); }
.oxc-worklog__approval { color: var(--ox-warning, #b78332); }
.oxc-worklog__toggle { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 8px; min-height: 36px; padding: 2px 7px; border: 0; border-radius: 8px; background: transparent; color: inherit; font: inherit; cursor: pointer; }
.oxc-worklog__toggle > i { font-size: 9px; }
.oxc-worklog__toggle:hover { background: var(--ox-accent-soft, #e5f4fb); color: var(--worklog-accent); }
.oxc-worklog__file-count { color: var(--worklog-accent); }
.oxc-worklog__body { animation: worklog-reveal 180ms cubic-bezier(.2,.8,.2,1); }
.oxc-worklog__file { margin-left: 20px; min-width: 0; }
.oxc-worklog__file-row { display: flex; align-items: center; gap: 7px; min-height: 36px; padding-right: 7px; color: var(--ox-text-secondary, #67788b); font-size: 11px; }
.oxc-worklog__file-toggle { flex: 0 0 30px; display: grid; place-items: center; min-height: 36px; padding: 5px; border: 0; border-radius: 8px; background: transparent; color: inherit; font: inherit; font-size: 9px; cursor: pointer; }
.oxc-worklog__file-toggle:hover { background: var(--ox-accent-soft, #e5f4fb); }
.oxc-worklog__file-path { min-width: 0; min-height: 36px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ox-text-primary, #243548); background: transparent; border: 0; padding: 0; font: inherit; text-align: left; cursor: pointer; }
.oxc-worklog__file-path:hover { color: var(--worklog-accent); text-decoration: underline; text-underline-offset: 3px; }
.oxc-worklog__file-operation, .oxc-worklog__line-count { flex-shrink: 0; }
.oxc-worklog__line-count { font-variant-numeric: tabular-nums; }
.oxc-worklog__line-count.is-added { color: var(--worklog-accent); }
.oxc-worklog__line-count.is-removed { color: var(--ox-danger, #ce5260); }
.oxc-worklog__file-status { margin-left: auto; font-size: 10px; }
.oxc-worklog__file-detail { margin: 3px 0 10px; overflow: hidden; border: 1px solid var(--ox-border, #dce4eb); border-radius: var(--ox-radius-sm, 9px); background: var(--ox-bg-base, #f6f8fb); animation: worklog-reveal 180ms cubic-bezier(.2,.8,.2,1); }
.oxc-worklog__file-origin { padding: 0 12px; overflow-wrap: anywhere; font-size: 11px; }
.oxc-worklog__diff code { font: inherit; background: transparent; padding: 0; }
.oxc-worklog__diff code > span { display: block; min-height: 1.65em; white-space: pre-wrap; }
.oxc-worklog__diff .is-added { background: color-mix(in srgb, var(--worklog-accent) 10%, transparent); }
.oxc-worklog__diff .is-removed { background: color-mix(in srgb, var(--ox-danger, #ce5260) 12%, transparent); }
.oxc-worklog__diff .is-hunk { color: var(--worklog-accent); }
.oxc-worklog__expand { margin-left: auto; display: inline-flex; align-items: center; gap: 7px; min-height: 40px; padding: 0 8px; border: 0; border-radius: 8px; background: transparent; color: var(--worklog-accent); font: inherit; cursor: pointer; }
.oxc-worklog__list { list-style: none; margin: 0; padding: 0 0 0 10px; border-left: 1px solid var(--ox-border, #dce4eb); }
.oxc-worklog__row { display: flex; align-items: center; min-width: 0; }
.oxc-worklog__step { flex: 1; min-width: 0; min-height: 44px; display: flex; align-items: center; gap: 10px; padding: 6px 9px; border: 0; border-radius: var(--ox-radius-sm, 9px); background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; transition: background 140ms ease; }
.oxc-worklog__step:hover, .oxc-worklog__expand:hover, .oxc-worklog__inspect:hover, .oxc-worklog__copy-action:hover { background: var(--ox-accent-soft, #2494be12); }
.oxc-worklog__inspect, .oxc-worklog__copy-action { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; gap: 5px; min-height: 36px; padding: 0 8px; border: 0; border-radius: var(--ox-radius-sm, 9px); background: transparent; color: var(--worklog-accent); font: inherit; font-size: 11px; cursor: pointer; }
.oxc-worklog__copy-action:disabled { cursor: wait; opacity: .6; }
.oxc-worklog button:focus-visible { outline: 2px solid var(--worklog-accent); outline-offset: 2px; }
.oxc-worklog__icon { width: 15px; text-align: center; color: var(--ox-text-secondary, #67788b); flex-shrink: 0; }
.oxc-agent-glyph { width: 20px; height: 20px; flex: 0 0 20px; color: var(--worklog-accent); fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linejoin: round; stroke-linecap: round; }
.oxc-agent-glyph.is-tone-1 { color: color-mix(in srgb, var(--worklog-accent) 75%, #8b75d6); }
.oxc-agent-glyph.is-tone-2 { color: color-mix(in srgb, var(--worklog-accent) 75%, #18b8c5); }
.oxc-worklog__step.is-running .oxc-worklog__icon { color: var(--worklog-accent); animation: worklog-turn 1.8s linear infinite; }
.oxc-worklog__step.is-error .oxc-worklog__icon { color: var(--ox-danger, #ce5260); }
.oxc-worklog__step.is-awaiting_approval .oxc-worklog__icon { color: var(--ox-warning, #c58b36); }
.oxc-worklog__copy { min-width: 0; flex: 1; display: flex; gap: 8px; align-items: baseline; }
.oxc-worklog__title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.oxc-worklog__meta { flex-shrink: 0; color: var(--ox-text-secondary, #67788b); font-size: 11px; }
.oxc-worklog__chevron { margin-left: auto; font-size: 9px; color: var(--ox-text-secondary, #67788b); opacity: .55; }
.oxc-worklog__waiting { display: flex; gap: 8px; padding: 10px; color: var(--ox-text-secondary, #67788b); }
.oxc-worklog__disclosure { margin: 2px 0 10px 24px; min-width: 0; overflow: hidden; border: 1px solid var(--ox-border, #dce4eb); border-radius: var(--ox-radius-sm, 9px); background: var(--ox-bg-base, #f6f8fb); animation: worklog-reveal 180ms cubic-bezier(.2,.8,.2,1); }
.oxc-worklog__status { display: flex; justify-content: space-between; gap: 12px; padding: 10px 12px; color: var(--ox-text-secondary, #67788b); font-size: 11px; }
.oxc-worklog__status .is-error, .oxc-worklog__copy-feedback.is-error { color: var(--ox-danger, #ce5260); }
.oxc-worklog__status .is-running { color: var(--worklog-accent); }
.oxc-worklog__section { border-top: 1px solid var(--ox-border, #dce4eb); min-width: 0; }
.oxc-worklog__section-head { display: flex; align-items: center; justify-content: space-between; min-height: 36px; gap: 10px; padding: 0 7px 0 12px; font-size: 11px; color: var(--ox-text-secondary, #67788b); }
.oxc-worklog__record { margin: 0; padding: 0 12px 12px; max-height: 240px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; font: 11px/1.65 var(--ox-font-mono, ui-monospace, SFMono-Regular, Consolas, monospace); tab-size: 2; color: var(--ox-text-primary, #243548); }
.oxc-worklog__record:focus-visible { outline: 2px solid var(--worklog-accent); outline-offset: -2px; }
.oxc-worklog__empty { margin: 0; padding: 0 12px 12px; color: var(--ox-text-secondary, #67788b); font-size: 11px; }
.oxc-worklog__copy-feedback { display: block; padding: 0 12px 8px; color: var(--ox-text-secondary, #67788b); font-size: 11px; }
.oxc-worklog__copy-feedback:empty { display: none; }
@keyframes worklog-turn { to { transform: rotate(360deg); } }
@keyframes worklog-reveal { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
@media (max-width: 680px) { .oxc-worklog__copy { flex-direction: column; gap: 3px; } .oxc-worklog__title { max-width: 100%; } .oxc-worklog__disclosure { margin-left: 9px; } }
@media (prefers-reduced-motion: reduce) { .oxc-worklog__step { transition: none; } .oxc-worklog__step.is-running .oxc-worklog__icon, .oxc-worklog__disclosure, .oxc-worklog__body, .oxc-worklog__file-detail { animation: none; } }
</style>
