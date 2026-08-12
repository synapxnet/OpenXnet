# -*- coding: utf-8 -*-
"""构建自包含的 OpenXnet MCP Worker 功能包目录。"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import platform
import shutil
import subprocess
import sys
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
MANIFEST_SCHEMA = "openxnet.feature-pack.v1"
MCP_WORKER_VERSION = "1.4.0"


def parse_arguments() -> argparse.Namespace:
    """解析输出目录和 PyInstaller 开关；无输入，返回参数对象，无效参数由 argparse 终止进程。"""

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--skip-pyinstaller", action="store_true")
    return parser.parse_args()


def read_json(path: Path) -> dict[str, Any]:
    """读取 UTF-8 JSON 对象；输入路径，返回字典，文件或类型无效时抛出异常。"""

    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise TypeError(f"Expected a JSON object: {path}")
    return value


def run_pyinstaller() -> None:
    """使用当前 Python 环境构建 MCP Worker；无输入和返回，构建失败时抛出 CalledProcessError。"""

    subprocess.run(
        [sys.executable, "-m", "PyInstaller", "mcp-worker.spec", "--clean", "--noconfirm"],
        cwd=PROJECT_ROOT,
        check=True,
    )


def normalize_platform() -> str:
    """把 Python 平台名映射为 Feature Pack 标识；无输入，返回规范字符串。"""

    return {"Windows": "win32", "Darwin": "darwin", "Linux": "linux"}.get(
        platform.system(),
        platform.system().lower(),
    )


def normalize_architecture() -> str:
    """把机器架构映射为 Feature Pack 标识；无输入，返回规范字符串。"""

    machine = platform.machine().lower()
    return {
        "amd64": "x64",
        "x86_64": "x64",
        "aarch64": "arm64",
        "arm64": "arm64",
    }.get(machine, machine)


def list_payload_files(root: Path) -> list[Path]:
    """列出普通载荷文件并拒绝链接；输入根目录，返回确定性列表，非法条目时抛出 ValueError。"""

    files: list[Path] = []
    for path in sorted(root.rglob("*")):
        if path.is_symlink():
            raise ValueError(f"MCP feature pack cannot contain a symbolic link: {path}")
        if path.is_file() and not (path.name == "manifest.json" and path.parent == root):
            files.append(path)
        elif not path.is_file() and not path.is_dir():
            raise ValueError(f"Unsupported MCP feature-pack entry: {path}")
    return files


def hash_file(path: Path) -> str:
    """流式计算文件 SHA-256；输入路径，返回十六进制摘要，读取失败时抛出异常。"""

    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def build_feature_pack(output_override: Path | None, skip_pyinstaller: bool) -> dict[str, Any]:
    """构建并哈希 MCP Pack；输入输出覆盖和构建开关，返回摘要，完整性失败时抛出异常。"""

    if not skip_pyinstaller:
        run_pyinstaller()
    desktop_package = read_json(PROJECT_ROOT / "package.json")
    version = f"{MCP_WORKER_VERSION}-openxnet.{desktop_package['version']}"
    platform_name = normalize_platform()
    architecture = normalize_architecture()
    output_root = (output_override or (
        PROJECT_ROOT / "artifacts" / "feature-packs" / "mcp"
        / f"{version}-{platform_name}-{architecture}"
    )).resolve()
    distribution_root = PROJECT_ROOT / "dist" / "mcp-worker"
    executable_name = "mcp-worker.exe" if platform.system() == "Windows" else "mcp-worker"
    if not (distribution_root / executable_name).is_file():
        raise FileNotFoundError("MCP Worker executable was not built.")
    if output_root.exists():
        shutil.rmtree(output_root)
    shutil.copytree(distribution_root, output_root / "runtime", symlinks=False)
    node_runtime_source = PROJECT_ROOT / "mcp-node-runtime"
    if not all((node_runtime_source / name).is_file() for name in ("package.json", "package-lock.json")):
        raise FileNotFoundError("MCP Node runtime lockfiles are missing.")
    shutil.copytree(node_runtime_source, output_root / "node-runtime", symlinks=False)
    if (PROJECT_ROOT / "LICENSE").is_file():
        shutil.copy2(PROJECT_ROOT / "LICENSE", output_root / "LICENSE")
    third_party_licenses = PROJECT_ROOT / "LICENSE-third-party" / "py_licenses.csv"
    if not third_party_licenses.is_file():
        raise FileNotFoundError("MCP third-party license inventory is missing.")
    shutil.copy2(third_party_licenses, output_root / "THIRD_PARTY_LICENSES.csv")
    entrypoint = f"runtime/{executable_name}"
    files = [
        {
            "path": path.relative_to(output_root).as_posix(),
            "size": path.stat().st_size,
            "sha256": hash_file(path),
        }
        for path in list_payload_files(output_root)
    ]
    manifest = {
        "schema": MANIFEST_SCHEMA,
        "id": "mcp",
        "version": version,
        "runtime": "native",
        "desktopProtocolVersion": "1.0",
        "platforms": [platform_name],
        "architectures": [architecture],
        "entrypoint": entrypoint,
        "runtimeExecutable": entrypoint,
        "files": files,
    }
    (output_root / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return {
        "outputDirectory": str(output_root),
        "version": version,
        "files": len(files),
        "bytes": sum(int(file["size"]) for file in files),
        "entrypoint": str(output_root / entrypoint),
    }


def main() -> int:
    """执行构建并输出 JSON 摘要；无输入，成功返回零，失败异常交由命令行处理。"""

    arguments = parse_arguments()
    print(json.dumps(
        build_feature_pack(arguments.output, arguments.skip_pyinstaller),
        ensure_ascii=False,
        indent=2,
    ))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
