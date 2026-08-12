#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# SPDX-FileCopyrightText: python-telegram-bot
# SPDX-FileCopyrightText: 2026 Synapxnet
# SPDX-License-Identifier: LGPL-3.0
#
# Licensed under the LGPL-3.0 License.
# ==============================================================================
"""
Telegram Bot 管理 — 基于 python-telegram-bot 的消息路由与管理。

原始项目: python-telegram-bot (https://github.com/python-telegram-bot/python-telegram-bot)
License: LGPL-3.0

修改说明:
- 2026-04-13, maoyo: 集成至 OpenXnet/Synapxnet 平台，添加异步支持与错误处理优化。

本文件修改部分由 Synapxnet 贡献。

Author: maoyo
Date: 2026-04-13
Version: 1.0.0
"""

__version__ = "1.0.0"
__author__ = "maoyo"
__copyright__ = "Copyright 2026 Synapxnet"
__license__ = "LGPL-3.0"
__maintainer__ = "maoyo"
__email__ = "synapxnet@gmail.com"

import asyncio
import logging
import threading
import weakref
from typing import Optional

from pydantic import BaseModel, Field

from py.behavior_engine import BehaviorSettings
from py.telegram_client import TelegramClient


class TelegramBotConfig(BaseModel):
    """定义 Telegram Connector 接收的无密钥元数据和进程内注入凭据。"""

    TelegramAgent: str
    memoryLimit: int
    separators: list[str]
    reasoningVisible: bool
    quickRestart: bool
    enableTTS: bool
    bot_token: str
    wakeWord: str
    behaviorSettings: Optional[BehaviorSettings] = None
    behaviorTargetChatIds: list[str] = Field(default_factory=list)
    toolMemorandumEnabled: bool = False


