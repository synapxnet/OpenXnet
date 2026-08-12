#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""Model-safe KernelPlan timeline aggregation."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Set

from py.kernel.approval import get_approval_center
from py.kernel.audit import get_kernel_audit, sanitize_payload
from py.kernel.store import get_kernel_store


TIMELINE_SCHEMA = "openxnet.kernel.plan_timeline.v1"
PLAN_CONTROL_EVENT_TYPES = (
    "kernel.plan.advance.stopped",
    "kernel.plan.advance.dry_run",
    "kernel.plan.advance.executed",
    "kernel.plan.run.dry_run",
    "kernel.plan.run.stopped",
    "kernel.plan.run.step_executed",
    "kernel.plan.run.finished",
    "kernel.plan.resume.dry_run",
    "kernel.plan.resume.stopped",
    "kernel.plan.resume.finished",
)
PLAN_CONTROL_PAYLOAD_KEYS = (
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


def _bounded_int(value: Any, default: int, *, minimum: int = 1, maximum: int = 200) -> int:
    try:
        number = int(value)
    except Exception:
        number = default
    return max(minimum, min(number, maximum))


def _plan_steps(plan_record: Dict[str, Any]) -> List[Dict[str, Any]]:
    plan = plan_record.get("plan", {}) if isinstance(plan_record, dict) else {}
    steps = plan.get("steps", []) if isinstance(plan, dict) else []
    return [step for step in steps if isinstance(step, dict)]


def _step_preview(step: Dict[str, Any]) -> Dict[str, Any]:
    return sanitize_payload({
        "step_id": step.get("step_id", ""),
        "index": step.get("index", 0),
        "title": step.get("title", ""),
        "kind": step.get("kind", ""),
        "status": step.get("status", ""),
        "tool_name": step.get("tool_name", ""),
        "capability": step.get("capability", ""),
        "risk": step.get("risk", ""),
        "requires_approval": bool(step.get("requires_approval", False)),
        "verification": step.get("verification", ""),
        "rollback": step.get("rollback", ""),
        "recovery": step.get("recovery", ""),
        "updated_at": step.get("updated_at", ""),
        "last_trace_id": step.get("last_trace_id", ""),
        "execution": step.get("execution", {}) if isinstance(step.get("execution"), dict) else {},
    })


def _trace_preview(trace: Dict[str, Any], step_ids: Optional[List[str]] = None) -> Dict[str, Any]:
    metadata = trace.get("metadata", {}) if isinstance(trace.get("metadata"), dict) else {}
    return sanitize_payload({
        "trace_id": trace.get("trace_id", ""),
        "tool_name": trace.get("tool_name", ""),
        "capability": trace.get("capability", ""),
        "status": trace.get("status", ""),
        "actor": trace.get("actor", ""),
        "approval_id": trace.get("approval_id", ""),
        "started_at": trace.get("started_at", ""),
        "finished_at": trace.get("finished_at", ""),
        "duration_ms": trace.get("duration_ms", 0),
        "param_keys": trace.get("param_keys", []) if isinstance(trace.get("param_keys"), list) else [],
        "result_type": trace.get("result_type", ""),
        "has_result_preview": bool(trace.get("result_preview")),
        "has_error": bool(trace.get("error")),
        "recovery_hint": trace.get("recovery_hint", ""),
        "matched_step_ids": step_ids or [],
        "matched_step_id": metadata.get("kernel_plan_step_id", ""),
        "matched_step_title": metadata.get("kernel_plan_step_title", ""),
        "matched_run_id": metadata.get("kernel_plan_run_id", ""),
        "matched_run_iteration": metadata.get("kernel_plan_run_iteration", 0),
        "detailEndpoint": f"/v1/kernel/traces/{trace.get('trace_id', '')}",
        "recoveryEndpoint": f"/v1/kernel/traces/{trace.get('trace_id', '')}/recovery",
        "retryEndpoint": f"/v1/kernel/traces/{trace.get('trace_id', '')}/retry",
    })


def _approval_preview(approval: Dict[str, Any]) -> Dict[str, Any]:
    return sanitize_payload({
        "approval_id": approval.get("approval_id", ""),
        "status": approval.get("status", ""),
        "tool_name": approval.get("tool_name", ""),
        "actor": approval.get("actor", ""),
        "requested_by": approval.get("requested_by", ""),
        "created_at": approval.get("created_at", ""),
        "expires_at": approval.get("expires_at", ""),
        "resolved_at": approval.get("resolved_at", ""),
        "resolution": approval.get("resolution", ""),
        "reason": approval.get("reason", ""),
        "trace_id": approval.get("trace_id", ""),
        "execution_trace_id": approval.get("execution_trace_id", ""),
        "recovery_hint": approval.get("recovery_hint", ""),
        "param_keys": (approval.get("tool_params") or {}).get("keys", [])
        if isinstance(approval.get("tool_params"), dict)
        else [],
    })


def _plan_control_audit_preview(record: Dict[str, Any]) -> Dict[str, Any]:
    payload = record.get("payload", {}) if isinstance(record.get("payload"), dict) else {}
    compact_payload = {
        key: payload.get(key)
        for key in PLAN_CONTROL_PAYLOAD_KEYS
        if payload.get(key) not in ("", None, [], {})
    }
    return sanitize_payload({
        "audit_id": record.get("audit_id", ""),
        "event_type": record.get("event_type", ""),
        "actor": record.get("actor", ""),
        "created_at": record.get("created_at", ""),
        "payload": compact_payload,
    })


def _plan_control_event_sort_key(event: Dict[str, Any]) -> tuple:
    payload = event.get("payload", {}) if isinstance(event.get("payload"), dict) else {}
    event_type = str(event.get("event_type") or "")
    phase_order = {
        "kernel.plan.run.dry_run": 90,
        "kernel.plan.run.stopped": 90,
        "kernel.plan.run.finished": 100,
        "kernel.plan.run.step_executed": 50,
        "kernel.plan.resume.dry_run": 90,
        "kernel.plan.resume.stopped": 90,
        "kernel.plan.resume.finished": 110,
        "kernel.plan.advance.stopped": 90,
        "kernel.plan.advance.dry_run": 90,
        "kernel.plan.advance.executed": 50,
    }.get(event_type, 70)
    try:
        iteration = int(payload.get("iteration") or 0)
    except Exception:
        iteration = 0
    return (event.get("created_at", ""), iteration, phase_order, event.get("audit_id", ""))


def _matching_plan_control_events(workspace_dir: str, plan_id: str, *, limit: int = 200) -> List[Dict[str, Any]]:
    wanted_plan_id = str(plan_id or "")
    if not wanted_plan_id:
        return []
    audit = get_kernel_audit(workspace_dir)
    records: Dict[str, Dict[str, Any]] = {}
    max_items = _bounded_int(limit, 200, minimum=1, maximum=500)
    for event_type in PLAN_CONTROL_EVENT_TYPES:
        try:
            candidates = audit.recent(limit=max_items, event_type=event_type)
        except Exception:
            continue
        for item in candidates:
            if not isinstance(item, dict):
                continue
            payload = item.get("payload", {}) if isinstance(item.get("payload"), dict) else {}
            if str(payload.get("plan_id") or "") != wanted_plan_id:
                continue
            audit_id = str(item.get("audit_id") or f"{event_type}:{item.get('created_at', '')}")
            records[audit_id] = _plan_control_audit_preview(item)
    return sorted(records.values(), key=_plan_control_event_sort_key)


def _plan_run_status(event_type: str, payload: Dict[str, Any]) -> str:
    if event_type in {"kernel.plan.run.finished", "kernel.plan.resume.finished"}:
        return "finished"
    if event_type in {"kernel.plan.run.stopped", "kernel.plan.resume.stopped"}:
        return "stopped"
    if event_type in {"kernel.plan.run.dry_run", "kernel.plan.resume.dry_run"}:
        return "dry_run"
    if payload.get("status"):
        return str(payload.get("status"))
    return "running"


def _is_plan_run_history_event(event: Dict[str, Any]) -> bool:
    event_type = str(event.get("event_type") or "")
    return event_type.startswith("kernel.plan.run.") or event_type.startswith("kernel.plan.resume.")


def _is_terminal_plan_run_event(event_type: str) -> bool:
    return event_type in {
        "kernel.plan.run.finished",
        "kernel.plan.run.stopped",
        "kernel.plan.run.dry_run",
        "kernel.plan.resume.finished",
        "kernel.plan.resume.stopped",
        "kernel.plan.resume.dry_run",
    }


def build_plan_run_history(
    workspace_dir: str,
    plan_id: str,
    *,
    limit: int = 100,
) -> Dict[str, Any]:
    """Group sanitized plan run audit events into model-safe run receipts."""
    plan_id = str(plan_id or "").strip()
    if not plan_id:
        return {"ok": False, "reason": "missing_plan_id", "plan_id": plan_id}

    store = get_kernel_store(workspace_dir)
    plan_record = store.get_plan(plan_id, include_plan=False)
    if not plan_record:
        return {"ok": False, "reason": "plan_not_found", "plan_id": plan_id, "workspace": workspace_dir}

    max_items = _bounded_int(limit, 100, minimum=1, maximum=500)
    control_events = [
        event for event in _matching_plan_control_events(workspace_dir, plan_id, limit=max_items)
        if _is_plan_run_history_event(event)
    ]
    grouped: Dict[str, Dict[str, Any]] = {}
    for event in control_events:
        payload = event.get("payload", {}) if isinstance(event.get("payload"), dict) else {}
        run_id = str(payload.get("run_id") or f"legacy:{event.get('audit_id', '')}")
        entry = grouped.setdefault(
            run_id,
            {
                "run_id": run_id,
                "plan_id": plan_id,
                "started_at": event.get("created_at", ""),
                "finished_at": "",
                "eventCount": 0,
                "advancedCount": 0,
                "maxSteps": payload.get("maxSteps", 0),
                "dryRun": bool(payload.get("dryRun", False)),
                "resumed": False,
                "previousRunId": "",
                "resumeEventCount": 0,
                "status": "running",
                "stopReason": "",
                "events": [],
            },
        )
        entry["eventCount"] = int(entry.get("eventCount") or 0) + 1
        entry["finished_at"] = event.get("created_at", "") or entry.get("finished_at", "")
        entry["advancedCount"] = max(int(entry.get("advancedCount") or 0), int(payload.get("advancedCount") or 0))
        entry["maxSteps"] = payload.get("maxSteps") or entry.get("maxSteps", 0)
        entry["dryRun"] = bool(entry.get("dryRun", False) or payload.get("dryRun", False))
        event_type = str(event.get("event_type") or "")
        if event_type.startswith("kernel.plan.resume."):
            entry["resumeEventCount"] = int(entry.get("resumeEventCount") or 0) + 1
        if payload.get("previousRunId"):
            entry["previousRunId"] = payload.get("previousRunId")
            entry["resumed"] = True
        if _is_terminal_plan_run_event(event_type) or entry.get("status") == "running":
            entry["status"] = _plan_run_status(event_type, payload)
        entry["stopReason"] = payload.get("stopReason") or entry.get("stopReason", "")
        entry["events"].append(event)
        entry["events"].sort(key=_plan_control_event_sort_key)

    runs = sorted(
        (sanitize_payload(entry) for entry in grouped.values()),
        key=lambda item: (item.get("started_at", ""), item.get("run_id", "")),
    )
    return {
        "ok": True,
        "workspace": workspace_dir or "",
        "plan_id": plan_id,
        "count": len(runs),
        "runs": runs,
        "security": {
            "rawParamsPersisted": False,
            "rawMessagesReturned": False,
            "resultPreviewReturned": False,
            "rawAuditPayloadReturned": False,
        },
    }


def _matching_approvals(workspace_dir: str, traces: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    trace_ids: Set[str] = {str(trace.get("trace_id") or "") for trace in traces if trace.get("trace_id")}
    approval_ids: Set[str] = {str(trace.get("approval_id") or "") for trace in traces if trace.get("approval_id")}
    if not trace_ids and not approval_ids:
        return []

    center = get_approval_center()
    records: Dict[str, Dict[str, Any]] = {}
    try:
        candidates = center.history(workspace_dir=workspace_dir, limit=500) + center.pending(workspace_dir=workspace_dir, limit=500)
    except Exception:
        return []

    for item in candidates:
        if not isinstance(item, dict):
            continue
        approval_id = str(item.get("approval_id") or "")
        request_trace_id = str(item.get("trace_id") or "")
        execution_trace_id = str(item.get("execution_trace_id") or "")
        if approval_id in approval_ids or request_trace_id in trace_ids or execution_trace_id in trace_ids:
            records[approval_id or f"trace:{request_trace_id}:{execution_trace_id}"] = item

    return sorted((_approval_preview(item) for item in records.values()), key=lambda item: item.get("created_at", ""))


def _steps_by_tool(steps: List[Dict[str, Any]]) -> Dict[str, List[str]]:
    mapping: Dict[str, List[str]] = {}
    for step in steps:
        tool_name = str(step.get("tool_name") or "")
        step_id = str(step.get("step_id") or "")
        if tool_name and step_id:
            mapping.setdefault(tool_name, []).append(step_id)
    return mapping


def _trace_step_ids(trace: Dict[str, Any], by_tool: Dict[str, List[str]]) -> List[str]:
    metadata = trace.get("metadata", {}) if isinstance(trace.get("metadata"), dict) else {}
    ids: List[str] = []
    explicit = str(metadata.get("kernel_plan_step_id") or "")
    if explicit:
        ids.append(explicit)
    candidates = metadata.get("kernel_plan_step_candidate_ids", [])
    if isinstance(candidates, list):
        for item in candidates:
            text = str(item or "")
            if text and text not in ids:
                ids.append(text)
    if ids:
        return ids[:12]
    return by_tool.get(str(trace.get("tool_name") or ""), [])


def _timeline_items(
    *,
    plan_record: Dict[str, Any],
    steps: List[Dict[str, Any]],
    traces: List[Dict[str, Any]],
    approvals: List[Dict[str, Any]],
    control_events: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    plan_id = str(plan_record.get("plan_id") or "")
    created_at = str(plan_record.get("created_at") or "")
    items: List[Dict[str, Any]] = [
        {
            "type": "plan",
            "id": plan_id,
            "timestamp": created_at,
            "order": 0,
            "status": plan_record.get("status", ""),
            "title": "KernelPlan created",
            "summary": plan_record.get("goal_preview", ""),
            "endpoint": f"/v1/kernel/plans/{plan_id}",
        }
    ]

    for step in steps:
        preview = _step_preview(step)
        step_id = str(preview.get("step_id") or "")
        preview["contractEndpoint"] = f"/v1/kernel/plans/{plan_id}/steps/{step_id}/contract"
        preview["recoveryEndpoint"] = f"/v1/kernel/plans/{plan_id}/steps/{step_id}/recovery"
        preview["executeEndpoint"] = f"/v1/kernel/plans/{plan_id}/steps/{step_id}/execute"
        items.append({
            "type": "step",
            "id": preview.get("step_id", ""),
            "timestamp": created_at,
            "order": 10 + int(preview.get("index") or 0),
            "status": preview.get("status", ""),
            "title": preview.get("title", ""),
            "step": preview,
        })

    by_tool = _steps_by_tool(steps)
    for trace in traces:
        trace_id = str(trace.get("trace_id") or "")
        preview = _trace_preview(trace, _trace_step_ids(trace, by_tool))
        items.append({
            "type": "trace",
            "id": trace_id,
            "timestamp": preview.get("started_at", ""),
            "order": 100,
            "status": preview.get("status", ""),
            "title": preview.get("tool_name", ""),
            "trace": preview,
        })

    for approval in approvals:
        approval_id = str(approval.get("approval_id") or "")
        timestamp = str(approval.get("created_at") or approval.get("resolved_at") or "")
        items.append({
            "type": "approval",
            "id": approval_id,
            "timestamp": timestamp,
            "order": 110,
            "status": approval.get("status", ""),
            "title": approval.get("tool_name", ""),
            "approval": approval,
        })

    for event in control_events:
        payload = event.get("payload", {}) if isinstance(event.get("payload"), dict) else {}
        audit_id = str(event.get("audit_id") or "")
        event_type = str(event.get("event_type") or "")
        status = str(payload.get("status") or payload.get("stopReason") or payload.get("reason") or "")
        items.append({
            "type": "control_event",
            "id": audit_id,
            "timestamp": event.get("created_at", ""),
            "order": 120,
            "status": status,
            "title": event_type,
            "audit": event,
            "endpoint": f"/v1/kernel/audit?event_type={event_type}",
        })

    return sanitize_payload(sorted(items, key=lambda item: (item.get("timestamp", ""), item.get("order", 0), item.get("id", ""))))


def _recovery_summary(plan_id: str, steps: List[Dict[str, Any]], traces: List[Dict[str, Any]], approvals: List[Dict[str, Any]]) -> Dict[str, Any]:
    failed = [trace for trace in traces if trace.get("status") == "error"]
    approval_required = [trace for trace in traces if trace.get("status") == "approval_required"]
    pending = [approval for approval in approvals if approval.get("status") == "pending"]
    retryable = failed + approval_required
    step_recovery = []
    for step in steps:
        if not isinstance(step, dict):
            continue
        status = str(step.get("status") or "")
        if status not in {"error", "approval_required"}:
            continue
        step_id = str(step.get("step_id") or "")
        step_recovery.append({
            "step_id": step_id,
            "status": status,
            "last_trace_id": step.get("last_trace_id", ""),
            "recoveryEndpoint": f"/v1/kernel/plans/{plan_id}/steps/{step_id}/recovery",
            "executeEndpoint": f"/v1/kernel/plans/{plan_id}/steps/{step_id}/execute",
        })

    if step_recovery:
        next_action = "Open the affected step recovery endpoint and retry through the step execute endpoint."
    elif pending:
        next_action = "Resolve pending approvals before continuing execution."
    elif failed:
        next_action = "Open trace recovery for failed executions and retry with explicit parameters."
    elif approval_required:
        next_action = "Confirm or deny approval-required traces, then retry if needed."
    elif not traces:
        next_action = "No linked execution traces yet; execute governed tools to populate the timeline."
    else:
        next_action = "Linked traces are available; continue validation or proceed to the next plan."

    return sanitize_payload({
        "pendingApprovalCount": len(pending),
        "failedTraceCount": len(failed),
        "approvalRequiredTraceCount": len(approval_required),
        "retryableTraceIds": [trace.get("trace_id", "") for trace in retryable if trace.get("trace_id")],
        "recoverableSteps": step_recovery,
        "nextActionEndpoint": f"/v1/kernel/plans/{plan_id}/next-action",
        "nextAction": next_action,
    })


def build_plan_timeline(
    workspace_dir: str,
    plan_id: str,
    *,
    trace_limit: int = 100,
    trace_status: str = "",
    include_plan: bool = False,
) -> Dict[str, Any]:
    """Build a sanitized plan -> step -> trace -> approval timeline."""
    plan_id = str(plan_id or "").strip()
    if not plan_id:
        return {"ok": False, "reason": "missing_plan_id", "plan_id": plan_id}

    store = get_kernel_store(workspace_dir)
    plan_record = store.get_plan(plan_id, include_plan=True)
    if not plan_record:
        return {"ok": False, "reason": "plan_not_found", "plan_id": plan_id, "workspace": workspace_dir}

    max_traces = _bounded_int(trace_limit, 100, minimum=1, maximum=500)
    traces = store.traces_for_plan(plan_id=plan_id, limit=max_traces, status=trace_status)
    steps = _plan_steps(plan_record)
    approvals = _matching_approvals(workspace_dir, traces)
    control_events = _matching_plan_control_events(workspace_dir, plan_id, limit=max_traces)
    run_ids = {
        str((event.get("payload") or {}).get("run_id") or "")
        for event in control_events
        if isinstance(event.get("payload"), dict)
        and _is_plan_run_history_event(event)
        and (event.get("payload") or {}).get("run_id")
    }
    timeline_plan = dict(plan_record)
    if not include_plan:
        timeline_plan.pop("plan", None)
    try:
        from py.kernel.executor import get_kernel_executor
        next_action = get_kernel_executor().plan_next_action(workspace_dir=workspace_dir, plan=plan_record.get("plan", {}))
    except Exception as exc:
        next_action = {"ok": False, "reason": "next_action_unavailable", "error": str(exc)}

    timeline = {
        "schema": TIMELINE_SCHEMA,
        "workspace": workspace_dir or "",
        "plan_id": plan_id,
        "plan": sanitize_payload(timeline_plan),
        "counts": {
            "steps": len(steps),
            "traces": len(traces),
            "approvals": len(approvals),
            "controlEvents": len(control_events),
            "planRuns": len(run_ids),
            "failedTraces": sum(1 for trace in traces if trace.get("status") == "error"),
            "pendingApprovals": sum(1 for approval in approvals if approval.get("status") == "pending"),
        },
        "items": _timeline_items(
            plan_record=plan_record,
            steps=steps,
            traces=traces,
            approvals=approvals,
            control_events=control_events,
        ),
        "nextAction": next_action,
        "recovery": _recovery_summary(plan_id, steps, traces, approvals),
        "endpoints": {
            "detail": f"/v1/kernel/plans/{plan_id}",
            "control": f"/v1/kernel/plans/{plan_id}/control",
            "traces": f"/v1/kernel/plans/{plan_id}/traces",
            "timeline": f"/v1/kernel/plans/{plan_id}/timeline",
            "nextAction": f"/v1/kernel/plans/{plan_id}/next-action",
            "advance": f"/v1/kernel/plans/{plan_id}/advance",
            "run": f"/v1/kernel/plans/{plan_id}/run",
            "resume": f"/v1/kernel/plans/{plan_id}/resume",
            "resumePreview": f"/v1/kernel/plans/{plan_id}/resume-preview",
            "runs": f"/v1/kernel/plans/{plan_id}/runs",
        },
        "security": {
            "rawParamsPersisted": False,
            "rawMessagesReturned": False,
            "resultPreviewReturned": False,
            "rawAuditPayloadReturned": False,
        },
    }
    return {"ok": True, "workspace": workspace_dir or "", "timeline": sanitize_payload(timeline)}
