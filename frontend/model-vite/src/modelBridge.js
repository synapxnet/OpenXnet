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

function getModelSlotLabel(slotId, isZh) {
  const labelMap = {
    service: isZh ? '模型服务' : 'Provider Service',
    main: isZh ? '主模型' : 'Main Model',
    fast: isZh ? '快速应答模型' : 'Fast Model',
    reasoner: isZh ? '推理模型' : 'Reasoner Model',
    vision: isZh ? '视觉模型' : 'Vision Model',
    text2img: isZh ? '图像生成模型' : 'Image Model',
    asr: isZh ? '语音识别模型' : 'ASR Model',
    tts: isZh ? '语音合成模型' : 'TTS Model',
  };
  return labelMap[slotId] || slotId;
}

function getProviderInitial(provider) {
  const name = String(provider?.displayName || provider?.vendor || provider?.displayVendor || provider?.id || '').trim();
  return name ? name.charAt(0).toUpperCase() : 'P';
}

function getProviderStatusTone(provider, host) {
  if (host && typeof host.getPrototypeProviderStatusTone === 'function') {
    return host.getPrototypeProviderStatusTone(provider) || 'muted';
  }
  const hasUrl = !!String(provider?.url || '').trim();
  const hasModel = !!String(provider?.modelId || '').trim();
  if (hasUrl && hasModel) return 'success';
  if (hasUrl) return 'warning';
  return 'muted';
}

function getProviderStatusLabel(provider, host, isZh) {
  if (host && typeof host.getPrototypeProviderStatusLabel === 'function') {
    return host.getPrototypeProviderStatusLabel(provider);
  }
  const hasUrl = !!String(provider?.url || '').trim();
  const hasModel = !!String(provider?.modelId || '').trim();
  if (hasUrl && hasModel) return isZh ? '已连接' : 'Connected';
  if (hasUrl) return isZh ? '待选择模型' : 'Model pending';
  return isZh ? '未配置' : 'Not configured';
}

function getProviderSummary(provider, host, isZh) {
  if (host && typeof host.getPrototypeProviderSummaryText === 'function') {
    return host.getPrototypeProviderSummaryText(provider);
  }
  const modelsCount = Array.isArray(provider?.models) ? provider.models.length : 0;
  return modelsCount > 0
    ? (isZh ? `${modelsCount} 个模型已配置` : `${modelsCount} models configured`)
    : (isZh ? '未设置' : 'Unset');
}

function getProviderDisplayName(provider, host) {
  if (host && typeof host.getPrototypeProviderDisplayName === 'function') {
    return host.getPrototypeProviderDisplayName(provider);
  }
  return String(provider?.displayVendor || provider?.vendor || provider?.id || '').trim();
}

function getVendorLogo(host, vendor) {
  try {
    if (host && typeof host.getVendorLogo === 'function') {
      return String(host.getVendorLogo(vendor) || '').trim();
    }
  } catch (error) {
    // noop
  }
  return 'source/providers/logo.png';
}

function getProviderOptionValue(host, value) {
  try {
    if (host && typeof host.getProviderModelOptionValue === 'function') {
      return String(host.getProviderModelOptionValue(value) || '').trim();
    }
  } catch (error) {
    // noop
  }
  if (value && typeof value === 'object') {
    return String(value.id || value.value || value.model || value.name || value.label || '').trim();
  }
  return String(value || '').trim();
}

function getProviderOptionLabel(host, value) {
  try {
    if (host && typeof host.getProviderModelOptionLabel === 'function') {
      return String(host.getProviderModelOptionLabel(value) || '').trim();
    }
  } catch (error) {
    // noop
  }
  if (value && typeof value === 'object') {
    return String(value.label || value.name || value.id || value.value || value.model || '').trim();
  }
  return String(value || '').trim();
}

function getConfiguredProviders(host) {
  if (host && typeof host.getPrototypeConfiguredProviders === 'function') {
    try {
      return host.getPrototypeConfiguredProviders() || [];
    } catch (error) {
      return [];
    }
  }
  return Array.isArray(host?.modelProviders) ? host.modelProviders : [];
}

