# -*- coding: utf-8 -*-
"""Typed authenticated execution-session protocol for supervised task jobs."""

from __future__ import annotations

from collections.abc import AsyncIterable, AsyncIterator, Mapping, Sequence
from dataclasses import dataclass
import codecs
import json
import re
from typing import Any
from urllib.parse import urlparse
from uuid import uuid4

import httpx


TASK_EXECUTION_TURN_SCHEMA = "openxnet.task-execution-turn.v1"
TASK_EXECUTION_EVENT_SCHEMA = "openxnet.task-execution-event.v1"
TASK_EXECUTION_EVALUATION_SCHEMA = "openxnet.task-execution-evaluation.v1"
TASK_EXECUTION_CANCEL_SCHEMA = "openxnet.task-execution-cancel.v1"
MAX_SESSION_MESSAGES = 64
MAX_SESSION_MESSAGE_BYTES = 128 * 1024
MAX_SESSION_MESSAGES_BYTES = 1024 * 1024
MAX_SESSION_EVENT_BYTES = 256 * 1024
MAX_SESSION_STREAM_BYTES = 8 * 1024 * 1024
MAX_SESSION_TEXT_DELTA = 64 * 1024
MAX_LEGACY_SSE_BUFFER_BYTES = 512 * 1024
_IDENTIFIER_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,128}$")


class TaskExecutionSessionError(RuntimeError):
    """Represent one bounded session broker or protocol failure."""

    def __init__(self, code: str, message: str, *, retryable: bool = False) -> None:
        """Create a structured error without provider or credential details."""

        super().__init__(message)
        self.code = str(code or "SESSION_FAILED")[:128]
        self.retryable = bool(retryable)


@dataclass(frozen=True)
class TaskExecutionSessionEvent:
    """One validated event emitted by the execution-session broker."""

    sequence: int
    event_type: str
    text: str = ""
    tool_type: str = ""
    title: str = ""
    content: str = ""
    code: str = ""
    message: str = ""
    retryable: bool = False


def normalize_session_identifier(value: Any, field_name: str) -> str:
    """Validate one bounded language-neutral session or task identifier."""

    normalized = str(value or "").strip()
    if not _IDENTIFIER_PATTERN.fullmatch(normalized):
        raise TaskExecutionSessionError(
            "INVALID_SESSION_REQUEST",
            f"Execution session field '{field_name}' is invalid.",
        )
    return normalized


def normalize_session_messages(value: Any) -> list[dict[str, str]]:
    """Validate and copy a bounded sequence of text-only conversation messages."""

    if not isinstance(value, Sequence) or isinstance(value, (str, bytes, bytearray)):
        raise TaskExecutionSessionError(
            "INVALID_SESSION_MESSAGES",
            "Execution session messages must be an array.",
        )
    if not 1 <= len(value) <= MAX_SESSION_MESSAGES:
        raise TaskExecutionSessionError(
            "INVALID_SESSION_MESSAGES",
            "Execution session message count is outside the allowed range.",
        )
    normalized: list[dict[str, str]] = []
    total_bytes = 0
    for item in value:
        if not isinstance(item, Mapping) or set(item) != {"role", "content"}:
            raise TaskExecutionSessionError(
                "INVALID_SESSION_MESSAGES",
                "Execution session messages require exact role and content fields.",
            )
        role = str(item.get("role") or "").strip().lower()
        content = item.get("content")
        if role not in {"system", "user", "assistant"} or not isinstance(content, str):
            raise TaskExecutionSessionError(
                "INVALID_SESSION_MESSAGES",
                "Execution session message role or content is invalid.",
            )
        content_bytes = len(content.encode("utf-8"))
        if content_bytes > MAX_SESSION_MESSAGE_BYTES:
            raise TaskExecutionSessionError(
                "SESSION_MESSAGE_TOO_LARGE",
                "One execution session message exceeds the payload budget.",
            )
        total_bytes += content_bytes
        if total_bytes > MAX_SESSION_MESSAGES_BYTES:
            raise TaskExecutionSessionError(
                "SESSION_MESSAGES_TOO_LARGE",
                "Execution session messages exceed the total payload budget.",
            )
        normalized.append({"role": role, "content": content})
    return normalized


def normalize_session_max_tokens(value: Any) -> int:
    """Validate one finite model output budget without silently expanding it."""

    if isinstance(value, bool):
        raise TaskExecutionSessionError(
            "INVALID_SESSION_REQUEST",
            "Execution session maxTokens is invalid.",
        )
    try:
        normalized = int(value)
    except (TypeError, ValueError) as error:
        raise TaskExecutionSessionError(
            "INVALID_SESSION_REQUEST",
            "Execution session maxTokens is invalid.",
        ) from error
    if not 256 <= normalized <= 65_536:
        raise TaskExecutionSessionError(
            "INVALID_SESSION_REQUEST",
            "Execution session maxTokens is outside the allowed range.",
        )
    return normalized


