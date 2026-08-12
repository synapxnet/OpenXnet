#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""Kernel diagnostics, live guidance, system manifest, and config intent APIs."""

from __future__ import annotations

import asyncio
import copy
import json
from datetime import datetime
from typing import Any, AsyncGenerator, Callable, Dict, List, Optional
from uuid import uuid4

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from py.kernel.audit import get_kernel_audit, sanitize_payload
from py.kernel.approval import get_approval_center
from py.kernel.config_intent import (
    apply_config_intent,
    parse_config_intent,
    pending_config_intents,
    register_config_intent,
)
from py.kernel.conversation_state import build_conversation_state
from py.kernel.event_bus import get_kernel_event_bus
from py.kernel.executor import get_kernel_executor
from py.kernel.guidance import get_guidance_bus
from py.kernel.planner import build_kernel_plan
from py.kernel.policy import get_policy_gate
from py.kernel.runtime import apply_runtime_mode_profile, kernel_mode_profile, normalize_runtime_mode
from py.kernel.skill_lifecycle import get_skill_lifecycle
from py.kernel.system_manifest import build_system_manifest
from py.kernel.timeline import build_plan_run_history, build_plan_timeline
from py.kernel.world_state import build_world_state


router = APIRouter(prefix="/v1/kernel", tags=["kernel"])

_settings_loader: Optional[Callable[[], Any]] = None
_settings_saver: Optional[Callable[[Dict[str, Any]], Any]] = None
_settings_broadcaster: Optional[Callable[[Dict[str, Any]], Any]] = None
_kernel_ref: Optional[Callable[[], Any]] = None
_trace_retry_handler: Optional[Callable[[Dict[str, Any], Dict[str, Any], Dict[str, Any]], Any]] = None
_plan_step_execute_handler: Optional[Callable[[Dict[str, Any], Dict[str, Any], Dict[str, Any]], Any]] = None


class GuidanceRequest(BaseModel):
    text: str = Field(default="")
    conversation_id: str = Field(default="")
    conversationId: str = Field(default="")
    turn_id: str = Field(default="")
    trace_id: str = Field(default="")
    mode: str = Field(default="soft")
    priority: int = Field(default=0)


class SkillLifecycleTaskRequest(BaseModel):
    """约束一条可复现任务证据及其测试链路来源。"""

    summary: str = Field(default="")
    input_text: str = Field(default="")
    success: bool = Field(default=True)
    tools_used: List[Any] = Field(default_factory=list)
    strategy: str = Field(default="")
    trigger_context: str = Field(default="")
    workflow: List[str] = Field(default_factory=list)
    verification: List[str] = Field(default_factory=list)
    rollback: str = Field(default="")
    counter_examples: List[str] = Field(default_factory=list)
    source_event_ids: List[str] = Field(default_factory=list)
    source: str = Field(default="work")
    evidence_origin: str = Field(default="")
    derivation_method: str = Field(default="")
    environment_scope: str = Field(default="legacy")
    environment_fingerprint: str = Field(default="")
    problem_fingerprint: str = Field(default="")
    family_id: str = Field(default="")
    strategy_id: str = Field(default="")
    strategy_description: str = Field(default="")
    risk_level: str = Field(default="medium")
    cost_score: float = Field(default=0.0)
    parent_event_id: str = Field(default="")
    mutation_rule: str = Field(default="")
    expected_invariant: str = Field(default="")
    verification_oracle: str = Field(default="")


class SkillLifecycleTransitionRequest(BaseModel):
    status: str = Field(default="")
    reason: str = Field(default="")
    actor: str = Field(default="user")
    sync: bool = Field(default=True)


class SkillUseRecordRequest(BaseModel):
    """约束一次带环境和策略身份的 Skill 使用证据。"""

    success: bool = Field(default=True)
    reason: str = Field(default="manual_record")
    environment_scope: str = Field(default="legacy")
    environment_fingerprint: str = Field(default="")
    evidence_origin: str = Field(default="work")
    strategy_id: str = Field(default="")
    source_event_id: str = Field(default="")


class SkillChangeProposalResolveRequest(BaseModel):
    """约束离线巩固提案的人工审批结果。"""

    approved: bool = Field(default=False)
    actor: str = Field(default="user")
    reason: str = Field(default="")


class SkillSelectionRequest(BaseModel):
    """约束神经符号 Skill 路由所需的上下文和环境边界。"""

    query: str = Field(default="")
    environment_scope: str = Field(default="production")
    environment_fingerprint: str = Field(default="")
    available_capabilities: List[str] = Field(default_factory=list)
    top_k: int = Field(default=5, ge=1, le=50)


class ConfigIntentRequest(BaseModel):
    text: str = Field(default="")


class ConfigApplyRequest(BaseModel):
    intent: Dict[str, Any] = Field(default_factory=dict)
    confirmed: bool = Field(default=False)
    confirmation_text: str = Field(default="")


class ConversationStateRequest(BaseModel):
    messages: List[Dict[str, Any]] = Field(default_factory=list)
    model: str = Field(default="")


class WorldStateRequest(BaseModel):
    messages: List[Dict[str, Any]] = Field(default_factory=list)
    model: str = Field(default="")
    include_recent: bool = Field(default=True)


class KernelPlanRequest(BaseModel):
    goal: str = Field(default="")
    messages: List[Dict[str, Any]] = Field(default_factory=list)
    model: str = Field(default="")
    candidate_tools: List[Any] = Field(default_factory=list)
    include_world: bool = Field(default=True)


class PolicyEvaluateRequest(BaseModel):
    tool_name: str = Field(default="")
    actor: str = Field(default="model")


class ApprovalResolveRequest(BaseModel):
    approval_id: str = Field(default="")
    resolution: str = Field(default="")
    reason: str = Field(default="")
    consume: bool = Field(default=True)


class TraceRetryRequest(BaseModel):
    tool_name: str = Field(default="")
    tool_params: Dict[str, Any] = Field(default_factory=dict)
    approval_id: str = Field(default="")
    reason: str = Field(default="manual_retry")


class PlanStepExecuteRequest(BaseModel):
    tool_params: Dict[str, Any] = Field(default_factory=dict)
    approval_id: str = Field(default="")
    reason: str = Field(default="plan_step_execution")
    confirmed: bool = Field(default=False)


class PlanAdvanceRequest(BaseModel):
    dry_run: bool = Field(default=False)
    allow_low_risk: bool = Field(default=True)
    reason: str = Field(default="plan_advance")


class PlanRunRequest(BaseModel):
    dry_run: bool = Field(default=False)
    allow_low_risk: bool = Field(default=True)
    max_steps: int = Field(default=3)
    reason: str = Field(default="plan_run")
    run_id: str = Field(default="")
    runId: str = Field(default="")


class PlanResumeRequest(BaseModel):
    dry_run: bool = Field(default=False)
    allow_low_risk: bool = Field(default=True)
    max_steps: int = Field(default=3)
    reason: str = Field(default="plan_resume")
    run_id: str = Field(default="")
    runId: str = Field(default="")


class RuntimeModeRequest(BaseModel):
    mode: str = Field(default="")
    reason: str = Field(default="")
    persist: bool = Field(default=False)
    confirmed: bool = Field(default=False)
    apply_profile: bool = Field(default=True)


def configure_kernel_routes(
    *,
    settings_loader=None,
    settings_saver=None,
    settings_broadcaster=None,
    kernel_ref=None,
    trace_retry_handler=None,
    plan_step_execute_handler=None,
) -> None:
    global _settings_loader, _settings_saver, _settings_broadcaster, _kernel_ref, _trace_retry_handler, _plan_step_execute_handler
    _settings_loader = settings_loader
    _settings_saver = settings_saver
    _settings_broadcaster = settings_broadcaster
    _kernel_ref = kernel_ref
    _trace_retry_handler = trace_retry_handler
    _plan_step_execute_handler = plan_step_execute_handler


async def _load_settings() -> Dict[str, Any]:
    if not _settings_loader:
        return {}
    result = _settings_loader()
    if hasattr(result, "__await__"):
        result = await result
    return result or {}


async def _save_settings(settings: Dict[str, Any]) -> None:
    if not _settings_saver:
        return
    result = _settings_saver(settings)
    if hasattr(result, "__await__"):
        await result


async def _broadcast_settings(settings: Dict[str, Any]) -> None:
    if not _settings_broadcaster:
        return
    result = _settings_broadcaster(settings)
    if hasattr(result, "__await__"):
        await result


def _kernel_diagnostics() -> Dict[str, Any]:
    if not _kernel_ref:
        return {}
    try:
        kernel = _kernel_ref()
        if kernel and hasattr(kernel, "get_diagnostics"):
            return kernel.get_diagnostics()
    except Exception as exc:
        return {"error": str(exc)}
    return {}


