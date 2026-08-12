#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright 2026 Synapxnet
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
# ==============================================================================
"""
Computer Use — 桌面自动化操作工具 (鼠标/键盘/截屏)。

Author: maoyo
Date: 2026-04-13
Version: 1.0.0
"""

__version__ = "1.0.0"
__author__ = "maoyo"
__copyright__ = "Copyright 2026 Synapxnet"
__license__ = "Apache-2.0"
__maintainer__ = "maoyo"
__email__ = "synapxnet@gmail.com"

import asyncio
import time
import platform
import json
import os
from typing import List, Optional, Tuple
from functools import wraps

from py.desktop_window_control import (
    DesktopWindowControlError,
    focus_window as core_focus_window,
    get_active_window as core_get_active_window,
    list_monitors as core_list_monitors,
    list_windows as core_list_windows,
    minimize_window as core_minimize_window,
    move_window as core_move_window,
    resize_window as core_resize_window,
    snap_window as core_snap_window,
    toggle_always_on_top as core_toggle_always_on_top,
)
from py.desktop_control_feedback import broadcast_desktop_control_feedback

# ================== 核心修复：安全导入 GUI 库 ==================
GUI_AVAILABLE = False
try:
    import pyautogui
    import pyperclip
    # 开启安全防故障机制
    pyautogui.FAILSAFE = True
    pyautogui.PAUSE = 0.05
    GUI_AVAILABLE = True
except (KeyError, ImportError, Exception) as e:
    # 如果在 Docker/无显示器环境中，忽略报错，只打印警告
    print(f"⚠️ [Warning] 桌面鼠标键盘工具已禁用 (缺少 DISPLAY): {e}")

# 拦截器：如果大模型在 Docker 里试图调用鼠标键盘，给它返回一句话，而不是让系统崩溃
def require_gui(func):
    @wraps(func)
    async def wrapper(*args, **kwargs):
        if not GUI_AVAILABLE:
            return "执行失败：当前系统运行在无头环境(如Docker)中，没有物理显示器，无法执行鼠标和键盘操作。"
        return await func(*args, **kwargs)
    return wrapper
# ==============================================================


CURRENT_SCREEN_REGION = None

def set_screen_region(region: Optional[Tuple[int, int, int, int]]):
    """设置当前激活的屏幕映射区域"""
    global CURRENT_SCREEN_REGION
    CURRENT_SCREEN_REGION = region

def _percent_to_pixel(x_percent: float, y_percent: float) -> Tuple[int, int]:
    """内部辅助函数：将千分比 (0 到 1000) 转换为当前屏幕或指定区域的实际像素坐标。"""
    x_percent = max(0, min(1000, float(x_percent)))
    y_percent = max(0, min(1000, float(y_percent)))
    
    # 如果指定了局部屏幕区域，则基于局部区域计算坐标
    if CURRENT_SCREEN_REGION is not None:
        rx, ry, rw, rh = CURRENT_SCREEN_REGION
        px = rx + int(rw * (x_percent / 1000))
        py = ry + int(rh * (y_percent / 1000))
        
        # 确保不超出该区域的边界
        px = min(px, rx + rw - 1)
        py = min(py, ry + rh - 1)
        return px, py
        
    # 否则默认映射全屏坐标
    width, height = pyautogui.size()
    px = min(int(width * (x_percent / 1000)), width - 1)
    py = min(int(height * (y_percent / 1000)), height - 1)
    
    return px, py


@require_gui
async def mouse_move(x: float, y: float, duration: float = 0.5) -> str:
    """移动鼠标到屏幕千分比位置"""
    if x < 0 or x > 1000 or y < 0 or y > 1000:
        return "千分比坐标超出范围，请输入 0 到 1000 之间的值。"
    
    px, py = _percent_to_pixel(x, y)
    
    def _move():
        pyautogui.moveTo(px, py, duration=duration, tween=pyautogui.easeInOutQuad)
        time.sleep(0.02)
    
    await asyncio.to_thread(_move)
    return f"鼠标已成功移动到屏幕位置 ({x}‰, {y}‰)。 [LAST_ACTION: MOVE({x},{y})]"


