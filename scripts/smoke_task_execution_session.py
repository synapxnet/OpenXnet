# -*- coding: utf-8 -*-
"""End-to-end smoke for Task Worker stdio and the typed execution broker."""

from __future__ import annotations

import argparse
import asyncio
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import sys
import tempfile
import threading
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from py.task_center import TaskStatus, get_task_center
from py.task_execution_preflight import TASK_EXECUTION_PREFLIGHT_RESULT_SCHEMA
from py.task_execution_session import (
    TASK_EXECUTION_EVALUATION_SCHEMA,
    TASK_EXECUTION_EVENT_SCHEMA,
    TASK_EXECUTION_TURN_SCHEMA,
)
from py.task_terminal_delivery import (
    TASK_TERMINAL_DELIVERY_REQUEST_SCHEMA,
    TASK_TERMINAL_DELIVERY_RESULT_SCHEMA,
)
from py.workers.protocol import WorkerEnvelope


TASK_TOKEN = "phase3m-session-smoke-token"


class _SessionBrokerHandler(BaseHTTPRequestHandler):
    """Serve one deterministic authenticated execution session."""

    requests: list[dict[str, Any]] = []

    def do_GET(self) -> None:
        """Reject legacy task reads so direct-store regressions fail the smoke."""

        self.__class__.requests.append({
            "path": self.path,
            "authorization": self.headers.get("Authorization"),
            "body": {},
        })
        self._write_json({"detail": "not found"}, status=404)

    def do_POST(self) -> None:
        """Return typed turn, evaluation, or cancellation responses."""

        length = int(self.headers.get("Content-Length") or 0)
        body = json.loads(self.rfile.read(length).decode("utf-8")) if length else {}
        self.__class__.requests.append({
            "path": self.path,
            "authorization": self.headers.get("Authorization"),
            "body": body,
        })
        if self.headers.get("Authorization") != f"Bearer {TASK_TOKEN}":
            self._write_json({"detail": "unauthorized"}, status=401)
            return
        if self.path == "/v1/tasks/executor/preflight":
            self._write_json({
                "schema": TASK_EXECUTION_PREFLIGHT_RESULT_SCHEMA,
                "taskId": body.get("taskId"),
                "operation": body.get("operation"),
                "ready": True,
                "code": "READY",
                "message": "Execution provider is ready.",
                "maxTokens": 4096,
            })
            return
        if self.path == "/v1/tasks/executor/session/turn":
            session_id = str(body.get("sessionId") or "")
            events = [
                {
                    "schema": TASK_EXECUTION_EVENT_SCHEMA,
                    "sessionId": session_id,
                    "sequence": 1,
                    "type": "text_delta",
                    "text": "Packaged session completed",
                },
                {
                    "schema": TASK_EXECUTION_EVENT_SCHEMA,
                    "sessionId": session_id,
                    "sequence": 2,
                    "type": "done",
                },
            ]
            payload = "".join(
                f"data: {json.dumps(event, separators=(',', ':'))}\n\n"
                for event in events
            ).encode("utf-8")
            self._write_bytes(payload, "text/event-stream; charset=utf-8")
            return
        if self.path == "/v1/tasks/executor/session/evaluate":
            self._write_json({
                "schema": TASK_EXECUTION_EVALUATION_SCHEMA,
                "sessionId": body.get("sessionId"),
                "complete": True,
            })
            return
        if self.path == "/v1/tasks/executor/session/cancel":
            self._write_json({
                "schema": "openxnet.task-execution-cancel.v1",
                "sessionId": body.get("sessionId"),
                "cancelled": True,
            })
            return
        if self.path == "/v1/tasks/executor/delivery/dispatch":
            self._write_json({
                "schema": TASK_TERMINAL_DELIVERY_RESULT_SCHEMA,
                "attemptId": body.get("attemptId"),
                "taskId": body.get("taskId"),
                "target": body.get("target"),
                "success": True,
                "retryable": False,
                "method": "webhook",
                "message": "Delivery completed via webhook.",
                "error": "",
            })
            return
        self._write_json({"detail": "not found"}, status=404)

    def log_message(self, _format: str, *_arguments: object) -> None:
        """Suppress HTTP fixture diagnostics."""

    def _write_json(self, value: Any, *, status: int = 200) -> None:
        """Write one compact UTF-8 JSON response."""

        self._write_bytes(
            json.dumps(value, separators=(",", ":")).encode("utf-8"),
            "application/json; charset=utf-8",
            status=status,
        )

    def _write_bytes(
        self,
        payload: bytes,
        content_type: str,
        *,
        status: int = 200,
    ) -> None:
        """Write one bounded fixture response."""

        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


def _build_request(message_id: str, method: str, payload: dict[str, Any]) -> str:
    """Build one exact Task Worker protocol request line."""

    return json.dumps({
        "protocolVersion": "1.0",
        "messageId": message_id,
        "traceId": message_id,
        "kind": "request",
        "capability": "tasks",
        "method": method,
        "payload": payload,
    }, separators=(",", ":")) + "\n"


