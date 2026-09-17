#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.
"""任务图事件投影的实际路由与严格边界；Actual-route and strict-boundary tests for task graph event projection.
Author: maoyo | Department: 研发部 | Date: 2026-09-15 | Version: 1.0.0
Security Level: INTERNAL | Maintainer: maoyo | Email: synapxnet@gmail.com
"""
__version__ = "1.0.0"
__author__ = "maoyo"
__copyright__ = "Copyright 2026 Synapxnet"
__maintainer__ = "maoyo"
__email__ = "synapxnet@gmail.com"

from copy import deepcopy
import tempfile
import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError

from py.competition_knowledge_projection import CompetitionKnowledgeProjectionRequest, ProjectionTaskGraph
from py.enterprise_insights_engine_api import EnterpriseInsightsEngineApi, EnterpriseInsightsEngineDependencies
from py.neuro_bridge_api import SymbolStore
from py.neuro_rules import get_rule_registry
from py.neuro_temporal_kg import TemporalKnowledgeGraph


def graph_payload():
    """构造包含检查点与重分配的真实协议形状；Construct the actual protocol shape with checkpoints and reassignment."""
    return {
        "graphId": "graph-events", "workspaceId": "ws-events", "incidentId": "inc-events", "traceId": "trace-events",
        "revision": 11, "status": "SUCCEEDED", "replanReason": "Previous assignment failed",
        "conflictPolicies": ["RESOURCE_VERSION_WINS"],
        "nodes": [{"nodeId": "evidence:aiops.alert.get", "lane": "EVIDENCE", "title": "Read evidence", "nodeType": "TOOL_CALL",
                   "toolName": "aiops.alert.get", "dependsOn": [], "parallelGroup": None, "timeoutMs": 30000, "maximumAttempts": 2,
                   "assignedRoleCardId": "role-new", "assignedAgentName": "Evidence", "assignmentMode": "REASSIGNMENT", "status": "SUCCEEDED", "evidenceIds": ["ev-one"]}],
        "events": [
            {"eventId": "event-reassignment", "eventType": "TASK_REASSIGNED", "nodeId": "evidence:aiops.alert.get", "attempt": 11,
             "fromRoleCardId": "role-old", "toRoleCardId": "role-new", "reasonCode": "PREVIOUS_ASSIGNEE_FAILED", "evidenceIds": [],
             "checkpointDigest": "a" * 64, "createdAt": "2026-09-15T02:00:00.000Z"},
            {"eventId": "event-checkpoint", "eventType": "CHECKPOINT_SAVED", "nodeId": "evidence:aiops.alert.get", "attempt": 11,
             "fromRoleCardId": None, "toRoleCardId": "role-new", "reasonCode": "SUCCEEDED", "evidenceIds": ["ev-one"],
             "checkpointDigest": "b" * 64, "createdAt": "2026-09-15T02:00:01.000Z"},
        ],
        "createdAt": "2026-09-15T02:00:00.000Z", "updatedAt": "2026-09-15T02:00:01.000Z",
        "completedAt": "2026-09-15T02:00:01.000Z", "crystallizedAt": None,
    }


def request_payload():
    """创建最小合法Incident投影以检查HTTP入口；Create a minimal valid Incident projection for the HTTP boundary."""
    return {
        "schema": "openxnet.competition-knowledge.v1", "projectedAt": "2026-09-15T02:00:01.000Z",
        "incident": {"incidentId": "inc-events", "workspaceId": "ws-events", "title": "Evidence recovery", "summary": "Recovered",
                     "severity": "P1", "status": "RESOLVED", "scenarioType": "feature-drift", "serviceUid": "service-events",
                     "assetUid": "asset-events", "workflowInstanceUid": "workflow-events", "deploymentUid": "deployment-events",
                     "failingRevision": 10, "targetRevision": 11, "createdAt": "2026-09-15T02:00:00.000Z", "updatedAt": "2026-09-15T02:00:01.000Z", "resolvedAt": "2026-09-15T02:00:01.000Z"},
        "taskGraphs": [graph_payload()],
    }


