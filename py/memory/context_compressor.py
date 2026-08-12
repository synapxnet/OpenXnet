#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
Context compression and pre-reasoning hooks for memory-efficient agent execution.

Implements three capabilities inspired by ReMe and SimpleMem:
1. Pre-reasoning context compaction — auto-trim old context before each reasoning step
2. Structured context summaries — Goal/Constraints/Progress/Decisions/Next format
3. Semantic compression — compress dialogues into atomic memory units

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

import hashlib
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("app")


class StructuredSummary:
    """Structured context summary in Goal/Constraints/Progress/Decisions/Next format."""

    def __init__(
        self,
        goal: str = "",
        constraints: List[str] = None,
        progress: List[str] = None,
        key_decisions: List[str] = None,
        next_steps: List[str] = None,
        timestamp: str = "",
    ):
        self.goal = goal
        self.constraints = constraints or []
        self.progress = progress or []
        self.key_decisions = key_decisions or []
        self.next_steps = next_steps or []
        self.timestamp = timestamp or datetime.now().isoformat()

    def to_dict(self) -> dict:
        return {
            "goal": self.goal,
            "constraints": self.constraints,
            "progress": self.progress,
            "key_decisions": self.key_decisions,
            "next_steps": self.next_steps,
            "timestamp": self.timestamp,
        }

    def to_context_string(self) -> str:
        parts = []
        if self.goal:
            parts.append(f"Goal: {self.goal}")
        if self.constraints:
            parts.append("Constraints: " + "; ".join(self.constraints))
        if self.progress:
            parts.append("Progress: " + "; ".join(self.progress))
        if self.key_decisions:
            parts.append("Key decisions: " + "; ".join(self.key_decisions))
        if self.next_steps:
            parts.append("Next steps: " + "; ".join(self.next_steps))
        if not parts:
            return ""
        return "\n".join(parts)

    @classmethod
    def from_dict(cls, data: dict) -> "StructuredSummary":
        return cls(
            goal=str(data.get("goal") or ""),
            constraints=list(data.get("constraints") or []),
            progress=list(data.get("progress") or []),
            key_decisions=list(data.get("key_decisions") or []),
            next_steps=list(data.get("next_steps") or []),
            timestamp=str(data.get("timestamp") or ""),
        )


