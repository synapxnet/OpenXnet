from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from types import MappingProxyType
from typing import Any, Mapping


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def canonical_json_sha256(value: Mapping[str, Any]) -> str:
    encoded = json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        allow_nan=False,
    ).encode("utf-8")
    return sha256_bytes(encoded)


def immutable_mapping(value: Mapping[str, Any] | None = None) -> Mapping[str, Any]:
    return MappingProxyType(dict(value or {}))


class MemoryStatus(str, Enum):
    CANDIDATE = "CANDIDATE"
    COMMITTED = "COMMITTED"
    REJECTED = "REJECTED"
    RETIRED = "RETIRED"


class MemoryVersionAction(str, Enum):
    REUSE = "reuse"
    NEW_VERSION = "new_version"
    RETIRE = "retire"


class MemoryTier(str, Enum):
    SHORT_TERM = "short_term"
    ACTIVE_NATIVE = "active_native"
    LONG_TERM = "long_term"


@dataclass(frozen=True, slots=True)
class MemoryCandidate:
    candidate_id: str
    owner_agent: str
    task_id: str
    schema_version: str
    payload: bytes = field(repr=False)
    payload_sha256: str
    quality_score: float
    permissions: tuple[str, ...] = ()
    tags: tuple[str, ...] = ()
    metadata: Mapping[str, Any] = field(default_factory=immutable_mapping)
    created_at_utc: str = field(default_factory=utc_now)


@dataclass(frozen=True, slots=True)
class ValidationResult:
    accepted: bool
    reasons: tuple[str, ...]
    candidate_sha256: str


@dataclass(frozen=True, slots=True)
class MemoryRecord:
    memory_id: str
    version: int
    owner_agent: str
    task_id: str
    schema_version: str
    status: MemoryStatus
    payload_sha256: str
    record_sha256: str
    quality_score: float
    permissions: tuple[str, ...]
    tags: tuple[str, ...]
    metadata: Mapping[str, Any]
    created_at_utc: str
    committed_at_utc: str


@dataclass(frozen=True, slots=True)
class MemoryQuery:
    request_id: str
    requester_agent: str
    task_id: str
    intent: str
    allowed_schema_versions: tuple[str, ...] = ()
    required_tags: tuple[str, ...] = ()
    model_id: str | None = None
    max_candidates: int = 32
    context: Mapping[str, Any] = field(default_factory=immutable_mapping)


@dataclass(frozen=True, slots=True)
class MemorySelection:
    request_id: str
    record: MemoryRecord
    score: float
    read_gate: float
    write_gate: float
    injection_gain: float
    controller_state_sha256: str | None = None
    previous_controller_state_sha256: str | None = None
    controller_model_sha256: str | None = None
    controller_state_version: int | None = None
    delta_t_seconds: float | None = None
    version_action: MemoryVersionAction = MemoryVersionAction.REUSE
    route_logits: tuple[float, ...] = ()
    route_probabilities: tuple[float, ...] = ()
    load_to_native_gate: float = 0.0
    keep_active_gate: float = 0.0
    promote_to_long_term_gate: float = 0.0
    evict_from_native_gate: float = 0.0


@dataclass(frozen=True, slots=True)
class LiquidControlDecision:
    request_id: str
    requester_agent: str
    task_id: str
    state_scope: str
    selected_index: int
    selected_record_sha256: str
    route_logits: tuple[float, ...]
    route_probabilities: tuple[float, ...]
    read_gate: float
    write_gate: float
    injection_gain: float
    version_action: MemoryVersionAction
    delta_t_seconds: float
    previous_state_sha256: str | None
    next_state_sha256: str
    controller_model_sha256: str
    state_version: int | None = None
    load_to_native_gate: float = 0.0
    keep_active_gate: float = 0.0
    promote_to_long_term_gate: float = 0.0
    evict_from_native_gate: float = 0.0
    metadata: Mapping[str, Any] = field(default_factory=immutable_mapping)


@dataclass(frozen=True, slots=True)
class ShortTermMemoryEvent:
    event_id: str
    session_id: str
    request_id: str
    token_count: int
    input_sha256: str
    output_sha256: str | None = None
    metadata: Mapping[str, Any] = field(default_factory=immutable_mapping)
    created_at_utc: str = field(default_factory=utc_now)


@dataclass(frozen=True, slots=True)
class NativeMemorySnapshot:
    snapshot_id: str
    session_id: str
    model_id: str
    codec: str
    payload: bytes = field(repr=False)
    payload_sha256: str = ""
    tensor_count: int = 0
    source_record_sha256: str | None = None
    created_at_utc: str = field(default_factory=utc_now)
    metadata: Mapping[str, Any] = field(default_factory=immutable_mapping)


@dataclass(frozen=True, slots=True)
class ActiveMemoryLease:
    session_id: str
    snapshot_id: str
    model_id: str
    payload_sha256: str
    source_record_sha256: str | None
    activated_at_utc: str
    expires_at_utc: str
    access_count: int
    state_sha256: str


@dataclass(frozen=True, slots=True)
class HierarchicalMemoryResult:
    session_id: str
    request_id: str
    long_term_record_sha256: str | None
    active_snapshot_sha256: str | None
    short_term_event_count: int
    loaded_to_native: bool
    kept_active: bool
    promoted_to_long_term: bool
    evicted_from_native: bool
    controller_state_sha256: str | None
    metadata: Mapping[str, Any] = field(default_factory=immutable_mapping)


@dataclass(frozen=True, slots=True)
class ControllerStateSnapshot:
    state_scope: str
    version: int
    state_sha256: str
    record_sha256: str
    parent_record_sha256: str | None
    controller_model_sha256: str
    delta_t_seconds: float
    updated_at_utc: str


@dataclass(frozen=True, slots=True)
class LiquidControllerUpdate:
    request_id: str
    updated: bool
    reward: float
    loss: float | None
    version_action: MemoryVersionAction | None
    model_sha256_before: str
    model_sha256_after: str
    state_scope: str | None = None
    reason: str | None = None
    metadata: Mapping[str, Any] = field(default_factory=immutable_mapping)


@dataclass(frozen=True, slots=True)
class BoundMemory:
    selection: MemorySelection
    payload: bytes = field(repr=False)
    loaded_payload_sha256: str
    binding_metadata: Mapping[str, Any] = field(default_factory=immutable_mapping)


@dataclass(frozen=True, slots=True)
class MemoryUseTrace:
    trace_id: str
    request_id: str
    memory_id: str | None
    condition: str
    selected_record_sha256: str | None
    input_sha256: str
    output_sha256: str
    timings_ms: Mapping[str, float] = field(default_factory=immutable_mapping)
    gates: Mapping[str, float] = field(default_factory=immutable_mapping)
    metadata: Mapping[str, Any] = field(default_factory=immutable_mapping)
    created_at_utc: str = field(default_factory=utc_now)


@dataclass(frozen=True, slots=True)
class MemoryOutcome:
    memory_id: str | None
    matched_score: float
    baseline_score: float
    zero_score: float | None
    mismatch_score: float | None
    shuffled_score: float | None
    module_gain: float
    read_causal_gain: float | None
    content_specificity: float | None
    shuffle_specificity: float | None
    attribution_passed: bool
    metadata: Mapping[str, Any] = field(default_factory=immutable_mapping)
