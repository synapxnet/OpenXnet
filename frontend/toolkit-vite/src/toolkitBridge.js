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

function getTileLabel(host, tile) {
  if (!tile) return '';
  if (host && typeof host.t === 'function') {
    try {
      const translated = host.t(tile.title);
      return translated || tile.label || tile.id || '';
    } catch (error) {
      return tile.label || tile.id || '';
    }
  }
  return tile.label || tile.id || '';
}

const ICON_COLOR_BY_SECTION = {
  'toolkit-builtin': 'green',
  'toolkit-assets': 'purple',
  'toolkit-custom': 'orange',
  'toolkit-integrations': 'blue',
  'toolkit-protocol': 'accent',
  'toolkit-workbench': 'gray',
};

const ICON_COLOR_BY_ID = {
  websearch: 'green',
  interpreter: 'green',
  CLI: 'green',
  document: 'purple',
  sticker: 'pink',
  llmTool: 'orange',
  customHttpTool: 'orange',
  HA: 'blue',
  chromeMCP: 'blue',
  sql: 'blue',
  comfyui: 'blue',
  mcp: 'accent',
  a2a: 'accent',
};

const TOOL_BUTTON_BY_ID = {
  sticker: 'stickerButton',
  llmTool: 'llmButton',
  customHttpTool: 'httpButton',
  mcp: 'mcpButton',
  a2a: 'a2aButton',
  comfyui: 'comfyuiButton',
};

function getMoreButtonEntries(host, name) {
  if (!name) return [];
  const seen = new Set();
  const entries = [];
  [
    host?.MoreButtonDict,
    host?.largeMoreButtonDict,
    host?.smallMoreButtonDict,
  ].forEach((items) => {
    if (!Array.isArray(items)) return;
    items.forEach((item) => {
      if (!item || item.name !== name || seen.has(item)) return;
      seen.add(item);
      entries.push(item);
    });
  });
  return entries;
}

function getMoreButtonEntry(host, name) {
  return getMoreButtonEntries(host, name)[0] || null;
}

function isToggleSupported(host, id) {
  const targetId = String(id || '').trim();
  if (['websearch', 'interpreter', 'CLI', 'document', 'HA', 'chromeMCP', 'sql'].includes(targetId)) {
    return true;
  }
  return !!getMoreButtonEntry(host, TOOL_BUTTON_BY_ID[targetId]);
}

function enabledForTool(host, id) {
  const targetId = String(id || '').trim();
  switch (targetId) {
    case 'websearch':
      return !!host?.webSearchSettings?.enabled;
    case 'interpreter':
      return !!host?.codeSettings?.enabled;
    case 'CLI':
      return !!host?.CLISettings?.enabled;
    case 'document':
      if (typeof host?.KBSettings?.enabled === 'boolean') {
        return !!host.KBSettings.enabled;
      }
      return Array.isArray(host?.knowledgeBases)
        ? host.knowledgeBases.some((kb) => kb && kb.enabled !== false)
        : false;
    case 'HA':
      return !!host?.HASettings?.enabled;
    case 'chromeMCP':
      return !!host?.chromeMCPSettings?.enabled;
    case 'sql':
      return !!host?.sqlSettings?.enabled;
    default: {
      const entry = getMoreButtonEntry(host, TOOL_BUTTON_BY_ID[targetId]);
      return !!entry?.enabled;
    }
  }
}

function deriveStatus(host, id) {
  const targetId = String(id || '').trim();
  const boolMap = {
    websearch: host?.webSearchSettings?.enabled,
    interpreter: host?.codeSettings?.enabled,
    CLI: host?.CLISettings?.enabled,
    HA: host?.HASettings?.enabled,
    chromeMCP: host?.chromeMCPSettings?.enabled,
    sql: host?.sqlSettings?.enabled,
  };
  if (typeof boolMap[targetId] === 'boolean') {
    return boolMap[targetId] ? 'running' : 'installed';
  }
  if (targetId === 'document') {
    return Array.isArray(host?.knowledgeBases) && host.knowledgeBases.length > 0 ? 'running' : 'installed';
  }
  if (targetId === 'comfyui') {
    return Array.isArray(host?.comfyuiServers) && host.comfyuiServers.length > 0 ? 'running' : 'installed';
  }
  if (targetId === 'mcp') {
    return Object.keys(host?.mcpServers || {}).length > 0 ? 'running' : 'installed';
  }
  if (targetId === 'a2a') {
    return Object.keys(host?.a2aServers || {}).length > 0 ? 'running' : 'installed';
  }
  if (targetId === 'llmTool') {
    return Array.isArray(host?.llmTools) && host.llmTools.length > 0 ? 'running' : 'installed';
  }
  if (targetId === 'customHttpTool') {
    return Array.isArray(host?.customHttpTools) && host.customHttpTools.length > 0 ? 'running' : 'installed';
  }
  if (targetId === 'sticker') {
    return Array.isArray(host?.stickerPacks) && host.stickerPacks.length > 0 ? 'running' : 'installed';
  }
  return 'installed';
}

