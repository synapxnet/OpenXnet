<!--
Copyright (C) 2026 Synapxnet. All rights reserved.
This file is Synapxnet Proprietary and Confidential. It is strictly
forbidden to copy, distribute, or use without explicit authorization.
会话自动任务详情 / Conversation automation details.
Author: maoyo | Department: 研发部 | Date: 2026-09-14
Version: 1.0.0 | Security Level: INTERNAL
__version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
__maintainer__: maoyo | __email__: synapxnet@gmail.com
-->
<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
const props = defineProps({ task: { type: Object, default: null }, isZh: { type: Boolean, default: true }, bridge: { type: Object, required: true }, canManage: Boolean, canOpenCenter: Boolean, refreshError: { type: String, default: '' }, loading: Boolean });
const emit = defineEmits(['close', 'changed', 'refresh']);
const pending = ref('');
const error = ref('');
const notice = ref('');
/** 重新打开面板时保留桥接层的在途操作锁。 / Retain the bridge's in-flight action lock when reopening the panel. */
const busy = computed(() => !!pending.value || !!props.task?.mutationPending);
let generation = 0;
/** 当前任务身份变化时废弃旧操作提示。 / Discard stale action notices when the selected task identity changes. */
watch(() => [props.task?.scope, props.task?.id], () => { generation += 1; pending.value = ''; error.value = ''; notice.value = ''; });
/** 面板卸载后忽略迟到操作结果。 / Ignore late action results after the panel unmounts. */
onBeforeUnmount(() => { generation += 1; });
/** 用明确文字呈现自动任务生命周期。 / Describe automation lifecycle with explicit text. */
const stateLabel = computed(() => label(props.task?.state));
/** 保留最近真实运行的顺序与原始结果。 / Preserve the order and original outcomes of recent actual runs. */
const runs = computed(() => [...(props.task?.runs || [])].reverse());
/** 为后端状态提供双语名称，未知值保持可识别。 / Provide bilingual backend state names while preserving unknown values. */
function label(value) { return ({ active: ['进行中', 'Active'], paused: ['已暂停', 'Paused'], completed: ['已结束', 'Completed'], running: ['执行中', 'Running'], pending: ['等待执行', 'Pending'], failed: ['失败', 'Failed'], error: ['失败', 'Failed'], unchanged: ['未发生变化', 'Unchanged'], changed: ['有新变化', 'Changed'], action_required: ['需要处理', 'Action required'], changes_only: ['有变化时通知', 'Notify on changes'], all: ['每次通知', 'Notify every run'], silent: ['仅保留记录', 'History only'] })[value]?.[props.isZh ? 0 : 1] || value || (props.isZh ? '未提供' : 'Not provided'); }
/** 格式化真实时间，无法解析时保留原值。 / Format actual timestamps and retain unparseable source values. */
function time(value) { if (!value) return props.isZh ? '未安排' : 'Not scheduled'; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString(props.isZh ? 'zh-CN' : 'en-US'); }
/** 等待受控接口明确确认，失败或审批等待不得改变任务状态。 / Await explicit controlled-API confirmation without changing state on failure or pending approval. */
async function act(action) {
  if (!props.task || busy.value || !props.canManage) return;
  const task = props.task; const request = ++generation;
  pending.value = action; error.value = ''; notice.value = '';
  try {
    const result = await props.bridge.updateConversationAutomation(task, action);
    if (request !== generation) return;
    if (result?.awaitingApproval) notice.value = props.isZh ? '等待确认，任务状态尚未改变。' : 'Awaiting approval; task state has not changed.';
    else if (result?.success === true) { notice.value = props.isZh ? '操作已确认。' : 'Action confirmed.'; emit('changed'); }
    else throw new Error(props.isZh ? '操作没有获得成功确认。' : 'The action was not confirmed successful.');
  } catch (failure) { if (request === generation) error.value = failure?.message || (props.isZh ? '操作失败，请重试。' : 'Action failed. Please retry.'); }
  finally { if (request === generation) pending.value = ''; }
}
/** 在既有任务中心打开当前任务，保留读取失败信息。 / Open the current task in the existing task center and retain read failures. */
async function openCenter() {
  if (!props.task || busy.value) return;
  const request = ++generation; pending.value = 'center'; error.value = '';
  try { const result = await props.bridge.openAutomationTaskCenter(props.task); if (request === generation && result === false) throw new Error(props.isZh ? '任务中心不可用。' : 'Task center unavailable.'); }
  catch (failure) { if (request === generation) error.value = failure?.message || 'Task center unavailable.'; }
  finally { if (request === generation) pending.value = ''; }
}
</script>

