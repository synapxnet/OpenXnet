from __future__ import annotations

import hashlib
import io
import math
import threading
from typing import Any, Mapping

import torch

from ..contracts import (
    NativeMemorySnapshot,
    canonical_json_sha256,
    immutable_mapping,
    sha256_bytes,
    utc_now,
)


def _tensor_digest(tensors: Mapping[str, torch.Tensor]) -> str:
    digest = hashlib.sha256()
    for name, value in sorted(tensors.items()):
        tensor = value.detach().to("cpu").contiguous()
        digest.update(name.encode("utf-8"))
        digest.update(str(tensor.dtype).encode("ascii"))
        digest.update(str(tuple(tensor.shape)).encode("ascii"))
        digest.update(tensor.view(torch.uint8).numpy().tobytes(order="C"))
    return digest.hexdigest()


class TorchNativeSnapshotCodec:
    """Weights-only codec for Metis native memory states, not model parameters."""

    codec_name = "synapxnet.metis_native_state.torch_weights_only.v1"

    def encode(
        self,
        *,
        session_id: str,
        model_id: str,
        tensors: Mapping[str, torch.Tensor],
        source_record_sha256: str | None = None,
        metadata: Mapping[str, Any] | None = None,
    ) -> NativeMemorySnapshot:
        if not session_id.strip() or not model_id.strip():
            raise ValueError("session_id and model_id are required")
        normalized: dict[str, torch.Tensor] = {}
        for name, value in tensors.items():
            if not isinstance(name, str) or not name.strip() or not isinstance(value, torch.Tensor):
                raise TypeError("native snapshot tensors require non-empty names and tensors")
            tensor = value.detach().to("cpu").contiguous()
            if not torch.isfinite(tensor.float()).all():
                raise ValueError(f"native memory tensor {name!r} contains non-finite values")
            normalized[name] = tensor
        created_at = utc_now()
        buffer = io.BytesIO()
        torch.save(
            {
                "schema_version": "synapxnet.metis_native_state.v1",
                "model_id": model_id,
                "state_sha256": _tensor_digest(normalized),
                "tensors": normalized,
            },
            buffer,
        )
        payload = buffer.getvalue()
        payload_sha256 = sha256_bytes(payload)
        snapshot_id = canonical_json_sha256(
            {
                "session_id": session_id,
                "model_id": model_id,
                "codec": self.codec_name,
                "payload_sha256": payload_sha256,
                "tensor_count": len(normalized),
                "source_record_sha256": source_record_sha256,
                "created_at_utc": created_at,
            }
        )
        snapshot_metadata = dict(metadata or {})
        snapshot_metadata.update(
            {
                "state_sha256": _tensor_digest(normalized),
                "raw_prompts_persisted": False,
                "model_parameters_included": False,
            }
        )
        return NativeMemorySnapshot(
            snapshot_id=snapshot_id,
            session_id=session_id,
            model_id=model_id,
            codec=self.codec_name,
            payload=payload,
            payload_sha256=payload_sha256,
            tensor_count=len(normalized),
            source_record_sha256=source_record_sha256,
            created_at_utc=created_at,
            metadata=immutable_mapping(snapshot_metadata),
        )

    def decode(self, snapshot: NativeMemorySnapshot) -> dict[str, torch.Tensor]:
        if snapshot.codec != self.codec_name:
            raise ValueError(f"unsupported native memory codec: {snapshot.codec}")
        if sha256_bytes(snapshot.payload) != snapshot.payload_sha256:
            raise RuntimeError("native memory snapshot payload failed SHA-256 verification")
        value = torch.load(io.BytesIO(snapshot.payload), map_location="cpu", weights_only=True)
        if value.get("schema_version") != "synapxnet.metis_native_state.v1":
            raise RuntimeError("unsupported native memory snapshot schema")
        if value.get("model_id") != snapshot.model_id:
            raise RuntimeError("native memory snapshot model identity mismatch")
        tensors = value.get("tensors")
        if not isinstance(tensors, dict) or any(
            not isinstance(name, str) or not isinstance(tensor, torch.Tensor)
            for name, tensor in tensors.items()
        ):
            raise RuntimeError("native memory snapshot tensor payload is invalid")
        if len(tensors) != snapshot.tensor_count:
            raise RuntimeError("native memory snapshot tensor count mismatch")
        if _tensor_digest(tensors) != value.get("state_sha256"):
            raise RuntimeError("native memory snapshot state digest mismatch")
        return {name: tensor.detach().to("cpu").contiguous() for name, tensor in tensors.items()}

    def from_payload(
        self,
        *,
        payload: bytes,
        session_id: str,
        model_id: str,
        snapshot_id: str,
        tensor_count: int,
        source_record_sha256: str | None,
        created_at_utc: str,
        metadata: Mapping[str, Any] | None = None,
    ) -> NativeMemorySnapshot:
        return NativeMemorySnapshot(
            snapshot_id=snapshot_id,
            session_id=session_id,
            model_id=model_id,
            codec=self.codec_name,
            payload=payload,
            payload_sha256=sha256_bytes(payload),
            tensor_count=int(tensor_count),
            source_record_sha256=source_record_sha256,
            created_at_utc=created_at_utc,
            metadata=immutable_mapping(metadata),
        )


