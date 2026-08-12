# -*- coding: utf-8 -*-
"""Lazy MiniLM embedding and ephemeral FAISS index engine for Vector Worker."""

from __future__ import annotations

import importlib.util
from pathlib import Path
import threading
import time
from typing import Any, Sequence

from py.worker_capability_contracts import DEFAULT_MINILM_MODEL_NAME

DEFAULT_EMBEDDING_DIMENSION = 384
DEFAULT_INFERENCE_BATCH_SIZE = 128
VECTOR_DEPENDENCIES = ("faiss", "numpy", "onnxruntime", "tokenizers")


class MiniLMOnnxPredictor:
    """Run normalized sentence embeddings with a local MiniLM ONNX model."""

    def __init__(self, model_directory: Path, *, use_gpu: bool = False) -> None:
        """Load tokenizer and ONNX session from one local model directory."""

        import numpy as numpy_module
        import onnxruntime as onnxruntime_module
        from tokenizers import Tokenizer

        self._numpy = numpy_module
        self.model_directory = model_directory.resolve()
        tokenizer_path = self.model_directory / "tokenizer.json"
        if not tokenizer_path.is_file():
            raise FileNotFoundError(f"MiniLM tokenizer was not found: {tokenizer_path}")
        self.tokenizer = Tokenizer.from_file(str(tokenizer_path))
        self._configure_tokenizer()
        model_path = self._resolve_model_path()
        providers = (
            ["CUDAExecutionProvider", "CPUExecutionProvider"]
            if use_gpu
            else ["CPUExecutionProvider"]
        )
        self.session = onnxruntime_module.InferenceSession(
            str(model_path),
            providers=providers,
        )
        self.input_names = {item.name for item in self.session.get_inputs()}

    def predict(self, sentences: Sequence[str]) -> Any:
        """Return L2-normalized float32 embeddings for validated sentences."""

        encodings = self.tokenizer.encode_batch(list(sentences), add_special_tokens=True)
        numpy_module = self._numpy
        inference_inputs = {
            "input_ids": numpy_module.asarray(
                [encoding.ids for encoding in encodings],
                dtype=numpy_module.int64,
            ),
            "attention_mask": numpy_module.asarray(
                [encoding.attention_mask for encoding in encodings],
                dtype=numpy_module.int64,
            ),
        }
        if "token_type_ids" in self.input_names:
            inference_inputs["token_type_ids"] = numpy_module.asarray(
                [encoding.type_ids for encoding in encodings],
                dtype=numpy_module.int64,
            )
        outputs = self.session.run(None, inference_inputs)
        embeddings = self._mean_pool(outputs[0], inference_inputs["attention_mask"])
        return self._normalize(embeddings).astype(numpy_module.float32)

    def count_tokens(self, sentences: Sequence[str]) -> int:
        """Count tokenizer pieces for usage metadata without another inference pass."""

        return sum(
            len(self.tokenizer.encode(sentence, add_special_tokens=False).ids)
            for sentence in sentences
        )

    def _configure_tokenizer(self) -> None:
        """Apply the same dynamic padding and 512-token truncation used by AutoTokenizer."""

        pad_token = next(
            (
                candidate
                for candidate in ("[PAD]", "<pad>")
                if self.tokenizer.token_to_id(candidate) is not None
            ),
            None,
        )
        if pad_token is None:
            raise ValueError("MiniLM tokenizer does not define a supported padding token.")
        pad_id = self.tokenizer.token_to_id(pad_token)
        self.tokenizer.enable_padding(pad_id=int(pad_id), pad_token=pad_token)
        self.tokenizer.enable_truncation(max_length=512)

    def _resolve_model_path(self) -> Path:
        """Select the optimized ONNX file when present, otherwise the standard file."""

        optimized_path = self.model_directory / "model_O4.onnx"
        standard_path = self.model_directory / "model.onnx"
        if optimized_path.is_file():
            return optimized_path
        if standard_path.is_file():
            return standard_path
        raise FileNotFoundError(f"MiniLM ONNX model was not found in {self.model_directory}.")

    def _mean_pool(self, token_embeddings: Any, attention_mask: Any) -> Any:
        """Mean-pool token embeddings while excluding padded positions."""

        numpy_module = self._numpy
        mask = numpy_module.expand_dims(attention_mask, -1).astype(float)
        mask = numpy_module.broadcast_to(mask, token_embeddings.shape)
        denominator = numpy_module.clip(mask.sum(axis=1), a_min=1e-9, a_max=None)
        return numpy_module.sum(token_embeddings * mask, axis=1) / denominator

    def _normalize(self, vectors: Any) -> Any:
        """Normalize every embedding row to unit L2 length."""

        numpy_module = self._numpy
        norm = numpy_module.linalg.norm(vectors, axis=1, keepdims=True)
        return vectors / numpy_module.clip(norm, a_min=1e-9, a_max=None)


