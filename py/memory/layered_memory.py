#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
Layered memory stack for token-efficient context injection.

Implements a 4-layer memory architecture inspired by mempalace:
  L0 (~50 tokens)  - Identity and core directives
  L1 (~120 tokens) - Critical facts and active constraints
  L2 (on demand)   - Room-level recall by topic
  L3 (on demand)   - Deep search with full detail

L0+L1 are always injected at session start (~170 tokens total).
L2/L3 are loaded only when the agent needs deeper context.

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
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("app")


class LayeredMemoryStack:
    """4-layer memory stack with token-budget-aware context injection."""

    def __init__(self, workspace_dir: str):
        self.workspace_dir = Path(workspace_dir).expanduser()
        self.memory_dir = self.workspace_dir / ".agent" / "memory"
        self.memory_dir.mkdir(parents=True, exist_ok=True)
        self.l0_file = self.memory_dir / "l0_identity.json"
        self.l1_file = self.memory_dir / "l1_critical.json"

    def get_l0(self) -> Dict[str, Any]:
        """L0: Identity and core directives (~50 tokens)."""
        data = self._read_json(self.l0_file, default={})
        if not data:
            data = {
                "role": "",
                "workspace": str(self.workspace_dir),
                "directives": [],
                "updated_at": "",
            }
        return data

    def set_l0(self, role: str = "", directives: List[str] = None) -> None:
        data = self.get_l0()
        if role:
            data["role"] = role
        if directives is not None:
            data["directives"] = directives[:5]
        data["updated_at"] = datetime.now().isoformat()
        self._write_json(self.l0_file, data)

    def get_l1(self) -> Dict[str, Any]:
        """L1: Critical facts and active constraints (~120 tokens)."""
        data = self._read_json(self.l1_file, default={})
        if not data:
            data = {
                "facts": [],
                "constraints": [],
                "active_goals": [],
                "updated_at": "",
            }
        return data

    def set_l1(
        self,
        facts: List[str] = None,
        constraints: List[str] = None,
        active_goals: List[str] = None,
    ) -> None:
        data = self.get_l1()
        if facts is not None:
            data["facts"] = facts[:10]
        if constraints is not None:
            data["constraints"] = constraints[:5]
        if active_goals is not None:
            data["active_goals"] = active_goals[:5]
        data["updated_at"] = datetime.now().isoformat()
        self._write_json(self.l1_file, data)

    def add_l1_fact(self, fact: str) -> None:
        data = self.get_l1()
        facts = data.get("facts", [])
        if fact not in facts:
            facts.insert(0, fact)
            data["facts"] = facts[:10]
            data["updated_at"] = datetime.now().isoformat()
            self._write_json(self.l1_file, data)

    def remove_l1_fact(self, fact: str) -> bool:
        data = self.get_l1()
        facts = data.get("facts", [])
        if fact in facts:
            facts.remove(fact)
            data["facts"] = facts
            data["updated_at"] = datetime.now().isoformat()
            self._write_json(self.l1_file, data)
            return True
        return False

    async def get_l2(self, topic: str, obs_store=None) -> List[Dict[str, Any]]:
        """L2: Topic-scoped recall (on demand)."""
        if not obs_store or not topic:
            return []
        try:
            return await obs_store.search_fts(topic, limit=5)
        except Exception:
            return []

    async def get_l3(self, query: str, obs_store=None, knowledge_engine=None) -> Dict[str, Any]:
        """L3: Deep search across all knowledge layers (on demand)."""
        results = {"observations": [], "knowledge": []}
        if obs_store and query:
            try:
                results["observations"] = await obs_store.search_fts(query, limit=8)
            except Exception:
                pass
        if knowledge_engine and query:
            try:
                kr = await knowledge_engine.query(query, top_k=5)
                results["knowledge"] = kr.get("results", [])
            except Exception:
                pass
        return results

    def build_wakeup_context(self) -> str:
        """Build L0+L1 context string for session start (~170 tokens)."""
        l0 = self.get_l0()
        l1 = self.get_l1()
        parts = []

        role = l0.get("role", "")
        if role:
            parts.append(f"Role: {role}")

        directives = l0.get("directives", [])
        if directives:
            parts.append("Directives: " + "; ".join(directives))

        facts = l1.get("facts", [])
        if facts:
            parts.append("Key facts: " + "; ".join(facts))

        constraints = l1.get("constraints", [])
        if constraints:
            parts.append("Constraints: " + "; ".join(constraints))

        goals = l1.get("active_goals", [])
        if goals:
            parts.append("Active goals: " + "; ".join(goals))

        if not parts:
            return ""
        return "<openxnet-memory-context layer=\"L0+L1\">\n" + "\n".join(parts) + "\n</openxnet-memory-context>"

    async def build_contextual_recall(
        self,
        query: str,
        *,
        obs_store=None,
        knowledge_engine=None,
        max_tokens: int = 600,
    ) -> str:
        """Build L2+L3 context string on demand."""
        parts = []
        total_len = 0

        if obs_store and query:
            l2 = await self.get_l2(query, obs_store)
            for item in l2:
                line = f"[recall] {item.get('title', '')}: {item.get('summary', '')}"
                if total_len + len(line) > max_tokens * 4:
                    break
                parts.append(line)
                total_len += len(line)

        if knowledge_engine and query:
            l3 = await self.get_l3(query, knowledge_engine=knowledge_engine)
            for item in l3.get("knowledge", []):
                content = item.get("content", "") or item.get("summary", "")
                title = item.get("title", "")
                line = f"[knowledge] {title}: {content}" if title else f"[knowledge] {content}"
                if total_len + len(line) > max_tokens * 4:
                    break
                parts.append(line)
                total_len += len(line)

        if not parts:
            return ""
        return "<openxnet-memory-context layer=\"L2+L3\">\n" + "\n".join(parts) + "\n</openxnet-memory-context>"

    def _read_json(self, path: Path, default=None):
        try:
            if path.exists():
                return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            pass
        return default if default is not None else {}

    def _write_json(self, path: Path, data) -> None:
        try:
            path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception:
            pass


_stacks: Dict[str, LayeredMemoryStack] = {}


def get_layered_memory(workspace_dir: str) -> LayeredMemoryStack:
    normalized = str(Path(workspace_dir).expanduser().resolve())
    if normalized not in _stacks:
        _stacks[normalized] = LayeredMemoryStack(workspace_dir)
    return _stacks[normalized]
