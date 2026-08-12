# -*- coding: utf-8 -*-
"""独立 AgentTeams Feature Pack Worker，通过固定 agt 命令管理团队资源。"""

from __future__ import annotations

import argparse
import asyncio
from collections.abc import Mapping
import os
from pathlib import Path
import sys
from typing import Any

from py.agentteams_runtime import AgentTeamsCliAdapter
from py.workers.runtime import WorkerRuntime


class AgentTeamsWorkerHandlers:
    """校验 Worker 方法字段并委托 AgentTeams CLI 适配器。"""

    def __init__(self, adapter: AgentTeamsCliAdapter) -> None:
        """保存适配器；输入适配器，无返回，不启动外部命令。"""

        self._adapter = adapter

    def status(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """读取 AgentTeams 状态；输入必须为空对象，返回公开状态，额外字段时抛出异常。"""

        self._require_empty(payload)
        return self._adapter.status()

    def apply_team(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """同步一个结构化 Team；输入有界请求，返回团队状态，适配失败时抛出异常。"""

        return self._adapter.apply_team(payload)

    def get_team(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """查询一个 Team；输入资源名称，返回团队状态，适配失败时抛出异常。"""

        return self._adapter.get_team(payload)

    def _require_empty(self, payload: Mapping[str, Any]) -> None:
        """校验空请求；输入映射，无返回，存在字段时抛出 ValueError。"""

        if payload:
            raise ValueError("AgentTeams status request must be empty.")


def parse_arguments() -> argparse.Namespace:
    """解析 Main 注入的映射目录；无输入，返回参数对象，非法参数由 argparse 终止。"""

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mapping-root", type=Path, required=True)
    return parser.parse_args()


def configure_utf8_standard_streams() -> None:
    """把标准流固定为 UTF-8/LF；无输入和返回，不支持 reconfigure 的流保持原样。"""

    for stream in (sys.stdin, sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            reconfigure(encoding="utf-8", errors="strict", newline="\n")


async def run() -> None:
    """启动 AgentTeams Worker RPC；无输入和返回，协议结束时退出进程。"""

    arguments = parse_arguments()
    configure_utf8_standard_streams()
    protocol_output = sys.stdout
    sys.stdout = sys.stderr
    adapter = AgentTeamsCliAdapter(
        arguments.mapping_root,
        executable=os.environ.get("OPENXNET_AGENTTEAMS_CLI"),
    )
    handlers = AgentTeamsWorkerHandlers(adapter)
    runtime = WorkerRuntime("agentteams", output=protocol_output)
    runtime.register_handler("agentteams.status", handlers.status)
    runtime.register_handler("agentteams.team.apply", handlers.apply_team)
    runtime.register_handler("agentteams.team.get", handlers.get_team)
    await runtime.serve_stdio()


if __name__ == "__main__":
    asyncio.run(run())
