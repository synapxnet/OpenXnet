# -*- coding: utf-8 -*-
"""框架无关的多平台直播监听生命周期和安全事件标准化。"""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable, Mapping
import http.cookies
import inspect
import logging
from typing import Any
from uuid import uuid4

import aiohttp
from pydantic import BaseModel, Field

import py.blivedm as blivedm
import py.blivedm.models.open_live as open_models
import py.blivedm.models.web as web_models
from py.live_platform_credentials import hydrate_live_platform_config
from py.twitch_service import start_twitch_task, stop_twitch_task
from py.ytdm import YouTubeDMClient


MAX_LIVE_EVENT_CONTENT_LENGTH = 16 * 1024
MAX_LIVE_EVENT_FIELD_LENGTH = 128

LiveEventHandler = Callable[[Mapping[str, Any]], Awaitable[None] | None]


class LiveConfig(BaseModel):
    """定义直播传输元数据和仅在可信 Python 进程内注入的凭据。"""

    bilibili_enabled: bool = False
    bilibili_type: str = "web"
    bilibili_room_id: str = ""
    bilibili_sessdata: str = ""
    bilibili_ACCESS_KEY_ID: str = ""
    bilibili_ACCESS_KEY_SECRET: str = ""
    bilibili_APP_ID: str = ""
    bilibili_ROOM_OWNER_AUTH_CODE: str = ""
    youtube_enabled: bool = False
    youtube_video_id: str = ""
    youtube_api_key: str = ""
    twitch_enabled: bool = False
    twitch_channel: str = ""
    twitch_access_token: str = ""


class LiveOperationResult(BaseModel):
    """保存不含凭据和供应商诊断的直播生命周期结果。"""

    success: bool
    message: str
    is_running: bool
    details: dict[str, bool] = Field(default_factory=dict)


def normalize_live_event(value: Mapping[str, Any]) -> dict[str, str]:
    """规范直播事件；输入任意映射，返回有界字符串字段，类型或长度无效时抛出 ValueError。"""

    event_type = str(value.get("type") or "").strip()
    content = str(value.get("content") or "").strip()
    danmu_type = str(value.get("danmu_type") or "").strip()
    platform = str(value.get("platform") or "").strip().lower()
    event_id = str(value.get("id") or uuid4()).strip()
    if event_type not in {"message", "error"}:
        raise ValueError("Live event type is invalid.")
    if not content or len(content) > MAX_LIVE_EVENT_CONTENT_LENGTH:
        raise ValueError("Live event content is invalid.")
    if platform not in {"bilibili", "youtube", "twitch"}:
        raise ValueError("Live event platform is invalid.")
    if (
        not event_id
        or len(event_id) > MAX_LIVE_EVENT_FIELD_LENGTH
        or len(danmu_type) > MAX_LIVE_EVENT_FIELD_LENGTH
    ):
        raise ValueError("Live event metadata is invalid.")
    return {
        "id": event_id,
        "type": event_type,
        "content": content,
        "danmu_type": danmu_type or ("error" if event_type == "error" else "danmaku"),
        "platform": platform,
    }


