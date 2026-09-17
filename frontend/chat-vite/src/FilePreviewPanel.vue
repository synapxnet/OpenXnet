<!--
Copyright (C) 2026 Synapxnet. All rights reserved.
This file is Synapxnet Proprietary and Confidential. It is strictly
forbidden to copy, distribute, or use without explicit authorization.
会话文件预览面板 / Conversation file preview panel.
Author: maoyo | Department: 研发部 | Date: 2026-09-14
Version: 1.0.0 | Security Level: INTERNAL
__version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
__maintainer__: maoyo | __email__: synapxnet@gmail.com
-->
<script setup>
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue';

const props = defineProps({ tabs: { type: Array, default: () => [] }, activeKey: { type: String, default: '' }, isZh: { type: Boolean, default: true }, bridge: { type: Object, required: true } });
const emit = defineEmits(['select', 'close-tab', 'close']);
const panelRef = ref(null);
const disk = ref(null);
const mode = ref('diff');
const loading = ref(false);
const actionPending = ref(false);
const error = ref('');
const notice = ref('');
const showOpenMenu = ref(false);
const editors = ref([]);
const editorsLoading = ref(false);
let generation = 0;
let previousFocus = null;
const MAX_PREVIEW_CHARACTERS = 200000;
const MAX_PREVIEW_LINES = 2000;

/** 仅选择明确激活的标签，缺失时不替换其他文件。 / Select only the explicitly active tab without substituting another file. */
const active = computed(() => props.tabs.find((tab) => tab.key === props.activeKey) || null);
/** 当前回执已删除时保持不可用。 / Keep removed receipts unavailable. */
const file = computed(() => active.value?.file || null);
/** 按真实桥接能力显示原生操作。 / Show native actions according to actual bridge capabilities. */
const capabilities = computed(() => props.bridge.conversationFileCapabilities?.() || {});
/** 明确区分空文本与不存在的字段。 / Distinguish explicit empty text from missing fields. */
function hasText(source, key) { return !!source && typeof source[key] === 'string'; }
/** 保留可以实际展示的回执视图。 / Retain receipt views that can actually be displayed. */
const views = computed(() => [
  { id: 'diff', label: props.isZh ? '差异' : 'Diff', available: hasText(file.value, 'diff') },
  { id: 'after', label: props.isZh ? '变更后' : 'After', available: hasText(file.value, 'after') },
  { id: 'before', label: props.isZh ? '变更前' : 'Before', available: hasText(file.value, 'before') },
  { id: 'disk', label: props.isZh ? '本机文件' : 'Local file', available: !!disk.value },
].filter((entry) => entry.available));
/** 内容来源必须匹配实际打开的视图。 / Content provenance must match the actual selected view. */
const sourceLabel = computed(() => mode.value === 'disk'
  ? disk.value?.source === 'selected-file' ? (props.isZh ? '用户选择文件' : 'User-selected file') : (props.isZh ? '当前磁盘内容' : 'Current disk content')
  : file.value?.contentSource === 'request' ? (props.isZh ? '拟议内容 · 来自工具输入' : 'Proposed content · tool input') : (props.isZh ? '工具回执内容' : 'Tool receipt content'));
/** 展示完整路径分段，所选本机文件保留独立路径。 / Show complete path segments and retain the selected native file's separate path. */
const displayedPath = computed(() => mode.value === 'disk' && disk.value?.path ? disk.value.path : active.value?.path || '');
/** 将路径切分为可换行的面包屑。 / Split paths into wrappable breadcrumbs. */
const breadcrumbs = computed(() => displayedPath.value.replace(/\\/g, '/').split('/').filter(Boolean));
/** 仅读取当前视图的原始文本。 / Read raw text for the current view only. */
const content = computed(() => mode.value === 'disk' ? disk.value?.content : file.value?.[mode.value]);
/** 限制单次代码渲染量，同时保留截断提示。 / Bound each code render while retaining a truncation notice. */
const previewLines = computed(() => typeof content.value === 'string' ? content.value.slice(0, MAX_PREVIEW_CHARACTERS).split('\n').slice(0, MAX_PREVIEW_LINES) : []);
/** 不将界面截断冒充文件的完整内容。 / Never present a truncated view as the complete file. */
const truncated = computed(() => (mode.value === 'disk' ? disk.value?.truncated : file.value?.truncated)
  || (typeof content.value === 'string' && (content.value.length > MAX_PREVIEW_CHARACTERS || content.value.split('\n').length > MAX_PREVIEW_LINES)));
