from __future__ import annotations

import hashlib
import math
from typing import Mapping, Sequence

import torch
import torch.nn as nn
from ncps.torch import CfC

from ..contracts import MemoryQuery, MemoryRecord


def _state_dict_sha256(module: nn.Module) -> str:
    digest = hashlib.sha256()
    for name, value in sorted(module.state_dict().items()):
        tensor = value.detach().to("cpu").contiguous()
        digest.update(name.encode("utf-8"))
        digest.update(str(tensor.dtype).encode("ascii"))
        digest.update(str(tuple(tensor.shape)).encode("ascii"))
        digest.update(tensor.view(torch.uint8).numpy().tobytes(order="C"))
    return digest.hexdigest()


class LiquidMemoryDecisionScorer(nn.Module):
    """CfC scorer for candidates that already passed symbolic screening."""

    feature_order = ("quality", "requested_owner", "required_tags", "version")

    def __init__(
        self,
        *,
        hidden_units: int = 16,
        seed: int = 0,
        persistent_state: bool = True,
    ) -> None:
        super().__init__()
        self.persistent_state = bool(persistent_state)
        with torch.random.fork_rng(devices=[]):
            torch.manual_seed(int(seed))
            self.cfc = CfC(
                len(self.feature_order),
                hidden_units,
                return_sequences=True,
                batch_first=True,
                mixed_memory=False,
                backbone_units=32,
                backbone_layers=1,
                backbone_dropout=0.0,
            )
            self.score_head = nn.Linear(hidden_units, 1)
        self._state: torch.Tensor | None = None

    @property
    def model_sha256(self) -> str:
        return _state_dict_sha256(self)

    def reset_state(self) -> None:
        self._state = None

    def feature_tensor(
        self,
        features: Sequence[Mapping[str, float]],
    ) -> torch.Tensor:
        device = next(self.parameters()).device
        rows = []
        for value in features:
            rows.append(
                [
                    float(value["quality"]),
                    float(value["requested_owner"]),
                    float(value["required_tags"]),
                    math.log1p(max(0.0, float(value["version"]))) / 10.0,
                ]
            )
        return torch.tensor([rows], dtype=torch.float32, device=device)

    def forward_features(
        self,
        inputs: torch.Tensor,
        state: torch.Tensor | None = None,
    ) -> tuple[torch.Tensor, torch.Tensor]:
        if inputs.ndim != 3 or inputs.shape[-1] != len(self.feature_order):
            raise ValueError("liquid decision inputs must be shaped (B, T, 4)")
        sequence, next_state = self.cfc(inputs, hx=state)
        return self.score_head(sequence).squeeze(-1), next_state

    def score(
        self,
        query: MemoryQuery,
        records: Sequence[MemoryRecord],
        features: Sequence[Mapping[str, float]],
    ) -> Sequence[float]:
        if not records:
            return []
        inputs = self.feature_tensor(features)
        state = self._state.to(inputs.device) if self._state is not None else None
        scores, next_state = self.forward_features(inputs, state=state)
        scores = scores.squeeze(0)
        self._state = next_state.detach() if self.persistent_state else None
        return [float(value) for value in scores.detach().to("cpu").tolist()]
