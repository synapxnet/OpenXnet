# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller specification for the dependency-isolated OpenXnet Document Worker."""

from __future__ import annotations

from pathlib import Path
import platform


PROJECT_ROOT = Path(SPECPATH).resolve()
WINDOWS_HIDDEN_IMPORTS = (
    ["pythoncom", "win32com.client"] if platform.system() == "Windows" else []
)

analysis = Analysis(
    [str(PROJECT_ROOT / "py" / "workers" / "document_worker.py")],
    pathex=[str(PROJECT_ROOT)],
    binaries=[],
    datas=[],
    hiddenimports=[
        "py.workers.document_engine",
        "py.workers.document_worker",
        "py.workers.protocol",
        "py.workers.runtime",
        "pypdf",
        "docx",
        "openpyxl",
        "xlrd",
        "striprtf.striprtf",
        "odf",
        "pptx",
        *WINDOWS_HIDDEN_IMPORTS,
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
        "faiss",
        "fastapi",
        "googleapiclient",
        "langchain",
        "mem0",
        "numpy",
        "onnxruntime",
        "qdrant_client",
        "rank_bm25",
        "scipy",
        "selenium",
        "sherpa_onnx",
        "soundfile",
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
    name="document-worker",
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
    name="document-worker",
)
