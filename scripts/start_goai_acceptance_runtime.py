#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.
"""
安全验收启动 — 在 Electron 创建前注入仅存在于内存的协同配置。
Safe acceptance launch — Inject memory-only collaboration settings before Electron.

Author: maoyo
Department: 研发部
Date: 2026-09-16
Version: 1.3.0
Security Level: INTERNAL
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import math
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys
from typing import Any
import urllib.error
import urllib.request

__version__ = "1.3.0"
__author__ = "maoyo"
__copyright__ = "Copyright 2026 Synapxnet"
__maintainer__ = "maoyo"
__email__ = "synapxnet@gmail.com"

SOURCE_DIRECTORY = Path(__file__).resolve().parents[1]
PACKAGED_EXECUTABLE = Path(r"E:\SynapXnet\openxnet-desktop\win-unpacked\OpenXnet.exe")
ADAPTER_BASE_URL = "https://goai.xnetaiops.synapxnet.online/agentteams-adapter/"
ADAPTER_VERSION = "1.3.0-contract.2"
HEALTH_SCHEMA = "openxnet.agentteams-adapter.health.v1"
TASK_SCHEMA = "openxnet.agentteams.task.v1"
STORE_SCHEMA = "openxnet.competition-runtime.v1"
SECRET_KEY = "OPENXNET_AGENTTEAMS_DELEGATION_SECRET"
ENABLED_KEY = "OPENXNET_COMPETITION_AGENTTEAMS_ISOLATED_SERVICE_ENABLED"
BASE_URL_KEY = "OPENXNET_COMPETITION_AGENTTEAMS_BASE_URL"
DATA_DIR_KEY = "OPENXNET_USER_DATA_DIR"
CONTAINER = "synapxnet-openxnet-agentteams-adapter-1"
REMOTE_EXECUTOR = r"D:\synapxnet\.codex-build\goai-deploy\remote_exec.py"
MAX_REPLY_BYTES = 64 * 1024
WINDOWS_NO_CONSOLE = 0x08000000


class LauncherError(Exception):
    """仅携带可公开错误，不含捕获输出。 / Carry only public errors, never captured output."""

    def __init__(self, code: str, message: str) -> None:
        """保存安全代码和说明。 / Store a safe code and explanation."""
        super().__init__(message)
        self.code = code


class NoRedirect(urllib.request.HTTPRedirectHandler):
    """拒绝健康检查跳转到其他服务。 / Reject health-check redirects to other services."""

    def redirect_request(self, req: Any, fp: Any, code: Any, msg: Any,
                         headers: Any, newurl: Any) -> None:
        """阻断全部重定向。 / Block all redirects."""
        raise LauncherError("HEALTH_REDIRECT", "健康接口发生重定向，未验证目标服务。")


class SafeArgumentParser(argparse.ArgumentParser):
    """错误不回显命令行中的潜在敏感输入。 / Avoid echoing potentially sensitive CLI input in errors."""

    def error(self, message: str) -> None:
        """只返回固定参数错误。 / Return only a fixed argument error."""
        raise LauncherError("ARGUMENT_INVALID", "启动参数无效；此工具不接受密钥或令牌参数，请使用 --help。")


def reject_constant(value: str) -> None:
    """拒绝非标准 JSON 数值。 / Reject nonstandard JSON numeric constants."""
    raise ValueError("Nonstandard JSON constant")


def parse_json(payload: bytes, error_code: str) -> dict[str, Any]:
    """解析严格 JSON 对象并隐藏原始输入。 / Parse strict JSON objects without exposing input."""
    try:
        result = json.loads(payload.decode("utf-8-sig"), parse_constant=reject_constant)
        if not isinstance(result, dict):
            raise ValueError("Expected object")
        return result
    except (ValueError, UnicodeError):
        raise LauncherError(error_code, "预检资料不是有效 JSON 对象。") from None


def read_local_json(path: Path, limit: int) -> tuple[dict[str, Any] | None, str]:
    """有界只读配置并记录摘要，不修改文件。 / Read bounded config and fingerprint it without writes."""
    try:
        details = path.lstat()
        if not stat.S_ISREG(details.st_mode) or path.is_symlink() or details.st_size > limit:
            raise LauncherError("CONFIG_FILE_INVALID", "配置文件类型或大小不符合验收要求。")
        with path.open("rb") as stream:
            payload = stream.read(limit + 1)
        if len(payload) > limit:
            raise LauncherError("CONFIG_FILE_INVALID", "配置文件超过预检大小上限。")
        return parse_json(payload, "CONFIG_JSON_INVALID"), hashlib.sha256(payload).hexdigest()
    except FileNotFoundError:
        return None, "missing"
    except OSError:
        raise LauncherError("CONFIG_READ_FAILED", "无法只读访问用户配置，未更改任何文件。") from None


def prohibited_key(key: str) -> bool:
    """识别不得继承的执行凭据和 Node 模式。 / Identify forbidden execution credentials and Node mode."""
    upper = key.upper()
    return upper in {
        "ADAPTER_TOKEN", "OPENXNET_AGENT_DELEGATION_SECRET",
        "OPENXNET_APPROVAL_ISSUER_TOKEN", "ELECTRON_RUN_AS_NODE", SECRET_KEY,
    } or upper.endswith("_ADAPTER_TOKEN")


def scalar_environment_value(value: Any) -> str | None:
    """匹配 Main 的字符串和数字加载规则。 / Match Main's string and number environment loading."""
    if isinstance(value, str):
        return value
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if isinstance(value, float) and (not math.isfinite(value) or not value.is_integer()):
            return str(value)
        return str(int(value))
    return None


