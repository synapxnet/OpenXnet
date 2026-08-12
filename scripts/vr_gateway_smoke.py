#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Smoke test for the Quest 3 / VR-MR gateway.

Run from openxnet-desktop:
    python scripts/vr_gateway_smoke.py
"""

from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

os.environ.setdefault("OPENXNET_USER_DATA_DIR", tempfile.mkdtemp(prefix="openxnet-vr-smoke-"))

from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from py.routes.vr import (  # noqa: E402
    _extract_delta_text,
    _extract_stream_error,
    _parse_stream_payload,
    _split_sse_buffer,
    router,
)


def assert_true(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def make_client() -> TestClient:
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


def main() -> int:
    client = make_client()

    session_response = client.post("/v1/vr/session", json={})
    assert_true(session_response.status_code == 200, "session endpoint failed")
    session_payload = session_response.json()
    assert_true(session_payload.get("success") is True, "session response not successful")
    session = session_payload["session"]
    session_id = session["session_id"]
    assert_true(session_id.startswith("vr_sess_"), "invalid session id")
    assert_true("/ws/vr/events" in session["event_ws_url"], "missing websocket url")

    status_response = client.get("/v1/vr/status")
    assert_true(status_response.status_code == 200, "status endpoint failed")
    status = status_response.json()["status"]
    assert_true(status["gateway"]["mock_entry_path"] == "/quest3/", "unexpected mock entry path")
    assert_true("recommended_quest_url" in status["lan"], "missing recommended Quest URL")
    status_verification = status.get("verification") or {}
    assert_true(status_verification.get("counts", {}).get("needs_headset", 0) > 0, "status missing headset verification debt")

    profile_response = client.get("/v1/vr/profile", params={"session_id": session_id})
    assert_true(profile_response.status_code == 200, "profile endpoint failed")
    profile = profile_response.json()["profile"]
    assert_true(profile["assistant"]["name"] == "OpenXnet", "unexpected assistant name")
    assert_true("thinking" in profile["avatar"]["states"], "avatar states incomplete")
    verification_items = {item["key"]: item for item in profile["verification"]["items"]}
    assert_true(verification_items["gateway_session"]["status"] == "observed", "session verification missing")
    assert_true(verification_items["voice_asr_loop"]["status"] == "needs_headset", "ASR should remain headset-pending")

    tasks_response = client.get("/v1/vr/tasks", params={"session_id": session_id})
    assert_true(tasks_response.status_code == 200, "tasks endpoint failed")
    assert_true(isinstance(tasks_response.json().get("tasks"), list), "tasks not a list")

    sse_buffer = 'data: {"choices":[{"delta":{"content":"真实"}}]}\n\n'
    payloads, remainder = _split_sse_buffer(sse_buffer)
    assert_true(remainder == "", "SSE parser should not leave remainder")
    assert_true(len(payloads) == 1, "SSE parser did not return one payload")
    parsed = _parse_stream_payload(payloads[0])
    assert_true(_extract_delta_text(parsed) == "真实", "delta extraction failed")

    error_buffer = 'data: {"choices":[{"delta":{"tool_content":{"title":"Error","content":"模型不可用","type":"error"}}}]}\n\n'
    error_payloads, _ = _split_sse_buffer(error_buffer)
    parsed_error = _parse_stream_payload(error_payloads[0])
    assert_true(_extract_stream_error(parsed_error) == "模型不可用", "stream error extraction failed")

    with client.websocket_connect(f"/ws/vr/events?session_id={session_id}") as websocket:
        ready = websocket.receive_json()
        assert_true(ready["type"] == "session.ready", "websocket did not send session.ready")

        websocket.send_json({"type": "ping", "event_id": "evt_ping", "data": {}})
        pong = websocket.receive_json()
        assert_true(pong["type"] == "pong", "websocket did not pong")
        assert_true(pong.get("correlation_id") == "evt_ping", "pong correlation mismatch")

        websocket.send_json(
            {
                "type": "chat.send",
                "event_id": "evt_chat",
                "data": {
                    "conversation_id": "vr_conv_test",
                    "text": "测试 Quest 3 VR Gateway",
                    "mock": True,
                },
            }
        )

        seen_types = []
        assistant_text = ""
        for _ in range(40):
            event = websocket.receive_json()
            seen_types.append(event["type"])
            if event["type"] == "assistant.delta":
                assistant_text += event["data"]["text"]
            if event["type"] == "assistant.done":
                break

        assert_true("avatar.state" in seen_types, "missing avatar state event")
        assert_true("assistant.delta" in seen_types, "missing assistant delta event")
        assert_true("assistant.done" in seen_types, "missing assistant done event")
        assert_true("Quest 3" in assistant_text, "mock assistant text missing Quest 3 context")

    with client.websocket_connect(f"/ws/vr/events?session_id={session_id}") as websocket:
        ready = websocket.receive_json()
        assert_true(ready["type"] == "session.ready", "object websocket did not send session.ready")
        supported = ready["data"].get("supported_events") or []
        assert_true("object.action.result" in supported, "object action result not advertised")
        assert_true("controller.haptic.feedback" in supported, "haptic feedback event not advertised")

        websocket.send_json(
            {
                "type": "space.layout.update",
                "event_id": "evt_space",
                "data": {
                    "source": "smoke",
                    "mode": "mock_mr",
                    "status": "available",
                    "surface_count": 1,
                    "walkable_count": 1,
                    "occluder_count": 0,
                    "surfaces": [
                        {
                            "id": "floor",
                            "label": "Mock Floor",
                            "walkable": True,
                            "occluder": False,
                            "size": {"x": 3.2, "y": 2.4},
                            "position": {"x": 0, "y": 0, "z": 0},
                        }
                    ],
                },
            }
        )
        layout_event = websocket.receive_json()
        assert_true(layout_event["type"] == "space.layout.updated", "space layout was not stored")

        websocket.send_json(
            {
                "type": "object.catalog.update",
                "event_id": "evt_catalog",
                "data": {
                    "objects": [
                        {
                            "object_id": "openxnet_orb",
                            "label": "OpenXnet Orb",
                            "object_type": "sample_tool",
                            "semantic_action": "assistant_prompt",
                            "semantic_prompt": "Summarize the mock Quest space and suggest one next OpenXnet action.",
                            "position": {"x": -0.38, "y": 0.82, "z": 1.66},
                            "rotation": {"x": 0, "y": 0, "z": 0, "w": 1},
                        },
                        {
                            "object_id": "memory_capsule",
                            "label": "Memory Capsule",
                            "object_type": "sample_tool",
                            "semantic_action": "memory_summary",
                            "semantic_prompt": "Show recent OpenXnet task memory.",
                            "position": {"x": 0.42, "y": 0.89, "z": 1.66},
                            "rotation": {"x": 0, "y": 0, "z": 0, "w": 1},
                        },
                    ]
                },
            }
        )
        catalog_event = websocket.receive_json()
        assert_true(catalog_event["type"] == "object.catalog.updated", "object catalog was not stored")
        assert_true(catalog_event["data"]["object_count"] >= 2, "object catalog count too small")

        websocket.send_json(
            {
                "type": "object.interaction",
                "event_id": "evt_orb_activate",
                "data": {
                    "object_id": "openxnet_orb",
                    "label": "OpenXnet Orb",
                    "object_type": "sample_tool",
                    "semantic_action": "assistant_prompt",
                    "semantic_prompt": "Summarize the mock Quest space and suggest one next OpenXnet action.",
                    "action": "activate",
                    "source": "smoke",
                    "strength": 1.0,
                },
            }
        )

        seen_types = []
        action_result = None
        assistant_text = ""
        for _ in range(80):
            event = websocket.receive_json()
            seen_types.append(event["type"])
            if event["type"] == "object.action.result" and event["data"].get("semantic_action") == "assistant_prompt":
                action_result = event
            if event["type"] == "assistant.delta":
                assistant_text += event["data"]["text"]
            if event["type"] == "assistant.done":
                break

        assert_true("object.interaction" in seen_types, "missing orb interaction echo")
        assert_true(action_result is not None, "missing assistant_prompt action result")
        assert_true(action_result["data"]["status"] == "started", "assistant_prompt did not start")
        assert_true("assistant.delta" in seen_types, "assistant_prompt did not stream assistant text")
        assert_true("assistant.done" in seen_types, "assistant_prompt did not finish assistant stream")
        assert_true("OpenXnet" in assistant_text or "Quest" in assistant_text, "assistant prompt text missing context")

        websocket.send_json(
            {
                "type": "object.interaction",
                "event_id": "evt_memory_activate",
                "data": {
                    "object_id": "memory_capsule",
                    "label": "Memory Capsule",
                    "object_type": "sample_tool",
                    "semantic_action": "memory_summary",
                    "semantic_prompt": "Show recent OpenXnet task memory.",
                    "action": "activate",
                    "source": "smoke",
                    "strength": 1.0,
                },
            }
        )

        memory_result = None
        for _ in range(20):
            event = websocket.receive_json()
            if event["type"] == "object.action.result" and event["data"].get("semantic_action") == "memory_summary":
                memory_result = event
                break

        assert_true(memory_result is not None, "missing memory_summary action result")
        assert_true(memory_result["data"]["status"] == "ok", "memory_summary did not return ok")

    profile_response = client.get("/v1/vr/profile", params={"session_id": session_id})
    assert_true(profile_response.status_code == 200, "profile after events failed")
    profile = profile_response.json()["profile"]
    verification_items = {item["key"]: item for item in profile["verification"]["items"]}
    assert_true(verification_items["websocket_event_loop"]["status"] == "observed", "websocket verification missing")
    assert_true(verification_items["chat_stream"]["status"] == "observed", "chat stream verification missing")
    assert_true(verification_items["space_layout_protocol"]["status"] == "observed", "space layout protocol verification missing")
    assert_true(verification_items["object_catalog"]["status"] == "observed", "object catalog verification missing")
    assert_true(verification_items["object_interaction"]["status"] == "observed", "object interaction verification missing")
    assert_true(verification_items["object_semantic_action"]["status"] == "observed", "object semantic verification missing")
    assert_true(verification_items["hand_gesture"]["status"] == "needs_headset", "hand gesture must remain headset-pending")
    assert_true(verification_items["controller_haptics"]["status"] == "needs_headset", "haptics must remain headset-pending")
    assert_true(verification_items["mruk_space_layout"]["status"] == "needs_headset", "MRUK must remain headset-pending")

    print("VR Gateway smoke test passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
