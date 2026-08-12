#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
OpenXnet Skill Engineering v2 技能库。

技能库保留旧版扁平 Skill 的兼容读取，同时支持 Skill Family、策略变体、
分环境证据、认证范围和受约束的运行时选择。

Author: Claude Code
Department: R&D
Date: 2026-04-19
Version: 1.0.0
Security Level: INTERNAL
"""

__version__ = "1.0.0"
__author__ = "Claude Code"
__copyright__ = "Copyright 2026 Synapxnet"
__maintainer__ = "Claude Code"
__email__ = "synapxnet@gmail.com"

import hashlib
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from py.kernel.skill_engineering import (
    PRODUCTION_SCOPE,
    TRUSTED_CERTIFICATION_STATES,
    certification_is_trusted,
    normalize_certification_state,
    normalize_certifications,
    normalize_derivation_method,
    normalize_environment_scope,
    normalize_evidence_origin,
    normalize_evidence_summary,
    normalize_strategies,
    normalize_strategy,
    normalize_string_list,
    strategy_utility,
    utc_now,
)

logger = logging.getLogger("app")

SKILL_LIFECYCLE_STATES = {"candidate", "verified", "active", "deprecated", "retired"}


def _as_list(value: Any) -> List[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, tuple):
        return list(value)
    if isinstance(value, str):
        return [line.strip() for line in value.splitlines() if line.strip()]
    return [value]


def _as_dict(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _lifecycle_status_from(tags: List[str], verified: bool, status: str = "") -> str:
    normalized = str(status or "").strip().lower()
    if normalized in SKILL_LIFECYCLE_STATES:
        return normalized
    tag_set = {str(tag).strip().lower() for tag in tags or []}
    for candidate in ("retired", "deprecated", "active", "verified", "candidate"):
        if candidate in tag_set:
            return candidate
    if verified:
        return "verified"
    return "active"


def _merge_lifecycle_tags(tags: List[str], status: str) -> List[str]:
    current = [str(tag) for tag in (tags or []) if str(tag).strip().lower() not in SKILL_LIFECYCLE_STATES]
    if status and status not in current:
        current.append(status)
    return current

class SkillEntry:
    """A stored skill with metadata, code, and usage tracking."""

    def __init__(
        self,
        name: str,
        description: str,
        code: str = "",
        *,
        skill_id: str = "",
        language: str = "python",
        dependencies: List[str] = None,
        tags: List[str] = None,
        examples: List[str] = None,
        use_count: int = 0,
        success_count: int = 0,
        fail_count: int = 0,
        verified: bool = False,
        created_at: str = "",
        updated_at: str = "",
        composed_from: List[str] = None,
        status: str = "",
        lifecycle_status: str = "",
        trigger_context: str = "",
        workflow: List[str] = None,
        required_capabilities: List[str] = None,
        verification: Dict[str, Any] = None,
        rollback: str = "",
        counter_examples: List[str] = None,
        source_event_ids: List[str] = None,
        last_verified_at: str = "",
        retired_at: str = "",
        source: str = "",
        tool_chain: List[str] = None,
        lifecycle_history: List[Dict[str, Any]] = None,
        family_id: str = "",
        problem_fingerprint: str = "",
        evidence_origin: str = "",
        derivation_method: str = "",
        environment_scope: str = "",
        environment_fingerprint: str = "",
        strategies: List[Dict[str, Any]] = None,
        certifications: List[Dict[str, Any]] = None,
        evidence_summary: Dict[str, Dict[str, Any]] = None,
        applicability_rules: Dict[str, Any] = None,
        selection_policy: Dict[str, Any] = None,
    ):
        self.name = name
        self.description = description
        self.code = code
        self.skill_id = skill_id or hashlib.md5(name.encode("utf-8")).hexdigest()[:10]
        self.language = language
        self.dependencies = dependencies or []
        self.tags = tags or []
        self.examples = examples or []
        self.use_count = use_count
        self.success_count = success_count
        self.fail_count = fail_count
        self.verified = verified
        self.created_at = created_at or datetime.now().isoformat()
        self.updated_at = updated_at or self.created_at
        self.composed_from = composed_from or []
        self.trigger_context = trigger_context
        self.workflow = _as_list(workflow)
        self.required_capabilities = _as_list(required_capabilities)
        self.verification = _as_dict(verification)
        self.rollback = rollback
        self.counter_examples = _as_list(counter_examples)
        self.source_event_ids = _as_list(source_event_ids)
        self.last_verified_at = last_verified_at
        self.retired_at = retired_at
        self.source = source
        self.tool_chain = _as_list(tool_chain)
        self.lifecycle_history = _as_list(lifecycle_history)
        self.family_id = str(family_id or self.skill_id).strip() or self.skill_id
        self.problem_fingerprint = str(problem_fingerprint or "").strip()
        self.evidence_origin = normalize_evidence_origin(evidence_origin or source)
        self.derivation_method = normalize_derivation_method(derivation_method, self.evidence_origin)
        self.environment_scope = normalize_environment_scope(environment_scope)
        self.environment_fingerprint = str(environment_fingerprint or "").strip()[:256]
        self.strategies = normalize_strategies(strategies)
        self.certifications = normalize_certifications(certifications)
        self.evidence_summary = normalize_evidence_summary(evidence_summary)
        self.applicability_rules = _as_dict(applicability_rules)
        self.selection_policy = _as_dict(selection_policy)
        self.status = _lifecycle_status_from(self.tags, self.verified, lifecycle_status or status)
        self.tags = _merge_lifecycle_tags(self.tags, self.status)

    @property
    def success_rate(self) -> float:
        total = self.success_count + self.fail_count
        return self.success_count / total if total > 0 else 0.0

    def record_use(
        self,
        success: bool,
        *,
        environment_scope: str = "",
        environment_fingerprint: str = "",
        evidence_origin: str = "",
        strategy_id: str = "",
        source_event_id: str = "",
    ) -> None:
        """记录一次使用，并在提供环境时同步更新证据桶和策略统计。"""

        self.use_count += 1
        if success:
            self.success_count += 1
            if self.status in {"verified", "active"}:
                self.last_verified_at = datetime.now().isoformat()
        else:
            self.fail_count += 1
        self.updated_at = datetime.now().isoformat()
        if not environment_scope:
            return

        scope = normalize_environment_scope(environment_scope)
        fingerprint = str(environment_fingerprint or "").strip()[:256]
        event_id = str(source_event_id or "").strip()[:256]
        bucket = self.evidence_summary.setdefault(scope, {
            "attempts": 0,
            "successes": 0,
            "failures": 0,
            "last_used_at": "",
            "environment_fingerprints": [],
            "source_event_ids": [],
        })
        bucket["attempts"] = int(bucket.get("attempts") or 0) + 1
        bucket["successes"] = int(bucket.get("successes") or 0) + (1 if success else 0)
        bucket["failures"] = int(bucket.get("failures") or 0) + (0 if success else 1)
        bucket["last_used_at"] = utc_now()
        if fingerprint and fingerprint not in bucket["environment_fingerprints"]:
            bucket["environment_fingerprints"].append(fingerprint)
            bucket["environment_fingerprints"] = bucket["environment_fingerprints"][-20:]
        if event_id and event_id not in bucket["source_event_ids"]:
            bucket["source_event_ids"].append(event_id)
            bucket["source_event_ids"] = bucket["source_event_ids"][-200:]

        resolved_strategy_id = str(strategy_id or "").strip()
        if resolved_strategy_id:
            strategy = self.upsert_strategy({
                "strategy_id": resolved_strategy_id,
                "name": resolved_strategy_id,
                "workflow": self.workflow,
                "tool_chain": self.tool_chain,
            })
            strategy_bucket = strategy["evidence_summary"].setdefault(scope, {
                "attempts": 0,
                "successes": 0,
                "failures": 0,
                "last_used_at": "",
                "environment_fingerprints": [],
                "source_event_ids": [],
            })
            strategy_bucket["attempts"] = int(strategy_bucket.get("attempts") or 0) + 1
            strategy_bucket["successes"] = int(strategy_bucket.get("successes") or 0) + (1 if success else 0)
            strategy_bucket["failures"] = int(strategy_bucket.get("failures") or 0) + (0 if success else 1)
            strategy_bucket["last_used_at"] = utc_now()
            if fingerprint and fingerprint not in strategy_bucket["environment_fingerprints"]:
                strategy_bucket["environment_fingerprints"].append(fingerprint)
            if event_id and event_id not in strategy_bucket["source_event_ids"]:
                strategy_bucket["source_event_ids"].append(event_id)
            strategy["source_event_ids"] = normalize_string_list([
                *strategy.get("source_event_ids", []),
                event_id,
            ])[-200:]
            strategy["updated_at"] = utc_now()

        if not self.get_certification(scope):
            self.set_certification(
                scope,
                "candidate",
                environment_fingerprint=fingerprint,
                reason="first_scoped_evidence",
                actor="skill_library",
            )
        if evidence_origin:
            self.evidence_origin = normalize_evidence_origin(evidence_origin)
        if event_id and event_id not in self.source_event_ids:
            self.source_event_ids.append(event_id)
            self.source_event_ids = self.source_event_ids[-200:]

    def upsert_strategy(self, value: Dict[str, Any]) -> Dict[str, Any]:
        """新增或合并一个策略变体；同一 strategy_id 始终保留为一个策略。"""

        incoming = normalize_strategy(value)
        for index, current in enumerate(self.strategies):
            if current.get("strategy_id") != incoming["strategy_id"]:
                continue
            merged = dict(current)
            for key in ("name", "description", "workflow", "tool_chain", "risk_level", "cost_score"):
                if incoming.get(key):
                    merged[key] = incoming[key]
            merged_events = normalize_string_list([
                *current.get("source_event_ids", []),
                *incoming.get("source_event_ids", []),
            ])[-200:]
            merged["source_event_ids"] = merged_events
            merged_evidence = normalize_evidence_summary(current.get("evidence_summary"))
            for scope, bucket in normalize_evidence_summary(incoming.get("evidence_summary")).items():
                merged_evidence[scope] = bucket
            merged["evidence_summary"] = merged_evidence
            merged["updated_at"] = utc_now()
            normalized = normalize_strategy(merged)
            self.strategies[index] = normalized
            return normalized
        self.strategies.append(incoming)
        return incoming

    def get_certification(self, environment_scope: str) -> Optional[Dict[str, Any]]:
        """读取指定环境范围的认证记录，未找到时返回 None。"""

        scope = normalize_environment_scope(environment_scope)
        return next((item for item in self.certifications if item.get("scope") == scope), None)

    def set_certification(
        self,
        environment_scope: str,
        status: str,
        *,
        environment_fingerprint: str = "",
        evidence_event_ids: List[str] = None,
        reason: str = "",
        actor: str = "system",
    ) -> Dict[str, Any]:
        """写入一个分环境认证状态，不自动改变全局生命周期。"""

        scope = normalize_environment_scope(environment_scope)
        normalized_status = normalize_certification_state(status)
        record = {
            "scope": scope,
            "status": normalized_status,
            "environment_fingerprint": str(environment_fingerprint or "").strip()[:256],
            "verified_at": utc_now() if normalized_status in TRUSTED_CERTIFICATION_STATES else "",
            "expires_at": "",
            "evidence_event_ids": normalize_string_list(evidence_event_ids),
            "reason": str(reason or "").strip()[:500],
            "actor": str(actor or "system").strip()[:120],
            "updated_at": utc_now(),
        }
        for index, current in enumerate(self.certifications):
            if current.get("scope") == scope:
                if not record["environment_fingerprint"]:
                    record["environment_fingerprint"] = str(current.get("environment_fingerprint") or "")
                if not record["evidence_event_ids"]:
                    record["evidence_event_ids"] = normalize_string_list(current.get("evidence_event_ids"))
                self.certifications[index] = record
                return record
        self.certifications.append(record)
        return record

    def is_certified_for(self, environment_scope: str, environment_fingerprint: str = "") -> bool:
        """判断 Skill 是否可在目标环境执行；模拟认证永远不能替代生产认证。"""

        scope = normalize_environment_scope(environment_scope)
        certification = self.get_certification(scope)
        if certification:
            return certification_is_trusted(certification, environment_fingerprint)
        if self.certifications:
            return False
        legacy_safe = self.evidence_origin != "rehearsal" and str(self.source or "").strip().lower() != "sleep"
        return scope == PRODUCTION_SCOPE and legacy_safe and self.status in TRUSTED_CERTIFICATION_STATES

    def best_strategy(self, environment_scope: str) -> Optional[Dict[str, Any]]:
        """按目标环境的保守效用选择策略；无策略时返回 None。"""

        if not self.strategies:
            return None
        ranked = sorted(
            self.strategies,
            key=lambda item: strategy_utility(item, environment_scope),
            reverse=True,
        )
        selected = dict(ranked[0])
        selected["utility"] = strategy_utility(selected, environment_scope)
        return selected

    def set_status(self, status: str, *, reason: str = "", actor: str = "system") -> None:
        normalized = str(status or "").strip().lower()
        if normalized not in SKILL_LIFECYCLE_STATES:
            raise ValueError(f"unsupported skill lifecycle status: {status}")
        previous = self.status
        self.status = normalized
        self.verified = normalized in {"verified", "active"}
        if normalized in {"verified", "active"}:
            self.last_verified_at = datetime.now().isoformat()
        if normalized == "retired":
            self.retired_at = datetime.now().isoformat()
        self.tags = _merge_lifecycle_tags(self.tags, normalized)
        self.updated_at = datetime.now().isoformat()
        self.lifecycle_history.append({
            "at": self.updated_at,
            "from": previous,
            "to": normalized,
            "reason": reason,
            "actor": actor,
        })

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "description": self.description,
            "code": self.code,
            "skill_id": self.skill_id,
            "language": self.language,
            "dependencies": self.dependencies,
            "tags": self.tags,
            "examples": self.examples,
            "use_count": self.use_count,
            "success_count": self.success_count,
            "fail_count": self.fail_count,
            "success_rate": round(self.success_rate, 3),
            "verified": self.verified,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "composed_from": self.composed_from,
            "status": self.status,
            "lifecycle_status": self.status,
            "trigger_context": self.trigger_context,
            "workflow": self.workflow,
            "required_capabilities": self.required_capabilities,
            "verification": self.verification,
            "rollback": self.rollback,
            "counter_examples": self.counter_examples,
            "source_event_ids": self.source_event_ids,
            "last_verified_at": self.last_verified_at,
            "retired_at": self.retired_at,
            "source": self.source,
            "tool_chain": self.tool_chain,
            "lifecycle_history": self.lifecycle_history[-20:],
            "family_id": self.family_id,
            "problem_fingerprint": self.problem_fingerprint,
            "evidence_origin": self.evidence_origin,
            "derivation_method": self.derivation_method,
            "environment_scope": self.environment_scope,
            "environment_fingerprint": self.environment_fingerprint,
            "strategies": self.strategies,
            "certifications": self.certifications,
            "evidence_summary": self.evidence_summary,
            "applicability_rules": self.applicability_rules,
            "selection_policy": self.selection_policy,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "SkillEntry":
        return cls(
            name=str(data.get("name") or ""),
            description=str(data.get("description") or ""),
            code=str(data.get("code") or ""),
            skill_id=str(data.get("skill_id") or ""),
            language=str(data.get("language") or "python"),
            dependencies=list(data.get("dependencies") or []),
            tags=list(data.get("tags") or []),
            examples=list(data.get("examples") or []),
            use_count=int(data.get("use_count") or 0),
            success_count=int(data.get("success_count") or 0),
            fail_count=int(data.get("fail_count") or 0),
            verified=bool(data.get("verified", False)),
            created_at=str(data.get("created_at") or ""),
            updated_at=str(data.get("updated_at") or ""),
            composed_from=list(data.get("composed_from") or []),
            status=str(data.get("status") or ""),
            lifecycle_status=str(data.get("lifecycle_status") or ""),
            trigger_context=str(data.get("trigger_context") or ""),
            workflow=_as_list(data.get("workflow")),
            required_capabilities=_as_list(data.get("required_capabilities")),
            verification=_as_dict(data.get("verification")),
            rollback=str(data.get("rollback") or ""),
            counter_examples=_as_list(data.get("counter_examples")),
            source_event_ids=_as_list(data.get("source_event_ids")),
            last_verified_at=str(data.get("last_verified_at") or ""),
            retired_at=str(data.get("retired_at") or ""),
            source=str(data.get("source") or ""),
            tool_chain=_as_list(data.get("tool_chain")),
            lifecycle_history=[
                item for item in _as_list(data.get("lifecycle_history")) if isinstance(item, dict)
            ],
            family_id=str(data.get("family_id") or ""),
            problem_fingerprint=str(data.get("problem_fingerprint") or ""),
            evidence_origin=str(data.get("evidence_origin") or ""),
            derivation_method=str(data.get("derivation_method") or ""),
            environment_scope=str(data.get("environment_scope") or ""),
            environment_fingerprint=str(data.get("environment_fingerprint") or ""),
            strategies=[item for item in _as_list(data.get("strategies")) if isinstance(item, dict)],
            certifications=[item for item in _as_list(data.get("certifications")) if isinstance(item, dict)],
            evidence_summary=_as_dict(data.get("evidence_summary")),
            applicability_rules=_as_dict(data.get("applicability_rules")),
            selection_policy=_as_dict(data.get("selection_policy")),
        )


class SkillLibrary:
    """Self-growing skill library with retrieval by description."""

    def __init__(self, workspace_dir: str):
        self.workspace_dir = Path(workspace_dir).expanduser()
        self.skills_dir = self.workspace_dir / ".agent" / "skill_library"
        self.skills_dir.mkdir(parents=True, exist_ok=True)
        self.index_file = self.skills_dir / "index.json"
        self._skills: Dict[str, SkillEntry] = {}
        self._loaded = False

    def _load(self) -> None:
        if self._loaded:
            return
        try:
            if self.index_file.exists():
                data = json.loads(self.index_file.read_text(encoding="utf-8"))
                for item in data:
                    if isinstance(item, dict):
                        entry = SkillEntry.from_dict(item)
                        self._skills[entry.skill_id] = entry
        except Exception:
            pass
        self._loaded = True

    def _save(self) -> None:
        data = [s.to_dict() for s in self._skills.values()]
        self.index_file.write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    def add(
        self,
        name: str,
        description: str,
        code: str = "",
        **kwargs,
    ) -> SkillEntry:
        self._load()
        entry = SkillEntry(name=name, description=description, code=code, **kwargs)
        existing = self._skills.get(entry.skill_id)
        if existing:
            existing.description = description
            existing.code = code
            existing.updated_at = datetime.now().isoformat()
            for k, v in kwargs.items():
                if not hasattr(existing, k) or v in (None, ""):
                    continue
                if k == "strategies":
                    for strategy in normalize_strategies(v):
                        existing.upsert_strategy(strategy)
                elif k == "certifications":
                    existing.certifications = normalize_certifications(v)
                elif k == "evidence_summary":
                    existing.evidence_summary = normalize_evidence_summary(v)
                elif k == "evidence_origin":
                    existing.evidence_origin = normalize_evidence_origin(v)
                elif k == "derivation_method":
                    existing.derivation_method = normalize_derivation_method(v, existing.evidence_origin)
                elif k == "environment_scope":
                    existing.environment_scope = normalize_environment_scope(v)
                else:
                    setattr(existing, k, v)
            self._save()
            return existing
        self._skills[entry.skill_id] = entry
        self._save()
        return entry

    def get(self, skill_id: str) -> Optional[SkillEntry]:
        self._load()
        return self._skills.get(skill_id)

    def search(self, query: str, top_k: int = 5) -> List[SkillEntry]:
        self._load()
        query_lower = query.lower()
        query_words = set(query_lower.split())
        scored = []
        for skill in self._skills.values():
            if skill.status == "retired":
                continue
            text = f"{skill.name} {skill.description} {' '.join(skill.tags)}".lower()
            word_matches = sum(1 for w in query_words if w in text)
            if word_matches > 0:
                lifecycle_bonus = {
                    "active": 0.3,
                    "verified": 0.2,
                    "candidate": -0.05,
                    "deprecated": -0.5,
                }.get(skill.status, 0)
                score = word_matches + (skill.success_rate * 0.5) + (0.1 if skill.verified else 0) + lifecycle_bonus
                if score <= 0:
                    continue
                scored.append((score, skill))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [s for _, s in scored[:top_k]]

    def record_use(
        self,
        skill_id: str,
        success: bool,
        *,
        environment_scope: str = "",
        environment_fingerprint: str = "",
        evidence_origin: str = "",
        strategy_id: str = "",
        source_event_id: str = "",
    ) -> Optional[SkillEntry]:
        """记录一次技能使用，并在给定环境时保存可审计证据。"""

        self._load()
        skill = self._skills.get(skill_id)
        if skill:
            skill.record_use(
                success,
                environment_scope=environment_scope,
                environment_fingerprint=environment_fingerprint,
                evidence_origin=evidence_origin,
                strategy_id=strategy_id,
                source_event_id=source_event_id,
            )
            self._save()
        return skill

    def select_for_context(
        self,
        query: str,
        *,
        environment_scope: str = PRODUCTION_SCOPE,
        environment_fingerprint: str = "",
        available_capabilities: List[str] = None,
        top_k: int = 5,
    ) -> Dict[str, Any]:
        """通过召回、符号门控和证据排序为目标环境选择 Skill 与策略。"""

        self._load()
        scope = normalize_environment_scope(environment_scope, PRODUCTION_SCOPE)
        capabilities = set(normalize_string_list(available_capabilities))
        query_text = str(query or "").strip().lower()
        query_words = {item for item in query_text.split() if item}
        accepted: List[Dict[str, Any]] = []
        rejected: List[Dict[str, Any]] = []

        for skill in self._skills.values():
            if skill.status in {"retired", "deprecated"}:
                rejected.append({"skill_id": skill.skill_id, "reason": f"lifecycle_{skill.status}"})
                continue
            searchable = " ".join([
                skill.name,
                skill.description,
                skill.trigger_context,
                " ".join(str(item) for item in skill.tags),
            ]).lower()
            word_matches = sum(1 for word in query_words if word in searchable)
            exact_bonus = 1.0 if query_text and query_text in searchable else 0.0
            retrieval_score = float(word_matches) + exact_bonus
            if query_text and retrieval_score <= 0:
                continue

            missing = [item for item in skill.required_capabilities if item not in capabilities]
            if capabilities and missing:
                rejected.append({
                    "skill_id": skill.skill_id,
                    "reason": "missing_capabilities",
                    "missing": missing,
                })
                continue
            if not skill.is_certified_for(scope, environment_fingerprint):
                rejected.append({
                    "skill_id": skill.skill_id,
                    "reason": "scope_not_certified",
                    "scope": scope,
                })
                continue

            strategy = skill.best_strategy(scope)
            strategy_score = float(strategy.get("utility") or 0.0) if strategy else 0.0
            certification = skill.get_certification(scope)
            lifecycle_bonus = 0.3 if skill.status == "active" else 0.15
            certification_bonus = 0.2 if certification and certification.get("status") == "active" else 0.1
            accepted.append({
                "skill_id": skill.skill_id,
                "family_id": skill.family_id,
                "name": skill.name,
                "environment_scope": scope,
                "score": round(retrieval_score + strategy_score + lifecycle_bonus + certification_bonus, 6),
                "strategy": strategy,
                "certification": certification,
            })

        accepted.sort(key=lambda item: item["score"], reverse=True)
        limit = max(1, min(int(top_k or 5), 50))
        return {
            "query": query,
            "environment_scope": scope,
            "selected": accepted[:limit],
            "rejected": rejected[:100],
            "abstained": not accepted,
        }

    def mark_verified(self, skill_id: str) -> Optional[SkillEntry]:
        return self.transition(skill_id, "verified", reason="mark_verified")

    def transition(
        self,
        skill_id: str,
        status: str,
        *,
        reason: str = "",
        actor: str = "system",
    ) -> Optional[SkillEntry]:
        self._load()
        skill = self._skills.get(skill_id)
        if skill:
            skill.set_status(status, reason=reason, actor=actor)
            self._save()
        return skill

    def mark_active(self, skill_id: str, *, reason: str = "activate") -> Optional[SkillEntry]:
        return self.transition(skill_id, "active", reason=reason)

    def mark_deprecated(self, skill_id: str, *, reason: str = "deprecate") -> Optional[SkillEntry]:
        return self.transition(skill_id, "deprecated", reason=reason)

    def mark_retired(self, skill_id: str, *, reason: str = "retire") -> Optional[SkillEntry]:
        return self.transition(skill_id, "retired", reason=reason)

    def compose(
        self, name: str, description: str, skill_ids: List[str], code: str = ""
    ) -> Optional[SkillEntry]:
        self._load()
        valid_ids = [sid for sid in skill_ids if sid in self._skills]
        if not valid_ids:
            return None
        return self.add(
            name=name,
            description=description,
            code=code,
            composed_from=valid_ids,
            tags=["composite"],
        )

    def remove(self, skill_id: str) -> bool:
        self._load()
        if skill_id in self._skills:
            del self._skills[skill_id]
            self._save()
            return True
        return False

    def list_all(self, sort_by: str = "use_count") -> List[SkillEntry]:
        self._load()
        skills = list(self._skills.values())
        if sort_by == "use_count":
            skills.sort(key=lambda s: s.use_count, reverse=True)
        elif sort_by == "success_rate":
            skills.sort(key=lambda s: s.success_rate, reverse=True)
        elif sort_by == "created_at":
            skills.sort(key=lambda s: s.created_at, reverse=True)
        return skills

    def list_by_status(self, status: str) -> List[SkillEntry]:
        normalized = str(status or "").strip().lower()
        return [skill for skill in self.list_all() if skill.status == normalized]

    def get_stats(self) -> Dict[str, Any]:
        self._load()
        skills = list(self._skills.values())
        if not skills:
            return {
                "total": 0,
                "families": 0,
                "verified": 0,
                "composite": 0,
                "total_uses": 0,
                "lifecycle": {state: 0 for state in sorted(SKILL_LIFECYCLE_STATES)},
                "certifications": {},
            }
        lifecycle_counts = {state: 0 for state in sorted(SKILL_LIFECYCLE_STATES)}
        certification_counts: Dict[str, Dict[str, int]] = {}
        for skill in skills:
            lifecycle_counts[skill.status] = lifecycle_counts.get(skill.status, 0) + 1
            for certification in skill.certifications:
                scope = str(certification.get("scope") or "legacy")
                status = str(certification.get("status") or "uncertified")
                certification_counts.setdefault(scope, {})[status] = (
                    certification_counts.setdefault(scope, {}).get(status, 0) + 1
                )
        return {
            "total": len(skills),
            "families": len({skill.family_id for skill in skills}),
            "verified": sum(1 for s in skills if s.verified),
            "composite": sum(1 for s in skills if s.composed_from),
            "total_uses": sum(s.use_count for s in skills),
            "avg_success_rate": round(
                sum(s.success_rate for s in skills) / len(skills), 3
            ),
            "languages": list(set(s.language for s in skills)),
            "lifecycle": lifecycle_counts,
            "certifications": certification_counts,
        }

    def export_for_context(self, query: str = "", top_k: int = 5) -> str:
        if query:
            skills = self.search(query, top_k=top_k)
        else:
            skills = self.list_all()[:top_k]
        if not skills:
            return ""
        lines = []
        for s in skills:
            line = f"- {s.name}: {s.description}"
            if s.verified:
                line += " [verified]"
            if s.status:
                line += f" [{s.status}]"
            lines.append(line)
        return "Available skills:\n" + "\n".join(lines)


_libraries: Dict[str, SkillLibrary] = {}


def get_skill_library(workspace_dir: str) -> SkillLibrary:
    normalized = str(Path(workspace_dir).expanduser().resolve())
    if normalized not in _libraries:
        _libraries[normalized] = SkillLibrary(workspace_dir)
    return _libraries[normalized]
