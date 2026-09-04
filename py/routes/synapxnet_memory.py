# -*- coding: utf-8 -*-
"""Browser-compatible HTTP routes for SynapXnet Memory Framework V3."""

from __future__ import annotations

import asyncio
from collections.abc import Callable, Mapping
from typing import Any

from fastapi import APIRouter, Body
from fastapi.responses import JSONResponse

from py.get_setting import USER_DATA_DIR
from py.memory.synapxnet_v3_runtime import SynapXnetMemoryV3Runtime


router = APIRouter(prefix="/v1/synapxnet-memory", tags=["synapxnet-memory"])
_runtime = SynapXnetMemoryV3Runtime(USER_DATA_DIR)


async def _invoke(operation: Callable[[Mapping[str, Any]], Mapping[str, Any]], payload: Mapping[str, Any]):
    try:
        result = await asyncio.to_thread(operation, payload)
        return JSONResponse(content=dict(result))
    except PermissionError as error:
        return JSONResponse(status_code=403, content={"error": str(error)})
    except RuntimeError as error:
        return JSONResponse(status_code=409, content={"error": str(error)})
    except (TypeError, ValueError) as error:
        return JSONResponse(status_code=400, content={"error": str(error)})
    except Exception:
        return JSONResponse(status_code=500, content={"error": "SynapXnet Memory runtime is unavailable."})


@router.get("/status")
async def synapxnet_memory_status():
    """Return content-free V3 tier and audit health."""

    try:
        return JSONResponse(content=await asyncio.to_thread(_runtime.status))
    except Exception:
        return JSONResponse(status_code=500, content={"error": "SynapXnet Memory runtime is unavailable."})


@router.post("/list")
async def synapxnet_memory_list(payload: dict[str, Any] = Body(...)):
    return await _invoke(_runtime.list_memories, payload)


@router.post("/history")
async def synapxnet_memory_history(payload: dict[str, Any] = Body(...)):
    return await _invoke(_runtime.get_history, payload)


@router.post("/create")
async def synapxnet_memory_create(payload: dict[str, Any] = Body(...)):
    return await _invoke(_runtime.create_memory, payload)


@router.post("/edit")
async def synapxnet_memory_edit(payload: dict[str, Any] = Body(...)):
    return await _invoke(_runtime.edit_memory, payload)


@router.post("/rollback")
async def synapxnet_memory_rollback(payload: dict[str, Any] = Body(...)):
    return await _invoke(_runtime.rollback_memory, payload)


@router.post("/retire")
async def synapxnet_memory_retire(payload: dict[str, Any] = Body(...)):
    return await _invoke(_runtime.retire_memory, payload)


@router.post("/export")
async def synapxnet_memory_export(payload: dict[str, Any] = Body(...)):
    return await _invoke(_runtime.export_memories, payload)


@router.post("/import")
async def synapxnet_memory_import(payload: dict[str, Any] = Body(...)):
    return await _invoke(_runtime.import_memories, payload)


@router.post("/verify")
async def synapxnet_memory_verify(payload: dict[str, Any] = Body(...)):
    return await _invoke(_runtime.verify_integrity, payload)
