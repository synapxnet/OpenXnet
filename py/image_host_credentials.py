# -*- coding: utf-8 -*-
"""Apply Main-scoped image-host credentials only inside Connector Worker."""

from __future__ import annotations

import base64
from copy import deepcopy
import json
import os
from typing import Any, Dict, Mapping


IMAGE_HOST_CREDENTIAL_ENV = "OPENXNET_IMAGE_HOST_CREDENTIALS_B64"
IMAGE_HOST_CREDENTIAL_SCHEMA = "openxnet.image-host-credentials.runtime.v1"
MAX_IMAGE_HOST_CREDENTIAL_BOOTSTRAP_BYTES = 128 * 1024
MAX_IMAGE_HOST_CREDENTIAL_LENGTH = 64 * 1024
IMAGE_HOST_CREDENTIAL_FIELDS = ("SMMS_api_key", "EI2_api_key")

_cached_credentials: Dict[str, str] | None = None
_runtime_credentials_enabled: bool | None = None


def _parse_secret(value: Any) -> str:
    """Parse one bounded single-line image-host credential."""

    if not isinstance(value, str):
        raise RuntimeError("Image-host credential value is invalid.")
    secret = value.strip()
    if (
        len(secret) < 4
        or len(secret) > MAX_IMAGE_HOST_CREDENTIAL_LENGTH
        or any(ord(character) < 32 or ord(character) == 127 for character in secret)
    ):
        raise RuntimeError("Image-host credential value is invalid.")
    return secret


def _load_runtime_credentials() -> Dict[str, str]:
    """Decode and cache the bounded image-host credential envelope from Main."""

    global _cached_credentials, _runtime_credentials_enabled
    if _cached_credentials is not None:
        return dict(_cached_credentials)
    encoded = str(os.environ.pop(IMAGE_HOST_CREDENTIAL_ENV, "") or "").strip()
    _runtime_credentials_enabled = bool(encoded)
    if not encoded:
        _cached_credentials = {}
        return {}
    try:
        decoded = base64.b64decode(encoded, validate=True)
        if len(decoded) > MAX_IMAGE_HOST_CREDENTIAL_BOOTSTRAP_BYTES:
            raise ValueError("Image-host credential bootstrap exceeds its byte budget.")
        payload = json.loads(decoded.decode("utf-8"))
    except Exception as error:
        raise RuntimeError("Image-host credential bootstrap is invalid.") from error
    if not isinstance(payload, Mapping) or set(payload) != {"schema", "credentials"}:
        raise RuntimeError("Image-host credential bootstrap fields are invalid.")
    if payload.get("schema") != IMAGE_HOST_CREDENTIAL_SCHEMA:
        raise RuntimeError("Image-host credential bootstrap schema is invalid.")
    raw_credentials = payload.get("credentials")
    if (
        not isinstance(raw_credentials, Mapping)
        or not set(raw_credentials).issubset(IMAGE_HOST_CREDENTIAL_FIELDS)
    ):
        raise RuntimeError("Image-host credential fields are invalid.")
    credentials = {
        str(field): _parse_secret(secret)
        for field, secret in raw_credentials.items()
    }
    _cached_credentials = credentials
    return dict(credentials)


def image_host_runtime_credentials_enabled() -> bool:
    """Return whether Main supplied the process-scoped image-host boundary."""

    if _runtime_credentials_enabled is None:
        _load_runtime_credentials()
    return bool(_runtime_credentials_enabled)


def apply_image_host_credentials(settings: Dict[str, Any]) -> Dict[str, Any]:
    """Hydrate image-host credentials into one in-memory settings document."""

    credentials = _load_runtime_credentials()
    if not image_host_runtime_credentials_enabled():
        return settings
    configuration = settings.get("BotConfig")
    if not isinstance(configuration, dict):
        return settings
    for field in IMAGE_HOST_CREDENTIAL_FIELDS:
        configuration[field] = credentials.get(field, "")
    configuration["imageHostCredentialFieldsConfigured"] = [
        field for field in IMAGE_HOST_CREDENTIAL_FIELDS if credentials.get(field)
    ]
    return settings


def redact_image_host_credentials_for_persistence(
    settings: Mapping[str, Any],
) -> Dict[str, Any]:
    """Return detached settings without Main-managed image-host credentials."""

    detached = deepcopy(dict(settings))
    if not image_host_runtime_credentials_enabled():
        return detached
    credentials = _load_runtime_credentials()
    configuration = detached.get("BotConfig")
    if not isinstance(configuration, dict):
        return detached
    for field in IMAGE_HOST_CREDENTIAL_FIELDS:
        configuration[field] = ""
    configuration["imageHostCredentialFieldsConfigured"] = [
        field for field in IMAGE_HOST_CREDENTIAL_FIELDS if credentials.get(field)
    ]
    return detached


def _reset_image_host_credentials_cache_for_tests() -> None:
    """Reset process credential state for isolated unit tests."""

    global _cached_credentials, _runtime_credentials_enabled
    _cached_credentials = None
    _runtime_credentials_enabled = None
