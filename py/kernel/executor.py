#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""Kernel-governed execution tracing around the legacy tool dispatcher."""

from __future__ import annotations

import json
import time
import uuid
from dataclasses import asdict, dataclass, field
from typing import Any, Awaitable, Callable, Dict, List, Optional

from py.kernel.audit import get_kernel_audit, sanitize_payload
from py.kernel.event_bus import get_kernel_event_bus
from py.kernel.policy import classify_tool
from py.kernel.store import get_kernel_store


MAX_RESULT_PREVIEW = 1200


@dataclass
class KernelTrace:
    trace_id: str
    workspace_dir: str
    tool_name: str
    capability: str
    status: str = "running"
    actor: str = "model"
    approval_id: str = ""
    started_at: str = ""
    finished_at: str = ""
    duration_ms: float = 0
    param_keys: List[str] = field(default_factory=list)
    result_preview: str = ""
    result_type: str = ""
    error: str = ""
    recovery_hint: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return sanitize_payload(asdict(self))


def _format_time(epoch: Optional[float] = None) -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S%z", time.localtime(epoch or time.time()))


def _workspace_from_settings(settings: Dict[str, Any]) -> str:
    cli = settings.get("CLISettings", {}) if isinstance(settings, dict) else {}
    return str(cli.get("cc_path") or "")


def _param_keys(tool_params: Any) -> List[str]:
    if not isinstance(tool_params, dict):
        return []
    return sorted(str(key) for key in tool_params.keys())


def _matched_plan_step_context(context: Dict[str, Any], tool_name: str) -> Dict[str, Any]:
    if not tool_name:
        return {}
    steps = context.get("_kernel_plan_step_index", [])
    if not isinstance(steps, list):
        return {}
    matches = [
        step for step in steps
        if isinstance(step, dict) and str(step.get("tool_name") or "") == str(tool_name or "")
    ]
    if not matches:
        return {}
    selected = sanitize_payload(matches[0])
    candidate_ids = [
        str(step.get("step_id") or "")
        for step in matches
        if isinstance(step, dict) and step.get("step_id")
    ][:12]
    return sanitize_payload({
        "kernel_plan_step_id": selected.get("step_id", ""),
        "kernel_plan_step_index": selected.get("index", 0),
        "kernel_plan_step_title": selected.get("title", ""),
        "kernel_plan_step_kind": selected.get("kind", ""),
        "kernel_plan_step_tool_name": selected.get("tool_name", ""),
        "kernel_plan_step_capability": selected.get("capability", ""),
        "kernel_plan_step_risk": selected.get("risk", ""),
        "kernel_plan_step_requires_approval": bool(selected.get("requires_approval", False)),
        "kernel_plan_step_candidate_ids": candidate_ids,
    })


def _plan_context_from_settings(settings: Dict[str, Any], tool_name: str = "") -> Dict[str, Any]:
    if not isinstance(settings, dict):
        return {}
    context = settings.get("__kernel_plan_context", {})
    if not isinstance(context, dict):
        return {}
    trace_context = {
        key: value
        for key, value in sanitize_payload(context).items()
        if (str(key).startswith("kernel_plan_") or key in {"conversation_id", "turn_id"})
        and key not in {"kernel_plan_step_index"}
    }
    trace_context.update(_matched_plan_step_context(context, tool_name))
    return sanitize_payload(trace_context)


def _preview_result(result: Any) -> str:
    if result is None:
        return ""
    if isinstance(result, str):
        text = result
    elif isinstance(result, (dict, list, tuple)):
        text = json.dumps(sanitize_payload(result), ensure_ascii=False, default=str)
    else:
        text = str(result)
    if len(text) > MAX_RESULT_PREVIEW:
        return text[:MAX_RESULT_PREVIEW] + "... [truncated]"
    return text


def _status_from_result(result: Any) -> str:
    if isinstance(result, str) and '"approval_required"' in result:
        try:
            payload = json.loads(result)
            if payload.get("type") == "approval_required":
                return "approval_required"
        except Exception:
            pass
    if isinstance(result, str) and result.startswith("Error calling tool"):
        return "error"
    return "completed"


