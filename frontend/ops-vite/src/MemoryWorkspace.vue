<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import MemoryLibrary from './MemoryLibrary.vue';
import { createMemoryDocumentRenderer } from './memory-document';

const props = defineProps({
  memory: { type: Object, default: () => ({}) },
  bridge: { type: Object, required: true },
  isZh: { type: Boolean, default: true },
  active: { type: Boolean, default: true },
});
const emit = defineEmits(['refresh']);
const view = ref('native');
const library = ref(null);
const context = ref({});
const query = ref('');
const error = ref('');
const busy = ref(false);
const renderDocument = createMemoryDocumentRenderer(window.markdownit);
const tr = (zh, en) => props.isZh ? zh : en;
const list = value => Array.isArray(value) ? value : [];
const sessions = computed(() => list(context.value.sessions).filter(item => matches(sessionTitle(item))));
const tasks = computed(() => list(context.value.tasks).filter(item => matches(taskTitle(item))));
const session = computed(() => context.value.session || {});
const task = computed(() => context.value.task || {});
const taskAvailable = computed(() => !!task.value.id && !!task.value.source);
const messages = computed(() => list(session.value.messages));
const events = computed(() => list(task.value.events));
const members = computed(() => list(task.value.members));
const evidence = computed(() => list(task.value.evidenceRefs));
const observations = computed(() => list(context.value.recall?.observations));
const currentLabel = computed(() => view.value === 'native'
  ? tr('原生记忆库', 'Native memory library')
  : view.value === 'session' ? tr('会话上下文', 'Session context') : tr('任务上下文', 'Task context'));
let timer;
let disposed = false;
let refreshGeneration = 0;
function matches(text) { return String(text || '').toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase()); }
function sessionTitle(item) { return item.title || (item.isCurrent || list(context.value.sessions).some(row => row.id === item.id && row.isCurrent) ? tr('当前会话', 'Current session') : tr('未命名会话', 'Untitled session')); }
function taskTitle(item) { return item.title || (item.source === 'incident' ? tr('未命名事件', 'Untitled incident') : tr('未命名任务', 'Untitled task')); }
function update() {
  if (disposed) return;
  if (props.bridge.contextWorkspace) context.value = props.bridge.contextWorkspace.snapshot();
}
async function refreshContext() {
  const generation = ++refreshGeneration;
  busy.value = true;
  error.value = '';
  try {
    if (!props.bridge.contextWorkspace) throw new Error(tr('上下文资料暂不可用，请稍后刷新。', 'Context is unavailable. Please refresh later.'));
    await props.bridge.contextWorkspace.refresh();
  } catch (reason) {
    if (!disposed && generation === refreshGeneration) error.value = String(reason?.message || tr('上下文读取失败', 'Could not read context'));
  } finally {
    if (!disposed && generation === refreshGeneration) { busy.value = false; update(); }
  }
}
async function selectView(next) {
  view.value = next;
  query.value = '';
  error.value = '';
  update();
  if (next !== 'native') {
    const state = context.value;
    if (next === 'session') props.bridge.contextWorkspace?.selectSession(state.scope?.sessionId || list(state.sessions).find(item => item.isCurrent)?.id || state.sessions?.[0]?.id || '');
    else props.bridge.contextWorkspace?.selectTask(state.scope?.taskId || state.tasks?.[0]?.id || '');
    update();
    await refreshContext();
  }
}
async function selectScope(kind, id) {
  error.value = '';
  const method = { session: 'selectSession', task: 'selectTask', agent: 'selectAgent' }[kind];
  props.bridge.contextWorkspace?.[method](id);
  update();
  await refreshContext();
}
function roleLabel(role) {
  const labels = { user: tr('用户', 'User'), assistant: tr('智能体', 'Assistant'), system: tr('系统指令', 'System'), developer: tr('开发指令', 'Developer'), tool: tr('工具结果', 'Tool'), function: tr('工具结果', 'Tool') };
  return labels[role] || role || tr('记录', 'Record');
}
function statusLabel(status) {
  const labels = { pending: ['待处理', 'Pending'], queued: ['排队中', 'Queued'], running: ['进行中', 'Running'], completed: ['已完成', 'Completed'], succeeded: ['已完成', 'Succeeded'], success: ['已完成', 'Succeeded'], resolved: ['已解决', 'Resolved'], failed: ['失败', 'Failed'], cancelled: ['已取消', 'Cancelled'], interrupted: ['已中断', 'Interrupted'], paused: ['已暂停', 'Paused'], waiting_approval: ['等待审批', 'Awaiting approval'], verifying: ['验证中', 'Verifying'] };
  const value = labels[String(status || '').toLowerCase()];
  return value ? tr(...value) : String(status || tr('未提供状态', 'Status unavailable'));
}
function timeLabel(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString(props.isZh ? 'zh-CN' : 'en-US') : '';
}
function openCreate() { view.value = 'native'; library.value?.openCreate(); }
async function refresh() {
  if (view.value !== 'native') return refreshContext();
  await props.bridge.loadSynapxnetMemories();
  emit('refresh');
}
defineExpose({ openCreate, refresh });
watch(() => props.active, active => { if (active) { update(); if (view.value !== 'native') refreshContext(); } });
onMounted(() => { update(); timer = window.setInterval(() => { if (props.active) update(); }, 1200); });
onBeforeUnmount(() => { disposed = true; window.clearInterval(timer); });
</script>