function statusLabel(host, status, id, isZh) {
  if (host && typeof host.getPrototypeToolkitStatusLabel === 'function') {
    try {
      const label = host.getPrototypeToolkitStatusLabel(id);
      if (label) return label;
    } catch (error) {
      /* ignore */
    }
  }
  if (status === 'running') return isZh ? '运行中' : 'Running';
  if (status === 'not-installed') return isZh ? '未安装' : 'Not installed';
  return isZh ? '已安装' : 'Installed';
}

function descriptionFor(host, id, isZh) {
  const targetId = String(id || '').trim();
  const map = isZh
    ? {
        websearch: 'DuckDuckGo / Tavily / SearXNG 搜索链路统一入口',
        interpreter: '代码执行、沙箱与计算型推理',
        CLI: '本地、Docker、Claude Code、Codex、Qwen 环境',
        document: '向量库检索、重排与知识工作流',
        sticker: '贴纸 / 角色素材 / 图像资源',
        llmTool: '自定义模型侧工具入口',
        customHttpTool: '自定义 HTTP/REST 接口工具',
        HA: 'Home Assistant 智能家居自动化',
        chromeMCP: '内置浏览器与 Browser MCP / Playwright',
        sql: 'SQLite / MySQL / Postgres 结构化查询',
        comfyui: 'ComfyUI 节点工作流与图像生成',
        mcp: 'Model Context Protocol 服务管理',
        a2a: 'Agent-to-Agent 协同节点',
      }
    : {
        websearch: 'DuckDuckGo / Tavily / SearXNG search routes',
        interpreter: 'Code execution, sandbox & compute reasoning',
        CLI: 'Local, Docker, Claude Code, Codex, Qwen runtimes',
        document: 'Vector retrieval, reranking and knowledge flow',
        sticker: 'Stickers, role assets & media resources',
        llmTool: 'Custom model-side tool surface',
        customHttpTool: 'Custom HTTP/REST tool surface',
        HA: 'Home Assistant smart home automation',
        chromeMCP: 'Internal browser + Browser MCP / Playwright',
        sql: 'SQLite / MySQL / Postgres structured queries',
        comfyui: 'ComfyUI workflow & image generation',
        mcp: 'Model Context Protocol service manager',
        a2a: 'Agent-to-Agent collaboration nodes',
      };
  if (map[targetId]) return map[targetId];
  if (host && typeof host.getPrototypeToolkitDetailMeta === 'function') {
    try {
      const meta = host.getPrototypeToolkitDetailMeta(targetId);
      if (meta?.summary) return String(meta.summary);
    } catch (error) {
      /* ignore */
    }
  }
  return isZh ? '此工具尚未提供描述。' : 'No description available yet.';
}

