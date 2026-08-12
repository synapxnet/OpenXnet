#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright 2026 Synapxnet
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
# ==============================================================================
"""
MCP 客户端 — Model Context Protocol 标准客户端。

Author: maoyo
Date: 2026-04-13
Version: 1.0.0
"""

__version__ = "1.0.0"
__author__ = "maoyo"
__copyright__ = "Copyright 2026 Synapxnet"
__license__ = "Apache-2.0"
__maintainer__ = "maoyo"
__email__ = "synapxnet@gmail.com"

# mcp_client_fixed.py
import json
import asyncio
import logging
import shutil
import subprocess
from typing import Dict, Any, AsyncIterator, Optional

import anyio
import httpx
from mcp import ClientSession
from mcp.client.stdio   import stdio_client
from mcp.client.sse     import sse_client
from mcp.client.websocket import websocket_client
from mcp.client.streamable_http import streamablehttp_client
from contextlib import AsyncExitStack, asynccontextmanager


def create_no_redirect_http_client(
    headers=None,
    timeout=None,
    auth=None,
) -> httpx.AsyncClient:
    """Create one MCP HTTP client that never forwards credentials through redirects."""

    options = {
        "follow_redirects": False,
        "timeout": timeout or httpx.Timeout(30.0, read=300.0),
    }
    if headers is not None:
        options["headers"] = headers
    if auth is not None:
        options["auth"] = auth
    return httpx.AsyncClient(**options)

# ---------- 工具 ----------
def get_command_path(command_name: str, default_command: str = "uv") -> str:
    """Resolve one configured MCP command from the current executable path."""

    path = shutil.which(command_name) or shutil.which(default_command)
    if not path:
        raise FileNotFoundError(f"未找到 {command_name} 或 {default_command}")
    return path

# ---------- 连接管理 ----------
class ConnectionManager:
    def __init__(self) -> None:
        """创建未连接的 MCP 传输管理器；无输入和返回，不启动子进程或网络连接。"""

        self.session: Optional[ClientSession] = None
        self.tools: list[str] = []

    @asynccontextmanager
    async def connect(self, config: dict) -> AsyncIterator["ConnectionManager"]:
        """打开并初始化一个 MCP 传输；输入连接配置，返回会话上下文，失败时关闭已分配资源并抛出异常。"""

        async with AsyncExitStack() as stack:
            # 1. 建立传输层
            if "command" in config:
                from mcp.client.stdio import StdioServerParameters
                server_params = StdioServerParameters(
                    command=get_command_path(config["command"]),
                    args=config.get("args", []),
                    env=config.get("env"),
                )
                read, write = await stack.enter_async_context(
                    stdio_client(server_params, errlog=subprocess.DEVNULL)
                )
            else:
                mcptype = config.get("type", "ws")
                if "streamable" in mcptype:
                    mcptype = "streamablehttp"
                client_map = {
                    "ws": websocket_client,
                    "sse": sse_client,
                    "streamablehttp": streamablehttp_client,
                }
                headers = config.get("headers", {})
                client_options = {}
                if (
                    config.get("follow_redirects") is False
                    and mcptype in {"sse", "streamablehttp"}
                ):
                    client_options["httpx_client_factory"] = create_no_redirect_http_client
                client = client_map[mcptype](
                    config["url"], headers=headers, **client_options
                ) if headers else client_map[mcptype](config["url"], **client_options)

                transport = await stack.enter_async_context(client)

                # ---------- END ----------

                if mcptype == "streamablehttp":
                    read, write, _ = transport
                else:
                    read, write = transport
                # ---------- 首包校验（仅 SSE 需要） ----------
                if mcptype == "sse":
                    try:
                        # 非阻塞读 1 条消息，超时 3 秒
                        with anyio.move_on_after(3):
                            await read.receive()
                    except anyio.EndOfStream:
                        # 服务器立刻关闭，说明失败
                        raise RuntimeError("SSE stream closed immediately")
                    except Exception as e:
                        raise RuntimeError("SSE initial handshake failed.") from e
            # 2. 建立会话
            self.session = await stack.enter_async_context(ClientSession(read, write))
            await self.session.initialize()
            self.tools = [t.name for t in (await self.session.list_tools()).tools]
            logging.info("Connected to MCP server. Tools: %s", self.tools)

            yield self


