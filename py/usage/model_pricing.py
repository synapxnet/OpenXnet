#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
Model Pricing — LLM 模型计费配置表与成本计算。

Author: maoyo
Department: 研发部
Date: 2026-04-13
Version: 1.0.0
Security Level: INTERNAL
"""

__version__ = "1.0.0"
__author__ = "maoyo"
__copyright__ = "Copyright 2026 Synapxnet"
__maintainer__ = "maoyo"
__email__ = "synapxnet@gmail.com"

"""
OpenXnet — Model Pricing Table (py/usage/model_pricing.py)
============================================================

v0.5.3: Default per-token pricing for popular LLM models.
Used by TokenMeter to calculate cost_usd from token counts.

Pricing is in USD per 1M tokens. Sources: official provider pricing pages.
Users can override via settings.
"""

from typing import Dict, Optional, Tuple
import logging
import re

logger = logging.getLogger("model_pricing")

# ============================================================================
# Default Pricing Table (USD per 1M tokens)
# Format: model_pattern -> (input_price, output_price, cache_read_price, cache_write_price)
# ============================================================================

DEFAULT_PRICING: Dict[str, Tuple[float, float, float, float]] = {
    # ---- OpenAI ----
    "gpt-4o":                    (2.50,  10.00,  1.25,  2.50),
    "gpt-4o-mini":               (0.15,   0.60,  0.075, 0.15),
    "gpt-4-turbo":               (10.00, 30.00,  5.00,  10.00),
    "gpt-4":                     (30.00, 60.00,  15.00, 30.00),
    "gpt-3.5-turbo":             (0.50,   1.50,  0.25,  0.50),
    "o1":                        (15.00, 60.00,  7.50,  15.00),
    "o1-mini":                   (3.00,  12.00,  1.50,  3.00),
    "o1-pro":                    (150.00, 600.00, 75.00, 150.00),
    "o3":                        (10.00, 40.00,  2.50,  10.00),
    "o3-mini":                   (1.10,   4.40,  0.55,  1.10),
    "o4-mini":                   (1.10,   4.40,  0.275, 1.10),

    # ---- Anthropic ----
    "claude-3-5-sonnet":         (3.00,  15.00,  0.30,  3.75),
    "claude-3-5-haiku":          (0.80,   4.00,  0.08,  1.00),
    "claude-3-opus":             (15.00, 75.00,  1.50,  18.75),
    "claude-3-haiku":            (0.25,   1.25,  0.03,  0.30),
    "claude-sonnet-4":           (3.00,  15.00,  0.30,  3.75),
    "claude-4-opus":             (15.00, 75.00,  1.50,  18.75),

    # ---- Google ----
    "gemini-2.5-pro":            (1.25,  10.00,  0.315,  4.50),
    "gemini-2.5-flash":          (0.15,   0.60,  0.0375, 0.15),
    "gemini-2.0-flash":          (0.10,   0.40,  0.025,  0.10),
    "gemini-1.5-pro":            (1.25,   5.00,  0.315,  1.25),
    "gemini-1.5-flash":          (0.075,  0.30,  0.01875,0.075),

    # ---- DeepSeek ----
    "deepseek-chat":             (0.27,   1.10,  0.07,  0.27),
    "deepseek-reasoner":         (0.55,   2.19,  0.14,  0.55),
    "deepseek-v3":               (0.27,   1.10,  0.07,  0.27),

    # ---- Qwen ----
    "qwen-max":                  (2.40,   9.60,  0.60,  2.40),
    "qwen-plus":                 (0.80,   2.00,  0.20,  0.80),
    "qwen-turbo":                (0.30,   0.60,  0.075, 0.30),
    "qwen3-235b":                (4.00,  16.00,  1.00,  4.00),
    "qwen3-30b":                 (0.80,   2.00,  0.20,  0.80),

    # ---- Meta / Open ----
    "llama-3.1-405b":            (3.00,   3.00,  1.50,  3.00),
    "llama-3.1-70b":             (0.80,   0.80,  0.40,  0.80),
    "llama-3.1-8b":              (0.10,   0.10,  0.05,  0.10),

    # ---- Fallback ----
    "_default":                  (1.00,   2.00,  0.50,  1.00),
}


def get_model_pricing(model: str) -> Tuple[float, float, float, float]:
    """
    Get pricing for a model. Tries exact match first, then prefix match.
    Returns (input_per_1M, output_per_1M, cache_read_per_1M, cache_write_per_1M)
    """
    model_lower = model.lower().strip()

    # Exact match
    if model_lower in DEFAULT_PRICING:
        return DEFAULT_PRICING[model_lower]

    # Prefix match (e.g., "claude-3-5-sonnet-20241022" -> "claude-3-5-sonnet")
    for key in sorted(DEFAULT_PRICING.keys(), key=len, reverse=True):
        if key.startswith("_"):
            continue
        if model_lower.startswith(key):
            return DEFAULT_PRICING[key]

    # Contains match (e.g., "accounts/fireworks/models/llama-3.1-70b" -> "llama-3.1-70b")
    for key in sorted(DEFAULT_PRICING.keys(), key=len, reverse=True):
        if key.startswith("_"):
            continue
        if key in model_lower:
            return DEFAULT_PRICING[key]

    logger.debug(f"[Pricing] No pricing found for model: {model}, using default")
    return DEFAULT_PRICING["_default"]


def calculate_cost(
    model: str,
    input_tokens: int = 0,
    output_tokens: int = 0,
    cache_read_tokens: int = 0,
    cache_creation_tokens: int = 0,
) -> float:
    """
    Calculate cost in USD for given token counts.
    """
    inp_price, out_price, cache_read_price, cache_write_price = get_model_pricing(model)

    cost = (
        (input_tokens * inp_price / 1_000_000)
        + (output_tokens * out_price / 1_000_000)
        + (cache_read_tokens * cache_read_price / 1_000_000)
        + (cache_creation_tokens * cache_write_price / 1_000_000)
    )
    return round(cost, 8)
