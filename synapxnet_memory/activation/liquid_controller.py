from __future__ import annotations

import hashlib
import math
import os
import threading
import time
from collections import OrderedDict
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping, Sequence

import torch
import torch.nn as nn
import torch.nn.functional as F
from ncps.torch import CfC

from ..contracts import (
    ControllerStateSnapshot,
    LiquidControlDecision,
    LiquidControllerUpdate,
    MemoryOutcome,
    MemoryQuery,
    MemoryRecord,
    MemoryVersionAction,
    canonical_json_sha256,
    immutable_mapping,
    sha256_bytes,
    utc_now,
)
from .controller_store import TransactionalLiquidControllerStore


def _tensor_sha256(value: torch.Tensor) -> str:
    tensor = value.detach().to(device="cpu").contiguous()
    digest = hashlib.sha256()
    digest.update(str(tensor.dtype).encode("ascii"))
    digest.update(str(tuple(tensor.shape)).encode("ascii"))
    digest.update(tensor.view(torch.uint8).numpy().tobytes(order="C"))
    return digest.hexdigest()


def _module_sha256(module: nn.Module) -> str:
    digest = hashlib.sha256()
    for name, value in sorted(module.state_dict().items()):
        tensor = value.detach().to(device="cpu").contiguous()
        digest.update(name.encode("utf-8"))
        digest.update(str(tensor.dtype).encode("ascii"))
        digest.update(str(tuple(tensor.shape)).encode("ascii"))
        digest.update(tensor.view(torch.uint8).numpy().tobytes(order="C"))
    return digest.hexdigest()


def _finite_float(value: Any, default: float = 0.0) -> float:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return float(default)
    return result if math.isfinite(result) else float(default)


def _bounded(value: Any, minimum: float, maximum: float, default: float = 0.0) -> float:
    return max(minimum, min(maximum, _finite_float(value, default)))


