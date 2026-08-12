#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
Delivery adapter registry for task result delivery across multiple channels.

Provides a pluggable dispatch system that replaces the hardcoded if/else
in task_scheduler.py. Each delivery target registers an async adapter
function that handles the actual delivery.

Author: Claude Code
Department: R&D
Date: 2026-04-19
Version: 1.0.0
Security Level: INTERNAL
"""

__version__ = "1.0.0"
__author__ = "Claude Code"
__copyright__ = "Copyright 2026 Synapxnet"
__maintainer__ = "Claude Code"
__email__ = "synapxnet@gmail.com"

import asyncio
import json
import logging
from datetime import datetime
from typing import Any, Callable, Coroutine, Dict, List, Optional

from py.delivery_credentials import (
    normalize_delivery_credential_headers,
    normalize_delivery_credential_url,
)

logger = logging.getLogger("app")

DeliveryAdapter = Callable[
    [Dict[str, Any], Dict[str, Any]],
    Coroutine[Any, Any, Dict[str, Any]],
]

_adapters: Dict[str, DeliveryAdapter] = {}
MAX_DELIVERY_PAYLOAD_BYTES = 128 * 1024
MAX_DELIVERY_RESPONSE_BYTES = 64 * 1024


def register_delivery_adapter(target_name: str, adapter: DeliveryAdapter) -> None:
    """Register one delivery adapter under a normalized target name."""

    _adapters[target_name.lower().strip()] = adapter


def get_delivery_adapter(target_name: str) -> Optional[DeliveryAdapter]:
    """Return one registered delivery adapter by normalized target name."""

    return _adapters.get(target_name.lower().strip())


def list_delivery_adapters() -> List[str]:
    """Return registered delivery target names in deterministic order."""

    return sorted(_adapters.keys())


def _build_delivery_payload(task: Any, delivery_record: Dict[str, Any]) -> Dict[str, Any]:
    """Build one detached adapter payload from task and delivery metadata."""

    ctx = task.context if hasattr(task, "context") else {}
    return {
        "task_id": _bounded_delivery_text(
            task.task_id if hasattr(task, "task_id") else task.get("task_id", ""),
            128,
        ),
        "title": _bounded_delivery_text(
            task.title if hasattr(task, "title") else task.get("title", ""),
            512,
        ),
        "description": _bounded_delivery_text(
            task.description if hasattr(task, "description") else task.get("description", ""),
            8_192,
        ),
        "status": task.status if hasattr(task, "status") else str(task.get("status", "")),
        "result": _bounded_delivery_text(
            task.result if hasattr(task, "result") else task.get("result"),
            32_768,
        ),
        "error": _bounded_delivery_text(
            task.error if hasattr(task, "error") else task.get("error"),
            8_192,
        ),
        "progress": task.progress if hasattr(task, "progress") else int(task.get("progress", 0)),
        "created_at": _bounded_delivery_text(
            task.created_at if hasattr(task, "created_at") else task.get("created_at", ""),
            128,
        ),
        "completed_at": _bounded_delivery_text(
            task.completed_at if hasattr(task, "completed_at") else task.get("completed_at", ""),
            128,
        ),
        "schedule_type": ctx.get("schedule_type", "manual"),
        "delivery_target": delivery_record.get("target", ""),
        "timestamp": datetime.now().isoformat(),
    }


async def dispatch_delivery(
    task: Any,
    delivery_record: Dict[str, Any],
    settings: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Dispatch one delivery and attach a stable retryability classification."""

    target = str(delivery_record.get("target", "")).lower().strip()
    adapter = get_delivery_adapter(target)
    if adapter is None:
        return {
            "success": False,
            "retryable": False,
            "error": f"No delivery adapter registered for target: {target}",
            "target": target,
        }
    payload = _build_delivery_payload(task, delivery_record)
    if settings:
        payload["_settings"] = settings
    try:
        result = await adapter(payload, delivery_record)
        success = bool(result.get("success", True))
        return {
            "target": target,
            "timestamp": datetime.now().isoformat(),
            **result,
            "success": success,
            "retryable": False if success else _classify_delivery_retryable(result),
        }
    except Exception:
        return {
            "success": False,
            "retryable": True,
            "error": "Delivery adapter failed.",
            "target": target,
            "timestamp": datetime.now().isoformat(),
        }


def _classify_delivery_retryable(result: Dict[str, Any]) -> bool:
    """Classify adapter failures without reflecting credentials across boundaries."""

    if isinstance(result.get("retryable"), bool):
        return bool(result["retryable"])
    status_code = result.get("status_code")
    try:
        normalized_status = int(status_code) if status_code is not None else None
    except (TypeError, ValueError):
        normalized_status = None
    if normalized_status is not None:
        return normalized_status in {408, 425, 429} or normalized_status >= 500
    error = str(result.get("error") or "").strip().lower()
    permanent_markers = (
        "no chat_id",
        "no channel_id",
        "no webhook url",
        "no telegram bot_token",
        "telegram bot token is not configured",
        "no delivery adapter",
        "unauthorized",
        "forbidden",
        "invalid token",
    )
    return not any(marker in error for marker in permanent_markers)


