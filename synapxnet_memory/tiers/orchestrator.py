from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Any, Mapping, Sequence

import torch

from ..contracts import (
    BoundMemory,
    HierarchicalMemoryResult,
    LiquidControlDecision,
    MemoryOutcome,
    MemoryQuery,
    MemorySelection,
    MemoryUseTrace,
    MemoryVersionAction,
    NativeMemorySnapshot,
    ShortTermMemoryEvent,
    immutable_mapping,
    sha256_bytes,
)
from ..modules import (
    MemoryActivationModule,
    MemoryFeedbackModule,
    MemoryPrecipitationModule,
)
from .active import ActiveNativeMemoryStore
from .native import MetisNativeMemoryAdapter
from .short_term import ShortTermMemoryWindow


@dataclass(frozen=True, slots=True)
class HierarchicalMemoryConfig:
    load_to_native_threshold: float = 0.5
    keep_active_threshold: float = 0.5
    promote_to_long_term_threshold: float = 0.5
    evict_from_native_threshold: float = 0.5
    minimum_write_gate: float = 0.5
    active_lease_seconds: float = 1800.0
    include_short_term_context: bool = True
    maximum_short_context_tokens: int = 512

    def __post_init__(self) -> None:
        for name in (
            "load_to_native_threshold",
            "keep_active_threshold",
            "promote_to_long_term_threshold",
            "evict_from_native_threshold",
            "minimum_write_gate",
        ):
            value = float(getattr(self, name))
            if not 0.0 <= value <= 1.0:
                raise ValueError(f"{name} must be in [0, 1]")
        if self.active_lease_seconds <= 0.0 or self.maximum_short_context_tokens < 0:
            raise ValueError("hierarchical memory limits are invalid")


@dataclass(slots=True)
class HierarchicalMemoryRun:
    session_id: str
    query: MemoryQuery
    generated_ids: torch.Tensor
    bound_memory: BoundMemory | None
    active_snapshot: NativeMemorySnapshot | None
    short_term_event: ShortTermMemoryEvent
    result: HierarchicalMemoryResult


