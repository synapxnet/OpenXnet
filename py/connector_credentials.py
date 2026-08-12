# -*- coding: utf-8 -*-
"""Apply Main-scoped credentials only inside the optional Connector Worker."""

from __future__ import annotations

import base64
from copy import deepcopy
import json
import os
from typing import Any, Dict, Mapping


CONNECTOR_CREDENTIAL_ENV = "OPENXNET_CONNECTOR_CREDENTIALS_B64"
CONNECTOR_CREDENTIAL_SCHEMA = "openxnet.connector-credentials.runtime.v1"
MAX_CONNECTOR_CREDENTIAL_BOOTSTRAP_BYTES = 512 * 1024
MAX_CONNECTOR_CREDENTIAL_LENGTH = 64 * 1024
CONNECTOR_CREDENTIAL_FIELDS = {
    "qq": ("secret",),
    "feishu": ("secret",),
    "dingtalk": ("appSecret",),
    "discord": ("token",),
    "slack": ("bot_token", "app_token"),
}

_cached_credentials: Dict[str, Dict[str, str]] | None = None
_runtime_credentials_enabled: bool | None = None


def _parse_secret(value: Any) -> str:
    """Parse one bounded single-line Connector Worker credential."""

    if not isinstance(value, str):
        raise RuntimeError("Connector Worker credential value is invalid.")
    secret = value.strip()
    if (
        len(secret) < 4
        or len(secret) > MAX_CONNECTOR_CREDENTIAL_LENGTH
        or any(ord(character) < 32 or ord(character) == 127 for character in secret)
    ):
        raise RuntimeError("Connector Worker credential value is invalid.")
    return secret


def _load_runtime_credentials() -> Dict[str, Dict[str, str]]:
    """Decode and cache the bounded Connector Worker credential envelope."""

    global _cached_credentials, _runtime_credentials_enabled
    if _cached_credentials is not None:
        return deepcopy(_cached_credentials)
    encoded = str(os.environ.pop(CONNECTOR_CREDENTIAL_ENV, "") or "").strip()
    _runtime_credentials_enabled = bool(encoded)
    if not encoded:
        _cached_credentials = {}
        return {}
    try:
        decoded = base64.b64decode(encoded, validate=True)
        if len(decoded) > MAX_CONNECTOR_CREDENTIAL_BOOTSTRAP_BYTES:
            raise ValueError("Connector Worker credential bootstrap exceeds its byte budget.")
        payload = json.loads(decoded.decode("utf-8"))
    except Exception as error:
        raise RuntimeError("Connector Worker credential bootstrap is invalid.") from error
    if not isinstance(payload, Mapping) or set(payload) != {"schema", "credentials"}:
        raise RuntimeError("Connector Worker credential bootstrap fields are invalid.")
    if payload.get("schema") != CONNECTOR_CREDENTIAL_SCHEMA:
        raise RuntimeError("Connector Worker credential bootstrap schema is invalid.")
    raw_credentials = payload.get("credentials")
    if not isinstance(raw_credentials, Mapping):
        raise RuntimeError("Connector Worker credential map is invalid.")

    credentials: Dict[str, Dict[str, str]] = {}
    for raw_platform, raw_fields in raw_credentials.items():
        if raw_platform not in CONNECTOR_CREDENTIAL_FIELDS or not isinstance(raw_fields, Mapping):
            raise RuntimeError("Connector Worker credential platform is invalid.")
        if not set(raw_fields).issubset(CONNECTOR_CREDENTIAL_FIELDS[raw_platform]):
            raise RuntimeError("Connector Worker credential field is invalid.")
        fields = {
            str(field): _parse_secret(secret)
            for field, secret in raw_fields.items()
        }
        if fields:
            credentials[str(raw_platform)] = fields
    _cached_credentials = credentials
    return deepcopy(credentials)


def connector_runtime_credentials_enabled() -> bool:
    """Return whether Main supplied the process-scoped Connector Worker boundary."""

    if _runtime_credentials_enabled is None:
        _load_runtime_credentials()
    return bool(_runtime_credentials_enabled)


def apply_connector_credentials(
    platform: str,
    configuration: Mapping[str, Any],
) -> Dict[str, Any]:
    """Hydrate one Connector Worker configuration without mutating its input."""

    detached = deepcopy(dict(configuration))
    detached.pop("credentialFieldsConfigured", None)
    credentials = _load_runtime_credentials()
    if not connector_runtime_credentials_enabled():
        return detached
    if platform not in CONNECTOR_CREDENTIAL_FIELDS:
        raise RuntimeError("Connector Worker credential platform is invalid.")
    fields = credentials.get(platform, {})
    for field, secret in fields.items():
        detached[field] = secret
    return detached


def _reset_connector_credentials_cache_for_tests() -> None:
    """Reset process credential state for isolated unit tests."""

    global _cached_credentials, _runtime_credentials_enabled
    _cached_credentials = None
    _runtime_credentials_enabled = None
