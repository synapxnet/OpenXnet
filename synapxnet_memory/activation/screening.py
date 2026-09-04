from __future__ import annotations

from ..contracts import MemoryQuery, MemoryRecord, MemoryStatus


class MemoryCandidateScreener:
    """Apply non-negotiable symbolic constraints before neural selection."""

    def __init__(self, *, minimum_quality: float = 0.0) -> None:
        self.minimum_quality = float(minimum_quality)

    def _eligible(self, query: MemoryQuery, record: MemoryRecord) -> bool:
        if record.status is not MemoryStatus.COMMITTED:
            return False
        if record.task_id != query.task_id:
            return False
        if record.quality_score < self.minimum_quality:
            return False
        if query.allowed_schema_versions and record.schema_version not in query.allowed_schema_versions:
            return False
        if (
            query.requester_agent != record.owner_agent
            and "*" not in record.permissions
            and query.requester_agent not in record.permissions
        ):
            return False
        if not set(query.required_tags).issubset(record.tags):
            return False
        compatible_models = record.metadata.get("compatible_model_ids")
        if query.model_id and compatible_models and query.model_id not in compatible_models:
            return False
        if len(record.payload_sha256) != 64 or len(record.record_sha256) != 64:
            return False
        return True

    def screen(self, query: MemoryQuery, records: list[MemoryRecord]) -> list[MemoryRecord]:
        return [record for record in records if self._eligible(query, record)]