function isConfiguredProvider(provider) {
  const vendor = String(provider?.vendor || '').trim();
  const url = String(provider?.url || '').trim();
  const modelId = String(provider?.modelId || '').trim();
  const apiKey = String(provider?.apiKey || '').trim();
  const models = Array.isArray(provider?.models)
    ? provider.models.map((item) => getProviderOptionValue(null, item)).filter(Boolean)
    : [];
  return Boolean(vendor || url || modelId || apiKey || models.length);
}

function getTemplateProviders(host) {
  if (host && typeof host.getPrototypeProviderTemplates === 'function') {
    try {
      return host.getPrototypeProviderTemplates() || [];
    } catch (error) {
      return [];
    }
  }
  return [];
}

function getServiceSelectionId(host) {
  return String(host?.prototypeModelProviderSelection || '').trim();
}

function setServiceSelectionId(host, providerId) {
  if (!host) return;
  host.prototypeModelProviderSelection = String(providerId || '').trim();
}

function getProviders(host, isZh) {
  const configured = getConfiguredProviders(host).filter((provider) => {
    if (host && typeof host.isPrototypeMeaningfulProvider === 'function') {
      return host.isPrototypeMeaningfulProvider(provider);
    }
    return isConfiguredProvider(provider);
  });
  const selectionId = getServiceSelectionId(host);
  const currentMainId = String(host?.settings?.selectedProvider || '').trim();
  return configured.map((provider) => {
    const providerId = String(provider?.id || '');
    const validation = providerId && host && typeof host.getProviderCardValidation === 'function'
      ? host.getProviderCardValidation(providerId)
      : null;
    const rawModels = Array.isArray(provider?.models)
      ? provider.models.map((item) => ({
          value: getProviderOptionValue(host, item),
          label: getProviderOptionLabel(host, item),
        })).filter((item) => item.value)
      : [];
    return {
      id: providerId,
      vendor: String(provider?.vendor || ''),
      displayName: getProviderDisplayName(provider, host),
      summary: getProviderSummary(provider, host, isZh),
      statusLabel: validation?.status
        ? (isZh
          ? ({ success: '验证通过', warning: '需关注', blocked: '阻塞', error: '异常' }[validation.status] || validation.status)
          : ({ success: 'Validated', warning: 'Warning', blocked: 'Blocked', error: 'Error' }[validation.status] || validation.status))
        : getProviderStatusLabel(provider, host, isZh),
      statusTone: validation?.status || getProviderStatusTone(provider, host),
      initial: getProviderInitial(provider),
      isTemplate: !!provider?.isTemplate,
      selected: selectionId ? providerId === selectionId : providerId === currentMainId,
      active: providerId === currentMainId,
      // 每张卡内联表单需要的字段：
      url: String(provider?.url || ''),
      apiKey: String(provider?.apiKey || ''),
      modelId: String(provider?.modelId || ''),
      logo: getVendorLogo(host, provider?.logoVendor || provider?.setupVendor || provider?.vendor),
      hasWebsite: !!String(host?.vendorAPIpage?.[provider?.vendor] || '').trim(),
      isCustom: String(provider?.vendor || '').toLowerCase() === 'custom',
      rawModels,
      validationStatus: String(validation?.status || '').trim(),
      validationMessage: String(validation?.message || '').trim(),
      validationChecks: Array.isArray(validation?.checks) ? validation.checks : [],
      validationModels: Array.isArray(validation?.models)
        ? validation.models.map((item) => ({
            value: getProviderOptionValue(host, item),
            label: getProviderOptionLabel(host, item),
          })).filter((item) => item.value)
        : [],
      matchedModel: !!validation?.matched_model,
      apiKeyConfigured: !!validation?.api_key_configured,
      apiKeyOptional: !!validation?.api_key_optional,
      isValidating: providerId && host && typeof host.isProviderCardValidating === 'function'
        ? !!host.isProviderCardValidating(providerId)
        : false,
      isApplying: providerId && host && typeof host.isProviderCardApplying === 'function'
        ? !!host.isProviderCardApplying(providerId)
        : false,
    };
  });
}