function detailGuideFor(id, isZh) {
  const targetId = String(id || '').trim();
  const guideMap = {
    websearch: {
      introZh: '联网搜索为实时对话、研究和资料核验提供外部检索能力，可选择 DuckDuckGo、Tavily、SearXNG 等搜索链路。',
      introEn: 'Web search adds external retrieval to live chat, research, and fact checking with engines such as DuckDuckGo, Tavily, and SearXNG.',
      setupZh: ['选择搜索引擎和网页抓取器。', '需要 API Key 的服务先在对应服务商官网创建密钥。', '设置注入时机，决定搜索结果在模型推理前还是推理后进入上下文。'],
      setupEn: ['Choose a search engine and crawler.', 'Create API keys on vendor sites when the service requires one.', 'Set when retrieved content is injected into the model context.'],
      links: [
        { label: 'Tavily', url: 'https://tavily.com/' },
        { label: 'SearXNG', url: 'https://docs.searxng.org/' },
        { label: 'DuckDuckGo', url: 'https://duckduckgo.com/' },
      ],
    },
    interpreter: {
      introZh: '代码解释器让模型可以执行代码、计算数据和处理文件，适合分析、转换、绘图和自动化任务。',
      introEn: 'The code interpreter lets the model run code, compute data, and process files for analysis, conversion, plotting, and automation.',
      setupZh: ['选择执行引擎。', '使用 E2B 时填写 API Key。', '使用自建沙箱时填写 Sandbox URL 并确认网络可访问。'],
      setupEn: ['Choose an execution engine.', 'Fill the E2B API key when using E2B.', 'For a self-hosted sandbox, enter the Sandbox URL and verify connectivity.'],
      links: [
        { label: 'E2B', url: 'https://e2b.dev/' },
        { label: 'Docker', url: 'https://www.docker.com/' },
      ],
    },
    CLI: {
      introZh: 'CLI 工具把本地工作区、Docker 沙箱和代码智能体连接到对话中，用于项目操作、文件修改和命令执行。',
      introEn: 'CLI tools connect local workspaces, Docker sandboxes, and coding agents to chat for project operations, file edits, and command execution.',
      setupZh: ['选择 CLI 引擎。', '填写工作区路径。', '确认权限模式和可见范围，避免工具越界访问。'],
      setupEn: ['Select a CLI engine.', 'Set the workspace path.', 'Review permission mode and visibility scope to keep access bounded.'],
      links: [
        { label: 'Claude Code', url: 'https://docs.anthropic.com/en/docs/claude-code' },
        { label: 'OpenAI Codex', url: 'https://openai.com/codex/' },
      ],
    },
    document: {
      introZh: '知识库工具把本地文档、向量检索和重排能力接入对话，让模型按需引用已有资料。',
      introEn: 'Knowledge tools connect local documents, vector retrieval, and reranking so the model can cite existing material when needed.',
      setupZh: ['先在知识库菜单创建并启用知识库。', '设置返回片段数量。', '按需要开启重排并选择检索注入时机。'],
      setupEn: ['Create and enable knowledge bases in the Knowledge Base menu first.', 'Set how many chunks are returned.', 'Enable rerank and choose retrieval timing when needed.'],
      links: [
        { label: 'Qdrant', url: 'https://qdrant.tech/' },
        { label: 'Milvus', url: 'https://milvus.io/' },
      ],
    },
    sticker: {
      introZh: '贴纸/图片库用于维护角色素材、表情包和图像资源，方便聊天与生成流程复用。',
      introEn: 'Sticker and image libraries keep role assets, sticker packs, and media resources reusable across chat and generation workflows.',
      setupZh: ['导入贴纸包或图片素材。', '开启需要在聊天中使用的素材包。', '保持角色素材命名清晰，便于检索。'],
      setupEn: ['Import sticker packs or image assets.', 'Enable packs that should be available in chat.', 'Use clear names so assets are easy to retrieve.'],
      links: [
        { label: 'OpenXnet 素材库', url: 'https://openxnet.synapxnet.com/' },
      ],
    },
    llmTool: {
      introZh: 'LLM 工具用于注册模型侧工具入口，把自定义能力暴露给对话模型调用。',
      introEn: 'LLM tools register model-side capabilities and expose custom functions to the chat model.',
      setupZh: ['创建工具名称和描述。', '填写 Base URL、API Key 和工具 schema。', '启用后在实时对话中测试调用。'],
      setupEn: ['Create a tool name and description.', 'Fill Base URL, API key, and tool schema.', 'Enable it and test calls in Live Chat.'],
      links: [
        { label: 'OpenAI Function Calling', url: 'https://platform.openai.com/docs/guides/function-calling' },
      ],
    },
    customHttpTool: {
      introZh: 'HTTP 工具把 REST 接口接入 OpenXnet，适合企业内部 API、Webhook 和自动化服务。',
      introEn: 'HTTP tools connect REST endpoints to OpenXnet for internal APIs, webhooks, and automation services.',
      setupZh: ['填写接口地址、方法和请求头。', '配置参数模板和响应解析。', '用测试请求确认返回结构稳定。'],
      setupEn: ['Fill endpoint URL, method, and headers.', 'Configure parameter templates and response parsing.', 'Run a test request to verify the response shape.'],
      links: [
        { label: 'REST API', url: 'https://restfulapi.net/' },
      ],
    },
    HA: {
      introZh: 'Home Assistant 用于连接智能家居，实现设备状态读取、自动化触发和场景控制。',
      introEn: 'Home Assistant connects smart-home devices for state lookup, automation triggers, and scene control.',
      setupZh: ['填写 Home Assistant 服务地址。', '在 Home Assistant 中创建长期访问令牌。', '保存后测试设备列表和自动化权限。'],
      setupEn: ['Enter the Home Assistant service URL.', 'Create a long-lived access token in Home Assistant.', 'Save and test device list and automation permissions.'],
      links: [
        { label: 'Home Assistant', url: 'https://www.home-assistant.io/' },
      ],
    },
    chromeMCP: {
      introZh: '浏览器控制连接内置浏览器、外部 Browser MCP 或 Playwright，用于网页观察和自动化操作。',
      introEn: 'Browser control connects the internal browser, external Browser MCP, or Playwright for web observation and automation.',
      setupZh: ['选择内置浏览器或外部 MCP。', '外部模式填写 MCP 名称和 CDP 端口。', '确认浏览器调试端口可用。'],
      setupEn: ['Choose internal browser or external MCP.', 'For external mode, fill MCP name and CDP port.', 'Verify that the browser debugging port is available.'],
      links: [
        { label: 'Playwright', url: 'https://playwright.dev/' },
        { label: 'Chrome DevTools Protocol', url: 'https://chromedevtools.github.io/devtools-protocol/' },
      ],
    },
    sql: {
      introZh: '数据库工具为 SQLite、Postgres、MySQL 等结构化数据提供查询入口。',
      introEn: 'Database tools provide structured-query access to SQLite, Postgres, MySQL, and related stores.',
      setupZh: ['选择数据库引擎。', '填写主机、端口、数据库名或本地 DB 路径。', '建议使用只读账号连接生产数据。'],
      setupEn: ['Choose the database engine.', 'Fill host, port, database name, or local DB path.', 'Use read-only accounts for production data whenever possible.'],
      links: [
        { label: 'SQLite', url: 'https://sqlite.org/' },
        { label: 'PostgreSQL', url: 'https://www.postgresql.org/' },
        { label: 'MySQL', url: 'https://www.mysql.com/' },
      ],
    },
    comfyui: {
      introZh: 'ComfyUI 让 OpenXnet 调用节点工作流、图像生成和图像处理服务。',
      introEn: 'ComfyUI lets OpenXnet call node workflows for image generation and image processing.',
      setupZh: ['启动 ComfyUI 服务。', '确认服务地址，例如 127.0.0.1:8188。', '在 ComfyUI 中准备工作流和节点资源。'],
      setupEn: ['Start the ComfyUI service.', 'Verify the service endpoint, for example 127.0.0.1:8188.', 'Prepare workflows and node resources in ComfyUI.'],
      links: [
        { label: 'ComfyUI', url: 'https://github.com/comfyanonymous/ComfyUI' },
        { label: '默认本地地址', url: 'http://127.0.0.1:8188/' },
      ],
    },
    mcp: {
      introZh: 'MCP 服务器把外部工具、文件系统、浏览器和业务系统以统一协议接入 OpenXnet。',
      introEn: 'MCP servers connect external tools, filesystems, browsers, and business systems to OpenXnet through a common protocol.',
      setupZh: ['添加 MCP 服务配置。', '确认命令、环境变量和工具列表。', '启用后在实时对话里验证工具调用。'],
      setupEn: ['Add MCP server configuration.', 'Review command, environment variables, and tool list.', 'Enable and verify tool calls in Live Chat.'],
      links: [
        { label: 'Model Context Protocol', url: 'https://modelcontextprotocol.io/' },
      ],
    },
    a2a: {
      introZh: 'A2A 服务用于连接外部智能体节点，让多个智能体之间可以协作。',
      introEn: 'A2A services connect external agent nodes so multiple agents can collaborate.',
      setupZh: ['添加 A2A 服务地址。', '检查节点状态和能力清单。', '在需要多智能体协作的任务中启用。'],
      setupEn: ['Add the A2A service endpoint.', 'Check node status and capability list.', 'Enable it for multi-agent collaboration tasks.'],
      links: [
        { label: 'A2A Protocol', url: 'https://google.github.io/A2A/' },
      ],
    },
  };
  const guide = guideMap[targetId] || {
    introZh: '此工具提供 OpenXnet 扩展能力，配置后可在对话、自动化或工作流中使用。',
    introEn: 'This tool extends OpenXnet and can be used in chat, automation, or workflows after configuration.',
    setupZh: ['打开对应配置项。', '填写必要地址、密钥或运行参数。', '保存后回到实时对话验证。'],
    setupEn: ['Open the matching configuration lane.', 'Fill required endpoints, keys, or runtime parameters.', 'Save and verify from Live Chat.'],
    links: [{ label: 'OpenXnet', url: 'https://openxnet.synapxnet.com/' }],
  };
  return {
    intro: isZh ? guide.introZh : guide.introEn,
    setupSteps: isZh ? guide.setupZh : guide.setupEn,
    links: guide.links || [],
  };
}

