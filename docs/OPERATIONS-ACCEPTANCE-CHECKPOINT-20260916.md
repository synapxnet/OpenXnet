<!-- Copyright (C) 2026 Synapxnet. All rights reserved.
This file is Synapxnet Proprietary and Confidential. Copying, distribution, or use requires explicit authorization.
Author: maoyo | Department: 研发部 | Date: 2026-09-16 | Version: 1.3.0 | Security Level: INTERNAL
Maintainer: maoyo | Email: synapxnet@gmail.com -->

# 运行指挥台验收检查点

当前状态：实际桌面验收已完成，Builtin 成功恢复、Builtin 验证失败后补偿，以及真实 AgentTeams 成功恢复均已有 GUI 与持久化记录。完整 AgentTeams 链路使用 `1.3.0-contract.1`，业务工具仍为 Fixture；新版 `contract.2` 已部署，新的独立真实规划阶段复测通过，未重复完整闭环。主题切换、灵动岛点击、HUD 通知、窄窗口布局和打包版冷启动均已通过。最终 1.3.0 安装包已生成并同步到交付目录。

此前“物理 Esc 后暂停”的记录已过时，不再代表当前进度。本文区分实际通过的流程、历史自动检查和待验收项，不把已有安装包或旧截图算作本次最终交付。

## 已完成修复

- 运行指挥台整行布局、工作空间与状态筛选、搜索、全部运行记录和跨空间待审批队列。
- GOAI 入口仅负责特征漂移演练触发；共享运行详情、审批、验证和审计归属正式指挥台。
- 八步前置引导、实际团队绑定、明确禁用原因、工作空间业务名称与技术字段折叠。
- 只迁移无 Trace/审批/证据的旧演示事件工作空间；历史审计不改属，群聊任务同步使用真实 ID。
- 平台可达与页面身份匹配独立表达；错误平台和 HTTP 404 不再在线。页面身份匹配不等于驻场 Agent 健康。
- HUD/灵动岛使用 enterprise_run 身份，保留 workspaceId/incidentId/traceId；点击前由 Main 核对当前 Trace，只打开正式详情。
- 本机 AgentTeams 和 Live 执行配置缺失明确提示，不以团队模板或网页在线代替运行就绪。
- Python 服务与桌面发布版本统一 1.3.0。

## 实际桌面与业务验收范围

使用源码 Electron 和实际已登录账户，依次检查企业沙盘、工作空间、员工、协作团队、运行指挥台、AIOps、DataOps、MLOps 和 GOAI 页。已保存总览、八步引导、运行详情、浅色/深色、侧栏开合和窄窗口画面。当前验收使用真实 Workspace UUID、三名 GOAI 员工及已绑定团队。

工作空间、三名员工和团队名称完整可见；三平台预览分别载入正确平台登录页。本轮没有登录三平台后逐菜单验收，入口及平台身份检查不能称为平台全量验收。

| 流程 | 环境 | 已观察结果 | 数据核对 |
| --- | --- | --- | --- |
| 成功恢复 | 真实桌面 + Builtin + Fixture | RESOLVED，9 步成功，独立验证 PASSED | 23 证据 / 8 回执；1 条 COMMITTED 闭环记忆 |
| 验证失败并补偿 | 真实桌面 + Builtin + Fixture | 独立验证否决关闭，2 步补偿成功，事件保持 FAILED | 25 证据 / 10 回执；没有成功闭环记忆 |
| 真实 AgentTeams 成功恢复 | 真实桌面 + 远端 AgentTeams + Fixture | 人工批准后 9 步成功；真实 Verifier CLOSE；独立验证 PASSED；RESOLVED | 23 调用 / 23 证据 / 8 回执；1 条 COMMITTED 闭环记忆 |

Builtin 明细见 `artifacts/ops-acceptance-20260916/builtin-runtime-acceptance.json` 与 `.md`。真实 AgentTeams 明细见同目录 `agentteams-runtime-acceptance.json` 与 `.md`，对应 `inc_a622f6fd-decd-4113-a4f1-97e0a47a4c7b` / `trace_1d476ade-ce1f-48b8-a744-bf44c1bec8cb`。`agentteams-runtime-progress.json` 是调查阶段快照，应以完成后的独立验收报告判断本次终态。

AgentTeams 独立审计调用当前 `resolveIndependentVerification`，核对实际回执、同一运行的 5 条新证据、必需探针和成功调用、Verifier 角色以及执行者分离；没有从 RESOLVED 反推验证通过。9 类运行对象未发现 Workspace / Trace 混属，审批计划摘要与执行一致。企业聊天有 25 条消息、17 条操作卡，9 个步骤按动作/步骤 ID、证据及工具名逐项匹配；Memory V3 通过只读 SQLite 核对为 COMMITTED。

