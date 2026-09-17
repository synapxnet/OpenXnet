<!--
Copyright (C) 2026 Synapxnet. All rights reserved.
This file is Synapxnet Proprietary and Confidential. It is strictly
forbidden to copy, distribute, or use without explicit authorization.
用途：技能能力、来源与范围详情。 Purpose: Skill capability, provenance and scope details.
Author: maoyo | Department: 研发部 | Date: 2026-09-14
Version: 1.0.0 | Security Level: INTERNAL
__version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
__maintainer__: maoyo | __email__: synapxnet@gmail.com
-->
<script setup>
import { computed, ref } from 'vue';
import { createTaskStarter, metadataLabel } from './skillsModel.js';
const props = defineProps({ skill: { type: Object, required: true }, preview: { type: Object, required: true }, isZh: Boolean, workspacePath: String, employees: { type: Array, default: () => [] }, busy: Boolean });
const emit = defineEmits(['close', 'manage', 'preview', 'enterprise']);
const tab = ref('overview');
const starter = ref(createTaskStarter(props.skill, props.isZh));
const copyStatus = ref('');
/** 只统计明确绑定包 ID 的员工。 Select employees with explicit package ID bindings only. */
const relatedEmployees = computed(() => props.employees.filter((employee) => employee.skillIds.includes(props.skill.id)));
/** 复制可编辑起手式，不发送或运行任务。 Copy the editable starter without sending or executing a task. */
async function copyStarter() {
  try { await navigator.clipboard.writeText(starter.value); copyStatus.value = props.isZh ? '已复制，可粘贴到任务草稿。' : 'Copied. Paste into a task draft.'; }
  catch { copyStatus.value = props.isZh ? '未能访问剪贴板，请选中文本后复制。' : 'Clipboard unavailable. Select and copy the text.'; }
}
/** 选择明确内容来源；不从失败来源静默回退。 Select an explicit content source without a silent fallback. */
function changeSource(event) { emit('preview', props.skill.id, event.target.value); }
</script>
<template>
  <aside class="oxsk-detail" :aria-label="isZh ? '技能详情' : 'Skill detail'">
    <header class="oxsk-detail-heading"><span class="oxsk-icon" :data-group="skill.group"><i :class="skill.icon"></i></span><div><span class="oxsk-eyebrow">{{ isZh ? '能力详情' : 'CAPABILITY DETAIL' }}</span><h2>{{ skill.name }}</h2></div><button class="oxsk-icon-button" :aria-label="isZh ? '关闭详情' : 'Close detail'" @click="emit('close')"><i class="fa-solid fa-xmark"></i></button></header>
    <code class="oxsk-detail-id">{{ skill.id }}</code>
    <p class="oxsk-detail-origin">{{ preview.source === 'project' ? (isZh ? '当前工作区副本' : 'Workspace copy') : (isZh ? '本机全局副本' : 'Global copy') }}<span v-if="skill.version"> · v{{ skill.version }}</span></p>
    <p v-if="skill.sourceMetadataUnavailable" class="oxsk-hint">{{ isZh ? '当前来源的元数据不可用，请刷新目录。' : 'Metadata for this source is unavailable. Refresh the catalog.' }}</p>
    <div class="oxsk-detail-tabs"><button :class="{ 'is-active': tab === 'overview' }" @click="tab = 'overview'">{{ isZh ? '能力与范围' : 'Capability & scope' }}</button><button :class="{ 'is-active': tab === 'source' }" @click="tab = 'source'">{{ isZh ? '原始说明' : 'Source guide' }}</button></div>
    <template v-if="tab === 'overview'">
      <section class="oxsk-detail-section"><h3>{{ isZh ? '适合做什么' : 'What it helps with' }}</h3><p>{{ skill.previewSummary || (isZh ? '当前技能没有提供用途说明。' : 'This skill has no purpose description.') }}</p><ul v-if="skill.previewHighlights.length" class="oxsk-highlights"><li v-for="highlight in skill.previewHighlights" :key="highlight"><i class="fa-solid fa-check"></i>{{ highlight }}</li></ul><div v-if="skill.tags.length" class="oxsk-tags"><span v-for="tag in skill.tags" :key="tag">{{ tag }}</span></div></section>
      <section class="oxsk-detail-section oxsk-task-starter"><div class="oxsk-section-line"><h3>{{ isZh ? '任务起手式' : 'Task starter' }}</h3><span>{{ isZh ? '原创建议' : 'Original suggestion' }}</span></div><textarea v-model="starter" rows="5" :aria-label="isZh ? '编辑任务起手式' : 'Edit task starter'"></textarea><div class="oxsk-section-line"><small>{{ isZh ? '可编辑、可复制；不会自动执行。' : 'Edit and copy; nothing runs automatically.' }}</small><button class="oxsk-button" :disabled="!starter.trim()" @click="copyStarter"><i class="fa-regular fa-copy"></i>{{ isZh ? '复制' : 'Copy' }}</button></div><p v-if="copyStatus" class="oxsk-feedback" role="status">{{ copyStatus }}</p></section>
      <section class="oxsk-detail-section"><h3>{{ isZh ? '安装范围' : 'Installation scope' }}</h3>
        <div class="oxsk-scope-row"><div><strong>{{ isZh ? '本机全局' : 'Global on this device' }}</strong><span>{{ skill.isGlobal ? (isZh ? '已安装' : 'Installed') : (isZh ? '未安装' : 'Not installed') }}</span></div><button v-if="!skill.isGlobal && skill.isProject" class="oxsk-button" :disabled="busy || !workspacePath" @click="emit('manage', 'syncGlobal', skill.id)">{{ isZh ? '同步到本机' : 'Sync globally' }}</button><button v-if="skill.isGlobal" class="oxsk-button oxsk-button--quiet-danger" :disabled="busy" @click="emit('manage', 'removeGlobal', skill.id)">{{ isZh ? '卸载全局副本' : 'Remove global copy' }}</button></div>
        <div class="oxsk-scope-row"><div><strong>{{ isZh ? '当前工作区' : 'Current workspace' }}</strong><span>{{ skill.isProject ? (isZh ? '已安装' : 'Installed') : (isZh ? '未安装' : 'Not installed') }}</span></div><button v-if="!skill.isProject" class="oxsk-button" :disabled="busy || !workspacePath || !skill.isGlobal" @click="emit('manage', 'install', skill.id)">{{ isZh ? '安装到工作区' : 'Install to workspace' }}</button><button v-else class="oxsk-button oxsk-button--quiet-danger" :disabled="busy || !workspacePath" @click="emit('manage', 'removeProject', skill.id)">{{ isZh ? '移除工作区副本' : 'Remove workspace copy' }}</button></div>
        <p class="oxsk-hint oxsk-wrap-path">{{ workspacePath || (isZh ? '请先在工作空间中选择项目，再安装到该工作区。' : 'Select a project workspace before installing into it.') }}</p><button v-if="!workspacePath" class="oxsk-link-button" @click="emit('enterprise', 'enterprise-workspaces')">{{ isZh ? '管理工作空间' : 'Manage workspaces' }} <i class="fa-solid fa-arrow-right"></i></button>
      </section>
      <section class="oxsk-detail-section"><h3>{{ isZh ? '状态与证据' : 'State & evidence' }}</h3><dl class="oxsk-metadata"><div><dt>{{ isZh ? '生命周期' : 'Lifecycle' }}</dt><dd>{{ metadataLabel(skill.lifecycleStatus, isZh) }}</dd></div><div><dt>{{ isZh ? '证据来源' : 'Evidence origin' }}</dt><dd>{{ metadataLabel(skill.evidenceOrigin, isZh) }}</dd></div><div><dt>{{ isZh ? '适用环境' : 'Environment' }}</dt><dd>{{ metadataLabel(skill.environmentScope, isZh) }}</dd></div><div><dt>{{ isZh ? '生产资格' : 'Production eligibility' }}</dt><dd>{{ skill.productionEligible ? (isZh ? '已标记具备' : 'Marked eligible') : (isZh ? '未标记具备' : 'Not marked eligible') }}</dd></div></dl><p class="oxsk-hint">{{ isZh ? '安装、企业启用与执行授权分别管理。候选上传后仍需验证。' : 'Installation, enterprise enablement and execution authorization are separate. Uploaded candidates still need verification.' }}</p></section>
      <section class="oxsk-detail-section"><div class="oxsk-section-line"><h3>{{ isZh ? '关联员工' : 'Linked employees' }}</h3><button class="oxsk-link-button" @click="emit('enterprise', 'staff-roles')">{{ isZh ? '配置岗位' : 'Configure roles' }}</button></div><div v-if="relatedEmployees.length" class="oxsk-tags"><span v-for="employee in relatedEmployees" :key="employee.id"><i class="fa-regular fa-user"></i> {{ employee.name }}</span></div><p v-else class="oxsk-hint">{{ isZh ? '当前已加载员工中，没有明确绑定此技能包的记录。' : 'No explicit package binding found among the loaded employees.' }}</p></section>
      <details class="oxsk-provenance"><summary>{{ isZh ? '作者、版本与文件' : 'Author, version & files' }}</summary><dl class="oxsk-metadata"><div><dt>{{ isZh ? '作者' : 'Author' }}</dt><dd>{{ skill.author || (isZh ? '未提供' : 'Not provided') }}</dd></div><div><dt>{{ isZh ? '版本' : 'Version' }}</dt><dd>{{ skill.version || (isZh ? '未提供' : 'Not provided') }}</dd></div><div><dt>{{ isZh ? '技能家族' : 'Skill family' }}</dt><dd>{{ skill.familyId || (isZh ? '未提供' : 'Not provided') }}</dd></div></dl><ul v-if="skill.files.length" class="oxsk-file-list"><li v-for="file in skill.files" :key="file"><i class="fa-regular fa-file-lines"></i><code>{{ file }}</code></li></ul><p v-else class="oxsk-hint">{{ isZh ? '未提供文件清单。' : 'No file list provided.' }}</p></details>
      <button class="oxsk-button oxsk-button--primary oxsk-full-button" :disabled="busy" @click="emit('enterprise', 'enterprise-skills')"><i class="fa-solid fa-building"></i>{{ isZh ? '管理企业启用与候选发布' : 'Enterprise enablement & candidate publishing' }}</button>
    </template>
    <section v-else class="oxsk-source-section">
      <label v-if="skill.isGlobal && skill.isProject" class="oxsk-inline-field"><span>{{ isZh ? '说明来源' : 'Content source' }}</span><select :value="preview.source" :aria-label="isZh ? '说明来源' : 'Content source'" @change="changeSource"><option value="global">{{ isZh ? '本机全局副本' : 'Global copy' }}</option><option value="project">{{ isZh ? '当前工作区副本' : 'Workspace copy' }}</option></select></label>
      <p v-else class="oxsk-hint">{{ preview.source === 'project' ? (isZh ? '当前工作区 · SKILL.md' : 'Workspace · SKILL.md') : (isZh ? '本机全局 · SKILL.md' : 'Global · SKILL.md') }}</p>
      <p v-if="preview.loading" class="oxsk-source-status" role="status"><i class="fa-solid fa-circle-notch fa-spin"></i>{{ isZh ? '正在读取原始说明…' : 'Loading the source guide…' }}</p>
      <div v-else-if="preview.error" class="oxsk-source-status"><p role="alert">{{ preview.error }}</p><button class="oxsk-button" @click="emit('preview', skill.id, preview.source)">{{ isZh ? '重新读取' : 'Retry' }}</button></div>
      <div v-else-if="preview.renderedContent" class="oxsk-markdown markdown-body" v-html="preview.renderedContent"></div>
      <p v-else class="oxsk-hint">{{ isZh ? '未读取到说明内容。' : 'No guide content available.' }}</p>
    </section>
  </aside>
</template>
