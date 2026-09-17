<!--
#!/usr/bin/env markdown
# -*- coding: utf-8 -*-
# Copyright (C) 2026 Synapxnet. All rights reserved.
# SPDX-License-Identifier: AGPL-3.0-only
# Adapter 备份、增量更新与回滚 / Adapter backup, incremental update and rollback
# Author: maoyo (maintenance) | Department: 研发部 | Date: 2026-09-17
# Version: 1.3.0-contract.3 | Security Level: INTERNAL
# __maintainer__: maoyo | __email__: synapxnet@gmail.com
# Existing LICENSE and THIRD_PARTY_NOTICES.md remain unchanged.
-->

# Adapter 发布材料与 contract.3 访问码接入

## 当前发布：1.3.0-contract.3（2026-09-17）

下方 `.1`、`.2` 均为历史记录。当前线上实际镜像为 `synapxnet/openxnet-agentteams-adapter:1.3.0-contract.3`，Image ID `sha256:d89a3262a14bd37b1d916bee78dbdf20d97112cd84616d41673fd5fd6bd46d6e`。服务器源码在 `/opt/synapxnet/releases/openxnet-agentteams-adapter/1.3.0-contract.3`；源码归档 SHA-256 `26bbdb079e9a9251cee21456d2583372083d4a19373cd9fd964d528b83600ce4`，25 个明确白名单文件。服务器隔离合同测试 18 项通过。

实际部署仍使用 `/opt/synapxnet/compose.yml`、`compose.override.yml`、`compose.worker-lease.yml` 三层基础配置，第四层必须使用 `.3/compose.adapter.contract.yml`。只重建 Adapter，不拉取镜像、不安装依赖、不清理共享卷。当前 Leader/Worker 显式模型环境均为 `qwen3.8-max`，覆盖源码回退默认；其他环境、入口、用户、网络、挂载、端口和健康检查逐项保持。此名称为用户最终确认的 API ID，已用当前账号验证，不能替换成不存在的 `qwen3.8-plus`。

备份 `/opt/synapxnet/backups/agentteams-adapter-contract3-20260917T040540Z` 包含旧 `.2` 镜像、四层 Compose、环境文件、两个运行卷及变更前 Caddyfile。三个卷/镜像归档均验证非空、可读和 SHA-256，完整敏感备份仅保留服务器 root 专属目录。模型核心另有备份 `/opt/synapxnet/backups/qwen38max-contract3-20260917T035833Z`，包含容器配置、当前资源数据库快照、Manager 配置、驻场加密配置及密钥。

访问码持久账本为 `/data/demo-access-grants.json`，权限 0600，只保存原码摘要；签发返回的原码只能交付到受限渠道，不写入镜像、日志或普通安装包。公开健康已返回 `.3`、`residentContexts=true`、`demoAccessCodes=true`，原会话配置保持完整。当前单进程文件账本不支持多副本共享写入。

### 公网路由与实际验收

首次真实公网 check 返回 404；内部接口为 200。原因是 Caddy 原精确路径白名单没有新接口。已备份并校验 `/opt/synapxnet/Caddyfile`，仅向 `@agentteams_public` 增加 `/agentteams-adapter/api/v1/access/check` 和 `/agentteams-adapter/api/v1/access/connect`。本环境 `admin off`，普通 reload 调用 2019 管理端口失败；按 Caddy v2.11.4 官方信号机制发送 SIGUSR1 热加载，PID 与 StartedAt 均未变化。签发、撤销及 session 运维接口仍外网 404，不开放通配符。

临时访问码已完成真实公网检查：匿名拒绝；check 不绑定、不扣额度；connect 首次绑定且不扣额度；跨工作空间拒绝；存储不含原码且权限 0600；撤销后拒绝。全部临时码均已撤销。人工验收另签一枚仅 Fixture、7 天、40 次、首次保存绑定工作空间的独立码；原码仅在授权用户本机 ACL 限制文件中，发布工件仅保留 grantId、期限和范围。

### 模型配置对应关系

