# -*- coding: utf-8 -*-
"""OpenXnet Memory Worker serving dependency-isolated Mem0 orchestration."""

from __future__ import annotations

import argparse
import asyncio
from collections.abc import Mapping, Sequence
from hashlib import sha256
import importlib.util
import json
import os
from pathlib import Path
import shutil
import sys
from typing import Any, Callable

from py.memory.vector_worker_store import VectorWorkerStore, register_mem0_vector_worker_store
from py.memory.recall_runtime import RecallRuntimeService
from py.memory.synapxnet_v3_runtime import SynapXnetMemoryV3Runtime
from py.vector_worker_client import VectorWorkerClient
from py.workers.runtime import WorkerRuntime


DEFAULT_MAX_QUERY_CHARACTERS = 256 * 1024
DEFAULT_MAX_MESSAGE_CHARACTERS = 512 * 1024
DEFAULT_MAX_MEMORY_INSTANCES = 16


class MemoryWorkerHandlers:
    """Validate Memory requests and delegate Mem0 operations to cached instances."""

    def __init__(
        self,
        storage_root: Path,
        *,
        memory_factory: Callable[[Mapping[str, Any]], Any] | None = None,
        vector_client: VectorWorkerClient | None = None,
        synapxnet_runtime: SynapXnetMemoryV3Runtime | None = None,
        max_instances: int = DEFAULT_MAX_MEMORY_INSTANCES,
    ) -> None:
        """Create handlers restricted to the application-owned memory-cache directory."""

        self._storage_root = storage_root.resolve()
        self._memory_root = (self._storage_root / "memory_cache").resolve()
        self._memory_root.mkdir(parents=True, exist_ok=True)
        self._memory_factory = memory_factory
        self._vector_client = vector_client or VectorWorkerClient.from_environment()
        self._synapxnet_runtime = synapxnet_runtime or SynapXnetMemoryV3Runtime(self._storage_root)
        self._max_instances = max(1, int(max_instances))
        self._memories: dict[str, tuple[str, Any]] = {}

    def status(self, _payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Return dependency and Vector Worker RPC readiness without importing Mem0."""

        return {
            "dependencyAvailable": importlib.util.find_spec("mem0") is not None,
            "vectorWorkerConfigured": self._vector_client.configured,
            "loadedInstances": len(self._memories),
            "synapxnetMemory": self._synapxnet_runtime.status(),
        }

    async def synapxnet_status(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Return the content-free V3 tier and audit overview."""

        self._read_exact_payload(payload, set())
        return await asyncio.to_thread(self._synapxnet_runtime.status)

    async def synapxnet_list(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """List latest V3 memories visible to one requesting agent."""

        request = self._read_exact_payload(
            payload,
            {"requesterAgent", "query", "ownerAgent", "includeRetired", "limit"},
        )
        return await asyncio.to_thread(self._synapxnet_runtime.list_memories, request)

    async def synapxnet_history(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """List immutable versions for one authorized V3 memory."""

        request = self._read_exact_payload(payload, {"memoryId", "requesterAgent"})
        return await asyncio.to_thread(self._synapxnet_runtime.get_history, request)

    async def synapxnet_recall(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Recall bounded V3 context for one authorized Agent and chat request."""

        request = self._read_exact_payload(
            payload,
            {"requesterAgent", "query", "taskId", "requiredTags", "limit", "maximumCharacters"},
        )
        return await asyncio.to_thread(self._synapxnet_runtime.recall_memories, request)

    async def synapxnet_create(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Create one V3 long-term memory owned by the actor agent."""

        request = self._read_exact_payload(
            payload,
            {
                "ownerAgent", "actorAgent", "taskId", "title", "content",
                "qualityScore", "permissions", "tags", "source",
            },
        )
        return await asyncio.to_thread(self._synapxnet_runtime.create_memory, request)

    async def synapxnet_edit(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Append an edited V3 version after optimistic concurrency validation."""

        request = self._read_exact_payload(
            payload,
            {
                "memoryId", "baseVersion", "actorAgent", "title", "content",
                "qualityScore", "permissions", "tags", "reason",
            },
        )
        return await asyncio.to_thread(self._synapxnet_runtime.edit_memory, request)

    async def synapxnet_rollback(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Append a new version restored from one historical V3 version."""

        request = self._read_exact_payload(
            payload,
            {"memoryId", "targetVersion", "actorAgent", "reason"},
        )
        return await asyncio.to_thread(self._synapxnet_runtime.rollback_memory, request)

    async def synapxnet_retire(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Retire the latest committed V3 version while preserving history."""

        request = self._read_exact_payload(payload, {"memoryId", "actorAgent"})
        return await asyncio.to_thread(self._synapxnet_runtime.retire_memory, request)

    async def synapxnet_export(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Create an integrity-protected V3 transfer document without filesystem paths."""

        request = self._read_exact_payload(payload, {"requesterAgent", "memoryIds"})
        return await asyncio.to_thread(self._synapxnet_runtime.export_memories, request)

    async def synapxnet_import(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Verify and import a V3 transfer document into the actor's ownership scope."""

        request = self._read_exact_payload(
            payload,
            {"actorAgent", "targetOwnerAgent", "document"},
        )
        return await asyncio.to_thread(self._synapxnet_runtime.import_memories, request)

    async def synapxnet_verify(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Verify V3 content hashes, record hashes and the operation audit chain."""

        request = self._read_exact_payload(payload, {"requesterAgent", "memoryId"})
        return await asyncio.to_thread(self._synapxnet_runtime.verify_integrity, request)

    async def synapxnet_append_short_term(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Record hash-only short-term exchange evidence with a bounded TTL."""

        request = self._read_exact_payload(
            payload,
            {"sessionId", "requesterAgent", "input", "output", "tokenCount", "ttlSeconds"},
        )
        return await asyncio.to_thread(self._synapxnet_runtime.append_short_term_event, request)

    async def search(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Search one user's long-term memory using a bounded query and result limit."""

        configuration = self._read_configuration(payload.get("configuration"))
        query = self._require_text(payload.get("query"), "query", DEFAULT_MAX_QUERY_CHARACTERS)
        user_id = self._require_text(payload.get("userId"), "userId", 512)
        limit = self._read_integer(payload.get("limit", 5), "limit", minimum=1, maximum=100)
        memory = self._get_memory(configuration)
        result = await asyncio.to_thread(
            memory.search,
            query=query,
            user_id=user_id,
            limit=limit,
        )
        return {"results": self._normalize_json_value(result)}

    async def add(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Add bounded messages and metadata to one user's long-term memory."""

        configuration = self._read_configuration(payload.get("configuration"))
        messages = self._read_messages(payload.get("messages"))
        user_id = self._require_text(payload.get("userId"), "userId", 512)
        metadata = self._read_metadata(payload.get("metadata", {}))
        infer = self._read_boolean(payload.get("infer", True), "infer")
        memory = self._get_memory(configuration)
        result = await asyncio.to_thread(
            memory.add,
            messages,
            user_id=user_id,
            metadata=metadata,
            infer=infer,
        )
        return {"result": self._normalize_json_value(result)}

    def release(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Release one cached memory instance or every instance when no ID is supplied."""

        memory_id_value = payload.get("memoryId")
        if memory_id_value is None:
            released = len(self._memories)
            self._memories.clear()
            return {"released": released}
        memory_id = self._require_text(memory_id_value, "memoryId", 255)
        released = 1 if self._memories.pop(memory_id, None) is not None else 0
        return {"released": released}

    async def list_collection(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """列出记忆集合；输入精确 memoryId，返回有序公开记录，不启动 Mem0 或向量推理。"""

        request = self._read_exact_payload(payload, {"memoryId"})
        memory_id = self._require_text(request.get("memoryId"), "memoryId", 255)
        store = self._open_collection_store(memory_id)
        if store is None:
            return {"memoryId": memory_id, "records": []}
        metadata = await asyncio.to_thread(store.export_records)
        records = []
        for index, (record_id, record) in enumerate(metadata.items()):
            records.append(
                {
                    "recordId": str(record_id),
                    "index": index,
                    "text": str(record.get("data") or ""),
                    "createdAt": str(record.get("created_at") or ""),
                    "updatedAt": str(record.get("timetamp") or record.get("updated_at") or ""),
                }
            )
        return {"memoryId": memory_id, "records": records}

    async def update_collection_record(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """更新一条记忆文本；输入集合 ID、记录 ID 和文本，返回稳定结果，记录缺失时失败。"""

        request = self._read_exact_payload(payload, {"memoryId", "recordId", "text"})
        memory_id = self._require_text(request.get("memoryId"), "memoryId", 255)
        record_id = self._require_text(request.get("recordId"), "recordId", 128)
        text = self._require_text(request.get("text"), "text", DEFAULT_MAX_MESSAGE_CHARACTERS)
        store = self._require_collection_store(memory_id)
        metadata = await asyncio.to_thread(store.export_records)
        existing = metadata.get(record_id)
        if not isinstance(existing, Mapping):
            raise ValueError("Memory collection record was not found.")
        next_payload = dict(existing)
        next_payload["data"] = text
        await asyncio.to_thread(store.update, record_id, payload=next_payload)
        return {"memoryId": memory_id, "recordId": record_id, "action": "updated"}

    async def delete_collection_record(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """删除一条记忆记录及向量；输入稳定 ID，返回结果，删除向量时按需调用 Vector Worker。"""

        request = self._read_exact_payload(payload, {"memoryId", "recordId"})
        memory_id = self._require_text(request.get("memoryId"), "memoryId", 255)
        record_id = self._require_text(request.get("recordId"), "recordId", 128)
        store = self._require_collection_store(memory_id)
        metadata = await asyncio.to_thread(store.export_records)
        if record_id not in metadata:
            raise ValueError("Memory collection record was not found.")
        await asyncio.to_thread(store.delete, record_id)
        return {"memoryId": memory_id, "recordId": record_id, "action": "deleted"}

    async def remove_collection(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """删除整个记忆集合；输入稳定 ID，先释放 Mem0 缓存，再删除向量、元数据和历史文件。"""

        request = self._read_exact_payload(payload, {"memoryId"})
        memory_id = self._require_text(request.get("memoryId"), "memoryId", 255)
        memory_path = self._resolve_memory_path(memory_id)
        self._memories.pop(memory_id, None)
        store = self._open_collection_store(memory_id)
        if store is not None:
            await asyncio.to_thread(store.delete_col)
        if memory_path.exists():
            await asyncio.to_thread(shutil.rmtree, memory_path)
        return {"memoryId": memory_id, "recordId": "", "action": "removed"}

    def _read_exact_payload(
        self,
        payload: Mapping[str, Any],
        fields: set[str],
    ) -> Mapping[str, Any]:
        """校验管理请求；输入 payload 和字段集合，返回原映射，额外或缺失字段时失败。"""

        if not isinstance(payload, Mapping) or set(payload.keys()) != fields:
            raise ValueError("Memory management request fields are invalid.")
        return payload

    def _open_collection_store(self, memory_id: str) -> VectorWorkerStore | None:
        """打开已有集合；输入稳定 ID，返回 Store，目录或索引/元数据均缺失时返回 None。"""

        memory_path = self._resolve_memory_path(memory_id)
        if not memory_path.is_dir():
            return None
        known_files = (
            memory_path / "agent-party.faiss",
            memory_path / "agent-party.records.json",
            memory_path / "agent-party.pkl",
        )
        if not any(file_path.is_file() for file_path in known_files):
            return None
        return VectorWorkerStore(
            collection_name="agent-party",
            path=str(memory_path),
            client=self._vector_client,
        )

    def _require_collection_store(self, memory_id: str) -> VectorWorkerStore:
        """打开必需集合；输入稳定 ID，返回 Store，集合不存在时抛出固定 ValueError。"""

        store = self._open_collection_store(memory_id)
        if store is None:
            raise ValueError("Memory collection was not found.")
        return store

    def _get_memory(self, configuration: Mapping[str, Any]) -> Any:
        """Return a matching cached Mem0 instance or construct one lazily."""

        memory_id = str(configuration["memoryId"])
        fingerprint = sha256(
            json.dumps(configuration, ensure_ascii=False, sort_keys=True).encode("utf-8")
        ).hexdigest()
        cached = self._memories.get(memory_id)
        if cached is not None and cached[0] == fingerprint:
            return cached[1]
        if cached is not None:
            self._memories.pop(memory_id, None)
        if len(self._memories) >= self._max_instances:
            oldest_memory_id = next(iter(self._memories))
            self._memories.pop(oldest_memory_id, None)
        memory = self._create_memory(self._build_mem0_configuration(configuration))
        self._memories[memory_id] = (fingerprint, memory)
        return memory

    def _create_memory(self, configuration: Mapping[str, Any]) -> Any:
        """Import Mem0 only for the first real operation and create an instance."""

        if self._memory_factory is not None:
            return self._memory_factory(configuration)
        os.environ.setdefault("MEM0_TELEMETRY", "False")
        register_mem0_vector_worker_store()
        from mem0 import Memory

        return Memory.from_config(dict(configuration))

    def _build_mem0_configuration(
        self,
        configuration: Mapping[str, Any],
    ) -> dict[str, Any]:
        """Build an internal Mem0 configuration with a worker-owned storage path."""

        embedder = configuration["embedder"]
        llm = configuration["llm"]
        if not isinstance(embedder, Mapping) or not isinstance(llm, Mapping):
            raise TypeError("Validated Memory configuration is inconsistent.")
        memory_path = self._resolve_memory_path(configuration["memoryId"])
        memory_path.mkdir(parents=True, exist_ok=True)
        return {
            "embedder": {
                "provider": "openai",
                "config": {
                    "model": embedder["model"],
                    "api_key": embedder["apiKey"],
                    "openai_base_url": embedder["baseUrl"],
                    "embedding_dims": embedder["dimensions"],
                },
            },
            "llm": {
                "provider": "openai",
                "config": {
                    "model": llm["model"],
                    "api_key": llm["apiKey"],
                    "openai_base_url": llm["baseUrl"],
                },
            },
            "vector_store": {
                "provider": "faiss",
                "config": {
                    "collection_name": "agent-party",
                    "path": str(memory_path),
                    "distance_strategy": "euclidean",
                    "embedding_model_dims": embedder["dimensions"],
                },
            },
            "history_db_path": str(memory_path / "history.db"),
        }

    def _read_configuration(self, value: Any) -> dict[str, Any]:
        """Validate the narrow, path-free configuration accepted over Worker RPC."""

        if not isinstance(value, Mapping):
            raise ValueError("Memory request field 'configuration' must be an object.")
        memory_id = self._require_text(value.get("memoryId"), "memoryId", 255)
        self._resolve_memory_path(memory_id)
        embedder = self._read_provider(value.get("embedder"), "embedder", include_dimensions=True)
        llm = self._read_provider(value.get("llm"), "llm", include_dimensions=False)
        return {"memoryId": memory_id, "embedder": embedder, "llm": llm}

    def _read_provider(
        self,
        value: Any,
        field_name: str,
        *,
        include_dimensions: bool,
    ) -> dict[str, Any]:
        """Validate one OpenAI-compatible model provider configuration."""

        if not isinstance(value, Mapping):
            raise ValueError(f"Memory request field '{field_name}' must be an object.")
        provider = {
            "model": self._require_text(value.get("model"), f"{field_name}.model", 512),
            "apiKey": self._read_optional_text(value.get("apiKey", ""), f"{field_name}.apiKey", 16_384),
            "baseUrl": self._require_text(value.get("baseUrl"), f"{field_name}.baseUrl", 4_096),
        }
        if include_dimensions:
            provider["dimensions"] = self._read_integer(
                value.get("dimensions", 1024),
                f"{field_name}.dimensions",
                minimum=1,
                maximum=8_192,
            )
        return provider

    def _resolve_memory_path(self, value: Any) -> Path:
        """Resolve one memory ID below the fixed application memory-cache root."""

        memory_id = self._require_text(value, "memoryId", 255)
        memory_path = (self._memory_root / memory_id).resolve()
        try:
            memory_path.relative_to(self._memory_root)
        except ValueError as error:
            raise ValueError("Memory ID resolves outside the application memory root.") from error
        if memory_path == self._memory_root:
            raise ValueError("Memory ID must identify a child directory.")
        return memory_path

    def _read_messages(self, value: Any) -> Any:
        """Validate supported Mem0 message shapes and enforce a serialized size limit."""

        if isinstance(value, str):
            if not value.strip() or len(value) > DEFAULT_MAX_MESSAGE_CHARACTERS:
                raise ValueError("Memory messages text is empty or exceeds the size limit.")
            return value
        if not isinstance(value, Sequence) or isinstance(value, (bytes, bytearray, str)):
            raise ValueError("Memory messages must be text or an array of message objects.")
        messages: list[dict[str, Any]] = []
        for item in value:
            if not isinstance(item, Mapping):
                raise ValueError("Memory message array items must be objects.")
            messages.append(dict(item))
        serialized = json.dumps(messages, ensure_ascii=False)
        if not messages or len(serialized) > DEFAULT_MAX_MESSAGE_CHARACTERS:
            raise ValueError("Memory messages array is empty or exceeds the size limit.")
        return messages

    def _read_metadata(self, value: Any) -> dict[str, Any]:
        """Validate small JSON metadata without accepting arbitrary Python objects."""

        if not isinstance(value, Mapping):
            raise ValueError("Memory request field 'metadata' must be an object.")
        metadata = dict(value)
        serialized = json.dumps(metadata, ensure_ascii=False)
        if len(serialized) > 64 * 1024:
            raise ValueError("Memory metadata exceeds the size limit.")
        return metadata

    def _normalize_json_value(self, value: Any) -> Any:
        """Convert Mem0 results into protocol-safe JSON values."""

        if value is None or isinstance(value, (bool, int, float, str)):
            return value
        if isinstance(value, Mapping):
            return {str(key): self._normalize_json_value(item) for key, item in value.items()}
        if isinstance(value, Sequence) and not isinstance(value, (bytes, bytearray, str)):
            return [self._normalize_json_value(item) for item in value]
        model_dump = getattr(value, "model_dump", None)
        if callable(model_dump):
            return self._normalize_json_value(model_dump())
        return str(value)

    def _require_text(self, value: Any, field_name: str, maximum: int) -> str:
        """Normalize one required bounded non-empty text field."""

        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"Memory request field '{field_name}' must be non-empty text.")
        normalized = value.strip()
        if len(normalized) > maximum:
            raise ValueError(f"Memory request field '{field_name}' exceeds {maximum} characters.")
        return normalized

    def _read_optional_text(self, value: Any, field_name: str, maximum: int) -> str:
        """Validate one bounded text field that may be empty."""

        if not isinstance(value, str):
            raise ValueError(f"Memory request field '{field_name}' must be text.")
        if len(value) > maximum:
            raise ValueError(f"Memory request field '{field_name}' exceeds {maximum} characters.")
        return value

    def _read_integer(
        self,
        value: Any,
        field_name: str,
        *,
        minimum: int,
        maximum: int,
    ) -> int:
        """Validate one bounded integer control field."""

        if not isinstance(value, int) or isinstance(value, bool):
            raise ValueError(f"Memory request field '{field_name}' must be an integer.")
        if value < minimum or value > maximum:
            raise ValueError(
                f"Memory request field '{field_name}' must be between {minimum} and {maximum}."
            )
        return value

    def _read_boolean(self, value: Any, field_name: str) -> bool:
        """Validate one strict boolean control field."""

        if not isinstance(value, bool):
            raise ValueError(f"Memory request field '{field_name}' must be boolean.")
        return value


class RecallWorkerHandlers:
    """校验 Desktop Recall 请求，并委托给框架无关 Recall Runtime。"""

    def __init__(
        self,
        storage_root: Path,
        *,
        runtime: RecallRuntimeService | None = None,
    ) -> None:
        """创建处理器；输入应用数据根目录，不读取工作区或启动外部进程。"""

        self._runtime = runtime or RecallRuntimeService(storage_root)

    async def bootstrap(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """读取 Recall 首屏；输入内部工作区作用域，返回聚合元数据。"""

        values = self._read_exact_payload(payload, {"workspaceDirectory", "providerName"})
        return await self._runtime.bootstrap(
            self._read_workspace(values.get("workspaceDirectory"), required=False),
            self._read_optional_text(values.get("providerName"), "providerName", 128),
        )

    async def search(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """搜索 Recall；输入精确查询字段，返回最多 20 条本地记忆。"""

        values = self._read_exact_payload(
            payload,
            {"workspaceDirectory", "providerName", "query", "topK", "origin"},
        )
        return await self._runtime.search(
            self._read_workspace(values.get("workspaceDirectory"), required=False),
            self._read_optional_text(values.get("providerName"), "providerName", 128),
            self._read_text(values.get("query"), "query", 2_048),
            self._read_integer(values.get("topK"), "topK", 1, 20),
            self._read_origin(values.get("origin")),
        )

    async def timeline(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """读取 Recall 时间线；输入精确查询或锚点字段，返回有界渐进记录。"""

        fields = {
            "workspaceDirectory",
            "providerName",
            "query",
            "taskId",
            "sessionId",
            "digest",
            "depthBefore",
            "depthAfter",
            "limit",
            "origin",
        }
        values = self._read_exact_payload(payload, fields)
        return await self._runtime.timeline(
            self._read_workspace(values.get("workspaceDirectory"), required=False),
            self._read_optional_text(values.get("providerName"), "providerName", 128),
            query=self._read_optional_text(values.get("query"), "query", 2_048),
            task_id=self._read_optional_text(values.get("taskId"), "taskId", 512),
            session_id=self._read_optional_text(values.get("sessionId"), "sessionId", 512),
            digest=self._read_optional_text(values.get("digest"), "digest", 512),
            depth_before=self._read_integer(values.get("depthBefore"), "depthBefore", 0, 20),
            depth_after=self._read_integer(values.get("depthAfter"), "depthAfter", 0, 20),
            limit=self._read_integer(values.get("limit"), "limit", 1, 80),
            origin=self._read_origin(values.get("origin")),
        )

    async def observations(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """读取 Recall 观察流；输入至少一个目标字段，返回最多 120 条记录。"""

        fields = {
            "workspaceDirectory",
            "providerName",
            "taskId",
            "sessionId",
            "digest",
            "query",
            "limit",
            "origin",
        }
        values = self._read_exact_payload(payload, fields)
        task_id = self._read_optional_text(values.get("taskId"), "taskId", 512)
        session_id = self._read_optional_text(values.get("sessionId"), "sessionId", 512)
        digest = self._read_optional_text(values.get("digest"), "digest", 512)
        query = self._read_optional_text(values.get("query"), "query", 2_048)
        if not any((task_id, session_id, digest, query)):
            raise ValueError("Recall observations require one target field.")
        return await self._runtime.observations(
            self._read_workspace(values.get("workspaceDirectory"), required=False),
            self._read_optional_text(values.get("providerName"), "providerName", 128),
            task_id=task_id,
            session_id=session_id,
            digest=digest,
            query=query,
            limit=self._read_integer(values.get("limit"), "limit", 1, 120),
            origin=self._read_origin(values.get("origin")),
        )

    def resume(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """恢复中断 turn；输入精确 turn ID，返回恢复提示和已更新记录。"""

        values = self._read_exact_payload(payload, {"turnId"})
        return self._runtime.resume_interrupted(
            self._read_identifier(values.get("turnId"), "turnId", 128)
        )

    async def rollback(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """恢复工作区检查点；输入内部工作区和 ID，返回脱敏成功结果。"""

        values = self._read_exact_payload(payload, {"workspaceDirectory", "checkpointId"})
        return await self._runtime.rollback(
            self._read_workspace(values.get("workspaceDirectory"), required=True),
            self._read_identifier(values.get("checkpointId"), "checkpointId", 160),
        )

    async def close(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """关闭 Recall 连接；输入必须为空对象，返回固定释放结果。"""

        self._read_exact_payload(payload, set())
        await self._runtime.close()
        return {"released": True}

    def _read_exact_payload(
        self,
        payload: Mapping[str, Any],
        fields: set[str],
    ) -> Mapping[str, Any]:
        """校验精确对象；输入 payload 和字段集合，返回原映射，额外或缺失字段时失败。"""

        if not isinstance(payload, Mapping) or set(payload.keys()) != fields:
            raise ValueError("Recall request fields are invalid.")
        return payload

    def _read_workspace(self, value: Any, *, required: bool) -> str:
        """校验内部工作区文本；输入未知值和必需标记，返回路径文本或空字符串。"""

        normalized = self._read_optional_text(value, "workspaceDirectory", 32_767)
        if required and not normalized:
            raise ValueError("Recall workspace is not configured.")
        if "\x00" in normalized:
            raise ValueError("Recall workspace path is invalid.")
        return normalized

    def _read_origin(self, value: Any) -> str:
        """校验来源筛选；输入未知值，返回空值、auto 或 manual。"""

        origin = self._read_optional_text(value, "origin", 16)
        if origin not in {"", "auto", "manual"}:
            raise ValueError("Recall origin is invalid.")
        return origin

    def _read_identifier(self, value: Any, field_name: str, maximum: int) -> str:
        """校验运行时标识；输入未知值、字段和长度，返回不含控制字符的文本。"""

        normalized = self._read_text(value, field_name, maximum)
        if any(ord(character) < 32 or ord(character) == 127 for character in normalized):
            raise ValueError(f"Recall request field '{field_name}' contains control characters.")
        return normalized

    def _read_text(self, value: Any, field_name: str, maximum: int) -> str:
        """校验必填文本；输入未知值、字段和长度，返回去空白内容。"""

        normalized = self._read_optional_text(value, field_name, maximum)
        if not normalized:
            raise ValueError(f"Recall request field '{field_name}' is required.")
        return normalized

    def _read_optional_text(self, value: Any, field_name: str, maximum: int) -> str:
        """校验可空文本；输入未知值、字段和长度，返回去空白内容。"""

        if not isinstance(value, str):
            raise ValueError(f"Recall request field '{field_name}' must be text.")
        normalized = value.strip()
        if len(normalized) > maximum:
            raise ValueError(f"Recall request field '{field_name}' exceeds its limit.")
        return normalized

    def _read_integer(self, value: Any, field_name: str, minimum: int, maximum: int) -> int:
        """校验整数；输入未知值、字段和范围，返回合法整数。"""

        if not isinstance(value, int) or isinstance(value, bool) or not minimum <= value <= maximum:
            raise ValueError(f"Recall request field '{field_name}' is invalid.")
        return value


def resolve_default_storage_root() -> Path:
    """Resolve the application user-data root used for all persistent memory."""

    configured = os.environ.get("OPENXNET_USER_DATA_DIR", "").strip()
    if configured:
        return Path(configured)
    return Path.home() / ".openxnet"


def parse_arguments() -> argparse.Namespace:
    """Parse standalone Worker storage and cache options."""

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--storage-root", type=Path, default=resolve_default_storage_root())
    parser.add_argument("--max-instances", type=int, default=DEFAULT_MAX_MEMORY_INSTANCES)
    return parser.parse_args()


def configure_utf8_standard_streams() -> None:
    """把 Memory Worker 标准流固定为 UTF-8/LF，避免 Windows 管道使用本地代码页。"""

    for stream in (sys.stdin, sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            reconfigure(encoding="utf-8", errors="strict", newline="\n")


async def run() -> None:
    """Create Memory Worker handlers and serve NDJSON requests on stdio."""

    configure_utf8_standard_streams()
    arguments = parse_arguments()
    handlers = MemoryWorkerHandlers(
        arguments.storage_root,
        max_instances=arguments.max_instances,
    )
    recall_handlers = RecallWorkerHandlers(arguments.storage_root)
    runtime = WorkerRuntime("memory")
    runtime.register_handler("memory.status", handlers.status)
    runtime.register_handler("memory.search", handlers.search)
    runtime.register_handler("memory.add", handlers.add)
    runtime.register_handler("memory.release", handlers.release)
    runtime.register_handler("memory.collection.list", handlers.list_collection)
    runtime.register_handler("memory.collection.update", handlers.update_collection_record)
    runtime.register_handler("memory.collection.delete-record", handlers.delete_collection_record)
    runtime.register_handler("memory.collection.remove", handlers.remove_collection)
    runtime.register_handler("memory.v3.status", handlers.synapxnet_status)
    runtime.register_handler("memory.v3.list", handlers.synapxnet_list)
    runtime.register_handler("memory.v3.history", handlers.synapxnet_history)
    runtime.register_handler("memory.v3.recall", handlers.synapxnet_recall)
    runtime.register_handler("memory.v3.create", handlers.synapxnet_create)
    runtime.register_handler("memory.v3.edit", handlers.synapxnet_edit)
    runtime.register_handler("memory.v3.rollback", handlers.synapxnet_rollback)
    runtime.register_handler("memory.v3.retire", handlers.synapxnet_retire)
    runtime.register_handler("memory.v3.export", handlers.synapxnet_export)
    runtime.register_handler("memory.v3.import", handlers.synapxnet_import)
    runtime.register_handler("memory.v3.verify", handlers.synapxnet_verify)
    runtime.register_handler("memory.v3.short-term.append", handlers.synapxnet_append_short_term)
    runtime.register_handler("recall.bootstrap", recall_handlers.bootstrap)
    runtime.register_handler("recall.search", recall_handlers.search)
    runtime.register_handler("recall.timeline", recall_handlers.timeline)
    runtime.register_handler("recall.observations", recall_handlers.observations)
    runtime.register_handler("recall.resume", recall_handlers.resume)
    runtime.register_handler("recall.rollback", recall_handlers.rollback)
    runtime.register_handler("recall.close", recall_handlers.close)
    await runtime.serve_stdio()


if __name__ == "__main__":
    asyncio.run(run())
