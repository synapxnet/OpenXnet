<!--
Copyright (C) 2026 Synapxnet. All rights reserved.
This file is Synapxnet Proprietary and Confidential. It is strictly
forbidden to copy, distribute, or use without explicit authorization.
活动、记忆与身份详情 / Activity, memory and identity inspection.
Author: maoyo | Department: 研发部 | Date: 2026-09-14
Version: 1.0.0 | Security Level: INTERNAL
__version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
__maintainer__: maoyo | __email__: synapxnet@gmail.com
-->
<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, useId, watch } from 'vue';
import '../../../static/js/openxnet-conversation-model.js';

const props = defineProps({
  message: { type: Object, default: null },
  selection: { type: Object, default: null },
  isZh: { type: Boolean, default: true },
  loadSubagentTranscript: { type: Function, default: null },
});
const emit = defineEmits(['close']);
const model = globalThis.OpenXnetConversationModel;
const activeKind = ref('activity');
const selectedStepId = ref('');
const panelRef = ref(null);
const failedImages = ref(new Set());
const uniqueId = `conversation-inspector-${useId()}`;
let previousFocus = null;
const remoteTranscript = ref(null);
const transcriptLoading = ref(false);
const transcriptError = ref('');
const transcriptCopiedId = ref('');
let transcriptEpoch = 0;
let transcriptPoll = null;

/** 保留全部可检查活动。 / Preserve every available activity for inspection. */
const steps = computed(() => Array.isArray(props.message?.activity?.steps) ? props.message.activity.steps : []);
/** 不将已消失的选中记录偷换成其他记录。 / Do not silently replace a selected record that is no longer available. */
const selectedStep = computed(() => selectedStepId.value ? steps.value.find((step) => String(step.id) === selectedStepId.value) || null : steps.value.at(-1) || null);
/** 使用已存储的逐消息身份。 / Read the stored per-message identity. */
const identity = computed(() => model.normalizeIdentity(props.message?.identity, { fallbackKind: props.message?.role || 'unknown' }));
/** 只显示属于当前消息会话的回执。 / Display receipts belonging to the current message conversation only. */
const receipts = computed(() => model.normalizeMemoryContext(props.message?.memoryContext).filter((receipt) => !receipt.conversationId || !props.message?.conversationId || receipt.conversationId === props.message.conversationId));
/** 文件和图片均保留可读名称。 / Keep readable names for both files and images. */
const attachments = computed(() => Array.isArray(props.message?.attachments) ? props.message.attachments : []);
/** 结构关联决定是否显示子智能体详情。 / Structural relations determine whether subagent details are shown. */
const selectedIsSubagent = computed(() => !!selectedStep.value?.agentId || ['subagent', 'sub_agent', 'agent'].includes(selectedStep.value?.kind));
/** 已读取记录优先，消息自身只提供实际已存储的备用记录。 / Prefer loaded records and fall back only to actual stored message records. */
const transcript = computed(() => model.normalizeSubagentTranscript(remoteTranscript.value || selectedStep.value?.transcript));
/** 图形身份与消息中的同一智能体保持一致。 / Keep visual identity consistent with the same agent in the conversation. */
const selectedGlyph = computed(() => model.agentGlyph(selectedStep.value?.agentId || selectedStep.value?.taskId || selectedStep.value?.id));
/** 本地标签页保留明确可读名称。 / Give local tabs explicit readable names. */
const tabs = computed(() => [
  { id: 'activity', label: props.isZh ? '执行过程' : 'Activity', icon: 'fa-solid fa-list-check', count: steps.value.length },
  { id: 'memory', label: props.isZh ? '记忆来源' : 'Memory', icon: 'fa-solid fa-layer-group', count: receipts.value.length },
  { id: 'identity', label: props.isZh ? '身份与附件' : 'Identity & files', icon: 'fa-regular fa-id-badge', count: null },
]);

/** 跟随父级选择并隔离消息间的本地状态。 / Follow parent selection and isolate local state between messages. */
watch(() => [props.message?.id, props.selection?.kind, props.selection?.stepId], () => {
  activeKind.value = ['activity', 'memory', 'identity'].includes(props.selection?.kind) ? props.selection.kind : 'activity';
  selectedStepId.value = String(props.selection?.stepId || '');
  failedImages.value = new Set();
}, { immediate: true });

