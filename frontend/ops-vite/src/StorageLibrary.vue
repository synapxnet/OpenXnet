<script setup>
import { computed, nextTick, ref, watch } from 'vue';

const props = defineProps({
  library: { type: Object, default: () => ({ kind: 'text', files: [], canUpload: false, uploadAccept: '' }) },
  bridge: { type: Object, required: true },
  isZh: { type: Boolean, default: true },
});
const emit = defineEmits(['refresh']);
const query = ref('');
const format = ref('all');
const selected = ref([]);
const pending = ref(false);
const feedback = ref('');
const feedbackType = ref('info');
const fileInput = ref(null);
const deleteDialog = ref(null);
const previewDialog = ref(null);
const deleteIds = ref([]);
const preview = ref(null);
const failedImages = ref(new Set());
const previewError = ref(false);
const dragging = ref(false);

const kind = computed(() => props.library.kind);
const files = computed(() => Array.isArray(props.library.files) ? props.library.files : []);
const copy = (zh, en) => props.isZh ? zh : en;
const title = computed(() => ({ text: copy('文档库', 'Documents'), image: copy('图片库', 'Images'), video: copy('视频库', 'Videos') }[kind.value] || copy('文件库', 'Files')));
const icon = computed(() => ({ text: 'fa-file-lines', image: 'fa-image', video: 'fa-video' }[kind.value] || 'fa-file'));
const formats = computed(() => [...new Set(files.value.map(file => file.ext).filter(Boolean))].sort());
const visibleFiles = computed(() => files.value.filter(file => {
  const matchesQuery = !query.value.trim() || String(file.name).toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase());
  return matchesQuery && (kind.value !== 'text' || format.value === 'all' || file.ext === format.value);
}));
const selectable = computed(() => visibleFiles.value.filter(file => !file.invalidReason).map(file => file.id));
const allSelected = computed(() => selectable.value.length > 0 && selectable.value.every(id => selected.value.includes(id)));
const partlySelected = computed(() => !allSelected.value && selectable.value.some(id => selected.value.includes(id)));

watch(kind, () => {
  query.value = '';
  format.value = 'all';
  selected.value = [];
  feedback.value = '';
  dragging.value = false;
  closeDelete();
  closePreview();
});
watch(files, next => {
  const existing = new Set(next.filter(file => !file.invalidReason).map(file => file.id));
  selected.value = selected.value.filter(id => existing.has(id));
});

/** Invoke a named bridge operation, showing an explicit outcome without claiming cancelled work succeeded. */
async function perform(method, args, completedMessage) {
  if (pending.value) return null;
  pending.value = true;
  feedback.value = '';
  try {
    if (typeof props.bridge[method] !== 'function') throw new Error(copy('当前环境不支持此操作。', 'This operation is unavailable in the current environment.'));
    const result = await props.bridge[method](...args);
    if (!result || !['completed', 'requested', 'cancelled'].includes(result.status)) throw new Error(copy('操作未返回有效结果，请刷新后重试。', 'The operation returned no valid result. Refresh and retry.'));
    if (result.status === 'cancelled') {
      feedbackType.value = 'info';
      feedback.value = copy('已取消操作。', 'Operation cancelled.');
    } else {
      feedbackType.value = 'success';
      feedback.value = result.status === 'requested' ? copy('已交给浏览器保存，请查看下载列表。', 'Handed to the browser for saving. Check your downloads.') : completedMessage;
    }
    return result;
  } catch (error) {
    feedbackType.value = 'error';
    feedback.value = error?.message || copy('操作失败，请重试。', 'The operation failed. Retry.');
    return null;
  } finally {
    pending.value = false;
    emit('refresh');
  }
}

/** Select or clear only the currently visible, actionable files. */
function toggleAll(checked) {
  selected.value = checked ? [...new Set([...selected.value, ...selectable.value])] : selected.value.filter(id => !selectable.value.includes(id));
}

/** Upload chosen files; cancelling the browser picker does not submit an operation. */
async function upload(event) {
  const chosen = Array.from(event.target?.files || []);
  if (event.target) event.target.value = '';
  if (!chosen.length) return;
  await perform('uploadStorageLibrary', [kind.value, chosen], copy('文件已加入文件库。', 'Files added to the library.'));
}

/** Reuse the same upload action for dropped files in supported libraries. */
async function drop(event) {
  dragging.value = false;
  if (!props.library.canUpload || pending.value) return;
  const chosen = Array.from(event.dataTransfer?.files || []);
  if (chosen.length) await perform('uploadStorageLibrary', [kind.value, chosen], copy('文件已加入文件库。', 'Files added to the library.'));
}

