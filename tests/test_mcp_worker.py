# -*- coding: utf-8 -*-
"""验证 MCP Runtime、Worker 校验和工具结果边界。"""

from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from tempfile import TemporaryDirectory
from threading import Thread
import unittest
from unittest.mock import AsyncMock, patch

from py import mcp_tool_broker_client
from py.mcp_runtime import McpRuntimeController
from py.workers.mcp_worker import McpWorkerHandlers


class _FakeMcpClient:
    """提供不访问网络的最小 MCP 客户端。"""

    latest = None

    def __init__(self) -> None:
        """创建未就绪假客户端；无输入和返回，不产生外部副作用。"""

        type(self).latest = self
        self.is_ready = False
        self.closed = False
        self.configuration = None

    async def initialize(self, _name, configuration, on_failure_callback=None) -> None:
        """记录配置并标记就绪；输入名称、配置和回调，无返回，不调用真实 MCP。"""

        self.configuration = configuration
        self.is_ready = True

    async def wait_until_ready(self, timeout=8.0) -> None:
        """模拟等待就绪；输入超时，无返回，未就绪时抛出固定异常。"""

        if not self.is_ready:
            raise RuntimeError("not ready")

    async def close(self) -> None:
        """标记客户端关闭；无输入和返回，无外部副作用。"""

        self.closed = True
        self.is_ready = False

    async def get_openai_functions(self, disable_tools=None):
        """返回一个固定工具 schema；输入禁用名单，返回列表，无外部副作用。"""

        return [{
            "type": "function",
            "function": {
                "name": "turn_on_light",
                "description": "Turn on one light",
                "parameters": {"type": "object"},
            },
        }]

    async def call_tool(self, tool_name, tool_params):
        """返回固定工具结果；输入名称和参数，返回字典，无外部副作用。"""

        return {"tool": tool_name, "arguments": tool_params, "ok": True}


