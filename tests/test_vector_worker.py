# -*- coding: utf-8 -*-
"""Tests for Vector Worker artifacts, adapters, and lazy dependency behavior."""

from __future__ import annotations

import asyncio
from array import array
from collections.abc import Mapping, Sequence
import json
from pathlib import Path
import pickle
import sys
import tempfile
import unittest
from typing import Any

from py.kernel.vector_index import VectorIndex
from py.memory.vector_worker_store import (
    VectorWorkerStore,
    register_mem0_vector_worker_store,
)
from py.vector_worker_client import VectorWorkerClient
from py.workers.persistent_vector_engine import PersistentVectorEngine
from py.workers.vector_engine import VectorEngine
from py.workers.vector_worker import VectorWorkerHandlers


class FakeVectorEngine:
    """Small deterministic engine double for handler contract tests."""

    def __init__(self) -> None:
        """Create an empty fake index and observable release state."""

        self.items: list[dict[str, str]] = []
        self.released = False

    def get_status(self) -> dict[str, Any]:
        """Return a ready lightweight status payload."""

        return {
            "dependencyAvailable": True,
            "modelAvailable": True,
            "loaded": False,
            "indexReady": bool(self.items),
            "dimension": 2,
            "itemCount": len(self.items),
        }

    def embed(self, texts: Sequence[str]) -> dict[str, Any]:
        """Return deterministic two-dimensional vectors for a text batch."""

        vectors = [[float(len(text)), 1.0] for text in texts]
        return {
            "embeddings": vectors,
            "dimension": 2,
            "count": len(vectors),
            "promptTokens": sum(len(text) for text in texts),
            "inferenceTimeMs": 1,
        }

    def rebuild(self, items: Sequence[dict[str, str]]) -> dict[str, Any]:
        """Replace the fake index and report its item count."""

        self.items = [dict(item) for item in items]
        return {"ready": True, "dimension": 2, "itemCount": len(self.items)}

    def add(self, item_id: str, text: str) -> dict[str, Any]:
        """Append one fake index item."""

        self.items.append({"id": item_id, "text": text})
        return {"added": True, "indexReady": True, "itemCount": len(self.items)}

    def search(self, _query: str, top_k: int) -> dict[str, Any]:
        """Return deterministic fake search results."""

        results = [
            {"id": item["id"], "score": 1.0 - (index * 0.1)}
            for index, item in enumerate(self.items[:top_k])
        ]
        return {"results": results, "indexReady": bool(self.items), "itemCount": len(self.items)}

    def release(self) -> dict[str, Any]:
        """Clear the fake index and record release."""

        self.items = []
        self.released = True
        return {"released": True}


class RecordingBatchPredictor:
    """Predictor double that records bounded engine batch sizes."""

    def __init__(self) -> None:
        """Create an empty batch-size trace."""

        self.batch_sizes: list[int] = []

    def predict(self, texts: Sequence[str]) -> Any:
        """Return a two-column NumPy matrix and record the requested batch size."""

        import numpy as numpy_module

        self.batch_sizes.append(len(texts))
        return numpy_module.zeros((len(texts), 2), dtype="float32")


