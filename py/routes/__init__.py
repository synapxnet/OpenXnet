#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
Central route registration helpers for modular FastAPI endpoints.

This module provides the first step of the server.py route-splitting plan by
collecting independently maintainable APIRouter modules and attaching them to
the shared FastAPI app instance in one place.

Author: OpenAI Codex
Department: R&D
Date: 2026-04-15
Version: 1.0.0
Security Level: INTERNAL
"""

__version__ = "1.0.0"
__author__ = "OpenAI Codex"
__copyright__ = "Copyright 2026 Synapxnet"
__maintainer__ = "OpenAI Codex"
__email__ = "synapxnet@gmail.com"

# Modification History:
# 2026-04-15, v1.0.0, OpenAI Codex: Initial creation.

from fastapi import FastAPI

def configure_route_modules(
    *,
    role_card_manager=None,
    enterprise_kb_manager=None,
    workspace_manager=None,
    sandbox_manager=None,
    xnet_bridge=None,
    memory_federation=None,
    set_memory_federation=None,
    symbol_store=None,
    abort_stream=None,
    tts_manager=None,
    ha_client=None,
    set_ha_client=None,
    chrome_mcp_client=None,
    set_chrome_mcp_client=None,
    sql_client=None,
    set_sql_client=None,
    settings_loader=None,
    settings_saver=None,
    settings_broadcaster=None,
    kernel_ref=None,
    trace_retry_handler=None,
    plan_step_execute_handler=None,
) -> None:
    """配置依赖 Server 单例的路由；输入 getter 和处理器，无返回；仅在调用时加载相关路由模块。"""

    from .chat import configure_chat_routes
    from .enterprise import configure_enterprise_routes
    from .memory import configure_memory_routes
    from .mcp_control import configure_mcp_control_routes
    from .tts import configure_tts_routes
    from .kernel import configure_kernel_routes

    configure_enterprise_routes(
        role_card_manager_ref=role_card_manager,
        enterprise_kb_manager_ref=enterprise_kb_manager,
        workspace_manager_ref=workspace_manager,
        sandbox_manager_ref=sandbox_manager,
        xnet_bridge_ref=xnet_bridge,
    )
    configure_memory_routes(
        memory_federation_ref=memory_federation,
        memory_federation_setter_ref=set_memory_federation,
        symbol_store_ref=symbol_store,
    )
    configure_chat_routes(abort_stream_ref=abort_stream)
    configure_tts_routes(tts_manager_ref=tts_manager)
    configure_mcp_control_routes(
        ha_client_ref=ha_client,
        ha_client_setter_ref=set_ha_client,
        chrome_mcp_client_ref=chrome_mcp_client,
        chrome_mcp_client_setter_ref=set_chrome_mcp_client,
        sql_client_ref=sql_client,
        sql_client_setter_ref=set_sql_client,
    )
    configure_kernel_routes(
        settings_loader=settings_loader,
        settings_saver=settings_saver,
        settings_broadcaster=settings_broadcaster,
        kernel_ref=kernel_ref,
        trace_retry_handler=trace_retry_handler,
        plan_step_execute_handler=plan_step_execute_handler,
    )


def register_all_routes(
    app: FastAPI,
    *,
    include_connector_compatibility: bool,
) -> None:
    """注册 Server 路由；输入 FastAPI 和 Connector 开关，无返回；仅在调用时加载完整兼容路由集合。"""

    from .bots import connector_router, router as bots_router
    from .chat import router as chat_router
    from .desktop_control import router as desktop_control_router
    from .enterprise import router as enterprise_router
    from .events import router as events_router
    from .kernel import router as kernel_router
    from .mcp_control import router as mcp_control_router
    from .memory import router as memory_router
    from .storage import router as storage_router
    from .synapxnet_memory import router as synapxnet_memory_router
    from .system import router as system_router
    from .tts import router as tts_router
    from .usage import router as usage_router
    from .vr import router as vr_router

    app.include_router(system_router)
    app.include_router(usage_router)
    app.include_router(storage_router)
    app.include_router(desktop_control_router)
    app.include_router(enterprise_router)
    app.include_router(memory_router)
    app.include_router(synapxnet_memory_router)
    app.include_router(chat_router)
    app.include_router(tts_router)
    app.include_router(mcp_control_router)
    app.include_router(events_router)
    app.include_router(kernel_router)
    app.include_router(vr_router)
    app.include_router(bots_router)
    if include_connector_compatibility:
        app.include_router(connector_router)
