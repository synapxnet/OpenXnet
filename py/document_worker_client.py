# -*- coding: utf-8 -*-
"""Legacy-backend adapter for authenticated Desktop Core Document Worker RPC."""

from __future__ import annotations

import asyncio
from collections.abc import Mapping
import json
import os
from pathlib import Path
import tempfile
from typing import Any
from urllib import error as urllib_error
from urllib import request as urllib_request

from py.worker_capability_contracts import SUPPORTED_DOCUMENT_FORMATS


DEFAULT_MAX_RESULT_BYTES = 32 * 1024 * 1024


class DocumentWorkerClientError(RuntimeError):
    """Structured Document Worker failure returned to legacy file loaders."""

    def __init__(self, code: str, message: str, retryable: bool = False) -> None:
        """Create a client error from a Worker RPC response."""

        super().__init__(message)
        self.code = code
        self.retryable = retryable


class DocumentWorkerClient:
    """Exchange document bytes and extracted UTF-8 text through private artifacts."""

    def __init__(
        self,
        origin: str,
        token: str,
        exchange_root: Path,
        *,
        timeout_seconds: float = 125.0,
        max_result_bytes: int = DEFAULT_MAX_RESULT_BYTES,
    ) -> None:
        """Create a client from Electron-provided loopback configuration."""

        self._origin = origin.rstrip("/")
        self._token = token
        self._exchange_root = exchange_root.resolve()
        self._timeout_seconds = timeout_seconds
        self._max_result_bytes = max_result_bytes

    @classmethod
    def from_environment(cls) -> "DocumentWorkerClient":
        """Construct a client from the environment inherited by the legacy backend."""

        origin = os.environ.get("OPENXNET_WORKER_RPC_ORIGIN", "").strip()
        token = os.environ.get("OPENXNET_WORKER_RPC_TOKEN", "").strip()
        exchange_value = os.environ.get("OPENXNET_DOCUMENT_EXCHANGE_DIR", "").strip()
        if not exchange_value:
            user_data = os.environ.get("OPENXNET_USER_DATA_DIR", "").strip()
            exchange_value = (
                str(Path(user_data) / "runtime" / "document-exchange") if user_data else ""
            )
        default_root = Path(tempfile.gettempdir()) / "openxnet-document-exchange"
        return cls(origin, token, Path(exchange_value) if exchange_value else default_root)

    @property
    def configured(self) -> bool:
        """Return whether Electron supplied both a loopback origin and bearer token."""

        return bool(self._origin and self._token)

    async def extract(self, content: bytes, document_format: str) -> str:
        """Extract one document and always remove its input and result artifacts."""

        self._require_configuration()
        normalized_format = self._normalize_format(document_format)
        if not content:
            raise DocumentWorkerClientError("INVALID_DOCUMENT", "Document data is empty.", False)
        input_path = await asyncio.to_thread(
            self._write_artifact,
            content,
            "document-input-",
            f".{normalized_format}",
        )
        result_path = await asyncio.to_thread(
            self._write_artifact,
            b"",
            "document-result-",
            ".txt",
        )
        try:
            response = await asyncio.to_thread(
                self._request_sync,
                "documents.extract",
                {
                    "artifactPath": str(input_path),
                    "resultArtifactPath": str(result_path),
                    "format": normalized_format,
                },
            )
            return await asyncio.to_thread(self._read_result, response, result_path)
        finally:
            await asyncio.gather(
                asyncio.to_thread(input_path.unlink, missing_ok=True),
                asyncio.to_thread(result_path.unlink, missing_ok=True),
            )

    async def status(self) -> Mapping[str, Any]:
        """Request lightweight parser availability from Document Worker."""

        self._require_configuration()
        return await asyncio.to_thread(self._request_sync, "documents.status", {})

    def _require_configuration(self) -> None:
        """Raise a stable retryable failure when Electron RPC is unavailable."""

        if not self.configured:
            raise DocumentWorkerClientError(
                "DOCUMENT_WORKER_UNAVAILABLE",
                "Document Worker RPC is not configured for this backend process.",
                True,
            )

    def _normalize_format(self, value: str) -> str:
        """Normalize and validate one document format before creating artifacts."""

        if not isinstance(value, str) or not value.strip():
            raise DocumentWorkerClientError(
                "INVALID_DOCUMENT_FORMAT",
                "Document format must be non-empty text.",
                False,
            )
        normalized = value.strip().lower().lstrip(".")
        if normalized not in SUPPORTED_DOCUMENT_FORMATS:
            raise DocumentWorkerClientError(
                "INVALID_DOCUMENT_FORMAT",
                f"Unsupported document format '{normalized}'.",
                False,
            )
        return normalized

    def _write_artifact(self, content: bytes, prefix: str, suffix: str) -> Path:
        """Create one private binary artifact inside the configured exchange root."""

        self._exchange_root.mkdir(parents=True, exist_ok=True)
        descriptor, file_name = tempfile.mkstemp(
            prefix=prefix,
            suffix=suffix,
            dir=self._exchange_root,
        )
        try:
            with os.fdopen(descriptor, "wb") as artifact_file:
                artifact_file.write(content)
                artifact_file.flush()
            artifact_path = Path(file_name)
            artifact_path.chmod(0o600)
            return artifact_path
        except Exception:
            try:
                os.close(descriptor)
            except OSError:
                pass
            Path(file_name).unlink(missing_ok=True)
            raise

    def _read_result(self, response: Mapping[str, Any], result_path: Path) -> str:
        """Validate RPC metadata and decode one bounded UTF-8 result artifact."""

        response_path = response.get("resultArtifactPath")
        result_bytes = response.get("resultBytes")
        if response_path != str(result_path) or not isinstance(result_bytes, int):
            raise DocumentWorkerClientError(
                "INVALID_WORKER_RESPONSE",
                "Document Worker result metadata is invalid.",
                False,
            )
        actual_bytes = result_path.stat().st_size
        if actual_bytes != result_bytes or actual_bytes > self._max_result_bytes:
            raise DocumentWorkerClientError(
                "INVALID_WORKER_RESPONSE",
                "Document Worker result artifact size does not match its response.",
                False,
            )
        return result_path.read_text(encoding="utf-8")

    def _request_sync(
        self,
        method: str,
        payload: Mapping[str, Any],
    ) -> Mapping[str, Any]:
        """Perform one blocking Document Worker request for execution in a thread."""

        body = json.dumps(
            {"capability": "documents", "method": method, "payload": dict(payload)},
            ensure_ascii=False,
        ).encode("utf-8")
        request = urllib_request.Request(
            f"{self._origin}/v1/workers/request",
            data=body,
            headers={
                "Authorization": f"Bearer {self._token}",
                "Content-Type": "application/json; charset=utf-8",
            },
            method="POST",
        )
        try:
            with urllib_request.urlopen(request, timeout=self._timeout_seconds) as response:
                response_payload = json.loads(response.read().decode("utf-8"))
        except urllib_error.HTTPError as error:
            self._raise_http_error(error)
        except (OSError, urllib_error.URLError) as error:
            raise DocumentWorkerClientError(
                "DOCUMENT_WORKER_UNAVAILABLE",
                f"Document Worker RPC connection failed: {error}",
                True,
            ) from error

        if not isinstance(response_payload, dict) or response_payload.get("ok") is not True:
            raise DocumentWorkerClientError(
                "INVALID_WORKER_RESPONSE",
                "Document Worker RPC returned an invalid success envelope.",
                False,
            )
        result = response_payload.get("payload")
        if not isinstance(result, dict):
            raise DocumentWorkerClientError(
                "INVALID_WORKER_RESPONSE",
                "Document Worker RPC payload must be an object.",
                False,
            )
        return result

    def _raise_http_error(self, error: urllib_error.HTTPError) -> None:
        """Decode a structured Worker RPC HTTP error and raise a client exception."""

        try:
            payload = json.loads(error.read().decode("utf-8"))
            error_payload = payload.get("error", {}) if isinstance(payload, dict) else {}
            code = str(error_payload.get("code", "DOCUMENT_WORKER_FAILED"))
            message = str(error_payload.get("message", error.reason))
            retryable = bool(error_payload.get("retryable", error.code >= 500))
        except (json.JSONDecodeError, UnicodeDecodeError, AttributeError):
            code = "DOCUMENT_WORKER_FAILED"
            message = str(error.reason)
            retryable = error.code >= 500
        raise DocumentWorkerClientError(code, message, retryable) from error


async def extract_office_document(content: bytes, document_format: str) -> str:
    """Use a fresh environment-derived client for one legacy office document."""

    return await DocumentWorkerClient.from_environment().extract(content, document_format)
