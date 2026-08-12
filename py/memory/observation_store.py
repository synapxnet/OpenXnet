#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
SQLite + FTS5 observation and session summary store.

Replaces the JSON-file-based observation_log.json / session_summaries.json
with a proper indexed database supporting full-text search via FTS5, anchor-
based timeline windowing, and origin-based filtering (auto vs manual).

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
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import aiosqlite

_SCHEMA_VERSION = "1"

_SCHEMA_SQL = """
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS observations (
    observation_id TEXT PRIMARY KEY,
    item_type      TEXT NOT NULL DEFAULT 'observation',
    title          TEXT NOT NULL DEFAULT '',
    summary        TEXT NOT NULL DEFAULT '',
    detail         TEXT NOT NULL DEFAULT '',
    created_at     TEXT NOT NULL,
    source         TEXT NOT NULL DEFAULT 'memory_observation',
    stage          TEXT NOT NULL DEFAULT 'observation',
    origin         TEXT NOT NULL DEFAULT 'auto',
    task_id        TEXT NOT NULL DEFAULT '',
    task_title     TEXT NOT NULL DEFAULT '',
    session_id     TEXT NOT NULL DEFAULT '',
    target_type    TEXT NOT NULL DEFAULT '',
    target_id      TEXT NOT NULL DEFAULT '',
    event_type     TEXT NOT NULL DEFAULT '',
    status         TEXT NOT NULL DEFAULT '',
    digest         TEXT NOT NULL DEFAULT '',
    derived        INTEGER NOT NULL DEFAULT 0,
    privacy_mode   TEXT NOT NULL DEFAULT 'public',
    private_segment_count INTEGER NOT NULL DEFAULT 0,
    redacted_fields TEXT NOT NULL DEFAULT '[]',
    extra          TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS session_summaries (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id      TEXT NOT NULL DEFAULT '',
    item_type       TEXT NOT NULL DEFAULT 'session_summary',
    title           TEXT NOT NULL DEFAULT '',
    summary         TEXT NOT NULL DEFAULT '',
    user_prompt_preview TEXT NOT NULL DEFAULT '',
    assistant_preview   TEXT NOT NULL DEFAULT '',
    topics          TEXT NOT NULL DEFAULT '[]',
    created_at      TEXT NOT NULL,
    source          TEXT NOT NULL DEFAULT 'chat',
    origin          TEXT NOT NULL DEFAULT 'auto',
    digest          TEXT NOT NULL DEFAULT '',
    task_id         TEXT NOT NULL DEFAULT '',
    task_title      TEXT NOT NULL DEFAULT '',
    status          TEXT NOT NULL DEFAULT '',
    event_type      TEXT NOT NULL DEFAULT '',
    privacy_mode    TEXT NOT NULL DEFAULT 'public',
    private_segment_count INTEGER NOT NULL DEFAULT 0,
    redacted_fields TEXT NOT NULL DEFAULT '[]',
    failure_label   TEXT NOT NULL DEFAULT '',
    recovery_action TEXT NOT NULL DEFAULT '',
    resume_note     TEXT NOT NULL DEFAULT '',
    last_error      TEXT NOT NULL DEFAULT '',
    result_preview  TEXT NOT NULL DEFAULT '',
    terminal_reason TEXT NOT NULL DEFAULT '',
    interrupted_reason TEXT NOT NULL DEFAULT '',
    interrupted_origin TEXT NOT NULL DEFAULT '',
    current_status  TEXT NOT NULL DEFAULT '',
    last_active_status TEXT NOT NULL DEFAULT '',
    last_active_at  TEXT NOT NULL DEFAULT '',
    trace_excerpt   TEXT NOT NULL DEFAULT '[]',
    failure_category TEXT NOT NULL DEFAULT '',
    attempted_status TEXT NOT NULL DEFAULT '',
    ignored_count   INTEGER NOT NULL DEFAULT 0,
    ignored_at      TEXT NOT NULL DEFAULT '',
    post_cancel_error TEXT NOT NULL DEFAULT '',
    interrupted_at  TEXT NOT NULL DEFAULT '',
    interrupt_count INTEGER NOT NULL DEFAULT 0,
    last_active_progress INTEGER,
    workspace_dir   TEXT NOT NULL DEFAULT '',
    model           TEXT NOT NULL DEFAULT '',
    extra           TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS schema_meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""

_FTS_SQL = """
CREATE VIRTUAL TABLE IF NOT EXISTS observations_fts USING fts5(
    title, summary, detail, task_title, stage, event_type,
    content='observations', content_rowid='rowid',
    tokenize='unicode61 remove_diacritics 2'
);