def _approval_id_from_result(result: Any) -> str:
    if not isinstance(result, str) or '"approval_required"' not in result:
        return ""
    try:
        payload = json.loads(result)
        return str(payload.get("approval_id") or "")
    except Exception:
        return ""


def _approval_payload_from_result(result: Any) -> Dict[str, Any]:
    if not isinstance(result, str) or '"approval_required"' not in result:
        return {}
    try:
        payload = json.loads(result)
        return payload if payload.get("type") == "approval_required" else {}
    except Exception:
        return {}


def _augment_approval_result(result: Any, trace_id: str) -> tuple[Any, str]:
    payload = _approval_payload_from_result(result)
    if not payload:
        return result, ""
    approval_id = str(payload.get("approval_id") or "")
    payload["trace_id"] = trace_id
    payload["kernel_trace_id"] = trace_id
    return json.dumps(payload, ensure_ascii=False), approval_id


def _recovery_hint(tool_name: str, status: str, error: str = "") -> str:
    if status == "approval_required":
        return "等待用户在审批中心批准或拒绝后继续执行。"
    if status == "error":
        if tool_name in {"shell_tool_local", "docker_sandbox"}:
            return "检查命令、工作目录和权限模式；必要时改用只读诊断命令重试。"
        if "edit_file" in tool_name:
            return "检查目标文件是否存在、是否有未保存冲突，并用更小补丁重试。"
        return "查看 trace 错误与工具参数，修正后可重新调用该工具。"
    return ""


def _plan_steps(plan: Dict[str, Any]) -> List[Dict[str, Any]]:
    steps = plan.get("steps", []) if isinstance(plan, dict) else []
    return [step for step in steps if isinstance(step, dict)]


def _find_plan_step(plan: Dict[str, Any], *, step_id: str = "", step_index: int = 0) -> Optional[Dict[str, Any]]:
    wanted_id = str(step_id or "")
    wanted_index = int(step_index or 0)
    for step in _plan_steps(plan):
        if wanted_id and step.get("step_id") == wanted_id:
            return step
        if wanted_index and int(step.get("index") or 0) == wanted_index:
            return step
    return None


def _tool_plan_steps(plan: Dict[str, Any]) -> List[Dict[str, Any]]:
    steps = [
        step for step in _plan_steps(plan)
        if step.get("kind") == "tool" and step.get("tool_name")
    ]
    return sorted(steps, key=lambda item: int(item.get("index") or 0))


def _tool_step_ids(plan: Dict[str, Any]) -> set:
    return {
        str(step.get("step_id") or "")
        for step in _tool_plan_steps(plan)
        if step.get("step_id")
    }


def _completed_tool_step_ids(plan: Dict[str, Any]) -> set:
    return {
        str(step.get("step_id") or "")
        for step in _tool_plan_steps(plan)
        if str(step.get("status") or "planned") == "completed"
    }


def _unmet_tool_dependencies(plan: Dict[str, Any], step: Dict[str, Any]) -> List[str]:
    tool_ids = _tool_step_ids(plan)
    completed = _completed_tool_step_ids(plan)
    deps = step.get("depends_on", []) if isinstance(step.get("depends_on"), list) else []
    return [
        str(dep)
        for dep in deps
        if str(dep) in tool_ids and str(dep) not in completed
    ]


def _plan_summary_for_trace(plan: Dict[str, Any]) -> Dict[str, Any]:
    risk = plan.get("risk_summary", {}) if isinstance(plan.get("risk_summary"), dict) else {}
    return sanitize_payload({
        "plan_id": plan.get("plan_id", "") if isinstance(plan, dict) else "",
        "status": plan.get("status", "") if isinstance(plan, dict) else "",
        "source": "plan_step_execution",
        "runtime_mode": plan.get("runtime_mode", "") if isinstance(plan, dict) else "",
        "created_at": plan.get("created_at", "") if isinstance(plan, dict) else "",
        "step_count": len(_plan_steps(plan)),
        "highestRisk": risk.get("highestRisk", ""),
    })


