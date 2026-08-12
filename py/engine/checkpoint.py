#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
Checkpoint 检查点 - 对话状态快照，支持断点续传和回滚。
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
OpenXnet v0.5.2 - QueryEngine Checkpoint (checkpoint.py)
=========================================================

P1 韧性机制：在 QueryEngine 每次状态转换时写入 SQLite checkpoint。
支持进程崩溃恢复：重启后可检测到未完成的 turn 并提示用户。
"""

import json
import logging
import os
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("engine_checkpoint")

SNAPSHOT_MESSAGE_LIMIT = 12
TEXT_PREVIEW_LIMIT = 1200
TOOL_ARGS_PREVIEW_LIMIT = 400


def _safe_json_loads(value: Any, fallback: Any) -> Any:
    if value in (None, ""):
        return fallback
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except Exception:
        return fallback


def _truncate_text(value: Any, limit: int = TEXT_PREVIEW_LIMIT) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    if not text:
        return ""
    if len(text) <= limit:
        return text
    return f"{text[: limit - 3]}..."


def _normalize_content(content: Any, limit: int = TEXT_PREVIEW_LIMIT) -> str:
    if isinstance(content, str):
        return _truncate_text(content, limit)
    if isinstance(content, list):
        parts: List[str] = []
        for item in content:
            if not isinstance(item, dict):
                continue
            item_type = item.get("type")
            if item_type == "text":
                parts.append(str(item.get("text") or ""))
            elif item_type == "image_url":
                parts.append("[image]")
            else:
                parts.append(f"[{item_type or 'content'}]")
        return _truncate_text("\n".join(part for part in parts if part), limit)
    if isinstance(content, dict):
        return _truncate_text(json.dumps(content, ensure_ascii=False), limit)
    return _truncate_text(content, limit)


def _extract_tool_name(tool_call: Dict[str, Any]) -> str:
    function = tool_call.get("function") if isinstance(tool_call, dict) else None
    if isinstance(function, dict) and function.get("name"):
        return str(function["name"])
    return str(tool_call.get("name") or "")


def _extract_tool_args(tool_call: Dict[str, Any]) -> str:
    function = tool_call.get("function") if isinstance(tool_call, dict) else None
    if isinstance(function, dict):
        return str(function.get("arguments") or "")
    return str(tool_call.get("arguments") or "")


def _normalize_snapshot_messages(messages: Any, limit: int = SNAPSHOT_MESSAGE_LIMIT) -> List[Dict[str, Any]]:
    if not isinstance(messages, list):
        return []

    tail = messages[-limit:]
    if (
        len(messages) > limit
        and messages
        and isinstance(messages[0], dict)
        and messages[0].get("role") == "system"
    ):
        tail = [messages[0], *tail[-(limit - 1):]]

    snapshot: List[Dict[str, Any]] = []
    for message in tail:
        if not isinstance(message, dict):
            continue

        role = str(message.get("role") or "user")
        entry: Dict[str, Any] = {"role": role}

        if role == "assistant":
            tool_calls = []
            for tool_call in message.get("tool_calls") or []:
                if not isinstance(tool_call, dict):
                    continue
                tool_calls.append(
                    {
                        "id": str(tool_call.get("id") or ""),
                        "name": _extract_tool_name(tool_call),
                        "arguments_preview": _truncate_text(
                            _extract_tool_args(tool_call),
                            TOOL_ARGS_PREVIEW_LIMIT,
                        ),
                    }
                )
            if tool_calls:
                entry["tool_calls"] = tool_calls[:4]

            content = _normalize_content(message.get("content"), 800)
            if content:
                entry["content"] = content
        elif role == "tool":
            entry["name"] = str(message.get("name") or "")
            if message.get("tool_call_id"):
                entry["tool_call_id"] = str(message.get("tool_call_id"))
            entry["content"] = _normalize_content(message.get("content"), 900)
        else:
            entry["content"] = _normalize_content(message.get("content"), TEXT_PREVIEW_LIMIT)

        snapshot.append(entry)

    return snapshot


def _serialize_snapshot_messages(messages: Optional[List[Dict[str, Any]]]) -> str:
    return json.dumps(_normalize_snapshot_messages(messages or []), ensure_ascii=False)


def _state_label(state: str) -> str:
    normalized = str(state or "").upper()
    mapping = {
        "INIT": "Initialization",
        "PRE_FLIGHT": "Pre-flight",
        "IN_PROGRESS": "Generating",
        "TOOL_EXECUTION": "Tool Execution",
        "RESOLUTION": "Resolution",
        "POST_FLIGHT": "Post-flight",
        "DONE": "Completed",
        "ERROR": "Failed",
        "RESUMED": "Recovered",
    }
    return mapping.get(normalized, normalized or "Unknown")


def _state_resume_hint(state: str) -> str:
    normalized = str(state or "").upper()
    mapping = {
        "INIT": "对话刚进入引擎，尚未真正开始生成，可直接恢复并继续。",
        "PRE_FLIGHT": "对话停在预处理阶段，恢复时可沿用原始请求继续执行。",
        "IN_PROGRESS": "模型回复生成到一半被打断，建议根据快照继续完成原回答。",
        "TOOL_EXECUTION": "工具执行阶段被打断，恢复时优先检查最后一个工具是否已经产出结果。",
        "RESOLUTION": "工具结果已回流，模型准备整合答案时被打断，可直接续写最终回复。",
        "POST_FLIGHT": "主回复大概率已经完成，打断发生在收尾阶段，恢复时重点确认最终回答是否需要重述。",
        "DONE": "该 turn 已完成，一般无需恢复。",
        "ERROR": "该 turn 已失败结束，如需继续请基于失败原因重新发起。",
        "RESUMED": "该 turn 已经被恢复处理过，历史记录仅供回看。",
    }
    return mapping.get(normalized, "对话在处理中断，可基于快照继续。")


def _extract_last_tool_name(turn: Dict[str, Any]) -> str:
    tool_calls_log = turn.get("tool_calls_log") or []
    for entry in reversed(tool_calls_log):
        if isinstance(entry, dict) and entry.get("tool"):
            return str(entry["tool"])

    messages_snapshot = turn.get("messages_snapshot") or []
    for message in reversed(messages_snapshot):
        if not isinstance(message, dict):
            continue
        if message.get("role") == "tool" and message.get("name"):
            return str(message["name"])
        for tool_call in reversed(message.get("tool_calls") or []):
            if isinstance(tool_call, dict) and tool_call.get("name"):
                return str(tool_call["name"])
    return ""


def _format_snapshot_line(message: Dict[str, Any]) -> str:
    role = str(message.get("role") or "unknown")
    content = _truncate_text(message.get("content") or "-", 320)
    if role == "tool":
        tool_name = message.get("name") or "tool"
        return f"{role}/{tool_name}: {content}"
    if role == "assistant" and message.get("tool_calls"):
        tool_names = [
            tool_call.get("name")
            for tool_call in message.get("tool_calls") or []
            if isinstance(tool_call, dict) and tool_call.get("name")
        ]
        suffix = f" [tools: {', '.join(tool_names)}]" if tool_names else ""
        return f"{role}: {content}{suffix}"
    return f"{role}: {content}"


def _build_resume_summary(turn: Dict[str, Any]) -> str:
    parts = [_state_resume_hint(turn.get("state") or "")]
    last_tool_name = _extract_last_tool_name(turn)
    if last_tool_name:
        parts.append(f"最后工具：{last_tool_name}")
    messages_snapshot = turn.get("messages_snapshot") or []
    if messages_snapshot:
        parts.append(f"已保留 {len(messages_snapshot)} 条上下文快照")
    return "；".join(parts)


def _build_resume_prompt(turn: Dict[str, Any]) -> str:
    lines = [
        "继续上次因 OpenXnet 重启而中断的对话。",
        "请把下面内容视为恢复上下文，而不是新的用户需求。",
        "",
        "【中断信息】",
        f"- turn_id: {turn.get('turn_id') or '-'}",
        f"- 模型: {turn.get('model') or '-'}",
        f"- 阶段: {turn.get('state_label') or _state_label(turn.get('state') or '')}",
    ]

    last_tool_name = turn.get("last_tool_name") or _extract_last_tool_name(turn)
    if last_tool_name:
        lines.append(f"- 最后工具: {last_tool_name}")

    lines.append(
        f"- 最后更新时间: {turn.get('updated_at') or turn.get('started_at') or '-'}"
    )
    lines.extend(
        [
            "",
            "【原始用户请求】",
            _truncate_text(turn.get("user_prompt") or "-", 2400),
        ]
    )

    messages_snapshot = turn.get("messages_snapshot") or []
    if messages_snapshot:
        lines.extend(["", "【最近上下文快照】"])
        for index, message in enumerate(messages_snapshot, start=1):
            lines.append(f"{index}. {_format_snapshot_line(message)}")

    tool_calls_log = turn.get("tool_calls_log") or []
    if tool_calls_log:
        lines.extend(["", "【工具轨迹】"])
        for index, entry in enumerate(tool_calls_log[-5:], start=1):
            if not isinstance(entry, dict):
                continue
            tool_name = entry.get("tool") or "-"
            state = entry.get("state") or "-"
            at = entry.get("at") or "-"
            lines.append(f"{index}. {tool_name} @ {state} ({at})")

    lines.extend(
        [
            "",
            "请基于以上上下文继续完成原本这轮回复：",
            "1. 如果上下文已经足够，直接继续完成上次被打断的回答。",
            "2. 如果仍缺少关键上下文，只提出最少的澄清问题。",
            "3. 不要重复已经完成的工具调用，除非恢复上下文明显不足。",
        ]
    )
    return "\n".join(lines)


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
        conn.executescript(
            """
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
        """
        )
        conn.commit()

    def _decorate_turn(self, row: Optional[sqlite3.Row]) -> Optional[Dict[str, Any]]:
        if row is None:
            return None

        turn = dict(row)
        turn["messages_snapshot"] = _normalize_snapshot_messages(
            _safe_json_loads(turn.get("messages_snapshot"), [])
        )

        tool_calls_log = _safe_json_loads(turn.get("tool_calls_log"), [])
        if not isinstance(tool_calls_log, list):
            tool_calls_log = []
        turn["tool_calls_log"] = [
            {
                "tool": str(entry.get("tool") or ""),
                "state": str(entry.get("state") or ""),
                "at": entry.get("at") or "",
            }
            for entry in tool_calls_log[-10:]
            if isinstance(entry, dict)
        ]
        turn["state_label"] = _state_label(turn.get("state") or "")
        turn["last_tool_name"] = _extract_last_tool_name(turn)
        turn["resume_summary"] = _build_resume_summary(turn)
        turn["resume_prompt"] = _build_resume_prompt(turn)
        turn["can_resume"] = not bool(turn.get("completed_at"))
        turn["message_count"] = len(turn["messages_snapshot"])
        return turn

    def start_turn(
        self,
        turn_id: str,
        model: str,
        user_prompt: str,
        messages: List[Dict[str, Any]],
    ) -> None:
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
                (user_prompt or "")[:2000],
                _serialize_snapshot_messages(messages),
                now,
                now,
            ),
        )
        conn.commit()

    def update_state(
        self,
        turn_id: str,
        state: str,
        tool_name: str = None,
        messages: Optional[List[Dict[str, Any]]] = None,
    ) -> None:
        """Update the current state of an engine turn."""
        conn = self._get_conn()
        now = datetime.now().isoformat()
        row = conn.execute(
            "SELECT tool_calls_log FROM engine_checkpoints WHERE turn_id=?",
            (turn_id,),
        ).fetchone()
        if row is None:
            return

        assignments = ["state=?", "updated_at=?"]
        params: List[Any] = [state, now]

        if messages is not None:
            assignments.append("messages_snapshot=?")
            params.append(_serialize_snapshot_messages(messages))

        if tool_name:
            tool_log = _safe_json_loads(row["tool_calls_log"], [])
            if not isinstance(tool_log, list):
                tool_log = []
            tool_log.append({"tool": tool_name, "state": state, "at": now})
            assignments.append("tool_calls_log=?")
            params.append(json.dumps(tool_log, ensure_ascii=False))

        params.append(turn_id)
        conn.execute(
            f"UPDATE engine_checkpoints SET {', '.join(assignments)} WHERE turn_id=?",
            params,
        )
        conn.commit()

    def complete_turn(
        self,
        turn_id: str,
        messages: Optional[List[Dict[str, Any]]] = None,
    ) -> None:
        """Mark a turn as successfully completed."""
        conn = self._get_conn()
        now = datetime.now().isoformat()
        assignments = ["state='DONE'", "completed_at=?", "updated_at=?"]
        params: List[Any] = [now, now]
        if messages is not None:
            assignments.append("messages_snapshot=?")
            params.append(_serialize_snapshot_messages(messages))
        params.append(turn_id)
        conn.execute(
            f"UPDATE engine_checkpoints SET {', '.join(assignments)} WHERE turn_id=?",
            params,
        )
        conn.commit()

    def fail_turn(
        self,
        turn_id: str,
        error: str,
        messages: Optional[List[Dict[str, Any]]] = None,
    ) -> None:
        """Mark a turn as failed with an error."""
        conn = self._get_conn()
        now = datetime.now().isoformat()
        assignments = [
            "state='ERROR'",
            "error=?",
            "completed_at=?",
            "updated_at=?",
        ]
        params: List[Any] = [(error or "")[:1000], now, now]
        if messages is not None:
            assignments.append("messages_snapshot=?")
            params.append(_serialize_snapshot_messages(messages))
        params.append(turn_id)
        conn.execute(
            f"UPDATE engine_checkpoints SET {', '.join(assignments)} WHERE turn_id=?",
            params,
        )
        conn.commit()

    def resolve_interrupted_turn(
        self, turn_id: str, final_state: str = "RESUMED"
    ) -> Optional[Dict[str, Any]]:
        """Mark an interrupted turn as manually recovered from Recall Center."""
        conn = self._get_conn()
        existing = conn.execute(
            "SELECT completed_at FROM engine_checkpoints WHERE turn_id=?",
            (turn_id,),
        ).fetchone()
        if existing is None:
            return None
        if existing["completed_at"]:
            return self.get_turn(turn_id)

        now = datetime.now().isoformat()
        conn.execute(
            """UPDATE engine_checkpoints
               SET state=?, completed_at=?, updated_at=?
               WHERE turn_id=? AND completed_at IS NULL""",
            (final_state, now, now, turn_id),
        )
        conn.commit()
        return self.get_turn(turn_id)

    def get_turn(self, turn_id: str) -> Optional[Dict[str, Any]]:
        conn = self._get_conn()
        row = conn.execute(
            "SELECT * FROM engine_checkpoints WHERE turn_id=?",
            (turn_id,),
        ).fetchone()
        return self._decorate_turn(row)

    def get_interrupted_turns(self) -> List[Dict[str, Any]]:
        """
        Find turns that were started but never completed (crash recovery).
        These are turns where completed_at is still NULL.
        """
        conn = self._get_conn()
        rows = conn.execute(
            """SELECT * FROM engine_checkpoints
               WHERE completed_at IS NULL
               ORDER BY started_at DESC LIMIT 10"""
        ).fetchall()
        return [turn for turn in (self._decorate_turn(row) for row in rows) if turn]

    def get_recent_turns(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Get recent turn history for debugging and Recall Center."""
        conn = self._get_conn()
        rows = conn.execute(
            """SELECT * FROM engine_checkpoints
               ORDER BY started_at DESC LIMIT ?""",
            (limit,),
        ).fetchall()
        return [turn for turn in (self._decorate_turn(row) for row in rows) if turn]

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
