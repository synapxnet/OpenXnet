# -*- coding: utf-8 -*-
"""将 GOAI Live 复盘制品写入真实 SynapXnet Memory V3 存储。"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from py.memory.synapxnet_v3_runtime import SynapXnetMemoryV3Runtime


SCENARIO_METADATA = {
    "recommendation-capacity": {
        "skill_id": "synapxnet-recommendation-capacity-recovery",
        "skill_title": "推荐服务 GPU 拥塞自治恢复",
    },
    "quantitative-iteration": {
        "skill_id": "synapxnet-quantitative-model-iteration",
        "skill_title": "量化模型归因与受控迭代",
    },
    "feature-drift": {
        "skill_id": "synapxnet-feature-drift-recovery",
        "skill_title": "跨域特征漂移恢复",
    },
}
GOAI_MEMORY_SHARED_AGENT_IDS = (
    "role_goai_incident_commander",
    "role_goai_evidence_agent",
    "role_goai_verification_agent",
)
STATUS_LABELS = {
    "ALLOW": "允许",
    "APPROVAL_REQUIRED": "需要人工审批",
    "APPROVED": "已批准",
    "BASELINE": "基线执行",
    "COMPLETED": "已完成",
    "DENY": "拒绝",
    "PASSED": "通过",
    "READY_FOR_CERTIFICATION": "待环境认证",
    "RESOLVED": "已闭环",
    "REUSED": "已复用",
    "SUCCEEDED": "成功",
}
ROLE_LABELS = {
    "DEVELOPER": "开发者",
    "Evidence Agent": "证据智能体",
    "Incident Commander": "事件指挥智能体",
    "TESTER": "测试者",
    "VERIFIER": "验证者",
    "Verification Agent": "验证智能体",
    "leader": "主控",
    "worker": "执行者",
}
STAGE_LABELS = {
    "CHANGE_DECISION": "处置决策",
    "INDEPENDENT_CERTIFICATION": "独立认证",
    "INVESTIGATION_PLAN": "取证计划",
    "PLAN_SELECTION": "方案选择",
    "PROBLEM_REPRODUCTION": "问题复现",
    "PROGRESSIVE_CHALLENGE": "递进挑战",
    "SKILL_SELECTION": "技能选择",
    "STRATEGY_COMPARISON": "策略比较",
    "VERIFICATION": "独立验证",
}


def parse_arguments() -> argparse.Namespace:
    """解析 Live 证据目录、Memory 存储目录与输出清单路径。"""

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-root", type=Path, required=True)
    parser.add_argument("--storage-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    return parser.parse_args()


def read_json(path: Path) -> dict[str, Any]:
    """读取 UTF-8 JSON 对象并在结构异常时立即失败。"""

    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"JSON 根节点必须是对象：{path}")
    return value


def find_record(records: list[dict[str, Any]], key: str, value: str) -> dict[str, Any]:
    """从记录列表中按唯一字段查找对象，缺失时给出明确错误。"""

    record = next((item for item in records if item.get(key) == value), None)
    if record is None:
        raise ValueError(f"未找到 {key}={value} 的 Live 记录。")
    return record


def localize(value: Any, labels: dict[str, str]) -> str:
    """将稳定枚举转换为中文展示文本，未知值保留原始标识。"""

    normalized = str(value or "-")
    return labels.get(normalized, normalized)


def strip_skill_frontmatter(content: str) -> str:
    """移除 Skill Markdown 的英文元数据头，只保留可阅读的复盘正文。"""

    normalized = content.replace("\r\n", "\n").strip()
    if not normalized.startswith("---\n"):
        return normalized
    closing = normalized.find("\n---\n", 4)
    return normalized if closing < 0 else normalized[closing + 5 :].strip()


def related_records(
    snapshot: dict[str, Any],
    collection: str,
    incident_id: str,
    trace_id: str,
) -> list[dict[str, Any]]:
    """按 Incident 和当前 Trace 筛选控制面记录，避免混入历史执行轮次。"""

    records = snapshot.get(collection)
    if not isinstance(records, list):
        return []
    return [
        item
        for item in records
        if isinstance(item, dict)
        and item.get("incidentId") == incident_id
        and (not item.get("traceId") or item.get("traceId") == trace_id)
    ]


def build_skill_memory_content(
    incident: dict[str, Any],
    usage: dict[str, Any],
    evolution: dict[str, Any],
    retrospective: str,
) -> str:
    """组合技能复用、受控进化轮次和中文复盘正文为技能记忆。"""

    rounds = evolution.get("rounds") if isinstance(evolution.get("rounds"), list) else []
    round_summary = "\n".join(
        (
            f"{item.get('round')}. {localize(item.get('role'), ROLE_LABELS)} / "
            f"{localize(item.get('stage'), STAGE_LABELS)} / "
            f"{localize(item.get('outcome'), STATUS_LABELS)}"
        )
        for item in rounds
    )
    return "\n\n".join(
        (
            "# 技能复用与演进记忆",
            f"事件编号：{incident['incidentId']}",
            f"追踪编号：{incident.get('activeTraceId') or '-'}",
            f"场景类型：{incident['scenario']['scenarioType']}",
            f"技能标识：{usage.get('skillId') or evolution.get('skillId')}",
            f"复用状态：{localize(usage.get('status', 'BASELINE'), STATUS_LABELS)}",
            f"来源事件：{usage.get('sourceIncidentId') or '本次闭环'}",
            f"演进状态：{localize(evolution.get('status'), STATUS_LABELS)}",
            f"演进轮次：\n{round_summary or '无'}",
            f"复盘结晶：\n{strip_skill_frontmatter(retrospective)}",
        )
    )


def build_incident_memory_content(
    snapshot: dict[str, Any],
    incident: dict[str, Any],
) -> str:
    """从审批、执行和验证记录生成可审计的事件闭环记忆。"""

    incident_id = str(incident["incidentId"])
    trace_id = str(incident.get("activeTraceId") or "")
    evidence = related_records(snapshot, "evidence", incident_id, trace_id)
    approvals = related_records(snapshot, "approvals", incident_id, trace_id)
    actions = related_records(snapshot, "actions", incident_id, trace_id)
    traces = related_records(snapshot, "traces", incident_id, trace_id)
    approval = approvals[-1] if approvals else {}
    action = actions[-1] if actions else {}
    trace = traces[-1] if traces else {}
    platform_counts = {
        platform: sum(1 for item in evidence if item.get("platform") == platform)
        for platform in ("aiops", "dataops", "mlops")
    }
    step_lines = "\n".join(
        (
            f"{item.get('sequence')}. {item.get('title')}："
            f"{localize(item.get('status'), STATUS_LABELS)} "
            f"({item.get('platform')} / {item.get('toolName')})"
        )
        for item in action.get("steps", [])
        if isinstance(item, dict)
    )
    return "\n\n".join(
        (
            "# 事件闭环记忆",
            f"事件：{incident.get('title')}\n事件编号：{incident_id}\n追踪编号：{trace_id}",
            f"问题摘要：{incident.get('summary')}",
            (
                "跨平台证据："
                f"AIOps {platform_counts['aiops']} 条，"
                f"DataOps {platform_counts['dataops']} 条，"
                f"MLOps {platform_counts['mlops']} 条。"
            ),
            (
                f"人工审批：{localize(approval.get('status'), STATUS_LABELS)}\n"
                f"审批编号：{approval.get('approvalId') or '-'}\n"
                f"审批理由：{approval.get('decisionReason') or approval.get('reason') or '-'}"
            ),
            f"受控执行：\n{step_lines or '无执行步骤'}",
            (
                "闭环判定："
                f"事件={localize(incident.get('status'), STATUS_LABELS)}；"
                f"Trace={localize(trace.get('status'), STATUS_LABELS)}；"
                f"Action={localize(action.get('status'), STATUS_LABELS)}；"
                f"独立验证证据={len(action.get('verificationEvidenceIds', []))} 条。"
            ),
            f"完成时间：{incident.get('resolvedAt') or '-'}",
        )
    )


def build_collaboration_memory_content(
    snapshot: dict[str, Any],
    incident: dict[str, Any],
) -> str:
    """从 AgentTeams 决策与传输哈希链生成多智能体协作记忆。"""

    incident_id = str(incident["incidentId"])
    trace_id = str(incident.get("activeTraceId") or "")
    decisions = related_records(snapshot, "agentDecisions", incident_id, trace_id)
    decision_sections: list[str] = []
    for index, decision in enumerate(decisions, start=1):
        events = decision.get("transportEvents") if isinstance(decision.get("transportEvents"), list) else []
        latest_ledger = events[-1].get("ledgerDigest") if events else "-"
        tools = ", ".join(str(item) for item in decision.get("requestedToolNames", [])) or "无"
        evidence = ", ".join(str(item) for item in decision.get("evidenceIds", [])) or "无"
        decision_sections.append(
            "\n".join(
                (
                    f"## {index}. {localize(decision.get('stage'), STAGE_LABELS)}",
                    (
                        f"智能体：{localize(decision.get('agentName'), ROLE_LABELS)} "
                        f"({localize(decision.get('teamRole'), ROLE_LABELS)})"
                    ),
                    f"决策：{localize(decision.get('decision'), STATUS_LABELS)}",
                    f"结论：{decision.get('summary') or '-'}",
                    f"请求工具：{tools}",
                    f"输入上下文摘要：{decision.get('taskBriefDigest') or '-'}",
                    f"输出摘要：{decision.get('outputDigest') or '-'}",
                    f"证据引用：{evidence}",
                    f"传输事件：{len(events)} 条；末端账本摘要：{latest_ledger}",
                )
            )
        )
    return "\n\n".join(
        (
            "# AgentTeams 协作记忆",
            f"事件：{incident.get('title')}\n事件编号：{incident_id}\n追踪编号：{trace_id}",
            "上下文按照任务摘要、工具结果、证据引用和输出摘要逐阶段传递，传输事件进入连续哈希账本。",
            "\n\n".join(decision_sections) or "本次执行未产生 AgentTeams 身份化决策。",
        )
    )


def build_decision_memory_content(
    snapshot: dict[str, Any],
    incident: dict[str, Any],
) -> str:
    """从候选评分、知识引用和符号硬门生成神经符号决策记忆。"""

    incident_id = str(incident["incidentId"])
    trace_id = str(incident.get("activeTraceId") or "")
    reasoning = related_records(snapshot, "reasoningDecisions", incident_id, trace_id)
    reasoning_sections: list[str] = []
    for index, item in enumerate(reasoning, start=1):
        candidates = item.get("candidates") if isinstance(item.get("candidates"), list) else []
        candidate_lines = []
        for candidate in candidates:
            if not isinstance(candidate, dict):
                continue
            rules = "；".join(str(reason) for reason in candidate.get("ruleReasons", [])) or "无"
            candidate_lines.append(
                (
                    f"- {candidate.get('title') or candidate.get('candidateId')}："
                    f"总分 {float(candidate.get('totalScore') or 0):.4f}，"
                    f"{localize(candidate.get('policyDecision'), STATUS_LABELS)}，"
                    f"权限 {candidate.get('authorityLevel') or '-'}，"
                    f"风险 {candidate.get('riskClass') or '-'}，"
                    f"证据 {candidate.get('evidenceGrade') or '-'}；规则：{rules}"
                )
            )
        reasoning_sections.append(
            "\n".join(
                (
                    f"## {index}. {localize(item.get('decisionType'), STAGE_LABELS)}",
                    f"检索方式：{item.get('retrievalMode') or '-'}",
                    f"选中候选：{item.get('selectedCandidateId') or '-'}",
                    f"知识图谱引用：{len(item.get('knowledgeRefs', []))} 条",
                    "候选与符号门结果：",
                    *(candidate_lines or ["- 无候选"]),
                )
            )
        )
    return "\n\n".join(
        (
            "# 神经符号决策记忆",
            f"事件：{incident.get('title')}\n事件编号：{incident_id}\n追踪编号：{trace_id}",
            "语义与图谱检索负责召回候选，符号规则负责权限、风险、证据和闭环边界，任何硬门拒绝均不能被模型评分覆盖。",
            "\n\n".join(reasoning_sections) or "本次执行未产生神经符号候选决策。",
        )
    )


def upsert_memory(
    runtime: SynapXnetMemoryV3Runtime,
    *,
    task_id: str,
    title: str,
    content: str,
    memory_type: str,
    scenario_type: str,
    incident_id: str,
    source: str,
    quality_score: float,
) -> dict[str, Any]:
    """以记忆类型和业务主键幂等创建或追加可共享长期记忆版本。"""

    owner_agent = "incident-commander"
    listing = runtime.list_memories(
        {
            "requesterAgent": owner_agent,
            "query": task_id,
            "ownerAgent": owner_agent,
            "includeRetired": True,
            "limit": 20,
        }
    )
    existing = next((item for item in listing["items"] if item.get("taskId") == task_id), None)
    common = {
        "actorAgent": owner_agent,
        "title": title,
        "content": content,
        "qualityScore": quality_score,
        "permissions": list(GOAI_MEMORY_SHARED_AGENT_IDS),
        "tags": [
            "competition",
            "goai-staging",
            scenario_type,
            f"memory-type:{memory_type}",
        ],
    }
    if existing is not None:
        history = runtime.get_history(
            {"memoryId": existing["memoryId"], "requesterAgent": owner_agent}
        )
        latest = history["versions"][0]
        if (
            latest.get("title") == title
            and latest.get("content") == content
            and set(latest.get("tags", [])) == set(common["tags"])
        ):
            return latest
        return runtime.edit_memory(
            {
                **common,
                "memoryId": existing["memoryId"],
                "baseVersion": existing["version"],
                "reason": f"事件 {incident_id} 已通过独立验证并形成新的{memory_type}记忆版本。",
            }
        )
    return runtime.create_memory(
        {
            **common,
            "ownerAgent": owner_agent,
            "taskId": task_id,
            "source": source,
        }
    )


def materialize_memories(data_root: Path, storage_root: Path) -> dict[str, Any]:
    """读取三条已验证 Live Incident，并写入四类可审计 Memory V3 记忆。"""

    competition_root = data_root.resolve() / "competition"
    snapshot = read_json(competition_root / "control-plane.v1.json")
    manifest = read_json(competition_root / "evaluations" / "live-evidence-manifest.json")
    runtime = SynapXnetMemoryV3Runtime(storage_root.resolve())
    results: list[dict[str, Any]] = []
    for exported in manifest.get("exports", []):
        if exported.get("outcome") != "RESOLVED":
            continue
        incident_id = str(exported["incidentId"])
        scenario_type = str(exported["scenarioType"])
        metadata = SCENARIO_METADATA.get(scenario_type)
        if metadata is None:
            raise ValueError(f"不支持的场景类型：{scenario_type}")
        skill_id = metadata["skill_id"]
        incident = find_record(snapshot["incidents"], "incidentId", incident_id)
        usage = find_record(snapshot["skillUsages"], "incidentId", incident_id)
        evolution = find_record(snapshot["skillEvolutionRuns"], "incidentId", incident_id)
        retrospective_path = competition_root / "retrospectives" / incident_id / "SKILL.md"
        retrospective = retrospective_path.read_text(encoding="utf-8")
        definitions = (
            {
                "memory_type": "skill",
                "task_id": f"skill:{skill_id}",
                "title": f"技能记忆：{metadata['skill_title']}",
                "content": build_skill_memory_content(incident, usage, evolution, retrospective),
                "source": "competition-live-retrospective",
                "quality_score": 0.98,
            },
            {
                "memory_type": "incident",
                "task_id": f"incident:{incident_id}",
                "title": f"闭环事件：{incident.get('title')}",
                "content": build_incident_memory_content(snapshot, incident),
                "source": "competition-resolved-incident",
                "quality_score": 0.97,
            },
            {
                "memory_type": "collaboration",
                "task_id": f"collaboration:{incident_id}",
                "title": f"协作记忆：{incident.get('title')}",
                "content": build_collaboration_memory_content(snapshot, incident),
                "source": "agentteams-collaboration-ledger",
                "quality_score": 0.96,
            },
            {
                "memory_type": "decision",
                "task_id": f"decision:{incident_id}",
                "title": f"决策记忆：{incident.get('title')}",
                "content": build_decision_memory_content(snapshot, incident),
                "source": "neuro-symbolic-reasoning",
                "quality_score": 0.97,
            },
        )
        for definition in definitions:
            record = upsert_memory(
                runtime,
                scenario_type=scenario_type,
                incident_id=incident_id,
                **definition,
            )
            results.append(
                {
                    "incidentId": incident_id,
                    "scenarioType": scenario_type,
                    "memoryType": definition["memory_type"],
                    "record": record,
                }
            )
    status = runtime.status()
    if not status.get("auditHealthy"):
        raise RuntimeError("Memory V3 审计链校验失败。")
    return {
        "schema": "openxnet.goai-live-memory-materialization.v1",
        "environmentClaim": "goai-staging",
        "status": status,
        "items": results,
    }


def main() -> int:
    """执行 Memory V3 物化并写出 UTF-8 公开清单。"""

    arguments = parse_arguments()
    result = materialize_memories(arguments.data_root, arguments.storage_root)
    arguments.output.parent.mkdir(parents=True, exist_ok=True)
    arguments.output.write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "success": True,
                "output": str(arguments.output.resolve()),
                "memoryCount": len(result["items"]),
                "auditHealthy": result["status"]["auditHealthy"],
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
