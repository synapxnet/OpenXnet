<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { createOpsBridge } from './opsBridge';

const props = defineProps({
  surface: {
    type: String,
    default: '',
  },
});

const bridge = createOpsBridge();
const snapshot = ref(bridge.snapshot(props.surface));

let refreshTimer = null;
let lastActive = false;

function refreshSnapshot() {
  const next = bridge.snapshot(props.surface);
  const becameActive = !lastActive && next.isActive;
  snapshot.value = next;
  if (becameActive) {
    bridge.ensureLoaded(props.surface).finally(() => {
      snapshot.value = bridge.snapshot(props.surface);
    });
  }
  lastActive = next.isActive;
}

function handleSelectTab(tabId) {
  bridge.selectSurfaceTab(props.surface, tabId).finally(refreshSnapshot);
}

function handleRefresh() {
  bridge.refreshSurface(props.surface).finally(refreshSnapshot);
}

function handleSystemCheckUpdates() {
  bridge.runSystemUpdateCheck().finally(refreshSnapshot);
}

function handleSystemOpenAbout() {
  bridge.openAboutSurface().finally(refreshSnapshot);
}

function handleSystemSettingChange(key, value) {
  bridge.updateSystemSetting(key, value).finally(refreshSnapshot);
}

function handleSystemSettingEvent(key, event) {
  handleSystemSettingChange(key, event?.target?.value ?? event);
}

function handleSystemBooleanSetting(key, event) {
  handleSystemSettingChange(key, !!event?.target?.checked);
}

function handleSystemTargetLanguage(event) {
  bridge.setSystemTargetLanguage(event?.target?.value || 'system').finally(refreshSnapshot);
}

function handleSystemClearCache() {
  bridge.clearSystemRuntimeCache().finally(refreshSnapshot);
}

function handleSystemQuickAction(action) {
  bridge.runSystemQuickAction(action).finally(refreshSnapshot);
}

function handleSystemOpenPath(kind) {
  bridge.openSystemPath(kind).finally(refreshSnapshot);
}

function handleSystemResetDefaults() {
  bridge.resetSystemSettings().finally(refreshSnapshot);
}

/** Refresh the signed Feature Pack catalog and installed health state. */
function handleFeaturePackRefresh() {
  bridge.loadFeaturePacks(true).finally(refreshSnapshot);
}

/**
 * Run one Feature Pack mutation after confirming destructive removal.
 *
 * @param {'install'|'repair'|'uninstall'} operation Requested operation.
 * @param {object} item Selected Feature Pack row.
 */
function handleFeaturePackOperation(operation, item) {
  if (!item?.capabilityId || isFeaturePackBusy(item)) return;
  if (operation === 'uninstall') {
    const confirmed = window.confirm(
      isZh.value
        ? `确认卸载“${item.displayName}”？应用重启后该能力将不可用。`
        : `Uninstall “${item.displayName}”? This capability will be unavailable after restart.`
    );
    if (!confirmed) return;
  }
  bridge.runFeaturePackOperation(operation, item.capabilityId)
    .catch(() => {})
    .finally(refreshSnapshot);
}

/**
 * Determine whether a Feature Pack row currently owns an active operation.
 *
 * @param {object} item Feature Pack row.
 * @returns {boolean} True while controls must be disabled.
 */
function isFeaturePackBusy(item) {
  const phase = String(item?.progress?.phase || '');
  return !!item?.operation || (!!phase && phase !== 'completed' && phase !== 'failed');
}

/**
 * Return localized Feature Pack health text without relying on color.
 *
 * @param {string} status Stable health code.
 * @returns {string} Localized status label.
 */
function getFeaturePackStatusLabel(status) {
  const labels = isZh.value
    ? {
      'not-installed': '未安装',
      installed: '已安装',
      'update-available': '可更新',
      damaged: '需要修复',
    }
    : {
      'not-installed': 'Not installed',
      installed: 'Installed',
      'update-available': 'Update available',
      damaged: 'Repair required',
    };
  return labels[status] || status;
}

/**
 * Return a status icon paired with the visible Feature Pack state label.
 *
 * @param {string} status Stable health code.
 * @returns {string} Font Awesome icon class.
 */
function getFeaturePackStatusIcon(status) {
  const icons = {
    'not-installed': 'fa-regular fa-circle',
    installed: 'fa-solid fa-circle-check',
    'update-available': 'fa-solid fa-circle-arrow-up',
    damaged: 'fa-solid fa-triangle-exclamation',
  };
  return icons[status] || 'fa-regular fa-circle-question';
}

/**
 * Return localized progress text for a stable operation phase.
 *
 * @param {string} phase Stable progress phase.
 * @returns {string} Localized progress label.
 */
function getFeaturePackPhaseLabel(phase) {
  const labels = isZh.value
    ? {
      preparing: '准备中',
      downloading: '正在下载',
      'verifying-archive': '校验归档',
      extracting: '安全解包',
      'verifying-pack': '校验签名与文件',
      installing: '正在安装',
      removing: '正在卸载',
      completed: '操作完成',
      failed: '操作失败',
    }
    : {
      preparing: 'Preparing',
      downloading: 'Downloading',
      'verifying-archive': 'Verifying archive',
      extracting: 'Extracting safely',
      'verifying-pack': 'Verifying signature and files',
      installing: 'Installing',
      removing: 'Uninstalling',
      completed: 'Completed',
      failed: 'Failed',
    };
  return labels[phase] || phase;
}

/**
 * Format a byte count for compact progress metadata.
 *
 * @param {number|null} value Byte count.
 * @returns {string} Compact binary size.
 */
function formatFeaturePackBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function handlePrimaryAction() {
  if (props.surface === 'deploy') {
    bridge.startPrimaryDeployAction().finally(refreshSnapshot);
  } else if (props.surface === 'workbench') {
    bridge.openTaskCenter().finally(refreshSnapshot);
  } else if (props.surface === 'storage') {
    if (snapshot.value?.activeTab === 'memory-v3') {
      openMemoryCreateEditor();
    } else {
      bridge.jumpToMenu('storage', 'text').finally(refreshSnapshot);
    }
  } else if (props.surface === 'kernel') {
    bridge.selectSurfaceTab('kernel', 'actions').finally(refreshSnapshot);
  } else if (props.surface === 'system') {
    if (snapshot.value?.activeTab === 'about') {
      bridge.runSystemUpdateCheck().finally(refreshSnapshot);
    } else {
      bridge.selectSurfaceTab('system', 'about').finally(refreshSnapshot);
    }
  }
}

function handleOpenTask(task) {
  bridge.openTask(task).finally(refreshSnapshot);
}

/* ── VRM surface handlers ── */
const vrmLivePreview = ref(false);
const vrmModelTab = ref('builtin'); // 'builtin' | 'cloud' | 'custom'
const vrmModelQuery = ref('');
const vrmDownloadingModelId = ref('');
const vrmMotionTab = ref('builtin');
const vrmMotionQuery = ref('');
const enterpriseRoleQuery = ref('');
const enterpriseRoleCategory = ref('all');
const enterpriseKbQuery = ref('');
const enterpriseKbCategory = ref('all');
const enterpriseKbEditorOpen = ref(false);
const enterpriseKbVersionOpen = ref(false);
const enterpriseKbSideMode = ref('summary');
const enterpriseKbVersions = ref([]);
const enterpriseKbDraft = ref({
  id: '',
  name: '',
  description: '',
  category: '',
});
const sandboxSelectedWorkspaceId = ref('');
const sandboxSelectedProjectId = ref('');
const sandboxSelectedAgentId = ref('');
const memoryQuery = ref('');
const memoryActorAgent = ref('');
const memoryIncludeRetired = ref(false);
const memoryEditorOpen = ref(false);
const memoryEditorMode = ref('create');
const memoryActionBusy = ref(false);
const memoryActionError = ref('');
const memoryDraft = ref({
  memoryId: '',
  baseVersion: 0,
  taskId: '',
  title: '',
  content: '',
  qualityScore: 0.8,
  permissionsText: '',
  tagsText: '',
  reason: '',
});

function handleVrmStart() {
  bridge.startVrm().finally(refreshSnapshot);
}

function handleVrmStartWeb() {
  bridge.startVrmWeb().finally(refreshSnapshot);
}

function handleVrmSelectModel(model) {
  const item = typeof model === 'object' && model ? model : { id: model };
  if (item.cloud && !item.downloaded) {
    handleVrmDownloadModel(item);
    return;
  }
  bridge.setVrmModel(item.id).finally(refreshSnapshot);
}

function handleVrmDownloadModel(model, event) {
  if (event) event.stopPropagation();
  if (!model?.id || vrmDownloadingModelId.value) return;
  vrmDownloadingModelId.value = model.id;
  bridge.downloadVrmModel(model.id)
    .catch(() => {})
    .finally(() => {
      vrmDownloadingModelId.value = '';
      refreshSnapshot();
    });
}

function handleVrmDeleteModel(modelId, event) {
  if (event) event.stopPropagation();
  bridge.deleteVrmUserModel(modelId).finally(refreshSnapshot);
}

function handleVrmToggleMotion(motionId) {
  bridge.toggleVrmMotion(motionId).finally(refreshSnapshot);
}

function handleVrmDeleteMotion(motionId, event) {
  if (event) event.stopPropagation();
  bridge.deleteVrmUserMotion(motionId).finally(refreshSnapshot);
}

function handleVrmSetExpressions(event) {
  bridge.setVrmExpressionsEnabled(event.target.checked).finally(refreshSnapshot);
}

function handleVrmSetMotionsEnabled(event) {
  bridge.setVrmMotionsEnabled(event.target.checked).finally(refreshSnapshot);
}

function handleVrmSetWidth(event) {
  bridge.setVrmWindowWidth(event.target.value).finally(refreshSnapshot);
}

function handleVrmSetHeight(event) {
  bridge.setVrmWindowHeight(event.target.value).finally(refreshSnapshot);
}

function handleVrmSetAgent(event) {
  bridge.setVrmAgent(event.target.value).finally(refreshSnapshot);
}

function handleVrmAddModel() {
  bridge.openAddVrmModel().finally(refreshSnapshot);
}

function handleVrmAddMotion() {
  bridge.openAddVrmMotion().finally(refreshSnapshot);
}

function handleEnterpriseCreateRole() {
  bridge.openEnterpriseStaffRoleForm().finally(refreshSnapshot);
}

function handleEnterpriseCreateRoleFromTemplate(templateId) {
  bridge.createEnterpriseStaffRoleFromTemplate(templateId).finally(refreshSnapshot);
}

function handleEnterpriseDeleteRole(roleId) {
  bridge.deleteEnterpriseStaffRole(roleId).finally(refreshSnapshot);
}

function handleEnterpriseCreateWorkspace() {
  bridge.openEnterpriseWorkspaceForm().finally(refreshSnapshot);
}

function handleEnterpriseEditWorkspace(workspaceId) {
  sandboxSelectedWorkspaceId.value = String(workspaceId || '');
  bridge.openEnterpriseWorkspaceForm(workspaceId).finally(refreshSnapshot);
}

function handleEnterpriseOpenWorkspace(workspaceId) {
  sandboxSelectedWorkspaceId.value = String(workspaceId || '');
  bridge.openEnterpriseWorkspace(workspaceId).finally(refreshSnapshot);
}

function handleEnterpriseDeleteWorkspace(workspaceId) {
  if (sandboxSelectedWorkspaceId.value === String(workspaceId || '')) {
    sandboxSelectedWorkspaceId.value = '';
  }
  bridge.deleteEnterpriseWorkspace(workspaceId).finally(refreshSnapshot);
}

function handleEnterpriseCreateProject(workspaceId) {
  bridge.openEnterpriseProjectForm(workspaceId).finally(refreshSnapshot);
}

function handleEnterpriseEditProject(projectId, workspaceId = '') {
  sandboxSelectedProjectId.value = String(projectId || '');
  bridge.openEnterpriseProjectForm(workspaceId, projectId).finally(refreshSnapshot);
}

function handleEnterpriseDeleteProject(projectId) {
  const targetId = String(projectId || '');
  if (sandboxSelectedProjectId.value === targetId) {
    sandboxSelectedProjectId.value = '';
  }
  bridge.deleteEnterpriseProject(projectId).finally(refreshSnapshot);
}

function handleSandboxGoBack() {
  sandboxSelectedWorkspaceId.value = '';
  sandboxSelectedProjectId.value = '';
  sandboxSelectedAgentId.value = '';
  bridge.sandboxGoBack().finally(refreshSnapshot);
}

function handleSandboxBreadcrumbClick(crumb) {
  const level = Number(crumb?.level || 0);
  if (level <= 0) {
    sandboxSelectedWorkspaceId.value = '';
    sandboxSelectedProjectId.value = '';
    sandboxSelectedAgentId.value = '';
  } else if (level === 1) {
    sandboxSelectedWorkspaceId.value = String(crumb?.id || '');
    sandboxSelectedProjectId.value = '';
    sandboxSelectedAgentId.value = '';
  } else if (level === 2) {
    sandboxSelectedProjectId.value = String(crumb?.id || '');
  }
  bridge.navigateEnterpriseSandbox(level, crumb?.id || '').finally(refreshSnapshot);
}

function handleEnterpriseOpenProject(projectId) {
  sandboxSelectedProjectId.value = String(projectId || '');
  bridge.openEnterpriseProject(projectId).finally(refreshSnapshot);
}

function handleSandboxSelectProject(projectId) {
  sandboxSelectedProjectId.value = String(projectId || '');
}

function handleSandboxSelectAgent(agentId) {
  sandboxSelectedAgentId.value = String(agentId || '');
}

function handleSandboxOpenAgentChat(agentId) {
  sandboxSelectedAgentId.value = String(agentId || '');
  bridge.openEnterpriseSandboxAgentChat(agentId).finally(refreshSnapshot);
}

function handleSandboxEditAgent(agentId) {
  sandboxSelectedAgentId.value = String(agentId || '');
  bridge.openEnterpriseStaffRoleForm(agentId).finally(refreshSnapshot);
}

function handleSandboxCreateRoleForCurrentProject() {
  bridge.openEnterpriseStaffRoleForProject(
    enterpriseSandboxPanel.value.currentWorkspaceId,
    enterpriseSandboxPanel.value.currentProjectId || sandboxSelectedProjectId.value,
  ).finally(refreshSnapshot);
}

function handleEnterpriseKbCreate() {
  enterpriseKbDraft.value = {
    id: '',
    name: '',
    description: '',
    category: enterpriseKbCategories.value[1]?.id || 'general',
  };
  enterpriseKbVersionOpen.value = false;
  enterpriseKbSideMode.value = 'editor';
  enterpriseKbEditorOpen.value = true;
}

function handleEnterpriseKbEdit(row) {
  enterpriseKbDraft.value = {
    id: row?.id || '',
    name: row?.name || '',
    description: row?.description || '',
    category: row?.category || '',
  };
  enterpriseKbVersionOpen.value = false;
  enterpriseKbSideMode.value = 'editor';
  enterpriseKbEditorOpen.value = true;
}

async function handleEnterpriseKbSubmit() {
  try {
    await bridge.saveEnterpriseKnowledgeBase(enterpriseKbDraft.value);
    enterpriseKbEditorOpen.value = false;
    enterpriseKbSideMode.value = 'summary';
    refreshSnapshot();
  } catch (error) {
    // host notifications handle the visible error path when available
    console.error(error);
  }
}

function handleEnterpriseKbDelete(row) {
  bridge.deleteEnterpriseKnowledgeBase(row?.id).then(refreshSnapshot).catch((error) => {
    console.error(error);
  });
}

function parseMemoryListInput(value) {
  return [...new Set(String(value || '')
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean))];
}

function openMemoryCreateEditor() {
  memoryEditorMode.value = 'create';
  memoryActionError.value = '';
  memoryDraft.value = {
    memoryId: '',
    baseVersion: 0,
    taskId: '',
    title: '',
    content: '',
    qualityScore: 0.8,
    permissionsText: '',
    tagsText: '',
    reason: '',
  };
  memoryEditorOpen.value = true;
}

function openMemoryEditEditor() {
  const selected = data.value.memoryV3?.selectedMemory;
  if (!selected) return;
  memoryEditorMode.value = 'edit';
  memoryActionError.value = '';
  memoryDraft.value = {
    memoryId: String(selected.memoryId || ''),
    baseVersion: Number(selected.version || 0),
    taskId: String(selected.taskId || ''),
    title: String(selected.title || ''),
    content: String(selected.content || ''),
    qualityScore: Number(selected.qualityScore ?? 0.8),
    permissionsText: (selected.permissions || []).join(', '),
    tagsText: (selected.tags || []).join(', '),
    reason: '',
  };
  memoryEditorOpen.value = true;
}

async function submitMemoryEditor() {
  const draft = memoryDraft.value;
  if (!String(draft.title || '').trim() || !String(draft.content || '').trim()) return;
  if (memoryEditorMode.value === 'create' && !String(draft.taskId || '').trim()) return;
  memoryActionBusy.value = true;
  memoryActionError.value = '';
  try {
    const payload = {
      ...draft,
      qualityScore: Number(draft.qualityScore ?? 0.8),
      permissions: parseMemoryListInput(draft.permissionsText),
      tags: parseMemoryListInput(draft.tagsText),
    };
    if (memoryEditorMode.value === 'edit') {
      await bridge.editSynapxnetMemory(payload);
    } else {
      await bridge.createSynapxnetMemory(payload);
    }
    memoryEditorOpen.value = false;
    refreshSnapshot();
  } catch (error) {
    memoryActionError.value = String(error?.message || 'Memory operation failed.');
  } finally {
    memoryActionBusy.value = false;
  }
}

async function applyMemoryFilters() {
  memoryActionBusy.value = true;
  memoryActionError.value = '';
  try {
    await bridge.loadSynapxnetMemories({
      actorAgent: memoryActorAgent.value,
      query: memoryQuery.value,
      includeRetired: memoryIncludeRetired.value,
    });
    refreshSnapshot();
  } catch (error) {
    memoryActionError.value = String(error?.message || 'Memory list could not be loaded.');
  } finally {
    memoryActionBusy.value = false;
  }
}

async function handleMemorySelect(memoryId) {
  memoryActionError.value = '';
  try {
    await bridge.selectSynapxnetMemory(memoryId);
    refreshSnapshot();
  } catch (error) {
    memoryActionError.value = String(error?.message || 'Memory history could not be loaded.');
  }
}

async function handleMemoryRollback(version) {
  const selected = data.value.memoryV3?.selectedMemory;
  if (!selected || Number(version?.version) === Number(selected.version)) return;
  const confirmed = window.confirm(
    isZh.value
      ? `确认从 v${version.version} 创建一个新的回滚版本？历史版本不会被覆盖。`
      : `Create a new rollback version from v${version.version}? Existing history will remain unchanged.`
  );
  if (!confirmed) return;
  memoryActionBusy.value = true;
  try {
    await bridge.rollbackSynapxnetMemory(selected.memoryId, version.version, isZh.value ? '用户从版本时间线回滚' : 'User rollback from version timeline');
    refreshSnapshot();
  } catch (error) {
    memoryActionError.value = String(error?.message || 'Rollback failed.');
  } finally {
    memoryActionBusy.value = false;
  }
}

async function handleMemoryRetire() {
  const selected = data.value.memoryV3?.selectedMemory;
  if (!selected) return;
  const confirmed = window.confirm(isZh.value ? '确认退役当前记忆？历史版本仍会保留。' : 'Retire this memory? Its version history will be preserved.');
  if (!confirmed) return;
  memoryActionBusy.value = true;
  try {
    await bridge.retireSynapxnetMemory(selected.memoryId);
    refreshSnapshot();
  } catch (error) {
    memoryActionError.value = String(error?.message || 'Retire failed.');
  } finally {
    memoryActionBusy.value = false;
  }
}

async function handleMemoryVerify() {
  memoryActionBusy.value = true;
  try {
    await bridge.verifySynapxnetMemory('');
    refreshSnapshot();
  } catch (error) {
    memoryActionError.value = String(error?.message || 'Integrity verification failed.');
  } finally {
    memoryActionBusy.value = false;
  }
}