function versionFor(id) {
  return 'v1.0.0';
}

function buildSection(host, isZh) {
  if (host && typeof host.getPrototypeToolkitSubnavSections === 'function') {
    return host.getPrototypeToolkitSubnavSections(host.toolkitTiles || []).map((section) => ({
      id: section.id,
      label: section.label || '',
      items: (section.items || [])
        .filter((item) => item && item.id !== 'tools')
        .map((item) => {
          const id = String(item.id || '');
          const status = deriveStatus(host, id);
          return {
            id,
            label: item.label || getTileLabel(host, item),
            icon: item.icon || 'fa-solid fa-circle',
            targetMenu: item.targetMenu || '',
            targetSubMenu: item.targetSubMenu || '',
            status,
            iconColor: ICON_COLOR_BY_ID[id] || ICON_COLOR_BY_SECTION[section.id] || 'gray',
          };
        }),
    })).filter((section) => section.items.length > 0);
  }
  return [];
}

function buildCards(host, isZh) {
  let tiles = [];
  if (Array.isArray(host?.toolkitTiles)) {
    tiles = host.toolkitTiles.filter((tile) => tile && String(tile.id || '').trim() !== 'tools');
  } else if (host && typeof host.getPrototypeToolkitOverviewCards === 'function') {
    try {
      tiles = host.getPrototypeToolkitOverviewCards() || [];
    } catch (error) {
      tiles = [];
    }
  }
  const query = String(host?.toolkitOverviewQuery || '').trim().toLowerCase();
  return tiles.map((tile) => {
    const id = String(tile?.id || '').trim();
    const label = getTileLabel(host, tile);
    const status = deriveStatus(host, id);
    return {
      id,
      label,
      description: descriptionFor(host, id, isZh),
      icon: tile.icon || 'fa-solid fa-circle',
      iconColor: ICON_COLOR_BY_ID[id] || 'gray',
      status,
      statusLabel: statusLabel(host, status, id, isZh),
      canToggle: isToggleSupported(host, id),
      enabled: enabledForTool(host, id),
      toggleLabel: enabledForTool(host, id) ? (isZh ? '已开启' : 'On') : (isZh ? '已关闭' : 'Off'),
    };
  }).filter((card) => {
    if (!query) return true;
    const haystack = `${card.label} ${card.id} ${card.description}`.toLowerCase();
    return haystack.includes(query);
  });
}