@require_gui
async def mouse_click(button: str = "left", clicks: int = 1, x: Optional[float] = None, y: Optional[float] = None) -> str:
    """点击鼠标（支持千分比坐标）"""
    if x is not None and y is not None:
        if x < 0 or x > 1000 or y < 0 or y > 1000:    
            return "千分比坐标超出范围，请输入 0 到 1000 之间的值。"
        
        def _click_at():
            px, py = _percent_to_pixel(x, y)
            pyautogui.moveTo(px, py, duration=0.2)
            time.sleep(0.2) 
            pyautogui.click(x=px, y=py, clicks=clicks, button=button, interval=0.1)
            
        await asyncio.to_thread(_click_at)
        # 根据点击次数打上不同的标签
        tag = f"CLICK({x},{y})" if clicks == 1 else f"DOUBLE_CLICK({x},{y})"
        return f"鼠标已移动到 ({x}‰, {y}‰) 并使用 {button} 键点击了 {clicks} 次。 [LAST_ACTION: {tag}]"
    else:
        # 如果没有传入坐标（原地点击），我们无法在图片上准确标出位置，所以不带坐标标签
        await asyncio.to_thread(pyautogui.click, clicks=clicks, button=button, interval=0.1)
        return f"鼠标在当前位置使用 {button} 键点击了 {clicks} 次。[LAST_ACTION: CLICK_CURRENT]"


@require_gui
async def mouse_double_click(button: str = "left", x: Optional[float] = None, y: Optional[float] = None) -> str:
    """双击鼠标"""
    if x is not None and y is not None:
        if x < 0 or x > 1000 or y < 0 or y > 1000:    
            return "千分比坐标超出范围，请输入 0 到 1000 之间的值。"
        
        def _double_click():
            px, py = _percent_to_pixel(x, y)
            pyautogui.moveTo(px, py, duration=0.2)
            time.sleep(0.2)
            pyautogui.click(x=px, y=py, clicks=2, button=button, interval=0.1)
            
        await asyncio.to_thread(_double_click)
        return f"鼠标已移动到 ({x}‰, {y}‰) 并使用 {button} 键双击。 [LAST_ACTION: DOUBLE_CLICK({x},{y})]"
    else:
        await asyncio.to_thread(pyautogui.click, clicks=2, button=button, interval=0.1)
        return f"鼠标在当前位置使用 {button} 键双击。 [LAST_ACTION: CLICK_CURRENT]"


@require_gui
async def mouse_drag(x1: float, y1: float, x2: float, y2: float, duration: float = 1.0, button: str = "left") -> str:
    """从起始位置 (x1, y1) 拖拽到终点位置 (x2, y2)"""
    try:
        coords = {"x1": x1, "y1": y1, "x2": x2, "y2": y2}
        for name, val in coords.items():
            if val < 0 or val > 1000:
                return f"错误：{name} 坐标 ({val}) 超出范围，请输入 0 到 1000 之间的值。"
        
        px1, py1 = _percent_to_pixel(x1, y1)
        px2, py2 = _percent_to_pixel(x2, y2)
        
        def _drag():
            pyautogui.moveTo(px1, py1, duration=0.2)
            time.sleep(0.2) 
            pyautogui.dragTo(x=px2, y=py2, duration=duration, button=button, tween=pyautogui.easeInOutQuad)
            time.sleep(0.1)
            
        await asyncio.to_thread(_drag)
        return f"已成功将鼠标从 ({x1}‰, {y1}‰) 拖拽到 ({x2}‰, {y2}‰)。[LAST_ACTION: DRAG({x1},{y1},{x2},{y2})]"
    except Exception as e:
        return f"拖拽失败：{e}"


