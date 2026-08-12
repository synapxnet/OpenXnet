#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
Code intelligence integration via GitNexus MCP server.

Provides a high-level API for code knowledge graph operations:
- Codebase indexing and analysis
- Symbol context lookup (callers, callees, processes)
- Impact/blast radius analysis
- Community detection and code clustering
- API route mapping
- Hybrid code search (BM25 + semantic)

GitNexus is connected as an MCP stdio subprocess. This module wraps
the MCP tool calls into convenient Python functions and FastAPI endpoints.

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
import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("app")

GITNEXUS_RUNTIME_CONFIG_SCHEMA = "openxnet.gitnexus-runtime.v1"

GITNEXUS_TOOLS = [
    "list_repos",
    "query",
    "context",
    "impact",
    "detect_changes",
    "rename",
    "cypher",
    "route_map",
    "tool_map",
    "shape_check",
    "api_impact",
    "group_list",
    "group_sync",
    "group_contracts",
    "group_query",
    "group_status",
]


def _find_local_gitnexus() -> Optional[str]:
    """Find the GitNexus source-tree entry point used during development."""
    candidates = [
        Path(__file__).parent.parent / "gitnexus" / "dist" / "cli" / "index.js",
        Path(__file__).parent.parent.parent / "gitnexus" / "dist" / "cli" / "index.js",
    ]
    for candidate in candidates:
        if candidate.exists():
            return str(candidate.resolve())
    return None


def _read_feature_pack_runtime() -> Optional[Dict[str, Any]]:
    """Read the short-lived GitNexus runtime handoff written after pack activation."""

    configured_path = os.environ.get("OPENXNET_GITNEXUS_RUNTIME_CONFIG", "").strip()
    if configured_path:
        runtime_path = Path(configured_path)
    else:
        user_data_dir = os.environ.get("OPENXNET_USER_DATA_DIR", "").strip()
        if not user_data_dir:
            return None
        runtime_path = Path(user_data_dir) / "runtime-capabilities" / "gitnexus.json"

    try:
        payload = json.loads(runtime_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError):
        return None
    if not isinstance(payload, dict) or payload.get("schema") != GITNEXUS_RUNTIME_CONFIG_SCHEMA:
        return None

    entrypoint_value = payload.get("entrypoint")
    pack_root_value = payload.get("packRoot")
    node_value = payload.get("nodeExecutable")
    node_mode = payload.get("nodeMode")
    if not all(isinstance(value, str) and value for value in (entrypoint_value, pack_root_value, node_value)):
        return None
    if node_mode not in {"electron", "node"}:
        return None

    entrypoint = Path(entrypoint_value).resolve()
    pack_root = Path(pack_root_value).resolve()
    node_executable = Path(node_value).resolve()
    try:
        entrypoint.relative_to(pack_root)
    except ValueError:
        return None
    if not entrypoint.is_file() or not node_executable.is_file():
        return None

    config: Dict[str, Any] = {
        "command": str(node_executable),
        "args": [str(entrypoint), "mcp"],
        "source": "feature_pack",
        "pack_version": str(payload.get("packVersion", "")),
    }
    if node_mode == "electron":
        config["env"] = {"ELECTRON_RUN_AS_NODE": "1"}
    return config


def _get_development_node_runtime() -> Optional[Dict[str, Any]]:
    """Resolve a Node-compatible runtime for the source-tree GitNexus fallback."""

    node_path = shutil.which("node")
    if node_path:
        return {"command": node_path}
    electron_node = os.environ.get("ELECTRON_NODE_EXEC", "").strip()
    if electron_node and Path(electron_node).is_file():
        return {
            "command": str(Path(electron_node).resolve()),
            "env": {"ELECTRON_RUN_AS_NODE": "1"},
        }
    return None


def get_gitnexus_mcp_config(custom_command: str = "") -> Dict[str, Any]:
    """Build an MCP config, preferring an activated and integrity-checked feature pack."""

    if custom_command:
        return {"command": custom_command, "args": ["mcp"], "source": "custom"}

    feature_pack = _read_feature_pack_runtime()
    if feature_pack:
        return feature_pack

    local_entry = _find_local_gitnexus()
    if local_entry:
        runtime = _get_development_node_runtime()
        if runtime:
            return {
                **runtime,
                "args": [local_entry, "mcp"],
                "source": "development_source",
            }

    gitnexus_bin = shutil.which("gitnexus")
    if gitnexus_bin:
        return {"command": gitnexus_bin, "args": ["mcp"], "source": "global_bin"}

    npx_path = shutil.which("npx")
    if npx_path:
        return {"command": "npx", "args": ["gitnexus", "mcp"], "source": "npx_global"}

    return {"command": "npx", "args": ["gitnexus", "mcp"], "source": "fallback"}


