<!--
Copyright (C) 2026 Synapxnet. All rights reserved.
This file is Synapxnet Proprietary and Confidential. It is strictly
forbidden to copy, distribute, or use without explicit authorization.
用途：技能发现与管理主界面。 Purpose: Skill discovery and management workbench.
Author: maoyo | Department: 研发部 | Date: 2026-09-14
Version: 1.0.0 | Security Level: INTERNAL
__version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
__maintainer__: maoyo | __email__: synapxnet@gmail.com
-->
<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { createSkillsBridge } from './skillsBridge.js';
import { SKILL_GROUPS, filterSkills, metadataLabel, resolveBundles } from './skillsModel.js';
import SkillDetail from './SkillDetail.vue';
import SkillManagement from './SkillManagement.vue';
import './skillsWorkbench.css';

const bridge = createSkillsBridge();
const state = ref(bridge.snapshot());
const category = ref('all');
const location = ref('all');
const busy = ref('');
const error = ref('');
const workbench = ref(null);
let timer = null;
/** 获取当前语言。 Read the current language. */
const isZh = computed(() => state.value.isZh);
/** 把旧入口映射为发现视图。 Map the legacy library entry to discovery. */
const view = computed(() => state.value.activeTab === 'library' ? 'discover' : state.value.activeTab);
/** 筛选真实目录，已安装页支持位置过滤。 Filter the real catalog and installation locations. */
const visibleSkills = computed(() => filterSkills(state.value.library.items, { query: state.value.query, category: category.value, location: view.value === 'installed' ? location.value : 'all' }));
/** 仅显示当前集合中被明确选择的技能。 Show only the explicitly selected skill in the current collection. */
const selected = computed(() => (view.value === 'bundles' ? state.value.library.items : visibleSkills.value).some((skill) => skill.id === state.value.preview.activeId) ? state.value.preview.current : null);
/** 解析套组真实安装成员。 Resolve actual package members for each bundle. */
const bundles = computed(() => resolveBundles(state.value.library.items));
/** 生成紧凑导航，管理入口保持可达。 Provide compact navigation with reachable management actions. */
const tabs = computed(() => [
  ['discover', isZh.value ? '发现技能' : 'Discover', 'fa-solid fa-compass'],
  ['installed', isZh.value ? '已安装' : 'Installed', 'fa-solid fa-layer-group'],
  ['bundles', isZh.value ? '技能套组' : 'Bundles', 'fa-solid fa-cubes-stacked'],
  ['transform', isZh.value ? '导入' : 'Import', 'fa-solid fa-arrow-down-to-bracket'],
  ['crystal', isZh.value ? '技能结晶' : 'Crystal', 'fa-regular fa-gem'],
  ['lifecycle', isZh.value ? '生命周期' : 'Lifecycle', 'fa-solid fa-code-branch'],
]);
/** 刷新宿主快照，当前选择不会回退为其他条目。 Refresh the host snapshot without substituting another selection. */
function refresh() { state.value = bridge.snapshot(); }
/** 统一等待与错误展示，防止重复管理提交。 Handle pending actions and errors without duplicate management submissions. */
async function run(key, action) {
  if (busy.value) return;
  busy.value = key; error.value = '';
  try { const pending = action(); refresh(); await pending; }
  catch (failure) { error.value = failure?.message || String(failure); }
  finally { busy.value = ''; refresh(); }
}
/** 切换主视图，丢弃过期详情。 Change the main view and discard stale details. */
async function openView(next) {
  bridge.clearPreview(); category.value = 'all'; location.value = 'all'; error.value = '';
  try { await bridge.openTab(next === 'discover' ? 'library' : next); }
  catch (failure) { error.value = failure.message; }
  refresh();
}
/** 修改类别并关闭不再对应的详情。 Change category and clear details outside the new filter. */
function setCategory(next) { category.value = next; bridge.clearPreview(); refresh(); }
/** 修改安装位置并清理选择。 Change installation location and clear selection. */
function setLocation(event) { location.value = event.target.value; bridge.clearPreview(); refresh(); }
/** 搜索不替代选中项。 Search without substituting the selected skill. */
function search(event) { bridge.setQuery(event.target.value); refresh(); }
/** 支持快速切换；乱序请求由宿主选择代次隔离。 Allow rapid selection with host generation guards for out-of-order requests. */
async function preview(id, source) {
  error.value = '';
  try {
    const pending = bridge.previewSkill(id, source); refresh();
    if (!source) {
      await nextTick();
      workbench.value?.scrollTo({ top: 0, behavior: 'auto' });
      workbench.value?.scrollIntoView({ block: 'start', behavior: 'auto' });
    }
    await pending;
  }
  catch (failure) { error.value = failure.message; }
  finally { refresh(); }
}
/** 关闭详情并使在途读取失效。 Close details and invalidate pending reads. */
function closeDetail() { bridge.clearPreview(); refresh(); }
/** 执行既有安装或移除接口。 Delegate installation and removal to existing actions. */
function manage(action, id) { return run(`${action}:${id}`, () => bridge.manageSkill(action, id)); }
/** 从子组件调用已存在的管理动作。 Delegate management component commands to existing host actions. */
function command(method, ...args) { return run(method, () => bridge.invoke(method, ...args)); }
/** 跳转企业工作区或岗位设置。 Navigate to enterprise workspace or employee settings. */
function enterprise(tab) { return run('enterprise', () => bridge.openEnterprise(tab)); }
/** 更新结晶字段后立即刷新预览。 Refresh the crystal preview after field edits. */
function crystalField(field, value) { bridge.setCrystalField(field, value); refresh(); }
/** 记录导入地址，输入本身不安装。 Record the import URL without installing on input. */
function githubUrl(value) { bridge.setGithubUrl(value); refresh(); }
/** 开始轻量快照同步；不访问外部服务。 Start lightweight host synchronization without external service access. */
function mount() { refresh(); timer = window.setInterval(refresh, 400); }
/** 结束定时同步。 Stop snapshot synchronization. */
function unmount() { if (timer) window.clearInterval(timer); }
/** 从企业入口返回时重置视图筛选，保留明确详情。 Reset filters on entry from enterprise while retaining explicit details. */
function enterFromHost(menu) { if (menu === 'skills') { category.value = 'all'; location.value = 'all'; } }
/** 观察宿主页面入口。 Observe the host page entry. */
watch(() => state.value.activeMenu, enterFromHost);
onMounted(mount);
onBeforeUnmount(unmount);
</script>

