# -*- coding: utf-8 -*-
"""验证 Live Runtime 控制器和 Worker 请求边界。"""

from __future__ import annotations

from collections.abc import Mapping
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, patch
from typing import Any

from py.live_runtime import LiveOperationResult, LiveRuntimeController, normalize_live_event
from py.workers.live_worker import LiveWorkerHandlers


class FakeYouTubeClient:
    """记录 YouTube 配置和回调且不创建线程。"""

    def __init__(self, api_key: str, video_id: str, on_message: Any) -> None:
        """保存输入；不返回值，不访问网络。"""

        self.api_key = api_key
        self.video_id = video_id
        self.on_message = on_message
        self.started = False
        self.stopped = False

    def start(self) -> None:
        """标记启动；无输入和返回值，不创建线程。"""

        self.started = True

    def stop(self) -> None:
        """标记停止；无输入和返回值，不访问网络。"""

        self.stopped = True


class FakeController:
    """记录 Worker 生命周期调用的控制器替身。"""

    def __init__(self) -> None:
        """初始化空调用列表；无输入和返回值。"""

        self.calls: list[tuple[str, Mapping[str, Any] | None]] = []

    def status(self) -> LiveOperationResult:
        """返回停止状态；无输入和副作用。"""

        return LiveOperationResult(success=True, message="stopped", is_running=False)

    async def start(self, configuration: Mapping[str, Any]) -> LiveOperationResult:
        """记录启动配置并返回运行状态；输入配置，返回安全结果。"""

        self.calls.append(("start", configuration))
        return LiveOperationResult(
            success=True,
            message="started",
            is_running=True,
            details={"youtube": True},
        )

    async def stop(self) -> LiveOperationResult:
        """记录停止并返回停止状态；无输入。"""

        self.calls.append(("stop", None))
        return self.status()

    async def reload(self, configuration: Mapping[str, Any]) -> LiveOperationResult:
        """记录重载配置并返回运行状态；输入配置，返回安全结果。"""

        self.calls.append(("reload", configuration))
        return await self.start(configuration)


class LiveRuntimeControllerTests(unittest.IsolatedAsyncioTestCase):
    """验证控制器生命周期、事件和失败清理。"""

    async def test_youtube_start_event_and_stop(self) -> None:
        """确认 YouTube 配置启动、跨回调事件交付和停止均不访问真实网络。"""

        events: list[Mapping[str, Any]] = []
        controller = LiveRuntimeController(lambda event: events.append(event))
        with (
            patch("py.live_runtime.YouTubeDMClient", FakeYouTubeClient),
            patch("py.live_runtime.asyncio.sleep", new=AsyncMock()),
            patch("py.live_runtime.hydrate_live_platform_config", side_effect=lambda value: dict(value)),
        ):
            result = await controller.start({
                "youtube_enabled": True,
                "youtube_video_id": "video-id",
                "youtube_api_key": "youtube-secret",
            })
            youtube_client = controller._youtube_client
            assert youtube_client is not None
            youtube_client.on_message({
                "type": "message",
                "content": "用户说：你好",
                "danmu_type": "danmaku",
                "platform": "youtube",
            })
            await asyncio_sleep_zero()
            stopped = await controller.stop()

        self.assertTrue(result.success)
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["platform"], "youtube")
        self.assertFalse(stopped.is_running)
        self.assertTrue(youtube_client.stopped)

    def test_event_normalization_rejects_unknown_platform_and_oversize(self) -> None:
        """确认事件标准化拒绝未知平台和超限内容。"""

        with self.assertRaises(ValueError):
            normalize_live_event({"type": "message", "content": "x", "platform": "unknown"})
        with self.assertRaises(ValueError):
            normalize_live_event({
                "type": "message",
                "content": "x" * (16 * 1024 + 1),
                "platform": "youtube",
            })


async def asyncio_sleep_zero() -> None:
    """让出一次事件循环以执行已调度发布任务；无输入和返回值。"""

    import asyncio

    await asyncio.sleep(0)


class LiveWorkerHandlerTests(unittest.IsolatedAsyncioTestCase):
    """验证 Worker 配置预算和生命周期委托。"""

    async def test_lifecycle_uses_exact_configuration_wrapper(self) -> None:
        """确认启动、重载和停止只转发 configuration 字段并返回安全映射。"""

        controller = FakeController()
        handlers = LiveWorkerHandlers(controller)
        started = await handlers.start({"configuration": {"youtube_enabled": False}})
        reloaded = await handlers.reload({"configuration": {"twitch_enabled": False}})
        stopped = await handlers.stop({})

        self.assertTrue(started["is_running"])
        self.assertTrue(reloaded["is_running"])
        self.assertFalse(stopped["is_running"])
        self.assertEqual([call[0] for call in controller.calls], ["start", "reload", "start", "stop"])

    async def test_rejects_extra_fields_and_oversized_configuration(self) -> None:
        """确认 Worker 拒绝额外字段和超过 UTF-8 预算的配置。"""

        handlers = LiveWorkerHandlers(FakeController(), max_config_bytes=32)
        with self.assertRaisesRegex(ValueError, "fields"):
            await handlers.start({"configuration": {}, "token": "secret"})
        with self.assertRaisesRegex(ValueError, "size limit"):
            await handlers.start({"configuration": {"value": "x" * 64}})


if __name__ == "__main__":
    unittest.main()