def is_gitnexus_available() -> Dict[str, Any]:
    """Report activated feature-pack, development, and system GitNexus options."""

    feature_pack = _read_feature_pack_runtime()
    local_entry = _find_local_gitnexus()
    npx = shutil.which("npx")
    gitnexus = shutil.which("gitnexus")
    node = shutil.which("node")
    config = get_gitnexus_mcp_config()
    return {
        "available": bool(feature_pack or local_entry or npx or gitnexus),
        "feature_pack": feature_pack or {},
        "development_source": local_entry or "",
        "local_bundled": local_entry or "",
        "npx": npx or "",
        "gitnexus_global": gitnexus or "",
        "node": node or "",
        "source": config.get("source", ""),
        "config": config,
    }


class CodeIntelligenceProxy:
    """High-level proxy for GitNexus MCP tools."""

    def __init__(self, mcp_client=None):
        """Create a disconnected proxy with an optional MCP client reference."""

        self._mcp = mcp_client
        self._connected = False

    @property
    def connected(self) -> bool:
        """Return whether an MCP client is currently attached and marked connected."""

        return self._connected and self._mcp is not None

    async def connect(self, mcp_client) -> bool:
        """Attach an initialized MCP client and mark the proxy connected."""

        self._mcp = mcp_client
        self._connected = True
        return True

    async def call_tool(self, tool_name: str, arguments: Dict[str, Any] = None) -> Dict[str, Any]:
        """Invoke one allow-listed GitNexus MCP tool and normalize its content blocks."""

        if not self._mcp:
            return {"error": "GitNexus MCP not connected", "tool": tool_name}
        try:
            session = getattr(self._mcp, "session", None) or getattr(self._mcp, "_conn", {})
            if hasattr(session, "session"):
                session = session.session
            if session and hasattr(session, "call_tool"):
                result = await session.call_tool(tool_name, arguments or {})
                if hasattr(result, "content"):
                    contents = []
                    for block in result.content:
                        if hasattr(block, "text"):
                            try:
                                contents.append(json.loads(block.text))
                            except (json.JSONDecodeError, TypeError):
                                contents.append({"text": block.text})
                    return {"success": True, "tool": tool_name, "results": contents}
                return {"success": True, "tool": tool_name, "raw": str(result)}
            return {"error": "No active MCP session", "tool": tool_name}
        except Exception as exc:
            return {"error": str(exc), "tool": tool_name}

    async def list_repos(self) -> Dict[str, Any]:
        """List repositories currently indexed by GitNexus."""

        return await self.call_tool("list_repos")

    async def query(self, query: str, repo: str = "", top_k: int = 10) -> Dict[str, Any]:
        """Run a ranked code search against an optional repository scope."""

        args = {"query": query, "top_k": top_k}
        if repo:
            args["repo"] = repo
        return await self.call_tool("query", args)

    async def context(self, symbol: str, repo: str = "") -> Dict[str, Any]:
        """Return graph context for a symbol in an optional repository scope."""

        args = {"symbol": symbol}
        if repo:
            args["repo"] = repo
        return await self.call_tool("context", args)

    async def impact(self, symbol: str, repo: str = "", depth: int = 3) -> Dict[str, Any]:
        """Calculate upstream impact for a symbol to the requested graph depth."""

        args = {"symbol": symbol, "depth": depth}
        if repo:
            args["repo"] = repo
        return await self.call_tool("impact", args)

    async def detect_changes(self, repo: str = "", base: str = "HEAD~1") -> Dict[str, Any]:
        """Detect graph-relevant source changes relative to a Git base revision."""

        args = {"base": base}
        if repo:
            args["repo"] = repo
        return await self.call_tool("detect_changes", args)

    async def route_map(self, repo: str = "") -> Dict[str, Any]:
        """Return detected application routes for an optional repository scope."""

        args = {}
        if repo:
            args["repo"] = repo
        return await self.call_tool("route_map", args)

    async def cypher(self, query: str, repo: str = "") -> Dict[str, Any]:
        """Execute an explicit read query against a repository knowledge graph."""

        args = {"query": query}
        if repo:
            args["repo"] = repo
        return await self.call_tool("cypher", args)


_proxy: Optional[CodeIntelligenceProxy] = None


def get_code_intelligence() -> CodeIntelligenceProxy:
    """Return the process-wide lazy code intelligence proxy."""

    global _proxy
    if _proxy is None:
        _proxy = CodeIntelligenceProxy()
    return _proxy


def set_code_intelligence(proxy: CodeIntelligenceProxy) -> None:
    """Replace the process-wide proxy after an MCP client is initialized."""

    global _proxy
    _proxy = proxy