<template>
  <section class="ox-memory-workspace" :data-memory-view="view">
    <div class="ox-memory-workspace-navigation">
      <nav class="ox-memory-workspace-tabs" :aria-label="tr('记忆与上下文视图', 'Memory and context views')">
        <button type="button" data-memory-view-tab="native" :aria-pressed="view === 'native'" @click="selectView('native')"><i class="fa-solid fa-brain" aria-hidden="true"></i>{{ tr('原生记忆', 'Native memory') }}</button>
        <button type="button" data-memory-view-tab="session" :aria-pressed="view === 'session'" @click="selectView('session')"><i class="fa-regular fa-comments" aria-hidden="true"></i>{{ tr('会话上下文', 'Session context') }}</button>
        <button type="button" data-memory-view-tab="task" :aria-pressed="view === 'task'" @click="selectView('task')"><i class="fa-solid fa-diagram-project" aria-hidden="true"></i>{{ tr('任务上下文', 'Task context') }}</button>
      </nav>
      <span class="ox-memory-workspace-scope"><i class="fa-regular fa-folder-open" aria-hidden="true"></i>{{ context.workspace?.name ? `${tr('本地目录', 'Local directory')} · ${context.workspace.name}` : tr('当前工作区', 'Current workspace') }}</span>
    </div>
    <MemoryLibrary v-show="view === 'native'" ref="library" :memory="memory" :bridge="bridge" :is-zh="isZh" @refresh="emit('refresh')" />

    <div v-if="view !== 'native'" class="ox-context-workspace" :aria-busy="busy || context.loading">
      <div class="ox-context-toolbar">
        <div><strong>{{ currentLabel }}</strong><p>{{ view === 'session' ? tr('查看会话记录与续接资料，保留信息来源。', 'Inspect conversation records and recall material with their sources.') : tr('沿任务查看目标、角色、进展与证据。', 'Follow goals, roles, progress and evidence within each task.') }}</p></div>
        <div class="ox-context-toolbar-actions">
          <label v-if="view === 'task' && list(context.agents).length" class="ox-context-agent"><i class="fa-solid fa-user-gear" aria-hidden="true"></i><select data-context-agent :aria-label="tr('按智能体筛选进展记录', 'Filter progress by agent')" :value="context.scope?.agentId || ''" @change="selectScope('agent', $event.target.value)"><option value="">{{ tr('全部可见智能体', 'All visible agents') }}</option><option v-for="agent in context.agents" :key="agent.id" :value="agent.id">{{ agent.name }}</option></select></label>
          <button type="button" class="ox-context-button" :disabled="busy" @click="refreshContext"><i class="fa-solid fa-rotate-right" :class="{ 'fa-spin': busy }" aria-hidden="true"></i>{{ tr('刷新资料', 'Refresh') }}</button>
        </div>
      </div>
      <div v-if="error || context.error" class="ox-context-alert" role="alert"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>{{ error || context.error }}</div>
      <div class="ox-context-columns">
        <aside class="ox-context-list">
          <label class="ox-context-search"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><input v-model="query" type="search" :aria-label="tr('搜索上下文', 'Search context')" :placeholder="view === 'session' ? tr('搜索会话', 'Find a session') : tr('搜索任务与事件', 'Find a task or incident')" /></label>
          <div class="ox-context-list-heading"><span>{{ view === 'session' ? tr('会话记录', 'Conversations') : tr('任务与事件', 'Tasks and incidents') }}</span><span>{{ view === 'session' ? sessions.length : tasks.length }}</span></div>
          <div v-if="view === 'session'" class="ox-context-items">
            <button v-for="item in sessions" :key="item.id" type="button" :data-context-session-id="item.id" class="ox-context-item" :aria-pressed="session.id === item.id" @click="selectScope('session', item.id)"><span class="ox-context-item-icon"><i class="fa-regular fa-message" aria-hidden="true"></i></span><span><strong>{{ sessionTitle(item) }}</strong><small>{{ item.isCurrent ? tr('当前会话', 'Current session') : tr('已保存会话', 'Saved session') }}<template v-if="item.contentAvailable"> · {{ item.messageCount }} {{ tr('条记录', 'records') }}</template></small></span></button>
            <p v-if="!sessions.length" class="ox-context-list-empty">{{ query ? tr('没有匹配的会话', 'No matching session') : tr('开始一次对话后，会话会显示在这里。', 'Your conversations will appear here.') }}</p>
          </div>
          <div v-else class="ox-context-items">
            <button v-for="item in tasks" :key="item.id" type="button" :data-context-task-id="item.id" class="ox-context-item" :aria-pressed="task.id === item.id" @click="selectScope('task', item.id)"><span class="ox-context-item-icon"><i :class="item.source === 'incident' ? 'fa-solid fa-circle-nodes' : 'fa-solid fa-list-check'" aria-hidden="true"></i></span><span><strong>{{ taskTitle(item) }}</strong><small>{{ item.source === 'incident' ? tr('事件', 'Incident') : tr('任务', 'Task') }} · {{ statusLabel(item.status) }}</small></span></button>
            <p v-if="!tasks.length" class="ox-context-list-empty">{{ query ? tr('没有匹配的任务', 'No matching task') : tr('创建项目任务后，可在这里查看协作上下文。', 'Project tasks and their context will appear here.') }}</p>
          </div>
        </aside>
        <main v-if="view === 'session'" class="ox-context-detail" data-context-session-detail>
          <header class="ox-context-detail-heading"><div><span>{{ tr('会话资料', 'Conversation material') }}</span><h2>{{ session.id ? sessionTitle(session) : tr('选择一个会话', 'Select a session') }}</h2></div><span v-if="session.id" class="ox-context-badge">{{ messages.length }} {{ tr('条可见记录', 'visible records') }}</span></header>
          <div class="ox-context-boundary"><i class="fa-solid fa-layer-group" aria-hidden="true"></i><span>{{ tr('这里保留会话原始记录；本次模型输入的完整组成和用量尚未提供。', 'These are conversation records. The complete model input and usage are not yet available.') }}</span></div>
          <div v-if="session.error" class="ox-context-alert" role="alert">{{ session.error }}</div>
          <div v-if="messages.length" class="ox-context-messages">
            <article v-for="message in messages" :key="message.id" class="ox-context-message" :data-context-message-id="message.id"><div class="ox-context-message-meta"><span :data-message-role="message.role">{{ roleLabel(message.role) }}</span><time v-if="message.timestamp">{{ timeLabel(message.timestamp) }}</time></div><div v-if="String(message.content || '').trim()" class="ox-context-prose" v-html="renderDocument(message.content)"></div><p v-else class="ox-context-muted">{{ tr('此条记录没有提供文本正文。', 'This record does not provide text content.') }}</p></article>
          </div>
          <div v-else class="ox-context-empty"><i class="fa-regular fa-comments" aria-hidden="true"></i><strong>{{ session.availability === 'available' ? tr('这个会话还没有消息', 'This conversation has no messages yet') : tr('会话正文暂不可用', 'Conversation content is unavailable') }}</strong><p>{{ session.availability === 'available' ? tr('开始对话后，可以在这里回看原始记录。', 'Conversation records will appear here once you start chatting.') : tr('当前只读取到会话信息，可稍后刷新或选择其他会话。', 'Only session metadata is available. Refresh later or choose another session.') }}</p></div>
          <details v-if="observations.length" class="ox-context-disclosure"><summary>{{ tr('工作区续接资料', 'Workspace recall material') }} <span>{{ observations.length }}</span></summary><article v-for="(item, index) in observations" :key="item.id || index" class="ox-context-observation"><strong>{{ item.title || tr('工作记录', 'Work record') }}</strong><p>{{ item.summary }}</p><small>{{ item.source }} {{ timeLabel(item.timestamp) }}</small></article></details>
        </main>
        <main v-else class="ox-context-detail" data-context-task-detail>
          <header class="ox-context-detail-heading"><div><span>{{ task.source === 'incident' ? tr('事件上下文', 'Incident context') : tr('协作任务', 'Collaborative task') }}</span><h2>{{ taskAvailable ? taskTitle(task) : tr('选择一个任务', 'Select a task') }}</h2></div><span v-if="taskAvailable" class="ox-context-badge">{{ statusLabel(task.status) }}</span></header>
          <div v-if="task.error" class="ox-context-alert" role="alert">{{ task.error }}</div>
          <template v-if="taskAvailable">
            <p v-if="task.source === 'incident' && task.workspaceId" class="ox-context-muted">{{ tr('事件所属空间：', 'Incident workspace: ') }}{{ context.workspace?.enterpriseWorkspaceName || task.workspaceId }}<template v-if="context.workspace?.projectName"> · {{ context.workspace.projectName }}</template></p>
            <div v-if="task.detailAvailability === 'unavailable'" class="ox-context-boundary">{{ tr('当前可读取任务概要，详细执行记录暂不可用。', 'The task summary is available. Detailed execution records are currently unavailable.') }}</div>
            <section class="ox-context-goal"><h3>{{ tr('目标与任务摘要', 'Goal and task summary') }}</h3><div v-if="task.goal || task.summary" class="ox-context-prose" v-html="renderDocument([task.goal, task.summary].filter((value, index, array) => value && array.indexOf(value) === index).join('\n\n'))"></div><p v-else>{{ tr('该任务尚未提供目标摘要。', 'No goal summary has been provided.') }}</p></section>
            <section v-if="members.length" class="ox-context-members"><h3>{{ tr('参与角色', 'Participants') }}</h3><div><span v-for="member in members" :key="member.id" class="ox-context-member"><i class="fa-regular fa-user" aria-hidden="true"></i>{{ member.name || member.id }}<small v-if="member.role">{{ member.role }}</small></span></div></section>
            <section class="ox-context-trace"><div class="ox-context-section-heading"><h3>{{ tr('进展与交接记录', 'Progress and handoffs') }}</h3><span>{{ events.length }}</span></div><ol v-if="events.length"><li v-for="(event, index) in events" :key="event.id || index" :data-context-event-id="event.id"><div class="ox-context-trace-dot"></div><div><strong>{{ event.title || tr('任务记录', 'Task record') }}</strong><p v-if="event.summary">{{ event.summary }}</p><small>{{ event.agentId }}<template v-if="event.status"> · {{ statusLabel(event.status) }}</template><template v-if="event.timestamp"> · {{ timeLabel(event.timestamp) }}</template></small></div></li></ol><p v-else class="ox-context-muted">{{ tr('暂无可读取的进展记录。', 'No progress records are available.') }}</p></section>
            <details v-if="evidence.length" class="ox-context-disclosure"><summary>{{ tr('证据与来源', 'Evidence and sources') }} <span>{{ evidence.length }}</span></summary><article v-for="(item, index) in evidence" :key="item.id || index" class="ox-context-observation"><strong>{{ item.id }}</strong><p>{{ item.summary }}</p><small v-if="item.resourceVersion">{{ tr('资源版本', 'Resource version') }} {{ item.resourceVersion }}</small><small v-if="item.timestamp"> · {{ timeLabel(item.timestamp) }}</small></article></details>
            <details v-if="observations.length" class="ox-context-disclosure"><summary>{{ tr('任务续接资料', 'Task recall material') }} <span>{{ observations.length }}</span></summary><article v-for="(item, index) in observations" :key="item.id || index" class="ox-context-observation"><strong>{{ item.title || tr('工作记录', 'Work record') }}</strong><p>{{ item.summary }}</p><small>{{ item.source }} {{ timeLabel(item.timestamp) }}</small></article></details>
            <div class="ox-context-boundary"><i class="fa-solid fa-shield-halved" aria-hidden="true"></i><span>{{ tr('上下文沿用任务的权限与版本。工具授权、计划审批和执行状态由原任务流程管理。', 'Context follows task permissions and versions. Authorization, approval and execution remain in the task workflow.') }}</span></div>
          </template>
          <div v-else class="ox-context-empty"><i class="fa-solid fa-diagram-project" aria-hidden="true"></i><strong>{{ tr('从一个任务开始', 'Start with a task') }}</strong><p>{{ tr('日常项目与场景验证共享这套视图，按实际任务展示角色和证据。', 'Everyday projects and scenario validation share this view, using their actual participants and evidence.') }}</p></div>
        </main>
      </div>
    </div>
  </section>