class McpRuntimeTests(unittest.IsolatedAsyncioTestCase):
    """验证 Home Assistant 与外部 Chrome MCP 生命周期和工具所有权。"""

    async def test_runtime_hydrates_credentials_and_bounds_tool_calls(self):
        """确认 Token 只进入 SDK 配置，公开状态、清单和调用结果不返回凭据。"""

        secret = "home-assistant-secret"
        with (
            patch("py.mcp_runtime.McpClient", _FakeMcpClient),
            patch(
                "py.mcp_runtime.hydrate_home_assistant_config",
                lambda value: {**value, "api_key": secret},
            ),
        ):
            controller = McpRuntimeController()
            start = await controller.start("home-assistant", {"url": "https://ha.example.test"})
            tools = await controller.list_tools("home-assistant", {"url": "https://ha.example.test"})
            called = await controller.call_tool(
                "home-assistant",
                {"url": "https://ha.example.test"},
                "turn_on_light",
                {"entity_id": "light.desk"},
            )
            self.assertTrue(start["is_running"])
            self.assertEqual(tools["tools"][0]["function"]["name"], "turn_on_light")
            self.assertTrue(called["result"]["ok"])
            self.assertNotIn(secret, str({"start": start, "tools": tools, "called": called}))
            self.assertEqual(
                _FakeMcpClient.latest.configuration["headers"]["Authorization"],
                f"Bearer {secret}",
            )
            await controller.stop("home-assistant")
            self.assertTrue(_FakeMcpClient.latest.closed)

    async def test_runtime_rejects_unknown_tools_and_secret_fields(self):
        """拒绝未声明工具与 Renderer 密钥字段，失败后不泄露配置。"""

        with (
            patch("py.mcp_runtime.McpClient", _FakeMcpClient),
            patch(
                "py.mcp_runtime.hydrate_home_assistant_config",
                lambda value: {**value, "api_key": "secret-token"},
            ),
        ):
            controller = McpRuntimeController()
            with self.assertRaises(RuntimeError):
                await controller.start(
                    "home-assistant",
                    {"url": "https://ha.example.test", "api_key": "renderer-secret"},
                )
            with self.assertRaises(ValueError):
                await controller.call_tool(
                    "home-assistant",
                    {"url": "https://ha.example.test"},
                    "unknown_tool",
                    {},
                )

    async def test_worker_handlers_enforce_exact_payloads(self):
        """确认 Worker 只接受精确字段并把合法工具请求委托给控制器。"""

        with (
            patch("py.mcp_runtime.McpClient", _FakeMcpClient),
            patch(
                "py.mcp_runtime.hydrate_home_assistant_config",
                lambda value: {**value, "api_key": "secret-token"},
            ),
        ):
            handlers = McpWorkerHandlers(McpRuntimeController())
            result = await handlers.list_tools({
                "integration": "home-assistant",
                "configuration": {"url": "https://ha.example.test"},
            })
            self.assertEqual(result["tools"][0]["function"]["name"], "turn_on_light")
            with self.assertRaises(ValueError):
                await handlers.call_tool({
                    "integration": "home-assistant",
                    "configuration": {"url": "https://ha.example.test"},
                    "toolName": "turn_on_light",
                    "arguments": {},
                    "extra": True,
                })

    async def test_external_chrome_uses_pinned_package_and_minimal_child_environment(self):
        """确认外部 Chrome 使用 lockfile 本地入口，且第三方子进程不会继承 OpenXnet 或 Provider 凭据。"""

        with TemporaryDirectory() as directory:
            runtime_root = (Path(directory) / "node-runtime").resolve()
            for entrypoint in (
                Path("node_modules") / "@browsermcp" / "mcp" / "dist" / "index.js",
                Path("node_modules") / "@playwright" / "mcp" / "cli.js",
            ):
                path = runtime_root / entrypoint
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("// test entry\n", encoding="utf-8")
            environment = {
                "OPENXNET_USER_DATA_DIR": directory,
                "OPENXNET_HOME_ASSISTANT_CREDENTIALS_B64": "home-assistant-secret",
                "OPENAI_API_KEY": "provider-secret",
                "PATH": os.environ.get("PATH", ""),
                "TEMP": directory,
            }
            with (
                patch.dict(os.environ, environment, clear=True),
                patch("py.mcp_runtime.McpClient", _FakeMcpClient),
                patch(
                    "py.mcp_runtime.prepare_external_chrome_node_runtime",
                    AsyncMock(return_value=runtime_root),
                ),
                patch(
                    "py.mcp_runtime._resolve_external_chrome_node_runtime_directory",
                    return_value=runtime_root,
                ),
                patch(
                    "py.mcp_runtime._resolve_node_npm_runtime",
                    return_value=("C:\\runtime\\node.exe", "C:\\runtime\\npm-cli.js", False),
                ),
            ):
                controller = McpRuntimeController()
                result = await controller.start(
                    "chrome-external",
                    {"mcpName": "browser-mcp"},
                )
                client_configuration = _FakeMcpClient.latest.configuration
                self.assertTrue(result["is_running"])
                self.assertEqual(
                    client_configuration["args"],
                    [str((runtime_root / "node_modules" / "@browsermcp" / "mcp" / "dist" / "index.js").resolve())],
                )
                serialized_environment = json.dumps(client_configuration["env"])
                self.assertNotIn("home-assistant-secret", serialized_environment)
                self.assertNotIn("provider-secret", serialized_environment)
                self.assertNotIn("OPENXNET_", serialized_environment)
                await controller.stop("chrome-external")
            with self.assertRaises(RuntimeError):
                await McpRuntimeController().start(
                    "chrome-external",
                    {"mcpName": "untrusted-package"},
                )

    async def test_sql_runtime_uses_authorization_metadata_and_minimal_child_environment(self):
        """确认 SQL 只用授权元数据启动，并且子进程环境不继承其他 OpenXnet 或 Provider 凭据。"""

        sql_configuration = {
            "command": "C:\\runtime\\mcp-worker.exe",
            "args": ["--sql-server"],
            "env": {
                "DB_URL": "postgresql+psycopg2://openxnet:database-secret@127.0.0.1:5432/workspace",
                "PYTHONUTF8": "1",
            },
        }
        with (
            patch("py.mcp_runtime.McpClient", _FakeMcpClient),
            patch(
                "py.mcp_runtime.build_sql_stdio_configuration",
                return_value=sql_configuration,
            ),
        ):
            controller = McpRuntimeController()
            result = await controller.start(
                "sql",
                {
                    "engine": "postgres",
                    "user": "openxnet",
                    "host": "127.0.0.1",
                    "port": 5432,
                    "dbname": "workspace",
                },
            )
            self.assertTrue(result["is_running"])
            self.assertEqual(_FakeMcpClient.latest.configuration, sql_configuration)
            self.assertNotIn("password", json.dumps(result))
            await controller.stop("sql")

    async def test_generic_runtime_hydrates_private_headers_and_isolates_servers(self):
        """确认动态 Server 使用独立连接，认证头只在 Worker 内补齐，公开结果不返回密钥。"""

        secret = "generic-mcp-secret"

        def hydrate(server_id, configuration):
            """模拟 scope 凭据补齐；输入 scope 和配置，返回带私有认证头的新对象。"""

            return {
                **configuration,
                "headers": {
                    **configuration.get("headers", {}),
                    "Authorization": f"Bearer {secret}-{server_id}",
                },
            }

        with (
            patch("py.mcp_runtime.McpClient", _FakeMcpClient),
            patch("py.mcp_runtime.hydrate_mcp_runtime_server_config", hydrate),
        ):
            controller = McpRuntimeController()
            first = await controller.start(
                "generic:docs",
                {
                    "transport": "sse",
                    "url": "https://mcp.example.test/sse",
                    "headers": {"Accept": "text/event-stream"},
                },
            )
            first_client = _FakeMcpClient.latest
            second = await controller.start(
                "generic:issues",
                {
                    "transport": "streamable-http",
                    "url": "https://issues.example.test/mcp",
                },
            )
            second_client = _FakeMcpClient.latest
            self.assertTrue(first["is_running"])
            self.assertTrue(second["is_running"])
            self.assertIsNot(first_client, second_client)
            self.assertEqual(first_client.configuration["type"], "sse")
            self.assertEqual(second_client.configuration["type"], "streamablehttp")
            self.assertEqual(
                first_client.configuration["headers"]["Authorization"],
                f"Bearer {secret}-docs",
            )
            self.assertNotIn(secret, json.dumps({"first": first, "second": second}))
            await controller.close()

        with self.assertRaises(RuntimeError):
            await McpRuntimeController().start(
                "generic:unsafe",
                {"transport": "sse", "url": "http://mcp.example.test/sse"},
            )

    async def test_desktop_server_spec_excludes_mcp_sql_worker_payloads(self) -> None:
        """确认基础 Desktop 冻结包排除 MCP transport、SQL Worker、ORM 和数据库驱动。"""

        project_root = Path(__file__).resolve().parents[1]
        spec_source = (project_root / "server.spec").read_text(encoding="utf-8")
        requirements = (project_root / "requirements-mcp.txt").read_text(encoding="utf-8").lower()
        server_source = (project_root / "server.py").read_text(encoding="utf-8")
        route_source = (project_root / "py" / "routes" / "mcp_control.py").read_text(
            encoding="utf-8",
        )
        main_source = (project_root / "main.js").read_text(encoding="utf-8")
        for module_name in (
            "fastapi_mcp",
            "greenlet",
            "httpx_sse",
            "httpx_ws",
            "mcp",
            "mcp_alchemy",
            "oracledb",
            "psycopg2",
            "pymssql",
            "pymysql",
            "py.mcp_clients",
            "py.mcp_runtime",
            "sqlalchemy",
            "sse_starlette",
            "py.workers.mcp_worker",
        ):
            self.assertIn(f"'{module_name}'", spec_source)
        for distribution_name in (
            "mcp-alchemy",
            "oracledb",
            "psycopg2-binary",
            "pymssql",
            "pymysql",
            "sqlalchemy",
        ):
            self.assertIn(distribution_name, requirements)
        self.assertNotIn("from fastapi_mcp import", server_source)
        self.assertNotIn("from py.mcp_clients import", server_source)
        self.assertNotIn("from py.mcp_clients import", route_source)
        self.assertNotIn("from py.mcp_runtime import", route_source)
        self.assertIn('if RUNTIME_PROFILE != "server":', server_source)
        legacy_launch = main_source[
            main_source.index("async function startBackend"):
            main_source.index("async function waitForBackend")
        ]
        for credential_name in (
            "OPENXNET_MCP_CREDENTIALS_B64",
            "OPENXNET_HOME_ASSISTANT_CREDENTIALS_B64",
            "OPENXNET_SQL_CREDENTIALS_B64",
        ):
            self.assertNotIn(credential_name, legacy_launch)

