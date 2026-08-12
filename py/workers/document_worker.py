# -*- coding: utf-8 -*-
"""OpenXnet Document Worker serving office text extraction through artifacts."""

from __future__ import annotations

import argparse
import asyncio
from collections.abc import Mapping
import importlib.util
import os
from pathlib import Path
import tempfile
from typing import Any

from py.workers.document_engine import (
    DEFAULT_MAX_OUTPUT_BYTES,
    DocumentEngine,
    PORTABLE_DOCUMENT_FORMATS,
    SUPPORTED_DOCUMENT_FORMATS,
    WINDOWS_DOCUMENT_FORMATS,
)
from py.workers.runtime import WorkerRuntime


DEFAULT_MAX_DOCUMENT_BYTES = 64 * 1024 * 1024


class DocumentWorkerHandlers:
    """Validate artifact requests and delegate extraction to DocumentEngine."""

    def __init__(
        self,
        exchange_root: Path,
        *,
        engine: DocumentEngine | None = None,
        max_document_bytes: int = DEFAULT_MAX_DOCUMENT_BYTES,
        max_output_bytes: int = DEFAULT_MAX_OUTPUT_BYTES,
    ) -> None:
        """Create handlers restricted to one application-owned exchange directory."""

        self._exchange_root = exchange_root.resolve()
        self._exchange_root.mkdir(parents=True, exist_ok=True)
        self._engine = engine or DocumentEngine(max_output_bytes=max_output_bytes)
        self._max_document_bytes = max_document_bytes
        self._max_output_bytes = max_output_bytes

    def status(self, _payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Report format availability without importing any document parser."""

        dependencies = {
            "pdf": importlib.util.find_spec("pypdf") is not None,
            "docx": importlib.util.find_spec("docx") is not None,
            "xlsx": importlib.util.find_spec("openpyxl") is not None,
            "xls": importlib.util.find_spec("xlrd") is not None,
            "rtf": importlib.util.find_spec("striprtf") is not None,
            "odt": importlib.util.find_spec("odf") is not None,
            "pptx": importlib.util.find_spec("pptx") is not None,
            "epub": True,
            "doc": sys_platform_is_windows(),
            "ppt": sys_platform_is_windows(),
        }
        return {
            "supportedFormats": list(SUPPORTED_DOCUMENT_FORMATS),
            "availableFormats": [name for name, available in dependencies.items() if available],
            "dependencies": dependencies,
        }

    async def extract(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Extract one bounded document artifact into a pre-created UTF-8 result file."""

        document_format = self._read_format(payload.get("format"))
        artifact_path = self._resolve_input_artifact(payload.get("artifactPath"))
        result_path = self._resolve_result_artifact(payload.get("resultArtifactPath"))
        text = await asyncio.to_thread(self._engine.extract, artifact_path, document_format)
        output = text.encode("utf-8")
        if len(output) > self._max_output_bytes:
            raise ValueError("Extracted document text exceeds the output size limit.")
        result_path.write_bytes(output)
        return {
            "resultArtifactPath": str(result_path),
            "format": document_format,
            "artifactBytes": artifact_path.stat().st_size,
            "resultBytes": len(output),
            "characters": len(text),
        }

    def _resolve_input_artifact(self, value: Any) -> Path:
        """Resolve one bounded regular input artifact below the exchange root."""

        artifact_path = self._resolve_exchange_path(value, "artifactPath")
        if not artifact_path.is_file():
            raise FileNotFoundError(f"Document artifact does not exist: {artifact_path}")
        artifact_size = artifact_path.stat().st_size
        if artifact_size <= 0 or artifact_size > self._max_document_bytes:
            raise ValueError(
                f"Document artifact size must be between 1 and {self._max_document_bytes} bytes."
            )
        return artifact_path

    def _resolve_result_artifact(self, value: Any) -> Path:
        """Resolve one pre-created regular result artifact below the exchange root."""

        result_path = self._resolve_exchange_path(value, "resultArtifactPath")
        if not result_path.is_file():
            raise FileNotFoundError(f"Document result artifact does not exist: {result_path}")
        return result_path

    def _resolve_exchange_path(self, value: Any, field_name: str) -> Path:
        """Resolve one artifact and reject paths escaping the exchange root."""

        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"Document request field '{field_name}' must be non-empty text.")
        path = Path(value).resolve()
        try:
            path.relative_to(self._exchange_root)
        except ValueError as error:
            raise ValueError(f"Document {field_name} is outside the exchange root.") from error
        return path

    def _read_format(self, value: Any) -> str:
        """Normalize one allow-listed document format."""

        if not isinstance(value, str) or not value.strip():
            raise ValueError("Document request field 'format' must be non-empty text.")
        document_format = value.strip().lower().lstrip(".")
        allowed_formats = set(PORTABLE_DOCUMENT_FORMATS)
        if sys_platform_is_windows():
            allowed_formats.update(WINDOWS_DOCUMENT_FORMATS)
        if document_format not in allowed_formats:
            raise ValueError(f"Unsupported document format '{document_format}'.")
        return document_format


def sys_platform_is_windows() -> bool:
    """Return whether legacy Office COM formats can run on this platform."""

    return os.name == "nt"


def resolve_default_exchange_root() -> Path:
    """Resolve the artifact exchange directory shared with the legacy backend."""

    configured = os.environ.get("OPENXNET_DOCUMENT_EXCHANGE_DIR", "").strip()
    if configured:
        return Path(configured)
    user_data = os.environ.get("OPENXNET_USER_DATA_DIR", "").strip()
    if user_data:
        return Path(user_data) / "runtime" / "document-exchange"
    return Path(tempfile.gettempdir()) / "openxnet-document-exchange"


def parse_arguments() -> argparse.Namespace:
    """Parse standalone Worker exchange and size-limit options."""

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--exchange-root", type=Path, default=resolve_default_exchange_root())
    parser.add_argument("--max-document-bytes", type=int, default=DEFAULT_MAX_DOCUMENT_BYTES)
    parser.add_argument("--max-output-bytes", type=int, default=DEFAULT_MAX_OUTPUT_BYTES)
    return parser.parse_args()


async def run() -> None:
    """Create Document Worker handlers and serve NDJSON requests on stdio."""

    arguments = parse_arguments()
    handlers = DocumentWorkerHandlers(
        arguments.exchange_root,
        max_document_bytes=arguments.max_document_bytes,
        max_output_bytes=arguments.max_output_bytes,
    )
    runtime = WorkerRuntime("documents")
    runtime.register_handler("documents.status", handlers.status)
    runtime.register_handler("documents.extract", handlers.extract)
    await runtime.serve_stdio()


if __name__ == "__main__":
    asyncio.run(run())
