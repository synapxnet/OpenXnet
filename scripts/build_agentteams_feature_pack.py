# -*- coding: utf-8 -*-
"""构建自包含的 OpenXnet AgentTeams Worker 功能包目录。"""

from __future__ import annotations

import argparse
import hashlib
from importlib.metadata import PackageNotFoundError, version
import json
from pathlib import Path
import platform
import shutil
import subprocess
import sys
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
MANIFEST_SCHEMA = "openxnet.feature-pack.v1"
AGENTTEAMS_WORKER_VERSION = "1.0.0"
REQUIRED_BUILD_DISTRIBUTIONS = {"PyInstaller": "6.19.0"}


def parse_arguments() -> argparse.Namespace:
    """解析输出目录和 PyInstaller 开关；无输入，返回参数对象。"""

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


def verify_build_environment() -> None:
    """校验冻结构建依赖；无输入和返回，缺包或版本漂移时失败。"""

    mismatches: list[str] = []
    for distribution, expected in REQUIRED_BUILD_DISTRIBUTIONS.items():
        try:
            actual = version(distribution)
        except PackageNotFoundError:
            mismatches.append(f"{distribution} is missing (expected {expected})")
            continue
        if actual != expected:
            mismatches.append(f"{distribution}=={actual} (expected {expected})")
    if mismatches:
        raise RuntimeError(
            "AgentTeams Pack build environment is not locked: "
            + "; ".join(mismatches)
        )


def run_pyinstaller() -> None:
    """运行 PyInstaller；无输入和返回，构建失败时抛出 CalledProcessError。"""

    verify_build_environment()
    subprocess.run(
        [
            sys.executable,
            "-m",
            "PyInstaller",
            "agentteams-worker.spec",
            "--clean",
            "--noconfirm",
        ],
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
    """列出普通载荷文件并拒绝链接；输入根目录，返回确定性列表。"""

    files: list[Path] = []
    for candidate in sorted(root.rglob("*")):
        if candidate.is_symlink():
            raise ValueError(f"AgentTeams feature pack cannot contain a symbolic link: {candidate}")
        if candidate.is_file():
            if candidate.name != "manifest.json" or candidate.parent != root:
                files.append(candidate)
        elif not candidate.is_dir():
            raise ValueError(f"Unsupported AgentTeams feature-pack entry: {candidate}")
    return files


def hash_file(path: Path) -> str:
    """流式计算文件 SHA-256；输入路径，返回十六进制摘要。"""

    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def create_file_records(root: Path) -> list[dict[str, Any]]:
    """生成载荷完整性记录；输入根目录，返回路径、大小和哈希列表。"""

    return [
        {
            "path": candidate.relative_to(root).as_posix(),
            "size": candidate.stat().st_size,
            "sha256": hash_file(candidate),
        }
        for candidate in list_payload_files(root)
    ]


def resolve_worker_executable(distribution_root: Path) -> Path:
    """解析平台入口；输入分发目录，返回文件路径，产物缺失时抛出异常。"""

    executable_name = "agentteams-worker.exe" if platform.system() == "Windows" else "agentteams-worker"
    executable = distribution_root / executable_name
    if not executable.is_file():
        raise FileNotFoundError(f"AgentTeams Worker executable was not built: {executable}")
    return executable


def build_feature_pack(output_override: Path | None, skip_pyinstaller: bool) -> dict[str, Any]:
    """构建并哈希 AgentTeams Pack；输入输出覆盖和构建开关，返回摘要。"""

    if not skip_pyinstaller:
        run_pyinstaller()
    desktop_package = read_json(PROJECT_ROOT / "package.json")
    pack_version = f"{AGENTTEAMS_WORKER_VERSION}-openxnet.{desktop_package['version']}"
    platform_name = normalize_platform()
    architecture = normalize_architecture()
    output_root = (output_override or (
        PROJECT_ROOT
        / "artifacts"
        / "feature-packs"
        / "agentteams"
        / f"{pack_version}-{platform_name}-{architecture}"
    )).resolve()
    distribution_root = PROJECT_ROOT / "dist" / "agentteams-worker"
    resolve_worker_executable(distribution_root)
    if output_root.exists():
        shutil.rmtree(output_root)
    runtime_root = output_root / "runtime"
    shutil.copytree(distribution_root, runtime_root, symlinks=False)
    license_path = PROJECT_ROOT / "LICENSE"
    if license_path.is_file():
        shutil.copy2(license_path, output_root / "LICENSE")

    executable_name = "agentteams-worker.exe" if platform.system() == "Windows" else "agentteams-worker"
    entrypoint = f"runtime/{executable_name}"
    files = create_file_records(output_root)
    manifest = {
        "schema": MANIFEST_SCHEMA,
        "id": "agentteams",
        "version": pack_version,
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
        newline="\n",
    )
    return {
        "outputDirectory": str(output_root),
        "version": pack_version,
        "files": len(files),
        "bytes": sum(int(file["size"]) for file in files),
        "entrypoint": str(output_root / entrypoint),
    }


def main() -> int:
    """执行构建并输出 JSON 摘要；无输入，成功返回零。"""

    arguments = parse_arguments()
    print(json.dumps(
        build_feature_pack(arguments.output, arguments.skip_pyinstaller),
        ensure_ascii=False,
        indent=2,
    ))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
