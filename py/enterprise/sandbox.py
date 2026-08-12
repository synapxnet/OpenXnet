#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
企业沙盘状态管理器 — Agent 3D 位置、状态、动画管理。

基于职工角色卡，为每个 Agent 分配 3D 沙盘中的位置和状态。
前端 Three.js 场景通过轮询此模块获取实时数据。

灵感来源: ralv.ai — "Starcraft for AI Agents"

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

import json
import math
import logging
import os
import random
from datetime import datetime
from typing import List, Dict, Any, Optional

logger = logging.getLogger("openxnet.enterprise.sandbox")

# Agent 状态常量
STATUS_IDLE = "idle"
STATUS_WORKING = "working"
STATUS_ERROR = "error"
STATUS_THINKING = "thinking"

# 动画常量
ANIM_IDLE = "idle"
ANIM_WALK = "walk"
ANIM_TYPING = "typing"
ANIM_THINKING = "thinking"

# 预设颜色
AGENT_COLORS = [
    "#409EFF", "#67C23A", "#E6A23C", "#F56C6C", "#909399",
    "#9C27B0", "#FF9800", "#00BCD4", "#795548", "#607D8B",
    "#E91E63", "#3F51B5", "#009688", "#FF5722", "#8BC34A",
]

# 场景配置
DEFAULT_SCENE = {
    "template": "office_default",
    "dimensions": {"width": 20, "height": 15},
    "furniture": [
        {"type": "desk", "x": 2, "z": 2, "rotation": 0},
        {"type": "desk", "x": 5, "z": 2, "rotation": 0},
        {"type": "desk", "x": 8, "z": 2, "rotation": 0},
        {"type": "desk", "x": 11, "z": 2, "rotation": 0},
        {"type": "desk", "x": 2, "z": 6, "rotation": 0},
        {"type": "desk", "x": 5, "z": 6, "rotation": 0},
        {"type": "desk", "x": 8, "z": 6, "rotation": 0},
        {"type": "desk", "x": 11, "z": 6, "rotation": 0},
        {"type": "meeting_table", "x": 7, "z": 10, "rotation": 0},
        {"type": "server_rack", "x": 14, "z": 1, "rotation": 0},
    ],
}