class VectorWorkerHandlerTests(unittest.IsolatedAsyncioTestCase):
    """Validate artifact boundaries and lazy worker operations."""

    async def test_embed_exchanges_vectors_through_artifacts(self) -> None:
        """Keep bulk request and result values outside the Worker protocol payload."""

        with tempfile.TemporaryDirectory(prefix="openxnet-vector-worker-") as directory:
            root = Path(directory)
            exchange_root = root / "exchange"
            exchange_root.mkdir()
            request_path = exchange_root / "request.json"
            result_path = exchange_root / "result.json"
            request_path.write_text(
                json.dumps({"texts": ["alpha", "beta"]}),
                encoding="utf-8",
            )
            result_path.write_text("{}", encoding="utf-8")
            handlers = VectorWorkerHandlers(
                exchange_root,
                root / "models",
                engine=FakeVectorEngine(),  # type: ignore[arg-type]
            )

            response = await handlers.embed(
                {
                    "artifactPath": str(request_path),
                    "resultArtifactPath": str(result_path),
                }
            )
            result = json.loads(result_path.read_text(encoding="utf-8"))

        self.assertEqual(response["count"], 2)
        self.assertEqual(result["embeddings"], [[5.0, 1.0], [4.0, 1.0]])

    async def test_rejects_artifact_outside_exchange_root(self) -> None:
        """Prevent a Worker request from reading arbitrary local JSON files."""

        with tempfile.TemporaryDirectory(prefix="openxnet-vector-worker-") as directory:
            root = Path(directory)
            exchange_root = root / "exchange"
            exchange_root.mkdir()
            outside_path = root / "outside.json"
            outside_path.write_text('{"items": []}', encoding="utf-8")
            handlers = VectorWorkerHandlers(
                exchange_root,
                root / "models",
                engine=FakeVectorEngine(),  # type: ignore[arg-type]
            )

            with self.assertRaisesRegex(ValueError, "outside"):
                await handlers.rebuild({"artifactPath": str(outside_path)})

    async def test_rebuild_add_search_and_release_delegate_to_engine(self) -> None:
        """Preserve the in-memory index lifecycle across Worker methods."""

        with tempfile.TemporaryDirectory(prefix="openxnet-vector-worker-") as directory:
            root = Path(directory)
            exchange_root = root / "exchange"
            exchange_root.mkdir()
            artifact_path = exchange_root / "items.json"
            artifact_path.write_text(
                json.dumps({"items": [{"id": "one", "text": "first"}]}),
                encoding="utf-8",
            )
            engine = FakeVectorEngine()
            handlers = VectorWorkerHandlers(
                exchange_root,
                root / "models",
                engine=engine,  # type: ignore[arg-type]
            )

            rebuilt = await handlers.rebuild({"artifactPath": str(artifact_path)})
            added = await handlers.add({"id": "two", "text": "second"})
            searched = await handlers.search({"query": "first", "topK": 2})
            released = handlers.release({})

        self.assertEqual(rebuilt["itemCount"], 1)
        self.assertEqual(added["itemCount"], 2)
        self.assertEqual([item["id"] for item in searched["results"]], ["one", "two"])
        self.assertTrue(released["released"])
        self.assertTrue(engine.released)

    async def test_status_does_not_import_vector_dependencies(self) -> None:
        """Keep FAISS, ONNX, Tokenizers, and NumPy unloaded during status checks."""

        dependency_names = ("faiss", "numpy", "onnxruntime", "tokenizers")
        before = {name for name in dependency_names if name in sys.modules}
        with tempfile.TemporaryDirectory(prefix="openxnet-vector-status-") as directory:
            engine = VectorEngine(Path(directory) / "models")
            status = engine.get_status()
        after = {name for name in dependency_names if name in sys.modules}

        self.assertEqual(after, before)
        self.assertIn("dependencyAvailable", status)
        self.assertFalse(status["loaded"])

    async def test_engine_bounds_large_inference_batches(self) -> None:
        """Split large index inference into fixed-size predictor calls."""

        with tempfile.TemporaryDirectory(prefix="openxnet-vector-batches-") as directory:
            engine = VectorEngine(Path(directory) / "models")
            predictor = RecordingBatchPredictor()
            matrix = engine._predict_batches_locked(  # type: ignore[arg-type]
                predictor,
                [f"text-{index}" for index in range(257)],
            )

        self.assertEqual(predictor.batch_sizes, [128, 128, 1])
        self.assertEqual(matrix.shape, (257, 2))


