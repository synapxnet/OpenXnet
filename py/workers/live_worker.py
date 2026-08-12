# -*- coding: utf-8 -*-
"""独立 Live Worker，持有直播传输生命周期并发布有界弹幕事件。"""

from __future__ import annotations

import argparse
import asyncio
from collections.abc import Mapping
import importlib
import json
import sys
from typing import Any

from py.workers.runtime import WorkerRuntime


MAX_LIVE_CONFIGURATION_BYTES = 128 * 1024
LIVE_DEPENDENCY_MODULES = (
    "aiohttp",
    "py.blivedm",
    "py.ytdm",
    "py.twitch_service",
)


class LiveWorkerHandlers:
    """校验 Live Worker 请求并委托框架无关控制器。"""

    def __init__(self, controller: Any, max_config_bytes: int = MAX_LIVE_CONFIGURATION_BYTES) -> None:
        """保存控制器和字节预算；输入依赖，无返回，不启动直播传输。"""

        self._controller = controller
        self._max_config_bytes = max_config_bytes

    def status(self, _payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """查询直播状态；忽略输入，返回无凭据映射，不启动任何传输。"""

        return self._serialize_result(self._controller.status())

    def dependencies(self, _payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """离线检查打包依赖；忽略输入，返回模块可用性，导入失败只标记为 False。"""

        available: dict[str, bool] = {}
        for module_name in LIVE_DEPENDENCY_MODULES:
            try:
                importlib.import_module(module_name)
                available[module_name] = True
            except ImportError:
                available[module_name] = False
        return {"dependencies": available}

    async def start(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """启动所选直播平台；输入含 configuration 的载荷，返回安全状态，配置无效时抛出 ValueError。"""

        configuration = self._read_configuration(payload)
        return self._serialize_result(await self._controller.start(configuration))

    async def stop(self, _payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """停止所有直播平台；忽略输入，返回安全状态，控制器负责隔离供应商清理异常。"""

        return self._serialize_result(await self._controller.stop())

    async def reload(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """重载所选直播平台；输入含 configuration 的载荷，返回安全状态，失败后保持清理状态。"""

        configuration = self._read_configuration(payload)
        return self._serialize_result(await self._controller.reload(configuration))

    def _read_configuration(self, payload: Mapping[str, Any]) -> dict[str, Any]:
        """读取有界配置；输入 Worker 载荷，返回配置副本，字段、类型或字节预算无效时抛出 ValueError。"""

        if set(payload) != {"configuration"}:
            raise ValueError("Live Worker request fields are invalid.")
        configuration = payload.get("configuration")
        if not isinstance(configuration, Mapping):
            raise ValueError("Live Worker configuration must be an object.")
        detached = dict(configuration)
        encoded = json.dumps(detached, ensure_ascii=False).encode("utf-8")
        if len(encoded) > self._max_config_bytes:
            raise ValueError("Live Worker configuration exceeds the size limit.")
        return detached

    def _serialize_result(self, result: Any) -> Mapping[str, Any]:
        """序列化控制器结果；输入结果模型或映射，返回防御性字典，类型无效时抛出 TypeError。"""

        if hasattr(result, "model_dump") and callable(result.model_dump):
            value = result.model_dump()
        elif isinstance(result, Mapping):
            value = dict(result)
        else:
            raise TypeError("Live controller result is invalid.")
        return value


def parse_arguments() -> argparse.Namespace:
    """解析 Worker 命令行参数；无输入，返回参数对象，无效参数由 argparse 终止进程。"""

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--max-config-bytes",
        type=int,
        default=MAX_LIVE_CONFIGURATION_BYTES,
    )
    return parser.parse_args()


def configure_utf8_standard_streams() -> None:
    """把冻结或解释器标准流固定为 UTF-8/LF；无输入和返回，不支持 reconfigure 的流保持原样。"""

    for stream in (sys.stdin, sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            reconfigure(encoding="utf-8", errors="strict", newline="\n")


async def run() -> None:
    """运行 Live Worker RPC；无输入和返回，退出时始终停止传输并隔离普通标准输出。"""

    arguments = parse_arguments()
    configure_utf8_standard_streams()
    protocol_output = sys.stdout
    sys.stdout = sys.stderr

    from py.live_runtime import LiveRuntimeController

    runtime = WorkerRuntime("live", output=protocol_output)

    async def emit_live_event(event: Mapping[str, Any]) -> None:
        """把控制器事件写入 Worker 协议；输入规范事件，无返回，写入失败由控制器记录。"""

        await runtime.emit_event("live.event", event)

    controller = LiveRuntimeController(emit_live_event)
    handlers = LiveWorkerHandlers(controller, arguments.max_config_bytes)
    runtime.register_handler("live.status", handlers.status)
    runtime.register_handler("live.dependencies", handlers.dependencies)
    runtime.register_handler("live.start", handlers.start)
    runtime.register_handler("live.stop", handlers.stop)
    runtime.register_handler("live.reload", handlers.reload)
    try:
        await runtime.serve_stdio()
    finally:
        await controller.stop()


if __name__ == "__main__":
    asyncio.run(run())
