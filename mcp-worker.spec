# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller specification for the dependency-isolated MCP Worker."""

from __future__ import annotations

from pathlib import Path

from PyInstaller.utils.hooks import collect_submodules


PROJECT_ROOT = Path(SPECPATH).resolve()
MCP_CLIENT_HIDDEN_IMPORTS = collect_submodules("mcp.client")
SQLALCHEMY_DIALECT_HIDDEN_IMPORTS = collect_submodules("sqlalchemy.dialects")

analysis = Analysis(
    [str(PROJECT_ROOT / "py" / "workers" / "mcp_worker.py")],
    pathex=[str(PROJECT_ROOT)],
    binaries=[],
    datas=[],
    hiddenimports=[
        "py.home_assistant_credentials",
        "py.mcp_clients",
        "py.mcp_credentials",
        "py.mcp_runtime",
        "py.sql_credentials",
        "py.workers.mcp_worker",
        "py.workers.protocol",
        "py.workers.runtime",
        "anyio",
        "httpx",
        "httpx_sse",
        "httpx_ws",
        "mcp",
        "mcp_alchemy",
        "mcp_alchemy.server",
        "oracledb",
        "psycopg2",
        "pydantic",
        "pymssql",
        "pymysql",
        "sqlalchemy",
        "sqlalchemy.engine",
        "sse_starlette",
        "starlette",
        "websockets",
        *MCP_CLIENT_HIDDEN_IMPORTS,
        *SQLALCHEMY_DIALECT_HIDDEN_IMPORTS,
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
        "scipy",
        "selenium",
        "sherpa_onnx",
        "slack_sdk",
        "soundfile",
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
    name="mcp-worker",
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
    name="mcp-worker",
)
