#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.
"""
验收启动安全测试 — 仅使用临时配置和模拟外部调用。
Acceptance launcher safety tests — Use temporary settings and mocked external calls only.

Author: maoyo
Department: 研发部
Date: 2026-09-16
Version: 1.3.0
Security Level: INTERNAL
"""

import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import Mock, patch

__version__ = "1.3.0"
__author__ = "maoyo"
__copyright__ = "Copyright 2026 Synapxnet"
__maintainer__ = "maoyo"
__email__ = "synapxnet@gmail.com"

SPEC = importlib.util.spec_from_file_location("goai_launcher", Path(__file__).with_name("start_goai_acceptance_runtime.py"))
launcher = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(launcher)
TEST_SECRET = "test-only-synthetic-delegation-value-000000000000"


class LauncherSafetyTests(unittest.TestCase):
    """检查范围、保密和启动时序。 / Check scope, confidentiality and startup ordering."""

    def setUp(self):
        """准备独立临时目录和参数。 / Prepare an isolated temporary directory and arguments."""
        self.temporary = tempfile.TemporaryDirectory(prefix="openxnet-launcher-test-")
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name)
        self.args = launcher.parse_arguments(["--user-data-dir", str(self.directory), "--validate-only"])

    def write_json(self, relative, value):
        """只在测试临时目录写配置。 / Write settings only in the temporary test directory."""
        path = self.directory / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value), encoding="utf-8")
        return path

    def fixture_snapshot(self):
        """生成最小可识别 Fixture 快照。 / Build a minimally recognizable Fixture snapshot."""
        value = {key: [] for key in ("incidents", "traces", "invocations", "evidence", "approvals",
                                     "actions", "auditReceipts", "teamBindings")}
        value.update(schema=launcher.STORE_SCHEMA, adapterMode="fixture")
        return value

    def test_absent_store_and_fixture_are_read_only(self):
        """缺失存储不创建文件，有效 Fixture 不改写。 / Missing stores create nothing and valid Fixture stays untouched."""
        self.assertEqual(launcher.inspect_local_state(self.directory, "agentteams"), ("missing", "missing"))
        self.assertEqual(list(self.directory.iterdir()), [])
        path = self.write_json("competition/control-plane.v1.json", self.fixture_snapshot())
        original = path.read_bytes()
        launcher.inspect_local_state(self.directory, "agentteams")
        self.assertEqual(path.read_bytes(), original)

    def test_live_or_unknown_store_is_blocked(self):
        """拒绝 Live、未知协议和不完整快照。 / Reject Live, unknown schemas and incomplete snapshots."""
        for update in ({"adapterMode": "live"}, {"schema": "unknown"}, {"incidents": None}):
            with self.subTest(update=update):
                value = self.fixture_snapshot()
                value.update(update)
                self.write_json("competition/control-plane.v1.json", value)
                with self.assertRaises(launcher.LauncherError):
                    launcher.inspect_local_state(self.directory, "agentteams")

    def test_corrupt_or_nonstandard_json_is_blocked(self):
        """损坏 JSON 和非有限数值不被静默忽略。 / Corrupt JSON and nonfinite values are not silently ignored."""
        for payload in (b"[", b"[]", b'{"foo":NaN}', b"\xff"):
            with self.subTest(payload=repr(payload)):
                with self.assertRaises(launcher.LauncherError):
                    launcher.parse_json(payload, "INVALID")

    def test_sensitive_legacy_fields_block_without_values(self):
        """旧配置中的执行凭据或覆盖项明确阻断且不泄漏。 / Block legacy credentials or overrides without values."""
        for key in (launcher.SECRET_KEY, "OPENXNET_AIOPS_ADAPTER_TOKEN", "openxnet_dataops_adapter_token",
                    "OPENXNET_COMPETITION_ADAPTER_TOKEN", "OPENXNET_AGENT_DELEGATION_SECRET",
                    "OPENXNET_APPROVAL_ISSUER_TOKEN", "ELECTRON_RUN_AS_NODE", launcher.ENABLED_KEY,
                    launcher.BASE_URL_KEY, launcher.DATA_DIR_KEY):
            with self.subTest(key=key):
                self.write_json("config.json", {key: TEST_SECRET})
                with self.assertRaises(launcher.LauncherError) as caught:
                    launcher.inspect_local_state(self.directory, "agentteams")
                self.assertEqual(caught.exception.code, "LEGACY_CONFIG_CONFLICT")
                self.assertNotIn(TEST_SECRET, str(caught.exception))

    def test_empty_saved_agentteams_secret_still_blocks_override(self):
        """空旧密钥也不能覆盖临时配置。 / Empty saved secrets must not overwrite temporary configuration."""
        self.write_json("config.json", {launcher.SECRET_KEY: ""})
        with self.assertRaises(launcher.LauncherError):
            launcher.inspect_local_state(self.directory, "agentteams")

    def test_matching_nonsensitive_legacy_settings_are_accepted(self):
        """相同非秘密配置不阻断。 / Matching nonsecret legacy settings do not block."""
        values = launcher.intended_settings("agentteams", self.directory)
        values[launcher.ENABLED_KEY] = 1
        values["unrelated"] = {"nested": "not-loaded-as-env"}
        self.write_json("config.json", values)
        launcher.inspect_local_state(self.directory, "agentteams")

    def test_child_environment_is_case_insensitive_and_parent_unchanged(self):
        """清理所有大小写凭据，同时保留普通环境。 / Remove credentials in every case while preserving ordinary environment."""
        inherited = {
            "PATH": "test-path", "OPENXNET_AIOPS_ADAPTER_TOKEN": "southbound",
            "openxnet_dataops_adapter_token": "southbound", "ADAPTER_TOKEN": "southbound",
            "OPENXNET_AGENT_DELEGATION_SECRET": "southbound", "OPENXNET_APPROVAL_ISSUER_TOKEN": "southbound",
            "electron_run_as_node": "1", launcher.SECRET_KEY: "stale", launcher.ENABLED_KEY.lower(): "0",
        }
        original = inherited.copy()
        environment = launcher.child_environment(inherited, "agentteams", self.directory, TEST_SECRET)
        self.assertEqual(inherited, original)
        self.assertEqual(environment[launcher.SECRET_KEY], TEST_SECRET)
        self.assertEqual(environment[launcher.ENABLED_KEY], "1")
        self.assertEqual(environment["PATH"], "test-path")
        self.assertEqual([key for key in environment if launcher.prohibited_key(key)], [launcher.SECRET_KEY])
        builtin = launcher.child_environment(inherited, "builtin", self.directory, None)
        self.assertFalse(any(launcher.prohibited_key(key) for key in builtin))
        self.assertEqual(builtin[launcher.ENABLED_KEY], "0")

    def test_old_health_or_wrong_product_never_reports_compatible(self):
        """旧 schema 名称不足以证明新协议兼容。 / Old schema names alone never prove new protocol compatibility."""
        baseline = {"schema": launcher.HEALTH_SCHEMA, "status": "ok", "version": launcher.ADAPTER_VERSION,
                    "capabilities": {"residentContexts": True}}
        launcher.validate_health(baseline)
        for replacement in ({"schema": "different-product"}, {"status": "degraded"}, {"version": "1.1.1-workerlease.6"},
                            {"version": "1.3.0-contract.1"},
                            {"capabilities": {}}, {"capabilities": {"residentContexts": "true"}}):
            with self.subTest(replacement=replacement):
                with self.assertRaises(launcher.LauncherError):
                    launcher.validate_health({**baseline, **replacement})

    def test_redirects_are_rejected(self):
        """健康检查不可跟随转向。 / Health checks cannot follow redirects."""
        with self.assertRaises(launcher.LauncherError):
            launcher.NoRedirect().redirect_request(None, None, 302, None, None, "https://example.invalid")

    def test_source_target_requires_compiled_core(self):
        """源码目标缺少构建时明确阻断。 / Source targets block clearly when compiled output is missing."""
        self.args.source_dir = self.directory
        with self.assertRaises(launcher.LauncherError) as caught:
            launcher.resolve_launch_target(self.args)
        self.assertEqual(caught.exception.code, "SOURCE_NOT_BUILT")

    def test_installer_is_not_an_unpacked_target(self):
        """独立安装器不能误当作已解包应用。 / A standalone installer cannot masquerade as an unpacked app."""
        self.args.target = "packaged"
        self.args.exe = self.directory / "OpenXnet.exe"
        self.args.exe.touch()
        with self.assertRaises(launcher.LauncherError):
            launcher.resolve_launch_target(self.args)
        (self.directory / "resources").mkdir()
        (self.directory / "resources" / "app.asar").touch()
        self.assertEqual(launcher.resolve_launch_target(self.args)[0], [str(self.args.exe)])

    def test_builtin_validate_has_no_network_secret_read_or_launch(self):
        """Builtin 预检完全不读网络或密钥、不启动。 / Builtin validation reads no network or secrets and never launches."""
        self.args.runtime = "builtin"
        with patch.object(launcher, "resolve_launch_target", return_value=(["fake.exe"], self.directory)), \
                patch.object(launcher, "check_public_health") as health, \
                patch.object(launcher, "read_adapter_secret") as read_secret, \
                patch.object(launcher.subprocess, "Popen") as popen:
            status = launcher.run_launcher(self.args)
        self.assertEqual(status["status"], "validated")
        self.assertFalse(status["launched"])
        health.assert_not_called()
        read_secret.assert_not_called()
        popen.assert_not_called()

    def test_agentteams_validate_never_launches_or_exposes_secret(self):
        """协同预检只返回公开状态。 / AgentTeams preflight returns public status only."""
        with patch.object(launcher, "resolve_launch_target", return_value=(["fake.exe"], self.directory)), \
                patch.object(launcher, "check_public_health"), \
                patch.object(launcher, "read_adapter_secret", return_value=TEST_SECRET), \
                patch.object(launcher.subprocess, "Popen") as popen:
            status = launcher.run_launcher(self.args)
        popen.assert_not_called()
        self.assertNotIn(TEST_SECRET, json.dumps(status))

    def test_previous_contract_blocks_before_secret_read_or_launch(self):
        """上一版本即使能力完整也不能启动本轮验收。 / The previous version cannot start this release's acceptance even with complete capabilities."""
        self.args.validate_only = False
        previous_health = {"schema": launcher.HEALTH_SCHEMA, "status": "ok", "version": "1.3.0-contract.1",
                           "capabilities": {"residentContexts": True}}

        def validate_previous_health():
            """仅校验内存中的旧版健康响应。 / Validate only the previous-version health response held in memory."""
            launcher.validate_health(previous_health)

        with patch.object(launcher, "resolve_launch_target", return_value=(["fake.exe"], self.directory)), \
                patch.object(launcher, "check_public_health", side_effect=validate_previous_health), \
                patch.object(launcher, "read_adapter_secret") as read_secret, \
                patch.object(launcher.subprocess, "Popen") as popen:
            with self.assertRaises(launcher.LauncherError) as caught:
                launcher.run_launcher(self.args)
        self.assertEqual(caught.exception.code, "ADAPTER_CONTRACT_INCOMPATIBLE")
        self.assertIn("1.3.0-contract.2", str(caught.exception))
        read_secret.assert_not_called()
        popen.assert_not_called()

    def test_config_change_during_preflight_blocks_launch(self):
        """预检期间配置改变时阻断创建进程。 / Block process creation when settings change during preflight."""
        self.args.validate_only = False
        with patch.object(launcher, "resolve_launch_target", return_value=(["fake.exe"], self.directory)), \
                patch.object(launcher, "inspect_local_state", side_effect=[("a", "b"), ("a", "changed")]), \
                patch.object(launcher, "check_public_health"), \
                patch.object(launcher, "read_adapter_secret", return_value=TEST_SECRET), \
                patch.object(launcher.subprocess, "Popen") as popen:
            with self.assertRaises(launcher.LauncherError) as caught:
                launcher.run_launcher(self.args)
        self.assertEqual(caught.exception.code, "CONFIG_CHANGED")
        popen.assert_not_called()

    def test_launch_injects_environment_before_process_and_hides_streams(self):
        """创建进程前环境完整且三个标准流静默。 / Environment is complete before process creation with all streams silent."""
        self.args.validate_only = False
        captured = {}

        def capture_launch(command, **kwargs):
            """记录模拟启动的非持久参数。 / Record nonpersistent parameters of the mocked launch."""
            captured.update(kwargs)
            captured["env"] = kwargs["env"].copy()
            captured["command"] = command
            return Mock(pid=12345)

        with patch.object(launcher, "resolve_launch_target", return_value=(["fake.exe"], self.directory)), \
                patch.object(launcher, "check_public_health"), \
                patch.object(launcher, "read_adapter_secret", return_value=TEST_SECRET), \
                patch.object(launcher.subprocess, "Popen", side_effect=capture_launch):
            status = launcher.run_launcher(self.args)
        self.assertEqual(status["pid"], 12345)
        self.assertEqual(status["status"], "launch_requested")
        self.assertEqual(captured["env"][launcher.SECRET_KEY], TEST_SECRET)
        self.assertEqual(captured["creationflags"], launcher.WINDOWS_NO_CONSOLE)
        for key in ("stdin", "stdout", "stderr"):
            self.assertEqual(captured[key], subprocess.DEVNULL)
        self.assertNotIn(TEST_SECRET, str(captured["command"]))

    def test_fixed_ssh_chain_does_not_put_secret_in_arguments(self):
        """SSH 路由固定，秘密不在命令行或请求体。 / SSH route is fixed and secrets never enter arguments or request bodies."""
        reply = {"version": launcher.ADAPTER_VERSION, "taskSchema": launcher.TASK_SCHEMA,
                 "contractCompatible": True, "secret": TEST_SECRET}
        result = subprocess.CompletedProcess([], 0, json.dumps(reply).encode(), b"private stderr")
        with patch.object(launcher.shutil, "which", return_value="ssh.exe"), \
                patch.object(launcher.subprocess, "run", return_value=result) as run:
            self.assertEqual(launcher.read_adapter_secret(), TEST_SECRET)
        args = run.call_args.args[0]
        kwargs = run.call_args.kwargs
        self.assertIn("synapxnet-157", args)
        self.assertIn("150.109.52.248", args)
        self.assertIn(launcher.REMOTE_EXECUTOR, args)
        self.assertNotIn(TEST_SECRET, str(args) + str(kwargs["input"]))
        self.assertEqual(kwargs["stdout"], subprocess.PIPE)
        self.assertEqual(kwargs["stderr"], subprocess.PIPE)
        self.assertIn(b"sudo -n python3 -B -c", kwargs["input"])

    def test_remote_error_output_is_never_relayed(self):
        """远程失败日志不能进入公开错误。 / Remote failure logs must never enter public errors."""
        result = subprocess.CompletedProcess([], 1, TEST_SECRET.encode(), TEST_SECRET.encode())
        with patch.object(launcher.shutil, "which", return_value="ssh.exe"), \
                patch.object(launcher.subprocess, "run", return_value=result):
            with self.assertRaises(launcher.LauncherError) as caught:
                launcher.read_adapter_secret()
        self.assertNotIn(TEST_SECRET, str(caught.exception))

    def test_remote_probe_selects_one_key_and_rejects_duplicates(self):
        """远端探针只选择唯一委托字段且拒绝重复。 / Remote probe selects one delegation field and rejects duplicates."""
        metadata = {"version": launcher.ADAPTER_VERSION, "taskSchema": launcher.TASK_SCHEMA,
                    "acceptsResidentContexts": True, "mapsResidentContexts": True, "residentParserPresent": True}
        for copies in (1, 2):
            with self.subTest(copies=copies):
                entries = (launcher.SECRET_KEY + "=" + TEST_SECRET + "\n") * copies
                replies = [subprocess.CompletedProcess([], 0, text.encode(), b"")
                           for text in ("true", json.dumps(metadata), entries)]
                output = io.StringIO()
                with patch.object(subprocess, "run", side_effect=replies) as run, contextlib.redirect_stdout(output):
                    exec(compile(launcher.remote_probe_script(), "<memory-only-remote-probe>", "exec"), {})
                result = json.loads(output.getvalue())
                if copies == 1:
                    self.assertEqual(result["secret"], TEST_SECRET)
                else:
                    self.assertEqual(result["error"], "DELEGATION_SECRET_INVALID")
                    self.assertNotIn(TEST_SECRET, output.getvalue())
                selection = run.call_args_list[-1].args[0]
                self.assertIn(launcher.SECRET_KEY, selection[3])
                self.assertNotIn("OPENXNET_AGENT_DELEGATION_SECRET", selection[3])

    def test_remote_incompatible_contract_does_not_read_secret(self):
        """协议不兼容时不读取委托字段。 / Incompatible contracts do not read the delegation field."""
        for previous_version in ("1.1.1-workerlease.6", "1.3.0-contract.1"):
            with self.subTest(version=previous_version):
                metadata = {"version": previous_version, "taskSchema": launcher.TASK_SCHEMA,
                            "acceptsResidentContexts": True, "mapsResidentContexts": True,
                            "residentParserPresent": True}
                replies = [subprocess.CompletedProcess([], 0, b"true", b""),
                           subprocess.CompletedProcess([], 0, json.dumps(metadata).encode(), b"")]
                output = io.StringIO()
                with patch.object(subprocess, "run", side_effect=replies) as run, contextlib.redirect_stdout(output):
                    exec(compile(launcher.remote_probe_script(), "<memory-only-remote-probe>", "exec"), {})
                self.assertEqual(run.call_count, 2)
                self.assertEqual(json.loads(output.getvalue())["error"], "ADAPTER_CONTRACT_INCOMPATIBLE")

    def test_unsupported_secret_cli_arguments_are_not_echoed(self):
        """拒绝密钥命令行参数时不回显值。 / Reject secret CLI arguments without echoing their values."""
        output = io.StringIO()
        with contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
            code = launcher.main(["--secret", TEST_SECRET])
        self.assertEqual(code, 2)
        self.assertNotIn(TEST_SECRET, output.getvalue())
        self.assertIn("ARGUMENT_INVALID", output.getvalue())


if __name__ == "__main__":
    unittest.main()
