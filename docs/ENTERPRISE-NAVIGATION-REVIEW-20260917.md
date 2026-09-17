<!--
Copyright (C) 2026 Synapxnet. All rights reserved.
This file is Synapxnet Proprietary and Confidential. It is strictly
forbidden to copy, distribute, or use without explicit authorization.
企业空间导航与页面验收 / Enterprise navigation and page acceptance.
Author: maoyo | Department: 研发部 | Date: 2026-09-17
Version: 1.3.0 | Security Level: INTERNAL | Maintainer: maoyo
Email: synapxnet@gmail.com
-->

# 企业空间导航与页面验收设计

用户在 XnetMLOps 页面只能看到末尾三个导航入口。导航模型仍有 16 项；旧双列布局的百分比高度与新顶部导航布局叠加，外层隐藏溢出仍允许焦点或 scrollIntoView 滚动祖先。基线已复现导航上移 44 像素。另移除企业页 display:flex 的 !important，避免与 Vue v-show 竞争；此项属于兼容性防护，基线的 8 次切首页检查均正常隐藏，不将它记作实测缺陷。

企业页面采用明确的活动状态。外层布局与导航不参与滚动，只有内容面板滚动；网格内容行使用剩余空间，撤销旧 height:100% 的额外高度。宽屏所有菜单自然换行，窄屏保留完整选择器；选中项保留主题主色和 aria-current。切换标签从该页面顶部进入，不滚动整个应用。沙盘全屏按现有专用布局工作。

服务配置的草稿、已保存地址、连通性和身份验证独立管理，详见 ENTERPRISE-SERVICE-CONFIGURATION-STATE-DESIGN.md。保存、检查、预览的错误反馈和异步结果必须绑定对应地址，避免填错平台仍显示正常。

验收使用真实 Renderer 与明确标记的隔离数据：逐一切换 16 个模块，记录导航和外层容器尺寸；滚到内容底部、聚焦表单并切换页面，验证所有入口仍可达；切回其他主菜单后企业页不占位；浅深色、宽窄窗口、侧栏开合与沙盘退出全屏都要检查。服务行为另以真实桌面服务和受控 HTTP 响应覆盖保存、重载、身份错误、断连、超时与异步竞态。此验收不能替代业务 Run 或线上全平台内部菜单验收。

打包复用本版本未变更的 Python/Memory 资源，重新编译桌面及 Renderer；对最终资源与源码做摘要核对，执行安装产物独立冷启动。旧安装产物先归档到 history，发布结果记录本轮范围和限制。
