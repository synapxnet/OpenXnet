#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
Cognitive Cortex — 认知皮层。

Chain of Thought 状态机、意图分析、推理策略选择。
将感知结果转化为可执行的计划。

Author: Claude Code
Department: R&D
Date: 2026-04-19
Version: 1.0.0
Security Level: INTERNAL
"""

__version__ = "1.0.0"
__author__ = "Claude Code"
__copyright__ = "Copyright 2026 Synapxnet"

import logging
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

logger = logging.getLogger("app")


class ThoughtState(str, Enum):
    IDLE = "idle"
    ANALYZING = "analyzing"
    PLANNING = "planning"
    DECOMPOSING = "decomposing"
    DELEGATING = "delegating"
    WAITING = "waiting"
    SYNTHESIZING = "synthesizing"


class ReasoningStrategy(str, Enum):
    DIRECT = "direct"
    CHAIN_OF_THOUGHT = "chain_of_thought"
    DECOMPOSE = "decompose"
    RETRIEVE_THEN_REASON = "retrieve_then_reason"
    MULTI_AGENT = "multi_agent"


class ExecutionPlan:
    """A structured plan produced by the cognitive cortex."""

    def __init__(
        self,
        strategy: str = "direct",
        steps: List[Dict[str, Any]] = None,
        tools_needed: List[str] = None,
        memory_query: str = "",
        estimated_complexity: str = "low",
        requires_review: bool = False,
    ):
        self.strategy = strategy
        self.steps = steps or []
        self.tools_needed = tools_needed or []
        self.memory_query = memory_query
        self.estimated_complexity = estimated_complexity
        self.requires_review = requires_review
        self.created_at = datetime.now().isoformat()

    def to_dict(self) -> dict:
        return {
            "strategy": self.strategy,
            "steps": self.steps,
            "tools_needed": self.tools_needed,
            "memory_query": self.memory_query,
            "estimated_complexity": self.estimated_complexity,
            "requires_review": self.requires_review,
            "step_count": len(self.steps),
            "created_at": self.created_at,
        }


class CognitiveCortex:
    """Chain of Thought state machine and reasoning strategy selector."""

    def __init__(self):
        self._thought_state = ThoughtState.IDLE
        self._thought_history: List[Dict[str, Any]] = []
        self._strategy_stats: Dict[str, int] = {}

    @property
    def thought_state(self) -> ThoughtState:
        return self._thought_state

    def reason(self, perception: Dict[str, Any], context: Dict[str, Any] = None) -> ExecutionPlan:
        self._thought_state = ThoughtState.ANALYZING
        ctx = context or {}
        intent = perception.get("intent", "conversation")
        has_code = perception.get("has_code", False)
        has_command = perception.get("has_command", False)
        urgency = perception.get("urgency", "normal")
        keywords = perception.get("keywords", [])

        strategy = self._select_strategy(intent, has_code, has_command, urgency)
        self._strategy_stats[strategy] = self._strategy_stats.get(strategy, 0) + 1
        self._thought_state = ThoughtState.PLANNING

        plan = ExecutionPlan(strategy=strategy)

        if strategy == ReasoningStrategy.DIRECT:
            plan.estimated_complexity = "low"
        elif strategy == ReasoningStrategy.CHAIN_OF_THOUGHT:
            plan.estimated_complexity = "medium"
            plan.steps = [
                {"action": "analyze", "description": "Break down the problem"},
                {"action": "reason", "description": "Think through each aspect"},
                {"action": "respond", "description": "Synthesize the answer"},
            ]
        elif strategy == ReasoningStrategy.DECOMPOSE:
            plan.estimated_complexity = "high"
            plan.requires_review = True
            plan.steps = [
                {"action": "decompose", "description": "Split into subtasks"},
                {"action": "execute_parallel", "description": "Run subtasks"},
                {"action": "merge", "description": "Combine results"},
            ]
        elif strategy == ReasoningStrategy.RETRIEVE_THEN_REASON:
            plan.estimated_complexity = "medium"
            plan.memory_query = " ".join(keywords[:5])
            plan.steps = [
                {"action": "retrieve", "description": "Search memory and knowledge"},
                {"action": "reason", "description": "Reason with context"},
                {"action": "respond", "description": "Generate response"},
            ]
        elif strategy == ReasoningStrategy.MULTI_AGENT:
            plan.estimated_complexity = "high"
            plan.requires_review = True

        if has_command:
            plan.tools_needed = self._infer_tools(keywords, perception)

        self._thought_history.append({
            "intent": intent,
            "strategy": strategy,
            "complexity": plan.estimated_complexity,
            "timestamp": datetime.now().isoformat(),
        })
        if len(self._thought_history) > 100:
            self._thought_history = self._thought_history[-50:]

        self._thought_state = ThoughtState.IDLE
        return plan

    async def handle_signal(self, signal) -> Optional[Dict[str, Any]]:
        data = signal.data
        perception = data.get("perception", {})
        context = data.get("context", {})
        plan = self.reason(perception, context)
        return {"plan": plan.to_dict(), "thought_state": self._thought_state.value}

    def _select_strategy(
        self, intent: str, has_code: bool, has_command: bool, urgency: str
    ) -> str:
        if intent == "code_task" and has_command:
            return ReasoningStrategy.DECOMPOSE
        if intent == "action_request" and has_command:
            return ReasoningStrategy.CHAIN_OF_THOUGHT
        if intent == "information_query":
            return ReasoningStrategy.RETRIEVE_THEN_REASON
        if has_code:
            return ReasoningStrategy.CHAIN_OF_THOUGHT
        return ReasoningStrategy.DIRECT

    def _infer_tools(self, keywords: List[str], perception: Dict[str, Any]) -> List[str]:
        tools = []
        code_signals = {"file", "code", "edit", "write", "create", "modify", "代码", "文件", "编辑"}
        shell_signals = {"run", "execute", "install", "build", "test", "运行", "执行", "安装"}
        web_signals = {"search", "browse", "url", "http", "搜索", "浏览"}
        memory_signals = {"remember", "recall", "history", "记忆", "回忆", "历史"}

        kw_set = set(k.lower() for k in keywords)
        if kw_set & code_signals:
            tools.append("file_operations")
        if kw_set & shell_signals:
            tools.append("shell_execute")
        if kw_set & web_signals:
            tools.append("web_search")
        if kw_set & memory_signals:
            tools.append("memory_recall")
        if perception.get("context_refs"):
            tools.append("file_operations")
        return tools

    def get_diagnostics(self) -> Dict[str, Any]:
        return {
            "thought_state": self._thought_state.value,
            "strategy_stats": self._strategy_stats,
            "history_count": len(self._thought_history),
            "recent_thoughts": self._thought_history[-5:],
        }


_cortex: Optional[CognitiveCortex] = None


def get_cognitive_cortex() -> CognitiveCortex:
    global _cortex
    if _cortex is None:
        _cortex = CognitiveCortex()
    return _cortex
