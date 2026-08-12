#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
NeuroSymbol 规则注册中心 — 管理认知规则的生命周期、匹配策略和版本追溯。

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

"""
OpenXnet — NeuroSymbol Rule Library (neuro_rules.py)
====================================================

v0.5.1 升级模块：将外部项目的升级能力形式化定义为NeuroSymbol规则。

三个新认知规则被定义为一等公民，融入现有的14算子+SymbolQ规则体系：
  1. TemporalKnowledge  — 时序知识图谱规则（来源：mempalace）
  2. MemoryDecay        — 记忆衰减与赫布强化规则（来源：Turiya SNS²F）
  3. Disambiguation     — 强制消歧义结晶规则（来源：SimpleMem）

每个规则由以下部分组成：
  - RuleDefinition: 规则元数据（ID、名称、描述、版本）
  - RuleSchema:     输入/输出的结构化定义
  - RuleOperator:   绑定到现有的14个认知算子
  - RuleConstraint: 添加到SymbolQ.constraints中的约束条件
  - RulePrompt:     LLM执行时注入的Prompt片段

设计原则：
  - 规则本身就是NeuroSymbol：Rule IS-A NeuroSymbol（规则即符号）
  - 规则通过Q.ruleIds引用链串联，形成可追溯的认知链路
  - 规则可被match()检索，参与脑回路的pre-neural阶段
"""

import time
import hashlib
import logging
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, field, asdict

logger = logging.getLogger("neuro_rules")

# ============================================================================
# Rule Definition Data Model
# ============================================================================

@dataclass
class RuleDefinition:
    """
    一条认知规则的完整定义。
    规则本身也是一个NeuroSymbol（operator=ApplyLogicRules）。
    """
    id: str                          # 规则唯一ID, 格式: "rule-{domain}-{name}-{version}"
    name: str                        # 人可读名称
    version: str                     # 语义版本号
    domain: str                      # 所属域: "temporal" | "decay" | "disambiguation"
    description: str                 # 规则描述
    source_project: str              # 来源项目名（溯源）
    bound_operator: str              # 绑定的认知算子
    constraints: List[str]           # 注入SymbolQ.constraints的约束列表
    prompt_template: str             # LLM Prompt模板（结晶/匹配时使用）
    config: Dict[str, Any] = field(default_factory=dict)  # 可调参配置
    enabled: bool = True             # 启用/禁用开关
    created_at: float = field(default_factory=time.time)

    def to_symbol_dict(self) -> dict:
        """将规则转化为NeuroSymbol字典格式，可直接存入SymbolStore"""
        return {
            "id": self.id,
            "operator": "ApplyLogicRules",  # 规则本身用ApplyLogicRules算子
            "label": f"[Rule] {self.name} v{self.version}",
            "Q": {
                "ruleIds": [self.id],
                "constraints": self.constraints,
            },
            "K": {
                "entities": [self.domain, self.source_project],
                "relations": [f"{self.name}→{self.bound_operator}"],
                "factIds": [],
                "externalRefs": [f"source:{self.source_project}"],
            },
            "z": [
                {"type": "weight", "key": "rule_priority", "value": 1.0, "ref": ""},
                {"type": "weight", "key": "rule_version", "value": float(self.version.replace(".", "")), "ref": ""},
            ],
            "createdAt": self.created_at,
            "successRate": 1.0,
            "activationCount": 0,
            "delegationTarget": "local",
            "parentSymbol": "",
            "childSymbols": [],
        }


# ============================================================================
# Rule 1: Temporal Knowledge — 时序知识图谱规则
# ============================================================================

