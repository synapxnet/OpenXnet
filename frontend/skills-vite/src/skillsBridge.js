function getHostApp() {
  return typeof window !== 'undefined' ? window.openxnetApp || null : null;
}

function isCurrentLanguageZh(host) {
  if (host && typeof host.isCurrentLanguageZh === 'function') {
    try {
      return !!host.isCurrentLanguageZh();
    } catch (error) {
      return true;
    }
  }
  const language = String(host?.currentLanguage || navigator.language || 'zh-CN').toLowerCase();
  return language.startsWith('zh');
}

function getLibrarySkills(host) {
  return Array.isArray(host?.computedSkillsList) ? host.computedSkillsList : [];
}

function getLibraryItems(host, isZh) {
  const items = host && typeof host.getPrototypeFilteredSkillsList === 'function'
    ? host.getPrototypeFilteredSkillsList()
    : getLibrarySkills(host);

  return items.map((skill) => ({
    id: String(skill?.id || ''),
    name: String(skill?.displayName || skill?.name || skill?.id || ''),
    alias: String(skill?.displayAlias || skill?.id || ''),
    description: String(skill?.displayDescription || skill?.description || ''),
    version: String(skill?.version || '1.0.0'),
    isGlobal: !!skill?.isGlobal,
    isProject: !!skill?.isProject,
    installed: !!(skill?.isGlobal || skill?.isProject),
    tags: Array.isArray(skill?.tags) && skill.tags.length
      ? skill.tags
      : [isZh ? '技能' : 'Skill'],
    previewSummary: String(skill?.previewSummary || skill?.displayDescription || skill?.description || ''),
    previewHighlights: Array.isArray(skill?.previewHighlights) ? skill.previewHighlights : [],
  }));
}

function getPreviewSkill(host, isZh, libraryItems) {
  const activeId = String(host?.activeSkillPreviewId || '').trim();
  const current = libraryItems.find((item) => item.id === activeId) || libraryItems[0] || null;
  return {
    activeId,
    current,
    renderedContent: String(host?.renderedSkillContent || ''),
    loading: !!host?.skillPreviewLoading,
    emptyText: isZh ? '选择技能后，这里会显示说明和预览。' : 'Select a skill to see its preview here.',
  };
}

function getTransformSnapshot(host, isZh) {
  return {
    githubUrl: String(host?.newSkillUrl || ''),
    isInstalling: !!host?.isSkillInstalling,
    isUploading: !!host?.isUploading,
    workspacePath: String(host?.CLISettings?.cc_path || ''),
    cards: [
      {
        id: 'github',
        title: isZh ? 'GitHub 仓库' : 'GitHub Repository',
        description: isZh ? '从 GitHub 仓库直接安装技能。' : 'Install a skill directly from a GitHub repository.',
        icon: 'fa-brands fa-github',
      },
      {
        id: 'zip',
        title: isZh ? 'ZIP 技能包' : 'ZIP Skill Package',
        description: isZh ? '上传 ZIP 技能包到全局技能目录。' : 'Upload a ZIP skill package into the global skills directory.',
        icon: 'fa-solid fa-file-zipper',
      },
    ],
  };
}

function getCrystalSnapshot(host, isZh) {
  const draft = host?.skillCrystalDraft || {};
  const summary = host?.skillLifecycleSummary || {};
  const items = Array.isArray(host?.skillLifecycleItems) ? host.skillLifecycleItems : [];
  return {
    draft: {
      source: String(draft.source || 'work'),
      name: String(draft.name || ''),
      id: String(draft.id || ''),
      description: String(draft.description || ''),
      trigger: String(draft.trigger || ''),
      workflow: String(draft.workflow || ''),
      notes: String(draft.notes || ''),
      syncToWorkspace: !!draft.syncToWorkspace,
    },
    preview: String(host?.skillCrystalPreview || ''),
    isCrystallizing: !!host?.isSkillCrystallizing,
    lifecycle: {
      loading: !!host?.skillLifecycleLoading,
      running: !!host?.skillLifecycleRunning,
      counts: summary?.counts || {},
      items: items.slice(0, 8),
    },
    sourceOptions: host && typeof host.getSkillCrystalSourceOptions === 'function'
      ? host.getSkillCrystalSourceOptions()
      : [],
    lifecycleStates: host && typeof host.getSkillLifecycleStates === 'function'
      ? host.getSkillLifecycleStates()
      : [],
    workspacePath: String(host?.CLISettings?.cc_path || ''),
    isZh,
  };
}

