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

function getTabLabel(tabId, isZh) {
  const labelMap = {
    memory: isZh ? '角色卡&记忆' : 'Role Memory',
    voice: isZh ? '多角色语音' : 'Voices',
    appearance: isZh ? '多角色外观' : 'Appearance',
    behavior: isZh ? '自主行为' : 'Behavior',
    vision: isZh ? '桌面视觉' : 'Desktop Vision',
  };
  return labelMap[tabId] || tabId;
}

function getBadgeTone(memory) {
  const className = String(memory?.prototypeBadgeClass || '').trim();
  if (className.includes('success')) return 'success';
  if (className.includes('warning')) return 'warning';
  if (className.includes('error')) return 'error';
  if (className.includes('accent')) return 'accent';
  if (className.includes('info')) return 'info';
  return 'muted';
}

function getAvatarText(host, memory, maxLength = 2) {
  let text = '';
  if (host && typeof host.getRoleMemoryAvatarText === 'function') {
    try {
      text = String(host.getRoleMemoryAvatarText(memory) || '').trim();
    } catch (error) {
      text = '';
    }
  }
  if (!text) {
    const name = String(memory?.name || '').trim();
    text = name ? Array.from(name).slice(0, maxLength).join('') : '角';
  }
  return Array.from(text.replace(/\s+/g, '')).slice(0, maxLength).join('') || '角';
}

function getAvatarBackground(host, memory) {
  if (host && typeof host.getRoleMemoryAvatarStyle === 'function') {
    try {
      const style = host.getRoleMemoryAvatarStyle(memory);
      if (style && style.background) {
        return style.background;
      }
    } catch (error) {}
  }
  return 'linear-gradient(135deg, #73c4ea 0%, #5aa7d1 100%)';
}

function notify(host, message, type = 'success') {
  try {
    if (typeof window !== 'undefined' && typeof window.showNotification === 'function') {
      window.showNotification(message, type);
      return;
    }
  } catch (error) {}
  try {
    if (host && typeof host.showNotification === 'function') {
      host.showNotification(message, type);
    }
  } catch (error) {}
}

async function persistCurrentAvatar(host, avatarUrl) {
  if (!host || !avatarUrl) return;
  if (!host.newMemory) {
    host.newMemory = {};
  }
  host.newMemory.avatar = avatarUrl;
  const activeId = host && typeof host.getActiveRoleMemoryId === 'function'
    ? String(host.getActiveRoleMemoryId() || '').trim()
    : String(host.newMemory?.id || '').trim();
  const targetId = activeId || String(host.newMemory?.id || '').trim();
  if (targetId && Array.isArray(host.memories)) {
    const target = host.memories.find((memory) => String(memory?.id || '') === targetId);
    if (target) {
      target.avatar = avatarUrl;
    }
  }
  await safeAutoSave(host);
}

