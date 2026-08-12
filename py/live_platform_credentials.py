# -*- coding: utf-8 -*-
"""仅在 Live Worker 和 Server 兼容后端内注入 Main 管理的直播凭据。"""

from __future__ import annotations

import base64
from copy import deepcopy
import json
import os
from typing import Any, Dict, Mapping


LIVE_PLATFORM_CREDENTIAL_ENV = "OPENXNET_LIVE_PLATFORM_CREDENTIALS_B64"
LIVE_PLATFORM_CREDENTIAL_SCHEMA = "openxnet.live-platform-credentials.runtime.v1"
MAX_LIVE_PLATFORM_CREDENTIAL_BOOTSTRAP_BYTES = 384 * 1024
MAX_LIVE_PLATFORM_CREDENTIAL_LENGTH = 64 * 1024
LIVE_PLATFORM_CREDENTIAL_FIELDS = (
    "bilibili_sessdata",
    "bilibili_ACCESS_KEY_SECRET",
    "bilibili_ROOM_OWNER_AUTH_CODE",
    "youtube_api_key",
    "twitch_access_token",
)

_cached_credentials: Dict[str, str] | None = None
_runtime_credentials_enabled: bool | None = None


def _parse_secret(value: Any) -> str:
    """Parse one bounded single-line live-platform credential."""

    if not isinstance(value, str):
        raise RuntimeError("Live-platform credential value is invalid.")
    secret = value.strip()
    if (
        len(secret) < 4
        or len(secret) > MAX_LIVE_PLATFORM_CREDENTIAL_LENGTH
        or any(ord(character) < 32 or ord(character) == 127 for character in secret)
    ):
        raise RuntimeError("Live-platform credential value is invalid.")
    return secret


def _load_runtime_credentials() -> Dict[str, str]:
    """Decode and cache the bounded live-platform credential envelope from Main."""

    global _cached_credentials, _runtime_credentials_enabled
    if _cached_credentials is not None:
        return dict(_cached_credentials)
    encoded = str(os.environ.pop(LIVE_PLATFORM_CREDENTIAL_ENV, "") or "").strip()
    _runtime_credentials_enabled = bool(encoded)
    if not encoded:
        _cached_credentials = {}
        return {}
    try:
        decoded = base64.b64decode(encoded, validate=True)
        if len(decoded) > MAX_LIVE_PLATFORM_CREDENTIAL_BOOTSTRAP_BYTES:
            raise ValueError("Live-platform credential bootstrap exceeds its byte budget.")
        payload = json.loads(decoded.decode("utf-8"))
    except Exception as error:
        raise RuntimeError("Live-platform credential bootstrap is invalid.") from error
    if not isinstance(payload, Mapping) or set(payload) != {"schema", "credentials"}:
        raise RuntimeError("Live-platform credential bootstrap fields are invalid.")
    if payload.get("schema") != LIVE_PLATFORM_CREDENTIAL_SCHEMA:
        raise RuntimeError("Live-platform credential bootstrap schema is invalid.")
    raw_credentials = payload.get("credentials")
    if (
        not isinstance(raw_credentials, Mapping)
        or not set(raw_credentials).issubset(LIVE_PLATFORM_CREDENTIAL_FIELDS)
    ):
        raise RuntimeError("Live-platform credential fields are invalid.")
    credentials = {
        str(field): _parse_secret(secret)
        for field, secret in raw_credentials.items()
    }
    _cached_credentials = credentials
    return dict(credentials)


def live_platform_runtime_credentials_enabled() -> bool:
    """Return whether Main supplied the process-scoped live-platform boundary."""

    if _runtime_credentials_enabled is None:
        _load_runtime_credentials()
    return bool(_runtime_credentials_enabled)


def normalize_live_platform_metadata(configuration: Mapping[str, Any]) -> Dict[str, Any]:
    """Return detached live metadata with canonical provider identifiers."""

    detached = deepcopy(dict(configuration))
    video_id = str(detached.get("youtube_video_id", "") or "").strip()
    legacy_video_id = str(detached.get("youtube_vedio_id", "") or "").strip()
    detached["youtube_video_id"] = video_id or legacy_video_id
    detached.pop("youtube_vedio_id", None)
    if detached.get("bilibili_type") == "open_live":
        detached["bilibili_type"] = "open"
    return detached


def hydrate_live_platform_config(configuration: Mapping[str, Any]) -> Dict[str, Any]:
    """Hydrate one live route configuration with process-scoped credentials."""

    detached = normalize_live_platform_metadata(configuration)
    credentials = _load_runtime_credentials()
    if not live_platform_runtime_credentials_enabled():
        return detached
    for field in LIVE_PLATFORM_CREDENTIAL_FIELDS:
        detached[field] = credentials.get(field, "")
    detached["liveCredentialFieldsConfigured"] = [
        field for field in LIVE_PLATFORM_CREDENTIAL_FIELDS if credentials.get(field)
    ]
    return detached


def apply_live_platform_credentials(settings: Dict[str, Any]) -> Dict[str, Any]:
    """Hydrate live-platform credentials into one in-memory settings document."""

    configuration = settings.get("liveConfig")
    if not isinstance(configuration, dict):
        return settings
    settings["liveConfig"] = hydrate_live_platform_config(configuration)
    return settings


def redact_live_platform_credentials_for_persistence(
    settings: Mapping[str, Any],
) -> Dict[str, Any]:
    """Return detached settings without Main-managed live-platform credentials."""

    detached = deepcopy(dict(settings))
    configuration = detached.get("liveConfig")
    if not isinstance(configuration, dict):
        return detached
    detached["liveConfig"] = normalize_live_platform_metadata(configuration)
    if not live_platform_runtime_credentials_enabled():
        return detached
    credentials = _load_runtime_credentials()
    normalized = detached["liveConfig"]
    for field in LIVE_PLATFORM_CREDENTIAL_FIELDS:
        normalized[field] = ""
    normalized["liveCredentialFieldsConfigured"] = [
        field for field in LIVE_PLATFORM_CREDENTIAL_FIELDS if credentials.get(field)
    ]
    return detached


def _reset_live_platform_credentials_cache_for_tests() -> None:
    """Reset process credential state for isolated unit tests."""

    global _cached_credentials, _runtime_credentials_enabled
    _cached_credentials = None
    _runtime_credentials_enabled = None
