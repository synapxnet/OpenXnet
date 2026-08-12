#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
Workspace-scoped session memory persistence for Recall Center and task resume.

This module stores lightweight cross-session summaries plus a rolling user
profile inside the workspace `.agent/memory/` directory so that Recall Center
can recover recent context even when token windows are exhausted or a session
is interrupted.

Author: OpenAI Codex
Department: R&D
Date: 2026-04-16
Version: 1.0.0
Security Level: INTERNAL
"""

__version__ = "1.1.0"
__author__ = "OpenAI Codex"
__copyright__ = "Copyright 2026 Synapxnet"
__maintainer__ = "OpenAI Codex"
__email__ = "synapxnet@gmail.com"

# Modification History:
# 2026-04-16, v1.0.0, OpenAI Codex: Initial creation.

import hashlib
import json
import re
from collections import Counter
from datetime import datetime
from pathlib import Path
from threading import RLock
from typing import Any, Dict, List, Optional

_LOCKS: Dict[str, RLock] = {}
_STORAGE_EXCLUSION_TAGS = (
    "private",
    "openxnet-context",
    "openxnet-memory-context",
    "claude-mem-context",
)
_STORAGE_EXCLUSION_TAG_PATTERN = "|".join(
    re.escape(tag) for tag in _STORAGE_EXCLUSION_TAGS
)
_STORAGE_EXCLUSION_PATTERN = re.compile(
    rf"<\s*(?:{_STORAGE_EXCLUSION_TAG_PATTERN})\b[^>]*>.*?<\s*/\s*(?:{_STORAGE_EXCLUSION_TAG_PATTERN})\s*>",
    re.IGNORECASE | re.DOTALL,
)


class SessionMemoryStore:
    """Persist session summaries and a compact workspace-level user profile."""

    provider_name = "session_store"
    max_sessions = 80
    max_task_events = 120
    max_observations = 240
    max_topics = 16
    max_models = 8
    max_workflows = 12

    def __init__(self, workspace_dir: str):
        self.workspace_dir = Path(workspace_dir).expanduser()
        self.memory_dir = self.workspace_dir / ".agent" / "memory"
        self.memory_dir.mkdir(parents=True, exist_ok=True)
        self.sessions_file = self.memory_dir / "session_summaries.json"
        self.profile_file = self.memory_dir / "user_profile.json"
        self.observations_file = self.memory_dir / "observation_log.json"
        self._lock = _LOCKS.setdefault(str(self.memory_dir), RLock())
        self._obs_store = None

    def set_observation_store(self, obs_store) -> None:
        self._obs_store = obs_store

    def _dual_write_observations(self, observations: List[Dict[str, Any]]) -> None:
        if not self._obs_store or not observations:
            return
        try:
            import asyncio
            loop = asyncio.get_running_loop()
            loop.create_task(self._obs_store.upsert_observations(observations))
        except RuntimeError:
            pass

    def _dual_write_session(self, entry: Dict[str, Any]) -> None:
        if not self._obs_store or not entry:
            return
        try:
            import asyncio
            loop = asyncio.get_running_loop()
            loop.create_task(self._obs_store.upsert_session_summary(entry))
        except RuntimeError:
            pass

    def record_interaction(
        self,
        user_prompt: str,
        assistant_output: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Persist one completed interaction and update the rolling profile."""
        prompt_payload = self._sanitize_for_storage(user_prompt)
        answer_payload = self._sanitize_for_storage(assistant_output)
        prompt_text = prompt_payload["text"]
        answer_text = answer_payload["text"]
        if not prompt_text and not answer_text:
            return {}

        now = datetime.now().isoformat()
        meta = dict(metadata or {})
        privacy_fields = self._collect_privacy_fields(
            user_prompt=prompt_payload,
            assistant_output=answer_payload,
        )
        topics = self._extract_topics([prompt_text, answer_text], limit=8)
        summary = self._build_summary(prompt_text, answer_text)
        title = self._build_title(prompt_text, summary)
        entry = {
            "session_id": hashlib.md5(
                f"{now}|{prompt_text[:240]}|{answer_text[:240]}".encode("utf-8")
            ).hexdigest()[:12],
            "item_type": "session_summary",
            "title": title,
            "summary": summary,
            "user_prompt_preview": self._preview(prompt_text, 260),
            "assistant_preview": self._preview(answer_text, 320),
            "topics": topics,
            "created_at": now,
            "workspace_dir": str(self.workspace_dir),
            "model": str(meta.get("model") or ""),
            "source": str(meta.get("source") or "chat"),
            "digest": hashlib.md5(
                f"{prompt_text[:400]}|{answer_text[:400]}".encode("utf-8")
            ).hexdigest(),
            "privacy_mode": privacy_fields["privacy_mode"],
            "private_segment_count": privacy_fields["private_segment_count"],
            "redacted_fields": privacy_fields["redacted_fields"],
        }
        new_observations = self._build_task_event_observations(
            entry,
            details_text,
            sanitized_meta,
            now,
        )

        with self._lock:
            sessions = self._read_json(self.sessions_file, default=[])
            sessions = self._upsert_entry(sessions, entry)
            sessions = self._trim_entries(sessions)
            self._write_json(self.sessions_file, sessions)

            profile = self._read_json(self.profile_file, default={})
            profile = self._merge_profile(profile, prompt_text, answer_text, meta, topics, now)
            self._write_json(self.profile_file, profile)

            observations = self._read_json(self.observations_file, default=[])
            new_observations = self._build_interaction_observations(
                entry,
                prompt_text,
                answer_text,
                meta,
                now,
            )
            observations = self._append_observations(observations, new_observations)
            self._write_json(self.observations_file, observations)

        self._dual_write_session(entry)
        self._dual_write_observations(new_observations)
        return entry

    def record_task_event(
        self,
        *,
        task_id: str,
        task_title: str,
        status: str,
        event_type: str,
        summary: str,
        details: str = "",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Persist one task lifecycle event for cross-session recall."""
        normalized_task_id = str(task_id or "").strip()
        title_payload = self._sanitize_for_storage(task_title, limit=180)
        normalized_title = title_payload["text"] or "Untitled Task"
        normalized_status = str(status or "").strip().lower()
        normalized_event_type = str(event_type or "").strip().lower() or "task_event"
        summary_payload = self._sanitize_for_storage(summary, limit=320)
        details_payload = self._sanitize_for_storage(details, limit=420)
        summary_text = summary_payload["text"]
        details_text = details_payload["text"]
        meta = dict(metadata or {})
        if not normalized_task_id or not (summary_text or details_text):
            return {}

        now = datetime.now().isoformat()
        recovery_action_payload = self._sanitize_for_storage(
            str(meta.get("recovery_action") or ""),
            limit=160,
        )
        failure_category_payload = self._sanitize_for_storage(
            str(meta.get("failure_category") or ""),
            limit=120,
        )
        failure_label_payload = self._sanitize_for_storage(
            str(meta.get("failure_label") or ""),
            limit=160,
        )
        resume_note_payload = self._sanitize_for_storage(
            str(meta.get("resume_note") or ""),
            limit=260,
        )
        result_preview_payload = self._sanitize_for_storage(
            str(meta.get("result_preview") or ""),
            limit=260,
        )
        last_error_payload = self._sanitize_for_storage(
            str(meta.get("last_error") or ""),
            limit=260,
        )
        attempted_status = str(meta.get("attempted_status") or "").strip().lower()
        current_status = str(meta.get("current_status") or "").strip().lower()
        post_cancel_error_payload = self._sanitize_for_storage(
            str(meta.get("post_cancel_error") or ""),
            limit=260,
        )
        terminal_reason_payload = self._sanitize_for_storage(
            str(meta.get("terminal_reason") or ""),
            limit=180,
        )
        ignored_at = str(meta.get("ignored_at") or "").strip()
        interrupted_reason_payload = self._sanitize_for_storage(
            str(meta.get("interrupted_reason") or ""),
            limit=260,
        )
        interrupted_origin_payload = self._sanitize_for_storage(
            str(meta.get("interrupted_origin") or ""),
            limit=160,
        )
        interrupted_at = str(meta.get("interrupted_at") or "").strip()
        last_active_status = str(meta.get("last_active_status") or "").strip().lower()
        last_active_at = str(meta.get("last_active_at") or "").strip()
        recovery_action = recovery_action_payload["text"]
        failure_category = failure_category_payload["text"]
        failure_label = failure_label_payload["text"]
        resume_note = resume_note_payload["text"]
        result_preview = result_preview_payload["text"]
        last_error = last_error_payload["text"]
        post_cancel_error = post_cancel_error_payload["text"]
        terminal_reason = terminal_reason_payload["text"]
        interrupted_reason = interrupted_reason_payload["text"]
        interrupted_origin = interrupted_origin_payload["text"]
        try:
            ignored_count = int(meta.get("ignored_count", 0) or 0)
        except (TypeError, ValueError):
            ignored_count = 0
        try:
            interrupt_count = int(meta.get("interrupt_count", 0) or 0)
        except (TypeError, ValueError):
            interrupt_count = 0
        try:
            last_active_progress = int(meta.get("last_active_progress")) if meta.get("last_active_progress") is not None else None
        except (TypeError, ValueError):
            last_active_progress = None
        trace_excerpt = []
        trace_payloads = {}
        for index, item in enumerate(list(meta.get("trace_excerpt") or [])[:5], start=1):
            payload = self._sanitize_for_storage(str(item or ""), limit=180)
            if not payload["text"]:
                continue
            trace_excerpt.append(payload["text"])
            trace_payloads[f"trace_excerpt_{index}"] = payload
        privacy_fields = self._collect_privacy_fields(
            task_title=title_payload,
            summary=summary_payload,
            details=details_payload,
            recovery_action=recovery_action_payload,
            failure_category=failure_category_payload,
            failure_label=failure_label_payload,
            resume_note=resume_note_payload,
            result_preview=result_preview_payload,
            last_error=last_error_payload,
            post_cancel_error=post_cancel_error_payload,
            terminal_reason=terminal_reason_payload,
            interrupted_reason=interrupted_reason_payload,
            interrupted_origin=interrupted_origin_payload,
            **trace_payloads,
        )
        sanitized_meta = {
            **meta,
            "recovery_action": recovery_action,
            "failure_category": failure_category,
            "failure_label": failure_label,
            "resume_note": resume_note,
            "result_preview": result_preview,
            "last_error": last_error,
            "post_cancel_error": post_cancel_error,
            "terminal_reason": terminal_reason,
            "interrupted_reason": interrupted_reason,
            "interrupted_origin": interrupted_origin,
            "trace_excerpt": trace_excerpt,
        }
        topics = self._extract_topics(
            [
                normalized_task_id,
                normalized_title,
                summary_text,
                details_text,
                recovery_action,
                failure_label,
                resume_note,
                result_preview,
                last_error,
                attempted_status,
                current_status,
                post_cancel_error,
                terminal_reason,
                interrupted_reason,
                interrupted_origin,
                interrupted_at,
                last_active_status,
                last_active_at,
                str(last_active_progress) if last_active_progress is not None else "",
                str(interrupt_count),
                str(ignored_count),
                " ".join(trace_excerpt),
            ],
            limit=10,
        )
        digest_source = "|".join(
            [
                normalized_task_id,
                normalized_event_type,
                normalized_status,
                summary_text,
                details_text,
                recovery_action,
                failure_label,
                resume_note,
                last_error,
                result_preview,
                attempted_status,
                current_status,
                post_cancel_error,
                terminal_reason,
                interrupted_reason,
                interrupted_origin,
                interrupted_at,
                last_active_status,
                last_active_at,
                str(last_active_progress) if last_active_progress is not None else "",
                str(interrupt_count),
                ignored_at,
                str(ignored_count),
            ]
        )
        entry = {
            "session_id": hashlib.md5(
                f"{now}|{normalized_task_id}|{normalized_event_type}|{summary_text[:240]}".encode("utf-8")
            ).hexdigest()[:12],
            "item_type": "task_event",
            "title": self._build_task_event_title(normalized_event_type, normalized_title, normalized_status),
            "summary": summary_text or details_text,
            "user_prompt_preview": resume_note,
            "assistant_preview": details_text,
            "topics": topics,
            "created_at": now,
            "workspace_dir": str(self.workspace_dir),
            "model": str(meta.get("model") or ""),
            "source": str(meta.get("source") or "task_center"),
            "task_id": normalized_task_id,
            "task_title": normalized_title,
            "status": normalized_status,
            "event_type": normalized_event_type,
            "recovery_action": recovery_action,
            "failure_category": failure_category,
            "failure_label": failure_label,
            "resume_note": resume_note,
            "last_error": last_error,
            "result_preview": result_preview,
            "attempted_status": attempted_status,
            "current_status": current_status,
            "ignored_count": ignored_count,
            "ignored_at": ignored_at,
            "post_cancel_error": post_cancel_error,
            "terminal_reason": terminal_reason,
            "interrupted_reason": interrupted_reason,
            "interrupted_origin": interrupted_origin,
            "interrupted_at": interrupted_at,
            "interrupt_count": interrupt_count,
            "last_active_status": last_active_status,
            "last_active_at": last_active_at,
            "last_active_progress": last_active_progress,
            "trace_excerpt": trace_excerpt,
            "digest": hashlib.md5(digest_source.encode("utf-8")).hexdigest(),
            "privacy_mode": privacy_fields["privacy_mode"],
            "private_segment_count": privacy_fields["private_segment_count"],
            "redacted_fields": privacy_fields["redacted_fields"],
        }

        with self._lock:
            sessions = self._read_json(self.sessions_file, default=[])
            sessions = self._upsert_entry(sessions, entry)
            sessions = self._trim_entries(sessions)
            self._write_json(self.sessions_file, sessions)

            profile = self._read_json(self.profile_file, default={})
            profile = self._merge_profile(
                profile,
                normalized_title,
                "\n".join(part for part in [summary_text, details_text] if part),
                {
                    **sanitized_meta,
                    "source": entry["source"],
                },
                topics,
                now,
                count_key="task_event_count",
                last_summary_key="last_task_event_summary",
            )
            self._write_json(self.profile_file, profile)

            observations = self._read_json(self.observations_file, default=[])
            observations = self._append_observations(
                observations,
                new_observations,
            )
            self._write_json(self.observations_file, observations)

        self._dual_write_session(entry)
        self._dual_write_observations(new_observations)
        self._emit_observation_overlay_event(entry, new_observations, now)
        return entry

    def _build_observation_overlay_event(
        self,
        entry: Dict[str, Any],
        observations: List[Dict[str, Any]],
        created_at: str,
    ) -> Dict[str, Any]:
        normalized_observations = [
            dict(item)
            for item in list(observations or [])
            if isinstance(item, dict)
        ]
        latest = normalized_observations[0] if normalized_observations else {}
        task_id = str(entry.get("task_id") or latest.get("task_id") or "").strip()
        if not task_id:
            return {}

        title = str(entry.get("task_title") or entry.get("title") or latest.get("task_title") or "").strip()
        summary = str(latest.get("summary") or entry.get("summary") or "").strip()
        try:
            private_segment_count = int(
                latest.get("private_segment_count")
                or entry.get("private_segment_count")
                or 0
            )
        except (TypeError, ValueError):
            private_segment_count = 0
        return {
            "task_id": task_id,
            "session_id": str(entry.get("session_id") or latest.get("session_id") or "").strip(),
            "digest": str(entry.get("digest") or latest.get("digest") or "").strip(),
            "title": title or f"Task {task_id}",
            "task_title": title or f"Task {task_id}",
            "summary": summary or "Observation flow updated.",
            "detail": str(latest.get("detail") or "").strip(),
            "status": str(entry.get("status") or latest.get("status") or "").strip(),
            "stage": str(latest.get("stage") or "").strip(),
            "event_type": str(entry.get("event_type") or latest.get("event_type") or "").strip(),
            "source": str(entry.get("source") or latest.get("source") or "task_center").strip() or "task_center",
            "focus_source": "workspace_memory",
            "timestamp": str(latest.get("timestamp") or created_at).strip() or created_at,
            "privacy_mode": str(
                latest.get("privacy_mode")
                or entry.get("privacy_mode")
                or "public"
            ).strip() or "public",
            "private_segment_count": max(0, private_segment_count),
            "observation_count": len(normalized_observations),
            "observations": normalized_observations[:6],
        }

    def _emit_observation_overlay_event(
        self,
        entry: Dict[str, Any],
        observations: List[Dict[str, Any]],
        created_at: str,
    ) -> None:
        """Publish an optional Desktop overlay event without a Worker import edge."""

        try:
            from importlib import import_module

            overlay_module = import_module(".".join(("py", "overlay_router")))
            queue_observation_event = getattr(overlay_module, "queue_observation_event")
        except Exception:
            return

        payload = self._build_observation_overlay_event(entry, observations, created_at)
        if not payload:
            return

        try:
            queue_observation_event(payload, action="observation_update")
        except Exception:
            return

    def search(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Search recent session summaries and profile text."""
        normalized_query = (query or "").strip()
        if not normalized_query:
            return []

        query_tokens = self._extract_topics([normalized_query], limit=8)
        if not query_tokens:
            query_tokens = [normalized_query.lower()]

        results: List[Dict[str, Any]] = []
        with self._lock:
            sessions = self._read_json(self.sessions_file, default=[])
            profile = self._read_json(self.profile_file, default={})
            observations = self._read_json(self.observations_file, default=[])

        for index, session in enumerate(sessions):
            item_type = str(session.get("item_type") or "session_summary")
            haystack = " ".join(
                [
                    str(session.get("title") or ""),
                    str(session.get("summary") or ""),
                    str(session.get("user_prompt_preview") or ""),
                    str(session.get("assistant_preview") or ""),
                    str(session.get("task_id") or ""),
                    str(session.get("task_title") or ""),
                    str(session.get("status") or ""),
                    str(session.get("event_type") or ""),
                    str(session.get("recovery_action") or ""),
                    str(session.get("failure_category") or ""),
                    str(session.get("failure_label") or ""),
                    str(session.get("resume_note") or ""),
                    str(session.get("last_error") or ""),
                    str(session.get("result_preview") or ""),
                    str(session.get("attempted_status") or ""),
                    str(session.get("current_status") or ""),
                    str(session.get("ignored_count") or ""),
                    str(session.get("ignored_at") or ""),
                    str(session.get("post_cancel_error") or ""),
                    str(session.get("terminal_reason") or ""),
                    str(session.get("interrupted_reason") or ""),
                    str(session.get("interrupted_origin") or ""),
                    str(session.get("interrupted_at") or ""),
                    str(session.get("interrupt_count") or ""),
                    str(session.get("last_active_status") or ""),
                    str(session.get("last_active_at") or ""),
                    str(session.get("last_active_progress") or ""),
                    " ".join(session.get("trace_excerpt") or []),
                    " ".join(session.get("topics") or []),
                ]
            )
            score = self._score_text(haystack, query_tokens, index_bias=index)
            if score <= 0:
                continue
            results.append(
                {
                    "text": self._format_entry_text(session),
                    "score": round(score, 4),
                    "timestamp": session.get("created_at", ""),
                    "item_type": item_type,
                    "title": session.get("title", ""),
                    "summary": session.get("summary", ""),
                    "source": session.get("source", ""),
                    "task_id": session.get("task_id", ""),
                    "task_title": session.get("task_title", ""),
                    "status": session.get("status", ""),
                    "event_type": session.get("event_type", ""),
                    "recovery_action": session.get("recovery_action", ""),
                    "failure_category": session.get("failure_category", ""),
                    "failure_label": session.get("failure_label", ""),
                    "attempted_status": session.get("attempted_status", ""),
                    "current_status": session.get("current_status", ""),
                    "ignored_count": session.get("ignored_count", 0),
                    "ignored_at": session.get("ignored_at", ""),
                    "post_cancel_error": session.get("post_cancel_error", ""),
                    "terminal_reason": session.get("terminal_reason", ""),
                    "interrupted_reason": session.get("interrupted_reason", ""),
                    "interrupted_origin": session.get("interrupted_origin", ""),
                    "interrupted_at": session.get("interrupted_at", ""),
                    "interrupt_count": session.get("interrupt_count", 0),
                    "last_active_status": session.get("last_active_status", ""),
                    "last_active_at": session.get("last_active_at", ""),
                    "last_active_progress": session.get("last_active_progress"),
                    "last_error": session.get("last_error", ""),
                    "result_preview": session.get("result_preview", ""),
                    "privacy_mode": session.get("privacy_mode", "public"),
                    "private_segment_count": session.get("private_segment_count", 0),
                    "redacted_fields": session.get("redacted_fields") or [],
                }
            )

        for index, observation in enumerate(observations):
            haystack = " ".join(
                [
                    str(observation.get("title") or ""),
                    str(observation.get("summary") or ""),
                    str(observation.get("detail") or ""),
                    str(observation.get("stage") or ""),
                    str(observation.get("task_id") or ""),
                    str(observation.get("task_title") or ""),
                    str(observation.get("event_type") or ""),
                    str(observation.get("status") or ""),
                ]
            )
            score = self._score_text(haystack, query_tokens, index_bias=index)
            if score <= 0:
                continue
            results.append(
                {
                    "text": self._format_observation_text(observation),
                    "score": round(score, 4),
                    "timestamp": observation.get("created_at", ""),
                    "item_type": "observation",
                    "title": observation.get("title", ""),
                    "summary": observation.get("summary", ""),
                    "source": observation.get("source", ""),
                    "task_id": observation.get("task_id", ""),
                    "task_title": observation.get("task_title", ""),
                    "status": observation.get("status", ""),
                    "event_type": observation.get("event_type", ""),
                    "stage": observation.get("stage", ""),
                    "session_id": observation.get("session_id", ""),
                    "observation_id": observation.get("observation_id", ""),
                    "digest": observation.get("digest", ""),
                    "privacy_mode": observation.get("privacy_mode", "public"),
                    "private_segment_count": observation.get("private_segment_count", 0),
                    "redacted_fields": observation.get("redacted_fields") or [],
                }
            )

        profile_text = self._format_profile_text(profile)
        if profile_text:
            profile_score = self._score_text(profile_text, query_tokens, index_bias=0)
            if profile_score > 0:
                results.append(
                    {
                        "text": profile_text,
                        "score": round(profile_score + 0.05, 4),
                        "timestamp": profile.get("last_seen_at", ""),
                        "item_type": "user_profile",
                        "title": "Workspace User Profile",
                        "summary": self._preview(profile_text, 220),
                    }
                )

        results.sort(key=lambda item: item.get("score", 0), reverse=True)
        return results[: max(1, limit)]

    def get_overview(self, limit: int = 8) -> Dict[str, Any]:
        """Return Recall Center metadata for recent sessions and profile."""
        with self._lock:
            sessions = self._read_json(self.sessions_file, default=[])
            profile = self._read_json(self.profile_file, default={})
            observations = self._read_json(self.observations_file, default=[])

        recent_sessions = [
            self._decorate_entry(item)
            for item in sessions[: max(1, limit)]
        ]
        recent_observations = [
            self._decorate_observation(item)
            for item in observations[: max(1, min(limit, 12))]
        ]
        session_count = 0
        task_event_count = 0
        for item in sessions:
            if str(item.get("item_type") or "session_summary") == "task_event":
                task_event_count += 1
            else:
                session_count += 1
        return {
            "recent_sessions": recent_sessions,
            "recent_observations": recent_observations,
            "user_profile": profile,
            "stats": {
                "session_count": session_count,
                "task_event_count": task_event_count,
                "entry_count": len(sessions),
                "observation_count": len(observations),
                "topic_count": len(profile.get("recent_topics") or []),
                "workflow_count": len(profile.get("workflow_preferences") or []),
                "interaction_count": int(profile.get("interaction_count") or 0),
                "task_memory_count": int(profile.get("task_event_count") or 0),
            },
        }

    def _collect_timeline_items(self, query: str = "") -> List[Dict[str, Any]]:
        """Build timeline items before limit/window slicing."""
        normalized_query = (query or "").strip()
        query_tokens = self._extract_topics([normalized_query], limit=8) if normalized_query else []
        if normalized_query and not query_tokens:
            query_tokens = [normalized_query.lower()]

        with self._lock:
            sessions = self._read_json(self.sessions_file, default=[])
            observations = self._read_json(self.observations_file, default=[])

        timeline: List[Dict[str, Any]] = []
        for index, session in enumerate(sessions):
            item = self._decorate_entry(session)
            haystack = " ".join(
                [
                    str(item.get("title") or ""),
                    str(item.get("summary") or ""),
                    str(item.get("assistant_preview") or ""),
                    str(item.get("task_id") or ""),
                    str(item.get("task_title") or ""),
                    str(item.get("status") or ""),
                    str(item.get("event_type") or ""),
                    " ".join(item.get("topics") or []),
                ]
            )
            score = self._score_text(haystack, query_tokens, index_bias=index) if normalized_query else 1.0
            if normalized_query and score <= 0:
                continue
            observation_count = self._count_observations_for_entry(item, observations)
            timeline.append(
                {
                    **item,
                    "timestamp": item.get("created_at", ""),
                    "timeline_type": "entry",
                    "score": round(score, 4),
                    "observation_count": observation_count,
                }
            )

        for index, observation in enumerate(observations):
            item = self._decorate_observation(observation)
            haystack = " ".join(
                [
                    str(item.get("title") or ""),
                    str(item.get("summary") or ""),
                    str(item.get("detail") or ""),
                    str(item.get("stage") or ""),
                    str(item.get("task_id") or ""),
                    str(item.get("task_title") or ""),
                ]
            )
            score = self._score_text(haystack, query_tokens, index_bias=index) if normalized_query else 0.8
            if normalized_query and score <= 0:
                continue
            timeline.append(
                {
                    **item,
                    "timestamp": item.get("created_at", ""),
                    "timeline_type": "observation",
                    "score": round(score, 4),
                    "observation_count": 0,
                }
            )

        if normalized_query:
            timeline.sort(
                key=lambda item: (item.get("score", 0), item.get("timestamp", "")),
                reverse=True,
            )
        else:
            timeline.sort(key=lambda item: item.get("timestamp", ""), reverse=True)
        return timeline

    def get_timeline(self, query: str = "", limit: int = 20) -> List[Dict[str, Any]]:
        """Return a progressive recall timeline mixing summaries and observations."""
        return self._collect_timeline_items(query=query)[: max(1, limit)]

    def get_timeline_window(
        self,
        *,
        task_id: str = "",
        session_id: str = "",
        digest: str = "",
        query: str = "",
        depth_before: int = 3,
        depth_after: int = 4,
    ) -> Dict[str, Any]:
        """Return a chronological window around a selected recall target."""
        normalized_task_id = str(task_id or "").strip()
        normalized_session_id = str(session_id or "").strip()
        normalized_digest = str(digest or "").strip()
        normalized_query = (query or "").strip()
        if not any([normalized_task_id, normalized_session_id, normalized_digest, normalized_query]):
            return {
                "timeline": [],
                "anchor": {
                    "task_id": normalized_task_id,
                    "session_id": normalized_session_id,
                    "digest": normalized_digest,
                    "matched": False,
                },
            }

        timeline = self._collect_timeline_items()
        chronological_timeline = sorted(timeline, key=lambda item: item.get("timestamp", ""))
        anchor_index = next(
            (
                index for index, item in enumerate(chronological_timeline)
                if self._timeline_item_matches(
                    item,
                    task_id=normalized_task_id,
                    session_id=normalized_session_id,
                    digest=normalized_digest,
                )
            ),
            None,
        )

        if anchor_index is None and normalized_query:
            query_timeline = self._collect_timeline_items(query=normalized_query)
            if query_timeline:
                query_anchor_key = self._timeline_item_key(query_timeline[0])
                anchor_index = next(
                    (
                        index for index, item in enumerate(chronological_timeline)
                        if self._timeline_item_key(item) == query_anchor_key
                    ),
                    None,
                )

        before_count = max(0, int(depth_before))
        after_count = max(0, int(depth_after))
        if anchor_index is None:
            window_size = max(1, before_count + after_count + 1)
            window = chronological_timeline[-window_size:]
            anchor_key = ""
        else:
            start = max(0, anchor_index - before_count)
            end = min(len(chronological_timeline), anchor_index + after_count + 1)
            window = chronological_timeline[start:end]
            anchor_key = self._timeline_item_key(chronological_timeline[anchor_index])

        decorated_window = []
        for item in window:
            decorated_item = dict(item)
            decorated_item["timeline_anchor"] = bool(anchor_key and self._timeline_item_key(item) == anchor_key)
            decorated_window.append(decorated_item)

        return {
            "timeline": decorated_window,
            "anchor": {
                "task_id": normalized_task_id,
                "session_id": normalized_session_id,
                "digest": normalized_digest,
                "matched": anchor_index is not None,
                "anchor_key": anchor_key,
                "query": normalized_query,
            },
        }

    def get_observations(
        self,
        *,
        task_id: str = "",
        session_id: str = "",
        digest: str = "",
        query: str = "",
        limit: int = 80,
    ) -> List[Dict[str, Any]]:
        """Return detailed observation flow for a task/session recall item."""
        normalized_task_id = str(task_id or "").strip()
        normalized_session_id = str(session_id or "").strip()
        normalized_digest = str(digest or "").strip()
        normalized_query = (query or "").strip()
        if not any([normalized_task_id, normalized_session_id, normalized_digest, normalized_query]):
            return []

        query_tokens = self._extract_topics([normalized_query], limit=8) if normalized_query else []
        if normalized_query and not query_tokens:
            query_tokens = [normalized_query.lower()]

        with self._lock:
            sessions = self._read_json(self.sessions_file, default=[])
            stored_observations = self._read_json(self.observations_file, default=[])

        observations: List[Dict[str, Any]] = []
        for item in stored_observations:
            observation = self._decorate_observation(item)
            if any([normalized_task_id, normalized_session_id, normalized_digest]) and not self._observation_matches(
                observation,
                task_id=normalized_task_id,
                session_id=normalized_session_id,
                digest=normalized_digest,
            ):
                continue
            if normalized_query:
                score = self._score_text(self._format_observation_text(observation), query_tokens, index_bias=0)
                if score <= 0:
                    continue
                observation["score"] = round(score, 4)
            observations.append(observation)

        for entry in sessions:
            if any([normalized_task_id, normalized_session_id, normalized_digest]) and not self._entry_matches(
                entry,
                task_id=normalized_task_id,
                session_id=normalized_session_id,
                digest=normalized_digest,
            ):
                continue
            for derived in self._derive_observations_from_entry(entry):
                if normalized_query:
                    score = self._score_text(self._format_observation_text(derived), query_tokens, index_bias=0)
                    if score <= 0:
                        continue
                    derived["score"] = round(score, 4)
                observations.append(derived)

        deduped: List[Dict[str, Any]] = []
        seen = set()
        for item in sorted(observations, key=lambda value: value.get("timestamp", "")):
            digest_value = str(item.get("digest") or item.get("observation_id") or "").strip()
            if digest_value and digest_value in seen:
                continue
            if digest_value:
                seen.add(digest_value)
            deduped.append(item)
        if len(deduped) > limit:
            deduped = deduped[-limit:]
        return deduped

    def _merge_profile(
        self,
        existing: Dict[str, Any],
        user_prompt: str,
        assistant_output: str,
        metadata: Dict[str, Any],
        topics: List[str],
        now: str,
        count_key: str = "interaction_count",
        last_summary_key: str = "last_summary",
    ) -> Dict[str, Any]:
        profile = dict(existing or {})
        profile["last_seen_at"] = now
        profile["last_workspace"] = str(self.workspace_dir)
        if count_key:
            profile[count_key] = int(profile.get(count_key, 0) or 0) + 1

        detected_language = self._detect_language(user_prompt, assistant_output)
        if detected_language:
            language_counts = dict(profile.get("language_counts") or {})
            language_counts[detected_language] = int(language_counts.get(detected_language, 0) or 0) + 1
            profile["language_counts"] = language_counts
            profile["preferred_language"] = max(
                language_counts,
                key=lambda key: language_counts.get(key, 0),
            )

        recent_topics = list(profile.get("recent_topics") or [])
        profile["recent_topics"] = self._merge_unique(topics, recent_topics, self.max_topics)

        model_name = str(metadata.get("model") or "").strip()
        if model_name:
            recent_models = list(profile.get("recent_models") or [])
            profile["recent_models"] = self._merge_unique([model_name], recent_models, self.max_models)

        workflows = self._extract_workflow_preferences(user_prompt, assistant_output, metadata)
        profile["workflow_preferences"] = self._merge_unique(
            workflows,
            list(profile.get("workflow_preferences") or []),
            self.max_workflows,
        )

        if last_summary_key:
            profile[last_summary_key] = self._build_summary(user_prompt, assistant_output)
        return profile

    def _upsert_entry(self, sessions: List[Dict[str, Any]], entry: Dict[str, Any]) -> List[Dict[str, Any]]:
        digest = str(entry.get("digest") or "").strip()
        if not digest:
            return [entry, *list(sessions or [])]

        merged_sessions = list(sessions or [])
        for index, existing in enumerate(merged_sessions):
            if str(existing.get("digest") or "").strip() != digest:
                continue
            updated = dict(existing)
            updated.update(entry)
            merged_sessions.pop(index)
            merged_sessions.insert(0, updated)
            return merged_sessions

        merged_sessions.insert(0, entry)
        return merged_sessions

    def _trim_entries(self, sessions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        trimmed: List[Dict[str, Any]] = []
        session_count = 0
        task_event_count = 0
        for item in list(sessions or []):
            item_type = str(item.get("item_type") or "session_summary")
            if item_type == "task_event":
                if task_event_count >= self.max_task_events:
                    continue
                task_event_count += 1
            else:
                if session_count >= self.max_sessions:
                    continue
                session_count += 1
            trimmed.append(item)
        return trimmed

    def _decorate_entry(self, session: Dict[str, Any]) -> Dict[str, Any]:
        item = dict(session or {})
        item["item_type"] = str(item.get("item_type") or "session_summary")
        item.setdefault("source", "chat" if item["item_type"] == "session_summary" else "task_center")
        item.setdefault("privacy_mode", "public")
        item.setdefault("private_segment_count", 0)
        item.setdefault("redacted_fields", [])
        return item

    def _decorate_observation(self, observation: Dict[str, Any]) -> Dict[str, Any]:
        item = dict(observation or {})
        item["item_type"] = "observation"
        item.setdefault("timestamp", item.get("created_at", ""))
        item.setdefault("source", "memory_observation")
        item.setdefault("stage", "observation")
        item["derived"] = bool(item.get("derived"))
        item.setdefault("privacy_mode", "public")
        item.setdefault("private_segment_count", 0)
        item.setdefault("redacted_fields", [])
        return item

    def _append_observations(
        self,
        existing: List[Dict[str, Any]],
        new_items: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        merged = list(existing or [])
        for item in list(new_items or []):
            if not item:
                continue
            digest_value = str(item.get("digest") or "").strip()
            if not digest_value:
                merged.insert(0, item)
                continue
            replaced = False
            for index, existing_item in enumerate(merged):
                if str(existing_item.get("digest") or "").strip() != digest_value:
                    continue
                updated = dict(existing_item)
                updated.update(item)
                merged.pop(index)
                merged.insert(0, updated)
                replaced = True
                break
            if not replaced:
                merged.insert(0, item)
        return merged[: self.max_observations]

    def _build_interaction_observations(
        self,
        entry: Dict[str, Any],
        prompt_text: str,
        answer_text: str,
        metadata: Dict[str, Any],
        created_at: str,
    ) -> List[Dict[str, Any]]:
        source = str(metadata.get("source") or entry.get("source") or "chat")
        session_id = str(entry.get("session_id") or "").strip()
        digest = str(entry.get("digest") or "").strip()
        observations = []
        if prompt_text:
            observations.append(
                self._make_observation(
                    created_at=created_at,
                    source=source,
                    stage="user_prompt",
                    title="User Prompt",
                    summary=self._preview(prompt_text, 220),
                    detail=self._preview(prompt_text, 520),
                    session_id=session_id,
                    target_type="session_summary",
                    target_id=session_id or digest,
                    digest_seed=digest,
                    privacy_mode=str(entry.get("privacy_mode") or "public"),
                    private_segment_count=int(entry.get("private_segment_count") or 0),
                    redacted_fields=list(entry.get("redacted_fields") or []),
                )
            )
        if answer_text:
            observations.append(
                self._make_observation(
                    created_at=created_at,
                    source=source,
                    stage="assistant_response",
                    title="Assistant Response",
                    summary=self._preview(answer_text, 220),
                    detail=self._preview(answer_text, 520),
                    session_id=session_id,
                    target_type="session_summary",
                    target_id=session_id or digest,
                    digest_seed=digest,
                    privacy_mode=str(entry.get("privacy_mode") or "public"),
                    private_segment_count=int(entry.get("private_segment_count") or 0),
                    redacted_fields=list(entry.get("redacted_fields") or []),
                )
            )
        return observations

    def _build_task_event_observations(
        self,
        entry: Dict[str, Any],
        details_text: str,
        metadata: Dict[str, Any],
        created_at: str,
    ) -> List[Dict[str, Any]]:
        source = str(metadata.get("source") or entry.get("source") or "task_center")
        task_id = str(entry.get("task_id") or "").strip()
        task_title = str(entry.get("task_title") or entry.get("title") or "").strip()
        session_id = str(entry.get("session_id") or "").strip()
        digest = str(entry.get("digest") or "").strip()
        observations = [
            self._make_observation(
                created_at=created_at,
                source=source,
                stage="event_summary",
                title=entry.get("title") or "Task Event",
                summary=entry.get("summary") or details_text,
                detail=details_text or entry.get("summary") or "",
                task_id=task_id,
                task_title=task_title,
                session_id=session_id,
                target_type="task_event",
                target_id=task_id or session_id or digest,
                event_type=entry.get("event_type", ""),
                status=entry.get("status", ""),
                digest_seed=digest,
                privacy_mode=str(entry.get("privacy_mode") or "public"),
                private_segment_count=int(entry.get("private_segment_count") or 0),
                redacted_fields=list(entry.get("redacted_fields") or []),
            )
        ]

        observation_specs = [
            ("resume_note", "Resume Note", entry.get("resume_note") or metadata.get("resume_note") or ""),
            ("last_error", "Last Error", entry.get("last_error") or metadata.get("last_error") or ""),
            ("result_preview", "Result Preview", entry.get("result_preview") or metadata.get("result_preview") or ""),
            ("interrupted_reason", "Interrupted Reason", entry.get("interrupted_reason") or metadata.get("interrupted_reason") or ""),
            ("terminal_reason", "Terminal Reason", entry.get("terminal_reason") or metadata.get("terminal_reason") or ""),
        ]
        for stage, title, content in observation_specs:
            normalized_content = str(content or "").strip()
            if not normalized_content:
                continue
            observations.append(
                self._make_observation(
                    created_at=created_at,
                    source=source,
                    stage=stage,
                    title=title,
                    summary=self._preview(normalized_content, 220),
                    detail=self._preview(normalized_content, 420),
                    task_id=task_id,
                    task_title=task_title,
                    session_id=session_id,
                    target_type="task_event",
                    target_id=task_id or session_id or digest,
                    event_type=entry.get("event_type", ""),
                    status=entry.get("status", ""),
                    digest_seed=digest,
                    privacy_mode=str(entry.get("privacy_mode") or "public"),
                    private_segment_count=int(entry.get("private_segment_count") or 0),
                    redacted_fields=list(entry.get("redacted_fields") or []),
                )
            )

        trace_excerpt = list(entry.get("trace_excerpt") or metadata.get("trace_excerpt") or [])[:5]
        for index, trace_item in enumerate(trace_excerpt, start=1):
            normalized_trace = str(trace_item or "").strip()
            if not normalized_trace:
                continue
            observations.append(
                self._make_observation(
                    created_at=created_at,
                    source=source,
                    stage="trace",
                    title=f"Trace {index}",
                    summary=self._preview(normalized_trace, 220),
                    detail=self._preview(normalized_trace, 320),
                    task_id=task_id,
                    task_title=task_title,
                    session_id=session_id,
                    target_type="task_event",
                    target_id=task_id or session_id or digest,
                    event_type=entry.get("event_type", ""),
                    status=entry.get("status", ""),
                    digest_seed=f"{digest}|trace|{index}",
                    privacy_mode=str(entry.get("privacy_mode") or "public"),
                    private_segment_count=int(entry.get("private_segment_count") or 0),
                    redacted_fields=list(entry.get("redacted_fields") or []),
                )
            )
        return [item for item in observations if item]

    def _make_observation(
        self,
        *,
        created_at: str,
        source: str,
        stage: str,
        title: str,
        summary: str,
        detail: str = "",
        task_id: str = "",
        task_title: str = "",
        session_id: str = "",
        target_type: str = "",
        target_id: str = "",
        event_type: str = "",
        status: str = "",
        digest_seed: str = "",
        derived: bool = False,
        privacy_mode: str = "public",
        private_segment_count: int = 0,
        redacted_fields: Optional[List[str]] = None,
        origin: str = "auto",
    ) -> Dict[str, Any]:
        summary_text = self._preview(summary, 220)
        detail_text = self._preview(detail, 520)
        if not summary_text and not detail_text:
            return {}

        normalized_stage = str(stage or "").strip().lower() or "observation"
        digest = hashlib.md5(
            "|".join(
                [
                    str(digest_seed or ""),
                    str(target_type or ""),
                    str(target_id or ""),
                    str(normalized_stage),
                    summary_text,
                    detail_text,
                ]
            ).encode("utf-8")
        ).hexdigest()
        observation_id = hashlib.md5(
            f"{created_at}|{digest}|{normalized_stage}".encode("utf-8")
        ).hexdigest()[:16]
        return {
            "observation_id": observation_id,
            "item_type": "observation",
            "title": self._preview(title or "Observation", 96),
            "summary": summary_text or detail_text,
            "detail": detail_text or summary_text,
            "created_at": created_at,
            "timestamp": created_at,
            "source": str(source or "memory_observation"),
            "stage": normalized_stage,
            "task_id": str(task_id or ""),
            "task_title": str(task_title or ""),
            "session_id": str(session_id or ""),
            "target_type": str(target_type or ""),
            "target_id": str(target_id or ""),
            "event_type": str(event_type or ""),
            "status": str(status or ""),
            "digest": digest,
            "derived": bool(derived),
            "origin": str(origin or "auto"),
            "privacy_mode": "redacted"
            if int(private_segment_count or 0) > 0 or list(redacted_fields or [])
            else str(privacy_mode or "public"),
            "private_segment_count": int(private_segment_count or 0),
            "redacted_fields": list(redacted_fields or []),
        }

    def _count_observations_for_entry(
        self,
        entry: Dict[str, Any],
        observations: List[Dict[str, Any]],
    ) -> int:
        explicit_count = 0
        for observation in list(observations or []):
            if self._observation_matches(
                observation,
                task_id=str(entry.get("task_id") or "").strip(),
                session_id=str(entry.get("session_id") or "").strip(),
                digest=str(entry.get("digest") or "").strip(),
            ):
                explicit_count += 1
        return explicit_count + len(self._derive_observations_from_entry(entry))

    def _timeline_item_key(self, item: Dict[str, Any]) -> str:
        return "|".join(
            [
                str(item.get("task_id") or "").strip(),
                str(item.get("session_id") or "").strip(),
                str(item.get("digest") or "").strip(),
                str(item.get("observation_id") or "").strip(),
                str(item.get("timestamp") or item.get("created_at") or "").strip(),
                str(item.get("title") or item.get("task_title") or "").strip(),
            ]
        )

    def _timeline_item_matches(
        self,
        item: Dict[str, Any],
        *,
        task_id: str = "",
        session_id: str = "",
        digest: str = "",
    ) -> bool:
        normalized_task_id = str(task_id or "").strip()
        normalized_session_id = str(session_id or "").strip()
        normalized_digest = str(digest or "").strip()

        item_digest = str(item.get("digest") or "").strip()
        if normalized_digest and item_digest and item_digest == normalized_digest:
            return True

        item_session_id = str(item.get("session_id") or "").strip()
        if normalized_session_id and item_session_id and item_session_id == normalized_session_id:
            return True

        item_task_id = str(item.get("task_id") or "").strip()
        if normalized_task_id and item_task_id and item_task_id == normalized_task_id:
            return True

        return False

    def _entry_matches(
        self,
        entry: Dict[str, Any],
        *,
        task_id: str = "",
        session_id: str = "",
        digest: str = "",
    ) -> bool:
        if task_id and str(entry.get("task_id") or "").strip() == task_id:
            return True
        if session_id and str(entry.get("session_id") or "").strip() == session_id:
            return True
        if digest and str(entry.get("digest") or "").strip() == digest:
            return True
        return False

    def _observation_matches(
        self,
        observation: Dict[str, Any],
        *,
        task_id: str = "",
        session_id: str = "",
        digest: str = "",
    ) -> bool:
        if task_id and str(observation.get("task_id") or "").strip() == task_id:
            return True
        if session_id and str(observation.get("session_id") or "").strip() == session_id:
            return True
        if digest and (
            str(observation.get("digest") or "").strip() == digest
            or str(observation.get("target_id") or "").strip() == digest
        ):
            return True
        return False

    def _derive_observations_from_entry(self, entry: Dict[str, Any]) -> List[Dict[str, Any]]:
        item = self._decorate_entry(entry)
        created_at = str(item.get("created_at") or datetime.now().isoformat())
        item_type = str(item.get("item_type") or "session_summary")
        if item_type == "task_event":
            return self._build_task_event_observations(
                item,
                str(item.get("assistant_preview") or ""),
                item,
                created_at,
            )
        return self._build_interaction_observations(
            item,
            str(item.get("user_prompt_preview") or ""),
            str(item.get("assistant_preview") or ""),
            item,
            created_at,
        )

    def _format_observation_text(self, observation: Dict[str, Any]) -> str:
        lines = [
            observation.get("title") or "Observation",
            observation.get("summary") or "",
        ]
        if observation.get("detail") and observation.get("detail") != observation.get("summary"):
            lines.append(str(observation.get("detail")))
        if observation.get("task_id"):
            lines.append(f"Task ID: {observation.get('task_id')}")
        if observation.get("stage"):
            lines.append(f"Stage: {self._humanize_label(observation.get('stage'))}")
        return "\n".join(line for line in lines if line)

    def _read_json(self, path: Path, default: Any) -> Any:
        if not path.exists():
            return default
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return default

    def _write_json(self, path: Path, payload: Any) -> None:
        temp_path = path.with_suffix(path.suffix + ".tmp")
        temp_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        temp_path.replace(path)

    def _sanitize_for_storage(self, text: str, limit: Optional[int] = None) -> Dict[str, Any]:
        raw_text = "" if text is None else str(text)
        private_matches = _STORAGE_EXCLUSION_PATTERN.findall(raw_text)
        sanitized_text = _STORAGE_EXCLUSION_PATTERN.sub(" ", raw_text)
        sanitized_text = " ".join(sanitized_text.split())
        if limit:
            sanitized_text = self._preview(sanitized_text, limit)
        return {
            "text": sanitized_text,
            "had_private_content": bool(private_matches),
            "private_segment_count": len(private_matches),
        }

    def _collect_privacy_fields(self, **field_payloads: Dict[str, Any]) -> Dict[str, Any]:
        redacted_fields = [
            label
            for label, payload in field_payloads.items()
            if isinstance(payload, dict) and payload.get("had_private_content")
        ]
        private_segment_count = sum(
            int(payload.get("private_segment_count", 0) or 0)
            for payload in field_payloads.values()
            if isinstance(payload, dict)
        )
        return {
            "privacy_mode": "redacted" if redacted_fields or private_segment_count else "public",
            "private_segment_count": private_segment_count,
            "redacted_fields": redacted_fields,
        }

    def _preview(self, text: str, limit: int = 200) -> str:
        compact = " ".join(str(text or "").split())
        if len(compact) <= limit:
            return compact
        return compact[: limit - 1] + "…"

    def _build_title(self, prompt: str, summary: str) -> str:
        base = self._preview(prompt, 42) or self._preview(summary, 42) or "Untitled Session"
        return base

    def _build_summary(self, prompt: str, answer: str) -> str:
        prompt_preview = self._preview(prompt, 120)
        answer_preview = self._preview(answer, 220)
        if prompt_preview and answer_preview:
            return f"{prompt_preview} -> {answer_preview}"
        return prompt_preview or answer_preview or ""

    def _format_entry_text(self, session: Dict[str, Any]) -> str:
        if str(session.get("item_type") or "session_summary") == "task_event":
            return self._format_task_event_text(session)
        return self._format_session_text(session)

    def _format_session_text(self, session: Dict[str, Any]) -> str:
        topics = ", ".join(session.get("topics") or [])
        lines = [
            session.get("title") or "Session Summary",
            session.get("summary") or "",
        ]
        if topics:
            lines.append(f"Topics: {topics}")
        return "\n".join(line for line in lines if line)

    def _build_task_event_title(self, event_type: str, task_title: str, status: str) -> str:
        label = self._humanize_label(event_type or status or "task_event")
        return f"{label}: {task_title}".strip()

    def _format_task_event_text(self, session: Dict[str, Any]) -> str:
        lines = [
            session.get("title") or "Task Event",
            session.get("summary") or "",
        ]
        if session.get("task_id"):
            lines.append(f"Task ID: {session.get('task_id')}")
        if session.get("status"):
            lines.append(f"Status: {self._humanize_label(session.get('status'))}")
        if session.get("event_type"):
            lines.append(f"Event: {self._humanize_label(session.get('event_type'))}")
        if session.get("attempted_status"):
            lines.append(f"Attempted status: {self._humanize_label(session.get('attempted_status'))}")
        if session.get("current_status"):
            lines.append(f"Current status: {self._humanize_label(session.get('current_status'))}")
        if session.get("ignored_count"):
            lines.append(f"Ignored late updates: {session.get('ignored_count')}")
        if session.get("terminal_reason"):
            lines.append(f"Terminal reason: {self._humanize_label(session.get('terminal_reason'))}")
        if session.get("interrupted_reason"):
            lines.append(f"Interrupted reason: {session.get('interrupted_reason')}")
        if session.get("interrupted_origin"):
            lines.append(f"Interrupted origin: {self._humanize_label(session.get('interrupted_origin'))}")
        if session.get("interrupt_count"):
            lines.append(f"Interrupt count: {session.get('interrupt_count')}")
        if session.get("interrupted_at"):
            lines.append(f"Interrupted at: {session.get('interrupted_at')}")
        if session.get("last_active_status"):
            snapshot = [self._humanize_label(session.get("last_active_status"))]
            if session.get("last_active_progress") is not None:
                snapshot.append(f"{session.get('last_active_progress')}%")
            if session.get("last_active_at"):
                snapshot.append(str(session.get("last_active_at")))
            lines.append(f"Last active: {' | '.join(snapshot)}")
        if session.get("failure_label"):
            lines.append(f"Failure: {session.get('failure_label')}")
        if session.get("recovery_action"):
            lines.append(f"Recovery action: {session.get('recovery_action')}")
        if session.get("resume_note"):
            lines.append(f"Resume note: {session.get('resume_note')}")
        if session.get("post_cancel_error"):
            lines.append(f"Post-cancel error: {session.get('post_cancel_error')}")
        if session.get("last_error"):
            lines.append(f"Last error: {session.get('last_error')}")
        if session.get("result_preview"):
            lines.append(f"Result: {session.get('result_preview')}")
        if session.get("ignored_at"):
            lines.append(f"Ignored at: {session.get('ignored_at')}")
        if session.get("trace_excerpt"):
            lines.append(f"Trace: {' | '.join(session.get('trace_excerpt') or [])}")
        return "\n".join(line for line in lines if line)

    def _format_profile_text(self, profile: Dict[str, Any]) -> str:
        if not profile:
            return ""

        lines = ["Workspace User Profile"]
        preferred_language = profile.get("preferred_language")
        if preferred_language:
            lines.append(f"Preferred language: {preferred_language}")
        if profile.get("last_workspace"):
            lines.append(f"Last workspace: {profile.get('last_workspace')}")
        recent_topics = ", ".join(profile.get("recent_topics") or [])
        if recent_topics:
            lines.append(f"Recent topics: {recent_topics}")
        recent_models = ", ".join(profile.get("recent_models") or [])
        if recent_models:
            lines.append(f"Recent models: {recent_models}")
        workflow_preferences = ", ".join(profile.get("workflow_preferences") or [])
        if workflow_preferences:
            lines.append(f"Workflow preferences: {workflow_preferences}")
        if profile.get("last_summary"):
            lines.append(f"Latest summary: {profile.get('last_summary')}")
        if profile.get("last_task_event_summary"):
            lines.append(f"Latest task event: {profile.get('last_task_event_summary')}")
        return "\n".join(lines)

    def _humanize_label(self, value: Any) -> str:
        text = str(value or "").strip().replace("_", " ")
        if not text:
            return ""
        return " ".join(part.capitalize() for part in text.split())

    def _score_text(self, text: str, query_tokens: List[str], index_bias: int = 0) -> float:
        haystack = str(text or "").lower()
        if not haystack:
            return 0.0

        score = 0.0
        for token in query_tokens:
            normalized = str(token or "").strip().lower()
            if not normalized:
                continue
            if normalized in haystack:
                score += 0.6 + (haystack.count(normalized) * 0.15)
        if score <= 0 and any(token in haystack for token in [token.lower() for token in query_tokens]):
            score += 0.4
        if score <= 0:
            return 0.0
        recency_bonus = max(0.0, 0.25 - (index_bias * 0.02))
        return score + recency_bonus

    def _detect_language(self, *texts: str) -> str:
        combined = " ".join(str(text or "") for text in texts)
        has_zh = bool(re.search(r"[\u4e00-\u9fff]", combined))
        has_en = bool(re.search(r"[A-Za-z]", combined))
        if has_zh and has_en:
            return "mixed"
        if has_zh:
            return "zh-CN"
        if has_en:
            return "en-US"
        return ""

    def _extract_topics(self, texts: List[str], limit: int = 10) -> List[str]:
        token_pattern = re.compile(r"[\u4e00-\u9fff]{2,}|[A-Za-z][A-Za-z0-9_\-]{2,}")
        stopwords = {
            "the", "and", "for", "with", "that", "this", "from", "into",
            "then", "have", "will", "after", "before", "继续", "然后", "需要",
            "当前", "已经", "不要", "进行", "以及", "因为", "一个", "我们", "你们",
            "他们", "任务", "功能", "页面", "升级", "OpenXnet", "openxnet",
        }
        counter: Counter[str] = Counter()
        for text in texts:
            for raw in token_pattern.findall(str(text or "")):
                token = raw.strip()
                lowered = token.lower()
                if len(token) < 2 or lowered in stopwords:
                    continue
                counter[token] += 1
        return [item for item, _ in counter.most_common(limit)]

    def _extract_workflow_preferences(
        self,
        user_prompt: str,
        assistant_output: str,
        metadata: Dict[str, Any],
    ) -> List[str]:
        combined = " ".join(
            [
                str(user_prompt or ""),
                str(assistant_output or ""),
                str(metadata.get("source") or ""),
            ]
        ).lower()
        preferences: List[str] = []
        keyword_map = {
            "browser_verification_first": ["浏览器验证", "browser verify", "playwright", "smoke"],
            "upgrade_before_build": ["不要构建", "构建前", "build later", "before build"],
            "task_center_workflow": ["任务中心", "task center", "resume task", "恢复任务"],
            "memory_first": ["记忆", "recall", "session recall", "memory"],
            "workspace_driven": ["工作区", "workspace", "cli path", "cc_path"],
        }
        for label, keywords in keyword_map.items():
            if any(keyword.lower() in combined for keyword in keywords):
                preferences.append(label)
        return preferences

    def _merge_unique(self, fresh: List[str], existing: List[str], limit: int) -> List[str]:
        merged: List[str] = []
        for item in list(fresh or []) + list(existing or []):
            value = str(item or "").strip()
            if not value or value in merged:
                continue
            merged.append(value)
            if len(merged) >= limit:
                break
        return merged