def _step_trace_metadata(plan: Dict[str, Any], step: Dict[str, Any]) -> Dict[str, Any]:
    return sanitize_payload({
        "plan_step_execution": True,
        "kernel_plan_id": plan.get("plan_id", ""),
        "kernel_plan_step_id": step.get("step_id", ""),
        "kernel_plan_step_index": step.get("index", 0),
        "kernel_plan_step_title": step.get("title", ""),
        "kernel_plan_step_kind": step.get("kind", ""),
        "kernel_plan_step_tool_name": step.get("tool_name", ""),
        "kernel_plan_step_capability": step.get("capability", ""),
        "kernel_plan_step_risk": step.get("risk", ""),
        "kernel_plan_step_requires_approval": bool(step.get("requires_approval", False)),
    })


def _trace_recovery_preview(recovery: Dict[str, Any]) -> Dict[str, Any]:
    trace = recovery.get("trace", {}) if isinstance(recovery.get("trace"), dict) else {}
    return sanitize_payload({
        "ok": bool(recovery.get("ok", False)),
        "retryable": bool(recovery.get("retryable", False)),
        "reason": recovery.get("reason", ""),
        "requiredParamKeys": recovery.get("requiredParamKeys", []),
        "recoveryHint": recovery.get("recoveryHint", ""),
        "retryEndpoint": recovery.get("retryEndpoint", ""),
        "retryContract": recovery.get("retryContract", {}),
        "trace": {
            "trace_id": trace.get("trace_id", ""),
            "tool_name": trace.get("tool_name", ""),
            "status": trace.get("status", ""),
            "approval_id": trace.get("approval_id", ""),
            "started_at": trace.get("started_at", ""),
            "finished_at": trace.get("finished_at", ""),
            "duration_ms": trace.get("duration_ms", 0),
            "param_keys": trace.get("param_keys", []) if isinstance(trace.get("param_keys"), list) else [],
            "result_type": trace.get("result_type", ""),
            "has_result_preview": bool(trace.get("result_preview")),
            "has_error": bool(trace.get("error")),
            "recovery_hint": trace.get("recovery_hint", ""),
        },
    })


def _step_recovery_reason(status: str, last_trace_id: str) -> str:
    if status == "completed":
        return "step_completed"
    if status == "error":
        return "step_error"
    if status == "approval_required":
        return "step_waiting_approval"
    if status == "running":
        return "step_running"
    if not last_trace_id:
        return "step_not_executed"
    return "step_in_progress_or_unknown"


def _step_next_action(reason: str) -> str:
    if reason == "step_error":
        return "Review the last trace recovery, correct explicit params, then execute this plan step again."
    if reason == "step_waiting_approval":
        return "Resolve the linked approval or provide approval_id before retrying this step."
    if reason == "step_not_executed":
        return "Provide required tool_params and call the step execute endpoint."
    if reason == "step_completed":
        return "Step is complete; continue with the next planned step or validation."
    if reason == "step_running":
        return "Wait for the running trace to finish before retrying."
    return "Inspect the step contract and latest trace before choosing the next action."


