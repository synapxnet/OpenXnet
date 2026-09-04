from __future__ import annotations

import json
import math
import os
import sqlite3
import threading
from pathlib import Path

import torch

from ..contracts import (
    ControllerStateSnapshot,
    canonical_json_sha256,
    sha256_bytes,
    utc_now,
)


def _encode_state(state: torch.Tensor) -> tuple[str, str]:
    tensor = state.detach().to(device="cpu", dtype=torch.float32).contiguous()
    if tensor.ndim != 2 or tensor.shape[0] != 1:
        raise ValueError("controller state must be shaped (1, hidden_units)")
    values = tensor.tolist()
    if any(not math.isfinite(float(value)) for row in values for value in row):
        raise ValueError("controller state must contain only finite values")
    payload = json.dumps(
        {"dtype": "float32", "shape": list(tensor.shape), "values": values},
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    )
    return payload, sha256_bytes(payload.encode("utf-8"))


def _decode_state(payload: str, expected_sha256: str) -> torch.Tensor:
    if sha256_bytes(payload.encode("utf-8")) != expected_sha256:
        raise RuntimeError("persisted controller state failed SHA-256 verification")
    value = json.loads(payload)
    if value.get("dtype") != "float32" or not isinstance(value.get("shape"), list):
        raise RuntimeError("persisted controller state has an unsupported schema")
    tensor = torch.tensor(value["values"], dtype=torch.float32)
    if list(tensor.shape) != value["shape"] or tensor.ndim != 2 or tensor.shape[0] != 1:
        raise RuntimeError("persisted controller state shape does not match its metadata")
    return tensor


class TransactionalLiquidControllerStore:
    """Versioned, hash-chained CfC state storage scoped by agent and task."""

    def __init__(self, root: Path) -> None:
        self.root = Path(root).resolve()
        self.database_path = self.root / "liquid-controller.sqlite3"
        self._lock = threading.RLock()
        self.root.mkdir(parents=True, exist_ok=True)
        if os.name != "nt":
            os.chmod(self.root, 0o700)
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.database_path, timeout=30.0)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute("PRAGMA synchronous=FULL")
        return connection

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS controller_states (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    state_scope TEXT NOT NULL,
                    version INTEGER NOT NULL,
                    state_json TEXT NOT NULL,
                    state_sha256 TEXT NOT NULL,
                    record_sha256 TEXT NOT NULL UNIQUE,
                    parent_record_sha256 TEXT,
                    controller_model_sha256 TEXT NOT NULL,
                    delta_t_seconds REAL NOT NULL,
                    updated_at_utc TEXT NOT NULL,
                    UNIQUE(state_scope, version)
                );
                CREATE INDEX IF NOT EXISTS idx_controller_state_scope
                    ON controller_states(state_scope, version DESC);
                """
            )

    @staticmethod
    def _snapshot(row: sqlite3.Row) -> ControllerStateSnapshot:
        return ControllerStateSnapshot(
            state_scope=row["state_scope"],
            version=int(row["version"]),
            state_sha256=row["state_sha256"],
            record_sha256=row["record_sha256"],
            parent_record_sha256=row["parent_record_sha256"],
            controller_model_sha256=row["controller_model_sha256"],
            delta_t_seconds=float(row["delta_t_seconds"]),
            updated_at_utc=row["updated_at_utc"],
        )

    def load(self, state_scope: str) -> tuple[torch.Tensor, ControllerStateSnapshot] | None:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM controller_states WHERE state_scope = ? ORDER BY version DESC LIMIT 1",
                (state_scope,),
            ).fetchone()
        if row is None:
            return None
        return _decode_state(row["state_json"], row["state_sha256"]), self._snapshot(row)

    def save(
        self,
        *,
        state_scope: str,
        state: torch.Tensor,
        controller_model_sha256: str,
        delta_t_seconds: float,
        expected_version: int | None = None,
        updated_at_utc: str | None = None,
    ) -> ControllerStateSnapshot:
        state_scope = state_scope.strip()
        if not state_scope:
            raise ValueError("state_scope is required")
        if len(controller_model_sha256) != 64:
            raise ValueError("controller_model_sha256 must be a SHA-256 digest")
        delta_t_seconds = float(delta_t_seconds)
        if not math.isfinite(delta_t_seconds) or delta_t_seconds <= 0.0:
            raise ValueError("delta_t_seconds must be finite and positive")
        state_json, state_sha256 = _encode_state(state)
        timestamp = updated_at_utc or utc_now()
        with self._lock:
            with self._connect() as connection:
                connection.execute("BEGIN IMMEDIATE")
                parent = connection.execute(
                    "SELECT * FROM controller_states WHERE state_scope = ? ORDER BY version DESC LIMIT 1",
                    (state_scope,),
                ).fetchone()
                previous_version = 0 if parent is None else int(parent["version"])
                if expected_version is not None and previous_version != int(expected_version):
                    connection.rollback()
                    raise RuntimeError(
                        f"controller state version conflict for {state_scope}: "
                        f"expected {expected_version}, found {previous_version}"
                    )
                version = previous_version + 1
                parent_sha256 = None if parent is None else str(parent["record_sha256"])
                material = {
                    "state_scope": state_scope,
                    "version": version,
                    "state_sha256": state_sha256,
                    "parent_record_sha256": parent_sha256,
                    "controller_model_sha256": controller_model_sha256,
                    "delta_t_seconds": delta_t_seconds,
                    "updated_at_utc": timestamp,
                }
                record_sha256 = canonical_json_sha256(material)
                connection.execute(
                    """
                    INSERT INTO controller_states(
                        state_scope, version, state_json, state_sha256, record_sha256,
                        parent_record_sha256, controller_model_sha256, delta_t_seconds,
                        updated_at_utc
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        state_scope,
                        version,
                        state_json,
                        state_sha256,
                        record_sha256,
                        parent_sha256,
                        controller_model_sha256,
                        delta_t_seconds,
                        timestamp,
                    ),
                )
                connection.commit()
        loaded = self.load(state_scope)
        if loaded is None:
            raise RuntimeError("controller state was not committed")
        return loaded[1]

    def audit(self, state_scope: str) -> bool:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT * FROM controller_states WHERE state_scope = ? ORDER BY version ASC",
                (state_scope,),
            ).fetchall()
        parent_sha256 = None
        for expected_version, row in enumerate(rows, start=1):
            if int(row["version"]) != expected_version:
                return False
            if row["parent_record_sha256"] != parent_sha256:
                return False
            try:
                _decode_state(row["state_json"], row["state_sha256"])
            except (RuntimeError, ValueError, TypeError, json.JSONDecodeError):
                return False
            material = {
                "state_scope": row["state_scope"],
                "version": int(row["version"]),
                "state_sha256": row["state_sha256"],
                "parent_record_sha256": row["parent_record_sha256"],
                "controller_model_sha256": row["controller_model_sha256"],
                "delta_t_seconds": float(row["delta_t_seconds"]),
                "updated_at_utc": row["updated_at_utc"],
            }
            if canonical_json_sha256(material) != row["record_sha256"]:
                return False
            parent_sha256 = row["record_sha256"]
        return True
