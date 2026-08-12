#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Unified OpenXnet kernel regression suite.

Local suite:
    python scripts/kernel_regression_suite.py

Local suite plus the running desktop backend:
    python scripts/kernel_regression_suite.py --live-url http://127.0.0.1:3456
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

REPO_ROOT = Path(__file__).resolve().parents[1]

NODE_CHECK_FILES = [
    "static/js/vue_data.js",
    "static/js/vue_methods.js",
]

PY_COMPILE_FILES = [
    "py/context/compactor.py",
    "py/context/token_counter.py",
    "py/kernel/approval.py",
    "py/kernel/audit.py",
    "py/kernel/config_intent.py",
    "py/kernel/conversation_state.py",
    "py/kernel/executor.py",
    "py/kernel/guidance.py",
    "py/kernel/planner.py",
    "py/kernel/policy.py",
    "py/kernel/skill_lifecycle.py",
    "py/kernel/system_manifest.py",
    "py/kernel/world_state.py",
    "py/cortex/learning.py",
    "py/cortex/evolution.py",
    "py/engine/query_engine.py",
    "py/memory/context_compressor.py",
    "py/routes/kernel.py",
    "py/skill_library.py",
    "py/skills.py",
    "scripts/context_compaction_long_session_smoke.py",
    "scripts/live_guidance_product_smoke.py",
    "scripts/model_awareness_boundary_smoke.py",
    "scripts/skill_lifecycle_smoke.py",
    "scripts/kernel_regression_suite.py",
]

SMOKE_SCRIPTS = [
    "scripts/context_compaction_long_session_smoke.py",
    "scripts/model_awareness_boundary_smoke.py",
    "scripts/live_guidance_product_smoke.py",
    "scripts/skill_lifecycle_smoke.py",
]

SOURCE_CONTRACTS = [
    {
        "area": "skill lifecycle ui",
        "path": "static/index.html",
        "needles": [
            "skill-lifecycle-panel",
            "skill-lifecycle-lane",
            "runSkillLifecycleSleepCycle",
            "openxnet-ui-redesign.css?v=",
            "vue_data.js?v=",
            "vue_methods.js?v=",
        ],
    },
    {
        "area": "skill lifecycle styles",
        "path": "static/css/openxnet-ui-redesign.css",
        "needles": [
            ".skill-lifecycle-panel",
            ".skill-lifecycle-lane",
            ".skill-lifecycle-item",
            "@media (max-width: 560px)",
        ],
    },
    {
        "area": "skill lifecycle state",
        "path": "static/js/vue_data.js",
        "needles": [
            "skillLifecycleLoading",
            "skillLifecycleSummary",
            "skillLifecycleItems",
        ],
    },
    {
        "area": "skill lifecycle methods",
        "path": "static/js/vue_methods.js",
        "needles": [
            "fetchSkillLifecycle",
            "runSkillLifecycleSleepCycle",
            "transitionSkillLifecycle",
        ],
    },
    {
        "area": "kernel routes",
        "path": "py/routes/kernel.py",
        "needles": [
            "/skills/lifecycle",
            "/skills/candidates",
            "SkillLifecycleTaskRequest",
        ],
    },
    {
        "area": "system manifest",
        "path": "py/kernel/system_manifest.py",
        "needles": [
            "configGovernance",
            "skillCrystallization",
            "rawSkillFilesExposedToModel",
        ],
    },
    {
        "area": "world state",
        "path": "py/kernel/world_state.py",
        "needles": [
            "contextCompression",
            "modelAwareness",
            "skillLifecycleEndpoint",
        ],
    },
]


@dataclass
class StepResult:
    name: str
    ok: bool
    duration_ms: int
    detail: Dict[str, Any]


def now_iso() -> str:
    return datetime.now().isoformat(timespec="seconds")


def existing(paths: Iterable[str]) -> List[str]:
    return [path for path in paths if (REPO_ROOT / path).exists()]


def tail(value: str, limit: int = 5000) -> str:
    text = value or ""
    return text if len(text) <= limit else text[-limit:]


