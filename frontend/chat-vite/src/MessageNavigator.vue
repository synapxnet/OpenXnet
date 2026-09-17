<!--
Copyright (C) 2026 Synapxnet. All rights reserved.
This file is Synapxnet Proprietary and Confidential. It is strictly
forbidden to copy, distribute, or use without explicit authorization.
会话刻度与消息定位 / Conversation ticks and message navigation.
Author: maoyo | Department: 研发部 | Date: 2026-09-14
Version: 1.0.0 | Security Level: INTERNAL
__version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
__maintainer__: maoyo | __email__: synapxnet@gmail.com
-->
<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import '../../../static/js/openxnet-conversation-model.js';

const props = defineProps({ messages: { type: Array, default: () => [] }, activeId: { type: String, default: '' }, isZh: { type: Boolean, default: true } });
const emit = defineEmits(['navigate']);
const expanded = ref(false);
const toggleRef = ref(null);
const navRef = ref(null);
const previewRef = ref(null);
const hoveredId = ref('');
const focusedId = ref('');
const previewTop = ref(0);
const previewWidth = ref(320);
let hoverTimer = null;
const panelId = `message-navigation-${useId()}`;
const previewId = `${panelId}-preview`;
/** 仅按稳定消息 ID 构建导航。 / Build navigation from stable message IDs only. */
const turns = computed(() => globalThis.OpenXnetConversationModel.buildMessageNavigation(props.messages, { isZh: props.isZh }));
/** 仅显示当前悬停或聚焦轮次的安全摘要。 / Show safe summaries for the currently hovered or focused turn only. */
const previewTurn = computed(() => expanded.value ? null : turns.value.find((turn) => turn.id === (hoveredId.value || focusedId.value)));
/** 显式作用域变化或首轮替换时清理浮层。 / Clear overlays when explicit scope or the first turn changes. */
watch(() => {
  const first = props.messages[0] || {};
  return JSON.stringify([turns.value[0]?.id, first.conversationId || first.conversation_id || first.scope?.conversationId, first.workspaceId || first.workspace_id || first.scope?.workspaceId, first.projectId || first.project_id || first.scope?.projectId]);
}, () => { expanded.value = false; dismissPreview(); });
/** 只在导航内容变化后同步刻度自身的滚动位置。 / Synchronize the tick list's own scroll position after navigation changes only. */
watch(() => [props.activeId, turns.value.length, expanded.value], keepCurrentTickVisible, { flush: 'post' });
/** 挂载时显示当前刻度，窗口缩放时清除过时的浮层坐标。 / Reveal the current tick on mount and clear stale overlay geometry on window resize. */
onMounted(() => { keepCurrentTickVisible(); globalThis.addEventListener?.('resize', dismissPreview); });
/** 卸载后不保留延迟任务或窗口监听。 / Do not retain delayed tasks or window listeners after unmount. */
onBeforeUnmount(() => { clearTimeout(hoverTimer); globalThis.removeEventListener?.('resize', dismissPreview); });

/** 长会话仅滚动刻度列表，不推动正文或父容器。 / Scroll only the tick list in long conversations without moving messages or ancestor containers. */
function keepCurrentTickVisible() {
  const list = navRef.value?.querySelector?.('.oxc-turn-nav__ticks');
  if (!list) return;
  /** 使用属性值比较避免将消息 ID 插入选择器。 / Compare attribute values without interpolating message IDs into selectors. */
  const tick = [...list.querySelectorAll('button[data-turn-id]')].find((button) => button.getAttribute('data-turn-id') === props.activeId);
  if (!tick) return;
  const bounds = list.getBoundingClientRect();
  const item = tick.getBoundingClientRect();
  if (item.top < bounds.top) list.scrollTop += item.top - bounds.top;
  else if (item.bottom > bounds.bottom) list.scrollTop += item.bottom - bounds.bottom;
}

