#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
Learning Cortex — 输出与学习皮层。

闭环学习控制器，将执行反馈注入记忆和技能进化：
- 执行结果→Hebbian 记忆强化
- 成功模式→技能库固化
- 失败模式→恢复记忆注入
- 周期性整合（睡眠周期）

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
from typing import Any, Dict, List, Optional

logger = logging.getLogger("app")


class LearningEvent:
    """A learning event extracted from execution feedback."""

    def __init__(
        self,
        event_type: str,
        content: str,
        *,
        source: str = "",
        success: bool = True,
        tools_used: List[str] = None,
        strategy_used: str = "",
        importance: float = 0.5,
    ):
        self.event_type = event_type
        self.content = content
        self.source = source
        self.success = success
        self.tools_used = tools_used or []
        self.strategy_used = strategy_used
        self.importance = importance
        self.timestamp = datetime.now().isoformat()

    def to_dict(self) -> dict:
        return {
            "event_type": self.event_type,
            "content": self.content,
            "source": self.source,
            "success": self.success,
            "tools_used": self.tools_used,
            "strategy_used": self.strategy_used,
            "importance": self.importance,
            "timestamp": self.timestamp,
        }


class LearningCortex:
    """Closed-loop learning controller."""

    def __init__(self):
        self._events: List[Dict[str, Any]] = []
        self._stats = {
            "total_feedback": 0,
            "skills_created": 0,
            "memories_reinforced": 0,
            "patterns_detected": 0,
            "consolidations": 0,
        }

    async def process_feedback(
        self,
        *,
        input_text: str = "",
        perception: Dict[str, Any] = None,
        reasoning: Dict[str, Any] = None,
        execution: Dict[str, Any] = None,
        workspace_dir: str = "",
    ) -> List[LearningEvent]:
        """Process a complete turn's feedback and extract learning events."""
        self._stats["total_feedback"] += 1
        events = []
        exec_data = execution or {}
        success_count = exec_data.get("successful", 0)
        fail_count = exec_data.get("failed", 0)
        strategy = (reasoning or {}).get("plan", {}).get("strategy", "direct")
        tools = (reasoning or {}).get("plan", {}).get("tools_needed", [])

        if success_count > 0:
            success_importance = 0.72 if strategy != "direct" and success_count >= 2 else 0.6
            events.append(LearningEvent(
                "execution_success",
                f"Strategy '{strategy}' succeeded with {success_count} tool(s)",
                source="execution_cortex",
                success=True,
                tools_used=tools,
                strategy_used=strategy,
                importance=success_importance,
            ))

        if fail_count > 0:
            errors = exec_data.get("errors", [])
            for err in errors[:3]:
                events.append(LearningEvent(
                    "execution_failure",
                    f"Tool '{err.get('tool', '')}' failed: {err.get('error', '')}",
                    source="execution_cortex",
                    success=False,
                    tools_used=[err.get("tool", "")],
                    strategy_used=strategy,
                    importance=0.8,
                ))

        if workspace_dir:
            await self._reinforce_memory(events, workspace_dir)
            await self._maybe_create_skill(events, reasoning, workspace_dir, input_text=input_text)

        for event in events:
            self._events.append(event.to_dict())
        if len(self._events) > 500:
            self._events = self._events[-250:]

        return events

    async def _reinforce_memory(self, events: List[LearningEvent], workspace_dir: str) -> None:
        try:
            from py.memory.hebbian import get_hebbian_store
            store = get_hebbian_store(workspace_dir)
            for event in events:
                store.add(
                    event.content,
                    memory_type="procedural" if event.success else "episodic",
                )
                self._stats["memories_reinforced"] += 1
        except Exception:
            pass

    async def _maybe_create_skill(
        self,
        events: List[LearningEvent],
        reasoning: Dict[str, Any] = None,
        workspace_dir: str = "",
        input_text: str = "",
    ) -> None:
        successful = [e for e in events if e.success and e.strategy_used != "direct"]
        if not successful:
            return
        try:
            from py.kernel.skill_lifecycle import get_skill_lifecycle
            lifecycle = get_skill_lifecycle(workspace_dir)
            for event in successful:
                if event.importance >= 0.7:
                    result = await lifecycle.on_task_completed(
                        {
                            "success": True,
                            "summary": event.content[:240],
                            "strategy": event.strategy_used,
                            "trigger_context": "\n".join([
                                f"Task resembles a successful '{event.strategy_used}' workflow.",
                                input_text.strip()[:260],
                            ]).strip(),
                            "source_event_ids": [event.timestamp],
                        },
                        event.tools_used,
                        input_text=input_text,
                        source_event_ids=[event.timestamp],
                        source="work",
                    )
                    if result.get("created"):
                        self._stats["skills_created"] += 1
        except Exception:
            pass

    async def consolidate(self, workspace_dir: str) -> Dict[str, Any]:
        """Run periodic consolidation (sleep cycle)."""
        self._stats["consolidations"] += 1
        results = {}
        try:
            from py.memory.hebbian import get_hebbian_store
            store = get_hebbian_store(workspace_dir)
            results["hebbian"] = store.sleep_consolidation()
        except Exception as exc:
            results["hebbian_error"] = str(exc)
        try:
            from py.memory.context_compressor import get_context_compressor
            compressor = get_context_compressor(workspace_dir)
            removed = compressor.deduplicate_atoms()
            results["atoms_deduped"] = removed
        except Exception as exc:
            results["compressor_error"] = str(exc)
        return results

    async def handle_signal(self, signal) -> Optional[Dict[str, Any]]:
        data = signal.data
        events = await self.process_feedback(
            input_text=data.get("input", ""),
            perception=data.get("perception"),
            reasoning=data.get("reasoning"),
            execution=data.get("execution"),
            workspace_dir=data.get("context", {}).get("workspace_dir", ""),
        )
        return {
            "learning_events": [e.to_dict() for e in events],
            "stats": self._stats,
        }

    def get_diagnostics(self) -> Dict[str, Any]:
        return {
            "stats": self._stats,
            "event_count": len(self._events),
            "recent_events": self._events[-5:],
        }


_cortex: Optional[LearningCortex] = None


def get_learning_cortex() -> LearningCortex:
    global _cortex
    if _cortex is None:
        _cortex = LearningCortex()
    return _cortex
