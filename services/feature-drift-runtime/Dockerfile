# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.
# 隔离CPU执行镜像 / Isolated CPU execution image.
# Author: maoyo | Department: 研发部 | Date: 2026-09-18 | Version: 1.3.0
# Security Level: INTERNAL | Maintainer: maoyo | Email: synapxnet@gmail.com
FROM python:3.12-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 FEATURE_DRIFT_HOST=0.0.0.0 FEATURE_DRIFT_PORT=8080 FEATURE_DRIFT_DATA_DIR=/var/lib/openxnet-feature-drift
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt && useradd --uid 10001 --create-home runtime && mkdir -p /var/lib/openxnet-feature-drift && chown runtime:runtime /var/lib/openxnet-feature-drift
COPY runtime.py ./
USER runtime
EXPOSE 8080
CMD ["python", "runtime.py"]
