#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
Desktop Window Control Service.

Provides Windows-native top-level window enumeration and core management
operations so OpenXnet can move from mouse/keyboard simulation to real shell
window control.

Author: OpenAI Codex
Department: R&D
Date: 2026-04-17
Version: 1.4.0
Security Level: INTERNAL
"""

__version__ = "1.4.0"
__author__ = "OpenAI Codex"
__copyright__ = "Copyright 2026 Synapxnet"
__maintainer__ = "OpenAI Codex"
__email__ = "synapxnet@gmail.com"

# Modification History:
# 2026-04-17, v1.0.0, OpenAI Codex: Initial creation.
# 2026-04-17, v1.1.0, OpenAI Codex: Added monitor enumeration and snap-window actions.
# 2026-04-17, v1.2.0, OpenAI Codex: Added active-window sensing payloads for follow-active workflows.
# 2026-04-17, v1.3.0, OpenAI Codex: Added move-to-monitor action for selected-display workflows.
# 2026-04-17, v1.4.0, OpenAI Codex: Added previous/next monitor transfer actions for multi-display workflows.

import ctypes
import math
import platform
from ctypes import wintypes
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

WINDOWS_API_AVAILABLE = False

try:
    import win32api
    import win32con
    import win32gui
    import win32process

    WINDOWS_API_AVAILABLE = True
except Exception:
    win32api = None
    win32con = None
    win32gui = None
    win32process = None


class DesktopWindowControlError(RuntimeError):
    """Raised when a desktop window control action cannot be completed."""


_EXCLUDED_WINDOW_CLASSES = {
    "Progman",
    "WorkerW",
    "Shell_TrayWnd",
    "Button",
}

_DWMWA_CLOAKED = 14

_SNAP_POSITION_ALIASES = {
    "maximize": "maximize",
    "max": "maximize",
    "full": "maximize",
    "fill": "maximize",
    "left": "left",
    "left-half": "left",
    "left_half": "left",
    "right": "right",
    "right-half": "right",
    "right_half": "right",
    "top": "top",
    "top-half": "top",
    "top_half": "top",
    "bottom": "bottom",
    "bottom-half": "bottom",
    "bottom_half": "bottom",
    "center": "center",
    "middle": "center",
    "top-left": "top_left",
    "top_left": "top_left",
    "topleft": "top_left",
    "top-right": "top_right",
    "top_right": "top_right",
    "topright": "top_right",
    "bottom-left": "bottom_left",
    "bottom_left": "bottom_left",
    "bottomleft": "bottom_left",
    "bottom-right": "bottom_right",
    "bottom_right": "bottom_right",
    "bottomright": "bottom_right",
    "left-third": "left_third",
    "left_third": "left_third",
    "center-third": "center_third",
    "center_third": "center_third",
    "right-third": "right_third",
    "right_third": "right_third",
}

try:
    _DWMAPI = ctypes.windll.dwmapi
except Exception:
    _DWMAPI = None


def ensure_window_control_available() -> None:
    """Ensure the current runtime can use Windows shell APIs."""
    if platform.system() != "Windows":
        raise DesktopWindowControlError("Desktop window control currently supports Windows only.")
    if not WINDOWS_API_AVAILABLE:
        raise DesktopWindowControlError("pywin32 is not available in the current runtime.")


def _is_window_cloaked(hwnd: int) -> bool:
    if _DWMAPI is None:
        return False
    cloaked = wintypes.DWORD()
    try:
        result = _DWMAPI.DwmGetWindowAttribute(
            wintypes.HWND(hwnd),
            ctypes.c_uint(_DWMWA_CLOAKED),
            ctypes.byref(cloaked),
            ctypes.sizeof(cloaked),
        )
        return result == 0 and bool(cloaked.value)
    except Exception:
        return False


def _foreground_window_handle() -> int:
    if not WINDOWS_API_AVAILABLE:
        return 0
    try:
        return int(win32gui.GetForegroundWindow() or 0)
    except Exception:
        return 0


def _safe_process_path(pid: int) -> str:
    if not pid or not WINDOWS_API_AVAILABLE:
        return ""
    process_handle = None
    query_mask = getattr(win32con, "PROCESS_QUERY_LIMITED_INFORMATION", 0x1000) | getattr(win32con, "PROCESS_VM_READ", 0x0010)
    try:
        process_handle = win32api.OpenProcess(query_mask, False, pid)
        return win32process.GetModuleFileNameEx(process_handle, 0) or ""
    except Exception:
        return ""
    finally:
        if process_handle:
            try:
                win32api.CloseHandle(process_handle)
            except Exception:
                pass


def _window_rect(hwnd: int) -> Dict[str, int]:
    left, top, right, bottom = win32gui.GetWindowRect(hwnd)
    return {
        "left": int(left),
        "top": int(top),
        "right": int(right),
        "bottom": int(bottom),
        "width": max(0, int(right - left)),
        "height": max(0, int(bottom - top)),
    }


def _rect_payload(rect: Any) -> Dict[str, int]:
    left, top, right, bottom = rect
    return {
        "left": int(left),
        "top": int(top),
        "right": int(right),
        "bottom": int(bottom),
        "width": max(0, int(right - left)),
        "height": max(0, int(bottom - top)),
    }


def _monitor_label(device_name: str, index: int) -> str:
    if WINDOWS_API_AVAILABLE:
        try:
            device = win32api.EnumDisplayDevices(device_name, 0)
            if device and getattr(device, "DeviceString", ""):
                return str(device.DeviceString).strip()
        except Exception:
            pass
    return device_name.strip() or f"Monitor {index + 1}"


def _monitor_payload(monitor_handle: int, index: int) -> Dict[str, Any]:
    info = win32api.GetMonitorInfo(monitor_handle)
    device_name = str(info.get("Device") or "").strip()
    flags = int(info.get("Flags") or 0)
    return {
        "handle": int(monitor_handle),
        "index": int(index),
        "device_name": device_name,
        "label": _monitor_label(device_name, index),
        "is_primary": bool(flags & getattr(win32con, "MONITORINFOF_PRIMARY", 1)),
        "bounds": _rect_payload(info.get("Monitor") or (0, 0, 0, 0)),
        "work_area": _rect_payload(info.get("Work") or (0, 0, 0, 0)),
    }


def _collect_monitors() -> List[Dict[str, Any]]:
    ensure_window_control_available()
    monitors: List[Dict[str, Any]] = []
    for index, monitor_data in enumerate(win32api.EnumDisplayMonitors()):
        monitor_handle = int(monitor_data[0])
        monitors.append(_monitor_payload(monitor_handle, index))
    return monitors


def _resolve_monitor(index: Optional[int] = None) -> Dict[str, Any]:
    monitors = _collect_monitors()
    if not monitors:
        raise DesktopWindowControlError("No display monitors were detected.")

    if index is None:
        primary_monitor = next((item for item in monitors if item["is_primary"]), None)
        return primary_monitor or monitors[0]

    target_index = int(index)
    for monitor in monitors:
        if monitor["index"] == target_index:
            return monitor
    raise DesktopWindowControlError(f"Monitor index {target_index} does not exist.")


def _normalize_snap_position(position: str) -> str:
    normalized = str(position or "").strip().lower()
    snap_position = _SNAP_POSITION_ALIASES.get(normalized)
    if not snap_position:
        supported = ", ".join(sorted(set(_SNAP_POSITION_ALIASES.values())))
        raise DesktopWindowControlError(f"Unsupported snap position '{position}'. Supported positions: {supported}")
    return snap_position


def _monitor_target_area(monitor_payload: Dict[str, Any], use_work_area: bool) -> Dict[str, int]:
    area = monitor_payload["work_area"] if use_work_area else monitor_payload["bounds"]
    if int(area.get("width") or 0) <= 0 or int(area.get("height") or 0) <= 0:
        raise DesktopWindowControlError("The selected monitor does not have a usable work area.")
    return area


def _snap_target_rect(position: str, area: Dict[str, int], current_rect: Dict[str, int]) -> Dict[str, int]:
    left = int(area["left"])
    top = int(area["top"])
    width = max(260, int(area["width"]))
    height = max(180, int(area["height"]))
    half_width = max(260, width // 2)
    half_height = max(180, height // 2)
    third_width = max(260, width // 3)

    if position == "maximize":
        return {"left": left, "top": top, "width": width, "height": height}
    if position == "left":
        return {"left": left, "top": top, "width": half_width, "height": height}
    if position == "right":
        return {"left": left + width - half_width, "top": top, "width": half_width, "height": height}
    if position == "top":
        return {"left": left, "top": top, "width": width, "height": half_height}
    if position == "bottom":
        return {"left": left, "top": top + height - half_height, "width": width, "height": half_height}
    if position == "top_left":
        return {"left": left, "top": top, "width": half_width, "height": half_height}
    if position == "top_right":
        return {
            "left": left + width - half_width,
            "top": top,
            "width": half_width,
            "height": half_height,
        }
    if position == "bottom_left":
        return {
            "left": left,
            "top": top + height - half_height,
            "width": half_width,
            "height": half_height,
        }
    if position == "bottom_right":
        return {
            "left": left + width - half_width,
            "top": top + height - half_height,
            "width": half_width,
            "height": half_height,
        }
    if position == "left_third":
        return {"left": left, "top": top, "width": third_width, "height": height}
    if position == "center_third":
        return {
            "left": left + max(0, (width - third_width) // 2),
            "top": top,
            "width": third_width,
            "height": height,
        }
    if position == "right_third":
        return {"left": left + width - third_width, "top": top, "width": third_width, "height": height}
    if position == "center":
        max_width = max(260, int(width * 0.82))
        max_height = max(180, int(height * 0.82))
        centered_width = min(max(260, int(current_rect["width"])), max_width)
        centered_height = min(max(180, int(current_rect["height"])), max_height)
        return {
            "left": left + max(0, (width - centered_width) // 2),
            "top": top + max(0, (height - centered_height) // 2),
            "width": centered_width,
            "height": centered_height,
        }
    raise DesktopWindowControlError(f"Unsupported snap position '{position}'.")


def _monitor_transfer_rect(area: Dict[str, int], current_rect: Dict[str, int]) -> Dict[str, int]:
    area_left = int(area["left"])
    area_top = int(area["top"])
    area_width = max(260, int(area["width"]))
    area_height = max(180, int(area["height"]))
    current_width = max(260, int(current_rect.get("width") or 960))
    current_height = max(180, int(current_rect.get("height") or 620))

    target_width = min(current_width, area_width)
    target_height = min(current_height, area_height)

    return {
        "left": area_left + max(0, (area_width - target_width) // 2),
        "top": area_top + max(0, (area_height - target_height) // 2),
        "width": target_width,
        "height": target_height,
    }


def _monitor_center(monitor_payload: Dict[str, Any]) -> tuple[float, float]:
    bounds = monitor_payload.get("bounds") or {}
    left = float(bounds.get("left") or 0)
    top = float(bounds.get("top") or 0)
    width = float(bounds.get("width") or 0)
    height = float(bounds.get("height") or 0)
    return left + (width / 2), top + (height / 2)


def _window_center(current_rect: Dict[str, int]) -> tuple[float, float]:
    left = float(current_rect.get("left") or 0)
    top = float(current_rect.get("top") or 0)
    width = float(current_rect.get("width") or 0)
    height = float(current_rect.get("height") or 0)
    return left + (width / 2), top + (height / 2)


def _resolve_monitor_for_window(current_rect: Dict[str, int]) -> Dict[str, Any]:
    monitors = _collect_monitors()
    if not monitors:
        raise DesktopWindowControlError("No display monitors were detected.")

    center_x, center_y = _window_center(current_rect)

    for monitor in monitors:
        bounds = monitor.get("bounds") or {}
        left = int(bounds.get("left") or 0)
        top = int(bounds.get("top") or 0)
        right = int(bounds.get("right") or (left + int(bounds.get("width") or 0)))
        bottom = int(bounds.get("bottom") or (top + int(bounds.get("height") or 0)))
        if left <= center_x <= right and top <= center_y <= bottom:
            return monitor

    return min(
        monitors,
        key=lambda monitor: math.hypot(
            center_x - _monitor_center(monitor)[0],
            center_y - _monitor_center(monitor)[1],
        ),
    )


def _resolve_adjacent_monitor(current_monitor: Dict[str, Any], direction: str) -> Dict[str, Any]:
    monitors = sorted(
        _collect_monitors(),
        key=lambda monitor: (
            int((monitor.get("bounds") or {}).get("left") or 0),
            int((monitor.get("bounds") or {}).get("top") or 0),
            int(monitor.get("index") or 0),
        ),
    )
    if not monitors:
        raise DesktopWindowControlError("No display monitors were detected.")

    current_index = next(
        (idx for idx, monitor in enumerate(monitors) if int(monitor.get("index") or -1) == int(current_monitor.get("index") or -2)),
        0,
    )
    step = 1 if direction == "next" else -1
    target_index = (current_index + step) % len(monitors)
    return monitors[target_index]


def _base_window_payload(hwnd: int, *, active_hwnd: Optional[int] = None) -> Dict[str, Any]:
    ensure_window_control_available()
    if not win32gui.IsWindow(hwnd):
        raise DesktopWindowControlError(f"Window handle {hwnd} is invalid.")
    if active_hwnd is None:
        active_hwnd = _foreground_window_handle()

    title = (win32gui.GetWindowText(hwnd) or "").strip()
    class_name = win32gui.GetClassName(hwnd)
    rect = _window_rect(hwnd)
    visible = bool(win32gui.IsWindowVisible(hwnd))
    minimized = bool(win32gui.IsIconic(hwnd))
    placement = win32gui.GetWindowPlacement(hwnd)
    show_cmd = placement[1] if placement else 0
    maximized = show_cmd in {
        getattr(win32con, "SW_MAXIMIZE", 3),
        getattr(win32con, "SW_SHOWMAXIMIZED", 3),
    }
    _, process_id = win32process.GetWindowThreadProcessId(hwnd)
    process_path = _safe_process_path(process_id)
    ex_style = win32gui.GetWindowLong(hwnd, win32con.GWL_EXSTYLE)

    return {
        "hwnd": int(hwnd),
        "title": title,
        "class_name": class_name,
        "process_id": int(process_id or 0),
        "process_path": process_path,
        "process_name": Path(process_path).name if process_path else "",
        "visible": visible,
        "minimized": minimized,
        "maximized": maximized,
        "is_active": bool(int(hwnd) == int(active_hwnd or 0)),
        "always_on_top": bool(ex_style & win32con.WS_EX_TOPMOST),
        "rect": rect,
    }


def _should_include_window(
    hwnd: int,
    *,
    include_hidden: bool,
    include_minimized: bool,
    title_query: str,
    active_hwnd: Optional[int] = None,
) -> bool:
    if not win32gui.IsWindow(hwnd):
        return False
    if win32gui.GetParent(hwnd):
        return False

    payload = _base_window_payload(hwnd, active_hwnd=active_hwnd)
    title = payload["title"]
    class_name = payload["class_name"]
    rect = payload["rect"]

    if class_name in _EXCLUDED_WINDOW_CLASSES:
        return False
    if _is_window_cloaked(hwnd):
        return False
    if not title:
        return False
    if rect["width"] <= 0 or rect["height"] <= 0:
        return False
    if not include_hidden and not payload["visible"]:
        return False
    if not include_minimized and payload["minimized"]:
        return False
    if not payload["minimized"] and (rect["width"] < 120 or rect["height"] < 80):
        return False
    if title_query and title_query.lower() not in title.lower():
        return False
    return True


def list_windows(
    *,
    title_query: str = "",
    include_hidden: bool = False,
    include_minimized: bool = True,
    limit: int = 20,
) -> Dict[str, Any]:
    """Enumerate top-level desktop windows."""
    ensure_window_control_available()

    title_query = (title_query or "").strip()
    active_hwnd = _foreground_window_handle()
    windows: List[Dict[str, Any]] = []

    def _collector(hwnd: int, _extra: Any) -> bool:
        try:
            if _should_include_window(
                hwnd,
                include_hidden=include_hidden,
                include_minimized=include_minimized,
                title_query=title_query,
                active_hwnd=active_hwnd,
            ):
                windows.append(_base_window_payload(hwnd, active_hwnd=active_hwnd))
        except Exception:
            pass
        return True

    win32gui.EnumWindows(_collector, None)
    windows.sort(
        key=lambda item: (
            not item["is_active"],
            not item["visible"],
            item["minimized"],
            item["title"].lower(),
            item["hwnd"],
        )
    )
    if limit and limit > 0:
        windows = windows[: int(limit)]
    return {
        "success": True,
        "platform": platform.system(),
        "count": len(windows),
        "windows": windows,
    }


def list_monitors() -> Dict[str, Any]:
    """Enumerate available desktop monitors."""
    monitors = _collect_monitors()
    return {
        "success": True,
        "platform": platform.system(),
        "count": len(monitors),
        "monitors": monitors,
    }


def get_active_window() -> Dict[str, Any]:
    """Return the current foreground desktop window."""
    ensure_window_control_available()

    active_hwnd = _foreground_window_handle()
    detected_at = datetime.now(timezone.utc).isoformat()
    if not active_hwnd or not win32gui.IsWindow(active_hwnd):
        return {
            "success": True,
            "platform": platform.system(),
            "found": False,
            "supported": False,
            "detected_at": detected_at,
            "window": None,
            "reason": "No foreground window is currently available.",
        }

    window_payload = _base_window_payload(active_hwnd, active_hwnd=active_hwnd)
    supported = _should_include_window(
        active_hwnd,
        include_hidden=True,
        include_minimized=True,
        title_query="",
        active_hwnd=active_hwnd,
    )
    payload: Dict[str, Any] = {
        "success": True,
        "platform": platform.system(),
        "found": True,
        "supported": supported,
        "detected_at": detected_at,
        "window": window_payload,
    }
    if not supported:
        payload["reason"] = "The foreground window is not a supported top-level application window."
    return payload


def _prime_foreground_permission() -> None:
    try:
        win32api.keybd_event(win32con.VK_MENU, 0, 0, 0)
        win32api.keybd_event(win32con.VK_MENU, 0, win32con.KEYEVENTF_KEYUP, 0)
    except Exception:
        pass


def _ensure_window(hwnd: int) -> None:
    ensure_window_control_available()
    if not win32gui.IsWindow(hwnd):
        raise DesktopWindowControlError(f"Window handle {hwnd} does not exist.")


def focus_window(hwnd: int) -> Dict[str, Any]:
    """Restore and focus a window."""
    _ensure_window(hwnd)
    if win32gui.IsIconic(hwnd):
        win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
    else:
        win32gui.ShowWindow(hwnd, win32con.SW_SHOW)
    _prime_foreground_permission()
    try:
        win32gui.BringWindowToTop(hwnd)
        win32gui.SetForegroundWindow(hwnd)
    except Exception as exc:
        raise DesktopWindowControlError(f"Failed to focus window {hwnd}: {exc}") from exc
    return {"success": True, "action": "focus_window", "window": _base_window_payload(hwnd)}


def minimize_window(hwnd: int) -> Dict[str, Any]:
    """Minimize a window."""
    _ensure_window(hwnd)
    try:
        win32gui.ShowWindow(hwnd, win32con.SW_MINIMIZE)
    except Exception as exc:
        raise DesktopWindowControlError(f"Failed to minimize window {hwnd}: {exc}") from exc
    return {"success": True, "action": "minimize_window", "window": _base_window_payload(hwnd)}


def toggle_always_on_top(hwnd: int, enabled: Optional[bool] = None) -> Dict[str, Any]:
    """Toggle a window's top-most state."""
    _ensure_window(hwnd)
    current_state = _base_window_payload(hwnd)["always_on_top"]
    next_state = (not current_state) if enabled is None else bool(enabled)
    try:
        win32gui.SetWindowPos(
            hwnd,
            win32con.HWND_TOPMOST if next_state else win32con.HWND_NOTOPMOST,
            0,
            0,
            0,
            0,
            win32con.SWP_NOMOVE | win32con.SWP_NOSIZE | win32con.SWP_NOACTIVATE,
        )
    except Exception as exc:
        raise DesktopWindowControlError(f"Failed to update top-most state for window {hwnd}: {exc}") from exc
    return {"success": True, "action": "toggle_always_on_top", "window": _base_window_payload(hwnd)}