class TelegramBotManager:
    """管理 Telegram 轮询线程，并限制 Bot Token 只保留在连接器进程内。"""

    def __init__(self) -> None:
        """初始化停止状态；无输入和返回值，不启动线程，初始化失败时直接抛出异常。"""

        self.bot_thread: Optional[threading.Thread] = None
        self.bot_client: Optional[TelegramClient] = None
        self.is_running = False
        self.config = None
        self.loop = None
        self._shutdown_event = threading.Event()
        self._startup_complete = threading.Event()
        self._ready_complete = threading.Event()
        self._startup_error: Optional[str] = None
        self._stop_requested = False

    def start_bot(self, config: TelegramBotConfig) -> None:
        """使用已注入凭据的配置启动轮询；成功无返回，超时、重复启动或缺少凭据时抛出异常并清理线程。"""

        if self.bot_thread and self.bot_thread.is_alive():
            raise Exception("Telegram 机器人线程正在清理中，请稍后再试")

        if self.is_running:
            raise Exception("Telegram 机器人已在运行")
        if not str(config.bot_token or "").strip():
            raise ValueError("Telegram credential is not configured.")

        self.config = config
        self._shutdown_event.clear()
        self._startup_complete.clear()
        self._ready_complete.clear()
        self._startup_error = None
        self._stop_requested = False

        self.bot_thread = threading.Thread(
            target=self._run_bot_thread,
            args=(config,),
            daemon=True,
            name="TelegramBotThread",
        )
        self.bot_thread.start()

        if not self._startup_complete.wait(timeout=30):
            self.stop_bot()
            raise Exception("Telegram 机器人连接超时")
        if self._startup_error:
            self.stop_bot()
            raise Exception(f"Telegram 机器人启动失败: {self._startup_error}")
        if not self._ready_complete.wait(timeout=30):
            self.stop_bot()
            raise Exception("Telegram 机器人就绪超时")
        if not self.is_running:
            self.stop_bot()
            raise Exception("Telegram 机器人未能正常运行")
    def _run_bot_thread(self, config: TelegramBotConfig) -> None:
        """在线程专属事件循环中运行客户端；输入为完整配置，无返回，退出时始终释放客户端和循环引用。"""

        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)

        async def main_startup() -> None:
            """直接应用无密钥行为配置并运行客户端；无返回，启动或运行异常会转换为类型级诊断。"""

            try:
                from py.behavior_engine import global_behavior_engine

                if config.behaviorSettings is not None:
                    target_ids = list(config.behaviorTargetChatIds)
                    logging.info(
                        "Telegram 线程: 同步行为配置，目标频道数: %s",
                        len(target_ids),
                    )
                    global_behavior_engine.update_config(
                        config.behaviorSettings,
                        {"telegram": target_ids},
                    )

                self.bot_client = TelegramClient()
                self.bot_client.TelegramAgent = config.TelegramAgent
                self.bot_client.memoryLimit = config.memoryLimit
                self.bot_client.separators = config.separators or ["。", "\n", "？", "！"]
                self.bot_client.reasoningVisible = config.reasoningVisible
                self.bot_client.quickRestart = config.quickRestart
                self.bot_client.enableTTS = config.enableTTS
                self.bot_client.wakeWord = config.wakeWord
                self.bot_client.toolMemorandumEnabled = config.toolMemorandumEnabled
                self.bot_client.bot_token = config.bot_token
                self.bot_client.config = config
                self.bot_client._manager_ref = weakref.ref(self)
                self.bot_client._ready_callback = self._on_bot_ready

                if not global_behavior_engine.is_running:
                    asyncio.create_task(global_behavior_engine.start())
                    logging.info("行为引擎已在 Telegram 线程启动")

                self._startup_complete.set()
                await self.bot_client.run()

            except Exception as error:
                if not self._stop_requested:
                    self._startup_error = type(error).__name__
                    logging.error(
                        "Telegram bot startup/runtime failed: %s",
                        self._startup_error,
                    )
                if not self._startup_complete.is_set():
                    self._startup_complete.set()
                if not self._ready_complete.is_set():
                    self._ready_complete.set()

        try:
            self.loop.run_until_complete(main_startup())
        except Exception as error:
            if not self._stop_requested:
                logging.error(
                    "Telegram event loop failed: %s",
                    type(error).__name__,
                )
        finally:
            self._cleanup()

    def _on_bot_ready(self) -> None:
        """接收客户端就绪回调并释放启动等待；无输入和返回值，仅更新线程安全事件与运行状态。"""
        self.is_running = True
        if not self._ready_complete.is_set():
            self._ready_complete.set()
        logging.info("Telegram 机器人已完全就绪")

    def _cleanup(self) -> None:
        """释放客户端、事件循环和凭据引用；无输入和返回值，清理异常只记录类型且不向外泄漏。"""

        self.is_running = False
        logging.info("开始清理 Telegram 机器人资源...")

        if self.loop and not self.loop.is_closed():
            try:
                pending = asyncio.all_tasks(self.loop)
                for task in pending:
                    task.cancel()

                if self.loop.is_running():
                    self.loop.stop()

                if not self.loop.is_closed():
                    self.loop.close()
            except Exception as error:
                logging.warning(
                    "Telegram event-loop cleanup failed: %s",
                    type(error).__name__,
                )

        self.bot_client = None
        self.config = None
        self.loop = None
        self._shutdown_event.set()
        logging.info("Telegram 机器人资源清理完成")

    def stop_bot(self) -> None:
        """请求停止轮询并限时等待线程退出；无输入和返回值，超时只记录告警并执行兜底清理。"""

        if not self.is_running and not self.bot_thread:
            logging.info("Telegram 机器人未在运行")
            return

        logging.info("正在停止 Telegram 机器人...")
        self._stop_requested = True
        self.is_running = False

        if self.bot_client:
            self.bot_client._shutdown_requested = True

        self._shutdown_event.set()

        if self.bot_thread and self.bot_thread.is_alive():
            self.bot_thread.join(timeout=15)

            if self.bot_thread.is_alive():
                logging.warning("Telegram 机器人线程未能在15秒内停止")
                self._cleanup()

        self._stop_requested = False
        logging.info("Telegram 机器人停止操作完成")

    def get_status(self) -> dict[str, object]:
        """返回不含配置和凭据的生命周期快照；无副作用，内部状态不可用时使用安全默认值。"""

        return {
            "is_running": self.is_running,
            "thread_alive": self.bot_thread.is_alive() if self.bot_thread else False,
            "client_ready": self.bot_client._is_ready if self.bot_client else False,
            "loop_running": self.loop and not self.loop.is_closed() if self.loop else False,
            "error_type": self._startup_error,
            "connection_established": self._startup_complete.is_set(),
            "ready_completed": self._ready_complete.is_set(),
            "stop_requested": self._stop_requested,
        }

    def update_behavior_config(self, config: TelegramBotConfig) -> None:
        """热更新无密钥行为配置；输入为完整模型，无返回，更新失败由调用方捕获并脱敏。"""

        self.config = config

        if self.bot_client:
            self.bot_client.TelegramAgent = config.TelegramAgent
            self.bot_client.enableTTS = config.enableTTS
            self.bot_client.wakeWord = config.wakeWord
            self.bot_client.toolMemorandumEnabled = config.toolMemorandumEnabled
            self.bot_client.config = config

        from py.behavior_engine import global_behavior_engine

        target_map = {"telegram": config.behaviorTargetChatIds}
        global_behavior_engine.update_config(
            config.behaviorSettings,
            target_map,
        )
        logging.info("Telegram 机器人: 行为配置已热更新，计时器已重置")
