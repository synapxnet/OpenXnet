# -*- coding: utf-8 -*-
"""Authenticated route boundary for the independently supervised execution engine."""

from __future__ import annotations

from collections.abc import Callable
import hmac
from typing import Any
from urllib.parse import urlsplit

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from py.chat_engine_api import CHAT_ENGINE_PATHS
from py.enterprise_insights_engine_api import ENTERPRISE_INSIGHTS_ENGINE_PATHS
from py.kernel_engine_api import KERNEL_ENGINE_PATHS
from py.knowledge_base_engine_api import KNOWLEDGE_BASE_ENGINE_PATHS
from py.task_http_profile import TASK_EXECUTION_BROKER_PATHS


EXECUTION_ENGINE_HEALTH_PATH = "/health"
EXECUTION_ENGINE_ALLOWED_PATHS = frozenset({
    EXECUTION_ENGINE_HEALTH_PATH,
    *CHAT_ENGINE_PATHS,
    *ENTERPRISE_INSIGHTS_ENGINE_PATHS,
    *KERNEL_ENGINE_PATHS,
    *KNOWLEDGE_BASE_ENGINE_PATHS,
    *TASK_EXECUTION_BROKER_PATHS,
})


def create_execution_engine_application(
    *,
    lifespan: Callable[..., Any],
    token: str,
) -> FastAPI:
    """Create an exact-route ASGI application protected by one process token."""

    expected_token = str(token or "").strip()
    if not expected_token:
        raise RuntimeError("Execution Engine requires OPENXNET_TASK_RPC_TOKEN.")
    application = FastAPI(
        lifespan=lifespan,
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )

    @application.middleware("http")
    async def enforce_execution_engine_boundary(request: Request, call_next):
        """Reject every non-loopback, unknown, unauthenticated, or wrong-method request."""

        path = str(request.url.path or "")
        if path not in EXECUTION_ENGINE_ALLOWED_PATHS or request.url.query:
            return _error_response(404, "Not Found")
        if not _is_allowed_host(str(request.headers.get("host") or "")):
            return _error_response(403, "Execution Engine host is not allowed.")
        expected_method = "GET" if path == EXECUTION_ENGINE_HEALTH_PATH else "POST"
        if request.method != expected_method:
            return _error_response(405, "Execution Engine method is not allowed.")
        if not _is_authorized(
            str(request.headers.get("authorization") or ""),
            expected_token,
        ):
            return _error_response(401, "Execution Engine authentication failed.")
        return await call_next(request)

    @application.get(EXECUTION_ENGINE_HEALTH_PATH)
    async def execution_engine_health() -> dict[str, str]:
        """Return the minimal readiness state after ASGI lifespan startup completes."""

        return {"status": "ready", "profile": "execution-engine"}

    return application


def _is_allowed_host(host_header: str) -> bool:
    """Accept only a syntactically valid loopback Host header with an explicit port."""

    try:
        parsed = urlsplit(f"//{host_header.strip()}")
        port = parsed.port
    except ValueError:
        return False
    return (
        parsed.hostname in {"127.0.0.1", "localhost", "::1"}
        and port is not None
        and not parsed.username
        and not parsed.password
    )


def _is_authorized(authorization: str, expected_token: str) -> bool:
    """Compare an exact Bearer credential without token-prefix timing leakage."""

    prefix = "Bearer "
    if not authorization.startswith(prefix):
        return False
    return hmac.compare_digest(authorization[len(prefix):], expected_token)


def _error_response(status_code: int, detail: str) -> JSONResponse:
    """Return one bounded non-cacheable profile-boundary failure."""

    return JSONResponse(
        status_code=status_code,
        content={"detail": detail},
        headers={"Cache-Control": "no-store"},
    )
