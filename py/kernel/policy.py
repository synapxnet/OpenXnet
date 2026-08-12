#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""PolicyGate for kernel-governed tool permission visibility and enforcement."""

from __future__ import annotations

import time
from collections import deque
from dataclasses import asdict, dataclass, field
from typing import Any, Deque, Dict, List, Optional

from py.kernel.audit import get_kernel_audit, sanitize_payload
from py.kernel.runtime import kernel_mode_profile, mode_from_settings


FILE_WRITE_TOOLS = {
    "edit_file_tool",
    "edit_file_patch_tool",
    "todo_write_tool",
    "edit_file_tool_local",
    "edit_file_patch_tool_local",
    "todo_write_tool_local",
}

SHELL_TOOLS = {
    "shell_tool_local",
    "docker_sandbox",
}

SYSTEM_ADMIN_TOOLS = {
    "manage_processes_tool",
    "docker_manage_ports_tool",
    "local_net_tool",
}

DESKTOP_CONTROL_TOOLS = {
    "mouse_move",
    "mouse_click",
    "mouse_double_click",
    "mouse_drag",
    "mouse_scroll",
    "mouse_hold",
    "copy_to_input_box",
    "keyboard_press",
    "keyboard_sequence",
    "keyboard_hotkey",
    "keyboard_hold",
}

READ_ONLY_TOOLS = {
    "read_file_tool",
    "read_file_tool_local",
    "list_files_tool",
    "grep_tool",
    "screenshot",
}

AUTO_APPROVE_CAPABILITIES = {"file_write", "task_write"}


@dataclass
class PolicyDecision:
    tool_name: str
    capability: str
    decision: str
    risk: str
    permission_mode: str
    enforcement: str = "shadow"
    reasons: List[str] = field(default_factory=list)
    workspace_dir: str = ""
    project_allowed: bool = False
    actor: str = "model"
    created_at: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return sanitize_payload(asdict(self))


def _format_time(epoch: Optional[float] = None) -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S%z", time.localtime(epoch or time.time()))


def _engine_settings(settings: Dict[str, Any]) -> Dict[str, Any]:
    cli = settings.get("CLISettings", {}) if isinstance(settings, dict) else {}
    engine = str(cli.get("engine") or "local")
    node_name = f"{engine}Settings" if engine != "local" else "localEnvSettings"
    node = settings.get(node_name, {}) if isinstance(settings, dict) else {}
    return node if isinstance(node, dict) else {}


def _workspace_from_settings(settings: Dict[str, Any]) -> str:
    cli = settings.get("CLISettings", {}) if isinstance(settings, dict) else {}
    return str(cli.get("cc_path") or "")


def _policy_settings(settings: Dict[str, Any]) -> Dict[str, Any]:
    kernel_settings = settings.get("kernelSettings", {}) if isinstance(settings, dict) else {}
    if isinstance(kernel_settings, dict) and kernel_settings.get("enabled", True) is False:
        return {"enabled": False, "enforcementMode": "shadow"}
    policy_settings = kernel_settings.get("policyGate", {}) if isinstance(kernel_settings, dict) else {}
    return policy_settings if isinstance(policy_settings, dict) else {}


def _policy_enforcement(settings: Dict[str, Any]) -> str:
    policy_settings = _policy_settings(settings)
    if policy_settings.get("enabled", True) is False:
        return "disabled"
    raw_mode = policy_settings.get("enforcementMode")
    if raw_mode is None:
        runtime_mode = mode_from_settings(settings)
        return "enforce" if runtime_mode == "kernel" else "shadow"
    mode = str(raw_mode or "shadow").strip().lower()
    return "enforce" if mode in {"enforce", "enforced", "strict"} else "shadow"


def classify_tool(tool_name: str) -> Dict[str, str]:
    normalized = str(tool_name or "").replace("multi_tool_use.", "")
    if normalized in FILE_WRITE_TOOLS:
        return {"capability": "file_write", "risk": "confirm"}
    if normalized in SHELL_TOOLS:
        return {"capability": "shell_execute", "risk": "dangerous"}
    if normalized in SYSTEM_ADMIN_TOOLS:
        return {"capability": "system_admin", "risk": "dangerous"}
    if normalized in DESKTOP_CONTROL_TOOLS:
        return {"capability": "desktop_control", "risk": "confirm"}
    if normalized in READ_ONLY_TOOLS:
        return {"capability": "read_only", "risk": "low"}
    if normalized.startswith("custom_http_"):
        return {"capability": "network_call", "risk": "confirm"}
    return {"capability": "safe", "risk": "safe"}


