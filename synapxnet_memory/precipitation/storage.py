from __future__ import annotations

import json
import os
import sqlite3
import threading
import time
from pathlib import Path
from typing import Any, Iterable, Mapping

from ..contracts import (
    MemoryCandidate,
    MemoryRecord,
    MemoryStatus,
    ValidationResult,
    canonical_json_sha256,
    immutable_mapping,
    sha256_bytes,
    utc_now,
)


class _ClosingConnection(sqlite3.Connection):
    """Close SQLite handles after transaction context exit, including on Windows."""

    def __exit__(self, exc_type, exc_value, traceback) -> bool:
        try:
            return super().__exit__(exc_type, exc_value, traceback)
        finally:
            self.close()


class TransactionalMemoryStore:
    """Content-addressed payload storage with a SQLite WAL metadata index."""

    def __init__(self, root: Path) -> None:
        self.root = Path(root).resolve()
        self.blob_root = self.root / "blobs"
        self.database_path = self.root / "memory.sqlite3"
        self._lock = threading.RLock()
        self.blob_root.mkdir(parents=True, exist_ok=True)
        if os.name != "nt":
            os.chmod(self.root, 0o700)
            os.chmod(self.blob_root, 0o700)
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(
            self.database_path,
            timeout=30.0,
            factory=_ClosingConnection,
        )
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute("PRAGMA synchronous=FULL")
        connection.execute("PRAGMA foreign_keys=ON")
        return connection

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS memory_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    memory_id TEXT NOT NULL,
                    version INTEGER NOT NULL,
                    owner_agent TEXT NOT NULL,
                    task_id TEXT NOT NULL,
                    schema_version TEXT NOT NULL,
                    status TEXT NOT NULL,
                    payload_sha256 TEXT NOT NULL,
                    record_sha256 TEXT NOT NULL UNIQUE,
                    candidate_sha256 TEXT NOT NULL,
                    quality_score REAL NOT NULL,
                    permissions_json TEXT NOT NULL,
                    tags_json TEXT NOT NULL,
                    metadata_json TEXT NOT NULL,
                    created_at_utc TEXT NOT NULL,
                    committed_at_utc TEXT NOT NULL,
                    UNIQUE(memory_id, version)
                );
                CREATE INDEX IF NOT EXISTS idx_memory_lookup
                    ON memory_records(task_id, owner_agent, status, version DESC);
                CREATE TABLE IF NOT EXISTS memory_feedback (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    memory_id TEXT NOT NULL,
                    version INTEGER NOT NULL,
                    outcome_json TEXT NOT NULL,
                    created_at_utc TEXT NOT NULL
                );
                """
            )

    @staticmethod
    def _memory_id(candidate: MemoryCandidate) -> str:
        return TransactionalMemoryStore.memory_id_for(
            owner_agent=candidate.owner_agent,
            task_id=candidate.task_id,
            schema_version=candidate.schema_version,
        )

    @staticmethod
    def memory_id_for(*, owner_agent: str, task_id: str, schema_version: str) -> str:
        return canonical_json_sha256(
            {
                "owner_agent": owner_agent,
                "task_id": task_id,
                "schema_version": schema_version,
            }
        )

    def _write_blob(self, payload: bytes, payload_sha256: str) -> Path:
        if sha256_bytes(payload) != payload_sha256:
            raise ValueError("payload hash mismatch before write")
        path = self.blob_root / f"{payload_sha256}.bin"
        if path.is_file():
            if sha256_bytes(path.read_bytes()) != payload_sha256:
                raise RuntimeError("existing payload object failed hash verification")
            return path
        temporary = path.with_name(f"tmp-{path.name}-{os.getpid()}-{time.time_ns()}")
        try:
            with temporary.open("xb") as handle:
                handle.write(payload)
                handle.flush()
                os.fsync(handle.fileno())
            temporary.replace(path)
            if os.name != "nt":
                os.chmod(path, 0o600)
        finally:
            if temporary.exists():
                temporary.unlink()
        return path

    def commit(
        self,
        candidate: MemoryCandidate,
        validation: ValidationResult,
    ) -> MemoryRecord:
        if not validation.accepted:
            raise ValueError(f"memory candidate rejected: {', '.join(validation.reasons)}")
        memory_id = self._memory_id(candidate)
        committed_at = utc_now()
        with self._lock:
            self._write_blob(candidate.payload, candidate.payload_sha256)
            with self._connect() as connection:
                connection.execute("BEGIN IMMEDIATE")
                row = connection.execute(
                    "SELECT COALESCE(MAX(version), 0) AS version FROM memory_records WHERE memory_id = ?",
                    (memory_id,),
                ).fetchone()
                version = int(row["version"]) + 1
                material = {
                    "memory_id": memory_id,
                    "version": version,
                    "owner_agent": candidate.owner_agent,
                    "task_id": candidate.task_id,
                    "schema_version": candidate.schema_version,
                    "payload_sha256": candidate.payload_sha256,
                    "candidate_sha256": validation.candidate_sha256,
                    "quality_score": candidate.quality_score,
                    "permissions": candidate.permissions,
                    "tags": candidate.tags,
                    "metadata": dict(candidate.metadata),
                    "created_at_utc": candidate.created_at_utc,
                    "committed_at_utc": committed_at,
                }
                record_sha256 = canonical_json_sha256(material)
                connection.execute(
                    """
                    INSERT INTO memory_records(
                        memory_id, version, owner_agent, task_id, schema_version,
                        status, payload_sha256, record_sha256, candidate_sha256,
                        quality_score, permissions_json, tags_json, metadata_json,
                        created_at_utc, committed_at_utc
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        memory_id,
                        version,
                        candidate.owner_agent,
                        candidate.task_id,
                        candidate.schema_version,
                        MemoryStatus.COMMITTED.value,
                        candidate.payload_sha256,
                        record_sha256,
                        validation.candidate_sha256,
                        candidate.quality_score,
                        json.dumps(candidate.permissions),
                        json.dumps(candidate.tags),
                        json.dumps(dict(candidate.metadata), sort_keys=True, ensure_ascii=False),
                        candidate.created_at_utc,
                        committed_at,
                    ),
                )
                connection.commit()
        return self.get(memory_id, version)

    @staticmethod
    def _to_record(row: sqlite3.Row) -> MemoryRecord:
        return MemoryRecord(
            memory_id=row["memory_id"],
            version=int(row["version"]),
            owner_agent=row["owner_agent"],
            task_id=row["task_id"],
            schema_version=row["schema_version"],
            status=MemoryStatus(row["status"]),
            payload_sha256=row["payload_sha256"],
            record_sha256=row["record_sha256"],
            quality_score=float(row["quality_score"]),
            permissions=tuple(json.loads(row["permissions_json"])),
            tags=tuple(json.loads(row["tags_json"])),
            metadata=immutable_mapping(json.loads(row["metadata_json"])),
            created_at_utc=row["created_at_utc"],
            committed_at_utc=row["committed_at_utc"],
        )

    def get(self, memory_id: str, version: int) -> MemoryRecord:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM memory_records WHERE memory_id = ? AND version = ?",
                (memory_id, int(version)),
            ).fetchone()
        if row is None:
            raise KeyError(f"memory record not found: {memory_id}:v{version}")
        return self._to_record(row)

    def latest_for(
        self,
        *,
        owner_agent: str,
        task_id: str,
        schema_version: str = "synapxnet.memory.v1",
        statuses: Iterable[MemoryStatus] = (MemoryStatus.COMMITTED,),
    ) -> MemoryRecord | None:
        memory_id = self.memory_id_for(
            owner_agent=owner_agent,
            task_id=task_id,
            schema_version=schema_version,
        )
        status_values = tuple(status.value for status in statuses)
        if not status_values:
            return None
        placeholders = ",".join("?" for _ in status_values)
        with self._connect() as connection:
            row = connection.execute(
                f"""
                SELECT * FROM memory_records
                WHERE memory_id = ? AND status IN ({placeholders})
                ORDER BY version DESC LIMIT 1
                """,
                (memory_id, *status_values),
            ).fetchone()
        return None if row is None else self._to_record(row)

    def retire_latest(
        self,
        *,
        owner_agent: str,
        task_id: str,
        schema_version: str = "synapxnet.memory.v1",
    ) -> MemoryRecord:
        memory_id = self.memory_id_for(
            owner_agent=owner_agent,
            task_id=task_id,
            schema_version=schema_version,
        )
        with self._lock:
            with self._connect() as connection:
                connection.execute("BEGIN IMMEDIATE")
                row = connection.execute(
                    """
                    SELECT version FROM memory_records
                    WHERE memory_id = ? AND status = ?
                    ORDER BY version DESC LIMIT 1
                    """,
                    (memory_id, MemoryStatus.COMMITTED.value),
                ).fetchone()
                if row is None:
                    connection.rollback()
                    raise KeyError(f"committed memory record not found: {memory_id}")
                version = int(row["version"])
                connection.execute(
                    "UPDATE memory_records SET status = ? WHERE memory_id = ? AND version = ?",
                    (MemoryStatus.RETIRED.value, memory_id, version),
                )
                connection.commit()
        return self.get(memory_id, version)

    def query(
        self,
        *,
        task_id: str,
        owner_agent: str | None = None,
        statuses: Iterable[MemoryStatus] = (MemoryStatus.COMMITTED,),
        limit: int = 32,
    ) -> list[MemoryRecord]:
        status_values = tuple(status.value for status in statuses)
        if not status_values:
            return []
        placeholders = ",".join("?" for _ in status_values)
        sql = f"SELECT * FROM memory_records WHERE task_id = ? AND status IN ({placeholders})"
        parameters: list[Any] = [task_id, *status_values]
        if owner_agent is not None:
            sql += " AND owner_agent = ?"
            parameters.append(owner_agent)
        sql += " ORDER BY version DESC, committed_at_utc DESC LIMIT ?"
        parameters.append(int(limit))
        with self._connect() as connection:
            rows = connection.execute(sql, parameters).fetchall()
        return [self._to_record(row) for row in rows]

    def load_payload(self, record: MemoryRecord) -> bytes:
        path = self.blob_root / f"{record.payload_sha256}.bin"
        payload = path.read_bytes()
        if sha256_bytes(payload) != record.payload_sha256:
            raise RuntimeError("loaded payload failed SHA-256 verification")
        return payload

    def record_feedback(
        self,
        record: MemoryRecord,
        outcome: Mapping[str, Any],
    ) -> None:
        encoded = json.dumps(dict(outcome), sort_keys=True, ensure_ascii=False, allow_nan=False)
        with self._connect() as connection:
            connection.execute(
                "INSERT INTO memory_feedback(memory_id, version, outcome_json, created_at_utc) VALUES (?, ?, ?, ?)",
                (record.memory_id, record.version, encoded, utc_now()),
            )
            connection.commit()