/** 清理悬停与键盘预览。 / Clear hover and keyboard previews. */
function dismissPreview() {
  clearTimeout(hoverTimer);
  hoveredId.value = '';
  focusedId.value = '';
}
/** 给指针进入右侧预览留出短暂间隙。 / Allow a brief gap while the pointer enters the preview on the right. */
function leaveNavigation() {
  clearTimeout(hoverTimer);
  hoverTimer = setTimeout(() => { hoveredId.value = ''; }, 100);
}
/** 指针进入导航或预览后取消延迟关闭。 / Cancel delayed dismissal when the pointer enters the navigation or preview. */
function retainHover() { clearTimeout(hoverTimer); }
/** 将预览限制在可用正文区域，避免底部和窄窗口越界。 / Constrain previews to the reading area without bottom or narrow-window overflow. */
async function showPreview(id, event, keyboard = false) {
  retainHover();
  if (keyboard) focusedId.value = id; else hoveredId.value = id;
  const anchor = event?.currentTarget?.getBoundingClientRect?.();
  await nextTick();
  if (previewTurn.value?.id !== id) return;
  const rail = navRef.value?.getBoundingClientRect?.();
  if (!rail) return;
  const boundary = navRef.value?.parentElement?.getBoundingClientRect?.();
  const right = Math.min(boundary?.right ?? Infinity, globalThis.innerWidth || Infinity);
  previewWidth.value = Number.isFinite(right) ? Math.max(80, Math.min(320, right - rail.left - 50)) : 320;
  const height = previewRef.value?.getBoundingClientRect?.()?.height || 240;
  const anchorCenter = anchor ? anchor.top - rail.top + anchor.height / 2 : 0;
  previewTop.value = Math.max(0, Math.min(Math.max(0, rail.height - height), anchorCenter - height / 2));
}
/** 失焦后清除键盘预览，但保留仍在悬停的内容。 / Clear the keyboard preview on blur while preserving hovered content. */
function blurTurn(id) { if (focusedId.value === id) focusedId.value = ''; }
/** 切换目录时清理已有预览。 / Clear existing previews when toggling the outline. */
function toggleOutline() { dismissPreview(); expanded.value = !expanded.value; }

/** 淡出开始即禁用浮层交互，避免旧目录参与键盘定位。 / Disable overlay interaction as fading starts so the old outline cannot receive keyboard navigation. */
function retireOverlay(element) {
  element.inert = true;
  element.setAttribute?.('aria-hidden', 'true');
}
/** 快速重新打开时恢复浮层交互与可访问性。 / Restore interaction and accessibility when an overlay is reopened quickly. */
function activateOverlay(element) {
  element.inert = false;
  element.removeAttribute?.('aria-hidden');
}

/** 将定位目标交给拥有滚动容器的父级。 / Delegate navigation to the parent that owns scrolling. */
function navigate(id) {
  dismissPreview();
  expanded.value = false;
  emit('navigate', id);
}
/** 支持方向键、首尾键和 Escape。 / Support arrow keys, Home, End and Escape. */
function handleKeydown(event) {
  if (event.key === 'Escape') {
    expanded.value = false;
    dismissPreview();
    toggleRef.value?.focus();
    event.stopPropagation();
    event.preventDefault();
    return;
  }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  /** 排除正在淡出的不可交互浮层。 / Exclude noninteractive overlays that are fading out. */
  const buttons = [...event.currentTarget.querySelectorAll('button[data-turn-id]')].filter((button) => !button.closest?.('[inert]'));
  if (!buttons.length) return;
  const current = buttons.indexOf(event.target);
  let next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : current + (event.key === 'ArrowDown' ? 1 : -1);
  next = Math.max(0, Math.min(buttons.length - 1, next));
  buttons[next].focus();
  event.preventDefault();
}
</script>

