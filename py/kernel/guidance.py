#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.
"""会话隔离的非中断实时引导 / Conversation-scoped non-interrupting live guidance.
Author: maoyo | Department: 研发部 | Date: 2026-09-14
Version: 1.1.0 | Security Level: INTERNAL
"""
from __future__ import annotations

import hashlib
import json
import threading
import uuid
from dataclasses import asdict, dataclass, replace
from datetime import datetime, timezone
from typing import Any, Dict, List

__version__ = "1.1.0"
__author__ = "maoyo"
__copyright__ = "Copyright 2026 Synapxnet"
__maintainer__ = "maoyo"
__email__ = "synapxnet@gmail.com"
GUIDANCE_MODES = {"soft", "constraint", "safety", "interrupt"}


class GuidanceError(ValueError):
    """携带可公开处理的冲突，不暴露其他会话。 / Carry public conflicts without exposing other conversations."""

    def __init__(self, code: str, message: str, status_code: int = 409, guidance: dict | None = None):
        """保存明确错误与同作用域当前记录。 / Store an explicit error and current same-scope record."""
        super().__init__(message)
        self.code, self.status_code, self.guidance = code, status_code, guidance


def guidance_identity(value: Any, *, optional: bool = False) -> str:
    """精确验证身份，拒绝默认广播、截断与控制字符。 / Validate exact identities without default broadcasts, truncation, or controls."""
    if optional and value == "":
        return ""
    if not isinstance(value, str) or not value or len(value) > 512 or value != value.strip() or value == "__default__" or any(ord(c) < 32 or ord(c) == 127 for c in value):
        raise GuidanceError("guidance_invalid_identity", "A valid scoped guidance identity is required.", 422)
    return value


def _timestamp() -> str:
    """生成含时区的真实状态时间。 / Produce an actual timezone-aware state timestamp."""
    return datetime.now(timezone.utc).isoformat()


def _content(text: Any, mode: str, priority: int) -> tuple[str, str, int]:
    """验证完整编辑内容，不静默截断文本。 / Validate complete edits without silently truncating text."""
    if not isinstance(text, str) or not text.strip() or len(text) > 16_000 or "\x00" in text:
        raise GuidanceError("guidance_invalid_text", "Guidance text must contain 1 to 16000 characters.", 422)
    if mode not in GUIDANCE_MODES or isinstance(priority, bool) or not isinstance(priority, int) or not -100 <= priority <= 100:
        raise GuidanceError("guidance_invalid_options", "Guidance mode or priority is invalid.", 422)
    return text.strip(), mode, priority


@dataclass
class GuidanceItem:
    """单条引导及其真实修订。 / Hold one guidance item and its actual revision."""
    guidance_id: str
    conversation_id: str
    turn_id: str
    trace_id: str
    text: str
    mode: str = "soft"
    priority: int = 0
    consumed: bool = False
    consumed_at: str = ""
    created_at: str = ""
    state: str = "pending"
    revision: int = 1
    updated_at: str = ""
    canceled_at: str = ""
    consumed_stage: str = ""

    def to_dict(self) -> Dict:
        """返回独立公开副本，防止调用方改写登记。 / Return an independent public copy to prevent caller mutation."""
        return asdict(self)


