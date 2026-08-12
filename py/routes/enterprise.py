#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
Enterprise FastAPI routes extracted from the monolithic server module.

This module centralizes enterprise-facing APIs including role cards,
enterprise knowledge bases, workspace management, sandbox state, and Xnet
service control. Dependencies are configured from server.py so route behavior
remains unchanged while the monolith keeps shrinking.

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

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

router = APIRouter(tags=["enterprise"])

role_card_manager_provider = None
enterprise_kb_manager_provider = None
workspace_manager_provider = None
sandbox_manager_provider = None
xnet_bridge_provider = None


def configure_enterprise_routes(
    *,
    role_card_manager_ref,
    enterprise_kb_manager_ref,
    workspace_manager_ref,
    sandbox_manager_ref,
    xnet_bridge_ref,
) -> None:
    """Bind server-managed enterprise dependencies into this route module."""
    global role_card_manager_provider, enterprise_kb_manager_provider, workspace_manager_provider
    global sandbox_manager_provider, xnet_bridge_provider
    role_card_manager_provider = role_card_manager_ref
    enterprise_kb_manager_provider = enterprise_kb_manager_ref
    workspace_manager_provider = workspace_manager_ref
    sandbox_manager_provider = sandbox_manager_ref
    xnet_bridge_provider = xnet_bridge_ref


def _json_error(status_code: int, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"error": message})


def _resolve(provider):
    return provider() if callable(provider) else provider


def _sync_sandbox_from_role_cards() -> None:
    sandbox_manager = _resolve(sandbox_manager_provider)
    role_card_manager = _resolve(role_card_manager_provider)
    if sandbox_manager and role_card_manager:
        sandbox_manager.sync_from_role_cards(role_card_manager.list_all())


@router.get("/v1/enterprise/role-cards")
async def list_role_cards():
    """获取所有职工角色卡"""
    role_card_manager = _resolve(role_card_manager_provider)
    if not role_card_manager:
        return _json_error(503, "Enterprise module not initialized")
    try:
        cards = role_card_manager.list_all()
        return JSONResponse(content={"cards": cards})
    except Exception as exc:
        return _json_error(500, str(exc))


@router.post("/v1/enterprise/role-cards")
async def create_role_card(request: Request):
    """创建新职工角色卡"""
    role_card_manager = _resolve(role_card_manager_provider)
    if not role_card_manager:
        return _json_error(503, "Enterprise module not initialized")
    try:
        data = await request.json()
        card = role_card_manager.create(data)
        _sync_sandbox_from_role_cards()
        return JSONResponse(content={"success": True, "card": card})
    except Exception as exc:
        return _json_error(500, str(exc))


@router.put("/v1/enterprise/role-cards/{card_id}")
async def update_role_card(card_id: str, request: Request):
    """更新职工角色卡"""
    role_card_manager = _resolve(role_card_manager_provider)
    if not role_card_manager:
        return _json_error(503, "Enterprise module not initialized")
    try:
        data = await request.json()
        card = role_card_manager.update(card_id, data)
        if card:
            _sync_sandbox_from_role_cards()
            return JSONResponse(content={"success": True, "card": card})
        return _json_error(404, "Card not found")
    except Exception as exc:
        return _json_error(500, str(exc))


@router.delete("/v1/enterprise/role-cards/{card_id}")
async def delete_role_card(card_id: str):
    """删除职工角色卡"""
    role_card_manager = _resolve(role_card_manager_provider)
    if not role_card_manager:
        return _json_error(503, "Enterprise module not initialized")
    try:
        success = role_card_manager.delete(card_id)
        if success:
            _sync_sandbox_from_role_cards()
            return JSONResponse(content={"success": True})
        return _json_error(404, "Card not found")
    except Exception as exc:
        return _json_error(500, str(exc))


@router.get("/v1/enterprise/knowledge-bases")
async def list_enterprise_kbs():
    """获取所有企业知识库"""
    enterprise_kb_manager = _resolve(enterprise_kb_manager_provider)
    if not enterprise_kb_manager:
        return _json_error(503, "Enterprise module not initialized")
    try:
        kbs = enterprise_kb_manager.list_all()
        return JSONResponse(content={"kbs": kbs})
    except Exception as exc:
        return _json_error(500, str(exc))


@router.post("/v1/enterprise/knowledge-bases")
async def create_enterprise_kb(request: Request):
    """创建新企业知识库"""
    enterprise_kb_manager = _resolve(enterprise_kb_manager_provider)
    if not enterprise_kb_manager:
        return _json_error(503, "Enterprise module not initialized")
    try:
        data = await request.json()
        kb = enterprise_kb_manager.create(data)
        return JSONResponse(content={"success": True, "kb": kb})
    except Exception as exc:
        return _json_error(500, str(exc))