/** 更换消息、活动或标签后丢弃旧读取结果。 / Discard prior reads when switching messages, activity or tabs. */
watch(() => [props.message?.id, selectedStep.value?.id, activeKind.value], () => {
  transcriptEpoch += 1;
  remoteTranscript.value = null;
  transcriptError.value = '';
  transcriptLoading.value = false;
  transcriptCopiedId.value = '';
  if (activeKind.value === 'activity' && selectedIsSubagent.value) refreshTranscript();
}, { immediate: true });

/** 打开侧栏后提供键盘起点。 / Provide a keyboard entry point when the inspector opens. */
onMounted(async () => {
  previousFocus = typeof document !== 'undefined' ? document.activeElement : null;
  await nextTick();
  panelRef.value?.focus?.({ preventScroll: true });
  /** 仅在侧栏打开且任务仍运行时刷新真实协作回执。 / Refresh real collaboration receipts only while the panel is open and the task is active. */
  transcriptPoll = setInterval(() => {
    if (activeKind.value === 'activity' && selectedIsSubagent.value && ['running', 'pending'].includes(model.normalizeActivityStatus(selectedStep.value?.status))) refreshTranscript();
  }, 4000);
});
/** 关闭后恢复原触发控件的焦点。 / Restore focus to the original trigger when closing. */
onUnmounted(() => {
  transcriptEpoch += 1;
  clearInterval(transcriptPoll);
  if (previousFocus?.isConnected && typeof previousFocus.focus === 'function') previousFocus.focus({ preventScroll: true });
});

/** 不执行任务，仅关闭只读侧栏。 / Close the read-only inspector without executing a task. */
function closeInspector() { emit('close'); }

/** 根据本消息和步骤读取真实子任务记录，防止迟到结果串入另一会话。 / Read real child-task records by message and step while rejecting stale results. */
async function refreshTranscript() {
  if (transcriptLoading.value || !selectedIsSubagent.value || !selectedStep.value?.taskId || typeof props.loadSubagentTranscript !== 'function') return;
  const epoch = transcriptEpoch;
  const messageId = props.message?.id;
  const stepId = selectedStep.value.id;
  transcriptLoading.value = true;
  transcriptError.value = '';
  try {
    const result = await props.loadSubagentTranscript(messageId, stepId);
    if (epoch !== transcriptEpoch) return;
    remoteTranscript.value = result;
  } catch (error) {
    if (epoch === transcriptEpoch) transcriptError.value = error?.message || (props.isZh ? '协作记录读取失败。' : 'Could not read collaboration records.');
  } finally {
    if (epoch === transcriptEpoch) transcriptLoading.value = false;
  }
}

/** 明确区分主模型、子智能体、运行时和工具发言。 / Distinguish parent, subagent, runtime and tool messages explicitly. */
function transcriptRole(row) {
  const labels = props.isZh ? { parent: '主模型 → 子智能体', subagent: '子智能体 → 主模型', tool: '工具回执', runtime: '运行时继续指令' } : { parent: 'Parent → Subagent', subagent: 'Subagent → Parent', tool: 'Tool receipt', runtime: 'Runtime continuation' };
  return labels[row.role] || row.role;
}

/** 复制公开记录，反馈仅作用于当前详情。 / Copy public records with feedback scoped to the current inspector. */
async function copyTranscript(row) {
  const epoch = transcriptEpoch;
  try {
    await navigator.clipboard.writeText(row.content);
    if (epoch === transcriptEpoch) transcriptCopiedId.value = row.id;
  } catch {
    if (epoch === transcriptEpoch) transcriptError.value = props.isZh ? '复制失败，请选择文本复制。' : 'Copy failed; select the text to copy it.';
  }
}

/** 支持标准标签页键盘移动。 / Support standard keyboard movement between tabs. */
async function handleTabKeydown(event, current) {
  if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
  const currentIndex = tabs.value.findIndex((tab) => tab.id === current);
  const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.value.length - 1 : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + tabs.value.length) % tabs.value.length;
  activeKind.value = tabs.value[index].id;
  event.preventDefault();
  await nextTick();
  panelRef.value?.querySelector(`[data-inspector-tab="${activeKind.value}"]`)?.focus();
}

/** 将实际状态转为可读文字。 / Translate actual status into readable labels. */
function statusLabel(step) { return model.getActivityStatusLabel(step?.status, props.isZh); }

