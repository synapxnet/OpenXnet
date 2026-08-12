# -*- coding: utf-8 -*-
"""提供不依赖 python-a2a Provider/Server 闭包的有界 A2A HTTP 客户端。"""

from __future__ import annotations

import ipaddress
import json
from typing import Any, Mapping, Sequence
from urllib.parse import urlsplit, urlunsplit
from uuid import uuid4

import httpx


MAX_A2A_ENDPOINT_LENGTH = 2_048
MAX_A2A_QUERY_LENGTH = 64 * 1024
MAX_A2A_RESPONSE_BYTES = 1024 * 1024
A2A_REQUEST_TIMEOUT_SECONDS = 10.0
A2A_CARD_PATHS = (
    ".well-known/agent-card.json",
    ".well-known/agent.json",
    "agent.json",
    "a2a/agent.json",
)


class A2AClientError(RuntimeError):
    """表示不包含上游正文、凭据或内部路径的固定 A2A 客户端错误。"""


class A2AHttpStatusError(A2AClientError):
    """保存可安全判断的 HTTP 状态码，不保留上游响应正文。"""

    def __init__(self, status_code: int) -> None:
        """保存 HTTP 状态码；输入状态码，无返回，不读取响应正文。"""

        super().__init__(f"A2A request failed with HTTP {status_code}.")
        self.status_code = int(status_code)


def normalize_a2a_endpoint(value: Any) -> str:
    """规范 A2A 端点；输入未知值，返回 HTTPS 或 HTTP 回环 URL，凭据、查询和片段会被拒绝。"""

    endpoint = str(value or "").strip()
    if not endpoint or len(endpoint) > MAX_A2A_ENDPOINT_LENGTH:
        raise A2AClientError("A2A endpoint is invalid.")
    try:
        parsed = urlsplit(endpoint)
        hostname = str(parsed.hostname or "").rstrip(".").lower()
        parsed.port
    except ValueError as error:
        raise A2AClientError("A2A endpoint is invalid.") from error
    if parsed.scheme not in {"http", "https"} or not hostname:
        raise A2AClientError("A2A endpoint is invalid.")
    if parsed.username is not None or parsed.password is not None:
        raise A2AClientError("A2A endpoint is not allowed.")
    if parsed.query or parsed.fragment:
        raise A2AClientError("A2A endpoint is not allowed.")
    try:
        is_loopback = ipaddress.ip_address(hostname).is_loopback
    except ValueError:
        is_loopback = hostname == "localhost"
    if parsed.scheme != "https" and not is_loopback:
        raise A2AClientError("A2A endpoint is not allowed.")
    normalized_path = parsed.path.rstrip("/")
    return urlunsplit((parsed.scheme, parsed.netloc, normalized_path, "", ""))


