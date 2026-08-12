#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Compatibility adapter for the process-isolated Vector Worker index."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from py.vector_worker_client import VectorWorkerClient


logger = logging.getLogger("app")


class VectorIndex:
    """Preserve the Kernel vector API while delegating storage and inference."""

    def __init__(self, client: VectorWorkerClient | None = None) -> None:
        """Create an unloaded adapter with a small in-process rebuild cache."""

        self._client = client or VectorWorkerClient.from_environment()
        self._items: list[dict[str, str]] = []
        self._pending_items: list[dict[str, str]] = []
        self._dimension = 384
        self._item_count = 0
        self._ready = False
        self._lock = asyncio.Lock()
        self._build_task: asyncio.Task[int] | None = None

    async def ensure_ready(self) -> bool:
        """Confirm that Worker dependencies and external model assets are available."""

        if self._ready:
            return True
        async with self._lock:
            if self._ready:
                return True
            try:
                status = await self._client.status()
                self._dimension = int(status.get("dimension", self._dimension))
                self._ready = bool(
                    status.get("dependencyAvailable") and status.get("modelAvailable")
                )
                if not self._ready:
                    logger.info("[VectorIndex] Worker dependencies or MiniLM assets unavailable")
                return self._ready
            except Exception as error:
                logger.info("[VectorIndex] Worker unavailable: %s", error)
                return False

    def schedule_build_from_store(self, symbols: list[Any]) -> None:
        """Start one background build on first query without delaying keyword fallback."""

        if self._ready:
            return
        if self._build_task is not None and not self._build_task.done():
            return
        self._build_task = asyncio.create_task(self.build_from_store(symbols))
        self._build_task.add_done_callback(self._consume_build_result)

    async def build_from_store(self, symbols: list[Any]) -> int:
        """Serialize symbol text and atomically replace the Worker index."""

        items = self._serialize_symbols(symbols)
        self._items = [dict(item) for item in items]
        self._pending_items = []
        self._item_count = len(items)
        if not items or not await self.ensure_ready():
            return 0
        try:
            result = await self._client.rebuild(items)
            self._dimension = int(result.get("dimension", self._dimension))
            self._item_count = int(result.get("itemCount", len(items)))
            self._ready = bool(result.get("ready", True))
            await self._flush_pending_items()
            self._item_count = len(self._items)
            logger.info("[VectorIndex] Worker index built with %s items", self._item_count)
            return self._item_count
        except Exception as error:
            self._ready = False
            logger.warning("[VectorIndex] Worker build failed: %s", error)
            return 0

    async def add_item(self, item_id: str, text: str) -> None:
        """Cache and append one symbol when the Worker index is ready."""

        item = {"id": item_id, "text": text}
        self._upsert_item(self._items, item)
        self._item_count = len(self._items)
        if self._build_task is not None and not self._build_task.done():
            self._upsert_item(self._pending_items, item)
            return
        if not self._ready:
            return
        try:
            result = await self._client.add(item_id, text)
            if result.get("added") is not True:
                await self._rebuild_cached_items()
            else:
                self._item_count = int(result.get("itemCount", self._item_count))
        except Exception as error:
            logger.debug("[VectorIndex] Worker add failed: %s", error)

    async def search(self, query: str, top_k: int = 5) -> list[tuple[str, float]]:
        """Search through Worker RPC and rebuild after an idle Worker restart."""

        if not self._ready or self._item_count == 0:
            return []
        try:
            result = await self._client.search(query, top_k)
            if result.get("indexReady") is not True and self._items:
                if not await self._rebuild_cached_items():
                    return []
                result = await self._client.search(query, top_k)
            values = result.get("results", [])
            if not isinstance(values, list):
                return []
            return [
                (str(item["id"]), float(item["score"]))
                for item in values
                if isinstance(item, dict) and "id" in item and "score" in item
            ]
        except Exception as error:
            logger.debug("[VectorIndex] Worker search failed: %s", error)
            return []

    @property
    def item_count(self) -> int:
        """Return the expected item count without synchronous Worker RPC."""

        return self._item_count

    def get_stats(self) -> dict[str, Any]:
        """Return cached diagnostics suitable for the synchronous Kernel API."""

        return {
            "ready": self._ready,
            "configured": self._client.configured,
            "dim": self._dimension,
            "item_count": self.item_count,
            "build_in_progress": self._build_task is not None and not self._build_task.done(),
            "runtime": "vector-worker",
        }

    async def _rebuild_cached_items(self) -> bool:
        """Restore the ephemeral Worker index from the adapter's small text cache."""

        if not self._items:
            return False
        result = await self._client.rebuild(self._items)
        self._ready = bool(result.get("ready", True))
        self._item_count = int(result.get("itemCount", len(self._items)))
        self._dimension = int(result.get("dimension", self._dimension))
        return self._ready

    async def _flush_pending_items(self) -> None:
        """Append symbols learned while the first background rebuild was running."""

        pending_items = self._pending_items
        self._pending_items = []
        for index, item in enumerate(pending_items):
            try:
                result = await self._client.add(item["id"], item["text"])
                if result.get("added") is not True:
                    await self._rebuild_cached_items()
                    return
            except Exception:
                self._pending_items = pending_items[index:] + self._pending_items
                raise

    def _serialize_symbols(self, symbols: list[Any]) -> list[dict[str, str]]:
        """Convert legacy symbol objects into stable Worker index records."""

        items: list[dict[str, str]] = []
        for symbol in symbols:
            entities: list[str] = []
            knowledge = getattr(symbol, "K", None)
            if knowledge is not None:
                entities = [str(value) for value in (getattr(knowledge, "entities", None) or [])]
            label = str(getattr(symbol, "label", "")).strip()
            symbol_id = str(getattr(symbol, "id", "")).strip()
            text = f"{label} {' '.join(entities)}".strip()
            if symbol_id and text:
                items.append({"id": symbol_id, "text": text})
        return items

    def _upsert_item(self, items: list[dict[str, str]], item: dict[str, str]) -> None:
        """Replace a cached identifier or append it while preserving stable order."""

        for index, existing in enumerate(items):
            if existing["id"] == item["id"]:
                items[index] = item
                return
        items.append(item)

    def _consume_build_result(self, task: asyncio.Task[int]) -> None:
        """Consume unexpected task failures so background warmup stays non-fatal."""

        try:
            task.result()
        except Exception as error:
            logger.debug("[VectorIndex] Background build failed: %s", error)
