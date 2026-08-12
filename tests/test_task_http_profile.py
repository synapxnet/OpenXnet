# -*- coding: utf-8 -*-
"""Regression coverage for Desktop and Server task HTTP route isolation."""

from __future__ import annotations

from pathlib import Path
import unittest

from py.task_http_profile import (
    TASK_HTTP_FAMILY_BROKER,
    TASK_HTTP_FAMILY_SERVER,
    TASK_HTTP_FAMILY_UNRELATED,
    classify_task_http_path,
    resolve_task_http_profile_policy,
)


PROJECT_ROOT = Path(__file__).resolve().parents[1]


class TaskHttpProfileTests(unittest.TestCase):
    """Validate exact route families, visibility, and packaging boundaries."""

    def test_classifies_exact_brokers_and_server_commands(self) -> None:
        """Keep unknown executor paths outside the Desktop broker allow-list."""

        self.assertEqual(
            classify_task_http_path("/v1/tasks/executor/preflight"),
            TASK_HTTP_FAMILY_BROKER,
        )
        self.assertEqual(
            classify_task_http_path("/v1/tasks/executor/session/turn"),
            TASK_HTTP_FAMILY_BROKER,
        )
        self.assertEqual(
            classify_task_http_path("/v1/tasks/list"),
            TASK_HTTP_FAMILY_SERVER,
        )
        self.assertEqual(
            classify_task_http_path("/v1/tasks/executor/unknown"),
            TASK_HTTP_FAMILY_SERVER,
        )
        self.assertEqual(
            classify_task_http_path("/v1/models"),
            TASK_HTTP_FAMILY_UNRELATED,
        )

    def test_desktop_hides_commands_and_authenticates_brokers(self) -> None:
        """Expose only bearer-authenticated typed broker routes in Desktop."""

        broker = resolve_task_http_profile_policy(
            "desktop",
            "/v1/tasks/executor/delivery/dispatch",
        )
        command = resolve_task_http_profile_policy("desktop", "/v1/tasks/create")
        self.assertTrue(broker.visible)
        self.assertTrue(broker.requires_bearer)
        self.assertFalse(command.visible)
        self.assertFalse(command.requires_bearer)

    def test_server_exposes_commands_without_desktop_token(self) -> None:
        """Retain browser compatibility and broker access in Server profile."""

        for path in (
            "/v1/tasks/list",
            "/v1/tasks/create",
            "/v1/tasks/task-1",
            "/v1/tasks/executor/session/turn",
            "/v1/dev/workbench/tasks/create",
        ):
            policy = resolve_task_http_profile_policy("server", path)
            self.assertTrue(policy.visible)
            self.assertFalse(policy.requires_bearer)

    def test_execution_engine_exposes_only_authenticated_brokers(self) -> None:
        """Apply Desktop task isolation to the private execution-engine profile."""

        broker = resolve_task_http_profile_policy(
            "execution-engine",
            "/v1/tasks/executor/session/turn",
        )
        command = resolve_task_http_profile_policy(
            "execution-engine",
            "/v1/tasks/create",
        )
        self.assertTrue(broker.visible)
        self.assertTrue(broker.requires_bearer)
        self.assertFalse(command.visible)
        self.assertFalse(command.requires_bearer)

    def test_desktop_entrypoint_registers_extracted_broker_api(self) -> None:
        """Keep all task route implementations outside the monolithic entrypoint."""

        server_source = (PROJECT_ROOT / "server.py").read_text(encoding="utf-8")
        broker_source = (
            PROJECT_ROOT / "py" / "task_execution_broker_api.py"
        ).read_text(encoding="utf-8")
        self.assertNotIn('@app.get("/v1/tasks/list")', server_source)
        self.assertNotIn('@app.post("/v1/tasks/create")', server_source)
        self.assertNotIn('@app.post("/v1/tasks/start/', server_source)
        self.assertNotIn('@app.post("/v1/tasks/executor/', server_source)
        self.assertIn("register_task_execution_broker_api(", server_source)
        self.assertIn('"/v1/tasks/executor/preflight"', broker_source)
        self.assertIn('"/v1/tasks/executor/session/turn"', broker_source)
        self.assertIn("_register_server_profile_task_api()", server_source)

    def test_task_worker_uses_main_owned_broker_without_backend_dependency(self) -> None:
        """Keep Task Worker activation independent from the legacy backend capability."""

        core_source = (
            PROJECT_ROOT / "src" / "desktop" / "core" / "desktop-core.ts"
        ).read_text(encoding="utf-8")
        worker_source = (
            PROJECT_ROOT / "py" / "workers" / "task_execution_worker.py"
        ).read_text(encoding="utf-8")
        main_source = (PROJECT_ROOT / "main.js").read_text(encoding="utf-8")
        self.assertIn('id: "tasks"', core_source)
        self.assertIn('dependencies: ["core"]', core_source)
        self.assertIn('payload.get("brokerOrigin")', worker_source)
        self.assertNotIn('payload.get("backendOrigin")', worker_source)
        self.assertIn("startTaskExecutionBrokerGateway()", main_source)
        self.assertIn("executionEngineSupervisor.acquire()", main_source)
        self.assertNotIn("activateProviderEngine: activateTaskProviderEngine", main_source)
        self.assertIn("activateBackend: activateLegacyUiBackend", main_source)
        self.assertIn("void beginTaskScheduler()", main_source)

    def test_desktop_spec_excludes_server_only_task_modules(self) -> None:
        """Prevent Server compatibility code and scheduler from entering Desktop."""

        spec_source = (PROJECT_ROOT / "server.spec").read_text(encoding="utf-8")
        self.assertIn("'py.server_task_api'", spec_source)
        self.assertIn("'py.task_scheduler'", spec_source)
        self.assertIn("'py.task_execution_broker_api'", spec_source)
        self.assertIn("'py.overlay_router'", spec_source)
        self.assertIn("name='execution-engine'", spec_source)
        self.assertIn("include_desktop_python_module", spec_source)


if __name__ == "__main__":
    unittest.main()
