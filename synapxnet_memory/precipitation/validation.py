from __future__ import annotations

import json

from ..contracts import (
    MemoryCandidate,
    ValidationResult,
    canonical_json_sha256,
    sha256_bytes,
)


class MemoryValidator:
    """Symbolic admission checks executed before transactional commit."""

    def __init__(
        self,
        *,
        minimum_quality: float = 0.0,
        allowed_schema_versions: tuple[str, ...] = ("synapxnet.memory.v1",),
        maximum_payload_bytes: int = 2 * 1024 * 1024 * 1024,
    ) -> None:
        self.minimum_quality = float(minimum_quality)
        self.allowed_schema_versions = frozenset(allowed_schema_versions)
        self.maximum_payload_bytes = int(maximum_payload_bytes)

    def validate(self, candidate: MemoryCandidate) -> ValidationResult:
        reasons = []
        if candidate.schema_version not in self.allowed_schema_versions:
            reasons.append("schema_version_not_allowed")
        if not 0.0 <= candidate.quality_score <= 1.0:
            reasons.append("quality_score_out_of_range")
        elif candidate.quality_score < self.minimum_quality:
            reasons.append("quality_score_below_threshold")
        if not candidate.owner_agent:
            reasons.append("owner_agent_missing")
        if not candidate.task_id:
            reasons.append("task_id_missing")
        if not candidate.payload:
            reasons.append("payload_empty")
        elif len(candidate.payload) > self.maximum_payload_bytes:
            reasons.append("payload_too_large")
        if sha256_bytes(candidate.payload) != candidate.payload_sha256:
            reasons.append("payload_hash_mismatch")
        if any(not value.strip() for value in candidate.permissions):
            reasons.append("permission_empty")
        if len(candidate.permissions) != len(set(candidate.permissions)):
            reasons.append("permission_duplicate")
        try:
            json.dumps(dict(candidate.metadata), allow_nan=False)
        except (TypeError, ValueError):
            reasons.append("metadata_not_json_serializable")
        candidate_sha256 = canonical_json_sha256(
            {
                "candidate_id": candidate.candidate_id,
                "owner_agent": candidate.owner_agent,
                "task_id": candidate.task_id,
                "schema_version": candidate.schema_version,
                "payload_sha256": candidate.payload_sha256,
                "quality_score": candidate.quality_score,
                "permissions": candidate.permissions,
                "tags": candidate.tags,
                "metadata": dict(candidate.metadata),
                "created_at_utc": candidate.created_at_utc,
            }
        )
        return ValidationResult(
            accepted=not reasons,
            reasons=tuple(reasons),
            candidate_sha256=candidate_sha256,
        )