def _kernel_runtime_status(settings: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    if not _kernel_ref:
        return {"available": False, "reason": "kernel_ref_not_configured"}
    try:
        kernel = _kernel_ref()
        if kernel and hasattr(kernel, "status"):
            return kernel.status(settings)
        if kernel and hasattr(kernel, "get_diagnostics"):
            return {"available": True, "diagnostics": kernel.get_diagnostics()}
    except Exception as exc:
        return {"available": False, "error": str(exc)}
    return {"available": False, "reason": "kernel_unavailable"}


def _kernel_recent_plans(
    limit: int = 20,
    *,
    workspace: str = "",
    status: str = "",
    source: str = "",
) -> List[Dict[str, Any]]:
    if not _kernel_ref:
        return []
    try:
        kernel = _kernel_ref()
        if kernel and hasattr(kernel, "recent_plans"):
            return kernel.recent_plans(limit, workspace_dir=workspace, status=status, source=source)
    except Exception:
        return []
    return []


def _kernel_plan_detail(plan_id: str, *, workspace: str = "") -> Optional[Dict[str, Any]]:
    if not _kernel_ref:
        return None
    try:
        kernel = _kernel_ref()
        if kernel and hasattr(kernel, "get_plan"):
            return kernel.get_plan(plan_id, workspace_dir=workspace)
    except Exception:
        return None
    return None


def _kernel_plan_status(workspace: str = "") -> Dict[str, Any]:
    if not _kernel_ref:
        return {"available": False, "reason": "kernel_ref_not_configured"}
    try:
        kernel = _kernel_ref()
        if kernel and hasattr(kernel, "plan_status"):
            return kernel.plan_status(workspace)
    except Exception as exc:
        return {"available": False, "error": str(exc)}
    return {"available": False, "reason": "kernel_runtime_not_available"}


def _workspace_from_settings(settings: Dict[str, Any]) -> str:
    return settings.get("CLISettings", {}).get("cc_path", "") if isinstance(settings, dict) else ""


def _bounded_route_int(value: Any, default: int, *, minimum: int = 1, maximum: int = 10) -> int:
    try:
        number = int(value)
    except Exception:
        number = default
    return max(minimum, min(number, maximum))


def _parse_kernel_timestamp(value: Any) -> Optional[datetime]:
    text = str(value or "").strip()
    if not text:
        return None
    candidates = [text]
    if text.endswith("Z"):
        candidates.append(text[:-1] + "+00:00")
    if len(text) >= 5 and text[-5] in {"+", "-"} and text[-2] != ":":
        candidates.append(text[:-2] + ":" + text[-2:])
    for candidate in candidates:
        try:
            return datetime.fromisoformat(candidate)
        except Exception:
            continue
    return None


def _kernel_age_seconds(value: Any) -> int:
    parsed = _parse_kernel_timestamp(value)
    if not parsed:
        return 0
    now = datetime.now(parsed.tzinfo) if parsed.tzinfo else datetime.now()
    try:
        return max(0, int((now - parsed).total_seconds()))
    except Exception:
        return 0


def _sum_count_values(values: Dict[str, Any]) -> int:
    total = 0
    for value in values.values():
        try:
            total += max(0, int(value or 0))
        except Exception:
            continue
    return total


def _new_plan_run_id(value: str = "") -> str:
    explicit = str(value or "").strip()
    return explicit or f"planrun_{uuid4().hex}"


def _latest_plan_run(workspace: str, plan_id: str) -> Dict[str, Any]:
    try:
        history = build_plan_run_history(workspace, plan_id, limit=50)
    except Exception:
        return {}
    runs = history.get("runs", []) if isinstance(history, dict) else []
    if not isinstance(runs, list) or not runs:
        return {}
    for item in reversed(runs):
        if isinstance(item, dict) and item.get("status") != "dry_run" and not item.get("dryRun"):
            return item
    return runs[-1] if isinstance(runs[-1], dict) else {}


def _plan_resume_guidance(decision: Dict[str, Any], *, can_resume: bool) -> Dict[str, Any]:
    next_action = decision.get("nextAction", {}) if isinstance(decision.get("nextAction"), dict) else {}
    action_type = str(next_action.get("actionType") or "")
    reason = str(decision.get("reason") or next_action.get("reason") or "")
    step = next_action.get("step", {}) if isinstance(next_action.get("step"), dict) else {}
    endpoints = next_action.get("endpoints", {}) if isinstance(next_action.get("endpoints"), dict) else {}
    plan_id = str(decision.get("plan_id") or next_action.get("plan_id") or "")
    step_id = str(decision.get("step_id") or step.get("step_id") or "")

    if can_resume:
        return sanitize_payload({
            "actionType": "resume_safe_step",
            "reason": reason or "safe_step_ready",
            "message": "Call the resume endpoint to continue auto-executable safe steps.",
            "endpoint": f"/v1/kernel/plans/{plan_id}/resume",
            "dryRunEndpoint": f"/v1/kernel/plans/{plan_id}/resume",
        })
    if action_type == "plan_complete":
        return sanitize_payload({
            "actionType": "plan_complete",
            "reason": reason or "all_tool_steps_completed",
            "message": "Plan tool steps are complete; validate outputs or prepare final response.",
            "timelineEndpoint": f"/v1/kernel/plans/{plan_id}/timeline",
            "runsEndpoint": f"/v1/kernel/plans/{plan_id}/runs",
        })
    if action_type == "recover_step":
        return sanitize_payload({
            "actionType": "recover_step",
            "reason": reason or "step_error",
            "message": "Open step recovery and resolve the failed step before resuming.",
            "step_id": step_id,
            "recoveryEndpoint": endpoints.get("recovery") or f"/v1/kernel/plans/{plan_id}/steps/{step_id}/recovery",
            "executeEndpoint": endpoints.get("execute") or f"/v1/kernel/plans/{plan_id}/steps/{step_id}/execute",
        })
    if action_type == "resolve_approval" or reason == "approval_required":
        return sanitize_payload({
            "actionType": "resolve_approval",
            "reason": reason or "approval_required",
            "message": "Resolve the pending approval before resuming.",
            "step_id": step_id,
            "contractEndpoint": endpoints.get("contract") or f"/v1/kernel/plans/{plan_id}/steps/{step_id}/contract",
        })
    if reason == "explicit_params_required":
        return sanitize_payload({
            "actionType": "provide_params",
            "reason": reason,
            "message": "This step requires explicit tool parameters; inspect the contract and execute manually.",
            "step_id": step_id,
            "contractEndpoint": endpoints.get("contract") or f"/v1/kernel/plans/{plan_id}/steps/{step_id}/contract",
            "executeEndpoint": endpoints.get("execute") or f"/v1/kernel/plans/{plan_id}/steps/{step_id}/execute",
        })
    if reason == "risk_not_auto_advance_allowed":
        return sanitize_payload({
            "actionType": "manual_risk_review",
            "reason": reason,
            "message": "This step is outside the allowed automatic risk level; review and execute manually if appropriate.",
            "step_id": step_id,
            "contractEndpoint": endpoints.get("contract") or f"/v1/kernel/plans/{plan_id}/steps/{step_id}/contract",
        })
    if action_type == "blocked_dependencies":
        return sanitize_payload({
            "actionType": "blocked_dependencies",
            "reason": reason or "blocked_dependencies",
            "message": "Complete the blocked dependencies before resuming.",
            "step_id": step_id,
            "blockedDependencies": next_action.get("blockedDependencies", []),
            "timelineEndpoint": endpoints.get("timeline") or f"/v1/kernel/plans/{plan_id}/timeline",
        })
    if action_type == "wait_for_step":
        return sanitize_payload({
            "actionType": "wait_for_step",
            "reason": reason or "step_running",
            "message": "A step is already running; wait for it to finish before resuming.",
            "step_id": step_id,
            "timelineEndpoint": endpoints.get("timeline") or f"/v1/kernel/plans/{plan_id}/timeline",
        })
    return sanitize_payload({
        "actionType": action_type or "resume_blocked",
        "reason": reason or "resume_blocked",
        "message": "Inspect nextAction and timeline before resuming.",
        "step_id": step_id,
        "timelineEndpoint": f"/v1/kernel/plans/{plan_id}/timeline",
    })


def _build_plan_resume_preview(
    *,
    workspace: str,
    plan_id: str,
    allow_low_risk: bool = True,
    max_steps: int = 3,
) -> Dict[str, Any]:
    record = _kernel_plan_detail(plan_id, workspace=workspace)
    bounded_max_steps = _bounded_route_int(max_steps, 3, minimum=1, maximum=10)
    latest_run = _latest_plan_run(workspace, plan_id)
    previous_run_id = str(latest_run.get("run_id") or "")
    if not record:
        return {
            "ok": False,
            "reason": "plan_not_found",
            "plan_id": plan_id,
            "workspace": workspace,
            "previousRunId": previous_run_id,
        }

    plan = record.get("plan", {}) if isinstance(record, dict) else {}
    decision = get_kernel_executor().plan_advance_decision(
        workspace_dir=workspace,
        plan=plan,
        allow_low_risk=bool(allow_low_risk),
    )
    decision["workspace"] = workspace
    can_resume = bool(decision.get("canAdvance"))
    next_action = decision.get("nextAction", {}) if isinstance(decision.get("nextAction"), dict) else {}
    stop_reason = ""
    if not can_resume:
        stop_reason = "plan_complete" if next_action.get("actionType") == "plan_complete" else str(decision.get("reason") or "")

    return sanitize_payload({
        "ok": True,
        "plan_id": plan_id,
        "workspace": workspace,
        "canResume": can_resume,
        "wouldResume": can_resume,
        "previousRunId": previous_run_id,
        "latestRun": latest_run,
        "maxSteps": bounded_max_steps,
        "allowLowRisk": bool(allow_low_risk),
        "stopReason": stop_reason,
        "decision": decision,
        "nextAction": next_action,
        "guidance": _plan_resume_guidance(decision, can_resume=can_resume),
        "endpoints": {
            "resume": f"/v1/kernel/plans/{plan_id}/resume",
            "runs": f"/v1/kernel/plans/{plan_id}/runs",
            "timeline": f"/v1/kernel/plans/{plan_id}/timeline",
            "nextAction": f"/v1/kernel/plans/{plan_id}/next-action",
        },
        "security": {
            "readOnly": True,
            "autoExecutesOnlySafeNoParamSteps": True,
            "rawParamsPersisted": False,
            "rawMessagesReturned": False,
            "resultPreviewReturned": False,
        },
    })


def _plan_run_receipt_preview(run: Any) -> Dict[str, Any]:
    if not isinstance(run, dict):
        return {}
    return sanitize_payload({
        "run_id": run.get("run_id", ""),
        "status": run.get("status", ""),
        "stopReason": run.get("stopReason", ""),
        "advancedCount": run.get("advancedCount", 0),
        "maxSteps": run.get("maxSteps", 0),
        "dryRun": bool(run.get("dryRun", False)),
        "resumed": bool(run.get("resumed", False)),
        "previousRunId": run.get("previousRunId", ""),
        "eventCount": run.get("eventCount", 0),
        "resumeEventCount": run.get("resumeEventCount", 0),
        "started_at": run.get("started_at", ""),
        "finished_at": run.get("finished_at", ""),
    })


def _build_plan_control_summary(
    *,
    workspace: str,
    plan_id: str,
    allow_low_risk: bool = True,
    max_steps: int = 3,
) -> Dict[str, Any]:
    record = _kernel_plan_detail(plan_id, workspace=workspace)
    if not record:
        return {"ok": False, "reason": "plan_not_found", "plan_id": plan_id, "workspace": workspace}

    resume_preview = _build_plan_resume_preview(
        workspace=workspace,
        plan_id=plan_id,
        allow_low_risk=allow_low_risk,
        max_steps=max_steps,
    )
    runs = build_plan_run_history(workspace, plan_id, limit=50)
    run_items = runs.get("runs", []) if isinstance(runs, dict) and isinstance(runs.get("runs"), list) else []
    latest_run = _latest_plan_run(workspace, plan_id)
    timeline = build_plan_timeline(workspace, plan_id, trace_limit=50, include_plan=False)
    timeline_payload = timeline.get("timeline", {}) if isinstance(timeline, dict) and isinstance(timeline.get("timeline"), dict) else {}
    timeline_counts = timeline_payload.get("counts", {}) if isinstance(timeline_payload.get("counts"), dict) else {}

    plan_summary = {
        "plan_id": record.get("plan_id", plan_id),
        "status": record.get("status", ""),
        "source": record.get("source", ""),
        "runtime_mode": record.get("runtime_mode", ""),
        "created_at": record.get("created_at", ""),
        "updated_at": record.get("updated_at", ""),
        "goal_preview": record.get("goal_preview", ""),
        "step_count": record.get("step_count", 0),
        "highestRisk": record.get("highestRisk", ""),
        "approvalStepCount": record.get("approvalStepCount", 0),
        "dangerousStepCount": record.get("dangerousStepCount", 0),
    }
    can_resume = bool(resume_preview.get("canResume"))
    stop_reason = str(resume_preview.get("stopReason") or "")
    state = "ready_to_resume" if can_resume else (stop_reason or "blocked")

    return sanitize_payload({
        "ok": True,
        "schema": "openxnet.kernel.plan_control.v1",
        "workspace": workspace,
        "plan_id": plan_id,
        "state": state,
        "canResume": can_resume,
        "plan": plan_summary,
        "nextAction": resume_preview.get("nextAction", {}),
        "guidance": resume_preview.get("guidance", {}),
        "resumePreview": resume_preview,
        "runs": {
            "count": runs.get("count", len(run_items)) if isinstance(runs, dict) else len(run_items),
            "latest": _plan_run_receipt_preview(latest_run),
            "recent": [_plan_run_receipt_preview(item) for item in run_items[-5:]],
        },
        "timeline": {
            "counts": timeline_counts,
        },
        "endpoints": {
            "detail": f"/v1/kernel/plans/{plan_id}",
            "control": f"/v1/kernel/plans/{plan_id}/control",
            "nextAction": f"/v1/kernel/plans/{plan_id}/next-action",
            "timeline": f"/v1/kernel/plans/{plan_id}/timeline",
            "runs": f"/v1/kernel/plans/{plan_id}/runs",
            "resumePreview": f"/v1/kernel/plans/{plan_id}/resume-preview",
            "resume": f"/v1/kernel/plans/{plan_id}/resume",
            "run": f"/v1/kernel/plans/{plan_id}/run",
            "advance": f"/v1/kernel/plans/{plan_id}/advance",
        },
        "security": {
            "readOnly": True,
            "autoExecutesOnlySafeNoParamSteps": True,
            "rawParamsPersisted": False,
            "rawMessagesReturned": False,
            "resultPreviewReturned": False,
            "rawAuditPayloadReturned": False,
        },
    })


def _plan_control_board_item(control: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(control, dict) or not control.get("ok"):
        return sanitize_payload({
            "ok": False,
            "plan_id": control.get("plan_id", "") if isinstance(control, dict) else "",
            "reason": control.get("reason", "control_unavailable") if isinstance(control, dict) else "control_unavailable",
        })
    guidance = control.get("guidance", {}) if isinstance(control.get("guidance"), dict) else {}
    runs = control.get("runs", {}) if isinstance(control.get("runs"), dict) else {}
    timeline = control.get("timeline", {}) if isinstance(control.get("timeline"), dict) else {}
    return sanitize_payload({
        "ok": True,
        "plan_id": control.get("plan_id", ""),
        "state": control.get("state", ""),
        "canResume": bool(control.get("canResume", False)),
        "plan": control.get("plan", {}),
        "guidance": {
            "actionType": guidance.get("actionType", ""),
            "reason": guidance.get("reason", ""),
            "message": guidance.get("message", ""),
            "step_id": guidance.get("step_id", ""),
        },
        "nextActionType": (control.get("nextAction") or {}).get("actionType", "")
        if isinstance(control.get("nextAction"), dict)
        else "",
        "latestRun": runs.get("latest", {}) if isinstance(runs, dict) else {},
        "runCount": runs.get("count", 0) if isinstance(runs, dict) else 0,
        "timelineCounts": timeline.get("counts", {}) if isinstance(timeline, dict) else {},
        "endpoints": control.get("endpoints", {}),
    })


def _build_plan_control_board(
    *,
    workspace: str,
    limit: int = 5,
    status: str = "",
    source: str = "",
    allow_low_risk: bool = True,
    max_steps: int = 3,
) -> Dict[str, Any]:
    max_items = _bounded_route_int(limit, 5, minimum=1, maximum=20)
    plans = _kernel_recent_plans(limit=max_items, workspace=workspace, status=status, source=source)
    items: List[Dict[str, Any]] = []
    state_counts: Dict[str, int] = {}
    resumable_count = 0

    for plan_record in plans:
        if not isinstance(plan_record, dict):
            continue
        plan_id = str(plan_record.get("plan_id") or "")
        if not plan_id:
            continue
        control = _build_plan_control_summary(
            workspace=workspace,
            plan_id=plan_id,
            allow_low_risk=allow_low_risk,
            max_steps=max_steps,
        )
        item = _plan_control_board_item(control)
        items.append(item)
        state = str(item.get("state") or item.get("reason") or "unknown")
        state_counts[state] = state_counts.get(state, 0) + 1
        if item.get("canResume"):
            resumable_count += 1

    return sanitize_payload({
        "ok": True,
        "schema": "openxnet.kernel.plan_control_board.v1",
        "workspace": workspace,
        "count": len(items),
        "filters": {
            "limit": max_items,
            "status": status,
            "source": source,
            "allowLowRisk": bool(allow_low_risk),
            "maxSteps": _bounded_route_int(max_steps, 3, minimum=1, maximum=10),
        },
        "summary": {
            "resumable": resumable_count,
            "blocked": len(items) - resumable_count,
            "states": state_counts,
        },
        "items": items,
        "endpoints": {
            "recent": "/v1/kernel/plans/recent",
            "status": "/v1/kernel/plans/status",
            "control": "/v1/kernel/plans/{plan_id}/control",
            "resumePreview": "/v1/kernel/plans/{plan_id}/resume-preview",
            "resume": "/v1/kernel/plans/{plan_id}/resume",
            "timeline": "/v1/kernel/plans/{plan_id}/timeline",
            "runs": "/v1/kernel/plans/{plan_id}/runs",
        },
        "security": {
            "readOnly": True,
            "autoExecutesOnlySafeNoParamSteps": True,
            "rawParamsPersisted": False,
            "rawMessagesReturned": False,
            "resultPreviewReturned": False,
            "rawAuditPayloadReturned": False,
        },
    })


def _plan_action_priority(action_type: str) -> int:
    priorities = {
        "recover_step": 10,
        "resolve_approval": 20,
        "provide_params": 30,
        "manual_risk_review": 40,
        "resume_plan": 50,
        "blocked_dependencies": 60,
        "wait_for_step": 70,
        "plan_complete": 90,
    }
    return priorities.get(str(action_type or ""), 80)


def _plan_action_queue_status(action_type: str, *, can_resume: bool) -> Dict[str, Any]:
    action = str(action_type or "")
    if action == "plan_complete":
        return {
            "status": "complete",
            "severity": "done",
            "requiresHuman": False,
            "requiresApproval": False,
            "isBlocked": False,
            "isComplete": True,
        }
    if can_resume or action in {"resume_plan", "resume_safe_step"}:
        return {
            "status": "resumable",
            "severity": "normal",
            "requiresHuman": False,
            "requiresApproval": False,
            "isBlocked": False,
            "isComplete": False,
        }
    if action == "recover_step":
        return {
            "status": "recovery_required",
            "severity": "critical",
            "requiresHuman": True,
            "requiresApproval": False,
            "isBlocked": True,
            "isComplete": False,
        }
    if action == "resolve_approval":
        return {
            "status": "approval_waiting",
            "severity": "high",
            "requiresHuman": True,
            "requiresApproval": True,
            "isBlocked": True,
            "isComplete": False,
        }
    if action in {"provide_params", "manual_risk_review"}:
        return {
            "status": "human_input_required",
            "severity": "high" if action == "manual_risk_review" else "medium",
            "requiresHuman": True,
            "requiresApproval": False,
            "isBlocked": True,
            "isComplete": False,
        }
    if action == "blocked_dependencies":
        return {
            "status": "dependency_blocked",
            "severity": "medium",
            "requiresHuman": True,
            "requiresApproval": False,
            "isBlocked": True,
            "isComplete": False,
        }
    if action == "wait_for_step":
        return {
            "status": "waiting",
            "severity": "low",
            "requiresHuman": False,
            "requiresApproval": False,
            "isBlocked": True,
            "isComplete": False,
        }
    return {
        "status": "inspect",
        "severity": "medium",
        "requiresHuman": True,
        "requiresApproval": False,
        "isBlocked": True,
        "isComplete": False,
    }


def _plan_action_next_step(action_type: str, primary_endpoint: str) -> Dict[str, Any]:
    labels = {
        "resume_plan": "resume_plan",
        "resume_safe_step": "resume_plan",
        "recover_step": "open_recovery",
        "resolve_approval": "open_approval_center",
        "provide_params": "inspect_step_contract",
        "manual_risk_review": "review_step_risk",
        "blocked_dependencies": "inspect_dependencies",
        "wait_for_step": "wait_for_running_step",
        "plan_complete": "validate_plan_output",
    }
    action = str(action_type or "")
    return sanitize_payload({
        "key": labels.get(action, "inspect_plan"),
        "endpoint": primary_endpoint,
        "safeAutoExecute": action in {"resume_plan", "resume_safe_step"},
    })


def _plan_action_queue_item(item: Dict[str, Any]) -> Dict[str, Any]:
    guidance = item.get("guidance", {}) if isinstance(item.get("guidance"), dict) else {}
    endpoints = item.get("endpoints", {}) if isinstance(item.get("endpoints"), dict) else {}
    plan = item.get("plan", {}) if isinstance(item.get("plan"), dict) else {}
    latest_run = item.get("latestRun", {}) if isinstance(item.get("latestRun"), dict) else {}
    timeline_counts = item.get("timelineCounts", {}) if isinstance(item.get("timelineCounts"), dict) else {}
    plan_id = str(item.get("plan_id") or plan.get("plan_id") or "")
    step_id = str(guidance.get("step_id") or "")

    if item.get("canResume"):
        action_type = "resume_plan"
        reason = guidance.get("reason") or "safe_step_ready"
        message = guidance.get("message") or "Resume auto-executable safe steps."
        primary_endpoint = endpoints.get("resume") or f"/v1/kernel/plans/{plan_id}/resume"
    else:
        action_type = str(guidance.get("actionType") or item.get("state") or "inspect_plan")
        reason = str(guidance.get("reason") or item.get("state") or "")
        message = str(guidance.get("message") or "Inspect the plan control summary before acting.")
        if action_type == "recover_step" and step_id:
            primary_endpoint = f"/v1/kernel/plans/{plan_id}/steps/{step_id}/recovery"
        elif action_type in {"provide_params", "manual_risk_review"} and step_id:
            primary_endpoint = f"/v1/kernel/plans/{plan_id}/steps/{step_id}/contract"
        elif action_type == "resolve_approval":
            primary_endpoint = "/v1/kernel/approvals/pending"
        else:
            primary_endpoint = endpoints.get("control") or f"/v1/kernel/plans/{plan_id}/control"

    priority = _plan_action_priority(action_type)
    updated_at = str(plan.get("updated_at") or latest_run.get("finished_at") or latest_run.get("started_at") or "")
    status = _plan_action_queue_status(action_type, can_resume=bool(item.get("canResume", False)))
    age_seconds = _kernel_age_seconds(updated_at)
    return sanitize_payload({
        "queueKey": f"{plan_id}:{action_type}:{step_id or 'plan'}",
        "plan_id": plan_id,
        "priority": priority,
        "actionType": action_type,
        "reason": reason,
        "message": message,
        "state": item.get("state", ""),
        "queueStatus": status.get("status", "inspect"),
        "severity": status.get("severity", "medium"),
        "requiresHuman": bool(status.get("requiresHuman", False)),
        "requiresApproval": bool(status.get("requiresApproval", False)),
        "isBlocked": bool(status.get("isBlocked", False)),
        "isComplete": bool(status.get("isComplete", False)),
        "step_id": step_id,
        "canResume": bool(item.get("canResume", False)),
        "updatedAt": updated_at,
        "ageSeconds": age_seconds,
        "primaryEndpoint": primary_endpoint,
        "nextStep": _plan_action_next_step(action_type, primary_endpoint),
        "endpoints": {
            "control": endpoints.get("control") or f"/v1/kernel/plans/{plan_id}/control",
            "timeline": endpoints.get("timeline") or f"/v1/kernel/plans/{plan_id}/timeline",
            "runs": endpoints.get("runs") or f"/v1/kernel/plans/{plan_id}/runs",
            "resumePreview": endpoints.get("resumePreview") or f"/v1/kernel/plans/{plan_id}/resume-preview",
            "resume": endpoints.get("resume") or f"/v1/kernel/plans/{plan_id}/resume",
        },
        "plan": {
            "status": plan.get("status", ""),
            "goal_preview": plan.get("goal_preview", ""),
            "updated_at": plan.get("updated_at", ""),
            "highestRisk": plan.get("highestRisk", ""),
        },
        "latestRun": latest_run,
        "lastRunStatus": latest_run.get("status", ""),
        "lastRunStopReason": latest_run.get("stopReason", ""),
        "runCount": item.get("runCount", 0),
        "timelineCounts": timeline_counts,
        "timelineSummary": {
            "events": _sum_count_values(timeline_counts) if timeline_counts else 0,
            "counts": timeline_counts,
        },
    })


def _build_plan_action_queue(
    *,
    workspace: str,
    limit: int = 10,
    status: str = "",
    source: str = "",
    allow_low_risk: bool = True,
    max_steps: int = 3,
    include_complete: bool = False,
    action_type: str = "",
    queue_status: str = "",
    sort: str = "priority",
) -> Dict[str, Any]:
    max_items = _bounded_route_int(limit, 10, minimum=1, maximum=20)
    action_type_filter = str(action_type or "").strip()
    queue_status_filter = str(queue_status or "").strip()
    sort_mode = str(sort or "priority").strip() or "priority"
    board = _build_plan_control_board(
        workspace=workspace,
        limit=max_items,
        status=status,
        source=source,
        allow_low_risk=allow_low_risk,
        max_steps=max_steps,
    )
    board_items = board.get("items", []) if isinstance(board.get("items"), list) else []
    actions: List[Dict[str, Any]] = []
    for item in board_items:
        if not isinstance(item, dict) or not item.get("ok"):
            continue
        action = _plan_action_queue_item(item)
        if not include_complete and action.get("actionType") == "plan_complete":
            continue
        if action_type_filter and action.get("actionType") != action_type_filter:
            continue
        if queue_status_filter:
            if queue_status_filter == "blocked" and not action.get("isBlocked"):
                continue
            if queue_status_filter == "human" and not action.get("requiresHuman"):
                continue
            if queue_status_filter not in {"blocked", "human"} and action.get("queueStatus") != queue_status_filter:
                continue
        actions.append(action)

    if sort_mode == "age":
        actions = sorted(
            actions,
            key=lambda action: (
                -int(action.get("ageSeconds") or 0),
                int(action.get("priority") or 80),
                str(action.get("plan_id") or ""),
            ),
        )
    elif sort_mode == "updated":
        actions = sorted(
            actions,
            key=lambda action: (
                str(action.get("updatedAt") or ""),
                -int(action.get("priority") or 80),
                str(action.get("plan_id") or ""),
            ),
            reverse=True,
        )
    else:
        actions = sorted(
            actions,
            key=lambda action: (
                int(action.get("priority") or 80),
                -int(action.get("ageSeconds") or 0),
                str(action.get("plan_id") or ""),
            ),
        )
    action_counts: Dict[str, int] = {}
    status_counts: Dict[str, int] = {}
    severity_counts: Dict[str, int] = {}
    for action in actions:
        action_type = str(action.get("actionType") or "unknown")
        action_counts[action_type] = action_counts.get(action_type, 0) + 1
        queue_state = str(action.get("queueStatus") or "unknown")
        status_counts[queue_state] = status_counts.get(queue_state, 0) + 1
        severity = str(action.get("severity") or "unknown")
        severity_counts[severity] = severity_counts.get(severity, 0) + 1
    oldest_age = max((int(action.get("ageSeconds") or 0) for action in actions), default=0)
    highest_priority = min((int(action.get("priority") or 80) for action in actions), default=0)
    next_action = actions[0] if actions else {}

    return sanitize_payload({
        "ok": True,
        "schema": "openxnet.kernel.plan_action_queue.v1",
        "workspace": workspace,
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "count": len(actions),
        "filters": {
            "limit": max_items,
            "status": status,
            "source": source,
            "allowLowRisk": bool(allow_low_risk),
            "maxSteps": _bounded_route_int(max_steps, 3, minimum=1, maximum=10),
            "includeComplete": bool(include_complete),
            "actionType": action_type_filter,
            "queueStatus": queue_status_filter,
            "sort": sort_mode,
        },
        "summary": {
            "actions": action_counts,
            "statuses": status_counts,
            "severity": severity_counts,
            "resumable": sum(1 for action in actions if action.get("canResume")),
            "blocked": sum(1 for action in actions if action.get("isBlocked")),
            "requiresHuman": sum(1 for action in actions if action.get("requiresHuman")),
            "requiresApproval": sum(1 for action in actions if action.get("requiresApproval")),
            "complete": sum(1 for action in actions if action.get("isComplete")),
            "oldestAgeSeconds": oldest_age,
            "highestPriority": highest_priority,
            "nextAction": {
                "queueKey": next_action.get("queueKey", ""),
                "plan_id": next_action.get("plan_id", ""),
                "actionType": next_action.get("actionType", ""),
                "queueStatus": next_action.get("queueStatus", ""),
                "priority": next_action.get("priority", 0),
                "message": next_action.get("message", ""),
            },
        },
        "actions": actions,
        "board": {
            "count": board.get("count", 0),
            "summary": board.get("summary", {}),
            "endpoint": "/v1/kernel/plans/control-board",
        },
        "endpoints": {
            "controlBoard": "/v1/kernel/plans/control-board",
            "control": "/v1/kernel/plans/{plan_id}/control",
            "resume": "/v1/kernel/plans/{plan_id}/resume",
            "resumePreview": "/v1/kernel/plans/{plan_id}/resume-preview",
            "approvalsPending": "/v1/kernel/approvals/pending",
        },
        "security": {
            "readOnly": True,
            "autoExecutesOnlySafeNoParamSteps": True,
            "rawParamsPersisted": False,
            "rawMessagesReturned": False,
            "resultPreviewReturned": False,
            "rawAuditPayloadReturned": False,
        },
    })


def _plan_run_result_summary(result: Any) -> Dict[str, Any]:
    if not isinstance(result, dict):
        return {"ok": True, "status": "completed", "resultType": type(result).__name__}
    trace = result.get("trace", {}) if isinstance(result.get("trace"), dict) else {}
    return sanitize_payload({
        "ok": bool(result.get("ok", False)),
        "status": result.get("status", ""),
        "error": result.get("error", ""),
        "plan_id": result.get("plan_id", ""),
        "step_id": result.get("step_id", ""),
        "tool_name": result.get("tool_name", ""),
        "trace": {
            "trace_id": trace.get("trace_id", ""),
            "status": trace.get("status", ""),
            "approval_id": trace.get("approval_id", ""),
            "duration_ms": trace.get("duration_ms", 0),
            "result_type": trace.get("result_type", ""),
            "has_result_preview": bool(trace.get("result_preview")),
            "has_error": bool(trace.get("error")),
            "recovery_hint": trace.get("recovery_hint", ""),
        },
        "planStepUpdate": {
            "status": (result.get("planStepUpdate") or {}).get("status", "")
            if isinstance(result.get("planStepUpdate"), dict)
            else "",
            "plan_id": (result.get("planStepUpdate") or {}).get("plan_id", "")
            if isinstance(result.get("planStepUpdate"), dict)
            else "",
        },
    })


def _plan_control_decision_summary(decision: Any) -> Dict[str, Any]:
    if not isinstance(decision, dict):
        return {}
    next_action = decision.get("nextAction", {}) if isinstance(decision.get("nextAction"), dict) else {}
    step = next_action.get("step", {}) if isinstance(next_action.get("step"), dict) else {}
    summary: Dict[str, Any] = {
        "plan_id": decision.get("plan_id") or next_action.get("plan_id") or "",
        "action": next_action.get("actionType") or "",
        "step_id": decision.get("step_id") or step.get("step_id") or "",
        "tool_name": decision.get("tool_name") or step.get("tool_name") or "",
        "reason": decision.get("reason") or next_action.get("reason") or "",
        "canAdvance": bool(decision.get("canAdvance", False)),
        "status": step.get("status") or "",
        "trace_id": step.get("last_trace_id") or "",
    }
    return {key: value for key, value in summary.items() if value not in ("", None)}


def _plan_control_result_summary(result_summary: Any) -> Dict[str, Any]:
    if not isinstance(result_summary, dict):
        return {}
    trace = result_summary.get("trace", {}) if isinstance(result_summary.get("trace"), dict) else {}
    step_update = (
        result_summary.get("planStepUpdate", {})
        if isinstance(result_summary.get("planStepUpdate"), dict)
        else {}
    )
    summary: Dict[str, Any] = {
        "plan_id": result_summary.get("plan_id") or step_update.get("plan_id") or "",
        "step_id": result_summary.get("step_id") or "",
        "tool_name": result_summary.get("tool_name") or "",
        "trace_id": trace.get("trace_id") or "",
        "status": result_summary.get("status") or trace.get("status") or step_update.get("status") or "",
    }
    return {key: value for key, value in summary.items() if value not in ("", None)}


def _emit_plan_control_event(
    workspace: str,
    event_type: str,
    *,
    plan_id: str = "",
    decision: Any = None,
    result_summary: Any = None,
    **fields: Any,
) -> Dict[str, Any]:
    allowed = (
        "plan_id",
        "run_id",
        "iteration",
        "action",
        "step_id",
        "tool_name",
        "reason",
        "stopReason",
        "advancedCount",
        "maxSteps",
        "previousRunId",
        "dryRun",
        "canAdvance",
        "trace_id",
        "status",
    )
    payload: Dict[str, Any] = {}
    payload.update(_plan_control_decision_summary(decision))
    payload.update(_plan_control_result_summary(result_summary))
    payload.update({key: value for key, value in fields.items() if key in allowed})
    if plan_id:
        payload["plan_id"] = plan_id
    compact = {
        key: payload[key]
        for key in allowed
        if key in payload and payload[key] not in ("", None, [], {})
    }
    try:
        return get_kernel_audit(workspace).append(
            event_type,
            compact,
            actor="user",
            workspace_dir=workspace,
        )
    except Exception:
        return {}


def _config_intent_settings(settings: Dict[str, Any]) -> Dict[str, Any]:
    kernel_settings = settings.get("kernelSettings", {}) if isinstance(settings, dict) else {}
    config_settings = kernel_settings.get("configIntent", {}) if isinstance(kernel_settings, dict) else {}
    return config_settings if isinstance(config_settings, dict) else {}


@router.get("/status")
async def kernel_status():
    settings = await _load_settings()
    workspace = _workspace_from_settings(settings)
    return {
        "ok": True,
        "diagnostics": _kernel_diagnostics(),
        "runtime": _kernel_runtime_status(settings),
        "events": get_kernel_event_bus().status(),
        "guidance": get_guidance_bus().status(),
        "skills": get_skill_lifecycle(workspace).summary(),
        "policy": get_policy_gate().status(settings),
        "approvals": get_approval_center().status(workspace),
        "traces": get_kernel_executor().status(workspace),
        "pendingConfigIntents": pending_config_intents(workspace),
        "world": {
            "schema": "openxnet.kernel.world_state.v1",
            "endpoint": "/v1/kernel/world",
        },
        "planner": {
            "schema": "openxnet.kernel.plan.v1",
            "endpoint": "/v1/kernel/plan",
            "statusEndpoint": "/v1/kernel/plans/status",
            "recentEndpoint": "/v1/kernel/plans/recent",
            "controlBoardEndpoint": "/v1/kernel/plans/control-board",
            "actionQueueEndpoint": "/v1/kernel/plans/action-queue",
            "detailEndpoint": "/v1/kernel/plans/{plan_id}",
            "controlEndpoint": "/v1/kernel/plans/{plan_id}/control",
            "tracesEndpoint": "/v1/kernel/plans/{plan_id}/traces",
            "timelineEndpoint": "/v1/kernel/plans/{plan_id}/timeline",
            "runsEndpoint": "/v1/kernel/plans/{plan_id}/runs",
            "nextActionEndpoint": "/v1/kernel/plans/{plan_id}/next-action",
            "advanceEndpoint": "/v1/kernel/plans/{plan_id}/advance",
            "runEndpoint": "/v1/kernel/plans/{plan_id}/run",
            "resumeEndpoint": "/v1/kernel/plans/{plan_id}/resume",
            "resumePreviewEndpoint": "/v1/kernel/plans/{plan_id}/resume-preview",
            "stepContractEndpoint": "/v1/kernel/plans/{plan_id}/steps/{step_id}/contract",
            "stepRecoveryEndpoint": "/v1/kernel/plans/{plan_id}/steps/{step_id}/recovery",
            "stepExecuteEndpoint": "/v1/kernel/plans/{plan_id}/steps/{step_id}/execute",
            "status": _kernel_plan_status(workspace),
            "recent": _kernel_recent_plans(limit=3, workspace=workspace),
        },
        "skillLifecycle": {
            "schema": "openxnet.kernel.skill_engineering.v2",
            "endpoint": "/v1/kernel/skills/lifecycle",
            "candidatesEndpoint": "/v1/kernel/skills/candidates",
            "sleepCycleEndpoint": "/v1/kernel/skills/lifecycle/sleep-cycle",
            "changeProposalsEndpoint": "/v1/kernel/skills/change-proposals",
            "selectionEndpoint": "/v1/kernel/skills/select",
        },
        "workspace": workspace,
    }


@router.get("/manifest")
async def kernel_manifest():
    settings = await _load_settings()
    return build_system_manifest(settings, kernel_diagnostics=_kernel_diagnostics())


@router.get("/runtime")
async def kernel_runtime_status():
    settings = await _load_settings()
    return {"ok": True, "runtime": _kernel_runtime_status(settings)}


@router.post("/runtime/mode")
async def kernel_runtime_mode(req: RuntimeModeRequest):
    settings = await _load_settings()
    workspace = _workspace_from_settings(settings)
    mode = normalize_runtime_mode(req.mode, default="")
    if not mode:
        return {"ok": False, "reason": "unsupported_runtime_mode", "mode": req.mode}
    profile = kernel_mode_profile(mode)
    if mode == "kernel" and not req.persist:
        return sanitize_payload({
            "ok": False,
            "reason": "kernel_mode_requires_persisted_profile",
            "mode": mode,
            "profile": profile,
            "confirmation": "Kernel Mode must be persisted so PolicyGate enforcement and planner context injection are applied to live requests.",
        })
    if profile.get("requiresConfirmation") and not req.confirmed:
        return sanitize_payload({
            "ok": False,
            "reason": "confirmation_required",
            "mode": mode,
            "profile": profile,
            "confirmation": "Set confirmed=true to activate this kernel runtime profile.",
        })
    if not _kernel_ref:
        return {"ok": False, "reason": "kernel_ref_not_configured", "mode": mode}
    kernel = _kernel_ref()
    if not kernel or not hasattr(kernel, "set_mode"):
        return {"ok": False, "reason": "kernel_runtime_not_available", "mode": mode}

    result = kernel.set_mode(
        mode,
        reason=req.reason or "runtime_mode_api",
        actor="user",
        manual_override=not req.persist,
    )
    if req.persist:
        if req.apply_profile is False:
            next_settings = copy.deepcopy(settings)
            kernel_settings = next_settings.setdefault("kernelSettings", {})
            runtime_settings = kernel_settings.setdefault("runtime", {})
            runtime_settings["mode"] = mode
            kernel_settings["mode"] = mode
            kernel_settings["enabled"] = mode != "off"
        else:
            next_settings, profile = apply_runtime_mode_profile(settings, mode)
        await _save_settings(next_settings)
        await _broadcast_settings(next_settings)
        result["persisted"] = True
        result["profileApplied"] = req.apply_profile is not False
    else:
        result["persisted"] = False
        result["profileApplied"] = False
    result["modeProfile"] = profile
    result["activation"] = sanitize_payload({
        "runtimeMode": mode,
        "policyEnforcement": profile.get("policyEnforcement", "shadow"),
        "planner": profile.get("planner", {}),
        "executionAuthority": profile.get("executionAuthority", ""),
        "settingsPersisted": bool(req.persist),
    })

    get_kernel_audit(workspace).append(
        "kernel.runtime.mode_changed",
        {
            "mode": mode,
            "reason": req.reason,
            "persisted": bool(req.persist),
            "confirmed": bool(req.confirmed),
            "result": result,
        },
        actor="user",
        workspace_dir=workspace,
    )
    return result


@router.get("/world")
async def kernel_world_state():
    settings = await _load_settings()
    return {
        "ok": True,
        "world": build_world_state(
            settings,
            kernel_diagnostics=_kernel_diagnostics(),
            include_recent=True,
        ),
    }


@router.post("/world")
async def kernel_world_state_with_context(req: WorldStateRequest):
    settings = await _load_settings()
    return {
        "ok": True,
        "world": build_world_state(
            settings,
            messages=req.messages,
            model=req.model or settings.get("model", ""),
            kernel_diagnostics=_kernel_diagnostics(),
            include_recent=req.include_recent,
        ),
    }


@router.post("/plan")
async def kernel_plan(req: KernelPlanRequest):
    settings = await _load_settings()
    if _kernel_ref:
        try:
            kernel = _kernel_ref()
            if kernel and hasattr(kernel, "plan_turn"):
                result = kernel.plan_turn(
                    settings,
                    goal=req.goal,
                    messages=req.messages,
                    model=req.model or settings.get("model", ""),
                    candidate_tools=req.candidate_tools,
                    kernel_diagnostics=_kernel_diagnostics(),
                    include_world=req.include_world,
                    source="api",
                    actor="user",
                    force=True,
                )
                if result.get("plan"):
                    return {"ok": bool(result.get("ok")), "plan": result.get("plan"), "summary": result.get("summary")}
                return result
        except Exception:
            pass
    return {
        "ok": True,
        "plan": build_kernel_plan(
            settings,
            goal=req.goal,
            messages=req.messages,
            model=req.model or settings.get("model", ""),
            candidate_tools=req.candidate_tools,
            kernel_diagnostics=_kernel_diagnostics(),
            include_world=req.include_world,
        ),
    }


@router.get("/plans/recent")
async def kernel_recent_plans(limit: int = 20, status: str = "", source: str = ""):
    settings = await _load_settings()
    workspace = _workspace_from_settings(settings)
    return {
        "ok": True,
        "workspace": workspace,
        "plans": _kernel_recent_plans(limit=limit, workspace=workspace, status=status, source=source),
    }


@router.get("/plans/status")
async def kernel_plans_status():
    settings = await _load_settings()
    workspace = _workspace_from_settings(settings)
    return {"ok": True, "workspace": workspace, "plans": _kernel_plan_status(workspace)}


@router.get("/plans/control-board")
async def kernel_plan_control_board(
    limit: int = 5,
    status: str = "",
    source: str = "",
    allow_low_risk: bool = True,
    max_steps: int = 3,
):
    settings = await _load_settings()
    workspace = _workspace_from_settings(settings)
    return _build_plan_control_board(
        workspace=workspace,
        limit=limit,
        status=status,
        source=source,
        allow_low_risk=bool(allow_low_risk),
        max_steps=max_steps,
    )


@router.get("/plans/action-queue")
async def kernel_plan_action_queue(
    limit: int = 10,
    status: str = "",
    source: str = "",
    allow_low_risk: bool = True,
    max_steps: int = 3,
    include_complete: bool = False,
    action_type: str = "",
    queue_status: str = "",
    sort: str = "priority",
):
    settings = await _load_settings()
    workspace = _workspace_from_settings(settings)
    return _build_plan_action_queue(
        workspace=workspace,
        limit=limit,
        status=status,
        source=source,
        allow_low_risk=bool(allow_low_risk),
        max_steps=max_steps,
        include_complete=bool(include_complete),
        action_type=action_type,
        queue_status=queue_status,
        sort=sort,
    )


@router.get("/plans/{plan_id}/next-action")
async def kernel_plan_next_action(plan_id: str):
    settings = await _load_settings()
    workspace = _workspace_from_settings(settings)
    record = _kernel_plan_detail(plan_id, workspace=workspace)
    if not record:
        return {"ok": False, "reason": "plan_not_found", "plan_id": plan_id, "workspace": workspace}
    plan = record.get("plan", {}) if isinstance(record, dict) else {}
    action = get_kernel_executor().plan_next_action(workspace_dir=workspace, plan=plan)
    action["workspace"] = workspace
    return action


@router.get("/plans/{plan_id}/control")
async def kernel_plan_control(plan_id: str, allow_low_risk: bool = True, max_steps: int = 3):
    settings = await _load_settings()
    workspace = _workspace_from_settings(settings)
    return _build_plan_control_summary(
        workspace=workspace,
        plan_id=plan_id,
        allow_low_risk=bool(allow_low_risk),
        max_steps=max_steps,
    )


@router.post("/plans/{plan_id}/advance")
async def kernel_plan_advance(plan_id: str, req: PlanAdvanceRequest):
    settings = await _load_settings()
    workspace = _workspace_from_settings(settings)
    record = _kernel_plan_detail(plan_id, workspace=workspace)
    if not record:
        _emit_plan_control_event(
            workspace,
            "kernel.plan.advance.stopped",
            plan_id=plan_id,
            reason="plan_not_found",
            stopReason="plan_not_found",
            canAdvance=False,
            dryRun=bool(req.dry_run),
        )
        return {"ok": False, "reason": "plan_not_found", "plan_id": plan_id, "workspace": workspace}
    plan = record.get("plan", {}) if isinstance(record, dict) else {}
    executor = get_kernel_executor()
    decision = executor.plan_advance_decision(
        workspace_dir=workspace,
        plan=plan,
        allow_low_risk=bool(req.allow_low_risk),
    )
    decision["workspace"] = workspace
    if not decision.get("canAdvance"):
        _emit_plan_control_event(
            workspace,
            "kernel.plan.advance.stopped",
            plan_id=plan_id,
            decision=decision,
            stopReason=decision.get("reason", ""),
            dryRun=bool(req.dry_run),
        )
        return decision
    if req.dry_run:
        decision["dryRun"] = True
        decision["executed"] = False
        _emit_plan_control_event(
            workspace,
            "kernel.plan.advance.dry_run",
            plan_id=plan_id,
            decision=decision,
            dryRun=True,
        )
        return decision
    if not _plan_step_execute_handler:
        _emit_plan_control_event(
            workspace,
            "kernel.plan.advance.stopped",
            plan_id=plan_id,
            decision=decision,
            reason="plan_step_execute_handler_not_configured",
            stopReason="plan_step_execute_handler_not_configured",
        )
        return {"ok": False, "reason": "plan_step_execute_handler_not_configured", "decision": decision, "workspace": workspace}

    payload = {
        "plan_id": plan_id,
        "step_id": decision.get("step_id", ""),
        "tool_params": decision.get("tool_params", {}),
        "approval_id": "",
        "reason": req.reason or "plan_advance",
        "confirmed": False,
    }
    result = _plan_step_execute_handler(record, payload, settings)
    if hasattr(result, "__await__"):
        result = await result
    result_summary = _plan_run_result_summary(result)
    _emit_plan_control_event(
        workspace,
        "kernel.plan.advance.executed",
        plan_id=plan_id,
        decision=decision,
        result_summary=result_summary,
        status=result_summary.get("status", "completed"),
    )
    return {
        "ok": bool(result.get("ok")) if isinstance(result, dict) else True,
        "advanced": True,
        "workspace": workspace,
        "decision": decision,
        "result": result,
    }


@router.post("/plans/{plan_id}/run")
async def kernel_plan_run(plan_id: str, req: PlanRunRequest):
    settings = await _load_settings()
    workspace = _workspace_from_settings(settings)
    executor = get_kernel_executor()
    max_steps = _bounded_route_int(req.max_steps, 3, minimum=1, maximum=10)
    run_id = _new_plan_run_id(req.run_id or req.runId)
    history: List[Dict[str, Any]] = []
    advanced_count = 0

    for index in range(max_steps):
        iteration = index + 1
        record = _kernel_plan_detail(plan_id, workspace=workspace)
        if not record:
            _emit_plan_control_event(
                workspace,
                "kernel.plan.run.stopped",
                plan_id=plan_id,
                run_id=run_id,
                iteration=iteration,
                reason="plan_not_found",
                stopReason="plan_not_found",
                advancedCount=advanced_count,
                maxSteps=max_steps,
                dryRun=bool(req.dry_run),
                canAdvance=False,
            )
            return {"ok": False, "reason": "plan_not_found", "plan_id": plan_id, "runId": run_id, "workspace": workspace}
        plan = record.get("plan", {}) if isinstance(record, dict) else {}
        decision = executor.plan_advance_decision(
            workspace_dir=workspace,
            plan=plan,
            allow_low_risk=bool(req.allow_low_risk),
        )
        decision["workspace"] = workspace
        item: Dict[str, Any] = {
            "runId": run_id,
            "iteration": iteration,
            "decision": decision,
        }
        history.append(item)

        if not decision.get("canAdvance"):
            next_action = decision.get("nextAction", {}) if isinstance(decision.get("nextAction"), dict) else {}
            stop_reason = "plan_complete" if next_action.get("actionType") == "plan_complete" else decision.get("reason", "")
            response = {
                "ok": True,
                "advanced": advanced_count > 0,
                "advancedCount": advanced_count,
                "runId": run_id,
                "stopped": True,
                "stopReason": stop_reason,
                "workspace": workspace,
                "dryRun": bool(req.dry_run),
                "history": history,
                "nextAction": next_action,
                "security": {
                    "autoExecutesOnlySafeNoParamSteps": True,
                    "maxSteps": max_steps,
                    "rawParamsPersisted": False,
                    "rawMessagesReturned": False,
                    "resultPreviewReturned": False,
                },
            }
            _emit_plan_control_event(
                workspace,
                "kernel.plan.run.finished" if stop_reason == "plan_complete" else "kernel.plan.run.stopped",
                plan_id=plan_id,
                run_id=run_id,
                iteration=iteration,
                decision=decision,
                stopReason=stop_reason,
                advancedCount=advanced_count,
                maxSteps=max_steps,
                dryRun=bool(req.dry_run),
            )
            return response

        if req.dry_run:
            response = {
                "ok": True,
                "advanced": False,
                "advancedCount": 0,
                "runId": run_id,
                "stopped": True,
                "stopReason": "dry_run",
                "workspace": workspace,
                "dryRun": True,
                "history": history,
                "wouldAdvance": True,
                "security": {
                    "autoExecutesOnlySafeNoParamSteps": True,
                    "maxSteps": max_steps,
                    "rawParamsPersisted": False,
                    "rawMessagesReturned": False,
                    "resultPreviewReturned": False,
                },
            }
            _emit_plan_control_event(
                workspace,
                "kernel.plan.run.dry_run",
                plan_id=plan_id,
                run_id=run_id,
                iteration=iteration,
                decision=decision,
                stopReason="dry_run",
                advancedCount=0,
                maxSteps=max_steps,
                dryRun=True,
            )
            return response

        if not _plan_step_execute_handler:
            response = {
                "ok": False,
                "reason": "plan_step_execute_handler_not_configured",
                "runId": run_id,
                "workspace": workspace,
                "history": history,
            }
            _emit_plan_control_event(
                workspace,
                "kernel.plan.run.stopped",
                plan_id=plan_id,
                run_id=run_id,
                iteration=iteration,
                decision=decision,
                reason="plan_step_execute_handler_not_configured",
                stopReason="plan_step_execute_handler_not_configured",
                advancedCount=advanced_count,
                maxSteps=max_steps,
                dryRun=False,
            )
            return response

        payload = {
            "plan_id": plan_id,
            "step_id": decision.get("step_id", ""),
            "tool_params": decision.get("tool_params", {}),
            "approval_id": "",
            "reason": req.reason or "plan_run",
            "confirmed": False,
            "run_id": run_id,
            "iteration": iteration,
        }
        result = _plan_step_execute_handler(record, payload, settings)
        if hasattr(result, "__await__"):
            result = await result
        result_summary = _plan_run_result_summary(result)
        item["result"] = result_summary
        if not result_summary.get("ok"):
            response = {
                "ok": True,
                "advanced": advanced_count > 0,
                "advancedCount": advanced_count,
                "runId": run_id,
                "stopped": True,
                "stopReason": "execution_failed",
                "workspace": workspace,
                "dryRun": False,
                "history": history,
                "security": {
                    "autoExecutesOnlySafeNoParamSteps": True,
                    "maxSteps": max_steps,
                    "rawParamsPersisted": False,
                    "rawMessagesReturned": False,
                    "resultPreviewReturned": False,
                },
            }
            _emit_plan_control_event(
                workspace,
                "kernel.plan.run.stopped",
                plan_id=plan_id,
                run_id=run_id,
                iteration=iteration,
                decision=decision,
                result_summary=result_summary,
                reason="execution_failed",
                stopReason="execution_failed",
                advancedCount=advanced_count,
                maxSteps=max_steps,
                dryRun=False,
                status=result_summary.get("status", "failed"),
            )
            return response
        advanced_count += 1
        _emit_plan_control_event(
            workspace,
            "kernel.plan.run.step_executed",
            plan_id=plan_id,
            run_id=run_id,
            iteration=iteration,
            decision=decision,
            result_summary=result_summary,
            advancedCount=advanced_count,
            maxSteps=max_steps,
            dryRun=False,
            status=result_summary.get("status", "completed"),
        )

    final_record = _kernel_plan_detail(plan_id, workspace=workspace)
    final_plan = final_record.get("plan", {}) if isinstance(final_record, dict) else {}
    final_action = executor.plan_next_action(workspace_dir=workspace, plan=final_plan) if final_plan else {}
    final_action["workspace"] = workspace
    stop_reason = "plan_complete" if final_action.get("actionType") == "plan_complete" else "max_steps_reached"
    response = {
        "ok": True,
        "advanced": advanced_count > 0,
        "advancedCount": advanced_count,
        "runId": run_id,
        "stopped": True,
        "stopReason": stop_reason,
        "workspace": workspace,
        "dryRun": False,
        "history": history,
        "nextAction": final_action,
        "security": {
            "autoExecutesOnlySafeNoParamSteps": True,
            "maxSteps": max_steps,
            "rawParamsPersisted": False,
            "rawMessagesReturned": False,
            "resultPreviewReturned": False,
        },
    }
    _emit_plan_control_event(
        workspace,
        "kernel.plan.run.finished",
        plan_id=plan_id,
        run_id=run_id,
        iteration=len(history),
        decision={"nextAction": final_action, "canAdvance": False},
        stopReason=stop_reason,
        advancedCount=advanced_count,
        maxSteps=max_steps,
        dryRun=False,
    )
    return response


@router.get("/plans/{plan_id}/resume-preview")
async def kernel_plan_resume_preview(plan_id: str, allow_low_risk: bool = True, max_steps: int = 3):
    settings = await _load_settings()
    workspace = _workspace_from_settings(settings)
    return _build_plan_resume_preview(
        workspace=workspace,
        plan_id=plan_id,
        allow_low_risk=bool(allow_low_risk),
        max_steps=max_steps,
    )


@router.post("/plans/{plan_id}/resume")
async def kernel_plan_resume(plan_id: str, req: PlanResumeRequest):
    settings = await _load_settings()
    workspace = _workspace_from_settings(settings)
    record = _kernel_plan_detail(plan_id, workspace=workspace)
    run_id = _new_plan_run_id(req.run_id or req.runId)
    max_steps = _bounded_route_int(req.max_steps, 3, minimum=1, maximum=10)
    latest_run = _latest_plan_run(workspace, plan_id)
    previous_run_id = str(latest_run.get("run_id") or "")

    if not record:
        _emit_plan_control_event(
            workspace,
            "kernel.plan.resume.stopped",
            plan_id=plan_id,
            run_id=run_id,
            previousRunId=previous_run_id,
            reason="plan_not_found",
            stopReason="plan_not_found",
            maxSteps=max_steps,
            dryRun=bool(req.dry_run),
            canAdvance=False,
        )
        return {"ok": False, "reason": "plan_not_found", "plan_id": plan_id, "runId": run_id, "workspace": workspace}

    plan = record.get("plan", {}) if isinstance(record, dict) else {}
    decision = get_kernel_executor().plan_advance_decision(
        workspace_dir=workspace,
        plan=plan,
        allow_low_risk=bool(req.allow_low_risk),
    )
    decision["workspace"] = workspace

    if not decision.get("canAdvance"):
        next_action = decision.get("nextAction", {}) if isinstance(decision.get("nextAction"), dict) else {}
        stop_reason = "plan_complete" if next_action.get("actionType") == "plan_complete" else decision.get("reason", "")
        response = {
            "ok": True,
            "resumed": False,
            "advanced": False,
            "advancedCount": 0,
            "runId": run_id,
            "previousRunId": previous_run_id,
            "stopped": True,
            "stopReason": stop_reason,
            "workspace": workspace,
            "dryRun": bool(req.dry_run),
            "latestRun": latest_run,
            "nextAction": next_action,
            "security": {
                "autoExecutesOnlySafeNoParamSteps": True,
                "maxSteps": max_steps,
                "rawParamsPersisted": False,
                "rawMessagesReturned": False,
                "resultPreviewReturned": False,
            },
        }
        _emit_plan_control_event(
            workspace,
            "kernel.plan.resume.finished" if stop_reason == "plan_complete" else "kernel.plan.resume.stopped",
            plan_id=plan_id,
            run_id=run_id,
            previousRunId=previous_run_id,
            decision=decision,
            stopReason=stop_reason,
            advancedCount=0,
            maxSteps=max_steps,
            dryRun=bool(req.dry_run),
        )
        return response

    if req.dry_run:
        response = {
            "ok": True,
            "resumed": False,
            "advanced": False,
            "advancedCount": 0,
            "runId": run_id,
            "previousRunId": previous_run_id,
            "stopped": True,
            "stopReason": "dry_run",
            "workspace": workspace,
            "dryRun": True,
            "wouldResume": True,
            "latestRun": latest_run,
            "decision": decision,
            "security": {
                "autoExecutesOnlySafeNoParamSteps": True,
                "maxSteps": max_steps,
                "rawParamsPersisted": False,
                "rawMessagesReturned": False,
                "resultPreviewReturned": False,
            },
        }
        _emit_plan_control_event(
            workspace,
            "kernel.plan.resume.dry_run",
            plan_id=plan_id,
            run_id=run_id,
            previousRunId=previous_run_id,
            decision=decision,
            stopReason="dry_run",
            advancedCount=0,
            maxSteps=max_steps,
            dryRun=True,
        )
        return response

    result = await kernel_plan_run(
        plan_id,
        PlanRunRequest(
            dry_run=False,
            allow_low_risk=bool(req.allow_low_risk),
            max_steps=max_steps,
            reason=req.reason or "plan_resume",
            run_id=run_id,
        ),
    )
    if isinstance(result, dict):
        result["resumed"] = bool(result.get("advanced", False))
        result["previousRunId"] = previous_run_id
        result["latestRun"] = latest_run
    _emit_plan_control_event(
        workspace,
        "kernel.plan.resume.finished",
        plan_id=plan_id,
        run_id=run_id,
        iteration=len(result.get("history", [])) if isinstance(result, dict) and isinstance(result.get("history"), list) else 0,
        previousRunId=previous_run_id,
        decision=decision,
        stopReason=result.get("stopReason", "") if isinstance(result, dict) else "",
        advancedCount=result.get("advancedCount", 0) if isinstance(result, dict) else 0,
        maxSteps=max_steps,
        dryRun=False,
        status="finished" if isinstance(result, dict) and result.get("ok", True) else "stopped",
    )
    return result


@router.get("/plans/{plan_id}/traces")
async def kernel_plan_traces(plan_id: str, limit: int = 100, status: str = ""):
    settings = await _load_settings()
    workspace = _workspace_from_settings(settings)
    traces = get_kernel_executor().traces_for_plan(
        workspace_dir=workspace,
        plan_id=plan_id,
        limit=limit,
        status=status,
    )
    return {
        "ok": True,
        "workspace": workspace,
        "plan_id": plan_id,
        "count": len(traces),
        "traces": traces,
    }


@router.get("/plans/{plan_id}/runs")
async def kernel_plan_runs(plan_id: str, limit: int = 100):
    settings = await _load_settings()
    workspace = _workspace_from_settings(settings)
    return build_plan_run_history(workspace, plan_id, limit=limit)


@router.get("/plans/{plan_id}/timeline")
async def kernel_plan_timeline(plan_id: str, limit: int = 100, status: str = "", include_plan: bool = False):
    settings = await _load_settings()
    workspace = _workspace_from_settings(settings)
    return build_plan_timeline(
        workspace,
        plan_id,
        trace_limit=limit,
        trace_status=status,
        include_plan=include_plan,
    )


@router.get("/plans/{plan_id}/steps/{step_id}/contract")
async def kernel_plan_step_contract(plan_id: str, step_id: str):
    settings = await _load_settings()
    workspace = _workspace_from_settings(settings)
    record = _kernel_plan_detail(plan_id, workspace=workspace)
    if not record:
        return {"ok": False, "reason": "plan_not_found", "plan_id": plan_id, "workspace": workspace}
    plan = record.get("plan", {}) if isinstance(record, dict) else {}
    contract = get_kernel_executor().plan_step_contract(plan=plan, step_id=step_id)
    contract["workspace"] = workspace
    return contract


@router.get("/plans/{plan_id}/steps/{step_id}/recovery")
async def kernel_plan_step_recovery(plan_id: str, step_id: str):
    settings = await _load_settings()
    workspace = _workspace_from_settings(settings)
    record = _kernel_plan_detail(plan_id, workspace=workspace)
    if not record:
        return {"ok": False, "reason": "plan_not_found", "plan_id": plan_id, "workspace": workspace}
    plan = record.get("plan", {}) if isinstance(record, dict) else {}
    recovery = get_kernel_executor().plan_step_recovery(
        workspace_dir=workspace,
        plan=plan,
        step_id=step_id,
    )
    recovery["workspace"] = workspace
    return recovery


@router.post("/plans/{plan_id}/steps/{step_id}/execute")
async def kernel_plan_step_execute(plan_id: str, step_id: str, req: PlanStepExecuteRequest):
    settings = await _load_settings()
    workspace = _workspace_from_settings(settings)
    record = _kernel_plan_detail(plan_id, workspace=workspace)
    if not record:
        return {"ok": False, "reason": "plan_not_found", "plan_id": plan_id, "workspace": workspace}
    plan = record.get("plan", {}) if isinstance(record, dict) else {}
    contract = get_kernel_executor().plan_step_contract(plan=plan, step_id=step_id)
    if not contract.get("ok"):
        contract["workspace"] = workspace
        return contract
    missing_keys = [
        key for key in contract.get("requiredParamKeys", [])
        if key not in (req.tool_params or {})
    ]
    if missing_keys:
        return {
            "ok": False,
            "reason": "missing_required_params",
            "missing": missing_keys,
            "contract": contract,
            "workspace": workspace,
        }
    if contract.get("requires_approval") and not req.confirmed and not req.approval_id:
        return {
            "ok": False,
            "reason": "confirmation_required",
            "contract": contract,
            "confirmation": "Set confirmed=true or provide approval_id to execute this governed plan step.",
            "workspace": workspace,
        }
    if not _plan_step_execute_handler:
        return {"ok": False, "reason": "plan_step_execute_handler_not_configured", "workspace": workspace}
    payload = {
        "plan_id": plan_id,
        "step_id": step_id,
        "tool_params": req.tool_params or {},
        "approval_id": req.approval_id,
        "reason": req.reason or "plan_step_execution",
        "confirmed": bool(req.confirmed),
    }
    result = _plan_step_execute_handler(record, payload, settings)
    if hasattr(result, "__await__"):
        result = await result
    return result


@router.get("/plans/{plan_id}")
async def kernel_plan_detail(plan_id: str):
    settings = await _load_settings()
    workspace = _workspace_from_settings(settings)
    plan = _kernel_plan_detail(plan_id, workspace=workspace)
    if not plan:
        return {"ok": False, "reason": "plan_not_found", "plan_id": plan_id, "workspace": workspace}
    return {"ok": True, "workspace": workspace, "plan": plan}


@router.post("/conversation/state")
async def conversation_state(req: ConversationStateRequest):
    settings = await _load_settings()
    model = req.model or settings.get("model", "")
    return {"ok": True, "state": build_conversation_state(req.messages, model).to_dict()}


@router.get("/skills/lifecycle")
async def kernel_skill_lifecycle(status: str = "", limit: int = 100):
    settings = await _load_settings()
    workspace = _workspace_from_settings(settings)
    lifecycle = get_skill_lifecycle(workspace)
    return {
        "ok": True,
        "workspace": workspace,
        "summary": lifecycle.summary(),
        "skills": lifecycle.list_lifecycle(status=status, limit=limit),
    }


@router.get("/skills/candidates")
async def kernel_skill_candidates(limit: int = 100):
    settings = await _load_settings()
    workspace = _workspace_from_settings(settings)
    lifecycle = get_skill_lifecycle(workspace)
    return {
        "ok": True,
        "workspace": workspace,
        "summary": lifecycle.summary(),
        "candidates": lifecycle.list_lifecycle(status="candidate", limit=limit),
    }


@router.post("/skills/lifecycle/task-completed")
async def kernel_skill_task_completed(req: SkillLifecycleTaskRequest):
    settings = await _load_settings()
    workspace = _workspace_from_settings(settings)
    lifecycle = get_skill_lifecycle(workspace)
    result = await lifecycle.on_task_completed(
        {
            "success": req.success,
            "summary": req.summary,
            "strategy": req.strategy,
            "trigger_context": req.trigger_context,
            "workflow": req.workflow,
            "verification": req.verification,
            "rollback": req.rollback,
            "counter_examples": req.counter_examples,
            "source_event_ids": req.source_event_ids,
            "environment_fingerprint": req.environment_fingerprint,
            "problem_fingerprint": req.problem_fingerprint,
            "family_id": req.family_id,
            "strategy_id": req.strategy_id,
            "strategy_description": req.strategy_description,
            "risk_level": req.risk_level,
            "cost_score": req.cost_score,
            "parent_event_id": req.parent_event_id,
            "mutation_rule": req.mutation_rule,
            "expected_invariant": req.expected_invariant,
            "verification_oracle": req.verification_oracle,
        },
        req.tools_used,
        input_text=req.input_text,
        source_event_ids=req.source_event_ids,
        source=req.source,
        evidence_origin=req.evidence_origin,
        derivation_method=req.derivation_method,
        environment_scope=req.environment_scope,
        environment_fingerprint=req.environment_fingerprint,
        problem_fingerprint=req.problem_fingerprint,
        family_id=req.family_id,
        strategy_id=req.strategy_id,
        parent_event_id=req.parent_event_id,
        mutation_rule=req.mutation_rule,
        expected_invariant=req.expected_invariant,
        verification_oracle=req.verification_oracle,
    )
    return result


@router.post("/skills/lifecycle/sleep-cycle")
async def kernel_skill_lifecycle_sleep_cycle():
    settings = await _load_settings()
    workspace = _workspace_from_settings(settings)
    return await get_skill_lifecycle(workspace).run_sleep_cycle()


@router.get("/skills/change-proposals")
async def kernel_skill_change_proposals(status: str = "", limit: int = 100):
    """列出离线技能巩固产生的待审批变更提案。"""

    settings = await _load_settings()
    workspace = _workspace_from_settings(settings)
    lifecycle = get_skill_lifecycle(workspace)
    return {
        "ok": True,
        "workspace": workspace,
        "proposals": lifecycle.list_change_proposals(status=status, limit=limit),
    }


@router.post("/skills/change-proposals/{proposal_id}/resolve")
async def kernel_skill_change_proposal_resolve(
    proposal_id: str,
    req: SkillChangeProposalResolveRequest,
):
    """审批或拒绝一个 Skill 变更提案，并按认证范围执行受控迁移。"""

    settings = await _load_settings()
    workspace = _workspace_from_settings(settings)
    return get_skill_lifecycle(workspace).resolve_change_proposal(
        proposal_id,
        approved=req.approved,
        actor=req.actor,
        reason=req.reason,
    )


@router.post("/skills/select")
async def kernel_skill_select(req: SkillSelectionRequest):
    """执行分环境 Skill Family 选择；无可信候选时返回 abstained。"""

    settings = await _load_settings()
    workspace = _workspace_from_settings(settings)
    return get_skill_lifecycle(workspace).select_for_context(
        req.query,
        environment_scope=req.environment_scope,
        environment_fingerprint=req.environment_fingerprint,
        available_capabilities=req.available_capabilities,
        top_k=req.top_k,
    )


@router.post("/skills/{skill_id}/lifecycle")
async def kernel_skill_lifecycle_transition(skill_id: str, req: SkillLifecycleTransitionRequest):
    settings = await _load_settings()
    workspace = _workspace_from_settings(settings)
    return get_skill_lifecycle(workspace).transition(
        skill_id,
        req.status,
        reason=req.reason or "manual_lifecycle_transition",
        actor=req.actor or "user",
        sync=req.sync,
    )


@router.post("/skills/{skill_id}/use")
async def kernel_skill_use_record(skill_id: str, req: SkillUseRecordRequest):
    settings = await _load_settings()
    workspace = _workspace_from_settings(settings)
    return get_skill_lifecycle(workspace).record_skill_use(
        skill_id,
        req.success,
        reason=req.reason or "manual_record",
        environment_scope=req.environment_scope,
        environment_fingerprint=req.environment_fingerprint,
        evidence_origin=req.evidence_origin,
        strategy_id=req.strategy_id,
        source_event_id=req.source_event_id,
    )


@router.post("/guidance")
async def add_live_guidance(req: GuidanceRequest):
    item = get_guidance_bus().add(
        text=req.text,
        conversation_id=req.conversation_id or req.conversationId,
        turn_id=req.turn_id,
        trace_id=req.trace_id,
        mode=req.mode,
        priority=req.priority,
    )
    settings = await _load_settings()
    workspace = settings.get("CLISettings", {}).get("cc_path", "") if isinstance(settings, dict) else ""
    get_kernel_audit(workspace).append(
        "kernel.guidance.added",
        item.to_dict(),
        actor="user",
        workspace_dir=workspace,
    )
    return {"ok": True, "guidance": item.to_dict(), "queue": get_guidance_bus().status()}


@router.get("/guidance")
async def list_live_guidance(conversation_id: str = ""):
    return {
        "pending": get_guidance_bus().pending(conversation_id),
        "status": get_guidance_bus().status(),
    }


@router.get("/audit")
async def kernel_audit(limit: int = 100, event_type: str = ""):
    settings = await _load_settings()
    workspace = _workspace_from_settings(settings)
    audit_log = get_kernel_audit(workspace)
    events = audit_log.recent(limit=limit, event_type=event_type)
    return {
        "ok": True,
        "workspace": workspace,
        "count": len(events),
        "events": events,
    }


@router.get("/events")
async def kernel_event_stream(request: Request, event_type: str = ""):
    bus = get_kernel_event_bus()
    wanted = str(event_type or "").strip()

    async def event_generator() -> AsyncGenerator[str, None]:
        queue = bus.subscribe()
        try:
            connected = {
                "status": "ok",
                "bus": bus.status(),
                "timestamp": datetime.now().isoformat(),
            }
            yield f"event: connected\ndata: {json.dumps(connected, ensure_ascii=False)}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30.0)
                    if wanted and event.get("event") != wanted:
                        continue
                    event_name = event.get("event", "kernel.event")
                    data = json.dumps(event.get("data", {}), ensure_ascii=False)
                    yield f"event: {event_name}\ndata: {data}\n\n"
                except asyncio.TimeoutError:
                    yield f": keepalive {datetime.now().isoformat()}\n\n"
        finally:
            bus.unsubscribe(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/events/status")
async def kernel_event_status(limit: int = 20):
    bus = get_kernel_event_bus()
    return {
        "ok": True,
        "status": bus.status(),
        "recent": bus.recent(limit=limit),
    }


@router.get("/traces")
async def kernel_traces(limit: int = 100, status: str = ""):
    settings = await _load_settings()
    workspace = _workspace_from_settings(settings)
    traces = get_kernel_executor().recent_traces(workspace_dir=workspace, limit=limit, status=status)
    return {
        "ok": True,
        "workspace": workspace,
        "count": len(traces),
        "traces": traces,
    }


@router.get("/traces/status")
async def kernel_trace_status():
    settings = await _load_settings()
    workspace = _workspace_from_settings(settings)
    return {"ok": True, "workspace": workspace, "traces": get_kernel_executor().status(workspace)}


@router.get("/traces/{trace_id}")
async def kernel_trace_detail(trace_id: str):
    settings = await _load_settings()
    workspace = _workspace_from_settings(settings)
    trace = get_kernel_executor().get_trace(workspace_dir=workspace, trace_id=trace_id)
    if not trace:
        return {"ok": False, "reason": "trace_not_found", "trace_id": trace_id, "workspace": workspace}
    return {"ok": True, "workspace": workspace, "trace": trace}


@router.get("/traces/{trace_id}/recovery")
async def kernel_trace_recovery(trace_id: str):
    settings = await _load_settings()
    workspace = _workspace_from_settings(settings)
    plan = get_kernel_executor().recovery_plan(workspace_dir=workspace, trace_id=trace_id)
    plan["workspace"] = workspace
    return plan


@router.post("/traces/{trace_id}/retry")
async def kernel_trace_retry(trace_id: str, req: TraceRetryRequest):
    settings = await _load_settings()
    workspace = _workspace_from_settings(settings)
    plan = get_kernel_executor().recovery_plan(workspace_dir=workspace, trace_id=trace_id)
    if not plan.get("ok"):
        return plan
    if not plan.get("retryable"):
        return {"ok": False, "reason": "trace_not_retryable", "trace": plan.get("trace"), "workspace": workspace}
    trace = plan.get("trace") or {}
    tool_name = req.tool_name or trace.get("tool_name", "")
    if tool_name != trace.get("tool_name"):
        return {
            "ok": False,
            "reason": "tool_name_mismatch",
            "expected": trace.get("tool_name", ""),
            "actual": tool_name,
            "workspace": workspace,
        }
    param_keys = plan.get("requiredParamKeys") or []
    missing_keys = [key for key in param_keys if key not in (req.tool_params or {})]
    if missing_keys:
        return {
            "ok": False,
            "reason": "missing_required_params",
            "missing": missing_keys,
            "retryContract": plan.get("retryContract"),
            "workspace": workspace,
        }
    if not _trace_retry_handler:
        return {"ok": False, "reason": "trace_retry_handler_not_configured", "workspace": workspace}
    payload = {
        "trace_id": trace_id,
        "tool_name": tool_name,
        "tool_params": req.tool_params or {},
        "approval_id": req.approval_id or trace.get("approval_id", ""),
        "reason": req.reason or "manual_retry",
    }
    result = _trace_retry_handler(trace, payload, settings)
    if hasattr(result, "__await__"):
        result = await result
    return result


@router.get("/policy/status")
async def kernel_policy_status():
    settings = await _load_settings()
    return {"ok": True, "policy": get_policy_gate().status(settings)}


@router.post("/policy/evaluate")
async def kernel_policy_evaluate(req: PolicyEvaluateRequest):
    settings = await _load_settings()
    workspace = _workspace_from_settings(settings)
    decision = get_policy_gate().evaluate_tool_call(
        settings=settings,
        tool_name=req.tool_name,
        actor=req.actor or "model",
        workspace_dir=workspace,
    )
    return {"ok": True, "decision": decision.to_dict()}


@router.get("/approvals/pending")
async def kernel_pending_approvals(limit: int = 100):
    settings = await _load_settings()
    workspace = _workspace_from_settings(settings)
    return {
        "ok": True,
        "workspace": workspace,
        "pending": get_approval_center().pending(workspace_dir=workspace, limit=limit),
    }


@router.get("/approvals/status")
async def kernel_approval_status():
    settings = await _load_settings()
    workspace = _workspace_from_settings(settings)
    return {"ok": True, "workspace": workspace, "approvals": get_approval_center().status(workspace)}


@router.get("/approvals/history")
async def kernel_approval_history(limit: int = 100, status: str = ""):
    settings = await _load_settings()
    workspace = _workspace_from_settings(settings)
    history = get_approval_center().history(workspace_dir=workspace, limit=limit, status=status)
    return {
        "ok": True,
        "workspace": workspace,
        "count": len(history),
        "history": history,
    }


@router.post("/approvals/resolve")
async def kernel_resolve_approval(req: ApprovalResolveRequest):
    settings = await _load_settings()
    workspace = _workspace_from_settings(settings)
    result = get_approval_center().resolve(
        req.approval_id,
        req.resolution,
        actor="user",
        reason=req.reason,
        consume=req.consume,
        workspace_dir=workspace,
    )
    return result


@router.post("/config/intent")
async def create_config_intent(req: ConfigIntentRequest):
    settings = await _load_settings()
    intent = parse_config_intent(req.text, settings)
    workspace = _workspace_from_settings(settings)
    config_settings = _config_intent_settings(settings)
    intent_payload = register_config_intent(
        intent,
        workspace_dir=workspace,
        actor="user",
        ttl_seconds=int(config_settings.get("intentTtlSeconds", 600) or 600),
    )
    get_kernel_audit(workspace).append(
        "kernel.config.intent",
        intent_payload,
        actor="user",
        workspace_dir=workspace,
    )
    return intent_payload


@router.get("/config/pending")
async def list_pending_config_intents():
    settings = await _load_settings()
    workspace = _workspace_from_settings(settings)
    return {"pending": pending_config_intents(workspace)}


@router.post("/config/apply")
async def apply_config(req: ConfigApplyRequest):
    settings = await _load_settings()
    workspace = _workspace_from_settings(settings)
    config_settings = _config_intent_settings(settings)
    next_settings, result = apply_config_intent(
        settings,
        req.intent,
        confirmed=req.confirmed,
        confirmation_text=req.confirmation_text,
        workspace_dir=workspace,
        require_pending=bool(config_settings.get("requirePendingIntent", True)),
        require_confirmation_text=bool(config_settings.get("requireConfirmationText", True)),
    )
    get_kernel_audit(workspace).append(
        "kernel.config.apply",
        {
            "intent_id": req.intent.get("intent_id"),
            "confirmed": req.confirmed,
            "confirmation_text_provided": bool(req.confirmation_text),
            "result": result,
        },
        actor="user",
        workspace_dir=workspace,
    )
    if result.get("applied"):
        await _save_settings(next_settings)
        await _broadcast_settings(next_settings)
    return result