</template>

<style scoped>
.ox-memory-workspace{display:flex;flex-direction:column;min-height:0;flex:1;gap:0;border:1px solid var(--ox-border);border-radius:var(--ox-radius-card,14px);background:var(--ox-skin-panel,var(--ox-bg-surface));overflow:hidden;color:var(--ox-text-primary)}
.ox-memory-workspace-navigation{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:8px 16px;border-bottom:1px solid var(--ox-border);background:color-mix(in srgb,var(--ox-bg-base) 45%,transparent);flex:none}
.ox-memory-workspace-tabs{display:flex;gap:5px;flex-wrap:wrap}.ox-memory-workspace-tabs button{display:flex;align-items:center;gap:7px;border:0;padding:10px 13px;border-radius:var(--ox-radius-sm,8px);background:transparent;color:var(--ox-text-secondary);font:inherit;font-size:13px;cursor:pointer}.ox-memory-workspace-tabs button[aria-pressed=true]{background:var(--ox-accent-soft);color:var(--ox-accent);font-weight:600}.ox-memory-workspace-scope{display:flex;align-items:center;gap:7px;color:var(--ox-text-muted);font-size:12px;max-width:35%;overflow-wrap:anywhere}
.ox-context-workspace{min-height:0;display:flex;flex-direction:column;flex:1}.ox-context-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 20px;flex-wrap:wrap;border-bottom:1px solid var(--ox-border);flex:none}.ox-context-toolbar strong{font-size:14px;font-weight:600}.ox-context-toolbar p{font-size:12px;color:var(--ox-text-secondary);margin:4px 0 0}.ox-context-toolbar-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.ox-context-button,.ox-context-agent{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--ox-border);border-radius:var(--ox-radius-sm,8px);padding:8px 11px;color:var(--ox-text-secondary);background:var(--ox-bg-surface);font:inherit;font-size:12px}.ox-context-button{cursor:pointer}.ox-context-button:disabled{opacity:.55;cursor:wait}.ox-context-agent{padding:5px 9px;max-width:230px}.ox-context-agent select{border:0;background:transparent;color:var(--ox-text-primary);font:inherit;max-width:190px;padding:4px;min-width:0}
.ox-context-columns{display:grid;grid-template-columns:minmax(200px,260px) minmax(0,1fr);min-height:0;flex:1}.ox-context-list{min-height:0;overflow:auto;background:color-mix(in srgb,var(--ox-bg-base) 42%,transparent);border-right:1px solid var(--ox-border);padding:14px 10px}.ox-context-search{display:flex;align-items:center;gap:8px;background:var(--ox-bg-surface);border:1px solid var(--ox-border);border-radius:var(--ox-radius-sm,8px);padding:0 10px;color:var(--ox-text-muted)}.ox-context-search input{background:transparent;border:0;color:var(--ox-text-primary);font:inherit;font-size:12px;padding:10px 0;min-width:0;width:100%}.ox-context-list-heading{display:flex;justify-content:space-between;color:var(--ox-text-muted);font-size:12px;padding:14px 6px 8px}.ox-context-items{display:flex;flex-direction:column;gap:5px}.ox-context-item{display:flex;align-items:flex-start;gap:10px;width:100%;padding:12px 10px;border:1px solid transparent;border-radius:var(--ox-radius-sm,8px);text-align:left;cursor:pointer;background:transparent;color:var(--ox-text-primary);font:inherit}.ox-context-item:hover{background:var(--ox-bg-surface-hover)}.ox-context-item[aria-pressed=true]{background:var(--ox-accent-soft);border-color:color-mix(in srgb,var(--ox-accent) 20%,transparent)}.ox-context-item>span:last-child{min-width:0}.ox-context-item strong{font-size:13px;font-weight:600;overflow-wrap:anywhere;display:block}.ox-context-item small{display:block;color:var(--ox-text-secondary);font-size:11px;margin-top:5px}.ox-context-item-icon{color:var(--ox-accent);padding-top:2px;flex:none}.ox-context-list-empty{font-size:12px;color:var(--ox-text-secondary);padding:20px 10px;line-height:1.8}
.ox-context-detail{min-width:0;min-height:0;overflow:auto;padding:24px 30px}.ox-context-detail-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap}.ox-context-detail-heading>div{min-width:0}.ox-context-detail-heading>div>span{font-size:11px;color:var(--ox-text-muted)}.ox-context-detail h2{font-size:21px;line-height:1.5;margin:4px 0 0;font-weight:650;overflow-wrap:anywhere}.ox-context-detail h3{font-size:13px;margin:0 0 10px;font-weight:600}.ox-context-badge{font-size:11px;color:var(--ox-accent);background:var(--ox-accent-soft);padding:4px 9px;border-radius:20px;white-space:nowrap}.ox-context-boundary{display:flex;align-items:flex-start;gap:9px;font-size:12px;line-height:1.7;color:var(--ox-text-secondary);padding:12px 14px;background:color-mix(in srgb,var(--ox-bg-base) 60%,transparent);border-radius:var(--ox-radius-sm,8px);margin:19px 0}.ox-context-boundary i{color:var(--ox-accent);margin-top:3px}.ox-context-message{padding:17px 0;border-bottom:1px solid var(--ox-border)}.ox-context-message-meta{display:flex;gap:12px;color:var(--ox-text-muted);font-size:11px;margin-bottom:8px}.ox-context-message-meta span{font-weight:600;color:var(--ox-accent)}.ox-context-message-meta span[data-message-role=user]{color:var(--ox-text-secondary)}.ox-context-prose{font-size:13px;line-height:1.8;overflow-wrap:anywhere}.ox-context-prose :deep(p){margin:0 0 10px}.ox-context-prose :deep(pre){white-space:pre-wrap;overflow-wrap:anywhere;background:var(--ox-bg-surface-hover);border:1px solid var(--ox-border);border-radius:var(--ox-radius-sm,8px);padding:12px}.ox-context-prose :deep(a){color:var(--ox-accent)}.ox-context-prose :deep(ul),.ox-context-prose :deep(ol){padding-left:20px}.ox-context-prose :deep(h1),.ox-context-prose :deep(h2),.ox-context-prose :deep(h3){font-size:15px;margin:16px 0 8px}.ox-context-prose :deep(table){display:block;max-width:100%;overflow:auto}.ox-context-prose :deep(img){max-width:100%}
.ox-context-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;min-height:260px;padding:30px;color:var(--ox-text-secondary)}.ox-context-empty>i{font-size:30px;color:var(--ox-accent);background:var(--ox-accent-soft);border-radius:var(--ox-radius-card,14px);padding:17px}.ox-context-empty strong{font-size:15px;font-weight:600;color:var(--ox-text-primary)}.ox-context-empty p{font-size:12px;line-height:1.8;margin:0;max-width:420px}.ox-context-alert{padding:12px 18px;background:color-mix(in srgb,var(--el-color-danger,#c74949) 9%,transparent);color:var(--ox-text-primary);font-size:12px;display:flex;gap:8px;overflow-wrap:anywhere}.ox-context-alert i{color:var(--el-color-danger,#c74949)}
.ox-context-goal{margin:24px 0}.ox-context-goal>p,.ox-context-muted{color:var(--ox-text-secondary);font-size:12px;line-height:1.8}.ox-context-members{padding:16px 0;border-top:1px solid var(--ox-border);border-bottom:1px solid var(--ox-border)}.ox-context-members>div{display:flex;gap:9px;flex-wrap:wrap}.ox-context-member{display:inline-flex;align-items:center;gap:7px;padding:7px 10px;border:1px solid var(--ox-border);border-radius:var(--ox-radius-sm,8px);font-size:12px}.ox-context-member i{color:var(--ox-accent)}.ox-context-member small{font-size:11px;color:var(--ox-text-muted)}.ox-context-trace{margin-top:22px}.ox-context-section-heading{display:flex;justify-content:space-between;gap:8px}.ox-context-section-heading>span{font-size:12px;color:var(--ox-text-muted)}.ox-context-trace ol{list-style:none;margin:8px 0;padding:0}.ox-context-trace li{display:grid;grid-template-columns:14px minmax(0,1fr);gap:10px;position:relative;padding:0 0 20px}.ox-context-trace li:not(:last-child)::before{content:'';position:absolute;left:4px;top:10px;bottom:0;width:1px;background:var(--ox-border)}.ox-context-trace-dot{width:9px;height:9px;border-radius:50%;background:var(--ox-accent);margin-top:5px}.ox-context-trace strong{font-size:13px;font-weight:600}.ox-context-trace p{font-size:12px;color:var(--ox-text-secondary);margin:5px 0;white-space:pre-wrap;overflow-wrap:anywhere}.ox-context-trace small{font-size:11px;color:var(--ox-text-muted);overflow-wrap:anywhere}.ox-context-disclosure{margin-top:18px;border-top:1px solid var(--ox-border);padding-top:13px}.ox-context-disclosure summary{font-size:13px;cursor:pointer;font-weight:600}.ox-context-disclosure summary>span{color:var(--ox-text-muted);margin-left:8px;font-size:12px}.ox-context-observation{padding:13px 0;border-bottom:1px solid var(--ox-border);overflow-wrap:anywhere}.ox-context-observation strong{font-size:12px;font-weight:600}.ox-context-observation p{font-size:12px;line-height:1.7;color:var(--ox-text-secondary);margin:6px 0;white-space:pre-wrap}.ox-context-observation small{color:var(--ox-text-muted);font-size:11px}
.ox-memory-workspace-navigation{padding:calc(8px * var(--ox-density,1)) calc(16px * var(--ox-density,1))}.ox-memory-workspace-tabs button{padding:calc(10px * var(--ox-density,1)) calc(13px * var(--ox-density,1))}.ox-context-toolbar{padding:calc(18px * var(--ox-density,1)) calc(20px * var(--ox-density,1))}.ox-context-item{padding:calc(12px * var(--ox-density,1)) calc(10px * var(--ox-density,1))}.ox-context-detail{padding:calc(24px * var(--ox-density,1)) calc(30px * var(--ox-density,1))}.ox-context-message{padding:calc(17px * var(--ox-density,1)) 0}.ox-context-member{padding:calc(7px * var(--ox-density,1)) calc(10px * var(--ox-density,1))}.ox-context-toolbar-actions{gap:calc(8px * var(--ox-density,1))}.ox-memory-workspace button:focus-visible,.ox-memory-workspace select:focus-visible,.ox-memory-workspace summary:focus-visible{outline:2px solid var(--ox-accent);outline-offset:2px}
@media(min-width:1360px) and (min-height:740px){.ox-memory-workspace{min-height:0}.ox-context-columns{overflow:hidden}}
@media(max-width:1359px),(max-height:739px){.ox-memory-workspace{flex:0 0 auto}.ox-context-list{max-height:650px}.ox-context-detail{max-height:750px}.ox-context-columns{min-height:400px}}
@media(max-width:820px){.ox-memory-workspace-navigation{padding:8px;gap:8px}.ox-memory-workspace-tabs{gap:0}.ox-memory-workspace-tabs button{padding:9px;font-size:12px}.ox-memory-workspace-scope{max-width:100%;padding:0 8px 5px}.ox-context-toolbar{padding:calc(14px * var(--ox-density,1));gap:12px}.ox-context-columns{grid-template-columns:1fr}.ox-context-list{border-right:0;border-bottom:1px solid var(--ox-border);max-height:235px}.ox-context-detail{padding:calc(18px * var(--ox-density,1));max-height:650px;min-height:330px}.ox-context-toolbar-actions{width:100%}.ox-context-agent{flex:1;max-width:none}.ox-context-agent select{width:100%;max-width:none}.ox-context-detail h2{font-size:18px}}
</style>
