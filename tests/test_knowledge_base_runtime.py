# -*- coding: utf-8 -*-
"""验证 Desktop 知识库运行时与 Execution Engine 私有 API。"""

from __future__ import annotations

from pathlib import Path
import tempfile
import unittest
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI
import httpx

from py.knowledge_base_engine_api import register_knowledge_base_engine_api
from py.knowledge_base_runtime import KnowledgeBaseRuntimeController
from py import load_files


class KnowledgeBaseRuntimeTests(unittest.IsolatedAsyncioTestCase):
    """验证知识库运行时状态、文件边界和结果脱敏。"""

    async def test_status_detects_persisted_index_and_remove_deletes_only_scope(self) -> None:
        """从持久索引恢复 completed 状态并删除指定 scope，不影响相邻目录。"""

        with tempfile.TemporaryDirectory(prefix="openxnet-kb-runtime-") as directory:
            root = Path(directory)
            target = root / "kb-one"
            target.mkdir()
            (target / "index.faiss").write_bytes(b"index")
            (target / "index.docs.json").write_text("{}", encoding="utf-8")
            sibling = root / "kb-two"
            sibling.mkdir()
            controller = KnowledgeBaseRuntimeController(root)

            status = await controller.status("kb-one")
            removed = await controller.remove("kb-one")

            self.assertEqual(status["status"], "completed")
            self.assertTrue(removed["success"])
            self.assertTrue(removed["removed"])
            self.assertFalse(target.exists())
            self.assertTrue(sibling.exists())

    async def test_build_returns_stable_completed_or_failed_status(self) -> None:
        """构建成功和失败均返回固定状态，内部异常文本不会进入公开结果。"""

        with tempfile.TemporaryDirectory(prefix="openxnet-kb-build-") as directory:
            controller = KnowledgeBaseRuntimeController(Path(directory))
            with patch("py.know_base.process_knowledge_base", AsyncMock(return_value="ok")):
                completed = await controller.build("kb-success")
            with patch(
                "py.know_base.process_knowledge_base",
                AsyncMock(side_effect=RuntimeError("provider-secret-diagnostic")),
            ):
                failed = await controller.build("kb-failed")

            self.assertEqual(completed["status"], "completed")
            self.assertEqual(failed["status"], "failed")
            self.assertNotIn("provider-secret-diagnostic", str(failed))

    async def test_query_bounds_results_and_removes_local_paths(self) -> None:
        """检索结果限制数量并把路径元数据收缩为文件名，不返回本机目录。"""

        raw_results = [{
            "content": "knowledge content",
            "metadata": {
                "file_name": "guide.md",
                "file_path": "C:\\private\\workspace\\guide.md",
                "doc_id": "doc-1",
            },
        }]
        with tempfile.TemporaryDirectory(prefix="openxnet-kb-query-") as directory:
            controller = KnowledgeBaseRuntimeController(Path(directory))
            with (
                patch("py.know_base.query_knowledge_base", AsyncMock(return_value=raw_results)),
                patch("py.knowledge_base_runtime.load_settings", AsyncMock(return_value={})),
            ):
                result = await controller.query("kb-query", "knowledge", 5)

        self.assertEqual(result["count"], 1)
        self.assertEqual(result["results"][0]["fileName"], "guide.md")
        self.assertEqual(result["results"][0]["metadata"]["file_path"], "guide.md")
        self.assertNotIn("private", str(result).lower())

    async def test_rejects_invalid_scope_and_empty_query(self) -> None:
        """拒绝路径型 scope 和空查询，失败时不访问文件系统或模型。"""

        with tempfile.TemporaryDirectory(prefix="openxnet-kb-invalid-") as directory:
            controller = KnowledgeBaseRuntimeController(Path(directory))
            with self.assertRaises(ValueError):
                await controller.status("../escape")
            with self.assertRaises(ValueError):
                await controller.query("valid-kb", " ", 5)

    async def test_internal_artifact_url_reads_local_file_and_rejects_traversal(self) -> None:
        """内部 Artifact URL 直接读取允许目录普通文件，编码路径穿越在读取前拒绝。"""

        with tempfile.TemporaryDirectory(prefix="openxnet-kb-artifact-") as directory:
            root = Path(directory)
            (root / "guide.md").write_text("typed knowledge", encoding="utf-8")
            with patch.object(load_files, "UPLOAD_FILES_DIR", str(root)):
                content, extension = await load_files.handle_url(
                    "http://127.0.0.1:3456/uploaded_files/guide.md"
                )
                with self.assertRaises(ValueError):
                    load_files.resolve_internal_file_url(
                        "http://127.0.0.1:3456/uploaded_files/%2e%2e%2fsecret.txt"
                    )

        self.assertEqual(content.decode("utf-8"), "typed knowledge")
        self.assertEqual(extension, "md")


class KnowledgeBaseEngineApiTests(unittest.IsolatedAsyncioTestCase):
    """验证私有知识库 HTTP 适配器的精确载荷。"""

    async def test_routes_forward_exact_payloads_and_reject_extra_fields(self) -> None:
        """合法请求转发给控制器，额外字段由 Pydantic 在调用前拒绝。"""

        controller = AsyncMock(spec=KnowledgeBaseRuntimeController)
        controller.status.return_value = {
            "schema": "openxnet.knowledge-base-status.v1",
            "knowledgeBaseId": "kb-one",
            "status": "completed",
        }
        application = FastAPI()
        register_knowledge_base_engine_api(application, controller)
        transport = httpx.ASGITransport(app=application)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/v1/desktop/knowledge-base/status",
                json={"knowledgeBaseId": "kb-one"},
            )
            rejected = await client.post(
                "/v1/desktop/knowledge-base/status",
                json={"knowledgeBaseId": "kb-one", "path": "C:\\secret"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "completed")
        controller.status.assert_awaited_once_with("kb-one")
        self.assertEqual(rejected.status_code, 422)


if __name__ == "__main__":
    unittest.main()
