# -*- coding: utf-8 -*-
"""验证 Desktop 基础冻结包不会重新收集未使用的重量级可选传递依赖。"""

from __future__ import annotations

from pathlib import Path
import unittest


class BasePackageBoundaryTests(unittest.TestCase):
    """验证基础包排除项与必须保留的 Execution Engine 能力边界。"""

    def test_spec_excludes_unused_optional_transitive_payloads(self) -> None:
        """确认 AWS、Selenium、模型下载与 gRPC 可选闭包不会被共享 Analysis 打包。"""

        project_root = Path(__file__).resolve().parents[1]
        spec_source = (project_root / "server.spec").read_text(encoding="utf-8")
        for module_name in (
            "anthropic",
            "boto3",
            "botocore",
            "claude_agent_sdk",
            "cryptography",
            "e2b.sandbox.mcp",
            "google.cloud.modelarmor",
            "google.cloud.texttospeech",
            "grpc",
            "grpc_status",
            "hf_xet",
            "huggingface_hub",
            "langchain",
            "langchain_classic",
            "langchain_community",
            "langchain_core",
            "langchain_exa",
            "langchain_ollama",
            "langchain_openai",
            "langchain_text_splitters",
            "langsmith",
            "orjson",
            "flask",
            "google.auth",
            "google.oauth2",
            "pyasn1",
            "python_a2a",
            "python_a2a.client.llm.bedrock",
            "python_a2a.langchain",
            "python_a2a.mcp",
            "pythoncom",
            "s3transfer",
            "safetensors",
            "selenium",
            "trio",
            "trio_websocket",
            "websocket",
            "werkzeug",
            "pywin32_system32",
            "pywintypes",
            "win32api",
            "win32com",
            "win32evtlog",
            "win32evtlogutil",
            "win32gui",
            "win32process",
            "win32trace",
            "win32traceutil",
            "win32ui",
            "zstandard",
        ):
            self.assertIn(f"'{module_name}'", spec_source)
        web_search_source = (project_root / "py" / "web_search.py").read_text(encoding="utf-8")
        knowledge_source = (project_root / "py" / "know_base.py").read_text(encoding="utf-8")
        for source in (web_search_source, knowledge_source):
            self.assertNotIn("from langchain", source)
            self.assertNotIn("import langchain", source)
        a2a_source = (project_root / "py" / "a2a_tool.py").read_text(encoding="utf-8")
        self.assertNotIn("python_a2a", a2a_source)

    def test_spec_keeps_required_execution_capability_roots(self) -> None:
        """确认去重不排除 A2A 核心、E2B 代码执行以及 DDG 搜索所需的根依赖。"""

        project_root = Path(__file__).resolve().parents[1]
        spec_source = (project_root / "server.spec").read_text(encoding="utf-8")
        for module_name in ("e2b", "e2b_code_interpreter", "lxml", "primp"):
            self.assertNotIn(f"'{module_name}'", spec_source)

    def test_shared_analysis_excludes_independent_worker_implementations(self) -> None:
        """确认共享 Analysis 不重复收集独立 Pack 与单独 Task Worker 已拥有的实现模块。"""

        project_root = Path(__file__).resolve().parents[1]
        spec_source = (project_root / "server.spec").read_text(encoding="utf-8")
        excluded_modules = spec_source[
            spec_source.index("DESKTOP_EXCLUDED_PY_MODULES = {"):
            spec_source.index("def include_desktop_python_module")
        ]
        for module_name in (
            "py.connector_chat_client",
            "py.connector_settings",
            "py.connector_voice_client",
            "py.dingtalk_bot_manager",
            "py.discord_bot_manager",
            "py.feishu_bot_manager",
            "py.qq_bot_manager",
            "py.slack_bot_manager",
            "py.telegram_bot_manager",
            "py.telegram_client",
            "py.workers.configured_voice_engine",
            "py.workers.connector_worker",
            "py.workers.demo_worker",
            "py.workers.desktop_control_worker",
            "py.workers.document_engine",
            "py.workers.document_worker",
            "py.workers.live_worker",
            "py.workers.mcp_worker",
            "py.workers.memory_worker",
            "py.workers.persistent_vector_engine",
            "py.workers.task_execution_worker",
            "py.workers.vector_engine",
            "py.workers.vector_worker",
            "py.workers.voice_audio",
            "py.workers.voice_engine",
            "py.workers.voice_worker",
        ):
            self.assertIn(f"'{module_name}'", excluded_modules)
        for module_name in ("py.workers.protocol", "py.workers.runtime"):
            self.assertNotIn(f"'{module_name}'", excluded_modules)

    def test_task_worker_excludes_unused_optional_network_stacks(self) -> None:
        """确认 Task Worker 不会因 HTTP 客户端的可选后端重新收集 Trio 与 WebSocket 闭包。"""

        project_root = Path(__file__).resolve().parents[1]
        spec_source = (project_root / "server.spec").read_text(encoding="utf-8")
        task_worker_analysis = spec_source[
            spec_source.index("task_worker_analysis = Analysis("):
            spec_source.index("task_worker_pyz = PYZ(")
        ]
        for module_name in (
            "pythoncom",
            "pywin32_system32",
            "pywintypes",
            "trio",
            "trio_websocket",
            "websocket",
            "win32api",
            "win32com",
            "win32evtlog",
            "win32evtlogutil",
            "win32gui",
            "win32process",
            "win32trace",
            "win32traceutil",
            "win32ui",
        ):
            self.assertIn(f"'{module_name}'", task_worker_analysis)


if __name__ == "__main__":
    unittest.main()
