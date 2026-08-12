# -*- coding: utf-8 -*-
"""Execution Engine 私有知识库 HTTP 适配器。"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from py.knowledge_base_runtime import KnowledgeBaseRuntimeController


KNOWLEDGE_BASE_ENGINE_PATHS = frozenset({
    "/v1/desktop/knowledge-base/build",
    "/v1/desktop/knowledge-base/status",
    "/v1/desktop/knowledge-base/remove",
    "/v1/desktop/knowledge-base/query",
})


class KnowledgeBaseScopeRequest(BaseModel):
    """只包含一个知识库标识的精确私有请求。"""

    model_config = ConfigDict(extra="forbid")
    knowledgeBaseId: str = Field(min_length=1, max_length=128)


class KnowledgeBaseQueryRequest(KnowledgeBaseScopeRequest):
    """包含有界查询文本和结果数量的精确私有请求。"""

    query: str = Field(min_length=1, max_length=8_192)
    limit: int = Field(default=5, ge=1, le=20)


def register_knowledge_base_engine_api(
    application: FastAPI,
    controller: KnowledgeBaseRuntimeController,
) -> dict[str, Any]:
    """注册私有知识库路由；输入应用和控制器，返回控制器引用，失败只暴露固定 HTTP 错误。"""

    @application.post("/v1/desktop/knowledge-base/build")
    async def build_knowledge_base(request: KnowledgeBaseScopeRequest) -> dict[str, Any]:
        """执行知识库构建；输入精确 scope，返回最终状态，内部失败转换为 failed 状态。"""

        return await controller.build(request.knowledgeBaseId)

    @application.post("/v1/desktop/knowledge-base/status")
    async def get_knowledge_base_status(request: KnowledgeBaseScopeRequest) -> dict[str, Any]:
        """读取知识库状态；输入精确 scope，返回状态，不启动模型或 Vector Worker。"""

        return await controller.status(request.knowledgeBaseId)

    @application.post("/v1/desktop/knowledge-base/remove")
    async def remove_knowledge_base(request: KnowledgeBaseScopeRequest) -> dict[str, Any]:
        """删除知识库索引；输入精确 scope，返回固定结果，失败时抛出无诊断 503。"""

        try:
            return await controller.remove(request.knowledgeBaseId)
        except Exception as error:
            logging.warning("Private knowledge base remove failed: %s", type(error).__name__)
            raise HTTPException(status_code=503, detail="Knowledge base runtime is unavailable.") from error

    @application.post("/v1/desktop/knowledge-base/query")
    async def query_knowledge_base(request: KnowledgeBaseQueryRequest) -> dict[str, Any]:
        """检索知识库；输入精确查询，返回有界脱敏结果，失败时抛出无诊断 503。"""

        try:
            return await controller.query(
                request.knowledgeBaseId,
                request.query,
                request.limit,
            )
        except Exception as error:
            logging.warning("Private knowledge base query failed: %s", type(error).__name__)
            raise HTTPException(status_code=503, detail="Knowledge base runtime is unavailable.") from error

    return {"controller": controller}