@require_gui
async def mouse_scroll(clicks: int) -> str:
    """滚动鼠标"""
    def _scroll():
        chunk_size = 10 if abs(clicks) > 10 else abs(clicks)
        direction = 1 if clicks > 0 else -1
        remaining = abs(clicks)
        
        while remaining > 0:
            current_chunk = min(chunk_size, remaining)
            pyautogui.scroll(current_chunk * direction)
            remaining -= current_chunk
            if remaining > 0:
                time.sleep(0.01)
    
    await asyncio.to_thread(_scroll)
    direction = "向上" if clicks > 0 else "向下"
    # 滚动无法标点，仅返回状态
    return f"鼠标滚轮已{direction}滚动了 {abs(clicks)} 个单位。[LAST_ACTION: SCROLL]"


@require_gui
async def mouse_hold(button: str, duration: float) -> str:
    """长按鼠标按键"""
    if duration > 30: duration = 30
    
    def _hold_logic():
        try:
            pyautogui.mouseDown(button=button)
            time.sleep(duration)
        finally:
            pyautogui.mouseUp(button=button)
    
    await asyncio.to_thread(_hold_logic)
    return f"已成功按住鼠标 {button} 键持续 {duration} 秒。[LAST_ACTION: HOLD]"



@require_gui
async def copy_to_input_box(text: str) -> str:
    """输入文本"""
    def _type_text():
        old_clipboard = ""
        try:
            old_clipboard = pyperclip.paste()
        except Exception:
            pass
        
        sys_os = platform.system()
        
        try:
            pyperclip.copy("")
            pyperclip.copy(text)
            wait_time = 0.2 if sys_os == "Windows" else 0.15
            time.sleep(wait_time)
            
            for i in range(3):
                if pyperclip.paste() == text: break
                time.sleep(0.1)
                pyperclip.copy(text)
            
            if sys_os == "Darwin":
                with pyautogui.hold('command'): pyautogui.press('v')
            else:
                with pyautogui.hold('ctrl'): pyautogui.press('v')
            
            time.sleep(0.15)
        finally:
            time.sleep(0.05)
            for _ in range(2):
                try:
                    if old_clipboard: pyperclip.copy(old_clipboard)
                    break
                except Exception:
                    time.sleep(0.05)

    await asyncio.to_thread(_type_text)
    return f"已复制文本到输入框：'{text}'"


@require_gui
async def keyboard_press(key: str, presses: int = 1) -> str:
    """按下单个按键多次"""
    def _press_logic():
        pyautogui.press(key, presses=presses, interval=0.05)
    
    await asyncio.to_thread(_press_logic)
    return f"已按下键盘按键 '{key}' {presses} 次。"


@require_gui
async def keyboard_sequence(keys: List[str]) -> str:
    """按顺序按下多个不同的按键，中间间隔 0.5 秒"""
    if not keys:
        return "错误：未提供按键列表。"

    def _sequence_logic():
        for i, key in enumerate(keys):
            pyautogui.press(key)
            # 如果不是最后一个按键，则等待 0.5 秒
            if i < len(keys) - 1:
                time.sleep(0.5)

    await asyncio.to_thread(_sequence_logic)
    return f"已按顺序执行按键序列：{', '.join(keys)}，按键间隔 0.5 秒。"

@require_gui
async def keyboard_hotkey(keys: List[str]) -> str:
    """按下组合快捷键"""
    if not keys: return "错误：未提供按键组合"
    
    def _hotkey():
        if len(keys) == 1:
            pyautogui.press(keys[0])
        else:
            modifier = keys[0]
            rest_keys = keys[1:]
            with pyautogui.hold(modifier):
                for k in rest_keys:
                    pyautogui.press(k)
                    time.sleep(0.02)
    
    await asyncio.to_thread(_hotkey)
    return f"已触发组合键：{' + '.join(keys)}。"


@require_gui
async def keyboard_hold(keys: List[str], duration: float) -> str:
    """长按按键"""
    if duration > 30: duration = 30
    
    def _hold_logic():
        start_time = time.time()
        try:
            for key in keys:
                pyautogui.keyDown(key)
                time.sleep(0.02)
            
            elapsed = 0
            while elapsed < duration:
                sleep_time = min(0.1, duration - elapsed)
                time.sleep(sleep_time)
                elapsed = time.time() - start_time
        except Exception as e:
            print(f"按住按键时出错: {e}")
        finally:
            for key in reversed(keys):
                try:
                    pyautogui.keyUp(key)
                    time.sleep(0.02)
                except Exception:
                    pass

    await asyncio.to_thread(_hold_logic)
    return f"已成功长按组合键 {keys} 持续 {duration} 秒。"


