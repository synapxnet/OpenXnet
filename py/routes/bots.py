#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
Multi-platform bot management routes extracted from the monolithic server module.

This module centralizes start/stop/status/reload endpoints for QQ, Feishu,
Dingtalk, Discord, Slack, and Telegram bot managers.

Author: OpenAI Codex
Department: R&D
Date: 2026-04-16
Version: 1.0.0
Security Level: INTERNAL
"""

__version__ = "1.0.0"
__author__ = "OpenAI Codex"
__copyright__ = "Copyright 2026 Synapxnet"
__maintainer__ = "OpenAI Codex"
__email__ = "synapxnet@gmail.com"

# Modification History:
# 2026-04-16, v1.0.0, OpenAI Codex: Initial creation.

import asyncio
import logging

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from py.connector_worker_client import (
    ConnectorWorkerClientError,
    get_connector_worker_client,
)
from py.telegram_credentials import apply_telegram_credential_to_configuration

router = APIRouter(tags=["bots"])
connector_router = APIRouter(tags=["connector-bots"])
logger = logging.getLogger("app")


class BotContainer:
    """管理所有机器人的单例，只有在第一次调用 get 方法时才会 import 对应的重型 SDK"""

    _telegram = None

    @classmethod
    def get_telegram(cls):
        """Return the in-process Telegram manager on first use."""

        if cls._telegram is None:
            from py.telegram_bot_manager import TelegramBotManager

            cls._telegram = TelegramBotManager()
        return cls._telegram


def _connector_error_response(error: ConnectorWorkerClientError) -> JSONResponse:
    """Convert a credential-safe Worker client error into a compatibility response."""

    status_code = 503 if error.retryable else 400
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "message": str(error),
            "error_type": error.code,
        },
    )


async def _start_connector(
    platform_name: str,
    config_data: dict,
    success_message: str,
    *,
    environment: str | None = None,
):
    """Start one optional connector and preserve its legacy route envelope."""

    try:
        await get_connector_worker_client().start(platform_name, config_data)
        response = {"success": True, "message": success_message}
        if environment:
            response["environment"] = environment
        return response
    except ConnectorWorkerClientError as error:
        logger.error("Connector startup failed for %s: %s", platform_name, error.code)
        return _connector_error_response(error)


async def _stop_connector(platform_name: str, success_message: str):
    """Stop one optional connector and preserve its legacy route envelope."""

    try:
        await get_connector_worker_client().stop(platform_name)
        return {"success": True, "message": success_message}
    except ConnectorWorkerClientError as error:
        return _connector_error_response(error)


async def _connector_status(platform_name: str):
    """Return one optional connector status without activating an unused Worker."""

    try:
        return await get_connector_worker_client().status(platform_name)
    except ConnectorWorkerClientError as error:
        return {
            "platform": platform_name,
            "is_running": False,
            "status": "error",
            "error_message": str(error),
            "error_type": error.code,
        }


async def _reload_connector(
    platform_name: str,
    config_data: dict,
    success_message: str,
):
    """Reload one optional connector with new configuration."""

    try:
        await get_connector_worker_client().reload(platform_name, config_data)
        return {"success": True, "message": success_message, "config_changed": True}
    except ConnectorWorkerClientError as error:
        return _connector_error_response(error)


@connector_router.post("/start_qq_bot")
async def start_qq_bot(config_data: dict):
    """Start QQ through the optional Connector Worker."""

    return await _start_connector(
        "qq",
        config_data,
        "QQ机器人已成功启动",
        environment="worker-based",
    )


@connector_router.post("/stop_qq_bot")
async def stop_qq_bot():
    """Stop QQ through the optional Connector Worker."""

    return await _stop_connector("qq", "QQ机器人已停止")


@connector_router.get("/qq_bot_status")
async def qq_bot_status():
    """Return the credential-safe QQ Worker status."""

    return await _connector_status("qq")


@connector_router.post("/reload_qq_bot")
async def reload_qq_bot(config_data: dict):
    """Reload QQ through the optional Connector Worker."""

    return await _reload_connector("qq", config_data, "QQ机器人已重新加载")


@connector_router.post("/start_feishu_bot")
async def start_feishu_bot(config_data: dict):
    """Start Feishu through the optional Connector Worker."""

    return await _start_connector(
        "feishu",
        config_data,
        "飞书机器人已成功启动",
        environment="worker-based",
    )


@connector_router.post("/stop_feishu_bot")
async def stop_feishu_bot():
    """Stop Feishu through the optional Connector Worker."""

    return await _stop_connector("feishu", "飞书机器人已停止")


@connector_router.get("/feishu_bot_status")
async def feishu_bot_status():
    """Return the credential-safe Feishu Worker status."""

    return await _connector_status("feishu")


@connector_router.post("/reload_feishu_bot")
async def reload_feishu_bot(config_data: dict):
    """Reload Feishu through the optional Connector Worker."""

    return await _reload_connector("feishu", config_data, "飞书机器人已重新加载")


@connector_router.post("/start_dingtalk_bot")
async def start_dingtalk_bot(config_data: dict):
    """Start Dingtalk through the optional Connector Worker."""

    return await _start_connector("dingtalk", config_data, "钉钉机器人已成功启动")


@connector_router.post("/stop_dingtalk_bot")
async def stop_dingtalk_bot():
    """Stop Dingtalk through the optional Connector Worker."""

    return await _stop_connector("dingtalk", "钉钉机器人已停止")


@connector_router.get("/dingtalk_bot_status")
async def dingtalk_bot_status():
    """Return the credential-safe Dingtalk Worker status."""

    return await _connector_status("dingtalk")


@connector_router.post("/reload_dingtalk_bot")
async def reload_dingtalk_bot(config_data: dict):
    """Reload Dingtalk through the optional Connector Worker."""

    return await _reload_connector("dingtalk", config_data, "钉钉机器人配置已重载")


@connector_router.post("/start_discord_bot")
async def start_discord_bot(config_data: dict):
    """Start Discord through the optional Connector Worker."""

    return await _start_connector("discord", config_data, "Discord 机器人已启动")


@connector_router.post("/stop_discord_bot")
async def stop_discord_bot():
    """Stop Discord through the optional Connector Worker."""

    return await _stop_connector("discord", "Discord 机器人已停止")


@connector_router.get("/discord_bot_status")
async def discord_bot_status():
    """Return the credential-safe Discord Worker status."""

    return await _connector_status("discord")


@connector_router.post("/reload_discord_bot")
async def reload_discord_bot(config_data: dict):
    """Reload Discord through the optional Connector Worker."""

    return await _reload_connector("discord", config_data, "Discord 机器人已重载")


@connector_router.post("/start_slack_bot")
async def start_slack_bot(config_data: dict):
    """Start Slack through the optional Connector Worker."""

    return await _start_connector("slack", config_data, "Slack 机器人已启动")


@connector_router.post("/stop_slack_bot")
async def stop_slack_bot():
    """Stop Slack through the optional Connector Worker."""

    return await _stop_connector("slack", "Slack 机器人已停止")


@connector_router.get("/slack_bot_status")
async def slack_bot_status():
    """Return the credential-safe Slack Worker status."""

    return await _connector_status("slack")


@connector_router.post("/reload_slack_bot")
async def reload_slack_bot(config_data: dict):
    """Reload Slack through the optional Connector Worker."""

    return await _reload_connector("slack", config_data, "Slack 机器人已重载")


@router.post("/start_telegram_bot")
async def start_telegram_bot(config_data: dict):
    """Start Telegram after hydrating its process-scoped Bot token."""

    try:
        from py.telegram_bot_manager import TelegramBotConfig

        config = TelegramBotConfig(
            **apply_telegram_credential_to_configuration(config_data)
        )
        BotContainer.get_telegram().start_bot(config)
        return {"success": True, "message": "Telegram 机器人已成功启动", "environment": "thread-based"}
    except Exception as exc:
        logger.error("Telegram startup failed: %s", type(exc).__name__)
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "message": "Telegram 机器人启动失败，请检查配置。",
                "error_type": "startup_error",
            },
        )


@router.post("/stop_telegram_bot")
async def stop_telegram_bot():
    """Stop the local Telegram manager without exposing runtime exceptions."""

    try:
        if BotContainer._telegram:
            BotContainer.get_telegram().stop_bot()
        return {"success": True, "message": "Telegram 机器人已停止"}
    except Exception as exc:
        logger.error("Telegram stop failed: %s", type(exc).__name__)
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": "Telegram 机器人停止失败。"},
        )


@router.get("/telegram_bot_status")
async def telegram_bot_status():
    """Return credential-free status for the local Telegram manager."""

    if BotContainer._telegram is None:
        return {"is_running": False}
    status = BotContainer.get_telegram().get_status()
    if status.get("error_type") and not status.get("is_running"):
        status["error_message"] = "Telegram 机器人启动失败，请检查配置。"
    return status


@router.post("/reload_telegram_bot")
async def reload_telegram_bot(config_data: dict):
    """Reload Telegram after hydrating its process-scoped Bot token."""

    try:
        from py.telegram_bot_manager import TelegramBotConfig

        config = TelegramBotConfig(
            **apply_telegram_credential_to_configuration(config_data)
        )
        manager = BotContainer.get_telegram()
        manager.stop_bot()
        await asyncio.sleep(1)
        manager.start_bot(config)
        return {"success": True, "message": "Telegram 机器人已重新加载", "config_changed": True}
    except Exception as exc:
        logger.error("Telegram reload failed: %s", type(exc).__name__)
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": "Telegram 机器人重载失败，请检查配置。"},
        )
