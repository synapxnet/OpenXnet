#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.

"""
KernelFacade — server.py 调用内核的唯一入口。

封装 FusionLoop 及其依赖（算子、向量索引、规则引擎、皮层桥），
提供 pre_neural() 和 post_neural() 两个核心接口。
"""

import asyncio
import logging
from typing import Any, Dict, List, Optional

from py.kernel.operators import get_operator_dispatcher
from py.kernel.vector_index import VectorIndex
from py.kernel.rule_engine import get_rule_engine
from py.kernel.cortex_bridge import CortexBridge
from py.kernel.fusion import FusionLoop, PreNeuralResult, PostNeuralResult

logger = logging.getLogger("app")


class KernelFacade:
    """神经符号 OS 内核入口。"""

    def __init__(self):
        self._operators = get_operator_dispatcher()
        self._vector_index = VectorIndex()
        self._rule_engine = get_rule_engine()
        self._cortex_bridge = CortexBridge()
        self._fusion = FusionLoop(
            operators=self._operators,
            vector_index=self._vector_index,
            rule_engine=self._rule_engine,
            cortex_bridge=self._cortex_bridge,
        )

    def init_cortex(self) -> None:
        self._cortex_bridge.ensure_registered()

    async def build_vector_index(self, symbols: list) -> int:
        return await self._vector_index.build_from_store(symbols)

    async def pre_neural(
        self,
        user_text: str,
        messages: List[Dict],
        settings: Dict[str, Any],
        symbol_store: Any,
    ) -> PreNeuralResult:
        workspace_dir = settings.get("CLISettings", {}).get("cc_path", "")
        return await self._fusion.pre_neural(
            user_text=user_text,
            symbol_store=symbol_store,
            workspace_dir=workspace_dir,
            settings=settings,
        )

    async def post_neural(
        self,
        user_text: str,
        assistant_output: str,
        tools_used: List[str],
        success: bool,
        settings: Dict[str, Any],
        symbol_store: Any,
        fast_client: Any = None,
        is_sub_agent: bool = False,
    ) -> PostNeuralResult:
        if is_sub_agent:
            return PostNeuralResult()
        workspace_dir = settings.get("CLISettings", {}).get("cc_path", "")
        return await self._fusion.post_neural(
            user_text=user_text,
            assistant_output=assistant_output,
            tools_used=tools_used,
            success=success,
            symbol_store=symbol_store,
            workspace_dir=workspace_dir,
            settings=settings,
            fast_client=fast_client,
        )

    def get_diagnostics(self) -> Dict[str, Any]:
        return {
            "vector_index": self._vector_index.get_stats(),
            "cortex": self._cortex_bridge.get_diagnostics(),
        }


_kernel: Optional[KernelFacade] = None


def get_kernel() -> KernelFacade:
    global _kernel
    if _kernel is None:
        _kernel = KernelFacade()
    return _kernel
