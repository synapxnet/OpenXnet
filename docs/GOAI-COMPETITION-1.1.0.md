# OpenXnet GOAI Competition 1.1.0

> 复赛新增的企业群任务入口、一次审批自动闭环、Skill 二次复用证据、评测/遥测导出和干净环境复现流程，以 [GOAI-SEMIFINAL-RUNBOOK.md](./GOAI-SEMIFINAL-RUNBOOK.md) 为准。本文件保留 1.1.0 工程基线记录。

## 升级目标

| 项目 | 值 |
| --- | --- |
| 基线 | `GOAI-Competition-v1.0.0` / `89163127` |
| 目标 | `1.1.0` |
| 分支 | `GOAI-Competition` |
| 数据迁移 | 无破坏性迁移；首次访问创建 `competition/control-plane.v1.json` |

## 新增能力

- Incident、Trace、Evidence、Approval、Deployment Action 和 Audit Receipt 控制面。
- AIOps、DataOps、MLOps 三十二个固定工具的 Fixture/Live Adapter。
- 人工审批、职责限定身份、资源版本、dry-run 和幂等处置。
- 三类场景各自使用固定取证、处置和独立验证工具，禁止由 Prompt 自由生成写操作。
- MCP `2026-07-28` 版本发现、工具、Resources 和单请求 SSE。
- 可替换 AgentTeams Runtime、惰性 Worker 和签名 Feature Pack 构建入口。
- 企业角色卡组成的 Team Template，包含稳定成员 ID、唯一 Leader、模板版本和 Workspace 边界。
- Incident 启动时固化 Team Binding 与角色快照，后续角色卡修改不改写历史审计事实。
- AgentTeams Controller 与 Matrix 双通道任务适配，真实记录 Worker、Leader、Verifier 的 Sender、Event ID 和阶段决策。
- `goai-evidence-collect`、`goai-change-execute`、`goai-service-verify` 三个版本化 Skill 源包与输入输出校验器。
- 企业空间 `事件指挥` 工作台、三场景选择器和复盘 Skill 结晶。
- 企业沙盘项目楼层由 Desktop Main 持久化，创建后即时重建当前建筑视图并支持重启恢复。
- 企业协作群独立保存领导消息、`@员工` 身份快照及通过契约校验的 AgentTeams 分派/结论，并关联 Task/Trace。
- 复盘结果写入 OpenXnet 全局技能目录的 Candidate 区；模拟和预发布证据不会自动获得企业执行权限。
- Skill Engineering v2 以 Family、Strategy、Evidence、Certification 和 Change Proposal 分离技能、方案、证据与认证范围。

## 三场景编排

三个场景共享同一个 Incident、Trace、AgentTeams、Approval、Action、Evidence、Audit Receipt 和 Knowledge 状态机。差异只存在于固定场景注册表，不复制治理代码。

| 场景 | 主要诊断 | 受审批完整处置 | 独立验证 | 稳定企业 Skill |
| --- | --- | --- | --- | --- |
| 推荐服务 GPU 拥塞 | 成功率/P99、GPU、队列、Kubernetes、DataOps 工作流和模型部署 | 保障 GPU 节点 → 热更新批大小/请求归并/动态形状 → `6→20` 副本 → `10%/50%/100%` 引流 → 队列感知弹性策略 → 收敛到 12 副本 → 恢复批大小 64 | P99、成功率、队列、GPU、就绪副本、弹性策略和业务恢复 | `synapxnet-recommendation-capacity-recovery` |
| 量化模型归因与迭代 | A-CryptoTrader 真实 A 股日线、盘后数据质量/就绪事件、基线归因、部署和推理探针 | 版本化因子数据产品 → 多周期动量流水线 → 30 组受限逻辑回归搜索 → 真实测试集 AUC/IC/相对候选池模拟 Sharpe/回撤 → 模型登记 → 1% 模拟盘灰度 → 100% 模拟信号提升 | 数据清单摘要、时间切分、目标修订、发布状态和真实样本推理探针 | `synapxnet-quantitative-model-iteration` |
| 跨域特征漂移 | AIOps 业务/服务、DataOps 质量/Schema/血缘/SDK 变更、MLOps 输入契约 | 备用特征止损 → 三年数据回填 → 数据质量门 → 12 组重训练 → KS/通过率/风险评估 → 模型登记 → 5% 灰度 → 100% 提升 → 退出备用特征 | 数据质量、推理探针、目标修订、灰度门、业务通过率和服务健康 | `synapxnet-feature-drift-recovery` |