实际画面位于 `artifacts/ops-acceptance-20260916/`：`15`～`22` 为总览、详情、主题与窗口、待审批等检查，`23`～`26` 为 Builtin 成功和补偿，`27`～`28` 为 HUD 状态，`29-agentteams-resolved.png` 为真实 AgentTeams 已解决状态，`30` 为完成通知，`31` 为灵动岛点击修复，`38`～`39` 为打包版主题切换和浅色总览。HUD 与灵动岛协议、定位逻辑及打包版冷启动已完成复核。

Skill 的 `READY_FOR_CERTIFICATION` 表示可进入环境认证，不能声称生产认证已完成。所有业务工具为 Fixture；这次真实模型协作不证明线上三平台 Live 写入成功。

## 尚未关闭的验收项

1. **规划摘要事实边界。** `contract.1` 的取证规划在 Evidence 为空时声称工具完成并生成无依据指标，一次 Worker 纠正后仍保留这些声明。原始运行记录不改写；结构化调用与 Evidence 独立核对通过，也不能替旧摘要背书。主界面应只呈现真实规划状态，原摘要保留在审计展开区。设计见 `AGENTTEAMS-STAGE-SEMANTICS-DESIGN.md`。
2. **`contract.2` 已通过的阶段复测与完整闭环边界。** 新版已部署并通过公网与启动器预检；独立新 Incident / Trace 的实际 Leader 和 Worker 在约 40.5 秒内仅选择完整 9 工具计划，Evidence 为空，4 条 Matrix 事件且无纠错，没有声称工具完成或生成实测指标。报告为 `artifacts/ops-acceptance-20260916/adapter-contract2-planning-probe.json` / `.md`。未执行南向工具、未审批、未改写旧运行，结束后租约与在途连接均为 0；这是规划阶段复测通过，不能与旧版完整链路合并声称 `.2` 完整闭环已重新执行。
3. **三平台 Live 全量验收。** 本轮只完成平台身份与公开健康检查，以及 Fixture 业务链；没有登录三平台后逐菜单执行真实写入。
4. **线上 AgentTeams 新 Run。** `.1` 的真实 AgentTeams + Fixture 完整闭环已保留；`.2` 仅完成规划阶段复测，未执行南向工具、审批或完整闭环。

## 启动就绪前凭据迁移警告的最小修正设计

本段先于修复代码写入。`main.js` 在顶层为 Skill 工作目录授权集合读取 `legacyRendererState.getSnapshot()`，会在 `app.whenReady()` 前间接触发设置中的凭据迁移。此时 safeStorage 尚未可用，即使没有配置模型密钥也会产生迁移警告。后续读取没有缓存并会重试，本次未发现凭据丢失证据。

仅保留授权集合的顶层创建，将持久 `CLISettings.cc_path` 的读取、空白清理、空值及 NUL 拒绝、绝对路径写入提取为 `initializePersistedSkillWorkspaceDirectories`，放到既有 `app.whenReady().then` 回调的 `try` 起点，位于桌面服务和窗口创建之前。授权条件、normalizer、凭据存储及加密边界不变。

回归从真实 Main 源码提取工作目录初始化区域和实际 ready 回调前段，在隔离 VM 中使用可控 ready Promise：就绪前任何 `getSnapshot` 都立即抛错；就绪后确认只读取一次，且早于 `desktopCore.start`，有效持久目录及本次授权目录仍可使用，无效目录仍不能取得授权。不启动 Electron，不读取用户设置或密钥。

## 已有自动检查与构建证据

- 此前检查点完整 TypeScript 测试编译成功。
- 此前组合测试 57/57：renderer、Workspace解析/三空间隔离、平台身份、Main提醒、浮窗事件。日志 `artifacts/ops-acceptance-checkpoint-tests.log`。这不是后续全部修改的最终回归结论。
- 后台独立回归 47/47；三独立真实 Workspace UUID 分别执行成功、验证失败并补偿、待审批，重启恢复一致。使用隔离目录和 Builtin/Fixture，不能称为线上 AgentTeams 实跑。
- 新 `dist/server` 与内置 Memory Pack 已构建成功，日志分别为 `artifacts/ops-acceptance-backend-build.log`、`artifacts/ops-acceptance-memory-build.log`。
- Main 治理操作卡投影回归 11 项通过，修复执行步骤与补偿阶段丢卡；源码语法检查通过。
- 安全启动器 21 项隔离测试通过，包括旧 `contract.1` 即使能力字段完整也不得读取委托密钥或启动新版验收。
- npm 资源回归 4 项通过：使用真实构建器在独立临时目录复制资源，依赖从产物内部解析，复制后的 npm `--version` 为 `11.19.1`。
- 本轮冷启动检查已通过，记录为 `artifacts/ops-acceptance-release-cold-start.log`，包含凭据迁移至 safeStorage 的验证；它验证源码冷启动，不替代后续新 EXE 冷启动。
- Renderer bootstrap 后续仍有改动，最终摘要应在最后一次构建后记录；不保留旧摘要作为最终产物身份。

