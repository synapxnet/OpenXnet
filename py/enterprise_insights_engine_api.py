# -*- coding: utf-8 -*-
"""Desktop Enterprise Insights 使用的私有 Execution Engine API。"""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, FastAPI, HTTPException
from pydantic import BaseModel, Field

from py.competition_knowledge_projection import (
    COMPETITION_KNOWLEDGE_SCHEMA,
    CompetitionKnowledgeProjectionRequest,
    CompetitionKnowledgeProjector,
    CompetitionKnowledgePurgeRequest,
)


ENTERPRISE_INSIGHTS_SCHEMA = "openxnet.enterprise-insights.v1"
ENTERPRISE_INSIGHTS_ENGINE_PATHS = frozenset({
    "/v1/desktop/enterprise-insights/neuro/dashboard",
    "/v1/desktop/enterprise-insights/neuro/search",
    "/v1/desktop/enterprise-insights/neuro/remove",
    "/v1/desktop/enterprise-insights/neuro/maintenance",
    "/v1/desktop/enterprise-insights/kg/dashboard",
    "/v1/desktop/enterprise-insights/kg/query",
    "/v1/desktop/enterprise-insights/competition/sync",
    "/v1/desktop/enterprise-insights/competition/purge",
})


class EmptyRequest(BaseModel):
    """表示不接受额外字段的空请求。"""

    model_config = {"extra": "forbid"}


class NeuroDashboardRequest(BaseModel):
    """约束认知符号面板的最大返回数量。"""

    model_config = {"extra": "forbid"}
    limit: int = Field(default=100, ge=1, le=200)


class NeuroSearchRequest(BaseModel):
    """约束认知符号文本、算子和数量查询。"""

    model_config = {"extra": "forbid"}
    query: str = Field(default="", max_length=512)
    operator: str = Field(default="", max_length=80)
    limit: int = Field(default=50, ge=1, le=100)


class NeuroSymbolRequest(BaseModel):
    """约束一个稳定认知符号标识。"""

    model_config = {"extra": "forbid"}
    symbol_id: str = Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$")


class KnowledgeGraphDashboardRequest(BaseModel):
    """约束知识图谱可视化的最大边数量。"""

    model_config = {"extra": "forbid"}
    limit: int = Field(default=200, ge=1, le=500)


class KnowledgeGraphEntityRequest(BaseModel):
    """约束知识图谱实体查询文本和结果数量。"""

    model_config = {"extra": "forbid"}
    subject: str = Field(min_length=1, max_length=256)
    limit: int = Field(default=50, ge=1, le=100)


@dataclass(frozen=True)
class EnterpriseInsightsEngineDependencies:
    """声明私有企业洞察 API 所需的三个运行时 getter。"""

    get_symbol_store: Callable[[], Any]
    get_temporal_kg: Callable[[], Any]
    get_rule_registry: Callable[[], Any]