class LiveRuntimeController:
    """在一个进程内管理 Bilibili、YouTube 和 Twitch 监听器。"""

    def __init__(self, event_handler: LiveEventHandler) -> None:
        """创建停止状态控制器；输入事件回调，无返回，不启动线程或网络连接。"""

        if not callable(event_handler):
            raise TypeError("Live event handler must be callable.")
        self._event_handler = event_handler
        self._loop: asyncio.AbstractEventLoop | None = None
        self._bilibili_client: Any | None = None
        self._bilibili_session: aiohttp.ClientSession | None = None
        self._bilibili_task: asyncio.Task[None] | None = None
        self._bilibili_stop: asyncio.Event | None = None
        self._youtube_client: YouTubeDMClient | None = None
        self._twitch_running = False
        self._operation_lock = asyncio.Lock()

    async def start(self, configuration: Mapping[str, Any]) -> LiveOperationResult:
        """启动所选平台；输入无密钥或已注入配置，返回安全结果，校验或传输失败时回滚已启动平台。"""

        async with self._operation_lock:
            if self.is_running:
                return self._result(False, "直播监听已在运行")
            try:
                config = LiveConfig(**hydrate_live_platform_config(configuration))
                self._validate_configuration(config)
                await self._start_unlocked(config)
                return self._result(True, "直播监听启动成功")
            except Exception as error:
                logging.error("Live runtime start failed: %s", type(error).__name__)
                await self._stop_unlocked()
                return self._result(False, "直播监听启动失败")

    async def stop(self) -> LiveOperationResult:
        """停止全部平台；无输入，返回安全结果，单个平台清理失败只记录异常类型并继续释放其余资源。"""

        async with self._operation_lock:
            try:
                await self._stop_unlocked()
                return self._result(True, "直播监听停止成功")
            except Exception as error:
                logging.error("Live runtime stop failed: %s", type(error).__name__)
                return self._result(False, "直播监听停止失败")

    async def reload(self, configuration: Mapping[str, Any]) -> LiveOperationResult:
        """重载全部平台；输入新配置，返回安全结果，停止或重新启动失败时保持已清理状态。"""

        async with self._operation_lock:
            try:
                await self._stop_unlocked()
                config = LiveConfig(**hydrate_live_platform_config(configuration))
                self._validate_configuration(config)
                await self._start_unlocked(config)
                return self._result(True, "直播监听重载成功")
            except Exception as error:
                logging.error("Live runtime reload failed: %s", type(error).__name__)
                await self._stop_unlocked()
                return self._result(False, "直播监听重载失败")

    def status(self) -> LiveOperationResult:
        """返回无凭据运行状态；无输入和副作用，不查询供应商或启动任何平台。"""

        return self._result(True, "直播监听运行中" if self.is_running else "直播监听已停止")

    @property
    def is_running(self) -> bool:
        """返回是否至少有一个平台仍处于活动状态；无输入和副作用。"""

        return any(self._details().values())

    def publish_from_callback(self, event: Mapping[str, Any]) -> None:
        """从同步或异步传输回调提交事件；输入原始事件，无返回，控制器未启动或事件无效时安全丢弃。"""

        if self._loop is None or self._loop.is_closed():
            return
        try:
            normalized = normalize_live_event(event)
        except ValueError:
            logging.warning("Live runtime dropped an invalid transport event.")
            return
        self._loop.call_soon_threadsafe(
            asyncio.create_task,
            self._emit_event(normalized),
        )

    async def _emit_event(self, event: Mapping[str, Any]) -> None:
        """调用所属边界的事件处理器；输入已规范事件，无返回，回调异常只记录类型。"""

        try:
            result = self._event_handler(dict(event))
            if inspect.isawaitable(result):
                await result
        except Exception as error:
            logging.error("Live event delivery failed: %s", type(error).__name__)

    async def _run_bilibili(self, config: LiveConfig) -> None:
        """运行一个 Bilibili 客户端直到停止事件；输入完整配置，无返回，退出时总是关闭客户端和会话。"""

        try:
            if config.bilibili_type == "web":
                self._bilibili_session = self._create_bilibili_session(config.bilibili_sessdata)
                client = blivedm.BLiveClient(
                    int(config.bilibili_room_id),
                    session=self._bilibili_session,
                )
                client.set_handler(BilibiliWebHandler(self.publish_from_callback))
            else:
                client = blivedm.OpenLiveClient(
                    access_key_id=config.bilibili_ACCESS_KEY_ID,
                    access_key_secret=config.bilibili_ACCESS_KEY_SECRET,
                    app_id=int(config.bilibili_APP_ID),
                    room_owner_auth_code=config.bilibili_ROOM_OWNER_AUTH_CODE,
                )
                client.set_handler(BilibiliOpenHandler(self.publish_from_callback))
            self._bilibili_client = client
            client.start()
            if self._bilibili_stop is not None:
                await self._bilibili_stop.wait()
        except asyncio.CancelledError:
            raise
        except Exception as error:
            logging.error("Bilibili live runtime failed: %s", type(error).__name__)
            self.publish_from_callback({
                "type": "error",
                "content": "哔哩哔哩直播连接失败",
                "danmu_type": "error",
                "platform": "bilibili",
            })
            raise
        finally:
            await self._close_bilibili()

    async def _start_unlocked(self, config: LiveConfig) -> None:
        """在持有操作锁时启动所选平台；输入已校验配置，无返回，传输启动失败时向调用方抛出异常。"""

        self._loop = asyncio.get_running_loop()
        if config.bilibili_enabled:
            self._bilibili_stop = asyncio.Event()
            self._bilibili_task = asyncio.create_task(
                self._run_bilibili(config),
                name="OpenXnetLiveBilibili",
            )
        if config.youtube_enabled:
            self._youtube_client = YouTubeDMClient(
                api_key=config.youtube_api_key,
                video_id=config.youtube_video_id,
                on_message=self.publish_from_callback,
            )
            self._youtube_client.start()
        if config.twitch_enabled:
            await start_twitch_task(config.model_dump(), self._handle_twitch_message)
            self._twitch_running = True
        await asyncio.sleep(0.1)
        if self._bilibili_task is not None and self._bilibili_task.done():
            await self._bilibili_task

    async def _close_bilibili(self) -> None:
        """关闭 Bilibili 客户端和会话；无输入和返回，清理异常只记录类型。"""

        client = self._bilibili_client
        session = self._bilibili_session
        self._bilibili_client = None
        self._bilibili_session = None
        if client is not None:
            try:
                await client.stop_and_close()
            except Exception as error:
                logging.warning("Bilibili client cleanup failed: %s", type(error).__name__)
        if session is not None:
            try:
                await session.close()
            except Exception as error:
                logging.warning("Bilibili session cleanup failed: %s", type(error).__name__)

    async def _stop_unlocked(self) -> None:
        """在持有操作锁时清理全部平台；无输入和返回，内部失败被隔离以完成其余资源释放。"""

        if self._bilibili_stop is not None:
            self._bilibili_stop.set()
        task = self._bilibili_task
        self._bilibili_task = None
        if task is not None:
            try:
                await asyncio.wait_for(task, timeout=10)
            except asyncio.TimeoutError:
                task.cancel()
                await asyncio.gather(task, return_exceptions=True)
            except asyncio.CancelledError:
                task.cancel()
                await asyncio.gather(task, return_exceptions=True)
                raise
            except Exception as error:
                logging.warning("Bilibili task cleanup failed: %s", type(error).__name__)
        self._bilibili_stop = None
        await self._close_bilibili()

        youtube_client = self._youtube_client
        self._youtube_client = None
        if youtube_client is not None:
            try:
                await asyncio.to_thread(youtube_client.stop)
            except Exception as error:
                logging.warning("YouTube client cleanup failed: %s", type(error).__name__)

        if self._twitch_running:
            try:
                await stop_twitch_task()
            except Exception as error:
                logging.warning("Twitch client cleanup failed: %s", type(error).__name__)
            self._twitch_running = False
        self._loop = None

    async def _handle_twitch_message(self, _channel: str, user: str, message: str) -> None:
        """规范 Twitch IRC 消息并交付事件；输入频道、用户和文本，无返回，事件错误由统一边界隔离。"""

        await self._emit_event(normalize_live_event({
            "type": "message",
            "content": f"{user} said: {message}",
            "danmu_type": "danmaku",
            "platform": "twitch",
        }))

    def _validate_configuration(self, config: LiveConfig) -> None:
        """校验所选平台元数据和注入凭据；输入配置，无返回，缺失或无效字段时抛出 ValueError。"""

        if config.bilibili_enabled:
            if config.bilibili_type == "web":
                if not config.bilibili_room_id.isdigit() or int(config.bilibili_room_id) <= 0:
                    raise ValueError("Bilibili room ID is invalid.")
            elif config.bilibili_type == "open":
                if not all([
                    config.bilibili_ACCESS_KEY_ID,
                    config.bilibili_ACCESS_KEY_SECRET,
                    config.bilibili_APP_ID,
                    config.bilibili_ROOM_OWNER_AUTH_CODE,
                ]) or not config.bilibili_APP_ID.isdigit():
                    raise ValueError("Bilibili Open Live configuration is incomplete.")
            else:
                raise ValueError("Bilibili authentication mode is invalid.")
        if config.youtube_enabled and not (config.youtube_video_id and config.youtube_api_key):
            raise ValueError("YouTube configuration is incomplete.")
        if config.twitch_enabled and not (config.twitch_channel and config.twitch_access_token):
            raise ValueError("Twitch configuration is incomplete.")

    def _create_bilibili_session(self, sessdata: str) -> aiohttp.ClientSession:
        """创建 Bilibili HTTP 会话；输入可选 SESSDATA，返回会话，凭据仅写入目标域 Cookie Jar。"""

        cookies = http.cookies.SimpleCookie()
        if sessdata:
            cookies["SESSDATA"] = sessdata
            cookies["SESSDATA"]["domain"] = "bilibili.com"
        session = aiohttp.ClientSession()
        if sessdata:
            session.cookie_jar.update_cookies(cookies)
        return session

    def _details(self) -> dict[str, bool]:
        """返回三个平台的运行标志；无输入和副作用，不包含配置或凭据。"""

        return {
            "bilibili": self._bilibili_task is not None and not self._bilibili_task.done(),
            "youtube": self._youtube_client is not None,
            "twitch": self._twitch_running,
        }

    def _result(self, success: bool, message: str) -> LiveOperationResult:
        """构建安全生命周期结果；输入成功标志和固定文案，返回当前状态，无副作用。"""

        details = self._details()
        return LiveOperationResult(
            success=success,
            message=message,
            is_running=any(details.values()),
            details=details,
        )