<template>
  <nav v-if="turns.length" ref="navRef" class="oxc-turn-nav" :aria-label="isZh ? '消息定位' : 'Message navigation'" @keydown="handleKeydown" @pointerenter="retainHover" @pointerleave="leaveNavigation">
    <button ref="toggleRef" class="oxc-turn-nav__toggle" type="button" :aria-expanded="expanded" :aria-controls="panelId" :aria-label="isZh ? (expanded ? '收起消息目录' : '打开消息目录') : (expanded ? 'Close conversation outline' : 'Open conversation outline')" :title="isZh ? '消息定位' : 'Message navigation'" @click="toggleOutline">
      <i :class="expanded ? 'fa-solid fa-xmark' : 'fa-solid fa-list-ul'" aria-hidden="true"></i>
    </button>
    <ol v-if="!expanded" class="oxc-turn-nav__ticks">
      <li v-for="turn in turns" :key="turn.id">
        <button type="button" :data-turn-id="turn.id" class="oxc-turn-nav__tick" :class="{ 'is-current': turn.id === activeId }" :aria-current="turn.id === activeId ? 'location' : undefined" :aria-label="`${turn.ordinal}. ${turn.summary}`" :aria-describedby="previewTurn?.id === turn.id ? previewId : undefined" @pointerenter="showPreview(turn.id, $event)" @focus="showPreview(turn.id, $event, true)" @blur="blurTurn(turn.id)" @click="navigate(turn.id)"><span aria-hidden="true"></span></button>
      </li>
    </ol>
    <Transition name="oxc-turn-overlay" @before-enter="activateOverlay" @before-leave="retireOverlay">
      <div v-if="expanded" :id="panelId" class="oxc-turn-nav__panel">
        <div class="oxc-turn-nav__heading"><strong>{{ isZh ? '对话目录' : 'Conversation outline' }}</strong><span>{{ turns.length }}</span></div>
        <ol class="oxc-turn-nav__summaries">
          <li v-for="turn in turns" :key="turn.id">
            <button type="button" :data-turn-id="turn.id" :class="{ 'is-current': turn.id === activeId }" :aria-current="turn.id === activeId ? 'location' : undefined" @click="navigate(turn.id)"><span class="oxc-turn-nav__number">{{ turn.ordinal }}</span><span>{{ turn.summary }}</span></button>
          </li>
        </ol>
      </div>
    </Transition>
    <Transition name="oxc-turn-overlay" @before-enter="activateOverlay" @before-leave="retireOverlay">
      <aside v-if="previewTurn" :id="previewId" ref="previewRef" class="oxc-turn-nav__preview" role="tooltip" :style="{ top: `${previewTop}px`, width: `${previewWidth}px` }" @pointerenter="retainHover">
        <div class="oxc-turn-nav__preview-heading"><span>{{ isZh ? '对话' : 'Turn' }} {{ previewTurn.ordinal }}</span><span>{{ previewTurn.ordinal }} / {{ turns.length }}</span></div>
        <p class="oxc-turn-nav__question">{{ previewTurn.summary }}</p>
        <div class="oxc-turn-nav__reply-label">{{ isZh ? '回复预览' : 'Reply preview' }}</div>
        <p class="oxc-turn-nav__reply" :class="{ 'is-empty': !previewTurn.replyPreview }">{{ previewTurn.replyPreview || (isZh ? '暂无可预览的回复' : 'No reply to preview yet') }}</p>
      </aside>
    </Transition>
  </nav>
</template>

