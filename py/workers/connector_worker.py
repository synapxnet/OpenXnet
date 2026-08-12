# -*- coding: utf-8 -*-
"""OpenXnet Connector Worker owning optional message-platform SDK lifecycles."""

from __future__ import annotations

import argparse
import asyncio
from collections.abc import Callable, Mapping
from dataclasses import dataclass
import importlib
import json
import sys
from typing import Any

from py.get_setting import configure_host_port
from py.connector_credentials import apply_connector_credentials
from py.telegram_credentials import apply_telegram_credential_to_configuration
from py.workers.runtime import WorkerRuntime


SUPPORTED_CONNECTORS = ("qq", "feishu", "dingtalk", "discord", "slack", "telegram")
CONNECTOR_SDK_MODULES = {
    "qq": ("botpy", "botpy.message"),
    "feishu": ("lark_oapi", "lark_oapi.api.im.v1", "lark_oapi.ws"),
    "dingtalk": ("dingtalk_stream",),
    "discord": ("discord", "discord.ext.commands", "discord.ext.tasks"),
    "slack": (
        "slack_sdk.web.async_client",
        "slack_sdk.socket_mode.aiohttp",
        "slack_sdk.socket_mode.request",
        "slack_sdk.socket_mode.response",
    ),
    "telegram": ("aiohttp", "openai", "pydub"),
}
MAX_CONNECTOR_CONFIG_BYTES = 256 * 1024


@dataclass(frozen=True, slots=True)
class ConnectorBinding:
    """描述一个连接器 Manager 的延迟导入坐标。"""

    module_name: str
    manager_class_name: str
    config_class_name: str


DEFAULT_CONNECTOR_BINDINGS: Mapping[str, ConnectorBinding] = {
    "qq": ConnectorBinding("py.qq_bot_manager", "QQBotManager", "QQBotConfig"),
    "feishu": ConnectorBinding(
        "py.feishu_bot_manager",
        "FeishuBotManager",
        "FeishuBotConfig",
    ),
    "dingtalk": ConnectorBinding(
        "py.dingtalk_bot_manager",
        "DingtalkBotManager",
        "DingtalkBotConfig",
    ),
    "discord": ConnectorBinding(
        "py.discord_bot_manager",
        "DiscordBotManager",
        "DiscordBotConfig",
    ),
    "slack": ConnectorBinding(
        "py.slack_bot_manager",
        "SlackBotManager",
        "SlackBotConfig",
    ),
    "telegram": ConnectorBinding(
        "py.telegram_bot_manager",
        "TelegramBotManager",
        "TelegramBotConfig",
    ),
}

ConnectorTypeLoader = Callable[[ConnectorBinding], tuple[type[Any], type[Any]]]


