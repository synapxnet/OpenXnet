# -*- coding: utf-8 -*-
"""Bounded ComfyUI workflow execution for authorized Python runtimes."""

from __future__ import annotations

import asyncio
import ipaddress
import json
import logging
import os
from pathlib import Path
import random
import time
from typing import Any, Mapping, Sequence
import urllib.parse
import uuid

import aiohttp

from py.get_setting import UPLOAD_FILES_DIR, get_host, get_port, load_settings


COMFYUI_REQUEST_TIMEOUT_SECONDS = 30
COMFYUI_GENERATION_TIMEOUT_SECONDS = 180
COMFYUI_SERVER_WAIT_SECONDS = 30
MAX_COMFYUI_JSON_BYTES = 2 * 1024 * 1024
MAX_COMFYUI_IMAGE_BYTES = 64 * 1024 * 1024
MAX_COMFYUI_UPLOAD_BYTES = 32 * 1024 * 1024
MAX_COMFYUI_WORKFLOW_BYTES = 4 * 1024 * 1024
MAX_COMFYUI_SERVER_COUNT = 32
MAX_COMFYUI_URL_LENGTH = 4_096

client_id = str(uuid.uuid4())
_running_comfyui_servers: set[str] = set()
_server_lock = asyncio.Lock()


class ComfyUiRequestError(RuntimeError):
    """Represent one sanitized ComfyUI transport or response failure."""


def _is_loopback_host(hostname: str) -> bool:
    """Return whether one normalized host is explicitly local loopback."""

    normalized = hostname.strip().lower().rstrip(".")
    if normalized == "localhost":
        return True
    try:
        return ipaddress.ip_address(normalized).is_loopback
    except ValueError:
        return False


def normalize_comfyui_server_url(value: Any) -> str:
    """Validate one ComfyUI base URL and enforce HTTPS outside loopback."""

    raw_url = str(value or "").strip()
    if not raw_url or len(raw_url) > MAX_COMFYUI_URL_LENGTH:
        raise ComfyUiRequestError("ComfyUI server URL is invalid.")
    try:
        parsed = urllib.parse.urlsplit(raw_url)
        port = parsed.port
    except ValueError as error:
        raise ComfyUiRequestError("ComfyUI server URL is invalid.") from error
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.hostname
        or parsed.username is not None
        or parsed.password is not None
        or parsed.query
        or parsed.fragment
    ):
        raise ComfyUiRequestError("ComfyUI server URL is invalid.")
    if parsed.scheme == "http" and not _is_loopback_host(parsed.hostname):
        raise ComfyUiRequestError("External ComfyUI endpoints require HTTPS.")
    if port is not None and not 1 <= port <= 65_535:
        raise ComfyUiRequestError("ComfyUI server URL is invalid.")
    path = parsed.path.rstrip("/")
    return urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, path, "", ""))


def normalize_comfyui_image_url(value: Any) -> str:
    """Validate one source image URL and enforce HTTPS outside loopback."""

    raw_url = str(value or "").strip()
    if not raw_url or len(raw_url) > MAX_COMFYUI_URL_LENGTH:
        raise ComfyUiRequestError("ComfyUI source image URL is invalid.")
    try:
        parsed = urllib.parse.urlsplit(raw_url)
        _ = parsed.port
    except ValueError as error:
        raise ComfyUiRequestError("ComfyUI source image URL is invalid.") from error
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.hostname
        or parsed.username is not None
        or parsed.password is not None
        or parsed.fragment
    ):
        raise ComfyUiRequestError("ComfyUI source image URL is invalid.")
    if parsed.scheme == "http" and not _is_loopback_host(parsed.hostname):
        raise ComfyUiRequestError("External ComfyUI source images require HTTPS.")
    return urllib.parse.urlunsplit(parsed)


def _build_server_url(server_address: str, route: str) -> str:
    """Join one validated ComfyUI base URL with an exact API route."""

    base_url = normalize_comfyui_server_url(server_address)
    return f"{base_url}/{route.lstrip('/')}"


async def _read_bounded_response(response: aiohttp.ClientResponse, limit: int) -> bytes:
    """Read one response body without allowing it to exceed a byte budget."""

    if response.content_length is not None and response.content_length > limit:
        raise ComfyUiRequestError("ComfyUI response exceeds its byte budget.")
    chunks: list[bytes] = []
    consumed = 0
    async for chunk in response.content.iter_chunked(64 * 1024):
        consumed += len(chunk)
        if consumed > limit:
            raise ComfyUiRequestError("ComfyUI response exceeds its byte budget.")
        chunks.append(chunk)
    return b"".join(chunks)


