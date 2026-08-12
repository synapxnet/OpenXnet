#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
职工角色卡管理模块。

提供企业级角色卡的 CRUD 操作，包括角色名、系统提示词、权限列表、
关联工具等的持久化存储。使用 JSON 文件作为底层存储介质，
后续可平滑迁移至 SQLite/PostgreSQL。

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

# Modification History:
# 2026-04-13, v1.0.0, maoyo: Initial creation.

import json
import os
import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any


class RoleCardManager:
    """
    职工角色卡管理器。

    负责角色卡的增删改查操作，数据存储在 JSON 文件中。
    每张角色卡包含:
    - name: 角色名称（如"客服专员"、"技术支持"）
    - description: 角色描述
    - system_prompt: 系统提示词
    - permissions: 权限列表
    - tools: 关联工具列表
    - enabled: 启用/停用状态
    """

    def __init__(self, data_dir: str):
        """
        初始化角色卡管理器。

        Args:
            data_dir: 数据存储目录路径
        """
        self.data_dir = data_dir
        self.store_path = os.path.join(data_dir, "enterprise_role_cards.json")
        self._cards: List[Dict[str, Any]] = []
        self._load()

    def _load(self):
        """从文件加载角色卡数据。"""
        if os.path.exists(self.store_path):
            try:
                with open(self.store_path, "r", encoding="utf-8") as f:
                    self._cards = json.load(f)
            except (json.JSONDecodeError, IOError):
                self._cards = []
        else:
            self._cards = []

    def _save(self):
        """持久化角色卡数据到文件。"""
        os.makedirs(os.path.dirname(self.store_path), exist_ok=True)
        with open(self.store_path, "w", encoding="utf-8") as f:
            json.dump(self._cards, f, ensure_ascii=False, indent=2)

    def list_all(self) -> List[Dict[str, Any]]:
        """获取所有角色卡。"""
        return self._cards

    def get(self, card_id: str) -> Optional[Dict[str, Any]]:
        """
        根据 ID 获取角色卡。

        Args:
            card_id: 角色卡唯一标识符

        Returns:
            角色卡字典，未找到返回 None
        """
        for card in self._cards:
            if card.get("id") == card_id:
                return card
        return None

    @staticmethod
    def _normalize_list(value: Any) -> List[Any]:
        if not isinstance(value, list):
            return []
        normalized: List[Any] = []
        seen = set()
        for item in value:
            if isinstance(item, str):
                cleaned = item.strip()
                if not cleaned or cleaned in seen:
                    continue
                seen.add(cleaned)
                normalized.append(cleaned)
                continue
            marker = json.dumps(item, ensure_ascii=False, sort_keys=True) if isinstance(item, dict) else repr(item)
            if marker in seen:
                continue
            seen.add(marker)
            normalized.append(item)
        return normalized

    def _build_card_payload(
        self,
        data: Dict[str, Any],
        *,
        existing: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        base: Dict[str, Any] = dict(existing or {})
        base.update({
            "id": str(data.get("id") or base.get("id") or uuid.uuid4()),
            "name": str(data.get("name", base.get("name", "")) or "").strip(),
            "description": str(data.get("description", base.get("description", "")) or "").strip(),
            "system_prompt": str(data.get("system_prompt", base.get("system_prompt", "")) or "").strip(),
            "permissions": self._normalize_list(data.get("permissions", base.get("permissions", []))),
            "tools": self._normalize_list(data.get("tools", base.get("tools", []))),
            "enabled": bool(data.get("enabled", base.get("enabled", True))),
            "department": str(data.get("department", base.get("department", "")) or "").strip(),
            "icon": str(data.get("icon", base.get("icon", "")) or "").strip(),
            "skills": self._normalize_list(data.get("skills", base.get("skills", []))),
            "skill_ids": self._normalize_list(data.get("skill_ids", base.get("skill_ids", []))),
            "assignedWorkspace": str(data.get("assignedWorkspace", base.get("assignedWorkspace", "")) or "").strip(),
            "projectId": str(data.get("projectId", base.get("projectId", "")) or "").strip(),
            "templateId": str(data.get("templateId", base.get("templateId", "")) or "").strip(),
            "category": str(data.get("category", base.get("category", "")) or "").strip(),
            "categoryZh": str(data.get("categoryZh", base.get("categoryZh", "")) or "").strip(),
            "categoryEn": str(data.get("categoryEn", base.get("categoryEn", "")) or "").strip(),
            "summaryZh": str(data.get("summaryZh", base.get("summaryZh", "")) or "").strip(),
            "summaryEn": str(data.get("summaryEn", base.get("summaryEn", "")) or "").strip(),
            "accent": self._normalize_list(data.get("accent", base.get("accent", []))),
            "runtime_system_prompt": str(
                data.get("runtime_system_prompt", base.get("runtime_system_prompt", ""))
                or ""
            ).strip(),
            "agent_name": str(data.get("agent_name", base.get("agent_name", "")) or "").strip(),
            "role_scope": str(data.get("role_scope", base.get("role_scope", "enterprise")) or "enterprise").strip(),
            "syncSource": str(data.get("syncSource", base.get("syncSource", "enterprise")) or "enterprise").strip(),
            "updated_at": now,
        })

        if existing:
            base["created_at"] = existing.get("created_at", now)
        else:
            base["created_at"] = now

        reserved_keys = {
            "id",
            "name",
            "description",
            "system_prompt",
            "permissions",
            "tools",
            "enabled",
            "department",
            "icon",
            "skills",
            "skill_ids",
            "assignedWorkspace",
            "projectId",
            "templateId",
            "category",
            "categoryZh",
            "categoryEn",
            "summaryZh",
            "summaryEn",
            "accent",
            "runtime_system_prompt",
            "agent_name",
            "role_scope",
            "syncSource",
            "created_at",
            "updated_at",
        }
        for key, value in data.items():
            if key in reserved_keys or key == "id":
                continue
            base[key] = value

        return base

    def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        创建新角色卡。

        Args:
            data: 角色卡数据（name, description, system_prompt, permissions, tools, enabled）

        Returns:
            创建后的完整角色卡字典（含 id 和时间戳）
        """
        card = self._build_card_payload(data)
        self._cards.append(card)
        self._save()
        return card

    def update(self, card_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        更新角色卡。

        Args:
            card_id: 角色卡唯一标识符
            data: 待更新的字段

        Returns:
            更新后的角色卡字典，未找到返回 None
        """
        for i, card in enumerate(self._cards):
            if card.get("id") == card_id:
                card = self._build_card_payload(data, existing=card)
                self._cards[i] = card
                self._save()
                return card
        return None

    def delete(self, card_id: str) -> bool:
        """
        删除角色卡。

        Args:
            card_id: 角色卡唯一标识符

        Returns:
            是否成功删除
        """
        original_len = len(self._cards)
        self._cards = [c for c in self._cards if c.get("id") != card_id]
        if len(self._cards) < original_len:
            self._save()
            return True
        return False
