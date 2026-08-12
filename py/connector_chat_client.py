# -*- coding: utf-8 -*-
"""Private Connector Worker client for OpenAI-compatible Chat requests."""

from __future__ import annotations

import os
from urllib.parse import urlsplit

from openai import AsyncOpenAI

from py.get_setting import get_port


CONNECTOR_CHAT_ORIGIN_ENV = "OPENXNET_CONNECTOR_CHAT_ORIGIN"
CONNECTOR_CHAT_TOKEN_ENV = "OPENXNET_CONNECTOR_CHAT_TOKEN"


class ConnectorChatConfigurationError(RuntimeError):
    """Fixed failure raised for incomplete or unsafe private broker settings."""


def create_connector_chat_client() -> AsyncOpenAI:
    """Create an OpenAI-compatible client for private Desktop or Server Chat."""

    origin, token = resolve_connector_chat_endpoint()
    return AsyncOpenAI(api_key=token, base_url=f"{origin}/v1")


def resolve_connector_chat_endpoint() -> tuple[str, str]:
    """Resolve a strict private broker endpoint or the Server compatibility URL."""

    origin = str(os.environ.get(CONNECTOR_CHAT_ORIGIN_ENV, "")).strip()
    token = str(os.environ.get(CONNECTOR_CHAT_TOKEN_ENV, "")).strip()
    if not origin and not token:
        return f"http://127.0.0.1:{get_port()}", "openxnet-local"
    if not origin or not token:
        raise ConnectorChatConfigurationError(
            "Connector Chat private configuration is incomplete."
        )
    return _normalize_private_origin(origin), _validate_private_token(token)


def _normalize_private_origin(value: str) -> str:
    """Require one credential-free loopback HTTP origin with an explicit port."""

    if len(value) > 512:
        raise ConnectorChatConfigurationError("Connector Chat origin is invalid.")
    try:
        parsed = urlsplit(value)
        port = parsed.port
    except ValueError as error:
        raise ConnectorChatConfigurationError("Connector Chat origin is invalid.") from error
    if (
        parsed.scheme != "http"
        or parsed.hostname not in {"127.0.0.1", "localhost", "::1"}
        or port is None
        or parsed.username
        or parsed.password
        or parsed.path not in {"", "/"}
        or parsed.query
        or parsed.fragment
    ):
        raise ConnectorChatConfigurationError("Connector Chat origin is invalid.")
    return value.rstrip("/")


def _validate_private_token(value: str) -> str:
    """Require one bounded process-scoped bearer credential."""

    if len(value) < 16 or len(value) > 512:
        raise ConnectorChatConfigurationError("Connector Chat token is invalid.")
    return value
