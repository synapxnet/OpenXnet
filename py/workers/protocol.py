# -*- coding: utf-8 -*-
"""Versioned newline-delimited JSON protocol for capability workers."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
import json
from typing import Any, Mapping
from uuid import uuid4


WORKER_PROTOCOL_VERSION = "1.0"


class WorkerMessageKind(StrEnum):
    """Kinds of messages exchanged between Desktop Core and a worker."""

    REQUEST = "request"
    RESPONSE = "response"
    EVENT = "event"
    ERROR = "error"


@dataclass(frozen=True, slots=True)
class WorkerProtocolError:
    """Serializable error returned by a worker without leaking exceptions."""

    code: str
    message: str
    retryable: bool = False
    details: Mapping[str, Any] = field(default_factory=dict)

    def to_mapping(self) -> dict[str, Any]:
        """Return a JSON-serializable defensive copy of the error."""

        return {
            "code": self.code,
            "message": self.message,
            "retryable": self.retryable,
            "details": dict(self.details),
        }

    @classmethod
    def from_mapping(cls, value: Mapping[str, Any]) -> "WorkerProtocolError":
        """Validate and construct a protocol error from decoded JSON."""

        return cls(
            code=_require_text(value, "code"),
            message=_require_text(value, "message"),
            retryable=bool(value.get("retryable", False)),
            details=_optional_mapping(value.get("details"), "details"),
        )


@dataclass(frozen=True, slots=True)
class WorkerEnvelope:
    """One versioned message carried over a worker protocol stream."""

    protocol_version: str
    message_id: str
    trace_id: str
    kind: WorkerMessageKind
    capability: str
    method: str
    payload: Mapping[str, Any] = field(default_factory=dict)
    error: WorkerProtocolError | None = None

    @classmethod
    def request(
        cls,
        capability: str,
        method: str,
        payload: Mapping[str, Any] | None = None,
        *,
        message_id: str | None = None,
        trace_id: str | None = None,
    ) -> "WorkerEnvelope":
        """Create a request with generated correlation identifiers."""

        resolved_message_id = message_id or str(uuid4())
        return cls(
            protocol_version=WORKER_PROTOCOL_VERSION,
            message_id=resolved_message_id,
            trace_id=trace_id or resolved_message_id,
            kind=WorkerMessageKind.REQUEST,
            capability=_validate_nonempty_text(capability, "capability"),
            method=_validate_nonempty_text(method, "method"),
            payload=dict(payload or {}),
        )

    @classmethod
    def response(
        cls,
        request: "WorkerEnvelope",
        payload: Mapping[str, Any] | None = None,
    ) -> "WorkerEnvelope":
        """Create a successful response correlated to a request."""

        return cls(
            protocol_version=WORKER_PROTOCOL_VERSION,
            message_id=request.message_id,
            trace_id=request.trace_id,
            kind=WorkerMessageKind.RESPONSE,
            capability=request.capability,
            method=request.method,
            payload=dict(payload or {}),
        )

    @classmethod
    def event(
        cls,
        capability: str,
        method: str,
        payload: Mapping[str, Any] | None = None,
        *,
        trace_id: str | None = None,
    ) -> "WorkerEnvelope":
        """Create an uncorrelated worker event with generated identifiers."""

        message_id = str(uuid4())
        return cls(
            protocol_version=WORKER_PROTOCOL_VERSION,
            message_id=message_id,
            trace_id=trace_id or message_id,
            kind=WorkerMessageKind.EVENT,
            capability=_validate_nonempty_text(capability, "capability"),
            method=_validate_nonempty_text(method, "method"),
            payload=dict(payload or {}),
        )

    @classmethod
    def failure(
        cls,
        request: "WorkerEnvelope",
        error: WorkerProtocolError,
    ) -> "WorkerEnvelope":
        """Create a structured error response correlated to a request."""

        return cls(
            protocol_version=WORKER_PROTOCOL_VERSION,
            message_id=request.message_id,
            trace_id=request.trace_id,
            kind=WorkerMessageKind.ERROR,
            capability=request.capability,
            method=request.method,
            payload={},
            error=error,
        )

    @classmethod
    def from_mapping(cls, value: Mapping[str, Any]) -> "WorkerEnvelope":
        """Validate and construct an envelope from decoded JSON."""

        protocol_version = _require_text(value, "protocolVersion")
        if protocol_version != WORKER_PROTOCOL_VERSION:
            raise ValueError(
                f"Unsupported worker protocol version '{protocol_version}'; "
                f"expected '{WORKER_PROTOCOL_VERSION}'."
            )

        kind_value = _require_text(value, "kind")
        try:
            kind = WorkerMessageKind(kind_value)
        except ValueError as error:
            raise ValueError(f"Unsupported worker message kind '{kind_value}'.") from error

        raw_error = value.get("error")
        parsed_error = None
        if raw_error is not None:
            if not isinstance(raw_error, Mapping):
                raise ValueError("Worker envelope field 'error' must be an object.")
            parsed_error = WorkerProtocolError.from_mapping(raw_error)
        if kind is WorkerMessageKind.ERROR and parsed_error is None:
            raise ValueError("Worker error envelopes require an error object.")

        return cls(
            protocol_version=protocol_version,
            message_id=_require_text(value, "messageId"),
            trace_id=_require_text(value, "traceId"),
            kind=kind,
            capability=_require_text(value, "capability"),
            method=_require_text(value, "method"),
            payload=_optional_mapping(value.get("payload"), "payload"),
            error=parsed_error,
        )

    @classmethod
    def from_json_line(cls, line: str) -> "WorkerEnvelope":
        """Decode one UTF-8 JSON line into a validated worker envelope."""

        try:
            value = json.loads(line)
        except json.JSONDecodeError as error:
            raise ValueError(f"Invalid worker JSON: {error.msg}.") from error
        if not isinstance(value, Mapping):
            raise ValueError("Worker protocol messages must be JSON objects.")
        return cls.from_mapping(value)

    def to_mapping(self) -> dict[str, Any]:
        """Return the camel-case wire representation of this envelope."""

        value: dict[str, Any] = {
            "protocolVersion": self.protocol_version,
            "messageId": self.message_id,
            "traceId": self.trace_id,
            "kind": self.kind.value,
            "capability": self.capability,
            "method": self.method,
            "payload": dict(self.payload),
        }
        if self.error is not None:
            value["error"] = self.error.to_mapping()
        return value

    def to_json_line(self) -> str:
        """Serialize the envelope as one compact UTF-8 JSON protocol line."""

        return json.dumps(
            self.to_mapping(),
            ensure_ascii=True,
            separators=(",", ":"),
        ) + "\n"


def _require_text(value: Mapping[str, Any], field_name: str) -> str:
    """Read and validate a required non-empty text field from a mapping."""

    return _validate_nonempty_text(value.get(field_name), field_name)


def _validate_nonempty_text(value: Any, field_name: str) -> str:
    """Validate an unknown value as stripped non-empty text."""

    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"Worker envelope field '{field_name}' must be non-empty text.")
    return value.strip()


def _optional_mapping(value: Any, field_name: str) -> dict[str, Any]:
    """Validate an optional mapping field and return a defensive dictionary."""

    if value is None:
        return {}
    if not isinstance(value, Mapping):
        raise ValueError(f"Worker envelope field '{field_name}' must be an object.")
    return dict(value)
