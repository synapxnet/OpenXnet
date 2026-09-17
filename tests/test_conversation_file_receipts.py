#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.
"""文件回执生产者回归 / File receipt producer regression.
Author: maoyo | Department: 研发部 | Date: 2026-09-14
Version: 1.0.0 | Security Level: INTERNAL
"""
from __future__ import annotations

import asyncio
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

from py.conversation_file_receipts import CliFileEventCollector, FileChangeResult, capture_file_snapshot, completed_file_write, merge_file_changes
from py.cli_tool import edit_file_tool_local, edit_file_patch_tool_local, _stream_cli_file_events, _build_codex_exec_args, _stream_codex_native, _stream_codex_wsl, _stream_claude_cli, qwen_code

__version__ = "1.0.0"
__author__ = "maoyo"
__copyright__ = "Copyright 2026 Synapxnet"
__maintainer__ = "maoyo"
__email__ = "synapxnet@gmail.com"


class FileReceiptTests(unittest.IsolatedAsyncioTestCase):
    """通过真实工具与实际临时文件检验回执。 / Verify receipts through actual tools and real temporary files."""

    async def test_actual_local_create_and_patch_capture_disk_content(self):
        """创建和替换必须记录实际落盘内容及正确分类。 / Create and patch operations must record actual disk content and correct operation types."""
        with TemporaryDirectory() as directory:
            target = Path(directory) / "example.txt"
            with patch("py.cli_tool._get_current_cwd", AsyncMock(return_value=directory)), patch("py.cli_tool.resolve_strict_path", return_value=target), patch("py.git_shadow.git_checkpoint", AsyncMock()):
                created = await edit_file_tool_local("example.txt", "first\nsecond\n")
                self.assertIsInstance(created, FileChangeResult)
                self.assertEqual(created.file_changes[0]["operation"], "create")
                self.assertEqual(created.file_changes[0]["before"], "")
                self.assertEqual(created.file_changes[0]["after"], target.read_bytes().decode("utf-8"))
                changed = await edit_file_patch_tool_local("example.txt", "first", "changed")
                row = changed.file_changes[0]
                self.assertEqual(row["operation"], "modify")
                self.assertEqual(row["before"], created.file_changes[0]["after"])
                self.assertEqual(row["after"], target.read_bytes().decode("utf-8"))
                self.assertEqual(row["after"].replace("\r\n", "\n"), "changed\nsecond\n")
                self.assertEqual((row["additions"], row["deletions"]), (1, 1))
                self.assertIn("-first", row["diff"])
                self.assertEqual(row["contentSource"], "receipt")
                failure = await edit_file_patch_tool_local("example.txt", "does not exist", "not written")
                self.assertFalse(hasattr(failure, "file_changes"))
                self.assertNotIn("not written", target.read_text())

    def test_codex_actual_event_shapes_preserve_create_delete_and_unfinished_states(self):
        """Codex 文件事件保留显式状态；命令文本不生成变更。 / Codex file events retain explicit states while command text never generates changes."""
        collector = CliFileEventCollector("oc", str)
        started = collector.feed({"type": "item.started", "item": {"id": "patch", "type": "file_change", "status": "in_progress", "changes": [{"path": "new.py", "kind": "add"}, {"path": "old.py", "kind": "delete"}]}})
        self.assertEqual([row["status"] for row in started.file_changes], ["running", "running"])
        done = collector.feed({"type": "item.completed", "item": {"id": "patch", "type": "file_change", "status": "completed", "changes": [{"path": "new.py", "kind": "add", "diff": "+new"}, {"path": "old.py", "kind": "delete"}]}})
        self.assertEqual([row["operation"] for row in done.file_changes], ["create", "delete"])
        self.assertTrue(all(row["confirmed"] for row in done.file_changes))
        self.assertIsNone(collector.finish())
        self.assertIsNone(collector.feed({"type": "item.completed", "item": {"type": "command_execution", "command": "rm old.py", "status": "completed"}}))
        collector.feed({"type": "item.started", "item": {"id": "pending", "type": "file_change", "changes": [{"path": "pending", "kind": "update"}]}})
        self.assertEqual(collector.finish().file_changes[0]["status"], "unknown")

    def test_claude_and_qwen_require_matching_file_result_and_redact(self):
        """内部文件调用只能由匹配的完成回执确认且敏感文本脱敏。 / Internal file calls require matching completion receipts and redact sensitive text."""
        for engine in ["cc", "qc"]:
            collector = CliFileEventCollector(engine, lambda text: text.replace("SECRET", "[REDACTED]"))
            pending = collector.feed({"type": "tool_use", "id": "write", "name": "Write", "input": {"file_path": "file.txt", "content": "SECRET"}})
            self.assertFalse(pending.file_changes[0]["confirmed"])
            self.assertEqual(pending.file_changes[0]["after"], "[REDACTED]")
            self.assertIsNone(collector.feed({"type": "tool_result", "tool_use_id": "unrelated", "is_error": False}))
            done = collector.feed({"type": "tool_result", "tool_use_id": "write", "is_error": False})
            self.assertTrue(done.file_changes[0]["confirmed"])
            self.assertEqual(done.file_changes[0]["contentSource"], "request")
            self.assertEqual(done.file_changes[0]["operation"], "write")

    async def test_json_stream_retains_file_metadata_without_hidden_reasoning(self):
        """实际流解析保留文件属性并排除非公开 JSON 事件。 / Actual stream parsing retains file metadata and excludes nonpublic JSON events."""
        import asyncio
        stream = asyncio.StreamReader()
        for event in [
            {"type": "item.completed", "item": {"type": "reasoning", "text": "HIDDEN_REASONING"}},
            {"type": "item.completed", "item": {"id": "patch", "type": "file_change", "status": "completed", "changes": [{"path": "gone.py", "kind": "delete"}]}},
            {"type": "item.completed", "item": {"type": "agent_message", "text": "Visible reply"}},
        ]:
            stream.feed_data((json.dumps(event) + "\n").encode())
        stream.feed_eof()
        output = [chunk async for chunk in _stream_cli_file_events(stream, CliFileEventCollector("oc", str), ())]
        self.assertEqual(output[0].file_changes[0]["operation"], "delete")
        self.assertEqual("".join(output), "Visible reply")
        self.assertIn("--json", _build_codex_exec_args("default", "result.txt"))

    def test_missing_snapshots_and_merging_never_fabricate_contents(self):
        """未知快照不补造旧内容，同事件更新保留其他文件。 / Unknown snapshots never invent old content and event updates preserve other files."""
        with TemporaryDirectory() as directory:
            target = Path(directory) / "binary.bin"
            target.write_bytes(b"\x00binary")
            self.assertEqual(capture_file_snapshot(target), {"exists": True})
        row = completed_file_write("Saved", "file.txt", {}, {"exists": True, "text": ""}).file_changes[0]
        self.assertEqual(row["operation"], "write")
        self.assertNotIn("before", row)
        self.assertNotIn("additions", row)
        merged = merge_file_changes([{"id": "a", "status": "running"}, {"id": "b", "status": "done"}], [{"id": "a", "status": "error"}])
        self.assertEqual([item["status"] for item in merged], ["error", "done"])

    async def test_subprocess_wrappers_preserve_empty_file_receipts(self):
        """实际子进程封装不能丢弃空文本回执，也不能阻止最终正文兜底。 / Actual subprocess wrappers retain empty-text receipts and the final-text fallback."""
        def process_for(events):
            """隔离子进程而保留实际异步读流。 / Isolate subprocess creation while retaining actual asynchronous readers."""
            stdout, stderr = asyncio.StreamReader(), asyncio.StreamReader()
            for event in events:
                stdout.feed_data((json.dumps(event) + "\n").encode())
            stdout.feed_eof()
            stderr.feed_eof()
            stdin = SimpleNamespace(write=Mock(), drain=AsyncMock(), close=Mock(), wait_closed=AsyncMock())
            return SimpleNamespace(stdout=stdout, stderr=stderr, stdin=stdin, wait=AsyncMock(return_value=0), returncode=0)

        codex_events = [{"type": "item.completed", "item": {"id": "p", "type": "file_change", "status": "completed", "changes": [{"path": "a.py", "kind": "add"}]}}]
        with TemporaryDirectory() as directory:
            last = Path(directory) / "last.txt"
            last.write_text("Final reply", encoding="utf-8")
            for engine in ["native", "wsl"]:
                with patch("py.cli_tool.asyncio.create_subprocess_exec", AsyncMock(return_value=process_for(codex_events))):
                    stream = _stream_codex_native("codex", [], directory, {}, "prompt", last, ()) if engine == "native" else _stream_codex_wsl("wsl", "default", directory, {}, Path(directory) / "prompt.txt", last, ())
                    chunks = [chunk async for chunk in stream]
                self.assertIsInstance(chunks[0], FileChangeResult)
                self.assertEqual(chunks[0].file_changes[0]["operation"], "create")
                self.assertEqual("".join(chunks), "Final reply")

            events = [{"type": "assistant", "message": {"content": [{"type": "tool_use", "id": "w", "name": "Write", "input": {"file_path": "a.py", "content": "value"}}]}}, {"type": "user", "message": {"content": [{"type": "tool_result", "tool_use_id": "w", "is_error": False}]}}]
            with patch("py.cli_tool.asyncio.create_subprocess_exec", AsyncMock(return_value=process_for(events))):
                chunks = [chunk async for chunk in _stream_claude_cli("claude", "prompt", directory, {}, "default", ())]
            self.assertEqual([chunk.file_changes[0]["status"] for chunk in chunks], ["running", "done"])

            qwen_events = [events[0]["message"]["content"][0], events[1]["message"]["content"][0]]
            with patch("py.cli_tool.asyncio.create_subprocess_exec", AsyncMock(return_value=process_for(qwen_events))), patch("py.cli_tool.load_settings", AsyncMock(return_value={"CLISettings": {"cc_path": directory}, "qcSettings": {}})):
                stream = await qwen_code("prompt")
                chunks = [chunk async for chunk in stream]
            self.assertEqual([chunk.file_changes[0]["status"] for chunk in chunks], ["running", "done"])


if __name__ == "__main__":
    unittest.main()