function buildDetail(host, subMenu, isZh) {
  if (!subMenu || subMenu === 'tools') {
    return {
      id: 'tools',
      title: isZh ? '工具概览' : 'Tool Overview',
      icon: 'fa-solid fa-toolbox',
      iconColor: 'accent',
      description: isZh
        ? '集中查看全部工具分类、启用状态和入口，点击任一细类后在中间填写配置，右侧查看说明和相关网站。'
        : 'Review all tool categories, states, and entry points. Select a tool to configure it in the middle panel and read guidance on the right.',
      chips: [],
      status: 'installed',
      statusLabel: isZh ? '总览' : 'Overview',
      runtime: isZh ? '点击左侧细类或中间卡片进入配置。' : 'Select a category or card to configure it.',
      runtimeMeta: isZh ? '概览中的开关会直接同步到对应工具状态。' : 'Overview switches sync directly to each tool state.',
      version: versionFor('tools'),
      guide: {
        intro: isZh
          ? '工具概览用于统一观察 OpenXnet 的工具能力：内置工具、知识素材、自定义工具、外部集成和协议服务。'
          : 'Tool Overview is the control surface for built-in tools, knowledge assets, custom tools, integrations, and protocol services.',
        setupSteps: isZh
          ? ['先打开需要使用的工具开关。', '再进入具体工具填写地址、密钥或运行参数。', '最后回到实时对话验证工具调用效果。']
          : ['Turn on the tools you need.', 'Open a specific tool and fill endpoints, keys, or runtime parameters.', 'Return to Live Chat and verify tool calls.'],
        links: [{ label: 'OpenXnet', url: 'https://openxnet.synapxnet.com/' }],
      },
    };
  }
  const tile = host && typeof host.getPrototypeToolkitTile === 'function'
    ? host.getPrototypeToolkitTile(subMenu)
    : null;
  const meta = host && typeof host.getPrototypeToolkitDetailMeta === 'function'
    ? host.getPrototypeToolkitDetailMeta(subMenu)
    : null;
  const id = String(subMenu || '').trim();
  const status = deriveStatus(host, id);
  return {
    id,
    title: meta?.title || getTileLabel(host, tile) || (isZh ? '工具详情' : 'Tool Detail'),
    icon: tile?.icon || meta?.icon || 'fa-solid fa-screwdriver-wrench',
    iconColor: ICON_COLOR_BY_ID[id] || 'gray',
    description: meta?.summary || descriptionFor(host, id, isZh),
    chips: meta?.chips || [],
    status,
    statusLabel: statusLabel(host, status, id, isZh),
    runtime: host && typeof host.getPrototypeToolkitRuntimeLabel === 'function'
      ? host.getPrototypeToolkitRuntimeLabel(id)
      : '',
    runtimeMeta: host && typeof host.getPrototypeToolkitRuntimeMeta === 'function'
      ? host.getPrototypeToolkitRuntimeMeta(id)
      : '',
    version: versionFor(id),
    guide: detailGuideFor(id, isZh),
  };
}

