# -*- coding: utf-8 -*-
"""框架无关的 MCP 集成生命周期、工具清单与调用安全边界。"""

from __future__ import annotations

import asyncio
from collections.abc import Mapping
import hashlib
import ipaddress
import json
import logging
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
from typing import Any
import uuid
from urllib.parse import urlsplit, urlunsplit

from py.home_assistant_credentials import hydrate_home_assistant_config
from py.mcp_clients import McpClient
from py.mcp_credentials import hydrate_mcp_runtime_server_config
from py.sql_credentials import hydrate_sql_configuration


HOME_ASSISTANT_INTEGRATION = "home-assistant"
EXTERNAL_CHROME_INTEGRATION = "chrome-external"
SQL_INTEGRATION = "sql"
GENERIC_MCP_INTEGRATION_PREFIX = "generic:"
GENERIC_MCP_TRANSPORTS = frozenset({"sse", "streamable-http", "websocket"})
EXTERNAL_CHROME_PACKAGES = {
    "browser-mcp": "@browsermcp/mcp@0.1.3",
    "playwright-mcp": "@playwright/mcp@0.0.78",
}
EXTERNAL_CHROME_ENTRYPOINTS = {
    "browser-mcp": Path("node_modules") / "@browsermcp" / "mcp" / "dist" / "index.js",
    "playwright-mcp": Path("node_modules") / "@playwright" / "mcp" / "cli.js",
}
MCP_BROWSER_STORAGE_ENV = "OPENXNET_MCP_BROWSER_STORAGE_DIR"
MCP_NPM_CACHE_ENV = "OPENXNET_MCP_NPM_CACHE_DIR"
MCP_NODE_RUNTIME_SOURCE_ENV = "OPENXNET_MCP_NODE_RUNTIME_SOURCE_DIR"
MAX_MCP_CONFIGURATION_BYTES = 128 * 1024
MAX_MCP_TOOL_ARGUMENT_BYTES = 256 * 1024
MAX_MCP_TOOL_RESULT_BYTES = 2 * 1024 * 1024
MAX_MCP_TOOL_COUNT = 512
MAX_MCP_TOOL_NAME_LENGTH = 128
MAX_HOME_ASSISTANT_URL_LENGTH = 2048
MAX_MCP_NODE_LOCK_BYTES = 2 * 1024 * 1024

_node_runtime_install_lock = asyncio.Lock()


def _is_loopback_host(hostname: str) -> bool:
    """判断主机名是否为显式回环地址；输入主机名，返回布尔值，无网络查询和副作用。"""

    normalized = hostname.strip().lower().rstrip(".")
    if normalized == "localhost":
        return True
    try:
        return ipaddress.ip_address(normalized).is_loopback
    except ValueError:
        return False


def build_home_assistant_sse_url(value: Any) -> str:
    """构建 Home Assistant MCP SSE URL；输入基础地址，返回规范 URL，违反 TLS、凭据或长度策略时抛出 ValueError。"""

    raw_url = str(value or "").strip()
    if not raw_url or len(raw_url.encode("utf-8")) > MAX_HOME_ASSISTANT_URL_LENGTH:
        raise ValueError("Home Assistant URL is invalid.")
    try:
        parsed = urlsplit(raw_url)
        _ = parsed.port
    except ValueError as error:
        raise ValueError("Home Assistant URL is invalid.") from error
    scheme = parsed.scheme.lower()
    hostname = parsed.hostname or ""
    if (
        scheme not in {"http", "https"}
        or not hostname
        or parsed.username is not None
        or parsed.password is not None
        or parsed.query
        or parsed.fragment
    ):
        raise ValueError("Home Assistant URL is invalid.")
    if scheme == "http" and not _is_loopback_host(hostname):
        raise ValueError("External Home Assistant endpoints require HTTPS.")
    endpoint_path = f"{parsed.path.rstrip('/')}/mcp_server/sse"
    return urlunsplit((scheme, parsed.netloc, endpoint_path, "", ""))


