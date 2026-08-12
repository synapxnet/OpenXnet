# -*- coding: utf-8 -*-
"""验证 Desktop Control 控制器和 Worker 请求边界。"""

from __future__ import annotations

from typing import Any
import unittest

from py.desktop_control_runtime import DesktopControlRuntimeController
from py.workers.desktop_control_worker import DesktopControlWorkerHandlers


RECT = {"left": 0, "top": 0, "right": 800, "bottom": 600, "width": 800, "height": 600}
WINDOW = {
    "hwnd": 1234,
    "title": "编辑器",
    "class_name": "EditorWindow",
    "process_id": 99,
    "process_path": "C:\\private\\editor.exe",
    "process_name": "editor.exe",
    "visible": True,
    "minimized": False,
    "maximized": False,
    "is_active": True,
    "always_on_top": False,
    "rect": RECT,
}
MONITOR = {
    "handle": 1,
    "index": 0,
    "device_name": "DISPLAY1",
    "label": "主显示器",
    "is_primary": True,
    "bounds": RECT,
    "work_area": RECT,
}


class FakeDesktopOperations:
    """返回固定窗口数据并记录动作的底层操作替身。"""

    def __init__(self) -> None:
        """初始化空调用列表；无输入和返回，不访问 Windows API。"""

        self.calls: list[tuple[str, tuple[Any, ...], dict[str, Any]]] = []

    def list_windows(self, **options: Any) -> dict[str, Any]:
        """返回一个窗口；输入筛选参数，返回原始结构，并记录调用。"""

        self.calls.append(("list_windows", (), options))
        return {"success": True, "count": 1, "windows": [WINDOW]}

    def list_monitors(self) -> dict[str, Any]:
        """返回一个显示器；无输入，返回原始结构，不访问系统。"""

        return {"success": True, "count": 1, "monitors": [MONITOR]}

    def get_active_window(self) -> dict[str, Any]:
        """返回固定活动窗口；无输入，返回原始结构，不访问系统。"""

        return {
            "success": True,
            "found": True,
            "supported": True,
            "detected_at": "2026-07-29T00:00:00Z",
            "window": WINDOW,
        }

    def focus_window(self, hwnd: int) -> dict[str, Any]:
        """记录聚焦；输入句柄，返回固定窗口结果，不修改真实窗口。"""

        self.calls.append(("focus", (hwnd,), {}))
        return {"success": True, "action": "focus_window", "window": WINDOW}

    def minimize_window(self, hwnd: int) -> dict[str, Any]:
        """记录最小化；输入句柄，返回固定窗口结果，不修改真实窗口。"""

        return self.focus_window(hwnd)

    def toggle_always_on_top(self, hwnd: int, **options: Any) -> dict[str, Any]:
        """记录置顶；输入句柄和选项，返回固定窗口结果，不修改真实窗口。"""

        self.calls.append(("topmost", (hwnd,), options))
        return {"success": True, "window": WINDOW}

    def move_window(self, hwnd: int, x: int, y: int) -> dict[str, Any]:
        """记录移动；输入句柄和坐标，返回固定窗口结果，不修改真实窗口。"""

        self.calls.append(("move", (hwnd, x, y), {}))
        return {"success": True, "window": WINDOW}

    def resize_window(self, hwnd: int, width: int, height: int) -> dict[str, Any]:
        """记录尺寸；输入句柄和尺寸，返回固定窗口结果，不修改真实窗口。"""

        self.calls.append(("resize", (hwnd, width, height), {}))
        return {"success": True, "window": WINDOW}

    def snap_window(self, hwnd: int, position: str, **options: Any) -> dict[str, Any]:
        """记录贴靠；输入句柄、位置和选项，返回带显示器结果，不修改真实窗口。"""

        self.calls.append(("snap", (hwnd, position), options))
        return {"success": True, "window": WINDOW, "monitor": MONITOR, "position": position}

    def move_to_monitor(self, hwnd: int, monitor_index: int, **options: Any) -> dict[str, Any]:
        """记录跨显示器移动；输入句柄、索引和选项，返回固定结果，不修改真实窗口。"""

        self.calls.append(("move_to_monitor", (hwnd, monitor_index), options))
        return {"success": True, "window": WINDOW, "monitor": MONITOR}

    def move_to_adjacent_monitor(self, hwnd: int, direction: str, **options: Any) -> dict[str, Any]:
        """记录相邻显示器移动；输入句柄、方向和选项，返回固定结果，不修改真实窗口。"""

        self.calls.append(("adjacent", (hwnd, direction), options))
        return {"success": True, "window": WINDOW, "monitor": MONITOR}


class DesktopControlRuntimeTests(unittest.IsolatedAsyncioTestCase):
    """验证控制器脱敏、历史和动作委托。"""

    async def test_lists_and_active_window_remove_process_path(self) -> None:
        """确认窗口、显示器和活动窗口结果不含本机进程路径。"""

        controller = DesktopControlRuntimeController(FakeDesktopOperations())
        windows = await controller.list_windows("", False, True, 20)
        monitors = await controller.list_monitors()
        active = await controller.get_active_window()

        self.assertEqual(windows["count"], 1)
        self.assertEqual(monitors["count"], 1)
        self.assertEqual(active["window"]["processName"], "editor.exe")
        self.assertNotIn("process_path", str(windows))
        self.assertNotIn("processPath", str(windows))

    async def test_action_creates_bounded_history(self) -> None:
        """确认动作返回固定 schema，并在当前 Worker 中生成无原始错误的历史。"""

        controller = DesktopControlRuntimeController(FakeDesktopOperations())
        result = await controller.execute_action(
            "snap",
            1234,
            {"position": "left", "monitorIndex": None, "useWorkArea": True},
        )
        history = await controller.list_history(8)

        self.assertTrue(result["success"])
        self.assertEqual(result["action"], "snap")
        self.assertEqual(history["count"], 1)
        self.assertEqual(history["items"][0]["actionLabel"], "贴靠")


class DesktopControlWorkerHandlerTests(unittest.IsolatedAsyncioTestCase):
    """验证 Worker 对请求进行二次精确校验。"""

    async def test_worker_forwards_exact_requests(self) -> None:
        """确认列表和动作请求通过精确字段校验后交给控制器。"""

        handlers = DesktopControlWorkerHandlers(
            DesktopControlRuntimeController(FakeDesktopOperations())
        )
        windows = await handlers.list_windows({
            "titleQuery": "",
            "includeHidden": False,
            "includeMinimized": True,
            "limit": 12,
        })
        action = await handlers.execute_action({
            "action": "focus",
            "hwnd": 1234,
            "payload": {},
        })

        self.assertEqual(windows["count"], 1)
        self.assertEqual(action["window"]["hwnd"], 1234)

    async def test_worker_rejects_extra_fields_and_unsafe_actions(self) -> None:
        """确认 Worker 拒绝路径字段、未知动作和不完整载荷。"""

        handlers = DesktopControlWorkerHandlers(
            DesktopControlRuntimeController(FakeDesktopOperations())
        )
        with self.assertRaisesRegex(ValueError, "fields"):
            await handlers.list_windows({
                "titleQuery": "",
                "includeHidden": False,
                "includeMinimized": True,
                "limit": 12,
                "path": "C:\\private",
            })
        with self.assertRaisesRegex(ValueError, "action"):
            await handlers.execute_action({"action": "close", "hwnd": 1234, "payload": {}})
        with self.assertRaisesRegex(ValueError, "fields"):
            await handlers.execute_action({"action": "move", "hwnd": 1234, "payload": {"x": 1}})


if __name__ == "__main__":
    unittest.main()
