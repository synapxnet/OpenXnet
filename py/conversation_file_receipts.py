#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.
"""文件执行回执 — 保留实际写入快照和外部 CLI 文件事件。
File execution receipts — retain actual write snapshots and external CLI events.

Author: maoyo
Department: 研发部
Date: 2026-09-14
Version: 1.0.0
Security Level: INTERNAL
"""
from __future__ import annotations

import difflib
from pathlib import Path
from typing import Any, Callable

__version__ = "1.0.0"
__author__ = "maoyo"
__copyright__ = "Copyright 2026 Synapxnet"
__maintainer__ = "maoyo"
__email__ = "synapxnet@gmail.com"

MAX_FILE_BYTES = 128 * 1024
MAX_RECEIPT_TEXT = 96 * 1024
MAX_FILES = 128


class FileChangeResult(str):
    """兼容既有字符串工具结果并携带结构化文件记录。 / Retain string-result compatibility alongside structured file records."""

    def __new__(cls, text: str, file_changes: list[dict[str, Any]]):
        """创建纯文本兼容回执。 / Create a receipt compatible with plain-text consumers."""
        instance = super().__new__(cls, text)
        instance.file_changes = file_changes[:MAX_FILES]
        return instance


def file_changes_of(value: Any) -> list[dict[str, Any]]:
    """只读取显式文件字段，不解析普通输出或命令。 / Read explicit file fields without parsing ordinary output or commands."""
    changes = getattr(value, "file_changes", None)
    if isinstance(value, dict):
        changes = value.get("fileChanges", value.get("file_changes", changes))
    return [item for item in changes[:MAX_FILES] if isinstance(item, dict)] if isinstance(changes, list) else []


