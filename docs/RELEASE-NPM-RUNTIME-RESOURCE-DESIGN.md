<!--
#!/usr/bin/env markdown
# -*- coding: utf-8 -*-
# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.
# 内置 npm 运行资源修复 / Bundled npm runtime resource correction
# Author: maoyo | Department: 研发部 | Date: 2026-09-16
# Version: 1.3.0 | Security Level: INTERNAL
# __author__: maoyo | __maintainer__: maoyo | __email__: synapxnet@gmail.com
-->

# Windows 内置 npm 依赖补全

本设计和发行说明先于修改写入。桌面打包后由 `main.js` 使用 `resources/npm/bin/npm-cli.js`。原 `extraResources` 只映射 `node_modules/npm/`，electron-builder 的 `FileMatcher.createFilter` 固定拒绝每个来源根下的相对路径 `node_modules`，因此 npm 自身依赖目录被遗漏。

只读检查现有 `E:\SynapXnet\openxnet-desktop\win-unpacked\resources\npm`：入口存在，依赖目录不存在，从该产物的入口解析 `graceful-fs`、`semver/functions/satisfies`、`proc-log` 均失败。源码目录依赖完整不能代替安装资源验收。此缺口会影响桌面工具链通过内置 npm 启动或安装组件。

## 改动

在原 npm 资源映射后增加独立来源 `node_modules/npm/node_modules/`，目标为 `npm/node_modules`，过滤为 `**/*`。新来源的直接子目录是依赖包名，避免构建器对来源根 `node_modules` 的特殊排除；更深依赖目录仍由真实过滤规则递归处理。

不改应用版本、依赖版本、凭据和源 npm 内容，不重建 Python 后端或 Memory Pack，不修改 UI。保留 npm 许可证与依赖许可文件。新映射补齐被错误过滤的运行依赖，不将开发 node_modules 整体复制到资源目录。

## 验收

新测试使用项目当前安装的 electron-builder `getFileMatchers` 和 `copyFiles`，把 npm 与新增依赖映射生成到系统临时目录。必须确认依赖文件完整镜像，使用从生成产物创建的 `require` 解析关键依赖并保证解析路径留在该临时资源树内；随后以隔离 npm 配置执行这份资源的 `--version`，不得借用项目 node_modules 或用户 npm 配置。测试不启动 Electron、不访问网络、不打包全应用。结束后只清理本测试自己创建的临时目录。

源码、后端和 Memory 的本轮构建已由主验收完成，最终打包可以直接运行 `node node_modules/electron-builder/cli.js --win nsis --x64 --publish never`。需要正式签名时另加 `--config scripts/electron-builder.win-sign.config.cjs`，并使用既有签名配置。不得把只含 UI 的 `pack:ui-smoke` 结果当作完整交付。

最终新 `win-unpacked` 仍须由主验收再次检查对应 npm 入口和运行依赖；本临时资源测试不会把旧安装产物标记为已修复。