CREATE VIRTUAL TABLE IF NOT EXISTS sessions_fts USING fts5(
    title, summary, user_prompt_preview, task_title,
    status, event_type, failure_label, recovery_action, resume_note,
    content='session_summaries', content_rowid='rowid',
    tokenize='unicode61 remove_diacritics 2'
);
"""

_FTS_TRIGGERS_SQL = """
CREATE TRIGGER IF NOT EXISTS observations_ai AFTER INSERT ON observations BEGIN
    INSERT INTO observations_fts(rowid, title, summary, detail, task_title, stage, event_type)
    VALUES (new.rowid, new.title, new.summary, new.detail, new.task_title, new.stage, new.event_type);
END;

CREATE TRIGGER IF NOT EXISTS observations_ad AFTER DELETE ON observations BEGIN
    INSERT INTO observations_fts(observations_fts, rowid, title, summary, detail, task_title, stage, event_type)
    VALUES ('delete', old.rowid, old.title, old.summary, old.detail, old.task_title, old.stage, old.event_type);
END;

CREATE TRIGGER IF NOT EXISTS observations_au AFTER UPDATE ON observations BEGIN
    INSERT INTO observations_fts(observations_fts, rowid, title, summary, detail, task_title, stage, event_type)
    VALUES ('delete', old.rowid, old.title, old.summary, old.detail, old.task_title, old.stage, old.event_type);
    INSERT INTO observations_fts(rowid, title, summary, detail, task_title, stage, event_type)
    VALUES (new.rowid, new.title, new.summary, new.detail, new.task_title, new.stage, new.event_type);
END;

CREATE TRIGGER IF NOT EXISTS sessions_ai AFTER INSERT ON session_summaries BEGIN
    INSERT INTO sessions_fts(rowid, title, summary, user_prompt_preview, task_title, status, event_type, failure_label, recovery_action, resume_note)
    VALUES (new.rowid, new.title, new.summary, new.user_prompt_preview, new.task_title, new.status, new.event_type, new.failure_label, new.recovery_action, new.resume_note);
END;

CREATE TRIGGER IF NOT EXISTS sessions_ad AFTER DELETE ON session_summaries BEGIN
    INSERT INTO sessions_fts(sessions_fts, rowid, title, summary, user_prompt_preview, task_title, status, event_type, failure_label, recovery_action, resume_note)
    VALUES ('delete', old.rowid, old.title, old.summary, old.user_prompt_preview, old.task_title, old.status, old.event_type, old.failure_label, old.recovery_action, old.resume_note);
END;

CREATE TRIGGER IF NOT EXISTS sessions_au AFTER UPDATE ON session_summaries BEGIN
    INSERT INTO sessions_fts(sessions_fts, rowid, title, summary, user_prompt_preview, task_title, status, event_type, failure_label, recovery_action, resume_note)
    VALUES ('delete', old.rowid, old.title, old.summary, old.user_prompt_preview, old.task_title, old.status, old.event_type, old.failure_label, old.recovery_action, old.resume_note);
    INSERT INTO sessions_fts(rowid, title, summary, user_prompt_preview, task_title, status, event_type, failure_label, recovery_action, resume_note)
    VALUES (new.rowid, new.title, new.summary, new.user_prompt_preview, new.task_title, new.status, new.event_type, new.failure_label, new.recovery_action, new.resume_note);