def _bounded_delivery_text(value: Any, maximum_length: int) -> str:
    """Return one single bounded text value for an external delivery payload."""

    if value is None:
        return ""
    if isinstance(value, str):
        text = value
    else:
        try:
            text = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
        except (TypeError, ValueError):
            text = str(value)
    return text[:maximum_length]


def _validate_delivery_payload(value: Dict[str, Any]) -> Dict[str, Any]:
    """Reject an outbound delivery payload that exceeds its JSON byte budget."""

    try:
        encoded = json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    except (TypeError, ValueError, UnicodeEncodeError) as error:
        raise RuntimeError("Delivery payload is invalid.") from error
    if len(encoded) > MAX_DELIVERY_PAYLOAD_BYTES:
        raise RuntimeError("Delivery payload exceeds its byte budget.")
    return value


async def _consume_bounded_delivery_response(response: Any) -> None:
    """Consume no more than the configured response budget from one webhook."""

    content_length = response.headers.get("content-length")
    try:
        declared_length = int(content_length) if content_length is not None else None
    except (TypeError, ValueError):
        declared_length = None
    if declared_length is not None and declared_length > MAX_DELIVERY_RESPONSE_BYTES:
        raise RuntimeError("Delivery response exceeds its byte budget.")
    consumed = 0
    async for chunk in response.aiter_bytes():
        consumed += len(chunk)
        if consumed > MAX_DELIVERY_RESPONSE_BYTES:
            raise RuntimeError("Delivery response exceeds its byte budget.")


async def _send_delivery_webhook(
    method: str,
    url: str,
    payload: Dict[str, Any],
    headers: Optional[Dict[str, str]] = None,
) -> int:
    """Send one bounded no-redirect webhook request and return only its status."""

    normalized_method = str(method or "POST").strip().upper()
    if normalized_method not in {"POST", "PUT"}:
        raise RuntimeError("Delivery webhook method is invalid.")
    normalized_url = normalize_delivery_credential_url(url)
    normalized_headers = normalize_delivery_credential_headers(headers or {})
    normalized_payload = _validate_delivery_payload(payload)
    import httpx
    timeout = httpx.Timeout(30.0, connect=10.0, read=30.0, write=30.0)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
        async with client.stream(
            normalized_method,
            normalized_url,
            json=normalized_payload,
            headers=normalized_headers,
        ) as response:
            await _consume_bounded_delivery_response(response)
            return int(response.status_code)


# ── Built-in adapters ──────────────────────────────────


async def _deliver_desktop_notification(
    payload: Dict[str, Any], record: Dict[str, Any]
) -> Dict[str, Any]:
    """Broadcast one terminal result as a desktop notification."""

    try:
        from py.overlay_router import overlay_manager
        await overlay_manager.broadcast({
            "action": "task_delivery",
            "data": {
                "task_id": payload["task_id"],
                "title": payload["title"],
                "status": str(payload["status"]),
                "summary": payload.get("result") or payload.get("error") or payload["description"],
                "schedule_type": payload.get("schedule_type", "manual"),
                "timestamp": payload["timestamp"],
                "presentation": "desktop_notification",
            },
        })
        return {"success": True, "method": "overlay_broadcast"}
    except Exception:
        return {"success": False, "error": "Desktop notification delivery failed."}


async def _deliver_dynamic_island(
    payload: Dict[str, Any], record: Dict[str, Any]
) -> Dict[str, Any]:
    """Broadcast one terminal result to the dynamic-island overlay."""

    try:
        from py.overlay_router import overlay_manager
        await overlay_manager.broadcast({
            "action": "task_delivery",
            "data": {
                "task_id": payload["task_id"],
                "title": payload["title"],
                "status": str(payload["status"]),
                "summary": payload.get("result") or payload.get("error") or payload["description"],
                "schedule_type": payload.get("schedule_type", "manual"),
                "timestamp": payload["timestamp"],
                "presentation": "dynamic_island",
            },
        })
        return {"success": True, "method": "overlay_broadcast"}
    except Exception:
        return {"success": False, "error": "Dynamic island delivery failed."}


async def _deliver_task_center(
    payload: Dict[str, Any], record: Dict[str, Any]
) -> Dict[str, Any]:
    """Acknowledge the task-center target already persisted by the scheduler."""

    return {"success": True, "method": "auto_resolved"}


def _get_telegram_configuration(settings: Dict[str, Any]) -> Dict[str, Any]:
    """Resolve canonical Telegram settings with a bounded obsolete-key fallback."""

    canonical = settings.get("telegramBotConfig", {})
    legacy = settings.get("telegramBot", {})
    canonical = canonical if isinstance(canonical, dict) else {}
    legacy = legacy if isinstance(legacy, dict) else {}
    resolved = dict(canonical)
    for field in ("bot_token", "behaviorTargetChatIds"):
        if not resolved.get(field) and legacy.get(field):
            resolved[field] = legacy[field]
    return resolved


