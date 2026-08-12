# -*- coding: utf-8 -*-
"""AgentTeams CLI 的有界适配器、资源生成和映射持久化。"""

from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
from typing import Any, TypeAlias


AGENTTEAMS_API_VERSION = "agentteams.io/v1beta1"
AGENTTEAMS_STATUS_SCHEMA = "openxnet.agentteams.status.v1"
AGENTTEAMS_TEAM_SCHEMA = "openxnet.agentteams.team.v1"
AGENTTEAMS_MAPPING_SCHEMA = "openxnet.agentteams.mapping.v1"
AGENTTEAMS_RESOURCE_NAME = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")
AGENTTEAMS_MODEL_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$")
AGENTTEAMS_SKILL_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._/-]{0,127}$")
AGENTTEAMS_RUNTIMES = frozenset({"openclaw", "copaw", "hermes"})
AGENTTEAMS_MEMBER_ROLES = frozenset({"team_leader", "worker"})
MAX_COMMAND_OUTPUT_BYTES = 1024 * 1024


@dataclass(frozen=True, slots=True)
class AgentTeamsCommandResult:
    """保存一次固定 CLI 调用的退出码和有界输出。"""

    returncode: int
    stdout: str
    stderr: str


AgentTeamsCommandRunner: TypeAlias = Callable[
    [str, Sequence[str], float],
    AgentTeamsCommandResult,
]


class AgentTeamsRuntimeError(RuntimeError):
    """表示经过稳定错误码分类的 AgentTeams 适配失败。"""

    def __init__(self, code: str, message: str, *, retryable: bool) -> None:
        """保存错误码、公开消息和重试属性；输入分类字段，无返回。"""

        super().__init__(message)
        self.code = code
        self.retryable = retryable


