#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""Sanitized kernel world-state snapshot for UI and model awareness."""

from __future__ import annotations

import time
from typing import Any, Callable, Dict, List, Optional

from py.kernel.audit import sanitize_payload
from py.kernel.approval import get_approval_center
from py.kernel.config_intent import pending_config_intents
from py.kernel.conversation_state import build_conversation_state
from py.kernel.event_bus import get_kernel_event_bus
from py.kernel.executor import get_kernel_executor
from py.kernel.guidance import get_guidance_bus
from py.kernel.policy import get_policy_gate
from py.kernel.runtime import kernel_mode_profile, mode_from_settings
from py.kernel.skill_lifecycle import get_skill_lifecycle
from py.kernel.system_manifest import build_system_manifest


WORLD_STATE_SCHEMA = "openxnet.kernel.world_state.v1"


def _format_time(epoch: Optional[float] = None) -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S%z", time.localtime(epoch or time.time()))


def _safe(default: Any, fn: Callable[[], Any]) -> Any:
    try:
        return fn()
    except Exception as exc:
        return {"error": str(exc)} if isinstance(default, dict) else default


def _workspace_from_settings(settings: Dict[str, Any]) -> str:
    cli = settings.get("CLISettings", {}) if isinstance(settings, dict) else {}
    return str(cli.get("cc_path") or "")


def _engine_state(settings: Dict[str, Any]) -> Dict[str, Any]:
    cli = settings.get("CLISettings", {}) if isinstance(settings, dict) else {}
    engine = str(cli.get("engine") or "local")
    node_name = f"{engine}Settings" if engine != "local" else "localEnvSettings"
    node = settings.get(node_name, {}) if isinstance(settings, dict) else {}
    if not isinstance(node, dict):
        node = {}
    return {
        "engine": engine,
        "settingsNode": node_name,
        "enabled": bool(cli.get("enabled", False)),
        "visibilityScope": cli.get("visibilityScope", "workspace"),
        "permissionMode": node.get("permissionMode", "default"),
    }


def _kernel_settings(settings: Dict[str, Any]) -> Dict[str, Any]:
    node = settings.get("kernelSettings", {}) if isinstance(settings, dict) else {}
    return node if isinstance(node, dict) else {}


def _context_compression(settings: Dict[str, Any]) -> Dict[str, Any]:
    kernel_settings = _kernel_settings(settings)
    compression = kernel_settings.get("contextCompression", {})
    if not isinstance(compression, dict):
        compression = {}
    return {
        "enabled": bool(compression.get("enabled", False)),
        "preSummarizeRatio": compression.get("preSummarizeRatio", 0.6),
        "compactRatio": compression.get("compactRatio", 0.8),
        "blockGrowthRatio": compression.get("blockGrowthRatio", 0.95),
    }


def _model_state(settings: Dict[str, Any], model: str = "") -> Dict[str, Any]:
    providers = settings.get("modelProviders", []) if isinstance(settings, dict) else []
    provider_count = len(providers) if isinstance(providers, list) else 0
    return {
        "model": model or settings.get("model", ""),
        "selectedProvider": settings.get("selectedProvider"),
        "providerCount": provider_count,
        "temperature": settings.get("temperature"),
        "maxTokens": settings.get("max_tokens"),
        "reasoningEffort": settings.get("reasoning_effort"),
    }


def _trace_preview(trace: Dict[str, Any]) -> Dict[str, Any]:
    trace = trace or {}
    metadata = trace.get("metadata", {}) if isinstance(trace.get("metadata"), dict) else {}
    return {
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
        "kernel_plan_id": metadata.get("kernel_plan_id", ""),
        "kernel_plan_step_id": metadata.get("kernel_plan_step_id", ""),
        "kernel_plan_step_title": metadata.get("kernel_plan_step_title", ""),
    }


def _event_preview(event: Dict[str, Any]) -> Dict[str, Any]:
    event = event or {}
    data = event.get("data", {})
    data_keys = sorted(str(key) for key in data.keys()) if isinstance(data, dict) else []
    return {
        "sequence": event.get("sequence"),
        "event": event.get("event", ""),
        "timestamp": event.get("timestamp", ""),
        "data_keys": data_keys,
    }


def _guidance_preview(item: Dict[str, Any]) -> Dict[str, Any]:
    item = item or {}
    text = str(item.get("text") or "")
    return {
        "guidance_id": item.get("guidance_id", ""),
        "conversation_id": item.get("conversation_id", ""),
        "turn_id": item.get("turn_id", ""),
        "trace_id": item.get("trace_id", ""),
        "mode": item.get("mode", "soft"),
        "priority": item.get("priority", 0),
        "created_at": item.get("created_at", ""),
        "has_text": bool(text),
        "text_preview": text[:240] + ("... [truncated]" if len(text) > 240 else ""),
    }


