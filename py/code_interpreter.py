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
代码解释器 — 安全沙箱内执行 Python 代码片段。

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

import asyncio
import ipaddress
from typing import Any, Mapping
from urllib.parse import urlsplit, urlunsplit

from aiohttp import ClientSession, ClientTimeout

from py.get_setting import load_settings

try:
    from e2b_code_interpreter import Sandbox
except ImportError:
    Sandbox = None


MAX_CODE_BYTES = 1024 * 1024
MAX_LANGUAGE_BYTES = 64
MAX_SANDBOX_RESPONSE_BYTES = 2 * 1024 * 1024
SANDBOX_REQUEST_TIMEOUT_SECONDS = 60


def _validate_code(code: Any) -> str:
    """Return one UTF-8 code payload within the execution byte budget."""

    if not isinstance(code, str) or not code.strip():
        raise ValueError("代码内容不能为空。")
    if len(code.encode("utf-8")) > MAX_CODE_BYTES:
        raise ValueError("代码内容超过 1 MiB 限制。")
    return code


def _validate_language(language: Any) -> str:
    """Return one bounded single-line execution language identifier."""

    if not isinstance(language, str):
        raise ValueError("代码语言无效。")
    normalized = language.strip()
    if (
        not normalized
        or len(normalized.encode("utf-8")) > MAX_LANGUAGE_BYTES
        or any(ord(character) < 32 or ord(character) == 127 for character in normalized)
    ):
        raise ValueError("代码语言无效。")
    return normalized


def _is_loopback_host(hostname: str) -> bool:
    """Return whether one URL host is an explicit local loopback address."""

    normalized = hostname.strip().lower().rstrip(".")
    if normalized == "localhost":
        return True
    try:
        return ipaddress.ip_address(normalized).is_loopback
    except ValueError:
        return False


def _build_sandbox_endpoint(settings: Mapping[str, Any]) -> str:
    """Build a redirect-free sandbox endpoint from one validated base URL."""

    code_settings = settings.get("codeSettings")
    if not isinstance(code_settings, Mapping):
        raise ValueError("本地代码沙箱地址未配置。")
    raw_url = str(code_settings.get("sandbox_url", "") or "").strip()
    try:
        parsed = urlsplit(raw_url)
        _ = parsed.port
    except ValueError as error:
        raise ValueError("本地代码沙箱地址无效。") from error
    scheme = parsed.scheme.lower()
    hostname = parsed.hostname or ""
    if (
        scheme not in {"http", "https"}
        or not hostname
        or parsed.username is not None
        or parsed.password is not None
        or parsed.query
        or parsed.fragment
    ):
        raise ValueError("本地代码沙箱地址无效。")
    if scheme == "http" and not _is_loopback_host(hostname):
        raise ValueError("外部代码沙箱必须使用 HTTPS。")
    endpoint_path = f"{parsed.path.rstrip('/')}/run_code"
    return urlunsplit((scheme, parsed.netloc, endpoint_path, "", ""))


async def _read_bounded_response(response: Any) -> str:
    """Read one sandbox response without exceeding the configured byte budget."""

    chunks = []
    size = 0
    async for chunk in response.content.iter_chunked(64 * 1024):
        size += len(chunk)
        if size > MAX_SANDBOX_RESPONSE_BYTES:
            return "代码沙箱响应超过 2 MiB 限制。"
        chunks.append(chunk)
    encoding = response.charset or "utf-8"
    try:
        return b"".join(chunks).decode(encoding, errors="replace")
    except LookupError:
        return b"".join(chunks).decode("utf-8", errors="replace")


async def e2b_code(code: str, language: str = "Python") -> str:
    """Execute bounded code through E2B without exposing credential-bearing failures."""

    if Sandbox is None:
        return "E2B 代码执行当前不可用：缺少 e2b_code_interpreter 依赖。"
    try:
        bounded_code = _validate_code(code)
        bounded_language = _validate_language(language)
        settings = await load_settings()
        e2b_api_key = str(settings.get("codeSettings", {}).get("e2b_api_key", "") or "").strip()
        if not e2b_api_key:
            return "E2B API Key 尚未配置。"

        def run_in_sandbox() -> str:
            """Run the synchronous E2B client inside a managed worker thread."""

            with Sandbox(api_key=e2b_api_key) as sandbox:
                execution = sandbox.run_code(bounded_code, language=bounded_language)
                return str(execution.logs)

        result = await asyncio.to_thread(run_in_sandbox)
        if len(result.encode("utf-8")) > MAX_SANDBOX_RESPONSE_BYTES:
            return "E2B 代码执行结果超过 2 MiB 限制。"
        return result
    except ValueError as error:
        return str(error)
    except Exception:
        return "E2B 代码执行失败。"


async def local_run_code(code: str, language: str = "python") -> str:
    """Execute bounded code through a validated redirect-free HTTP sandbox."""

    try:
        bounded_code = _validate_code(code)
        bounded_language = _validate_language(language)
        settings = await load_settings()
        url = _build_sandbox_endpoint(settings)
        timeout = ClientTimeout(total=SANDBOX_REQUEST_TIMEOUT_SECONDS)
        async with ClientSession(timeout=timeout) as session:
            async with session.post(
                url,
                json={"code": bounded_code, "language": bounded_language},
                headers={"Content-Type": "application/json"},
                allow_redirects=False,
            ) as response:
                if 300 <= response.status < 400:
                    return "本地代码沙箱拒绝重定向。"
                if response.status >= 400:
                    return "本地代码沙箱请求失败。"
                return await _read_bounded_response(response)
    except ValueError as error:
        return str(error)
    except Exception:
        return "本地代码沙箱连接失败。"

e2b_code_tool = {
    "type": "function",
    "function": {
        "name": "e2b_code",
        "description": "执行代码，工具只会返回stdout和stderr。请将你要查看的答案输出到stdout。",
        "parameters": {
            "type": "object",
            "properties": {
                "code": {
                    "type": "string",
                    "description": "需要执行的代码，例如：print('Hello, World!')，不要包含markdown的代码块标记！只有输入可运行的代码字符串。",
                },
                "language": {
                    "type": "string",
                    "description": "代码语言。",
                    "enum": ["python", "js", "ts", "r", "java", "bash"],
                    "default": "python"
                }
            },
            "required": ["code"],
        },
    },
}

local_run_code_tool = {
  "type": "function",
  "function": {
    "name": "local_run_code",
    "description": "执行代码，工具只会返回stdout和stderr。请将你要查看的答案输出到stdout。",
    "parameters": {
      "type": "object",
      "properties": {
        "code": {
          "type": "string",
          "description": "需要执行的代码，例如：print('Hello, World!')，不要包含markdown的代码块标记！只有输入可运行的代码字符串。工具只会返回stdout和stderr。请将你要查看的答案放在print()中，不要放在其他地方。"
        },
        "language": {
          "type": "string",
          "description": "代码语言。",
          "enum": [
            "python", "cpp", "nodejs", "go", "go_test", "java", "php", "csharp",
            "bash", "typescript", "sql", "rust", "cuda", "lua", "R", "perl",
            "D_ut", "ruby", "scala", "julia", "pytest", "junit", "kotlin_script",
            "jest", "verilog", "python_gpu", "lean", "swift", "racket"
          ],
          "default": "python"
        }
      },
      "required": ["code"]
    }
  }
}
