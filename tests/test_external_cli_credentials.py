# -*- coding: utf-8 -*-
"""Security regression coverage for external CLI Provider credentials."""

from __future__ import annotations

import json
import os
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import AsyncMock, patch

from py.cli_tool import (
    _build_claude_cli_args,
    _build_codex_wsl_environment,
    _build_external_cli_custom_environment,
    _build_external_cli_environment,
    _extract_claude_cli_texts,
    _normalize_external_cli_base_url,
    _prepare_codex_runtime_home,
    _stream_codex_wsl,
    openai_codex,
)


class FakeLineStream:
    """Return a finite sequence of synthetic subprocess output lines."""

    def __init__(self, lines: list[bytes]) -> None:
        """Create one deterministic line reader."""

        self._lines = list(lines)

    def __aiter__(self) -> FakeLineStream:
        """Return this stream as its own asynchronous iterator."""

        return self

    async def __anext__(self) -> bytes:
        """Return the next line or stop asynchronous iteration at EOF."""

        line = await self.readline()
        if not line:
            raise StopAsyncIteration
        return line

    async def readline(self) -> bytes:
        """Return the next line or EOF."""

        return self._lines.pop(0) if self._lines else b""


class FakeProcess:
    """Minimal asyncio subprocess result used by WSL launch tests."""

    def __init__(self, stdout: list[bytes], stderr: list[bytes]) -> None:
        """Create one completed process with synthetic output."""

        self.stdout = FakeLineStream(stdout)
        self.stderr = FakeLineStream(stderr)
        self.returncode = 0

    async def wait(self) -> int:
        """Return the successful synthetic exit code."""

        return self.returncode


async def raise_external_cli_error(*_args: object, **_kwargs: object):
    """Raise one synthetic external CLI failure without producing output."""

    raise RuntimeError("raw-external-cli-secret")
    yield ""


