# -*- coding: utf-8 -*-
"""Tests for Memory Worker validation, caching, and legacy client behavior."""

from __future__ import annotations

from collections.abc import Mapping
import json
from pathlib import Path
import sys
import tempfile
import unittest
from typing import Any

from py.memory_worker_client import MemoryWorkerClient
from py.vector_worker_client import VectorWorkerClient
from py.workers.memory_worker import MemoryWorkerHandlers, RecallWorkerHandlers


class FakeMemory:
    """Small Mem0 double recording search and add calls."""

    def __init__(self) -> None:
        """Create empty search and add traces."""

        self.search_calls: list[dict[str, Any]] = []
        self.add_calls: list[dict[str, Any]] = []

    def search(self, **options: Any) -> list[dict[str, Any]]:
        """Record search options and return one deterministic memory."""

        self.search_calls.append(options)
        return [{"memory": "remembered"}]

    def add(self, messages: Any, **options: Any) -> dict[str, Any]:
        """Record messages and options and return one deterministic result."""

        self.add_calls.append({"messages": messages, **options})
        return {"status": "added"}


class RecordingMemoryFactory:
    """Callable factory exposing created Mem0 configurations and instances."""

    def __init__(self) -> None:
        """Create empty configuration and instance traces."""

        self.configurations: list[Mapping[str, Any]] = []
        self.instances: list[FakeMemory] = []

    def __call__(self, configuration: Mapping[str, Any]) -> FakeMemory:
        """Record one configuration and return a new fake memory."""

        instance = FakeMemory()
        self.configurations.append(configuration)
        self.instances.append(instance)
        return instance


def create_configuration(memory_id: str = "memory-one") -> dict[str, Any]:
    """Create one valid narrow Memory Worker configuration."""

    return {
        "memoryId": memory_id,
        "embedder": {
            "model": "embed-model",
            "apiKey": "embed-secret",
            "baseUrl": "https://embed.example/v1",
            "dimensions": 1024,
        },
        "llm": {
            "model": "chat-model",
            "apiKey": "chat-secret",
            "baseUrl": "https://chat.example/v1",
        },
    }