class EnterpriseInsightsEngineApi:
    """通过固定路由公开脱敏认知符号和时序知识图谱操作。"""

    def __init__(self, dependencies: EnterpriseInsightsEngineDependencies) -> None:
        """创建私有 API；输入 getter，仅保存依赖，不提前访问存储。"""

        self._dependencies = dependencies
        self._projection_lock = asyncio.Lock()

    def create_router(self) -> APIRouter:
        """创建八条固定 POST 路由；无输入，返回 Router，不执行存储操作。"""

        router = APIRouter()
        router.add_api_route(
            "/v1/desktop/enterprise-insights/neuro/dashboard",
            self.neuro_dashboard,
            methods=["POST"],
        )
        router.add_api_route(
            "/v1/desktop/enterprise-insights/neuro/search",
            self.neuro_search,
            methods=["POST"],
        )
        router.add_api_route(
            "/v1/desktop/enterprise-insights/neuro/remove",
            self.neuro_remove,
            methods=["POST"],
        )
        router.add_api_route(
            "/v1/desktop/enterprise-insights/neuro/maintenance",
            self.neuro_maintenance,
            methods=["POST"],
        )
        router.add_api_route(
            "/v1/desktop/enterprise-insights/kg/dashboard",
            self.knowledge_graph_dashboard,
            methods=["POST"],
        )
        router.add_api_route(
            "/v1/desktop/enterprise-insights/kg/query",
            self.knowledge_graph_query,
            methods=["POST"],
        )
        router.add_api_route(
            "/v1/desktop/enterprise-insights/competition/sync",
            self.competition_knowledge_sync,
            methods=["POST"],
        )
        router.add_api_route(
            "/v1/desktop/enterprise-insights/competition/purge",
            self.competition_knowledge_purge,
            methods=["POST"],
        )
        return router

    async def neuro_dashboard(self, request: NeuroDashboardRequest) -> Dict[str, Any]:
        """读取认知符号面板；输入数量限制，返回脱敏统计、符号和规则，不修改符号。"""

        store = self._require_component(self._dependencies.get_symbol_store(), "NeuroSymbol")
        registry = self._require_component(self._dependencies.get_rule_registry(), "NeuroRule")
        symbols = sorted(store.all(), key=lambda item: float(item.createdAt), reverse=True)
        stats = self._public_neuro_stats(store.get_stats())
        rules = registry.to_dict().get("rules", [])
        return {
            "schema": ENTERPRISE_INSIGHTS_SCHEMA,
            "success": True,
            "stats": stats,
            "symbols": [self._public_symbol(item) for item in symbols[: request.limit]],
            "total": len(symbols),
            "rules": [self._public_rule(item) for item in rules[:100]],
        }

    async def neuro_search(self, request: NeuroSearchRequest) -> Dict[str, Any]:
        """搜索认知符号；输入文本、算子和数量，返回纯读取结果，不增加 activationCount。"""

        store = self._require_component(self._dependencies.get_symbol_store(), "NeuroSymbol")
        query = request.query.strip().casefold()
        operator = request.operator.strip()
        matches = []
        for symbol in store.all():
            if operator and str(symbol.operator) != operator:
                continue
            searchable = " ".join([
                str(symbol.label),
                *[str(entity) for entity in getattr(symbol.K, "entities", [])],
            ]).casefold()
            if query and query not in searchable:
                continue
            matches.append(symbol)
        matches.sort(key=lambda item: float(item.createdAt), reverse=True)
        return {
            "schema": ENTERPRISE_INSIGHTS_SCHEMA,
            "success": True,
            "symbols": [self._public_symbol(item) for item in matches[: request.limit]],
            "total": len(matches),
        }

    async def neuro_remove(self, request: NeuroSymbolRequest) -> Dict[str, Any]:
        """删除一个普通认知符号；输入稳定 ID，返回删除结果，内置规则或未知 ID 时拒绝。"""

        if request.symbol_id.startswith("rule-"):
            raise HTTPException(status_code=403, detail="Built-in cognitive rules cannot be removed.")
        store = self._require_component(self._dependencies.get_symbol_store(), "NeuroSymbol")
        symbol = store.get(request.symbol_id)
        if symbol is not None and getattr(symbol, "metadata", {}).get("sourceType") == "competition":
            raise HTTPException(status_code=403, detail="Competition projection symbols cannot be removed directly.")
        if not bool(store.remove(request.symbol_id)):
            raise HTTPException(status_code=404, detail="NeuroSymbol was not found.")
        return {
            "schema": ENTERPRISE_INSIGHTS_SCHEMA,
            "success": True,
            "symbolId": request.symbol_id,
        }

    async def neuro_maintenance(self, _request: EmptyRequest) -> Dict[str, Any]:
        """执行一次符号睡眠维护；输入必须为空，返回有界计数，失败时由私有边界报告固定错误。"""

        store = self._require_component(self._dependencies.get_symbol_store(), "NeuroSymbol")
        result = store.perform_sleep_maintenance()
        return {
            "schema": ENTERPRISE_INSIGHTS_SCHEMA,
            "success": True,
            "result": {
                "decayed": int(result.get("decayed", 0)),
                "pruned": int(result.get("pruned", 0)),
                "protected": int(result.get("protected", 0)),
                "remaining": int(result.get("remaining", 0)),
                "timestamp": str(result.get("timestamp", ""))[:64],
            },
        }

    async def knowledge_graph_dashboard(
        self,
        request: KnowledgeGraphDashboardRequest,
    ) -> Dict[str, Any]:
        """读取知识图谱面板；输入边数量限制，返回统计和有界图，不暴露数据库字段。"""

        graph = self._require_component(self._dependencies.get_temporal_kg(), "Temporal knowledge graph")
        stats = graph.stats()
        return {
            "schema": ENTERPRISE_INSIGHTS_SCHEMA,
            "success": True,
            "stats": {
                "entities": int(stats.get("entities", 0)),
                "triples": int(stats.get("triples", 0)),
                "active_triples": int(stats.get("current_facts", 0)),
                "expired_triples": int(stats.get("expired_facts", 0)),
                "competition_triples": int(stats.get("competition_facts", 0)),
                "active_competition_triples": int(stats.get("active_competition_facts", 0)),
            },
            "graph": graph.get_graph(limit=request.limit),
        }

    async def knowledge_graph_query(
        self,
        request: KnowledgeGraphEntityRequest,
    ) -> Dict[str, Any]:
        """查询实体关系；输入实体和数量，返回脱敏事实，不返回 source_symbol 或内部实体 ID。"""

        graph = self._require_component(self._dependencies.get_temporal_kg(), "Temporal knowledge graph")
        subject = request.subject.strip()
        facts = graph.query_entity(subject, limit=request.limit)
        return {
            "schema": ENTERPRISE_INSIGHTS_SCHEMA,
            "success": True,
            "subject": subject,
            "facts": [self._public_fact(item) for item in facts[: request.limit]],
        }

    async def competition_knowledge_sync(
        self,
        request: CompetitionKnowledgeProjectionRequest,
    ) -> Dict[str, Any]:
        """同步比赛知识投影；输入脱敏 Incident 快照，串行写入符号和图谱并返回幂等计数。"""

        store = self._require_component(self._dependencies.get_symbol_store(), "NeuroSymbol")
        graph = self._require_component(self._dependencies.get_temporal_kg(), "Temporal knowledge graph")
        async with self._projection_lock:
            result = CompetitionKnowledgeProjector(store, graph).synchronize(request)
        return self._projection_result(result)

    async def competition_knowledge_purge(
        self,
        request: CompetitionKnowledgePurgeRequest,
    ) -> Dict[str, Any]:
        """清理比赛演示投影；输入明确 Incident 引用，仅删除对应系统符号和图谱事实。"""

        store = self._require_component(self._dependencies.get_symbol_store(), "NeuroSymbol")
        graph = self._require_component(self._dependencies.get_temporal_kg(), "Temporal knowledge graph")
        async with self._projection_lock:
            result = CompetitionKnowledgeProjector(store, graph).purge(request)
        return self._projection_result(result)

    @staticmethod
    def _require_component(value: Any, label: str) -> Any:
        """校验运行时组件；输入组件和标签，返回组件，缺失时抛出固定 503。"""

        if value is None:
            raise HTTPException(status_code=503, detail=f"{label} is unavailable.")
        return value

    @staticmethod
    def _public_symbol(symbol: Any) -> Dict[str, Any]:
        """投影一个认知符号；输入内部对象，返回 UI 所需字段，不含外部引用和父子链。"""

        return {
            "id": str(symbol.id)[:128],
            "operator": str(symbol.operator)[:80],
            "label": str(symbol.label)[:2000],
            "K": {"entities": [str(item)[:256] for item in list(symbol.K.entities)[:100]]},
            "metadata": EnterpriseInsightsEngineApi._public_symbol_metadata(
                getattr(symbol, "metadata", {}),
            ),
            "createdAt": float(symbol.createdAt),
            "successRate": max(0.0, min(1.0, float(symbol.successRate))),
            "activationCount": max(0, int(symbol.activationCount)),
        }

    @staticmethod
    def _public_rule(value: Any) -> Dict[str, Any]:
        """投影一条认知规则；输入内部字典，返回固定公开字段，忽略 Prompt 和配置。"""

        item = value if isinstance(value, dict) else {}
        return {
            "id": str(item.get("id", ""))[:128],
            "name": str(item.get("name", ""))[:160],
            "domain": str(item.get("domain", ""))[:80],
            "description": str(item.get("description", ""))[:4000],
            "bound_operator": str(item.get("bound_operator", ""))[:80],
            "enabled": bool(item.get("enabled", False)),
        }

    @staticmethod
    def _public_neuro_stats(value: Any) -> Dict[str, Any]:
        """规范认知统计；输入内部统计，返回兼容 UI 的固定数值和算子分布。"""

        stats = value if isinstance(value, dict) else {}
        distribution = stats.get("byOperator") if isinstance(stats.get("byOperator"), dict) else {}
        return {
            "totalSymbols": max(0, int(stats.get("totalSymbols", 0))),
            "uniqueEntities": max(0, int(stats.get("totalEntities", 0))),
            "avgSuccessRate": max(0.0, min(1.0, float(stats.get("avgSuccessRate", 0)))),
            "competitionSymbols": max(0, int(stats.get("competitionSymbols", 0))),
            "operatorDistribution": {
                str(key)[:80]: max(0, int(count))
                for key, count in list(distribution.items())[:100]
            },
        }

    @staticmethod
    def _public_fact(value: Any) -> Dict[str, Any]:
        """投影一个时序事实；输入内部字典，返回方向、三元组和时间字段，不含来源符号。"""

        item = value if isinstance(value, dict) else {}
        return {
            "direction": str(item.get("direction", ""))[:16],
            "subject": str(item.get("subject", ""))[:256],
            "predicate": str(item.get("predicate", ""))[:256],
            "object": str(item.get("object", ""))[:256],
            "valid_from": str(item.get("valid_from") or "")[:64],
            "valid_to": str(item.get("valid_to") or "")[:64],
            "confidence": max(0.0, min(1.0, float(item.get("confidence", 0)))),
            "current": bool(item.get("current", False)),
            "source_type": str(item.get("source_type") or "manual")[:32],
        }

    @staticmethod
    def _public_symbol_metadata(value: Any) -> Dict[str, Any]:
        """投影符号元数据；输入内部字典，仅返回比赛展示所需的固定无敏感字段。"""

        metadata = value if isinstance(value, dict) else {}
        text_fields = (
            "sourceType",
            "recordType",
            "workspaceId",
            "incidentId",
            "traceId",
            "stage",
            "decision",
            "teamRole",
            "agentName",
            "skillName",
            "skillVersion",
        )
        public = {key: str(metadata.get(key) or "")[:256] for key in text_fields}
        public["confidence"] = max(0.0, min(1.0, float(metadata.get("confidence", 0))))
        return public

    @staticmethod
    def _projection_result(value: Any) -> Dict[str, Any]:
        """规范投影写入结果；输入内部计数，返回固定私有协议响应。"""

        result = value if isinstance(value, dict) else {}
        return {
            "schema": COMPETITION_KNOWLEDGE_SCHEMA,
            "success": True,
            "symbols": max(0, int(result.get("symbols", 0))),
            "activeFacts": max(0, int(result.get("active_facts", 0))),
            "invalidatedFacts": max(0, int(result.get("invalidated_facts", 0))),
        }


def register_enterprise_insights_engine_api(
    application: FastAPI,
    dependencies: EnterpriseInsightsEngineDependencies,
) -> EnterpriseInsightsEngineApi:
    """注册私有企业洞察路由；输入 FastAPI 与 getter，返回 API 实例，不修改其他路由。"""

    api = EnterpriseInsightsEngineApi(dependencies)
    application.include_router(api.create_router())
    return api