class RecordingVectorWorkerClient(VectorWorkerClient):
    """Client double that records live artifact paths instead of opening HTTP."""

    def __init__(self, exchange_root: Path) -> None:
        """Create a configured client bound to a temporary exchange root."""

        super().__init__("http://127.0.0.1:1", "token", exchange_root)
        self.request_path: Path | None = None
        self.result_path: Path | None = None

    def _request_sync(self, method: str, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Read the request artifact and write a deterministic result artifact."""

        if method != "vector.embed":
            raise AssertionError(f"Unexpected method: {method}")
        self.request_path = Path(str(payload["artifactPath"]))
        self.result_path = Path(str(payload["resultArtifactPath"]))
        request_value = json.loads(self.request_path.read_text(encoding="utf-8"))
        texts = request_value["texts"]
        result = {
            "embeddings": [[1.0, 0.0] for _text in texts],
            "dimension": 2,
            "count": len(texts),
            "promptTokens": len(texts),
            "inferenceTimeMs": 1,
        }
        self.result_path.write_text(json.dumps(result), encoding="utf-8")
        return {"count": len(texts), "dimension": 2}


class VectorWorkerClientTests(unittest.IsolatedAsyncioTestCase):
    """Validate legacy adapter artifact lifetime and response checks."""

    async def test_embed_removes_request_and_result_artifacts(self) -> None:
        """Delete both private artifacts after a successful embedding request."""

        with tempfile.TemporaryDirectory(prefix="openxnet-vector-client-") as directory:
            client = RecordingVectorWorkerClient(Path(directory))
            result = await client.embed(["hello"])
            request_path = client.request_path
            result_path = client.result_path
            self.assertIsNotNone(request_path)
            self.assertIsNotNone(result_path)
            self.assertFalse(request_path.exists())
            self.assertFalse(result_path.exists())

        self.assertEqual(result["embeddings"], [[1.0, 0.0]])


class RestartingVectorClient:
    """Kernel client double that simulates an idle Worker losing its index."""

    def __init__(self) -> None:
        """Create a configured fake with no active index."""

        self.configured = True
        self.items: list[dict[str, str]] = []
        self.index_ready = False
        self.rebuild_count = 0

    async def status(self) -> Mapping[str, Any]:
        """Report dependencies and model assets as available."""

        return {"dependencyAvailable": True, "modelAvailable": True, "dimension": 2}

    async def rebuild(self, items: Sequence[Mapping[str, str]]) -> Mapping[str, Any]:
        """Restore the fake index from cached adapter items."""

        self.items = [dict(item) for item in items]
        self.index_ready = True
        self.rebuild_count += 1
        return {"ready": True, "dimension": 2, "itemCount": len(self.items)}

    async def add(self, item_id: str, text: str) -> Mapping[str, Any]:
        """Append one fake item only when the index exists."""

        if not self.index_ready:
            return {"added": False, "indexReady": False, "itemCount": 0}
        self.items.append({"id": item_id, "text": text})
        return {"added": True, "indexReady": True, "itemCount": len(self.items)}

    async def search(self, _query: str, _top_k: int = 5) -> Mapping[str, Any]:
        """Return an empty-index signal or one deterministic match."""

        if not self.index_ready:
            return {"results": [], "indexReady": False, "itemCount": 0}
        return {
            "results": [{"id": self.items[0]["id"], "score": 0.9}],
            "indexReady": True,
            "itemCount": len(self.items),
        }


class BlockingVectorClient(RestartingVectorClient):
    """Client double that pauses the first rebuild to expose concurrent additions."""

    def __init__(self) -> None:
        """Create synchronization events around the inherited fake rebuild."""

        super().__init__()
        self.rebuild_started = asyncio.Event()
        self.continue_rebuild = asyncio.Event()

    async def rebuild(self, items: Sequence[Mapping[str, str]]) -> Mapping[str, Any]:
        """Pause before committing the initial fake index rebuild."""

        self.rebuild_started.set()
        await self.continue_rebuild.wait()
        return await super().rebuild(items)


class TestKnowledge:
    """Minimal symbol knowledge value for serialization tests."""

    entities = ["entity"]


class TestSymbol:
    """Minimal legacy symbol value for serialization tests."""

    id = "symbol-1"
    label = "Symbol"
    K = TestKnowledge()


class VectorIndexAdapterTests(unittest.IsolatedAsyncioTestCase):
    """Validate Kernel compatibility and idle-restart recovery."""

    async def test_search_rebuilds_index_after_worker_restart(self) -> None:
        """Use the cached symbol texts when a restarted Worker reports no index."""

        client = RestartingVectorClient()
        index = VectorIndex(client)  # type: ignore[arg-type]
        built = await index.build_from_store([TestSymbol()])
        client.index_ready = False
        client.items = []

        results = await index.search("symbol", top_k=1)

        self.assertEqual(built, 1)
        self.assertEqual(results, [("symbol-1", 0.9)])
        self.assertEqual(client.rebuild_count, 2)

    async def test_background_build_flushes_concurrent_symbol_addition(self) -> None:
        """Append a symbol learned while the first Worker rebuild is in flight."""

        client = BlockingVectorClient()
        index = VectorIndex(client)  # type: ignore[arg-type]
        index.schedule_build_from_store([TestSymbol()])
        await client.rebuild_started.wait()

        await index.add_item("symbol-2", "Second entity")
        client.continue_rebuild.set()
        if index._build_task is not None:
            await index._build_task

        self.assertEqual([item["id"] for item in client.items], ["symbol-1", "symbol-2"])
        self.assertEqual(index.item_count, 2)


class PersistentVectorEngineTests(unittest.TestCase):
    """Validate real persistent FAISS file operations and atomic replacement."""

    def test_build_search_delete_and_inspect(self) -> None:
        """Preserve positional search semantics across one row deletion."""

        with tempfile.TemporaryDirectory(prefix="openxnet-persistent-vector-") as directory:
            index_path = Path(directory) / "index.faiss"
            engine = PersistentVectorEngine()
            built = engine.build(
                index_path,
                [[1.0, 0.0], [0.0, 1.0], [2.0, 2.0]],
                distance="euclidean",
            )
            searched = engine.search(index_path, [[1.0, 0.0]], top_k=2)
            deleted = engine.delete_position(index_path, 1, expected_count=3)
            inspected = engine.inspect(index_path)

        self.assertEqual(built["itemCount"], 3)
        self.assertEqual(searched["results"][0]["position"], 0)
        self.assertAlmostEqual(searched["results"][0]["score"], 0.0)
        self.assertEqual(deleted["itemCount"], 2)
        self.assertEqual(inspected["itemCount"], 2)


class RecordingPersistentEngine:
    """Persistent engine double used to inspect Worker handler matrices."""

    def __init__(self) -> None:
        """Create an empty operation trace."""

        self.last_path: Path | None = None
        self.last_vectors: Any = None

    def build(
        self,
        index_path: Path,
        vectors: Any,
        *,
        distance: str,
        normalize_l2: bool,
    ) -> Mapping[str, Any]:
        """Record one build matrix and return deterministic metadata."""

        del distance, normalize_l2
        self.last_path = index_path
        self.last_vectors = vectors.copy()
        return {"itemCount": int(vectors.shape[0]), "dimension": int(vectors.shape[1])}


class PersistentVectorHandlerTests(unittest.IsolatedAsyncioTestCase):
    """Validate binary artifacts and persistent storage path restrictions."""

    async def test_store_build_reads_exact_float32_artifact(self) -> None:
        """Decode little-endian float32 rows without carrying them in NDJSON."""

        with tempfile.TemporaryDirectory(prefix="openxnet-vector-handler-") as directory:
            root = Path(directory)
            exchange_root = root / "exchange"
            storage_root = root / "storage"
            exchange_root.mkdir()
            storage_root.mkdir()
            artifact_path = exchange_root / "vectors.f32"
            values = array("f", [1.0, 2.0, 3.0, 4.0])
            if sys.byteorder != "little":
                values.byteswap()
            with artifact_path.open("wb") as artifact_file:
                values.tofile(artifact_file)
            persistent_engine = RecordingPersistentEngine()
            handlers = VectorWorkerHandlers(
                exchange_root,
                root / "models",
                engine=FakeVectorEngine(),  # type: ignore[arg-type]
                persistent_engine=persistent_engine,  # type: ignore[arg-type]
                storage_root=storage_root,
            )

            result = await handlers.store_build(
                {
                    "indexPath": str(storage_root / "index.faiss"),
                    "artifactPath": str(artifact_path),
                    "vectorCount": 2,
                    "dimension": 2,
                    "distance": "euclidean",
                    "normalizeL2": False,
                }
            )

        self.assertEqual(result["itemCount"], 2)
        self.assertEqual(persistent_engine.last_vectors.tolist(), [[1.0, 2.0], [3.0, 4.0]])

    async def test_store_build_rejects_index_outside_storage_root(self) -> None:
        """Prevent persistent operations from targeting arbitrary filesystem paths."""

        with tempfile.TemporaryDirectory(prefix="openxnet-vector-handler-") as directory:
            root = Path(directory)
            exchange_root = root / "exchange"
            storage_root = root / "storage"
            exchange_root.mkdir()
            storage_root.mkdir()
            handlers = VectorWorkerHandlers(
                exchange_root,
                root / "models",
                engine=FakeVectorEngine(),  # type: ignore[arg-type]
                persistent_engine=RecordingPersistentEngine(),  # type: ignore[arg-type]
                storage_root=storage_root,
            )

            with self.assertRaisesRegex(ValueError, "outside"):
                await handlers.store_inspect({"indexPath": str(root / "outside.faiss")})


class RecordingPersistentVectorClient(VectorWorkerClient):
    """Vector client double that records binary artifact lifetime and dimensions."""

    def __init__(self, exchange_root: Path) -> None:
        """Create a configured recording client."""

        super().__init__("http://127.0.0.1:1", "token", exchange_root)
        self.artifact_path: Path | None = None
        self.artifact_bytes = b""

    def _request_sync(self, method: str, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Capture a live vector artifact and return deterministic build metadata."""

        if method != "vector.store.build":
            raise AssertionError(f"Unexpected method: {method}")
        self.artifact_path = Path(str(payload["artifactPath"]))
        self.artifact_bytes = self.artifact_path.read_bytes()
        return {
            "itemCount": int(payload["vectorCount"]),
            "dimension": int(payload["dimension"]),
        }


class PersistentVectorClientTests(unittest.TestCase):
    """Validate float32 client artifacts and cleanup after synchronous RPC."""

    def test_persistent_build_removes_binary_artifact(self) -> None:
        """Delete the private float32 artifact after a successful request."""

        with tempfile.TemporaryDirectory(prefix="openxnet-vector-client-") as directory:
            client = RecordingPersistentVectorClient(Path(directory))
            result = client.persistent_build_sync(
                Path(directory) / "index.faiss",
                [[1.0, 2.0], [3.0, 4.0]],
            )
            artifact_path = client.artifact_path

        self.assertEqual(result["dimension"], 2)
        self.assertEqual(len(client.artifact_bytes), 16)
        self.assertIsNotNone(artifact_path)
        self.assertFalse(artifact_path.exists())


class FakePersistentWorkerClient:
    """In-memory client double for Mem0 Store metadata and position tests."""

    def __init__(self) -> None:
        """Create an empty mapping of index paths to vectors."""

        self.configured = True
        self.indexes: dict[str, list[list[float]]] = {}

    def persistent_append_sync(
        self,
        index_path: Path,
        vectors: Sequence[Sequence[float]],
        *,
        distance: str,
        normalize_l2: bool,
    ) -> Mapping[str, Any]:
        """Append vectors to one in-memory index."""

        del distance, normalize_l2
        rows = self.indexes.setdefault(str(index_path), [])
        rows.extend([list(row) for row in vectors])
        return {"itemCount": len(rows), "dimension": len(rows[0])}

    def persistent_search_sync(
        self,
        index_path: Path,
        vectors: Sequence[Sequence[float]],
        *,
        top_k: int,
        normalize_l2: bool,
    ) -> Mapping[str, Any]:
        """Return squared-L2-ranked in-memory vector positions."""

        del normalize_l2
        query = list(vectors[0])
        rows = self.indexes.get(str(index_path), [])
        ranked = sorted(
            enumerate(rows),
            key=lambda item: sum((left - right) ** 2 for left, right in zip(query, item[1])),
        )[:top_k]
        return {
            "itemCount": len(rows),
            "results": [
                {
                    "position": position,
                    "score": sum((left - right) ** 2 for left, right in zip(query, row)),
                }
                for position, row in ranked
            ],
        }

    def persistent_inspect_sync(self, index_path: Path) -> Mapping[str, Any]:
        """Return in-memory index count and dimension."""

        rows = self.indexes.get(str(index_path), [])
        return {"itemCount": len(rows), "dimension": len(rows[0]) if rows else 0}

    def persistent_delete_position_sync(
        self,
        index_path: Path,
        position: int,
        *,
        expected_count: int | None,
    ) -> Mapping[str, Any]:
        """Delete one in-memory vector after validating its expected count."""

        rows = self.indexes.get(str(index_path), [])
        if expected_count is not None and len(rows) != expected_count:
            raise ValueError("count mismatch")
        del rows[position]
        return {"deleted": True, "itemCount": len(rows)}

    def persistent_delete_sync(self, index_path: Path) -> Mapping[str, Any]:
        """Delete one in-memory index."""

        existed = self.indexes.pop(str(index_path), None) is not None
        return {"deleted": existed}


class VectorWorkerStoreTests(unittest.TestCase):
    """Validate Mem0 compatibility, persistence, filtering, and legacy migration."""

    def test_store_round_trip_update_filter_and_delete(self) -> None:
        """Keep safe metadata aligned with Worker positional vectors."""

        with tempfile.TemporaryDirectory(prefix="openxnet-memory-store-") as directory:
            client = FakePersistentWorkerClient()
            store = VectorWorkerStore(
                "agent-party",
                directory,
                embedding_model_dims=2,
                client=client,  # type: ignore[arg-type]
            )
            index_path = Path(directory) / "agent-party.faiss"
            index_path.touch()
            store.insert(
                [[1.0, 0.0], [0.0, 1.0]],
                [{"data": "first", "user_id": "u1"}, {"data": "second", "user_id": "u2"}],
                ["one", "two"],
            )
            matches = store.search("", [1.0, 0.0], limit=2, filters={"user_id": "u1"})
            store.update("one", payload={"data": "updated", "user_id": "u1"})
            store.delete("two")
            restored = VectorWorkerStore(
                "agent-party",
                directory,
                embedding_model_dims=2,
                client=client,  # type: ignore[arg-type]
            )
            restored_one = restored.get("one")
            restored_two = restored.get("two")
            restored_count = restored.col_info()["count"]

        self.assertEqual([record.id for record in matches], ["one"])
        self.assertIsNotNone(restored_one)
        self.assertEqual(restored_one.payload["data"], "updated")
        self.assertIsNone(restored_two)
        self.assertEqual(restored_count, 1)

    def test_store_migrates_legacy_mem0_pickle_to_json(self) -> None:
        """Read legacy primitive metadata with a restricted unpickler once."""

        with tempfile.TemporaryDirectory(prefix="openxnet-memory-migration-") as directory:
            root = Path(directory)
            legacy_path = root / "agent-party.pkl"
            with legacy_path.open("wb") as legacy_file:
                pickle.dump(({"memory": {"data": "legacy"}}, {0: "memory"}), legacy_file)
            store = VectorWorkerStore(
                "agent-party",
                directory,
                client=FakePersistentWorkerClient(),  # type: ignore[arg-type]
            )

            records = store.export_records()
            migrated_path = root / "agent-party.records.json"
            migrated = migrated_path.is_file()

        self.assertEqual(records["memory"]["data"], "legacy")
        self.assertTrue(migrated)

    def test_store_rejects_explicit_empty_identifiers_and_payloads(self) -> None:
        """Distinguish omitted optional values from invalid explicit empty sequences."""

        with tempfile.TemporaryDirectory(prefix="openxnet-memory-validation-") as directory:
            store = VectorWorkerStore(
                "agent-party",
                directory,
                embedding_model_dims=2,
                client=FakePersistentWorkerClient(),  # type: ignore[arg-type]
            )

            with self.assertRaisesRegex(ValueError, "same length"):
                store.insert([[1.0, 0.0]], payloads=[], ids=["one"])
            with self.assertRaisesRegex(ValueError, "same length"):
                store.insert([[1.0, 0.0]], payloads=[{}], ids=[])

    def test_store_normalizes_only_euclidean_distance(self) -> None:
        """Preserve Mem0's normalize_L2 behavior for non-Euclidean indexes."""

        with tempfile.TemporaryDirectory(prefix="openxnet-memory-normalize-") as directory:
            store = VectorWorkerStore(
                "agent-party",
                directory,
                distance_strategy="inner_product",
                normalize_L2=True,
                embedding_model_dims=2,
                client=FakePersistentWorkerClient(),  # type: ignore[arg-type]
            )

            self.assertFalse(store._should_normalize_l2())

    def test_register_redirects_mem0_faiss_factory(self) -> None:
        """Keep Mem0 config validation while replacing the runtime provider class."""

        try:
            from mem0.utils.factory import VectorStoreFactory
        except ImportError:
            self.skipTest("Mem0 is not installed in the test interpreter.")

        original = VectorStoreFactory.provider_to_class["faiss"]
        try:
            register_mem0_vector_worker_store()
            self.assertEqual(
                VectorStoreFactory.provider_to_class["faiss"],
                "py.memory.vector_worker_store.VectorWorkerStore",
            )
        finally:
            VectorStoreFactory.provider_to_class["faiss"] = original


class KnowledgeBaseVectorMigrationTests(unittest.TestCase):
    """Validate safe knowledge-base metadata migration and rank fusion."""

    def test_bm25_metadata_migrates_to_safe_vector_documents(self) -> None:
        """Use existing positional BM25 metadata when a legacy index has no safe JSON."""

        from py.knowledge_base_store import load_vector_document_records

        with tempfile.TemporaryDirectory(prefix="openxnet-kb-migration-") as directory:
            root = Path(directory)
            (root / "bm25_index.json").write_text(
                json.dumps(
                    {
                        "docs": [
                            {"page_content": "first", "metadata": {"file_name": "one.txt"}},
                            {"page_content": "second", "metadata": {"file_name": "two.txt"}},
                        ]
                    }
                ),
                encoding="utf-8",
            )
            documents = load_vector_document_records(root)
            migrated = json.loads((root / "index.docs.json").read_text(encoding="utf-8"))

        self.assertEqual([document["page_content"] for document in documents], ["first", "second"])
        self.assertEqual(migrated["schema"], "openxnet.knowledge-base.documents.v1")

    def test_restricted_langchain_pickle_migration(self) -> None:
        """Allow only known LangChain document classes in legacy index metadata."""

        try:
            from langchain_community.docstore.in_memory import InMemoryDocstore
            from langchain_core.documents import Document
            from py.knowledge_base_store import load_legacy_langchain_documents
        except ImportError:
            self.skipTest("LangChain knowledge-base dependencies are unavailable.")
        with tempfile.TemporaryDirectory(prefix="openxnet-kb-pickle-") as directory:
            metadata_path = Path(directory) / "index.pkl"
            docstore = InMemoryDocstore(
                {"document-id": Document(page_content="legacy", metadata={"source": "old"})}
            )
            with metadata_path.open("wb") as target:
                pickle.dump((docstore, {0: "document-id"}), target)
            documents = load_legacy_langchain_documents(metadata_path)

        self.assertEqual(documents, [{"page_content": "legacy", "metadata": {"source": "old"}}])

    def test_weighted_rank_fusion_is_deterministic(self) -> None:
        """Combine BM25 and vector rankings without LangChain EnsembleRetriever."""

        from py.knowledge_base_store import weighted_reciprocal_rank_fusion

        first = {"page_content": "first", "metadata": {}}
        second = {"page_content": "second", "metadata": {}}

        fused = weighted_reciprocal_rank_fusion(
            [[first, second], [second, first]],
            [0.25, 0.75],
            2,
        )

        self.assertEqual([document["page_content"] for document in fused], ["second", "first"])

    def test_dependency_free_bm25_ranks_rare_term_frequency(self) -> None:
        """Rank BM25 records without importing rank-bm25 or NumPy."""

        from py.knowledge_base_store import rank_bm25_documents

        documents = [
            {"page_content": "rare rare alpha", "metadata": {"id": "first"}},
            {"page_content": "rare beta", "metadata": {"id": "second"}},
            {"page_content": "alpha beta", "metadata": {"id": "third"}},
            {"page_content": "gamma delta", "metadata": {"id": "fourth"}},
            {"page_content": "epsilon zeta", "metadata": {"id": "fifth"}},
        ]

        ranked = rank_bm25_documents("rare", documents, 2)

        self.assertEqual(
            [document["metadata"]["id"] for document in ranked],
            ["first", "second"],
        )


if __name__ == "__main__":
    unittest.main()