// —— Add Provider Dialog 用：vendor 选项 + 分类（云端/本地）——
const LOCAL_VENDORS = new Set(['Ollama', 'Vllm', 'LMstudio', 'xinference', 'Dify', 'newapi', 'LocalAI', 'ttswebui']);

function buildVendorOptions(host, isZh) {
  const vendors = Array.isArray(host?.vendorValues) ? host.vendorValues : [];
  const draftVendor = String(host?.newProviderTemp?.vendor || '').trim();
  return vendors.map((value) => {
    const code = String(value || '').trim();
    const isCustom = code.toLowerCase() === 'custom';
    const labelKey = `vendor.${code}`;
    let label = '';
    if (host && typeof host.t === 'function') {
      try { label = String(host.t(labelKey) || '').trim(); } catch (e) { label = ''; }
    }
    if (!label || label === labelKey) {
      label = isCustom
        ? (isZh ? '自定义 OpenAI' : 'Custom OpenAI')
        : code;
    }
    return {
      value: code,
      label,
      logo: getVendorLogo(host, code),
      category: isCustom ? 'custom' : (LOCAL_VENDORS.has(code) ? 'local' : 'cloud'),
      selected: draftVendor === code,
      isCustom,
    };
  });
}

function getCurrentServiceProvider(host) {
  const selectionId = getServiceSelectionId(host);
  const pool = [...getConfiguredProviders(host), ...getTemplateProviders(host)];
  if (selectionId) {
    const selected = pool.find((item) => String(item?.id || '') === selectionId);
    if (selected) return selected;
  }
  if (host && typeof host.getPrototypeCurrentMainProvider === 'function') {
    const current = host.getPrototypeCurrentMainProvider();
    if (current) {
      if (!selectionId) {
        setServiceSelectionId(host, current.id);
      }
      return current;
    }
  }
  const fallback = pool[0] || null;
  if (fallback && !selectionId) {
    setServiceSelectionId(host, fallback.id);
  }
  return fallback;
}

