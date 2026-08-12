# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller specification for the dependency-isolated Desktop Control Worker."""

from __future__ import annotations

from pathlib import Path


PROJECT_ROOT = Path(SPECPATH).resolve()

analysis = Analysis(
    [str(PROJECT_ROOT / "py" / "workers" / "desktop_control_worker.py")],
    pathex=[str(PROJECT_ROOT)],
    binaries=[],
    datas=[],
    hiddenimports=[
        "py.desktop_control_runtime",
        "py.desktop_window_control",
        "py.workers.desktop_control_worker",
        "py.workers.protocol",
        "py.workers.runtime",
        "pythoncom",
        "pywintypes",
        "win32api",
        "win32con",
        "win32gui",
        "win32process",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "aiohttp",
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
        "pydantic",
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
        "uvicorn",
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
    name="desktop-control-worker",
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
    name="desktop-control-worker",
)