def intended_settings(runtime: str, user_data: Path) -> dict[str, str]:
    """生成固定的非秘密启动设置。 / Produce fixed nonsecret launch settings."""
    return {
        DATA_DIR_KEY: str(user_data),
        ENABLED_KEY: "1" if runtime == "agentteams" else "0",
        BASE_URL_KEY: ADAPTER_BASE_URL if runtime == "agentteams" else "",
    }


def inspect_local_state(user_data: Path, runtime: str) -> tuple[str, str]:
    """拒绝 Live 数据和会覆盖安全设置的旧配置。 / Reject Live state and legacy security overrides."""
    stored, stored_digest = read_local_json(
        user_data / "competition" / "control-plane.v1.json", 32 * 1024 * 1024)
    if stored is not None:
        if stored.get("schema") != STORE_SCHEMA or stored.get("adapterMode") != "fixture":
            raise LauncherError("FIXTURE_REQUIRED", "仅允许南向 Fixture 验收；已有模式未被修改。")
        for key in ("incidents", "traces", "invocations", "evidence", "approvals",
                    "actions", "auditReceipts", "teamBindings"):
            if not isinstance(stored.get(key), list):
                raise LauncherError("STORE_INVALID", "竞赛快照缺少有效记录集合，未自动重置数据。")
    config, config_digest = read_local_json(user_data / "config.json", 4 * 1024 * 1024)
    expected = intended_settings(runtime, user_data)
    conflicts = []
    for key, value in (config or {}).items():
        scalar = scalar_environment_value(value)
        if scalar is None:
            continue
        upper = key.upper()
        if prohibited_key(key) and (scalar or upper == "ELECTRON_RUN_AS_NODE"):
            conflicts.append(upper)
        elif upper in expected and scalar != expected[upper]:
            conflicts.append(upper)
        elif upper == SECRET_KEY:
            # 空字符串同样会覆盖内存密钥。 / Even an empty scalar overwrites the memory-only secret.
            conflicts.append(upper)
    if conflicts:
        raise LauncherError("LEGACY_CONFIG_CONFLICT",
                            "旧 config.json 会覆盖启动安全设置，请在配置界面处理这些字段："
                            + ", ".join(sorted(set(conflicts))))
    return stored_digest, config_digest