class MemoryWorkerHandlerTests(unittest.IsolatedAsyncioTestCase):
    """Validate Memory Worker boundaries and lazy dependency behavior."""

    async def test_search_and_add_reuse_one_memory_instance(self) -> None:
        """Cache a matching configuration and preserve Mem0 call contracts."""

        factory = RecordingMemoryFactory()
        with tempfile.TemporaryDirectory(prefix="openxnet-memory-worker-") as directory:
            handlers = MemoryWorkerHandlers(
                Path(directory),
                memory_factory=factory,
                vector_client=VectorWorkerClient("http://127.0.0.1:1", "token", Path(directory)),
            )
            configuration = create_configuration()
            searched = await handlers.search(
                {
                    "configuration": configuration,
                    "query": "what happened",
                    "userId": "user-one",
                    "limit": 3,
                }
            )
            added = await handlers.add(
                {
                    "configuration": configuration,
                    "messages": "new memory",
                    "userId": "user-one",
                    "metadata": {"timestamp": "now"},
                    "infer": False,
                }
            )

        self.assertEqual(searched["results"], [{"memory": "remembered"}])
        self.assertEqual(added["result"], {"status": "added"})
        self.assertEqual(len(factory.instances), 1)
        self.assertEqual(factory.instances[0].search_calls[0]["limit"], 3)
        self.assertFalse(factory.instances[0].add_calls[0]["infer"])
        self.assertEqual(
            Path(str(factory.configurations[0]["history_db_path"])).resolve(),
            (Path(directory) / "memory_cache" / "memory-one" / "history.db").resolve(),
        )

    async def test_rejects_memory_id_outside_fixed_storage_root(self) -> None:
        """Prevent a request from selecting an arbitrary persistence directory."""

        with tempfile.TemporaryDirectory(prefix="openxnet-memory-worker-") as directory:
            handlers = MemoryWorkerHandlers(
                Path(directory),
                memory_factory=RecordingMemoryFactory(),
            )
            with self.assertRaisesRegex(ValueError, "outside"):
                await handlers.search(
                    {
                        "configuration": create_configuration("..\\outside"),
                        "query": "query",
                        "userId": "user-one",
                        "limit": 5,
                    }
                )

    async def test_status_does_not_import_mem0_or_numpy(self) -> None:
        """Keep Mem0, Qdrant, and NumPy unloaded during lightweight readiness checks."""

        dependency_names = ("mem0", "qdrant_client", "numpy")
        before = {name for name in dependency_names if name in sys.modules}
        with tempfile.TemporaryDirectory(prefix="openxnet-memory-status-") as directory:
            handlers = MemoryWorkerHandlers(Path(directory))
            status = handlers.status({})
        after = {name for name in dependency_names if name in sys.modules}

        self.assertEqual(after, before)
        self.assertIn("dependencyAvailable", status)
        self.assertEqual(status["loadedInstances"], 0)

    async def test_collection_management_uses_stable_record_ids(self) -> None:
        """通过稳定 ID 列出、更新、删除记录并清理集合，向量删除只委托受控 Client。"""

        class FakeVectorClient:
            """记录持久向量删除调用的最小测试替身。"""

            configured = True

            def __init__(self) -> None:
                """创建空调用轨迹；无输入，无副作用。"""

                self.deleted_positions: list[int] = []
                self.deleted_collections = 0

            def persistent_inspect_sync(self, _path: Path) -> dict[str, Any]:
                """返回两条向量的固定检查结果；输入路径，输出计数。"""

                return {"itemCount": 2}

            def persistent_delete_position_sync(
                self,
                _path: Path,
                position: int,
                *,
                expected_count: int,
            ) -> dict[str, Any]:
                """记录位置删除；输入路径、位置和计数，输出剩余计数。"""

                self.deleted_positions.append(position)
                return {"itemCount": expected_count - 1}

            def persistent_delete_sync(self, _path: Path) -> dict[str, Any]:
                """记录集合删除；输入路径，输出固定成功结果。"""

                self.deleted_collections += 1
                return {"deleted": True}

        with tempfile.TemporaryDirectory(prefix="openxnet-memory-management-worker-") as directory:
            memory_path = Path(directory) / "memory_cache" / "memory-one"
            memory_path.mkdir(parents=True)
            (memory_path / "agent-party.faiss").write_bytes(b"index")
            (memory_path / "agent-party.records.json").write_text(
                json.dumps(
                    {
                        "schema": "openxnet.vector-records.v1",
                        "records": {
                            "record-one": {"data": "first", "created_at": "c1", "timetamp": "u1"},
                            "record-two": {"data": "second", "created_at": "c2", "timetamp": "u2"},
                        },
                        "positions": {"0": "record-one", "1": "record-two"},
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )
            vector_client = FakeVectorClient()
            handlers = MemoryWorkerHandlers(
                Path(directory),
                vector_client=vector_client,  # type: ignore[arg-type]
            )

            listed = await handlers.list_collection({"memoryId": "memory-one"})
            self.assertEqual([item["recordId"] for item in listed["records"]], ["record-one", "record-two"])
            await handlers.update_collection_record(
                {"memoryId": "memory-one", "recordId": "record-one", "text": "updated"}
            )
            updated = await handlers.list_collection({"memoryId": "memory-one"})
            self.assertEqual(updated["records"][0]["text"], "updated")
            await handlers.delete_collection_record(
                {"memoryId": "memory-one", "recordId": "record-one"}
            )
            self.assertEqual(vector_client.deleted_positions, [0])
            removed = await handlers.remove_collection({"memoryId": "memory-one"})
            self.assertEqual(removed["action"], "removed")
            self.assertEqual(vector_client.deleted_collections, 1)
            self.assertFalse(memory_path.exists())

            with self.assertRaisesRegex(ValueError, "fields"):
                await handlers.list_collection({"memoryId": "memory-one", "path": "outside"})

    async def test_synapxnet_v3_management_round_trip(self) -> None:
        """Expose V3 creation, sharing, version history and integrity via exact Worker RPC."""

        with tempfile.TemporaryDirectory(prefix="openxnet-memory-v3-worker-") as directory:
            handlers = MemoryWorkerHandlers(
                Path(directory),
                memory_factory=RecordingMemoryFactory(),
            )
            created = await handlers.synapxnet_create(
                {
                    "ownerAgent": "agent-owner",
                    "actorAgent": "agent-owner",
                    "taskId": "task-worker",
                    "title": "Worker memory",
                    "content": "A versioned memory managed through the worker.",
                    "qualityScore": 0.9,
                    "permissions": [],
                    "tags": ["worker"],
                    "source": "test",
                }
            )
            edited = await handlers.synapxnet_edit(
                {
                    "memoryId": created["memoryId"],
                    "baseVersion": 1,
                    "actorAgent": "agent-owner",
                    "title": "Worker memory",
                    "content": "A versioned memory shared through the worker.",
                    "qualityScore": 0.9,
                    "permissions": ["agent-reviewer"],
                    "tags": ["worker"],
                    "reason": "Reviewer access required.",
                }
            )
            history = await handlers.synapxnet_history(
                {"memoryId": created["memoryId"], "requesterAgent": "agent-reviewer"}
            )
            verified = await handlers.synapxnet_verify(
                {"requesterAgent": "agent-owner", "memoryId": created["memoryId"]}
            )
            recalled = await handlers.synapxnet_recall(
                {
                    "requesterAgent": "agent-reviewer",
                    "query": "shared worker",
                    "taskId": "task-worker",
                    "requiredTags": ["worker"],
                    "limit": 4,
                    "maximumCharacters": 2000,
                }
            )

            self.assertEqual(edited["version"], 2)
            self.assertEqual(len(history["versions"]), 2)
            self.assertTrue(verified["healthy"])
            self.assertEqual(recalled["count"], 1)
            with self.assertRaisesRegex(ValueError, "fields"):
                await handlers.synapxnet_status({"path": "outside"})


class FakeRecallRuntime:
    """记录 Recall Worker 委托，并返回稳定结果的异步测试替身。"""

    def __init__(self) -> None:
        """创建空调用轨迹；无输入，无副作用。"""

        self.calls: list[tuple[str, tuple[Any, ...], dict[str, Any]]] = []

    async def bootstrap(self, *args: Any, **kwargs: Any) -> dict[str, Any]:
        """记录首屏请求；输入任意测试参数，返回空聚合。"""

        self.calls.append(("bootstrap", args, kwargs))
        return {"interrupted": [], "overview": {}}

    async def search(self, *args: Any, **kwargs: Any) -> dict[str, Any]:
        """记录搜索请求；输入任意测试参数，返回一个结果。"""

        self.calls.append(("search", args, kwargs))
        return {"results": [{"text": "remembered"}]}

    async def timeline(self, *args: Any, **kwargs: Any) -> dict[str, Any]:
        """记录时间线请求；输入任意测试参数，返回空时间线。"""

        self.calls.append(("timeline", args, kwargs))
        return {"timeline": []}

    async def observations(self, *args: Any, **kwargs: Any) -> dict[str, Any]:
        """记录观察流请求；输入任意测试参数，返回空观察流。"""

        self.calls.append(("observations", args, kwargs))
        return {"observations": []}

    def resume_interrupted(self, *args: Any, **kwargs: Any) -> dict[str, Any]:
        """记录恢复请求；输入任意测试参数，返回固定恢复提示。"""

        self.calls.append(("resume", args, kwargs))
        return {"resume_prompt": "continue"}

    async def rollback(self, *args: Any, **kwargs: Any) -> dict[str, Any]:
        """记录回滚请求；输入任意测试参数，返回固定成功结果。"""

        self.calls.append(("rollback", args, kwargs))
        return {"status": "ok"}

    async def close(self) -> None:
        """记录关闭请求；无输入，无返回。"""

        self.calls.append(("close", (), {}))


class RecallWorkerHandlerTests(unittest.IsolatedAsyncioTestCase):
    """验证 Recall Worker 的精确字段、范围和内部路径边界。"""

    async def test_delegates_exact_recall_requests_without_renderer_paths(self) -> None:
        """接受 Main 注入的精确作用域，并把规范化查询委托给运行时。"""

        runtime = FakeRecallRuntime()
        handlers = RecallWorkerHandlers(Path("."), runtime=runtime)  # type: ignore[arg-type]
        result = await handlers.search(
            {
                "workspaceDirectory": "C:/workspace",
                "providerName": "session_store",
                "query": "important decision",
                "topK": 8,
                "origin": "manual",
            }
        )

        self.assertEqual(result["results"], [{"text": "remembered"}])
        self.assertEqual(runtime.calls[0][0], "search")
        self.assertEqual(runtime.calls[0][1][2], "important decision")

    async def test_rejects_extra_fields_and_empty_observation_targets(self) -> None:
        """拒绝额外字段和无目标观察请求，且失败前不调用底层运行时。"""

        runtime = FakeRecallRuntime()
        handlers = RecallWorkerHandlers(Path("."), runtime=runtime)  # type: ignore[arg-type]
        with self.assertRaisesRegex(ValueError, "fields"):
            await handlers.bootstrap(
                {
                    "workspaceDirectory": "",
                    "providerName": "",
                    "command": "arbitrary",
                }
            )
        with self.assertRaisesRegex(ValueError, "target"):
            await handlers.observations(
                {
                    "workspaceDirectory": "",
                    "providerName": "",
                    "taskId": "",
                    "sessionId": "",
                    "digest": "",
                    "query": "",
                    "limit": 60,
                    "origin": "",
                }
            )
        self.assertEqual(runtime.calls, [])


class RecordingMemoryWorkerClient(MemoryWorkerClient):
    """Client double recording outgoing Memory Worker requests."""

    def __init__(self) -> None:
        """Create a configured client with one narrow test configuration."""

        super().__init__("http://127.0.0.1:1", "token", create_configuration())
        self.requests: list[tuple[str, Mapping[str, Any]]] = []

    def _request_sync(self, method: str, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Record one request and return deterministic Worker data."""

        self.requests.append((method, payload))
        if method == "memory.search":
            return {"results": [{"memory": "worker result"}]}
        if method == "memory.v3.recall":
            return {"schema": "openxnet.synapxnet-memory-runtime.v1", "items": []}
        if method == "memory.v3.short-term.append":
            return {"schema": "openxnet.synapxnet-memory-runtime.v1", "eventId": "event"}
        return {"result": {"status": "added"}}


class MemoryWorkerClientTests(unittest.TestCase):
    """Validate the synchronous Mem0-compatible backend adapter."""

    def test_search_and_add_preserve_legacy_method_shapes(self) -> None:
        """Return unwrapped results while sending normalized camel-case controls."""

        client = RecordingMemoryWorkerClient()
        searched = client.search("query", user_id="user-one", limit=7)
        added = client.add(
            "messages",
            user_id="user-one",
            metadata={"timestamp": "now"},
            infer=False,
        )

        self.assertEqual(searched, [{"memory": "worker result"}])
        self.assertEqual(added, {"status": "added"})
        self.assertEqual(client.requests[0][1]["limit"], 7)
        self.assertFalse(client.requests[1][1]["infer"])

    def test_v3_recall_and_short_term_evidence_use_dedicated_methods(self) -> None:
        """Keep V3 chat recall independent from legacy Mem0 configuration payloads."""

        client = RecordingMemoryWorkerClient()
        recalled = client.recall_v3(
            "release procedure",
            requester_agent="agent-owner",
            task_id="conversation-one",
            limit=3,
            maximum_characters=2000,
        )
        appended = client.append_v3_short_term(
            session_id="conversation-one",
            requester_agent="agent-owner",
            input_text="question",
            output_text="answer",
            token_count=4,
        )

        self.assertEqual(recalled["items"], [])
        self.assertEqual(appended["eventId"], "event")
        self.assertEqual(client.requests[0][0], "memory.v3.recall")
        self.assertEqual(client.requests[1][0], "memory.v3.short-term.append")


if __name__ == "__main__":
    unittest.main()
