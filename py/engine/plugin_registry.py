#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
Plugin Registry — 插件注册中心，管理内置和外部插件的发现与加载。

Author: maoyo
Department: 研发部
Date: 2026-04-13
Version: 1.0.0
Security Level: INTERNAL
"""

__version__ = "1.0.0"
__author__ = "maoyo"
__copyright__ = "Copyright 2026 Synapxnet"
__maintainer__ = "maoyo"
__email__ = "synapxnet@gmail.com"

"""
OpenXnet v0.5.2 — Plugin Registry (plugin_registry.py)
======================================================
"""

from typing import Any, Dict, List, Optional
import logging
from .plugin_sdk import BaseTool

logger = logging.getLogger("plugin_registry")

class PluginRegistry:
    """
    Central repository for all OpenXnet Tools with manifest-based plugin
    management, auto-discovery, hook integration, and surface enablement.
    """

    def __init__(self):
        self._tools: Dict[str, BaseTool] = {}
        self._manifests: Dict[str, Any] = {}
        self._tool_surfaces: Dict[str, List[str]] = {}

    def register(self, tool: BaseTool, manifest: Any = None):
        """Register a tool with optional manifest metadata."""
        if tool.name in self._tools:
            logger.warning(f"Tool {tool.name} is already registered. Overwriting.")
        self._tools[tool.name] = tool
        if manifest:
            self._manifests[tool.name] = manifest
            self._tool_surfaces[tool.name] = getattr(manifest, "surfaces", ["all"])
        if hasattr(tool, "on_register"):
            try:
                import asyncio
                loop = asyncio.get_running_loop()
                loop.create_task(tool.on_register({"registry": self}))
            except (RuntimeError, TypeError):
                pass
        logger.info(f"[PluginRegistry] Registered tool: {tool.name}")

    def register_from_manifest(self, manifest: Any) -> int:
        """Register all tools declared in a plugin manifest."""
        from py.plugin_manifest import register_manifest
        register_manifest(manifest)
        self._manifests[manifest.name] = manifest
        if manifest.hooks:
            self._register_manifest_hooks(manifest)
        return len(manifest.tools)

    def _register_manifest_hooks(self, manifest: Any) -> None:
        try:
            from py.plugin_hooks import get_hook_dispatcher
            dispatcher = get_hook_dispatcher()
            for hook_name in manifest.hooks:
                async def _noop_handler(hook: str, ctx: Dict[str, Any]) -> None:
                    pass
                dispatcher.register(
                    hook_name,
                    _noop_handler,
                    plugin_name=manifest.name,
                    priority=100,
                )
        except Exception:
            pass

    def get_tool(self, name: str) -> Optional[BaseTool]:
        return self._tools.get(name)

    def get_all_tools(self) -> List[BaseTool]:
        return list(self._tools.values())

    def get_tools_for_surface(self, surface: str) -> List[BaseTool]:
        result = []
        for name, tool in self._tools.items():
            surfaces = self._tool_surfaces.get(name, ["all"])
            if "all" in surfaces or surface.lower() in surfaces:
                result.append(tool)
        return result

    def get_openai_tools(self, surface: str = "") -> List[Dict]:
        if surface:
            tools = self.get_tools_for_surface(surface)
        else:
            tools = self.get_all_tools()
        return [t.to_openai_schema() for t in tools]

    async def execute_tool(self, name: str, **kwargs) -> Dict:
        tool = self.get_tool(name)
        if not tool:
            return {"success": False, "data": None, "error_message": f"Plugin {name} not found in registry."}
        try:
            from py.plugin_hooks import dispatch_hook
            await dispatch_hook("pre_tool_use", {
                "tool_name": name,
                "kwargs": kwargs,
            })
        except Exception:
            pass
        try:
            result = await tool.execute(**kwargs)
            result_dict = result.model_dump()
            try:
                from py.plugin_hooks import dispatch_hook
                await dispatch_hook("post_tool_use", {
                    "tool_name": name,
                    "kwargs": kwargs,
                    "result": result_dict,
                })
            except Exception:
                pass
            return result_dict
        except Exception as e:
            return {"success": False, "data": None, "error_message": f"Plugin Execution Error: {str(e)}"}

    def get_manifest(self, name: str) -> Optional[Any]:
        return self._manifests.get(name)

    def list_manifests(self) -> List[Any]:
        return list(self._manifests.values())

    def get_registry_info(self) -> Dict[str, Any]:
        return {
            "tool_count": len(self._tools),
            "manifest_count": len(self._manifests),
            "tools": [
                {
                    "name": t.name,
                    "description": t.description,
                    "surfaces": self._tool_surfaces.get(t.name, ["all"]),
                    "has_manifest": t.name in self._manifests,
                }
                for t in self._tools.values()
            ],
        }


_global_plugin_registry = PluginRegistry()


def get_plugin_registry() -> PluginRegistry:
    return _global_plugin_registry


def auto_discover_plugins(plugin_dirs: List[str]) -> int:
    try:
        from py.plugin_manifest import discover_manifests
        manifests = discover_manifests(plugin_dirs)
        count = 0
        for manifest in manifests:
            _global_plugin_registry.register_from_manifest(manifest)
            count += 1
        if count > 0:
            logger.info(f"[PluginRegistry] Auto-discovered {count} plugin(s)")
        return count
    except Exception as exc:
        logger.warning(f"[PluginRegistry] Auto-discovery failed: {exc}")
        return 0
