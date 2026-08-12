# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller specification for the dependency-isolated OpenXnet Vector Worker."""

from __future__ import annotations

from pathlib import Path

PROJECT_ROOT = Path(SPECPATH).resolve()

analysis = Analysis(
    [str(PROJECT_ROOT / "py" / "workers" / "vector_worker.py")],
    pathex=[str(PROJECT_ROOT)],
    binaries=[],
    datas=[],
    hiddenimports=[
        "py.workers.protocol",
        "py.workers.persistent_vector_engine",
        "py.workers.runtime",
        "py.workers.vector_engine",
        "py.workers.vector_worker",
        "numpy",
        "tokenizers",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "fastapi",
        "aiohttp",
        "boto3",
        "botocore",
        "cryptography",
        "cv2",
        "datasets",
        "lxml",
        "langchain",
        "openai",
        "PIL",
        "pydantic",
        "s3fs",
        "scipy",
        "soundfile",
        "tensorflow",
        "tiktoken",
        "torch",
        "torchvision",
    ],
    noarchive=False,
    optimize=1,
)

python_archive = PYZ(analysis.pure)

executable = EXE(
    python_archive,
    analysis.scripts,
    [],
    exclude_binaries=True,
    name="vector-worker",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
    disable_windowed_traceback=False,
)

collection = COLLECT(
    executable,
    analysis.binaries,
    analysis.datas,
    strip=False,
    upx=False,
    name="vector-worker",
)
