# -*- coding: utf-8 -*-
"""只在受信任的 Server 兼容 backend 内应用 Main 管理的通用 MCP 凭据。"""

from __future__ import annotations

import base64
from copy import deepcopy
import json
import os
import re
from typing import Any, Dict, Mapping, MutableMapping


MCP_CREDENTIAL_ENV = "OPENXNET_MCP_CREDENTIALS_B64"
MCP_CREDENTIAL_SCHEMA = "openxnet.mcp-credentials.runtime.v1"
MAX_MCP_CREDENTIAL_BOOTSTRAP_BYTES = 2 * 1024 * 1024
MAX_MCP_SERVER_COUNT = 128
MAX_MCP_ENTRY_COUNT = 128
MAX_MCP_SCOPE_LENGTH = 256
MAX_MCP_SECRET_LENGTH = 128 * 1024

_cached_credentials: Dict[str, Dict[str, Dict[str, str]]] | None = None
_runtime_credentials_enabled: bool | None = None


def _contains_invalid_characters(value: str, *, allow_line_breaks: bool) -> bool:
    """检查凭据中的控制字符；输入文本和换行策略，返回布尔值，无副作用。"""

    for character in value:
        codepoint = ord(character)
        if codepoint in {0, 127}:
            return True
        if codepoint < 32 and not (allow_line_breaks and character in "\t\n\r"):
            return True
    return False


def _parse_scope(value: Any) -> str:
    """解析 MCP Server scope；输入未知值，返回有界标识，格式无效时抛出 RuntimeError。"""

    if not isinstance(value, str) or value != value.strip():
        raise RuntimeError("MCP credential scope is invalid.")
    if not value or len(value) > MAX_MCP_SCOPE_LENGTH or _contains_invalid_characters(
        value,
        allow_line_breaks=False,
    ):
        raise RuntimeError("MCP credential scope is invalid.")
    return value


def _parse_name(value: Any, lane: str) -> str:
    """解析环境变量或 header 名；输入名称和凭据通道，返回规范名称，无效时抛出 RuntimeError。"""

    if not isinstance(value, str):
        raise RuntimeError("MCP credential name is invalid.")
    if lane == "env" and re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]{0,255}", value):
        return value
    if lane == "headers" and re.fullmatch(r"[!#$%&'*+.^_`|~0-9A-Za-z-]{1,256}", value):
        return value
    raise RuntimeError("MCP credential name is invalid.")


def _parse_secret(value: Any, *, allow_line_breaks: bool) -> str:
    """解析有界 MCP 密钥；输入未知值和换行策略，返回去空白文本，无效时抛出 RuntimeError。"""

    if not isinstance(value, str):
        raise RuntimeError("MCP credential value is invalid.")
    secret = value.strip()
    if (
        not secret
        or len(secret) > MAX_MCP_SECRET_LENGTH
        or _contains_invalid_characters(secret, allow_line_breaks=allow_line_breaks)
    ):
        raise RuntimeError("MCP credential value is invalid.")
    return secret


def _load_runtime_credentials() -> Dict[str, Dict[str, Dict[str, str]]]:
    """解码并缓存 Main 凭据封包；无输入，返回分离副本，封包无效时抛出 RuntimeError。"""

    global _cached_credentials, _runtime_credentials_enabled
    if _cached_credentials is not None:
        return deepcopy(_cached_credentials)
    encoded = str(os.environ.pop(MCP_CREDENTIAL_ENV, "") or "").strip()
    _runtime_credentials_enabled = bool(encoded)
    if not encoded:
        _cached_credentials = {}
        return {}
    try:
        decoded = base64.b64decode(encoded, validate=True)
        if len(decoded) > MAX_MCP_CREDENTIAL_BOOTSTRAP_BYTES:
            raise ValueError("MCP credential bootstrap exceeds its byte budget.")
        payload = json.loads(decoded.decode("utf-8"))
    except Exception as error:
        raise RuntimeError("MCP credential bootstrap is invalid.") from error
    if not isinstance(payload, Mapping) or set(payload) != {"schema", "credentials"}:
        raise RuntimeError("MCP credential bootstrap fields are invalid.")
    if payload.get("schema") != MCP_CREDENTIAL_SCHEMA:
        raise RuntimeError("MCP credential bootstrap schema is invalid.")
    raw_credentials = payload.get("credentials")
    if not isinstance(raw_credentials, Mapping) or len(raw_credentials) > MAX_MCP_SERVER_COUNT:
        raise RuntimeError("MCP credential bootstrap servers are invalid.")

    credentials: Dict[str, Dict[str, Dict[str, str]]] = {}
    for raw_server_id, raw_lanes in raw_credentials.items():
        server_id = _parse_scope(raw_server_id)
        if not isinstance(raw_lanes, Mapping) or not set(raw_lanes).issubset({"env", "headers"}):
            raise RuntimeError("MCP credential server entry is invalid.")
        lanes: Dict[str, Dict[str, str]] = {}
        for lane in ("env", "headers"):
            raw_entries = raw_lanes.get(lane, {})
            if not isinstance(raw_entries, Mapping) or len(raw_entries) > MAX_MCP_ENTRY_COUNT:
                raise RuntimeError("MCP credential lane is invalid.")
            entries: Dict[str, str] = {}
            for raw_name, raw_secret in raw_entries.items():
                name = _parse_name(raw_name, lane)
                entries[name] = _parse_secret(
                    raw_secret,
                    allow_line_breaks=lane == "env",
                )
            if entries:
                lanes[lane] = entries
        if lanes:
            credentials[server_id] = lanes
    _cached_credentials = credentials
    return deepcopy(credentials)