Fixture 已实现三类场景的确定性全闭环。Live 继续使用相同 Tool Adapter 契约；新增工具对应的三平台路径未实现或返回不匹配协议时，流程明确失败并保留 Trace，不回退到 Fixture，也不伪造成功证据。

## 企业 Skill 候选沉淀

已解决事件导出复盘后执行以下固定步骤：

1. 在 Competition 私有复盘目录保留 UTF-8 `SKILL.md` 证据副本。
2. 调用 Main-owned Skill Runtime，以场景稳定 Skill ID 写入 Candidate 和 `openxnet.skill.json` v2 扩展清单。
3. Fixture 证据标记为 `simulation`，Live 比赛环境标记为 `staging`；两者都属于 `rehearsal` 证据来源。
4. 成功 Live 复盘后，Enterprise Runtime 写入 `Workspace + Skill` 绑定并设为 `enabled=true`，使比赛 Workspace 可以在“企业空间 > 企业技能”中直接查看和复用。
5. 启用状态只表示该 Workspace 可选择此 Skill；清单仍固定为 Candidate，认证范围仍是 `rehearsal/staging`，不会因此获得生产工具写权限。
6. 在“技能”主界面展示 Candidate，在“企业空间 > 企业技能”展示已启用绑定、来源 Incident 和认证范围。
7. 重置竞赛事件时保留全局 Skill 和企业绑定，只清理事件、证据和比赛知识投影。

演练 Skill 只有在获得独立的 `production` 范围认证后，才允许调用生产范围写工具。模拟成功率、预发布成功率和生产成功率分别统计，不能相互替代；企业界面的启用开关不改变认证范围。

## Skill Engineering v2

Skill 不再等同于一次成功轨迹或一份 Markdown。内核拆分以下稳定资产：

| 资产 | 职责 |
| --- | --- |
| Episode | 保存一次问题、方案尝试和执行结果 |
| Problem Spec | 保存问题指纹、复现条件、验证 Oracle 和环境快照 |
| Skill Family | 表示一类稳定目标和验收标准 |
| Strategy | 保存同一 Family 下的不同工具链、成本和风险方案 |
| Evidence | 按环境记录成功、失败、反例和来源事件 |
| Certification | 声明 Skill 在 simulation、staging、shadow、canary 或 production 中的可信状态 |
| Change Proposal | 离线巩固提出的晋级、降级或退役建议，必须审批后生效 |

同一问题的多种解法合并到一个 Skill Family，最多保留 32 个策略变体。新执行通常只增加 Evidence；只有目标、验证 Oracle 或权限边界变化时才创建新的 Family。候选 Family 总量设有上限，原始执行轨迹保存在独立证据账本中。

运行时采用四段式选择：

1. 根据任务语义召回可能相关的 Skill Family。
2. 使用符号规则检查生命周期、工具能力、环境认证和生产环境指纹。
3. 使用带先验的成功概率、风险与成本对 Strategy 排序，避免单次成功获得虚高排名。
4. 没有候选通过门控时返回 `abstained=true`，重新进入开发流程，不强行套用 Skill。

原“睡眠结晶”已调整为离线技能巩固：深睡仍执行记忆去重、压缩和稳定模式统计，但不再创建 `sleep-*` 包、不直接同步工作区，也不自动迁移生命周期。它只生成 `SkillChangeProposal`；独立验证者审批后，模拟认证只更新模拟范围，只有生产认证才能改变全局生命周期并同步 Agent 工作区。