/** Refresh the real library and allow failed thumbnails to retry. */
async function refresh() {
  failedImages.value = new Set();
  await perform('refreshStorageLibrary', [], copy('文件库已刷新。', 'Library refreshed.'));
}

/** Present the chosen deletion set before routing the confirmed action. */
async function askDelete(ids) {
  deleteIds.value = [...ids];
  await nextTick();
  deleteDialog.value?.showModal();
}

/** Dismiss deletion without making a host call. */
function closeDelete() {
  deleteDialog.value?.close();
  deleteIds.value = [];
}

/** Delete the confirmed files and let the bridge verify removal. */
async function confirmDelete() {
  const ids = deleteIds.value.slice();
  closeDelete();
  await perform('deleteStorageFiles', [kind.value, ids], copy('所选文件已删除。', 'Selected files deleted.'));
}

/** Copy or download an existing file using its unique storage identifier. */
async function act(action, file) {
  await perform('runStorageFileAction', [kind.value, action, file.id], action === 'copy-link' ? copy('文件链接已复制。', 'File link copied.') : copy('文件下载完成。', 'File download completed.'));
}

/** Open an image preview owned by this mounted component. */
async function openPreview(file) {
  const result = await perform('runStorageFileAction', [kind.value, 'preview', file.id], '');
  if (!result?.url) return;
  preview.value = { name: file.name, url: result.url };
  previewError.value = false;
  await nextTick();
  previewDialog.value?.showModal();
}

/** Release the media URL from the preview when it closes. */
function closePreview() {
  previewDialog.value?.close();
  preview.value = null;
  previewError.value = false;
}
</script>

