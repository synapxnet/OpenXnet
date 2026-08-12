#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
Token Meter — Token 用量追踪与统计分析引擎。

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

"""
OpenXnet — TokenMeter (py/usage/token_meter.py)
=================================================

v0.5.3 P0-3: Enterprise-grade token usage tracking engine.

Design:
  - SQLite WAL for concurrent read/write safety (same pattern as TemporalKG)
  - Per-request recording: model, tokens (in/out/cache_read/cache_create), cost, user, duration
  - Aggregation queries: by time range, user, model, grouped by hour/day/month
  - Thread-safe singleton (same pattern as SymbolStore)

Schema:
  usage_records (
    id TEXT PK,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    conversation_id TEXT,
    user_id TEXT DEFAULT 'default',
    model TEXT NOT NULL,
    provider TEXT,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    cache_read_tokens INTEGER DEFAULT 0,
    cache_creation_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER GENERATED,
    cost_usd REAL DEFAULT 0.0,
    duration_ms INTEGER DEFAULT 0,
    engine TEXT DEFAULT 'local',      -- 'local'|'cc'|'ds'|'qc'
    request_type TEXT DEFAULT 'chat', -- 'chat'|'completion'|'embedding'|'tool'
    success INTEGER DEFAULT 1
  )
"""

import json
import logging
import os
import sqlite3
import time
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple

logger = logging.getLogger("token_meter")