<style scoped>
.oxc-turn-nav { position: absolute; z-index: 16; left: 4px; top: 18px; bottom: max(12px, calc(var(--oxc-composer-space, 150px) - 12px)); display: flex; flex-direction: column; width: 32px; min-height: 0; color: var(--ox-text-secondary, #68798c); font-size: 12px; }
.oxc-turn-nav button { box-sizing: border-box; font: inherit; color: inherit; border: 0; padding: 0; cursor: pointer; touch-action: manipulation; }
.oxc-turn-nav button:focus-visible { outline: 2px solid var(--ox-accent, #2494be); outline-offset: -2px; }
.oxc-turn-nav__toggle { display: grid; place-items: center; width: 32px; height: 32px; flex: 0 0 32px; margin-bottom: 8px; background: transparent; border-radius: var(--ox-radius-sm, 10px); opacity: .7; transition: opacity 140ms ease, color 140ms ease, background-color 140ms ease; }
.oxc-turn-nav__toggle:hover, .oxc-turn-nav__toggle:focus-visible { opacity: 1; color: var(--ox-accent, #2494be); background: var(--ox-accent-soft, #2494be12); }
.oxc-turn-nav ol { list-style: none; margin: 0; padding: 0; }
.oxc-turn-nav__ticks { position: relative; display: flex; flex-direction: column; flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; scrollbar-width: none !important; }
#app .ox-vite-chat-shell .oxc-turn-nav .oxc-turn-nav__ticks { scrollbar-width: none !important; }
#app .ox-vite-chat-shell .oxc-turn-nav .oxc-turn-nav__ticks::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
.oxc-turn-nav__ticks li { display: flex; flex: 1 0 8px; min-height: 8px; }
.oxc-turn-nav__tick { display: grid; place-items: center; width: 32px; min-height: 8px; flex: 1; background: transparent; border-radius: 5px; }
.oxc-turn-nav__tick span { width: 10px; height: 1.5px; background: color-mix(in srgb, var(--ox-border-strong, #bac7d3) 70%, transparent); border-radius: 2px; transition: width 180ms cubic-bezier(.22, 1, .36, 1), height 160ms cubic-bezier(.22, 1, .36, 1), background-color 140ms ease, box-shadow 160ms ease; }
.oxc-turn-nav__tick:hover span, .oxc-turn-nav__tick:focus-visible span { width: 20px; background: var(--ox-accent, #2494be); }
.oxc-turn-nav__tick.is-current span { width: 26px; height: 3px; background: var(--ox-accent, #2494be); box-shadow: 0 0 0 4px var(--ox-accent-soft, #e5f4fb); }
.oxc-turn-nav__panel, .oxc-turn-nav__preview { box-sizing: border-box; position: absolute; z-index: 45; left: 40px; max-height: 100%; border: 1px solid var(--ox-border, #dce4eb); border-radius: var(--ox-radius, 14px); background: var(--ox-bg-surface, #fff); box-shadow: 0 12px 40px #1023381c; }
.oxc-turn-nav__panel { top: 0; display: flex; flex-direction: column; width: min(280px, calc(100vw - 110px)); padding: 8px; }
.oxc-turn-nav__heading { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px 12px; color: var(--ox-text-primary, #243548); }
.oxc-turn-nav__heading span { color: var(--ox-text-secondary, #68798c); font-variant-numeric: tabular-nums; }
.oxc-turn-nav__summaries { min-height: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; }
.oxc-turn-nav__summaries button { display: flex; align-items: baseline; gap: 10px; width: 100%; min-height: 44px; padding: 10px; text-align: left; background: transparent; border-radius: 8px; line-height: 1.55; overflow-wrap: anywhere; }
.oxc-turn-nav__summaries button:hover, .oxc-turn-nav__summaries button.is-current { color: var(--ox-accent, #2494be); background: var(--ox-accent-soft, #2494be12); }
.oxc-turn-nav__number { flex: 0 0 20px; font-size: 11px; font-variant-numeric: tabular-nums; opacity: .7; }
.oxc-turn-nav__preview { padding: 14px 16px; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; pointer-events: auto; }
.oxc-turn-nav__preview-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; color: var(--ox-text-muted, #8192a2); font-size: 10px; font-variant-numeric: tabular-nums; }
.oxc-turn-nav__preview p { display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden; margin: 0; overflow-wrap: anywhere; white-space: normal; }
.oxc-turn-nav__question { -webkit-line-clamp: 3; color: var(--ox-text-primary, #243548); font-size: 13px; line-height: 1.65; font-weight: 550; }
.oxc-turn-nav__reply-label { margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--ox-border, #dce4eb); color: var(--ox-text-muted, #8192a2); font-size: 10px; }
.oxc-turn-nav__reply { -webkit-line-clamp: 5; padding-top: 5px; line-height: 1.7; }
.oxc-turn-nav__reply.is-empty { color: var(--ox-text-muted, #8192a2); }
.oxc-turn-overlay-enter-active { transition: opacity 160ms ease-out, transform 160ms cubic-bezier(.22, 1, .36, 1); }
.oxc-turn-overlay-leave-active { transition: opacity 110ms ease-in, transform 110ms ease-in; pointer-events: none; }
.oxc-turn-overlay-enter-from { opacity: 0; transform: translateX(-4px); }
.oxc-turn-overlay-leave-to { opacity: 0; transform: translateX(-2px); }
@media (max-width: 680px) { .oxc-turn-nav { left: 0; top: 12px; width: 28px; } .oxc-turn-nav__tick, .oxc-turn-nav__toggle { width: 28px; } .oxc-turn-nav__tick.is-current span { width: 22px; } .oxc-turn-nav__panel, .oxc-turn-nav__preview { left: 34px; } }
@media (pointer: coarse) { .oxc-turn-nav__toggle { min-height: 44px; flex-basis: 44px; } .oxc-turn-nav__ticks li { flex-basis: 28px; min-height: 28px; } .oxc-turn-nav__tick { min-height: 28px; } }
@media (prefers-reduced-motion: reduce) {
  .oxc-turn-nav__tick span, .oxc-turn-nav__toggle, .oxc-turn-overlay-enter-active, .oxc-turn-overlay-leave-active { transition: none !important; }
  .oxc-turn-overlay-enter-from, .oxc-turn-overlay-leave-to { transform: none !important; opacity: 1; }
}
</style>
