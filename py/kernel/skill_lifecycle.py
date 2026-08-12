#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""OpenXnet Skill Engineering v2 结晶、认证和离线治理生命周期。"""

from __future__ import annotations

import json
import re
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from py.kernel.audit import get_kernel_audit, sanitize_payload
from py.kernel.skill_engineering import (
    PRODUCTION_SCOPE,
    normalize_derivation_method,
    normalize_environment_scope,
    normalize_evidence_origin,
    normalize_evidence_summary,
    normalize_string_list,
    stable_digest,
    target_certification_state,
    utc_now,
)
from py.skill_library import SKILL_LIFECYCLE_STATES, SkillEntry, get_skill_library


LIFECYCLE_ORDER = ["candidate", "verified", "active", "deprecated", "retired"]


def _now() -> str:
    return datetime.now().isoformat()


def _slug(value: str, fallback: str = "skill") -> str:
    slug = re.sub(r"[^a-z0-9\u4e00-\u9fff_-]+", "-", str(value or "").strip().lower())
    slug = re.sub(r"-{2,}", "-", slug).strip("-_")
    return (slug or fallback)[:72].strip("-_") or fallback


def _as_lines(value: Any, fallback: str = "") -> List[str]:
    if isinstance(value, list):
        lines = [str(item).strip() for item in value if str(item).strip()]
    else:
        lines = [
            line.strip().lstrip("-*0123456789. )").strip()
            for line in str(value or "").replace("\r\n", "\n").replace("\r", "\n").split("\n")
            if line.strip()
        ]
    if not lines and fallback:
        lines = [fallback]
    return lines


def _normalize_tools(tools_used: List[Any]) -> List[str]:
    tools: List[str] = []
    for item in tools_used or []:
        if isinstance(item, dict):
            name = item.get("tool_name") or item.get("name") or item.get("function")
        else:
            name = item
        cleaned = str(name or "").strip()
        if cleaned and cleaned not in tools:
            tools.append(cleaned)
    return tools