def resolve_launch_target(args: argparse.Namespace) -> tuple[list[str], Path]:
    """验证已有源码构建或解包应用，不自动构建。 / Validate compiled source or unpacked app without building."""
    if args.target == "packaged":
        executable = args.exe.expanduser().resolve()
        resources = executable.parent / "resources"
        if (not executable.is_file() or executable.suffix.lower() != ".exe"
                or not ((resources / "app.asar").is_file() or (resources / "app" / "main.js").is_file())):
            raise LauncherError("PACKAGED_TARGET_INVALID", "未找到完整解包桌面应用，请指定 win-unpacked 内的 EXE。")
        return [str(executable)], executable.parent
    root = args.source_dir.expanduser().resolve()
    executable = root / "node_modules" / "electron" / "dist" / "electron.exe"
    required = [root / "main.js", root / "package.json", root / "static" / "index.precompiled.html", executable]
    for relative in ("competition/application-competition-runtime", "competition/competition-agentteams-adapter",
                     "contracts/application-competition-runtime"):
        source = root / "src" / "desktop" / (relative + ".ts")
        compiled = root / "build-ts" / "desktop" / (relative + ".js")
        required.extend([source, compiled])
        if source.is_file() and compiled.is_file() and source.stat().st_mtime_ns > compiled.stat().st_mtime_ns:
            raise LauncherError("BUILD_STALE", "桌面核心构建早于当前源码，请先完成构建再启动验收。")
    if not all(item.is_file() for item in required):
        raise LauncherError("SOURCE_NOT_BUILT", "源码版缺少 Electron 或已编译桌面文件，请先完成构建。")
    return [str(executable), str(root)], root


def validate_health(value: dict[str, Any]) -> None:
    """核对明确版本和驻场协议能力。 / Verify explicit version and resident-context capability."""
    if value.get("schema") != HEALTH_SCHEMA or value.get("status") != "ok":
        raise LauncherError("ADAPTER_UNHEALTHY", "AgentTeams 服务身份或健康状态未通过预检。")
    capabilities = value.get("capabilities")
    if (value.get("version") != ADAPTER_VERSION or not isinstance(capabilities, dict)
            or capabilities.get("residentContexts") is not True):
        raise LauncherError("ADAPTER_CONTRACT_INCOMPATIBLE",
                            f"AgentTeams 服务版本或驻场上下文能力与本次验收要求（{ADAPTER_VERSION}）不一致，不能启动协同验收。")


def check_public_health() -> None:
    """有界读取固定公开健康地址，禁止重定向。 / Read fixed public health with bounds and no redirects."""
    request = urllib.request.Request(ADAPTER_BASE_URL + "health", headers={"Accept": "application/json"})
    try:
        with urllib.request.build_opener(NoRedirect()).open(request, timeout=20) as response:
            if response.status != 200 or response.geturl() != ADAPTER_BASE_URL + "health":
                raise LauncherError("ADAPTER_UNHEALTHY", "AgentTeams 健康地址未返回预期响应。")
            payload = response.read(MAX_REPLY_BYTES + 1)
        if len(payload) > MAX_REPLY_BYTES:
            raise LauncherError("HEALTH_TOO_LARGE", "AgentTeams 健康响应超过预检上限。")
        validate_health(parse_json(payload, "HEALTH_JSON_INVALID"))
    except (OSError, urllib.error.URLError):
        raise LauncherError("HEALTH_UNREACHABLE", "无法访问 AgentTeams 公开健康接口。") from None