class PolicyGate:
    """Central policy evaluator in shadow mode."""

    def __init__(self):
        self._recent: Deque[Dict[str, Any]] = deque(maxlen=100)
        self._counts: Dict[str, int] = {}

    def evaluate_tool_call(
        self,
        *,
        settings: Dict[str, Any],
        tool_name: str,
        actor: str = "model",
        workspace_dir: str = "",
        project_allowed: bool = False,
    ) -> PolicyDecision:
        settings = settings or {}
        classification = classify_tool(tool_name)
        capability = classification["capability"]
        risk = classification["risk"]
        permission_mode = str(_engine_settings(settings).get("permissionMode") or "default")
        workspace = workspace_dir or _workspace_from_settings(settings)
        enforcement = _policy_enforcement(settings)
        reasons: List[str] = []

        decision = "allow"
        if enforcement == "disabled":
            reasons.append("PolicyGate is disabled in kernel settings.")
        elif capability == "safe":
            reasons.append("Tool is not classified as governed.")
        elif capability == "read_only":
            reasons.append("Read-only tool is allowed by default.")
        elif project_allowed:
            reasons.append("Tool is allowed by the workspace project allow-list.")
        elif permission_mode in {"yolo", "cowork"}:
            reasons.append(f"Permission mode '{permission_mode}' allows governed tools.")
        elif permission_mode == "auto-approve" and capability in AUTO_APPROVE_CAPABILITIES:
            reasons.append("Auto-approve mode allows file/task writes.")
        else:
            decision = "approval_required" if enforcement == "enforce" else "would_require_approval"
            reasons.append(f"Permission mode '{permission_mode}' requires approval for {capability}.")

        return PolicyDecision(
            tool_name=str(tool_name or ""),
            capability=capability,
            decision=decision,
            risk=risk,
            permission_mode=permission_mode,
            enforcement=enforcement,
            reasons=reasons,
            workspace_dir=workspace,
            project_allowed=bool(project_allowed),
            actor=actor,
            created_at=_format_time(),
        )

    def observe_tool_call(
        self,
        *,
        settings: Dict[str, Any],
        tool_name: str,
        tool_params: Optional[Dict[str, Any]] = None,
        actor: str = "model",
        workspace_dir: str = "",
        project_allowed: bool = False,
    ) -> Dict[str, Any]:
        decision = self.evaluate_tool_call(
            settings=settings,
            tool_name=tool_name,
            actor=actor,
            workspace_dir=workspace_dir,
            project_allowed=project_allowed,
        ).to_dict()
        self._counts[decision["decision"]] = self._counts.get(decision["decision"], 0) + 1
        self._counts[f"capability:{decision['capability']}"] = self._counts.get(f"capability:{decision['capability']}", 0) + 1
        self._recent.append(decision)

        if decision.get("risk") not in {"safe", "low"}:
            payload = {
                "decision": decision,
                "tool_param_keys": sorted((tool_params or {}).keys()) if isinstance(tool_params, dict) else [],
            }
            event_type = "kernel.policy.enforced" if decision.get("decision") == "approval_required" else "kernel.policy.shadow"
            get_kernel_audit(decision.get("workspace_dir", "")).append(
                event_type,
                payload,
                actor=actor,
                workspace_dir=decision.get("workspace_dir", ""),
            )
        return decision

    def status(self, settings: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        settings = settings or {}
        runtime_mode = mode_from_settings(settings) if settings else "shadow"
        profile = kernel_mode_profile(runtime_mode)
        return {
            "runtimeMode": runtime_mode,
            "mode": _policy_enforcement(settings) if settings else "shadow",
            "profileRecommendedMode": profile.get("policyEnforcement", "shadow"),
            "profileAligned": (
                _policy_enforcement(settings) == profile.get("policyEnforcement", "shadow")
                if settings else True
            ),
            "counts": dict(self._counts),
            "recent": list(self._recent)[-20:],
            "governedCapabilities": [
                "file_write",
                "shell_execute",
                "system_admin",
                "desktop_control",
                "network_call",
            ],
        }


_policy_gate = PolicyGate()


def get_policy_gate() -> PolicyGate:
    return _policy_gate


def observe_tool_policy_shadow(
    settings: Dict[str, Any],
    tool_name: str,
    tool_params: Optional[Dict[str, Any]] = None,
    *,
    actor: str = "model",
    workspace_dir: str = "",
    project_allowed: bool = False,
) -> Dict[str, Any]:
    return _policy_gate.observe_tool_call(
        settings=settings,
        tool_name=tool_name,
        tool_params=tool_params,
        actor=actor,
        workspace_dir=workspace_dir,
        project_allowed=project_allowed,
    )


def should_enforce_policy(decision: Dict[str, Any]) -> bool:
    return (
        isinstance(decision, dict)
        and decision.get("enforcement") == "enforce"
        and decision.get("decision") == "approval_required"
    )


def build_approval_required_response(
    decision: Dict[str, Any],
    tool_params: Optional[Dict[str, Any]] = None,
    approval: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    response = {
        "type": "approval_required",
        "tool_name": decision.get("tool_name", ""),
        "tool_params": tool_params or {},
        "permission_mode": decision.get("permission_mode", "default"),
        "cwd": decision.get("workspace_dir", ""),
        "policy_decision": decision,
    }
    if approval:
        response["approval_id"] = approval.get("approval_id", "")
        response["approval_expires_at"] = approval.get("expires_at", "")
        response["approval_status"] = approval.get("status", "pending")
    return response
