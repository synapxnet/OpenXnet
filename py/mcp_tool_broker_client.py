# -*- coding: utf-8 -*-
"""Execution Engine 专用的私有 MCP Tool Broker 客户端。"""

from __future__ import annotations

from collections.abc import Mapping
import json
import os
from typing import Any
from urllib.parse import urlsplit

import httpx


MCP_TOOL_BROKER_ORIGIN_ENV = "OPENXNET_MCP_TOOL_BROKER_ORIGIN"
MCP_TOOL_BROKER_TOKEN_ENV = "OPENXNET_MCP_TOOL_BROKER_TOKEN"
MCP_TOOL_LIST_PATH = "/v1/mcp/tools/list"
MCP_TOOL_CALL_PATH = "/v1/mcp/tools/call"
HOME_ASSISTANT_INTEGRATION = "home-assistant"
EXTERNAL_CHROME_INTEGRATION = "chrome-external"
SQL_INTEGRATION = "sql"
GENERIC_MCP_INTEGRATION_PREFIX = "generic:"
SUPPORTED_MCP_INTEGRATIONS = frozenset({
    HOME_ASSISTANT_INTEGRATION,
    EXTERNAL_CHROME_INTEGRATION,
    SQL_INTEGRATION,
})
MAX_MCP_BROKER_RESPONSE_BYTES = 2 * 1024 * 1024

_integration_tool_names: dict[str, frozenset[str]] = {}


class McpToolBrokerError(RuntimeError):
    """表示私有 MCP Broker 配置、传输或响应失败，消息固定且不包含上游诊断。"""


def has_private_mcp_tool_broker() -> bool:
    """判断当前进程是否配置完整私有 Broker；无输入，返回布尔值，不打开连接。"""

    return bool(
        str(os.environ.get(MCP_TOOL_BROKER_ORIGIN_ENV, "")).strip()
        and str(os.environ.get(MCP_TOOL_BROKER_TOKEN_ENV, "")).strip()
    )


async def list_home_assistant_tools(configuration: Mapping[str, Any]) -> list[dict[str, Any]]:
    """列出 Home Assistant 工具；输入无密钥配置，返回有界 OpenAI schema，失败时抛出固定 Broker 异常。"""

    return await list_mcp_integration_tools(HOME_ASSISTANT_INTEGRATION, configuration)


async def list_external_chrome_tools(configuration: Mapping[str, Any]) -> list[dict[str, Any]]:
    """列出外部 Chrome MCP 工具；输入固定实现选择，返回有界 OpenAI schema，失败时抛出固定 Broker 异常。"""

    return await list_mcp_integration_tools(EXTERNAL_CHROME_INTEGRATION, configuration)


async def list_sql_tools(configuration: Mapping[str, Any]) -> list[dict[str, Any]]:
    """列出 SQL MCP 工具；输入无密钥连接元数据，返回有界 OpenAI schema，失败时抛出固定 Broker 异常。"""

    return await list_mcp_integration_tools(SQL_INTEGRATION, configuration)


async def list_generic_mcp_tools(
    server_id: str,
    configuration: Mapping[str, Any],
) -> list[dict[str, Any]]:
    """列出一个通用 MCP Server 工具；输入 scope 和无密钥配置，返回有界 schema，失败时抛出固定异常。"""

    return await list_mcp_integration_tools(_build_generic_integration(server_id), configuration)


async def list_mcp_integration_tools(
    integration: str,
    configuration: Mapping[str, Any],
) -> list[dict[str, Any]]:
    """列出一个允许集成的工具；输入集成与无密钥配置，返回有界 schema，并更新该集成独立工具缓存。"""

    normalized = _validate_integration(integration)
    payload = await _request_broker(MCP_TOOL_LIST_PATH, {
        "integration": normalized,
        "configuration": dict(configuration),
    })
    if payload.get("integration") != normalized or set(payload) != {"integration", "tools"}:
        raise McpToolBrokerError("MCP Tool Broker returned an invalid tool list.")
    tools = payload.get("tools")
    if not isinstance(tools, list) or len(tools) > 512:
        raise McpToolBrokerError("MCP Tool Broker returned an invalid tool list.")
    detached = json.loads(json.dumps(tools, ensure_ascii=False))
    names: set[str] = set()
    for tool in detached:
        function = tool.get("function") if isinstance(tool, dict) else None
        name = function.get("name") if isinstance(function, dict) else None
        if not isinstance(name, str) or not name.strip() or len(name) > 128:
            raise McpToolBrokerError("MCP Tool Broker returned an invalid tool schema.")
        names.add(name.strip())
    _integration_tool_names[normalized] = frozenset(names)
    return detached


def is_home_assistant_tool(tool_name: str) -> bool:
    """判断名称是否属于最近一次 Home Assistant 清单；输入工具名，返回布尔值，无网络请求。"""

    return is_mcp_integration_tool(HOME_ASSISTANT_INTEGRATION, tool_name)


