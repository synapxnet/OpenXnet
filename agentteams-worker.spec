# -*- mode: python ; coding: utf-8 -*-
"""AgentTeams Worker 的依赖隔离 PyInstaller 规范。"""

from __future__ import annotations

from pathlib import Path


PROJECT_ROOT = Path(SPECPATH).resolve()

analysis = Analysis(
    [str(PROJECT_ROOT / "py" / "workers" / "agentteams_worker.py")],
    pathex=[str(PROJECT_ROOT)],
    binaries=[],
    datas=[],
    hiddenimports=[
        "py.agentteams_runtime",
        "py.workers.agentteams_worker",
        "py.workers.protocol",
        "py.workers.runtime",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "aiohttp",
        "boto3",
        "cv2",
        "datasets",
        "fastapi",
        "flask",
        "numpy",
        "onnxruntime",
        "openai",
        "pydantic",
        "scipy",
        "selenium",
        "sqlalchemy",
        "tensorflow",
        "tokenizers",
        "torch",
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
    name="agentteams-worker",
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
    name="agentteams-worker",
)
