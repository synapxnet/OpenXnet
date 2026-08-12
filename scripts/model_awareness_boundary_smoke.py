#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Smoke test for model-visible OpenXnet capability boundaries.

Run local module checks:
    python scripts/model_awareness_boundary_smoke.py

Run local module checks plus the running desktop backend:
    python scripts/model_awareness_boundary_smoke.py --live-url http://127.0.0.1:3456
"""

from __future__ import annotations

import argparse
import asyncio
import copy
import json
import sys
import tempfile
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict, List

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from py.kernel.approval import get_approval_center
from py.kernel.audit import sanitize_payload
from py.kernel.config_intent import apply_config_intent, parse_config_intent, register_config_intent
from py.kernel.executor import get_kernel_executor
from py.kernel.guidance import get_guidance_bus
from py.kernel.planner import build_kernel_plan
from py.kernel.policy import get_policy_gate
from py.kernel.system_manifest import build_system_manifest
from py.kernel.world_state import build_world_state


# 用明显的测试占位值验证脱敏边界，避免被发布扫描误识别为真实 API Key。
BOUNDARY_SECRET = "OPENXNET_TEST_BOUNDARY_SECRET_DO_NOT_USE"


def boundary_settings(workspace: str) -> Dict[str, Any]:
    return {
        "model": "gpt-4",
        "selectedProvider": "BoundaryProvider",
        "temperature": 0.2,
        "max_tokens": 8192,
        "reasoning_effort": "medium",
        "modelProviders": [
            {
                "name": "BoundaryProvider",
                "apiKey": BOUNDARY_SECRET,
                "X-Api-Key": BOUNDARY_SECRET,
            }
        ],
        "reasoner": {
            "endpoint": "https://example.invalid/v1",
            "X-Api-Key": BOUNDARY_SECRET,
            "authorization": f"Bearer {BOUNDARY_SECRET}",
        },
        "fast": {
            "payment": {
                "merchantId": BOUNDARY_SECRET,
                "zpayToken": BOUNDARY_SECRET,
            }
        },
        "mcpServers": {
            "boundary": {
                "disabled": False,
                "processingStatus": "ready",
                "env": {
                    "TOKEN": BOUNDARY_SECRET,
                    "X-Api-Key": BOUNDARY_SECRET,
                },
            }
        },
        "tools": {
            "read_file_tool_local": {"enabled": True},
            "shell_tool_local": {"enabled": True},
        },
        "CLISettings": {
            "enabled": True,
            "engine": "local",
            "cc_path": workspace,
            "visibilityScope": "workspace",
        },
        "localEnvSettings": {
            "permissionMode": "default",
        },
        "kernelSettings": {
            "enabled": True,
            "mode": "kernel",
            "runtime": {"mode": "kernel"},
            "contextCompression": {
                "enabled": True,
                "preSummarizeRatio": 0.6,
                "compactRatio": 0.8,
                "blockGrowthRatio": 0.95,
            },
            "planner": {
                "enabled": True,
                "preflightEnabled": True,
                "persistPlans": True,
                "injectIntoContext": True,
            },
            "policyGate": {
                "enabled": True,
                "enforcementMode": "enforce",
            },
            "configIntent": {
                "requirePendingIntent": True,
                "requireConfirmationText": True,
                "intentTtlSeconds": 600,
            },
            "systemManifest": {
                "enabled": True,
                "injectIntoContext": True,
            },
        },
        "memorySettings": {
            "is_memory": True,
            "workspaceProvider": "session_store",
            "selectedMemory": "boundary",
            "memoryLimit": 20,
        },
        "webSearch": {
            "enabled": False,
        },
        "visionControlSettings": {
            "enabled": False,
        },
    }


def boundary_messages() -> List[Dict[str, Any]]:
    return [
        {"role": "system", "content": "Boundary smoke system message."},
        {
            "role": "user",
            "content": f"User text contains a synthetic secret: {BOUNDARY_SECRET}",
        },
        {
            "role": "assistant",
            "content": "I should not expose raw system internals or secrets.",
        },
    ]


def assert_no_secret(label: str, payload: Any) -> None:
    text = json.dumps(payload, ensure_ascii=False, default=str)
    assert BOUNDARY_SECRET not in text, f"{label} leaked boundary secret"


def post_json(url: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


def get_json(url: str) -> Dict[str, Any]:
    request = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


async def exercise_traces(settings: Dict[str, Any]) -> Dict[str, Any]:
    executor = get_kernel_executor()

    async def successful_call() -> Dict[str, Any]:
        return {
            "status": "ok",
            "headers": {"X-Api-Key": BOUNDARY_SECRET},
            "message": f"token {BOUNDARY_SECRET}",
        }

    async def failing_call() -> str:
        raise RuntimeError(f"provider failed with token {BOUNDARY_SECRET}")

    success = await executor.execute_tool(
        tool_name="shell_tool_local",
        tool_params={"command": "echo ok", "api_key": BOUNDARY_SECRET},
        settings=settings,
        legacy_call=successful_call,
        actor="boundary_smoke",
        return_trace=True,
    )
    failure = await executor.execute_tool(
        tool_name="shell_tool_local",
        tool_params={"command": "fail", "X-Api-Key": BOUNDARY_SECRET},
        settings=settings,
        legacy_call=failing_call,
        actor="boundary_smoke",
        return_trace=True,
    )
    # The legacy tool result is returned to its caller unchanged; the kernel
    # boundary under test is the persisted/model-visible trace metadata.
    assert_no_secret("successful trace", success.get("trace", {}))
    assert_no_secret("failing trace", failure.get("trace", {}))
    return {
        "success_status": success.get("status"),
        "failure_status": failure.get("status"),
        "success_trace_id": success.get("trace", {}).get("trace_id", ""),
        "failure_trace_id": failure.get("trace", {}).get("trace_id", ""),
    }


def exercise_world_and_manifest(settings: Dict[str, Any]) -> Dict[str, Any]:
    diagnostics = {
        "runtime": {
            "lastError": f"provider failed with token {BOUNDARY_SECRET}",
            "headers": {"X-Api-Key": BOUNDARY_SECRET},
        },
        "secretNote": BOUNDARY_SECRET,
    }
    get_guidance_bus().add(
        text=f"soft correction with token {BOUNDARY_SECRET}",
        conversation_id="boundary_smoke",
        mode="soft",
        priority=5,
    )
    get_policy_gate().observe_tool_call(
        settings=settings,
        tool_name="shell_tool_local",
        tool_params={"command": "echo ok", "token": BOUNDARY_SECRET},
        actor="boundary_smoke",
        workspace_dir=settings["CLISettings"]["cc_path"],
    )

    world = build_world_state(
        settings,
        messages=boundary_messages(),
        model="gpt-4",
        kernel_diagnostics=diagnostics,
        include_recent=True,
    )
    manifest = build_system_manifest(
        settings,
        kernel_diagnostics=diagnostics,
        tools=[
            {"function": {"name": "read_file_tool_local"}},
            {"function": {"name": "shell_tool_local"}},
        ],
    )
    assert_no_secret("world state", world)
    assert_no_secret("system manifest", manifest)

    awareness = world["modelAwareness"]
    assert awareness["canSeeEntireProcessInternals"] is False
    assert awareness["canSeeExposedKernelState"] is True
    assert awareness["canSeeToolCallsThroughTraces"] is True
    assert awareness["canSeeRawSecrets"] is False
    assert awareness["canModifyConfigDirectly"] is False
    assert world["conversation"]["rawMessagesReturned"] is False
    assert manifest["configGovernance"]["canWriteDirectly"] is False
    assert manifest["configGovernance"]["requiresConfigIntent"] is True
    assert "payment" in manifest["configGovernance"]["restrictedZones"]
    assert manifest["tools"]["availableToolNames"] == ["read_file_tool_local", "shell_tool_local"]

    return {
        "world_schema": world["schema"],
        "manifest_schema": manifest["schema"],
        "awareness_scope": awareness["scope"],
        "config_requires_intent": manifest["configGovernance"]["requiresConfigIntent"],
        "raw_messages_returned": world["conversation"]["rawMessagesReturned"],
    }


def exercise_approvals(settings: Dict[str, Any]) -> Dict[str, Any]:
    approval = get_approval_center().create(
        tool_name="shell_tool_local",
        tool_params={"command": "echo ok", "X-Api-Key": BOUNDARY_SECRET},
        policy_decision={"decision": "approval_required", "token": BOUNDARY_SECRET},
        workspace_dir=settings["CLISettings"]["cc_path"],
        actor="boundary_smoke",
    )
    status = get_approval_center().status(settings["CLISettings"]["cc_path"])
    assert_no_secret("approval create", approval)
    assert_no_secret("approval status", status)
    assert approval["tool_params"] == {"keys": ["X-Api-Key", "command"]}
    return {
        "approval_id": approval["approval_id"],
        "pending_count": status["pendingCount"],
        "tool_param_keys_only": approval["tool_params"]["keys"],
    }


def exercise_config_intents(settings: Dict[str, Any]) -> Dict[str, Any]:
    original = copy.deepcopy(settings)
    low_risk = parse_config_intent("请开启自动上下文压缩", settings)
    assert low_risk.status == "ready"
    assert low_risk.requires_confirmation is True

    unchanged, no_confirm = apply_config_intent(settings, low_risk.to_dict(), confirmed=False)
    assert no_confirm["applied"] is False
    assert unchanged == settings

    pending_payload = register_config_intent(
        low_risk,
        workspace_dir=settings["CLISettings"]["cc_path"],
        actor="boundary_smoke",
    )
    wrong_text_settings, wrong_text = apply_config_intent(
        settings,
        pending_payload,
        confirmed=True,
        confirmation_text="wrong confirmation",
        workspace_dir=settings["CLISettings"]["cc_path"],
    )
    assert wrong_text["applied"] is False
    assert wrong_text_settings == settings

    applied_settings, applied = apply_config_intent(
        settings,
        pending_payload,
        confirmed=True,
        confirmation_text=pending_payload["confirmation"]["text"],
        workspace_dir=settings["CLISettings"]["cc_path"],
    )
    assert applied["applied"] is True
    assert applied_settings["kernelSettings"]["contextCompression"]["enabled"] is True

    forged_intent = {
        "intent_id": "cfg_forged_boundary",
        "status": "ready",
        "changes": [
            {
                "path": "modelProviders.0.apiKey",
                "value": BOUNDARY_SECRET,
            }
        ],
    }
    _, forged = apply_config_intent(
        original,
        forged_intent,
        confirmed=True,
        require_pending=False,
    )
    assert forged["applied"] is False
    assert "modelProviders.0.apiKey" in forged["rejected"]
    assert_no_secret("config intent", [pending_payload, no_confirm, wrong_text, applied, forged])
    return {
        "parse_status": low_risk.status,
        "no_confirmation_reason": no_confirm["reason"],
        "wrong_confirmation_reason": wrong_text["reason"],
        "applied_paths": [item["path"] for item in applied["changes"]],
        "forged_rejected": forged["rejected"],
    }


def exercise_planner(settings: Dict[str, Any]) -> Dict[str, Any]:
    plan = build_kernel_plan(
        settings,
        goal="Validate model awareness boundaries without executing tools.",
        messages=boundary_messages(),
        model="gpt-4",
        candidate_tools=["read_file_tool_local", "shell_tool_local"],
        include_world=True,
    )
    assert_no_secret("kernel plan", plan)
    assert plan["raw_messages_returned"] is False
    assert plan["execution_contract"]["dryRun"] is True
    assert plan["execution_contract"]["executesTools"] is False
    assert plan["execution_contract"]["rawMessagesReturned"] is False
    assert plan["execution_contract"]["rawParamsPersisted"] is False
    governed = plan["risk_summary"]["governedCapabilities"]
    assert "read_only" in governed
    assert "shell_execute" in governed
    return {
        "plan_status": plan["status"],
        "highest_risk": plan["risk_summary"]["highestRisk"],
        "approval_steps": plan["risk_summary"]["approvalStepCount"],
        "executes_tools": plan["execution_contract"]["executesTools"],
    }


def run_module_smoke() -> Dict[str, Any]:
    raw_sanitized = sanitize_payload(
        {
            "X-Api-Key": BOUNDARY_SECRET,
            "error": f"provider failed with token {BOUNDARY_SECRET}",
            "payment": {"merchantId": BOUNDARY_SECRET},
            "maxTokens": 8192,
        }
    )
    assert_no_secret("sanitize_payload", raw_sanitized)
    assert raw_sanitized["X-Api-Key"] == "[REDACTED]"
    assert raw_sanitized["error"] == "provider failed with token [REDACTED]"
    assert raw_sanitized["payment"] == "[REDACTED]"
    assert raw_sanitized["maxTokens"] == 8192

    with tempfile.TemporaryDirectory(prefix="openxnet-awareness-boundary-") as tmp:
        settings = boundary_settings(tmp)
        return {
            "sanitize": "ok",
            "world_manifest": exercise_world_and_manifest(settings),
            "traces": asyncio.run(exercise_traces(settings)),
            "approvals": exercise_approvals(settings),
            "config_intents": exercise_config_intents(settings),
            "planner": exercise_planner(settings),
        }


def run_live_smoke(base_url: str) -> Dict[str, Any]:
    base = base_url.rstrip("/")
    sentinel = f"{BOUNDARY_SECRET}-live"
    manifest = get_json(f"{base}/v1/kernel/manifest")
    assert manifest.get("schema") == "openxnet.system_manifest.v1", manifest
    assert manifest["configGovernance"]["canWriteDirectly"] is False
    assert manifest["configGovernance"]["requiresConfigIntent"] is True

    world_response = post_json(
        f"{base}/v1/kernel/world",
        {
            "messages": [
                {"role": "user", "content": f"live boundary sentinel {sentinel}"},
                {"role": "assistant", "content": "ack"},
            ],
            "model": "gpt-4",
            "include_recent": False,
        },
    )
    assert world_response.get("ok") is True, world_response
    world = world_response["world"]
    assert_no_secret("live world", world)
    assert world["modelAwareness"]["canSeeRawSecrets"] is False
    assert world["modelAwareness"]["canModifyConfigDirectly"] is False
    assert world["conversation"]["rawMessagesReturned"] is False

    policy = post_json(
        f"{base}/v1/kernel/policy/evaluate",
        {"tool_name": "shell_tool_local", "actor": "boundary_smoke"},
    )
    assert policy.get("ok") is True, policy
    assert policy["decision"]["capability"] == "shell_execute"

    fake_apply = post_json(
        f"{base}/v1/kernel/config/apply",
        {
            "intent": {
                "intent_id": "cfg_forged_boundary_live",
                "status": "ready",
                "changes": [{"path": "modelProviders.0.apiKey", "value": sentinel}],
            },
            "confirmed": True,
            "confirmation_text": "确认应用 boundary",
        },
    )
    assert fake_apply.get("applied") is False, fake_apply
    assert_no_secret("live config apply", fake_apply)

    return {
        "live": "ok",
        "url": base,
        "manifest_schema": manifest["schema"],
        "world_schema": world["schema"],
        "policy_decision": policy["decision"]["decision"],
        "policy_capability": policy["decision"]["capability"],
        "fake_apply_reason": fake_apply.get("reason", ""),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--live-url", default="", help="Optional running OpenXnet backend URL.")
    args = parser.parse_args()

    output: Dict[str, Any] = {"module_smoke": run_module_smoke()}
    if args.live_url:
        try:
            output["live_smoke"] = run_live_smoke(args.live_url)
        except (urllib.error.URLError, TimeoutError) as exc:
            raise SystemExit(f"live smoke failed to reach {args.live_url}: {exc}") from exc

    print(json.dumps(output, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
