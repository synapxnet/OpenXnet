# -*- coding: utf-8 -*-
"""OpenXnet Vector Worker serving MiniLM and FAISS over the worker protocol."""

from __future__ import annotations

import argparse
import asyncio
from collections.abc import Mapping, Sequence
import json
import os
from pathlib import Path
import tempfile
from typing import Any

from py.workers.runtime import WorkerRuntime
from py.workers.persistent_vector_engine import PersistentVectorEngine
from py.workers.vector_engine import VectorEngine


DEFAULT_MAX_ARTIFACT_BYTES = 16 * 1024 * 1024
DEFAULT_MAX_VECTOR_ARTIFACT_BYTES = 512 * 1024 * 1024
DEFAULT_MAX_TEXTS = 2048
DEFAULT_MAX_INDEX_ITEMS = 50_000
DEFAULT_MAX_TEXT_CHARACTERS = 4 * 1024 * 1024


class VectorWorkerHandlers:
    """Validate Worker requests and delegate heavy operations to VectorEngine."""

    def __init__(
        self,
        exchange_root: Path,
        model_root: Path,
        *,
        engine: VectorEngine | None = None,
        persistent_engine: PersistentVectorEngine | None = None,
        storage_root: Path | None = None,
        max_artifact_bytes: int = DEFAULT_MAX_ARTIFACT_BYTES,
        max_vector_artifact_bytes: int = DEFAULT_MAX_VECTOR_ARTIFACT_BYTES,
    ) -> None:
        """Create handlers restricted to one application-owned exchange directory."""

        self._exchange_root = exchange_root.resolve()
        self._exchange_root.mkdir(parents=True, exist_ok=True)
        self._engine = engine or VectorEngine(model_root)
        self._persistent_engine = persistent_engine or PersistentVectorEngine()
        self._storage_root = (storage_root or resolve_default_storage_root()).resolve()
        self._storage_root.mkdir(parents=True, exist_ok=True)
        self._max_artifact_bytes = max_artifact_bytes
        self._max_vector_artifact_bytes = max_vector_artifact_bytes

    def status(self, _payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Return dependency and asset readiness without importing inference libraries."""

        return self._engine.get_status()

    async def embed(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Embed texts from an artifact and write vectors to a separate result artifact."""

        request_value = self._read_json_artifact(payload.get("artifactPath"))
        texts = self._read_texts(request_value)
        result = await asyncio.to_thread(self._engine.embed, texts)
        result_path = self._resolve_result_artifact(payload.get("resultArtifactPath"))
        self._write_json_artifact(result_path, result)
        return {
            "resultArtifactPath": str(result_path),
            "count": result["count"],
            "dimension": result["dimension"],
            "promptTokens": result["promptTokens"],
            "inferenceTimeMs": result["inferenceTimeMs"],
        }

    async def rebuild(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Replace the process-local index using items from one bounded artifact."""

        request_value = self._read_json_artifact(payload.get("artifactPath"))
        items = self._read_items(request_value)
        return await asyncio.to_thread(self._engine.rebuild, items)

    async def add(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Append one small item to an existing process-local index."""

        item_id = self._require_text(payload.get("id"), "id")
        text = self._require_text(payload.get("text"), "text")
        return await asyncio.to_thread(self._engine.add, item_id, text)

    async def search(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Search the process-local index with a bounded result count."""

        query = self._require_text(payload.get("query"), "query")
        top_k_value = payload.get("topK", 5)
        if not isinstance(top_k_value, int) or isinstance(top_k_value, bool):
            raise ValueError("Vector search topK must be an integer.")
        if top_k_value < 1 or top_k_value > 100:
            raise ValueError("Vector search topK must be between 1 and 100.")
        return await asyncio.to_thread(self._engine.search, query, top_k_value)

    def release(self, _payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Release model and ephemeral index memory on explicit request."""

        return self._engine.release()

    async def store_build(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Build an atomic persistent FAISS index from a float32 artifact."""

        index_path = self._resolve_storage_index(payload.get("indexPath"))
        vectors = self._read_vector_matrix(payload)
        distance = self._read_distance(payload.get("distance"))
        normalize_l2 = self._read_boolean(payload.get("normalizeL2", False), "normalizeL2")
        return await asyncio.to_thread(
            self._persistent_engine.build,
            index_path,
            vectors,
            distance=distance,
            normalize_l2=normalize_l2,
        )

    async def store_append(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Append float32 artifact rows to a persistent FAISS index."""

        index_path = self._resolve_storage_index(payload.get("indexPath"))
        vectors = self._read_vector_matrix(payload)
        distance = self._read_distance(payload.get("distance"))
        normalize_l2 = self._read_boolean(payload.get("normalizeL2", False), "normalizeL2")
        return await asyncio.to_thread(
            self._persistent_engine.append,
            index_path,
            vectors,
            distance=distance,
            normalize_l2=normalize_l2,
        )

    async def store_search(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Search a persistent FAISS index using query vectors from an artifact."""

        index_path = self._resolve_storage_index(payload.get("indexPath"))
        vectors = self._read_vector_matrix(payload)
        top_k = self._read_integer(payload.get("topK", 5), "topK", minimum=1, maximum=1_000)
        normalize_l2 = self._read_boolean(payload.get("normalizeL2", False), "normalizeL2")
        return await asyncio.to_thread(
            self._persistent_engine.search,
            index_path,
            vectors,
            top_k=top_k,
            normalize_l2=normalize_l2,
        )

    async def store_delete_position(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Delete one positional row from a persistent FAISS index."""

        index_path = self._resolve_storage_index(payload.get("indexPath"))
        position = self._read_integer(payload.get("position"), "position", minimum=0)
        expected_value = payload.get("expectedCount")
        expected_count = (
            None
            if expected_value is None
            else self._read_integer(expected_value, "expectedCount", minimum=1)
        )
        return await asyncio.to_thread(
            self._persistent_engine.delete_position,
            index_path,
            position,
            expected_count=expected_count,
        )

    async def store_inspect(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Inspect one persistent FAISS file below the configured storage root."""

        index_path = self._resolve_storage_index(payload.get("indexPath"))
        return await asyncio.to_thread(self._persistent_engine.inspect, index_path)

    async def store_delete(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Delete one persistent FAISS file below the configured storage root."""

        index_path = self._resolve_storage_index(payload.get("indexPath"))
        return await asyncio.to_thread(self._persistent_engine.delete_index, index_path)

    def _read_json_artifact(self, value: Any) -> Any:
        """Read one size-bounded UTF-8 JSON artifact below the exchange root."""

        artifact_path = self._resolve_input_artifact(value)
        try:
            return json.loads(artifact_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as error:
            raise ValueError(f"Vector artifact contains invalid JSON: {error.msg}.") from error

    def _read_vector_matrix(self, payload: Mapping[str, Any]) -> Any:
        """Map an exact-size little-endian float32 artifact to a finite NumPy matrix."""

        vector_count = self._read_integer(
            payload.get("vectorCount"),
            "vectorCount",
            minimum=1,
            maximum=100_000,
        )
        dimension = self._read_integer(
            payload.get("dimension"),
            "dimension",
            minimum=1,
            maximum=8_192,
        )
        artifact_path = self._resolve_input_artifact(
            payload.get("artifactPath"),
            max_bytes=self._max_vector_artifact_bytes,
        )
        expected_bytes = vector_count * dimension * 4
        if artifact_path.stat().st_size != expected_bytes:
            raise ValueError(
                f"Vector float32 artifact contains {artifact_path.stat().st_size} bytes; "
                f"expected {expected_bytes}."
            )
        import numpy as numpy_module

        matrix = numpy_module.fromfile(artifact_path, dtype="<f4")
        matrix = matrix.reshape((vector_count, dimension))
        if not numpy_module.isfinite(matrix).all():
            raise ValueError("Vector float32 artifact contains non-finite values.")
        return matrix

    def _write_json_artifact(self, artifact_path: Path, value: Mapping[str, Any]) -> None:
        """Write one compact UTF-8 JSON result into a pre-created private artifact."""

        artifact_path.write_text(
            json.dumps(value, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )

    def _resolve_input_artifact(self, value: Any, *, max_bytes: int | None = None) -> Path:
        """Validate a readable regular artifact and enforce the configured size limit."""

        artifact_path = self._resolve_exchange_path(value, "artifactPath")
        if not artifact_path.is_file():
            raise FileNotFoundError(f"Vector artifact does not exist: {artifact_path}")
        artifact_size = artifact_path.stat().st_size
        resolved_max_bytes = max_bytes or self._max_artifact_bytes
        if artifact_size <= 0 or artifact_size > resolved_max_bytes:
            raise ValueError(
                f"Vector artifact size must be between 1 and {resolved_max_bytes} bytes."
            )
        return artifact_path

    def _resolve_storage_index(self, value: Any) -> Path:
        """Resolve one FAISS path and reject files escaping the user-data root."""

        path_value = self._require_text(value, "indexPath")
        index_path = Path(path_value).resolve()
        if index_path.suffix.lower() != ".faiss":
            raise ValueError("Persistent vector indexes must use the .faiss extension.")
        try:
            index_path.relative_to(self._storage_root)
        except ValueError as error:
            raise ValueError("Persistent vector index is outside the storage root.") from error
        return index_path

    def _resolve_result_artifact(self, value: Any) -> Path:
        """Validate a pre-created result artifact below the exchange root."""

        artifact_path = self._resolve_exchange_path(value, "resultArtifactPath")
        if not artifact_path.is_file():
            raise FileNotFoundError(f"Vector result artifact does not exist: {artifact_path}")
        return artifact_path

    def _resolve_exchange_path(self, value: Any, field_name: str) -> Path:
        """Resolve one path and reject files escaping the configured exchange root."""

        path_value = self._require_text(value, field_name)
        artifact_path = Path(path_value).resolve()
        try:
            artifact_path.relative_to(self._exchange_root)
        except ValueError as error:
            raise ValueError(f"Vector {field_name} is outside the exchange root.") from error
        return artifact_path

    def _read_texts(self, value: Any) -> list[str]:
        """Validate an embedding request artifact and enforce batch character limits."""

        if not isinstance(value, dict):
            raise ValueError("Vector embedding artifact must contain a JSON object.")
        texts_value = value.get("texts")
        if not isinstance(texts_value, list) or not texts_value:
            raise ValueError("Vector embedding artifact requires a non-empty texts array.")
        if len(texts_value) > DEFAULT_MAX_TEXTS:
            raise ValueError(f"Vector embedding batch cannot exceed {DEFAULT_MAX_TEXTS} texts.")
        texts = [self._require_text(text, "texts item") for text in texts_value]
        if sum(len(text) for text in texts) > DEFAULT_MAX_TEXT_CHARACTERS:
            raise ValueError(
                f"Vector embedding batch cannot exceed {DEFAULT_MAX_TEXT_CHARACTERS} characters."
            )
        return texts

    def _read_items(self, value: Any) -> list[dict[str, str]]:
        """Validate index item objects stored in a rebuild artifact."""

        if not isinstance(value, dict):
            raise ValueError("Vector rebuild artifact must contain a JSON object.")
        items_value = value.get("items")
        if not isinstance(items_value, list) or not items_value:
            raise ValueError("Vector rebuild artifact requires a non-empty items array.")
        if len(items_value) > DEFAULT_MAX_INDEX_ITEMS:
            raise ValueError(f"Vector rebuild cannot exceed {DEFAULT_MAX_INDEX_ITEMS} items.")
        items: list[dict[str, str]] = []
        total_characters = 0
        for item in items_value:
            if not isinstance(item, dict):
                raise ValueError("Vector rebuild items must be JSON objects.")
            item_id = self._require_text(item.get("id"), "item id")
            item_text = self._require_text(item.get("text"), "item text")
            total_characters += len(item_id) + len(item_text)
            items.append({"id": item_id, "text": item_text})
        if total_characters > DEFAULT_MAX_TEXT_CHARACTERS:
            raise ValueError(
                f"Vector rebuild cannot exceed {DEFAULT_MAX_TEXT_CHARACTERS} characters."
            )
        return items

    def _require_text(self, value: Any, field_name: str) -> str:
        """Normalize one required non-empty text field."""

        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"Vector request field '{field_name}' must be non-empty text.")
        return value.strip()

    def _read_integer(
        self,
        value: Any,
        field_name: str,
        *,
        minimum: int,
        maximum: int | None = None,
    ) -> int:
        """Validate one bounded integer control field."""

        if not isinstance(value, int) or isinstance(value, bool):
            raise ValueError(f"Vector request field '{field_name}' must be an integer.")
        if value < minimum or (maximum is not None and value > maximum):
            maximum_text = f" and {maximum}" if maximum is not None else ""
            raise ValueError(
                f"Vector request field '{field_name}' must be between {minimum}{maximum_text}."
            )
        return value

    def _read_boolean(self, value: Any, field_name: str) -> bool:
        """Validate one strict boolean control field."""

        if not isinstance(value, bool):
            raise ValueError(f"Vector request field '{field_name}' must be boolean.")
        return value

    def _read_distance(self, value: Any) -> str:
        """Normalize one supported persistent-index distance strategy."""

        distance = "euclidean" if value is None else self._require_text(value, "distance").lower()
        if distance not in {"euclidean", "inner_product", "cosine"}:
            raise ValueError(f"Unsupported persistent vector distance '{distance}'.")
        return distance


def resolve_default_exchange_root() -> Path:
    """Resolve the artifact exchange directory shared with the legacy backend."""

    configured = os.environ.get("OPENXNET_VECTOR_EXCHANGE_DIR", "").strip()
    if configured:
        return Path(configured)
    return Path(tempfile.gettempdir()) / "openxnet-vector-exchange"


def resolve_default_model_root() -> Path:
    """Resolve the external embedding-model root without importing legacy settings."""

    configured = os.environ.get("OPENXNET_EMBEDDING_MODEL_DIR", "").strip()
    if configured:
        return Path(configured)
    user_data = os.environ.get("OPENXNET_USER_DATA_DIR", "").strip()
    if user_data:
        return Path(user_data) / "ebd"
    return Path.home() / ".openxnet" / "ebd"


def resolve_default_storage_root() -> Path:
    """Resolve the only directory tree allowed to contain persistent indexes."""

    configured = os.environ.get("OPENXNET_USER_DATA_DIR", "").strip()
    if configured:
        return Path(configured)
    return Path.home() / ".openxnet"


def parse_arguments() -> argparse.Namespace:
    """Parse standalone worker artifact, model, and request-size options."""

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--exchange-root", type=Path, default=resolve_default_exchange_root())
    parser.add_argument("--model-root", type=Path, default=resolve_default_model_root())
    parser.add_argument("--storage-root", type=Path, default=resolve_default_storage_root())
    parser.add_argument(
        "--max-artifact-bytes",
        type=int,
        default=DEFAULT_MAX_ARTIFACT_BYTES,
    )
    return parser.parse_args()


async def run() -> None:
    """Create Vector Worker handlers and serve NDJSON requests on stdio."""

    arguments = parse_arguments()
    handlers = VectorWorkerHandlers(
        arguments.exchange_root,
        arguments.model_root,
        storage_root=arguments.storage_root,
        max_artifact_bytes=arguments.max_artifact_bytes,
    )
    runtime = WorkerRuntime("vector-index")
    runtime.register_handler("vector.status", handlers.status)
    runtime.register_handler("vector.embed", handlers.embed)
    runtime.register_handler("vector.rebuild", handlers.rebuild)
    runtime.register_handler("vector.add", handlers.add)
    runtime.register_handler("vector.search", handlers.search)
    runtime.register_handler("vector.release", handlers.release)
    runtime.register_handler("vector.store.build", handlers.store_build)
    runtime.register_handler("vector.store.append", handlers.store_append)
    runtime.register_handler("vector.store.search", handlers.store_search)
    runtime.register_handler("vector.store.delete-position", handlers.store_delete_position)
    runtime.register_handler("vector.store.inspect", handlers.store_inspect)
    runtime.register_handler("vector.store.delete", handlers.store_delete)
    await runtime.serve_stdio()


if __name__ == "__main__":
    asyncio.run(run())