function getServicePanel(host, isZh) {
  const current = getCurrentServiceProvider(host) || {};
  const isTemplate = !!current?.isTemplate;
  const models = Array.isArray(current?.models)
    ? current.models.map((item) => {
        if (host && typeof host.getProviderModelOptionValue === 'function') {
          return host.getProviderModelOptionValue(item);
        }
        return typeof item === 'string' ? item : String(item?.id || item?.name || '');
      }).filter(Boolean)
    : [];
  const draft = host?.newProviderTemp || {};
  const validation = current?.id && host && typeof host.getProviderCardValidation === 'function'
    ? host.getProviderCardValidation(current.id)
    : null;
  const templateOptions = getTemplateProviders(host);
  const unlockHubOptions = (Array.isArray(host?.vendorOptions) ? host.vendorOptions : []).filter((option) => option?.isUnlockHub);
  const displayName = isTemplate && draft.vendor
    ? (
      draft.vendor === 'custom'
        ? 'Azure OpenAI'
        : String(draft.vendor || '').trim()
    )
    : getProviderDisplayName(current, host);
  return {
    id: String(current?.id || ''),
    isTemplate,
    displayName: displayName || (isZh ? '新供应商' : 'New Provider'),
    statusLabel: String(validation?.status || '').trim()
      ? (isZh
        ? ({ success: '验证通过', warning: '需关注', blocked: '阻塞', error: '异常' }[validation.status] || validation.status)
        : ({ success: 'Validated', warning: 'Warning', blocked: 'Blocked', error: 'Error' }[validation.status] || validation.status))
      : getProviderStatusLabel(current, host, isZh),
    statusTone: String(validation?.status || '').trim() || getProviderStatusTone(current, host),
    vendor: String(isTemplate ? draft.vendor || current?.setupVendor || current?.vendor || '' : current?.vendor || ''),
    url: String(isTemplate ? draft.url || '' : current?.url || ''),
    apiKey: String(isTemplate ? draft.apiKey || '' : current?.apiKey || ''),
    modelId: String(isTemplate ? draft.modelId || current?.modelId || '' : current?.modelId || ''),
    models: models.map((item) => ({
      value: getProviderOptionValue(host, item),
      label: getProviderOptionLabel(host, item),
    })),
    validationMessage: String(validation?.message || ''),
    validationStatus: String(validation?.status || ''),
    validationChecks: Array.isArray(validation?.checks) ? validation.checks : [],
    validationModels: Array.isArray(validation?.models)
      ? validation.models.map((item) => ({
          value: getProviderOptionValue(host, item),
          label: getProviderOptionLabel(host, item),
        })).filter((item) => item.value)
      : [],
    matchedModel: !!validation?.matched_model,
    apiKeyConfigured: !!validation?.api_key_configured,
    apiKeyOptional: !!validation?.api_key_optional,
    isValidating: current?.id && host && typeof host.isProviderCardValidating === 'function'
      ? !!host.isProviderCardValidating(current.id)
      : false,
    isApplying: current?.id && host && typeof host.isProviderCardApplying === 'function'
      ? !!host.isProviderCardApplying(current.id)
      : false,
    isCurrentMain: String(host?.settings?.selectedProvider || '').trim() === String(current?.id || '').trim(),
    addOptions: [
      ...templateOptions.map((option) => ({
        value: String(option?.setupVendor || option?.vendor || '').trim(),
        label: String(option?.displayVendor || option?.vendor || option?.id || '').trim(),
        meta: String(option?.summaryText || '').trim(),
        isUnlockHub: false,
        logo: getVendorLogo(host, option?.logoVendor || option?.setupVendor || option?.vendor),
        selected: String(draft?.vendor || current?.setupVendor || current?.vendor || '').trim() === String(option?.setupVendor || option?.vendor || '').trim(),
      })),
      ...unlockHubOptions.map((option) => ({
        value: String(option?.value || '').trim(),
        label: String(option?.label || option?.value || '').trim(),
        meta: String(option?.meta || '').trim(),
        isUnlockHub: true,
        logo: '',
        selected: false,
      })),
    ],
    validProvider: !!host?.validProvider,
    websiteUrl: String(host?.vendorAPIpage?.[draft?.vendor || current?.vendor] || '').trim(),
  };
}

function buildProviderOptions(host) {
  return getConfiguredProviders(host).filter((provider) => {
    if (host && typeof host.isPrototypeMeaningfulProvider === 'function') {
      return host.isPrototypeMeaningfulProvider(provider);
    }
    return isConfiguredProvider(provider);
  }).map((provider) => ({
    value: String(provider?.id || ''),
    label: `${provider?.vendor || 'Provider'} · ${provider?.modelId || provider?.id || ''}`.trim(),
  }));
}

