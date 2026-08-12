#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""OpenXnet Skill Engineering v2 的通用数据规范与评分函数。"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List


SKILL_EVIDENCE_ORIGINS = {
    "work",
    "rehearsal",
    "manual",
    "external",
    "legacy",
}

SKILL_DERIVATION_METHODS = {
    "work_crystallization",
    "rehearsal_crystallization",
    "offline_consolidation",
    "manual_curation",
    "external_import",
    "legacy",
}

SKILL_ENVIRONMENT_SCOPES = (
    "synthetic",
    "simulation",
    "staging",
    "shadow",
    "canary",
    "production",
    "legacy",
)

SKILL_CERTIFICATION_STATES = {
    "uncertified",
    "candidate",
    "verified",
    "active",
    "deprecated",
    "retired",
    "expired",
    "revoked",
}

TRUSTED_CERTIFICATION_STATES = {"verified", "active"}
PRODUCTION_SCOPE = "production"
NON_PRODUCTION_SCOPES = {
    "synthetic",
    "simulation",
    "staging",
    "shadow",
    "canary",
}


def utc_now() -> str:
    """返回不带时区偏移的 UTC ISO 时间，供证据和认证记录统一使用。"""

    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def stable_digest(*values: Any, length: int = 16) -> str:
    """根据结构化输入生成稳定摘要，避免依赖不稳定的字符串拼接顺序。"""

    payload = json.dumps(values, ensure_ascii=False, sort_keys=True, default=str)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[: max(8, min(length, 64))]


def normalize_evidence_origin(value: Any, fallback: str = "legacy") -> str:
    """规范证据来源；旧版 sleep 来源被标记为 legacy，避免误认为睡眠创造事实。"""

    normalized = str(value or "").strip().lower().replace("-", "_")
    if normalized == "sleep":
        return "legacy"
    if normalized in SKILL_EVIDENCE_ORIGINS:
        return normalized
    return fallback if fallback in SKILL_EVIDENCE_ORIGINS else "legacy"


def normalize_derivation_method(value: Any, evidence_origin: str = "legacy") -> str:
    """规范结晶方式；缺失时依据证据来源选择保守默认值。"""

    normalized = str(value or "").strip().lower().replace("-", "_")
    if normalized in SKILL_DERIVATION_METHODS:
        return normalized
    defaults = {
        "work": "work_crystallization",
        "rehearsal": "rehearsal_crystallization",
        "manual": "manual_curation",
        "external": "external_import",
    }
    return defaults.get(normalize_evidence_origin(evidence_origin), "legacy")


def normalize_environment_scope(value: Any, fallback: str = "legacy") -> str:
    """规范环境范围，未知环境降级为 legacy，禁止隐式视为生产环境。"""

    normalized = str(value or "").strip().lower().replace("-", "_")
    if normalized in SKILL_ENVIRONMENT_SCOPES:
        return normalized
    return fallback if fallback in SKILL_ENVIRONMENT_SCOPES else "legacy"


def normalize_certification_state(value: Any, fallback: str = "uncertified") -> str:
    """规范认证状态，未知状态回退为未认证。"""

    normalized = str(value or "").strip().lower().replace("-", "_")
    if normalized in SKILL_CERTIFICATION_STATES:
        return normalized
    return fallback if fallback in SKILL_CERTIFICATION_STATES else "uncertified"


def normalize_string_list(value: Any) -> List[str]:
    """把任意输入转换为去重且保持顺序的非空字符串列表。"""

    if value is None:
        items: Iterable[Any] = []
    elif isinstance(value, (list, tuple, set)):
        items = value
    else:
        items = [value]
    result: List[str] = []
    for item in items:
        text = str(item or "").strip()
        if text and text not in result:
            result.append(text)
    return result


def normalize_evidence_summary(value: Any) -> Dict[str, Dict[str, Any]]:
    """规范按环境聚合的证据统计，丢弃非法计数并保留最近使用时间。"""

    source = value if isinstance(value, dict) else {}
    result: Dict[str, Dict[str, Any]] = {}
    for raw_scope, raw_bucket in source.items():
        if not isinstance(raw_bucket, dict):
            continue
        scope = normalize_environment_scope(raw_scope)
        attempts = max(0, int(raw_bucket.get("attempts") or 0))
        successes = max(0, min(attempts, int(raw_bucket.get("successes") or 0)))
        failures = max(0, min(attempts - successes, int(raw_bucket.get("failures") or 0)))
        if successes + failures < attempts:
            failures = attempts - successes
        result[scope] = {
            "attempts": attempts,
            "successes": successes,
            "failures": failures,
            "last_used_at": str(raw_bucket.get("last_used_at") or ""),
            "environment_fingerprints": normalize_string_list(raw_bucket.get("environment_fingerprints")),
            "source_event_ids": normalize_string_list(raw_bucket.get("source_event_ids"))[-200:],
        }
    return result


