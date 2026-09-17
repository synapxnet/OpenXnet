#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.
"""会话自动任务策略 / Conversation automation policy.
Author: maoyo | Department: 研发部 | Date: 2026-09-14
Version: 1.0.0 | Security Level: INTERNAL
"""
from __future__ import annotations

from typing import Any

__version__ = "1.0.0"
__author__ = "maoyo"
__copyright__ = "Copyright 2026 Synapxnet"
__maintainer__ = "maoyo"
__email__ = "synapxnet@gmail.com"

OUTCOMES = frozenset({"unchanged", "changed", "completed", "failed", "action_required"})
NOTIFICATION_POLICIES = frozenset({"changes_only", "all", "silent"})
COMPLETION_POLICIES = frozenset({"until_done", "continuous"})


def bounded_text(value: Any, maximum: int = 512) -> str:
    """读取有限纯文本，身份超限则拒绝。 / Read bounded plain text and reject oversized identities."""
    return value.strip()[:maximum] if isinstance(value, str) else ""


def conversation_identity(value: Any) -> str:
    """身份不截断、不接受控制字符。 / Never truncate identities or accept control characters."""
    if not isinstance(value, str) or len(value) > 512 or any(ord(c) < 32 for c in value):
        return ""
    return value.strip()


def automation_active(context: Any) -> bool:
    """旧任务兼容，自动任务仅 active 可触发。 / Preserve legacy tasks and activate automations only in the active state."""
    automation = context.get("automation") if isinstance(context, dict) else None
    return not isinstance(automation, dict) or automation.get("state") == "active"


def automation_delivery_allowed(context: Any) -> bool:
    """无变化仅记历史，未知普通结果不伪装静默证据。 / Keep unchanged observations in history without inventing silence for unknown results."""
    automation = context.get("automation") if isinstance(context, dict) else None
    if not isinstance(automation, dict):
        return True
    if automation.get("notification_policy") == "silent":
        return False
    if automation.get("current_run_pending") is True:
        return True
    runs = automation.get("runs")
    return not isinstance(runs, list) or not runs or runs[-1].get("notify") is not False


def build_automation(notification_policy: str, completion_policy: str, completion_condition: str) -> dict:
    """创建经过验证的自动任务策略。 / Create a validated automation policy."""
    if notification_policy not in NOTIFICATION_POLICIES or completion_policy not in COMPLETION_POLICIES:
        raise ValueError("Unsupported automation policy")
    condition = bounded_text(completion_condition, 2000)
    if completion_policy == "until_done" and not condition:
        raise ValueError("A completion condition is required for until_done automation")
    return {"state": "active", "notification_policy": notification_policy, "completion_policy": completion_policy, "completion_condition": condition, "runs": []}


def append_automation_run(automation: dict, *, run_id: str, outcome: str, result: str, evidence: Any, observation_key: str, finished_at: str) -> dict:
    """从结构化执行回执记录本轮并计算通知/结束。 / Record a structured execution receipt and decide notification and completion."""
    if outcome not in OUTCOMES:
        raise ValueError("Automation requires an explicit supported outcome")
    proof = [bounded_text(item, 256) for item in evidence[:3] if bounded_text(item, 256)] if isinstance(evidence, list) else []
    if outcome == "completed" and not proof:
        raise ValueError("Automation completion requires explicit evidence")
    previous_runs = automation.get("runs") if isinstance(automation.get("runs"), list) else []
    if any(item.get("id") == run_id for item in previous_runs if isinstance(item, dict)):
        return dict(automation)
    key = bounded_text(observation_key, 512)
    effective_outcome = outcome
    if outcome == "changed" and key and key == automation.get("last_observation_key"):
        effective_outcome = "unchanged"
    policy = automation.get("notification_policy", "changes_only")
    notify = policy != "silent" and (policy == "all" or effective_outcome != "unchanged")
    state = automation.get("state", "active")
    if outcome == "completed" and automation.get("completion_policy") == "until_done":
        state = "completed"
    row = {"id": run_id, "outcome": effective_outcome, "summary": bounded_text(result, 1200), "evidence": proof, "finished_at": finished_at, "notify": notify}
    return {**automation, "state": state, "last_outcome": effective_outcome, "last_run_id": run_id, "last_observation_key": key or automation.get("last_observation_key", ""), "runs": [*previous_runs[-49:], row]}


def project_automation(value: Any, maximum_runs: int = 50) -> dict | None:
    """投影有限自动任务字段，禁止拷贝任意上下文。 / Project bounded automation fields without copying arbitrary context."""
    if not isinstance(value, dict):
        return None
    projected = {key: bounded_text(value.get(key), maximum) for key, maximum in [("state", 24), ("notification_policy", 24), ("completion_policy", 24), ("completion_condition", 2000), ("last_outcome", 32), ("last_run_id", 128)]}
    projected["runs"] = []
    for row in (value.get("runs") or [])[-max(1, min(maximum_runs, 50)):] if isinstance(value.get("runs"), list) else []:
        if not isinstance(row, dict):
            continue
        projected["runs"].append({"id": bounded_text(row.get("id"), 128), "outcome": bounded_text(row.get("outcome"), 32), "summary": bounded_text(row.get("summary"), 600), "evidence": [bounded_text(item, 200) for item in row.get("evidence", [])[:2] if isinstance(item, str)] if isinstance(row.get("evidence"), list) else [], "finished_at": bounded_text(row.get("finished_at"), 80), "notify": row.get("notify") is True})
    projected["history_truncated"] = len(value.get("runs") or []) > len(projected["runs"])
    return projected
