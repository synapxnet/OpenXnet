# -*- coding: utf-8 -*-
"""Regression coverage for request-scoped task delivery credentials."""

from __future__ import annotations

import base64
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from py.delivery_credentials import (
    decode_delivery_credential_bootstrap,
    hydrate_delivery_record,
    normalize_delivery_credential_headers,
    normalize_delivery_credential_url,
)


def build_bootstrap(
    workspace_path: str,
    task_id: str,
    target: str,
    credentials: dict[str, object],
) -> str:
    """Encode one synthetic Main-owned runtime credential envelope."""

    payload = {
        "schema": "openxnet.delivery-credentials.runtime.v1",
        "scope": {
            "workspacePath": workspace_path,
            "taskId": task_id,
            "target": target,
        },
        "credentials": credentials,
    }
    return base64.b64encode(
        json.dumps(payload, separators=(",", ":")).encode("utf-8")
    ).decode("ascii")


class DeliveryCredentialTests(unittest.TestCase):
    """Validate URL policy, exact scope matching, and detached hydration."""

    def test_url_policy_requires_https_outside_explicit_loopback(self) -> None:
        """Reject cleartext remote, userinfo, fragments, and non-HTTP schemes."""

        self.assertEqual(
            normalize_delivery_credential_url("https://hooks.example.test/task?tenant=1"),
            "https://hooks.example.test/task?tenant=1",
        )
        self.assertEqual(
            normalize_delivery_credential_url("http://127.0.0.1:8080/task"),
            "http://127.0.0.1:8080/task",
        )
        for invalid in (
            "http://hooks.example.test/task",
            "https://user:secret@example.test/task",
            "https://hooks.example.test/task#secret",
            "file:///tmp/task",
        ):
            with self.subTest(invalid=invalid):
                with self.assertRaisesRegex(RuntimeError, "URL is invalid"):
                    normalize_delivery_credential_url(invalid)

    def test_headers_are_normalized_and_transport_headers_are_blocked(self) -> None:
        """Canonicalize application headers while preserving transport ownership."""

        self.assertEqual(
            normalize_delivery_credential_headers({
                "Authorization": "Bearer delivery-secret",
                "X-Tenant": "tenant-1",
            }),
            {
                "authorization": "Bearer delivery-secret",
                "x-tenant": "tenant-1",
            },
        )
        for blocked in ("Host", "Content-Length", "Transfer-Encoding", "Connection"):
            with self.subTest(blocked=blocked):
                with self.assertRaisesRegex(RuntimeError, "header name is invalid"):
                    normalize_delivery_credential_headers({blocked: "controlled"})
        with self.assertRaisesRegex(RuntimeError, "header name is invalid"):
            normalize_delivery_credential_headers({
                "Authorization": "first",
                "authorization": "second",
            })

    def test_decode_rejects_cross_target_fields(self) -> None:
        """Keep webhook and Discord secret fields in separate contracts."""

        with TemporaryDirectory(prefix="openxnet-delivery-scope-") as directory:
            discord = build_bootstrap(
                directory,
                "task-1",
                "discord",
                {"url": "https://hooks.example.test/wrong-zone"},
            )
            with self.assertRaisesRegex(RuntimeError, "fields are invalid"):
                decode_delivery_credential_bootstrap(discord)

    def test_decode_rejects_credentials_over_the_request_scope_budget(self) -> None:
        """Reject stored credential shapes that cannot fit one runtime request."""

        with TemporaryDirectory(prefix="openxnet-delivery-budget-") as directory:
            oversized = build_bootstrap(
                directory,
                "task-1",
                "webhook",
                {
                    "url": "https://hooks.example.test/task-1",
                    "headers": {
                        f"X-Large-{index}": "s" * (64 * 1024)
                        for index in range(3)
                    },
                },
            )
            with self.assertRaisesRegex(RuntimeError, "scope byte budget"):
                decode_delivery_credential_bootstrap(oversized)

    def test_hydration_requires_an_exact_compound_scope(self) -> None:
        """Hydrate only the requested workspace, task, and target tuple."""

        with TemporaryDirectory(prefix="openxnet-delivery-hydration-") as directory:
            workspace = str(Path(directory).resolve())
            bootstrap = build_bootstrap(
                workspace,
                "task-1",
                "webhook",
                {
                    "url": "https://hooks.example.test/task-1",
                    "headers": {"Authorization": "Bearer delivery-secret"},
                },
            )
            source = {"target": "webhook", "config": {"method": "POST"}}
            hydrated = hydrate_delivery_record(
                bootstrap,
                workspace,
                "task-1",
                "webhook",
                source,
            )
            self.assertEqual(source, {"target": "webhook", "config": {"method": "POST"}})
            self.assertEqual(hydrated["config"], {
                "method": "POST",
                "url": "https://hooks.example.test/task-1",
                "headers": {"authorization": "Bearer delivery-secret"},
            })
            for mismatch in (
                (str(Path(workspace, "other")), "task-1", "webhook"),
                (workspace, "task-2", "webhook"),
                (workspace, "task-1", "discord"),
            ):
                with self.subTest(mismatch=mismatch):
                    with self.assertRaisesRegex(RuntimeError, "scope does not match"):
                        hydrate_delivery_record(bootstrap, *mismatch, source)

    def test_empty_bootstrap_returns_a_detached_record(self) -> None:
        """Preserve credential-free targets without sharing mutable dictionaries."""

        source = {"target": "webhook", "config": {"method": "POST"}}
        hydrated = hydrate_delivery_record("", ".", "task-1", "webhook", source)
        hydrated["config"]["method"] = "PUT"
        self.assertEqual(source["config"]["method"], "POST")


if __name__ == "__main__":
    unittest.main()