function getDetailForm(host, subMenu, isZh) {
  switch (subMenu) {
    case 'tools':
    case '':
    case undefined:
      return {
        kind: 'overview',
        enabled: null,
        fields: {
          summary: isZh ? '选择一个工具细类后，这里会切换为该工具需要填写的配置。' : 'Select a specific tool to show its required configuration here.',
        },
      };
    case 'websearch':
      return {
        kind: 'websearch',
        enabled: !!host?.webSearchSettings?.enabled,
        fields: {
          engine: String(host?.webSearchSettings?.engine || 'tavily'),
          crawler: String(host?.webSearchSettings?.crawler || 'jina'),
          when: String(host?.webSearchSettings?.when || 'after_thinking'),
        },
      };
    case 'interpreter':
      return {
        kind: 'interpreter',
        enabled: !!host?.codeSettings?.enabled,
        fields: {
          engine: String(host?.codeSettings?.engine || 'e2b'),
          sandbox_url: String(host?.codeSettings?.sandbox_url || ''),
          e2b_api_key: String(host?.codeSettings?.e2b_api_key || ''),
        },
      };
    case 'CLI':
      return {
        kind: 'CLI',
        enabled: !!host?.CLISettings?.enabled,
        fields: {
          engine: String(host?.CLISettings?.engine || 'local'),
          workspace: String(host?.CLISettings?.cc_path || ''),
          visibilityScope: String(host?.CLISettings?.visibilityScope || 'workspace'),
          permissionMode: host && typeof host.getActiveCliPermissionModeLabel === 'function'
            ? host.getActiveCliPermissionModeLabel()
            : 'default',
        },
      };
    case 'document':
      return {
        kind: 'document',
        enabled: enabledForTool(host, 'document'),
        fields: {
          top_n: Number(host?.KBSettings?.top_n || 5),
          when: String(host?.KBSettings?.when || 'after_thinking'),
          is_rerank: !!host?.KBSettings?.is_rerank,
          kbCount: Array.isArray(host?.knowledgeBases) ? host.knowledgeBases.length : 0,
        },
      };
    case 'chromeMCP':
      return {
        kind: 'chromeMCP',
        enabled: !!host?.chromeMCPSettings?.enabled,
        fields: {
          type: String(host?.chromeMCPSettings?.type || 'external'),
          mcpName: String(host?.chromeMCPSettings?.mcpName || 'browser-mcp'),
          CDPport: Number(host?.chromeMCPSettings?.CDPport || 9222),
        },
      };
    case 'sql':
      return {
        kind: 'sql',
        enabled: !!host?.sqlSettings?.enabled,
        fields: {
          engine: String(host?.sqlSettings?.engine || 'sqlite'),
          host: String(host?.sqlSettings?.host || ''),
          port: Number(host?.sqlSettings?.port || 5432),
          dbname: String(host?.sqlSettings?.dbname || ''),
          dbpath: String(host?.sqlSettings?.dbpath || ''),
        },
      };
    case 'HA':
      return {
        kind: 'HA',
        enabled: !!host?.HASettings?.enabled,
        fields: {
          url: String(host?.HASettings?.url || ''),
          token: String(host?.HASettings?.token || ''),
        },
      };
    case 'comfyui':
      return {
        kind: 'comfyui',
        enabled: enabledForTool(host, 'comfyui'),
        fields: {
          endpoint: String(host?.activeComfyUIUrl || host?.comfyuiServers?.[0] || 'http://127.0.0.1:8188'),
          serverCount: Array.isArray(host?.comfyuiServers) ? host.comfyuiServers.length : 0,
        },
      };
    case 'mcp':
      return {
        kind: 'mcp',
        enabled: enabledForTool(host, 'mcp'),
        fields: {
          serverCount: Object.keys(host?.mcpServers || {}).length,
          enabledCount: Object.values(host?.mcpServers || {}).filter((server) => !server?.disabled).length,
        },
      };
    case 'a2a':
      return {
        kind: 'a2a',
        enabled: enabledForTool(host, 'a2a'),
        fields: {
          serverCount: Object.keys(host?.a2aServers || {}).length,
          enabledCount: Object.values(host?.a2aServers || {}).filter((server) => server?.enabled).length,
        },
      };
    case 'llmTool':
      return {
        kind: 'llmTool',
        enabled: enabledForTool(host, 'llmTool'),
        fields: {
          toolCount: Array.isArray(host?.llmTools) ? host.llmTools.length : 0,
          enabledCount: Array.isArray(host?.llmTools) ? host.llmTools.filter((tool) => tool?.enabled).length : 0,
        },
      };
    case 'customHttpTool':
      return {
        kind: 'customHttpTool',
        enabled: enabledForTool(host, 'customHttpTool'),
        fields: {
          toolCount: Array.isArray(host?.customHttpTools) ? host.customHttpTools.length : 0,
          enabledCount: Array.isArray(host?.customHttpTools) ? host.customHttpTools.filter((tool) => tool?.enabled).length : 0,
        },
      };
    case 'sticker':
      return {
        kind: 'sticker',
        enabled: enabledForTool(host, 'sticker'),
        fields: {
          packCount: Array.isArray(host?.stickerPacks) ? host.stickerPacks.length : 0,
          enabledCount: Array.isArray(host?.stickerPacks) ? host.stickerPacks.filter((pack) => pack?.enabled).length : 0,
        },
      };
    default:
      return {
        kind: subMenu || '',
        enabled: null,
        fields: {
          summary: isZh ? '该工具暂时由其他控制台维护，详细配置请前往对应模块。' : 'This tool is configured in another control surface; jump to the dedicated module for full options.',
        },
      };
  }
}