async function uploadAvatarFile(host, file) {
  if (!file) return;
  const isZh = isCurrentLanguageZh(host);
  if (file.type && !String(file.type).startsWith('image/')) {
    notify(host, isZh ? '请选择图片文件' : 'Please select an image file', 'warning');
    return;
  }
  const formData = new FormData();
  formData.append('files', file, file.name || 'avatar.png');
  const response = await fetch('/load_file', {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const data = await response.json();
  const uploadedUrl = String(data?.fileLinks?.[0]?.path || data?.fileLinks?.[0]?.url || '').trim();
  if (!data?.success || !uploadedUrl) {
    throw new Error(data?.message || data?.error || 'Upload failed');
  }
  await persistCurrentAvatar(host, uploadedUrl);
  notify(host, isZh ? '头像已更新' : 'Avatar updated', 'success');
}

function getRoleList(host, isZh) {
  const source = host && typeof host.getPrototypeRoleMemorySource === 'function'
    ? host.getPrototypeRoleMemorySource()
    : (host?.memories || []);
  const activeId = host && typeof host.getActiveRoleMemoryId === 'function'
    ? String(host.getActiveRoleMemoryId() || '')
    : String(host?.memorySettings?.selectedMemory || '');

  return source.map((memory) => ({
    id: String(memory?.id || ''),
    name: String(memory?.name || (isZh ? '未命名角色' : 'Untitled role')),
    description: String(memory?.description || memory?.personality || ''),
    meta: host && typeof host.getRoleMemoryMeta === 'function'
      ? host.getRoleMemoryMeta(memory)
      : '',
    badge: host && typeof host.getRoleMemoryBadgeLabel === 'function'
      ? host.getRoleMemoryBadgeLabel(memory)
      : (memory?.infer ? (isZh ? '记忆' : 'Memory') : (isZh ? '角色' : 'Role')),
    badgeTone: getBadgeTone(memory),
    avatarText: getAvatarText(host, memory, 2),
    avatarImage: String(memory?.avatar || ''),
    avatarBackground: getAvatarBackground(host, memory),
    active: activeId === String(memory?.id || ''),
  }));
}

function getProviderOptions(host, isZh) {
  const providers = Array.isArray(host?.modelProviders) ? host.modelProviders : [];
  const base = [
    {
      value: '',
      label: isZh ? '不绑定长期记忆模型' : 'No long-term memory model',
    },
    {
      value: 'paraphrase-multilingual-MiniLM-L12-v2',
      label: isZh
        ? '本地 MiniLM - paraphrase-multilingual-MiniLM-L12-v2'
        : 'Local MiniLM - paraphrase-multilingual-MiniLM-L12-v2',
    },
  ];
  providers.forEach((provider) => {
    base.push({
      value: String(provider?.id || ''),
      label: `${provider?.vendor || 'Provider'} - ${provider?.modelId || provider?.id || ''}`.trim(),
    });
  });
  return base;
}

function getMemoryEditor(host, isZh) {
  const current = host?.newMemory || {};
  const memorySettings = host?.memorySettings || {};
  const activeId = host && typeof host.getActiveRoleMemoryId === 'function'
    ? String(host.getActiveRoleMemoryId() || '')
    : '';
  const canDelete = Array.isArray(host?.memories)
    ? host.memories.some((memory) => String(memory?.id || '') === activeId)
    : false;

  return {
    id: String(current?.id || ''),
    activeId,
    canDelete,
    title: String(current?.id || '').trim()
      ? (isZh ? '编辑角色' : 'Edit Role')
      : (isZh ? '新建角色' : 'New Role'),
    name: String(current?.name || ''),
    description: String(current?.description || ''),
    systemPrompt: String(current?.systemPrompt || ''),
    personality: String(current?.personality || ''),
    firstMes: String(current?.firstMes || ''),
    infer: !!current?.infer,
    avatarText: getAvatarText(host, current, 3),
    avatarImage: String(current?.avatar || ''),
    avatarBackground: getAvatarBackground(host, current),
    providerId: String(current?.providerId || ''),
    providerOptions: getProviderOptions(host, isZh),
    memoryEnabled: !!memorySettings?.is_memory,
    memoryLimit: Number(memorySettings?.memoryLimit || 10),
    userName: String(memorySettings?.userName || 'user'),
    genericSystemPrompt: String(memorySettings?.genericSystemPrompt || ''),
    backendLabel: host && typeof host.getPrototypeMemoryBackendLabel === 'function'
      ? host.getPrototypeMemoryBackendLabel()
      : (isZh ? 'Session Store（本地 JSON / 时间线）' : 'Session Store (local JSON / timeline)'),
  };
}

function getVoiceSnapshot(host, roles, isZh) {
  const tts = host?.ttsSettings || {};
  const allVoices = Array.isArray(host?.edgettsvoices) ? host.edgettsvoices : [];
  const voiceOptions = allVoices
    .filter((voice) => {
      const languageMatch = !tts.edgettsLanguage || voice.language === tts.edgettsLanguage;
      const genderMatch = !tts.edgettsGender || voice.gender === tts.edgettsGender;
      return languageMatch && genderMatch;
    })
    .slice(0, 40)
    .map((voice) => ({
      value: voice.name,
      label: `${voice.name} · ${voice.language} · ${voice.gender}`,
    }));

  return {
    providers: [
      { id: 'edgetts', label: 'Edge TTS', active: String(tts.engine || 'edgetts') === 'edgetts' },
      { id: 'openai', label: 'OpenAI TTS', active: String(tts.engine || '') === 'openai' },
      { id: 'system', label: isZh ? '系统语音' : 'System Voice', active: String(tts.engine || '') === 'system' },
    ],
    rows: roles.slice(0, 4).map((role, index) => ({
      id: role.id || `voice-${index}`,
      name: role.name,
      model: String(tts.edgettsVoice || 'XiaoyiNeural'),
      tone: [
        isZh ? '温暖女声' : 'Warm',
        isZh ? '沉稳男声' : 'Calm',
        isZh ? '清新女声' : 'Fresh',
        isZh ? '磁性男声' : 'Deep',
      ][index % 4],
      speed: `${Number(tts.edgettsRate || 1).toFixed(1)}x`,
      pitch: ['+0', '-2', '+1', '+0'][index % 4],
    })),
    selectedLanguage: String(tts.edgettsLanguage || 'zh-CN'),
    selectedGender: String(tts.edgettsGender || 'Female'),
    selectedVoice: String(tts.edgettsVoice || ''),
    selectedRate: Number(tts.edgettsRate || 1),
    sampleText: String(tts.SampleText || (isZh ? 'openxnet链接一切！' : 'OpenXnet connects everything.')),
    voiceOptions,
  };
}

function getAppearanceSnapshot(host, roles, isZh) {
  const vrm = host?.VRMConfig || {};
  const models = [...(vrm.defaultModels || []), ...(vrm.userModels || [])];
  return {
    avatars: roles.slice(0, 4).map((role) => ({
      ...role,
      shortName: role.avatarText,
    })),
    selectedModelId: String(vrm.selectedModelId || ''),
    modelOptions: models.map((model) => ({
      value: model.id,
      label: model.name || model.id,
    })),
    motionCount: Array.isArray(vrm.selectedMotionIds) ? vrm.selectedMotionIds.length : 0,
    expressionsEnabled: !!vrm.enabledExpressions,
    motionsEnabled: !!vrm.enabledMotions,
    windowSize: `${Number(vrm.windowWidth || 540)} × ${Number(vrm.windowHeight || 960)}`,
    selectedScene: String(vrm.selectedGaussSceneId || (isZh ? '透明' : 'Transparent')),
  };
}

function getBehaviorSnapshot(host, isZh) {
  const liveList = Array.isArray(host?.behaviorSettings?.behaviorList) ? host.behaviorSettings.behaviorList : [];
  if (liveList.length > 0) {
    return {
      hasRealData: true,
      rules: liveList.map((rule, index) => ({
        id: String(rule?.id || `behavior-${index}`),
        name: String(rule?.name || [
          isZh ? '定时问候' : 'Scheduled greeting',
          isZh ? '新闻播报' : 'News digest',
          isZh ? '任务提醒' : 'Task reminder',
          isZh ? '学习总结' : 'Study summary',
        ][index % 4]),
        description: String(rule?.action?.prompt || rule?.description || (isZh ? '自定义行为规则' : 'Custom behavior rule')),
        frequency: String(rule?.trigger?.type || (isZh ? '事件驱动' : 'Event-driven')),
        enabled: !!rule?.enabled,
      })),
    };
  }
  return {
    hasRealData: false,
    rules: [
      { id: 'demo-greeting', name: isZh ? '定时问候' : 'Scheduled greeting', description: isZh ? '每天早上 9 点主动问候用户' : 'Greets the user every morning at 9:00', frequency: isZh ? '频率: 每天' : 'Daily', enabled: true },
      { id: 'demo-news', name: isZh ? '新闻播报' : 'News digest', description: isZh ? '自动抓取并播报热点新闻' : 'Pulls and summarizes trending news', frequency: isZh ? '频率: 每小时' : 'Hourly', enabled: false },
      { id: 'demo-remind', name: isZh ? '任务提醒' : 'Task reminder', description: isZh ? '在任务截止前 30 分钟提醒' : 'Reminds before a deadline', frequency: isZh ? '触发: 事件驱动' : 'Event-driven', enabled: true },
      { id: 'demo-summary', name: isZh ? '学习总结' : 'Study summary', description: isZh ? '每周生成学习进度总结报告' : 'Builds a weekly learning summary', frequency: isZh ? '频率: 每周' : 'Weekly', enabled: false },
    ],
  };
}

function getVisionSnapshot(host, isZh) {
  const vision = host?.visionSettings || {};
  const providers = Array.isArray(host?.modelProviders) ? host.modelProviders : [];
  return {
    desktopVision: !!vision.desktopVision,
    enableWakeWord: !!vision.enableWakeWord,
    wakeWord: String(vision.wakeWord || ''),
    selectedProvider: String(vision.selectedProvider || ''),
    providerOptions: providers.map((provider) => ({
      value: String(provider?.id || ''),
      label: `${provider?.vendor || 'Provider'} - ${provider?.modelId || provider?.id || ''}`.trim(),
    })),
    modelLabel: String(vision.model || (isZh ? '未选择视觉模型' : 'No vision model selected')),
    captureFrequency: isZh ? '每10秒' : 'Every 10 seconds',
    captureScope: isZh ? '全屏' : 'Fullscreen',
    excludeApps: isZh ? ['微信', '1Password', '银行客户端'] : ['WeChat', '1Password', 'Bank App'],
  };
}

function createSnapshot() {
  const host = getHostApp();
  const isZh = isCurrentLanguageZh(host);
  const roles = getRoleList(host, isZh);
  return {
    isZh,
    activeMenu: String(host?.activeMenu || ''),
    activeTab: String(host?.subMenu || 'memory'),
    tabs: [
      { id: 'memory', label: getTabLabel('memory', isZh), icon: 'fa-solid fa-brain' },
      { id: 'voice', label: getTabLabel('voice', isZh), icon: 'fa-solid fa-microphone' },
      { id: 'appearance', label: getTabLabel('appearance', isZh), icon: 'fa-solid fa-palette' },
      { id: 'behavior', label: getTabLabel('behavior', isZh), icon: 'fa-solid fa-wand-magic-sparkles' },
      { id: 'vision', label: getTabLabel('vision', isZh), icon: 'fa-solid fa-eye' },
    ],
    roles,
    memory: getMemoryEditor(host, isZh),
    voice: getVoiceSnapshot(host, roles, isZh),
    appearance: getAppearanceSnapshot(host, roles, isZh),
    behavior: getBehaviorSnapshot(host, isZh),
    vision: getVisionSnapshot(host, isZh),
  };
}

async function safeAutoSave(host) {
  if (host && typeof host.autoSaveSettings === 'function') {
    await host.autoSaveSettings();
  }
}

async function selectTab(tabId) {
  const host = getHostApp();
  if (!host) return;
  host.activeMenu = 'role';
  host.subMenu = tabId;
  if (tabId === 'memory' && typeof host.ensurePrototypeRoleSelection === 'function') {
    host.ensurePrototypeRoleSelection();
  }
}

async function createRole() {
  const host = getHostApp();
  if (!host || typeof host.startCreateRoleMemory !== 'function') return;
  host.startCreateRoleMemory();
}

async function selectRole(roleId) {
  const host = getHostApp();
  if (!host || typeof host.selectRoleMemory !== 'function') return;
  host.selectRoleMemory(roleId, { persist: false });
}

async function saveRole() {
  const host = getHostApp();
  if (!host || typeof host.saveRoleMemoryInline !== 'function') return;
  await host.saveRoleMemoryInline();
}

async function deleteRole() {
  const host = getHostApp();
  if (!host || !host.newMemory?.id || typeof host.removeMemory !== 'function') return;
  await host.removeMemory(host.newMemory.id);
}

function triggerAvatarUpload() {
  const host = getHostApp();
  if (typeof document === 'undefined') return;
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.tabIndex = -1;
  input.style.position = 'fixed';
  input.style.left = '-9999px';
  input.style.top = '-9999px';
  input.addEventListener('change', async (event) => {
    const file = event.target?.files?.[0] || null;
    input.remove();
    if (!file) return;
    try {
      await uploadAvatarFile(host, file);
    } catch (error) {
      console.error('[role-vite] avatar upload failed:', error);
      notify(
        host,
        isCurrentLanguageZh(host) ? `头像上传失败：${error?.message || error}` : `Avatar upload failed: ${error?.message || error}`,
        'error'
      );
    }
  }, { once: true });
  document.body.appendChild(input);
  input.click();
}

async function updateRoleField(field, value) {
  const host = getHostApp();
  if (!host || !host.newMemory) return;
  host.newMemory[field] = value;
  await safeAutoSave(host);
}

async function updateMemorySetting(field, value) {
  const host = getHostApp();
  if (!host || !host.memorySettings) return;
  host.memorySettings[field] = value;
  if (field === 'is_memory' && typeof host.changeMemory === 'function') {
    host.changeMemory();
    return;
  }
  await safeAutoSave(host);
}

async function updateMemoryProvider(value) {
  const host = getHostApp();
  if (!host || !host.newMemory) return;
  host.newMemory.providerId = value || null;
  if (typeof host.selectMemoryProvider === 'function') {
    host.selectMemoryProvider(host.newMemory.providerId);
  }
  await safeAutoSave(host);
}

async function updateTtsField(field, value) {
  const host = getHostApp();
  if (!host || !host.ttsSettings) return;
  host.ttsSettings[field] = value;
  if (field === 'edgettsLanguage') host.edgettsLanguage = value;
  if (field === 'edgettsGender') host.edgettsGender = value;
  await safeAutoSave(host);
}

async function playVoiceSample() {
  const host = getHostApp();
  if (!host || typeof host.ClickToListen !== 'function') return;
  const sample = host.ttsSettings?.SampleText || 'openxnet链接一切！';
  const voice = host.ttsSettings?.edgettsVoice || 'default';
  await host.ClickToListen(sample, voice);
}

async function openVrmUpload() {
  const host = getHostApp();
  if (!host) return;
  host.showVrmModelDialog = true;
}

async function updateVrmField(field, value) {
  const host = getHostApp();
  if (!host || !host.VRMConfig) return;
  host.VRMConfig[field] = value;
  if (typeof host.saveVRMConfig === 'function') {
    await host.saveVRMConfig();
    return;
  }
  await safeAutoSave(host);
}

async function toggleBehaviorRule(index) {
  const host = getHostApp();
  if (!host || !Array.isArray(host.behaviorSettings?.behaviorList)) return;
  const item = host.behaviorSettings.behaviorList[index];
  if (!item) return;
  item.enabled = !item.enabled;
  await safeAutoSave(host);
}

async function openBehaviorEditor() {
  const host = getHostApp();
  if (!host) return;
  host.showBehaviorDialog = true;
}

async function updateVisionField(field, value) {
  const host = getHostApp();
  if (!host || !host.visionSettings) return;
  host.visionSettings[field] = value;
  await safeAutoSave(host);
}

async function updateVisionProvider(value) {
  const host = getHostApp();
  if (!host || !host.visionSettings) return;
  host.visionSettings.selectedProvider = value || null;
  if (typeof host.selectVisionProvider === 'function') {
    await host.selectVisionProvider(host.visionSettings.selectedProvider);
    return;
  }
  await safeAutoSave(host);
}

export function createRoleBridge() {
  return {
    snapshot: createSnapshot,
    selectTab,
    createRole,
    selectRole,
    saveRole,
    deleteRole,
    triggerAvatarUpload,
    updateRoleField,
    updateMemorySetting,
    updateMemoryProvider,
    updateTtsField,
    playVoiceSample,
    openVrmUpload,
    updateVrmField,
    toggleBehaviorRule,
    openBehaviorEditor,
    updateVisionField,
    updateVisionProvider,
  };
}
