#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.

"""
皮层接线桥 — 将 5 个皮层模块注册到 CognitiveOrchestrator。

当前这些模块完整实现但从未被 server.py 调用。
CortexBridge 做一次性注册，并暴露快速感知接口供融合循环使用。
"""

import logging
from typing import Any, Dict, Optional

logger = logging.getLogger("app")


class CortexBridge:
    """连接皮层模块到编排器，暴露快速感知接口。"""

    def __init__(self):
        self._registered = False

    def ensure_registered(self) -> None:
        if self._registered:
            return
        try:
            from py.cortex.orchestrator import get_orchestrator, CortexType
            from py.cortex.perceptual import get_perceptual_cortex
            from py.cortex.cognitive import get_cognitive_cortex
            from py.cortex.execution import get_execution_cortex
            from py.cortex.learning import get_learning_cortex

            orch = get_orchestrator()
            orch.register_cortex(
                CortexType.PERCEPTUAL,
                get_perceptual_cortex().handle_signal,
                name="perceptual_v1",
                priority=1,
            )
            orch.register_cortex(
                CortexType.COGNITIVE,
                get_cognitive_cortex().handle_signal,
                name="cognitive_v1",
                priority=2,
            )
            orch.register_cortex(
                CortexType.EXECUTION,
                get_execution_cortex().handle_signal,
                name="execution_v1",
                priority=3,
            )
            orch.register_cortex(
                CortexType.LEARNING,
                get_learning_cortex().handle_signal,
                name="learning_v1",
                priority=5,
            )
            self._registered = True
            logger.info("[CortexBridge] All cortex modules registered with orchestrator")
        except Exception as e:
            logger.warning(f"[CortexBridge] Registration failed: {e}")

    async def run_perception(self, text: str, metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        try:
            from py.cortex.perceptual import get_perceptual_cortex
            cortex = get_perceptual_cortex()
            result = cortex.perceive(text, metadata)
            return result.to_dict()
        except Exception:
            return {
                "intent": "conversation",
                "entities": [],
                "keywords": [],
                "language": "unknown",
                "sentiment": "neutral",
                "has_question": False,
                "has_command": False,
                "has_code": False,
            }

    def is_registered(self) -> bool:
        return self._registered

    def get_diagnostics(self) -> Dict[str, Any]:
        diag = {"registered": self._registered}
        try:
            from py.cortex.orchestrator import get_orchestrator
            orch = get_orchestrator()
            diag["orchestrator_state"] = orch.state.value
            diag["orchestrator_context"] = orch.context
            diag["registered_cortices"] = list(orch._cortex_handlers.keys())
        except Exception:
            pass
        return diag