class TaskGraphEventContractTests(unittest.TestCase):
    """验证事件保真、旧请求兼容及有界拒绝；Verify event fidelity, legacy compatibility and bounded rejection."""

    def test_every_existing_event_type_round_trips_without_reordering(self):
        """所有既有事件类型保留原字段和顺序；All existing event types preserve original fields and order."""
        value = graph_payload()
        events = []
        for event_type in ["TASK_ASSIGNED", "CHECKPOINT_SAVED", "WORKER_TIMEOUT", "TASK_FAILED", "TASK_REASSIGNED", "RESOURCE_CONFLICT_DETECTED", "TRACE_RESUMED"]:
            event = {**value["events"][0], "eventId": event_type, "eventType": event_type}
            if event_type == "TRACE_RESUMED":
                event.update(nodeId=None, fromRoleCardId=None)
            events.append(event)
        value["events"] = events
        parsed = ProjectionTaskGraph.model_validate(value)
        self.assertEqual(parsed.model_dump()["events"], events)
        self.assertEqual(parsed.nodes[0].assignmentMode, "REASSIGNMENT")
        self.assertEqual(parsed.events[0].attempt, 11)

    def test_legacy_graph_without_events_keeps_empty_default(self):
        """旧快照无events字段仍可读取；Legacy snapshots without events remain readable."""
        value = graph_payload()
        del value["events"]
        parsed = ProjectionTaskGraph.model_validate(value)
        self.assertEqual(parsed.events, [])

    def test_unknown_graph_and_assignment_fields_remain_rejected(self):
        """补齐既有枚举不放宽未知字段或模式；Adding the existing enum does not loosen unknown fields or modes."""
        for value in [{**graph_payload(), "rawPrompt": "forbidden"}, graph_payload()]:
            if "rawPrompt" not in value:
                value["nodes"][0]["assignmentMode"] = "UNREVIEWED_MODE"
            with self.subTest(unknown=list(value)[-1]):
                with self.assertRaises(ValidationError):
                    ProjectionTaskGraph.model_validate(value)

    def test_invalid_event_contracts_are_rejected(self):
        """非法类型、摘要、身份和次数无法通过严格事件边界；Invalid types, digests, identities and attempts fail the strict event boundary."""
        for changes in [
            {"rawPrompt": "forbidden"}, {"eventType": "EXECUTE_UNREVIEWED"}, {"attempt": 0}, {"attempt": True},
            {"checkpointDigest": "not-a-digest"}, {"eventId": ""}, {"toRoleCardId": ""}, {"evidenceIds": [""]},
        ]:
            with self.subTest(changes=changes):
                value = graph_payload()
                value["events"][0].update(changes)
                with self.assertRaises(ValidationError):
                    ProjectionTaskGraph.model_validate(value)

    def test_missing_required_event_identity_is_rejected(self):
        """缺少事件身份不能变成静默默认事件；Missing event identity cannot become a silent default event."""
        value = graph_payload()
        del value["events"][0]["eventId"]
        with self.assertRaises(ValidationError):
            ProjectionTaskGraph.model_validate(value)

    def test_event_count_boundary_rejects_overflow_without_truncating(self):
        """接受有界完整事件并拒绝溢出，不截断事件；Accept the bounded complete list and reject overflow without truncation."""
        value = graph_payload()
        event = value["events"][0]
        value["events"] = [{**event, "eventId": f"event-{index}"} for index in range(2000)]
        self.assertEqual(len(ProjectionTaskGraph.model_validate(value).events), 2000)
        value["events"].append({**event, "eventId": "event-overflow"})
        with self.assertRaises(ValidationError):
            ProjectionTaskGraph.model_validate(value)
        self.assertEqual(len(value["events"]), 2001)

    def test_event_evidence_reference_boundary_remains_bounded(self):
        """事件证据列表保留100项并拒绝第101项；Preserve 100 event evidence references and reject the 101st."""
        value = graph_payload()
        value["events"][0]["evidenceIds"] = [f"ev-{index}" for index in range(100)]
        self.assertEqual(len(ProjectionTaskGraph.model_validate(value).events[0].evidenceIds), 100)
        value["events"][0]["evidenceIds"].append("ev-overflow")
        with self.assertRaises(ValidationError):
            ProjectionTaskGraph.model_validate(value)


