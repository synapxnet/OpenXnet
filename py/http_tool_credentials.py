# -*- coding: utf-8 -*-
"""Apply Main-scoped custom HTTP credentials inside trusted Python runtimes."""

from __future__ import annotations

import base64
from copy import deepcopy
import json
import os
import re
from typing import Any, Dict, Mapping, MutableMapping


HTTP_TOOL_CREDENTIAL_ENV = "OPENXNET_HTTP_TOOL_CREDENTIALS_B64"
HTTP_TOOL_CREDENTIAL_SCHEMA = "openxnet.http-tool-credentials.runtime.v1"
MAX_HTTP_TOOL_CREDENTIAL_BOOTSTRAP_BYTES = 2 * 1024 * 1024
MAX_HTTP_TOOL_COUNT = 128
MAX_HTTP_HEADER_COUNT = 128
MAX_HTTP_TOOL_SCOPE_LENGTH = 256
MAX_HTTP_TOOL_SECRET_LENGTH = 128 * 1024

_cached_credentials: Dict[str, Dict[str, str]] | None = None
_runtime_credentials_enabled: bool | None = None


def _parse_scope(value: Any) -> str:
    """Parse one exact bounded custom HTTP tool identifier."""

    if not isinstance(value, str) or value != value.strip():
        raise RuntimeError("Custom HTTP credential scope is invalid.")
    if (
        not value
        or len(value) > MAX_HTTP_TOOL_SCOPE_LENGTH
        or any(ord(character) < 32 or ord(character) == 127 for character in value)
    ):
        raise RuntimeError("Custom HTTP credential scope is invalid.")
    return value


def _parse_header_name(value: Any) -> str:
    """Parse one RFC token-compatible custom HTTP header name."""

    if isinstance(value, str) and re.fullmatch(r"[!#$%&'*+.^_`|~0-9A-Za-z-]{1,256}", value):
        return value
    raise RuntimeError("Custom HTTP credential header name is invalid.")


def _parse_secret(value: Any) -> str:
    """Parse one bounded custom HTTP header credential."""

    if not isinstance(value, str):
        raise RuntimeError("Custom HTTP credential value is invalid.")
    secret = value.strip()
    if (
        not secret
        or len(secret) > MAX_HTTP_TOOL_SECRET_LENGTH
        or any(ord(character) < 32 or ord(character) == 127 for character in secret)
    ):
        raise RuntimeError("Custom HTTP credential value is invalid.")
    return secret


def _load_runtime_credentials() -> Dict[str, Dict[str, str]]:
    """Decode and cache the bounded custom HTTP credential envelope from Main."""

    global _cached_credentials, _runtime_credentials_enabled
    if _cached_credentials is not None:
        return deepcopy(_cached_credentials)
    encoded = str(os.environ.pop(HTTP_TOOL_CREDENTIAL_ENV, "") or "").strip()
    _runtime_credentials_enabled = bool(encoded)
    if not encoded:
        _cached_credentials = {}
        return {}
    try:
        decoded = base64.b64decode(encoded, validate=True)
        if len(decoded) > MAX_HTTP_TOOL_CREDENTIAL_BOOTSTRAP_BYTES:
            raise ValueError("Custom HTTP credential bootstrap exceeds its byte budget.")
        payload = json.loads(decoded.decode("utf-8"))
    except Exception as error:
        raise RuntimeError("Custom HTTP credential bootstrap is invalid.") from error
    if not isinstance(payload, Mapping) or set(payload) != {"schema", "credentials"}:
        raise RuntimeError("Custom HTTP credential bootstrap fields are invalid.")
    if payload.get("schema") != HTTP_TOOL_CREDENTIAL_SCHEMA:
        raise RuntimeError("Custom HTTP credential bootstrap schema is invalid.")
    raw_credentials = payload.get("credentials")
    if not isinstance(raw_credentials, Mapping) or len(raw_credentials) > MAX_HTTP_TOOL_COUNT:
        raise RuntimeError("Custom HTTP credential bootstrap tools are invalid.")
    credentials: Dict[str, Dict[str, str]] = {}
    for raw_tool_id, raw_headers in raw_credentials.items():
        tool_id = _parse_scope(raw_tool_id)
        if not isinstance(raw_headers, Mapping) or len(raw_headers) > MAX_HTTP_HEADER_COUNT:
            raise RuntimeError("Custom HTTP credential headers are invalid.")
        headers: Dict[str, str] = {}
        for raw_name, raw_secret in raw_headers.items():
            headers[_parse_header_name(raw_name)] = _parse_secret(raw_secret)
        if headers:
            credentials[tool_id] = headers
    _cached_credentials = credentials
    return deepcopy(credentials)


def http_tool_runtime_credentials_enabled() -> bool:
    """Return whether Main supplied the process-scoped custom HTTP boundary."""

    if _runtime_credentials_enabled is None:
        _load_runtime_credentials()
    return bool(_runtime_credentials_enabled)


def _parse_headers(value: Any) -> Dict[str, Any]:
    """Parse one custom HTTP headers field into a detached object."""

    if value is None or value == "":
        return {}
    if isinstance(value, Mapping):
        return deepcopy(dict(value))
    if not isinstance(value, str):
        return {}
    try:
        parsed = json.loads(value)
    except Exception:
        return {}
    return deepcopy(dict(parsed)) if isinstance(parsed, Mapping) else {}


def apply_http_tool_credentials(settings: Dict[str, Any]) -> Dict[str, Any]:
    """Hydrate custom HTTP sensitive headers into one in-memory settings view."""

    credentials = _load_runtime_credentials()
    if not http_tool_runtime_credentials_enabled():
        return settings
    tools = settings.get("custom_http")
    if not isinstance(tools, list):
        return settings
    for tool in tools:
        if not isinstance(tool, MutableMapping):
            continue
        tool_id = str(tool.get("id") or "").strip()
        headers = _parse_headers(tool.get("headers"))
        for name, secret in credentials.get(tool_id, {}).items():
            headers[name] = secret
        tool["headers"] = json.dumps(headers, ensure_ascii=False, indent=2)
        tool["headerCredentialsConfigured"] = sorted(credentials.get(tool_id, {}))
    return settings


def redact_http_tool_credentials_for_persistence(settings: Mapping[str, Any]) -> Dict[str, Any]:
    """Return detached settings without Main-managed custom HTTP credentials."""

    detached = deepcopy(dict(settings))
    credentials = _load_runtime_credentials()
    if not http_tool_runtime_credentials_enabled():
        return detached
    tools = detached.get("custom_http")
    if not isinstance(tools, list):
        return detached
    for tool in tools:
        if not isinstance(tool, MutableMapping):
            continue
        tool_id = str(tool.get("id") or "").strip()
        headers = _parse_headers(tool.get("headers"))
        for name in credentials.get(tool_id, {}):
            if name in headers:
                headers[name] = ""
        tool["headers"] = json.dumps(headers, ensure_ascii=False, indent=2)
        tool["headerCredentialsConfigured"] = sorted(credentials.get(tool_id, {}))
    return detached


def _reset_http_tool_credentials_cache_for_tests() -> None:
    """Reset process credential state for isolated unit tests."""

    global _cached_credentials, _runtime_credentials_enabled
    _cached_credentials = None
    _runtime_credentials_enabled = None