@router.put("/v1/enterprise/knowledge-bases/{kb_id}")
async def update_enterprise_kb(kb_id: str, request: Request):
    """更新企业知识库"""
    enterprise_kb_manager = _resolve(enterprise_kb_manager_provider)
    if not enterprise_kb_manager:
        return _json_error(503, "Enterprise module not initialized")
    try:
        data = await request.json()
        kb = enterprise_kb_manager.update(kb_id, data)
        if kb:
            return JSONResponse(content={"success": True, "kb": kb})
        return _json_error(404, "Knowledge base not found")
    except Exception as exc:
        return _json_error(500, str(exc))


@router.delete("/v1/enterprise/knowledge-bases/{kb_id}")
async def delete_enterprise_kb(kb_id: str):
    """删除企业知识库"""
    enterprise_kb_manager = _resolve(enterprise_kb_manager_provider)
    if not enterprise_kb_manager:
        return _json_error(503, "Enterprise module not initialized")
    try:
        success = enterprise_kb_manager.delete(kb_id)
        if success:
            return JSONResponse(content={"success": True})
        return _json_error(404, "Knowledge base not found")
    except Exception as exc:
        return _json_error(500, str(exc))


@router.get("/v1/enterprise/knowledge-bases/{kb_id}/versions")
async def list_kb_versions(kb_id: str):
    """获取企业知识库版本历史"""
    enterprise_kb_manager = _resolve(enterprise_kb_manager_provider)
    if not enterprise_kb_manager:
        return _json_error(503, "Enterprise module not initialized")
    try:
        versions = enterprise_kb_manager.list_versions(kb_id)
        return JSONResponse(content={"versions": versions})
    except Exception as exc:
        return _json_error(500, str(exc))


@router.post("/v1/enterprise/knowledge-bases/{kb_id}/snapshot")
async def create_kb_snapshot(kb_id: str):
    """创建企业知识库版本快照"""
    enterprise_kb_manager = _resolve(enterprise_kb_manager_provider)
    if not enterprise_kb_manager:
        return _json_error(503, "Enterprise module not initialized")
    try:
        snapshot = enterprise_kb_manager.create_snapshot(kb_id)
        if snapshot:
            return JSONResponse(content={"success": True, "snapshot": snapshot})
        return _json_error(404, "Knowledge base not found")
    except Exception as exc:
        return _json_error(500, str(exc))


@router.post("/v1/enterprise/knowledge-bases/{kb_id}/rollback/{version}")
async def rollback_kb(kb_id: str, version: int):
    """回滚企业知识库到指定版本"""
    enterprise_kb_manager = _resolve(enterprise_kb_manager_provider)
    if not enterprise_kb_manager:
        return _json_error(503, "Enterprise module not initialized")
    try:
        result = enterprise_kb_manager.rollback(kb_id, version)
        if result:
            return JSONResponse(content={"success": True, "kb": result})
        return _json_error(404, "Version not found")
    except Exception as exc:
        return _json_error(500, str(exc))


@router.get("/v1/enterprise/workspaces")
async def list_workspace_envs():
    """获取所有工作空间环境"""
    workspace_manager = _resolve(workspace_manager_provider)
    if not workspace_manager:
        return _json_error(503, "Workspace module not initialized")
    try:
        envs = workspace_manager.list_envs()
        return JSONResponse(content={"envs": envs})
    except Exception as exc:
        return _json_error(500, str(exc))


@router.post("/v1/enterprise/workspaces")
async def create_workspace_env(request: Request):
    """创建新的工作空间环境"""
    workspace_manager = _resolve(workspace_manager_provider)
    if not workspace_manager:
        return _json_error(503, "Workspace module not initialized")
    try:
        data = await request.json()
        env = workspace_manager.create_env(data)
        return JSONResponse(content={"success": True, "env": env})
    except Exception as exc:
        return _json_error(500, str(exc))


@router.put("/v1/enterprise/workspaces/{env_id}")
async def update_workspace_env(env_id: str, request: Request):
    """更新工作空间环境"""
    workspace_manager = _resolve(workspace_manager_provider)
    if not workspace_manager:
        return _json_error(503, "Workspace module not initialized")
    try:
        data = await request.json()
        env = workspace_manager.update_env(env_id, data)
        if env:
            return JSONResponse(content={"success": True, "env": env})
        return _json_error(404, "Environment not found")
    except Exception as exc:
        return _json_error(500, str(exc))


@router.delete("/v1/enterprise/workspaces/{env_id}")
async def delete_workspace_env(env_id: str):
    """删除工作空间环境"""
    workspace_manager = _resolve(workspace_manager_provider)
    if not workspace_manager:
        return _json_error(503, "Workspace module not initialized")
    try:
        success = workspace_manager.delete_env(env_id)
        if success:
            return JSONResponse(content={"success": True})
        return _json_error(404, "Environment not found")
    except Exception as exc:
        return _json_error(500, str(exc))


@router.post("/v1/enterprise/workspaces/{env_id}/docker/start")
async def start_workspace_docker(env_id: str):
    """启动工作空间 Docker 容器"""
    workspace_manager = _resolve(workspace_manager_provider)
    if not workspace_manager:
        return _json_error(503, "Workspace module not initialized")
    try:
        result = await workspace_manager.docker_start(env_id)
        return JSONResponse(content=result)
    except Exception as exc:
        return _json_error(500, str(exc))