class SkillLifecycle:
    """State machine: candidate -> verified -> active -> deprecated -> retired."""

    CANDIDATE_MIN_TRACES = 3
    CANDIDATE_MIN_SUCCESS_RATE = 0.7
    VERIFY_MIN_USES = 3
    VERIFY_MIN_SUCCESS_RATE = 0.7
    ACTIVE_MIN_USES = 4
    ACTIVE_MIN_SUCCESS_RATE = 0.8
    DEPRECATE_MIN_USES = 5
    DEPRECATE_MAX_SUCCESS_RATE = 0.5
    RETIRE_MIN_USES = 8
    RETIRE_MAX_SUCCESS_RATE = 0.35
    MAX_CANDIDATE_FAMILIES = 500

    def __init__(self, workspace_dir: str):
        self.workspace_dir = Path(workspace_dir or ".").expanduser().resolve()
        self.lifecycle_dir = self.workspace_dir / ".agent" / "skill_lifecycle"
        self.lifecycle_dir.mkdir(parents=True, exist_ok=True)
        self.patterns_file = self.lifecycle_dir / "patterns.json"
        self.events_file = self.lifecycle_dir / "events.jsonl"
        self.evidence_file = self.lifecycle_dir / "evidence.jsonl"
        self.proposals_file = self.lifecycle_dir / "change_proposals.json"

    @property
    def library(self):
        return get_skill_library(str(self.workspace_dir))

    def _audit(self, event_type: str, payload: Dict[str, Any]) -> None:
        compact = sanitize_payload(payload)
        try:
            get_kernel_audit(str(self.workspace_dir)).append(
                event_type,
                compact,
                actor="kernel",
                workspace_dir=str(self.workspace_dir),
            )
        except Exception:
            pass
        try:
            with open(self.events_file, "a", encoding="utf-8") as f:
                f.write(json.dumps({"timestamp": _now(), "event_type": event_type, **compact}, ensure_ascii=False) + "\n")
        except Exception:
            pass

    def _load_patterns(self) -> Dict[str, Dict[str, Any]]:
        try:
            if self.patterns_file.exists():
                data = json.loads(self.patterns_file.read_text(encoding="utf-8"))
                if isinstance(data, dict):
                    return {str(k): v for k, v in data.items() if isinstance(v, dict)}
        except Exception:
            pass
        return {}

    def _save_patterns(self, patterns: Dict[str, Dict[str, Any]]) -> None:
        self.patterns_file.write_text(
            json.dumps(patterns, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def _family_id(
        self,
        problem_fingerprint: str,
        input_text: str,
        verification_oracle: str,
    ) -> str:
        """根据问题指纹和验证契约生成稳定 Skill Family ID。"""

        anchor = str(problem_fingerprint or input_text or verification_oracle or "unknown-problem").strip()
        return f"family-{stable_digest(anchor, verification_oracle, length=20)}"

    def _strategy_id(self, tools: List[str], strategy: str = "", explicit_id: str = "") -> str:
        """根据策略描述和工具链生成稳定策略 ID，显式 ID 优先。"""

        if str(explicit_id or "").strip():
            return _slug(explicit_id, "strategy")
        return f"strategy-{stable_digest(strategy or 'direct', tools, length=16)}"

    def _pattern_id(self, family_id: str, strategy_id: str) -> str:
        """生成 Family 内策略模式 ID，避免同一问题的多种方案膨胀成多个 Skill。"""

        return stable_digest(family_id, strategy_id, length=16)

    def _find_skill_by_pattern(
        self,
        pattern_id: str,
        tools: List[str],
        family_id: str = "",
    ) -> Optional[SkillEntry]:
        """优先按 Family 查找 Skill，并兼容旧版模式与工具链匹配。"""

        chain = " -> ".join(tools)
        if family_id:
            for skill in self.library.list_all(sort_by="created_at"):
                if skill.status != "retired" and skill.family_id == family_id:
                    return skill
            return None
        for skill in self.library.list_all(sort_by="created_at"):
            if skill.status == "retired":
                continue
            if pattern_id in skill.source_event_ids:
                return skill
            if skill.tool_chain == tools:
                return skill
            if chain and chain.lower() in f"{skill.name} {skill.description}".lower():
                return skill
        return None

    def _append_evidence(self, evidence: Dict[str, Any]) -> None:
        """把一条有界证据记录追加到 UTF-8 JSONL 账本。"""

        compact = sanitize_payload(evidence)
        with open(self.evidence_file, "a", encoding="utf-8") as handle:
            handle.write(json.dumps(compact, ensure_ascii=False) + "\n")

    def _load_proposals(self) -> List[Dict[str, Any]]:
        """读取离线巩固生成的变更提案，损坏文件按空列表处理。"""

        try:
            if self.proposals_file.exists():
                data = json.loads(self.proposals_file.read_text(encoding="utf-8"))
                if isinstance(data, list):
                    return [item for item in data if isinstance(item, dict)]
        except Exception:
            pass
        return []

    def _save_proposals(self, proposals: List[Dict[str, Any]]) -> None:
        """以 UTF-8 JSON 保存最近的有界变更提案。"""

        self.proposals_file.write_text(
            json.dumps(proposals[-500:], ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def list_change_proposals(self, status: str = "", limit: int = 100) -> List[Dict[str, Any]]:
        """列出离线巩固提案，可按 pending、approved 或 rejected 过滤。"""

        normalized = str(status or "").strip().lower()
        proposals = self._load_proposals()
        if normalized:
            proposals = [item for item in proposals if item.get("status") == normalized]
        proposals.sort(key=lambda item: str(item.get("created_at") or ""), reverse=True)
        return proposals[: max(1, min(int(limit or 100), 500))]

    def _candidate_name(self, tools: List[str], strategy: str = "") -> str:
        label = strategy if strategy and strategy != "direct" else "tool-chain"
        tail = "-".join(_slug(tool, "tool") for tool in tools[:3])
        return f"auto:{label}:{tail}"[:96]

    def _build_workflow(self, tools: List[str], task_result: Dict[str, Any]) -> List[str]:
        provided = _as_lines(task_result.get("workflow"))
        if provided:
            return provided
        chain = " -> ".join(tools) or "available tools"
        return [
            "Confirm the current task matches the trigger context and constraints.",
            f"Reuse the proven tool or reasoning chain: {chain}.",
            "Run the smallest verification step that proves the output is usable.",
            "Record success or failure so the lifecycle can promote or deprecate the skill.",
        ]

    def _entry_to_skill_markdown(self, skill: SkillEntry) -> str:
        name = skill.name or skill.skill_id
        description = skill.description or skill.trigger_context or "A lifecycle-managed OpenXnet skill."
        trigger_lines = _as_lines(skill.trigger_context, description)
        workflow_lines = _as_lines(skill.workflow, "Apply the stored workflow, then verify the result.")
        capability_lines = _as_lines(skill.required_capabilities, "Use only the tools required by the workflow.")
        verification_lines = _as_lines(
            skill.verification.get("checks") if isinstance(skill.verification, dict) else "",
            "Verify the result before reporting completion.",
        )
        rollback_lines = _as_lines(skill.rollback, "If the workflow no longer applies, stop using the skill and record a failed use.")
        counter_lines = _as_lines(skill.counter_examples, "Do not force this skill when the task context diverges from the trigger.")
        strategy_lines = [
            f"{item.get('strategy_id')}: {item.get('name') or item.get('description') or 'strategy variant'}"
            for item in skill.strategies
        ] or ["default: Apply the verified workflow above."]
        certification_lines = [
            f"{item.get('scope')}: {item.get('status')}"
            for item in skill.certifications
        ] or ["legacy: lifecycle-managed compatibility record"]
        frontmatter = {
            "name": name,
            "description": description,
            "version": "1.0.0",
            "source": f"OpenXnet skill lifecycle ({skill.source or 'kernel'})",
            "lifecycle_status": skill.status,
            "skill_id": skill.skill_id,
            "family_id": skill.family_id,
            "evidence_origin": skill.evidence_origin,
            "derivation_method": skill.derivation_method,
            "last_verified_at": skill.last_verified_at,
        }
        yaml_lines = ["---"]
        for key, value in frontmatter.items():
            if value:
                yaml_lines.append(f"{key}: {json.dumps(str(value), ensure_ascii=False)}")
        yaml_lines.append("---")
        return "\n".join([
            *yaml_lines,
            "",
            f"# {name}",
            "",
            "Use this skill when the current task matches the lifecycle-managed pattern below.",
            "",
            "## When To Use",
            "",
            *[f"- {line}" for line in trigger_lines],
            "",
            "## Workflow",
            "",
            *[f"{idx}. {line}" for idx, line in enumerate(workflow_lines, start=1)],
            "",
            "## Required Capabilities",
            "",
            *[f"- {line}" for line in capability_lines],
            "",
            "## Verification",
            "",
            *[f"- {line}" for line in verification_lines],
            "",
            "## Rollback",
            "",
            *[f"- {line}" for line in rollback_lines],
            "",
            "## Counter Examples",
            "",
            *[f"- {line}" for line in counter_lines],
            "",
            "## Strategy Variants",
            "",
            *[f"- {line}" for line in strategy_lines],
            "",
            "## Certification Scope",
            "",
            *[f"- {line}" for line in certification_lines],
            "",
        ])

    def sync_agent_skill(self, skill: SkillEntry, *, overwrite: bool = True) -> Dict[str, Any]:
        """同步生产可用 Skill；模拟或未认证 Skill 必须停留在证据库。"""

        if skill.status not in {"verified", "active"}:
            return {"synced": False, "reason": "not_verified_or_active", "skill_id": skill.skill_id}
        if skill.certifications and not skill.is_certified_for(PRODUCTION_SCOPE):
            return {
                "synced": False,
                "reason": "production_scope_not_certified",
                "skill_id": skill.skill_id,
            }
        if skill.evidence_origin == "rehearsal" and not skill.is_certified_for(PRODUCTION_SCOPE):
            return {
                "synced": False,
                "reason": "rehearsal_skill_requires_production_certification",
                "skill_id": skill.skill_id,
            }
        target = self.workspace_dir / ".agent" / "skills" / _slug(skill.skill_id, "skill")
        if target.exists() and not overwrite:
            return {"synced": False, "reason": "exists", "path": str(target)}
        target.mkdir(parents=True, exist_ok=True)
        (target / "SKILL.md").write_text(self._entry_to_skill_markdown(skill), encoding="utf-8")
        result = {"synced": True, "skill_id": skill.skill_id, "path": str(target)}
        self._audit("skill.agent_package_synced", result)
        return result

    def remove_agent_skill(self, skill: SkillEntry) -> Dict[str, Any]:
        """从 Agent 工作区移除已降级或退役 Skill，库内证据和审计记录保持不变。"""

        target = self.workspace_dir / ".agent" / "skills" / _slug(skill.skill_id, "skill")
        if not target.exists():
            return {"removed": False, "reason": "not_installed", "skill_id": skill.skill_id}
        if not target.is_dir() or target.is_symlink():
            return {"removed": False, "reason": "invalid_target", "skill_id": skill.skill_id}
        shutil.rmtree(target)
        result = {"removed": True, "skill_id": skill.skill_id, "path": str(target)}
        self._audit("skill.agent_package_removed", result)
        return result

    def _aggregate_family_patterns(
        self,
        patterns: Dict[str, Dict[str, Any]],
        family_id: str,
    ) -> Dict[str, Any]:
        """聚合同一 Family 的策略模式、分环境证据和来源事件。"""

        family_patterns = [
            item for item in patterns.values()
            if isinstance(item, dict) and item.get("family_id") == family_id
        ]
        aggregate: Dict[str, Any] = {
            "attempts": 0,
            "successes": 0,
            "failures": 0,
            "source_event_ids": [],
            "evidence_summary": {},
            "strategies": [],
        }
        for pattern in family_patterns:
            aggregate["attempts"] += int(pattern.get("attempts") or 0)
            aggregate["successes"] += int(pattern.get("successes") or 0)
            aggregate["failures"] += int(pattern.get("failures") or 0)
            aggregate["source_event_ids"] = normalize_string_list([
                *aggregate["source_event_ids"],
                *(pattern.get("source_event_ids") or []),
            ])[-200:]
            pattern_evidence = normalize_evidence_summary(pattern.get("evidence_by_scope"))
            for scope, bucket in pattern_evidence.items():
                target = aggregate["evidence_summary"].setdefault(scope, {
                    "attempts": 0,
                    "successes": 0,
                    "failures": 0,
                    "last_used_at": "",
                    "environment_fingerprints": [],
                    "source_event_ids": [],
                })
                target["attempts"] += int(bucket.get("attempts") or 0)
                target["successes"] += int(bucket.get("successes") or 0)
                target["failures"] += int(bucket.get("failures") or 0)
                target["last_used_at"] = max(
                    str(target.get("last_used_at") or ""),
                    str(bucket.get("last_used_at") or ""),
                )
                target["environment_fingerprints"] = normalize_string_list([
                    *target["environment_fingerprints"],
                    *(bucket.get("environment_fingerprints") or []),
                ])[-20:]
                target["source_event_ids"] = normalize_string_list([
                    *target["source_event_ids"],
                    *(bucket.get("source_event_ids") or []),
                ])[-200:]
            aggregate["strategies"].append({
                "strategy_id": pattern.get("strategy_id"),
                "name": pattern.get("strategy") or pattern.get("strategy_id"),
                "description": pattern.get("strategy_description") or "",
                "workflow": pattern.get("workflow") or [],
                "tool_chain": pattern.get("tool_chain") or [],
                "risk_level": pattern.get("risk_level") or "medium",
                "cost_score": pattern.get("cost_score") or 0.0,
                "evidence_summary": pattern_evidence,
                "source_event_ids": pattern.get("source_event_ids") or [],
            })
        return aggregate

    def _candidate_certifications(self, evidence_summary: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
        """根据现有证据范围创建 Candidate 认证，不执行任何自动晋级。"""

        certifications: List[Dict[str, Any]] = []
        for scope, bucket in normalize_evidence_summary(evidence_summary).items():
            fingerprints = bucket.get("environment_fingerprints") or []
            certifications.append({
                "scope": scope,
                "status": "candidate",
                "environment_fingerprint": fingerprints[0] if len(fingerprints) == 1 else "",
                "evidence_event_ids": bucket.get("source_event_ids") or [],
                "reason": "candidate_created_from_scoped_evidence",
                "actor": "skill_lifecycle",
                "updated_at": utc_now(),
            })
        return certifications

    async def on_task_completed(
        self,
        task_result: Dict[str, Any],
        tools_used: List[Any],
        *,
        input_text: str = "",
        source_event_ids: List[str] = None,
        source: str = "work",
        evidence_origin: str = "",
        derivation_method: str = "",
        environment_scope: str = "legacy",
        environment_fingerprint: str = "",
        problem_fingerprint: str = "",
        family_id: str = "",
        strategy_id: str = "",
        parent_event_id: str = "",
        mutation_rule: str = "",
        expected_invariant: str = "",
        verification_oracle: str = "",
    ) -> Dict[str, Any]:
        """记录一条可追溯任务证据，并在证据充分时创建或更新 Skill Family。"""

        result = task_result or {}
        success = bool(result.get("success", True))
        tools = _normalize_tools(tools_used)
        if len(tools) < 2:
            return {"ok": True, "created": False, "reason": "requires_multi_tool_pattern", "tools": tools}

        plan = result.get("plan", {}) if isinstance(result.get("plan"), dict) else {}
        strategy = str(result.get("strategy") or plan.get("strategy") or "").strip()
        oracle = str(
            verification_oracle
            or result.get("verification_oracle")
            or "\n".join(_as_lines(result.get("verification")))
        ).strip()
        resolved_problem = str(
            problem_fingerprint
            or result.get("problem_fingerprint")
            or input_text
            or result.get("trigger_context")
            or result.get("summary")
            or ""
        ).strip()
        resolved_family_id = str(family_id or result.get("family_id") or "").strip()
        if not resolved_family_id:
            resolved_family_id = self._family_id(resolved_problem, input_text, oracle)
        resolved_strategy_id = self._strategy_id(
            tools,
            strategy,
            strategy_id or str(result.get("strategy_id") or ""),
        )
        pattern_id = self._pattern_id(resolved_family_id, resolved_strategy_id)
        resolved_origin = normalize_evidence_origin(evidence_origin or source)
        resolved_derivation = normalize_derivation_method(derivation_method, resolved_origin)
        resolved_scope = normalize_environment_scope(environment_scope)
        resolved_fingerprint = str(environment_fingerprint or result.get("environment_fingerprint") or "").strip()[:256]
        event_ids = normalize_string_list(source_event_ids or result.get("source_event_ids"))
        event_id = event_ids[0] if event_ids else f"evidence-{stable_digest(pattern_id, _now(), length=20)}"
        patterns = self._load_patterns()
        pattern = patterns.get(pattern_id) or {
            "pattern_id": pattern_id,
            "family_id": resolved_family_id,
            "problem_fingerprint": resolved_problem,
            "tool_chain": tools,
            "strategy": strategy,
            "strategy_id": resolved_strategy_id,
            "strategy_description": str(result.get("strategy_description") or "").strip()[:1000],
            "workflow": self._build_workflow(tools, result),
            "risk_level": str(result.get("risk_level") or "medium").strip().lower(),
            "cost_score": result.get("cost_score") or 0.0,
            "attempts": 0,
            "successes": 0,
            "failures": 0,
            "source_event_ids": [],
            "evidence_by_scope": {},
            "first_seen_at": _now(),
            "last_seen_at": "",
            "skill_id": "",
        }
        pattern["attempts"] = int(pattern.get("attempts") or 0) + 1
        pattern["successes"] = int(pattern.get("successes") or 0) + (1 if success else 0)
        pattern["failures"] = int(pattern.get("failures") or 0) + (0 if success else 1)
        pattern["last_seen_at"] = _now()
        for source_event_id in [event_id, *event_ids]:
            if source_event_id and source_event_id not in pattern["source_event_ids"]:
                pattern["source_event_ids"].append(str(source_event_id))
        scope_bucket = pattern["evidence_by_scope"].setdefault(resolved_scope, {
            "attempts": 0,
            "successes": 0,
            "failures": 0,
            "last_used_at": "",
            "environment_fingerprints": [],
            "source_event_ids": [],
        })
        scope_bucket["attempts"] = int(scope_bucket.get("attempts") or 0) + 1
        scope_bucket["successes"] = int(scope_bucket.get("successes") or 0) + (1 if success else 0)
        scope_bucket["failures"] = int(scope_bucket.get("failures") or 0) + (0 if success else 1)
        scope_bucket["last_used_at"] = utc_now()
        if resolved_fingerprint and resolved_fingerprint not in scope_bucket["environment_fingerprints"]:
            scope_bucket["environment_fingerprints"].append(resolved_fingerprint)
        if event_id not in scope_bucket["source_event_ids"]:
            scope_bucket["source_event_ids"].append(event_id)
        patterns[pattern_id] = pattern
        self._save_patterns(patterns)
        self._audit("skill.lifecycle.pattern_recorded", pattern)

        evidence_record = {
            "timestamp": utc_now(),
            "event_id": event_id,
            "family_id": resolved_family_id,
            "pattern_id": pattern_id,
            "strategy_id": resolved_strategy_id,
            "success": success,
            "evidence_origin": resolved_origin,
            "derivation_method": resolved_derivation,
            "environment_scope": resolved_scope,
            "environment_fingerprint": resolved_fingerprint,
            "parent_event_id": str(parent_event_id or result.get("parent_event_id") or "").strip(),
            "mutation_rule": str(mutation_rule or result.get("mutation_rule") or "").strip(),
            "expected_invariant": str(expected_invariant or result.get("expected_invariant") or "").strip(),
            "verification_oracle": oracle,
            "tool_chain": tools,
        }
        try:
            self._append_evidence(evidence_record)
        except Exception:
            pass

        existing = self._find_skill_by_pattern(pattern_id, tools, resolved_family_id)
        if existing:
            existing.upsert_strategy({
                "strategy_id": resolved_strategy_id,
                "name": strategy or resolved_strategy_id,
                "description": pattern.get("strategy_description") or "",
                "workflow": pattern.get("workflow") or [],
                "tool_chain": tools,
                "risk_level": pattern.get("risk_level") or "medium",
                "cost_score": pattern.get("cost_score") or 0.0,
                "source_event_ids": [event_id],
            })
            self.library.record_use(
                existing.skill_id,
                success,
                environment_scope=resolved_scope,
                environment_fingerprint=resolved_fingerprint,
                evidence_origin=resolved_origin,
                strategy_id=resolved_strategy_id,
                source_event_id=event_id,
            )
            if not pattern.get("skill_id"):
                pattern["skill_id"] = existing.skill_id
                patterns[pattern_id] = pattern
                self._save_patterns(patterns)
            return {"ok": True, "created": False, "matched": existing.to_dict(), "pattern": pattern}

        aggregate = self._aggregate_family_patterns(patterns, resolved_family_id)
        attempts = int(aggregate.get("attempts") or 0)
        rate = (int(aggregate.get("successes") or 0) / attempts) if attempts else 0.0
        if attempts < self.CANDIDATE_MIN_TRACES or rate < self.CANDIDATE_MIN_SUCCESS_RATE:
            return {
                "ok": True,
                "created": False,
                "reason": "insufficient_trace_evidence",
                "pattern": {**pattern, "success_rate": round(rate, 3)},
                "family": aggregate,
            }

        summary = str(result.get("summary") or result.get("description") or input_text or "").strip()
        candidate_families = {
            skill.family_id
            for skill in self.library.list_by_status("candidate")
        }
        if len(candidate_families) >= self.MAX_CANDIDATE_FAMILIES:
            return {
                "ok": True,
                "created": False,
                "reason": "candidate_family_budget_exhausted",
                "candidate_family_count": len(candidate_families),
                "family_id": resolved_family_id,
            }
        name = self._candidate_name(tools, strategy)
        skill_id = f"candidate-{resolved_family_id.replace('family-', '')}"
        entry = self.library.add(
            name=name,
            description=summary[:240] or f"Candidate workflow for {' -> '.join(tools)}",
            skill_id=skill_id,
            tags=["candidate", "auto", resolved_origin],
            status="candidate",
            source=resolved_origin,
            trigger_context="\n".join(_as_lines(result.get("trigger_context"), input_text or summary)),
            workflow=self._build_workflow(tools, result),
            required_capabilities=tools,
            verification={
                "checks": _as_lines(result.get("verification"), "Replay on a similar task and verify the observable result."),
                "min_traces": self.CANDIDATE_MIN_TRACES,
                "observed_success_rate": round(rate, 3),
            },
            rollback=str(result.get("rollback") or "Deprecate this skill if repeated use fails or the tool chain becomes unsafe."),
            counter_examples=_as_lines(result.get("counter_examples"), "Do not use when the requested task does not need this tool chain."),
            source_event_ids=[pattern_id, *(aggregate.get("source_event_ids") or [])],
            tool_chain=tools,
            use_count=attempts,
            success_count=int(aggregate.get("successes") or 0),
            fail_count=int(aggregate.get("failures") or 0),
            family_id=resolved_family_id,
            problem_fingerprint=resolved_problem,
            evidence_origin=resolved_origin,
            derivation_method=resolved_derivation,
            environment_scope=resolved_scope,
            environment_fingerprint=resolved_fingerprint,
            strategies=aggregate.get("strategies") or [],
            certifications=self._candidate_certifications(aggregate.get("evidence_summary") or {}),
            evidence_summary=aggregate.get("evidence_summary") or {},
            applicability_rules={
                "required_capabilities": tools,
                "verification_oracle": oracle,
                "counter_examples": _as_lines(result.get("counter_examples")),
            },
            selection_policy={
                "mode": "neuro_symbolic_gate",
                "abstain_on_scope_mismatch": True,
                "require_preflight_probe": True,
            },
        )
        self.library._skills[entry.skill_id] = entry
        self.library._save()
        pattern["skill_id"] = entry.skill_id
        patterns[pattern_id] = pattern
        self._save_patterns(patterns)
        payload = {
            "skill_id": entry.skill_id,
            "family_id": resolved_family_id,
            "pattern": pattern,
            "skill": entry.to_dict(),
        }
        self._audit("skill.candidate_created", payload)
        return {"ok": True, "created": True, **payload}

    def transition(
        self,
        skill_id: str,
        status: str,
        *,
        reason: str = "",
        actor: str = "kernel",
        sync: bool = True,
    ) -> Dict[str, Any]:
        normalized = str(status or "").strip().lower()
        if normalized not in SKILL_LIFECYCLE_STATES:
            return {"ok": False, "reason": "unsupported_lifecycle_status", "status": status}
        skill = self.library.transition(skill_id, normalized, reason=reason, actor=actor)
        if not skill:
            return {"ok": False, "reason": "skill_not_found", "skill_id": skill_id}
        if normalized in {"deprecated", "retired"}:
            sync_result = self.remove_agent_skill(skill)
        else:
            sync_result = self.sync_agent_skill(skill) if sync and normalized in {"verified", "active"} else {}
        event_type = f"skill.{normalized}"
        payload = {"skill_id": skill.skill_id, "status": normalized, "reason": reason, "sync": sync_result}
        self._audit(event_type, payload)
        return {"ok": True, "skill": skill.to_dict(), "sync": sync_result}

    def _next_certification_transition(self, current: str, target: str) -> str:
        """把统计目标转换成单步状态迁移，防止一次睡眠跨越多个认证门槛。"""

        if target in {"deprecated", "retired"}:
            return target
        if current == "candidate" and target in {"verified", "active"}:
            return "verified"
        if current == "verified" and target == "active":
            return "active"
        return ""

    def propose_lifecycle_changes(self) -> Dict[str, Any]:
        """根据分环境证据生成待审批提案，不直接晋级、同步或发布 Skill。"""

        proposals = self._load_proposals()
        pending_keys = {
            (
                str(item.get("skill_id") or ""),
                str(item.get("environment_scope") or ""),
                str(item.get("to_status") or ""),
            )
            for item in proposals
            if item.get("status") == "pending"
        }
        created: List[Dict[str, Any]] = []
        for skill in self.library.list_all(sort_by="success_rate"):
            if skill.status == "retired":
                continue
            for scope, bucket in normalize_evidence_summary(skill.evidence_summary).items():
                certification = skill.get_certification(scope) or {"status": "candidate"}
                current = str(certification.get("status") or "candidate")
                statistical_target = target_certification_state(
                    int(bucket.get("attempts") or 0),
                    int(bucket.get("successes") or 0),
                    int(bucket.get("failures") or 0),
                )
                target = self._next_certification_transition(current, statistical_target)
                if not target or target == current:
                    continue
                key = (skill.skill_id, scope, target)
                if key in pending_keys:
                    continue
                event_ids = normalize_string_list(bucket.get("source_event_ids"))
                fingerprints = normalize_string_list(bucket.get("environment_fingerprints"))
                proposal = {
                    "proposal_id": f"proposal-{stable_digest(*key, length=20)}",
                    "proposal_type": "certification_transition",
                    "status": "pending",
                    "skill_id": skill.skill_id,
                    "family_id": skill.family_id,
                    "environment_scope": scope,
                    "environment_fingerprint": fingerprints[0] if len(fingerprints) == 1 else "",
                    "from_status": current,
                    "to_status": target,
                    "statistical_target": statistical_target,
                    "evidence": {
                        "attempts": int(bucket.get("attempts") or 0),
                        "successes": int(bucket.get("successes") or 0),
                        "failures": int(bucket.get("failures") or 0),
                        "source_event_ids": event_ids,
                    },
                    "production_effect": scope == PRODUCTION_SCOPE,
                    "created_at": utc_now(),
                    "resolved_at": "",
                    "resolved_by": "",
                    "resolution_reason": "",
                }
                proposals.append(proposal)
                created.append(proposal)
                pending_keys.add(key)
        self._save_proposals(proposals)
        payload = {
            "ok": True,
            "applied": False,
            "proposals": created,
            "pending_count": len([item for item in proposals if item.get("status") == "pending"]),
        }
        self._audit("skill.lifecycle.proposals_created", payload)
        return payload

    def resolve_change_proposal(
        self,
        proposal_id: str,
        *,
        approved: bool,
        actor: str,
        reason: str = "",
    ) -> Dict[str, Any]:
        """审批或拒绝一个变更提案；只有生产认证通过后才允许同步工作区。"""

        proposals = self._load_proposals()
        proposal = next((item for item in proposals if item.get("proposal_id") == proposal_id), None)
        if not proposal:
            return {"ok": False, "reason": "proposal_not_found", "proposal_id": proposal_id}
        if proposal.get("status") != "pending":
            return {"ok": False, "reason": "proposal_already_resolved", "proposal": proposal}

        proposal["status"] = "approved" if approved else "rejected"
        proposal["resolved_at"] = utc_now()
        proposal["resolved_by"] = str(actor or "user").strip()[:120]
        proposal["resolution_reason"] = str(reason or "").strip()[:500]
        transition_result: Dict[str, Any] = {}

        if approved:
            skill = self.library.get(str(proposal.get("skill_id") or ""))
            if not skill:
                return {"ok": False, "reason": "skill_not_found", "proposal": proposal}
            evidence = proposal.get("evidence") if isinstance(proposal.get("evidence"), dict) else {}
            skill.set_certification(
                str(proposal.get("environment_scope") or "legacy"),
                str(proposal.get("to_status") or "candidate"),
                environment_fingerprint=str(proposal.get("environment_fingerprint") or ""),
                evidence_event_ids=normalize_string_list(evidence.get("source_event_ids")),
                reason=proposal["resolution_reason"] or "approved_offline_consolidation_proposal",
                actor=proposal["resolved_by"],
            )
            self.library._save()
            if proposal.get("environment_scope") == PRODUCTION_SCOPE:
                target = str(proposal.get("to_status") or "")
                if target in SKILL_LIFECYCLE_STATES:
                    transition_result = self.transition(
                        skill.skill_id,
                        target,
                        reason=proposal["resolution_reason"] or "production_certification_approved",
                        actor=proposal["resolved_by"],
                        sync=target in {"verified", "active"},
                    )
        self._save_proposals(proposals)
        payload = {
            "ok": True,
            "proposal": proposal,
            "transition": transition_result,
        }
        self._audit("skill.lifecycle.proposal_resolved", payload)
        return payload

    async def promote_candidates(self) -> Dict[str, Any]:
        """兼容旧调用名称，仅生成提案并明确不执行自动迁移。"""

        result = self.propose_lifecycle_changes()
        return {
            **result,
            "transitions": [],
            "summary": self.summary(),
        }

    async def run_sleep_cycle(self) -> Dict[str, Any]:
        """运行离线技能巩固周期，只生成有界且可审计的变更提案。"""

        result = await self.promote_candidates()
        self._audit("skill.lifecycle.sleep_cycle", result)
        return result

    def record_skill_use(
        self,
        skill_id: str,
        success: bool,
        *,
        reason: str = "runtime_use",
        environment_scope: str = "legacy",
        environment_fingerprint: str = "",
        evidence_origin: str = "work",
        strategy_id: str = "",
        source_event_id: str = "",
    ) -> Dict[str, Any]:
        """记录运行时使用证据；环境范围缺失时按 legacy 处理而不是生产。"""

        skill = self.library.record_use(
            skill_id,
            success,
            environment_scope=environment_scope,
            environment_fingerprint=environment_fingerprint,
            evidence_origin=evidence_origin,
            strategy_id=strategy_id,
            source_event_id=source_event_id,
        )
        if not skill:
            return {"ok": False, "reason": "skill_not_found", "skill_id": skill_id}
        payload = {
            "skill_id": skill_id,
            "success": bool(success),
            "reason": reason,
            "environment_scope": normalize_environment_scope(environment_scope),
            "environment_fingerprint": environment_fingerprint,
            "evidence_origin": normalize_evidence_origin(evidence_origin),
            "strategy_id": strategy_id,
            "source_event_id": source_event_id,
            "skill": skill.to_dict(),
        }
        self._audit("skill.use_recorded", payload)
        return {"ok": True, **payload}

    def select_for_context(
        self,
        query: str,
        *,
        environment_scope: str = PRODUCTION_SCOPE,
        environment_fingerprint: str = "",
        available_capabilities: List[str] = None,
        top_k: int = 5,
    ) -> Dict[str, Any]:
        """执行 Skill Family 召回、权限门控、认证检查和策略排序。"""

        decision = self.library.select_for_context(
            query,
            environment_scope=environment_scope,
            environment_fingerprint=environment_fingerprint,
            available_capabilities=available_capabilities,
            top_k=top_k,
        )
        self._audit("skill.selection_decided", decision)
        return {"ok": True, **decision}

    def list_lifecycle(self, status: str = "", limit: int = 100) -> List[Dict[str, Any]]:
        normalized = str(status or "").strip().lower()
        skills = self.library.list_all(sort_by="success_rate")
        if normalized:
            skills = [skill for skill in skills if skill.status == normalized]
        return [skill.to_dict() for skill in skills[: max(1, min(int(limit or 100), 500))]]

    def summary(self) -> Dict[str, Any]:
        """返回生命周期、证据范围和待审批提案的聚合摘要。"""

        stats = self.library.get_stats()
        patterns = self._load_patterns()
        proposals = self._load_proposals()
        recent_events: List[Dict[str, Any]] = []
        try:
            if self.events_file.exists():
                lines = self.events_file.read_text(encoding="utf-8").splitlines()[-12:]
                for line in lines:
                    try:
                        recent_events.append(json.loads(line))
                    except Exception:
                        pass
        except Exception:
            recent_events = []
        lifecycle = stats.get("lifecycle", {}) if isinstance(stats, dict) else {}
        return {
            "workspace": str(self.workspace_dir),
            "states": LIFECYCLE_ORDER,
            "counts": {state: int(lifecycle.get(state, 0) or 0) for state in LIFECYCLE_ORDER},
            "library": stats,
            "patterns": {
                "total": len(patterns),
                "readyForCandidate": sum(
                    1
                    for pattern in patterns.values()
                    if int(pattern.get("attempts") or 0) >= self.CANDIDATE_MIN_TRACES
                    and (
                        int(pattern.get("successes") or 0) / max(1, int(pattern.get("attempts") or 0))
                    ) >= self.CANDIDATE_MIN_SUCCESS_RATE
                ),
            },
            "proposals": {
                "total": len(proposals),
                "pending": len([item for item in proposals if item.get("status") == "pending"]),
                "approved": len([item for item in proposals if item.get("status") == "approved"]),
                "rejected": len([item for item in proposals if item.get("status") == "rejected"]),
            },
            "engineeringV2": {
                "sleepCreatesPackages": False,
                "sleepProducesChangeProposals": True,
                "productionRequiresScopedCertification": True,
                "simulationEvidencePromotesProduction": False,
            },
            "thresholds": {
                "candidateMinTraces": self.CANDIDATE_MIN_TRACES,
                "candidateMinSuccessRate": self.CANDIDATE_MIN_SUCCESS_RATE,
                "verifyMinUses": self.VERIFY_MIN_USES,
                "verifyMinSuccessRate": self.VERIFY_MIN_SUCCESS_RATE,
                "activeMinUses": self.ACTIVE_MIN_USES,
                "activeMinSuccessRate": self.ACTIVE_MIN_SUCCESS_RATE,
                "deprecateMinUses": self.DEPRECATE_MIN_USES,
                "deprecateMaxSuccessRate": self.DEPRECATE_MAX_SUCCESS_RATE,
                "maxCandidateFamilies": self.MAX_CANDIDATE_FAMILIES,
            },
            "recentEvents": recent_events,
        }


_lifecycles: Dict[str, SkillLifecycle] = {}


def get_skill_lifecycle(workspace_dir: str) -> SkillLifecycle:
    normalized = str(Path(workspace_dir or ".").expanduser().resolve())
    if normalized not in _lifecycles:
        _lifecycles[normalized] = SkillLifecycle(normalized)
    return _lifecycles[normalized]
