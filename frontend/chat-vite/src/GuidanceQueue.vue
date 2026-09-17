<!--
Copyright (C) 2026 Synapxnet. All rights reserved.
This file is Synapxnet Proprietary and Confidential. It is strictly
forbidden to copy, distribute, or use without explicit authorization.
会话不中断引导队列 / Non-interrupting conversation guidance queue.
Author: maoyo | Department: 研发部 | Date: 2026-09-14
Version: 1.0.0 | Security Level: INTERNAL
__version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
__maintainer__: maoyo | __email__: synapxnet@gmail.com
-->
<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
const props = defineProps({ state: { type: Object, required: true }, isZh: { type: Boolean, default: true }, running: Boolean, bridge: { type: Object, required: true } });
const emit = defineEmits(['changed', 'restore-text']);
const expanded = ref(false);
const editing = ref(null);
const editedText = ref('');
const pending = ref('');
const error = ref('');
let generation = 0;
/** 仅依据明确pending状态计数。 / Count only explicitly pending guidance. */
const waiting = computed(() => (props.state.items || []).filter((item) => item.state === 'pending').length);
/** 默认展示近期记录，展开后查看有界队列。 / Show recent records by default and the bounded queue when expanded. */
const rows = computed(() => expanded.value ? [...(props.state.items || [])].reverse() : [...(props.state.items || [])].slice(-3).reverse());
/** 会话切换清除旧编辑器和迟到提示。 / Clear old editors and stale feedback on conversation changes. */
watch(() => props.state.scope, () => { generation += 1; editing.value = null; editedText.value = ''; pending.value = ''; error.value = ''; expanded.value = false; });
/** 卸载后不呈现迟到操作结果。 / Do not render late action results after unmount. */
onBeforeUnmount(() => { generation += 1; });
/** 状态来自执行端回执，已接收不声称已采用。 / Label execution receipts without claiming received guidance was adopted. */
function label(state) { return ({ pending: ['待接收', 'Pending'], consumed: ['已接收', 'Received'], canceled: ['已撤回', 'Withdrawn'], lost: ['需重新提交', 'Resubmit needed'] })[state]?.[props.isZh ? 0 : 1] || (props.isZh ? '状态未知' : 'Unknown'); }
/** 保留编辑时看到的原修订，用于原子冲突检查。 / Retain the revision seen when editing for atomic conflict checks. */
function edit(item) { if (pending.value || item.mutationPending || item.state !== 'pending') return; editing.value = { ...item, scope: props.state.scope }; editedText.value = item.text; error.value = ''; expanded.value = true; }
/** 取消本地编辑，不改后端队列。 / Cancel local editing without changing the backend queue. */
function closeEditor() { if (!pending.value) { editing.value = null; editedText.value = ''; error.value = ''; } }
/** 显式刷新保留失败信息，不改变当前编辑内容。 / Explicit refresh retains failures without changing current edits. */
async function refresh() { try { await props.bridge.refreshGuidance?.(true); emit('changed'); } catch (failure) { error.value = failure?.message || '引导状态不可用 / Guidance state unavailable.'; } }
/** 等待真实原子回执；冲突时保留编辑内容并刷新实际状态。 / Await atomic receipts, preserving edits and refreshing actual state on conflict. */
async function act(item, action) {
  if (pending.value || item.mutationPending) return;
  const request = ++generation; const reference = { ...item, scope: props.state.scope };
  pending.value = item.guidance_id; error.value = '';
  try {
    const result = await props.bridge.updateGuidance(reference, action, action === 'edit' ? editedText.value : '');
    if (request !== generation) return;
    if (result?.success !== true) throw new Error(props.isZh ? '操作尚未确认。' : 'The action was not confirmed.');
    if (editing.value?.guidance_id === item.guidance_id) { editing.value = null; editedText.value = ''; }
  } catch (failure) { if (request === generation) error.value = failure?.message || (props.isZh ? '操作失败，编辑内容已保留。' : 'Action failed; your edit is preserved.'); }
  finally { if (request === generation) { pending.value = ''; emit('changed'); } }
}
</script>