def normalize_strategy(value: Any, *, fallback_id: str = "default") -> Dict[str, Any]:
    """规范一个策略变体，保留工作流、工具链、风险和分环境证据。"""

    source = value if isinstance(value, dict) else {}
    strategy_id = str(source.get("strategy_id") or fallback_id or "default").strip()[:96]
    risk_level = str(source.get("risk_level") or "medium").strip().lower()
    if risk_level not in {"low", "medium", "high", "critical"}:
        risk_level = "medium"
    try:
        cost_score = float(source.get("cost_score") or 0.0)
    except (TypeError, ValueError):
        cost_score = 0.0
    return {
        "strategy_id": strategy_id,
        "name": str(source.get("name") or strategy_id).strip()[:160],
        "description": str(source.get("description") or "").strip()[:1000],
        "workflow": normalize_string_list(source.get("workflow")),
        "tool_chain": normalize_string_list(source.get("tool_chain")),
        "risk_level": risk_level,
        "cost_score": max(0.0, min(cost_score, 1.0)),
        "evidence_summary": normalize_evidence_summary(source.get("evidence_summary")),
        "source_event_ids": normalize_string_list(source.get("source_event_ids"))[-200:],
        "updated_at": str(source.get("updated_at") or utc_now()),
    }


def normalize_strategies(value: Any) -> List[Dict[str, Any]]:
    """规范策略列表并按 strategy_id 去重，后出现的记录覆盖同名旧记录。"""

    items = value if isinstance(value, list) else []
    indexed: Dict[str, Dict[str, Any]] = {}
    for index, item in enumerate(items):
        strategy = normalize_strategy(item, fallback_id=f"strategy-{index + 1}")
        indexed[strategy["strategy_id"]] = strategy
    return list(indexed.values())[-32:]


def normalize_certification(value: Any) -> Dict[str, Any]:
    """规范单个环境认证记录，认证仅描述一个明确环境范围。"""

    source = value if isinstance(value, dict) else {}
    scope = normalize_environment_scope(source.get("scope"))
    return {
        "scope": scope,
        "status": normalize_certification_state(source.get("status")),
        "environment_fingerprint": str(source.get("environment_fingerprint") or "").strip()[:256],
        "verified_at": str(source.get("verified_at") or ""),
        "expires_at": str(source.get("expires_at") or ""),
        "evidence_event_ids": normalize_string_list(source.get("evidence_event_ids"))[-200:],
        "reason": str(source.get("reason") or "").strip()[:500],
        "actor": str(source.get("actor") or "").strip()[:120],
        "updated_at": str(source.get("updated_at") or utc_now()),
    }


def normalize_certifications(value: Any) -> List[Dict[str, Any]]:
    """规范认证列表并按环境范围去重，避免同一范围出现冲突状态。"""

    items = value if isinstance(value, list) else []
    indexed: Dict[str, Dict[str, Any]] = {}
    for item in items:
        certification = normalize_certification(item)
        indexed[certification["scope"]] = certification
    return list(indexed.values())


def bayesian_success_score(successes: int, failures: int) -> float:
    """使用 Beta(1,1) 后验均值估计成功概率，避免少量样本产生虚高排名。"""

    positive = max(0, int(successes or 0))
    negative = max(0, int(failures or 0))
    return (positive + 1.0) / (positive + negative + 2.0)


def target_certification_state(attempts: int, successes: int, failures: int) -> str:
    """根据真实证据统计计算建议认证状态，不直接修改 Skill 或执行发布。"""

    total = max(0, int(attempts or 0))
    positive = max(0, int(successes or 0))
    negative = max(0, int(failures or 0))
    rate = positive / total if total else 0.0
    if total >= 8 and rate <= 0.35:
        return "retired"
    if total >= 5 and rate < 0.5:
        return "deprecated"
    if total >= 4 and rate >= 0.8:
        return "active"
    if total >= 3 and rate >= 0.7:
        return "verified"
    return "candidate"


def certification_is_trusted(certification: Dict[str, Any], environment_fingerprint: str = "") -> bool:
    """判断认证是否允许执行；生产环境指纹不一致时拒绝复用。"""

    status = normalize_certification_state(certification.get("status"))
    if status not in TRUSTED_CERTIFICATION_STATES:
        return False
    expected = str(certification.get("environment_fingerprint") or "").strip()
    actual = str(environment_fingerprint or "").strip()
    if certification.get("scope") == PRODUCTION_SCOPE and expected and actual and expected != actual:
        return False
    return True


def strategy_utility(strategy: Dict[str, Any], environment_scope: str) -> float:
    """计算策略的保守效用分，综合贝叶斯成功率、风险和成本。"""

    normalized = normalize_strategy(strategy)
    scope = normalize_environment_scope(environment_scope)
    evidence = normalized["evidence_summary"].get(scope, {})
    success_score = bayesian_success_score(
        int(evidence.get("successes") or 0),
        int(evidence.get("failures") or 0),
    )
    risk_penalty = {
        "low": 0.0,
        "medium": 0.08,
        "high": 0.22,
        "critical": 0.45,
    }.get(normalized["risk_level"], 0.08)
    return round(success_score - risk_penalty - (normalized["cost_score"] * 0.1), 6)
