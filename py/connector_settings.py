# -*- coding: utf-8 -*-
"""为 Connector Manager 提供有界且兼容 Server 的设置快照。"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
import os
from typing import Any

from py.get_setting import load_settings


PRIVATE_CONNECTOR_SETTINGS_ENV_NAMES = (
    "OPENXNET_CONNECTOR_CHAT_ORIGIN",
    "OPENXNET_CONNECTOR_CHAT_TOKEN",
    "OPENXNET_CONNECTOR_VOICE_ORIGIN",
    "OPENXNET_CONNECTOR_VOICE_TOKEN",
    "OPENXNET_CONNECTOR_VOICE_EXCHANGE_DIR",
)


def uses_private_connector_settings_snapshot() -> bool:
    """判断当前进程是否属于 Desktop 私有 Connector 边界；任一私有环境值存在即返回 True。"""

    return any(name in os.environ for name in PRIVATE_CONNECTOR_SETTINGS_ENV_NAMES)


async def resolve_connector_behavior_snapshot(
    configured_behavior_settings: Any,
    configured_target_chat_ids: Sequence[str] | None,
    platform_settings_key: str,
) -> tuple[Any, list[str]]:
    """解析行为设置和目标列表；Desktop 仅使用请求投影，Server 缺省时兼容读取 legacy settings。"""

    target_chat_ids = list(configured_target_chat_ids or [])
    if uses_private_connector_settings_snapshot():
        return configured_behavior_settings, target_chat_ids

    settings = await load_settings()
    if not isinstance(settings, Mapping):
        return configured_behavior_settings, target_chat_ids

    behavior_settings = settings.get(
        "behaviorSettings",
        configured_behavior_settings,
    )
    if target_chat_ids:
        return behavior_settings, target_chat_ids

    platform_settings = settings.get(platform_settings_key, {})
    if not isinstance(platform_settings, Mapping):
        return behavior_settings, target_chat_ids
    raw_target_chat_ids = platform_settings.get("behaviorTargetChatIds", [])
    if not isinstance(raw_target_chat_ids, Sequence) or isinstance(
        raw_target_chat_ids,
        (str, bytes, bytearray),
    ):
        return behavior_settings, target_chat_ids
    return behavior_settings, [
        item
        for item in raw_target_chat_ids
        if isinstance(item, str)
    ]


async def resolve_connector_tool_memorandum_enabled(
    configured_enabled: bool,
) -> bool:
    """解析工具链接留存开关；Desktop 只信任请求字段，Server 继续兼容 legacy settings。"""

    if uses_private_connector_settings_snapshot():
        return configured_enabled is True

    settings = await load_settings()
    if not isinstance(settings, Mapping):
        return configured_enabled is True
    tools_settings = settings.get("tools", {})
    if not isinstance(tools_settings, Mapping):
        return configured_enabled is True
    memorandum_settings = tools_settings.get("toolMemorandum", {})
    if not isinstance(memorandum_settings, Mapping):
        return configured_enabled is True
    return memorandum_settings.get("enabled", configured_enabled) is True


async def resolve_connector_tts_settings() -> dict[str, Any]:
    """解析 TTS 兼容设置；Desktop 返回空快照交由 Main Broker 注入，Server 返回 legacy 配置副本。"""

    if uses_private_connector_settings_snapshot():
        return {}

    settings = await load_settings()
    if not isinstance(settings, Mapping):
        return {}
    tts_settings = settings.get("ttsSettings", {})
    if not isinstance(tts_settings, Mapping):
        return {}
    return dict(tts_settings)