def build_generic_mcp_client_configuration(
    integration: str,
    configuration: Mapping[str, Any],
) -> dict[str, Any]:
    """构建通用远程 MCP 客户端配置；输入动态集成和无密钥元数据，返回 Worker 私有配置，字段、URL 或 TLS 无效时抛出 ValueError。"""

    server_id = integration[len(GENERIC_MCP_INTEGRATION_PREFIX):]
    _validate_generic_mcp_server_id(server_id)
    detached = dict(configuration)
    if set(detached).difference({"transport", "url", "headers"}):
        raise ValueError("Generic MCP configuration fields are invalid.")
    transport = detached.get("transport")
    raw_url = detached.get("url")
    if not isinstance(transport, str) or transport not in GENERIC_MCP_TRANSPORTS:
        raise ValueError("Generic MCP transport is invalid.")
    if not isinstance(raw_url, str) or not raw_url.strip():
        raise ValueError("Generic MCP URL is invalid.")
    public_headers = _validate_generic_mcp_headers(detached.get("headers", {}), allow_sensitive=False)
    hydrated = hydrate_mcp_runtime_server_config(
        server_id,
        {"transport": transport, "url": raw_url.strip(), "headers": public_headers},
    )
    headers = _validate_generic_mcp_headers(hydrated.get("headers", {}), allow_sensitive=True)
    endpoint = _validate_generic_mcp_url(raw_url, transport)
    client_transport = {
        "sse": "sse",
        "streamable-http": "streamablehttp",
        "websocket": "ws",
    }[transport]
    return {
        "type": client_transport,
        "url": endpoint,
        "headers": headers,
        **({"follow_redirects": False} if transport != "websocket" else {}),
    }


def _validate_generic_mcp_server_id(value: Any) -> str:
    """校验通用 MCP Server scope；输入未知值，返回原标识，空白、控制字符或超长时抛出 ValueError。"""

    if (
        not isinstance(value, str)
        or not value
        or value != value.strip()
        or len(value) > 256
        or any(ord(character) < 32 or ord(character) == 127 for character in value)
    ):
        raise ValueError("Generic MCP server identifier is invalid.")
    return value


def _is_sensitive_generic_mcp_header(value: str) -> bool:
    """判断 header 名是否可能承载凭据；输入名称，返回布尔值，无副作用。"""

    normalized = value.strip().lower()
    return (
        normalized in {"authorization", "proxy-authorization", "cookie", "set-cookie"}
        or re.search(
            r"(^|[-_])(api[-_]?key|token|secret|password|passwd|credential|auth)([-_]|$)",
            normalized,
            re.IGNORECASE,
        ) is not None
    )


def _validate_generic_mcp_headers(value: Any, *, allow_sensitive: bool) -> dict[str, str]:
    """校验通用 MCP header；输入未知值和敏感字段策略，返回分离字典，名称、值或预算无效时抛出 ValueError。"""

    if not isinstance(value, Mapping) or len(value) > 64:
        raise ValueError("Generic MCP headers are invalid.")
    headers: dict[str, str] = {}
    for name, header_value in value.items():
        if (
            not isinstance(name, str)
            or re.fullmatch(r"[!#$%&'*+.^_`|~0-9A-Za-z-]{1,128}", name) is None
            or (not allow_sensitive and _is_sensitive_generic_mcp_header(name))
            or not isinstance(header_value, str)
            or len(header_value) > 8_192
            or any(ord(character) < 32 or ord(character) == 127 for character in header_value)
        ):
            raise ValueError("Generic MCP header is invalid.")
        headers[name] = header_value
    return headers


def _validate_generic_mcp_url(value: str, transport: str) -> str:
    """校验通用 MCP 端点；输入 URL 和传输，返回规范 URL，外部明文、凭据、查询或超限时抛出 ValueError。"""

    raw_url = value.strip()
    if len(raw_url.encode("utf-8")) > 2_048:
        raise ValueError("Generic MCP URL is invalid.")
    try:
        parsed = urlsplit(raw_url)
        _ = parsed.port
    except ValueError as error:
        raise ValueError("Generic MCP URL is invalid.") from error
    schemes = {"ws", "wss"} if transport == "websocket" else {"http", "https"}
    scheme = parsed.scheme.lower()
    hostname = parsed.hostname or ""
    if (
        scheme not in schemes
        or not hostname
        or parsed.username is not None
        or parsed.password is not None
        or parsed.query
        or parsed.fragment
        or (scheme in {"http", "ws"} and not _is_loopback_host(hostname))
    ):
        raise ValueError("Generic MCP URL is invalid.")
    return urlunsplit((scheme, parsed.netloc, parsed.path or "/", "", ""))


