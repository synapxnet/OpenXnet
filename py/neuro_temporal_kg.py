#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
Temporal Knowledge Graph — 时序知识图谱引擎，支持时间感知三元组存储与衰减。

Author: maoyo
Department: 研发部
Date: 2026-04-13
Version: 1.0.0
Security Level: INTERNAL
"""

__version__ = "1.0.0"
__author__ = "maoyo"
__copyright__ = "Copyright 2026 Synapxnet"
__maintainer__ = "maoyo"
__email__ = "synapxnet@gmail.com"

"""
OpenXnet — Temporal Knowledge Graph (neuro_temporal_kg.py)
==========================================================

v0.5.1 Module: Time-aware entity-relationship storage using SQLite.

Based on mempalace-main/knowledge_graph.py (394 lines), adapted for
OpenXnet's NeuroSymbol ecosystem.

Features:
  - Triple store: (subject, predicate, object) + valid_from/valid_to
  - Time-travel queries: query_entity("Ram", as_of="2026-01-15")
  - Soft invalidation: mark facts as expired, never hard-delete
  - Source tracking: link triples back to NeuroSymbol IDs
  - SQLite WAL mode for concurrent read/write safety

Rule binding: rule-temporal-knowledge-v1 → TemporalReason operator
"""

import hashlib
import json
import os
import sqlite3
import logging
from datetime import date, datetime
from pathlib import Path
from typing import List, Dict, Optional, Any

logger = logging.getLogger("neuro_temporal_kg")


class TemporalKnowledgeGraph:
    """
    Time-aware knowledge graph backed by SQLite.
    Every fact has a validity window: [valid_from, valid_to].
    """

    def __init__(self, db_path: str):
        self.db_path = db_path
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        self._connection = None
        self._init_db()
        logger.info(f"[TemporalKG] Initialized at {db_path}")

    def _init_db(self):
        conn = self._conn()
        conn.executescript("""
            PRAGMA journal_mode=WAL;

            CREATE TABLE IF NOT EXISTS entities (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT DEFAULT 'unknown',
                properties TEXT DEFAULT '{}',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS triples (
                id TEXT PRIMARY KEY,
                subject TEXT NOT NULL,
                predicate TEXT NOT NULL,
                object TEXT NOT NULL,
                valid_from TEXT,
                valid_to TEXT,
                confidence REAL DEFAULT 1.0,
                source_symbol TEXT,
                project_version TEXT,
                extracted_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (subject) REFERENCES entities(id),
                FOREIGN KEY (object) REFERENCES entities(id)
            );

            CREATE TABLE IF NOT EXISTS version_tags (
                version TEXT PRIMARY KEY,
                label TEXT,
                tagged_at TEXT DEFAULT CURRENT_TIMESTAMP,
                metadata TEXT DEFAULT '{}'
            );

            CREATE INDEX IF NOT EXISTS idx_triples_subject ON triples(subject);
            CREATE INDEX IF NOT EXISTS idx_triples_object ON triples(object);
            CREATE INDEX IF NOT EXISTS idx_triples_predicate ON triples(predicate);
            CREATE INDEX IF NOT EXISTS idx_triples_valid ON triples(valid_from, valid_to);
            CREATE INDEX IF NOT EXISTS idx_triples_source ON triples(source_symbol);
            CREATE INDEX IF NOT EXISTS idx_triples_version ON triples(project_version);
        """)
        conn.commit()

        # Auto-migrate: add columns if missing (for existing DBs)
        try:
            conn.execute("SELECT project_version FROM triples LIMIT 1")
        except Exception:
            conn.execute("ALTER TABLE triples ADD COLUMN project_version TEXT")
            conn.commit()
        try:
            conn.execute("SELECT version FROM version_tags LIMIT 1")
        except Exception:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS version_tags (
                    version TEXT PRIMARY KEY,
                    label TEXT,
                    tagged_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    metadata TEXT DEFAULT '{}'
                );
            """)
            conn.commit()

    def _conn(self):
        if self._connection is None:
            self._connection = sqlite3.connect(
                self.db_path, timeout=10, check_same_thread=False
            )
            self._connection.execute("PRAGMA journal_mode=WAL")
            self._connection.row_factory = sqlite3.Row
        return self._connection

    def close(self):
        if self._connection is not None:
            self._connection.close()
            self._connection = None

    def _entity_id(self, name: str) -> str:
        return name.lower().replace(" ", "_").replace("'", "")

    # ── Write operations ──────────────────────────────────────────────────

    def add_entity(self, name: str, entity_type: str = "unknown",
                   properties: dict = None) -> str:
        eid = self._entity_id(name)
        props = json.dumps(properties or {}, ensure_ascii=False)
        conn = self._conn()
        with conn:
            conn.execute(
                "INSERT OR REPLACE INTO entities (id, name, type, properties) "
                "VALUES (?, ?, ?, ?)",
                (eid, name, entity_type, props),
            )
        return eid

    def add_triple(
        self,
        subject: str,
        predicate: str,
        obj: str,
        valid_from: str = None,
        valid_to: str = None,
        confidence: float = 1.0,
        source_symbol: str = None,
    ) -> str:
        """
        Add a relationship triple: subject → predicate → object.
        Automatically creates entities if they don't exist.
        Deduplicates identical active triples.
        """
        sub_id = self._entity_id(subject)
        obj_id = self._entity_id(obj)
        pred = predicate.lower().replace(" ", "_")

        conn = self._conn()
        with conn:
            # Auto-create entities
            conn.execute(
                "INSERT OR IGNORE INTO entities (id, name) VALUES (?, ?)",
                (sub_id, subject),
            )
            conn.execute(
                "INSERT OR IGNORE INTO entities (id, name) VALUES (?, ?)",
                (obj_id, obj),
            )

            # Check for existing identical active triple
            existing = conn.execute(
                "SELECT id FROM triples "
                "WHERE subject=? AND predicate=? AND object=? AND valid_to IS NULL",
                (sub_id, pred, obj_id),
            ).fetchone()

            if existing:
                return existing["id"]

            # Generate triple ID
            ts = datetime.now().isoformat()
            raw = f"{sub_id}{pred}{obj_id}{valid_from}{ts}"
            triple_id = f"t_{hashlib.sha256(raw.encode()).hexdigest()[:16]}"

            conn.execute(
                """INSERT INTO triples
                   (id, subject, predicate, object, valid_from, valid_to,
                    confidence, source_symbol, project_version)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (triple_id, sub_id, pred, obj_id, valid_from, valid_to,
                 confidence, source_symbol, None),
            )
        return triple_id

    def sync_source_facts(
        self,
        source_prefix: str,
        entities: List[Dict[str, Any]],
        facts: List[Dict[str, Any]],
        observed_at: str,
        project_version: str,
    ) -> Dict[str, int]:
        """幂等同步一个来源范围；输入实体、事实和观测时间，更新当前事实并软失效已撤销关系。"""

        if not source_prefix or len(source_prefix) > 96 or not all(
            character.isalnum() or character in "-:" for character in source_prefix
        ):
            raise ValueError("Knowledge graph source prefix is invalid.")
        if len(entities) > 5000 or len(facts) > 10000:
            raise ValueError("Knowledge graph projection exceeds its item budget.")
        conn = self._conn()
        desired: set[tuple[str, str, str, str]] = set()
        normalized_facts: List[tuple[str, str, str, float, str]] = []
        for fact in facts:
            subject_id = self._entity_id(str(fact["subject"]))
            object_id = self._entity_id(str(fact["object"]))
            predicate = str(fact["predicate"]).lower().replace(" ", "_")
            source_symbol = str(fact["source_symbol"])
            if not source_symbol.startswith(source_prefix):
                raise ValueError("Knowledge graph fact is outside its source scope.")
            confidence = max(0.0, min(1.0, float(fact.get("confidence", 1.0))))
            signature = (source_symbol, subject_id, predicate, object_id)
            if signature in desired:
                continue
            desired.add(signature)
            normalized_facts.append((subject_id, predicate, object_id, confidence, source_symbol))

        invalidated = 0
        inserted = 0
        updated = 0
        with conn:
            for entity in entities:
                name = str(entity["name"])
                entity_id = self._entity_id(name)
                entity_type = str(entity.get("type") or "unknown")[:80]
                properties = json.dumps(entity.get("properties") or {}, ensure_ascii=False)
                conn.execute(
                    "INSERT INTO entities (id, name, type, properties) VALUES (?, ?, ?, ?) "
                    "ON CONFLICT(id) DO UPDATE SET name=excluded.name, type=excluded.type, "
                    "properties=excluded.properties",
                    (entity_id, name, entity_type, properties),
                )

            active_rows = conn.execute(
                "SELECT id, subject, predicate, object, source_symbol FROM triples "
                "WHERE valid_to IS NULL AND source_symbol LIKE ?",
                (f"{source_prefix}%",),
            ).fetchall()
            stale_ids = [
                str(row["id"])
                for row in active_rows
                if (
                    str(row["source_symbol"]),
                    str(row["subject"]),
                    str(row["predicate"]),
                    str(row["object"]),
                ) not in desired
            ]
            if stale_ids:
                conn.executemany(
                    "UPDATE triples SET valid_to=? WHERE id=? AND valid_to IS NULL",
                    [(observed_at, triple_id) for triple_id in stale_ids],
                )
                invalidated = len(stale_ids)

            for subject_id, predicate, object_id, confidence, source_symbol in normalized_facts:
                existing = conn.execute(
                    "SELECT id FROM triples WHERE subject=? AND predicate=? AND object=? "
                    "AND source_symbol=? AND valid_to IS NULL",
                    (subject_id, predicate, object_id, source_symbol),
                ).fetchone()
                if existing is not None:
                    conn.execute(
                        "UPDATE triples SET confidence=?, project_version=? WHERE id=?",
                        (confidence, project_version, existing["id"]),
                    )
                    updated += 1
                    continue
                raw = f"{subject_id}{predicate}{object_id}{source_symbol}{observed_at}"
                triple_id = f"t_{hashlib.sha256(raw.encode('utf-8')).hexdigest()[:16]}"
                conn.execute(
                    "INSERT INTO triples (id, subject, predicate, object, valid_from, valid_to, "
                    "confidence, source_symbol, project_version) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)",
                    (
                        triple_id,
                        subject_id,
                        predicate,
                        object_id,
                        observed_at,
                        confidence,
                        source_symbol,
                        project_version,
                    ),
                )
                inserted += 1
        return {
            "active": len(desired),
            "inserted": inserted,
            "updated": updated,
            "invalidated": invalidated,
        }

    def purge_source_facts(self, source_prefix: str) -> int:
        """清理演示来源事实；输入稳定来源前缀，硬删除对应投影并移除孤立实体，返回删除数量。"""

        if not source_prefix or len(source_prefix) > 96 or not all(
            character.isalnum() or character in "-:" for character in source_prefix
        ):
            raise ValueError("Knowledge graph source prefix is invalid.")
        conn = self._conn()
        with conn:
            row = conn.execute(
                "SELECT COUNT(*) AS cnt FROM triples WHERE source_symbol LIKE ?",
                (f"{source_prefix}%",),
            ).fetchone()
            removed = int(row["cnt"])
            conn.execute(
                "DELETE FROM triples WHERE source_symbol LIKE ?",
                (f"{source_prefix}%",),
            )
            conn.execute(
                "DELETE FROM entities WHERE id NOT IN (SELECT subject FROM triples) "
                "AND id NOT IN (SELECT object FROM triples)",
            )
        return removed

    def invalidate(self, subject: str, predicate: str, obj: str,
                   ended: str = None):
        """Mark a relationship as no longer valid (soft-delete)."""
        sub_id = self._entity_id(subject)
        obj_id = self._entity_id(obj)
        pred = predicate.lower().replace(" ", "_")
        ended = ended or date.today().isoformat()

        conn = self._conn()
        with conn:
            conn.execute(
                "UPDATE triples SET valid_to=? "
                "WHERE subject=? AND predicate=? AND object=? AND valid_to IS NULL",
                (ended, sub_id, pred, obj_id),
            )

    # ── Query operations ──────────────────────────────────────────────────

    def query_entity(self, name: str, as_of: str = None,
                     direction: str = "both", limit: int = 50) -> List[Dict]:
        """
        Get all relationships for an entity.
        direction: "outgoing", "incoming", "both"
        as_of: date string — only return facts valid at that time
        """
        eid = self._entity_id(name)
        conn = self._conn()
        results = []

        if direction in ("outgoing", "both"):
            query = (
                "SELECT t.*, e.name as obj_name FROM triples t "
                "JOIN entities e ON t.object = e.id WHERE t.subject = ?"
            )
            params = [eid]
            if as_of:
                query += (" AND (t.valid_from IS NULL OR t.valid_from <= ?)"
                          " AND (t.valid_to IS NULL OR t.valid_to >= ?)")
                params.extend([as_of, as_of])
            query += f" LIMIT {limit}"
            for row in conn.execute(query, params).fetchall():
                results.append({
                    "direction": "outgoing",
                    "subject": name,
                    "predicate": row["predicate"],
                    "object": row["obj_name"],
                    "valid_from": row["valid_from"],
                    "valid_to": row["valid_to"],
                    "confidence": row["confidence"],
                    "source_symbol": row["source_symbol"],
                    "source_type": self._source_type(row["source_symbol"]),
                    "current": row["valid_to"] is None,
                })

        if direction in ("incoming", "both"):
            query = (
                "SELECT t.*, e.name as sub_name FROM triples t "
                "JOIN entities e ON t.subject = e.id WHERE t.object = ?"
            )
            params = [eid]
            if as_of:
                query += (" AND (t.valid_from IS NULL OR t.valid_from <= ?)"
                          " AND (t.valid_to IS NULL OR t.valid_to >= ?)")
                params.extend([as_of, as_of])
            query += f" LIMIT {limit}"
            for row in conn.execute(query, params).fetchall():
                results.append({
                    "direction": "incoming",
                    "subject": row["sub_name"],
                    "predicate": row["predicate"],
                    "object": name,
                    "valid_from": row["valid_from"],
                    "valid_to": row["valid_to"],
                    "confidence": row["confidence"],
                    "source_symbol": row["source_symbol"],
                    "source_type": self._source_type(row["source_symbol"]),
                    "current": row["valid_to"] is None,
                })

        return results

    def format_for_context(self, entity_name: str, max_facts: int = 10) -> str:
        """Format entity facts as compact context for LLM injection."""
        facts = self.query_entity(entity_name, limit=max_facts)
        if not facts:
            return ""
        current = [f for f in facts if f["current"]]
        lines = []
        for f in current[:max_facts]:
            if f["direction"] == "outgoing":
                lines.append(f"• {f['subject']} {f['predicate']} {f['object']}")
            else:
                lines.append(f"• {f['subject']} {f['predicate']} {f['object']}")
            if f.get("valid_from"):
                lines[-1] += f" (since {f['valid_from']})"
        if lines:
            return (f"[Temporal Knowledge — {len(lines)} facts about "
                    f"\"{entity_name}\"]\n" + "\n".join(lines))
        return ""

    # ── Stats ─────────────────────────────────────────────────────────────

    def stats(self) -> Dict:
        conn = self._conn()
        entities = conn.execute(
            "SELECT COUNT(*) as cnt FROM entities"
        ).fetchone()["cnt"]
        triples = conn.execute(
            "SELECT COUNT(*) as cnt FROM triples"
        ).fetchone()["cnt"]
        current = conn.execute(
            "SELECT COUNT(*) as cnt FROM triples WHERE valid_to IS NULL"
        ).fetchone()["cnt"]
        competition = conn.execute(
            "SELECT COUNT(*) as cnt FROM triples WHERE source_symbol LIKE 'goai-comp-%'"
        ).fetchone()["cnt"]
        active_competition = conn.execute(
            "SELECT COUNT(*) as cnt FROM triples "
            "WHERE valid_to IS NULL AND source_symbol LIKE 'goai-comp-%'"
        ).fetchone()["cnt"]
        return {
            "entities": entities,
            "triples": triples,
            "current_facts": current,
            "expired_facts": triples - current,
            "competition_facts": competition,
            "active_competition_facts": active_competition,
        }

    def get_graph(self, limit: int = 200) -> Dict:
        """读取有界知识图谱；输入最大边数，返回公开节点和边，不修改数据库或暴露来源字段。"""
        bounded_limit = max(1, min(int(limit), 500))
        rows = self._conn().execute(
            "SELECT t.id, t.subject, t.predicate, t.object, t.valid_to, t.confidence, t.source_symbol, "
            "es.name AS subject_name, es.type AS subject_type, "
            "eo.name AS object_name, eo.type AS object_type "
            "FROM triples t "
            "JOIN entities es ON t.subject = es.id "
            "JOIN entities eo ON t.object = eo.id "
            "ORDER BY (t.valid_to IS NULL) DESC, t.extracted_at DESC LIMIT ?",
            (bounded_limit,),
        ).fetchall()
        nodes: Dict[str, Dict] = {}
        edges = []
        for row in rows:
            subject_id = str(row["subject"])
            object_id = str(row["object"])
            for entity_id, name, entity_type in (
                (subject_id, row["subject_name"], row["subject_type"]),
                (object_id, row["object_name"], row["object_type"]),
            ):
                if entity_id not in nodes:
                    nodes[entity_id] = {
                        "id": entity_id,
                        "label": str(name),
                        "type": str(entity_type or "unknown"),
                        "degree": 0,
                    }
                nodes[entity_id]["degree"] += 1
            edges.append({
                "id": str(row["id"]),
                "source": subject_id,
                "target": object_id,
                "label": str(row["predicate"]),
                "confidence": max(0.0, min(1.0, float(row["confidence"] or 0))),
                "current": row["valid_to"] is None,
                "source_type": self._source_type(row["source_symbol"]),
            })
        return {"nodes": list(nodes.values()), "edges": edges}

    @staticmethod
    def _source_type(source_symbol: Optional[str]) -> str:
        """归类事实来源；输入内部来源符号，返回不暴露具体 ID 的公开类别。"""

        if source_symbol and str(source_symbol).startswith("goai-comp-"):
            return "competition"
        if source_symbol:
            return "neuro"
        return "manual"

    # ── [P2] Version tags ───────────────────────────────────────

    def tag_version(self, version: str, label: str = "",
                    metadata: dict = None) -> str:
        """
        Tag the current state of the knowledge graph with a version label.
        Also stamps all currently-valid (non-expired) triples with this version.
        """
        conn = self._conn()
        now = datetime.now().isoformat()
        meta = json.dumps(metadata or {}, ensure_ascii=False)

        with conn:
            conn.execute(
                "INSERT OR REPLACE INTO version_tags (version, label, tagged_at, metadata) "
                "VALUES (?, ?, ?, ?)",
                (version, label or version, now, meta),
            )
            # Stamp all current (active) triples with this version
            conn.execute(
                "UPDATE triples SET project_version = ? "
                "WHERE valid_to IS NULL AND (project_version IS NULL OR project_version != ?)",
                (version, version),
            )
        logger.info(f"[TemporalKG] Tagged version: {version}")
        return version

    def get_versions(self) -> List[Dict]:
        """List all version tags."""
        conn = self._conn()
        rows = conn.execute(
            "SELECT * FROM version_tags ORDER BY tagged_at DESC"
        ).fetchall()
        return [dict(r) for r in rows]

    def query_by_version(self, version: str, entity_name: str = None,
                         limit: int = 50) -> List[Dict]:
        """
        Query facts that were tagged with a specific version.
        Optionally filter by entity.
        """
        conn = self._conn()
        if entity_name:
            eid = self._entity_id(entity_name)
            rows = conn.execute(
                "SELECT t.*, es.name as sub_name, eo.name as obj_name "
                "FROM triples t "
                "JOIN entities es ON t.subject = es.id "
                "JOIN entities eo ON t.object = eo.id "
                "WHERE t.project_version = ? AND (t.subject = ? OR t.object = ?) "
                "LIMIT ?",
                (version, eid, eid, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT t.*, es.name as sub_name, eo.name as obj_name "
                "FROM triples t "
                "JOIN entities es ON t.subject = es.id "
                "JOIN entities eo ON t.object = eo.id "
                "WHERE t.project_version = ? LIMIT ?",
                (version, limit),
            ).fetchall()

        return [
            {
                "subject": r["sub_name"],
                "predicate": r["predicate"],
                "object": r["obj_name"],
                "version": r["project_version"],
                "valid_from": r["valid_from"],
                "valid_to": r["valid_to"],
                "confidence": r["confidence"],
            }
            for r in rows
        ]


# ============================================================================
# Global Singleton
# ============================================================================

_temporal_kg: Optional[TemporalKnowledgeGraph] = None


def init_temporal_kg(data_dir: str) -> TemporalKnowledgeGraph:
    """Initialize the global temporal knowledge graph."""
    global _temporal_kg
    db_path = os.path.join(data_dir, "knowledge_graph.db")
    _temporal_kg = TemporalKnowledgeGraph(db_path)
    stats = _temporal_kg.stats()
    logger.info(f"[TemporalKG] Loaded: {stats}")
    return _temporal_kg


def get_temporal_kg() -> Optional[TemporalKnowledgeGraph]:
    """Get the global temporal KG instance (may be None if not initialized)."""
    return _temporal_kg
