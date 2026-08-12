# -*- coding: utf-8 -*-
"""只在 MCP Worker 或 Server 兼容 backend 内应用 Main 管理的 Home Assistant 凭据。"""

from __future__ import annotations

import base64
from copy import deepcopy
import json
import os
from typing import Any, Dict, Mapping


HOME_ASSISTANT_CREDENTIAL_ENV = "OPENXNET_HOME_ASSISTANT_CREDENTIALS_B64"
HOME_ASSISTANT_CREDENTIAL_SCHEMA = "openxnet.home-assistant-credentials.runtime.v1"
MAX_HOME_ASSISTANT_CREDENTIAL_BOOTSTRAP_BYTES = 96 * 1024
MAX_HOME_ASSISTANT_CREDENTIAL_LENGTH = 64 * 1024
HOME_ASSISTANT_CREDENTIAL_FIELDS = ("api_key",)

_cached_credentials: Dict[str, str] | None = None
_runtime_credentials_enabled: bool | None = None


def _parse_secret(value: Any) -> str:
    """Parse one bounded single-line Home Assistant credential."""

    if not isinstance(value, str):
        raise RuntimeError("Home Assistant credential value is invalid.")
    secret = value.strip()
    if (
        len(secret) < 4
        or len(secret) > MAX_HOME_ASSISTANT_CREDENTIAL_LENGTH
        or any(ord(character) < 32 or ord(character) == 127 for character in secret)
    ):
        raise RuntimeError("Home Assistant credential value is invalid.")
    return secret


def _load_runtime_credentials() -> Dict[str, str]:
    """Decode and cache the bounded Home Assistant credential envelope from Main."""

    global _cached_credentials, _runtime_credentials_enabled
    if _cached_credentials is not None:
        return dict(_cached_credentials)
    encoded = str(os.environ.pop(HOME_ASSISTANT_CREDENTIAL_ENV, "") or "").strip()
    _runtime_credentials_enabled = bool(encoded)
    if not encoded:
        _cached_credentials = {}
        return {}
    try:
        decoded = base64.b64decode(encoded, validate=True)
        if len(decoded) > MAX_HOME_ASSISTANT_CREDENTIAL_BOOTSTRAP_BYTES:
            raise ValueError("Home Assistant credential bootstrap exceeds its byte budget.")
        payload = json.loads(decoded.decode("utf-8"))
    except Exception as error:
        raise RuntimeError("Home Assistant credential bootstrap is invalid.") from error
    if not isinstance(payload, Mapping) or set(payload) != {"schema", "credentials"}:
        raise RuntimeError("Home Assistant credential bootstrap fields are invalid.")
    if payload.get("schema") != HOME_ASSISTANT_CREDENTIAL_SCHEMA:
        raise RuntimeError("Home Assistant credential bootstrap schema is invalid.")
    raw_credentials = payload.get("credentials")
    if (
        not isinstance(raw_credentials, Mapping)
        or not set(raw_credentials).issubset(HOME_ASSISTANT_CREDENTIAL_FIELDS)
    ):
        raise RuntimeError("Home Assistant credential fields are invalid.")
    credentials = {
        str(field): _parse_secret(secret)
        for field, secret in raw_credentials.items()
    }
    _cached_credentials = credentials
    return dict(credentials)


def home_assistant_runtime_credentials_enabled() -> bool:
    """Return whether Main supplied the process-scoped Home Assistant boundary."""

    if _runtime_credentials_enabled is None:
        _load_runtime_credentials()
    return bool(_runtime_credentials_enabled)


def hydrate_home_assistant_config(configuration: Mapping[str, Any]) -> Dict[str, Any]:
    """Hydrate one Home Assistant configuration with process-scoped credentials."""

    detached = deepcopy(dict(configuration))
    credentials = _load_runtime_credentials()
    if not home_assistant_runtime_credentials_enabled():
        return detached
    detached["api_key"] = credentials.get("api_key", "")
    detached["homeAssistantCredentialFieldsConfigured"] = [
        field for field in HOME_ASSISTANT_CREDENTIAL_FIELDS if credentials.get(field)
    ]
    return detached


def apply_home_assistant_credentials(settings: Dict[str, Any]) -> Dict[str, Any]:
    """Hydrate Home Assistant credentials into one in-memory settings document."""

    configuration = settings.get("HASettings")
    if not isinstance(configuration, dict):
        return settings
    settings["HASettings"] = hydrate_home_assistant_config(configuration)
    return settings


def redact_home_assistant_credentials_for_persistence(
    settings: Mapping[str, Any],
) -> Dict[str, Any]:
    """Return detached settings without Main-managed Home Assistant credentials."""

    detached = deepcopy(dict(settings))
    configuration = detached.get("HASettings")
    if not isinstance(configuration, dict):
        return detached
    if not home_assistant_runtime_credentials_enabled():
        return detached
    credentials = _load_runtime_credentials()
    configuration["api_key"] = ""
    configuration["homeAssistantCredentialFieldsConfigured"] = [
        field for field in HOME_ASSISTANT_CREDENTIAL_FIELDS if credentials.get(field)
    ]
    return detached


def _reset_home_assistant_credentials_cache_for_tests() -> None:
    """Reset process credential state for isolated unit tests."""

    global _cached_credentials, _runtime_credentials_enabled
    _cached_credentials = None
    _runtime_credentials_enabled = None