def _parse_timestamp(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


@dataclass(frozen=True, slots=True)
class LiquidControllerConfig:
    hidden_units: int = 16
    semantic_dimensions: int = 8
    model_state_dimensions: int = 4
    backbone_units: int = 32
    backbone_layers: int = 1
    learning_rate: float = 1e-3
    minimum_delta_t_seconds: float = 1e-3
    maximum_delta_t_seconds: float = 86400.0
    maximum_injection_gain: float = 1.5
    promotion_threshold: float = 0.02
    demotion_threshold: float = -0.02
    latency_penalty_weight: float = 0.02
    conflict_penalty_weight: float = 0.25
    pending_request_limit: int = 4096

    def __post_init__(self) -> None:
        if self.hidden_units <= 0:
            raise ValueError("hidden_units must be positive")
        if self.semantic_dimensions < 0 or self.model_state_dimensions < 0:
            raise ValueError("embedding dimensions cannot be negative")
        if not 0.0 < self.learning_rate:
            raise ValueError("learning_rate must be positive")
        if not 0.0 < self.minimum_delta_t_seconds <= self.maximum_delta_t_seconds:
            raise ValueError("invalid delta_t range")
        if self.maximum_injection_gain <= 0.0:
            raise ValueError("maximum_injection_gain must be positive")
        if self.pending_request_limit <= 0:
            raise ValueError("pending_request_limit must be positive")


@dataclass(slots=True)
class _PendingControl:
    request_id: str
    state_scope: str
    candidate_inputs: torch.Tensor
    previous_state: torch.Tensor
    delta_t_seconds: float
    selected_index: int
    record_sha256s: tuple[str, ...]


class LiquidMemoryController(nn.Module):
    """Continuous-time, multi-output controller for screened memory candidates."""

    base_feature_order = (
        "quality",
        "requested_owner",
        "required_tags",
        "version",
        "semantic_similarity",
        "historical_reward",
        "historical_success_rate",
        "usage_count",
        "age_seconds",
        "conflict_score",
        "storage_pressure",
        "query_difficulty",
        "model_confidence",
        "recent_latency_ms",
    )
    version_actions = (
        MemoryVersionAction.REUSE,
        MemoryVersionAction.NEW_VERSION,
        MemoryVersionAction.RETIRE,
    )

    def __init__(
        self,
        *,
        config: LiquidControllerConfig | None = None,
        state_store: TransactionalLiquidControllerStore | None = None,
        checkpoint_path: Path | None = None,
        seed: int = 0,
        persistent_state: bool = True,
    ) -> None:
        super().__init__()
        self.config = config or LiquidControllerConfig()
        self.state_store = state_store
        self.checkpoint_path = None if checkpoint_path is None else Path(checkpoint_path).resolve()
        self.persistent_state = bool(persistent_state)
        feature_count = (
            len(self.base_feature_order)
            + self.config.semantic_dimensions
            + self.config.model_state_dimensions
        )
        with torch.random.fork_rng(devices=[]):
            torch.manual_seed(int(seed))
            self.cfc = CfC(
                feature_count,
                self.config.hidden_units,
                return_sequences=True,
                batch_first=True,
                mixed_memory=False,
                backbone_units=self.config.backbone_units,
                backbone_layers=self.config.backbone_layers,
                backbone_dropout=0.0,
            )
            self.route_head = nn.Linear(self.config.hidden_units, 1)
            self.control_backbone = nn.Sequential(
                nn.Linear(self.config.hidden_units, self.config.hidden_units),
                nn.SiLU(),
                nn.Linear(self.config.hidden_units, self.config.hidden_units),
                nn.SiLU(),
            )
            self.read_head = nn.Linear(self.config.hidden_units, 1)
            self.write_head = nn.Linear(self.config.hidden_units, 1)
            self.gain_head = nn.Linear(self.config.hidden_units, 1)
            self.version_head = nn.Linear(self.config.hidden_units, len(self.version_actions))
            self.load_native_head = nn.Linear(self.config.hidden_units, 1)
            self.keep_active_head = nn.Linear(self.config.hidden_units, 1)
            self.promote_long_head = nn.Linear(self.config.hidden_units, 1)
            self.evict_native_head = nn.Linear(self.config.hidden_units, 1)
        self._lock = threading.RLock()
        self._states: dict[str, tuple[torch.Tensor, ControllerStateSnapshot]] = {}
        self._ignore_persisted_once: set[str] = set()
        self._pending: OrderedDict[str, _PendingControl] = OrderedDict()
        self._optimizer: torch.optim.Optimizer | None = None
        self._online_update_count = 0

    @property
    def feature_order(self) -> tuple[str, ...]:
        semantic = tuple(f"query_embedding_{index}" for index in range(self.config.semantic_dimensions))
        model = tuple(f"model_state_{index}" for index in range(self.config.model_state_dimensions))
        return self.base_feature_order + semantic + model

    @property
    def model_sha256(self) -> str:
        return _module_sha256(self)

    @property
    def online_update_count(self) -> int:
        return self._online_update_count

    @staticmethod
    def _state_scope(query: MemoryQuery) -> str:
        explicit = query.context.get("controller_scope")
        if explicit is not None and str(explicit).strip():
            return str(explicit).strip()
        return f"{query.requester_agent.strip()}::{query.task_id.strip()}"

    @staticmethod
    def _fixed_vector(value: Any, dimensions: int) -> list[float]:
        if dimensions == 0:
            return []
        if not isinstance(value, (list, tuple)):
            return [0.0] * dimensions
        values = [_finite_float(item) for item in value[:dimensions]]
        values.extend([0.0] * (dimensions - len(values)))
        norm = math.sqrt(sum(item * item for item in values))
        return values if norm == 0.0 else [item / norm for item in values]

    @staticmethod
    def _cosine(left: Sequence[float], right: Sequence[float]) -> float:
        count = min(len(left), len(right))
        if count == 0:
            return 0.0
        lhs = [_finite_float(value) for value in left[:count]]
        rhs = [_finite_float(value) for value in right[:count]]
        denominator = math.sqrt(sum(value * value for value in lhs)) * math.sqrt(
            sum(value * value for value in rhs)
        )
        if denominator == 0.0:
            return 0.0
        return max(-1.0, min(1.0, sum(a * b for a, b in zip(lhs, rhs)) / denominator))

    def _semantic_similarity(
        self,
        query: MemoryQuery,
        record: MemoryRecord,
        query_embedding: Sequence[float],
    ) -> float:
        explicit = query.context.get("candidate_semantic_similarity")
        if isinstance(explicit, Mapping) and record.record_sha256 in explicit:
            return _bounded(explicit[record.record_sha256], -1.0, 1.0)
        record_embedding = record.metadata.get("embedding")
        if isinstance(record_embedding, (list, tuple)):
            return self._cosine(query_embedding, record_embedding)
        return _bounded(record.metadata.get("semantic_similarity", 0.0), -1.0, 1.0)

    def _candidate_inputs(
        self,
        query: MemoryQuery,
        records: Sequence[MemoryRecord],
    ) -> torch.Tensor:
        requested_owner = query.context.get("requested_owner_agent")
        required = set(query.required_tags)
        query_embedding = self._fixed_vector(
            query.context.get("query_embedding"), self.config.semantic_dimensions
        )
        model_state = self._fixed_vector(
            query.context.get("model_state"), self.config.model_state_dimensions
        )
        now = _parse_timestamp(query.context.get("event_time_utc")) or datetime.now(timezone.utc)
        rows: list[list[float]] = []
        for record in records:
            record_time = _parse_timestamp(record.committed_at_utc) or now
            age_seconds = max(0.0, (now - record_time).total_seconds())
            tag_fraction = len(required.intersection(record.tags)) / max(1, len(required))
            row = [
                _bounded(record.quality_score, 0.0, 1.0),
                float(bool(requested_owner) and record.owner_agent == requested_owner),
                _bounded(tag_fraction, 0.0, 1.0),
                math.log1p(max(0.0, float(record.version))) / 10.0,
                self._semantic_similarity(query, record, query_embedding),
                _bounded(record.metadata.get("historical_reward", 0.0), -1.0, 1.0),
                _bounded(record.metadata.get("historical_success_rate", 0.5), 0.0, 1.0, 0.5),
                math.log1p(max(0.0, _finite_float(record.metadata.get("usage_count", 0.0)))) / 10.0,
                math.log1p(age_seconds) / math.log1p(self.config.maximum_delta_t_seconds),
                _bounded(
                    record.metadata.get("conflict_score", query.context.get("conflict_score", 0.0)),
                    0.0,
                    1.0,
                ),
                _bounded(query.context.get("storage_pressure", 0.0), 0.0, 1.0),
                _bounded(query.context.get("query_difficulty", 0.5), 0.0, 1.0, 0.5),
                _bounded(query.context.get("model_confidence", 0.5), 0.0, 1.0, 0.5),
                math.log1p(max(0.0, _finite_float(query.context.get("recent_latency_ms", 0.0))))
                / 12.0,
                *query_embedding,
                *model_state,
            ]
            rows.append(row)
        device = next(self.parameters()).device
        return torch.tensor(rows, dtype=torch.float32, device=device)

    def _load_state(
        self,
        state_scope: str,
        *,
        reset: bool,
    ) -> tuple[torch.Tensor, ControllerStateSnapshot | None]:
        device = next(self.parameters()).device
        if reset or not self.persistent_state or state_scope in self._ignore_persisted_once:
            self._ignore_persisted_once.discard(state_scope)
            return torch.zeros((1, self.config.hidden_units), dtype=torch.float32, device=device), None
        if self.state_store is not None:
            loaded = self.state_store.load(state_scope)
            if loaded is not None:
                state, snapshot = loaded
                if tuple(state.shape) != (1, self.config.hidden_units):
                    raise RuntimeError("persisted controller state hidden size mismatch")
                return state.to(device), snapshot
        memory_state = self._states.get(state_scope)
        if memory_state is not None:
            state, snapshot = memory_state
            return state.to(device), snapshot
        return torch.zeros((1, self.config.hidden_units), dtype=torch.float32, device=device), None

    def _delta_t(
        self,
        query: MemoryQuery,
        snapshot: ControllerStateSnapshot | None,
    ) -> tuple[float, str]:
        event_time = _parse_timestamp(query.context.get("event_time_utc")) or datetime.now(timezone.utc)
        explicit = query.context.get("delta_t_seconds")
        if explicit is not None:
            delta = _finite_float(explicit, 1.0)
        elif snapshot is None:
            delta = 1.0
        else:
            previous = _parse_timestamp(snapshot.updated_at_utc)
            delta = 1.0 if previous is None else (event_time - previous).total_seconds()
        delta = max(
            self.config.minimum_delta_t_seconds,
            min(self.config.maximum_delta_t_seconds, delta),
        )
        return delta, event_time.isoformat()

    def _forward_tensors(
        self,
        candidate_inputs: torch.Tensor,
        previous_state: torch.Tensor,
        delta_t_seconds: float,
    ) -> dict[str, torch.Tensor]:
        if candidate_inputs.ndim != 2 or candidate_inputs.shape[1] != len(self.feature_order):
            raise ValueError(
                f"liquid controller inputs must be shaped (N, {len(self.feature_order)})"
            )
        candidate_count = candidate_inputs.shape[0]
        if candidate_count == 0:
            raise ValueError("liquid controller requires at least one eligible candidate")
        hx = previous_state.to(candidate_inputs.device).expand(candidate_count, -1).contiguous()
        sequence_input = candidate_inputs.unsqueeze(1)
        # ncps 0.0.2 squeezes timespans before the CfC cell. Repeating the
        # scalar across hidden units preserves the intended scalar Δt while
        # keeping it broadcastable for batches with more than one candidate.
        timespans = torch.full(
            (candidate_count, 1, self.config.hidden_units),
            float(delta_t_seconds),
            dtype=candidate_inputs.dtype,
            device=candidate_inputs.device,
        )
        sequence, candidate_states = self.cfc(
            sequence_input,
            hx=hx,
            timespans=timespans,
        )
        encoded = sequence[:, 0, :]
        next_state = candidate_states.mean(dim=0, keepdim=True)
        route_logits = self.route_head(encoded).squeeze(-1)
        pooled = self.control_backbone(encoded.mean(dim=0, keepdim=True))
        read_gate = torch.sigmoid(self.read_head(pooled)).squeeze()
        write_gate = torch.sigmoid(self.write_head(pooled)).squeeze()
        injection_gain = (
            torch.sigmoid(self.gain_head(pooled)).squeeze()
            * self.config.maximum_injection_gain
        )
        version_logits = self.version_head(pooled).squeeze(0)
        return {
            "route_logits": route_logits,
            "route_probabilities": torch.softmax(route_logits, dim=0),
            "read_gate": read_gate,
            "write_gate": write_gate,
            "injection_gain": injection_gain,
            "version_logits": version_logits,
            "load_to_native_gate": torch.sigmoid(self.load_native_head(pooled)).squeeze(),
            "keep_active_gate": torch.sigmoid(self.keep_active_head(pooled)).squeeze(),
            "promote_to_long_term_gate": torch.sigmoid(self.promote_long_head(pooled)).squeeze(),
            "evict_from_native_gate": torch.sigmoid(self.evict_native_head(pooled)).squeeze(),
            "next_state": next_state,
        }

    def _save_state(
        self,
        *,
        state_scope: str,
        state: torch.Tensor,
        previous: ControllerStateSnapshot | None,
        delta_t_seconds: float,
        event_time_utc: str,
        controller_model_sha256: str,
    ) -> ControllerStateSnapshot | None:
        if not self.persistent_state:
            return None
        if self.state_store is not None:
            return self.state_store.save(
                state_scope=state_scope,
                state=state,
                controller_model_sha256=controller_model_sha256,
                delta_t_seconds=delta_t_seconds,
                expected_version=None if previous is None else previous.version,
                updated_at_utc=event_time_utc,
            )
        version = 1 if previous is None else previous.version + 1
        state_sha256 = _tensor_sha256(state)
        parent = None if previous is None else previous.record_sha256
        record_sha256 = canonical_json_sha256(
            {
                "state_scope": state_scope,
                "version": version,
                "state_sha256": state_sha256,
                "parent_record_sha256": parent,
                "controller_model_sha256": controller_model_sha256,
                "delta_t_seconds": delta_t_seconds,
                "updated_at_utc": event_time_utc,
            }
        )
        snapshot = ControllerStateSnapshot(
            state_scope=state_scope,
            version=version,
            state_sha256=state_sha256,
            record_sha256=record_sha256,
            parent_record_sha256=parent,
            controller_model_sha256=controller_model_sha256,
            delta_t_seconds=delta_t_seconds,
            updated_at_utc=event_time_utc,
        )
        self._states[state_scope] = (state.detach().to("cpu"), snapshot)
        return snapshot

    def control(
        self,
        query: MemoryQuery,
        records: Sequence[MemoryRecord],
        features: Sequence[Mapping[str, float]] | None = None,
    ) -> LiquidControlDecision:
        del features  # Records and query context are the authoritative features.
        if not records:
            raise ValueError("liquid controller requires screened memory candidates")
        with self._lock:
            state_scope = self._state_scope(query)
            previous_state, previous_snapshot = self._load_state(
                state_scope,
                reset=bool(query.context.get("reset_controller_state", False)),
            )
            delta_t_seconds, event_time_utc = self._delta_t(query, previous_snapshot)
            candidate_inputs = self._candidate_inputs(query, records)
            outputs = self._forward_tensors(
                candidate_inputs,
                previous_state,
                delta_t_seconds,
            )
            selected_index = int(torch.argmax(outputs["route_probabilities"]).item())
            model_sha256 = self.model_sha256
            next_state = outputs["next_state"].detach()
            snapshot = self._save_state(
                state_scope=state_scope,
                state=next_state,
                previous=previous_snapshot,
                delta_t_seconds=delta_t_seconds,
                event_time_utc=event_time_utc,
                controller_model_sha256=model_sha256,
            )
            previous_state_sha256 = (
                None if previous_snapshot is None else previous_snapshot.state_sha256
            )
            next_state_sha256 = (
                _tensor_sha256(next_state) if snapshot is None else snapshot.state_sha256
            )
            version_index = int(torch.argmax(outputs["version_logits"]).item())
            decision = LiquidControlDecision(
                request_id=query.request_id,
                requester_agent=query.requester_agent,
                task_id=query.task_id,
                state_scope=state_scope,
                selected_index=selected_index,
                selected_record_sha256=records[selected_index].record_sha256,
                route_logits=tuple(
                    float(value)
                    for value in outputs["route_logits"].detach().to("cpu").tolist()
                ),
                route_probabilities=tuple(
                    float(value)
                    for value in outputs["route_probabilities"].detach().to("cpu").tolist()
                ),
                read_gate=float(outputs["read_gate"].detach().item()),
                write_gate=float(outputs["write_gate"].detach().item()),
                injection_gain=float(outputs["injection_gain"].detach().item()),
                version_action=self.version_actions[version_index],
                delta_t_seconds=delta_t_seconds,
                previous_state_sha256=previous_state_sha256,
                next_state_sha256=next_state_sha256,
                controller_model_sha256=model_sha256,
                state_version=None if snapshot is None else snapshot.version,
                load_to_native_gate=float(outputs["load_to_native_gate"].detach().item()),
                keep_active_gate=float(outputs["keep_active_gate"].detach().item()),
                promote_to_long_term_gate=float(
                    outputs["promote_to_long_term_gate"].detach().item()
                ),
                evict_from_native_gate=float(outputs["evict_from_native_gate"].detach().item()),
                metadata=immutable_mapping(
                    {
                        "controller_kind": "ncps.torch.CfC",
                        "candidate_count": len(records),
                        "state_record_sha256": None if snapshot is None else snapshot.record_sha256,
                        "feature_order": self.feature_order,
                        "timespan_supplied": True,
                        "candidate_axis_is_batch": True,
                    }
                ),
            )
            self._pending[query.request_id] = _PendingControl(
                request_id=query.request_id,
                state_scope=state_scope,
                candidate_inputs=candidate_inputs.detach().to("cpu"),
                previous_state=previous_state.detach().to("cpu"),
                delta_t_seconds=delta_t_seconds,
                selected_index=selected_index,
                record_sha256s=tuple(record.record_sha256 for record in records),
            )
            self._pending.move_to_end(query.request_id)
            while len(self._pending) > self.config.pending_request_limit:
                self._pending.popitem(last=False)
            return decision

    def score(
        self,
        query: MemoryQuery,
        records: Sequence[MemoryRecord],
        features: Sequence[Mapping[str, float]],
    ) -> Sequence[float]:
        return self.control(query, records, features).route_logits

    def _reward(
        self,
        outcome: MemoryOutcome,
        *,
        latency_ms: float,
        conflict_score: float,
    ) -> tuple[float, Mapping[str, float]]:
        read_gain = 0.0 if outcome.read_causal_gain is None else outcome.read_causal_gain
        content_gain = 0.0 if outcome.content_specificity is None else outcome.content_specificity
        shuffle_gain = 0.0 if outcome.shuffle_specificity is None else outcome.shuffle_specificity
        latency_penalty = self.config.latency_penalty_weight * (
            math.log1p(max(0.0, latency_ms)) / math.log1p(60000.0)
        )
        conflict_penalty = self.config.conflict_penalty_weight * _bounded(
            conflict_score, 0.0, 1.0
        )
        raw_reward = (
            outcome.module_gain
            + 0.5 * read_gain
            + 0.5 * content_gain
            + 0.25 * shuffle_gain
            - latency_penalty
            - conflict_penalty
        )
        reward = max(-1.0, min(1.0, raw_reward))
        return reward, immutable_mapping(
            {
                "module_gain": outcome.module_gain,
                "read_causal_gain": read_gain,
                "content_specificity": content_gain,
                "shuffle_specificity": shuffle_gain,
                "latency_penalty": latency_penalty,
                "conflict_penalty": conflict_penalty,
                "raw_reward": raw_reward,
            }
        )

    def update_from_feedback(
        self,
        *,
        request_id: str,
        outcome: MemoryOutcome,
        latency_ms: float = 0.0,
        conflict_score: float = 0.0,
    ) -> LiquidControllerUpdate:
        with self._lock:
            before = self.model_sha256
            pending = self._pending.pop(request_id, None)
            reward, reward_metadata = self._reward(
                outcome,
                latency_ms=float(latency_ms),
                conflict_score=float(conflict_score),
            )
            if pending is None:
                return LiquidControllerUpdate(
                    request_id=request_id,
                    updated=False,
                    reward=reward,
                    loss=None,
                    version_action=None,
                    model_sha256_before=before,
                    model_sha256_after=before,
                    reason="missing_pending_control",
                    metadata=reward_metadata,
                )
            device = next(self.parameters()).device
            candidate_inputs = pending.candidate_inputs.to(device)
            previous_state = pending.previous_state.to(device)
            outputs = self._forward_tensors(
                candidate_inputs,
                previous_state,
                pending.delta_t_seconds,
            )
            selected_index = pending.selected_index
            log_probability = torch.log_softmax(outputs["route_logits"], dim=0)[selected_index]
            route_loss = -float(reward) * log_probability
            gate_target = torch.tensor(
                max(0.0, min(1.0, 0.5 + 0.5 * reward)),
                dtype=outputs["read_gate"].dtype,
                device=device,
            )
            write_target = torch.tensor(
                1.0 if outcome.attribution_passed and reward > 0.0 else max(0.0, gate_target.item() - 0.25),
                dtype=outputs["write_gate"].dtype,
                device=device,
            )
            gate_loss = F.binary_cross_entropy(outputs["read_gate"], gate_target)
            gate_loss = gate_loss + F.binary_cross_entropy(outputs["write_gate"], write_target)
            gain_target = gate_target * self.config.maximum_injection_gain
            gain_loss = F.mse_loss(outputs["injection_gain"], gain_target)
            if reward >= self.config.promotion_threshold and outcome.attribution_passed:
                version_action = MemoryVersionAction.NEW_VERSION
            elif reward <= self.config.demotion_threshold:
                version_action = MemoryVersionAction.RETIRE
            else:
                version_action = MemoryVersionAction.REUSE
            version_target = torch.tensor(
                [self.version_actions.index(version_action)],
                dtype=torch.long,
                device=device,
            )
            version_loss = F.cross_entropy(outputs["version_logits"].unsqueeze(0), version_target)
            tier_targets = {
                "load_to_native_gate": gate_target,
                "keep_active_gate": torch.tensor(
                    1.0 if reward > 0.0 else 0.0,
                    dtype=gate_target.dtype,
                    device=device,
                ),
                "promote_to_long_term_gate": torch.tensor(
                    1.0
                    if outcome.attribution_passed and reward >= self.config.promotion_threshold
                    else 0.0,
                    dtype=gate_target.dtype,
                    device=device,
                ),
                "evict_from_native_gate": torch.tensor(
                    1.0 if reward <= self.config.demotion_threshold else 0.0,
                    dtype=gate_target.dtype,
                    device=device,
                ),
            }
            tier_loss = sum(
                F.binary_cross_entropy(outputs[name], target)
                for name, target in tier_targets.items()
            )
            loss = (
                route_loss
                + 0.25 * gate_loss
                + 0.25 * gain_loss
                + 0.25 * version_loss
                + 0.25 * tier_loss
            )
            if not torch.isfinite(loss):
                raise RuntimeError("liquid controller feedback loss is not finite")
            if self._optimizer is None:
                self._optimizer = torch.optim.Adam(
                    self.parameters(), lr=self.config.learning_rate
                )
            self._optimizer.zero_grad(set_to_none=True)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(self.parameters(), max_norm=1.0)
            self._optimizer.step()
            self._online_update_count += 1
            after = self.model_sha256
            if self.checkpoint_path is not None:
                self.save_checkpoint(self.checkpoint_path)
            metadata = dict(reward_metadata)
            metadata.update(
                {
                    "selected_index": selected_index,
                    "selected_record_sha256": pending.record_sha256s[selected_index],
                    "online_update_count": self._online_update_count,
                    "route_loss": float(route_loss.detach().item()),
                    "gate_loss": float(gate_loss.detach().item()),
                    "gain_loss": float(gain_loss.detach().item()),
                    "version_loss": float(version_loss.detach().item()),
                    "tier_loss": float(tier_loss.detach().item()),
                }
            )
            return LiquidControllerUpdate(
                request_id=request_id,
                updated=True,
                reward=reward,
                loss=float(loss.detach().item()),
                version_action=version_action,
                model_sha256_before=before,
                model_sha256_after=after,
                state_scope=pending.state_scope,
                metadata=immutable_mapping(metadata),
            )

    def reset_state(self, state_scope: str | None = None) -> None:
        with self._lock:
            if state_scope is None:
                self._states.clear()
                self._ignore_persisted_once.clear()
            else:
                self._states.pop(state_scope, None)
                if self.state_store is not None:
                    self._ignore_persisted_once.add(state_scope)

    def save_checkpoint(self, path: Path | None = None) -> str:
        destination = self.checkpoint_path if path is None else Path(path).resolve()
        if destination is None:
            raise ValueError("checkpoint path is required")
        destination.parent.mkdir(parents=True, exist_ok=True)
        temporary = destination.with_name(
            f"tmp-{destination.name}-{os.getpid()}-{time.time_ns()}"
        )
        payload = {
            "schema_version": "synapxnet.liquid_controller.v1",
            "config": asdict(self.config),
            "feature_order": self.feature_order,
            "state_dict": self.state_dict(),
            "online_update_count": self._online_update_count,
        }
        try:
            torch.save(payload, temporary)
            # Windows rejects fsync on a read-only descriptor. Reopen the
            # completed checkpoint read/write so durability is portable.
            with temporary.open("r+b") as handle:
                handle.flush()
                os.fsync(handle.fileno())
            temporary.replace(destination)
            if os.name != "nt":
                os.chmod(destination, 0o600)
        finally:
            if temporary.exists():
                temporary.unlink()
        return sha256_bytes(destination.read_bytes())

    def load_checkpoint(self, path: Path | None = None) -> str:
        source = self.checkpoint_path if path is None else Path(path).resolve()
        if source is None or not source.is_file():
            raise FileNotFoundError(source)
        payload = torch.load(source, map_location="cpu", weights_only=True)
        if payload.get("schema_version") != "synapxnet.liquid_controller.v1":
            raise RuntimeError("unsupported liquid controller checkpoint schema")
        if tuple(payload.get("feature_order", ())) != self.feature_order:
            raise RuntimeError("liquid controller checkpoint feature contract mismatch")
        self.load_state_dict(payload["state_dict"], strict=True)
        self._online_update_count = int(payload.get("online_update_count", 0))
        self._optimizer = None
        return sha256_bytes(source.read_bytes())
