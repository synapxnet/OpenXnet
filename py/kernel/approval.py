#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""Kernel approval center for pending tool executions."""

from __future__ import annotations

import copy
import hashlib
import json
import os
import threading
import time
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from py.kernel.audit import get_kernel_audit, sanitize_payload


DEFAULT_APPROVAL_TTL_SECONDS = 300
DEFAULT_APPROVAL_HISTORY_RETENTION_SECONDS = 7 * 24 * 60 * 60
MAX_APPROVAL_HISTORY_RECORDS = 1000
TERMINAL_STATUSES = {"approved", "denied", "expired", "consumed"}


@dataclass
class ApprovalRecord:
    approval_id: str
    status: str
    tool_name: str
    tool_params: Dict[str, Any] = field(default_factory=dict)
    policy_decision: Dict[str, Any] = field(default_factory=dict)
    workspace_dir: str = ""
    actor: str = "model"
    requested_by: str = "policy_gate"
    created_at: str = ""
    expires_at: str = ""
    resolved_at: str = ""
    resolution: str = ""
    reason: str = ""
    params_signature: str = ""
    trace_id: str = ""
    execution_trace_id: str = ""
    recovery_hint: str = ""

    def to_dict(self, *, include_params: bool = False) -> Dict[str, Any]:
        data = asdict(self)
        if not include_params:
            data["tool_params"] = {
                "keys": sorted(self.tool_params.keys()) if isinstance(self.tool_params, dict) else [],
            }
        return sanitize_payload(data)


def _format_time(epoch: Optional[float] = None) -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S%z", time.localtime(epoch or time.time()))


def _parse_time_epoch(value: str) -> Optional[float]:
    if not value:
        return None
    try:
        return datetime.strptime(str(value), "%Y-%m-%dT%H:%M:%S%z").timestamp()
    except Exception:
        pass
    try:
        return datetime.fromisoformat(str(value)).timestamp()
    except Exception:
        return None


def _signature(tool_name: str, tool_params: Dict[str, Any]) -> str:
    payload = {
        "tool_name": str(tool_name or ""),
        "tool_params": tool_params or {},
    }
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True, default=str, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _approval_storage_dir(workspace_dir: str = "") -> Path:
    if workspace_dir:
        return Path(workspace_dir).expanduser().resolve() / ".agent" / "memory"
    root = os.getenv("OPENXNET_RUNTIME_DIR") or os.path.join(os.getcwd(), "runtime")
    return Path(root).expanduser().resolve() / "kernel"


def _workspace_key(workspace_dir: str = "") -> str:
    return str(Path(workspace_dir).expanduser().resolve()) if workspace_dir else "__global__"


def _param_keys_from_item(item: Dict[str, Any]) -> List[str]:
    params = item.get("tool_params") or {}
    if not isinstance(params, dict):
        return []
    restored_keys = params.get("keys")
    if set(params.keys()) == {"keys"} and isinstance(restored_keys, list):
        return sorted(str(key) for key in restored_keys)
    return sorted(str(key) for key in params.keys())