class TokenMeter:
    """
    Enterprise-grade token usage tracking backed by SQLite.
    Thread-safe, WAL mode, supports multi-user aggregation.
    """

    def __init__(self, db_path: str):
        self.db_path = db_path
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        self._connection = None
        self._init_db()
        logger.info(f"[TokenMeter] Initialized at {db_path}")

    def _conn(self) -> sqlite3.Connection:
        if self._connection is None:
            self._connection = sqlite3.connect(
                self.db_path,
                check_same_thread=False,
                timeout=10.0
            )
            self._connection.row_factory = sqlite3.Row
        return self._connection

    def _init_db(self):
        conn = self._conn()
        conn.executescript("""
            PRAGMA journal_mode=WAL;

            CREATE TABLE IF NOT EXISTS usage_records (
                id TEXT PRIMARY KEY,
                timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
                conversation_id TEXT,
                user_id TEXT DEFAULT 'default',
                model TEXT NOT NULL,
                provider TEXT,
                input_tokens INTEGER DEFAULT 0,
                output_tokens INTEGER DEFAULT 0,
                cache_read_tokens INTEGER DEFAULT 0,
                cache_creation_tokens INTEGER DEFAULT 0,
                total_tokens INTEGER DEFAULT 0,
                cost_usd REAL DEFAULT 0.0,
                duration_ms INTEGER DEFAULT 0,
                engine TEXT DEFAULT 'local',
                request_type TEXT DEFAULT 'chat',
                success INTEGER DEFAULT 1
            );

            CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON usage_records(timestamp);
            CREATE INDEX IF NOT EXISTS idx_usage_user ON usage_records(user_id);
            CREATE INDEX IF NOT EXISTS idx_usage_model ON usage_records(model);
            CREATE INDEX IF NOT EXISTS idx_usage_conversation ON usage_records(conversation_id);
            CREATE INDEX IF NOT EXISTS idx_usage_engine ON usage_records(engine);
        """)
        conn.commit()

    # =========================================================================
    # Record — 写入一条用量记录
    # =========================================================================

    def record(
        self,
        model: str,
        input_tokens: int = 0,
        output_tokens: int = 0,
        cache_read_tokens: int = 0,
        cache_creation_tokens: int = 0,
        cost_usd: float = 0.0,
        duration_ms: int = 0,
        user_id: str = "default",
        conversation_id: str = None,
        provider: str = None,
        engine: str = "local",
        request_type: str = "chat",
        success: bool = True,
    ) -> str:
        """
        Record a single usage event. Returns the record ID.
        """
        record_id = f"ur-{int(time.time() * 1000)}-{uuid.uuid4().hex[:6]}"
        total_tokens = input_tokens + output_tokens

        conn = self._conn()
        conn.execute(
            """INSERT INTO usage_records 
               (id, conversation_id, user_id, model, provider,
                input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens,
                total_tokens, cost_usd, duration_ms, engine, request_type, success)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                record_id, conversation_id, user_id, model, provider,
                input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens,
                total_tokens, cost_usd, duration_ms, engine, request_type,
                1 if success else 0,
            ),
        )
        conn.commit()

        logger.debug(
            f"[TokenMeter] Recorded: {record_id} model={model} "
            f"in={input_tokens} out={output_tokens} "
            f"cache_read={cache_read_tokens} cache_create={cache_creation_tokens} "
            f"cost=${cost_usd:.6f}"
        )
        return record_id

    # =========================================================================
    # Query — 用量查询
    # =========================================================================

    def get_summary(
        self,
        start: str = None,
        end: str = None,
        user_id: str = None,
        model: str = None,
        engine: str = None,
    ) -> Dict:
        """
        Get aggregated usage summary with optional filters.
        Returns: {total_requests, total_tokens, total_input, total_output,
                  total_cache_read, total_cache_creation, total_cost, avg_duration}
        """
        where_clauses = []
        params = []

        if start:
            where_clauses.append("timestamp >= ?")
            params.append(start)
        if end:
            where_clauses.append("timestamp <= ?")
            params.append(end)
        if user_id:
            where_clauses.append("user_id = ?")
            params.append(user_id)
        if model:
            where_clauses.append("model = ?")
            params.append(model)
        if engine:
            where_clauses.append("engine = ?")
            params.append(engine)

        where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

        conn = self._conn()
        row = conn.execute(
            f"""SELECT 
                COUNT(*) as total_requests,
                COALESCE(SUM(total_tokens), 0) as total_tokens,
                COALESCE(SUM(input_tokens), 0) as total_input,
                COALESCE(SUM(output_tokens), 0) as total_output,
                COALESCE(SUM(cache_read_tokens), 0) as total_cache_read,
                COALESCE(SUM(cache_creation_tokens), 0) as total_cache_creation,
                COALESCE(SUM(cost_usd), 0.0) as total_cost,
                COALESCE(AVG(duration_ms), 0) as avg_duration,
                SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count,
                SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failure_count
            FROM usage_records {where_sql}""",
            params,
        ).fetchone()

        return {
            "total_requests": row["total_requests"],
            "total_tokens": row["total_tokens"],
            "total_input": row["total_input"],
            "total_output": row["total_output"],
            "total_cache_read": row["total_cache_read"],
            "total_cache_creation": row["total_cache_creation"],
            "total_cost": round(row["total_cost"], 6),
            "avg_duration_ms": round(row["avg_duration"], 1),
            "success_count": row["success_count"],
            "failure_count": row["failure_count"],
        }

    def get_trend(
        self,
        group_by: str = "day",
        start: str = None,
        end: str = None,
        user_id: str = None,
        limit: int = 30,
    ) -> List[Dict]:
        """
        Get token usage trend grouped by hour/day/month.
        """
        if group_by == "hour":
            time_format = "%Y-%m-%d %H:00"
        elif group_by == "month":
            time_format = "%Y-%m"
        else:
            time_format = "%Y-%m-%d"

        where_clauses = []
        params = []

        if start:
            where_clauses.append("timestamp >= ?")
            params.append(start)
        if end:
            where_clauses.append("timestamp <= ?")
            params.append(end)
        if user_id:
            where_clauses.append("user_id = ?")
            params.append(user_id)

        where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
        params.append(limit)

        conn = self._conn()
        rows = conn.execute(
            f"""SELECT 
                strftime('{time_format}', timestamp) as period,
                COUNT(*) as requests,
                SUM(input_tokens) as input_tokens,
                SUM(output_tokens) as output_tokens,
                SUM(cache_read_tokens) as cache_read_tokens,
                SUM(cache_creation_tokens) as cache_creation_tokens,
                SUM(total_tokens) as total_tokens,
                SUM(cost_usd) as cost
            FROM usage_records {where_sql}
            GROUP BY period
            ORDER BY period DESC
            LIMIT ?""",
            params,
        ).fetchall()

        return [
            {
                "period": row["period"],
                "requests": row["requests"],
                "input_tokens": row["input_tokens"],
                "output_tokens": row["output_tokens"],
                "cache_read_tokens": row["cache_read_tokens"],
                "cache_creation_tokens": row["cache_creation_tokens"],
                "total_tokens": row["total_tokens"],
                "cost": round(row["cost"], 6),
            }
            for row in rows
        ]

    def get_by_model(
        self,
        start: str = None,
        end: str = None,
        user_id: str = None,
    ) -> List[Dict]:
        """
        Get usage breakdown by model.
        """
        where_clauses = []
        params = []

        if start:
            where_clauses.append("timestamp >= ?")
            params.append(start)
        if end:
            where_clauses.append("timestamp <= ?")
            params.append(end)
        if user_id:
            where_clauses.append("user_id = ?")
            params.append(user_id)

        where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

        conn = self._conn()
        rows = conn.execute(
            f"""SELECT 
                model,
                provider,
                COUNT(*) as requests,
                SUM(input_tokens) as input_tokens,
                SUM(output_tokens) as output_tokens,
                SUM(cache_read_tokens) as cache_read_tokens,
                SUM(total_tokens) as total_tokens,
                SUM(cost_usd) as cost
            FROM usage_records {where_sql}
            GROUP BY model, provider
            ORDER BY total_tokens DESC""",
            params,
        ).fetchall()

        return [
            {
                "model": row["model"],
                "provider": row["provider"],
                "requests": row["requests"],
                "input_tokens": row["input_tokens"],
                "output_tokens": row["output_tokens"],
                "cache_read_tokens": row["cache_read_tokens"],
                "total_tokens": row["total_tokens"],
                "cost": round(row["cost"], 6),
            }
            for row in rows
        ]

    def get_by_user(
        self,
        start: str = None,
        end: str = None,
    ) -> List[Dict]:
        """
        Get usage breakdown by user (Enterprise).
        """
        where_clauses = []
        params = []

        if start:
            where_clauses.append("timestamp >= ?")
            params.append(start)
        if end:
            where_clauses.append("timestamp <= ?")
            params.append(end)

        where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

        conn = self._conn()
        rows = conn.execute(
            f"""SELECT 
                user_id,
                COUNT(*) as requests,
                SUM(input_tokens) as input_tokens,
                SUM(output_tokens) as output_tokens,
                SUM(cache_read_tokens) as cache_read_tokens,
                SUM(total_tokens) as total_tokens,
                SUM(cost_usd) as cost,
                AVG(duration_ms) as avg_duration
            FROM usage_records {where_sql}
            GROUP BY user_id
            ORDER BY total_tokens DESC""",
            params,
        ).fetchall()

        return [
            {
                "user_id": row["user_id"],
                "requests": row["requests"],
                "input_tokens": row["input_tokens"],
                "output_tokens": row["output_tokens"],
                "cache_read_tokens": row["cache_read_tokens"],
                "total_tokens": row["total_tokens"],
                "cost": round(row["cost"], 6),
                "avg_duration_ms": round(row["avg_duration"], 1),
            }
            for row in rows
        ]

    def get_recent_records(
        self,
        limit: int = 50,
        offset: int = 0,
        user_id: str = None,
        model: str = None,
    ) -> Tuple[List[Dict], int]:
        """
        Get recent usage records with pagination.
        Returns: (records, total_count)
        """
        where_clauses = []
        params = []

        if user_id:
            where_clauses.append("user_id = ?")
            params.append(user_id)
        if model:
            where_clauses.append("model = ?")
            params.append(model)

        where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

        conn = self._conn()

        # Total count
        total = conn.execute(
            f"SELECT COUNT(*) as cnt FROM usage_records {where_sql}", params
        ).fetchone()["cnt"]

        # Page data
        page_params = params + [limit, offset]
        rows = conn.execute(
            f"""SELECT * FROM usage_records {where_sql}
            ORDER BY timestamp DESC
            LIMIT ? OFFSET ?""",
            page_params,
        ).fetchall()

        records = [dict(row) for row in rows]
        return records, total

    # =========================================================================
    # Stats — 快速统计
    # =========================================================================

    def stats(self) -> Dict:
        """Quick system-wide stats."""
        conn = self._conn()
        row = conn.execute(
            """SELECT 
                COUNT(*) as total_records,
                COUNT(DISTINCT user_id) as unique_users,
                COUNT(DISTINCT model) as unique_models,
                COALESCE(SUM(total_tokens), 0) as lifetime_tokens,
                COALESCE(SUM(cost_usd), 0.0) as lifetime_cost,
                MIN(timestamp) as first_record,
                MAX(timestamp) as last_record
            FROM usage_records"""
        ).fetchone()

        return {
            "total_records": row["total_records"],
            "unique_users": row["unique_users"],
            "unique_models": row["unique_models"],
            "lifetime_tokens": row["lifetime_tokens"],
            "lifetime_cost": round(row["lifetime_cost"], 6),
            "first_record": row["first_record"],
            "last_record": row["last_record"],
        }


# =========================================================================
# Global Singleton
# =========================================================================

_token_meter: Optional[TokenMeter] = None


def get_token_meter(data_dir: str = None) -> TokenMeter:
    """Get or create the global TokenMeter singleton."""
    global _token_meter
    if _token_meter is None:
        if data_dir is None:
            raise ValueError("data_dir must be provided on first call")
        db_path = os.path.join(data_dir, "usage_tracking.db")
        _token_meter = TokenMeter(db_path)
    return _token_meter


def init_token_meter(data_dir: str) -> TokenMeter:
    """Initialize the global TokenMeter (call at startup)."""
    return get_token_meter(data_dir)