class BilibiliWebHandler(blivedm.BaseHandler):
    """把 Bilibili Web 事件转换为统一直播事件。"""

    def __init__(self, publish: Callable[[Mapping[str, Any]], None]) -> None:
        """保存同步发布函数；输入回调，无返回，不打开网络连接。"""

        self._publish = publish

    def _on_heartbeat(self, _client: Any, _message: web_models.HeartbeatMessage) -> None:
        """接收心跳；输入客户端和消息，无返回，不发布用户事件。"""

    def _on_danmaku(self, _client: Any, message: web_models.DanmakuMessage) -> None:
        """发布普通弹幕；输入 SDK 消息，无返回，字段由统一事件边界限制。"""

        self._message(f"{message.uname}说：{message.msg}", "danmaku")

    def _on_gift(self, _client: Any, message: web_models.GiftMessage) -> None:
        """发布礼物事件；输入 SDK 消息，无返回，不包含认证信息。"""

        self._message(
            f"{message.uname} 赠送{message.gift_name}x{message.num} "
            f"（{message.coin_type}瓜子x{message.total_coin}）",
            "gift",
        )

    def _on_buy_guard(self, _client: Any, message: web_models.GuardBuyMessage) -> None:
        """发布上舰事件；输入 SDK 消息，无返回，不包含认证信息。"""

        self._message(f"{message.username} 上舰，大航海等级={message.guard_level}", "buy_guard")

    def _on_super_chat(self, _client: Any, message: web_models.SuperChatMessage) -> None:
        """发布醒目留言；输入 SDK 消息，无返回，不包含认证信息。"""

        self._message(f"{message.uname}发送醒目留言：{message.message}", "super_chat")

    def _on_interact_word(self, _client: Any, message: web_models.InteractWordMessage) -> None:
        """发布进房或关注事件；输入 SDK 消息，无返回，未知交互类型被忽略。"""

        if message.msg_type == 1:
            self._message(f"{message.username} 进入房间", "enter_room")
        elif message.msg_type == 2:
            self._message(f"{message.username} 关注了你", "follow")

    def _message(self, content: str, danmu_type: str) -> None:
        """构建统一 Bilibili 事件；输入内容和类型，无返回，发布失败由控制器隔离。"""

        self._publish({
            "type": "message",
            "content": content,
            "danmu_type": danmu_type,
            "platform": "bilibili",
        })


