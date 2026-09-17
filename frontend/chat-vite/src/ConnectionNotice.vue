<!--
Copyright (C) 2026 Synapxnet. All rights reserved.
This file is Synapxnet Proprietary and Confidential. It is strictly
forbidden to copy, distribute, or use without explicit authorization.
会话连接状态与受控恢复提示 / Conversation connection and controlled recovery notice.
Author: maoyo | Department: 研发部 | Date: 2026-09-14
Version: 1.0.0 | Security Level: INTERNAL
__version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
__maintainer__: maoyo | __email__: synapxnet@gmail.com
-->
<script setup>
import { computed } from 'vue';
const props = defineProps({ state: { type: Object, required: true }, isZh: { type: Boolean, default: true }, busy: Boolean, continuing: Boolean, actionError: { type: String, default: '' } });
const emit = defineEmits(['check', 'continue']);
/** 标题仅描述实际回执；在线信号不代表服务健康。 / Titles describe actual receipts; device connectivity never proves service health. */
const title = computed(() => {
  const value = props.state; const zh = props.isZh;
  if (value.state === 'checking') {
    const count = Number.isInteger(value.attempt) && Number.isInteger(value.maxAttempts) && value.attempt > 0 && value.attempt <= value.maxAttempts && value.maxAttempts <= 5 ? ` ${value.attempt}/${value.maxAttempts}` : '';
    return (zh ? '正在检查会话状态' : 'Checking conversation state') + count;
  }
  if (value.state === 'offline') return zh ? '设备网络已离线' : 'Device is offline';
  if (value.state === 'reachable') return zh ? '应用服务可达' : 'Application service is reachable';
  if (value.state === 'failed') return zh ? '会话状态检查未成功' : 'Conversation state check failed';
  if (value.httpStatus === 401 || value.httpStatus === 403 || value.kind === 'auth') return zh ? '服务认证未通过' : 'Service authentication failed';
  if (value.httpStatus === 429) return zh ? '请求暂时受到限制' : 'Requests are temporarily limited';
  if (value.kind === 'quota') return zh ? '当前服务额度不足' : 'Service quota is insufficient';
  if ([502, 503, 504].includes(value.httpStatus)) return zh ? '服务暂时不可用' : 'Service is temporarily unavailable';
  if (value.kind === 'timeout') return zh ? '等待响应超时' : 'The response timed out';
  return zh ? '连接中断，当前进度已保留' : 'Connection interrupted; progress is retained';
});
/** 提示保留进度与执行状态边界，不声称旧响应流自动续接。 / Explain retained progress without claiming the original stream resumed. */
const description = computed(() => {
  if (props.state.state === 'checking') return props.isZh ? '正在核对原执行状态，已有内容会保留。' : 'Checking the original execution state; existing content is retained.';
  if (props.state.message) return props.state.message;
  if (props.state.state === 'reachable') return props.isZh ? '状态检查已收到响应，原回复尚未继续。' : 'The state check received a response. The original reply has not continued.';
  if (props.state.state === 'offline') return props.isZh ? '连接网络后可以检查会话状态。' : 'Check the conversation state after connecting to a network.';
  return props.isZh ? '已有内容会保留，可检查会话状态后再继续。' : 'Existing content is retained. Check the conversation state before continuing.';
});
/** 详情已包含同一HTTP状态时只展示一次，保留原因。 / Show an HTTP status only once when the detail already contains it, retaining its reason. */
const detailContainsStatus = computed(() => Number.isInteger(props.state.httpStatus) && new RegExp(`\\bHTTP\\s+${props.state.httpStatus}\\b`, 'i').test(String(props.state.detail || '')));
/** 两个动作共用所属范围与忙碌锁，事件携带点击时的范围。 / Both actions share the busy lock and emit their scope at click time. */
function act(action) {
  if (props.busy || props.continuing || props.state.state === 'checking' || (action === 'check' ? !props.state.canCheck : !props.state.canContinue)) return;
  emit(action, { conversationId: props.state.conversationId, requestId: props.state.requestId, workspacePath: props.state.workspacePath });
}
</script>

