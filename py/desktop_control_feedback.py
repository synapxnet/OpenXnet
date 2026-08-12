#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
Desktop control overlay feedback helpers.

Builds consistent Dynamic Island payloads for desktop window actions and keeps
an in-memory recent-action buffer for the Developer Workbench.

Author: OpenAI Codex
Department: R&D
Date: 2026-04-17
Version: 1.3.0
Security Level: INTERNAL
"""

__version__ = "1.3.0"
__author__ = "OpenAI Codex"
__copyright__ = "Copyright 2026 Synapxnet"
__maintainer__ = "OpenAI Codex"
__email__ = "synapxnet@gmail.com"

# Modification History:
# 2026-04-17, v1.0.0, OpenAI Codex: Initial creation.
# 2026-04-17, v1.1.0, OpenAI Codex: Added recent desktop-action history buffer and structured overlay payloads.
# 2026-04-17, v1.2.0, OpenAI Codex: Added monitor-transfer feedback for selected-display workflows.
# 2026-04-17, v1.3.0, OpenAI Codex: Added previous/next monitor transfer feedback for multi-display workflows.

from collections import deque
from copy import deepcopy
from datetime import datetime
from threading import Lock
from typing import Any, Optional

from py.overlay_router import broadcast_task_delivery_event

_RECENT_EVENT_LIMIT = 24
_recent_desktop_control_events: deque[dict[str, Any]] = deque(maxlen=_RECENT_EVENT_LIMIT)
_recent_desktop_control_lock = Lock()

_ACTION_TITLES = {
    "focus_window": "桌面窗口已聚焦",
    "minimize_window": "桌面窗口已最小化",
    "toggle_always_on_top": "桌面窗口置顶状态已更新",
    "move_window": "桌面窗口已移动",
    "resize_window": "桌面窗口尺寸已更新",
    "snap_window": "桌面窗口贴靠已完成",
    "move_to_monitor": "桌面窗口已切换显示器",
    "move_to_previous_monitor": "桌面窗口已移动到上一显示器",
    "move_to_next_monitor": "桌面窗口已移动到下一显示器",
}

_ACTION_LABELS = {
    "focus_window": "聚焦",
    "minimize_window": "最小化",
    "toggle_always_on_top": "置顶",
    "move_window": "移动",
    "resize_window": "调整尺寸",
    "snap_window": "贴靠",
    "move_to_monitor": "切换显示器",
    "move_to_previous_monitor": "上一显示器",
    "move_to_next_monitor": "下一显示器",
}

_ACTION_FAILURE_LABELS = {
    "focus_window": "聚焦桌面窗口",
    "minimize_window": "最小化桌面窗口",
    "toggle_always_on_top": "更新桌面窗口置顶状态",
    "move_window": "移动桌面窗口",
    "resize_window": "调整桌面窗口尺寸",
    "snap_window": "执行桌面窗口贴靠",
    "move_to_monitor": "将桌面窗口送到显示器",
    "move_to_previous_monitor": "将桌面窗口送到上一显示器",
    "move_to_next_monitor": "将桌面窗口送到下一显示器",
}

_POSITION_LABELS = {
    "maximize": "铺满工作区",
    "left": "左半屏",
    "right": "右半屏",
    "top": "上半屏",
    "bottom": "下半屏",
    "center": "居中布局",
    "top_left": "左上角",
    "top_right": "右上角",
    "bottom_left": "左下角",
    "bottom_right": "右下角",
    "left_third": "左侧三分之一",
    "center_third": "中间三分之一",
    "right_third": "右侧三分之一",
}

_STATUS_LABELS = {
    "completed": "Completed",
    "failed": "Failed",
}


def _strip_text(value: Any) -> str:
    return str(value or "").strip()


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _rect_snapshot(rect_payload: Any) -> dict[str, int]:
    rect = rect_payload if isinstance(rect_payload, dict) else {}
    return {
        "left": _safe_int(rect.get("left")),
        "top": _safe_int(rect.get("top")),
        "width": _safe_int(rect.get("width")),
        "height": _safe_int(rect.get("height")),
    }


def _monitor_snapshot(monitor_payload: Any) -> dict[str, Any] | None:
    if not isinstance(monitor_payload, dict):
        return None
    return {
        "index": _safe_int(monitor_payload.get("index"), -1),
        "label": _strip_text(monitor_payload.get("label") or monitor_payload.get("device_name") or "Display"),
        "is_primary": bool(monitor_payload.get("is_primary")),
        "bounds": _rect_snapshot(monitor_payload.get("bounds")),
        "work_area": _rect_snapshot(monitor_payload.get("work_area")),
    }


def _window_snapshot(window_payload: Any, hwnd: int) -> dict[str, Any]:
    window_data = window_payload if isinstance(window_payload, dict) else {}
    return {
        "hwnd": _safe_int(window_data.get("hwnd"), hwnd),
        "title": _strip_text(window_data.get("title") or f"HWND {hwnd}"),
        "process_name": _strip_text(window_data.get("process_name")),
        "class_name": _strip_text(window_data.get("class_name")),
        "process_id": _safe_int(window_data.get("process_id")),
        "visible": bool(window_data.get("visible", True)),
        "minimized": bool(window_data.get("minimized")),
        "always_on_top": bool(window_data.get("always_on_top")),
        "rect": _rect_snapshot(window_data.get("rect")),
    }


def _window_label(window_snapshot: dict[str, Any]) -> str:
    title = _strip_text(window_snapshot.get("title"))
    if title:
        return title
    process_name = _strip_text(window_snapshot.get("process_name"))
    if process_name:
        return process_name
    return f"HWND {_safe_int(window_snapshot.get('hwnd'))}"


def _position_label(position: str) -> str:
    normalized = _strip_text(position).lower()
    return _POSITION_LABELS.get(normalized, normalized.replace("_", " ") if normalized else "")


def _monitor_label(monitor_snapshot: dict[str, Any] | None) -> str:
    if not monitor_snapshot:
        return ""
    label = _strip_text(monitor_snapshot.get("label"))
    if label:
        return label
    monitor_index = _safe_int(monitor_snapshot.get("index"), -1)
    if monitor_index >= 0:
        return f"Display {monitor_index + 1}"
    return "Display"


def _success_summary(
    action_name: str,
    window_snapshot: dict[str, Any],
    monitor_snapshot: dict[str, Any] | None,
    position: str,
) -> str:
    label = _window_label(window_snapshot)
    rect = window_snapshot.get("rect") or {}
    left = _safe_int(rect.get("left"))
    top = _safe_int(rect.get("top"))
    width = _safe_int(rect.get("width"))
    height = _safe_int(rect.get("height"))

    if action_name == "focus_window":
        return f"已聚焦“{label}”，当前位置 ({left}, {top})，窗口尺寸 {width} × {height}。"

    if action_name == "minimize_window":
        return f"已最小化“{label}”，可随时在桌面窗口控制面板继续恢复或调整。"

    if action_name == "toggle_always_on_top":
        state_label = "置顶" if window_snapshot.get("always_on_top") else "取消置顶"
        return f"已对“{label}”执行{state_label}，当前位置 ({left}, {top})，窗口尺寸 {width} × {height}。"

    if action_name == "move_window":
        return f"已将“{label}”移动到 ({left}, {top})，窗口尺寸保持为 {width} × {height}。"

    if action_name == "resize_window":
        return f"已将“{label}”调整为 {width} × {height}，当前位置仍为 ({left}, {top})。"

    if action_name == "snap_window":
        monitor_label = _monitor_label(monitor_snapshot) or "当前显示器"
        snap_label = _position_label(position) or "贴靠布局"
        return f"已将“{label}”贴靠到 {monitor_label} 的“{snap_label}”，当前位置 ({left}, {top})，窗口尺寸 {width} × {height}。"

    if action_name == "move_to_monitor":
        monitor_label = _monitor_label(monitor_snapshot) or "目标显示器"
        return f"已将“{label}”送到 {monitor_label}，当前位置 ({left}, {top})，窗口尺寸 {width} × {height}。"

    if action_name == "move_to_previous_monitor":
        monitor_label = _monitor_label(monitor_snapshot) or "上一显示器"
        return f"已将“{label}”送到上一显示器 {monitor_label}，当前位置 ({left}, {top})，窗口尺寸 {width} × {height}。"

    if action_name == "move_to_next_monitor":
        monitor_label = _monitor_label(monitor_snapshot) or "下一显示器"
        return f"已将“{label}”送到下一显示器 {monitor_label}，当前位置 ({left}, {top})，窗口尺寸 {width} × {height}。"

    return f"已完成“{label}”的桌面窗口操作。"


def _failure_summary(action_name: str, hwnd: int, error: str) -> str:
    action_label = _ACTION_FAILURE_LABELS.get(action_name, "执行桌面窗口操作")
    return f"{action_label}失败，目标 HWND {hwnd}。原因：{error}"


def _remember_event(event_payload: dict[str, Any]) -> None:
    with _recent_desktop_control_lock:
        _recent_desktop_control_events.appendleft(deepcopy(event_payload))


def list_desktop_control_feedback(limit: int = 8) -> dict[str, Any]:
    normalized_limit = max(1, min(_safe_int(limit, 8), 40))
    with _recent_desktop_control_lock:
        items = [deepcopy(item) for item in list(_recent_desktop_control_events)[:normalized_limit]]
    return {
        "success": True,
        "count": len(items),
        "items": items,
        "generated_at": datetime.now().isoformat(),
    }


async def broadcast_desktop_control_feedback(
    action_name: str,
    hwnd: int,
    *,
    result: Optional[dict[str, Any]] = None,
    error: Optional[str] = None,
    channel: str = "dynamic_island",
) -> tuple[str, dict[str, Any]]:
    payload_result = result if isinstance(result, dict) else {}
    raw_window_payload = payload_result.get("window") if isinstance(payload_result.get("window"), dict) else {}
    raw_monitor_payload = payload_result.get("monitor") if isinstance(payload_result.get("monitor"), dict) else (
        raw_window_payload.get("_overlay_monitor") if isinstance(raw_window_payload.get("_overlay_monitor"), dict) else {}
    )
    position = _strip_text(payload_result.get("position") or raw_window_payload.get("_overlay_position"))

    window_snapshot = _window_snapshot(raw_window_payload, int(hwnd))
    monitor_snapshot = _monitor_snapshot(raw_monitor_payload)
    status = "failed" if error else "completed"
    timestamp = datetime.now().isoformat()
    title = _ACTION_TITLES.get(action_name, "桌面窗口操作已完成")
    summary = (
        _failure_summary(action_name, int(hwnd), _strip_text(error))
        if error
        else _success_summary(action_name, window_snapshot, monitor_snapshot, position)
    )

    desktop_control_payload = {
        "action": action_name,
        "action_label": _ACTION_LABELS.get(action_name, action_name),
        "status": status,
        "status_label": _STATUS_LABELS.get(status, status.title()),
        "hwnd": int(hwnd),
        "window": window_snapshot,
        "monitor": monitor_snapshot,
        "position": position,
    }

    event_payload = {
        "id": f"desktop-control-feedback:{action_name}:{int(hwnd)}:{int(datetime.now().timestamp() * 1000)}",
        "kind": "desktop_control_feedback",
        "title": title if not error else f"{title}失败",
        "summary": summary,
        "status": status,
        "status_label": _STATUS_LABELS.get(status, status.title()),
        "schedule_type": "manual",
        "task_id": f"desktop-control:{action_name}:{int(hwnd)}",
        "timestamp": timestamp,
        "presentation": "dynamic_island",
        "channel": channel,
        "action": action_name,
        "action_label": _ACTION_LABELS.get(action_name, action_name),
        "hwnd": int(hwnd),
        "window": window_snapshot,
        "monitor": monitor_snapshot,
        "position": position,
        "desktop_control": desktop_control_payload,
    }

    _remember_event(event_payload)

    overlay_payload = {
        "kind": "desktop_control_feedback",
        "title": event_payload["title"],
        "summary": summary,
        "status": status,
        "schedule_type": "manual",
        "task_id": event_payload["task_id"],
        "timestamp": timestamp,
        "presentation": "dynamic_island",
        "desktop_control": desktop_control_payload,
    }

    try:
        return await broadcast_task_delivery_event(overlay_payload, channel=channel)
    except Exception:
        return channel, overlay_payload