def run_command(name: str, command: List[str], timeout: int = 180) -> StepResult:
    started = time.perf_counter()
    try:
        completed = subprocess.run(
            command,
            cwd=str(REPO_ROOT),
            text=True,
            encoding="utf-8",
            errors="replace",
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=timeout,
        )
        ok = completed.returncode == 0
        detail = {
            "command": command,
            "returncode": completed.returncode,
            "stdout": tail(completed.stdout),
            "stderr": tail(completed.stderr),
        }
    except Exception as exc:
        ok = False
        detail = {"command": command, "error": f"{type(exc).__name__}: {exc}"}
    return StepResult(
        name=name,
        ok=ok,
        duration_ms=round((time.perf_counter() - started) * 1000),
        detail=detail,
    )


def run_static_checks() -> List[StepResult]:
    results: List[StepResult] = []
    py_files = existing(PY_COMPILE_FILES)
    results.append(
        run_command(
            "python compile kernel surfaces",
            [sys.executable, "-m", "py_compile", *py_files],
            timeout=180,
        )
    )
    for path in existing(NODE_CHECK_FILES):
        results.append(
            run_command(
                f"node syntax {path}",
                ["node", "--check", path],
                timeout=120,
            )
        )
    return results


def run_source_contracts() -> StepResult:
    started = time.perf_counter()
    failures: List[Dict[str, Any]] = []
    checked: List[Dict[str, Any]] = []
    for contract in SOURCE_CONTRACTS:
        path = REPO_ROOT / str(contract["path"])
        needles = list(contract["needles"])
        if not path.exists():
            failures.append({"area": contract["area"], "path": str(contract["path"]), "missing": "file"})
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        missing = [needle for needle in needles if needle not in text]
        checked.append({"area": contract["area"], "path": str(contract["path"]), "needles": len(needles)})
        if missing:
            failures.append({"area": contract["area"], "path": str(contract["path"]), "missing": missing})
    return StepResult(
        name="source contract checks",
        ok=not failures,
        duration_ms=round((time.perf_counter() - started) * 1000),
        detail={"checked": checked, "failures": failures},
    )


def run_smoke_scripts(live_url: str = "") -> List[StepResult]:
    results: List[StepResult] = []
    for script in existing(SMOKE_SCRIPTS):
        command = [sys.executable, script]
        if live_url:
            command.extend(["--live-url", live_url])
        results.append(run_command(f"smoke {Path(script).name}", command, timeout=240))
    return results


