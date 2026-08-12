#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
MCP integration control routes extracted from the monolithic server module.

This module centralizes lifecycle control for Home Assistant MCP,
ChromeMCP/Playwright MCP, and SQL MCP clients while preserving the original
endpoint contract.

Author: OpenAI Codex
Department: R&D
Date: 2026-04-16
Version: 1.0.0
Security Level: INTERNAL
"""

__version__ = "1.0.0"
__author__ = "OpenAI Codex"
__copyright__ = "Copyright 2026 Synapxnet"
__maintainer__ = "OpenAI Codex"
__email__ = "synapxnet@gmail.com"

# Modification History:
# 2026-04-16, v1.0.0, OpenAI Codex: Initial creation.

import asyncio
from importlib import import_module
import logging
import os
from collections.abc import Mapping

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from py.home_assistant_credentials import hydrate_home_assistant_config

router = APIRouter(tags=["mcp-control"])

ha_client_provider = None
ha_client_setter = None
chrome_mcp_client_provider = None
chrome_mcp_client_setter = None
sql_client_provider = None
sql_client_setter = None
McpClient = None
EXTERNAL_CHROME_PACKAGES = {
    "browser-mcp": "@browsermcp/mcp@0.1.3",
    "playwright-mcp": "@playwright/mcp@0.0.78",
}


def _load_compatibility_attribute(module_name: str, attribute_name: str):
    """延迟读取 Server 兼容 MCP 实现；输入模块和属性名，返回目标属性，缺少可选依赖时向上抛出异常。"""

    module = import_module(".".join(("py", module_name)))
    return getattr(module, attribute_name)


def _create_mcp_client():
    """创建 Server 兼容 MCP 客户端；无输入，返回测试替身或延迟加载的真实客户端，不建立连接。"""

    client_class = McpClient or _load_compatibility_attribute("mcp_clients", "McpClient")
    return client_class()


def build_home_assistant_sse_url(value):
    """构建 Home Assistant SSE 地址；输入配置值，返回安全 URL，具体校验由延迟加载的 Server Runtime 负责。"""

    builder = _load_compatibility_attribute("mcp_runtime", "build_home_assistant_sse_url")
    return builder(value)


def build_external_chrome_stdio_configuration(configuration):
    """构建外部 Chrome MCP 配置；输入固定实现配置，返回 Server 子进程参数，依赖缺失时抛出异常。"""

    builder = _load_compatibility_attribute(
        "mcp_runtime",
        "build_external_chrome_stdio_configuration",
    )
    return builder(configuration)


async def prepare_external_chrome_node_runtime():
    """准备外部 Chrome Node Runtime；无输入，返回运行时目录，安装和校验由 Server Runtime 执行。"""

    prepare = _load_compatibility_attribute(
        "mcp_runtime",
        "prepare_external_chrome_node_runtime",
    )
    return await prepare()


def build_sql_stdio_configuration(configuration):
    """构建 SQL MCP 配置；输入无密钥连接元数据，返回 Server 子进程参数，依赖缺失时抛出异常。"""

    builder = _load_compatibility_attribute("mcp_runtime", "build_sql_stdio_configuration")
    return builder(configuration)


def configure_mcp_control_routes(
    *,
    ha_client_ref,
    ha_client_setter_ref,
    chrome_mcp_client_ref,
    chrome_mcp_client_setter_ref,
    sql_client_ref,
    sql_client_setter_ref,
) -> None:
    """绑定 server.py 提供的 MCP 客户端 getter 与 setter；输入六个引用，无返回，不创建连接。"""
    global ha_client_provider, ha_client_setter
    global chrome_mcp_client_provider, chrome_mcp_client_setter
    global sql_client_provider, sql_client_setter
    ha_client_provider = ha_client_ref
    ha_client_setter = ha_client_setter_ref
    chrome_mcp_client_provider = chrome_mcp_client_ref
    chrome_mcp_client_setter = chrome_mcp_client_setter_ref
    sql_client_provider = sql_client_ref
    sql_client_setter = sql_client_setter_ref


def _resolve(provider):
    """解析可选单例 provider；输入值或可调用对象，返回当前客户端或原值，无副作用。"""

    return provider() if callable(provider) else provider


async def _close_home_assistant_client(client) -> None:
    """关闭 Home Assistant 客户端；输入可空客户端，无返回，传输清理失败只记录异常类型。"""

    if client is None:
        return
    try:
        await client.close()
    except Exception as error:
        logging.warning(
            "Home Assistant MCP cleanup failed: %s",
            type(error).__name__,
        )


@router.post("/start_HA")
async def start_HA(request: Request):
    """启动 Server 兼容 Home Assistant MCP；输入 HTTP 请求，返回安全状态，凭据、URL 或连接失败时脱敏。"""

    try:
        data = await request.json()
        raw_configuration = data.get("data") if isinstance(data, Mapping) else None
        if not isinstance(raw_configuration, Mapping):
            raise ValueError("Home Assistant configuration is invalid.")
        configuration = hydrate_home_assistant_config(raw_configuration)
        api_token = str(configuration.get("api_key", "") or "").strip()
        if not api_token:
            raise ValueError("Home Assistant credential is missing.")
        ha_config = {
            "type": "sse",
            "url": build_home_assistant_sse_url(configuration.get("url")),
            "headers": {"Authorization": f"Bearer {api_token}"},
            "follow_redirects": False,
        }
    except Exception:
        return JSONResponse(
            status_code=400,
            content={"error": "Home Assistant configuration is invalid."},
            headers={"Cache-Control": "no-store"},
        )

    ha_client = _resolve(ha_client_provider)
    if ha_client is not None:
        return JSONResponse(
            {"status": "ready", "enabled": True},
            headers={"Cache-Control": "no-store"},
        )

    conn_failed_event = asyncio.Event()

    async def on_failure(_error_message: str):
        """记录一次有界连接失败；输入被丢弃的错误文本，无返回，不保留供应商诊断。"""

        conn_failed_event.set()

    try:
        ha_client = _create_mcp_client()
        if ha_client_setter:
            ha_client_setter(ha_client)
        await ha_client.initialize("HA", ha_config, on_failure_callback=on_failure)

        try:
            await asyncio.wait_for(conn_failed_event.wait(), timeout=5.0)
            raise RuntimeError("Home Assistant MCP connection failed.")
        except asyncio.TimeoutError:
            pass

        return JSONResponse(
            {"status": "ready", "enabled": True},
            headers={"Cache-Control": "no-store"},
        )
    except Exception as exc:
        await _close_home_assistant_client(ha_client)
        if ha_client_setter:
            ha_client_setter(None)
        logging.warning("Home Assistant MCP start failed: %s", type(exc).__name__)
        return JSONResponse(
            status_code=500,
            content={"error": "Home Assistant connection failed."},
            headers={"Cache-Control": "no-store"},
        )


@router.post("/stop_HA")
async def stop_HA():
    """停止 Server 兼容 Home Assistant MCP；无输入，返回安全状态并释放持有凭据的客户端。"""

    ha_client = _resolve(ha_client_provider)
    try:
        if ha_client is not None:
            await ha_client.close()
            if ha_client_setter:
                ha_client_setter(None)
        return JSONResponse({
            "status": "stopped",
            "enabled": False,
        }, headers={"Cache-Control": "no-store"})
    except Exception as exc:
        if ha_client_setter:
            ha_client_setter(None)
        logging.warning("Home Assistant MCP stop failed: %s", type(exc).__name__)
        return JSONResponse(
            status_code=500,
            content={"error": "Home Assistant shutdown failed."},
            headers={"Cache-Control": "no-store"},
        )


@router.post("/start_ChromeMCP")
async def start_ChromeMCP(request: Request):
    """启动 Server 兼容外部 Chrome MCP；输入固定实现选择，返回安全状态，配置或连接失败时隐藏内部诊断。"""

    try:
        data = await request.json()
        raw_configuration = data.get("data") if isinstance(data, Mapping) else None
        if not isinstance(raw_configuration, Mapping):
            raise ValueError("External Chrome MCP configuration is invalid.")
        mcp_name = raw_configuration.get("mcpName", "browser-mcp")
        if not isinstance(mcp_name, str) or mcp_name not in EXTERNAL_CHROME_PACKAGES:
            raise ValueError("External Chrome MCP implementation is invalid.")
        runtime_configuration = {"mcpName": mcp_name}
    except Exception:
        return JSONResponse(
            status_code=400,
            content={"error": "External Chrome MCP configuration is invalid."},
            headers={"Cache-Control": "no-store"},
        )

    try:
        await prepare_external_chrome_node_runtime()
        chrome_config = build_external_chrome_stdio_configuration(runtime_configuration)
    except Exception as error:
        logging.warning("External Chrome MCP dependency preparation failed: %s", type(error).__name__)
        return JSONResponse(
            status_code=500,
            content={"error": "External Chrome MCP runtime is unavailable."},
            headers={"Cache-Control": "no-store"},
        )

    chrome_mcp_client = _resolve(chrome_mcp_client_provider)
    if chrome_mcp_client is not None:
        return JSONResponse(
            {"status": "ready", "enabled": True},
            headers={"Cache-Control": "no-store"},
        )

    try:
        chrome_mcp_client = _create_mcp_client()
        if chrome_mcp_client_setter:
            chrome_mcp_client_setter(chrome_mcp_client)
        await chrome_mcp_client.initialize("ChromeMCP", chrome_config)
        await chrome_mcp_client.wait_until_ready(timeout=60.0)
        return JSONResponse(
            {"status": "ready", "enabled": True},
            headers={"Cache-Control": "no-store"},
        )
    except Exception as exc:
        if chrome_mcp_client is not None:
            try:
                await chrome_mcp_client.close()
            except Exception as close_error:
                logging.warning(
                    "External Chrome MCP cleanup failed: %s",
                    type(close_error).__name__,
                )
        if chrome_mcp_client_setter:
            chrome_mcp_client_setter(None)
        logging.warning("External Chrome MCP start failed: %s", type(exc).__name__)
        return JSONResponse(
            status_code=500,
            content={"error": "External Chrome MCP connection failed."},
            headers={"Cache-Control": "no-store"},
        )


@router.post("/stop_ChromeMCP")
@router.get("/stop_ChromeMCP")
async def stop_ChromeMCP():
    """停止 Server 兼容外部 Chrome MCP；无输入，返回安全停止状态，清理失败时隐藏内部诊断。"""

    chrome_mcp_client = _resolve(chrome_mcp_client_provider)
    try:
        if chrome_mcp_client is not None:
            await chrome_mcp_client.close()
            if chrome_mcp_client_setter:
                chrome_mcp_client_setter(None)
        return JSONResponse({
            "status": "stopped",
            "enabled": False,
        }, headers={"Cache-Control": "no-store"})
    except Exception as exc:
        if chrome_mcp_client_setter:
            chrome_mcp_client_setter(None)
        logging.warning("External Chrome MCP stop failed: %s", type(exc).__name__)
        return JSONResponse(
            status_code=500,
            content={"error": "External Chrome MCP shutdown failed."},
            headers={"Cache-Control": "no-store"},
        )


@router.post("/start_sql")
async def start_sql(request: Request) -> JSONResponse:
    """启动兼容 SQL MCP；输入 HTTP JSON，返回固定状态，配置、连接或依赖失败时返回脱敏错误。"""

    sql_client = _resolve(sql_client_provider)
    if sql_client is not None:
        return JSONResponse(
            {"status": "ready", "enabled": True},
            headers={"Cache-Control": "no-store"},
        )

    try:
        payload = await request.json()
        if not isinstance(payload, Mapping) or set(payload) != {"data"}:
            raise ValueError("SQL MCP request fields are invalid.")
        configuration = payload.get("data")
        if not isinstance(configuration, Mapping):
            raise ValueError("SQL MCP configuration is invalid.")
        engine = str(configuration.get("engine") or "").strip()
        if engine == "sqlite":
            runtime_configuration = {
                "engine": engine,
                **(
                    {"databaseId": str(configuration.get("databaseId") or "").strip()}
                    if os.environ.get("OPENXNET_SQL_CREDENTIALS_B64")
                    else {"dbpath": str(configuration.get("dbpath") or configuration.get("dbPath") or "").strip()}
                ),
            }
        else:
            runtime_configuration = {
                "engine": engine,
                "user": str(configuration.get("user") or "").strip(),
                "host": str(configuration.get("host") or "").strip(),
                "port": int(configuration.get("port") or 0),
                "dbname": str(configuration.get("dbname") or "").strip(),
                **(
                    {}
                    if os.environ.get("OPENXNET_SQL_CREDENTIALS_B64")
                    else {"password": str(configuration.get("password") or "").strip()}
                ),
            }
        sql_config = build_sql_stdio_configuration(runtime_configuration)
        sql_client = _create_mcp_client()
        if sql_client_setter:
            sql_client_setter(sql_client)
        await sql_client.initialize("sqlMCP", sql_config)
        await sql_client.wait_until_ready(timeout=30.0)
        return JSONResponse(
            {"status": "ready", "enabled": True},
            headers={"Cache-Control": "no-store"},
        )
    except Exception as exc:
        if sql_client is not None:
            try:
                await sql_client.close()
            except Exception as cleanup_error:
                logging.warning("SQL MCP cleanup failed: %s", type(cleanup_error).__name__)
        if sql_client_setter:
            sql_client_setter(None)
        logging.warning("SQL MCP start failed: %s", type(exc).__name__)
        return JSONResponse(
            status_code=500,
            content={"error": "SQL MCP failed to start."},
            headers={"Cache-Control": "no-store"},
        )


async def _stop_sql_client() -> JSONResponse:
    """关闭兼容 SQL MCP 客户端；无输入，返回固定状态，清理失败时返回脱敏错误。"""

    sql_client = _resolve(sql_client_provider)
    try:
        if sql_client is not None:
            await sql_client.close()
            if sql_client_setter:
                sql_client_setter(None)
        return JSONResponse({
            "status": "stopped",
            "enabled": False,
        }, headers={"Cache-Control": "no-store"})
    except Exception as exc:
        if sql_client_setter:
            sql_client_setter(None)
        logging.warning("SQL MCP stop failed: %s", type(exc).__name__)
        return JSONResponse(
            status_code=500,
            content={"error": "SQL MCP shutdown failed."},
            headers={"Cache-Control": "no-store"},
        )


@router.post("/stop_sql")
async def stop_sql() -> JSONResponse:
    """通过 POST 停止兼容 SQL MCP；无输入，返回固定状态，具体清理由私有辅助函数处理。"""

    return await _stop_sql_client()


@router.get("/stop_sql")
async def stop_sql_legacy_get() -> JSONResponse:
    """保留旧 GET 停止入口；无输入，返回与 POST 相同状态，后续兼容窗口结束后可删除。"""

    return await _stop_sql_client()
