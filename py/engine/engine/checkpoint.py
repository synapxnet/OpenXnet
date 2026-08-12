"""
OpenXnet v0.5.2 — QueryEngine Checkpoint (checkpoint.py)
=========================================================

P1 韧性机制：在 QueryEngine 每次状态转换时写入 SQLite checkpoint。
支持进程崩溃恢复：重启后可检测到未完成的 turn 并提示用户。
"""

import json
import logging
import os
import sqlite3
import time
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, List, Any

logger = logging.getLogger("engine_checkpoint")


class EngineCheckpoint:
    """
    Persistent checkpoint store for QueryEngine state recovery.
    Stores the engine state at each phase transition so that
    after a crash, the system can detect interrupted turns.
    """

    def __init__(self, db_path: str):
        self.db_path = db_path
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self._conn: Optional[sqlite3.Connection] = None
        self._init_db()

    def _get_conn(self) -> sqlite3.Connection:
        if self._conn is None:
            self._conn = sqlite3.connect(
                self.db_path, timeout=5, check_same_thread=False
            )
            self._conn.execute("PRAGMA journal_mode=WAL")
            self._conn.row_factory = sqlite3.Row
        return self._conn

    def _init_db(self):
        conn = self._get_conn()
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS engine_checkpoints (
                turn_id TEXT PRIMARY KEY,
                state TEXT NOT NULL,
                model TEXT,
                user_prompt TEXT,
                messages_snapshot TEXT,
                tool_calls_log TEXT DEFAULT '[]',
                started_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                completed_at TEXT,
                error TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_cp_state
                ON engine_checkpoints(state);
            CREATE INDEX IF NOT EXISTS idx_cp_started
                ON engine_checkpoints(started_at);
        """)
        conn.commit()

    def start_turn(self, turn_id: str, model: str, user_prompt: str,
                   messages: List[Dict]) -> None:
        """Record the start of a new engine turn."""
        conn = self._get_conn()
        now = datetime.now().isoformat()
        conn.execute(
            """INSERT OR REPLACE INTO engine_checkpoints
               (turn_id, state, model, user_prompt, messages_snapshot,
                started_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                turn_id,
                "INIT",
                model,
                user_prompt[:500],  # Truncate for storage
                json.dumps(messages[-3:], ensure_ascii=False),  # Last 3 msgs
                now,
                now,
            ),
        )
        conn.commit()

    def update_state(self, turn_id: str, state: str,
                     tool_name: str = None) -> None:
        """Update the current state of an engine turn."""
        conn = self._get_conn()
        now = datetime.now().isoformat()

        if tool_name:
            # Append to tool calls log
            row = conn.execute(
                "SELECT tool_calls_log FROM engine_checkpoints WHERE turn_id=?",
                (turn_id,),
            ).fetchone()
            if row:
                log = json.loads(row["tool_calls_log"] or "[]")
                log.append({"tool": tool_name, "state": state, "at": now})
                conn.execute(
                    """UPDATE engine_checkpoints
                       SET state=?, tool_calls_log=?, updated_at=?
                       WHERE turn_id=?""",
                    (state, json.dumps(log, ensure_ascii=False), now, turn_id),
                )
            else:
                conn.execute(
                    "UPDATE engine_checkpoints SET state=?, updated_at=? WHERE turn_id=?",
                    (state, now, turn_id),
                )
        else:
            conn.execute(
                "UPDATE engine_checkpoints SET state=?, updated_at=? WHERE turn_id=?",
                (state, now, turn_id),
            )
        conn.commit()

    def complete_turn(self, turn_id: str) -> None:
        """Mark a turn as successfully completed."""
        conn = self._get_conn()
        now = datetime.now().isoformat()
        conn.execute(
            """UPDATE engine_checkpoints
               SET state='DONE', completed_at=?, updated_at=?
               WHERE turn_id=?""",
            (now, now, turn_id),
        )
        conn.commit()

    def fail_turn(self, turn_id: str, error: str) -> None:
        """Mark a turn as failed with an error."""
        conn = self._get_conn()
        now = datetime.now().isoformat()
        conn.execute(
            """UPDATE engine_checkpoints
               SET state='ERROR', error=?, completed_at=?, updated_at=?
               WHERE turn_id=?""",
            (error[:1000], now, now, turn_id),
        )
        conn.commit()

    def get_interrupted_turns(self) -> List[Dict]:
        """
        Find turns that were started but never completed (crash recovery).
        These are turns where state is NOT 'DONE' and NOT 'ERROR'.
        """
        conn = self._get_conn()
        rows = conn.execute(
            """SELECT * FROM engine_checkpoints
               WHERE completed_at IS NULL
               ORDER BY started_at DESC LIMIT 10"""
        ).fetchall()
        return [dict(r) for r in rows]

    def get_recent_turns(self, limit: int = 20) -> List[Dict]:
        """Get recent turn history for debugging."""
        conn = self._get_conn()
        rows = conn.execute(
            """SELECT turn_id, state, model, user_prompt, started_at,
                      completed_at, error
               FROM engine_checkpoints
               ORDER BY started_at DESC LIMIT ?""",
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]

    def cleanup_old(self, days: int = 7) -> int:
        """Remove checkpoints older than N days."""
        conn = self._get_conn()
        cutoff = datetime.now().timestamp() - (days * 86400)
        cutoff_str = datetime.fromtimestamp(cutoff).isoformat()
        cursor = conn.execute(
            "DELETE FROM engine_checkpoints WHERE started_at < ? AND completed_at IS NOT NULL",
            (cutoff_str,),
        )
        conn.commit()
        return cursor.rowcount

    def close(self):
        if self._conn:
            self._conn.close()
            self._conn = None


# ======================================================================
# Global Singleton
# ======================================================================

_checkpoint: Optional[EngineCheckpoint] = None


def init_engine_checkpoint(data_dir: str) -> EngineCheckpoint:
    """Initialize the global engine checkpoint store."""
    global _checkpoint
    db_path = os.path.join(data_dir, "engine_checkpoints.db")
    _checkpoint = EngineCheckpoint(db_path)
    interrupted = _checkpoint.get_interrupted_turns()
    if interrupted:
        logger.warning(
            f"[Checkpoint] Found {len(interrupted)} interrupted turn(s) from last session!"
        )
    return _checkpoint


def get_engine_checkpoint() -> Optional[EngineCheckpoint]:
    return _checkpoint
