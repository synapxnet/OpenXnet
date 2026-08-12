# -*- coding: utf-8 -*-
"""验证直接 A2A 客户端的协议兼容、响应预算和端点安全边界。"""

from __future__ import annotations

import json
import unittest

import httpx

from py.a2a_client import (
    A2AClientError,
    MAX_A2A_RESPONSE_BYTES,
    ask_a2a_agent,
    inspect_a2a_agent,
    normalize_a2a_endpoint,
)


class DirectA2AClientTests(unittest.IsolatedAsyncioTestCase):
    """验证不依赖 python-a2a 的卡片探测和文本消息调用。"""

    async def test_inspect_projects_bounded_public_agent_card(self) -> None:
        """确认卡片探测裁剪公开字段；输入含认证字段的卡片，返回值不包含认证信息。"""

        requested_paths: list[str] = []

        def handle(request: httpx.Request) -> httpx.Response:
            """返回固定 Agent Card；输入 Mock 请求，记录路径并生成 JSON 响应。"""

            requested_paths.append(request.url.path)
            return httpx.Response(200, json={
                "name": "A2A Test",
                "description": "Direct client",
                "version": "1.0",
                "authentication": {"token": "secret"},
                "skills": [{
                    "id": "echo",
                    "name": "Echo",
                    "description": "Echo text",
                    "tags": ["test", "test"],
                    "examples": ["hello"],
                }],
            })

        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
            card = await inspect_a2a_agent("http://127.0.0.1:8080", client=client)
        self.assertEqual(requested_paths, ["/.well-known/agent-card.json"])
        self.assertEqual(card["name"], "A2A Test")
        self.assertEqual(card["skills"][0]["tags"], ["test"])
        self.assertNotIn("authentication", card)
        self.assertNotIn("secret", json.dumps(card))

    async def test_ask_uses_modern_message_send_contract(self) -> None:
        """确认现代调用发送 message/send；输入问题，返回 result.parts 中的文本。"""

        requests: list[dict] = []

        def handle(request: httpx.Request) -> httpx.Response:
            """校验现代请求并返回文本；输入 Mock 请求，记录 JSON 载荷。"""

            requests.append(json.loads(request.content))
            return httpx.Response(200, json={
                "jsonrpc": "2.0",
                "result": {
                    "kind": "message",
                    "parts": [{"kind": "text", "text": "pong"}],
                },
            })

        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
            result = await ask_a2a_agent("https://agent.example.test", "ping", client=client)
        self.assertEqual(result, "pong")
        self.assertEqual(requests[0]["method"], "message/send")
        self.assertEqual(requests[0]["params"]["message"]["parts"][0]["text"], "ping")

    async def test_ask_falls_back_once_for_legacy_validation_response(self) -> None:
        """确认 422 现代协议失败后只回退一次旧消息；输入问题，返回 legacy content 文本。"""

        requests: list[dict] = []

        def handle(request: httpx.Request) -> httpx.Response:
            """先返回协议校验失败再返回旧格式；输入 Mock 请求，按调用次数生成响应。"""

            payload = json.loads(request.content)
            requests.append(payload)
            if "jsonrpc" in payload:
                return httpx.Response(422, json={"detail": "legacy"})
            return httpx.Response(200, json={
                "role": "agent",
                "content": {"type": "text", "text": "legacy-pong"},
            })

        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
            result = await ask_a2a_agent("http://localhost:5000/a2a", "ping", client=client)
        self.assertEqual(result, "legacy-pong")
        self.assertEqual(len(requests), 2)
        self.assertEqual(requests[1]["content"]["text"], "ping")

    async def test_response_budget_rejects_oversized_body(self) -> None:
        """拒绝超过 1 MiB 的 A2A 响应；输入超限正文，抛出固定客户端异常。"""

        def handle(_request: httpx.Request) -> httpx.Response:
            """返回超限正文；输入请求被忽略，输出超出预算的 JSON 字节。"""

            return httpx.Response(
                200,
                content=b'{' + b'"x":"' + b'x' * MAX_A2A_RESPONSE_BYTES + b'"}',
            )

        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
            with self.assertRaises(A2AClientError):
                await ask_a2a_agent("http://127.0.0.1:8080", "ping", client=client)

    def test_endpoint_policy_allows_https_or_loopback_without_credentials(self) -> None:
        """验证端点策略；输入 HTTPS 或回环 URL 时返回规范值，外部 HTTP、凭据和查询会被拒绝。"""

        self.assertEqual(
            normalize_a2a_endpoint("https://agent.example.test/a2a/"),
            "https://agent.example.test/a2a",
        )
        self.assertEqual(
            normalize_a2a_endpoint("http://[::1]:8080/a2a"),
            "http://[::1]:8080/a2a",
        )
        for endpoint in (
            "http://agent.example.test",
            "ftp://agent.example.test",
            "https://user:password@agent.example.test",
            "https://agent.example.test?token=secret",
        ):
            with self.subTest(endpoint=endpoint), self.assertRaises(A2AClientError):
                normalize_a2a_endpoint(endpoint)


if __name__ == "__main__":
    unittest.main()
