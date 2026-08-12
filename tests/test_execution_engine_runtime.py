# -*- coding: utf-8 -*-
"""Regression coverage for provider construction and tool-registry ownership."""

from __future__ import annotations

from pathlib import Path
import unittest
from unittest.mock import patch

from openai import AsyncOpenAI

from py.dify_openai import DifyOpenAIAsync
from py.execution_provider_runtime import (
    create_provider_client,
    get_provider_client_class,
)
from py.execution_tool_registry import build_execution_tool_registry


PROJECT_ROOT = Path(__file__).resolve().parents[1]


class _RecordingClient:
    """Capture provider constructor arguments without opening network resources."""

    def __init__(self, **arguments) -> None:
        """Store one defensive copy of received constructor arguments."""

        self.arguments = dict(arguments)


class ExecutionEngineRuntimeTests(unittest.TestCase):
    """Validate extracted provider and tool-registry runtime boundaries."""

    def test_resolves_dify_and_openai_provider_classes(self) -> None:
        """Select only the supported provider adapters from bounded configuration."""

        configuration = {
            "modelProviders": [
                {"id": "dify", "vendor": "Dify"},
                {"id": "openai", "vendor": "OpenAI"},
            ],
        }
        self.assertIs(get_provider_client_class(configuration, "dify"), DifyOpenAIAsync)
        self.assertIs(get_provider_client_class(configuration, "openai"), AsyncOpenAI)
        self.assertIs(get_provider_client_class(configuration, "unknown"), AsyncOpenAI)

    def test_constructs_provider_from_scoped_configuration(self) -> None:
        """Prefer scoped reasoner values while retaining bounded root fallbacks."""

        configuration = {
            "selectedProvider": "main",
            "api_key": "root-key",
            "base_url": "https://root.example/v1",
        }
        reasoner = {
            "selectedProvider": "reasoner",
            "base_url": "https://reasoner.example/v1",
        }
        with patch(
            "py.execution_provider_runtime.get_provider_client_class",
            return_value=_RecordingClient,
        ):
            client = create_provider_client(configuration, config_node=reasoner)
        self.assertEqual(client.arguments, {
            "api_key": "root-key",
            "base_url": "https://reasoner.example/v1",
        })

    def test_rejects_unowned_extra_tool_hooks_before_importing_tools(self) -> None:
        """Prevent callers from extending the provider registry with arbitrary names."""

        with self.assertRaisesRegex(ValueError, "not allowed"):
            build_execution_tool_registry({"unowned_tool": lambda: None})

    def test_server_delegates_provider_and_tool_registry_ownership(self) -> None:
        """Keep client selection and both registry maps outside the monolithic entrypoint."""

        server_source = (PROJECT_ROOT / "server.py").read_text(encoding="utf-8")
        provider_source = (
            PROJECT_ROOT / "py" / "execution_provider_runtime.py"
        ).read_text(encoding="utf-8")
        registry_source = (
            PROJECT_ROOT / "py" / "execution_tool_registry.py"
        ).read_text(encoding="utf-8")
        self.assertNotIn("def get_client_class(", server_source)
        self.assertEqual(server_source.count("build_execution_tool_registry({"), 2)
        self.assertNotIn("_TOOL_HOOKS = {\n", server_source)
        self.assertIn("def get_provider_client_class(", provider_source)
        self.assertIn('"shell_tool_local": shell_tool_local', registry_source)


if __name__ == "__main__":
    unittest.main()