END;
"""

_INDEX_SQL = """
CREATE INDEX IF NOT EXISTS idx_obs_task_id    ON observations(task_id)    WHERE task_id != '';
CREATE INDEX IF NOT EXISTS idx_obs_session_id ON observations(session_id) WHERE session_id != '';
CREATE INDEX IF NOT EXISTS idx_obs_digest     ON observations(digest)     WHERE digest != '';
CREATE INDEX IF NOT EXISTS idx_obs_created    ON observations(created_at);
CREATE INDEX IF NOT EXISTS idx_obs_origin     ON observations(origin);
CREATE INDEX IF NOT EXISTS idx_ss_digest      ON session_summaries(digest)   WHERE digest != '';
CREATE INDEX IF NOT EXISTS idx_ss_task_id     ON session_summaries(task_id)  WHERE task_id != '';
CREATE INDEX IF NOT EXISTS idx_ss_created     ON session_summaries(created_at);
CREATE INDEX IF NOT EXISTS idx_ss_item_type   ON session_summaries(item_type);
CREATE INDEX IF NOT EXISTS idx_ss_origin      ON session_summaries(origin);
"""

_OBSERVATION_COLUMNS = [
    "observation_id", "item_type", "title", "summary", "detail",
    "created_at", "source", "stage", "origin", "task_id", "task_title",
    "session_id", "target_type", "target_id", "event_type", "status",
    "digest", "derived", "privacy_mode", "private_segment_count",
    "redacted_fields", "extra",
]

_SESSION_COLUMNS = [
    "id", "session_id", "item_type", "title", "summary",
    "user_prompt_preview", "assistant_preview", "topics", "created_at",
    "source", "origin", "digest", "task_id", "task_title", "status",
    "event_type", "privacy_mode", "private_segment_count",
    "redacted_fields", "failure_label", "recovery_action", "resume_note",
    "last_error", "result_preview", "terminal_reason",
    "interrupted_reason", "interrupted_origin", "current_status",
    "last_active_status", "last_active_at", "trace_excerpt",
    "failure_category", "attempted_status", "ignored_count", "ignored_at",
    "post_cancel_error", "interrupted_at", "interrupt_count",
    "last_active_progress", "workspace_dir", "model", "extra",
]

_FTS_TOKEN_PATTERN = re.compile(r"[\w\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]+", re.UNICODE)
_FTS_UNSAFE_PATTERN = re.compile(r'[^\w\s"\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]', re.UNICODE)

_event_bus = None


def _set_event_bus(bus):
    global _event_bus
    _event_bus = bus


def _get_event_bus():
    return _event_bus


class ObservationStore:
    """Async SQLite+FTS5 observation and session summary store."""

    def __init__(self, workspace_dir: str):
        self.workspace_dir = Path(workspace_dir).expanduser()
        self.memory_dir = self.workspace_dir / ".agent" / "memory"
        self.db_path = self.memory_dir / "observations.db"
        self._db: Optional[aiosqlite.Connection] = None
        self._initialized = False
        self._init_lock = asyncio.Lock()
        self._fts_available = False

    async def initialize(self) -> None:
        async with self._init_lock:
            if self._initialized:
                return
            self.memory_dir.mkdir(parents=True, exist_ok=True)
            needs_migration = (
                not self.db_path.exists()
                and (
                    (self.memory_dir / "observation_log.json").exists()
                    or (self.memory_dir / "session_summaries.json").exists()
                )
            )
            self._db = await aiosqlite.connect(str(self.db_path))
            self._db.row_factory = aiosqlite.Row
            for statement in _SCHEMA_SQL.strip().split(";"):
                statement = statement.strip()
                if statement:
                    await self._db.execute(statement)
            await self._db.commit()
            self._fts_available = await self._try_create_fts()
            for statement in _INDEX_SQL.strip().split(";"):
                statement = statement.strip()
                if statement:
                    try:
                        await self._db.execute(statement)
                    except Exception:
                        pass
            await self._db.execute(
                "INSERT OR IGNORE INTO schema_meta(key, value) VALUES ('version', ?)",
                (_SCHEMA_VERSION,),
            )
            await self._db.execute(
                "INSERT OR IGNORE INTO schema_meta(key, value) VALUES ('created_at', ?)",
                (datetime.now().isoformat(),),
            )
            await self._db.commit()
            if needs_migration:
                await self._run_migration()
            self._initialized = True

    async def _try_create_fts(self) -> bool:
        try:
            for statement in _FTS_SQL.strip().split(";"):
                statement = statement.strip()
                if statement:
                    await self._db.execute(statement)
            for statement in _FTS_TRIGGERS_SQL.strip().split(";"):
                statement = statement.strip()
                if statement:
                    await self._db.execute(statement)
            await self._db.commit()
            return True
        except Exception:
            await self._db.rollback()
            return False

    async def _run_migration(self) -> None:
        try:
            from py.memory.migration import migrate_json_to_sqlite
            await migrate_json_to_sqlite(self.memory_dir, self._db)
        except Exception:
            pass

    async def close(self) -> None:
        if self._db:
            try:
                await self._db.close()
            except Exception:
                pass
            self._db = None
        self._initialized = False

    async def _ensure_initialized(self) -> None:
        if not self._initialized:
            await self.initialize()

    # ── Write operations ────────────────────────────────

    async def upsert_observation(self, obs: dict) -> str:
        await self._ensure_initialized()
        observation_id = str(obs.get("observation_id") or "")
        if not observation_id:
            return ""
        columns = [c for c in _OBSERVATION_COLUMNS if c in obs or c == "observation_id"]
        placeholders = ", ".join("?" for _ in columns)
        col_names = ", ".join(columns)
        values = []
        for col in columns:
            val = obs.get(col, "")
            if col == "redacted_fields" and isinstance(val, list):
                val = json.dumps(val, ensure_ascii=False)
            elif col == "extra" and isinstance(val, dict):
                val = json.dumps(val, ensure_ascii=False)
            elif col == "derived":
                val = 1 if val else 0
            values.append(val)
        sql = f"INSERT OR REPLACE INTO observations ({col_names}) VALUES ({placeholders})"
        await self._db.execute(sql, values)
        await self._db.commit()
        await self._publish_event("observation_new", obs)
        return observation_id

    async def upsert_observations(self, observations: list) -> int:
        await self._ensure_initialized()
        count = 0
        await self._db.execute("BEGIN")
        try:
            for obs in observations:
                observation_id = str(obs.get("observation_id") or "")
                if not observation_id:
                    continue
                values = self._obs_to_row(obs)
                col_names = ", ".join(_OBSERVATION_COLUMNS)
                placeholders = ", ".join("?" for _ in _OBSERVATION_COLUMNS)
                sql = f"INSERT OR REPLACE INTO observations ({col_names}) VALUES ({placeholders})"
                await self._db.execute(sql, values)
                count += 1
            await self._db.commit()
        except Exception:
            await self._db.rollback()
            raise
        if count > 0:
            await self._publish_event("observation_batch", {
                "count": count,
                "observations": observations[:3],
            })
        return count

    async def upsert_session_summary(self, entry: dict) -> str:
        await self._ensure_initialized()
        digest = str(entry.get("digest") or "")
        session_id = str(entry.get("session_id") or "")
        if not digest and not session_id:
            return ""
        existing = None
        if digest:
            cursor = await self._db.execute(
                "SELECT id FROM session_summaries WHERE digest = ? LIMIT 1",
                (digest,),
            )
            existing = await cursor.fetchone()
        if existing:
            sets = []
            values = []
            for col in _SESSION_COLUMNS:
                if col == "id":
                    continue
                val = entry.get(col)
                if val is None:
                    continue
                if col in ("topics", "redacted_fields", "trace_excerpt") and isinstance(val, list):
                    val = json.dumps(val, ensure_ascii=False)
                elif col == "extra" and isinstance(val, dict):
                    val = json.dumps(val, ensure_ascii=False)
                sets.append(f"{col} = ?")
                values.append(val)
            if sets:
                values.append(existing["id"])
                sql = f"UPDATE session_summaries SET {', '.join(sets)} WHERE id = ?"
                await self._db.execute(sql, values)
                await self._db.commit()
                await self._publish_event("session_update", entry)
        else:
            values = self._session_to_row(entry)
            col_names = ", ".join(c for c in _SESSION_COLUMNS if c != "id")
            placeholders = ", ".join("?" for c in _SESSION_COLUMNS if c != "id")
            sql = f"INSERT INTO session_summaries ({col_names}) VALUES ({placeholders})"
            await self._db.execute(sql, values)
            await self._db.commit()
            await self._publish_event("session_new", entry)
        return digest or session_id

    async def trim_observations(self, max_count: int = 240) -> int:
        await self._ensure_initialized()
        cursor = await self._db.execute("SELECT COUNT(*) FROM observations")
        row = await cursor.fetchone()
        total = row[0] if row else 0
        if total <= max_count:
            return 0
        to_delete = total - max_count
        await self._db.execute(
            """
            DELETE FROM observations WHERE observation_id IN (
                SELECT observation_id FROM observations
                ORDER BY created_at ASC LIMIT ?
            )
            """,
            (to_delete,),
        )
        await self._db.commit()
        return to_delete

    async def trim_session_summaries(
        self, max_sessions: int = 80, max_task_events: int = 120
    ) -> int:
        await self._ensure_initialized()
        deleted = 0
        for item_type, cap in [("session_summary", max_sessions), ("task_event", max_task_events)]:
            cursor = await self._db.execute(
                "SELECT COUNT(*) FROM session_summaries WHERE item_type = ?",
                (item_type,),
            )
            row = await cursor.fetchone()
            total = row[0] if row else 0
            if total <= cap:
                continue
            to_delete = total - cap
            await self._db.execute(
                """
                DELETE FROM session_summaries WHERE id IN (
                    SELECT id FROM session_summaries
                    WHERE item_type = ?
                    ORDER BY created_at ASC LIMIT ?
                )
                """,
                (item_type, to_delete),
            )
            deleted += to_delete
        if deleted > 0:
            await self._db.commit()
        return deleted

    # ── 3-layer search engine ───────────────────────────

    async def search_fts(
        self, query: str, limit: int = 8, origin: str = ""
    ) -> list:
        await self._ensure_initialized()
        normalized = (query or "").strip()
        if not normalized:
            return []
        results = []
        if self._fts_available:
            fts_query = self._prepare_fts_query(normalized)
            if fts_query:
                results = await self._search_with_fts(fts_query, limit, origin)
        if not results:
            results = await self._search_with_like(normalized, limit, origin)
        return results

    async def _search_with_fts(
        self, fts_query: str, limit: int, origin: str
    ) -> list:
        results = []
        try:
            obs_sql = """
                SELECT o.*, bm25(observations_fts) AS rank
                FROM observations_fts
                JOIN observations o ON o.rowid = observations_fts.rowid
                WHERE observations_fts MATCH ?
            """
            params: list = [fts_query]
            if origin:
                obs_sql += " AND o.origin = ?"
                params.append(origin)
            obs_sql += " ORDER BY rank LIMIT ?"
            params.append(limit)
            cursor = await self._db.execute(obs_sql, params)
            rows = await cursor.fetchall()
            for row in rows:
                item = self._row_to_observation_dict(row)
                item["_source"] = "observation_store"
                item["_score"] = abs(float(row["rank"])) if "rank" in row.keys() else 0.0
                results.append(item)
        except Exception:
            pass
        try:
            ss_sql = """
                SELECT s.*, bm25(sessions_fts) AS rank
                FROM sessions_fts
                JOIN session_summaries s ON s.rowid = sessions_fts.rowid
                WHERE sessions_fts MATCH ?
            """
            params = [fts_query]
            if origin:
                ss_sql += " AND s.origin = ?"
                params.append(origin)
            ss_sql += " ORDER BY rank LIMIT ?"
            params.append(limit)
            cursor = await self._db.execute(ss_sql, params)
            rows = await cursor.fetchall()
            for row in rows:
                item = self._row_to_session_dict(row)
                item["_source"] = "observation_store"
                item["_score"] = abs(float(row["rank"])) if "rank" in row.keys() else 0.0
                results.append(item)
        except Exception:
            pass
        seen_digests = set()
        deduped = []
        for item in sorted(results, key=lambda x: x.get("_score", 0), reverse=True):
            digest = item.get("digest", "")
            if digest and digest in seen_digests:
                continue
            if digest:
                seen_digests.add(digest)
            deduped.append(item)
        return deduped[:limit]

    async def _search_with_like(
        self, query: str, limit: int, origin: str
    ) -> list:
        tokens = _FTS_TOKEN_PATTERN.findall(query.lower())
        if not tokens:
            return []
        results = []
        conditions = " OR ".join(
            "(title LIKE ? OR summary LIKE ? OR detail LIKE ? OR task_title LIKE ?)"
            for _ in tokens
        )
        params: list = []
        for token in tokens:
            pattern = f"%{token}%"
            params.extend([pattern, pattern, pattern, pattern])
        obs_sql = f"SELECT * FROM observations WHERE ({conditions})"
        if origin:
            obs_sql += " AND origin = ?"
            params.append(origin)
        obs_sql += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)
        cursor = await self._db.execute(obs_sql, params)
        rows = await cursor.fetchall()
        for row in rows:
            item = self._row_to_observation_dict(row)
            item["_source"] = "observation_store"
            item["_score"] = sum(
                1 for t in tokens
                if t in (item.get("title", "") + item.get("summary", "")).lower()
            )
            results.append(item)
        ss_conditions = " OR ".join(
            "(title LIKE ? OR summary LIKE ? OR user_prompt_preview LIKE ? OR task_title LIKE ?)"
            for _ in tokens
        )
        ss_params: list = []
        for token in tokens:
            pattern = f"%{token}%"
            ss_params.extend([pattern, pattern, pattern, pattern])
        ss_sql = f"SELECT * FROM session_summaries WHERE ({ss_conditions})"
        if origin:
            ss_sql += " AND origin = ?"
            ss_params.append(origin)
        ss_sql += " ORDER BY created_at DESC LIMIT ?"
        ss_params.append(limit)
        cursor = await self._db.execute(ss_sql, ss_params)
        rows = await cursor.fetchall()
        for row in rows:
            item = self._row_to_session_dict(row)
            item["_source"] = "observation_store"
            item["_score"] = sum(
                1 for t in tokens
                if t in (item.get("title", "") + item.get("summary", "")).lower()
            )
            results.append(item)
        seen_digests = set()
        deduped = []
        for item in sorted(results, key=lambda x: x.get("_score", 0), reverse=True):
            digest = item.get("digest", "")
            if digest and digest in seen_digests:
                continue
            if digest:
                seen_digests.add(digest)
            deduped.append(item)
        return deduped[:limit]

    async def get_overview(self, limit: int = 8) -> dict:
        await self._ensure_initialized()
        cursor = await self._db.execute(
            "SELECT * FROM session_summaries WHERE item_type = 'session_summary' "
            "ORDER BY created_at DESC LIMIT ?",
            (limit,),
        )
        recent_sessions = [self._row_to_session_dict(r) for r in await cursor.fetchall()]
        cursor = await self._db.execute(
            "SELECT * FROM observations ORDER BY created_at DESC LIMIT ?",
            (limit,),
        )
        recent_observations = [self._row_to_observation_dict(r) for r in await cursor.fetchall()]
        cursor = await self._db.execute(
            "SELECT COUNT(*) FROM session_summaries WHERE item_type = 'session_summary'"
        )
        session_count = (await cursor.fetchone())[0]
        cursor = await self._db.execute(
            "SELECT COUNT(*) FROM session_summaries WHERE item_type = 'task_event'"
        )
        task_event_count = (await cursor.fetchone())[0]
        cursor = await self._db.execute("SELECT COUNT(*) FROM observations")
        observation_count = (await cursor.fetchone())[0]
        cursor = await self._db.execute("SELECT COUNT(*) FROM session_summaries")
        entry_count = (await cursor.fetchone())[0]
        return {
            "recent_sessions": recent_sessions,
            "recent_observations": recent_observations,
            "user_profile": {},
            "stats": {
                "session_count": session_count,
                "task_event_count": task_event_count,
                "entry_count": entry_count,
                "observation_count": observation_count,
                "topic_count": 0,
                "workflow_count": 0,
                "interaction_count": session_count,
                "task_memory_count": task_event_count,
            },
        }

    async def get_timeline(
        self, query: str = "", limit: int = 20, origin: str = ""
    ) -> list:
        await self._ensure_initialized()
        normalized_query = (query or "").strip()
        if normalized_query and self._fts_available:
            fts_query = self._prepare_fts_query(normalized_query)
            if fts_query:
                return await self._timeline_fts(fts_query, limit, origin)
        sql = "SELECT * FROM session_summaries"
        params: list = []
        conditions = []
        if origin:
            conditions.append("origin = ?")
            params.append(origin)
        if conditions:
            sql += " WHERE " + " AND ".join(conditions)
        sql += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)
        cursor = await self._db.execute(sql, params)
        rows = await cursor.fetchall()
        timeline = []
        for row in rows:
            item = self._row_to_session_dict(row)
            obs_count = await self.count_observations_for_entry(
                task_id=item.get("task_id", ""),
                session_id=item.get("session_id", ""),
                digest=item.get("digest", ""),
            )
            item["observation_count"] = obs_count
            timeline.append(item)
        return timeline

    async def _timeline_fts(
        self, fts_query: str, limit: int, origin: str
    ) -> list:
        try:
            sql = """
                SELECT s.*, bm25(sessions_fts) AS rank
                FROM sessions_fts
                JOIN session_summaries s ON s.rowid = sessions_fts.rowid
                WHERE sessions_fts MATCH ?
            """
            params: list = [fts_query]
            if origin:
                sql += " AND s.origin = ?"
                params.append(origin)
            sql += " ORDER BY rank LIMIT ?"
            params.append(limit)
            cursor = await self._db.execute(sql, params)
            rows = await cursor.fetchall()
            timeline = []
            for row in rows:
                item = self._row_to_session_dict(row)
                obs_count = await self.count_observations_for_entry(
                    task_id=item.get("task_id", ""),
                    session_id=item.get("session_id", ""),
                    digest=item.get("digest", ""),
                )
                item["observation_count"] = obs_count
                timeline.append(item)
            return timeline
        except Exception:
            return []

    async def get_timeline_window(
        self,
        *,
        task_id: str = "",
        session_id: str = "",
        digest: str = "",
        query: str = "",
        depth_before: int = 3,
        depth_after: int = 4,
    ) -> dict:
        await self._ensure_initialized()
        anchor_item = await self._find_anchor(task_id, session_id, digest)
        if not anchor_item:
            return {
                "anchor": {
                    "task_id": task_id,
                    "session_id": session_id,
                    "digest": digest,
                    "matched": False,
                },
                "timeline": [],
            }
        anchor_created = anchor_item.get("created_at", "")
        before_sql = (
            "SELECT * FROM session_summaries WHERE created_at < ? "
            "ORDER BY created_at DESC LIMIT ?"
        )
        cursor = await self._db.execute(before_sql, (anchor_created, depth_before))
        before_rows = list(reversed(await cursor.fetchall()))
        after_sql = (
            "SELECT * FROM session_summaries WHERE created_at > ? "
            "ORDER BY created_at ASC LIMIT ?"
        )
        cursor = await self._db.execute(after_sql, (anchor_created, depth_after))
        after_rows = await cursor.fetchall()
        timeline = []
        for row in before_rows:
            item = self._row_to_session_dict(row)
            obs_count = await self.count_observations_for_entry(
                task_id=item.get("task_id", ""),
                session_id=item.get("session_id", ""),
                digest=item.get("digest", ""),
            )
            item["observation_count"] = obs_count
            timeline.append(item)
        anchor_item["timeline_anchor"] = True
        obs_count = await self.count_observations_for_entry(
            task_id=anchor_item.get("task_id", ""),
            session_id=anchor_item.get("session_id", ""),
            digest=anchor_item.get("digest", ""),
        )
        anchor_item["observation_count"] = obs_count
        timeline.append(anchor_item)
        for row in after_rows:
            item = self._row_to_session_dict(row)
            obs_count = await self.count_observations_for_entry(
                task_id=item.get("task_id", ""),
                session_id=item.get("session_id", ""),
                digest=item.get("digest", ""),
            )
            item["observation_count"] = obs_count
            timeline.append(item)
        return {
            "anchor": {
                "task_id": task_id,
                "session_id": session_id,
                "digest": digest,
                "matched": True,
            },
            "timeline": timeline,
        }

    async def _find_anchor(
        self, task_id: str, session_id: str, digest: str
    ) -> Optional[dict]:
        for col, val in [("digest", digest), ("task_id", task_id), ("session_id", session_id)]:
            val = (val or "").strip()
            if not val:
                continue
            cursor = await self._db.execute(
                f"SELECT * FROM session_summaries WHERE {col} = ? ORDER BY created_at DESC LIMIT 1",
                (val,),
            )
            row = await cursor.fetchone()
            if row:
                return self._row_to_session_dict(row)
        return None

    async def get_observations(
        self,
        *,
        task_id: str = "",
        session_id: str = "",
        digest: str = "",
        query: str = "",
        limit: int = 80,
        origin: str = "",
    ) -> list:
        await self._ensure_initialized()
        conditions = []
        params: list = []
        if task_id:
            conditions.append("task_id = ?")
            params.append(task_id)
        if session_id:
            conditions.append("session_id = ?")
            params.append(session_id)
        if digest:
            conditions.append("digest = ?")
            params.append(digest)
        if origin:
            conditions.append("origin = ?")
            params.append(origin)
        if not conditions and not query:
            return []
        sql = "SELECT * FROM observations"
        if conditions:
            sql += " WHERE " + " AND ".join(conditions)
        sql += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)
        cursor = await self._db.execute(sql, params)
        rows = await cursor.fetchall()
        results = [self._row_to_observation_dict(r) for r in rows]
        if query:
            tokens = _FTS_TOKEN_PATTERN.findall(query.lower())
            if tokens:
                results = [
                    r for r in results
                    if any(
                        t in (r.get("title", "") + r.get("summary", "") + r.get("detail", "")).lower()
                        for t in tokens
                    )
                ]
        return results

    async def count_observations_for_entry(
        self, task_id: str = "", session_id: str = "", digest: str = ""
    ) -> int:
        await self._ensure_initialized()
        conditions = []
        params: list = []
        if task_id:
            conditions.append("task_id = ?")
            params.append(task_id)
        if session_id:
            conditions.append("session_id = ?")
            params.append(session_id)
        if digest:
            conditions.append("digest = ?")
            params.append(digest)
        if not conditions:
            return 0
        sql = "SELECT COUNT(*) FROM observations WHERE " + " AND ".join(conditions)
        cursor = await self._db.execute(sql, params)
        row = await cursor.fetchone()
        return row[0] if row else 0

    # ── Internal helpers ────────────────────────────────

    def _obs_to_row(self, obs: dict) -> list:
        values = []
        for col in _OBSERVATION_COLUMNS:
            val = obs.get(col, "")
            if col == "redacted_fields" and isinstance(val, list):
                val = json.dumps(val, ensure_ascii=False)
            elif col == "extra" and isinstance(val, dict):
                val = json.dumps(val, ensure_ascii=False)
            elif col == "derived":
                val = 1 if val else 0
            elif val is None:
                val = ""
            values.append(val)
        return values

    def _session_to_row(self, entry: dict) -> list:
        values = []
        for col in _SESSION_COLUMNS:
            if col == "id":
                continue
            val = entry.get(col, "")
            if col in ("topics", "redacted_fields", "trace_excerpt") and isinstance(val, list):
                val = json.dumps(val, ensure_ascii=False)
            elif col == "extra" and isinstance(val, dict):
                val = json.dumps(val, ensure_ascii=False)
            elif val is None:
                if col == "last_active_progress":
                    val = None
                else:
                    val = ""
            values.append(val)
        return values

    def _row_to_observation_dict(self, row) -> dict:
        d = dict(row)
        d.pop("rowid", None)
        d.pop("rank", None)
        if "derived" in d:
            d["derived"] = bool(d["derived"])
        if "redacted_fields" in d and isinstance(d["redacted_fields"], str):
            try:
                d["redacted_fields"] = json.loads(d["redacted_fields"])
            except (json.JSONDecodeError, TypeError):
                d["redacted_fields"] = []
        d.setdefault("timestamp", d.get("created_at", ""))
        return d

    def _row_to_session_dict(self, row) -> dict:
        d = dict(row)
        d.pop("rowid", None)
        d.pop("rank", None)
        for field in ("topics", "redacted_fields", "trace_excerpt"):
            if field in d and isinstance(d[field], str):
                try:
                    d[field] = json.loads(d[field])
                except (json.JSONDecodeError, TypeError):
                    d[field] = []
        return d

    def _prepare_fts_query(self, raw_query: str) -> str:
        tokens = _FTS_TOKEN_PATTERN.findall(raw_query)
        if not tokens:
            return ""
        quoted = [f'"{t}"' for t in tokens[:12]]
        return " OR ".join(quoted)

    async def _publish_event(self, event_type: str, data: dict) -> None:
        bus = _get_event_bus()
        if bus is None:
            return
        try:
            await bus.publish(event_type, data)
        except Exception:
            pass


_store_cache: Dict[str, ObservationStore] = {}
_store_lock = asyncio.Lock()


async def get_observation_store(workspace_dir: str) -> ObservationStore:
    normalized = str(Path(workspace_dir).expanduser().resolve())
    if normalized in _store_cache:
        store = _store_cache[normalized]
        if not store._initialized:
            await store.initialize()
        return store
    async with _store_lock:
        if normalized not in _store_cache:
            store = ObservationStore(workspace_dir)
            _store_cache[normalized] = store
        store = _store_cache[normalized]
    await store.initialize()
    return store


async def close_all_stores() -> None:
    for store in list(_store_cache.values()):
        await store.close()
    _store_cache.clear()
