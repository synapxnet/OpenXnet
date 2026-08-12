#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
Quest 3 / VR-MR gateway routes.

The gateway gives Quest clients a stable, compact protocol for session setup,
task cards, avatar state, and a first WebSocket event loop without coupling the
headset directly to the broader desktop API surface.
"""

from __future__ import annotations

import asyncio
import ipaddress
import json
import socket
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from py.get_setting import DEFAULT_ASR_DIR, load_settings
from py.task_center import TaskStatus, get_task_center
from py.worldgen_bridge import (
    WorldGenSceneRequest,
    generate_scene,
    load_manifest,
    prepare_scene,
    public_scene_urls,
    scene_asset_path,
    worldgen_feature_enabled,
    worldgen_runtime_status,
)


router = APIRouter(tags=["vr-gateway"])
MAX_VR_CONVERSATION_MESSAGES = 24
VR_DEVICE_HEARTBEAT_TTL_SECONDS = 45
WORLDGEN_REPLAY_TTL_SECONDS = 300
DEFAULT_REAL_CHAT_FALLBACK_TO_MOCK = False
DEFAULT_VR_CHAT_MODEL = "gpt-5.5"
SHERPA_MODEL_NAME = "sherpa-onnx-sense-voice-zh-en-ja-ko-yue"
SHERPA_REQUIRED_FILES = ("model.int8.onnx", "tokens.txt")
VR_VERIFICATION_STATE_FILE = Path(DEFAULT_ASR_DIR).parent / "vr_verification_state.json"
VR_VERIFICATION_ITEMS = (
    ("gateway_session", "VR session REST/session setup", False),
    ("websocket_event_loop", "VR WebSocket event loop", False),
    ("chat_stream", "Quest chat stream and assistant events", False),
    ("object_catalog", "Interactable object catalog", False),
    ("object_interaction", "Interactable object interaction events", False),
    ("object_semantic_action", "Object semantic action result", False),
    ("space_layout_protocol", "Space layout protocol", False),
    ("device_heartbeat", "Quest hardware heartbeat", True),
    ("voice_asr_loop", "Quest microphone ASR to chat loop", True),
    ("hand_gesture", "Quest hand gesture recognition", True),
    ("controller_input", "Quest Touch controller input", True),
    ("controller_haptics", "Quest Touch haptic feedback", True),
    ("mruk_space_layout", "MRUK scene/surface scan on headset", True),
    ("xri_object_targeting", "XRI grab/ray object targeting", True),
    ("vrm_feedback", "VRM avatar visual/audio feedback in headset", True),
)
_latest_device_heartbeat: Dict[str, Any] = {}
_device_heartbeat_lock = asyncio.Lock()
_worldgen_jobs: Dict[str, Dict[str, Any]] = {}
_latest_worldgen_scene_by_session: Dict[str, Dict[str, Any]] = {}
_latest_worldgen_scene: Dict[str, Any] = {}
_worldgen_jobs_lock = asyncio.Lock()


def _now_iso() -> str:
    return datetime.now().isoformat()


def _parse_iso_datetime(value: Any) -> Optional[datetime]:
    text = _clean_text(value)
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        return None


def _event_id(prefix: str = "evt") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:16]}"


def _clean_text(value: Any, fallback: str = "") -> str:
    return str(value or fallback).strip()


def _as_bool(value: Any, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _as_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _is_loopback_host(host: str) -> bool:
    value = _clean_text(host).strip("[]").lower()
    if value in {"localhost", "127.0.0.1", "::1"}:
        return True
    try:
        return ipaddress.ip_address(value).is_loopback
    except ValueError:
        return False


def _is_usable_ipv4(address: str) -> bool:
    try:
        ip = ipaddress.ip_address(_clean_text(address))
    except ValueError:
        return False
    return (
        ip.version == 4
        and not ip.is_loopback
        and not ip.is_unspecified
        and not ip.is_multicast
        and not ip.is_link_local
    )


def _discover_lan_ipv4_addresses() -> List[Dict[str, Any]]:
    addresses = set()
    routed_addresses = set()

    for target in ("8.8.8.8", "223.5.5.5"):
        sock = None
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.connect((target, 80))
            routed_address = sock.getsockname()[0]
            addresses.add(routed_address)
            routed_addresses.add(routed_address)
        except OSError:
            pass
        finally:
            if sock is not None:
                sock.close()

    for name in {socket.gethostname(), socket.getfqdn()}:
        try:
            infos = socket.getaddrinfo(name, None, socket.AF_INET, socket.SOCK_DGRAM)
        except OSError:
            continue
        for info in infos:
            addresses.add(info[4][0])

    usable = [_clean_text(address) for address in addresses if _is_usable_ipv4(address)]

    def sort_key(address: str) -> Any:
        ip = ipaddress.ip_address(address)
        return (0 if address in routed_addresses else 1, 0 if ip.is_private else 1, address)

    return [
        {
            "address": address,
            "is_private": ipaddress.ip_address(address).is_private,
        }
        for address in sorted(set(usable), key=sort_key)
    ]


def _request_port(request: Request) -> int:
    if request.url.port:
        return int(request.url.port)
    server = request.scope.get("server") or ()
    if len(server) > 1 and isinstance(server[1], int):
        return int(server[1])
    return 443 if request.url.scheme == "https" else 80


def _format_url_host(host: str) -> str:
    value = _clean_text(host)
    if ":" in value and not value.startswith("["):
        return f"[{value}]"
    return value


def _build_origin_url(scheme: str, host: str, port: int) -> str:
    default_port = 443 if scheme == "https" else 80
    port_part = "" if port == default_port else f":{port}"
    return f"{scheme}://{_format_url_host(host)}{port_part}"


def _quest_url_from_origin(origin: str) -> str:
    return f"{origin.rstrip('/')}/quest3/"


def _sherpa_model_ready() -> bool:
    model_dir = Path(DEFAULT_ASR_DIR) / SHERPA_MODEL_NAME
    return all((model_dir / name).is_file() for name in SHERPA_REQUIRED_FILES)


async def _get_asr_status() -> Dict[str, Any]:
    try:
        settings = await load_settings()
    except Exception as exc:
        return {
            "ready": False,
            "engine": "unknown",
            "message": f"ASR settings unavailable: {exc}",
        }

    asr_settings = settings.get("asrSettings") or {}
    engine = _clean_text(asr_settings.get("engine"), "sherpa").lower()
    enabled = _as_bool(asr_settings.get("enabled"), False)
    status: Dict[str, Any] = {
        "enabled": enabled,
        "engine": engine,
        "ready": False,
        "message": "",
    }

    if engine == "sherpa":
        ready = _sherpa_model_ready()
        status.update(
            {
                "ready": ready,
                "model": SHERPA_MODEL_NAME,
                "message": "ready" if ready else "Sherpa model not downloaded",
                "setup_path": "/sherpa-model/status",
            }
        )
    elif engine == "openai":
        has_key = bool(_clean_text(asr_settings.get("api_key")))
        status.update(
            {
                "ready": has_key,
                "model": _clean_text(asr_settings.get("model"), "whisper-1"),
                "base_url_configured": bool(_clean_text(asr_settings.get("base_url"))),
                "api_key_configured": has_key,
                "message": "ready" if has_key else "OpenAI-compatible ASR API key not configured",
            }
        )
    elif engine == "funasr":
        status.update(
            {
                "ready": True,
                "mode": _clean_text(asr_settings.get("funasr_mode"), "offline"),
                "url": _clean_text(asr_settings.get("funasr_ws_url"), "ws://127.0.0.1:10095"),
                "message": "configured; runtime availability is checked when audio is sent",
            }
        )
    elif engine == "webspeech":
        status.update(
            {
                "ready": False,
                "message": "Browser Web Speech is not available to Quest Unity clients",
            }
        )
    else:
        status["message"] = f"Unsupported ASR engine: {engine}"

    return status


def _connection_port(connection: Any) -> int:
    if getattr(connection.url, "port", None):
        return int(connection.url.port)
    server = connection.scope.get("server") or ()
    if len(server) > 1 and isinstance(server[1], int):
        return int(server[1])
    return 443 if connection.url.scheme in {"https", "wss"} else 80


def _normalize_chat_base_url(connection: Any) -> str:
    scheme = "https" if connection.url.scheme in {"https", "wss"} else "http"
    return _build_origin_url(scheme, "127.0.0.1", _connection_port(connection))


def _request_origin(request: Request) -> str:
    scheme = request.url.scheme
    host_header = request.headers.get("host") or request.url.netloc
    request_host = request.url.hostname or host_header.split(":")[0]
    return _build_origin_url(scheme, request_host, _request_port(request))


def _connection_origin(connection: Any) -> str:
    scheme = "https" if connection.url.scheme in {"https", "wss"} else "http"
    host = connection.headers.get("host") if hasattr(connection, "headers") else ""
    if host:
        return f"{scheme}://{host}"
    return _build_origin_url(scheme, "127.0.0.1", _connection_port(connection))


def _extract_delta_text(payload: Any) -> str:
    if not isinstance(payload, dict):
        return ""
    choice = (payload.get("choices") or [{}])[0]
    if not isinstance(choice, dict):
        choice = {}
    delta = choice.get("delta") or choice.get("message") or payload.get("delta") or payload
    if not isinstance(delta, dict):
        return ""
    content = (
        delta.get("content")
        or delta.get("reasoning_content")
        or delta.get("reasoning")
        or delta.get("text")
        or payload.get("content")
        or ""
    )
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict):
                parts.append(str(item.get("text") or item.get("content") or ""))
            else:
                parts.append(str(item or ""))
        return "".join(parts)
    if content:
        return str(content)
    error = payload.get("error")
    if isinstance(error, dict):
        return _clean_text(error.get("message"))
    if error:
        return _clean_text(error)
    return ""


def _extract_stream_error(payload: Any) -> str:
    if not isinstance(payload, dict):
        return ""

    error = payload.get("error")
    if isinstance(error, dict):
        return _clean_text(error.get("message") or error.get("content") or error)
    if error:
        return _clean_text(error)

    choice = (payload.get("choices") or [{}])[0]
    if not isinstance(choice, dict):
        choice = {}
    delta = choice.get("delta") or choice.get("message") or payload.get("delta") or {}
    if not isinstance(delta, dict):
        return ""

    delta_error = delta.get("error")
    if isinstance(delta_error, dict):
        return _clean_text(delta_error.get("message") or delta_error.get("content") or delta_error)
    if delta_error:
        return _clean_text(delta_error)

    tool_content = delta.get("tool_content")
    if isinstance(tool_content, dict):
        tool_type = _clean_text(tool_content.get("type")).lower()
        title = _clean_text(tool_content.get("title"))
        content = _clean_text(tool_content.get("content"))
        if tool_type == "error" or "error" in title.lower():
            return content or title
    return ""


def _split_sse_buffer(buffer: str) -> tuple[List[str], str]:
    chunks = buffer.replace("\r\n", "\n").split("\n\n")
    remaining = chunks.pop() if chunks else ""
    payloads = []
    for chunk in chunks:
        data_lines = []
        for line in chunk.splitlines():
            if line.startswith("data:"):
                data_lines.append(line.replace("data:", "", 1).strip())
        raw = "\n".join(data_lines).strip() if data_lines else chunk.strip()
        if raw:
            payloads.append(raw)
    return payloads, remaining


def _parse_stream_payload(raw: str) -> Optional[Dict[str, Any]]:
    cleaned = _clean_text(raw)
    if not cleaned or cleaned == "[DONE]":
        return None
    if cleaned.startswith("data:"):
        cleaned = cleaned.replace("data:", "", 1).strip()
    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError:
        return {"choices": [{"delta": {"content": cleaned}}]}
    return payload if isinstance(payload, dict) else None


def _summarize_space_layout(layout: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(layout, dict) or not layout:
        return {}

    surfaces = layout.get("surfaces")
    if not isinstance(surfaces, list):
        surfaces = []

    return {
        "source": _clean_text(layout.get("source")),
        "mode": _clean_text(layout.get("mode")),
        "status": _clean_text(layout.get("status")),
        "ground_source": _clean_text(layout.get("ground_source")),
        "surface_count": _as_int(layout.get("surface_count"), len(surfaces)),
        "walkable_count": _as_int(layout.get("walkable_count")),
        "occluder_count": _as_int(layout.get("occluder_count")),
        "truncated": bool(layout.get("truncated")),
        "client_sent_at": _clean_text(layout.get("client_sent_at")),
        "saved_at": _clean_text(layout.get("saved_at")),
    }


def _space_layout_context(layout: Dict[str, Any]) -> str:
    summary = _summarize_space_layout(layout)
    if not summary:
        return ""

    surfaces = layout.get("surfaces") if isinstance(layout, dict) else []
    if not isinstance(surfaces, list):
        surfaces = []

    surface_lines = []
    for surface in surfaces[:8]:
        if not isinstance(surface, dict):
            continue
        label = _clean_text(surface.get("label") or surface.get("id"), "surface")
        walkable = "walkable" if surface.get("walkable") else "not_walkable"
        occluder = "occluder" if surface.get("occluder") else "not_occluder"
        size = surface.get("size") if isinstance(surface.get("size"), dict) else {}
        position = surface.get("position") if isinstance(surface.get("position"), dict) else {}
        surface_lines.append(
            "- "
            f"{label}: {walkable}, {occluder}, "
            f"size=({size.get('x', '?')}, {size.get('y', '?')}), "
            f"pos=({position.get('x', '?')}, {position.get('y', '?')}, {position.get('z', '?')})"
        )

    header = (
        "当前 Quest MR 空间摘要："
        f"mode={summary.get('mode') or 'unknown'}; "
        f"status={summary.get('status') or 'unknown'}; "
        f"surfaces={summary.get('surface_count', 0)}; "
        f"walkable={summary.get('walkable_count', 0)}; "
        f"occluders={summary.get('occluder_count', 0)}; "
        f"ground={summary.get('ground_source') or 'unknown'}."
    )
    if not surface_lines:
        return header
    return header + "\n前几个空间表面：\n" + "\n".join(surface_lines)


def _summarize_object_state(state: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(state, dict) or not state:
        return {}

    objects = state.get("objects")
    if not isinstance(objects, dict):
        objects = {}
    recent = state.get("recent")
    if not isinstance(recent, list):
        recent = []

    selected = []
    focused = []
    for object_id, obj in objects.items():
        if not isinstance(obj, dict):
            continue
        if obj.get("selected"):
            selected.append(_clean_text(obj.get("label") or object_id, object_id))
        if obj.get("focused"):
            focused.append(_clean_text(obj.get("label") or object_id, object_id))

    return {
        "object_count": len(objects),
        "recent_count": len(recent),
        "selected": selected[:5],
        "focused": focused[:5],
        "last_action": _clean_text(recent[-1].get("action")) if recent and isinstance(recent[-1], dict) else "",
        "last_semantic_action": _clean_text(recent[-1].get("semantic_action")) if recent and isinstance(recent[-1], dict) else "",
        "last_object_id": _clean_text(recent[-1].get("object_id")) if recent and isinstance(recent[-1], dict) else "",
        "last_label": _clean_text(recent[-1].get("label")) if recent and isinstance(recent[-1], dict) else "",
        "updated_at": _clean_text(state.get("updated_at")),
    }


def _object_state_context(state: Dict[str, Any]) -> str:
    summary = _summarize_object_state(state)
    if not summary:
        return ""

    objects = state.get("objects") if isinstance(state, dict) else {}
    if not isinstance(objects, dict):
        objects = {}
    recent = state.get("recent") if isinstance(state, dict) else []
    if not isinstance(recent, list):
        recent = []

    object_lines = []
    for object_id, obj in list(objects.items())[:8]:
        if not isinstance(obj, dict):
            continue
        label = _clean_text(obj.get("label") or object_id, object_id)
        object_type = _clean_text(obj.get("object_type"), "spatial_object")
        action = _clean_text(obj.get("last_action"), "none")
        semantic_action = _clean_text(obj.get("semantic_action"))
        state_flags = []
        if obj.get("selected"):
            state_flags.append("selected")
        if obj.get("focused"):
            state_flags.append("focused")
        flags = ",".join(state_flags) if state_flags else "idle"
        semantic = f", semantic={semantic_action}" if semantic_action else ""
        object_lines.append(f"- {label}: type={object_type}, state={flags}, last_action={action}{semantic}")

    recent_lines = []
    for item in recent[-5:]:
        if not isinstance(item, dict):
            continue
        label = _clean_text(item.get("label") or item.get("object_id"), "object")
        semantic_action = _clean_text(item.get("semantic_action"))
        semantic = f", semantic={semantic_action}" if semantic_action else ""
        recent_lines.append(
            "- "
            f"{label}: action={_clean_text(item.get('action'), 'unknown')}, "
            f"source={_clean_text(item.get('source'), 'quest3_unity')}"
            f"{semantic}"
        )

    text = (
        "当前 Quest 可交互物体摘要："
        f"objects={summary.get('object_count', 0)}; "
        f"selected={summary.get('selected') or []}; "
        f"focused={summary.get('focused') or []}; "
        f"last={summary.get('last_label') or summary.get('last_object_id') or 'none'} "
        f"{summary.get('last_action') or ''}."
    )
    if object_lines:
        text += "\n可操作物体：\n" + "\n".join(object_lines)
    if recent_lines:
        text += "\n最近物体操作：\n" + "\n".join(recent_lines)
    return text


def _new_verification_state() -> Dict[str, Any]:
    now = _now_iso()
    items = {}
    for key, label, requires_headset in VR_VERIFICATION_ITEMS:
        items[key] = {
            "key": key,
            "label": label,
            "status": "needs_headset" if requires_headset else "pending",
            "requires_headset": requires_headset,
            "evidence": "",
            "updated_at": "",
        }
    return {
        "items": items,
        "created_at": now,
        "updated_at": now,
    }


def _merge_verification_state(base: Dict[str, Any], persisted: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(base, dict) or not isinstance(persisted, dict):
        return base
    base_items = base.get("items") if isinstance(base.get("items"), dict) else {}
    persisted_items = persisted.get("items") if isinstance(persisted.get("items"), dict) else {}
    for key, _, _ in VR_VERIFICATION_ITEMS:
        current = base_items.get(key)
        saved = persisted_items.get(key)
        if not isinstance(current, dict) or not isinstance(saved, dict):
            continue
        saved_status = _clean_text(saved.get("status"))
        if saved_status not in {"observed", "needs_headset"}:
            continue
        current["status"] = saved_status
        current["evidence"] = _clean_text(saved.get("evidence"))
        current["updated_at"] = _clean_text(saved.get("updated_at"))
    base["updated_at"] = _clean_text(persisted.get("updated_at"), _clean_text(base.get("updated_at")))
    return base


def _load_persisted_verification_state() -> Dict[str, Any]:
    try:
        if not VR_VERIFICATION_STATE_FILE.is_file():
            return {}
        data = json.loads(VR_VERIFICATION_STATE_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception as exc:
        print(f"[VR] Failed to load verification state: {exc}")
        return {}


def _save_persisted_verification_state(verification: Dict[str, Any]) -> None:
    try:
        payload = _merge_verification_state(_new_verification_state(), verification)
        VR_VERIFICATION_STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
        VR_VERIFICATION_STATE_FILE.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except Exception as exc:
        print(f"[VR] Failed to save verification state: {exc}")


def _verification_summary(verification: Dict[str, Any]) -> Dict[str, Any]:
    state = verification if isinstance(verification, dict) else {}
    items = state.get("items") if isinstance(state.get("items"), dict) else {}
    ordered = []
    counts = {"observed": 0, "pending": 0, "needs_headset": 0}
    for key, _, _ in VR_VERIFICATION_ITEMS:
        item = items.get(key) if isinstance(items.get(key), dict) else {}
        status = _clean_text(item.get("status"), "pending")
        if status not in counts:
            status = "pending"
        counts[status] += 1
        ordered.append(
            {
                "key": key,
                "label": _clean_text(item.get("label"), key),
                "status": status,
                "requires_headset": bool(item.get("requires_headset")),
                "evidence": _clean_text(item.get("evidence")),
                "updated_at": _clean_text(item.get("updated_at")),
            }
        )
    return {
        "items": ordered,
        "counts": counts,
        "updated_at": _clean_text(state.get("updated_at")),
    }


def _safe_event_detail(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(k)[:80]: _safe_event_detail(v) for k, v in list(value.items())[:30]}
    if isinstance(value, list):
        return [_safe_event_detail(item) for item in value[:30]]
    if isinstance(value, (str, int, float, bool)) or value is None:
        text = str(value)
        return text[:500] if isinstance(value, str) else value
    return str(value)[:500]


def _is_headset_source(data: Dict[str, Any]) -> bool:
    if not isinstance(data, dict):
        return False
    source = _clean_text(data.get("source")).lower()
    device = _clean_text(data.get("device") or data.get("client") or data.get("input_mode")).lower()
    return "quest" in source or "quest" in device or source == "quest3_unity"


def _build_vr_chat_payload(
    *,
    conversation_id: str,
    text: str,
    history: List[Dict[str, Any]],
    data: Dict[str, Any],
    space_layout: Optional[Dict[str, Any]] = None,
    object_state: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    system_content = (
        "你正在通过 Meta Quest 3 的 VR/MR 空间界面与用户交流。"
        "回答要适合空间阅读：先给结论，段落短，必要时用清单。"
    )
    layout_context = _space_layout_context(space_layout or {})
    if layout_context:
        system_content += (
            "\n你可以参考下面的 MR 空间摘要来判断地面、桌面、墙面、遮挡和移动建议；"
            "不要声称看见未出现在摘要中的物体。\n"
            + layout_context
        )
    object_context = _object_state_context(object_state or {})
    if object_context:
        system_content += (
            "\n你也可以参考下面的可交互物体状态，理解用户刚刚选中、移动或激活的对象；"
            "不要把样例物体误说成真实世界物体。\n"
            + object_context
        )
    if _clean_text(data.get("input_mode")) == "object":
        object_label = _clean_text(data.get("object_label") or data.get("object_id"), "object")
        semantic_action = _clean_text(data.get("semantic_action"), "assistant_prompt")
        system_content += (
            "\n当前这轮对话由 Quest 空间物体激活触发："
            f"object={object_label}; semantic_action={semantic_action}。"
            "回答要把物体交互转化为明确下一步，而不只是说明事件已收到。"
        )

    messages = [
        {
            "role": "system",
            "content": system_content,
        }
    ]
    messages.extend(
        {
            "role": _clean_text(message.get("role"), "user"),
            "content": _clean_text(message.get("content")),
        }
        for message in history[-MAX_VR_CONVERSATION_MESSAGES:]
        if _clean_text(message.get("content"))
    )
    messages.append({"role": "user", "content": text})
    payload = {
        "model": _clean_text(data.get("model"), DEFAULT_VR_CHAT_MODEL),
        "messages": messages,
        "stream": True,
        "temperature": float(data.get("temperature", 0.7) or 0.7),
        "top_p": float(data.get("top_p", 1) or 1),
        "fileLinks": [],
        "asyncToolsID": [],
        "conversationId": conversation_id,
        "conversation_id": conversation_id,
        "enable_thinking": _as_bool(data.get("enable_thinking")),
        "enable_deep_research": _as_bool(data.get("enable_deep_research")),
        "enable_web_search": _as_bool(data.get("enable_web_search")),
    }
    max_tokens = data.get("max_tokens")
    if max_tokens is not None:
        try:
            payload["max_tokens"] = int(max_tokens)
        except (TypeError, ValueError):
            pass
    reasoning_effort = _clean_text(data.get("reasoning_effort"))
    if reasoning_effort:
        payload["reasoning_effort"] = reasoning_effort
    return payload


class VRDeviceInfo(BaseModel):
    type: str = "quest3"
    name: str = "Quest 3"
    client: str = "webxr"
    client_version: str = "0.1.0"


class VRCapabilities(BaseModel):
    mr: bool = True
    hand_tracking: bool = True
    controllers: bool = True
    voice_input: bool = False
    webrtc: bool = False


class VRHardwareCapability(BaseModel):
    available: bool = False
    status: str = "unknown"
    label: str = ""
    details: Dict[str, Any] = Field(default_factory=dict)


class VRHardwareReport(BaseModel):
    headset_tracking: VRHardwareCapability = Field(default_factory=VRHardwareCapability)
    controllers: VRHardwareCapability = Field(default_factory=VRHardwareCapability)
    hand_tracking: VRHardwareCapability = Field(default_factory=VRHardwareCapability)
    passthrough_camera: VRHardwareCapability = Field(default_factory=VRHardwareCapability)
    depth_api: VRHardwareCapability = Field(default_factory=VRHardwareCapability)
    scene_mesh: VRHardwareCapability = Field(default_factory=VRHardwareCapability)
    microphone: VRHardwareCapability = Field(default_factory=VRHardwareCapability)
    spatial_audio: VRHardwareCapability = Field(default_factory=VRHardwareCapability)
    raw_lidar_or_radar: VRHardwareCapability = Field(default_factory=VRHardwareCapability)


class VRSessionCreateRequest(BaseModel):
    device: VRDeviceInfo = Field(default_factory=VRDeviceInfo)
    capabilities: VRCapabilities = Field(default_factory=VRCapabilities)
    pairing_code: str = ""


class VRDeviceHeartbeatRequest(BaseModel):
    session_id: str = ""
    device: VRDeviceInfo = Field(default_factory=VRDeviceInfo)
    capabilities: VRCapabilities = Field(default_factory=VRCapabilities)
    hardware: VRHardwareReport = Field(default_factory=VRHardwareReport)
    runtime: Dict[str, Any] = Field(default_factory=dict)
    client_sent_at: str = ""


class VRTaskCreateRequest(BaseModel):
    session_id: str
    title: str
    description: str = ""
    agent_type: str = "default"
    start_immediately: bool = False
    source: str = "quest3"


class VRWorldGenSceneCreateRequest(BaseModel):
    session_id: str = ""
    prompt: str
    mode: str = "t2s"
    return_mesh: bool = True
    use_sharp: bool = False
    inpaint_bg: bool = False
    resolution: int = 1600
    low_vram: Optional[bool] = None
    source: str = "openxnet"


class VRAvatarMotionRequest(BaseModel):
    session_id: str
    motion: str
    source: str = "desktop"
    reason: str = "manual"
    mirror: Optional[bool] = None
    yaw_degrees: Optional[float] = None
    max_seconds: Optional[float] = None
    suppress_repeat: Optional[bool] = None


class VRSessionStore:
    def __init__(self) -> None:
        self._sessions: Dict[str, Dict[str, Any]] = {}
        self._conversations: Dict[str, Dict[str, List[Dict[str, Any]]]] = {}
        self._lock = asyncio.Lock()

    async def create(
        self,
        *,
        request: Request,
        device: Dict[str, Any],
        capabilities: Dict[str, Any],
        pairing_code: str = "",
    ) -> Dict[str, Any]:
        await self.prune()
        session_id = f"vr_sess_{uuid.uuid4().hex[:18]}"
        created_at = datetime.now()
        expires_at = created_at + timedelta(hours=2)
        ws_url = self._build_ws_url(request, session_id)
        session = {
            "session_id": session_id,
            "user_id": "local",
            "device": device,
            "capabilities": capabilities,
            "pairing_code_hint": pairing_code[-2:] if pairing_code else "",
            "event_ws_url": ws_url,
            "created_at": created_at.isoformat(),
            "last_seen_at": created_at.isoformat(),
            "expires_at": expires_at.isoformat(),
            "space_layout": {},
            "object_state": {
                "objects": {},
                "recent": [],
                "updated_at": "",
            },
            "diagnostics": [],
            "verification": _merge_verification_state(
                _new_verification_state(),
                _load_persisted_verification_state(),
            ),
        }
        async with self._lock:
            self._sessions[session_id] = session
            self._conversations[session_id] = {}
            self._mark_verified_locked(
                session,
                "gateway_session",
                "Created VR session through REST API.",
                allow_headset_item=True,
            )
        return session

    def _build_ws_url(self, request: Request, session_id: str) -> str:
        scheme = "wss" if request.url.scheme == "https" else "ws"
        host = request.headers.get("host") or request.url.netloc
        return f"{scheme}://{host}/ws/vr/events?session_id={session_id}"

    async def get(self, session_id: str) -> Optional[Dict[str, Any]]:
        await self.prune()
        async with self._lock:
            session = self._sessions.get(session_id)
            if session:
                session["last_seen_at"] = _now_iso()
            return session

    async def update_layout(self, session_id: str, layout: Dict[str, Any]) -> None:
        async with self._lock:
            session = self._sessions.get(session_id)
            if session is not None:
                saved_at = _now_iso()
                next_layout = dict(layout) if isinstance(layout, dict) else {}
                next_layout["saved_at"] = saved_at
                session["space_layout"] = next_layout
                session["last_seen_at"] = saved_at
                self._mark_verified_locked(
                    session,
                    "space_layout_protocol",
                    f"Received space.layout.update from {_clean_text(layout.get('source'), 'client')}.",
                    allow_headset_item=_is_headset_source(layout),
                )
                if _is_headset_source(layout):
                    self._mark_verified_locked(
                        session,
                        "mruk_space_layout",
                        "Received headset-originated space layout update.",
                        allow_headset_item=True,
                    )

    async def update_object_catalog(self, session_id: str, catalog: Dict[str, Any]) -> Dict[str, Any]:
        async with self._lock:
            session = self._sessions.get(session_id)
            if session is None:
                return {}

            now = _now_iso()
            state = session.setdefault("object_state", {"objects": {}, "recent": [], "updated_at": ""})
            objects = state.setdefault("objects", {})
            items = catalog.get("objects") if isinstance(catalog, dict) else []
            if not isinstance(items, list):
                items = []

            for item in items[:100]:
                if not isinstance(item, dict):
                    continue
                object_id = _clean_text(item.get("object_id") or item.get("id"))
                if not object_id:
                    continue
                current = objects.setdefault(object_id, {})
                current.update(
                    {
                        "object_id": object_id,
                        "label": _clean_text(item.get("label"), object_id),
                        "object_type": _clean_text(item.get("object_type"), "spatial_object"),
                        "semantic_action": _clean_text(item.get("semantic_action") or current.get("semantic_action")),
                        "semantic_prompt": _clean_text(item.get("semantic_prompt") or current.get("semantic_prompt")),
                        "task_title": _clean_text(item.get("task_title") or current.get("task_title")),
                        "task_agent_type": _clean_text(item.get("task_agent_type") or current.get("task_agent_type"), "default"),
                        "start_task_immediately": _as_bool(
                            item.get("start_task_immediately"),
                            default=bool(current.get("start_task_immediately")),
                        ),
                        "position": item.get("position") if isinstance(item.get("position"), dict) else current.get("position", {}),
                        "rotation": item.get("rotation") if isinstance(item.get("rotation"), dict) else current.get("rotation", {}),
                        "catalog_seen_at": now,
                    }
                )

            state["updated_at"] = now
            session["last_seen_at"] = now
            self._mark_verified_locked(
                session,
                "object_catalog",
                f"Received object catalog with {len(items[:100])} candidates.",
                allow_headset_item=_is_headset_source(catalog),
            )
            return _summarize_object_state(state)

    async def record_object_interaction(self, session_id: str, interaction: Dict[str, Any]) -> Dict[str, Any]:
        async with self._lock:
            session = self._sessions.get(session_id)
            if session is None:
                return {}

            now = _now_iso()
            state = session.setdefault("object_state", {"objects": {}, "recent": [], "updated_at": ""})
            objects = state.setdefault("objects", {})
            recent = state.setdefault("recent", [])

            object_id = _clean_text(interaction.get("object_id"), "unknown")
            action = _clean_text(interaction.get("action"), "unknown")
            item = {
                "object_id": object_id,
                "label": _clean_text(interaction.get("label"), object_id),
                "object_type": _clean_text(interaction.get("object_type"), "spatial_object"),
                "semantic_action": _clean_text(interaction.get("semantic_action")),
                "semantic_prompt": _clean_text(interaction.get("semantic_prompt")),
                "task_title": _clean_text(interaction.get("task_title")),
                "task_agent_type": _clean_text(interaction.get("task_agent_type"), "default"),
                "start_task_immediately": _as_bool(interaction.get("start_task_immediately")),
                "action": action,
                "source": _clean_text(interaction.get("source"), "quest3_unity"),
                "hand_or_controller": _clean_text(interaction.get("hand_or_controller")),
                "strength": interaction.get("strength", 1.0),
                "position": interaction.get("position") if isinstance(interaction.get("position"), dict) else {},
                "rotation": interaction.get("rotation") if isinstance(interaction.get("rotation"), dict) else {},
                "client_sent_at": _clean_text(interaction.get("client_sent_at")),
                "saved_at": now,
            }
            recent.append(item)
            if len(recent) > 40:
                state["recent"] = recent[-40:]
                recent = state["recent"]

            current = objects.setdefault(object_id, {})
            current.update(
                {
                    "object_id": object_id,
                    "label": item["label"],
                    "object_type": item["object_type"],
                    "semantic_action": item["semantic_action"] or current.get("semantic_action", ""),
                    "semantic_prompt": item["semantic_prompt"] or current.get("semantic_prompt", ""),
                    "task_title": item["task_title"] or current.get("task_title", ""),
                    "task_agent_type": item["task_agent_type"] or current.get("task_agent_type", "default"),
                    "start_task_immediately": item["start_task_immediately"] or bool(current.get("start_task_immediately")),
                    "last_action": action,
                    "last_source": item["source"],
                    "last_interaction_at": now,
                    "position": item["position"] or current.get("position", {}),
                    "rotation": item["rotation"] or current.get("rotation", {}),
                    "selected": action in {"select", "select.entered"},
                    "focused": action in {"focus", "hover.entered", "select", "select.entered", "activate", "move"},
                }
            )
            if action in {"release", "select.exited"}:
                current["selected"] = False
            if action in {"focus.lost", "hover.exited"}:
                current["focused"] = False

            state["updated_at"] = now
            session["last_seen_at"] = now
            source_is_headset = _is_headset_source(interaction)
            self._mark_verified_locked(
                session,
                "object_interaction",
                f"Received object interaction {action} for {object_id}.",
                allow_headset_item=source_is_headset,
            )
            if source_is_headset and action in {"focus", "select", "release", "activate", "move", "hover.entered", "select.entered"}:
                self._mark_verified_locked(
                    session,
                    "xri_object_targeting",
                    f"Headset object targeting event {action} for {object_id}.",
                    allow_headset_item=True,
                )
            return {
                "interaction": item,
                "object": dict(current),
                "summary": _summarize_object_state(state),
            }

    async def record_diagnostic(
        self,
        session_id: str,
        category: str,
        data: Dict[str, Any],
    ) -> Dict[str, Any]:
        async with self._lock:
            session = self._sessions.get(session_id)
            if session is None:
                return {}

            now = _now_iso()
            item = {
                "category": _clean_text(category, "diagnostic"),
                "stage": _clean_text(data.get("stage"), "unknown"),
                "message": _clean_text(data.get("message")),
                "source": _clean_text(data.get("source"), "quest3_unity"),
                "client_sent_at": _clean_text(data.get("client_sent_at")),
                "saved_at": now,
                "detail": _safe_event_detail(data.get("detail") if isinstance(data.get("detail"), (dict, list)) else {}),
            }
            diagnostics = session.setdefault("diagnostics", [])
            diagnostics.append(item)
            if len(diagnostics) > 30:
                session["diagnostics"] = diagnostics[-30:]
            session["last_seen_at"] = now
            return item

    async def mark_verified(
        self,
        session_id: str,
        key: str,
        evidence: str,
        *,
        allow_headset_item: bool = False,
    ) -> None:
        async with self._lock:
            session = self._sessions.get(session_id)
            if session is not None:
                self._mark_verified_locked(session, key, evidence, allow_headset_item=allow_headset_item)

    async def mark_needs_headset(self, session_id: str, key: str, evidence: str) -> None:
        async with self._lock:
            session = self._sessions.get(session_id)
            if session is not None:
                self._mark_needs_headset_locked(session, key, evidence)

    def _mark_verified_locked(
        self,
        session: Dict[str, Any],
        key: str,
        evidence: str,
        *,
        allow_headset_item: bool = False,
    ) -> None:
        verification = session.setdefault("verification", _new_verification_state())
        items = verification.setdefault("items", {})
        item = items.get(key)
        if not isinstance(item, dict):
            return
        if item.get("requires_headset") and not allow_headset_item:
            if item.get("status") != "observed":
                item["status"] = "needs_headset"
                item["evidence"] = _clean_text(evidence)
                item["updated_at"] = _now_iso()
                verification["updated_at"] = item["updated_at"]
            return
        item["status"] = "observed"
        item["evidence"] = _clean_text(evidence)
        item["updated_at"] = _now_iso()
        verification["updated_at"] = item["updated_at"]
        _save_persisted_verification_state(verification)

    def _mark_needs_headset_locked(self, session: Dict[str, Any], key: str, evidence: str) -> None:
        verification = session.setdefault("verification", _new_verification_state())
        items = verification.setdefault("items", {})
        item = items.get(key)
        if not isinstance(item, dict):
            return
        item["status"] = "needs_headset"
        item["evidence"] = _clean_text(evidence)
        item["updated_at"] = _now_iso()
        verification["updated_at"] = item["updated_at"]
        _save_persisted_verification_state(verification)

    async def prune(self) -> None:
        now = datetime.now()
        async with self._lock:
            expired = []
            for session_id, session in self._sessions.items():
                try:
                    expires_at = datetime.fromisoformat(str(session.get("expires_at") or ""))
                except ValueError:
                    expired.append(session_id)
                    continue
                if expires_at <= now:
                    expired.append(session_id)
            for session_id in expired:
                self._sessions.pop(session_id, None)
                self._conversations.pop(session_id, None)

    async def get_conversation_messages(
        self,
        session_id: str,
        conversation_id: str,
    ) -> List[Dict[str, Any]]:
        async with self._lock:
            session_conversations = self._conversations.get(session_id) or {}
            return [dict(message) for message in session_conversations.get(conversation_id, [])]

    async def append_conversation_turn(
        self,
        session_id: str,
        conversation_id: str,
        *,
        user_text: str,
        assistant_text: str,
    ) -> None:
        user_text = _clean_text(user_text)
        assistant_text = _clean_text(assistant_text)
        if not user_text and not assistant_text:
            return
        async with self._lock:
            session_conversations = self._conversations.setdefault(session_id, {})
            messages = session_conversations.setdefault(conversation_id, [])
            if user_text:
                messages.append({"role": "user", "content": user_text})
            if assistant_text:
                messages.append({"role": "assistant", "content": assistant_text})
            if len(messages) > MAX_VR_CONVERSATION_MESSAGES:
                session_conversations[conversation_id] = messages[-MAX_VR_CONVERSATION_MESSAGES:]

    async def latest_diagnostics(self, session_id: str = "", limit: int = 30) -> List[Dict[str, Any]]:
        async with self._lock:
            session = self._sessions.get(_clean_text(session_id)) if session_id else None
            if session is None and self._sessions:
                session = max(
                    self._sessions.values(),
                    key=lambda item: _clean_text(item.get("last_seen_at")),
                )
            diagnostics = session.get("diagnostics") if isinstance(session, dict) else []
            if not isinstance(diagnostics, list):
                return []
            return [dict(item) for item in diagnostics[-max(1, limit):] if isinstance(item, dict)]


vr_session_store = VRSessionStore()


class VRWebSocketHub:
    def __init__(self) -> None:
        self._connections: Dict[str, List[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def register(self, session_id: str, websocket: WebSocket) -> None:
        async with self._lock:
            sockets = self._connections.setdefault(session_id, [])
            if websocket not in sockets:
                sockets.append(websocket)

    async def unregister(self, session_id: str, websocket: WebSocket) -> None:
        async with self._lock:
            sockets = self._connections.get(session_id)
            if not sockets:
                return
            if websocket in sockets:
                sockets.remove(websocket)
            if not sockets:
                self._connections.pop(session_id, None)

    async def broadcast(self, session_id: str, message: Dict[str, Any]) -> int:
        async with self._lock:
            sockets = list(self._connections.get(session_id) or [])

        sent = 0
        stale: List[WebSocket] = []
        payload = json.dumps(message, ensure_ascii=False)
        for websocket in sockets:
            try:
                await websocket.send_text(payload)
                sent += 1
            except Exception:
                stale.append(websocket)

        for websocket in stale:
            await self.unregister(session_id, websocket)
        return sent


vr_websocket_hub = VRWebSocketHub()


def _empty_device_status() -> Dict[str, Any]:
    return {
        "connected": False,
        "last_seen_at": "",
        "age_seconds": None,
        "stale_after_seconds": VR_DEVICE_HEARTBEAT_TTL_SECONDS,
        "session_id": "",
        "session_valid": False,
        "name": "",
        "model": "",
        "device": {},
        "capabilities": {},
        "hardware": {},
        "runtime": {},
    }


async def _get_latest_device_status() -> Dict[str, Any]:
    async with _device_heartbeat_lock:
        heartbeat = dict(_latest_device_heartbeat)

    if not heartbeat:
        return _empty_device_status()

    last_seen = _parse_iso_datetime(heartbeat.get("last_seen_at"))
    age_seconds = None
    connected = False
    if last_seen is not None:
        age_seconds = max(0, int((datetime.now() - last_seen).total_seconds()))
        connected = age_seconds <= VR_DEVICE_HEARTBEAT_TTL_SECONDS

    status = _empty_device_status()
    status.update(heartbeat)
    status["connected"] = connected
    status["age_seconds"] = age_seconds
    status["stale_after_seconds"] = VR_DEVICE_HEARTBEAT_TTL_SECONDS
    return status


async def _store_device_heartbeat(req: VRDeviceHeartbeatRequest) -> Dict[str, Any]:
    session_id = _clean_text(req.session_id)
    session = await vr_session_store.get(session_id) if session_id else None
    runtime = req.runtime if isinstance(req.runtime, dict) else {}
    device = req.device.model_dump()
    hardware = req.hardware.model_dump()
    now = _now_iso()

    payload = {
        "connected": True,
        "last_seen_at": now,
        "age_seconds": 0,
        "stale_after_seconds": VR_DEVICE_HEARTBEAT_TTL_SECONDS,
        "session_id": session_id,
        "session_valid": bool(session),
        "name": _clean_text(device.get("name"), "Meta Quest 3"),
        "model": _clean_text(runtime.get("device_model") or device.get("type"), "quest3"),
        "device": device,
        "capabilities": req.capabilities.model_dump(),
        "hardware": hardware,
        "runtime": runtime,
        "client_sent_at": _clean_text(req.client_sent_at),
    }

    async with _device_heartbeat_lock:
        _latest_device_heartbeat.clear()
        _latest_device_heartbeat.update(payload)

    if session_id and session:
        await vr_session_store.mark_verified(
            session_id,
            "device_heartbeat",
            "Received Quest device heartbeat.",
            allow_headset_item=True,
        )
        if bool(hardware.get("microphone", {}).get("available")):
            await vr_session_store.mark_verified(
                session_id,
                "voice_asr_loop",
                "Heartbeat reports an available Quest microphone; ASR loop still needs spoken-input event confirmation.",
                allow_headset_item=False,
            )

    return payload


async def _workspace_dir() -> str:
    try:
        settings = await load_settings()
    except Exception:
        return ""
    return _clean_text((settings.get("CLISettings") or {}).get("cc_path"))


async def _require_session(session_id: str) -> Dict[str, Any]:
    session = await vr_session_store.get(_clean_text(session_id))
    if not session:
        raise HTTPException(status_code=404, detail="INVALID_SESSION")
    return session


async def _remember_worldgen_job(scene_id: str, job: Dict[str, Any]) -> None:
    async with _worldgen_jobs_lock:
        _worldgen_jobs[scene_id] = job
        session_id = _clean_text(job.get("session_id"))
        manifest = job.get("manifest") if isinstance(job.get("manifest"), dict) else {}
        if _clean_text(job.get("status")) == "ready" and manifest:
            _latest_worldgen_scene.clear()
            _latest_worldgen_scene.update(dict(manifest))
            if session_id:
                _latest_worldgen_scene_by_session[session_id] = dict(manifest)


async def _get_worldgen_job(scene_id: str) -> Dict[str, Any]:
    async with _worldgen_jobs_lock:
        return dict(_worldgen_jobs.get(scene_id) or {})


async def _get_latest_worldgen_scene(session_id: str) -> Dict[str, Any]:
    async with _worldgen_jobs_lock:
        manifest = dict(_latest_worldgen_scene_by_session.get(session_id) or {})
        replay_scope = "session"
        if not manifest:
            manifest = dict(_latest_worldgen_scene)
            replay_scope = "recent"
        if not manifest:
            return {}
        updated_at = _parse_iso_datetime(manifest.get("updated_at"))
        if updated_at and datetime.now() - updated_at > timedelta(seconds=WORLDGEN_REPLAY_TTL_SECONDS):
            return {}
        manifest["_replay_scope"] = replay_scope
        return manifest


def _worldgen_request_from_payload(
    req: VRWorldGenSceneCreateRequest,
    *,
    source: str = "",
) -> WorldGenSceneRequest:
    return WorldGenSceneRequest(
        prompt=_clean_text(req.prompt),
        mode=_clean_text(req.mode, "t2s"),
        return_mesh=True,
        use_sharp=bool(req.use_sharp),
        inpaint_bg=bool(req.inpaint_bg),
        resolution=max(512, min(int(req.resolution or 1600), 4096)),
        low_vram=req.low_vram,
        source=_clean_text(source or req.source, "openxnet"),
    )


def _worldgen_scene_event_data(manifest: Dict[str, Any]) -> Dict[str, Any]:
    assets = manifest.get("assets") if isinstance(manifest.get("assets"), dict) else {}
    mesh = assets.get("mesh") if isinstance(assets.get("mesh"), dict) else {}
    preview = assets.get("preview") if isinstance(assets.get("preview"), dict) else {}
    return {
        "scene_id": _clean_text(manifest.get("scene_id")),
        "prompt": _clean_text(manifest.get("prompt")),
        "status": _clean_text(manifest.get("status"), "unknown"),
        "backend": _clean_text(manifest.get("backend")),
        "message": _clean_text(manifest.get("message")),
        "error": manifest.get("error") if isinstance(manifest.get("error"), dict) else {},
        "manifest_url": _clean_text(manifest.get("manifest_url")),
        "mesh_url": _clean_text(mesh.get("url")),
        "preview_url": _clean_text(preview.get("url")),
        "placement": manifest.get("placement") if isinstance(manifest.get("placement"), dict) else {},
        "interaction": manifest.get("interaction") if isinstance(manifest.get("interaction"), dict) else {},
        "source": "worldgen",
        "updated_at": _clean_text(manifest.get("updated_at"), _now_iso()),
    }


async def _broadcast_worldgen_scene(
    session_id: str,
    manifest: Dict[str, Any],
    *,
    correlation_id: str = "",
) -> int:
    if not session_id:
        return 0
    return await vr_websocket_hub.broadcast(
        session_id,
        _event(
            "scene.generated",
            session_id=session_id,
            correlation_id=correlation_id,
            data=_worldgen_scene_event_data(manifest),
        ),
    )


async def _broadcast_avatar_motion(
    session_id: str,
    motion: str,
    *,
    source: str = "desktop",
    reason: str = "manual",
    mirror: Optional[bool] = None,
    yaw_degrees: Optional[float] = None,
    max_seconds: Optional[float] = None,
    suppress_repeat: Optional[bool] = None,
    correlation_id: str = "",
) -> int:
    if not session_id:
        return 0
    data = {
        "motion": _clean_text(motion),
        "source": _clean_text(source, "desktop"),
        "reason": _clean_text(reason, "manual"),
    }
    if mirror is not None:
        data["mirror"] = bool(mirror)
    if yaw_degrees is not None:
        data["yaw_degrees"] = max(-180.0, min(float(yaw_degrees), 180.0))
    if max_seconds is not None:
        data["max_seconds"] = max(0.0, min(float(max_seconds), 30.0))
    if suppress_repeat is not None:
        data["suppress_repeat"] = bool(suppress_repeat)
    return await vr_websocket_hub.broadcast(
        session_id,
        _event(
            "avatar.motion",
            session_id=session_id,
            correlation_id=correlation_id,
            data=data,
        ),
    )


async def _run_worldgen_job(
    scene_request: WorldGenSceneRequest,
    *,
    session_id: str,
    base_url: str,
    correlation_id: str = "",
) -> Dict[str, Any]:
    if not _clean_text(scene_request.scene_id):
        prepare_scene(scene_request, base_url=base_url)
    await _remember_worldgen_job(
        scene_request.scene_id,
        {
            "scene_id": scene_request.scene_id,
            "session_id": session_id,
            "prompt": scene_request.prompt,
            "status": "running",
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
        },
    )
    manifest = await generate_scene(scene_request, base_url=base_url)
    await _remember_worldgen_job(
        scene_request.scene_id,
        {
            "scene_id": scene_request.scene_id,
            "session_id": session_id,
            "prompt": scene_request.prompt,
            "status": _clean_text(manifest.get("status"), "unknown"),
            "manifest": manifest,
            "updated_at": _now_iso(),
        },
    )
    await _broadcast_worldgen_scene(session_id, manifest, correlation_id=correlation_id)
    return manifest


def _looks_like_scene_generation_request(text: str) -> bool:
    lowered = _clean_text(text).lower()
    if not lowered:
        return False
    verbs = ("生成", "创建", "造", "做", "create", "generate", "build", "make")
    nouns = ("场景", "世界", "空间", "3d", "三维", "world", "scene", "environment", "worldgen")
    return any(verb in lowered for verb in verbs) and any(noun in lowered for noun in nouns)


async def _start_worldgen_from_chat(
    websocket: WebSocket,
    *,
    session_id: str,
    correlation_id: str,
    data: Dict[str, Any],
    text: str,
) -> bool:
    if not worldgen_feature_enabled():
        return False
    if not _looks_like_scene_generation_request(text):
        return False

    base_url = _clean_text(data.get("base_url")) or _connection_origin(websocket)
    req = VRWorldGenSceneCreateRequest(
        session_id=session_id,
        prompt=text,
        source=_clean_text(data.get("source"), "quest3_unity_chat"),
    )
    scene_request = _worldgen_request_from_payload(req, source=req.source)
    queued_manifest = prepare_scene(scene_request, base_url=base_url)
    await _remember_worldgen_job(
        scene_request.scene_id,
        {
            "scene_id": scene_request.scene_id,
            "session_id": session_id,
            "prompt": scene_request.prompt,
            "status": "queued",
            "manifest": queued_manifest,
            "updated_at": _now_iso(),
        },
    )
    await _send_event(
        websocket,
        _event(
            "assistant.delta",
            session_id=session_id,
            correlation_id=correlation_id,
            data={
                "conversation_id": _clean_text(data.get("conversation_id"), "vr_conv_default"),
                "text": f"我开始用 WorldGen 生成 3D 场景：{text}",
                "source": "worldgen",
            },
        ),
    )
    await _send_event(
        websocket,
        _event(
            "scene.generation.started",
            session_id=session_id,
            correlation_id=correlation_id,
            data=_worldgen_scene_event_data(queued_manifest),
        ),
    )
    asyncio.create_task(
        _run_worldgen_job(
            scene_request,
            session_id=session_id,
            base_url=base_url,
            correlation_id=correlation_id,
        )
    )
    return True


def _build_profile(session: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "user": {
            "id": session.get("user_id") or "local",
            "display_name": "OpenXnet User",
        },
        "assistant": {
            "id": "default",
            "name": "OpenXnet",
            "role": "default_assistant",
        },
        "avatar": _build_avatar(),
        "ui": {
            "language": "zh-CN",
            "theme": "system",
            "default_panels": ["chat", "tasks", "memory"],
        },
        "space": _summarize_space_layout(session.get("space_layout") or {}),
        "objects": _summarize_object_state(session.get("object_state") or {}),
        "verification": _verification_summary(session.get("verification") or {}),
        "diagnostics": list((session.get("diagnostics") or [])[-30:]),
    }


def _build_avatar() -> Dict[str, Any]:
    states = ["idle", "listening", "thinking", "speaking", "error"]
    return {
        "id": "default_vrm",
        "type": "vrm",
        "name": "OpenXnet Avatar",
        "url": "/vrm/Alice.vrm",
        "fallback_url": "/vrm/Bob.vrm",
        "states": states,
        "state_map": {
            "idle": {"animation": "idle", "tone": "calm"},
            "listening": {"animation": "listen", "tone": "green"},
            "thinking": {"animation": "thinking", "tone": "amber"},
            "speaking": {"animation": "talk", "tone": "blue"},
            "error": {"animation": "shake_head", "tone": "red"},
        },
    }


def _task_card_from_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    status = _clean_text(payload.get("status"), "pending").lower()
    try:
        progress = int(payload.get("progress", 0) or 0)
    except (TypeError, ValueError):
        progress = 0
    progress = max(0, min(100, progress))
    summary = _clean_text(
        payload.get("summary")
        or payload.get("result_preview")
        or payload.get("last_result_preview")
        or payload.get("description"),
        "等待 OpenXnet 处理。",
    )
    return {
        "task_id": _clean_text(payload.get("task_id")),
        "title": _clean_text(payload.get("title"), "未命名任务"),
        "description": _clean_text(payload.get("description")),
        "status": status,
        "progress": progress,
        "agent_type": _clean_text(payload.get("agent_type"), "default"),
        "summary": summary,
        "last_event": _clean_text(payload.get("last_event") or summary),
        "created_at": _clean_text(payload.get("created_at")),
        "updated_at": _clean_text(payload.get("updated_at") or payload.get("created_at")),
        "is_resumable": bool(payload.get("is_resumable")),
    }


async def _list_task_cards(limit: int = 20) -> List[Dict[str, Any]]:
    workspace_dir = await _workspace_dir()
    if not workspace_dir:
        return []
    task_center = await get_task_center(workspace_dir)
    tasks = await task_center.list_tasks()
    cards = [
        _task_card_from_payload(task_center.serialize_task(task))
        for task in tasks[: max(1, min(limit, 50))]
    ]
    return cards


async def _get_task_card(task_id: str) -> Optional[Dict[str, Any]]:
    workspace_dir = await _workspace_dir()
    if not workspace_dir:
        return None
    task_center = await get_task_center(workspace_dir)
    task = await task_center.get_task(task_id)
    if not task:
        return None
    payload = task_center.serialize_task(task)
    card = _task_card_from_payload(payload)
    card["result_preview"] = _clean_text(
        payload.get("result")
        or payload.get("last_result_preview")
        or payload.get("summary")
    )
    card["recent_trace_excerpt"] = payload.get("recent_trace_excerpt") or []
    card["failure_summary"] = payload.get("failure_summary")
    card["recovery_suggestions"] = payload.get("recovery_suggestions") or []
    return card


async def _create_vr_task(req: VRTaskCreateRequest) -> Dict[str, Any]:
    session = await _require_session(req.session_id)
    workspace_dir = await _workspace_dir()
    if not workspace_dir:
        raise HTTPException(status_code=400, detail="NO_WORKSPACE_CONFIGURED")

    task_center = await get_task_center(workspace_dir)
    context = {
        "created_from": "quest3_vr",
        "source": _clean_text(req.source, "quest3"),
        "vr_session_id": session["session_id"],
        "vr_device": session.get("device") or {},
        "vr_capabilities": session.get("capabilities") or {},
        "start_immediately_requested": bool(req.start_immediately),
    }
    task = await task_center.create_task(
        title=_clean_text(req.title, "Quest 3 空间任务"),
        description=_clean_text(req.description, req.title),
        agent_type=_clean_text(req.agent_type, "default"),
        parent_task_id="QUEST3_VR",
        context=context,
    )
    if req.start_immediately:
        task = await task_center.start_task(task.task_id, trigger_source="quest3_vr") or task
    return _task_card_from_payload(task_center.serialize_task(task))


def _memory_item_from_task(card: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": f"task_{card.get('task_id')}",
        "type": "task_summary",
        "title": card.get("title") or "OpenXnet 任务",
        "summary": card.get("summary") or card.get("last_event") or "",
        "source": "task_center",
        "updated_at": card.get("updated_at") or _now_iso(),
    }


def _event(
    event_type: str,
    *,
    session_id: str = "",
    event_id: Optional[str] = None,
    correlation_id: str = "",
    data: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    payload = {
        "type": event_type,
        "event_id": event_id or _event_id(),
        "timestamp": _now_iso(),
        "data": data or {},
    }
    if session_id:
        payload["session_id"] = session_id
    if correlation_id:
        payload["correlation_id"] = correlation_id
    return payload


async def _send_event(websocket: WebSocket, message: Dict[str, Any]) -> None:
    await websocket.send_text(json.dumps(message, ensure_ascii=False))


async def _send_error(
    websocket: WebSocket,
    *,
    code: str,
    message: str,
    correlation_id: str = "",
    session_id: str = "",
) -> None:
    await _send_event(
        websocket,
        _event(
            "error",
            session_id=session_id,
            correlation_id=correlation_id,
            data={"code": code, "message": message},
        ),
    )


def _chat_error_message(exc: Exception) -> str:
    detail = _clean_text(str(exc), "真实聊天流暂不可用。")
    if "model_not_found" in detail or "No available channel for model" in detail:
        return (
            "真实聊天流已连接到 Desktop Gateway，但上游模型通道不可用。"
            "请在桌面端模型设置中选择当前账号可用的模型后重试。"
        )
    if "empty chat stream" in detail:
        return "真实聊天流没有返回内容，请检查桌面端模型服务。"
    if "chat endpoint failed" in detail:
        return "Desktop /v1/chat/completions 返回错误，请检查桌面端模型配置。"
    return detail[:500]


def _build_mock_answer(text: str) -> str:
    cleaned = _clean_text(text, "你好，我已连接 OpenXnet VR Gateway。")
    return (
        f"我已收到你的 Quest 3 空间指令：{cleaned}\n\n"
        "当前 VR Gateway 已经支持会话、任务卡片、Avatar 状态和 WebSocket 事件流。"
        "下一步可以把这条通道接入 OpenXnet 正式聊天流与 Unity/WebXR 客户端。"
    )


async def _stream_mock_chat(
    websocket: WebSocket,
    *,
    session_id: str,
    correlation_id: str,
    conversation_id: str,
    text: str,
) -> None:
    await _send_event(
        websocket,
        _event(
            "avatar.state",
            session_id=session_id,
            correlation_id=correlation_id,
            data={"state": "thinking", "reason": "chat_received"},
        ),
    )
    await asyncio.sleep(0.15)
    answer = _build_mock_answer(text)
    await _send_event(
        websocket,
        _event(
            "avatar.state",
            session_id=session_id,
            correlation_id=correlation_id,
            data={"state": "speaking", "reason": "assistant_streaming"},
        ),
    )
    chunk_size = 22
    for index in range(0, len(answer), chunk_size):
        await _send_event(
            websocket,
            _event(
                "assistant.delta",
                session_id=session_id,
                correlation_id=correlation_id,
                data={
                    "conversation_id": conversation_id,
                    "text": answer[index : index + chunk_size],
                },
            ),
        )
        await asyncio.sleep(0.04)
    await _send_event(
        websocket,
        _event(
            "assistant.done",
            session_id=session_id,
            correlation_id=correlation_id,
            data={
                "conversation_id": conversation_id,
                "message_id": f"msg_{uuid.uuid4().hex[:12]}",
                "finish_reason": "stop",
            },
        ),
    )
    await _send_event(
        websocket,
        _event(
            "avatar.state",
            session_id=session_id,
            correlation_id=correlation_id,
            data={"state": "idle", "reason": "assistant_done"},
        ),
    )


async def _stream_real_chat(
    websocket: WebSocket,
    *,
    session_id: str,
    correlation_id: str,
    conversation_id: str,
    text: str,
    data: Dict[str, Any],
) -> str:
    history = await vr_session_store.get_conversation_messages(session_id, conversation_id)
    session = await vr_session_store.get(session_id) or {}
    payload = _build_vr_chat_payload(
        conversation_id=conversation_id,
        text=text,
        history=history,
        data=data,
        space_layout=session.get("space_layout") if isinstance(session, dict) else {},
        object_state=session.get("object_state") if isinstance(session, dict) else {},
    )
    base_url = _clean_text(data.get("base_url")) or _normalize_chat_base_url(websocket)

    await _send_event(
        websocket,
        _event(
            "avatar.state",
            session_id=session_id,
            correlation_id=correlation_id,
            data={"state": "thinking", "reason": "chat_received"},
        ),
    )

    assistant_text = ""
    has_spoken = False
    timeout = httpx.Timeout(connect=8.0, read=120.0, write=20.0, pool=8.0)
    async with httpx.AsyncClient(timeout=timeout, trust_env=False) as client:
        async with client.stream(
            "POST",
            f"{base_url.rstrip('/')}/v1/chat/completions",
            json=payload,
            headers={"Content-Type": "application/json"},
        ) as response:
            if response.status_code >= 400:
                body = await response.aread()
                raise RuntimeError(
                    f"chat endpoint failed: {response.status_code} "
                    f"{body.decode('utf-8', errors='ignore')[:400]}"
                )

            buffer = ""
            async for chunk in response.aiter_text():
                if not chunk:
                    continue
                buffer += chunk
                payloads, buffer = _split_sse_buffer(buffer)
                for raw in payloads:
                    parsed = _parse_stream_payload(raw)
                    if not parsed:
                        continue
                    stream_error = _extract_stream_error(parsed)
                    if stream_error:
                        raise RuntimeError(stream_error)
                    delta_text = _extract_delta_text(parsed)
                    if not delta_text:
                        continue
                    if not has_spoken:
                        has_spoken = True
                        await _send_event(
                            websocket,
                            _event(
                                "avatar.state",
                                session_id=session_id,
                                correlation_id=correlation_id,
                                data={"state": "speaking", "reason": "assistant_streaming"},
                            ),
                        )
                    assistant_text += delta_text
                    await _send_event(
                        websocket,
                        _event(
                            "assistant.delta",
                            session_id=session_id,
                            correlation_id=correlation_id,
                            data={
                                "conversation_id": conversation_id,
                                "text": delta_text,
                                "source": "openxnet_chat",
                            },
                        ),
                    )

            if buffer.strip():
                parsed = _parse_stream_payload(buffer)
                stream_error = _extract_stream_error(parsed) if parsed else ""
                if stream_error:
                    raise RuntimeError(stream_error)
                delta_text = _extract_delta_text(parsed) if parsed else ""
                if delta_text:
                    if not has_spoken:
                        await _send_event(
                            websocket,
                            _event(
                                "avatar.state",
                                session_id=session_id,
                                correlation_id=correlation_id,
                                data={"state": "speaking", "reason": "assistant_streaming"},
                            ),
                        )
                    assistant_text += delta_text
                    await _send_event(
                        websocket,
                        _event(
                            "assistant.delta",
                            session_id=session_id,
                            correlation_id=correlation_id,
                            data={
                                "conversation_id": conversation_id,
                                "text": delta_text,
                                "source": "openxnet_chat",
                            },
                        ),
                    )

    if not assistant_text.strip():
        raise RuntimeError("empty chat stream from /v1/chat/completions")

    await vr_session_store.append_conversation_turn(
        session_id,
        conversation_id,
        user_text=text,
        assistant_text=assistant_text,
    )
    return assistant_text


async def _handle_chat_send(
    websocket: WebSocket,
    *,
    session_id: str,
    correlation_id: str,
    data: Dict[str, Any],
) -> None:
    conversation_id = _clean_text(data.get("conversation_id"), "vr_conv_default")
    text = _clean_text(data.get("text"))
    if not text:
        await _send_error(
            websocket,
            code="EMPTY_CHAT_TEXT",
            message="聊天内容不能为空。",
            correlation_id=correlation_id,
            session_id=session_id,
        )
        return

    if await _start_worldgen_from_chat(
        websocket,
        session_id=session_id,
        correlation_id=correlation_id,
        data=data,
        text=text,
    ):
        await _send_event(
            websocket,
            _event(
                "assistant.done",
                session_id=session_id,
                correlation_id=correlation_id,
                data={
                    "conversation_id": conversation_id,
                    "message_id": f"msg_{uuid.uuid4().hex[:12]}",
                    "finish_reason": "worldgen_started",
                    "source": "worldgen",
                },
            ),
        )
        return

    use_mock = _as_bool(data.get("mock"), default=False)
    fallback_to_mock = _as_bool(
        data.get("fallback_to_mock"),
        default=DEFAULT_REAL_CHAT_FALLBACK_TO_MOCK,
    )
    if use_mock:
        await _stream_mock_chat(
            websocket,
            session_id=session_id,
            correlation_id=correlation_id,
            conversation_id=conversation_id,
            text=text,
        )
        await vr_session_store.mark_verified(
            session_id,
            "chat_stream",
            "Completed mock chat stream through VR WebSocket.",
            allow_headset_item=_is_headset_source(data),
        )
        if _clean_text(data.get("input_mode")) == "voice" and _is_headset_source(data):
            await vr_session_store.mark_verified(
                session_id,
                "voice_asr_loop",
                "Received headset-originated voice chat text after ASR.",
                allow_headset_item=True,
            )
        return

    try:
        assistant_text = await _stream_real_chat(
            websocket,
            session_id=session_id,
            correlation_id=correlation_id,
            conversation_id=conversation_id,
            text=text,
            data=data,
        )
        await _send_event(
            websocket,
            _event(
                "assistant.done",
                session_id=session_id,
                correlation_id=correlation_id,
                data={
                    "conversation_id": conversation_id,
                    "message_id": f"msg_{uuid.uuid4().hex[:12]}",
                    "finish_reason": "stop",
                    "source": "openxnet_chat",
                    "empty_response": not bool(assistant_text),
                },
            ),
        )
        await _send_event(
            websocket,
            _event(
                "avatar.state",
                session_id=session_id,
                correlation_id=correlation_id,
                data={"state": "idle", "reason": "assistant_done"},
            ),
        )
        await vr_session_store.mark_verified(
            session_id,
            "chat_stream",
            "Completed real chat stream through VR WebSocket.",
            allow_headset_item=_is_headset_source(data),
        )
        if _clean_text(data.get("input_mode")) == "voice" and _is_headset_source(data):
            await vr_session_store.mark_verified(
                session_id,
                "voice_asr_loop",
                "Received headset-originated voice chat text after ASR.",
                allow_headset_item=True,
            )
    except Exception as exc:
        error_message = _chat_error_message(exc)
        await _send_event(
            websocket,
            _event(
                "chat.fallback",
                session_id=session_id,
                correlation_id=correlation_id,
                data={
                    "source": "openxnet_chat",
                    "fallback": "mock" if fallback_to_mock else "none",
                    "reason": error_message,
                    "detail": str(exc)[:500],
                },
            ),
        )
        if fallback_to_mock:
            await _stream_mock_chat(
                websocket,
                session_id=session_id,
                correlation_id=correlation_id,
                conversation_id=conversation_id,
                text=text,
            )
            return

        await _send_error(
            websocket,
            code="REAL_CHAT_UNAVAILABLE",
            message=error_message,
            correlation_id=correlation_id,
            session_id=session_id,
        )
        await _send_event(
            websocket,
            _event(
                "avatar.state",
                session_id=session_id,
                correlation_id=correlation_id,
                data={"state": "error", "reason": "real_chat_unavailable"},
            ),
        )


async def _send_object_action_result(
    websocket: WebSocket,
    *,
    session_id: str,
    correlation_id: str,
    object_id: str,
    label: str,
    semantic_action: str,
    status: str,
    message: str,
    result: Optional[Dict[str, Any]] = None,
) -> None:
    await _send_event(
        websocket,
        _event(
            "object.action.result",
            session_id=session_id,
            correlation_id=correlation_id,
            data={
                "object_id": object_id,
                "label": label,
                "semantic_action": semantic_action,
                "status": status,
                "message": message,
                "result": result or {},
            },
        ),
    )


async def _handle_object_semantic_action(
    websocket: WebSocket,
    *,
    session_id: str,
    correlation_id: str,
    interaction: Dict[str, Any],
    stored: Dict[str, Any],
) -> None:
    merged = stored.get("object") if isinstance(stored, dict) and isinstance(stored.get("object"), dict) else {}
    object_id = _clean_text(interaction.get("object_id") or merged.get("object_id"), "unknown")
    label = _clean_text(interaction.get("label") or merged.get("label"), object_id)
    semantic_action = _clean_text(
        interaction.get("semantic_action") or merged.get("semantic_action")
    ).lower()
    if not semantic_action:
        return

    semantic_prompt = _clean_text(
        interaction.get("semantic_prompt") or merged.get("semantic_prompt")
    )
    task_title = _clean_text(
        interaction.get("task_title") or merged.get("task_title"),
        f"{label} 空间任务",
    )
    task_agent_type = _clean_text(
        interaction.get("task_agent_type") or merged.get("task_agent_type"),
        "default",
    )
    start_task_immediately = _as_bool(
        interaction.get("start_task_immediately"),
        default=bool(merged.get("start_task_immediately")),
    )
    source_is_headset = _is_headset_source(interaction)

    if semantic_action == "create_task":
        try:
            task = await _create_vr_task(
                VRTaskCreateRequest(
                    session_id=session_id,
                    title=task_title,
                    description=semantic_prompt or f"由 Quest 空间物体 {label} 激活创建。",
                    agent_type=task_agent_type,
                    start_immediately=start_task_immediately,
                    source="quest3_object",
                )
            )
        except HTTPException as exc:
            await _send_object_action_result(
                websocket,
                session_id=session_id,
                correlation_id=correlation_id,
                object_id=object_id,
                label=label,
                semantic_action=semantic_action,
                status="error",
                message=f"{label} 创建任务失败：{exc.detail}",
                result={"detail": exc.detail},
            )
            return

        await _send_event(
            websocket,
            _event(
                "task.created",
                session_id=session_id,
                correlation_id=correlation_id,
                data={"task": task, "source_object_id": object_id},
            ),
        )
        await _send_event(
            websocket,
            _event(
                "task.updated",
                session_id=session_id,
                data={"task": task, "source_object_id": object_id},
            ),
        )
        await _send_object_action_result(
            websocket,
            session_id=session_id,
            correlation_id=correlation_id,
            object_id=object_id,
            label=label,
            semantic_action=semantic_action,
            status="ok",
            message=f"{label} 已创建任务：{task.get('title') or task_title}",
            result={"task": task},
        )
        await vr_session_store.mark_verified(
            session_id,
            "object_semantic_action",
            f"Executed object semantic action {semantic_action} for {label}.",
            allow_headset_item=source_is_headset,
        )
        return

    if semantic_action in {"memory_summary", "show_memory"}:
        cards = await _list_task_cards(limit=5)
        items = [_memory_item_from_task(card) for card in cards[:5]]
        if items:
            message = "最近记忆：" + "；".join(
                _clean_text(item.get("title"), "OpenXnet 任务") for item in items[:3]
            )
        else:
            message = "还没有可展示的任务记忆；VR Gateway、手势、物体和 MR 空间上下文已准备记录。"
        await _send_object_action_result(
            websocket,
            session_id=session_id,
            correlation_id=correlation_id,
            object_id=object_id,
            label=label,
            semantic_action=semantic_action,
            status="ok",
            message=message,
            result={"items": items},
        )
        await vr_session_store.mark_verified(
            session_id,
            "object_semantic_action",
            f"Executed object semantic action {semantic_action} for {label}.",
            allow_headset_item=source_is_headset,
        )
        return

    if semantic_action in {"assistant_focus", "open_chat_context"}:
        await _send_event(
            websocket,
            _event(
                "avatar.state",
                session_id=session_id,
                correlation_id=correlation_id,
                data={"state": "listening", "reason": f"object_action:{semantic_action}:{object_id}"},
            ),
        )
        await _send_object_action_result(
            websocket,
            session_id=session_id,
            correlation_id=correlation_id,
            object_id=object_id,
            label=label,
            semantic_action=semantic_action,
            status="ok",
            message=semantic_prompt or f"{label} 已让 Avatar 进入倾听状态。",
            result={"avatar_state": "listening"},
        )
        await vr_session_store.mark_verified(
            session_id,
            "object_semantic_action",
            f"Executed object semantic action {semantic_action} for {label}.",
            allow_headset_item=source_is_headset,
        )
        if source_is_headset:
            await vr_session_store.mark_verified(
                session_id,
                "vrm_feedback",
                "Headset object semantic action changed avatar state.",
                allow_headset_item=True,
            )
        return

    if semantic_action in {"assistant_prompt", "chat_prompt", "ask_assistant"}:
        prompt = semantic_prompt or (
            f"用户在 Quest MR 空间中激活了 {label}。"
            "请结合当前空间布局、可交互物体、最近手势/控制器事件和语音上下文，给出下一步可执行建议。"
        )
        await _send_object_action_result(
            websocket,
            session_id=session_id,
            correlation_id=correlation_id,
            object_id=object_id,
            label=label,
            semantic_action=semantic_action,
            status="started",
            message=f"{label} 已把空间上下文发送给助手。",
            result={"conversation_id": "vr_conv_object_actions"},
        )
        await vr_session_store.mark_verified(
            session_id,
            "object_semantic_action",
            f"Started assistant prompt semantic action for {label}.",
            allow_headset_item=source_is_headset,
        )
        await _handle_chat_send(
            websocket,
            session_id=session_id,
            correlation_id=correlation_id,
            data={
                "conversation_id": "vr_conv_object_actions",
                "text": prompt,
                "input_mode": "object",
                "assistant_id": "default",
                "model": DEFAULT_VR_CHAT_MODEL,
                "fallback_to_mock": True,
                "object_id": object_id,
                "object_label": label,
                "semantic_action": semantic_action,
            },
        )
        return

    await _send_object_action_result(
        websocket,
        session_id=session_id,
        correlation_id=correlation_id,
        object_id=object_id,
        label=label,
        semantic_action=semantic_action,
        status="ignored",
        message=f"{label} 的语义动作暂未绑定：{semantic_action}",
        result={},
    )


@router.get("/v1/vr/status")
async def get_vr_status(request: Request):
    scheme = request.url.scheme
    host_header = request.headers.get("host") or request.url.netloc
    request_host = request.url.hostname or host_header.split(":")[0]
    port = _request_port(request)
    local_origin = _build_origin_url(scheme, "127.0.0.1", port)
    current_origin = _build_origin_url(scheme, request_host, port)
    lan_interfaces = _discover_lan_ipv4_addresses()
    lan_urls = [
        {
            **iface,
            "origin": _build_origin_url(scheme, iface["address"], port),
            "quest_url": _quest_url_from_origin(_build_origin_url(scheme, iface["address"], port)),
        }
        for iface in lan_interfaces
    ]
    request_is_loopback = _is_loopback_host(request_host)
    recommended_url = lan_urls[0]["quest_url"] if lan_urls else _quest_url_from_origin(current_origin)
    device_status = await _get_latest_device_status()
    return {
        "success": True,
        "status": {
            "server_time": _now_iso(),
            "request": {
                "origin": current_origin,
                "host": request_host,
                "port": port,
                "is_loopback": request_is_loopback,
                "client_host": _clean_text(request.client.host if request.client else ""),
            },
            "local": {
                "origin": local_origin,
                "quest_url": _quest_url_from_origin(local_origin),
            },
            "lan": {
                "interfaces": lan_urls,
                "available": bool(lan_urls),
                "recommended_quest_url": recommended_url,
            },
            "gateway": {
                "rest_prefix": "/v1/vr",
                "websocket_path": "/ws/vr/events",
                "mock_entry_path": "/quest3/",
                "protocol_version": "vr-gateway/v1",
                "recommended_quest_url": recommended_url,
                "local_quest_url": _quest_url_from_origin(local_origin),
                "default_desktop_host": "127.0.0.1",
                "lan_mode_host": "0.0.0.0",
            },
            "device": device_status,
            "asr": await _get_asr_status(),
            "worldgen": worldgen_runtime_status(),
            "verification": _verification_summary(
                _merge_verification_state(
                    _new_verification_state(),
                    _load_persisted_verification_state(),
                )
            ),
            "diagnostics": await vr_session_store.latest_diagnostics(
                _clean_text(device_status.get("session_id")),
                limit=30,
            ),
            "warnings": {
                "loopback_only": request_is_loopback,
                "quest_requires_lan_url": request_is_loopback,
            },
        },
    }


@router.post("/v1/vr/session")
async def create_vr_session(request: Request, req: VRSessionCreateRequest):
    session = await vr_session_store.create(
        request=request,
        device=req.device.model_dump(),
        capabilities=req.capabilities.model_dump(),
        pairing_code=req.pairing_code,
    )
    return {"success": True, "session": session}


@router.post("/v1/vr/device/heartbeat")
async def update_vr_device_heartbeat(req: VRDeviceHeartbeatRequest):
    device_status = await _store_device_heartbeat(req)
    return {"success": True, "device": device_status}


@router.get("/v1/vr/profile")
async def get_vr_profile(session_id: str = Query(...)):
    session = await _require_session(session_id)
    return {"success": True, "profile": _build_profile(session)}


@router.get("/v1/vr/tasks")
async def list_vr_tasks(
    session_id: str = Query(...),
    limit: int = Query(20, ge=1, le=50),
):
    await _require_session(session_id)
    return {"success": True, "tasks": await _list_task_cards(limit=limit)}


@router.post("/v1/vr/tasks")
async def create_vr_task(req: VRTaskCreateRequest):
    task = await _create_vr_task(req)
    return {"success": True, "task": task}


@router.post("/v1/vr/worldgen/scenes")
async def create_worldgen_scene(request: Request, req: VRWorldGenSceneCreateRequest):
    if not worldgen_feature_enabled():
        raise HTTPException(status_code=503, detail="WORLDGEN_FEATURE_DISABLED")
    if req.session_id:
        await _require_session(req.session_id)
    prompt = _clean_text(req.prompt)
    if not prompt:
        raise HTTPException(status_code=400, detail="EMPTY_SCENE_PROMPT")

    scene_request = _worldgen_request_from_payload(req)
    base_url = _request_origin(request)
    queued_manifest = prepare_scene(scene_request, base_url=base_url)
    await _remember_worldgen_job(
        scene_request.scene_id,
        {
            "scene_id": scene_request.scene_id,
            "session_id": _clean_text(req.session_id),
            "prompt": scene_request.prompt,
            "status": "queued",
            "manifest": queued_manifest,
            "updated_at": _now_iso(),
        },
    )

    if req.session_id:
        await _broadcast_worldgen_scene(req.session_id, queued_manifest)

    asyncio.create_task(
        _run_worldgen_job(
            scene_request,
            session_id=_clean_text(req.session_id),
            base_url=base_url,
        )
    )
    return {
        "success": True,
        "job": await _get_worldgen_job(scene_request.scene_id),
        "scene": _worldgen_scene_event_data(queued_manifest),
    }


@router.get("/v1/vr/worldgen/scenes/{scene_id}")
async def get_worldgen_scene(scene_id: str):
    try:
        manifest = load_manifest(scene_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="SCENE_NOT_FOUND")
    job = await _get_worldgen_job(scene_id)
    return {"success": True, "job": job, "scene": _worldgen_scene_event_data(manifest), "manifest": manifest}


@router.get("/v1/vr/worldgen/scenes/{scene_id}/manifest")
async def get_worldgen_scene_manifest(request: Request, scene_id: str):
    try:
        manifest = load_manifest(scene_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="SCENE_NOT_FOUND")

    manifest = dict(manifest)
    urls = public_scene_urls(_request_origin(request), scene_id)
    manifest["manifest_url"] = urls["manifest_url"]
    assets = manifest.setdefault("assets", {})
    if isinstance(assets, dict):
        mesh = assets.setdefault("mesh", {})
        preview = assets.setdefault("preview", {})
        if isinstance(mesh, dict):
            mesh["url"] = urls["mesh_url"]
        if isinstance(preview, dict):
            preview["url"] = urls["preview_url"]
    return manifest


@router.get("/v1/vr/worldgen/scenes/{scene_id}/assets/{filename}")
async def get_worldgen_scene_asset(scene_id: str, filename: str):
    allowed = {"scene.glb", "preview.png", "splat.ply"}
    if filename not in allowed:
        raise HTTPException(status_code=404, detail="ASSET_NOT_FOUND")
    try:
        path = scene_asset_path(scene_id, filename)
    except ValueError:
        raise HTTPException(status_code=400, detail="INVALID_ASSET_PATH")
    if not path.is_file():
        raise HTTPException(status_code=404, detail="ASSET_NOT_FOUND")

    media_type = {
        ".glb": "model/gltf-binary",
        ".png": "image/png",
        ".ply": "application/octet-stream",
        ".json": "application/json",
    }.get(path.suffix.lower(), "application/octet-stream")
    return FileResponse(path, media_type=media_type, filename=path.name)


@router.get("/v1/vr/tasks/{task_id}")
async def get_vr_task(task_id: str, session_id: str = Query(...)):
    await _require_session(session_id)
    task = await _get_task_card(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="TASK_NOT_FOUND")
    return {"success": True, "task": task}


@router.get("/v1/vr/memory/summary")
async def get_vr_memory_summary(
    session_id: str = Query(...),
    limit: int = Query(10, ge=1, le=30),
):
    await _require_session(session_id)
    cards = await _list_task_cards(limit=limit)
    items = [_memory_item_from_task(card) for card in cards[:limit]]
    if not items:
        items = [
            {
                "id": "vr_gateway_ready",
                "type": "session_summary",
                "title": "Quest 3 VR Gateway",
                "summary": "OpenXnet VR Gateway 已就绪，可用于会话、任务卡片和 Avatar 状态联动。",
                "source": "vr_gateway",
                "updated_at": _now_iso(),
            }
        ]
    return {"success": True, "items": items}


@router.get("/v1/vr/avatar")
async def get_vr_avatar(session_id: str = Query(...)):
    await _require_session(session_id)
    return {"success": True, "avatar": _build_avatar()}


@router.post("/v1/vr/avatar/motion")
async def send_vr_avatar_motion(req: VRAvatarMotionRequest):
    await _require_session(req.session_id)
    motion = _clean_text(req.motion)
    if not motion:
        raise HTTPException(status_code=400, detail="EMPTY_AVATAR_MOTION")
    sent = await _broadcast_avatar_motion(
        req.session_id,
        motion,
        source=req.source,
        reason=req.reason,
        mirror=req.mirror,
        yaw_degrees=req.yaw_degrees,
        max_seconds=req.max_seconds,
        suppress_repeat=req.suppress_repeat,
    )
    event_data = {
        "type": "avatar.motion",
        "session_id": _clean_text(req.session_id),
        "motion": motion,
        "source": _clean_text(req.source, "desktop"),
        "reason": _clean_text(req.reason, "manual"),
    }
    if req.mirror is not None:
        event_data["mirror"] = bool(req.mirror)
    if req.yaw_degrees is not None:
        event_data["yaw_degrees"] = max(-180.0, min(float(req.yaw_degrees), 180.0))
    if req.max_seconds is not None:
        event_data["max_seconds"] = max(0.0, min(float(req.max_seconds), 30.0))
    if req.suppress_repeat is not None:
        event_data["suppress_repeat"] = bool(req.suppress_repeat)
    return {
        "success": True,
        "sent": sent,
        "event": event_data,
    }


@router.websocket("/ws/vr/events")
async def vr_events_websocket(websocket: WebSocket, session_id: str = Query("")):
    session = await vr_session_store.get(session_id)
    if not session:
        await websocket.accept()
        await _send_error(
            websocket,
            code="INVALID_SESSION",
            message="VR 会话不存在或已过期，请重新配对。",
            session_id=session_id,
        )
        await websocket.close(code=4404)
        return

    await websocket.accept()
    await vr_websocket_hub.register(session_id, websocket)
    supported_events = [
        "ping",
        "chat.send",
        "chat.fallback",
        "task.subscribe",
        "task.create",
        "avatar.state",
        "avatar.motion",
        "avatar.feedback",
        "voice.diagnostic",
        "hand.tracking.diagnostic",
        "gesture.detected",
        "controller.input",
        "controller.haptic.feedback",
        "object.catalog.update",
        "object.interaction",
        "object.action.result",
        "space.layout.update",
    ]
    if worldgen_feature_enabled():
        supported_events.extend(
            [
                "scene.generate",
                "scene.generation.started",
                "scene.generated",
            ]
        )
    await _send_event(
        websocket,
        _event(
            "session.ready",
            session_id=session_id,
            data={
                "heartbeat_interval_ms": 15000,
                "supported_events": supported_events,
                "verification": _verification_summary(session.get("verification") or {}),
            },
        ),
    )
    await vr_session_store.mark_verified(
        session_id,
        "websocket_event_loop",
        "WebSocket accepted and sent session.ready.",
        allow_headset_item=True,
    )
    latest_worldgen_scene = await _get_latest_worldgen_scene(session_id) if worldgen_feature_enabled() else {}
    if latest_worldgen_scene:
        await _send_event(
            websocket,
            _event(
                "scene.generated",
                session_id=session_id,
                data={
                    **_worldgen_scene_event_data(latest_worldgen_scene),
                    "replayed": True,
                    "replay_scope": _clean_text(latest_worldgen_scene.get("_replay_scope"), "session"),
                },
            ),
        )

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                await _send_error(
                    websocket,
                    code="INVALID_JSON",
                    message="事件必须是 JSON 格式。",
                    session_id=session_id,
                )
                continue

            event_type = _clean_text(payload.get("type"))
            correlation_id = _clean_text(payload.get("event_id"))
            data = payload.get("data") if isinstance(payload.get("data"), dict) else {}

            if event_type == "ping":
                await _send_event(
                    websocket,
                    _event("pong", session_id=session_id, correlation_id=correlation_id),
                )
            elif event_type == "task.subscribe":
                limit = int(data.get("limit", 20) or 20)
                await _send_event(
                    websocket,
                    _event(
                        "task.snapshot",
                        session_id=session_id,
                        correlation_id=correlation_id,
                        data={"tasks": await _list_task_cards(limit=limit)},
                    ),
                )
            elif event_type == "task.create":
                try:
                    task_req = VRTaskCreateRequest(
                        session_id=session_id,
                        title=_clean_text(data.get("title"), "Quest 3 空间任务"),
                        description=_clean_text(data.get("description")),
                        agent_type=_clean_text(data.get("agent_type"), "default"),
                        start_immediately=_as_bool(data.get("start_immediately")),
                        source="quest3_ws",
                    )
                    task = await _create_vr_task(task_req)
                    await _send_event(
                        websocket,
                        _event(
                            "task.created",
                            session_id=session_id,
                            correlation_id=correlation_id,
                            data={"task": task},
                        ),
                    )
                    await _send_event(
                        websocket,
                        _event("task.updated", session_id=session_id, data={"task": task}),
                    )
                except HTTPException as exc:
                    await _send_error(
                        websocket,
                        code=str(exc.detail or "TASK_CREATE_FAILED"),
                        message="空间任务创建失败。",
                        correlation_id=correlation_id,
                        session_id=session_id,
                    )
            elif event_type == "chat.send":
                await _handle_chat_send(
                    websocket,
                    session_id=session_id,
                    correlation_id=correlation_id,
                    data=data,
                )
            elif event_type == "scene.generate":
                if not worldgen_feature_enabled():
                    await _send_error(
                        websocket,
                        code="WORLDGEN_FEATURE_DISABLED",
                        message="WorldGen 场景生成默认关闭。设置 OPENXNET_WORLDGEN_FEATURE_ENABLED=1 后再启用。",
                        correlation_id=correlation_id,
                        session_id=session_id,
                    )
                    continue
                prompt = _clean_text(data.get("prompt") or data.get("text"))
                if not prompt:
                    await _send_error(
                        websocket,
                        code="EMPTY_SCENE_PROMPT",
                        message="WorldGen 场景提示词不能为空。",
                        correlation_id=correlation_id,
                        session_id=session_id,
                    )
                    continue

                req = VRWorldGenSceneCreateRequest(
                    session_id=session_id,
                    prompt=prompt,
                    mode=_clean_text(data.get("mode"), "t2s"),
                    return_mesh=True,
                    use_sharp=_as_bool(data.get("use_sharp"), default=False),
                    inpaint_bg=_as_bool(data.get("inpaint_bg"), default=False),
                    resolution=max(512, min(_as_int(data.get("resolution"), 1600), 4096)),
                    low_vram=data.get("low_vram") if isinstance(data.get("low_vram"), bool) else None,
                    source=_clean_text(data.get("source"), "quest3_unity"),
                )
                scene_request = _worldgen_request_from_payload(req, source=req.source)
                base_url = _clean_text(data.get("base_url")) or _connection_origin(websocket)
                queued_manifest = prepare_scene(scene_request, base_url=base_url)
                await _remember_worldgen_job(
                    scene_request.scene_id,
                    {
                        "scene_id": scene_request.scene_id,
                        "session_id": session_id,
                        "prompt": scene_request.prompt,
                        "status": "queued",
                        "manifest": queued_manifest,
                        "updated_at": _now_iso(),
                    },
                )
                await _send_event(
                    websocket,
                    _event(
                        "scene.generation.started",
                        session_id=session_id,
                        correlation_id=correlation_id,
                        data=_worldgen_scene_event_data(queued_manifest),
                    ),
                )
                asyncio.create_task(
                    _run_worldgen_job(
                        scene_request,
                        session_id=session_id,
                        base_url=base_url,
                        correlation_id=correlation_id,
                    )
                )
            elif event_type == "avatar.state":
                await _send_event(
                    websocket,
                    _event(
                        "avatar.state",
                        session_id=session_id,
                        correlation_id=correlation_id,
                        data={"state": _clean_text(data.get("state"), "idle")},
                    ),
                )
            elif event_type == "avatar.motion":
                motion = _clean_text(data.get("motion") or data.get("name"))
                if not motion:
                    await _send_error(
                        websocket,
                        code="EMPTY_AVATAR_MOTION",
                        message="Avatar motion cannot be empty.",
                        correlation_id=correlation_id,
                        session_id=session_id,
                    )
                    continue
                yaw_degrees = None
                if "yaw_degrees" in data:
                    try:
                        yaw_degrees = float(data.get("yaw_degrees"))
                    except (TypeError, ValueError):
                        yaw_degrees = None
                max_seconds = None
                if "max_seconds" in data:
                    try:
                        max_seconds = float(data.get("max_seconds"))
                    except (TypeError, ValueError):
                        max_seconds = None
                await _broadcast_avatar_motion(
                    session_id,
                    motion,
                    source=_clean_text(data.get("source"), "quest3_unity"),
                    reason=_clean_text(data.get("reason"), "websocket"),
                    mirror=_as_bool(data.get("mirror")) if "mirror" in data else None,
                    yaw_degrees=yaw_degrees,
                    max_seconds=max_seconds,
                    suppress_repeat=_as_bool(data.get("suppress_repeat")) if "suppress_repeat" in data else None,
                    correlation_id=correlation_id,
                )
            elif event_type == "avatar.feedback":
                state = _clean_text(data.get("state"), "idle")
                reason = _clean_text(data.get("reason"), "state_applied")
                source_is_headset = _is_headset_source(data)
                await vr_session_store.mark_verified(
                    session_id,
                    "vrm_feedback",
                    f"Quest avatar applied state {state} ({reason}).",
                    allow_headset_item=source_is_headset,
                )
                await _send_event(
                    websocket,
                    _event(
                        "avatar.feedback",
                        session_id=session_id,
                        correlation_id=correlation_id,
                        data={
                            "state": state,
                            "reason": reason,
                            "source": _clean_text(data.get("source"), "quest3_unity"),
                            "client_sent_at": _clean_text(data.get("client_sent_at")),
                        },
                    ),
                )
            elif event_type == "voice.diagnostic":
                saved = await vr_session_store.record_diagnostic(session_id, "voice", data)
                await _send_event(
                    websocket,
                    _event(
                        "voice.diagnostic.received",
                        session_id=session_id,
                        correlation_id=correlation_id,
                        data={
                            "saved": bool(saved),
                            "stage": _clean_text(data.get("stage"), "unknown"),
                            "message": _clean_text(data.get("message")),
                            "source": _clean_text(data.get("source"), "quest3_unity"),
                            "client_sent_at": _clean_text(data.get("client_sent_at")),
                        },
                    ),
                )
            elif event_type == "hand.tracking.diagnostic":
                saved = await vr_session_store.record_diagnostic(session_id, "hand_tracking", data)
                await _send_event(
                    websocket,
                    _event(
                        "hand.tracking.diagnostic.received",
                        session_id=session_id,
                        correlation_id=correlation_id,
                        data={
                            "saved": bool(saved),
                            "stage": _clean_text(data.get("stage"), "unknown"),
                            "message": _clean_text(data.get("message")),
                            "source": _clean_text(data.get("source"), "quest3_unity"),
                            "client_sent_at": _clean_text(data.get("client_sent_at")),
                        },
                    ),
                )
            elif event_type == "gesture.detected":
                gesture = _clean_text(data.get("gesture"), "unknown")
                hand = _clean_text(data.get("hand"), "unknown")
                source_is_headset = _is_headset_source(data)
                await vr_session_store.mark_verified(
                    session_id,
                    "hand_gesture",
                    f"Received gesture {gesture} from {hand}.",
                    allow_headset_item=source_is_headset,
                )
                await _send_event(
                    websocket,
                    _event(
                        "gesture.detected",
                        session_id=session_id,
                        correlation_id=correlation_id,
                        data={
                            "gesture": gesture,
                            "hand": hand,
                            "confidence": data.get("confidence", 1.0),
                            "source": _clean_text(data.get("source"), "quest3_unity"),
                            "client_sent_at": _clean_text(data.get("client_sent_at")),
                        },
                    ),
                )
                if gesture in {"wave", "thumbs_up", "point", "pinch", "open_palm"}:
                    await _send_event(
                        websocket,
                        _event(
                            "avatar.state",
                            session_id=session_id,
                            correlation_id=correlation_id,
                            data={"state": "listening", "reason": f"gesture:{gesture}"},
                        ),
                    )
            elif event_type == "controller.input":
                controller = _clean_text(data.get("controller"), "unknown")
                control = _clean_text(data.get("control"), "unknown")
                phase = _clean_text(data.get("phase"), "changed")
                source_is_headset = _is_headset_source(data)
                await vr_session_store.mark_verified(
                    session_id,
                    "controller_input",
                    f"Received controller input {controller}:{control}:{phase}.",
                    allow_headset_item=source_is_headset,
                )
                await _send_event(
                    websocket,
                    _event(
                        "controller.input",
                        session_id=session_id,
                        correlation_id=correlation_id,
                        data={
                            "controller": controller,
                            "control": control,
                            "phase": phase,
                            "value": data.get("value"),
                            "strength": data.get("strength", 1.0),
                            "source": _clean_text(data.get("source"), "quest3_unity"),
                            "client_sent_at": _clean_text(data.get("client_sent_at")),
                        },
                    ),
                )
                if phase in {"pressed", "changed"}:
                    await _send_event(
                        websocket,
                        _event(
                            "avatar.state",
                            session_id=session_id,
                            correlation_id=correlation_id,
                            data={"state": "listening", "reason": f"controller:{controller}:{control}"},
                        ),
                    )
            elif event_type == "controller.haptic.feedback":
                hand = _clean_text(data.get("hand") or data.get("controller"), "unknown")
                reason = _clean_text(data.get("reason"), "unknown")
                method = _clean_text(data.get("method"), "unknown")
                ok = _as_bool(data.get("ok"), default=False)
                source_is_headset = _is_headset_source(data)
                if ok:
                    await vr_session_store.mark_verified(
                        session_id,
                        "controller_haptics",
                        f"Quest haptic feedback confirmed on {hand} via {method} for {reason}.",
                        allow_headset_item=source_is_headset,
                    )
                else:
                    await vr_session_store.mark_needs_headset(
                        session_id,
                        "controller_haptics",
                        f"Quest haptic feedback not confirmed on {hand}: {method} returned ok=false for {reason}.",
                    )
                await _send_event(
                    websocket,
                    _event(
                        "controller.haptic.feedback",
                        session_id=session_id,
                        correlation_id=correlation_id,
                        data={
                            "hand": hand,
                            "reason": reason,
                            "ok": ok,
                            "method": method,
                            "source": _clean_text(data.get("source"), "quest3_unity"),
                            "client_sent_at": _clean_text(data.get("client_sent_at")),
                        },
                    ),
                )
            elif event_type == "space.layout.update":
                await vr_session_store.update_layout(session_id, data)
                session = await vr_session_store.get(session_id) or {}
                layout_summary = _summarize_space_layout(session.get("space_layout") or data)
                await _send_event(
                    websocket,
                    _event(
                        "space.layout.updated",
                        session_id=session_id,
                        correlation_id=correlation_id,
                        data={
                            "saved": True,
                            "layout": layout_summary,
                            "surface_count": layout_summary.get("surface_count", 0),
                            "walkable_count": layout_summary.get("walkable_count", 0),
                            "occluder_count": layout_summary.get("occluder_count", 0),
                        },
                    ),
                )
            elif event_type == "object.interaction":
                object_id = _clean_text(data.get("object_id"), "unknown")
                action = _clean_text(data.get("action"), "unknown")
                stored = await vr_session_store.record_object_interaction(session_id, data)
                await _send_event(
                    websocket,
                    _event(
                        "object.interaction",
                        session_id=session_id,
                        correlation_id=correlation_id,
                        data={
                            "object_id": object_id,
                            "label": _clean_text(data.get("label")),
                            "object_type": _clean_text(data.get("object_type"), "spatial_object"),
                            "semantic_action": _clean_text(data.get("semantic_action")),
                            "semantic_prompt": _clean_text(data.get("semantic_prompt")),
                            "task_title": _clean_text(data.get("task_title")),
                            "task_agent_type": _clean_text(data.get("task_agent_type"), "default"),
                            "start_task_immediately": _as_bool(data.get("start_task_immediately")),
                            "action": action,
                            "source": _clean_text(data.get("source"), "quest3_unity"),
                            "hand_or_controller": _clean_text(data.get("hand_or_controller")),
                            "strength": data.get("strength", 1.0),
                            "position": data.get("position") if isinstance(data.get("position"), dict) else {},
                            "rotation": data.get("rotation") if isinstance(data.get("rotation"), dict) else {},
                            "client_sent_at": _clean_text(data.get("client_sent_at")),
                            "saved": True,
                            "object_summary": stored.get("summary") if isinstance(stored, dict) else {},
                        },
                    ),
                )
                if action in {"focus", "select", "release", "activate", "move", "hover.entered", "select.entered"}:
                    await _send_event(
                        websocket,
                        _event(
                            "avatar.state",
                            session_id=session_id,
                            correlation_id=correlation_id,
                            data={"state": "listening", "reason": f"object:{action}:{object_id}"},
                        ),
                    )
                if action in {"activate", "activated"}:
                    await _handle_object_semantic_action(
                        websocket,
                        session_id=session_id,
                        correlation_id=correlation_id,
                        interaction=data,
                        stored=stored,
                    )
            elif event_type == "object.catalog.update":
                summary = await vr_session_store.update_object_catalog(session_id, data)
                await _send_event(
                    websocket,
                    _event(
                        "object.catalog.updated",
                        session_id=session_id,
                        correlation_id=correlation_id,
                        data={
                            "saved": True,
                            "object_summary": summary,
                            "object_count": summary.get("object_count", 0) if isinstance(summary, dict) else 0,
                        },
                    ),
                )
            else:
                await _send_error(
                    websocket,
                    code="UNSUPPORTED_EVENT",
                    message=f"不支持的 VR 事件：{event_type}",
                    correlation_id=correlation_id,
                    session_id=session_id,
                )
    except WebSocketDisconnect:
        return
    finally:
        await vr_websocket_hub.unregister(session_id, websocket)
