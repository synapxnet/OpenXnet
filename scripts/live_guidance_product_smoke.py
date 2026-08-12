#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Smoke test for productized non-interrupting live guidance.

Run local module checks:
    python scripts/live_guidance_product_smoke.py

Run local checks plus the running desktop backend:
    python scripts/live_guidance_product_smoke.py --live-url http://127.0.0.1:3456
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Dict

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from py.engine.query_engine import QueryEngine
from py.kernel.guidance import LiveGuidanceBus, format_guidance_context, get_guidance_bus


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


def get_json(url: str) -> Dict[str, Any]:
    request = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


def run_module_smoke() -> Dict[str, Any]:
    bus = LiveGuidanceBus()
    conv_id = "guidance-product-conversation"
    bus.add(text="prefer concise answer", conversation_id=conv_id, mode="soft", priority=0)
    bus.add(text="不要调用 shell，先重新规划", conversation_id=conv_id, mode="safety", priority=10)
    bus.add(text="global default guidance", conversation_id="", mode="constraint", priority=5)

    pending = bus.pending(conv_id)
    assert len(pending) == 3, pending
    consumed = bus.consume(conversation_id=conv_id)
    assert [item.mode for item in consumed] == ["safety", "constraint", "soft"], consumed
    assert len(bus.pending(conv_id)) == 0

    context = format_guidance_context(consumed)
    assert "[OpenXnet Live Guidance]" in context
    assert "不要调用 shell" in context
    assert "global default guidance" in context

    assert QueryEngine._is_risky_tool("shell_tool_local") is True
    assert QueryEngine._is_risky_tool("read_file_tool_local") is False

    return {
        "module": "ok",
        "consumed_modes": [item.mode for item in consumed],
        "context_lines": len(context.splitlines()),
    }


async def run_query_engine_consume_smoke() -> Dict[str, Any]:
    conv_id = "guidance-product-engine"
    bus = get_guidance_bus()
    bus.add(text="必须先解释再执行", conversation_id=conv_id, mode="constraint", priority=10)
    messages = [{"role": "user", "content": "smoke"}]
    engine = QueryEngine(
        client=None,
        model="smoke-model",
        messages=messages,
        tools=[],
        conversation_id=conv_id,
    )

    items = await engine._consume_live_guidance("before_llm")
    assert len(items) >= 1, items
    engine._flush_live_guidance_context()
    assert messages[-1]["role"] == "system", messages
    assert "必须先解释再执行" in messages[-1]["content"], messages[-1]

    return {
        "query_engine": "ok",
        "consumed": len(items),
        "system_context_injected": True,
    }


def run_live_smoke(base_url: str) -> Dict[str, Any]:
    base = base_url.rstrip("/")
    conv_id = "guidance-product-live"
    add_response = post_json(
        f"{base}/v1/kernel/guidance",
        {
            "text": "live smoke: switch to safer plan before risky tools",
            "conversation_id": conv_id,
            "mode": "safety",
            "priority": 10,
        },
    )
    assert add_response.get("ok") is True, add_response
    assert add_response["guidance"]["conversation_id"] == conv_id, add_response

    encoded = urllib.parse.quote(conv_id)
    list_response = get_json(f"{base}/v1/kernel/guidance?conversation_id={encoded}")
    pending = list_response.get("pending") or []
    assert any(item.get("text", "").startswith("live smoke:") for item in pending), list_response

    world_response = post_json(
        f"{base}/v1/kernel/world",
        {
            "messages": [{"role": "user", "content": "world state live guidance smoke"}],
            "model": "gpt-4",
            "include_recent": False,
        },
    )
    assert world_response.get("ok") is True, world_response
    world_text = json.dumps(world_response.get("world", {}), ensure_ascii=False)
    assert "guidance" in world_text.lower(), world_response

    return {
        "live": "ok",
        "url": base,
        "pending_for_conversation": len(pending),
        "queue_pending": list_response.get("status", {}).get("pending", 0),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--live-url", default="", help="Optional running OpenXnet backend URL.")
    args = parser.parse_args()

    output: Dict[str, Any] = {
        "module_smoke": run_module_smoke(),
        "query_engine_smoke": asyncio.run(run_query_engine_consume_smoke()),
    }

    if args.live_url:
        try:
            output["live_smoke"] = run_live_smoke(args.live_url)
        except (urllib.error.URLError, TimeoutError) as exc:
            raise SystemExit(f"live smoke failed to reach {args.live_url}: {exc}") from exc

    print(json.dumps(output, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