/** 根据文件扩展名选择已有高亮语言。 / Select an existing highlighting language from the file extension. */
const language = computed(() => {
  if (mode.value === 'diff') return 'diff';
  const extension = displayedPath.value.split('.').at(-1)?.toLowerCase();
  return ({ py: 'python', js: 'javascript', cjs: 'javascript', mjs: 'javascript', ts: 'typescript', tsx: 'typescript', jsx: 'javascript', vue: 'xml', html: 'xml', htm: 'xml', yml: 'yaml', md: 'markdown', sh: 'bash', ps1: 'powershell', cs: 'csharp', cc: 'cpp', h: 'cpp', rs: 'rust' })[extension] || extension || 'plaintext';
});
/** 仅在获得本机元数据后显示默认打开能力。 / Show default opening only after receiving native capability metadata. */
const canOpenDefault = computed(() => mode.value === 'disk' && !!disk.value?.canOpenDefault);
/** 缓存逐行高亮，菜单切换不重复解析大段代码。 / Cache highlighted lines so menu changes do not reparse large code blocks. */
const renderedLines = computed(() => previewLines.value.map((text, index) => ({ number: index + 1, html: highlightLine(text) || ' ', tone: lineTone(text) })));

/** 文件或所属范围变化时取消旧异步结果的展示资格。 / Invalidate old asynchronous results when the file or scope changes. */
watch(() => [active.value?.key, active.value?.scope, active.value?.stepId, active.value?.fileId, !!file.value].join('::'), () => {
  generation += 1;
  disk.value = null;
  loading.value = false;
  actionPending.value = false;
  error.value = '';
  notice.value = '';
  showOpenMenu.value = false;
  editors.value = [];
  editorsLoading.value = false;
  mode.value = hasText(file.value, 'diff') ? 'diff' : hasText(file.value, 'after') ? 'after' : hasText(file.value, 'before') ? 'before' : '';
}, { immediate: true });

/** 打开面板后提供键盘起点。 / Provide a keyboard entry point when the panel opens. */
onMounted(async () => {
  previousFocus = typeof document === 'undefined' ? null : document.activeElement;
  await nextTick();
  panelRef.value?.focus?.({ preventScroll: true });
});
/** 卸载后忽略迟到结果并恢复触发点。 / Ignore late results after unmount and restore the trigger focus. */
onBeforeUnmount(() => {
  generation += 1;
  if (previousFocus?.isConnected) previousFocus.focus?.({ preventScroll: true });
});

