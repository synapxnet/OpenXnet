# -*- coding: utf-8 -*-
"""Provider client construction shared by Server and the Execution Engine profile."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

import httpx
from openai import AsyncOpenAI

from py.dify_openai import DifyOpenAIAsync


def get_provider_client_class(
    configuration: Mapping[str, Any] | None,
    provider_id: Any,
):
    """Resolve the configured provider adapter class without constructing a client."""

    providers = configuration.get("modelProviders") if configuration else None
    if not isinstance(providers, list):
        return AsyncOpenAI
    vendor = "OpenAI"
    for provider in providers:
        if not isinstance(provider, Mapping):
            continue
        if provider.get("id") == provider_id:
            vendor = str(provider.get("vendor") or "OpenAI")
            break
    return DifyOpenAIAsync if vendor == "Dify" else AsyncOpenAI


def create_provider_client(
    configuration: Mapping[str, Any] | None,
    *,
    config_node: Mapping[str, Any] | None = None,
    http_client: httpx.AsyncClient | None = None,
):
    """Construct one provider client from the selected bounded configuration node."""

    settings = configuration or {}
    target = config_node or settings
    provider_id = target.get("selectedProvider", settings.get("selectedProvider"))
    client_class = get_provider_client_class(settings, provider_id)
    arguments = {
        "api_key": target.get("api_key") or settings.get("api_key", ""),
        "base_url": (
            target.get("base_url")
            or settings.get("base_url")
            or "https://api.openai.com/v1"
        ),
    }
    if http_client is not None:
        arguments["http_client"] = http_client
    return client_class(**arguments)
