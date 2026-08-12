# -*- coding: utf-8 -*-
"""Legacy-backend adapter for authenticated Desktop Core Vector Worker RPC."""

from __future__ import annotations

from array import array
import asyncio
from collections.abc import Mapping, Sequence
import json
import math
import os
from pathlib import Path
import tempfile
import sys
from typing import Any
from urllib import error as urllib_error
from urllib import request as urllib_request


class VectorWorkerClientError(RuntimeError):
    """Structured Vector Worker failure returned to legacy callers."""

    def __init__(self, code: str, message: str, retryable: bool = False) -> None:
        """Create a client error from a Worker RPC response."""

        super().__init__(message)
        self.code = code
        self.retryable = retryable


class VectorWorkerClient:
    """Exchange bulk vector data through private artifacts and small RPC controls."""

    def __init__(
        self,
        origin: str,
        token: str,
        exchange_root: Path,
        *,
        timeout_seconds: float = 125.0,
    ) -> None:
        """Create a client from Electron-provided loopback configuration."""

        self._origin = origin.rstrip("/")
        self._token = token
        self._exchange_root = exchange_root.resolve()
        self._timeout_seconds = timeout_seconds

    @classmethod
    def from_environment(cls) -> "VectorWorkerClient":
        """Construct a client from the environment inherited by the legacy backend."""

        origin = os.environ.get("OPENXNET_WORKER_RPC_ORIGIN", "").strip()
        token = os.environ.get("OPENXNET_WORKER_RPC_TOKEN", "").strip()
        exchange_value = os.environ.get("OPENXNET_VECTOR_EXCHANGE_DIR", "").strip()
        if not exchange_value:
            user_data = os.environ.get("OPENXNET_USER_DATA_DIR", "").strip()
            exchange_value = (
                str(Path(user_data) / "runtime" / "vector-exchange")
                if user_data
                else ""
            )
        default_root = Path(tempfile.gettempdir()) / "openxnet-vector-exchange"
        return cls(origin, token, Path(exchange_value) if exchange_value else default_root)

    @property
    def configured(self) -> bool:
        """Return whether Electron supplied both a loopback origin and bearer token."""

        return bool(self._origin and self._token)

    async def status(self) -> Mapping[str, Any]:
        """Request lightweight dependency, model, and index status."""

        self._require_configuration()
        return await asyncio.to_thread(self._request_sync, "vector.status", {})

    async def embed(self, texts: Sequence[str]) -> Mapping[str, Any]:
        """Embed text through request and result artifacts outside the JSON protocol."""

        self._require_configuration()
        request_path = await asyncio.to_thread(
            self._write_json_artifact,
            {"texts": list(texts)},
            "vector-embed-request-",
        )
        result_path = await asyncio.to_thread(
            self._write_json_artifact,
            {},
            "vector-embed-result-",
        )
        try:
            response = await asyncio.to_thread(
                self._request_sync,
                "vector.embed",
                {
                    "artifactPath": str(request_path),
                    "resultArtifactPath": str(result_path),
                },
            )
            result = await asyncio.to_thread(self._read_json_artifact, result_path)
            self._validate_embedding_result(response, result)
            return result
        finally:
            await asyncio.gather(
                asyncio.to_thread(request_path.unlink, missing_ok=True),
                asyncio.to_thread(result_path.unlink, missing_ok=True),
            )

    async def rebuild(self, items: Sequence[Mapping[str, str]]) -> Mapping[str, Any]:
        """Replace the ephemeral worker index from one bounded item artifact."""

        self._require_configuration()
        artifact_path = await asyncio.to_thread(
            self._write_json_artifact,
            {"items": [dict(item) for item in items]},
            "vector-rebuild-",
        )
        try:
            return await asyncio.to_thread(
                self._request_sync,
                "vector.rebuild",
                {"artifactPath": str(artifact_path)},
            )
        finally:
            await asyncio.to_thread(artifact_path.unlink, missing_ok=True)

    async def add(self, item_id: str, text: str) -> Mapping[str, Any]:
        """Append one small item to an existing worker index."""

        self._require_configuration()
        return await asyncio.to_thread(
            self._request_sync,
            "vector.add",
            {"id": item_id, "text": text},
        )

    async def search(self, query: str, top_k: int = 5) -> Mapping[str, Any]:
        """Search the worker index and return its structured result payload."""

        self._require_configuration()
        return await asyncio.to_thread(
            self._request_sync,
            "vector.search",
            {"query": query, "topK": top_k},
        )

    async def release(self) -> Mapping[str, Any]:
        """Release model and index state held by the worker process."""

        self._require_configuration()
        return await asyncio.to_thread(self._request_sync, "vector.release", {})

    async def persistent_build(
        self,
        index_path: Path,
        vectors: Sequence[Sequence[float]],
        *,
        distance: str = "euclidean",
        normalize_l2: bool = False,
    ) -> Mapping[str, Any]:
        """Build one persistent index without blocking the caller's event loop."""

        return await asyncio.to_thread(
            self.persistent_build_sync,
            index_path,
            vectors,
            distance=distance,
            normalize_l2=normalize_l2,
        )

    def persistent_build_sync(
        self,
        index_path: Path,
        vectors: Sequence[Sequence[float]],
        *,
        distance: str = "euclidean",
        normalize_l2: bool = False,
    ) -> Mapping[str, Any]:
        """Build one persistent index through a float32 artifact and Worker RPC."""

        return self._request_vectors_sync(
            "vector.store.build",
            index_path,
            vectors,
            {"distance": distance, "normalizeL2": normalize_l2},
        )

    async def persistent_append(
        self,
        index_path: Path,
        vectors: Sequence[Sequence[float]],
        *,
        distance: str = "euclidean",
        normalize_l2: bool = False,
    ) -> Mapping[str, Any]:
        """Append vectors to one persistent index without blocking the event loop."""

        return await asyncio.to_thread(
            self.persistent_append_sync,
            index_path,
            vectors,
            distance=distance,
            normalize_l2=normalize_l2,
        )

    def persistent_append_sync(
        self,
        index_path: Path,
        vectors: Sequence[Sequence[float]],
        *,
        distance: str = "euclidean",
        normalize_l2: bool = False,
    ) -> Mapping[str, Any]:
        """Append vectors through a float32 artifact and Worker RPC."""

        return self._request_vectors_sync(
            "vector.store.append",
            index_path,
            vectors,
            {"distance": distance, "normalizeL2": normalize_l2},
        )

    async def persistent_search(
        self,
        index_path: Path,
        vectors: Sequence[Sequence[float]],
        *,
        top_k: int,
        normalize_l2: bool = False,
    ) -> Mapping[str, Any]:
        """Search one persistent index without blocking the caller's event loop."""

        return await asyncio.to_thread(
            self.persistent_search_sync,
            index_path,
            vectors,
            top_k=top_k,
            normalize_l2=normalize_l2,
        )

    def persistent_search_sync(
        self,
        index_path: Path,
        vectors: Sequence[Sequence[float]],
        *,
        top_k: int,
        normalize_l2: bool = False,
    ) -> Mapping[str, Any]:
        """Search one persistent index through a float32 artifact and Worker RPC."""

        return self._request_vectors_sync(
            "vector.store.search",
            index_path,
            vectors,
            {"topK": top_k, "normalizeL2": normalize_l2},
        )

    async def persistent_delete_position(
        self,
        index_path: Path,
        position: int,
        *,
        expected_count: int | None = None,
    ) -> Mapping[str, Any]:
        """Delete one persistent row without blocking the caller's event loop."""

        return await asyncio.to_thread(
            self.persistent_delete_position_sync,
            index_path,
            position,
            expected_count=expected_count,
        )

    def persistent_delete_position_sync(
        self,
        index_path: Path,
        position: int,
        *,
        expected_count: int | None = None,
    ) -> Mapping[str, Any]:
        """Delete one persistent row by its stable pre-delete position."""

        self._require_configuration()
        payload: dict[str, Any] = {
            "indexPath": str(index_path.resolve()),
            "position": position,
        }
        if expected_count is not None:
            payload["expectedCount"] = expected_count
        return self._request_sync("vector.store.delete-position", payload)

    async def persistent_inspect(self, index_path: Path) -> Mapping[str, Any]:
        """Inspect one persistent index without blocking the caller's event loop."""

        return await asyncio.to_thread(self.persistent_inspect_sync, index_path)

    def persistent_inspect_sync(self, index_path: Path) -> Mapping[str, Any]:
        """Inspect one persistent index through a small Worker RPC request."""

        self._require_configuration()
        return self._request_sync(
            "vector.store.inspect",
            {"indexPath": str(index_path.resolve())},
        )

    async def persistent_delete(self, index_path: Path) -> Mapping[str, Any]:
        """Delete one persistent index without blocking the caller's event loop."""

        return await asyncio.to_thread(self.persistent_delete_sync, index_path)

    def persistent_delete_sync(self, index_path: Path) -> Mapping[str, Any]:
        """Delete one persistent index through a small Worker RPC request."""

        self._require_configuration()
        return self._request_sync(
            "vector.store.delete",
            {"indexPath": str(index_path.resolve())},
        )

    def _require_configuration(self) -> None:
        """Raise a stable retryable failure when Electron RPC is unavailable."""

        if not self.configured:
            raise VectorWorkerClientError(
                "VECTOR_WORKER_UNAVAILABLE",
                "Vector Worker RPC is not configured for this backend process.",
                True,
            )

    def _write_json_artifact(self, value: Any, prefix: str) -> Path:
        """Create one private compact UTF-8 JSON artifact in the exchange root."""

        self._exchange_root.mkdir(parents=True, exist_ok=True)
        descriptor, file_name = tempfile.mkstemp(
            prefix=prefix,
            suffix=".json",
            dir=self._exchange_root,
        )
        try:
            with os.fdopen(descriptor, "w", encoding="utf-8", newline="") as artifact_file:
                json.dump(value, artifact_file, ensure_ascii=False, separators=(",", ":"))
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

    def _write_float32_artifact(
        self,
        vectors: Sequence[Sequence[float]],
    ) -> tuple[Path, int, int]:
        """Write one finite rectangular matrix as little-endian float32 values."""

        if isinstance(vectors, (str, bytes)) or not vectors:
            raise VectorWorkerClientError(
                "INVALID_VECTORS",
                "Persistent vectors must be a non-empty matrix.",
                False,
            )
        vector_count = len(vectors)
        first_row = vectors[0]
        if isinstance(first_row, (str, bytes)) or not first_row:
            raise VectorWorkerClientError(
                "INVALID_VECTORS",
                "Persistent vector rows must be non-empty sequences.",
                False,
            )
        dimension = len(first_row)
        if vector_count > 100_000 or dimension > 8_192:
            raise VectorWorkerClientError(
                "INVALID_VECTORS",
                "Persistent vector matrix exceeds supported dimensions.",
                False,
            )
        values = array("f")
        for row in vectors:
            if isinstance(row, (str, bytes)) or len(row) != dimension:
                raise VectorWorkerClientError(
                    "INVALID_VECTORS",
                    "Persistent vector rows must have one consistent dimension.",
                    False,
                )
            for value in row:
                float_value = float(value)
                if not math.isfinite(float_value):
                    raise VectorWorkerClientError(
                        "INVALID_VECTORS",
                        "Persistent vectors cannot contain non-finite values.",
                        False,
                    )
                values.append(float_value)
        if sys.byteorder != "little":
            values.byteswap()
        self._exchange_root.mkdir(parents=True, exist_ok=True)
        descriptor, file_name = tempfile.mkstemp(
            prefix="vector-f32-",
            suffix=".f32",
            dir=self._exchange_root,
        )
        try:
            with os.fdopen(descriptor, "wb") as artifact_file:
                values.tofile(artifact_file)
            artifact_path = Path(file_name)
            artifact_path.chmod(0o600)
            return artifact_path, vector_count, dimension
        except Exception:
            try:
                os.close(descriptor)
            except OSError:
                pass
            Path(file_name).unlink(missing_ok=True)
            raise

    def _request_vectors_sync(
        self,
        method: str,
        index_path: Path,
        vectors: Sequence[Sequence[float]],
        controls: Mapping[str, Any],
    ) -> Mapping[str, Any]:
        """Send one persistent vector operation and always delete its binary artifact."""

        self._require_configuration()
        artifact_path, vector_count, dimension = self._write_float32_artifact(vectors)
        try:
            return self._request_sync(
                method,
                {
                    "indexPath": str(index_path.resolve()),
                    "artifactPath": str(artifact_path),
                    "vectorCount": vector_count,
                    "dimension": dimension,
                    **dict(controls),
                },
            )
        finally:
            artifact_path.unlink(missing_ok=True)

    def _read_json_artifact(self, path: Path) -> Mapping[str, Any]:
        """Read and validate one worker-produced UTF-8 JSON object."""

        value = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(value, dict):
            raise VectorWorkerClientError(
                "INVALID_WORKER_RESPONSE",
                "Vector Worker result artifact must contain a JSON object.",
                False,
            )
        return value

    def _validate_embedding_result(
        self,
        response: Mapping[str, Any],
        result: Mapping[str, Any],
    ) -> None:
        """Validate that RPC metadata and the result artifact describe the same vectors."""

        embeddings = result.get("embeddings")
        count = result.get("count")
        if not isinstance(embeddings, list) or not isinstance(count, int):
            raise VectorWorkerClientError(
                "INVALID_WORKER_RESPONSE",
                "Vector Worker embedding result is missing vectors or count.",
                False,
            )
        if len(embeddings) != count or response.get("count") != count:
            raise VectorWorkerClientError(
                "INVALID_WORKER_RESPONSE",
                "Vector Worker embedding artifact does not match RPC metadata.",
                False,
            )

    def _request_sync(
        self,
        method: str,
        payload: Mapping[str, Any],
    ) -> Mapping[str, Any]:
        """Perform one blocking Vector Worker RPC request for execution in a thread."""

        body = json.dumps(
            {"capability": "vector-index", "method": method, "payload": dict(payload)},
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
            raise VectorWorkerClientError(
                "VECTOR_WORKER_UNAVAILABLE",
                f"Vector Worker RPC connection failed: {error}",
                True,
            ) from error

        if not isinstance(response_payload, dict) or response_payload.get("ok") is not True:
            raise VectorWorkerClientError(
                "INVALID_WORKER_RESPONSE",
                "Vector Worker RPC returned an invalid success envelope.",
                False,
            )
        result = response_payload.get("payload")
        if not isinstance(result, dict):
            raise VectorWorkerClientError(
                "INVALID_WORKER_RESPONSE",
                "Vector Worker RPC payload must be an object.",
                False,
            )
        return result

    def _raise_http_error(self, error: urllib_error.HTTPError) -> None:
        """Decode a structured Worker RPC HTTP error and raise a client exception."""

        try:
            payload = json.loads(error.read().decode("utf-8"))
            error_payload = payload.get("error", {}) if isinstance(payload, dict) else {}
            code = str(error_payload.get("code", "VECTOR_WORKER_FAILED"))
            message = str(error_payload.get("message", error.reason))
            retryable = bool(error_payload.get("retryable", error.code >= 500))
        except (json.JSONDecodeError, UnicodeDecodeError, AttributeError):
            code = "VECTOR_WORKER_FAILED"
            message = str(error.reason)
            retryable = error.code >= 500
        raise VectorWorkerClientError(code, message, retryable) from error
