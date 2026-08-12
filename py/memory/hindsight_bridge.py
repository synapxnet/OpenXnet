#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
Hindsight 外部记忆桥接适配器。

提供与 Hindsight 记忆服务的 retain/recall/reflect 三路通信接口。
支持外部服务连接 (URL + API Key + Bank) 和内嵌部署两种模式。

核心接口:
  - retain(text, metadata): 存储记忆片段
  - recall(query, top_k): 检索相关记忆
  - reflect(query): 基于全量记忆的深度推理

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

# Modification History:
# 2026-04-13, v1.0.0, maoyo: Initial creation — retain/recall/reflect.

import logging
import httpx
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field

logger = logging.getLogger("openxnet.memory.hindsight")


@dataclass
class HindsightConfig:
    """Hindsight 连接配置。"""
    enabled: bool = False
    base_url: str = "http://127.0.0.1:8765"
    api_key: str = ""
    bank: str = "default"
    timeout: float = 30.0


class HindsightBridge:
    """
    Hindsight 记忆服务桥接器。

    通过 HTTP API 与外部 Hindsight 服务通信，实现记忆的
    存储 (retain)、检索 (recall) 和反思 (reflect)。
    """

    def __init__(self, config: HindsightConfig):
        """
        初始化 Hindsight 桥接器。

        Args:
            config: Hindsight 连接配置
        """
        self.config = config
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        """获取或创建 HTTP 客户端（懒加载）。"""
        if self._client is None or self._client.is_closed:
            headers = {"Content-Type": "application/json"}
            if self.config.api_key:
                headers["Authorization"] = f"Bearer {self.config.api_key}"
            self._client = httpx.AsyncClient(
                base_url=self.config.base_url,
                headers=headers,
                timeout=self.config.timeout,
            )
        return self._client

    async def retain(self, text: str, metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        存储记忆片段到 Hindsight。

        Args:
            text: 待存储的文本内容
            metadata: 附加元数据（如来源、时间戳等）

        Returns:
            存储结果字典
        """
        if not self.config.enabled:
            return {"status": "skipped", "reason": "hindsight_disabled"}

        try:
            client = await self._get_client()
            payload = {
                "text": text,
                "bank": self.config.bank,
                "metadata": metadata or {},
            }
            response = await client.post("/api/retain", json=payload)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.warning(f"[Hindsight] retain failed: {e}")
            return {"status": "error", "error": str(e)}
        except Exception as e:
            logger.error(f"[Hindsight] unexpected retain error: {e}")
            return {"status": "error", "error": str(e)}

    async def recall(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """
        从 Hindsight 检索相关记忆。

        Args:
            query: 检索查询文本
            top_k: 返回的最大记忆条数

        Returns:
            匹配的记忆列表
        """
        if not self.config.enabled:
            return []

        try:
            client = await self._get_client()
            payload = {
                "query": query,
                "bank": self.config.bank,
                "top_k": top_k,
            }
            response = await client.post("/api/recall", json=payload)
            response.raise_for_status()
            data = response.json()
            return data.get("memories", data.get("results", []))
        except httpx.HTTPError as e:
            logger.warning(f"[Hindsight] recall failed: {e}")
            return []
        except Exception as e:
            logger.error(f"[Hindsight] unexpected recall error: {e}")
            return []

    async def reflect(self, query: str) -> str:
        """
        基于全量记忆进行深度推理反思。

        Args:
            query: 反思查询

        Returns:
            反思推理结果文本
        """
        if not self.config.enabled:
            return ""

        try:
            client = await self._get_client()
            payload = {
                "query": query,
                "bank": self.config.bank,
            }
            response = await client.post("/api/reflect", json=payload)
            response.raise_for_status()
            data = response.json()
            return data.get("reflection", data.get("answer", ""))
        except httpx.HTTPError as e:
            logger.warning(f"[Hindsight] reflect failed: {e}")
            return ""
        except Exception as e:
            logger.error(f"[Hindsight] unexpected reflect error: {e}")
            return ""

    async def health_check(self) -> bool:
        """
        检查 Hindsight 服务是否可达。

        Returns:
            服务是否健康
        """
        if not self.config.enabled:
            return False

        try:
            client = await self._get_client()
            response = await client.get("/health")
            return response.status_code == 200
        except Exception:
            return False

    async def close(self):
        """关闭 HTTP 客户端连接。"""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None
