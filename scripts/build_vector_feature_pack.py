# -*- coding: utf-8 -*-
"""Build a self-contained OpenXnet Vector Worker feature-pack directory."""

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
VECTOR_WORKER_VERSION = "1.0.0"


def parse_arguments() -> argparse.Namespace:
    """Parse output and PyInstaller control options."""

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--skip-pyinstaller", action="store_true")
    return parser.parse_args()


def read_json(path: Path) -> dict[str, Any]:
    """Read one UTF-8 JSON object from disk."""

    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise TypeError(f"Expected a JSON object: {path}")
    return value


def run_pyinstaller() -> None:
    """Build the one-folder Vector Worker with the current Python environment."""

    subprocess.run(
        [
            sys.executable,
            "-m",
            "PyInstaller",
            "vector-worker.spec",
            "--clean",
            "--noconfirm",
        ],
        cwd=PROJECT_ROOT,
        check=True,
    )


def normalize_platform() -> str:
    """Map Python platform names to Node/Electron feature-pack identifiers."""

    return {"Windows": "win32", "Darwin": "darwin", "Linux": "linux"}.get(
        platform.system(),
        platform.system().lower(),
    )


def normalize_architecture() -> str:
    """Map common machine names to Node/Electron architecture identifiers."""

    machine = platform.machine().lower()
    return {
        "amd64": "x64",
        "x86_64": "x64",
        "aarch64": "arm64",
        "arm64": "arm64",
    }.get(machine, machine)


def list_payload_files(root: Path) -> list[Path]:
    """List regular payload files and reject links or unsupported entries."""

    files: list[Path] = []
    for path in sorted(root.rglob("*")):
        if path.is_symlink():
            raise ValueError(f"Vector feature pack cannot contain a symbolic link: {path}")
        if path.is_file():
            if path.name != "manifest.json" or path.parent != root:
                files.append(path)
        elif not path.is_dir():
            raise ValueError(f"Unsupported Vector feature-pack entry: {path}")
    return files


def hash_file(path: Path) -> str:
    """Calculate a streaming SHA-256 digest for one payload file."""

    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def create_file_records(root: Path) -> list[dict[str, Any]]:
    """Create deterministic integrity records for every payload file."""

    records = []
    for path in list_payload_files(root):
        records.append(
            {
                "path": path.relative_to(root).as_posix(),
                "size": path.stat().st_size,
                "sha256": hash_file(path),
            }
        )
    return records


def resolve_worker_executable(distribution_root: Path) -> Path:
    """Resolve the platform-specific PyInstaller worker executable."""

    executable_name = "vector-worker.exe" if platform.system() == "Windows" else "vector-worker"
    executable = distribution_root / executable_name
    if not executable.is_file():
        raise FileNotFoundError(f"Vector Worker executable was not built: {executable}")
    return executable


def build_feature_pack(output_override: Path | None, skip_pyinstaller: bool) -> dict[str, Any]:
    """Build, copy, hash, and describe one platform Vector Worker pack."""

    if not skip_pyinstaller:
        run_pyinstaller()
    desktop_package = read_json(PROJECT_ROOT / "package.json")
    pack_version = f"{VECTOR_WORKER_VERSION}-openxnet.{desktop_package['version']}"
    platform_name = normalize_platform()
    architecture = normalize_architecture()
    output_root = (output_override or (
        PROJECT_ROOT
        / "artifacts"
        / "feature-packs"
        / "vector-index"
        / f"{pack_version}-{platform_name}-{architecture}"
    )).resolve()
    distribution_root = PROJECT_ROOT / "dist" / "vector-worker"
    resolve_worker_executable(distribution_root)

    if output_root.exists():
        shutil.rmtree(output_root)
    runtime_root = output_root / "runtime"
    shutil.copytree(distribution_root, runtime_root, symlinks=False)
    license_path = PROJECT_ROOT / "LICENSE"
    if license_path.is_file():
        shutil.copy2(license_path, output_root / "LICENSE")

    executable_name = "vector-worker.exe" if platform.system() == "Windows" else "vector-worker"
    entrypoint = f"runtime/{executable_name}"
    files = create_file_records(output_root)
    manifest = {
        "schema": MANIFEST_SCHEMA,
        "id": "vector-index",
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
    )
    return {
        "outputDirectory": str(output_root),
        "version": pack_version,
        "files": len(files),
        "bytes": sum(int(file["size"]) for file in files),
        "entrypoint": str(output_root / entrypoint),
    }


def main() -> int:
    """Run the feature-pack build and print a JSON summary."""

    arguments = parse_arguments()
    summary = build_feature_pack(arguments.output, arguments.skip_pyinstaller)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
