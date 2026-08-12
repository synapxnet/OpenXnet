#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
三路记忆联邦中枢。

统一管理 mem0 (短期记忆)、NeuroSymbol (认知符号) 和 Hindsight (长期记忆)
三个记忆源，提供跨源检索和去重融合功能。

核心流程:
  存储: 对话输入 → [mem0.add] + [SymbolCrystallizer] + [hindsight.retain] → 三路并行
  检索: query → [mem0.search] + [SymbolStore.match] + [hindsight.recall] → dedup_merge()
  反思: query → hindsight.reflect(query) → 深度推理回答

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
# 2026-04-13, v1.0.0, maoyo: Initial creation — federation + dedup_merge.

import asyncio
import logging
import hashlib
import re
from typing import List, Dict, Any, Optional

from .hindsight_bridge import HindsightBridge, HindsightConfig
from py.git_shadow import list_workspace_decisions

logger = logging.getLogger("openxnet.memory.federation")


class MemoryFederation:
    """
    三路记忆联邦中枢。

    同时管理三个记忆源，提供统一的存储和检索接口。
    各源的优先级和权重可以通过配置进行调整。

    Attributes:
        hindsight: Hindsight 桥接器实例
        symbol_store: NeuroSymbol 认知符号库引用
        mem0_client: mem0 短期记忆客户端引用
    """

    def __init__(
        self,
        hindsight_config: Optional[HindsightConfig] = None,
        symbol_store=None,
        mem0_client=None,
        memory_provider=None,
        session_store=None,
    ):
        """
        初始化三路联邦中枢。

        Args:
            hindsight_config: Hindsight 连接配置（None 则禁用）
            symbol_store: NeuroSymbol 认知符号库实例
            mem0_client: mem0 客户端实例
        """
        self.hindsight = HindsightBridge(hindsight_config or HindsightConfig())
        self.symbol_store = symbol_store
        self.mem0_client = mem0_client
        self.memory_provider = memory_provider or session_store

    @property
    def session_store(self):
        """Backward-compatible alias for the active workspace memory provider."""
        return self.memory_provider

    @session_store.setter
    def session_store(self, value):
        self.memory_provider = value

    async def federated_recall(
        self,
        query: str,
        top_k: int = 5,
        include_sources: bool = True,
    ) -> List[Dict[str, Any]]:
        """
        跨三路记忆源进行联邦检索。

        并行查询所有已配置的记忆源，然后去重融合结果。

        Args:
            query: 检索查询文本
            top_k: 每个源返回的最大条数
            include_sources: 是否在结果中标注来源

        Returns:
            去重融合后的记忆列表
        """
        tasks = []
        source_labels = []

        # Hindsight 检索
        if self.hindsight and self.hindsight.config.enabled:
            tasks.append(self._recall_hindsight(query, top_k))
            source_labels.append("hindsight")

        # NeuroSymbol 检索
        if self.symbol_store:
            tasks.append(self._recall_neuro(query, top_k))
            source_labels.append("neuro_symbol")

        # mem0 检索
        if self.mem0_client:
            tasks.append(self._recall_mem0(query, top_k))
            source_labels.append("mem0")

        # workspace session memory
        if self.memory_provider:
            tasks.append(self._recall_session_memory(query, top_k))
            source_labels.append("session_memory")
            tasks.append(self._recall_workspace_decisions(query, top_k))
            source_labels.append("workspace_decision")

        if not tasks:
            return []

        # 并行执行所有检索
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # 收集所有检索结果
        all_memories = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.warning(f"[Federation] {source_labels[i]} recall failed: {result}")
                continue
            for mem in result:
                if include_sources:
                    mem["_source"] = source_labels[i]
                all_memories.append(mem)

        # 去重融合
        return self.dedup_merge(all_memories)

    async def federated_retain(
        self,
        text: str,
        user_id: str = "default",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        向所有已配置的记忆源并行存储。

        Args:
            text: 待存储的文本内容
            user_id: 用户标识符
            metadata: 附加元数据

        Returns:
            各源存储结果汇总
        """
        results = {}
        meta = metadata or {}

        # Hindsight
        if self.hindsight and self.hindsight.config.enabled:
            try:
                results["hindsight"] = await self.hindsight.retain(text, meta)
            except Exception as e:
                results["hindsight"] = {"status": "error", "error": str(e)}

        # mem0 (同步调用，包在线程中)
        if self.mem0_client:
            try:
                loop = asyncio.get_event_loop()
                mem0_result = await loop.run_in_executor(
                    None,
                    lambda: self.mem0_client.add(text, user_id=user_id, metadata=meta)
                )
                results["mem0"] = {"status": "ok", "result": str(mem0_result)}
            except Exception as e:
                results["mem0"] = {"status": "error", "error": str(e)}

        # NeuroSymbol（由 SymbolCrystallizer 处理，不在此直接调用）
        results["neuro_symbol"] = {"status": "delegated", "note": "handled by SymbolCrystallizer in post-neural loop"}

        return results

    # ═══════════════════════════════════════════
    # 内部检索适配方法
    # ═══════════════════════════════════════════

    async def _recall_hindsight(self, query: str, top_k: int) -> List[Dict[str, Any]]:
        """Hindsight 检索适配。"""
        memories = await self.hindsight.recall(query, top_k)
        return [
            {
                "text": m.get("text", m.get("content", "")),
                "score": m.get("score", m.get("relevance", 0.0)),
                "timestamp": m.get("timestamp", m.get("created_at", "")),
            }
            for m in memories
        ]

    async def _recall_neuro(self, query: str, top_k: int) -> List[Dict[str, Any]]:
        """NeuroSymbol 检索适配。"""
        try:
            matches = self.symbol_store.match(query, top_k=top_k)
            return [
                {
                    "text": m.get("content", m.get("name", "")),
                    "score": m.get("score", m.get("activation", 0.0)),
                    "timestamp": m.get("lastAccessed", ""),
                    "operator": m.get("operator", ""),
                }
                for m in (matches if isinstance(matches, list) else matches.get("matches", []))
            ]
        except Exception as e:
            logger.warning(f"[Federation] NeuroSymbol recall error: {e}")
            return []

    async def _recall_mem0(self, query: str, top_k: int) -> List[Dict[str, Any]]:
        """mem0 检索适配。"""
        try:
            loop = asyncio.get_event_loop()
            results = await loop.run_in_executor(
                None,
                lambda: self.mem0_client.search(query, limit=top_k)
            )
            memories = results if isinstance(results, list) else results.get("results", [])
            return [
                {
                    "text": m.get("memory", m.get("text", "")),
                    "score": m.get("score", 0.0),
                    "timestamp": m.get("created_at", ""),
                }
                for m in memories
            ]
        except Exception as e:
            logger.warning(f"[Federation] mem0 recall error: {e}")
            return []

    async def _recall_session_memory(self, query: str, top_k: int) -> List[Dict[str, Any]]:
        """Workspace-level session summary recall adapter."""
        if not self.memory_provider:
            return []
        try:
            loop = asyncio.get_event_loop()
            results = await loop.run_in_executor(
                None,
                lambda: self.memory_provider.search(query, limit=top_k),
            )
            return [
                {
                    "text": item.get("text", ""),
                    "score": item.get("score", 0.0),
                    "timestamp": item.get("timestamp", ""),
                    "title": item.get("title", ""),
                    "summary": item.get("summary", ""),
                    "item_type": item.get("item_type", "session_summary"),
                    "source": item.get("source", ""),
                    "task_id": item.get("task_id", ""),
                    "task_title": item.get("task_title", ""),
                    "status": item.get("status", ""),
                    "event_type": item.get("event_type", ""),
                    "recovery_action": item.get("recovery_action", ""),
                    "failure_category": item.get("failure_category", ""),
                    "failure_label": item.get("failure_label", ""),
                    "attempted_status": item.get("attempted_status", ""),
                    "current_status": item.get("current_status", ""),
                    "ignored_count": item.get("ignored_count", 0),
                    "ignored_at": item.get("ignored_at", ""),
                    "post_cancel_error": item.get("post_cancel_error", ""),
                    "terminal_reason": item.get("terminal_reason", ""),
                    "interrupted_reason": item.get("interrupted_reason", ""),
                    "interrupted_origin": item.get("interrupted_origin", ""),
                    "interrupted_at": item.get("interrupted_at", ""),
                    "interrupt_count": item.get("interrupt_count", 0),
                    "last_active_status": item.get("last_active_status", ""),
                    "last_active_at": item.get("last_active_at", ""),
                    "last_active_progress": item.get("last_active_progress"),
                    "last_error": item.get("last_error", ""),
                    "result_preview": item.get("result_preview", ""),
                }
                for item in results
            ]
        except Exception as e:
            logger.warning(f"[Federation] session memory recall error: {e}")
            return []

    async def _recall_workspace_decisions(
        self, query: str, top_k: int
    ) -> List[Dict[str, Any]]:
        """Workspace decision-log recall adapter."""
        if not self.memory_provider:
            return []

        try:
            workspace_dir = str(getattr(self.memory_provider, "workspace_dir", "") or "")
            if not workspace_dir:
                return []

            loop = asyncio.get_event_loop()
            raw_items = await loop.run_in_executor(
                None,
                lambda: list_workspace_decisions(workspace_dir, count=max(top_k * 6, 24)),
            )
            normalized_query = str(query or "").strip().lower()
            if not normalized_query:
                return []

            tokens = [token for token in re.split(r"\s+", normalized_query) if token]
            results = []
            for item in raw_items:
                text_parts = [
                    str(item.get("message") or ""),
                    str(item.get("description") or ""),
                    str(item.get("file_path") or ""),
                    str(item.get("tool_name") or ""),
                    str(item.get("action") or ""),
                    str(item.get("source") or ""),
                ]
                combined = " | ".join(part for part in text_parts if part).strip()
                if not combined:
                    continue

                haystack = combined.lower()
                score = 0.0
                if normalized_query in haystack:
                    score += 1.0
                for token in tokens:
                    if token in haystack:
                        score += 0.25

                if score <= 0:
                    continue

                results.append(
                    {
                        "text": combined,
                        "score": round(score, 4),
                        "timestamp": item.get("timestamp", ""),
                        "title": item.get("message", ""),
                        "summary": item.get("description", ""),
                        "item_type": "workspace_decision",
                        "source": item.get("source", ""),
                        "action": item.get("action", ""),
                        "tool_name": item.get("tool_name", ""),
                        "file_path": item.get("file_path", ""),
                        "checkpoint_id": item.get("checkpoint_id", ""),
                        "message": item.get("message", ""),
                        "description": item.get("description", ""),
                    }
                )

            results.sort(key=lambda item: item.get("score", 0), reverse=True)
            return results[:top_k]
        except Exception as e:
            logger.warning(f"[Federation] workspace decision recall error: {e}")
            return []

    # ═══════════════════════════════════════════
    # 去重融合
    # ═══════════════════════════════════════════

    @staticmethod
    def dedup_merge(
        memories: List[Dict[str, Any]],
        similarity_threshold: float = 0.85,
    ) -> List[Dict[str, Any]]:
        """
        跨源去重融合。

        使用文本内容的哈希指纹进行快速去重，
        保留得分最高的记忆条目。

        Args:
            memories: 待去重的记忆列表
            similarity_threshold: 相似性阈值（预留，当前使用精确哈希）

        Returns:
            去重后的记忆列表，按得分降序排列
        """
        if not memories:
            return []

        seen_hashes = {}
        deduped = []

        for mem in memories:
            text = mem.get("text", "").strip()
            if not text:
                continue

            # 生成内容指纹
            content_hash = hashlib.md5(text.encode("utf-8")).hexdigest()

            if content_hash in seen_hashes:
                # 如果已存在，保留得分更高的
                existing_idx = seen_hashes[content_hash]
                if mem.get("score", 0) > deduped[existing_idx].get("score", 0):
                    deduped[existing_idx] = mem
            else:
                seen_hashes[content_hash] = len(deduped)
                deduped.append(mem)

        # 按得分降序排列
        deduped.sort(key=lambda m: m.get("score", 0), reverse=True)
        return deduped

    async def close(self):
        """释放所有连接资源。"""
        if self.hindsight:
            await self.hindsight.close()