def build_world_state(
    settings: Dict[str, Any],
    *,
    messages: Optional[List[Dict[str, Any]]] = None,
    model: str = "",
    kernel_diagnostics: Optional[Dict[str, Any]] = None,
    include_recent: bool = True,
) -> Dict[str, Any]:
    """Build a fast, non-invasive, model-safe snapshot of the OpenXnet kernel world."""
    settings = settings or {}
    workspace = _workspace_from_settings(settings)
    effective_model = model or settings.get("model", "")
    runtime_mode = mode_from_settings(settings)
    conversation = build_conversation_state(messages or [], effective_model).to_dict()
    compression = _context_compression(settings)
    manifest = build_system_manifest(
        settings,
        kernel_diagnostics=kernel_diagnostics or {},
        tools=None,
    )

    approval_center = get_approval_center()
    executor = get_kernel_executor()
    event_bus = get_kernel_event_bus()
    guidance_bus = get_guidance_bus()
    skill_lifecycle = get_skill_lifecycle(workspace)

    recent_traces: List[Dict[str, Any]] = []
    recent_events: List[Dict[str, Any]] = []
    pending_guidance: List[Dict[str, Any]] = []
    if include_recent:
        recent_traces = [
            _trace_preview(trace)
            for trace in _safe([], lambda: executor.recent_traces(workspace_dir=workspace, limit=12))
            if isinstance(trace, dict)
        ]
        recent_events = [
            _event_preview(event)
            for event in _safe([], lambda: event_bus.recent(limit=20))
            if isinstance(event, dict)
        ]
        pending_guidance = [
            _guidance_preview(item)
            for item in _safe([], lambda: guidance_bus.pending())
            if isinstance(item, dict)
        ][-20:]

    world = {
        "schema": WORLD_STATE_SCHEMA,
        "generated_at": _format_time(),
        "workspace": {
            "path": workspace,
            **_engine_state(settings),
        },
        "model": _model_state(settings, effective_model),
        "conversation": {
            "state": conversation,
            "contextCompression": {
                **compression,
                "automaticCompressionAvailable": bool(compression.get("enabled", False)),
                "shouldPreSummarizeNow": bool(compression.get("enabled", False) and conversation.get("should_pre_summarize")),
                "shouldCompactNow": bool(compression.get("enabled", False) and conversation.get("should_compact")),
                "shouldBlockGrowthNow": bool(compression.get("enabled", False) and conversation.get("should_block_growth")),
            },
            "rawMessagesReturned": False,
        },
        "kernel": {
            "mode": runtime_mode,
            "modeProfile": kernel_mode_profile(runtime_mode),
            "diagnostics": sanitize_payload(kernel_diagnostics or {}),
            "runtime": sanitize_payload((kernel_diagnostics or {}).get("runtime", {})),
            "policy": _safe({}, lambda: get_policy_gate().status(settings)),
            "approvals": _safe({}, lambda: approval_center.status(workspace)),
            "traces": {
                "status": _safe({}, lambda: executor.status(workspace)),
                "recent": recent_traces,
                "rawParamsPersisted": False,
            },
            "events": {
                "status": _safe({}, lambda: event_bus.status()),
                "recent": recent_events,
            },
            "guidance": {
                "status": _safe({}, lambda: guidance_bus.status()),
                "pending": pending_guidance,
                "nonInterrupting": True,
            },
            "skills": {
                "schema": "openxnet.kernel.skill_engineering.v2",
                "summary": _safe({}, lambda: skill_lifecycle.summary()),
                "candidateEndpoint": "/v1/kernel/skills/candidates",
                "lifecycleEndpoint": "/v1/kernel/skills/lifecycle",
                "changeProposalsEndpoint": "/v1/kernel/skills/change-proposals",
                "selectionEndpoint": "/v1/kernel/skills/select",
                "rawSkillFilesReturned": False,
            },
            "pendingConfigIntents": _safe([], lambda: pending_config_intents(workspace)),
        },
        "modelAwareness": {
            "scope": "sanitized_snapshot",
            "canSeeEntireProcessInternals": False,
            "canSeeExposedKernelState": True,
            "canSeeToolCallsThroughTraces": True,
            "canSeeRawSecrets": False,
            "canModifyConfigDirectly": False,
            "configMutationPath": "/v1/kernel/config/intent -> /v1/kernel/config/apply",
        },
        "observability": {
            **(manifest.get("observability", {}) if isinstance(manifest, dict) else {}),
            "worldStateEndpoint": "/v1/kernel/world",
            "plannerEndpoint": "/v1/kernel/plan",
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
            "skillLifecycleEndpoint": "/v1/kernel/skills/lifecycle",
            "skillCandidatesEndpoint": "/v1/kernel/skills/candidates",
        },
        "systemManifest": {
            "schema": manifest.get("schema", "") if isinstance(manifest, dict) else "",
            "enabled": True,
            "observability": manifest.get("observability", {}) if isinstance(manifest, dict) else {},
        },
    }
    return sanitize_payload(world)
