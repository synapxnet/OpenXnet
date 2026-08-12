# -*- coding: utf-8 -*-
"""验证 AgentTeams 资源契约、CLI 调用和 Worker 边界。"""

from __future__ import annotations

import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from py.agentteams_runtime import (
    AGENTTEAMS_API_VERSION,
    AgentTeamsCliAdapter,
    AgentTeamsCommandResult,
    build_agentteams_resource_documents,
    parse_agentteams_apply_team_request,
)
from py.workers.agentteams_worker import AgentTeamsWorkerHandlers
from py.workers.protocol import WorkerEnvelope


def create_team_request() -> dict[str, object]:
    """创建三个职能成员的固定请求；无输入，返回可复用测试数据。"""

    return {
        "workspaceId": "workspace-goai",
        "team": {
            "name": "goai-incident-team",
            "description": "AI 推理服务异常处置团队",
            "heartbeatEvery": "30m",
            "members": [
                {
                    "name": "incident-leader",
                    "role": "team_leader",
                    "model": "qwen3.5-plus",
                    "runtime": "copaw",
                    "identity": "事件指挥 Agent",
                    "instructions": "拆解任务并汇总证据，不直接执行生产变更。",
                    "skills": ["incident.normalize", "task.decompose"],
                },
                {
                    "name": "diagnosis-worker",
                    "role": "worker",
                    "model": "qwen3.5-plus",
                    "runtime": "copaw",
                    "identity": "诊断分析 Agent",
                    "instructions": "跨系统收集证据并输出可证伪根因。",
                    "skills": ["evidence.collect", "root-cause.analyze"],
                },
                {
                    "name": "verification-worker",
                    "role": "worker",
                    "model": "qwen3.5-plus",
                    "runtime": "copaw",
                    "identity": "验证审计 Agent",
                    "instructions": "独立验证恢复结果并生成审计报告。",
                    "skills": ["service.verify", "incident.review"],
                },
            ],
        },
    }


class FakeAgentTeamsRunner:
    """记录固定命令并返回确定性 AgentTeams JSON。"""

    def __init__(self) -> None:
        """初始化空调用列表；无输入和返回，不启动进程。"""

        self.calls: list[tuple[str, tuple[str, ...], float]] = []
        self.applied_documents: list[dict[str, object]] = []

    def __call__(
        self,
        executable: str,
        arguments: list[str] | tuple[str, ...],
        timeout: float,
    ) -> AgentTeamsCommandResult:
        """模拟 agt；输入命令参数，返回固定结果，并读取 apply 临时清单。"""

        self.calls.append((executable, tuple(arguments), timeout))
        if list(arguments) == ["version", "-o", "json"]:
            return self._json({"controller": "v1.2.0", "kubeMode": "embedded"})
        if list(arguments) == ["status", "-o", "json"]:
            return self._json({
                "kubeMode": "embedded",
                "totalWorkers": 3,
                "totalTeams": 1,
                "totalHumans": 1,
            })
        if len(arguments) == 3 and list(arguments[:2]) == ["apply", "-f"]:
            source = Path(arguments[2]).read_text(encoding="utf-8")
            self.applied_documents = [json.loads(part) for part in source.split("\n---\n")]
            return AgentTeamsCommandResult(0, "applied\n", "")
        if list(arguments) == ["get", "teams", "goai-incident-team", "-o", "json"]:
            return self._json({
                "name": "goai-incident-team",
                "phase": "Active",
                "leaderName": "incident-leader",
                "readyWorkers": 2,
                "totalWorkers": 2,
                "teamRoomID": "!team:agentteams.local",
                "leaderDMRoomID": "!leader:agentteams.local",
                "workerNames": ["diagnosis-worker", "verification-worker"],
            })
        return AgentTeamsCommandResult(1, "", "unexpected command")

    def _json(self, value: dict[str, object]) -> AgentTeamsCommandResult:
        """编码固定 JSON 结果；输入对象，返回成功命令结果。"""

        return AgentTeamsCommandResult(0, json.dumps(value), "")