function createSlotConfig(host, slotId, isZh) {
  const settingsMap = {
    main: host?.settings,
    fast: host?.fastSettings,
    reasoner: host?.reasonerSettings,
    vision: host?.visionSettings,
    text2img: host?.text2imgSettings,
    asr: host?.asrSettings,
    tts: host?.ttsSettings,
  };
  const methodMap = {
    main: 'selectMainProvider',
    fast: 'selectFastProvider',
    reasoner: 'selectReasonerProvider',
    vision: 'selectVisionProvider',
    text2img: 'selectText2imgProvider',
    asr: 'selectAsrProvider',
    tts: 'selectTTSProvider',
  };
  const section = settingsMap[slotId] || {};
  const selectedProvider = String(section?.selectedProvider || '');
  const selectedProviderCard = selectedProvider
    ? (Array.isArray(host?.modelProviders) ? host.modelProviders.find((provider) => String(provider?.id || '') === selectedProvider) : null)
    : null;

  return {
    id: slotId,
    label: getModelSlotLabel(slotId, isZh),
    methodName: methodMap[slotId],
    selectedProvider,
    selectedProviderName: selectedProviderCard
      ? `${selectedProviderCard.vendor || 'Provider'} / ${selectedProviderCard.modelId || (isZh ? '待选择模型' : 'Model pending')}`
      : (isZh ? '未选择供应商' : 'No provider selected'),
    selectedProviderStatus: selectedProviderCard
      ? getProviderStatusLabel(selectedProviderCard, host, isZh)
      : (isZh ? '未绑定' : 'Unbound'),
    providerOptions: buildProviderOptions(host),
    providerModels: Array.isArray(selectedProviderCard?.models)
      ? selectedProviderCard.models.map((item) => ({
          value: getProviderOptionValue(host, item),
          label: getProviderOptionLabel(host, item),
        })).filter((item) => item.value)
      : [],
    model: String(section?.model || ''),
    base_url: String(section?.base_url || ''),
    api_key: String(section?.api_key || ''),
    temperature: section?.temperature,
    max_tokens: section?.max_tokens,
    top_p: section?.top_p,
    reasoning_effort: section?.reasoning_effort,
    enabled: typeof section?.enabled === 'boolean' ? section.enabled : null,
  };
}

function createSnapshot() {
  const host = getHostApp();
  const isZh = isCurrentLanguageZh(host);
  const tabs = Array.isArray(host?.modelTiles)
    ? host.modelTiles.map((tile) => ({
        id: String(tile?.id || ''),
        label: getModelSlotLabel(tile?.id, isZh),
      }))
    : [];
  const activeTab = String(host?.subMenu || 'service');
  const draft = host?.newProviderTemp || {};
  return {
    isZh,
    activeMenu: String(host?.activeMenu || ''),
    activeTab,
    tabs,
    service: {
      providers: getProviders(host, isZh),
      current: getServicePanel(host, isZh),
      totalConfigured: host && typeof host.getPrototypeProviderReadyCount === 'function'
        ? host.getPrototypeProviderReadyCount()
        : (getConfiguredProviders(host).length),
      totalTemplates: getTemplateProviders(host).length,
      currentMainId: String(host?.settings?.selectedProvider || '').trim(),
    },
    addDialog: {
      visible: !!host?.showAddDialog,
      vendor: String(draft?.vendor || '').trim(),
      url: String(draft?.url || '').trim(),
      apiKey: String(draft?.apiKey || '').trim(),
      modelId: String(draft?.modelId || '').trim(),
      vendorOptions: buildVendorOptions(host, isZh),
      validProvider: !!host?.validProvider,
      websiteUrl: String(host?.vendorAPIpage?.[draft?.vendor || ''] || '').trim(),
    },
    slots: [
      createSlotConfig(host, 'main', isZh),
      createSlotConfig(host, 'fast', isZh),
      createSlotConfig(host, 'reasoner', isZh),
      createSlotConfig(host, 'vision', isZh),
      createSlotConfig(host, 'text2img', isZh),
      createSlotConfig(host, 'asr', isZh),
      createSlotConfig(host, 'tts', isZh),
    ],
  };
}

// —— per-provider helpers（每张卡独立编辑） ——
function findProviderById(host, providerId) {
  const id = String(providerId || '').trim();
  if (!id) return null;
  return (Array.isArray(host?.modelProviders) ? host.modelProviders : [])
    .find((item) => String(item?.id || '') === id) || null;
}

async function selectTab(tabId) {
  const host = getHostApp();
  if (!host) return;
  host.activeMenu = 'model-config';
  host.subMenu = tabId;
}