@router.post("/v1/enterprise/workspaces/{env_id}/docker/stop")
async def stop_workspace_docker(env_id: str):
    """停止工作空间 Docker 容器"""
    workspace_manager = _resolve(workspace_manager_provider)
    if not workspace_manager:
        return _json_error(503, "Workspace module not initialized")
    try:
        result = await workspace_manager.docker_stop(env_id)
        return JSONResponse(content=result)
    except Exception as exc:
        return _json_error(500, str(exc))


@router.get("/v1/enterprise/sandbox/state")
async def get_sandbox_state():
    """获取完整沙盘状态 (前端 Three.js 渲染用)"""
    sandbox_manager = _resolve(sandbox_manager_provider)
    role_card_manager = _resolve(role_card_manager_provider)
    if not sandbox_manager:
        return _json_error(503, "Sandbox module not initialized")
    try:
        if role_card_manager:
            cards = role_card_manager.list_all()
            sandbox_manager.sync_from_role_cards(cards)
        state = sandbox_manager.get_full_state()
        return JSONResponse(content=state)
    except Exception as exc:
        return _json_error(500, str(exc))


@router.put("/v1/enterprise/sandbox/agent/{agent_id}/status")
async def update_sandbox_agent(agent_id: str, request: Request):
    """更新沙盘中指定 Agent 的状态"""
    sandbox_manager = _resolve(sandbox_manager_provider)
    if not sandbox_manager:
        return _json_error(503, "Sandbox module not initialized")
    try:
        data = await request.json()
        agent = sandbox_manager.update_agent_status(
            agent_id, data.get("status", "idle"), data.get("current_task")
        )
        if agent:
            return JSONResponse(content={"success": True, "agent": agent})
        return _json_error(404, "Agent not found")
    except Exception as exc:
        return _json_error(500, str(exc))


@router.put("/v1/enterprise/sandbox/agent/{agent_id}/move")
async def move_sandbox_agent(agent_id: str, request: Request):
    """移动沙盘中指定 Agent 到新位置"""
    sandbox_manager = _resolve(sandbox_manager_provider)
    if not sandbox_manager:
        return _json_error(503, "Sandbox module not initialized")
    try:
        data = await request.json()
        agent = sandbox_manager.move_agent(agent_id, data.get("x", 0), data.get("z", 0))
        if agent:
            return JSONResponse(content={"success": True, "agent": agent})
        return _json_error(404, "Agent not found")
    except Exception as exc:
        return _json_error(500, str(exc))


@router.get("/v1/enterprise/xnet/services")
async def get_xnet_services():
    """获取所有 Xnet 服务配置和状态"""
    xnet_bridge = _resolve(xnet_bridge_provider)
    if not xnet_bridge:
        return _json_error(503, "Xnet bridge not initialized")
    try:
        services = xnet_bridge.get_services()
        return JSONResponse(content={"services": services})
    except Exception as exc:
        return _json_error(500, str(exc))


@router.put("/v1/enterprise/xnet/services/{service_key}")
async def update_xnet_service(service_key: str, request: Request):
    """更新 Xnet 服务 URL 配置"""
    xnet_bridge = _resolve(xnet_bridge_provider)
    if not xnet_bridge:
        return _json_error(503, "Xnet bridge not initialized")
    try:
        data = await request.json()
        service = xnet_bridge.update_service(service_key, data)
        if service:
            return JSONResponse(content={"success": True, "service": service})
        return _json_error(404, "Service not found")
    except Exception as exc:
        return _json_error(500, str(exc))


@router.post("/v1/enterprise/xnet/health-check/{service_key}")
async def xnet_health_check(service_key: str):
    """检测指定 Xnet 服务健康状态"""
    xnet_bridge = _resolve(xnet_bridge_provider)
    if not xnet_bridge:
        return _json_error(503, "Xnet bridge not initialized")
    try:
        result = await xnet_bridge.health_check(service_key)
        return JSONResponse(content=result)
    except Exception as exc:
        return _json_error(500, str(exc))


@router.post("/v1/enterprise/xnet/health-check-all")
async def xnet_health_check_all(auto_only: bool = False):
    """批量检测所有 Xnet 服务健康状态。"""
    xnet_bridge = _resolve(xnet_bridge_provider)
    if not xnet_bridge:
        return _json_error(503, "Xnet bridge not initialized")
    try:
        services = xnet_bridge.get_services()
        target_keys = [
            key for key, service in services.items()
            if service.get("url") and (not auto_only or service.get("auto_connect"))
        ]

        results = {}
        for key in target_keys:
            results[key] = await xnet_bridge.health_check(key)

        return JSONResponse(content={
            "success": True,
            "checked": target_keys,
            "results": results,
            "services": xnet_bridge.get_services(),
        })
    except Exception as exc:
        return _json_error(500, str(exc))
