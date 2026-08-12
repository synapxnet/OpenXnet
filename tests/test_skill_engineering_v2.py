#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""Skill Engineering v2 的证据隔离、提案审批和策略选择回归测试。"""

from __future__ import annotations

import asyncio
import json
import tempfile
import unittest
from pathlib import Path

from py.kernel.skill_lifecycle import get_skill_lifecycle
from py.skill_library import get_skill_library


class SkillEngineeringV2Tests(unittest.TestCase):
    """验证模拟演练、生产认证和 Skill Family 的核心安全约束。"""

    def _record_family_evidence(
        self,
        lifecycle,
        *,
        environment_scope: str,
        attempts: int = 3,
        problem_fingerprint: str = "gpu-queue-overload-v1",
    ):
        """为同一问题记录多策略成功证据，并返回最后一次结晶结果。"""

        result = {}
        strategies = [
            ("scale-first", ["metrics.read", "capacity.apply", "service.verify"]),
            ("batch-tune-first", ["metrics.read", "model.configure", "service.verify"]),
        ]
        for index in range(attempts):
            strategy_id, tools = strategies[index % len(strategies)]
            result = asyncio.run(lifecycle.on_task_completed(
                {
                    "success": True,
                    "summary": "推荐服务 GPU 队列拥塞恢复",
                    "strategy": strategy_id,
                    "strategy_id": strategy_id,
                    "trigger_context": "GPU 队列持续上升且 CPU HPA 未触发",
                    "workflow": ["读取证据", "执行候选方案", "独立验证"],
                    "verification": ["P99 恢复且队列清空"],
                    "verification_oracle": "P99 < 100ms and queue_depth < 10",
                    "source_event_ids": [f"trace-{environment_scope}-{index}"],
                    "risk_level": "medium",
                    "cost_score": 0.2 + (index % 2) * 0.1,
                },
                tools,
                input_text="修复推荐服务突发并发拥塞",
                source="rehearsal" if environment_scope != "production" else "work",
                evidence_origin="rehearsal" if environment_scope != "production" else "work",
                derivation_method=(
                    "rehearsal_crystallization"
                    if environment_scope != "production"
                    else "work_crystallization"
                ),
                environment_scope=environment_scope,
                environment_fingerprint=f"{environment_scope}-cluster-v1",
                problem_fingerprint=problem_fingerprint,
                strategy_id=strategy_id,
                parent_event_id=f"parent-{index - 1}" if index else "",
                mutation_rule="increase_queue_depth" if index else "",
                expected_invariant="service remains available",
                verification_oracle="P99 < 100ms and queue_depth < 10",
            ))
        return result

    def test_rehearsal_strategies_share_one_family(self):
        """同一问题的多种解法应合并为一个 Family，而不是无限生成 Skill。"""

        with tempfile.TemporaryDirectory(prefix="openxnet-skill-family-") as workspace:
            lifecycle = get_skill_lifecycle(workspace)
            created = self._record_family_evidence(lifecycle, environment_scope="simulation")
            self.assertTrue(created.get("created"), created)
            skills = lifecycle.library.list_all()
            self.assertEqual(len(skills), 1)
            skill = skills[0]
            self.assertEqual(skill.status, "candidate")
            self.assertEqual(skill.evidence_origin, "rehearsal")
            self.assertEqual(len(skill.strategies), 2)
            self.assertEqual(skill.get_certification("simulation")["status"], "candidate")
            self.assertIsNone(skill.get_certification("production"))
            self.assertFalse(Path(workspace, ".agent", "skills", skill.skill_id).exists())
            evidence_lines = Path(workspace, ".agent", "skill_lifecycle", "evidence.jsonl").read_text(
                encoding="utf-8",
            ).splitlines()
            self.assertEqual(len(evidence_lines), 3)
            self.assertEqual(json.loads(evidence_lines[-1])["environment_scope"], "simulation")

    def test_sleep_proposes_simulation_certification_without_production_promotion(self):
        """睡眠周期只能提出模拟认证变更，不能自动发布或污染生产状态。"""

        with tempfile.TemporaryDirectory(prefix="openxnet-skill-sleep-") as workspace:
            lifecycle = get_skill_lifecycle(workspace)
            created = self._record_family_evidence(lifecycle, environment_scope="simulation")
            skill_id = created["skill_id"]

            sleep_result = asyncio.run(lifecycle.run_sleep_cycle())
            self.assertFalse(sleep_result["applied"])
            self.assertEqual(len(sleep_result["proposals"]), 1)
            proposal = sleep_result["proposals"][0]
            self.assertEqual(proposal["environment_scope"], "simulation")
            self.assertEqual(proposal["to_status"], "verified")
            self.assertEqual(lifecycle.library.get(skill_id).status, "candidate")

            resolved = lifecycle.resolve_change_proposal(
                proposal["proposal_id"],
                approved=True,
                actor="independent-verifier",
                reason="simulation regression suite passed",
            )
            self.assertTrue(resolved["ok"], resolved)
            skill = lifecycle.library.get(skill_id)
            self.assertEqual(skill.get_certification("simulation")["status"], "verified")
            self.assertEqual(skill.status, "candidate")
            self.assertFalse(Path(workspace, ".agent", "skills", skill_id).exists())

            simulation_selection = lifecycle.select_for_context(
                "推荐服务 GPU 队列拥塞恢复",
                environment_scope="simulation",
                environment_fingerprint="simulation-cluster-v1",
                available_capabilities=[
                    "metrics.read", "capacity.apply", "model.configure", "service.verify",
                ],
            )
            production_selection = lifecycle.select_for_context(
                "推荐服务 GPU 队列拥塞恢复",
                environment_scope="production",
                environment_fingerprint="production-cluster-v1",
                available_capabilities=[
                    "metrics.read", "capacity.apply", "model.configure", "service.verify",
                ],
            )
            self.assertFalse(simulation_selection["abstained"])
            self.assertTrue(production_selection["abstained"])

    def test_production_certification_requires_proposal_approval_before_sync(self):
        """生产证据达到门槛后仍需审批，批准后才同步标准 Skill 包。"""

        with tempfile.TemporaryDirectory(prefix="openxnet-skill-production-") as workspace:
            lifecycle = get_skill_lifecycle(workspace)
            created = self._record_family_evidence(lifecycle, environment_scope="production")
            skill_id = created["skill_id"]
            package = Path(workspace, ".agent", "skills", skill_id, "SKILL.md")
            self.assertFalse(package.exists())

            sleep_result = asyncio.run(lifecycle.run_sleep_cycle())
            proposal = sleep_result["proposals"][0]
            self.assertEqual(proposal["environment_scope"], "production")
            self.assertFalse(package.exists())

            resolved = lifecycle.resolve_change_proposal(
                proposal["proposal_id"],
                approved=True,
                actor="production-verifier",
                reason="production evidence independently verified",
            )
            self.assertTrue(resolved["ok"], resolved)
            skill = lifecycle.library.get(skill_id)
            self.assertEqual(skill.status, "verified")
            self.assertEqual(skill.get_certification("production")["status"], "verified")
            self.assertTrue(package.exists())
            markdown = package.read_text(encoding="utf-8")
            self.assertIn("## Strategy Variants", markdown)
            self.assertIn("production: verified", markdown)

    def test_strategy_selection_uses_bayesian_evidence(self):
        """策略排序应惩罚单次偶然成功，优先选择证据更充分的方案。"""

        with tempfile.TemporaryDirectory(prefix="openxnet-skill-selection-") as workspace:
            library = get_skill_library(workspace)
            library.add(
                name="推荐服务恢复",
                description="处理推荐服务 GPU 队列拥塞",
                skill_id="recommendation-recovery",
                family_id="family-recommendation-recovery",
                status="active",
                verified=True,
                required_capabilities=["metrics.read", "service.verify"],
                evidence_origin="work",
                certifications=[{
                    "scope": "production",
                    "status": "active",
                    "environment_fingerprint": "prod-v1",
                }],
                strategies=[
                    {
                        "strategy_id": "one-shot",
                        "name": "单次成功方案",
                        "risk_level": "medium",
                        "cost_score": 0.1,
                        "evidence_summary": {
                            "production": {"attempts": 1, "successes": 1, "failures": 0},
                        },
                    },
                    {
                        "strategy_id": "well-tested",
                        "name": "充分验证方案",
                        "risk_level": "low",
                        "cost_score": 0.1,
                        "evidence_summary": {
                            "production": {"attempts": 10, "successes": 8, "failures": 2},
                        },
                    },
                ],
            )
            decision = library.select_for_context(
                "推荐服务恢复",
                environment_scope="production",
                environment_fingerprint="prod-v1",
                available_capabilities=["metrics.read", "service.verify"],
            )
            self.assertFalse(decision["abstained"], decision)
            self.assertEqual(decision["selected"][0]["strategy"]["strategy_id"], "well-tested")


if __name__ == "__main__":
    unittest.main()
