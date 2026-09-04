# -*- coding: utf-8 -*-
"""Regression tests for the OpenXnet SynapXnet Memory V3 adapter."""

from __future__ import annotations

import copy
import json
from pathlib import Path
import tempfile
import unittest

from py.memory.synapxnet_v3_runtime import SynapXnetMemoryV3Runtime
from synapxnet_memory.contracts import canonical_json_sha256


def create_request(**overrides):
    request = {
        "ownerAgent": "agent-owner",
        "actorAgent": "agent-owner",
        "taskId": "task-one",
        "title": "Deployment rule",
        "content": "Use the verified production release procedure.",
        "qualityScore": 0.9,
        "permissions": [],
        "tags": ["release", "verified"],
        "source": "manual",
    }
    request.update(overrides)
    return request


class SynapXnetMemoryV3RuntimeTests(unittest.TestCase):
    """Verify version, permission, migration and integrity invariants."""

    def setUp(self) -> None:
        self._temporary = tempfile.TemporaryDirectory(prefix="openxnet-memory-v3-")
        self.runtime = SynapXnetMemoryV3Runtime(Path(self._temporary.name))

    def tearDown(self) -> None:
        self._temporary.cleanup()

    def test_private_by_default_and_explicitly_shareable(self) -> None:
        created = self.runtime.create_memory(create_request())
        owner_list = self.runtime.list_memories(
            {"requesterAgent": "agent-owner", "query": "", "ownerAgent": "", "includeRetired": False, "limit": 20}
        )
        other_list = self.runtime.list_memories(
            {"requesterAgent": "agent-other", "query": "", "ownerAgent": "", "includeRetired": False, "limit": 20}
        )
        self.assertEqual(owner_list["count"], 1)
        self.assertEqual(other_list["count"], 0)

        shared = self.runtime.edit_memory(
            {
                "memoryId": created["memoryId"],
                "baseVersion": created["version"],
                "actorAgent": "agent-owner",
                "title": created["title"],
                "content": created["content"],
                "qualityScore": created["qualityScore"],
                "permissions": ["agent-other"],
                "tags": created["tags"],
                "reason": "Share with the reviewer.",
            }
        )
        history = self.runtime.get_history(
            {"memoryId": created["memoryId"], "requesterAgent": "agent-other"}
        )
        self.assertEqual(shared["version"], 2)
        self.assertEqual(len(history["versions"]), 2)

    def test_edit_conflict_and_rollback_append_new_versions(self) -> None:
        created = self.runtime.create_memory(create_request())
        edited = self.runtime.edit_memory(
            {
                "memoryId": created["memoryId"],
                "baseVersion": 1,
                "actorAgent": "agent-owner",
                "title": "Deployment rule revised",
                "content": "Use the signed and verified release procedure.",
                "qualityScore": 0.95,
                "permissions": [],
                "tags": ["release"],
                "reason": "Clarify signature requirements.",
            }
        )
        with self.assertRaisesRegex(RuntimeError, "changed after"):
            self.runtime.edit_memory(
                {
                    "memoryId": created["memoryId"],
                    "baseVersion": 1,
                    "actorAgent": "agent-owner",
                    "title": "Stale edit",
                    "content": "This write must be rejected.",
                    "qualityScore": 0.5,
                    "permissions": [],
                    "tags": [],
                    "reason": "",
                }
            )
        rolled_back = self.runtime.rollback_memory(
            {
                "memoryId": created["memoryId"],
                "targetVersion": 1,
                "actorAgent": "agent-owner",
                "reason": "The revision was not approved.",
            }
        )
        self.assertEqual((created["version"], edited["version"], rolled_back["version"]), (1, 2, 3))
        self.assertEqual(rolled_back["content"], created["content"])
        history = self.runtime.get_history(
            {"memoryId": created["memoryId"], "requesterAgent": "agent-owner"}
        )
        self.assertEqual([item["version"] for item in history["versions"]], [3, 2, 1])

    def test_transfer_round_trip_and_manifest_tampering(self) -> None:
        created = self.runtime.create_memory(create_request(permissions=["agent-reviewer"]))
        document = self.runtime.export_memories(
            {"requesterAgent": "agent-reviewer", "memoryIds": [created["memoryId"]]}
        )
        tampered = copy.deepcopy(document)
        tampered["entries"][0]["taskId"] = "changed-task"
        with self.assertRaisesRegex(ValueError, "integrity"):
            self.runtime.import_memories(
                {"actorAgent": "agent-importer", "targetOwnerAgent": "agent-importer", "document": tampered}
            )

        imported = self.runtime.import_memories(
            {"actorAgent": "agent-importer", "targetOwnerAgent": "agent-importer", "document": document}
        )
        self.assertEqual(len(imported["imported"]), 1)
        self.assertEqual(imported["skipped"], 0)
        repeated = self.runtime.import_memories(
            {"actorAgent": "agent-importer", "targetOwnerAgent": "agent-importer", "document": document}
        )
        rotated_manifest = copy.deepcopy(document)
        rotated_manifest["exportedAtUtc"] = "2026-09-03T00:00:00+00:00"
        rotated_manifest["manifestSha256"] = canonical_json_sha256(
            {key: value for key, value in rotated_manifest.items() if key != "manifestSha256"}
        )
        rotated = self.runtime.import_memories(
            {
                "actorAgent": "agent-importer",
                "targetOwnerAgent": "agent-importer",
                "document": rotated_manifest,
            }
        )
        self.assertEqual(len(repeated["imported"]), 0)
        self.assertEqual(repeated["skipped"], 1)
        self.assertEqual(len(rotated["imported"]), 0)
        self.assertEqual(rotated["skipped"], 1)
        importer_list = self.runtime.list_memories(
            {"requesterAgent": "agent-importer", "query": "", "ownerAgent": "agent-importer", "includeRetired": False, "limit": 20}
        )
        self.assertEqual(importer_list["count"], 1)
        history = self.runtime.get_history(
            {"memoryId": imported["imported"][0]["memoryId"], "requesterAgent": "agent-importer"}
        )
        self.assertEqual(len(history["versions"]), 1)

    def test_bundled_goai_staging_transfer_is_complete_and_idempotent(self) -> None:
        """导入真实复赛迁移包两次，确认四类记忆只生成一组可信版本。"""

        transfer_path = Path(__file__).resolve().parents[1] / "data" / "goai-staging-memory-transfer.v1.json"
        document = json.loads(transfer_path.read_text(encoding="utf-8"))
        first = self.runtime.import_memories(
            {
                "actorAgent": "openxnet-model",
                "targetOwnerAgent": "openxnet-model",
                "document": document,
            }
        )
        second = self.runtime.import_memories(
            {
                "actorAgent": "openxnet-model",
                "targetOwnerAgent": "openxnet-model",
                "document": document,
            }
        )
        listing = self.runtime.list_memories(
            {
                "requesterAgent": "openxnet-model",
                "query": "",
                "ownerAgent": "openxnet-model",
                "includeRetired": False,
                "limit": 20,
            }
        )
        verification = self.runtime.verify_integrity(
            {"requesterAgent": "openxnet-model", "memoryId": ""}
        )

        memory_types = {item["memoryType"] for item in listing["items"]}
        self.assertEqual(len(first["imported"]), 12)
        self.assertEqual(first["skipped"], 0)
        self.assertEqual(len(second["imported"]), 0)
        self.assertEqual(second["skipped"], 12)
        self.assertEqual(listing["count"], 12)
        self.assertEqual(memory_types, {"skill", "incident", "collaboration", "decision"})
        self.assertEqual(self.runtime.status()["tiers"]["longTerm"]["versions"], 12)
        self.assertTrue(verification["healthy"])

    def test_integrity_and_tier_overview(self) -> None:
        self.runtime.create_memory(create_request())
        event = self.runtime.append_short_term_event(
            {
                "sessionId": "session-one",
                "requesterAgent": "agent-owner",
                "input": "Remember this request.",
                "output": "Acknowledged.",
                "tokenCount": 8,
                "ttlSeconds": 3600,
            }
        )
        self.assertTrue(event["eventId"])
        verified = self.runtime.verify_integrity(
            {"requesterAgent": "agent-owner", "memoryId": ""}
        )
        overview = self.runtime.status()
        self.assertTrue(verified["healthy"])
        self.assertEqual(overview["tiers"]["longTerm"]["memories"], 1)
        self.assertEqual(overview["tiers"]["shortTerm"]["events"], 1)
        self.assertTrue(overview["auditHealthy"])

    def test_recall_is_permission_filtered_ranked_and_bounded(self) -> None:
        self.runtime.create_memory(create_request(content="Release only from a signed artifact."))
        shared = self.runtime.create_memory(
            create_request(
                taskId="task-shared",
                title="Shared release checklist",
                content="Verify the signed release artifact before deployment.",
                permissions=["agent-reviewer"],
            )
        )
        recalled = self.runtime.recall_memories(
            {
                "requesterAgent": "agent-reviewer",
                "query": "signed release artifact",
                "taskId": "task-shared",
                "requiredTags": ["release"],
                "limit": 4,
                "maximumCharacters": 256,
            }
        )

        self.assertEqual(recalled["count"], 1)
        self.assertEqual(recalled["items"][0]["memoryId"], shared["memoryId"])
        self.assertLessEqual(len(recalled["items"][0]["content"]), 256)
        self.assertTrue(self.runtime.verify_audit_chain())

    def test_recall_matches_paraphrased_chinese_queries(self) -> None:
        """Recall CJK memory when the query is a sentence rather than an exact phrase."""

        created = self.runtime.create_memory(
            create_request(
                title="本地模型记忆召回基线",
                content="本次联调的唯一记忆标识是 SKILL_MEMORY_ANCHOR_20260901。",
                permissions=["agent-reviewer"],
                tags=["本地模型", "记忆"],
            )
        )
        recalled = self.runtime.recall_memories(
            {
                "requesterAgent": "agent-reviewer",
                "query": "本次本地模型联调的唯一记忆标识是什么？只回答标识。",
                "taskId": "conversation-one",
                "requiredTags": [],
                "limit": 4,
                "maximumCharacters": 512,
            }
        )

        self.assertEqual(recalled["count"], 1)
        self.assertEqual(recalled["items"][0]["memoryId"], created["memoryId"])


if __name__ == "__main__":
    unittest.main()
