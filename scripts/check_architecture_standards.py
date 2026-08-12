# -*- coding: utf-8 -*-
"""Validate UTF-8 encoding and Python function documentation for refactored code."""

from __future__ import annotations

import ast
import os
from pathlib import Path
import subprocess
import sys
from typing import Iterable


PROJECT_ROOT = Path(__file__).resolve().parents[1]
TEXT_EXTENSIONS = {
    ".bat",
    ".cjs",
    ".css",
    ".html",
    ".js",
    ".json",
    ".jsonc",
    ".md",
    ".mjs",
    ".nsh",
    ".plist",
    ".ps1",
    ".py",
    ".pyi",
    ".scss",
    ".sh",
    ".spec",
    ".toml",
    ".ts",
    ".tsx",
    ".txt",
    ".vue",
    ".yaml",
    ".yml",
}
EXCLUDED_PARTS = {
    ".git",
    ".venv",
    "__pycache__",
    "build",
    "build-ts",
    "dist",
    "node_modules",
    "release",
}
EXCLUDED_PREFIXES = {
    ("static", "libs"),
    ("gitnexus", "node_modules"),
    ("gitnexus-shared", "node_modules"),
}


def _is_excluded_directory(path: Path) -> bool:
    """判断目录是否属于依赖、构建产物或不受本项目规范管理的第三方目录。"""

    try:
        relative_parts = path.relative_to(PROJECT_ROOT).parts
    except ValueError:
        return True
    if any(part in EXCLUDED_PARTS for part in relative_parts):
        return True
    return any(
        relative_parts[: len(prefix)] == prefix
        for prefix in EXCLUDED_PREFIXES
    )


def _list_source_package_files() -> list[Path]:
    """在不含 Git 元数据的源码包中确定性枚举自有文件，并提前裁剪排除目录。"""

    files: list[Path] = []
    for current_root, directory_names, file_names in os.walk(PROJECT_ROOT):
        current_path = Path(current_root)
        directory_names[:] = sorted(
            name
            for name in directory_names
            if not _is_excluded_directory(current_path / name)
        )
        files.extend(current_path / name for name in sorted(file_names))
    return files


def _list_repository_files() -> list[Path]:
    """优先枚举 Git 管理文件；源码包不含 Git 元数据时回退到受限目录遍历。"""

    try:
        result = subprocess.run(
            ["git", "ls-files", "--cached", "--others", "--exclude-standard"],
            cwd=PROJECT_ROOT,
            check=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
        )
    except OSError:
        return _list_source_package_files()
    if result.returncode != 0:
        return _list_source_package_files()
    return [
        PROJECT_ROOT / line
        for line in result.stdout.splitlines()
        if line.strip()
    ]


def _is_checked_text_file(path: Path) -> bool:
    """判断文件是否为需要执行 UTF-8 校验的项目自有文本。"""

    try:
        relative_parts = path.relative_to(PROJECT_ROOT).parts
    except ValueError:
        return False
    if any(part in EXCLUDED_PARTS for part in relative_parts):
        return False
    if any(relative_parts[: len(prefix)] == prefix for prefix in EXCLUDED_PREFIXES):
        return False
    return path.suffix.lower() in TEXT_EXTENSIONS


def check_utf8(paths: Iterable[Path]) -> list[str]:
    """检查项目自有文本编码，并返回所有非 UTF-8 文件诊断。"""

    diagnostics: list[str] = []
    for path in paths:
        if not path.is_file() or not _is_checked_text_file(path):
            continue
        try:
            path.read_text(encoding="utf-8")
        except UnicodeDecodeError as error:
            relative = path.relative_to(PROJECT_ROOT)
            diagnostics.append(f"{relative}: invalid UTF-8 at byte {error.start}")
    return diagnostics


def _iter_python_functions(tree: ast.AST) -> Iterable[ast.FunctionDef | ast.AsyncFunctionDef]:
    """遍历语法树并产出全部同步与异步函数定义。"""

    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            yield node


def check_python_function_docs() -> list[str]:
    """检查 Python Worker 函数说明，并返回缺失 docstring 的诊断。"""

    diagnostics: list[str] = []
    worker_root = PROJECT_ROOT / "py" / "workers"
    for path in sorted(worker_root.rglob("*.py")):
        source = path.read_text(encoding="utf-8")
        tree = ast.parse(source, filename=str(path))
        for function in _iter_python_functions(tree):
            if ast.get_docstring(function, clean=False) is None:
                relative = path.relative_to(PROJECT_ROOT)
                diagnostics.append(
                    f"{relative}:{function.lineno}: function '{function.name}' requires a docstring"
                )
    return diagnostics


def main() -> int:
    """执行架构规范检查并返回适合命令行使用的退出码。"""

    diagnostics = [
        *check_utf8(_list_repository_files()),
        *check_python_function_docs(),
    ]
    if diagnostics:
        for diagnostic in diagnostics:
            print(diagnostic, file=sys.stderr)
        return 1
    print("Architecture standards check passed: UTF-8 and Python docstrings are valid.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