def _next_action_payload(
    *,
    action_type: str,
    reason: str,
    plan_id: str,
    step: Optional[Dict[str, Any]] = None,
    contract: Optional[Dict[str, Any]] = None,
    recovery: Optional[Dict[str, Any]] = None,
    blocked_dependencies: Optional[List[str]] = None,
) -> Dict[str, Any]:
    step_id = str((step or {}).get("step_id") or "")
    payload = {
        "ok": True,
        "plan_id": plan_id,
        "actionType": action_type,
        "reason": reason,
        "nextAction": _step_next_action(reason) if step_id else "",
        "step": {
            "step_id": step_id,
            "index": (step or {}).get("index", 0),
            "title": (step or {}).get("title", ""),
            "status": (step or {}).get("status", ""),
            "tool_name": (step or {}).get("tool_name", ""),
            "capability": (step or {}).get("capability", ""),
            "risk": (step or {}).get("risk", ""),
            "requires_approval": bool((step or {}).get("requires_approval", False)),
            "last_trace_id": (step or {}).get("last_trace_id", ""),
        } if step_id else {},
        "contract": contract or {},
        "recovery": recovery or {},
        "blockedDependencies": blocked_dependencies or [],
        "endpoints": {
            "contract": f"/v1/kernel/plans/{plan_id}/steps/{step_id}/contract" if step_id else "",
            "recovery": f"/v1/kernel/plans/{plan_id}/steps/{step_id}/recovery" if step_id else "",
            "execute": f"/v1/kernel/plans/{plan_id}/steps/{step_id}/execute" if step_id else "",
            "advance": f"/v1/kernel/plans/{plan_id}/advance" if plan_id else "",
            "run": f"/v1/kernel/plans/{plan_id}/run" if plan_id else "",
            "timeline": f"/v1/kernel/plans/{plan_id}/timeline" if plan_id else "",
            "detail": f"/v1/kernel/plans/{plan_id}" if plan_id else "",
        },
        "security": {
            "rawParamsPersisted": False,
            "rawMessagesReturned": False,
            "resultPreviewReturned": False,
            "requiresExplicitParams": bool(contract),
        },
    }
    if not payload["nextAction"]:
        if action_type == "plan_complete":
            payload["nextAction"] = "Plan tool steps are complete; run validation or prepare the final response."
        elif action_type == "no_executable_steps":
            payload["nextAction"] = "No executable tool steps were found in this plan."
        elif action_type == "blocked_dependencies":
            payload["nextAction"] = "Wait for or complete the listed tool dependencies before executing this step."
        else:
            payload["nextAction"] = "Inspect the plan timeline before continuing."
    return sanitize_payload(payload)


def _advance_block_payload(action: Dict[str, Any], reason: str, message: str = "") -> Dict[str, Any]:
    return sanitize_payload({
        "ok": True,
        "canAdvance": False,
        "reason": reason,
        "message": message or reason,
        "nextAction": action,
        "security": {
            "autoExecutesOnlySafeNoParamSteps": True,
            "rawParamsPersisted": False,
            "rawMessagesReturned": False,
        },
    })