class HierarchicalMemoryOrchestrator:
    """Runtime facade across precipitation, activation, and feedback modules.

    Memory tiers are cross-cutting storage scopes and do not form a fourth
    top-level lifecycle module.
    """

    payload_kind = "synapxnet.metis_native_snapshot.v1"

    def __init__(
        self,
        *,
        long_term_activation: MemoryActivationModule,
        long_term_precipitation: MemoryPrecipitationModule,
        feedback: MemoryFeedbackModule,
        native_memory: MetisNativeMemoryAdapter,
        active_memory: ActiveNativeMemoryStore,
        short_term_memory: ShortTermMemoryWindow,
        config: HierarchicalMemoryConfig | None = None,
    ) -> None:
        self.long_term_activation = long_term_activation
        self.long_term_precipitation = long_term_precipitation
        self.feedback = feedback
        self.native_memory = native_memory
        self.active_memory = active_memory
        self.short_term_memory = short_term_memory
        self.config = config or HierarchicalMemoryConfig()

    def _snapshot_from_bound(
        self,
        bound: BoundMemory,
        *,
        session_id: str,
    ) -> NativeMemorySnapshot | None:
        metadata = bound.selection.record.metadata
        if metadata.get("payload_kind") != self.payload_kind:
            return None
        native = metadata.get("native_snapshot")
        if not isinstance(native, Mapping):
            raise RuntimeError("long-term native snapshot metadata is missing")
        if native.get("codec") != self.native_memory.codec.codec_name:
            raise RuntimeError("long-term native snapshot codec is incompatible")
        snapshot = self.native_memory.codec.from_payload(
            payload=bound.payload,
            session_id=session_id,
            model_id=str(native["model_id"]),
            snapshot_id=str(native["snapshot_id"]),
            tensor_count=int(native["tensor_count"]),
            source_record_sha256=bound.selection.record.record_sha256,
            created_at_utc=str(native["created_at_utc"]),
            metadata={
                "state_sha256": str(native["state_sha256"]),
                "long_term_record_sha256": bound.selection.record.record_sha256,
                "raw_prompts_persisted": False,
                "model_parameters_included": False,
            },
        )
        if snapshot.model_id != self.native_memory.model_id:
            return None
        return snapshot

    @staticmethod
    def _tensor_ids(value: torch.Tensor | Sequence[int]) -> tuple[int, ...]:
        if isinstance(value, torch.Tensor):
            tensor = value.detach().to("cpu")
            if tensor.ndim == 2:
                if tensor.shape[0] != 1:
                    raise ValueError("hierarchical runtime currently requires batch size 1")
                tensor = tensor[0]
            if tensor.ndim != 1:
                raise ValueError("token ids must be one- or two-dimensional")
            return tuple(int(token) for token in tensor.tolist())
        return tuple(int(token) for token in value)

    def _model_input(
        self,
        session_id: str,
        input_ids: torch.Tensor | Sequence[int],
    ) -> tuple[int, ...]:
        current = self._tensor_ids(input_ids)
        if not self.config.include_short_term_context:
            return current
        previous = self.short_term_memory.context_tokens(session_id)
        if self.config.maximum_short_context_tokens == 0:
            return current
        previous = previous[-self.config.maximum_short_context_tokens :]
        return (*previous, *current)

    def run(
        self,
        *,
        session_id: str,
        query: MemoryQuery,
        input_ids: torch.Tensor | Sequence[int],
        attention_mask: torch.Tensor | None = None,
        commit_mode: str = "exchange",
        generation_kwargs: Mapping[str, Any] | None = None,
    ) -> HierarchicalMemoryRun:
        if commit_mode not in {"none", "user", "exchange"}:
            raise ValueError("commit_mode must be none, user, or exchange")
        if not session_id.strip():
            raise ValueError("session_id is required")
        current_input = self._tensor_ids(input_ids)
        model_input = self._model_input(session_id, current_input)

        active = self.active_memory.get(session_id)
        active_snapshot = None if active is None else active[0]
        if active_snapshot is not None:
            self.native_memory.import_snapshot(active_snapshot)
        else:
            self.native_memory.reset()

        bound = self.long_term_activation.activate(query)
        loaded_to_native = False
        long_term_record_sha256 = None
        selection: MemorySelection | None = None
        if bound is not None:
            selection = bound.selection
            long_term_record_sha256 = selection.record.record_sha256
            long_snapshot = self._snapshot_from_bound(bound, session_id=session_id)
            if (
                long_snapshot is not None
                and selection.load_to_native_gate >= self.config.load_to_native_threshold
            ):
                self.native_memory.import_snapshot(long_snapshot)
                active_snapshot = long_snapshot
                self.active_memory.activate(
                    long_snapshot,
                    lease_seconds=self.config.active_lease_seconds,
                )
                loaded_to_native = True

        effective_attention_mask = (
            attention_mask if len(model_input) == len(current_input) else None
        )
        generated = self.native_memory.generate(
            model_input,
            attention_mask=effective_attention_mask,
            **dict(generation_kwargs or {}),
        )
        generated_tokens = self._tensor_ids(generated)
        continuation = generated_tokens[len(model_input) :] if generated_tokens[: len(model_input)] == model_input else generated_tokens

        if commit_mode == "user":
            self.native_memory.commit_tokens(current_input)
        elif commit_mode == "exchange":
            self.native_memory.commit_tokens((*current_input, *continuation))

        event = self.short_term_memory.append(
            session_id=session_id,
            request_id=query.request_id,
            input_ids=current_input,
            output_ids=continuation,
            metadata={"commit_mode": commit_mode},
        )

        native_snapshot = self.native_memory.export_snapshot(
            session_id=session_id,
            source_record_sha256=long_term_record_sha256,
            metadata={"request_id": query.request_id, "commit_mode": commit_mode},
        )
        keep_gate = 1.0 if selection is None and active_snapshot is not None else (
            0.0 if selection is None else selection.keep_active_gate
        )
        evict_gate = 0.0 if selection is None else selection.evict_from_native_gate
        evicted = evict_gate >= self.config.evict_from_native_threshold
        kept_active = False
        if evicted:
            self.active_memory.evict(session_id)
            self.native_memory.reset()
            native_snapshot = None
        should_keep = keep_gate >= self.config.keep_active_threshold or (
            selection is None and commit_mode != "none"
        )
        if not evicted and should_keep:
            if active_snapshot is None:
                self.active_memory.activate(
                    native_snapshot,
                    lease_seconds=self.config.active_lease_seconds,
                )
            else:
                self.active_memory.update(native_snapshot)
            kept_active = True

        result = HierarchicalMemoryResult(
            session_id=session_id,
            request_id=query.request_id,
            long_term_record_sha256=long_term_record_sha256,
            active_snapshot_sha256=None if native_snapshot is None else native_snapshot.payload_sha256,
            short_term_event_count=len(self.short_term_memory.events(session_id)),
            loaded_to_native=loaded_to_native,
            kept_active=kept_active,
            promoted_to_long_term=False,
            evicted_from_native=evicted,
            controller_state_sha256=(
                None if selection is None else selection.controller_state_sha256
            ),
            metadata=immutable_mapping(
                {
                    "commit_mode": commit_mode,
                    "model_input_token_count": len(model_input),
                    "generated_token_count": len(continuation),
                    "short_term_context_tokens": len(model_input) - len(current_input),
                }
            ),
        )
        return HierarchicalMemoryRun(
            session_id=session_id,
            query=query,
            generated_ids=generated,
            bound_memory=bound,
            active_snapshot=native_snapshot,
            short_term_event=event,
            result=result,
        )

    @staticmethod
    def _control_from_selection(
        run: HierarchicalMemoryRun,
        *,
        version_action: MemoryVersionAction,
    ) -> LiquidControlDecision:
        selection = None if run.bound_memory is None else run.bound_memory.selection
        route_logits = (1.0,) if selection is None else selection.route_logits
        route_probabilities = (1.0,) if selection is None else selection.route_probabilities
        selected_record_sha256 = (
            "0" * 64 if selection is None else selection.record.record_sha256
        )
        return LiquidControlDecision(
            request_id=run.query.request_id,
            requester_agent=run.query.requester_agent,
            task_id=run.query.task_id,
            state_scope=f"{run.query.requester_agent}::{run.query.task_id}",
            selected_index=0 if selection is None else max(
                0,
                route_probabilities.index(max(route_probabilities)),
            ),
            selected_record_sha256=selected_record_sha256,
            route_logits=route_logits or (1.0,),
            route_probabilities=route_probabilities or (1.0,),
            read_gate=1.0 if selection is None else selection.read_gate,
            write_gate=1.0 if selection is None else selection.write_gate,
            injection_gain=0.0 if selection is None else selection.injection_gain,
            version_action=version_action,
            delta_t_seconds=1.0 if selection is None or selection.delta_t_seconds is None else selection.delta_t_seconds,
            previous_state_sha256=(
                None if selection is None else selection.previous_controller_state_sha256
            ),
            next_state_sha256=(
                "0" * 64
                if selection is None or selection.controller_state_sha256 is None
                else selection.controller_state_sha256
            ),
            controller_model_sha256=(
                "0" * 64
                if selection is None or selection.controller_model_sha256 is None
                else selection.controller_model_sha256
            ),
            state_version=None if selection is None else selection.controller_state_version,
            load_to_native_gate=0.0 if selection is None else selection.load_to_native_gate,
            keep_active_gate=0.0 if selection is None else selection.keep_active_gate,
            promote_to_long_term_gate=(
                1.0 if selection is None else selection.promote_to_long_term_gate
            ),
            evict_from_native_gate=(
                0.0 if selection is None else selection.evict_from_native_gate
            ),
        )

    def finalize_feedback(
        self,
        run: HierarchicalMemoryRun,
        *,
        matched_score: float,
        baseline_score: float,
        zero_score: float | None = None,
        mismatch_score: float | None = None,
        shuffled_score: float | None = None,
        timings_ms: Mapping[str, float] | None = None,
        conflict_score: float = 0.0,
        permissions: tuple[str, ...] = (),
        tags: tuple[str, ...] = (),
    ) -> tuple[MemoryOutcome, Mapping[str, Any], HierarchicalMemoryResult]:
        trace = MemoryUseTrace(
            trace_id=f"hierarchical-{run.short_term_event.event_id}",
            request_id=run.query.request_id,
            memory_id=(
                None
                if run.bound_memory is None
                else run.bound_memory.selection.record.memory_id
            ),
            condition="hierarchical_matched",
            selected_record_sha256=(
                None
                if run.bound_memory is None
                else run.bound_memory.selection.record.record_sha256
            ),
            input_sha256=run.short_term_event.input_sha256,
            output_sha256=run.short_term_event.output_sha256 or "0" * 64,
            timings_ms=immutable_mapping(timings_ms),
            gates=immutable_mapping(
                {}
                if run.bound_memory is None
                else {
                    "read": run.bound_memory.selection.read_gate,
                    "write": run.bound_memory.selection.write_gate,
                    "load_to_native": run.bound_memory.selection.load_to_native_gate,
                    "keep_active": run.bound_memory.selection.keep_active_gate,
                    "promote_to_long_term": run.bound_memory.selection.promote_to_long_term_gate,
                    "evict_from_native": run.bound_memory.selection.evict_from_native_gate,
                }
            ),
            metadata={"conflict_score": float(conflict_score), "session_id": run.session_id},
        )
        outcome, policy = self.feedback.process(
            use_trace=trace,
            matched_score=matched_score,
            baseline_score=baseline_score,
            zero_score=zero_score,
            mismatch_score=mismatch_score,
            shuffled_score=shuffled_score,
        )
        controller_update = policy.get("controller_update")
        policy_action = str(policy.get("action", "retain"))
        action = {
            "promote": MemoryVersionAction.NEW_VERSION,
            "demote": MemoryVersionAction.RETIRE,
            "retain": MemoryVersionAction.REUSE,
        }.get(policy_action, MemoryVersionAction.REUSE)
        if isinstance(controller_update, Mapping) and controller_update.get("version_action"):
            action = MemoryVersionAction(str(controller_update["version_action"]))

        selection = None if run.bound_memory is None else run.bound_memory.selection
        promote_gate = 1.0 if selection is None else selection.promote_to_long_term_gate
        write_gate = 1.0 if selection is None else selection.write_gate
        promote = (
            run.active_snapshot is not None
            and outcome.attribution_passed
            and promote_gate >= self.config.promote_to_long_term_threshold
            and write_gate >= self.config.minimum_write_gate
            and action is MemoryVersionAction.NEW_VERSION
        )
        promoted_record = None
        if promote:
            snapshot = run.active_snapshot
            metadata = {
                "payload_kind": self.payload_kind,
                "compatible_model_ids": [snapshot.model_id],
                "native_snapshot": {
                    "snapshot_id": snapshot.snapshot_id,
                    "model_id": snapshot.model_id,
                    "codec": snapshot.codec,
                    "tensor_count": snapshot.tensor_count,
                    "state_sha256": snapshot.metadata.get("state_sha256"),
                    "created_at_utc": snapshot.created_at_utc,
                },
                "session_id_sha256": sha256_bytes(run.session_id.encode("utf-8")),
            }
            promoted_record = self.long_term_precipitation.precipitate(
                owner_agent=run.query.requester_agent,
                task_id=run.query.task_id,
                trajectory={
                    "short_term_event_count": len(
                        self.short_term_memory.events(run.session_id)
                    ),
                    "native_state_sha256": snapshot.metadata.get("state_sha256"),
                },
                feedback={"score": max(0.0, min(1.0, matched_score))},
                payload=snapshot.payload,
                permissions=permissions,
                tags=tuple(sorted(set((*tags, "metis-native", "hierarchical-memory")))),
                metadata=metadata,
                control=self._control_from_selection(run, version_action=action),
            )

        evict = (
            run.active_snapshot is not None
            and (
                (selection is not None and selection.evict_from_native_gate >= self.config.evict_from_native_threshold)
                or action is MemoryVersionAction.RETIRE
            )
        )
        if evict:
            self.active_memory.evict(run.session_id)
            self.native_memory.reset()

        retired_record = None
        if (
            action is MemoryVersionAction.RETIRE
            and selection is not None
            and selection.write_gate >= self.config.minimum_write_gate
        ):
            retired_record = self.long_term_precipitation.precipitate(
                owner_agent=selection.record.owner_agent,
                task_id=selection.record.task_id,
                trajectory={"retirement_requested": True},
                feedback={"score": max(0.0, min(1.0, matched_score))},
                payload=b"retirement-does-not-write-a-payload",
                control=self._control_from_selection(
                    run,
                    version_action=MemoryVersionAction.RETIRE,
                ),
            )

        result = replace(
            run.result,
            long_term_record_sha256=(
                run.result.long_term_record_sha256
                if promoted_record is None
                else promoted_record.record_sha256
            ),
            promoted_to_long_term=promote,
            evicted_from_native=run.result.evicted_from_native or evict,
            metadata=immutable_mapping(
                {
                    **dict(run.result.metadata),
                    "feedback_action": policy.get("action"),
                    "controller_version_action": action.value,
                    "attribution_passed": outcome.attribution_passed,
                    "durable_record_retired": retired_record is not None,
                }
            ),
        )
        return outcome, policy, result