# ---------- 客户端 ----------
class McpClient:
    def __init__(self) -> None:
        """创建可重连 MCP 客户端；无输入和返回，不启动传输或后台任务。"""

        self._conn: Optional[ConnectionManager] = None
        self._config: Optional[dict] = None
        self._lock = asyncio.Lock()
        self._monitor_task: Optional[asyncio.Task] = None
        self._shutdown = False
        self._on_failure_callback: Optional[callable] = None  # 新增：失败回调
        self._tools: list[str] = []
        self._tools_list = []
        self._ready_event = asyncio.Event()

    @property
    def is_ready(self) -> bool:
        """返回当前是否存在已初始化会话；无输入和副作用，不触发连接或重连。"""

        return self._ready_event.is_set()

    async def initialize(self, server_name: str, server_config: dict, on_failure_callback: Optional[callable] = None) -> None:
        """启动一个服务配置的重连监视器；输入名称、配置和失败回调，无返回，重复调用会复用活动任务。"""

        self._config = server_config
        self._on_failure_callback = on_failure_callback  # 设置回调
        self._shutdown = False
        if self._monitor_task is None or self._monitor_task.done():
            self._monitor_task = asyncio.create_task(self._connection_monitor())

    async def wait_until_ready(self, timeout: float = 8.0) -> None:
        """等待 MCP 会话和工具清单就绪；输入秒级超时，无返回，超时或无效预算时抛出固定异常。"""

        if timeout <= 0 or timeout > 60:
            raise ValueError("MCP readiness timeout is invalid.")
        try:
            await asyncio.wait_for(self._ready_event.wait(), timeout=timeout)
        except asyncio.TimeoutError as error:
            raise RuntimeError("MCP client did not become ready.") from error

    async def close(self) -> None:
        """停止重连并关闭活动会话；无输入和返回，可重复调用，取消异常在边界内吸收。"""

        self._shutdown = True
        self._ready_event.clear()
        if self._monitor_task and not self._monitor_task.done():
            self._monitor_task.cancel()
            try:
                await self._monitor_task
            except asyncio.CancelledError:
                pass
        self._monitor_task = None
        self._tools = []
        self._tools_list = []

    async def _connection_monitor(self) -> None:
        """在单一资源栈内维持 MCP 重连；无输入和返回，连接错误只报告固定失败并按间隔重试。"""

        while not self._shutdown:
            try:
                async with ConnectionManager().connect(self._config) as conn:
                    async with self._lock:
                        self._conn = conn
                        self._tools = list(conn.tools)
                    self._ready_event.set()
                    # 心跳检测
                    while not self._shutdown:
                        try:
                            await asyncio.wait_for(self._conn.session.send_ping(), timeout=3)
                        except Exception:
                            break  # 断线，跳出 inner loop
                        await asyncio.sleep(30)
            except Exception as e:
                logging.error("MCP connection failed and will retry: %s", type(e).__name__)
                if self._on_failure_callback:
                    await self._on_failure_callback("MCP connection failed")
            finally:
                self._ready_event.clear()
                async with self._lock:
                    self._conn = None
            if not self._shutdown:
                await asyncio.sleep(5)

    # ---------- 外部 API ----------
    async def get_openai_functions(self, disable_tools=None):
        """读取启用工具的 OpenAI schema；输入可选禁用名单，返回可序列化列表，未连接时返回空列表。"""

        disabled = set(disable_tools or [])
        async with self._lock:
            if not self._conn or not self._conn.session:
                return []
            tools = (await self._conn.session.list_tools()).tools
            self._tools = [t.name for t in tools]
            self._tools_list = [{"name": t.name, "description": t.description,"enabled":True} for t in tools]
            tools_list = []
            for t in tools:
                if t.name not in disabled:
                    tools_list.append(
                        {
                            "type": "function",
                            "function": {
                                "name": t.name,
                                "description": t.description,
                                "parameters": t.inputSchema,
                            },
                        }
                    )

            return tools_list

    async def call_tool(self, tool_name: str, tool_params: Dict[str, Any]) -> Any:
        """调用一个已连接 MCP 工具；输入名称和参数，返回 SDK 结果，断开时返回 None 且供应商失败固定脱敏。"""

        async with self._lock:
            if not self._conn or not self._conn.session:
                return None
            try:
                return await self._conn.session.call_tool(tool_name, tool_params)
            except Exception as e:
                logging.error("Failed to call MCP tool %s: %s", tool_name, type(e).__name__)
                return "MCP tool call failed"


# ---------- 使用示例 ----------
if __name__ == "__main__":
    import logging
    logging.basicConfig(level=logging.INFO)

    async def main():
        """运行本地 MCP 连通性示例；无输入和返回，会建立连接并在演示结束后关闭。"""

        client = McpClient()
        await client.initialize(
            "example",
            {
                "type": "sse",
                "url": "http://127.0.0.1:8000/mcp",
            },
        )
        await asyncio.sleep(2)
        funcs = await client.get_openai_functions()
        print("OpenAI functions:", funcs)
        await asyncio.sleep(30)  # 保持连接
        await client.close()

    asyncio.run(main())
