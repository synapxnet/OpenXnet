# Phase 3BP Direct A2A Package Boundary

## 状态

2026-07-30 完成。Desktop 和 Execution Engine 的 A2A 发现与任务发送不再依赖
`python-a2a`。`py/a2a_client.py` 通过有界 HTTP 协议直接实现 Agent Card 探测和
`message/send`，`py/a2a_tool.py` 与 Server `/a2a` 兼容入口统一复用该客户端。

## 协议与安全边界

- 远端端点必须使用 HTTPS，HTTP 只允许回环地址；
- 拒绝 URL 凭据、查询参数、片段和超过 2,048 字符的端点；
- 请求超时固定为 10 秒，响应正文上限为 1 MiB，禁止自动跟随重定向；
- Agent Card 只投影名称、描述、版本与有界技能字段，不复制认证或扩展私有字段；
- 优先发送现代 `message/send`，仅在明确的不支持状态下执行一次受控 legacy 回退；
- 错误只保留固定类别和安全 HTTP 状态码，不返回上游正文、凭据或内部路径。

## 依赖与物理边界

基础依赖声明和锁文件不再包含 `python-a2a`。冻结 Analysis 同时排除它带入的 Anthropic、
Flask/Werkzeug、Google Auth/OAuth2、PyASN1、Cryptography、AWS、LangChain 与 MCP 可选闭包。
E2B 代码解释器和 DDG 搜索仍是基础执行能力，不因 A2A 拆分而删除。

首次完成该边界时，冻结目录从 Phase 3BO 的 132,837,245 字节降至 118,429,393 字节，
文件数从 865 降至 829；减少 14,407,852 字节（13.74 MiB），相对原始基线累计减少
74.89%。最终联合体积由 Phase 3BR 记录。

## 验证

- Direct A2A 专项：5/5；
- Base Package Boundary：通过；
- HTTPS/回环策略、Card 投影、现代发送、legacy 回退、超限和错误脱敏均有回归覆盖；
- 冻结 Execution Engine 认证与路由 smoke：通过，阶段构建启动 5,718 ms；
- PYZ 与物理目录的 `python_a2a`、Anthropic、Flask/Werkzeug、Google Auth、PyASN1 和
  Cryptography 命中数均为 0。