def build_external_chrome_stdio_configuration(configuration: Mapping[str, Any]) -> dict[str, Any]:
    """构建外部 Chrome MCP stdio 配置；输入无密钥选择，返回锁定本地入口与最小环境，运行时缺失或字段无效时抛出 ValueError。"""

    mcp_name = _validate_external_chrome_configuration(configuration)
    browser_storage, npm_cache = _resolve_external_chrome_storage_directories()
    environment = _build_external_chrome_child_environment(browser_storage, npm_cache)
    runtime_root = _resolve_external_chrome_node_runtime_directory()
    command, _npm_cli, electron_node = _resolve_node_npm_runtime()
    entrypoint = (runtime_root / EXTERNAL_CHROME_ENTRYPOINTS[mcp_name]).resolve()
    if not entrypoint.is_file() or runtime_root not in entrypoint.parents:
        raise ValueError("External Chrome MCP locked runtime is unavailable.")
    if electron_node:
        environment["ELECTRON_RUN_AS_NODE"] = "1"
    return {
        "command": command,
        "args": [str(entrypoint)],
        "env": environment,
    }


def _validate_external_chrome_configuration(configuration: Mapping[str, Any]) -> str:
    """校验外部 Chrome MCP 无密钥配置；输入映射，返回固定实现名，额外字段或未知实现时抛出 ValueError。"""

    detached = dict(configuration)
    if set(detached) != {"mcpName"}:
        raise ValueError("External Chrome MCP configuration fields are invalid.")
    mcp_name = detached.get("mcpName")
    if not isinstance(mcp_name, str) or mcp_name not in EXTERNAL_CHROME_PACKAGES:
        raise ValueError("External Chrome MCP implementation is invalid.")
    return mcp_name


async def prepare_external_chrome_node_runtime() -> Path:
    """安装或复用 lockfile 固定的 Chrome MCP Node 运行时；无输入，返回私有目录，下载或完整性失败时抛出固定异常。"""

    package_bytes, lock_bytes, lock_digest = _read_external_chrome_node_runtime_source()
    target_root = _resolve_external_chrome_node_runtime_directory(lock_digest)
    if _is_external_chrome_node_runtime_ready(target_root, lock_digest):
        return target_root
    async with _node_runtime_install_lock:
        if _is_external_chrome_node_runtime_ready(target_root, lock_digest):
            return target_root
        await _install_external_chrome_node_runtime(
            package_bytes,
            lock_bytes,
            lock_digest,
            target_root,
        )
    return target_root


