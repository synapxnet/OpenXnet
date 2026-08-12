#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
Memory recall routes extracted from the monolithic server module.

This module hosts the Recall Center search, timeline, observations, and
overview endpoints. When an ObservationStore (SQLite+FTS5) is available
for the workspace, queries are delegated to it for indexed search; otherwise
the legacy JSON-file-based SessionMemoryStore is used as fallback.

Author: OpenAI Codex
Department: R&D
Date: 2026-04-16
Version: 1.1.0
Security Level: INTERNAL
"""

__version__ = "1.1.0"
__author__ = "OpenAI Codex"
__copyright__ = "Copyright 2026 Synapxnet"
__maintainer__ = "OpenAI Codex"
__email__ = "synapxnet@gmail.com"

# Modification History:
# 2026-04-16, v1.0.0, OpenAI Codex: Initial creation.
# 2026-04-19, v1.1.0, Claude Code: Add ObservationStore delegation and origin filter.

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from py.get_setting import load_settings
from py.memory.federation import MemoryFederation
from py.memory.observation_store import get_observation_store
from py.memory.provider import (
    get_workspace_memory_provider,
    resolve_memory_provider_name,
)

router = APIRouter(tags=["memory"])

memory_federation_provider = None
memory_federation_setter = None
symbol_store_provider = None


def configure_memory_routes(
    *,
    memory_federation_ref,
    memory_federation_setter_ref,
    symbol_store_ref,
) -> None:
    """Bind Recall Center providers from server.py into this route module."""
    global memory_federation_provider, memory_federation_setter, symbol_store_provider
    memory_federation_provider = memory_federation_ref
    memory_federation_setter = memory_federation_setter_ref
    symbol_store_provider = symbol_store_ref


def _resolve(provider):
    return provider() if callable(provider) else provider


async def _get_workspace_dir() -> str:
    try:
        settings = await load_settings()
    except Exception:
        return ""
    return settings.get("CLISettings", {}).get("cc_path", "") or ""


async def _get_memory_provider():
    try:
        settings = await load_settings()
    except Exception:
        return "", None
    workspace_dir = settings.get("CLISettings", {}).get("cc_path", "") or ""
    if not workspace_dir:
        return "", None
    provider_name = resolve_memory_provider_name(settings)
    return workspace_dir, get_workspace_memory_provider(workspace_dir, provider_name)


async def _get_obs_store():
    workspace_dir = await _get_workspace_dir()
    if not workspace_dir:
        return "", None
    try:
        store = await get_observation_store(workspace_dir)
        return workspace_dir, store
    except Exception:
        return workspace_dir, None


@router.get("/v1/memory/recall")
async def memory_recall(
    query: str = Query(..., min_length=1, description="Recall Center memory search query"),
    top_k: int = Query(8, ge=1, le=20, description="Max memory results"),
    origin: str = Query("", description="Filter by origin: 'auto', 'manual', or '' for both"),
):
    """[v0.6.0] Recall Center unified memory search with FTS5 support."""
    try:
        normalized_query = (query or "").strip()
        if not normalized_query:
            return JSONResponse(status_code=400, content={"error": "query is required"})

        workspace_dir, obs_store = await _get_obs_store()
        sqlite_results = []
        if obs_store:
            try:
                sqlite_results = await obs_store.search_fts(
                    normalized_query, limit=top_k, origin=origin.strip()
                )
            except Exception:
                pass

        _, memory_provider = await _get_memory_provider()
        memory_federation = _resolve(memory_federation_provider)
        symbol_store = _resolve(symbol_store_provider)
        if memory_federation is None:
            memory_federation = MemoryFederation(
                symbol_store=symbol_store,
                memory_provider=memory_provider,
            )
            if memory_federation_setter:
                memory_federation_setter(memory_federation)
        elif memory_provider:
            memory_federation.memory_provider = memory_provider

        federation_results = await memory_federation.federated_recall(
            normalized_query,
            top_k=top_k,
            include_sources=True,
        )

        seen_digests = set()
        merged = []
        for item in sqlite_results:
            digest = item.get("digest", "")
            if digest:
                seen_digests.add(digest)
            merged.append(item)
        for item in federation_results:
            digest = item.get("digest", "")
            if digest and digest in seen_digests:
                continue
            if digest:
                seen_digests.add(digest)
            merged.append(item)
        results = merged[:top_k]

        sources = sorted({
            item.get("_source", "unknown")
            for item in results
            if item.get("_source")
        })
        return JSONResponse(content={
            "query": normalized_query,
            "results": results,
            "count": len(results),
            "sources": sources,
        })
    except Exception as exc:
        return JSONResponse(status_code=500, content={"error": str(exc)})


@router.get("/v1/memory/overview")
async def memory_overview(
    limit: int = Query(8, ge=1, le=20, description="Max recent session summaries"),
):
    """Return Recall Center metadata for recent session summaries and user profile."""
    try:
        workspace_dir, obs_store = await _get_obs_store()

        if obs_store:
            try:
                overview = await obs_store.get_overview(limit=limit)
                _, memory_provider = await _get_memory_provider()
                if memory_provider:
                    try:
                        profile = memory_provider._read_json(
                            memory_provider.profile_file, default={}
                        )
                        overview["user_profile"] = profile
                    except Exception:
                        pass
                return JSONResponse(content={"workspace": workspace_dir, **overview})
            except Exception:
                pass

        _, store = await _get_memory_provider()
        if not workspace_dir or store is None:
            return JSONResponse(
                content={
                    "workspace": "",
                    "recent_sessions": [],
                    "recent_observations": [],
                    "user_profile": {},
                    "stats": {
                        "session_count": 0,
                        "task_event_count": 0,
                        "entry_count": 0,
                        "observation_count": 0,
                        "topic_count": 0,
                        "workflow_count": 0,
                        "interaction_count": 0,
                        "task_memory_count": 0,
                    },
                    "message": "No workspace configured",
                }
            )

        overview = store.get_overview(limit=limit)
        return JSONResponse(content={"workspace": workspace_dir, **overview})
    except Exception as exc:
        return JSONResponse(status_code=500, content={"error": str(exc)})


@router.get("/v1/memory/timeline")
async def memory_timeline(
    query: str = Query("", description="Optional progressive recall timeline query"),
    task_id: str = Query("", description="Task identifier for anchored timeline lookup"),
    session_id: str = Query("", description="Session identifier for anchored timeline lookup"),
    digest: str = Query("", description="Digest identifier for anchored timeline lookup"),
    depth_before: int = Query(3, ge=0, le=20, description="Items before anchor"),
    depth_after: int = Query(4, ge=0, le=20, description="Items after anchor"),
    limit: int = Query(18, ge=1, le=80, description="Max timeline items"),
    origin: str = Query("", description="Filter by origin: 'auto', 'manual', or '' for both"),
):
    """Return progressive recall timeline entries for the active workspace."""
    try:
        normalized_query = (query or "").strip()
        normalized_task_id = (task_id or "").strip()
        normalized_session_id = (session_id or "").strip()
        normalized_digest = (digest or "").strip()
        anchor_requested = any([normalized_task_id, normalized_session_id, normalized_digest])

        workspace_dir, obs_store = await _get_obs_store()

        if obs_store:
            try:
                if anchor_requested:
                    anchor_payload = await obs_store.get_timeline_window(
                        task_id=normalized_task_id,
                        session_id=normalized_session_id,
                        digest=normalized_digest,
                        query=normalized_query,
                        depth_before=depth_before,
                        depth_after=depth_after,
                    )
                    timeline = anchor_payload.get("timeline", [])
                    return JSONResponse(
                        content={
                            "workspace": workspace_dir,
                            "query": normalized_query,
                            "mode": "anchor",
                            "anchor": anchor_payload.get("anchor", {}),
                            "depth_before": depth_before,
                            "depth_after": depth_after,
                            "timeline": timeline,
                            "count": len(timeline),
                        }
                    )
                else:
                    timeline = await obs_store.get_timeline(
                        query=normalized_query,
                        limit=limit,
                        origin=origin.strip(),
                    )
                    return JSONResponse(
                        content={
                            "workspace": workspace_dir,
                            "query": normalized_query,
                            "mode": "query" if normalized_query else "recent",
                            "anchor": {},
                            "depth_before": depth_before,
                            "depth_after": depth_after,
                            "timeline": timeline,
                            "count": len(timeline),
                        }
                    )
            except Exception:
                pass

        _, store = await _get_memory_provider()
        if not workspace_dir or store is None:
            return JSONResponse(
                content={
                    "workspace": "",
                    "query": normalized_query,
                    "mode": "anchor" if anchor_requested else ("query" if normalized_query else "recent"),
                    "anchor": {
                        "task_id": normalized_task_id,
                        "session_id": normalized_session_id,
                        "digest": normalized_digest,
                        "matched": False,
                    },
                    "timeline": [],
                    "count": 0,
                    "message": "No workspace configured",
                }
            )

        anchor_payload = None
        if anchor_requested:
            anchor_payload = store.get_timeline_window(
                task_id=normalized_task_id,
                session_id=normalized_session_id,
                digest=normalized_digest,
                query=normalized_query,
                depth_before=depth_before,
                depth_after=depth_after,
            )
            timeline = anchor_payload.get("timeline", [])
        else:
            timeline = store.get_timeline(query=normalized_query, limit=limit)
        return JSONResponse(
            content={
                "workspace": workspace_dir,
                "query": normalized_query,
                "mode": "anchor" if anchor_requested else ("query" if normalized_query else "recent"),
                "anchor": anchor_payload.get("anchor", {}) if anchor_payload else {},
                "depth_before": depth_before,
                "depth_after": depth_after,
                "timeline": timeline,
                "count": len(timeline),
            }
        )
    except Exception as exc:
        return JSONResponse(status_code=500, content={"error": str(exc)})


@router.get("/v1/memory/observations")
async def memory_observations(
    task_id: str = Query("", description="Task identifier for observation flow"),
    session_id: str = Query("", description="Session identifier for observation flow"),
    digest: str = Query("", description="Digest identifier for observation flow"),
    query: str = Query("", description="Optional observation content filter"),
    limit: int = Query(60, ge=1, le=120, description="Max observation items"),
    origin: str = Query("", description="Filter by origin: 'auto', 'manual', or '' for both"),
):
    """Return detailed observation flow for a timeline/search item."""
    try:
        normalized_task_id = (task_id or "").strip()
        normalized_session_id = (session_id or "").strip()
        normalized_digest = (digest or "").strip()
        normalized_query = (query or "").strip()
        if not any([normalized_task_id, normalized_session_id, normalized_digest, normalized_query]):
            return JSONResponse(
                status_code=400,
                content={"error": "task_id, session_id, digest, or query is required"},
            )

        workspace_dir, obs_store = await _get_obs_store()

        if obs_store:
            try:
                observations = await obs_store.get_observations(
                    task_id=normalized_task_id,
                    session_id=normalized_session_id,
                    digest=normalized_digest,
                    query=normalized_query,
                    limit=limit,
                    origin=origin.strip(),
                )
                return JSONResponse(
                    content={
                        "workspace": workspace_dir,
                        "context": {
                            "task_id": normalized_task_id,
                            "session_id": normalized_session_id,
                            "digest": normalized_digest,
                            "query": normalized_query,
                        },
                        "observations": observations,
                        "count": len(observations),
                    }
                )
            except Exception:
                pass

        _, store = await _get_memory_provider()
        if not workspace_dir or store is None:
            return JSONResponse(
                content={
                    "workspace": "",
                    "context": {
                        "task_id": normalized_task_id,
                        "session_id": normalized_session_id,
                        "digest": normalized_digest,
                        "query": normalized_query,
                    },
                    "observations": [],
                    "count": 0,
                    "message": "No workspace configured",
                }
            )

        observations = store.get_observations(
            task_id=normalized_task_id,
            session_id=normalized_session_id,
            digest=normalized_digest,
            query=normalized_query,
            limit=limit,
        )
        return JSONResponse(
            content={
                "workspace": workspace_dir,
                "context": {
                    "task_id": normalized_task_id,
                    "session_id": normalized_session_id,
                    "digest": normalized_digest,
                    "query": normalized_query,
                },
                "observations": observations,
                "count": len(observations),
            }
        )
    except Exception as exc:
        return JSONResponse(status_code=500, content={"error": str(exc)})


@router.get("/v1/memory/session-context")
async def memory_session_context(
    limit: int = Query(5, ge=1, le=20, description="Max recent items per category"),
):
    """Return a compact session-start summary for workspace context injection."""
    try:
        workspace_dir, obs_store = await _get_obs_store()
        if not obs_store:
            return JSONResponse(content={
                "workspace": "",
                "recent_decisions": [],
                "recent_failures": [],
                "recent_changes": [],
                "active_tasks": [],
                "recovery_suggestions": [],
                "message": "No workspace or observation store configured",
            })

        recent_decisions = await obs_store.search_fts("decision", limit=limit)
        recent_failures = await obs_store.search_fts("error fail cancelled", limit=limit)
        recent_failures = [
            item for item in recent_failures
            if any(
                k in (item.get("status", "") + item.get("event_type", "") + item.get("failure_label", "")).lower()
                for k in ("fail", "error", "cancel", "interrupt")
            )
        ][:limit]

        recent_changes = []
        try:
            cursor = await obs_store._db.execute(
                "SELECT * FROM session_summaries WHERE item_type = 'session_summary' "
                "ORDER BY created_at DESC LIMIT ?",
                (limit,),
            )
            rows = await cursor.fetchall()
            recent_changes = [obs_store._row_to_session_dict(r) for r in rows]
        except Exception:
            pass

        active_tasks = []
        try:
            cursor = await obs_store._db.execute(
                "SELECT * FROM session_summaries WHERE item_type = 'task_event' "
                "AND status NOT IN ('completed', 'cancelled', 'failed') "
                "ORDER BY created_at DESC LIMIT ?",
                (limit,),
            )
            rows = await cursor.fetchall()
            active_tasks = [obs_store._row_to_session_dict(r) for r in rows]
        except Exception:
            pass

        recovery_suggestions = [
            {
                "task_id": item.get("task_id", ""),
                "task_title": item.get("task_title", "") or item.get("title", ""),
                "status": item.get("status", ""),
                "failure_label": item.get("failure_label", ""),
                "recovery_action": item.get("recovery_action", ""),
                "resume_note": item.get("resume_note", ""),
                "last_error": item.get("last_error", ""),
            }
            for item in recent_failures
            if item.get("recovery_action") or item.get("resume_note")
        ]

        return JSONResponse(content={
            "workspace": workspace_dir,
            "recent_decisions": recent_decisions[:limit],
            "recent_failures": recent_failures[:limit],
            "recent_changes": recent_changes[:limit],
            "active_tasks": active_tasks[:limit],
            "recovery_suggestions": recovery_suggestions[:limit],
        })
    except Exception as exc:
        return JSONResponse(status_code=500, content={"error": str(exc)})


@router.get("/v1/memory/resume-target")
async def memory_resume_target(
    task_id: str = Query("", description="Task ID to build resume context for"),
    digest: str = Query("", description="Digest to build resume context for"),
):
    """Build a task resume context from observation history."""
    try:
        normalized_task_id = (task_id or "").strip()
        normalized_digest = (digest or "").strip()
        if not normalized_task_id and not normalized_digest:
            return JSONResponse(
                status_code=400,
                content={"error": "task_id or digest is required"},
            )

        workspace_dir, obs_store = await _get_obs_store()
        if not obs_store:
            return JSONResponse(content={
                "workspace": "",
                "resume_context": None,
                "message": "No observation store available",
            })

        observations = await obs_store.get_observations(
            task_id=normalized_task_id,
            digest=normalized_digest,
            limit=30,
        )

        task_entry = None
        if normalized_task_id:
            try:
                cursor = await obs_store._db.execute(
                    "SELECT * FROM session_summaries WHERE task_id = ? "
                    "ORDER BY created_at DESC LIMIT 1",
                    (normalized_task_id,),
                )
                row = await cursor.fetchone()
                if row:
                    task_entry = obs_store._row_to_session_dict(row)
            except Exception:
                pass
        elif normalized_digest:
            try:
                cursor = await obs_store._db.execute(
                    "SELECT * FROM session_summaries WHERE digest = ? "
                    "ORDER BY created_at DESC LIMIT 1",
                    (normalized_digest,),
                )
                row = await cursor.fetchone()
                if row:
                    task_entry = obs_store._row_to_session_dict(row)
            except Exception:
                pass

        if not task_entry and not observations:
            return JSONResponse(content={
                "workspace": workspace_dir,
                "resume_context": None,
                "message": "No matching task or observations found",
            })

        last_status = ""
        last_error = ""
        recovery_action = ""
        resume_note = ""
        failure_label = ""
        if task_entry:
            last_status = task_entry.get("status", "")
            last_error = task_entry.get("last_error", "")
            recovery_action = task_entry.get("recovery_action", "")
            resume_note = task_entry.get("resume_note", "")
            failure_label = task_entry.get("failure_label", "")

        stages_seen = list(dict.fromkeys(
            obs.get("stage", "") for obs in observations if obs.get("stage")
        ))

        resume_context = {
            "task_id": normalized_task_id or (task_entry or {}).get("task_id", ""),
            "task_title": (task_entry or {}).get("task_title", "") or (task_entry or {}).get("title", ""),
            "last_status": last_status,
            "last_error": last_error,
            "failure_label": failure_label,
            "recovery_action": recovery_action,
            "resume_note": resume_note,
            "stages_seen": stages_seen,
            "observation_count": len(observations),
            "latest_observation": observations[0] if observations else None,
            "digest": normalized_digest or (task_entry or {}).get("digest", ""),
        }

        return JSONResponse(content={
            "workspace": workspace_dir,
            "resume_context": resume_context,
        })
    except Exception as exc:
        return JSONResponse(status_code=500, content={"error": str(exc)})
