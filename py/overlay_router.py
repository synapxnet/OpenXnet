#!/usr/bin/env python3
# -*- coding: utf-8 -*-
#
# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.
#

"""
Overlay Router - Desktop overlay transport and page routes.

Provides a shared websocket transport for desktop overlay surfaces and exposes
static overlay pages for subtitle, danmaku, dynamic-island, and floating HUD
style delivery.

Author: maoyo
Department: 研发部
Date: 2026-04-17
Version: 1.1.0
Security Level: INTERNAL
"""

__version__ = "1.4.0"
__author__ = "maoyo"
__copyright__ = "Copyright 2026 Synapxnet"
__maintainer__ = "maoyo"
__email__ = "synapxnet@gmail.com"

import asyncio
import json
import os
import sys
from datetime import datetime
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse


def get_base_path() -> str:
    if getattr(sys, "frozen", False):
        return sys._MEIPASS
    return os.path.abspath(".")


base_path = get_base_path()
static_dir = os.path.abspath(
    os.getenv("OPENXNET_STATIC_DIR") or os.path.join(base_path, "static")
)
router = APIRouter()


class DanmakuOverlayManager:
    """Keeps track of overlay websocket subscribers and broadcasts events."""

    def __init__(self) -> None:
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict[str, Any]) -> None:
        for connection in list(self.active_connections):
            try:
                await connection.send_text(json.dumps(message))
            except Exception:
                self.disconnect(connection)


overlay_manager = DanmakuOverlayManager()


def _overlay_file_response(filename: str, error_message: str) -> FileResponse | JSONResponse:
    file_path = os.path.join(static_dir, filename)
    if not os.path.exists(file_path):
        return JSONResponse({"error": error_message}, status_code=404)
    return FileResponse(
        file_path,
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )


