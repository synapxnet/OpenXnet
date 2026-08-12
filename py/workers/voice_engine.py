# -*- coding: utf-8 -*-
"""Lazy local speech-recognition engine owned by the Voice Worker."""

from __future__ import annotations

import importlib
import importlib.util
from pathlib import Path
import threading
from typing import Any


DEFAULT_SHERPA_MODEL_NAME = "sherpa-onnx-sense-voice-zh-en-ja-ko-yue"
SHERPA_MODEL_FILE = "model.int8.onnx"
SHERPA_TOKENS_FILE = "tokens.txt"


class SherpaAsrEngine:
    """Load and cache one Sherpa recognizer inside the isolated worker process."""

    def __init__(self, model_root: Path) -> None:
        """Create an unloaded engine rooted at the application ASR model directory."""

        self._model_root = model_root.resolve()
        self._recognizer: Any | None = None
        self._loaded_model_name: str | None = None
        self._load_lock = threading.Lock()

    def get_status(self, model_name: str = DEFAULT_SHERPA_MODEL_NAME) -> dict[str, Any]:
        """Return dependency, model-file, and recognizer state without loading inference code."""

        model_path, tokens_path = self._resolve_model_files(model_name)
        dependency_available = importlib.util.find_spec("sherpa_onnx") is not None
        return {
            "dependencyAvailable": dependency_available,
            "modelName": model_name,
            "modelRoot": str(self._model_root),
            "modelAvailable": model_path.is_file() and tokens_path.is_file(),
            "loaded": self._recognizer is not None and self._loaded_model_name == model_name,
            "requiredFiles": [SHERPA_MODEL_FILE, SHERPA_TOKENS_FILE],
        }

    def transcribe_file(
        self,
        audio_path: Path,
        model_name: str = DEFAULT_SHERPA_MODEL_NAME,
    ) -> str:
        """Decode one audio artifact and run local Sherpa inference synchronously."""

        recognizer = self._get_recognizer(model_name)
        soundfile = importlib.import_module("soundfile")
        audio, sample_rate = soundfile.read(
            str(audio_path),
            dtype="float32",
            always_2d=True,
        )
        if sample_rate <= 0 or audio.size == 0:
            raise ValueError("Audio artifact is empty or has an invalid sample rate.")
        mono_audio = audio.mean(axis=1)
        stream = recognizer.create_stream()
        stream.accept_waveform(sample_rate, mono_audio)
        recognizer.decode_stream(stream)
        return str(stream.result.text or "").strip()

    def release(self) -> None:
        """Release the cached recognizer so model memory can be reclaimed."""

        with self._load_lock:
            self._recognizer = None
            self._loaded_model_name = None

    def _get_recognizer(self, model_name: str) -> Any:
        """Return a cached recognizer or lazily construct one for the requested model."""

        if self._recognizer is not None and self._loaded_model_name == model_name:
            return self._recognizer
        with self._load_lock:
            if self._recognizer is not None and self._loaded_model_name == model_name:
                return self._recognizer
            model_path, tokens_path = self._resolve_model_files(model_name)
            if not model_path.is_file() or not tokens_path.is_file():
                raise FileNotFoundError(
                    f"Sherpa model '{model_name}' is incomplete under '{model_path.parent}'."
                )
            sherpa_onnx = importlib.import_module("sherpa_onnx")
            recognizer = sherpa_onnx.OfflineRecognizer.from_sense_voice(
                model=str(model_path),
                tokens=str(tokens_path),
                num_threads=4,
                provider="cpu",
                use_itn=True,
                debug=False,
            )
            self._recognizer = recognizer
            self._loaded_model_name = model_name
            return recognizer

    def _resolve_model_files(self, model_name: str) -> tuple[Path, Path]:
        """Resolve model files while preventing a model name from escaping the model root."""

        if not model_name or model_name in {".", ".."} or "/" in model_name or "\\" in model_name:
            raise ValueError("Sherpa model name must be one safe path segment.")
        model_directory = (self._model_root / model_name).resolve()
        try:
            model_directory.relative_to(self._model_root)
        except ValueError as error:
            raise ValueError("Sherpa model path escapes the configured model root.") from error
        return model_directory / SHERPA_MODEL_FILE, model_directory / SHERPA_TOKENS_FILE
