# -*- coding: utf-8 -*-
"""Minimal dispatch runtime shared by future OpenXnet capability workers."""

from __future__ import annotations

from collections.abc import Awaitable, Callable, Mapping
import asyncio
import inspect
import sys
from typing import Any, TextIO, TypeAlias

from .protocol import WorkerEnvelope, WorkerMessageKind, WorkerProtocolError


WorkerHandler: TypeAlias = Callable[
    [Mapping[str, Any]],
    Awaitable[Mapping[str, Any]] | Mapping[str, Any],
]


class WorkerRuntime:
    """Dispatch validated protocol requests to explicitly registered handlers."""

    def __init__(self, capability: str, *, output: TextIO | None = None) -> None:
        """Create a runtime dedicated to one named capability."""

        if not capability.strip():
            raise ValueError("Worker capability must be non-empty text.")
        self._capability = capability.strip()
        self._handlers: dict[str, WorkerHandler] = {}
        self._shutdown_requested = False
        self._output = output or sys.stdout
        self._output_lock = asyncio.Lock()

    def register_handler(self, method: str, handler: WorkerHandler) -> None:
        """Register one unique method handler without executing worker dependencies."""

        normalized_method = method.strip()
        if not normalized_method:
            raise ValueError("Worker method must be non-empty text.")
        if normalized_method in self._handlers:
            raise ValueError(f"Worker method '{normalized_method}' is already registered.")
        self._handlers[normalized_method] = handler

    async def dispatch(self, request: WorkerEnvelope) -> WorkerEnvelope:
        """Dispatch a request and convert handler failures into protocol errors."""

        validation_error = self._validate_request(request)
        if validation_error is not None:
            return WorkerEnvelope.failure(request, validation_error)

        if request.method == "system.ping":
            return WorkerEnvelope.response(
                request,
                {"status": "ready", "capability": self._capability},
            )
        if request.method == "system.shutdown":
            self._shutdown_requested = True
            return WorkerEnvelope.response(request, {"status": "stopping"})

        handler = self._handlers.get(request.method)
        if handler is None:
            return WorkerEnvelope.failure(
                request,
                WorkerProtocolError(
                    code="METHOD_NOT_FOUND",
                    message=f"Worker method '{request.method}' is not registered.",
                    retryable=False,
                ),
            )

        try:
            result = handler(request.payload)
            if inspect.isawaitable(result):
                result = await result
            if not isinstance(result, Mapping):
                raise TypeError("Worker handlers must return a mapping.")
            return WorkerEnvelope.response(request, result)
        except Exception as error:
            return WorkerEnvelope.failure(
                request,
                WorkerProtocolError(
                    code="HANDLER_FAILED",
                    message=str(error) or error.__class__.__name__,
                    retryable=False,
                ),
            )

    async def serve_stdio(self) -> None:
        """Serve protocol messages on stdin/stdout until shutdown or end-of-stream."""

        while not self._shutdown_requested:
            line = await asyncio.to_thread(sys.stdin.readline)
            if not line:
                break
            try:
                request = WorkerEnvelope.from_json_line(line)
                response = await self.dispatch(request)
            except Exception as error:
                print(f"Invalid worker request: {error}", file=sys.stderr, flush=True)
                continue
            await self._write_envelope(response)

    async def emit_event(
        self,
        method: str,
        payload: Mapping[str, Any] | None = None,
        *,
        trace_id: str | None = None,
    ) -> None:
        """Write one versioned event without consuming request correlation."""

        await self._write_envelope(
            WorkerEnvelope.event(
                self._capability,
                method,
                payload,
                trace_id=trace_id,
            )
        )

    async def _write_envelope(self, envelope: WorkerEnvelope) -> None:
        """Serialize output writes so background events cannot interleave responses."""

        async with self._output_lock:
            self._output.write(envelope.to_json_line())
            self._output.flush()

    def _validate_request(self, request: WorkerEnvelope) -> WorkerProtocolError | None:
        """Validate that a message can be handled by this worker runtime."""

        if request.kind is not WorkerMessageKind.REQUEST:
            return WorkerProtocolError(
                code="INVALID_MESSAGE_KIND",
                message="Worker runtime accepts request messages only.",
                retryable=False,
            )
        if request.capability != self._capability:
            return WorkerProtocolError(
                code="CAPABILITY_MISMATCH",
                message=(
                    f"Worker handles '{self._capability}', not "
                    f"'{request.capability}'."
                ),
                retryable=False,
            )
        return None