def remote_probe_script() -> str:
    """构造无秘密的固定只读远端脚本。 / Build a fixed read-only remote script containing no secrets."""
    # 只检查解析源码，不调用任务接口。 / Inspect parser source without calling any task endpoint.
    node_probe = r'''
const fs = require("node:fs");
const contracts = require("/app/src/contracts.js");
const source = fs.readFileSync("/app/src/contracts.js", "utf8");
const parser = contracts.parseTaskRequest.toString();
const fieldCheck = parser.match(/requireFields\(value\.context,[\s\S]*?;/);
const version = JSON.parse(fs.readFileSync("/app/package.json", "utf8")).version;
process.stdout.write(JSON.stringify({
  version, taskSchema: contracts.TASK_REQUEST_SCHEMA,
  acceptsResidentContexts: Boolean(fieldCheck && /["']residentContexts["']/.test(fieldCheck[0])),
  mapsResidentContexts: /value\.context\.residentContexts/.test(parser),
  residentParserPresent: /residentContexts/.test(source)
}));
'''
    template = r'''
import json,subprocess,sys

def run_read(arguments):
    """捕获受限只读结果，不转发日志。 / Capture bounded read-only results without forwarding logs."""
    result=subprocess.run(arguments,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=20)
    if result.returncode != 0 or len(result.stdout)>65536:
        raise ValueError("Read failed")
    return result.stdout.decode("utf-8")

def probe():
    """验证容器契约后仅返回唯一委托值。 / Verify container contract then return the sole delegation value."""
    container=__CONTAINER__
    running=run_read(["docker","inspect","--format","{{json .State.Running}}",container]).strip()
    if running!="true":
        return {"error":"CONTAINER_NOT_RUNNING"}
    metadata=json.loads(run_read(["docker","exec",container,"node","-e",__NODE_PROBE__]))
    if (metadata.get("version")!=__VERSION__ or metadata.get("taskSchema")!=__SCHEMA__
        or metadata.get("acceptsResidentContexts") is not True
        or metadata.get("mapsResidentContexts") is not True
        or metadata.get("residentParserPresent") is not True):
        return {"error":"ADAPTER_CONTRACT_INCOMPATIBLE"}
    selected='{{range .Config.Env}}{{if eq (index (split . "=") 0) "OPENXNET_AGENTTEAMS_DELEGATION_SECRET"}}{{println .}}{{end}}{{end}}'
    entries=run_read(["docker","inspect","--format",selected,container]).splitlines()
    entries=[entry for entry in entries if entry]
    if len(entries)!=1 or not entries[0].startswith("OPENXNET_AGENTTEAMS_DELEGATION_SECRET="):
        return {"error":"DELEGATION_SECRET_INVALID"}
    secret=entries[0].split("=",1)[1]
    if len(secret)<32 or len(secret)>4096 or secret.strip()!=secret or any(ord(c)<33 or ord(c)>126 for c in secret):
        return {"error":"DELEGATION_SECRET_INVALID"}
    return {"version":metadata["version"],"taskSchema":metadata["taskSchema"],"contractCompatible":True,"secret":secret}

try:
    reply=probe()
except Exception:
    reply={"error":"REMOTE_READ_FAILED"}
sys.stdout.write(json.dumps(reply,ensure_ascii=True,separators=(",",":")))
'''
    for marker, value in (("__CONTAINER__", CONTAINER), ("__NODE_PROBE__", node_probe),
                          ("__VERSION__", ADAPTER_VERSION), ("__SCHEMA__", TASK_SCHEMA)):
        template = template.replace(marker, repr(value))
    return template


def read_adapter_secret() -> str:
    """沿固定 SSH 链捕获唯一密钥；绝不转发远端输出。 / Capture one secret over fixed SSH, never relay output."""
    ssh = shutil.which("ssh")
    if not ssh:
        raise LauncherError("SSH_MISSING", "系统未找到现有 SSH 客户端。")
    payload = base64.b64encode(remote_probe_script().encode("utf-8")).decode("ascii")
    remote_command = 'sudo -n python3 -B -c "import base64;exec(base64.b64decode(\'' + payload + '\'))"'
    command = [ssh, "-T", "-o", "BatchMode=yes", "-o", "ConnectTimeout=15", "synapxnet-157",
               "python", "-B", REMOTE_EXECUTOR, "--host", "150.109.52.248", "exec"]
    try:
        result = subprocess.run(command, input=remote_command.encode("ascii"), stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE, timeout=60, creationflags=WINDOWS_NO_CONSOLE)
        if result.returncode != 0 or len(result.stdout) > MAX_REPLY_BYTES:
            raise LauncherError("REMOTE_READ_FAILED", "固定 SSH 链读取失败，远端输出已隐藏。")
        reply = parse_json(result.stdout, "REMOTE_REPLY_INVALID")
        public_errors = {
            "CONTAINER_NOT_RUNNING": "AgentTeams Adapter 容器未运行。",
            "ADAPTER_CONTRACT_INCOMPATIBLE": "运行容器的实际任务解析协议不支持驻场上下文。",
            "DELEGATION_SECRET_INVALID": "运行容器未提供唯一且有效的 AgentTeams 委托凭据。",
            "REMOTE_READ_FAILED": "无法完成运行容器只读预检，远端输出已隐藏。",
        }
        error_code = reply.get("error")
        if isinstance(error_code, str) and error_code in public_errors:
            raise LauncherError(error_code, public_errors[error_code])
        if (reply.get("contractCompatible") is not True or reply.get("version") != ADAPTER_VERSION
                or reply.get("taskSchema") != TASK_SCHEMA):
            raise LauncherError("REMOTE_REPLY_INVALID", "运行容器未返回已验证的新版协议。")
        secret = reply.get("secret")
        if not isinstance(secret, str) or re.fullmatch(r"[!-~]{32,4096}", secret) is None:
            raise LauncherError("DELEGATION_SECRET_INVALID", "运行容器未提供有效的独立委托凭据。")
        return secret
    except (OSError, subprocess.SubprocessError):
        raise LauncherError("REMOTE_READ_FAILED", "固定 SSH 链读取失败或超时，远端输出已隐藏。") from None