## 打包输入与文件头复核

2026-09-16 12:40（北京时间）按实际 electron-builder 匹配器重新只读枚举：主程序 708 个文件、额外资源 7,068 个文件；来源路径与前次审计加 npm 修复后的集合一致。`package.json` SHA-256 为 `54f9bd5105a25c51ccc135e025ae63bfb49a6a317e9d378a73d0bc3f89d46ed0`。明细见 `artifacts/ops-acceptance-20260916/release-prepack-check.json`，原完整清单与 npm 修复记录见 `release-input-audit.json` / `.md`。

- `services/`、根 `scripts/`、`tests/`、`docs/` 及本轮验收 artifacts 均未入选；AgentTeams 服务源码和验收启动器不随 EXE 自动分发。
- 没有入选的 `.env`、用户 `config.json`、密钥文件等名称候选；源与已构建后端模板各检查 45 个敏感名称字符串字段，均为空。此筛选比旧报告更宽，计数不可直接比较。3 个 PEM 文件未发现私钥块。
- 本次没有重新选择生产依赖，沿用前次已审的 233 包 / 3,024 文件；没有进行完整二进制、归档或第三方语义级秘密扫描，不能据此声称所有字节绝无秘密。
- 文件头抽查覆盖 34 个本轮相关源文件、测试、文档和服务维护文件。版权、作者、部门、日期、版本和安全级别齐全；发现 3 处缺 Maintainer / Email 后已获授权仅补注释。Adapter 保留现有 AGPL 许可证和第三方声明，不改写为专有许可。
- 原解包应用缺少 npm 自身依赖的问题已修复打包规则；最终完整应用已检查 `resources/npm/node_modules`，并通过 npm 资源回归。
- `static/sw-debug.html` 仍在资源输入中，原审计将其列为可选发行过滤项；本轮没有擅自更改资源规则。

## 最终相关命令

以下命令在 `E:\SynapXnet\openxnet-source` 执行。17 个测试输入路径已逐一确认存在；最终相关组合测试 `164/164`、主题 IPC `26/26`、Companion `14/14`、Renderer `42/42` 均通过。后台独立回归 47/47；三独立真实 Workspace UUID 分别执行成功、验证失败并补偿、待审批，重启恢复一致。使用隔离目录和 Builtin/Fixture，不能称为线上三平台 Live 实跑。

```powershell
npm run build:desktop-core:test
node --test --test-concurrency=1 tests/application_goai_competition_renderer.test.cjs tests/application_enterprise_sandbox_collaboration_renderer.test.cjs tests/companion_completion_events.test.cjs tests/competition_operation_projection.test.cjs tests/packaged_runtime_dependencies.test.cjs tests/packaged_npm_resources.test.cjs build-ts/desktop/competition/application-competition-runtime.test.js build-ts/desktop/competition/competition-agentteams-adapter.test.js build-ts/desktop/competition/competition-resident-agents.test.js build-ts/desktop/competition/competition-workspace-resolution.test.js build-ts/desktop/competition/competition-resource-versions.test.js build-ts/desktop/competition/competition-approval-publisher.test.js build-ts/desktop/competition/competition-tool-adapter.test.js build-ts/desktop/competition/competition-mcp-gateway.test.js build-ts/desktop/main/register-application-competition-runtime-ipc.test.js build-ts/desktop/main/register-completion-notice-ipc.test.js build-ts/desktop/enterprise/enterprise-platform-identity.test.js
python -X utf8 -B scripts/start_goai_acceptance_runtime.test.py
npm --prefix services/openxnet-agentteams-adapter run check
npm --prefix services/openxnet-agentteams-adapter test
node --check main.js
npm run check:function-docs
```

最后一次源码修改后已生成桌面核心与 Renderer，并校验引导文件；后端和 Memory 构建记录完整，打包输入已复核包含 npm 运行时资源。

```powershell
npm run build:desktop
npm run check:renderer-bootstrap
```

最终 NSIS 产物已在 `release/` 验收并同步到 `E:\SynapXnet\openxnet-desktop`；旧版本保存在 `E:\SynapXnet\openxnet-desktop\history\20260916-before-ops-acceptance`。打包版冷启动通过，安装器与交付目录副本 SHA-256 均为 `EFC95D443A982BB7B9457590A9DF500CB914116D2BF0702CAE5C3020EF524AFB`，版本元数据为 `1.3.0`，对应 Adapter `1.3.0-contract.2`（规划阶段复测）。

```powershell
node node_modules/electron-builder/cli.js --win nsis --x64 --publish never
```

不能使用省略后端、VR、Skill 和 Memory 的 `pack:ui-smoke` 替代完整发行。普通 EXE 不携带 AgentTeams 委托密钥；需要使用交付目录中的安全启动器进行本机 AgentTeams 验收。
