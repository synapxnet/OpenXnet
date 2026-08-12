#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright 2026 Synapxnet
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
# ==============================================================================
"""
Docker API — Docker 容器环境检测。

Author: maoyo
Date: 2026-04-13
Version: 1.0.0
"""

__version__ = "1.0.0"
__author__ = "maoyo"
__copyright__ = "Copyright 2026 Synapxnet"
__license__ = "Apache-2.0"
__maintainer__ = "maoyo"
__email__ = "synapxnet@gmail.com"

import json
import shutil
import subprocess
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/docker")


class DockerPullRequest(BaseModel):
    image: str


def _docker_path() -> str:
    docker = shutil.which("docker")
    if not docker:
        raise HTTPException(status_code=404, detail="Docker command not found")
    return docker


def _run_docker(args: List[str], timeout: int = 30) -> Dict[str, Any]:
    docker = _docker_path()
    try:
        completed = subprocess.run(
            [docker, *args],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise HTTPException(status_code=504, detail=f"Docker command timed out: {' '.join(args)}") from exc

    stdout = completed.stdout or ""
    stderr = completed.stderr or ""
    if completed.returncode != 0:
        raise HTTPException(status_code=500, detail=(stderr or stdout or "Docker command failed").strip())
    return {
        "stdout": stdout,
        "stderr": stderr,
        "returncode": completed.returncode,
    }


def _container_status_kind(status_text: str) -> str:
    normalized = (status_text or "").lower()
    if normalized.startswith("up"):
        return "active"
    if "paused" in normalized or "restarting" in normalized:
        return "maintenance"
    if "exited" in normalized or "created" in normalized:
        return "gray"
    return "gray"


def _load_container_stats(containers: List[Dict[str, Any]]) -> Dict[str, Dict[str, str]]:
    running = [
        item for item in containers
        if item.get("statusKind") == "active" and (item.get("id") or item.get("name"))
    ]
    if not running:
        return {}

    identifiers = [item.get("id") or item.get("name") for item in running]
    try:
        result = _run_docker(
            ["stats", "--no-stream", "--format", "{{json .}}", *identifiers],
            timeout=20,
        )
    except HTTPException:
        return {}

    stats: Dict[str, Dict[str, str]] = {}
    for line in result["stdout"].splitlines():
        raw = line.strip()
        if not raw:
            continue
        try:
            item = json.loads(raw)
        except json.JSONDecodeError:
            continue
        keys = [
            item.get("ID"),
            item.get("Container"),
            item.get("Name"),
        ]
        stat_payload = {
            "cpu": item.get("CPUPerc") or "--",
            "memory": item.get("MemUsage") or "--",
        }
        for key in keys:
            if key:
                stats[str(key)] = stat_payload
    return stats

@router.get("/probe")
def probe_docker():
    """
    检查系统环境变量中是否有 docker 命令
    shutil.which 在 Windows 下会检查 .exe, Linux/Mac 下检查执行权限
    """
    docker_path = shutil.which("docker")
    return {
        "installed": docker_path is not None,
        "path": docker_path  # 可选：返回具体安装路径
    }


@router.get("/containers")
def list_docker_containers():
    docker_path = shutil.which("docker")
    if docker_path is None:
        return {
            "installed": False,
            "containers": [],
        }

    result = _run_docker(["ps", "-a", "--format", "{{json .}}"], timeout=20)
    containers = []
    for line in result["stdout"].splitlines():
        raw = line.strip()
        if not raw:
            continue
        try:
            item = json.loads(raw)
        except json.JSONDecodeError:
            continue
        status_text = item.get("Status") or item.get("State") or ""
        containers.append({
            "id": item.get("ID") or "",
            "name": item.get("Names") or "",
            "image": item.get("Image") or "",
            "status": status_text,
            "statusKind": _container_status_kind(status_text),
            "ports": item.get("Ports") or "--",
            "cpu": "--",
            "memory": "--",
        })

    stats = _load_container_stats(containers)
    for container in containers:
        stat = (
            stats.get(str(container.get("id") or ""))
            or stats.get(str(container.get("name") or ""))
        )
        if stat:
            container["cpu"] = stat.get("cpu") or "--"
            container["memory"] = stat.get("memory") or "--"

    return {
        "installed": True,
        "path": docker_path,
        "containers": containers,
    }


@router.post("/pull")
def pull_docker_image(req: DockerPullRequest):
    image = (req.image or "").strip()
    if not image:
        raise HTTPException(status_code=400, detail="Image name is required")
    result = _run_docker(["pull", image], timeout=180)
    return {
        "success": True,
        "image": image,
        "output": result["stdout"][-4000:],
    }


@router.post("/containers/{container_name}/start")
def start_docker_container(container_name: str):
    if not container_name.strip():
        raise HTTPException(status_code=400, detail="Container name is required")
    _run_docker(["start", container_name], timeout=30)
    return {"success": True, "container": container_name}


@router.post("/containers/{container_name}/stop")
def stop_docker_container(container_name: str):
    if not container_name.strip():
        raise HTTPException(status_code=400, detail="Container name is required")
    _run_docker(["stop", container_name], timeout=45)
    return {"success": True, "container": container_name}


@router.post("/containers/{container_name}/restart")
def restart_docker_container(container_name: str):
    if not container_name.strip():
        raise HTTPException(status_code=400, detail="Container name is required")
    _run_docker(["restart", container_name], timeout=60)
    return {"success": True, "container": container_name}