- `/opt/synapxnet/.env` 和 `compose.yml`：Adapter Leader/Worker 显式值与回退默认。
- `/opt/synapxnet/runtime/agentteams/agentteams-manager.env`：持久启动默认。Controller 和 Manager 当前 `AGENTTEAMS_DEFAULT_MODEL=qwen3.8-max`。
- Manager 官方资源 `default` 的 `spec.model`、工作目录 `.copaw/providers.json` 的 `active_llm.model`、分拆 providers 配置及 openclaw 配置同步。官方更新触发 Manager 自动协调；Controller 环境不可变，已在无活动租约窗口保留原容器后按原配置重建，仅变更模型环境。原 Controller 停留在 `agentteams-controller-before-qwen38max-20260917`，自动重启关闭，供恢复使用。
- 18 个现有 Worker 均通过 `agt update worker --model qwen3.8-max` 更新当前资源，并同步停止容器的当前 providers 文件；保持 Sleeping，未自动启动任务。
- AIOps/DataOps/MLOps 通过正式鉴权的 `/api/resident/v1/model` 更新模型；各自 URL/API Key 保留，内存及加密文件即时回读。加密文件位于 `/opt/synapxnet/releases/finals-v1.3.0-20260915-resident1/runtime/{platform}/model.enc.json`。

最终核对 19 个当前资源声明、18 个 Worker 配置及核心环境；Controller、Manager、18 个 Worker、3 个驻场共 23 条实际凭据路径均以无工具、最多 8 token 请求返回 HTTP 200 和 `qwen3.8-max`。这验证当前模型与凭据可用，不代表已重跑完整业务 Run。历史会话、token_usage、旧发布回执和备份不改写。

### 当前回滚边界

Adapter 失败时只把第四层改回 `.2/compose.adapter.contract.yml`，以 `--no-deps --no-build --pull never` 重建该服务；不删除卷、不恢复旧访问码额度或撤销状态。`.2` 不提供访问码能力，必须如实提示不可用。模型切换使用上述独立备份和当前资源声明恢复，不能直接恢复整个 Kine/共享卷覆盖新审计。完整脱敏证据在 `artifacts/access-release-20260917`，包括首次路由失败和最终通过记录。

## 1.3.0-contract.2 更新窗口（2026-09-16）

下文 `.1` 记录属于已完成发布历史，不能作为 `.2` 回滚命令直接照抄。本次仅更换阶段提示与包版本，隔离 11 项通过，源码路径不变，Dockerfile 仍使用已核对的本地 `1.1.1-workerlease.6` 基底。

`.2` 新目录为 `/opt/synapxnet/releases/openxnet-agentteams-adapter/1.3.0-contract.2`，新镜像同名标签。当前已运行镜像是 `1.3.0-contract.1`，Image ID 为 `sha256:b952e26598f59e97c623c2d96946cbea2a77a8979d748cd4b58dc7f01ea6a599`。备份必须包含此 `.1` 镜像、旧四层 Compose（包括 `.1/compose.adapter.contract.yml`）、环境文件和两个卷；不能只备份最初三层。

旧真实 AgentTeams Run 已于 `2026-09-16T04:33:26.424Z` 收敛为 RESOLVED，独立回执 CLOSE。`04:38:02Z` 只读检查 ACTIVE/GRACE 租约与在途 Adapter 请求均为 0。主验收已协调不再创建新任务；实际切换前再次核对。

备份完成前不得替换容器。停止前设置失败恢复标记，采用 15 秒容器宽限及至少 35 秒命令预算。启动 `.2` 时把第四层换为 `.2/compose.adapter.contract.yml`，原环境、挂载、网络、用户和启动配置保持一致。失败恢复使用 `.1` 的第四层重建，禁止移除所有第四层而误退到 `workerlease.6`。部署之后核对公开版本 `.2`、内部会话已配置布尔值、安全启动器预检和新独立只读规划输出；旧 `.1` 运行历史不改写。

### contract.2 实际交付回执

- 服务器隔离测试 11 项通过；源归档 SHA-256 `94c0ebdb07bbb64103af01fc3f72e85f2cd7e3ef0f926ea5afdb985e5ca825ae`，共 24 个文件。原归档与逐文件摘要保留在 `.2` 发布目录。
- 新镜像 ID `sha256:98ffc39675c31b3095b4d3e2800bbd66197eb40e9fc71307f2e2c1c7efafa6a2`，在 `2026-09-16T04:47:56.194218Z` 切换完成。
- 有效备份 `/opt/synapxnet/backups/agentteams-adapter-contract2-20260916T044732Z`：旧镜像、四层 Compose、环境文件、两个卷，归档非空、可读并已计算摘要；保持服务器专属权限。
- 首次切换的校验按 Docker Env 数组顺序比较，触发自动恢复 `.1`，原回执保存在 `deployment-attempt1.json`。改为按环境变量名/值映射比较后通过；不是放宽变量内容检查。随后再次完整备份并切换，环境内容、入口、命令、用户、工作目录、健康检查、重启策略、端口、挂载和网络均保持一致。
- 公网健康接口 HTTP 200，`version=1.3.0-contract.2`、`residentContexts=true`；两个独立会话配置布尔值均为 true；桌面安全启动器 `--validate-only` 通过且未启动 GUI。
- 更新只涉及 Adapter；现有 AgentTeams 业务运行、用户快照及模型原始输出未改写。新独立规划探测的结论另见验收工件，不能用健康检查代替模型输出验收。