def move_window(hwnd: int, x: int, y: int) -> Dict[str, Any]:
    """Move a window to a new screen position."""
    _ensure_window(hwnd)
    rect = _window_rect(hwnd)
    try:
        win32gui.MoveWindow(hwnd, int(x), int(y), rect["width"], rect["height"], True)
    except Exception as exc:
        raise DesktopWindowControlError(f"Failed to move window {hwnd}: {exc}") from exc
    return {"success": True, "action": "move_window", "window": _base_window_payload(hwnd)}


def resize_window(hwnd: int, width: int, height: int) -> Dict[str, Any]:
    """Resize a window while keeping its current top-left position."""
    _ensure_window(hwnd)
    width = max(260, int(width))
    height = max(180, int(height))
    rect = _window_rect(hwnd)
    try:
        win32gui.MoveWindow(hwnd, rect["left"], rect["top"], width, height, True)
    except Exception as exc:
        raise DesktopWindowControlError(f"Failed to resize window {hwnd}: {exc}") from exc
    return {"success": True, "action": "resize_window", "window": _base_window_payload(hwnd)}


def snap_window(
    hwnd: int,
    position: str,
    *,
    monitor_index: Optional[int] = None,
    use_work_area: bool = True,
) -> Dict[str, Any]:
    """Snap a window into a preset layout region on a target monitor."""
    _ensure_window(hwnd)
    normalized_position = _normalize_snap_position(position)
    monitor_payload = _resolve_monitor(monitor_index)
    target_area = _monitor_target_area(monitor_payload, bool(use_work_area))

    if win32gui.IsIconic(hwnd):
        win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)

    current_rect = _window_rect(hwnd)
    target_rect = _snap_target_rect(normalized_position, target_area, current_rect)

    try:
        win32gui.MoveWindow(
            hwnd,
            int(target_rect["left"]),
            int(target_rect["top"]),
            int(target_rect["width"]),
            int(target_rect["height"]),
            True,
        )
    except Exception as exc:
        raise DesktopWindowControlError(f"Failed to snap window {hwnd}: {exc}") from exc

    return {
        "success": True,
        "action": "snap_window",
        "position": normalized_position,
        "monitor": monitor_payload,
        "use_work_area": bool(use_work_area),
        "window": _base_window_payload(hwnd),
    }