def request_json(url: str, payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    if payload is None:
        request = urllib.request.Request(url, method="GET")
    else:
        request = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


def request_text(url: str) -> str:
    request = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(request, timeout=20) as response:
        return response.read().decode("utf-8", errors="replace")


def run_live_contracts(live_url: str) -> StepResult:
    started = time.perf_counter()
    base = live_url.rstrip("/")
    failures: List[str] = []
    detail: Dict[str, Any] = {"url": base}
    try:
        html = request_text(f"{base}/")
        html_needles = [
            "openxnet-ui-redesign.css?v=",
            "vue_data.js?v=",
            "vue_methods.js?v=",
        ]
        missing_html = [needle for needle in html_needles if needle not in html]
        if missing_html:
            failures.append(f"index html missing {missing_html}")
        detail["html_contract"] = {"missing": missing_html}

        status = request_json(f"{base}/v1/kernel/status")
        for key in ["world", "skillLifecycle", "guidance", "approvals"]:
            if key not in status:
                failures.append(f"kernel status missing {key}")
        detail["status_contract"] = {
            "has_world": "world" in status,
            "has_skill_lifecycle": "skillLifecycle" in status,
            "mode": status.get("mode"),
        }

        manifest = request_json(f"{base}/v1/kernel/manifest")
        if manifest.get("schema") != "openxnet.system_manifest.v1":
            failures.append("manifest schema mismatch")
        if "skillCrystallization" not in manifest:
            failures.append("manifest missing skillCrystallization")
        detail["manifest_contract"] = {
            "schema": manifest.get("schema"),
            "has_skill_crystallization": "skillCrystallization" in manifest,
            "config_can_write_directly": manifest.get("configGovernance", {}).get("canWriteDirectly"),
        }

        lifecycle = request_json(f"{base}/v1/kernel/skills/lifecycle?limit=5")
        states = lifecycle.get("summary", {}).get("states") or []
        expected_states = {"candidate", "verified", "active", "deprecated", "retired"}
        if not expected_states.issubset(set(states)):
            failures.append(f"skill lifecycle states mismatch: {states}")
        detail["skill_lifecycle_contract"] = {
            "states": states,
            "skill_count": len(lifecycle.get("skills") or []),
        }

        world = request_json(
            f"{base}/v1/kernel/world",
            {"messages": [{"role": "user", "content": "kernel regression contract probe"}], "model": "gpt-4", "include_recent": False},
        )
        if world.get("ok") is not True:
            failures.append("world endpoint did not return ok")
        conversation = world.get("world", {}).get("conversation", {})
        if conversation.get("rawMessagesReturned") is not False:
            failures.append("world endpoint returned raw messages")
        awareness = world.get("world", {}).get("modelAwareness", {})
        if awareness.get("canSeeRawSecrets") is not False:
            failures.append("world model awareness raw secret boundary mismatch")
        detail["world_contract"] = {
            "raw_messages_returned": conversation.get("rawMessagesReturned"),
            "can_see_raw_secrets": awareness.get("canSeeRawSecrets"),
        }
    except (urllib.error.URLError, TimeoutError, AssertionError, KeyError, ValueError) as exc:
        failures.append(f"{type(exc).__name__}: {exc}")
    return StepResult(
        name="live endpoint contracts",
        ok=not failures,
        duration_ms=round((time.perf_counter() - started) * 1000),
        detail={**detail, "failures": failures},
    )


def summarize(results: List[StepResult]) -> Dict[str, Any]:
    failed = [item for item in results if not item.ok]
    return {
        "ok": not failed,
        "total": len(results),
        "passed": len(results) - len(failed),
        "failed": len(failed),
        "failed_steps": [item.name for item in failed],
        "duration_ms": sum(item.duration_ms for item in results),
    }


def write_report(report: Dict[str, Any], report_path: Path) -> None:
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--live-url", default="", help="Optional running OpenXnet backend URL.")
    parser.add_argument("--skip-static", action="store_true", help="Skip py_compile and node syntax checks.")
    parser.add_argument("--skip-smoke", action="store_true", help="Skip module smoke scripts.")
    parser.add_argument("--skip-live-contracts", action="store_true", help="Skip live endpoint contract checks.")
    parser.add_argument("--fail-fast", action="store_true", help="Stop after the first failing phase.")
    parser.add_argument(
        "--report",
        default=str(REPO_ROOT / ".agent" / "regression" / "kernel_regression_last.json"),
        help="Report JSON path. Use an empty string to disable report writing.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    results: List[StepResult] = []

    phases: List[List[StepResult]] = [[run_source_contracts()]]
    if not args.skip_static:
        phases.append(run_static_checks())
    if not args.skip_smoke:
        phases.append(run_smoke_scripts(args.live_url))
    if args.live_url and not args.skip_live_contracts:
        phases.append([run_live_contracts(args.live_url)])

    for phase in phases:
        results.extend(phase)
        if args.fail_fast and any(not item.ok for item in phase):
            break

    report = {
        "schema": "openxnet.kernel_regression.v1",
        "started_at": now_iso(),
        "repo": str(REPO_ROOT),
        "live_url": args.live_url,
        "surfaces": [
            "automatic context compression",
            "model-visible capability boundaries",
            "non-interrupting live guidance",
            "skill crystallization lifecycle",
            "kernel manifest/world/status routes",
            "skill crystal lifecycle UI contracts",
        ],
        "summary": summarize(results),
        "results": [asdict(item) for item in results],
    }
    if args.report:
        write_report(report, Path(args.report))
        report["report_path"] = str(Path(args.report))

    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["summary"]["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