RULE_TEMPORAL_KNOWLEDGE = RuleDefinition(
    id="rule-temporal-knowledge-v1",
    name="TemporalKnowledge",
    version="1.0",
    domain="temporal",
    description=(
        "将NeuroSymbol的事实存储从平面JSON升级为带时间维度的三元组知识图谱。"
        "每条知识都带有valid_from/valid_to时间窗口，支持时间旅行查询和事实过期标记。"
        "来源：mempalace-main项目的knowledge_graph.py (394行SQLite实现)"
    ),
    source_project="mempalace-main",
    bound_operator="TemporalReason",  # 绑定到已有的TemporalReason算子
    constraints=[
        "TEMPORAL_VALID_FROM_REQUIRED: 每条新事实必须携带valid_from时间戳",
        "TEMPORAL_QUERY_TIME_AWARE: 检索事实时必须考虑时间窗口有效性",
        "TEMPORAL_INVALIDATE_NOT_DELETE: 过期事实标记valid_to而非物理删除",
        "TEMPORAL_TRIPLE_FORMAT: 事实以(主语,谓词,宾语,时间窗口)四元组存储",
    ],
    prompt_template="",  # 此规则不直接影响Prompt，而是改变存储层行为
    config={
        "storage_backend": "sqlite",        # 存储后端
        "db_filename": "knowledge_graph.db", # 数据库文件名
        "enable_wal_mode": True,            # SQLite WAL模式
        "max_triple_count": 100000,         # 最大三元组数量
        "default_confidence": 1.0,          # 默认置信度
        "enable_entity_auto_create": True,  # 自动创建未知实体
    },
)

# ============================================================================
# Rule 2: Memory Decay — 记忆衰减与赫布强化规则
# ============================================================================

RULE_MEMORY_DECAY = RuleDefinition(
    id="rule-decay-hebbian-v1",
    name="MemoryDecay",
    version="1.0",
    domain="decay",
    description=(
        "实现生物启发的记忆生命周期管理：赫布学习权重强化（高频访问=加强）、"
        "睡眠维护周期（定期衰减+清理）、好奇心目标生成（找出知识盲区）。"
        "来源：Turiya-main项目的memory_manager.py (180行MemoryManager实现)"
    ),
    source_project="Turiya-main",
    bound_operator="ConsolidateKnowledge",  # 绑定到ConsolidateKnowledge算子
    constraints=[
        "DECAY_HEBBIAN_REINFORCE: 每次符号被match()命中时，activationCount+1",
        "DECAY_WEIGHT_FACTOR: 衰减因子=0.95，每轮睡眠维护时应用",
        "DECAY_PRUNE_THRESHOLD: activationCount==0且age>7天的符号标记为候选清理",
        "DECAY_PROTECT_HIGH_SUCCESS: successRate>=0.8的符号免受清理",
        "DECAY_CURIOSITY_GENERATE: 知识图谱中连接数<3的实体生成好奇心探索目标",
    ],
    prompt_template="",  # 此规则不直接影响Prompt，而是改变生命周期行为
    config={
        "decay_factor": 0.95,               # 权重衰减因子
        "prune_min_age_days": 7,            # 最小保留天数
        "prune_min_activation": 0,          # 清理阈值（0=从未被访问）
        "protect_success_threshold": 0.8,   # 高成功率保护阈值
        "curiosity_lonely_threshold": 3,    # 好奇心触发的最低连接数
        "sleep_interval_hours": 24,         # 睡眠维护间隔（小时）
        "max_prune_per_cycle": 50,          # 每轮最大清理数量
    },
)

# ============================================================================
# Rule 3: Disambiguation — 强制消歧义结晶规则
# ============================================================================

