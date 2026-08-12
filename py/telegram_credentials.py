# -*- coding: utf-8 -*-
"""Apply Main-scoped Telegram credentials only inside trusted Python runtimes."""

from __future__ import annotations

import base64
from copy import deepcopy
import json
import os
from typing import Any, Dict, Mapping


TELEGRAM_CREDENTIAL_ENV = "OPENXNET_TELEGRAM_CREDENTIALS_B64"
TELEGRAM_CREDENTIAL_SCHEMA = "openxnet.telegram-credentials.runtime.v1"
MAX_TELEGRAM_CREDENTIAL_BOOTSTRAP_BYTES = 128 * 1024
MAX_TELEGRAM_BOT_TOKEN_LENGTH = 64 * 1024
TELEGRAM_SETTINGS_KEYS = ("telegramBotConfig", "telegramBot")

_cached_credentials: Dict[str, str] | None = None
_runtime_credentials_enabled: bool | None = None


def _parse_bot_token(value: Any) -> str:
    """Parse one bounded single-line Telegram Bot token."""

    if not isinstance(value, str):
        raise RuntimeError("Telegram Bot token is invalid.")
    token = value.strip()
    if (
        len(token) < 4
        or len(token) > MAX_TELEGRAM_BOT_TOKEN_LENGTH
        or any(ord(character) < 32 or ord(character) == 127 for character in token)
    ):
        raise RuntimeError("Telegram Bot token is invalid.")
    return token


def _load_runtime_credentials() -> Dict[str, str]:
    """Decode and cache the bounded Telegram credential envelope from Main."""

    global _cached_credentials, _runtime_credentials_enabled
    if _cached_credentials is not None:
        return dict(_cached_credentials)
    encoded = str(os.environ.pop(TELEGRAM_CREDENTIAL_ENV, "") or "").strip()
    _runtime_credentials_enabled = bool(encoded)
    if not encoded:
        _cached_credentials = {}
        return {}
    try:
        decoded = base64.b64decode(encoded, validate=True)
        if len(decoded) > MAX_TELEGRAM_CREDENTIAL_BOOTSTRAP_BYTES:
            raise ValueError("Telegram credential bootstrap exceeds its byte budget.")
        payload = json.loads(decoded.decode("utf-8"))
    except Exception as error:
        raise RuntimeError("Telegram credential bootstrap is invalid.") from error
    if not isinstance(payload, Mapping) or set(payload) != {"schema", "credentials"}:
        raise RuntimeError("Telegram credential bootstrap fields are invalid.")
    if payload.get("schema") != TELEGRAM_CREDENTIAL_SCHEMA:
        raise RuntimeError("Telegram credential bootstrap schema is invalid.")
    raw_credentials = payload.get("credentials")
    if not isinstance(raw_credentials, Mapping) or not set(raw_credentials).issubset({"botToken"}):
        raise RuntimeError("Telegram credential fields are invalid.")
    credentials: Dict[str, str] = {}
    if raw_credentials.get("botToken") is not None:
        credentials["botToken"] = _parse_bot_token(raw_credentials.get("botToken"))
    _cached_credentials = credentials
    return dict(credentials)


def telegram_runtime_credentials_enabled() -> bool:
    """Return whether Main supplied the process-scoped Telegram boundary."""

    if _runtime_credentials_enabled is None:
        _load_runtime_credentials()
    return bool(_runtime_credentials_enabled)


def apply_telegram_credential_to_configuration(
    configuration: Mapping[str, Any],
) -> Dict[str, Any]:
    """Hydrate one Telegram runtime configuration without mutating its input."""

    detached = deepcopy(dict(configuration))
    detached.pop("credentialFieldsConfigured", None)
    credentials = _load_runtime_credentials()
    if not telegram_runtime_credentials_enabled():
        return detached
    detached["bot_token"] = credentials.get("botToken", "")
    return detached


def apply_telegram_credentials(settings: Dict[str, Any]) -> Dict[str, Any]:
    """Hydrate Telegram credentials into one in-memory settings document."""

    credentials = _load_runtime_credentials()
    if not telegram_runtime_credentials_enabled():
        return settings
    token = credentials.get("botToken", "")
    for settings_key in TELEGRAM_SETTINGS_KEYS:
        configuration = settings.get(settings_key)
        if not isinstance(configuration, dict):
            continue
        configuration["bot_token"] = token
        configuration["credentialFieldsConfigured"] = ["bot_token"] if token else []
    return settings


def redact_telegram_credentials_for_persistence(
    settings: Mapping[str, Any],
) -> Dict[str, Any]:
    """Return detached settings without a Main-managed Telegram Bot token."""

    detached = deepcopy(dict(settings))
    if not telegram_runtime_credentials_enabled():
        return detached
    configured = bool(_load_runtime_credentials().get("botToken"))
    for settings_key in TELEGRAM_SETTINGS_KEYS:
        configuration = detached.get(settings_key)
        if not isinstance(configuration, dict):
            continue
        configuration["bot_token"] = ""
        configuration["credentialFieldsConfigured"] = ["bot_token"] if configured else []
    return detached


def _reset_telegram_credentials_cache_for_tests() -> None:
    """Reset process credential state for isolated unit tests."""

    global _cached_credentials, _runtime_credentials_enabled
    _cached_credentials = None
    _runtime_credentials_enabled = None
