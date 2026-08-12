# -*- coding: utf-8 -*-
"""Desktop Execution Engine 使用的框架无关知识库运行时。"""

from __future__ import annotations

import asyncio
from collections.abc import Mapping
import json
import logging
from pathlib import Path
import re
import shutil
from typing import Any

from py.get_setting import KB_DIR, load_settings


KNOWLEDGE_BASE_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$")
MAX_KNOWLEDGE_BASE_QUERY_RESULT_BYTES = 1536 * 1024
MAX_KNOWLEDGE_BASE_RESULT_CONTENT_CHARS = 256 * 1024


class KnowledgeBaseRuntimeController:
    """管理 Execution Engine 内的知识库构建、状态、删除与检索。"""

    def __init__(self, root: Path | None = None) -> None:
        """创建知识库控制器；输入可选根目录，无返回，不加载模型或启动 Worker。"""

        self._root = (root or Path(KB_DIR)).resolve()
        self._statuses: dict[str, str] = {}
        self._operation_locks: dict[str, asyncio.Lock] = {}

    async def build(self, knowledge_base_id: str) -> dict[str, Any]:
        """构建一个知识库；输入标识，返回固定状态，失败时记录类型并返回 failed。"""

        normalized_id = self._normalize_id(knowledge_base_id)
        if self._statuses.get(normalized_id) == "processing":
            return self._status_result(normalized_id, "processing")
        async with self._get_operation_lock(normalized_id):
            self._statuses[normalized_id] = "processing"
            try:
                from py.know_base import process_knowledge_base

                await process_knowledge_base(normalized_id)
                self._statuses[normalized_id] = "completed"
            except Exception as error:
                logging.warning(
                    "Knowledge base build failed for '%s': %s",
                    normalized_id,
                    type(error).__name__,
                )
                self._statuses[normalized_id] = "failed"
            return self._status_result(normalized_id, self._statuses[normalized_id])

    async def status(self, knowledge_base_id: str) -> dict[str, Any]:
        """查询一个知识库状态；输入标识，返回稳定状态，不启动模型或 Worker。"""

        normalized_id = self._normalize_id(knowledge_base_id)
        status = self._statuses.get(normalized_id)
        if status is None:
            knowledge_base_path = self._resolve_path(normalized_id)
            has_index = (knowledge_base_path / "index.faiss").is_file()
            has_metadata = any(
                (knowledge_base_path / name).is_file()
                for name in ("index.docs.json", "bm25_index.json", "index.pkl")
            )
            status = "completed" if has_index and has_metadata else "not_found"
        return self._status_result(normalized_id, status)

    async def remove(self, knowledge_base_id: str) -> dict[str, Any]:
        """删除一个知识库索引；输入标识，返回删除结果，文件系统失败时抛出固定 RuntimeError。"""

        normalized_id = self._normalize_id(knowledge_base_id)
        knowledge_base_path = self._resolve_path(normalized_id)
        removed = False
        async with self._get_operation_lock(normalized_id):
            try:
                if knowledge_base_path.exists():
                    if knowledge_base_path.is_symlink() or not knowledge_base_path.is_dir():
                        raise RuntimeError("Knowledge base storage is invalid.")
                    await asyncio.to_thread(shutil.rmtree, knowledge_base_path)
                    removed = True
            except Exception as error:
                logging.warning(
                    "Knowledge base removal failed for '%s': %s",
                    normalized_id,
                    type(error).__name__,
                )
                raise RuntimeError("Knowledge base removal failed.") from error
            self._statuses.pop(normalized_id, None)
        return {
            "schema": "openxnet.knowledge-base-mutation.v1",
            "knowledgeBaseId": normalized_id,
            "success": True,
            "removed": removed,
        }

    async def query(
        self,
        knowledge_base_id: str,
        query: str,
        limit: int,
    ) -> dict[str, Any]:
        """检索一个知识库；输入标识、查询和数量，返回有界脱敏结果，检索失败时抛出固定异常。"""

        normalized_id = self._normalize_id(knowledge_base_id)
        normalized_query = str(query or "").strip()
        normalized_limit = max(1, min(int(limit), 20))
        if not normalized_query or len(normalized_query) > 8_192:
            raise ValueError("Knowledge base query is invalid.")
        async with self._get_operation_lock(normalized_id):
            try:
                from py.know_base import query_knowledge_base, rerank_knowledge_base

                raw_results = await query_knowledge_base(normalized_id, normalized_query)
                if isinstance(raw_results, str):
                    raise RuntimeError("Knowledge base query failed.")
                current_settings = await load_settings()
                kb_settings = (
                    current_settings.get("KBSettings", {})
                    if isinstance(current_settings, Mapping)
                    else {}
                )
                if isinstance(kb_settings, Mapping) and kb_settings.get("is_rerank"):
                    try:
                        raw_results = await rerank_knowledge_base(normalized_query, raw_results)
                    except Exception as error:
                        logging.warning("Knowledge base rerank failed: %s", type(error).__name__)
                results = self._normalize_results(normalized_id, raw_results, normalized_limit)
            except Exception as error:
                logging.warning(
                    "Knowledge base query failed for '%s': %s",
                    normalized_id,
                    type(error).__name__,
                )
                raise RuntimeError("Knowledge base query failed.") from error
        return {
            "schema": "openxnet.knowledge-base-query.v1",
            "knowledgeBaseId": normalized_id,
            "query": normalized_query,
            "count": len(results),
            "results": results,
        }

    def _normalize_results(
        self,
        knowledge_base_id: str,
        value: Any,
        limit: int,
    ) -> list[dict[str, Any]]:
        """规范检索结果；输入标识、未知结果和数量，返回有界列表，自动删除本机路径。"""

        if not isinstance(value, list):
            raise ValueError("Knowledge base results are invalid.")
        normalized: list[dict[str, Any]] = []
        total_bytes = 0
        for index, item in enumerate(value[:limit]):
            if not isinstance(item, Mapping):
                continue
            raw_metadata = item.get("metadata", {})
            metadata = self._sanitize_metadata(raw_metadata if isinstance(raw_metadata, Mapping) else {})
            content = str(item.get("content", ""))[:MAX_KNOWLEDGE_BASE_RESULT_CONTENT_CHARS]
            summary = re.sub(r"\s+", " ", content).strip()
            result = {
                "id": f"{knowledge_base_id}:{index}",
                "content": content,
                "summary": summary[:360] + ("..." if len(summary) > 360 else ""),
                "fileName": str(metadata.get("file_name", "")),
                "metadata": metadata,
            }
            result_bytes = len(json.dumps(result, ensure_ascii=False).encode("utf-8"))
            if total_bytes + result_bytes > MAX_KNOWLEDGE_BASE_QUERY_RESULT_BYTES:
                break
            total_bytes += result_bytes
            normalized.append(result)
        return normalized

    def _get_operation_lock(self, knowledge_base_id: str) -> asyncio.Lock:
        """获取 scope 独立操作锁；输入知识库标识，返回可复用锁，仅修改进程内锁表。"""

        lock = self._operation_locks.get(knowledge_base_id)
        if lock is None:
            lock = asyncio.Lock()
            self._operation_locks[knowledge_base_id] = lock
        return lock

    def _sanitize_metadata(self, metadata: Mapping[str, Any]) -> dict[str, Any]:
        """脱敏文档元数据；输入映射，返回 JSON 安全字典，路径字段仅保留文件名。"""

        sanitized: dict[str, Any] = {}
        for raw_name, raw_value in metadata.items():
            name = str(raw_name)[:128]
            if any(marker in name.lower() for marker in ("path", "source", "directory")):
                sanitized[name] = Path(str(raw_value or "")).name[:512]
                continue
            if raw_value is None or isinstance(raw_value, (bool, int, float, str)):
                sanitized[name] = raw_value if not isinstance(raw_value, str) else raw_value[:8_192]
        return sanitized

    def _resolve_path(self, knowledge_base_id: str) -> Path:
        """解析知识库目录；输入已校验标识，返回根目录内路径，越界时抛出 ValueError。"""

        candidate = (self._root / knowledge_base_id).resolve()
        try:
            candidate.relative_to(self._root)
        except ValueError as error:
            raise ValueError("Knowledge base path is invalid.") from error
        return candidate

    def _normalize_id(self, value: str) -> str:
        """校验知识库标识；输入文本，返回原标识，空白、控制字符或超长时抛出 ValueError。"""

        if not isinstance(value, str) or KNOWLEDGE_BASE_ID_PATTERN.fullmatch(value) is None:
            raise ValueError("Knowledge base identifier is invalid.")
        return value

    def _status_result(self, knowledge_base_id: str, status: str) -> dict[str, Any]:
        """构建状态响应；输入标识和状态，返回固定 schema 字典，无副作用。"""

        return {
            "schema": "openxnet.knowledge-base-status.v1",
            "knowledgeBaseId": knowledge_base_id,
            "status": status,
        }
