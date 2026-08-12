#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
Evolution Controller — 自主进化控制器。

OpenXnet 大脑的进化中枢，驱动运行时自主进化：
- 交互经验提取
- 符文进化（强化/衰减/矛盾仲裁）
- 技能巩固（成功模式→待审批变更提案）
- 睡眠深度整合（去重/修剪/泛化/能力重构）
- 进化指标追踪

Author: Claude Code
Department: R&D
Date: 2026-04-19
Version: 1.0.0
Security Level: INTERNAL
"""

__version__ = "1.0.0"
__author__ = "Claude Code"
__copyright__ = "Copyright 2026 Synapxnet"

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("app")


class EvolutionMetrics:
    """Tracks the brain's evolution progress."""

    def __init__(self):
        self.total_interactions = 0
        self.total_evolutions = 0
        self.total_sleep_cycles = 0
        self.skills_crystallized = 0
        self.runes_inscribed = 0
        self.runes_pruned = 0
        self.contradictions_resolved = 0
        self.started_at = datetime.now().isoformat()
        self.last_evolution = ""
        self.last_sleep = ""

    def to_dict(self) -> dict:
        return {
            "total_interactions": self.total_interactions,
            "total_evolutions": self.total_evolutions,
            "total_sleep_cycles": self.total_sleep_cycles,
            "skills_crystallized": self.skills_crystallized,
            "runes_inscribed": self.runes_inscribed,
            "runes_pruned": self.runes_pruned,
            "contradictions_resolved": self.contradictions_resolved,
            "started_at": self.started_at,
            "last_evolution": self.last_evolution,
            "last_sleep": self.last_sleep,
            "maturity": self._compute_maturity(),
        }

    def _compute_maturity(self) -> str:
        if self.total_sleep_cycles >= 10 and self.skills_crystallized >= 20:
            return "mature"
        if self.total_sleep_cycles >= 3 and self.skills_crystallized >= 5:
            return "developing"
        if self.total_interactions >= 10:
            return "infant"
        return "nascent"