class AgentTeamsWorkerProcessTests(unittest.TestCase):
    """验证 Main 实际启动参数下的独立 Worker 握手。"""

    def test_worker_process_accepts_mapping_root_and_serves_protocol(self) -> None:
        """启动真实 Worker；输入 ping/status/shutdown，返回三个关联响应且正常退出。"""

        with tempfile.TemporaryDirectory() as directory:
            requests = [
                WorkerEnvelope.request("agentteams", "system.ping"),
                WorkerEnvelope.request("agentteams", "agentteams.status"),
                WorkerEnvelope.request("agentteams", "system.shutdown"),
            ]
            completed = subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "py.workers.agentteams_worker",
                    "--mapping-root",
                    directory,
                ],
                cwd=Path(__file__).resolve().parents[1],
                input="".join(request.to_json_line() for request in requests),
                capture_output=True,
                encoding="utf-8",
                errors="strict",
                timeout=15,
                check=False,
            )
            self.assertEqual(completed.returncode, 0, completed.stderr)
            responses = [
                WorkerEnvelope.from_json_line(line)
                for line in completed.stdout.splitlines()
                if line.strip()
            ]
            self.assertEqual(len(responses), 3)
            self.assertEqual(responses[0].payload["capability"], "agentteams")
            self.assertEqual(responses[1].payload["schema"], "openxnet.agentteams.status.v1")
            self.assertEqual(responses[2].payload["status"], "stopping")


class AgentTeamsContractTests(unittest.TestCase):
    """验证 Team 结构和官方资源映射。"""

    def test_builds_workers_before_team_with_v1beta1_contract(self) -> None:
        """确认三个 Worker 先于 Team 输出，并使用官方 v1beta1 API。"""

        request = parse_agentteams_apply_team_request(create_team_request())
        documents = build_agentteams_resource_documents(request)

        self.assertEqual([document["kind"] for document in documents], ["Worker", "Worker", "Worker", "Team"])
        self.assertTrue(all(document["apiVersion"] == AGENTTEAMS_API_VERSION for document in documents))
        team_members = documents[-1]["spec"]["workerMembers"]
        self.assertEqual(team_members[0]["role"], "team_leader")

    def test_rejects_arbitrary_fields_and_invalid_leader_layout(self) -> None:
        """确认请求不能携带命令、路径或多个 Leader。"""

        request = create_team_request()
        request["command"] = "curl"
        with self.assertRaisesRegex(ValueError, "fields"):
            parse_agentteams_apply_team_request(request)

        request = create_team_request()
        request["team"]["members"][1]["role"] = "team_leader"
        with self.assertRaisesRegex(ValueError, "exactly one"):
            parse_agentteams_apply_team_request(request)


class AgentTeamsCliAdapterTests(unittest.TestCase):
    """验证固定 CLI 参数、映射持久化和公开状态。"""

    def test_status_and_apply_use_only_fixed_agt_commands(self) -> None:
        """确认状态和同步只调用白名单参数，并保存工作空间映射。"""

        with tempfile.TemporaryDirectory(prefix="openxnet-agentteams-test-") as directory:
            executable = Path(directory) / "agt.exe"
            executable.write_bytes(b"test")
            runner = FakeAgentTeamsRunner()
            adapter = AgentTeamsCliAdapter(
                Path(directory) / "mappings",
                executable=str(executable),
                command_runner=runner,
            )

            status = adapter.status()
            result = adapter.apply_team(create_team_request())
            mapping = json.loads(
                (Path(directory) / "mappings" / "teams" / "goai-incident-team.json")
                .read_text(encoding="utf-8")
            )

        self.assertTrue(status["controller_reachable"])
        self.assertEqual(status["controller_version"], "v1.2.0")
        self.assertEqual(result["phase"], "Active")
        self.assertEqual(mapping["workspaceId"], "workspace-goai")
        self.assertEqual([call[1][0] for call in runner.calls], ["version", "status", "apply", "get"])
        self.assertEqual(len(runner.applied_documents), 4)
        self.assertNotIn("command", json.dumps(runner.applied_documents))

    def test_missing_cli_returns_bounded_unavailable_status(self) -> None:
        """确认 CLI 缺失时状态查询不泄露路径或内部异常。"""

        with tempfile.TemporaryDirectory(prefix="openxnet-agentteams-test-") as directory:
            adapter = AgentTeamsCliAdapter(
                Path(directory) / "mappings",
                executable=str(Path(directory) / "missing-agt.exe"),
            )
            result = adapter.status()

        self.assertFalse(result["cli_available"])
        self.assertEqual(result["error_code"], "AGENTTEAMS_CLI_UNAVAILABLE")
        self.assertNotIn(directory, json.dumps(result))


class AgentTeamsWorkerHandlerTests(unittest.TestCase):
    """验证 Worker 方法执行二次字段校验。"""

    def test_status_rejects_renderer_fields(self) -> None:
        """确认状态请求不能携带 CLI 路径、Token 或其他字段。"""

        with tempfile.TemporaryDirectory(prefix="openxnet-agentteams-test-") as directory:
            handlers = AgentTeamsWorkerHandlers(AgentTeamsCliAdapter(Path(directory)))
            with self.assertRaisesRegex(ValueError, "empty"):
                handlers.status({"token": "private"})


if __name__ == "__main__":
    unittest.main()