# 注意：wait 不需要 GUI，所以【不要】加 @require_gui
async def wait(seconds: float) -> str:
    """等待一段时间，让页面或程序加载"""
    seconds = min(max(0, seconds), 60)
    await asyncio.sleep(seconds)
    return f"已等待 {seconds} 秒。"

async def screenshot() -> str:
    """获取截图"""
    await asyncio.sleep(0.3)
    return "[Getting screenshot]"


def _serialize_window_tool_result(payload) -> str:
    return json.dumps(payload, ensure_ascii=False)


async def _broadcast_window_tool_feedback(
    action_name: str,
    hwnd: int,
    *,
    result: Optional[dict] = None,
    error: Optional[str] = None,
) -> None:
    await broadcast_desktop_control_feedback(
        action_name,
        int(hwnd),
        result=result,
        error=error,
    )


async def list_windows(
    title_query: str = "",
    include_hidden: bool = False,
    include_minimized: bool = True,
    limit: int = 20,
) -> str:
    """列出当前系统中的顶层窗口。"""
    try:
        result = await asyncio.to_thread(
            core_list_windows,
            title_query=title_query,
            include_hidden=include_hidden,
            include_minimized=include_minimized,
            limit=limit,
        )
        return _serialize_window_tool_result(result)
    except DesktopWindowControlError as exc:
        return _serialize_window_tool_result({"success": False, "error": str(exc)})


async def list_monitors() -> str:
    """列出当前桌面的显示器和工作区域。"""
    try:
        result = await asyncio.to_thread(core_list_monitors)
        return _serialize_window_tool_result(result)
    except DesktopWindowControlError as exc:
        return _serialize_window_tool_result({"success": False, "error": str(exc)})


async def get_active_window() -> str:
    """Return the current foreground desktop window."""
    try:
        result = await asyncio.to_thread(core_get_active_window)
        return _serialize_window_tool_result(result)
    except DesktopWindowControlError as exc:
        return _serialize_window_tool_result({"success": False, "error": str(exc)})


async def focus_window(hwnd: int) -> str:
    """聚焦指定窗口。"""
    try:
        result = await asyncio.to_thread(core_focus_window, int(hwnd))
        await _broadcast_window_tool_feedback("focus_window", int(hwnd), result=result)
        return _serialize_window_tool_result(result)
    except DesktopWindowControlError as exc:
        await _broadcast_window_tool_feedback("focus_window", int(hwnd), error=str(exc))
        return _serialize_window_tool_result({"success": False, "error": str(exc), "hwnd": int(hwnd)})


async def minimize_window(hwnd: int) -> str:
    """最小化指定窗口。"""
    try:
        result = await asyncio.to_thread(core_minimize_window, int(hwnd))
        await _broadcast_window_tool_feedback("minimize_window", int(hwnd), result=result)
        return _serialize_window_tool_result(result)
    except DesktopWindowControlError as exc:
        await _broadcast_window_tool_feedback("minimize_window", int(hwnd), error=str(exc))
        return _serialize_window_tool_result({"success": False, "error": str(exc), "hwnd": int(hwnd)})


async def toggle_always_on_top(hwnd: int, enabled: Optional[bool] = None) -> str:
    """切换窗口置顶状态。"""
    try:
        result = await asyncio.to_thread(core_toggle_always_on_top, int(hwnd), enabled)
        await _broadcast_window_tool_feedback("toggle_always_on_top", int(hwnd), result=result)
        return _serialize_window_tool_result(result)
    except DesktopWindowControlError as exc:
        await _broadcast_window_tool_feedback("toggle_always_on_top", int(hwnd), error=str(exc))
        return _serialize_window_tool_result({"success": False, "error": str(exc), "hwnd": int(hwnd)})