def move_to_monitor(
    hwnd: int,
    monitor_index: int,
    *,
    use_work_area: bool = True,
) -> Dict[str, Any]:
    """Move a window onto the selected monitor and center it within the target area."""
    _ensure_window(hwnd)
    monitor_payload = _resolve_monitor(monitor_index)
    target_area = _monitor_target_area(monitor_payload, bool(use_work_area))

    if win32gui.IsIconic(hwnd):
        win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)

    current_rect = _window_rect(hwnd)
    target_rect = _monitor_transfer_rect(target_area, current_rect)

    try:
        win32gui.MoveWindow(
            hwnd,
            int(target_rect["left"]),
            int(target_rect["top"]),
            int(target_rect["width"]),
            int(target_rect["height"]),
            True,
        )
    except Exception as exc:
        raise DesktopWindowControlError(f"Failed to move window {hwnd} to monitor {monitor_index}: {exc}") from exc

    return {
        "success": True,
        "action": "move_to_monitor",
        "monitor": monitor_payload,
        "use_work_area": bool(use_work_area),
        "window": _base_window_payload(hwnd),
    }


def move_to_adjacent_monitor(
    hwnd: int,
    direction: str,
    *,
    use_work_area: bool = True,
) -> Dict[str, Any]:
    """Move a window to the previous or next monitor in desktop order."""
    _ensure_window(hwnd)
    normalized_direction = str(direction or "").strip().lower()
    if normalized_direction not in {"previous", "next"}:
        raise DesktopWindowControlError("Monitor direction must be 'previous' or 'next'.")

    if win32gui.IsIconic(hwnd):
        win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)

    current_rect = _window_rect(hwnd)
    current_monitor = _resolve_monitor_for_window(current_rect)
    target_monitor = _resolve_adjacent_monitor(current_monitor, normalized_direction)
    target_area = _monitor_target_area(target_monitor, bool(use_work_area))
    target_rect = _monitor_transfer_rect(target_area, current_rect)

    try:
        win32gui.MoveWindow(
            hwnd,
            int(target_rect["left"]),
            int(target_rect["top"]),
            int(target_rect["width"]),
            int(target_rect["height"]),
            True,
        )
    except Exception as exc:
        raise DesktopWindowControlError(
            f"Failed to move window {hwnd} to the {normalized_direction} monitor: {exc}"
        ) from exc

    return {
        "success": True,
        "action": f"move_to_{normalized_direction}_monitor",
        "direction": normalized_direction,
        "monitor": target_monitor,
        "source_monitor": current_monitor,
        "use_work_area": bool(use_work_area),
        "window": _base_window_payload(hwnd),
    }
