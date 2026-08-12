# -*- coding: utf-8 -*-
"""Persistent FAISS file operations owned exclusively by Vector Worker."""

from __future__ import annotations

import os
from pathlib import Path
import threading
from typing import Any
from uuid import uuid4


class PersistentVectorEngine:
    """Build and mutate flat FAISS indexes with atomic file replacement."""

    def __init__(self) -> None:
        """Create a serialized persistent-index engine without importing FAISS."""

        self._lock = threading.RLock()

    def build(
        self,
        index_path: Path,
        vectors: Any,
        *,
        distance: str = "euclidean",
        normalize_l2: bool = False,
    ) -> dict[str, Any]:
        """Create a flat index from a validated matrix and replace its file atomically."""

        faiss_module, numpy_module = self._load_dependencies()
        matrix = self._validate_matrix(vectors, numpy_module)
        with self._lock:
            if normalize_l2:
                faiss_module.normalize_L2(matrix)
            index = self._create_index(faiss_module, matrix.shape[1], distance)
            index.add(matrix)
            self._write_index_atomic(faiss_module, index, index_path)
            return self._describe_index(index, distance)

    def append(
        self,
        index_path: Path,
        vectors: Any,
        *,
        distance: str = "euclidean",
        normalize_l2: bool = False,
    ) -> dict[str, Any]:
        """Append matrix rows to an existing flat index or create a new index."""

        if not index_path.is_file():
            return self.build(
                index_path,
                vectors,
                distance=distance,
                normalize_l2=normalize_l2,
            )
        faiss_module, numpy_module = self._load_dependencies()
        matrix = self._validate_matrix(vectors, numpy_module)
        with self._lock:
            index = faiss_module.read_index(str(index_path))
            if int(index.d) != int(matrix.shape[1]):
                raise ValueError(
                    f"Vector dimension {matrix.shape[1]} does not match index dimension {index.d}."
                )
            if normalize_l2:
                faiss_module.normalize_L2(matrix)
            index.add(matrix)
            self._write_index_atomic(faiss_module, index, index_path)
            return self._describe_index(index, self._distance_name(faiss_module, index))

    def search(
        self,
        index_path: Path,
        vectors: Any,
        *,
        top_k: int,
        normalize_l2: bool = False,
    ) -> dict[str, Any]:
        """Search an on-disk index and return stable row positions with scores."""

        if not index_path.is_file():
            return {"indexReady": False, "itemCount": 0, "results": []}
        faiss_module, numpy_module = self._load_dependencies()
        matrix = self._validate_matrix(vectors, numpy_module)
        with self._lock:
            index = faiss_module.read_index(str(index_path))
            if int(index.d) != int(matrix.shape[1]):
                raise ValueError(
                    f"Query dimension {matrix.shape[1]} does not match index dimension {index.d}."
                )
            if normalize_l2:
                faiss_module.normalize_L2(matrix)
            result_count = min(top_k, int(index.ntotal))
            if result_count <= 0:
                return {"indexReady": True, "itemCount": 0, "results": []}
            scores, positions = index.search(matrix, result_count)
            results = [
                {"position": int(position), "score": float(score)}
                for score, position in zip(scores[0], positions[0])
                if int(position) >= 0
            ]
            return {
                "indexReady": True,
                "itemCount": int(index.ntotal),
                "dimension": int(index.d),
                "results": results,
            }

    def delete_position(
        self,
        index_path: Path,
        position: int,
        *,
        expected_count: int | None = None,
    ) -> dict[str, Any]:
        """Remove one positional row by reconstructing a same-metric flat index."""

        if not index_path.is_file():
            raise FileNotFoundError(f"Persistent vector index does not exist: {index_path}")
        faiss_module, numpy_module = self._load_dependencies()
        with self._lock:
            index = faiss_module.read_index(str(index_path))
            item_count = int(index.ntotal)
            if expected_count is not None and item_count != expected_count:
                raise ValueError(
                    f"Persistent index contains {item_count} rows; expected {expected_count}."
                )
            if position < 0 or position >= item_count:
                raise IndexError(f"Persistent vector position {position} is out of range.")
            vectors = numpy_module.empty((item_count, int(index.d)), dtype="float32")
            for row_index in range(item_count):
                vectors[row_index] = index.reconstruct(row_index)
            remaining = numpy_module.delete(vectors, position, axis=0)
            distance = self._distance_name(faiss_module, index)
            replacement = self._create_index(faiss_module, int(index.d), distance)
            if remaining.shape[0] > 0:
                replacement.add(remaining)
            self._write_index_atomic(faiss_module, replacement, index_path)
            return {
                "deleted": True,
                "deletedPosition": position,
                "itemCount": int(replacement.ntotal),
                "dimension": int(replacement.d),
                "distance": distance,
            }

    def inspect(self, index_path: Path) -> dict[str, Any]:
        """Return persistent index metadata without exposing vector contents."""

        if not index_path.is_file():
            return {"indexReady": False, "itemCount": 0}
        faiss_module, _numpy_module = self._load_dependencies()
        with self._lock:
            index = faiss_module.read_index(str(index_path))
            return {
                "indexReady": True,
                **self._describe_index(index, self._distance_name(faiss_module, index)),
            }

    def delete_index(self, index_path: Path) -> dict[str, Any]:
        """Delete one persistent index file when it exists."""

        with self._lock:
            existed = index_path.is_file()
            index_path.unlink(missing_ok=True)
            return {"deleted": existed}

    def _load_dependencies(self) -> tuple[Any, Any]:
        """Import FAISS and NumPy only after a persistent operation is requested."""

        import faiss
        import numpy as numpy_module

        return faiss, numpy_module

    def _validate_matrix(self, vectors: Any, numpy_module: Any) -> Any:
        """Convert a matrix to finite contiguous float32 values within resource limits."""

        matrix = numpy_module.asarray(vectors, dtype="float32")
        if matrix.ndim != 2 or matrix.shape[0] <= 0 or matrix.shape[1] <= 0:
            raise ValueError("Persistent vectors must be a non-empty two-dimensional matrix.")
        if matrix.shape[0] > 100_000 or matrix.shape[1] > 8_192:
            raise ValueError("Persistent vector matrix exceeds supported dimensions.")
        if not numpy_module.isfinite(matrix).all():
            raise ValueError("Persistent vector matrix contains non-finite values.")
        return numpy_module.ascontiguousarray(matrix, dtype="float32")

    def _create_index(self, faiss_module: Any, dimension: int, distance: str) -> Any:
        """Create a flat index for one normalized distance identifier."""

        normalized_distance = distance.strip().lower()
        if normalized_distance in {"inner_product", "cosine"}:
            return faiss_module.IndexFlatIP(dimension)
        if normalized_distance == "euclidean":
            return faiss_module.IndexFlatL2(dimension)
        raise ValueError(f"Unsupported persistent vector distance '{distance}'.")

    def _distance_name(self, faiss_module: Any, index: Any) -> str:
        """Map a FAISS metric constant back to a stable distance identifier."""

        if int(index.metric_type) == int(faiss_module.METRIC_INNER_PRODUCT):
            return "inner_product"
        if int(index.metric_type) == int(faiss_module.METRIC_L2):
            return "euclidean"
        raise ValueError(f"Unsupported FAISS metric type {index.metric_type}.")

    def _describe_index(self, index: Any, distance: str) -> dict[str, Any]:
        """Create a JSON-serializable persistent index summary."""

        return {
            "itemCount": int(index.ntotal),
            "dimension": int(index.d),
            "distance": distance,
        }

    def _write_index_atomic(self, faiss_module: Any, index: Any, index_path: Path) -> None:
        """Write a sibling temporary FAISS file and atomically replace the target."""

        index_path.parent.mkdir(parents=True, exist_ok=True)
        temporary_path = index_path.with_name(f".{index_path.name}.{uuid4().hex}.tmp")
        try:
            faiss_module.write_index(index, str(temporary_path))
            os.replace(temporary_path, index_path)
        finally:
            temporary_path.unlink(missing_ok=True)
