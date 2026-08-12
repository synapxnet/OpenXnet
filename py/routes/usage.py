#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
Usage analytics routes extracted from the monolithic server module.

This module centralizes read-only usage reporting endpoints so the server can
incrementally migrate away from a single giant route file while preserving the
existing API contract for dashboards and enterprise views.

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

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from py.usage.token_meter import get_token_meter

router = APIRouter(tags=["usage"])


@router.get("/v1/usage/summary")
async def usage_summary(
    start: str = None,
    end: str = None,
    user_id: str = None,
    model: str = None,
    engine: str = None,
):
    """Return usage summary data with optional filters."""
    try:
        meter = get_token_meter()
        summary = meter.get_summary(start=start, end=end, user_id=user_id, model=model, engine=engine)
        return JSONResponse(content=summary)
    except Exception as exc:
        return JSONResponse(status_code=500, content={"error": str(exc)})


@router.get("/v1/usage/trend")
async def usage_trend(
    group_by: str = "day",
    start: str = None,
    end: str = None,
    user_id: str = None,
    limit: int = 30,
):
    """Return usage trend data grouped by hour, day, or month."""
    try:
        meter = get_token_meter()
        trend = meter.get_trend(group_by=group_by, start=start, end=end, user_id=user_id, limit=limit)
        return JSONResponse(content={"trend": trend, "group_by": group_by})
    except Exception as exc:
        return JSONResponse(status_code=500, content={"error": str(exc)})


@router.get("/v1/usage/by-model")
async def usage_by_model(start: str = None, end: str = None, user_id: str = None):
    """Return grouped usage details by model."""
    try:
        meter = get_token_meter()
        data = meter.get_by_model(start=start, end=end, user_id=user_id)
        return JSONResponse(content={"models": data})
    except Exception as exc:
        return JSONResponse(status_code=500, content={"error": str(exc)})


@router.get("/v1/usage/by-user")
async def usage_by_user(start: str = None, end: str = None):
    """Return grouped usage details by user."""
    try:
        meter = get_token_meter()
        data = meter.get_by_user(start=start, end=end)
        return JSONResponse(content={"users": data})
    except Exception as exc:
        return JSONResponse(status_code=500, content={"error": str(exc)})


@router.get("/v1/usage/records")
async def usage_records(
    limit: int = 50,
    offset: int = 0,
    user_id: str = None,
    model: str = None,
):
    """Return paginated recent usage records."""
    try:
        meter = get_token_meter()
        records, total = meter.get_recent_records(limit=limit, offset=offset, user_id=user_id, model=model)
        return JSONResponse(content={"records": records, "total": total, "limit": limit, "offset": offset})
    except Exception as exc:
        return JSONResponse(status_code=500, content={"error": str(exc)})


@router.get("/v1/usage/stats")
async def usage_stats():
    """Return usage subsystem statistics."""
    try:
        meter = get_token_meter()
        stats = meter.stats()
        return JSONResponse(content=stats)
    except Exception as exc:
        return JSONResponse(status_code=500, content={"error": str(exc)})
