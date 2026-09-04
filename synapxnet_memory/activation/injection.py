from __future__ import annotations

import hashlib
from typing import Any, Callable

import torch
import torch.nn as nn

from ..contracts import MemorySelection


def _tensor_sha256(value: torch.Tensor) -> str:
    tensor = value.detach().to("cpu").contiguous().view(torch.uint8)
    digest = hashlib.sha256()
    digest.update(str(value.dtype).encode("ascii"))
    digest.update(str(tuple(value.shape)).encode("ascii"))
    digest.update(tensor.numpy().tobytes(order="C"))
    return digest.hexdigest()


class MemoryInjectionEngine:
    """Inject loaded memory into one target hidden layer through a safe hook."""

    def __init__(
        self,
        *,
        target_layer: nn.Module,
        alignment_adapter: nn.Module,
        memory_provider: Callable[[torch.Tensor], torch.Tensor],
        injection_gain: float = 1.0,
        audit_limit: int = 2048,
    ) -> None:
        self.target_layer = target_layer
        self.alignment_adapter = alignment_adapter
        self.memory_provider = memory_provider
        self.injection_gain = float(injection_gain)
        self.audit_limit = int(audit_limit)
        self.enabled = True
        self.force_zero = False
        self.audit_records: list[dict[str, Any]] = []
        self._selection_context: dict[str, Any] = {}
        self._handle = target_layer.register_forward_hook(self._hook)

    def _hook(self, _module: nn.Module, _inputs: Any, output: Any) -> Any:
        if not self.enabled:
            return output
        hidden = output[0] if isinstance(output, tuple) else output
        self.alignment_adapter.to(hidden.device)
        memory = self.memory_provider(hidden).to(hidden.device)
        if memory.shape[:-1] != hidden.shape[:-1]:
            raise ValueError("memory provider returned incompatible sequence shape")
        contribution, gate = self.alignment_adapter(hidden.float(), memory.float())
        proposed = contribution * self.injection_gain
        applied = proposed * 0.0 if self.force_zero else proposed
        updated = hidden + applied.to(hidden.dtype)
        if len(self.audit_records) < self.audit_limit:
            self.audit_records.append(
                {
                    "activation_index": len(self.audit_records),
                    "status": "forced_zero" if self.force_zero else "injected",
                    "hidden_shape": list(hidden.shape),
                    "memory_shape": list(memory.shape),
                    "memory_sha256": _tensor_sha256(memory),
                    "proposed_sha256": _tensor_sha256(proposed),
                    "applied_sha256": _tensor_sha256(applied),
                    "gate_mean": float(gate.detach().float().mean().item()),
                    "injection_gain": self.injection_gain,
                    **self._selection_context,
                }
            )
        if isinstance(output, tuple):
            return (updated,) + output[1:]
        return updated

    def set_injection_gain(self, value: float) -> None:
        self.injection_gain = float(value)

    def configure_from_selection(self, selection: MemorySelection) -> None:
        self.enabled = selection.read_gate > 0.0
        self.injection_gain = float(selection.injection_gain)
        self._selection_context = {
            "request_id": selection.request_id,
            "selected_record_sha256": selection.record.record_sha256,
            "controller_state_sha256": selection.controller_state_sha256,
            "controller_model_sha256": selection.controller_model_sha256,
            "controller_state_version": selection.controller_state_version,
            "delta_t_seconds": selection.delta_t_seconds,
            "version_action": selection.version_action.value,
        }

    def set_force_zero(self, enabled: bool) -> None:
        self.force_zero = bool(enabled)

    def clear_audit(self) -> None:
        self.audit_records.clear()

    def close(self) -> None:
        self._handle.remove()

    def __enter__(self) -> "MemoryInjectionEngine":
        return self

    def __exit__(self, *_args: Any) -> None:
        self.close()
