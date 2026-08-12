#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""Parse and guard chat-originated configuration changes."""

from __future__ import annotations

import copy
import json
import threading
import time
import uuid
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from py.kernel.audit import sanitize_payload


LOW_RISK_PATHS = {
    "kernelSettings.contextCompression.enabled",
    "kernelSettings.planner.enabled",
    "kernelSettings.planner.preflightEnabled",
    "kernelSettings.planner.persistPlans",
    "kernelSettings.planner.injectIntoContext",
    "webSearch.enabled",
}

CONFIRM_PATHS = {
    "visionControlSettings.enabled",
}

STRONG_CONFIRM_PATHS = {
    "kernelSettings.runtime.mode",
    "kernelSettings.policyGate.enforcementMode",
    "localEnvSettings.permissionMode",
    "ccSettings.permissionMode",
    "ocSettings.permissionMode",
    "qcSettings.permissionMode",
    "dsSettings.permissionMode",
}

ALLOWED_PERMISSION_MODES = {"default", "plan", "cowork", "auto-approve", "yolo"}
ALLOWED_KERNEL_RUNTIME_MODES = {"off", "shadow", "dual_write", "kernel"}

DEFAULT_INTENT_TTL_SECONDS = 600
_PENDING_INTENTS: Dict[str, Dict[str, Any]] = {}
_PENDING_LOCK = threading.Lock()


@dataclass
class ConfigChange:
    path: str
    value: Any
    current: Any = None
    risk: str = "confirm"
    reason: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ConfigIntent:
    intent_id: str
    status: str
    source_text: str
    changes: List[ConfigChange] = field(default_factory=list)
    requires_confirmation: bool = True
    blocked_reasons: List[str] = field(default_factory=list)
    created_at: str = ""

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["changes"] = [change.to_dict() for change in self.changes]
        return sanitize_payload(data)


def _get_path(settings: Dict[str, Any], path: str) -> Any:
    cur: Any = settings
    for part in path.split("."):
        if not isinstance(cur, dict):
            return None
        cur = cur.get(part)
    return cur


def _set_path(settings: Dict[str, Any], path: str, value: Any) -> None:
    cur: Any = settings
    parts = path.split(".")
    for part in parts[:-1]:
        if not isinstance(cur.get(part), dict):
            cur[part] = {}
        cur = cur[part]
    cur[parts[-1]] = value


def _format_time(epoch: Optional[float] = None) -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S%z", time.localtime(epoch or time.time()))


def _risk_for_path(path: str) -> Tuple[str, bool]:
    if path in LOW_RISK_PATHS:
        return "low", True
    if path in CONFIRM_PATHS:
        return "confirm", True
    if path in STRONG_CONFIRM_PATHS:
        return "strong_confirm", True
    return "blocked", False


def _permission_path(settings: Dict[str, Any]) -> str:
    cli = settings.get("CLISettings", {}) if isinstance(settings, dict) else {}
    engine = str(cli.get("engine") or "local")
    return f"{engine}Settings.permissionMode" if engine != "local" else "localEnvSettings.permissionMode"


def _intent_payload(intent_or_payload: Any) -> Dict[str, Any]:
    if hasattr(intent_or_payload, "to_dict"):
        return intent_or_payload.to_dict()
    if isinstance(intent_or_payload, dict):
        return copy.deepcopy(intent_or_payload)
    return {}