async def move_window(hwnd: int, x: int, y: int) -> str:
    """移动指定窗口到新的像素坐标。"""
    try:
        result = await asyncio.to_thread(core_move_window, int(hwnd), int(x), int(y))
        await _broadcast_window_tool_feedback("move_window", int(hwnd), result=result)
        return _serialize_window_tool_result(result)
    except DesktopWindowControlError as exc:
        await _broadcast_window_tool_feedback("move_window", int(hwnd), error=str(exc))
        return _serialize_window_tool_result({"success": False, "error": str(exc), "hwnd": int(hwnd)})


async def resize_window(hwnd: int, width: int, height: int) -> str:
    """调整指定窗口大小。"""
    try:
        result = await asyncio.to_thread(core_resize_window, int(hwnd), int(width), int(height))
        await _broadcast_window_tool_feedback("resize_window", int(hwnd), result=result)
        return _serialize_window_tool_result(result)
    except DesktopWindowControlError as exc:
        await _broadcast_window_tool_feedback("resize_window", int(hwnd), error=str(exc))
        return _serialize_window_tool_result({"success": False, "error": str(exc), "hwnd": int(hwnd)})


async def snap_window(
    hwnd: int,
    position: str,
    monitor_index: Optional[int] = None,
    use_work_area: bool = True,
) -> str:
    """将窗口贴靠到指定显示器的预设区域。"""
    try:
        result = await asyncio.to_thread(
            core_snap_window,
            int(hwnd),
            str(position),
            monitor_index=None if monitor_index is None else int(monitor_index),
            use_work_area=bool(use_work_area),
        )
        await _broadcast_window_tool_feedback("snap_window", int(hwnd), result=result)
        return _serialize_window_tool_result(result)
    except DesktopWindowControlError as exc:
        await _broadcast_window_tool_feedback("snap_window", int(hwnd), error=str(exc))
        return _serialize_window_tool_result({"success": False, "error": str(exc), "hwnd": int(hwnd)})

# ================= 对应的 OpenAI 工具 Schema 定义 =================

mouse_move_tool = {
    "type": "function",
    "function": {
        "name": "mouse_move",
        "description": "将鼠标移动到屏幕上的指定位置。坐标使用千分比表示（0到1000）。(0,0)是屏幕左上角，(1000,1000)是右下角，(500,500)是屏幕正中心。",
        "parameters": {
            "type": "object",
            "properties": {
                "x": {"type": "number", "description": "目标水平坐标(X轴)，范围 0 到 1000 的千分比。例如 500 表示宽度正中间","maximum": 1000, "minimum": 0},
                "y": {"type": "number", "description": "目标垂直坐标(Y轴)，范围 0 到 1000 的千分比。例如 500 表示高度正中间","maximum": 1000, "minimum": 0},
                "duration": {"type": "number", "description": "移动耗时（秒），默认为0.5秒。为了拟真，建议不要设为0", "default": 0.5}
            },
            "required": ["x", "y"]
        }
    }
}

mouse_click_tool = {
    "type": "function",
    "function": {
        "name": "mouse_click",
        "description": "点击鼠标。如果传入千分比坐标，则会先移动到该位置再点击；如果不传坐标则在当前位置点击。",
        "parameters": {
            "type": "object",
            "properties": {
                "button": {"type": "string", "enum": ["left", "right", "middle"], "description": "点击的按键，左键/右键/中键"},
                "clicks": {"type": "integer", "description": "点击次数。1为单击，2为双击，当你需要打开链接或文件时，建议使用双击。如果单击某个图标没有任何反应，也要优先考虑双击。", "default": 1},
                "x": {"type": "number", "description": "点击前的目标水平坐标（0 到 1000 的千分比），可选","maximum": 1000, "minimum": 0},
                "y": {"type": "number", "description": "点击前的目标垂直坐标（0 到 1000 的千分比），可选","maximum": 1000, "minimum": 0}
            },
            "required": ["button"]
        }
    }
}

