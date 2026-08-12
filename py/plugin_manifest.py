#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
Plugin manifest schema and loader for the OpenXnet plugin system.

Defines a JSON-based manifest format that plugins use to declare their
identity, hooks, dependencies, surface enablement, and tool definitions.
Supports auto-discovery from plugin directories.

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

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

logger = logging.getLogger("app")

VALID_HOOKS = {
    "pre_prompt",
    "post_tool_use",
    "task_start",
    "task_end",
    "session_start",
    "session_end",
    "overlay_update",
    "observation_created",
    "delivery_complete",
}

VALID_SURFACES = {
    "home",
    "task_center",
    "developer_workbench",
    "desktop_control",
    "recall_center",
    "dynamic_island",
    "floating_hud",
    "chat",
    "all",
}


@dataclass
class PluginManifest:
    name: str
    version: str = "1.0.0"
    description: str = ""
    author: str = ""
    license: str = ""
    homepage: str = ""
    entry_point: str = ""
    hooks: List[str] = field(default_factory=list)
    surfaces: List[str] = field(default_factory=lambda: ["all"])
    dependencies: List[str] = field(default_factory=list)
    pip_dependencies: List[str] = field(default_factory=list)
    requires_env: List[str] = field(default_factory=list)
    tools: List[Dict[str, Any]] = field(default_factory=list)
    config_schema: Dict[str, Any] = field(default_factory=dict)
    enabled: bool = True
    source_dir: str = ""

    @classmethod
    def from_dict(cls, data: dict, source_dir: str = "") -> "PluginManifest":
        name = str(data.get("name") or "").strip()
        if not name:
            raise ValueError("Plugin manifest requires a 'name' field")
        hooks = [
            h for h in (data.get("hooks") or [])
            if isinstance(h, str) and h in VALID_HOOKS
        ]
        surfaces = data.get("surfaces") or ["all"]
        surfaces = [
            s for s in surfaces
            if isinstance(s, str) and s in VALID_SURFACES
        ] or ["all"]
        return cls(
            name=name,
            version=str(data.get("version") or "1.0.0"),
            description=str(data.get("description") or ""),
            author=str(data.get("author") or ""),
            license=str(data.get("license") or ""),
            homepage=str(data.get("homepage") or ""),
            entry_point=str(data.get("entry_point") or ""),
            hooks=hooks,
            surfaces=surfaces,
            dependencies=list(data.get("dependencies") or []),
            pip_dependencies=list(data.get("pip_dependencies") or []),
            requires_env=list(data.get("requires_env") or []),
            tools=list(data.get("tools") or []),
            config_schema=dict(data.get("config_schema") or {}),
            enabled=bool(data.get("enabled", True)),
            source_dir=source_dir,
        )

    @classmethod
    def from_file(cls, path: Path) -> "PluginManifest":
        data = json.loads(path.read_text(encoding="utf-8"))
        return cls.from_dict(data, source_dir=str(path.parent))

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "version": self.version,
            "description": self.description,
            "author": self.author,
            "license": self.license,
            "homepage": self.homepage,
            "entry_point": self.entry_point,
            "hooks": self.hooks,
            "surfaces": self.surfaces,
            "dependencies": self.dependencies,
            "pip_dependencies": self.pip_dependencies,
            "requires_env": self.requires_env,
            "tools": self.tools,
            "config_schema": self.config_schema,
            "enabled": self.enabled,
            "source_dir": self.source_dir,
        }

    def is_enabled_for_surface(self, surface: str) -> bool:
        if "all" in self.surfaces:
            return True
        return surface.lower().strip() in self.surfaces

    def has_hook(self, hook_name: str) -> bool:
        return hook_name in self.hooks


def discover_manifests(plugin_dirs: List[str]) -> List[PluginManifest]:
    manifests = []
    for dir_path in plugin_dirs:
        p = Path(dir_path)
        if not p.is_dir():
            continue
        for manifest_file in p.rglob("plugin.json"):
            try:
                manifest = PluginManifest.from_file(manifest_file)
                manifests.append(manifest)
            except Exception as exc:
                logger.warning(f"[Plugin] Failed to load manifest {manifest_file}: {exc}")
    return manifests


_manifest_registry: Dict[str, PluginManifest] = {}


def register_manifest(manifest: PluginManifest) -> None:
    _manifest_registry[manifest.name] = manifest


def get_manifest(name: str) -> Optional[PluginManifest]:
    return _manifest_registry.get(name)


def list_manifests() -> List[PluginManifest]:
    return list(_manifest_registry.values())


def get_manifests_for_surface(surface: str) -> List[PluginManifest]:
    return [m for m in _manifest_registry.values() if m.is_enabled_for_surface(surface)]


def get_manifests_for_hook(hook_name: str) -> List[PluginManifest]:
    return [m for m in _manifest_registry.values() if m.has_hook(hook_name) and m.enabled]