def encode_session_event(
    session_id: str,
    sequence: int,
    event_type: str,
    **payload: Any,
) -> str:
    """Serialize one typed execution event as a compact UTF-8 SSE record."""

    value = {
        "schema": TASK_EXECUTION_EVENT_SCHEMA,
        "sessionId": normalize_session_identifier(session_id, "sessionId"),
        "sequence": max(0, int(sequence)),
        "type": str(event_type or "").strip(),
        **payload,
    }
    encoded = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    if len(encoded.encode("utf-8")) > MAX_SESSION_EVENT_BYTES:
        raise TaskExecutionSessionError(
            "SESSION_EVENT_TOO_LARGE",
            "Execution session event exceeds the payload budget.",
        )
    return f"data: {encoded}\n\n"


async def iter_legacy_sse_data(chunks: AsyncIterable[Any]) -> AsyncIterator[str]:
    """Yield complete single-line data fields from an arbitrarily chunked SSE body."""

    decoder = codecs.getincrementaldecoder("utf-8")("strict")
    buffer = ""
    async for chunk in chunks:
        if isinstance(chunk, bytes):
            buffer += decoder.decode(chunk, final=False)
        else:
            buffer += str(chunk)
        if len(buffer.encode("utf-8")) > MAX_LEGACY_SSE_BUFFER_BYTES:
            raise TaskExecutionSessionError(
                "LEGACY_STREAM_BUFFER_EXCEEDED",
                "Legacy execution stream exceeded the line buffer budget.",
            )
        while "\n" in buffer:
            line, buffer = buffer.split("\n", 1)
            normalized_line = line.rstrip("\r")
            if normalized_line.startswith("data:"):
                yield normalized_line[5:].lstrip()
    buffer += decoder.decode(b"", final=True)
    normalized_tail = buffer.rstrip("\r")
    if normalized_tail.startswith("data:"):
        yield normalized_tail[5:].lstrip()


async def translate_legacy_execution_stream(
    chunks: AsyncIterable[Any],
    session_id: str,
) -> AsyncIterator[str]:
    """Translate legacy OpenAI-style SSE into the stable task event contract."""

    sequence = 0
    done_emitted = False
    try:
        async for raw_data in iter_legacy_sse_data(chunks):
            if raw_data.strip() == "[DONE]":
                sequence += 1
                yield encode_session_event(session_id, sequence, "done")
                done_emitted = True
                break
            try:
                chunk = json.loads(raw_data)
            except json.JSONDecodeError:
                continue
            if not isinstance(chunk, Mapping):
                continue
            if "error" in chunk:
                sequence += 1
                yield encode_session_event(
                    session_id,
                    sequence,
                    "error",
                    code="PROVIDER_STREAM_ERROR",
                    message="Execution provider reported a stream error.",
                    retryable=True,
                )
                continue
            choices = chunk.get("choices")
            if not isinstance(choices, list) or not choices or not isinstance(choices[0], Mapping):
                continue
            delta = choices[0].get("delta")
            if not isinstance(delta, Mapping):
                continue
            content = delta.get("content")
            if isinstance(content, str) and content:
                for offset in range(0, len(content), MAX_SESSION_TEXT_DELTA):
                    sequence += 1
                    yield encode_session_event(
                        session_id,
                        sequence,
                        "text_delta",
                        text=content[offset:offset + MAX_SESSION_TEXT_DELTA],
                    )
            tool = delta.get("tool_content")
            if isinstance(tool, Mapping):
                sequence += 1
                tool_type = str(tool.get("type") or "event").strip().lower()[:64]
                yield encode_session_event(
                    session_id,
                    sequence,
                    "tool_event",
                    toolType=tool_type or "event",
                    title=str(tool.get("title") or "")[:512],
                    content=str(tool.get("content") or "")[:65_536],
                )
    except (UnicodeDecodeError, TaskExecutionSessionError):
        sequence += 1
        yield encode_session_event(
            session_id,
            sequence,
            "error",
            code="INVALID_LEGACY_STREAM",
            message="Execution provider returned an invalid stream.",
            retryable=False,
        )
    if not done_emitted:
        sequence += 1
        yield encode_session_event(session_id, sequence, "done")


