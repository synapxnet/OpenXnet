#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""KernelPlan v1: dry-run execution planning over WorldState and PolicyGate."""

from __future__ import annotations

import time
import uuid
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional

from py.kernel.audit import sanitize_payload
from py.kernel.policy import classify_tool, get_policy_gate
from py.kernel.runtime import mode_from_settings
from py.kernel.world_state import build_world_state


PLAN_SCHEMA = "openxnet.kernel.plan.v1"


def _format_time(epoch: Optional[float] = None) -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S%z", time.localtime(epoch or time.time()))


def _workspace_from_settings(settings: Dict[str, Any]) -> str:
    cli = settings.get("CLISettings", {}) if isinstance(settings, dict) else {}
    return str(cli.get("cc_path") or "")


def _safe_goal(goal: str) -> str:
    text = str(goal or "").strip()
    return text[:800] + ("... [truncated]" if len(text) > 800 else "")


@dataclass
class KernelPlanStep:
    step_id: str
    index: int
    title: str
    kind: str
    status: str = "planned"
    description: str = ""
    tool_name: str = ""
    capability: str = ""
    risk: str = "safe"
    policy_decision: Dict[str, Any] = field(default_factory=dict)
    requires_approval: bool = False
    depends_on: List[str] = field(default_factory=list)
    inputs: Dict[str, Any] = field(default_factory=dict)
    expected_output: str = ""
    verification: str = ""
    rollback: str = ""
    recovery: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return sanitize_payload(asdict(self))


@dataclass
class KernelPlan:
    plan_id: str
    goal: str
    status: str
    workspace_dir: str
    runtime_mode: str
    created_at: str
    summary: str
    steps: List[KernelPlanStep] = field(default_factory=list)
    risk_summary: Dict[str, Any] = field(default_factory=dict)
    policy_summary: Dict[str, Any] = field(default_factory=dict)
    world_refs: Dict[str, Any] = field(default_factory=dict)
    execution_contract: Dict[str, Any] = field(default_factory=dict)
    raw_messages_returned: bool = False

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["schema"] = PLAN_SCHEMA
        data["steps"] = [step.to_dict() for step in self.steps]
        return sanitize_payload(data)


def _normalize_candidate_tools(candidate_tools: Optional[List[Any]]) -> List[Dict[str, Any]]:
    tools: List[Dict[str, Any]] = []
    for item in candidate_tools or []:
        if isinstance(item, str):
            name = item.strip()
            if name:
                tools.append({"tool_name": name, "reason": "provided_by_caller"})
        elif isinstance(item, dict):
            fn = item.get("function") if isinstance(item.get("function"), dict) else {}
            name = str(item.get("tool_name") or item.get("name") or fn.get("name") or "").strip()
            if name:
                tools.append({
                    "tool_name": name,
                    "reason": str(item.get("reason") or "provided_by_caller"),
                    "param_keys": sorted(str(key) for key in (item.get("tool_params") or {}).keys())
                    if isinstance(item.get("tool_params"), dict)
                    else item.get("param_keys", []),
                })
    seen = set()
    unique: List[Dict[str, Any]] = []
    for tool in tools:
        name = tool["tool_name"]
        if name in seen:
            continue
        seen.add(name)
        unique.append(tool)
    return unique[:12]


def _infer_candidate_tools(goal: str) -> List[Dict[str, Any]]:
    text = str(goal or "")
    lowered = text.lower()
    tools: List[Dict[str, Any]] = []

    def add(tool_name: str, reason: str) -> None:
        tools.append({"tool_name": tool_name, "reason": reason})

    if any(word in text for word in ["读取", "查看", "检查", "梳理", "复核"]) or any(word in lowered for word in ["read", "inspect", "review"]):
        add("read_file_tool_local", "Goal may need local file inspection")
    if any(word in text for word in ["修改", "新增", "写入", "实现", "修复", "升级", "补充"]) or any(word in lowered for word in ["edit", "write", "implement", "fix", "patch"]):
        add("edit_file_patch_tool_local", "Goal may require code or document edits")
    if any(word in text for word in ["运行", "执行", "测试", "编译", "构建", "烟测"]) or any(word in lowered for word in ["run", "test", "compile", "build", "smoke"]):
        add("shell_tool_local", "Goal may require local command execution")
    if any(word in text for word in ["网页", "联网", "搜索", "最新"]) or any(word in lowered for word in ["web", "search", "latest"]):
        add("web_search", "Goal may require external information retrieval")
    if any(word in text for word in ["桌面", "鼠标", "键盘", "点击", "截图"]) or any(word in lowered for word in ["desktop", "mouse", "keyboard", "click", "screenshot"]):
        add("screenshot", "Goal may require desktop observation")
        add("mouse_click", "Goal may require governed desktop control")
    return _normalize_candidate_tools(tools)