class MetisNativeMemoryAdapter:
    """Adapter over Metis' public reset/commit/generate and local-memory state APIs."""

    def __init__(
        self,
        model: Any,
        *,
        model_id: str,
        codec: TorchNativeSnapshotCodec | None = None,
    ) -> None:
        if not model_id.strip():
            raise ValueError("model_id is required")
        self.model = model
        self.model_id = model_id
        self.codec = codec or TorchNativeSnapshotCodec()
        self._lock = threading.RLock()
        self._validate_model()

    def _validate_model(self) -> None:
        blocks = getattr(getattr(self.model, "model", None), "metis_blocks", None)
        if blocks is None:
            raise TypeError("model does not expose model.metis_blocks")
        if not callable(getattr(self.model, "reset", None)) and not callable(
            getattr(self.model, "reset_memory", None)
        ):
            raise TypeError("model does not expose reset or reset_memory")
        if not callable(getattr(self.model, "generate", None)):
            raise TypeError("model does not expose generate")

    def _blocks(self):
        return getattr(self.model.model, "metis_blocks")

    def reset(self) -> None:
        with self._lock:
            reset = getattr(self.model, "reset", None) or getattr(self.model, "reset_memory")
            reset()

    def _input_device(self) -> torch.device:
        try:
            return self.model.model.metis_backbone.model.embed_tokens.weight.device
        except (AttributeError, StopIteration):
            try:
                return next(self.model.parameters()).device
            except StopIteration:
                return torch.device("cpu")

    def _as_inputs(
        self,
        input_ids: torch.Tensor | list[int] | tuple[int, ...],
        attention_mask: torch.Tensor | None,
    ) -> tuple[torch.Tensor, torch.Tensor]:
        device = self._input_device()
        ids = input_ids if isinstance(input_ids, torch.Tensor) else torch.tensor(input_ids)
        if ids.ndim == 1:
            ids = ids.unsqueeze(0)
        ids = ids.to(device=device, dtype=torch.long)
        mask = attention_mask
        if mask is None:
            mask = torch.ones_like(ids)
        elif mask.ndim == 1:
            mask = mask.unsqueeze(0)
        return ids, mask.to(device=device, dtype=torch.long)

    @torch.inference_mode()
    def commit_tokens(
        self,
        input_ids: torch.Tensor | list[int] | tuple[int, ...],
        *,
        attention_mask: torch.Tensor | None = None,
    ) -> Mapping[str, Any]:
        ids, mask = self._as_inputs(input_ids, attention_mask)
        with self._lock:
            self.model(
                input_ids=ids,
                attention_mask=mask,
                attention_mask_1d=mask,
                commit_memory=True,
                use_cache=False,
                logits_to_keep=1,
            )
            tensors = self._capture_tensors()
        return immutable_mapping(
            {
                "committed_token_count": int(mask.sum().item()),
                "state_sha256": _tensor_digest(tensors),
                "tensor_count": len(tensors),
                "gradient_free": True,
            }
        )

    @torch.inference_mode()
    def generate(
        self,
        input_ids: torch.Tensor | list[int] | tuple[int, ...],
        *,
        attention_mask: torch.Tensor | None = None,
        **generation_kwargs: Any,
    ) -> torch.Tensor:
        ids, mask = self._as_inputs(input_ids, attention_mask)
        with self._lock:
            return self.model.generate(input_ids=ids, attention_mask=mask, **generation_kwargs)

    def _capture_tensors(self) -> dict[str, torch.Tensor]:
        tensors: dict[str, torch.Tensor] = {}
        for index, block in enumerate(self._blocks()):
            local = getattr(block, "local_memory", None)
            if local is None:
                continue
            state = getattr(local, "state", None)
            if isinstance(state, torch.Tensor):
                tensors[f"layer.{index}.state"] = state.detach().to("cpu").contiguous()
            key_state = getattr(local, "key_state", None)
            if isinstance(key_state, torch.Tensor):
                tensors[f"layer.{index}.key_state"] = key_state.detach().to("cpu").contiguous()
        return tensors

    def export_snapshot(
        self,
        *,
        session_id: str,
        source_record_sha256: str | None = None,
        metadata: Mapping[str, Any] | None = None,
    ) -> NativeMemorySnapshot:
        with self._lock:
            tensors = self._capture_tensors()
        return self.codec.encode(
            session_id=session_id,
            model_id=self.model_id,
            tensors=tensors,
            source_record_sha256=source_record_sha256,
            metadata=metadata,
        )

    def _memory_device_dtype(self, block: Any) -> tuple[torch.device, torch.dtype]:
        hyper = getattr(block, "hyper_memory", None)
        if hyper is not None:
            try:
                parameter = next(hyper.parameters())
                return parameter.device, parameter.dtype
            except StopIteration:
                pass
        try:
            parameter = next(self.model.parameters())
            return parameter.device, parameter.dtype
        except StopIteration:
            return torch.device("cpu"), torch.float32

    def import_snapshot(self, snapshot: NativeMemorySnapshot) -> Mapping[str, Any]:
        if snapshot.model_id != self.model_id:
            raise ValueError("native snapshot is not compatible with this Metis model")
        tensors = self.codec.decode(snapshot)
        with self._lock:
            self.reset()
            restored = 0
            for index, block in enumerate(self._blocks()):
                local = getattr(block, "local_memory", None)
                if local is None:
                    continue
                state = tensors.get(f"layer.{index}.state")
                key_state = tensors.get(f"layer.{index}.key_state")
                if state is None:
                    continue
                device, dtype = self._memory_device_dtype(block)
                state = state.to(device=device, dtype=dtype)
                if key_state is not None:
                    local.write(state, key_state.to(device=device, dtype=dtype))
                else:
                    local.write(state)
                restored += 1
            unknown = [
                name
                for name in tensors
                if not name.startswith("layer.")
                or not name.rsplit(".", 1)[-1] in {"state", "key_state"}
            ]
            current = self._capture_tensors()
        if unknown:
            raise RuntimeError(f"native snapshot has unknown tensor keys: {unknown[:5]}")
        if _tensor_digest(current) != snapshot.metadata.get("state_sha256"):
            raise RuntimeError("restored native memory state digest mismatch")
        return immutable_mapping(
            {
                "restored_layer_count": restored,
                "tensor_count": len(tensors),
                "state_sha256": _tensor_digest(current),
            }
        )

    def state_sha256(self) -> str:
        with self._lock:
            return _tensor_digest(self._capture_tensors())
