#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
Desktop control FastAPI routes for shell window management.

Author: OpenAI Codex
Department: R&D
Date: 2026-04-17
Version: 1.5.0
Security Level: INTERNAL
"""

__version__ = "1.5.0"
__author__ = "OpenAI Codex"
__copyright__ = "Copyright 2026 Synapxnet"
__maintainer__ = "OpenAI Codex"
__email__ = "synapxnet@gmail.com"

# Modification History:
# 2026-04-17, v1.0.0, OpenAI Codex: Initial creation.
# 2026-04-17, v1.3.0, OpenAI Codex: Added active-window sensing route for desktop follow workflows.
# 2026-04-17, v1.4.0, OpenAI Codex: Added move-to-monitor route for selected-display workflows.
# 2026-04-17, v1.5.0, OpenAI Codex: Added previous/next monitor routes for multi-display workflows.

from typing import Any, Callable, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from py.desktop_control_feedback import (
    broadcast_desktop_control_feedback,
    list_desktop_control_feedback,
)
from py.desktop_window_control import (
    DesktopWindowControlError,
    focus_window,
    get_active_window,
    list_monitors,
    list_windows,
    minimize_window,
    move_window,
    move_to_monitor,
    move_to_adjacent_monitor,
    resize_window,
    snap_window,
    toggle_always_on_top,
)

router = APIRouter(tags=["desktop-control"])


class TopMostPayload(BaseModel):
    enabled: Optional[bool] = Field(default=None, description="Optional explicit top-most state.")


class MoveWindowPayload(BaseModel):
    x: int = Field(..., description="Left coordinate in screen pixels.")
    y: int = Field(..., description="Top coordinate in screen pixels.")


class ResizeWindowPayload(BaseModel):
    width: int = Field(..., description="Target width in pixels.")
    height: int = Field(..., description="Target height in pixels.")


class SnapWindowPayload(BaseModel):
    position: str = Field(..., description="Snap preset such as left, right, center, maximize, or corners.")
    monitor_index: Optional[int] = Field(default=None, description="Optional target monitor index.")
    use_work_area: bool = Field(default=True, description="Prefer monitor work area instead of full bounds.")


class MoveToMonitorPayload(BaseModel):
    monitor_index: int = Field(..., description="Target monitor index.")
    use_work_area: bool = Field(default=True, description="Prefer monitor work area instead of full bounds.")


class MoveAdjacentMonitorPayload(BaseModel):
    use_work_area: bool = Field(default=True, description="Prefer monitor work area instead of full bounds.")


def _wrap_desktop_error(exc: DesktopWindowControlError) -> HTTPException:
    return HTTPException(status_code=400, detail=str(exc))


async def _run_desktop_action(
    action_name: str,
    hwnd: int,
    handler: Callable[[], dict[str, Any]],
) -> dict[str, Any]:
    try:
        result = handler()
    except DesktopWindowControlError as exc:
        await broadcast_desktop_control_feedback(action_name, hwnd, error=str(exc))
        raise _wrap_desktop_error(exc) from exc

    await broadcast_desktop_control_feedback(action_name, hwnd, result=result)
    return result


@router.get("/api/desktop/windows")
async def list_desktop_windows(
    title_query: str = Query(default="", description="Optional case-insensitive window title filter."),
    include_hidden: bool = Query(default=False),
    include_minimized: bool = Query(default=True),
    limit: int = Query(default=20, ge=1, le=100),
):
    try:
        return list_windows(
            title_query=title_query,
            include_hidden=include_hidden,
            include_minimized=include_minimized,
            limit=limit,
        )
    except DesktopWindowControlError as exc:
        raise _wrap_desktop_error(exc) from exc


@router.get("/api/desktop/monitors")
async def list_desktop_monitors():
    try:
        return list_monitors()
    except DesktopWindowControlError as exc:
        raise _wrap_desktop_error(exc) from exc


@router.get("/api/desktop/active-window")
async def get_desktop_active_window():
    try:
        return get_active_window()
    except DesktopWindowControlError as exc:
        raise _wrap_desktop_error(exc) from exc


@router.get("/api/desktop/control-history")
async def list_desktop_control_history(
    limit: int = Query(default=8, ge=1, le=40),
):
    return list_desktop_control_feedback(limit=limit)


@router.post("/api/desktop/windows/{hwnd}/focus")
async def focus_desktop_window(hwnd: int):
    return await _run_desktop_action("focus_window", hwnd, lambda: focus_window(hwnd))


@router.post("/api/desktop/windows/{hwnd}/minimize")
async def minimize_desktop_window(hwnd: int):
    return await _run_desktop_action("minimize_window", hwnd, lambda: minimize_window(hwnd))


@router.post("/api/desktop/windows/{hwnd}/always-on-top")
async def update_desktop_window_top_most(hwnd: int, payload: TopMostPayload):
    return await _run_desktop_action(
        "toggle_always_on_top",
        hwnd,
        lambda: toggle_always_on_top(hwnd, enabled=payload.enabled),
    )


@router.post("/api/desktop/windows/{hwnd}/move")
async def move_desktop_window(hwnd: int, payload: MoveWindowPayload):
    return await _run_desktop_action(
        "move_window",
        hwnd,
        lambda: move_window(hwnd, payload.x, payload.y),
    )


@router.post("/api/desktop/windows/{hwnd}/resize")
async def resize_desktop_window(hwnd: int, payload: ResizeWindowPayload):
    return await _run_desktop_action(
        "resize_window",
        hwnd,
        lambda: resize_window(hwnd, payload.width, payload.height),
    )


@router.post("/api/desktop/windows/{hwnd}/snap")
async def snap_desktop_window(hwnd: int, payload: SnapWindowPayload):
    return await _run_desktop_action(
        "snap_window",
        hwnd,
        lambda: snap_window(
            hwnd,
            payload.position,
            monitor_index=payload.monitor_index,
            use_work_area=payload.use_work_area,
        ),
    )


@router.post("/api/desktop/windows/{hwnd}/move-to-monitor")
async def move_desktop_window_to_monitor(hwnd: int, payload: MoveToMonitorPayload):
    return await _run_desktop_action(
        "move_to_monitor",
        hwnd,
        lambda: move_to_monitor(
            hwnd,
            payload.monitor_index,
            use_work_area=payload.use_work_area,
        ),
    )


@router.post("/api/desktop/windows/{hwnd}/move-to-previous-monitor")
async def move_desktop_window_to_previous_monitor(hwnd: int, payload: MoveAdjacentMonitorPayload):
    return await _run_desktop_action(
        "move_to_previous_monitor",
        hwnd,
        lambda: move_to_adjacent_monitor(
            hwnd,
            "previous",
            use_work_area=payload.use_work_area,
        ),
    )


@router.post("/api/desktop/windows/{hwnd}/move-to-next-monitor")
async def move_desktop_window_to_next_monitor(hwnd: int, payload: MoveAdjacentMonitorPayload):
    return await _run_desktop_action(
        "move_to_next_monitor",
        hwnd,
        lambda: move_to_adjacent_monitor(
            hwnd,
            "next",
            use_work_area=payload.use_work_area,
        ),
    )
