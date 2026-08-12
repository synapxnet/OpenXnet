# -*- coding: utf-8 -*-
"""Mem0-compatible vector store backed by Desktop Core Vector Worker."""

from __future__ import annotations

import json
import os
from pathlib import Path
import pickle
import threading
from typing import Any, Optional, Sequence
from uuid import uuid4

from pydantic import BaseModel

from py.vector_worker_client import VectorWorkerClient


RECORDS_SCHEMA = "openxnet.vector-records.v1"
_STORE_LOCKS: dict[str, threading.RLock] = {}
_STORE_LOCKS_GUARD = threading.Lock()


class VectorStoreRecord(BaseModel):
    """Mem0-compatible vector result containing an identifier and payload."""

    id: Optional[str]
    score: Optional[float]
    payload: Optional[dict[str, Any]]


class RestrictedMemoryUnpickler(pickle.Unpickler):
    """Read legacy Mem0 dict/tuple pickles while refusing global class loading."""

    def find_class(self, module: str, name: str) -> Any:
        """Reject every global reference because legacy Mem0 metadata needs none."""

        raise pickle.UnpicklingError(f"Legacy memory metadata global is not allowed: {module}.{name}")


def _get_store_lock(path: Path) -> threading.RLock:
    """Return one process-wide reentrant lock for a metadata file."""

    key = os.path.normcase(str(path.resolve()))
    with _STORE_LOCKS_GUARD:
        lock = _STORE_LOCKS.get(key)
        if lock is None:
            lock = threading.RLock()
            _STORE_LOCKS[key] = lock
        return lock


def register_mem0_vector_worker_store() -> None:
    """Redirect Mem0's validated FAISS provider name to the Worker-backed class."""

    from mem0.utils.factory import VectorStoreFactory

    VectorStoreFactory.provider_to_class["faiss"] = (
        "py.memory.vector_worker_store.VectorWorkerStore"
    )