function createSnapshot() {
  const host = getHostApp();
  const isZh = isCurrentLanguageZh(host);
  const subMenu = String(host?.subMenu || 'tools');
  return {
    isZh,
    activeMenu: String(host?.activeMenu || ''),
    activeSubMenu: subMenu,
    sections: buildSection(host, isZh),
    cards: buildCards(host, isZh),
    detail: buildDetail(host, subMenu, isZh),
    detailForm: getDetailForm(host, subMenu, isZh),
    searchQuery: String(host?.toolkitOverviewQuery || ''),
    collapsedSections: Array.isArray(host?.prototypeToolkitCollapsedSections)
      ? host.prototypeToolkitCollapsedSections.slice()
      : [],
  };
}

async function selectSubMenu(item) {
  const host = getHostApp();
  if (!host || !item) return;
  if (item.targetMenu && typeof host.handleSelect === 'function') {
    await host.handleSelect(item.targetMenu);
    if (item.targetSubMenu) {
      host.subMenu = item.targetSubMenu;
    }
    return;
  }
  host.activeMenu = 'toolkit';
  host.subMenu = item.id;
}

async function openDetail(id) {
  const host = getHostApp();
  if (!host || !id) return;
  host.activeMenu = 'toolkit';
  host.subMenu = String(id);
}

function setSearchQuery(value) {
  const host = getHostApp();
  if (!host) return;
  host.toolkitOverviewQuery = String(value || '');
}

function toggleSectionCollapse(sectionId) {
  const host = getHostApp();
  if (!host) return;
  if (!Array.isArray(host.prototypeToolkitCollapsedSections)) {
    host.prototypeToolkitCollapsedSections = [];
  }
  const list = host.prototypeToolkitCollapsedSections;
  const idx = list.indexOf(sectionId);
  if (idx === -1) {
    list.push(sectionId);
  } else {
    list.splice(idx, 1);
  }
}