<template>
  <aside class="oxc-automation-panel" aria-label="自动任务详情 / Automation details">
    <header><div><span class="oxc-automation-panel__eyebrow"><i class="fa-regular fa-clock" aria-hidden="true"></i>{{ isZh ? '自动任务' : 'Automation' }}</span><h2>{{ task?.title || (isZh ? '任务详情' : 'Task details') }}</h2></div><button type="button" :aria-label="isZh ? '关闭自动任务详情' : 'Close automation details'" @click="emit('close')"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></header>
    <div class="oxc-automation-panel__body">
      <p v-if="!task" role="status">{{ isZh ? '此任务已不在当前会话中。' : 'This task is no longer available in this conversation.' }}</p>
      <template v-else>
        <div class="oxc-automation-panel__state"><strong :data-automation-state="task.state">{{ stateLabel }}</strong><span>{{ isZh ? '本次执行' : 'Current execution' }} · {{ label(task.status) }}</span></div>
        <section><h3>{{ isZh ? '任务要求' : 'Instructions' }}</h3><p class="oxc-automation-panel__prompt">{{ task.description || (isZh ? '任务尚未提供具体要求。' : 'No instructions were provided.') }}</p></section>
        <dl><dt>{{ isZh ? '执行计划' : 'Schedule' }}</dt><dd>{{ task.scheduleExpression || task.scheduleType || (isZh ? '未提供' : 'Not provided') }}</dd><dt>{{ isZh ? '下一次检查' : 'Next check' }}</dt><dd>{{ task.state === 'active' ? time(task.nextRunAt) : (isZh ? '当前未启用后续检查' : 'Future checks are inactive') }}</dd><dt>{{ isZh ? '完成条件' : 'Completion condition' }}</dt><dd>{{ task.completionCondition || (isZh ? '未提供' : 'Not provided') }}</dd><dt>{{ isZh ? '通知方式' : 'Notifications' }}</dt><dd>{{ label(task.notificationPolicy) }}</dd></dl>
        <div v-if="canManage && task.state !== 'completed'" class="oxc-automation-panel__actions">
          <button v-if="task.state === 'active'" type="button" data-automation-action="pause" :disabled="busy" @click="act('pause')"><i class="fa-solid fa-pause" aria-hidden="true"></i>{{ isZh ? '暂停' : 'Pause' }}</button>
          <button v-if="task.state === 'paused'" type="button" data-automation-action="resume" :disabled="busy" @click="act('resume')"><i class="fa-solid fa-play" aria-hidden="true"></i>{{ isZh ? '恢复' : 'Resume' }}</button>
          <button type="button" data-automation-action="complete" :disabled="busy" @click="act('complete')"><i class="fa-solid fa-check" aria-hidden="true"></i>{{ isZh ? '结束任务' : 'Complete task' }}</button>
        </div>
        <p v-if="busy" role="status">{{ isZh ? '正在确认…' : 'Confirming…' }}</p><p v-if="notice" role="status">{{ notice }}</p><p v-if="error" class="oxc-automation-panel__error" role="alert">{{ error }}</p>
        <section><div class="oxc-automation-panel__section-heading"><h3>{{ isZh ? '运行记录' : 'Run history' }} <span>{{ runs.length }}</span></h3><button type="button" :disabled="loading || busy" :aria-label="isZh ? '刷新运行记录' : 'Refresh run history'" @click="emit('refresh')"><i :class="loading ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-rotate'" aria-hidden="true"></i></button></div>
          <p v-if="refreshError" class="oxc-automation-panel__error" role="alert">{{ refreshError }}</p><p v-if="!runs.length">{{ isZh ? '还没有实际运行记录。' : 'No actual runs have been recorded.' }}</p>
          <article v-for="run in runs" :key="run.id" class="oxc-automation-run" :data-automation-run="run.id"><div><strong>{{ label(run.outcome) }}</strong><time>{{ time(run.finishedAt) }}</time></div><small>{{ isZh ? '自动任务结果' : 'Automation result' }}</small><p>{{ run.summary || (isZh ? '没有提供结果摘要。' : 'No result summary provided.') }}</p><small v-if="run.truncated">{{ isZh ? '摘要或依据已截断，可在任务中心查看完整记录。' : 'Summary or evidence shortened; open the task center for the full record.' }}</small><details v-if="run.evidence.length"><summary>{{ isZh ? '查看依据' : 'View evidence' }} · {{ run.evidence.length }}</summary><ul><li v-for="(evidence, index) in run.evidence" :key="index">{{ evidence }}</li></ul></details></article>
        </section>
      </template>
    </div>
    <footer v-if="task && canOpenCenter"><button type="button" :disabled="busy" data-automation-action="center" @click="openCenter">{{ isZh ? '在任务中心查看' : 'View in task center' }}<i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></button></footer>
  </aside>
