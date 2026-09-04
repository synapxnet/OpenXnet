from __future__ import annotations

import math
from typing import Any

from ..contracts import MemoryOutcome, immutable_mapping


class MemoryAttributionEvaluator:
    """Attribute task score changes to matched memory using causal controls."""

    def __init__(
        self,
        *,
        minimum_module_gain: float = 0.0,
        minimum_control_delta: float = 0.0,
    ) -> None:
        self.minimum_module_gain = float(minimum_module_gain)
        self.minimum_control_delta = float(minimum_control_delta)

    @staticmethod
    def _validate_score(name: str, value: float | None) -> None:
        if value is not None and not math.isfinite(float(value)):
            raise ValueError(f"{name} must be finite")

    def evaluate(
        self,
        *,
        memory_id: str | None,
        matched_score: float,
        baseline_score: float,
        zero_score: float | None = None,
        mismatch_score: float | None = None,
        shuffled_score: float | None = None,
        **metadata: Any,
    ) -> MemoryOutcome:
        for name, value in (
            ("matched_score", matched_score),
            ("baseline_score", baseline_score),
            ("zero_score", zero_score),
            ("mismatch_score", mismatch_score),
            ("shuffled_score", shuffled_score),
        ):
            self._validate_score(name, value)
        module_gain = float(matched_score) - float(baseline_score)
        read_gain = None if zero_score is None else float(matched_score) - float(zero_score)
        content_gain = None if mismatch_score is None else float(matched_score) - float(mismatch_score)
        shuffle_gain = None if shuffled_score is None else float(matched_score) - float(shuffled_score)
        control_values = [value for value in (read_gain, content_gain, shuffle_gain) if value is not None]
        passed = module_gain > self.minimum_module_gain and all(
            value > self.minimum_control_delta for value in control_values
        )
        return MemoryOutcome(
            memory_id=memory_id,
            matched_score=float(matched_score),
            baseline_score=float(baseline_score),
            zero_score=None if zero_score is None else float(zero_score),
            mismatch_score=None if mismatch_score is None else float(mismatch_score),
            shuffled_score=None if shuffled_score is None else float(shuffled_score),
            module_gain=module_gain,
            read_causal_gain=read_gain,
            content_specificity=content_gain,
            shuffle_specificity=shuffle_gain,
            attribution_passed=passed,
            metadata=immutable_mapping(metadata),
        )
