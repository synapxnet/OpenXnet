# Phase 3BM Optional Transitive Dependency Boundary

## 状态

2026-07-30 完成。本阶段不删除 Execution Engine 真实使用的 A2A、E2B 和 DDG 根能力，而是
移除这些根依赖通过 `all` extra、可选 Provider 或抓取后端带入基础 Analysis 的未使用闭包。

## 所有权判断

基础运行时继续保留：

- `python_a2a` 核心协议与 Card/Agent 调用；
- `e2b` 与 `e2b_code_interpreter` 代码执行；
- `ddgs` 及其实际需要的 `primp`、`lxml`；
- Execution Engine 现有 Provider、HTTP 与工具注册能力。

基础冻结包排除：

- A2A 的 Bedrock、LangChain 与 MCP 可选适配器；
- E2B 的 MCP 可选分支；
- AWS SDK 的 `boto3`、`botocore`、`s3transfer`；
- Selenium、Trio WebSocket 与旧 WebSocket 闭包；
- Hugging Face Hub、HF Xet、Safetensors；
- Google Cloud Model Armor/Text-to-Speech 与 gRPC；
- 已由独立 Pack 拥有的模型、文档、Connector、Voice、Memory 与 Vector 依赖。

这里采用“保留可证明的根能力，拒绝未调用的 extra”原则。排除项必须同时满足：基础源码无直接
调用、对应功能已有独立所有者或从未成为产品契约、冻结 smoke 可证明必要路径仍可运行。

## 回归护栏

`tests/test_base_package_boundary.py` 固定检查禁止项出现在 `server.spec`，并反向检查
`e2b`、`e2b_code_interpreter`、`python_a2a`、`lxml` 和 `primp` 没有被误排除。新依赖若需要
`all` extra，必须先列出实际消费的子模块，并为保留分支增加运行测试。

本阶段完成后，冻结 PYZ 保留 A2A、E2B、DDG、`primp/lxml`，AWS、Selenium、HF、Safetensors
与 gRPC 禁止项均为零命中。联合体积结果记录在 Phase 3BN，避免重复计算连续构建的收益。

## 后续边界

开发环境的锁文件仍可能解析这些可选包，不能把“冻结包未收集”误写成“依赖声明已清理”。
Phase 4 收口审计需要按 base、Server compatibility 和各 Feature Pack 重新整理声明与许可证清单。
