const { createApp, nextTick } = Vue;

const UI_RESOURCE_VERSION = "20260505-ui-rewrite-19";
const ACCESS_AUTH_STORAGE_KEY = "openxnet.uiplan.auth";
const MANAGED_ACCESS_PROVIDER_ID = "openxnet-access-managed-provider";
const PREFERRED_ACCESS_MODEL = "gpt-5.5";
const ACCESS_AGREEMENT_PAYLOAD = {
  terms_accepted: true,
  privacy_accepted: true,
  agreements_accepted: true,
  agreements_locale: "zh-CN",
};

const iconClasses = [
  "skill-card__icon--indigo",
  "skill-card__icon--emerald",
  "skill-card__icon--amber",
  "skill-card__icon--sky",
  "skill-card__icon--rose",
  "skill-card__icon--violet",
  "skill-card__icon--teal",
  "skill-card__icon--orange",
  "skill-card__icon--blue",
];

const defaultProviders = [
  {
    id: "openai",
    name: "OpenAI",
    initial: "O",
    color: "#10A37F",
    connected: false,
    apiKey: "",
    models: [
      { name: "GPT-4o", caps: ["对话", "代码", "视觉"], context: "128K", enabled: true },
      { name: "GPT-4o-mini", caps: ["对话", "代码"], context: "128K", enabled: true },
      { name: "GPT-4-turbo", caps: ["对话", "代码", "视觉"], context: "128K", enabled: false },
      { name: "o1-preview", caps: ["推理"], context: "128K", enabled: false },
      { name: "DALL-E 3", caps: ["图像"], context: "-", enabled: true },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    initial: "A",
    color: "#D4A574",
    connected: false,
    apiKey: "",
    models: [
      { name: "Claude 3.5 Sonnet", caps: ["对话", "代码"], context: "200K", enabled: true },
      { name: "Claude 3 Opus", caps: ["对话", "推理"], context: "200K", enabled: true },
      { name: "Claude 3 Haiku", caps: ["对话"], context: "200K", enabled: false },
    ],
  },
  {
    id: "google",
    name: "Google",
    initial: "G",
    color: "#4285F4",
    connected: false,
    apiKey: "",
    models: [
      { name: "Gemini 1.5 Pro", caps: ["对话", "视觉"], context: "1M", enabled: true },
      { name: "Gemini 1.5 Flash", caps: ["对话"], context: "1M", enabled: true },
    ],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    initial: "D",
    color: "#0066FF",
    connected: false,
    apiKey: "",
    models: [
      { name: "DeepSeek-V3", caps: ["对话", "代码"], context: "64K", enabled: true },
      { name: "DeepSeek-R1", caps: ["推理", "代码"], context: "64K", enabled: true },
    ],
  },
  {
    id: "ollama",
    name: "Ollama",
    initial: "O",
    color: "#333333",
    connected: false,
    apiKey: "",
    models: [
      { name: "llama3.1", caps: ["对话"], context: "128K", enabled: false },
      { name: "qwen2.5-coder", caps: ["代码"], context: "32K", enabled: false },
    ],
  },
  {
    id: "azure",
    name: "Azure OpenAI",
    initial: "A",
    color: "#0078D4",
    connected: false,
    apiKey: "",
    models: [
      { name: "gpt-4o-deployment", caps: ["对话", "视觉"], context: "128K", enabled: false },
    ],
  },
  {
    id: "aliyun-speech",
    name: "阿里云语音",
    initial: "阿",
    color: "#FF6A00",
    connected: false,
    apiKey: "",
    models: [
      { name: "阿里云 ASR", caps: ["语音识别"], context: "实时", enabled: true },
      { name: "阿里云 TTS", caps: ["语音合成"], context: "实时", enabled: true },
    ],
  },
  {
    id: "xunfei",
    name: "讯飞语音",
    initial: "讯",
    color: "#1D4ED8",
    connected: false,
    apiKey: "",
    models: [
      { name: "讯飞语音", caps: ["语音识别", "语音合成"], context: "实时", enabled: false },
    ],
  },
];

const defaultSkills = [
  ["translate", "智能翻译", "支持 50+ 语言实时翻译", ["翻译", "NLP"], "fa-solid fa-language", 5, true],
  ["code-review", "代码审查", "自动代码审查与优化建议，支持 Python/JS/Go 等主流语言", ["编程", "审查"], "fa-solid fa-code", 4, true],
  ["summary", "文档摘要", "自动提取文档关键信息生成摘要", ["文档", "NLP"], "fa-solid fa-file-lines", 5, false],
  ["visualize", "数据可视化", "将数据自动转换为图表和可视化报告", ["数据", "可视化"], "fa-solid fa-chart-bar", 4, true],
  ["vision", "图像识别", "基于视觉模型的图像内容识别", ["视觉"], "fa-solid fa-eye", 3, false],
  ["mail", "邮件助手", "智能邮件撰写、回复建议和日程提取", ["邮件", "效率"], "fa-solid fa-envelope-open-text", 4, false],
  ["sql", "SQL 生成器", "自然语言转 SQL 查询", ["数据库", "编程"], "fa-solid fa-database", 5, true],
  ["mindmap", "思维导图", "将文本内容自动组织为思维导图结构", ["文档", "可视化"], "fa-solid fa-diagram-project", 3, false],
  ["api-docs", "API 文档生成", "从代码自动生成 API 文档", ["编程", "文档"], "fa-solid fa-book", 4, true],
].map((item, index) => ({
  id: item[0],
  name: item[1],
  description: item[2],
  tags: item[3],
  icon: item[4],
  rating: item[5],
  installed: item[6],
  enabled: item[6],
  iconClass: iconClasses[index % iconClasses.length],
}));

const placeholderPages = {
  home: {
    title: "工作台",
    icon: "fa-solid fa-house",
    desc: "集中查看最近对话、快捷操作和内核运行状态。",
    features: ["最近对话", "快捷启动", "状态监控", "任务概览"],
  },
  "deploy-bot": {
    title: "部署机器人",
    icon: "fa-solid fa-robot",
    desc: "配置 QQ、飞书、钉钉、Discord、Telegram 等机器人连接。",
    features: ["多平台接入", "权限配置", "消息路由", "运行日志"],
  },
  "api-group": {
    title: "API 管理",
    icon: "fa-solid fa-plug",
    desc: "管理 API 分组、密钥、限流和服务调用策略。",
    features: ["密钥管理", "分组策略", "调用审计", "限流控制"],
  },
  enterprise: {
    title: "企业空间",
    icon: "fa-solid fa-building",
    desc: "团队知识、角色、空间权限和企业工作流的统一入口。",
    features: ["角色权限", "知识空间", "团队协作", "审计追踪"],
  },
  storage: {
    title: "存储管理",
    icon: "fa-solid fa-database",
    desc: "查看本地文件、上传内容、缓存和长期记忆空间。",
    features: ["文件索引", "缓存清理", "记忆空间", "容量统计"],
  },
  system: {
    title: "系统设置",
    icon: "fa-solid fa-gear",
    desc: "配置语言、主题、代理、内核策略和桌面集成。",
    features: ["主题语言", "网络代理", "内核策略", "桌面集成"],
  },
  "task-center": {
    title: "任务中心",
    icon: "fa-solid fa-list-check",
    desc: "追踪后台任务、长运行工具和自动化计划。",
    features: ["任务队列", "进度追踪", "结果归档", "异常重试"],
  },
  "ai-browser": {
    title: "AI 浏览器",
    icon: "fa-solid fa-globe",
    desc: "让 OpenXnet 在独立浏览器工作区里执行网页任务。",
    features: ["网页理解", "自动操作", "截图记录", "安全隔离"],
  },
  about: {
    title: "关于 OpenXnet",
    icon: "fa-solid fa-circle-info",
    desc: "OpenXnet 是面向 AI 多代理工作流的桌面操作系统式工作台。",
    features: ["Neural-Symbolic OS", "Agent Runtime", "Skill Hub", "Local First"],
  },
};

const dashboardEntries = [
  { route: "chat", label: "实时对话", desc: "继续当前会话", icon: "fa-solid fa-comments", color: "#5BA3C5" },
  { route: "model-config", label: "模型配置", desc: "切换模型与密钥", icon: "fa-solid fa-microchip", color: "#10B981" },
  { route: "toolkit", label: "工具箱", desc: "管理工具触发", icon: "fa-solid fa-toolbox", color: "#F59E0B" },
  { route: "skills", label: "技能中心", desc: "安装与结晶技能", icon: "fa-solid fa-wand-magic-sparkles", color: "#8B5CF6" },
  { route: "role", label: "角色设置", desc: "记忆、语音和视觉", icon: "fa-solid fa-user-gear", color: "#F43F5E" },
  { route: "task-center", label: "任务中心", desc: "查看长任务队列", icon: "fa-solid fa-list-check", color: "#0EA5E9" },
  { route: "enterprise", label: "企业空间", desc: "团队与权限", icon: "fa-solid fa-building", color: "#64748B" },
  { route: "storage", label: "存储管理", desc: "文件、素材与回忆", icon: "fa-solid fa-database", color: "#14B8A6" },
  { route: "storage", label: "文件管理", desc: "文本、图片、视频和续接文件", icon: "fa-solid fa-folder-open", color: "#0F766E" },
  { route: "deploy-bot", label: "部署管理", desc: "桌宠、直播和消息机器人", icon: "fa-solid fa-robot", color: "#7C3AED" },
  { route: "api-group", label: "API 配置", desc: "接口、密钥和服务映射", icon: "fa-solid fa-plug", color: "#2563EB" },
];

const storageRows = [
  { name: "产品需求文档.txt", type: "文本", size: "156 KB", updated: "今天 09:24", icon: "fa-solid fa-file-lines", tone: "blue" },
  { name: "系统架构图.png", type: "图片", size: "2.1 MB", updated: "昨天 18:12", icon: "fa-solid fa-image", tone: "green" },
  { name: "会议纪要_2026-05.md", type: "Markdown", size: "88 KB", updated: "05-04 16:30", icon: "fa-brands fa-markdown", tone: "purple" },
  { name: "API_调试记录.json", type: "JSON", size: "42 KB", updated: "05-03 21:08", icon: "fa-solid fa-code", tone: "orange" },
  { name: "桌面视觉样本.mp4", type: "视频", size: "128 MB", updated: "05-02 11:36", icon: "fa-solid fa-film", tone: "rose" },
];

const taskRows = [
  { id: "task-001", title: "知识库重新索引", status: "运行中", progress: 68, agent: "Knowledge Agent", time: "预计 4 分钟", tone: "running", priority: "high" },
  { id: "task-002", title: "模型提供商连通性检测", status: "排队中", progress: 15, agent: "Runtime", time: "等待执行", tone: "queued", priority: "medium" },
  { id: "task-003", title: "对话摘要归档", status: "已完成", progress: 100, agent: "Memory", time: "2 分钟前", tone: "done", priority: "low" },
  { id: "task-004", title: "工具权限审计", status: "需要确认", progress: 42, agent: "Security", time: "暂停", tone: "warning", priority: "high" },
];

const deployBots = [
  { name: "企业微信助手", channel: "WeCom", status: "在线", messages: "1,248", icon: "fa-solid fa-building", tone: "green" },
  { name: "钉钉项目群", channel: "DingTalk", status: "在线", messages: "862", icon: "fa-solid fa-comment-dots", tone: "blue" },
  { name: "Discord Dev", channel: "Discord", status: "待授权", messages: "0", icon: "fa-brands fa-discord", tone: "purple" },
  { name: "Telegram 支持", channel: "Telegram", status: "离线", messages: "317", icon: "fa-brands fa-telegram", tone: "gray" },
];

const apiGroups = [
  { name: "OpenAI 兼容接口", route: "/v1/chat/completions", quota: "82%", status: "运行中", key: "sk-...xnet" },
  { name: "技能市场 API", route: "/api/skills/list", quota: "34%", status: "运行中", key: "skill-...hub" },
  { name: "企业知识库", route: "/api/enterprise/search", quota: "12%", status: "内测", key: "ent-...kb" },
  { name: "桌面控制桥", route: "/api/desktop/control", quota: "57%", status: "受限", key: "desk-...ctl" },
];

const enterpriseSpaces = [
  { name: "研发空间", owner: "Engineering", members: 12, docs: 438, icon: "fa-solid fa-code-branch", tone: "blue" },
  { name: "产品运营", owner: "Product Ops", members: 8, docs: 214, icon: "fa-solid fa-chart-line", tone: "green" },
  { name: "企业知识中台", owner: "Knowledge", members: 16, docs: 1280, icon: "fa-solid fa-layer-group", tone: "purple" },
];

const enterpriseTabs = [
  { id: "members", label: "员工角色", icon: "fa-solid fa-id-card" },
  { id: "symbols", label: "神经符号库", icon: "fa-solid fa-brain" },
  { id: "graph", label: "知识图谱", icon: "fa-solid fa-diagram-project" },
  { id: "aiops", label: "XnetAIOps", icon: "fa-solid fa-robot" },
  { id: "usage", label: "用量统计", icon: "fa-solid fa-chart-bar" },
];

const enterpriseMembers = [
  { name: "Alex Chen", role: "管理员", group: "研发空间", agents: "代码助手 / 搜索助手", status: "在线" },
  { name: "Mia Zhang", role: "成员", group: "产品运营", agents: "文档助手 / 运营分析", status: "在线" },
  { name: "Noah Li", role: "访客", group: "企业知识中台", agents: "只读检索", status: "待激活" },
];

const enterpriseSymbolRows = [
  { id: "SYM-1042", name: "检索意图", type: "意图符号", owner: "Knowledge", status: "启用" },
  { id: "SYM-1187", name: "审批策略", type: "规则符号", owner: "Security", status: "启用" },
  { id: "SYM-1203", name: "任务执行链", type: "流程符号", owner: "AIOps", status: "测试中" },
];

const enterpriseOpsRows = [
  { name: "自动清理缓存", type: "AIOps", status: "已处理", time: "今天 09:20" },
  { name: "知识库同步", type: "DataOps", status: "运行中", time: "今天 10:12" },
  { name: "模型服务探活", type: "MLOps", status: "测试中", time: "昨天 18:40" },
];

const systemSections = [
  {
    id: "general",
    label: "通用设置",
    icon: "fa-solid fa-sliders",
    desc: "基础应用配置",
    rows: [
      ["界面语言", "简体中文"],
      ["启动行为", "启动后进入工作台"],
      ["自动保存", "开启"],
      ["日期格式", "YYYY-MM-DD / MM/DD/YYYY / DD/MM/YYYY"],
      ["更新通道", "稳定版 / 测试版"],
    ],
  },
  {
    id: "appearance",
    label: "外观",
    icon: "fa-solid fa-palette",
    desc: "主题、密度和窗口表现",
    rows: [
      ["主题模式", "浅色 UIPlan"],
      ["界面密度", "标准"],
      ["动画效果", "开启"],
    ],
  },
  {
    id: "network",
    label: "网络",
    icon: "fa-solid fa-wifi",
    desc: "代理、端口和外部连接",
    rows: [
      ["本地服务", "127.0.0.1:3456"],
      ["代理", "跟随系统"],
      ["WebSocket", "自动重连"],
    ],
  },
  {
    id: "shortcuts",
    label: "快捷键",
    icon: "fa-solid fa-keyboard",
    desc: "全局快捷键与输入行为",
    rows: [
      ["唤起搜索", "Ctrl+K"],
      ["新建对话", "Ctrl+N"],
      ["发送消息", "Enter"],
    ],
  },
  {
    id: "advanced",
    label: "高级",
    icon: "fa-solid fa-flask",
    desc: "内核、日志和实验功能",
    rows: [
      ["日志等级", "Info"],
      ["实验功能", "启用"],
      ["旧版 UI", "OPENXNET_UI_ENTRY=/"],
    ],
  },
  {
    id: "about",
    label: "关于",
    icon: "fa-solid fa-circle-info",
    desc: "版本、许可与更新通道",
    rows: [
      ["当前版本", "0.4.0"],
      ["更新通道", "稳定版 / 测试版"],
      ["开源协议", "AGPL-3.0"],
    ],
  },
];

const systemActionRows = [
  { label: "清除缓存", desc: "清理聊天缓存、临时截图和工具运行缓存", button: "立即清除", icon: "fa-solid fa-broom" },
  { label: "导出数据", desc: "导出所有对话记录、设置、角色和工具配置", button: "导出所有数据", icon: "fa-solid fa-download" },
  { label: "导入配置", desc: "从备份文件恢复模型、工具、角色和系统设置", button: "导入配置", icon: "fa-solid fa-upload" },
  { label: "恢复默认设置", desc: "关闭实验开关并恢复稳定配置", button: "恢复默认设置", icon: "fa-solid fa-arrow-rotate-left", danger: true },
];

const browserCards = [
  { title: "页面理解", desc: "自动读取 DOM、截图和可访问性结构", icon: "fa-solid fa-eye" },
  { title: "任务执行", desc: "点击、输入、滚动和表单操作可追踪", icon: "fa-solid fa-hand-pointer" },
  { title: "安全隔离", desc: "敏感提交前需要明确确认", icon: "fa-solid fa-shield-halved" },
];

const subscriptionPlans = [
  { id: "free", name: "免费版", price: "0", quota: "基础对话与本地工具", current: true, cta: "当前套餐", features: ["基础对话功能", "3 个自定义角色", "1 GB 存储空间", "MCP 工具集成"] },
  { id: "pro", name: "专业版", price: "99", quota: "高级模型、技能结晶、任务队列", current: false, cta: "购买", features: ["高级对话", "更多自定义角色", "10 GB 存储", "API 访问", "MCP 工具集成", "优先支持"] },
  { id: "team", name: "团队版", price: "299", quota: "企业空间、权限审计、共享知识库", current: false, cta: "升级", features: ["所有专业版功能", "团队管理", "共享知识库", "权限审计", "优先支持"] },
  { id: "enterprise", name: "企业版", price: "定制", quota: "私有部署、SSO、专属支持与合规审计", current: false, cta: "联系销售", features: ["所有专业版功能", "100 GB 存储", "团队管理", "自定义部署", "SLA 支持", "合规审计"] },
];

const subscriptionUsageRows = [
  { label: "模型调用", used: "82,430", total: "100,000", percent: 82 },
  { label: "技能运行", used: "4,216", total: "10,000", percent: 42 },
  { label: "存储空间", used: "6.8 GB", total: "20 GB", percent: 34 },
  { label: "企业成员", used: "18", total: "30", percent: 60 },
];

const billingRows = [
  { item: "Pro 月度订阅", amount: "¥99.00", status: "已支付", date: "2026-05-01" },
  { item: "技能运行扩展包", amount: "¥29.00", status: "已支付", date: "2026-04-18" },
  { item: "Team 试用额度", amount: "¥0.00", status: "试用", date: "2026-04-01" },
];

const aboutInfoRows = [
  ["版本", "OpenXnet Desktop 0.4.0"],
  ["内核版本", "Neural-Symbolic Kernel 0.9.8"],
  ["官网", "openxnet.synapxnet.com"],
  ["开源协议", "AGPL-3.0"],
  ["运行入口", "/uiplan/"],
];

const aboutFeatureRows = [
  { label: "多模型支持", desc: "OpenAI、Claude、Gemini、Ollama 与本地兼容接口", icon: "fa-solid fa-microchip" },
  { label: "MCP 工具集", desc: "工具、资源和协议服务可统一注册调度", icon: "fa-solid fa-server" },
  { label: "智能角色", desc: "角色卡、记忆、语音、视觉和自主行为联动", icon: "fa-solid fa-user-gear" },
  { label: "多端部署", desc: "桌宠、直播、即时通讯、播报和翻译机器人", icon: "fa-solid fa-diagram-project" },
];

const aboutActions = [
  { label: "检查更新", icon: "fa-solid fa-rotate" },
  { label: "反馈问题", icon: "fa-solid fa-comment-dots" },
  { label: "打开官网", icon: "fa-solid fa-arrow-up-right-from-square" },
  { label: "查看许可", icon: "fa-solid fa-scale-balanced" },
];

const chatQuickTools = [
  { id: "web", label: "联网搜索", icon: "fa-solid fa-globe" },
  { id: "deep", label: "深度研究", icon: "fa-solid fa-magnifying-glass-chart" },
  { id: "vision", label: "截图理解", icon: "fa-solid fa-camera" },
  { id: "perf", label: "性能分析结果", icon: "fa-solid fa-chart-line" },
  { id: "unit", label: "单元测试", icon: "fa-solid fa-vial" },
  { id: "skill", label: "转为技能", icon: "fa-solid fa-wand-magic-sparkles" },
  { id: "workflow", label: "任务规划", icon: "fa-solid fa-diagram-project" },
];

const deployTabs = [
  { id: "vrm", label: "VRM桌宠", icon: "fa-solid fa-user-astronaut" },
  { id: "live", label: "直播", icon: "fa-solid fa-video" },
  { id: "im", label: "即时通讯", icon: "fa-solid fa-comments" },
  { id: "broadcast", label: "播报", icon: "fa-solid fa-bullhorn" },
  { id: "translate", label: "翻译", icon: "fa-solid fa-language" },
  { id: "common", label: "通用配置", icon: "fa-solid fa-sliders" },
  { id: "logs", label: "部署日志", icon: "fa-solid fa-file-lines" },
];

const apiTabs = [
  { id: "new", label: "新建 API", icon: "fa-solid fa-plus" },
  { id: "openai", label: "OpenAI API", icon: "fa-solid fa-comments" },
  { id: "mcp", label: "MCP API", icon: "fa-solid fa-server" },
  { id: "vrm", label: "VRM API", icon: "fa-solid fa-user-astronaut" },
  { id: "gateway", label: "服务映射", icon: "fa-solid fa-route" },
  { id: "models", label: "模型导入", icon: "fa-solid fa-download" },
  { id: "snapshots", label: "快照", icon: "fa-solid fa-box-archive" },
  { id: "docker", label: "Docker", icon: "fa-brands fa-docker" },
  { id: "scripts", label: "测试脚本", icon: "fa-solid fa-vial" },
  { id: "code", label: "代码智能", icon: "fa-solid fa-laptop-code" },
  { id: "extension", label: "扩展", icon: "fa-solid fa-puzzle-piece" },
  { id: "docs", label: "API 文档", icon: "fa-solid fa-book" },
];

const apiDevTabs = [
  { id: "agents", label: "智能体快照", icon: "fa-solid fa-camera" },
  { id: "browser", label: "浏览器模式", icon: "fa-solid fa-globe" },
  { id: "automation", label: "自动化引擎 Playwright Puppeteer", icon: "fa-solid fa-robot" },
  { id: "code", label: "代码智能", icon: "fa-solid fa-laptop-code" },
  { id: "extension", label: "扩展", icon: "fa-solid fa-puzzle-piece" },
  { id: "docs", label: "FastAPI文档", icon: "fa-solid fa-book" },
];

const apiDevActions = [
  { label: "新建MCP服务", icon: "fa-solid fa-plus" },
  { label: "添加仓库", icon: "fa-solid fa-code-branch" },
  { label: "录制操作", icon: "fa-solid fa-circle-dot" },
  { label: "扩展商店", icon: "fa-solid fa-store" },
  { label: "拉取", icon: "fa-solid fa-cloud-arrow-down" },
  { label: "加载", icon: "fa-solid fa-download" },
  { label: "新窗口", icon: "fa-solid fa-up-right-from-square" },
];

const storageTabs = [
  { id: "text", label: "文本文件", icon: "fa-solid fa-file-lines" },
  { id: "images", label: "图片文件", icon: "fa-solid fa-image" },
  { id: "videos", label: "视频文件", icon: "fa-solid fa-film" },
  { id: "continuation", label: "续接中心", icon: "fa-solid fa-clock-rotate-left" },
  { id: "recall", label: "回忆", icon: "fa-solid fa-brain" },
  { id: "backup", label: "备份", icon: "fa-solid fa-box-archive" },
];

const taskTabs = [
  { id: "all", label: "全部" },
  { id: "running", label: "运行中" },
  { id: "queued", label: "排队中" },
  { id: "done", label: "已完成" },
  { id: "warning", label: "需要处理" },
];

const taskPriorityTabs = [
  { id: "all", label: "全部优先级" },
  { id: "high", label: "高优先级" },
  { id: "medium", label: "中优先级" },
  { id: "low", label: "低优先级" },
];

const browserActions = [
  { label: "AI 分析", icon: "fa-solid fa-wand-magic-sparkles" },
  { label: "AI 助手", icon: "fa-solid fa-robot" },
  { label: "打开页面", icon: "fa-solid fa-arrow-up-right-from-square" },
  { label: "文档中心", icon: "fa-solid fa-book-open" },
  { label: "读取页面", icon: "fa-solid fa-eye" },
  { label: "执行任务", icon: "fa-solid fa-play" },
  { label: "截图记录", icon: "fa-solid fa-camera" },
  { label: "复制摘要", icon: "fa-solid fa-copy" },
  { label: "深入分析", icon: "fa-solid fa-magnifying-glass-chart" },
];

const browserInsightTabs = [
  { id: "summary", label: "摘要" },
  { id: "ask", label: "提问" },
  { id: "translate", label: "翻译" },
];

const kernelTabs = [
  { id: "runtime", label: "内核运行", icon: "fa-solid fa-gauge-high" },
  { id: "audit", label: "内核审计", icon: "fa-solid fa-shield-halved" },
  { id: "traces", label: "内核追踪", icon: "fa-solid fa-timeline" },
  { id: "world", label: "内核世界", icon: "fa-solid fa-diagram-project" },
  { id: "plan", label: "内核计划", icon: "fa-solid fa-list-check" },
];

const kernelPlanRows = [
  { name: "文档自动摘要", status: "成功", time: "2026-05-02 16:45", steps: 3 },
  { name: "多语言翻译链", status: "失败", time: "2026-05-02 14:20", steps: 6 },
  { name: "工具权限巡检", status: "超时", time: "2026-05-01 21:08", steps: 5 },
];

const kernelEventFilters = ["全部事件", "推理请求", "符号变更", "配置修改", "系统事件", "导出日志"];
const kernelPlanFilters = ["全部", "成功", "失败", "超时"];

const snapshotRows = [
  { name: "测试环境-v2.3升级前", time: "2026-05-02 18:30", size: "38 MB", status: "可恢复" },
  { name: "初始配置备份", time: "2026-04-28 09:10", size: "12 MB", status: "已归档" },
  { name: "工具权限审计前", time: "2026-04-25 16:42", size: "24 MB", status: "可恢复" },
];

const accountMenuItems = [
  { label: "个人中心", route: "role", icon: "fa-solid fa-user", requiresAuth: true },
  { label: "订阅服务", route: "subscription", icon: "fa-solid fa-credit-card" },
  { label: "退出登录", route: "login", icon: "fa-solid fa-arrow-right-from-bracket", action: "logout", danger: true },
];

const startupModules = [
  { label: "神经符号 OS 就绪", desc: "Runtime、WebSocket、模型路由与工具桥接已经载入", icon: "fa-solid fa-circle-check", tone: "green" },
  { label: "符号引擎", desc: "知识图谱、角色记忆、推理链路等待调度", icon: "fa-solid fa-brain", tone: "purple" },
  { label: "推理链路", desc: "主模型、快速模型、工具链和桌面视觉可用", icon: "fa-solid fa-route", tone: "blue" },
  { label: "今日 Token", desc: "额度统计、成本和调用链可在订阅页查看", icon: "fa-solid fa-gauge-high", tone: "amber" },
];

const loginProviders = [
  { id: "password", label: "账号密码", icon: "fa-solid fa-lock" },
  { id: "sms", label: "验证码登录", icon: "fa-solid fa-mobile-screen" },
  { id: "register", label: "注册账号", icon: "fa-solid fa-user-plus" },
];

const shellActions = [
  { label: "首页", route: "home", icon: "fa-solid fa-house" },
  { label: "实时对话", route: "chat", icon: "fa-solid fa-comments" },
  { label: "返回导航", route: "home", icon: "fa-solid fa-arrow-left" },
  { label: "开发者", route: "api-group", icon: "fa-solid fa-code" },
];

const modelAdvancedRows = [
  { label: "Top P", value: "0.9", hint: "采样截断阈值" },
  { label: "Reasoning Effort", value: "high", hint: "推理深度 auto/high/low" },
  { label: "图像尺寸", value: "1024x1024", hint: "图像生成默认分辨率" },
  { label: "图像质量", value: "hd / vivid", hint: "质量与风格预设" },
  { label: "语音语言", value: "zh-CN", hint: "ASR/TTS 默认语言" },
  { label: "采样率", value: "16000 Hz", hint: "语音识别采样率" },
  { label: "TTS 音色", value: "zh-CN-XiaoxiaoNeural", hint: "角色默认合成音色" },
  { label: "输出格式", value: "mp3", hint: "语音合成导出格式" },
];

const deployPanelActions = {
  vrm: [
    { label: "VRM模型选择", desc: "选择桌宠角色、绑定表情和动作", icon: "fa-solid fa-user-astronaut" },
    { label: "动画与互动", desc: "配置待机、说话、提醒和互动动作", icon: "fa-solid fa-person-running" },
    { label: "窗口设置", desc: "透明度、置顶、穿透和显示器位置", icon: "fa-solid fa-window-maximize" },
  ],
  live: [
    { label: "OBS连接", desc: "OBS WebSocket 地址、密码和场景绑定", icon: "fa-solid fa-plug" },
    { label: "连接OBS", desc: "发起 OBS WebSocket 连接并校验场景权限", icon: "fa-solid fa-link" },
    { label: "开始直播", desc: "推流密钥、平台与推流状态管理", icon: "fa-solid fa-video" },
    { label: "弹幕互动", desc: "弹幕监听、关键词触发和角色回复", icon: "fa-solid fa-comments" },
  ],
  im: [
    { label: "即时通讯", desc: "企业微信、钉钉、飞书、Slack 通道", icon: "fa-solid fa-message" },
    { label: "播报频道", desc: "频道白名单、群组绑定和权限策略", icon: "fa-solid fa-bullhorn" },
    { label: "机器人总开关", desc: "全局开关、容错重试和自动重连", icon: "fa-solid fa-toggle-on" },
  ],
  broadcast: [
    { label: "内容来源", desc: "选择文本、任务、知识库或外部 Webhook 作为播报来源", icon: "fa-solid fa-database" },
    { label: "定时播报", desc: "按时间、事件或任务完成触发播报", icon: "fa-solid fa-clock" },
    { label: "播报模板", desc: "消息模板、变量和上下文摘要", icon: "fa-solid fa-file-lines" },
    { label: "TTS语音播报", desc: "语音供应商、语速、音量和试听", icon: "fa-solid fa-volume-high" },
  ],
  translate: [
    { label: "语言设置", desc: "源语言、目标语言和自动识别策略", icon: "fa-solid fa-language" },
    { label: "翻译引擎", desc: "绑定翻译模型与术语库", icon: "fa-solid fa-microchip" },
    { label: "高级设置", desc: "延迟、批处理和上下文保留", icon: "fa-solid fa-sliders" },
  ],
  common: [
    { label: "基本信息", desc: "名称、头像、默认角色和启动通道", icon: "fa-solid fa-id-card" },
    { label: "性能设置", desc: "并发、缓存、日志和资源限制", icon: "fa-solid fa-gauge" },
    { label: "容错设置", desc: "异常重试、降级策略和告警通知", icon: "fa-solid fa-shield-halved" },
  ],
  logs: [
    { label: "部署日志", desc: "连接、鉴权、消息、错误的实时日志", icon: "fa-solid fa-file-lines" },
    { label: "重置", desc: "清空草稿并恢复默认部署参数", icon: "fa-solid fa-arrow-rotate-left" },
    { label: "部署", desc: "保存配置并启动所有已启用通道", icon: "fa-solid fa-rocket" },
  ],
};

const apiEndpointRows = [
  { name: "OpenAI Chat Completions", method: "POST", path: "/v1/chat/completions", type: "OpenAI API", status: "启用" },
  { name: "MCP Server 列表", method: "GET", path: "/api/mcp/servers", type: "MCP API", status: "启用" },
  { name: "VRM 模型列表", method: "GET", path: "/api/vrm/models", type: "VRM API", status: "内测" },
  { name: "智能体快照", method: "POST", path: "/api/agents/snapshots", type: "Snapshot", status: "启用" },
];

const apiVrmActions = [
  { label: "表情控制", method: "POST", path: "/api/vrm/expression", status: "启用" },
  { label: "动作控制", method: "POST", path: "/api/vrm/motion", status: "启用" },
  { label: "语音同步", method: "POST", path: "/api/vrm/lipsync", status: "内测" },
  { label: "姿态获取", method: "GET", path: "/api/vrm/pose", status: "启用" },
  { label: "位置设置", method: "PUT", path: "/api/vrm/position", status: "启用" },
];

const apiDockerRows = [
  { name: "openxnet-api", image: "openxnet/server:latest", status: "运行中", port: "3456:3456" },
  { name: "playwright-runner", image: "mcr.microsoft.com/playwright", status: "待启动", port: "9222:9222" },
  { name: "vector-db", image: "qdrant/qdrant", status: "运行中", port: "6333:6333" },
];

const apiSnapshotRows = [
  { name: "生产环境-稳定版", time: "2026-05-03 22:30", size: "42 MB", content: "快照包含内容: 模型配置、角色卡、工具权限、知识索引", status: "可恢复" },
  { name: "客服智能体-微调后", time: "2026-05-01 16:20", size: "28 MB", content: "快照包含内容: Agent 权重、Prompt、评测报告", status: "已归档" },
  { name: "全量备份-周报", time: "2026-04-28 09:00", size: "96 MB", content: "快照包含内容: 对话、文件、订阅用量、API 密钥引用", status: "可恢复" },
];

const apiAutomationRows = [
  { name: "网页数据采集-电商价格", engine: "Playwright", schedule: "每天 09:00", status: "运行中" },
  { name: "自动登录-后台管理系统", engine: "Puppeteer", schedule: "手动触发", status: "需确认" },
  { name: "表单自动填充测试", engine: "Playwright", schedule: "每次发布前", status: "待处理" },
];

const apiBrowserRows = [
  { name: "浏览器实例", value: "2", status: "运行中" },
  { name: "活跃会话", value: "5", status: "可接管" },
  { name: "加载本地扩展", value: "开发者模式", status: "已启用" },
];

const apiCodeRows = [
  { repo: "openxnet-desktop", language: "JavaScript / Python", branch: "main", status: "已索引" },
  { repo: "skills-library", language: "Python", branch: "develop", status: "待同步" },
  { repo: "uiplan-prototype", language: "HTML / CSS", branch: "ui-rewrite", status: "已加载" },
];

const storageContinuationRows = [
  { title: "UIPlan 页面重写", status: "恢复中断的任务", progress: 82, updated: "今天 15:42" },
  { title: "企业知识库重建", status: "等待继续", progress: 35, updated: "昨天 22:10" },
  { title: "直播机器人配置", status: "草稿可恢复", progress: 60, updated: "05-03 17:18" },
];

const kernelFlowSteps = [
  { label: "接收并解析用户输入", desc: "捕获会话、文件、工具和桌面上下文" },
  { label: "意图分类与实体提取", desc: "识别任务类型、关键实体和安全边界" },
  { label: "关联知识检索与推理", desc: "读取符号图谱、记忆和可用工具" },
  { label: "生成响应方案", desc: "组合模型、技能和执行计划" },
  { label: "质量验证与输出", desc: "校验格式、权限和最终可执行结果" },
];

const subscriptionComparisonRows = [
  { item: "自定义角色", free: "3 个", pro: "无限", enterprise: "无限" },
  { item: "存储空间", free: "1 GB", pro: "10 GB", enterprise: "100 GB" },
  { item: "MCP 工具集成", free: "基础", pro: "完整", enterprise: "完整 + 私有" },
  { item: "团队管理", free: "-", pro: "-", enterprise: "包含" },
  { item: "优先支持", free: "-", pro: "包含", enterprise: "SLA" },
  { item: "自定义部署", free: "-", pro: "-", enterprise: "包含" },
];

const taskPeopleRows = [
  { name: "张明", role: "产品负责人", status: "待处理" },
  { name: "李华", role: "前端工程师", status: "进行中" },
  { name: "王芳", role: "测试工程师", status: "待处理" },
  { name: "赵强", role: "后端工程师", status: "进行中" },
  { name: "陈雪", role: "运维", status: "待处理" },
  { name: "刘伟", role: "数据分析", status: "进行中" },
  { name: "周敏", role: "交互设计", status: "待处理" },
  { name: "吴婷", role: "客服运营", status: "待处理" },
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeId() {
  if (crypto && crypto.randomUUID) return crypto.randomUUID();
  return `ox-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function toDisplayString(value, fallback = "", seen = new Set()) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return value || fallback;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    if (seen.has(value)) return fallback;
    seen.add(value);
    const candidate = value.label ?? value.name ?? value.id ?? value.title ?? value.value;
    if (candidate !== undefined && candidate !== value) {
      return toDisplayString(candidate, fallback, seen);
    }
    try {
      const serialized = JSON.stringify(value);
      return serialized && serialized !== "{}" ? serialized : fallback;
    } catch (_) {
      return fallback;
    }
  }
  return String(value || fallback);
}

function initialsFor(value, fallback = "O", length = 1) {
  const text = toDisplayString(value, fallback).trim() || fallback;
  return text.slice(0, length).toUpperCase();
}

createApp({
  data() {
    return {
      sidebarCollapsed: true,
      currentRoute: "startup",
      globalSearch: "",
      lastAction: "就绪",
      ws: null,
      wsConnected: false,
      settings: {},
      settingsLoaded: false,
      conversations: [],
      conversationId: null,
      messages: [],
      userInput: "",
      isSending: false,
      abortController: null,
      assistantHasContent: false,
      historyOpen: false,
      settingsOpen: false,
      accessToken: "",
      refreshToken: "",
      accessTokenConfigured: false,
      refreshTokenConfigured: false,
      accessTokenExpiresAt: 0,
      refreshTokenExpiresAt: 0,
      currentUser: null,
      authLoading: false,
      authError: "",
      authNotice: "",
      loginMode: "password",
      loginIdentity: "",
      loginPassword: "",
      loginPhone: "",
      loginCode: "",
      loginNickname: "",
      loginEmail: "",
      loginSmsCooldown: 0,
      loginSmsTimer: null,
      subscriptionEntitlement: null,
      subscriptionCredits: null,
      subscriptionExpiry: null,
      accessPlans: [],
      subscriptionLoading: false,
      subscriptionError: "",
      subscriptionNotice: "",
      subscriptionActionLoading: "",
      lastOrder: null,
      providerActionLoading: "",
      providerError: "",
      providerNotice: "",
      taskLoading: false,
      taskError: "",
      taskNotice: "",
      taskDetail: null,
      taskDetailOpen: false,
      taskExecutionUnsubscribe: null,
      apiWorkbenchOverview: null,
      engineStatus: null,
      neuroStats: null,
      neuroGraph: null,
      voiceCatalog: null,
      systemActionLoading: "",
      systemNotice: "",
      systemError: "",
      mainAgent: "super-model",
      temperature: 0.7,
      maxTokens: 8192,
      webSearchEnabled: false,
      deepResearchEnabled: false,
      thinkingEnabled: false,
      providers: clone(defaultProviders),
      selectedProviderId: "openai",
      showApiKey: false,
      modelTab: "service",
      skills: clone(defaultSkills),
      skillTab: "library",
      skillFilter: "全部",
      skillSearch: "",
      transformSource: "conversation",
      transformText: "",
      transformSkillName: "代码重构助手",
      transformSkillDesc: "基于历史代码优化对话，自动分析代码质量并提供重构建议，支持多种编程语言。",
      transformParams: [
        { name: "language", type: "string", defaultValue: "python" },
        { name: "depth", type: "number", defaultValue: "3" },
        { name: "style", type: "string", defaultValue: "concise" },
      ],
      crystalName: "全栈开发助手",
      crystalMode: "串行",
      crystalConditional: false,
      toolkitTools: [],
      selectedToolId: "webSearch",
      toolSearch: "",
      deployTab: "common",
      apiTab: "gateway",
      storageTab: "text",
      taskTab: "all",
      taskPriorityTab: "all",
      enterpriseTab: "members",
      enterpriseSearch: "",
      systemActiveSection: "general",
      browserInsightTab: "summary",
      kernelTab: "runtime",
      toolkitSectionOpen: {
        builtin: true,
        knowledge: true,
        custom: true,
        external: true,
        protocol: true,
      },
      roles: [],
      selectedRoleId: "assistant",
      roleSearch: "",
      roleTab: "memory",
      voiceProvider: "azure",
      voiceSpeed: 1,
      voiceVolume: 80,
      clock: "",
      saveTimer: null,
      navSections: [
        {
          label: "主要",
          items: [
            { id: "home", label: "工作台", icon: "fa-solid fa-house" },
            { id: "chat", label: "实时对话", icon: "fa-solid fa-comments" },
            { id: "role", label: "角色设置", icon: "fa-solid fa-user-gear" },
            { id: "model-config", label: "模型配置", icon: "fa-solid fa-microchip" },
          ],
        },
        {
          label: "工具",
          items: [
            { id: "toolkit", label: "工具箱", icon: "fa-solid fa-toolbox" },
            { id: "skills", label: "技能中心", icon: "fa-solid fa-wand-magic-sparkles" },
            { id: "knowledge", label: "知识库", icon: "fa-solid fa-book-open" },
            { id: "deploy-bot", label: "部署机器人", icon: "fa-solid fa-robot" },
            { id: "api-group", label: "API 管理", icon: "fa-solid fa-plug" },
          ],
        },
        {
          label: "管理",
          items: [
            { id: "enterprise", label: "企业空间", icon: "fa-solid fa-building" },
            { id: "storage", label: "存储管理", icon: "fa-solid fa-database" },
            { id: "system", label: "系统设置", icon: "fa-solid fa-gear" },
            { id: "task-center", label: "任务中心", icon: "fa-solid fa-list-check" },
            { id: "ai-browser", label: "AI 浏览器", icon: "fa-solid fa-globe" },
            { id: "kernel", label: "神经符号内核", icon: "fa-solid fa-brain" },
            { id: "subscription", label: "订阅管理", icon: "fa-solid fa-credit-card" },
          ],
        },
      ],
      modelTabs: [
        { id: "service", label: "模型服务", icon: "fa-solid fa-server", desc: "配置所有模型提供商和密钥" },
        { id: "main", label: "主模型", icon: "fa-solid fa-comments", desc: "选择默认聊天模型，用于日常对话和通用任务处理" },
        { id: "fast", label: "快速应答模型", icon: "fa-solid fa-bolt", desc: "用于低延迟回复、意图识别和轻量调度" },
        { id: "reasoner", label: "推理模型", icon: "fa-solid fa-brain", desc: "处理复杂推理、规划和长链路任务" },
        { id: "vision", label: "视觉模型", icon: "fa-solid fa-eye", desc: "用于桌面视觉、图片理解和多模态输入" },
        { id: "text2img", label: "图像生成模型", icon: "fa-solid fa-image", desc: "用于生成图片、素材和视觉资产" },
        { id: "asr", label: "语音识别模型", icon: "fa-solid fa-microphone", desc: "用于语音输入转文字" },
        { id: "tts", label: "语音合成模型", icon: "fa-solid fa-volume-high", desc: "用于角色语音输出" },
      ],
      skillTabs: [
        { id: "library", label: "技能仓库", icon: "fa-solid fa-warehouse" },
        { id: "transform", label: "技能转化", icon: "fa-solid fa-arrows-spin" },
        { id: "crystal", label: "技能结晶", icon: "fa-solid fa-gem" },
      ],
      skillFilters: ["全部", "推荐", "已安装", "自定义"],
      transformSources: [
        { id: "conversation", label: "对话记录", icon: "fa-solid fa-comments" },
        { id: "prompt", label: "Prompt模板", icon: "fa-solid fa-terminal" },
        { id: "workflow", label: "工作流", icon: "fa-solid fa-diagram-project" },
      ],
      roleTabs: [
        { id: "memory", label: "角色卡&记忆", icon: "fa-solid fa-brain" },
        { id: "voice", label: "多角色语音", icon: "fa-solid fa-microphone" },
        { id: "appearance", label: "多角色外观", icon: "fa-solid fa-palette" },
        { id: "behavior", label: "自主行为", icon: "fa-solid fa-wand-magic-sparkles" },
        { id: "vision", label: "桌面视觉", icon: "fa-solid fa-eye" },
      ],
      voiceProviders: [
        { id: "azure", name: "Azure TTS", icon: "fa-brands fa-microsoft", iconClass: "voice-provider-card__icon--azure" },
        { id: "aliyun", name: "阿里云语音", icon: "fa-solid fa-cloud", iconClass: "voice-provider-card__icon--ali" },
        { id: "eleven", name: "ElevenLabs", icon: "fa-solid fa-wave-square", iconClass: "voice-provider-card__icon--eleven" },
      ],
      voiceRows: [
        { role: "智能助手", voice: "zh-CN-XiaoxiaoNeural", tone: "温和", enabled: true },
        { role: "代码专家", voice: "zh-CN-YunxiNeural", tone: "清晰", enabled: true },
        { role: "翻译官", voice: "zh-CN-XiaoyiNeural", tone: "自然", enabled: false },
      ],
      behaviorRules: [
        { id: "greeting", name: "定时问候", desc: "每天早上9点主动问候用户", freq: "频率: 每天", icon: "fa-solid fa-sun", className: "behavior-rule__icon--greeting", enabled: true },
        { id: "news", name: "新闻播报", desc: "自动抓取并播报热点新闻", freq: "频率: 每小时", icon: "fa-solid fa-newspaper", className: "behavior-rule__icon--news", enabled: false },
        { id: "remind", name: "任务提醒", desc: "在任务截止前30分钟提醒", freq: "触发: 事件驱动", icon: "fa-solid fa-bell", className: "behavior-rule__icon--remind", enabled: true },
        { id: "summary", name: "学习总结", desc: "每周生成学习进度总结报告", freq: "频率: 每周", icon: "fa-solid fa-chart-line", className: "behavior-rule__icon--summary", enabled: false },
      ],
      chatQuickTools: clone(chatQuickTools),
      deployTabs: clone(deployTabs),
      apiTabs: clone(apiTabs),
      apiDevTabs: clone(apiDevTabs),
      apiDevActions: clone(apiDevActions),
      storageTabs: clone(storageTabs),
      taskTabs: clone(taskTabs),
      taskPriorityTabs: clone(taskPriorityTabs),
      browserActions: clone(browserActions),
      browserInsightTabs: clone(browserInsightTabs),
      kernelTabs: clone(kernelTabs),
      kernelPlanRows: clone(kernelPlanRows),
      snapshotRows: clone(snapshotRows),
      accountMenuItems: clone(accountMenuItems),
      startupModules: clone(startupModules),
      loginProviders: clone(loginProviders),
      shellActions: clone(shellActions),
      modelAdvancedRows: clone(modelAdvancedRows),
      deployPanelActions: clone(deployPanelActions),
      apiEndpointRows: clone(apiEndpointRows),
      apiVrmActions: clone(apiVrmActions),
      apiDockerRows: clone(apiDockerRows),
      apiSnapshotRows: clone(apiSnapshotRows),
      apiAutomationRows: clone(apiAutomationRows),
      apiBrowserRows: clone(apiBrowserRows),
      apiCodeRows: clone(apiCodeRows),
      storageContinuationRows: clone(storageContinuationRows),
      kernelFlowSteps: clone(kernelFlowSteps),
      subscriptionComparisonRows: clone(subscriptionComparisonRows),
      taskPeopleRows: clone(taskPeopleRows),
      kernelEventFilters: clone(kernelEventFilters),
      kernelPlanFilters: clone(kernelPlanFilters),
      dashboardEntries: clone(dashboardEntries),
      storageRows: clone(storageRows),
      taskRows: clone(taskRows),
      taskWorkspacePath: "",
      deployBots: clone(deployBots),
      enterpriseSpaces: clone(enterpriseSpaces),
      enterpriseTabs: clone(enterpriseTabs),
      enterpriseMembers: clone(enterpriseMembers),
      enterpriseSymbolRows: clone(enterpriseSymbolRows),
      enterpriseOpsRows: clone(enterpriseOpsRows),
      systemSections: clone(systemSections),
      systemActionRows: clone(systemActionRows),
      browserCards: clone(browserCards),
      subscriptionPlans: clone(subscriptionPlans),
      subscriptionUsageRows: clone(subscriptionUsageRows),
      billingRows: clone(billingRows),
      aboutInfoRows: clone(aboutInfoRows),
      aboutFeatureRows: clone(aboutFeatureRows),
      aboutActions: clone(aboutActions),
    };
  },

  computed: {
    visibleMessages() {
      const realMessages = (this.messages || []).filter((message) => message.role !== "system");
      if (realMessages.length) return realMessages;
      return [
        {
          id: "welcome-ai",
          role: "assistant",
          content: "你好，我是 OpenXnet。可以直接发起对话，也可以从左侧进入模型配置、工具箱或技能中心。",
          time: this.formatTime(Date.now()),
        },
      ];
    },
    filteredConversations() {
      const query = this.globalSearch.trim().toLowerCase();
      if (!query) return this.conversations;
      return this.conversations.filter((conv) => String(conv.title || "").toLowerCase().includes(query));
    },
    activeAgentName() {
      const agents = this.settings.agents || {};
      const agent = agents[this.mainAgent] || agents[this.settings.mainAgent];
      return agent?.name || agent?.label || "代码分析助手";
    },
    currentModelLabel() {
      const match = this.modelOptions.find((model) => model.id === this.mainAgent);
      return match?.label || this.settings.model || this.mainAgent || "super-model";
    },
    modelOptions() {
      const fromProviders = this.providerCards.flatMap((provider) =>
        provider.models.map((model) => ({
          id: model.name,
          label: model.name,
          provider: provider.name,
          context: model.context || "128K",
          desc: `${provider.name} / ${model.caps.join("、")}`,
        }))
      );
      const agents = Object.entries(this.settings.agents || {}).map(([id, value]) => ({
        id,
        label: value.name || value.label || id,
        provider: "Agent",
        context: "runtime",
        desc: value.description || value.prompt || "OpenXnet Agent",
      }));
      const current = this.settings.mainAgent || this.mainAgent;
      const merged = [...agents, ...fromProviders];
      if (current && !merged.some((model) => model.id === current)) {
        merged.unshift({ id: current, label: current, provider: "OpenXnet", context: "runtime", desc: "当前运行模型" });
      }
      return merged;
    },
    providerCards() {
      return this.providers.length ? this.providers : clone(defaultProviders);
    },
    selectedProvider() {
      return this.providerCards.find((provider) => provider.id === this.selectedProviderId) || this.providerCards[0] || defaultProviders[0];
    },
    authProfile() {
      return this.currentUser?.profile || null;
    },
    authEntitlement() {
      return this.subscriptionEntitlement || this.currentUser?.entitlement || null;
    },
    isAuthenticated() {
      return Boolean(
        this.authProfile
        && (this.accessTokenConfigured || this.accessToken || this.currentUser),
      );
    },
    accountDisplayName() {
      return this.authProfile?.nickname || this.authProfile?.phone || this.authProfile?.email || "未登录用户";
    },
    accountAvatarInitial() {
      return initialsFor(this.accountDisplayName, "U", 1);
    },
    accountTooltip() {
      if (!this.isAuthenticated) return "登录 OpenXnet";
      return `${this.accountDisplayName} · ${this.authEntitlement?.active_plan_name || "未订阅"}`;
    },
    gatewayBootstrap() {
      const bootstrap = this.currentUser?.gateway_bootstrap || this.currentUser?.gatewayBootstrap;
      return bootstrap && typeof bootstrap === "object" ? bootstrap : null;
    },
    activeModelTab() {
      return this.modelTabs.find((tab) => tab.id === this.modelTab) || this.modelTabs[0];
    },
    filteredSkills() {
      const query = this.skillSearch.trim().toLowerCase();
      return this.skills.filter((skill) => {
        const matchesQuery = !query || [skill.name, skill.description, ...(skill.tags || [])].join(" ").toLowerCase().includes(query);
        const matchesFilter = this.skillFilter === "全部"
          || (this.skillFilter === "已安装" && skill.installed)
          || (this.skillFilter === "推荐" && skill.rating >= 4)
          || (this.skillFilter === "自定义" && skill.custom);
        return matchesQuery && matchesFilter;
      });
    },
    installedSkillsCount() {
      return this.skills.filter((skill) => skill.installed).length;
    },
    enabledSkillsCount() {
      return this.skills.filter((skill) => skill.enabled).length;
    },
    filteredTools() {
      const query = this.toolSearch.trim().toLowerCase();
      return this.toolkitTools.filter((tool) => !query || `${tool.name} ${tool.description}`.toLowerCase().includes(query));
    },
    selectedTool() {
      return this.toolkitTools.find((tool) => tool.id === this.selectedToolId) || this.toolkitTools[0] || this.defaultTool();
    },
    toolkitSections() {
      const sections = [
        { id: "builtin", label: "内置工具" },
        { id: "knowledge", label: "知识与素材" },
        { id: "custom", label: "自定义工具" },
        { id: "external", label: "外部集成" },
        { id: "protocol", label: "协议服务" },
      ];
      return sections
        .map((section) => ({
          ...section,
          tools: this.toolkitTools.filter((tool) => tool.section === section.id),
        }))
        .filter((section) => section.tools.length);
    },
    filteredRoles() {
      const query = this.roleSearch.trim().toLowerCase();
      const source = this.roles.filter((role) => !query || `${role.name} ${role.desc} ${role.tag}`.toLowerCase().includes(query));
      const priority = ["assistant", "coder", "translator", "writer", "analyst", "support-bot", "prototype-analyst", "prototype-support-bot"];
      return [...source].sort((a, b) => {
        const aIndex = priority.indexOf(a.id);
        const bIndex = priority.indexOf(b.id);
        return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
      });
    },
    selectedRole() {
      return this.roles.find((role) => role.id === this.selectedRoleId) || this.roles[0] || this.defaultRole();
    },
    placeholderPage() {
      return placeholderPages[this.currentRoute] || placeholderPages.home;
    },
    crystalSkills() {
      return this.skills.slice(0, 8);
    },
    crystalPipeline() {
      const installed = this.skills.filter((skill) => skill.installed).slice(0, 3);
      return installed.length ? installed : defaultSkills.slice(0, 3);
    },
    dashboardGreeting() {
      const hour = new Date().getHours();
      if (hour < 6) return "夜深了";
      if (hour < 12) return "早上好";
      if (hour < 18) return "下午好";
      return "晚上好";
    },
    dashboardDate() {
      return new Date().toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long",
      });
    },
    dashboardStats() {
      return [
        { label: "模型提供商", value: this.providerCards.length, hint: `${this.providerCards.filter((provider) => provider.connected).length} 个已连接`, icon: "fa-solid fa-microchip", tone: "blue" },
        { label: "工具运行", value: this.toolkitTools.filter((tool) => tool.enabled).length, hint: `${this.toolkitTools.length} 个工具已注册`, icon: "fa-solid fa-toolbox", tone: "green" },
        { label: "已启用技能", value: this.enabledSkillsCount, hint: `${this.installedSkillsCount} 个已安装`, icon: "fa-solid fa-wand-magic-sparkles", tone: "purple" },
        { label: "角色数量", value: this.roles.length, hint: this.selectedRole.name || "默认角色", icon: "fa-solid fa-user-gear", tone: "rose" },
        { label: "活跃角色", value: this.roles.filter((role) => role.enabled !== false).length, hint: `${this.voiceRows.filter((row) => row.enabled).length} 个语音已启用`, icon: "fa-solid fa-users-gear", tone: "orange" },
        { label: "账号权益", value: this.authEntitlement?.active_plan_name || (this.isAuthenticated ? "已登录" : "未登录"), hint: this.subscriptionStatusLabel, icon: "fa-solid fa-crown", tone: this.authEntitlement?.premium_model_access ? "green" : "amber" },
      ];
    },
    recentConversationRows() {
      const rows = this.conversations.slice(0, 4);
      if (rows.length) return rows;
      return [
        { id: "sample-1", title: "UIPlan 页面重写方案", timestamp: Date.now() - 1000 * 60 * 18, messages: [{ content: "对齐原型视觉与功能入口" }] },
        { id: "sample-2", title: "模型配置与工具调度", timestamp: Date.now() - 1000 * 60 * 80, messages: [{ content: "检查 provider、toolkit 与 settings 同步" }] },
        { id: "sample-3", title: "桌面视觉角色设置", timestamp: Date.now() - 1000 * 60 * 240, messages: [{ content: "完善角色卡、语音和视觉权限" }] },
      ];
    },
    kernelMetrics() {
      const stats = this.neuroStats || {};
      return [
        { label: "内核状态", value: this.wsConnected ? "运行中" : "连接中", tone: this.wsConnected ? "green" : "amber" },
        { label: "符号总数", value: this.formatNumber(stats.total_symbols || stats.symbol_count || 0), tone: "blue" },
        { label: "活跃推理链", value: String(stats.active_chains || this.toolkitTools.filter((tool) => tool.enabled).length || 3), tone: "purple" },
        { label: "今日推理", value: this.formatNumber(stats.today_matches || stats.reasoning_count || 0), tone: "green" },
        { label: "内存占用", value: `${Math.max(24, this.messages.length * 6)} MB`, tone: "gray" },
      ];
    },
    storageStats() {
      const totalSize = this.storageRows.reduce((sum, row) => sum + (parseFloat(row.size) || 0), 0);
      return [
        { label: "文件数量", value: this.storageRows.length, hint: "素材、文档与记录" },
        { label: "已用空间", value: `${Math.round(totalSize + 182)} MB`, hint: "本地工作区缓存" },
        { label: "回忆条目", value: this.conversations.length || 12, hint: "长期记忆索引" },
      ];
    },
    enabledToolRows() {
      return this.toolkitTools.filter((tool) => tool.enabled).slice(0, 6);
    },
    activeEnterpriseTab() {
      return this.enterpriseTabs.find((tab) => tab.id === this.enterpriseTab) || this.enterpriseTabs[0];
    },
    filteredEnterpriseMembers() {
      const query = this.enterpriseSearch.trim().toLowerCase();
      if (!query) return this.enterpriseMembers;
      return this.enterpriseMembers.filter((member) => `${member.name} ${member.role} ${member.group} ${member.agents}`.toLowerCase().includes(query));
    },
    activeSystemSection() {
      return this.systemSections.find((section) => section.id === this.systemActiveSection) || this.systemSections[0];
    },
    subscriptionStatusLabel() {
      const status = this.authEntitlement?.subscription_status || this.subscriptionExpiry?.subscription_status || (this.isAuthenticated ? "active" : "guest");
      const map = {
        active: "权益有效",
        paid: "已支付",
        trial: "试用中",
        expired: "已过期",
        pending: "待支付",
        guest: "未登录",
      };
      return map[status] || status || "未同步";
    },
    subscriptionStatusClass() {
      const status = this.authEntitlement?.subscription_status || this.subscriptionExpiry?.subscription_status;
      if (["active", "paid", "trial"].includes(status)) return "uip-status-pill--green";
      if (["pending", "grace"].includes(status)) return "uip-status-pill--warning";
      return "";
    },
    subscriptionCurrentPlan() {
      const activeCode = this.authEntitlement?.active_plan_code || this.subscriptionCredits?.active_plan_code || this.subscriptionExpiry?.active_plan_code;
      const match = this.subscriptionPlans.find((plan) => plan.current || (activeCode && plan.id === activeCode));
      return match || this.subscriptionPlans[0];
    },
    subscriptionExpiryText() {
      const expireAt = this.authEntitlement?.vip_expire_at || this.subscriptionExpiry?.vip_expire_at;
      if (!expireAt) return this.isAuthenticated ? "未获取到到期时间" : "登录后同步到期时间";
      const days = Number(this.subscriptionExpiry?.days_remaining);
      const suffix = Number.isFinite(days) && days > 0 ? `，剩余 ${Math.ceil(days)} 天` : "";
      return `${this.formatFullDate(expireAt)}${suffix}`;
    },
    subscriptionActionText() {
      if (this.subscriptionLoading) return "正在同步套餐与额度";
      if (!this.isAuthenticated) return "登录后可购买、续费和升级套餐";
      if (this.lastOrder?.order_no) return `订单 ${this.lastOrder.order_no} 已创建，等待支付确认`;
      return this.subscriptionNotice || "套餐权益以支付确认后的服务端状态为准";
    },
    providerActionText() {
      if (this.providerActionLoading) return "正在连接模型服务";
      if (this.providerError) return this.providerError;
      if (this.providerNotice) return this.providerNotice;
      if (!this.selectedProvider?.url) return "填写 Base URL 后可验证连通性并拉取模型列表";
      return this.selectedProvider.connected ? "Provider 已通过验证并保存到当前配置" : "Provider 尚未验证";
    },
    providerActionClass() {
      return this.providerError ? "uip-inline-alert--error" : "";
    },
    apiStatusRows() {
      return apiGroups.map((group) => ({
        ...group,
        enabled: group.status === "运行中",
      }));
    },
    filteredTaskRows() {
      return this.taskRows.filter((task) => {
        const statusMatch = this.taskTab === "all" || task.tone === this.taskTab;
        const priorityMatch = this.taskPriorityTab === "all" || task.priority === this.taskPriorityTab;
        return statusMatch && priorityMatch;
      });
    },
    activeDeployPanels() {
      return this.deployPanelActions[this.deployTab] || this.deployPanelActions.common || [];
    },
    apiPanelTitle() {
      const titleMap = {
        new: "新建 API",
        openai: "OpenAI API 端点",
        mcp: "MCP Server 列表",
        vrm: "VRM 模型列表",
        gateway: "模型映射",
        models: "模型导入",
        snapshots: "快照列表",
        docker: "Docker Compose 配置",
        scripts: "自动化脚本列表",
        code: "代码搜索",
        extension: "已安装扩展",
        docs: "FastAPI文档",
      };
      return titleMap[this.apiTab] || "API 端点";
    },
    apiDocsUrl() {
      return `${window.location.origin || "http://127.0.0.1:3456"}/docs`;
    },
    apiPanelRows() {
      if (this.apiTab === "docker") return this.apiDockerRows;
      if (this.apiTab === "code") return this.apiCodeRows;
      if (this.apiTab === "extension") return this.apiBrowserRows;
      if (this.apiTab === "snapshots") return this.apiSnapshotRows;
      if (this.apiTab === "scripts") return this.apiAutomationRows;
      if (this.apiTab === "vrm") return this.apiVrmActions;
      return this.apiEndpointRows.filter((row) => {
        if (this.apiTab === "openai") return row.type === "OpenAI API";
        if (this.apiTab === "mcp") return row.type === "MCP API";
        return true;
      });
    },
    activeStorageRows() {
      if (this.storageTab === "text") {
        return this.storageRows.filter((file) => !["图片", "视频"].includes(file.type));
      }
      if (this.storageTab === "images") {
        return this.storageRows.filter((file) => file.type === "图片");
      }
      if (this.storageTab === "videos") {
        return this.storageRows.filter((file) => file.type === "视频");
      }
      if (this.storageTab === "recall") {
        return [
          { name: "长期记忆索引.db", type: "回忆", size: "64 MB", updated: "今天 10:12", icon: "fa-solid fa-brain", tone: "purple" },
          { name: "对话摘要归档.json", type: "回忆", size: "18 MB", updated: "昨天 22:18", icon: "fa-solid fa-comments", tone: "blue" },
        ];
      }
      if (this.storageTab === "backup") {
        return [
          { name: "配置备份.json", type: "备份", size: "420 KB", updated: "05-04 08:00", icon: "fa-solid fa-box-archive", tone: "green" },
          { name: "部署配置.yaml", type: "备份", size: "120 KB", updated: "05-03 12:40", icon: "fa-solid fa-file-code", tone: "orange" },
        ];
      }
      return this.storageRows;
    },
    systemStatusRows() {
      const engineLabel = this.engineStatus?.status || this.engineStatus?.engine_status || (this.wsConnected ? "运行中" : "连接中");
      return [
        ["主入口", "/uiplan/"],
        ["后端连接", this.wsConnected ? "已连接" : "重连中"],
        ["内核状态", toDisplayString(engineLabel, "未同步")],
        ["当前模型", this.currentModelLabel],
        ["账号状态", this.isAuthenticated ? this.accountDisplayName : "未登录"],
        ["资源版本", UI_RESOURCE_VERSION],
      ];
    },
  },

    async created() {
      this.syncRouteFromHash();
      window.addEventListener("hashchange", this.syncRouteFromHash);
      await this.loadStoredAuth();
      this.updateClock();
    setInterval(this.updateClock, 1000);
    this.toolkitTools = this.buildToolsFromSettings({});
    this.roles = this.buildRolesFromSettings({});
    this.connectWs();
    this.fetchSkills();
      this.fetchModels();
      this.fetchAccessPlans();
      this.fetchAccessProfile({ silent: true });
      this.fetchSubscriptionStatus({ silent: true });
      this.loadTasks({ silent: true });
      this.fetchEngineStatus({ silent: true });
      this.fetchApiWorkbenchOverview({ silent: true });
      this.fetchNeuroState({ silent: true });
    },

  mounted() {
    nextTick(this.scrollMessagesToBottom);
    if (typeof window.openxnetDesktop?.onTaskExecutionChanged === "function") {
      this.taskExecutionUnsubscribe = window.openxnetDesktop.onTaskExecutionChanged((snapshot) => {
        this.applyApplicationTaskRows(snapshot);
      });
    }
  },

  /** Release the Core task snapshot listener when the alternate workspace unmounts. */
  beforeUnmount() {
    this.taskExecutionUnsubscribe?.();
    this.taskExecutionUnsubscribe = null;
  },

  methods: {
    navigate(route) {
      window.location.hash = route;
      this.currentRoute = route;
      if (route === "storage") this.loadApplicationArtifactRows();
    },
    handleAccountAction(item) {
      if (!item) return;
      if (item.action === "logout") {
        this.logoutAccess();
        return;
      }
      if (item.requiresAuth && !this.isAuthenticated) {
        this.navigate("login");
        return;
      }
      this.navigate(item.route);
    },
    markAction(label) {
      this.lastAction = `${label} · ${this.formatTime(Date.now())}`;
    },
    syncRouteFromHash() {
      const route = window.location.hash.replace(/^#\/?/, "") || "startup";
      this.currentRoute = route;
      if (route === "storage") this.loadApplicationArtifactRows();
    },
    /** Format an artifact byte count for the compact storage table. */
    formatApplicationArtifactSize(value) {
      const bytes = Math.max(0, Number(value || 0));
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    },
    /** Convert one Core artifact into the UI-plan storage row shape. */
    mapApplicationArtifactRow(artifact) {
      const kind = String(artifact?.kind || "document");
      const extension = String(artifact?.originalName || artifact?.storageName || "")
        .split(".")
        .pop()
        .toUpperCase();
      const presentation = kind === "image"
        ? { type: "图片", icon: "fa-solid fa-image", tone: "green" }
        : kind === "video"
          ? { type: "视频", icon: "fa-solid fa-film", tone: "rose" }
          : {
              type: extension === "MD" || extension === "MARKDOWN" ? "Markdown" : (extension || "文本"),
              icon: extension === "MD" || extension === "MARKDOWN" ? "fa-brands fa-markdown" : "fa-solid fa-file-lines",
              tone: "blue",
            };
      return {
        artifactId: String(artifact?.id || ""),
        storageName: String(artifact?.storageName || ""),
        name: String(artifact?.originalName || artifact?.storageName || ""),
        size: this.formatApplicationArtifactSize(artifact?.sizeBytes),
        updated: artifact?.createdAt ? new Date(artifact.createdAt).toLocaleString("zh-CN") : "刚刚同步",
        ...presentation,
      };
    },
    /** Load real storage rows from the lazy migration-managed Desktop Core catalog. */
    async loadApplicationArtifactRows() {
      if (typeof window.openxnetDesktop?.listArtifacts !== "function") return;
      try {
        const snapshot = await window.openxnetDesktop.listArtifacts({});
        this.storageRows = Array.isArray(snapshot?.artifacts)
          ? snapshot.artifacts.map((artifact) => this.mapApplicationArtifactRow(artifact))
          : [];
      } catch (error) {
        console.error("Load Core artifacts failed:", error);
      }
    },
    updateClock() {
      this.clock = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    },
    connectWs() {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      this.ws = ws;
      ws.addEventListener("open", () => {
        this.wsConnected = true;
        this.sendWs({ type: "get_settings" });
      });
      ws.addEventListener("message", (event) => this.handleWsMessage(event));
      ws.addEventListener("close", () => {
        this.wsConnected = false;
        setTimeout(() => this.connectWs(), 2000);
      });
      ws.addEventListener("error", () => {
        this.wsConnected = false;
      });
    },
    sendWs(payload) {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(payload));
      }
    },
    handleWsMessage(event) {
      let payload;
      try {
        payload = JSON.parse(event.data);
      } catch (_) {
        return;
      }
      if (payload.type === "settings" && payload.data) {
        this.applySettings(payload.data);
      }
      if (payload.type === "settings_saved") {
        this.settingsLoaded = true;
      }
    },
    applySettings(data) {
      this.settings = data || {};
      this.settingsLoaded = true;
      this.conversations = Array.isArray(data.conversations) ? data.conversations : [];
      this.conversationId = data.conversationId || this.conversations[0]?.id || null;
      this.mainAgent = data.mainAgent || data.model || this.mainAgent;
      this.temperature = Number(data.temperature ?? this.temperature);
      this.maxTokens = Number(data.max_tokens ?? this.maxTokens);
      this.webSearchEnabled = Boolean(data.webSearch?.enabled);
      this.thinkingEnabled = Boolean(data.enable_thinking || data.reasoner?.enabled);
      this.deepResearchEnabled = Boolean(data.enable_deep_research || data.tools?.deepsearch?.enabled);
      this.providers = this.buildProvidersFromSettings(data);
      this.syncManagedAccessProviderFromCurrentUser({ persist: true, forceSelect: false });
      this.toolkitTools = this.buildToolsFromSettings(data);
      this.roles = this.buildRolesFromSettings(data);
      this.loadConversation(this.conversationId, { silent: true });
    },
    refreshAll() {
      this.sendWs({ type: "get_settings" });
      this.fetchSkills();
      this.fetchModels();
      this.syncSubscription();
      this.loadTasks({ silent: true });
      this.fetchEngineStatus({ silent: true });
      this.fetchApiWorkbenchOverview({ silent: true });
      this.fetchNeuroState({ silent: true });
    },
    async apiRequest(path, options = {}) {
      const headers = this.authHeaders(options.headers || {});
      const response = await fetch(path, { ...options, headers });
      const text = await response.text();
      let payload = null;
      if (text) {
        try {
          payload = JSON.parse(text);
        } catch (_) {
          payload = { message: text };
        }
      }
      if (!response.ok || payload?.success === false) {
        const detail = payload?.detail || payload?.error || payload?.message || `${response.status} ${response.statusText}`;
        throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
      }
      return payload;
    },
    async openExternalUrl(url) {
      if (!url) return;
      try {
        if (window.electronAPI?.openExternal) {
          await window.electronAPI.openExternal(url);
        } else {
          window.open(url, "_blank", "noopener");
        }
        this.markAction("打开外部链接");
      } catch (error) {
        this.markAction(`打开链接失败: ${error.message || error}`);
      }
    },
    async openLocalPath(path) {
      if (!path) return;
      try {
        if (window.electronAPI?.openPath) {
          await window.electronAPI.openPath(path);
          this.markAction("打开本地路径");
          return;
        }
      } catch (error) {
        this.markAction(`打开路径失败: ${error.message || error}`);
        return;
      }
      this.copyText(path, "路径");
    },
    authHeaders(extra = {}) {
      return this.accessToken
        ? { ...extra, Authorization: `Bearer ${this.accessToken}` }
        : { ...extra };
    },
    /** Reconstruct the UI-plan account response shape from a Core auth state. */
    mapCoreAuthStateToCurrentUser(authState = {}) {
      const profile = authState.profile || {};
      const usage = authState.gatewayUsage || {};
      return {
        profile: {
          id: profile.id || "",
          nickname: profile.name || "",
          phone: profile.phone || "",
          email: profile.email || "",
          avatar_url: profile.avatarUrl || "",
          vip_level: profile.vipLevel || "free",
        },
        entitlement: {
          premium_plan_codes: authState.availablePlanCodes || [],
          active_plan_code: authState.activePlanCode || "",
          active_plan_name: authState.activePlanName || "",
          subscription_status: authState.subscriptionStatus || "free",
          pending_order_no: authState.pendingOrderNo || "",
          vip_expire_at: authState.vipExpireAt || "",
          enterprise_access: authState.enterpriseAccess === true,
          premium_model_access: authState.premiumModelAccess === true,
        },
        gateway_bootstrap: authState.gatewayBootstrap || null,
        gateway_usage: {
          sync_status: usage.syncStatus || "idle",
          available: usage.available === true,
          quota: Number(usage.quota || 0),
          used_quota: Number(usage.usedQuota || 0),
          remaining_quota: Number(usage.remainingQuota || 0),
          usage_ratio: Number(usage.usageRatio || 0),
          request_count: Number(usage.requestCount || 0),
          group: usage.group || "",
          gateway_uid: Number(usage.gatewayUid || 0),
          gateway_username: usage.gatewayUsername || "",
          plan_id: Number(usage.planId || 0),
          error: usage.error || "",
        },
      };
    },
    /** Convert the UI-plan account response into the shared Core auth state. */
    buildCoreAuthState() {
      const profile = this.currentUser?.profile || {};
      const entitlement = this.currentUser?.entitlement || {};
      const usage = this.currentUser?.gateway_usage || {};
      const activePlanCode = String(entitlement.active_plan_code || "");
      return {
        status: activePlanCode || entitlement.premium_model_access
          ? "signed_in_premium"
          : "signed_in_basic",
        profile: {
          name: String(profile.nickname || profile.phone || profile.email || ""),
          id: String(profile.id || profile.email || profile.phone || ""),
          phone: String(profile.phone || ""),
          email: String(profile.email || ""),
          avatarUrl: String(profile.avatar_url || ""),
          vipLevel: String(profile.vip_level || "free"),
        },
        premiumPlanCodes: activePlanCode ? [activePlanCode] : [],
        availablePlanCodes: Array.isArray(entitlement.premium_plan_codes)
          ? entitlement.premium_plan_codes.map(String)
          : [],
        lastPlanCode: activePlanCode,
        subscriptionStatus: String(entitlement.subscription_status || "free"),
        activePlanCode,
        activePlanName: String(entitlement.active_plan_name || ""),
        pendingOrderNo: String(entitlement.pending_order_no || ""),
        vipExpireAt: String(entitlement.vip_expire_at || ""),
        enterpriseAccess: entitlement.enterprise_access === true,
        premiumModelAccess: entitlement.premium_model_access === true,
        gatewayBootstrap: this.currentUser?.gateway_bootstrap || null,
        gatewayUsage: {
          syncStatus: String(usage.sync_status || "idle"),
          available: usage.available === true,
          quota: Number(usage.quota || 0),
          usedQuota: Number(usage.used_quota || 0),
          remainingQuota: Number(usage.remaining_quota || 0),
          usageRatio: Number(usage.usage_ratio || 0),
          requestCount: Number(usage.request_count || 0),
          group: String(usage.group || ""),
          gatewayUid: Number(usage.gateway_uid || 0),
          gatewayUsername: String(usage.gateway_username || ""),
          planId: Number(usage.plan_id || 0),
          error: String(usage.error || ""),
        },
      };
    },
    /** Apply one redacted Core authentication snapshot to UI-plan state. */
    applyCoreAuthSnapshot(snapshot = {}) {
      this.accessToken = "";
      this.refreshToken = "";
      this.accessTokenConfigured = snapshot?.authSession?.accessTokenConfigured === true;
      this.refreshTokenConfigured = snapshot?.authSession?.refreshTokenConfigured === true;
      this.accessTokenExpiresAt = Date.parse(snapshot?.authSession?.expiresAt || "") || 0;
      this.refreshTokenExpiresAt = Date.parse(snapshot?.authSession?.refreshExpiresAt || "") || 0;
      if (Number(snapshot?.revision || 0) > 0 && snapshot?.authState?.status !== "guest") {
        this.currentUser = this.mapCoreAuthStateToCurrentUser(snapshot.authState);
        this.subscriptionEntitlement = this.currentUser.entitlement;
        return true;
      }
      this.currentUser = null;
      this.subscriptionEntitlement = null;
      return false;
    },
    /** Hydrate OS-protected Core auth, falling back to one legacy browser payload. */
    async loadStoredAuth() {
      if (typeof window.openxnetDesktop?.getAuthSession === "function") {
        try {
          const snapshot = await window.openxnetDesktop.getAuthSession();
          if (this.applyCoreAuthSnapshot(snapshot)) {
            localStorage.removeItem(ACCESS_AUTH_STORAGE_KEY);
            return;
          }
        } catch (error) {
          console.error("Load Core authentication failed:", error);
        }
      }
      try {
        const raw = localStorage.getItem(ACCESS_AUTH_STORAGE_KEY);
        if (!raw) return;
        const stored = JSON.parse(raw);
        if (typeof window.openxnetDesktop?.requestAccess !== "function") {
          this.accessToken = String(stored.accessToken || "");
          this.refreshToken = String(stored.refreshToken || "");
          this.accessTokenExpiresAt = Number(stored.accessTokenExpiresAt || 0);
          this.refreshTokenExpiresAt = Number(stored.refreshTokenExpiresAt || 0);
        }
        localStorage.removeItem(ACCESS_AUTH_STORAGE_KEY);
      } catch (_) {
        await this.clearStoredAuth({ silent: true });
      }
    },
    /** Persist the UI-plan session through Core and remove the legacy browser copy. */
    async persistStoredAuth(session = {}) {
      if (typeof window.openxnetDesktop?.requestAccess === "function") {
        const snapshot = await window.openxnetDesktop.getAuthSession();
        this.applyCoreAuthSnapshot(snapshot);
        localStorage.removeItem(ACCESS_AUTH_STORAGE_KEY);
        return;
      }
      this.accessToken = String(session.access_token || session.accessToken || this.accessToken || "");
      this.refreshToken = String(session.refresh_token || session.refreshToken || this.refreshToken || "");
      const now = Date.now();
      const accessTtl = Number(session.expires_in || 0);
      const refreshTtl = Number(session.refresh_expires_in || 0);
      if (accessTtl > 0) this.accessTokenExpiresAt = now + accessTtl * 1000;
      if (refreshTtl > 0) this.refreshTokenExpiresAt = now + refreshTtl * 1000;
      if (typeof window.openxnetDesktop?.saveAuthSession === "function" && this.currentUser) {
        await window.openxnetDesktop.saveAuthSession({
          authState: this.buildCoreAuthState(),
          authSession: {
            accessToken: this.accessToken,
            refreshToken: this.refreshToken,
            expiresAt: this.accessTokenExpiresAt ? new Date(this.accessTokenExpiresAt).toISOString() : "",
            refreshExpiresAt: this.refreshTokenExpiresAt
              ? new Date(this.refreshTokenExpiresAt).toISOString()
              : "",
          },
        });
        localStorage.removeItem(ACCESS_AUTH_STORAGE_KEY);
        return;
      }
      localStorage.removeItem(ACCESS_AUTH_STORAGE_KEY);
    },
    /** Clear UI-plan account state and the shared Core credential record. */
    clearStoredAuth(options = {}) {
      this.accessToken = "";
      this.refreshToken = "";
      this.accessTokenConfigured = false;
      this.refreshTokenConfigured = false;
      this.accessTokenExpiresAt = 0;
      this.refreshTokenExpiresAt = 0;
      this.currentUser = null;
      this.subscriptionEntitlement = null;
      this.subscriptionCredits = null;
      this.subscriptionExpiry = null;
      this.lastOrder = null;
      localStorage.removeItem(ACCESS_AUTH_STORAGE_KEY);
      this.syncManagedAccessProviderFromCurrentUser({ persist: true });
      if (!options.silent) this.markAction("已退出登录");
      return window.openxnetDesktop?.clearAuthSession?.() || Promise.resolve(null);
    },
    async accessRequest(path, options = {}) {
      if (typeof window.openxnetDesktop?.requestAccess === "function") {
        let body = options.body;
        if (typeof body === "string" && body) {
          try {
            body = JSON.parse(body);
          } catch {
            throw new Error("请求数据格式无效");
          }
        }
        const result = await window.openxnetDesktop.requestAccess({
          path: String(path || ""),
          method: String(options.method || "GET").toUpperCase(),
          ...(body !== undefined ? { body } : {}),
        });
        if (result?.authSnapshot) this.applyCoreAuthSnapshot(result.authSnapshot);
        if (!result?.ok) {
          const requestError = new Error(result?.error?.message || "账户服务请求失败");
          requestError.statusCode = Number(result?.status || 500);
          throw requestError;
        }
        return result.payload;
      }
      const headers = this.authHeaders(options.headers || {});
      const response = await fetch(path, { ...options, headers });
      const text = await response.text();
      let payload = null;
      if (text) {
        try {
          payload = JSON.parse(text);
        } catch (_) {
          payload = { message: text };
        }
      }
      if (!response.ok) {
        const detail = payload?.detail || payload?.message || payload?.error || `${response.status} ${response.statusText}`;
        throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
      }
      return payload;
    },
    async fetchAccessProfile(options = {}) {
      if (!this.accessTokenConfigured && !this.accessToken) return null;
      try {
        const data = await this.accessRequest("/v1/access/auth/me");
        this.currentUser = data;
        this.subscriptionEntitlement = data?.entitlement || null;
        await this.persistStoredAuth();
        this.syncManagedAccessProviderFromCurrentUser({ persist: true, forceSelect: false });
        this.updateSubscriptionFromEntitlement();
        return data;
      } catch (error) {
        if (!options.silent) this.authError = error.message || "账号状态同步失败";
        if (String(error.message || "").includes("401") || String(error.message || "").includes("403")) {
          await this.clearStoredAuth({ silent: true });
        }
        return null;
      }
    },
    async fetchAccessPlans(options = {}) {
      try {
        const data = await this.accessRequest("/v1/access/plans");
        const plans = Array.isArray(data) ? data : Array.isArray(data?.plans) ? data.plans : [];
        if (!plans.length) return;
        this.accessPlans = plans;
        this.subscriptionPlans = plans.map((plan) => this.mapAccessPlan(plan));
        this.updateSubscriptionFromEntitlement();
      } catch (error) {
        if (!options.silent) this.subscriptionError = error.message || "套餐列表加载失败";
      }
    },
    async fetchSubscriptionStatus(options = {}) {
      if (!this.accessTokenConfigured && !this.accessToken) return;
      this.subscriptionLoading = !options.silent;
      try {
        const [credits, expiry] = await Promise.all([
          this.accessRequest("/v1/access/sub/credits").catch((error) => ({ _error: error.message })),
          this.accessRequest("/v1/access/sub/expiry-status").catch((error) => ({ _error: error.message })),
        ]);
        if (!credits?._error) this.subscriptionCredits = credits;
        if (!expiry?._error) this.subscriptionExpiry = expiry;
        this.updateSubscriptionUsageRows();
        this.updateSubscriptionFromEntitlement();
        if (!options.silent) this.subscriptionNotice = "订阅与额度已同步";
      } catch (error) {
        if (!options.silent) this.subscriptionError = error.message || "订阅同步失败";
      } finally {
        this.subscriptionLoading = false;
      }
    },
    async syncSubscription() {
      this.subscriptionError = "";
      this.subscriptionNotice = "";
      await this.fetchAccessPlans({ silent: true });
      await this.fetchAccessProfile({ silent: true });
      await this.fetchSubscriptionStatus();
      this.markAction("同步订阅");
    },
    mapAccessPlan(plan = {}) {
      const code = String(plan.code || plan.id || "").trim() || makeId();
      const price = Number(plan.price_monthly ?? plan.price ?? 0);
      const features = Array.isArray(plan.features)
        ? plan.features.map((feature) => typeof feature === "string" ? feature : feature.text).filter(Boolean)
        : [];
      const storage = Number(plan.storage_mb || 0);
      const quotaParts = [];
      if (plan.daily_quota) quotaParts.push(`每日 ${this.formatNumber(plan.daily_quota)} 次`);
      if (plan.monthly_quota) quotaParts.push(`每月 ${this.formatNumber(plan.monthly_quota)} 次`);
      if (storage) quotaParts.push(`${this.formatStorageMb(storage)} 存储`);
      const current = Boolean(plan.active || (this.authEntitlement?.active_plan_code && this.authEntitlement.active_plan_code === code));
      return {
        id: code,
        raw: plan,
        name: plan.name || code,
        subtitle: plan.subtitle || plan.description || "",
        price: price > 0 ? String(price).replace(/\.0+$/, "") : "0",
        quota: quotaParts.join(" · ") || plan.description || plan.subtitle || "基础权益",
        current,
        purchased: Boolean(plan.purchased),
        canPurchase: plan.can_purchase !== false,
        canRenew: Boolean(plan.can_renew),
        canUpgrade: Boolean(plan.can_upgrade),
        cta: this.planActionLabel({ current, plan }),
        features: features.length ? features.slice(0, 7) : ["模型调用额度", "工具与技能访问", "本地工作台同步"],
      };
    },
    planActionLabel({ current, plan }) {
      if (current) return "当前套餐";
      if (plan?.can_renew) return "续费";
      if (plan?.can_upgrade) return "升级";
      if (plan?.can_purchase === false) return "不可购买";
      if (String(plan?.price_monthly ?? "") === "0") return "启用免费版";
      return "购买";
    },
    updateSubscriptionFromEntitlement() {
      const activeCode = this.authEntitlement?.active_plan_code || this.subscriptionCredits?.active_plan_code || this.subscriptionExpiry?.active_plan_code;
      if (!activeCode) return;
      this.subscriptionPlans = this.subscriptionPlans.map((plan) => ({
        ...plan,
        current: plan.id === activeCode,
        cta: plan.id === activeCode ? "当前套餐" : plan.cta,
      }));
    },
    updateSubscriptionUsageRows() {
      const credits = this.subscriptionCredits;
      const gateway = this.currentUser?.gateway_usage || {};
      const rows = [];
      if (credits) {
        rows.push({
          label: "今日模型额度",
          used: this.formatNumber(credits.daily_used || 0),
          total: this.formatNumber(credits.daily_quota || 0),
          percent: this.percentOf(credits.daily_used || 0, credits.daily_quota || 0),
        });
        rows.push({
          label: "总剩余额度",
          used: this.formatNumber(Math.max(0, Number(credits.total_cap || 0) - Number(credits.total_remaining || 0))),
          total: this.formatNumber(credits.total_cap || credits.monthly_quota || 0),
          percent: this.percentOf(Math.max(0, Number(credits.total_cap || 0) - Number(credits.total_remaining || 0)), credits.total_cap || credits.monthly_quota || 0),
        });
        rows.push({
          label: "充值额度",
          used: this.formatNumber(credits.topup_credits || 0),
          total: this.formatNumber((credits.topup_credits || 0) + (credits.bonus_credits || 0)),
          percent: this.percentOf(credits.topup_credits || 0, (credits.topup_credits || 0) + (credits.bonus_credits || 0)),
        });
      }
      if (gateway.available || gateway.quota) {
        rows.push({
          label: "网关调用",
          used: this.formatNumber(gateway.used_quota || 0),
          total: this.formatNumber(gateway.quota || 0),
          percent: Math.round(Number(gateway.usage_ratio || 0) * 100) || this.percentOf(gateway.used_quota || 0, gateway.quota || 0),
        });
      }
      if (rows.length) this.subscriptionUsageRows = rows;
    },
    setLoginMode(mode) {
      this.loginMode = mode;
      this.authError = "";
      this.authNotice = "";
    },
    loginPayloadBase() {
      return { ...ACCESS_AGREEMENT_PAYLOAD };
    },
    async loginWithPassword() {
      this.authError = "";
      this.authNotice = "";
      const identity = this.loginIdentity.trim();
      if (!identity || !this.loginPassword) {
        this.authError = "请输入账号和密码";
        return;
      }
      this.authLoading = true;
      try {
        const data = await this.accessRequest("/v1/access/auth/login/password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identity, password: this.loginPassword, ...this.loginPayloadBase() }),
        });
        await this.applyAuthSession(data);
      } catch (error) {
        this.authError = error.message || "登录失败";
      } finally {
        this.authLoading = false;
      }
    },
    async sendLoginSms() {
      this.authError = "";
      this.authNotice = "";
      const phone = this.loginPhone.trim();
      if (!phone) {
        this.authError = "请输入手机号";
        return;
      }
      try {
        const purpose = this.loginMode === "register" ? "register" : "login";
        const data = await this.accessRequest("/v1/access/auth/sms/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, purpose }),
        });
        const cooldown = Number(data?.cooldown_seconds || 60);
        this.startSmsCooldown(cooldown);
        this.authNotice = `验证码已发送，有效期 ${Math.round(Number(data?.expires_in || 300) / 60)} 分钟`;
      } catch (error) {
        this.authError = error.message || "验证码发送失败";
      }
    },
    async loginWithSms() {
      this.authError = "";
      this.authNotice = "";
      const phone = this.loginPhone.trim();
      const code = this.loginCode.trim();
      if (!phone || !code) {
        this.authError = "请输入手机号和验证码";
        return;
      }
      this.authLoading = true;
      try {
        const data = await this.accessRequest("/v1/access/auth/login/sms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, code, ...this.loginPayloadBase() }),
        });
        await this.applyAuthSession(data);
      } catch (error) {
        this.authError = error.message || "短信登录失败";
      } finally {
        this.authLoading = false;
      }
    },
    async registerAccess() {
      this.authError = "";
      this.authNotice = "";
      const phone = this.loginPhone.trim();
      const code = this.loginCode.trim();
      const password = this.loginPassword;
      const nickname = this.loginNickname.trim() || `OpenXnet${phone.slice(-4)}`;
      if (!phone || !code || !password) {
        this.authError = "请输入手机号、验证码和密码";
        return;
      }
      if (password.length < 8) {
        this.authError = "密码至少 8 位";
        return;
      }
      this.authLoading = true;
      try {
        const data = await this.accessRequest("/v1/access/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone,
            code,
            password,
            nickname,
            email: this.loginEmail.trim(),
            ...this.loginPayloadBase(),
          }),
        });
        await this.applyAuthSession(data);
      } catch (error) {
        this.authError = error.message || "注册失败";
      } finally {
        this.authLoading = false;
      }
    },
    startSmsCooldown(seconds) {
      this.loginSmsCooldown = Math.max(0, Number(seconds) || 0);
      if (this.loginSmsTimer) clearInterval(this.loginSmsTimer);
      this.loginSmsTimer = setInterval(() => {
        this.loginSmsCooldown = Math.max(0, this.loginSmsCooldown - 1);
        if (this.loginSmsCooldown <= 0) {
          clearInterval(this.loginSmsTimer);
          this.loginSmsTimer = null;
        }
      }, 1000);
    },
    /** Apply a remote UI-plan login response and persist it through Core. */
    async applyAuthSession(data) {
      this.currentUser = {
        profile: data?.profile,
        entitlement: data?.entitlement,
        gateway_bootstrap: data?.gateway_bootstrap,
        gateway_usage: data?.gateway_usage,
      };
      this.subscriptionEntitlement = data?.entitlement || null;
      await this.persistStoredAuth(data);
      this.syncManagedAccessProviderFromCurrentUser({ persist: true, forceSelect: true });
      this.loginPassword = "";
      this.authNotice = "登录成功";
      this.updateSubscriptionFromEntitlement();
      this.fetchAccessPlans({ silent: true });
      this.fetchSubscriptionStatus({ silent: true });
      this.navigate("home");
      this.markAction("登录成功");
    },
    async logoutAccess() {
      if (this.accessTokenConfigured || this.accessToken) {
        await this.accessRequest("/v1/access/auth/logout", { method: "POST" }).catch(() => null);
      }
      await this.clearStoredAuth();
      this.navigate("login");
    },
    loginSubmit() {
      if (this.loginMode === "sms") return this.loginWithSms();
      if (this.loginMode === "register") return this.registerAccess();
      return this.loginWithPassword();
    },
    showForgotPasswordNotice() {
      this.authError = "";
      this.authNotice = "当前桌面端尚未暴露重置密码代理，请使用验证码登录或联系服务端启用重置密码接口";
    },
    async handlePlanAction(plan, forcedAction = "") {
      if (!plan) return;
      this.subscriptionError = "";
      this.subscriptionNotice = "";
      if (!this.isAuthenticated) {
        this.subscriptionNotice = "请先登录再管理套餐";
        this.navigate("login");
        return;
      }
      if (plan.current && forcedAction !== "renew") {
        this.subscriptionNotice = "当前套餐已启用";
        return;
      }
      if (plan.raw?.can_purchase === false && !plan.canRenew && !plan.canUpgrade) {
        this.subscriptionError = "该套餐当前不可购买";
        return;
      }
      const action = forcedAction || (plan.canRenew ? "renew" : plan.canUpgrade ? "upgrade" : "purchase");
      const loadingKey = `${action}:${plan.id}`;
      this.subscriptionActionLoading = loadingKey;
      try {
        const endpoint = action === "renew" ? "/v1/access/sub/renew" : action === "upgrade" ? "/v1/access/sub/upgrade" : "/v1/access/sub/purchase";
        const payload = {
          plan_code: plan.id,
          pay_type: "alipay",
          return_url: window.location.href.split("#")[0] + "#subscription",
        };
        if (action === "purchase") payload.billing_cycle = "monthly";
        const data = await this.accessRequest(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        this.lastOrder = data;
        this.billingRows = [this.mapBillingRow(data, plan), ...this.billingRows.filter((row) => row.orderNo !== data.order_no)].slice(0, 8);
        this.subscriptionNotice = data?.payment_url ? "订单已创建，已打开支付页面" : "订单已创建，请等待支付确认";
        if (data?.payment_url) window.open(data.payment_url, "_blank", "noopener");
      } catch (error) {
        this.subscriptionError = error.message || "订单创建失败";
      } finally {
        this.subscriptionActionLoading = "";
      }
    },
    renewCurrentPlan() {
      return this.handlePlanAction(this.subscriptionCurrentPlan, "renew");
    },
    upgradeFromCurrentPlan() {
      const target = this.subscriptionPlans.find((plan) => !plan.current && (plan.canUpgrade || Number(plan.price) > Number(this.subscriptionCurrentPlan?.price || 0)));
      if (!target) {
        this.subscriptionNotice = "暂无可升级套餐";
        return;
      }
      return this.handlePlanAction(target);
    },
    openLastOrderPayment() {
      if (!this.isAuthenticated) {
        this.navigate("login");
        return;
      }
      if (this.lastOrder?.payment_url) {
        window.open(this.lastOrder.payment_url, "_blank", "noopener");
        this.markAction("打开支付页面");
        return;
      }
      this.subscriptionNotice = "暂无待支付订单";
    },
    mapBillingRow(order = {}, plan = {}) {
      return {
        orderNo: order.order_no,
        item: `${plan.name || order.plan_name || "套餐"} ${order.order_type || "订阅"}`,
        amount: `${order.currency || "¥"}${order.amount ?? ""}`,
        status: order.status || "pending",
        date: new Date().toISOString().slice(0, 10),
      };
    },
    copyText(value, label = "内容") {
      const text = String(value || "");
      if (!text) return;
      navigator.clipboard?.writeText(text).then(() => {
        this.markAction(`复制${label}`);
      }).catch(() => {
        this.markAction(`复制${label}失败`);
      });
    },
    exportJsonFile(filename, data) {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      this.markAction(`导出 ${filename}`);
    },
    exportConversation() {
      this.exportJsonFile(`openxnet-conversation-${this.conversationId || "draft"}.json`, {
        conversationId: this.conversationId,
        messages: this.messages,
      });
    },
    clearConversationContext() {
      this.stopGenerate();
      this.messages = [];
      const conversation = this.conversations.find((conv) => conv.id === this.conversationId);
      if (conversation) {
        conversation.messages = [];
        conversation.timestamp = Date.now();
      }
      this.persistSettings();
      this.markAction("清空上下文");
    },
    exportUsageReport() {
      this.exportJsonFile(`openxnet-usage-${new Date().toISOString().slice(0, 10)}.json`, {
        exportedAt: new Date().toISOString(),
        profile: this.authProfile,
        entitlement: this.authEntitlement,
        credits: this.subscriptionCredits,
        expiry: this.subscriptionExpiry,
        usageRows: this.subscriptionUsageRows,
        billingRows: this.billingRows,
      });
    },
    exportStorageIndex() {
      this.exportJsonFile(`openxnet-storage-index-${new Date().toISOString().slice(0, 10)}.json`, {
        exportedAt: new Date().toISOString(),
        stats: this.storageStats,
        files: this.storageRows,
        activeTab: this.storageTab,
        continuation: this.storageContinuationRows,
      });
    },
    exportTaskReport() {
      this.exportJsonFile(`openxnet-tasks-${new Date().toISOString().slice(0, 10)}.json`, {
        exportedAt: new Date().toISOString(),
        filter: { status: this.taskTab, priority: this.taskPriorityTab },
        tasks: this.taskRows,
        detail: this.taskDetail,
      });
    },
    exportDiagnostics() {
      this.exportJsonFile(`openxnet-diagnostics-${new Date().toISOString().slice(0, 10)}.json`, {
        exportedAt: new Date().toISOString(),
        resourceVersion: UI_RESOURCE_VERSION,
        wsConnected: this.wsConnected,
        currentRoute: this.currentRoute,
        currentModel: this.currentModelLabel,
        engineStatus: this.engineStatus,
        apiWorkbenchOverview: this.apiWorkbenchOverview,
        settings: {
          mainAgent: this.mainAgent,
          model: this.settings.model,
          base_url: this.settings.base_url,
          providers: this.providers.map((provider) => ({
            id: provider.id,
            name: provider.name,
            url: provider.url,
            connected: provider.connected,
            models: provider.models?.map((model) => model.name),
            hasApiKey: Boolean(provider.apiKey),
          })),
          tools: this.toolkitTools.map((tool) => ({ id: tool.id, name: tool.name, enabled: tool.enabled })),
        },
      });
    },
    buildProvidersFromSettings(settings) {
      const configured = Array.isArray(settings.modelProviders) ? settings.modelProviders : [];
      if (!configured.length) return clone(defaultProviders);
      const mapped = configured.map((provider, index) => {
        const name = toDisplayString(provider.name || provider.label || provider.id, `Provider ${index + 1}`);
        const models = Array.isArray(provider.models) && provider.models.length
          ? provider.models.map((model) => ({
              name: typeof model === "string" ? model : toDisplayString(model.name || model.id, "model"),
              caps: Array.isArray(model.caps) ? model.caps : ["对话"],
              context: model.context || model.context_length || "128K",
              enabled: model.enabled !== false,
            }))
          : clone(defaultProviders[index % defaultProviders.length].models);
        return {
          id: toDisplayString(provider.id, name.toLowerCase().replace(/\s+/g, "-")),
          name,
          initial: initialsFor(name, "P", 1),
          color: provider.color || defaultProviders[index % defaultProviders.length].color,
          connected: Boolean(provider.api_key || provider.apiKey || provider.base_url || provider.url),
          apiKey: provider.api_key || provider.apiKey || "",
          apiKeyConfigured: provider.api_key_configured === true
            || provider.apiKeyConfigured === true
            || Boolean(provider.api_key || provider.apiKey),
          url: provider.base_url || provider.url || "",
          managedBy: provider.managedBy || "",
          models,
        };
      });
      return mapped.concat(defaultProviders.filter((provider) => !mapped.some((item) => item.name === provider.name))).slice(0, 9);
    },
    buildToolsFromSettings(settings) {
      const toolSettings = settings.tools || {};
      const definitions = [
        ["webSearch", "联网搜索", "搜索并汇总互联网页面", "fa-solid fa-globe", "toolkit-card__icon--green", "builtin", "v1.8.2", true],
        ["codeExecutor", "代码执行器", "运行 Python/Node 代码片段并返回结果", "fa-solid fa-terminal", "toolkit-card__icon--green", "builtin", "v2.1.0", true],
        ["drawing", "画图工具", "生成流程图、草图和视觉素材", "fa-solid fa-paint-brush", "toolkit-card__icon--blue", "builtin", "v1.3.4", false],
        ["knowledge", "知识库检索", "检索本地知识库和长期记忆内容", "fa-solid fa-book", "toolkit-card__icon--purple", "knowledge", "v2.0.1", true],
        ["assetLibrary", "素材库", "管理图片、音频、文档等可复用素材", "fa-solid fa-photo-film", "toolkit-card__icon--pink", "knowledge", "v1.1.0", false],
        ["imageHost", "图床管理", "管理图片上传、外链和压缩策略", "fa-solid fa-image", "toolkit-card__icon--pink", "knowledge", "v1.0.0", false],
        ["notes", "笔记", "记录和结构化对话中的关键结论", "fa-solid fa-note-sticky", "toolkit-card__icon--blue", "knowledge", "v1.0.5", false],
        ["httpRequest", "HTTP请求", "调试 REST API、Webhook 和服务端接口", "fa-solid fa-link", "toolkit-card__icon--orange", "custom", "v1.2.0", false],
        ["databaseQuery", "数据库查询", "通过自然语言生成并执行只读查询", "fa-solid fa-database", "toolkit-card__icon--blue", "custom", "v1.4.0", false],
        ["scriptTool", "脚本工具", "注册 Python/JavaScript 自定义脚本工具", "fa-solid fa-code", "toolkit-card__icon--gray", "custom", "v1.0.0", false],
        ["wecom", "企业微信", "企业微信消息推送和群机器人集成", "fa-solid fa-building", "toolkit-card__icon--green", "external", "v1.6.0", true],
        ["dingtalk", "钉钉", "钉钉群机器人消息通知与回调", "fa-solid fa-comment-dots", "toolkit-card__icon--gray", "external", "v1.0.0", false],
        ["feishu", "飞书", "飞书机器人、应用凭证和事件订阅", "fa-solid fa-paper-plane", "toolkit-card__icon--gray", "external", "v1.0.0", false],
        ["slack", "Slack", "Slack Bot Token 和 Webhook 集成", "fa-brands fa-slack", "toolkit-card__icon--gray", "external", "v1.0.0", false],
        ["mcpServer", "MCP服务器", "连接和管理 MCP 服务以扩展外部工具", "fa-solid fa-server", "toolkit-card__icon--accent", "protocol", "v1.2.0", true],
      ];
      return definitions.map(([id, name, description, icon, iconClass, section, version, defaultEnabled], index) => {
        const source = id === "webSearch" ? settings.webSearch : toolSettings[id];
        const enabled = source?.enabled ?? defaultEnabled;
        return {
          id,
          name,
          description,
          icon,
          iconClass,
          section,
          enabled: Boolean(enabled),
          trigger: source?.triggerMode || source?.when || "beforeThinking",
          version,
          note: "",
          fields: [
            { label: "触发时机", type: "select", value: source?.triggerMode || source?.when || "beforeThinking", options: ["beforeThinking", "afterThinking", "manual"] },
            { label: "安全模式", type: "select", value: source?.safeMode || "只读", options: ["只读", "确认后执行", "自动执行"] },
          ],
          logs: [
            `[ready] ${name} 已载入`,
            `[sync] 配置与 OpenXnet 内核同步`,
          ],
        };
      });
    },
    buildRolesFromSettings(settings) {
      const agents = settings.agents || {};
      const entries = Object.entries(agents);
      const prototypeRoles = [
        this.defaultRole("assistant", "智能助手", "通用", "日常对话与任务处理", "#5BA3C5"),
        this.defaultRole("coder", "代码专家", "编程", "代码分析、重构和测试", "#10B981"),
        this.defaultRole("translator", "翻译官", "语言", "多语言翻译和润色", "#F59E0B"),
        this.defaultRole("writer", "文案写手", "创作", "结构化写作和内容优化", "#F43F5E"),
        this.defaultRole("analyst", "数据分析师", "数据", "指标拆解、报表分析和趋势解释", "#2563EB"),
        this.defaultRole("support-bot", "客服机器人", "服务", "售前售后问答、工单分流和客户安抚", "#14B8A6"),
      ];
      if (!entries.length) {
        return prototypeRoles;
      }
      const colors = ["#5BA3C5", "#10B981", "#F59E0B", "#F43F5E", "#7C3AED", "#0EA5E9"];
      const mapped = entries.map(([id, agent], index) => ({
        id,
        name: toDisplayString(agent.name || agent.label, id),
        tag: toDisplayString(agent.tag || agent.type, "Agent"),
        desc: toDisplayString(agent.description || agent.desc, "OpenXnet 角色"),
        prompt: toDisplayString(agent.system_prompt || agent.prompt, ""),
        model: toDisplayString(agent.model, this.mainAgent),
        temperature: Number(agent.temperature ?? this.temperature),
        vision: Boolean(agent.vision || agent.desktopVision),
        behavior: Boolean(agent.autoBehavior),
        voice: toDisplayString(agent.voice, "zh-CN-XiaoxiaoNeural"),
        voiceEnabled: agent.voiceEnabled !== false,
        screenFrequency: toDisplayString(agent.screenFrequency, "每10秒"),
        privacyBlur: agent.privacyBlur !== false,
        initial: initialsFor(agent.name || agent.label, id, 2),
        color: agent.color || colors[index % colors.length],
        updated: toDisplayString(agent.updated, "刚刚更新"),
      }));
      const merged = [...mapped];
      for (const role of prototypeRoles) {
        if (!merged.some((item) => item.name === role.name)) {
          const roleIdExists = merged.some((item) => item.id === role.id);
          merged.push(roleIdExists ? { ...role, id: `prototype-${role.id}` } : role);
        }
      }
      return merged;
    },
    defaultRole(id = "assistant", name = "智能助手", tag = "通用", desc = "日常对话与任务处理", color = "#5BA3C5") {
      return {
        id,
        name,
        tag,
        desc,
        prompt: "",
        model: this.mainAgent,
        temperature: 0.7,
        vision: false,
        behavior: false,
        voice: "zh-CN-XiaoxiaoNeural",
        voiceEnabled: true,
        screenFrequency: "每10秒",
        privacyBlur: true,
        initial: initialsFor(name, id, 2),
        color,
        updated: "刚刚更新",
      };
    },
    defaultTool() {
      return {
        id: "webSearch",
        name: "联网搜索",
        description: "搜索并汇总互联网页面",
        icon: "fa-solid fa-magnifying-glass",
        iconClass: "toolkit-card__icon--accent",
        section: "builtin",
        enabled: false,
        trigger: "beforeThinking",
        version: "v1.0.0",
        fields: [],
        logs: ["[ready] 联网搜索 已载入"],
      };
    },
    async fetchSkills() {
      try {
        const response = await fetch("/api/skills/list");
        if (!response.ok) return;
        const data = await response.json();
        const list = Array.isArray(data.skills) ? data.skills : [];
        if (!list.length) return;
        this.skills = list.slice(0, 60).map((skill, index) => ({
          id: skill.id || skill.name || skill.path || `skill-${index}`,
          name: skill.name || skill.title || `技能 ${index + 1}`,
          description: skill.description || skill.desc || skill.summary || "可安装的 OpenXnet 技能",
          tags: Array.isArray(skill.tags) && skill.tags.length ? skill.tags.slice(0, 3) : [skill.category || "技能"],
          icon: this.skillIconFor(skill.name || skill.category || ""),
          rating: Number(skill.rating || 4 + (index % 2)),
          installed: skill.installed !== false,
          enabled: skill.enabled !== false,
          custom: Boolean(skill.custom || skill.local),
          iconClass: iconClasses[index % iconClasses.length],
        }));
      } catch (_) {}
    },
    async fetchModels() {
      try {
        const response = await fetch("/v1/models");
        if (!response.ok) return;
        const data = await response.json();
        const models = Array.isArray(data.data) ? data.data : Array.isArray(data.models) ? data.models : [];
        if (!models.length) return;
      const runtime = this.providers.find((provider) => provider.id === "openxnet-runtime") || {
          id: "openxnet-runtime",
          name: "OpenXnet Runtime",
          initial: "X",
          color: "#5BA3C5",
          connected: true,
          apiKey: "",
          models: [],
        };
        runtime.models = models.map((model) => ({
          name: typeof model === "string" ? model : model.id || model.name,
          caps: ["对话"],
          context: model.context || "runtime",
          enabled: true,
        })).filter((model) => model.name);
        if (!this.providers.some((provider) => provider.id === runtime.id)) {
          this.providers.unshift(runtime);
        }
      } catch (_) {}
    },
    providerPayload(provider = this.selectedProvider, modelName = "") {
      const selectedModel = modelName || provider?.models?.find((model) => model.enabled)?.name || provider?.models?.[0]?.name || "";
      return {
        provider_id: provider?.id,
        vendor: provider?.name || provider?.vendor || "OpenAI",
        url: String(provider?.url || "").trim(),
        api_key: String(provider?.apiKey || "").trim(),
        model_id: selectedModel,
        preserve_api_key: false,
      };
    },
    /** Return whether one UI-plan provider belongs to the managed access boundary. */
    isManagedAccessProviderRecord(provider) {
      return String(provider?.id || "").trim() === MANAGED_ACCESS_PROVIDER_ID
        || String(provider?.id || "").trim() === "openxnet-access"
        || String(provider?.managedBy || "").trim() === "openxnet-access";
    },
    managedAccessProviderFromBootstrap(bootstrap = this.gatewayBootstrap) {
      if (!bootstrap) return null;
      const modelScopes = Array.isArray(bootstrap.model_scopes)
        ? bootstrap.model_scopes.map((item) => String(item || "").trim()).filter(Boolean)
        : [];
      const modelNames = modelScopes.includes(PREFERRED_ACCESS_MODEL)
        ? [PREFERRED_ACCESS_MODEL, ...modelScopes.filter((item) => item !== PREFERRED_ACCESS_MODEL)]
        : [PREFERRED_ACCESS_MODEL, ...modelScopes.filter((item) => item !== PREFERRED_ACCESS_MODEL)];
      const uniqueModels = [...new Set(modelNames.filter(Boolean))];
      const url = String(bootstrap.base_url || bootstrap.baseUrl || "").trim();
      const apiKeyConfigured = bootstrap.api_key_configured === true
        || bootstrap.apiKeyConfigured === true;
      if (!url || !apiKeyConfigured) return null;
      return {
        id: MANAGED_ACCESS_PROVIDER_ID,
        name: String(bootstrap.provider_name || bootstrap.providerName || "OpenXnet Access").trim() || "OpenXnet Access",
        initial: "X",
        color: "#5BA3C5",
        connected: true,
        apiKey: "",
        apiKeyConfigured,
        url,
        vendor: String(bootstrap.vendor || "OpenAI").trim() || "OpenAI",
        managedBy: "openxnet-access",
        models: uniqueModels.map((name, index) => ({
          name,
          caps: ["对话"],
          context: index === 0 && name === PREFERRED_ACCESS_MODEL ? "目标模型" : "订阅权益",
          enabled: true,
        })),
      };
    },
    syncManagedAccessProviderFromCurrentUser(options = {}) {
      const provider = this.managedAccessProviderFromBootstrap();
      if (!provider) {
        const managedProvider = (this.providers || []).find(
          (item) => this.isManagedAccessProviderRecord(item),
        );
        if (!managedProvider) return false;
        const selectedWasManaged = this.isManagedAccessProviderRecord(this.selectedProvider);
        this.providers = (this.providers || []).filter(
          (item) => !this.isManagedAccessProviderRecord(item),
        );
        if (selectedWasManaged) {
          this.selectedProviderId = this.providers[0]?.id || "";
          this.settings.selectedProvider = this.selectedProviderId || null;
          this.settings.base_url = "";
          this.settings.api_key = "";
          this.settings.api_key_configured = false;
          this.settings.model = "";
        }
        const canPersistRemoval = options.persist !== false && this.settingsLoaded && (
          typeof window.openxnetDesktop?.saveApplicationProviders === "function"
          || (this.ws && this.ws.readyState === WebSocket.OPEN)
        );
        if (canPersistRemoval) this.persistProvider();
        return true;
      }

      const others = (this.providers || []).filter((item) => !this.isManagedAccessProviderRecord(item));
      const existing = (this.providers || []).find((item) => this.isManagedAccessProviderRecord(item));
      const selectedProviderWasManaged = this.isManagedAccessProviderRecord(
        (this.providers || []).find(
          (item) => String(item?.id || "").trim() === String(this.settings.selectedProvider || "").trim(),
        ),
      );
      const changed = !existing || JSON.stringify({
        url: existing.url,
        apiKeyConfigured: existing.apiKeyConfigured === true,
        models: existing.models?.map((model) => model.name),
      }) !== JSON.stringify({
        url: provider.url,
        apiKeyConfigured: provider.apiKeyConfigured === true,
        models: provider.models.map((model) => model.name),
      });
      this.providers = [provider, ...others];
      this.selectedProviderId = provider.id;

      const selectedProviderIncomplete = !String(this.settings.model || "").trim()
        || !String(this.settings.base_url || "").trim()
        || this.settings.api_key_configured !== true;
      if (options.forceSelect || selectedProviderIncomplete || selectedProviderWasManaged) {
        this.settings.selectedProvider = provider.id;
        this.settings.base_url = provider.url;
        this.settings.api_key = "";
        this.settings.api_key_configured = provider.apiKeyConfigured === true;
        this.settings.model = PREFERRED_ACCESS_MODEL;
        this.settings.mainAgent = PREFERRED_ACCESS_MODEL;
        this.mainAgent = PREFERRED_ACCESS_MODEL;
      }

      const shouldPersist = options.persist !== false && this.settingsLoaded && (
        typeof window.openxnetDesktop?.saveApplicationProviders === "function"
        || (this.ws && this.ws.readyState === WebSocket.OPEN)
      );
      if (shouldPersist && (changed || options.forceSelect)) {
        this.persistProvider();
      }
      return true;
    },
    normalizeProviderModels(models = []) {
      return models.map((model) => {
        const name = typeof model === "string" ? model : model.id || model.name || "";
        return {
          name,
          caps: ["对话"],
          context: model.context || model.context_length || "runtime",
          enabled: true,
        };
      }).filter((model) => model.name);
    },
    async importProviderModels(provider = this.selectedProvider) {
      if (!provider) return;
      this.providerError = "";
      this.providerNotice = "";
      if (!provider.url) {
        this.providerError = "请先填写 Base URL";
        return;
      }
      this.providerActionLoading = `models:${provider.id}`;
      try {
        const data = await this.apiRequest("/v1/providers/models", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: provider.url, api_key: provider.apiKey || "" }),
        });
        const models = this.normalizeProviderModels(Array.isArray(data?.data) ? data.data : data?.models || []);
        if (!models.length) {
          this.providerNotice = "接口已响应，但没有返回可导入模型";
          return;
        }
        provider.models = models;
        this.persistProvider();
        this.providerNotice = `已导入 ${models.length} 个模型`;
        this.markAction("导入模型");
      } catch (error) {
        this.providerError = error.message || "模型导入失败";
      } finally {
        this.providerActionLoading = "";
      }
    },
    async validateProvider(modelName = "") {
      const provider = this.selectedProvider;
      if (!provider) return;
      this.providerError = "";
      this.providerNotice = "";
      if (!provider.url) {
        this.providerError = "请先填写 Base URL";
        return;
      }
      this.providerActionLoading = `validate:${provider.id}`;
      try {
        const data = await this.apiRequest("/v1/dev/workbench/provider/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(this.providerPayload(provider, modelName)),
        });
        const validation = data?.validation || {};
        const remoteModels = this.normalizeProviderModels(validation.models || []);
        if (remoteModels.length) {
          const existing = new Set((provider.models || []).map((item) => item.name));
          provider.models = [
            ...provider.models,
            ...remoteModels.filter((item) => !existing.has(item.name)),
          ];
        }
        provider.connected = validation.status !== "blocked";
        this.providerNotice = validation.message || (provider.connected ? "Provider 验证通过" : "Provider 需要处理");
        this.persistProvider();
        this.markAction(`${provider.name} 验证`);
      } catch (error) {
        provider.connected = false;
        this.providerError = error.message || "Provider 验证失败";
      } finally {
        this.providerActionLoading = "";
      }
    },
    async applyProviderProfile(modelName = "") {
      const provider = this.selectedProvider;
      if (!provider) return;
      this.providerError = "";
      this.providerNotice = "";
      const payload = this.providerPayload(provider, modelName);
      if (!payload.url || !payload.model_id) {
        this.providerError = "请先填写 Base URL 并至少保留一个模型";
        return;
      }
      this.providerActionLoading = `apply:${provider.id}`;
      try {
        const data = await this.apiRequest("/v1/dev/workbench/provider/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        provider.connected = true;
        this.mainAgent = payload.model_id;
        this.settings.model = payload.model_id;
        this.settings.mainAgent = payload.model_id;
        if (data?.provider?.id) provider.id = data.provider.id;
        this.providerNotice = data?.message || "Provider 已应用到当前 profile";
        this.sendWs({ type: "get_settings" });
        this.markAction("应用 Provider");
      } catch (error) {
        this.providerError = error.message || "Provider 应用失败";
      } finally {
        this.providerActionLoading = "";
      }
    },
    testProviderModel(model) {
      if (!model?.name) return;
      return this.validateProvider(model.name);
    },
    loadConversation(id, options = {}) {
      if (!id) {
        this.messages = [];
        this.conversationId = null;
        return;
      }
      const conversation = this.conversations.find((conv) => conv.id === id);
      if (!conversation) return;
      this.conversationId = id;
      this.messages = Array.isArray(conversation.messages) ? clone(conversation.messages) : [];
      this.mainAgent = conversation.mainAgent || this.mainAgent;
      if (!options.silent) this.historyOpen = false;
      nextTick(this.scrollMessagesToBottom);
    },
    newConversation() {
      this.stopGenerate();
      this.conversationId = null;
      this.messages = [];
      this.historyOpen = false;
      this.userInput = "";
      nextTick(() => this.$refs.composer?.focus());
    },
    ensureConversation() {
      if (!this.conversationId) this.conversationId = makeId();
      let conversation = this.conversations.find((conv) => conv.id === this.conversationId);
      if (!conversation) {
        conversation = {
          id: this.conversationId,
          title: this.generateConversationTitle(this.messages),
          mainAgent: this.mainAgent,
          timestamp: Date.now(),
          messages: [],
          fileLinks: [],
        };
        this.conversations.unshift(conversation);
      }
      return conversation;
    },
    generateConversationTitle(messages) {
      const firstUser = (messages || []).find((message) => message.role === "user" && String(message.content || "").trim());
      return String(firstUser?.content || "新对话").trim().slice(0, 28);
    },
    touchConversation() {
      const conversation = this.ensureConversation();
      conversation.messages = clone(this.messages);
      conversation.mainAgent = this.mainAgent;
      conversation.timestamp = Date.now();
      conversation.title = this.generateConversationTitle(this.messages);
      this.settings.conversations = this.conversations;
      this.settings.conversationId = this.conversationId;
      this.settings.mainAgent = this.mainAgent;
      this.persistSettings();
    },
    async sendMessage() {
      const text = this.userInput.trim();
      if (!text || this.isSending) return;
      this.ensureConversation();
      this.userInput = "";
      const userMessage = { id: makeId(), role: "user", content: text, timestamp: Date.now() };
      const assistantMessage = { id: makeId(), role: "assistant", content: "", timestamp: Date.now() };
      const previousMessages = this.messages.filter((message) => !(message.id === "welcome-ai"));
      this.messages = [...previousMessages, userMessage, assistantMessage];
      this.assistantHasContent = false;
      this.isSending = true;
      this.abortController = new AbortController();
      nextTick(() => {
        this.resizeComposer();
        this.scrollMessagesToBottom();
      });

      const payloadMessages = [];
      if (this.settings.system_prompt) {
        payloadMessages.push({ role: "system", content: this.settings.system_prompt });
      }
      for (const message of this.messages.slice(0, -1)) {
        payloadMessages.push({ role: message.role, content: message.content });
      }

      try {
        const response = await fetch("/v1/chat/completions", {
          method: "POST",
          headers: this.authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            model: this.mainAgent || PREFERRED_ACCESS_MODEL,
            messages: payloadMessages,
            stream: true,
            temperature: this.temperature,
            max_tokens: this.maxTokens,
            top_p: this.settings.top_p ?? 1,
            fileLinks: [],
            asyncToolsID: [],
            reasoning_effort: this.settings.reasoning_effort || null,
            conversationId: this.conversationId || "",
            conversation_id: this.conversationId || "",
            enable_thinking: this.thinkingEnabled,
            enable_deep_research: this.deepResearchEnabled,
            enable_web_search: this.webSearchEnabled,
          }),
          signal: this.abortController.signal,
        });
        if (!response.ok) {
          assistantMessage.content = `请求失败: ${response.status} ${await response.text()}`;
          return;
        }
        await this.readChatStream(response, assistantMessage);
      } catch (error) {
        if (error.name !== "AbortError") {
          assistantMessage.content = `请求异常: ${error.message || error}`;
        }
      } finally {
        this.isSending = false;
        this.abortController = null;
        if (!assistantMessage.content.trim()) {
          assistantMessage.content = "已停止生成。";
        }
        this.touchConversation();
        nextTick(this.scrollMessagesToBottom);
      }
    },
    async readChatStream(response, assistantMessage) {
      if (!response.body) {
        const json = await response.json().catch(() => null);
        assistantMessage.content += this.extractContent(json);
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split(/\r?\n\r?\n/);
        buffer = chunks.pop() || "";
        for (const chunk of chunks) {
          const content = this.parseSseChunk(chunk);
          if (!content) continue;
          assistantMessage.content += content;
          this.assistantHasContent = true;
          await nextTick();
          this.scrollMessagesToBottom();
        }
      }
      if (buffer.trim()) {
        const content = this.parseSseChunk(buffer);
        if (content) assistantMessage.content += content;
      }
    },
    parseSseChunk(chunk) {
      const dataLines = chunk.split(/\r?\n/).filter((line) => line.startsWith("data:"));
      if (!dataLines.length) return "";
      let result = "";
      for (const line of dataLines) {
        const raw = line.replace(/^data:\s?/, "");
        if (!raw || raw === "[DONE]") continue;
        try {
          result += this.extractContent(JSON.parse(raw));
        } catch (_) {
          result += raw;
        }
      }
      return result;
    },
    extractContent(payload) {
      if (!payload) return "";
      const choice = payload.choices?.[0];
      const delta = choice?.delta || choice?.message || payload.delta || payload;
      let content = delta.content ?? delta.reasoning_content ?? delta.text ?? payload.content ?? "";
      if (Array.isArray(content)) {
        content = content.map((item) => item.text || item.content || "").join("");
      }
      if (!content && payload.error) {
        content = typeof payload.error === "string" ? payload.error : payload.error.message || JSON.stringify(payload.error);
      }
      return content || "";
    },
    stopGenerate() {
      if (this.abortController) this.abortController.abort();
      if (this.conversationId) {
        fetch("/v1/chat/abort", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: this.conversationId, conversation_id: this.conversationId }),
        }).catch(() => {});
      }
      this.isSending = false;
    },
    persistSettings() {
      if (!this.settingsLoaded) return;
      this.settings.mainAgent = this.mainAgent;
      this.settings.temperature = this.temperature;
      this.settings.max_tokens = this.maxTokens;
      this.settings.conversationId = this.conversationId;
      this.settings.conversations = this.conversations;
      this.settings.webSearch = { ...(this.settings.webSearch || {}), enabled: this.webSearchEnabled };
      this.settings.tools = this.settings.tools || {};
      this.settings.tools.deepsearch = { ...(this.settings.tools.deepsearch || {}), enabled: this.deepResearchEnabled };
      this.settings.enable_thinking = this.thinkingEnabled;
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => this.saveSettingsNow(), 250);
    },
    saveSettingsNow() {
      this.sendWs({ type: "save_settings", data: this.settings, correlationId: makeId() });
    },
    persistProvider() {
      this.settings.modelProviders = this.providers.map((provider) => ({
        id: provider.id,
        name: provider.name,
        vendor: provider.vendor || provider.name || "OpenAI",
        api_key: provider.apiKey,
        apiKey: provider.apiKey,
        api_key_configured: provider.apiKeyConfigured === true || Boolean(provider.apiKey),
        apiKeyConfigured: provider.apiKeyConfigured === true || Boolean(provider.apiKey),
        base_url: provider.url || "",
        url: provider.url || "",
        managedBy: provider.managedBy || "",
        modelId: provider.models?.[0]?.name || "",
        models: (provider.models || []).map((model) => typeof model === "string" ? model : model.name).filter(Boolean),
      }));
      if (typeof window.openxnetDesktop?.saveApplicationProviders === "function") {
        const providers = this.settings.modelProviders.map((provider) => ({
          id: String(provider.id || "").trim(),
          vendor: String(provider.vendor || "OpenAI").trim() || "OpenAI",
          url: String(provider.url || "").trim(),
          modelId: String(provider.modelId || "").trim(),
          models: Array.isArray(provider.models) ? provider.models.map(String) : [],
          name: String(provider.name || "").trim(),
          managedBy: String(provider.managedBy || "").trim(),
          source: String(provider.managedBy || "").trim(),
          disabled: false,
          apiKeyConfigured: provider.apiKeyConfigured === true,
          ...(String(provider.apiKey || "").trim() ? { apiKey: String(provider.apiKey).trim() } : {}),
        }));
        window.openxnetDesktop.saveApplicationProviders({ providers }).catch((error) => {
          console.error("Persist UI-plan provider metadata failed:", error);
        });
      }
      this.persistSettings();
    },
    addProviderDraft() {
      const id = `provider-${Date.now()}`;
      this.providers.push({
        id,
        name: "自定义提供商",
        initial: "C",
        color: "#5BA3C5",
        connected: false,
        apiKey: "",
        models: [{ name: "custom-model", caps: ["对话"], context: "128K", enabled: true }],
      });
      this.selectedProviderId = id;
      this.persistProvider();
    },
    setModelForTab(tab, model) {
      if (tab === "main") {
        this.mainAgent = model;
        this.settings.mainAgent = model;
        this.settings.model = model;
      } else {
        this.settings[tab] = { ...(this.settings[tab] || {}), model };
      }
      this.persistSettings();
    },
    modelSettingName(tab) {
      if (tab === "main") return this.mainAgent || this.settings.model || "GPT-4o";
      return this.settings[tab]?.model || this.mainAgent || "GPT-4o";
    },
    capClass(cap) {
      if (cap.includes("代码")) return "code";
      if (cap.includes("视觉")) return "vision";
      if (cap.includes("推理")) return "reasoning";
      if (cap.includes("图像")) return "image";
      return "chat";
    },
    taskTone(status) {
      const value = String(status || "").toLowerCase();
      if (value === "running") return "running";
      if (value === "pending") return "queued";
      if (value === "completed") return "done";
      if (value === "failed" || value === "cancelled") return "warning";
      return "queued";
    },
    taskStatusLabel(status) {
      const map = {
        running: "运行中",
        pending: "排队中",
        completed: "已完成",
        failed: "失败",
        cancelled: "已取消",
      };
      return map[String(status || "").toLowerCase()] || toDisplayString(status, "未知");
    },
    taskPriority(task) {
      const raw = String(task?.priority || task?.context?.priority || task?.failure_severity || "").toLowerCase();
      if (["high", "critical", "severe"].includes(raw)) return "high";
      if (["low", "minor"].includes(raw)) return "low";
      return "medium";
    },
    mapTaskRow(task = {}) {
      const details = task?.details && typeof task.details === "object" ? task.details : {};
      const normalized = task?.legacyTaskId
        ? {
            ...details,
            task_id: task.id,
            core_task_id: task.id,
            legacy_task_id: task.legacyTaskId,
            core_revision: task.revision,
            title: task.title,
            description: task.description,
            status: task.status,
            progress: task.progress,
            priority: task.priority,
            agent_type: task.agentType,
            created_at: task.createdAt,
            updated_at: task.updatedAt,
            completed_at: task.completedAt,
          }
        : task;
      const id = normalized.task_id || normalized.id || makeId();
      const status = normalized.status || "pending";
      const progress = Math.max(0, Math.min(100, Number(normalized.progress || 0)));
      const updated = normalized.updated_at || normalized.created_at || normalized.completed_at;
      return {
        id,
        raw: normalized,
        title: normalized.title || id,
        description: normalized.description || normalized.summary || "",
        status: this.taskStatusLabel(status),
        statusValue: String(status || "").toLowerCase(),
        progress,
        agent: normalized.agent_type || normalized.engine_name || "default",
        time: updated ? this.formatRelativeTime(updated) : "未同步",
        tone: this.taskTone(status),
        priority: this.taskPriority(normalized),
        canStart: String(status).toLowerCase() === "pending",
        canCancel: ["pending", "running"].includes(String(status).toLowerCase()),
        canResume: Boolean(task.is_resumable) || ["failed", "cancelled"].includes(String(status).toLowerCase()),
      };
    },
    /** Replace UI-plan task rows from one Core task snapshot. */
    applyApplicationTaskRows(snapshot) {
      this.taskRows = Array.isArray(snapshot?.tasks)
        ? snapshot.tasks.map((task) => this.mapTaskRow(task))
        : [];
    },
    /** Load Core tasks and request one supervised execution refresh. */
    async loadTasks(options = {}) {
      this.taskError = "";
      this.taskNotice = "";
      this.taskLoading = !options.silent;
      try {
        if (typeof window.openxnetDesktop?.listTasks === "function") {
          const coreSnapshot = await window.openxnetDesktop.listTasks(
            this.taskWorkspacePath ? { workspacePath: this.taskWorkspacePath } : {},
          );
          this.applyApplicationTaskRows(coreSnapshot);
        }
        if (typeof window.openxnetDesktop?.refreshTaskExecutions === "function") {
          const snapshot = await window.openxnetDesktop.refreshTaskExecutions(
            this.taskWorkspacePath ? { workspacePath: this.taskWorkspacePath } : {},
          );
          this.taskWorkspacePath = String(snapshot?.executionWorkspacePath || this.taskWorkspacePath || "");
          this.applyApplicationTaskRows(snapshot);
        }
        if (!options.silent) {
          this.taskNotice = this.taskRows.length
            ? `已加载 ${this.taskRows.length} 个任务`
            : "当前工作区暂无任务";
        }
      } catch (error) {
        this.taskError = error.message || "任务列表加载失败";
      } finally {
        this.taskLoading = false;
      }
    },
    /** Persist a UI-plan task in Core before creating its Python execution mirror. */
    async createTaskDraft() {
      this.taskError = "";
      this.taskNotice = "";
      this.taskLoading = true;
      let createdCoreTask = null;
      try {
        const payload = {
          title: "新 UI 功能适配检查",
          description: "从 OpenXnet 新 UI 创建的任务，请在任务详情中继续补充目标、验收标准和执行上下文。",
          agent_type: "default",
          context: {
            created_from: "uiplan",
            route: this.currentRoute,
            resource_version: UI_RESOURCE_VERSION,
          },
          start_immediately: false,
        };
        if (
          this.taskWorkspacePath
          && typeof window.openxnetDesktop?.createTask === "function"
        ) {
          createdCoreTask = await window.openxnetDesktop.createTask({
            workspacePath: this.taskWorkspacePath,
            title: payload.title,
            description: payload.description,
            agentType: payload.agent_type,
            priority: "normal",
            scheduleType: "manual",
            scheduleExpression: "",
            nextRunAt: "",
            source: "uiplan",
            inputArtifactIds: [],
            details: {
              context: payload.context,
              delivery_targets: ["task_center"],
              start_immediately: false,
            },
          });
          const dispatched = await window.openxnetDesktop.dispatchTaskExecution({ taskId: createdCoreTask.id });
          const task = this.mapTaskRow(dispatched);
          this.taskRows = [task, ...this.taskRows.filter((row) => row.id !== task.id)];
          this.taskNotice = "任务草稿已创建";
          this.markAction("新建任务");
          return;
        }
        throw new Error("Desktop Core task execution is unavailable.");
      } catch (error) {
        if (createdCoreTask) {
          try {
            const coreSnapshot = await window.openxnetDesktop.listTasks({
              workspacePath: this.taskWorkspacePath,
            });
            this.applyApplicationTaskRows(coreSnapshot);
          } catch (refreshError) {
            console.warn("Unable to refresh the pending UI-plan task:", refreshError);
            const row = this.mapTaskRow(createdCoreTask);
            this.taskRows = [row, ...this.taskRows.filter((item) => item.id !== row.id)];
          }
          this.taskNotice = "任务已保存，执行服务恢复后会自动同步";
          this.markAction("新建任务");
        } else {
          this.taskError = error.message || "任务创建失败";
        }
      } finally {
        this.taskLoading = false;
      }
    },
    /** Start or resume one task through the supervised Core execution capability. */
    async runTask(task) {
      if (!task) return;
      this.taskError = "";
      this.taskNotice = "";
      try {
        const coreTaskId = String(task?.raw?.core_task_id || task.id || "");
        const result = task.canResume
          ? await window.openxnetDesktop.resumeTaskExecution({
              taskId: coreTaskId,
              resumeNote: "从新 UI 任务中心恢复执行。",
            })
          : await window.openxnetDesktop.startTaskExecution({
              taskId: coreTaskId,
              triggerSource: "uiplan",
            });
        const next = this.mapTaskRow(result);
        this.taskRows = this.taskRows.map((row) => row.id === next.id ? next : row);
        this.taskNotice = task.canResume ? "任务已恢复执行" : "任务已进入执行队列";
        this.markAction(`${task.title} 运行`);
      } catch (error) {
        this.taskError = error.message || "任务运行失败";
      }
    },
    /** Cancel one task through the Core-first execution coordinator. */
    async cancelTask(task) {
      if (!task) return;
      this.taskError = "";
      this.taskNotice = "";
      try {
        const cancelled = await window.openxnetDesktop.cancelTaskExecution({
          taskId: String(task?.raw?.core_task_id || task.id || ""),
        });
        const row = this.mapTaskRow(cancelled);
        this.taskRows = this.taskRows.map((item) => item.id === row.id ? row : item);
        this.taskNotice = "任务已取消";
        this.markAction(`${task.title} 取消`);
      } catch (error) {
        this.taskError = error.message || "任务取消失败";
      }
    },
    /** Delete one Core task and its compatibility execution mirror. */
    async deleteTask(task) {
      if (!task) return;
      this.taskError = "";
      this.taskNotice = "";
      try {
        const snapshot = await window.openxnetDesktop.deleteTaskExecution({
          taskId: String(task?.raw?.core_task_id || task.id || ""),
        });
        this.applyApplicationTaskRows(snapshot);
        this.taskRows = this.taskRows.filter((row) => row.id !== task.id);
        if (this.taskDetail?.task?.task_id === task.id) this.taskDetail = null;
        this.taskNotice = "任务已删除";
        this.markAction(`${task.title} 删除`);
      } catch (error) {
        this.taskError = error.message || "任务删除失败";
      }
    },
    /** Open a Core-first task detail enriched by the supervised execution worker. */
    async openTaskDetail(task) {
      if (!task) return;
      this.taskError = "";
      let coreDetail = null;
      try {
        if (task?.raw?.core_task_id && typeof window.openxnetDesktop?.getTask === "function") {
          coreDetail = await window.openxnetDesktop.getTask({ taskId: task.raw.core_task_id });
          this.taskDetail = {
            task: this.mapTaskRow(coreDetail.task).raw,
            workspace_dir: coreDetail.task.workspacePath,
            child_tasks: [],
            consensus_content: "",
            core_events: Array.isArray(coreDetail.events) ? coreDetail.events : [],
          };
          this.taskDetailOpen = true;
        }
        const execution = await window.openxnetDesktop.getTaskExecution({
          taskId: String(task?.raw?.core_task_id || task.id || ""),
        });
        this.taskDetail = {
          task: this.mapTaskRow(execution.task).raw,
          workspace_dir: execution.task.workspacePath,
          child_tasks: (execution.childTasks || []).map((child) => this.mapTaskRow(child).raw),
          consensus_content: execution.consensusContent || "",
          core_events: Array.isArray(execution.events) ? execution.events : [],
        };
        this.taskDetailOpen = true;
        this.markAction(`${task.title} 详情`);
      } catch (error) {
        if (!coreDetail) {
          this.taskError = error.message || "任务详情加载失败";
        } else {
          console.warn("Python task detail mirror is unavailable:", error);
          this.markAction(`${task.title} 详情`);
        }
      }
    },
    async fetchEngineStatus(options = {}) {
      try {
        this.engineStatus = await this.apiRequest("/v1/engine/status");
        if (!options.silent) this.markAction("同步内核状态");
      } catch (error) {
        if (!options.silent) this.systemError = error.message || "内核状态同步失败";
      }
    },
    async fetchApiWorkbenchOverview(options = {}) {
      try {
        this.apiWorkbenchOverview = await this.apiRequest("/v1/dev/workbench/overview");
        if (this.apiWorkbenchOverview?.recent_dev_tasks?.length) {
          const mapped = this.apiWorkbenchOverview.recent_dev_tasks.map((task) => this.mapTaskRow(task));
          const seen = new Set(this.taskRows.map((task) => task.id));
          this.taskRows = [...mapped.filter((task) => !seen.has(task.id)), ...this.taskRows];
        }
        if (!options.silent) this.markAction("同步开发工作台");
      } catch (error) {
        if (!options.silent) this.systemError = error.message || "开发工作台同步失败";
      }
    },
    async fetchNeuroState(options = {}) {
      try {
        const [stats, graph] = await Promise.all([
          this.apiRequest("/v1/neuro/stats").catch(() => null),
          this.apiRequest("/v1/neuro/graph").catch(() => null),
        ]);
        if (stats) this.neuroStats = stats;
        if (graph) this.neuroGraph = graph;
        if (!options.silent) this.markAction("同步神经符号内核");
      } catch (error) {
        if (!options.silent) this.systemError = error.message || "神经符号内核同步失败";
      }
    },
    async runEngineAction(label = "") {
      const text = String(label || "");
      if (text.includes("重启") || text.includes("同步")) return this.fetchEngineStatus();
      if (text.includes("导出")) return this.exportDiagnostics();
      if (text.includes("清空")) {
        await this.apiRequest("/v1/neuro/maintenance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "cleanup_cache" }),
        }).catch(() => null);
        this.systemNotice = "已请求内核缓存维护";
        this.markAction(text);
        return;
      }
      if (text.includes("新建")) return this.createTaskDraft();
      return this.fetchNeuroState();
    },
    exportRole() {
      this.exportJsonFile(`openxnet-role-${this.selectedRole?.id || "role"}.json`, this.selectedRole || {});
    },
    copyRole() {
      this.copyText(JSON.stringify(this.selectedRole || {}, null, 2), "角色");
    },
    async loadVoices() {
      try {
        this.voiceCatalog = await this.apiRequest("/system/voices");
        this.markAction("同步语音");
      } catch (error) {
        this.markAction(`语音同步失败: ${error.message || error}`);
      }
    },
    async previewVoice(row) {
      if (!row) return;
      try {
        await this.apiRequest("/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: `这里是 ${row.role} 的语音试听。`, voice: row.voice, provider: this.voiceProvider }),
        });
        this.markAction(`${row.role} 试听`);
      } catch (error) {
        this.markAction(`试听失败: ${error.message || error}`);
      }
    },
    async startVrmWindow() {
      try {
        if (window.electronAPI?.startVRMWindow) {
          await window.electronAPI.startVRMWindow({});
          this.markAction("启动桌宠");
          return;
        }
        this.markAction("当前环境不支持桌宠窗口");
      } catch (error) {
        this.markAction(`启动桌宠失败: ${error.message || error}`);
      }
    },
    async stopSelectedTool() {
      const tool = this.selectedTool;
      if (!tool) return;
      tool.enabled = false;
      this.persistToolSettings();
      this.markAction(`${tool.name} 卸载`);
    },
    runApiAction(label, payload = {}) {
      const text = String(label || "");
      if (text.includes("文档") || text.includes("Try it out")) return this.openApiDocs();
      if (text.includes("模型")) return this.importProviderModels();
      if (text.includes("审计") || text.includes("导出")) return this.exportDiagnostics();
      if (text.includes("任务") || text.includes("运行") || text.includes("脚本")) return this.createTaskDraft();
      if (text.includes("刷新") || text.includes("同步")) return this.fetchApiWorkbenchOverview();
      if (payload.path) return this.copyText(payload.path, "接口路径");
      this.markAction(text || "API 操作");
    },
    openApiDocs() {
      const origin = window.location.origin || "http://127.0.0.1:3456";
      return this.openExternalUrl(`${origin}/docs`);
    },
    async checkUpdates() {
      this.systemError = "";
      this.systemNotice = "";
      this.systemActionLoading = "check-updates";
      try {
        if (!window.electronAPI?.checkForUpdates) {
          this.systemNotice = "当前浏览器环境不支持桌面更新检查";
          return;
        }
        const result = await window.electronAPI.checkForUpdates();
        this.systemNotice = toDisplayString(result?.message || result?.status || result, "已发起更新检查");
        this.markAction("检查更新");
      } catch (error) {
        this.systemError = error.message || "检查更新失败";
      } finally {
        this.systemActionLoading = "";
      }
    },
    resetSystemSettings() {
      this.webSearchEnabled = false;
      this.deepResearchEnabled = false;
      this.thinkingEnabled = false;
      this.temperature = 0.7;
      this.maxTokens = 8192;
      this.persistSettings();
      this.systemNotice = "已恢复稳定默认设置";
      this.markAction("重置设置");
    },
    saveSystemSettings() {
      this.persistSettings();
      this.saveSettingsNow();
      this.systemNotice = "系统设置已保存";
      this.markAction("保存系统设置");
    },
    runSystemAction(action) {
      const label = typeof action === "string" ? action : action?.label;
      if (label === "清除缓存" || label === "清理缓存") {
        this.systemNotice = "已清理当前新 UI 的临时状态缓存";
        this.providerError = "";
        this.taskError = "";
        this.subscriptionError = "";
        this.markAction(label);
        return;
      }
      if (label === "导出数据") {
        return this.exportDiagnostics();
      }
      if (label === "导入配置" || label === "上传文件") {
        return this.openFilePicker(label);
      }
      if (label === "恢复默认设置" || label === "重置设置") {
        return this.resetSystemSettings();
      }
      if (label === "检查更新") return this.checkUpdates();
      if (label === "保存系统设置") return this.saveSystemSettings();
      this.markAction(label || "系统操作");
    },
    async openFilePicker(label = "选择文件") {
      try {
        const result = await window.electronAPI?.openFileDialog?.();
        const files = Array.isArray(result?.filePaths) ? result.filePaths : [];
        this.systemNotice = files.length ? `已选择 ${files.length} 个文件` : "未选择文件";
        this.markAction(label);
      } catch (error) {
        this.systemError = error.message || "文件选择失败";
      }
    },
    async openConfigDirectory() {
      this.systemError = "";
      this.systemNotice = "";
      try {
        if (window.electronAPI?.openAppDirectory) {
          await window.electronAPI.openAppDirectory();
          this.systemNotice = "已打开应用目录";
          return;
        }
      } catch (error) {
        this.systemError = error.message || "打开配置目录失败";
        return;
      }
      this.systemNotice = "当前浏览器环境不支持打开本地目录";
    },
    async restartApp() {
      this.systemError = "";
      this.systemNotice = "";
      this.saveSystemSettings();
      try {
        if (window.electronAPI?.restartApp) {
          await window.electronAPI.restartApp();
          this.markAction("应用并重启");
          return;
        }
        this.systemNotice = "当前浏览器环境不支持桌面重启，请在 Electron 客户端内操作";
      } catch (error) {
        this.systemError = error.message || "重启失败";
      }
    },
    runQuickTool(tool) {
      if (!tool) return;
      if (tool.id === "web") this.webSearchEnabled = true;
      if (tool.id === "deep") this.deepResearchEnabled = true;
      if (tool.id === "workflow") return this.createTaskDraft();
      if (tool.id === "skill") {
        this.transformText = this.messages.map((message) => `${message.role}: ${message.content}`).join("\n\n");
        this.navigate("skills");
        this.skillTab = "transform";
        return;
      }
      this.persistSettings();
      this.markAction(tool.label);
    },
    skillIconFor(value) {
      const text = String(value).toLowerCase();
      if (text.includes("code") || text.includes("代码")) return "fa-solid fa-code";
      if (text.includes("doc") || text.includes("文档")) return "fa-solid fa-file-lines";
      if (text.includes("image") || text.includes("视觉")) return "fa-solid fa-eye";
      if (text.includes("data") || text.includes("sql")) return "fa-solid fa-database";
      if (text.includes("browser") || text.includes("web")) return "fa-solid fa-globe";
      return "fa-solid fa-wand-magic-sparkles";
    },
    installSkill(skill) {
      skill.installed = true;
      skill.enabled = true;
    },
    crystallizeSkill() {
      const name = this.transformText.trim().split(/\s+/).slice(0, 4).join(" ") || "新技能";
      this.skills.unshift({
        id: makeId(),
        name: this.transformSkillName.trim() || name,
        description: this.transformSkillDesc.trim() || "由当前内容转化生成的技能草稿",
        tags: ["自定义"],
        icon: "fa-solid fa-gem",
        rating: 4,
        installed: true,
        enabled: true,
        custom: true,
        iconClass: "skill-card__icon--violet",
      });
      this.skillTab = "library";
      this.skillFilter = "自定义";
    },
    persistToolSettings() {
      this.settings.tools = this.settings.tools || {};
      for (const tool of this.toolkitTools) {
        if (tool.id === "webSearch") {
          this.settings.webSearch = { ...(this.settings.webSearch || {}), enabled: tool.enabled, when: tool.trigger };
        } else {
          this.settings.tools[tool.id] = { ...(this.settings.tools[tool.id] || {}), enabled: tool.enabled, triggerMode: tool.trigger };
        }
      }
      this.webSearchEnabled = Boolean(this.toolkitTools.find((tool) => tool.id === "webSearch")?.enabled);
      this.persistSettings();
    },
    addRoleDraft() {
      const role = this.defaultRole(makeId(), "新角色", "自定义", "新的 OpenXnet 角色", "#5BA3C5");
      this.roles.unshift(role);
      this.selectedRoleId = role.id;
      this.roleTab = "memory";
    },
    deleteSelectedRole() {
      if (!this.selectedRoleId || this.roles.length <= 1) return;
      const index = this.roles.findIndex((role) => role.id === this.selectedRoleId);
      if (index < 0) return;
      const [removed] = this.roles.splice(index, 1);
      if (this.settings.agents && removed?.id) delete this.settings.agents[removed.id];
      this.selectedRoleId = this.roles[Math.max(0, index - 1)]?.id || this.roles[0]?.id || null;
      this.persistSettings();
    },
    persistRole() {
      this.settings.agents = this.settings.agents || {};
      for (const role of this.roles) {
        this.settings.agents[role.id] = {
          ...(this.settings.agents[role.id] || {}),
          name: role.name,
          tag: role.tag,
          description: role.desc,
          prompt: role.prompt,
          model: role.model,
          temperature: role.temperature,
          vision: role.vision,
          autoBehavior: role.behavior,
          voice: role.voice,
          voiceEnabled: role.voiceEnabled,
          screenFrequency: role.screenFrequency,
          privacyBlur: role.privacyBlur,
          color: role.color,
        };
      }
      this.persistSettings();
    },
    addTransformParam() {
      this.transformParams.push({ name: "param", type: "string", defaultValue: "" });
    },
    toggleToolkitSection(sectionId) {
      this.toolkitSectionOpen[sectionId] = !this.toolkitSectionOpen[sectionId];
    },
    statusLabel(tool) {
      if (!tool) return "未安装";
      return tool.enabled ? "运行中" : "已安装";
    },
    statusClass(tool) {
      return tool?.enabled ? "running" : "installed";
    },
    updateToolField(tool, field) {
      if (!tool || !field) return;
      if (field.label === "触发时机") tool.trigger = field.value;
      this.persistToolSettings();
    },
    insertSnippet(snippet) {
      this.userInput += this.userInput ? `\n${snippet}` : snippet;
      nextTick(() => {
        this.$refs.composer?.focus();
        this.resizeComposer();
      });
    },
    resizeComposer() {
      const textarea = this.$refs.composer;
      if (!textarea) return;
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
    },
    scrollMessagesToBottom() {
      const el = this.$refs.messagesScroller;
      if (el) el.scrollTop = el.scrollHeight;
    },
    messageClass(message, index) {
      const previous = this.visibleMessages[index - 1];
      return {
        "message--user": message.role === "user",
        "message--ai": message.role !== "user",
        "message--same-role": previous && previous.role === message.role,
      };
    },
    formatMessage(content) {
      let html = escapeHtml(content || "");
      html = html.replace(/```([\s\S]*?)```/g, (_, code) => `<pre>${escapeHtml(code.trim())}</pre>`);
      html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
      html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      html = html.replace(/\n{2,}/g, "</p><p>");
      html = html.replace(/\n/g, "<br>");
      return `<p>${html}</p>`;
    },
    formatTime(value) {
      const date = value ? new Date(value) : new Date();
      return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    },
    formatDate(value) {
      if (!value) return "刚刚";
      const date = new Date(value);
      return date.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
    },
    formatRelativeTime(value) {
      if (!value) return "刚刚";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return String(value);
      const diff = Date.now() - date.getTime();
      const minute = 60 * 1000;
      const hour = 60 * minute;
      const day = 24 * hour;
      if (diff < minute) return "刚刚";
      if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
      if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
      return date.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
    },
    formatFullDate(value) {
      if (!value) return "";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return String(value);
      return date.toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    },
    formatNumber(value) {
      const number = Number(value || 0);
      if (!Number.isFinite(number)) return "0";
      return number.toLocaleString("zh-CN");
    },
    formatStorageMb(value) {
      const mb = Number(value || 0);
      if (mb >= 1024) return `${Math.round(mb / 1024)} GB`;
      return `${Math.round(mb)} MB`;
    },
    percentOf(used, total) {
      const totalNumber = Number(total || 0);
      if (!totalNumber) return 0;
      return Math.max(0, Math.min(100, Math.round((Number(used || 0) / totalNumber) * 100)));
    },
  },
}).mount("#app");