RULE_DISAMBIGUATION = RuleDefinition(
    id="rule-disambig-force-v1",
    name="Disambiguation",
    version="1.0",
    domain="disambiguation",
    description=(
        "在SymbolCrystallizer结晶化阶段强制要求消歧义：禁止代词、禁止相对时间、"
        "强制全称实体引用。确保每条结晶出的NeuroSymbol都是自包含的、可独立理解的。"
        "来源：SimpleMem-main项目的memory_builder.py (Force Disambiguation Prompt)"
    ),
    source_project="SimpleMem-main",
    bound_operator="EntityResolve",  # 绑定到EntityResolve算子
    constraints=[
        "DISAMBIG_NO_PRONOUNS: 禁止在K.entities/relations中使用代词(他/她/它/they/this/that)",
        "DISAMBIG_NO_RELATIVE_TIME: 禁止使用相对时间(昨天/今天/上周/yesterday/today)",
        "DISAMBIG_FULL_NAME_REQUIRED: 所有实体必须使用完整名称而非缩写或代称",
        "DISAMBIG_SELF_CONTAINED: 每条符号的label必须是完整独立可理解的语句",
        "DISAMBIG_LOSSLESS: 消歧义后的表述不得丢失原始信息",
    ],
    prompt_template="""[NeuroSymbol Crystallization — Disambiguation Rules]
When extracting facts from the conversation, you MUST follow these rules STRICTLY:

1. **Force Disambiguation**: Absolutely PROHIBIT using pronouns (he, she, it, they, this, that, 他, 她, 它, 他们, 这个, 那个) in any extracted entity or relation. Replace ALL pronouns with the actual entity name.

2. **No Relative Time**: PROHIBIT using relative time expressions (yesterday, today, last week, tomorrow, 昨天, 今天, 上周, 明天). Replace with absolute dates (e.g., "2026-04-11") or "unknown_date" if the exact date cannot be determined.

3. **Full Name Required**: Use complete entity names, not abbreviations or nicknames. Example: "OpenXnet Desktop Application" instead of "the app" or "it".

4. **Self-Contained**: Each extracted fact must be a complete, independent, understandable statement. A reader should understand the fact WITHOUT any conversation context.

5. **Lossless Information**: The disambiguated statement must preserve ALL information from the original. Do not simplify or omit details.

Example transformations:
  ❌ "他喜欢这个" → ✅ "Ram喜欢下棋(2026-04-11)"
  ❌ "昨天修好了那个bug" → ✅ "用户于2026-04-10修复了server.py中的BOM编码错误"
  ❌ "它连接到那个服务" → ✅ "OpenXnet Electron前端通过HTTP连接到FastAPI后端服务"
""",
    config={
        "enable_pronoun_check": True,       # 启用代词检查
        "enable_time_check": True,          # 启用时间检查
        "pronoun_blacklist_zh": ["他", "她", "它", "他们", "她们", "这个", "那个", "这些", "那些"],
        "pronoun_blacklist_en": ["he", "she", "it", "they", "this", "that", "these", "those"],
        "relative_time_blacklist_zh": ["昨天", "今天", "明天", "上周", "下周", "上个月", "刚才", "最近"],
        "relative_time_blacklist_en": ["yesterday", "today", "tomorrow", "last week", "next week", "recently", "just now"],
        "max_label_length": 200,            # 消歧义后label最大长度
    },
)

# ============================================================================
# Rule Registry — 规则注册表
# ============================================================================

