# -*- coding: utf-8 -*-
"""Desktop Control Worker 使用的框架无关窗口控制器。"""

from __future__ import annotations

import asyncio
from collections import deque
from collections.abc import Mapping
from datetime import datetime, timezone
from typing import Any
import uuid


WINDOWS_SCHEMA = "openxnet.desktop-control-windows.v1"
MONITORS_SCHEMA = "openxnet.desktop-control-monitors.v1"
ACTIVE_WINDOW_SCHEMA = "openxnet.desktop-control-active-window.v1"
HISTORY_SCHEMA = "openxnet.desktop-control-history.v1"
ACTION_SCHEMA = "openxnet.desktop-control-action.v1"
MAX_HISTORY_ITEMS = 40

ACTION_LABELS = {
    "focus": "聚焦",
    "minimize": "最小化",
    "topmost": "置顶",
    "move": "移动",
    "resize": "调整尺寸",
    "snap": "贴靠",
    "move_to_monitor": "切换显示器",
    "move_to_previous_monitor": "上一显示器",
    "move_to_next_monitor": "下一显示器",
}


class DesktopControlRuntimeController:
    """封装 Windows API 操作并生成有界、无本机路径的公开结果。"""

    def __init__(self, operations: Any | None = None) -> None:
        """创建控制器；输入可选底层操作集合，无返回，不访问窗口或启动线程。"""

        if operations is None:
            from py import desktop_window_control

            operations = desktop_window_control
        self._operations = operations
        self._history: deque[dict[str, Any]] = deque(maxlen=MAX_HISTORY_ITEMS)

    async def list_windows(
        self,
        title_query: str,
        include_hidden: bool,
        include_minimized: bool,
        limit: int,
    ) -> dict[str, Any]:
        """列出顶层窗口；输入筛选条件，返回有界脱敏列表，底层失败时抛出固定 RuntimeError。"""

        try:
            result = await asyncio.to_thread(
                self._operations.list_windows,
                title_query=title_query,
                include_hidden=include_hidden,
                include_minimized=include_minimized,
                limit=limit,
            )
            raw_windows = result.get("windows", []) if isinstance(result, Mapping) else []
            windows = [self._sanitize_window(item) for item in list(raw_windows)[:limit]]
            return {"schema": WINDOWS_SCHEMA, "count": len(windows), "windows": windows}
        except Exception as error:
            raise RuntimeError("Desktop control window list failed.") from error

    async def list_monitors(self) -> dict[str, Any]:
        """列出显示器；无输入，返回最多 64 个脱敏显示器，底层失败时抛出固定 RuntimeError。"""

        try:
            result = await asyncio.to_thread(self._operations.list_monitors)
            raw_monitors = result.get("monitors", []) if isinstance(result, Mapping) else []
            monitors = [self._sanitize_monitor(item) for item in list(raw_monitors)[:64]]
            return {"schema": MONITORS_SCHEMA, "count": len(monitors), "monitors": monitors}
        except Exception as error:
            raise RuntimeError("Desktop control monitor list failed.") from error

    async def get_active_window(self) -> dict[str, Any]:
        """读取活动窗口；无输入，返回固定脱敏状态，底层失败时抛出固定 RuntimeError。"""

        try:
            result = await asyncio.to_thread(self._operations.get_active_window)
            record = self._require_mapping(result, "active window")
            raw_window = record.get("window")
            window = self._sanitize_window(raw_window) if isinstance(raw_window, Mapping) else None
            return {
                "schema": ACTIVE_WINDOW_SCHEMA,
                "found": window is not None,
                "supported": bool(record.get("supported")) if window is not None else False,
                "detectedAt": self._bounded_text(
                    record.get("detected_at") or datetime.now(timezone.utc).isoformat(),
                    128,
                ),
                "reason": self._bounded_text(record.get("reason"), 512),
                "window": window,
            }
        except Exception as error:
            raise RuntimeError("Desktop control active-window query failed.") from error

    async def list_history(self, limit: int) -> dict[str, Any]:
        """读取进程内动作历史；输入数量，返回防御性副本，不访问 Windows API。"""

        normalized_limit = max(1, min(int(limit), MAX_HISTORY_ITEMS))
        items = [dict(item) for item in list(self._history)[:normalized_limit]]
        return {
            "schema": HISTORY_SCHEMA,
            "count": len(items),
            "items": items,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
        }

    async def execute_action(
        self,
        action: str,
        hwnd: int,
        payload: Mapping[str, Any],
    ) -> dict[str, Any]:
        """执行一个窗口动作；输入动作、句柄和精确载荷，返回脱敏结果，失败时记录固定历史并抛出异常。"""

        normalized_action = str(action or "")
        normalized_hwnd = int(hwnd)
        try:
            raw_result = await asyncio.to_thread(
                self._dispatch_action,
                normalized_action,
                normalized_hwnd,
                payload,
            )
            result = self._sanitize_action_result(normalized_action, raw_result)
            self._remember_action(normalized_action, normalized_hwnd, result, failed=False)
            return result
        except Exception as error:
            self._remember_action(normalized_action, normalized_hwnd, None, failed=True)
            raise RuntimeError("Desktop control action failed.") from error

    def _dispatch_action(
        self,
        action: str,
        hwnd: int,
        payload: Mapping[str, Any],
    ) -> Mapping[str, Any]:
        """分派同步底层动作；输入规范动作和载荷，返回原始映射，未知动作时抛出 ValueError。"""

        if action == "focus":
            return self._operations.focus_window(hwnd)
        if action == "minimize":
            return self._operations.minimize_window(hwnd)
        if action == "topmost":
            return self._operations.toggle_always_on_top(hwnd, enabled=payload.get("enabled"))
        if action == "move":
            return self._operations.move_window(hwnd, int(payload["x"]), int(payload["y"]))
        if action == "resize":
            return self._operations.resize_window(hwnd, int(payload["width"]), int(payload["height"]))
        if action == "snap":
            return self._operations.snap_window(
                hwnd,
                str(payload["position"]),
                monitor_index=payload.get("monitorIndex"),
                use_work_area=bool(payload.get("useWorkArea", True)),
            )
        if action == "move_to_monitor":
            return self._operations.move_to_monitor(
                hwnd,
                int(payload["monitorIndex"]),
                use_work_area=bool(payload.get("useWorkArea", True)),
            )
        if action in {"move_to_previous_monitor", "move_to_next_monitor"}:
            direction = "previous" if action == "move_to_previous_monitor" else "next"
            return self._operations.move_to_adjacent_monitor(
                hwnd,
                direction,
                use_work_area=bool(payload.get("useWorkArea", True)),
            )
        raise ValueError("Desktop control action is invalid.")

    def _sanitize_action_result(
        self,
        action: str,
        value: Any,
    ) -> dict[str, Any]:
        """规范动作结果；输入动作和原始映射，返回固定 schema，缺少窗口时抛出 ValueError。"""

        record = self._require_mapping(value, "action result")
        raw_monitor = record.get("monitor")
        return {
            "schema": ACTION_SCHEMA,
            "success": True,
            "action": action,
            "window": self._sanitize_window(record.get("window")),
            "monitor": self._sanitize_monitor(raw_monitor) if isinstance(raw_monitor, Mapping) else None,
            "position": self._bounded_text(record.get("position"), 32),
        }

    def _sanitize_window(self, value: Any) -> dict[str, Any]:
        """脱敏一个窗口；输入原始映射，返回固定字段并删除进程路径，结构无效时抛出 ValueError。"""

        record = self._require_mapping(value, "window")
        hwnd = self._bounded_int(record.get("hwnd"), 1, 2**53 - 1, "hwnd")
        return {
            "hwnd": hwnd,
            "title": self._bounded_text(record.get("title"), 1_024),
            "className": self._bounded_text(record.get("class_name"), 256),
            "processId": self._bounded_int(record.get("process_id", 0), 0, 2**53 - 1, "processId"),
            "processName": self._bounded_text(record.get("process_name"), 512),
            "visible": bool(record.get("visible")),
            "minimized": bool(record.get("minimized")),
            "maximized": bool(record.get("maximized")),
            "isActive": bool(record.get("is_active")),
            "alwaysOnTop": bool(record.get("always_on_top")),
            "rect": self._sanitize_rect(record.get("rect")),
        }

    def _sanitize_monitor(self, value: Any) -> dict[str, Any]:
        """规范一个显示器；输入原始映射，返回固定字段，结构无效时抛出 ValueError。"""

        record = self._require_mapping(value, "monitor")
        return {
            "handle": self._bounded_int(record.get("handle", 0), 0, 2**53 - 1, "handle"),
            "index": self._bounded_int(record.get("index"), 0, 63, "index"),
            "deviceName": self._bounded_text(record.get("device_name"), 256),
            "label": self._bounded_text(record.get("label"), 512),
            "isPrimary": bool(record.get("is_primary")),
            "bounds": self._sanitize_rect(record.get("bounds")),
            "workArea": self._sanitize_rect(record.get("work_area")),
        }

    def _sanitize_rect(self, value: Any) -> dict[str, int]:
        """规范窗口矩形；输入原始映射，返回六个有界整数，字段无效时抛出 ValueError。"""

        record = self._require_mapping(value, "rect")
        return {
            "left": self._bounded_int(record.get("left"), -1_000_000, 1_000_000, "left"),
            "top": self._bounded_int(record.get("top"), -1_000_000, 1_000_000, "top"),
            "right": self._bounded_int(record.get("right"), -1_000_000, 1_000_000, "right"),
            "bottom": self._bounded_int(record.get("bottom"), -1_000_000, 1_000_000, "bottom"),
            "width": self._bounded_int(record.get("width"), 0, 1_000_000, "width"),
            "height": self._bounded_int(record.get("height"), 0, 1_000_000, "height"),
        }

    def _remember_action(
        self,
        action: str,
        hwnd: int,
        result: Mapping[str, Any] | None,
        *,
        failed: bool,
    ) -> None:
        """记录有界动作摘要；输入动作、句柄、结果和失败标志，无返回，仅修改进程内历史。"""

        window = dict(result["window"]) if result and isinstance(result.get("window"), Mapping) else None
        monitor = dict(result["monitor"]) if result and isinstance(result.get("monitor"), Mapping) else None
        title = self._bounded_text(window.get("title") if window else "", 1_024)
        action_label = ACTION_LABELS.get(action, action)
        status = "failed" if failed else "completed"
        summary = (
            f"{action_label}窗口失败，目标 HWND {hwnd}。"
            if failed
            else f"已对“{title or f'HWND {hwnd}'}”完成{action_label}操作。"
        )
        self._history.appendleft({
            "id": f"desktop-control:{uuid.uuid4()}",
            "title": "桌面窗口操作失败" if failed else "桌面窗口操作已完成",
            "summary": summary,
            "status": status,
            "statusLabel": "Failed" if failed else "Completed",
            "action": action,
            "actionLabel": action_label,
            "hwnd": hwnd,
            "window": window,
            "monitor": monitor,
            "position": self._bounded_text(result.get("position") if result else "", 32),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    def _require_mapping(self, value: Any, label: str) -> Mapping[str, Any]:
        """校验映射；输入未知值和标签，返回映射，类型错误时抛出 ValueError。"""

        if not isinstance(value, Mapping):
            raise ValueError(f"Desktop control {label} is invalid.")
        return value

    def _bounded_text(self, value: Any, maximum_length: int) -> str:
        """截断公开文本；输入未知值和长度，返回无控制字符文本，无失败副作用。"""

        normalized = " ".join(str(value or "").split())
        return normalized[:maximum_length]

    def _bounded_int(self, value: Any, minimum: int, maximum: int, label: str) -> int:
        """校验整数范围；输入未知值、上下界和标签，返回整数，超界时抛出 ValueError。"""

        if isinstance(value, bool):
            raise ValueError(f"Desktop control {label} is invalid.")
        normalized = int(value)
        if normalized < minimum or normalized > maximum:
            raise ValueError(f"Desktop control {label} is invalid.")
        return normalized
