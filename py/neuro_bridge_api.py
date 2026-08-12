#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
NeuroSymbol 认知符号引擎 — 实现 14 种认知算子的符号化存储与三重倒排索引匹配。

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
OpenXnet — NeuroSymbol Python Bridge (neuro_bridge_api.py)

Port of packages/core/src/knowledge/neuro-symbolic/neuro-symbol.ts
Each completed cognitive operation is compressed into a lightweight symbol:
  Operator(Q, K, z₁, z₂, ..., zᵢ)

- Q = active rules/constraints
- K = knowledge references (entities, relations, facts)
- z = skill weights, memory vectors, embeddings

14 Cognitive Operators:
  ApplyLogicRules, SemanticRecall, CausalInfer, PlanDecompose,
  ToolChainExec, DelegateToAgent, PatternMatch, TemporalReason,
  EntityResolve, ConsolidateKnowledge, SkillCrystallize,
  ValidateOutput, EmotionalTag, MetaCognize

v0.5.1 Upgrades:
  - Disambiguation: Force full-name entities, ban pronouns/relative time
  - Memory Decay: Hebbian reinforcement + periodic sleep maintenance
  - Temporal KG: Hook for writing triples to temporal knowledge graph
"""

import json
import os
import re
import time
import hashlib
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any, Set, Tuple
from dataclasses import dataclass, field, asdict
from collections import defaultdict

logger = logging.getLogger("neuro_bridge")

# ============================================================================
# Cognitive Operator Vocabulary (14 operators)
# ============================================================================

VALID_OPERATORS = [
    "ApplyLogicRules",       # 规则推理 / 验证
    "SemanticRecall",        # 语义记忆检索
    "CausalInfer",           # 因果链推理
    "PlanDecompose",         # 任务分解为子目标
    "ToolChainExec",         # 多工具管线执行
    "DelegateToAgent",       # 委托给专业 Agent
    "PatternMatch",          # 模式检测 / 异常识别
    "TemporalReason",        # 时间线分析 / 趋势预测
    "EntityResolve",         # 实体消歧
    "ConsolidateKnowledge",  # 多源信息合并
    "SkillCrystallize",      # 从经验中提炼可复用技能
    "ValidateOutput",        # 后处理验证
    "EmotionalTag",          # 情感状态识别
    "MetaCognize",           # 自我反思 / 策略调整
]

# ============================================================================
# Data Models
# ============================================================================

@dataclass
class SymbolVector:
    """z-vector entry: skill weight, memory ref, or embedding"""
    type: str          # 'skill' | 'memory' | 'weight' | 'embedding'
    key: str           # skill name, episode ID, weight label
    value: float       # scalar weight/importance 0-1
    ref: str = ""      # optional external reference ("hindsight:uuid")

@dataclass
class SymbolQ:
    """Q component: rules and constraints applied"""
    ruleIds: List[str] = field(default_factory=list)
    constraints: List[str] = field(default_factory=list)

@dataclass
class SymbolK:
    """K component: knowledge references"""
    entities: List[str] = field(default_factory=list)
    relations: List[str] = field(default_factory=list)
    factIds: List[str] = field(default_factory=list)
    externalRefs: List[str] = field(default_factory=list)

@dataclass
class NeuroSymbol:
    """
    A NeuroSymbol: the compact representation of a completed cognitive operation.
    Operator(Q, K, z₁, z₂, ..., zᵢ)
    Typically < 1KB serialized.
    """
    id: str
    operator: str                # one of VALID_OPERATORS
    label: str                   # human-readable: "部署K8s集群到生产环境"
    Q: SymbolQ = field(default_factory=SymbolQ)
    K: SymbolK = field(default_factory=SymbolK)
    z: List[SymbolVector] = field(default_factory=list)
    createdAt: float = field(default_factory=time.time)
    successRate: float = 1.0
    activationCount: int = 0
    delegationTarget: str = "local"  # 'hindsight'|'dataops'|'mlops'|'aiops'|'local'
    parentSymbol: str = ""
    childSymbols: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "operator": self.operator,
            "label": self.label,
            "Q": {"ruleIds": self.Q.ruleIds, "constraints": self.Q.constraints},
            "K": {
                "entities": self.K.entities,
                "relations": self.K.relations,
                "factIds": self.K.factIds,
                "externalRefs": self.K.externalRefs,
            },
            "z": [{"type": v.type, "key": v.key, "value": v.value, "ref": v.ref} for v in self.z],
            "createdAt": self.createdAt,
            "successRate": self.successRate,
            "activationCount": self.activationCount,
            "delegationTarget": self.delegationTarget,
            "parentSymbol": self.parentSymbol,
            "childSymbols": self.childSymbols,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "NeuroSymbol":
        q_data = d.get("Q", {})
        k_data = d.get("K", {})
        z_data = d.get("z", [])
        return cls(
            id=d["id"],
            operator=d["operator"],
            label=d.get("label", ""),
            Q=SymbolQ(
                ruleIds=q_data.get("ruleIds", []),
                constraints=q_data.get("constraints", []),
            ),
            K=SymbolK(
                entities=k_data.get("entities", []),
                relations=k_data.get("relations", []),
                factIds=k_data.get("factIds", []),
                externalRefs=k_data.get("externalRefs", []),
            ),
            z=[SymbolVector(
                type=v.get("type", "weight"),
                key=v.get("key", ""),
                value=v.get("value", 0),
                ref=v.get("ref", ""),
            ) for v in z_data],
            createdAt=d.get("createdAt", time.time()),
            successRate=d.get("successRate", 1.0),
            activationCount=d.get("activationCount", 0),
            delegationTarget=d.get("delegationTarget", "local"),
            parentSymbol=d.get("parentSymbol", ""),
            childSymbols=d.get("childSymbols", []),
            metadata=d.get("metadata", {}) if isinstance(d.get("metadata", {}), dict) else {},
        )


# ============================================================================
# SymbolStore — JSON Persistence + In-Memory Inverted Index
# ============================================================================

class SymbolStore:
    """
    Lightweight NeuroSymbol storage with triple inverted index:
    - entity_index: entity_name → {symbol_ids}
    - keyword_index: keyword → {symbol_ids}
    - operator_index: operator → {symbol_ids}
    """

    def __init__(self, data_dir: str):
        self.save_path = os.path.join(data_dir, "neuro-symbols.json")
        self.symbols: Dict[str, NeuroSymbol] = {}
        # Inverted indices
        self.entity_index: Dict[str, set] = defaultdict(set)
        self.keyword_index: Dict[str, set] = defaultdict(set)
        self.operator_index: Dict[str, set] = defaultdict(set)

    def init(self):
        """Load symbols from disk"""
        if os.path.exists(self.save_path):
            try:
                with open(self.save_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                for item in data:
                    sym = NeuroSymbol.from_dict(item)
                    self.symbols[sym.id] = sym
                self._rebuild_indices()
                logger.info(f"[NeuroSymbol] Loaded {len(self.symbols)} symbols from {self.save_path}")
            except Exception as e:
                logger.warning(f"[NeuroSymbol] Failed to load: {e}, starting fresh")

    # --------------------------------------------------------------------------
    # CRUD
    # --------------------------------------------------------------------------

    def store(self, symbol: NeuroSymbol) -> None:
        """Store a new symbol and update indices"""
        self.symbols[symbol.id] = symbol
        self._index_symbol(symbol)
        self._persist()

    def store_batch(self, symbols: List[NeuroSymbol]) -> None:
        for sym in symbols:
            self.symbols[sym.id] = sym
            self._index_symbol(sym)
        self._persist()

    def replace_by_prefix(self, prefix: str, symbols: List[NeuroSymbol]) -> Dict[str, int]:
        """替换一个系统投影范围；输入符号 ID 前缀和完整符号集，重建索引并严格持久化。"""

        if not prefix or len(prefix) > 96:
            raise ValueError("NeuroSymbol projection prefix is invalid.")
        if len(symbols) > 1000 or any(not symbol.id.startswith(prefix) for symbol in symbols):
            raise ValueError("NeuroSymbol projection is outside its source scope.")
        previous_ids = {
            symbol_id for symbol_id in self.symbols if symbol_id.startswith(prefix)
        }
        for symbol_id in previous_ids:
            del self.symbols[symbol_id]
        for symbol in symbols:
            self.symbols[symbol.id] = symbol
        self._rebuild_indices()
        self._persist(strict=True)
        return {
            "stored": len(symbols),
            "removed": len(previous_ids - {symbol.id for symbol in symbols}),
        }

    def remove_by_prefix(self, prefix: str) -> int:
        """清理一个系统符号投影；输入符号 ID 前缀，删除匹配项并返回数量。"""

        if not prefix or len(prefix) > 96:
            raise ValueError("NeuroSymbol projection prefix is invalid.")
        symbol_ids = [
            symbol_id for symbol_id in self.symbols if symbol_id.startswith(prefix)
        ]
        for symbol_id in symbol_ids:
            del self.symbols[symbol_id]
        if symbol_ids:
            self._rebuild_indices()
            self._persist(strict=True)
        return len(symbol_ids)

    def get(self, symbol_id: str) -> Optional[NeuroSymbol]:
        return self.symbols.get(symbol_id)

    def remove(self, symbol_id: str) -> bool:
        existed = symbol_id in self.symbols
        if existed:
            del self.symbols[symbol_id]
            self._rebuild_indices()
            self._persist()
        return existed

    def all(self) -> List[NeuroSymbol]:
        return list(self.symbols.values())

    # --------------------------------------------------------------------------
    # Matching — Find relevant symbols for a new task
    # --------------------------------------------------------------------------

    def match(self, text: str = "", entities: List[str] = None,
              operator: str = None, top_k: int = 5) -> List[Dict]:
        """
        Match symbols relevant to a query.
        Returns list of {symbol, score, matchType}.
        """
        scored: List[Dict] = []
        seen_ids: Dict[str, int] = {}  # id → index in scored

        # 1. Entity-based matching
        if entities:
            candidate_ids = set()
            for entity in entities:
                normalized = entity.lower()
                if normalized in self.entity_index:
                    candidate_ids.update(self.entity_index[normalized])

            for sym_id in candidate_ids:
                sym = self.symbols.get(sym_id)
                if not sym:
                    continue
                overlap = sum(1 for e in entities
                              if any(se.lower() == e.lower() for se in sym.K.entities))
                score = overlap / max(len(entities), len(sym.K.entities))
                if score > 0:
                    scored.append({"symbol": sym, "score": score, "matchType": "entity"})
                    seen_ids[sym_id] = len(scored) - 1

        # 2. Keyword-based matching
        if text:
            keywords = self._tokenize(text)
            candidate_scores: Dict[str, int] = defaultdict(int)

            for kw in keywords:
                if kw in self.keyword_index:
                    for sym_id in self.keyword_index[kw]:
                        candidate_scores[sym_id] += 1

            for sym_id, hits in candidate_scores.items():
                sym = self.symbols.get(sym_id)
                if not sym:
                    continue
                score = hits / max(len(keywords), 1)

                if sym_id in seen_ids:
                    idx = seen_ids[sym_id]
                    scored[idx]["score"] = max(scored[idx]["score"], score)
                    scored[idx]["matchType"] = "combined"
                elif score > 0.1:
                    scored.append({"symbol": sym, "score": score, "matchType": "keyword"})
                    seen_ids[sym_id] = len(scored) - 1

        # 3. Operator-based matching
        if operator and operator in self.operator_index:
            for sym_id in self.operator_index[operator]:
                sym = self.symbols.get(sym_id)
                if not sym:
                    continue
                if sym_id in seen_ids:
                    idx = seen_ids[sym_id]
                    scored[idx]["score"] += 0.1
                    scored[idx]["matchType"] = "combined"
                else:
                    scored.append({"symbol": sym, "score": 0.15, "matchType": "operator"})

        # Sort by score desc, then activation count, then recency
        scored.sort(key=lambda x: (
            -x["score"],
            -x["symbol"].activationCount,
            -x["symbol"].createdAt,
        ))

        # [v0.5.1 Hebbian Reinforcement] Increment activation count for returned results
        results = scored[:top_k]
        for r in results:
            r["symbol"].activationCount += 1
        # Auto-persist after activation updates
        if results:
            self._persist()

        return results

    def format_for_context(self, matches: List[Dict]) -> str:
        """Format matched symbols as compact context for LLM injection"""
        if not matches:
            return ""
        lines = []
        for m in matches:
            s = m["symbol"]
            z_summary = ", ".join(f"{v.key}={v.value}" for v in s.z[:3])
            lines.append(
                f"• {s.operator}(\"{s.label}\") "
                f"Q=[{','.join(s.Q.ruleIds)}] "
                f"K=[{','.join(s.K.entities)}] "
                f"z=[{z_summary}] "
                f"✓{s.successRate * 100:.0f}%"
            )
        return f"[NeuroSymbol Memory — {len(matches)} symbols matched]\n" + "\n".join(lines)

    # --------------------------------------------------------------------------
    # Graph — Extract nodes and edges for D3.js
    # --------------------------------------------------------------------------

    def get_graph(self) -> Dict:
        """Extract entity-relation graph for D3.js visualization"""
        nodes_map: Dict[str, Dict] = {}
        edges: List[Dict] = []

        for sym in self.symbols.values():
            # Add entity nodes
            for entity in sym.K.entities:
                key = entity.lower()
                if key not in nodes_map:
                    nodes_map[key] = {
                        "id": key,
                        "name": entity,
                        "type": "entity",
                        "symbolCount": 0,
                        "operators": [],
                    }
                nodes_map[key]["symbolCount"] += 1
                if sym.operator not in nodes_map[key]["operators"]:
                    nodes_map[key]["operators"].append(sym.operator)

            # Add edges between co-occurring entities
            ents = sym.K.entities
            for i in range(len(ents)):
                for j in range(i + 1, len(ents)):
                    edges.append({
                        "source": ents[i].lower(),
                        "target": ents[j].lower(),
                        "relation": sym.operator,
                        "label": sym.label[:30],
                        "symbolId": sym.id,
                    })

            # Add relation-based edges
            for rel in sym.K.relations:
                parts = rel.split("→") if "→" in rel else rel.split("->")
                if len(parts) == 2:
                    src, tgt = parts[0].strip().lower(), parts[1].strip().lower()
                    if src not in nodes_map:
                        nodes_map[src] = {"id": src, "name": parts[0].strip(),
                                          "type": "entity", "symbolCount": 1, "operators": []}
                    if tgt not in nodes_map:
                        nodes_map[tgt] = {"id": tgt, "name": parts[1].strip(),
                                          "type": "entity", "symbolCount": 1, "operators": []}
                    edges.append({
                        "source": src, "target": tgt,
                        "relation": "relation", "label": rel,
                        "symbolId": sym.id,
                    })

        return {
            "nodes": list(nodes_map.values()),
            "edges": edges,
            "totalSymbols": len(self.symbols),
        }

    # --------------------------------------------------------------------------
    # Stats
    # --------------------------------------------------------------------------

    def get_stats(self) -> Dict:
        by_operator: Dict[str, int] = defaultdict(int)
        by_delegation: Dict[str, int] = defaultdict(int)
        total_success = 0.0
        competition_symbols = 0

        for sym in self.symbols.values():
            by_operator[sym.operator] += 1
            by_delegation[sym.delegationTarget] += 1
            total_success += sym.successRate
            if sym.metadata.get("sourceType") == "competition":
                competition_symbols += 1

        n = len(self.symbols)
        return {
            "totalSymbols": n,
            "byOperator": dict(by_operator),
            "byDelegation": dict(by_delegation),
            "avgSuccessRate": total_success / n if n > 0 else 0,
            "sizeEstimateKB": round(len(json.dumps([s.to_dict() for s in self.symbols.values()])) / 1024, 1) if n > 0 else 0,
            "totalEntities": len(self.entity_index),
            "totalKeywords": len(self.keyword_index),
            "competitionSymbols": competition_symbols,
        }

    # --------------------------------------------------------------------------
    # [v0.5.1] Memory Decay — Hebbian reinforcement & sleep maintenance
    # --------------------------------------------------------------------------

    def perform_sleep_maintenance(self, decay_factor: float = 0.95,
                                   prune_min_age_days: int = 7,
                                   prune_min_activation: int = 0,
                                   protect_success_threshold: float = 0.8,
                                   max_prune: int = 50) -> Dict:
        """
        [v0.5.1 Rule: rule-decay-hebbian-v1]
        Biological sleep maintenance cycle:
        1. Decay all activation counts by factor
        2. Prune symbols with zero activation and old age
        3. Protect high-success-rate symbols
        Returns stats about the maintenance cycle.
        """
        now = time.time()
        age_threshold = now - (prune_min_age_days * 86400)
        decayed = 0
        pruned = 0
        protected = 0
        prune_candidates = []

        for sym_id, sym in list(self.symbols.items()):
            # Skip rule definitions
            if sym_id.startswith("rule-"):
                continue

            # Step 1: Decay activation count (Hebbian weight decay)
            if sym.activationCount > 0:
                # Apply decay: multiply by factor, floor to int
                old_count = sym.activationCount
                sym.activationCount = max(0, int(sym.activationCount * decay_factor))
                if sym.activationCount < old_count:
                    decayed += 1

            # Step 2: Identify prune candidates
            if (sym.activationCount <= prune_min_activation
                    and sym.createdAt < age_threshold):
                # Step 3: Protect high-success symbols
                if sym.successRate >= protect_success_threshold:
                    protected += 1
                    continue
                prune_candidates.append(sym_id)

        # Step 4: Prune (capped)
        for sym_id in prune_candidates[:max_prune]:
            del self.symbols[sym_id]
            pruned += 1

        if decayed > 0 or pruned > 0:
            self._rebuild_indices()
            self._persist()

        result = {
            "decayed": decayed,
            "pruned": pruned,
            "protected": protected,
            "remaining": len(self.symbols),
            "timestamp": datetime.now().isoformat(),
        }
        logger.info(f"[NeuroSymbol] Sleep maintenance: {result}")
        return result

    # --------------------------------------------------------------------------
    # Indexing
    # --------------------------------------------------------------------------

    def _rebuild_indices(self):
        self.entity_index.clear()
        self.keyword_index.clear()
        self.operator_index.clear()
        for sym in self.symbols.values():
            self._index_symbol(sym)

    def _index_symbol(self, sym: NeuroSymbol):
        for entity in sym.K.entities:
            self.entity_index[entity.lower()].add(sym.id)
        for kw in self._tokenize(sym.label):
            self.keyword_index[kw].add(sym.id)
        self.operator_index[sym.operator].add(sym.id)

    def _tokenize(self, text: str) -> List[str]:
        """CJK-aware tokenization: split on whitespace + extract CJK bigrams"""
        words = set()
        # Latin words
        cleaned = re.sub(r'[^\w\u4e00-\u9fff\s]', ' ', text.lower())
        for token in cleaned.split():
            if len(token) > 1:
                words.add(token)
        # CJK bigrams
        cjk = re.sub(r'[^\u4e00-\u9fff]', '', text)
        for i in range(len(cjk) - 1):
            words.add(cjk[i:i + 2])
        return list(words)

    # --------------------------------------------------------------------------
    # Persistence
    # --------------------------------------------------------------------------

    def _persist(self, strict: bool = False):
        """以 UTF-8 持久化符号；输入严格模式，失败时按调用边界选择抛错或记录。"""

        try:
            os.makedirs(os.path.dirname(self.save_path), exist_ok=True)
            data = [sym.to_dict() for sym in self.symbols.values()]
            with open(self.save_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.warning(f"[NeuroSymbol] Persist failed: {e}")
            if strict:
                raise


# ============================================================================
# Fact Extractor — Extract entities and relations from text
# ============================================================================

class FactExtractor:
    """
    Lightweight fact extraction using regex patterns.
    For production use, delegate to LLM-based extraction.
    """

    # Common entity patterns
    ENTITY_PATTERNS = [
        r'(?:部署|安装|配置|启动|运行|更新|升级|删除|创建|修改)\s*(?:了?\s*)(.{2,20}?)(?:[。，,\s]|$)',
        r'使用\s*(.{2,15}?)(?:来|进行|完成)',
        r'(.{2,15}?)(?:服务|系统|模块|组件|引擎|工具|API)',
    ]

    @classmethod
    def extract_entities(cls, text: str) -> List[str]:
        """Extract entity-like tokens from text"""
        entities = set()

        # Regex extraction
        for pattern in cls.ENTITY_PATTERNS:
            for m in re.finditer(pattern, text):
                entity = m.group(1).strip()
                if 2 <= len(entity) <= 20 and entity not in ("的", "了", "是", "在"):
                    entities.add(entity)

        # Quoted terms
        for m in re.finditer(r'[「"\'`](.{2,30}?)[」"\'`]', text):
            entities.add(m.group(1))

        # English proper nouns (capitalized words)
        for m in re.finditer(r'\b([A-Z][a-zA-Z]{2,}(?:\s+[A-Z][a-zA-Z]+)*)\b', text):
            entities.add(m.group(1))

        # Tech terms
        for m in re.finditer(r'\b((?:[A-Za-z]+[-_]?){2,}(?:\.js|\.py|\.ts)?)\b', text):
            term = m.group(1)
            if len(term) > 3 and not term.startswith("http"):
                entities.add(term)

        return list(entities)[:20]  # Cap at 20 entities

    @classmethod
    def extract_relations(cls, text: str) -> List[str]:
        """Extract relation patterns (A → B)"""
        relations = []
        # "X 依赖 Y", "X 使用 Y", "X 连接 Y" etc.
        patterns = [
            r'(.{2,15}?)(?:依赖|使用|连接|调用|委托|控制|管理|包含)\s*(.{2,15})',
            r'(.{2,10})\s*(?:→|->|==>)\s*(.{2,10})',
        ]
        for pattern in patterns:
            for m in re.finditer(pattern, text):
                relations.append(f"{m.group(1).strip()}→{m.group(2).strip()}")
        return relations[:10]

    @classmethod
    def infer_operator(cls, text: str) -> str:
        """Infer the most likely cognitive operator from text"""
        operator_keywords = {
            "ApplyLogicRules": ["规则", "验证", "检查", "校验", "rule", "validate"],
            "SemanticRecall": ["回忆", "检索", "查找", "搜索", "recall", "search", "find"],
            "CausalInfer": ["因为", "所以", "导致", "原因", "因果", "cause", "because"],
            "PlanDecompose": ["计划", "分解", "步骤", "任务", "plan", "step", "decompose"],
            "ToolChainExec": ["执行", "运行", "工具", "命令", "execute", "run", "tool"],
            "DelegateToAgent": ["委托", "转发", "agent", "delegate"],
            "PatternMatch": ["模式", "检测", "识别", "pattern", "detect", "anomaly"],
            "TemporalReason": ["时间", "趋势", "预测", "temporal", "trend", "predict"],
            "EntityResolve": ["实体", "消歧", "entity", "resolve"],
            "ConsolidateKnowledge": ["合并", "整合", "知识", "consolidate", "merge"],
            "SkillCrystallize": ["提炼", "技能", "经验", "crystallize", "skill"],
            "ValidateOutput": ["验证", "输出", "检查结果", "validate", "output"],
            "EmotionalTag": ["情感", "情绪", "感受", "emotion", "feeling"],
            "MetaCognize": ["反思", "策略", "自我", "meta", "reflect", "self"],
        }
        text_lower = text.lower()
        best_op = "ToolChainExec"
        best_score = 0
        for op, keywords in operator_keywords.items():
            score = sum(1 for kw in keywords if kw in text_lower)
            if score > best_score:
                best_score = score
                best_op = op
        return best_op


# ============================================================================
# [v0.5.3 P0-C] LLM-based Fact Extractor — High-precision entity extraction
# ============================================================================

class LLMFactExtractor:
    """
    使用轻量级 LLM (fast_client) 进行高精度实体/关系/算子抽取。
    比正则 FactExtractor 准确率提升 3-5x，但需要 LLM API 调用。
    当 LLM 不可用时自动回退到正则抽取。
    """

    EXTRACTION_PROMPT = """从以下对话文本中抽取结构化信息。请严格返回JSON格式：

