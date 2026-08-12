#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""Conversation token lifecycle helpers."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Dict, List

try:
    from py.context.token_counter import estimate_messages_tokens, get_model_context_window
except Exception:  # pragma: no cover - fallback for partial imports
    estimate_messages_tokens = None
    get_model_context_window = None


@dataclass
class ConversationState:
    model: str
    message_count: int
    estimated_tokens: int
    context_window: int
    usage_ratio: float
    phase: str
    should_pre_summarize: bool
    should_compact: bool
    should_block_growth: bool

    def to_dict(self) -> Dict:
        return asdict(self)


def build_conversation_state(messages: List[Dict], model: str = "") -> ConversationState:
    context_window = 32768
    if get_model_context_window:
        try:
            context_window = int(get_model_context_window(model))
        except Exception:
            context_window = 32768

    estimated = 0
    if estimate_messages_tokens:
        try:
            estimated = int(estimate_messages_tokens(messages or []))
        except Exception:
            estimated = 0

    ratio = (estimated / context_window) if context_window else 0.0
    phase = "normal"
    if ratio >= 0.95:
        phase = "blocked"
    elif ratio >= 0.80:
        phase = "compact"
    elif ratio >= 0.60:
        phase = "pre_summarize"

    return ConversationState(
        model=model or "",
        message_count=len(messages or []),
        estimated_tokens=estimated,
        context_window=context_window,
        usage_ratio=round(ratio, 4),
        phase=phase,
        should_pre_summarize=ratio >= 0.60,
        should_compact=ratio >= 0.80,
        should_block_growth=ratio >= 0.95,
    )
