#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
Hebbian memory reinforcement and sleep-cycle consolidation.

Implements cognitive memory patterns inspired by Turiya:
1. Hebbian reinforcement — memories strengthen with use, decay when unused
2. Sleep-cycle consolidation — periodic dedup, pruning, generalization
3. Contradiction detection — flag conflicting facts for resolution

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
import math
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

logger = logging.getLogger("app")

DECAY_RATE = 0.05
ACTIVATION_BOOST = 0.15
MIN_ACTIVATION = 0.01
PRUNE_THRESHOLD = 0.05
MAX_ENTRIES = 500


class HebbianMemoryEntry:
    """A memory entry with Hebbian activation tracking."""

    def __init__(
        self,
        content: str,
        *,
        entry_id: str = "",
        memory_type: str = "episodic",
        activation: float = 1.0,
        access_count: int = 0,
        created_at: str = "",
        last_accessed: str = "",
        entities: List[str] = None,
        tags: List[str] = None,
        contradicts: List[str] = None,
    ):
        self.content = content
        self.entry_id = entry_id
        self.memory_type = memory_type
        self.activation = activation
        self.access_count = access_count
        self.created_at = created_at or datetime.now().isoformat()
        self.last_accessed = last_accessed or self.created_at
        self.entities = entities or []
        self.tags = tags or []
        self.contradicts = contradicts or []

    def reinforce(self) -> None:
        self.activation = min(1.0, self.activation + ACTIVATION_BOOST)
        self.access_count += 1
        self.last_accessed = datetime.now().isoformat()

    def decay(self, elapsed_hours: float = 24.0) -> None:
        decay_factor = math.exp(-DECAY_RATE * (elapsed_hours / 24.0))
        self.activation = max(MIN_ACTIVATION, self.activation * decay_factor)

    def should_prune(self) -> bool:
        return self.activation < PRUNE_THRESHOLD and self.access_count < 2

    def to_dict(self) -> dict:
        return {
            "content": self.content,
            "entry_id": self.entry_id,
            "memory_type": self.memory_type,
            "activation": round(self.activation, 4),
            "access_count": self.access_count,
            "created_at": self.created_at,
            "last_accessed": self.last_accessed,
            "entities": self.entities,
            "tags": self.tags,
            "contradicts": self.contradicts,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "HebbianMemoryEntry":
        return cls(
            content=str(data.get("content") or ""),
            entry_id=str(data.get("entry_id") or ""),
            memory_type=str(data.get("memory_type") or "episodic"),
            activation=float(data.get("activation") or 1.0),
            access_count=int(data.get("access_count") or 0),
            created_at=str(data.get("created_at") or ""),
            last_accessed=str(data.get("last_accessed") or ""),
            entities=list(data.get("entities") or []),
            tags=list(data.get("tags") or []),
            contradicts=list(data.get("contradicts") or []),
        )


class HebbianMemoryStore:
    """Hebbian memory store with reinforcement, decay, and sleep consolidation."""

    def __init__(self, workspace_dir: str):
        self.workspace_dir = Path(workspace_dir).expanduser()
        self.memory_dir = self.workspace_dir / ".agent" / "memory"
        self.memory_dir.mkdir(parents=True, exist_ok=True)
        self.store_file = self.memory_dir / "hebbian_store.json"
        self._entries: List[HebbianMemoryEntry] = []
        self._loaded = False

    def _load(self) -> None:
        if self._loaded:
            return
        data = self._read_json(self.store_file, default=[])
        self._entries = [HebbianMemoryEntry.from_dict(d) for d in data if isinstance(d, dict)]
        self._loaded = True

    def _save(self) -> None:
        self._write_json(self.store_file, [e.to_dict() for e in self._entries])

    def add(self, content: str, **kwargs) -> HebbianMemoryEntry:
        self._load()
        import hashlib
        entry_id = hashlib.md5(content.encode("utf-8")).hexdigest()[:12]
        for existing in self._entries:
            if existing.entry_id == entry_id:
                existing.reinforce()
                self._save()
                return existing
        entry = HebbianMemoryEntry(content, entry_id=entry_id, **kwargs)
        self._entries.insert(0, entry)
        if len(self._entries) > MAX_ENTRIES:
            self._entries = self._entries[:MAX_ENTRIES]
        self._save()
        return entry

    def recall(self, query: str, top_k: int = 5) -> List[HebbianMemoryEntry]:
        self._load()
        query_lower = query.lower()
        scored = []
        for entry in self._entries:
            content_lower = entry.content.lower()
            relevance = sum(1 for word in query_lower.split() if word in content_lower)
            if relevance > 0:
                score = relevance * entry.activation
                scored.append((score, entry))
        scored.sort(key=lambda x: x[0], reverse=True)
        for _, entry in scored[:top_k]:
            entry.reinforce()
        if scored:
            self._save()
        return [entry for _, entry in scored[:top_k]]

    def decay_all(self, elapsed_hours: float = 24.0) -> int:
        self._load()
        for entry in self._entries:
            entry.decay(elapsed_hours)
        self._save()
        return len(self._entries)

    def sleep_consolidation(self) -> Dict[str, int]:
        """Run sleep-cycle memory consolidation: decay, prune, dedup."""
        self._load()
        stats = {"decayed": 0, "pruned": 0, "deduplicated": 0, "remaining": 0}

        for entry in self._entries:
            entry.decay(24.0)
            stats["decayed"] += 1

        before = len(self._entries)
        self._entries = [e for e in self._entries if not e.should_prune()]
        stats["pruned"] = before - len(self._entries)

        seen_content: Set[str] = set()
        deduped = []
        for entry in self._entries:
            key = entry.content[:100].lower().strip()
            if key in seen_content:
                stats["deduplicated"] += 1
                continue
            seen_content.add(key)
            deduped.append(entry)
        self._entries = deduped

        stats["remaining"] = len(self._entries)
        self._save()
        return stats

    def detect_contradictions(self) -> List[Dict[str, Any]]:
        """Simple contradiction detection: find entries with opposing signals."""
        self._load()
        contradictions = []
        negation_pairs = [
            ("是", "不是"), ("有", "没有"), ("可以", "不可以"),
            ("should", "should not"), ("is", "is not"), ("can", "cannot"),
            ("true", "false"), ("yes", "no"), ("enable", "disable"),
        ]
        for i, a in enumerate(self._entries):
            for j, b in enumerate(self._entries):
                if i >= j:
                    continue
                a_lower = a.content.lower()
                b_lower = b.content.lower()
                for pos, neg in negation_pairs:
                    if pos in a_lower and neg in b_lower:
                        shared = set(a_lower.split()) & set(b_lower.split())
                        if len(shared) >= 2:
                            contradictions.append({
                                "entry_a": a.to_dict(),
                                "entry_b": b.to_dict(),
                                "signal": f"{pos} vs {neg}",
                                "shared_words": list(shared)[:5],
                            })
                            break
        return contradictions[:10]

    def get_stats(self) -> Dict[str, Any]:
        self._load()
        if not self._entries:
            return {"total": 0, "avg_activation": 0, "types": {}}
        types: Dict[str, int] = {}
        total_activation = 0
        for e in self._entries:
            types[e.memory_type] = types.get(e.memory_type, 0) + 1
            total_activation += e.activation
        return {
            "total": len(self._entries),
            "avg_activation": round(total_activation / len(self._entries), 4),
            "types": types,
            "oldest": self._entries[-1].created_at if self._entries else "",
            "newest": self._entries[0].created_at if self._entries else "",
        }

    def _read_json(self, path: Path, default=None):
        try:
            if path.exists():
                return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            pass
        return default if default is not None else []

    def _write_json(self, path: Path, data) -> None:
        try:
            path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception:
            pass


_stores: Dict[str, HebbianMemoryStore] = {}


def get_hebbian_store(workspace_dir: str) -> HebbianMemoryStore:
    normalized = str(Path(workspace_dir).expanduser().resolve())
    if normalized not in _stores:
        _stores[normalized] = HebbianMemoryStore(workspace_dir)
    return _stores[normalized]