async def _request_json(
    session: aiohttp.ClientSession,
    method: str,
    url: str,
    *,
    json_body: Mapping[str, Any] | None = None,
    data: Any = None,
) -> Mapping[str, Any]:
    """Execute one no-redirect ComfyUI request and parse a bounded JSON object."""

    try:
        async with session.request(
            method,
            url,
            json=json_body,
            data=data,
            allow_redirects=False,
        ) as response:
            if response.status < 200 or response.status >= 300:
                raise ComfyUiRequestError("ComfyUI request failed.")
            body = await _read_bounded_response(response, MAX_COMFYUI_JSON_BYTES)
    except (aiohttp.ClientError, asyncio.TimeoutError) as error:
        raise ComfyUiRequestError("ComfyUI request failed.") from error
    try:
        parsed = json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ComfyUiRequestError("ComfyUI returned invalid JSON.") from error
    if not isinstance(parsed, Mapping):
        raise ComfyUiRequestError("ComfyUI returned invalid JSON.")
    return parsed


async def queue_prompt(
    session: aiohttp.ClientSession,
    prompt: Mapping[str, Any],
    server_address: str,
    settings: Mapping[str, Any],
) -> Mapping[str, Any]:
    """Submit one bounded workflow prompt with the optional hydrated ComfyUI key."""

    api_key = str(settings.get("comfyuiAPIkey") or "").strip()
    payload: dict[str, Any] = {"prompt": prompt, "client_id": client_id}
    if api_key:
        payload["extra_data"] = {"api_key_comfy_org": api_key}
    return await _request_json(
        session,
        "POST",
        _build_server_url(server_address, "/prompt"),
        json_body=payload,
    )


async def get_image(
    session: aiohttp.ClientSession,
    filename: str,
    subfolder: str,
    folder_type: str,
    server_address: str,
) -> bytes:
    """Download one generated image through the bounded ComfyUI view route."""

    query = urllib.parse.urlencode({
        "filename": filename,
        "subfolder": subfolder,
        "type": folder_type,
    })
    try:
        async with session.get(
            f"{_build_server_url(server_address, '/view')}?{query}",
            allow_redirects=False,
        ) as response:
            if response.status < 200 or response.status >= 300:
                raise ComfyUiRequestError("ComfyUI image download failed.")
            return await _read_bounded_response(response, MAX_COMFYUI_IMAGE_BYTES)
    except (aiohttp.ClientError, asyncio.TimeoutError) as error:
        raise ComfyUiRequestError("ComfyUI image download failed.") from error


async def get_history(
    session: aiohttp.ClientSession,
    prompt_id: str,
    server_address: str,
) -> Mapping[str, Any]:
    """Fetch bounded generation history for one exact prompt identifier."""

    safe_prompt_id = urllib.parse.quote(prompt_id, safe="")
    return await _request_json(
        session,
        "GET",
        _build_server_url(server_address, f"/history/{safe_prompt_id}"),
    )


def _safe_output_filename(value: Any) -> str:
    """Return one non-traversing generated image filename."""

    filename = str(value or "").strip()
    if (
        not filename
        or len(filename) > 255
        or filename in {".", ".."}
        or Path(filename).name != filename
        or "\x00" in filename
    ):
        raise ComfyUiRequestError("ComfyUI image filename is invalid.")
    return filename


def _persist_generated_image(filename: str, image_data: bytes) -> str:
    """Persist one generated image below the upload directory with a unique name."""

    safe_name = _safe_output_filename(filename)
    output_name = f"{uuid.uuid4().hex}-{safe_name}"
    output_root = Path(UPLOAD_FILES_DIR).resolve()
    output_root.mkdir(parents=True, exist_ok=True)
    output_path = (output_root / output_name).resolve()
    if output_path.parent != output_root:
        raise ComfyUiRequestError("ComfyUI image filename is invalid.")
    output_path.write_bytes(image_data)
    return output_name