def _normalize_task_delivery_payload(data: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    payload = data.get("data") if isinstance(data.get("data"), dict) else dict(data or {})
    channel = str(
        data.get("channel") or payload.get("target") or payload.get("channel") or "dynamic_island"
    ).strip().lower() or "dynamic_island"

    payload["kind"] = str(payload.get("kind") or "task_delivery").strip() or "task_delivery"
    payload["delivery_kind"] = "task_delivery"
    payload["target"] = channel
    payload["title"] = str(payload.get("title") or "OpenXnet Task Delivery").strip() or "OpenXnet Task Delivery"
    payload["status"] = str(payload.get("status") or "completed").strip() or "completed"
    payload["summary"] = str(payload.get("summary") or "Task finished with no summary.").strip() or "Task finished with no summary."
    payload["timestamp"] = str(payload.get("timestamp") or datetime.now().isoformat()).strip()
    payload["presentation"] = (
        str(payload.get("presentation") or "").strip()
        or ("dynamic_island" if channel == "dynamic_island" else "desktop_notification")
    )
    payload["schedule_type"] = str(payload.get("schedule_type") or "").strip()
    payload["task_id"] = str(payload.get("task_id") or "").strip()

    return channel, payload


def _normalize_observation_overlay_payload(data: dict[str, Any]) -> dict[str, Any]:
    payload = data.get("data") if isinstance(data.get("data"), dict) else dict(data or {})
    observations = [
        dict(item)
        for item in list(payload.get("observations") or [])
        if isinstance(item, dict)
    ]
    latest = observations[0] if observations else {}

    task_id = str(payload.get("task_id") or latest.get("task_id") or "").strip()
    session_id = str(payload.get("session_id") or latest.get("session_id") or "").strip()
    digest = str(payload.get("digest") or latest.get("digest") or "").strip()
    title = str(
        payload.get("title")
        or payload.get("task_title")
        or latest.get("task_title")
        or latest.get("title")
        or (f"Task {task_id}" if task_id else "Observation Flow")
    ).strip()
    summary = str(
        payload.get("summary")
        or latest.get("summary")
        or "Observation flow updated."
    ).strip() or "Observation flow updated."
    detail = str(payload.get("detail") or latest.get("detail") or "").strip()
    status = str(payload.get("status") or latest.get("status") or "").strip()
    stage = str(payload.get("stage") or latest.get("stage") or "").strip()
    event_type = str(payload.get("event_type") or latest.get("event_type") or "").strip()
    source = str(
        payload.get("source")
        or payload.get("focus_source")
        or payload.get("target")
        or payload.get("channel")
        or latest.get("source")
        or "memory_observation"
    ).strip() or "memory_observation"
    origin_route = str(
        payload.get("target")
        or payload.get("channel")
        or payload.get("focus_source")
        or payload.get("source")
        or source
    ).strip() or source
    timestamp = str(payload.get("timestamp") or latest.get("timestamp") or datetime.now().isoformat()).strip()
    focus_source = str(payload.get("focus_source") or source).strip() or source

    try:
        observation_count = int(payload.get("observation_count", len(observations)) or 0)
    except (TypeError, ValueError):
        observation_count = len(observations)

    try:
        private_segment_count = int(
            payload.get("private_segment_count", latest.get("private_segment_count", 0)) or 0
        )
    except (TypeError, ValueError):
        private_segment_count = 0

    return {
        "task_id": task_id,
        "session_id": session_id,
        "digest": digest,
        "title": title,
        "task_title": str(payload.get("task_title") or title).strip() or title,
        "summary": summary,
        "detail": detail,
        "status": status,
        "stage": stage,
        "event_type": event_type,
        "target": origin_route,
        "channel": origin_route,
        "source": source,
        "focus_source": focus_source,
        "timestamp": timestamp,
        "observation_count": max(0, observation_count),
        "privacy_mode": str(payload.get("privacy_mode") or latest.get("privacy_mode") or "public").strip() or "public",
        "private_segment_count": max(0, private_segment_count),
        "observations": observations,
        "clear": bool(payload.get("clear")),
    }


async def broadcast_task_delivery_event(
    data: dict[str, Any],
    *,
    channel: str | None = None,
) -> tuple[str, dict[str, Any]]:
    payload_source = dict(data or {})
    if channel:
        payload_source["channel"] = channel

    channel_name, payload = _normalize_task_delivery_payload(payload_source)
    await overlay_manager.broadcast(
        {
            "action": "task_delivery",
            "channel": channel_name,
            "data": payload,
        }
    )
    return channel_name, payload


async def broadcast_observation_event(
    data: dict[str, Any],
    *,
    action: str = "observation_update",
) -> dict[str, Any]:
    payload = _normalize_observation_overlay_payload(data)
    normalized_action = str(action or "observation_update").strip().lower() or "observation_update"
    await overlay_manager.broadcast(
        {
            "action": normalized_action,
            "data": payload,
        }
    )
    return payload


def queue_observation_event(
    data: dict[str, Any],
    *,
    action: str = "observation_update",
) -> bool:
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return False
    loop.create_task(broadcast_observation_event(data, action=action))
    notify_main_window_event(action, data)
    return True


def notify_main_window_event(event_type: str, data: dict) -> bool:
    """Push an event to the SSE bus for main-window subscribers."""
    try:
        from py.routes.events import memory_event_bus
        loop = asyncio.get_running_loop()
        loop.create_task(memory_event_bus.publish(event_type, data))
        return True
    except Exception:
        return False


@router.websocket("/ws/overlay")
async def websocket_overlay_endpoint(websocket: WebSocket):
    await overlay_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        overlay_manager.disconnect(websocket)


@router.post("/api/overlay/danmaku")
async def show_danmaku_overlay(data: dict[str, Any]):
    await overlay_manager.broadcast({"action": "show", "data": data})
    return {"status": "ok"}


@router.post("/api/overlay/danmaku/clear")
async def clear_danmaku_overlay():
    await overlay_manager.broadcast({"action": "clear"})
    return {"status": "ok"}


@router.post("/api/overlay/task-delivery")
async def show_task_delivery_overlay(data: dict[str, Any]):
    channel, payload = await broadcast_task_delivery_event(data)
    return {"status": "ok", "channel": channel}


@router.post("/api/overlay/observation-update")
async def show_observation_update_overlay(data: dict[str, Any]):
    payload = await broadcast_observation_event(data, action="observation_update")
    return {"status": "ok", "action": "observation_update", "task_id": payload.get("task_id", "")}


@router.post("/api/overlay/observation-focus")
async def show_observation_focus_overlay(data: dict[str, Any]):
    payload = await broadcast_observation_event(data, action="observation_focus")
    return {
        "status": "ok",
        "action": "observation_focus",
        "task_id": payload.get("task_id", ""),
        "clear": bool(payload.get("clear")),
    }


@router.get("/subtitle_overlay")
async def get_subtitle_overlay():
    return _overlay_file_response("subtitle_overlay.html", "Subtitle overlay file not found")


@router.get("/danmaku_overlay")
async def get_danmaku_overlay():
    return _overlay_file_response("danmaku_overlay.html", "Overlay file not found")


@router.get("/dynamic_island")
async def get_dynamic_island_overlay():
    return _overlay_file_response("dynamic_island.html", "Dynamic island file not found")


@router.get("/floating_task_hud")
async def get_floating_task_hud_overlay():
    return _overlay_file_response("floating_task_hud.html", "Floating task HUD file not found")
