# -*- coding: utf-8 -*-
"""Validate and hydrate one Main-injected task terminal-delivery credential."""

from __future__ import annotations

import base64
from copy import deepcopy
import ipaddress
import json
import os
import re
from typing import Any, Dict, Mapping
from urllib.parse import urlsplit, urlunsplit


DELIVERY_CREDENTIAL_SCHEMA = "openxnet.delivery-credentials.runtime.v1"
MAX_DELIVERY_CREDENTIAL_BOOTSTRAP_BYTES = 256 * 1024
MAX_DELIVERY_CREDENTIAL_LENGTH = 64 * 1024
MAX_DELIVERY_CREDENTIAL_HEADERS = 64
MAX_DELIVERY_CREDENTIAL_SCOPE_BYTES = 192 * 1024
DELIVERY_CREDENTIAL_TARGETS = {"webhook", "discord"}
HEADER_NAME_PATTERN = re.compile(r"^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,256}$")
TASK_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$")
BLOCKED_DELIVERY_HEADERS = {
    "connection",
    "content-length",
    "host",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
}


def _parse_bounded_text(value: Any, label: str, maximum_length: int) -> str:
    """Parse one non-empty bounded string without control characters."""

    if not isinstance(value, str):
        raise RuntimeError(f"{label} is invalid.")
    normalized = value.strip()
    if (
        not normalized
        or len(normalized) > maximum_length
        or any(ord(character) < 32 or ord(character) == 127 for character in normalized)
    ):
        raise RuntimeError(f"{label} is invalid.")
    return normalized


def _is_loopback_host(hostname: str) -> bool:
    """Return whether one URL hostname is explicit local loopback."""

    normalized = hostname.strip().lower().rstrip(".")
    if normalized == "localhost":
        return True
    try:
        return ipaddress.ip_address(normalized).is_loopback
    except ValueError:
        return False


def normalize_delivery_credential_url(value: Any) -> str:
    """Validate one delivery URL and require HTTPS outside loopback."""

    normalized = _parse_bounded_text(value, "Delivery credential URL", 4_096)
    try:
        parsed = urlsplit(normalized)
        port = parsed.port
    except ValueError as error:
        raise RuntimeError("Delivery credential URL is invalid.") from error
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.hostname
        or parsed.username is not None
        or parsed.password is not None
        or parsed.fragment
        or (parsed.scheme == "http" and not _is_loopback_host(parsed.hostname))
    ):
        raise RuntimeError("Delivery credential URL is invalid.")
    if port is not None and not 1 <= port <= 65_535:
        raise RuntimeError("Delivery credential URL is invalid.")
    return urlunsplit(parsed)


def _parse_scope(value: Any) -> Dict[str, str]:
    """Parse one exact workspace, task, and target delivery scope."""

    if not isinstance(value, Mapping) or set(value) != {"workspacePath", "taskId", "target"}:
        raise RuntimeError("Delivery credential scope is invalid.")
    workspace_path = os.path.realpath(
        os.path.abspath(_parse_bounded_text(value.get("workspacePath"), "workspacePath", 32_768))
    )
    task_id = _parse_bounded_text(value.get("taskId"), "taskId", 128)
    target = _parse_bounded_text(value.get("target"), "target", 32).lower()
    if not TASK_ID_PATTERN.fullmatch(task_id) or target not in DELIVERY_CREDENTIAL_TARGETS:
        raise RuntimeError("Delivery credential scope is invalid.")
    return {"workspacePath": workspace_path, "taskId": task_id, "target": target}