mouse_double_click_tool = {
    "type": "function",
    "function": {
        "name": "mouse_double_click",
        "description": "双击鼠标以快速打开链接、文件、应用等。如果传入千分比坐标，则会先移动到该位置再点击；如果不传坐标则在当前位置点击。",
        "parameters": {
            "type": "object",
            "properties": {
                "button": {"type": "string", "enum": ["left", "right", "middle"], "description": "点击的按键，左键/右键/中键"},
                "x": {"type": "number", "description": "点击前的目标水平坐标（0 到 1000 的千分比），可选","maximum": 1000, "minimum": 0},
                "y": {"type": "number", "description": "点击前的目标垂直坐标（0 到 1000 的千分比），可选","maximum": 1000, "minimum": 0}
            },
            "required": ["button"]
        }
    }
}

mouse_drag_tool = {
    "type": "function",
    "function": {
        "name": "mouse_drag",
        "description": "按下鼠标按键从起始坐标拖动到终点坐标。常用于拖动窗口、滑块、移动文件或框选一段区域。",
        "parameters": {
            "type": "object",
            "properties": {
                "x1": {"type": "number", "description": "起始点水平坐标 (0-1000)","maximum": 1000, "minimum": 0},
                "y1": {"type": "number", "description": "起始点垂直坐标 (0-1000)","maximum": 1000, "minimum": 0},
                "x2": {"type": "number", "description": "终点水平坐标 (0-1000)","maximum": 1000, "minimum": 0},
                "y2": {"type": "number", "description": "终点垂直坐标 (0-1000)","maximum": 1000, "minimum": 0},
                "duration": {"type": "number", "description": "拖拽过程耗时（秒），默认为 1.0 秒", "default": 1.0},
                "button": {"type": "string", "enum": ["left", "right"], "description": "按住哪个键拖拽，默认左键", "default": "left"}
            },
            "required": ["x1", "y1", "x2", "y2"]
        }
    }
}

mouse_hold_tool = {
    "type": "function",
    "function": {
        "name": "mouse_hold",
        "description": "长按鼠标某个按键一段时间。适用于游戏中的蓄力、持续开火或某些 UI 的长按菜单。",
        "parameters": {
            "type": "object",
            "properties": {
                "button": {
                    "type": "string", 
                    "enum": ["left", "right", "middle"],
                    "description": "要按住的鼠标按键。"
                },
                "duration": {
                    "type": "number", 
                    "description": "按住的时长（秒）。"
                }
            },
            "required": ["button", "duration"]
        }
    }
}


mouse_scroll_tool = {
    "type": "function",
    "function": {
        "name": "mouse_scroll",
        "description": "滚动鼠标滚轮以浏览网页或文档。正数表示向上滚动，负数表示向下滚动。",
        "parameters": {
            "type": "object",
            "properties": {
                "clicks": {"type": "integer", "description": "滚动单位。大于0为向上滚，小于0为向下滚。如 500 或 -500。一般网页滚动一次可以尝试 300 到 800 的数值。"}
            },
            "required": ["clicks"]
        }
    }
}

keyboard_type_tool = {
    "type": "function",
    "function": {
        "name": "copy_to_input_box",
        "description": "在当前焦点输入框中复制你给的一段文本。支持输入中文和英文字符。注意：调用前请确保已经点击了正确的输入框使之获得了焦点！这个输入只是复制粘贴，与键盘控制无关，不是真的按键交互",
        "parameters": {
            "type": "object",
            "properties": {
                "text": {"type": "string", "description": "需要输入的具体文本内容"}
            },
            "required": ["text"]
        }
    }
}

keyboard_press_tool = {
    "type": "function",
    "function": {
        "name": "keyboard_press",
        "description": "按下单个按键。适用于需要连续按下同一个键的情况，例如删除多个字符或连续下移。",
        "parameters": {
            "type": "object",
            "properties": {
                "key": {
                    "type": "string", 
                    "description": "按键名称，例如: 'enter', 'backspace', 'tab', 'down', 'esc'。"
                },
                "presses": {
                    "type": "integer", 
                    "description": "按下该按键的次数，默认为 1。", 
                    "default": 1
                }
            },
            "required": ["key"]
        }
    }
}

