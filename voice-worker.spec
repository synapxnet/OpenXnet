# -*- mode: python ; coding: utf-8 -*-
"""打包依赖隔离且支持配置化 ASR/TTS 的 OpenXnet Voice Worker。"""

from __future__ import annotations

from pathlib import Path

from PyInstaller.utils.hooks import collect_all


PROJECT_ROOT = Path(SPECPATH).resolve()


def collect_runtime_package(package_name: str):
    """收集一个运行时依赖的数据、原生库和动态导入；缺失依赖时构建直接失败。"""

    datas, binaries, hidden_imports = collect_all(package_name)
    return datas, binaries, hidden_imports


sherpa_datas, sherpa_binaries, sherpa_hidden = collect_runtime_package("sherpa_onnx")
soundfile_datas, soundfile_binaries, soundfile_hidden = collect_runtime_package("soundfile")
runtime_datas = [*sherpa_datas, *soundfile_datas]
runtime_binaries = [*sherpa_binaries, *soundfile_binaries]
runtime_hidden_imports = [*sherpa_hidden, *soundfile_hidden]
for runtime_package in (
    "httpx",
    "openai",
    "websockets",
    "edge_tts",
    "pydub",
    "imageio_ffmpeg",
    "tetos",
    "elevenlabs",
    "pyttsx3",
):
    package_datas, package_binaries, package_hidden = collect_runtime_package(runtime_package)
    runtime_datas.extend(package_datas)
    runtime_binaries.extend(package_binaries)
    runtime_hidden_imports.extend(package_hidden)

analysis = Analysis(
    [str(PROJECT_ROOT / "py" / "workers" / "voice_worker.py")],
    pathex=[str(PROJECT_ROOT)],
    binaries=runtime_binaries,
    datas=runtime_datas,
    hiddenimports=[
        "py.workers.protocol",
        "py.workers.runtime",
        "py.workers.configured_voice_engine",
        "py.workers.voice_audio",
        "py.workers.voice_engine",
        "py.workers.voice_worker",
        "py.audio_pcm",
        "py.provider_credentials",
        "py.voice_credentials",
        "numpy",
        *runtime_hidden_imports,
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "fastapi",
        "onnxruntime",
        "scipy",
        "torch",
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
    name="voice-worker",
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
    name="voice-worker",
)