async def _send_request(
    process: asyncio.subprocess.Process,
    message_id: str,
    method: str,
    payload: dict[str, Any],
) -> None:
    """Write one request to a running Worker subprocess."""

    if process.stdin is None:
        raise RuntimeError("Task Worker stdin is unavailable.")
    process.stdin.write(_build_request(message_id, method, payload).encode("utf-8"))
    await process.stdin.drain()


async def _read_until_completed(
    process: asyncio.subprocess.Process,
    *,
    timeout_seconds: float,
) -> list[WorkerEnvelope]:
    """Read valid envelopes until the terminal completed checkpoint arrives."""

    if process.stdout is None:
        raise RuntimeError("Task Worker stdout is unavailable.")
    envelopes: list[WorkerEnvelope] = []

    async def read() -> None:
        """Collect protocol lines and stop at the completed checkpoint event."""

        while True:
            line = await process.stdout.readline()
            if not line:
                raise RuntimeError("Task Worker exited before terminal checkpoint.")
            try:
                decoded_line = line.decode("utf-8")
            except UnicodeDecodeError as error:
                preview = repr(line[:2048])
                raise RuntimeError(
                    f"Task Worker stdout is not UTF-8 protocol data: {preview}"
                ) from error
            envelope = WorkerEnvelope.from_json_line(decoded_line)
            envelopes.append(envelope)
            if (
                envelope.method == "tasks.checkpoint"
                and envelope.payload.get("status") == "completed"
            ):
                return

    await asyncio.wait_for(read(), timeout=timeout_seconds)
    return envelopes


async def _read_shutdown_response(
    process: asyncio.subprocess.Process,
    *,
    timeout_seconds: float,
) -> WorkerEnvelope:
    """Read protocol lines until the correlated shutdown response arrives."""

    if process.stdout is None:
        raise RuntimeError("Task Worker stdout is unavailable.")
    while True:
        line = await asyncio.wait_for(process.stdout.readline(), timeout=timeout_seconds)
        if not line:
            raise RuntimeError("Task Worker exited before shutdown response.")
        envelope = WorkerEnvelope.from_json_line(line.decode("utf-8"))
        if envelope.message_id == "shutdown-1":
            return envelope


async def _read_until_response(
    process: asyncio.subprocess.Process,
    message_id: str,
    *,
    timeout_seconds: float,
) -> list[WorkerEnvelope]:
    """Read valid envelopes until one correlated Worker response arrives."""

    if process.stdout is None:
        raise RuntimeError("Task Worker stdout is unavailable.")
    envelopes: list[WorkerEnvelope] = []

    async def read() -> None:
        """Collect protocol events until the requested response is observed."""

        while True:
            line = await process.stdout.readline()
            if not line:
                raise RuntimeError("Task Worker exited before the expected response.")
            envelope = WorkerEnvelope.from_json_line(line.decode("utf-8"))
            envelopes.append(envelope)
            if envelope.message_id == message_id:
                return

    await asyncio.wait_for(read(), timeout=timeout_seconds)
    return envelopes


def _resolve_worker_command(worker_executable: str) -> tuple[str, list[str]]:
    """Resolve a packaged executable or the current Python module command."""

    normalized = str(worker_executable or "").strip()
    if normalized:
        path = Path(normalized).expanduser().resolve(strict=True)
        return str(path), []
    return sys.executable, ["-m", "py.workers.task_execution_worker"]


