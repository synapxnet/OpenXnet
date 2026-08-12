#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
Plugin hook dispatcher for lifecycle event broadcasting.

Provides a centralized hook dispatch system that runs registered hook
handlers for lifecycle events like pre_prompt, post_tool_use, task_start,
task_end, session_start, session_end, etc.

Author: Claude Code
Department: R&D
Date: 2026-04-19
Version: 1.0.0
Security Level: INTERNAL
"""

__version__ = "1.0.0"
__author__ = "Claude Code"
__copyright__ = "Copyright 2026 Synapxnet"
__maintainer__ = "Claude Code"
__email__ = "synapxnet@gmail.com"

import asyncio
import logging
import time
from datetime import datetime
from typing import Any, Callable, Coroutine, Dict, List, Optional

logger = logging.getLogger("app")

HookHandler = Callable[
    [str, Dict[str, Any]],
    Coroutine[Any, Any, Optional[Dict[str, Any]]],
]


class HookDispatcher:
    """Central dispatcher for plugin lifecycle hooks."""

    def __init__(self):
        self._handlers: Dict[str, List[Dict[str, Any]]] = {}
        self._hook_stats: Dict[str, Dict[str, Any]] = {}

    def register(
        self,
        hook_name: str,
        handler: HookHandler,
        *,
        plugin_name: str = "",
        priority: int = 100,
    ) -> None:
        if hook_name not in self._handlers:
            self._handlers[hook_name] = []
        self._handlers[hook_name].append({
            "handler": handler,
            "plugin_name": plugin_name,
            "priority": priority,
        })
        self._handlers[hook_name].sort(key=lambda x: x["priority"])
        if hook_name not in self._hook_stats:
            self._hook_stats[hook_name] = {
                "call_count": 0,
                "error_count": 0,
                "total_ms": 0,
                "last_called": "",
            }

    def unregister(self, hook_name: str, plugin_name: str) -> bool:
        if hook_name not in self._handlers:
            return False
        before = len(self._handlers[hook_name])
        self._handlers[hook_name] = [
            h for h in self._handlers[hook_name]
            if h["plugin_name"] != plugin_name
        ]
        return len(self._handlers[hook_name]) < before

    def unregister_plugin(self, plugin_name: str) -> int:
        removed = 0
        for hook_name in list(self._handlers.keys()):
            before = len(self._handlers[hook_name])
            self._handlers[hook_name] = [
                h for h in self._handlers[hook_name]
                if h["plugin_name"] != plugin_name
            ]
            removed += before - len(self._handlers[hook_name])
        return removed

    async def dispatch(
        self,
        hook_name: str,
        context: Dict[str, Any],
        *,
        fail_fast: bool = False,
    ) -> List[Dict[str, Any]]:
        handlers = self._handlers.get(hook_name, [])
        if not handlers:
            return []

        results = []
        stats = self._hook_stats.get(hook_name, {
            "call_count": 0, "error_count": 0, "total_ms": 0, "last_called": "",
        })
        stats["call_count"] += 1
        stats["last_called"] = datetime.now().isoformat()

        for entry in handlers:
            handler = entry["handler"]
            plugin_name = entry["plugin_name"]
            start = time.monotonic()
            try:
                result = await asyncio.wait_for(
                    handler(hook_name, context),
                    timeout=10.0,
                )
                elapsed_ms = (time.monotonic() - start) * 1000
                stats["total_ms"] += elapsed_ms
                results.append({
                    "plugin": plugin_name,
                    "hook": hook_name,
                    "success": True,
                    "result": result,
                    "elapsed_ms": round(elapsed_ms, 1),
                })
            except asyncio.TimeoutError:
                stats["error_count"] += 1
                results.append({
                    "plugin": plugin_name,
                    "hook": hook_name,
                    "success": False,
                    "error": "Hook timed out (10s)",
                })
                if fail_fast:
                    break
            except Exception as exc:
                stats["error_count"] += 1
                results.append({
                    "plugin": plugin_name,
                    "hook": hook_name,
                    "success": False,
                    "error": str(exc),
                })
                if fail_fast:
                    break

        self._hook_stats[hook_name] = stats
        return results

    def get_stats(self) -> Dict[str, Dict[str, Any]]:
        return dict(self._hook_stats)

    def list_hooks(self) -> Dict[str, List[str]]:
        return {
            hook: [h["plugin_name"] for h in handlers]
            for hook, handlers in self._handlers.items()
            if handlers
        }

    def handler_count(self, hook_name: str) -> int:
        return len(self._handlers.get(hook_name, []))


_global_dispatcher = HookDispatcher()


def get_hook_dispatcher() -> HookDispatcher:
    return _global_dispatcher


async def dispatch_hook(
    hook_name: str,
    context: Dict[str, Any],
    **kwargs,
) -> List[Dict[str, Any]]:
    return await _global_dispatcher.dispatch(hook_name, context, **kwargs)
