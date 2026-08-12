#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""KernelRuntime wraps the neural-symbolic facade with mode and health state."""

from __future__ import annotations

import threading
import time
import copy
from collections import deque
from pathlib import Path
from typing import Any, Deque, Dict, List, Optional

from py.kernel.audit import get_kernel_audit, sanitize_payload
from py.kernel.facade import KernelFacade, get_kernel
from py.kernel.fusion import PostNeuralResult, PreNeuralResult
from py.kernel.store import get_kernel_store


RUNTIME_MODES = {"off", "shadow", "dual_write", "kernel", "degraded"}

KERNEL_MODE_PROFILES: Dict[str, Dict[str, Any]] = {
    "off": {
        "mode": "off",
        "stage": "disabled",
        "description": "Kernel is disabled; legacy chat and tools continue without kernel planning.",
        "executionAuthority": "legacy_only",
        "policyEnforcement": "shadow",
        "planner": {
            "enabled": False,
            "preflightEnabled": False,
            "persistPlans": False,
            "injectIntoContext": False,
        },
        "requiresConfirmation": True,
        "safeActivationPath": "POST /v1/kernel/runtime/mode with persist=true and confirmed=true",
    },
    "shadow": {
        "mode": "shadow",
        "stage": "observe",
        "description": "Kernel observes, plans, traces, and audits without blocking governed tool calls.",
        "executionAuthority": "legacy_observed",
        "policyEnforcement": "shadow",
        "planner": {
            "enabled": True,
            "preflightEnabled": True,
            "persistPlans": True,
            "injectIntoContext": False,
        },
        "requiresConfirmation": False,
        "safeActivationPath": "POST /v1/kernel/runtime/mode",
    },
    "dual_write": {
        "mode": "dual_write",
        "stage": "parallel",
        "description": "Kernel plans and writes durable traces alongside the legacy execution path.",
        "executionAuthority": "legacy_with_kernel_writeback",
        "policyEnforcement": "shadow",
        "planner": {
            "enabled": True,
            "preflightEnabled": True,
            "persistPlans": True,
            "injectIntoContext": True,
        },
        "requiresConfirmation": True,
        "safeActivationPath": "POST /v1/kernel/runtime/mode with confirmed=true",
    },
    "kernel": {
        "mode": "kernel",
        "stage": "govern",
        "description": "Kernel is the governance layer: plans are persisted, model context is kernel-aware, and governed tools require approval.",
        "executionAuthority": "kernel_governed_legacy_dispatch",
        "policyEnforcement": "enforce",
        "planner": {
            "enabled": True,
            "preflightEnabled": True,
            "persistPlans": True,
            "injectIntoContext": True,
        },
        "requiresConfirmation": True,
        "safeActivationPath": "POST /v1/kernel/runtime/mode with persist=true and confirmed=true",
    },
    "degraded": {
        "mode": "degraded",
        "stage": "fallback",
        "description": "Kernel degraded after an internal failure; legacy path remains available while recovery is inspected.",
        "executionAuthority": "legacy_fallback",
        "policyEnforcement": "shadow",
        "planner": {
            "enabled": True,
            "preflightEnabled": True,
            "persistPlans": True,
            "injectIntoContext": False,
        },
        "requiresConfirmation": False,
        "safeActivationPath": "Inspect /v1/kernel/runtime and recover the failed component.",
    },
}


def _format_time(epoch: Optional[float] = None) -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S%z", time.localtime(epoch or time.time()))


def normalize_runtime_mode(mode: str, *, default: str = "shadow") -> str:
    text = str(mode or "").strip().lower().replace("-", "_")
    aliases = {
        "disabled": "off",
        "disable": "off",
        "stop": "off",
        "dualwrite": "dual_write",
        "dual": "dual_write",
        "kernel_mode": "kernel",
        "enforce": "kernel",
        "fallback": "degraded",
    }
    text = aliases.get(text, text)
    return text if text in RUNTIME_MODES else default


def kernel_mode_profile(mode: str) -> Dict[str, Any]:
    """Return a model-safe runtime mode profile."""
    normalized = normalize_runtime_mode(mode, default="shadow")
    return sanitize_payload(copy.deepcopy(KERNEL_MODE_PROFILES.get(normalized, KERNEL_MODE_PROFILES["shadow"])))


