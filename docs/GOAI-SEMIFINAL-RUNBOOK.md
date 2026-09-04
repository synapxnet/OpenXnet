# OpenXnet 企业空间复赛运行手册

候选版本：`v1.2.0`

## 1. 作品边界

复赛作品是 **OpenXnet 企业空间**：企业领导在项目群中组织 AI 员工，由 AgentTeams 完成角色编排、任务拆解、上下文传递和状态追踪；OpenXnet 负责 Skill/MCP 工具接入、神经符号治理、人工审批、确定性执行、独立验证、失败补偿、证据沉淀和经验复用。

XnetAIOps、XnetDataOps 和 XnetMLOps 是 SynapXnet 生态中的企业系统，由 OpenXnet 通过受控工具契约调用，不作为三个割裂的参赛产品。

## 2. 主 Demo

主 Demo 为“跨域特征漂移恢复”。领导输入业务通过率下降任务后，系统完成以下闭环：

1. Incident Commander 把任务委派给 Evidence Agent。
2. Evidence Agent 通过 MCP/Tool Adapter 读取 AIOps、DataOps 和 MLOps 证据。
3. Incident Commander 汇总根因并申请完整九步恢复计划的人工审批。
4. 人工只批准或拒绝一次完整计划。
5. 批准后 OpenXnet 自动执行备用特征止损、数据回填、质量门、重训练、评估、登记、5% 灰度、全量提升和退出备用特征。
6. Verification Agent 独立读取验证证据，OpenXnet 客观验证器保留最终否决权。
7. 任一执行或验证门失败时自动运行两步补偿计划，事件保持 FAILED。
8. 成功事件沉淀为 Candidate Skill；人工认证并在企业空间启用后，第二次同指纹事件记录 REUSED 证据。

## 3. 干净环境初始化

先构建 Desktop Core，再运行幂等初始化：

```powershell
npm run init:goai:workspace
```

脚本会创建或对齐以下固定资源：

- Workspace：`ws_goai_demo`
- 项目楼层：`project_goai_enterprise_ai_governance`
- Incident Commander：Leader
- Evidence Agent：Worker
- Verification Agent：Verifier
- 团队模板：`team_goai_semifinal`
- XnetAIOps、XnetDataOps、XnetMLOps HTTPS 地址

脚本不保存账号密码、Token、私钥或模型密钥。重复运行不会创建重复角色或重复团队；团队定义不变时不会递增模板版本。

## 4. 手工演示步骤

1. 登录 OpenXnet 企业账号。
2. 打开“企业空间 → 企业沙盘”。
3. 进入“企业 AI 全链路治理”项目楼层并打开项目协作群。
4. 选择 `AgentTeams` 和“OpenXnet 跨域治理团队”。
5. 输入：`请调查优质客户审批通过率持续下降，并给出可审批、可回滚的恢复方案。`
6. 点击“发起任务”，不要点击普通发送按钮。
7. 在群聊中核对 Leader 委派、Worker 取证结果、风险等级和 Trace 引用。
8. 打开“事件中心”，核对三平台证据、AgentTeams 决策链和待审批完整计划。
9. 选择“自动闭环”，填写审批意见并点击“批准处置”。
10. 核对九步计划、独立验证、Audit Receipt、神经符号和知识图谱状态。
11. 点击“导出复赛证据”，生成评测报告和 OTLP 风格遥测。

需要逐步讲解时，把运行方式切换为“分步讲解”，依次执行 Dry Run、正式处置和独立验证。两种模式使用同一控制面和治理约束，不是两套 Demo。

## 5. Skill 二次复用演示

1. 完成一次正常闭环，系统生成 `synapxnet-feature-drift-recovery` Candidate Skill。
2. 打开“企业技能”，完成测试/认证后在 `ws_goai_demo` 中启用该 Skill。
3. 在“事件中心 → Staging 演练”重置本轮数据，再从项目群重新发起同类主 Demo。
4. 在事件指标中核对 Skill 状态为“已启用复用”。
5. 导出复赛证据，确认 `skillReuse.status=REUSED` 且 `sourceIncidentId` 指向第一次已解决事件。

