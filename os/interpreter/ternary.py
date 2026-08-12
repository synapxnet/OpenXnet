"""
ternary.py — Balanced ternary logic and vector algebra for the OpenXnet kernel.

Provides:
  - Trit / TernaryValue enums
  - Kleene strong three-valued logic (AND, OR, NOT, IMPLIES)
  - TritVector: fixed-width balanced-ternary vector with arithmetic,
    similarity metrics, stochastic decay, and compact serialisation.
"""

from __future__ import annotations

import random as _random
from dataclasses import dataclass, field
from enum import IntEnum
from types import MappingProxyType
from typing import Iterable, Sequence

# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class Trit(IntEnum):
    """Balanced ternary digit."""
    NEG = -1
    UNK =  0
    POS = +1


class TernaryValue(IntEnum):
    """Three-valued truth value (Kleene semantics)."""
    FALSE   = -1
    UNKNOWN =  0
    TRUE    = +1


# ---------------------------------------------------------------------------
# Kleene strong three-valued logic — precomputed truth tables
# ---------------------------------------------------------------------------

_TV = TernaryValue

_AND_TABLE: dict[tuple[TernaryValue, TernaryValue], TernaryValue] = MappingProxyType({
    (_TV.FALSE, _TV.FALSE):   _TV.FALSE,
    (_TV.FALSE, _TV.UNKNOWN): _TV.FALSE,
    (_TV.FALSE, _TV.TRUE):    _TV.FALSE,
    (_TV.UNKNOWN, _TV.FALSE): _TV.FALSE,
    (_TV.UNKNOWN, _TV.UNKNOWN): _TV.UNKNOWN,
    (_TV.UNKNOWN, _TV.TRUE):  _TV.UNKNOWN,
    (_TV.TRUE, _TV.FALSE):    _TV.FALSE,
    (_TV.TRUE, _TV.UNKNOWN):  _TV.UNKNOWN,
    (_TV.TRUE, _TV.TRUE):     _TV.TRUE,
})

_OR_TABLE: dict[tuple[TernaryValue, TernaryValue], TernaryValue] = MappingProxyType({
    (_TV.FALSE, _TV.FALSE):   _TV.FALSE,
    (_TV.FALSE, _TV.UNKNOWN): _TV.UNKNOWN,
    (_TV.FALSE, _TV.TRUE):    _TV.TRUE,
    (_TV.UNKNOWN, _TV.FALSE): _TV.UNKNOWN,
    (_TV.UNKNOWN, _TV.UNKNOWN): _TV.UNKNOWN,
    (_TV.UNKNOWN, _TV.TRUE):  _TV.TRUE,
    (_TV.TRUE, _TV.FALSE):    _TV.TRUE,
    (_TV.TRUE, _TV.UNKNOWN):  _TV.TRUE,
    (_TV.TRUE, _TV.TRUE):     _TV.TRUE,
})


def trit_and(a: TernaryValue, b: TernaryValue) -> TernaryValue:
    """Kleene strong conjunction — FALSE is infectious."""
    return _AND_TABLE[(TernaryValue(a), TernaryValue(b))]


def trit_or(a: TernaryValue, b: TernaryValue) -> TernaryValue:
    """Kleene strong disjunction — TRUE is infectious."""
    return _OR_TABLE[(TernaryValue(a), TernaryValue(b))]


def trit_not(a: TernaryValue) -> TernaryValue:
    """Kleene negation: TRUE<->FALSE, UNKNOWN stays."""
    return TernaryValue(-int(a))


def trit_implies(a: TernaryValue, b: TernaryValue) -> TernaryValue:
    """Material implication: a → b  ≡  ¬a ∨ b."""
    return trit_or(trit_not(a), b)


# ---------------------------------------------------------------------------
# TritVector
# ---------------------------------------------------------------------------

_VALID_TRITS = frozenset({-1, 0, 1})
_TRITS_PER_BYTE = 5          # 3^5 = 243 < 256
_BASE_POWERS = (81, 27, 9, 3, 1)  # 3^4 … 3^0