class ConnectorWorkerHandlers:
    """校验连接器控制请求并持有长生命周期 Manager 实例。"""

    def __init__(
        self,
        *,
        bindings: Mapping[str, ConnectorBinding] | None = None,
        type_loader: ConnectorTypeLoader | None = None,
        max_config_bytes: int = MAX_CONNECTOR_CONFIG_BYTES,
    ) -> None:
        """创建延迟加载处理器；输入可替换绑定和预算，无返回，不导入 SDK，参数异常由后续请求报告。"""

        self._bindings = dict(bindings or DEFAULT_CONNECTOR_BINDINGS)
        self._type_loader = type_loader or self._import_connector_types
        self._max_config_bytes = max_config_bytes
        self._connector_types: dict[str, tuple[type[Any], type[Any]]] = {}
        self._managers: dict[str, Any] = {}
        self._secret_values: dict[str, tuple[str, ...]] = {}

    def status(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """查询平台状态；输入控制载荷，返回无凭据快照，平台无效时抛出 ValueError 且不导入未使用 SDK。"""

        platform_name = self._read_platform(payload.get("platform"))
        return self._status_payload(platform_name)

    def dependencies(self, _payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """离线导入打包依赖；忽略输入载荷，返回各平台可用性，单个平台导入失败只标记为不可用。"""

        available: dict[str, bool] = {}
        for platform_name, module_names in CONNECTOR_SDK_MODULES.items():
            try:
                for module_name in module_names:
                    importlib.import_module(module_name)
                connector_types = self._type_loader(self._bindings[platform_name])
                self._connector_types[platform_name] = connector_types
                available[platform_name] = True
            except (AttributeError, ImportError):
                available[platform_name] = False
        return {
            "supportedPlatforms": list(SUPPORTED_CONNECTORS),
            "dependencies": available,
        }

    async def start(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """校验配置并启动 Manager；输入平台、配置和端口，返回脱敏状态，启动异常会清除凭据值后抛出。"""

        platform_name = self._read_platform(payload.get("platform"))
        configuration = self._hydrate_credentials(
            platform_name,
            self._read_configuration(payload.get("configuration")),
        )
        self._configure_backend_port(payload.get("backendPort"))
        manager, config_type = self._get_manager(platform_name)
        secrets = self._collect_secret_values(configuration)
        self._secret_values[platform_name] = secrets
        try:
            config = config_type(**configuration)
            await asyncio.to_thread(manager.start_bot, config)
        except Exception as error:
            message = self._sanitize_text(str(error) or error.__class__.__name__, secrets)
            raise RuntimeError(message) from error
        return self._status_payload(platform_name)

    async def stop(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """停止活动平台；输入平台载荷，返回脱敏状态，未实例化时直接成功，停止异常会脱敏后抛出。"""

        platform_name = self._read_platform(payload.get("platform"))
        manager = self._managers.get(platform_name)
        if manager is None:
            return self._status_payload(platform_name)
        try:
            await asyncio.to_thread(manager.stop_bot)
        except Exception as error:
            secrets = self._secret_values.get(platform_name, ())
            message = self._sanitize_text(str(error) or error.__class__.__name__, secrets)
            raise RuntimeError(message) from error
        return self._status_payload(platform_name)

    async def reload(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """使用新配置重启平台；输入完整启动载荷，返回脱敏状态，停止或启动失败会向上抛出安全异常。"""

        platform_name = self._read_platform(payload.get("platform"))
        if platform_name in self._managers:
            await self.stop({"platform": platform_name})
            await asyncio.sleep(1)
        return await self.start(payload)

    async def update(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """热更新运行中平台行为配置；输入平台和配置，返回更新标志，未运行时不导入或启动 Manager。"""

        platform_name = self._read_platform(payload.get("platform"))
        manager = self._managers.get(platform_name)
        if manager is None or not self._manager_is_running(manager):
            return {"platform": platform_name, "updated": False, "is_running": False}
        configuration = self._hydrate_credentials(
            platform_name,
            self._read_configuration(payload.get("configuration")),
        )
        _, config_type = self._get_manager(platform_name)
        update_method = getattr(manager, "update_behavior_config", None)
        if not callable(update_method):
            return {"platform": platform_name, "updated": False, "is_running": True}
        secrets = self._collect_secret_values(configuration)
        self._secret_values[platform_name] = secrets
        try:
            config = config_type(**configuration)
            await asyncio.to_thread(update_method, config)
        except Exception as error:
            message = self._sanitize_text(str(error) or error.__class__.__name__, secrets)
            raise RuntimeError(message) from error
        return {"platform": platform_name, "updated": True, "is_running": True}

    async def stop_all(self, _payload: Mapping[str, Any] | None = None) -> Mapping[str, Any]:
        """停止全部已实例化平台；输入可忽略，返回停止平台列表，各平台停止失败互相隔离。"""

        tasks = [
            asyncio.to_thread(manager.stop_bot)
            for manager in tuple(self._managers.values())
        ]
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        stopped_platforms = sorted(self._managers)
        return {"stoppedPlatforms": stopped_platforms}

    def _get_manager(self, platform_name: str) -> tuple[Any, type[Any]]:
        """延迟创建 Manager；输入平台名，返回 Manager 与配置类型，导入或构造失败时直接抛出异常。"""

        connector_types = self._connector_types.get(platform_name)
        if connector_types is None:
            connector_types = self._type_loader(self._bindings[platform_name])
            self._connector_types[platform_name] = connector_types
        manager_type, config_type = connector_types
        manager = self._managers.get(platform_name)
        if manager is None:
            manager = manager_type()
            self._managers[platform_name] = manager
        return manager, config_type

    def _import_connector_types(
        self,
        binding: ConnectorBinding,
    ) -> tuple[type[Any], type[Any]]:
        """导入 Manager 和配置类；输入绑定，返回两个类型，模块缺失或导出无效时抛出异常。"""

        module = importlib.import_module(binding.module_name)
        manager_type = getattr(module, binding.manager_class_name)
        config_type = getattr(module, binding.config_class_name)
        if not isinstance(manager_type, type) or not isinstance(config_type, type):
            raise TypeError(f"Connector module '{binding.module_name}' has invalid classes.")
        return manager_type, config_type

    def _read_platform(self, value: Any) -> str:
        """规范并校验平台；输入任意值，返回小写平台名，空值或不在允许列表时抛出 ValueError。"""

        if not isinstance(value, str) or not value.strip():
            raise ValueError("Connector platform must be non-empty text.")
        platform_name = value.strip().lower()
        if platform_name not in self._bindings:
            raise ValueError(f"Unsupported connector platform '{platform_name}'.")
        return platform_name

    def _read_configuration(self, value: Any) -> dict[str, Any]:
        """校验有界配置；输入任意值，返回浅拷贝，类型错误或 UTF-8 序列化超预算时抛出 ValueError。"""

        if not isinstance(value, Mapping):
            raise ValueError("Connector configuration must be a JSON object.")
        configuration = dict(value)
        encoded = json.dumps(configuration, ensure_ascii=False).encode("utf-8")
        if len(encoded) > self._max_config_bytes:
            raise ValueError("Connector configuration exceeds the size limit.")
        return configuration

    def _configure_backend_port(self, value: Any) -> None:
        """设置 Server 兼容调用端口；输入端口，无返回，范围或类型无效时抛出 ValueError。"""

        if isinstance(value, bool) or not isinstance(value, int) or not 1 <= value <= 65535:
            raise ValueError("Connector backendPort must be an integer from 1 to 65535.")
        configure_host_port("127.0.0.1", value)

    def _hydrate_credentials(
        self,
        platform_name: str,
        configuration: Mapping[str, Any],
    ) -> dict[str, Any]:
        """按平台注入独立凭据；输入不变，配置缺失或凭据包无效时抛出固定异常。"""

        if platform_name == "telegram":
            return apply_telegram_credential_to_configuration(configuration)
        return apply_connector_credentials(platform_name, configuration)

    def _status_payload(self, platform_name: str) -> Mapping[str, Any]:
        """构建稳定状态；输入平台名，返回递归脱敏对象，Manager 查询失败时返回安全错误状态。"""

        manager = self._managers.get(platform_name)
        if manager is None:
            return {"platform": platform_name, "is_running": False, "status": "stopped"}
        try:
            raw_status = manager.get_status()
        except Exception as error:
            secrets = self._secret_values.get(platform_name, ())
            return {
                "platform": platform_name,
                "is_running": False,
                "status": "error",
                "error_message": self._sanitize_text(str(error), secrets),
            }
        status = dict(raw_status) if isinstance(raw_status, Mapping) else {}
        status.pop("config", None)
        status["platform"] = platform_name
        status.setdefault("is_running", False)
        status.setdefault("status", "running" if status["is_running"] else "stopped")
        return self._sanitize_mapping(status, self._secret_values.get(platform_name, ()))

    def _manager_is_running(self, manager: Any) -> bool:
        """读取 Manager 运行标志；输入 Manager，返回布尔值，查询异常时返回 False 且不暴露配置。"""

        try:
            status = manager.get_status()
        except Exception:
            return False
        return isinstance(status, Mapping) and bool(status.get("is_running", False))

    def _collect_secret_values(self, value: Mapping[str, Any]) -> tuple[str, ...]:
        """收集配置中的密钥字符串；输入映射，返回按长度排序的去重元组，不修改原配置。"""

        secrets: set[str] = set()
        pending: list[tuple[str, Any]] = [("", value)]
        while pending:
            field_name, candidate = pending.pop()
            if isinstance(candidate, Mapping):
                pending.extend((str(key), item) for key, item in candidate.items())
            elif isinstance(candidate, list):
                pending.extend((field_name, item) for item in candidate)
            elif self._is_sensitive_field(field_name) and isinstance(candidate, str):
                if len(candidate) >= 4:
                    secrets.add(candidate)
        return tuple(sorted(secrets, key=len, reverse=True))

    def _sanitize_mapping(
        self,
        value: Mapping[str, Any],
        secrets: tuple[str, ...],
    ) -> dict[str, Any]:
        """递归清理状态映射；输入映射和已知密钥，返回副本，敏感字段与值统一替换为占位符。"""

        sanitized: dict[str, Any] = {}
        for key, candidate in value.items():
            key_text = str(key)
            if self._is_sensitive_field(key_text):
                sanitized[key_text] = "[redacted]"
            elif isinstance(candidate, Mapping):
                sanitized[key_text] = self._sanitize_mapping(candidate, secrets)
            elif isinstance(candidate, list):
                sanitized[key_text] = [
                    self._sanitize_mapping(item, secrets)
                    if isinstance(item, Mapping)
                    else self._sanitize_text(item, secrets)
                    if isinstance(item, str)
                    else item
                    for item in candidate
                ]
            elif isinstance(candidate, str):
                sanitized[key_text] = self._sanitize_text(candidate, secrets)
            else:
                sanitized[key_text] = candidate
        return sanitized

    def _is_sensitive_field(self, field_name: str) -> bool:
        """判断字段名是否通常承载密钥；输入字段名，返回布尔值，无副作用且不抛出异常。"""

        normalized = "".join(character for character in field_name.lower() if character.isalnum())
        return any(marker in normalized for marker in ("secret", "token", "password"))

    def _sanitize_text(self, value: str, secrets: tuple[str, ...]) -> str:
        """替换诊断文本中的已知凭据；输入文本和密钥元组，返回脱敏副本，无副作用。"""

        sanitized = value
        for secret in secrets:
            sanitized = sanitized.replace(secret, "[redacted]")
        return sanitized


def parse_arguments() -> argparse.Namespace:
    """解析独立 Worker 命令行参数；无输入，返回参数对象，参数无效时由 argparse 终止进程。"""

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--max-config-bytes",
        type=int,
        default=MAX_CONNECTOR_CONFIG_BYTES,
    )
    return parser.parse_args()


async def run() -> None:
    """启动 Worker RPC 循环并隔离 Manager 标准输出；无输入和返回，关闭时停止全部连接器。"""

    arguments = parse_arguments()
    protocol_output = sys.stdout
    sys.stdout = sys.stderr
    handlers = ConnectorWorkerHandlers(max_config_bytes=arguments.max_config_bytes)
    runtime = WorkerRuntime("connectors", output=protocol_output)
    runtime.register_handler("connectors.status", handlers.status)
    runtime.register_handler("connectors.dependencies", handlers.dependencies)
    runtime.register_handler("connectors.start", handlers.start)
    runtime.register_handler("connectors.stop", handlers.stop)
    runtime.register_handler("connectors.reload", handlers.reload)
    runtime.register_handler("connectors.update", handlers.update)
    runtime.register_handler("connectors.stop-all", handlers.stop_all)
    try:
        await runtime.serve_stdio()
    finally:
        await handlers.stop_all()


if __name__ == "__main__":
    asyncio.run(run())
