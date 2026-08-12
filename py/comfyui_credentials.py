# -*- coding: utf-8 -*-
"""Apply Main-scoped ComfyUI credentials only inside authorized Python runtimes."""

from __future__ import annotations

import base64
from copy import deepcopy
import json
import os
from typing import Any, Dict, Mapping


COMFYUI_CREDENTIAL_ENV = "OPENXNET_COMFYUI_CREDENTIALS_B64"
COMFYUI_CREDENTIAL_SCHEMA = "openxnet.comfyui-credentials.runtime.v1"
MAX_COMFYUI_CREDENTIAL_BOOTSTRAP_BYTES = 96 * 1024
MAX_COMFYUI_CREDENTIAL_LENGTH = 64 * 1024
COMFYUI_CREDENTIAL_FIELDS = ("api_key",)

_cached_credentials: Dict[str, str] | None = None
_runtime_credentials_enabled: bool | None = None


def _parse_secret(value: Any) -> str:
    """Parse one bounded single-line ComfyUI credential."""

    if not isinstance(value, str):
        raise RuntimeError("ComfyUI credential value is invalid.")
    secret = value.strip()
    if (
        len(secret) < 4
        or len(secret) > MAX_COMFYUI_CREDENTIAL_LENGTH
        or any(ord(character) < 32 or ord(character) == 127 for character in secret)
    ):
        raise RuntimeError("ComfyUI credential value is invalid.")
    return secret


def _load_runtime_credentials() -> Dict[str, str]:
    """Decode and cache the bounded ComfyUI credential envelope from Main."""

    global _cached_credentials, _runtime_credentials_enabled
    if _cached_credentials is not None:
        return dict(_cached_credentials)
    encoded = str(os.environ.pop(COMFYUI_CREDENTIAL_ENV, "") or "").strip()
    _runtime_credentials_enabled = bool(encoded)
    if not encoded:
        _cached_credentials = {}
        return {}
    try:
        decoded = base64.b64decode(encoded, validate=True)
        if len(decoded) > MAX_COMFYUI_CREDENTIAL_BOOTSTRAP_BYTES:
            raise ValueError("ComfyUI credential bootstrap exceeds its byte budget.")
        payload = json.loads(decoded.decode("utf-8"))
    except Exception as error:
        raise RuntimeError("ComfyUI credential bootstrap is invalid.") from error
    if not isinstance(payload, Mapping) or set(payload) != {"schema", "credentials"}:
        raise RuntimeError("ComfyUI credential bootstrap fields are invalid.")
    if payload.get("schema") != COMFYUI_CREDENTIAL_SCHEMA:
        raise RuntimeError("ComfyUI credential bootstrap schema is invalid.")
    raw_credentials = payload.get("credentials")
    if (
        not isinstance(raw_credentials, Mapping)
        or not set(raw_credentials).issubset(COMFYUI_CREDENTIAL_FIELDS)
    ):
        raise RuntimeError("ComfyUI credential fields are invalid.")
    credentials = {
        str(field): _parse_secret(secret)
        for field, secret in raw_credentials.items()
    }
    _cached_credentials = credentials
    return dict(credentials)


def comfyui_runtime_credentials_enabled() -> bool:
    """Return whether Main supplied the process-scoped ComfyUI boundary."""

    if _runtime_credentials_enabled is None:
        _load_runtime_credentials()
    return bool(_runtime_credentials_enabled)


def hydrate_comfyui_settings(settings: Mapping[str, Any]) -> Dict[str, Any]:
    """Hydrate one settings document with process-scoped ComfyUI credentials."""

    detached = deepcopy(dict(settings))
    credentials = _load_runtime_credentials()
    if not comfyui_runtime_credentials_enabled():
        return detached
    detached["comfyuiAPIkey"] = credentials.get("api_key", "")
    detached["comfyuiCredentialFieldsConfigured"] = [
        field for field in COMFYUI_CREDENTIAL_FIELDS if credentials.get(field)
    ]
    return detached


def apply_comfyui_credentials(settings: Dict[str, Any]) -> Dict[str, Any]:
    """Hydrate ComfyUI credentials into one in-memory settings document."""

    hydrated = hydrate_comfyui_settings(settings)
    settings.clear()
    settings.update(hydrated)
    return settings


def redact_comfyui_credentials_for_persistence(
    settings: Mapping[str, Any],
) -> Dict[str, Any]:
    """Return detached settings without Main-managed ComfyUI credentials."""

    detached = deepcopy(dict(settings))
    if not comfyui_runtime_credentials_enabled():
        return detached
    credentials = _load_runtime_credentials()
    detached["comfyuiAPIkey"] = ""
    detached["comfyuiCredentialFieldsConfigured"] = [
        field for field in COMFYUI_CREDENTIAL_FIELDS if credentials.get(field)
    ]
    return detached


def _reset_comfyui_credentials_cache_for_tests() -> None:
    """Reset process credential state for isolated unit tests."""

    global _cached_credentials, _runtime_credentials_enabled
    _cached_credentials = None
    _runtime_credentials_enabled = None
