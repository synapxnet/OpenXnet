from __future__ import annotations

import torch
import torch.nn as nn


class MemoryAlignmentAdapter(nn.Module):
    """Align a stored memory vector with a target model hidden state."""

    def __init__(self, hidden_size: int, memory_size: int, bottleneck_size: int | None = None) -> None:
        super().__init__()
        bottleneck = bottleneck_size or max(32, min(hidden_size, memory_size) // 2)
        self.hidden_norm = nn.LayerNorm(hidden_size)
        self.memory_norm = nn.LayerNorm(memory_size)
        self.memory_projection = nn.Sequential(
            nn.Linear(memory_size, bottleneck, bias=False),
            nn.SiLU(),
            nn.Linear(bottleneck, hidden_size, bias=False),
        )
        self.gate = nn.Sequential(
            nn.Linear(hidden_size * 2, hidden_size),
            nn.SiLU(),
            nn.Linear(hidden_size, 1),
            nn.Sigmoid(),
        )

    def forward(
        self,
        hidden_states: torch.Tensor,
        memory_vectors: torch.Tensor,
    ) -> tuple[torch.Tensor, torch.Tensor]:
        if hidden_states.shape[:-1] != memory_vectors.shape[:-1]:
            raise ValueError("hidden and memory sequence shapes must match")
        hidden = self.hidden_norm(hidden_states.float())
        memory = self.memory_projection(self.memory_norm(memory_vectors.float()))
        gate = self.gate(torch.cat([hidden, memory], dim=-1))
        return memory * gate, gate