class AgentTeamsCliAdapter:
    """通过固定 agt 子命令管理 AgentTeams Team，不暴露通用进程入口。"""

    def __init__(
        self,
        mapping_root: Path,
        *,
        executable: str | None = None,
        command_runner: AgentTeamsCommandRunner | None = None,
    ) -> None:
        """保存 Main 注入的映射目录和 CLI 依赖；输入路径与测试替身，无返回。"""

        self._mapping_root = mapping_root.resolve()
        self._configured_executable = executable.strip() if executable else ""
        self._command_runner = command_runner or run_agentteams_command

    def status(self) -> dict[str, Any]:
        """检测 CLI 和 Controller；无输入，返回脱敏状态，连接失败不会抛出异常。"""

        executable = self._resolve_executable()
        if executable is None:
            return self._status_result(
                cli_available=False,
                controller_reachable=False,
                error_code="AGENTTEAMS_CLI_UNAVAILABLE",
                retryable=False,
            )
        try:
            version = self._run_json(executable, ["version", "-o", "json"], 15.0)
            status = self._run_json(executable, ["status", "-o", "json"], 15.0)
            return self._status_result(
                cli_available=True,
                controller_reachable=True,
                controller_version=self._optional_text(version.get("controller"), 128),
                kube_mode=self._optional_text(
                    status.get("kubeMode", version.get("kubeMode")),
                    32,
                ),
                total_workers=self._bounded_count(status.get("totalWorkers")),
                total_teams=self._bounded_count(status.get("totalTeams")),
                total_humans=self._bounded_count(status.get("totalHumans")),
            )
        except AgentTeamsRuntimeError as error:
            return self._status_result(
                cli_available=True,
                controller_reachable=False,
                error_code=error.code,
                retryable=error.retryable,
            )

    def apply_team(self, value: Mapping[str, Any]) -> dict[str, Any]:
        """生成并应用 Worker/Team 资源；输入结构化请求，返回状态，非法字段时抛出异常。"""

        request = parse_agentteams_apply_team_request(value)
        executable = self._require_executable()
        documents = build_agentteams_resource_documents(request)
        self._mapping_root.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(
            prefix="openxnet-agentteams-",
            dir=self._mapping_root,
        ) as directory:
            manifest_path = Path(directory) / "resources.yaml"
            manifest_path.write_text(
                "\n---\n".join(
                    json.dumps(document, ensure_ascii=False, separators=(",", ":"))
                    for document in documents
                ) + "\n",
                encoding="utf-8",
                newline="\n",
            )
            self._run(executable, ["apply", "-f", str(manifest_path)], 120.0)

        team = request["team"]
        team_name = str(team["name"])
        worker_names = [str(member["name"]) for member in team["members"]]
        self._write_mapping(str(request["workspaceId"]), team_name, worker_names)
        return self.get_team({"teamName": team_name}, operation="apply")

    def get_team(
        self,
        value: Mapping[str, Any],
        *,
        operation: str = "get",
    ) -> dict[str, Any]:
        """查询并投影 Team 状态；输入名称与操作，返回有界字段，CLI 失败时抛出异常。"""

        team_name = parse_agentteams_team_name_request(value)
        executable = self._require_executable()
        raw = self._run_json(executable, ["get", "teams", team_name, "-o", "json"], 30.0)
        worker_names = self._string_list(raw.get("workerNames"), 64)
        mapping = self._read_mapping(team_name)
        return {
            "schema": AGENTTEAMS_TEAM_SCHEMA,
            "operation": operation,
            "success": True,
            "workspace_id": self._optional_text(mapping.get("workspaceId"), 128),
            "team_name": team_name,
            "phase": self._optional_text(raw.get("phase"), 32) or "Pending",
            "leader_name": self._optional_text(raw.get("leaderName"), 63),
            "ready_workers": self._bounded_count(raw.get("readyWorkers")),
            "total_workers": self._bounded_count(raw.get("totalWorkers")),
            "team_room_id": self._optional_text(raw.get("teamRoomID"), 256),
            "leader_dm_room_id": self._optional_text(raw.get("leaderDMRoomID"), 256),
            "worker_names": worker_names,
            "message": self._optional_text(raw.get("message"), 1024),
            "error_code": None,
            "retryable": False,
        }

    def _resolve_executable(self) -> str | None:
        """解析 Main 配置或 PATH 中的 agt；无输入，返回可执行文件名，不访问 Renderer 数据。"""

        if self._configured_executable:
            candidate = Path(self._configured_executable)
            if candidate.is_absolute() and candidate.is_file():
                return str(candidate)
            return None
        return shutil.which("agt")

    def _require_executable(self) -> str:
        """要求 agt 可用；无输入，返回绝对路径，缺失时抛出稳定异常。"""

        executable = self._resolve_executable()
        if executable is None:
            raise AgentTeamsRuntimeError(
                "AGENTTEAMS_CLI_UNAVAILABLE",
                "AgentTeams CLI is unavailable.",
                retryable=False,
            )
        return executable

    def _run(self, executable: str, arguments: Sequence[str], timeout: float) -> AgentTeamsCommandResult:
        """执行一个固定 agt 参数序列；输入命令和预算，返回结果，失败时抛出脱敏异常。"""

        try:
            result = self._command_runner(executable, arguments, timeout)
        except subprocess.TimeoutExpired as error:
            raise AgentTeamsRuntimeError(
                "AGENTTEAMS_TIMEOUT",
                "AgentTeams command timed out.",
                retryable=True,
            ) from error
        except OSError as error:
            raise AgentTeamsRuntimeError(
                "AGENTTEAMS_CLI_UNAVAILABLE",
                "AgentTeams CLI could not be started.",
                retryable=False,
            ) from error
        if result.returncode != 0:
            raise AgentTeamsRuntimeError(
                "AGENTTEAMS_CONTROLLER_UNREACHABLE",
                "AgentTeams command failed.",
                retryable=True,
            )
        return result

    def _run_json(self, executable: str, arguments: Sequence[str], timeout: float) -> dict[str, Any]:
        """执行固定命令并解析 JSON；输入参数和预算，返回对象，非法输出时抛出异常。"""

        result = self._run(executable, arguments, timeout)
        try:
            value = json.loads(result.stdout)
        except json.JSONDecodeError as error:
            raise AgentTeamsRuntimeError(
                "AGENTTEAMS_INVALID_RESPONSE",
                "AgentTeams returned an invalid response.",
                retryable=True,
            ) from error
        if not isinstance(value, dict):
            raise AgentTeamsRuntimeError(
                "AGENTTEAMS_INVALID_RESPONSE",
                "AgentTeams returned an invalid response.",
                retryable=True,
            )
        return value

    def _write_mapping(self, workspace_id: str, team_name: str, worker_names: Sequence[str]) -> None:
        """原子保存 OpenXnet 与 AgentTeams 映射；输入标识，无返回，写入失败时抛出异常。"""

        mapping_path = self._mapping_path(team_name)
        temporary_path = mapping_path.with_suffix(".tmp")
        mapping = {
            "schema": AGENTTEAMS_MAPPING_SCHEMA,
            "workspaceId": workspace_id,
            "teamName": team_name,
            "workerNames": list(worker_names),
            "updatedAt": datetime.now(UTC).isoformat(),
        }
        mapping_path.parent.mkdir(parents=True, exist_ok=True)
        temporary_path.write_text(
            json.dumps(mapping, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
            newline="\n",
        )
        os.replace(temporary_path, mapping_path)

    def _read_mapping(self, team_name: str) -> dict[str, Any]:
        """读取并校验本地 Team 映射；输入名称，返回安全对象，缺失或损坏时返回空对象。"""

        try:
            value = json.loads(self._mapping_path(team_name).read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return {}
        if not isinstance(value, dict) or value.get("schema") != AGENTTEAMS_MAPPING_SCHEMA:
            return {}
        if value.get("teamName") != team_name:
            return {}
        return value

    def _mapping_path(self, team_name: str) -> Path:
        """生成受控映射文件路径；输入已校验名称，返回映射目录下的 JSON 路径。"""

        return self._mapping_root / "teams" / f"{team_name}.json"

    def _status_result(
        self,
        *,
        cli_available: bool,
        controller_reachable: bool,
        controller_version: str = "",
        kube_mode: str = "",
        total_workers: int = 0,
        total_teams: int = 0,
        total_humans: int = 0,
        error_code: str | None = None,
        retryable: bool = False,
    ) -> dict[str, Any]:
        """构建固定公开状态；输入检测字段，返回完整状态对象，无副作用。"""

        return {
            "schema": AGENTTEAMS_STATUS_SCHEMA,
            "cli_available": cli_available,
            "controller_reachable": controller_reachable,
            "controller_version": controller_version,
            "kube_mode": kube_mode,
            "total_workers": total_workers,
            "total_teams": total_teams,
            "total_humans": total_humans,
            "error_code": error_code,
            "retryable": retryable,
        }

    def _optional_text(self, value: Any, maximum_length: int) -> str:
        """投影可选有界文本；输入值和长度，返回安全文本，无效值返回空字符串。"""

        if not isinstance(value, str):
            return ""
        return value.strip()[:maximum_length]

    def _bounded_count(self, value: Any) -> int:
        """投影非负计数；输入未知值，返回不超过一百万的整数，无效值返回零。"""

        if isinstance(value, bool) or not isinstance(value, int):
            return 0
        return max(0, min(value, 1_000_000))

    def _string_list(self, value: Any, maximum_items: int) -> list[str]:
        """投影有界字符串列表；输入未知值和数量，返回校验后的资源名称。"""

        if not isinstance(value, list):
            return []
        result: list[str] = []
        for item in value[:maximum_items]:
            if isinstance(item, str) and AGENTTEAMS_RESOURCE_NAME.fullmatch(item):
                result.append(item)
        return result


def parse_agentteams_apply_team_request(value: Mapping[str, Any]) -> dict[str, Any]:
    """校验 Team 同步请求；输入映射，返回防御性副本，字段或预算无效时抛出 ValueError。"""

    _require_fields(value, {"workspaceId", "team"})
    workspace_id = _require_text(value.get("workspaceId"), "workspaceId", 128)
    team_value = value.get("team")
    if not isinstance(team_value, Mapping):
        raise ValueError("AgentTeams team must be an object.")
    _require_fields(team_value, {"name", "description", "heartbeatEvery", "members"})
    team_name = _require_resource_name(team_value.get("name"), "team.name")
    description = _require_text(team_value.get("description"), "team.description", 2048)
    heartbeat = _require_text(team_value.get("heartbeatEvery"), "team.heartbeatEvery", 16)
    if not re.fullmatch(r"[1-9][0-9]{0,3}[mh]", heartbeat):
        raise ValueError("AgentTeams heartbeat interval is invalid.")
    members_value = team_value.get("members")
    if not isinstance(members_value, list) or not 3 <= len(members_value) <= 16:
        raise ValueError("AgentTeams team must contain between 3 and 16 members.")
    members = [_parse_member(member, index) for index, member in enumerate(members_value)]
    names = [str(member["name"]) for member in members]
    if len(names) != len(set(names)):
        raise ValueError("AgentTeams member names must be unique.")
    leaders = [member for member in members if member["role"] == "team_leader"]
    if len(leaders) != 1:
        raise ValueError("AgentTeams team must contain exactly one team leader.")
    if leaders[0]["runtime"] == "hermes":
        raise ValueError("AgentTeams team leader runtime is invalid.")
    return {
        "workspaceId": workspace_id,
        "team": {
            "name": team_name,
            "description": description,
            "heartbeatEvery": heartbeat,
            "members": members,
        },
    }


def parse_agentteams_team_name_request(value: Mapping[str, Any]) -> str:
    """校验 Team 查询请求；输入映射，返回资源名称，额外或非法字段时抛出 ValueError。"""

    _require_fields(value, {"teamName"})
    return _require_resource_name(value.get("teamName"), "teamName")


def build_agentteams_resource_documents(request: Mapping[str, Any]) -> list[dict[str, Any]]:
    """构建官方 Worker 和 Team 文档；输入已校验请求，返回按依赖排序的资源列表。"""

    team = request["team"]
    if not isinstance(team, Mapping):
        raise TypeError("AgentTeams normalized team is invalid.")
    members = team["members"]
    if not isinstance(members, list):
        raise TypeError("AgentTeams normalized members are invalid.")
    documents: list[dict[str, Any]] = []
    for member in members:
        if not isinstance(member, Mapping):
            raise TypeError("AgentTeams normalized member is invalid.")
        documents.append({
            "apiVersion": AGENTTEAMS_API_VERSION,
            "kind": "Worker",
            "metadata": {"name": member["name"]},
            "spec": {
                "model": member["model"],
                "runtime": member["runtime"],
                "identity": member["identity"],
                "agents": member["instructions"],
                "skills": member["skills"],
                "state": "Running",
            },
        })
    documents.append({
        "apiVersion": AGENTTEAMS_API_VERSION,
        "kind": "Team",
        "metadata": {"name": team["name"]},
        "spec": {
            "description": team["description"],
            "heartbeatEvery": team["heartbeatEvery"],
            "workerMembers": [
                {"name": member["name"], "role": member["role"]}
                for member in members
            ],
        },
    })
    return documents


def run_agentteams_command(
    executable: str,
    arguments: Sequence[str],
    timeout: float,
) -> AgentTeamsCommandResult:
    """以固定环境执行 agt；输入可执行文件、参数和超时，返回有界输出，不使用 shell。"""

    environment_keys = (
        "AGENTTEAMS_AUTH_TOKEN_FILE",
        "AGENTTEAMS_CONTROLLER_URL",
        "HOME",
        "LANG",
        "PATH",
        "SYSTEMROOT",
        "TEMP",
        "TMP",
        "USERPROFILE",
        "WINDIR",
    )
    environment = {key: os.environ[key] for key in environment_keys if key in os.environ}
    completed = subprocess.run(
        [executable, *arguments],
        check=False,
        capture_output=True,
        encoding="utf-8",
        errors="replace",
        env=environment,
        shell=False,
        timeout=timeout,
    )
    stdout = completed.stdout[:MAX_COMMAND_OUTPUT_BYTES]
    stderr = completed.stderr[:MAX_COMMAND_OUTPUT_BYTES]
    return AgentTeamsCommandResult(completed.returncode, stdout, stderr)


def _parse_member(value: Any, index: int) -> dict[str, Any]:
    """校验一个 Team 成员；输入未知值和索引，返回防御性字典，无效时抛出 ValueError。"""

    if not isinstance(value, Mapping):
        raise ValueError(f"AgentTeams member {index} must be an object.")
    _require_fields(value, {"name", "role", "model", "runtime", "identity", "instructions", "skills"})
    role = _require_text(value.get("role"), f"members[{index}].role", 32)
    if role not in AGENTTEAMS_MEMBER_ROLES:
        raise ValueError("AgentTeams member role is invalid.")
    runtime = _require_text(value.get("runtime"), f"members[{index}].runtime", 32)
    if runtime not in AGENTTEAMS_RUNTIMES:
        raise ValueError("AgentTeams member runtime is invalid.")
    model = _require_text(value.get("model"), f"members[{index}].model", 128)
    if not AGENTTEAMS_MODEL_ID.fullmatch(model):
        raise ValueError("AgentTeams member model is invalid.")
    skills_value = value.get("skills")
    if not isinstance(skills_value, list) or len(skills_value) > 32:
        raise ValueError("AgentTeams member skills are invalid.")
    skills: list[str] = []
    for skill in skills_value:
        normalized = _require_text(skill, f"members[{index}].skills", 128)
        if not AGENTTEAMS_SKILL_ID.fullmatch(normalized):
            raise ValueError("AgentTeams member skill is invalid.")
        skills.append(normalized)
    if len(skills) != len(set(skills)):
        raise ValueError("AgentTeams member skills must be unique.")
    return {
        "name": _require_resource_name(value.get("name"), f"members[{index}].name"),
        "role": role,
        "model": model,
        "runtime": runtime,
        "identity": _require_text(value.get("identity"), f"members[{index}].identity", 16 * 1024),
        "instructions": _require_text(
            value.get("instructions"),
            f"members[{index}].instructions",
            32 * 1024,
        ),
        "skills": skills,
    }


def _require_fields(value: Mapping[str, Any], expected: set[str]) -> None:
    """校验精确字段集合；输入映射与期望集合，无返回，不一致时抛出 ValueError。"""

    if set(value) != expected:
        raise ValueError("AgentTeams request fields are invalid.")


def _require_text(value: Any, field: str, maximum_length: int) -> str:
    """校验有界非空文本；输入值、字段和上限，返回文本，无效时抛出 ValueError。"""

    if not isinstance(value, str):
        raise ValueError(f"AgentTeams field '{field}' is invalid.")
    normalized = value.strip()
    if not normalized or len(normalized) > maximum_length:
        raise ValueError(f"AgentTeams field '{field}' is invalid.")
    return normalized


def _require_resource_name(value: Any, field: str) -> str:
    """校验 Kubernetes 风格资源名；输入值和字段，返回名称，无效时抛出 ValueError。"""

    normalized = _require_text(value, field, 63)
    if not AGENTTEAMS_RESOURCE_NAME.fullmatch(normalized):
        raise ValueError(f"AgentTeams field '{field}' is invalid.")
    return normalized
