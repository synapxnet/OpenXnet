#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""Sanitized OpenXnet system manifest exposed to models and UI."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from py.kernel.audit import sanitize_payload
from py.kernel.runtime import kernel_mode_profile, mode_from_settings


RESTRICTED_CONFIG_ZONES = [
    "api_key",
    "token",
    "cookie",
    "password",
    "payment",
    "login",
    "enterprise_admin",
]


def _tool_names(tools: Optional[List[Dict[str, Any]]]) -> List[str]:
    names: List[str] = []
    for tool in tools or []:
        fn = tool.get("function") if isinstance(tool, dict) else None
        if isinstance(fn, dict) and fn.get("name"):
            names.append(str(fn["name"]))
    return sorted(set(names))


def _permission_mode(settings: Dict[str, Any]) -> Dict[str, Any]:
    cli = settings.get("CLISettings", {}) if isinstance(settings, dict) else {}
    engine = str(cli.get("engine") or "local")
    node_name = f"{engine}Settings" if engine != "local" else "localEnvSettings"
    node = settings.get(node_name, {}) if isinstance(settings, dict) else {}
    return {
        "engine": engine,
        "settingsNode": node_name,
        "permissionMode": node.get("permissionMode", "default"),
        "workspace": cli.get("cc_path", ""),
        "enabled": bool(cli.get("enabled", False)),
        "visibilityScope": cli.get("visibilityScope", "workspace"),
    }


def build_system_manifest(
    settings: Dict[str, Any],
    *,
    kernel_diagnostics: Optional[Dict[str, Any]] = None,
    tools: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Build a model-safe view of OpenXnet runtime state."""
    settings = settings or {}
    memory_settings = settings.get("memorySettings", {}) if isinstance(settings, dict) else {}
    mcp_servers = settings.get("mcpServers", {}) if isinstance(settings, dict) else {}
    tool_config = settings.get("tools", {}) if isinstance(settings, dict) else {}
    runtime_mode = mode_from_settings(settings)

    manifest = {
        "schema": "openxnet.system_manifest.v1",
        "model": {
            "main": settings.get("model", ""),
            "selectedProvider": settings.get("selectedProvider"),
            "reasoner": sanitize_payload(settings.get("reasoner", {})),
            "fast": sanitize_payload(settings.get("fast", {})),
        },
        "workspace": _permission_mode(settings),
        "memory": {
            "enabled": bool(memory_settings.get("is_memory", False)),
            "provider": memory_settings.get("workspaceProvider", "session_store"),
            "selectedMemory": memory_settings.get("selectedMemory"),
            "limit": memory_settings.get("memoryLimit"),
        },
        "tools": {
            "availableToolNames": _tool_names(tools),
            "enabledBuiltins": sorted(
                key for key, value in tool_config.items()
                if isinstance(value, dict) and value.get("enabled")
            ),
        },
        "mcp": {
            "serverCount": len(mcp_servers) if isinstance(mcp_servers, dict) else 0,
            "servers": sanitize_payload({
                name: {
                    "disabled": cfg.get("disabled", False),
                    "processingStatus": cfg.get("processingStatus", ""),
                }
                for name, cfg in (mcp_servers or {}).items()
                if isinstance(cfg, dict)
            }),
        },
        "kernel": sanitize_payload(kernel_diagnostics or {}),
        "kernelMode": {
            "mode": runtime_mode,
            "profile": kernel_mode_profile(runtime_mode),
        },
        "observability": {
            "statusEndpoint": "/v1/kernel/status",
            "manifestEndpoint": "/v1/kernel/manifest",
            "runtimeEndpoint": "/v1/kernel/runtime",
            "runtimeModeEndpoint": "/v1/kernel/runtime/mode",
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
            "auditEndpoint": "/v1/kernel/audit",
            "eventsEndpoint": "/v1/kernel/events",
            "traceEndpoint": "/v1/kernel/traces",
            "traceStatusEndpoint": "/v1/kernel/traces/status",
            "traceRecoveryEndpoint": "/v1/kernel/traces/{trace_id}/recovery",
            "traceRetryEndpoint": "/v1/kernel/traces/{trace_id}/retry",
            "policyStatusEndpoint": "/v1/kernel/policy/status",
            "approvalStatusEndpoint": "/v1/kernel/approvals/status",
            "pendingApprovalsEndpoint": "/v1/kernel/approvals/pending",
            "approvalHistoryEndpoint": "/v1/kernel/approvals/history",
            "guidanceEndpoint": "/v1/kernel/guidance",
            "skillLifecycleEndpoint": "/v1/kernel/skills/lifecycle",
            "skillCandidatesEndpoint": "/v1/kernel/skills/candidates",
            "skillLifecycleSleepCycleEndpoint": "/v1/kernel/skills/lifecycle/sleep-cycle",
            "skillChangeProposalsEndpoint": "/v1/kernel/skills/change-proposals",
            "skillSelectionEndpoint": "/v1/kernel/skills/select",
        },
        "skillCrystallization": {
            "schema": "openxnet.kernel.skill_engineering.v2",
            "states": ["candidate", "verified", "active", "deprecated", "retired"],
            "workCrystallization": "POST /v1/kernel/skills/lifecycle/task-completed",
            "offlineConsolidation": "POST /v1/kernel/skills/lifecycle/sleep-cycle",
            "changeProposals": "GET /v1/kernel/skills/change-proposals",
            "proposalResolution": "POST /v1/kernel/skills/change-proposals/{proposal_id}/resolve",
            "runtimeSelection": "POST /v1/kernel/skills/select",
            "libraryEndpoint": "/v1/kernel/skills/lifecycle",
            "candidateEndpoint": "/v1/kernel/skills/candidates",
            "sleepCreatesPackages": False,
            "simulationEvidencePromotesProduction": False,
            "rawSkillFilesExposedToModel": False,
        },
        "configGovernance": {
            "canReadSanitizedSettings": True,
            "canWriteDirectly": False,
            "requiresConfigIntent": True,
            "policyGate": sanitize_payload(
                (settings.get("kernelSettings", {}) or {}).get("policyGate", {})
                if isinstance(settings.get("kernelSettings", {}), dict)
                else {}
            ),
            "runtime": sanitize_payload(
                (settings.get("kernelSettings", {}) or {}).get("runtime", {})
                if isinstance(settings.get("kernelSettings", {}), dict)
                else {}
            ),
            "restrictedZones": RESTRICTED_CONFIG_ZONES,
        },
    }
    return sanitize_payload(manifest)