class LiveGuidanceBus:
    """在同一锁下处理排队、编辑、撤回与精确会话接收。 / Queue, edit, cancel, and consume exact scopes under one lock."""

    def __init__(self, *, capacity: int = 200, operation_capacity: int = 4096):
        """建立有界记录与实例身份，不接触模型或持久任务。 / Create bounded records and runtime identity without models or durable tasks."""
        self._items: List[GuidanceItem] = []
        self._lock = threading.RLock()
        self.runtime_id = f"guidance_runtime_{uuid.uuid4().hex}"
        self.capacity = max(1, min(capacity, 200))
        self.operation_capacity = max(self.capacity, min(operation_capacity, 4096))
        self._operations: dict[tuple[str, str], tuple[str, str]] = {}
        self._support: dict[str, dict] = {}
        self._discarded = 0

    def set_support(self, conversation_id: str, supported: bool, reason: str = "") -> None:
        """记录实际执行通路能力，不承诺当前推理可以改写。 / Record actual execution-route support without promising in-flight request mutation."""
        if not conversation_id:
            return
        key = guidance_identity(conversation_id)
        with self._lock:
            self._support[key] = {"supported": bool(supported), "reason": str(reason)[:200]}
            while len(self._support) > 200:
                del self._support[next(iter(self._support))]

    def _runtime(self, runtime_id: str) -> None:
        """旧实例写入明确失败，不自动重放。 / Fail old-runtime writes explicitly without replay."""
        guidance_identity(runtime_id)
        if runtime_id != self.runtime_id:
            raise GuidanceError("guidance_runtime_changed", "Guidance runtime changed; review pending text before submitting again.")

    def _find(self, conversation_id: str, guidance_id: str) -> GuidanceItem:
        """跨会话或已淘汰记录不披露内容。 / Reveal no content for another scope or an evicted record."""
        item = next((row for row in self._items if row.conversation_id == conversation_id and row.guidance_id == guidance_id), None)
        if item is None:
            raise GuidanceError("guidance_not_found", "The guidance item is not retained in this conversation.", 404)
        return item

    def _operation(self, scope: str, request_id: str, values: dict) -> tuple[tuple[str, str], str, GuidanceItem | None]:
        """同作用域幂等键只能代表一个确定操作。 / Bind each scoped idempotency key to one exact operation."""
        key = (scope, guidance_identity(request_id))
        digest = hashlib.sha256(json.dumps(values, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()
        previous = self._operations.get(key)
        if previous:
            if previous[0] != digest:
                raise GuidanceError("guidance_idempotency_conflict", "This request identity belongs to a different guidance operation.")
            return key, digest, self._find(scope, previous[1])
        if len(self._operations) >= self.operation_capacity:
            raise GuidanceError("guidance_capacity_reached", "Guidance operation retention is full; no new operation was accepted.", 429)
        return key, digest, None

    def add(self, *, text: str, conversation_id: str, request_id: str, runtime_id: str, turn_id: str = "", trace_id: str = "", mode: str = "soft", priority: int = 0) -> GuidanceItem:
        """原子排队防重，队列满时不逐出未接收内容。 / Atomically queue and deduplicate without evicting unconsumed items when full."""
        scope = guidance_identity(conversation_id)
        turn, trace = guidance_identity(turn_id, optional=True), guidance_identity(trace_id, optional=True)
        text, mode, priority = _content(text, mode, priority)
        with self._lock:
            self._runtime(runtime_id)
            key, digest, previous = self._operation(scope, request_id, {"action": "add", "text": text, "mode": mode, "priority": priority, "turn": turn, "trace": trace})
            if previous:
                return replace(previous)
            if self._support.get(scope, {}).get("supported") is False:
                raise GuidanceError("guidance_unsupported", "The selected execution route does not support live guidance checkpoints.")
            if len(self._items) >= self.capacity:
                removable = next((item for item in self._items if item.state != "pending"), None)
                if removable is None:
                    raise GuidanceError("guidance_capacity_reached", "Guidance queue is full; no pending text was discarded.", 429)
                self._items.remove(removable)
                self._discarded += 1
            now = _timestamp()
            item = GuidanceItem(f"guidance_{uuid.uuid4().hex}", scope, turn, trace, text, mode, priority, created_at=now, updated_at=now)
            self._items.append(item)
            self._operations[key] = (digest, item.guidance_id)
            return replace(item)

    def mutate(self, *, conversation_id: str, guidance_id: str, request_id: str, runtime_id: str, expected_revision: int, action: str, text: str = "", mode: str = "soft", priority: int = 0) -> GuidanceItem:
        """待接收且修订一致才可修改或撤回，接收竞态明确冲突。 / Edit or cancel only pending matching revisions and report actual consumption races."""
        scope = guidance_identity(conversation_id)
        guidance_identity(guidance_id)
        if action not in {"edit", "cancel"} or isinstance(expected_revision, bool) or not isinstance(expected_revision, int) or expected_revision < 1:
            raise GuidanceError("guidance_invalid_operation", "Guidance operation or revision is invalid.", 422)
        if action == "edit":
            text, mode, priority = _content(text, mode, priority)
        with self._lock:
            self._runtime(runtime_id)
            key, digest, previous = self._operation(scope, request_id, {"action": action, "guidance": guidance_id, "revision": expected_revision, "text": text, "mode": mode, "priority": priority})
            if previous:
                return replace(previous)
            item = self._find(scope, guidance_id)
            if item.state != "pending":
                raise GuidanceError("guidance_conflict", "Guidance was already received or canceled and cannot be changed.", guidance=item.to_dict())
            if item.revision != expected_revision:
                raise GuidanceError("guidance_revision_conflict", "Guidance was edited elsewhere; review its current revision.", guidance=item.to_dict())
            item.revision += 1
            item.updated_at = _timestamp()
            if action == "cancel":
                item.state, item.canceled_at = "canceled", item.updated_at
            else:
                item.text, item.mode, item.priority = text, mode, priority
            self._operations[key] = (digest, item.guidance_id)
            return replace(item)

    def consume(self, *, conversation_id: str = "", turn_id: str = "", trace_id: str = "", limit: int = 10, stage: str = "checkpoint") -> List[GuidanceItem]:
        """只接收精确作用域副本，不广播、不终止模型。 / Consume only exact scoped copies without broadcasting or aborting a model."""
        if not conversation_id:
            return []
        scope = guidance_identity(conversation_id)
        now = _timestamp()
        with self._lock:
            matches = [item for item in self._items if item.state == "pending" and item.conversation_id == scope and (not item.turn_id or item.turn_id == turn_id) and (not item.trace_id or item.trace_id == trace_id)]
            matches.sort(key=lambda item: item.priority, reverse=True)
            matches = matches[:max(1, min(int(limit), 50))]
            for item in matches:
                item.state, item.consumed, item.consumed_at, item.updated_at = "consumed", True, now, now
                item.revision += 1
                item.consumed_stage = str(stage)[:100]
            return [replace(item) for item in matches]

    def pending(self, conversation_id: str = "") -> List[Dict]:
        """不提供跨会话正文，空身份返回空列表。 / Return no cross-conversation text and no records without identity."""
        if not conversation_id:
            return []
        scope = guidance_identity(conversation_id)
        with self._lock:
            return [item.to_dict() for item in self._items if item.state == "pending" and item.conversation_id == scope]

    def status(self, conversation_id: str = "") -> Dict:
        """返回有界队列计数，缺失历史不表示已接收。 / Return bounded queue counts without treating missing history as received."""
        with self._lock:
            items = [item for item in self._items if not conversation_id or item.conversation_id == conversation_id]
            return {"pending": sum(item.state == "pending" for item in items), "consumed": sum(item.state == "consumed" for item in items), "canceled": sum(item.state == "canceled" for item in items), "capacity": self.capacity, "operation_capacity": self.operation_capacity, "history_truncated": self._discarded > 0, "persistence": "process", "delivery": "next_supported_checkpoint"}

    def snapshot(self, conversation_id: str, runtime_id: str = "") -> Dict:
        """返回会话待接收与近期终态，并明确实例变化。 / Return scoped pending and recent states with explicit runtime changes."""
        scope = guidance_identity(conversation_id)
        guidance_identity(runtime_id, optional=True)
        with self._lock:
            items = [item.to_dict() for item in self._items if item.conversation_id == scope]
            return {"ok": True, "runtime_id": self.runtime_id, "restarted": bool(runtime_id and runtime_id != self.runtime_id), "conversation_id": scope, "items": items, "pending": [item for item in items if item["state"] == "pending"], "recent": [item for item in items if item["state"] != "pending"], "status": self.status(scope), "capability": self._support.get(scope, {"supported": None, "reason": "Waiting for a supported execution checkpoint."})}


def format_guidance_context(items: List[GuidanceItem]) -> str:
    """构建后续请求可用的用户引导，不声称已采纳。 / Build user guidance for later requests without claiming adoption."""
    if not items:
        return ""
    lines = ["[OpenXnet Live Guidance]", "The user added these non-interrupting corrections while the turn was running.", "Consider them for subsequent reasoning, tool selection, and final response; retain all safety and approval requirements."]
    lines.extend(f"- ({item.mode}, priority={item.priority}) {item.text}" for item in items)
    return "\n".join(lines)


_bus = LiveGuidanceBus()


def get_guidance_bus() -> LiveGuidanceBus:
    """返回当前进程唯一引导登记。 / Return this process's sole guidance registry."""
    return _bus