async function prepareAddProvider() {
  const host = getHostApp();
  if (!host) return;
  host.activeMenu = 'model-config';
  host.subMenu = 'service';
  const templates = getTemplateProviders(host);
  const firstTemplate = templates[0] || null;
  if (firstTemplate?.id) {
    setServiceSelectionId(host, firstTemplate.id);
    if (typeof host.handleSelectVendor === 'function') {
      host.handleSelectVendor(firstTemplate.setupVendor || firstTemplate.vendor || 'custom');
    }
  }
}

async function selectProviderCard(providerId) {
  const host = getHostApp();
  if (!host) return;
  const source = [...getConfiguredProviders(host), ...getTemplateProviders(host)];
  const provider = source.find((item) => String(item?.id || '') === String(providerId || ''));
  if (!provider) return;
  setServiceSelectionId(host, provider.id);
  if (provider.isTemplate && typeof host.handleSelectVendor === 'function') {
    host.handleSelectVendor(provider.setupVendor || provider.vendor || 'custom');
  }
}

async function updateServiceField(field, value) {
  const host = getHostApp();
  if (!host) return;
  const current = getCurrentServiceProvider(host);
  if (current?.isTemplate) {
    host.newProviderTemp[field] = value;
  } else if (current) {
    current[field] = value;
    if (typeof host.handleProviderDraftChange === 'function') {
      await host.handleProviderDraftChange(current.id);
      return;
    }
  }
  if (typeof host.autoSaveSettings === 'function') {
    await host.autoSaveSettings();
  }
}

async function selectServiceVendor(value) {
  const host = getHostApp();
  if (!host || typeof host.handleSelectVendor !== 'function') return;
  host.handleSelectVendor(value);
}

async function saveServiceProvider() {
  const host = getHostApp();
  if (!host) return { ok: false };
  const current = getCurrentServiceProvider(host);
  if (current?.isTemplate && typeof host.confirmAddProvider === 'function') {
    const draftProvider = {
      vendor: String(host?.newProviderTemp?.vendor || current?.vendor || '').trim(),
      url: String(host?.newProviderTemp?.url || current?.url || '').trim(),
      apiKey: String(host?.newProviderTemp?.apiKey || current?.apiKey || '').trim(),
      modelId: String(host?.newProviderTemp?.modelId || current?.modelId || '').trim(),
    };
    const currentIdentity = typeof host?.buildProviderCardIdentity === 'function'
      ? String(host.buildProviderCardIdentity(draftProvider) || '').trim()
      : `${draftProvider.vendor.toLowerCase()}::${draftProvider.url.replace(/\/+$/, '').toLowerCase()}::${draftProvider.modelId.toLowerCase()}`;
    const previousProviderIds = new Set(
      (Array.isArray(host.modelProviders) ? host.modelProviders : [])
        .map((provider) => String(provider?.id || '').trim())
        .filter(Boolean)
    );
    await host.confirmAddProvider();
    const addedProvider = (Array.isArray(host.modelProviders) ? host.modelProviders : []).find((provider) => {
      const providerIdentity = typeof host?.buildProviderCardIdentity === 'function'
        ? String(host.buildProviderCardIdentity(provider) || '').trim()
        : `${String(provider?.vendor || '').trim().toLowerCase()}::${String(provider?.url || '').trim().replace(/\/+$/, '').toLowerCase()}::${String(provider?.modelId || '').trim().toLowerCase()}`;
      return providerIdentity && providerIdentity === currentIdentity;
    }) || (Array.isArray(host.modelProviders)
      ? host.modelProviders.find((provider) => !previousProviderIds.has(String(provider?.id || '').trim()))
      : null) || ((Array.isArray(host.modelProviders) ? host.modelProviders : [])[0] || null);
    if (addedProvider?.id) {
      setServiceSelectionId(host, addedProvider.id);
      if (typeof host.selectModelProviderForUiplan === 'function') {
        host.selectModelProviderForUiplan(addedProvider);
      }
      return {
        ok: true,
        providerId: String(addedProvider.id),
        mode: 'added',
      };
    }
    return { ok: false };
  } else if (current && typeof host.applyProviderCardToMain === 'function') {
    await host.applyProviderCardToMain(current);
    setServiceSelectionId(host, current.id);
    return {
      ok: true,
      providerId: String(current.id || ''),
      mode: 'applied',
    };
  }
  return { ok: false };
}

