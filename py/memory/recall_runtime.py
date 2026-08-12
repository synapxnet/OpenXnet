# -*- coding: utf-8 -*-
"""为 Desktop Recall Center 提供不依赖 HTTP 框架的本地运行时。"""

from __future__ import annotations

import asyncio
from collections.abc import Mapping
from pathlib import Path
import re
from typing import Any

from py.engine.checkpoint import EngineCheckpoint
from py.git_shadow import (
    git_list_checkpoints,
    list_workspace_decisions,
    rollback_workspace_checkpoint,
)
from py.memory.observation_store import get_observation_store
from py.memory.provider import get_workspace_memory_provider
from py.neuro_temporal_kg import TemporalKnowledgeGraph


EMPTY_MEMORY_STATS = {
    "session_count": 0,
    "task_event_count": 0,
    "entry_count": 0,
    "observation_count": 0,
    "topic_count": 0,
    "workflow_count": 0,
    "interaction_count": 0,
    "task_memory_count": 0,
}


class RecallRuntimeService:
    """读取应用数据和工作区记忆，并执行受限的检查点恢复操作。"""

    def __init__(self, storage_root: Path) -> None:
        """创建运行时；输入应用数据根目录，不提前打开数据库或工作区。"""

        self._storage_root = storage_root.expanduser().resolve()
        self._checkpoint: EngineCheckpoint | None = None
        self._temporal_kg: TemporalKnowledgeGraph | None = None

    async def bootstrap(
        self,
        workspace_directory: str,
        provider_name: str = "",
    ) -> dict[str, Any]:
        """读取 Recall 首屏聚合；输入内部工作区作用域，返回六类有界数据。"""

        workspace = self._resolve_workspace(workspace_directory, required=False)
        interrupted = self._get_checkpoint().get_interrupted_turns()
        turns = self._get_checkpoint().get_recent_turns(limit=20)
        checkpoints: list[dict[str, Any]] = []
        decisions: list[dict[str, Any]] = []
        if workspace:
            checkpoints = self._sanitize_checkpoints(
                await git_list_checkpoints(workspace, count=30)
            )
            decisions = self._sanitize_decisions(
                await asyncio.to_thread(list_workspace_decisions, workspace, 30)
            )
        return {
            "interrupted": interrupted[:20],
            "turns": turns[:20],
            "checkpoints": checkpoints,
            "decisions": decisions,
            "versions": self._get_versions(),
            "overview": await self.overview(workspace, provider_name, limit=8),
        }

    async def search(
        self,
        workspace_directory: str,
        provider_name: str,
        query: str,
        top_k: int,
        origin: str = "",
    ) -> dict[str, Any]:
        """搜索工作区记忆；输入查询、数量和来源，返回去重后的联邦结果。"""

        workspace = self._resolve_workspace(workspace_directory, required=False)
        if not workspace:
            return {"query": query, "results": [], "count": 0, "sources": []}
        observation_store, memory_provider = await self._get_workspace_sources(
            workspace,
            provider_name,
        )
        sqlite_results: list[dict[str, Any]] = []
        if observation_store is not None:
            try:
                sqlite_results = await observation_store.search_fts(
                    query,
                    limit=top_k,
                    origin=origin,
                )
            except Exception:
                sqlite_results = []

        provider_results = await asyncio.to_thread(memory_provider.search, query, top_k)
        session_results = self._normalize_provider_results(provider_results)
        decision_results = await asyncio.to_thread(
            self._search_workspace_decisions,
            workspace,
            query,
            top_k,
        )

        seen_digests: set[str] = set()
        merged: list[dict[str, Any]] = []
        for item in [*sqlite_results, *session_results, *decision_results]:
            digest = str(item.get("digest") or "").strip()
            if digest and digest in seen_digests:
                continue
            if digest:
                seen_digests.add(digest)
            merged.append(item)
            if len(merged) >= top_k:
                break
        sources = sorted(
            {
                str(item.get("_source") or "").strip()
                for item in merged
                if str(item.get("_source") or "").strip()
            }
        )
        return {
            "query": query,
            "results": merged,
            "count": len(merged),
            "sources": sources,
        }

    def _normalize_provider_results(self, values: Any) -> list[dict[str, Any]]:
        """规范化 Session Provider 结果；输入底层记录，返回标注本地来源的公开列表。"""

        if not isinstance(values, list):
            return []
        results: list[dict[str, Any]] = []
        for item in values:
            if not isinstance(item, Mapping):
                continue
            normalized = dict(item)
            normalized["_source"] = "session_memory"
            if not str(normalized.get("text") or "").strip():
                normalized["text"] = str(
                    normalized.get("summary") or normalized.get("title") or ""
                ).strip()
            results.append(normalized)
        return results

    def _search_workspace_decisions(
        self,
        workspace: str,
        query: str,
        top_k: int,
    ) -> list[dict[str, Any]]:
        """搜索决策日志；输入工作区、查询和数量，返回按文本匹配分数排序的记录。"""

        normalized_query = query.strip().lower()
        tokens = [token for token in re.split(r"\s+", normalized_query) if token]
        results: list[dict[str, Any]] = []
        for item in list_workspace_decisions(workspace, count=max(top_k * 6, 24)):
            if not isinstance(item, Mapping):
                continue
            combined = " | ".join(
                str(item.get(field) or "").strip()
                for field in ("message", "description", "file_path", "tool_name", "action", "source")
                if str(item.get(field) or "").strip()
            )
            haystack = combined.lower()
            score = 1.0 if normalized_query and normalized_query in haystack else 0.0
            score += sum(0.25 for token in tokens if token in haystack)
            if not combined or score <= 0:
                continue
            results.append(
                {
                    **{
                        str(key): value
                        for key, value in item.items()
                        if str(key) not in {"workspace", "workspace_key", "snapshot_path"}
                    },
                    "text": combined,
                    "score": round(score, 4),
                    "item_type": "workspace_decision",
                    "_source": "workspace_decision",
                }
            )
        results.sort(key=lambda item: float(item.get("score") or 0), reverse=True)
        return results[:top_k]

    async def overview(
        self,
        workspace_directory: str,
        provider_name: str,
        *,
        limit: int,
    ) -> dict[str, Any]:
        """读取工作区概览；输入内部作用域和数量，返回会话、观察、画像与统计。"""

        workspace = self._resolve_workspace(workspace_directory, required=False)
        if not workspace:
            return self._empty_overview()
        observation_store, memory_provider = await self._get_workspace_sources(
            workspace,
            provider_name,
        )
        provider_overview = await asyncio.to_thread(memory_provider.get_overview, limit)
        if observation_store is None:
            return {"workspace": workspace, **provider_overview}
        try:
            overview = await observation_store.get_overview(limit=limit)
        except Exception:
            return {"workspace": workspace, **provider_overview}
        overview["user_profile"] = provider_overview.get("user_profile", {})
        return {"workspace": workspace, **overview}

    async def timeline(
        self,
        workspace_directory: str,
        provider_name: str,
        *,
        query: str,
        task_id: str,
        session_id: str,
        digest: str,
        depth_before: int,
        depth_after: int,
        limit: int,
        origin: str,
    ) -> dict[str, Any]:
        """读取渐进时间线；输入查询或锚点，返回锚点窗口或最近记录。"""

        workspace = self._resolve_workspace(workspace_directory, required=False)
        anchor_requested = bool(task_id or session_id or digest)
        mode = "anchor" if anchor_requested else ("query" if query else "recent")
        if not workspace:
            return self._empty_timeline(query, mode, task_id, session_id, digest)
        observation_store, memory_provider = await self._get_workspace_sources(
            workspace,
            provider_name,
        )
        if observation_store is not None:
            try:
                if anchor_requested:
                    anchor_payload = await observation_store.get_timeline_window(
                        task_id=task_id,
                        session_id=session_id,
                        digest=digest,
                        query=query,
                        depth_before=depth_before,
                        depth_after=depth_after,
                    )
                    timeline = anchor_payload.get("timeline", [])
                    anchor = anchor_payload.get("anchor", {})
                else:
                    timeline = await observation_store.get_timeline(
                        query=query,
                        limit=limit,
                        origin=origin,
                    )
                    anchor = {}
                return self._timeline_result(
                    workspace,
                    query,
                    mode,
                    anchor,
                    depth_before,
                    depth_after,
                    timeline,
                )
            except Exception:
                pass

        if anchor_requested:
            anchor_payload = await asyncio.to_thread(
                memory_provider.get_timeline_window,
                task_id=task_id,
                session_id=session_id,
                digest=digest,
                query=query,
                depth_before=depth_before,
                depth_after=depth_after,
            )
            timeline = anchor_payload.get("timeline", [])
            anchor = anchor_payload.get("anchor", {})
        else:
            timeline = await asyncio.to_thread(memory_provider.get_timeline, query, limit)
            anchor = {}
        return self._timeline_result(
            workspace,
            query,
            mode,
            anchor,
            depth_before,
            depth_after,
            timeline,
        )

    async def observations(
        self,
        workspace_directory: str,
        provider_name: str,
        *,
        task_id: str,
        session_id: str,
        digest: str,
        query: str,
        limit: int,
        origin: str,
    ) -> dict[str, Any]:
        """读取观察流；输入至少一个目标字段，返回目标上下文和详细记录。"""

        workspace = self._resolve_workspace(workspace_directory, required=False)
        context = {
            "task_id": task_id,
            "session_id": session_id,
            "digest": digest,
            "query": query,
        }
        if not workspace:
            return {"workspace": "", "context": context, "observations": [], "count": 0}
        observation_store, memory_provider = await self._get_workspace_sources(
            workspace,
            provider_name,
        )
        if observation_store is not None:
            try:
                items = await observation_store.get_observations(
                    task_id=task_id,
                    session_id=session_id,
                    digest=digest,
                    query=query,
                    limit=limit,
                    origin=origin,
                )
                return {
                    "workspace": workspace,
                    "context": context,
                    "observations": items,
                    "count": len(items),
                }
            except Exception:
                pass
        items = await asyncio.to_thread(
            memory_provider.get_observations,
            task_id=task_id,
            session_id=session_id,
            digest=digest,
            query=query,
            limit=limit,
        )
        return {
            "workspace": workspace,
            "context": context,
            "observations": items,
            "count": len(items),
        }

    def resume_interrupted(self, turn_id: str) -> dict[str, Any]:
        """恢复一个中断 turn；输入精确 ID，返回恢复提示并把状态标记为 RESUMED。"""

        checkpoint = self._get_checkpoint()
        resume_payload = checkpoint.get_turn(turn_id)
        if not resume_payload:
            raise LookupError("Recall interrupted turn was not found.")
        resolved_turn = checkpoint.resolve_interrupted_turn(turn_id, final_state="RESUMED")
        return {
            "status": "ok",
            "resume": resume_payload,
            "resume_prompt": resume_payload.get("resume_prompt", ""),
            "turn": resolved_turn or resume_payload,
        }

    async def rollback(self, workspace_directory: str, checkpoint_id: str) -> dict[str, Any]:
        """恢复一个工作区检查点；输入内部工作区和检查点 ID，返回固定成功结果。"""

        workspace = self._resolve_workspace(workspace_directory, required=True)
        result = await rollback_workspace_checkpoint(workspace, checkpoint_id)
        if str(result).startswith("Error:"):
            raise RuntimeError("Recall checkpoint rollback failed.")
        return {"status": "ok", "message": str(result), "checkpoint_id": checkpoint_id}

    async def close(self) -> None:
        """关闭运行时持有的数据库连接；无输入，无返回，不删除任何持久数据。"""

        if self._checkpoint is not None:
            self._checkpoint.close()
            self._checkpoint = None
        if self._temporal_kg is not None:
            self._temporal_kg.close()
            self._temporal_kg = None

    async def _get_workspace_sources(self, workspace: str, provider_name: str) -> tuple[Any, Any]:
        """解析工作区存储；输入可信内部路径和 Provider 名，返回观察与兼容 Provider。"""

        memory_provider = get_workspace_memory_provider(workspace, provider_name)
        try:
            observation_store = await get_observation_store(workspace)
        except Exception:
            observation_store = None
        return observation_store, memory_provider

    def _get_checkpoint(self) -> EngineCheckpoint:
        """延迟打开引擎检查点数据库；无输入，返回可复用存储实例。"""

        if self._checkpoint is None:
            self._checkpoint = EngineCheckpoint(str(self._storage_root / "engine_checkpoints.db"))
        return self._checkpoint

    def _get_versions(self) -> list[dict[str, Any]]:
        """读取时序知识图谱版本；无输入，数据库不存在或读取失败时返回空列表。"""

        database_path = self._storage_root / "knowledge_graph.db"
        if not database_path.is_file():
            return []
        try:
            if self._temporal_kg is None:
                self._temporal_kg = TemporalKnowledgeGraph(str(database_path))
            return self._temporal_kg.get_versions()[:100]
        except Exception:
            return []

    def _resolve_workspace(self, value: str, *, required: bool) -> str:
        """校验内部工作区路径；输入路径和必需标记，返回真实目录或空字符串。"""

        normalized = str(value or "").strip()
        if not normalized:
            if required:
                raise ValueError("Recall workspace is not configured.")
            return ""
        if len(normalized) > 32_767 or "\x00" in normalized:
            raise ValueError("Recall workspace path is invalid.")
        try:
            workspace = Path(normalized).expanduser().resolve(strict=True)
        except (OSError, RuntimeError) as error:
            raise ValueError("Recall workspace is unavailable.") from error
        if not workspace.is_dir():
            raise ValueError("Recall workspace is not a directory.")
        return str(workspace)

    def _sanitize_checkpoints(self, values: Any) -> list[dict[str, Any]]:
        """清理检查点列表；输入底层记录，返回不含内部快照路径的最多 30 条结果。"""

        if not isinstance(values, list):
            return []
        allowed_fields = {
            "id",
            "source",
            "hash",
            "full_hash",
            "message",
            "description",
            "timestamp",
            "tool_name",
            "file_path",
            "existed_before_edit",
            "rollback_supported",
        }
        return [
            {key: item[key] for key in allowed_fields if key in item}
            for item in values[:30]
            if isinstance(item, Mapping)
        ]

    def _sanitize_decisions(self, values: Any) -> list[dict[str, Any]]:
        """清理决策日志；输入底层记录，返回不含工作区绝对路径的最多 30 条结果。"""

        if not isinstance(values, list):
            return []
        blocked_fields = {"workspace", "workspace_key", "snapshot_path"}
        return [
            {str(key): value for key, value in item.items() if str(key) not in blocked_fields}
            for item in values[:30]
            if isinstance(item, Mapping)
        ]

    def _empty_overview(self) -> dict[str, Any]:
        """构造空工作区概览；无输入，返回稳定的首屏默认结构。"""

        return {
            "workspace": "",
            "recent_sessions": [],
            "recent_observations": [],
            "user_profile": {},
            "stats": dict(EMPTY_MEMORY_STATS),
        }

    def _empty_timeline(
        self,
        query: str,
        mode: str,
        task_id: str,
        session_id: str,
        digest: str,
    ) -> dict[str, Any]:
        """构造空时间线；输入查询、模式和锚点，返回稳定的空结果。"""

        return {
            "workspace": "",
            "query": query,
            "mode": mode,
            "anchor": {
                "task_id": task_id,
                "session_id": session_id,
                "digest": digest,
                "matched": False,
            },
            "depth_before": 0,
            "depth_after": 0,
            "timeline": [],
            "count": 0,
        }

    def _timeline_result(
        self,
        workspace: str,
        query: str,
        mode: str,
        anchor: Any,
        depth_before: int,
        depth_after: int,
        timeline: Any,
    ) -> dict[str, Any]:
        """构造时间线结果；输入已读取数据，返回统一协议结构且不修改来源对象。"""

        normalized_timeline = timeline if isinstance(timeline, list) else []
        return {
            "workspace": workspace,
            "query": query,
            "mode": mode,
            "anchor": dict(anchor) if isinstance(anchor, Mapping) else {},
            "depth_before": depth_before,
            "depth_after": depth_after,
            "timeline": normalized_timeline,
            "count": len(normalized_timeline),
        }
