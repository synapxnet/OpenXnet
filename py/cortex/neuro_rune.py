#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
Neuro-Rune Engine — 神经符文引擎。

OpenXnet 大脑的基本认知单元。每个符文是符号逻辑与神经激活的融合体，
可被强化、衰减、矛盾仲裁、泛化、固化为技能。

符文类型：
- 认知符文 (cognitive)   — 来自 NeuroSymbol 的 14 种认知算子
- 事实符文 (factual)     — 来自 Temporal KG 的时间感知三元组
- 记忆符文 (memory)      — 来自 Hebbian 的自强化记忆
- 观察符文 (observation) — 来自 ObservationStore 的执行观察
- 技能符文 (skill)       — 来自 SkillLibrary 的可执行经验
- 原子符文 (atomic)      — 来自 ContextCompressor 的语义最小单元
- 守护符文 (guardian)    — 来自 ReviewGate 的安全规则

Author: Claude Code
Department: R&D
Date: 2026-04-19
Version: 1.0.0
Security Level: INTERNAL
"""

__version__ = "1.0.0"
__author__ = "Claude Code"
__copyright__ = "Copyright 2026 Synapxnet"

import hashlib
import json
import logging
import math
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("app")

RUNE_TYPES = {
    "cognitive", "factual", "memory", "observation",
    "skill", "atomic", "guardian",
}


class NeuroRune:
    """A single neuro-rune: the fundamental cognitive unit of OpenXnet's brain."""

    def __init__(
        self,
        content: str,
        rune_type: str = "memory",
        *,
        rune_id: str = "",
        symbol_face: Dict[str, Any] = None,
        activation: float = 1.0,
        confidence: float = 0.8,
        decay_rate: float = 0.05,
        access_count: int = 0,
        entities: List[str] = None,
        relations: List[Dict[str, str]] = None,
        logic_chain: List[str] = None,
        source_module: str = "",
        created_at: str = "",
        last_activated: str = "",
        contradicts: List[str] = None,
        evolved_from: str = "",
    ):
        self.content = content
        self.rune_type = rune_type if rune_type in RUNE_TYPES else "memory"
        self.rune_id = rune_id or hashlib.md5(
            f"{rune_type}:{content}".encode("utf-8")
        ).hexdigest()[:14]
        self.symbol_face = symbol_face or {}
        self.activation = activation
        self.confidence = confidence
        self.decay_rate = decay_rate
        self.access_count = access_count
        self.entities = entities or []
        self.relations = relations or []
        self.logic_chain = logic_chain or []
        self.source_module = source_module
        self.created_at = created_at or datetime.now().isoformat()
        self.last_activated = last_activated or self.created_at
        self.contradicts = contradicts or []
        self.evolved_from = evolved_from

    def activate(self, boost: float = 0.15) -> None:
        self.activation = min(1.0, self.activation + boost)
        self.access_count += 1
        self.last_activated = datetime.now().isoformat()

    def decay(self, hours_elapsed: float = 24.0) -> None:
        factor = math.exp(-self.decay_rate * (hours_elapsed / 24.0))
        self.activation = max(0.01, self.activation * factor)

    @property
    def strength(self) -> float:
        return self.activation * self.confidence

    @property
    def is_dormant(self) -> bool:
        return self.activation < 0.05 and self.access_count < 2

    def to_dict(self) -> dict:
        return {
            "rune_id": self.rune_id,
            "content": self.content,
            "rune_type": self.rune_type,
            "symbol_face": self.symbol_face,
            "activation": round(self.activation, 4),
            "confidence": round(self.confidence, 4),
            "strength": round(self.strength, 4),
            "decay_rate": self.decay_rate,
            "access_count": self.access_count,
            "entities": self.entities,
            "relations": self.relations,
            "logic_chain": self.logic_chain,
            "source_module": self.source_module,
            "created_at": self.created_at,
            "last_activated": self.last_activated,
            "contradicts": self.contradicts,
            "evolved_from": self.evolved_from,
            "is_dormant": self.is_dormant,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "NeuroRune":
        return cls(
            content=str(data.get("content") or ""),
            rune_type=str(data.get("rune_type") or "memory"),
            rune_id=str(data.get("rune_id") or ""),
            symbol_face=dict(data.get("symbol_face") or {}),
            activation=float(data.get("activation") or 1.0),
            confidence=float(data.get("confidence") or 0.8),
            decay_rate=float(data.get("decay_rate") or 0.05),
            access_count=int(data.get("access_count") or 0),
            entities=list(data.get("entities") or []),
            relations=list(data.get("relations") or []),
            logic_chain=list(data.get("logic_chain") or []),
            source_module=str(data.get("source_module") or ""),
            created_at=str(data.get("created_at") or ""),
            last_activated=str(data.get("last_activated") or ""),
            contradicts=list(data.get("contradicts") or []),
            evolved_from=str(data.get("evolved_from") or ""),
        )


class NeuroRuneEngine:
    """Manages the neuro-rune lattice: creation, activation, evolution, search."""

    def __init__(self, workspace_dir: str):
        self.workspace_dir = Path(workspace_dir).expanduser()
        self.rune_dir = self.workspace_dir / ".agent" / "runes"
        self.rune_dir.mkdir(parents=True, exist_ok=True)
        self.rune_file = self.rune_dir / "rune_lattice.json"
        self._runes: Dict[str, NeuroRune] = {}
        self._loaded = False

    def _load(self) -> None:
        if self._loaded:
            return
        try:
            if self.rune_file.exists():
                data = json.loads(self.rune_file.read_text(encoding="utf-8"))
                for item in data:
                    rune = NeuroRune.from_dict(item)
                    self._runes[rune.rune_id] = rune
        except Exception:
            pass
        self._loaded = True

    def _save(self) -> None:
        try:
            data = [r.to_dict() for r in self._runes.values()]
            self.rune_file.write_text(
                json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
            )
        except Exception:
            pass

    def inscribe(self, content: str, rune_type: str = "memory", **kwargs) -> NeuroRune:
        """Inscribe a new rune or reinforce an existing one."""
        self._load()
        temp = NeuroRune(content, rune_type, **kwargs)
        existing = self._runes.get(temp.rune_id)
        if existing:
            existing.activate()
            self._save()
            return existing
        self._runes[temp.rune_id] = temp
        self._save()
        return temp

    def recall(self, query: str, top_k: int = 5, rune_type: str = "") -> List[NeuroRune]:
        """Recall runes by relevance, weighted by activation strength."""
        self._load()
        query_lower = query.lower()
        scored = []
        for rune in self._runes.values():
            if rune_type and rune.rune_type != rune_type:
                continue
            text = f"{rune.content} {' '.join(rune.entities)}".lower()
            relevance = sum(1 for w in query_lower.split() if w in text)
            if relevance > 0:
                score = relevance * rune.strength
                scored.append((score, rune))
        scored.sort(key=lambda x: x[0], reverse=True)
        for _, rune in scored[:top_k]:
            rune.activate(boost=0.08)
        if scored:
            self._save()
        return [r for _, r in scored[:top_k]]

    def evolve(self) -> Dict[str, int]:
        """Run one evolution cycle: decay, prune dormant, detect contradictions."""
        self._load()
        stats = {"decayed": 0, "pruned": 0, "contradictions": 0, "remaining": 0}
        for rune in self._runes.values():
            rune.decay(24.0)
            stats["decayed"] += 1
        before = len(self._runes)
        self._runes = {
            rid: r for rid, r in self._runes.items() if not r.is_dormant
        }
        stats["pruned"] = before - len(self._runes)
        stats["contradictions"] = len(self._detect_contradictions())
        stats["remaining"] = len(self._runes)
        self._save()
        return stats

    def crystallize_skill(self, rune_id: str, skill_name: str) -> Optional[Dict[str, Any]]:
        """Crystallize a high-activation rune into a skill rune."""
        self._load()
        source = self._runes.get(rune_id)
        if not source or source.activation < 0.5:
            return None
        skill_rune = self.inscribe(
            content=f"Skill: {skill_name} — {source.content[:150]}",
            rune_type="skill",
            source_module="evolution",
            evolved_from=rune_id,
            confidence=source.confidence,
        )
        return skill_rune.to_dict()

    def _detect_contradictions(self) -> List[Dict[str, Any]]:
        contradictions = []
        rune_list = list(self._runes.values())
        negation_pairs = [
            ("是", "不是"), ("可以", "不可以"), ("should", "should not"),
            ("true", "false"), ("enable", "disable"),
        ]
        for i, a in enumerate(rune_list):
            for j, b in enumerate(rune_list):
                if i >= j:
                    continue
                a_lower = a.content.lower()
                b_lower = b.content.lower()
                for pos, neg in negation_pairs:
                    if pos in a_lower and neg in b_lower:
                        shared = set(a_lower.split()) & set(b_lower.split())
                        if len(shared) >= 2:
                            a.contradicts = list(set(a.contradicts + [b.rune_id]))
                            b.contradicts = list(set(b.contradicts + [a.rune_id]))
                            contradictions.append({
                                "rune_a": a.rune_id,
                                "rune_b": b.rune_id,
                            })
                            break
        return contradictions[:20]

    def get_lattice_stats(self) -> Dict[str, Any]:
        self._load()
        if not self._runes:
            return {"total": 0, "types": {}, "avg_activation": 0, "avg_strength": 0}
        types: Dict[str, int] = {}
        total_activation = 0
        total_strength = 0
        for r in self._runes.values():
            types[r.rune_type] = types.get(r.rune_type, 0) + 1
            total_activation += r.activation
            total_strength += r.strength
        n = len(self._runes)
        return {
            "total": n,
            "types": types,
            "avg_activation": round(total_activation / n, 4),
            "avg_strength": round(total_strength / n, 4),
            "dormant_count": sum(1 for r in self._runes.values() if r.is_dormant),
            "contradiction_count": sum(1 for r in self._runes.values() if r.contradicts),
        }

    def export_for_context(self, query: str = "", top_k: int = 5) -> str:
        """Export relevant runes as context injection string."""
        if query:
            runes = self.recall(query, top_k=top_k)
        else:
            self._load()
            runes = sorted(
                self._runes.values(), key=lambda r: r.strength, reverse=True
            )[:top_k]
        if not runes:
            return ""
        lines = []
        for r in runes:
            marker = f"[{r.rune_type}|{r.strength:.2f}]"
            lines.append(f"{marker} {r.content}")
        return "<openxnet-neuro-runes>\n" + "\n".join(lines) + "\n</openxnet-neuro-runes>"


_engines: Dict[str, NeuroRuneEngine] = {}


def get_rune_engine(workspace_dir: str) -> NeuroRuneEngine:
    normalized = str(Path(workspace_dir).expanduser().resolve())
    if normalized not in _engines:
        _engines[normalized] = NeuroRuneEngine(workspace_dir)
    return _engines[normalized]