class ApprovalCenter:
    """Approval registry with audit events, TTL pruning, and workspace recovery."""

    def __init__(self):
        self._items: Dict[str, Dict[str, Any]] = {}
        self._loaded_workspaces: Dict[str, str] = {}
        self._lock = threading.Lock()

    def create(
        self,
        *,
        tool_name: str,
        tool_params: Optional[Dict[str, Any]] = None,
        policy_decision: Optional[Dict[str, Any]] = None,
        workspace_dir: str = "",
        actor: str = "model",
        requested_by: str = "policy_gate",
        ttl_seconds: int = DEFAULT_APPROVAL_TTL_SECONDS,
    ) -> Dict[str, Any]:
        now = time.time()
        ttl = max(30, min(int(ttl_seconds or DEFAULT_APPROVAL_TTL_SECONDS), 3600))
        approval_id = f"appr_{uuid.uuid4().hex}"
        params = copy.deepcopy(tool_params or {})
        record = ApprovalRecord(
            approval_id=approval_id,
            status="pending",
            tool_name=str(tool_name or ""),
            tool_params=params,
            policy_decision=copy.deepcopy(policy_decision or {}),
            workspace_dir=workspace_dir or "",
            actor=actor or "model",
            requested_by=requested_by or "policy_gate",
            created_at=_format_time(now),
            expires_at=_format_time(now + ttl),
            params_signature=_signature(tool_name, params),
        )
        stored = record.to_dict(include_params=True)
        stored["_expires_epoch"] = now + ttl
        with self._lock:
            self._ensure_loaded_locked(workspace_dir)
            changed_keys = self._prune_locked(now)
            self._items[approval_id] = stored
            changed_keys.add(_workspace_key(workspace_dir))
            self._save_loaded_workspaces_locked(changed_keys)

        get_kernel_audit(workspace_dir).append(
            "kernel.approval.requested",
            record.to_dict(include_params=False),
            actor=actor,
            workspace_dir=workspace_dir,
        )
        return record.to_dict(include_params=False)

    def pending(self, workspace_dir: str = "", limit: int = 100) -> List[Dict[str, Any]]:
        now = time.time()
        max_items = max(1, min(int(limit or 100), 500))
        with self._lock:
            self._ensure_loaded_locked(workspace_dir)
            changed_keys = self._prune_locked(now)
            self._save_loaded_workspaces_locked(changed_keys)
            items = []
            for item in self._items.values():
                if item.get("status") != "pending":
                    continue
                if workspace_dir and item.get("workspace_dir") not in {"", workspace_dir}:
                    continue
                items.append(self._public_record(item))
            return items[-max_items:]

    def history(self, workspace_dir: str = "", limit: int = 100, status: str = "") -> List[Dict[str, Any]]:
        now = time.time()
        max_items = max(1, min(int(limit or 100), 500))
        wanted_status = str(status or "").strip()
        with self._lock:
            self._ensure_loaded_locked(workspace_dir)
            changed_keys = self._prune_locked(now)
            self._save_loaded_workspaces_locked(changed_keys)
            items = []
            for item in self._items.values():
                if workspace_dir and item.get("workspace_dir") not in {"", workspace_dir}:
                    continue
                if wanted_status and item.get("status") != wanted_status:
                    continue
                items.append(self._public_record(item))
            items.sort(key=lambda value: value.get("created_at", ""))
            return items[-max_items:]

    def get(
        self,
        approval_id: str,
        *,
        include_params: bool = False,
        workspace_dir: str = "",
    ) -> Optional[Dict[str, Any]]:
        now = time.time()
        with self._lock:
            if workspace_dir:
                self._ensure_loaded_locked(workspace_dir)
            changed_keys = self._prune_locked(now)
            self._save_loaded_workspaces_locked(changed_keys)
            item = copy.deepcopy(self._items.get(str(approval_id or "")))
        if not item:
            return None
        return self._public_record(item, include_params=include_params)

    def link_trace(
        self,
        approval_id: str,
        trace_id: str,
        *,
        workspace_dir: str = "",
        trace_role: str = "request",
        recovery_hint: str = "",
    ) -> Dict[str, Any]:
        """Associate an approval with the trace that requested or executed it."""
        approval_id = str(approval_id or "")
        trace_id = str(trace_id or "")
        if not approval_id or not trace_id:
            return {"ok": False, "reason": "missing_approval_or_trace", "approval_id": approval_id}
        role = "execution" if str(trace_role or "").lower() in {"execution", "execute", "manual"} else "request"
        with self._lock:
            if workspace_dir:
                self._ensure_loaded_locked(workspace_dir)
            changed_keys = self._prune_locked(time.time())
            item = self._items.get(approval_id)
            if not item:
                self._save_loaded_workspaces_locked(changed_keys)
                return {"ok": False, "reason": "approval_not_found_or_expired", "approval_id": approval_id}
            if role == "execution":
                item["execution_trace_id"] = trace_id
            else:
                item["trace_id"] = trace_id
            if recovery_hint:
                item["recovery_hint"] = str(recovery_hint or "")
            changed_keys.add(_workspace_key(item.get("workspace_dir", "")))
            self._save_loaded_workspaces_locked(changed_keys)
            clean = self._public_record(item)

        get_kernel_audit(clean.get("workspace_dir", "")).append(
            "kernel.approval.trace_linked",
            {
                "approval_id": approval_id,
                "trace_id": trace_id,
                "trace_role": role,
                "tool_name": clean.get("tool_name", ""),
            },
            actor="system",
            workspace_dir=clean.get("workspace_dir", ""),
        )
        return {"ok": True, "approval": clean}

    def resolve(
        self,
        approval_id: str,
        resolution: str,
        *,
        actor: str = "user",
        reason: str = "",
        consume: bool = True,
        workspace_dir: str = "",
    ) -> Dict[str, Any]:
        now = time.time()
        approval_id = str(approval_id or "")
        resolution = "approved" if resolution in {"approve", "approved", "allow", "once", "always"} else "denied"
        with self._lock:
            if workspace_dir:
                self._ensure_loaded_locked(workspace_dir)
            changed_keys = self._prune_locked(now)
            item = self._items.get(approval_id)
            if not item:
                self._save_loaded_workspaces_locked(changed_keys)
                return {"ok": False, "reason": "approval_not_found_or_expired", "approval_id": approval_id}
            if item.get("status") != "pending":
                self._save_loaded_workspaces_locked(changed_keys)
                reason_code = "approval_expired" if item.get("status") == "expired" else "approval_not_pending"
                return {
                    "ok": False,
                    "reason": reason_code,
                    "approval_id": approval_id,
                    "status": item.get("status"),
                }
            if float(item.get("_expires_epoch") or 0) < now:
                item["status"] = "expired"
                item["resolved_at"] = _format_time(now)
                item["resolution"] = "expired"
                changed_keys.add(_workspace_key(item.get("workspace_dir", "")))
                self._save_loaded_workspaces_locked(changed_keys)
                return {"ok": False, "reason": "approval_expired", "approval_id": approval_id}

            item["status"] = "consumed" if resolution == "approved" and consume else resolution
            item["resolution"] = resolution
            item["resolved_at"] = _format_time(now)
            item["reason"] = str(reason or "")
            changed_keys.add(_workspace_key(item.get("workspace_dir", "")))
            self._save_loaded_workspaces_locked(changed_keys)
            clean = self._public_record(item)

        get_kernel_audit(clean.get("workspace_dir", "")).append(
            "kernel.approval.resolved",
            {
                "approval_id": approval_id,
                "tool_name": clean.get("tool_name", ""),
                "resolution": resolution,
                "status": clean.get("status"),
                "reason": clean.get("reason", ""),
            },
            actor=actor,
            workspace_dir=clean.get("workspace_dir", ""),
        )
        return {"ok": True, "approval": clean}

    def validate_for_execution(
        self,
        approval_id: str,
        *,
        tool_name: str,
        tool_params: Optional[Dict[str, Any]] = None,
        workspace_dir: str = "",
    ) -> Dict[str, Any]:
        item = self.get(approval_id, include_params=True, workspace_dir=workspace_dir)
        if not item:
            return {"ok": False, "reason": "approval_not_found_or_expired", "approval_id": approval_id}
        if item.get("status") != "pending":
            reason_code = "approval_expired" if item.get("status") == "expired" else "approval_not_pending"
            return {"ok": False, "reason": reason_code, "approval_id": approval_id, "status": item.get("status")}
        if item.get("tool_name") != str(tool_name or ""):
            return {"ok": False, "reason": "approval_tool_mismatch", "approval_id": approval_id}
        expected = item.get("params_signature", "")
        actual = _signature(tool_name, tool_params or {})
        if expected and expected != actual:
            return {"ok": False, "reason": "approval_payload_mismatch", "approval_id": approval_id}
        return {"ok": True, "approval": item}

    def status(self, workspace_dir: str = "") -> Dict[str, Any]:
        pending = self.pending(workspace_dir=workspace_dir, limit=500)
        history = self.history(workspace_dir=workspace_dir, limit=500)
        return {
            "pendingCount": len(pending),
            "historyCount": len(history),
            "pending": pending[-20:],
            "ttlSeconds": DEFAULT_APPROVAL_TTL_SECONDS,
            "historyRetentionSeconds": DEFAULT_APPROVAL_HISTORY_RETENTION_SECONDS,
            "storage": {
                "enabled": True,
                "path": str(self._storage_path(workspace_dir)),
            },
        }

    def _storage_path(self, workspace_dir: str = "") -> Path:
        return _approval_storage_dir(workspace_dir) / "kernel_approvals.json"

    def _ensure_loaded_locked(self, workspace_dir: str = "") -> None:
        key = _workspace_key(workspace_dir)
        if key in self._loaded_workspaces:
            return
        self._loaded_workspaces[key] = workspace_dir or ""
        path = self._storage_path(workspace_dir)
        if not path.exists():
            return
        try:
            with path.open("r", encoding="utf-8") as handle:
                snapshot = json.load(handle)
        except Exception:
            return
        records = snapshot.get("records", []) if isinstance(snapshot, dict) else snapshot
        if not isinstance(records, list):
            return
        for raw in records:
            if not isinstance(raw, dict):
                continue
            approval_id = str(raw.get("approval_id") or "")
            if not approval_id or approval_id in self._items:
                continue
            item = copy.deepcopy(raw)
            item["workspace_dir"] = item.get("workspace_dir") or workspace_dir or ""
            item.setdefault("status", "pending")
            item.setdefault("tool_name", "")
            item.setdefault("tool_params", {})
            item.setdefault("policy_decision", {})
            item.setdefault("actor", "model")
            item.setdefault("requested_by", "policy_gate")
            item.setdefault("created_at", "")
            item.setdefault("expires_at", "")
            item.setdefault("resolved_at", "")
            item.setdefault("resolution", "")
            item.setdefault("reason", "")
            item.setdefault("params_signature", "")
            item.setdefault("trace_id", "")
            item.setdefault("execution_trace_id", "")
            item.setdefault("recovery_hint", "")
            if not item.get("_expires_epoch"):
                item["_expires_epoch"] = _parse_time_epoch(item.get("expires_at", "")) or time.time()
            self._items[approval_id] = item
        changed_keys = self._prune_locked(time.time())
        if changed_keys:
            self._save_loaded_workspaces_locked(changed_keys)

    def _public_record(self, item: Dict[str, Any], *, include_params: bool = False) -> Dict[str, Any]:
        clean = {k: copy.deepcopy(v) for k, v in item.items() if not k.startswith("_")}
        if not include_params:
            clean["tool_params"] = {"keys": _param_keys_from_item(item)}
        return sanitize_payload(clean)

    def _storage_record(self, item: Dict[str, Any]) -> Dict[str, Any]:
        clean = self._public_record(item, include_params=False)
        clean["_expires_epoch"] = float(item.get("_expires_epoch") or 0)
        return sanitize_payload(clean)

    def _save_workspace_locked(self, workspace_dir: str = "") -> None:
        key = _workspace_key(workspace_dir)
        path = self._storage_path(workspace_dir)
        records = [
            self._storage_record(item)
            for item in self._items.values()
            if _workspace_key(item.get("workspace_dir", "")) == key
        ]
        records.sort(key=lambda value: value.get("created_at", ""))
        if len(records) > MAX_APPROVAL_HISTORY_RECORDS:
            records = records[-MAX_APPROVAL_HISTORY_RECORDS:]
        snapshot = {
            "version": 1,
            "updated_at": _format_time(),
            "retention_seconds": DEFAULT_APPROVAL_HISTORY_RETENTION_SECONDS,
            "records": records,
        }
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = path.with_name(f"{path.name}.{uuid.uuid4().hex}.tmp")
        try:
            with tmp_path.open("w", encoding="utf-8") as handle:
                json.dump(snapshot, handle, ensure_ascii=False, indent=2)
            os.replace(tmp_path, path)
        finally:
            try:
                if tmp_path.exists():
                    tmp_path.unlink()
            except Exception:
                pass

    def _save_loaded_workspaces_locked(self, workspace_keys: set) -> None:
        for key in workspace_keys:
            if key not in self._loaded_workspaces:
                continue
            self._save_workspace_locked(self._loaded_workspaces.get(key, ""))

    def _prune_locked(self, now: Optional[float] = None) -> set:
        current = now or time.time()
        changed_keys = set()
        for approval_id, item in list(self._items.items()):
            item_key = _workspace_key(item.get("workspace_dir", ""))
            expires_epoch = float(item.get("_expires_epoch") or 0)
            if item.get("status") == "pending" and expires_epoch < current:
                item["status"] = "expired"
                item["resolution"] = "expired"
                item["resolved_at"] = _format_time(current)
                changed_keys.add(item_key)
            if item.get("status") in TERMINAL_STATUSES:
                terminal_epoch = _parse_time_epoch(item.get("resolved_at", "")) or expires_epoch or current
                if terminal_epoch + DEFAULT_APPROVAL_HISTORY_RETENTION_SECONDS < current:
                    self._items.pop(approval_id, None)
                    changed_keys.add(item_key)
        return changed_keys


_approval_center = ApprovalCenter()


def get_approval_center() -> ApprovalCenter:
    return _approval_center
