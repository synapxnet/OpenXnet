# -*- coding: utf-8 -*-
"""Smoke real FastAPI task and Chat route tables across runtime profiles."""

from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
import sys
import tempfile
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]


def _probe_source() -> str:
    """Return isolated Python source that reports the imported task routes."""

    return """
import json
import server
paths = sorted({getattr(route, 'path', '') for route in server.app.routes})
print(json.dumps({
    'profile': server.RUNTIME_PROFILE,
    'registered': server.SERVER_TASK_API_REGISTERED,
    'executionEngine': server.EXECUTION_ENGINE_PROFILE_ACTIVE,
    'hasBroker': '/v1/tasks/executor/preflight' in paths,
    'hasList': '/v1/tasks/list' in paths,
    'hasCreate': '/v1/tasks/create' in paths,
    'hasCapabilities': '/v1/tasks/capabilities' in paths,
    'hasWorkbench': '/v1/dev/workbench/tasks/create' in paths,
    'hasHealth': '/health' in paths,
    'hasChat': '/v1/chat/completions' in paths,
    'paths': paths if server.EXECUTION_ENGINE_PROFILE_ACTIVE else [],
}, separators=(',', ':')))
"""


async def _run_profile_probe(profile: str, user_data_directory: str) -> dict[str, Any]:
    """Import the real entrypoint in one isolated runtime-profile subprocess."""

    environment = {
        **os.environ,
        "OPENXNET_RUNTIME_ROLE": profile,
        "OPENXNET_USER_DATA_DIR": user_data_directory,
        "OPENXNET_TASK_RPC_TOKEN": "phase3n-profile-smoke-token",
        "PYTHONIOENCODING": "utf-8",
        "PYTHONUTF8": "1",
    }
    process = await asyncio.create_subprocess_exec(
        sys.executable,
        "-c",
        _probe_source(),
        cwd=str(PROJECT_ROOT),
        env=environment,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=300)
    except asyncio.TimeoutError:
        process.kill()
        await process.communicate()
        raise RuntimeError(f"{profile} task profile probe timed out.") from None
    if process.returncode != 0:
        diagnostic = stderr.decode("utf-8", errors="replace")[-2_000:]
        raise RuntimeError(f"{profile} task profile probe failed: {diagnostic}")
    for line in reversed(stdout.decode("utf-8", errors="strict").splitlines()):
        try:
            value = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(value, dict) and value.get("profile") == profile:
            return value
    raise RuntimeError(f"{profile} task profile probe returned no JSON summary.")


async def run_smoke() -> dict[str, Any]:
    """探测三个运行 profile；无输入，返回摘要，任一路由所有权或精确集合漂移时抛错。"""

    with (
        tempfile.TemporaryDirectory(prefix="openxnet-desktop-profile-") as desktop_dir,
        tempfile.TemporaryDirectory(prefix="openxnet-server-profile-") as server_dir,
        tempfile.TemporaryDirectory(prefix="openxnet-engine-profile-") as engine_dir,
    ):
        desktop = await _run_profile_probe("desktop", desktop_dir)
        server = await _run_profile_probe("server", server_dir)
        execution_engine = await _run_profile_probe("execution-engine", engine_dir)
    if desktop != {
        "profile": "desktop",
        "registered": False,
        "executionEngine": False,
        "hasBroker": True,
        "hasList": False,
        "hasCreate": False,
        "hasCapabilities": False,
        "hasWorkbench": False,
        "hasHealth": True,
        "hasChat": True,
        "paths": [],
    }:
        raise RuntimeError("Desktop task route table is not broker-only.")
    if not all((
        server.get("registered") is True,
        server.get("executionEngine") is False,
        server.get("hasBroker") is True,
        server.get("hasList") is True,
        server.get("hasCreate") is True,
        server.get("hasCapabilities") is True,
        server.get("hasWorkbench") is True,
        server.get("hasHealth") is True,
        server.get("hasChat") is True,
    )):
        raise RuntimeError("Server task compatibility routes are incomplete.")
    expected_engine_paths = sorted([
        "/execute_tool_manually",
        "/health",
        "/simple_chat",
        "/v1/chat/abort",
        "/v1/chat/completions",
        "/v1/chat/tools/approval",
        "/v1/desktop/knowledge-base/build",
        "/v1/desktop/knowledge-base/query",
        "/v1/desktop/knowledge-base/remove",
        "/v1/desktop/knowledge-base/status",
        "/v1/desktop/kernel/command",
        "/v1/desktop/enterprise-insights/competition/purge",
        "/v1/desktop/enterprise-insights/competition/sync",
        "/v1/desktop/enterprise-insights/kg/dashboard",
        "/v1/desktop/enterprise-insights/kg/query",
        "/v1/desktop/enterprise-insights/neuro/dashboard",
        "/v1/desktop/enterprise-insights/neuro/maintenance",
        "/v1/desktop/enterprise-insights/neuro/remove",
        "/v1/desktop/enterprise-insights/neuro/search",
        "/v1/models",
        "/v1/tasks/executor/delivery/dispatch",
        "/v1/tasks/executor/preflight",
        "/v1/tasks/executor/session/cancel",
        "/v1/tasks/executor/session/evaluate",
        "/v1/tasks/executor/session/turn",
    ])
    if not all((
        execution_engine.get("registered") is False,
        execution_engine.get("executionEngine") is True,
        execution_engine.get("hasBroker") is True,
        execution_engine.get("hasList") is False,
        execution_engine.get("hasCreate") is False,
        execution_engine.get("hasCapabilities") is False,
        execution_engine.get("hasWorkbench") is False,
        execution_engine.get("hasHealth") is True,
        execution_engine.get("hasChat") is True,
        execution_engine.get("paths") == expected_engine_paths,
    )):
        raise RuntimeError("Execution Engine route table is not exact and private.")
    return {
        "ok": True,
        "desktop": desktop,
        "server": server,
        "executionEngine": execution_engine,
    }


def main() -> int:
    """Run all profile probes and print one UTF-8 JSON report."""

    report = asyncio.run(run_smoke())
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
