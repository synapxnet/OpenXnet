#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
ContextCompactor 上下文压缩器 — 三重压缩策略防止长对话 Token 溢出。

三重压缩策略:
1. ToolResultTrimmer  — 截断过长的工具返回体
2. SnipCompactor      — 基于 Token 预算从旧消息开始修剪
3. SummaryCompactor   — (可选) 使用 LLM 生成摘要替代被删除的消息

参考 CC-Source 的 snipCompact + snipProjection 设计。

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
import copy
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from .token_counter import (
    count_tokens,
    estimate_message_tokens,
    estimate_messages_tokens,
    get_model_context_window,
)


@dataclass
class CompactionResult:
    """压缩结果"""
    messages: List[dict]           # 压缩后的消息列表
    original_tokens: int           # 原始 token 数
    compacted_tokens: int          # 压缩后 token 数
    removed_messages: int          # 移除的消息数
    trimmed_tool_results: int      # 截断的工具返回数
    summary_injected: bool = False # 是否注入了摘要


# ─── 策略 1: 工具返回体截断 ───────────────────────────────────

def trim_tool_results(
    messages: List[dict],
    max_result_chars: int = 8000,
    placeholder: str = "\n\n... [内容过长，已截断，仅保留前 {kept} 字符] ..."
) -> tuple[List[dict], int]:
    """
    截断过长的工具返回体。
    工具返回内容超过 max_result_chars 时，保留前 N 字符 + 截断提示。
    
    Returns: (处理后的消息列表, 被截断的工具数)
    """
    trimmed_count = 0
    result = []
    
    for msg in messages:
        role = msg.get("role", "")
        content = msg.get("content", "")
        
        if role == "tool" and isinstance(content, str) and len(content) > max_result_chars:
            new_msg = msg.copy()
            kept = max_result_chars
            new_msg["content"] = content[:kept] + placeholder.format(kept=kept)
            result.append(new_msg)
            trimmed_count += 1
        elif role == "assistant" and not msg.get("tool_calls"):
            # 非工具调用的 assistant 消息，如果内容过长也截断
            if isinstance(content, str) and len(content) > max_result_chars * 2:
                new_msg = msg.copy()
                kept = max_result_chars * 2
                new_msg["content"] = content[:kept] + placeholder.format(kept=kept)
                result.append(new_msg)
                trimmed_count += 1
            else:
                result.append(msg)
        else:
            result.append(msg)
    
    return result, trimmed_count


# ─── 策略 2: Token 预算修剪 (SnipCompact) ─────────────────────

def _is_tool_chain_start(msg: dict) -> bool:
    """检查消息是否是工具调用链的开始（带 tool_calls 的 assistant）"""
    return msg.get("role") == "assistant" and bool(msg.get("tool_calls"))


def _recent_turn_start(messages: List[dict], keep_turns: int = 2) -> int:
    """Return the index of the first message in the protected recent user turns."""
    seen_users = 0
    for idx in range(len(messages) - 1, -1, -1):
        if messages[idx].get("role") == "user":
            seen_users += 1
            if seen_users >= keep_turns:
                return idx
    return max(0, len(messages) - 4)


def _expand_tool_chain_boundary(messages: List[dict], start_idx: int) -> int:
    """
    Move a protected slice boundary left if it starts inside assistant/tool_call results.
    This prevents producing an OpenAI-invalid sequence that begins with orphan tool messages.
    """
    idx = max(0, min(start_idx, len(messages)))
    while idx > 0 and messages[idx].get("role") == "tool":
        idx -= 1
    if idx < start_idx and _is_tool_chain_start(messages[idx]):
        return idx
    return start_idx


def _pop_oldest_turn(messages: List[dict]) -> int:
    """Remove the oldest removable turn/tool chain as one unit."""
    if not messages:
        return 0
    removed = 0
    first = messages.pop(0)
    removed += 1

    if first.get("role") == "user":
        while messages and messages[0].get("role") != "user":
            messages.pop(0)
            removed += 1
        return removed

    if _is_tool_chain_start(first):
        while messages and messages[0].get("role") == "tool":
            messages.pop(0)
            removed += 1
        return removed

    return removed


def _drop_orphan_tool_messages(messages: List[dict]) -> tuple[List[dict], int]:
    """Drop tool messages that no longer have a directly preceding assistant tool_call chain."""
    result: List[dict] = []
    removed = 0
    pending_tool_ids = set()

    for msg in messages:
        role = msg.get("role")
        if role == "assistant":
            result.append(msg)
            pending_tool_ids = set()
            for call in msg.get("tool_calls") or []:
                if isinstance(call, dict) and call.get("id"):
                    pending_tool_ids.add(call.get("id"))
            continue

        if role == "tool":
            tool_id = msg.get("tool_call_id")
            if pending_tool_ids and tool_id in pending_tool_ids:
                result.append(msg)
                pending_tool_ids.discard(tool_id)
            else:
                removed += 1
            continue

        result.append(msg)
        pending_tool_ids = set()

    return result, removed