对话文本:
{text}

请返回以下JSON（不要包含任何其他文字）:
{{
    "entities": ["实体1", "实体2"],
    "relations": ["实体A→实体B"],
    "operator": "最合适的算子名称",
    "label": "一句话概括这段对话的认知操作"
}}

可用的算子列表: ApplyLogicRules, SemanticRecall, CausalInfer, PlanDecompose, ToolChainExec, DelegateToAgent, PatternMatch, TemporalReason, EntityResolve, ConsolidateKnowledge, SkillCrystallize, ValidateOutput, EmotionalTag, MetaCognize

要求:
- entities: 提取具体的技术名词、工具名、项目名、人名等实体（2-20个字符），排除代词
- relations: 如果有因果/依赖/使用关系则提取，格式"A→B"
- operator: 从算子列表中选择最能描述此操作的一个
- label: 用中文概括，20-50字"""

    @classmethod
    async def extract_with_llm(cls, text: str, llm_client, model: str = None) -> dict:
        """
        使用 LLM 进行结构化抽取。
        
        Args:
            text: 待抽取文本（通常是 user_input + assistant_output）
            llm_client: OpenAI 兼容客户端 (fast_client)
            model: 模型名称
            
        Returns:
            dict with keys: entities, relations, operator, label
        """
        import json as _json
        
        # 截断过长文本
        if len(text) > 3000:
            text = text[:1500] + "\n...[中间省略]...\n" + text[-1500:]
        
        try:
            prompt = cls.EXTRACTION_PROMPT.format(text=text)
            
            response = await llm_client.chat.completions.create(
                model=model or "gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "你是一个精确的信息抽取引擎。只返回JSON，不要任何其他文字。"},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                max_tokens=500,
            )
            
            content = response.choices[0].message.content.strip()
            
            # 清理 markdown code block
            if content.startswith("```"):
                content = content.split("\n", 1)[1] if "\n" in content else content[3:]
                if content.endswith("```"):
                    content = content[:-3]
                content = content.strip()
            
            result = _json.loads(content)
            
            # 校验并规范化
            entities = result.get("entities", [])[:20]
            relations = result.get("relations", [])[:10]
            operator = result.get("operator", "ToolChainExec")
            label = result.get("label", "")[:200]
            
            # 校验 operator
            if operator not in VALID_OPERATORS:
                operator = FactExtractor.infer_operator(text)
            
            logger.info(f"[LLMFactExtractor] 成功抽取: {len(entities)} entities, {len(relations)} relations, op={operator}")
            
            return {
                "entities": entities,
                "relations": relations,
                "operator": operator,
                "label": label,
                "source": "llm",
            }
            
        except Exception as e:
            logger.warning(f"[LLMFactExtractor] LLM 抽取失败({e})，回退到正则抽取")
            # 回退到正则
            return {
                "entities": FactExtractor.extract_entities(text),
                "relations": FactExtractor.extract_relations(text),
                "operator": FactExtractor.infer_operator(text),
                "label": text[:100],
                "source": "regex_fallback",
            }


# ============================================================================
# Symbol Crystallizer — Create symbols from completed operations
# ============================================================================

class SymbolCrystallizer:
    """
    Crystallize a completed cognitive operation into a NeuroSymbol.
    This is the post-neural step of the Brain Loop.

    v0.5.1: Integrates disambiguation rules, temporal KG hooks, and rule tracking.
    """

    # [v0.5.1] Disambiguation blacklists (from rule-disambig-force-v1)
    _PRONOUN_ZH = ["他", "她", "它", "他们", "她们", "这个", "那个", "这些", "那些"]
    _PRONOUN_EN_PATTERN = re.compile(r'\b(he|she|it|they|this|that|these|those)\b', re.IGNORECASE)
    _RELTIME_ZH = ["昨天", "今天", "明天", "上周", "下周", "上个月", "刚才", "最近"]
    _RELTIME_EN_PATTERN = re.compile(r'\b(yesterday|today|tomorrow|last\s+week|next\s+week|recently|just\s+now)\b', re.IGNORECASE)

    @classmethod
    def _disambiguate_text(cls, text: str) -> str:
        """
        [v0.5.1 Rule: rule-disambig-force-v1]
        Remove pronouns and relative time from text.
        Replaces with '[?]' marker so upstream knows data was stripped.
        """
        result = text
        # Remove Chinese pronouns
        for p in cls._PRONOUN_ZH:
            result = result.replace(p, "")
        # Remove English pronouns
        result = cls._PRONOUN_EN_PATTERN.sub("", result)
        # Remove Chinese relative time
        for t in cls._RELTIME_ZH:
            result = result.replace(t, datetime.now().strftime("%Y-%m-%d"))
        # Remove English relative time
        result = cls._RELTIME_EN_PATTERN.sub(datetime.now().strftime("%Y-%m-%d"), result)
        # Clean up extra spaces
        result = re.sub(r'\s+', ' ', result).strip()
        return result

    @classmethod
    def _disambiguate_entities(cls, entities: List[str]) -> List[str]:
        """
        [v0.5.1] Filter out pronoun-only entities and apply disambiguation.
        """
        cleaned = []
        for e in entities:
            # Skip pure pronouns
            if e in cls._PRONOUN_ZH:
                continue
            if cls._PRONOUN_EN_PATTERN.fullmatch(e.strip()):
                continue
            # Apply disambiguation to the entity text
            de = cls._disambiguate_text(e)
            if len(de) >= 2:  # Keep only meaningful entities
                cleaned.append(de)
        return cleaned

    @staticmethod
    def crystallize(
        label: str,
        user_input: str = "",
        assistant_output: str = "",
        tools_used: List[str] = None,
        success: bool = True,
    ) -> NeuroSymbol:
        """
        Create a NeuroSymbol from a completed operation.

        v0.5.1: Applies disambiguation rules before storage.

        Args:
            label: Human-readable description
            user_input: The user's request
            assistant_output: The assistant's response
            tools_used: List of tools that were called
            success: Whether the operation was successful
        """
        # Generate ID
        ts = int(time.time() * 1000)
        hash4 = hashlib.md5(label.encode()).hexdigest()[:4]
        symbol_id = f"ns-{ts}-{hash4}"

        # Extract entities from both input and output
        all_text = f"{user_input} {assistant_output}"
        entities = FactExtractor.extract_entities(all_text)
        relations = FactExtractor.extract_relations(all_text)

        # [v0.5.1] Apply disambiguation rules
        entities = SymbolCrystallizer._disambiguate_entities(entities)
        label = SymbolCrystallizer._disambiguate_text(label)
        relations = [SymbolCrystallizer._disambiguate_text(r) for r in relations]

        # Infer operator
        operator = FactExtractor.infer_operator(all_text)

        # Build z-vectors
        z_vectors = []
        if tools_used:
            for tool in tools_used:
                z_vectors.append(SymbolVector(
                    type="skill",
                    key=tool,
                    value=0.8 if success else 0.3,
                ))

        # Add context weight
        z_vectors.append(SymbolVector(
            type="weight",
            key="confidence",
            value=0.9 if success else 0.4,
        ))

        # [v0.5.1] Track which rules were applied
        applied_rules = ["rule-disambig-force-v1"]
        applied_constraints = [
            "DISAMBIG_NO_PRONOUNS",
            "DISAMBIG_NO_RELATIVE_TIME",
            "DISAMBIG_FULL_NAME_REQUIRED",
        ]

        symbol = NeuroSymbol(
            id=symbol_id,
            operator=operator,
            label=label[:200],  # v0.5.1: Increased cap for disambiguated labels
            Q=SymbolQ(
                ruleIds=applied_rules,
                constraints=applied_constraints,
            ),
            K=SymbolK(
                entities=entities,
                relations=relations,
                factIds=[],
                externalRefs=[],
            ),
            z=z_vectors,
            createdAt=time.time(),
            successRate=1.0 if success else 0.0,
            activationCount=0,
            delegationTarget="local",
        )

        # [v0.5.1] Write to temporal knowledge graph if available
        try:
            from py.neuro_temporal_kg import get_temporal_kg
            kg = get_temporal_kg()
            if kg:
                now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
                for entity in entities[:10]:  # Cap entity writes
                    kg.add_triple(
                        subject=entity,
                        predicate=operator,
                        obj=label[:60],
                        valid_from=now_str,
                        confidence=symbol.successRate,
                        source_symbol=symbol_id,
                    )
                for rel in relations[:5]:
                    parts = rel.split("→") if "→" in rel else rel.split("->")
                    if len(parts) == 2:
                        kg.add_triple(
                            subject=parts[0].strip(),
                            predicate="related_to",
                            obj=parts[1].strip(),
                            valid_from=now_str,
                            confidence=symbol.successRate,
                            source_symbol=symbol_id,
                        )
        except Exception as kg_err:
            logger.debug(f"[BrainLoop] Temporal KG write skipped: {kg_err}")

        return symbol


# ============================================================================
# Global accessor (singleton pattern matching synapse_registry)
# ============================================================================

_symbol_store: Optional[SymbolStore] = None


def get_symbol_store(data_dir: str = None) -> SymbolStore:
    """Get or create the global SymbolStore singleton"""
    global _symbol_store
    if _symbol_store is None:
        if data_dir is None:
            raise ValueError("data_dir must be provided on first call")
        _symbol_store = SymbolStore(data_dir)
        _symbol_store.init()
    return _symbol_store