/** 将记忆检索和注入状态明确区分。 / Distinguish memory retrieval from actual injection. */
function receiptStatus(receipt) {
  const labels = {
    injected: ['已注入本轮', 'Injected this turn'], retrieved: ['已检索', 'Retrieved'],
    skipped: ['本轮未使用', 'Not used this turn'], not_used: ['本轮未使用', 'Not used this turn'],
    disabled: ['未启用', 'Disabled'], error: ['读取失败', 'Read failed'], failed: ['读取失败', 'Read failed'],
    empty: ['未检索到内容', 'No content found'], unavailable: ['暂不可用', 'Unavailable'],
    unknown: ['状态未记录', 'Status not recorded'],
  };
  return (labels[receipt.status] || labels.unknown)[props.isZh ? 0 : 1];
}

/** 翻译已知回执原因，未知原因按文本保留。 / Translate known receipt reasons while preserving unknown reasons as text. */
function receiptReason(reason) {
  const labels = {
    disabled: ['长期记忆未启用。', 'Long-term memory is disabled.'],
    sub_agent: ['此子智能体未注入长期记忆。', 'Long-term memory was not injected for this subagent.'],
    empty_query: ['本轮没有可用于检索的输入。', 'This turn has no retrieval input.'],
    no_match: ['未找到相关记忆。', 'No matching memory was found.'],
    worker_unavailable: ['记忆服务暂不可用。', 'The memory service is unavailable.'],
    recall_failed: ['记忆检索未成功。', 'Memory retrieval failed.'],
  };
  return labels[reason] ? labels[reason][props.isZh ? 0 : 1] : reason;
}

/** 给原生记忆来源和类型提供产品名称。 / Provide product names for native memory sources and types. */
function memoryLabel(value) {
  const labels = { 'synapxnet-memory-v3': ['原生记忆 V3', 'Native Memory V3'], long_term: ['长期记忆', 'Long-term memory'], role_profile: ['角色档案', 'Role profile'], unknown: ['未记录', 'Not recorded'] };
  return labels[value] ? labels[value][props.isZh ? 0 : 1] : value;
}

/** 以安全地址预览附件。 / Preview attachments through safe addresses. */
function attachmentUrl(attachment) { return model.safeImageUrl(attachment.url || attachment.path || attachment.src); }

/** 图片失败后显示可读占位。 / Show a readable fallback after an image fails. */
function markImageFailed(key) { failedImages.value = new Set([...failedImages.value, key]); }

/** 来源未记录时直接说明未知。 / State unknown identity provenance explicitly. */
function identitySource(source) {
  const labels = { message: ['消息记录', 'Message record'], role_card: ['角色档案', 'Role profile'], employee: ['企业员工', 'Enterprise employee'], runtime: ['运行回执', 'Runtime receipt'], unknown: ['来源未记录', 'Source not recorded'] };
  return labels[source] ? labels[source][props.isZh ? 0 : 1] : source;
}
</script>

