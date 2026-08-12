#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
Constitutional review gate and task audit trail.

Implements governance patterns inspired by Edict:
1. Review gate — a quality checkpoint that can approve/reject/flag task plans
2. Permission matrix — controls which agents can access which capabilities
3. Task audit trail — immutable log of state transitions and decisions

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

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger("app")


class ReviewDecision:
    APPROVE = "approved"
    REJECT = "rejected"
    FLAG = "flagged"
    DEFER = "deferred"


class ReviewResult:
    def __init__(
        self,
        decision: str,
        reason: str = "",
        reviewer: str = "system",
        conditions: List[str] = None,
    ):
        self.decision = decision
        self.reason = reason
        self.reviewer = reviewer
        self.conditions = conditions or []
        self.timestamp = datetime.now().isoformat()

    def to_dict(self) -> dict:
        return {
            "decision": self.decision,
            "reason": self.reason,
            "reviewer": self.reviewer,
            "conditions": self.conditions,
            "timestamp": self.timestamp,
        }

    @property
    def approved(self) -> bool:
        return self.decision == ReviewDecision.APPROVE


ReviewRule = Callable[[Dict[str, Any]], Optional[ReviewResult]]


class ReviewGate:
    """Constitutional review gate for task plan quality control."""

    def __init__(self):
        self._rules: List[Dict[str, Any]] = []

    def add_rule(
        self, name: str, rule: ReviewRule, *, priority: int = 100
    ) -> None:
        self._rules.append({"name": name, "rule": rule, "priority": priority})
        self._rules.sort(key=lambda x: x["priority"])

    def review(self, plan: Dict[str, Any]) -> ReviewResult:
        for entry in self._rules:
            try:
                result = entry["rule"](plan)
                if result and not result.approved:
                    return result
            except Exception as exc:
                return ReviewResult(
                    ReviewDecision.FLAG,
                    reason=f"Review rule '{entry['name']}' error: {exc}",
                    reviewer=entry["name"],
                )
        return ReviewResult(ReviewDecision.APPROVE, reviewer="review_gate")

    def list_rules(self) -> List[str]:
        return [r["name"] for r in self._rules]


def _rule_no_empty_plan(plan: Dict[str, Any]) -> Optional[ReviewResult]:
    if not plan.get("title") and not plan.get("description"):
        return ReviewResult(
            ReviewDecision.REJECT,
            reason="Plan has no title or description",
            reviewer="no_empty_plan",
        )
    return None


def _rule_dangerous_commands(plan: Dict[str, Any]) -> Optional[ReviewResult]:
    dangerous = ["rm -rf /", "format c:", "drop database", "shutdown", "del /f /s"]
    description = str(plan.get("description") or "").lower()
    for cmd in dangerous:
        if cmd in description:
            return ReviewResult(
                ReviewDecision.REJECT,
                reason=f"Plan contains dangerous command pattern: {cmd}",
                reviewer="dangerous_commands",
            )
    return None


def _rule_resource_limits(plan: Dict[str, Any]) -> Optional[ReviewResult]:
    ctx = plan.get("context", {})
    if ctx.get("estimated_tokens", 0) > 500000:
        return ReviewResult(
            ReviewDecision.FLAG,
            reason="Plan may consume excessive tokens (>500K estimated)",
            reviewer="resource_limits",
        )
    return None


class PermissionMatrix:
    """Agent capability permission matrix."""

    def __init__(self):
        self._permissions: Dict[str, Dict[str, bool]] = {}

    def set_permission(self, agent: str, capability: str, allowed: bool) -> None:
        if agent not in self._permissions:
            self._permissions[agent] = {}
        self._permissions[agent][capability] = allowed

    def check(self, agent: str, capability: str) -> bool:
        agent_perms = self._permissions.get(agent, {})
        if capability in agent_perms:
            return agent_perms[capability]
        default_perms = self._permissions.get("*", {})
        return default_perms.get(capability, True)

    def get_agent_capabilities(self, agent: str) -> Dict[str, bool]:
        default = dict(self._permissions.get("*", {}))
        default.update(self._permissions.get(agent, {}))
        return default

    def to_dict(self) -> dict:
        return dict(self._permissions)

    @classmethod
    def from_dict(cls, data: dict) -> "PermissionMatrix":
        matrix = cls()
        matrix._permissions = {k: dict(v) for k, v in data.items()}
        return matrix


class TaskAuditTrail:
    """Immutable audit trail for task state transitions."""

    def __init__(self, workspace_dir: str):
        self.workspace_dir = Path(workspace_dir).expanduser()
        self.audit_dir = self.workspace_dir / ".agent" / "audit"
        self.audit_dir.mkdir(parents=True, exist_ok=True)
        self.audit_file = self.audit_dir / "task_audit.jsonl"

    def log(
        self,
        task_id: str,
        event_type: str,
        *,
        from_state: str = "",
        to_state: str = "",
        agent: str = "",
        details: str = "",
        review_result: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        entry = {
            "timestamp": datetime.now().isoformat(),
            "task_id": task_id,
            "event_type": event_type,
            "from_state": from_state,
            "to_state": to_state,
            "agent": agent,
            "details": details,
        }
        if review_result:
            entry["review_result"] = review_result
        try:
            with open(self.audit_file, "a", encoding="utf-8") as f:
                f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        except Exception:
            pass
        return entry

    def get_trail(self, task_id: str = "", limit: int = 50) -> List[Dict[str, Any]]:
        entries = []
        try:
            if not self.audit_file.exists():
                return []
            with open(self.audit_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        entry = json.loads(line)
                        if task_id and entry.get("task_id") != task_id:
                            continue
                        entries.append(entry)
                    except json.JSONDecodeError:
                        continue
        except Exception:
            pass
        return entries[-limit:]

    def get_stats(self) -> Dict[str, Any]:
        entries = self.get_trail(limit=1000)
        event_counts: Dict[str, int] = {}
        for e in entries:
            et = e.get("event_type", "unknown")
            event_counts[et] = event_counts.get(et, 0) + 1
        return {
            "total_entries": len(entries),
            "event_counts": event_counts,
            "oldest": entries[0].get("timestamp", "") if entries else "",
            "newest": entries[-1].get("timestamp", "") if entries else "",
        }


_global_gate = ReviewGate()
_global_gate.add_rule("no_empty_plan", _rule_no_empty_plan, priority=10)
_global_gate.add_rule("dangerous_commands", _rule_dangerous_commands, priority=20)
_global_gate.add_rule("resource_limits", _rule_resource_limits, priority=30)

_global_matrix = PermissionMatrix()
_global_matrix.set_permission("*", "file_read", True)
_global_matrix.set_permission("*", "file_write", True)
_global_matrix.set_permission("*", "shell_execute", True)
_global_matrix.set_permission("*", "web_access", True)
_global_matrix.set_permission("*", "system_admin", False)


def get_review_gate() -> ReviewGate:
    return _global_gate


def get_permission_matrix() -> PermissionMatrix:
    return _global_matrix
