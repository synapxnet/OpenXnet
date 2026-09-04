# -*- coding: utf-8 -*-
"""OpenXnet product adapter for the SynapXnet Memory Framework V3."""

from __future__ import annotations

import base64
from collections.abc import Mapping, Sequence
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import sqlite3
import threading
from typing import Any
from uuid import uuid4

from synapxnet_memory import MemoryPrecipitationModule, MemoryStatus
from synapxnet_memory.contracts import MemoryRecord, canonical_json_sha256, sha256_bytes, utc_now
from synapxnet_memory.precipitation import (
    MemoryCrystallizer,
    MemoryValidator,
    TransactionalMemoryStore,
)


MEMORY_PAYLOAD_SCHEMA = "openxnet.synapxnet-memory.payload.v1"
MEMORY_TRANSFER_SCHEMA = "openxnet.synapxnet-memory-transfer.v1"
MEMORY_RUNTIME_SCHEMA = "openxnet.synapxnet-memory-runtime.v1"
MAX_TEXT_CHARACTERS = 512 * 1024
MAX_TRANSFER_BYTES = 16 * 1024 * 1024
MAX_LIST_RESULTS = 500
MAX_RECALL_TERMS = 256
MAX_TAGS = 64
MAX_PERMISSIONS = 128
MEMORY_TYPE_TAG_PREFIX = "memory-type:"
MEMORY_TYPES = frozenset(("skill", "incident", "collaboration", "decision", "manual"))


class _ClosingConnection(sqlite3.Connection):
    """Commit or roll back like sqlite3's context manager, then close the handle."""

    def __exit__(self, exc_type, exc_value, traceback) -> bool:
        try:
            return super().__exit__(exc_type, exc_value, traceback)
        finally:
            self.close()