Candidate 默认不自动获得企业执行权。未认证、未启用或查询失败时，系统只记录 BASELINE/LOOKUP_FAILED，不会虚构复用。

## 6. 失败路径演示

在“事件中心 → Staging 演练”中切换 `Fixture` 并选择“验证失败”，再执行同一流程：

- 独立验证必须拒绝关闭事件。
- Action、Trace 和 Incident 必须保持 FAILED。
- 两个 Compensation Step 必须完成。
- FAILED 事件不得沉淀为 Skill。
- “导出失败证据”必须记录 `compensationStatus=SUCCEEDED`。

AgentTeams 隔离服务不可用、身份不匹配或回执越权时，本轮流程失败并停止，禁止静默回退到 Builtin。

## 7. 重置边界

比赛 Staging 包中，“事件中心 → Staging 演练”的“重置演练数据”会清理：

- Incident、Trace、Evidence、Approval、Action 和 Audit Receipt
- AgentTeams Binding、Decision 和 Skill Usage
- 与本轮 Incident/Trace 对应的项目群执行消息
- 对应的神经符号和知识图谱比赛投影

普通聊天、登录态、角色卡、团队模板、三平台 URL、模型配置、Candidate Skill 和企业 Skill 绑定会保留。

## 8. 评测与遥测产物

终态事件可导出：

```text
<OpenXnet userData>/competition/evaluations/<incidentId>/evaluation-report.json
<OpenXnet userData>/competition/evaluations/<incidentId>/otel-telemetry.json
<OpenXnet userData>/competition/evaluations/<incidentId>/agentteams-events.jsonl
```

`evaluation-report.json` 包含角色职能、运行 Runtime、工具/证据/审批/步骤/验证/补偿计数、要求覆盖矩阵和 Skill 复用来源。`otel-telemetry.json` 使用 OTLP 风格 `resourceSpans/resourceMetrics`，只包含摘要属性，不包含工具参数、凭据或原始请求正文。`agentteams-events.jsonl` 保存脱敏 Matrix 原始事件包络和连续哈希链。

正式四链证据通过受 Bearer 令牌保护的 OTLP/HTTP JSON 接收器投递到 goai-staging 后端。接收器仅开放 `/v1/traces`、`/v1/metrics` 和受认证回执查询，按 Incident/Trace/信号摘要幂等持久化；客户端回读服务端回执并生成：

```text
<OpenXnet userData>/competition/evaluations/otlp-delivery-receipts.json
```

当前正式清单包含 4 个 Incident、8 个 Trace/Metrics 服务端回执。无令牌写入返回 401，接收器不保存工具原始参数和平台凭据。

Fixture 明确标记为 `simulation`；Live 当前标记为 `staging`，不得作为生产运行证明。

生产发布配置只显示“事件中心”，用于真实告警、工单、数据事件、API 和项目群任务的审批、执行观察、验证、回滚与审计，不提供固定场景、`Fixture / Live`、验证失败注入或演示重置。比赛包通过 `goai-staging` 发布配置额外开放 Staging 演练工具，两者共用同一套治理控制面，不复制审批或执行后端。

## 9. 官方 PAI EAS Skill 边界

安装包固定携带 `alibabacloud-pai-eas-service-diagnose` 官方制品，记录上游 ZIP SHA-256、10 个文件摘要、Apache-2.0 许可证和内容版本。OpenXnet 运行边界只允许 `Describe*`、`List*` 操作，禁止凭据回读和任何部署、更新、重启、扩缩容或删除操作。

比赛环境当前未配置 Alibaba Cloud PAI EAS 账号和 Aliyun CLI 身份，因此状态必须显示 `NOT_CONFIGURED`，不得用 XnetMLOps staging 数据冒充阿里云诊断结果。配置真实账号前应使用独立最小权限 RAM 身份，并保留官方 Skill User-Agent Trace。

## 10. AgentTeams 可执行包

