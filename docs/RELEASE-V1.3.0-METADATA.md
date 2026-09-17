<!--
#!/usr/bin/env markdown
# -*- coding: utf-8 -*-
# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.
# 发布版本元数据 / Release version metadata
# Author: maoyo
# Department: 研发部
# Date: 2026-09-16
# Version: 1.3.0
# Security Level: INTERNAL
# __version__: 1.3.0 | __author__: maoyo
# __copyright__: Copyright 2026 Synapxnet | __maintainer__: maoyo
# __email__: synapxnet@gmail.com
-->

# OpenXnet V1.3.0 发布元数据

桌面 `package.json`、Python 项目 `pyproject.toml` 和 `server.py` 的发布版本统一为 `1.3.0`。Python distribution 名称为 `openxnet`，服务端 OpenAPI 标题为 `OpenXnet`，OpenAI 兼容模型列表的 `owned_by` 为 `openxnet`。服务健康与工具链快照已有的 `app_version` 使用服务入口的同一版本值。

本次只修正发布元数据；Python 导入路径、依赖声明、历史数据库文件名、用户数据目录及兼容迁移键保持现有契约。Python distribution 名称不是 `py.*` 模块导入名称。原有 LICENSE、NOTICE 与第三方归属不变。

验收使用 TOML/JSON 解析和 Python AST 检查，核对三处版本、产品身份、FastAPI 配置及 Python 语法。已有封装依赖与冷启动报告回归一并运行。完整构建时必须重新生成 `dist/server`，旧后端可执行文件不能用于本次新版本验收。此项元数据验收不替代登录后逐页、工作空间隔离和人工审批流程验收。
