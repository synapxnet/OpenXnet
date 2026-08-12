# -*- coding: utf-8 -*-
"""Security regression coverage for bounded task delivery webhooks."""

from __future__ import annotations

from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, patch

from py.delivery import (
    MAX_DELIVERY_RESPONSE_BYTES,
    _build_delivery_payload,
    _deliver_discord,
    _deliver_webhook,
    _send_delivery_webhook,
)


class FakeStreamResponse:
    """Synthetic streaming response with a configurable byte sequence."""

    def __init__(
        self,
        status_code: int = 204,
        chunks: tuple[bytes, ...] = (b"accepted",),
        content_length: int | None = None,
    ) -> None:
        """Create one bounded response test double."""

        self.status_code = status_code
        self._chunks = chunks
        self.headers = (
            {} if content_length is None else {"content-length": str(content_length)}
        )

    async def aiter_bytes(self):
        """Yield response bytes without offering a decoded body API."""

        for chunk in self._chunks:
            yield chunk


class FakeStreamContext:
    """Async context manager wrapping one synthetic response."""

    def __init__(self, response: FakeStreamResponse) -> None:
        """Bind the response returned on context entry."""

        self._response = response

    async def __aenter__(self) -> FakeStreamResponse:
        """Return the configured response."""

        return self._response

    async def __aexit__(self, *_arguments: object) -> None:
        """Close the synthetic response without side effects."""

        return None


class FakeAsyncClient:
    """Capture webhook client options and outbound request fields."""

    instances: list["FakeAsyncClient"] = []
    response = FakeStreamResponse()

    def __init__(self, **options: object) -> None:
        """Record client construction options for redirect assertions."""

        self.options = options
        self.request: dict[str, object] = {}
        self.__class__.instances.append(self)

    async def __aenter__(self) -> "FakeAsyncClient":
        """Return this synthetic client."""

        return self

    async def __aexit__(self, *_arguments: object) -> None:
        """Close the synthetic client without side effects."""

        return None

    def stream(self, method: str, url: str, **options: object) -> FakeStreamContext:
        """Capture one request and return the configured stream response."""

        self.request = {"method": method, "url": url, **options}
        return FakeStreamContext(self.__class__.response)


class DeliveryWebhookSecurityTests(unittest.IsolatedAsyncioTestCase):
    """Validate no-redirect requests, byte budgets, and fixed public errors."""

    def setUp(self) -> None:
        """Reset captured synthetic HTTP clients between tests."""

        FakeAsyncClient.instances = []
        FakeAsyncClient.response = FakeStreamResponse()

    def test_delivery_payload_never_contains_target_configuration(self) -> None:
        """Build an external payload without URL or header credential fields."""

        task = SimpleNamespace(
            task_id="task-1",
            title="Secure delivery",
            description="Verify payload boundaries.",
            status="completed",
            result="done",
            error="",
            progress=100,
            created_at="2026-07-27T10:00:00",
            completed_at="2026-07-27T10:01:00",
            context={"schedule_type": "manual"},
        )
        payload = _build_delivery_payload(task, {
            "target": "webhook",
            "config": {
                "url": "https://hooks.example.test/secret",
                "headers": {"authorization": "Bearer delivery-secret"},
            },
        })
        serialized = str(payload)
        self.assertNotIn("delivery-secret", serialized)
        self.assertNotIn("hooks.example.test", serialized)
        self.assertNotIn("delivery_config", payload)

    async def test_webhook_disables_redirects_and_uses_bounded_streaming(self) -> None:
        """Send one normalized request without enabling redirect following."""

        with patch("httpx.AsyncClient", FakeAsyncClient):
            status = await _send_delivery_webhook(
                "POST",
                "https://hooks.example.test/task-1",
                {"task_id": "task-1"},
                {"Authorization": "Bearer delivery-secret"},
            )
        self.assertEqual(status, 204)
        client = FakeAsyncClient.instances[0]
        self.assertIs(client.options["follow_redirects"], False)
        self.assertEqual(client.request["headers"], {
            "authorization": "Bearer delivery-secret",
        })
        self.assertEqual(client.request["method"], "POST")

    async def test_webhook_rejects_declared_and_streamed_oversized_responses(self) -> None:
        """Stop consuming responses once either size budget is exceeded."""

        FakeAsyncClient.response = FakeStreamResponse(
            content_length=MAX_DELIVERY_RESPONSE_BYTES + 1,
        )
        with patch("httpx.AsyncClient", FakeAsyncClient):
            with self.assertRaisesRegex(RuntimeError, "response exceeds"):
                await _send_delivery_webhook(
                    "POST",
                    "https://hooks.example.test/task-1",
                    {"task_id": "task-1"},
                )
        FakeAsyncClient.response = FakeStreamResponse(
            chunks=(b"a" * MAX_DELIVERY_RESPONSE_BYTES, b"b"),
        )
        with patch("httpx.AsyncClient", FakeAsyncClient):
            with self.assertRaisesRegex(RuntimeError, "response exceeds"):
                await _send_delivery_webhook(
                    "POST",
                    "https://hooks.example.test/task-1",
                    {"task_id": "task-1"},
                )

    async def test_adapter_does_not_reflect_transport_errors_or_secret_headers(self) -> None:
        """Return one fixed failure when the transport raises secret-shaped text."""

        secret = "Bearer delivery-secret"
        transport = AsyncMock(side_effect=RuntimeError(secret))
        with patch("py.delivery._send_delivery_webhook", transport):
            result = await _deliver_webhook(
                {"task_id": "task-1", "_settings": {"api_key": "other-zone"}},
                {
                    "target": "webhook",
                    "config": {
                        "url": "https://hooks.example.test/task-1",
                        "headers": {"authorization": secret},
                    },
                },
            )
        self.assertEqual(result, {
            "success": False,
            "error": "Webhook delivery request failed",
        })
        outbound_payload = transport.await_args.args[2]
        self.assertNotIn("_settings", outbound_payload)
        self.assertNotIn(secret, str(result))

    async def test_discord_webhook_uses_the_shared_hardened_transport(self) -> None:
        """Route Discord webhooks through the same bounded no-body helper."""

        transport = AsyncMock(return_value=204)
        with patch("py.delivery._send_delivery_webhook", transport):
            result = await _deliver_discord(
                {
                    "task_id": "task-1",
                    "title": "Discord delivery",
                    "status": "completed",
                    "result": "done",
                    "_settings": {"api_key": "other-zone"},
                },
                {
                    "target": "discord",
                    "config": {
                        "webhook_url": "https://discord.example.test/task-1",
                    },
                },
            )
        self.assertEqual(result, {"success": True, "method": "discord_webhook"})
        self.assertEqual(transport.await_args.args[0:2], (
            "POST",
            "https://discord.example.test/task-1",
        ))
        outbound_payload = transport.await_args.args[2]
        self.assertEqual(set(outbound_payload), {"content"})
        self.assertNotIn("other-zone", str(outbound_payload))


if __name__ == "__main__":
    unittest.main()
