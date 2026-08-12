# Phase 3BA Enterprise Runtime

## 状态

2026-07-29 完成。Desktop 的企业角色卡、企业知识库元数据与版本摘要、企业工作区元数据、沙盘投影和
Xnet 服务配置不再依赖 Python 路由。Renderer 通过 typed preload API 进入 Main-owned TypeScript Runtime；
Browser/Server 继续保留 `/v1/enterprise/*` compatibility routes。

本阶段不包含 Usage、Neuro/Knowledge Graph、Docker/SSH 生命周期或可写沙盘命令。这些能力具有不同的
数据所有权和执行风险，后续分别迁移，避免企业元数据 CRUD 重新依赖重型执行 Runtime。

## 调用链

```text
Desktop 企业页面 / Ops Vite
  -> 完整 Enterprise host helper
  -> typed preload API
  -> 15 个 sender-authorized IPC 通道
  -> Main-owned Enterprise Runtime
  -> userData 兼容 JSON 文件

Desktop Xnet 健康检查
  -> fixed serviceKey
  -> Main 已保存并重新校验的 URL
  -> 5 秒 GET + manual redirect

Browser / Server
  -> /v1/enterprise/* compatibility routes
```

Desktop 桥必须同时具备全部 15 个方法。缺失任一方法时直接报告 Runtime 不可用，主 Renderer 和 Ops Vite
均不得降级到 Python HTTP。Renderer 的健康检查请求只能携带 `dataops`、`mlops` 或 `aiops` 固定键，
不能提交临时 URL、请求方法、请求头、凭据或重定向策略。

## 数据所有权

- `enterprise_role_cards.json`：角色卡主记录，创建和更新使用显式 `mode`，避免带 ID 的创建被误判为更新；
- `enterprise_knowledge_bases.json`：知识库目录元数据，版本摘要从固定 ID 子目录读取；
- `workspaces.json`：环境元数据，不启动、停止或删除 Docker/SSH/Cloud 外部资源；
- `sandbox_state.json`：角色卡的可重建派生投影，保留兼容位置、状态和场景；
- `xnet_services.json`：固定三项 Xnet URL、自动连接标志和最近健康状态。

所有读取都有 16 MiB 文件预算、2,000 条记录预算和严格 UTF-8 解码。未知存量字段在兼容读取时忽略，
Renderer 新写入使用 exact record 校验。JSON 写入采用同目录临时文件和 rename，编码为 UTF-8/LF。
旧工作区缺失的 `container_id` 以及其他四类嵌套默认字段在读取时补齐。

## 部分提交语义

角色卡文件是主记录，沙盘是可从角色卡重建的派生状态。角色卡主文件成功写入后，沙盘投影写入失败
只记录 warning，并在下一次读取沙盘时重新计算；调用方不会收到“保存失败但数据已经存在”的歧义。
角色卡主文件写入失败仍然拒绝整个操作。知识库、工作区和 Xnet 文件没有跨文件派生提交语义。

## 网络边界

Xnet URL 只允许 HTTPS，或 `localhost`、`127.0.0.1`、`::1` 的回环 HTTP。URL 不得包含用户名、密码、
query 或 fragment。健康检查固定使用 GET、`redirect: manual`、5 秒 AbortSignal；3xx 不判定为在线，
响应体不会进入 Renderer。

本 Runtime 不读取 Provider、MCP 或其他凭据，也不向 Xnet 请求附加认证头。需要认证的企业服务必须在
后续独立凭据与 Broker 边界中设计，不能把密钥放回 URL 或 Renderer 状态。

## 验证

- Enterprise Runtime 与 IPC 专项：4/4；
- Renderer 启动架构总套件：35/35；
- Desktop Core 主套件：238/238，扩展阶段 post-test：16/16；
- TypeScript 编译和修改文件 JavaScript 语法检查：通过；
- 真实 Electron smoke：角色卡创建/更新、知识库及脱敏版本、旧工作区补全、沙盘投影、Xnet 回环健康通过；
- Electron smoke 中 Xnet 健康请求 1 次，legacy backend 激活次数为 0。

全量 `npm test` 通过，耗时 `162,300 ms`。最终冷启动 process `1,695 ms`、workspace `1,351 ms`、
观察窗口 `2,500 ms`；`legacy-backend` 和全部可选 capability 保持 stopped。UTF-8、Python docstring、
TypeScript 函数说明、Renderer 构建一致性和 JavaScript 语法检查均通过。

## 后续边界

Usage、Neuro/Knowledge Graph 已在 Phase 3BB 迁移；后续继续审计 Kernel 及剩余 Desktop HTTP/WebSocket。
Python 企业路由继续服务 Browser/Server compatibility profile，不从源码删除。Docker start/stop 和沙盘写命令只有在 Desktop UI
形成明确需求并建立独立执行授权、超时、日志与资源回收边界后才迁移。