async def get_all(
    session: aiohttp.ClientSession,
    prompt: Mapping[str, Any],
    server_address: str,
    settings: Mapping[str, Any],
) -> list[str]:
    """Submit one prompt, wait for completion, and persist each generated image once."""

    queued = await queue_prompt(session, prompt, server_address, settings)
    prompt_id = str(queued.get("prompt_id") or "").strip()
    if not prompt_id or len(prompt_id) > 256:
        raise ComfyUiRequestError("ComfyUI prompt response is invalid.")
    deadline = time.monotonic() + COMFYUI_GENERATION_TIMEOUT_SECONDS
    history_entry: Mapping[str, Any] | None = None
    while time.monotonic() < deadline:
        history = await get_history(session, prompt_id, server_address)
        candidate = history.get(prompt_id)
        if isinstance(candidate, Mapping):
            history_entry = candidate
            break
        await asyncio.sleep(1)
    if history_entry is None:
        raise ComfyUiRequestError("ComfyUI generation timed out.")

    output_urls: list[str] = []
    outputs = history_entry.get("outputs")
    if not isinstance(outputs, Mapping):
        return output_urls
    host = get_host()
    if host == "0.0.0.0":
        host = "127.0.0.1"
    port = get_port()
    for node_output in outputs.values():
        if not isinstance(node_output, Mapping):
            continue
        images = node_output.get("images")
        if not isinstance(images, Sequence) or isinstance(images, (str, bytes, bytearray)):
            continue
        for image in images:
            if not isinstance(image, Mapping):
                continue
            filename = _safe_output_filename(image.get("filename"))
            image_data = await get_image(
                session,
                filename,
                str(image.get("subfolder") or ""),
                str(image.get("type") or "output"),
                server_address,
            )
            output_name = _persist_generated_image(filename, image_data)
            encoded_name = urllib.parse.quote(output_name, safe="")
            output_urls.append(f"http://{host}:{port}/uploaded_files/{encoded_name}")
    return output_urls


def _upload_filename(image_url: str) -> str:
    """Derive one safe upload filename from a validated source image URL."""

    path_name = urllib.parse.unquote(urllib.parse.urlsplit(image_url).path.rsplit("/", 1)[-1])
    try:
        return _safe_output_filename(path_name)
    except ComfyUiRequestError:
        return f"openxnet-upload-{uuid.uuid4().hex}.bin"


async def upload_image_via_url(
    session: aiohttp.ClientSession,
    image_url: str,
    server_address: str,
) -> Mapping[str, Any]:
    """Download one validated image and upload it without redirects or verbose errors."""

    source_url = normalize_comfyui_image_url(image_url)
    try:
        async with session.get(source_url, allow_redirects=False) as response:
            if response.status < 200 or response.status >= 300:
                raise ComfyUiRequestError("ComfyUI source image download failed.")
            image_content = await _read_bounded_response(response, MAX_COMFYUI_UPLOAD_BYTES)
    except (aiohttp.ClientError, asyncio.TimeoutError) as error:
        raise ComfyUiRequestError("ComfyUI source image download failed.") from error
    form = aiohttp.FormData()
    form.add_field("overwrite", "false")
    form.add_field("type", "input")
    form.add_field("subfolder", "")
    form.add_field(
        "image",
        image_content,
        filename=_upload_filename(source_url),
        content_type="application/octet-stream",
    )
    return await _request_json(
        session,
        "POST",
        _build_server_url(server_address, "/upload/image"),
        data=form,
    )


def _resolve_workflow_path(tool_name: Any) -> Path:
    """Resolve one workflow JSON path without allowing directory traversal."""

    normalized_name = str(tool_name or "").strip()
    if (
        not normalized_name
        or len(normalized_name) > 200
        or Path(normalized_name).name != normalized_name
        or normalized_name in {".", ".."}
    ):
        raise ComfyUiRequestError("ComfyUI workflow name is invalid.")
    root = Path(UPLOAD_FILES_DIR).resolve()
    workflow_path = (root / f"{normalized_name}.json").resolve()
    if workflow_path.parent != root:
        raise ComfyUiRequestError("ComfyUI workflow name is invalid.")
    return workflow_path