class KernelExecutor:
    """Thin execution wrapper that traces the current legacy tool path."""

    async def execute_tool(
        self,
        *,
        tool_name: str,
        tool_params: Optional[Dict[str, Any]],
        settings: Dict[str, Any],
        legacy_call: Callable[[], Awaitable[Any]],
        actor: str = "model",
        approval_id: str = "",
        metadata: Optional[Dict[str, Any]] = None,
        return_trace: bool = False,
    ) -> Any:
        workspace_dir = _workspace_from_settings(settings)
        classification = classify_tool(tool_name)
        now = time.time()
        trace = KernelTrace(
            trace_id=f"ktrace_{uuid.uuid4().hex}",
            workspace_dir=workspace_dir,
            tool_name=str(tool_name or ""),
            capability=classification.get("capability", ""),
            actor=actor or "model",
            approval_id=str(approval_id or ""),
            started_at=_format_time(now),
            param_keys=_param_keys(tool_params),
            metadata={
                "risk": classification.get("risk", ""),
                "legacy_dispatcher": True,
                **_plan_context_from_settings(settings, tool_name),
                **sanitize_payload(metadata or {}),
            },
        )
        store = get_kernel_store(workspace_dir)
        store.insert_trace(trace.to_dict())
        get_kernel_event_bus().publish("kernel.trace.started", trace.to_dict())
        if approval_id and trace.metadata.get("approval_trace_role") == "execution":
            try:
                from py.kernel.approval import get_approval_center
                get_approval_center().link_trace(
                    approval_id,
                    trace.trace_id,
                    workspace_dir=workspace_dir,
                    trace_role="execution",
                )
            except Exception:
                pass

        try:
            result = await legacy_call()
            result, generated_approval_id = _augment_approval_result(result, trace.trace_id)
            finished = time.time()
            status = _status_from_result(result)
            resolved_approval_id = generated_approval_id or _approval_id_from_result(result) or approval_id
            updates = {
                "status": status,
                "finished_at": _format_time(finished),
                "duration_ms": round((finished - now) * 1000, 2),
                "result_preview": _preview_result(result),
                "result_type": type(result).__name__,
                "approval_id": resolved_approval_id,
                "recovery_hint": _recovery_hint(tool_name, status),
            }
            completed = store.update_trace(trace.trace_id, updates) or {**trace.to_dict(), **updates}
            if resolved_approval_id and trace.metadata.get("approval_trace_role") == "execution":
                try:
                    from py.kernel.approval import get_approval_center
                    get_approval_center().link_trace(
                        resolved_approval_id,
                        trace.trace_id,
                        workspace_dir=workspace_dir,
                        trace_role="execution",
                        recovery_hint=updates.get("recovery_hint", ""),
                    )
                except Exception:
                    pass
            if status == "approval_required" and resolved_approval_id:
                try:
                    from py.kernel.approval import get_approval_center
                    get_approval_center().link_trace(
                        resolved_approval_id,
                        trace.trace_id,
                        workspace_dir=workspace_dir,
                        trace_role="request",
                        recovery_hint=updates.get("recovery_hint", ""),
                    )
                except Exception:
                    pass
            get_kernel_event_bus().publish("kernel.trace.finished", completed)
            if status in {"approval_required", "error"}:
                get_kernel_audit(workspace_dir).append(
                    "kernel.trace.needs_attention",
                    {
                        "trace_id": trace.trace_id,
                        "tool_name": tool_name,
                        "status": status,
                        "approval_id": updates.get("approval_id", ""),
                        "recovery_hint": updates.get("recovery_hint", ""),
                    },
                    actor=actor,
                    workspace_dir=workspace_dir,
                )
            if return_trace:
                return {
                    "ok": status != "error",
                    "status": status,
                    "result": result,
                    "trace": completed,
                }
            return result
        except Exception as exc:
            finished = time.time()
            updates = {
                "status": "error",
                "finished_at": _format_time(finished),
                "duration_ms": round((finished - now) * 1000, 2),
                "result_type": type(exc).__name__,
                "error": str(exc),
                "recovery_hint": _recovery_hint(tool_name, "error", str(exc)),
            }
            failed = store.update_trace(trace.trace_id, updates) or {**trace.to_dict(), **updates}
            if approval_id and trace.metadata.get("approval_trace_role") == "execution":
                try:
                    from py.kernel.approval import get_approval_center
                    get_approval_center().link_trace(
                        approval_id,
                        trace.trace_id,
                        workspace_dir=workspace_dir,
                        trace_role="execution",
                        recovery_hint=updates.get("recovery_hint", ""),
                    )
                except Exception:
                    pass
            get_kernel_event_bus().publish("kernel.trace.failed", failed)
            get_kernel_audit(workspace_dir).append(
                "kernel.trace.failed",
                {
                    "trace_id": trace.trace_id,
                    "tool_name": tool_name,
                    "error": str(exc),
                    "recovery_hint": updates["recovery_hint"],
                },
                actor=actor,
                workspace_dir=workspace_dir,
            )
            if return_trace:
                return {
                    "ok": False,
                    "status": "error",
                    "result": "",
                    "trace": failed,
                    "error": str(exc),
                }
            raise

    def plan_step_contract(
        self,
        *,
        plan: Dict[str, Any],
        step_id: str = "",
        step_index: int = 0,
    ) -> Dict[str, Any]:
        step = _find_plan_step(plan or {}, step_id=step_id, step_index=step_index)
        if not step:
            return {
                "ok": False,
                "reason": "plan_step_not_found",
                "plan_id": (plan or {}).get("plan_id", "") if isinstance(plan, dict) else "",
                "step_id": step_id,
                "step_index": step_index,
            }
        tool_name = str(step.get("tool_name") or "")
        if step.get("kind") != "tool" or not tool_name:
            return {
                "ok": False,
                "reason": "plan_step_not_executable",
                "plan_id": (plan or {}).get("plan_id", ""),
                "step": sanitize_payload(step),
            }
        inputs = step.get("inputs", {}) if isinstance(step.get("inputs"), dict) else {}
        param_keys = inputs.get("tool_param_keys", []) if isinstance(inputs.get("tool_param_keys"), list) else []
        return sanitize_payload({
            "ok": True,
            "plan_id": (plan or {}).get("plan_id", ""),
            "step_id": step.get("step_id", ""),
            "step_index": step.get("index", 0),
            "step_status": step.get("status", "planned"),
            "last_trace_id": step.get("last_trace_id", ""),
            "tool_name": tool_name,
            "requires_approval": bool(step.get("requires_approval", False)),
            "risk": step.get("risk", ""),
            "capability": step.get("capability", ""),
            "requiredParamKeys": [str(key) for key in param_keys],
            "requiresExplicitParams": True,
            "executeContract": {
                "tool_name": tool_name,
                "tool_params": {str(key): "" for key in param_keys},
                "approval_id": "",
                "reason": "plan_step_execution",
            },
            "security": {
                "rawParamsPersisted": False,
                "rawMessagesReturned": False,
            },
        })

    async def execute_plan_step(
        self,
        *,
        plan: Dict[str, Any],
        step_id: str = "",
        step_index: int = 0,
        tool_params: Optional[Dict[str, Any]] = None,
        settings: Dict[str, Any],
        legacy_call: Callable[[], Awaitable[Any]],
        actor: str = "model",
        approval_id: str = "",
        metadata: Optional[Dict[str, Any]] = None,
        return_trace: bool = True,
    ) -> Any:
        contract = self.plan_step_contract(plan=plan, step_id=step_id, step_index=step_index)
        if not contract.get("ok"):
            if return_trace:
                return contract
            raise ValueError(str(contract.get("reason") or "plan_step_not_executable"))

        step = _find_plan_step(plan or {}, step_id=contract.get("step_id", ""), step_index=int(contract.get("step_index") or 0))
        if not step:
            if return_trace:
                return {"ok": False, "reason": "plan_step_not_found", "contract": contract}
            raise ValueError("plan_step_not_found")

        try:
            from py.kernel.runtime import build_plan_trace_context
            plan_context = build_plan_trace_context(_plan_summary_for_trace(plan or {}), plan or {})
        except Exception:
            plan_context = {}
        existing_context = settings.get("__kernel_plan_context", {}) if isinstance(settings, dict) else {}
        if isinstance(existing_context, dict):
            for key in ("conversation_id", "turn_id"):
                if existing_context.get(key) and not plan_context.get(key):
                    plan_context[key] = existing_context.get(key)

        next_settings = dict(settings or {})
        if plan_context:
            next_settings["__kernel_plan_context"] = plan_context

        return await self.execute_tool(
            tool_name=str(step.get("tool_name") or ""),
            tool_params=tool_params or {},
            settings=next_settings,
            legacy_call=legacy_call,
            actor=actor,
            approval_id=approval_id,
            metadata={
                **_step_trace_metadata(plan or {}, step),
                **sanitize_payload(metadata or {}),
            },
            return_trace=return_trace,
        )

    def get_trace(self, workspace_dir: str = "", trace_id: str = "") -> Optional[Dict[str, Any]]:
        return get_kernel_store(workspace_dir).get_trace(trace_id)

    def recovery_plan(self, workspace_dir: str = "", trace_id: str = "") -> Dict[str, Any]:
        trace = self.get_trace(workspace_dir=workspace_dir, trace_id=trace_id)
        if not trace:
            return {"ok": False, "reason": "trace_not_found", "trace_id": trace_id}
        status = str(trace.get("status") or "")
        retryable = status in {"error", "approval_required"}
        param_keys = trace.get("param_keys") if isinstance(trace.get("param_keys"), list) else []
        return {
            "ok": True,
            "trace": trace,
            "retryable": retryable,
            "reason": "retryable_status" if retryable else "trace_completed_or_running",
            "requiredParamKeys": param_keys,
            "recoveryHint": trace.get("recovery_hint") or _recovery_hint(trace.get("tool_name", ""), status),
            "retryEndpoint": f"/v1/kernel/traces/{trace.get('trace_id', trace_id)}/retry",
            "retryContract": {
                "tool_name": trace.get("tool_name", ""),
                "tool_params": {key: "" for key in param_keys},
                "approval_id": trace.get("approval_id", ""),
                "reason": "manual_retry",
            },
            "security": {
                "rawParamsPersisted": False,
                "requiresExplicitParams": True,
            },
        }

    def plan_step_recovery(
        self,
        *,
        workspace_dir: str = "",
        plan: Dict[str, Any],
        step_id: str = "",
        step_index: int = 0,
    ) -> Dict[str, Any]:
        contract = self.plan_step_contract(plan=plan, step_id=step_id, step_index=step_index)
        if not contract.get("ok"):
            return contract
        step = _find_plan_step(
            plan or {},
            step_id=str(contract.get("step_id") or step_id),
            step_index=int(contract.get("step_index") or step_index or 0),
        )
        if not step:
            return {"ok": False, "reason": "plan_step_not_found", "contract": contract}

        execution = step.get("execution", {}) if isinstance(step.get("execution"), dict) else {}
        step_status = str(step.get("status") or "planned")
        last_trace_id = str(step.get("last_trace_id") or execution.get("trace_id") or "")
        trace_recovery: Dict[str, Any] = {}
        if last_trace_id:
            trace_recovery = self.recovery_plan(workspace_dir=workspace_dir, trace_id=last_trace_id)

        reason = _step_recovery_reason(step_status, last_trace_id)
        retryable = bool(trace_recovery.get("retryable")) or step_status in {"error", "approval_required", "planned"}
        recovery_hint = (
            execution.get("recovery_hint")
            or (trace_recovery.get("recoveryHint") if isinstance(trace_recovery, dict) else "")
            or step.get("recovery", "")
        )
        execute_contract = dict(contract.get("executeContract", {}))
        if execution.get("approval_id") and not execute_contract.get("approval_id"):
            execute_contract["approval_id"] = execution.get("approval_id")

        plan_id = str((plan or {}).get("plan_id") or contract.get("plan_id") or "")
        resolved_step_id = str(contract.get("step_id") or step_id)
        return sanitize_payload({
            "ok": True,
            "plan_id": plan_id,
            "step_id": resolved_step_id,
            "step_index": contract.get("step_index", 0),
            "step_status": step_status,
            "reason": reason,
            "retryable": retryable,
            "nextAction": _step_next_action(reason),
            "recoveryHint": recovery_hint,
            "lastTraceId": last_trace_id,
            "contract": contract,
            "executeEndpoint": f"/v1/kernel/plans/{plan_id}/steps/{resolved_step_id}/execute",
            "executeContract": execute_contract,
            "traceRecovery": _trace_recovery_preview(trace_recovery) if trace_recovery else {},
            "security": {
                "rawParamsPersisted": False,
                "rawMessagesReturned": False,
                "resultPreviewReturned": False,
                "requiresExplicitParams": True,
            },
        })

    def plan_next_action(self, *, workspace_dir: str = "", plan: Dict[str, Any]) -> Dict[str, Any]:
        plan = plan or {}
        plan_id = str(plan.get("plan_id") or "")
        steps = _tool_plan_steps(plan)
        if not steps:
            return _next_action_payload(
                action_type="no_executable_steps",
                reason="no_tool_steps",
                plan_id=plan_id,
            )

        for status, action_type, reason in (
            ("error", "recover_step", "step_error"),
            ("approval_required", "resolve_approval", "step_waiting_approval"),
            ("running", "wait_for_step", "step_running"),
        ):
            for step in steps:
                if str(step.get("status") or "planned") != status:
                    continue
                recovery = self.plan_step_recovery(
                    workspace_dir=workspace_dir,
                    plan=plan,
                    step_id=str(step.get("step_id") or ""),
                )
                return _next_action_payload(
                    action_type=action_type,
                    reason=reason,
                    plan_id=plan_id,
                    step=step,
                    contract=recovery.get("contract", {}) if isinstance(recovery, dict) else {},
                    recovery=recovery,
                )

        first_blocked: Optional[Dict[str, Any]] = None
        first_blocked_deps: List[str] = []
        for step in steps:
            status = str(step.get("status") or "planned")
            if status == "completed":
                continue
            deps = _unmet_tool_dependencies(plan, step)
            if deps:
                first_blocked = first_blocked or step
                first_blocked_deps = first_blocked_deps or deps
                continue
            contract = self.plan_step_contract(plan=plan, step_id=str(step.get("step_id") or ""))
            return _next_action_payload(
                action_type="execute_step",
                reason="step_not_executed",
                plan_id=plan_id,
                step=step,
                contract=contract,
            )

        if first_blocked:
            return _next_action_payload(
                action_type="blocked_dependencies",
                reason="blocked_dependencies",
                plan_id=plan_id,
                step=first_blocked,
                contract=self.plan_step_contract(plan=plan, step_id=str(first_blocked.get("step_id") or "")),
                blocked_dependencies=first_blocked_deps,
            )

        return _next_action_payload(
            action_type="plan_complete",
            reason="all_tool_steps_completed",
            plan_id=plan_id,
        )

    def plan_advance_decision(
        self,
        *,
        workspace_dir: str = "",
        plan: Dict[str, Any],
        allow_low_risk: bool = True,
    ) -> Dict[str, Any]:
        action = self.plan_next_action(workspace_dir=workspace_dir, plan=plan or {})
        if action.get("actionType") != "execute_step":
            return _advance_block_payload(
                action,
                str(action.get("reason") or "not_executable_next_action"),
                "Advance stopped because the next action is not a directly executable safe step.",
            )

        contract = action.get("contract", {}) if isinstance(action.get("contract"), dict) else {}
        step = action.get("step", {}) if isinstance(action.get("step"), dict) else {}
        if not contract.get("ok"):
            return _advance_block_payload(action, str(contract.get("reason") or "invalid_step_contract"))
        if contract.get("requires_approval") or step.get("requires_approval"):
            return _advance_block_payload(action, "approval_required", "Advance stopped because this step requires approval.")

        required_keys = contract.get("requiredParamKeys", [])
        if isinstance(required_keys, list) and required_keys:
            return _advance_block_payload(action, "explicit_params_required", "Advance stopped because this step needs explicit tool_params.")

        risk = str(contract.get("risk") or step.get("risk") or "safe")
        allowed_risks = {"safe", "low"} if allow_low_risk else {"safe"}
        if risk not in allowed_risks:
            return _advance_block_payload(action, "risk_not_auto_advance_allowed", f"Advance stopped because risk '{risk}' is not auto-executable.")

        step_id = str(contract.get("step_id") or step.get("step_id") or "")
        return sanitize_payload({
            "ok": True,
            "canAdvance": True,
            "reason": "safe_step_ready",
            "plan_id": action.get("plan_id", ""),
            "step_id": step_id,
            "tool_name": contract.get("tool_name", ""),
            "tool_params": {},
            "nextAction": action,
            "executeEndpoint": f"/v1/kernel/plans/{action.get('plan_id', '')}/steps/{step_id}/execute",
            "security": {
                "autoExecutesOnlySafeNoParamSteps": True,
                "allowedRisks": sorted(allowed_risks),
                "rawParamsPersisted": False,
                "rawMessagesReturned": False,
            },
        })

    def status(self, workspace_dir: str = "") -> Dict[str, Any]:
        return get_kernel_store(workspace_dir).trace_status()

    def recent_traces(self, workspace_dir: str = "", limit: int = 100, status: str = "") -> List[Dict[str, Any]]:
        return get_kernel_store(workspace_dir).recent_traces(limit=limit, status=status)

    def traces_for_plan(self, workspace_dir: str = "", plan_id: str = "", limit: int = 100, status: str = "") -> List[Dict[str, Any]]:
        return get_kernel_store(workspace_dir).traces_for_plan(plan_id=plan_id, limit=limit, status=status)


_executor = KernelExecutor()


def get_kernel_executor() -> KernelExecutor:
    return _executor