本文保留发布前审阅的执行方案，并在末尾记录 2026-09-16 的实际备份和更新结果。最初仅依据线上只读检查制定方案；主验收审阅后执行受控更新，实际业务新 Run 仍由桌面验收确认。

## 已核对的当前部署

| 项目 | 只读核对结果 |
| --- | --- |
| 主机 | `150.109.52.248`，仅经既有 `synapxnet-157` 固定 SSH 链管理 |
| 容器 | `synapxnet-openxnet-agentteams-adapter-1`，检查时运行中 |
| 当前镜像 | `synapxnet/openxnet-agentteams-adapter:1.1.1-workerlease.6` |
| 独立读取的 Image ID | `sha256:463f3f04dec51cd206f03b8274ed24e81a386eb933df2944d378af6819b63b4a` |
| 独立读取的 RepoDigests | `["synapxnet/openxnet-agentteams-adapter@sha256:463f3f04dec51cd206f03b8274ed24e81a386eb933df2944d378af6819b63b4a"]` |
| Compose 项目/服务 | `synapxnet` / `openxnet-agentteams-adapter` |
| Profile | `agentteams`，默认 profile 渲染结果不包含此服务 |
| 工作目录/用户 | `/app` / `node` |
| 网络 | `agentteams-net`、`synapxnet_edge` |
| 挂载 | `synapxnet_agentteams-data:/data`；`/home/ubuntu/.openxnet-worker-activity:/worker-activity` |
| 端口/重启策略 | 无宿主发布端口；`unless-stopped` |
| 原 Compose 文件 | `/opt/synapxnet/compose.yml`、`compose.override.yml`、`compose.worker-lease.yml` |
| override 链接目标 | `/opt/synapxnet/compose.competition.yml` |
| 配置文件 | `/opt/synapxnet/.env` 存在；本检查未输出其中内容 |

核对使用 `E:\SynapXnet\V1.3.0-线上发布\inspect-runtime.py` 的 `remote`，仅返回上述允许公开的结构。没有读取会话正文或输出环境、凭据、Session。容器详情和 Compose 完整渲染含敏感字段，禁止原样粘贴、打印或写入普通构建日志。

## 交付来源与镜像内容

当前维护来源是本目录，最初从上述运行镜像复制 `/app/src`、`package.json`、`LICENSE` 和第三方声明。旧比赛提交归档不变。新测试位于 `test/`；复制文件添加的元信息不改变 `AGPL-3.0-only` 许可，`LICENSE` 和 `THIRD_PARTY_NOTICES.md` 不改写。

Dockerfile 使用已部署的本地基底标签，构建前必须核对标签指向的 Image ID，仅复制维护后的 `src/` 和 `package.json`。Image ID 与 RepoDigest 是不同概念；上表是在本机对两个字段分别读取的实际结果，相同文本不代表两者通常等价，也不证明远端仓库可拉取。此方案不依赖远端私有仓库摘要可用性。不运行 npm 安装、不更换官方 `agt`、不覆盖基底的启动入口、健康检查、依赖与许可证。`.dockerignore` 只允许这两个应用输入，测试、文档、环境文件和任何运行数据不会进入新层。测试在构建之前从完整源码交付执行。

以下命令供主验收在已授权发布窗口执行。服务器示例均在既有 SSH 通道内以 root 执行，禁止打开 `set -x`。路径以本次固定发布目录为例：

```sh
release_dir=/opt/synapxnet/releases/openxnet-agentteams-adapter/1.3.0-contract.1
release_image=synapxnet/openxnet-agentteams-adapter:1.3.0-contract.1
previous_image=synapxnet/openxnet-agentteams-adapter:1.1.1-workerlease.6
previous_image_id=sha256:463f3f04dec51cd206f03b8274ed24e81a386eb933df2944d378af6819b63b4a
```

## 先测试和构建，不触碰运行服务

1. 在本地维护目录执行 `node --test --test-concurrency=1 test/*.test.js`，保存通过数量和源码摘要；父工程同时验收三阶段上下文及独立验证 `ctx-3`。不得把隔离合同测试称为线上新 Run。
2. 把本目录源码交付到全新 `release_dir`，保持 `src/`、`test/`、包元数据、许可证、构建文件和本文，核对逐文件 SHA-256；不上传 `.env`、Session 或运行卷。不覆盖原服务来源。
3. 在服务器确认当前镜像 ID 仍为 `previous_image_id`；若变化则重新核对基底，不能继续使用本次冻结计划。
4. 构建不使用线上凭据、不挂载运行卷、不下载依赖：

