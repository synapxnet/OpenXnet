# -*- coding: utf-8 -*-
"""验证 SQL 凭据启动包、SQLite 授权和持久化脱敏边界。"""

from __future__ import annotations

import base64
import json
import os
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from py.sql_credentials import (
    SQL_CREDENTIALS_ENV,
    _reset_sql_credentials_cache_for_tests,
    apply_sql_credentials,
    hydrate_sql_configuration,
    redact_sql_credentials_for_persistence,
)


def _encode_bootstrap(password: str, database_id: str, database_path: str) -> str:
    """编码测试 SQL 启动包；输入口令、授权 ID 和路径，返回 Base64，不修改环境变量。"""

    payload = {
        "schema": "openxnet.sql-credentials.runtime.v1",
        "credentials": {"password": password},
        "databases": {database_id: database_path},
    }
    return base64.b64encode(json.dumps(payload).encode("utf-8")).decode("ascii")


class SqlCredentialTests(unittest.TestCase):
    """验证 SQL 密钥不会穿过公开设置，SQLite 路径只能由授权 ID 解析。"""

    def tearDown(self) -> None:
        """清空模块缓存；无输入和返回，避免测试间共享环境包解析结果。"""

        _reset_sql_credentials_cache_for_tests()

    def test_hydrates_authorized_sqlite_path_and_rejects_arbitrary_path(self) -> None:
        """确认授权 ID 可解析真实文件，而 Desktop 启动包模式拒绝 Renderer 直接提交路径。"""

        database_id = "00000000-0000-4000-8000-000000000001"
        with TemporaryDirectory() as directory:
            database_path = Path(directory) / "workspace.db"
            database_path.write_bytes(b"sqlite-test")
            bootstrap = _encode_bootstrap("database-secret", database_id, str(database_path))
            with patch.dict(os.environ, {SQL_CREDENTIALS_ENV: bootstrap}, clear=False):
                hydrated = hydrate_sql_configuration({
                    "engine": "sqlite",
                    "databaseId": database_id,
                })
                self.assertEqual(hydrated, {
                    "engine": "sqlite",
                    "dbpath": str(database_path.resolve()),
                })
                with self.assertRaises(ValueError):
                    hydrate_sql_configuration({
                        "engine": "sqlite",
                        "dbpath": str(database_path),
                    })

    def test_hydrates_remote_password_without_persisting_it(self) -> None:
        """确认远程配置只在内存补入口令，脱敏持久化副本和输入设置均不含新增明文。"""

        database_id = "00000000-0000-4000-8000-000000000001"
        bootstrap = _encode_bootstrap("database-secret", database_id, "C:\\workspace.db")
        settings = {
            "sqlSettings": {
                "engine": "postgres",
                "user": "openxnet",
                "host": "127.0.0.1",
                "port": 5432,
                "dbname": "workspace",
                "password": "",
            },
        }
        with patch.dict(os.environ, {SQL_CREDENTIALS_ENV: bootstrap}, clear=False):
            hydrated = apply_sql_credentials(settings)
            redacted = redact_sql_credentials_for_persistence(hydrated)
        self.assertEqual(hydrated["sqlSettings"]["password"], "database-secret")
        self.assertEqual(redacted["sqlSettings"]["password"], "")
        self.assertEqual(settings["sqlSettings"]["password"], "")
        self.assertNotIn("database-secret", json.dumps(redacted))

    def test_rejects_malformed_bootstrap_without_echoing_secret(self) -> None:
        """确认非法启动包直接失败；输入损坏 Base64，抛出固定 ValueError，消息不包含原始内容。"""

        with patch.dict(os.environ, {SQL_CREDENTIALS_ENV: "not-base64-secret"}, clear=False):
            with self.assertRaisesRegex(ValueError, "bootstrap is invalid") as raised:
                hydrate_sql_configuration({
                    "engine": "postgres",
                    "user": "openxnet",
                    "host": "127.0.0.1",
                    "port": 5432,
                    "dbname": "workspace",
                })
        self.assertNotIn("not-base64-secret", str(raised.exception))


if __name__ == "__main__":
    unittest.main()
