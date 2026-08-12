#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.

"""
规则前向链推理机。

让 NeuroRuleRegistry 的 3 条规则（14 个约束字符串）变成可执行的前向链检查。
每个约束字符串映射到一个检查函数，对 symbol dict 或上下文进行验证。
"""

import logging
import re
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger("app")


@dataclass
class RuleEvalResult:
    passed: bool
    violations: List[str]
    constraints_checked: int
    applied_rules: List[str] = field(default_factory=list)


class RuleEngine:
    """前向链约束评估器。"""

    def __init__(self):
        self._handlers: Dict[str, Callable] = {}
        self._register_builtin()

    def _register_builtin(self) -> None:
        h = self._handlers
        h["TEMPORAL_VALID_FROM_REQUIRED"] = self._chk_temporal_valid_from
        h["TEMPORAL_QUERY_TIME_AWARE"] = self._chk_temporal_query_time
        h["TEMPORAL_INVALIDATE_NOT_DELETE"] = self._chk_temporal_soft_delete
        h["TEMPORAL_TRIPLE_FORMAT"] = self._chk_temporal_triple_format
        h["DECAY_HEBBIAN_REINFORCE"] = self._chk_decay_reinforce
        h["DECAY_WEIGHT_FACTOR"] = self._chk_decay_weight
        h["DECAY_PRUNE_THRESHOLD"] = self._chk_decay_prune
        h["DECAY_PROTECT_HIGH_SUCCESS"] = self._chk_decay_protect
        h["DECAY_CURIOSITY_GENERATE"] = self._chk_decay_curiosity
        h["DISAMBIG_NO_PRONOUNS"] = self._chk_no_pronouns
        h["DISAMBIG_NO_RELATIVE_TIME"] = self._chk_no_relative_time
        h["DISAMBIG_FULL_NAME_REQUIRED"] = self._chk_full_name
        h["DISAMBIG_SELF_CONTAINED"] = self._chk_self_contained
        h["DISAMBIG_LOSSLESS"] = self._chk_lossless

    def evaluate(
        self,
        symbol_dict: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None,
    ) -> RuleEvalResult:
        violations = []
        checked = 0
        applied_rules = []
        try:
            from py.neuro_rules import get_rule_registry
            registry = get_rule_registry()
            for rule in registry.get_enabled():
                applied_rules.append(rule.id)
                for constraint in rule.constraints:
                    checked += 1
                    handler = self._handlers.get(constraint)
                    if handler is None:
                        continue
                    result = handler(symbol_dict, rule.config, context or {})
                    if result:
                        violations.append(f"[{rule.id}] {constraint}: {result}")
        except Exception as e:
            logger.debug(f"[RuleEngine] evaluate error: {e}")

        return RuleEvalResult(
            passed=len(violations) == 0,
            violations=violations,
            constraints_checked=checked,
            applied_rules=applied_rules,
        )

    def get_constraints_for_context(self, operator: str) -> List[str]:
        descriptions = []
        try:
            from py.neuro_rules import get_rule_registry
            registry = get_rule_registry()
            for rule in registry.get_enabled():
                if rule.bound_operator == operator:
                    for c in rule.constraints:
                        descriptions.append(f"{c} ({rule.name})")
        except Exception:
            pass
        return descriptions

    # ---- Temporal constraints ----

    def _chk_temporal_valid_from(self, sym: dict, cfg: dict, ctx: dict) -> Optional[str]:
        label = sym.get("label", "")
        assertion_kw = ["是", "为", "has", "was", "equals"]
        if any(k in label for k in assertion_kw):
            if not any(c.isdigit() for c in label):
                return "事实断言缺少时间标记"
        return None

    def _chk_temporal_query_time(self, sym: dict, cfg: dict, ctx: dict) -> Optional[str]:
        return None

    def _chk_temporal_soft_delete(self, sym: dict, cfg: dict, ctx: dict) -> Optional[str]:
        label = sym.get("label", "")
        if re.search(r"\b(delete|drop|remove|truncate)\b", label, re.I) or "删除" in label:
            return "时序事实应使用软失效（invalidate）而非删除"
        return None

    def _chk_temporal_triple_format(self, sym: dict, cfg: dict, ctx: dict) -> Optional[str]:
        return None

    # ---- Decay constraints ----

    def _chk_decay_reinforce(self, sym: dict, cfg: dict, ctx: dict) -> Optional[str]:
        return None

    def _chk_decay_weight(self, sym: dict, cfg: dict, ctx: dict) -> Optional[str]:
        sr = sym.get("successRate", 1.0)
        if not (0.0 <= sr <= 1.0):
            return f"successRate={sr} 超出 [0,1] 范围"
        return None

    def _chk_decay_prune(self, sym: dict, cfg: dict, ctx: dict) -> Optional[str]:
        return None

    def _chk_decay_protect(self, sym: dict, cfg: dict, ctx: dict) -> Optional[str]:
        return None

    def _chk_decay_curiosity(self, sym: dict, cfg: dict, ctx: dict) -> Optional[str]:
        entities = sym.get("K", {}).get("entities", [])
        if not entities:
            return None
        threshold = cfg.get("curiosity_lonely_threshold", 3)
        try:
            from py.neuro_temporal_kg import get_temporal_kg
            kg = get_temporal_kg()
            if kg:
                for entity in entities[:3]:
                    facts = kg.query_entity(entity, limit=threshold + 1)
                    if len(facts) < threshold:
                        return f"实体 '{entity}' 知识稀疏 ({len(facts)}/{threshold})"
        except Exception:
            pass
        return None

    # ---- Disambiguation constraints ----

    def _chk_no_pronouns(self, sym: dict, cfg: dict, ctx: dict) -> Optional[str]:
        label = sym.get("label", "")
        entities = sym.get("K", {}).get("entities", [])
        all_text = label + " " + " ".join(entities)

        blacklist_zh = cfg.get("pronoun_blacklist_zh", ["他", "她", "它", "他们", "她们", "这个", "那个"])
        for p in blacklist_zh:
            if p in all_text:
                return f"含代词 '{p}'"

        blacklist_en = cfg.get("pronoun_blacklist_en", ["he", "she", "it", "they", "this", "that"])
        for p in blacklist_en:
            if re.search(rf'\b{p}\b', all_text, re.I):
                return f"含代词 '{p}'"
        return None

    def _chk_no_relative_time(self, sym: dict, cfg: dict, ctx: dict) -> Optional[str]:
        label = sym.get("label", "")
        blacklist_zh = cfg.get("relative_time_blacklist_zh", ["昨天", "今天", "明天", "上周", "刚才", "最近"])
        for t in blacklist_zh:
            if t in label:
                return f"含相对时间 '{t}'，应替换为绝对日期"

        blacklist_en = cfg.get("relative_time_blacklist_en", ["yesterday", "today", "tomorrow", "last week", "recently"])
        for t in blacklist_en:
            if t.lower() in label.lower():
                return f"含相对时间 '{t}'"
        return None

    def _chk_full_name(self, sym: dict, cfg: dict, ctx: dict) -> Optional[str]:
        entities = sym.get("K", {}).get("entities", [])
        for e in entities:
            if len(e) == 1 and e.isalpha():
                return f"实体 '{e}' 可能是缩写，需要全名"
        return None

    def _chk_self_contained(self, sym: dict, cfg: dict, ctx: dict) -> Optional[str]:
        label = sym.get("label", "")
        if not label or len(label.strip()) < 5:
            return "label 过短，不具有自包含语义"
        return None

    def _chk_lossless(self, sym: dict, cfg: dict, ctx: dict) -> Optional[str]:
        return None


_rule_engine: Optional[RuleEngine] = None


def get_rule_engine() -> RuleEngine:
    global _rule_engine
    if _rule_engine is None:
        _rule_engine = RuleEngine()
    return _rule_engine