function createSnapshot() {
  const host = getHostApp();
  const isZh = isCurrentLanguageZh(host);
  const activeTab = String(host?.activeSkillCenterTab || host?.subMenu || 'library');
  const libraryItems = getLibraryItems(host, isZh);
  return {
    isZh,
    activeMenu: String(host?.activeMenu || ''),
    activeTab,
    filter: String(host?.skillsLibraryFilter || 'all'),
    query: String(host?.skillsLibraryQuery || ''),
    tabs: [
      { id: 'library', label: host?.t?.('skillLibrary') || (isZh ? '技能库' : 'Library'), icon: 'fa-solid fa-book-open-reader' },
      { id: 'transform', label: host?.t?.('skillTransform') || (isZh ? '技能转化' : 'Transform'), icon: 'fa-solid fa-shuffle' },
      { id: 'crystal', label: host?.t?.('skillCrystal') || (isZh ? '技能结晶' : 'Crystal'), icon: 'fa-solid fa-gem' },
    ],
    library: {
      items: libraryItems,
      preview: getPreviewSkill(host, isZh, libraryItems),
      workspacePath: String(host?.CLISettings?.cc_path || ''),
      loading: !!host?.skillsLoading,
    },
    transform: getTransformSnapshot(host, isZh),
    crystal: getCrystalSnapshot(host, isZh),
  };
}

async function openTab(tabId) {
  const host = getHostApp();
  if (!host || typeof host.openSkillCenter !== 'function') return;
  host.openSkillCenter(tabId);
}

async function setLibraryFilter(value) {
  const host = getHostApp();
  if (!host) return;
  host.skillsLibraryFilter = value;
}

async function setLibraryQuery(value) {
  const host = getHostApp();
  if (!host) return;
  host.skillsLibraryQuery = value;
}

async function previewSkill(id) {
  const host = getHostApp();
  if (!host || typeof host.previewSkill !== 'function') return;
  await host.previewSkill(id);
}

async function refreshSkills() {
  const host = getHostApp();
  if (!host || typeof host.handleRefreshSkills !== 'function') return;
  await host.handleRefreshSkills();
}

async function openSkillsFolder() {
  const host = getHostApp();
  if (!host || typeof host.openSkillsFolder !== 'function') return;
  await host.openSkillsFolder();
}

async function setGithubUrl(value) {
  const host = getHostApp();
  if (!host) return;
  host.newSkillUrl = value;
}

async function installFromGithub() {
  const host = getHostApp();
  if (!host || typeof host.installSkillFromGithub !== 'function') return;
  await host.installSkillFromGithub();
}

async function uploadSkillZip(file) {
  const host = getHostApp();
  if (!host || typeof host.processSkillUpload !== 'function') return;
  await host.processSkillUpload(file);
}

async function setCrystalField(field, value) {
  const host = getHostApp();
  if (!host || !host.skillCrystalDraft) return;
  host.skillCrystalDraft[field] = value;
  if (field === 'name' && typeof host.refreshSkillCrystalName === 'function') {
    host.refreshSkillCrystalName();
    return;
  }
  if (field === 'id' && typeof host.handleSkillCrystalIdInput === 'function') {
    host.handleSkillCrystalIdInput();
    return;
  }
  if (typeof host.refreshSkillCrystalPreview === 'function') {
    host.refreshSkillCrystalPreview();
  }
}

async function seedCrystalExample() {
  const host = getHostApp();
  if (!host || typeof host.seedSkillCrystalExample !== 'function') return;
  host.seedSkillCrystalExample();
}

async function crystallizeSkill() {
  const host = getHostApp();
  if (!host || typeof host.crystallizeSkill !== 'function') return;
  await host.crystallizeSkill();
}

async function runSleepCycle() {
  const host = getHostApp();
  if (!host || typeof host.runSkillLifecycleSleepCycle !== 'function') return;
  await host.runSkillLifecycleSleepCycle();
}

export function createSkillsBridge() {
  return {
    snapshot: createSnapshot,
    openTab,
    setLibraryFilter,
    setLibraryQuery,
    previewSkill,
    refreshSkills,
    openSkillsFolder,
    setGithubUrl,
    installFromGithub,
    uploadSkillZip,
    setCrystalField,
    seedCrystalExample,
    crystallizeSkill,
    runSleepCycle,
  };
}