def _parse_credentials(value: Any, target: str) -> Dict[str, Any]:
    """Parse exact target-specific delivery credentials."""

    if not isinstance(value, Mapping):
        raise RuntimeError("Delivery credentials are invalid.")
    allowed = {"url", "headers"} if target == "webhook" else {"webhook_url"}
    if not set(value).issubset(allowed) or not value:
        raise RuntimeError("Delivery credential fields are invalid.")
    credentials: Dict[str, Any] = {}
    if "url" in value:
        credentials["url"] = normalize_delivery_credential_url(value["url"])
    if "webhook_url" in value:
        credentials["webhook_url"] = normalize_delivery_credential_url(value["webhook_url"])
    if "headers" in value:
        headers = normalize_delivery_credential_headers(value["headers"])
        if headers:
            credentials["headers"] = headers
    if not credentials:
        raise RuntimeError("Delivery credentials are invalid.")
    encoded = json.dumps(
        credentials,
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode("utf-8")
    if len(encoded) > MAX_DELIVERY_CREDENTIAL_SCOPE_BYTES:
        raise RuntimeError("Delivery credentials exceed the scope byte budget.")
    return credentials


def normalize_delivery_credential_headers(value: Any) -> Dict[str, str]:
    """Validate one bounded map of outbound webhook headers."""

    if not isinstance(value, Mapping) or len(value) > MAX_DELIVERY_CREDENTIAL_HEADERS:
        raise RuntimeError("Delivery credential headers are invalid.")
    headers: Dict[str, str] = {}
    for raw_name, raw_secret in value.items():
        if not isinstance(raw_name, str) or not HEADER_NAME_PATTERN.fullmatch(raw_name):
            raise RuntimeError("Delivery credential header name is invalid.")
        normalized_name = raw_name.lower()
        if normalized_name in BLOCKED_DELIVERY_HEADERS or normalized_name in headers:
            raise RuntimeError("Delivery credential header name is invalid.")
        headers[normalized_name] = _parse_bounded_text(
            raw_secret,
            "Delivery credential value",
            MAX_DELIVERY_CREDENTIAL_LENGTH,
        )
    return headers


def decode_delivery_credential_bootstrap(value: Any) -> Dict[str, Any]:
    """Decode one bounded request-scoped credential envelope from Main."""

    encoded = _parse_bounded_text(value, "Delivery credential bootstrap", 512 * 1024)
    try:
        decoded = base64.b64decode(encoded, validate=True)
        if len(decoded) > MAX_DELIVERY_CREDENTIAL_BOOTSTRAP_BYTES:
            raise ValueError("Delivery credential bootstrap exceeds its byte budget.")
        payload = json.loads(decoded.decode("utf-8"))
    except Exception as error:
        raise RuntimeError("Delivery credential bootstrap is invalid.") from error
    if not isinstance(payload, Mapping) or set(payload) != {"schema", "scope", "credentials"}:
        raise RuntimeError("Delivery credential bootstrap fields are invalid.")
    if payload.get("schema") != DELIVERY_CREDENTIAL_SCHEMA:
        raise RuntimeError("Delivery credential bootstrap schema is invalid.")
    scope = _parse_scope(payload.get("scope"))
    return {
        "scope": scope,
        "credentials": _parse_credentials(payload.get("credentials"), scope["target"]),
    }


def hydrate_delivery_record(
    bootstrap: Any,
    workspace_path: Any,
    task_id: Any,
    target: Any,
    record: Mapping[str, Any],
) -> Dict[str, Any]:
    """Hydrate one exact delivery record after verifying its compound scope."""

    detached = deepcopy(dict(record))
    encoded = str(bootstrap or "").strip()
    if not encoded:
        return detached
    payload = decode_delivery_credential_bootstrap(encoded)
    requested_scope = _parse_scope({
        "workspacePath": workspace_path,
        "taskId": task_id,
        "target": target,
    })
    stored_scope = payload["scope"]
    if (
        os.path.normcase(stored_scope["workspacePath"])
        != os.path.normcase(requested_scope["workspacePath"])
        or stored_scope["taskId"] != requested_scope["taskId"]
        or stored_scope["target"] != requested_scope["target"]
    ):
        raise RuntimeError("Delivery credential scope does not match the broker request.")
    config = detached.get("config")
    config = dict(config) if isinstance(config, Mapping) else {}
    credentials = payload["credentials"]
    if requested_scope["target"] == "webhook":
        config["url"] = credentials.get("url", "")
        headers = config.get("headers")
        headers = dict(headers) if isinstance(headers, Mapping) else {}
        headers.update(credentials.get("headers") or {})
        config["headers"] = headers
    else:
        config["webhook_url"] = credentials.get("webhook_url", "")
    detached["config"] = config
    return detached
