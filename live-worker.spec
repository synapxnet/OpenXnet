# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller specification for the dependency-isolated Live Worker."""

from __future__ import annotations

from pathlib import Path

from PyInstaller.utils.hooks import collect_submodules


PROJECT_ROOT = Path(SPECPATH).resolve()
LIVE_HIDDEN_IMPORTS = collect_submodules("py.blivedm")

analysis = Analysis(
    [str(PROJECT_ROOT / "py" / "workers" / "live_worker.py")],
    pathex=[str(PROJECT_ROOT)],
    binaries=[],
    datas=[],
    hiddenimports=[
        "py.live_platform_credentials",
        "py.live_runtime",
        "py.twitch_service",
        "py.workers.live_worker",
        "py.workers.protocol",
        "py.workers.runtime",
        "py.ytdm",
        "aiohttp",
        "brotli",
        "pydantic",
        "yarl",
        *LIVE_HIDDEN_IMPORTS,
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "boto3",
        "botocore",
        "cv2",
        "datasets",
        "discord",
        "faiss",
        "fastapi",
        "flask",
        "googleapiclient",
        "huggingface_hub",
        "langchain",
        "lark_oapi",
        "mem0",
        "numpy",
        "onnxruntime",
        "openai",
        "qdrant_client",
        "rank_bm25",
        "scipy",
        "selenium",
        "sherpa_onnx",
        "slack_sdk",
        "soundfile",
        "sqlalchemy",
        "tensorflow",
        "tokenizers",
        "torch",
        "torchvision",
        "transformers",
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
    name="live-worker",
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
    name="live-worker",
)