def is_external_chrome_tool(tool_name: str) -> bool:
    """判断名称是否属于最近一次外部 Chrome MCP 清单；输入工具名，返回布尔值，无网络请求。"""

    return is_mcp_integration_tool(EXTERNAL_CHROME_INTEGRATION, tool_name)


def is_sql_tool(tool_name: str) -> bool:
    """判断名称是否属于最近一次 SQL 工具清单；输入工具名，返回布尔值，无网络请求。"""

    return is_mcp_integration_tool(SQL_INTEGRATION, tool_name)


def is_generic_mcp_tool(server_id: str, tool_name: str) -> bool:
    """判断名称是否属于指定通用 Server 清单；输入 scope 和工具名，返回布尔值，无网络请求。"""

    return is_mcp_integration_tool(_build_generic_integration(server_id), tool_name)


def is_mcp_integration_tool(integration: str, tool_name: str) -> bool:
    """查询一个集成的工具缓存；输入集成和名称，返回布尔值，不打开网络连接。"""

    normalized = _validate_integration(integration)
    return isinstance(tool_name, str) and tool_name in _integration_tool_names.get(normalized, frozenset())


async def ensure_home_assistant_tool(
    configuration: Mapping[str, Any],
    tool_name: str,
) -> bool:
    """确认工具是否属于 Home Assistant；输入配置和名称，返回布尔值，缓存未命中时刷新一次有界清单。"""

    return await ensure_mcp_integration_tool(
        HOME_ASSISTANT_INTEGRATION,
        configuration,
        tool_name,
    )


async def ensure_external_chrome_tool(
    configuration: Mapping[str, Any],
    tool_name: str,
) -> bool:
    """确认工具是否属于外部 Chrome MCP；输入配置和名称，返回布尔值，缓存未命中时刷新一次清单。"""

    return await ensure_mcp_integration_tool(
        EXTERNAL_CHROME_INTEGRATION,
        configuration,
        tool_name,
    )


async def ensure_sql_tool(
    configuration: Mapping[str, Any],
    tool_name: str,
) -> bool:
    """确认工具是否属于 SQL MCP；输入配置和名称，返回布尔值，缓存未命中时刷新一次清单。"""

    return await ensure_mcp_integration_tool(SQL_INTEGRATION, configuration, tool_name)


async def ensure_generic_mcp_tool(
    server_id: str,
    configuration: Mapping[str, Any],
    tool_name: str,
) -> bool:
    """确认工具归属指定通用 Server；输入 scope、配置和名称，返回布尔值，必要时刷新清单。"""

    return await ensure_mcp_integration_tool(
        _build_generic_integration(server_id),
        configuration,
        tool_name,
    )


async def ensure_mcp_integration_tool(
    integration: str,
    configuration: Mapping[str, Any],
    tool_name: str,
) -> bool:
    """确认工具归属；输入集成、无密钥配置和名称，返回布尔值，缓存未命中时刷新一次有界清单。"""

    normalized = _validate_integration(integration)
    if is_mcp_integration_tool(normalized, tool_name):
        return True
    await list_mcp_integration_tools(normalized, configuration)
    return is_mcp_integration_tool(normalized, tool_name)


async def call_home_assistant_tool(
    configuration: Mapping[str, Any],
    tool_name: str,
    arguments: Mapping[str, Any],
) -> Any:
    """调用 Home Assistant 工具；输入无密钥配置、名称和参数，返回有界 JSON 结果，未声明工具时抛出固定异常。"""

    return await call_mcp_integration_tool(
        HOME_ASSISTANT_INTEGRATION,
        configuration,
        tool_name,
        arguments,
    )


async def call_external_chrome_tool(
    configuration: Mapping[str, Any],
    tool_name: str,
    arguments: Mapping[str, Any],
) -> Any:
    """调用外部 Chrome MCP 工具；输入实现选择、名称和参数，返回有界 JSON 结果，未声明时抛出固定异常。"""

    return await call_mcp_integration_tool(
        EXTERNAL_CHROME_INTEGRATION,
        configuration,
        tool_name,
        arguments,
    )


async def call_sql_tool(
    configuration: Mapping[str, Any],
    tool_name: str,
    arguments: Mapping[str, Any],
) -> Any:
    """调用 SQL MCP 已声明工具；输入无密钥配置、名称和参数，返回有界 JSON，未声明时抛出固定异常。"""

    return await call_mcp_integration_tool(SQL_INTEGRATION, configuration, tool_name, arguments)


async def call_generic_mcp_tool(
    server_id: str,
    configuration: Mapping[str, Any],
    tool_name: str,
    arguments: Mapping[str, Any],
) -> Any:
    """调用指定通用 Server 工具；输入 scope、无密钥配置、名称和参数，返回有界 JSON。"""

    return await call_mcp_integration_tool(
        _build_generic_integration(server_id),
        configuration,
        tool_name,
        arguments,
    )