class NeuroRuleRegistry:
    """
    规则注册表：管理所有已定义的认知规则。
    规则在系统启动时注册到SymbolStore中（作为ApplyLogicRules类型的NeuroSymbol）。
    """

    def __init__(self):
        self.rules: Dict[str, RuleDefinition] = {}
        # 注册内置规则
        self._register_builtin_rules()

    def _register_builtin_rules(self):
        """注册v0.5.1内置规则"""
        for rule in [
            RULE_TEMPORAL_KNOWLEDGE,
            RULE_MEMORY_DECAY,
            RULE_DISAMBIGUATION,
        ]:
            self.rules[rule.id] = rule
            logger.info(f"[NeuroRules] Registered rule: {rule.id} ({rule.name} v{rule.version})")

    def register(self, rule: RuleDefinition) -> None:
        """注册自定义规则"""
        self.rules[rule.id] = rule
        logger.info(f"[NeuroRules] Registered custom rule: {rule.id}")

    def get(self, rule_id: str) -> Optional[RuleDefinition]:
        return self.rules.get(rule_id)

    def get_by_domain(self, domain: str) -> List[RuleDefinition]:
        return [r for r in self.rules.values() if r.domain == domain and r.enabled]

    def get_enabled(self) -> List[RuleDefinition]:
        return [r for r in self.rules.values() if r.enabled]

    def get_constraints_for_operator(self, operator: str) -> List[str]:
        """获取绑定到指定算子的所有约束"""
        constraints = []
        for rule in self.rules.values():
            if rule.enabled and rule.bound_operator == operator:
                constraints.extend(rule.constraints)
        return constraints

    def get_prompt_for_crystallization(self) -> str:
        """获取结晶化阶段应注入的所有Prompt片段"""
        prompts = []
        for rule in self.rules.values():
            if rule.enabled and rule.prompt_template:
                prompts.append(rule.prompt_template)
        return "\n\n".join(prompts)

    def inject_rules_to_symbol_store(self, symbol_store) -> int:
        """
        将所有规则注入SymbolStore（作为NeuroSymbol存储）。
        这使得规则本身可以被match()检索到。
        返回注入数量。
        """
        from py.neuro_bridge_api import NeuroSymbol, SymbolQ, SymbolK, SymbolVector

        count = 0
        for rule in self.rules.values():
            if not rule.enabled:
                continue
            # 检查是否已存在
            existing = symbol_store.get(rule.id)
            if existing:
                continue
            # 创建规则NeuroSymbol
            sym = NeuroSymbol(
                id=rule.id,
                operator="ApplyLogicRules",
                label=f"[Rule] {rule.name} v{rule.version}: {rule.description[:60]}",
                Q=SymbolQ(
                    ruleIds=[rule.id],
                    constraints=rule.constraints,
                ),
                K=SymbolK(
                    entities=[rule.domain, rule.source_project, rule.name],
                    relations=[f"{rule.name}→{rule.bound_operator}"],
                    factIds=[],
                    externalRefs=[f"source:{rule.source_project}"],
                ),
                z=[
                    SymbolVector(type="weight", key="rule_priority", value=1.0),
                    SymbolVector(type="weight", key="is_rule_definition", value=1.0),
                ],
                createdAt=rule.created_at,
                successRate=1.0,
                activationCount=0,
                delegationTarget="local",
            )
            symbol_store.store(sym)
            count += 1
            logger.info(f"[NeuroRules] Injected rule symbol: {rule.id}")

        return count

    def validate_symbol(self, symbol_dict: dict) -> List[str]:
        """
        根据规则验证一个待结晶的NeuroSymbol是否合规。
        返回违规信息列表（空=通过）。
        """
        violations = []

        # 获取消歧义规则
        disambig = self.rules.get("rule-disambig-force-v1")
        if disambig and disambig.enabled:
            config = disambig.config
            label = symbol_dict.get("label", "")
            entities = symbol_dict.get("K", {}).get("entities", [])
            all_text = label + " " + " ".join(entities)

            # 检查代词
            if config.get("enable_pronoun_check", True):
                for p in config.get("pronoun_blacklist_zh", []):
                    if p in all_text:
                        violations.append(f"DISAMBIG_NO_PRONOUNS: 发现中文代词'{p}'")
                for p in config.get("pronoun_blacklist_en", []):
                    # 仅检查独立词（避免 "the" 在 "they" 中误触）
                    import re
                    if re.search(rf'\b{p}\b', all_text, re.IGNORECASE):
                        violations.append(f"DISAMBIG_NO_PRONOUNS: 发现英文代词'{p}'")

            # 检查相对时间
            if config.get("enable_time_check", True):
                for t in config.get("relative_time_blacklist_zh", []):
                    if t in all_text:
                        violations.append(f"DISAMBIG_NO_RELATIVE_TIME: 发现相对时间'{t}'")
                for t in config.get("relative_time_blacklist_en", []):
                    import re
                    if re.search(rf'\b{t}\b', all_text, re.IGNORECASE):
                        violations.append(f"DISAMBIG_NO_RELATIVE_TIME: 发现相对时间'{t}'")

        return violations

    def to_dict(self) -> Dict:
        """导出所有规则为字典"""
        return {
            "rules": [
                {
                    "id": r.id,
                    "name": r.name,
                    "version": r.version,
                    "domain": r.domain,
                    "description": r.description,
                    "source_project": r.source_project,
                    "bound_operator": r.bound_operator,
                    "constraints": r.constraints,
                    "enabled": r.enabled,
                    "config": r.config,
                }
                for r in self.rules.values()
            ],
            "total": len(self.rules),
            "enabled": len([r for r in self.rules.values() if r.enabled]),
        }


# ============================================================================
# Global Singleton
# ============================================================================

_rule_registry: Optional[NeuroRuleRegistry] = None


def get_rule_registry() -> NeuroRuleRegistry:
    """获取或创建全局规则注册表单例"""
    global _rule_registry
    if _rule_registry is None:
        _rule_registry = NeuroRuleRegistry()
    return _rule_registry
