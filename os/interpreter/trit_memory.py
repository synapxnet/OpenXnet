"""Trit-vector memory store for the OpenXnet kernel.

Provides content-addressable ternary memory with activation-based
decay, similarity search, and consolidation lifecycle management.
"""

from __future__ import annotations

import hashlib
import random
import re
import time
from dataclasses import dataclass, field
from typing import Any, Optional

from .ternary import TritVector


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class TritMemoryEntry:
    """A single entry in trit-vector memory."""

    key: str
    vector: TritVector
    metadata: dict[str, Any]
    activation: float = 1.0
    created_at: float = field(default_factory=time.time)
    last_accessed: float = field(default_factory=time.time)
    access_count: int = 0
    consolidated: bool = False

    def clamp_activation(self) -> None:
        """Clamp activation into [0.0, 1.0]."""
        self.activation = max(0.0, min(1.0, self.activation))


# ---------------------------------------------------------------------------
# Memory store
# ---------------------------------------------------------------------------

class TritMemoryStore:
    """Trit-vector content-addressable memory with activation dynamics."""

    def __init__(self, dim: int = 256, max_entries: int = 4096) -> None:
        self._dim = dim
        self._max_entries = max_entries
        self._entries: dict[str, TritMemoryEntry] = {}

    # -- properties ---------------------------------------------------------

    @property
    def dim(self) -> int:
        return self._dim

    @property
    def max_entries(self) -> int:
        return self._max_entries

    def __len__(self) -> int:
        return len(self._entries)

    # -- encoding -----------------------------------------------------------

    @staticmethod
    def _tokenize(text: str) -> list[str]:
        """Split *text* on whitespace and punctuation into lowercase tokens."""
        tokens = re.findall(r"[A-Za-z0-9]+", text.lower())
        return tokens

    def encode(self, text: str, metadata: Optional[dict] = None) -> TritVector:
        """Encode *text* into a sparse trit vector.

        Algorithm
        ---------
        1. Tokenize the text.
        2. For each token, SHA-256 hash it and seed a deterministic PRNG.
        3. Each PRNG generates a sparse contribution vector of floats.
        4. Accumulate contributions, then quantize using a threshold derived
           from the token count.
        """
        tokens = self._tokenize(text)
        if not tokens:
            return TritVector(self._dim)

        accumulator: list[float] = [0.0] * self._dim

        for token in tokens:
            digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
            seed = int(digest, 16) % (2**32)
            rng = random.Random(seed)
            for i in range(self._dim):
                r = rng.random()
                if r < 0.15:
                    accumulator[i] += 1.0
                elif r < 0.30:
                    accumulator[i] -= 1.0
                # else: no contribution (sparse)

        threshold = max(1, len(tokens) // 4)
        trits: list[int] = []
        for val in accumulator:
            if val > threshold:
                trits.append(1)
            elif val < -threshold:
                trits.append(-1)
            else:
                trits.append(0)

        return TritVector(self._dim, trits)

    # -- storage ------------------------------------------------------------

    def _evict_lowest(self) -> None:
        """Remove the entry with the lowest activation to make room."""
        if not self._entries:
            return
        worst_key = min(self._entries, key=lambda k: self._entries[k].activation)
        del self._entries[worst_key]

    def store(
        self,
        key: str,
        text: str,
        metadata: Optional[dict] = None,
    ) -> TritMemoryEntry:
        """Encode *text* and store the resulting vector under *key*."""
        vector = self.encode(text, metadata)
        return self.store_vector(key, vector, metadata)

    def store_vector(
        self,
        key: str,
        vector: TritVector,
        metadata: Optional[dict] = None,
    ) -> TritMemoryEntry:
        """Store a pre-encoded *vector* under *key*.

        If the store is full the lowest-activation entry is evicted first.
        """
        if key not in self._entries and len(self._entries) >= self._max_entries:
            self._evict_lowest()

        now = time.time()
        entry = TritMemoryEntry(
            key=key,
            vector=vector,
            metadata=metadata or {},
            activation=1.0,
            created_at=now,
            last_accessed=now,
            access_count=0,
            consolidated=False,
        )
        self._entries[key] = entry
        return entry

    # -- retrieval ----------------------------------------------------------

    def retrieve(self, key: str) -> Optional[TritMemoryEntry]:
        """Direct lookup by *key*.

        Boosts activation by 0.1 and updates access bookkeeping.
        """
        entry = self._entries.get(key)
        if entry is None:
            return None
        entry.last_accessed = time.time()
        entry.access_count += 1
        entry.activation = min(1.0, entry.activation + 0.1)
        return entry

    @staticmethod
    def _similarity(a: TritVector, b: TritVector) -> float:
        """Normalized ternary dot-product similarity in [-1.0, 1.0]."""
        trits_a = a.trits
        trits_b = b.trits
        length = min(len(trits_a), len(trits_b))
        if length == 0:
            return 0.0
        dot = 0
        norm_a = 0
        norm_b = 0
        for i in range(length):
            va = trits_a[i]
            vb = trits_b[i]
            dot += va * vb
            norm_a += va * va
            norm_b += vb * vb
        denom = (norm_a * norm_b) ** 0.5
        if denom == 0.0:
            return 0.0
        return dot / denom

    def search(
        self,
        query: TritVector,
        top_k: int = 5,
        threshold: float = 0.0,
    ) -> list[tuple[TritMemoryEntry, float]]:
        """Ternary similarity search weighted by activation.

        score = normalized_similarity * activation

        Returns up to *top_k* results with score >= *threshold*, sorted
        descending by score.
        """
        scored: list[tuple[TritMemoryEntry, float]] = []
        for entry in self._entries.values():
            sim = self._similarity(query, entry.vector)
            score = sim * entry.activation
            if score >= threshold:
                scored.append((entry, score))
        scored.sort(key=lambda pair: pair[1], reverse=True)
        return scored[:top_k]

    def search_text(
        self,
        query_text: str,
        top_k: int = 5,
    ) -> list[tuple[TritMemoryEntry, float]]:
        """Encode *query_text* then run a similarity search."""
        query_vec = self.encode(query_text)
        return self.search(query_vec, top_k=top_k)

    # -- maintenance --------------------------------------------------------

    def decay_all(self, rate: float = 0.05) -> int:
        """Subtract *rate* from every entry's activation (clamped at 0).

        Returns the count of entries whose activation fell below 0.01.
        """
        low_count = 0
        for entry in self._entries.values():
            entry.activation = max(0.0, entry.activation - rate)
            if entry.activation < 0.01:
                low_count += 1
        return low_count

    def apply_trit_decay(self, probability: float = 0.02) -> None:
        """Stochastically decay individual trits toward zero.

        The effective probability for each entry is
        ``probability * (2 - activation)``, so less-activated entries
        decay faster.
        """
        for entry in self._entries.values():
            effective_prob = probability * (2.0 - entry.activation)
            trits = entry.vector.trits
            for i in range(len(trits)):
                if trits[i] != 0 and random.random() < effective_prob:
                    trits[i] = 0

    def inject_contradiction(self, key: str, dimensions: list[int]) -> bool:
        """Flip the trit values at the given *dimensions* for entry *key*.

        +1 -> -1, -1 -> +1, 0 stays 0.  Returns False if *key* not found.
        """
        entry = self._entries.get(key)
        if entry is None:
            return False
        trits = entry.vector.trits
        for d in dimensions:
            if 0 <= d < len(trits):
                v = trits[d]
                if v != 0:
                    trits[d] = -v
        return True

    def evict_below(self, threshold: float = 0.01) -> int:
        """Remove all entries with activation below *threshold*.

        Returns the number of entries removed.
        """
        to_remove = [
            k for k, e in self._entries.items() if e.activation < threshold
        ]
        for k in to_remove:
            del self._entries[k]
        return len(to_remove)

    def get_consolidation_candidates(
        self,
        activation_threshold: float = 0.7,
        access_threshold: int = 3,
    ) -> list[TritMemoryEntry]:
        """Return entries eligible for consolidation.

        An entry qualifies if it is *not* already consolidated, its
        activation >= *activation_threshold*, and its access_count >=
        *access_threshold*.
        """
        return [
            e
            for e in self._entries.values()
            if not e.consolidated
            and e.activation >= activation_threshold
            and e.access_count >= access_threshold
        ]

    def mark_consolidated(self, key: str) -> None:
        """Flag the entry under *key* as consolidated."""
        entry = self._entries.get(key)
        if entry is not None:
            entry.consolidated = True

    # -- stats --------------------------------------------------------------

    def stats(self) -> dict:
        """Return a summary snapshot of the memory store."""
        entries = list(self._entries.values())
        count = len(entries)
        if count == 0:
            return {
                "entry_count": 0,
                "dim": self._dim,
                "avg_activation": 0.0,
                "total_nonzero_ratio": 0.0,
                "consolidated_count": 0,
            }

        avg_activation = sum(e.activation for e in entries) / count

        total_trits = 0
        nonzero_trits = 0
        for e in entries:
            trits = e.vector.trits
            total_trits += len(trits)
            nonzero_trits += sum(1 for t in trits if t != 0)

        nonzero_ratio = nonzero_trits / total_trits if total_trits else 0.0
        consolidated_count = sum(1 for e in entries if e.consolidated)

        return {
            "entry_count": count,
            "dim": self._dim,
            "avg_activation": round(avg_activation, 4),
            "total_nonzero_ratio": round(nonzero_ratio, 4),
            "consolidated_count": consolidated_count,
        }
