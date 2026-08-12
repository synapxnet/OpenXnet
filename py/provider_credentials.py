# -*- coding: utf-8 -*-
"""Apply Main-scoped provider credentials only inside trusted Python runtimes."""

from __future__ import annotations

import base64
from copy import deepcopy
import json
import os
from typing import Any, Dict, Mapping


PROVIDER_CREDENTIAL_ENV = "OPENXNET_PROVIDER_CREDENTIALS_B64"
PROVIDER_CREDENTIAL_SCHEMA = "openxnet.provider-credentials.runtime.v1"
MAX_PROVIDER_CREDENTIAL_BOOTSTRAP_BYTES = 20 * 1024
MAX_PROVIDER_COUNT = 128
MAX_PROVIDER_SECRET_LENGTH = 65_536

_cached_credentials: Dict[str, str] | None = None
_runtime_credentials_enabled: bool | None = None


def _load_runtime_credentials() -> Dict[str, str]:
    """Decode and cache the bounded provider credential envelope from Main."""

    global _cached_credentials, _runtime_credentials_enabled
    if _cached_credentials is not None:
        return dict(_cached_credentials)

    encoded = str(os.environ.pop(PROVIDER_CREDENTIAL_ENV, "") or "").strip()
    _runtime_credentials_enabled = bool(encoded)
    if not encoded:
        _cached_credentials = {}
        return {}
    try:
        decoded = base64.b64decode(encoded, validate=True)
        if len(decoded) > MAX_PROVIDER_CREDENTIAL_BOOTSTRAP_BYTES:
            raise ValueError("Provider credential bootstrap exceeds its byte budget.")
        payload = json.loads(decoded.decode("utf-8"))
    except Exception as error:
        raise RuntimeError("Provider credential bootstrap is invalid.") from error
    if not isinstance(payload, Mapping) or set(payload) != {"schema", "credentials"}:
        raise RuntimeError("Provider credential bootstrap fields are invalid.")
    if payload.get("schema") != PROVIDER_CREDENTIAL_SCHEMA:
        raise RuntimeError("Provider credential bootstrap schema is invalid.")
    raw_credentials = payload.get("credentials")
    if not isinstance(raw_credentials, Mapping) or len(raw_credentials) > MAX_PROVIDER_COUNT:
        raise RuntimeError("Provider credential bootstrap entries are invalid.")

    credentials: Dict[str, str] = {}
    for raw_id, raw_secret in raw_credentials.items():
        provider_id = str(raw_id or "").strip()
        secret = str(raw_secret or "").strip()
        if (
            not provider_id
            or len(provider_id) > 128
            or len(secret) > MAX_PROVIDER_SECRET_LENGTH
            or any(ord(character) < 32 or ord(character) == 127 for character in provider_id)
        ):
            raise RuntimeError("Provider credential bootstrap entry is invalid.")
        if secret:
            credentials[provider_id] = secret
    _cached_credentials = credentials
    return dict(credentials)


def provider_runtime_credentials_enabled() -> bool:
    """Return whether Main supplied the process-scoped provider credential boundary."""

    if _runtime_credentials_enabled is None:
        _load_runtime_credentials()
    return bool(_runtime_credentials_enabled)


def _apply_selected_provider_credentials(value: Any, credentials: Mapping[str, str]) -> None:
    """Recursively hydrate copied api_key fields from one selected provider ID."""

    if isinstance(value, list):
        for item in value:
            _apply_selected_provider_credentials(item, credentials)
        return
    if not isinstance(value, dict):
        return
    provider_id = str(value.get("selectedProvider") or "").strip()
    if provider_id and provider_id in credentials:
        value["api_key"] = credentials[provider_id]
        value["api_key_configured"] = True
    for child in value.values():
        _apply_selected_provider_credentials(child, credentials)


def apply_provider_credentials(settings: Dict[str, Any]) -> Dict[str, Any]:
    """Hydrate provider secrets into one in-memory settings document."""

    credentials = _load_runtime_credentials()
    providers = settings.get("modelProviders")
    if isinstance(providers, list):
        for provider in providers:
            if not isinstance(provider, dict):
                continue
            provider_id = str(provider.get("id") or "").strip()
            provider["apiKey"] = credentials.get(provider_id, "")
            provider["apiKeyConfigured"] = provider_id in credentials
    _apply_selected_provider_credentials(settings, credentials)
    return settings


def _redact_selected_provider_credentials(value: Any, configured_ids: set[str]) -> None:
    """Recursively clear copied api_key fields before persistence."""

    if isinstance(value, list):
        for item in value:
            _redact_selected_provider_credentials(item, configured_ids)
        return
    if not isinstance(value, dict):
        return
    provider_id = str(value.get("selectedProvider") or "").strip()
    if provider_id and ("api_key" in value or provider_id in configured_ids):
        value["api_key"] = ""
        value["api_key_configured"] = provider_id in configured_ids
    for child in value.values():
        _redact_selected_provider_credentials(child, configured_ids)


def redact_provider_credentials_for_persistence(settings: Mapping[str, Any]) -> Dict[str, Any]:
    """Return a detached settings document without Main-managed provider secrets."""

    detached = deepcopy(dict(settings))
    if not provider_runtime_credentials_enabled():
        return detached
    credentials = _load_runtime_credentials()
    configured_ids = set(credentials)
    providers = detached.get("modelProviders")
    if isinstance(providers, list):
        for provider in providers:
            if not isinstance(provider, dict):
                continue
            provider_id = str(provider.get("id") or "").strip()
            provider["apiKey"] = ""
            provider["apiKeyConfigured"] = provider_id in configured_ids
    _redact_selected_provider_credentials(detached, configured_ids)
    return detached
