# Phase 3AS Desktop 知识库运行时

## 状态

2026-07-29 完成。Desktop 创建知识库时，本机文件通过 Application Core Artifact 导入；
构建、状态、删除和查询通过授权 typed IPC 进入 Main，并使用请求租约访问私有
Execution Engine。Desktop 不再为这些知识库操作调用 `/load_file`、`/create_kb`、
`/kb_status`、`/remove_kb` 或 `/query_kb`，Browser/Server 继续保留这些兼容路由。

## 调用链

```text
Desktop Renderer
  -> Application Core Artifact import
  -> userData/uploaded_files/<storageName>

Desktop Renderer
  -> typed Knowledge Base Runtime IPC
  -> authorized Electron Main handler
  -> request-leased Execution Engine
  -> private /v1/desktop/knowledge-base/* route
  -> Document / Vector Worker compatible knowledge-base implementation
```

Renderer 只能提交稳定 `knowledgeBaseId`、有界查询文本和结果数量。Execution Engine 的
origin、Bearer token、知识库根目录和本机 Artifact 路径不会进入 Renderer。

## Artifact 与文件边界

Desktop 文件选择复用 Core `importArtifacts`，由 Main 复制、哈希并登记 Artifact。知识库
设置只保留现有兼容格式的 `/uploaded_files/<storageName>` 内部引用。Python 文档加载器识别
该内部 URL 后直接解析受控目录中的普通文件，不再通过 HTTP 回连 Local UI Gateway 或
legacy backend。

内部文件解析执行以下约束：

- 每个 URL 只允许一个 `uploaded_files` 或 `tool_temp` 文件名片段；
- 解析结果必须位于对应受控根目录；
- 拒绝目录、符号链接、不存在文件和路径穿越；
- Browser/Server 外部 URL 仍执行独立 SSRF、重定向和响应预算检查。

## 私有运行时边界

Execution Engine profile 新增四条精确私有路由：

- `/v1/desktop/knowledge-base/build`；
- `/v1/desktop/knowledge-base/status`；
- `/v1/desktop/knowledge-base/remove`；
- `/v1/desktop/knowledge-base/query`。

全部路由要求 Execution Engine Bearer，并拒绝额外字段。Main 在请求前完成同构字段校验，
只有合法请求才会激活引擎和获取租约；请求完成或失败后始终释放租约。构建、查询和删除按
`knowledgeBaseId` 使用独立操作锁，同一知识库的写入和检索串行，不同知识库可以并行。
状态读取不会加载模型或启动 Worker。

## 查询结果与失败语义

查询文本最多 8,192 字符，结果数量为 1 到 20。Python Runtime 将内容、摘要、文件名和
标量元数据规范为固定 schema，并对单条内容、元数据字段数、字符串长度及总 JSON 字节数
设定预算。路径、source 和 directory 类字段只保留文件名；Main 再次校验精确响应字段，
拒绝路径型元数据、复杂对象、超长文本和 schema 漂移。

内部异常只记录异常类型。删除和查询失败向 Main 返回固定 503；Main 向 Renderer 返回固定
Runtime 错误，不传播 Provider、文件系统或 Worker 诊断。构建失败返回 `failed` 状态，便于
Renderer 持久化可恢复状态。

## Renderer 与兼容边界

Desktop 创建、重建、状态同步、删除和自定义知识库查询均优先检查 typed Runtime。删除只有
在 Runtime 确认成功后才修改 Renderer 设置。Browser/Server 在 typed API 不存在时继续使用
原有 HTTP 路由，其他页面现存的通用 `/load_file` 用途不属于本阶段迁移范围。

内置 OpenXnet 功能知识库仍在 Renderer 本地检索，不激活 Execution Engine。Desktop 空闲
启动也不会因为知识库功能启动 Execution Engine、Vector Worker、Document Worker 或 legacy
backend。

## 打包与验证

最终 `dist/server/execution-engine.exe` 重新构建后，真实冻结 smoke 结果：

- 启动耗时 `4,219 ms`；
- 未认证 health 为 401；
- 知识库 status 为 200；
- 包含额外 `path` 字段的知识库请求为 422；
- 响应不含 Bearer、Provider 凭据或本机路径；
- 未知路由为 404。

专项与全量回归结果：

- Python 知识库 Runtime/API：6/6；
- Execution Engine profile：4/4；
- 三 profile route-table smoke：通过；
- TypeScript contract、Runtime、IPC：5/5；
- Renderer 启动架构：28/28；
- Desktop Core：218/218；
- UTF-8、LF、Python docstring、TypeScript 函数说明和 Renderer bootstrap：通过；
- 全量架构回归：通过，耗时 `180,963 ms`。

最终 Electron 冷启动稳定复测：process `1,888 ms`、workspace `1,594 ms`、观察窗口
`2,500 ms`。Execution Engine、Voice、Vector、Memory、Document、Connector、Live、MCP 和
legacy backend 均保持 stopped。紧接大型构建的首次样本出现已知偶发抖动
（process `17,307 ms`），按现行验证口径不作为本阶段缺陷，稳定复测通过预算。

## 后续边界

知识库页面运行时迁移完成后，继续盘点仍会激活 `legacy-backend` 的 Desktop 用户路径。
下一域应在内核/Recall、开发工作台、媒体资产、扩展管理、企业控制台和系统窗口控制之间，
按实际路由频率、依赖重量、安全边界和可独立验证性排序。Browser/Server 兼容路由继续按域
保留，直到对应 typed Desktop 路径具备专项测试和真实冻结产物 smoke。