/** 只展示文件名称，完整路径保留在标题和面包屑。 / Show filenames while preserving complete paths in titles and breadcrumbs. */
function basename(path) { return String(path || '').replace(/\\/g, '/').split('/').at(-1) || (props.isZh ? '文件' : 'File'); }
/** 在高亮库不可用时安全转义所有文本。 / Escape all text safely when the highlighter is unavailable. */
function escapeText(text) { return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
/** 复用已有 highlight.js，只生成安全的代码标记。 / Reuse existing highlight.js to generate safe code markup only. */
function highlightLine(line) {
  const highlighter = globalThis.hljs || globalThis.window?.hljs;
  try { if (highlighter?.getLanguage?.(language.value)) return highlighter.highlight(line, { language: language.value, ignoreIllegals: true }).value; } catch { /* 高亮失败仍显示原文本。 / Keep raw text visible when highlighting fails. */ }
  return escapeText(line);
}
/** 差异颜色只由明确的统一差异前缀决定。 / Derive diff colors only from explicit unified-diff prefixes. */
function lineTone(line) {
  if (mode.value !== 'diff') return '';
  if (line.startsWith('+') && !line.startsWith('+++')) return 'is-add';
  if (line.startsWith('-') && !line.startsWith('---')) return 'is-remove';
  return line.startsWith('@@') ? 'is-hunk' : '';
}
/** 请求原生读取或用户选择文件，忽略过期结果。 / Request native reading or file selection while ignoring stale results. */
async function readFile(select = false) {
  if (!active.value || !file.value || loading.value) return;
  const epoch = generation;
  const reference = active.value;
  loading.value = true;
  error.value = '';
  notice.value = '';
  try {
    const result = select ? await props.bridge.selectConversationFile(reference) : await props.bridge.readConversationFile(reference);
    if (epoch !== generation) return;
    if (result?.canceled) { notice.value = props.isZh ? '已取消选择' : 'Selection canceled'; return; }
    if (!result || (!result.binary && typeof result.content !== 'string')) throw new Error(props.isZh ? '未收到文件内容' : 'No file content was returned');
    disk.value = result;
    mode.value = 'disk';
  } catch (failure) {
    if (epoch === generation) error.value = failure?.message || (props.isZh ? '文件读取失败' : 'File reading failed');
  } finally { if (epoch === generation) loading.value = false; }
}
/** 展开操作菜单并只读取已安装编辑器列表。 / Open the actions menu and read installed editors only. */
async function toggleOpenMenu() {
  showOpenMenu.value = !showOpenMenu.value;
  if (!showOpenMenu.value || !capabilities.value.editors || !active.value) return;
  const epoch = generation;
  editorsLoading.value = true;
  try {
    const result = await props.bridge.listConversationFileEditors(active.value);
    if (epoch === generation) editors.value = result;
  } catch (failure) {
    if (epoch === generation) error.value = failure?.message || (props.isZh ? '编辑器列表读取失败' : 'Editor discovery failed');
  } finally { if (epoch === generation) editorsLoading.value = false; }
}
/** 明确选择后才调用原生动作，取消与失败不伪装成功。 / Invoke native actions only after explicit selection and preserve cancellation or failure. */
async function fileAction(action, editorId = '') {
  if (!active.value || !file.value || actionPending.value) return;
  const epoch = generation;
  actionPending.value = true;
  error.value = '';
  notice.value = '';
  try {
    const result = await props.bridge.actOnConversationFile(active.value, action, editorId, mode.value === 'disk' && disk.value?.source === 'selected-file');
    if (epoch !== generation) return;
    if (result?.canceled) notice.value = props.isZh ? '已取消' : 'Canceled';
    else if (result?.success !== true) throw new Error(props.isZh ? '操作未完成' : 'The action did not complete');
    else { notice.value = props.isZh ? '操作已完成' : 'Action completed'; showOpenMenu.value = false; }
  } catch (failure) {
    if (epoch === generation) error.value = failure?.message || (props.isZh ? '文件操作失败' : 'File action failed');
  } finally { if (epoch === generation) actionPending.value = false; }
}
/** 复制当前展示路径并保留可见失败反馈。 / Copy the displayed path and retain visible failure feedback. */
async function copyPath() {
  const epoch = generation;
  try {
    if (!globalThis.navigator?.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await globalThis.navigator.clipboard.writeText(displayedPath.value);
    if (epoch === generation) notice.value = props.isZh ? '路径已复制' : 'Path copied';
  } catch { if (epoch === generation) error.value = props.isZh ? '复制失败，请选择路径文本复制' : 'Copy failed; select the path text to copy it'; }
}
/** 按标准键盘规则切换文件标签。 / Switch file tabs using standard keyboard navigation. */
function handleTabKeydown(event, key) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const index = props.tabs.findIndex((entry) => entry.key === key);
  const target = event.key === 'Home' ? 0 : event.key === 'End' ? props.tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + props.tabs.length) % props.tabs.length;
  event.preventDefault();
  emit('select', props.tabs[target].key);
}
</script>