<template>
  <section class="ox-storage-library" :class="{ 'is-dragging': dragging }" :aria-busy="pending"
    @dragover.prevent="dragging = library.canUpload && !pending" @dragleave.self="dragging = false" @drop.prevent="drop">
    <header class="ox-storage-library__head">
      <div class="ox-storage-library__identity">
        <span class="ox-storage-library__icon"><i class="fa-solid" :class="icon" aria-hidden="true"></i></span>
        <div><h2>{{ title }} <span>{{ files.length }}</span></h2><p>{{ kind === 'video' ? copy('工作流与生成任务产生的视频会同步到这里。', 'Videos from workflows and generation tasks appear here.') : copy('上传、查找和管理可复用的素材文件。', 'Upload, find, and manage reusable files.') }}</p></div>
      </div>
      <div class="ox-storage-library__commands">
        <button type="button" :disabled="pending" @click="refresh"><i class="fa-solid fa-arrow-rotate-right" aria-hidden="true"></i>{{ copy('刷新', 'Refresh') }}</button>
        <button v-if="library.canUpload" type="button" class="is-primary" :disabled="pending" @click="fileInput?.click()"><i class="fa-solid fa-arrow-up-from-bracket" aria-hidden="true"></i>{{ kind === 'image' ? copy('上传图片', 'Upload images') : copy('上传文件', 'Upload files') }}</button>
        <input ref="fileInput" type="file" :accept="library.uploadAccept" multiple hidden @change="upload" />
      </div>
    </header>

    <div class="ox-storage-library__filters">
      <label class="ox-storage-library__search"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><input v-model="query" type="search" :aria-label="copy('搜索文件名', 'Search filenames')" :placeholder="copy('搜索文件名…', 'Search filenames…')" /></label>
      <select v-if="kind === 'text'" v-model="format" :aria-label="copy('文件格式', 'File format')"><option value="all">{{ copy('全部格式', 'All formats') }}</option><option v-for="ext in formats" :key="ext" :value="ext">{{ ext }}</option></select>
      <span class="ox-storage-library__count">{{ copy('显示', 'Showing') }} {{ visibleFiles.length }} / {{ files.length }}</span>
    </div>
    <div v-if="feedback" class="ox-storage-library__feedback" :class="'is-' + feedbackType" :role="feedbackType === 'error' ? 'alert' : 'status'"><i class="fa-solid" :class="feedbackType === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'" aria-hidden="true"></i>{{ feedback }}</div>
    <div class="ox-storage-library__selection">
      <label><input type="checkbox" :checked="allSelected" :indeterminate="partlySelected" :disabled="pending || !selectable.length" @change="toggleAll($event.target.checked)" />{{ copy('选择当前结果', 'Select results') }}</label>
      <span>{{ copy('已选', 'Selected') }} {{ selected.length }}</span>
      <button type="button" class="is-danger" :disabled="pending || !selected.length" @click="askDelete(selected)"><i class="fa-solid fa-trash-can" aria-hidden="true"></i>{{ copy('删除所选', 'Delete selected') }}</button>
    </div>

    <div v-if="visibleFiles.length" :class="kind === 'text' ? 'ox-storage-library__rows' : 'ox-storage-library__gallery'">
      <article v-for="(file, index) in visibleFiles" :key="file.invalidReason ? 'invalid-' + index : file.id" class="ox-storage-library__file" :class="{ 'is-selected': selected.includes(file.id), 'is-media': kind !== 'text' }">
        <div v-if="kind !== 'text'" class="ox-storage-library__media">
          <button v-if="kind === 'image' && !file.invalidReason && !failedImages.has(file.id)" type="button" class="ox-storage-library__preview-button" :disabled="pending" :aria-label="copy('预览 ', 'Preview ') + file.name" @click="openPreview(file)"><img :src="file.url" :alt="file.name" loading="lazy" decoding="async" @error="failedImages.add(file.id)" /></button>
          <video v-else-if="kind === 'video' && !file.invalidReason && !failedImages.has(file.id)" :src="file.url" controls preload="none" :aria-label="file.name" @error="failedImages.add(file.id)"></video>
          <span v-else class="ox-storage-library__media-error"><i class="fa-solid" :class="icon" aria-hidden="true"></i>{{ file.invalidReason || (kind === 'video' ? copy('视频暂时无法播放', 'Video unavailable') : copy('图片暂时无法加载', 'Image unavailable')) }}</span>
        </div>
        <label class="ox-storage-library__check"><input v-model="selected" type="checkbox" :value="file.id" :disabled="pending || !!file.invalidReason" :aria-label="copy('选择 ', 'Select ') + file.name" /></label>
        <div class="ox-storage-library__filename"><span v-if="kind === 'text'" class="ox-storage-library__file-icon"><i class="fa-regular fa-file-lines" aria-hidden="true"></i></span><div><strong :title="file.name">{{ file.name }}</strong><small>{{ file.ext || 'FILE' }}</small><p v-if="file.invalidReason" class="ox-storage-library__invalid">{{ file.invalidReason }}</p></div></div>
        <div class="ox-storage-library__metadata"><span>{{ file.size }}</span><time>{{ file.time }}</time></div>
        <div class="ox-storage-library__file-actions">
          <button v-if="kind === 'image'" type="button" :disabled="pending || !!file.invalidReason" :title="copy('预览', 'Preview')" :aria-label="copy('预览 ', 'Preview ') + file.name" @click="openPreview(file)"><i class="fa-regular fa-eye" aria-hidden="true"></i></button>
          <button type="button" :disabled="pending || !!file.invalidReason" :title="copy('复制链接', 'Copy link')" :aria-label="copy('复制链接 ', 'Copy link for ') + file.name" @click="act('copy-link', file)"><i class="fa-solid fa-link" aria-hidden="true"></i></button>
          <button type="button" :disabled="pending || !!file.invalidReason" :title="copy('下载', 'Download')" :aria-label="copy('下载 ', 'Download ') + file.name" @click="act('download', file)"><i class="fa-solid fa-download" aria-hidden="true"></i></button>
          <button type="button" class="is-danger" :disabled="pending || !!file.invalidReason" :title="copy('删除', 'Delete')" :aria-label="copy('删除 ', 'Delete ') + file.name" @click="askDelete([file.id])"><i class="fa-regular fa-trash-can" aria-hidden="true"></i></button>
        </div>
      </article>
    </div>
    <div v-else class="ox-storage-library__empty">
      <span><i class="fa-solid" :class="query || format !== 'all' ? 'fa-magnifying-glass' : icon" aria-hidden="true"></i></span>
      <h3>{{ files.length ? copy('没有匹配的文件', 'No matching files') : copy('文件库中还没有内容', 'This library is empty') }}</h3>
      <p>{{ files.length ? copy('调整关键词或格式筛选即可继续查找。', 'Try another keyword or format filter.') : kind === 'video' ? copy('工作流生成的视频将显示在这里，可直接播放、下载或删除。', 'Workflow videos will appear here for playback, download, or deletion.') : copy('点击上传按钮，或将文件拖入此区域。', 'Use the upload button or drag files into this area.') }}</p>
      <button v-if="files.length" type="button" @click="query = ''; format = 'all'">{{ copy('清除筛选', 'Clear filters') }}</button>
      <button v-else-if="library.canUpload" type="button" class="is-primary" :disabled="pending" @click="fileInput?.click()">{{ copy('选择文件', 'Choose files') }}</button>
    </div>
    <footer v-if="library.canUpload" class="ox-storage-library__drop-note"><i class="fa-solid fa-cloud-arrow-up" aria-hidden="true"></i>{{ dragging ? copy('松开即可上传', 'Release to upload') : copy('也可将文件拖入库中上传', 'You can also drag files into the library') }}</footer>

    <dialog ref="deleteDialog" class="ox-storage-library__dialog" @cancel.prevent="closeDelete" @click.self="closeDelete">
      <h3>{{ copy('删除所选文件', 'Delete selected files') }}</h3><p>{{ copy(`将从文件库中删除 ${deleteIds.length} 个文件。`, `Remove ${deleteIds.length} files from the library.`) }}</p>
      <div class="ox-storage-library__dialog-actions"><button type="button" autofocus @click="closeDelete">{{ copy('取消', 'Cancel') }}</button><button type="button" class="is-danger-solid" @click="confirmDelete">{{ copy('删除文件', 'Delete files') }}</button></div>
    </dialog>
    <dialog ref="previewDialog" class="ox-storage-library__dialog ox-storage-library__dialog--preview" @cancel.prevent="closePreview" @click.self="closePreview">
      <header><h3>{{ preview?.name }}</h3><button type="button" :aria-label="copy('关闭预览', 'Close preview')" @click="closePreview"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></header>
      <p v-if="previewError" role="alert">{{ copy('图片无法加载，请关闭后刷新文件库重试。', 'The image could not be loaded. Close this preview and refresh the library.') }}</p>
      <img v-if="preview && !previewError" :src="preview.url" :alt="preview.name" @error="previewError = true" />
    </dialog>
  </section>