class VectorEngine:
    """Own one lazy embedding model and one process-local FAISS index."""

    def __init__(
        self,
        model_root: Path,
        *,
        model_name: str = DEFAULT_MINILM_MODEL_NAME,
        use_gpu: bool = False,
    ) -> None:
        """Create an unloaded engine using externally managed model assets."""

        self._model_name = model_name
        self._model_directory = (model_root / model_name).resolve()
        self._use_gpu = use_gpu
        self._predictor: MiniLMOnnxPredictor | None = None
        self._index: Any = None
        self._ids: list[str] = []
        self._dimension = DEFAULT_EMBEDDING_DIMENSION
        self._lock = threading.RLock()

    def get_status(self) -> dict[str, Any]:
        """Report dependency, model, and index state without importing heavy libraries."""

        with self._lock:
            return {
                "modelName": self._model_name,
                "modelDirectory": str(self._model_directory),
                "dependencyAvailable": self._dependencies_available(),
                "modelAvailable": self._model_files_available(),
                "loaded": self._predictor is not None,
                "indexReady": self._index is not None,
                "dimension": self._dimension,
                "itemCount": len(self._ids),
            }

    def embed(self, texts: Sequence[str]) -> dict[str, Any]:
        """Embed a non-empty text batch and return JSON-serializable vectors and usage."""

        normalized_texts = self._validate_texts(texts)
        started_at = time.perf_counter()
        with self._lock:
            predictor = self._get_predictor_locked()
            vectors = self._predict_batches_locked(predictor, normalized_texts)
            token_count = predictor.count_tokens(normalized_texts)
            self._dimension = int(vectors.shape[1])
            vector_values = vectors.tolist()
        return {
            "embeddings": vector_values,
            "dimension": self._dimension,
            "count": len(vector_values),
            "promptTokens": token_count,
            "inferenceTimeMs": int((time.perf_counter() - started_at) * 1000),
        }

    def rebuild(self, items: Sequence[dict[str, str]]) -> dict[str, Any]:
        """Replace the ephemeral cosine-similarity index with validated text items."""

        normalized_items = self._validate_items(items)
        texts = [item["text"] for item in normalized_items]
        with self._lock:
            predictor = self._get_predictor_locked()
            vectors = self._predict_batches_locked(predictor, texts)
            import faiss
            import numpy as numpy_module

            matrix = numpy_module.asarray(vectors, dtype="float32")
            faiss.normalize_L2(matrix)
            self._dimension = int(matrix.shape[1])
            index = faiss.IndexFlatIP(self._dimension)
            index.add(matrix)
            self._index = index
            self._ids = [item["id"] for item in normalized_items]
            return {
                "ready": True,
                "dimension": self._dimension,
                "itemCount": len(self._ids),
            }

    def add(self, item_id: str, text: str) -> dict[str, Any]:
        """Embed and append one item when an ephemeral index already exists."""

        normalized_id = self._validate_text(item_id, "item id")
        normalized_text = self._validate_text(text, "item text")
        with self._lock:
            if self._index is None:
                return {"added": False, "indexReady": False, "itemCount": 0}
            predictor = self._get_predictor_locked()
            vector = predictor.predict([normalized_text])
            import faiss
            import numpy as numpy_module

            matrix = numpy_module.asarray(vector, dtype="float32")
            faiss.normalize_L2(matrix)
            self._index.add(matrix)
            self._ids.append(normalized_id)
            return {"added": True, "indexReady": True, "itemCount": len(self._ids)}

    def search(self, query: str, top_k: int) -> dict[str, Any]:
        """Search the ephemeral index and return identifiers with cosine scores."""

        normalized_query = self._validate_text(query, "query")
        if top_k <= 0:
            raise ValueError("Vector search top_k must be positive.")
        with self._lock:
            if self._index is None or not self._ids:
                return {"results": [], "indexReady": False, "itemCount": 0}
            predictor = self._get_predictor_locked()
            query_vector = predictor.predict([normalized_query])
            import faiss
            import numpy as numpy_module

            matrix = numpy_module.asarray(query_vector, dtype="float32")
            faiss.normalize_L2(matrix)
            result_count = min(top_k, len(self._ids))
            scores, indices = self._index.search(matrix, result_count)
            results = [
                {"id": self._ids[int(index)], "score": float(score)}
                for score, index in zip(scores[0], indices[0])
                if 0 <= int(index) < len(self._ids)
            ]
            return {
                "results": results,
                "indexReady": True,
                "itemCount": len(self._ids),
            }

    def release(self) -> dict[str, Any]:
        """Release model and index memory while leaving the worker process alive."""

        with self._lock:
            self._predictor = None
            self._index = None
            self._ids = []
        return {"released": True}

    def _get_predictor_locked(self) -> MiniLMOnnxPredictor:
        """Load the predictor once while the engine lock is held."""

        if self._predictor is None:
            self._predictor = MiniLMOnnxPredictor(
                self._model_directory,
                use_gpu=self._use_gpu,
            )
        return self._predictor

    def _predict_batches_locked(
        self,
        predictor: MiniLMOnnxPredictor,
        texts: Sequence[str],
    ) -> Any:
        """Run bounded inference batches and concatenate their normalized matrices."""

        matrices = [
            predictor.predict(texts[offset : offset + DEFAULT_INFERENCE_BATCH_SIZE])
            for offset in range(0, len(texts), DEFAULT_INFERENCE_BATCH_SIZE)
        ]
        if len(matrices) == 1:
            return matrices[0]
        import numpy as numpy_module

        return numpy_module.concatenate(matrices, axis=0)

    def _model_files_available(self) -> bool:
        """Check for both model and tokenizer assets without loading either runtime."""

        model_available = any(
            (self._model_directory / name).is_file()
            for name in ("model_O4.onnx", "model.onnx")
        )
        tokenizer_available = (self._model_directory / "tokenizer.json").is_file()
        return model_available and tokenizer_available

    def _dependencies_available(self) -> bool:
        """Check that frozen or source runtime modules can be resolved without importing them."""

        return all(importlib.util.find_spec(name) is not None for name in VECTOR_DEPENDENCIES)

    def _validate_texts(self, texts: Sequence[str]) -> list[str]:
        """Validate and copy a non-empty sequence of embedding inputs."""

        if isinstance(texts, (str, bytes)) or not texts:
            raise ValueError("Embedding texts must be a non-empty sequence.")
        return [self._validate_text(text, "embedding text") for text in texts]

    def _validate_items(self, items: Sequence[dict[str, str]]) -> list[dict[str, str]]:
        """Validate and copy index identifiers and text values."""

        if not items:
            raise ValueError("Vector index rebuild requires at least one item.")
        normalized_items: list[dict[str, str]] = []
        for item in items:
            if not isinstance(item, dict):
                raise ValueError("Vector index items must be objects.")
            normalized_items.append(
                {
                    "id": self._validate_text(item.get("id"), "item id"),
                    "text": self._validate_text(item.get("text"), "item text"),
                }
            )
        return normalized_items

    def _validate_text(self, value: Any, field_name: str) -> str:
        """Normalize one required non-empty string field."""

        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"Vector {field_name} must be non-empty text.")
        return value.strip()