<template>
  <aside ref="panelRef" class="oxc-file-preview" tabindex="-1" :aria-label="isZh ? '文件预览' : 'File preview'" @keydown.esc.stop="emit('close')">
    <header class="oxc-file-preview__head"><span><i class="fa-regular fa-file-code" aria-hidden="true"></i>{{ isZh ? '文件预览' : 'File preview' }}</span><button type="button" class="oxc-file-preview__close" :aria-label="isZh ? '关闭文件预览' : 'Close file preview'" @click="emit('close')"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></header>
    <div class="oxc-file-preview__tabs" role="tablist" :aria-label="isZh ? '已打开文件' : 'Open files'">
      <div v-for="tab in tabs" :key="tab.key" class="oxc-file-preview__tab-shell" :class="{ 'is-active': tab.key === activeKey }">
        <button type="button" class="oxc-file-preview__tab" role="tab" :title="tab.path" :aria-selected="tab.key === activeKey" :tabindex="tab.key === activeKey ? 0 : -1" :data-file-key="tab.key" @click="emit('select', tab.key)" @keydown="handleTabKeydown($event, tab.key)">{{ basename(tab.path) }}</button>
        <button type="button" class="oxc-file-preview__tab-close" :aria-label="`${isZh ? '关闭' : 'Close '}${basename(tab.path)}`" @click="emit('close-tab', tab.key)"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
      </div>
    </div>
    <template v-if="active && file">
      <div class="oxc-file-preview__path"><div class="oxc-file-preview__breadcrumbs" :title="displayedPath"><template v-for="(part, index) in breadcrumbs" :key="index"><span v-if="index" aria-hidden="true">/</span><span>{{ part }}</span></template></div><button type="button" class="oxc-file-preview__copy-path" :aria-label="isZh ? '复制路径' : 'Copy path'" @click="copyPath"><i class="fa-regular fa-copy" aria-hidden="true"></i></button></div>
      <div class="oxc-file-preview__toolbar">
        <div class="oxc-file-preview__views"><button v-for="view in views" :key="view.id" type="button" :class="{ 'is-active': mode === view.id }" :data-file-view="view.id" :aria-pressed="mode === view.id" @click="mode = view.id">{{ view.label }}</button></div>
        <button v-if="capabilities.read" type="button" class="oxc-file-preview__read" :disabled="loading" @click="readFile(false)">{{ loading ? (isZh ? '读取中…' : 'Reading…') : (isZh ? '读取当前文件' : 'Read current file') }}</button>
        <button v-if="capabilities.select" type="button" class="oxc-file-preview__select" :disabled="loading" @click="readFile(true)">{{ isZh ? '选择文件预览' : 'Select file' }}</button>
        <div v-if="capabilities.actions" class="oxc-file-preview__open-shell"><button type="button" class="oxc-file-preview__open" :aria-expanded="showOpenMenu" :disabled="actionPending" @click="toggleOpenMenu">{{ isZh ? '打开' : 'Open' }}<i class="fa-solid fa-chevron-down" aria-hidden="true"></i></button>
          <div v-if="showOpenMenu" class="oxc-file-preview__open-menu">
            <button v-if="canOpenDefault" type="button" data-file-action="open-default" :disabled="actionPending" @click="fileAction('open-default')">{{ isZh ? '使用系统默认打开' : 'Open with default app' }}</button>
            <button type="button" data-file-action="reveal" :disabled="actionPending" @click="fileAction('reveal')">{{ isZh ? '在文件夹中显示' : 'Show in folder' }}</button>
            <button type="button" data-file-action="save-as" :disabled="actionPending" @click="fileAction('save-as')">{{ isZh ? '另存副本…' : 'Save a copy…' }}</button>
            <span v-if="editorsLoading" role="status">{{ isZh ? '正在查找编辑器…' : 'Finding editors…' }}</span>
            <button v-for="editor in editors" :key="editor.id" type="button" :data-file-editor="editor.id" :disabled="actionPending" @click="fileAction('open-editor', editor.id)">{{ editor.label }}</button>
          </div>
        </div>
      </div>
      <div class="oxc-file-preview__source">{{ sourceLabel }}<span v-if="truncated"> · {{ isZh ? '预览已截断' : 'Preview truncated' }}</span></div>
      <p v-if="error" class="oxc-file-preview__error" role="alert">{{ error }}</p><p v-if="notice" class="oxc-file-preview__notice" role="status">{{ notice }}</p>
      <div v-if="mode === 'disk' && disk?.binary" class="oxc-file-preview__empty">{{ isZh ? '这是二进制文件，可通过已安装的应用打开。' : 'This binary file can be opened with an installed app.' }}</div>
      <div v-else-if="typeof content !== 'string'" class="oxc-file-preview__empty">{{ capabilities.read || capabilities.select ? (isZh ? '这条回执没有文件正文。可读取当前文件，或选择本机文件预览。' : 'This receipt has no file content. Read the current file or select a local file to preview.') : (isZh ? '这条回执没有文件正文，当前环境仅支持回执预览。' : 'This receipt has no file content; this environment supports receipt previews only.') }}</div>
      <div v-else class="oxc-file-preview__code" role="region" tabindex="0" :aria-label="`${basename(displayedPath)} · ${sourceLabel}`"><div v-for="line in renderedLines" :key="line.number" class="oxc-file-preview__line" :class="line.tone"><span class="oxc-file-preview__number" aria-hidden="true">{{ line.number }}</span><code class="oxc-file-preview__text hljs" v-html="line.html"></code></div><div v-if="content === ''" class="oxc-file-preview__empty">{{ isZh ? '文件内容为空' : 'The file is empty' }}</div></div>
    </template>
    <p v-else class="oxc-file-preview__empty">{{ isZh ? '所选文件回执已不可用。' : 'The selected file receipt is no longer available.' }}</p>
  </aside>
