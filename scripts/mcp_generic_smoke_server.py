# -*- coding: utf-8 -*-
"""为 MCP Feature Pack smoke 提供带认证的本地 Streamable HTTP Server。"""

from __future__ import annotations

import argparse
import os
from typing import Any

from mcp.server.fastmcp import FastMCP
from starlette.requests import Request
from starlette.responses import JSONResponse
import uvicorn


SMOKE_TOKEN_ENV = "OPENXNET_GENERIC_MCP_SMOKE_TOKEN"


def parse_arguments() -> argparse.Namespace:
    """解析 smoke 服务端口；无输入，返回参数对象，无效参数由 argparse 终止进程。"""

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, required=True)
    return parser.parse_args()


def build_smoke_server() -> FastMCP:
    """创建通用 MCP smoke 服务；无输入，返回只含固定回显工具的 Server，不打开端口。"""

    server = FastMCP(
        "OpenXnet Phase 3AR Generic MCP Smoke",
        host="127.0.0.1",
        streamable_http_path="/mcp",
        json_response=True,
        stateless_http=True,
        log_level="WARNING",
    )

    @server.tool()
    def phase3ar_echo(value: str) -> dict[str, str]:
        """回显 Phase 3AR smoke 文本；输入任意文本，返回固定状态和原值，无外部副作用。"""

        return {"status": "phase3ar-ready", "value": value}

    return server


def build_authenticated_app(server: FastMCP, expected_token: str) -> Any:
    """构建带 Bearer 校验的 ASGI 应用；输入 Server 和 token，返回应用，未认证请求固定返回 401。"""

    application = server.streamable_http_app()

    @application.middleware("http")
    async def require_smoke_auth(request: Request, call_next: Any) -> Any:
        """校验 smoke 请求认证；输入请求和后续处理器，返回响应，认证失败时不进入 MCP Server。"""

        if request.headers.get("authorization") != f"Bearer {expected_token}":
            return JSONResponse({"error": "unauthorized"}, status_code=401)
        return await call_next(request)

    return application


def main() -> int:
    """启动本地 smoke 服务；无输入，正常退出返回零，缺少私有 token 时抛出 RuntimeError。"""

    arguments = parse_arguments()
    token = str(os.environ.pop(SMOKE_TOKEN_ENV, "") or "").strip()
    if not token:
        raise RuntimeError("Generic MCP smoke token is missing.")
    application = build_authenticated_app(build_smoke_server(), token)
    uvicorn.run(
        application,
        host="127.0.0.1",
        port=arguments.port,
        log_level="warning",
        access_log=False,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