```sh
cd "$release_dir"
test "$(docker image inspect --format '{{.Id}}' "$previous_image")" = "$previous_image_id"
docker build --pull=false --network=none \
  --file Dockerfile --tag "$release_image" .
docker image inspect --format '{{.Id}}' "$release_image"
```

`--network=none` 只限制 RUN 阶段，不能称为禁止 FROM 网络访问；`--pull=false` 配合已验证本地标签使用。基底不存在或 ID 不符时停止，不自动拉取另一来源。发布前记录新镜像 ID，确认用户仍为 node、启动入口与健康检查继承原镜像；只在内存比较这些字段，不输出完整镜像配置。镜像构建只做语法检查，不能代替完整测试。

## 配置预检和安全备份

启用 `agentteams` profile。读取四层 Compose 渲染结果时在内存中比较 Adapter 镜像、挂载、网络、依赖及环境是否只发生预期变化；输出“相同/不相同”以及镜像 ID，不输出环境值。原服务有 `build` 配置，因此更新时必须加 `--no-build`。

在入口暂停创建新 AgentTeams 任务，确认既有任务终止、队列清空、没有 `ACTIVE` 或 `GRACE` Worker 租约；未达成时等待，不能强行跳过。以固定共同锁检查租约状态，仅输出计数，不读取或输出对话正文。成功后仅停止 Adapter：

```sh
docker compose --project-directory /opt/synapxnet --env-file /opt/synapxnet/.env \
  -p synapxnet --profile agentteams \
  -f /opt/synapxnet/compose.yml \
  -f /opt/synapxnet/compose.override.yml \
  -f /opt/synapxnet/compose.worker-lease.yml \
  stop --timeout 15 openxnet-agentteams-adapter
```

为数据一致性保留该短维护窗口。配置和卷备份包含敏感数据，须只存服务器 root 专属目录，不上传普通工件目录或把内容打印到终端：

```sh
umask 077
release_stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_dir="/opt/synapxnet/backups/agentteams-adapter-contract-$release_stamp"
install -d -m 0700 "$backup_dir" "$backup_dir/compose"
cp -a /opt/synapxnet/compose.yml /opt/synapxnet/compose.override.yml \
  /opt/synapxnet/compose.competition.yml /opt/synapxnet/compose.worker-lease.yml \
  "$backup_dir/compose/"
cp -a /opt/synapxnet/.env "$backup_dir/runtime.env"
chmod 0600 "$backup_dir/runtime.env"
docker image save --output "$backup_dir/adapter-image.tar" "$previous_image"
tar --acls --xattrs -C /var/lib/docker/volumes/synapxnet_agentteams-data/_data \
  -cpf "$backup_dir/agentteams-data.tar" .
flock -w 15 -x /home/ubuntu/.openxnet-worker-activity/worker-activity.lock \
  tar --acls --xattrs -C /home/ubuntu \
  -cpf "$backup_dir/worker-activity.tar" .openxnet-worker-activity
sha256sum "$backup_dir/adapter-image.tar" "$backup_dir/agentteams-data.tar" \
  "$backup_dir/worker-activity.tar" > "$backup_dir/backup.sha256"
```

备份失败时停止更新并用原三层配置重新启动 Adapter；不要在没有可用备份的情况下继续。复核备份非空、校验摘要和归档可读，只输出结果，保持权限为 root 专属。共同锁不能无限等待；执行端需设置维护窗口超时，未拿到锁时退出并恢复原服务。停止命令的进程预算必须大于容器宽限时间（实际采用 15 秒容器宽限、35 秒命令预算），并在发出停止命令之前启用失败恢复保护。

## 只重建 Adapter

`compose.adapter.contract.yml` 为第四层，仅覆盖新镜像且禁止拉取。原三层文件、符号链接、环境、两个挂载和网络保持原值：

```sh
docker compose --project-directory /opt/synapxnet --env-file /opt/synapxnet/.env \
  -p synapxnet --profile agentteams \
  -f /opt/synapxnet/compose.yml \
  -f /opt/synapxnet/compose.override.yml \
  -f /opt/synapxnet/compose.worker-lease.yml \
  -f "$release_dir/compose.adapter.contract.yml" \
  up -d --no-deps --no-build --pull never --force-recreate openxnet-agentteams-adapter
```

