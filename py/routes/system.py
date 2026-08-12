#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
System-level FastAPI routes extracted from the monolithic server module.

This module currently hosts the health-check endpoint as the first incremental
step of the route modularization plan, keeping behavior unchanged while making
future system route extraction easier to extend.

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

import os
import socket

from fastapi import APIRouter

from py.get_setting import load_settings

router = APIRouter(tags=["system"])


@router.get("/health")
async def health_check():
    """Return a lightweight liveness signal for source-run validation."""
    return {"status": "ok"}


@router.get("/cur_language")
async def cur_language():
    """Return the currently selected UI language."""
    settings = await load_settings()
    target_language = settings["currentLanguage"]
    return {"language": target_language}


@router.post("/api/update_proxy")
async def update_proxy():
    """Refresh proxy and mirror environment variables from persisted settings."""
    try:
        settings = await load_settings()
        if not settings:
            return {"message": "Settings not found", "success": False}

        sys_set = settings.get("systemSettings", {})
        mode = sys_set.get("proxyMode")
        manual_url = sys_set.get("proxy", "").strip()
        is_china_proxy = sys_set.get("isChinaProxy", False)
        proxy_keys = ["http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "all_proxy"]

        if is_china_proxy:
            os.environ["npm_config_registry"] = "https://registry.npmmirror.com/"
            os.environ["UV_INDEX_URL"] = "https://mirrors.aliyun.com/pypi/simple/"
        else:
            os.environ.pop("npm_config_registry", None)
            os.environ.pop("UV_INDEX_URL", None)

        if mode == "manual" and manual_url:
            if manual_url.lower().startswith("socks"):
                for key in proxy_keys:
                    os.environ.pop(key, None)
                return {
                    "message": "Detected SOCKS proxy, disabled to prevent crash. Please use HTTP/HTTPS proxy.",
                    "success": False,
                }

            for key in proxy_keys:
                os.environ[key] = manual_url
        elif mode == "system":
            for key in proxy_keys:
                os.environ.pop(key, None)
        else:
            for key in proxy_keys:
                os.environ[key] = ""

        return {
            "message": "Proxy and mirrors updated successfully",
            "success": True,
            "current_mode": mode,
            "china_mirror": is_china_proxy,
        }
    except Exception as exc:
        return {"message": str(exc), "success": False}


def get_internal_ip() -> str:
    """Return the current LAN IP for UI display."""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(0)
        sock.connect(("8.8.8.8", 80))
        internal_ip = sock.getsockname()[0]
        sock.close()
        return internal_ip
    except Exception:
        return "127.0.0.1"


@router.get("/api/ip")
def get_ip():
    """Return the current LAN IP address."""
    ip = get_internal_ip()
    return {"ip": ip}
