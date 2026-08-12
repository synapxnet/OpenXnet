# Phase 3AT Desktop 窗口控制运行时

## 状态

2026-07-29 完成。Desktop 的窗口列表、显示器列表、活动窗口跟随、动作历史和九类窗口动作
不再调用 `/api/desktop/*` legacy HTTP 路由。Renderer 通过 sender-authorized typed IPC 访问
Main，Main 按需激活独立 Desktop Control Worker。Browser/Server 继续保留原 FastAPI 路由
和 Dynamic Island 兼容反馈。

该域优先迁移的原因是“跟随活动窗口”会每 2 秒轮询一次；旧实现一旦打开工作台，就会持续
保持重型 legacy backend 活跃。底层 `py/desktop_window_control.py` 已是框架无关 Windows API
模块，因此可以在不迁移内核、模型或存储域的情况下独立抽取。

## 调用链

```text
Desktop Renderer
  -> typed Desktop Control preload API
  -> authorized Electron Main IPC
  -> ApplicationDesktopControlRuntimeService
  -> desktop-control capability
  -> supervised Desktop Control Worker
  -> pywin32 / Windows shell APIs

Browser / Server
  -> /api/desktop/* compatibility routes
  -> existing FastAPI adapter
  -> py/desktop_window_control.py
```

`desktop-control` capability 只依赖 Core。查询或动作请求才会启动 Worker，空闲 30 秒后自动
停止；应用启动、Home 首帧和普通 Chat 不会激活该能力。

## Typed Contract

公开 contract 包含五条命令：

- 列出窗口：标题筛选不超过 256 字符，结果数量为 1 到 100；
- 列出显示器：最多 64 个；
- 读取活动窗口：返回 found、supported、检测时间和可选窗口；
- 列出动作历史：结果数量为 1 到 40；
- 执行动作：精确 action、HWND 和动作专属 payload。

支持的动作包括聚焦、最小化、置顶、移动、调整尺寸、贴靠、移动到指定显示器，以及移动到
上一或下一显示器。坐标、尺寸、显示器索引、贴靠位置和 `useWorkArea` 均有独立范围与字段
校验。Renderer、Main contract 和 Worker handler 三层都会拒绝额外字段、未知动作和不安全
整数；请求无效时不会激活 Worker。

## 路径与错误边界

底层窗口数据包含 `process_path`，但框架无关控制器会重新构造固定公开对象，只保留进程名、
PID、窗口类、窗口状态和有界矩形。Main 再次执行精确响应校验，包含 `processPath`、额外字段、
超长文本、超界坐标或计数不一致的 Worker 响应都会被拒绝。

底层 Windows API 和 pywin32 异常不会跨 Worker 边界原样传播。控制器将列表、活动窗口和动作
失败转换为固定 RuntimeError；Main 只记录方法级固定诊断，并向 Renderer 返回统一
`Desktop control runtime is unavailable.`。失败历史不记录原始系统错误或本机路径。

## Renderer 与兼容边界

现有 Vue 视图仍使用 snake_case 字段。Renderer 在 typed Runtime 返回后执行一次无路径的
兼容适配，避免本阶段同时重写大面积模板。活动窗口、窗口列表、显示器、历史和动作五条路径
均先检查完整 typed API；只有 Browser/Server 或旧 preload 不具备该 API 时才调用原 HTTP
路由。

原 FastAPI adapter、Dynamic Island 广播和 Browser/Server API 保持不变。独立 Worker 的
动作历史只存在于 Worker 进程内，符合旧 backend 进程级历史语义；Worker 空闲退出后历史会
清空，不写入 Core SQLite 或本机文件。

## 打包与验证

Desktop Control Pack 版本为 `1.0.0-openxnet.1.0.2`：

- payload 文件：71；
- payload 字节：22,970,499；
- Python 入口：`runtime/desktop-control-worker.exe`；
- FastAPI/Uvicorn 文件：0；
- 依赖只保留 Worker 协议、窗口控制模块、Python 标准库和 pywin32 运行时。

真实冻结 Pack smoke 结果：

- Worker 启动耗时 `726 ms`；
- Windows、win32api、win32con、win32gui、win32process 均可导入；
- 真实读取 1 个显示器、5 个有界窗口和当前活动窗口；
- 动作历史初始为空；
- 所有公开结果均通过本机路径字段递归检查；
- smoke 只执行只读窗口查询，动作写入由模拟 Windows API 的专项测试覆盖，避免测试过程改变
  用户正在使用的窗口。

专项与全量回归结果：

- Python 控制器和 Worker handler：4/4；
- TypeScript contract、Runtime、IPC：6/6；
- Renderer 启动架构：29/29；
- Desktop Core：224/224；
- UTF-8、LF、Python docstring、TypeScript 函数说明和 Renderer bootstrap：通过；
- 全量架构回归：通过，耗时 `158,460 ms`。

最终 Electron 冷启动：process `1,846 ms`、workspace `1,544 ms`、观察窗口 `2,500 ms`。
Desktop Control Worker、Execution Engine、Voice、Connector、Live、MCP 和 legacy backend 均
保持 stopped，新增 capability 没有增加空闲 Python 进程。

## 后续边界

剩余高价值域仍包括内核与 Recall/Memory 页面、开发工作台 snapshots/repository/code search、
VR/VRM/VRMA/Gaussian 资产、扩展与技能管理、企业控制台，以及其他通用存储上传路径。下一域
继续按真实 Desktop 调用频率、legacy 激活持续时间、依赖重量和可独立冻结验证性排序。
