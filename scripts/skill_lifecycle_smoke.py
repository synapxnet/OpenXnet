#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Smoke test for the formal OpenXnet skill crystallization lifecycle.

Run local module checks:
    python scripts/skill_lifecycle_smoke.py

Run local checks plus low-side-effect endpoint checks against the desktop backend:
    python scripts/skill_lifecycle_smoke.py --live-url http://127.0.0.1:3456

Run a mutating live lifecycle check only when a disposable workspace is selected:
    python scripts/skill_lifecycle_smoke.py --live-url http://127.0.0.1:3456 --mutate-live
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Dict, List

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from py.kernel.skill_lifecycle import get_skill_lifecycle


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


def assert_status(lifecycle: Any, skill_id: str, status: str) -> Dict[str, Any]:
    """断言 Skill 的兼容生命周期状态并返回序列化数据。"""

    skill = lifecycle.library.get(skill_id)
    assert skill is not None, f"missing skill {skill_id}"
    payload = skill.to_dict()
    assert payload["status"] == status, payload
    assert payload["lifecycle_status"] == status, payload
    return payload


async def run_module_smoke() -> Dict[str, Any]:
    """在临时工作区验证 v2 生产认证提案、审批、降级和退役。"""

    with tempfile.TemporaryDirectory(prefix="openxnet-skill-lifecycle-") as tmp:
        lifecycle = get_skill_lifecycle(tmp)
        tools = ["task_planner", "workspace_editor", "browser_verify"]

        creation: Dict[str, Any] = {}
        for index in range(3):
            creation = await lifecycle.on_task_completed(
                {
                    "success": True,
                    "summary": "Skill lifecycle smoke workflow for repeatable UI verification.",
                    "strategy": "ui-regression-crystallization",
                    "trigger_context": "A UI task finished with a repeatable browser verification path.",
                    "workflow": [
                        "Inspect the changed UI surface.",
                        "Patch the narrowest affected files.",
                        "Reload the browser and verify the lifecycle panel.",
                    ],
                    "verification": ["Browser page renders the lifecycle panel without overflow."],
                    "rollback": "Deprecate the skill if browser verification stops passing.",
                    "counter_examples": ["Do not use when the task has no UI surface."],
                    "source_event_ids": [f"trace-{index}"],
                },
                tools,
                input_text="complete skill crystallization lifecycle formalization",
                source="work",
                evidence_origin="work",
                derivation_method="work_crystallization",
                environment_scope="production",
                environment_fingerprint="smoke-production-v1",
                problem_fingerprint="skill-lifecycle-smoke-ui-regression",
            )

        assert creation.get("ok") is True, creation
        assert creation.get("created") is True, creation
        skill_id = creation["skill_id"]
        candidate = assert_status(lifecycle, skill_id, "candidate")
        assert candidate["use_count"] == 3, candidate
        assert candidate["success_rate"] == 1.0, candidate
        assert candidate["tool_chain"] == tools, candidate

        first_sleep = await lifecycle.run_sleep_cycle()
        assert first_sleep.get("ok") is True, first_sleep
        assert first_sleep.get("applied") is False, first_sleep
        assert_status(lifecycle, skill_id, "candidate")
        first_proposal = first_sleep["proposals"][0]
        first_resolution = lifecycle.resolve_change_proposal(
            first_proposal["proposal_id"],
            approved=True,
            actor="module-smoke-verifier",
            reason="production smoke verification passed",
        )
        assert first_resolution.get("ok") is True, first_resolution
        verified = assert_status(lifecycle, skill_id, "verified")
        assert verified["verified"] is True, verified
        verified_package = Path(tmp, ".agent", "skills", skill_id, "SKILL.md")
        assert verified_package.exists(), verified_package

        strategy_id = verified["strategies"][0]["strategy_id"]
        lifecycle.record_skill_use(
            skill_id,
            True,
            reason="module_smoke_active_gate",
            environment_scope="production",
            environment_fingerprint="smoke-production-v1",
            evidence_origin="work",
            strategy_id=strategy_id,
            source_event_id="trace-active-gate",
        )
        second_sleep = await lifecycle.run_sleep_cycle()
        assert second_sleep.get("ok") is True, second_sleep
        second_proposal = second_sleep["proposals"][0]
        second_resolution = lifecycle.resolve_change_proposal(
            second_proposal["proposal_id"],
            approved=True,
            actor="module-smoke-verifier",
            reason="active production threshold verified",
        )
        assert second_resolution.get("ok") is True, second_resolution
        active = assert_status(lifecycle, skill_id, "active")
        assert active["use_count"] == 4, active

        active_markdown = verified_package.read_text(encoding="utf-8")
        assert "lifecycle_status" in active_markdown
        assert "## Verification" in active_markdown
        assert "## Rollback" in active_markdown
        assert "## Counter Examples" in active_markdown

        low_signal = lifecycle.library.add(
            name="low signal lifecycle skill",
            description="A skill that should be deprecated and then retired after repeated failures.",
            skill_id="low-signal-lifecycle-skill",
            tags=["active", "smoke"],
            status="active",
            source="work",
            evidence_origin="work",
            certifications=[{
                "scope": "production",
                "status": "active",
                "environment_fingerprint": "smoke-production-v1",
            }],
            trigger_context="Only used for lifecycle smoke.",
            workflow=["Attempt the risky workflow."],
            verification={"checks": ["Repeated failures should lower confidence."]},
        )
        for success in [True, False, False, False, False]:
            lifecycle.record_skill_use(
                low_signal.skill_id,
                success,
                reason="module_smoke_deprecate_gate",
                environment_scope="production",
                environment_fingerprint="smoke-production-v1",
                evidence_origin="work",
                strategy_id="risky-workflow",
                source_event_id=f"low-signal-{low_signal.use_count}",
            )

        third_sleep = await lifecycle.run_sleep_cycle()
        assert third_sleep.get("ok") is True, third_sleep
        third_proposal = third_sleep["proposals"][0]
        third_resolution = lifecycle.resolve_change_proposal(
            third_proposal["proposal_id"],
            approved=True,
            actor="module-smoke-verifier",
            reason="low production success rate confirmed",
        )
        assert third_resolution.get("ok") is True, third_resolution
        deprecated = assert_status(lifecycle, low_signal.skill_id, "deprecated")
        assert deprecated["use_count"] == 5, deprecated

        for _ in range(3):
            lifecycle.record_skill_use(
                low_signal.skill_id,
                False,
                reason="module_smoke_retire_gate",
                environment_scope="production",
                environment_fingerprint="smoke-production-v1",
                evidence_origin="work",
                strategy_id="risky-workflow",
                source_event_id=f"retire-signal-{low_signal.use_count}",
            )

        fourth_sleep = await lifecycle.run_sleep_cycle()
        assert fourth_sleep.get("ok") is True, fourth_sleep
        fourth_proposal = fourth_sleep["proposals"][0]
        fourth_resolution = lifecycle.resolve_change_proposal(
            fourth_proposal["proposal_id"],
            approved=True,
            actor="module-smoke-verifier",
            reason="retirement threshold confirmed",
        )
        assert fourth_resolution.get("ok") is True, fourth_resolution
        retired = assert_status(lifecycle, low_signal.skill_id, "retired")
        assert retired["use_count"] == 8, retired
        search_results = lifecycle.library.search("low signal lifecycle skill", top_k=5)
        assert all(item.skill_id != low_signal.skill_id for item in search_results), [item.to_dict() for item in search_results]

        summary = lifecycle.summary()
        assert summary["counts"]["active"] >= 1, summary
        assert summary["counts"]["retired"] >= 1, summary
        assert summary["patterns"]["total"] >= 1, summary
        assert summary["thresholds"]["candidateMinTraces"] == 3, summary

        return {
            "module": "ok",
            "workspace": tmp,
            "candidate_skill_id": skill_id,
            "active_status": active["status"],
            "retired_status": retired["status"],
            "counts": summary["counts"],
            "pattern_total": summary["patterns"]["total"],
        }


