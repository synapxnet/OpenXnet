#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Server/Browser 直播 HTTP 与 WebSocket 兼容路由。"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from py.live_runtime import LiveConfig, LiveOperationResult, LiveRuntimeController


router = APIRouter(prefix="/api/live", tags=["live"])
ws_router = APIRouter(prefix="/ws/live", tags=["live"])


class LiveConfigRequest(BaseModel):
    """保存 Browser/Server 兼容路由提交的直播配置。"""

    config: LiveConfig


class ApiResponse(BaseModel):
    """保留旧 HTTP 路由使用的成功标志和固定消息。"""

    success: bool
    message: str


class ConnectionManager:
    """管理 Browser/Server 直播 WebSocket 连接。"""

    def __init__(self) -> None:
        """初始化空连接集合；无输入和返回值，不打开网络连接。"""

        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        """接受并保存 WebSocket；输入连接，无返回，握手失败时向上抛出异常。"""

        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        """移除指定连接；输入连接，无返回，不存在时静默结束。"""

        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, data: Mapping[str, Any]) -> None:
        """广播规范事件并清理失败连接；输入事件，无返回，单连接失败不影响其余连接。"""

        disconnected: list[WebSocket] = []
        for connection in self.active_connections:
            try:
                await connection.send_json(dict(data))
            except Exception:
                disconnected.append(connection)
        for connection in disconnected:
            self.disconnect(connection)


manager = ConnectionManager()
runtime = LiveRuntimeController(manager.broadcast)


def _to_api_response(result: LiveOperationResult) -> ApiResponse:
    """转换控制器结果为旧路由响应；输入安全结果，返回兼容模型，无副作用。"""

    return ApiResponse(success=result.success, message=result.message)


@router.post("/start", response_model=ApiResponse)
async def start_live(request: LiveConfigRequest) -> ApiResponse:
    """启动 Server 直播监听；输入嵌套配置，返回固定结果，凭据由进程环境注入。"""

    return _to_api_response(await runtime.start(request.config.model_dump()))


@router.post("/stop", response_model=ApiResponse)
async def stop_live() -> ApiResponse:
    """停止 Server 直播监听；无输入，返回固定结果，清理失败不泄漏供应商诊断。"""

    return _to_api_response(await runtime.stop())


@router.post("/reload", response_model=ApiResponse)
async def reload_live(request: LiveConfigRequest) -> ApiResponse:
    """重载 Server 直播监听；输入嵌套配置，返回固定结果，失败时保持安全停止状态。"""

    return _to_api_response(await runtime.reload(request.config.model_dump()))


@router.get("/status")
async def get_live_status() -> dict[str, Any]:
    """返回 Server 直播状态；无输入和副作用，不启动传输或返回凭据。"""

    return runtime.status().model_dump(exclude={"success", "message"})


@ws_router.websocket("/danmu")
async def websocket_endpoint(websocket: WebSocket) -> None:
    """维持 Browser/Server 事件连接；输入 WebSocket，无返回，断开时移除连接。"""

    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket)


__all__ = ["router", "ws_router"]
