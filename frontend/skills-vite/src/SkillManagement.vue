<!--
Copyright (C) 2026 Synapxnet. All rights reserved.
This file is Synapxnet Proprietary and Confidential. It is strictly
forbidden to copy, distribute, or use without explicit authorization.
用途：技能导入、结晶和生命周期管理。 Purpose: Skill import, crystallization and lifecycle management.
Author: maoyo | Department: 研发部 | Date: 2026-09-14
Version: 1.0.0 | Security Level: INTERNAL
__version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
__maintainer__: maoyo | __email__: synapxnet@gmail.com
-->
<script setup>
import { computed, ref } from 'vue';
import { lifecycleTransitionTargets, metadataLabel } from './skillsModel.js';
const props = defineProps({ view: String, state: { type: Object, required: true }, busy: Boolean });
const emit = defineEmits(['command', 'field', 'github', 'enterprise']);
const lifecycleFilter = ref('all');
/** 读取语言状态。 Read the current language. */
const isZh = computed(() => props.state.isZh);
/** 仅过滤实际生命周期条目。 Filter actual lifecycle records only. */
const lifecycleItems = computed(() => props.state.lifecycle.items.filter((item) => lifecycleFilter.value === 'all' || (item.status || item.lifecycle_status) === lifecycleFilter.value));
/** 生成已有结晶字段定义。 Describe existing crystal draft fields. */
const fields = computed(() => [
  ['name', isZh.value ? '技能名称' : 'Skill name', 0], ['id', isZh.value ? '技能 ID' : 'Skill ID', 0],
  ['description', isZh.value ? '用途描述' : 'Purpose', 3], ['trigger', isZh.value ? '什么时候使用' : 'When to use', 3],
  ['workflow', isZh.value ? '工作流步骤' : 'Workflow steps', 5], ['notes', isZh.value ? '验证方式与注意事项' : 'Verification & notes', 3],
]);
/** 选择文件只触发既有 ZIP 导入动作。 Send the chosen file to the existing ZIP import action. */
function chooseZip(event) {
  const file = event.target.files?.[0];
  if (file) emit('command', 'processSkillUpload', file);
  event.target.value = '';
}
/** 只格式化实际成功率，缺失不显示虚构零值。 Format real success rates without substituting missing data with zero. */
function formatRate(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return isZh.value ? '未记录' : 'Not recorded';
  return `${Math.round(value * 100)}%`;
}
</script>
<template>
  <section v-if="view === 'transform'" class="oxsk-management">
    <div class="oxsk-section-heading"><h2>{{ isZh ? '把已有方法带入工作台' : 'Bring your methods into the workbench' }}</h2><p>{{ isZh ? '导入后会出现在本机全局技能目录，可继续配置到工作区和员工。' : 'Imports appear in the global skill folder and can then be configured for workspaces and employees.' }}</p></div>
    <div class="oxsk-import-grid">
      <section class="oxsk-import-card"><span class="oxsk-icon"><i class="fa-brands fa-github"></i></span><h3>GitHub {{ isZh ? '仓库' : 'repository' }}</h3><p>{{ isZh ? '使用包含标准技能包的仓库地址。' : 'Use a repository containing a standard skill package.' }}</p><label class="oxsk-field"><span>{{ isZh ? '仓库地址' : 'Repository URL' }}</span><input :value="state.transform.githubUrl" type="url" placeholder="https://github.com/owner/repository" :disabled="busy || state.transform.isInstalling" @input="emit('github', $event.target.value)" /></label><button class="oxsk-button oxsk-button--primary" :disabled="busy || state.transform.isInstalling || !state.transform.githubUrl.trim()" @click="emit('command', 'installSkillFromGithub')"><i :class="state.transform.isInstalling ? 'fa-solid fa-circle-notch fa-spin' : 'fa-solid fa-download'"></i>{{ state.transform.isInstalling ? (isZh ? '正在安装…' : 'Installing…') : (isZh ? '下载并安装' : 'Download & install') }}</button></section>
      <section class="oxsk-import-card"><span class="oxsk-icon"><i class="fa-regular fa-file-zipper"></i></span><h3>{{ isZh ? '本地 ZIP 技能包' : 'Local ZIP package' }}</h3><p>{{ isZh ? '选择已有的技能归档文件，保留包内说明和文件。' : 'Choose an existing skill archive to retain its guide and files.' }}</p><label class="oxsk-upload" :class="{ 'is-disabled': busy || state.transform.isUploading }"><input type="file" accept=".zip,application/zip" :disabled="busy || state.transform.isUploading" @change="chooseZip" /><i :class="state.transform.isUploading ? 'fa-solid fa-circle-notch fa-spin' : 'fa-solid fa-arrow-up-from-bracket'"></i><strong>{{ state.transform.isUploading ? (isZh ? '正在导入…' : 'Importing…') : (isZh ? '选择 ZIP 文件' : 'Choose a ZIP file') }}</strong><span>{{ isZh ? '安装位置：本机全局' : 'Destination: global skill folder' }}</span></label></section>
    </div>
    <div class="oxsk-help-row"><i class="fa-regular fa-folder-open"></i><div><strong>{{ isZh ? '已有本机技能目录' : 'Already have a local skill folder?' }}</strong><p>{{ isZh ? '打开目录检查现有包，完成文件整理后刷新技能目录。' : 'Open the folder to inspect packages, then refresh after organizing files.' }}</p></div><button class="oxsk-button" :disabled="busy" @click="emit('command', 'openSkillsFolder')">{{ isZh ? '打开目录' : 'Open folder' }}</button><button class="oxsk-button" :disabled="busy" @click="emit('command', 'handleRefreshSkills')">{{ isZh ? '刷新目录' : 'Refresh' }}</button></div>
  </section>
  <section v-else-if="view === 'crystal'" class="oxsk-management">
    <div class="oxsk-section-heading oxsk-section-line"><div><h2>{{ isZh ? '把一次方法，沉淀为下一次能力' : 'Turn a method into a reusable capability' }}</h2><p>{{ isZh ? '写清使用条件、步骤与验证方式，生成待验证的候选技能。' : 'Describe triggers, steps and verification to create a candidate skill.' }}</p></div><button class="oxsk-button" :disabled="busy || state.crystal.busy" @click="emit('command', 'seedSkillCrystalExample')"><i class="fa-regular fa-lightbulb"></i>{{ isZh ? '填充原创示例' : 'Fill example' }}</button></div>
    <div class="oxsk-crystal-grid"><section class="oxsk-crystal-form"><label class="oxsk-field"><span>{{ isZh ? '方法来源' : 'Method source' }}</span><select :value="state.crystal.draft.source" :disabled="busy || state.crystal.busy" @change="emit('field', 'source', $event.target.value)"><option v-for="option in state.crystal.sourceOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></label><div class="oxsk-form-grid"><label v-for="field in fields" :key="field[0]" class="oxsk-field" :class="{ 'oxsk-field--full': field[2] }"><span>{{ field[1] }}</span><textarea v-if="field[2]" :value="state.crystal.draft[field[0]]" :rows="field[2]" :disabled="busy || state.crystal.busy" @input="emit('field', field[0], $event.target.value)"></textarea><input v-else :value="state.crystal.draft[field[0]]" :disabled="busy || state.crystal.busy" @input="emit('field', field[0], $event.target.value)" /></label></div><label class="oxsk-checkbox"><input type="checkbox" :checked="state.crystal.draft.syncToWorkspace" :disabled="!state.workspacePath || busy || state.crystal.busy" @change="emit('field', 'syncToWorkspace', $event.target.checked)" /><span>{{ isZh ? '同时安装到当前工作区' : 'Also install to the current workspace' }}</span></label><p class="oxsk-hint oxsk-wrap-path">{{ state.workspacePath || (isZh ? '尚未选择工作区；候选将保存到本机全局。' : 'No workspace selected. The candidate will be saved globally.') }}</p><button class="oxsk-button oxsk-button--primary" :disabled="busy || state.crystal.busy || !String(state.crystal.draft.name || '').trim()" @click="emit('command', 'crystallizeSkill')"><i :class="state.crystal.busy ? 'fa-solid fa-circle-notch fa-spin' : 'fa-regular fa-gem'"></i>{{ state.crystal.busy ? (isZh ? '正在生成…' : 'Creating…') : (isZh ? '生成候选技能' : 'Create candidate skill') }}</button></section><aside class="oxsk-crystal-preview"><div class="oxsk-section-line"><h3>SKILL.md</h3><span>{{ isZh ? '实时预览' : 'Live preview' }}</span></div><pre>{{ state.crystal.preview || (isZh ? '开始填写后，这里会显示技能文件预览。' : 'Start writing to preview the skill document.') }}</pre></aside></div>
  </section>
  <section v-else class="oxsk-management">
    <div class="oxsk-section-heading oxsk-section-line"><div><h2>{{ isZh ? '看清技能如何成熟' : 'See how skills mature' }}</h2><p>{{ isZh ? '查看真实生命周期记录。状态转换仍由既有治理规则校验。' : 'Review actual lifecycle records. Existing governance rules validate transitions.' }}</p></div><div class="oxsk-actions"><button class="oxsk-button" :disabled="busy || state.lifecycle.loading" @click="emit('command', 'fetchSkillLifecycle', false)">{{ isZh ? '刷新记录' : 'Refresh records' }}</button><button class="oxsk-button oxsk-button--primary" :disabled="busy || state.lifecycle.running || state.lifecycle.phase !== 'ready'" @click="emit('command', 'runSkillLifecycleSleepCycle')"><i :class="state.lifecycle.running ? 'fa-solid fa-circle-notch fa-spin' : 'fa-regular fa-moon'"></i>{{ state.lifecycle.running ? (isZh ? '整理中…' : 'Organizing…') : (isZh ? '运行睡眠整理' : 'Run sleep cycle') }}</button></div></div>
    <div v-if="state.lifecycle.phase === 'loading'" class="oxsk-empty" role="status"><i class="fa-solid fa-circle-notch fa-spin"></i><h3>{{ isZh ? '正在读取生命周期记录…' : 'Loading lifecycle records…' }}</h3><p>{{ isZh ? '读取完成后显示当前状态与计数。' : 'Current states and counts appear after loading completes.' }}</p></div>
    <div v-else-if="state.lifecycle.phase === 'error'" class="oxsk-empty"><i class="fa-solid fa-circle-exclamation"></i><h3>{{ isZh ? '生命周期记录暂时无法读取' : 'Lifecycle records are unavailable' }}</h3><p role="alert">{{ state.lifecycle.error }}</p><button class="oxsk-button" :disabled="busy || state.lifecycle.loading" @click="emit('command', 'fetchSkillLifecycle', false)"><i class="fa-solid fa-rotate-right"></i>{{ isZh ? '重新读取' : 'Retry' }}</button></div>
    <template v-else>
    <div class="oxsk-lifecycle-counts"><button :class="{ 'is-active': lifecycleFilter === 'all' }" @click="lifecycleFilter = 'all'"><span>{{ isZh ? '已载入记录' : 'Loaded records' }}</span><strong>{{ state.lifecycle.items.length }}</strong></button><button v-for="status in state.lifecycle.states" :key="status.value" :class="{ 'is-active': lifecycleFilter === status.value }" @click="lifecycleFilter = status.value"><span>{{ status.label }}</span><strong>{{ state.lifecycle.counts[status.value] || 0 }}</strong></button></div>
    <div v-if="state.lifecycle.summary.patterns || state.lifecycle.summary.thresholds" class="oxsk-lifecycle-evidence"><span v-if="state.lifecycle.summary.patterns?.total !== undefined">{{ isZh ? '已识别模式' : 'Patterns' }} · {{ state.lifecycle.summary.patterns.total }}</span><span v-if="state.lifecycle.summary.thresholds?.candidateMinTraces !== undefined">{{ isZh ? '候选所需轨迹' : 'Candidate trace requirement' }} · {{ state.lifecycle.summary.thresholds.candidateMinTraces }}</span><span v-if="state.lifecycle.summary.thresholds?.candidateMinSuccessRate !== undefined">{{ isZh ? '候选成功率门槛' : 'Candidate success gate' }} · {{ formatRate(state.lifecycle.summary.thresholds.candidateMinSuccessRate) }}</span></div>
    <div v-if="lifecycleItems.length" class="oxsk-lifecycle-list"><article v-for="item in lifecycleItems" :key="item.skill_id || item.id"><div><strong>{{ item.name || item.skill_id || item.id }}</strong><code>{{ item.skill_id || item.id }}</code><p v-if="item.description" class="oxsk-lifecycle-description">{{ item.description }}</p><div class="oxsk-lifecycle-evidence"><span>{{ isZh ? '使用记录' : 'Uses' }} · {{ item.use_count ?? (isZh ? '未记录' : 'Not recorded') }}</span><span>{{ isZh ? '成功率' : 'Success rate' }} · {{ formatRate(item.success_rate) }}</span><span v-if="item.tool_chain?.length">{{ item.tool_chain.join(' → ') }}</span></div></div><span>{{ metadataLabel(item.status || item.lifecycle_status, isZh) }}</span><div class="oxsk-actions"><button v-for="target in lifecycleTransitionTargets(item)" :key="target" class="oxsk-button" :disabled="busy || state.lifecycle.running" @click="emit('command', 'transitionSkillLifecycle', item, target)">{{ isZh ? '转为' : 'Set' }} {{ metadataLabel(target, isZh) }}</button></div></article></div>
    <div v-else class="oxsk-empty"><i class="fa-solid fa-code-branch"></i><h3>{{ state.lifecycle.loading ? (isZh ? '正在读取记录…' : 'Loading records…') : (isZh ? '暂无此状态的技能记录' : 'No skills in this state') }}</h3><p>{{ isZh ? '已有旧格式技能仍可在已安装页管理。' : 'Legacy packages remain available in Installed.' }}</p></div>
    </template>
  </section>
</template>
