#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""SQLite storage primitives for kernel traces and events."""

from __future__ import annotations

import json
import os
import sqlite3
import threading
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional

from py.kernel.audit import sanitize_payload


def _format_time(epoch: Optional[float] = None) -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S%z", time.localtime(epoch or time.time()))


def _default_kernel_dir(workspace_dir: str = "") -> Path:
    if workspace_dir:
        return Path(workspace_dir).expanduser().resolve() / ".agent" / "memory"
    root = os.getenv("OPENXNET_RUNTIME_DIR") or os.path.join(os.getcwd(), "runtime")
    return Path(root).expanduser().resolve() / "kernel"


def _safe_json(value: Any) -> str:
    return json.dumps(sanitize_payload(value), ensure_ascii=False, default=str)


def _load_json(raw: str, fallback: Any) -> Any:
    try:
        return json.loads(raw) if raw else fallback
    except Exception:
        return fallback


def _derive_plan_status(plan: Dict[str, Any]) -> str:
    steps = plan.get("steps", []) if isinstance(plan, dict) else []
    tool_steps = [
        step for step in steps
        if isinstance(step, dict) and step.get("kind") == "tool" and step.get("tool_name")
    ]
    if not tool_steps:
        return str(plan.get("status") or "ready") if isinstance(plan, dict) else "ready"
    statuses = {str(step.get("status") or "planned") for step in tool_steps}
    if "error" in statuses:
        return "needs_recovery"
    if "approval_required" in statuses:
        return "waiting_approval"
    if "running" in statuses:
        return "in_progress"
    if all(status == "completed" for status in statuses):
        return "executed"
    if any(status == "completed" for status in statuses):
        return "in_progress"
    return str(plan.get("status") or "ready")


def _step_execution_snapshot(status: str, trace: Dict[str, Any], error: str = "", recovery_hint: str = "") -> Dict[str, Any]:
    clean_trace = sanitize_payload(trace or {})
    metadata = clean_trace.get("metadata", {}) if isinstance(clean_trace.get("metadata"), dict) else {}
    return sanitize_payload({
        "status": status,
        "trace_id": clean_trace.get("trace_id", ""),
        "approval_id": clean_trace.get("approval_id", ""),
        "updated_at": _format_time(),
        "duration_ms": clean_trace.get("duration_ms", 0),
        "result_type": clean_trace.get("result_type", ""),
        "has_result_preview": bool(clean_trace.get("result_preview")),
        "has_error": bool(clean_trace.get("error") or error),
        "error": str(error or clean_trace.get("error", "")),
        "recovery_hint": str(recovery_hint or clean_trace.get("recovery_hint", "")),
        "actor": clean_trace.get("actor", ""),
        "kernel_plan_id": metadata.get("kernel_plan_id", ""),
        "kernel_plan_step_id": metadata.get("kernel_plan_step_id", ""),
    })


@contextmanager
def _connect(db_path: Path) -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(db_path)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