@dataclass
class TritVector:
    """Fixed-dimension vector over the balanced ternary alphabet {-1, 0, +1}."""

    dim: int
    _data: list[int] = field(repr=False)

    # -- construction -------------------------------------------------------

    def __init__(self, dim: int, data: Sequence[int] | None = None) -> None:
        if dim < 0:
            raise ValueError(f"dim must be non-negative, got {dim}")
        object.__setattr__(self, "dim", dim)
        if data is None:
            object.__setattr__(self, "_data", [0] * dim)
        else:
            if len(data) != dim:
                raise ValueError(
                    f"data length ({len(data)}) != dim ({dim})"
                )
            for i, v in enumerate(data):
                if v not in _VALID_TRITS:
                    raise ValueError(
                        f"Invalid trit value {v!r} at index {i}; "
                        f"must be one of {{-1, 0, +1}}"
                    )
            object.__setattr__(self, "_data", list(data))

    @property
    def trits(self) -> list[int]:
        return self._data

    # -- arithmetic / metrics -----------------------------------------------

    def dot(self, other: TritVector) -> int:
        """Inner product: sum of element-wise multiplication."""
        if self.dim != other.dim:
            raise ValueError("Dimension mismatch")
        return sum(a * b for a, b in zip(self._data, other._data))

    def normalized_similarity(self, other: TritVector) -> float:
        """Dot product divided by dimension — lies in [-1.0, +1.0]."""
        if self.dim == 0:
            return 0.0
        return self.dot(other) / self.dim

    def hamming_distance(self, other: TritVector) -> int:
        """Number of positions where the two vectors differ."""
        if self.dim != other.dim:
            raise ValueError("Dimension mismatch")
        return sum(a != b for a, b in zip(self._data, other._data))

    def nonzero_count(self) -> int:
        """Information density: count of non-zero trits."""
        return sum(t != 0 for t in self._data)

    # -- mutation helpers (return new vectors) -------------------------------

    def decay(self, probability: float) -> TritVector:
        """Return a copy where each non-zero trit becomes 0 with *probability*."""
        if not 0.0 <= probability <= 1.0:
            raise ValueError("probability must be in [0.0, 1.0]")
        new_data = [
            0 if (t != 0 and _random.random() < probability) else t
            for t in self._data
        ]
        return TritVector(self.dim, new_data)

    def flip(self, indices: Iterable[int]) -> TritVector:
        """Return a copy with specified positions negated."""
        new_data = list(self._data)
        for idx in indices:
            if not 0 <= idx < self.dim:
                raise IndexError(f"Index {idx} out of range [0, {self.dim})")
            new_data[idx] = -new_data[idx]
        return TritVector(self.dim, new_data)

    def merge(self, other: TritVector, mode: str = "majority") -> TritVector:
        """Merge two vectors.

        Modes:
          majority  — agree → keep, disagree → 0
          overwrite — non-zero trits from *other* replace self
        """
        if self.dim != other.dim:
            raise ValueError("Dimension mismatch")
        if mode == "majority":
            merged = [
                a if a == b else 0
                for a, b in zip(self._data, other._data)
            ]
        elif mode == "overwrite":
            merged = [
                b if b != 0 else a
                for a, b in zip(self._data, other._data)
            ]
        else:
            raise ValueError(f"Unknown merge mode {mode!r}")
        return TritVector(self.dim, merged)

    # -- serialisation (5 trits per byte, base-3) ---------------------------

    def to_bytes(self) -> bytes:
        """Pack the vector: 5 trits per byte (3^5 = 243 < 256).

        Encoding per group: value = (t0+1)*81 + (t1+1)*27 + (t2+1)*9 + (t3+1)*3 + (t4+1)
        The last group is zero-padded on the right if dim is not a multiple of 5.
        """
        out = bytearray()
        for start in range(0, self.dim, _TRITS_PER_BYTE):
            group = self._data[start : start + _TRITS_PER_BYTE]
            # zero-pad the last group
            while len(group) < _TRITS_PER_BYTE:
                group.append(0)
            byte_val = sum(
                (t + 1) * p for t, p in zip(group, _BASE_POWERS)
            )
            out.append(byte_val)
        return bytes(out)

    @classmethod
    def from_bytes(cls, data: bytes, dim: int) -> TritVector:
        """Decode a byte string produced by *to_bytes*."""
        trits: list[int] = []
        for byte_val in data:
            remainder = byte_val
            for power in _BASE_POWERS:
                digit, remainder = divmod(remainder, power)
                trits.append(digit - 1)
        # trim padding
        return cls(dim, trits[:dim])

    # -- factory ------------------------------------------------------------

    @classmethod
    def random(cls, dim: int, sparsity: float = 0.5) -> TritVector:
        """Generate a random vector; *sparsity* fraction of trits are 0."""
        if not 0.0 <= sparsity <= 1.0:
            raise ValueError("sparsity must be in [0.0, 1.0]")
        data: list[int] = []
        for _ in range(dim):
            if _random.random() < sparsity:
                data.append(0)
            else:
                data.append(_random.choice((-1, 1)))
        return cls(dim, data)

    # -- dunder protocol ----------------------------------------------------

    def __getitem__(self, index: int) -> int:
        return self._data[index]

    def __setitem__(self, index: int, value: int) -> None:
        if value not in _VALID_TRITS:
            raise ValueError(f"Invalid trit value {value!r}")
        self._data[index] = value

    def __len__(self) -> int:
        return self.dim

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, TritVector):
            return NotImplemented
        return self.dim == other.dim and self._data == other._data

    def __repr__(self) -> str:
        preview = self._data[:8]
        suffix = ", ..." if self.dim > 8 else ""
        return f"TritVector(dim={self.dim}, data=[{', '.join(map(str, preview))}{suffix}])"