def child_environment(inherited: dict[str, str], runtime: str, user_data: Path,
                      secret: str | None) -> dict[str, str]:
    """为单个子进程构造环境，不修改父进程。 / Build an isolated child environment without mutating the parent."""
    controlled = {DATA_DIR_KEY, ENABLED_KEY, BASE_URL_KEY}
    environment = {key: value for key, value in inherited.items()
                   if not prohibited_key(key) and key.upper() not in controlled}
    environment.update(intended_settings(runtime, user_data))
    if runtime == "agentteams":
        if not secret:
            raise LauncherError("DELEGATION_SECRET_INVALID", "AgentTeams 运行时缺少本次安全读取的委托凭据。")
        environment[SECRET_KEY] = secret
    return environment


def run_launcher(args: argparse.Namespace) -> dict[str, Any]:
    """顺序预检后选择退出或静默创建桌面进程。 / Sequentially preflight, then exit or silently create the desktop."""
    if os.name != "nt":
        raise LauncherError("WINDOWS_REQUIRED", "此启动器仅用于 Windows 桌面验收。")
    command, working_directory = resolve_launch_target(args)
    app_data = os.environ.get("APPDATA")
    if args.user_data_dir is None and not app_data:
        raise LauncherError("USER_DATA_MISSING", "未找到 APPDATA，请明确指定验收用户目录。")
    user_data = (args.user_data_dir or Path(app_data) / "OpenXnet").expanduser().resolve()
    if user_data.exists() and not user_data.is_dir():
        raise LauncherError("USER_DATA_INVALID", "所选用户数据路径不是目录。")
    before = inspect_local_state(user_data, args.runtime)
    secret = None
    environment: dict[str, str] = {}
    try:
        if args.runtime == "agentteams":
            check_public_health()
            secret = read_adapter_secret()
        if inspect_local_state(user_data, args.runtime) != before:
            raise LauncherError("CONFIG_CHANGED", "预检期间用户配置发生变化，请重试，未启动应用。")
        status: dict[str, Any] = {
            "status": "validated", "target": args.target, "runtime": args.runtime,
            "southbound": "fixture", "launched": False,
        }
        if args.runtime == "agentteams":
            status["adapterVersion"] = ADAPTER_VERSION
        if args.validate_only:
            return status
        environment = child_environment(dict(os.environ), args.runtime, user_data, secret)
        child = subprocess.Popen(command, cwd=str(working_directory), env=environment,
                                 stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                 creationflags=WINDOWS_NO_CONSOLE, close_fds=True)
        status.update(status="launch_requested", launched=True, pid=child.pid)
        return status
    finally:
        environment.clear()
        secret = None


def parse_arguments(argv: list[str] | None = None) -> argparse.Namespace:
    """只接受非秘密的目标与预检参数。 / Accept only nonsecret target and preflight arguments."""
    parser = SafeArgumentParser(description="OpenXnet 安全验收启动器（南向始终 Fixture）", allow_abbrev=False)
    parser.add_argument("--target", choices=("source", "packaged"), default="source")
    parser.add_argument("--runtime", choices=("agentteams", "builtin"), default="agentteams")
    parser.add_argument("--source-dir", type=Path, default=SOURCE_DIRECTORY)
    parser.add_argument("--exe", type=Path, default=PACKAGED_EXECUTABLE)
    parser.add_argument("--user-data-dir", type=Path)
    parser.add_argument("--validate-only", action="store_true")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    """只输出公开状态和预定义错误，不输出外部异常。 / Print public status and predefined errors only."""
    try:
        status = run_launcher(parse_arguments(argv))
        print(json.dumps(status, ensure_ascii=True))
        return 0
    except LauncherError as error:
        print(json.dumps({"status": "blocked", "code": error.code, "message": str(error),
                          "launched": False}, ensure_ascii=True))
        return 2
    except Exception:
        print(json.dumps({"status": "blocked", "code": "LOCAL_LAUNCH_FAILED", "launched": False}))
        return 2


if __name__ == "__main__":
    sys.exit(main())
