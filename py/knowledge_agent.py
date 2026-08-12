#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
Unified knowledge query engine and knowledge agent.

Integrates three knowledge layers (Vector KB, NeuroSymbol, Temporal KG)
behind a single query interface. Provides a knowledge agent that uses
the unified query to build context-aware knowledge responses.

Author: Claude Code
Department: R&D
Date: 2026-04-19
Version: 1.0.0
Security Level: INTERNAL
"""

__version__ = "1.0.0"
__author__ = "Claude Code"
__copyright__ = "Copyright 2026 Synapxnet"
__maintainer__ = "Claude Code"
__email__ = "synapxnet@gmail.com"

import asyncio
import logging
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import Any, Dict, List, Optional

logger = logging.getLogger("app")

_executor = ThreadPoolExecutor(max_workers=2)


class UnifiedKnowledgeEngine:
    """Queries all three knowledge layers and merges results."""

    def __init__(
        self,
        *,
        vector_kb_query=None,
        symbol_store=None,
        temporal_kg=None,
        settings_loader=None,
    ):
        self._vector_kb_query = vector_kb_query
        self._symbol_store = symbol_store
        self._temporal_kg = temporal_kg
        self._settings_loader = settings_loader

    async def query(
        self,
        text: str,
        *,
        sources: Optional[List[str]] = None,
        top_k: int = 5,
        entities: Optional[List[str]] = None,
        as_of: Optional[str] = None,
    ) -> Dict[str, Any]:
        start = time.monotonic()
        normalized = (text or "").strip()
        if not normalized:
            return {"results": [], "sources_queried": [], "elapsed_ms": 0}

        all_sources = sources or ["vector_kb", "neuro_symbol", "temporal_kg"]
        tasks = []
        source_names = []

        if "vector_kb" in all_sources and self._vector_kb_query:
            tasks.append(self._query_vector_kb(normalized, top_k))
            source_names.append("vector_kb")

        if "neuro_symbol" in all_sources and self._symbol_store:
            tasks.append(self._query_neuro_symbol(normalized, top_k, entities))
            source_names.append("neuro_symbol")

        if "temporal_kg" in all_sources and self._temporal_kg:
            tasks.append(self._query_temporal_kg(normalized, top_k, entities, as_of))
            source_names.append("temporal_kg")

        if not tasks:
            return {"results": [], "sources_queried": [], "elapsed_ms": 0}

        raw_results = await asyncio.gather(*tasks, return_exceptions=True)

        merged = []
        sources_queried = []
        for i, result in enumerate(raw_results):
            source = source_names[i] if i < len(source_names) else "unknown"
            if isinstance(result, Exception):
                logger.warning(f"[KnowledgeAgent] {source} query failed: {result}")
                continue
            if isinstance(result, list):
                for item in result:
                    if isinstance(item, dict):
                        item["_source"] = source
                        merged.append(item)
                sources_queried.append(source)

        merged.sort(key=lambda x: x.get("_score", 0), reverse=True)

        elapsed_ms = round((time.monotonic() - start) * 1000, 1)
        return {
            "results": merged[:top_k * 2],
            "sources_queried": sources_queried,
            "total_count": len(merged),
            "elapsed_ms": elapsed_ms,
        }

    async def get_context_for_prompt(
        self,
        text: str,
        *,
        max_tokens: int = 800,
        top_k: int = 3,
    ) -> str:
        result = await self.query(text, top_k=top_k)
        items = result.get("results", [])
        if not items:
            return ""

        parts = []
        total_len = 0
        for item in items:
            source = item.get("_source", "")
            content = item.get("content", "") or item.get("summary", "") or item.get("text", "")
            title = item.get("title", "") or item.get("label", "")
            if not content:
                continue
            line = f"[{source}] {title}: {content}" if title else f"[{source}] {content}"
            if total_len + len(line) > max_tokens * 4:
                break
            parts.append(line)
            total_len += len(line)

        if not parts:
            return ""
        return "<openxnet-knowledge-context>\n" + "\n".join(parts) + "\n</openxnet-knowledge-context>"

    async def get_overview(self) -> Dict[str, Any]:
        overview = {
            "layers": [],
            "total_entries": 0,
        }

        if self._vector_kb_query:
            overview["layers"].append({
                "name": "vector_kb",
                "type": "Vector Knowledge Base (FAISS + BM25)",
                "available": True,
            })

        if self._symbol_store:
            try:
                count = len(self._symbol_store.symbols) if hasattr(self._symbol_store, "symbols") else 0
                overview["layers"].append({
                    "name": "neuro_symbol",
                    "type": "NeuroSymbol Cognitive Store",
                    "available": True,
                    "entry_count": count,
                })
                overview["total_entries"] += count
            except Exception:
                overview["layers"].append({
                    "name": "neuro_symbol",
                    "type": "NeuroSymbol Cognitive Store",
                    "available": False,
                })

        if self._temporal_kg:
            try:
                stats = self._temporal_kg.stats() if hasattr(self._temporal_kg, "stats") else {}
                entity_count = stats.get("entities", 0)
                triple_count = stats.get("triples", 0)
                overview["layers"].append({
                    "name": "temporal_kg",
                    "type": "Temporal Knowledge Graph (SQLite)",
                    "available": True,
                    "entity_count": entity_count,
                    "triple_count": triple_count,
                })
                overview["total_entries"] += entity_count + triple_count
            except Exception:
                overview["layers"].append({
                    "name": "temporal_kg",
                    "type": "Temporal Knowledge Graph (SQLite)",
                    "available": False,
                })

        return overview

    async def _query_vector_kb(self, text: str, top_k: int) -> List[Dict[str, Any]]:
        loop = asyncio.get_running_loop()
        try:
            results = await loop.run_in_executor(
                _executor,
                lambda: self._vector_kb_query(text, top_k=top_k),
            )
            if isinstance(results, list):
                return [
                    {
                        "content": getattr(doc, "page_content", str(doc)),
                        "title": getattr(doc, "metadata", {}).get("file_name", ""),
                        "file_path": getattr(doc, "metadata", {}).get("file_path", ""),
                        "_score": getattr(doc, "metadata", {}).get("score", 0.5),
                        "type": "document_chunk",
                    }
                    for doc in results
                ]
            return []
        except Exception as exc:
            logger.debug(f"[KnowledgeAgent] Vector KB query error: {exc}")
            return []

    async def _query_neuro_symbol(
        self, text: str, top_k: int, entities: Optional[List[str]]
    ) -> List[Dict[str, Any]]:
        loop = asyncio.get_running_loop()
        try:
            results = await loop.run_in_executor(
                _executor,
                lambda: self._symbol_store.match(
                    text=text,
                    entities=entities or [],
                    top_k=top_k,
                ),
            )
            if isinstance(results, list):
                return [
                    {
                        "title": getattr(sym, "label", "") if hasattr(sym, "label") else sym.get("label", ""),
                        "content": str(getattr(sym, "Q", {}) if hasattr(sym, "Q") else sym.get("Q", {})),
                        "operator": getattr(sym, "operator", "") if hasattr(sym, "operator") else sym.get("operator", ""),
                        "_score": sym.get("_score", 0) if isinstance(sym, dict) else getattr(sym, "_score", 0),
                        "type": "neuro_symbol",
                    }
                    for sym in results
                ]
            return []
        except Exception as exc:
            logger.debug(f"[KnowledgeAgent] NeuroSymbol query error: {exc}")
            return []

    async def _query_temporal_kg(
        self, text: str, top_k: int, entities: Optional[List[str]], as_of: Optional[str]
    ) -> List[Dict[str, Any]]:
        loop = asyncio.get_running_loop()
        try:
            target_entities = entities or []
            if not target_entities:
                words = text.split()
                target_entities = [w for w in words if len(w) > 2 and w[0].isupper()][:3]

            results = []
            for entity_name in target_entities[:5]:
                try:
                    triples = await loop.run_in_executor(
                        _executor,
                        lambda name=entity_name: self._temporal_kg.query_entity(
                            name, as_of=as_of, limit=top_k
                        ),
                    )
                    if isinstance(triples, list):
                        for triple in triples:
                            subj = triple.get("subject", "") if isinstance(triple, dict) else ""
                            pred = triple.get("predicate", "") if isinstance(triple, dict) else ""
                            obj = triple.get("object", "") if isinstance(triple, dict) else ""
                            results.append({
                                "title": f"{subj} → {pred} → {obj}",
                                "content": f"{subj} {pred} {obj}",
                                "subject": subj,
                                "predicate": pred,
                                "object": obj,
                                "valid_from": triple.get("valid_from", "") if isinstance(triple, dict) else "",
                                "_score": 0.4,
                                "type": "kg_triple",
                            })
                except Exception:
                    pass
            return results[:top_k]
        except Exception as exc:
            logger.debug(f"[KnowledgeAgent] Temporal KG query error: {exc}")
            return []


_engine_instance: Optional[UnifiedKnowledgeEngine] = None


def get_knowledge_engine() -> Optional[UnifiedKnowledgeEngine]:
    return _engine_instance


def set_knowledge_engine(engine: UnifiedKnowledgeEngine) -> None:
    global _engine_instance
    _engine_instance = engine


async def init_knowledge_engine(
    *,
    vector_kb_query=None,
    symbol_store=None,
    temporal_kg=None,
    settings_loader=None,
) -> UnifiedKnowledgeEngine:
    engine = UnifiedKnowledgeEngine(
        vector_kb_query=vector_kb_query,
        symbol_store=symbol_store,
        temporal_kg=temporal_kg,
        settings_loader=settings_loader,
    )
    set_knowledge_engine(engine)
    return engine
