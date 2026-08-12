#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
Xnet 服务桥接器 — 健康检测 + URL 配置持久化。

管理 XnetDataOps / XnetMLOps / XnetAIOps 三个外部服务的连接状态。
通过 HTTP ping 检测服务是否在线，并持久化 URL 配置。

Author: maoyo
Department: 研发部
Date: 2026-04-13
Version: 1.0.0
Security Level: INTERNAL
"""

__version__ = "1.0.0"
__author__ = "maoyo"
__copyright__ = "Copyright 2026 Synapxnet"
__maintainer__ = "maoyo"
__email__ = "synapxnet@gmail.com"

import json
import logging
import os
import asyncio
from datetime import datetime
from typing import Dict, Any, Optional

logger = logging.getLogger("openxnet.enterprise.xnet_bridge")


class XnetBridge:
    """
    Xnet 服务桥接器。
    管理三个 Xnet 微服务集群的连接配置和健康检测。
    """

    DEFAULT_SERVICES = {
        "dataops": {"name": "XnetDataOps", "url": "", "status": "offline", "last_check": "", "auto_connect": False},
        "mlops": {"name": "XnetMLOps", "url": "", "status": "offline", "last_check": "", "auto_connect": False},
        "aiops": {"name": "XnetAIOps", "url": "", "status": "offline", "last_check": "", "auto_connect": False},
    }

    def __init__(self, data_dir: str = ""):
        self.data_dir = data_dir or os.path.join(os.path.dirname(__file__), "..", "..", "data", "enterprise")
        os.makedirs(self.data_dir, exist_ok=True)
        self.data_file = os.path.join(self.data_dir, "xnet_services.json")
        self.services: Dict[str, Dict[str, Any]] = {}
        self._load()

    def _load(self):
        """加载 Xnet 服务配置。"""
        try:
            if os.path.exists(self.data_file):
                with open(self.data_file, "r", encoding="utf-8") as f:
                    self.services = json.load(f)
            else:
                self.services = dict(self.DEFAULT_SERVICES)
        except Exception as e:
            logger.warning(f"[XnetBridge] Load failed: {e}")
            self.services = dict(self.DEFAULT_SERVICES)

        # 确保所有服务都存在
        for key, default in self.DEFAULT_SERVICES.items():
            if key not in self.services:
                self.services[key] = dict(default)

    def _save(self):
        """保存配置。"""
        try:
            with open(self.data_file, "w", encoding="utf-8") as f:
                json.dump(self.services, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"[XnetBridge] Save failed: {e}")

    def get_services(self) -> Dict[str, Dict[str, Any]]:
        """获取所有 Xnet 服务配置。"""
        return self.services

    def update_service(self, service_key: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """更新单个服务配置。"""
        if service_key not in self.services:
            return None
        service = self.services[service_key]
        previous_url = str(service.get("url", "") or "").strip()
        for field in ["url", "auto_connect"]:
            if field in data:
                service[field] = data[field]

        current_url = str(service.get("url", "") or "").strip()
        service["url"] = current_url

        # Reset the last health snapshot when the target URL changes so the
        # UI does not keep showing stale connectivity state.
        if current_url != previous_url or not current_url:
            service["status"] = "offline"
            service["last_check"] = ""

        self._save()
        return service

    async def health_check(self, service_key: str) -> Dict[str, Any]:
        """
        检测指定 Xnet 服务是否在线。
        向服务 URL 发送 HTTP GET 请求，根据返回状态判断。
        """
        if service_key not in self.services:
            return {"status": "offline", "error": "Unknown service"}

        service = self.services[service_key]
        url = service.get("url", "").strip()
        if not url:
            service["status"] = "offline"
            service["last_check"] = ""
            self._save()
            return {"status": "offline", "error": "No URL configured"}

        try:
            import httpx
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(url)
                if response.status_code < 500:
                    service["status"] = "online"
                else:
                    service["status"] = "offline"
        except Exception as e:
            logger.debug(f"[XnetBridge] Health check failed for {service_key}: {e}")
            service["status"] = "offline"

        service["last_check"] = datetime.now().isoformat()
        self._save()
        return {"status": service["status"], "last_check": service["last_check"]}

    async def health_check_all(self) -> Dict[str, Dict[str, Any]]:
        """并行检测所有 Xnet 服务。"""
        tasks = {key: self.health_check(key) for key in self.services}
        results = {}
        for key, task in tasks.items():
            results[key] = await task
        return results
