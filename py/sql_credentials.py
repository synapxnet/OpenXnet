# -*- coding: utf-8 -*-
"""解析 Main 注入的 SQL 凭据和 SQLite 文件授权，不向公开配置返回密钥。"""

from __future__ import annotations

import base64
from collections.abc import Mapping
import json
import os
from pathlib import Path
import re
from typing import Any


SQL_CREDENTIALS_ENV = "OPENXNET_SQL_CREDENTIALS_B64"
SQL_CREDENTIAL_SCHEMA = "openxnet.sql-credentials.runtime.v1"
MAX_SQL_CREDENTIAL_BOOTSTRAP_BYTES = 128 * 1024
MAX_SQL_PASSWORD_LENGTH = 64 * 1024
SUPPORTED_SQL_ENGINES = frozenset({"sqlite", "postgres", "mysql", "mssql", "oracle"})
_DATABASE_ID_PATTERN = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    re.IGNORECASE,
)
_cached_bootstrap_source: str | None = None
_cached_bootstrap: dict[str, Any] | None = None


def _load_runtime_bootstrap() -> dict[str, Any] | None:
    """读取并缓存 SQL 启动包；无输入，返回规范映射或空值，编码、schema 或预算无效时抛出 ValueError。"""

    global _cached_bootstrap_source, _cached_bootstrap
    source = str(os.environ.get(SQL_CREDENTIALS_ENV) or "").strip()
    if not source:
        _cached_bootstrap_source = None
        _cached_bootstrap = None
        return None
    if source == _cached_bootstrap_source and _cached_bootstrap is not None:
        return _cached_bootstrap
    try:
        decoded = base64.b64decode(source, validate=True)
        if not decoded or len(decoded) > MAX_SQL_CREDENTIAL_BOOTSTRAP_BYTES:
            raise ValueError("SQL credential bootstrap exceeds its size limit.")
        value = json.loads(decoded.decode("utf-8"))
    except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError("SQL credential bootstrap is invalid.") from error
    if not isinstance(value, dict) or set(value) != {"schema", "credentials", "databases"}:
        raise ValueError("SQL credential bootstrap fields are invalid.")
    if value.get("schema") != SQL_CREDENTIAL_SCHEMA:
        raise ValueError("SQL credential bootstrap schema is invalid.")
    credentials = value.get("credentials")
    databases = value.get("databases")
    if not isinstance(credentials, dict) or set(credentials).difference({"password"}):
        raise ValueError("SQL credential bootstrap credentials are invalid.")
    password = credentials.get("password")
    if password is not None and (
        not isinstance(password, str)
        or not password
        or len(password) > MAX_SQL_PASSWORD_LENGTH
        or any(ord(character) < 32 or ord(character) == 127 for character in password)
    ):
        raise ValueError("SQL credential bootstrap password is invalid.")
    if not isinstance(databases, dict) or len(databases) > 1:
        raise ValueError("SQL database authorizations are invalid.")
    normalized_databases: dict[str, str] = {}
    for database_id, database_path in databases.items():
        if (
            not isinstance(database_id, str)
            or _DATABASE_ID_PATTERN.fullmatch(database_id) is None
            or not isinstance(database_path, str)
            or not Path(database_path).is_absolute()
            or len(database_path.encode("utf-8")) > 16 * 1024
        ):
            raise ValueError("SQL database authorization is invalid.")
        normalized_databases[database_id] = database_path
    normalized = {
        "credentials": dict(credentials),
        "databases": normalized_databases,
    }
    _cached_bootstrap_source = source
    _cached_bootstrap = normalized
    return normalized


def sql_runtime_credentials_enabled() -> bool:
    """判断 Main 是否注入 SQL 安全边界；无输入，返回布尔值，不解析或返回密钥。"""

    return bool(str(os.environ.get(SQL_CREDENTIALS_ENV) or "").strip())