class EvolutionController:
    """Autonomous evolution controller for the OpenXnet brain."""

    def __init__(self, workspace_dir: str):
        self.workspace_dir = Path(workspace_dir).expanduser()
        self.evo_dir = self.workspace_dir / ".agent" / "evolution"
        self.evo_dir.mkdir(parents=True, exist_ok=True)
        self.metrics_file = self.evo_dir / "metrics.json"
        self.log_file = self.evo_dir / "evolution_log.jsonl"
        self.metrics = self._load_metrics()

    def _load_metrics(self) -> EvolutionMetrics:
        try:
            if self.metrics_file.exists():
                data = json.loads(self.metrics_file.read_text(encoding="utf-8"))
                m = EvolutionMetrics()
                for k, v in data.items():
                    if hasattr(m, k) and not k.startswith("_"):
                        setattr(m, k, v)
                return m
        except Exception:
            pass
        return EvolutionMetrics()

    def _save_metrics(self) -> None:
        try:
            self.metrics_file.write_text(
                json.dumps(self.metrics.to_dict(), ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        except Exception:
            pass

    def _log_event(self, event_type: str, details: Dict[str, Any]) -> None:
        entry = {
            "timestamp": datetime.now().isoformat(),
            "event_type": event_type,
            **details,
        }
        try:
            with open(self.log_file, "a", encoding="utf-8") as f:
                f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        except Exception:
            pass

    async def on_interaction(
        self,
        input_text: str,
        result: Dict[str, Any] = None,
        *,
        success: bool = True,
    ) -> Dict[str, Any]:
        """Called after each interaction to extract experience and evolve."""
        self.metrics.total_interactions += 1
        inscribed = 0

        try:
            from py.cortex.neuro_rune import get_rune_engine
            engine = get_rune_engine(str(self.workspace_dir))

            engine.inscribe(
                content=input_text[:300],
                rune_type="observation",
                source_module="interaction",
            )
            inscribed += 1

            if result:
                phases = result.get("phases", [])
                for phase in phases:
                    phase_result = phase.get("result", {})
                    intent = phase_result.get("intent", "")
                    strategy = phase_result.get("plan", {}).get("strategy", "")
                    if intent:
                        engine.inscribe(
                            content=f"Intent: {intent} for input: {input_text[:100]}",
                            rune_type="cognitive",
                            source_module="cognitive_cortex",
                        )
                        inscribed += 1
                    if strategy:
                        engine.inscribe(
                            content=f"Strategy: {strategy} {'succeeded' if success else 'failed'}",
                            rune_type="cognitive" if success else "memory",
                            source_module="cognitive_cortex",
                            confidence=0.9 if success else 0.4,
                        )
                        inscribed += 1

            self.metrics.runes_inscribed += inscribed
        except Exception:
            pass

        self._save_metrics()
        self._log_event("interaction", {
            "success": success,
            "runes_inscribed": inscribed,
        })

        return {"inscribed": inscribed, "interaction": self.metrics.total_interactions}

    async def run_evolution_cycle(self) -> Dict[str, Any]:
        """Run one evolution cycle: decay, prune, detect contradictions."""
        self.metrics.total_evolutions += 1
        self.metrics.last_evolution = datetime.now().isoformat()
        results = {}

        try:
            from py.cortex.neuro_rune import get_rune_engine
            engine = get_rune_engine(str(self.workspace_dir))
            evo_stats = engine.evolve()
            results["rune_evolution"] = evo_stats
            self.metrics.runes_pruned += evo_stats.get("pruned", 0)
        except Exception as exc:
            results["rune_evolution_error"] = str(exc)

        self._save_metrics()
        self._log_event("evolution_cycle", results)
        return results

    async def deep_sleep(self) -> Dict[str, Any]:
        """Run deep sleep consolidation across all memory subsystems."""
        self.metrics.total_sleep_cycles += 1
        self.metrics.last_sleep = datetime.now().isoformat()
        results = {"sleep_cycle": self.metrics.total_sleep_cycles}

        evo = await self.run_evolution_cycle()
        results["evolution"] = evo

        try:
            from py.memory.hebbian import get_hebbian_store
            store = get_hebbian_store(str(self.workspace_dir))
            results["hebbian"] = store.sleep_consolidation()
        except Exception as exc:
            results["hebbian_error"] = str(exc)

        try:
            from py.memory.context_compressor import get_context_compressor
            compressor = get_context_compressor(str(self.workspace_dir))
            results["atoms_deduped"] = compressor.deduplicate_atoms()
        except Exception as exc:
            results["compressor_error"] = str(exc)

        try:
            from py.memory.observation_store import get_observation_store
            obs_store = await get_observation_store(str(self.workspace_dir))
            trimmed = await obs_store.trim_observations(max_count=240)
            results["observations_trimmed"] = trimmed
            ss_trimmed = await obs_store.trim_session_summaries()
            results["sessions_trimmed"] = ss_trimmed
        except Exception as exc:
            results["observation_trim_error"] = str(exc)

        try:
            from py.kernel.skill_lifecycle import get_skill_lifecycle
            lifecycle = get_skill_lifecycle(str(self.workspace_dir))
            lifecycle_result = await lifecycle.run_sleep_cycle()
            results["skill_lifecycle"] = lifecycle_result
            results["skill_change_proposals"] = lifecycle_result.get("proposals", []) or []
        except Exception as exc:
            results["skill_lifecycle_error"] = str(exc)

        self._save_metrics()
        self._log_event("deep_sleep", results)
        return results

    def get_brain_state(self) -> Dict[str, Any]:
        """Return the complete brain state: metrics, rune stats, evolution log."""
        state = {
            "metrics": self.metrics.to_dict(),
            "maturity": self.metrics.to_dict().get("maturity", "nascent"),
        }

        try:
            from py.cortex.neuro_rune import get_rune_engine
            engine = get_rune_engine(str(self.workspace_dir))
            state["rune_lattice"] = engine.get_lattice_stats()
        except Exception:
            state["rune_lattice"] = {}

        try:
            log_entries = []
            if self.log_file.exists():
                with open(self.log_file, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line:
                            try:
                                log_entries.append(json.loads(line))
                            except Exception:
                                pass
            state["recent_evolution"] = log_entries[-10:]
        except Exception:
            state["recent_evolution"] = []

        return state


_controllers: Dict[str, EvolutionController] = {}


def get_evolution_controller(workspace_dir: str) -> EvolutionController:
    normalized = str(Path(workspace_dir).expanduser().resolve())
    if normalized not in _controllers:
        _controllers[normalized] = EvolutionController(workspace_dir)
    return _controllers[normalized]
