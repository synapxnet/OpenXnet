#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
Token 计数器 — tiktoken 封装，支持模型上下文窗口自动推断。

使用 tiktoken (GPT 系列) 作为默认计数器。
对于非 OpenAI 模型，采用 cl100k_base 估算（误差 <10%）。

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

import json
from typing import List, Dict, Any, Optional

# 惰性导入 tiktoken，打包后可能不可用时回退到字符估算
_encoder = None

def _get_encoder():
    global _encoder
    if _encoder is not None:
        return _encoder
    try:
        import tiktoken
        _encoder = tiktoken.get_encoding("cl100k_base")
    except Exception:
        _encoder = None
    return _encoder


def count_tokens(text: str) -> int:
    """
    计算文本的 token 数。
    优先使用 tiktoken，不可用时回退到字符估算（中文~2 token/字，英文~0.25 token/word）。
    """
    if not text:
        return 0
    enc = _get_encoder()
    if enc is not None:
        try:
            return len(enc.encode(text))
        except Exception:
            pass
    # 回退: 粗略估算 (~4 字符 = 1 token)
    return max(1, len(text) // 3)


def estimate_message_tokens(message: dict) -> int:
    """
    估算单条消息的 token 数（含 role 标记开销）。
    参考 OpenAI 的 token 计算规则：每条消息约 4 token 额外开销。
    """
    tokens = 4  # role + framing overhead
    
    content = message.get("content", "")
    if isinstance(content, str):
        tokens += count_tokens(content)
    elif isinstance(content, list):
        # multimodal content: text + image_url etc.
        for part in content:
            if isinstance(part, dict):
                if part.get("type") == "text":
                    tokens += count_tokens(part.get("text", ""))
                elif part.get("type") == "image_url":
                    tokens += 85  # 低分辨率图片约 85 token
    
    # tool_calls (function name + args)
    tool_calls = message.get("tool_calls")
    if tool_calls:
        for tc in tool_calls:
            if isinstance(tc, dict):
                func = tc.get("function", {})
                tokens += count_tokens(func.get("name", ""))
                tokens += count_tokens(func.get("arguments", ""))
            else:
                func = getattr(tc, "function", None)
                if func:
                    tokens += count_tokens(getattr(func, "name", ""))
                    tokens += count_tokens(getattr(func, "arguments", ""))
    
    # tool response content
    if message.get("role") == "tool":
        tokens += count_tokens(message.get("content", ""))
    
    # reasoning_content
    rc = message.get("reasoning_content", "")
    if rc:
        tokens += count_tokens(rc)
    
    return tokens


def estimate_messages_tokens(messages: List[dict]) -> int:
    """估算消息列表的总 token 数"""
    total = 3  # assistant reply priming
    for msg in messages:
        total += estimate_message_tokens(msg)
    return total


# 常见模型的上下文窗口大小 (输入上限)
MODEL_CONTEXT_WINDOWS = {
    # OpenAI
    "gpt-4o": 128000,
    "gpt-4o-mini": 128000,
    "gpt-4-turbo": 128000,
    "gpt-4": 8192,
    "gpt-3.5-turbo": 16385,
    "o1": 200000,
    "o1-mini": 128000,
    "o3": 200000,
    "o3-mini": 128000,
    "o4-mini": 200000,
    # Anthropic
    "claude-3-5-sonnet": 200000,
    "claude-3-opus": 200000,
    "claude-3-haiku": 200000,
    "claude-4-sonnet": 200000,
    # DeepSeek
    "deepseek-chat": 64000,
    "deepseek-r1": 64000,
    "deepseek-v3": 64000,
    # Qwen
    "qwen-max": 32768,
    "qwen-plus": 131072,
    "qwen-turbo": 131072,
    "qwen3-235b": 131072,
    # Other
    "gemini-2.5-pro": 1000000,
    "gemini-2.5-flash": 1000000,
    "llama-3.1-405b": 128000,
    "llama-3.1-70b": 128000,
}

DEFAULT_CONTEXT_WINDOW = 32768  # 默认假设 32k


def get_model_context_window(model_id: str) -> int:
    """
    根据模型 ID 返回上下文窗口大小。
    尝试模糊匹配（模型名包含关键词）。
    """
    if not model_id:
        return DEFAULT_CONTEXT_WINDOW
    
    model_lower = model_id.lower()
    
    # 精确匹配
    if model_lower in MODEL_CONTEXT_WINDOWS:
        return MODEL_CONTEXT_WINDOWS[model_lower]
    
    # 模糊匹配
    for key, window in MODEL_CONTEXT_WINDOWS.items():
        if key in model_lower or model_lower in key:
            return window
    
    return DEFAULT_CONTEXT_WINDOW