class SandboxStateManager:
    """
    企业沙盘状态管理器。
    维护所有 Agent 的 3D 位置、当前状态、动画、性能指标。
    """

    def __init__(self, data_dir: str = ""):
        self.data_dir = data_dir or os.path.join(os.path.dirname(__file__), "..", "..", "data", "enterprise")
        os.makedirs(self.data_dir, exist_ok=True)
        self.data_file = os.path.join(self.data_dir, "sandbox_state.json")
        self.agents: List[Dict[str, Any]] = []
        self.scene: Dict[str, Any] = dict(DEFAULT_SCENE)
        self._load()

    def _load(self):
        """加载沙盘状态。"""
        try:
            if os.path.exists(self.data_file):
                with open(self.data_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.agents = data.get("agents", [])
                    self.scene = data.get("scene", dict(DEFAULT_SCENE))
        except Exception as e:
            logger.warning(f"[Sandbox] Load failed: {e}")

    def _save(self):
        """保存沙盘状态。"""
        try:
            with open(self.data_file, "w", encoding="utf-8") as f:
                json.dump({"agents": self.agents, "scene": self.scene}, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"[Sandbox] Save failed: {e}")

    def get_full_state(self) -> Dict[str, Any]:
        """获取完整沙盘状态 (前端渲染用)。"""
        return {
            "agents": self.agents,
            "scene": self.scene,
        }

    def sync_from_role_cards(self, role_cards: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        根据职工角色卡同步 Agent 列表。
        - 新角色卡 → 自动创建 Agent，分配位置
        - 删除的角色卡 → 移除对应 Agent
        - 已有 Agent → 保留位置和状态不变
        """
        existing_ids = {a["id"] for a in self.agents}
        existing_agents = {a["id"]: a for a in self.agents}
        card_ids = {c["id"] for c in role_cards}

        # 移除不存在的角色卡对应 Agent
        self.agents = [a for a in self.agents if a["id"] in card_ids]

        # 新增角色卡 → 创建 Agent
        for idx, card in enumerate(role_cards):
            if card["id"] in existing_ids:
                self._apply_card_profile_to_agent(existing_agents[card["id"]], card, idx)
                continue
            agent = self._create_agent_from_card(card, len(self.agents))
            self.agents.append(agent)

        self._save()
        return self.agents

    def _apply_card_profile_to_agent(self, agent: Dict[str, Any], card: Dict[str, Any], index: int) -> None:
        color = AGENT_COLORS[index % len(AGENT_COLORS)]
        agent["name"] = card.get("name", "Agent")
        agent["role"] = card.get("name", "Unknown")
        agent["department"] = card.get("department", "")
        agent["assignedWorkspace"] = card.get("assignedWorkspace", "")
        agent["projectId"] = card.get("projectId", "")
        agent["skills"] = card.get("skills", [])
        agent["skill_ids"] = card.get("skill_ids", [])
        agent["icon"] = card.get("icon", "")
        agent["summaryZh"] = card.get("summaryZh", "")
        agent["summaryEn"] = card.get("summaryEn", "")
        agent["templateId"] = card.get("templateId", "")
        agent["category"] = card.get("category", "")
        agent["runtime_system_prompt"] = card.get("runtime_system_prompt", "")
        agent["avatar_color"] = agent.get("avatar_color") or color
        agent["enabled"] = card.get("enabled", True)

    def _create_agent_from_card(self, card: Dict[str, Any], index: int) -> Dict[str, Any]:
        """从角色卡创建 3D Agent。"""
        # 环形布局：根据 index 计算位置
        desk_positions = [
            (2, 2), (5, 2), (8, 2), (11, 2),
            (2, 6), (5, 6), (8, 6), (11, 6),
        ]
        if index < len(desk_positions):
            px, pz = desk_positions[index]
        else:
            # 溢出时随机分布
            px = random.uniform(1, 13)
            pz = random.uniform(1, 13)

        color = AGENT_COLORS[index % len(AGENT_COLORS)]

        agent = {
            "id": card["id"],
            "status": STATUS_IDLE,
            "current_task": None,
            "position": {"x": round(px, 2), "y": 0, "z": round(pz, 2)},
            "target_position": None,
            "animation": ANIM_IDLE,
            "avatar_color": color,
            "metrics": {
                "tasks_today": 0,
                "tasks_total": 0,
                "avg_response_ms": 0,
                "uptime_minutes": 0,
            },
            "enabled": card.get("enabled", True),
        }
        self._apply_card_profile_to_agent(agent, card, index)
        return agent

    def update_agent_status(self, agent_id: str, status: str,
                            current_task: str = None) -> Optional[Dict[str, Any]]:
        """
        更新 Agent 状态 (由后端 Agent 执行器调用)。
        """
        for agent in self.agents:
            if agent["id"] == agent_id:
                agent["status"] = status
                agent["current_task"] = current_task

                # 状态 → 动画 映射
                if status == STATUS_WORKING:
                    agent["animation"] = ANIM_TYPING
                elif status == STATUS_THINKING:
                    agent["animation"] = ANIM_THINKING
                elif status == STATUS_ERROR:
                    agent["animation"] = ANIM_IDLE
                else:
                    agent["animation"] = ANIM_IDLE

                # 更新指标
                if status == STATUS_WORKING:
                    agent["metrics"]["tasks_today"] = agent["metrics"].get("tasks_today", 0) + 1
                    agent["metrics"]["tasks_total"] = agent["metrics"].get("tasks_total", 0) + 1

                self._save()
                return agent
        return None

    def move_agent(self, agent_id: str, x: float, z: float) -> Optional[Dict[str, Any]]:
        """手动移动 Agent 到指定位置。"""
        for agent in self.agents:
            if agent["id"] == agent_id:
                agent["position"] = {"x": round(x, 2), "y": 0, "z": round(z, 2)}
                agent["animation"] = ANIM_WALK
                self._save()
                return agent
        return None

    def get_agent(self, agent_id: str) -> Optional[Dict[str, Any]]:
        """获取单个 Agent 详情。"""
        for agent in self.agents:
            if agent["id"] == agent_id:
                return agent
        return None

    def get_scene_config(self) -> Dict[str, Any]:
        """获取场景配置。"""
        return self.scene

    def update_scene_config(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """更新场景配置。"""
        self.scene.update(config)
        self._save()
        return self.scene
