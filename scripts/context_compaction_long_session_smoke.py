#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Long-session smoke test for OpenXnet automatic context compression.

Run local module checks:
    python scripts/context_compaction_long_session_smoke.py

Run local module checks plus the running desktop backend:
    python scripts/context_compaction_long_session_smoke.py --live-url http://127.0.0.1:3456
"""

from __future__ import annotations

import argparse
import json
import sys
import tempfile
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict, List

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from py.context.compactor import ContextCompactor
from py.context.token_counter import estimate_messages_tokens
from py.kernel.conversation_state import build_conversation_state
from py.kernel.world_state import build_world_state
from py.memory.context_compressor import get_context_compressor


def build_long_session_messages(turns: int = 42) -> List[Dict[str, Any]]:
    messages: List[Dict[str, Any]] = [
        {
            "role": "system",
            "content": (
                "OpenXnet long-session compression smoke test. "
                "Keep the latest user intent, never expose raw secrets, and preserve tool protocol order."
            ),
        }
    ]
    for idx in range(turns):
        messages.append(
            {
                "role": "user",
                "content": (
                    f"old user turn {idx:02d}: "
                    + ("alpha beta gamma delta " * 180)
                    + f"unique-old-marker-{idx:02d}"
                ),
            }
        )
        messages.append(
            {
                "role": "assistant",
                "content": (
                    f"old assistant turn {idx:02d}: "
                    + ("reasoning trace and implementation notes " * 160)
                    + f"assistant-marker-{idx:02d}"
                ),
            }
        )

    messages.append(
        {
            "role": "user",
            "content": "recent turn: inspect the long-session context compressor boundary behavior.",
        }
    )
    messages.append(
        {
            "role": "assistant",
            "content": "",
            "tool_calls": [
                {
                    "id": f"tool-smoke-{idx}",
                    "type": "function",
                    "function": {"name": "context_probe", "arguments": json.dumps({"slot": idx})},
                }
                for idx in range(3)
            ],
        }
    )
    for idx in range(3):
        messages.append(
            {
                "role": "tool",
                "tool_call_id": f"tool-smoke-{idx}",
                "name": "context_probe",
                "content": (
                    f"tool result {idx}: "
                    + ("large but synthetic result payload " * 260)
                    + f"tool-marker-{idx}"
                ),
            }
        )
    messages.append(
        {
            "role": "user",
            "content": "LATEST_USER_SENTINEL: continue from the compressed context without losing current intent.",
        }
    )
    messages.append(
        {
            "role": "assistant",
            "content": "LATEST_ASSISTANT_SENTINEL: ready after compression.",
        }
    )
    return messages


def assert_no_orphan_tools(messages: List[Dict[str, Any]]) -> None:
    pending_tool_ids = set()
    for index, message in enumerate(messages):
        role = message.get("role")
        if role == "assistant":
            pending_tool_ids = {
                call.get("id")
                for call in (message.get("tool_calls") or [])
                if isinstance(call, dict) and call.get("id")
            }
            continue
        if role == "tool":
            tool_id = message.get("tool_call_id")
            assert tool_id in pending_tool_ids, f"orphan tool message at index {index}: {tool_id}"
            pending_tool_ids.discard(tool_id)
            continue
        pending_tool_ids = set()


def post_json(url: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


def run_module_smoke() -> Dict[str, Any]:
    messages = build_long_session_messages()
    pre_tokens = estimate_messages_tokens(messages)
    pre_state = build_conversation_state(messages, "gpt-4")

    assert pre_state.phase == "blocked", pre_state
    assert pre_state.should_pre_summarize is True
    assert pre_state.should_compact is True
    assert pre_state.should_block_growth is True

    compactor = ContextCompactor(
        model_id="gpt-4",
        max_context_tokens=12000,
        max_tool_result_chars=900,
        reserve_for_output=1024,
    )
    result = compactor.compact(messages)
    budget = compactor.max_tokens - compactor.reserve_for_output

    assert result.original_tokens == pre_tokens
    assert result.compacted_tokens <= budget, (result.compacted_tokens, budget)
    assert result.removed_messages > 0
    assert result.trimmed_tool_results >= 3
    assert_no_orphan_tools(result.messages)

    compacted_text = json.dumps(result.messages, ensure_ascii=False)
    assert "LATEST_USER_SENTINEL" in compacted_text
    assert "LATEST_ASSISTANT_SENTINEL" in compacted_text
    assert "unique-old-marker-00" not in compacted_text

    with tempfile.TemporaryDirectory(prefix="openxnet-context-smoke-") as tmp:
        settings = {
            "model": "gpt-4",
            "selectedProvider": "smoke",
            "temperature": 0.1,
            "max_tokens": 8192,
            "kernelSettings": {
                "enabled": True,
                "mode": "kernel",
                "contextCompression": {
                    "enabled": True,
                    "preSummarizeRatio": 0.6,
                    "compactRatio": 0.8,
                    "blockGrowthRatio": 0.95,
                },
            },
            "CLISettings": {
                "enabled": True,
                "cc_path": tmp,
                "permissionMode": "workspace-write",
            },
        }
        world = build_world_state(settings, messages=messages, model="gpt-4", include_recent=False)
        compression = world["conversation"]["contextCompression"]
        assert compression["automaticCompressionAvailable"] is True
        assert compression["shouldPreSummarizeNow"] is True
        assert compression["shouldCompactNow"] is True
        assert compression["shouldBlockGrowthNow"] is True
        assert world["conversation"]["rawMessagesReturned"] is False

        memory = get_context_compressor(tmp)
        units = memory.extract_atomic_memories(
            "user decided to keep the latest context sentinel. assistant must preserve tool protocol order.",
            source="context_compaction_long_session_smoke",
        )
        summary = memory.build_structured_summary(
            goal="Validate automatic long-session context compression.",
            constraints=["Do not return raw long messages.", "Do not orphan tool results."],
            progress=[f"Compacted {result.original_tokens} to {result.compacted_tokens} tokens."],
            key_decisions=["Keep current user intent and safe tool-chain boundaries."],
            next_steps=["Use live backend smoke when the desktop server is running."],
        )
        assert units
        assert summary.goal
        assert Path(tmp, ".agent", "memory", "structured_summaries.json").exists()

    return {
        "module": "ok",
        "original_tokens": result.original_tokens,
        "compacted_tokens": result.compacted_tokens,
        "removed_messages": result.removed_messages,
        "trimmed_tool_results": result.trimmed_tool_results,
        "retained_messages": len(result.messages),
        "state_phase": pre_state.phase,
    }


def run_live_smoke(base_url: str, messages: List[Dict[str, Any]]) -> Dict[str, Any]:
    base = base_url.rstrip("/")
    state_payload = {"messages": messages, "model": "gpt-4"}
    state_response = post_json(f"{base}/v1/kernel/conversation/state", state_payload)
    assert state_response.get("ok") is True, state_response
    state = state_response["state"]
    assert state["phase"] == "blocked", state
    assert state["should_compact"] is True, state
    assert state["should_block_growth"] is True, state

    world_response = post_json(
        f"{base}/v1/kernel/world",
        {"messages": messages, "model": "gpt-4", "include_recent": False},
    )
    assert world_response.get("ok") is True, world_response
    compression = world_response["world"]["conversation"]["contextCompression"]
    assert compression["automaticCompressionAvailable"] is True, compression
    assert compression["shouldCompactNow"] is True, compression
    assert compression["shouldBlockGrowthNow"] is True, compression

    return {
        "live": "ok",
        "url": base,
        "phase": state["phase"],
        "estimated_tokens": state["estimated_tokens"],
        "context_window": state["context_window"],
        "compression_enabled": compression["enabled"],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--live-url", default="", help="Optional running OpenXnet backend URL.")
    args = parser.parse_args()

    module_result = run_module_smoke()
    output: Dict[str, Any] = {"module_smoke": module_result}

    if args.live_url:
        try:
            output["live_smoke"] = run_live_smoke(args.live_url, build_long_session_messages())
        except (urllib.error.URLError, TimeoutError) as exc:
            raise SystemExit(f"live smoke failed to reach {args.live_url}: {exc}") from exc

    print(json.dumps(output, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