def _tool_step_text(tool_name: str, capability: str, risk: str) -> Dict[str, str]:
    if capability == "file_write":
        return {
            "title": "Prepare file patch",
            "verification": "Run targeted syntax checks or tests for edited files.",
            "rollback": "Keep edits scoped so the patch can be reverted file-by-file if validation fails.",
            "recovery": "If patch application fails, reread the target file and retry with a smaller diff.",
        }
    if capability == "shell_execute":
        return {
            "title": "Run local command",
            "verification": "Inspect exit code and key output lines before proceeding.",
            "rollback": "Prefer read-only or build/test commands; avoid persistent side effects unless approved.",
            "recovery": "If the command fails, capture stderr, working directory, and retry with corrected parameters.",
        }
    if capability == "desktop_control":
        return {
            "title": "Operate desktop surface",
            "verification": "Confirm the visible UI state after the action.",
            "rollback": "Use the app's own undo/back/cancel affordance when available.",
            "recovery": "If target state is unclear, take a screenshot and re-plan before more input.",
        }
    if capability == "read_only":
        return {
            "title": "Read local context",
            "verification": "Summarize only the relevant findings and cite file paths.",
            "rollback": "No rollback needed for read-only inspection.",
            "recovery": "If the file is missing, search nearby paths and report the exact lookup.",
        }
    return {
        "title": f"Use {tool_name}",
        "verification": "Check the returned data before using it in the final answer.",
        "rollback": "Do not persist changes unless a later governed step approves them.",
        "recovery": "If the call fails, record the reason and re-plan with safer inputs.",
    }


def _build_risk_summary(steps: List[KernelPlanStep]) -> Dict[str, Any]:
    risk_order = {"safe": 0, "low": 1, "confirm": 2, "dangerous": 3}
    highest = "safe"
    counts: Dict[str, int] = {}
    approvals = 0
    governed: List[str] = []
    for step in steps:
        counts[step.risk] = counts.get(step.risk, 0) + 1
        if risk_order.get(step.risk, 0) > risk_order.get(highest, 0):
            highest = step.risk
        if step.requires_approval:
            approvals += 1
        if step.capability and step.capability not in {"safe"}:
            governed.append(step.capability)
    return {
        "highestRisk": highest,
        "riskCounts": counts,
        "approvalStepCount": approvals,
        "governedCapabilities": sorted(set(governed)),
        "dangerousStepCount": sum(1 for step in steps if step.risk == "dangerous"),
    }


def _plan_status(steps: List[KernelPlanStep], runtime_mode: str) -> str:
    if runtime_mode == "off":
        return "blocked_runtime_off"
    if runtime_mode == "degraded":
        return "needs_recovery"
    if any(step.requires_approval for step in steps):
        return "needs_review"
    if any(step.risk == "dangerous" for step in steps):
        return "needs_review"
    return "ready"