async def _request_a2a_json(
    client: httpx.AsyncClient,
    method: str,
    url: str,
    payload: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """发送有界 A2A JSON 请求；输入客户端、方法、URL 和载荷，返回对象，状态或结构无效时抛错。"""

    headers = {"Accept": "application/json", "User-Agent": "OpenXnet/1.0"}
    if payload is not None:
        headers["Content-Type"] = "application/json"
    request = client.build_request(method, url, headers=headers, json=payload)
    try:
        response = await client.send(request, stream=True, follow_redirects=False)
    except httpx.HTTPError as error:
        raise A2AClientError("A2A transport failed.") from error
    try:
        if not 200 <= response.status_code < 300:
            raise A2AHttpStatusError(response.status_code)
        declared_length = response.headers.get("content-length")
        if declared_length:
            try:
                if int(declared_length) > MAX_A2A_RESPONSE_BYTES:
                    raise A2AClientError("A2A response exceeds its byte budget.")
            except ValueError as error:
                raise A2AClientError("A2A response length is invalid.") from error
        body = bytearray()
        async for chunk in response.aiter_bytes():
            body.extend(chunk)
            if len(body) > MAX_A2A_RESPONSE_BYTES:
                raise A2AClientError("A2A response exceeds its byte budget.")
        try:
            value = json.loads(bytes(body).decode("utf-8", errors="strict"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise A2AClientError("A2A response is not valid UTF-8 JSON.") from error
        if not isinstance(value, dict):
            raise A2AClientError("A2A response must be a JSON object.")
        return value
    finally:
        await response.aclose()


def _public_a2a_text(value: Any, fallback: str, maximum_length: int) -> str:
    """裁剪 A2A 公开文本；输入未知值、默认值和长度，返回无控制字符文本，非法值使用默认值。"""

    normalized = value.strip() if isinstance(value, str) else ""
    if not normalized or "\x00" in normalized or "\x7f" in normalized:
        return fallback
    return normalized[:maximum_length]


def _public_a2a_text_list(
    value: Any,
    maximum_items: int,
    maximum_length: int,
) -> list[str]:
    """规范 A2A 公开文本数组；输入未知值和预算，返回去重列表，非法项被忽略。"""

    if not isinstance(value, list):
        return []
    output: list[str] = []
    seen: set[str] = set()
    for item in value:
        normalized = _public_a2a_text(item, "", maximum_length)
        if normalized and normalized not in seen:
            seen.add(normalized)
            output.append(normalized)
            if len(output) >= maximum_items:
                break
    return output


def project_a2a_agent_card(value: Mapping[str, Any], endpoint: str) -> dict[str, Any]:
    """投影 A2A Agent Card；输入上游对象和端点，返回有界公开字段，不复制认证或扩展私有字段。"""

    raw_skills = value.get("skills")
    skills: list[dict[str, Any]] = []
    if isinstance(raw_skills, list):
        for index, raw_skill in enumerate(raw_skills[:64]):
            skill = raw_skill if isinstance(raw_skill, dict) else {}
            skills.append({
                "id": _public_a2a_text(skill.get("id"), f"skill-{index + 1}", 128),
                "name": _public_a2a_text(skill.get("name"), "Unknown Skill", 256),
                "description": _public_a2a_text(skill.get("description"), "", 2_048),
                "tags": _public_a2a_text_list(skill.get("tags"), 32, 128),
                "examples": _public_a2a_text_list(skill.get("examples"), 32, 1_024),
            })
    return {
        "url": endpoint,
        "name": _public_a2a_text(value.get("name"), "Unknown Agent", 256),
        "description": _public_a2a_text(value.get("description"), "", 4_096),
        "version": _public_a2a_text(value.get("version"), "unknown", 128),
        "skills": skills,
        "status": "ready",
        "enabled": True,
    }


def _extract_text_parts(value: Any) -> str:
    """提取 A2A parts 文本；输入未知 parts 数组，返回首个有界文本，没有匹配时返回空串。"""

    if not isinstance(value, list):
        return ""
    for part in value[:128]:
        if not isinstance(part, dict):
            continue
        part_kind = str(part.get("kind") or part.get("type") or "").lower()
        text = part.get("text")
        if part_kind in {"text", "text/plain"} and isinstance(text, str):
            return _public_a2a_text(text, "", 128 * 1024)
    return ""


def extract_a2a_response_text(value: Mapping[str, Any]) -> str:
    """提取 A2A 文本结果；输入现代或兼容响应对象，返回有界文本，未知结构返回空串。"""

    candidate: Mapping[str, Any] = value
    result = value.get("result")
    if isinstance(result, dict):
        candidate = result
    direct_text = candidate.get("text")
    if isinstance(direct_text, str):
        return _public_a2a_text(direct_text, "", 128 * 1024)
    content = candidate.get("content")
    if isinstance(content, dict):
        content_text = content.get("text")
        if isinstance(content_text, str):
            return _public_a2a_text(content_text, "", 128 * 1024)
    text = _extract_text_parts(candidate.get("parts"))
    if text:
        return text
    for key in ("message", "status"):
        nested = candidate.get(key)
        if not isinstance(nested, dict):
            continue
        if key == "status" and isinstance(nested.get("message"), dict):
            nested = nested["message"]
        text = _extract_text_parts(nested.get("parts"))
        if text:
            return text
    artifacts = candidate.get("artifacts")
    if isinstance(artifacts, list):
        for artifact in artifacts[:64]:
            if isinstance(artifact, dict):
                text = _extract_text_parts(artifact.get("parts"))
                if text:
                    return text
    return ""


async def inspect_a2a_agent(
    endpoint: Any,
    *,
    client: httpx.AsyncClient | None = None,
) -> dict[str, Any]:
    """探测 A2A Agent Card；输入端点和可选客户端，返回公开卡片，超时、超限或全部失败时抛错。"""

    normalized_endpoint = normalize_a2a_endpoint(endpoint)
    owned_client = client is None
    active_client = client or httpx.AsyncClient(timeout=A2A_REQUEST_TIMEOUT_SECONDS)
    try:
        for card_path in A2A_CARD_PATHS:
            try:
                card = await _request_a2a_json(
                    active_client,
                    "GET",
                    f"{normalized_endpoint}/{card_path}",
                )
                return project_a2a_agent_card(card, normalized_endpoint)
            except A2AClientError:
                continue
        raise A2AClientError("A2A Agent Card is unavailable.")
    finally:
        if owned_client:
            await active_client.aclose()


async def ask_a2a_agent(
    endpoint: Any,
    query: Any,
    *,
    client: httpx.AsyncClient | None = None,
) -> str:
    """调用 A2A 文本消息；输入端点、问题和可选客户端，返回有界文本，协议或传输失败时抛错。"""

    normalized_endpoint = normalize_a2a_endpoint(endpoint)
    normalized_query = str(query or "").strip()
    if not normalized_query or len(normalized_query) > MAX_A2A_QUERY_LENGTH:
        raise A2AClientError("A2A query is invalid.")
    message_id = uuid4().hex
    message = {
        "kind": "message",
        "messageId": message_id,
        "role": "user",
        "parts": [{"kind": "text", "text": normalized_query}],
    }
    modern_payload = {
        "jsonrpc": "2.0",
        "id": message_id,
        "method": "message/send",
        "params": {"message": message},
    }
    endpoint_path = urlsplit(normalized_endpoint).path.rstrip("/").lower()
    endpoints: Sequence[str] = (
        (normalized_endpoint,)
        if endpoint_path.endswith("/a2a")
        else (normalized_endpoint, f"{normalized_endpoint}/a2a")
    )
    owned_client = client is None
    active_client = client or httpx.AsyncClient(timeout=A2A_REQUEST_TIMEOUT_SECONDS)
    legacy_endpoints: list[str] = []
    try:
        for request_endpoint in endpoints:
            try:
                response = await _request_a2a_json(
                    active_client,
                    "POST",
                    request_endpoint,
                    modern_payload,
                )
            except A2AHttpStatusError as error:
                if error.status_code in {404, 405, 422}:
                    legacy_endpoints.append(request_endpoint)
                    continue
                raise
            except A2AClientError:
                continue
            text = extract_a2a_response_text(response)
            if text:
                return text
            raise A2AClientError("A2A response does not contain text.")
        legacy_payload = {
            "message_id": message_id,
            "conversation_id": message_id,
            "role": "user",
            "content": {"type": "text", "text": normalized_query},
        }
        for request_endpoint in legacy_endpoints:
            try:
                response = await _request_a2a_json(
                    active_client,
                    "POST",
                    request_endpoint,
                    legacy_payload,
                )
            except A2AClientError:
                continue
            text = extract_a2a_response_text(response)
            if text:
                return text
            raise A2AClientError("A2A response does not contain text.")
        raise A2AClientError("A2A request failed.")
    finally:
        if owned_client:
            await active_client.aclose()