固定在 60 秒内检查容器状态、镜像 ID、相同挂载与网络；公网 `/agentteams-adapter/health` 应为 `status=ok`、`version=1.3.0-contract.1`、`capabilities.residentContexts=true`。随后运行桌面 `--validate-only`，确认实际 parser 允许新版字段。只核对独立会话“已配置”布尔状态，不输出会话内容或重新写入凭据。

先从真实桌面触发一次新的 AgentTeams+Fixture 取证，确认可观察的 Leader/Worker/Verifier、依据和身份化回执；再继续审批、执行、独立验证及补偿验收。健康通过只能证明进程和契约就绪，不能声称模型任务已成功。该任务由主验收开展，本文不自动发送。

发布后把第四层文件纳入实际运维启动命令并记录完整 Compose 文件列表；后续仅使用旧三层启动会恢复旧镜像，不能遗漏版本层。

## 回滚

协议、会话或实际任务验收失败时暂停新任务并保留错误回执。待任务收敛后只回退镜像，移除第四层覆盖，禁止 `down -v`、清理共享卷或重建其他服务：

```sh
test "$(docker image inspect --format '{{.Id}}' "$previous_image")" = "$previous_image_id"
docker compose --project-directory /opt/synapxnet --env-file /opt/synapxnet/.env \
  -p synapxnet --profile agentteams \
  -f /opt/synapxnet/compose.yml \
  -f /opt/synapxnet/compose.override.yml \
  -f /opt/synapxnet/compose.worker-lease.yml \
  up -d --no-deps --no-build --pull never --force-recreate openxnet-agentteams-adapter
```

若旧镜像被误删，先从 `backup_dir/adapter-image.tar` 执行 `docker image load --input ...`，再核对原摘要和标签。普通回滚不还原卷内容，因此保留本次运行记录与 Session。卷备份仅用于确认数据损坏后的独立恢复，必须同时协调所有共享目录读写方，不能把历史 Worker 租约直接覆盖到仍运行的 Controller/Manager 上。

旧镜像恢复后，记录旧健康可达以及镜像 ID 已匹配。桌面新版启动器会再次报告旧驻场协议不兼容，这是如实阻断；禁止绕过预检、删除驻场字段或把回滚后的旧协议称为新版本验收通过。

## 交付验收记录

2026-09-16，主验收代码审阅通过并按用户既有备份部署授权完成以下步骤：

- 本地服务 7 项测试、11 源文件语法检查通过；Desktop 相关 52 项回归通过，包含实际 HTTP 序列化与服务解析器三阶段 ctx-1 / ctx-2 / ctx-3 联验。均为隔离测试。
- 服务器构建新镜像并再次运行同样 7 项隔离测试；User、Entrypoint、Cmd、Healthcheck、WorkingDir、Env 与旧基底一致。
- 切换前 ACTIVE / GRACE 租约 0，在途 HTTP 连接 0。四层 Compose 只有镜像及 pull_policy 变化，环境与实际旧容器一致。
- 首次停止命令与容器宽限同时设置为 30 秒，执行器先超时。立即核对旧容器已停并重新启动原容器；此轮未切换新镜像，也未宣称完成备份。改为 15 秒容器宽限、35 秒命令预算且提前启用恢复保护后重试。
- 安全备份目录：`/opt/synapxnet/backups/agentteams-adapter-contract-20260916T035633Z`。包含原 Compose 与符号链接目标、私有环境文件、原容器元数据、旧镜像、AgentTeams data 卷及共享租约目录。三个归档已通过可读性及 SHA-256 检查，备份保留在服务器 root 专属目录。
- 旧镜像 ID：`sha256:463f3f04dec51cd206f03b8274ed24e81a386eb933df2944d378af6819b63b4a`。
- 新镜像 ID：`sha256:b952e26598f59e97c623c2d96946cbea2a77a8979d748cd4b58dc7f01ea6a599`。
- 仅重建 Adapter，实际环境、两个挂载和两个网络核对保持一致。新容器健康；公开健康接口 HTTP 200，版本 `1.3.0-contract.1`，`residentContexts=true`。内部只核对独立 Session 与协作 Session 已配置的布尔值，均通过。
- 源码安全启动器 `--target source --runtime agentteams --validate-only` 通过，南向仍是 Fixture；该步骤未启动桌面、未发任务。实际桌面新 Run 由主验收继续，不能以部署健康代替 AgentTeams 业务结果。

服务器的脱敏部署回执保存在发布目录 `deployment-result.json`。后续启动或维护仍须包含第四层 `compose.adapter.contract.yml`，不能遗漏版本覆盖层。
