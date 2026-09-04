from __future__ import annotations

from typing import Any, Callable, Mapping

from ..contracts import BoundMemory, MemorySelection, immutable_mapping, sha256_bytes
from ..precipitation.storage import TransactionalMemoryStore


class MemoryLoader:
    """Load and verify the selected checkpoint before model binding."""

    def __init__(
        self,
        storage: TransactionalMemoryStore,
        *,
        binding_metadata_factory: Callable[[MemorySelection, bytes], Mapping[str, Any]] | None = None,
    ) -> None:
        self.storage = storage
        self.binding_metadata_factory = binding_metadata_factory

    def load(self, selection: MemorySelection) -> BoundMemory:
        payload = self.storage.load_payload(selection.record)
        digest = sha256_bytes(payload)
        if digest != selection.record.payload_sha256:
            raise RuntimeError("selected memory payload hash mismatch")
        metadata = (
            self.binding_metadata_factory(selection, payload)
            if self.binding_metadata_factory is not None
            else {
                "owner_agent": selection.record.owner_agent,
                "task_id": selection.record.task_id,
                "schema_version": selection.record.schema_version,
                "version": selection.record.version,
                "read_gate": selection.read_gate,
                "write_gate": selection.write_gate,
                "injection_gain": selection.injection_gain,
                "version_action": selection.version_action.value,
                "controller_state_sha256": selection.controller_state_sha256,
                "previous_controller_state_sha256": selection.previous_controller_state_sha256,
                "controller_model_sha256": selection.controller_model_sha256,
                "controller_state_version": selection.controller_state_version,
                "delta_t_seconds": selection.delta_t_seconds,
                "load_to_native_gate": selection.load_to_native_gate,
                "keep_active_gate": selection.keep_active_gate,
                "promote_to_long_term_gate": selection.promote_to_long_term_gate,
                "evict_from_native_gate": selection.evict_from_native_gate,
            }
        )
        return BoundMemory(
            selection=selection,
            payload=payload,
            loaded_payload_sha256=digest,
            binding_metadata=immutable_mapping(metadata),
        )
