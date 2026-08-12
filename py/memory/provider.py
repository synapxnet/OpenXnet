#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
Workspace memory provider registry and factory helpers.

This module decouples Recall Center and Task Center from the current
JSON-backed session store implementation so OpenXnet can gradually adopt
additional memory backends without rewriting existing routes and runtime
integration points.

Author: OpenAI Codex
Department: R&D
Date: 2026-04-17
Version: 1.0.0
Security Level: INTERNAL
"""

__version__ = "1.0.0"
__author__ = "OpenAI Codex"
__copyright__ = "Copyright 2026 Synapxnet"
__maintainer__ = "OpenAI Codex"
__email__ = "synapxnet@gmail.com"

# Modification History:
# 2026-04-17, v1.0.0, OpenAI Codex: Initial creation.

import os
from pathlib import Path
from threading import RLock
from typing import Any, Callable, Dict, List, Optional, Protocol


class WorkspaceMemoryProvider(Protocol):
    """Minimal provider contract used by Recall Center and Task Center."""

    workspace_dir: Path
    provider_name: str

    def record_interaction(
        self,
        user_prompt: str,
        assistant_output: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        ...

    def record_task_event(self, **kwargs: Any) -> Dict[str, Any]:
        ...

    def search(self, query: str, limit: int = 8) -> List[Dict[str, Any]]:
        ...

    def get_overview(self, limit: int = 8) -> Dict[str, Any]:
        ...

    def get_timeline(self, query: str = "", limit: int = 20) -> List[Dict[str, Any]]:
        ...

    def get_observations(self, **kwargs: Any) -> List[Dict[str, Any]]:
        ...


MemoryProviderFactory = Callable[[str], WorkspaceMemoryProvider]

_DEFAULT_PROVIDER = "session_store"
_REGISTRY_LOCK = RLock()
_PROVIDER_FACTORIES: Dict[str, MemoryProviderFactory] = {}
_PROVIDER_CACHE: Dict[str, WorkspaceMemoryProvider] = {}
_PROVIDER_ALIASES: Dict[str, str] = {
    "default": _DEFAULT_PROVIDER,
    "session": _DEFAULT_PROVIDER,
    "session_json": _DEFAULT_PROVIDER,
    "json": _DEFAULT_PROVIDER,
    "local_json": _DEFAULT_PROVIDER,
}


def normalize_memory_provider_name(provider_name: str = "") -> str:
    """Normalize provider identifiers used by settings and env vars."""
    normalized = str(provider_name or "").strip().lower().replace("-", "_")
    if not normalized:
        return _DEFAULT_PROVIDER
    return _PROVIDER_ALIASES.get(normalized, normalized)


def resolve_memory_provider_name(settings: Optional[Dict[str, Any]] = None) -> str:
    """Resolve the preferred workspace memory provider from settings or env."""
    settings_name = str(
        (settings or {}).get("memorySettings", {}).get("workspaceProvider") or ""
    ).strip()
    env_name = os.getenv("OPENXNET_MEMORY_PROVIDER", "").strip()
    return normalize_memory_provider_name(settings_name or env_name)


def register_memory_provider(
    name: str,
    factory: MemoryProviderFactory,
    *,
    aliases: Optional[List[str]] = None,
) -> None:
    """Register a workspace memory provider factory."""
    normalized_name = normalize_memory_provider_name(name)
    with _REGISTRY_LOCK:
        _PROVIDER_FACTORIES[normalized_name] = factory
        for alias in list(aliases or []):
            _PROVIDER_ALIASES[normalize_memory_provider_name(alias)] = normalized_name


def get_workspace_memory_provider(
    workspace_dir: str,
    provider_name: str = "",
) -> WorkspaceMemoryProvider:
    """Return a cached provider instance for the workspace."""
    normalized_workspace = os.path.normpath(str(Path(workspace_dir).expanduser()))
    if not normalized_workspace:
        raise ValueError("workspace_dir is required")

    selected_provider = normalize_memory_provider_name(
        provider_name or resolve_memory_provider_name()
    )
    cache_key = f"{selected_provider}::{os.path.normcase(normalized_workspace)}"

    with _REGISTRY_LOCK:
        cached = _PROVIDER_CACHE.get(cache_key)
        if cached is not None:
            return cached

        factory = _PROVIDER_FACTORIES.get(selected_provider)
        if factory is None:
            factory = _PROVIDER_FACTORIES.get(_DEFAULT_PROVIDER)
        if factory is None:
            raise RuntimeError(f"Memory provider '{selected_provider}' is not registered")

        provider = factory(normalized_workspace)
        _PROVIDER_CACHE[cache_key] = provider
        return provider


def clear_workspace_memory_provider_cache(
    workspace_dir: str = "",
    provider_name: str = "",
) -> None:
    """Drop cached providers for a workspace or the whole registry cache."""
    with _REGISTRY_LOCK:
        if not workspace_dir:
            _PROVIDER_CACHE.clear()
            return

        normalized_workspace = os.path.normpath(str(Path(workspace_dir).expanduser()))
        if provider_name:
            selected_provider = normalize_memory_provider_name(provider_name)
            _PROVIDER_CACHE.pop(
                f"{selected_provider}::{os.path.normcase(normalized_workspace)}",
                None,
            )
            return

        workspace_key = f"::{os.path.normcase(normalized_workspace)}"
        stale_keys = [key for key in _PROVIDER_CACHE if key.endswith(workspace_key)]
        for key in stale_keys:
            _PROVIDER_CACHE.pop(key, None)


def _create_session_store_provider(workspace_dir: str) -> WorkspaceMemoryProvider:
    from .session_store import SessionMemoryStore

    return SessionMemoryStore(workspace_dir)


register_memory_provider(
    _DEFAULT_PROVIDER,
    _create_session_store_provider,
    aliases=["default", "session", "session_json", "json", "local_json"],
)
