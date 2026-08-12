# -*- coding: utf-8 -*-
"""Apply Main-scoped code-sandbox credentials inside authorized Python runtimes."""

from __future__ import annotations

import base64
from copy import deepcopy
import json
import os
from typing import Any, Dict, Mapping


CODE_SANDBOX_CREDENTIAL_ENV = "OPENXNET_CODE_SANDBOX_CREDENTIALS_B64"
CODE_SANDBOX_CREDENTIAL_SCHEMA = "openxnet.code-sandbox-credentials.runtime.v1"
MAX_CODE_SANDBOX_CREDENTIAL_BOOTSTRAP_BYTES = 96 * 1024
MAX_CODE_SANDBOX_CREDENTIAL_LENGTH = 64 * 1024
CODE_SANDBOX_CREDENTIAL_FIELDS = ("e2b_api_key",)

_cached_credentials: Dict[str, str] | None = None
_runtime_credentials_enabled: bool | None = None


def _parse_secret(value: Any) -> str:
    """Parse one bounded single-line code-sandbox credential."""

    if not isinstance(value, str):
        raise RuntimeError("Code-sandbox credential value is invalid.")
    secret = value.strip()
    if (
        len(secret) < 4
        or len(secret) > MAX_CODE_SANDBOX_CREDENTIAL_LENGTH
        or any(ord(character) < 32 or ord(character) == 127 for character in secret)
    ):
        raise RuntimeError("Code-sandbox credential value is invalid.")
    return secret


def _load_runtime_credentials() -> Dict[str, str]:
    """Decode and cache the bounded code-sandbox credential envelope from Main."""

    global _cached_credentials, _runtime_credentials_enabled
    if _cached_credentials is not None:
        return dict(_cached_credentials)
    encoded = str(os.environ.pop(CODE_SANDBOX_CREDENTIAL_ENV, "") or "").strip()
    _runtime_credentials_enabled = bool(encoded)
    if not encoded:
        _cached_credentials = {}
        return {}
    try:
        decoded = base64.b64decode(encoded, validate=True)
        if len(decoded) > MAX_CODE_SANDBOX_CREDENTIAL_BOOTSTRAP_BYTES:
            raise ValueError("Code-sandbox credential bootstrap exceeds its byte budget.")
        payload = json.loads(decoded.decode("utf-8"))
    except Exception as error:
        raise RuntimeError("Code-sandbox credential bootstrap is invalid.") from error
    if not isinstance(payload, Mapping) or set(payload) != {"schema", "credentials"}:
        raise RuntimeError("Code-sandbox credential bootstrap fields are invalid.")
    if payload.get("schema") != CODE_SANDBOX_CREDENTIAL_SCHEMA:
        raise RuntimeError("Code-sandbox credential bootstrap schema is invalid.")
    raw_credentials = payload.get("credentials")
    if (
        not isinstance(raw_credentials, Mapping)
        or not set(raw_credentials).issubset(CODE_SANDBOX_CREDENTIAL_FIELDS)
    ):
        raise RuntimeError("Code-sandbox credential fields are invalid.")
    credentials = {
        str(field): _parse_secret(secret)
        for field, secret in raw_credentials.items()
    }
    _cached_credentials = credentials
    return dict(credentials)


def code_sandbox_runtime_credentials_enabled() -> bool:
    """Return whether Main supplied the process-scoped code-sandbox boundary."""

    if _runtime_credentials_enabled is None:
        _load_runtime_credentials()
    return bool(_runtime_credentials_enabled)


def hydrate_code_sandbox_config(configuration: Mapping[str, Any]) -> Dict[str, Any]:
    """Hydrate one code-sandbox configuration with process-scoped credentials."""

    detached = deepcopy(dict(configuration))
    credentials = _load_runtime_credentials()
    if not code_sandbox_runtime_credentials_enabled():
        return detached
    detached["e2b_api_key"] = credentials.get("e2b_api_key", "")
    detached["codeSandboxCredentialFieldsConfigured"] = [
        field for field in CODE_SANDBOX_CREDENTIAL_FIELDS if credentials.get(field)
    ]
    return detached


def apply_code_sandbox_credentials(settings: Dict[str, Any]) -> Dict[str, Any]:
    """Hydrate code-sandbox credentials into one in-memory settings document."""

    configuration = settings.get("codeSettings")
    if not isinstance(configuration, dict):
        return settings
    settings["codeSettings"] = hydrate_code_sandbox_config(configuration)
    return settings


def redact_code_sandbox_credentials_for_persistence(
    settings: Mapping[str, Any],
) -> Dict[str, Any]:
    """Return detached settings without Main-managed code-sandbox credentials."""

    detached = deepcopy(dict(settings))
    configuration = detached.get("codeSettings")
    if not isinstance(configuration, dict):
        return detached
    if not code_sandbox_runtime_credentials_enabled():
        return detached
    credentials = _load_runtime_credentials()
    configuration["e2b_api_key"] = ""
    configuration["codeSandboxCredentialFieldsConfigured"] = [
        field for field in CODE_SANDBOX_CREDENTIAL_FIELDS if credentials.get(field)
    ]
    return detached


def _reset_code_sandbox_credentials_cache_for_tests() -> None:
    """Reset process credential state for isolated unit tests."""

    global _cached_credentials, _runtime_credentials_enabled
    _cached_credentials = None
    _runtime_credentials_enabled = None
