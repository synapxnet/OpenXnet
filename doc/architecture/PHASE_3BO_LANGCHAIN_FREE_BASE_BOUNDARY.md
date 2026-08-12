# Phase 3BO LangChain-Free Base Boundary

## 状态

2026-07-30 完成。Desktop 基础源码的知识库与搜索路径不再导入 LangChain，冻结
`server/execution-engine` 共享 PYZ 也不再包含 LangChain 或 LangSmith。开发环境依赖声明尚未
完成最终分组，因此本阶段只宣布基础运行时和冻结包边界完成，不宣布 Phase 4 整体完成。

## 知识库替换

`py/know_base.py` 使用本地 `Document` dataclass，并以依赖无关的分隔符优先、固定尺寸和重叠
算法生成文本块。Vector Worker 继续拥有 FAISS，基础运行时只保存安全 JSON metadata、BM25
记录和位置关系。

旧 LangChain FAISS `index.pkl` 通过严格 allow-list 迁移：Unpickler 只接受旧
`InMemoryDocstore` 与 `Document` 两个全局名，并映射到无行为 shim；任何其他可执行全局对象
都会被拒绝。迁移后写入 `index.docs.json`，后续读取不需要导入 LangChain 类。

## 搜索替换与安全边界

- DuckDuckGo 使用 `ddgs`；
- Google、Bing、Brave、Exa、Serper 使用直接 REST；
- 直接响应限制为 4 MiB，顶层必须是 JSON 对象，请求超时为 15 秒；
- 错误日志只记录异常类型，不记录凭据或供应商响应正文；
- Bing 自定义端点只允许 HTTPS，或本地开发所需的 HTTP 回环地址，并拒绝 URL 内嵌凭据。

## 物理打包边界

`server.spec` 排除 `langchain`、`langchain_classic`、`langchain_community`、
`langchain_core`、`langchain_exa`、`langchain_ollama`、`langchain_openai`、
`langchain_text_splitters` 与 `langsmith`。A2A 核心、E2B、DDG、`primp/lxml` 保持存在。

## 体积证据

- 调整前：916 个文件，148,477,286 字节；
- 调整后：865 个文件，132,837,245 字节（126.68 MiB）；
- 本阶段减少：51 个文件，15,640,041 字节（14.92 MiB，10.53%）；
- 相对 471,711,065 字节原始基线累计减少：338,873,820 字节（323.18 MiB，71.84%）；
- PYZ 与物理路径的 LangChain/LangSmith 命中数均为 0。

## 验证

- Google 与直接搜索测试：12/12；
- Knowledge Base Runtime：6/6；
- Vector Worker：21 项通过，2 项按环境条件跳过；
- Base Package Boundary：3/3；
- Python 编译、UTF-8 和函数说明检查：通过；
- 冻结 Execution Engine 完整认证/路由 smoke：通过，启动 6,047 ms；
- 冻结 Server `/health`：返回 `{"status":"ok"}`，启动 8,398 ms。

单次冻结启动数字只用于证明产物可运行。偶发慢启动按当前项目决策不作为本阶段缺陷。

## 剩余边界

Phase 4 仍需审计开发依赖声明、许可证清单和共享 PYZ 中剩余较大闭包。Pillow、pywin32、
`primp/lxml` 当前都有 Execution Engine 或搜索实际用途，未证明替代路径前不得直接排除。