class _BrokerHandler(BaseHTTPRequestHandler):
    """模拟 Main 私有 MCP Tool Broker。"""

    def do_POST(self) -> None:
        """处理鉴权工具请求；无显式输入和返回，把固定 JSON 写入测试连接。"""

        length = int(self.headers.get("Content-Length", "0"))
        payload = json.loads(self.rfile.read(length).decode("utf-8"))
        if self.headers.get("Authorization") != "Bearer broker-test-token-1234":
            self.send_response(401)
            self.end_headers()
            return
        integration = payload["integration"]
        if self.path.endswith("/list"):
            tool_name = {
                "generic:docs": "search_docs",
                "generic:issues": "search_issues",
            }.get(integration, "turn_on_light")
            body = {"integration": integration, "tools": [{
                "type": "function",
                "function": {
                    "name": tool_name,
                    "description": "Turn on one light",
                    "parameters": {"type": "object"},
                },
            }]}
        else:
            body = {
                "integration": integration,
                "toolName": payload["toolName"],
                "result": {"ok": True},
            }
        encoded = json.dumps(body).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def log_message(self, _format: str, *_args) -> None:
        """禁用测试 HTTP 日志；输入格式和参数，无返回和副作用。"""


class McpToolBrokerClientTests(unittest.IsolatedAsyncioTestCase):
    """验证 Execution Engine 私有 Broker 客户端。"""

    async def test_client_lists_and_calls_only_declared_tools(self):
        """通过真实回环 HTTP 验证 bearer、工具缓存和有界调用结果。"""

        server = ThreadingHTTPServer(("127.0.0.1", 0), _BrokerHandler)
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        origin = f"http://127.0.0.1:{server.server_address[1]}"
        mcp_tool_broker_client._reset_mcp_tool_broker_cache_for_tests()
        try:
            with patch.dict(os.environ, {
                mcp_tool_broker_client.MCP_TOOL_BROKER_ORIGIN_ENV: origin,
                mcp_tool_broker_client.MCP_TOOL_BROKER_TOKEN_ENV: "broker-test-token-1234",
            }):
                tools = await mcp_tool_broker_client.list_home_assistant_tools({
                    "url": "https://ha.example.test",
                })
                result = await mcp_tool_broker_client.call_home_assistant_tool(
                    {"url": "https://ha.example.test"},
                    "turn_on_light",
                    {"entity_id": "light.desk"},
                )
                chrome_tools = await mcp_tool_broker_client.list_external_chrome_tools({
                    "mcpName": "playwright-mcp",
                })
                chrome_result = await mcp_tool_broker_client.call_external_chrome_tool(
                    {"mcpName": "playwright-mcp"},
                    "turn_on_light",
                    {"page": 1},
                )
                sql_configuration = {
                    "engine": "sqlite",
                    "databaseId": "00000000-0000-4000-8000-000000000001",
                }
                sql_tools = await mcp_tool_broker_client.list_sql_tools(sql_configuration)
                sql_result = await mcp_tool_broker_client.call_sql_tool(
                    sql_configuration,
                    "turn_on_light",
                    {"query": "SELECT 1"},
                )
                generic_configuration = {
                    "transport": "sse",
                    "url": "https://mcp.example.test/sse",
                }
                docs_tools = await mcp_tool_broker_client.list_generic_mcp_tools(
                    "docs",
                    generic_configuration,
                )
                docs_result = await mcp_tool_broker_client.call_generic_mcp_tool(
                    "docs",
                    generic_configuration,
                    "search_docs",
                    {"query": "broker"},
                )
                issues_tools = await mcp_tool_broker_client.list_generic_mcp_tools(
                    "issues",
                    {
                        "transport": "streamable-http",
                        "url": "https://issues.example.test/mcp",
                    },
                )
            self.assertEqual(tools[0]["function"]["name"], "turn_on_light")
            self.assertEqual(result, {"ok": True})
            self.assertEqual(chrome_tools[0]["function"]["name"], "turn_on_light")
            self.assertEqual(chrome_result, {"ok": True})
            self.assertEqual(sql_tools[0]["function"]["name"], "turn_on_light")
            self.assertEqual(sql_result, {"ok": True})
            self.assertEqual(docs_tools[0]["function"]["name"], "search_docs")
            self.assertEqual(docs_result, {"ok": True})
            self.assertEqual(issues_tools[0]["function"]["name"], "search_issues")
            self.assertTrue(mcp_tool_broker_client.is_home_assistant_tool("turn_on_light"))
            self.assertTrue(mcp_tool_broker_client.is_external_chrome_tool("turn_on_light"))
            self.assertTrue(mcp_tool_broker_client.is_sql_tool("turn_on_light"))
            self.assertTrue(mcp_tool_broker_client.is_generic_mcp_tool("docs", "search_docs"))
            self.assertFalse(mcp_tool_broker_client.is_generic_mcp_tool("docs", "search_issues"))
            self.assertTrue(mcp_tool_broker_client.is_generic_mcp_tool("issues", "search_issues"))
        finally:
            await asyncio.to_thread(server.shutdown)
            server.server_close()
            thread.join(timeout=2)


if __name__ == "__main__":
    unittest.main()