def merge_file_changes(previous: list[dict[str, Any]], incoming: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """按真实事件 ID 或目标路径更新记录，保留多文件进度。 / Update records by actual event ID or target path while retaining multi-file progress."""
    merged: dict[str, dict[str, Any]] = {}
    for item in [*previous, *incoming]:
        key = str(item.get("id") or item.get("path") or "")
        if key:
            merged[key] = item
    return list(merged.values())[-MAX_FILES:]


def capture_file_snapshot(target: Path) -> dict[str, Any]:
    """读取有界真实文件快照，不读取符号链接或二进制内容。 / Capture bounded actual file text without following symlinks or reading binary content."""
    try:
        if target.is_symlink():
            return {}
        if not target.exists():
            return {"exists": False, "text": ""}
        snapshot: dict[str, Any] = {"exists": True}
        if target.is_file() and target.stat().st_size <= MAX_FILE_BYTES:
            content = target.read_bytes()
            if len(content) <= MAX_FILE_BYTES and b"\0" not in content:
                snapshot["text"] = content.decode("utf-8")
        return snapshot
    except (OSError, UnicodeError):
        return {}


def completed_file_write(text: str, path: str, before: dict[str, Any], after: dict[str, Any]) -> FileChangeResult:
    """在写入已经成功后构造真实前后对照，未知内容保持缺失。 / Build actual before/after records only after successful writes, preserving unknown content as absent."""
    operation = "create" if before.get("exists") is False else "modify" if before.get("exists") is True else "write"
    change: dict[str, Any] = {"id": f"file:{path}", "path": path, "operation": operation, "status": "done", "confirmed": True, "contentSource": "receipt"}
    if isinstance(before.get("text"), str):
        change["before"] = before["text"][:MAX_RECEIPT_TEXT]
    if isinstance(after.get("text"), str):
        change["after"] = after["text"][:MAX_RECEIPT_TEXT]
    change["truncated"] = any(isinstance(value, str) and len(value) > MAX_RECEIPT_TEXT for value in [before.get("text"), after.get("text")])
    if isinstance(before.get("text"), str) and isinstance(after.get("text"), str) and max(len(before["text"]), len(after["text"])) <= MAX_FILE_BYTES:
        lines = list(difflib.unified_diff(before["text"].splitlines(), after["text"].splitlines(), fromfile=f"a/{path}", tofile=f"b/{path}", lineterm=""))
        change["additions"] = sum(line.startswith("+") and not line.startswith("+++") for line in lines)
        change["deletions"] = sum(line.startswith("-") and not line.startswith("---") for line in lines)
        diff = "\n".join(lines)
        change["diff"] = diff[:MAX_RECEIPT_TEXT]
        change["truncated"] = any(len(value) > MAX_RECEIPT_TEXT for value in [before["text"], after["text"], diff])
    return FileChangeResult(text, [change])


class CliFileEventCollector:
    """读取各 CLI 明确的文件调用和完成事件。 / Read explicit file invocations and completion events from each CLI."""

    def __init__(self, engine: str, redact: Callable[[str], str]):
        """绑定单次引擎运行及文本脱敏器。 / Bind one engine invocation and its text redactor."""
        self.engine = engine
        self.redact = redact
        self.pending: dict[str, dict[str, Any]] = {}

    def _clean(self, value: Any) -> Any:
        """递归脱敏回执文本，不附带供应商原始事件。 / Recursively redact receipt text without forwarding raw provider events."""
        if isinstance(value, str):
            return self.redact(value[:MAX_RECEIPT_TEXT])
        if isinstance(value, dict):
            return {key: self._clean(item) for key, item in value.items()}
        if isinstance(value, list):
            return [self._clean(item) for item in value[:MAX_FILES]]
        return value

    def feed(self, event: Any) -> FileChangeResult | None:
        """采集结构化文件事件；缺少成功证据时保持未确认。 / Collect structured file events while keeping outcomes unconfirmed without success evidence."""
        if not isinstance(event, dict):
            return None
        changes: list[dict[str, Any]] = []
        item = event.get("item")
        if self.engine == "oc" and isinstance(item, dict) and item.get("type") == "file_change":
            status = {"completed": "done", "failed": "error", "in_progress": "running"}.get(str(item.get("status") or ""), "unknown")
            if event.get("type") == "item.started" and status == "unknown":
                status = "running"
            source_changes = item.get("changes", [])
            if not isinstance(source_changes, list):
                return None
            for index, change in enumerate(source_changes[:MAX_FILES]):
                if not isinstance(change, dict) or not isinstance(change.get("path"), str):
                    continue
                operation = {"add": "create", "update": "modify", "delete": "delete", "rename": "rename"}.get(change.get("kind"), "write")
                row = {"id": f"{item.get('id', 'file-event')}:{index}", "path": change["path"], "operation": operation, "status": status, "confirmed": status == "done", "contentSource": "receipt"}
                for field in ["diff", "before", "after", "previousPath", "additions", "deletions"]:
                    if field in change:
                        row[field] = change[field]
                changes.append(row)
                if status == "running":
                    self.pending[row["id"]] = row
                else:
                    self.pending.pop(row["id"], None)
        else:
            message = event.get("message")
            blocks = message.get("content", []) if isinstance(message, dict) else [event]
            if not isinstance(blocks, list):
                return None
            for block in blocks[:MAX_FILES]:
                if not isinstance(block, dict):
                    continue
                event_type = block.get("type")
                call_id = str(block.get("id") or block.get("tool_id") or block.get("tool_use_id") or "")
                if event_type == "tool_use":
                    name = str(block.get("name") or block.get("tool_name") or "")
                    arguments = block.get("input", block.get("parameters", {}))
                    if not call_id or name not in {"Write", "Edit", "write_file", "edit_file", "replace"} or not isinstance(arguments, dict):
                        continue
                    path = arguments.get("file_path", arguments.get("path"))
                    if not isinstance(path, str) or not path:
                        continue
                    row = {"id": call_id, "path": path, "operation": "modify" if name in {"Edit", "edit_file", "replace"} else "write", "status": "running", "confirmed": False, "contentSource": "request"}
                    for source, target in [("content", "after"), ("old_string", "before"), ("new_string", "after")]:
                        if isinstance(arguments.get(source), str):
                            row[target] = arguments[source]
                    self.pending[call_id] = row
                    changes.append(row)
                elif event_type == "tool_result" and call_id in self.pending:
                    row = dict(self.pending.pop(call_id))
                    outcome = block.get("status")
                    row["status"] = "error" if block.get("is_error") is True or outcome in {"error", "failed"} else "done" if block.get("is_error") is False or outcome in {"success", "completed"} else "unknown"
                    row["confirmed"] = row["status"] == "done"
                    changes.append(row)
        while len(self.pending) > MAX_FILES:
            self.pending.pop(next(iter(self.pending)))
        for change in changes:
            if any(isinstance(value, str) and len(value) > MAX_RECEIPT_TEXT for value in change.values()):
                change["truncated"] = True
        cleaned = self._clean(changes)
        return FileChangeResult("", cleaned) if cleaned else None

    def finish(self, failed: bool = False) -> FileChangeResult | None:
        """结束时将未得到结果的文件调用标为失败或未确认。 / Mark file calls without a result as failed or unconfirmed when the process ends."""
        changes = [{**item, "status": "error" if failed else "unknown", "confirmed": False} for item in self.pending.values()]
        self.pending.clear()
        return FileChangeResult("", self._clean(changes)) if changes else None
