#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
One-time JSON-to-SQLite migration for observation and session summary data.

Migrates observation_log.json and session_summaries.json into the new
observations.db SQLite store. JSON files are renamed to .json.migrated
after successful migration (not deleted, allowing manual rollback).

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

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict

import aiosqlite


async def migrate_json_to_sqlite(
    memory_dir: Path,
    db: aiosqlite.Connection,
) -> Dict[str, Any]:
    result = {
        "observations_migrated": 0,
        "sessions_migrated": 0,
        "errors": [],
    }

    obs_file = memory_dir / "observation_log.json"
    if obs_file.exists():
        try:
            raw = obs_file.read_text(encoding="utf-8")
            observations = json.loads(raw) if raw.strip() else []
            if isinstance(observations, list):
                await db.execute("BEGIN")
                for obs in observations:
                    if not isinstance(obs, dict):
                        continue
                    observation_id = str(obs.get("observation_id") or "")
                    if not observation_id:
                        continue
                    try:
                        await db.execute(
                            """
                            INSERT OR IGNORE INTO observations (
                                observation_id, item_type, title, summary, detail,
                                created_at, source, stage, origin, task_id, task_title,
                                session_id, target_type, target_id, event_type, status,
                                digest, derived, privacy_mode, private_segment_count,
                                redacted_fields
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            """,
                            (
                                observation_id,
                                str(obs.get("item_type") or "observation"),
                                str(obs.get("title") or ""),
                                str(obs.get("summary") or ""),
                                str(obs.get("detail") or ""),
                                str(obs.get("created_at") or obs.get("timestamp") or ""),
                                str(obs.get("source") or "memory_observation"),
                                str(obs.get("stage") or "observation"),
                                "auto",
                                str(obs.get("task_id") or ""),
                                str(obs.get("task_title") or ""),
                                str(obs.get("session_id") or ""),
                                str(obs.get("target_type") or ""),
                                str(obs.get("target_id") or ""),
                                str(obs.get("event_type") or ""),
                                str(obs.get("status") or ""),
                                str(obs.get("digest") or ""),
                                1 if obs.get("derived") else 0,
                                str(obs.get("privacy_mode") or "public"),
                                int(obs.get("private_segment_count") or 0),
                                json.dumps(
                                    list(obs.get("redacted_fields") or []),
                                    ensure_ascii=False,
                                ),
                            ),
                        )
                        result["observations_migrated"] += 1
                    except Exception as e:
                        result["errors"].append(f"obs {observation_id}: {e}")
                await db.commit()
        except Exception as e:
            result["errors"].append(f"observation_log.json: {e}")
            try:
                await db.rollback()
            except Exception:
                pass

    ss_file = memory_dir / "session_summaries.json"
    if ss_file.exists():
        try:
            raw = ss_file.read_text(encoding="utf-8")
            sessions = json.loads(raw) if raw.strip() else []
            if isinstance(sessions, list):
                await db.execute("BEGIN")
                for entry in sessions:
                    if not isinstance(entry, dict):
                        continue
                    session_id = str(entry.get("session_id") or "")
                    digest = str(entry.get("digest") or "")
                    if not session_id and not digest:
                        continue
                    try:
                        topics = entry.get("topics")
                        if isinstance(topics, list):
                            topics = json.dumps(topics, ensure_ascii=False)
                        else:
                            topics = "[]"
                        redacted_fields = entry.get("redacted_fields")
                        if isinstance(redacted_fields, list):
                            redacted_fields = json.dumps(redacted_fields, ensure_ascii=False)
                        else:
                            redacted_fields = "[]"
                        trace_excerpt = entry.get("trace_excerpt")
                        if isinstance(trace_excerpt, list):
                            trace_excerpt = json.dumps(trace_excerpt, ensure_ascii=False)
                        else:
                            trace_excerpt = "[]"
                        last_active_progress = entry.get("last_active_progress")
                        if last_active_progress is not None:
                            try:
                                last_active_progress = int(last_active_progress)
                            except (TypeError, ValueError):
                                last_active_progress = None
                        await db.execute(
                            """
                            INSERT INTO session_summaries (
                                session_id, item_type, title, summary,
                                user_prompt_preview, assistant_preview, topics,
                                created_at, source, origin, digest, task_id,
                                task_title, status, event_type, privacy_mode,
                                private_segment_count, redacted_fields,
                                failure_label, recovery_action, resume_note,
                                last_error, result_preview, terminal_reason,
                                interrupted_reason, interrupted_origin,
                                current_status, last_active_status, last_active_at,
                                trace_excerpt, failure_category, attempted_status,
                                ignored_count, ignored_at, post_cancel_error,
                                interrupted_at, interrupt_count,
                                last_active_progress, workspace_dir, model
                            ) VALUES (
                                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                                ?, ?, ?, ?, ?, ?, ?, ?
                            )
                            """,
                            (
                                session_id,
                                str(entry.get("item_type") or "session_summary"),
                                str(entry.get("title") or ""),
                                str(entry.get("summary") or ""),
                                str(entry.get("user_prompt_preview") or ""),
                                str(entry.get("assistant_preview") or ""),
                                topics,
                                str(entry.get("created_at") or ""),
                                str(entry.get("source") or "chat"),
                                "auto",
                                digest,
                                str(entry.get("task_id") or ""),
                                str(entry.get("task_title") or ""),
                                str(entry.get("status") or ""),
                                str(entry.get("event_type") or ""),
                                str(entry.get("privacy_mode") or "public"),
                                int(entry.get("private_segment_count") or 0),
                                redacted_fields,
                                str(entry.get("failure_label") or ""),
                                str(entry.get("recovery_action") or ""),
                                str(entry.get("resume_note") or ""),
                                str(entry.get("last_error") or ""),
                                str(entry.get("result_preview") or ""),
                                str(entry.get("terminal_reason") or ""),
                                str(entry.get("interrupted_reason") or ""),
                                str(entry.get("interrupted_origin") or ""),
                                str(entry.get("current_status") or ""),
                                str(entry.get("last_active_status") or ""),
                                str(entry.get("last_active_at") or ""),
                                trace_excerpt,
                                str(entry.get("failure_category") or ""),
                                str(entry.get("attempted_status") or ""),
                                int(entry.get("ignored_count") or 0),
                                str(entry.get("ignored_at") or ""),
                                str(entry.get("post_cancel_error") or ""),
                                str(entry.get("interrupted_at") or ""),
                                int(entry.get("interrupt_count") or 0),
                                last_active_progress,
                                str(entry.get("workspace_dir") or ""),
                                str(entry.get("model") or ""),
                            ),
                        )
                        result["sessions_migrated"] += 1
                    except Exception as e:
                        result["errors"].append(f"session {session_id}: {e}")
                await db.commit()
        except Exception as e:
            result["errors"].append(f"session_summaries.json: {e}")
            try:
                await db.rollback()
            except Exception:
                pass

    await db.execute(
        "INSERT OR REPLACE INTO schema_meta(key, value) VALUES ('migrated_at', ?)",
        (datetime.now().isoformat(),),
    )
    await db.execute(
        "INSERT OR REPLACE INTO schema_meta(key, value) VALUES ('migration_result', ?)",
        (json.dumps(result, ensure_ascii=False),),
    )
    await db.commit()

    if obs_file.exists() and result["observations_migrated"] > 0:
        try:
            target = obs_file.with_suffix(".json.migrated")
            if target.exists():
                target.unlink()
            obs_file.rename(target)
        except Exception as e:
            result["errors"].append(f"rename observation_log.json: {e}")

    if ss_file.exists() and result["sessions_migrated"] > 0:
        try:
            target = ss_file.with_suffix(".json.migrated")
            if target.exists():
                target.unlink()
            ss_file.rename(target)
        except Exception as e:
            result["errors"].append(f"rename session_summaries.json: {e}")

    return result
