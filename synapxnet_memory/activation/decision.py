from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Mapping, Protocol, Sequence

from ..contracts import (
    LiquidControlDecision,
    MemoryQuery,
    MemoryRecord,
    MemorySelection,
    MemoryVersionAction,
)


class MemoryDecisionScorer(Protocol):
    """Optional LNN or policy backend used after symbolic screening."""

    def score(
        self,
        query: MemoryQuery,
        records: Sequence[MemoryRecord],
        features: Sequence[Mapping[str, float]],
    ) -> Sequence[float]: ...


class MemoryControlPolicy(Protocol):
    def control(
        self,
        query: MemoryQuery,
        records: Sequence[MemoryRecord],
        features: Sequence[Mapping[str, float]] | None = None,
    ) -> LiquidControlDecision: ...


@dataclass(frozen=True, slots=True)
class DecisionWeights:
    quality: float = 3.0
    requested_owner: float = 2.0
    required_tags: float = 1.0
    version: float = 0.05


class MemoryDecisionController:
    """Select one eligible memory and emit bounded activation controls."""

    def __init__(
        self,
        *,
        scorer: MemoryDecisionScorer | None = None,
        control_policy: MemoryControlPolicy | None = None,
        weights: DecisionWeights | None = None,
        injection_gain_range: tuple[float, float] = (0.0, 1.5),
    ) -> None:
        if scorer is not None and control_policy is not None:
            raise ValueError("configure either scorer or control_policy, not both")
        self.scorer = scorer
        self.control_policy = control_policy
        self.weights = weights or DecisionWeights()
        minimum, maximum = (float(value) for value in injection_gain_range)
        if not 0.0 <= minimum <= maximum:
            raise ValueError("invalid injection_gain_range")
        self.injection_gain_range = (minimum, maximum)

    def _features(self, query: MemoryQuery, record: MemoryRecord) -> Mapping[str, float]:
        requested_owner = query.context.get("requested_owner_agent")
        required = set(query.required_tags)
        tag_fraction = len(required.intersection(record.tags)) / max(1, len(required))
        return {
            "quality": record.quality_score,
            "requested_owner": float(bool(requested_owner) and record.owner_agent == requested_owner),
            "required_tags": tag_fraction,
            "version": float(record.version),
        }

    def _default_score(self, features: Mapping[str, float]) -> float:
        return (
            self.weights.quality * features["quality"]
            + self.weights.requested_owner * features["requested_owner"]
            + self.weights.required_tags * features["required_tags"]
            + self.weights.version * features["version"]
        )

    def decide(
        self,
        query: MemoryQuery,
        records: list[MemoryRecord],
    ) -> MemorySelection | None:
        if not records:
            return None
        features = [self._features(query, record) for record in records]
        if self.control_policy is not None:
            return self._controlled_selection(query, records, features)
        scores = (
            list(self.scorer.score(query, records, features))
            if self.scorer is not None
            else [self._default_score(value) for value in features]
        )
        if len(scores) != len(records) or any(not math.isfinite(float(score)) for score in scores):
            raise ValueError("decision scorer returned invalid scores")
        best_index = max(
            range(len(records)),
            key=lambda index: (float(scores[index]), records[index].version, records[index].record_sha256),
        )
        record = records[best_index]
        score = float(scores[best_index])
        read_gate = max(0.0, min(1.0, record.quality_score))
        write_gate = max(0.0, min(1.0, float(query.context.get("write_gate", 0.0))))
        minimum, maximum = self.injection_gain_range
        injection_gain = minimum + (maximum - minimum) * read_gate
        return MemorySelection(
            request_id=query.request_id,
            record=record,
            score=score,
            read_gate=read_gate,
            write_gate=write_gate,
            injection_gain=injection_gain,
            controller_state_sha256=(
                str(query.context["controller_state_sha256"])
                if query.context.get("controller_state_sha256")
                else None
            ),
        )

    @staticmethod
    def _context_cap(query: MemoryQuery, name: str, default: float) -> float:
        try:
            value = float(query.context.get(name, default))
        except (TypeError, ValueError):
            return default
        return default if not math.isfinite(value) else value

    def _controlled_selection(
        self,
        query: MemoryQuery,
        records: list[MemoryRecord],
        features: Sequence[Mapping[str, float]],
    ) -> MemorySelection:
        control = self.control_policy.control(query, records, features)
        if control.request_id != query.request_id or control.task_id != query.task_id:
            raise ValueError("memory control decision does not match the current request")
        if not 0 <= control.selected_index < len(records):
            raise ValueError("memory control decision selected_index is out of range")
        if len(control.route_logits) != len(records) or len(control.route_probabilities) != len(records):
            raise ValueError("memory control route output size does not match candidates")
        values = (*control.route_logits, *control.route_probabilities)
        if any(not math.isfinite(float(value)) for value in values):
            raise ValueError("memory control route outputs must be finite")
        probability_sum = sum(float(value) for value in control.route_probabilities)
        if any(float(value) < 0.0 for value in control.route_probabilities) or not math.isclose(
            probability_sum, 1.0, rel_tol=1e-5, abs_tol=1e-5
        ):
            raise ValueError("memory control route probabilities are invalid")
        record = records[control.selected_index]
        if record.record_sha256 != control.selected_record_sha256:
            raise ValueError("memory control selected record hash mismatch")

        read_cap = max(0.0, min(1.0, self._context_cap(query, "maximum_read_gate", 1.0)))
        write_cap = max(0.0, min(1.0, self._context_cap(query, "maximum_write_gate", 1.0)))
        read_gate = max(0.0, min(read_cap, float(control.read_gate)))
        write_gate = max(0.0, min(write_cap, float(control.write_gate)))
        if not bool(query.context.get("memory_write_allowed", True)):
            write_gate = 0.0

        minimum_gain, maximum_gain = self.injection_gain_range
        context_gain_cap = self._context_cap(query, "maximum_injection_gain", maximum_gain)
        maximum_gain = max(minimum_gain, min(maximum_gain, context_gain_cap))
        injection_gain = max(minimum_gain, min(maximum_gain, float(control.injection_gain)))
        if bool(query.context.get("force_zero_injection", False)) or read_gate == 0.0:
            injection_gain = 0.0

        load_to_native_gate = max(
            0.0,
            min(
                1.0,
                float(control.load_to_native_gate),
                self._context_cap(query, "maximum_load_to_native_gate", 1.0),
            ),
        )
        keep_active_gate = max(
            0.0,
            min(
                1.0,
                float(control.keep_active_gate),
                self._context_cap(query, "maximum_keep_active_gate", 1.0),
            ),
        )
        promote_to_long_term_gate = max(
            0.0,
            min(
                1.0,
                float(control.promote_to_long_term_gate),
                self._context_cap(query, "maximum_promote_to_long_term_gate", 1.0),
            ),
        )
        evict_from_native_gate = max(
            0.0,
            min(
                1.0,
                float(control.evict_from_native_gate),
                self._context_cap(query, "maximum_evict_from_native_gate", 1.0),
            ),
        )
        if not bool(query.context.get("native_memory_allowed", True)):
            load_to_native_gate = 0.0
            keep_active_gate = 0.0
        if not bool(query.context.get("long_term_promotion_allowed", True)):
            promote_to_long_term_gate = 0.0

        try:
            version_action = MemoryVersionAction(control.version_action)
        except ValueError as exc:
            raise ValueError("memory control returned an unsupported version action") from exc
        return MemorySelection(
            request_id=query.request_id,
            record=record,
            score=float(control.route_logits[control.selected_index]),
            read_gate=read_gate,
            write_gate=write_gate,
            injection_gain=injection_gain,
            controller_state_sha256=control.next_state_sha256,
            previous_controller_state_sha256=control.previous_state_sha256,
            controller_model_sha256=control.controller_model_sha256,
            controller_state_version=control.state_version,
            delta_t_seconds=control.delta_t_seconds,
            version_action=version_action,
            route_logits=control.route_logits,
            route_probabilities=control.route_probabilities,
            load_to_native_gate=load_to_native_gate,
            keep_active_gate=keep_active_gate,
            promote_to_long_term_gate=promote_to_long_term_gate,
            evict_from_native_gate=evict_from_native_gate,
        )
