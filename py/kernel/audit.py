#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""Append-only-ish audit helpers for kernel-visible actions."""

from __future__ import annotations

import json
import os
import re
import threading
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional


SENSITIVE_KEY_PARTS = (
    "api_key",
    "apikey",
    "token",
    "secret",
    "password",
    "cookie",
    "authorization",
    "access_key",
    "private_key",
    "credential",
    "bearer",
    "payment",
    "merchant",
    "stripe",
    "zpay",
)


_SENSITIVE_KEY_NORMALIZED = tuple(
    re.sub(r"[^a-z0-9]", "", part.lower()) for part in SENSITIVE_KEY_PARTS
)

_TOKEN_KEY_NAMES = {
    "token",
    "accesstoken",
    "refreshtoken",
    "idtoken",
    "sessiontoken",
    "authtoken",
    "bearertoken",
    "apitoken",
    "csrftoken",
}

_SAFE_METADATA_KEYS = {
    "canseerawsecrets",
    "cachedtokens",
    "compactedtokens",
    "completiontokens",
    "estimatedtokens",
    "inputtokens",
    "maxtokens",
    "originaltokens",
    "outputtokens",
    "prompttokens",
    "rawsecretsreturned",
    "reasoningtokens",
    "tokencount",
    "totaltokens",
}

_SECRET_VALUE_PATTERNS = (
    (
        re.compile(r"(?i)\b(bearer\s+)[A-Za-z0-9._~+/=-]{8,}"),
        r"\1[REDACTED]",
    ),
    (
        re.compile(
            r"(?i)\b((?:api[-_ ]?key|token|secret|password|authorization|access[-_ ]?key|private[-_ ]?key)\s*[:=]\s*)[^\s,;\"']+"
        ),
        r"\1[REDACTED]",
    ),
    (
        re.compile(
            r"(?i)\b((?:api[-_ ]?key|token|secret|password|authorization|access[-_ ]?key|private[-_ ]?key)\s+)[^\s,;\"']+"
        ),
        r"\1[REDACTED]",
    ),
    (
        re.compile(r"\b(?:sk|xoxb|xoxp|ghp|github_pat)-?[A-Za-z0-9_./+=-]{8,}\b"),
        "[REDACTED]",
    ),
    (
        re.compile(r"\bAKIA[0-9A-Z]{12,}\b"),
        "[REDACTED]",
    ),
)


def _is_sensitive_key(key: Any) -> bool:
    key_text = str(key)
    lowered = key_text.lower()
    normalized = re.sub(r"[^a-z0-9]", "", lowered)
    if normalized in _SAFE_METADATA_KEYS:
        return False
    for part, normalized_part in zip(SENSITIVE_KEY_PARTS, _SENSITIVE_KEY_NORMALIZED):
        if normalized_part == "token":
            if normalized in _TOKEN_KEY_NAMES or "token" in normalized:
                return True
            continue
        if part in lowered or (normalized_part and normalized_part in normalized):
            return True
    return False


def _sanitize_string(value: str, *, max_string: int) -> str:
    text = value
    for pattern, replacement in _SECRET_VALUE_PATTERNS:
        text = pattern.sub(replacement, text)
    if len(text) > max_string:
        return text[:max_string] + "... [truncated]"
    return text


def sanitize_payload(value: Any, *, max_string: int = 1200) -> Any:
    """Return a JSON-safe copy with obvious secrets redacted."""
    if isinstance(value, dict):
        cleaned = {}
        for key, item in value.items():
            key_text = str(key)
            if _is_sensitive_key(key_text):
                cleaned[key_text] = "[REDACTED]"
            else:
                cleaned[key_text] = sanitize_payload(item, max_string=max_string)
        return cleaned
    if isinstance(value, list):
        return [sanitize_payload(item, max_string=max_string) for item in value[:80]]
    if isinstance(value, tuple):
        return [sanitize_payload(item, max_string=max_string) for item in value[:80]]
    if isinstance(value, str):
        return _sanitize_string(value, max_string=max_string)
    if value is None or isinstance(value, (bool, int, float)):
        return value
    return str(value)


def _default_audit_dir(workspace_dir: str = "") -> Path:
    if workspace_dir:
        return Path(workspace_dir).expanduser().resolve() / ".agent" / "memory"
    root = os.getenv("OPENXNET_RUNTIME_DIR") or os.path.join(os.getcwd(), "runtime")
    return Path(root).expanduser().resolve() / "kernel"


class KernelAuditLog:
    """Small JSONL audit writer with payload sanitization."""

    def __init__(self, workspace_dir: str = ""):
        self.workspace_dir = workspace_dir or ""
        self.audit_dir = _default_audit_dir(self.workspace_dir)
        self.audit_path = self.audit_dir / "kernel_audit.jsonl"
        self._lock = threading.Lock()

    def append(
        self,
        event_type: str,
        payload: Optional[Dict[str, Any]] = None,
        *,
        actor: str = "system",
        workspace_dir: str = "",
    ) -> Dict[str, Any]:
        record = {
            "audit_id": f"audit_{uuid.uuid4().hex}",
            "event_type": event_type,
            "actor": actor,
            "workspace_dir": workspace_dir or self.workspace_dir,
            "payload": sanitize_payload(payload or {}),
            "created_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        }
        self.audit_dir.mkdir(parents=True, exist_ok=True)
        with self._lock:
            with self.audit_path.open("a", encoding="utf-8") as handle:
                handle.write(json.dumps(record, ensure_ascii=False) + "\n")
        try:
            from py.kernel.event_bus import get_kernel_event_bus
            get_kernel_event_bus().publish(event_type, record)
        except Exception:
            pass
        return record

    def recent(self, limit: int = 100, event_type: str = "") -> List[Dict[str, Any]]:
        """Read recent audit records without exposing raw file contents."""
        max_items = max(1, min(int(limit or 100), 500))
        wanted_type = str(event_type or "").strip()
        if not self.audit_path.exists():
            return []

        records: List[Dict[str, Any]] = []
        try:
            with self.audit_path.open("rb") as handle:
                handle.seek(0, os.SEEK_END)
                size = handle.tell()
                window = min(size, 1024 * 1024)
                handle.seek(size - window)
                if size > window:
                    handle.readline()
                lines = handle.read().decode("utf-8", errors="replace").splitlines()
        except Exception:
            return []

        for line in reversed(lines):
            if len(records) >= max_items:
                break
            line = line.strip()
            if not line:
                continue
            try:
                record = json.loads(line)
            except Exception:
                continue
            if wanted_type and record.get("event_type") != wanted_type:
                continue
            records.append(sanitize_payload(record))

        records.reverse()
        return records


_logs: Dict[str, KernelAuditLog] = {}


def get_kernel_audit(workspace_dir: str = "") -> KernelAuditLog:
    key = str(Path(workspace_dir).expanduser().resolve()) if workspace_dir else "__global__"
    if key not in _logs:
        _logs[key] = KernelAuditLog(workspace_dir)
    return _logs[key]