## 配置

所有秘密默认值为空或进程随机生成。生产/联调值只能从 Main 环境或安全存储进入：

```text
OPENXNET_COMPETITION_MCP_TOKEN
OPENXNET_COMPETITION_WORKSPACE_ID
OPENXNET_COMPETITION_MCP_ALLOWED_ORIGINS
OPENXNET_COMPETITION_ADAPTER_TOKEN
OPENXNET_AIOPS_ADAPTER_TOKEN
OPENXNET_DATAOPS_ADAPTER_TOKEN
OPENXNET_MLOPS_ADAPTER_TOKEN
OPENXNET_AIOPS_BASE_URL
OPENXNET_DATAOPS_BASE_URL
OPENXNET_MLOPS_BASE_URL
OPENXNET_COMPETITION_APPROVAL_BASE_URL
OPENXNET_APPROVAL_ISSUER_TOKEN
OPENXNET_AGENTTEAMS_CLI
OPENXNET_COMPETITION_AGENTTEAMS_ISOLATED_SERVICE_ENABLED
OPENXNET_COMPETITION_AGENTTEAMS_BASE_URL
OPENXNET_AGENTTEAMS_DELEGATION_SECRET
```

MCP Token 少于 32 个 UTF-8 字节时启动失败。平台专用 Adapter Token 优先于共用 Token。秘密不会进入 Renderer、Trace 或 Evidence；AgentTeams CoPaw Worker 使用派生入口丢弃含凭据字段或 `openclaw.json` 的整行日志，发布验收会对运行容器再次扫描。

`OPENXNET_COMPETITION_AGENTTEAMS_ISOLATED_SERVICE_ENABLED` 默认关闭。启用后 Desktop Main 通过独立 HTTP Adapter 提交 Team Template 快照和三个阶段任务；服务、会话、范围认证或身份化结果失败时标记失败并停止本轮 AgentTeams 流程，不自动回退到 Builtin，也不会误报 `READY`。

## AgentTeams 登录隔离边界

Competition Runtime 只依赖稳定的 Team Template 解析接口，不直接持有 AgentTeams 账号、Cookie、Token 或 Controller 会话。Adapter 已作为独立服务部署，使用独立路由、独立凭据存储和独立会话；桌面端只向该服务提交已授权的模板快照、版本化 Skill 引用和有界 Incident/Trace 上下文。

团队模板管理、Competition Binding 持久化、AES-GCM 会话存储、`agt apply/get`、Matrix 身份路由和 `POST /api/v1/tasks/dispatch` 已实现。稳定 Team 按 Workspace、模板 ID 和模板版本复用；每个 Incident/Trace 使用独立映射文件和短期 JWT，避免重复创建 Worker 或覆盖并发事件审计范围。

## 神经符号与知识图谱闭环

Competition Store 是比赛事件的唯一事实源。Desktop Main 在事件创建、取证完成或失败、审批、处置、独立验证、MCP 工具调用和复盘 Skill 结晶后，向私有 Execution Engine 提交一个脱敏的 Incident 完整投影。投影不包含 Evidence 原始 `data`、工具参数、角色 Prompt、Token、平台凭据或本地绝对路径。

打开事件指挥读取快照时，Runtime 还会对最近三个持久事件执行有界幂等补投影，用于迁移升级前的历史事件并修复上一次临时同步失败；该过程只读取 Competition Store，不访问三平台。

AgentTeams 三阶段决策分别映射到稳定认知算子：

| AgentTeams 阶段 | 职能 | 神经符号算子 |
| --- | --- | --- |
| `INVESTIGATION_PLAN` | Evidence Worker 规划跨平台取证 | `PlanDecompose` |
| `INVESTIGATION_CONCLUSION` | Leader 汇总证据并决定是否申请审批 | `CausalInfer` |
| `VERIFICATION_CONCLUSION` | Verifier 独立判定是否关闭事件 | `ValidateOutput` |

