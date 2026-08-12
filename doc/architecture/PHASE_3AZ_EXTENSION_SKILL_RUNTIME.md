# Phase 3AZ Extension And Skill Runtime

## 状态

2026-07-29 完成。Desktop 扩展和技能的本机目录、ZIP/GitHub 安装、更新、删除、技能预览、项目同步、
技能结晶以及扩展 Node 生命周期不再调用 Python 管理路由。Renderer 通过 typed preload API 进入
Main-owned TypeScript Runtime；Browser/Server 继续保留 FastAPI compatibility routes。

打开扩展/技能管理页面、五秒目录刷新、技能预览和项目状态读取不会启动 `legacy-backend`。Desktop
缺少 typed API 时直接报告 Runtime 不可用，禁止静默降级到 `/api/extensions/*` 或 `/api/skills/*`。

## 调用链

```text
Desktop 扩展/技能 ZIP
  -> preload webUtils.getPathForFile(File)
  -> typed Extension / Skill IPC
  -> ZIP 全量预检
  -> 同卷暂存目录
  -> 原子替换 userData/ext 或 ~/.agents/skills

Desktop GitHub/Gitee 扩展安装
  -> typed repository metadata
  -> 固定主机 HTTPS + manual redirect
  -> 有界流式 ZIP 下载
  -> 安全解包与原子安装

Desktop 扩展页面
  -> explicit start(extensionId)
  -> 独立回环 Extension Gateway Origin
  -> 静态普通文件，或受监督 Node 回环端口

Desktop 技能项目同步
  -> typed skillId + fixed action
  -> Main 启动时持久化或原生对话框授权的工作区
  -> <workspace>/.agent/skills

Browser / Server
  -> 原 FastAPI extension / skill compatibility routes
```

Renderer 不能提交扩展命令、可执行文件、端口、工作目录、进程环境、下载 URL、安装目标或技能项目
路径。扩展页面 URL 由 Main 在启动结果中返回；技能工作区只从 Main-owned `CLISettings.cc_path` 读取，
并再次要求命中启动时持久化授权或当前原生目录授权。

## ZIP 与安装边界

ZIP 在创建任何目标文件前使用 lazy central-directory 扫描检查：

- 拒绝绝对路径、Windows drive、反斜杠、控制字符、空段、`.`、`..` 和大小写碰撞；
- 拒绝符号链接、特殊文件和加密条目；
- 检查归档字节、单条目字节、解压总字节和条目数量；
- 解压后再次遍历目录，拒绝任一链接或特殊文件；
- 所有暂存目录都位于目标根同一文件系统，最终使用 rename 替换；
- 更新失败会恢复旧目录，依赖指纹未变化时才复用旧 `node_modules`。

扩展 ZIP 最多 256 MiB、解压最多 1 GiB、50,000 条目、单条目 512 MiB；技能 ZIP 最多 64 MiB、
解压最多 256 MiB、10,000 条目、单条目 32 MiB。无本机路径的生成 File 在 preload 分别限制为
扩展 32 MiB和技能 16 MiB。扩展 `package.json` 最多 2 MiB，技能 Markdown 最多 1 MiB。

技能多包安装先验证全部候选目录，再批量备份和替换；任一步失败会删除本次新目录并恢复旧目录。
全局/项目同步使用单技能暂存、备份和恢复。内置技能从 Electron `extraResources/skills` 只补齐缺失项，
不覆盖用户版本。

## 网络与仓库策略

扩展仓库只接受无凭据、无 query/fragment 的 GitHub 或 Gitee HTTPS 仓库根 URL；备用源必须解析为
相同扩展 ID。技能仓库只接受 GitHub 根 URL 或单段 branch 的 `tree` 深链。下载允许的重定向主机是
固定 GitHub codeload/Gitee 集合，使用 `redirect: manual`、Content-Length 预检、实际流字节复检、
超时和临时文件清理。

远程扩展目录只从代码内固定 GitHub Raw/Gitee 地址读取，最多 2 MiB 和 500 项。目录只提供候选仓库
元数据，不授予执行能力。当前社区目录没有签名，因此它不是可信软件供应链；正式发行应在目录协议
加入签名、版本和内容哈希，或把官方扩展迁入现有 Feature Pack 签名分发体系。

## 扩展运行边界

静态扩展和 Node 扩展都通过独立临时回环 Origin 展示。主页面 iframe 使用 sandbox；Extension Gateway
逐段检查普通文件、拒绝链接、设置独立 CSP，并在代理 Node 请求时删除 `Authorization` 和 Cookie。
扩展代码不再与主应用 UI 同源，不能读取主页面 DOM、localStorage 或 typed preload API。

Node 入口固定为扩展根的 `index.js`，端口由 Main 分配。依赖安装固定调用随包 npm：
`--omit=dev --ignore-scripts --no-audit --no-fund`。子进程只继承系统运行所需路径、locale、临时目录，
以及 `ELECTRON_RUN_AS_NODE`/`NODE_ENV`；OpenXnet 凭据和私有环境不继承。进程启动有 15 秒回环健康
预算，输出只保留 64 KiB，退出时按进程树终止。

这不是操作系统级代码沙箱。用户显式启动的第三方 Node 扩展仍能以当前用户权限执行代码和访问
网络。真正不受信任的企业扩展必须进入单独 OS sandbox/container、签名 Feature Pack 或更严格的权限
声明体系，不能仅依靠 iframe sandbox 或环境变量过滤。

## 技能边界

技能元数据使用 `js-yaml` 解析有界 YAML frontmatter，不使用正则拼接字段。目录 ID、文件数、目录树
体积和 Markdown 编码均受限；文件始终以 UTF-8/LF 写入。技能结晶输入使用 exact typed contract，
生成标准 `SKILL.md`，可选择同步到当前已授权工作区。

Renderer 的同步请求只有 `skillId` 和 `install/remove/sync_to_global`。Runtime 不接受 `projectPath`，
不会根据 Renderer 请求写入任意目录。打开技能目录也由 Main 直接调用 shell，不把全局路径返回给
Renderer。

## 验证

- Extension/Skill Runtime 与 IPC 专项：6/6；
- Renderer 启动架构：34/34；
- Desktop Core 主套件：238/238，3AX/3AY/3AZ post-test 12/12；
- UTF-8、Python docstring、TypeScript 函数说明：通过；
- 真实 Electron smoke：本机中文扩展 ZIP、隔离静态页面、Node 模式、内置/本机技能、项目同步和结晶通过；
- Electron smoke 中 legacy backend 激活次数为 0。
- 全量 `npm test`：通过，耗时 `163,100 ms`。

最终冷启动：process `1,864 ms`、workspace `1,514 ms`、观察窗口 `2,500 ms`。`legacy-backend`
和全部可选 capability 保持 stopped。

## 后续边界

Python `py/extensions.py`、`py/node_runner.py` 和 `py/skills.py` 继续服务 Browser/Server compatibility profile，
不从源码删除。Skill lifecycle/library、Cortex 睡眠结晶和企业远程目录属于后续服务域；Desktop 管理页面
已不依赖这些 Python 文件完成普通扩展/技能生命周期。
