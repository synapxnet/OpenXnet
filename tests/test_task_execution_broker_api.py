# -*- coding: utf-8 -*-
"""Regression coverage for the extracted task execution broker API."""

from __future__ import annotations

import json
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import unittest

from py.task_execution_broker_api import (
    ProviderEvaluationResult,
    TaskExecutionBrokerApi,
    TaskExecutionBrokerDependencies,
    TaskExecutionPreflightRequest,
    TaskExecutionSessionCancelRequest,
    TaskExecutionSessionEvaluationRequest,
    TaskTerminalDeliveryRequest,
    build_task_executor_options,
)
from py.task_execution_preflight import TASK_EXECUTION_PREFLIGHT_REQUEST_SCHEMA
from py.task_execution_session import (
    TASK_EXECUTION_CANCEL_SCHEMA,
    TASK_EXECUTION_EVALUATION_SCHEMA,
)
from py.task_terminal_delivery import TASK_TERMINAL_DELIVERY_REQUEST_SCHEMA


class FakeTaskCenter:
    """Return deterministic task records for broker validation tests."""

    def __init__(self, tasks: dict[str, SimpleNamespace]) -> None:
        """Create a fake center over task identifiers."""

        self._tasks = tasks

    async def get_task(self, task_id: str) -> SimpleNamespace | None:
        """Return one configured task without mutating it."""

        return self._tasks.get(task_id)


class TaskExecutionBrokerApiTests(unittest.IsolatedAsyncioTestCase):
    """Validate route ownership, bounded results, cancellation, and delivery."""

    async def asyncSetUp(self) -> None:
        """Create one canonical workspace and injected broker dependency set."""

        self._temporary_directory = TemporaryDirectory()
        self.workspace = str(Path(self._temporary_directory.name).resolve())
        self.abort_requests: list[str] = []
        self.delivery_calls = 0
        self.running_task = SimpleNamespace(
            task_id="task-running",
            description="Finish the extracted broker validation.",
            status=SimpleNamespace(value="running"),
            context={"executor_session_id": "ses_running"},
        )
        self.terminal_task = SimpleNamespace(
            task_id="task-terminal",
            description="Deliver the terminal result.",
            status=SimpleNamespace(value="completed"),
            context={
                "executor_session_id": "ses_terminal",
                "delivery_targets": ["webhook"],
                "delivery_records": {"webhook": {"attempts": 0}},
            },
        )
        center = FakeTaskCenter({
            self.running_task.task_id: self.running_task,
            self.terminal_task.task_id: self.terminal_task,
        })

        async def load_settings() -> dict[str, object]:
            """Return secret-shaped settings that must never cross the broker."""

            return {
                "CLISettings": {"cc_path": self.workspace},
                "max_tokens": 9000,
                "api_key": "must-not-leak",
            }

        async def get_task_center(_workspace: str) -> FakeTaskCenter:
            """Return the deterministic task center for the canonical workspace."""

            return center

        async def get_block_message(_settings: dict[str, object]) -> None:
            """Report a ready provider without exposing its configuration."""

            return None

        async def run_turn(*_arguments: object) -> None:
            """Reject unexpected turn execution in these direct method tests."""

            return None

        async def evaluate_completion(
            _description: str,
            _progress: str,
        ) -> ProviderEvaluationResult:
            """Return one deterministic positive provider evaluation."""

            return ProviderEvaluationResult(status_code=200, content="YES")

        def abort_session(session_id: str) -> bool:
            """Record one exact provider session cancellation."""

            self.abort_requests.append(session_id)
            return True

        async def dispatch_terminal_delivery(
            _task: object,
            _record: dict[str, object],
            _settings: dict[str, object],
            _credential_bootstrap: str,
        ) -> dict[str, object]:
            """Return one deterministic credential-retaining delivery result."""

            self.delivery_calls += 1
            return {"success": True, "retryable": False, "method": "webhook"}

        self.broker = TaskExecutionBrokerApi(TaskExecutionBrokerDependencies(
            load_settings=load_settings,
            get_task_center=get_task_center,
            get_provider_block_message=get_block_message,
            run_session_turn=run_turn,
            evaluate_completion=evaluate_completion,
            abort_session=abort_session,
            dispatch_terminal_delivery=dispatch_terminal_delivery,
        ))

    async def asyncTearDown(self) -> None:
        """Release the isolated canonical workspace."""

        self._temporary_directory.cleanup()

    async def test_router_owns_only_five_exact_broker_paths(self) -> None:
        """Keep Server compatibility commands outside the extracted router."""

        paths = {
            route.path
            for route in self.broker.create_router().routes
            if hasattr(route, "path")
        }
        self.assertEqual(paths, {
            "/v1/tasks/executor/preflight",
            "/v1/tasks/executor/session/turn",
            "/v1/tasks/executor/session/evaluate",
            "/v1/tasks/executor/session/cancel",
            "/v1/tasks/executor/delivery/dispatch",
        })

    async def test_preflight_returns_only_bounded_non_secret_options(self) -> None:
        """Return readiness and token budget without reflecting provider settings."""

        response = await self.broker.preflight(TaskExecutionPreflightRequest(
            schema=TASK_EXECUTION_PREFLIGHT_REQUEST_SCHEMA,
            taskId="task-running",
            workspacePath=self.workspace,
            operation="start",
        ))
        payload = json.loads(response.body.decode("utf-8"))
        self.assertEqual(payload["maxTokens"], 9000)
        self.assertTrue(payload["ready"])
        self.assertNotIn("api_key", payload)

    async def test_evaluation_and_cancel_use_bound_session(self) -> None:
        """Correlate provider completion and cancellation to the claimed session."""

        evaluation = await self.broker.session_evaluate(
            TaskExecutionSessionEvaluationRequest(
                schema=TASK_EXECUTION_EVALUATION_SCHEMA,
                sessionId="ses_running",
                taskId="task-running",
                workspacePath=self.workspace,
                recentProgress="All acceptance checks passed.",
            )
        )
        cancellation = await self.broker.session_cancel(
            TaskExecutionSessionCancelRequest(
                schema=TASK_EXECUTION_CANCEL_SCHEMA,
                sessionId="ses_terminal",
                taskId="task-terminal",
                workspacePath=self.workspace,
            )
        )
        self.assertTrue(json.loads(evaluation.body.decode("utf-8"))["complete"])
        self.assertTrue(json.loads(cancellation.body.decode("utf-8"))["cancelled"])
        self.assertEqual(self.abort_requests, ["ses_terminal"])

    async def test_terminal_delivery_is_idempotent_per_attempt(self) -> None:
        """Dispatch one delivery side effect once for a repeated attempt identifier."""

        request = TaskTerminalDeliveryRequest(
            schema=TASK_TERMINAL_DELIVERY_REQUEST_SCHEMA,
            attemptId="dly_0123456789abcdef0123456789abcdef",
            taskId="task-terminal",
            workspacePath=self.workspace,
            target="webhook",
            attempt=1,
        )
        first = await self.broker.terminal_delivery(request)
        second = await self.broker.terminal_delivery(request)
        self.assertEqual(first.body, second.body)
        self.assertEqual(self.delivery_calls, 1)

    async def test_executor_options_are_clamped(self) -> None:
        """Keep the only provider-adjacent Worker option inside its protocol budget."""

        self.assertEqual(build_task_executor_options({"max_tokens": 1})["max_tokens"], 256)
        self.assertEqual(
            build_task_executor_options({"max_tokens": 999_999})["max_tokens"],
            65_536,
        )


if __name__ == "__main__":
    unittest.main()