def mcp_runtime_credentials_enabled() -> bool:
    """判断 Main 是否提供进程级 MCP 凭据；无输入，返回布尔值，首次调用会消费环境变量。"""

    if _runtime_credentials_enabled is None:
        _load_runtime_credentials()
    return bool(_runtime_credentials_enabled)


def apply_mcp_credentials(settings: Dict[str, Any]) -> Dict[str, Any]:
    """补齐兼容 MCP 设置凭据；输入内存设置，返回同一对象并写入密钥，封包无效时抛出 RuntimeError。"""

    credentials = _load_runtime_credentials()
    if not mcp_runtime_credentials_enabled():
        return settings
    servers = settings.get("mcpServers")
    if not isinstance(servers, MutableMapping):
        return settings
    for server_id, server in servers.items():
        if not isinstance(server, MutableMapping):
            continue
        lanes = credentials.get(str(server_id), {})
        env = server.get("env") if isinstance(server.get("env"), MutableMapping) else {}
        headers = server.get("headers") if isinstance(server.get("headers"), MutableMapping) else {}
        for name, secret in lanes.get("env", {}).items():
            env[name] = secret
        for name, secret in lanes.get("headers", {}).items():
            headers[name] = secret
        server["env"] = env
        server["headers"] = headers
        server["envCredentialsConfigured"] = sorted(lanes.get("env", {}))
        server["headerCredentialsConfigured"] = sorted(lanes.get("headers", {}))
    return settings


def hydrate_mcp_runtime_server_config(
    server_id: str,
    configuration: Mapping[str, Any],
) -> Dict[str, Any]:
    """补齐单个远程 MCP Server 的认证头；输入 scope 和公开配置，返回分离副本，不注入 stdio 环境。"""

    normalized_server_id = _parse_scope(server_id)
    detached = deepcopy(dict(configuration))
    credentials = _load_runtime_credentials()
    if not mcp_runtime_credentials_enabled():
        return detached
    headers = detached.get("headers")
    if not isinstance(headers, MutableMapping):
        headers = {}
    for name, secret in credentials.get(normalized_server_id, {}).get("headers", {}).items():
        headers[name] = secret
    detached["headers"] = dict(headers)
    return detached


def redact_mcp_credentials_for_persistence(settings: Mapping[str, Any]) -> Dict[str, Any]:
    """清除待持久化 MCP 密钥；输入设置，返回分离副本，不修改原对象，封包无效时抛出 RuntimeError。"""

    detached = deepcopy(dict(settings))
    credentials = _load_runtime_credentials()
    if not mcp_runtime_credentials_enabled():
        return detached
    servers = detached.get("mcpServers")
    if not isinstance(servers, MutableMapping):
        return detached
    for server_id, server in servers.items():
        if not isinstance(server, MutableMapping):
            continue
        lanes = credentials.get(str(server_id), {})
        env = server.get("env") if isinstance(server.get("env"), MutableMapping) else {}
        headers = server.get("headers") if isinstance(server.get("headers"), MutableMapping) else {}
        for name in list(env):
            env[name] = ""
        for name in lanes.get("headers", {}):
            if name in headers:
                headers[name] = ""
        server["env"] = env
        server["headers"] = headers
        server["envCredentialsConfigured"] = sorted(lanes.get("env", {}))
        server["headerCredentialsConfigured"] = sorted(lanes.get("headers", {}))
        server["input"] = _build_redacted_input(str(server_id), server)
    return detached


def _build_redacted_input(server_id: str, server: Mapping[str, Any]) -> str:
    """构建脱敏 MCP 输入文档；输入 scope 和内存配置，返回 UTF-8 JSON 文本，无外部副作用。"""

    config = {
        key: deepcopy(server[key])
        for key in ("command", "args", "env", "url", "headers")
        if key in server
    }
    return json.dumps({"mcpServers": {server_id: config}}, ensure_ascii=False, indent=2)


def _reset_mcp_credentials_cache_for_tests() -> None:
    """重置 MCP 凭据缓存；无输入和返回，仅修改测试进程内状态。"""

    global _cached_credentials, _runtime_credentials_enabled
    _cached_credentials = None
    _runtime_credentials_enabled = None
