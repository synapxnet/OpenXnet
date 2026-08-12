# -*- coding: utf-8 -*-
"""Smoke the real authenticated Execution Engine process and exact route table."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
import time
from typing import Any

import httpx


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SMOKE_TOKEN = "execution-engine-smoke-token"
STARTUP_BUDGET_SECONDS = 120


async def _read_engine_port(stream: asyncio.StreamReader) -> int:
    """Read the bounded startup stream until the engine publishes its selected port."""

    while True:
        line = await asyncio.wait_for(
            stream.readline(),
            timeout=STARTUP_BUDGET_SECONDS,
        )
        if not line:
            raise RuntimeError("Execution Engine exited before its port handshake.")
        text = line.decode("utf-8", errors="strict").strip()
        if not text.startswith("REAL_PORT_FOUND:"):
            continue
        try:
            port = int(text.split(":", 1)[1])
        except (IndexError, ValueError) as error:
            raise RuntimeError("Execution Engine returned an invalid port handshake.") from error
        if not 1 <= port <= 65_535:
            raise RuntimeError("Execution Engine returned an out-of-range port.")
        return port


async def _drain_stream(stream: asyncio.StreamReader) -> None:
    """Drain one child stream without retaining provider or credential diagnostics."""

    while await stream.readline():
        pass


async def _wait_for_health(origin: str) -> None:
    """Poll the authenticated health route until ASGI lifespan startup is complete."""

    deadline = time.monotonic() + STARTUP_BUDGET_SECONDS
    headers = {"Authorization": f"Bearer {SMOKE_TOKEN}"}
    async with httpx.AsyncClient(timeout=2) as client:
        while time.monotonic() < deadline:
            try:
                response = await client.get(f"{origin}/health", headers=headers)
                if response.status_code == 200:
                    return
            except httpx.HTTPError:
                pass
            await asyncio.sleep(0.2)
    raise RuntimeError("Execution Engine health check timed out.")


async def _probe_routes(origin: str) -> dict[str, int]:
    """探测私有 typed 路由；输入 Origin，返回状态码，不调用 Provider，认证或隔离失败时抛错。"""

    headers = {"Authorization": f"Bearer {SMOKE_TOKEN}"}
    async with httpx.AsyncClient(timeout=10) as client:
        unauthorized = await client.get(f"{origin}/health")
        models = await client.post(f"{origin}/v1/models", headers=headers, json={})
        abort = await client.post(
            f"{origin}/v1/chat/abort",
            headers=headers,
            json={"conversationId": "execution-engine-smoke"},
        )
        invalid_chat = await client.post(
            f"{origin}/v1/chat/completions",
            headers=headers,
            json={},
        )
        unknown = await client.post(f"{origin}/v1/chat/unknown", headers=headers)
        invalid_broker = await client.post(
            f"{origin}/v1/tasks/executor/preflight",
            headers=headers,
            json={},
        )
        knowledge_base_status = await client.post(
            f"{origin}/v1/desktop/knowledge-base/status",
            headers=headers,
            json={"knowledgeBaseId": "smoke-kb"},
        )
        invalid_knowledge_base = await client.post(
            f"{origin}/v1/desktop/knowledge-base/status",
            headers=headers,
            json={"knowledgeBaseId": "smoke-kb", "path": "C:\\private"},
        )
        neuro_dashboard = await client.post(
            f"{origin}/v1/desktop/enterprise-insights/neuro/dashboard",
            headers=headers,
            json={"limit": 10},
        )
        knowledge_graph = await client.post(
            f"{origin}/v1/desktop/enterprise-insights/kg/dashboard",
            headers=headers,
            json={"limit": 20},
        )
        invalid_insights = await client.post(
            f"{origin}/v1/desktop/enterprise-insights/neuro/search",
            headers=headers,
            json={"query": "smoke", "operator": "", "limit": 10, "path": "C:\\private"},
        )
        kernel_status = await client.post(
            f"{origin}/v1/desktop/kernel/command",
            headers=headers,
            json={"operation": "status", "payload": {}},
        )
        invalid_kernel = await client.post(
            f"{origin}/v1/desktop/kernel/command",
            headers=headers,
            json={
                "operation": "status",
                "payload": {"endpoint": "/v1/kernel/status"},
            },
        )
        usage_route = await client.post(
            f"{origin}/v1/usage/summary",
            headers=headers,
            json={},
        )
    statuses = {
        "unauthorizedHealth": unauthorized.status_code,
        "models": models.status_code,
        "abort": abort.status_code,
        "invalidChatPayload": invalid_chat.status_code,
        "unknownRoute": unknown.status_code,
        "invalidBrokerPayload": invalid_broker.status_code,
        "knowledgeBaseStatus": knowledge_base_status.status_code,
        "invalidKnowledgeBasePayload": invalid_knowledge_base.status_code,
        "neuroDashboard": neuro_dashboard.status_code,
        "knowledgeGraph": knowledge_graph.status_code,
        "invalidInsightsPayload": invalid_insights.status_code,
        "kernelStatus": kernel_status.status_code,
        "invalidKernelPayload": invalid_kernel.status_code,
        "usageRouteAbsent": usage_route.status_code,
    }
    if statuses != {
        "unauthorizedHealth": 401,
        "models": 200,
        "abort": 200,
        "invalidChatPayload": 422,
        "unknownRoute": 404,
        "invalidBrokerPayload": 422,
        "knowledgeBaseStatus": 200,
        "invalidKnowledgeBasePayload": 422,
        "neuroDashboard": 200,
        "knowledgeGraph": 200,
        "invalidInsightsPayload": 422,
        "kernelStatus": 200,
        "invalidKernelPayload": 422,
        "usageRouteAbsent": 404,
    }:
        raise RuntimeError(
            f"Execution Engine route isolation smoke failed: {statuses}"
        )
    knowledge_base_payload = knowledge_base_status.json()
    if (
        knowledge_base_payload.get("status") != "not_found"
        or knowledge_base_payload.get("knowledgeBaseId") != "smoke-kb"
        or "private" in json.dumps(knowledge_base_payload).lower()
        or SMOKE_TOKEN in json.dumps(knowledge_base_payload)
    ):
        raise RuntimeError("Execution Engine knowledge base boundary smoke failed.")
    insights_payload = neuro_dashboard.json()
    graph_payload = knowledge_graph.json()
    if (
        insights_payload.get("schema") != "openxnet.enterprise-insights.v1"
        or not isinstance(insights_payload.get("symbols"), list)
        or graph_payload.get("schema") != "openxnet.enterprise-insights.v1"
        or not isinstance((graph_payload.get("graph") or {}).get("nodes"), list)
        or "private" in json.dumps([insights_payload, graph_payload]).lower()
        or SMOKE_TOKEN in json.dumps([insights_payload, graph_payload])
    ):
        raise RuntimeError("Execution Engine enterprise insights boundary smoke failed.")
    kernel_payload = kernel_status.json()
    if (
        kernel_payload.get("schema") != "openxnet.kernel-runtime.v1"
        or kernel_payload.get("operation") != "status"
        or not isinstance(kernel_payload.get("data"), dict)
        or kernel_payload.get("data", {}).get("ok") is not True
        or SMOKE_TOKEN in json.dumps(kernel_payload)
    ):
        raise RuntimeError("Execution Engine Kernel boundary smoke failed.")
    return statuses


async def _remove_temporary_directory(directory: Path) -> None:
    """Retry Windows cleanup while terminated SQLite handles finish releasing."""

    for attempt in range(20):
        try:
            shutil.rmtree(directory)
            return
        except FileNotFoundError:
            return
        except PermissionError:
            if attempt == 19:
                raise
            await asyncio.sleep(0.1)


def _resolve_engine_command(engine_executable: str) -> tuple[str, list[str], Path]:
    """Resolve a packaged engine executable or the current Python source entrypoint."""

    normalized = str(engine_executable or "").strip()
    if normalized:
        executable = Path(normalized).expanduser().resolve(strict=True)
        return str(executable), [], executable.parent
    return sys.executable, ["-u", "server.py"], PROJECT_ROOT


async def run_smoke(engine_executable: str = "") -> dict[str, Any]:
    """Launch, authenticate, probe, and terminate one real Execution Engine process."""

    started_at = time.monotonic()
    command, command_arguments, working_directory = _resolve_engine_command(
        engine_executable,
    )
    user_data_directory = Path(tempfile.mkdtemp(prefix="openxnet-execution-engine-"))
    try:
        environment = {
            **os.environ,
            "OPENXNET_RUNTIME_ROLE": "execution-engine",
            "OPENXNET_USER_DATA_DIR": str(user_data_directory),
            "OPENXNET_TASK_RPC_TOKEN": SMOKE_TOKEN,
            "PYTHONIOENCODING": "utf-8",
            "PYTHONUTF8": "1",
            "PYTHONUNBUFFERED": "1",
        }
        process = await asyncio.create_subprocess_exec(
            command,
            *command_arguments,
            "--host",
            "127.0.0.1",
            "--port",
            "0",
            cwd=str(working_directory),
            env=environment,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        if process.stdout is None or process.stderr is None:
            raise RuntimeError("Execution Engine smoke could not capture process streams.")
        stderr_drain = asyncio.create_task(_drain_stream(process.stderr))
        stdout_drain: asyncio.Task[None] | None = None
        try:
            port = await _read_engine_port(process.stdout)
            stdout_drain = asyncio.create_task(_drain_stream(process.stdout))
            origin = f"http://127.0.0.1:{port}"
            await _wait_for_health(origin)
            statuses = await _probe_routes(origin)
            if process.returncode is not None:
                raise RuntimeError("Execution Engine exited during route probes.")
            return {
                "ok": True,
                "profile": "execution-engine",
                "engine": command,
                "startupMs": round((time.monotonic() - started_at) * 1_000),
                "statuses": statuses,
            }
        finally:
            if process.returncode is None:
                process.terminate()
                try:
                    await asyncio.wait_for(process.wait(), timeout=15)
                except asyncio.TimeoutError:
                    process.kill()
                    await process.wait()
            if stdout_drain is not None:
                await stdout_drain
            await stderr_drain
    finally:
        await _remove_temporary_directory(user_data_directory)


def main() -> int:
    """Run the real process smoke and print one UTF-8 JSON report."""

    parser = argparse.ArgumentParser()
    parser.add_argument("--engine-executable", default="")
    arguments = parser.parse_args()
    report = asyncio.run(run_smoke(arguments.engine_executable))
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