def _find_safe_cut_boundary(messages: List[dict], target_idx: int) -> int:
    """
    从 target_idx 开始向前寻找安全的切断点。
    安全切断点 = user 消息的开头（不能把工具调用链切断）。
    """
    idx = target_idx
    while idx > 0:
        msg = messages[idx]
        role = msg.get("role", "")
        
        # 不能以 tool 消息开始（需要前面的 assistant tool_calls）
        if role == "tool":
            idx -= 1
            continue
        
        # 不能以 assistant 开始
        if role == "assistant":
            idx -= 1
            continue
        
        # user 消息是安全边界
        if role == "user":
            break
        
        idx -= 1
    
    return max(0, idx)


def snip_compact(
    messages: List[dict],
    max_tokens: int,
    reserve_for_output: int = 4096,
) -> tuple[List[dict], int]:
    """
    基于 Token 预算的消息修剪。
    从最旧的非系统消息开始移除，直到总 token 数 <= max_tokens - reserve_for_output。
    
    保护规则:
    - system 消息永远保留
    - 最近 2 轮对话永远保留
    - 工具调用链不会被切断（assistant + tool 一起处理）
    
    Returns: (压缩后的消息列表, 移除的消息数)
    """
    budget = max_tokens - reserve_for_output
    
    current_tokens = estimate_messages_tokens(messages)
    if current_tokens <= budget:
        return messages, 0
    
    # 分离 system 和 chat 消息
    system_msgs = []
    chat_msgs = []
    
    for msg in messages:
        if msg.get("role") == "system":
            system_msgs.append(msg)
        else:
            chat_msgs.append(msg)
    
    if len(chat_msgs) <= 4:
        # 对话太短，不压缩
        return messages, 0
    
    # 保护最近 2 个 user turn，并确保边界不会切进 tool 调用链。
    protected_start = _recent_turn_start(chat_msgs, keep_turns=2)
    protected_start = _expand_tool_chain_boundary(chat_msgs, protected_start)
    protected_msgs = chat_msgs[protected_start:]
    removable_msgs = chat_msgs[:protected_start]
    
    system_tokens = estimate_messages_tokens(system_msgs) if system_msgs else 0
    protected_tokens = estimate_messages_tokens(protected_msgs)
    
    # 从最旧的消息开始移除
    removed = 0
    while removable_msgs and (system_tokens + estimate_messages_tokens(removable_msgs) + protected_tokens) > budget:
        # 按 turn / tool chain 移除，避免留下半截旧上下文。
        removed += _pop_oldest_turn(removable_msgs)
    
    # 重新组装
    result = system_msgs + removable_msgs + protected_msgs
    result, orphan_removed = _drop_orphan_tool_messages(result)
    removed += orphan_removed
    return result, removed


# ─── 主入口: ContextCompactor ──────────────────────────────────

class ContextCompactor:
    """
    上下文压缩器主类。
    
    使用方式:
        compactor = ContextCompactor(model_id="gpt-4o")
        result = compactor.compact(messages)
        # result.messages 可直接发送给 LLM
    """
    
    def __init__(
        self,
        model_id: str = "",
        max_context_tokens: int = 0,
        max_tool_result_chars: int = 8000,
        reserve_for_output: int = 4096,
    ):
        """
        Args:
            model_id: 模型 ID，用于自动查找上下文窗口大小
            max_context_tokens: 手动指定 Token 上限（0 = 自动推断）
            max_tool_result_chars: 工具返回体最大字符数
            reserve_for_output: 为模型输出预留的 token 数
        """
        if max_context_tokens > 0:
            self.max_tokens = max_context_tokens
        elif model_id:
            self.max_tokens = get_model_context_window(model_id)
        else:
            self.max_tokens = 32768
        
        self.max_tool_result_chars = max_tool_result_chars
        self.reserve_for_output = reserve_for_output
    
    def compact(self, messages: List[dict]) -> CompactionResult:
        """
        执行压缩。
        
        流程:
        1. 估算原始 token 数
        2. 截断过长的工具返回体
        3. 如果仍超出预算，从旧消息开始修剪
        
        Returns: CompactionResult
        """
        if not messages:
            return CompactionResult(
                messages=messages,
                original_tokens=0,
                compacted_tokens=0,
                removed_messages=0,
                trimmed_tool_results=0,
            )
        
        # 深拷贝避免修改原始数据
        working = [m.copy() for m in messages]
        
        original_tokens = estimate_messages_tokens(working)
        
        # Step 1: 截断工具返回体
        working, trimmed_count = trim_tool_results(
            working, max_result_chars=self.max_tool_result_chars
        )
        
        # Step 2: Token 预算修剪
        working, removed_count = snip_compact(
            working,
            max_tokens=self.max_tokens,
            reserve_for_output=self.reserve_for_output,
        )
        
        compacted_tokens = estimate_messages_tokens(working)
        
        return CompactionResult(
            messages=working,
            original_tokens=original_tokens,
            compacted_tokens=compacted_tokens,
            removed_messages=removed_count,
            trimmed_tool_results=trimmed_count,
        )

    def fit(self, messages: List[dict], max_tokens: int = 0) -> List[dict]:
        """
        便捷接口 — 直接返回压缩后的消息列表。
        QueryEngine v2 使用此接口。

        Args:
            messages: 原始消息列表
            max_tokens: 可选的临时 Token 上限 (0 = 使用初始化时的默认值)

        Returns:
            压缩后的消息列表
        """
        if max_tokens > 0:
            old_max = self.max_tokens
            self.max_tokens = max_tokens
            result = self.compact(messages)
            self.max_tokens = old_max
        else:
            result = self.compact(messages)
        return result.messages