</template>

<style scoped>
.oxc-automation-panel{width:360px;min-width:300px;max-width:42vw;display:flex;flex-direction:column;color:var(--ox-text-primary,#26313f);background:var(--ox-bg-surface,#fff);border-left:1px solid var(--ox-border,rgba(128,128,128,.2));height:100%;overflow:hidden;font-size:13px}
header,footer{padding:20px;display:flex;justify-content:space-between;gap:12px;flex-shrink:0}header{align-items:flex-start}h2{font-size:17px;line-height:1.5;margin:8px 0 0;overflow-wrap:anywhere}h3{font-size:13px;margin:0 0 12px}h3 span,time,.oxc-automation-panel__eyebrow,dt,small{opacity:.64}.oxc-automation-panel__eyebrow{display:flex;gap:7px;align-items:center;font-size:11px}.oxc-automation-panel__body{padding:0 20px 20px;overflow:auto;flex:1;min-height:0}section{margin-top:24px}.oxc-automation-panel__state{display:flex;justify-content:space-between;gap:12px;font-size:12px;padding:12px 0;border-bottom:1px solid rgba(128,128,128,.18)}.oxc-automation-panel__state span{opacity:.7}.oxc-automation-panel__prompt,p,dd,li{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.65}dl{display:grid;grid-template-columns:84px 1fr;gap:12px;margin:22px 0}dd{margin:0}.oxc-automation-panel__actions{display:flex;gap:8px}button{color:inherit;background:transparent;border:1px solid rgba(128,128,128,.24);border-radius:8px;padding:7px 10px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;font:inherit}button:hover{background:rgba(128,128,128,.09)}button:disabled{opacity:.5;cursor:default}header>button,.oxc-automation-panel__section-heading button{border:0}.oxc-automation-panel__section-heading{display:flex;align-items:center;justify-content:space-between}.oxc-automation-panel__section-heading h3{margin:0}.oxc-automation-run{padding:18px 0;border-bottom:1px solid rgba(128,128,128,.16)}.oxc-automation-run>div{display:flex;justify-content:space-between;gap:12px}.oxc-automation-run time{font-size:10px}.oxc-automation-run small{display:block;margin-top:8px;font-size:10px}.oxc-automation-run p{margin:6px 0 10px}.oxc-automation-run details{font-size:11px}.oxc-automation-run summary{cursor:pointer}.oxc-automation-run ul{padding-left:16px}.oxc-automation-panel__error{color:var(--ox-danger,#c84d55)}footer{border-top:1px solid rgba(128,128,128,.16)}footer button{width:100%;justify-content:space-between}@media(max-width:1050px){.oxc-automation-panel{position:absolute;right:0;top:0;bottom:0;z-index:55;max-width:min(92vw,400px);width:360px;box-shadow:-12px 0 40px rgba(0,0,0,.12)}}
</style>
