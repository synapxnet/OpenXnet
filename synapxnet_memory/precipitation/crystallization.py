from __future__ import annotations

from typing import Any, Mapping

from ..contracts import (
    MemoryCandidate,
    canonical_json_sha256,
    immutable_mapping,
    sha256_bytes,
)


class MemoryCrystallizer:
    """Convert a completed trajectory and feedback into a memory candidate."""

    def __init__(self, schema_version: str = "synapxnet.memory.v1") -> None:
        self.schema_version = schema_version

    def crystallize(
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
    ) -> MemoryCandidate:
        owner_agent = owner_agent.strip()
        task_id = task_id.strip()
        if not owner_agent or not task_id:
            raise ValueError("owner_agent and task_id are required")
        if not isinstance(payload, bytes) or not payload:
            raise ValueError("payload must be non-empty bytes")
        quality_score = float(feedback.get("score", feedback.get("quality_score", 0.0)))
        payload_sha256 = sha256_bytes(payload)
        trajectory_sha256 = canonical_json_sha256(trajectory)
        feedback_sha256 = canonical_json_sha256(feedback)
        candidate_material = {
            "owner_agent": owner_agent,
            "task_id": task_id,
            "schema_version": self.schema_version,
            "payload_sha256": payload_sha256,
            "trajectory_sha256": trajectory_sha256,
            "feedback_sha256": feedback_sha256,
            "permissions": sorted(set(permissions)),
            "tags": sorted(set(tags)),
        }
        candidate_id = canonical_json_sha256(candidate_material)
        candidate_metadata = dict(metadata or {})
        candidate_metadata.update(
            {
                "trajectory_sha256": trajectory_sha256,
                "feedback_sha256": feedback_sha256,
                "raw_trajectory_persisted": False,
                "raw_feedback_persisted": False,
            }
        )
        return MemoryCandidate(
            candidate_id=candidate_id,
            owner_agent=owner_agent,
            task_id=task_id,
            schema_version=self.schema_version,
            payload=payload,
            payload_sha256=payload_sha256,
            quality_score=quality_score,
            permissions=tuple(sorted(set(permissions))),
            tags=tuple(sorted(set(tags))),
            metadata=immutable_mapping(candidate_metadata),
        )