class TaskExecutionSessionClient:
    """Consume the authenticated backend execution-session broker from a Worker."""

    def __init__(
        self,
        backend_origin: str,
        task_rpc_token: str,
        workspace_path: str,
        task_id: str,
        *,
        session_id: str | None = None,
        max_tokens: int = 4000,
        timeout_seconds: float = 600.0,
    ) -> None:
        """Create one task-bound client without accepting provider configuration."""

        self._origin = self._normalize_backend_origin(backend_origin)
        self._token = str(task_rpc_token or "").strip()
        self._workspace_path = str(workspace_path or "").strip()
        if not self._workspace_path or len(self._workspace_path) > 32_768:
            raise TaskExecutionSessionError(
                "INVALID_SESSION_REQUEST",
                "Execution session workspacePath is invalid.",
            )
        self._task_id = normalize_session_identifier(task_id, "taskId")
        self._session_id = normalize_session_identifier(
            session_id or f"ses_{uuid4().hex}",
            "sessionId",
        )
        self._max_tokens = normalize_session_max_tokens(max_tokens)
        timeout = max(5.0, min(float(timeout_seconds), 900.0))
        self._client = httpx.AsyncClient(timeout=httpx.Timeout(timeout))

    @property
    def session_id(self) -> str:
        """Return the stable identifier shared by all turns in this task job."""

        return self._session_id

    async def __aenter__(self) -> "TaskExecutionSessionClient":
        """Enter the client lifetime used by one supervised executor job."""

        return self

    async def __aexit__(self, *_arguments: object) -> None:
        """Close pooled loopback connections when the executor job terminates."""

        await self.close()

    async def close(self) -> None:
        """Close the underlying asynchronous HTTP client idempotently."""

        if not self._client.is_closed:
            await self._client.aclose()

    async def stream_turn(
        self,
        messages: Sequence[Mapping[str, Any]],
    ) -> AsyncIterator[TaskExecutionSessionEvent]:
        """Stream one validated task turn from the authenticated broker."""

        payload = {
            "schema": TASK_EXECUTION_TURN_SCHEMA,
            "sessionId": self._session_id,
            "taskId": self._task_id,
            "workspacePath": self._workspace_path,
            "messages": normalize_session_messages(messages),
            "maxTokens": self._max_tokens,
        }
        total_bytes = 0
        expected_sequence = 1
        done_seen = False
        try:
            async with self._client.stream(
                "POST",
                f"{self._origin}/v1/tasks/executor/session/turn",
                json=payload,
                headers=self._headers(),
            ) as response:
                if response.status_code != 200:
                    raise TaskExecutionSessionError(
                        "SESSION_BROKER_REJECTED",
                        f"Execution session broker returned HTTP {response.status_code}.",
                        retryable=response.status_code >= 500,
                    )
                async for line in response.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    data = line[5:].lstrip()
                    total_bytes += len(data.encode("utf-8"))
                    if total_bytes > MAX_SESSION_STREAM_BYTES:
                        raise TaskExecutionSessionError(
                            "SESSION_STREAM_TOO_LARGE",
                            "Execution session stream exceeds the payload budget.",
                        )
                    event = self._parse_event(data, expected_sequence)
                    expected_sequence += 1
                    yield event
                    if event.event_type == "done":
                        done_seen = True
                        break
        except httpx.HTTPError as error:
            raise TaskExecutionSessionError(
                "SESSION_BROKER_UNAVAILABLE",
                "Execution session broker connection failed.",
                retryable=True,
            ) from error
        if not done_seen:
            raise TaskExecutionSessionError(
                "SESSION_STREAM_INCOMPLETE",
                "Execution session stream ended without a terminal event.",
                retryable=True,
            )

    async def evaluate_completion(
        self,
        recent_progress: str,
    ) -> bool:
        """Ask the broker for one typed task-completion decision."""

        payload = {
            "schema": TASK_EXECUTION_EVALUATION_SCHEMA,
            "sessionId": self._session_id,
            "taskId": self._task_id,
            "workspacePath": self._workspace_path,
            "recentProgress": self._bounded_text(recent_progress, 16_384),
        }
        try:
            response = await self._client.post(
                f"{self._origin}/v1/tasks/executor/session/evaluate",
                json=payload,
                headers=self._headers(),
            )
        except httpx.HTTPError as error:
            raise TaskExecutionSessionError(
                "SESSION_BROKER_UNAVAILABLE",
                "Execution session broker connection failed.",
                retryable=True,
            ) from error
        if response.status_code != 200:
            raise TaskExecutionSessionError(
                "SESSION_EVALUATION_REJECTED",
                f"Execution session evaluation returned HTTP {response.status_code}.",
                retryable=response.status_code >= 500,
            )
        try:
            result = response.json()
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise TaskExecutionSessionError(
                "INVALID_SESSION_RESPONSE",
                "Execution session evaluation returned invalid JSON.",
            ) from error
        expected_fields = {"schema", "sessionId", "complete"}
        if (
            not isinstance(result, Mapping)
            or set(result) != expected_fields
            or result.get("schema") != TASK_EXECUTION_EVALUATION_SCHEMA
            or result.get("sessionId") != self._session_id
            or not isinstance(result.get("complete"), bool)
        ):
            raise TaskExecutionSessionError(
                "INVALID_SESSION_RESPONSE",
                "Execution session evaluation response is invalid.",
            )
        return bool(result["complete"])

    def _parse_event(self, data: str, expected_sequence: int) -> TaskExecutionSessionEvent:
        """Validate one exact event record and convert it to a typed value."""

        if len(data.encode("utf-8")) > MAX_SESSION_EVENT_BYTES:
            raise TaskExecutionSessionError(
                "SESSION_EVENT_TOO_LARGE",
                "Execution session event exceeds the payload budget.",
            )
        try:
            value = json.loads(data)
        except json.JSONDecodeError as error:
            raise TaskExecutionSessionError(
                "INVALID_SESSION_EVENT",
                "Execution session event is not valid JSON.",
            ) from error
        if not isinstance(value, Mapping):
            raise TaskExecutionSessionError(
                "INVALID_SESSION_EVENT",
                "Execution session event must be an object.",
            )
        base_fields = {"schema", "sessionId", "sequence", "type"}
        if (
            value.get("schema") != TASK_EXECUTION_EVENT_SCHEMA
            or value.get("sessionId") != self._session_id
            or value.get("sequence") != expected_sequence
        ):
            raise TaskExecutionSessionError(
                "INVALID_SESSION_EVENT",
                "Execution session event correlation is invalid.",
            )
        event_type = str(value.get("type") or "")
        if event_type == "text_delta" and set(value) == base_fields | {"text"}:
            text = value.get("text")
            if isinstance(text, str) and len(text) <= MAX_SESSION_TEXT_DELTA:
                return TaskExecutionSessionEvent(expected_sequence, event_type, text=text)
        elif event_type == "tool_event" and set(value) == base_fields | {
            "toolType", "title", "content",
        }:
            tool_type = value.get("toolType")
            title = value.get("title")
            content = value.get("content")
            if all(isinstance(item, str) for item in (tool_type, title, content)):
                return TaskExecutionSessionEvent(
                    expected_sequence,
                    event_type,
                    tool_type=tool_type[:64],
                    title=title[:512],
                    content=content[:65_536],
                )
        elif event_type == "error" and set(value) == base_fields | {
            "code", "message", "retryable",
        }:
            code = value.get("code")
            message = value.get("message")
            retryable = value.get("retryable")
            if isinstance(code, str) and isinstance(message, str) and isinstance(retryable, bool):
                return TaskExecutionSessionEvent(
                    expected_sequence,
                    event_type,
                    code=code[:128],
                    message=message[:1024],
                    retryable=retryable,
                )
        elif event_type == "done" and set(value) == base_fields:
            return TaskExecutionSessionEvent(expected_sequence, event_type)
        raise TaskExecutionSessionError(
            "INVALID_SESSION_EVENT",
            "Execution session event fields are invalid.",
        )

    def _headers(self) -> dict[str, str]:
        """Return no-cache UTF-8 headers with an optional process-scoped token."""

        headers = {
            "Content-Type": "application/json; charset=utf-8",
            "Accept": "text/event-stream, application/json",
            "Cache-Control": "no-store",
        }
        if self._token:
            headers["Authorization"] = f"Bearer {self._token}"
        return headers

    def _normalize_backend_origin(self, value: str) -> str:
        """Validate and return one exact loopback HTTP backend origin."""

        origin = str(value or "").strip().rstrip("/")
        parsed = urlparse(origin)
        if (
            parsed.scheme != "http"
            or parsed.hostname not in {"127.0.0.1", "localhost", "::1"}
            or parsed.port is None
            or parsed.username is not None
            or parsed.password is not None
            or parsed.path not in {"", "/"}
            or parsed.query
            or parsed.fragment
        ):
            raise TaskExecutionSessionError(
                "INVALID_BACKEND_ORIGIN",
                "Execution session backend origin must be exact loopback HTTP.",
            )
        return origin

    def _bounded_text(self, value: Any, maximum_length: int) -> str:
        """Normalize one required text field to its broker request limit."""

        text = str(value or "").strip()
        if not text:
            raise TaskExecutionSessionError(
                "INVALID_SESSION_REQUEST",
                "Execution session evaluation text is required.",
            )
        return text[:maximum_length]