def _canonical_changes(intent_payload: Dict[str, Any]) -> str:
    canonical = []
    for change in intent_payload.get("changes", []) or []:
        if not isinstance(change, dict):
            continue
        canonical.append({
            "path": str(change.get("path") or ""),
            "value": change.get("value"),
        })
    canonical.sort(key=lambda item: item["path"])
    return json.dumps(canonical, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _confirmation_text(intent_id: str) -> str:
    suffix = str(intent_id or "")[-8:] or "intent"
    return f"确认应用 {suffix}"


def register_config_intent(
    intent_or_payload: Any,
    *,
    workspace_dir: str = "",
    actor: str = "user",
    ttl_seconds: int = DEFAULT_INTENT_TTL_SECONDS,
) -> Dict[str, Any]:
    """Register a ready config intent as pending and return the payload with confirmation metadata."""
    payload = _intent_payload(intent_or_payload)
    intent_id = str(payload.get("intent_id") or "")
    ttl = max(30, int(ttl_seconds or DEFAULT_INTENT_TTL_SECONDS))

    if payload.get("status") != "ready" or not intent_id:
        return payload

    created_at = time.time()
    expires_at = created_at + ttl
    confirm_text = _confirmation_text(intent_id)
    with _PENDING_LOCK:
        _PENDING_INTENTS[intent_id] = {
            "intent_id": intent_id,
            "workspace_dir": workspace_dir or "",
            "actor": actor,
            "created_at": created_at,
            "expires_at": expires_at,
            "changes_signature": _canonical_changes(payload),
            "confirmation_text": confirm_text,
            "consumed": False,
        }
        _prune_pending_locked()

    payload["confirmation"] = {
        "required": True,
        "text": confirm_text,
        "expires_at": _format_time(expires_at),
        "ttl_seconds": ttl,
    }
    return sanitize_payload(payload)


def pending_config_intents(workspace_dir: str = "") -> List[Dict[str, Any]]:
    now = time.time()
    with _PENDING_LOCK:
        _prune_pending_locked(now)
        items = []
        for pending in _PENDING_INTENTS.values():
            if pending.get("consumed"):
                continue
            if workspace_dir and pending.get("workspace_dir") not in {"", workspace_dir}:
                continue
            items.append({
                "intent_id": pending.get("intent_id"),
                "workspace_dir": pending.get("workspace_dir", ""),
                "actor": pending.get("actor", ""),
                "created_at": _format_time(pending.get("created_at")),
                "expires_at": _format_time(pending.get("expires_at")),
                "confirmation_text": pending.get("confirmation_text", ""),
            })
        return items


def _prune_pending_locked(now: Optional[float] = None) -> None:
    current = now or time.time()
    expired_ids = [
        intent_id
        for intent_id, pending in _PENDING_INTENTS.items()
        if pending.get("consumed") or float(pending.get("expires_at") or 0) < current
    ]
    for intent_id in expired_ids:
        _PENDING_INTENTS.pop(intent_id, None)


def parse_config_intent(source_text: str, settings: Dict[str, Any]) -> ConfigIntent:
    text = str(source_text or "").strip()
    lowered = text.lower()
    changes: List[ConfigChange] = []
    blocked: List[str] = []

    def add(path: str, value: Any, reason: str) -> None:
        risk, allowed = _risk_for_path(path)
        if not allowed:
            blocked.append(f"{path} is not writable by chat configuration")
            return
        if path.endswith("permissionMode") and value not in ALLOWED_PERMISSION_MODES:
            blocked.append(f"Unsupported permissionMode: {value}")
            return
        if path == "kernelSettings.runtime.mode" and value not in ALLOWED_KERNEL_RUNTIME_MODES:
            blocked.append(f"Unsupported kernel runtime mode: {value}")
            return
        changes.append(ConfigChange(
            path=path,
            value=value,
            current=_get_path(settings, path),
            risk=risk,
            reason=reason,
        ))

    if any(word in text for word in ["上下文压缩", "自动压缩", "压缩上下文"]) or "context compression" in lowered:
        if any(word in text for word in ["关闭", "禁用", "不要"]) or "disable" in lowered:
            add("kernelSettings.contextCompression.enabled", False, "User requested disabling context compression")
        else:
            add("kernelSettings.contextCompression.enabled", True, "User requested enabling context compression")

    if any(word in text for word in ["内核计划", "自动规划", "执行计划", "规划器"]) or "kernel planner" in lowered:
        if any(word in text for word in ["注入上下文", "写入上下文", "加入上下文", "inject into context"]) or "inject into context" in lowered:
            add(
                "kernelSettings.planner.injectIntoContext",
                not (any(word in text for word in ["关闭", "禁用", "不要"]) or "disable" in lowered),
                "User requested kernel planner context injection change",
            )
        elif any(word in text for word in ["预检", "preflight", "pre-flight"]):
            add(
                "kernelSettings.planner.preflightEnabled",
                not (any(word in text for word in ["关闭", "禁用", "不要"]) or "disable" in lowered),
                "User requested kernel planner preflight change",
            )
        elif any(word in text for word in ["持久化", "保存计划", "记录计划", "persist plans"]) or "persist plans" in lowered:
            add(
                "kernelSettings.planner.persistPlans",
                not (any(word in text for word in ["关闭", "禁用", "不要"]) or "disable" in lowered),
                "User requested kernel planner persistence change",
            )
        elif any(word in text for word in ["关闭", "禁用", "不要"]) or "disable" in lowered:
            add("kernelSettings.planner.enabled", False, "User requested disabling kernel planner")
        elif any(word in text for word in ["打开", "开启", "启用"]) or "enable" in lowered:
            add("kernelSettings.planner.enabled", True, "User requested enabling kernel planner")

    if any(word in text for word in ["网页搜索", "网络搜索", "web search", "联网搜索"]):
        if any(word in text for word in ["关闭", "禁用", "不要"]) or "disable" in lowered:
            add("webSearch.enabled", False, "User requested disabling web search")
        else:
            add("webSearch.enabled", True, "User requested enabling web search")

    if any(word in text for word in ["桌面控制", "鼠标控制", "键盘控制", "desktop control"]):
        if any(word in text for word in ["关闭", "禁用", "不要"]) or "disable" in lowered:
            add("visionControlSettings.enabled", False, "User requested disabling desktop control")
        elif any(word in text for word in ["打开", "开启", "启用"]) or "enable" in lowered:
            add("visionControlSettings.enabled", True, "User requested enabling desktop control")

    if "计划模式" in text or "plan mode" in lowered:
        add(_permission_path(settings), "plan", "User requested plan permission mode")
    elif "协作模式" in text or "cowork" in lowered:
        add(_permission_path(settings), "cowork", "User requested cowork permission mode")
    elif "自动批准" in text or "auto-approve" in lowered:
        add(_permission_path(settings), "auto-approve", "User requested auto-approve permission mode")
    elif "yolo" in lowered:
        add(_permission_path(settings), "yolo", "User requested yolo permission mode")

    if (
        "内核运行模式" in text
        or "内核模式" in text
        or "kernel runtime" in lowered
        or "kernel mode" in lowered
        or "dual-write" in lowered
        or "dual_write" in lowered
        or "双写" in text
    ):
        runtime_mode = ""
        if any(word in text for word in ["关闭", "禁用", "停止"]) or "off" in lowered or "disable" in lowered:
            runtime_mode = "off"
        elif any(word in text for word in ["双写", "双轨"]) or "dual-write" in lowered or "dual_write" in lowered:
            runtime_mode = "dual_write"
        elif any(word in text for word in ["接管", "正式", "内核模式"]) or "kernel mode" in lowered:
            runtime_mode = "kernel"
        elif any(word in text for word in ["影子", "只审计", "旁路"]) or "shadow" in lowered:
            runtime_mode = "shadow"
        if runtime_mode in ALLOWED_KERNEL_RUNTIME_MODES:
            add("kernelSettings.runtime.mode", runtime_mode, "User requested kernel runtime mode change")
            if runtime_mode == "kernel":
                add("kernelSettings.policyGate.enforcementMode", "enforce", "Kernel mode requires PolicyGate enforcement")
                add("kernelSettings.planner.enabled", True, "Kernel mode requires planner enabled")
                add("kernelSettings.planner.preflightEnabled", True, "Kernel mode requires planner preflight")
                add("kernelSettings.planner.persistPlans", True, "Kernel mode requires durable plans")
                add("kernelSettings.planner.injectIntoContext", True, "Kernel mode injects plan awareness into model context")
            elif runtime_mode == "dual_write":
                add("kernelSettings.policyGate.enforcementMode", "shadow", "Dual-write keeps PolicyGate in shadow while collecting traces")
                add("kernelSettings.planner.enabled", True, "Dual-write requires planner enabled")
                add("kernelSettings.planner.preflightEnabled", True, "Dual-write requires planner preflight")
                add("kernelSettings.planner.persistPlans", True, "Dual-write requires durable plans")
                add("kernelSettings.planner.injectIntoContext", True, "Dual-write exposes plan awareness without enforcing approvals")
            elif runtime_mode == "shadow":
                add("kernelSettings.policyGate.enforcementMode", "shadow", "Shadow mode keeps PolicyGate observational")
                add("kernelSettings.planner.enabled", True, "Shadow mode keeps planner available")
                add("kernelSettings.planner.preflightEnabled", True, "Shadow mode keeps planner preflight enabled")
                add("kernelSettings.planner.persistPlans", True, "Shadow mode keeps durable plan history")
                add("kernelSettings.planner.injectIntoContext", False, "Shadow mode does not inject plan context by default")
            elif runtime_mode == "off":
                add("kernelSettings.policyGate.enforcementMode", "shadow", "Disabling runtime also disables PolicyGate enforcement")
                add("kernelSettings.planner.enabled", False, "Disabling runtime disables planner")

    if (
        "policygate" in lowered
        or "policy gate" in lowered
        or "权限门" in text
        or "内核权限" in text
        or "统一权限" in text
        or "强制审批" in text
        or "强制拦截" in text
    ):
        if any(word in text for word in ["强制", "拦截", "审批", "开启", "启用"]) or "enforce" in lowered:
            add("kernelSettings.policyGate.enforcementMode", "enforce", "User requested PolicyGate enforcement mode")
        elif any(word in text for word in ["关闭", "禁用", "影子", "只审计", "不拦截"]) or "disable" in lowered or "shadow" in lowered:
            add("kernelSettings.policyGate.enforcementMode", "shadow", "User requested PolicyGate shadow mode")

    status = "ready" if changes and not blocked else "blocked" if blocked else "no_match"
    return ConfigIntent(
        intent_id=f"cfg_{uuid.uuid4().hex}",
        status=status,
        source_text=text,
        changes=changes,
        requires_confirmation=bool(changes),
        blocked_reasons=blocked,
        created_at=time.strftime("%Y-%m-%dT%H:%M:%S%z"),
    )


def apply_config_intent(
    settings: Dict[str, Any],
    intent_payload: Dict[str, Any],
    *,
    confirmed: bool = False,
    confirmation_text: str = "",
    workspace_dir: str = "",
    require_pending: bool = True,
    require_confirmation_text: bool = True,
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """Apply a confirmed intent. Unknown or blocked paths are rejected."""
    intent_payload = intent_payload or {}
    intent_id = str(intent_payload.get("intent_id") or "")

    if not confirmed:
        return settings, {"applied": False, "reason": "confirmation_required", "intent_id": intent_id}

    pending: Optional[Dict[str, Any]] = None
    if require_pending:
        with _PENDING_LOCK:
            _prune_pending_locked()
            pending = copy.deepcopy(_PENDING_INTENTS.get(intent_id))

        if not pending:
            return settings, {
                "applied": False,
                "reason": "pending_intent_not_found_or_expired",
                "intent_id": intent_id,
            }
        if workspace_dir and pending.get("workspace_dir") not in {"", workspace_dir}:
            return settings, {
                "applied": False,
                "reason": "workspace_mismatch",
                "intent_id": intent_id,
            }
        if pending.get("changes_signature") != _canonical_changes(intent_payload):
            return settings, {
                "applied": False,
                "reason": "intent_payload_mismatch",
                "intent_id": intent_id,
            }
        expected_text = str(pending.get("confirmation_text") or "")
        if require_confirmation_text and expected_text and str(confirmation_text or "").strip() != expected_text:
            return settings, {
                "applied": False,
                "reason": "confirmation_text_required",
                "intent_id": intent_id,
                "required_confirmation_text": expected_text,
            }

    next_settings = copy.deepcopy(settings or {})
    applied: List[Dict[str, Any]] = []
    rejected: List[str] = []

    for change in intent_payload.get("changes", []) or []:
        path = str(change.get("path") or "")
        value = change.get("value")
        risk, allowed = _risk_for_path(path)
        if not allowed:
            rejected.append(path)
            continue
        if path.endswith("permissionMode") and value not in ALLOWED_PERMISSION_MODES:
            rejected.append(path)
            continue
        before = _get_path(next_settings, path)
        _set_path(next_settings, path, value)
        applied.append({"path": path, "before": before, "after": value, "risk": risk})

    if applied and require_pending and intent_id:
        with _PENDING_LOCK:
            if intent_id in _PENDING_INTENTS:
                _PENDING_INTENTS[intent_id]["consumed"] = True
            _prune_pending_locked()

    return next_settings, {
        "applied": bool(applied),
        "intent_id": intent_id,
        "changes": sanitize_payload(applied),
        "rejected": rejected,
    }