审批映射为 `ApplyLogicRules`，受控动作映射为 `ToolChainExec`，已解决事件映射为 `ConsolidateKnowledge`，导出的复盘能力映射为 `SkillCandidateCrystallize`。离线巩固与认证审批分别映射为 `SkillChangePropose` 和 `SkillCertificationApprove`。每个比赛符号保留 Workspace、Incident、Trace、Agent、角色、阶段、决策、Skill 和置信度等公开元数据，并关联 Evidence ID；系统投影符号不能在神经符号页面单独删除。

时序知识图谱以 `Incident` 为根实体，关联 Scenario、Workspace、Trace、Team、Agent、Decision、Skill、Tool、Evidence、Platform、Approval、Action、Resource、Audit Receipt 和复盘 Skill。关系携带生效时间、置信度和脱敏来源类别。同步采用稳定哈希前缀和完整快照对账：重复同步不复制当前关系，状态变化软失效旧关系，默认图谱优先返回当前事实。

“重置演示数据”会先清理对应比赛神经符号和图谱投影，再清空 Competition Store；清理失败时停止重置，避免失去可重试的 Incident 定位信息。普通神经符号、人工图谱事实和已导出的复盘 Skill 文件不受影响。

演示检索建议：

- 在神经符号库选择“比赛知识”，核对三个 Agent 的算子、身份、阶段、决策、Skill 和置信度。
- 在知识图谱选择“比赛知识”，从 `Incident:{incidentId}` 查看 `has_decision`、`based_on_evidence`、`requires_approval`、`has_action`、`verified_by_evidence` 和 `crystallized_as_skill`。
- 打开“显示历史”核对状态关系的生效与失效变化，证明系统保留过程而不是只展示最终截图。

## 构建

```powershell
npm run build:desktop
npm run build:feature-pack:agentteams
```

AgentTeams Pack 构建依赖：

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-agentteams-build-win32.txt
```

## 回滚

代码回滚到 `GOAI-Competition-v1.0.0` 前先退出桌面应用。`competition` 数据目录为 1.1.0 独占状态，1.0.0 不读取该目录，可保留用于再次升级，也可在人工备份后删除。

卸载 AgentTeams Feature Pack 不影响 Builtin 编排、人工审批、MCP Gateway 或三平台 Adapter。Builtin 与 AgentTeams 是用户显式选择的两种运行方式；正在执行的 AgentTeams 流程失败时禁止静默切换。Live 平台不可用时，用户可在新一轮事件中显式切回 Fixture，历史 Trace 不被改写。

## 公共契约对齐

- MCP `structuredContent` 现在输出 canonical `ToolResponse 1.0.0`，包含 `contractVersion`、`durationMs` 和 `source`，不再暴露内部 `platform/summary` 扩展字段。
- 领域错误固定使用 `data=null`、公共错误码和非空上下文元数据。
- AgentTeams 审批说明在保留步骤 ID 的前提下执行 UTF-8 有界裁剪，确保不超过三平台公共契约的 512 字符限制。
- 三平台 Java 公共错误包络回写调用方 `requestId`；Desktop Adapter 接受错误响应中可空的 `evidenceId`，因此 `APPROVAL_REQUIRED` 等领域错误不再被误分类为 `UPSTREAM_UNAVAILABLE`。
- 审批客户端使用有界超时和脱敏异常分类日志，失败信息不记录 Token、完整请求正文或平台凭据。
- 本地 Audit Receipt 在 MCP 边界投影为 canonical 回执，保留审批摘要、目标资源、证据和职责信息。
- Trace Resource 使用 `openxnet://workspaces/{workspaceId}/incidents/{incidentId}/traces/{traceId}`；旧扁平 Trace URI 被拒绝。
- Live Adapter 校验上游 Workspace、Incident、Trace、toolName、契约版本、时间、耗时和来源，防止上下文混淆。
- AIOps 三个服务、DataOps 两个服务和 MLOps 一个服务已完成 JAR 备份、SHA-256 校验、原子替换与启动验证；部署后的 Builtin 三场景和 AgentTeams 跨域漂移重新通过。

