#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
企业知识库管理模块。

提供企业级知识库的 CRUD 操作及版本管理功能，包括知识库的创建、
分类、快照和回滚。使用 JSON 文件作为底层存储介质，独立于原生知识库。

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
import shutil
from datetime import datetime
from typing import List, Optional, Dict, Any


class EnterpriseKBManager:
    """
    企业知识库管理器。

    负责企业知识库的增删改查、分类管理和版本控制。
    每个知识库包含:
    - name: 知识库名称
    - description: 知识库描述
    - category: 分类标签
    - doc_count: 文档总数
    - version: 当前版本号
    - snapshots: 版本快照历史
    """

    def __init__(self, data_dir: str):
        """
        初始化企业知识库管理器。

        Args:
            data_dir: 数据存储目录路径
        """
        self.data_dir = data_dir
        self.store_path = os.path.join(data_dir, "enterprise_knowledge_bases.json")
        self.versions_dir = os.path.join(data_dir, "enterprise_kb_versions")
        self._kbs: List[Dict[str, Any]] = []
        self._load()

    def _load(self):
        """从文件加载知识库数据。"""
        if os.path.exists(self.store_path):
            try:
                with open(self.store_path, "r", encoding="utf-8") as f:
                    self._kbs = json.load(f)
            except (json.JSONDecodeError, IOError):
                self._kbs = []
        else:
            self._kbs = []

    def _save(self):
        """持久化知识库数据到文件。"""
        os.makedirs(os.path.dirname(self.store_path), exist_ok=True)
        with open(self.store_path, "w", encoding="utf-8") as f:
            json.dump(self._kbs, f, ensure_ascii=False, indent=2)

    def list_all(self) -> List[Dict[str, Any]]:
        """获取所有知识库。"""
        return self._kbs

    def get(self, kb_id: str) -> Optional[Dict[str, Any]]:
        """
        根据 ID 获取知识库。

        Args:
            kb_id: 知识库唯一标识符

        Returns:
            知识库字典，未找到返回 None
        """
        for kb in self._kbs:
            if kb.get("id") == kb_id:
                return kb
        return None

    def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        创建新知识库。

        Args:
            data: 知识库数据（name, description, category）

        Returns:
            创建后的完整知识库字典
        """
        kb = {
            "id": str(uuid.uuid4()),
            "name": data.get("name", ""),
            "description": data.get("description", ""),
            "category": data.get("category", ""),
            "doc_count": 0,
            "version": 1,
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }
        self._kbs.append(kb)
        self._save()
        return kb

    def update(self, kb_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        更新知识库。

        Args:
            kb_id: 知识库唯一标识符
            data: 待更新的字段

        Returns:
            更新后的知识库字典，未找到返回 None
        """
        for i, kb in enumerate(self._kbs):
            if kb.get("id") == kb_id:
                for key in ["name", "description", "category"]:
                    if key in data:
                        kb[key] = data[key]
                kb["updated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                self._kbs[i] = kb
                self._save()
                return kb
        return None

    def delete(self, kb_id: str) -> bool:
        """
        删除知识库及其所有版本快照。

        Args:
            kb_id: 知识库唯一标识符

        Returns:
            是否成功删除
        """
        original_len = len(self._kbs)
        self._kbs = [kb for kb in self._kbs if kb.get("id") != kb_id]
        if len(self._kbs) < original_len:
            self._save()
            # 清理版本目录
            version_path = os.path.join(self.versions_dir, kb_id)
            if os.path.exists(version_path):
                shutil.rmtree(version_path, ignore_errors=True)
            return True
        return False

    # ═══════════════════════════════════════════
    # 版本管理
    # ═══════════════════════════════════════════

    def create_snapshot(self, kb_id: str) -> Optional[Dict[str, Any]]:
        """
        创建知识库版本快照。

        Args:
            kb_id: 知识库唯一标识符

        Returns:
            版本快照信息，知识库未找到返回 None
        """
        kb = self.get(kb_id)
        if not kb:
            return None

        version_dir = os.path.join(self.versions_dir, kb_id)
        os.makedirs(version_dir, exist_ok=True)

        snapshot = {
            "version": kb.get("version", 1),
            "kb_name": kb.get("name", ""),
            "doc_count": kb.get("doc_count", 0),
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "snapshot_data": json.dumps(kb, ensure_ascii=False),
        }

        snapshot_file = os.path.join(version_dir, f"v{snapshot['version']}.json")
        with open(snapshot_file, "w", encoding="utf-8") as f:
            json.dump(snapshot, f, ensure_ascii=False, indent=2)

        # 递增版本号
        for i, item in enumerate(self._kbs):
            if item.get("id") == kb_id:
                self._kbs[i]["version"] = kb.get("version", 1) + 1
                self._kbs[i]["updated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                break
        self._save()

        return snapshot

    def list_versions(self, kb_id: str) -> List[Dict[str, Any]]:
        """
        列出知识库的所有版本快照。

        Args:
            kb_id: 知识库唯一标识符

        Returns:
            版本快照列表，按版本号降序排列
        """
        version_dir = os.path.join(self.versions_dir, kb_id)
        versions = []
        if os.path.exists(version_dir):
            for fname in os.listdir(version_dir):
                if fname.endswith(".json"):
                    fpath = os.path.join(version_dir, fname)
                    try:
                        with open(fpath, "r", encoding="utf-8") as f:
                            versions.append(json.load(f))
                    except (json.JSONDecodeError, IOError):
                        continue
        return sorted(versions, key=lambda v: v.get("version", 0), reverse=True)

    def rollback(self, kb_id: str, version: int) -> Optional[Dict[str, Any]]:
        """
        将知识库回滚到指定版本。

        Args:
            kb_id: 知识库唯一标识符
            version: 目标版本号

        Returns:
            回滚后的知识库数据，失败返回 None
        """
        version_dir = os.path.join(self.versions_dir, kb_id)
        snapshot_file = os.path.join(version_dir, f"v{version}.json")

        if not os.path.exists(snapshot_file):
            return None

        try:
            with open(snapshot_file, "r", encoding="utf-8") as f:
                snapshot = json.load(f)
            restored_data = json.loads(snapshot.get("snapshot_data", "{}"))

            for i, kb in enumerate(self._kbs):
                if kb.get("id") == kb_id:
                    # 保留 ID 和版本号
                    restored_data["id"] = kb_id
                    restored_data["updated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    self._kbs[i] = restored_data
                    self._save()
                    return restored_data
        except (json.JSONDecodeError, IOError):
            return None

        return None