class SynapXnetMemoryV3Runtime:
    """Expose versioned, shareable and auditable V3 memory operations."""

    def __init__(self, storage_root: Path) -> None:
        self.root = (Path(storage_root).resolve() / "synapxnet-memory-v3").resolve()
        self.store = TransactionalMemoryStore(self.root / "long-term")
        self.precipitation = MemoryPrecipitationModule(
            crystallizer=MemoryCrystallizer(),
            validator=MemoryValidator(
                minimum_quality=0.0,
                maximum_payload_bytes=2 * 1024 * 1024,
            ),
            storage=self.store,
        )
        self._lock = threading.RLock()
        self._initialize_product_schema()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(
            self.store.database_path,
            timeout=30.0,
            factory=_ClosingConnection,
        )
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute("PRAGMA synchronous=FULL")
        return connection

    def _initialize_product_schema(self) -> None:
        with self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS openxnet_memory_audit (
                    sequence INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_id TEXT NOT NULL UNIQUE,
                    previous_event_sha256 TEXT,
                    event_sha256 TEXT NOT NULL UNIQUE,
                    action TEXT NOT NULL,
                    actor_agent TEXT NOT NULL,
                    memory_id TEXT,
                    version INTEGER,
                    details_json TEXT NOT NULL,
                    created_at_utc TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS openxnet_short_term_events (
                    event_id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    requester_agent TEXT NOT NULL,
                    input_sha256 TEXT NOT NULL,
                    output_sha256 TEXT,
                    token_count INTEGER NOT NULL,
                    expires_at_utc TEXT NOT NULL,
                    created_at_utc TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_openxnet_short_term_session
                    ON openxnet_short_term_events(session_id, created_at_utc DESC);
                CREATE TABLE IF NOT EXISTS openxnet_active_memory (
                    session_id TEXT PRIMARY KEY,
                    requester_agent TEXT NOT NULL,
                    memory_id TEXT,
                    record_sha256 TEXT,
                    lease_expires_at_utc TEXT NOT NULL,
                    access_count INTEGER NOT NULL,
                    state_sha256 TEXT NOT NULL,
                    updated_at_utc TEXT NOT NULL
                );
                """
            )

    def status(self) -> dict[str, Any]:
        """Return a content-free overview of all three memory tiers."""

        self._prune_runtime_tiers()
        with self._connect() as connection:
            versions = int(connection.execute("SELECT COUNT(*) FROM memory_records").fetchone()[0])
            memories = int(
                connection.execute("SELECT COUNT(DISTINCT memory_id) FROM memory_records").fetchone()[0]
            )
            committed = int(
                connection.execute(
                    "SELECT COUNT(*) FROM memory_records WHERE status = ?",
                    (MemoryStatus.COMMITTED.value,),
                ).fetchone()[0]
            )
            shared = int(
                connection.execute(
                    "SELECT COUNT(*) FROM memory_records WHERE permissions_json NOT IN ('[]', '[\"\"]')"
                ).fetchone()[0]
            )
            owners = int(connection.execute("SELECT COUNT(DISTINCT owner_agent) FROM memory_records").fetchone()[0])
            short_term = int(connection.execute("SELECT COUNT(*) FROM openxnet_short_term_events").fetchone()[0])
            active = int(connection.execute("SELECT COUNT(*) FROM openxnet_active_memory").fetchone()[0])
            audit_events = int(connection.execute("SELECT COUNT(*) FROM openxnet_memory_audit").fetchone()[0])
        return {
            "schema": MEMORY_RUNTIME_SCHEMA,
            "frameworkVersion": "0.3.0",
            "tiers": {
                "longTerm": {"memories": memories, "versions": versions, "committedVersions": committed},
                "activeNative": {"sessions": active},
                "shortTerm": {"events": short_term},
            },
            "sharedVersions": shared,
            "ownerAgents": owners,
            "auditEvents": audit_events,
            "auditHealthy": self.verify_audit_chain(),
        }

    def list_memories(self, request: Mapping[str, Any]) -> dict[str, Any]:
        actor = self._agent(request.get("requesterAgent"), "requesterAgent")
        query = self._optional_text(request.get("query", ""), "query", 2_048).lower()
        owner_filter = self._optional_agent(request.get("ownerAgent"), "ownerAgent")
        include_retired = self._boolean(request.get("includeRetired", False), "includeRetired")
        limit = self._integer(request.get("limit", 100), "limit", 1, MAX_LIST_RESULTS)
        rows = self._latest_rows(include_retired=include_retired, limit=MAX_LIST_RESULTS * 4)
        items: list[dict[str, Any]] = []
        for row in rows:
            record = self.store._to_record(row)
            if owner_filter and record.owner_agent != owner_filter:
                continue
            if not self._can_read(record.owner_agent, record.permissions, actor):
                continue
            payload = self._decode_payload(self.store.load_payload(record))
            search_text = " ".join(
                (record.owner_agent, record.task_id, payload["title"], payload["content"], " ".join(record.tags))
            ).lower()
            if query and query not in search_text:
                continue
            items.append(self._public_record(record, payload, include_content=False))
            if len(items) >= limit:
                break
        return {"schema": MEMORY_RUNTIME_SCHEMA, "items": items, "count": len(items)}

    def get_history(self, request: Mapping[str, Any]) -> dict[str, Any]:
        memory_id = self._digest(request.get("memoryId"), "memoryId")
        actor = self._agent(request.get("requesterAgent"), "requesterAgent")
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT * FROM memory_records WHERE memory_id = ? ORDER BY version DESC",
                (memory_id,),
            ).fetchall()
        if not rows:
            raise ValueError("Memory was not found.")
        records = [self.store._to_record(row) for row in rows]
        if not self._can_read(records[0].owner_agent, records[0].permissions, actor):
            raise PermissionError("The requesting agent cannot inspect this memory.")
        items = [
            self._public_record(record, self._decode_payload(self.store.load_payload(record)), include_content=True)
            for record in records
        ]
        return {"schema": MEMORY_RUNTIME_SCHEMA, "memoryId": memory_id, "versions": items}

    def recall_memories(self, request: Mapping[str, Any]) -> dict[str, Any]:
        """Recall a bounded, permission-filtered set of latest long-term memories."""

        actor = self._agent(request.get("requesterAgent"), "requesterAgent")
        query = self._text(request.get("query"), "query", 32_768)
        task_id = self._optional_text(request.get("taskId", ""), "taskId", 512)
        required_tags = set(self._tags(request.get("requiredTags", ())))
        limit = self._integer(request.get("limit", 4), "limit", 1, 20)
        maximum_characters = self._integer(
            request.get("maximumCharacters", 4_000),
            "maximumCharacters",
            256,
            32_000,
        )
        tokens = self._recall_terms(query)
        candidates: list[tuple[float, Any, dict[str, str]]] = []
        for row in self._latest_rows(include_retired=False, limit=MAX_LIST_RESULTS * 4):
            record = self.store._to_record(row)
            if not self._can_read(record.owner_agent, record.permissions, actor):
                continue
            if required_tags and not required_tags.issubset(record.tags):
                continue
            payload = self._decode_payload(self.store.load_payload(record))
            fields = {
                "title": payload["title"].casefold(),
                "content": payload["content"].casefold(),
                "task": record.task_id.casefold(),
                "tags": " ".join(record.tags).casefold(),
            }
            lexical = 0.0
            for token in tokens:
                if token in fields["title"]:
                    lexical += 3.0
                if token in fields["content"]:
                    lexical += 1.0
                if token in fields["task"]:
                    lexical += 2.0
                if token in fields["tags"]:
                    lexical += 1.5
            exact_task = bool(task_id and record.task_id == task_id)
            if exact_task:
                lexical += 5.0
            if lexical <= 0.0:
                continue
            score = lexical + record.quality_score * 2.0 + min(record.version, 20) * 0.01
            candidates.append((score, record, payload))
        candidates.sort(key=lambda item: (item[0], item[1].version, item[1].record_sha256), reverse=True)
        items: list[dict[str, Any]] = []
        consumed = 0
        for score, record, payload in candidates:
            remaining = maximum_characters - consumed
            if remaining <= 0 or len(items) >= limit:
                break
            content = payload["content"][:remaining]
            if not content:
                continue
            consumed += len(content)
            items.append(
                {
                    "memoryId": record.memory_id,
                    "version": record.version,
                    "ownerAgent": record.owner_agent,
                    "taskId": record.task_id,
                    "title": payload["title"],
                    "content": content,
                    "tags": list(record.tags),
                    "recordSha256": record.record_sha256,
                    "score": round(score, 6),
                    "readGate": record.quality_score,
                }
            )
        self._audit(
            "recall",
            actor,
            items[0]["memoryId"] if items else None,
            items[0]["version"] if items else None,
            {
                "querySha256": sha256_bytes(query.encode("utf-8")),
                "taskIdSha256": sha256_bytes(task_id.encode("utf-8")) if task_id else None,
                "resultCount": len(items),
                "recordSha256s": [item["recordSha256"] for item in items],
            },
        )
        return {
            "schema": MEMORY_RUNTIME_SCHEMA,
            "requesterAgent": actor,
            "querySha256": sha256_bytes(query.encode("utf-8")),
            "items": items,
            "count": len(items),
        }

    @staticmethod
    def _recall_terms(query: str) -> tuple[str, ...]:
        """Build bounded Latin terms and CJK n-grams for lexical recall."""

        normalized = query.casefold()
        terms: list[str] = []
        seen: set[str] = set()

        def add(term: str) -> None:
            value = term.strip()
            if not value or value in seen or len(terms) >= MAX_RECALL_TERMS:
                return
            seen.add(value)
            terms.append(value)

        for part in re.findall(r"[a-z0-9][a-z0-9_.:/-]*|[\u3400-\u4dbf\u4e00-\u9fff]+", normalized):
            if not re.fullmatch(r"[\u3400-\u4dbf\u4e00-\u9fff]+", part):
                add(part)
                continue

            if len(part) <= 64:
                add(part)
            sample = part if len(part) <= 128 else part[:64] + part[-64:]
            for width in (2, 3, 4):
                if len(terms) >= MAX_RECALL_TERMS:
                    break
                for index in range(max(0, len(sample) - width + 1)):
                    add(sample[index:index + width])
                    if len(terms) >= MAX_RECALL_TERMS:
                        break

        return tuple(terms) or (normalized,)

    def create_memory(self, request: Mapping[str, Any]) -> dict[str, Any]:
        owner = self._agent(request.get("ownerAgent"), "ownerAgent")
        actor = self._agent(request.get("actorAgent", owner), "actorAgent")
        if actor != owner:
            raise PermissionError("Only the owner agent can create memory in this scope.")
        task_id = self._identifier(request.get("taskId"), "taskId", 512)
        title = self._text(request.get("title"), "title", 512)
        content = self._text(request.get("content"), "content", MAX_TEXT_CHARACTERS)
        quality = self._quality(request.get("qualityScore", 0.8))
        permissions = self._agents(request.get("permissions", ()), "permissions", MAX_PERMISSIONS)
        tags = self._tags(request.get("tags", ()))
        source = self._optional_text(request.get("source", "manual"), "source", 128) or "manual"
        record = self._commit(
            owner_agent=owner,
            task_id=task_id,
            title=title,
            content=content,
            quality_score=quality,
            permissions=permissions,
            tags=tags,
            metadata={"operation": "create", "source": source, "actor_agent": actor},
        )
        self._audit("create", actor, record.memory_id, record.version, {"recordSha256": record.record_sha256})
        return self._public_record(record, self._decode_payload(self.store.load_payload(record)), include_content=True)

    def edit_memory(self, request: Mapping[str, Any]) -> dict[str, Any]:
        memory_id = self._digest(request.get("memoryId"), "memoryId")
        actor = self._agent(request.get("actorAgent"), "actorAgent")
        base_version = self._integer(request.get("baseVersion"), "baseVersion", 1, 2_147_483_647)
        latest = self._latest_record(memory_id, include_retired=False)
        self._require_owner(latest.owner_agent, actor)
        if latest.version != base_version:
            raise RuntimeError("Memory changed after it was opened; refresh before editing.")
        current = self._decode_payload(self.store.load_payload(latest))
        title = self._text(request.get("title", current["title"]), "title", 512)
        content = self._text(request.get("content", current["content"]), "content", MAX_TEXT_CHARACTERS)
        permissions = self._agents(request.get("permissions", latest.permissions), "permissions", MAX_PERMISSIONS)
        tags = self._tags(request.get("tags", latest.tags))
        quality = self._quality(request.get("qualityScore", latest.quality_score))
        reason = self._optional_text(request.get("reason", ""), "reason", 2_048)
        record = self._commit(
            owner_agent=latest.owner_agent,
            task_id=latest.task_id,
            title=title,
            content=content,
            quality_score=quality,
            permissions=permissions,
            tags=tags,
            metadata={
                "operation": "edit",
                "actor_agent": actor,
                "parent_record_sha256": latest.record_sha256,
                "reason": reason,
            },
        )
        self._audit(
            "edit",
            actor,
            memory_id,
            record.version,
            {"parentRecordSha256": latest.record_sha256, "recordSha256": record.record_sha256},
        )
        return self._public_record(record, self._decode_payload(self.store.load_payload(record)), include_content=True)

    def rollback_memory(self, request: Mapping[str, Any]) -> dict[str, Any]:
        memory_id = self._digest(request.get("memoryId"), "memoryId")
        actor = self._agent(request.get("actorAgent"), "actorAgent")
        target_version = self._integer(request.get("targetVersion"), "targetVersion", 1, 2_147_483_647)
        reason = self._optional_text(request.get("reason", ""), "reason", 2_048)
        latest = self._latest_record(memory_id, include_retired=True)
        self._require_owner(latest.owner_agent, actor)
        target = self.store.get(memory_id, target_version)
        payload = self._decode_payload(self.store.load_payload(target))
        record = self._commit(
            owner_agent=target.owner_agent,
            task_id=target.task_id,
            title=payload["title"],
            content=payload["content"],
            quality_score=target.quality_score,
            permissions=target.permissions,
            tags=target.tags,
            metadata={
                "operation": "rollback",
                "actor_agent": actor,
                "parent_record_sha256": latest.record_sha256,
                "rollback_from_version": target.version,
                "rollback_from_record_sha256": target.record_sha256,
                "reason": reason,
            },
        )
        self._audit(
            "rollback",
            actor,
            memory_id,
            record.version,
            {
                "fromVersion": target.version,
                "fromRecordSha256": target.record_sha256,
                "recordSha256": record.record_sha256,
            },
        )
        return self._public_record(record, payload, include_content=True)

    def retire_memory(self, request: Mapping[str, Any]) -> dict[str, Any]:
        memory_id = self._digest(request.get("memoryId"), "memoryId")
        actor = self._agent(request.get("actorAgent"), "actorAgent")
        latest = self._latest_record(memory_id, include_retired=False)
        self._require_owner(latest.owner_agent, actor)
        retired = self.store.retire_latest(
            owner_agent=latest.owner_agent,
            task_id=latest.task_id,
            schema_version=latest.schema_version,
        )
        self._audit("retire", actor, memory_id, retired.version, {"recordSha256": retired.record_sha256})
        return self._public_record(
            retired,
            self._decode_payload(self.store.load_payload(retired)),
            include_content=False,
        )

    def export_memories(self, request: Mapping[str, Any]) -> dict[str, Any]:
        actor = self._agent(request.get("requesterAgent"), "requesterAgent")
        requested_ids = request.get("memoryIds", ())
        if not isinstance(requested_ids, Sequence) or isinstance(requested_ids, (str, bytes, bytearray)):
            raise ValueError("Memory transfer field 'memoryIds' must be an array.")
        memory_ids = tuple(self._digest(value, "memoryIds") for value in requested_ids)
        if not memory_ids or len(memory_ids) > 100:
            raise ValueError("Memory transfer requires between 1 and 100 memory IDs.")
        entries: list[dict[str, Any]] = []
        with self._connect() as connection:
            for memory_id in memory_ids:
                rows = connection.execute(
                    "SELECT * FROM memory_records WHERE memory_id = ? ORDER BY version ASC",
                    (memory_id,),
                ).fetchall()
                if not rows:
                    raise ValueError("A requested memory was not found.")
                for row in rows:
                    record = self.store._to_record(row)
                    if not self._can_read(record.owner_agent, record.permissions, actor):
                        raise PermissionError("The requesting agent cannot export this memory.")
                    payload = self.store.load_payload(record)
                    entries.append(
                        {
                            "memoryId": record.memory_id,
                            "version": record.version,
                            "ownerAgent": record.owner_agent,
                            "taskId": record.task_id,
                            "schemaVersion": record.schema_version,
                            "status": record.status.value,
                            "payloadBase64": base64.b64encode(payload).decode("ascii"),
                            "payloadSha256": record.payload_sha256,
                            "recordSha256": record.record_sha256,
                            "qualityScore": record.quality_score,
                            "permissions": list(record.permissions),
                            "tags": list(record.tags),
                            "metadata": dict(record.metadata),
                            "createdAtUtc": record.created_at_utc,
                            "committedAtUtc": record.committed_at_utc,
                        }
                    )
        body = {
            "schema": MEMORY_TRANSFER_SCHEMA,
            "exportedAtUtc": utc_now(),
            "exportedByAgent": actor,
            "entries": entries,
        }
        document = {**body, "manifestSha256": canonical_json_sha256(body)}
        if len(json.dumps(document, ensure_ascii=False).encode("utf-8")) > MAX_TRANSFER_BYTES:
            raise ValueError("Memory transfer package exceeds the size limit.")
        self._audit("export", actor, None, None, {"memoryCount": len(memory_ids), "versionCount": len(entries)})
        return document

    def import_memories(self, request: Mapping[str, Any]) -> dict[str, Any]:
        """导入完整性已验证的迁移文档，并跳过已导入的相同来源版本。"""

        actor = self._agent(request.get("actorAgent"), "actorAgent")
        target_owner = self._optional_agent(request.get("targetOwnerAgent"), "targetOwnerAgent") or actor
        if target_owner != actor:
            raise PermissionError("Imported memory can only be assigned to the importing agent.")
        document = request.get("document")
        if not isinstance(document, Mapping):
            raise ValueError("Memory transfer document must be an object.")
        encoded = json.dumps(document, ensure_ascii=False, allow_nan=False).encode("utf-8")
        if len(encoded) > MAX_TRANSFER_BYTES:
            raise ValueError("Memory transfer package exceeds the size limit.")
        if document.get("schema") != MEMORY_TRANSFER_SCHEMA:
            raise ValueError("Memory transfer schema is unsupported.")
        manifest = self._digest(document.get("manifestSha256"), "manifestSha256")
        body = {key: value for key, value in document.items() if key != "manifestSha256"}
        if canonical_json_sha256(body) != manifest:
            raise ValueError("Memory transfer manifest failed integrity verification.")
        entries = document.get("entries")
        if not isinstance(entries, Sequence) or isinstance(entries, (str, bytes, bytearray)):
            raise ValueError("Memory transfer entries must be an array.")
        imported: list[dict[str, Any]] = []
        skipped = 0
        for entry_value in entries:
            if not isinstance(entry_value, Mapping):
                raise ValueError("Memory transfer entry must be an object.")
            payload_b64 = self._text(entry_value.get("payloadBase64"), "payloadBase64", MAX_TRANSFER_BYTES)
            try:
                payload_bytes = base64.b64decode(payload_b64, validate=True)
            except ValueError as error:
                raise ValueError("Memory transfer payload is not valid base64.") from error
            payload_sha = self._digest(entry_value.get("payloadSha256"), "payloadSha256")
            if sha256_bytes(payload_bytes) != payload_sha:
                raise ValueError("Memory transfer payload failed SHA-256 verification.")
            payload = self._decode_payload(payload_bytes)
            source_record_sha = self._digest(entry_value.get("recordSha256"), "recordSha256")
            task_id = self._identifier(entry_value.get("taskId"), "taskId", 512)
            permissions = self._agents(entry_value.get("permissions", ()), "permissions", MAX_PERMISSIONS)
            tags = self._tags(entry_value.get("tags", ()))
            existing = self._find_imported_record(
                owner_agent=target_owner,
                task_id=task_id,
                source_record_sha256=source_record_sha,
            )
            if existing is not None:
                skipped += 1
                continue
            record = self._commit(
                owner_agent=target_owner,
                task_id=task_id,
                title=payload["title"],
                content=payload["content"],
                quality_score=self._quality(entry_value.get("qualityScore", 0.8)),
                permissions=permissions,
                tags=tags,
                metadata={
                    "operation": "import",
                    "actor_agent": actor,
                    "transfer_manifest_sha256": manifest,
                    "import_source_memory_id": self._digest(entry_value.get("memoryId"), "memoryId"),
                    "import_source_version": self._integer(entry_value.get("version"), "version", 1, 2_147_483_647),
                    "import_source_record_sha256": source_record_sha,
                },
            )
            imported.append(self._public_record(record, payload, include_content=False))
        if imported:
            self._audit(
                "import",
                actor,
                None,
                None,
                {
                    "manifestSha256": manifest,
                    "versionCount": len(imported),
                    "skippedVersionCount": skipped,
                },
            )
        return {
            "schema": MEMORY_RUNTIME_SCHEMA,
            "manifestSha256": manifest,
            "imported": imported,
            "skipped": skipped,
        }

    def _find_imported_record(
        self,
        *,
        owner_agent: str,
        task_id: str,
        source_record_sha256: str,
    ) -> MemoryRecord | None:
        """按目标所有者、任务和来源记录摘要查找既有版本，跨清单避免重复迁移。"""

        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT * FROM memory_records
                WHERE owner_agent = ? AND task_id = ?
                ORDER BY version DESC
                """,
                (owner_agent, task_id),
            ).fetchall()
        for row in rows:
            metadata = json.loads(row["metadata_json"])
            if (
                metadata.get("operation") == "import"
                and metadata.get("import_source_record_sha256") == source_record_sha256
            ):
                return self.store._to_record(row)
        return None

    def verify_integrity(self, request: Mapping[str, Any]) -> dict[str, Any]:
        actor = self._agent(request.get("requesterAgent"), "requesterAgent")
        memory_id = self._optional_digest(request.get("memoryId"), "memoryId")
        failures: list[dict[str, Any]] = []
        checked = 0
        with self._connect() as connection:
            if memory_id:
                rows = connection.execute(
                    "SELECT * FROM memory_records WHERE memory_id = ? ORDER BY version ASC",
                    (memory_id,),
                ).fetchall()
            else:
                rows = connection.execute("SELECT * FROM memory_records ORDER BY id ASC").fetchall()
        for row in rows:
            record = self.store._to_record(row)
            if not self._can_read(record.owner_agent, record.permissions, actor):
                continue
            checked += 1
            try:
                payload = self.store.load_payload(record)
                material = {
                    "memory_id": record.memory_id,
                    "version": record.version,
                    "owner_agent": record.owner_agent,
                    "task_id": record.task_id,
                    "schema_version": record.schema_version,
                    "payload_sha256": record.payload_sha256,
                    "candidate_sha256": row["candidate_sha256"],
                    "quality_score": record.quality_score,
                    "permissions": record.permissions,
                    "tags": record.tags,
                    "metadata": dict(record.metadata),
                    "created_at_utc": record.created_at_utc,
                    "committed_at_utc": record.committed_at_utc,
                }
                if sha256_bytes(payload) != record.payload_sha256:
                    raise RuntimeError("payload hash mismatch")
                if canonical_json_sha256(material) != record.record_sha256:
                    raise RuntimeError("record hash mismatch")
            except Exception as error:
                failures.append(
                    {"memoryId": record.memory_id, "version": record.version, "reason": str(error)}
                )
        audit_healthy = self.verify_audit_chain()
        result = {
            "schema": MEMORY_RUNTIME_SCHEMA,
            "checkedVersions": checked,
            "failures": failures,
            "recordChainHealthy": not failures,
            "auditChainHealthy": audit_healthy,
            "healthy": not failures and audit_healthy,
        }
        self._audit("verify", actor, memory_id, None, {"checkedVersions": checked, "healthy": result["healthy"]})
        return result

    def append_short_term_event(self, request: Mapping[str, Any]) -> dict[str, Any]:
        session_id = self._identifier(request.get("sessionId"), "sessionId", 512)
        actor = self._agent(request.get("requesterAgent"), "requesterAgent")
        input_text = self._text(request.get("input"), "input", MAX_TEXT_CHARACTERS)
        output_text = self._optional_text(request.get("output", ""), "output", MAX_TEXT_CHARACTERS)
        token_count = self._integer(request.get("tokenCount", 0), "tokenCount", 0, 10_000_000)
        ttl_seconds = self._integer(request.get("ttlSeconds", 86_400), "ttlSeconds", 60, 604_800)
        now = datetime.now(timezone.utc)
        expires = datetime.fromtimestamp(now.timestamp() + ttl_seconds, tz=timezone.utc).isoformat()
        event_id = uuid4().hex
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO openxnet_short_term_events(
                    event_id, session_id, requester_agent, input_sha256, output_sha256,
                    token_count, expires_at_utc, created_at_utc
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    event_id,
                    session_id,
                    actor,
                    sha256_bytes(input_text.encode("utf-8")),
                    sha256_bytes(output_text.encode("utf-8")) if output_text else None,
                    token_count,
                    expires,
                    now.isoformat(),
                ),
            )
        return {"schema": MEMORY_RUNTIME_SCHEMA, "eventId": event_id, "expiresAtUtc": expires}

    def verify_audit_chain(self) -> bool:
        previous: str | None = None
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT * FROM openxnet_memory_audit ORDER BY sequence ASC"
            ).fetchall()
        for expected_sequence, row in enumerate(rows, start=1):
            if int(row["sequence"]) != expected_sequence or row["previous_event_sha256"] != previous:
                return False
            material = {
                "eventId": row["event_id"],
                "previousEventSha256": row["previous_event_sha256"],
                "action": row["action"],
                "actorAgent": row["actor_agent"],
                "memoryId": row["memory_id"],
                "version": row["version"],
                "details": json.loads(row["details_json"]),
                "createdAtUtc": row["created_at_utc"],
            }
            digest = canonical_json_sha256(material)
            if digest != row["event_sha256"]:
                return False
            previous = digest
        return True

    def _commit(
        self,
        *,
        owner_agent: str,
        task_id: str,
        title: str,
        content: str,
        quality_score: float,
        permissions: tuple[str, ...],
        tags: tuple[str, ...],
        metadata: Mapping[str, Any],
    ):
        payload = json.dumps(
            {"schema": MEMORY_PAYLOAD_SCHEMA, "title": title, "content": content},
            sort_keys=True,
            ensure_ascii=False,
            separators=(",", ":"),
            allow_nan=False,
        ).encode("utf-8")
        return self.precipitation.precipitate(
            owner_agent=owner_agent,
            task_id=task_id,
            trajectory={"kind": "openxnet-memory-operation", "content_sha256": sha256_bytes(content.encode("utf-8"))},
            feedback={"score": quality_score},
            payload=payload,
            permissions=permissions,
            tags=tags,
            metadata={"payload_kind": MEMORY_PAYLOAD_SCHEMA, **dict(metadata)},
        )

    def _latest_rows(self, *, include_retired: bool, limit: int) -> list[sqlite3.Row]:
        status_clause = "" if include_retired else "AND records.status = 'COMMITTED'"
        with self._connect() as connection:
            return connection.execute(
                f"""
                SELECT records.* FROM memory_records AS records
                INNER JOIN (
                    SELECT memory_id, MAX(version) AS version
                    FROM memory_records GROUP BY memory_id
                ) AS latest
                ON latest.memory_id = records.memory_id AND latest.version = records.version
                WHERE 1 = 1 {status_clause}
                ORDER BY records.committed_at_utc DESC
                LIMIT ?
                """,
                (int(limit),),
            ).fetchall()

    def _latest_record(self, memory_id: str, *, include_retired: bool):
        statuses = (MemoryStatus.COMMITTED.value, MemoryStatus.RETIRED.value) if include_retired else (MemoryStatus.COMMITTED.value,)
        placeholders = ",".join("?" for _ in statuses)
        with self._connect() as connection:
            row = connection.execute(
                f"SELECT * FROM memory_records WHERE memory_id = ? AND status IN ({placeholders}) ORDER BY version DESC LIMIT 1",
                (memory_id, *statuses),
            ).fetchone()
        if row is None:
            raise ValueError("Memory was not found.")
        return self.store._to_record(row)

    def _public_record(self, record, payload: Mapping[str, str], *, include_content: bool) -> dict[str, Any]:
        item = {
            "schema": MEMORY_RUNTIME_SCHEMA,
            "memoryId": record.memory_id,
            "version": record.version,
            "ownerAgent": record.owner_agent,
            "taskId": record.task_id,
            "memoryType": self._memory_type(record.task_id, record.tags),
            "title": payload["title"],
            "contentPreview": payload["content"][:240],
            "status": record.status.value,
            "qualityScore": record.quality_score,
            "permissions": list(record.permissions),
            "tags": list(record.tags),
            "payloadSha256": record.payload_sha256,
            "recordSha256": record.record_sha256,
            "operation": str(record.metadata.get("operation") or "create"),
            "parentRecordSha256": str(record.metadata.get("parent_record_sha256") or ""),
            "createdAtUtc": record.created_at_utc,
            "committedAtUtc": record.committed_at_utc,
        }
        if include_content:
            item["content"] = payload["content"]
        return item

    @staticmethod
    def _memory_type(task_id: str, tags: Sequence[str]) -> str:
        """从显式类型标签或稳定任务前缀推导公开记忆类型。"""

        for tag in tags:
            if tag.startswith(MEMORY_TYPE_TAG_PREFIX):
                candidate = tag[len(MEMORY_TYPE_TAG_PREFIX) :]
                if candidate in MEMORY_TYPES:
                    return candidate
        prefix = task_id.partition(":")[0]
        return prefix if prefix in MEMORY_TYPES else "manual"

    @staticmethod
    def _decode_payload(payload: bytes) -> dict[str, str]:
        try:
            value = json.loads(payload.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise RuntimeError("Memory payload is not valid UTF-8 JSON.") from error
        if not isinstance(value, dict) or value.get("schema") != MEMORY_PAYLOAD_SCHEMA:
            raise RuntimeError("Memory payload schema is unsupported.")
        title = value.get("title")
        content = value.get("content")
        if not isinstance(title, str) or not isinstance(content, str):
            raise RuntimeError("Memory payload fields are invalid.")
        return {"title": title, "content": content}

    def _audit(
        self,
        action: str,
        actor_agent: str,
        memory_id: str | None,
        version: int | None,
        details: Mapping[str, Any],
    ) -> None:
        with self._lock:
            with self._connect() as connection:
                connection.execute("BEGIN IMMEDIATE")
                tail = connection.execute(
                    "SELECT event_sha256 FROM openxnet_memory_audit ORDER BY sequence DESC LIMIT 1"
                ).fetchone()
                previous = None if tail is None else str(tail["event_sha256"])
                event_id = uuid4().hex
                created_at = utc_now()
                material = {
                    "eventId": event_id,
                    "previousEventSha256": previous,
                    "action": action,
                    "actorAgent": actor_agent,
                    "memoryId": memory_id,
                    "version": version,
                    "details": dict(details),
                    "createdAtUtc": created_at,
                }
                digest = canonical_json_sha256(material)
                connection.execute(
                    """
                    INSERT INTO openxnet_memory_audit(
                        event_id, previous_event_sha256, event_sha256, action,
                        actor_agent, memory_id, version, details_json, created_at_utc
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        event_id,
                        previous,
                        digest,
                        action,
                        actor_agent,
                        memory_id,
                        version,
                        json.dumps(dict(details), sort_keys=True, ensure_ascii=False, allow_nan=False),
                        created_at,
                    ),
                )
                connection.commit()

    def _prune_runtime_tiers(self) -> None:
        now = utc_now()
        with self._connect() as connection:
            connection.execute("DELETE FROM openxnet_short_term_events WHERE expires_at_utc <= ?", (now,))
            connection.execute("DELETE FROM openxnet_active_memory WHERE lease_expires_at_utc <= ?", (now,))

    @staticmethod
    def _can_read(owner_agent: str, permissions: Sequence[str], actor_agent: str) -> bool:
        return actor_agent == owner_agent or "*" in permissions or actor_agent in permissions

    @staticmethod
    def _require_owner(owner_agent: str, actor_agent: str) -> None:
        if owner_agent != actor_agent:
            raise PermissionError("Only the owner agent can modify this memory.")

    @staticmethod
    def _text(value: Any, field: str, maximum: int) -> str:
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"Memory field '{field}' must be non-empty text.")
        normalized = value.strip()
        if len(normalized) > maximum or "\x00" in normalized:
            raise ValueError(f"Memory field '{field}' is invalid.")
        return normalized

    @classmethod
    def _optional_text(cls, value: Any, field: str, maximum: int) -> str:
        if value is None or value == "":
            return ""
        return cls._text(value, field, maximum)

    @classmethod
    def _identifier(cls, value: Any, field: str, maximum: int) -> str:
        normalized = cls._text(value, field, maximum)
        if any(character in normalized for character in ("/", "\\", "\r", "\n")):
            raise ValueError(f"Memory field '{field}' is invalid.")
        return normalized

    @classmethod
    def _agent(cls, value: Any, field: str) -> str:
        return cls._identifier(value, field, 255)

    @classmethod
    def _optional_agent(cls, value: Any, field: str) -> str:
        return "" if value is None or value == "" else cls._agent(value, field)

    @classmethod
    def _agents(cls, value: Any, field: str, maximum: int) -> tuple[str, ...]:
        if not isinstance(value, Sequence) or isinstance(value, (str, bytes, bytearray)):
            raise ValueError(f"Memory field '{field}' must be an array.")
        if len(value) > maximum:
            raise ValueError(f"Memory field '{field}' has too many values.")
        return tuple(sorted(set(cls._agent(item, field) if item != "*" else "*" for item in value)))

    @classmethod
    def _tags(cls, value: Any) -> tuple[str, ...]:
        if not isinstance(value, Sequence) or isinstance(value, (str, bytes, bytearray)):
            raise ValueError("Memory field 'tags' must be an array.")
        if len(value) > MAX_TAGS:
            raise ValueError("Memory field 'tags' has too many values.")
        return tuple(sorted(set(cls._identifier(item, "tags", 128) for item in value)))

    @staticmethod
    def _quality(value: Any) -> float:
        try:
            quality = float(value)
        except (TypeError, ValueError) as error:
            raise ValueError("Memory quality score must be a number.") from error
        if not 0.0 <= quality <= 1.0:
            raise ValueError("Memory quality score must be between 0 and 1.")
        return quality

    @staticmethod
    def _integer(value: Any, field: str, minimum: int, maximum: int) -> int:
        if isinstance(value, bool):
            raise ValueError(f"Memory field '{field}' must be an integer.")
        try:
            number = int(value)
        except (TypeError, ValueError) as error:
            raise ValueError(f"Memory field '{field}' must be an integer.") from error
        if number < minimum or number > maximum:
            raise ValueError(f"Memory field '{field}' is out of range.")
        return number

    @staticmethod
    def _boolean(value: Any, field: str) -> bool:
        if not isinstance(value, bool):
            raise ValueError(f"Memory field '{field}' must be boolean.")
        return value

    @staticmethod
    def _digest(value: Any, field: str) -> str:
        if not isinstance(value, str) or len(value) != 64:
            raise ValueError(f"Memory field '{field}' must be a SHA-256 digest.")
        normalized = value.lower()
        if any(character not in "0123456789abcdef" for character in normalized):
            raise ValueError(f"Memory field '{field}' must be a SHA-256 digest.")
        return normalized

    @classmethod
    def _optional_digest(cls, value: Any, field: str) -> str:
        return "" if value is None or value == "" else cls._digest(value, field)