<template>
  <aside ref="panelRef" class="oxc-inspector" tabindex="-1" :aria-labelledby="`${uniqueId}-title`" @keydown.esc.stop="closeInspector">
    <header class="oxc-inspector__head">
      <div><span class="oxc-inspector__eyebrow">{{ isZh ? '本条消息' : 'THIS MESSAGE' }}</span><h2 :id="`${uniqueId}-title`">{{ isZh ? '工作详情' : 'Work details' }}</h2></div>
      <button type="button" class="oxc-inspector__close" :aria-label="isZh ? '关闭详情' : 'Close details'" @click="closeInspector"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
    </header>
    <div role="tablist" class="oxc-inspector__tabs" :aria-label="isZh ? '详情类型' : 'Detail category'">
      <button v-for="tab in tabs" :id="`${uniqueId}-tab-${tab.id}`" :key="tab.id" type="button" role="tab" :data-inspector-tab="tab.id" :aria-selected="activeKind === tab.id" :aria-controls="`${uniqueId}-panel-${tab.id}`" :tabindex="activeKind === tab.id ? 0 : -1" @click="activeKind = tab.id" @keydown="handleTabKeydown($event, tab.id)"><i :class="tab.icon" aria-hidden="true"></i><span>{{ tab.label }}</span><small v-if="tab.count">{{ tab.count }}</small></button>
    </div>
    <div class="oxc-inspector__body">
      <section v-if="activeKind === 'activity'" :id="`${uniqueId}-panel-activity`" role="tabpanel" :aria-labelledby="`${uniqueId}-tab-activity`">
        <div v-if="!steps.length" class="oxc-inspector__empty"><i class="fa-regular fa-clock" aria-hidden="true"></i><strong>{{ isZh ? '暂无活动回执' : 'No activity receipts' }}</strong><p>{{ isZh ? '工具或子智能体的实际运行记录会显示在这里。' : 'Actual tool and subagent activity appears here when available.' }}</p></div>
        <template v-else>
          <label class="oxc-inspector__select"><span>{{ isZh ? '选择活动' : 'Select activity' }}</span><select :value="selectedStep?.id || selectedStepId" @change="selectedStepId = String($event.target.value)"><option v-if="selectedStepId && !selectedStep" :value="selectedStepId">{{ isZh ? '原记录已不可用' : 'Original record unavailable' }}</option><option v-for="step in steps" :key="step.id" :value="step.id">{{ step.title || (isZh ? '活动' : 'Activity') }} · {{ statusLabel(step) }}</option></select></label>
          <div v-if="!selectedStep" class="oxc-inspector__empty"><strong>{{ isZh ? '所选记录已不可用' : 'Selected record is unavailable' }}</strong><p>{{ isZh ? '可从上方选择仍保留的活动。' : 'Select an available activity above.' }}</p></div>
          <template v-else>
            <div class="oxc-inspector__activity-title"><span class="oxc-inspector__kind"><svg v-if="selectedIsSubagent" class="oxc-inspector__agent-glyph" viewBox="0 0 24 24" aria-hidden="true"><path :d="selectedGlyph.path" :transform="`rotate(${selectedGlyph.rotation} 12 12)`" /></svg><i v-else class="fa-solid fa-terminal" aria-hidden="true"></i>{{ selectedIsSubagent ? (isZh ? '子智能体' : 'Subagent') : (isZh ? '活动记录' : 'Activity record') }}</span><h3>{{ selectedStep.title || (isZh ? '未命名活动' : 'Untitled activity') }}</h3><div class="oxc-inspector__status" :class="`is-${model.normalizeActivityStatus(selectedStep.status)}`"><span>{{ statusLabel(selectedStep) }}</span><small v-if="selectedStep.duration">{{ selectedStep.duration }}</small></div></div>
            <dl v-if="selectedStep.agentId || selectedStep.taskId" class="oxc-inspector__facts"><div v-if="selectedStep.agentId"><dt>{{ isZh ? '智能体' : 'Agent' }}</dt><dd>{{ selectedStep.agentId }}</dd></div><div v-if="selectedStep.taskId"><dt>{{ isZh ? '关联任务' : 'Linked task' }}</dt><dd>{{ selectedStep.taskId }}</dd></div></dl>
            <p v-if="selectedStep.detail" class="oxc-inspector__description">{{ model.formatDetail(selectedStep.detail) }}</p>
            <section v-if="selectedIsSubagent" class="oxc-inspector__transcript">
              <header><h4>{{ isZh ? '协作对话' : 'Collaboration conversation' }}</h4><button v-if="loadSubagentTranscript && selectedStep.taskId" type="button" :disabled="transcriptLoading" @click="refreshTranscript">{{ transcriptLoading ? (isZh ? '读取中' : 'Loading') : (isZh ? '刷新' : 'Refresh') }}</button></header>
              <p v-if="transcriptError" class="oxc-inspector__transcript-error" role="status">{{ transcriptError }}</p>
              <p v-if="!transcript.length && !transcriptLoading" class="oxc-inspector__notice">{{ isZh ? '暂无已记录的协作消息；下方仍可查看已有输入和输出。' : 'No recorded collaboration messages are available. Existing input and output remain below.' }}</p>
              <ol v-else class="oxc-inspector__transcript-list"><li v-for="row in transcript" :key="row.id" :class="`is-${row.role}`"><header><strong>{{ transcriptRole(row) }}</strong><button type="button" :aria-label="`${isZh ? '复制协作消息' : 'Copy collaboration message'} · ${row.id}`" @click="copyTranscript(row)">{{ transcriptCopiedId === row.id ? (isZh ? '已复制' : 'Copied') : (isZh ? '复制' : 'Copy') }}</button></header><small v-if="row.toolName">{{ row.toolName }}</small><pre>{{ row.content }}</pre></li></ol>
              <p v-if="remoteTranscript?.truncated" class="oxc-inspector__notice">{{ isZh ? '历史记录较长，当前显示已保留的部分。' : 'The history is long; showing the retained portion.' }}</p>
            </section>
            <section v-if="model.formatDetail(selectedStep.input)" class="oxc-inspector__detail"><h4>{{ isZh ? '输入' : 'Input' }}</h4><pre>{{ model.formatDetail(selectedStep.input) }}</pre></section>
            <section v-if="model.formatDetail(selectedStep.output)" class="oxc-inspector__detail"><h4>{{ selectedIsSubagent ? (isZh ? '交付结果' : 'Delivery') : (isZh ? '输出' : 'Output') }}</h4><pre>{{ model.formatDetail(selectedStep.output) }}</pre></section>
            <section v-if="model.formatDetail(selectedStep.error)" class="oxc-inspector__detail is-error"><h4>{{ isZh ? '错误详情' : 'Error details' }}</h4><pre>{{ model.formatDetail(selectedStep.error) }}</pre></section>
            <p v-if="!model.formatDetail(selectedStep.input) && !model.formatDetail(selectedStep.output) && !model.formatDetail(selectedStep.error)" class="oxc-inspector__notice">{{ isZh ? '这条记录未附带输入或输出详情。' : 'This record has no input or output details.' }}</p>
            <p v-if="model.normalizeActivityStatus(selectedStep.status) === 'awaiting_approval'" class="oxc-inspector__notice">{{ isZh ? '此处展示等待状态，请在原授权卡片中处理确认。' : 'Approval is pending. Use the original approval card to respond.' }}</p>
          </template>
        </template>
      </section>
      <section v-else-if="activeKind === 'memory'" :id="`${uniqueId}-panel-memory`" role="tabpanel" :aria-labelledby="`${uniqueId}-tab-memory`">
        <p class="oxc-inspector__intro">{{ isZh ? '这里显示本条消息的实际记忆回执。角色和长期记忆的开关不代表本轮已注入。' : 'These are receipts for this message. Enabling a role or long-term memory does not establish injection for this turn.' }}</p>
        <div v-if="!receipts.length" class="oxc-inspector__empty"><i class="fa-regular fa-folder-open" aria-hidden="true"></i><strong>{{ isZh ? '暂无本轮记忆回执' : 'No memory receipts for this turn' }}</strong><p>{{ isZh ? '没有回执时，无法确认哪些记忆参与了这次回复。' : 'Without receipts, the memory used in this reply is unknown.' }}</p></div>
        <ol v-else class="oxc-inspector__receipts">
          <li v-for="receipt in receipts" :key="receipt.id">
            <header><strong>{{ memoryLabel(receipt.source) }}</strong><span :class="{ 'is-error': ['error', 'failed'].includes(receipt.status) }">{{ receiptStatus(receipt) }}</span></header>
            <dl class="oxc-inspector__facts"><div><dt>{{ isZh ? '类型' : 'Type' }}</dt><dd>{{ memoryLabel(receipt.type) }}</dd></div><div v-if="receipt.count !== null"><dt>{{ isZh ? '条目' : 'Items' }}</dt><dd>{{ receipt.count }}</dd></div><div v-if="receipt.characters !== null"><dt>{{ isZh ? '字符' : 'Characters' }}</dt><dd>{{ receipt.characters }}</dd></div></dl>
            <p v-if="receipt.reason" class="oxc-inspector__description">{{ receiptReason(receipt.reason) }}</p>
            <p v-if="receipt.detail" class="oxc-inspector__description">{{ receipt.detail }}</p>
            <details v-if="receipt.items.length" class="oxc-inspector__provenance">
              <summary>{{ isZh ? '查看来源与版本' : 'View sources and versions' }} <span>{{ receipt.items.length }}</span></summary>
              <div v-for="(item, itemIndex) in receipt.items" :key="`${item.memoryId}:${itemIndex}`" class="oxc-inspector__memory-item">
                <h4>{{ item.title || (isZh ? '记忆条目' : 'Memory item') }}</h4>
                <dl class="oxc-inspector__facts"><div v-if="item.memoryId"><dt>{{ isZh ? '条目标识' : 'Memory ID' }}</dt><dd>{{ item.memoryId }}</dd></div><div v-if="item.version"><dt>{{ isZh ? '版本' : 'Version' }}</dt><dd>{{ item.version }}</dd></div><div v-if="item.ownerAgent"><dt>{{ isZh ? '所属智能体' : 'Owner agent' }}</dt><dd>{{ item.ownerAgent }}</dd></div><div v-if="item.taskId"><dt>{{ isZh ? '关联任务' : 'Linked task' }}</dt><dd>{{ item.taskId }}</dd></div><div v-if="item.characters !== null"><dt>{{ isZh ? '注入字符' : 'Characters' }}</dt><dd>{{ item.characters }}</dd></div><div v-if="item.recordSha256"><dt>{{ isZh ? '记录指纹' : 'Record digest' }}</dt><dd class="oxc-inspector__digest">{{ item.recordSha256 }}</dd></div><div v-if="item.injectedContentSha256"><dt>{{ isZh ? '注入指纹' : 'Injection digest' }}</dt><dd class="oxc-inspector__digest">{{ item.injectedContentSha256 }}</dd></div></dl>
              </div>
            </details>
          </li>
        </ol>
      </section>
      <section v-else :id="`${uniqueId}-panel-identity`" role="tabpanel" :aria-labelledby="`${uniqueId}-tab-identity`">
        <div class="oxc-inspector__identity"><div class="oxc-inspector__avatar"><img v-if="identity.image && !failedImages.has('identity')" :src="identity.image" :alt="identity.name || (isZh ? '消息头像' : 'Message avatar')" @error="markImageFailed('identity')" /><span v-else>{{ identity.text }}</span></div><div><h3>{{ identity.name || (isZh ? '身份未记录' : 'Identity not recorded') }}</h3><p>{{ identitySource(identity.source) }}</p></div></div>
        <dl class="oxc-inspector__facts"><div><dt>{{ isZh ? '消息角色' : 'Message role' }}</dt><dd>{{ message?.role === 'assistant' ? (isZh ? '助手' : 'Assistant') : message?.role === 'user' ? (isZh ? '用户' : 'User') : message?.role || (isZh ? '未知' : 'Unknown') }}</dd></div><div v-if="identity.id"><dt>{{ isZh ? '身份标识' : 'Identity ID' }}</dt><dd>{{ identity.id }}</dd></div></dl>
        <p v-if="!identity.id && !identity.name" class="oxc-inspector__notice">{{ isZh ? '历史消息未保存身份时，会保留未知状态。' : 'Historical messages without a saved identity remain unknown.' }}</p>
        <section class="oxc-inspector__attachments"><h4>{{ isZh ? '本条消息的附件' : 'Attachments for this message' }}<span>{{ attachments.length }}</span></h4><p v-if="!attachments.length" class="oxc-inspector__notice">{{ isZh ? '没有附件记录。' : 'No attachment records.' }}</p><ul v-else><li v-for="(attachment, index) in attachments" :key="attachment.id || index"><a v-if="attachmentUrl(attachment)" :href="attachmentUrl(attachment)" target="_blank" rel="noopener noreferrer"><img v-if="attachment.kind === 'image' && !failedImages.has(index)" :src="attachmentUrl(attachment)" :alt="attachment.name || (isZh ? '图片附件' : 'Image attachment')" loading="lazy" @error="markImageFailed(index)" /><i v-else :class="attachment.kind === 'image' ? 'fa-regular fa-image' : 'fa-regular fa-file-lines'" aria-hidden="true"></i><span>{{ attachment.name || (isZh ? `附件 ${index + 1}` : `Attachment ${index + 1}`) }}</span><i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></a><span v-else class="oxc-inspector__attachment-missing"><i class="fa-regular fa-file" aria-hidden="true"></i>{{ attachment.name || (isZh ? `附件 ${index + 1}` : `Attachment ${index + 1}`) }}<small>{{ isZh ? '地址不可用' : 'Address unavailable' }}</small></span></li></ul></section>
      </section>
    </div>
  </aside>
