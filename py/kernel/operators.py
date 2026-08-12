#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.

"""
认知算子执行引擎 — 14 个算子从字符串标签变成可执行 async 函数。

每个算子查询真实数据源（KG、符号库、符文引擎、Hebbian 记忆、
观察库、技能库、突触注册表），返回结构化的上下文片段供 LLM 使用。
"""

import logging
import time
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Dict, List, Optional

logger = logging.getLogger("app")


@dataclass
class OperatorResult:
    operator: str
    context_fragment: str = ""
    data: Dict[str, Any] = field(default_factory=dict)
    elapsed_ms: float = 0.0


class OperatorDispatcher:
    """路由算子名到可执行 async 函数。"""

    def __init__(self):
        self._handlers: Dict[str, Callable[..., Awaitable[OperatorResult]]] = {
            "SemanticRecall": self._op_semantic_recall,
            "TemporalReason": self._op_temporal_reason,
            "CausalInfer": self._op_causal_infer,
            "EntityResolve": self._op_entity_resolve,
            "PatternMatch": self._op_pattern_match,
            "ToolChainExec": self._op_tool_chain_exec,
            "PlanDecompose": self._op_plan_decompose,
            "ConsolidateKnowledge": self._op_consolidate_knowledge,
            "ApplyLogicRules": self._op_apply_logic_rules,
            "SkillCrystallize": self._op_skill_crystallize,
            "ValidateOutput": self._op_validate_output,
            "MetaCognize": self._op_meta_cognize,
            "EmotionalTag": self._op_emotional_tag,
            "DelegateToAgent": self._op_delegate_to_agent,
        }

    async def dispatch(
        self,
        operator: str,
        user_text: str,
        entities: List[str],
        workspace_dir: str,
    ) -> OperatorResult:
        start = time.monotonic()
        handler = self._handlers.get(operator, self._op_tool_chain_exec)
        try:
            result = await handler(user_text, entities, workspace_dir)
        except Exception as e:
            result = OperatorResult(operator=operator, data={"error": str(e)})
        result.elapsed_ms = round((time.monotonic() - start) * 1000, 1)
        return result

    # ================================================================
    # 纯符号算子
    # ================================================================

    async def _op_semantic_recall(
        self, user_text: str, entities: List[str], workspace_dir: str,
    ) -> OperatorResult:
        """查询 Hebbian 记忆 + 观察库 + 符文引擎。"""
        fragments: List[str] = []

        try:
            from py.memory.hebbian import get_hebbian_store
            store = get_hebbian_store(workspace_dir)
            entries = store.recall(user_text, top_k=3)
            for e in entries:
                fragments.append(f"[hebbian|{e.activation:.2f}] {e.content}")
        except Exception:
            pass

        try:
            from py.memory.observation_store import get_observation_store
            obs = await get_observation_store(workspace_dir)
            results = await obs.search_fts(user_text, limit=3)
            for r in results:
                summary = r.get("summary", r.get("title", ""))
                if summary:
                    fragments.append(f"[observation] {summary[:120]}")
        except Exception:
            pass

        try:
            from py.cortex.neuro_rune import get_rune_engine
            engine = get_rune_engine(workspace_dir)
            runes = engine.recall(user_text, top_k=3)
            for r in runes:
                fragments.append(f"[rune|{r.strength:.2f}] {r.content}")
        except Exception:
            pass

        return OperatorResult(
            operator="SemanticRecall",
            context_fragment="\n".join(fragments),
            data={"recall_count": len(fragments)},
        )

    async def _op_temporal_reason(
        self, user_text: str, entities: List[str], workspace_dir: str,
    ) -> OperatorResult:
        """查询时序 KG，返回实体的当前有效事实和过期事实。"""
        fragments: List[str] = []

        try:
            from py.neuro_temporal_kg import get_temporal_kg
            kg = get_temporal_kg()
            if kg is None:
                return OperatorResult(operator="TemporalReason")

            for entity in entities[:5]:
                facts = kg.query_entity(entity, direction="both", limit=8)
                for f in facts:
                    status = "current" if f.get("current") else "expired"
                    line = f"[kg:{status}] {f['subject']} {f['predicate']} {f['object']}"
                    if f.get("valid_from"):
                        line += f" (since {f['valid_from']})"
                    if not f.get("current") and f.get("valid_to"):
                        line += f" (until {f['valid_to']})"
                    fragments.append(line)
        except Exception:
            pass

        return OperatorResult(
            operator="TemporalReason",
            context_fragment="\n".join(fragments),
            data={"fact_count": len(fragments)},
        )

    async def _op_causal_infer(
        self, user_text: str, entities: List[str], workspace_dir: str,
    ) -> OperatorResult:
        """在 KG 中遍历因果谓词链（caused_by, leads_to, depends_on, triggers）。"""
        fragments: List[str] = []
        causal_predicates = {
            "caused_by", "leads_to", "depends_on", "triggers",
            "导致", "依赖", "触发", "因为", "results_in",
        }

        try:
            from py.neuro_temporal_kg import get_temporal_kg
            kg = get_temporal_kg()
            if kg is None:
                return OperatorResult(operator="CausalInfer")

            for entity in entities[:5]:
                triples = kg.query_entity(entity, direction="both", limit=20)
                for t in triples:
                    pred = t.get("predicate", "")
                    if pred in causal_predicates:
                        direction = "→" if t.get("direction") == "outgoing" else "←"
                        other = t.get("object") if t.get("direction") == "outgoing" else t.get("subject")
                        conf = t.get("confidence", 1.0)
                        fragments.append(
                            f"[causal] {entity} {direction} {pred} {direction} {other} (conf={conf:.1f})"
                        )

                        if other and other != entity:
                            second = kg.query_entity(other, direction="outgoing", limit=5)
                            for t2 in second:
                                if t2.get("predicate") in causal_predicates:
                                    fragments.append(
                                        f"[causal:2nd] {entity} → {other} → {t2.get('object', '?')}"
                                    )
        except Exception:
            pass

        return OperatorResult(
            operator="CausalInfer",
            context_fragment="\n".join(fragments[:10]),
            data={"causal_chains": len(fragments)},
        )

    async def _op_entity_resolve(
        self, user_text: str, entities: List[str], workspace_dir: str,
    ) -> OperatorResult:
        """通过符号库倒排索引和 KG 消解模糊实体。"""
        fragments: List[str] = []

        try:
            from py.neuro_bridge_api import get_symbol_store
            store = get_symbol_store()

            for entity in entities[:5]:
                entity_lower = entity.lower()
                if entity_lower in store.entity_index:
                    sym_ids = list(store.entity_index[entity_lower])[:3]
                    for sid in sym_ids:
                        sym = store.get(sid)
                        if sym:
                            fragments.append(
                                f"[resolve:symbol] '{entity}' → {sym.operator}(\"{sym.label[:60]}\")"
                            )
                else:
                    fragments.append(f"[resolve:unknown] '{entity}' 不在符号库中")
        except Exception:
            pass

        try:
            from py.neuro_temporal_kg import get_temporal_kg
            kg = get_temporal_kg()
            if kg:
                for entity in entities[:5]:
                    triples = kg.query_entity(entity, limit=3)
                    if triples:
                        fragments.append(f"[resolve:kg] '{entity}' 有 {len(triples)} 条关联")
        except Exception:
            pass

        return OperatorResult(
            operator="EntityResolve",
            context_fragment="\n".join(fragments),
            data={"resolved": len([f for f in fragments if "unknown" not in f])},
        )

    async def _op_pattern_match(
        self, user_text: str, entities: List[str], workspace_dir: str,
    ) -> OperatorResult:
        """在观察历史和技能库中检测重复模式。"""
        fragments: List[str] = []

        try:
            from py.memory.observation_store import get_observation_store
            obs = await get_observation_store(workspace_dir)
            results = await obs.search_fts(user_text, limit=3)
            for r in results:
                title = r.get("title", "")
                summary = r.get("summary", "")
                fragments.append(f"[pattern] {title}: {summary[:80]}")
        except Exception:
            pass

        try:
            from py.skill_library import get_skill_library
            lib = get_skill_library(workspace_dir)
            skills = lib.search(user_text, top_k=3)
            for s in skills:
                fragments.append(
                    f"[pattern:skill] {s.name} (成功率:{s.success_rate:.0%}, 使用:{s.use_count}次)"
                )
        except Exception:
            pass

        return OperatorResult(
            operator="PatternMatch",
            context_fragment="\n".join(fragments),
            data={"patterns_found": len(fragments)},
        )

    async def _op_tool_chain_exec(
        self, user_text: str, entities: List[str], workspace_dir: str,
    ) -> OperatorResult:
        """查询突触注册表获取权重排名靠前的工具。"""
        fragments: List[str] = []

        try:
            from py.synapse_registry import get_synapse_registry
            registry = get_synapse_registry()
            ranked = registry.get_ranked_tools()
            for node in ranked[:5]:
                if node.call_count > 0:
                    fragments.append(
                        f"[synapse|w={node.weight:.2f}] {node.name} "
                        f"(成功率:{node.success_rate:.0%}, 调用:{node.call_count})"
                    )
        except Exception:
            pass

        try:
            from py.skill_library import get_skill_library
            lib = get_skill_library(workspace_dir)
            skills = lib.search(user_text, top_k=2)
            for s in skills:
                if s.use_count > 0:
                    fragments.append(f"[skill] {s.name}: {s.description[:60]}")
        except Exception:
            pass

        return OperatorResult(
            operator="ToolChainExec",
            context_fragment="\n".join(fragments),
            data={"tool_count": len(fragments)},
        )

    async def _op_plan_decompose(
        self, user_text: str, entities: List[str], workspace_dir: str,
    ) -> OperatorResult:
        """基于可用工具和历史技能分解任务。"""
        fragments: List[str] = []

        try:
            from py.synapse_registry import get_synapse_registry
            registry = get_synapse_registry()
            ranked = registry.get_ranked_tools()[:10]
            tool_names = [t.name for t in ranked]
            fragments.append(f"[plan:tools] 可用工具 top-10: {tool_names}")
        except Exception:
            pass

        pattern_result = await self._op_pattern_match(user_text, entities, workspace_dir)
        if pattern_result.context_fragment:
            for line in pattern_result.context_fragment.split("\n"):
                if "skill" in line:
                    fragments.append(f"[plan:precedent] {line}")

        return OperatorResult(
            operator="PlanDecompose",
            context_fragment="\n".join(fragments),
            data={"available_tools": len(fragments)},
        )

    async def _op_consolidate_knowledge(
        self, user_text: str, entities: List[str], workspace_dir: str,
    ) -> OperatorResult:
        """检测 Hebbian 记忆和符文中的矛盾。"""
        fragments: List[str] = []

        try:
            from py.memory.hebbian import get_hebbian_store
            store = get_hebbian_store(workspace_dir)
            contradictions = store.detect_contradictions()
            for c in contradictions[:3]:
                a_content = c.get("entry_a", {}).get("content", "")[:50]
                b_content = c.get("entry_b", {}).get("content", "")[:50]
                signal = c.get("signal", "")
                fragments.append(f"[contradiction] \"{a_content}\" vs \"{b_content}\" ({signal})")
        except Exception:
            pass

        try:
            from py.cortex.neuro_rune import get_rune_engine
            engine = get_rune_engine(workspace_dir)
            stats = engine.get_lattice_stats()
            if stats.get("contradiction_count", 0) > 0:
                fragments.append(f"[rune:contradictions] 符文网格有 {stats['contradiction_count']} 个矛盾")
        except Exception:
            pass

        return OperatorResult(
            operator="ConsolidateKnowledge",
            context_fragment="\n".join(fragments),
            data={"contradiction_count": len(fragments)},
        )

    async def _op_apply_logic_rules(
        self, user_text: str, entities: List[str], workspace_dir: str,
    ) -> OperatorResult:
        """通过规则引擎执行前向链约束检查。"""
        fragments: List[str] = []

        try:
            from py.kernel.rule_engine import get_rule_engine
            engine = get_rule_engine()
            sym_dict = {"label": user_text, "K": {"entities": entities}}
            result = engine.evaluate(sym_dict)
            for v in result.violations[:5]:
                fragments.append(f"[rule:violation] {v}")
            if result.passed:
                fragments.append(f"[rule:passed] 全部 {result.constraints_checked} 个约束通过")
        except Exception:
            pass

        return OperatorResult(
            operator="ApplyLogicRules",
            context_fragment="\n".join(fragments),
            data={"violations": len(fragments)},
        )

    async def _op_skill_crystallize(
        self, user_text: str, entities: List[str], workspace_dir: str,
    ) -> OperatorResult:
        """报告技能库当前状态。"""
        fragments: List[str] = []

        try:
            from py.skill_library import get_skill_library
            lib = get_skill_library(workspace_dir)
            stats = lib.get_stats()
            fragments.append(
                f"[skill] 技能库: {stats['total']} 总计, {stats['verified']} 已验证, "
                f"平均成功率:{stats['avg_success_rate']:.0%}"
            )
        except Exception:
            pass

        return OperatorResult(
            operator="SkillCrystallize",
            context_fragment="\n".join(fragments),
            data={},
        )

    async def _op_validate_output(
        self, user_text: str, entities: List[str], workspace_dir: str,
    ) -> OperatorResult:
        """用规则注册表验证输出。"""
        fragments: List[str] = []

        try:
            from py.neuro_rules import get_rule_registry
            registry = get_rule_registry()
            violations = registry.validate_symbol({
                "label": user_text,
                "K": {"entities": entities},
            })
            for v in violations:
                fragments.append(f"[validate] {v}")
        except Exception:
            pass

        return OperatorResult(
            operator="ValidateOutput",
            context_fragment="\n".join(fragments),
            data={"violations": len(fragments)},
        )

    async def _op_meta_cognize(
        self, user_text: str, entities: List[str], workspace_dir: str,
    ) -> OperatorResult:
        """元认知：反思符号库/符文网格质量。"""
        issues: List[str] = []

        try:
            from py.neuro_bridge_api import get_symbol_store
            store = get_symbol_store()
            stats = store.get_stats()
            if stats["totalSymbols"] < 5:
                issues.append("[meta] 符号库过小，系统缺乏历史经验")
            if stats["avgSuccessRate"] < 0.6:
                issues.append(f"[meta] 平均成功率低 ({stats['avgSuccessRate']:.0%})")
        except Exception:
            pass

        try:
            from py.cortex.neuro_rune import get_rune_engine
            engine = get_rune_engine(workspace_dir)
            stats = engine.get_lattice_stats()
            if stats.get("contradiction_count", 0) > 0:
                issues.append(f"[meta] 符文网格有 {stats['contradiction_count']} 个矛盾")
            if stats.get("dormant_count", 0) > stats.get("total", 0) * 0.5:
                issues.append(f"[meta] 超过半数符文处于休眠状态")
        except Exception:
            pass

        return OperatorResult(
            operator="MetaCognize",
            context_fragment="\n".join(issues),
            data={"issues": len(issues)},
        )

    async def _op_emotional_tag(
        self, user_text: str, entities: List[str], workspace_dir: str,
    ) -> OperatorResult:
        """关键词情感检测。"""
        positive = ["谢谢", "感谢", "太好了", "完美", "excellent", "great", "perfect", "thanks"]
        negative = ["错误", "失败", "bug", "error", "fail", "问题", "broken", "crash"]
        text_lower = user_text.lower()
        pos = sum(1 for kw in positive if kw in text_lower)
        neg = sum(1 for kw in negative if kw in text_lower)
        sentiment = "positive" if pos > neg else "negative" if neg > pos else "neutral"

        return OperatorResult(
            operator="EmotionalTag",
            context_fragment=f"[emotion] {sentiment}" if sentiment != "neutral" else "",
            data={"sentiment": sentiment, "pos": pos, "neg": neg},
        )

    async def _op_delegate_to_agent(
        self, user_text: str, entities: List[str], workspace_dir: str,
    ) -> OperatorResult:
        """占位：检查是否需要委托给专业 agent。"""
        return OperatorResult(
            operator="DelegateToAgent",
            context_fragment="",
            data={},
        )


_dispatcher: Optional[OperatorDispatcher] = None


def get_operator_dispatcher() -> OperatorDispatcher:
    global _dispatcher
    if _dispatcher is None:
        _dispatcher = OperatorDispatcher()
    return _dispatcher