def apply_runtime_mode_profile(settings: Dict[str, Any], mode: str) -> tuple[Dict[str, Any], Dict[str, Any]]:
    """Apply the runtime profile to settings without touching unrelated user config."""
    normalized = normalize_runtime_mode(mode, default="")
    if not normalized:
        return copy.deepcopy(settings or {}), {}
    profile = kernel_mode_profile(normalized)
    next_settings = copy.deepcopy(settings or {})
    kernel_settings = next_settings.setdefault("kernelSettings", {})
    if not isinstance(kernel_settings, dict):
        kernel_settings = {}
        next_settings["kernelSettings"] = kernel_settings

    kernel_settings["enabled"] = normalized != "off"
    kernel_settings["mode"] = normalized

    runtime_settings = kernel_settings.setdefault("runtime", {})
    if not isinstance(runtime_settings, dict):
        runtime_settings = {}
        kernel_settings["runtime"] = runtime_settings
    runtime_settings["mode"] = normalized
    runtime_settings.setdefault("autoDegrade", True)

    planner_profile = profile.get("planner", {}) if isinstance(profile.get("planner"), dict) else {}
    planner_settings = kernel_settings.setdefault("planner", {})
    if not isinstance(planner_settings, dict):
        planner_settings = {}
        kernel_settings["planner"] = planner_settings
    for key in ("enabled", "preflightEnabled", "persistPlans", "injectIntoContext"):
        if key in planner_profile:
            planner_settings[key] = bool(planner_profile[key])

    policy_settings = kernel_settings.setdefault("policyGate", {})
    if not isinstance(policy_settings, dict):
        policy_settings = {}
        kernel_settings["policyGate"] = policy_settings
    policy_settings["enabled"] = normalized != "off"
    policy_settings["enforcementMode"] = str(profile.get("policyEnforcement") or "shadow")
    policy_settings.setdefault("respectProjectAllowAlways", True)

    return next_settings, profile


def _runtime_settings(settings: Dict[str, Any]) -> Dict[str, Any]:
    kernel_settings = settings.get("kernelSettings", {}) if isinstance(settings, dict) else {}
    runtime_settings = kernel_settings.get("runtime", {}) if isinstance(kernel_settings, dict) else {}
    return runtime_settings if isinstance(runtime_settings, dict) else {}


def _planner_settings(settings: Dict[str, Any]) -> Dict[str, Any]:
    kernel_settings = settings.get("kernelSettings", {}) if isinstance(settings, dict) else {}
    planner_settings = kernel_settings.get("planner", {}) if isinstance(kernel_settings, dict) else {}
    return planner_settings if isinstance(planner_settings, dict) else {}


def _workspace_from_settings(settings: Dict[str, Any]) -> str:
    cli = settings.get("CLISettings", {}) if isinstance(settings, dict) else {}
    workspace = str(cli.get("cc_path") or "")
    if not workspace:
        return ""
    try:
        return str(Path(workspace).expanduser().resolve())
    except Exception:
        return workspace


def _bounded_int(value: Any, default: int, *, minimum: int = 1, maximum: int = 200) -> int:
    try:
        number = int(value)
    except Exception:
        number = default
    return max(minimum, min(number, maximum))


