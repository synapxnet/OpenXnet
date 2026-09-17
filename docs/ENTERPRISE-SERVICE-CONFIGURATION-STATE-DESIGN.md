<!--
Copyright (C) 2026 Synapxnet. All rights reserved.
This file is Synapxnet Proprietary and Confidential. It is strictly
forbidden to copy, distribute, or use without explicit authorization.
Author: maoyo | Department: 研发部 | Date: 2026-09-17
Version: 1.0.0 | Security Level: INTERNAL
Maintainer: maoyo | Email: synapxnet@gmail.com
-->

# 三平台服务配置与预览状态修正

## 需求与界面

平台配置页的主要任务是保存正确的平台地址、检查网络及平台身份、打开已验证的平台。输入框使用独立草稿；配置摘要、外部浏览器和 iframe 只使用 Main 已保存的地址。编辑地址不会继承新地址的“在线”状态，也不会立即导航 iframe。

三个页面统一展示“连接状态、平台身份、自动检查、已验证平台数”。区分已保存地址和未保存修改。自动检查开关与地址一起由“保存配置”提交，取消修改恢复最后保存的配置。检查按钮只读取已保存地址，存在未保存修改时引导先保存或取消，不隐式提交。

## 对接与异步边界

- 沿用 `listApplicationEnterpriseXnetServices`、`saveApplicationEnterpriseXnetService`、`checkApplicationEnterpriseXnetService`、`checkAllApplicationEnterpriseXnetServices`，无新增后端接口、凭据或用户数据迁移。
- 完整接收 `connectionStatus`、`identityStatus`、`identityPlatform`、`identitySource`、`status`、`last_check`，身份不匹配的可达页面不算在线。
- 保存回执更新已保存记录；仅当当前草稿仍等于本次提交草稿时规范化输入框，避免覆盖保存期间的新编辑。
- 读取/批量检查与保存/单平台检查互斥；单平台请求使用递增序号和地址匹配防止旧回包覆盖新状态。刷新列表保留任何未保存的草稿。
- 缺失或失败回执显示固定、可重试的错误；不把错误正文或地址中的敏感内容写入通知。
- iframe 需要同时满足网络可达、身份匹配且身份属于当前平台；旧版本缺少身份字段时保持待检查。

## 验收

行为回归覆盖正确/错误平台身份、草稿编辑不导航、保存期间继续编辑、保存失败保留草稿且提示、检查不会隐式保存、刷新保留草稿、单次/批量完整状态合并、旧回包拒绝、浏览器打开已保存地址。使用隔离测试替身，不操作用户配置或线上平台。

2026-09-17：新服务页行为测试 15/15 通过；与企业沙盘及 GOAI Renderer 组合测试 74/74 通过。附加回归确认：初始空白输入被已保存地址正确填充，显式清空草稿经过读取后仍保留，保存的规范化 URL 不误留未保存状态，缺少身份来源或身份矛盾时拒绝预览。新测试已加入 Renderer 固定测试清单，清单检查 18/18 通过。Renderer 构建与实机主题、窄窗验收由本轮统一集成执行，未以单元测试代替实机完成结论。桌面使用 Main IPC 的完整身份契约；旧 Python web-only 健康接口缺少身份字段，只显示未验证，不视为已验证平台。