def hydrate_sql_configuration(configuration: Mapping[str, Any]) -> dict[str, Any]:
    """补齐 SQL Worker 私有配置；输入无密钥配置，返回路径或口令配置，授权或字段无效时抛出 ValueError。"""

    detached = dict(configuration)
    engine = detached.get("engine")
    if not isinstance(engine, str) or engine not in SUPPORTED_SQL_ENGINES:
        raise ValueError("SQL engine is invalid.")
    bootstrap = _load_runtime_bootstrap()
    if engine == "sqlite":
        if bootstrap is None:
            dbpath = str(detached.get("dbpath") or detached.get("dbPath") or "").strip()
            if not dbpath:
                raise ValueError("SQLite database path is missing.")
            return {"engine": engine, "dbpath": dbpath}
        if set(detached) != {"engine", "databaseId"}:
            raise ValueError("SQLite configuration fields are invalid.")
        database_id = detached.get("databaseId")
        if not isinstance(database_id, str) or _DATABASE_ID_PATTERN.fullmatch(database_id) is None:
            raise ValueError("SQLite database authorization is invalid.")
        database_path = bootstrap["databases"].get(database_id)
        if not isinstance(database_path, str):
            raise ValueError("SQLite database is not authorized.")
        resolved_path = Path(database_path).resolve(strict=True)
        if not resolved_path.is_file():
            raise ValueError("Authorized SQLite database is unavailable.")
        return {"engine": engine, "dbpath": str(resolved_path)}
    allowed_fields = {"engine", "user", "host", "port", "dbname"}
    if bootstrap is None:
        allowed_fields.add("password")
    if set(detached) != allowed_fields:
        raise ValueError("Remote SQL configuration fields are invalid.")
    user = detached.get("user")
    host = detached.get("host")
    port = detached.get("port")
    dbname = detached.get("dbname")
    if (
        not isinstance(user, str)
        or not user.strip()
        or len(user.strip()) > 256
        or not isinstance(host, str)
        or not host.strip()
        or len(host.strip()) > 255
        or any(character.isspace() or character in "/@" for character in host)
        or not isinstance(port, int)
        or isinstance(port, bool)
        or not 1 <= port <= 65_535
        or not isinstance(dbname, str)
        or not dbname.strip()
        or len(dbname.strip()) > 512
        or any(ord(character) < 32 or ord(character) == 127 for character in f"{user}{host}{dbname}")
    ):
        raise ValueError("Remote SQL configuration is invalid.")
    password = (
        str(detached.get("password") or "").strip()
        if bootstrap is None
        else str(bootstrap["credentials"].get("password") or "").strip()
    )
    if not password:
        raise ValueError("SQL credential is missing.")
    return {
        **detached,
        "user": user.strip(),
        "host": host.strip(),
        "dbname": dbname.strip(),
        "password": password,
    }


def redact_sql_credentials_for_persistence(settings: Mapping[str, Any]) -> dict[str, Any]:
    """从设置副本移除 SQL 口令并统一 dbpath；输入设置，返回分离字典，不修改原对象。"""

    detached = json.loads(json.dumps(dict(settings), ensure_ascii=False))
    sql_settings = detached.get("sqlSettings")
    if not isinstance(sql_settings, dict):
        return detached
    if not str(sql_settings.get("dbpath") or "").strip() and isinstance(sql_settings.get("dbPath"), str):
        sql_settings["dbpath"] = sql_settings["dbPath"].strip()
    sql_settings.pop("dbPath", None)
    if sql_runtime_credentials_enabled():
        sql_settings["password"] = ""
    return detached


def apply_sql_credentials(settings: Mapping[str, Any]) -> dict[str, Any]:
    """向兼容设置内存副本补齐 SQL 私有字段；输入设置，返回分离字典，未启用 Main 边界时保持原值。"""

    detached = json.loads(json.dumps(dict(settings), ensure_ascii=False))
    if not sql_runtime_credentials_enabled():
        return detached
    sql_settings = detached.get("sqlSettings")
    if not isinstance(sql_settings, dict):
        return detached
    engine = str(sql_settings.get("engine") or "sqlite").strip()
    if engine == "sqlite":
        runtime_configuration = {
            "engine": engine,
            "databaseId": str(sql_settings.get("databaseId") or "").strip(),
        }
    else:
        runtime_configuration = {
            "engine": engine,
            "user": str(sql_settings.get("user") or "").strip(),
            "host": str(sql_settings.get("host") or "").strip(),
            "port": int(sql_settings.get("port") or 0),
            "dbname": str(sql_settings.get("dbname") or "").strip(),
        }
    try:
        hydrated = hydrate_sql_configuration(runtime_configuration)
    except ValueError:
        hydrated = {}
    sql_settings.update(hydrated)
    bootstrap = _load_runtime_bootstrap() or {"credentials": {}}
    sql_settings["sqlCredentialFieldsConfigured"] = [
        field
        for field in ("password",)
        if str(bootstrap["credentials"].get(field) or "").strip()
    ]
    return detached


def _reset_sql_credentials_cache_for_tests() -> None:
    """清空 SQL 启动包缓存；无输入和返回，仅供隔离单元测试使用。"""

    global _cached_bootstrap_source, _cached_bootstrap
    _cached_bootstrap_source = None
    _cached_bootstrap = None