class VectorWorkerStore:
    """Implement Mem0 vector-store operations without importing FAISS in-process."""

    def __init__(
        self,
        collection_name: str,
        path: Optional[str] = None,
        distance_strategy: str = "euclidean",
        normalize_L2: bool = False,
        embedding_model_dims: int = 1536,
        *,
        client: VectorWorkerClient | None = None,
    ) -> None:
        """Load safe metadata and bind one collection to persistent Worker RPC."""

        self.collection_name = collection_name
        self.path = Path(path or (Path.home() / ".openxnet" / "memory" / collection_name)).resolve()
        self.path.mkdir(parents=True, exist_ok=True)
        self.distance_strategy = distance_strategy
        self.normalize_L2 = normalize_L2
        self.embedding_model_dims = embedding_model_dims
        self._client = client or VectorWorkerClient.from_environment()
        self._index_path = self.path / f"{collection_name}.faiss"
        self._records_path = self.path / f"{collection_name}.records.json"
        self._legacy_path = self.path / f"{collection_name}.pkl"
        self._lock = _get_store_lock(self._records_path)
        self.docstore: dict[str, dict[str, Any]] = {}
        self.index_to_id: dict[int, str] = {}
        with self._lock:
            self._load_records()

    def create_col(
        self,
        name: str,
        vector_size: int | None = None,
        distance: str | None = None,
    ) -> "VectorWorkerStore":
        """Select collection metadata without starting the Worker process."""

        self.collection_name = name
        if vector_size is not None:
            self.embedding_model_dims = int(vector_size)
        if distance is not None:
            self.distance_strategy = distance
        return self

    def insert(
        self,
        vectors: Sequence[Sequence[float]],
        payloads: Optional[Sequence[dict[str, Any]]] = None,
        ids: Optional[Sequence[str]] = None,
    ) -> None:
        """Append vectors through Worker RPC and atomically commit their metadata."""

        vector_count = len(vectors)
        resolved_ids = (
            [str(uuid4()) for _index in range(vector_count)]
            if ids is None
            else list(ids)
        )
        resolved_payloads = (
            [{} for _index in range(vector_count)]
            if payloads is None
            else list(payloads)
        )
        if vector_count != len(resolved_ids) or vector_count != len(resolved_payloads):
            raise ValueError("Vectors, payloads, and IDs must have the same length.")
        with self._lock:
            self._load_records()
            duplicate_ids = [vector_id for vector_id in resolved_ids if vector_id in self.docstore]
            if duplicate_ids:
                raise ValueError(f"Vector identifiers already exist: {', '.join(duplicate_ids)}")
            result = self._client.persistent_append_sync(
                self._index_path,
                vectors,
                distance=self.distance_strategy,
                normalize_l2=self._should_normalize_l2(),
            )
            starting_position = int(result["itemCount"]) - vector_count
            for offset, (vector_id, payload) in enumerate(zip(resolved_ids, resolved_payloads)):
                self.docstore[str(vector_id)] = dict(payload)
                self.index_to_id[starting_position + offset] = str(vector_id)
            self._save_records()

    def search(
        self,
        query: str,
        vectors: Sequence[Sequence[float]] | Sequence[float],
        limit: int = 5,
        filters: Optional[dict[str, Any]] = None,
    ) -> list[VectorStoreRecord]:
        """Search Worker-owned vectors and map positions to filtered Mem0 payloads."""

        del query
        if not self._index_path.is_file():
            return []
        matrix = self._normalize_vector_matrix(vectors)
        with self._lock:
            self._load_records()
            fetch_count = max(limit, limit * 10 if filters else limit)
            result = self._client.persistent_search_sync(
                self._index_path,
                matrix,
                top_k=fetch_count,
                normalize_l2=self._should_normalize_l2(),
            )
            records: list[VectorStoreRecord] = []
            for match in result.get("results", []):
                if not isinstance(match, dict):
                    continue
                vector_id = self.index_to_id.get(int(match.get("position", -1)))
                payload = self.docstore.get(vector_id or "")
                if vector_id is None or payload is None or not self._apply_filters(payload, filters):
                    continue
                records.append(
                    VectorStoreRecord(
                        id=vector_id,
                        score=float(match.get("score", 0.0)),
                        payload=dict(payload),
                    )
                )
                if len(records) >= limit:
                    break
            return records

    def delete(self, vector_id: str) -> None:
        """Delete one Worker row and shift all later positional mappings."""

        with self._lock:
            self._load_records()
            position = self._position_for_id(vector_id)
            if position is None:
                return
            inspection = self._client.persistent_inspect_sync(self._index_path)
            self._client.persistent_delete_position_sync(
                self._index_path,
                position,
                expected_count=int(inspection.get("itemCount", 0)),
            )
            self.docstore.pop(vector_id, None)
            shifted: dict[int, str] = {}
            for current_position, current_id in self.index_to_id.items():
                if current_position == position:
                    continue
                shifted[current_position - 1 if current_position > position else current_position] = current_id
            self.index_to_id = shifted
            self._save_records()

    def update(
        self,
        vector_id: str,
        vector: Optional[Sequence[float]] = None,
        payload: Optional[dict[str, Any]] = None,
    ) -> None:
        """Update metadata in place or replace a vector by delete-and-append."""

        with self._lock:
            self._load_records()
            if vector_id not in self.docstore:
                raise ValueError(f"Vector {vector_id} was not found.")
            resolved_payload = dict(payload) if payload is not None else dict(self.docstore[vector_id])
            if vector is None:
                self.docstore[vector_id] = resolved_payload
                self._save_records()
                return
            self.delete(vector_id)
            self.insert([list(vector)], [resolved_payload], [vector_id])

    def get(self, vector_id: str) -> VectorStoreRecord | None:
        """Return one metadata record without starting Vector Worker."""

        with self._lock:
            self._load_records()
            payload = self.docstore.get(vector_id)
            if payload is None:
                return None
            return VectorStoreRecord(id=vector_id, score=None, payload=dict(payload))

    def list_cols(self) -> list[str]:
        """Return the current collection name when metadata or an index exists."""

        if self._index_path.exists() or self._records_path.exists() or self._legacy_path.exists():
            return [self.collection_name]
        return []

    def delete_col(self) -> None:
        """Delete Worker index and both current and legacy metadata files."""

        with self._lock:
            if self._index_path.is_file() and self._client.configured:
                self._client.persistent_delete_sync(self._index_path)
            else:
                self._index_path.unlink(missing_ok=True)
            self._records_path.unlink(missing_ok=True)
            self._legacy_path.unlink(missing_ok=True)
            self.docstore = {}
            self.index_to_id = {}

    def col_info(self) -> dict[str, Any]:
        """Return collection count, dimension, and distance from Worker metadata."""

        if not self._index_path.is_file():
            return {"name": self.collection_name, "count": 0}
        inspection = self._client.persistent_inspect_sync(self._index_path)
        return {
            "name": self.collection_name,
            "count": int(inspection.get("itemCount", 0)),
            "dimension": int(inspection.get("dimension", self.embedding_model_dims)),
            "distance": inspection.get("distance", self.distance_strategy),
        }

    def list(
        self,
        filters: Optional[dict[str, Any]] = None,
        limit: Optional[int] = 100,
    ) -> list[list[VectorStoreRecord]]:
        """List metadata records in insertion order using Mem0's nested-list contract."""

        with self._lock:
            self._load_records()
            maximum = max(0, int(limit if limit is not None else len(self.docstore)))
            if maximum == 0:
                return [[]]
            records: list[VectorStoreRecord] = []
            for vector_id, payload in self.docstore.items():
                if not self._apply_filters(payload, filters):
                    continue
                records.append(VectorStoreRecord(id=vector_id, score=None, payload=dict(payload)))
                if len(records) >= maximum:
                    break
            return [records]

    def reset(self) -> None:
        """Delete all collection state while keeping the Store object reusable."""

        self.delete_col()

    def export_records(self) -> dict[str, dict[str, Any]]:
        """Return a defensive insertion-ordered copy for memory-management routes."""

        with self._lock:
            self._load_records()
            return {vector_id: dict(payload) for vector_id, payload in self.docstore.items()}

    def _load_records(self) -> None:
        """Load safe JSON metadata or migrate one legacy Mem0 pickle."""

        if self._records_path.is_file():
            value = json.loads(self._records_path.read_text(encoding="utf-8"))
            if not isinstance(value, dict) or value.get("schema") != RECORDS_SCHEMA:
                raise ValueError(f"Invalid vector metadata schema: {self._records_path}")
            records = value.get("records")
            positions = value.get("positions")
            if not isinstance(records, dict) or not isinstance(positions, dict):
                raise ValueError(f"Invalid vector metadata content: {self._records_path}")
            self.docstore = {
                str(vector_id): dict(payload)
                for vector_id, payload in records.items()
                if isinstance(payload, dict)
            }
            self.index_to_id = {
                int(position): str(vector_id)
                for position, vector_id in positions.items()
            }
            return
        if self._legacy_path.is_file():
            with self._legacy_path.open("rb") as legacy_file:
                value = RestrictedMemoryUnpickler(legacy_file).load()
            if not isinstance(value, tuple) or len(value) != 2:
                raise ValueError(f"Invalid legacy Mem0 metadata: {self._legacy_path}")
            records, positions = value
            if not isinstance(records, dict) or not isinstance(positions, dict):
                raise ValueError(f"Invalid legacy Mem0 metadata content: {self._legacy_path}")
            self.docstore = {
                str(vector_id): dict(payload)
                for vector_id, payload in records.items()
                if isinstance(payload, dict)
            }
            self.index_to_id = {
                int(position): str(vector_id)
                for position, vector_id in positions.items()
            }
            self._save_records()
            return
        self.docstore = {}
        self.index_to_id = {}

    def _save_records(self) -> None:
        """Atomically persist safe UTF-8 JSON metadata beside the FAISS index."""

        self._records_path.parent.mkdir(parents=True, exist_ok=True)
        temporary_path = self._records_path.with_name(
            f".{self._records_path.name}.{uuid4().hex}.tmp"
        )
        value = {
            "schema": RECORDS_SCHEMA,
            "records": self.docstore,
            "positions": {str(position): vector_id for position, vector_id in self.index_to_id.items()},
        }
        try:
            temporary_path.write_text(
                json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n",
                encoding="utf-8",
            )
            temporary_path.chmod(0o600)
            os.replace(temporary_path, self._records_path)
        finally:
            temporary_path.unlink(missing_ok=True)

    def _normalize_vector_matrix(
        self,
        vectors: Sequence[Sequence[float]] | Sequence[float],
    ) -> list[list[float]]:
        """Normalize Mem0's flat query-vector form to one matrix row."""

        if not vectors:
            raise ValueError("Search vectors cannot be empty.")
        first_value = vectors[0]
        if isinstance(first_value, (int, float)):
            return [[float(value) for value in vectors]]  # type: ignore[arg-type]
        return [[float(value) for value in row] for row in vectors]  # type: ignore[union-attr]

    def _position_for_id(self, vector_id: str) -> int | None:
        """Resolve one vector identifier to its current persistent row position."""

        for position, current_id in self.index_to_id.items():
            if current_id == vector_id:
                return position
        return None

    def _should_normalize_l2(self) -> bool:
        """Match Mem0 FAISS normalization semantics for Euclidean indexes only."""

        return self.normalize_L2 and self.distance_strategy.strip().lower() == "euclidean"

    def _apply_filters(
        self,
        payload: dict[str, Any],
        filters: Optional[dict[str, Any]],
    ) -> bool:
        """Apply Mem0 equality and membership filters to one payload."""

        if not filters:
            return True
        for key, expected in filters.items():
            if key not in payload:
                return False
            if isinstance(expected, list):
                if payload[key] not in expected:
                    return False
            elif payload[key] != expected:
                return False
        return True