class ExternalCliCredentialTests(unittest.IsolatedAsyncioTestCase):
    """Validate child environment, disk, WSL argv, and output boundaries."""

    def test_child_environment_removes_openxnet_private_credentials(self) -> None:
        """Keep RPC tokens and credential envelopes out of third-party CLIs."""

        synthetic_environment = {
            "PATH": "test-path",
            "OPENXNET_TASK_RPC_TOKEN": "task-rpc-secret",
            "OPENXNET_WORKER_RPC_TOKEN": "worker-rpc-secret",
            "OPENXNET_PROVIDER_CREDENTIALS_B64": "provider-envelope-secret",
            "THIRD_PARTY_CREDENTIALS_B64": "foreign-envelope-secret",
            "OPENAI_API_KEY": "ambient-openai-secret",
            "ANTHROPIC_API_KEY": "ambient-anthropic-secret",
            "USER_OWNED_SETTING": "retained-metadata",
        }
        with patch.dict(os.environ, synthetic_environment, clear=True):
            custom = _build_external_cli_environment(
                {
                    "OPENAI_API_KEY": "selected-provider-secret",
                    "OPENXNET_INJECTED_TOKEN": "injected-private-secret",
                    "EXTRA_CREDENTIALS_B64": "injected-envelope-secret",
                },
                preserve_native_credentials=False,
            )
            native = _build_external_cli_environment(
                preserve_native_credentials=True,
            )
        self.assertEqual(custom["OPENAI_API_KEY"], "selected-provider-secret")
        self.assertNotIn("ANTHROPIC_API_KEY", custom)
        self.assertEqual(custom["USER_OWNED_SETTING"], "retained-metadata")
        self.assertEqual(native["OPENAI_API_KEY"], "ambient-openai-secret")
        for environment in (custom, native):
            self.assertFalse(any(name.startswith("OPENXNET_") for name in environment))
            self.assertFalse(any(name.endswith("_CREDENTIALS_B64") for name in environment))
            serialized = json.dumps(environment)
            self.assertNotIn("task-rpc-secret", serialized)
            self.assertNotIn("provider-envelope-secret", serialized)
            self.assertNotIn("foreign-envelope-secret", serialized)
            self.assertNotIn("injected-private-secret", serialized)
            self.assertNotIn("injected-envelope-secret", serialized)

    def test_custom_provider_policy_requires_a_safe_complete_configuration(self) -> None:
        """Reject cleartext remote endpoints and missing selected credentials."""

        self.assertEqual(
            _normalize_external_cli_base_url("https://provider.example.test/v1/"),
            "https://provider.example.test/v1",
        )
        self.assertEqual(
            _normalize_external_cli_base_url("http://127.0.0.1:8080/v1"),
            "http://127.0.0.1:8080/v1",
        )
        for invalid in (
            "http://provider.example.test/v1",
            "https://user:secret@provider.example.test/v1",
            "https://provider.example.test/v1?api_key=secret",
            "file:///tmp/provider",
        ):
            with self.subTest(invalid=invalid):
                with self.assertRaisesRegex(RuntimeError, "endpoint is invalid"):
                    _normalize_external_cli_base_url(invalid)
        environment, error = _build_external_cli_custom_environment(
            {
                "enabled": True,
                "base_url": "https://provider.example.test/v1",
                "model": "model-a",
                "api_key": "",
            },
            base_url_name="OPENAI_BASE_URL",
            api_key_name="OPENAI_API_KEY",
            model_name="OPENAI_MODEL",
        )
        self.assertEqual(environment, {})
        self.assertEqual(error, "External CLI provider configuration is invalid.")

    def test_claude_cli_args_are_fixed_and_credential_free(self) -> None:
        """确认 Claude CLI 参数固定且不承载提示词或凭据；输入权限别名，返回受控参数。"""

        arguments = _build_claude_cli_args("cowork")
        self.assertEqual(arguments[0], "-p")
        self.assertIn("stream-json", arguments)
        self.assertIn("bypassPermissions", arguments)
        serialized = " ".join(arguments)
        self.assertNotIn("ANTHROPIC_API_KEY", serialized)
        self.assertNotIn("selected-provider-secret", serialized)

    def test_claude_stream_parser_returns_public_text_only(self) -> None:
        """确认 Claude 流解析器只返回 assistant/result 文本；输入工具事件时返回空数组。"""

        assistant = _extract_claude_cli_texts({
            "type": "assistant",
            "message": {"content": [
                {"type": "thinking", "thinking": "private"},
                {"type": "text", "text": "public"},
            ]},
        })
        result = _extract_claude_cli_texts({"type": "result", "result": "done"})
        tool = _extract_claude_cli_texts({"type": "tool", "content": "private"})
        self.assertEqual(assistant, ["public"])
        self.assertEqual(result, ["done"])
        self.assertEqual(tool, [])

    def test_codex_custom_configuration_never_writes_an_auth_file(self) -> None:
        """Persist only non-secret Codex metadata under the isolated runtime home."""

        with TemporaryDirectory(prefix="openxnet-codex-credential-test-") as directory:
            codex_home = Path(directory, ".codex")
            environment, error = _prepare_codex_runtime_home(codex_home, {
                "enabled": True,
                "base_url": "https://provider.example.test/v1",
                "model": "model-a",
                "api_key": "selected-provider-secret",
            })
            self.assertIsNone(error)
            self.assertEqual(environment, {"OPENAI_API_KEY": "selected-provider-secret"})
            self.assertFalse(Path(codex_home, "auth.json").exists())
            configuration = Path(codex_home, "config.toml").read_text(encoding="utf-8")
            self.assertNotIn("selected-provider-secret", configuration)
            self.assertIn("https://provider.example.test/v1", configuration)

            native_home = Path(directory, "native-home")
            environment, error = _prepare_codex_runtime_home(native_home, {"enabled": False})
            self.assertEqual(environment, {})
            self.assertIsNone(error)
            self.assertFalse(native_home.exists())

    async def test_wsl_argv_excludes_key_and_stream_output_is_redacted(self) -> None:
        """Forward the key through WSLENV while keeping argv and output secret-free."""

        secret = "selected-provider-secret"
        with TemporaryDirectory(prefix="openxnet-codex-wsl-test-") as directory:
            root = Path(directory)
            prompt_path = root / "prompt.txt"
            last_message_path = root / "last-message.txt"
            prompt_path.write_text("test prompt", encoding="utf-8")
            environment = {
                "PATH": "test-path",
                "CODEX_HOME": str(root / ".codex"),
                "OPENAI_API_KEY": secret,
            }
            process = FakeProcess(
                stdout=[f"response {secret}\n".encode("utf-8")],
                stderr=[],
            )
            create_process = AsyncMock(return_value=process)
            with patch("py.cli_tool.asyncio.create_subprocess_exec", create_process):
                output = [item async for item in _stream_codex_wsl(
                    "wsl.exe",
                    "default",
                    directory,
                    environment,
                    prompt_path,
                    last_message_path,
                    (secret,),
                )]
            call = create_process.await_args
            self.assertNotIn(secret, " ".join(str(value) for value in call.args))
            child_environment = call.kwargs["env"]
            self.assertEqual(child_environment["OPENAI_API_KEY"], secret)
            self.assertIn("OPENAI_API_KEY", child_environment["WSLENV"])
            self.assertIn("CODEX_HOME/p", child_environment["WSLENV"])
            self.assertNotIn(secret, "\n".join(output))
            self.assertIn("[REDACTED]", "\n".join(output))

    def test_wslenv_contains_names_without_serializing_values(self) -> None:
        """Forward only variable names through the WSLENV control field."""

        environment = _build_codex_wsl_environment({
            "OPENAI_API_KEY": "selected-provider-secret",
            "CODEX_HOME": "C:\\runtime\\codex",
        })
        self.assertEqual(environment["OPENAI_API_KEY"], "selected-provider-secret")
        self.assertNotIn("selected-provider-secret", environment["WSLENV"])

    async def test_codex_unexpected_failure_returns_one_fixed_error(self) -> None:
        """Prevent unexpected Codex exceptions from reaching public output."""

        with TemporaryDirectory(prefix="openxnet-codex-error-test-") as directory:
            with (
                patch("py.cli_tool.load_settings", AsyncMock(return_value={
                    "CLISettings": {"cc_path": directory},
                    "ocSettings": {"enabled": False},
                })),
                patch("py.cli_tool._wsl_is_ready", return_value=False),
                patch("py.cli_tool._resolve_codex_native_executable", return_value="codex"),
                patch("py.cli_tool._stream_codex_native", raise_external_cli_error),
            ):
                stream = await openai_codex("test prompt")
                output = [item async for item in stream]
        self.assertEqual(output, ["OpenAI Codex request failed."])
        self.assertNotIn("raw-external-cli-secret", "\n".join(output))


if __name__ == "__main__":
    unittest.main()