async def run_smoke(worker_executable: str = "") -> dict[str, Any]:
    """Run direct task commands, execution, and delivery through packaged stdio."""

    _SessionBrokerHandler.requests = []
    server = ThreadingHTTPServer(("127.0.0.1", 0), _SessionBrokerHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    process: asyncio.subprocess.Process | None = None
    try:
        with tempfile.TemporaryDirectory(prefix="openxnet-phase3m-smoke-") as directory:
            workspace = Path(directory) / "workspace"
            workspace.mkdir()
            task_center = await get_task_center(str(workspace))
            task_id = "12345678-1234-4123-8123-123456789abc"
            command, arguments = _resolve_worker_command(worker_executable)
            environment = {
                **os.environ,
                "OPENXNET_RUNTIME_ROLE": "task-worker",
                "OPENXNET_TASK_RPC_TOKEN": TASK_TOKEN,
                "PYTHONIOENCODING": "utf-8",
                "PYTHONUTF8": "1",
            }
            process = await asyncio.create_subprocess_exec(
                command,
                *arguments,
                cwd=str(PROJECT_ROOT),
                env=environment,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            origin = f"http://127.0.0.1:{server.server_port}"
            await _send_request(
                process,
                "create-1",
                "tasks.create",
                {
                    "brokerOrigin": origin,
                    "workspacePath": str(workspace),
                    "task": {
                        "task_id": task_id,
                        "title": "Typed packaged execution",
                        "description": "Complete through direct persistence and typed brokers.",
                        "agent_type": "default",
                        "delivery_targets": ["task_center", "webhook"],
                        "start_immediately": False,
                    },
                },
            )
            create_envelopes = await _read_until_response(
                process,
                "create-1",
                timeout_seconds=10,
            )
            await _send_request(
                process,
                "start-1",
                "tasks.start",
                {
                    "brokerOrigin": origin,
                    "workspacePath": str(workspace),
                    "taskId": task_id,
                    "triggerSource": "phase3m_smoke",
                },
            )
            envelopes = await _read_until_completed(process, timeout_seconds=30)
            await _send_request(
                process,
                "delivery-tick-1",
                "tasks.scheduler.tick",
                {
                    "brokerOrigin": origin,
                    "workspacePath": str(workspace),
                },
            )
            delivery_envelopes = await _read_until_response(
                process,
                "delivery-tick-1",
                timeout_seconds=15,
            )
            await _send_request(process, "shutdown-1", "system.shutdown", {})
            shutdown = await _read_shutdown_response(process, timeout_seconds=5)
            return_code = await asyncio.wait_for(process.wait(), timeout=10)
            stderr = (
                (await process.stderr.read()).decode("utf-8", errors="replace")
                if process.stderr is not None
                else ""
            )
            persisted = await task_center.get_task(task_id)
            preflight_request = next(
                request
                for request in _SessionBrokerHandler.requests
                if request["path"] == "/v1/tasks/executor/preflight"
            )
            turn_request = next(
                request
                for request in _SessionBrokerHandler.requests
                if request["path"] == "/v1/tasks/executor/session/turn"
            )
            delivery_request = next(
                request
                for request in _SessionBrokerHandler.requests
                if request["path"] == "/v1/tasks/executor/delivery/dispatch"
            )
            if persisted is None or persisted.status != TaskStatus.COMPLETED:
                raise RuntimeError("Task Worker did not persist completed task state.")
            if preflight_request["body"].get("operation") != "start":
                raise RuntimeError("Task Worker did not preflight the direct start command.")
            if turn_request["authorization"] != f"Bearer {TASK_TOKEN}":
                raise RuntimeError("Execution session request was not authenticated.")
            if turn_request["body"].get("schema") != TASK_EXECUTION_TURN_SCHEMA:
                raise RuntimeError("Execution session turn schema was not used.")
            delivery_record = (persisted.context.get("delivery_records") or {}).get("webhook") or {}
            if delivery_record.get("status") != "delivered":
                raise RuntimeError("Task Worker did not persist terminal delivery state.")
            if delivery_request["body"].get("schema") != TASK_TERMINAL_DELIVERY_REQUEST_SCHEMA:
                raise RuntimeError("Terminal delivery request schema was not used.")
            if "config" in json.dumps(delivery_request["body"]):
                raise RuntimeError("Terminal delivery request exposed target configuration.")
            request_paths = [
                str(request["path"])
                for request in _SessionBrokerHandler.requests
            ]
            if any(
                path in {"/v1/tasks/list", "/v1/tasks/create"}
                or path.startswith("/v1/tasks/start/")
                or path.startswith("/v1/tasks/resume/")
                or path.startswith("/v1/tasks/cancel/")
                or path.startswith("/v1/tasks/scheduler/project/")
                or path.startswith("/v1/tasks/scheduler/activate/")
                for path in request_paths
            ):
                raise RuntimeError("Task Worker used a legacy task persistence HTTP route.")
            delivery_events = [
                envelope
                for envelope in delivery_envelopes
                if envelope.method == "tasks.delivery"
            ]
            if len(delivery_events) != 1 or delivery_events[0].payload.get("status") != "delivered":
                raise RuntimeError("Task Worker did not emit one delivered outcome event.")
            if shutdown.payload.get("status") != "stopping" or return_code != 0:
                raise RuntimeError("Task Worker did not shut down cleanly.")
            return {
                "ok": True,
                "worker": command,
                "taskId": task_id,
                "sessionId": persisted.context.get("executor_session_id"),
                "checkpointEvents": sum(
                    envelope.method == "tasks.checkpoint"
                    for envelope in [
                        *create_envelopes,
                        *envelopes,
                        *delivery_envelopes,
                    ]
                ),
                "deliveryEvents": len(delivery_events),
                "deliveryConfigIsolated": True,
                "directTaskCommands": True,
                "stdoutProtocolOnly": True,
                "stderrDiagnostics": bool(stderr.strip()),
            }
    finally:
        if process is not None and process.returncode is None:
            process.kill()
            await process.wait()
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


def main() -> int:
    """Parse CLI arguments, run the smoke, and print one UTF-8 JSON report."""

    parser = argparse.ArgumentParser()
    parser.add_argument("--worker-executable", default="")
    arguments = parser.parse_args()
    report = asyncio.run(run_smoke(arguments.worker_executable))
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
