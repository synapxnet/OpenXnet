# -*- coding: utf-8 -*-
"""Tests for the versioned Python capability worker protocol."""

from __future__ import annotations

import asyncio
import json
import unittest

from py.workers import WorkerEnvelope, WorkerMessageKind, WorkerRuntime


class WorkerProtocolTests(unittest.TestCase):
    """Validate encoding, decoding, and protocol version behavior."""

    def test_round_trip_preserves_utf8_payload(self) -> None:
        """使用代码页无关的 ASCII JSON 传输并还原完整中文内容。"""

        request = WorkerEnvelope.request("voice", "synthesize", {"text": "你好，OpenXnet"})

        encoded = request.to_json_line()
        decoded = WorkerEnvelope.from_json_line(encoded)

        self.assertTrue(encoded.isascii())
        self.assertNotIn("你好，OpenXnet", encoded)
        self.assertEqual(decoded, request)

    def test_rejects_unknown_protocol_version(self) -> None:
        """Reject incompatible protocol versions before dispatching a request."""

        raw = WorkerEnvelope.request("voice", "status").to_mapping()
        raw["protocolVersion"] = "999.0"

        with self.assertRaisesRegex(ValueError, "Unsupported worker protocol version"):
            WorkerEnvelope.from_json_line(json.dumps(raw))


class WorkerRuntimeTests(unittest.IsolatedAsyncioTestCase):
    """Validate runtime dispatch without importing heavyweight dependencies."""

    async def test_dispatches_registered_handler(self) -> None:
        """Return a correlated response from a registered asynchronous handler."""

        runtime = WorkerRuntime("documents")

        async def inspect_document(payload: dict[str, object]) -> dict[str, object]:
            """Return deterministic document metadata for the dispatch test."""

            await asyncio.sleep(0)
            return {"name": payload["name"], "pages": 3}

        runtime.register_handler("inspect", inspect_document)
        request = WorkerEnvelope.request("documents", "inspect", {"name": "plan.docx"})

        response = await runtime.dispatch(request)

        self.assertEqual(response.kind, WorkerMessageKind.RESPONSE)
        self.assertEqual(response.message_id, request.message_id)
        self.assertEqual(response.payload["pages"], 3)

    async def test_returns_structured_missing_method_error(self) -> None:
        """Return a protocol error when a request targets an unknown method."""

        runtime = WorkerRuntime("voice")
        request = WorkerEnvelope.request("voice", "missing")

        response = await runtime.dispatch(request)

        self.assertEqual(response.kind, WorkerMessageKind.ERROR)
        self.assertIsNotNone(response.error)
        self.assertEqual(response.error.code, "METHOD_NOT_FOUND")


if __name__ == "__main__":
    unittest.main()