async def call_mcp_integration_tool(
    integration: str,
    configuration: Mapping[str, Any],
    tool_name: str,
    arguments: Mapping[str, Any],
) -> Any:
    """调用一个允许集成的已声明工具；输入集成、配置、名称和参数，返回有界 JSON 结果并校验响应归属。"""

    normalized = _validate_integration(integration)
    if not await ensure_mcp_integration_tool(normalized, configuration, tool_name):
        raise McpToolBrokerError("MCP tool is not registered.")
    payload = await _request_broker(MCP_TOOL_CALL_PATH, {
        "integration": normalized,
        "configuration": dict(configuration),
        "toolName": tool_name,
        "arguments": dict(arguments),
    })
    if (
        set(payload) != {"integration", "toolName", "result"}
        or payload.get("integration") != normalized
        or payload.get("toolName") != tool_name
    ):
        raise McpToolBrokerError("MCP Tool Broker returned an invalid result.")
    return payload.get("result")


def _validate_integration(value: str) -> str:
    """校验私有 Broker 集成标识；输入文本，返回规范值，未知集成时抛出固定异常。"""

    if not isinstance(value, str):
        raise McpToolBrokerError("MCP integration is invalid.")
    normalized = value.strip()
    if normalized in SUPPORTED_MCP_INTEGRATIONS:
        return normalized
    if normalized.startswith(GENERIC_MCP_INTEGRATION_PREFIX):
        _build_generic_integration(normalized[len(GENERIC_MCP_INTEGRATION_PREFIX):])
        return normalized
    raise McpToolBrokerError("MCP integration is invalid.")


def _build_generic_integration(server_id: str) -> str:
    """构建动态通用 MCP 集成标识；输入 Server scope，返回前缀名称，空白、控制字符或超长时抛出固定异常。"""

    if (
        not isinstance(server_id, str)
        or not server_id
        or server_id != server_id.strip()
        or len(server_id) > 256
        or any(ord(character) < 32 or ord(character) == 127 for character in server_id)
    ):
        raise McpToolBrokerError("MCP generic server identifier is invalid.")
    return f"{GENERIC_MCP_INTEGRATION_PREFIX}{server_id}"


async def _request_broker(path: str, payload: Mapping[str, Any]) -> dict[str, Any]:
    """发送一次鉴权 Broker 请求；输入精确路径和载荷，返回 JSON 对象，配置、传输或超限响应时抛出固定异常。"""

    origin, token = _resolve_private_endpoint()
    try:
        async with httpx.AsyncClient(
            follow_redirects=False,
            timeout=httpx.Timeout(30.0),
            trust_env=False,
        ) as client:
            response = await client.post(
                f"{origin}{path}",
                headers={"Authorization": f"Bearer {token}", "Cache-Control": "no-store"},
                json=dict(payload),
            )
            content = await response.aread()
    except Exception as error:
        raise McpToolBrokerError("MCP Tool Broker is unavailable.") from error
    if response.status_code != 200 or len(content) > MAX_MCP_BROKER_RESPONSE_BYTES:
        raise McpToolBrokerError("MCP Tool Broker request failed.")
    try:
        value = json.loads(content.decode("utf-8"))
    except Exception as error:
        raise McpToolBrokerError("MCP Tool Broker returned invalid JSON.") from error
    if not isinstance(value, dict):
        raise McpToolBrokerError("MCP Tool Broker returned an invalid response.")
    return value


def _resolve_private_endpoint() -> tuple[str, str]:
    """解析私有 Broker 配置；无输入，返回规范 origin 和 bearer，字段不完整或非回环时抛出固定异常。"""

    origin = str(os.environ.get(MCP_TOOL_BROKER_ORIGIN_ENV, "")).strip().rstrip("/")
    token = str(os.environ.get(MCP_TOOL_BROKER_TOKEN_ENV, "")).strip()
    try:
        parsed = urlsplit(origin)
        port = parsed.port
    except ValueError as error:
        raise McpToolBrokerError("MCP Tool Broker configuration is invalid.") from error
    if (
        parsed.scheme != "http"
        or parsed.hostname not in {"127.0.0.1", "localhost", "::1"}
        or port is None
        or parsed.username
        or parsed.password
        or parsed.path not in {"", "/"}
        or parsed.query
        or parsed.fragment
        or len(token) < 16
        or len(token) > 512
    ):
        raise McpToolBrokerError("MCP Tool Broker configuration is invalid.")
    return origin, token


def _reset_mcp_tool_broker_cache_for_tests() -> None:
    """清空工具所有权缓存；无输入和返回，仅供隔离单元测试使用。"""

    _integration_tool_names.clear()