<template>
  <main ref="workbench" class="oxsk-workbench" :class="{ 'oxsk-workbench--detail': selected }" :aria-busy="!!busy">
    <header class="oxsk-header">
      <div class="oxsk-title"><span class="oxsk-mark"><i class="fa-solid fa-shapes" aria-hidden="true"></i></span><div><h1>{{ isZh ? '技能工作台' : 'Skill workbench' }}</h1><p>{{ isZh ? '让方法成为员工可复用的能力' : 'Turn methods into reusable employee capabilities' }}</p></div></div>
      <div class="oxsk-actions">
        <button class="oxsk-button" :disabled="!!busy" @click="command('openSkillsFolder')"><i class="fa-regular fa-folder-open"></i>{{ isZh ? '技能目录' : 'Folder' }}</button>
        <button class="oxsk-button oxsk-button--primary" :disabled="!!busy" @click="enterprise('enterprise-skills')"><i class="fa-solid fa-building"></i>{{ isZh ? '企业启用' : 'Enterprise' }}</button>
      </div>
    </header>
    <nav class="oxsk-tabs" :aria-label="isZh ? '技能视图' : 'Skill views'">
      <button v-for="tab in tabs" :key="tab[0]" :class="{ 'is-active': view === tab[0] }" :aria-current="view === tab[0] ? 'page' : undefined" @click="openView(tab[0])"><i :class="tab[2]"></i>{{ tab[1] }}</button>
      <button class="oxsk-refresh" :disabled="!!busy || state.library.loading" :title="isZh ? '刷新全局与工作区技能' : 'Refresh global and workspace skills'" @click="command('handleRefreshSkills')"><i class="fa-solid fa-rotate-right" :class="{ 'fa-spin': state.library.loading }"></i><span class="oxsk-sr-only">{{ isZh ? '刷新' : 'Refresh' }}</span></button>
    </nav>
    <p v-if="error || state.library.error" class="oxsk-alert" role="alert"><i class="fa-solid fa-circle-exclamation"></i>{{ error || state.library.error }}</p>
    <p v-if="!state.available" class="oxsk-alert" role="status">{{ isZh ? '正在等待应用连接，技能操作暂不可用。' : 'Waiting for the application connection. Skill actions are unavailable.' }}</p>

    <template v-if="['discover', 'installed', 'bundles'].includes(view)">
      <section v-if="view === 'discover' && !selected" class="oxsk-intro">
        <div><span class="oxsk-eyebrow">OPENXNET CAPABILITIES</span><h2>{{ isZh ? '从一个任务，找到合适的方法' : 'Find the right method for your next task' }}</h2><p>{{ isZh ? '浏览本机与工作区的真实技能，查看用途，再决定如何配给员工。' : 'Explore real local and workspace skills, understand their purpose, then configure your employees.' }}</p></div>
        <div class="oxsk-intro-art" aria-hidden="true"><i class="fa-solid fa-diagram-project"></i><span></span><span></span></div>
      </section>
      <div v-if="view !== 'bundles' && !selected" class="oxsk-toolbar">
        <label class="oxsk-search"><i class="fa-solid fa-magnifying-glass"></i><input :value="state.query" :placeholder="isZh ? '搜索名称、用途或技能 ID' : 'Search name, purpose or skill ID'" :aria-label="isZh ? '搜索技能' : 'Search skills'" @input="search" /></label>
        <label v-if="view === 'installed'" class="oxsk-inline-field"><span>{{ isZh ? '安装范围' : 'Location' }}</span><select :value="location" @change="setLocation"><option value="all">{{ isZh ? '所有位置' : 'All locations' }}</option><option value="global">{{ isZh ? '本机全局' : 'Global' }}</option><option value="project">{{ isZh ? '当前工作区' : 'Workspace' }}</option></select></label>
        <span class="oxsk-count">{{ visibleSkills.length }} {{ isZh ? '个技能' : 'skills' }}</span>
      </div>
      <div v-if="view !== 'bundles' && !selected" class="oxsk-categories" :aria-label="isZh ? '能力类别' : 'Capability categories'"><button v-for="group in SKILL_GROUPS" :key="group.id" :class="{ 'is-active': category === group.id }" :aria-pressed="category === group.id" @click="setCategory(group.id)"><i :class="group.icon"></i>{{ isZh ? group.zh : group.en }}</button></div>
      <div v-if="view === 'installed'" class="oxsk-location-note"><i class="fa-solid fa-folder-tree"></i><span>{{ state.workspacePath || (isZh ? '未选择工作区；可以管理本机全局技能。' : 'No workspace selected. Global skills remain available.') }}</span></div>
      <div class="oxsk-content" :class="{ 'has-detail': selected }">
        <section v-if="view !== 'bundles'" class="oxsk-catalog" :aria-busy="state.library.loading">
          <div v-if="selected" class="oxsk-toolbar oxsk-toolbar--detail"><label class="oxsk-search"><i class="fa-solid fa-magnifying-glass"></i><input :value="state.query" :placeholder="isZh ? '搜索技能' : 'Search skills'" :aria-label="isZh ? '搜索技能' : 'Search skills'" @input="search" /></label><label class="oxsk-inline-field"><select :value="category" :aria-label="isZh ? '能力类别' : 'Capability category'" @change="setCategory($event.target.value)"><option v-for="group in SKILL_GROUPS" :key="group.id" :value="group.id">{{ isZh ? group.zh : group.en }}</option></select></label><label v-if="view === 'installed'" class="oxsk-inline-field"><select :value="location" :aria-label="isZh ? '安装范围' : 'Installation location'" @change="setLocation"><option value="all">{{ isZh ? '所有位置' : 'All locations' }}</option><option value="global">{{ isZh ? '本机全局' : 'Global' }}</option><option value="project">{{ isZh ? '当前工作区' : 'Workspace' }}</option></select></label></div>
          <div v-if="!visibleSkills.length" class="oxsk-empty"><i class="fa-solid fa-box-open"></i><h3>{{ state.library.loading ? (isZh ? '正在读取技能' : 'Loading skills') : (isZh ? '这里还没有匹配的技能' : 'No matching skills') }}</h3><p>{{ isZh ? '调整筛选，或从已有仓库和 ZIP 技能包导入。' : 'Adjust the filters or import a repository or ZIP package.' }}</p><button class="oxsk-button" @click="openView('transform')">{{ isZh ? '导入技能' : 'Import skills' }}</button></div>
          <div v-else class="oxsk-grid">
            <article v-for="skill in visibleSkills" :key="skill.id" class="oxsk-card" :class="{ 'is-selected': selected?.id === skill.id }">
              <button class="oxsk-card-main" :aria-label="(isZh ? '查看技能：' : 'View skill: ') + skill.name" @click="preview(skill.id)">
                <div class="oxsk-card-top"><span class="oxsk-icon" :data-group="skill.group"><i :class="skill.icon"></i></span><span class="oxsk-card-group">{{ skill.groupLabel }}</span><i class="fa-solid fa-arrow-up-right-from-square oxsk-card-arrow" aria-hidden="true"></i></div>
                <h3>{{ skill.name }}</h3><span class="oxsk-id">{{ skill.alias }}</span><p>{{ skill.description || (isZh ? '该技能暂未提供用途说明。' : 'No purpose description provided.') }}</p>
              </button>
              <footer><span class="oxsk-location"><i class="fa-solid fa-circle-check"></i>{{ skill.isGlobal && skill.isProject ? (isZh ? '本机 + 工作区' : 'Global + workspace') : skill.isGlobal ? (isZh ? '本机全局' : 'Global') : (isZh ? '当前工作区' : 'Workspace') }}</span><span>{{ skill.version ? `v${skill.version}` : metadataLabel(skill.lifecycleStatus, isZh) }}</span></footer>
            </article>
          </div>
        </section>
        <section v-else class="oxsk-bundles">
          <div class="oxsk-section-heading"><h2>{{ isZh ? '把能力配成一条工作流' : 'Connect capabilities into a workflow' }}</h2><p>{{ isZh ? '套组是配套建议，逐项查看真实技能。选择套组不会安装或执行任务。' : 'Bundles suggest related packages. Review each real skill; choosing a bundle does not install or execute it.' }}</p></div>
          <article v-for="bundle in bundles" :key="bundle.id" class="oxsk-bundle"><span class="oxsk-icon"><i :class="bundle.icon"></i></span><div class="oxsk-bundle-body"><h3>{{ isZh ? bundle.zh : bundle.en }}</h3><p>{{ isZh ? bundle.descriptionZh : bundle.descriptionEn }}</p><div class="oxsk-bundle-members"><button v-for="member in bundle.members" :key="member.id" :disabled="!member.skill" @click="preview(member.id)"><i :class="member.skill ? 'fa-solid fa-circle-check' : 'fa-regular fa-circle'"></i><span>{{ member.skill?.name || member.id }}</span><small>{{ member.skill ? (isZh ? '查看' : 'View') : (isZh ? '未在本机找到' : 'Not found locally') }}</small></button></div><p class="oxsk-bundle-starter"><i class="fa-regular fa-comment-dots"></i>{{ isZh ? bundle.starterZh : bundle.starterEn }}</p></div></article>
        </section>
        <SkillDetail v-if="selected" :key="selected.id" :skill="selected" :preview="state.preview" :is-zh="isZh" :workspace-path="state.workspacePath" :employees="state.employees" :busy="!!busy" @close="closeDetail" @manage="manage" @preview="preview" @enterprise="enterprise" />
      </div>
      <footer class="oxsk-library-footer"><span>{{ isZh ? '发现内容来自当前技能目录。更多技能可通过外部市场查看。' : 'Discovery uses your current catalog. Browse the external market for more skills.' }}</span><a href="https://www.agentparty.top/skills.html" target="_blank" rel="noopener noreferrer">{{ isZh ? '技能市场' : 'Skill market' }} <i class="fa-solid fa-arrow-up-right-from-square"></i></a><a href="https://github.com/openxnet/openxnet.github.io/blob/main/skills.json" target="_blank" rel="noopener noreferrer">{{ isZh ? '提交技能' : 'Submit a skill' }}</a></footer>
    </template>
    <SkillManagement v-else :view="view" :state="state" :busy="!!busy" @command="command" @field="crystalField" @github="githubUrl" @enterprise="enterprise" />
  </main>
</template>