async function updateField(subMenu, field, value) {
  const host = getHostApp();
  if (!host) return;
  switch (subMenu) {
    case 'websearch':
      host.webSearchSettings[field] = value;
      break;
    case 'interpreter':
      host.codeSettings[field] = value;
      break;
    case 'CLI':
      if (field === 'workspace') host.CLISettings.cc_path = value;
      else host.CLISettings[field] = value;
      break;
    case 'document':
      host.KBSettings[field] = value;
      break;
    case 'chromeMCP':
      host.chromeMCPSettings[field] = value;
      break;
    case 'sql':
      host.sqlSettings[field] = value;
      break;
    case 'HA':
      host.HASettings[field] = value;
      break;
    case 'comfyui':
      if (field === 'endpoint') {
        const endpoint = String(value || '');
        host.activeComfyUIUrl = endpoint;
        if (!Array.isArray(host.comfyuiServers)) {
          host.comfyuiServers = [];
        }
        if (host.comfyuiServers.length === 0) {
          host.comfyuiServers.push(endpoint);
        } else {
          host.comfyuiServers[0] = endpoint;
        }
      }
      break;
    default:
      return;
  }
  if (typeof host.autoSaveSettings === 'function') {
    await host.autoSaveSettings();
  }
}

async function toggleEnabled(subMenu, nextValue) {
  const host = getHostApp();
  if (!host) return;
  const buttonEntries = getMoreButtonEntries(host, TOOL_BUTTON_BY_ID[subMenu]);
  if (buttonEntries.length) {
    buttonEntries.forEach((entry) => {
      entry.enabled = !!nextValue;
    });
    if (typeof host.autoSaveSettings === 'function') {
      await host.autoSaveSettings();
    }
    return;
  }
  switch (subMenu) {
    case 'websearch':
      host.webSearchSettings.enabled = nextValue;
      if (typeof host.handleWebSearchToggle === 'function') {
        await host.handleWebSearchToggle(nextValue);
        return;
      }
      break;
    case 'interpreter':
      host.codeSettings.enabled = nextValue;
      if (typeof host.handleInterpreterToggle === 'function') {
        await host.handleInterpreterToggle(nextValue);
        return;
      }
      break;
    case 'CLI':
      host.CLISettings.enabled = nextValue;
      if (typeof host.handleEnableToggle === 'function') {
        host.handleEnableToggle(nextValue);
        return;
      }
      break;
    case 'document':
      if (host.KBSettings) {
        host.KBSettings.enabled = !!nextValue;
      }
      if (Array.isArray(host.knowledgeBases)) {
        host.knowledgeBases = host.knowledgeBases.map((kb) => ({ ...kb, enabled: !!nextValue }));
      }
      break;
    case 'chromeMCP':
      host.chromeMCPSettings.enabled = nextValue;
      if (typeof host.changeChromeMCPEnabled === 'function') {
        await host.changeChromeMCPEnabled();
        return;
      }
      break;
    case 'sql':
      host.sqlSettings.enabled = nextValue;
      if (typeof host.changeSqlEnabled === 'function') {
        await host.changeSqlEnabled();
        return;
      }
      break;
    case 'HA':
      host.HASettings.enabled = nextValue;
      if (typeof host.changeHAEnabled === 'function') {
        await host.changeHAEnabled();
        return;
      }
      break;
    default:
      return;
  }
  if (typeof host.autoSaveSettings === 'function') {
    await host.autoSaveSettings();
  }
}

async function saveSettings() {
  const host = getHostApp();
  if (!host) return;
  if (typeof host.autoSaveSettings === 'function') {
    await host.autoSaveSettings();
  }
}

function openDedicatedConfig(subMenu) {
  const host = getHostApp();
  if (!host) return;
  host.activeMenu = 'toolkit';
  host.subMenu = String(subMenu || 'tools');
  const methodMap = {
    llmTool: 'switchTollmTools',
    customHttpTool: 'switchToHttpTools',
    comfyui: 'switchToComfyui',
    sticker: 'switchToStickerPacks',
    mcp: 'switchTomcpServers',
    a2a: 'switchToa2aServers',
  };
  const methodName = methodMap[subMenu];
  if (methodName && typeof host[methodName] === 'function') {
    host[methodName]();
  }
}

export function createToolkitBridge() {
  return {
    snapshot: createSnapshot,
    selectSubMenu,
    openDetail,
    setSearchQuery,
    toggleSectionCollapse,
    updateField,
    toggleEnabled,
    saveSettings,
    openDedicatedConfig,
  };
}