class KernelStore:
    """Per-workspace SQLite store for queryable kernel state."""

    def __init__(self, workspace_dir: str = ""):
        self.workspace_dir = workspace_dir or ""
        self.store_dir = _default_kernel_dir(self.workspace_dir)
        self.db_path = self.store_dir / "kernel.db"
        self._lock = threading.RLock()
        self._initialized = False

    def ensure_schema(self) -> None:
        if self._initialized:
            return
        with self._lock:
            if self._initialized:
                return
            self.store_dir.mkdir(parents=True, exist_ok=True)
            with _connect(self.db_path) as conn:
                conn.execute("PRAGMA journal_mode=DELETE").fetchone()
                conn.execute("PRAGMA synchronous=NORMAL").fetchone()
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS kernel_traces (
                        trace_id TEXT PRIMARY KEY,
                        workspace_dir TEXT NOT NULL DEFAULT '',
                        tool_name TEXT NOT NULL DEFAULT '',
                        capability TEXT NOT NULL DEFAULT '',
                        status TEXT NOT NULL DEFAULT 'running',
                        actor TEXT NOT NULL DEFAULT 'model',
                        approval_id TEXT NOT NULL DEFAULT '',
                        started_at TEXT NOT NULL,
                        finished_at TEXT NOT NULL DEFAULT '',
                        duration_ms REAL NOT NULL DEFAULT 0,
                        param_keys_json TEXT NOT NULL DEFAULT '[]',
                        result_preview TEXT NOT NULL DEFAULT '',
                        result_type TEXT NOT NULL DEFAULT '',
                        error TEXT NOT NULL DEFAULT '',
                        recovery_hint TEXT NOT NULL DEFAULT '',
                        metadata_json TEXT NOT NULL DEFAULT '{}'
                    )
                    """
                )
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS kernel_events (
                        event_id TEXT PRIMARY KEY,
                        event_type TEXT NOT NULL,
                        workspace_dir TEXT NOT NULL DEFAULT '',
                        payload_json TEXT NOT NULL DEFAULT '{}',
                        created_at TEXT NOT NULL
                    )
                    """
                )
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS kernel_plans (
                        plan_id TEXT PRIMARY KEY,
                        workspace_dir TEXT NOT NULL DEFAULT '',
                        status TEXT NOT NULL DEFAULT '',
                        source TEXT NOT NULL DEFAULT '',
                        runtime_mode TEXT NOT NULL DEFAULT '',
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL,
                        goal_preview TEXT NOT NULL DEFAULT '',
                        step_count INTEGER NOT NULL DEFAULT 0,
                        highest_risk TEXT NOT NULL DEFAULT '',
                        approval_step_count INTEGER NOT NULL DEFAULT 0,
                        dangerous_step_count INTEGER NOT NULL DEFAULT 0,
                        dry_run INTEGER NOT NULL DEFAULT 1,
                        summary_json TEXT NOT NULL DEFAULT '{}',
                        plan_json TEXT NOT NULL DEFAULT '{}'
                    )
                    """
                )
                conn.execute("CREATE INDEX IF NOT EXISTS idx_kernel_traces_started ON kernel_traces(started_at)")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_kernel_traces_status ON kernel_traces(status)")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_kernel_events_created ON kernel_events(created_at)")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_kernel_plans_created ON kernel_plans(created_at)")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_kernel_plans_status ON kernel_plans(status)")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_kernel_plans_source ON kernel_plans(source)")
            self._initialized = True

    def insert_trace(self, trace: Dict[str, Any]) -> Dict[str, Any]:
        self.ensure_schema()
        clean = sanitize_payload(trace or {})
        with self._lock, _connect(self.db_path) as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO kernel_traces (
                    trace_id, workspace_dir, tool_name, capability, status, actor, approval_id,
                    started_at, finished_at, duration_ms, param_keys_json, result_preview,
                    result_type, error, recovery_hint, metadata_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    clean.get("trace_id", ""),
                    clean.get("workspace_dir", self.workspace_dir),
                    clean.get("tool_name", ""),
                    clean.get("capability", ""),
                    clean.get("status", "running"),
                    clean.get("actor", "model"),
                    clean.get("approval_id", ""),
                    clean.get("started_at", _format_time()),
                    clean.get("finished_at", ""),
                    float(clean.get("duration_ms") or 0),
                    _safe_json(clean.get("param_keys", [])),
                    str(clean.get("result_preview", "")),
                    str(clean.get("result_type", "")),
                    str(clean.get("error", "")),
                    str(clean.get("recovery_hint", "")),
                    _safe_json(clean.get("metadata", {})),
                ),
            )
        return clean

    def update_trace(self, trace_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        self.ensure_schema()
        current = self.get_trace(trace_id)
        if not current:
            return None
        next_trace = {**current, **sanitize_payload(updates or {})}
        return self.insert_trace(next_trace)

    def get_trace(self, trace_id: str) -> Optional[Dict[str, Any]]:
        self.ensure_schema()
        with self._lock, _connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            row = conn.execute(
                "SELECT * FROM kernel_traces WHERE trace_id = ?",
                (str(trace_id or ""),),
            ).fetchone()
        return self._trace_from_row(row) if row else None

    def recent_traces(self, limit: int = 100, status: str = "") -> List[Dict[str, Any]]:
        self.ensure_schema()
        max_items = max(1, min(int(limit or 100), 500))
        wanted_status = str(status or "").strip()
        sql = "SELECT * FROM kernel_traces"
        params: List[Any] = []
        if wanted_status:
            sql += " WHERE status = ?"
            params.append(wanted_status)
        sql += " ORDER BY started_at DESC LIMIT ?"
        params.append(max_items)
        with self._lock, _connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(sql, params).fetchall()
        return [self._trace_from_row(row) for row in rows][::-1]

    def traces_for_plan(self, plan_id: str, limit: int = 100, status: str = "") -> List[Dict[str, Any]]:
        self.ensure_schema()
        wanted_plan = str(plan_id or "").strip()
        if not wanted_plan:
            return []
        max_items = max(1, min(int(limit or 100), 500))
        wanted_status = str(status or "").strip()
        sql = "SELECT * FROM kernel_traces"
        params: List[Any] = []
        if wanted_status:
            sql += " WHERE status = ?"
            params.append(wanted_status)
        sql += " ORDER BY started_at DESC LIMIT ?"
        params.append(max(500, max_items))
        with self._lock, _connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(sql, params).fetchall()
        traces: List[Dict[str, Any]] = []
        for row in rows:
            trace = self._trace_from_row(row)
            metadata = trace.get("metadata", {}) if isinstance(trace.get("metadata"), dict) else {}
            if metadata.get("kernel_plan_id") == wanted_plan or metadata.get("plan_id") == wanted_plan:
                traces.append(trace)
            if len(traces) >= max_items:
                break
        return traces[::-1]

    def trace_status(self) -> Dict[str, Any]:
        self.ensure_schema()
        with self._lock, _connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                "SELECT status, COUNT(*) FROM kernel_traces GROUP BY status"
            ).fetchall()
            recent = conn.execute(
                "SELECT * FROM kernel_traces ORDER BY started_at DESC LIMIT 5"
            ).fetchall()
        return {
            "dbPath": str(self.db_path),
            "counts": {str(status): int(count) for status, count in rows},
            "recent": [self._trace_from_row(row) for row in recent][::-1],
        }

    def append_event(self, event_id: str, event_type: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        self.ensure_schema()
        record = {
            "event_id": str(event_id or ""),
            "event_type": str(event_type or "kernel.event"),
            "workspace_dir": self.workspace_dir,
            "payload": sanitize_payload(payload or {}),
            "created_at": _format_time(),
        }
        with self._lock, _connect(self.db_path) as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO kernel_events (
                    event_id, event_type, workspace_dir, payload_json, created_at
                ) VALUES (?, ?, ?, ?, ?)
                """,
                (
                    record["event_id"],
                    record["event_type"],
                    record["workspace_dir"],
                    _safe_json(record["payload"]),
                    record["created_at"],
                ),
            )
        return record

    def insert_plan(self, plan: Dict[str, Any], summary: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        self.ensure_schema()
        clean_plan = sanitize_payload(plan or {})
        clean_summary = sanitize_payload(summary or {})
        plan_id = str(clean_summary.get("plan_id") or clean_plan.get("plan_id") or "")
        if not plan_id:
            return {}
        risk = clean_plan.get("risk_summary", {}) if isinstance(clean_plan.get("risk_summary"), dict) else {}
        created_at = str(clean_summary.get("created_at") or clean_plan.get("created_at") or _format_time())
        record = {
            "plan_id": plan_id,
            "workspace_dir": str(clean_plan.get("workspace_dir") or self.workspace_dir or ""),
            "status": str(clean_summary.get("status") or clean_plan.get("status") or ""),
            "source": str(clean_summary.get("source") or ""),
            "runtime_mode": str(clean_summary.get("runtime_mode") or clean_plan.get("runtime_mode") or ""),
            "created_at": created_at,
            "updated_at": _format_time(),
            "goal_preview": str(clean_summary.get("goal_preview") or clean_plan.get("goal") or "")[:500],
            "step_count": int(clean_summary.get("step_count") or len(clean_plan.get("steps") or []) or 0),
            "highest_risk": str(clean_summary.get("highestRisk") or risk.get("highestRisk") or ""),
            "approval_step_count": int(clean_summary.get("approvalStepCount") or risk.get("approvalStepCount") or 0),
            "dangerous_step_count": int(clean_summary.get("dangerousStepCount") or risk.get("dangerousStepCount") or 0),
            "dry_run": 1 if clean_summary.get("dryRun", True) is not False else 0,
            "summary": clean_summary,
            "plan": clean_plan,
        }
        with self._lock, _connect(self.db_path) as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO kernel_plans (
                    plan_id, workspace_dir, status, source, runtime_mode, created_at, updated_at,
                    goal_preview, step_count, highest_risk, approval_step_count,
                    dangerous_step_count, dry_run, summary_json, plan_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record["plan_id"],
                    record["workspace_dir"],
                    record["status"],
                    record["source"],
                    record["runtime_mode"],
                    record["created_at"],
                    record["updated_at"],
                    record["goal_preview"],
                    record["step_count"],
                    record["highest_risk"],
                    record["approval_step_count"],
                    record["dangerous_step_count"],
                    record["dry_run"],
                    _safe_json(record["summary"]),
                    _safe_json(record["plan"]),
                ),
            )
        return sanitize_payload(record)

    def get_plan(self, plan_id: str, *, include_plan: bool = True) -> Optional[Dict[str, Any]]:
        self.ensure_schema()
        with self._lock, _connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            row = conn.execute(
                "SELECT * FROM kernel_plans WHERE plan_id = ?",
                (str(plan_id or ""),),
            ).fetchone()
        return self._plan_from_row(row, include_plan=include_plan) if row else None

    def update_plan_step_status(
        self,
        plan_id: str,
        step_id: str,
        status: str,
        *,
        trace: Optional[Dict[str, Any]] = None,
        error: str = "",
        recovery_hint: str = "",
    ) -> Optional[Dict[str, Any]]:
        self.ensure_schema()
        record = self.get_plan(plan_id, include_plan=True)
        if not record:
            return None
        plan = record.get("plan", {}) if isinstance(record.get("plan"), dict) else {}
        steps = plan.get("steps", []) if isinstance(plan.get("steps"), list) else []
        wanted_step = str(step_id or "")
        if not wanted_step:
            return None
        updated = False
        normalized_status = str(status or "completed")
        execution = _step_execution_snapshot(normalized_status, trace or {}, error=error, recovery_hint=recovery_hint)
        for step in steps:
            if not isinstance(step, dict) or str(step.get("step_id") or "") != wanted_step:
                continue
            step["status"] = normalized_status
            step["updated_at"] = execution["updated_at"]
            step["last_trace_id"] = execution.get("trace_id", "")
            step["execution"] = execution
            updated = True
            break
        if not updated:
            return None

        plan["steps"] = steps
        plan["updated_at"] = _format_time()
        plan["status"] = _derive_plan_status(plan)
        summary = record.get("summary", {}) if isinstance(record.get("summary"), dict) else {}
        summary = {
            **summary,
            "plan_id": record.get("plan_id", plan_id),
            "status": plan.get("status", ""),
            "source": summary.get("source") or record.get("source", ""),
            "runtime_mode": summary.get("runtime_mode") or record.get("runtime_mode", ""),
            "created_at": summary.get("created_at") or record.get("created_at", ""),
            "step_count": len(steps),
            "highestRisk": summary.get("highestRisk") or record.get("highestRisk", ""),
            "approvalStepCount": summary.get("approvalStepCount", record.get("approvalStepCount", 0)),
            "dangerousStepCount": summary.get("dangerousStepCount", record.get("dangerousStepCount", 0)),
            "dryRun": record.get("dryRun", True),
            "goal_preview": summary.get("goal_preview") or record.get("goal_preview", ""),
            "last_step_id": wanted_step,
            "last_trace_id": execution.get("trace_id", ""),
            "updated_at": plan.get("updated_at", ""),
        }
        return self.insert_plan(plan, summary)

    def recent_plans(self, limit: int = 20, status: str = "", source: str = "", *, include_plan: bool = False) -> List[Dict[str, Any]]:
        self.ensure_schema()
        max_items = max(1, min(int(limit or 20), 200))
        filters: List[str] = []
        params: List[Any] = []
        wanted_status = str(status or "").strip()
        wanted_source = str(source or "").strip()
        if wanted_status:
            filters.append("status = ?")
            params.append(wanted_status)
        if wanted_source:
            filters.append("source = ?")
            params.append(wanted_source)
        sql = "SELECT * FROM kernel_plans"
        if filters:
            sql += " WHERE " + " AND ".join(filters)
        sql += " ORDER BY created_at DESC LIMIT ?"
        params.append(max_items)
        with self._lock, _connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(sql, params).fetchall()
        return [self._plan_from_row(row, include_plan=include_plan) for row in rows][::-1]

    def plan_status(self) -> Dict[str, Any]:
        self.ensure_schema()
        with self._lock, _connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            status_rows = conn.execute(
                "SELECT status, COUNT(*) FROM kernel_plans GROUP BY status"
            ).fetchall()
            source_rows = conn.execute(
                "SELECT source, COUNT(*) FROM kernel_plans GROUP BY source"
            ).fetchall()
            recent = conn.execute(
                "SELECT * FROM kernel_plans ORDER BY created_at DESC LIMIT 5"
            ).fetchall()
        return {
            "dbPath": str(self.db_path),
            "counts": {str(status): int(count) for status, count in status_rows},
            "sourceCounts": {str(source): int(count) for source, count in source_rows},
            "recent": [self._plan_from_row(row, include_plan=False) for row in recent][::-1],
        }

    def _trace_from_row(self, row: Any) -> Dict[str, Any]:
        keys = row.keys() if hasattr(row, "keys") else [
            "trace_id", "workspace_dir", "tool_name", "capability", "status", "actor",
            "approval_id", "started_at", "finished_at", "duration_ms", "param_keys_json",
            "result_preview", "result_type", "error", "recovery_hint", "metadata_json",
        ]
        data = {key: row[key] for key in keys}
        return sanitize_payload({
            "trace_id": data.get("trace_id", ""),
            "workspace_dir": data.get("workspace_dir", ""),
            "tool_name": data.get("tool_name", ""),
            "capability": data.get("capability", ""),
            "status": data.get("status", ""),
            "actor": data.get("actor", ""),
            "approval_id": data.get("approval_id", ""),
            "started_at": data.get("started_at", ""),
            "finished_at": data.get("finished_at", ""),
            "duration_ms": data.get("duration_ms", 0),
            "param_keys": _load_json(data.get("param_keys_json", "[]"), []),
            "result_preview": data.get("result_preview", ""),
            "result_type": data.get("result_type", ""),
            "error": data.get("error", ""),
            "recovery_hint": data.get("recovery_hint", ""),
            "metadata": _load_json(data.get("metadata_json", "{}"), {}),
        })

    def _plan_from_row(self, row: Any, *, include_plan: bool = False) -> Dict[str, Any]:
        keys = row.keys() if hasattr(row, "keys") else [
            "plan_id", "workspace_dir", "status", "source", "runtime_mode", "created_at",
            "updated_at", "goal_preview", "step_count", "highest_risk",
            "approval_step_count", "dangerous_step_count", "dry_run", "summary_json",
            "plan_json",
        ]
        data = {key: row[key] for key in keys}
        summary = _load_json(data.get("summary_json", "{}"), {})
        plan = _load_json(data.get("plan_json", "{}"), {})
        payload = {
            "plan_id": data.get("plan_id", ""),
            "workspace_dir": data.get("workspace_dir", ""),
            "status": data.get("status", ""),
            "source": data.get("source", ""),
            "runtime_mode": data.get("runtime_mode", ""),
            "created_at": data.get("created_at", ""),
            "updated_at": data.get("updated_at", ""),
            "goal_preview": data.get("goal_preview", ""),
            "step_count": data.get("step_count", 0),
            "highestRisk": data.get("highest_risk", ""),
            "approvalStepCount": data.get("approval_step_count", 0),
            "dangerousStepCount": data.get("dangerous_step_count", 0),
            "dryRun": bool(data.get("dry_run", 1)),
            "summary": summary,
            "rawMessagesReturned": bool(summary.get("rawMessagesReturned", False)) if isinstance(summary, dict) else False,
        }
        if include_plan:
            payload["plan"] = plan
        return sanitize_payload(payload)


_stores: Dict[str, KernelStore] = {}
_stores_lock = threading.Lock()


def get_kernel_store(workspace_dir: str = "") -> KernelStore:
    key = str(Path(workspace_dir).expanduser().resolve()) if workspace_dir else "__global__"
    with _stores_lock:
        if key not in _stores:
            _stores[key] = KernelStore(workspace_dir)
        return _stores[key]
