# -*- coding: utf-8 -*-
"""Tests for the typed task execution-session protocol and legacy translation."""

from __future__ import annotations

import json
import unittest

from py.task_execution_session import (
    TASK_EXECUTION_EVENT_SCHEMA,
    TaskExecutionSessionError,
    normalize_session_messages,
    translate_legacy_execution_stream,
)


class TaskExecutionSessionProtocolTests(unittest.IsolatedAsyncioTestCase):
    """Validate bounded messages and deterministic typed stream translation."""

    async def test_translates_chunked_legacy_text_tools_and_done(self) -> None:
        """Preserve text and tool semantics across arbitrary UTF-8 chunk boundaries."""

        legacy = (
            'data: {"choices":[{"delta":{"content":"完成"}}]}\n\n'
            'data: {"choices":[{"delta":{"tool_content":{"type":"tool_result",'
            '"title":"read_file","content":"ok"}}}]}\n\n'
            "data: [DONE]\n\n"
        ).encode("utf-8")

        async def chunks():
            """Yield deliberately split bytes including multibyte character boundaries."""

            start = 0
            for boundary in (17, 43, 61, 109, len(legacy)):
                yield legacy[start:boundary]
                start = boundary

        records = [
            item
            async for item in translate_legacy_execution_stream(
                chunks(),
                "ses_translation1",
            )
        ]
        payloads = [json.loads(record[6:].strip()) for record in records]
        self.assertEqual(
            [payload["type"] for payload in payloads],
            ["text_delta", "tool_event", "done"],
        )
        self.assertEqual([payload["sequence"] for payload in payloads], [1, 2, 3])
        self.assertEqual(payloads[0]["text"], "完成")
        self.assertEqual(payloads[1]["toolType"], "tool_result")
        self.assertTrue(all(
            payload["schema"] == TASK_EXECUTION_EVENT_SCHEMA
            for payload in payloads
        ))

    async def test_provider_error_is_redacted_before_worker_delivery(self) -> None:
        """Replace a reflected provider error with one stable generic event."""

        secret = "provider-secret-value"

        async def chunks():
            """Yield one legacy error that attempts to reflect a credential."""

            yield f'data: {{"error":"{secret}"}}\n\ndata: [DONE]\n\n'

        records = [
            item
            async for item in translate_legacy_execution_stream(
                chunks(),
                "ses_redaction1",
            )
        ]
        serialized = "".join(records)
        self.assertNotIn(secret, serialized)
        self.assertIn("PROVIDER_STREAM_ERROR", serialized)

    async def test_messages_require_exact_bounded_text_fields(self) -> None:
        """Reject extra fields and non-text message payloads at the protocol boundary."""

        self.assertEqual(
            normalize_session_messages([{"role": "user", "content": "hello"}]),
            [{"role": "user", "content": "hello"}],
        )
        with self.assertRaises(TaskExecutionSessionError):
            normalize_session_messages([
                {"role": "user", "content": "hello", "api_key": "secret"},
            ])
        with self.assertRaises(TaskExecutionSessionError):
            normalize_session_messages([{"role": "tool", "content": {"raw": True}}])


if __name__ == "__main__":
    unittest.main()