keyboard_sequence_tool = {
    "type": "function",
    "function": {
        "name": "keyboard_sequence",
        "description": "按顺序按下多个不同的按键。程序会在每个按键之间自动停顿 0.5 秒。适用于流程化的按键操作，例如 '先按 Tab 切换焦点，再按 Enter 确认'。",
        "parameters": {
            "type": "object",
            "properties": {
                "keys": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "按键名称的列表。例如 ['tab', 'enter'] 或 ['up', 'up', 'space']。"
                }
            },
            "required": ["keys"]
        }
    }
}

keyboard_hotkey_tool = {
    "type": "function",
    "function": {
        "name": "keyboard_hotkey",
        "description": "按下键盘组合快捷键。例如复制是['ctrl', 'c']，切换窗口是['alt', 'tab']。如果是mac系统请使用'command'代替'ctrl'。",
        "parameters": {
            "type": "object",
            "properties": {
                "keys": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "快捷键组合数组，必须按照按下的先后顺序排列。例如: ['ctrl', 'shift', 'esc']"
                }
            },
            "required": ["keys"]
        }
    }
}

keyboard_hold_tool = {
    "type": "function",
    "function": {
        "name": "keyboard_hold",
        "description": "长按键盘上的一个或多个按键一段时间。这对于控制游戏角色移动或执行需要按住的操作非常有用。",
        "parameters": {
            "type": "object",
            "properties": {
                "keys": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "需要按住的按键列表。例如 ['w'] 或 ['w', 'shift']。"
                },
                "duration": {
                    "type": "number", 
                    "description": "按住的时长（秒）。"
                }
            },
            "required": ["keys", "duration"]
        }
    }
}


wait_tool = {
    "type": "function",
    "function": {
        "name": "wait",
        "description": "让操作暂停并等待一段时间。在点击了加载页面的链接、启动软件、或者输入内容后，必须调用此工具等待 UI 刷新完成，否则下一步操作可能会因为找不到目标而失败。",
        "parameters": {
            "type": "object",
            "properties": {
                "seconds": {"type": "number", "description": "需要等待的秒数，如 1, 2.5, 5等。如果网速慢或程序加载慢，请适当延长。"}
            },
            "required": ["seconds"]
        }
    }
}
screenshot_tool = {
    "type": "function",
    "function": {
        "name": "screenshot",
        "description": "截取带有千分比辅助网格的当前桌面的图像"
    }
}

list_windows_tool = {
    "type": "function",
    "function": {
        "name": "list_windows",
        "description": "列出当前桌面中可交互的顶层窗口，返回窗口标题、句柄、位置、大小、最小化和置顶状态。",
        "parameters": {
            "type": "object",
            "properties": {
                "title_query": {
                    "type": "string",
                    "description": "可选，按窗口标题模糊过滤。"
                },
                "include_hidden": {
                    "type": "boolean",
                    "description": "是否包含隐藏窗口。",
                    "default": False
                },
                "include_minimized": {
                    "type": "boolean",
                    "description": "是否包含已最小化窗口。",
                    "default": True
                },
                "limit": {
                    "type": "integer",
                    "description": "最多返回多少个窗口，默认 20。",
                    "default": 20
                }
            }
        }
    }
}

list_monitors_tool = {
    "type": "function",
    "function": {
        "name": "list_monitors",
        "description": "列出当前桌面中的显示器、主屏标记、整体边界与工作区域，用于多屏布局和窗口贴靠。",
        "parameters": {
            "type": "object",
            "properties": {}
        }
    }
}

get_active_window_tool = {
    "type": "function",
    "function": {
        "name": "get_active_window",
        "description": "Return the current foreground desktop window with process name, handle, and geometry metadata.",
        "parameters": {
            "type": "object",
            "properties": {}
        }
    }
}

focus_window_tool = {
    "type": "function",
    "function": {
        "name": "focus_window",
        "description": "恢复并聚焦指定窗口。适合让应用回到前台。",
        "parameters": {
            "type": "object",
            "properties": {
                "hwnd": {
                    "type": "integer",
                    "description": "目标窗口句柄（来自 list_windows 返回结果）。"
                }
            },
            "required": ["hwnd"]
        }
    }
}

