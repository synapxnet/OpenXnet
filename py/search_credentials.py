# -*- coding: utf-8 -*-
"""Apply Main-scoped search credentials only inside trusted Python runtimes."""

from __future__ import annotations

import base64
from copy import deepcopy
import json
import os
from typing import Any, Dict, Mapping


SEARCH_CREDENTIAL_ENV = "OPENXNET_SEARCH_CREDENTIALS_B64"
SEARCH_CREDENTIAL_SCHEMA = "openxnet.search-credentials.runtime.v1"
MAX_SEARCH_CREDENTIAL_BOOTSTRAP_BYTES = 64 * 1024
MAX_SEARCH_SECRET_LENGTH = 16_384
SEARCH_CREDENTIAL_FIELDS = {
    "tavily": "tavily_api_key",
    "jina": "jina_api_key",
    "crawl4ai": "Crawl4Ai_api_key",
    "bing": "bing_api_key",
    "google": "google_api_key",
    "brave": "brave_api_key",
    "exa": "exa_api_key",
    "serper": "serper_api_key",
    "bochaai": "bochaai_api_key",
    "firecrawl": "firecrawl_api_key",
}

_cached_credentials: Dict[str, str] | None = None
_runtime_credentials_enabled: bool | None = None


def _load_runtime_credentials() -> Dict[str, str]:
    """Decode and cache the bounded search credential envelope from Main."""

    global _cached_credentials, _runtime_credentials_enabled
    if _cached_credentials is not None:
        return dict(_cached_credentials)

    encoded = str(os.environ.pop(SEARCH_CREDENTIAL_ENV, "") or "").strip()
    _runtime_credentials_enabled = bool(encoded)
    if not encoded:
        _cached_credentials = {}
        return {}
    try:
        decoded = base64.b64decode(encoded, validate=True)
        if len(decoded) > MAX_SEARCH_CREDENTIAL_BOOTSTRAP_BYTES:
            raise ValueError("Search credential bootstrap exceeds its byte budget.")
        payload = json.loads(decoded.decode("utf-8"))
    except Exception as error:
        raise RuntimeError("Search credential bootstrap is invalid.") from error
    if not isinstance(payload, Mapping) or set(payload) != {"schema", "credentials"}:
        raise RuntimeError("Search credential bootstrap fields are invalid.")
    if payload.get("schema") != SEARCH_CREDENTIAL_SCHEMA:
        raise RuntimeError("Search credential bootstrap schema is invalid.")
    raw_credentials = payload.get("credentials")
    if not isinstance(raw_credentials, Mapping) or len(raw_credentials) > len(SEARCH_CREDENTIAL_FIELDS):
        raise RuntimeError("Search credential bootstrap entries are invalid.")

    credentials: Dict[str, str] = {}
    for raw_id, raw_secret in raw_credentials.items():
        credential_id = str(raw_id or "").strip()
        secret = str(raw_secret or "").strip()
        if (
            credential_id not in SEARCH_CREDENTIAL_FIELDS
            or len(secret) > MAX_SEARCH_SECRET_LENGTH
            or any(ord(character) < 32 or ord(character) == 127 for character in secret)
        ):
            raise RuntimeError("Search credential bootstrap entry is invalid.")
        if secret:
            credentials[credential_id] = secret
    _cached_credentials = credentials
    return dict(credentials)


def search_runtime_credentials_enabled() -> bool:
    """Return whether Main supplied the process-scoped search credential boundary."""

    if _runtime_credentials_enabled is None:
        _load_runtime_credentials()
    return bool(_runtime_credentials_enabled)


def apply_search_credentials(settings: Dict[str, Any]) -> Dict[str, Any]:
    """Hydrate search credentials into one in-memory settings document."""

    credentials = _load_runtime_credentials()
    if not search_runtime_credentials_enabled():
        return settings
    web_search = settings.get("webSearch")
    if not isinstance(web_search, dict):
        web_search = {}
        settings["webSearch"] = web_search
    for credential_id, field in SEARCH_CREDENTIAL_FIELDS.items():
        web_search[field] = credentials.get(credential_id, "")
        web_search[f"{field}_configured"] = credential_id in credentials
    return settings


def redact_search_credentials_for_persistence(settings: Mapping[str, Any]) -> Dict[str, Any]:
    """Return detached settings without Main-managed search credentials."""

    detached = deepcopy(dict(settings))
    if not search_runtime_credentials_enabled():
        return detached
    credentials = _load_runtime_credentials()
    web_search = detached.get("webSearch")
    if not isinstance(web_search, dict):
        return detached
    for credential_id, field in SEARCH_CREDENTIAL_FIELDS.items():
        web_search[field] = ""
        web_search[f"{field}_configured"] = credential_id in credentials
    return detached


def _reset_search_credentials_cache_for_tests() -> None:
    """Reset module caches so tests can isolate environment envelopes."""

    global _cached_credentials, _runtime_credentials_enabled
    _cached_credentials = None
    _runtime_credentials_enabled = None