</template>

<style scoped>
.oxc-file-preview { position: relative; display: flex; flex: 0 0 clamp(360px, 38vw, 620px); flex-direction: column; width: clamp(360px, 38vw, 620px); min-width: 0; height: 100%; overflow: hidden; border-left: 1px solid var(--ox-border, #dce4eb); background: var(--ox-bg-surface, #fff); color: var(--ox-text-primary, #243548); font-size: 12px; outline: none; }
.oxc-file-preview button { font: inherit; color: inherit; cursor: pointer; border: 0; background: transparent; }
.oxc-file-preview button:disabled { cursor: wait; opacity: .55; }
.oxc-file-preview button:focus-visible, .oxc-file-preview__code:focus-visible { outline: 2px solid var(--ox-accent, #2494be); outline-offset: -2px; }
.oxc-file-preview__head { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 54px; padding: 0 14px; }
.oxc-file-preview__head > span { display: flex; align-items: center; gap: 8px; font-weight: 600; }
.oxc-file-preview__close, .oxc-file-preview__copy-path { flex: 0 0 36px; width: 36px; height: 36px; border-radius: 8px; }
.oxc-file-preview__tabs { display: flex; flex: 0 0 auto; overflow-x: auto; scrollbar-width: thin; border-bottom: 1px solid var(--ox-border, #dce4eb); }
.oxc-file-preview__tab-shell { display: flex; flex: 0 0 auto; align-items: center; max-width: 240px; border-bottom: 2px solid transparent; }
.oxc-file-preview__tab-shell.is-active { border-bottom-color: var(--ox-accent, #2494be); background: var(--ox-accent-soft, #e5f4fb); color: var(--ox-accent, #2494be); }
.oxc-file-preview__tab { min-width: 0; padding: 10px 5px 10px 12px; min-height: 42px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.oxc-file-preview__tab-close { width: 32px; height: 36px; flex: 0 0 32px; }
.oxc-file-preview__path { display: flex; align-items: center; gap: 6px; padding: 7px 10px 4px 14px; min-width: 0; }
.oxc-file-preview__breadcrumbs { display: flex; flex: 1; flex-wrap: wrap; gap: 5px; min-width: 0; overflow-wrap: anywhere; color: var(--ox-text-secondary, #68798c); font-size: 11px; }
.oxc-file-preview__breadcrumbs span:last-child { color: var(--ox-text-primary, #243548); }
.oxc-file-preview__toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; padding: 4px 10px 8px; }
.oxc-file-preview__views { display: flex; flex: 1; gap: 2px; }
.oxc-file-preview__toolbar button { min-height: 34px; padding: 0 8px; border-radius: 7px; font-size: 11px; }
.oxc-file-preview button:hover, .oxc-file-preview__views .is-active { color: var(--ox-accent, #2494be); background: var(--ox-accent-soft, #e5f4fb); }
.oxc-file-preview__open-shell { position: relative; }
.oxc-file-preview__open { display: flex; align-items: center; gap: 7px; }
.oxc-file-preview__open-menu { position: absolute; top: calc(100% + 5px); right: 0; z-index: 5; min-width: 190px; max-height: 300px; max-width: calc(100vw - 70px); padding: 5px; overflow-y: auto; border: 1px solid var(--ox-border, #dce4eb); border-radius: 10px; background: var(--ox-bg-surface, #fff); box-shadow: var(--ox-shadow-card, 0 8px 25px #10203018); }
.oxc-file-preview__open-menu button, .oxc-file-preview__open-menu > span { display: block; width: 100%; padding: 9px; text-align: left; white-space: nowrap; }
.oxc-file-preview__source { padding: 8px 14px; border-top: 1px solid var(--ox-border, #dce4eb); color: var(--ox-text-secondary, #68798c); font-size: 10px; }
.oxc-file-preview__error, .oxc-file-preview__notice { margin: 0; padding: 6px 14px; font-size: 11px; line-height: 1.6; overflow-wrap: anywhere; }
.oxc-file-preview__error { color: var(--ox-danger, #ce5260); }
.oxc-file-preview__notice { color: var(--ox-text-secondary, #68798c); }
.oxc-file-preview__code { flex: 1; min-height: 0; overflow: auto; padding: 8px 0 24px; scrollbar-width: thin; background: var(--ox-bg-base, #f6f8fb); }
.oxc-file-preview__line { display: flex; min-width: max-content; font: 11px/1.75 var(--ox-font-mono, ui-monospace, Consolas, monospace); }
.oxc-file-preview__number { position: sticky; left: 0; flex: 0 0 42px; width: 42px; padding: 0 10px 0 4px; box-sizing: border-box; text-align: right; user-select: none; color: var(--ox-text-muted, #8192a2); background: var(--ox-bg-base, #f6f8fb); }
.oxc-file-preview__text { flex: 1; margin: 0; padding: 0 14px 0 7px; white-space: pre; color: inherit; background: transparent; font: inherit; tab-size: 2; }
.oxc-file-preview__line.is-add { background: color-mix(in srgb, var(--ox-accent, #2494be) 11%, transparent); }
.oxc-file-preview__line.is-remove { background: color-mix(in srgb, var(--ox-danger, #ce5260) 10%, transparent); }
.oxc-file-preview__line.is-hunk { color: var(--ox-accent, #2494be); }
.oxc-file-preview__empty { padding: 24px 16px; color: var(--ox-text-secondary, #68798c); font-size: 12px; line-height: 1.8; }
@media (max-width: 1100px) { .oxc-file-preview { position: absolute; inset: 0 0 0 auto; z-index: 33; width: min(560px, 100%); box-shadow: -12px 0 32px #10203016; } }
@media (max-width: 680px) { .oxc-file-preview { width: 100%; } .oxc-file-preview__head { min-height: 48px; } }
@media (prefers-reduced-motion: reduce) { .oxc-file-preview * { scroll-behavior: auto; transition: none; animation: none; } }
</style>