<template>
  <section class="oxc-connection-notice" :class="`is-${state.state}`" :data-connection-state="state.state" :data-connection-request="state.requestId" :aria-busy="busy || continuing || state.state === 'checking'" :aria-label="isZh ? '会话连接状态' : 'Conversation connection state'">
    <div class="oxc-connection-notice__heading" role="status" aria-live="polite"><i :class="state.state === 'checking' ? 'fa-solid fa-spinner fa-spin' : state.state === 'reachable' ? 'fa-solid fa-circle-check' : 'fa-solid fa-link-slash'" aria-hidden="true"></i><strong>{{ title }}</strong></div>
    <p class="oxc-connection-notice__description">{{ description }}</p>
    <p v-if="state.continueReason" class="oxc-connection-notice__reason">{{ state.continueReason }}</p>
    <p v-if="actionError" class="oxc-connection-notice__error" role="alert">{{ actionError }}</p>
    <div class="oxc-connection-notice__footer">
      <details v-if="state.detail || state.httpStatus" class="oxc-connection-notice__details"><summary>{{ isZh ? '查看详情' : 'View details' }}</summary><p v-if="state.httpStatus && !detailContainsStatus" class="oxc-connection-notice__http">HTTP {{ state.httpStatus }}</p><p v-if="state.detail">{{ state.detail }}</p></details>
      <div class="oxc-connection-notice__actions">
        <button v-if="state.canCheck || busy" type="button" data-connection-action="check" :disabled="busy || continuing || state.state === 'checking'" @click="act('check')">{{ busy ? (isZh ? '正在检查' : 'Checking') : state.state === 'failed' ? (isZh ? '重新检查' : 'Check again') : (isZh ? '检查会话状态' : 'Check conversation state') }}</button>
        <button v-if="state.canContinue || continuing" type="button" class="is-primary" data-connection-action="continue" :disabled="busy || continuing || state.state === 'checking'" @click="act('continue')">{{ continuing ? (isZh ? '正在核对' : 'Verifying') : (isZh ? '继续会话' : 'Continue conversation') }}</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.oxc-connection-notice{box-sizing:border-box;max-width:100%;min-width:0;margin:16px 0 8px;padding:13px 15px;border:1px solid var(--ox-border,#dde6ed);border-left:3px solid var(--ox-accent,#168abb);border-radius:var(--ox-radius-md,12px);background:var(--ox-bg-surface,#fff);color:var(--ox-text-primary,#26313f);font-size:12px;line-height:1.6}
.oxc-connection-notice__heading{display:flex;align-items:center;gap:9px}.oxc-connection-notice__heading i{color:var(--ox-accent,#168abb)}.oxc-connection-notice__heading strong{font-size:12px;font-weight:600;overflow-wrap:anywhere}
.oxc-connection-notice p{margin:5px 0 0;overflow-wrap:anywhere;white-space:pre-wrap}.oxc-connection-notice__description,.oxc-connection-notice__reason{color:var(--ox-text-secondary,#63778d)}.oxc-connection-notice__reason{font-size:11px}.oxc-connection-notice__error{color:var(--ox-danger,#c84d55)}
.oxc-connection-notice__footer{display:flex;flex-wrap:wrap;align-items:flex-start;gap:9px 16px;margin-top:10px}.oxc-connection-notice__details{flex:1 1 150px;min-width:0;color:var(--ox-text-secondary,#63778d);font-size:11px}.oxc-connection-notice__details summary{cursor:pointer;line-height:30px}.oxc-connection-notice__details p{max-height:160px;overflow:auto;overscroll-behavior:contain}.oxc-connection-notice__http{font-family:ui-monospace,monospace}
.oxc-connection-notice__actions{display:flex;flex-wrap:wrap;gap:7px;margin-left:auto}.oxc-connection-notice button{min-height:32px;padding:5px 10px;border:1px solid var(--ox-border,#dde6ed);border-radius:var(--ox-radius-sm,8px);background:transparent;color:var(--ox-text-secondary,#63778d);font:inherit;cursor:pointer}.oxc-connection-notice button.is-primary{background:var(--ox-accent-soft,#e5f4fb);border-color:transparent;color:var(--ox-accent,#168abb)}.oxc-connection-notice button:hover:not(:disabled){border-color:var(--ox-accent,#168abb)}.oxc-connection-notice button:disabled{opacity:.55;cursor:default}.oxc-connection-notice button:focus-visible,.oxc-connection-notice summary:focus-visible{outline:2px solid var(--ox-accent,#168abb);outline-offset:3px}
@media(max-width:560px){.oxc-connection-notice{padding:12px}.oxc-connection-notice__footer{gap:6px}.oxc-connection-notice__actions{margin-left:0;flex-basis:100%}.oxc-connection-notice button{min-height:36px}}
@media(prefers-reduced-motion:reduce){.oxc-connection-notice .fa-spin{animation:none!important}}
</style>