async function validateCurrentProvider() {
  const host = getHostApp();
  if (!host) return;
  const current = getCurrentServiceProvider(host);
  if (current && typeof host.validateProviderCard === 'function') {
    await host.validateProviderCard(current);
  }
}

async function fetchCurrentProviderModels() {
  const host = getHostApp();
  if (!host) return;
  const current = getCurrentServiceProvider(host);
  if (current && typeof host.fetchModelsForProvider === 'function') {
    await host.fetchModelsForProvider(current);
  }
}

async function copyCurrentProvider() {
  const host = getHostApp();
  if (!host) return;
  const current = getCurrentServiceProvider(host);
  if (current?.id && typeof host.copyProviderById === 'function') {
    host.copyProviderById(current.id);
  }
}

async function removeCurrentProvider() {
  const host = getHostApp();
  if (!host) return;
  const current = getCurrentServiceProvider(host);
  if (current?.id && typeof host.removeProviderById === 'function') {
    await host.removeProviderById(current.id);
    const nextProvider = [...getConfiguredProviders(host), ...getTemplateProviders(host)][0] || null;
    setServiceSelectionId(host, nextProvider?.id || '');
  }
}

function openCurrentProviderWebsite() {
  const host = getHostApp();
  if (!host) return;
  const current = getCurrentServiceProvider(host);
  if (current && typeof host.goToURL === 'function') {
    host.goToURL(current);
  }
}

async function selectSlotProvider(slotId, providerId) {
  const host = getHostApp();
  if (!host) return;
  const methodMap = {
    main: 'selectMainProvider',
    fast: 'selectFastProvider',
    reasoner: 'selectReasonerProvider',
    vision: 'selectVisionProvider',
    text2img: 'selectText2imgProvider',
    asr: 'selectAsrProvider',
    tts: 'selectTTSProvider',
  };
  const methodName = methodMap[slotId];
  if (methodName && typeof host[methodName] === 'function') {
    await host[methodName](providerId || null);
  }
}

// —— per-provider actions：让磁贴可独立编辑 / 操作 ——
async function updateProviderFieldById(providerId, field, value) {
  const host = getHostApp();
  if (!host) return;
  const provider = findProviderById(host, providerId);
  if (!provider) return;
  provider[field] = value;
  if (typeof host.handleProviderDraftChange === 'function') {
    await host.handleProviderDraftChange(provider.id);
    return;
  }
  if (typeof host.autoSaveSettings === 'function') {
    await host.autoSaveSettings();
  }
}

async function selectProviderAsMain(providerId) {
  const host = getHostApp();
  if (!host) return;
  if (typeof host.selectMainProvider === 'function') {
    await host.selectMainProvider(String(providerId || '').trim());
  } else if (host.settings) {
    host.settings.selectedProvider = String(providerId || '').trim();
    if (typeof host.autoSaveSettings === 'function') {
      await host.autoSaveSettings();
    }
  }
}

async function validateProviderById(providerId) {
  const host = getHostApp();
  if (!host) return;
  const provider = findProviderById(host, providerId);
  if (provider && typeof host.validateProviderCard === 'function') {
    await host.validateProviderCard(provider);
  }
}

async function fetchModelsById(providerId) {
  const host = getHostApp();
  if (!host) return;
  const provider = findProviderById(host, providerId);
  if (provider && typeof host.fetchModelsForProvider === 'function') {
    await host.fetchModelsForProvider(provider);
  }
}

async function copyProviderById(providerId) {
  const host = getHostApp();
  if (!host) return;
  if (typeof host.copyProviderById === 'function') {
    host.copyProviderById(String(providerId || '').trim());
  }
}