def build_kernel_plan(
    settings: Dict[str, Any],
    *,
    goal: str = "",
    messages: Optional[List[Dict[str, Any]]] = None,
    model: str = "",
    candidate_tools: Optional[List[Any]] = None,
    kernel_diagnostics: Optional[Dict[str, Any]] = None,
    include_world: bool = True,
) -> Dict[str, Any]:
    """Return a dry-run plan; does not execute tools or persist raw parameters."""
    settings = settings or {}
    workspace = _workspace_from_settings(settings)
    runtime_mode = mode_from_settings(settings)
    kernel_settings = settings.get("kernelSettings", {}) if isinstance(settings, dict) else {}
    planner_settings = kernel_settings.get("planner", {}) if isinstance(kernel_settings, dict) else {}
    planner_enabled = not isinstance(planner_settings, dict) or planner_settings.get("enabled", True) is not False
    safe_goal = _safe_goal(goal)
    world = build_world_state(
        settings,
        messages=messages or [],
        model=model or settings.get("model", ""),
        kernel_diagnostics=kernel_diagnostics or {},
        include_recent=False,
    )
    conversation = world.get("conversation", {}).get("state", {}) if isinstance(world, dict) else {}

    tools = _normalize_candidate_tools(candidate_tools)
    if not tools:
        tools = _infer_candidate_tools(safe_goal)

    steps: List[KernelPlanStep] = []
    plan_id = f"kplan_{uuid.uuid4().hex}"

    def add_step(**kwargs: Any) -> KernelPlanStep:
        step = KernelPlanStep(
            step_id=f"{plan_id}_step_{len(steps) + 1}",
            index=len(steps) + 1,
            **kwargs,
        )
        steps.append(step)
        return step

    world_step = add_step(
        title="Build sanitized WorldState",
        kind="world_state",
        description="Collect runtime, policy, context, approval, trace, guidance, and config-intent state before planning.",
        expected_output="A model-safe world snapshot with no raw secrets or raw tool parameters.",
        verification="Confirm world.schema is openxnet.kernel.world_state.v1 and rawMessagesReturned is false.",
        rollback="No rollback needed; this step is read-only.",
        recovery="If WorldState is partial, continue with available sections and mark missing sources.",
    )

    add_step(
        title="Reason over goal and constraints",
        kind="reasoning",
        description="Map the user goal to candidate capabilities and policy constraints.",
        depends_on=[world_step.step_id],
        inputs={
            "goal_present": bool(safe_goal),
            "message_count": conversation.get("message_count", len(messages or [])),
            "context_phase": conversation.get("phase", "unknown"),
        },
        expected_output="A bounded execution strategy with explicit governed capabilities.",
        verification="Check that risky capabilities have policy decisions before execution.",
        rollback="No rollback needed; this step is read-only.",
        recovery="If the goal is ambiguous, request clarification before executing irreversible steps.",
    )

    policy_gate = get_policy_gate()
    policy_counts: Dict[str, int] = {}
    for tool in tools:
        tool_name = tool.get("tool_name", "")
        classification = classify_tool(tool_name)
        decision = policy_gate.evaluate_tool_call(
            settings=settings,
            tool_name=tool_name,
            actor="planner",
            workspace_dir=workspace,
        ).to_dict()
        policy_counts[decision.get("decision", "unknown")] = policy_counts.get(decision.get("decision", "unknown"), 0) + 1
        requires_approval = decision.get("decision") in {"approval_required", "would_require_approval"}
        copy = _tool_step_text(tool_name, classification["capability"], classification["risk"])
        add_step(
            title=copy["title"],
            kind="tool",
            description=tool.get("reason", f"Candidate tool for goal: {tool_name}"),
            tool_name=tool_name,
            capability=classification["capability"],
            risk=classification["risk"],
            policy_decision=decision,
            requires_approval=requires_approval,
            depends_on=[steps[-1].step_id] if steps else [],
            inputs={
                "tool_param_keys": tool.get("param_keys", []),
                "rawParamsPersisted": False,
            },
            expected_output=f"Tool result for {tool_name}, inspected before any follow-up step.",
            verification=copy["verification"],
            rollback=copy["rollback"],
            recovery=copy["recovery"],
        )

    add_step(
        title="Verify outcome and record trace",
        kind="verification",
        description="Validate planned outputs, record trace IDs for governed actions, and prepare recovery hints.",
        depends_on=[steps[-1].step_id] if steps else [],
        expected_output="A final response or next action with traceable evidence and recovery path.",
        verification="Check tests, command outputs, route responses, or UI state depending on executed steps.",
        rollback="If verification fails, stop and recover from the last successful trace.",
        recovery="Use /v1/kernel/traces/{trace_id}/recovery for failed governed executions.",
    )

    risk_summary = _build_risk_summary(steps)
    status = "blocked_planner_disabled" if not planner_enabled else _plan_status(steps, runtime_mode)
    plan = KernelPlan(
        plan_id=plan_id,
        goal=safe_goal,
        status=status,
        workspace_dir=workspace,
        runtime_mode=runtime_mode,
        created_at=_format_time(),
        summary=(
            f"Plan has {len(steps)} steps, {risk_summary['approvalStepCount']} approval-sensitive steps, "
            f"highest risk {risk_summary['highestRisk']}."
        ),
        steps=steps,
        risk_summary=risk_summary,
        policy_summary={
            "decisionCounts": policy_counts,
            "policyMode": world.get("kernel", {}).get("policy", {}).get("mode", "shadow")
            if isinstance(world, dict)
            else "shadow",
        },
        world_refs={
            "schema": world.get("schema", "") if isinstance(world, dict) else "",
            "generated_at": world.get("generated_at", "") if isinstance(world, dict) else "",
            "conversationPhase": conversation.get("phase", "unknown"),
            "runtimeMode": runtime_mode,
            "workspace": workspace,
        },
        execution_contract={
            "dryRun": True,
            "plannerEnabled": planner_enabled,
            "executesTools": False,
            "runtimeMode": runtime_mode,
            "governedExecutionAvailable": runtime_mode == "kernel",
            "executeVia": "/v1/kernel/plans/{plan_id}/run",
            "resumeVia": "/v1/kernel/plans/{plan_id}/resume",
            "rawMessagesReturned": False,
            "rawParamsPersisted": False,
            "requiresExplicitApprovalForGovernedSteps": risk_summary["approvalStepCount"] > 0,
            "traceRecoveryEndpoint": "/v1/kernel/traces/{trace_id}/recovery",
        },
        raw_messages_returned=False,
    )
    payload = plan.to_dict()
    if include_world:
        payload["world"] = world
    return sanitize_payload(payload)
