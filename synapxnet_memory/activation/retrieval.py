from __future__ import annotations

from ..contracts import MemoryQuery, MemoryRecord
from ..precipitation.storage import TransactionalMemoryStore


class MemoryRetriever:
    """Turn a memory intent into a broad set of stored candidates."""

    def __init__(self, storage: TransactionalMemoryStore) -> None:
        self.storage = storage

    @staticmethod
    def should_retrieve(query: MemoryQuery) -> bool:
        intent = query.intent.strip().lower()
        return bool(intent) and intent not in {"none", "disabled", "no_memory"} and query.max_candidates > 0

    def retrieve(self, query: MemoryQuery) -> list[MemoryRecord]:
        if not self.should_retrieve(query):
            return []
        # Retrieval narrowing and controller intent are deliberately separate.
        # ``requested_owner_agent`` remains visible to the decision controller;
        # callers may opt into a storage-level owner filter explicitly.
        owner = query.context.get("retrieval_owner_agent")
        return self.storage.query(
            task_id=query.task_id,
            owner_agent=str(owner) if owner else None,
            limit=query.max_candidates,
        )
