#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.

"""
神经符号融合循环。

Pre-Neural：感知 → 推断算子 → 向量/关键词检索 → 分发算子 → 规则约束 → 格式化注入
Neural：LLM 推理（由外部处理）
Post-Neural：LLM 提取 → 结晶 → 规则验证 → 存储 → 向量更新 → Hebbian 强化 → 进化
"""

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from py.kernel.operators import OperatorDispatcher, OperatorResult, get_operator_dispatcher
from py.kernel.vector_index import VectorIndex
from py.kernel.rule_engine import RuleEngine, get_rule_engine
from py.kernel.cortex_bridge import CortexBridge

logger = logging.getLogger("app")


@dataclass
class PreNeuralResult:
    context_injection: str = ""
    matched_symbols: list = field(default_factory=list)
    matched_runes: list = field(default_factory=list)
    operator_results: Dict[str, Any] = field(default_factory=dict)
    perception: Dict[str, Any] = field(default_factory=dict)
    elapsed_ms: float = 0.0


@dataclass
class PostNeuralResult:
    crystallized_symbol_id: str = ""
    rule_violations: List[str] = field(default_factory=list)
    evolution_result: Optional[Dict] = None
    elapsed_ms: float = 0.0


class FusionLoop:
    """组装 Pre-Neural 和 Post-Neural 的完整融合循环。"""

    def __init__(
        self,
        operators: OperatorDispatcher,
        vector_index: VectorIndex,
        rule_engine: RuleEngine,
        cortex_bridge: CortexBridge,
    ):
        self._operators = operators
        self._vector = vector_index
        self._rules = rule_engine
        self._cortex = cortex_bridge

    async def pre_neural(
        self,
        user_text: str,
        symbol_store: Any,
        workspace_dir: str,
        settings: Dict[str, Any],
    ) -> PreNeuralResult:
        """
        Pre-Neural 阶段。预算 <200ms。

        1. 感知（regex, <5ms）
        2. 推断算子（<1ms）
        3. 向量/关键词符号检索（20-50ms / <5ms）
        4. 分发算子（<150ms timeout）
        5. 符文检索（<5ms）
        6. 规则约束查询（<1ms）
        7. 格式化注入字符串
        """
        start = time.monotonic()

        # Step 1: Perceive
        perception = await self._cortex.run_perception(user_text)
        entities = perception.get("entities", [])

        # Step 2: Infer operator
        try:
            from py.neuro_bridge_api import FactExtractor
            operator = FactExtractor.infer_operator(user_text)
        except Exception:
            operator = "ToolChainExec"

        # Step 3: Symbol search — vector or keyword fallback
        matched_symbols = []
        if not self._vector._ready and symbol_store:
            try:
                symbols = symbol_store.all() if hasattr(symbol_store, "all") else []
                self._vector.schedule_build_from_store(symbols)
            except Exception:
                pass
        if self._vector._ready and symbol_store:
            try:
                vec_results = await self._vector.search(user_text, top_k=5)
                for sym_id, score in vec_results:
                    sym = symbol_store.get(sym_id)
                    if sym:
                        matched_symbols.append({"symbol": sym, "score": score, "matchType": "vector"})
            except Exception:
                pass

        if not matched_symbols and symbol_store:
            try:
                matched_symbols = symbol_store.match(text=user_text, entities=entities, top_k=5)
            except Exception:
                pass

        # Step 4: Dispatch operator (with timeout)
        op_result = OperatorResult(operator=operator)
        if workspace_dir:
            try:
                op_result = await asyncio.wait_for(
                    self._operators.dispatch(operator, user_text, entities, workspace_dir),
                    timeout=0.15,
                )
            except asyncio.TimeoutError:
                logger.debug(f"[FusionLoop] Operator {operator} timed out")
            except Exception:
                pass

        # Step 5: Rune recall
        matched_runes = []
        if workspace_dir:
            try:
                from py.cortex.neuro_rune import get_rune_engine
                engine = get_rune_engine(workspace_dir)
                matched_runes = engine.recall(user_text, top_k=3)
            except Exception:
                pass

        # Step 6: Rule constraints for this operator
        constraint_lines = []
        try:
            descriptions = self._rules.get_constraints_for_context(operator)
            for desc in descriptions[:5]:
                constraint_lines.append(f"[constraint] {desc}")
        except Exception:
            pass

        # Step 7: Format injection
        sections = []

        if matched_symbols and symbol_store:
            try:
                sym_ctx = symbol_store.format_for_context(matched_symbols)
                if sym_ctx:
                    sections.append(sym_ctx)
            except Exception:
                pass

        if op_result.context_fragment:
            sections.append(f"[Operator: {operator}]\n{op_result.context_fragment}")

        if matched_runes:
            rune_lines = []
            for r in matched_runes:
                rune_lines.append(f"[rune|{r.strength:.2f}] {r.content}")
            sections.append("[NeuroRune Memory]\n" + "\n".join(rune_lines))

        if constraint_lines:
            sections.append("[Active Constraints]\n" + "\n".join(constraint_lines))

        context_injection = "\n\n".join(sections) if sections else ""
        elapsed = round((time.monotonic() - start) * 1000, 1)

        logger.info(
            f"[FusionLoop] Pre-Neural: op={operator}, "
            f"symbols={len(matched_symbols)}, runes={len(matched_runes)}, "
            f"{elapsed:.0f}ms"
        )

        return PreNeuralResult(
            context_injection=context_injection,
            matched_symbols=matched_symbols,
            matched_runes=matched_runes,
            operator_results=op_result.data,
            perception=perception,
            elapsed_ms=elapsed,
        )

    async def post_neural(
        self,
        user_text: str,
        assistant_output: str,
        tools_used: List[str],
        success: bool,
        symbol_store: Any,
        workspace_dir: str,
        settings: Dict[str, Any],
        fast_client: Any = None,
    ) -> PostNeuralResult:
        """
        Post-Neural 阶段。可作为 fire-and-forget task。

        1. LLM 或 regex 事实提取
        2. 结晶为 NeuroSymbol
        3. 规则验证
        4. 存储符号
        5. 更新向量索引
        6. Hebbian 强化
        7. 触发进化
        """
        start = time.monotonic()

        if not assistant_output or not symbol_store:
            return PostNeuralResult()

        from py.neuro_bridge_api import (
            SymbolCrystallizer, LLMFactExtractor, VALID_OPERATORS,
        )

        # Step 1: Extract facts
        user_text_short = user_text[:200] if user_text else ""
        label = user_text_short[:80]
        llm_facts = None

        if fast_client:
            try:
                fast_model = settings.get("fast", {}).get("model", "") or "gpt-4o-mini"
                all_text = f"{user_text} {assistant_output[:2000]}"
                llm_facts = await LLMFactExtractor.extract_with_llm(
                    all_text, fast_client, model=fast_model,
                )
                if llm_facts and llm_facts.get("source") == "llm":
                    label = llm_facts.get("label", label) or label
            except Exception:
                pass

        # Step 2: Crystallize
        new_sym = SymbolCrystallizer.crystallize(
            label=label,
            user_input=user_text,
            assistant_output=assistant_output[:2000],
            tools_used=tools_used or [],
            success=success,
        )

        if llm_facts and llm_facts.get("source") == "llm":
            new_sym.K.entities = llm_facts.get("entities", new_sym.K.entities)
            new_sym.K.relations = llm_facts.get("relations", new_sym.K.relations)
            op = llm_facts.get("operator", "")
            if op in VALID_OPERATORS:
                new_sym.operator = op

        # Step 3: Rule validation
        rule_result = self._rules.evaluate(new_sym.to_dict())
        if rule_result.violations:
            logger.debug(f"[FusionLoop] Rule violations: {rule_result.violations[:3]}")

        # Step 4: Store symbol
        try:
            symbol_store.store(new_sym)
        except Exception as e:
            logger.warning(f"[FusionLoop] Symbol store failed: {e}")

        # Step 5: Vector index update
        try:
            embed_text = f"{new_sym.label} {' '.join(new_sym.K.entities)}"
            await self._vector.add_item(new_sym.id, embed_text)
        except Exception:
            pass

        # Step 6: Hebbian reinforcement
        if workspace_dir:
            try:
                from py.memory.hebbian import get_hebbian_store
                store = get_hebbian_store(workspace_dir)
                store.add(
                    f"{new_sym.operator}: {new_sym.label}",
                    memory_type="procedural",
                    entities=new_sym.K.entities[:5],
                )
            except Exception:
                pass

        # Step 7: Evolution
        evolution_result = None
        if workspace_dir:
            try:
                from py.cortex.evolution import get_evolution_controller
                evo = get_evolution_controller(workspace_dir)
                evolution_result = await evo.on_interaction(user_text, success=success)
            except Exception:
                pass

        elapsed = round((time.monotonic() - start) * 1000, 1)
        src = (llm_facts.get("source", "regex") if llm_facts else "regex")
        logger.info(
            f"[FusionLoop] Post-Neural: sym={new_sym.id} op={new_sym.operator} "
            f"src={src} violations={len(rule_result.violations)} {elapsed:.0f}ms"
        )

        return PostNeuralResult(
            crystallized_symbol_id=new_sym.id,
            rule_violations=rule_result.violations,
            evolution_result=evolution_result,
            elapsed_ms=elapsed,
        )
