# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller specification for the dependency-isolated Connector Worker."""

from __future__ import annotations

from pathlib import Path

from PyInstaller.utils.hooks import collect_data_files, collect_submodules


PROJECT_ROOT = Path(SPECPATH).resolve()
CONNECTOR_SDK_HIDDEN_IMPORTS = [
    *collect_submodules("lark_oapi.api.im.v1"),
    *collect_submodules("lark_oapi.ws"),
    *collect_submodules("dingtalk_stream"),
    *collect_submodules("discord"),
    *collect_submodules("slack_sdk.socket_mode"),
    *collect_submodules("slack_sdk.web"),
]
FFMPEG_DATA = collect_data_files("imageio_ffmpeg")

analysis = Analysis(
    [str(PROJECT_ROOT / "py" / "workers" / "connector_worker.py")],
    pathex=[str(PROJECT_ROOT)],
    binaries=[],
    datas=[
        (str(PROJECT_ROOT / "config" / "settings_template.json"), "config"),
        (str(PROJECT_ROOT / "config" / "locales.json"), "config"),
        *FFMPEG_DATA,
    ],
    hiddenimports=[
        "py.behavior_engine",
        "py.connector_chat_client",
        "py.connector_credentials",
        "py.connector_settings",
        "py.connector_voice_client",
        "py.connector_worker_client",
        "py.dingtalk_bot_manager",
        "py.discord_bot_manager",
        "py.feishu_bot_manager",
        "py.get_setting",
        "py.image_host",
        "py.image_host_credentials",
        "py.qq_bot_manager",
        "py.random_topic",
        "py.slack_bot_manager",
        "py.telegram_bot_manager",
        "py.telegram_client",
        "py.telegram_credentials",
        "py.workers.connector_worker",
        "py.workers.protocol",
        "py.workers.runtime",
        "PIL.Image",
        "imageio_ffmpeg",
        "pydub",
        *CONNECTOR_SDK_HIDDEN_IMPORTS,
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "boto3",
        "botocore",
        "cv2",
        "datasets",
        "faiss",
        "fastapi",
        "flask",
        "googleapiclient",
        "huggingface_hub",
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
    name="connector-worker",
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
    name="connector-worker",
)
