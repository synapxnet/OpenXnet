# -*- coding: utf-8 -*-
"""Regression coverage for the isolated Server-profile task compatibility API."""

from __future__ import annotations

from pathlib import Path
import tempfile
import unittest

from fastapi import FastAPI
import httpx

from py.server_task_api import (
    SERVER_TASK_API_SCHEMA,
    ServerTaskApiDependencies,
    register_server_task_api,
)
from py.task_center import TaskCenter, TaskStatus


class ServerTaskApiTests(unittest.IsolatedAsyncioTestCase):
    """Validate browser compatibility independently from the Desktop backend."""

    def setUp(self) -> None:
        """Create one isolated Server workspace and dependency set."""

        self.temporary_directory = tempfile.TemporaryDirectory(
            prefix="openxnet-server-task-api-",
        )
        self.workspace = Path(self.temporary_directory.name) / "workspace"
        self.workspace.mkdir()
        self.center = TaskCenter(str(self.workspace), runtime_role="server")
        self.scheduled: list[dict[str, object]] = []

    def tearDown(self) -> None:
        """Release the isolated Server workspace."""

        self.temporary_directory.cleanup()

    async def _load_settings(self) -> dict[str, object]:
        """Return deterministic Server settings for one test workspace."""

        return {
            "CLISettings": {"cc_path": str(self.workspace)},
            "max_tokens": 6000,
        }

    async def _get_task_center(self, _workspace_path: str) -> TaskCenter:
        """Return the isolated Server Task Center."""

        return self.center

    async def _get_block_message(self, _settings: dict[str, object]) -> None:
        """Report a ready provider for compatibility command tests."""

        return None

    def _get_runtime_context(self, _settings: dict[str, object]) -> dict[str, object]:
        """Return bounded developer-workbench runtime context."""

        return {
            "workspace_dir": str(self.workspace),
            "engine": "server",
            "permission_mode": "default",
        }

    def _build_workbench_payload(
        self,
        request: object,
        _context: dict[str, object],
    ) -> dict[str, object]:
        """Build one deterministic workbench payload from the request model."""

        return {
            "title": f"Workbench: {getattr(request, 'goal', '')}",
            "description": "Server-profile workbench compatibility task.",
            "context": {"created_from": "developer_workbench"},
        }

    def _build_executor_options(self, _settings: dict[str, object]) -> dict[str, int]:
        """Return one bounded non-secret executor option."""

        return {"max_tokens": 6000}

    def _backend_origin(self) -> str:
        """Return the synthetic Server backend origin."""

        return "http://127.0.0.1:3457"

    def _schedule_execution(self, **keywords: object) -> bool:
        """Record one Server execution launch without starting a model session."""

        self.scheduled.append(dict(keywords))
        return True

    def _build_application(self) -> FastAPI:
        """Build one FastAPI application containing only Server task routes."""

        application = FastAPI()
        register_server_task_api(
            application,
            ServerTaskApiDependencies(
                load_settings=self._load_settings,
                get_task_center=self._get_task_center,
                get_block_message=self._get_block_message,
                get_cli_runtime_context=self._get_runtime_context,
                build_developer_workbench_payload=self._build_workbench_payload,
                build_executor_options=self._build_executor_options,
                backend_origin=self._backend_origin,
                schedule_execution=self._schedule_execution,
            ),
        )
        return application

    async def test_registers_versioned_server_routes_and_preserves_crud(self) -> None:
        """Exercise browser-compatible create, start, cancel, resume, and delete."""

        transport = httpx.ASGITransport(app=self._build_application())
        async with httpx.AsyncClient(
            transport=transport,
            base_url="http://server.test",
        ) as client:
            descriptor = await client.get("/v1/tasks/capabilities")
            self.assertEqual(descriptor.status_code, 200)
            self.assertEqual(descriptor.json()["schema"], SERVER_TASK_API_SCHEMA)
            task_id = "12345678-1234-4123-8123-123456789abc"
            created = await client.post("/v1/tasks/create", json={
                "task_id": task_id,
                "title": "Server compatibility task",
                "description": "Keep browser clients independent from Desktop Core.",
                "start_immediately": False,
            })
            self.assertEqual(created.status_code, 200)
            self.assertTrue(created.json()["scheduled_only"])
            listed = await client.get("/v1/tasks/list")
            self.assertEqual(len(listed.json()["tasks"]), 1)
            detail = await client.get(f"/v1/tasks/{task_id}")
            self.assertEqual(detail.json()["task"]["task_id"], task_id)
            started = await client.post(
                f"/v1/tasks/start/{task_id}",
                json={"trigger_source": "browser_client"},
            )
            self.assertEqual(started.status_code, 200)
            self.assertEqual(len(self.scheduled), 1)
            cancelled = await client.post(f"/v1/tasks/cancel/{task_id}")
            self.assertTrue(cancelled.json()["success"])
            resumed = await client.post(
                f"/v1/tasks/resume/{task_id}",
                json={"resume_note": "Continue from browser state."},
            )
            self.assertEqual(resumed.status_code, 200)
            self.assertEqual(len(self.scheduled), 2)
            deleted = await client.delete(f"/v1/tasks/{task_id}")
            self.assertTrue(deleted.json()["success"])

    async def test_retains_scheduler_and_workbench_compatibility_routes(self) -> None:
        """Register scheduler adapters and developer-workbench creation in Server."""

        application = self._build_application()
        paths = {getattr(route, "path", "") for route in application.routes}
        self.assertIn("/v1/tasks/scheduler/project/{task_id}", paths)
        self.assertIn("/v1/tasks/scheduler/activate/{task_id}", paths)
        self.assertIn("/v1/dev/workbench/tasks/create", paths)
        transport = httpx.ASGITransport(app=application)
        async with httpx.AsyncClient(
            transport=transport,
            base_url="http://server.test",
        ) as client:
            workbench = await client.post(
                "/v1/dev/workbench/tasks/create",
                json={
                    "goal": "Review Server task compatibility",
                    "start_immediately": False,
                },
            )
            recurring = await self.center.create_task(
                task_id="12345678-1234-4123-8123-123456789abd",
                title="Server recurring task",
                description="Retain Server scheduler compatibility.",
                context={
                    "schedule_type": "recurring",
                    "schedule_expression": "hourly",
                },
            )
            projected = await client.post(
                f"/v1/tasks/scheduler/project/{recurring.task_id}",
                json={"next_run_at": "2026-07-24T10:00:00", "error": ""},
            )
            self.assertEqual(projected.status_code, 200)
            await self.center.update_task_progress(
                recurring.task_id,
                100,
                status=TaskStatus.COMPLETED,
                result="First recurring run completed.",
            )
            activated = await client.post(
                f"/v1/tasks/scheduler/activate/{recurring.task_id}",
                json={
                    "scheduler_matched_at": "2026-07-24T10:01:00",
                    "next_run_at": "2026-07-24T11:00:00",
                },
            )
        self.assertEqual(workbench.status_code, 200)
        self.assertEqual(
            workbench.json()["task"]["created_from"],
            "developer_workbench",
        )
        self.assertEqual(activated.status_code, 200)
        persisted = await self.center.get_task(recurring.task_id)
        self.assertEqual(persisted.context["scheduled_run_count"], 1)
        self.assertEqual(len(self.scheduled), 1)

    async def test_provider_block_preserves_service_unavailable_status(self) -> None:
        """Return HTTP 503 instead of converting readiness blocks into HTTP 500."""

        async def blocked(_settings: dict[str, object]) -> str:
            """Return one generic provider readiness block."""

            return "Execution provider is not ready."

        application = FastAPI()
        dependencies = ServerTaskApiDependencies(
            load_settings=self._load_settings,
            get_task_center=self._get_task_center,
            get_block_message=blocked,
            get_cli_runtime_context=self._get_runtime_context,
            build_developer_workbench_payload=self._build_workbench_payload,
            build_executor_options=self._build_executor_options,
            backend_origin=self._backend_origin,
            schedule_execution=self._schedule_execution,
        )
        register_server_task_api(application, dependencies)
        transport = httpx.ASGITransport(app=application)
        async with httpx.AsyncClient(
            transport=transport,
            base_url="http://server.test",
        ) as client:
            response = await client.post("/v1/tasks/create", json={
                "title": "Blocked task",
                "description": "Provider guard must remain observable.",
                "start_immediately": True,
            })
        self.assertEqual(response.status_code, 503)
        self.assertEqual((await self.center.list_tasks()), [])


if __name__ == "__main__":
    unittest.main()