def _build_plan_step_index(plan: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if not isinstance(plan, dict):
        return []
    steps = plan.get("steps", [])
    if not isinstance(steps, list):
        return []
    indexed: List[Dict[str, Any]] = []
    for step in steps:
        if not isinstance(step, dict) or step.get("kind") != "tool" or not step.get("tool_name"):
            continue
        indexed.append({
            "step_id": step.get("step_id", ""),
            "index": step.get("index", 0),
            "title": str(step.get("title") or "")[:160],
            "kind": step.get("kind", ""),
            "tool_name": step.get("tool_name", ""),
            "capability": step.get("capability", ""),
            "risk": step.get("risk", ""),
            "requires_approval": bool(step.get("requires_approval", False)),
        })
        if len(indexed) >= 50:
            break
    return sanitize_payload(indexed)


def build_plan_trace_context(summary: Optional[Dict[str, Any]], plan: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Return a small trace metadata bridge from a KernelPlan summary."""
    if not isinstance(summary, dict) or not summary.get("plan_id"):
        return {}
    context = {
        "kernel_plan_id": summary.get("plan_id", ""),
        "kernel_plan_status": summary.get("status", ""),
        "kernel_plan_source": summary.get("source", ""),
        "kernel_plan_created_at": summary.get("created_at", ""),
        "kernel_plan_step_count": summary.get("step_count", 0),
        "kernel_plan_highest_risk": summary.get("highestRisk", ""),
        "conversation_id": summary.get("conversation_id", ""),
        "turn_id": summary.get("turn_id", ""),
    }
    step_index = _build_plan_step_index(plan)
    if step_index:
        context["_kernel_plan_step_index"] = step_index
    return sanitize_payload(context)


def mode_from_settings(settings: Dict[str, Any]) -> str:
    kernel_settings = settings.get("kernelSettings", {}) if isinstance(settings, dict) else {}
    if isinstance(kernel_settings, dict) and kernel_settings.get("enabled", True) is False:
        return "off"
    runtime_settings = _runtime_settings(settings)
    raw_mode = runtime_settings.get("mode")
    if raw_mode is None and isinstance(kernel_settings, dict):
        raw_mode = kernel_settings.get("mode", "shadow")
    return normalize_runtime_mode(str(raw_mode or "shadow"))


class KernelRuntime:
    """Runtime shell for the OpenXnet neural-symbolic kernel."""

    def __init__(self, facade: Optional[KernelFacade] = None):
        self._facade = facade or get_kernel()
        self._lock = threading.Lock()
        self._mode = "shadow"
        self._configured_mode = "shadow"
        self._enabled = True
        self._initialized = False
        self._degraded = False
        self._manual_override = False
        self._last_error = ""
        self._last_mode_change_reason = ""
        self._started_at = ""
        self._updated_at = ""
        self._components: Dict[str, Dict[str, Any]] = {}
        self._recent_plans: Deque[Dict[str, Any]] = deque(maxlen=50)

    def configure(self, settings: Dict[str, Any]) -> None:
        mode = mode_from_settings(settings or {})
        enabled = mode != "off"
        with self._lock:
            self._configured_mode = mode
            if not self._manual_override and not self._degraded:
                self._mode = mode
            active_mode = self._mode if self._manual_override else mode
            self._enabled = enabled if not self._manual_override else active_mode != "off"
            self._updated_at = _format_time()

    @property
    def enabled(self) -> bool:
        return self._enabled and self._mode != "off"

    @property
    def mode(self) -> str:
        return self._mode

    def set_mode(
        self,
        mode: str,
        *,
        reason: str = "",
        actor: str = "system",
        manual_override: bool = True,
    ) -> Dict[str, Any]:
        next_mode = normalize_runtime_mode(mode, default=self._mode)
        with self._lock:
            previous = self._mode
            self._mode = next_mode
            self._configured_mode = next_mode if next_mode != "degraded" else self._configured_mode
            self._manual_override = bool(manual_override)
            self._enabled = next_mode != "off"
            self._degraded = next_mode == "degraded"
            if next_mode != "degraded":
                self._last_error = ""
            self._last_mode_change_reason = reason or ""
            self._updated_at = _format_time()
        return {
            "ok": True,
            "previousMode": previous,
            "mode": next_mode,
            "actor": actor,
            "reason": reason or "",
            "runtime": self.status(),
        }

    def degrade(self, reason: str, *, component: str = "runtime") -> Dict[str, Any]:
        with self._lock:
            self._mode = "degraded"
            self._degraded = True
            self._last_error = str(reason or "")
            self._updated_at = _format_time()
            self._components[component] = {
                "status": "degraded",
                "reason": str(reason or ""),
                "updated_at": self._updated_at,
            }
        return self.status()

    def mark_initialized(self) -> None:
        with self._lock:
            self._initialized = True
            if not self._started_at:
                self._started_at = _format_time()
            self._updated_at = _format_time()

    def mark_component(self, name: str, status: str, **metadata: Any) -> None:
        with self._lock:
            self._components[str(name or "component")] = sanitize_payload({
                "status": status,
                "updated_at": _format_time(),
                **metadata,
            })
            self._updated_at = _format_time()

    def init_cortex(self) -> None:
        if not self.enabled:
            self.mark_component("cortex", "skipped", reason="runtime_disabled")
            return
        self._facade.init_cortex()
        self.mark_component("cortex", "ready")

    async def build_vector_index(self, symbols: list) -> int:
        if not self.enabled:
            self.mark_component("vector_index", "skipped", reason="runtime_disabled")
            return 0
        count = await self._facade.build_vector_index(symbols)
        self.mark_component("vector_index", "ready", indexed=count)
        return count

    def _plan_summary(
        self,
        plan: Dict[str, Any],
        *,
        source: str = "chat",
        conversation_id: str = "",
        turn_id: str = "",
    ) -> Dict[str, Any]:
        risk = plan.get("risk_summary", {}) if isinstance(plan, dict) else {}
        execution = plan.get("execution_contract", {}) if isinstance(plan, dict) else {}
        goal = str(plan.get("goal") or "") if isinstance(plan, dict) else ""
        return sanitize_payload({
            "schema": "openxnet.kernel.plan_summary.v1",
            "plan_id": plan.get("plan_id", "") if isinstance(plan, dict) else "",
            "status": plan.get("status", "unknown") if isinstance(plan, dict) else "unknown",
            "runtime_mode": plan.get("runtime_mode", self._mode) if isinstance(plan, dict) else self._mode,
            "created_at": plan.get("created_at", _format_time()) if isinstance(plan, dict) else _format_time(),
            "source": source or "chat",
            "conversation_id": conversation_id or "",
            "turn_id": turn_id or "",
            "step_count": len(plan.get("steps") or []) if isinstance(plan, dict) else 0,
            "highestRisk": risk.get("highestRisk", "safe") if isinstance(risk, dict) else "safe",
            "approvalStepCount": risk.get("approvalStepCount", 0) if isinstance(risk, dict) else 0,
            "dangerousStepCount": risk.get("dangerousStepCount", 0) if isinstance(risk, dict) else 0,
            "dryRun": bool(execution.get("dryRun", True)) if isinstance(execution, dict) else True,
            "rawMessagesReturned": bool(plan.get("raw_messages_returned", False)) if isinstance(plan, dict) else False,
            "goal_preview": goal[:240] + ("... [truncated]" if len(goal) > 240 else ""),
        })

    def _record_plan_summary(
        self,
        summary: Dict[str, Any],
        *,
        plan: Optional[Dict[str, Any]] = None,
        persist: bool = True,
        workspace: str = "",
        actor: str = "system",
        component_status: str = "ready",
    ) -> Dict[str, Any]:
        summary = sanitize_payload(summary or {})
        updated_at = _format_time()
        with self._lock:
            self._recent_plans.append(summary)
            self._components["planner"] = sanitize_payload({
                "status": component_status,
                "updated_at": updated_at,
                "last_plan_id": summary.get("plan_id", ""),
                "last_plan_status": summary.get("status", ""),
                "last_source": summary.get("source", ""),
            })
            self._updated_at = updated_at
        if persist:
            try:
                get_kernel_store(workspace).insert_plan(plan or {}, summary)
            except Exception:
                pass
        try:
            get_kernel_audit(workspace).append(
                "kernel.plan.created",
                summary,
                actor=actor or "system",
                workspace_dir=workspace,
            )
        except Exception:
            pass
        return summary

    def recent_plans(self, limit: int = 20, workspace_dir: str = "", status: str = "", source: str = "") -> List[Dict[str, Any]]:
        max_items = _bounded_int(limit, 20, minimum=1, maximum=50)
        if workspace_dir:
            try:
                return get_kernel_store(workspace_dir).recent_plans(limit=max_items, status=status, source=source)
            except Exception:
                pass
        with self._lock:
            plans = list(self._recent_plans)[-max_items:]
        if status:
            plans = [plan for plan in plans if plan.get("status") == status]
        if source:
            plans = [plan for plan in plans if plan.get("source") == source]
        return sanitize_payload(plans)

    def get_plan(self, plan_id: str, workspace_dir: str = "") -> Optional[Dict[str, Any]]:
        workspace = workspace_dir or ""
        try:
            return get_kernel_store(workspace).get_plan(plan_id, include_plan=True)
        except Exception:
            return None

    def plan_status(self, workspace_dir: str = "") -> Dict[str, Any]:
        try:
            return get_kernel_store(workspace_dir or "").plan_status()
        except Exception as exc:
            return {"error": str(exc), "recentPlanCount": len(self._recent_plans)}

    def plan_turn(
        self,
        settings: Dict[str, Any],
        *,
        goal: str = "",
        messages: Optional[List[Dict[str, Any]]] = None,
        model: str = "",
        candidate_tools: Optional[List[Any]] = None,
        kernel_diagnostics: Optional[Dict[str, Any]] = None,
        include_world: Optional[bool] = None,
        source: str = "chat",
        conversation_id: str = "",
        turn_id: str = "",
        actor: str = "system",
        force: bool = False,
    ) -> Dict[str, Any]:
        """Create and audit a dry-run plan for a turn without executing tools."""
        settings = settings or {}
        self.configure(settings)
        planner_settings = _planner_settings(settings)
        planner_enabled = planner_settings.get("enabled", True) is not False
        preflight_enabled = planner_settings.get("preflightEnabled", True) is not False
        persist_plans = planner_settings.get("persistPlans", True) is not False
        if not force and (not self.enabled or not planner_enabled or not preflight_enabled):
            return sanitize_payload({
                "ok": False,
                "reason": "runtime_or_planner_disabled",
                "runtime_mode": self._mode,
                "plannerEnabled": planner_enabled,
                "preflightEnabled": preflight_enabled,
            })

        workspace = _workspace_from_settings(settings)
        max_tools = _bounded_int(planner_settings.get("maxCandidateTools", 12), 12, minimum=1, maximum=50)
        tools = list(candidate_tools or [])[:max_tools]
        if include_world is None:
            include_world = bool(planner_settings.get("includeWorldByDefault", True))

        try:
            from py.kernel.planner import build_kernel_plan

            plan = build_kernel_plan(
                settings,
                goal=goal,
                messages=messages or [],
                model=model or settings.get("model", ""),
                candidate_tools=tools,
                kernel_diagnostics=kernel_diagnostics if kernel_diagnostics is not None else self.get_diagnostics(),
                include_world=bool(include_world),
            )
            summary = self._plan_summary(
                plan,
                source=source,
                conversation_id=conversation_id,
                turn_id=turn_id,
            )
            self._record_plan_summary(
                summary,
                plan=plan,
                persist=persist_plans,
                workspace=workspace,
                actor=actor,
                component_status="ready",
            )
            return sanitize_payload({"ok": True, "plan": plan, "summary": summary})
        except Exception as exc:
            summary = sanitize_payload({
                "schema": "openxnet.kernel.plan_summary.v1",
                "plan_id": "",
                "status": "planner_error",
                "runtime_mode": self._mode,
                "created_at": _format_time(),
                "source": source or "chat",
                "conversation_id": conversation_id or "",
                "turn_id": turn_id or "",
                "step_count": 0,
                "highestRisk": "unknown",
                "approvalStepCount": 0,
                "dangerousStepCount": 0,
                "dryRun": True,
                "rawMessagesReturned": False,
                "goal_preview": str(goal or "")[:240],
                "error": str(exc),
            })
            self._record_plan_summary(
                summary,
                persist=persist_plans,
                workspace=workspace,
                actor=actor,
                component_status="error",
            )
            return sanitize_payload({"ok": False, "reason": "planner_error", "error": str(exc), "summary": summary})

    async def pre_neural(
        self,
        user_text: str,
        messages: List[Dict],
        settings: Dict[str, Any],
        symbol_store: Any,
    ) -> PreNeuralResult:
        self.configure(settings or {})
        if not self.enabled:
            return PreNeuralResult()
        try:
            return await self._facade.pre_neural(user_text, messages, settings, symbol_store)
        except Exception as exc:
            if _runtime_settings(settings or {}).get("autoDegrade", True) is not False:
                self.degrade(str(exc), component="pre_neural")
            raise

    async def post_neural(
        self,
        user_text: str,
        assistant_output: str,
        tools_used: List[str],
        success: bool,
        settings: Dict[str, Any],
        symbol_store: Any,
        fast_client: Any = None,
        is_sub_agent: bool = False,
    ) -> PostNeuralResult:
        self.configure(settings or {})
        if not self.enabled:
            return PostNeuralResult()
        try:
            return await self._facade.post_neural(
                user_text=user_text,
                assistant_output=assistant_output,
                tools_used=tools_used,
                success=success,
                settings=settings,
                symbol_store=symbol_store,
                fast_client=fast_client,
                is_sub_agent=is_sub_agent,
            )
        except Exception as exc:
            if _runtime_settings(settings or {}).get("autoDegrade", True) is not False:
                self.degrade(str(exc), component="post_neural")
            raise

    def status(self, settings: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        if settings is not None:
            self.configure(settings)
        with self._lock:
            return sanitize_payload({
                "schema": "openxnet.kernel.runtime.v1",
                "enabled": self.enabled,
                "mode": self._mode,
                "configuredMode": self._configured_mode,
                "initialized": self._initialized,
                "degraded": self._degraded,
                "manualOverride": self._manual_override,
                "lastError": self._last_error,
                "lastModeChangeReason": self._last_mode_change_reason,
                "modeProfile": kernel_mode_profile(self._mode),
                "startedAt": self._started_at,
                "updatedAt": self._updated_at,
                "components": self._components,
                "planner": {
                    "recentPlanCount": len(self._recent_plans),
                    "lastPlan": self._recent_plans[-1] if self._recent_plans else None,
                    "planStatusEndpoint": "/v1/kernel/plans/status",
                    "recentPlansEndpoint": "/v1/kernel/plans/recent",
                    "planControlBoardEndpoint": "/v1/kernel/plans/control-board",
                    "planActionQueueEndpoint": "/v1/kernel/plans/action-queue",
                    "planDetailEndpoint": "/v1/kernel/plans/{plan_id}",
                    "planControlEndpoint": "/v1/kernel/plans/{plan_id}/control",
                    "planTracesEndpoint": "/v1/kernel/plans/{plan_id}/traces",
                    "planTimelineEndpoint": "/v1/kernel/plans/{plan_id}/timeline",
                    "planRunsEndpoint": "/v1/kernel/plans/{plan_id}/runs",
                    "planNextActionEndpoint": "/v1/kernel/plans/{plan_id}/next-action",
                    "planAdvanceEndpoint": "/v1/kernel/plans/{plan_id}/advance",
                    "planRunEndpoint": "/v1/kernel/plans/{plan_id}/run",
                    "planResumeEndpoint": "/v1/kernel/plans/{plan_id}/resume",
                    "planResumePreviewEndpoint": "/v1/kernel/plans/{plan_id}/resume-preview",
                    "planStepContractEndpoint": "/v1/kernel/plans/{plan_id}/steps/{step_id}/contract",
                    "planStepRecoveryEndpoint": "/v1/kernel/plans/{plan_id}/steps/{step_id}/recovery",
                    "planStepExecuteEndpoint": "/v1/kernel/plans/{plan_id}/steps/{step_id}/execute",
                },
                "supportedModes": sorted(RUNTIME_MODES),
                "modeProfiles": {
                    mode: kernel_mode_profile(mode)
                    for mode in sorted(RUNTIME_MODES)
                },
            })

    def get_diagnostics(self) -> Dict[str, Any]:
        facade_diag: Dict[str, Any] = {}
        try:
            facade_diag = self._facade.get_diagnostics()
        except Exception as exc:
            facade_diag = {"error": str(exc)}
        return sanitize_payload({
            "runtime": self.status(),
            "facade": facade_diag,
        })


_runtime: Optional[KernelRuntime] = None


def get_kernel_runtime() -> KernelRuntime:
    global _runtime
    if _runtime is None:
        _runtime = KernelRuntime()
    return _runtime