class TaskGraphEventHttpTests(unittest.TestCase):
    """通过真实FastAPI路由与隔离存储验证入口；Verify the actual FastAPI route with isolated stores."""

    def setUp(self):
        """创建独立符号库、图谱和实际私有API路由；Create isolated symbol and graph stores with the actual private API router."""
        self.directory = tempfile.TemporaryDirectory(prefix="openxnet-task-graph-events-")
        self.symbols = SymbolStore(self.directory.name)
        self.graph = TemporalKnowledgeGraph(f"{self.directory.name}/knowledge_graph.db")
        self.api = EnterpriseInsightsEngineApi(EnterpriseInsightsEngineDependencies(get_symbol_store=self.get_symbols, get_temporal_kg=self.get_graph, get_rule_registry=get_rule_registry))
        application = FastAPI()
        application.include_router(self.api.create_router())
        self.client = TestClient(application)

    def get_symbols(self):
        """仅返回本测试符号库；Return only this test's symbol store."""
        return self.symbols

    def get_graph(self):
        """仅返回本测试时序图谱；Return only this test's temporal graph."""
        return self.graph

    def tearDown(self):
        """关闭HTTP客户端及隔离数据库后清理临时目录；Close the HTTP client and isolated database before removing the temporary directory."""
        self.client.close()
        self.graph.close()
        self.directory.cleanup()

    def test_actual_http_route_accepts_events_and_projection_is_idempotent(self):
        """真实HTTP校验通过后符号可查且重复投影无重复事实；After actual HTTP validation symbols are queryable and repeat projection creates no duplicate facts."""
        payload = request_payload()
        original = deepcopy(payload)
        parsed = CompetitionKnowledgeProjectionRequest.model_validate(payload)
        self.assertEqual(parsed.model_dump(by_alias=True)["taskGraphs"][0]["events"], payload["taskGraphs"][0]["events"])
        first = self.client.post("/v1/desktop/enterprise-insights/competition/sync", json=payload)
        self.assertEqual(first.status_code, 200, first.text)
        self.assertGreaterEqual(len(self.symbols.all()), 2)
        self.assertGreater(len(self.graph.query_entity("Incident:inc-events", limit=100)), 0)
        initial_stats = self.graph.stats()
        initial_ids = sorted(item.id for item in self.symbols.all())
        second = self.client.post("/v1/desktop/enterprise-insights/competition/sync", json=payload)
        self.assertEqual(second.status_code, 200, second.text)
        self.assertEqual(self.graph.stats(), initial_stats)
        self.assertEqual(sorted(item.id for item in self.symbols.all()), initial_ids)
        self.assertEqual(payload, original)

    def test_actual_http_route_rejects_unknown_event_field_before_any_write(self):
        """未知事件字段仍在HTTP入口返回422且不写入存储；Unknown event fields still return HTTP 422 before storage writes."""
        payload = request_payload()
        payload["taskGraphs"][0]["events"][0]["rawPrompt"] = "forbidden"
        response = self.client.post("/v1/desktop/enterprise-insights/competition/sync", json=payload)
        self.assertEqual(response.status_code, 422)
        errors = response.json()["detail"]
        self.assertTrue(any(item["type"] == "extra_forbidden" and item["loc"] == ["body", "taskGraphs", 0, "events", 0, "rawPrompt"] for item in errors))
        self.assertEqual(self.symbols.all(), [])
        self.assertEqual(self.graph.query_entity("Incident:inc-events", limit=100), [])


if __name__ == "__main__":
    unittest.main(verbosity=2)