</template>

<style scoped>
.oxc-inspector { display: flex; flex-direction: column; width: clamp(300px, 29vw, 410px); max-width: 100%; min-height: 0; height: 100%; box-sizing: border-box; color: var(--ox-text-primary, #243548); background: var(--ox-bg-surface, #fff); border-left: 1px solid var(--ox-border, #dce4eb); font-size: 12px; outline: none; }
.oxc-inspector button, .oxc-inspector select { font: inherit; color: inherit; }
.oxc-inspector__agent-glyph { width: 22px; height: 22px; fill: none; stroke: var(--ox-accent, #2494be); stroke-width: 1.5; stroke-linejoin: round; stroke-linecap: round; }
.oxc-inspector__transcript { margin: 20px 0; }
.oxc-inspector__transcript header { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.oxc-inspector__transcript h4 { margin: 0; font-size: 12px; }
.oxc-inspector__transcript button { min-height: 32px; padding: 0 8px; background: transparent; color: var(--ox-accent, #2494be); border: 0; border-radius: 7px; cursor: pointer; font-size: 11px; }
.oxc-inspector__transcript button:hover { background: var(--ox-accent-soft, #e5f4fb); }
.oxc-inspector__transcript-list { list-style: none; margin: 8px 0; padding: 0; }
.oxc-inspector__transcript-list li { margin: 10px 0; padding: 10px 12px; border-left: 2px solid var(--ox-border, #dce4eb); border-radius: 0 10px 10px 0; background: var(--ox-bg-base, #f6f8fb); }
.oxc-inspector__transcript-list li.is-parent { border-left-color: var(--ox-accent, #2494be); }
.oxc-inspector__transcript-list strong { font-size: 11px; font-weight: 550; color: var(--ox-text-secondary, #67788b); }
.oxc-inspector__transcript-list pre { margin: 8px 0 0; max-height: 440px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; font: 12px/1.8 var(--ox-font-sans, system-ui); color: var(--ox-text-primary, #243548); }
.oxc-inspector__transcript-error { color: var(--ox-danger, #ce5260); font-size: 11px; line-height: 1.6; }
.oxc-inspector button:focus-visible, .oxc-inspector a:focus-visible, .oxc-inspector select:focus-visible { outline: 2px solid var(--ox-accent, #2494be); outline-offset: 2px; }
.oxc-inspector__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 22px 20px 16px; }
.oxc-inspector__eyebrow { color: var(--ox-text-secondary, #68798c); font-size: 10px; letter-spacing: .08em; }
.oxc-inspector h2 { margin: 5px 0 0; font-size: 18px; font-weight: 620; }
.oxc-inspector__close { display: grid; place-items: center; flex: 0 0 40px; width: 40px; height: 40px; border: 0; border-radius: 10px; background: transparent; cursor: pointer; }
.oxc-inspector__close:hover { background: var(--ox-accent-soft, #2494be12); color: var(--ox-accent, #2494be); }
.oxc-inspector__tabs { display: flex; gap: 2px; margin: 0 12px; border-bottom: 1px solid var(--ox-border, #dce4eb); }
.oxc-inspector__tabs button { display: flex; flex: 1; align-items: center; justify-content: center; gap: 6px; min-height: 44px; padding: 8px 5px; border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--ox-text-secondary, #68798c); cursor: pointer; font-size: 11px; white-space: nowrap; }
.oxc-inspector__tabs button[aria-selected="true"] { color: var(--ox-accent, #2494be); border-bottom-color: var(--ox-accent, #2494be); }
.oxc-inspector__tabs small { font-size: 10px; opacity: .7; }
.oxc-inspector__body { flex: 1; min-height: 0; padding: 20px; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; }
.oxc-inspector__select { display: flex; flex-direction: column; gap: 8px; margin-bottom: 22px; color: var(--ox-text-secondary, #68798c); font-size: 11px; }
.oxc-inspector__select select { width: 100%; min-width: 0; height: 40px; padding: 0 10px; border: 1px solid var(--ox-border, #dce4eb); border-radius: var(--ox-radius-sm, 9px); background: var(--ox-bg-base, #f6f8fb); color: var(--ox-text-primary, #243548); text-overflow: ellipsis; }
.oxc-inspector__kind { display: inline-flex; align-items: center; gap: 7px; color: var(--ox-accent, #2494be); font-size: 11px; }
.oxc-inspector h3 { margin: 8px 0 10px; font-size: 16px; line-height: 1.5; overflow-wrap: anywhere; }
.oxc-inspector__status { display: flex; align-items: baseline; gap: 10px; margin-bottom: 18px; color: var(--ox-text-secondary, #68798c); }
.oxc-inspector__status.is-error, .oxc-inspector .is-error { color: var(--ox-danger, #ce5260); }
.oxc-inspector__status.is-running, .oxc-inspector__status.is-awaiting_approval { color: var(--ox-accent, #2494be); }
.oxc-inspector__status small { color: var(--ox-text-secondary, #68798c); font-variant-numeric: tabular-nums; }
.oxc-inspector__facts { display: flex; flex-direction: column; gap: 8px; margin: 14px 0; }
.oxc-inspector__facts div { display: grid; grid-template-columns: minmax(58px, 26%) minmax(0, 1fr); gap: 12px; }
.oxc-inspector__facts dt { color: var(--ox-text-secondary, #68798c); }
.oxc-inspector__facts dd { margin: 0; overflow-wrap: anywhere; }
.oxc-inspector__description { white-space: pre-wrap; line-height: 1.7; overflow-wrap: anywhere; }
.oxc-inspector__detail { margin-top: 22px; }
.oxc-inspector h4 { display: flex; justify-content: space-between; margin: 0 0 9px; font-size: 12px; font-weight: 600; }
.oxc-inspector__detail pre { margin: 0; padding: 12px; border: 1px solid var(--ox-border, #dce4eb); border-radius: var(--ox-radius-sm, 10px); background: var(--ox-bg-base, #f6f8fb); color: var(--ox-text-primary, #243548); font: 11px/1.65 var(--ox-font-mono, ui-monospace, Consolas, monospace); white-space: pre-wrap; overflow-wrap: anywhere; max-height: 360px; overflow-y: auto; }
.oxc-inspector__detail.is-error pre { border-left: 3px solid var(--ox-danger, #ce5260); }
.oxc-inspector__notice, .oxc-inspector__intro { color: var(--ox-text-secondary, #68798c); line-height: 1.75; font-size: 11px; }
.oxc-inspector__empty { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; padding: 24px 0; color: var(--ox-text-secondary, #68798c); }
.oxc-inspector__empty > i { font-size: 24px; color: var(--ox-accent, #2494be); opacity: .7; }
.oxc-inspector__empty strong { color: var(--ox-text-primary, #243548); font-size: 14px; font-weight: 550; }
.oxc-inspector__empty p { margin: 0; line-height: 1.7; }
.oxc-inspector__receipts { list-style: none; margin: 20px 0 0; padding: 0; }
.oxc-inspector__receipts li { padding: 16px 0; border-top: 1px solid var(--ox-border, #dce4eb); }
.oxc-inspector__receipts header { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; overflow-wrap: anywhere; }
.oxc-inspector__receipts header span { font-size: 10px; flex-shrink: 0; color: var(--ox-text-secondary, #68798c); }
.oxc-inspector__provenance { margin-top: 12px; }
.oxc-inspector__provenance summary { min-height: 40px; align-content: center; color: var(--ox-accent, #2494be); cursor: pointer; }
.oxc-inspector__provenance summary:focus-visible { outline: 2px solid var(--ox-accent, #2494be); outline-offset: 2px; }
.oxc-inspector__provenance summary span { margin-left: 6px; color: var(--ox-text-secondary, #68798c); font-size: 10px; }
.oxc-inspector__memory-item { padding: 14px 0 6px; border-top: 1px solid var(--ox-border, #dce4eb); }
.oxc-inspector__memory-item h4 { line-height: 1.6; overflow-wrap: anywhere; }
.oxc-inspector__digest { color: var(--ox-text-secondary, #68798c); font: 10px/1.6 var(--ox-font-mono, ui-monospace, Consolas, monospace); }
.oxc-inspector__identity { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.oxc-inspector__identity h3 { margin: 0 0 5px; font-size: 15px; }
.oxc-inspector__identity p { margin: 0; color: var(--ox-text-secondary, #68798c); font-size: 11px; }
.oxc-inspector__avatar { display: grid; place-items: center; flex: 0 0 52px; width: 52px; height: 52px; overflow: hidden; border-radius: var(--ox-radius, 15px); background: var(--ox-accent-soft, #2494be12); color: var(--ox-accent, #2494be); font-size: 20px; }
.oxc-inspector__avatar img { width: 100%; height: 100%; object-fit: cover; }
.oxc-inspector__attachments { margin-top: 28px; padding-top: 20px; border-top: 1px solid var(--ox-border, #dce4eb); }
.oxc-inspector__attachments h4 span { font-size: 11px; color: var(--ox-text-secondary, #68798c); }
.oxc-inspector__attachments ul { list-style: none; margin: 0; padding: 0; }
.oxc-inspector__attachments a, .oxc-inspector__attachment-missing { display: flex; align-items: center; gap: 10px; min-height: 44px; margin: 6px 0; padding: 8px; color: var(--ox-text-primary, #243548); text-decoration: none; border-radius: 9px; }
.oxc-inspector__attachments a:hover { background: var(--ox-accent-soft, #2494be12); }
.oxc-inspector__attachments a > span { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.oxc-inspector__attachments img { width: 58px; height: 50px; object-fit: cover; border-radius: 6px; background: var(--ox-bg-base, #f6f8fb); }
.oxc-inspector__attachments a > i:first-child { width: 34px; text-align: center; font-size: 20px; color: var(--ox-accent, #2494be); }
.oxc-inspector__attachments a > i:last-child, .oxc-inspector__attachment-missing small { color: var(--ox-text-secondary, #68798c); font-size: 10px; }
.oxc-inspector__attachment-missing { flex-wrap: wrap; overflow-wrap: anywhere; }
@media (max-width: 680px) { .oxc-inspector { width: 100%; } .oxc-inspector__head { padding: 18px 16px 12px; } .oxc-inspector__body { padding: 16px; } }
@media (prefers-reduced-motion: reduce) { .oxc-inspector * { scroll-behavior: auto; } }
</style>
