# -*- coding: utf-8 -*-
"""验证架构规范检查器在 Git 仓库和脱敏源码包中的文件发现行为。"""

from __future__ import annotations

import importlib.util
from pathlib import Path
from types import SimpleNamespace
import tempfile
import unittest
from unittest import mock


SCRIPT_PATH = Path(__file__).resolve().parents[1] / "scripts" / "check_architecture_standards.py"
SPEC = importlib.util.spec_from_file_location("check_architecture_standards", SCRIPT_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("无法加载架构规范检查脚本。")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class ArchitectureStandardsDiscoveryTests(unittest.TestCase):
    """验证两种发布环境使用确定且安全的文件发现方式。"""

    def test_uses_git_file_list_when_repository_metadata_is_available(self) -> None:
        """Git 命令成功时只返回 Git 已跟踪或未忽略的文件列表。"""

        root = Path("C:/workspace/openxnet")
        result = SimpleNamespace(returncode=0, stdout="src/main.ts\ntests/test_demo.py\n")
        with (
            mock.patch.object(MODULE, "PROJECT_ROOT", root),
            mock.patch.object(MODULE.subprocess, "run", return_value=result) as run,
        ):
            files = MODULE._list_repository_files()

        self.assertEqual(
            files,
            [root / "src/main.ts", root / "tests/test_demo.py"],
        )
        run.assert_called_once()

    def test_falls_back_to_bounded_walk_without_git_metadata(self) -> None:
        """Git 元数据缺失时遍历源码包，并排除依赖、构建和第三方目录。"""

        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            owned_file = root / "src" / "main.py"
            ignored_dependency = root / "node_modules" / "package" / "index.js"
            ignored_vendor = root / "static" / "libs" / "vendor.js"
            owned_file.parent.mkdir(parents=True)
            ignored_dependency.parent.mkdir(parents=True)
            ignored_vendor.parent.mkdir(parents=True)
            owned_file.write_text("print('ok')\n", encoding="utf-8")
            ignored_dependency.write_text("ignored\n", encoding="utf-8")
            ignored_vendor.write_text("ignored\n", encoding="utf-8")

            result = SimpleNamespace(returncode=128, stdout="")
            with (
                mock.patch.object(MODULE, "PROJECT_ROOT", root),
                mock.patch.object(MODULE.subprocess, "run", return_value=result),
            ):
                files = MODULE._list_repository_files()

        self.assertEqual(files, [owned_file])


if __name__ == "__main__":
    unittest.main()