</template>

<style scoped>
.ox-storage-library { min-width: 0; border: 1px solid var(--ox-border); border-radius: var(--ox-radius-card); background: var(--ox-workspace-panel, var(--ox-bg-surface)); color: var(--ox-text-primary); overflow: clip; transition: border-color 160ms ease; }
.ox-storage-library.is-dragging { border-color: var(--ox-accent); outline: 3px solid var(--ox-accent-soft); }
.ox-storage-library * { box-sizing: border-box; }
.ox-storage-library__head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px; padding: calc(18px * var(--ox-density, 1)); }
.ox-storage-library__identity { display: flex; align-items: center; gap: 12px; min-width: 0; }
.ox-storage-library__icon { display: grid; place-items: center; width: 40px; height: 40px; flex: 0 0 40px; border-radius: var(--ox-radius-sm); color: var(--ox-accent); background: var(--ox-accent-soft); font-size: 18px; }
.ox-storage-library h2 { margin: 0; font-size: 17px; line-height: 1.5; font-weight: 650; }
.ox-storage-library h2 > span { margin-left: 6px; padding: 2px 7px; border-radius: var(--ox-radius-sm); background: var(--ox-bg-surface-hover); color: var(--ox-text-secondary); font-size: 12px; font-variant-numeric: tabular-nums; }
.ox-storage-library__identity p { margin: 3px 0 0; font-size: 12px; color: var(--ox-text-secondary); line-height: 1.5; }
.ox-storage-library button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 32px; padding: 7px 12px; border: 1px solid var(--ox-border); border-radius: var(--ox-radius-sm); color: var(--ox-text-primary); background: var(--ox-bg-surface); font: inherit; font-size: 12px; cursor: pointer; box-shadow: none; }
.ox-storage-library button:hover:not(:disabled) { color: var(--ox-accent); border-color: var(--ox-border-hover); background: var(--ox-accent-soft); }
.ox-storage-library button:disabled { opacity: .55; cursor: not-allowed; }
.ox-storage-library button.is-primary { background: var(--ox-accent); border-color: var(--ox-accent); color: var(--ox-on-accent); }
.ox-storage-library button.is-primary:hover:not(:disabled) { background: var(--ox-accent-hover); border-color: var(--ox-accent-hover); color: var(--ox-on-accent); }
.ox-storage-library button.is-danger { color: var(--ox-danger, var(--el-color-danger)); }
.ox-storage-library button.is-danger-solid { background: var(--ox-danger, var(--el-color-danger)); border-color: var(--ox-danger, var(--el-color-danger)); color: var(--ox-bg-surface); }
.ox-storage-library :is(button, input, select):focus-visible { outline: 2px solid var(--ox-accent); outline-offset: 2px; }
.ox-storage-library input[type="checkbox"] { width: 15px; height: 15px; accent-color: var(--ox-accent); margin: 0; }
.ox-storage-library__commands, .ox-storage-library__dialog-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.ox-storage-library__filters { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; padding: calc(12px * var(--ox-density, 1)) calc(18px * var(--ox-density, 1)); border-block: 1px solid var(--ox-border); background: var(--ox-workspace-inset, var(--ox-bg-surface-hover)); }
.ox-storage-library__search { display: flex; align-items: center; gap: 8px; flex: 1 1 200px; max-width: 480px; min-width: 0; padding: 0 10px; height: 34px; border: 1px solid var(--ox-border); border-radius: var(--ox-radius-sm); background: var(--ox-bg-input); color: var(--ox-text-muted); }
.ox-storage-library__search input { width: 100%; min-width: 0; border: 0; padding: 6px 0; background: transparent; color: var(--ox-text-primary); font: inherit; font-size: 13px; }
.ox-storage-library__filters select { height: 34px; max-width: 100%; padding: 0 9px; border: 1px solid var(--ox-border); border-radius: var(--ox-radius-sm); color: var(--ox-text-primary); background: var(--ox-bg-input); font-size: 12px; }
.ox-storage-library__count { margin-left: auto; font-size: 12px; color: var(--ox-text-secondary); white-space: nowrap; font-variant-numeric: tabular-nums; }
.ox-storage-library__selection { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; padding: calc(10px * var(--ox-density, 1)) calc(18px * var(--ox-density, 1)); font-size: 12px; color: var(--ox-text-secondary); border-bottom: 1px solid var(--ox-border); }
.ox-storage-library__selection label { display: inline-flex; gap: 8px; align-items: center; }
.ox-storage-library__selection > button { margin-left: auto; }
.ox-storage-library__file { display: grid; grid-template-columns: 18px minmax(160px, 1fr) minmax(130px, 240px) auto; align-items: center; gap: 12px; padding: calc(13px * var(--ox-density, 1)) calc(18px * var(--ox-density, 1)); border-bottom: 1px solid var(--ox-border); }
.ox-storage-library__file:last-child { border-bottom: 0; }
.ox-storage-library__file:hover, .ox-storage-library__file.is-selected { background: var(--ox-bg-surface-hover); }
.ox-storage-library__check { display: flex; align-items: center; }
.ox-storage-library__filename { display: flex; gap: 10px; align-items: center; min-width: 0; }
.ox-storage-library__filename > div { min-width: 0; }
.ox-storage-library__filename strong { display: block; color: var(--ox-text-primary); font-size: 13px; font-weight: 600; overflow-wrap: anywhere; line-height: 1.5; }
.ox-storage-library__filename small { display: block; margin-top: 2px; color: var(--ox-text-muted); font-size: 10px; }
.ox-storage-library__file-icon { display: grid; place-items: center; width: 30px; height: 34px; flex: 0 0 30px; border-radius: var(--ox-radius-sm); color: var(--ox-accent); background: var(--ox-accent-soft); font-size: 17px; }
.ox-storage-library__metadata { display: flex; flex-wrap: wrap; column-gap: 16px; row-gap: 3px; color: var(--ox-text-secondary); font-size: 11px; line-height: 1.5; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.ox-storage-library__metadata > span { min-width: 65px; }
.ox-storage-library__file-actions { display: flex; align-items: center; gap: 5px; }
.ox-storage-library__file-actions button { padding: 0; width: 30px; min-height: 30px; }
.ox-storage-library__gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr)); gap: calc(14px * var(--ox-density, 1)); padding: calc(16px * var(--ox-density, 1)); }
.ox-storage-library__file.is-media { grid-template-columns: 18px minmax(0, 1fr); gap: 10px; padding: 12px; border: 1px solid var(--ox-border); border-radius: var(--ox-radius-md); background: var(--ox-bg-surface); align-content: start; }
.ox-storage-library__file.is-media.is-selected { border-color: var(--ox-accent); }
.ox-storage-library__media { display: grid; place-items: center; grid-column: 1 / -1; height: 150px; border-radius: var(--ox-radius-sm); background: var(--ox-bg-surface-hover); overflow: hidden; }
.ox-storage-library__media .ox-storage-library__preview-button { width: 100%; height: 100%; padding: 0; border: 0; background: transparent; }
.ox-storage-library__media :is(img, video) { display: block; width: 100%; height: 150px; object-fit: contain; }
.ox-storage-library__media-error { display: flex; flex-direction: column; gap: 10px; align-items: center; padding: 12px; color: var(--ox-text-secondary); font-size: 12px; text-align: center; }
.ox-storage-library__media-error i { font-size: 26px; color: var(--ox-accent); }
.ox-storage-library__file.is-media .ox-storage-library__metadata { grid-column: 2; }
.ox-storage-library__file.is-media .ox-storage-library__file-actions { grid-column: 1 / -1; justify-content: flex-end; border-top: 1px solid var(--ox-border); padding-top: 10px; }
.ox-storage-library__empty { display: flex; flex-direction: column; align-items: center; padding: calc(42px * var(--ox-density, 1)) 20px; text-align: center; }
.ox-storage-library__empty > span { display: grid; place-items: center; width: 52px; height: 52px; border-radius: var(--ox-radius-md); color: var(--ox-accent); background: var(--ox-accent-soft); font-size: 24px; }
.ox-storage-library__empty h3 { margin: 15px 0 5px; font-size: 16px; font-weight: 600; }
.ox-storage-library__empty p { max-width: 440px; margin: 0 0 16px; font-size: 13px; color: var(--ox-text-secondary); line-height: 1.6; }
.ox-storage-library__drop-note { padding: 10px 18px; border-top: 1px solid var(--ox-border); color: var(--ox-text-secondary); font-size: 12px; text-align: center; background: var(--ox-workspace-inset, var(--ox-bg-surface-hover)); }
.ox-storage-library__drop-note i { margin-right: 8px; color: var(--ox-accent); }
.ox-storage-library__feedback { display: flex; gap: 8px; align-items: center; margin: 12px 18px 0; padding: 10px 12px; border: 1px solid var(--ox-border); border-radius: var(--ox-radius-sm); font-size: 13px; color: var(--ox-text-primary); background: var(--ox-accent-soft); overflow-wrap: anywhere; }
.ox-storage-library__feedback.is-error { border-color: var(--ox-danger, var(--el-color-danger)); background: var(--ox-bg-surface); }
.ox-storage-library__feedback.is-error i, .ox-storage-library__invalid { color: var(--ox-danger, var(--el-color-danger)); }
.ox-storage-library__invalid { margin: 4px 0 0; font-size: 11px; }
.ox-storage-library__dialog { width: min(440px, calc(100vw - 32px)); max-height: calc(100vh - 48px); padding: 22px; border: 1px solid var(--ox-border); border-radius: var(--ox-radius-lg); background: var(--ox-bg-surface); color: var(--ox-text-primary); box-shadow: var(--ox-shadow-lg); }
.ox-storage-library__dialog::backdrop { background: rgb(12 22 32 / 48%); }
.ox-storage-library__dialog h3 { margin: 0 0 10px; font-size: 17px; overflow-wrap: anywhere; }
.ox-storage-library__dialog p { color: var(--ox-text-secondary); font-size: 13px; line-height: 1.6; }
.ox-storage-library__dialog-actions { justify-content: flex-end; margin-top: 24px; }
.ox-storage-library__dialog--preview { width: min(900px, calc(100vw - 32px)); }
.ox-storage-library__dialog--preview header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.ox-storage-library__dialog--preview h3 { margin: 0; }
.ox-storage-library__dialog--preview > img { display: block; max-width: 100%; max-height: 70vh; object-fit: contain; margin: auto; }
@media (max-width: 760px) {
  .ox-storage-library__head { align-items: flex-start; padding: 14px; }
  .ox-storage-library__filters, .ox-storage-library__selection { padding-inline: 14px; }
  .ox-storage-library__file { grid-template-columns: 18px minmax(0, 1fr); padding: 12px 14px; gap: 8px; }
  .ox-storage-library__file > :is(.ox-storage-library__metadata, .ox-storage-library__file-actions) { grid-column: 2; }
  .ox-storage-library__gallery { grid-template-columns: minmax(0, 1fr); padding: 12px; }
  .ox-storage-library__file.is-media .ox-storage-library__file-actions { grid-column: 1 / -1; }
  .ox-storage-library__count { margin-left: 0; }
}
@media (prefers-reduced-motion: reduce) { .ox-storage-library { transition: none; } }
</style>
