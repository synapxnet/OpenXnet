# -*- coding: utf-8 -*-
"""Enterprise Insights 私有 Execution Engine API 回归测试。"""

from __future__ import annotations

import tempfile
import unittest

from fastapi import HTTPException

from py.enterprise_insights_engine_api import (
    EmptyRequest,
    EnterpriseInsightsEngineApi,
    EnterpriseInsightsEngineDependencies,
    KnowledgeGraphDashboardRequest,
    KnowledgeGraphEntityRequest,
    NeuroDashboardRequest,
    NeuroSearchRequest,
    NeuroSymbolRequest,
)
from py.competition_knowledge_projection import (
    CompetitionKnowledgeProjectionRequest,
    CompetitionKnowledgePurgeRequest,
)
from py.neuro_bridge_api import NeuroSymbol, SymbolK, SymbolQ, SymbolStore, SymbolVector
from py.neuro_rules import get_rule_registry
from py.neuro_temporal_kg import TemporalKnowledgeGraph


class EnterpriseInsightsEngineApiTests(unittest.IsolatedAsyncioTestCase):
    """验证私有洞察 API 的公开投影、查询和写入边界。"""

    def setUp(self) -> None:
        """创建隔离符号库和知识图谱；无输入，无返回，失败时中止当前测试。"""
        self._temporary_directory = tempfile.TemporaryDirectory(
            prefix="openxnet-enterprise-insights-",
        )
        self._symbols = SymbolStore(self._temporary_directory.name)
        self._symbols.store(NeuroSymbol(
            id="symbol-one",
            operator="CausalInfer",
            label="OpenXnet 架构迁移",
            Q=SymbolQ(),
            K=SymbolK(
                entities=["OpenXnet"],
                externalRefs=["C:\\private\\must-not-return"],
            ),
            z=[SymbolVector(type="weight", key="architecture", value=0.8)],
            activationCount=2,
            successRate=0.9,
        ))
        self._graph = TemporalKnowledgeGraph(
            f"{self._temporary_directory.name}/knowledge_graph.db",
        )
        self._graph.add_triple("OpenXnet", "uses", "Electron", confidence=0.95)
        self._api = EnterpriseInsightsEngineApi(EnterpriseInsightsEngineDependencies(
            get_symbol_store=lambda: self._symbols,
            get_temporal_kg=lambda: self._graph,
            get_rule_registry=get_rule_registry,
        ))

    def tearDown(self) -> None:
        """关闭隔离数据库并删除临时目录；无输入和返回，清理失败交给 unittest 报告。"""
        self._graph.close()
        self._temporary_directory.cleanup()

    def _competition_projection(self, status: str = "AWAITING_APPROVAL") -> CompetitionKnowledgeProjectionRequest:
        """构建确定性比赛投影；输入事件状态，返回包含三 Agent、审批和动作的严格请求。"""

        payload = {
            "schema": "openxnet.competition-knowledge.v1",
            "projectedAt": "2026-08-05T10:10:00.000Z",
            "incident": {
                "incidentId": "inc-demo",
                "workspaceId": "ws-demo",
                "title": "推荐模型线上异常",
                "summary": "数据契约漂移导致错误率升高",
                "severity": "HIGH",
                "status": status,
                "serviceUid": "recommend-service",
                "assetUid": "recommend-features",
                "workflowInstanceUid": "workflow-42",
                "deploymentUid": "recommend-model",
                "failingRevision": 18,
                "targetRevision": 17,
                "createdAt": "2026-08-05T10:00:00.000Z",
                "updatedAt": "2026-08-05T10:10:00.000Z",
                "resolvedAt": "2026-08-05T10:10:00.000Z" if status == "RESOLVED" else None,
            },
            "traces": [{
                "traceId": "trace-demo",
                "status": "SUCCEEDED" if status == "RESOLVED" else "AWAITING_APPROVAL",
                "startedAt": "2026-08-05T10:01:00.000Z",
                "completedAt": "2026-08-05T10:10:00.000Z" if status == "RESOLVED" else None,
            }],
            "teams": [{
                "bindingId": "binding-demo",
                "traceId": "trace-demo",
                "runtime": "agentteams",
                "teamName": "GOAI Team",
                "status": "READY",
                "teamTemplateId": "template-demo",
                "teamTemplateVersion": 1,
                "members": [
                    {"roleCardId": "role-worker", "name": "Evidence Agent", "department": "AIOps", "teamRole": "worker"},
                    {"roleCardId": "role-leader", "name": "Commander", "department": "Governance", "teamRole": "leader"},
                    {"roleCardId": "role-verifier", "name": "Verifier", "department": "Quality", "teamRole": "verifier"},
                ],
            }],
            "decisions": [
                {
                    "decisionId": "decision-plan",
                    "taskId": "task-plan",
                    "bindingId": "binding-demo",
                    "traceId": "trace-demo",
                    "stage": "INVESTIGATION_PLAN",
                    "teamName": "GOAI Team",
                    "roleCardId": "role-worker",
                    "agentName": "Evidence Agent",
                    "teamRole": "worker",
                    "decision": "COLLECT_EVIDENCE",
                    "summary": "覆盖三个平台采集九项证据",
                    "confidence": 0.92,
                    "requestedToolNames": ["aiops.alert.get", "dataops.lineage.get", "mlops.deployment.get"],
                    "evidenceIds": [],
                    "skillName": "goai-evidence-collect",
                    "skillVersion": "1.0.0",
                    "outputDigest": "sha256:plan",
                    "routedByRoleCardId": "role-leader",
                    "routedByName": "Commander",
                    "createdAt": "2026-08-05T10:02:00.000Z",
                },
                {
                    "decisionId": "decision-conclusion",
                    "taskId": "task-conclusion",
                    "bindingId": "binding-demo",
                    "traceId": "trace-demo",
                    "stage": "INVESTIGATION_CONCLUSION",
                    "teamName": "GOAI Team",
                    "roleCardId": "role-leader",
                    "agentName": "Commander",
                    "teamRole": "leader",
                    "decision": "REQUEST_APPROVAL",
                    "summary": "证据一致指向契约漂移，申请受控回滚",
                    "confidence": 0.96,
                    "requestedToolNames": [],
                    "evidenceIds": ["ev-aiops", "ev-dataops"],
                    "skillName": "goai-change-execute",
                    "skillVersion": "1.0.0",
                    "outputDigest": "sha256:conclusion",
                    "routedByRoleCardId": None,
                    "routedByName": None,
                    "createdAt": "2026-08-05T10:05:00.000Z",
                },
                {
                    "decisionId": "decision-verify",
                    "taskId": "task-verify",
                    "bindingId": "binding-demo",
                    "traceId": "trace-demo",
                    "stage": "VERIFICATION_CONCLUSION",
                    "teamName": "GOAI Team",
                    "roleCardId": "role-verifier",
                    "agentName": "Verifier",
                    "teamRole": "verifier",
                    "decision": "CLOSE",
                    "summary": "探针、服务和工作负载均恢复",
                    "confidence": 0.99,
                    "requestedToolNames": [],
                    "evidenceIds": ["ev-verify"],
                    "skillName": "goai-service-verify",
                    "skillVersion": "1.0.0",
                    "outputDigest": "sha256:verify",
                    "routedByRoleCardId": "role-leader",
                    "routedByName": "Commander",
                    "createdAt": "2026-08-05T10:09:00.000Z",
                },
            ],
            "invocations": [{
                "invocationId": "invoke-aiops",
                "traceId": "trace-demo",
                "actorId": "agentteams:role-worker",
                "toolName": "aiops.alert.get",
                "platform": "aiops",
                "status": "SUCCEEDED",
                "evidenceId": "ev-aiops",
                "actionId": None,
                "errorCode": None,
                "startedAt": "2026-08-05T10:02:00.000Z",
                "completedAt": "2026-08-05T10:02:01.000Z",
            }],
            "evidence": [
                {
                    "evidenceId": "ev-aiops",
                    "traceId": "trace-demo",
                    "toolName": "aiops.alert.get",
                    "platform": "aiops",
                    "summary": "错误率超过阈值",
                    "resourceVersion": "42",
                    "observedAt": "2026-08-05T10:02:01.000Z",
                    "contentDigest": "sha256:evidence-one",
                },
                {
                    "evidenceId": "ev-dataops",
                    "traceId": "trace-demo",
                    "toolName": "dataops.lineage.get",
                    "platform": "dataops",
                    "summary": "上游 Schema 已变化",
                    "resourceVersion": "18",
                    "observedAt": "2026-08-05T10:03:00.000Z",
                    "contentDigest": "sha256:evidence-two",
                },
                {
                    "evidenceId": "ev-verify",
                    "traceId": "trace-demo",
                    "toolName": "mlops.inference.probe",
                    "platform": "mlops",
                    "summary": "独立探针通过",
                    "resourceVersion": "17",
                    "observedAt": "2026-08-05T10:09:00.000Z",
                    "contentDigest": "sha256:evidence-three",
                },
            ],
            "approvals": [{
                "approvalId": "approval-demo",
                "traceId": "trace-demo",
                "toolName": "mlops.deployment.rollback",
                "resourceId": "recommend-model",
                "targetRevision": 17,
                "expectedResourceVersion": "42",
                "planId": "feature-drift-full-recovery-v2",
                "planDigest": "a" * 64,
                "scopes": [{
                    "stepId": "risk-deployment-rollback",
                    "toolName": "mlops.deployment.rollback",
                    "resourceId": "recommend-model",
                    "targetRevision": 17,
                    "expectedResourceVersion": "42",
                    "compensation": False,
                }],
                "status": "APPROVED",
                "requestedBy": "agentteams:role-leader",
                "requestedAt": "2026-08-05T10:05:00.000Z",
                "decidedBy": "human-approver",
                "decidedAt": "2026-08-05T10:06:00.000Z",
            }],
            "actions": [{
                "actionId": "action-demo",
                "traceId": "trace-demo",
                "approvalId": "approval-demo",
                "toolName": "mlops.deployment.rollback",
                "resourceId": "recommend-model",
                "planId": "feature-drift-full-recovery-v2",
                "planTitle": "跨域漂移完整恢复计划",
                "planDigest": "a" * 64,
                "deploymentUid": "recommend-model",
                "fromRevision": 18,
                "targetRevision": 17,
                "status": "SUCCEEDED" if status == "RESOLVED" else "RUNNING",
                "stage": "COMPLETED" if status == "RESOLVED" else "VERIFYING",
                "executedBy": "release-operator",
                "steps": [{
                    "stepId": "risk-deployment-rollback",
                    "sequence": 1,
                    "title": "回滚模型部署",
                    "phase": "RELEASE",
                    "toolName": "mlops.deployment.rollback",
                    "platform": "mlops",
                    "status": "SUCCEEDED" if status == "RESOLVED" else "RUNNING",
                    "evidenceId": "ev-verify" if status == "RESOLVED" else None,
                    "resourceVersionBefore": "42",
                    "resourceVersionAfter": "43" if status == "RESOLVED" else "",
                }],
                "compensationStatus": "NOT_REQUIRED",
                "compensationSteps": [],
                "verificationEvidenceIds": ["ev-verify"] if status == "RESOLVED" else [],
                "errorCode": None,
                "createdAt": "2026-08-05T10:07:00.000Z",
                "completedAt": "2026-08-05T10:10:00.000Z" if status == "RESOLVED" else None,
            }],
            "receipts": [{
                "receiptId": "receipt-demo",
                "traceId": "trace-demo",
                "toolName": "mlops.deployment.rollback",
                "actorId": "release-operator",
                "approvalId": "approval-demo",
                "resourceVersionBefore": "18",
                "resourceVersionAfter": "17",
                "outcome": "SUCCEEDED" if status == "RESOLVED" else "ACCEPTED",
                "recordedAt": "2026-08-05T10:08:00.000Z",
            }],
            "retrospective": {
                "name": "retrospective-inc-demo",
                "exportedAt": "2026-08-05T10:11:00.000Z",
            } if status == "RESOLVED" else None,
        }
        return CompetitionKnowledgeProjectionRequest.model_validate(payload)

    async def test_neuro_dashboard_search_and_maintenance_are_bounded(self) -> None:
        """验证认知面板、纯读取搜索和维护结果不泄露外部引用。"""
        dashboard = await self._api.neuro_dashboard(NeuroDashboardRequest(limit=10))
        self.assertEqual(dashboard["stats"]["uniqueEntities"], 1)
        self.assertEqual(dashboard["stats"]["operatorDistribution"], {"CausalInfer": 1})
        self.assertNotIn("externalRefs", str(dashboard["symbols"]))
        self.assertGreaterEqual(len(dashboard["rules"]), 3)

        searched = await self._api.neuro_search(NeuroSearchRequest(
            query="架构",
            operator="CausalInfer",
            limit=10,
        ))
        self.assertEqual(searched["total"], 1)
        self.assertEqual(self._symbols.get("symbol-one").activationCount, 2)

        maintained = await self._api.neuro_maintenance(EmptyRequest())
        self.assertEqual(maintained["result"]["decayed"], 1)
        self.assertEqual(self._symbols.get("symbol-one").activationCount, 1)

    async def test_neuro_remove_protects_rules_and_removes_regular_symbols(self) -> None:
        """验证普通符号可删除而内置规则 ID 在写入前被拒绝。"""
        with self.assertRaises(HTTPException):
            await self._api.neuro_remove(NeuroSymbolRequest(
                symbol_id="rule-temporal-knowledge-v1",
            ))
        removed = await self._api.neuro_remove(NeuroSymbolRequest(symbol_id="symbol-one"))
        self.assertEqual(removed["symbolId"], "symbol-one")
        self.assertIsNone(self._symbols.get("symbol-one"))

    async def test_knowledge_graph_dashboard_and_query_hide_internal_sources(self) -> None:
        """验证知识图谱返回有界节点、边和脱敏事实。"""
        dashboard = await self._api.knowledge_graph_dashboard(
            KnowledgeGraphDashboardRequest(limit=20),
        )
        self.assertEqual(dashboard["stats"]["entities"], 2)
        self.assertEqual(dashboard["stats"]["active_triples"], 1)
        self.assertEqual(len(dashboard["graph"]["nodes"]), 2)
        self.assertEqual(len(dashboard["graph"]["edges"]), 1)

        queried = await self._api.knowledge_graph_query(
            KnowledgeGraphEntityRequest(subject="OpenXnet", limit=20),
        )
        self.assertEqual(queried["facts"][0]["object"], "Electron")
        self.assertNotIn("source_symbol", queried["facts"][0])

    async def test_competition_projection_is_visible_idempotent_and_purgeable(self) -> None:
        """验证比赛决策形成神经符号和图谱，重放不重复，重置不影响普通知识。"""

        first = await self._api.competition_knowledge_sync(
            self._competition_projection(),
        )
        self.assertEqual(first["symbols"], 6)
        dashboard = await self._api.neuro_dashboard(NeuroDashboardRequest(limit=20))
        competition_symbols = [
            item for item in dashboard["symbols"]
            if item["metadata"]["sourceType"] == "competition"
        ]
        self.assertEqual(len(competition_symbols), 6)
        self.assertEqual(
            {item["operator"] for item in competition_symbols if item["metadata"]["recordType"] == "agent_decision"},
            {"PlanDecompose", "CausalInfer", "ValidateOutput"},
        )
        self.assertNotIn("contentDigest", str(competition_symbols))
        with self.assertRaises(HTTPException):
            await self._api.neuro_remove(NeuroSymbolRequest(
                symbol_id=competition_symbols[0]["id"],
            ))

        resolved = await self._api.competition_knowledge_sync(
            self._competition_projection(status="RESOLVED"),
        )
        self.assertEqual(resolved["symbols"], 7)
        graph = await self._api.knowledge_graph_dashboard(
            KnowledgeGraphDashboardRequest(limit=500),
        )
        competition_edges = [
            edge for edge in graph["graph"]["edges"]
            if edge["source_type"] == "competition" and edge["current"]
        ]
        self.assertTrue(any(edge["label"] == "has_decision" for edge in competition_edges))
        self.assertTrue(any(edge["label"] == "authorizes_plan" for edge in competition_edges))
        self.assertTrue(any(edge["label"] == "has_execution_step" for edge in competition_edges))
        self.assertGreater(graph["stats"]["active_competition_triples"], 0)
        self.assertGreater(graph["stats"]["expired_triples"], 0)

        purge = CompetitionKnowledgePurgeRequest.model_validate({
            "schema": "openxnet.competition-knowledge.v1",
            "projections": [{"workspaceId": "ws-demo", "incidentId": "inc-demo"}],
        })
        removed = await self._api.competition_knowledge_purge(purge)
        self.assertGreater(removed["symbols"], 0)
        after = await self._api.neuro_dashboard(NeuroDashboardRequest(limit=20))
        self.assertEqual(after["stats"]["competitionSymbols"], 0)
        self.assertIsNotNone(self._symbols.get("symbol-one"))
        remaining_graph = await self._api.knowledge_graph_dashboard(
            KnowledgeGraphDashboardRequest(limit=20),
        )
        self.assertEqual(remaining_graph["stats"]["competition_triples"], 0)
        self.assertEqual(remaining_graph["stats"]["triples"], 1)

    async def test_dynamic_task_graph_and_candidate_reasoning_are_projected(self) -> None:
        """验证动态任务图和多候选裁决同时形成神经符号与可查询图谱关系。"""

        payload = self._competition_projection().model_dump(by_alias=True)
        payload["taskGraphs"] = [{
            "graphId": "graph-demo",
            "workspaceId": "ws-demo",
            "incidentId": "inc-demo",
            "traceId": "trace-demo",
            "revision": 1,
            "status": "AWAITING_APPROVAL",
            "replanReason": None,
            "conflictPolicies": ["RESOURCE_VERSION_WINS", "HUMAN_APPROVAL_ON_CONFLICT"],
            "nodes": [{
                "nodeId": "evidence:aiops.alert.get",
                "lane": "EVIDENCE",
                "title": "读取告警证据",
                "nodeType": "TOOL_CALL",
                "toolName": "aiops.alert.get",
                "dependsOn": ["route-agent-team"],
                "parallelGroup": "parallel-evidence",
                "timeoutMs": 30000,
                "maximumAttempts": 2,
                "status": "SUCCEEDED",
                "evidenceIds": ["ev-aiops"],
            }],
            "createdAt": "2026-08-05T10:01:00.000Z",
            "updatedAt": "2026-08-05T10:05:00.000Z",
            "completedAt": None,
            "crystallizedAt": None,
        }]
        payload["reasoningDecisions"] = [{
            "reasoningId": "reasoning-plan",
            "workspaceId": "ws-demo",
            "incidentId": "inc-demo",
            "traceId": "trace-demo",
            "decisionType": "PLAN_SELECTION",
            "retrievalMode": "ONLINE_HYBRID_RAG_KG",
            "query": "推荐模型异常受控恢复",
            "knowledgeRefs": [{
                "subject": "Incident:inc-old",
                "predicate": "crystallized_as_skill",
                "object": "Skill:synapxnet-recommendation-capacity-recovery",
                "confidence": 0.98,
            }],
            "candidates": [
                {
                    "candidateId": "plan:governed",
                    "candidateType": "PLAN",
                    "title": "完整受治理计划",
                    "skillId": "synapxnet-recommendation-capacity-recovery",
                    "strategyId": "governed-full-closure",
                    "semanticScore": 1.0,
                    "graphScore": 0.8,
                    "evidenceScore": 1.0,
                    "safetyScore": 1.0,
                    "totalScore": 1.0,
                    "eligible": True,
                    "authorityLevel": "NSX-4",
                    "riskClass": "RK-2",
                    "evidenceGrade": "EV-2",
                    "policyDecision": "APPROVAL_REQUIRED",
                    "ruleCodes": ["HUMAN_APPROVAL_REQUIRED", "END_TO_END_CLOSURE_REQUIRED"],
                    "ruleReasons": ["完整闭环必须审批。"],
                },
                {
                    "candidateId": "plan:direct-write",
                    "candidateType": "PLAN",
                    "title": "直接写入",
                    "skillId": None,
                    "strategyId": "direct-write",
                    "semanticScore": 0.8,
                    "graphScore": 0.0,
                    "evidenceScore": 1.0,
                    "safetyScore": 0.0,
                    "totalScore": 0.47,
                    "eligible": False,
                    "authorityLevel": "NSX-4",
                    "riskClass": "RK-2",
                    "evidenceGrade": "EV-2",
                    "policyDecision": "DENY",
                    "ruleCodes": ["PRODUCTION_GUARD_MISSING"],
                    "ruleReasons": ["缺少回滚和幂等边界。"],
                },
            ],
            "selectedCandidateId": "plan:governed",
            "explanation": "完整计划通过符号硬门。",
            "createdAt": "2026-08-05T10:05:00.000Z",
        }]
        result = await self._api.competition_knowledge_sync(
            CompetitionKnowledgeProjectionRequest.model_validate(payload),
        )
        self.assertEqual(result["symbols"], 8)
        dashboard = await self._api.neuro_dashboard(NeuroDashboardRequest(limit=20))
        record_types = {
            item["metadata"]["recordType"]
            for item in dashboard["symbols"]
            if item["metadata"]["sourceType"] == "competition"
        }
        self.assertIn("task_graph", record_types)
        self.assertIn("reasoning_decision", record_types)
        graph = await self._api.knowledge_graph_dashboard(KnowledgeGraphDashboardRequest(limit=500))
        labels = {
            edge["label"] for edge in graph["graph"]["edges"]
            if edge["source_type"] == "competition" and edge["current"]
        }
        self.assertIn("has_task_graph", labels)
        self.assertIn("depends_on_task_node", labels)
        self.assertIn("selected_candidate", labels)
        self.assertIn("evaluated_by_rule", labels)


if __name__ == "__main__":
    unittest.main()