class BilibiliOpenHandler(blivedm.BaseHandler):
    """把 Bilibili Open Live 事件转换为统一直播事件。"""

    def __init__(self, publish: Callable[[Mapping[str, Any]], None]) -> None:
        """保存同步发布函数；输入回调，无返回，不打开网络连接。"""

        self._publish = publish

    def _on_heartbeat(self, _client: Any, _message: Any) -> None:
        """接收心跳；输入客户端和消息，无返回，不发布用户事件。"""

    def _on_open_live_danmaku(self, _client: Any, message: open_models.DanmakuMessage) -> None:
        """发布开放平台弹幕；输入 SDK 消息，无返回，不包含认证信息。"""

        self._message(f"{message.uname}说：{message.msg}", "danmaku")

    def _on_open_live_gift(self, _client: Any, message: open_models.GiftMessage) -> None:
        """发布开放平台礼物；输入 SDK 消息，无返回，不包含认证信息。"""

        coin_type = "金瓜子" if message.paid else "银瓜子"
        total_coin = message.price * message.gift_num
        self._message(
            f"{message.uname} 赠送{message.gift_name}x{message.gift_num} "
            f"（{coin_type}x{total_coin}）",
            "gift",
        )

    def _on_open_live_buy_guard(self, _client: Any, message: open_models.GuardBuyMessage) -> None:
        """发布开放平台上舰事件；输入 SDK 消息，无返回，不包含认证信息。"""

        self._message(
            f"{message.user_info.uname} 上舰，大航海等级={message.guard_level}",
            "buy_guard",
        )

    def _on_open_live_super_chat(self, _client: Any, message: open_models.SuperChatMessage) -> None:
        """发布开放平台醒目留言；输入 SDK 消息，无返回，不包含认证信息。"""

        self._message(f"{message.uname}发送醒目留言：{message.message}", "super_chat")

    def _on_open_live_like(self, _client: Any, message: open_models.LikeMessage) -> None:
        """发布开放平台点赞；输入 SDK 消息，无返回，不包含认证信息。"""

        self._message(f"{message.uname} 点赞", "like")

    def _on_open_live_enter_room(self, _client: Any, message: open_models.RoomEnterMessage) -> None:
        """发布开放平台进房事件；输入 SDK 消息，无返回，不包含认证信息。"""

        self._message(f"{message.uname} 进入房间", "enter_room")

    def _message(self, content: str, danmu_type: str) -> None:
        """构建统一 Bilibili 事件；输入内容和类型，无返回，发布失败由控制器隔离。"""

        self._publish({
            "type": "message",
            "content": content,
            "danmu_type": danmu_type,
            "platform": "bilibili",
        })
