# -*- coding: utf-8 -*-
"""独立 Desktop Control Worker，通过 NDJSON 协议执行 Windows 窗口操作。"""

from __future__ import annotations

import argparse
import asyncio
from collections.abc import Mapping
import importlib
import platform
import sys
from typing import Any

from py.desktop_control_runtime import ACTION_LABELS, DesktopControlRuntimeController
from py.workers.runtime import WorkerRuntime


DESKTOP_CONTROL_DEPENDENCIES = ("win32api", "win32con", "win32gui", "win32process")
SNAP_POSITIONS = {
    "maximize",
    "left",
    "right",
    "top",
    "bottom",
    "center",
    "top_left",
    "top_right",
    "bottom_left",
    "bottom_right",
    "left_third",
    "center_third",
    "right_third",
}


class DesktopControlWorkerHandlers:
    """校验 Desktop Control Worker 请求并委托框架无关控制器。"""

    def __init__(self, controller: DesktopControlRuntimeController) -> None:
        """保存控制器；输入控制器，无返回，不访问 Windows API。"""

        self._controller = controller

    def dependencies(self, _payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """检查平台和 pywin32 依赖；忽略输入，返回布尔映射，导入失败不抛出异常。"""

        available: dict[str, bool] = {"windows": platform.system() == "Windows"}
        for module_name in DESKTOP_CONTROL_DEPENDENCIES:
            try:
                importlib.import_module(module_name)
                available[module_name] = True
            except ImportError:
                available[module_name] = False
        return {"dependencies": available}

    async def list_windows(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """列出窗口；输入精确筛选载荷，返回脱敏列表，字段无效时抛出 ValueError。"""

        self._require_fields(payload, {"titleQuery", "includeHidden", "includeMinimized", "limit"})
        title_query = self._require_text(payload.get("titleQuery"), "titleQuery", 256, allow_empty=True)
        include_hidden = self._require_bool(payload.get("includeHidden"), "includeHidden")
        include_minimized = self._require_bool(payload.get("includeMinimized"), "includeMinimized")
        limit = self._require_int(payload.get("limit"), "limit", 1, 100)
        return await self._controller.list_windows(
            title_query,
            include_hidden,
            include_minimized,
            limit,
        )

    async def list_monitors(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """列出显示器；输入必须为空对象，返回脱敏列表，额外字段时抛出 ValueError。"""

        self._require_fields(payload, set())
        return await self._controller.list_monitors()

    async def get_active_window(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """读取活动窗口；输入必须为空对象，返回脱敏状态，额外字段时抛出 ValueError。"""

        self._require_fields(payload, set())
        return await self._controller.get_active_window()

    async def list_history(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """读取动作历史；输入精确数量，返回进程内记录，字段无效时抛出 ValueError。"""

        self._require_fields(payload, {"limit"})
        limit = self._require_int(payload.get("limit"), "limit", 1, 40)
        return await self._controller.list_history(limit)

    async def execute_action(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """执行窗口动作；输入精确动作请求，返回脱敏结果，字段或动作无效时抛出 ValueError。"""

        self._require_fields(payload, {"action", "hwnd", "payload"})
        action = self._require_text(payload.get("action"), "action", 64)
        if action not in ACTION_LABELS:
            raise ValueError("Desktop control action is invalid.")
        hwnd = self._require_int(payload.get("hwnd"), "hwnd", 1, 2**53 - 1)
        action_payload = payload.get("payload")
        if not isinstance(action_payload, Mapping):
            raise ValueError("Desktop control action payload must be an object.")
        normalized_payload = self._parse_action_payload(action, action_payload)
        return await self._controller.execute_action(action, hwnd, normalized_payload)

    def _parse_action_payload(self, action: str, payload: Mapping[str, Any]) -> dict[str, Any]:
        """解析动作载荷；输入动作和映射，返回精确字典，字段或范围无效时抛出 ValueError。"""

        if action in {"focus", "minimize"}:
            self._require_fields(payload, set())
            return {}
        if action == "topmost":
            self._require_allowed_fields(payload, {"enabled"})
            if "enabled" not in payload:
                return {}
            return {"enabled": self._require_bool(payload.get("enabled"), "enabled")}
        if action == "move":
            self._require_fields(payload, {"x", "y"})
            return {
                "x": self._require_int(payload.get("x"), "x", -100_000, 100_000),
                "y": self._require_int(payload.get("y"), "y", -100_000, 100_000),
            }
        if action == "resize":
            self._require_fields(payload, {"width", "height"})
            return {
                "width": self._require_int(payload.get("width"), "width", 1, 32_768),
                "height": self._require_int(payload.get("height"), "height", 1, 32_768),
            }
        if action == "snap":
            self._require_fields(payload, {"position", "monitorIndex", "useWorkArea"})
            position = self._require_text(payload.get("position"), "position", 32)
            if position not in SNAP_POSITIONS:
                raise ValueError("Desktop control snap position is invalid.")
            monitor_index = payload.get("monitorIndex")
            return {
                "position": position,
                "monitorIndex": None if monitor_index is None else self._require_int(
                    monitor_index,
                    "monitorIndex",
                    0,
                    64,
                ),
                "useWorkArea": self._require_bool(payload.get("useWorkArea"), "useWorkArea"),
            }
        if action == "move_to_monitor":
            self._require_fields(payload, {"monitorIndex", "useWorkArea"})
            return {
                "monitorIndex": self._require_int(payload.get("monitorIndex"), "monitorIndex", 0, 64),
                "useWorkArea": self._require_bool(payload.get("useWorkArea"), "useWorkArea"),
            }
        self._require_fields(payload, {"useWorkArea"})
        return {"useWorkArea": self._require_bool(payload.get("useWorkArea"), "useWorkArea")}

    def _require_fields(self, payload: Mapping[str, Any], fields: set[str]) -> None:
        """校验精确字段集合；输入映射和字段，无返回，不一致时抛出 ValueError。"""

        if set(payload) != fields:
            raise ValueError("Desktop control Worker request fields are invalid.")

    def _require_allowed_fields(self, payload: Mapping[str, Any], fields: set[str]) -> None:
        """校验可选字段集合；输入映射和允许字段，无返回，出现额外字段时抛出 ValueError。"""

        if any(field not in fields for field in payload):
            raise ValueError("Desktop control Worker request fields are invalid.")

    def _require_text(
        self,
        value: Any,
        field: str,
        maximum_length: int,
        *,
        allow_empty: bool = False,
    ) -> str:
        """校验有界文本；输入值、字段、长度和空值策略，返回文本，无效时抛出 ValueError。"""

        if not isinstance(value, str):
            raise ValueError(f"Desktop control field '{field}' is invalid.")
        normalized = value.strip()
        if len(normalized) > maximum_length or (not allow_empty and not normalized):
            raise ValueError(f"Desktop control field '{field}' is invalid.")
        return normalized

    def _require_bool(self, value: Any, field: str) -> bool:
        """校验布尔值；输入值和字段，返回布尔值，类型无效时抛出 ValueError。"""

        if not isinstance(value, bool):
            raise ValueError(f"Desktop control field '{field}' is invalid.")
        return value

    def _require_int(self, value: Any, field: str, minimum: int, maximum: int) -> int:
        """校验整数范围；输入值、字段和上下界，返回整数，类型或超界时抛出 ValueError。"""

        if isinstance(value, bool) or not isinstance(value, int) or not minimum <= value <= maximum:
            raise ValueError(f"Desktop control field '{field}' is invalid.")
        return value


def parse_arguments() -> argparse.Namespace:
    """解析 Worker 命令行参数；无输入，返回参数对象，无效参数由 argparse 终止进程。"""

    parser = argparse.ArgumentParser(description=__doc__)
    return parser.parse_args()


def configure_utf8_standard_streams() -> None:
    """把标准流固定为 UTF-8/LF；无输入和返回，不支持 reconfigure 的流保持原样。"""

    for stream in (sys.stdin, sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            reconfigure(encoding="utf-8", errors="strict", newline="\n")


async def run() -> None:
    """运行 Desktop Control Worker RPC；无输入和返回，协议结束时退出进程。"""

    parse_arguments()
    configure_utf8_standard_streams()
    protocol_output = sys.stdout
    sys.stdout = sys.stderr
    runtime = WorkerRuntime("desktop-control", output=protocol_output)
    handlers = DesktopControlWorkerHandlers(DesktopControlRuntimeController())
    runtime.register_handler("desktop_control.dependencies", handlers.dependencies)
    runtime.register_handler("desktop_control.list_windows", handlers.list_windows)
    runtime.register_handler("desktop_control.list_monitors", handlers.list_monitors)
    runtime.register_handler("desktop_control.get_active_window", handlers.get_active_window)
    runtime.register_handler("desktop_control.list_history", handlers.list_history)
    runtime.register_handler("desktop_control.execute_action", handlers.execute_action)
    await runtime.serve_stdio()


if __name__ == "__main__":
    asyncio.run(run())