class AtomicMemoryUnit:
    """A single compressed memory fact with metadata."""

    def __init__(
        self,
        content: str,
        *,
        source: str = "",
        entities: List[str] = None,
        timestamp: str = "",
        importance: float = 0.5,
        memory_type: str = "episodic",
    ):
        self.content = content
        self.source = source
        self.entities = entities or []
        self.timestamp = timestamp or datetime.now().isoformat()
        self.importance = importance
        self.memory_type = memory_type
        self.content_hash = hashlib.md5(content.encode("utf-8")).hexdigest()[:12]

    def to_dict(self) -> dict:
        return {
            "content": self.content,
            "source": self.source,
            "entities": self.entities,
            "timestamp": self.timestamp,
            "importance": self.importance,
            "memory_type": self.memory_type,
            "content_hash": self.content_hash,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "AtomicMemoryUnit":
        unit = cls(
            content=str(data.get("content") or ""),
            source=str(data.get("source") or ""),
            entities=list(data.get("entities") or []),
            timestamp=str(data.get("timestamp") or ""),
            importance=float(data.get("importance") or 0.5),
            memory_type=str(data.get("memory_type") or "episodic"),
        )
        unit.content_hash = str(data.get("content_hash") or unit.content_hash)
        return unit


class ContextCompressor:
    """Pre-reasoning context compaction and semantic compression."""

    def __init__(self, workspace_dir: str):
        self.workspace_dir = Path(workspace_dir).expanduser()
        self.memory_dir = self.workspace_dir / ".agent" / "memory"
        self.memory_dir.mkdir(parents=True, exist_ok=True)
        self.summaries_file = self.memory_dir / "structured_summaries.json"
        self.atoms_file = self.memory_dir / "atomic_memories.json"

    def compact_tool_results(
        self, messages: List[Dict[str, Any]], keep_recent: int = 3
    ) -> List[Dict[str, Any]]:
        """Compact old tool results: keep recent N full, truncate older ones."""
        tool_indices = [
            i for i, m in enumerate(messages)
            if m.get("role") == "tool" or m.get("tool_call_id")
        ]
        if len(tool_indices) <= keep_recent:
            return messages

        old_indices = set(tool_indices[:-keep_recent])
        result = []
        for i, msg in enumerate(messages):
            if i in old_indices:
                content = str(msg.get("content") or "")
                if len(content) > 200:
                    compacted = dict(msg)
                    compacted["content"] = content[:180] + "... [compacted]"
                    result.append(compacted)
                else:
                    result.append(msg)
            else:
                result.append(msg)
        return result

    def build_structured_summary(
        self,
        *,
        goal: str = "",
        constraints: List[str] = None,
        progress: List[str] = None,
        key_decisions: List[str] = None,
        next_steps: List[str] = None,
    ) -> StructuredSummary:
        summary = StructuredSummary(
            goal=goal,
            constraints=constraints,
            progress=progress,
            key_decisions=key_decisions,
            next_steps=next_steps,
        )
        self._save_summary(summary)
        return summary

    def get_latest_summary(self) -> Optional[StructuredSummary]:
        summaries = self._read_json(self.summaries_file, default=[])
        if not summaries:
            return None
        return StructuredSummary.from_dict(summaries[0])

    def extract_atomic_memories(
        self, text: str, source: str = "conversation"
    ) -> List[AtomicMemoryUnit]:
        """Extract atomic memory units from text using simple heuristics."""
        sentences = []
        for delimiter in ["。", ".", "！", "!", "？", "?"]:
            text = text.replace(delimiter, delimiter + "\n")
        raw = [s.strip() for s in text.split("\n") if s.strip()]

        units = []
        seen_hashes = set()
        for sentence in raw:
            if len(sentence) < 10 or len(sentence) > 500:
                continue
            unit = AtomicMemoryUnit(
                content=sentence,
                source=source,
                importance=self._estimate_importance(sentence),
                memory_type=self._classify_memory_type(sentence),
            )
            if unit.content_hash not in seen_hashes:
                seen_hashes.add(unit.content_hash)
                units.append(unit)

        if units:
            self._save_atoms(units)
        return units

    def get_atomic_memories(self, limit: int = 20) -> List[AtomicMemoryUnit]:
        data = self._read_json(self.atoms_file, default=[])
        return [AtomicMemoryUnit.from_dict(d) for d in data[:limit]]

    def deduplicate_atoms(self) -> int:
        data = self._read_json(self.atoms_file, default=[])
        seen = set()
        deduped = []
        for item in data:
            h = item.get("content_hash", "")
            if h and h in seen:
                continue
            if h:
                seen.add(h)
            deduped.append(item)
        removed = len(data) - len(deduped)
        if removed > 0:
            self._write_json(self.atoms_file, deduped)
        return removed

    def pre_reasoning_compact(
        self,
        messages: List[Dict[str, Any]],
        max_messages: int = 40,
        keep_recent: int = 3,
    ) -> List[Dict[str, Any]]:
        """Pre-reasoning hook: compact context before each reasoning step."""
        if len(messages) <= max_messages:
            return self.compact_tool_results(messages, keep_recent=keep_recent)

        system_msgs = [m for m in messages if m.get("role") == "system"]
        non_system = [m for m in messages if m.get("role") != "system"]

        keep_count = max_messages - len(system_msgs)
        if keep_count < 4:
            keep_count = 4

        trimmed = non_system[-keep_count:]
        result = system_msgs + trimmed
        return self.compact_tool_results(result, keep_recent=keep_recent)

    def _estimate_importance(self, text: str) -> float:
        text_lower = text.lower()
        score = 0.5
        high_signal = ["决定", "必须", "不要", "关键", "重要", "注意", "错误", "失败",
                       "decided", "must", "critical", "important", "error", "failed", "bug"]
        for signal in high_signal:
            if signal in text_lower:
                score += 0.1
        return min(1.0, score)

    def _classify_memory_type(self, text: str) -> str:
        text_lower = text.lower()
        if any(k in text_lower for k in ["决定", "选择", "decided", "chose", "decision"]):
            return "decision"
        if any(k in text_lower for k in ["步骤", "流程", "how to", "procedure", "step"]):
            return "procedural"
        if any(k in text_lower for k in ["是", "有", "包含", "is", "has", "contains", "fact"]):
            return "semantic"
        return "episodic"

    def _save_summary(self, summary: StructuredSummary) -> None:
        data = self._read_json(self.summaries_file, default=[])
        data.insert(0, summary.to_dict())
        data = data[:20]
        self._write_json(self.summaries_file, data)

    def _save_atoms(self, units: List[AtomicMemoryUnit]) -> None:
        data = self._read_json(self.atoms_file, default=[])
        existing_hashes = {d.get("content_hash") for d in data}
        for unit in units:
            if unit.content_hash not in existing_hashes:
                data.insert(0, unit.to_dict())
                existing_hashes.add(unit.content_hash)
        data = data[:200]
        self._write_json(self.atoms_file, data)

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


_compressors: Dict[str, ContextCompressor] = {}


def get_context_compressor(workspace_dir: str) -> ContextCompressor:
    normalized = str(Path(workspace_dir).expanduser().resolve())
    if normalized not in _compressors:
        _compressors[normalized] = ContextCompressor(workspace_dir)
    return _compressors[normalized]