## 已验证

- Desktop Core 主测试 `248/248`、扩展测试 `70/70` 通过。
- Renderer 启动与比赛界面契约 `51/51` 通过；Competition 定向测试 `16/16` 通过。
- Python AgentTeams 单元与真实进程握手通过。
- AgentTeams Win32 x64 Feature Pack 构建与打包入口握手通过。
- 冷启动进程 `1617 ms`，工作区 `1375 ms`；自动断言确认基础启动未激活 Legacy Backend 或 AgentTeams Worker。
- Competition、AgentTeams、MCP、Tool Adapter、Enterprise Skill Binding 和 IPC 定向测试 `24/24` 通过；知识投影测试 `4/4` 通过。
- 三个 GOAI 核心 Skill 的 Markdown、输入输出 Schema、示例和验证器通过；三种处置工具与六种验证工具白名单一致。
- Electron Enterprise smoke 已验证真实 preload/IPC 下的企业 Skill 启用、读取和 Workspace 删除清理，且未激活 Legacy Backend。
- Electron Enterprise smoke 已验证项目楼层创建/删除、角色指派联动、企业消息、`@员工` 与 Trace 查询；Renderer 不能提交作者身份。
- 真实 HTTPS Live + AgentTeams smoke 已完成三场景 Worker 取证计划、Leader 审批结论、人工审批、受控处置和 Verifier 关闭结论；三条事件均为 `RESOLVED`、Action 为 `SUCCEEDED`，并发布三个企业 Skill。
- Builtin 与 AgentTeams 均已验证独立验证失败链路：客观失败保留 `VERIFICATION_FAILED`，AgentTeams Verifier 返回 `ROLLBACK_REQUIRED`，两步补偿成功，Incident/Trace/Action 均为 `FAILED`，失败事件不得结晶为 Skill。
- AgentTeams 只向模型投影固定白名单验证信号；缺少必需工具、显式失败、错误率/延迟越界或副本未就绪时，Adapter 拒绝 `CLOSE`，OpenXnet 客观验证器仍保留最终否决权。
- Electron UI smoke 已覆盖 `1440×960` 与 `1024×720`、light/dark、项目楼层、3D 员工、企业群聊和 `NSX/RK/EV` 操作卡；事件指挥无内部双滚动和文本溢出。
- 知识投影已验证 Plan、PlanStep、ExecutionStep、审批 Scope 与补偿状态；真实比赛用户数据包含 8 个神经符号、目标 Incident 可检索 7 个符号、368 条有效比赛图谱关系和 20 条 Incident 事实。
- AgentTeams Worker 安全派生镜像已通过真实 feature-drift Live；现存 6 个 Worker 全部使用安全镜像，最近 1500 行日志的凭据形态计数为 0。
- 服务器恢复基线为 MLOps `18/18/42`、K3s `3/3`、Compose `33/33`，AgentTeams Adapter 健康。

## 外部依赖

- Live 模式使用三个平台按 `D:\synapxnet\开发文档\contracts` 实现的公共 Tool Adapter，比赛服务器 HTTPS 全链路已验证。
- 桌面通用 AgentTeams Feature Pack 仍可独立使用 `agt` CLI，但 Competition 不复用该登录态。Competition AgentTeams 模式必须连接隔离服务；未连接或任务失败时停止本轮流程，不自动执行 Builtin 取证。
- 公网 MCP 部署必须在授权服务或反向代理层启用 OAuth 2.1、RFC 9728 和 Workspace RBAC；桌面回环 Bearer 只用于单机 Profile。
