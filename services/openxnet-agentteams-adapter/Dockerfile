# -*- coding: utf-8 -*-
# Copyright (C) 2026 Synapxnet. All rights reserved.
# SPDX-License-Identifier: AGPL-3.0-only
# 驻场上下文增量镜像 / Resident-context incremental image.
# Author: maoyo (maintenance) | Department: 研发部 | Date: 2026-09-17
# Version: 1.3.0-live.4 | Security Level: INTERNAL
# __maintainer__: maoyo | __email__: synapxnet@gmail.com
# Original LICENSE and THIRD_PARTY_NOTICES.md remain authoritative and unchanged.

# 保留已验收 Worker 租约基底；原标签为 1.1.1-workerlease.6。
# Retain the accepted Worker lease base, originally tagged 1.1.1-workerlease.6.
ARG ADAPTER_BASE_IMAGE=synapxnet/openxnet-agentteams-adapter:1.1.1-workerlease.6
FROM ${ADAPTER_BASE_IMAGE}

LABEL org.opencontainers.image.title="OpenXnet AgentTeams Adapter" \
      org.opencontainers.image.version="1.3.0-live.4" \
      org.opencontainers.image.licenses="AGPL-3.0-only" \
      org.opencontainers.image.vendor="Synapxnet" \
      org.opencontainers.image.base.name="synapxnet/openxnet-agentteams-adapter:1.1.1-workerlease.6" \
      org.opencontainers.image.base.digest="sha256:463f3f04dec51cd206f03b8274ed24e81a386eb933df2944d378af6819b63b4a"

WORKDIR /app
USER node

# 只替换维护源码和包版本；保留原有 CLI、入口、依赖与许可证。
# Replace maintained source and package version only; retain CLI, entrypoint, dependencies and licenses.
COPY --chown=node:node src/ ./src/
COPY --chown=node:node package.json ./package.json
COPY --chown=node:node skill-bundles/ ./skill-bundles/

# 构建阶段仅本地语法校验，不读取运行卷或下载依赖。
# Build-time syntax validation is local and reads no runtime volume or dependency network.
RUN node --check src/contracts.js \
    && node --check src/security.js \
    && node --check src/credential-store.js \
    && node --check src/access-grant-store.js \
    && node --check src/live-access-store.js \
    && node --check src/live-gateway.js \
    && node --check src/live-tool-catalog.js \
    && node --check src/matrix-client.js \
    && node --check src/agentteams-cli.js \
    && node --check src/skill-bundle.js \
    && node --check src/server.js \
    && node --check src/worker-activity-store.js \
    && node --check src/worker-activity-cli.js \
    && node --check src/worker-activity-client.js \
    && node --check src/worker-lifecycle-cli.js \
    && node --check src/worker-lifecycle-bootstrap.js \
    && node -e "require('./src/skill-bundle').validateStageSkillBundle().catch(() => process.exit(1))" \
    && node -e "if(require('./package.json').version !== '1.3.0-live.4') process.exit(1)"