def run_live_smoke(base_url: str, *, mutate: bool = False) -> Dict[str, Any]:
    """验证运行中后端的只读接口，并可选生成但不审批测试提案。"""

    base = base_url.rstrip("/")
    lifecycle = get_json(f"{base}/v1/kernel/skills/lifecycle?limit=20")
    assert lifecycle.get("ok") is True, lifecycle
    assert "summary" in lifecycle, lifecycle
    assert "skills" in lifecycle, lifecycle
    states = lifecycle.get("summary", {}).get("states") or []
    assert {"candidate", "verified", "active", "deprecated", "retired"}.issubset(set(states)), states

    candidates = get_json(f"{base}/v1/kernel/skills/candidates?limit=20")
    assert candidates.get("ok") is True, candidates
    assert "candidates" in candidates, candidates

    non_mutating = post_json(
        f"{base}/v1/kernel/skills/lifecycle/task-completed",
        {
            "summary": "skill lifecycle endpoint smoke without persistent candidate creation",
            "success": True,
            "tools_used": ["single_tool_probe"],
            "strategy": "non_mutating_probe",
        },
    )
    assert non_mutating.get("ok") is True, non_mutating
    assert non_mutating.get("created") is False, non_mutating
    assert non_mutating.get("reason") == "requires_multi_tool_pattern", non_mutating

    result: Dict[str, Any] = {
        "live": "ok",
        "url": base,
        "states": states,
        "skill_count": len(lifecycle.get("skills") or []),
        "candidate_count": len(candidates.get("candidates") or []),
        "non_mutating_route_probe": non_mutating.get("reason"),
    }

    if mutate:
        strategy = f"skill-lifecycle-live-smoke-{int(time.time())}"
        created: Dict[str, Any] = {}
        for index in range(3):
            created = post_json(
                f"{base}/v1/kernel/skills/lifecycle/task-completed",
                {
                    "summary": "mutating live smoke candidate for lifecycle endpoint validation",
                    "success": True,
                    "tools_used": ["live_probe_plan", "live_probe_verify"],
                    "strategy": strategy,
                    "source_event_ids": [f"live-smoke-{index}"],
                    "evidence_origin": "rehearsal",
                    "derivation_method": "rehearsal_crystallization",
                    "environment_scope": "simulation",
                    "environment_fingerprint": "live-smoke-simulation-v1",
                    "problem_fingerprint": strategy,
                },
            )
        assert created.get("ok") is True, created
        assert created.get("created") is True, created
        sleep_cycle = post_json(f"{base}/v1/kernel/skills/lifecycle/sleep-cycle", {})
        assert sleep_cycle.get("ok") is True, sleep_cycle
        result["mutating_probe"] = {
            "skill_id": created.get("skill_id"),
            "transitions": len(sleep_cycle.get("transitions") or []),
            "proposals": len(sleep_cycle.get("proposals") or []),
            "applied": sleep_cycle.get("applied"),
        }

    return result


def main() -> int:
    """解析命令行并执行本地及可选在线 smoke。"""

    parser = argparse.ArgumentParser()
    parser.add_argument("--live-url", default="", help="Optional running OpenXnet backend URL.")
    parser.add_argument("--mutate-live", action="store_true", help="Create/promote a live test candidate in the configured workspace.")
    args = parser.parse_args()

    output: Dict[str, Any] = {"module_smoke": asyncio.run(run_module_smoke())}

    if args.live_url:
        try:
            output["live_smoke"] = run_live_smoke(args.live_url, mutate=args.mutate_live)
        except (urllib.error.URLError, TimeoutError) as exc:
            raise SystemExit(f"live smoke failed to reach {args.live_url}: {exc}") from exc

    print(json.dumps(output, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
