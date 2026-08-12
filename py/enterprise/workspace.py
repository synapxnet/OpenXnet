#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
工作空间管理器 — 多环境工作区 CRUD 与 Docker/SSH 接口。

支持四种环境类型:
  - local:   本地文件系统工作区
  - docker:  Docker 容器 (本地/远程 daemon)
  - cloud:   SSH 连接云服务器
  - sandbox: 一次性沙盒容器

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
import uuid
import logging
import os
from datetime import datetime
from typing import List, Dict, Any, Optional

logger = logging.getLogger("openxnet.enterprise.workspace")


class WorkspaceManager:
    """
    工作空间管理器。
    JSON 文件持久化，支持本地/Docker/云服务器/沙盒四种环境。
    """

    def __init__(self, data_dir: str = ""):
        self.data_dir = data_dir or os.path.join(os.path.dirname(__file__), "..", "..", "data", "enterprise")
        os.makedirs(self.data_dir, exist_ok=True)
        self.data_file = os.path.join(self.data_dir, "workspaces.json")
        self.envs: List[Dict[str, Any]] = []
        self._load()

    def _load(self):
        """从 JSON 文件加载工作空间列表。"""
        try:
            if os.path.exists(self.data_file):
                with open(self.data_file, "r", encoding="utf-8") as f:
                    self.envs = json.load(f)
        except Exception as e:
            logger.warning(f"[Workspace] Failed to load: {e}")
            self.envs = []

    def _save(self):
        """持久化到 JSON 文件。"""
        try:
            with open(self.data_file, "w", encoding="utf-8") as f:
                json.dump(self.envs, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"[Workspace] Failed to save: {e}")

    def list_envs(self) -> List[Dict[str, Any]]:
        """返回所有工作空间环境。"""
        return self.envs

    def create_env(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """创建新的工作空间环境。"""
        env = {
            "id": str(uuid.uuid4()),
            "name": data.get("name", "Unnamed"),
            "type": data.get("type", "local"),
            "status": "stopped",
            "config": data.get("config", {}),
            "role_card_id": data.get("role_card_id"),
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
        }
        self.envs.append(env)
        self._save()
        return env

    def update_env(self, env_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """更新工作空间环境。"""
        for env in self.envs:
            if env["id"] == env_id:
                for key in ["name", "type", "config", "role_card_id", "status"]:
                    if key in data:
                        env[key] = data[key]
                env["updated_at"] = datetime.now().isoformat()
                self._save()
                return env
        return None

    def delete_env(self, env_id: str) -> bool:
        """删除工作空间环境。"""
        original_len = len(self.envs)
        self.envs = [e for e in self.envs if e["id"] != env_id]
        if len(self.envs) < original_len:
            self._save()
            return True
        return False

    def get_env(self, env_id: str) -> Optional[Dict[str, Any]]:
        """按 ID 获取单个环境。"""
        for env in self.envs:
            if env["id"] == env_id:
                return env
        return None

    # ═══════════════════════════════════════════
    # Docker 操作 (本地 + 远程)
    # ═══════════════════════════════════════════

    async def docker_start(self, env_id: str) -> Dict[str, Any]:
        """启动 Docker 容器。"""
        env = self.get_env(env_id)
        if not env or env["type"] not in ("docker", "sandbox"):
            return {"success": False, "error": "Invalid environment type"}

        try:
            import docker as docker_sdk
            daemon_url = env.get("config", {}).get("docker", {}).get("daemon_url", "")
            if daemon_url:
                client = docker_sdk.DockerClient(base_url=daemon_url)
            else:
                client = docker_sdk.from_env()

            image = env["config"].get("docker", {}).get("image", "ubuntu:22.04")
            container = client.containers.run(
                image,
                detach=True,
                name=f"openxnet-ws-{env_id[:8]}",
                tty=True,
            )
            env["config"]["docker"]["container_id"] = container.id
            env["status"] = "running"
            self._save()
            return {"success": True, "container_id": container.id}
        except Exception as e:
            logger.error(f"[Workspace] Docker start failed: {e}")
            env["status"] = "error"
            self._save()
            return {"success": False, "error": str(e)}

    async def docker_stop(self, env_id: str) -> Dict[str, Any]:
        """停止 Docker 容器。"""
        env = self.get_env(env_id)
        if not env:
            return {"success": False, "error": "Environment not found"}

        try:
            import docker as docker_sdk
            daemon_url = env.get("config", {}).get("docker", {}).get("daemon_url", "")
            if daemon_url:
                client = docker_sdk.DockerClient(base_url=daemon_url)
            else:
                client = docker_sdk.from_env()

            container_id = env["config"].get("docker", {}).get("container_id", "")
            if container_id:
                container = client.containers.get(container_id)
                container.stop()
                container.remove()

            env["status"] = "stopped"
            env["config"]["docker"]["container_id"] = ""
            self._save()
            return {"success": True}
        except Exception as e:
            logger.error(f"[Workspace] Docker stop failed: {e}")
            return {"success": False, "error": str(e)}

    async def docker_list_containers(self) -> List[Dict[str, Any]]:
        """列出所有 OpenXnet 管理的 Docker 容器。"""
        try:
            import docker as docker_sdk
            client = docker_sdk.from_env()
            containers = client.containers.list(all=True, filters={"name": "openxnet-ws-"})
            return [
                {
                    "id": c.id[:12],
                    "name": c.name,
                    "status": c.status,
                    "image": str(c.image.tags[0]) if c.image.tags else "unknown",
                }
                for c in containers
            ]
        except Exception as e:
            logger.warning(f"[Workspace] Docker list failed: {e}")
            return []