def _read_external_chrome_node_runtime_source() -> tuple[bytes, bytes, str]:
    """读取并校验签名 Pack 内 Node 清单；无输入，返回两份文件和摘要，结构或 integrity 无效时抛出 ValueError。"""

    configured_source = str(os.environ.get(MCP_NODE_RUNTIME_SOURCE_ENV) or "").strip()
    source_root = (
        Path(configured_source)
        if configured_source
        else Path(__file__).resolve().parents[1] / "mcp-node-runtime"
    ).expanduser().resolve()
    package_path = source_root / "package.json"
    lock_path = source_root / "package-lock.json"
    try:
        package_bytes = package_path.read_bytes()
        lock_bytes = lock_path.read_bytes()
    except OSError as error:
        raise ValueError("External Chrome MCP lock source is unavailable.") from error
    if (
        not package_bytes
        or not lock_bytes
        or len(package_bytes) > MAX_MCP_NODE_LOCK_BYTES
        or len(lock_bytes) > MAX_MCP_NODE_LOCK_BYTES
    ):
        raise ValueError("External Chrome MCP lock source is invalid.")
    try:
        package_value = json.loads(package_bytes.decode("utf-8"))
        lock_value = json.loads(lock_bytes.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError("External Chrome MCP lock source is invalid.") from error
    _validate_external_chrome_node_lock(package_value, lock_value)
    digest = hashlib.sha256(package_bytes + b"\0" + lock_bytes).hexdigest()
    return package_bytes, lock_bytes, digest


def _validate_external_chrome_node_lock(package_value: Any, lock_value: Any) -> None:
    """校验 Chrome MCP package 与 lock 对应关系；输入解析值，无返回，依赖漂移、非 HTTPS 或缺少 integrity 时抛出 ValueError。"""

    expected_dependencies = {
        "@browsermcp/mcp": "0.1.3",
        "@playwright/mcp": "0.0.78",
    }
    if not isinstance(package_value, dict) or package_value.get("dependencies") != expected_dependencies:
        raise ValueError("External Chrome MCP package definition is invalid.")
    if not isinstance(lock_value, dict) or lock_value.get("lockfileVersion") != 3:
        raise ValueError("External Chrome MCP lockfile is invalid.")
    packages = lock_value.get("packages")
    if not isinstance(packages, dict) or not 2 <= len(packages) <= 512:
        raise ValueError("External Chrome MCP lockfile is invalid.")
    root_package = packages.get("")
    if not isinstance(root_package, dict) or root_package.get("dependencies") != expected_dependencies:
        raise ValueError("External Chrome MCP lockfile root is invalid.")
    for package_name, expected_version in (
        ("node_modules/@browsermcp/mcp", "0.1.3"),
        ("node_modules/@playwright/mcp", "0.0.78"),
    ):
        package = packages.get(package_name)
        if not isinstance(package, dict) or package.get("version") != expected_version:
            raise ValueError("External Chrome MCP direct dependency is invalid.")
    for package_name, package in packages.items():
        if not isinstance(package_name, str) or not isinstance(package, dict) or package.get("link") is True:
            raise ValueError("External Chrome MCP lockfile package is invalid.")
        resolved = package.get("resolved")
        if resolved is None:
            continue
        integrity = package.get("integrity")
        if (
            not isinstance(resolved, str)
            or not resolved.startswith("https://")
            or not isinstance(integrity, str)
            or not integrity.startswith(("sha512-", "sha384-", "sha256-"))
        ):
            raise ValueError("External Chrome MCP lockfile integrity is invalid.")


def _resolve_external_chrome_node_runtime_directory(lock_digest: str | None = None) -> Path:
    """解析 lock 摘要对应的私有安装目录；输入可选摘要，返回绝对路径，不创建或删除文件。"""

    if lock_digest is None:
        _package, _lock, lock_digest = _read_external_chrome_node_runtime_source()
    user_data_root = Path(
        str(os.environ.get("OPENXNET_USER_DATA_DIR") or Path.cwd())
    ).expanduser().resolve()
    return (user_data_root / "runtime" / "mcp" / "node-runtime" / lock_digest[:16]).resolve()


def _is_external_chrome_node_runtime_ready(target_root: Path, lock_digest: str) -> bool:
    """验证私有 Node 运行时标记和两个入口；输入目录与摘要，返回布尔值，不执行第三方代码。"""

    marker_path = target_root / ".openxnet-lock.json"
    try:
        marker = json.loads(marker_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return False
    return (
        marker == {"schema": "openxnet.mcp-node-runtime.v1", "lockSha256": lock_digest}
        and all((target_root / entrypoint).is_file() for entrypoint in EXTERNAL_CHROME_ENTRYPOINTS.values())
    )


async def _install_external_chrome_node_runtime(
    package_bytes: bytes,
    lock_bytes: bytes,
    lock_digest: str,
    target_root: Path,
) -> None:
    """原子安装 lockfile Node 依赖；输入已校验清单与目标，无返回，npm 失败、超时或入口缺失时清理暂存并抛出 RuntimeError。"""

    parent_root = target_root.parent
    parent_root.mkdir(parents=True, exist_ok=True)
    staging_root = parent_root / f".staging-{lock_digest[:16]}-{os.getpid()}-{uuid.uuid4().hex}"
    try:
        staging_root.mkdir(parents=False, exist_ok=False)
        (staging_root / "package.json").write_bytes(package_bytes)
        (staging_root / "package-lock.json").write_bytes(lock_bytes)
        node_executable, npm_cli, electron_node = _resolve_node_npm_runtime()
        _browser_storage, npm_cache = _resolve_external_chrome_storage_directories()
        environment = _build_external_chrome_child_environment(_browser_storage, npm_cache)
        environment["PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD"] = "1"
        if electron_node:
            environment["ELECTRON_RUN_AS_NODE"] = "1"
        creation_flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
        process = await asyncio.create_subprocess_exec(
            node_executable,
            npm_cli,
            "ci",
            "--ignore-scripts",
            "--omit=dev",
            "--no-audit",
            "--no-fund",
            cwd=str(staging_root),
            env=environment,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=creation_flags,
        )
        try:
            return_code = await asyncio.wait_for(process.wait(), timeout=180.0)
        except asyncio.CancelledError:
            process.kill()
            await process.wait()
            raise
        except asyncio.TimeoutError as error:
            process.kill()
            await process.wait()
            raise RuntimeError("External Chrome MCP dependency installation timed out.") from error
        if return_code != 0:
            raise RuntimeError("External Chrome MCP dependency installation failed.")
        if not all((staging_root / entrypoint).is_file() for entrypoint in EXTERNAL_CHROME_ENTRYPOINTS.values()):
            raise RuntimeError("External Chrome MCP dependency installation is incomplete.")
        (staging_root / ".openxnet-lock.json").write_text(
            json.dumps({
                "schema": "openxnet.mcp-node-runtime.v1",
                "lockSha256": lock_digest,
            }, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        if target_root.exists():
            shutil.rmtree(target_root)
        os.replace(staging_root, target_root)
    finally:
        if staging_root.exists():
            shutil.rmtree(staging_root, ignore_errors=True)


def _resolve_external_chrome_storage_directories() -> tuple[str, str]:
    """解析并创建 Chrome MCP 私有缓存目录；无输入，返回浏览器与 npm 绝对路径，创建失败时向调用方抛出异常。"""

    user_data_root = Path(
        str(os.environ.get("OPENXNET_USER_DATA_DIR") or Path.cwd())
    ).expanduser().resolve()
    browser_storage = Path(
        str(os.environ.get(MCP_BROWSER_STORAGE_ENV) or user_data_root / "runtime" / "mcp" / "browsers")
    ).expanduser().resolve()
    npm_cache = Path(
        str(os.environ.get(MCP_NPM_CACHE_ENV) or user_data_root / "runtime" / "mcp" / "npm-cache")
    ).expanduser().resolve()
    browser_storage.mkdir(parents=True, exist_ok=True)
    npm_cache.mkdir(parents=True, exist_ok=True)
    return str(browser_storage), str(npm_cache)


def _build_external_chrome_child_environment(
    browser_storage: str,
    npm_cache: str,
) -> dict[str, str]:
    """构建第三方 Chrome MCP 子进程最小环境；输入缓存路径，返回无 OpenXnet 凭据映射，不修改父进程。"""

    allowed_parent_names = (
        "APPDATA",
        "COMSPEC",
        "HOME",
        "LOCALAPPDATA",
        "PATH",
        "PATHEXT",
        "PROGRAMDATA",
        "SYSTEMROOT",
        "TEMP",
        "TMP",
        "USERPROFILE",
        "WINDIR",
    )
    environment = {
        name: value
        for name in allowed_parent_names
        if (value := str(os.environ.get(name) or "").strip())
    }
    environment.update({
        "PLAYWRIGHT_BROWSERS_PATH": browser_storage,
        "npm_config_cache": npm_cache,
        "npm_config_yes": "true",
        "npm_config_audit": "false",
        "npm_config_fund": "false",
        "NO_UPDATE_NOTIFIER": "1",
    })
    return environment


def build_sql_stdio_configuration(configuration: Mapping[str, Any]) -> dict[str, Any]:
    """构建 SQL MCP stdio 配置；输入无密钥配置，返回自举命令和最小环境，授权或依赖无效时抛出 ValueError。"""

    hydrated = hydrate_sql_configuration(configuration)
    engine = str(hydrated["engine"])
    try:
        from sqlalchemy.engine import URL
    except ImportError as error:
        raise ValueError("SQL MCP runtime dependency is unavailable.") from error
    if engine == "sqlite":
        database_url = URL.create("sqlite", database=str(hydrated["dbpath"]))
    else:
        driver_names = {
            "postgres": "postgresql+psycopg2",
            "mysql": "mysql+pymysql",
            "mssql": "mssql+pymssql",
            "oracle": "oracle+oracledb",
        }
        driver_name = driver_names.get(engine)
        if driver_name is None:
            raise ValueError("SQL MCP engine is not supported.")
        database_url = URL.create(
            driver_name,
            username=str(hydrated["user"]),
            password=str(hydrated["password"]),
            host=str(hydrated["host"]),
            port=int(hydrated["port"]),
            database=str(hydrated["dbname"]),
        )
    command, arguments = _resolve_sql_server_command()
    return {
        "command": command,
        "args": arguments,
        "env": _build_sql_child_environment(database_url.render_as_string(hide_password=False)),
    }


def _resolve_sql_server_command() -> tuple[str, list[str]]:
    """解析同包 SQL MCP 子进程入口；无输入，返回可执行文件和参数，开发态与冻结态均不依赖系统 uvx。"""

    if getattr(sys, "frozen", False):
        return str(Path(sys.executable).resolve()), ["--sql-server"]
    return str(Path(sys.executable).resolve()), ["-m", "py.workers.mcp_worker", "--sql-server"]


def _build_sql_child_environment(database_url: str) -> dict[str, str]:
    """构建第三方 SQL MCP 最小环境；输入私有连接 URL，返回隔离映射，不继承 OpenXnet 或 Provider 凭据。"""

    allowed_parent_names = (
        "APPDATA",
        "COMSPEC",
        "HOME",
        "LOCALAPPDATA",
        "PATH",
        "PATHEXT",
        "PROGRAMDATA",
        "SYSTEMROOT",
        "TEMP",
        "TMP",
        "USERPROFILE",
        "WINDIR",
    )
    environment = {
        name: value
        for name in allowed_parent_names
        if (value := str(os.environ.get(name) or "").strip())
    }
    environment.update({
        "DB_URL": database_url,
        "EXECUTE_QUERY_MAX_CHARS": "12000",
        "PYTHONIOENCODING": "utf-8",
        "PYTHONUTF8": "1",
    })
    return environment


def _resolve_node_npm_runtime() -> tuple[str, str, bool]:
    """解析 Electron 或系统 Node 与 npm CLI；无输入，返回两个绝对路径和 Electron 标志，缺失时抛出 ValueError。"""

    electron_node = Path(str(os.environ.get("ELECTRON_NODE_EXEC") or "")).expanduser()
    electron_npm = Path(str(os.environ.get("ELECTRON_NPM_CLI") or "")).expanduser()
    if electron_node.is_file() and electron_npm.is_file():
        return str(electron_node.resolve()), str(electron_npm.resolve()), True
    system_node_value = shutil.which("node")
    system_npm_value = shutil.which("npm")
    if system_node_value and system_npm_value:
        system_node = Path(system_node_value).resolve()
        system_npm_cli = (
            Path(system_npm_value).resolve().parent / "node_modules" / "npm" / "bin" / "npm-cli.js"
        )
        if system_node.is_file() and system_npm_cli.is_file():
            return str(system_node), str(system_npm_cli), False
    raise ValueError("External Chrome MCP Node runtime is unavailable.")


class McpRuntimeController:
    """管理独立 Worker 内的 MCP 集成连接和有界工具操作。"""

    def __init__(self) -> None:
        """创建停止状态控制器；无输入和返回，不读取凭据、不启动子进程或网络连接。"""

        self._clients: dict[str, McpClient] = {}
        self._configuration_keys: dict[str, str] = {}
        self._operation_lock = asyncio.Lock()

    async def status(self, integration: str) -> dict[str, Any]:
        """查询一个集成状态；输入集成名，返回无凭据状态，不启动连接，未知集成抛出 ValueError。"""

        normalized = self._validate_integration(integration)
        client = self._clients.get(normalized)
        return self._result(normalized, client is not None and client.is_ready, True)

    async def start(self, integration: str, configuration: Mapping[str, Any]) -> dict[str, Any]:
        """启动或复用一个 MCP 集成；输入集成名和无密钥配置，返回安全状态，失败时清理连接并抛出固定异常。"""

        normalized = self._validate_integration(integration)
        async with self._operation_lock:
            try:
                await self._ensure_started_unlocked(normalized, configuration)
                return self._result(normalized, True, True)
            except Exception as error:
                logging.warning("MCP integration start failed: %s", type(error).__name__)
                await self._stop_unlocked(normalized)
                raise RuntimeError("MCP integration failed to start.") from error

    async def stop(self, integration: str) -> dict[str, Any]:
        """停止一个 MCP 集成；输入集成名，返回安全状态，清理异常只记录类型并保持停止。"""

        normalized = self._validate_integration(integration)
        async with self._operation_lock:
            await self._stop_unlocked(normalized)
            return self._result(normalized, False, True)

    async def list_tools(
        self,
        integration: str,
        configuration: Mapping[str, Any],
    ) -> dict[str, Any]:
        """确保集成连接并列出工具；输入集成和无密钥配置，返回有界 OpenAI schema，失败时抛出固定异常。"""

        normalized = self._validate_integration(integration)
        async with self._operation_lock:
            client = await self._ensure_started_unlocked(normalized, configuration)
            tools = await client.get_openai_functions()
            return {"integration": normalized, "tools": self._validate_tools(tools)}

    async def call_tool(
        self,
        integration: str,
        configuration: Mapping[str, Any],
        tool_name: str,
        arguments: Mapping[str, Any],
    ) -> dict[str, Any]:
        """调用已声明工具；输入集成、配置、名称和参数，返回有界结果，未知工具或超限数据时抛出 ValueError。"""

        normalized = self._validate_integration(integration)
        normalized_name = self._validate_tool_name(tool_name)
        detached_arguments = dict(arguments)
        if len(json.dumps(detached_arguments, ensure_ascii=False).encode("utf-8")) > MAX_MCP_TOOL_ARGUMENT_BYTES:
            raise ValueError("MCP tool arguments exceed the size limit.")
        async with self._operation_lock:
            client = await self._ensure_started_unlocked(normalized, configuration)
            tools = self._validate_tools(await client.get_openai_functions())
            allowed_names = {
                str(tool.get("function", {}).get("name", ""))
                for tool in tools
                if isinstance(tool.get("function"), Mapping)
            }
            if normalized_name not in allowed_names:
                raise ValueError("MCP tool is not registered by the integration.")
            result = await client.call_tool(normalized_name, detached_arguments)
            serialized = self._serialize_tool_result(result)
            return {"integration": normalized, "toolName": normalized_name, "result": serialized}

    async def close(self) -> None:
        """关闭所有 MCP 集成；无输入和返回，逐连接隔离清理异常并清空运行状态。"""

        async with self._operation_lock:
            for integration in tuple(self._clients):
                await self._stop_unlocked(integration)

    async def _ensure_started_unlocked(
        self,
        integration: str,
        configuration: Mapping[str, Any],
    ) -> McpClient:
        """在持有操作锁时确保连接就绪；输入已校验集成和配置，返回客户端，配置变化时先关闭旧连接。"""

        if integration == EXTERNAL_CHROME_INTEGRATION:
            _validate_external_chrome_configuration(configuration)
            await prepare_external_chrome_node_runtime()
        client_config, configuration_key = self._build_client_configuration(integration, configuration)
        current = self._clients.get(integration)
        if current is not None and self._configuration_keys.get(integration) == configuration_key:
            await current.wait_until_ready()
            return current
        await self._stop_unlocked(integration)
        client = McpClient()
        self._clients[integration] = client
        self._configuration_keys[integration] = configuration_key
        await client.initialize(integration, client_config)
        timeout = (
            60.0
            if integration == EXTERNAL_CHROME_INTEGRATION
            else 30.0
            if integration == SQL_INTEGRATION
            else 8.0
        )
        await client.wait_until_ready(timeout=timeout)
        return client

    async def _stop_unlocked(self, integration: str) -> None:
        """在持有操作锁时关闭一个连接；输入集成名，无返回，SDK 清理异常只记录类型。"""

        client = self._clients.pop(integration, None)
        self._configuration_keys.pop(integration, None)
        if client is None:
            return
        try:
            await client.close()
        except Exception as error:
            logging.warning("MCP integration cleanup failed: %s", type(error).__name__)

    def _build_client_configuration(
        self,
        integration: str,
        configuration: Mapping[str, Any],
    ) -> tuple[dict[str, Any], str]:
        """构建只驻留于 Worker 的连接配置；输入集成和无密钥配置，返回 SDK 配置及稳定键，缺少凭据时抛出 ValueError。"""

        detached = dict(configuration)
        if len(json.dumps(detached, ensure_ascii=False).encode("utf-8")) > MAX_MCP_CONFIGURATION_BYTES:
            raise ValueError("MCP integration configuration exceeds the size limit.")
        if integration == HOME_ASSISTANT_INTEGRATION:
            if set(detached) != {"url"}:
                raise ValueError("MCP integration configuration fields are invalid.")
            hydrated = hydrate_home_assistant_config(detached)
            token = str(hydrated.get("api_key") or "").strip()
            if not token:
                raise ValueError("Home Assistant credential is missing.")
            endpoint = build_home_assistant_sse_url(hydrated.get("url"))
            return {
                "type": "sse",
                "url": endpoint,
                "headers": {"Authorization": f"Bearer {token}"},
                "follow_redirects": False,
            }, endpoint
        if integration == EXTERNAL_CHROME_INTEGRATION:
            client_configuration = build_external_chrome_stdio_configuration(detached)
            return client_configuration, str(detached["mcpName"])
        if integration == SQL_INTEGRATION:
            client_configuration = build_sql_stdio_configuration(detached)
            return client_configuration, json.dumps(detached, ensure_ascii=False, sort_keys=True)
        if integration.startswith(GENERIC_MCP_INTEGRATION_PREFIX):
            client_configuration = build_generic_mcp_client_configuration(integration, detached)
            return client_configuration, json.dumps(detached, ensure_ascii=False, sort_keys=True)
        raise ValueError("MCP integration is not supported.")

    def _validate_integration(self, value: str) -> str:
        """校验集成标识；输入文本，返回规范名称，未知或错误类型时抛出 ValueError。"""

        if not isinstance(value, str):
            raise ValueError("MCP integration is invalid.")
        normalized = value.strip()
        if normalized.startswith(GENERIC_MCP_INTEGRATION_PREFIX):
            _validate_generic_mcp_server_id(normalized[len(GENERIC_MCP_INTEGRATION_PREFIX):])
            return normalized
        if (
            normalized not in {
                HOME_ASSISTANT_INTEGRATION,
                EXTERNAL_CHROME_INTEGRATION,
                SQL_INTEGRATION,
            }
        ):
            raise ValueError("MCP integration is invalid.")
        return normalized

    def _validate_tool_name(self, value: str) -> str:
        """校验工具名；输入文本，返回去空白名称，空值、控制字符或超长时抛出 ValueError。"""

        if not isinstance(value, str):
            raise ValueError("MCP tool name is invalid.")
        normalized = value.strip()
        if (
            not normalized
            or len(normalized) > MAX_MCP_TOOL_NAME_LENGTH
            or any(ord(character) < 32 or ord(character) == 127 for character in normalized)
        ):
            raise ValueError("MCP tool name is invalid.")
        return normalized

    def _validate_tools(self, value: Any) -> list[dict[str, Any]]:
        """校验工具清单；输入未知值，返回有界可序列化副本，结构或数量无效时抛出 ValueError。"""

        if not isinstance(value, list) or len(value) > MAX_MCP_TOOL_COUNT:
            raise ValueError("MCP tool list is invalid.")
        detached = json.loads(json.dumps(value, ensure_ascii=False))
        if len(json.dumps(detached, ensure_ascii=False).encode("utf-8")) > MAX_MCP_TOOL_RESULT_BYTES:
            raise ValueError("MCP tool list exceeds the size limit.")
        for tool in detached:
            function = tool.get("function") if isinstance(tool, dict) else None
            if not isinstance(function, dict):
                raise ValueError("MCP tool schema is invalid.")
            self._validate_tool_name(function.get("name"))
        return detached

    def _serialize_tool_result(self, value: Any) -> Any:
        """序列化 SDK 工具结果；输入任意结果，返回有界 JSON 值，不可序列化或超限时抛出 ValueError。"""

        candidate = value.model_dump() if hasattr(value, "model_dump") and callable(value.model_dump) else value
        try:
            encoded = json.dumps(candidate, ensure_ascii=False).encode("utf-8")
        except (TypeError, ValueError) as error:
            raise ValueError("MCP tool result is not serializable.") from error
        if len(encoded) > MAX_MCP_TOOL_RESULT_BYTES:
            raise ValueError("MCP tool result exceeds the size limit.")
        return json.loads(encoded.decode("utf-8"))

    def _result(self, integration: str, running: bool, success: bool) -> dict[str, Any]:
        """构建公开生命周期结果；输入集成、运行与成功标志，返回无凭据映射，无副作用。"""

        return {
            "integration": integration,
            "success": success,
            "is_running": running,
            "status": "running" if running else "stopped",
            "message": "MCP 集成运行中" if running else "MCP 集成已停止",
        }
