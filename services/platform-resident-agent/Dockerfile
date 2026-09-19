# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.
# 驻场容器 / Resident container
# Author: maoyo
# Department: 研发部
# Date: 2026-09-16
# Version: 1.3.0
# Security Level: INTERNAL
# __version__ = "1.3.0"; __author__ = "maoyo"; __copyright__ = "Copyright 2026 Synapxnet"
# __maintainer__ = "maoyo"; __email__ = "synapxnet@gmail.com"
FROM node:22-alpine
WORKDIR /app
COPY server.js storage.js feature-drift-reader.js ./
COPY vendor ./vendor
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8090 RESIDENT_DATA_DIR=/data
EXPOSE 8090
USER node
CMD ["node", "server.js"]
