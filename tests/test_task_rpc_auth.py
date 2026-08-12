# -*- coding: utf-8 -*-
"""Regression coverage for the desktop task RPC authorization policy."""

from __future__ import annotations

import unittest

from py.task_rpc_auth import (
    is_authorized_desktop_task_rpc,
    is_desktop_task_rpc_path,
)


class TaskRpcAuthTests(unittest.TestCase):
    """Validate that every desktop task adapter route remains token-protected."""

    def test_only_typed_brokers_are_part_of_the_protected_surface(self) -> None:
        """Authenticate exact Desktop brokers while hiding Server task commands."""

        self.assertTrue(is_desktop_task_rpc_path(
            "/v1/tasks/executor/session/turn",
        ))
        self.assertTrue(is_desktop_task_rpc_path(
            "/v1/tasks/executor/delivery/dispatch",
        ))
        self.assertTrue(is_desktop_task_rpc_path(
            "/v1/tasks/executor/preflight",
        ))
        self.assertFalse(is_desktop_task_rpc_path(
            "/v1/tasks/scheduler/activate/12345678-1234-4123-8123-123456789abc",
        ))
        self.assertFalse(is_desktop_task_rpc_path("/v1/tasks/list"))
        self.assertFalse(is_desktop_task_rpc_path("/v1/models"))

    def test_desktop_routes_reject_missing_or_invalid_tokens(self) -> None:
        """Require an exact bearer token only for protected desktop routes."""

        arguments = {
            "runtime_profile": "desktop",
            "expected_token": "task-secret",
            "path": "/v1/tasks/executor/preflight",
        }
        self.assertFalse(is_authorized_desktop_task_rpc(
            **arguments,
            authorization="",
        ))
        self.assertFalse(is_authorized_desktop_task_rpc(
            **arguments,
            authorization="Bearer wrong-secret",
        ))
        self.assertTrue(is_authorized_desktop_task_rpc(
            **arguments,
            authorization="Bearer task-secret",
        ))

    def test_non_desktop_profiles_keep_server_clients_compatible(self) -> None:
        """Leave task routes unchanged for explicitly non-desktop deployments."""

        self.assertTrue(is_authorized_desktop_task_rpc(
            runtime_profile="server",
            expected_token="",
            path="/v1/tasks/list",
            authorization="",
        ))


if __name__ == "__main__":
    unittest.main()
