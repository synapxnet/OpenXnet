<!--
Copyright (C) 2026 Synapxnet. All rights reserved.
This file is Synapxnet Proprietary and Confidential. It is strictly
forbidden to copy, distribute, or use without explicit authorization.
企业协作群成员提及设计 / Enterprise collaboration member mention design.
Author: maoyo | Department: 研发部 | Date: 2026-09-18
Version: 1.0.0 | Security Level: INTERNAL
__version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
__maintainer__: maoyo | __email__: synapxnet@gmail.com
-->

# 企业协作群 @ 成员交互

## 问题与目标

现有输入框只接受普通文本，成员面板中的选择才会更新 recipientIds。手动输入 @ 不产生候选，删除正文中的提及也不会可靠取消接收人。本次将企业群沟通补齐为可发现、可键盘操作的成员提及，同时保留“发送消息”和“发起受控任务”的区别。

## 成员来源与安全边界

- 复用 getEnterpriseChatAvailableStaff()：只显示当前工作空间/项目范围内启用的员工角色卡，不伪造三个 GOAI 角色，不添加具有广播意义的虚拟“所有人”。
- 选择候选时再次检查当前群与成员有效性，过期弹窗不能向其他群写入接收人。
- recipientIds 只能来自用户明确选择的成员，正文中手打或粘贴的同名 @ 文本不自动获得收件人语义，更不代表执行权限或任务批准。
- 不修改服务端权限契约，服务端仍负责消息和任务的合法性检查。

## 交互与状态

1. 在光标位置输入 @，在输入框上方打开成员候选；过滤支持中文、英文及包含空格的多词名称，邮箱中的 @ 不触发。
2. 上下方向键移动、Enter 或 Tab 选择，首次 Enter 只选择成员，不发送消息；Escape 关闭。鼠标选择保留原光标位置。Shift+Enter 仍插入换行。
3. 中文输入法合成期间不选择、不发送；合成结束后再刷新候选。
4. 选择后在原位置补全 @姓名及空格，并展示可删除的接收人标签。正文中删除、修改提及或点击标签删除按钮，会同步移除对应 recipientId；提及前后编辑通过文本差分维护已选范围。
5. 当前群草稿同时保存正文和明确选择的提及范围。切换工作空间/项目关闭候选并隔离草稿；返回原群恢复原草稿，重新校验成员。
6. 无成员、无匹配分别提供说明。弹层采用 Element Plus 的浮层定位，传送到页面浮层区域，自动避让边缘，不受聊天阅读区裁切。

## 界面与对接

- 候选展示原创现有员工图标/导入头像、完整名称、选中标记；不截短 GOAI 多词角色名。
- 遵循现有皮肤变量、明暗主题和减少动画偏好；键盘选择有背景与轮廓反馈。
- 新方法位于 openxnet-enterprise-chat-experience.js，由现有 bootstrap 注册。index.html 仅更改群聊输入区域，CSS 放在既有企业会话模块中。
- 宿主打开指定员工聊天、切换成员、发送和发起任务调用同一套提及同步方法，发送成功后清理提及元数据。

## 验收

行为测试覆盖：当前范围过滤、中文/多词匹配、邮箱排除、Enter/Tab 不发送、上下键/Esc、IME、光标插入、删除与改名同步、纯文本不提升为收件人、过期候选、群间草稿隔离及无成员/无匹配。既有并发发送、任务和头像测试继续通过。最终由主线浏览器验收真实浮层、窄窗口与明暗主题。

## 与真实角色消息的联动

主线消息投影提供 collaboration 来源对象后，群聊显示真实发送者姓名与职责图标，并区分任务交接和阶段结果。来源采用一个可展开的只读区域，集中展示阶段、决策、证据、工具请求、事件/Run、Trace、来源记录及输出摘要校验。默认不在正文下重复展示技术 ID；阶段结果采用中性文档图标，不以成功图标暗示验证通过。

Governance 中已经持久化的业务失败事件不显示“发送失败”；实际发送失败仍明确提示。部分历史协作记录暂时无法同步时显示可重试提示，不编造 Agent 对话。

2026-09-18 行为验证：`node --test tests/enterprise_conversation_experience.test.cjs`，26 项全部通过。浏览器视觉与真实产物集成验收由主线统一执行。
