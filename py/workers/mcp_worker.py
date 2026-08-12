# -*- coding: utf-8 -*-
"""独立 MCP Worker，持有集成连接并执行有界工具操作。"""

from __future__ import annotations

import argparse
import asyncio
from collections.abc import Mapping
import importlib
import json
import os
import sys
from typing import Any

from py.mcp_runtime import MAX_MCP_CONFIGURATION_BYTES, McpRuntimeController
from py.workers.runtime import WorkerRuntime


MCP_DEPENDENCY_MODULES = (
    "anyio",
    "httpx",
    "mcp",
    "mcp_alchemy",
    "oracledb",
    "psycopg2",
    "pydantic",
    "pymssql",
    "pymysql",
    "sqlalchemy",
)


class McpWorkerHandlers:
    """校验 MCP Worker 请求并委托框架无关控制器。"""

    def __init__(self, controller: McpRuntimeController) -> None:
        """保存控制器；输入运行时控制器，无返回，不启动任何 MCP 连接。"""

        self._controller = controller

    async def status(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """查询集成状态；输入精确集成字段，返回安全状态，字段无效时抛出 ValueError。"""

        return await self._controller.status(self._read_integration(payload, allow_configuration=False))

    def dependencies(self, _payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """离线检查 Pack 依赖；忽略输入，返回模块可用性，导入失败只标记为 False。"""

        available: dict[str, bool] = {}
        for module_name in MCP_DEPENDENCY_MODULES:
            try:
                importlib.import_module(module_name)
                available[module_name] = True
            except ImportError:
                available[module_name] = False
        return {"dependencies": available}

    async def start(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """启动集成；输入集成和无密钥配置，返回安全状态，连接失败由控制器固定脱敏。"""

        integration, configuration = self._read_integration_configuration(payload)
        return await self._controller.start(integration, configuration)

    async def stop(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """停止集成；输入精确集成字段，返回安全状态，清理由控制器隔离。"""

        return await self._controller.stop(self._read_integration(payload, allow_configuration=False))

    async def list_tools(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """列出集成工具；输入集成和无密钥配置，返回有界 schema，连接或校验失败时抛出固定异常。"""

        integration, configuration = self._read_integration_configuration(payload)
        return await self._controller.list_tools(integration, configuration)

    async def call_tool(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """调用集成工具；输入精确调用载荷，返回有界结果，未知字段或工具时抛出 ValueError。"""

        if set(payload) != {"integration", "configuration", "toolName", "arguments"}:
            raise ValueError("MCP tool call fields are invalid.")
        integration = self._read_integration(payload, allow_configuration=True)
        configuration = self._read_configuration(payload.get("configuration"))
        tool_name = payload.get("toolName")
        arguments = payload.get("arguments")
        if not isinstance(tool_name, str) or not isinstance(arguments, Mapping):
            raise ValueError("MCP tool call is invalid.")
        return await self._controller.call_tool(
            integration,
            configuration,
            tool_name,
            dict(arguments),
        )

    def _read_integration_configuration(
        self,
        payload: Mapping[str, Any],
    ) -> tuple[str, dict[str, Any]]:
        """读取生命周期载荷；输入 Worker 映射，返回集成和配置，额外字段或类型无效时抛出 ValueError。"""

        if set(payload) != {"integration", "configuration"}:
            raise ValueError("MCP integration request fields are invalid.")
        return (
            self._read_integration(payload, allow_configuration=True),
            self._read_configuration(payload.get("configuration")),
        )

    def _read_integration(self, payload: Mapping[str, Any], *, allow_configuration: bool) -> str:
        """读取集成标识；输入载荷和字段策略，返回名称，字段集合或类型无效时抛出 ValueError。"""

        if "integration" not in payload:
            raise ValueError("MCP integration request fields are invalid.")
        if not allow_configuration and set(payload) != {"integration"}:
            raise ValueError("MCP integration request fields are invalid.")
        integration = payload.get("integration")
        if not isinstance(integration, str):
            raise ValueError("MCP integration is invalid.")
        return integration

    def _read_configuration(self, value: Any) -> dict[str, Any]:
        """读取有界配置；输入未知值，返回配置副本，类型或字节预算无效时抛出 ValueError。"""

        if not isinstance(value, Mapping):
            raise ValueError("MCP integration configuration must be an object.")
        detached = dict(value)
        if len(json.dumps(detached, ensure_ascii=False).encode("utf-8")) > MAX_MCP_CONFIGURATION_BYTES:
            raise ValueError("MCP integration configuration exceeds the size limit.")
        return detached


def parse_arguments() -> argparse.Namespace:
    """解析 Worker 命令行参数；无输入，返回参数对象，无效参数由 argparse 终止进程。"""

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sql-server", action="store_true")
    return parser.parse_args()


def configure_utf8_standard_streams() -> None:
    """把冻结或解释器标准流固定为 UTF-8/LF；无输入和返回，不支持 reconfigure 的流保持原样。"""

    for stream in (sys.stdin, sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            reconfigure(encoding="utf-8", errors="strict", newline="\n")


async def run() -> None:
    """运行 MCP Worker RPC；无输入和返回，退出时始终关闭全部连接并隔离普通标准输出。"""

    arguments = parse_arguments()
    configure_utf8_standard_streams()
    if arguments.sql_server:
        await run_sql_server()
        return
    protocol_output = sys.stdout
    sys.stdout = sys.stderr
    runtime = WorkerRuntime("mcp", output=protocol_output)
    controller = McpRuntimeController()
    handlers = McpWorkerHandlers(controller)
    runtime.register_handler("mcp.status", handlers.status)
    runtime.register_handler("mcp.dependencies", handlers.dependencies)
    runtime.register_handler("mcp.integration.start", handlers.start)
    runtime.register_handler("mcp.integration.stop", handlers.stop)
    runtime.register_handler("mcp.tools.list", handlers.list_tools)
    runtime.register_handler("mcp.tools.call", handlers.call_tool)
    try:
        await runtime.serve_stdio()
    finally:
        await controller.close()


async def run_sql_server() -> None:
    """运行同包 mcp-alchemy stdio 服务；无输入和返回，缺少 DB_URL 或依赖时让子进程失败并由父 Worker 脱敏。"""

    if not str(os.environ.get("DB_URL") or "").strip():
        raise RuntimeError("SQL MCP database configuration is missing.")
    from mcp_alchemy.server import mcp

    await mcp.run_stdio_async()


if __name__ == "__main__":
    asyncio.run(run())
