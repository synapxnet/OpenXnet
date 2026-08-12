#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
Cognitive Orchestrator — 全局意识工作区。

OpenXnet 大脑的中央编排器，连接所有皮层，实现：
- 皮层间信息路由与广播
- 全局会话状态管理
- 动态执行策略选择
- 感知→认知→执行→记忆→学习 闭环协调

基于 Baars 的全局工作空间理论（Global Workspace Theory）。

Author: Claude Code
Department: R&D
Date: 2026-04-19
Version: 1.0.0
Security Level: INTERNAL
"""

__version__ = "1.0.0"
__author__ = "Claude Code"
__copyright__ = "Copyright 2026 Synapxnet"

import asyncio
import logging
import time
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Coroutine, Dict, List, Optional

logger = logging.getLogger("app")


class CortexType(str, Enum):
    PERCEPTUAL = "perceptual"
    EMOTIONAL = "emotional"
    COGNITIVE = "cognitive"
    EXECUTION = "execution"
    MEMORY = "memory"
    LEARNING = "learning"


class SessionState(str, Enum):
    IDLE = "idle"
    PERCEIVING = "perceiving"
    REASONING = "reasoning"
    EXECUTING = "executing"
    REFLECTING = "reflecting"
    LEARNING = "learning"


class CortexSignal:
    """A signal broadcast between cortex modules."""

    def __init__(
        self,
        source: str,
        signal_type: str,
        data: Dict[str, Any],
        *,
        priority: int = 5,
        requires_response: bool = False,
    ):
        self.source = source
        self.signal_type = signal_type
        self.data = data
        self.priority = priority
        self.requires_response = requires_response
        self.timestamp = datetime.now().isoformat()
        self.responses: List[Dict[str, Any]] = []

    def to_dict(self) -> dict:
        return {
            "source": self.source,
            "signal_type": self.signal_type,
            "data": self.data,
            "priority": self.priority,
            "timestamp": self.timestamp,
            "response_count": len(self.responses),
        }


CortexHandler = Callable[[CortexSignal], Coroutine[Any, Any, Optional[Dict[str, Any]]]]


class CognitiveOrchestrator:
    """全局意识工作区 — 中央编排器。"""

    def __init__(self):
        self._cortex_handlers: Dict[str, List[Dict[str, Any]]] = {}
        self._state = SessionState.IDLE
        self._context: Dict[str, Any] = {
            "turn_count": 0,
            "last_input": "",
            "last_intent": "",
            "active_tools": [],
            "emotional_state": "neutral",
            "memory_hits": 0,
            "execution_count": 0,
            "error_count": 0,
            "started_at": datetime.now().isoformat(),
        }
        self._signal_log: List[Dict[str, Any]] = []
        self._state_transitions: List[Dict[str, Any]] = []

    @property
    def state(self) -> SessionState:
        return self._state

    @property
    def context(self) -> Dict[str, Any]:
        return dict(self._context)

    def register_cortex(
        self,
        cortex_type: str,
        handler: CortexHandler,
        *,
        name: str = "",
        priority: int = 5,
    ) -> None:
        if cortex_type not in self._cortex_handlers:
            self._cortex_handlers[cortex_type] = []
        self._cortex_handlers[cortex_type].append({
            "handler": handler,
            "name": name or cortex_type,
            "priority": priority,
        })
        self._cortex_handlers[cortex_type].sort(key=lambda x: x["priority"])

    def transition(self, new_state: SessionState, reason: str = "") -> None:
        old_state = self._state
        self._state = new_state
        self._state_transitions.append({
            "from": old_state.value,
            "to": new_state.value,
            "reason": reason,
            "timestamp": datetime.now().isoformat(),
        })
        if len(self._state_transitions) > 100:
            self._state_transitions = self._state_transitions[-50:]

    async def broadcast(self, signal: CortexSignal) -> List[Dict[str, Any]]:
        """Broadcast a signal to all registered cortex handlers."""
        self._signal_log.append(signal.to_dict())
        if len(self._signal_log) > 200:
            self._signal_log = self._signal_log[-100:]

        responses = []
        for cortex_type, handlers in self._cortex_handlers.items():
            for entry in handlers:
                try:
                    result = await asyncio.wait_for(
                        entry["handler"](signal), timeout=8.0
                    )
                    if result:
                        result["_cortex"] = cortex_type
                        result["_handler"] = entry["name"]
                        responses.append(result)
                except asyncio.TimeoutError:
                    responses.append({
                        "_cortex": cortex_type,
                        "_handler": entry["name"],
                        "error": "timeout",
                    })
                except Exception as exc:
                    responses.append({
                        "_cortex": cortex_type,
                        "_handler": entry["name"],
                        "error": str(exc),
                    })
        signal.responses = responses
        return responses

    async def route(self, signal: CortexSignal, target: str) -> Optional[Dict[str, Any]]:
        """Route a signal to a specific cortex type."""
        handlers = self._cortex_handlers.get(target, [])
        if not handlers:
            return None
        entry = handlers[0]
        try:
            return await asyncio.wait_for(entry["handler"](signal), timeout=8.0)
        except Exception as exc:
            return {"error": str(exc), "_cortex": target}

    async def orchestrate_turn(
        self,
        user_input: str,
        *,
        metadata: Dict[str, Any] = None,
    ) -> Dict[str, Any]:
        """Orchestrate a complete cognitive turn through all cortex layers."""
        start = time.monotonic()
        meta = metadata or {}
        self._context["turn_count"] += 1
        self._context["last_input"] = user_input[:200]
        turn_result = {
            "turn": self._context["turn_count"],
            "phases": [],
            "state_path": [],
        }

        # Phase 1: Perceive
        self.transition(SessionState.PERCEIVING, "new_input")
        turn_result["state_path"].append("perceiving")
        perception = await self.route(
            CortexSignal("orchestrator", "perceive", {
                "input": user_input, "metadata": meta,
            }),
            CortexType.PERCEPTUAL,
        )
        turn_result["phases"].append({
            "phase": "perceive",
            "result": perception or {},
        })

        # Phase 2: Reason
        self.transition(SessionState.REASONING, "perception_complete")
        turn_result["state_path"].append("reasoning")
        intent = ""
        if perception:
            intent = perception.get("intent", "")
            self._context["last_intent"] = intent
        reasoning = await self.route(
            CortexSignal("orchestrator", "reason", {
                "input": user_input,
                "perception": perception or {},
                "intent": intent,
                "context": self._context,
            }),
            CortexType.COGNITIVE,
        )
        turn_result["phases"].append({
            "phase": "reason",
            "result": reasoning or {},
        })

        # Phase 3: Execute
        self.transition(SessionState.EXECUTING, "plan_ready")
        turn_result["state_path"].append("executing")
        execution_plan = (reasoning or {}).get("plan", {})
        execution = await self.route(
            CortexSignal("orchestrator", "execute", {
                "plan": execution_plan,
                "reasoning": reasoning or {},
                "context": self._context,
            }),
            CortexType.EXECUTION,
        )
        turn_result["phases"].append({
            "phase": "execute",
            "result": execution or {},
        })
        self._context["execution_count"] += 1

        # Phase 4: Reflect & Learn
        self.transition(SessionState.REFLECTING, "execution_complete")
        turn_result["state_path"].append("reflecting")
        learning_signal = CortexSignal("orchestrator", "learn", {
            "input": user_input,
            "perception": perception or {},
            "reasoning": reasoning or {},
            "execution": execution or {},
            "context": self._context,
        })
        await self.broadcast(learning_signal)

        # Phase 5: Return to idle
        self.transition(SessionState.IDLE, "turn_complete")
        turn_result["state_path"].append("idle")
        turn_result["elapsed_ms"] = round((time.monotonic() - start) * 1000, 1)

        return turn_result

    def update_context(self, key: str, value: Any) -> None:
        self._context[key] = value

    def get_diagnostics(self) -> Dict[str, Any]:
        return {
            "state": self._state.value,
            "context": self._context,
            "registered_cortices": {
                k: [e["name"] for e in v]
                for k, v in self._cortex_handlers.items()
            },
            "signal_count": len(self._signal_log),
            "transition_count": len(self._state_transitions),
            "recent_signals": self._signal_log[-5:],
            "recent_transitions": self._state_transitions[-5:],
        }


_orchestrator: Optional[CognitiveOrchestrator] = None


def get_orchestrator() -> CognitiveOrchestrator:
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = CognitiveOrchestrator()
    return _orchestrator