def _load_workflow_prompt(tool_name: Any) -> Mapping[str, Any]:
    """Load one bounded UTF-8 workflow prompt document."""

    workflow_path = _resolve_workflow_path(tool_name)
    try:
        if workflow_path.stat().st_size > MAX_COMFYUI_WORKFLOW_BYTES:
            raise ComfyUiRequestError("ComfyUI workflow exceeds its byte budget.")
        prompt = json.loads(workflow_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ComfyUiRequestError("ComfyUI workflow could not be loaded.") from error
    if not isinstance(prompt, Mapping):
        raise ComfyUiRequestError("ComfyUI workflow is invalid.")
    return dict(prompt)


def _find_workflow_metadata(settings: Mapping[str, Any], tool_name: str) -> Mapping[str, Any]:
    """Find one matching workflow metadata record from bounded settings."""

    workflows = settings.get("workflows")
    if not isinstance(workflows, Sequence) or isinstance(workflows, (str, bytes, bytearray)):
        raise ComfyUiRequestError("ComfyUI workflow metadata is invalid.")
    for workflow in workflows:
        if isinstance(workflow, Mapping) and workflow.get("unique_filename") == tool_name:
            return workflow
    raise ComfyUiRequestError("ComfyUI workflow metadata is missing.")


def _set_workflow_input(
    prompt: dict[str, Any],
    workflow: Mapping[str, Any],
    metadata_key: str,
    value: Any,
) -> None:
    """Assign one workflow input through validated node metadata."""

    binding = workflow.get(metadata_key)
    if not isinstance(binding, Mapping):
        raise ComfyUiRequestError("ComfyUI workflow input binding is invalid.")
    node_id = str(binding.get("nodeId") or "").strip()
    input_field = str(binding.get("inputField") or "").strip()
    node = prompt.get(node_id)
    inputs = node.get("inputs") if isinstance(node, Mapping) else None
    if not node_id or not input_field or not isinstance(inputs, dict):
        raise ComfyUiRequestError("ComfyUI workflow input binding is invalid.")
    inputs[input_field] = value


def _randomize_workflow_seed(
    prompt: dict[str, Any],
    workflow: Mapping[str, Any],
    metadata_key: str,
) -> None:
    """Replace one optional workflow seed with a bounded random value."""

    if workflow.get(metadata_key) is None:
        return
    _set_workflow_input(prompt, workflow, metadata_key, random.randint(0, 2**32 - 1))


def _normalize_server_candidates(settings: Mapping[str, Any]) -> list[str]:
    """Return a deduplicated bounded list of validated ComfyUI servers."""

    raw_servers = settings.get("comfyuiServers")
    if not isinstance(raw_servers, Sequence) or isinstance(raw_servers, (str, bytes, bytearray)):
        return []
    normalized: list[str] = []
    for raw_server in list(raw_servers)[:MAX_COMFYUI_SERVER_COUNT]:
        try:
            server = normalize_comfyui_server_url(raw_server)
        except ComfyUiRequestError:
            continue
        if server not in normalized:
            normalized.append(server)
    return normalized


async def _acquire_comfyui_server(servers: Sequence[str]) -> str | None:
    """Reserve the first available ComfyUI server within a bounded wait."""

    deadline = time.monotonic() + COMFYUI_SERVER_WAIT_SECONDS
    while time.monotonic() < deadline:
        async with _server_lock:
            for server in servers:
                if server not in _running_comfyui_servers:
                    _running_comfyui_servers.add(server)
                    return server
        await asyncio.sleep(1)
    return None


async def _release_comfyui_server(server: str) -> None:
    """Release one previously reserved ComfyUI server."""

    async with _server_lock:
        _running_comfyui_servers.discard(server)


async def comfyui_tool_call(
    tool_name: str,
    text_input: Any = None,
    image_input: Any = None,
    text_input_2: Any = None,
    image_input_2: Any = None,
) -> str:
    """Execute one configured ComfyUI workflow and return only sanitized failures."""

    server_address: str | None = None
    try:
        settings = await load_settings()
        servers = _normalize_server_candidates(settings)
        if not servers:
            return "没有可用的 ComfyUI 服务器。"
        server_address = await _acquire_comfyui_server(servers)
        if server_address is None:
            return "没有可用的 ComfyUI 服务器。"
        prompt = dict(_load_workflow_prompt(tool_name))
        workflow = _find_workflow_metadata(settings, tool_name)
        timeout = aiohttp.ClientTimeout(
            total=None,
            connect=10,
            sock_connect=10,
            sock_read=COMFYUI_REQUEST_TIMEOUT_SECONDS,
        )
        async with aiohttp.ClientSession(timeout=timeout) as session:
            if text_input is not None:
                _set_workflow_input(prompt, workflow, "text_input", text_input)
            if text_input_2 is not None:
                _set_workflow_input(prompt, workflow, "text_input_2", text_input_2)
            if image_input is not None:
                image_result = await upload_image_via_url(session, str(image_input), server_address)
                image_name = str(image_result.get("name") or "").strip()
                if not image_name:
                    raise ComfyUiRequestError("ComfyUI image upload failed.")
                _set_workflow_input(prompt, workflow, "image_input", image_name)
            if image_input_2 is not None:
                image_result = await upload_image_via_url(session, str(image_input_2), server_address)
                image_name = str(image_result.get("name") or "").strip()
                if not image_name:
                    raise ComfyUiRequestError("ComfyUI image upload failed.")
                _set_workflow_input(prompt, workflow, "image_input_2", image_name)
            _randomize_workflow_seed(prompt, workflow, "seed_input")
            _randomize_workflow_seed(prompt, workflow, "seed_input2")
            image_paths = await get_all(session, prompt, server_address, settings)
        return json.dumps({"image_path_list": image_paths}, ensure_ascii=False)
    except ComfyUiRequestError:
        logging.warning("ComfyUI workflow execution failed.")
        return "ComfyUI 请求失败。"
    except Exception:
        logging.error("Unexpected ComfyUI workflow failure.")
        return "ComfyUI 请求失败。"
    finally:
        if server_address is not None:
            await _release_comfyui_server(server_address)