async function removeProviderById(providerId) {
  const host = getHostApp();
  if (!host) return;
  if (typeof host.removeProviderById === 'function') {
    await host.removeProviderById(String(providerId || '').trim());
  }
}

function openProviderWebsiteById(providerId) {
  const host = getHostApp();
  if (!host) return;
  const provider = findProviderById(host, providerId);
  if (provider && typeof host.goToURL === 'function') {
    host.goToURL(provider);
  }
}

function copyToClipboard(text) {
  const value = String(text || '');
  if (!value) return;
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    navigator.clipboard.writeText(value).catch(() => {});
    return;
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand && document.execCommand('copy');
    document.body.removeChild(textarea);
  } catch (error) { /* noop */ }
}

// —— Add Provider Dialog actions ——
function openAddDialog() {
  const host = getHostApp();
  if (!host) return;
  host.newProviderTemp = { vendor: '', url: '', apiKey: '', modelId: '' };
  host.showAddDialog = true;
}

function closeAddDialog() {
  const host = getHostApp();
  if (!host) return;
  host.showAddDialog = false;
}

function selectVendorInDialog(vendor) {
  const host = getHostApp();
  if (!host) return;
  if (typeof host.handleSelectVendor === 'function') {
    host.handleSelectVendor(String(vendor || '').trim());
    return;
  }
  if (!host.newProviderTemp) host.newProviderTemp = { vendor: '', url: '', apiKey: '', modelId: '' };
  host.newProviderTemp.vendor = String(vendor || '').trim();
  if (typeof host.handleVendorChange === 'function') {
    host.handleVendorChange(host.newProviderTemp.vendor);
  }
}

function setDialogField(field, value) {
  const host = getHostApp();
  if (!host) return;
  if (!host.newProviderTemp) host.newProviderTemp = { vendor: '', url: '', apiKey: '', modelId: '' };
  host.newProviderTemp[field] = value;
}

async function confirmAddDialog() {
  const host = getHostApp();
  if (!host) return false;
  if (typeof host.confirmAddProvider === 'function') {
    await host.confirmAddProvider();
    return true;
  }
  return false;
}

function openVendorWebsiteFromDialog() {
  const host = getHostApp();
  if (!host) return;
  const vendor = String(host?.newProviderTemp?.vendor || '').trim();
  const url = String(host?.vendorAPIpage?.[vendor] || '').trim();
  if (url && typeof host.goToURL === 'function') {
    host.goToURL({ url });
  } else if (url && typeof window !== 'undefined') {
    try { window.open(url, '_blank'); } catch (e) { /* noop */ }
  }
}

async function updateSlotField(slotId, field, value) {
  const host = getHostApp();
  if (!host) return;
  const sectionMap = {
    main: host.settings,
    fast: host.fastSettings,
    reasoner: host.reasonerSettings,
    vision: host.visionSettings,
    text2img: host.text2imgSettings,
    asr: host.asrSettings,
    tts: host.ttsSettings,
  };
  const section = sectionMap[slotId];
  if (!section) return;
  section[field] = value;
  if (typeof host.autoSaveSettings === 'function') {
    await host.autoSaveSettings();
  }
}

export function createModelBridge() {
  return {
    snapshot: createSnapshot,
    selectTab,
    prepareAddProvider,
    selectProviderCard,
    updateServiceField,
    selectServiceVendor,
    saveServiceProvider,
    validateCurrentProvider,
    fetchCurrentProviderModels,
    copyCurrentProvider,
    removeCurrentProvider,
    openCurrentProviderWebsite,
    // 新增：per-provider 与 Add Dialog
    updateProviderFieldById,
    selectProviderAsMain,
    validateProviderById,
    fetchModelsById,
    copyProviderById,
    removeProviderById,
    openProviderWebsiteById,
    copyToClipboard,
    openAddDialog,
    closeAddDialog,
    selectVendorInDialog,
    setDialogField,
    confirmAddDialog,
    openVendorWebsiteFromDialog,
    selectSlotProvider,
    updateSlotField,
  };
}