<template>
  <section v-if="running || state.items?.length || state.error || state.notice" class="oxc-guidance-queue" :aria-label="isZh ? '会话引导' : 'Conversation guidance'">
    <header><span><i class="fa-solid fa-route" aria-hidden="true"></i><strong>{{ isZh ? '会话引导' : 'Guidance' }}</strong><small v-if="waiting">{{ waiting }} {{ isZh ? '条待接收' : 'pending' }}</small></span><button type="button" data-guidance-action="refresh" :disabled="state.loading || !!pending" :aria-label="isZh ? '刷新引导状态' : 'Refresh guidance state'" @click="refresh"><i :class="state.loading ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-rotate'" aria-hidden="true"></i></button></header>
    <p class="oxc-guidance-queue__hint">{{ running ? (isZh ? '补充要求不会停止当前回复，可在后续受支持的检查点接收。' : 'Add instructions without stopping the reply; supported later checkpoints can receive them.') : (isZh ? '本轮回复已结束，待接收引导仍保留在队列中。' : 'This reply has ended; pending guidance remains queued.') }}</p>
    <p v-if="state.supported === false" class="oxc-guidance-queue__hint">{{ state.unavailableReason || (isZh ? '当前执行方式不支持实时引导。' : 'The current execution mode does not support live guidance.') }}</p>
    <p v-else-if="!state.available && !state.loading" class="oxc-guidance-queue__hint">{{ isZh ? '引导连接尚未就绪，发送失败会保留草稿。' : 'Guidance is not connected yet; failed submissions keep their drafts.' }}</p>
    <div v-if="rows.length" class="oxc-guidance-queue__rows">
      <article v-for="item in rows" :key="item.guidance_id" :data-guidance-id="item.guidance_id" :data-guidance-state="item.state">
        <span class="oxc-guidance-queue__state" :class="`is-${item.state}`">{{ label(item.state) }}</span>
        <details><summary>{{ item.text }}</summary><p>{{ item.text }}</p><small v-if="item.state === 'consumed'">{{ isZh ? '执行端已在检查点接收，不代表模型已经采用。' : 'Received by execution at a checkpoint; model adoption is not confirmed.' }}</small></details>
        <div class="oxc-guidance-queue__actions"><template v-if="item.state === 'pending'"><button type="button" data-guidance-action="edit" :disabled="!!pending || item.mutationPending" :aria-label="isZh ? '编辑引导' : 'Edit guidance'" @click="edit(item)"><i class="fa-solid fa-pen" aria-hidden="true"></i></button><button type="button" data-guidance-action="cancel" :disabled="!!pending || item.mutationPending" :aria-label="isZh ? '撤回引导' : 'Withdraw guidance'" @click="act(item, 'cancel')"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></template><button v-else-if="item.state === 'lost'" type="button" data-guidance-action="restore" @click="emit('restore-text', item.text)">{{ isZh ? '放回草稿' : 'Copy to draft' }}</button></div>
      </article>
    </div>
    <button v-if="(state.items?.length || 0) > 3" type="button" class="oxc-guidance-queue__more" @click="expanded = !expanded">{{ expanded ? (isZh ? '收起记录' : 'Show fewer') : (isZh ? `查看全部 ${state.items.length} 条` : `View all ${state.items.length}`) }}</button>
    <div v-if="editing" class="oxc-guidance-queue__editor"><label :for="`guidance-edit-${editing.guidance_id}`">{{ isZh ? '编辑待接收引导' : 'Edit pending guidance' }}</label><textarea :id="`guidance-edit-${editing.guidance_id}`" :value="editedText" maxlength="16000" :disabled="!!pending" :aria-label="isZh ? '编辑引导内容' : 'Edit guidance text'" @input="editedText = $event.target.value" @keydown.stop></textarea><div><button type="button" data-guidance-action="dismiss-edit" :disabled="!!pending" @click="closeEditor">{{ isZh ? '取消编辑' : 'Cancel edit' }}</button><button type="button" data-guidance-action="save-edit" :disabled="!!pending || !editedText.trim()" @click="act(editing, 'edit')">{{ pending ? (isZh ? '正在确认' : 'Confirming') : (isZh ? '保存引导' : 'Save guidance') }}</button></div></div>
    <p v-if="error || state.error" class="oxc-guidance-queue__error" role="alert">{{ error || state.error }}</p><p v-if="state.notice" class="oxc-guidance-queue__hint" role="status">{{ state.notice }}</p>
  </section>
</template>

<style scoped>
.oxc-guidance-queue{max-width:var(--chat-reading-width);margin:0 auto 10px;padding:10px 14px;background:var(--ox-bg-surface,#fff);border:1px solid var(--ox-border,#dde6ed);border-radius:var(--ox-radius-md,12px);color:var(--ox-text-primary,#26313f);font-size:12px}header,header>span,.oxc-guidance-queue__actions,.oxc-guidance-queue__editor>div{display:flex;align-items:center;gap:9px}header{justify-content:space-between}header i,.is-pending{color:var(--ox-accent,#168abb)}header small,.oxc-guidance-queue__hint,details small{color:var(--ox-text-secondary,#63778d);font-size:11px}.oxc-guidance-queue__hint{margin:6px 0;line-height:1.5}.oxc-guidance-queue__rows{max-height:190px;overflow:auto;overscroll-behavior:contain}article{display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-top:1px solid var(--ox-border,#dde6ed)}.oxc-guidance-queue__state{font-size:10px;white-space:nowrap;padding:4px 0;min-width:40px}.is-consumed,.is-canceled{color:var(--ox-text-secondary,#63778d)}.is-lost{color:var(--ox-warning,#bd8540)}details{flex:1;min-width:0;padding-top:3px}summary{cursor:pointer;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;line-height:1.5}details[open] summary{display:none}details p{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.6;margin:0 0 6px}button{font:inherit;color:inherit;cursor:pointer;border:0;background:transparent;border-radius:6px;padding:4px 6px}button:hover{background:var(--ox-accent-soft,rgba(22,138,187,.1))}button:disabled{opacity:.45;cursor:default}.oxc-guidance-queue__actions{flex-shrink:0;gap:2px}.oxc-guidance-queue__more{color:var(--ox-accent,#168abb);font-size:11px}.oxc-guidance-queue__editor{border-top:1px solid var(--ox-border,#dde6ed);padding-top:10px;margin-top:8px}.oxc-guidance-queue__editor label{display:block;font-weight:600;margin-bottom:7px}.oxc-guidance-queue__editor textarea{box-sizing:border-box;display:block;width:100%;min-height:72px;max-height:140px;resize:vertical;font:inherit;color:inherit;border:1px solid var(--ox-border,#dde6ed);border-radius:8px;background:var(--ox-bg-surface,#fff);padding:9px}.oxc-guidance-queue__editor>div{justify-content:flex-end;margin-top:7px}.oxc-guidance-queue__editor button:last-child{background:var(--ox-accent-soft,#e5f4fb);color:var(--ox-accent,#168abb)}.oxc-guidance-queue__error{color:var(--ox-danger,#c84d55);line-height:1.5;overflow-wrap:anywhere;margin:7px 0 0}@media(max-width:600px){.oxc-guidance-queue{padding:9px 10px}article{gap:7px}.oxc-guidance-queue__rows{max-height:150px}}
details[open] summary{display:list-item;margin-bottom:6px;color:var(--ox-text-secondary,#63778d)}
</style>
