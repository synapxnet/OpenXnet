from __future__ import annotations

import threading
from typing import Any, Mapping

from ..contracts import MemoryOutcome, immutable_mapping, utc_now


class MemoryCalibrator:
    """Convert attributed outcomes into bounded policy calibration signals."""

    def __init__(
        self,
        *,
        learning_rate: float = 0.1,
        promotion_threshold: float = 0.02,
        demotion_threshold: float = -0.02,
    ) -> None:
        if not 0.0 < learning_rate <= 1.0:
            raise ValueError("learning_rate must be in (0, 1]")
        self.learning_rate = float(learning_rate)
        self.promotion_threshold = float(promotion_threshold)
        self.demotion_threshold = float(demotion_threshold)
        self._state: dict[str, float] = {}
        self._lock = threading.RLock()

    def calibrate(self, outcome: MemoryOutcome) -> Mapping[str, Any]:
        key = outcome.memory_id or "__no_memory__"
        signal = outcome.module_gain
        if outcome.content_specificity is not None:
            signal = 0.5 * signal + 0.5 * outcome.content_specificity
        with self._lock:
            previous = self._state.get(key, 0.0)
            calibrated = (1.0 - self.learning_rate) * previous + self.learning_rate * signal
            calibrated = max(-1.0, min(1.0, calibrated))
            self._state[key] = calibrated
        if calibrated >= self.promotion_threshold and outcome.attribution_passed:
            action = "promote"
        elif calibrated <= self.demotion_threshold:
            action = "demote"
        else:
            action = "retain"
        return immutable_mapping(
            {
                "memory_id": outcome.memory_id,
                "action": action,
                "previous_calibration": previous,
                "calibration": calibrated,
                "recommended_read_gate": max(0.0, min(1.0, 0.5 + calibrated)),
                "recommended_write_gate": max(0.0, min(1.0, 0.5 + signal)),
                "attribution_passed": outcome.attribution_passed,
                "created_at_utc": utc_now(),
            }
        )

    def state(self) -> Mapping[str, float]:
        with self._lock:
            return immutable_mapping(self._state)
