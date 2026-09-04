from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping, Protocol

from .contracts import (
    BoundMemory,
    LiquidControlDecision,
    LiquidControllerUpdate,
    MemoryCandidate,
    MemoryOutcome,
    MemoryQuery,
    MemoryRecord,
    MemorySelection,
    MemoryUseTrace,
    MemoryVersionAction,
)


class Crystallizer(Protocol):
    def crystallize(self, **kwargs: Any) -> MemoryCandidate: ...


class Validator(Protocol):
    def validate(self, candidate: MemoryCandidate): ...


class Storage(Protocol):
    def commit(self, candidate: MemoryCandidate, validation: Any) -> MemoryRecord: ...


@dataclass(slots=True)
class MemoryPrecipitationModule:
    crystallizer: Crystallizer
    validator: Validator
    storage: Storage
    minimum_write_gate: float = 0.5

    def precipitate(
        self,
        *,
        owner_agent: str,
        task_id: str,
        trajectory: Mapping[str, Any],
        feedback: Mapping[str, Any],
        payload: bytes,
        permissions: tuple[str, ...] = (),
        tags: tuple[str, ...] = (),
        metadata: Mapping[str, Any] | None = None,
        control: LiquidControlDecision | None = None,
    ) -> MemoryRecord:
        if control is not None:
            if control.task_id != task_id:
                raise ValueError("liquid control task does not match precipitation task")
            action = MemoryVersionAction(control.version_action)
            if action is MemoryVersionAction.REUSE:
                latest_for = getattr(self.storage, "latest_for", None)
                if latest_for is None:
                    raise TypeError("controlled reuse requires storage.latest_for")
                existing = latest_for(
                    owner_agent=owner_agent,
                    task_id=task_id,
                    schema_version="synapxnet.memory.v1",
                )
                if existing is None:
                    raise ValueError("cannot reuse memory before its first committed version")
                return existing
            if control.write_gate < self.minimum_write_gate:
                raise ValueError(
                    f"memory write gate {control.write_gate:.6f} is below "
                    f"the symbolic threshold {self.minimum_write_gate:.6f}"
                )
            if action is MemoryVersionAction.RETIRE:
                retire_latest = getattr(self.storage, "retire_latest", None)
                if retire_latest is None:
                    raise TypeError("controlled retirement requires storage.retire_latest")
                return retire_latest(
                    owner_agent=owner_agent,
                    task_id=task_id,
                    schema_version="synapxnet.memory.v1",
                )
        candidate = self.crystallizer.crystallize(
            owner_agent=owner_agent,
            task_id=task_id,
            trajectory=trajectory,
            feedback=feedback,
            payload=payload,
            permissions=permissions,
            tags=tags,
            metadata=metadata,
        )
        validation = self.validator.validate(candidate)
        return self.storage.commit(candidate, validation)


class Retriever(Protocol):
    def retrieve(self, query: MemoryQuery) -> list[MemoryRecord]: ...


class Screener(Protocol):
    def screen(self, query: MemoryQuery, records: list[MemoryRecord]) -> list[MemoryRecord]: ...


class Controller(Protocol):
    def decide(self, query: MemoryQuery, records: list[MemoryRecord]) -> MemorySelection | None: ...


class Loader(Protocol):
    def load(self, selection: MemorySelection) -> BoundMemory: ...


@dataclass(slots=True)
class MemoryActivationModule:
    retrieval: Retriever
    screening: Screener
    decision: Controller
    loading: Loader
    injection: Any | None = None

    def activate(self, query: MemoryQuery) -> BoundMemory | None:
        records = self.retrieval.retrieve(query)
        eligible = self.screening.screen(query, records)
        selection = self.decision.decide(query, eligible)
        return None if selection is None else self.loading.load(selection)


class Tracer(Protocol):
    def append(self, trace: MemoryUseTrace) -> str: ...


class Attributor(Protocol):
    def evaluate(self, **kwargs: Any) -> MemoryOutcome: ...


class Calibrator(Protocol):
    def calibrate(self, outcome: MemoryOutcome) -> Mapping[str, Any]: ...


class ControllerFeedbackUpdater(Protocol):
    def update_from_feedback(
        self,
        *,
        request_id: str,
        outcome: MemoryOutcome,
        latency_ms: float = 0.0,
        conflict_score: float = 0.0,
    ) -> LiquidControllerUpdate: ...


@dataclass(slots=True)
class MemoryFeedbackModule:
    trace: Tracer
    attribution: Attributor
    calibration: Calibrator
    controller_updater: ControllerFeedbackUpdater | None = None

    def process(
        self,
        *,
        use_trace: MemoryUseTrace,
        matched_score: float,
        baseline_score: float,
        zero_score: float | None = None,
        mismatch_score: float | None = None,
        shuffled_score: float | None = None,
    ) -> tuple[MemoryOutcome, Mapping[str, Any]]:
        self.trace.append(use_trace)
        outcome = self.attribution.evaluate(
            memory_id=use_trace.memory_id,
            matched_score=matched_score,
            baseline_score=baseline_score,
            zero_score=zero_score,
            mismatch_score=mismatch_score,
            shuffled_score=shuffled_score,
        )
        policy = dict(self.calibration.calibrate(outcome))
        if self.controller_updater is not None:
            latency_ms = sum(float(value) for value in use_trace.timings_ms.values())
            conflict_score = float(use_trace.metadata.get("conflict_score", 0.0))
            update = self.controller_updater.update_from_feedback(
                request_id=use_trace.request_id,
                outcome=outcome,
                latency_ms=latency_ms,
                conflict_score=conflict_score,
            )
            policy["controller_update"] = {
                "request_id": update.request_id,
                "updated": update.updated,
                "reward": update.reward,
                "loss": update.loss,
                "version_action": (
                    None if update.version_action is None else update.version_action.value
                ),
                "model_sha256_before": update.model_sha256_before,
                "model_sha256_after": update.model_sha256_after,
                "state_scope": update.state_scope,
                "reason": update.reason,
                "metadata": dict(update.metadata),
            }
        return outcome, policy