async def _deliver_telegram(
    payload: Dict[str, Any], record: Dict[str, Any]
) -> Dict[str, Any]:
    """Deliver one terminal result through the process-scoped Telegram Bot token."""

    config = record.get("config", {})
    chat_id = config.get("chat_id", "")
    settings = payload.get("_settings") or {}

    if not chat_id:
        telegram_cfg = _get_telegram_configuration(settings)
        target_ids = telegram_cfg.get("behaviorTargetChatIds", [])
        if target_ids:
            chat_id = str(target_ids[0])

    if not chat_id:
        return {"success": False, "error": "No chat_id configured for Telegram delivery"}

    status = str(payload["status"]).upper()
    title = payload["title"]
    content = payload.get("result") or payload.get("error") or payload.get("description", "")
    text = f"📋 *Task {status}*\n\n*{title}*\n\n{content[:1500]}"

    try:
        telegram_cfg = _get_telegram_configuration(settings)
        bot_token = telegram_cfg.get("bot_token", "")
        if not bot_token:
            return {"success": False, "error": "Telegram Bot token is not configured"}

        import httpx
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"https://api.telegram.org/bot{bot_token}/sendMessage",
                json={
                    "chat_id": chat_id,
                    "text": text,
                    "parse_mode": "Markdown",
                },
            )
            data = resp.json()
            if data.get("ok"):
                return {"success": True, "method": "telegram_api", "chat_id": chat_id}
            return {
                "success": False,
                "error": "Telegram API rejected delivery",
                "status_code": resp.status_code,
            }
    except Exception:
        return {"success": False, "error": "Telegram delivery request failed"}


async def _deliver_discord(
    payload: Dict[str, Any], record: Dict[str, Any]
) -> Dict[str, Any]:
    """Deliver one terminal result through a Discord webhook or active client."""

    config = record.get("config", {})
    channel_id = config.get("channel_id", "")
    webhook_url = config.get("webhook_url", "")

    if webhook_url:
        status = str(payload["status"]).upper()
        title = payload["title"]
        content = payload.get("result") or payload.get("error") or payload.get("description", "")
        try:
            status_code = await _send_delivery_webhook("POST", webhook_url, {
                "content": f"📋 **Task {status}** — {title}\n\n{content[:1500]}",
            })
            if status_code in (200, 204):
                return {"success": True, "method": "discord_webhook"}
            return {
                "success": False,
                "error": "Discord webhook rejected delivery",
                "status_code": status_code,
            }
        except Exception:
            return {"success": False, "error": "Discord webhook delivery failed"}

    if not channel_id:
        settings = payload.get("_settings") or {}
        discord_cfg = settings.get("discordBotConfig", {})
        target_ids = discord_cfg.get("behaviorTargetChatIds", [])
        if target_ids:
            channel_id = str(target_ids[0])

    if not channel_id:
        return {"success": False, "error": "No channel_id or webhook_url for Discord delivery"}

    try:
        from py.discord_bot_manager import discord_bot_manager
        if discord_bot_manager and hasattr(discord_bot_manager, "_client") and discord_bot_manager._client:
            client = discord_bot_manager._client
            channel = client.get_channel(int(channel_id))
            if channel:
                status = str(payload["status"]).upper()
                title = payload["title"]
                content = payload.get("result") or payload.get("error") or payload.get("description", "")
                await channel.send(f"📋 **Task {status}** — {title}\n\n{content[:1500]}")
                return {"success": True, "method": "discord_client", "channel_id": channel_id}
        return {"success": False, "error": "Discord bot not running or channel not found"}
    except Exception:
        return {"success": False, "error": "Discord client delivery failed"}


async def _deliver_webhook(
    payload: Dict[str, Any], record: Dict[str, Any]
) -> Dict[str, Any]:
    """Deliver one secret-free terminal payload to a configured HTTP webhook."""

    config = record.get("config", {})
    url = config.get("url", "")
    if not url:
        return {"success": False, "error": "No webhook URL configured"}

    headers = config.get("headers", {})
    method = config.get("method", "POST").upper()

    clean_payload = _validate_delivery_payload({
        key: value for key, value in payload.items() if not key.startswith("_")
    })

    try:
        status_code = await _send_delivery_webhook(method, url, clean_payload, headers)
        if status_code < 400:
            return {"success": True, "method": "webhook", "status_code": status_code}
        return {
            "success": False,
            "error": "Webhook rejected delivery",
            "status_code": status_code,
        }
    except Exception:
        return {"success": False, "error": "Webhook delivery request failed"}


def register_builtin_adapters() -> None:
    """Register the built-in terminal delivery adapters."""

    register_delivery_adapter("task_center", _deliver_task_center)
    register_delivery_adapter("desktop_notification", _deliver_desktop_notification)
    register_delivery_adapter("dynamic_island", _deliver_dynamic_island)
    register_delivery_adapter("telegram", _deliver_telegram)
    register_delivery_adapter("discord", _deliver_discord)
    register_delivery_adapter("webhook", _deliver_webhook)
    register_delivery_adapter("im_bot", _deliver_telegram)


register_builtin_adapters()
