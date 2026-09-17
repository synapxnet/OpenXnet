#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.
"""子智能体协作记录 — 仅持久化真实委派与可见执行消息。
Subagent collaboration records — persist actual delegation and visible execution messages.

Author: maoyo
Department: 研发部
Date: 2026-09-14
Version: 1.0.0
Security Level: INTERNAL
"""
from __future__ import annotations

from datetime import datetime, timezone
import json
import re
from typing import Any

__version__ = "1.0.0"
__author__ = "maoyo"
__copyright__ = "Copyright 2026 Synapxnet"
__maintainer__ = "maoyo"
__email__ = "synapxnet@gmail.com"

AGENT_TRANSCRIPT_SCHEMA = "openxnet.agent-transcript.v1"
MAX_TRANSCRIPT_BYTES = 96 * 1024
MAX_TRANSCRIPT_ROWS = 128
MAX_MESSAGE_CHARS = 16_384
_TRANSCRIPT_TOKEN = re.compile(r"```[^\n]*\n[\s\S]*?(?:```|$)|~~~[^\n]*\n[\s\S]*?(?:~~~|$)|`[^`\n]+`|<\s*(/?)\s*(think|thought|thinking|analysis|reasoning|system|script|style)\b[^>]*>", re.IGNORECASE)
_SECRET_ASSIGNMENT = re.compile(r'''(?i)(["']?(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|passwd|secret|authorization)["']?\s*[:=]\s*)(?:["'][^"'\r\n]*["']|[^\s,;\r\n}]+)''')
_BEARER = re.compile(r"(?i)\bBearer\s+[A-Za-z0-9._~+/=-]+")
_KEY_TOKEN = re.compile(r"\b(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9_]{16,})\b")


def visible_transcript_text(value: Any) -> str:
    """移除完整或未闭合的隐藏区与常见凭据，不读取系统设置。 / Remove closed or unfinished hidden blocks and common credentials without reading settings."""
    if not isinstance(value, str):
        return ""
    output: list[str] = []
    stack: list[str] = []
    offset = 0
    for match in _TRANSCRIPT_TOKEN.finditer(value):
        if not stack:
            output.append(value[offset:match.start()])
        if match.group(0).startswith(("`", "~~~")):
            if not stack:
                output.append(match.group(0))
            offset = match.end()
            continue
        tag = match.group(2).lower()
        if match.group(1):
            if stack and tag in stack:
                # 保守关闭最内层匹配块，不把畸形嵌套内容显示出来。 / Close matching nested blocks conservatively.
                index = len(stack) - 1 - stack[::-1].index(tag)
                stack = stack[:index]
        elif not match.group(0).rstrip().endswith("/>"):
            stack.append(tag)
        offset = match.end()
    if not stack:
        # 仅过滤未被代码块消费的残余隐藏标签前缀。 / Filter unfinished hidden prefixes only outside consumed code blocks.
        output.append(re.sub(r"(?is)<\s*(?:think|thought|thinking|analysis|reasoning|system|script|style)\b[^>]*$", "", value[offset:]))
    text = "".join(output)
    text = _SECRET_ASSIGNMENT.sub(r"\1[redacted]", text)
    text = _BEARER.sub("Bearer [redacted]", text)
    text = _KEY_TOKEN.sub("[redacted]", text)
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
    return text.strip()


class AgentTranscript:
    """为单一真实任务保存有限公开消息，并保持跨运行消息身份。 / Retain bounded public messages for one actual task across execution sessions."""

    def __init__(self, task: Any, session_id: str) -> None:
        """仅恢复匹配当前任务的白名单字段。 / Restore allowlisted fields only when the stored task identity matches."""
        self.task_id = str(task.task_id)
        self.parent_task_id = str(getattr(task, "parent_task_id", "") or "")
        self.session_id = session_id
        self.rows: list[dict[str, Any]] = []
        self.truncated = False
        previous = (task.context or {}).get("agent_transcript")
        if isinstance(previous, dict) and previous.get("schema") == AGENT_TRANSCRIPT_SCHEMA and previous.get("task_id") == self.task_id:
            self.truncated = previous.get("truncated") is True
            records = previous.get("messages")
            if isinstance(records, list):
                for row in records[-MAX_TRANSCRIPT_ROWS:]:
                    if not isinstance(row, dict) or not isinstance(row.get("kind"), str) or row.get("kind") not in {"delegation", "continuation", "assistant", "tool_receipt"} or row.get("hidden") is True:
                        continue
                    if str(row.get("role")) in {"system", "developer", "analysis", "reasoning"} or str(row.get("channel")) in {"system", "developer", "analysis", "reasoning"}:
                        continue
                    self.append(row["kind"], row.get("content"), record_id=str(row.get("id") or "")[:256],
                                created_at=str(row.get("created_at") or "")[:64], session_id=str(row.get("session_id") or "")[:128],
                                status=str(row.get("status") or "")[:32], tool_name=str(row.get("tool_name") or "")[:512],
                                truncated=row.get("truncated") is True)
                self.truncated = self.truncated or len(records) > MAX_TRANSCRIPT_ROWS

    def append(self, kind: str, content: Any, *, record_id: str = "", created_at: str = "", session_id: str = "", status: str = "", tool_name: str = "", truncated: bool = False) -> None:
        """添加实际可见消息，拒绝未知角色并显式标注截断。 / Append an actual visible message, reject unknown roles, and mark truncation explicitly."""
        if kind not in {"delegation", "continuation", "assistant", "tool_receipt"}:
            return
        text = visible_transcript_text(content)
        if not text:
            return
        role = "subagent" if kind == "assistant" else "tool" if kind == "tool_receipt" else "parent"
        row = {
            "id": record_id or f"{self.session_id}:{len(self.rows)}:{datetime.now(timezone.utc).timestamp()}",
            "kind": kind, "role": role,
            "sender": "child" if role == "subagent" else "tool" if role == "tool" else "runtime" if kind == "continuation" else "parent",
            "recipient": "parent" if role == "subagent" else "child",
            "content": text[:MAX_MESSAGE_CHARS],
            "created_at": created_at or datetime.now(timezone.utc).isoformat(),
            "session_id": session_id or self.session_id,
        }
        if status in {"done", "error", "running", "cancelled", "interrupted", "unknown"}:
            row["status"] = status
        if tool_name:
            row["tool_name"] = visible_transcript_text(tool_name)[:512]
        if truncated or len(text) > MAX_MESSAGE_CHARS:
            row["truncated"] = True
            self.truncated = True
        self.rows.append(row)
        self._trim()

    def _trim(self) -> None:
        """限制记录数量及UTF-8总量，保留最近真实记录。 / Bound row count and total UTF-8 size while retaining recent actual records."""
        while len(self.rows) > MAX_TRANSCRIPT_ROWS or len(json.dumps(self.snapshot(), ensure_ascii=False).encode("utf-8")) > MAX_TRANSCRIPT_BYTES:
            self.rows.pop(0)
            self.truncated = True

    def snapshot(self) -> dict[str, Any]:
        """返回不包含运行配置或系统消息的传输快照。 / Return a transport snapshot without runtime settings or system messages."""
        return {"schema": AGENT_TRANSCRIPT_SCHEMA, "task_id": self.task_id, "parent_task_id": self.parent_task_id,
                "session_id": self.session_id, "messages": [dict(row) for row in self.rows], "truncated": self.truncated}