minimize_window_tool = {
    "type": "function",
    "function": {
        "name": "minimize_window",
        "description": "最小化指定窗口。",
        "parameters": {
            "type": "object",
            "properties": {
                "hwnd": {
                    "type": "integer",
                    "description": "目标窗口句柄（来自 list_windows 返回结果）。"
                }
            },
            "required": ["hwnd"]
        }
    }
}

toggle_always_on_top_tool = {
    "type": "function",
    "function": {
        "name": "toggle_always_on_top",
        "description": "切换窗口置顶状态。enabled 不传时表示在当前状态基础上切换。",
        "parameters": {
            "type": "object",
            "properties": {
                "hwnd": {
                    "type": "integer",
                    "description": "目标窗口句柄（来自 list_windows 返回结果）。"
                },
                "enabled": {
                    "type": "boolean",
                    "description": "可选，显式指定是否置顶。"
                }
            },
            "required": ["hwnd"]
        }
    }
}

move_window_tool = {
    "type": "function",
    "function": {
        "name": "move_window",
        "description": "将指定窗口移动到新的屏幕像素坐标。",
        "parameters": {
            "type": "object",
            "properties": {
                "hwnd": {
                    "type": "integer",
                    "description": "目标窗口句柄（来自 list_windows 返回结果）。"
                },
                "x": {
                    "type": "integer",
                    "description": "目标左侧像素坐标。"
                },
                "y": {
                    "type": "integer",
                    "description": "目标顶部像素坐标。"
                }
            },
            "required": ["hwnd", "x", "y"]
        }
    }
}

resize_window_tool = {
    "type": "function",
    "function": {
        "name": "resize_window",
        "description": "调整指定窗口尺寸。",
        "parameters": {
            "type": "object",
            "properties": {
                "hwnd": {
                    "type": "integer",
                    "description": "目标窗口句柄（来自 list_windows 返回结果）。"
                },
                "width": {
                    "type": "integer",
                    "description": "目标宽度（像素）。"
                },
                "height": {
                    "type": "integer",
                    "description": "目标高度（像素）。"
                }
            },
            "required": ["hwnd", "width", "height"]
        }
    }
}

snap_window_tool = {
    "type": "function",
    "function": {
        "name": "snap_window",
        "description": "将指定窗口贴靠到指定显示器的预设布局，如左半屏、右半屏、居中、左上角或最大化。",
        "parameters": {
            "type": "object",
            "properties": {
                "hwnd": {
                    "type": "integer",
                    "description": "目标窗口句柄（来自 list_windows 返回结果）。"
                },
                "position": {
                    "type": "string",
                    "description": "布局预设，例如 left、right、top_left、bottom_right、center、maximize、left_third、center_third、right_third。"
                },
                "monitor_index": {
                    "type": "integer",
                    "description": "可选，目标显示器索引，来自 list_monitors 返回结果。"
                },
                "use_work_area": {
                    "type": "boolean",
                    "description": "是否优先使用工作区域（避开任务栏），默认 true。",
                    "default": True
                }
            },
            "required": ["hwnd", "position"]
        }
    }
}

# 导出所有工具到列表，方便主程序统一挂载
computer_use_tools = [
    wait_tool,
    list_windows_tool,
    list_monitors_tool,
    get_active_window_tool,
    focus_window_tool,
    minimize_window_tool,
    toggle_always_on_top_tool,
    move_window_tool,
    resize_window_tool,
    snap_window_tool,
]

desktopVision_use_tools = [
    screenshot_tool
]

mouse_use_tools = [
    mouse_move_tool,
    mouse_click_tool,
    mouse_double_click_tool,
    mouse_drag_tool,
    mouse_scroll_tool,
    mouse_hold_tool,
]

keyboard_use_tools = [
    keyboard_type_tool,
    keyboard_press_tool,
    keyboard_sequence_tool,
    keyboard_hotkey_tool,
    keyboard_hold_tool,
]