async function handleMemoryExport() {
  const selected = data.value.memoryV3?.selectedMemory;
  if (!selected) return;
  memoryActionBusy.value = true;
  try {
    const document = await bridge.exportSynapxnetMemories([selected.memoryId]);
    const blob = new Blob([JSON.stringify(document, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement('a');
    anchor.href = url;
    anchor.download = `openxnet-memory-${selected.memoryId.slice(0, 12)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    memoryActionError.value = String(error?.message || 'Memory export failed.');
  } finally {
    memoryActionBusy.value = false;
  }
}

function handleMemoryImport() {
  const input = window.document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    memoryActionBusy.value = true;
    try {
      const document = JSON.parse(await file.text());
      await bridge.importSynapxnetMemories(document);
      refreshSnapshot();
    } catch (error) {
      memoryActionError.value = String(error?.message || 'Memory import failed.');
    } finally {
      memoryActionBusy.value = false;
    }
  }, { once: true });
  input.click();
}

function formatMemoryTime(value) {
  return value ? new Date(value).toLocaleString() : '--';
}

function shortMemoryHash(value) {
  const normalized = String(value || '');
  return normalized ? `${normalized.slice(0, 8)}...${normalized.slice(-6)}` : '--';
}

/**
 * 将稳定记忆类型转换为当前语言的用户可读标签。
 *
 * @param {string} value Memory V3 返回的稳定类型。
 * @returns {string} 当前语言下的类型名称。
 */
function getMemoryTypeLabel(value) {
  const labels = {
    skill: isZh.value ? '技能记忆' : 'Skill',
    incident: isZh.value ? '事件记忆' : 'Incident',
    collaboration: isZh.value ? '协作记忆' : 'Collaboration',
    decision: isZh.value ? '决策记忆' : 'Decision',
    manual: isZh.value ? '人工记忆' : 'Manual',
  };
  return labels[String(value || 'manual')] || labels.manual;
}

/**
 * 为不同记忆类型选择稳定图标，便于快速识别来源。
 *
 * @param {string} value Memory V3 返回的稳定类型。
 * @returns {string} Font Awesome 图标类名。
 */
function getMemoryTypeIcon(value) {
  return {
    skill: 'fa-solid fa-wand-magic-sparkles',
    incident: 'fa-solid fa-circle-nodes',
    collaboration: 'fa-solid fa-people-group',
    decision: 'fa-solid fa-code-branch',
    manual: 'fa-solid fa-pen-to-square',
  }[String(value || 'manual')] || 'fa-solid fa-pen-to-square';
}

/**
 * 过滤内部类型标签并翻译常用业务标签，技术标识保持原值。
 *
 * @param {object} memory Memory V3 记忆记录。
 * @returns {Array<{key: string, label: string}>} 可直接渲染的标签列表。
 */
function getMemoryDisplayTags(memory) {
  const labels = {
    competition: isZh.value ? '比赛闭环' : 'Competition',
    'goai-staging': isZh.value ? '复赛验证环境' : 'GOAI staging',
    'resolved-incident': isZh.value ? '已验证事件' : 'Verified incident',
    'recommendation-capacity': isZh.value ? '推荐容量治理' : 'Recommendation capacity',
    'quantitative-iteration': isZh.value ? '量化模型迭代' : 'Quantitative iteration',
    'feature-drift': isZh.value ? '跨域特征漂移' : 'Feature drift',
  };
  return (memory?.tags || [])
    .filter((tag) => !String(tag).startsWith('memory-type:'))
    .map((tag) => ({ key: String(tag), label: labels[String(tag)] || String(tag) }));
}

/**
 * 生成记忆完整性与恢复来源文案；输入 Memory V3 快照，返回简短可验证状态。
 *
 * @param {object} memoryData Memory V3 界面快照。
 * @returns {string} 当前语言下的完整性和恢复结果。
 */
function getMemoryIntegrityMessage(memoryData) {
  const integrity = memoryData?.integrity;
  if (!integrity?.healthy) {
    return isZh.value ? '完整性校验发现异常' : 'Integrity verification found problems';
  }
  const recovery = memoryData?.recovery;
  if (recovery?.source === 'bundled-transfer' && Number(recovery.importedVersions || 0) > 0) {
    return isZh.value
      ? `已恢复 ${recovery.importedVersions} 个可信版本，记录链与审计链完整`
      : `${recovery.importedVersions} trusted versions restored; record and audit chains are healthy`;
  }
  if (recovery?.source === 'competition-history' && Number(recovery.reconciledMemories || 0) > 0) {
    return isZh.value
      ? `已补投影 ${recovery.reconciledMemories} 条成功闭环，记录链与审计链完整`
      : `${recovery.reconciledMemories} resolved workflows reconciled; record and audit chains are healthy`;
  }
  return isZh.value
    ? `已校验 ${integrity.checkedVersions} 个版本，记录链与审计链完整`
    : `${integrity.checkedVersions} versions verified; record and audit chains are healthy`;
}

async function handleEnterpriseKbVersions(row) {
  enterpriseKbEditorOpen.value = false;
  enterpriseKbSideMode.value = 'versions';
  enterpriseKbVersionOpen.value = true;
  enterpriseKbVersions.value = [];
  try {
    enterpriseKbVersions.value = await bridge.loadEnterpriseKnowledgeBaseVersions(row?.id);
  } catch (error) {
    console.error(error);
    enterpriseKbVersions.value = [];
  }
}

const data = computed(() => snapshot.value || {});
const isZh = computed(() => data.value.isZh);
const featurePackData = computed(() => data.value.featurePacks || {});
const vrmData = computed(() => data.value.vrm || {});
const vrmSelectedMotions = computed(() => (vrmData.value.motions || []).filter((m) => m.selected));
const enterpriseRolePanel = computed(() => data.value.rolePanel || {});
const enterpriseRoleItems = computed(() => enterpriseRolePanel.value.items || []);
const enterpriseRoleTemplates = computed(() => enterpriseRolePanel.value.templates || []);
const enterpriseWorkspacePanel = computed(() => data.value.workspacePanel || {});
const enterpriseSandboxPanel = computed(() => data.value.sandboxPanel || {});
const enterpriseKnowledgePanel = computed(() => data.value.knowledgePanel || {});
const synapxnetMemoryData = computed(() => data.value.memoryV3 || {});
const canEditSelectedMemory = computed(() => {
  const selected = synapxnetMemoryData.value.selectedMemory;
  return !!selected && String(selected.ownerAgent || '') === String(synapxnetMemoryData.value.actorAgent || '');
});
const enterpriseRoleCategories = computed(() => {
  const seen = new Set();
  const categories = [];
  enterpriseRoleTemplates.value.forEach((template) => {
    const id = String(template?.category || '').trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    categories.push({
      id,
      label: String(template?.categoryLabel || id),
    });
  });
  return [
    {
      id: 'all',
      label: isZh.value ? '全部岗位' : 'All Roles',
    },
    ...categories,
  ];
});
const enterpriseFilteredRoleTemplates = computed(() => {
  const category = String(enterpriseRoleCategory.value || 'all').trim();
  const query = String(enterpriseRoleQuery.value || '').trim().toLowerCase();
  return enterpriseRoleTemplates.value.filter((template) => {
    if (category !== 'all' && String(template?.category || '').trim() !== category) {
      return false;
    }
    if (!query) return true;
    const haystack = [
      template?.name,
      template?.department,
      template?.summary,
      template?.categoryLabel,
      ...(template?.skills || []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });
});
const enterpriseFeaturedRoleTemplates = computed(() => {
  const featured = enterpriseRoleTemplates.value.filter((template) => template?.featured);
  return (featured.length ? featured : enterpriseRoleTemplates.value).slice(0, 4);
});

const vrmDefaultModels = computed(() => vrmData.value.defaultModels || []);
const vrmCloudModels = computed(() => vrmData.value.cloudModels || []);
const vrmUserModels = computed(() => vrmData.value.userModels || []);
const vrmFilteredModels = computed(() => {
  const list = vrmModelTab.value === 'custom'
    ? vrmUserModels.value
    : (vrmModelTab.value === 'cloud' ? vrmCloudModels.value : vrmDefaultModels.value);
  const q = String(vrmModelQuery.value || '').trim().toLowerCase();
  if (!q) return list;
  return list.filter((m) => [m.name, m.id, m.relativePath].filter(Boolean).join(' ').toLowerCase().includes(q));
});
const vrmDefaultMotions = computed(() => (vrmData.value.motions || []).filter((m) => m.builtin));
const vrmUserMotions = computed(() => (vrmData.value.motions || []).filter((m) => !m.builtin));
const vrmFilteredMotions = computed(() => {
  const list = vrmMotionTab.value === 'custom' ? vrmUserMotions.value : vrmDefaultMotions.value;
  const q = String(vrmMotionQuery.value || '').trim().toLowerCase();
  if (!q) return list;
  return list.filter((m) => String(m.name || m.id || '').toLowerCase().includes(q));
});

function getEnterpriseRoleCategoryCount(categoryId) {
  if (String(categoryId || 'all') === 'all') {
    return enterpriseRoleTemplates.value.length;
  }
  return enterpriseRoleTemplates.value.filter((template) => String(template?.category || '') === String(categoryId || '')).length;
}

function getEnterpriseRoleAccentStyle(item) {
  const accent = Array.isArray(item?.accent) && item.accent.length
    ? item.accent
    : ['#4ecdc4', '#5b8cff'];
  return {
    '--ox-vite-role-accent-start': accent[0],
    '--ox-vite-role-accent-end': accent[1] || accent[0],
  };
}

function getWorkspacePermissionLabel(permission) {
  const value = String(permission || 'default');
  if (isZh.value) {
    const map = {
      default: '默认权限',
      readonly: '只读',
      write: '读写',
      admin: '管理',
    };
    return map[value] || value;
  }
  const map = {
    default: 'Default',
    readonly: 'Read only',
    write: 'Read / Write',
    admin: 'Admin',
  };
  return map[value] || value;
}

function getSandboxStatusLabel(status) {
  const value = String(status || '').trim().toLowerCase();
  if (isZh.value) {
    const map = {
      online: '在线',
      idle: '待命',
      busy: '执行中',
      running: '运行中',
      offline: '离线',
      unknown: '未知',
    };
    return map[value] || (status || '未知');
  }
  const map = {
    online: 'Online',
    idle: 'Idle',
    busy: 'Busy',
    running: 'Running',
    offline: 'Offline',
    unknown: 'Unknown',
  };
  return map[value] || (status || 'Unknown');
}

const enterpriseKbCategories = computed(() => {
  const seen = new Set();
  const items = [];
  (enterpriseKnowledgePanel.value.items || []).forEach((item) => {
    const category = String(item?.category || '').trim();
    if (!category || seen.has(category)) return;
    seen.add(category);
    items.push({ id: category, label: category });
  });
  return [
    {
      id: 'all',
      label: isZh.value ? '全部知识库' : 'All KBs',
    },
    ...items,
  ];
});

const enterpriseFilteredKbItems = computed(() => {
  const category = String(enterpriseKbCategory.value || 'all').trim();
  const query = String(enterpriseKbQuery.value || '').trim().toLowerCase();
  return (enterpriseKnowledgePanel.value.items || []).filter((item) => {
    if (category !== 'all' && String(item?.category || '') !== category) return false;
    if (!query) return true;
    const haystack = [item?.name, item?.category, item?.description].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(query);
  });
});
const enterpriseSelectedSandboxProject = computed(() => {
  const currentList = enterpriseSandboxPanel.value.projects || [];
  const selected = currentList.find((item) => String(item?.id || '') === String(sandboxSelectedProjectId.value || ''));
  return selected || currentList[0] || null;
});
const enterpriseSelectedSandboxAgent = computed(() => {
  const currentList = enterpriseSandboxPanel.value.items || [];
  const selected = currentList.find((item) => String(item?.id || '') === String(sandboxSelectedAgentId.value || ''));
  return selected || currentList[0] || null;
});
const enterpriseSelectedSandboxWorkspace = computed(() => {
  const currentList = enterpriseSandboxPanel.value.workspaces || [];
  const selectedId = String(sandboxSelectedWorkspaceId.value || enterpriseSandboxPanel.value.currentWorkspaceId || '');
  const selected = currentList.find((item) => String(item?.id || '') === selectedId);
  return selected || currentList[0] || null;
});

watch(
  enterpriseSandboxPanel,
  (panel) => {
    const currentWorkspaceId = String(panel?.currentWorkspaceId || '').trim();
    const currentProjectId = String(panel?.currentProjectId || '').trim();
    const currentAgentId = String(panel?.selectedAgentId || '').trim();
    if (currentWorkspaceId) {
      sandboxSelectedWorkspaceId.value = currentWorkspaceId;
    } else if (!(panel?.workspaces || []).some((item) => String(item?.id || '') === String(sandboxSelectedWorkspaceId.value || ''))) {
      sandboxSelectedWorkspaceId.value = '';
    }

    if (currentProjectId) {
      sandboxSelectedProjectId.value = currentProjectId;
    } else if (!(panel?.projects || []).some((item) => String(item?.id || '') === String(sandboxSelectedProjectId.value || ''))) {
      sandboxSelectedProjectId.value = '';
    }

    if (currentAgentId) {
      sandboxSelectedAgentId.value = currentAgentId;
    } else if (!(panel?.items || []).some((item) => String(item?.id || '') === String(sandboxSelectedAgentId.value || ''))) {
      sandboxSelectedAgentId.value = '';
    }
  },
  { deep: true }
);

watch(
  synapxnetMemoryData,
  (memory) => {
    if (!memoryActorAgent.value) memoryActorAgent.value = String(memory?.actorAgent || '');
    if (!memoryQuery.value && memory?.query) memoryQuery.value = String(memory.query);
    memoryIncludeRetired.value = !!memory?.includeRetired;
  },
  { deep: true, immediate: true }
);

onMounted(() => {
  refreshSnapshot();
  refreshTimer = window.setInterval(refreshSnapshot, 800);
});

onBeforeUnmount(() => {
  if (refreshTimer) {
    window.clearInterval(refreshTimer);
    refreshTimer = null;
  }
});
</script>

<template>
  <div class="ox-vite-ops-shell" :class="`surface-${props.surface}`">
    <template v-if="props.surface === 'task'">
      <div class="ox-vite-ops-header">
        <div>
          <div class="ox-vite-ops-header__kicker">{{ isZh ? 'Task Board' : 'Task Board' }}</div>
          <h1>{{ data.title }}</h1>
          <p>{{ data.subtitle }}</p>
        </div>
        <div class="ox-vite-ops-header__actions">
          <button type="button" class="ox-vite-ops-secondary-btn" @click="handleRefresh">
            <i class="fa-solid fa-rotate-right"></i>
            <span>{{ isZh ? '刷新' : 'Refresh' }}</span>
          </button>
        </div>
      </div>

      <div class="ox-vite-task-shell">
        <section class="ox-vite-task-board">
          <article
            v-for="column in data.columns || []"
            :key="column.id"
            class="ox-vite-task-column"
          >
            <div class="ox-vite-task-column__head">
              <h2>{{ column.title }}</h2>
              <span>{{ (column.tasks || []).length }}</span>
            </div>

            <div v-if="!(column.tasks || []).length" class="ox-vite-task-empty">
              <strong>{{ column.emptyTitle }}</strong>
              <p>{{ column.emptyCopy }}</p>
            </div>

            <button
              v-for="task in column.tasks || []"
              :key="task.id"
              type="button"
              class="ox-vite-task-card"
              :class="`is-${task.status || 'pending'}`"
              @click="handleOpenTask(task.raw)"
            >
              <div class="ox-vite-task-card__title">{{ task.title }}</div>
              <div class="ox-vite-task-card__summary">{{ task.summary }}</div>
              <div v-if="task.progress !== null" class="ox-vite-task-progress">
                <div class="ox-vite-task-progress__fill" :style="{ width: `${Math.max(0, Math.min(100, task.progress))}%` }"></div>
              </div>
              <div class="ox-vite-task-card__meta">
                <span>{{ task.assignee || (isZh ? '未分配' : 'Unassigned') }}</span>
                <span>{{ task.updatedAt }}</span>
              </div>
            </button>
          </article>
        </section>

        <aside class="ox-vite-task-detail">
          <div class="ox-vite-task-detail__head">
            <h2>{{ isZh ? '任务详情' : 'Task Detail' }}</h2>
          </div>
          <template v-if="data.detail">
            <div class="ox-vite-task-detail__title">{{ data.detail.title }}</div>
            <div class="ox-vite-detail-chip">{{ data.detail.status || (isZh ? '待处理' : 'Pending') }}</div>
            <p class="ox-vite-task-detail__summary">{{ data.detail.summary }}</p>
            <div class="ox-vite-task-detail__trace">
              <div
                v-for="item in data.detail.trace || []"
                :key="item.id"
                class="ox-vite-task-detail__trace-item"
              >
                {{ item.text }}
              </div>
            </div>
          </template>
          <template v-else>
            <div class="ox-vite-empty-state">
              <i class="fa-solid fa-list-check"></i>
              <strong>{{ isZh ? '选择一个任务查看详情' : 'Select a task to inspect' }}</strong>
            </div>
          </template>
        </aside>
      </div>
    </template>

    <template v-else-if="props.surface === 'about'">
      <div class="ox-vite-about-shell">
        <div class="ox-vite-about-mark"><img :src="'/source/icon.png'" alt="OpenXnet" /></div>
        <div class="ox-vite-about-name">{{ data.title }}</div>
        <div class="ox-vite-detail-chip">v{{ data.version }}</div>
        <p class="ox-vite-about-copy">{{ data.subtitle }}</p>

        <section class="ox-vite-about-grid">
          <article v-for="feature in data.features || []" :key="feature.title" class="ox-vite-info-card">
            <div class="ox-vite-info-card__icon"><i :class="feature.icon"></i></div>
            <div>
              <h3>{{ feature.title }}</h3>
              <p>{{ feature.description }}</p>
            </div>
          </article>
        </section>

        <section class="ox-vite-link-grid">
          <a v-for="link in data.links || []" :key="link.href" class="ox-vite-link-card" :href="link.href" target="_blank" rel="noreferrer">
            <span>{{ link.label }}</span>
            <strong>{{ link.value }}</strong>
          </a>
        </section>

        <section class="ox-vite-fact-list">
          <article v-for="fact in data.facts || []" :key="fact.label" class="ox-vite-fact-row">
            <span>{{ fact.label }}</span>
            <p>{{ fact.value }}</p>
          </article>
        </section>

      </div>
    </template>

    <template v-else-if="props.surface === 'vrm'">
      <div class="ox-vite-vrm-layout">
        <!-- Left: scrollable configuration column -->
        <div class="ox-vite-vrm-config">
          <header class="ox-vite-vrm-topbar">
            <div class="ox-vite-vrm-topbar__title">
              <div class="ox-vite-ops-header__kicker">{{ isZh ? 'VRM 桌宠' : 'VRM Pet' }}</div>
              <h1>{{ data.title }}</h1>
              <p>{{ data.subtitle }}</p>
              <div v-if="data.meta?.setupSteps?.length" class="ox-vite-vrm-guide">
                <div class="ox-vite-vrm-guide__note">
                  <i class="fa-solid fa-route"></i>
                  <span>{{ data.meta?.guideNote }}</span>
                </div>
                <div class="ox-vite-vrm-guide__steps">
                  <span
                    v-for="(step, index) in data.meta?.setupSteps || []"
                    :key="step.title"
                    class="ox-vite-vrm-guide__step"
                  >
                    <span class="ox-vite-vrm-guide__step-index">{{ index + 1 }}</span>
                    <i :class="step.icon"></i>
                    <span class="ox-vite-vrm-guide__step-copy">
                      <strong>{{ step.title }}</strong>
                      <small>{{ step.desc }}</small>
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </header>

          <!-- Quick chips -->
          <section v-if="data.meta?.chips?.length" class="ox-vite-vrm-chips">
            <span v-for="chip in data.meta.chips || []" :key="chip.icon + chip.text" class="ox-vite-detail-chip">
              <i :class="chip.icon"></i>
              <span>{{ chip.text }}</span>
            </span>
          </section>

          <!-- Stats strip -->
          <section v-if="data.stats?.length" class="ox-vite-vrm-statgrid">
            <article v-for="card in data.stats" :key="card.label" class="ox-vite-stat-card" :class="{ emphasis: card.emphasis }">
              <span>{{ card.label }}</span>
              <strong>{{ card.value }}</strong>
              <small>{{ card.meta }}</small>
            </article>
          </section>

          <!-- Model picker (tabs + search + list) -->
          <article class="ox-vite-panel-card">
            <div class="ox-vite-panel-card__head">
              <div>
                <h2>{{ isZh ? 'VRM 模型' : 'VRM Model' }}</h2>
                <p>{{ isZh ? '内置和自定义模型分开管理，搜索过滤后从列表中点选。' : 'Built-in and custom models are split. Search to filter, click to select.' }}</p>
              </div>
              <button type="button" class="ox-vite-ops-secondary-btn" @click="handleVrmAddModel">
                <i class="fa-solid fa-plus"></i>
                <span>{{ isZh ? '上传模型' : 'Upload' }}</span>
              </button>
            </div>

            <div class="ox-vite-vrm-tabs">
              <button
                type="button"
                class="ox-vite-vrm-tab"
                :class="{ 'is-active': vrmModelTab === 'builtin' }"
                @click="vrmModelTab = 'builtin'"
              >
                <i class="fa-solid fa-star"></i>
                <span>{{ isZh ? '内置模型' : 'Built-in' }}</span>
                <span class="ox-vite-vrm-tab__count">{{ vrmDefaultModels.length }}</span>
              </button>
              <button
                type="button"
                class="ox-vite-vrm-tab"
                :class="{ 'is-active': vrmModelTab === 'cloud' }"
                @click="vrmModelTab = 'cloud'"
              >
                <i class="fa-solid fa-cloud-arrow-down"></i>
                <span>{{ isZh ? '资源库' : 'Library' }}</span>
                <span class="ox-vite-vrm-tab__count">{{ vrmCloudModels.length }}</span>
              </button>
              <button
                type="button"
                class="ox-vite-vrm-tab"
                :class="{ 'is-active': vrmModelTab === 'custom' }"
                @click="vrmModelTab = 'custom'"
              >
                <i class="fa-solid fa-user"></i>
                <span>{{ isZh ? '自定义' : 'Custom' }}</span>
                <span class="ox-vite-vrm-tab__count">{{ vrmUserModels.length }}</span>
              </button>
            </div>

            <div class="ox-vite-vrm-search">
              <i class="fa-solid fa-magnifying-glass"></i>
              <input
                type="text"
                :placeholder="isZh ? '搜索模型...' : 'Search models...'"
                v-model="vrmModelQuery"
              />
              <button v-if="vrmModelQuery" type="button" class="ox-vite-vrm-search__clear" @click="vrmModelQuery = ''">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div class="ox-vite-vrm-list">
              <button
                v-for="model in vrmFilteredModels"
                :key="model.id"
                type="button"
                class="ox-vite-vrm-row"
                :class="{
                  'is-active': vrmData.selectedModelId === model.id,
                  'is-cloud': model.cloud,
                  'is-downloading': vrmDownloadingModelId === model.id,
                }"
                :disabled="vrmDownloadingModelId === model.id"
                @click="handleVrmSelectModel(model)"
              >
                <span class="ox-vite-vrm-row__icon">
                  <i :class="model.cloud ? 'fa-solid fa-cloud-arrow-down' : (model.builtin ? 'fa-solid fa-vr-cardboard' : 'fa-solid fa-cube')"></i>
                </span>
                <span class="ox-vite-vrm-row__main">
                  <span class="ox-vite-vrm-row__name">{{ model.name }}</span>
                  <span class="ox-vite-vrm-row__sub">
                    {{
                      model.cloud
                        ? (model.downloaded ? (isZh ? '已下载资源' : 'Downloaded resource') : (isZh ? '云端资源，点击下载' : 'Cloud resource, click to download'))
                        : (model.builtin ? (isZh ? '内置模型' : 'Built-in') : (isZh ? '自定义模型' : 'Custom'))
                    }}
                  </span>
                </span>
                <i v-if="vrmData.selectedModelId === model.id" class="fa-solid fa-circle-check ox-vite-vrm-row__check"></i>
                <span
                  v-else-if="model.cloud"
                  class="ox-vite-vrm-row__download"
                  :class="{ 'is-ready': model.downloaded }"
                  @click="model.downloaded ? handleVrmSelectModel(model) : handleVrmDownloadModel(model, $event)"
                >
                  <i :class="vrmDownloadingModelId === model.id ? 'fa-solid fa-spinner fa-spin' : (model.downloaded ? 'fa-solid fa-check' : 'fa-solid fa-download')"></i>
                  <span>
                    {{
                      vrmDownloadingModelId === model.id
                        ? (isZh ? '下载中' : 'Downloading')
                        : (model.downloaded ? (isZh ? '使用' : 'Use') : (isZh ? '下载' : 'Download'))
                    }}
                  </span>
                </span>
                <span
                  v-if="!model.builtin && (!model.cloud || model.downloaded)"
                  class="ox-vite-vrm-row__del"
                  :title="isZh ? '删除' : 'Delete'"
                  @click="handleVrmDeleteModel(model.id, $event)"
                >
                  <i class="fa-regular fa-trash-can"></i>
                </span>
              </button>
              <div v-if="!vrmFilteredModels.length" class="ox-vite-vrm-empty">
                <span v-if="vrmModelTab === 'custom' && !vrmUserModels.length">
                  {{ isZh ? '尚未上传自定义模型' : 'No custom models yet' }}
                </span>
                <span v-else-if="vrmModelTab === 'cloud' && !vrmCloudModels.length">
                  {{ isZh ? '资源库暂无可下载模型' : 'No downloadable models yet' }}
                </span>
                <span v-else-if="vrmModelQuery">
                  {{ isZh ? '没有匹配的模型' : 'No matching models' }}
                </span>
                <span v-else>{{ isZh ? '无可用模型' : 'No models available' }}</span>
              </div>
            </div>
          </article>

          <!-- Behavior / Window settings -->
          <article class="ox-vite-panel-card">
            <div class="ox-vite-panel-card__head">
              <div>
                <h2>{{ isZh ? '动作与窗口' : 'Behavior & Window' }}</h2>
                <p>{{ isZh ? '主智能体、表情/动作开关与桌宠默认窗口尺寸。' : 'Main agent, expression/motion toggles, and default window size.' }}</p>
              </div>
            </div>
            <div class="ox-vite-form-grid">
              <label class="ox-vite-field">
                <span>{{ isZh ? '主智能体' : 'Main Agent' }}</span>
                <select :value="vrmData.mainAgent" @change="handleVrmSetAgent">
                  <option v-for="opt in vrmData.agentOptions || []" :key="opt.id" :value="opt.id">{{ opt.name }}</option>
                </select>
              </label>
              <label class="ox-vite-field">
                <span>{{ isZh ? '启用表情' : 'Enable expressions' }}</span>
                <span class="ox-vite-vrm-toggle">
                  <input type="checkbox" :checked="vrmData.enabledExpressions" @change="handleVrmSetExpressions" />
                  <span>{{ vrmData.enabledExpressions ? (isZh ? '已开启' : 'On') : (isZh ? '已关闭' : 'Off') }}</span>
                </span>
              </label>
              <label class="ox-vite-field">
                <span>{{ isZh ? '启用动作' : 'Enable motions' }}</span>
                <span class="ox-vite-vrm-toggle">
                  <input type="checkbox" :checked="vrmData.enabledMotions" @change="handleVrmSetMotionsEnabled" />
                  <span>{{ vrmData.enabledMotions ? (isZh ? '已开启' : 'On') : (isZh ? '已关闭' : 'Off') }}</span>
                </span>
              </label>
              <label class="ox-vite-field">
                <span>{{ isZh ? '窗口宽度 (px)' : 'Width (px)' }}</span>
                <input type="number" min="300" max="3840" step="10" :value="vrmData.windowWidth" @change="handleVrmSetWidth" />
              </label>
              <label class="ox-vite-field">
                <span>{{ isZh ? '窗口高度 (px)' : 'Height (px)' }}</span>
                <input type="number" min="300" max="3840" step="10" :value="vrmData.windowHeight" @change="handleVrmSetHeight" />
              </label>
            </div>
          </article>

          <!-- Motion picker (tabs + search + list) -->
          <article class="ox-vite-panel-card">
            <div class="ox-vite-panel-card__head">
              <div>
                <h2>{{ isZh ? 'VRMA 动作' : 'VRMA Motions' }}</h2>
                <p>{{ isZh ? '在内置 / 自定义两组动作里勾选启用项，会同步进桌宠运行环境。' : 'Tick motions from built-in or custom groups; the desktop pet picks them up.' }}</p>
              </div>
              <button type="button" class="ox-vite-ops-secondary-btn" @click="handleVrmAddMotion">
                <i class="fa-solid fa-plus"></i>
                <span>{{ isZh ? '上传动作' : 'Upload' }}</span>
              </button>
            </div>

            <div class="ox-vite-vrm-tabs">
              <button
                type="button"
                class="ox-vite-vrm-tab"
                :class="{ 'is-active': vrmMotionTab === 'builtin' }"
                @click="vrmMotionTab = 'builtin'"
              >
                <i class="fa-solid fa-star"></i>
                <span>{{ isZh ? '内置动作' : 'Built-in' }}</span>
                <span class="ox-vite-vrm-tab__count">{{ vrmDefaultMotions.length }}</span>
              </button>
              <button
                type="button"
                class="ox-vite-vrm-tab"
                :class="{ 'is-active': vrmMotionTab === 'custom' }"
                @click="vrmMotionTab = 'custom'"
              >
                <i class="fa-solid fa-user"></i>
                <span>{{ isZh ? '自定义' : 'Custom' }}</span>
                <span class="ox-vite-vrm-tab__count">{{ vrmUserMotions.length }}</span>
              </button>
            </div>

            <div class="ox-vite-vrm-search">
              <i class="fa-solid fa-magnifying-glass"></i>
              <input
                type="text"
                :placeholder="isZh ? '搜索动作...' : 'Search motions...'"
                v-model="vrmMotionQuery"
              />
              <button v-if="vrmMotionQuery" type="button" class="ox-vite-vrm-search__clear" @click="vrmMotionQuery = ''">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div class="ox-vite-vrm-list">
              <button
                v-for="motion in vrmFilteredMotions"
                :key="motion.id"
                type="button"
                class="ox-vite-vrm-row"
                :class="{ 'is-active': motion.selected }"
                @click="handleVrmToggleMotion(motion.id)"
              >
                <span class="ox-vite-vrm-row__icon">
                  <i :class="motion.selected ? 'fa-solid fa-circle-check' : 'fa-regular fa-circle'"></i>
                </span>
                <span class="ox-vite-vrm-row__main">
                  <span class="ox-vite-vrm-row__name">{{ motion.name }}</span>
                  <span class="ox-vite-vrm-row__sub">{{ motion.builtin ? (isZh ? '内置动作' : 'Built-in') : (isZh ? '自定义动作' : 'Custom') }}</span>
                </span>
                <span
                  v-if="!motion.builtin"
                  class="ox-vite-vrm-row__del"
                  :title="isZh ? '删除' : 'Delete'"
                  @click="handleVrmDeleteMotion(motion.id, $event)"
                >
                  <i class="fa-regular fa-trash-can"></i>
                </span>
              </button>
              <div v-if="!vrmFilteredMotions.length" class="ox-vite-vrm-empty">
                <span v-if="vrmMotionTab === 'custom' && !vrmUserMotions.length">
                  {{ isZh ? '尚未上传自定义动作' : 'No custom motions yet' }}
                </span>
                <span v-else-if="vrmMotionQuery">
                  {{ isZh ? '没有匹配的动作' : 'No matching motions' }}
                </span>
                <span v-else>{{ isZh ? '无可用动作' : 'No motions available' }}</span>
              </div>
            </div>
          </article>

        </div>

        <!-- Right: live preview (fixed, fills column, no scroll) -->
        <aside class="ox-vite-vrm-preview">
          <div class="ox-vite-vrm-preview__head">
            <div>
              <h2>{{ isZh ? '实时预览' : 'Live Preview' }}</h2>
              <p>
                <span>{{ vrmData.selectedModel?.name || (isZh ? '未选择模型' : 'No model') }}</span>
                <span v-if="vrmSelectedMotions.length"> · {{ vrmSelectedMotions.length }} {{ isZh ? '个动作' : 'motions' }}</span>
              </p>
            </div>
            <label class="ox-vite-vrm-preview__toggle">
              <input type="checkbox" v-model="vrmLivePreview" />
              <span>{{ vrmLivePreview ? (isZh ? '关闭预览' : 'Hide') : (isZh ? '开启预览' : 'Show') }}</span>
            </label>
          </div>

          <div class="ox-vite-vrm-preview__stage">
            <div
              v-if="vrmLivePreview && vrmData.previewUrl && vrmData.isElectron"
              class="ox-vite-vrm-preview__frame"
            >
              <webview
                :key="vrmData.previewKey || vrmData.previewUrl"
                :src="vrmData.previewUrl"
                partition="persist:openxnet-vrm-preview"
                class="ox-vite-vrm-preview__webview"
                allowpopups
                webpreferences="transparent=true"
              ></webview>
            </div>
            <div
              v-else-if="vrmLivePreview && vrmData.previewUrl"
              class="ox-vite-vrm-preview__frame"
            >
              <iframe
                :key="vrmData.previewKey || vrmData.previewUrl"
                :src="vrmData.previewUrl"
                class="ox-vite-vrm-preview__iframe"
                referrerpolicy="no-referrer"
                allowtransparency="true"
              ></iframe>
            </div>
            <div v-else class="ox-vite-vrm-preview__placeholder">
              <div class="ox-vite-vrm-preview__hero">
                <i class="fa-solid fa-vr-cardboard"></i>
              </div>
              <h3>{{ vrmData.selectedModel?.name || (isZh ? '未选择模型' : 'No model selected') }}</h3>
              <p>
                {{ isZh
                  ? '点击"开启预览"加载 VRM 模型，桌宠未运行时也能看到当前选择的模型与动作。'
                  : 'Toggle preview to load the VRM. Visible even when the desktop pet is stopped.' }}
              </p>
            </div>
          </div>

          <div class="ox-vite-vrm-preview__actions ox-vite-vrm-preview__actions--top">
            <button type="button" class="ox-vite-ops-secondary-btn" @click="handleVrmStartWeb">
              <i class="fa-solid fa-window-maximize"></i>
              <span>{{ isZh ? '浏览器预览' : 'Browser preview' }}</span>
            </button>
            <button
              v-if="vrmData.isElectron"
              type="button"
              class="ox-vite-ops-primary-btn"
              :disabled="vrmData.starting"
              @click="handleVrmStart"
            >
              <i :class="vrmData.starting ? 'fa-solid fa-spinner fa-spin' : (vrmData.running ? 'fa-solid fa-rotate' : 'fa-solid fa-play')"></i>
              <span>
                {{
                  vrmData.starting
                    ? (isZh ? '启动中...' : 'Starting...')
                    : (vrmData.running ? (isZh ? '重启桌宠' : 'Restart pet') : (isZh ? '启动桌宠' : 'Start pet'))
                }}
              </span>
            </button>
          </div>

          <div class="ox-vite-vrm-preview__motions" v-if="vrmSelectedMotions.length">
            <div class="ox-vite-vrm-section-label">{{ isZh ? '已启用动作' : 'Enabled motions' }}</div>
            <div class="ox-vite-vrm-preview__motion-chips">
              <span v-for="m in vrmSelectedMotions" :key="m.id" class="ox-vite-detail-chip">
                <i class="fa-solid fa-person-running"></i>
                <span>{{ m.name }}</span>
              </span>
            </div>
          </div>

          <div class="ox-vite-vrm-preview__actions">
            <button type="button" class="ox-vite-ops-secondary-btn" @click="handleVrmStartWeb">
              <i class="fa-solid fa-window-maximize"></i>
              <span>{{ isZh ? '浏览器' : 'Browser' }}</span>
            </button>
            <button
              v-if="vrmData.isElectron"
              type="button"
              class="ox-vite-ops-primary-btn"
              :disabled="vrmData.starting"
              @click="handleVrmStart"
            >
              <i :class="vrmData.starting ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-play'"></i>
              <span>{{ vrmData.running ? (isZh ? '重启' : 'Restart') : (isZh ? '启动' : 'Start') }}</span>
            </button>
          </div>
        </aside>
      </div>
    </template>

    <template v-else>
      <div class="ox-vite-ops-header">
        <div>
          <div class="ox-vite-ops-header__kicker">{{ data.meta?.title || data.title }}</div>
          <h1>{{ data.title }}</h1>
          <p>{{ data.subtitle }}</p>
        </div>
        <div class="ox-vite-ops-header__actions">
          <button type="button" class="ox-vite-ops-secondary-btn" @click="handleRefresh">
            <i class="fa-solid fa-rotate-right"></i>
            <span>{{ isZh ? '同步状态' : 'Sync Status' }}</span>
          </button>
          <button
            v-if="['deploy', 'workbench', 'storage', 'kernel', 'system'].includes(props.surface)"
            type="button"
            class="ox-vite-ops-primary-btn"
            @click="handlePrimaryAction"
          >
            <i :class="props.surface === 'storage' && data.activeTab === 'memory-v3' ? 'fa-solid fa-plus' : 'fa-solid fa-arrow-right'"></i>
            <span>
              {{
                props.surface === 'deploy'
                  ? (isZh ? '启动主机器人' : 'Start primary bot')
                  : props.surface === 'workbench'
                    ? (isZh ? '打开任务中心' : 'Open task center')
                    : props.surface === 'storage'
                      ? (data.activeTab === 'memory-v3' ? (isZh ? '新建记忆' : 'New memory') : (isZh ? '进入文件库' : 'Open file vault'))
                      : props.surface === 'kernel'
                        ? (isZh ? '查看行动队列' : 'Open action queue')
                        : (data.activeTab === 'about' ? (isZh ? '检查更新' : 'Check Updates') : (isZh ? '查看更新内容' : 'Open update content'))
              }}
            </span>
          </button>
        </div>
      </div>

      <div v-if="props.surface === 'system'" class="ox-vite-system-layout">
        <aside class="ox-vite-side-tabs">
          <button
            v-for="tab in data.tabs || []"
            :key="tab.id"
            type="button"
            class="ox-vite-side-tab"
            :class="{ active: data.activeTab === tab.id }"
            @click="handleSelectTab(tab.id)"
          >
            <i :class="tab.icon"></i>
            <span>{{ tab.label }}</span>
          </button>
        </aside>

        <main class="ox-vite-ops-main">
          <section class="ox-vite-stat-grid">
            <article v-for="card in data.stats || []" :key="card.label" class="ox-vite-stat-card" :class="{ emphasis: card.emphasis }">
              <span>{{ card.label }}</span>
              <strong>{{ card.value }}</strong>
              <small>{{ card.meta }}</small>
            </article>
          </section>

          <section class="ox-vite-panel-card">
            <div class="ox-vite-panel-card__head">
              <h2>{{ data.currentMeta?.heading }}</h2>
              <p>{{ data.currentMeta?.summary }}</p>
            </div>

            <div v-if="data.activeTab === 'general'" class="ox-vite-settings-stack">
              <section class="ox-vite-settings-section">
                <div class="ox-vite-settings-section__label">{{ isZh ? '语言与区域' : 'Language & Region' }}</div>
                <article class="ox-vite-settings-row">
                  <div>
                    <strong>{{ isZh ? '界面语言' : 'Interface Language' }}</strong>
                    <p>{{ isZh ? '选择 OpenXnet 界面显示语言。' : 'Choose the language used by the OpenXnet interface.' }}</p>
                  </div>
                  <select class="ox-vite-select" :value="data.settings?.language" @change="handleSystemSettingEvent('language', $event)">
                    <option v-for="option in data.languageOptions || []" :key="option.value" :value="option.value">{{ option.label }}</option>
                  </select>
                </article>
                <article class="ox-vite-settings-row">
                  <div>
                    <strong>{{ isZh ? '目标输出语言' : 'Target Output Language' }}</strong>
                    <p>{{ isZh ? '控制模型回答时优先使用的语言。' : 'Controls the preferred language for model replies.' }}</p>
                  </div>
                  <select class="ox-vite-select" :value="data.targetLanguage" @change="handleSystemTargetLanguage">
                    <option v-for="option in data.targetLanguageOptions || []" :key="option.value" :value="option.value">{{ option.label }}</option>
                  </select>
                </article>
                <article class="ox-vite-settings-row ox-vite-settings-row--wide">
                  <div>
                    <strong>{{ isZh ? '时区' : 'Timezone' }}</strong>
                    <p>{{ isZh ? '用于时间显示、任务计划和更新记录。' : 'Used by timestamps, scheduled tasks, and release records.' }}</p>
                  </div>
                  <div class="ox-vite-segmented">
                    <button
                      v-for="option in data.timezoneOptions || []"
                      :key="option.value"
                      type="button"
                      :class="{ active: data.settings?.timezone === option.value }"
                      @click="handleSystemSettingChange('timezone', option.value)"
                    >
                      {{ option.label }}
                    </button>
                  </div>
                </article>
                <article class="ox-vite-settings-row ox-vite-settings-row--wide">
                  <div>
                    <strong>{{ isZh ? '日期格式' : 'Date Format' }}</strong>
                    <p>{{ isZh ? '选择日期在系统页面中的显示方式。' : 'Choose how dates are displayed across system pages.' }}</p>
                  </div>
                  <div class="ox-vite-segmented">
                    <button
                      v-for="option in data.dateFormatOptions || []"
                      :key="option.value"
                      type="button"
                      :class="{ active: data.settings?.dateFormat === option.value }"
                      @click="handleSystemSettingChange('dateFormat', option.value)"
                    >
                      {{ option.label }}
                    </button>
                  </div>
                </article>
              </section>

              <section class="ox-vite-settings-section">
                <div class="ox-vite-settings-section__label">{{ isZh ? '启动行为' : 'Startup' }}</div>
                <article class="ox-vite-settings-row">
                  <div>
                    <strong>{{ isZh ? '开机自启' : 'Launch at Startup' }}</strong>
                    <p>{{ isZh ? '系统启动后自动运行 OpenXnet。' : 'Run OpenXnet automatically after system startup.' }}</p>
                  </div>
                  <label class="ox-vite-switch">
                    <input type="checkbox" :checked="data.settings?.launchAtStartup" @change="handleSystemBooleanSetting('launchAtStartup', $event)" />
                    <span></span>
                  </label>
                </article>
                <article class="ox-vite-settings-row">
                  <div>
                    <strong>{{ isZh ? '启动时最小化' : 'Start Minimized' }}</strong>
                    <p>{{ isZh ? '启动后进入托盘，不打断当前桌面。' : 'Start into the tray without interrupting the desktop.' }}</p>
                  </div>
                  <label class="ox-vite-switch">
                    <input type="checkbox" :checked="data.settings?.startMinimized" @change="handleSystemBooleanSetting('startMinimized', $event)" />
                    <span></span>
                  </label>
                </article>
              </section>

              <section class="ox-vite-settings-section">
                <div class="ox-vite-settings-section__label">{{ isZh ? '数据与隐私' : 'Data & Privacy' }}</div>
                <article class="ox-vite-settings-row">
                  <div>
                    <strong>{{ isZh ? '清理运行缓存' : 'Clear Runtime Cache' }}</strong>
                    <p>{{ isZh ? '清理 Service Worker 与 Cache Storage，重新加载后获取最新 UI。' : 'Clear Service Worker and Cache Storage so the latest UI loads after refresh.' }}</p>
                  </div>
                  <button type="button" class="ox-vite-ops-secondary-btn" @click="handleSystemClearCache">
                    <i class="fa-solid fa-broom"></i>
                    <span>{{ isZh ? '清除缓存' : 'Clear' }}</span>
                  </button>
                </article>
              </section>
            </div>

            <div v-else-if="data.activeTab === 'appearance'" class="ox-vite-settings-stack">
              <section class="ox-vite-settings-section">
                <div class="ox-vite-settings-section__label">{{ isZh ? '主题模式' : 'Theme Mode' }}</div>
                <div class="ox-vite-theme-grid">
                  <button
                    v-for="theme in data.themeOptions || []"
                    :key="theme.value"
                    type="button"
                    class="ox-vite-theme-card"
                    :class="{ active: data.settings?.theme === theme.value }"
                    @click="handleSystemSettingChange('theme', theme.value)"
                  >
                    <span class="ox-vite-theme-card__preview" :class="`theme-${theme.value}`">
                      <i></i><i></i><i></i>
                    </span>
                    <strong>{{ theme.label }}</strong>
                    <small>{{ data.settings?.theme === theme.value ? (isZh ? '当前使用' : 'Current') : (isZh ? '点击切换' : 'Switch') }}</small>
                  </button>
                </div>
              </section>
            </div>

            <div v-else-if="data.activeTab === 'shortcuts'" class="ox-vite-settings-stack">
              <section class="ox-vite-settings-section">
                <div class="ox-vite-settings-section__label">{{ isZh ? '已注册快捷键' : 'Registered Shortcuts' }}</div>
                <article v-for="row in data.shortcutRows || []" :key="row.key || row.label" class="ox-vite-settings-row">
                  <div>
                    <strong>{{ row.label }}</strong>
                    <p>{{ row.description }}</p>
                  </div>
                  <div class="ox-vite-shortcut-state">
                    <kbd>{{ row.shortcut }}</kbd>
                    <span class="ox-vite-status-pill" :class="{ active: row.registered }">{{ row.registered ? (isZh ? '已注册' : 'Ready') : (isZh ? '未注册' : 'Unavailable') }}</span>
                  </div>
                </article>
              </section>
              <section class="ox-vite-settings-section">
                <div class="ox-vite-settings-section__label">{{ isZh ? '快速操作' : 'Quick Actions' }}</div>
                <article v-for="action in data.quickActions || []" :key="action.id" class="ox-vite-settings-row">
                  <div>
                    <strong><i :class="action.icon"></i>{{ action.label }}</strong>
                    <p>{{ action.description }}</p>
                  </div>
                  <button type="button" class="ox-vite-ops-secondary-btn" @click="handleSystemQuickAction(action.id)">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i>
                    <span>{{ isZh ? '打开' : 'Open' }}</span>
                  </button>
                </article>
              </section>
            </div>

            <div v-else-if="data.activeTab === 'network'" class="ox-vite-settings-stack">
              <section class="ox-vite-settings-section">
                <div class="ox-vite-settings-section__label">{{ isZh ? '网络与代理' : 'Network & Proxy' }}</div>
                <article class="ox-vite-settings-row">
                  <div>
                    <strong>{{ isZh ? '网络模式' : 'Network Mode' }}</strong>
                    <p>{{ isZh ? '决定桌面服务在本机或局域网中的可见范围。' : 'Controls whether the desktop service is local-only or visible on the LAN.' }}</p>
                  </div>
                  <select class="ox-vite-select" :value="data.settings?.network" @change="handleSystemSettingEvent('network', $event)">
                    <option v-for="option in data.networkOptions || []" :key="option.value" :value="option.value">{{ option.label }}</option>
                  </select>
                </article>
                <article class="ox-vite-settings-row">
                  <div>
                    <strong>{{ isZh ? '代理模式' : 'Proxy Mode' }}</strong>
                    <p>{{ isZh ? '用于模型、插件、资源下载和外部服务访问。' : 'Used for models, plugins, resource downloads, and external services.' }}</p>
                  </div>
                  <select class="ox-vite-select" :value="data.settings?.proxyMode" @change="handleSystemSettingEvent('proxyMode', $event)">
                    <option v-for="option in data.proxyOptions || []" :key="option.value" :value="option.value">{{ option.label }}</option>
                  </select>
                </article>
                <article v-if="data.settings?.proxyMode === 'manual'" class="ox-vite-settings-row ox-vite-settings-row--wide">
                  <div>
                    <strong>{{ isZh ? '代理地址' : 'Proxy Address' }}</strong>
                    <p>{{ isZh ? '示例：http://127.0.0.1:7890。SOCKS 代理会被后端保护性拦截。' : 'Example: http://127.0.0.1:7890. SOCKS proxies are blocked by the backend guard.' }}</p>
                  </div>
                  <input
                    class="ox-vite-text-input"
                    :value="data.settings?.proxy"
                    type="text"
                    placeholder="http://127.0.0.1:7890"
                    @change="handleSystemSettingEvent('proxy', $event)"
                  />
                </article>
              </section>
            </div>

            <div v-else-if="data.activeTab === 'feature-packs'" class="ox-vite-feature-packs">
              <div class="ox-vite-feature-packs__toolbar">
                <div class="ox-vite-feature-packs__feed">
                  <span
                    class="ox-vite-feature-pack-feed-state"
                    :class="`is-${featurePackData.feedStatus || 'unavailable'}`"
                  >
                    <i :class="featurePackData.feedStatus === 'ready' ? 'fa-solid fa-shield-halved' : 'fa-solid fa-circle-exclamation'"></i>
                    <span>
                      {{
                        featurePackData.feedStatus === 'ready'
                          ? (isZh ? '可信分发已连接' : 'Trusted feed connected')
                          : featurePackData.feedStatus === 'not-configured'
                            ? (isZh ? '分发未配置' : 'Distribution not configured')
                            : featurePackData.feedStatus === 'loading'
                              ? (isZh ? '正在同步' : 'Syncing')
                              : (isZh ? '分发不可用' : 'Distribution unavailable')
                      }}
                    </span>
                  </span>
                  <small v-if="featurePackData.catalogGeneratedAt">
                    {{ isZh ? '目录时间' : 'Catalog' }}: {{ featurePackData.catalogGeneratedAt }}
                  </small>
                </div>
                <button
                  type="button"
                  class="ox-vite-icon-btn"
                  :disabled="featurePackData.loading"
                  :title="isZh ? '刷新功能包目录' : 'Refresh Feature Pack catalog'"
                  @click="handleFeaturePackRefresh"
                >
                  <i :class="featurePackData.loading ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-rotate-right'"></i>
                </button>
              </div>

              <div v-if="featurePackData.error" class="ox-vite-feature-pack-notice is-error" role="status">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <span>{{ featurePackData.error.message }}</span>
              </div>
              <div v-else-if="featurePackData.feedStatus === 'not-configured'" class="ox-vite-feature-pack-notice" role="status">
                <i class="fa-solid fa-lock"></i>
                <span>{{ isZh ? '远程安装已停用；应用信任存储和分发地址尚未配置。' : 'Remote installation is disabled because the application trust store and feed are not configured.' }}</span>
              </div>
              <div v-else-if="!featurePackData.available" class="ox-vite-feature-pack-notice" role="status">
                <i class="fa-solid fa-desktop"></i>
                <span>{{ isZh ? '功能包管理仅在桌面应用中可用。' : 'Feature Pack management is available in the desktop application.' }}</span>
              </div>

              <div class="ox-vite-feature-pack-list">
                <article
                  v-for="item in featurePackData.items || []"
                  :key="item.capabilityId"
                  class="ox-vite-feature-pack-row"
                  :class="[`is-${item.status}`, { 'is-busy': isFeaturePackBusy(item) }]"
                >
                  <div class="ox-vite-feature-pack-row__identity">
                    <span class="ox-vite-feature-pack-row__icon"><i :class="item.icon"></i></span>
                    <div>
                      <strong>{{ item.displayName }}</strong>
                      <p>{{ item.description }}</p>
                    </div>
                  </div>

                  <div class="ox-vite-feature-pack-row__versions">
                    <span>
                      <small>{{ isZh ? '已安装' : 'Installed' }}</small>
                      <strong>{{ item.installedVersion || '—' }}</strong>
                    </span>
                    <span>
                      <small>{{ isZh ? '可用版本' : 'Available' }}</small>
                      <strong>{{ item.availableVersion || '—' }}</strong>
                    </span>
                  </div>

                  <div class="ox-vite-feature-pack-row__state">
                    <span class="ox-vite-feature-pack-status" :class="`is-${item.status}`">
                      <i :class="getFeaturePackStatusIcon(item.status)"></i>
                      <span>{{ getFeaturePackStatusLabel(item.status) }}</span>
                    </span>
                    <span v-if="item.restartRequired" class="ox-vite-feature-pack-restart">
                      <i class="fa-solid fa-power-off"></i>
                      <span>{{ isZh ? '重启后生效' : 'Restart required' }}</span>
                    </span>
                  </div>

                  <div class="ox-vite-feature-pack-row__actions">
                    <button
                      v-if="item.status === 'not-installed' || item.status === 'update-available'"
                      type="button"
                      class="ox-vite-ops-primary-btn"
                      :disabled="isFeaturePackBusy(item) || featurePackData.feedStatus !== 'ready'"
                      @click="handleFeaturePackOperation('install', item)"
                    >
                      <i :class="isFeaturePackBusy(item) ? 'fa-solid fa-spinner fa-spin' : (item.status === 'update-available' ? 'fa-solid fa-arrow-up' : 'fa-solid fa-download')"></i>
                      <span>{{ item.status === 'update-available' ? (isZh ? '更新' : 'Update') : (isZh ? '安装' : 'Install') }}</span>
                    </button>
                    <button
                      v-else
                      type="button"
                      class="ox-vite-ops-secondary-btn"
                      :disabled="isFeaturePackBusy(item) || featurePackData.feedStatus !== 'ready'"
                      @click="handleFeaturePackOperation('repair', item)"
                    >
                      <i :class="isFeaturePackBusy(item) ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-screwdriver-wrench'"></i>
                      <span>{{ isZh ? '修复' : 'Repair' }}</span>
                    </button>
                    <button
                      v-if="item.installedVersion || item.status === 'damaged'"
                      type="button"
                      class="ox-vite-icon-btn is-danger"
                      :disabled="isFeaturePackBusy(item)"
                      :title="isZh ? '卸载功能包' : 'Uninstall Feature Pack'"
                      @click="handleFeaturePackOperation('uninstall', item)"
                    >
                      <i class="fa-regular fa-trash-can"></i>
                    </button>
                  </div>

                  <div v-if="item.progress" class="ox-vite-feature-pack-progress" :class="{ 'is-failed': item.progress.phase === 'failed' }">
                    <div class="ox-vite-feature-pack-progress__meta">
                      <span>{{ getFeaturePackPhaseLabel(item.progress.phase) }}</span>
                      <span v-if="item.progress.transferredBytes !== null && item.progress.totalBytes !== null">
                        {{ formatFeaturePackBytes(item.progress.transferredBytes) }} / {{ formatFeaturePackBytes(item.progress.totalBytes) }}
                      </span>
                      <span v-else-if="item.progress.percent !== null">{{ item.progress.percent }}%</span>
                    </div>
                    <div class="ox-vite-feature-pack-progress__track" aria-hidden="true">
                      <span
                        :class="{ 'is-indeterminate': item.progress.percent === null && !['completed', 'failed'].includes(item.progress.phase) }"
                        :style="{ width: item.progress.percent === null ? (item.progress.phase === 'completed' ? '100%' : '28%') : `${item.progress.percent}%` }"
                      ></span>
                    </div>
                    <p v-if="item.progress.error">{{ item.progress.error.message }}</p>
                  </div>
                </article>
              </div>
            </div>

            <div v-else-if="data.activeTab === 'advanced'" class="ox-vite-settings-stack">
              <section class="ox-vite-settings-section">
                <div class="ox-vite-settings-section__label">{{ isZh ? '文件与目录' : 'Files & Directories' }}</div>
                <article class="ox-vite-settings-row">
                  <div>
                    <strong>{{ isZh ? '用户数据目录' : 'User Data Folder' }}</strong>
                    <p>{{ isZh ? '配置、会话、本地资产和数据库所在目录。' : 'Folder for settings, conversations, local assets, and databases.' }}</p>
                  </div>
                  <button type="button" class="ox-vite-ops-secondary-btn" @click="handleSystemOpenPath('user')">
                    <i class="fa-solid fa-folder-open"></i>
                    <span>{{ isZh ? '打开' : 'Open' }}</span>
                  </button>
                </article>
                <article class="ox-vite-settings-row">
                  <div>
                    <strong>{{ isZh ? '日志目录' : 'Log Folder' }}</strong>
                    <p>{{ isZh ? '桌面端与后端运行日志，用于排查启动、更新和接口问题。' : 'Desktop and backend logs for startup, update, and API diagnostics.' }}</p>
                  </div>
                  <button type="button" class="ox-vite-ops-secondary-btn" @click="handleSystemOpenPath('logs')">
                    <i class="fa-solid fa-file-lines"></i>
                    <span>{{ isZh ? '打开' : 'Open' }}</span>
                  </button>
                </article>
                <article class="ox-vite-settings-row">
                  <div>
                    <strong>{{ isZh ? '扩展目录' : 'Extension Folder' }}</strong>
                    <p>{{ isZh ? '插件、扩展与外部能力文件目录。' : 'Folder for plugins, extensions, and external capability files.' }}</p>
                  </div>
                  <button type="button" class="ox-vite-ops-secondary-btn" @click="handleSystemOpenPath('extensions')">
                    <i class="fa-solid fa-puzzle-piece"></i>
                    <span>{{ isZh ? '打开' : 'Open' }}</span>
                  </button>
                </article>
              </section>
              <section class="ox-vite-settings-section">
                <div class="ox-vite-settings-section__label">{{ isZh ? '维护操作' : 'Maintenance' }}</div>
                <article class="ox-vite-settings-row">
                  <div>
                    <strong>{{ isZh ? '清理运行缓存' : 'Clear Runtime Cache' }}</strong>
                    <p>{{ isZh ? '清理前端缓存，不会删除用户会话和配置。' : 'Clear frontend runtime cache without deleting conversations or settings.' }}</p>
                  </div>
                  <button type="button" class="ox-vite-ops-secondary-btn" @click="handleSystemClearCache">
                    <i class="fa-solid fa-broom"></i>
                    <span>{{ isZh ? '清除' : 'Clear' }}</span>
                  </button>
                </article>
                <article class="ox-vite-settings-row">
                  <div>
                    <strong>{{ isZh ? '恢复默认系统设置' : 'Reset System Settings' }}</strong>
                    <p>{{ isZh ? '仅恢复系统设置页中的语言、主题、启动、网络和代理选项。' : 'Only resets language, theme, startup, network, and proxy options in this page.' }}</p>
                  </div>
                  <button type="button" class="ox-vite-danger-btn" @click="handleSystemResetDefaults">
                    <i class="fa-solid fa-rotate-left"></i>
                    <span>{{ isZh ? '恢复默认' : 'Reset' }}</span>
                  </button>
                </article>
              </section>
            </div>

            <div v-else class="ox-vite-card-grid">
              <article class="ox-vite-panel-card">
                <div class="ox-vite-panel-card__head">
                  <h2>{{ isZh ? '当前发布状态' : 'Current Release Status' }}</h2>
                  <p>{{ isZh ? '版本更新、更新检测与优化说明都会统一汇总在这里。' : 'Release updates, update checks, and optimization notes are collected here.' }}</p>
                </div>
                <div class="ox-vite-chip-grid">
                  <span class="ox-vite-detail-chip">v{{ data.version }}</span>
                  <span class="ox-vite-detail-chip">{{ data.updateStatus || 'idle' }}</span>
                  <span class="ox-vite-detail-chip">{{ data.updateAvailable ? (isZh ? '发现新版本' : 'Update Available') : (isZh ? '当前已同步' : 'Up to Date') }}</span>
                </div>
                <div class="ox-vite-fact-list">
                  <article class="ox-vite-fact-row">
                    <strong>{{ isZh ? '更新状态' : 'Update Status' }}</strong>
                    <p>{{ data.updateStatusTitle || (isZh ? '等待下一次更新检查。' : 'Waiting for the next update check.') }}</p>
                  </article>
                  <article class="ox-vite-fact-row">
                    <strong>{{ isZh ? '状态说明' : 'Status Detail' }}</strong>
                    <p>{{ data.updateStatusDescription || data.updateMessage || (isZh ? '等待下一次更新检查。' : 'Waiting for the next update check.') }}</p>
                  </article>
                  <article class="ox-vite-fact-row">
                    <strong>{{ isZh ? '更新节奏' : 'Check Cadence' }}</strong>
                    <p>{{ isZh ? '启动后首次静默检查，之后每 1 小时自动检测一次。' : 'A silent check runs shortly after launch, then once every hour.' }}</p>
                  </article>
                </div>
                <div class="ox-vite-chip-grid">
                  <button type="button" class="ox-vite-ops-primary-btn" @click="handleSystemCheckUpdates">
                    <i class="fa-solid fa-rotate-right"></i>
                    <span>{{ isZh ? '检查更新' : 'Check for Updates' }}</span>
                  </button>
                  <button type="button" class="ox-vite-ops-secondary-btn" @click="handleSystemOpenAbout">
                    <i class="fa-solid fa-circle-info"></i>
                    <span>{{ isZh ? '查看关于页' : 'Open About Page' }}</span>
                  </button>
                </div>
              </article>

              <article
                v-for="entry in data.updateEntries || []"
                :key="`${entry.version}-${entry.date}-${entry.title}`"
                class="ox-vite-panel-card"
              >
                <div class="ox-vite-panel-card__head">
                  <h2>{{ entry.title }}</h2>
                  <p>{{ entry.date }}</p>
                </div>
                <div class="ox-vite-chip-grid">
                  <span class="ox-vite-detail-chip">{{ entry.version }}</span>
                  <span
                    v-for="moduleName in entry.modules || []"
                    :key="entry.version + moduleName"
                    class="ox-vite-detail-chip"
                  >
                    {{ moduleName }}
                  </span>
                </div>
                <ul class="ox-vite-bullet-list">
                  <li v-for="item in entry.highlights || []" :key="item">{{ item }}</li>
                </ul>
              </article>
            </div>
          </section>
        </main>
      </div>

      <div v-else>
        <div :class="props.surface === 'enterprise' ? 'ox-vite-system-layout' : 'ox-vite-ops-main'">
          <aside v-if="props.surface === 'enterprise'" class="ox-vite-side-tabs">
            <button
              v-for="tab in data.tabs || []"
              :key="tab.id"
              type="button"
              class="ox-vite-side-tab"
              :class="{ active: data.activeTab === tab.id }"
              @click="handleSelectTab(tab.id)"
            >
              <i :class="tab.icon"></i>
              <span>{{ tab.label }}</span>
            </button>
          </aside>

          <main class="ox-vite-ops-main">
            <div v-if="props.surface !== 'kernel'" class="ox-vite-tab-strip">
              <button
                v-for="tab in (props.surface === 'enterprise' ? [] : data.tabs || [])"
                :key="tab.id"
                type="button"
                class="ox-vite-strip-tab"
                :class="{ active: data.activeTab === tab.id }"
                @click="handleSelectTab(tab.id)"
              >
                <i :class="tab.icon"></i>
                <span>{{ tab.label }}</span>
              </button>
            </div>

            <section v-if="data.meta?.summary && !(props.surface === 'enterprise' || (props.surface === 'workbench' && data.activeTab === 'develop'))" class="ox-vite-summary-card">
              <p>{{ data.meta.summary }}</p>
              <div class="ox-vite-chip-grid">
                <span
                  v-for="chip in data.meta.chips || []"
                  :key="chip.icon + chip.text"
                  class="ox-vite-detail-chip"
                >
                  <i :class="chip.icon"></i>
                  <span>{{ chip.text }}</span>
                </span>
              </div>
            </section>

            <section v-if="data.stats?.length && !(props.surface === 'enterprise' || (props.surface === 'workbench' && data.activeTab === 'develop'))" class="ox-vite-stat-grid">
              <article v-for="card in data.stats || []" :key="card.label" class="ox-vite-stat-card" :class="{ emphasis: card.emphasis }">
                <span>{{ card.label }}</span>
                <strong>{{ card.value }}</strong>
                <small>{{ card.meta }}</small>
              </article>
            </section>

            <template v-if="props.surface === 'deploy'">
              <section v-if="data.activeTab === 'table_pet'" class="ox-vite-card-grid">
                <article class="ox-vite-panel-card">
                  <div class="ox-vite-panel-card__head">
                    <h2>{{ isZh ? 'VRM 模型与在线状态' : 'VRM Model & Runtime' }}</h2>
                    <p>{{ isZh ? '桌宠入口承接模型、动作和窗口设置，是最接近数字生命表现层的部署面。' : 'The desktop-pet lane holds model, motion, and window settings for the most embodied deployment surface.' }}</p>
                  </div>
                  <div class="ox-vite-deploy-hero">
                    <div class="ox-vite-deploy-hero__status">
                      <span class="ox-vite-deploy-kicker">{{ isZh ? '当前状态' : 'Current state' }}</span>
                      <strong>{{ data.deskPet?.status }}</strong>
                      <p>{{ isZh ? '建议先确认模型、表情和动作，再启动桌宠窗口。' : 'Confirm the model, expressions, and motion set before launching the pet window.' }}</p>
                    </div>
                    <div class="ox-vite-stat-card emphasis">
                      <span>{{ isZh ? '当前模型' : 'Current Model' }}</span>
                      <strong>{{ data.deskPet?.modelId }}</strong>
                      <small>{{ data.deskPet?.userModels }} {{ isZh ? '个自定义模型' : 'custom models' }}</small>
                    </div>
                  </div>
                  <div class="ox-vite-form-grid">
                    <label class="ox-vite-field"><span>{{ isZh ? '表情驱动' : 'Expressions' }}</span><input :value="data.deskPet?.expressions" disabled type="text" /></label>
                    <label class="ox-vite-field"><span>{{ isZh ? '动作驱动' : 'Motions' }}</span><input :value="data.deskPet?.motions" disabled type="text" /></label>
                    <label class="ox-vite-field"><span>{{ isZh ? '窗口宽度' : 'Window Width' }}</span><input :value="String(data.deskPet?.width || 0)" disabled type="text" /></label>
                    <label class="ox-vite-field"><span>{{ isZh ? '窗口高度' : 'Window Height' }}</span><input :value="String(data.deskPet?.height || 0)" disabled type="text" /></label>
                  </div>
                </article>

                <article class="ox-vite-panel-card">
                  <div class="ox-vite-panel-card__head">
                    <h2>{{ isZh ? '动作与表现' : 'Motion & Presence' }}</h2>
                    <p>{{ isZh ? '后续会继续补齐待机动画、触摸反应和桌面漫游的可视化配置。' : 'The next pass will deepen idle motion, touch reactions, and desktop roaming controls.' }}</p>
                  </div>
                  <div class="ox-vite-chip-grid">
                    <span class="ox-vite-detail-chip"><i class="fa-solid fa-face-smile"></i>{{ data.deskPet?.expressions }}</span>
                    <span class="ox-vite-detail-chip"><i class="fa-solid fa-person-running"></i>{{ data.deskPet?.motionCount }} {{ isZh ? '个已选动作' : 'selected motions' }}</span>
                    <span class="ox-vite-detail-chip"><i class="fa-solid fa-window-maximize"></i>{{ data.deskPet?.width }} x {{ data.deskPet?.height }}</span>
                  </div>
                </article>
              </section>

              <section v-else-if="data.activeTab === 'im_bot'" class="ox-vite-deploy-platform-grid">
                <article v-for="channel in data.imChannels || []" :key="channel.id" class="ox-vite-deploy-platform-card">
                  <div class="ox-vite-deploy-platform-card__head">
                    <div>
                      <h3>{{ channel.label }}</h3>
                      <p>{{ channel.agent }}</p>
                    </div>
                    <span class="ox-vite-detail-chip">{{ channel.status }}</span>
                  </div>
                  <div class="ox-vite-deploy-platform-card__meta">
                    <span>{{ channel.memory }}</span>
                    <span>{{ channel.note }}</span>
                  </div>
                </article>
              </section>

              <section v-else-if="data.activeTab === 'live_stream'" class="ox-vite-card-grid">
                <article class="ox-vite-panel-card">
                  <div class="ox-vite-panel-card__head">
                    <h2>{{ isZh ? '直播平台路由' : 'Streaming Routes' }}</h2>
                    <p>{{ isZh ? '当前直播工作面统一管理 Bilibili、YouTube 和 Twitch 的启用状态与入口。' : 'The live lane tracks Bilibili, YouTube, and Twitch enablement and entry points together.' }}</p>
                  </div>
                  <div class="ox-vite-deploy-platform-grid">
                    <article v-for="channel in data.liveChannels || []" :key="channel.id" class="ox-vite-deploy-platform-card">
                      <div class="ox-vite-deploy-platform-card__head">
                        <div>
                          <h3>{{ channel.label }}</h3>
                          <p>{{ channel.note }}</p>
                        </div>
                        <span class="ox-vite-detail-chip">{{ channel.status }}</span>
                      </div>
                    </article>
                  </div>
                </article>

                <article class="ox-vite-panel-card">
                  <div class="ox-vite-panel-card__head">
                    <h2>{{ isZh ? '互动与渲染输出' : 'Interaction & Render Output' }}</h2>
                    <p>{{ isZh ? '把弹幕队列、唤醒词和 OBS 连接地址放在同一块，便于直播场景快速核对。' : 'Keep danmaku flow, wake words, and OBS output together for faster stream checks.' }}</p>
                  </div>
                  <div class="ox-vite-form-grid">
                    <label class="ox-vite-field"><span>{{ isZh ? '运行状态' : 'Runtime' }}</span><input :value="data.liveStrategy?.runtime" disabled type="text" /></label>
                    <label class="ox-vite-field"><span>{{ isZh ? '弹幕优先模式' : 'Danmaku Only' }}</span><input :value="data.liveStrategy?.danmakuOnly" disabled type="text" /></label>
                    <label class="ox-vite-field"><span>{{ isZh ? '队列上限' : 'Queue Limit' }}</span><input :value="String(data.liveStrategy?.queueLimit || 0)" disabled type="text" /></label>
                    <label class="ox-vite-field"><span>{{ isZh ? '唤醒词' : 'Wake Word' }}</span><input :value="data.liveStrategy?.wakeWord" disabled type="text" /></label>
                    <label class="ox-vite-field ox-vite-field--wide"><span>OBS</span><input :value="data.liveStrategy?.obsUrl" disabled type="text" /></label>
                  </div>
                </article>
              </section>

              <section v-else-if="data.activeTab === 'read_bot'" class="ox-vite-card-grid">
                <article class="ox-vite-panel-card">
                  <div class="ox-vite-panel-card__head">
                    <h2>{{ isZh ? '朗读任务' : 'Reading Job' }}</h2>
                    <p>{{ isZh ? '集中看选中文件、切片数量和朗读进度，比在旧页面里来回跳更清楚。' : 'Keep file selection, segment counts, and reading progress visible in one place.' }}</p>
                  </div>
                  <div class="ox-vite-form-grid">
                    <label class="ox-vite-field ox-vite-field--wide"><span>{{ isZh ? '当前文件' : 'Selected File' }}</span><input :value="data.readBot?.selectedFile" disabled type="text" /></label>
                    <label class="ox-vite-field"><span>{{ isZh ? '运行状态' : 'Runtime' }}</span><input :value="data.readBot?.runtime" disabled type="text" /></label>
                    <label class="ox-vite-field"><span>{{ isZh ? '音频状态' : 'Audio State' }}</span><input :value="data.readBot?.audioState" disabled type="text" /></label>
                  </div>
                  <div class="ox-vite-chip-grid">
                    <span class="ox-vite-detail-chip"><i class="fa-solid fa-waveform"></i>{{ data.readBot?.segments }} {{ isZh ? '段内容' : 'segments' }}</span>
                  </div>
                </article>

                <article class="ox-vite-panel-card">
                  <div class="ox-vite-panel-card__head">
                    <h2>{{ isZh ? '内容预览' : 'Content Preview' }}</h2>
                  </div>
                  <div class="ox-vite-deploy-preview">{{ data.readBot?.preview }}</div>
                </article>
              </section>

              <section v-else-if="data.activeTab === 'translate_bot'" class="ox-vite-card-grid">
                <article class="ox-vite-panel-card">
                  <div class="ox-vite-panel-card__head">
                    <h2>{{ isZh ? '翻译输入' : 'Translation Input' }}</h2>
                    <p>{{ isZh ? '目标语言、源文本长度和翻译状态已经挂到新的工作面里。' : 'Target language, source length, and translation status now live on the new workbench.' }}</p>
                  </div>
                  <div class="ox-vite-form-grid">
                    <label class="ox-vite-field"><span>{{ isZh ? '目标语言' : 'Target Language' }}</span><input :value="data.translateBot?.runtime" disabled type="text" /></label>
                    <label class="ox-vite-field"><span>{{ isZh ? '翻译状态' : 'Translation Status' }}</span><input :value="data.translateBot?.busy ? (isZh ? '翻译中' : 'Translating') : (isZh ? '待处理' : 'Idle')" disabled type="text" /></label>
                  </div>
                  <div class="ox-vite-chip-grid">
                    <span class="ox-vite-detail-chip"><i class="fa-solid fa-align-left"></i>{{ data.translateBot?.sourceLength }} {{ isZh ? '字符输入' : 'source chars' }}</span>
                    <span class="ox-vite-detail-chip"><i class="fa-solid fa-language"></i>{{ data.translateBot?.targetLength }} {{ isZh ? '字符输出' : 'target chars' }}</span>
                  </div>
                </article>

                <article class="ox-vite-panel-card">
                  <div class="ox-vite-panel-card__head">
                    <h2>{{ isZh ? '源文本预览' : 'Source Preview' }}</h2>
                  </div>
                  <div class="ox-vite-deploy-preview">{{ data.translateBot?.sourcePreview }}</div>
                </article>

                <article class="ox-vite-panel-card">
                  <div class="ox-vite-panel-card__head">
                    <h2>{{ isZh ? '译文预览' : 'Result Preview' }}</h2>
                  </div>
                  <div class="ox-vite-deploy-preview">{{ data.translateBot?.resultPreview }}</div>
                </article>
              </section>

              <section v-else class="ox-vite-card-grid">
                <article class="ox-vite-panel-card">
                  <div class="ox-vite-panel-card__head">
                    <h2>{{ isZh ? '图床与素材出口' : 'Media Outputs' }}</h2>
                    <p>{{ isZh ? '这一块是多个机器人共用的出口配置，先把图床和仓库回退整理清楚。' : 'These shared output routes affect multiple bots, so host and fallback setup should stay explicit.' }}</p>
                  </div>
                  <div class="ox-vite-form-grid">
                    <label class="ox-vite-field"><span>{{ isZh ? '图床状态' : 'Media Host' }}</span><input :value="data.generalConfig?.mediaHostEnabled" disabled type="text" /></label>
                    <label class="ox-vite-field"><span>{{ isZh ? '当前图床' : 'Selected Host' }}</span><input :value="data.generalConfig?.mediaHost" disabled type="text" /></label>
                    <label class="ox-vite-field ox-vite-field--wide"><span>EasyImage2</span><input :value="data.generalConfig?.easyImage" disabled type="text" /></label>
                    <label class="ox-vite-field ox-vite-field--wide"><span>GitHub</span><input :value="data.generalConfig?.githubRepo" disabled type="text" /></label>
                    <label class="ox-vite-field ox-vite-field--wide"><span>Gitee</span><input :value="data.generalConfig?.giteeRepo" disabled type="text" /></label>
                  </div>
                </article>
              </section>
            </template>

            <template v-else-if="props.surface === 'workbench'">
              <template v-if="data.activeTab === 'develop'">
                <section class="ox-vite-stat-grid">
                  <article v-for="card in data.topStats || []" :key="card.label" class="ox-vite-stat-card" :class="{ emphasis: card.emphasis }">
                    <span>{{ card.label }}</span>
                    <strong>{{ card.value }}</strong>
                    <small>{{ card.note }}</small>
                  </article>
                </section>

                <section class="ox-vite-summary-card">
                  <p>{{ isZh ? '把计划、差异分析、Provider 修复、工作区映射与任务中心收束到同一个开发控制台。' : 'Bring plan, diff analysis, provider repair, workspace mapping, and task follow-through into one developer control surface.' }}</p>
                  <div class="ox-vite-workbench-summary">
                    <div>
                      <strong>{{ isZh ? '工作流支持' : 'Workflow Support' }}</strong>
                      <div class="ox-vite-chip-grid">
                        <span v-for="item in data.workflowSupport || []" :key="item.id" class="ox-vite-detail-chip" :class="{ 'is-disabled': !item.enabled }">
                          <i :class="item.enabled ? 'fa-solid fa-circle-check' : 'fa-regular fa-circle'"></i>
                          <span>{{ item.label }}</span>
                        </span>
                      </div>
                    </div>
                    <div>
                      <strong>{{ isZh ? '能力摘要' : 'Capability Summary' }}</strong>
                      <div class="ox-vite-chip-grid">
                        <span v-for="item in data.capabilitySummary || []" :key="item.id" class="ox-vite-detail-chip" :class="{ 'is-disabled': !item.enabled }">
                          <i :class="item.enabled ? 'fa-solid fa-square-check' : 'fa-regular fa-square'"></i>
                          <span>{{ item.label }}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </section>

                <section class="ox-vite-card-grid ox-vite-card-grid--workbench">
                  <article class="ox-vite-panel-card">
                    <div class="ox-vite-panel-card__head">
                      <h2>{{ isZh ? '模型服务商' : 'Provider Setup' }}</h2>
                      <p>{{ data.providerCard?.message || (isZh ? '本地 OpenXnet Runtime 与模型服务的主要接入点。' : 'Primary entry for the desktop runtime and model provider integration.') }}</p>
                    </div>
                    <div class="ox-vite-chip-grid">
                      <span class="ox-vite-detail-chip">{{ data.providerCard?.status || '-' }}</span>
                      <span class="ox-vite-detail-chip">{{ data.providerCard?.apiKeyConfigured ? (isZh ? '已配置 API Key' : 'API key configured') : (isZh ? '缺少 API Key' : 'API key missing') }}</span>
                      <span class="ox-vite-detail-chip">{{ data.providerCard?.providerCount }} {{ isZh ? '个 provider 选项' : 'provider options' }}</span>
                    </div>
                    <div class="ox-vite-form-grid">
                      <label class="ox-vite-field"><span>{{ isZh ? 'Vendor' : 'Vendor' }}</span><input :value="data.providerCard?.vendor" disabled type="text" /></label>
                      <label class="ox-vite-field"><span>{{ isZh ? '模型' : 'Model' }}</span><input :value="data.providerCard?.model" disabled type="text" /></label>
                      <label class="ox-vite-field ox-vite-field--wide"><span>URL</span><input :value="data.providerCard?.url" disabled type="text" /></label>
                    </div>
                    <div v-if="data.providerCard?.validationMessage" class="ox-vite-inline-note">{{ data.providerCard?.validationMessage }}</div>
                  </article>

                  <article class="ox-vite-panel-card">
                    <div class="ox-vite-panel-card__head">
                      <h2>{{ isZh ? 'OpenXnet-Server 网关' : 'Gateway Provider' }}</h2>
                      <p>{{ data.gatewayCard?.message || (isZh ? '用于服务端 profile 的模型接入和网关治理。' : 'Provider access and gateway governance for the server profile.') }}</p>
                    </div>
                    <div class="ox-vite-chip-grid">
                      <span class="ox-vite-detail-chip">{{ data.gatewayCard?.enabled ? (isZh ? '已启用' : 'Enabled') : (isZh ? '未启用' : 'Disabled') }}</span>
                      <span class="ox-vite-detail-chip">{{ data.gatewayCard?.reachable ? (isZh ? '可达' : 'Reachable') : (isZh ? '不可达' : 'Unreachable') }}</span>
                      <span class="ox-vite-detail-chip">{{ data.gatewayCard?.providerCount }} {{ isZh ? '个 provider 选项' : 'provider options' }}</span>
                    </div>
                    <div class="ox-vite-form-grid">
                      <label class="ox-vite-field"><span>{{ isZh ? 'Vendor' : 'Vendor' }}</span><input :value="data.gatewayCard?.vendor" disabled type="text" /></label>
                      <label class="ox-vite-field"><span>{{ isZh ? '模型' : 'Model' }}</span><input :value="data.gatewayCard?.model" disabled type="text" /></label>
                      <label class="ox-vite-field ox-vite-field--wide"><span>URL</span><input :value="data.gatewayCard?.url" disabled type="text" /></label>
                      <label class="ox-vite-field ox-vite-field--wide"><span>{{ isZh ? '管理地址' : 'Management URL' }}</span><input :value="data.gatewayCard?.managementUrl || '-'" disabled type="text" /></label>
                    </div>
                  </article>

                  <article class="ox-vite-panel-card">
                    <div class="ox-vite-panel-card__head">
                      <h2>{{ isZh ? '默认映射' : 'Default Mapping' }}</h2>
                      <p>{{ data.mappingCard?.message || (isZh ? '主智能体、模型解析和 provider 映射应在这里先校准。' : 'Tune the main agent, model resolution, and provider mapping here first.') }}</p>
                    </div>
                    <div class="ox-vite-list">
                      <article class="ox-vite-list-row"><div><strong>{{ isZh ? '主智能体' : 'Main Agent' }}</strong></div><span>{{ data.mappingCard?.agent || '-' }}</span></article>
                      <article class="ox-vite-list-row"><div><strong>{{ isZh ? '当前模型' : 'Current Model' }}</strong></div><span>{{ data.mappingCard?.currentModel || '-' }}</span></article>
                      <article class="ox-vite-list-row"><div><strong>{{ isZh ? '解析结果' : 'Resolved Model' }}</strong></div><span>{{ data.mappingCard?.resolvedModel || '-' }}</span></article>
                      <article class="ox-vite-list-row"><div><strong>{{ isZh ? '解析来源' : 'Resolution Source' }}</strong></div><span>{{ data.mappingCard?.resolutionSource || '-' }}</span></article>
                    </div>
                    <div class="ox-vite-chip-grid">
                      <span class="ox-vite-detail-chip">{{ data.mappingCard?.providerModelCount }} {{ isZh ? '个 provider 模型' : 'provider models' }}</span>
                      <span class="ox-vite-detail-chip">{{ data.mappingCard?.agentCount }} {{ isZh ? '个 agent 选项' : 'agent options' }}</span>
                    </div>
                  </article>

                  <article class="ox-vite-panel-card">
                    <div class="ox-vite-panel-card__head">
                      <h2>{{ isZh ? 'CLI 工作区' : 'CLI Workspace' }}</h2>
                      <p>{{ data.workspaceCard?.message || (isZh ? 'CLI 工作区路径、权限模式和可见范围决定后续开发动作的落点。' : 'Workspace path, permission mode, and visibility scope define where later coding actions land.') }}</p>
                    </div>
                    <div class="ox-vite-chip-grid">
                      <span class="ox-vite-detail-chip">{{ data.workspaceCard?.status || '-' }}</span>
                      <span class="ox-vite-detail-chip">{{ data.workspaceCard?.exists ? (isZh ? '路径存在' : 'Path exists') : (isZh ? '路径缺失' : 'Path missing') }}</span>
                    </div>
                    <div class="ox-vite-form-grid">
                      <label class="ox-vite-field ox-vite-field--wide"><span>{{ isZh ? '工作区路径' : 'Workspace Path' }}</span><input :value="data.workspaceCard?.path" disabled type="text" /></label>
                      <label class="ox-vite-field"><span>{{ isZh ? '执行引擎' : 'Engine' }}</span><input :value="data.workspaceCard?.engine" disabled type="text" /></label>
                      <label class="ox-vite-field"><span>{{ isZh ? '权限模式' : 'Permission Mode' }}</span><input :value="data.workspaceCard?.permissionMode" disabled type="text" /></label>
                      <label class="ox-vite-field"><span>{{ isZh ? '可见范围' : 'Visibility Scope' }}</span><input :value="data.workspaceCard?.visibilityScope" disabled type="text" /></label>
                    </div>
                    <div v-if="data.workspaceCard?.recommendedReason" class="ox-vite-inline-note">{{ data.workspaceCard?.recommendedReason }}</div>
                  </article>
                </section>

                <section class="ox-vite-card-grid ox-vite-card-grid--workbench">
                  <article class="ox-vite-panel-card">
                    <div class="ox-vite-panel-card__head">
                      <h2>{{ isZh ? '配置就绪度' : 'Configuration Readiness' }}</h2>
                      <p>{{ isZh ? '先把运行 Profile、模型接入和 CLI 工作区状态收敛清楚，再让后续任务持续落在正确轨道。' : 'Clarify runtime profile, model access, and workspace state before letting later tasks run on the wrong track.' }}</p>
                    </div>
                    <div class="ox-vite-list">
                      <article v-for="item in data.readiness || []" :key="item.id" class="ox-vite-list-row">
                        <div><strong>{{ item.label }}</strong><p>{{ item.note }}</p></div>
                        <span class="ox-vite-detail-chip">{{ item.status }}</span>
                      </article>
                    </div>
                  </article>

                  <article class="ox-vite-panel-card">
                    <div class="ox-vite-panel-card__head">
                      <h2>{{ isZh ? '最近开发任务' : 'Recent Dev Tasks' }}</h2>
                      <p>{{ isZh ? '把开发流里最近提交的计划、Review 和 Patch 任务继续收束到同一工作面。' : 'Keep recent plan, review, and patch tasks visible inside the same workbench.' }}</p>
                    </div>
                    <div class="ox-vite-list">
                      <article v-for="task in data.recentTasks || []" :key="task.id" class="ox-vite-list-row">
                        <div><strong>{{ task.title }}</strong><p>{{ task.workflow }} · {{ task.updatedAt }}</p></div>
                        <span class="ox-vite-detail-chip">{{ task.status }}</span>
                      </article>
                      <article v-if="!(data.recentTasks || []).length" class="ox-vite-list-row">
                        <div><strong>{{ isZh ? '还没有最近任务' : 'No recent tasks yet' }}</strong><p>{{ isZh ? '等开发任务创建后，这里会开始沉淀最近活动。' : 'Recent activity will appear here once dev tasks are created.' }}</p></div>
                      </article>
                    </div>
                  </article>

                  <article class="ox-vite-panel-card">
                    <div class="ox-vite-panel-card__head">
                      <h2>{{ isZh ? '工作流模板' : 'Workflow Templates' }}</h2>
                      <p>{{ isZh ? '这里会持续沉淀计划、Review、Diff 和 Patch 的工作模板。' : 'This panel collects reusable templates for plan, review, diff, and patch workflows.' }}</p>
                    </div>
                    <div class="ox-vite-list">
                      <article v-for="item in data.templates || []" :key="item.id" class="ox-vite-list-row">
                        <div><strong>{{ item.title }}</strong><p>{{ item.summary || item.suggestedGoal || '-' }}</p></div>
                        <span class="ox-vite-detail-chip">{{ item.id }}</span>
                      </article>
                      <article v-if="!(data.templates || []).length" class="ox-vite-list-row">
                        <div><strong>{{ isZh ? '还没有模板' : 'No templates yet' }}</strong><p>{{ isZh ? '模板加载完成后，会显示建议目标和默认工作流。' : 'Templates will show suggested goals and default workflows once loaded.' }}</p></div>
                      </article>
                    </div>
                  </article>

                  <article class="ox-vite-panel-card">
                    <div class="ox-vite-panel-card__head">
                      <h2>{{ isZh ? '当前告警' : 'Warnings' }}</h2>
                      <p>{{ isZh ? '阻塞项和注意事项应该集中出现在工作台里，而不是藏在设置深处。' : 'Blockers and cautions should stay visible in the workbench instead of hiding deep in settings.' }}</p>
                    </div>
                    <div class="ox-vite-list">
                      <article v-for="(warning, index) in data.warnings || []" :key="`${index}-${warning}`" class="ox-vite-list-row">
                        <div><strong>{{ isZh ? '注意事项' : 'Warning' }}</strong><p>{{ warning }}</p></div>
                      </article>
                      <article v-if="!(data.warnings || []).length" class="ox-vite-list-row">
                        <div><strong>{{ isZh ? '当前没有告警' : 'No warnings right now' }}</strong><p>{{ isZh ? '当 provider、映射或工作区存在风险时，这里会优先显示。' : 'Provider, mapping, or workspace issues will surface here first.' }}</p></div>
                      </article>
                    </div>
                  </article>
                </section>
              </template>

              <template v-else>
                <section class="ox-vite-card-grid">
                  <article class="ox-vite-panel-card">
                    <div class="ox-vite-panel-card__head">
                      <h2>{{ data.meta?.title }}</h2>
                      <p>{{ data.meta?.summary }}</p>
                    </div>
                    <div class="ox-vite-list">
                      <article v-for="card in data.stats || []" :key="card.label" class="ox-vite-list-row">
                        <div><strong>{{ card.label }}</strong><p>{{ card.meta }}</p></div>
                        <span>{{ card.value }}</span>
                      </article>
                    </div>
                  </article>
                </section>
              </template>
            </template>

            <template v-else-if="props.surface === 'enterprise'">
              <section class="ox-vite-stat-grid">
                <article v-for="card in data.topStats || []" :key="card.title" class="ox-vite-stat-card">
                  <span>{{ card.title }}</span>
                  <strong>{{ card.value }}</strong>
                  <small>{{ card.note }}</small>
                </article>
              </section>

              <section class="ox-vite-summary-card">
                <p>{{ data.meta?.summary }}</p>
                <div class="ox-vite-chip-grid">
                  <span v-for="chip in data.meta?.chips || []" :key="chip.icon + chip.text" class="ox-vite-detail-chip">
                    <i :class="chip.icon"></i>
                    <span>{{ chip.text }}</span>
                  </span>
                </div>
              </section>

              <template v-if="data.activeTab === 'usage'">
                <section class="ox-vite-stat-grid">
                  <article v-for="card in data.usagePanel?.metrics || []" :key="card.label" class="ox-vite-stat-card">
                    <span>{{ card.label }}</span>
                    <strong>{{ card.value }}</strong>
                  </article>
                </section>

                <section class="ox-vite-card-grid ox-vite-card-grid--workbench">
                  <article class="ox-vite-panel-card">
                    <div class="ox-vite-panel-card__head">
                      <h2>{{ isZh ? '用量趋势' : 'Usage Trend' }}</h2>
                      <p>{{ isZh ? '这里先把近期 token 变化做成轻量条形视图，后续继续贴近原型中的图表层次。' : 'A lightweight token trend view for now, with a closer chart treatment coming next.' }}</p>
                    </div>
                    <div class="ox-vite-mini-bars">
                      <div v-for="item in data.usagePanel?.trend || []" :key="item.id" class="ox-vite-mini-bars__item">
                        <div class="ox-vite-mini-bars__bar" :style="{ height: `${Math.max(10, Math.min(100, item.value ? (item.value / Math.max(...(data.usagePanel?.trend || []).map(t => t.value || 0), 1)) * 100 : 10))}%` }"></div>
                        <span>{{ item.label }}</span>
                      </div>
                    </div>
                  </article>

                  <article class="ox-vite-panel-card">
                    <div class="ox-vite-panel-card__head">
                      <h2>{{ isZh ? '模型用量' : 'Usage by Model' }}</h2>
                    </div>
                    <div class="ox-vite-list">
                      <article v-for="row in data.usagePanel?.models || []" :key="row.id" class="ox-vite-list-row">
                        <div><strong>{{ row.name }}</strong><p>{{ row.requests }} {{ isZh ? '次请求' : 'requests' }}</p></div>
                        <span>{{ row.tokens }} tokens · ${{ row.cost.toFixed(4) }}</span>
                      </article>
                    </div>
                  </article>
                </section>

                <section class="ox-vite-panel-card">
                  <div class="ox-vite-panel-card__head">
                    <h2>{{ isZh ? '用户用量' : 'Usage by User' }}</h2>
                  </div>
                  <div class="ox-vite-list">
                    <article v-for="row in data.usagePanel?.users || []" :key="row.id" class="ox-vite-list-row">
                      <div><strong>{{ row.name }}</strong><p>{{ row.requests }} {{ isZh ? '次请求' : 'requests' }}</p></div>
                      <span>{{ row.tokens }} tokens · {{ row.latency }}ms</span>
                    </article>
                  </div>
                </section>
              </template>

              <template v-else-if="data.activeTab === 'neuro'">
                <section class="ox-vite-stat-grid">
                  <article v-for="card in data.neuroPanel?.metrics || []" :key="card.label" class="ox-vite-stat-card">
                    <span>{{ card.label }}</span>
                    <strong>{{ card.value }}</strong>
                  </article>
                </section>

                <section class="ox-vite-card-grid ox-vite-card-grid--workbench">
                  <article class="ox-vite-panel-card">
                    <div class="ox-vite-panel-card__head">
                      <h2>{{ isZh ? '神经符号' : 'Symbols' }}</h2>
                    </div>
                    <div class="ox-vite-list">
                      <article v-for="row in data.neuroPanel?.symbols || []" :key="row.id" class="ox-vite-list-row">
                        <div><strong>{{ row.label }}</strong><p>{{ row.operator }} · {{ row.entities.join(', ') || '-' }}</p></div>
                        <span>{{ Math.round(row.successRate * 100) }}% · {{ row.activations }}</span>
                      </article>
                    </div>
                  </article>

                  <article class="ox-vite-panel-card">
                    <div class="ox-vite-panel-card__head">
                      <h2>{{ isZh ? '认知规则' : 'Cognitive Rules' }}</h2>
                    </div>
                    <div class="ox-vite-list">
                      <article v-for="row in data.neuroPanel?.rules || []" :key="row.id" class="ox-vite-list-row">
                        <div><strong>{{ row.name }}</strong><p>{{ row.domain }} · {{ row.description }}</p></div>
                        <span>{{ row.enabled ? 'ON' : 'OFF' }}</span>
                      </article>
                    </div>
                  </article>
                </section>
              </template>

              <template v-else-if="data.activeTab === 'kg'">
                <section class="ox-vite-stat-grid">
                  <article v-for="card in data.kgPanel?.metrics || []" :key="card.label" class="ox-vite-stat-card">
                    <span>{{ card.label }}</span>
                    <strong>{{ card.value }}</strong>
                  </article>
                </section>
                <section class="ox-vite-panel-card">
                  <div class="ox-vite-panel-card__head">
                    <h2>{{ isZh ? '实体事实' : 'Entity Facts' }}</h2>
                    <p>{{ isZh ? '这一层先把知识图谱查询结果收束成可读列表，后续再继续贴近图谱可视化原型。' : 'This pass keeps graph query results readable first, with a more visual graph view to follow.' }}</p>
                  </div>
                  <div class="ox-vite-list">
                    <article v-for="row in data.kgPanel?.facts || []" :key="row.id" class="ox-vite-list-row">
                      <div><strong>{{ row.subject }}</strong><p>{{ row.predicate }}</p></div>
                      <span>{{ row.object }}</span>
                    </article>
                    <article v-if="!(data.kgPanel?.facts || []).length" class="ox-vite-list-row">
                      <div><strong>{{ isZh ? '当前没有实体事实' : 'No entity facts yet' }}</strong><p>{{ isZh ? '当图谱实体查询成功后，结果会先沉淀在这里。' : 'Facts will appear here once entity queries return data.' }}</p></div>
                    </article>
                  </div>
                </section>
              </template>

              <template v-else-if="data.activeTab === 'enterprise-kb'">
                <section class="ox-vite-kb-hub">
                  <section class="ox-vite-kb-hero">
                    <div class="ox-vite-kb-hero__copy">
                      <div class="ox-vite-ops-header__kicker">{{ isZh ? '企业知识库' : 'Enterprise Knowledge' }}</div>
                      <h2>{{ isZh ? '统一管理知识库、分类与文档沉淀' : 'Manage knowledge bases, categories, and document coverage in one place' }}</h2>
                      <p>
                        {{ isZh
                          ? '把知识库、分类、文档规模和版本演进收束进同一条企业工作流，便于团队共享知识和后续接入知识图谱。'
                          : 'Keep knowledge bases, categories, document scale, and version history aligned in one enterprise workflow.' }}
                      </p>
                    </div>
                    <div class="ox-vite-kb-hero__stats">
                      <article class="ox-vite-role-hero__stat">
                        <span>{{ enterpriseKnowledgePanel.totalCount || (enterpriseKnowledgePanel.items || []).length }}</span>
                        <small>{{ isZh ? '知识库' : 'KBs' }}</small>
                      </article>
                      <article class="ox-vite-role-hero__stat">
                        <span>{{ enterpriseKnowledgePanel.totalDocs || 0 }}</span>
                        <small>{{ isZh ? '文档总量' : 'Docs' }}</small>
                      </article>
                      <article class="ox-vite-role-hero__stat">
                        <span>{{ enterpriseKbCategories.length - 1 }}</span>
                        <small>{{ isZh ? '分类' : 'Categories' }}</small>
                      </article>
                    </div>
                  </section>

                  <section class="ox-vite-role-toolbar">
                    <div class="ox-vite-role-search">
                      <i class="fa-solid fa-magnifying-glass"></i>
                      <input
                        v-model="enterpriseKbQuery"
                        type="text"
                        :placeholder="isZh ? '搜索知识库名称、分类或描述' : 'Search KB name, category, or description'"
                      />
                      <button v-if="enterpriseKbQuery" type="button" class="ox-vite-role-search__clear" @click="enterpriseKbQuery = ''">
                        <i class="fa-solid fa-xmark"></i>
                      </button>
                    </div>
                    <button type="button" class="ox-vite-ops-primary-btn" @click="handleEnterpriseKbCreate">
                      <i class="fa-solid fa-plus"></i>
                      <span>{{ isZh ? '新建知识库' : 'Create KB' }}</span>
                    </button>
                  </section>

                  <section class="ox-vite-role-category-strip">
                    <button
                      v-for="category in enterpriseKbCategories"
                      :key="category.id"
                      type="button"
                      class="ox-vite-role-category-chip"
                      :class="{ 'is-active': enterpriseKbCategory === category.id }"
                      @click="enterpriseKbCategory = category.id"
                    >
                      <span>{{ category.label }}</span>
                      <strong>{{ category.id === 'all' ? (enterpriseKnowledgePanel.items || []).length : (enterpriseKnowledgePanel.items || []).filter((item) => item.category === category.id).length }}</strong>
                    </button>
                  </section>

                  <section class="ox-vite-kb-layout">
                    <article class="ox-vite-panel-card">
                      <div class="ox-vite-panel-card__head">
                        <div>
                          <div class="ox-vite-ops-header__kicker">{{ isZh ? '知识库列表' : 'Knowledge Base Library' }}</div>
                          <h2>{{ isZh ? '当前企业知识库' : 'Current Enterprise Knowledge Bases' }}</h2>
                        </div>
                        <div class="ox-vite-detail-chip">{{ enterpriseFilteredKbItems.length }}</div>
                      </div>

                      <div v-if="enterpriseFilteredKbItems.length" class="ox-vite-kb-grid">
                        <article v-for="row in enterpriseFilteredKbItems" :key="row.id" class="ox-vite-kb-card">
                          <div class="ox-vite-kb-card__head">
                            <div class="ox-vite-kb-card__identity">
                              <div class="ox-vite-kb-card__icon">
                                <i class="fa-solid fa-book-open"></i>
                              </div>
                              <div>
                                <div class="ox-vite-kb-card__name">{{ row.name }}</div>
                                <div class="ox-vite-kb-card__meta">{{ row.category }}</div>
                              </div>
                            </div>
                            <span class="ox-vite-detail-chip">{{ row.docs }} {{ isZh ? '篇文档' : 'docs' }}</span>
                          </div>
                          <p>{{ row.description || (isZh ? '当前知识库还没有补充描述。' : 'No KB description yet.') }}</p>
                          <div class="ox-vite-chip-grid">
                            <span v-if="row.updatedAt" class="ox-vite-detail-chip">{{ row.updatedAt }}</span>
                          </div>
                          <div class="ox-vite-workspace-card__actions">
                            <button type="button" class="ox-vite-ops-secondary-btn" @click="handleEnterpriseKbEdit(row)">
                              <i class="fa-solid fa-pen"></i>
                              <span>{{ isZh ? '编辑' : 'Edit' }}</span>
                            </button>
                            <button type="button" class="ox-vite-ops-secondary-btn" @click="handleEnterpriseKbVersions(row)">
                              <i class="fa-solid fa-clock-rotate-left"></i>
                              <span>{{ isZh ? '版本' : 'Versions' }}</span>
                            </button>
                            <button type="button" class="ox-vite-ops-secondary-btn" @click="handleEnterpriseKbDelete(row)">
                              <i class="fa-regular fa-trash-can"></i>
                              <span>{{ isZh ? '删除' : 'Delete' }}</span>
                            </button>
                          </div>
                        </article>
                      </div>

                      <div v-else class="ox-vite-empty-state">
                        <i class="fa-solid fa-book-open"></i>
                        <strong>{{ isZh ? '还没有知识库' : 'No knowledge bases yet' }}</strong>
                        <p>{{ isZh ? '先创建一个知识库，后续再继续承接文档上传和版本演进。' : 'Create the first KB, then continue with docs and version flows.' }}</p>
                      </div>
                    </article>

                    <aside class="ox-vite-panel-card ox-vite-kb-sidecard">
                      <template v-if="enterpriseKbSideMode === 'editor' && enterpriseKbEditorOpen">
                        <div class="ox-vite-panel-card__head">
                          <div>
                            <div class="ox-vite-ops-header__kicker">{{ isZh ? '知识库编辑器' : 'KB Editor' }}</div>
                            <h2>{{ enterpriseKbDraft.id ? (isZh ? '编辑知识库' : 'Edit Knowledge Base') : (isZh ? '新建知识库' : 'Create Knowledge Base') }}</h2>
                          </div>
                        </div>
                        <div class="ox-vite-form-grid">
                          <label class="ox-vite-field ox-vite-field--wide">
                            <span>{{ isZh ? '知识库名称' : 'KB Name' }}</span>
                            <input v-model="enterpriseKbDraft.name" type="text" />
                          </label>
                          <label class="ox-vite-field ox-vite-field--wide">
                            <span>{{ isZh ? '分类' : 'Category' }}</span>
                            <input v-model="enterpriseKbDraft.category" type="text" />
                          </label>
                          <label class="ox-vite-field ox-vite-field--wide">
                            <span>{{ isZh ? '描述' : 'Description' }}</span>
                            <input v-model="enterpriseKbDraft.description" type="text" />
                          </label>
                        </div>
                        <div class="ox-vite-workspace-card__actions">
                          <button type="button" class="ox-vite-ops-secondary-btn" @click="enterpriseKbEditorOpen = false; enterpriseKbSideMode = 'summary'">
                            <i class="fa-solid fa-xmark"></i>
                            <span>{{ isZh ? '取消' : 'Cancel' }}</span>
                          </button>
                          <button type="button" class="ox-vite-ops-primary-btn" :disabled="!enterpriseKbDraft.name" @click="handleEnterpriseKbSubmit">
                            <i class="fa-solid fa-check"></i>
                            <span>{{ enterpriseKbDraft.id ? (isZh ? '保存' : 'Save') : (isZh ? '创建' : 'Create') }}</span>
                          </button>
                        </div>
                      </template>

                      <template v-else-if="enterpriseKbSideMode === 'versions' && enterpriseKbVersionOpen">
                        <div class="ox-vite-panel-card__head">
                          <div>
                            <div class="ox-vite-ops-header__kicker">{{ isZh ? '版本历史' : 'Version History' }}</div>
                            <h2>{{ isZh ? '知识库版本演进' : 'Knowledge Base Revisions' }}</h2>
                          </div>
                        </div>
                        <div v-if="enterpriseKbVersions.length" class="ox-vite-list">
                          <article v-for="(version, index) in enterpriseKbVersions" :key="`${version.version || index}`" class="ox-vite-list-row">
                            <div>
                              <strong>v{{ version.version || index + 1 }}</strong>
                              <p>{{ version.created_at || (isZh ? '暂无时间信息' : 'No timestamp') }}</p>
                            </div>
                            <span>{{ version.doc_count || 0 }} {{ isZh ? '篇文档' : 'docs' }}</span>
                          </article>
                        </div>
                        <div v-else class="ox-vite-empty-state ox-vite-empty-state--compact">
                          <i class="fa-solid fa-clock-rotate-left"></i>
                          <strong>{{ isZh ? '暂无版本历史' : 'No version history yet' }}</strong>
                        </div>
                        <div class="ox-vite-workspace-card__actions">
                          <button type="button" class="ox-vite-ops-secondary-btn" @click="enterpriseKbVersionOpen = false; enterpriseKbSideMode = 'summary'">
                            <i class="fa-solid fa-arrow-left"></i>
                            <span>{{ isZh ? '返回' : 'Back' }}</span>
                          </button>
                        </div>
                      </template>

                      <template v-else>
                        <div class="ox-vite-panel-card__head">
                          <div>
                            <div class="ox-vite-ops-header__kicker">{{ isZh ? '知识工程提示' : 'Knowledge Engineering Notes' }}</div>
                            <h2>{{ isZh ? '先把知识库沉淀成稳定入口' : 'Turn KBs into a stable operating surface first' }}</h2>
                          </div>
                        </div>
                        <div class="ox-vite-list">
                          <article class="ox-vite-list-row">
                            <div><strong>{{ isZh ? '分类先于扩张' : 'Categorize before scaling' }}</strong><p>{{ isZh ? '先让知识库有清晰分类和描述，再继续接文档上传和图谱关系。' : 'Give each KB a clear category and scope before expanding into files and graph links.' }}</p></div>
                          </article>
                          <article class="ox-vite-list-row">
                            <div><strong>{{ isZh ? '版本历史保留审计线' : 'Version history preserves the audit trail' }}</strong><p>{{ isZh ? '后续继续细化版本差异、回滚和文档批次信息。' : 'The next pass can deepen version diff, rollback, and document batch details.' }}</p></div>
                          </article>
                        </div>
                      </template>
                    </aside>
                  </section>
                </section>
              </template>

              <template v-else-if="data.activeTab === 'staff-roles'">
                <section class="ox-vite-role-studio">
                  <section class="ox-vite-role-hero">
                    <div class="ox-vite-role-hero__copy">
                      <div class="ox-vite-ops-header__kicker">{{ isZh ? 'OpenXnet 内置岗位中心' : 'OpenXnet Built-in Role Studio' }}</div>
                      <h2>{{ isZh ? 'OpenXnet 内置职工角色模板库' : 'OpenXnet Built-in Staff Role Library' }}</h2>
                      <p>
                        {{ isZh
                          ? '围绕平台工程、知识工程、测试质量、客户服务等方向扩展更多员工类型角色，便于企业空间快速组建协作团队，同时保持命名、文案和布局为 OpenXnet 自有表达。'
                          : 'Expand staff roles across platform, knowledge, quality, and service domains so enterprise spaces can assemble teams quickly with OpenXnet-native naming and presentation.' }}
                      </p>
                    </div>
                    <div class="ox-vite-role-hero__stats">
                      <article class="ox-vite-role-hero__stat">
                        <span>{{ enterpriseRolePanel.templateCount || enterpriseRoleTemplates.length }}</span>
                        <small>{{ isZh ? '岗位模板' : 'Templates' }}</small>
                      </article>
                      <article class="ox-vite-role-hero__stat">
                        <span>{{ enterpriseRolePanel.createdCount || enterpriseRoleItems.length }}</span>
                        <small>{{ isZh ? '已创建员工' : 'Created Roles' }}</small>
                      </article>
                      <article class="ox-vite-role-hero__stat">
                        <span>{{ enterpriseRolePanel.enabledCount || enterpriseRoleItems.filter((item) => item.enabled).length }}</span>
                        <small>{{ isZh ? '启用中' : 'Enabled' }}</small>
                      </article>
                    </div>
                  </section>

                  <section class="ox-vite-role-toolbar">
                    <div class="ox-vite-role-search">
                      <i class="fa-solid fa-magnifying-glass"></i>
                      <input
                        v-model="enterpriseRoleQuery"
                        type="text"
                        :placeholder="isZh ? '搜索岗位名称、部门、技能或职责' : 'Search roles, departments, skills, or responsibilities'"
                      />
                      <button v-if="enterpriseRoleQuery" type="button" class="ox-vite-role-search__clear" @click="enterpriseRoleQuery = ''">
                        <i class="fa-solid fa-xmark"></i>
                      </button>
                    </div>
                    <button type="button" class="ox-vite-ops-primary-btn" @click="handleEnterpriseCreateRole">
                      <i class="fa-solid fa-user-plus"></i>
                      <span>{{ isZh ? '新建自定义员工' : 'Create Custom Role' }}</span>
                    </button>
                  </section>

                  <section class="ox-vite-role-category-strip">
                    <button
                      v-for="category in enterpriseRoleCategories"
                      :key="category.id"
                      type="button"
                      class="ox-vite-role-category-chip"
                      :class="{ 'is-active': enterpriseRoleCategory === category.id }"
                      @click="enterpriseRoleCategory = category.id"
                    >
                      <span>{{ category.label }}</span>
                      <strong>{{ getEnterpriseRoleCategoryCount(category.id) }}</strong>
                    </button>
                  </section>

                  <section class="ox-vite-role-layout">
                    <article class="ox-vite-panel-card">
                      <div class="ox-vite-panel-card__head">
                        <div>
                          <div class="ox-vite-ops-header__kicker">{{ isZh ? '内置模板岗位库' : 'Built-in Template Library' }}</div>
                          <h2>{{ isZh ? '从模板快速创建职工角色卡' : 'Quickly Create Staff Roles from Templates' }}</h2>
                        </div>
                        <div class="ox-vite-detail-chip">{{ enterpriseFilteredRoleTemplates.length }}</div>
                      </div>

                      <div v-if="enterpriseFilteredRoleTemplates.length" class="ox-vite-role-template-grid">
                        <button
                          v-for="row in enterpriseFilteredRoleTemplates"
                          :key="row.id"
                          type="button"
                          class="ox-vite-role-template-card"
                          :style="getEnterpriseRoleAccentStyle(row)"
                          @click="handleEnterpriseCreateRoleFromTemplate(row.id)"
                        >
                          <div class="ox-vite-role-template-card__glow"></div>
                          <div class="ox-vite-role-template-card__head">
                            <div class="ox-vite-role-template-card__icon">
                              <i :class="row.icon"></i>
                            </div>
                            <span class="ox-vite-role-template-card__category">{{ row.categoryLabel || (isZh ? '未分类' : 'Uncategorized') }}</span>
                          </div>
                          <div class="ox-vite-role-template-card__title">{{ row.name }}</div>
                          <div class="ox-vite-role-template-card__department">{{ row.department }}</div>
                          <p class="ox-vite-role-template-card__summary">{{ row.summary }}</p>
                          <div class="ox-vite-chip-grid">
                            <span v-for="skill in row.skills || []" :key="`${row.id}-${skill}`" class="ox-vite-detail-chip">{{ skill }}</span>
                          </div>
                          <div class="ox-vite-role-template-card__foot">
                            <span>{{ isZh ? '点击创建' : 'Create from this role' }}</span>
                            <i class="fa-solid fa-arrow-up-right-from-square"></i>
                          </div>
                        </button>
                      </div>

                      <div v-else class="ox-vite-empty-state">
                        <i class="fa-solid fa-folder-open"></i>
                        <strong>{{ isZh ? '没有匹配的岗位模板' : 'No matching staff role templates' }}</strong>
                        <p>{{ isZh ? '可以更换分类或清空搜索条件后继续查看。' : 'Try a different category or clear the search to continue.' }}</p>
                      </div>
                    </article>

                    <aside class="ox-vite-panel-card ox-vite-role-spotlight">
                      <div class="ox-vite-panel-card__head">
                        <div>
                          <div class="ox-vite-ops-header__kicker">{{ isZh ? '推荐模板' : 'Spotlight' }}</div>
                          <h2>{{ isZh ? '优先启用的岗位组合' : 'Recommended Role Mixes' }}</h2>
                        </div>
                      </div>

                      <div class="ox-vite-role-spotlight__list">
                        <button
                          v-for="row in enterpriseFeaturedRoleTemplates"
                          :key="`spotlight-${row.id}`"
                          type="button"
                          class="ox-vite-role-spotlight__card"
                          :style="getEnterpriseRoleAccentStyle(row)"
                          @click="handleEnterpriseCreateRoleFromTemplate(row.id)"
                        >
                          <div class="ox-vite-role-spotlight__icon">
                            <i :class="row.icon"></i>
                          </div>
                          <div class="ox-vite-role-spotlight__body">
                            <div class="ox-vite-role-spotlight__name">{{ row.name }}</div>
                            <div class="ox-vite-role-spotlight__meta">{{ row.department }}</div>
                            <p>{{ row.summary }}</p>
                          </div>
                        </button>
                      </div>

                      <div class="ox-vite-role-spotlight__tip">
                        <i class="fa-solid fa-sparkles"></i>
                        <span>
                          {{ isZh
                            ? '建议先创建 2-3 个基础岗位，再为每个工作空间补充专业岗位，能更快形成团队协作闭环。'
                            : 'Start with 2-3 core roles, then add specialist roles per workspace to form a stronger collaboration loop.' }}
                        </span>
                      </div>
                    </aside>
                  </section>

                  <section class="ox-vite-panel-card">
                    <div class="ox-vite-panel-card__head">
                      <div>
                        <div class="ox-vite-ops-header__kicker">{{ isZh ? '我的员工卡' : 'My Staff Roles' }}</div>
                        <h2>{{ isZh ? '已创建的企业职工角色卡' : 'Created Enterprise Staff Roles' }}</h2>
                      </div>
                      <div class="ox-vite-detail-chip">{{ enterpriseRoleItems.length }}</div>
                    </div>

                    <div v-if="enterpriseRoleItems.length" class="ox-vite-role-library-grid">
                      <article
                        v-for="row in enterpriseRoleItems"
                        :key="row.id"
                        class="ox-vite-role-library-card"
                        :style="getEnterpriseRoleAccentStyle(row)"
                      >
                        <div class="ox-vite-role-library-card__toolbar">
                          <span class="ox-vite-detail-chip" :class="{ 'is-active': row.enabled }">
                            {{ row.enabled ? (isZh ? '启用中' : 'Enabled') : (isZh ? '已停用' : 'Disabled') }}
                          </span>
                          <button type="button" class="ox-vite-role-library-card__delete" @click="handleEnterpriseDeleteRole(row.id)">
                            <i class="fa-regular fa-trash-can"></i>
                          </button>
                        </div>
                        <div class="ox-vite-role-library-card__hero">
                          <div class="ox-vite-role-library-card__icon">
                            <i :class="row.icon"></i>
                          </div>
                          <div class="ox-vite-role-library-card__identity">
                            <div class="ox-vite-role-library-card__name">{{ row.name }}</div>
                            <div class="ox-vite-role-library-card__meta">
                              <span v-if="row.department">{{ row.department }}</span>
                              <span v-if="row.workspace">{{ row.workspace }}</span>
                            </div>
                          </div>
                        </div>
                        <p class="ox-vite-role-library-card__summary">{{ row.summary }}</p>
                        <div class="ox-vite-chip-grid">
                          <span v-for="skill in row.skills || []" :key="`${row.id}-${skill}`" class="ox-vite-detail-chip">{{ skill }}</span>
                        </div>
                      </article>

                      <button type="button" class="ox-vite-role-library-card ox-vite-role-library-card--add" @click="handleEnterpriseCreateRole">
                        <i class="fa-solid fa-user-plus"></i>
                        <div>{{ isZh ? '添加职工角色卡' : 'Add Staff Role' }}</div>
                      </button>
                    </div>

                    <div v-else class="ox-vite-empty-state">
                      <i class="fa-solid fa-user-group"></i>
                      <strong>{{ isZh ? '还没有创建员工角色卡' : 'No staff roles created yet' }}</strong>
                      <p>{{ isZh ? '先从模板岗位库中挑选一个岗位开始。' : 'Start by choosing a template from the role library above.' }}</p>
                    </div>
                  </section>
                </section>
              </template>

              <template v-else-if="data.activeTab === 'enterprise-workspaces'">
                <section class="ox-vite-workspace-hub">
                  <section class="ox-vite-workspace-hub__hero">
                    <div class="ox-vite-workspace-hub__copy">
                      <div class="ox-vite-ops-header__kicker">{{ isZh ? '企业工作空间' : 'Enterprise Workspaces' }}</div>
                      <h2>{{ isZh ? '统一管理工作空间、角色绑定与项目边界' : 'Manage workspaces, role bindings, and project boundaries in one lane' }}</h2>
                      <p>
                        {{ isZh
                          ? '先在这里统一创建和检查工作空间，再进入企业沙盘查看项目楼层、员工角色和 3D 结构，避免菜单有入口但缺少对应工作空间配置。'
                          : 'Create and review workspaces here first, then enter the enterprise sandbox for projects, staff roles, and the 3D structure.' }}
                      </p>
                    </div>
                    <div class="ox-vite-workspace-hub__actions">
                      <button type="button" class="ox-vite-ops-primary-btn" @click="handleEnterpriseCreateWorkspace">
                        <i class="fa-solid fa-plus"></i>
                        <span>{{ isZh ? '创建工作空间' : 'Create Workspace' }}</span>
                      </button>
                    </div>
                  </section>

                  <section v-if="enterpriseWorkspacePanel.items?.length" class="ox-vite-workspace-grid">
                    <article v-for="row in enterpriseWorkspacePanel.items || []" :key="row.id" class="ox-vite-workspace-card">
                      <div class="ox-vite-workspace-card__head">
                        <div class="ox-vite-workspace-card__identity">
                          <div class="ox-vite-workspace-card__icon">
                            <i class="fa-solid fa-building"></i>
                          </div>
                          <div class="ox-vite-workspace-card__copy">
                            <div class="ox-vite-workspace-card__name">{{ row.name }}</div>
                            <div class="ox-vite-workspace-card__meta">{{ row.summary || row.path }}</div>
                          </div>
                        </div>
                        <span class="ox-vite-detail-chip">{{ row.type }}</span>
                      </div>

                      <div class="ox-vite-workspace-card__stats">
                        <article class="ox-vite-workspace-card__stat">
                          <span>{{ isZh ? '项目楼层' : 'Projects' }}</span>
                          <strong>{{ row.projectCount }}</strong>
                        </article>
                        <article class="ox-vite-workspace-card__stat">
                          <span>{{ isZh ? '指派角色' : 'Roles' }}</span>
                          <strong>{{ row.roleCount }}</strong>
                        </article>
                        <article class="ox-vite-workspace-card__stat">
                          <span>{{ isZh ? '权限' : 'Permission' }}</span>
                          <strong>{{ getWorkspacePermissionLabel(row.permission) }}</strong>
                        </article>
                      </div>

                      <div class="ox-vite-chip-grid">
                        <span class="ox-vite-detail-chip">{{ row.summary || row.path }}</span>
                        <span v-if="row.updatedAt" class="ox-vite-detail-chip">{{ row.updatedAt }}</span>
                      </div>

                      <div class="ox-vite-workspace-card__actions">
                        <button type="button" class="ox-vite-ops-primary-btn" @click="handleEnterpriseOpenWorkspace(row.id)">
                          <i class="fa-solid fa-cube"></i>
                          <span>{{ isZh ? '进入企业沙盘' : 'Open Sandbox' }}</span>
                        </button>
                        <button type="button" class="ox-vite-ops-secondary-btn" @click="handleEnterpriseEditWorkspace(row.id)">
                          <i class="fa-solid fa-pen"></i>
                          <span>{{ isZh ? '复制配置' : 'Duplicate Draft' }}</span>
                        </button>
                        <button type="button" class="ox-vite-ops-secondary-btn" @click="handleEnterpriseDeleteWorkspace(row.id)">
                          <i class="fa-regular fa-trash-can"></i>
                          <span>{{ isZh ? '删除' : 'Delete' }}</span>
                        </button>
                      </div>
                    </article>
                  </section>

                  <section v-else class="ox-vite-empty-state">
                    <i class="fa-solid fa-building"></i>
                    <strong>{{ isZh ? '还没有工作空间' : 'No workspaces yet' }}</strong>
                    <p>{{ isZh ? '创建第一个工作空间后，这里会展示项目边界、权限和角色绑定。' : 'Create the first workspace and this panel will show project boundaries, permissions, and role bindings.' }}</p>
                    <button type="button" class="ox-vite-ops-primary-btn" @click="handleEnterpriseCreateWorkspace">
                      <i class="fa-solid fa-plus"></i>
                      <span>{{ isZh ? '创建第一个工作空间' : 'Create the first workspace' }}</span>
                    </button>
                  </section>
                </section>
              </template>

              <template v-else-if="data.activeTab === 'enterprise-sandbox'">
                <section class="ox-vite-sandbox-shell">
                  <section class="ox-vite-sandbox-hero">
                    <div class="ox-vite-sandbox-hero__head">
                      <button
                        v-if="enterpriseSandboxPanel.level > 0"
                        type="button"
                        class="ox-vite-sandbox-back"
                        @click="handleSandboxGoBack"
                      >
                        <i class="fa-solid fa-chevron-left"></i>
                      </button>
                      <div class="ox-vite-sandbox-hero__copy">
                        <div class="ox-vite-ops-header__kicker">{{ isZh ? '企业沙盘' : 'Enterprise Sandbox' }}</div>
                        <h2>{{ enterpriseSandboxPanel.levelLabel || (isZh ? '企业园区' : 'Enterprise Campus') }}</h2>
                        <p>
                          {{ isZh
                            ? '在这里按层级查看当前工作空间、项目楼层与员工编组，逐步逼近 3D 沙盘里的结构关系。'
                            : 'Inspect the current workspace, project floors, and staff roster by level, moving closer to the full 3D sandbox structure.' }}
                        </p>
                      </div>
                    </div>

                    <div class="ox-vite-sandbox-breadcrumb">
                      <button
                        v-for="(crumb, index) in enterpriseSandboxPanel.breadcrumb || []"
                        :key="`${crumb.id}-${index}`"
                        type="button"
                        class="ox-vite-sandbox-breadcrumb__chip"
                        :class="{ 'is-current': index === (enterpriseSandboxPanel.breadcrumb || []).length - 1 }"
                        @click="index === (enterpriseSandboxPanel.breadcrumb || []).length - 1 ? null : handleSandboxBreadcrumbClick(crumb)"
                      >
                        {{ crumb.label }}
                      </button>
                    </div>
                  </section>

                  <section class="ox-vite-stat-grid">
                    <article class="ox-vite-stat-card">
                      <span>{{ isZh ? '当前层级' : 'Current Level' }}</span>
                      <strong>{{ enterpriseSandboxPanel.level }}</strong>
                      <small>{{ enterpriseSandboxPanel.levelLabel }}</small>
                    </article>
                    <article class="ox-vite-stat-card">
                      <span>{{ isZh ? '当前工作空间' : 'Current Workspace' }}</span>
                      <strong>{{ enterpriseSandboxPanel.currentWorkspace || '-' }}</strong>
                    </article>
                    <article class="ox-vite-stat-card">
                      <span>{{ isZh ? '当前项目' : 'Current Project' }}</span>
                      <strong>{{ enterpriseSandboxPanel.currentProject || '-' }}</strong>
                    </article>
                    <article class="ox-vite-stat-card">
                      <span>{{ isZh ? '沙盘智能体' : 'Sandbox Agents' }}</span>
                      <strong>{{ enterpriseSandboxPanel.roleCount || (enterpriseSandboxPanel.items || []).length }}</strong>
                    </article>
                  </section>

                  <section class="ox-vite-sandbox-layout">
                    <article class="ox-vite-panel-card">
                      <div class="ox-vite-panel-card__head">
                        <div>
                          <div class="ox-vite-ops-header__kicker">{{ isZh ? '工作空间层' : 'Workspace Layer' }}</div>
                          <h2>{{ isZh ? '当前工作空间入口' : 'Workspace Access Points' }}</h2>
                        </div>
                        <button type="button" class="ox-vite-ops-primary-btn" @click="handleEnterpriseCreateWorkspace">
                          <i class="fa-solid fa-plus"></i>
                          <span>{{ isZh ? '创建工作空间' : 'Create Workspace' }}</span>
                        </button>
                      </div>

                      <div class="ox-vite-sandbox-workspace-shell">
                        <div class="ox-vite-workspace-grid ox-vite-workspace-grid--compact">
                          <button
                            v-for="row in enterpriseSandboxPanel.workspaces || []"
                            :key="`sandbox-${row.id}`"
                            type="button"
                            class="ox-vite-workspace-card ox-vite-workspace-card--compact ox-vite-workspace-card--selectable"
                            :class="{ 'is-selected': enterpriseSelectedSandboxWorkspace && enterpriseSelectedSandboxWorkspace.id === row.id }"
                            @click="handleSandboxSelectWorkspace(row.id)"
                          >
                            <div class="ox-vite-workspace-card__head">
                              <div class="ox-vite-workspace-card__identity">
                                <div class="ox-vite-workspace-card__icon">
                                  <i class="fa-solid fa-building"></i>
                                </div>
                                <div class="ox-vite-workspace-card__copy">
                                  <div class="ox-vite-workspace-card__name">{{ row.name }}</div>
                                  <div class="ox-vite-workspace-card__meta">{{ row.type }}</div>
                                </div>
                              </div>
                            </div>
                            <div class="ox-vite-chip-grid">
                              <span class="ox-vite-detail-chip">{{ row.projectCount }} {{ isZh ? '个项目' : 'projects' }}</span>
                              <span class="ox-vite-detail-chip">{{ row.roleCount }} {{ isZh ? '个角色' : 'roles' }}</span>
                            </div>
                            <div class="ox-vite-workspace-card__actions">
                              <button type="button" class="ox-vite-ops-primary-btn" @click.stop="handleEnterpriseOpenWorkspace(row.id)">
                                <i class="fa-solid fa-cube"></i>
                                <span>{{ isZh ? '进入' : 'Open' }}</span>
                              </button>
                            </div>
                          </button>
                        </div>

                        <aside v-if="enterpriseSelectedSandboxWorkspace" class="ox-vite-sandbox-detail-card">
                          <div class="ox-vite-panel-card__head">
                            <div>
                              <div class="ox-vite-ops-header__kicker">{{ isZh ? '工作空间详情' : 'Workspace Detail' }}</div>
                              <h2>{{ enterpriseSelectedSandboxWorkspace.name }}</h2>
                            </div>
                          </div>
                          <div class="ox-vite-sandbox-detail-card__hero">
                            <div class="ox-vite-workspace-card__icon ox-vite-project-card__icon--large">
                              <i class="fa-solid fa-building"></i>
                            </div>
                            <div>
                              <div class="ox-vite-sandbox-detail-card__title">{{ enterpriseSelectedSandboxWorkspace.type }}</div>
                              <div class="ox-vite-sandbox-detail-card__meta">{{ enterpriseSelectedSandboxWorkspace.summary || enterpriseSelectedSandboxWorkspace.path }}</div>
                            </div>
                          </div>
                          <div class="ox-vite-chip-grid">
                            <span class="ox-vite-detail-chip">{{ enterpriseSelectedSandboxWorkspace.projectCount }} {{ isZh ? '个项目' : 'projects' }}</span>
                            <span class="ox-vite-detail-chip">{{ enterpriseSelectedSandboxWorkspace.roleCount }} {{ isZh ? '个角色' : 'roles' }}</span>
                            <span class="ox-vite-detail-chip">{{ getWorkspacePermissionLabel(enterpriseSelectedSandboxWorkspace.permission) }}</span>
                          </div>
                          <div class="ox-vite-workspace-card__actions">
                            <button type="button" class="ox-vite-ops-primary-btn" @click="handleEnterpriseOpenWorkspace(enterpriseSelectedSandboxWorkspace.id)">
                              <i class="fa-solid fa-cube"></i>
                              <span>{{ isZh ? '进入工作空间层' : 'Open Workspace Layer' }}</span>
                            </button>
                            <button type="button" class="ox-vite-ops-secondary-btn" @click="handleEnterpriseEditWorkspace(enterpriseSelectedSandboxWorkspace.id)">
                              <i class="fa-solid fa-pen"></i>
                              <span>{{ isZh ? '编辑工作空间' : 'Edit Workspace' }}</span>
                            </button>
                            <button type="button" class="ox-vite-ops-secondary-btn" @click="handleEnterpriseCreateProject(enterpriseSelectedSandboxWorkspace.id)">
                              <i class="fa-solid fa-layer-group"></i>
                              <span>{{ isZh ? '添加项目' : 'Add Project' }}</span>
                            </button>
                          </div>
                        </aside>
                      </div>
                    </article>

                    <article class="ox-vite-panel-card">
                      <div class="ox-vite-panel-card__head">
                        <div>
                          <div class="ox-vite-ops-header__kicker">{{ isZh ? '项目楼层' : 'Project Floors' }}</div>
                          <h2>{{ isZh ? '当前上下文中的项目编组' : 'Projects in the Current Context' }}</h2>
                        </div>
                        <button
                          type="button"
                          class="ox-vite-ops-secondary-btn"
                          :disabled="!enterpriseSandboxPanel.currentWorkspaceId"
                          @click="handleEnterpriseCreateProject(enterpriseSandboxPanel.currentWorkspaceId)"
                        >
                          <i class="fa-solid fa-layer-group"></i>
                          <span>{{ isZh ? '添加项目楼层' : 'Add Project Floor' }}</span>
                        </button>
                      </div>

                      <div v-if="enterpriseSandboxPanel.projects?.length" class="ox-vite-sandbox-project-shell">
                        <div class="ox-vite-role-template-grid">
                          <button
                            v-for="row in enterpriseSandboxPanel.projects || []"
                            :key="row.id"
                            type="button"
                            class="ox-vite-project-card ox-vite-project-card--selectable"
                            :class="{ 'is-selected': enterpriseSelectedSandboxProject && enterpriseSelectedSandboxProject.id === row.id }"
                            @click="handleSandboxSelectProject(row.id)"
                          >
                            <div class="ox-vite-project-card__head">
                              <div class="ox-vite-project-card__icon" :style="{ background: row.color }">
                                <i :class="row.icon"></i>
                              </div>
                              <div>
                                <div class="ox-vite-project-card__name">{{ row.name }}</div>
                                <div class="ox-vite-project-card__meta">{{ row.workspace || (isZh ? '未绑定工作空间' : 'No workspace') }}</div>
                              </div>
                            </div>
                            <p>{{ row.description || (isZh ? '当前项目楼层还没有补充描述。' : 'No project description yet.') }}</p>
                            <div class="ox-vite-chip-grid">
                              <span class="ox-vite-detail-chip">{{ isZh ? `第 ${row.floor} 层` : `Floor ${row.floor}` }}</span>
                            </div>
                          </button>
                        </div>

                        <aside v-if="enterpriseSelectedSandboxProject" class="ox-vite-sandbox-detail-card">
                          <div class="ox-vite-panel-card__head">
                            <div>
                              <div class="ox-vite-ops-header__kicker">{{ isZh ? '项目详情' : 'Project Detail' }}</div>
                              <h2>{{ enterpriseSelectedSandboxProject.name }}</h2>
                            </div>
                          </div>
                          <div class="ox-vite-sandbox-detail-card__hero">
                            <div class="ox-vite-project-card__icon ox-vite-project-card__icon--large" :style="{ background: enterpriseSelectedSandboxProject.color }">
                              <i :class="enterpriseSelectedSandboxProject.icon"></i>
                            </div>
                            <div>
                              <div class="ox-vite-sandbox-detail-card__title">{{ enterpriseSelectedSandboxProject.workspace || (isZh ? '未绑定工作空间' : 'No workspace') }}</div>
                              <div class="ox-vite-sandbox-detail-card__meta">{{ isZh ? `第 ${enterpriseSelectedSandboxProject.floor} 层` : `Floor ${enterpriseSelectedSandboxProject.floor}` }}</div>
                            </div>
                          </div>
                          <p class="ox-vite-sandbox-detail-card__summary">
                            {{ enterpriseSelectedSandboxProject.description || (isZh ? '当前项目楼层还没有补充描述。' : 'No project description yet.') }}
                          </p>
                          <div class="ox-vite-workspace-card__actions">
                            <button type="button" class="ox-vite-ops-primary-btn" @click="handleEnterpriseOpenProject(enterpriseSelectedSandboxProject.id)">
                              <i class="fa-solid fa-cube"></i>
                              <span>{{ isZh ? '进入项目楼层' : 'Open Project Floor' }}</span>
                            </button>
                            <button type="button" class="ox-vite-ops-secondary-btn" @click="handleEnterpriseEditProject(enterpriseSelectedSandboxProject.id, enterpriseSelectedSandboxProject.workspaceId)">
                              <i class="fa-solid fa-pen"></i>
                              <span>{{ isZh ? '编辑项目' : 'Edit Project' }}</span>
                            </button>
                            <button type="button" class="ox-vite-ops-secondary-btn" @click="handleSandboxCreateRoleForCurrentProject()">
                              <i class="fa-solid fa-user-plus"></i>
                              <span>{{ isZh ? '添加员工' : 'Add Staff Role' }}</span>
                            </button>
                            <button type="button" class="ox-vite-ops-secondary-btn" @click="handleEnterpriseDeleteProject(enterpriseSelectedSandboxProject.id)">
                              <i class="fa-regular fa-trash-can"></i>
                              <span>{{ isZh ? '删除项目' : 'Delete Project' }}</span>
                            </button>
                          </div>
                        </aside>
                      </div>
                      <div v-else class="ox-vite-empty-state">
                        <i class="fa-solid fa-layer-group"></i>
                        <strong>{{ isZh ? '当前还没有项目楼层' : 'No project floors yet' }}</strong>
                        <p>{{ isZh ? '先进入一个工作空间，再为它添加项目楼层。' : 'Enter a workspace first, then add project floors for it.' }}</p>
                      </div>
                    </article>
                  </section>

                  <section class="ox-vite-panel-card">
                    <div class="ox-vite-panel-card__head">
                      <div>
                        <div class="ox-vite-ops-header__kicker">{{ isZh ? '员工编组' : 'Sandbox Roster' }}</div>
                        <h2>{{ isZh ? '当前沙盘中的员工角色' : 'Staff Roles Inside the Current Sandbox' }}</h2>
                      </div>
                      <button type="button" class="ox-vite-ops-secondary-btn" @click="handleEnterpriseCreateRole">
                        <i class="fa-solid fa-user-plus"></i>
                        <span>{{ isZh ? '添加员工角色' : 'Add Staff Role' }}</span>
                      </button>
                    </div>

                    <div v-if="enterpriseSandboxPanel.items?.length" class="ox-vite-sandbox-roster-shell">
                      <div class="ox-vite-role-library-grid">
                        <button
                          v-for="row in enterpriseSandboxPanel.items || []"
                          :key="row.id"
                          type="button"
                          class="ox-vite-role-library-card ox-vite-role-library-card--selectable"
                          :class="{ 'is-selected': enterpriseSelectedSandboxAgent && enterpriseSelectedSandboxAgent.id === row.id }"
                          @click="handleSandboxSelectAgent(row.id)"
                        >
                          <div class="ox-vite-role-library-card__hero">
                            <div class="ox-vite-role-library-card__icon">
                              <i :class="row.icon"></i>
                            </div>
                            <div class="ox-vite-role-library-card__identity">
                              <div class="ox-vite-role-library-card__name">{{ row.name }}</div>
                              <div class="ox-vite-role-library-card__meta">
                                <span>{{ row.department || row.role }}</span>
                                <span v-if="row.workspace">{{ row.workspace }}</span>
                                <span v-if="row.project">{{ row.project }}</span>
                              </div>
                            </div>
                          </div>
                          <div class="ox-vite-chip-grid">
                            <span class="ox-vite-detail-chip">{{ getSandboxStatusLabel(row.status) }}</span>
                            <span v-for="skill in row.skills || []" :key="`${row.id}-${skill}`" class="ox-vite-detail-chip">{{ skill }}</span>
                          </div>
                        </button>
                      </div>

                      <aside v-if="enterpriseSelectedSandboxAgent" class="ox-vite-sandbox-detail-card">
                        <div class="ox-vite-panel-card__head">
                          <div>
                            <div class="ox-vite-ops-header__kicker">{{ isZh ? '员工详情' : 'Staff Detail' }}</div>
                            <h2>{{ enterpriseSelectedSandboxAgent.name }}</h2>
                          </div>
                        </div>
                        <div class="ox-vite-sandbox-detail-card__hero">
                          <div class="ox-vite-role-library-card__icon ox-vite-role-library-card__icon--large">
                            <i :class="enterpriseSelectedSandboxAgent.icon"></i>
                          </div>
                          <div>
                            <div class="ox-vite-sandbox-detail-card__title">{{ enterpriseSelectedSandboxAgent.department || enterpriseSelectedSandboxAgent.role }}</div>
                            <div class="ox-vite-sandbox-detail-card__meta">
                              {{ enterpriseSelectedSandboxAgent.workspace || '-' }}
                              <span v-if="enterpriseSelectedSandboxAgent.project"> · {{ enterpriseSelectedSandboxAgent.project }}</span>
                            </div>
                          </div>
                        </div>
                        <p class="ox-vite-sandbox-detail-card__summary">
                          {{ enterpriseSelectedSandboxAgent.summary || (isZh ? '当前员工角色还没有补充摘要，后续可以继续细化职责、边界和提示词。' : 'This staff role does not have a summary yet. Responsibilities, boundaries, and prompts can be refined next.') }}
                        </p>
                        <div class="ox-vite-chip-grid">
                          <span class="ox-vite-detail-chip">{{ getSandboxStatusLabel(enterpriseSelectedSandboxAgent.status) }}</span>
                          <span v-for="skill in enterpriseSelectedSandboxAgent.skills || []" :key="`${enterpriseSelectedSandboxAgent.id}-detail-${skill}`" class="ox-vite-detail-chip">{{ skill }}</span>
                        </div>
                        <div class="ox-vite-workspace-card__actions">
                          <button type="button" class="ox-vite-ops-secondary-btn" @click="handleSandboxEditAgent(enterpriseSelectedSandboxAgent.id)">
                            <i class="fa-solid fa-pen"></i>
                            <span>{{ isZh ? '编辑角色' : 'Edit Role' }}</span>
                          </button>
                          <button type="button" class="ox-vite-ops-primary-btn" @click="handleSandboxOpenAgentChat(enterpriseSelectedSandboxAgent.id)">
                            <i class="fa-solid fa-comments"></i>
                            <span>{{ isZh ? '发起对话' : 'Open Chat' }}</span>
                          </button>
                          <button type="button" class="ox-vite-ops-secondary-btn" @click="handleEnterpriseDeleteRole(enterpriseSelectedSandboxAgent.id)">
                            <i class="fa-regular fa-trash-can"></i>
                            <span>{{ isZh ? '删除角色' : 'Delete Role' }}</span>
                          </button>
                        </div>
                      </aside>
                    </div>
                    <div v-else class="ox-vite-empty-state">
                      <i class="fa-solid fa-user-group"></i>
                      <strong>{{ isZh ? '还没有沙盘智能体' : 'No sandbox agents yet' }}</strong>
                      <p>{{ isZh ? '当工作空间和角色绑定后，这里会开始显示沙盘编组。' : 'Once workspaces and roles are bound, sandbox rosters will appear here.' }}</p>
                    </div>
                  </section>
                </section>
              </template>

              <template v-else>
                <section class="ox-vite-media-grid">
                  <article v-for="row in data.xnetPanel?.items || []" :key="row.id" class="ox-vite-media-card">
                    <strong>{{ row.title }}</strong>
                    <small>{{ row.status }}</small>
                    <div class="ox-vite-chip-grid">
                      <span class="ox-vite-detail-chip">{{ row.autoConnect ? (isZh ? '自动连接' : 'Auto connect') : (isZh ? '手动检查' : 'Manual check') }}</span>
                    </div>
                    <small>{{ row.url || (isZh ? '未配置服务地址' : 'No configured URL') }}</small>
                    <small>{{ row.lastCheck || (isZh ? '尚未检查' : 'Not checked yet') }}</small>
                  </article>
                </section>
              </template>
            </template>

            <template v-else-if="props.surface === 'storage'">
              <section class="ox-vite-chip-grid">
                <span v-for="item in data.overviewStats || []" :key="item.id" class="ox-vite-detail-chip">
                  <i :class="item.icon"></i>
                  <span>{{ item.label }} {{ item.value }}</span>
                </span>
              </section>

              <section v-if="data.activeTab === 'memory-v3'" class="ox-vite-memory-workbench">
                <div class="ox-vite-memory-toolbar">
                  <label class="ox-vite-memory-actor">
                    <i class="fa-solid fa-user-gear"></i>
                    <select v-model="memoryActorAgent" @change="applyMemoryFilters">
                      <option v-for="agent in synapxnetMemoryData.agentOptions || []" :key="agent.id" :value="agent.id">
                        {{ agent.name }}
                      </option>
                    </select>
                  </label>
                  <label class="ox-vite-memory-search">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <input
                      v-model="memoryQuery"
                      type="search"
                      :placeholder="isZh ? '搜索标题、内容、任务或标签' : 'Search title, content, task, or tags'"
                      @keyup.enter="applyMemoryFilters"
                    />
                  </label>
                  <label class="ox-vite-memory-check">
                    <input v-model="memoryIncludeRetired" type="checkbox" @change="applyMemoryFilters" />
                    <span>{{ isZh ? '显示已退役' : 'Show retired' }}</span>
                  </label>
                  <div class="ox-vite-memory-toolbar__actions">
                    <button type="button" class="ox-vite-icon-btn" :title="isZh ? '校验完整性' : 'Verify integrity'" :disabled="memoryActionBusy" @click="handleMemoryVerify">
                      <i class="fa-solid fa-shield-halved"></i>
                    </button>
                    <button type="button" class="ox-vite-icon-btn" :title="isZh ? '导入记忆' : 'Import memory'" :disabled="memoryActionBusy" @click="handleMemoryImport">
                      <i class="fa-solid fa-file-import"></i>
                    </button>
                    <button type="button" class="ox-vite-ops-primary-btn" :disabled="memoryActionBusy" @click="openMemoryCreateEditor">
                      <i class="fa-solid fa-plus"></i>
                      <span>{{ isZh ? '新建记忆' : 'New Memory' }}</span>
                    </button>
                  </div>
                </div>

                <div v-if="memoryActionError || synapxnetMemoryData.error" class="ox-vite-memory-notice is-error">
                  <i class="fa-solid fa-circle-exclamation"></i>
                  <span>{{ memoryActionError || synapxnetMemoryData.error }}</span>
                </div>
                <div v-else-if="synapxnetMemoryData.integrity" class="ox-vite-memory-notice" :class="{ 'is-ok': synapxnetMemoryData.integrity.healthy }">
                  <i :class="synapxnetMemoryData.integrity.healthy ? 'fa-solid fa-circle-check' : 'fa-solid fa-triangle-exclamation'"></i>
                  <span>{{ getMemoryIntegrityMessage(synapxnetMemoryData) }}</span>
                </div>

                <div class="ox-vite-memory-layout" :class="{ 'is-loading': synapxnetMemoryData.loading || memoryActionBusy }">
                  <aside class="ox-vite-memory-library">
                    <div class="ox-vite-memory-pane-head">
                      <div>
                        <span>{{ isZh ? '记忆池' : 'Memory Pool' }}</span>
                        <strong>{{ (synapxnetMemoryData.items || []).length }}</strong>
                      </div>
                      <button type="button" class="ox-vite-icon-btn" :title="isZh ? '刷新' : 'Refresh'" @click="applyMemoryFilters">
                        <i class="fa-solid fa-rotate-right"></i>
                      </button>
                    </div>
                    <div v-if="(synapxnetMemoryData.items || []).length" class="ox-vite-memory-list">
                      <button
                        v-for="item in synapxnetMemoryData.items || []"
                        :key="item.memoryId"
                        type="button"
                        class="ox-vite-memory-row"
                        :class="{ active: synapxnetMemoryData.selectedMemoryId === item.memoryId }"
                        @click="handleMemorySelect(item.memoryId)"
                      >
                        <div class="ox-vite-memory-row__head">
                          <strong>{{ item.title }}</strong>
                          <div class="ox-vite-memory-row__badges">
                            <span class="ox-vite-memory-type-badge" :data-memory-type="item.memoryType">
                              <i :class="getMemoryTypeIcon(item.memoryType)"></i>
                              {{ getMemoryTypeLabel(item.memoryType) }}
                            </span>
                            <span>v{{ item.version }}</span>
                          </div>
                        </div>
                        <p>{{ item.contentPreview || (isZh ? '暂无摘要' : 'No preview') }}</p>
                        <div class="ox-vite-memory-row__meta">
                          <span><i class="fa-regular fa-user"></i>{{ item.ownerAgent }}</span>
                          <span :class="{ 'is-retired': item.status === 'RETIRED' }">{{ item.status === 'RETIRED' ? (isZh ? '已退役' : 'Retired') : (isZh ? '生效中' : 'Active') }}</span>
                        </div>
                      </button>
                    </div>
                    <div v-else class="ox-vite-memory-empty">
                      <i class="fa-regular fa-folder-open"></i>
                      <span>{{ isZh ? '当前 Agent 暂无可见记忆' : 'No visible memory for this agent' }}</span>
                    </div>
                  </aside>

                  <main class="ox-vite-memory-inspector">
                    <template v-if="memoryEditorOpen">
                      <div class="ox-vite-memory-pane-head">
                        <div>
                          <span>{{ memoryEditorMode === 'edit' ? (isZh ? '编辑为新版本' : 'Edit as New Version') : (isZh ? '新建长期记忆' : 'Create Long-term Memory') }}</span>
                          <strong>{{ memoryEditorMode === 'edit' ? `v${memoryDraft.baseVersion + 1}` : 'V3' }}</strong>
                        </div>
                        <button type="button" class="ox-vite-icon-btn" :title="isZh ? '关闭' : 'Close'" @click="memoryEditorOpen = false">
                          <i class="fa-solid fa-xmark"></i>
                        </button>
                      </div>
                      <div class="ox-vite-memory-form">
                        <label v-if="memoryEditorMode === 'create'" class="ox-vite-field">
                          <span>{{ isZh ? '任务标识' : 'Task ID' }}</span>
                          <input v-model="memoryDraft.taskId" type="text" />
                        </label>
                        <label class="ox-vite-field ox-vite-field--wide">
                          <span>{{ isZh ? '标题' : 'Title' }}</span>
                          <input v-model="memoryDraft.title" type="text" />
                        </label>
                        <label class="ox-vite-field ox-vite-field--wide">
                          <span>{{ isZh ? '记忆内容' : 'Memory Content' }}</span>
                          <textarea v-model="memoryDraft.content" rows="10"></textarea>
                        </label>
                        <label class="ox-vite-field">
                          <span>{{ isZh ? '共享 Agent' : 'Shared Agents' }}</span>
                          <input v-model="memoryDraft.permissionsText" type="text" :placeholder="isZh ? '用逗号分隔，* 表示公开' : 'Comma-separated; * means public'" />
                        </label>
                        <label class="ox-vite-field">
                          <span>{{ isZh ? '标签' : 'Tags' }}</span>
                          <input v-model="memoryDraft.tagsText" type="text" :placeholder="isZh ? '用逗号分隔' : 'Comma-separated'" />
                        </label>
                        <label class="ox-vite-field">
                          <span>{{ isZh ? '质量评分' : 'Quality Score' }} {{ Number(memoryDraft.qualityScore).toFixed(2) }}</span>
                          <input v-model.number="memoryDraft.qualityScore" type="range" min="0" max="1" step="0.05" />
                        </label>
                        <label v-if="memoryEditorMode === 'edit'" class="ox-vite-field ox-vite-field--wide">
                          <span>{{ isZh ? '修改原因' : 'Change Reason' }}</span>
                          <input v-model="memoryDraft.reason" type="text" />
                        </label>
                      </div>
                      <div class="ox-vite-memory-actions">
                        <button type="button" class="ox-vite-ops-secondary-btn" @click="memoryEditorOpen = false">
                          <span>{{ isZh ? '取消' : 'Cancel' }}</span>
                        </button>
                        <button
                          type="button"
                          class="ox-vite-ops-primary-btn"
                          :disabled="memoryActionBusy || !memoryDraft.title || !memoryDraft.content || (memoryEditorMode === 'create' && !memoryDraft.taskId)"
                          @click="submitMemoryEditor"
                        >
                          <i class="fa-solid fa-check"></i>
                          <span>{{ isZh ? '提交版本' : 'Commit Version' }}</span>
                        </button>
                      </div>
                    </template>

                    <template v-else-if="synapxnetMemoryData.selectedMemory">
                      <div class="ox-vite-memory-pane-head">
                        <div>
                          <span>{{ synapxnetMemoryData.selectedMemory.taskId }}</span>
                          <strong>v{{ synapxnetMemoryData.selectedMemory.version }}</strong>
                        </div>
                        <div class="ox-vite-memory-header-actions">
                          <button type="button" class="ox-vite-icon-btn" :title="isZh ? '导出迁移包' : 'Export transfer package'" @click="handleMemoryExport">
                            <i class="fa-solid fa-file-export"></i>
                          </button>
                          <button v-if="canEditSelectedMemory" type="button" class="ox-vite-icon-btn" :title="isZh ? '编辑' : 'Edit'" @click="openMemoryEditEditor">
                            <i class="fa-solid fa-pen"></i>
                          </button>
                        </div>
                      </div>
                      <div class="ox-vite-memory-document">
                        <h2>{{ synapxnetMemoryData.selectedMemory.title }}</h2>
                        <div class="ox-vite-memory-tags">
                          <span class="ox-vite-memory-type-badge" :data-memory-type="synapxnetMemoryData.selectedMemory.memoryType">
                            <i :class="getMemoryTypeIcon(synapxnetMemoryData.selectedMemory.memoryType)"></i>
                            {{ getMemoryTypeLabel(synapxnetMemoryData.selectedMemory.memoryType) }}
                          </span>
                          <span v-for="tag in getMemoryDisplayTags(synapxnetMemoryData.selectedMemory)" :key="tag.key">{{ tag.label }}</span>
                        </div>
                        <p>{{ synapxnetMemoryData.selectedMemory.content }}</p>
                      </div>
                      <dl class="ox-vite-memory-facts">
                        <div><dt>{{ isZh ? '所有者' : 'Owner' }}</dt><dd>{{ synapxnetMemoryData.selectedMemory.ownerAgent }}</dd></div>
                        <div><dt>{{ isZh ? '共享范围' : 'Shared With' }}</dt><dd>{{ (synapxnetMemoryData.selectedMemory.permissions || []).join(', ') || (isZh ? '仅所有者' : 'Owner only') }}</dd></div>
                        <div><dt>{{ isZh ? '记录哈希' : 'Record Hash' }}</dt><dd :title="synapxnetMemoryData.selectedMemory.recordSha256">{{ shortMemoryHash(synapxnetMemoryData.selectedMemory.recordSha256) }}</dd></div>
                        <div><dt>{{ isZh ? '提交时间' : 'Committed' }}</dt><dd>{{ formatMemoryTime(synapxnetMemoryData.selectedMemory.committedAtUtc) }}</dd></div>
                      </dl>
                      <div v-if="canEditSelectedMemory && synapxnetMemoryData.selectedMemory.status !== 'RETIRED'" class="ox-vite-memory-actions">
                        <button type="button" class="ox-vite-ops-secondary-btn is-danger" @click="handleMemoryRetire">
                          <i class="fa-solid fa-box-archive"></i>
                          <span>{{ isZh ? '退役记忆' : 'Retire Memory' }}</span>
                        </button>
                      </div>
                    </template>

                    <div v-else class="ox-vite-memory-empty">
                      <i class="fa-solid fa-brain"></i>
                      <span>{{ isZh ? '选择或新建一条记忆' : 'Select or create a memory' }}</span>
                    </div>
                  </main>

                  <aside class="ox-vite-memory-history">
                    <div class="ox-vite-memory-pane-head">
                      <div>
                        <span>{{ isZh ? '版本时间线' : 'Version Timeline' }}</span>
                        <strong>{{ (synapxnetMemoryData.history || []).length }}</strong>
                      </div>
                    </div>
                    <div v-if="(synapxnetMemoryData.history || []).length" class="ox-vite-memory-version-list">
                      <article v-for="version in synapxnetMemoryData.history || []" :key="version.recordSha256" class="ox-vite-memory-version">
                        <div class="ox-vite-memory-version__rail"><span></span></div>
                        <div class="ox-vite-memory-version__body">
                          <div class="ox-vite-memory-version__head">
                            <strong>v{{ version.version }}</strong>
                            <span>{{ version.operation }}</span>
                          </div>
                          <p>{{ formatMemoryTime(version.committedAtUtc) }}</p>
                          <small :title="version.recordSha256">{{ shortMemoryHash(version.recordSha256) }}</small>
                          <button
                            v-if="canEditSelectedMemory && version.version !== synapxnetMemoryData.selectedMemory?.version"
                            type="button"
                            class="ox-vite-memory-version__rollback"
                            @click="handleMemoryRollback(version)"
                          >
                            <i class="fa-solid fa-clock-rotate-left"></i>
                            <span>{{ isZh ? '回滚至此版本' : 'Rollback to this version' }}</span>
                          </button>
                        </div>
                      </article>
                    </div>
                    <div v-else class="ox-vite-memory-empty is-compact">
                      <span>{{ isZh ? '暂无版本记录' : 'No version history' }}</span>
                    </div>
                  </aside>
                </div>
              </section>

              <section v-else-if="data.activeTab === 'text'" class="ox-vite-panel-card">
                <div class="ox-vite-list">
                  <article v-for="file in data.textFiles || []" :key="file.id" class="ox-vite-list-row">
                    <div><strong>{{ file.name }}</strong><p>{{ file.ext }} · {{ file.size }}</p></div>
                    <span>{{ file.time }}</span>
                  </article>
                </div>
              </section>

              <section v-else-if="data.activeTab === 'image'" class="ox-vite-media-grid">
                <article v-for="file in data.imageFiles || []" :key="file.id" class="ox-vite-media-card">
                  <div class="ox-vite-media-card__thumb"><i class="fa-regular fa-image"></i></div>
                  <strong>{{ file.name }}</strong>
                  <small>{{ file.size }}</small>
                </article>
              </section>

              <section v-else-if="data.activeTab === 'video'" class="ox-vite-media-grid">
                <article v-for="file in data.videoFiles || []" :key="file.id" class="ox-vite-media-card">
                  <div class="ox-vite-media-card__thumb"><i class="fa-solid fa-play"></i></div>
                  <strong>{{ file.name }}</strong>
                  <small>{{ file.duration }} · {{ file.size }}</small>
                </article>
              </section>

              <section v-else class="ox-vite-panel-card">
                <div class="ox-vite-list">
                  <article v-for="item in data.recallItems || []" :key="item.id" class="ox-vite-list-row">
                    <div><strong>{{ item.title }}</strong><p>{{ item.note }}</p></div>
                  </article>
                </div>
              </section>
            </template>

            <template v-else-if="props.surface === 'kernel'">
              <div class="ox-vite-tab-strip">
                <button
                  v-for="tab in data.tabs || []"
                  :key="tab.id"
                  type="button"
                  class="ox-vite-strip-tab"
                  :class="{ active: data.activeTab === tab.id }"
                  @click="handleSelectTab(tab.id)"
                >
                  <i :class="tab.icon"></i>
                  <span>{{ tab.label }}</span>
                </button>
              </div>

              <section class="ox-vite-stat-grid">
                <article v-for="card in data.metrics || []" :key="card.id" class="ox-vite-stat-card">
                  <span>{{ card.label }}</span>
                  <strong>{{ card.value }}</strong>
                  <small>{{ card.note }}</small>
                </article>
              </section>

              <section class="ox-vite-card-grid">
                <article class="ox-vite-panel-card">
                  <div class="ox-vite-panel-card__head">
                    <h2>{{ isZh ? '运行画像' : 'Runtime Profile' }}</h2>
                    <p>{{ data.updatedLabel }}</p>
                  </div>
                  <div class="ox-vite-list">
                    <article v-for="row in data.runtimeRows || []" :key="row.label" class="ox-vite-list-row">
                      <div><strong>{{ row.label }}</strong></div>
                      <span>{{ row.value }}</span>
                    </article>
                  </div>
                </article>

                <article class="ox-vite-panel-card">
                  <div class="ox-vite-panel-card__head">
                    <h2>{{ isZh ? '计划与动作' : 'Plans & Actions' }}</h2>
                    <p>{{ isZh ? '优先显示近期内核行动与下一步建议。' : 'Show recent kernel actions and recommended next steps first.' }}</p>
                  </div>
                  <div class="ox-vite-list">
                    <article v-for="item in data.actions || []" :key="item.id" class="ox-vite-list-row">
                      <div><strong>{{ item.title }}</strong><p>{{ item.type }}</p></div>
                      <span>{{ item.status }}{{ item.next ? ` · ${item.next}` : '' }}</span>
                    </article>
                  </div>
                </article>
              </section>
            </template>
          </main>
        </div>
      </div>
    </template>
  </div>
</template>

<style>
.openxnet-vite-ops-root-host {
  display: block;
  height: 100%;
  min-height: 0;
}

.ox-vite-ops-shell,
.ox-vite-ops-shell * {
  box-sizing: border-box;
}

.ox-vite-ops-shell {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  min-height: 0;
  padding: 14px 12px 16px;
  background: transparent;
  color: var(--ox-vite-text-primary, var(--ox-text-primary, #1e293b));
}

.ox-vite-ops-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 24px 0;
}

.ox-vite-ops-header__kicker {
  font-size: 12px;
  font-weight: 700;
  color: var(--ox-accent, #5ba3c5);
  text-transform: uppercase;
}

.ox-vite-ops-header h1 {
  margin: 8px 0 0;
  font-size: 32px;
  line-height: 1.06;
}

.ox-vite-ops-header p {
  margin: 10px 0 0;
  max-width: 780px;
  color: var(--ox-vite-text-secondary, var(--ox-text-secondary, #64748b));
  line-height: 1.6;
}

.ox-vite-ops-header__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.ox-vite-ops-main {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: auto;
  padding: 0 24px 24px;
}

.ox-vite-system-layout {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 16px;
  min-height: 0;
  flex: 1 1 auto;
}

.ox-vite-side-tabs,
.ox-vite-panel-card,
.ox-vite-summary-card,
.ox-vite-stat-card,
.ox-vite-info-card,
.ox-vite-task-column,
.ox-vite-task-detail,
.ox-vite-media-card,
.ox-vite-link-card,
.ox-vite-fact-row,
.ox-vite-about-mark {
  border: 1px solid var(--ox-vite-border, var(--ox-border, rgba(15, 23, 42, 0.08)));
  background: var(--ox-vite-surface, var(--ox-bg-surface, #ffffff));
}

.ox-vite-side-tabs,
.ox-vite-panel-card,
.ox-vite-summary-card,
.ox-vite-stat-card,
.ox-vite-info-card,
.ox-vite-task-column,
.ox-vite-task-detail,
.ox-vite-media-card,
.ox-vite-link-card,
.ox-vite-fact-row {
  border-radius: 18px;
}

.ox-vite-side-tabs {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: auto;
}

.ox-vite-side-tab,
.ox-vite-strip-tab,
.ox-vite-detail-chip,
.ox-vite-ops-secondary-btn,
.ox-vite-ops-primary-btn {
  min-height: 36px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font: inherit;
}

.ox-vite-side-tab,
.ox-vite-strip-tab,
.ox-vite-ops-secondary-btn {
  border: 1px solid var(--ox-vite-border, var(--ox-border, rgba(15, 23, 42, 0.08)));
  background: var(--ox-vite-surface, var(--ox-bg-surface, #ffffff));
  color: var(--ox-vite-text-secondary, var(--ox-text-secondary, #64748b));
  cursor: pointer;
}

.ox-vite-side-tab {
  justify-content: flex-start;
  padding: 0 12px;
}

.ox-vite-side-tab.active,
.ox-vite-strip-tab.active {
  background: var(--ox-vite-accent-soft, rgba(91, 163, 197, 0.08));
  color: var(--ox-vite-text-primary, var(--ox-text-primary, #1e293b));
}

.ox-vite-strip-tab {
  padding: 0 12px;
}

.ox-vite-tab-strip,
.ox-vite-chip-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.ox-vite-summary-card,
.ox-vite-panel-card,
.ox-vite-task-detail {
  padding: 18px;
}

.ox-vite-summary-card p {
  margin: 0;
  color: var(--ox-vite-text-secondary, var(--ox-text-secondary, #64748b));
  line-height: 1.7;
}

.ox-vite-summary-card .ox-vite-chip-grid {
  margin-top: 12px;
}

.ox-vite-workbench-summary {
  margin-top: 14px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.ox-vite-workbench-summary strong {
  display: block;
  margin-bottom: 10px;
  font-size: 14px;
}

.ox-vite-mini-bars {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(42px, 1fr));
  gap: 10px;
  align-items: end;
  min-height: 180px;
  padding: 18px 8px 4px;
}

.ox-vite-mini-bars__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  min-height: 160px;
  justify-content: flex-end;
}

.ox-vite-mini-bars__bar {
  width: 100%;
  min-height: 10px;
  border-radius: 10px 10px 4px 4px;
  background: var(--ox-accent-gradient, linear-gradient(180deg, #5ba3c5, #7bb8d4));
}

.ox-vite-mini-bars__item span {
  font-size: 11px;
  color: var(--ox-vite-text-secondary, var(--ox-text-secondary, #64748b));
}

.ox-vite-detail-chip {
  padding: 0 10px;
  background: var(--ox-vite-accent-soft, rgba(91, 163, 197, 0.08));
  color: var(--ox-vite-text-secondary, var(--ox-text-secondary, #64748b));
  border: 0;
  font-size: 12px;
}

.ox-vite-detail-chip.is-disabled {
  opacity: 0.6;
}

.ox-vite-stat-grid,
.ox-vite-card-grid,
.ox-vite-media-grid,
.ox-vite-about-grid,
.ox-vite-link-grid {
  display: grid;
  gap: 16px;
}

.ox-vite-stat-grid {
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.ox-vite-card-grid,
.ox-vite-about-grid {
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

.ox-vite-card-grid--workbench {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.ox-vite-media-grid {
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.ox-vite-link-grid {
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.ox-vite-stat-card {
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ox-vite-stat-card span,
.ox-vite-stat-card small {
  color: var(--ox-vite-text-secondary, var(--ox-text-secondary, #64748b));
}

.ox-vite-stat-card strong {
  font-size: 24px;
  line-height: 1.1;
}

.ox-vite-stat-card.emphasis {
  background: var(--ox-vite-accent-soft, rgba(91, 163, 197, 0.08));
}

.ox-vite-info-card {
  padding: 18px;
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr);
  gap: 12px;
}

.ox-vite-info-card__icon,
.ox-vite-about-mark {
  width: 40px;
  height: 40px;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--ox-vite-accent-soft, rgba(91, 163, 197, 0.08));
  color: var(--ox-accent, #5ba3c5);
}

.ox-vite-info-card h3,
.ox-vite-panel-card__head h2,
.ox-vite-task-column__head h2 {
  margin: 0;
  font-size: 18px;
}

.ox-vite-info-card p,
.ox-vite-panel-card__head p,
.ox-vite-list-row p,
.ox-vite-task-card__summary,
.ox-vite-task-detail__summary,
.ox-vite-empty-state strong,
.ox-vite-empty-state p,
.ox-vite-fact-row p,
.ox-vite-about-copy {
  margin: 6px 0 0;
  color: var(--ox-vite-text-secondary, var(--ox-text-secondary, #64748b));
  line-height: 1.6;
}

.ox-vite-deploy-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(220px, 0.6fr);
  gap: 16px;
  margin-bottom: 16px;
}

.ox-vite-deploy-hero__status {
  padding: 18px;
  border-radius: 16px;
  background: var(--ox-vite-shell-bg, var(--ox-bg-base, #f8fafc));
}

.ox-vite-deploy-kicker {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  font-weight: 700;
  color: var(--ox-accent, #5ba3c5);
  text-transform: uppercase;
}

.ox-vite-deploy-hero__status strong {
  display: block;
  margin-top: 10px;
  font-size: 28px;
  line-height: 1.08;
}

.ox-vite-deploy-platform-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.ox-vite-deploy-platform-card {
  padding: 18px;
  border-radius: 18px;
  border: 1px solid var(--ox-vite-border, var(--ox-border, rgba(15, 23, 42, 0.08)));
  background: var(--ox-vite-surface, var(--ox-bg-surface, #ffffff));
}

.ox-vite-deploy-platform-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.ox-vite-deploy-platform-card__head h3 {
  margin: 0;
  font-size: 18px;
}

.ox-vite-deploy-platform-card__head p {
  margin: 6px 0 0;
  color: var(--ox-vite-text-secondary, var(--ox-text-secondary, #64748b));
  line-height: 1.5;
}

.ox-vite-deploy-platform-card__meta {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--ox-vite-text-secondary, var(--ox-text-secondary, #64748b));
  font-size: 13px;
}

.ox-vite-deploy-preview {
  min-height: 132px;
  padding: 16px 18px;
  border-radius: 16px;
  background: var(--ox-vite-shell-bg, var(--ox-bg-base, #f8fafc));
  color: var(--ox-vite-text-secondary, var(--ox-text-secondary, #64748b));
  line-height: 1.7;
  white-space: pre-wrap;
}

.ox-vite-panel-card__head {
  margin-bottom: 14px;
}

.ox-vite-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ox-vite-list-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border-radius: 14px;
  background: var(--ox-vite-shell-bg, var(--ox-bg-base, #f8fafc));
}

.ox-vite-list-row strong {
  display: block;
}

.ox-vite-list-row span {
  color: var(--ox-vite-text-secondary, var(--ox-text-secondary, #64748b));
  white-space: nowrap;
}

.ox-vite-inline-note {
  margin-top: 12px;
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--ox-vite-shell-bg, var(--ox-bg-base, #f8fafc));
  color: var(--ox-vite-text-secondary, var(--ox-text-secondary, #64748b));
  line-height: 1.6;
}

.ox-vite-bullet-list {
  margin: 10px 0 0;
  padding-left: 18px;
  display: grid;
  gap: 8px;
}

.ox-vite-settings-stack {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.ox-vite-settings-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ox-vite-settings-section__label {
  font-size: 12px;
  font-weight: 700;
  color: var(--ox-vite-text-secondary, var(--ox-text-secondary, #64748b));
}

.ox-vite-settings-row {
  min-height: 62px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(180px, 280px);
  align-items: center;
  gap: 16px;
  padding: 12px 0;
  border-top: 1px solid var(--ox-vite-border, var(--ox-border, rgba(15, 23, 42, 0.08)));
}

.ox-vite-settings-row:first-of-type {
  border-top: 0;
}

.ox-vite-settings-row--wide {
  grid-template-columns: minmax(0, 1fr);
  align-items: stretch;
}

.ox-vite-settings-row strong {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--ox-vite-text-primary, var(--ox-text-primary, #1e293b));
  font-size: 14px;
}

.ox-vite-settings-row p {
  margin: 4px 0 0;
  color: var(--ox-vite-text-secondary, var(--ox-text-secondary, #64748b));
  font-size: 12px;
  line-height: 1.55;
}

.ox-vite-select,
.ox-vite-text-input {
  width: 100%;
  min-height: 36px;
  border-radius: 8px;
  border: 1px solid var(--ox-vite-border, var(--ox-border, rgba(15, 23, 42, 0.08)));
  background: var(--ox-vite-input-bg, var(--ox-bg-input, #f4f5f9));
  color: var(--ox-vite-text-primary, var(--ox-text-primary, #1e293b));
  font: inherit;
  font-size: 13px;
}

.ox-vite-select {
  padding: 0 34px 0 12px;
}

.ox-vite-text-input {
  padding: 0 12px;
}

.ox-vite-segmented {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ox-vite-segmented button {
  min-height: 34px;
  border-radius: 8px;
  border: 1px solid var(--ox-vite-border, var(--ox-border, rgba(15, 23, 42, 0.08)));
  background: var(--ox-vite-surface, var(--ox-bg-surface, #ffffff));
  color: var(--ox-vite-text-secondary, var(--ox-text-secondary, #64748b));
  padding: 0 12px;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
}

.ox-vite-segmented button.active {
  border-color: color-mix(in srgb, var(--ox-accent, #5ba3c5) 50%, transparent);
  background: var(--ox-vite-accent-soft, var(--ox-accent-soft, rgba(91, 163, 197, 0.1)));
  color: var(--ox-vite-text-primary, var(--ox-text-primary, #1e293b));
  font-weight: 700;
}

.ox-vite-switch {
  justify-self: end;
  width: 46px;
  height: 26px;
  position: relative;
  display: inline-flex;
  cursor: pointer;
}

.ox-vite-switch input {
  position: absolute;
  inset: 0;
  opacity: 0;
}

.ox-vite-switch span {
  width: 100%;
  height: 100%;
  border-radius: 999px;
  background: var(--ox-vite-border, var(--ox-border, rgba(15, 23, 42, 0.14)));
  transition: background 160ms ease;
}

.ox-vite-switch span::after {
  content: '';
  width: 20px;
  height: 20px;
  border-radius: 999px;
  position: absolute;
  top: 3px;
  left: 3px;
  background: #ffffff;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.18);
  transition: transform 160ms ease;
}

.ox-vite-switch input:checked + span {
  background: var(--ox-accent, #5ba3c5);
}

.ox-vite-switch input:checked + span::after {
  transform: translateX(20px);
}

.ox-vite-theme-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}

.ox-vite-theme-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: stretch;
  text-align: left;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--ox-vite-border, var(--ox-border, rgba(15, 23, 42, 0.08)));
  background: var(--ox-vite-surface, var(--ox-bg-surface, #ffffff));
  color: var(--ox-vite-text-primary, var(--ox-text-primary, #1e293b));
  cursor: pointer;
  font: inherit;
}

.ox-vite-theme-card.active {
  border-color: color-mix(in srgb, var(--ox-accent, #5ba3c5) 55%, transparent);
  box-shadow: 0 10px 24px color-mix(in srgb, var(--ox-accent, #5ba3c5) 18%, transparent);
}

.ox-vite-theme-card__preview {
  --ox-vite-theme-preview-bg: #f8fafc;
  --ox-vite-theme-preview-surface: #ffffff;
  --ox-vite-theme-preview-sidebar: rgba(15, 23, 42, 0.12);
  --ox-vite-theme-preview-line: rgba(91, 163, 197, 0.2);
  --ox-vite-theme-preview-line-strong: rgba(91, 163, 197, 0.34);
  --ox-vite-theme-preview-border: rgba(15, 23, 42, 0.06);
  height: 62px;
  border-radius: 8px;
  display: grid;
  grid-template-columns: 32px 1fr;
  gap: 8px;
  padding: 8px;
  background: var(--ox-vite-theme-preview-bg);
  border: 1px solid var(--ox-vite-theme-preview-border);
}

.ox-vite-theme-card__preview i {
  display: block;
  border-radius: 6px;
  background: var(--ox-vite-theme-preview-line);
}

.ox-vite-theme-card__preview i:first-child {
  grid-row: span 3;
  background: var(--ox-vite-theme-preview-sidebar);
}

.ox-vite-theme-card__preview i:nth-child(2) {
  background: var(--ox-vite-theme-preview-line-strong);
}

.ox-vite-theme-card__preview.theme-party {
  --ox-vite-theme-preview-bg: linear-gradient(135deg, #ffffff 0%, #f8f9fb 100%);
  --ox-vite-theme-preview-sidebar: linear-gradient(180deg, #dff1f8, #b8ddea);
  --ox-vite-theme-preview-line: #d7ebf3;
  --ox-vite-theme-preview-line-strong: #5ba3c5;
  --ox-vite-theme-preview-border: rgba(91, 163, 197, 0.24);
}

.ox-vite-theme-card__preview.theme-light {
  --ox-vite-theme-preview-bg: linear-gradient(135deg, #ffffff 0%, #f5fbfd 100%);
  --ox-vite-theme-preview-sidebar: #e8f3f8;
  --ox-vite-theme-preview-line: #cfe5ef;
  --ox-vite-theme-preview-line-strong: #21859c;
  --ox-vite-theme-preview-border: rgba(33, 133, 156, 0.22);
}

.ox-vite-theme-card__preview.theme-dark {
  --ox-vite-theme-preview-bg: #1c1c1b;
  --ox-vite-theme-preview-sidebar: #383835;
  --ox-vite-theme-preview-line: #4a4337;
  --ox-vite-theme-preview-line-strong: #d97706;
  --ox-vite-theme-preview-border: rgba(217, 119, 6, 0.32);
}

.ox-vite-theme-card__preview.theme-midnight {
  --ox-vite-theme-preview-bg: #0f172a;
  --ox-vite-theme-preview-sidebar: #1e293b;
  --ox-vite-theme-preview-line: #334155;
  --ox-vite-theme-preview-line-strong: #ee7e00;
  --ox-vite-theme-preview-border: rgba(238, 126, 0, 0.34);
}

.ox-vite-theme-card__preview.theme-desert {
  --ox-vite-theme-preview-bg: #f9f2e7;
  --ox-vite-theme-preview-sidebar: #f0e0b5;
  --ox-vite-theme-preview-line: #d7b98e;
  --ox-vite-theme-preview-line-strong: #d98236;
  --ox-vite-theme-preview-border: rgba(217, 130, 54, 0.3);
}

.ox-vite-theme-card__preview.theme-neon {
  --ox-vite-theme-preview-bg: #1a0933;
  --ox-vite-theme-preview-sidebar: #2b0f54;
  --ox-vite-theme-preview-line: rgba(0, 245, 255, 0.34);
  --ox-vite-theme-preview-line-strong: #ff2d95;
  --ox-vite-theme-preview-border: rgba(255, 45, 149, 0.44);
}

.ox-vite-theme-card__preview.theme-marshmallow {
  --ox-vite-theme-preview-bg: #e6f7ff;
  --ox-vite-theme-preview-sidebar: #fde8f0;
  --ox-vite-theme-preview-line: #bdebf7;
  --ox-vite-theme-preview-line-strong: #f5a5c3;
  --ox-vite-theme-preview-border: rgba(245, 165, 195, 0.36);
}

.ox-vite-theme-card__preview.theme-ink {
  --ox-vite-theme-preview-bg: linear-gradient(135deg, #f5f7fa 0%, #eef2f6 100%);
  --ox-vite-theme-preview-sidebar: #2c3e50;
  --ox-vite-theme-preview-line: #c5cdd3;
  --ox-vite-theme-preview-line-strong: #5d6d7e;
  --ox-vite-theme-preview-border: rgba(44, 62, 80, 0.24);
}

.ox-vite-theme-card__preview.theme-rainbow {
  --ox-vite-theme-preview-bg: linear-gradient(135deg, #f8f9fe 0%, #fff5fb 54%, #fff8ed 100%);
  --ox-vite-theme-preview-sidebar: linear-gradient(180deg, #845ec2, #ff9671);
  --ox-vite-theme-preview-line: rgba(214, 93, 177, 0.26);
  --ox-vite-theme-preview-line-strong: linear-gradient(90deg, #845ec2, #d65db1, #ff9671);
  --ox-vite-theme-preview-border: rgba(132, 94, 194, 0.28);
}

.ox-vite-theme-card small {
  color: var(--ox-vite-text-secondary, var(--ox-text-secondary, #64748b));
}

.ox-vite-shortcut-state {
  justify-self: end;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.ox-vite-shortcut-state kbd {
  min-height: 28px;
  display: inline-flex;
  align-items: center;
  border-radius: 8px;
  border: 1px solid var(--ox-vite-border, var(--ox-border, rgba(15, 23, 42, 0.08)));
  background: var(--ox-vite-input-bg, var(--ox-bg-input, #f4f5f9));
  padding: 0 10px;
  font-size: 12px;
}

.ox-vite-status-pill {
  min-height: 28px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  padding: 0 10px;
  background: rgba(245, 158, 11, 0.12);
  color: #b45309;
  font-size: 12px;
  font-weight: 700;
}

.ox-vite-status-pill.active {
  background: rgba(16, 185, 129, 0.12);
  color: #047857;
}

.ox-vite-danger-btn {
  min-height: 36px;
  border-radius: 8px;
  border: 1px solid rgba(239, 68, 68, 0.26);
  background: rgba(239, 68, 68, 0.08);
  color: #dc2626;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 14px;
  cursor: pointer;
  font: inherit;
}

.ox-vite-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.ox-vite-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ox-vite-field--wide {
  grid-column: 1 / -1;
}

.ox-vite-field span {
  font-size: 13px;
  font-weight: 600;
}

.ox-vite-field input {
  min-height: 42px;
  padding: 0 14px;
  border-radius: 14px;
  border: 1px solid var(--ox-vite-border, var(--ox-border, rgba(15, 23, 42, 0.08)));
  background: var(--ox-vite-input-bg, var(--ox-bg-input, #f4f5f9));
  color: var(--ox-vite-text-primary, var(--ox-text-primary, #1e293b));
}

.ox-vite-media-card {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ox-vite-media-card__thumb {
  aspect-ratio: 16 / 9;
  border-radius: 14px;
  background: var(--ox-vite-shell-bg, var(--ox-bg-base, #f8fafc));
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ox-accent, #5ba3c5);
  font-size: 24px;
}

.ox-vite-media-card strong,
.ox-vite-about-name,
.ox-vite-task-detail__title {
  font-size: 18px;
}

.ox-vite-role-mini-card__head {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ox-vite-role-mini-card p {
  margin: 0;
  color: var(--ox-vite-text-secondary, var(--ox-text-secondary, #64748b));
  line-height: 1.6;
}

.ox-vite-media-card small,
.ox-vite-task-card__meta,
.ox-vite-task-detail__trace-item {
  color: var(--ox-vite-text-secondary, var(--ox-text-secondary, #64748b));
}

.ox-vite-task-shell {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 16px;
  min-height: 0;
  flex: 1 1 auto;
  padding: 0 24px 24px;
}

.ox-vite-task-board {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  min-height: 0;
}

.ox-vite-task-column {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.ox-vite-task-column__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.ox-vite-task-column__head span {
  min-width: 24px;
  height: 24px;
  border-radius: 999px;
  background: var(--ox-vite-shell-bg, var(--ox-bg-base, #f8fafc));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--ox-vite-text-secondary, var(--ox-text-secondary, #64748b));
  font-size: 12px;
  font-weight: 700;
}

.ox-vite-task-card,
.ox-vite-ops-primary-btn,
.ox-vite-link-card {
  border: 0;
}

.ox-vite-task-card {
  padding: 14px;
  border-radius: 16px;
  background: var(--ox-vite-surface, var(--ox-bg-surface, #ffffff));
  border: 1px solid var(--ox-vite-border, var(--ox-border, rgba(15, 23, 42, 0.08)));
  text-align: left;
  cursor: pointer;
}

.ox-vite-task-card__title {
  font-weight: 700;
}

.ox-vite-task-progress {
  margin-top: 12px;
  height: 6px;
  border-radius: 999px;
  background: var(--ox-vite-shell-bg, var(--ox-bg-base, #f8fafc));
  overflow: hidden;
}

.ox-vite-task-progress__fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(135deg, #5ba3c5, #6fafd0);
}

.ox-vite-task-card__meta {
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
}

.ox-vite-task-empty,
.ox-vite-empty-state {
  min-height: 180px;
  border-radius: 16px;
  border: 1px dashed var(--ox-vite-border, var(--ox-border, rgba(15, 23, 42, 0.08)));
  background: var(--ox-vite-shell-bg, var(--ox-bg-base, #f8fafc));
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px;
  text-align: center;
}

.ox-vite-task-detail__head {
  margin-bottom: 12px;
}

.ox-vite-task-detail__trace {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ox-vite-task-detail__trace-item {
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--ox-vite-shell-bg, var(--ox-bg-base, #f8fafc));
}

.ox-vite-about-shell {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  padding: 30px 24px 36px;
}

.ox-vite-about-mark {
  width: 96px;
  height: 96px;
  border-radius: 999px;
  font-size: 34px;
  font-weight: 700;
  box-shadow: 0 14px 36px rgba(91, 163, 197, 0.22);
}

.ox-vite-about-name {
  font-size: 34px;
  font-weight: 700;
}

.ox-vite-about-copy {
  max-width: 720px;
  text-align: center;
}

.ox-vite-link-card {
  padding: 16px;
  text-decoration: none;
  color: inherit;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ox-vite-link-card span,
.ox-vite-fact-row span {
  color: var(--ox-vite-text-secondary, var(--ox-text-secondary, #64748b));
  font-size: 12px;
}

.ox-vite-fact-list {
  width: min(100%, 920px);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ox-vite-fact-row {
  padding: 16px 18px;
}

.ox-vite-ops-secondary-btn {
  padding: 0 14px;
}

.ox-vite-ops-primary-btn {
  padding: 0 14px;
  background: linear-gradient(135deg, #5ba3c5, #6fafd0);
  color: #ffffff;
}

.ox-vite-feature-packs {
  display: grid;
  gap: 0;
}

.ox-vite-feature-packs__toolbar {
  min-height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--ox-vite-border, var(--ox-border, rgba(15, 23, 42, 0.08)));
}

.ox-vite-feature-packs__feed {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.ox-vite-feature-packs__feed small {
  color: var(--ox-vite-text-secondary, var(--ox-text-secondary, #64748b));
  overflow-wrap: anywhere;
}

.ox-vite-feature-pack-feed-state,
.ox-vite-feature-pack-status,
.ox-vite-feature-pack-restart {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 28px;
  font-size: 12px;
  font-weight: 700;
}

.ox-vite-feature-pack-feed-state {
  color: #17775d;
}

.ox-vite-feature-pack-feed-state:not(.is-ready) {
  color: #8a6220;
}

.ox-vite-icon-btn {
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--ox-vite-border, var(--ox-border, rgba(15, 23, 42, 0.08)));
  border-radius: 8px;
  background: var(--ox-vite-surface, var(--ox-bg-surface, #ffffff));
  color: var(--ox-vite-text-secondary, var(--ox-text-secondary, #64748b));
  cursor: pointer;
}

.ox-vite-icon-btn.is-danger {
  color: #b74646;
}

.ox-vite-icon-btn:disabled,
.ox-vite-feature-pack-row__actions button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.ox-vite-feature-pack-notice {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 14px 0 4px;
  padding: 10px 12px;
  border: 1px solid rgba(184, 132, 40, 0.28);
  border-radius: 8px;
  background: rgba(184, 132, 40, 0.08);
  color: var(--ox-vite-text-secondary, var(--ox-text-secondary, #64748b));
  font-size: 12px;
  line-height: 1.55;
}

.ox-vite-feature-pack-notice.is-error {
  border-color: rgba(183, 70, 70, 0.28);
  background: rgba(183, 70, 70, 0.07);
  color: #a23f3f;
}

.ox-vite-feature-pack-list {
  display: grid;
}

.ox-vite-feature-pack-row {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(260px, 1.4fr) minmax(170px, 0.7fr) minmax(142px, 0.55fr) auto;
  align-items: center;
  gap: 16px;
  padding: 16px 0;
  border-top: 1px solid var(--ox-vite-border, var(--ox-border, rgba(15, 23, 42, 0.08)));
}

.ox-vite-feature-pack-row:first-child {
  border-top: 0;
}

.ox-vite-feature-pack-row__identity {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.ox-vite-feature-pack-row__icon {
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--ox-vite-accent-soft, rgba(91, 163, 197, 0.08));
  color: var(--ox-accent, #4d93b5);
}

.ox-vite-feature-pack-row__identity strong {
  display: block;
  color: var(--ox-vite-text-primary, var(--ox-text-primary, #1e293b));
  font-size: 14px;
}

.ox-vite-feature-pack-row__identity p,
.ox-vite-feature-pack-progress p {
  margin: 4px 0 0;
  color: var(--ox-vite-text-secondary, var(--ox-text-secondary, #64748b));
  font-size: 12px;
  line-height: 1.5;
}

.ox-vite-feature-pack-row__versions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.ox-vite-feature-pack-row__versions span {
  min-width: 0;
  display: grid;
  gap: 3px;
}

.ox-vite-feature-pack-row__versions small {
  color: var(--ox-vite-text-secondary, var(--ox-text-secondary, #64748b));
  font-size: 10px;
}

.ox-vite-feature-pack-row__versions strong {
  overflow: hidden;
  color: var(--ox-vite-text-primary, var(--ox-text-primary, #1e293b));
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ox-vite-feature-pack-row__state {
  display: grid;
  justify-items: start;
  gap: 4px;
}

.ox-vite-feature-pack-status.is-installed {
  color: #17775d;
}

.ox-vite-feature-pack-status.is-update-available {
  color: #356f9d;
}

.ox-vite-feature-pack-status.is-damaged {
  color: #b74646;
}

.ox-vite-feature-pack-status.is-not-installed {
  color: var(--ox-vite-text-secondary, var(--ox-text-secondary, #64748b));
}

.ox-vite-feature-pack-restart {
  min-height: 20px;
  color: #8a6220;
  font-size: 10px;
}

.ox-vite-feature-pack-row__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.ox-vite-feature-pack-row__actions .ox-vite-ops-primary-btn,
.ox-vite-feature-pack-row__actions .ox-vite-ops-secondary-btn {
  min-width: 92px;
  border-radius: 8px;
  cursor: pointer;
}

.ox-vite-feature-pack-progress {
  grid-column: 1 / -1;
  display: grid;
  gap: 6px;
  margin-top: -4px;
}

.ox-vite-feature-pack-progress__meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--ox-vite-text-secondary, var(--ox-text-secondary, #64748b));
  font-size: 11px;
}

.ox-vite-feature-pack-progress__track {
  height: 4px;
  overflow: hidden;
  border-radius: 4px;
  background: color-mix(in srgb, var(--ox-vite-text-secondary, #64748b) 14%, transparent);
}

.ox-vite-feature-pack-progress__track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #4d93b5;
  transition: width 160ms ease;
}

.ox-vite-feature-pack-progress.is-failed .ox-vite-feature-pack-progress__track span {
  background: #b74646;
}

.ox-vite-feature-pack-progress__track span.is-indeterminate {
  animation: ox-vite-feature-pack-progress 1.1s ease-in-out infinite;
}

@keyframes ox-vite-feature-pack-progress {
  from { transform: translateX(-110%); }
  to { transform: translateX(390%); }
}

@media (max-width: 1120px) {
  .ox-vite-feature-pack-row {
    grid-template-columns: minmax(240px, 1fr) minmax(170px, 0.65fr) auto;
  }

  .ox-vite-feature-pack-row__state {
    grid-column: 2;
  }

  .ox-vite-feature-pack-row__actions {
    grid-column: 3;
    grid-row: 1 / span 2;
  }
}

@media (max-width: 1280px) {
  .ox-vite-system-layout,
  .ox-vite-task-shell {
    grid-template-columns: 1fr;
  }

  .ox-vite-task-board {
    grid-template-columns: 1fr;
  }

  .ox-vite-deploy-hero {
    grid-template-columns: 1fr;
  }

  .ox-vite-workbench-summary,
  .ox-vite-card-grid--workbench {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .ox-vite-ops-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .ox-vite-form-grid {
    grid-template-columns: 1fr;
  }

  .ox-vite-settings-row {
    grid-template-columns: 1fr;
  }

  .ox-vite-switch,
  .ox-vite-shortcut-state {
    justify-self: start;
  }

  .ox-vite-feature-pack-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }

  .ox-vite-feature-pack-row__state,
  .ox-vite-feature-pack-row__actions {
    grid-column: 1;
    grid-row: auto;
  }

  .ox-vite-feature-pack-row__actions {
    justify-content: flex-start;
  }
}

/* ─────────── VRM surface ─────────── */
.ox-vite-ops-shell.surface-vrm {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding: 0;
  gap: 0;
  overflow: hidden;       /* shell 不滚动 */
  background: var(--ox-vite-shell-bg, #F8F9FB);
}

.ox-vite-vrm-topbar {
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 0 0 14px;
  background: transparent;
  border-bottom: 0;
}

.ox-vite-vrm-topbar__title {
  flex: 1 1 auto;
  min-width: 0;
}

.ox-vite-vrm-topbar__title h1 {
  margin: 4px 0 0;
  font-size: 20px;
  font-weight: 700;
  color: var(--ox-vite-text-primary, #1E293B);
}

.ox-vite-vrm-topbar__title p {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--ox-vite-text-secondary, #64748B);
  max-width: 540px;
}

.ox-vite-vrm-guide {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 920px;
}

.ox-vite-vrm-guide__note {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: fit-content;
  max-width: 100%;
  min-height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  background: var(--ox-vite-accent-soft, rgba(91, 163, 197, 0.10));
  color: var(--ox-vite-text-secondary, #64748B);
  font-size: 12px;
  line-height: 1.5;
}

.ox-vite-vrm-guide__note i {
  color: var(--ox-accent, #5BA3C5);
  font-size: 12px;
  flex-shrink: 0;
}

.ox-vite-vrm-guide__steps {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.ox-vite-vrm-guide__step {
  min-width: 0;
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  padding: 9px 10px;
  border: 1px solid var(--ox-vite-border, rgba(15, 23, 42, 0.08));
  border-radius: 12px;
  background: var(--ox-vite-surface-subtle, #F8F9FB);
}

.ox-vite-vrm-guide__step-index {
  width: 20px;
  height: 20px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--ox-vite-surface, #FFFFFF);
  color: var(--ox-accent, #5BA3C5);
  font-size: 11px;
  font-weight: 700;
}

.ox-vite-vrm-guide__step > i {
  color: var(--ox-accent, #5BA3C5);
  font-size: 13px;
}

.ox-vite-vrm-guide__step-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ox-vite-vrm-guide__step-copy strong {
  color: var(--ox-vite-text-primary, #1E293B);
  font-size: 12px;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ox-vite-vrm-guide__step-copy small {
  color: var(--ox-vite-text-secondary, #64748B);
  font-size: 11px;
  line-height: 1.35;
}

.ox-vite-vrm-topbar__actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  flex-shrink: 0;
}

/* Body split: left scrolls, right fixed */
.ox-vite-vrm-layout {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 400px;
  gap: 0;
  overflow: hidden;
}

.ox-vite-vrm-config {
  min-height: 0;
  min-width: 0;
  overflow-y: auto;
  padding: 18px 24px 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.ox-vite-vrm-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ox-vite-vrm-statgrid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px;
}

/* Right preview column — fixed full height, no scroll */
.ox-vite-vrm-preview {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px;
  background: var(--ox-vite-surface, #FFFFFF);
  border-left: 1px solid var(--ox-vite-border, rgba(15, 23, 42, 0.08));
  overflow: hidden;
}

.ox-vite-vrm-preview__head {
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.ox-vite-vrm-preview__head h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--ox-vite-text-primary, #1E293B);
}

.ox-vite-vrm-preview__head p {
  margin: 4px 0 0;
  color: var(--ox-vite-text-secondary, #64748B);
  font-size: 12px;
  word-break: break-all;
}

.ox-vite-vrm-preview__toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border: 1px solid var(--ox-vite-border, rgba(15, 23, 42, 0.08));
  border-radius: 999px;
  font-size: 12px;
  cursor: pointer;
  background: var(--ox-vite-surface-subtle, #F1F3F9);
  color: var(--ox-vite-text-secondary, #64748B);
  user-select: none;
  flex-shrink: 0;
}

.ox-vite-vrm-preview__toggle input {
  margin: 0;
  accent-color: var(--ox-accent, #5BA3C5);
}

.ox-vite-vrm-preview__stage {
  flex: 1;
  min-height: 0;
  position: relative;
  border-radius: 14px;
  overflow: hidden;
  /* 棋盘格透明背景，浅/深主题下都能看清 VRM 的轮廓 */
  background-color: var(--ox-vite-surface-subtle, #F1F3F9);
  background-image:
    linear-gradient(45deg, rgba(15, 23, 42, 0.06) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(15, 23, 42, 0.06) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(15, 23, 42, 0.06) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(15, 23, 42, 0.06) 75%);
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0;
  border: 1px solid var(--ox-vite-border, rgba(15, 23, 42, 0.08));
}

.ox-vite-vrm-preview__frame {
  position: absolute;
  inset: 0;
  background: transparent;
}

.ox-vite-vrm-preview__webview,
.ox-vite-vrm-preview__iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  display: flex;
  background: transparent;
}

.ox-vite-vrm-preview__placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 10px;
  padding: 24px;
}

.ox-vite-vrm-preview__hero {
  width: 80px;
  height: 80px;
  border-radius: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  background: var(--ox-accent-gradient, linear-gradient(135deg, #5BA3C5, #7BB8D4));
  color: #FFFFFF;
  box-shadow: 0 8px 22px rgba(91, 163, 197, 0.30);
}

.ox-vite-vrm-preview__placeholder h3 {
  margin: 4px 0 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--ox-vite-text-primary, #1E293B);
}

.ox-vite-vrm-preview__placeholder p {
  margin: 0;
  color: var(--ox-vite-text-secondary, #64748B);
  font-size: 12px;
  line-height: 1.6;
  max-width: 280px;
}

.ox-vite-vrm-section-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--ox-vite-text-muted, #94A3B8);
  margin-bottom: 6px;
}

.ox-vite-vrm-preview__motions {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 120px;
  overflow-y: auto;
}

.ox-vite-vrm-preview__motion-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ox-vite-vrm-preview__actions {
  flex-shrink: 0;
  display: flex;
  gap: 8px;
}

.ox-vite-vrm-preview__actions--top {
  order: 1;
}

.ox-vite-vrm-preview__stage {
  order: 2;
}

.ox-vite-vrm-preview__motions {
  order: 3;
}

.ox-vite-vrm-preview__actions:not(.ox-vite-vrm-preview__actions--top) {
  order: 4;
}

.ox-vite-vrm-preview__actions > button {
  flex: 1 1 auto;
  justify-content: center;
}

/* Tabs (built-in / custom) */
.ox-vite-vrm-tabs {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px;
  background: var(--ox-vite-surface-subtle, #F1F3F9);
  border-radius: 10px;
  margin-bottom: 10px;
  align-self: flex-start;
}

.ox-vite-vrm-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--ox-vite-text-secondary, #64748B);
  font-size: 12px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.ox-vite-vrm-tab:hover {
  color: var(--ox-vite-text-primary, #1E293B);
}

.ox-vite-vrm-tab.is-active {
  background: var(--ox-vite-surface, #FFFFFF);
  color: var(--ox-accent, #5BA3C5);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
}

.ox-vite-vrm-tab__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  padding: 0 6px;
  height: 18px;
  border-radius: 999px;
  background: var(--ox-vite-border, rgba(15, 23, 42, 0.08));
  color: var(--ox-vite-text-muted, #94A3B8);
  font-size: 11px;
  font-weight: 600;
}

.ox-vite-vrm-tab.is-active .ox-vite-vrm-tab__count {
  background: var(--ox-accent-soft, rgba(91, 163, 197, 0.12));
  color: var(--ox-accent, #5BA3C5);
}

/* Search bar inside picker */
.ox-vite-vrm-search {
  position: relative;
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.ox-vite-vrm-search > i {
  position: absolute;
  left: 12px;
  color: var(--ox-vite-text-muted, #94A3B8);
  font-size: 12px;
  pointer-events: none;
}

.ox-vite-vrm-search input {
  width: 100%;
  height: 32px;
  padding: 0 32px 0 32px;
  border: 1px solid var(--ox-vite-border, rgba(15, 23, 42, 0.08));
  border-radius: 999px;
  background: var(--ox-vite-input-bg, #F4F5F9);
  color: var(--ox-vite-text-primary, #1E293B);
  font: inherit;
  font-size: 13px;
  outline: none;
}

.ox-vite-vrm-search input:focus {
  border-color: var(--ox-accent, #5BA3C5);
  background: var(--ox-vite-surface, #FFFFFF);
  box-shadow: 0 0 0 3px rgba(91, 163, 197, 0.15);
}

.ox-vite-vrm-search__clear {
  position: absolute;
  right: 8px;
  width: 20px;
  height: 20px;
  border: 0;
  border-radius: 50%;
  background: var(--ox-vite-surface-subtle, #F1F3F9);
  color: var(--ox-vite-text-secondary, #64748B);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
}

/* Scrollable list of rows */
.ox-vite-vrm-list {
  max-height: 360px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px;
  border: 1px solid var(--ox-vite-border, rgba(15, 23, 42, 0.08));
  border-radius: 12px;
  background: var(--ox-vite-surface-subtle, #F8F9FB);
}

.ox-vite-vrm-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--ox-vite-text-primary, #1E293B);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
  position: relative;
}

.ox-vite-vrm-row:hover {
  background: var(--ox-vite-surface, #FFFFFF);
}

.ox-vite-vrm-row.is-active {
  background: var(--ox-accent-soft, rgba(91, 163, 197, 0.12));
}

.ox-vite-vrm-row:disabled {
  cursor: progress;
  opacity: 0.82;
}

.ox-vite-vrm-row.is-cloud:not(.is-active) {
  background: color-mix(in srgb, var(--ox-vite-surface, #FFFFFF) 72%, var(--ox-vite-surface-subtle, #F8F9FB));
}

.ox-vite-vrm-row__icon {
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--ox-vite-surface, #FFFFFF);
  color: var(--ox-vite-text-secondary, #64748B);
  font-size: 13px;
}

.ox-vite-vrm-row.is-active .ox-vite-vrm-row__icon {
  background: var(--ox-accent-gradient, linear-gradient(135deg, #5BA3C5, #7BB8D4));
  color: #FFFFFF;
}

.ox-vite-vrm-row__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ox-vite-vrm-row__name {
  font-size: 13px;
  font-weight: 600;
  color: var(--ox-vite-text-primary, #1E293B);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ox-vite-vrm-row.is-active .ox-vite-vrm-row__name {
  color: var(--ox-accent, #5BA3C5);
}

.ox-vite-vrm-row__sub {
  font-size: 11px;
  color: var(--ox-vite-text-muted, #94A3B8);
}

.ox-vite-vrm-row__check {
  color: var(--ox-accent, #5BA3C5);
  font-size: 14px;
  flex-shrink: 0;
}

.ox-vite-vrm-row__download {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-width: 70px;
  height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  background: var(--ox-accent-soft, rgba(91, 163, 197, 0.12));
  color: var(--ox-accent, #5BA3C5);
  font-size: 11px;
  font-weight: 650;
  white-space: nowrap;
}

.ox-vite-vrm-row__download.is-ready {
  background: var(--ox-success-soft, rgba(16, 185, 129, 0.12));
  color: var(--ox-success, #10B981);
}

.ox-vite-vrm-row__del {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: var(--ox-vite-text-muted, #94A3B8);
  opacity: 0;
  transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.ox-vite-vrm-row:hover .ox-vite-vrm-row__del {
  opacity: 1;
}

.ox-vite-vrm-row__del:hover {
  background: var(--ox-error-soft, rgba(239, 68, 68, 0.10));
  color: var(--ox-error, #EF4444);
}

.ox-vite-vrm-empty {
  padding: 32px 20px;
  text-align: center;
  font-size: 12px;
  color: var(--ox-vite-text-muted, #94A3B8);
}

.ox-vite-vrm-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--ox-vite-text-secondary, #64748B);
}

.ox-vite-vrm-toggle input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: var(--ox-accent, #5BA3C5);
}

.ox-vite-role-studio {
  display: grid;
  gap: 18px;
}

.ox-vite-role-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 18px;
  padding: 22px 24px;
  border-radius: 24px;
  border: 1px solid var(--ox-vite-border, rgba(15, 23, 42, 0.08));
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--ox-accent, #5BA3C5) 16%, transparent), transparent 36%),
    linear-gradient(180deg, color-mix(in srgb, var(--ox-vite-surface, #FFFFFF) 98%, transparent), color-mix(in srgb, var(--ox-vite-shell-bg, #F8FAFC) 96%, transparent));
}

.ox-vite-role-hero__copy {
  display: grid;
  gap: 8px;
}

.ox-vite-role-hero__copy h2 {
  margin: 0;
  font-size: 28px;
  line-height: 1.12;
  color: var(--ox-vite-text-primary, #1E293B);
}

.ox-vite-role-hero__copy p {
  margin: 0;
  max-width: 720px;
  color: var(--ox-vite-text-secondary, #64748B);
  line-height: 1.75;
}

.ox-vite-role-hero__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(116px, 1fr));
  gap: 10px;
  align-self: start;
}

.ox-vite-role-hero__stat {
  display: grid;
  gap: 4px;
  padding: 14px 16px;
  border-radius: 18px;
  background: color-mix(in srgb, var(--ox-vite-surface, #FFFFFF) 78%, transparent);
  border: 1px solid var(--ox-vite-border, rgba(148, 163, 184, 0.14));
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.06);
}

.ox-vite-role-hero__stat span {
  font-size: 24px;
  font-weight: 800;
  color: var(--ox-vite-text-primary, #1E293B);
}

.ox-vite-role-hero__stat small {
  font-size: 12px;
  color: var(--ox-vite-text-secondary, #64748B);
}

.ox-vite-role-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
}

.ox-vite-role-search {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1 1 360px;
  max-width: 520px;
}

.ox-vite-role-search > i {
  position: absolute;
  left: 12px;
  font-size: 12px;
  color: var(--ox-vite-text-muted, #94A3B8);
  pointer-events: none;
}

.ox-vite-role-search input {
  width: 100%;
  height: 40px;
  padding: 0 36px 0 34px;
  border-radius: 999px;
  border: 1px solid var(--ox-vite-border, rgba(15, 23, 42, 0.08));
  background: var(--ox-vite-input-bg, #F4F5F9);
  color: var(--ox-vite-text-primary, #1E293B);
  font: inherit;
  outline: none;
}

.ox-vite-role-search input:focus {
  border-color: var(--ox-accent, #5BA3C5);
  background: var(--ox-vite-surface, #FFFFFF);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ox-accent, #5BA3C5) 18%, transparent);
}

.ox-vite-role-search__clear {
  position: absolute;
  right: 8px;
  width: 22px;
  height: 22px;
  border: 0;
  border-radius: 999px;
  background: var(--ox-vite-surface-subtle, #F1F3F9);
  color: var(--ox-vite-text-secondary, #64748B);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.ox-vite-role-category-strip {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.ox-vite-role-category-chip {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid var(--ox-vite-border, rgba(15, 23, 42, 0.08));
  background: var(--ox-vite-surface, #FFFFFF);
  color: var(--ox-vite-text-secondary, #64748B);
  cursor: pointer;
  font: inherit;
  transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.ox-vite-role-category-chip strong {
  font-size: 12px;
  color: var(--ox-vite-text-muted, #94A3B8);
}

.ox-vite-role-category-chip.is-active {
  border-color: color-mix(in srgb, var(--ox-accent, #5BA3C5) 24%, transparent);
  background: var(--ox-accent-soft, rgba(91, 163, 197, 0.1));
  color: var(--ox-accent, #5BA3C5);
}

.ox-vite-role-category-chip.is-active strong {
  color: var(--ox-accent, #5BA3C5);
}

.ox-vite-role-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.42fr) minmax(280px, 0.78fr);
  gap: 18px;
}

.ox-vite-role-template-grid,
.ox-vite-role-library-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(228px, 1fr));
  gap: 14px;
}

.ox-vite-role-template-card,
.ox-vite-role-library-card,
.ox-vite-role-spotlight__card {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--ox-vite-border, rgba(148, 163, 184, 0.12));
  background: linear-gradient(180deg, color-mix(in srgb, var(--ox-vite-surface, #FFFFFF) 98%, transparent), color-mix(in srgb, var(--ox-vite-shell-bg, #F8FAFC) 94%, transparent));
  color: var(--ox-vite-text-primary, #1E293B);
}

.ox-vite-role-template-card {
  display: grid;
  gap: 12px;
  padding: 18px;
  border-radius: 22px;
  text-align: left;
  cursor: pointer;
  box-shadow: 0 18px 34px rgba(15, 23, 42, 0.08);
  transition: transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease;
}

.ox-vite-role-template-card:hover,
.ox-vite-role-spotlight__card:hover,
.ox-vite-role-library-card:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--ox-accent, #5BA3C5) 24%, transparent);
  box-shadow: 0 24px 42px rgba(15, 23, 42, 0.1);
}

.ox-vite-role-template-card__glow {
  position: absolute;
  inset: -40% auto auto 52%;
  width: 180px;
  height: 180px;
  border-radius: 50%;
  background: radial-gradient(circle, color-mix(in srgb, var(--ox-vite-role-accent-start, #4ecdc4) 20%, transparent), transparent 70%);
  pointer-events: none;
}

.ox-vite-role-template-card__head,
.ox-vite-role-library-card__hero {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.ox-vite-role-template-card__icon,
.ox-vite-role-library-card__icon,
.ox-vite-role-spotlight__icon {
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--ox-vite-role-accent-start, #4ecdc4), var(--ox-vite-role-accent-end, #5b8cff));
  color: #fff;
  box-shadow: 0 12px 24px rgba(91, 163, 197, 0.18);
}

.ox-vite-role-template-card__category {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--ox-vite-surface, #FFFFFF) 86%, transparent);
  color: var(--ox-vite-text-secondary, #64748B);
  font-size: 11px;
  font-weight: 700;
}

.ox-vite-role-template-card__title,
.ox-vite-role-library-card__name,
.ox-vite-role-spotlight__name {
  position: relative;
  z-index: 1;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.22;
}

.ox-vite-role-template-card__department,
.ox-vite-role-library-card__meta,
.ox-vite-role-spotlight__meta {
  position: relative;
  z-index: 1;
  color: var(--ox-vite-text-secondary, #64748B);
  font-size: 12px;
  line-height: 1.5;
}

.ox-vite-role-library-card__meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.ox-vite-role-template-card__summary,
.ox-vite-role-library-card__summary,
.ox-vite-role-spotlight__body p {
  position: relative;
  z-index: 1;
  margin: 0;
  color: var(--ox-vite-text-secondary, #64748B);
  line-height: 1.65;
}

.ox-vite-role-template-card__foot {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: var(--ox-accent, #5BA3C5);
  font-size: 12px;
  font-weight: 700;
}

.ox-vite-role-spotlight {
  display: grid;
  gap: 14px;
}

.ox-vite-role-spotlight__list {
  display: grid;
  gap: 12px;
}

.ox-vite-role-spotlight__card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 12px;
  padding: 16px;
  border-radius: 20px;
  text-align: left;
  cursor: pointer;
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.06);
  transition: transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease;
}

.ox-vite-role-spotlight__body {
  display: grid;
  gap: 6px;
}

.ox-vite-role-spotlight__tip {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 14px 16px;
  border-radius: 18px;
  background: var(--ox-accent-softer, rgba(91, 163, 197, 0.08));
  color: var(--ox-vite-text-secondary, #64748B);
  line-height: 1.65;
}

.ox-vite-role-library-card {
  display: grid;
  gap: 12px;
  padding: 18px;
  border-radius: 22px;
  box-shadow: 0 18px 34px rgba(15, 23, 42, 0.08);
}

.ox-vite-role-library-card__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.ox-vite-role-library-card__toolbar .ox-vite-detail-chip.is-active {
  background: rgba(16, 185, 129, 0.12);
  color: #047857;
}

.ox-vite-role-library-card__identity {
  display: grid;
  gap: 4px;
}

.ox-vite-role-library-card__delete {
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 10px;
  background: rgba(239, 68, 68, 0.08);
  color: #ef4444;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 150ms ease, transform 150ms ease;
}

.ox-vite-role-library-card__delete:hover {
  background: rgba(239, 68, 68, 0.14);
  transform: translateY(-1px);
}

.ox-vite-role-library-card--add {
  border-style: dashed;
  justify-content: center;
  align-items: center;
  text-align: center;
  color: var(--ox-accent, #5BA3C5);
  cursor: pointer;
}

.ox-vite-role-library-card--add i {
  font-size: 20px;
}

.ox-vite-workspace-hub,
.ox-vite-sandbox-shell {
  display: grid;
  gap: 18px;
}

.ox-vite-workspace-hub__hero,
.ox-vite-sandbox-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 24px;
  border-radius: 24px;
  border: 1px solid var(--ox-vite-border, rgba(15, 23, 42, 0.08));
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--ox-accent, #5BA3C5) 14%, transparent), transparent 36%),
    linear-gradient(180deg, color-mix(in srgb, var(--ox-vite-surface, #FFFFFF) 98%, transparent), color-mix(in srgb, var(--ox-vite-shell-bg, #F8FAFC) 96%, transparent));
}

.ox-vite-workspace-hub__copy,
.ox-vite-sandbox-hero__copy {
  display: grid;
  gap: 8px;
}

.ox-vite-workspace-hub__copy h2,
.ox-vite-sandbox-hero h2 {
  margin: 0;
  font-size: 28px;
  line-height: 1.12;
  color: var(--ox-vite-text-primary, #1E293B);
}

.ox-vite-workspace-hub__copy p,
.ox-vite-sandbox-hero p {
  margin: 0;
  max-width: 760px;
  color: var(--ox-vite-text-secondary, #64748B);
  line-height: 1.7;
}

.ox-vite-workspace-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(276px, 1fr));
  gap: 14px;
}

.ox-vite-workspace-grid--compact {
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}

.ox-vite-workspace-card,
.ox-vite-project-card {
  display: grid;
  gap: 12px;
  padding: 18px;
  border-radius: 22px;
  border: 1px solid var(--ox-vite-border, rgba(148, 163, 184, 0.14));
  background: color-mix(in srgb, var(--ox-vite-surface, #FFFFFF) 98%, transparent);
  box-shadow: 0 18px 34px rgba(15, 23, 42, 0.08);
}

.ox-vite-workspace-card--compact {
  padding: 16px;
}

.ox-vite-workspace-card__head,
.ox-vite-project-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.ox-vite-workspace-card__identity,
.ox-vite-project-card__head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.ox-vite-workspace-card__icon,
.ox-vite-project-card__icon {
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--ox-accent-soft, rgba(91, 163, 197, 0.12));
  color: var(--ox-accent, #5BA3C5);
  box-shadow: 0 12px 24px rgba(91, 163, 197, 0.16);
}

.ox-vite-workspace-card__name,
.ox-vite-project-card__name {
  font-size: 18px;
  font-weight: 700;
  line-height: 1.2;
}

.ox-vite-workspace-card__meta,
.ox-vite-project-card__meta {
  margin-top: 4px;
  color: var(--ox-vite-text-secondary, #64748B);
  line-height: 1.6;
}

.ox-vite-workspace-card__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.ox-vite-workspace-card__stat {
  display: grid;
  gap: 4px;
  padding: 12px 14px;
  border-radius: 16px;
  background: color-mix(in srgb, var(--ox-vite-shell-bg, #F8FAFC) 92%, transparent);
  border: 1px solid var(--ox-vite-border, rgba(148, 163, 184, 0.12));
}

.ox-vite-workspace-card__stat span {
  font-size: 11px;
  color: var(--ox-vite-text-muted, #94A3B8);
}

.ox-vite-workspace-card__stat strong {
  font-size: 15px;
  color: var(--ox-vite-text-primary, #1E293B);
}

.ox-vite-workspace-card__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.ox-vite-workspace-card__actions .ox-vite-ops-primary-btn,
.ox-vite-workspace-card__actions .ox-vite-ops-secondary-btn {
  flex: 1 1 120px;
}

.ox-vite-kb-hub {
  display: grid;
  gap: 18px;
}

.ox-vite-kb-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 18px;
  padding: 22px 24px;
  border-radius: 24px;
  border: 1px solid var(--ox-vite-border, rgba(15, 23, 42, 0.08));
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--ox-accent, #5BA3C5) 14%, transparent), transparent 36%),
    linear-gradient(180deg, color-mix(in srgb, var(--ox-vite-surface, #FFFFFF) 98%, transparent), color-mix(in srgb, var(--ox-vite-shell-bg, #F8FAFC) 96%, transparent));
}

.ox-vite-kb-hero__copy {
  display: grid;
  gap: 8px;
}

.ox-vite-kb-hero__copy h2 {
  margin: 0;
  font-size: 28px;
  line-height: 1.12;
  color: var(--ox-vite-text-primary, #1E293B);
}

.ox-vite-kb-hero__copy p {
  margin: 0;
  max-width: 760px;
  color: var(--ox-vite-text-secondary, #64748B);
  line-height: 1.7;
}

.ox-vite-kb-hero__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(116px, 1fr));
  gap: 10px;
  align-self: start;
}

.ox-vite-kb-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(300px, 0.7fr);
  gap: 18px;
}

.ox-vite-kb-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(248px, 1fr));
  gap: 14px;
}

.ox-vite-kb-card {
  display: grid;
  gap: 12px;
  padding: 18px;
  border-radius: 22px;
  border: 1px solid var(--ox-vite-border, rgba(148, 163, 184, 0.14));
  background: linear-gradient(180deg, color-mix(in srgb, var(--ox-vite-surface, #FFFFFF) 98%, transparent), color-mix(in srgb, var(--ox-vite-shell-bg, #F8FAFC) 94%, transparent));
  box-shadow: 0 18px 34px rgba(15, 23, 42, 0.08);
}

.ox-vite-kb-card__head,
.ox-vite-kb-card__identity {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.ox-vite-kb-card__identity {
  justify-content: flex-start;
}

.ox-vite-kb-card__icon {
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--ox-accent-gradient, linear-gradient(135deg, #5BA3C5, #7BB8D4));
  color: #fff;
  box-shadow: 0 12px 24px rgba(91, 163, 197, 0.18);
}

.ox-vite-kb-card__name {
  font-size: 18px;
  font-weight: 700;
  line-height: 1.2;
}

.ox-vite-kb-card__meta {
  margin-top: 4px;
  color: var(--ox-vite-text-secondary, #64748B);
  font-size: 12px;
  line-height: 1.5;
}

.ox-vite-kb-card p {
  margin: 0;
  color: var(--ox-vite-text-secondary, #64748B);
  line-height: 1.65;
}

.ox-vite-kb-sidecard {
  display: grid;
  align-content: start;
}

.ox-vite-empty-state--compact {
  min-height: 140px;
}

.ox-vite-sandbox-workspace-shell,
.ox-vite-sandbox-project-shell,
.ox-vite-sandbox-roster-shell {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 0.72fr);
  gap: 16px;
}

.ox-vite-workspace-card--selectable,
.ox-vite-project-card--selectable,
.ox-vite-role-library-card--selectable {
  cursor: pointer;
  text-align: left;
  transition: transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease, background 150ms ease;
}

.ox-vite-workspace-card--selectable.is-selected,
.ox-vite-project-card--selectable.is-selected,
.ox-vite-role-library-card--selectable.is-selected {
  border-color: var(--ox-border-accent, rgba(91, 163, 197, 0.24));
  background: linear-gradient(180deg, var(--ox-accent-softer, rgba(91, 163, 197, 0.08)), color-mix(in srgb, var(--ox-vite-shell-bg, #F8FAFC) 94%, transparent));
  box-shadow: 0 24px 42px color-mix(in srgb, var(--ox-accent, #5BA3C5) 18%, transparent);
}

.ox-vite-sandbox-detail-card {
  display: grid;
  align-content: start;
  gap: 14px;
  padding: 18px;
  border-radius: 22px;
  border: 1px solid var(--ox-vite-border, rgba(148, 163, 184, 0.14));
  background: linear-gradient(180deg, color-mix(in srgb, var(--ox-vite-surface, #FFFFFF) 98%, transparent), color-mix(in srgb, var(--ox-vite-shell-bg, #F8FAFC) 96%, transparent));
  box-shadow: 0 18px 34px rgba(15, 23, 42, 0.08);
}

.ox-vite-sandbox-detail-card__hero {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ox-vite-project-card__icon--large,
.ox-vite-role-library-card__icon--large {
  width: 52px;
  height: 52px;
  border-radius: 16px;
}

.ox-vite-sandbox-detail-card__title {
  font-size: 16px;
  font-weight: 700;
  line-height: 1.25;
  color: var(--ox-vite-text-primary, #1E293B);
}

.ox-vite-sandbox-detail-card__meta {
  margin-top: 4px;
  color: var(--ox-vite-text-secondary, #64748B);
  line-height: 1.6;
}

.ox-vite-sandbox-detail-card__summary {
  margin: 0;
  color: var(--ox-vite-text-secondary, #64748B);
  line-height: 1.7;
}

.ox-vite-sandbox-hero {
  align-items: flex-start;
}

.ox-vite-sandbox-hero__head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.ox-vite-sandbox-back {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border: 1px solid var(--ox-vite-border, rgba(15, 23, 42, 0.08));
  border-radius: 14px;
  background: var(--ox-vite-surface, #FFFFFF);
  color: var(--ox-vite-text-secondary, #64748B);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.ox-vite-sandbox-breadcrumb {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.ox-vite-sandbox-breadcrumb__chip {
  min-height: 32px;
  padding: 0 12px;
  border: 1px solid var(--ox-vite-border, rgba(15, 23, 42, 0.08));
  border-radius: 999px;
  background: var(--ox-vite-surface, #FFFFFF);
  color: var(--ox-vite-text-secondary, #64748B);
  cursor: pointer;
  font: inherit;
  transition: all 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.ox-vite-sandbox-breadcrumb__chip:hover {
  border-color: color-mix(in srgb, var(--ox-accent, #5BA3C5) 24%, transparent);
  color: var(--ox-accent, #5BA3C5);
}

.ox-vite-sandbox-breadcrumb__chip.is-current {
  background: var(--ox-accent-soft, rgba(91, 163, 197, 0.1));
  border-color: color-mix(in srgb, var(--ox-accent, #5BA3C5) 24%, transparent);
  color: var(--ox-accent, #5BA3C5);
  cursor: default;
}

.ox-vite-sandbox-layout {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.ox-vite-project-card p {
  margin: 0;
  color: var(--ox-vite-text-secondary, #64748B);
  line-height: 1.65;
}

.ox-vite-empty-state .ox-vite-ops-primary-btn {
  margin-top: 8px;
}

/* SynapXnet Memory V3 */
.ox-vite-memory-workbench {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.ox-vite-memory-toolbar {
  min-height: 44px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.ox-vite-memory-actor,
.ox-vite-memory-search {
  min-height: 40px;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--ox-vite-border, rgba(15, 23, 42, 0.1));
  border-radius: 6px;
  background: var(--ox-vite-surface, #fff);
  color: var(--ox-vite-text-secondary, #64748b);
  padding: 0 11px;
}

.ox-vite-memory-actor {
  flex: 0 1 230px;
}

.ox-vite-memory-search {
  flex: 1 1 320px;
  max-width: 540px;
}

.ox-vite-memory-actor select,
.ox-vite-memory-search input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--ox-vite-text-primary, #1e293b);
  font: inherit;
}

.ox-vite-memory-actor select {
  height: 38px;
}

.ox-vite-memory-check {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  white-space: nowrap;
  color: var(--ox-vite-text-secondary, #64748b);
  font-size: 13px;
}

.ox-vite-memory-check input {
  accent-color: var(--ox-accent, #378ba3);
}

.ox-vite-memory-toolbar__actions,
.ox-vite-memory-header-actions,
.ox-vite-memory-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ox-vite-memory-toolbar__actions {
  margin-left: auto;
}

.ox-vite-icon-btn {
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--ox-vite-border, rgba(15, 23, 42, 0.1));
  border-radius: 6px;
  background: var(--ox-vite-surface, #fff);
  color: var(--ox-vite-text-secondary, #64748b);
  cursor: pointer;
}

.ox-vite-icon-btn:hover:not(:disabled) {
  color: var(--ox-accent, #378ba3);
  border-color: color-mix(in srgb, var(--ox-accent, #378ba3) 42%, transparent);
}

.ox-vite-icon-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.ox-vite-memory-notice {
  min-height: 36px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border: 1px solid color-mix(in srgb, #2c8c72 32%, transparent);
  border-radius: 6px;
  background: color-mix(in srgb, #2c8c72 8%, var(--ox-vite-surface, #fff));
  color: #26735f;
  font-size: 13px;
}

.ox-vite-memory-notice.is-error {
  border-color: color-mix(in srgb, #cf4f64 32%, transparent);
  background: color-mix(in srgb, #cf4f64 8%, var(--ox-vite-surface, #fff));
  color: #b63e52;
}

.ox-vite-memory-layout {
  display: grid;
  grid-template-columns: minmax(230px, 0.8fr) minmax(360px, 1.55fr) minmax(250px, 0.85fr);
  min-height: 510px;
  max-height: 680px;
  border: 1px solid var(--ox-vite-border, rgba(15, 23, 42, 0.1));
  border-radius: 8px;
  background: var(--ox-vite-surface, #fff);
  overflow: hidden;
  transition: opacity 120ms ease;
}

.ox-vite-memory-layout.is-loading {
  opacity: 0.72;
}

.ox-vite-memory-library,
.ox-vite-memory-inspector,
.ox-vite-memory-history {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.ox-vite-memory-library,
.ox-vite-memory-history {
  background: var(--ox-vite-shell-bg, #f8fafc);
}

.ox-vite-memory-library {
  border-right: 1px solid var(--ox-vite-border, rgba(15, 23, 42, 0.1));
}

.ox-vite-memory-history {
  border-left: 1px solid var(--ox-vite-border, rgba(15, 23, 42, 0.1));
}

.ox-vite-memory-pane-head {
  min-height: 52px;
  padding: 9px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-bottom: 1px solid var(--ox-vite-border, rgba(15, 23, 42, 0.1));
}

.ox-vite-memory-pane-head > div {
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.ox-vite-memory-pane-head span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ox-vite-text-secondary, #64748b);
  font-size: 12px;
}

.ox-vite-memory-pane-head strong {
  color: var(--ox-vite-text-primary, #1e293b);
  font-size: 14px;
}

.ox-vite-memory-list,
.ox-vite-memory-version-list,
.ox-vite-memory-inspector {
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--ox-vite-text-secondary, #64748b) 40%, transparent) transparent;
}

.ox-vite-memory-list::-webkit-scrollbar,
.ox-vite-memory-version-list::-webkit-scrollbar,
.ox-vite-memory-inspector::-webkit-scrollbar {
  width: 6px;
}

.ox-vite-memory-list::-webkit-scrollbar-thumb,
.ox-vite-memory-version-list::-webkit-scrollbar-thumb,
.ox-vite-memory-inspector::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: color-mix(in srgb, var(--ox-vite-text-secondary, #64748b) 40%, transparent);
}

.ox-vite-memory-row {
  width: 100%;
  padding: 12px;
  display: grid;
  gap: 6px;
  border: 0;
  border-bottom: 1px solid var(--ox-vite-border, rgba(15, 23, 42, 0.08));
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.ox-vite-memory-row:hover,
.ox-vite-memory-row.active {
  background: color-mix(in srgb, var(--ox-accent, #378ba3) 8%, var(--ox-vite-surface, #fff));
}

.ox-vite-memory-row.active {
  box-shadow: inset 3px 0 var(--ox-accent, #378ba3);
}

.ox-vite-memory-row__head,
.ox-vite-memory-row__meta,
.ox-vite-memory-version__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.ox-vite-memory-row__head strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ox-vite-text-primary, #1e293b);
  font-size: 13px;
}

.ox-vite-memory-row__badges {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.ox-vite-memory-type-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 6px;
  border: 1px solid color-mix(in srgb, #2d7d67 20%, transparent);
  border-radius: 4px;
  background: color-mix(in srgb, #2d7d67 9%, var(--ox-vite-surface, #fff));
  color: #26705e !important;
  font-size: 10px !important;
  line-height: 1.2;
  white-space: nowrap;
}

.ox-vite-memory-type-badge[data-memory-type='incident'] {
  border-color: color-mix(in srgb, #b45c3f 22%, transparent);
  background: color-mix(in srgb, #b45c3f 9%, var(--ox-vite-surface, #fff));
  color: #984a33 !important;
}

.ox-vite-memory-type-badge[data-memory-type='collaboration'] {
  border-color: color-mix(in srgb, #357da0 22%, transparent);
  background: color-mix(in srgb, #357da0 9%, var(--ox-vite-surface, #fff));
  color: #2d6b89 !important;
}

.ox-vite-memory-type-badge[data-memory-type='decision'] {
  border-color: color-mix(in srgb, #665da8 22%, transparent);
  background: color-mix(in srgb, #665da8 9%, var(--ox-vite-surface, #fff));
  color: #5c5398 !important;
}

.ox-vite-memory-type-badge[data-memory-type='manual'] {
  border-color: color-mix(in srgb, #64748b 22%, transparent);
  background: color-mix(in srgb, #64748b 8%, var(--ox-vite-surface, #fff));
  color: #556274 !important;
}

.ox-vite-memory-row__head span,
.ox-vite-memory-row__meta,
.ox-vite-memory-version p,
.ox-vite-memory-version small {
  color: var(--ox-vite-text-secondary, #64748b);
  font-size: 11px;
}

.ox-vite-memory-row p {
  margin: 0;
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  color: var(--ox-vite-text-secondary, #64748b);
  font-size: 12px;
  line-height: 1.5;
}

.ox-vite-memory-row__meta span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.ox-vite-memory-row__meta .is-retired {
  color: #a35a67;
}

.ox-vite-memory-inspector {
  padding-bottom: 16px;
}

.ox-vite-memory-inspector > .ox-vite-memory-pane-head {
  flex: 0 0 auto;
}

.ox-vite-memory-document {
  padding: 22px 24px 16px;
}

.ox-vite-memory-document h2 {
  margin: 0 0 10px;
  color: var(--ox-vite-text-primary, #1e293b);
  font-size: 20px;
}

.ox-vite-memory-document p {
  margin: 16px 0 0;
  color: var(--ox-vite-text-primary, #1e293b);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.75;
}

.ox-vite-memory-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ox-vite-memory-tags span {
  padding: 3px 7px;
  border-radius: 4px;
  background: color-mix(in srgb, #665da8 10%, var(--ox-vite-surface, #fff));
  color: #665da8;
  font-size: 11px;
}

.ox-vite-memory-facts {
  margin: 0 24px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  border-top: 1px solid var(--ox-vite-border, rgba(15, 23, 42, 0.08));
}

.ox-vite-memory-facts > div {
  min-width: 0;
  padding: 11px 0;
  display: grid;
  gap: 4px;
}

.ox-vite-memory-facts dt {
  color: var(--ox-vite-text-secondary, #64748b);
  font-size: 11px;
}

.ox-vite-memory-facts dd {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--ox-vite-text-primary, #1e293b);
  font-family: inherit;
  font-size: 12px;
  white-space: nowrap;
}

.ox-vite-memory-actions {
  justify-content: flex-end;
  padding: 14px 24px 0;
}

.ox-vite-ops-secondary-btn.is-danger {
  color: #b63e52;
  border-color: color-mix(in srgb, #cf4f64 30%, transparent);
}

.ox-vite-memory-form {
  padding: 16px 20px 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.ox-vite-memory-form textarea {
  width: 100%;
  resize: vertical;
  min-height: 150px;
  max-height: 300px;
  border: 1px solid var(--ox-vite-border, rgba(15, 23, 42, 0.1));
  border-radius: 6px;
  padding: 10px;
  background: var(--ox-vite-surface, #fff);
  color: var(--ox-vite-text-primary, #1e293b);
  font: inherit;
  line-height: 1.6;
}

.ox-vite-memory-version {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  padding: 11px 12px 0;
}

.ox-vite-memory-version__rail {
  position: relative;
  display: flex;
  justify-content: center;
}

.ox-vite-memory-version__rail::after {
  content: '';
  position: absolute;
  top: 10px;
  bottom: -11px;
  width: 1px;
  background: var(--ox-vite-border, rgba(15, 23, 42, 0.12));
}

.ox-vite-memory-version:last-child .ox-vite-memory-version__rail::after {
  display: none;
}

.ox-vite-memory-version__rail span {
  position: relative;
  z-index: 1;
  width: 8px;
  height: 8px;
  margin-top: 5px;
  border-radius: 50%;
  background: var(--ox-accent, #378ba3);
}

.ox-vite-memory-version__body {
  min-width: 0;
  padding: 0 0 13px 7px;
}

.ox-vite-memory-version__head strong {
  color: var(--ox-vite-text-primary, #1e293b);
  font-size: 13px;
}

.ox-vite-memory-version__head span {
  color: #665da8;
  font-size: 11px;
}

.ox-vite-memory-version p {
  margin: 4px 0;
}

.ox-vite-memory-version__rollback {
  margin-top: 7px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 0;
  background: transparent;
  color: var(--ox-accent, #378ba3);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}

.ox-vite-memory-empty {
  flex: 1 1 auto;
  min-height: 160px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px;
  color: var(--ox-vite-text-secondary, #64748b);
  text-align: center;
}

.ox-vite-memory-empty i {
  font-size: 24px;
}

.ox-vite-memory-empty.is-compact {
  min-height: 100px;
  font-size: 12px;
}

@media (max-width: 1180px) {
  .ox-vite-memory-layout {
    grid-template-columns: minmax(220px, 0.75fr) minmax(360px, 1.25fr);
    max-height: none;
  }

  .ox-vite-memory-history {
    grid-column: 1 / -1;
    min-height: 210px;
    border-left: 0;
    border-top: 1px solid var(--ox-vite-border, rgba(15, 23, 42, 0.1));
  }

  .ox-vite-memory-version-list {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 820px) {
  .ox-vite-memory-toolbar {
    flex-wrap: wrap;
  }

  .ox-vite-memory-actor,
  .ox-vite-memory-search {
    flex: 1 1 100%;
    max-width: none;
  }

  .ox-vite-memory-toolbar__actions {
    margin-left: 0;
  }

  .ox-vite-memory-layout {
    grid-template-columns: 1fr;
  }

  .ox-vite-memory-library,
  .ox-vite-memory-history {
    min-height: 240px;
    border: 0;
    border-bottom: 1px solid var(--ox-vite-border, rgba(15, 23, 42, 0.1));
  }

  .ox-vite-memory-version-list,
  .ox-vite-memory-facts,
  .ox-vite-memory-form {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 1240px) {
  .ox-vite-role-layout {
    grid-template-columns: 1fr;
  }

  .ox-vite-kb-layout,
  .ox-vite-sandbox-layout,
  .ox-vite-sandbox-workspace-shell,
  .ox-vite-sandbox-project-shell,
  .ox-vite-sandbox-roster-shell {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 980px) {
  .ox-vite-role-hero {
    grid-template-columns: 1fr;
  }

  .ox-vite-role-hero__stats {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .ox-vite-workspace-hub__hero,
  .ox-vite-sandbox-hero {
    flex-direction: column;
  }

  .ox-vite-kb-hero {
    grid-template-columns: 1fr;
  }

  .ox-vite-workspace-card__stats {
    grid-template-columns: 1fr;
  }

  .ox-vite-kb-hero__stats {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .ox-vite-role-hero {
    padding: 18px;
    border-radius: 20px;
  }

  .ox-vite-role-hero__copy h2 {
    font-size: 24px;
  }

  .ox-vite-kb-hero,
  .ox-vite-role-hero__stats,
  .ox-vite-kb-hero__stats,
  .ox-vite-role-template-grid,
  .ox-vite-role-library-grid,
  .ox-vite-kb-grid {
    grid-template-columns: 1fr;
  }

  .ox-vite-role-toolbar {
    align-items: stretch;
  }

  .ox-vite-role-search {
    max-width: none;
  }

  .ox-vite-workspace-card__actions {
    flex-direction: column;
  }

  .ox-vite-workspace-card__actions .ox-vite-ops-primary-btn,
  .ox-vite-workspace-card__actions .ox-vite-ops-secondary-btn {
    width: 100%;
  }
}

@media (max-width: 1180px) {
  .ox-vite-vrm-topbar {
    flex-direction: column;
  }

  .ox-vite-vrm-topbar__actions {
    width: 100%;
    justify-content: flex-end;
  }

  .ox-vite-vrm-guide,
  .ox-vite-vrm-guide__note {
    width: 100%;
  }

  .ox-vite-vrm-guide__steps {
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }

  .ox-vite-vrm-layout {
    grid-template-columns: minmax(0, 1fr) 320px;
  }
}

@media (max-width: 980px) {
  .ox-vite-vrm-layout {
    grid-template-columns: 1fr;
  }

  .ox-vite-vrm-preview {
    border-left: 0;
    border-top: 1px solid var(--ox-vite-border, rgba(15, 23, 42, 0.08));
    height: 60vh;
  }
}

@media (max-width: 720px) {
  .ox-vite-vrm-topbar {
    padding: 0 0 14px;
  }

  .ox-vite-vrm-guide__steps {
    grid-template-columns: 1fr;
  }

  .ox-vite-vrm-topbar__actions {
    justify-content: stretch;
  }

  .ox-vite-vrm-topbar__actions > button {
    flex: 1 1 160px;
  }
}
</style>