安装冻结构建依赖后生成 Win32 x64 自包含 Feature Pack：

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-agentteams-build-win32.txt
npm run build:feature-pack:agentteams
```

产物位于：

```text
artifacts/feature-packs/agentteams/<version>-win32-x64/
```

目录包含原生 Worker、UTF-8 `manifest.json`、文件大小和 SHA-256 清单。Competition 使用独立 AgentTeams 服务登录域和委派令牌，不复用 OpenXnet 登录服务。

## 11. 验证命令

```powershell
npm run test:goai:semifinal
npm run verify:goai:semifinal
```

第一条执行 Competition、AgentTeams、MCP、IPC、企业群聊和 Renderer 定向回归；第二条额外执行 Skill 契约与 Fixture 全链路冒烟。

Live 冒烟默认验证 AgentTeams 完整链路，需要显式提供以下配置：

| 配置 | 用途 | 边界 |
| --- | --- | --- |
| `OPENXNET_GOAI_SMOKE_CONFIRM_STAGING` | staging 执行确认 | 必须为 `1` |
| `OPENXNET_AIOPS_BASE_URL` | XnetAIOps Adapter | HTTPS，不得内嵌凭据 |
| `OPENXNET_DATAOPS_BASE_URL` | XnetDataOps Adapter | HTTPS，不得内嵌凭据 |
| `OPENXNET_MLOPS_BASE_URL` | XnetMLOps Adapter | HTTPS，不得内嵌凭据 |
| `OPENXNET_COMPETITION_APPROVAL_BASE_URL` | 审批证明服务 | HTTPS，不得内嵌凭据 |
| `OPENXNET_COMPETITION_AGENTTEAMS_BASE_URL` | AgentTeams 隔离服务 | HTTPS，不得内嵌凭据 |
| `OPENXNET_AGENT_DELEGATION_SECRET` | 三平台短期委托令牌签名 | 至少 32 字符，只通过环境注入 |
| `OPENXNET_AGENTTEAMS_DELEGATION_SECRET` | AgentTeams 短期委托令牌签名 | 至少 32 字符，只通过环境注入 |
| `OPENXNET_APPROVAL_ISSUER_TOKEN` | 审批服务发行者认证 | 只通过环境注入 |
| `OPENXNET_GOAI_SMOKE_TEMP_ROOT` | 可清理临时根目录 | 建议位于 E 盘 |
| `OPENXNET_GOAI_SMOKE_DATA_DIR` | 本轮 Competition 数据目录 | 必须位于临时根目录且以 `openxnet-goai-live-` 开头 |
| `OPENXNET_GOAI_ENTERPRISE_DATA_DIR` | staging 企业 Workspace 数据 | 不得指向生产用户目录 |

`OPENXNET_GOAI_SMOKE_TEAM_RUNTIME` 默认是 `agentteams`。只测试三平台工具契约时才可显式设为 `builtin`；该结果不能作为 AgentTeams 复赛闭环证明。配置完成后执行：

```powershell
npm run smoke:goai:live
```

不得把凭据写入仓库、日志、截图、评测报告或 Feature Pack。

OTLP 正式证据投递使用：

```powershell
D:\synapxnet\scripts\Publish-GoaiOtlpEvidence.ps1
```

该脚本只在当前 PowerShell 进程内读取比赛服务器令牌，投递结束后立即清理环境变量。

## 12. 升级与回滚边界

- `v1.2.0` 延续 `v1.1.0` 的企业 Workspace、角色卡、团队模板和 Competition 数据结构，现有配置无需迁移。
- 新增字段均按缺省值兼容旧状态；首次读取后由现有 Store 规范化，不改写登录凭据和平台密钥。
- 回滚桌面代码前应先退出 OpenXnet，并保留用户数据目录备份；`v1.1.0` 不消费复赛新增的评测和遥测字段。
- Live 仅用于比赛 staging。回滚时先停止新任务，再按审计回执执行平台补偿，不以删除本地证据代替业务回滚。

最终复赛安装包位于 `C:\Users\Administrator\Desktop\GOAI-比赛资料\复赛\OpenXnet-Setup-1.2.0-win-x64.exe`，SHA-256 为 `F4C7304F11B25FED16472B33DAF93836A19885C5B2559DB30475E35E8FFC5139`。该比赛包尚未使用 Windows Authenticode 代码签名证书，首次安装可能出现 SmartScreen 提示；SSL/TLS 证书不能替代代码签名证书。
