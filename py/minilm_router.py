#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""OpenAI-compatible MiniLM HTTP adapter backed by Desktop Core Vector Worker."""

from __future__ import annotations

from typing import Any, Union

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from py.vector_worker_client import VectorWorkerClient, VectorWorkerClientError
from py.worker_capability_contracts import DEFAULT_MINILM_MODEL_NAME


MODEL_NAME = DEFAULT_MINILM_MODEL_NAME
router = APIRouter(prefix="/minilm", tags=["MiniLM Embeddings"])


class EmbeddingRequest(BaseModel):
    """OpenAI-compatible local embedding request."""

    input: Union[str, list[str]]
    model: str = MODEL_NAME


class EmbeddingData(BaseModel):
    """One indexed embedding in an OpenAI-compatible response."""

    object: str = "embedding"
    embedding: list[float]
    index: int


class EmbeddingResponse(BaseModel):
    """OpenAI-compatible embedding batch response."""

    object: str = "list"
    data: list[EmbeddingData]
    model: str
    usage: dict[str, Any]


@router.post("/embeddings", response_model=EmbeddingResponse)
async def create_embeddings(request: EmbeddingRequest) -> EmbeddingResponse:
    """Proxy local MiniLM inference while preserving the existing HTTP contract."""

    texts = [request.input] if isinstance(request.input, str) else request.input
    if not texts:
        raise HTTPException(status_code=422, detail="Embedding input cannot be empty.")
    try:
        result = await VectorWorkerClient.from_environment().embed(texts)
        embeddings = result.get("embeddings")
        if not isinstance(embeddings, list):
            raise VectorWorkerClientError(
                "INVALID_WORKER_RESPONSE",
                "Vector Worker did not return an embeddings array.",
                False,
            )
        data = [
            EmbeddingData(embedding=[float(value) for value in embedding], index=index)
            for index, embedding in enumerate(embeddings)
        ]
        prompt_tokens = int(result.get("promptTokens", 0))
        return EmbeddingResponse(
            object="list",
            model=request.model,
            data=data,
            usage={
                "prompt_tokens": prompt_tokens,
                "total_tokens": prompt_tokens,
                "inference_time_ms": int(result.get("inferenceTimeMs", 0)),
            },
        )
    except VectorWorkerClientError as error:
        status_code = 503 if error.retryable else 500
        raise HTTPException(status_code=status_code, detail=str(error)) from error
    except (TypeError, ValueError) as error:
        raise HTTPException(status_code=500, detail=f"Invalid embedding result: {error}") from error


@router.post("/reload")
async def reload_model() -> dict[str, str]:
    """Release Worker model and index memory while keeping the legacy route stable."""

    try:
        await VectorWorkerClient.from_environment().release()
        return {"msg": "reload triggered"}
    except VectorWorkerClientError as error:
        status_code = 503 if error.retryable else 500
        raise HTTPException(status_code=status_code, detail=str(error)) from error
