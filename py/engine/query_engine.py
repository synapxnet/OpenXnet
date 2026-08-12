#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
QueryEngine 查询引擎 — 多轮工具调用编排器，支持自动重试和插件注入。

Author: maoyo
Department: 研发部
Date: 2026-04-13
Version: 1.0.0
Security Level: INTERNAL
"""

__version__ = "2.0.0"
__author__ = "maoyo"
__copyright__ = "Copyright 2026 Synapxnet"
__maintainer__ = "maoyo"
__email__ = "synapxnet@gmail.com"

"""
OpenXnet v0.5.2 — Production QueryEngine (query_engine.py)
==========================================================

Inspired by CC-Source's QueryEngine architecture.
This engine manages the full lifecycle of a single conversation turn.

State Machine:
  INIT → PRE_FLIGHT → IN_PROGRESS → TOOL_EXECUTION → RESOLUTION → POST_FLIGHT

Core design goals:
1. Decouple tool routing from streaming logic
2. Graceful error isolation (tool failure != stream crash) 
3. Bridge old execute_tool() dispatch + new PluginRegistry
4. Compatible SSE format for existing Electron frontend
5. [P1] Checkpoint persistence for crash recovery
"""

from enum import Enum
import json
import copy
import logging
import time
import uuid
from typing import AsyncGenerator, Dict, Any, List, Optional, Callable, Awaitable

from .plugin_registry import get_plugin_registry
from .checkpoint import get_engine_checkpoint

try:
    from py.context.compactor import ContextCompactor
    _HAS_COMPACTOR = True
except ImportError:
    _HAS_COMPACTOR = False

logger = logging.getLogger("query_engine")


class QueryState(Enum):
    INIT = "init"
    PRE_FLIGHT = "pre_flight"
    IN_PROGRESS = "in_progress"
    TOOL_EXECUTION = "tool_execution"
    RESOLUTION = "resolution"
    POST_FLIGHT = "post_flight"
    ERROR = "error"
    DONE = "done"


class QueryEngine:
    """
    Central state machine for managing a single conversation turn.
    
    Usage:
        engine = QueryEngine(config)
        async for chunk in engine.execute_turn():
            yield chunk  # SSE text/event-stream data
    """

    def __init__(
        self,
        client: Any,
        model: str,
        messages: List[Dict],
        tools: List[Dict],
        extra_params: Dict = None,
        # Bridge to old system
        legacy_execute_tool: Optional[Callable] = None,
        # Settings context
        settings: Optional[Dict] = None,
        user_prompt: str = "",
        # Reasoner (dual-model) support
        reasoner_client: Any = None,
        reasoner_extra: Dict = None,
        # NeuroSymbol hooks
        symbol_store: Any = None,
        # Thinking tag processing
        enable_thinking: bool = False,
        # Callbacks
        on_post_flight: Optional[Callable] = None,
        # Translation helper
        t: Optional[Callable] = None,
        # [v2.0] Context compression
        max_context_tokens: int = 0,
        # [v2.0] Abort controller
        abort_event: Optional['asyncio.Event'] = None,
        # [v2.0] Token cost tracking callback
        on_tokens_used: Optional[Callable] = None,
        # [v2.1] Live non-interrupting guidance
        conversation_id: str = "",
    ):
        self.client = client
        self.model = model
        self.messages = messages  # Mutable reference from caller
        self.extra_params = extra_params or {}
        self.settings = settings or {}
        self.user_prompt = user_prompt
        self.reasoner_client = reasoner_client
        self.reasoner_extra = reasoner_extra or {}
        self.enable_thinking = enable_thinking
        self.symbol_store = symbol_store
        self.on_post_flight = on_post_flight
        self.t = t or (lambda x: x)  # Fallback identity

        # Merge Plugin SDK tools with externally-passed tools
        self.registry = get_plugin_registry()
        sdk_tools = self.registry.get_openai_tools()
        
        # Deduplicate: if a tool name exists in both, prefer SDK version
        sdk_names = {t["function"]["name"] for t in sdk_tools}
        external_tools = [t for t in tools if t.get("function", {}).get("name") not in sdk_names]
        self.tools = external_tools + sdk_tools

        # Legacy bridge: the old execute_tool(name, params, settings) function
        self.legacy_execute_tool = legacy_execute_tool

        # State tracking
        self.state = QueryState.INIT
        self.tool_loop_count = 0
        self.max_tool_loops = 10
        self.turn_start_time = time.time()

        # [v2.0] Context compression
        self.max_context_tokens = max_context_tokens
        self.compactor = ContextCompactor(model_id=model) if _HAS_COMPACTOR and max_context_tokens > 0 else None

        # [v2.0] Abort controller
        self.abort_event = abort_event

        # [v2.0] Token cost tracking
        self.on_tokens_used = on_tokens_used
        self.turn_tokens = {"prompt": 0, "completion": 0, "total": 0}
        self.conversation_id = conversation_id or ""
        self._pending_live_guidance: List[Any] = []
        self._kernel_plan_context: Dict[str, Any] = {}

        # [P1] Unique turn ID for checkpoint tracking
        self.turn_id = f"turn_{int(time.time()*1000)}_{uuid.uuid4().hex[:6]}"
        self._checkpoint_last_flush_at = 0.0
        self._checkpoint_last_preview_len = 0

    async def _consume_live_guidance(self, stage: str, tool_name: str = "") -> List[Any]:
        """Consume queued user guidance at safe checkpoints."""
        try:
            from py.kernel.guidance import get_guidance_bus
            items = get_guidance_bus().consume(
                conversation_id=self.conversation_id,
                turn_id=self.turn_id,
                trace_id=tool_name or "",
            )
            if items:
                logger.info(f"[QueryEngine] Consumed {len(items)} live guidance item(s) at {stage}")
                self._pending_live_guidance.extend(items)
            return items
        except Exception as exc:
            logger.debug(f"[QueryEngine] Live guidance consume failed: {exc}")
            return []

    def _flush_live_guidance_context(self) -> None:
        """Append pending guidance as a system message before the next LLM call."""
        if not self._pending_live_guidance:
            return
        try:
            from py.kernel.guidance import format_guidance_context
            context = format_guidance_context(self._pending_live_guidance)
            if context:
                self.messages.append({"role": "system", "content": context})
                self._flush_checkpoint_snapshot()
        finally:
            self._pending_live_guidance = []

    def _planner_settings(self) -> Dict[str, Any]:
        kernel_settings = self.settings.get("kernelSettings", {}) if isinstance(self.settings, dict) else {}
        planner_settings = kernel_settings.get("planner", {}) if isinstance(kernel_settings, dict) else {}
        return planner_settings if isinstance(planner_settings, dict) else {}

    def _candidate_tool_names_for_plan(self) -> List[str]:
        planner_settings = self._planner_settings()
        try:
            limit = int(planner_settings.get("maxCandidateTools", 12) or 12)
        except Exception:
            limit = 12
        limit = max(1, min(limit, 50))
        names: List[str] = []
        seen = set()
        for tool in self.tools or []:
            name = ""
            if isinstance(tool, str):
                name = tool
            elif isinstance(tool, dict):
                fn = tool.get("function") if isinstance(tool.get("function"), dict) else {}
                name = str(tool.get("tool_name") or tool.get("name") or fn.get("name") or "")
            name = str(name or "").strip()
            if not name or name in seen:
                continue
            seen.add(name)
            names.append(name)
            if len(names) >= limit:
                break
        return names

    def _run_kernel_shadow_plan(self) -> None:
        """Create a dry-run KernelPlan for observability; never mutates tool execution."""
        try:
            from py.kernel.runtime import build_plan_trace_context, get_kernel_runtime

            planner_settings = self._planner_settings()
            result = get_kernel_runtime().plan_turn(
                self.settings,
                goal=self.user_prompt,
                messages=self.messages,
                model=self.model,
                candidate_tools=self._candidate_tool_names_for_plan(),
                include_world=planner_settings.get("includeWorldByDefault", True),
                source="query_engine",
                conversation_id=self.conversation_id,
                turn_id=self.turn_id,
                actor="system",
            )
            summary = result.get("summary") if isinstance(result, dict) else {}
            if isinstance(result, dict) and result.get("ok") and isinstance(summary, dict):
                self._kernel_plan_context = build_plan_trace_context(summary, result.get("plan"))
                logger.info(
                    "[KernelPlan] QueryEngine pre-flight plan %s status=%s risk=%s",
                    summary.get("plan_id", ""),
                    summary.get("status", ""),
                    summary.get("highestRisk", ""),
                )
                if planner_settings.get("injectIntoContext") is True:
                    self.messages.append({
                        "role": "system",
                        "content": (
                            "\n\n[OpenXnet KernelPlan Shadow]\n"
                            "Dry-run planning summary for awareness only; no tools have been executed by this plan.\n"
                            f"{json.dumps(summary, ensure_ascii=False)}\n"
                        ),
                    })
                    self._flush_checkpoint_snapshot()
        except Exception as exc:
            logger.debug(f"[KernelPlan] QueryEngine pre-flight skipped: {exc}")

    def _settings_with_kernel_plan_context(self) -> Dict[str, Any]:
        if not self._kernel_plan_context or not isinstance(self.settings, dict):
            return self.settings
        next_settings = dict(self.settings)
        next_settings["__kernel_plan_context"] = self._kernel_plan_context
        return next_settings

    @staticmethod
    def _is_risky_tool(tool_name: str) -> bool:
        lowered = (tool_name or "").lower()
        risky_parts = (
            "shell", "edit", "write", "delete", "remove", "docker", "process",
            "keyboard", "mouse", "click", "drag", "press", "hotkey",
        )
        return any(part in lowered for part in risky_parts)

    def _checkpoint_messages(self, assistant_preview: str = "") -> List[Dict[str, Any]]:
        """Build the latest recoverable checkpoint snapshot."""
        if not assistant_preview:
            return self.messages
        return [*self.messages, {"role": "assistant", "content": assistant_preview}]

    def _flush_checkpoint_snapshot(self, assistant_preview: str = ""):
        """Persist the latest conversation snapshot without changing state."""
        try:
            cp = get_engine_checkpoint()
            if cp:
                cp.update_state(
                    self.turn_id,
                    self.state.value,
                    messages=self._checkpoint_messages(assistant_preview),
                )
                self._checkpoint_last_flush_at = time.time()
                self._checkpoint_last_preview_len = len(assistant_preview or "")
        except Exception:
            pass

    def _maybe_flush_partial_checkpoint(self, assistant_preview: str):
        """Rate-limit partial streaming snapshot writes."""
        preview_len = len(assistant_preview or "")
        if preview_len <= 0:
            return

        now = time.time()
        if (
            preview_len - self._checkpoint_last_preview_len >= 240
            or now - self._checkpoint_last_flush_at >= 2.0
        ):
            self._flush_checkpoint_snapshot(assistant_preview=assistant_preview)

    def _set_state(self, new_state: QueryState, tool_name: str = None):
        """Transition to a new state with optional checkpoint persistence."""
        self.state = new_state
        try:
            cp = get_engine_checkpoint()
            if cp:
                cp.update_state(
                    self.turn_id,
                    new_state.value,
                    tool_name,
                    messages=self.messages,
                )
                self._checkpoint_last_flush_at = time.time()
                self._checkpoint_last_preview_len = 0
        except Exception:
            pass  # Checkpoint failure is non-fatal

    def _make_sse(self, tool_data: dict) -> str:
        """Produce an SSE chunk compatible with the existing frontend."""
        chunk = {
            "choices": [{
                "delta": {
                    "tool_content": tool_data,
                }
            }]
        }
        return f"data: {json.dumps(chunk)}\n\n"

    async def execute_turn(self) -> AsyncGenerator[str, None]:
        """
        The main generator yielding text/event-stream chunks.
        This is the drop-in replacement for the old `stream_generator`.
        """
        # [P1] Record turn start in checkpoint
        try:
            cp = get_engine_checkpoint()
            if cp:
                cp.start_turn(self.turn_id, self.model, self.user_prompt, self.messages)
        except Exception:
            pass

        self._set_state(QueryState.PRE_FLIGHT)
        self._run_kernel_shadow_plan()
        # [v2.0] Context compression in PRE_FLIGHT
        if self.compactor and self.max_context_tokens > 0:
            try:
                original_len = len(self.messages)
                self.messages = self.compactor.fit(self.messages, self.max_context_tokens)
                if len(self.messages) < original_len:
                    logger.info(f"[QueryEngine v2] Compressed {original_len} -> {len(self.messages)} messages")
            except Exception as comp_err:
                logger.warning(f"[QueryEngine v2] Context compression failed (non-fatal): {comp_err}")

        self._set_state(QueryState.IN_PROGRESS)

        try:
            async for chunk in self._main_loop():
                yield chunk
        except Exception as e:
            self._set_state(QueryState.ERROR)
            logger.error(f"[QueryEngine] Fatal error in main loop: {e}", exc_info=True)
            
            # [P1] Record error in checkpoint
            try:
                cp = get_engine_checkpoint()
                if cp:
                    cp.fail_turn(
                        self.turn_id,
                        str(e),
                        messages=self._checkpoint_messages(),
                    )
            except Exception:
                pass

            error_chunk = {
                "choices": [{
                    "delta": {
                        "tool_content": {
                            "title": "❎ Error",
                            "content": str(e),
                            "type": "error"
                        }
                    }
                }]
            }
            yield f"data: {json.dumps(error_chunk)}\n\n"
            yield "data: [DONE]\n\n"
            return

        self._set_state(QueryState.POST_FLIGHT)
        # [v2.0] Token cost tracking
        if self.on_tokens_used and self.turn_tokens["total"] > 0:
            try:
                await self.on_tokens_used(self.turn_tokens, self.model)
            except Exception as tc_err:
                logger.warning(f"[QueryEngine v2] Token tracking callback error: {tc_err}")

        # Post-flight hook (NeuroSymbol crystallization etc.)
        if self.on_post_flight:
            try:
                await self.on_post_flight(self.messages, self.user_prompt)
            except Exception as pf_err:
                logger.warning(f"[QueryEngine] Post-flight hook error (non-fatal): {pf_err}")

        self._set_state(QueryState.DONE)

        # [P1] Mark turn as completed in checkpoint
        try:
            cp = get_engine_checkpoint()
            if cp:
                cp.complete_turn(self.turn_id, messages=self.messages)
        except Exception:
            pass

    async def _main_loop(self) -> AsyncGenerator[str, None]:
        """
        The interruptible LLM ↔ Tool execution loop.
        Runs until either:
        - LLM returns a final text response (no tool calls)
        - Max tool loop iterations reached
        - An external tool needs client-side execution (yields pause marker)
        """
        while self.tool_loop_count < self.max_tool_loops:
            self.tool_loop_count += 1
            self._set_state(QueryState.IN_PROGRESS)

            await self._consume_live_guidance("before_llm")
            self._flush_live_guidance_context()

            # ─── 1. Call the LLM with streaming ───
            create_params = {
                "model": self.model,
                "messages": self.messages,
                "stream": True,
                "extra_body": self.extra_params,
            }
            if self.tools:
                create_params["tools"] = self.tools

            stream = await self.client.chat.completions.create(**create_params)

            assistant_content = ""
            tool_calls_buffer: Dict[int, Dict] = {}

            # ─── 2. Consume stream (with abort check) ───
            async for chunk in stream:
                # [v2.0] Cooperative cancellation check
                if self.abort_event and self.abort_event.is_set():
                    logger.info("[QueryEngine v2] Abort signal received, stopping stream")
                    break

                if not chunk.choices:
                    continue

                delta = chunk.choices[0].delta

                # [v2.0] Track usage if available
                if hasattr(chunk, 'usage') and chunk.usage:
                    self.turn_tokens["prompt"] += getattr(chunk.usage, 'prompt_tokens', 0)
                    self.turn_tokens["completion"] += getattr(chunk.usage, 'completion_tokens', 0)
                    self.turn_tokens["total"] += getattr(chunk.usage, 'total_tokens', 0)

                # A: Text content delta
                if getattr(delta, 'content', None):
                    assistant_content += delta.content
                    self._maybe_flush_partial_checkpoint(assistant_content)
                    yield f"data: {chunk.model_dump_json()}\n\n"

                # B: Tool call accumulation
                elif getattr(delta, 'tool_calls', None):
                    for tc in delta.tool_calls:
                        idx = tc.index
                        if idx not in tool_calls_buffer:
                            tool_calls_buffer[idx] = {
                                "id": tc.id or "",
                                "type": "function",
                                "function": {
                                    "name": getattr(tc.function, "name", "") or "",
                                    "arguments": getattr(tc.function, "arguments", "") or ""
                                }
                            }
                        else:
                            if tc.id:
                                tool_calls_buffer[idx]["id"] = tc.id
                            if tc.function:
                                if tc.function.name:
                                    tool_calls_buffer[idx]["function"]["name"] = tc.function.name
                                if tc.function.arguments:
                                    tool_calls_buffer[idx]["function"]["arguments"] += tc.function.arguments

            # ─── 3. Post-stream: append assistant message ───
            if assistant_content and not tool_calls_buffer:
                self.messages.append({"role": "assistant", "content": assistant_content})
                self._flush_checkpoint_snapshot()

            # ─── 4. Tool execution phase ───
            if tool_calls_buffer:
                self._set_state(QueryState.TOOL_EXECUTION)
                tool_calls_list = [tool_calls_buffer[i] for i in sorted(tool_calls_buffer.keys())]

                # Append the assistant's tool_calls message to history
                self.messages.append({
                    "role": "assistant",
                    "content": assistant_content or "",
                    "reasoning_content": "",
                    "tool_calls": tool_calls_list,
                })
                self._flush_checkpoint_snapshot()

                # Execute each tool
                for tc in tool_calls_list:
                    func_name = tc["function"]["name"]
                    func_args_str = tc["function"]["arguments"]
                    tool_id = tc["id"]

                    live_items = await self._consume_live_guidance("before_tool", func_name)
                    should_skip_tool = (
                        self._is_risky_tool(func_name)
                        and any(getattr(item, "mode", "") in {"constraint", "safety", "interrupt"} for item in live_items)
                    )

                    try:
                        kwargs = json.loads(func_args_str) if func_args_str else {}
                    except json.JSONDecodeError:
                        kwargs = {}

                    # ── Emit "call" event to frontend (lock UI) ──
                    call_chunk = {
                        "choices": [{
                            "delta": {
                                "tool_call_id": tool_id,
                                "tool_content": {
                                    "title": func_name,
                                    "content": func_args_str,
                                    "type": "call"
                                }
                            }
                        }]
                    }
                    yield f"data: {json.dumps(call_chunk)}\n\n"

                    if should_skip_tool:
                        tool_output = (
                            "Skipped by OpenXnet live guidance before execution. "
                            "The user added a constraint or safety correction during this turn; "
                            "re-plan before using this risky tool."
                        )
                        result_chunk = {
                            "choices": [{
                                "delta": {
                                    "tool_call_id": tool_id,
                                    "tool_content": {
                                        "title": func_name,
                                        "content": tool_output,
                                        "type": "tool_result"
                                    }
                                }
                            }]
                        }
                        yield f"data: {json.dumps(result_chunk)}\n\n"
                        self.messages.append({
                            "role": "tool",
                            "tool_call_id": tool_id,
                            "name": func_name,
                            "content": tool_output,
                        })
                        self._flush_checkpoint_snapshot()
                        continue

                    # ── Route: Plugin SDK first, then legacy ──
                    plugin = self.registry.get_tool(func_name)

                    if plugin:
                        # New Plugin SDK path
                        logger.info(f"[QueryEngine] SDK plugin: {func_name}")
                        self._set_state(QueryState.TOOL_EXECUTION, func_name)
                        from py.kernel.executor import get_kernel_executor

                        async def _plugin_call():
                            return await self.registry.execute_tool(func_name, **kwargs)

                        result = await get_kernel_executor().execute_tool(
                            tool_name=func_name,
                            tool_params=kwargs,
                            settings=self._settings_with_kernel_plan_context(),
                            legacy_call=_plugin_call,
                            actor="model",
                            metadata={
                                "query_engine": True,
                                "dispatcher": "plugin_sdk",
                                "legacy_dispatcher": False,
                            },
                        )
                        tool_output = result["data"] if result["success"] else result["error_message"]
                        ui_title = result.get("ui_title", func_name)

                        # Emit result
                        result_chunk = {
                            "choices": [{
                                "delta": {
                                    "tool_call_id": tool_id,
                                    "tool_content": {
                                        "title": ui_title,
                                        "content": str(tool_output),
                                        "type": "tool_result"
                                    }
                                }
                            }]
                        }
                        yield f"data: {json.dumps(result_chunk)}\n\n"

                        self.messages.append({
                            "role": "tool",
                            "tool_call_id": tool_id,
                            "name": func_name,
                            "content": str(tool_output),
                        })
                        self._flush_checkpoint_snapshot()

                    elif self.legacy_execute_tool:
                        # Bridge to old dispatch system
                        logger.info(f"[QueryEngine] Legacy dispatch: {func_name}")
                        self._set_state(QueryState.TOOL_EXECUTION, func_name)
                        try:
                            tool_output = await self.legacy_execute_tool(
                                func_name, kwargs, self._settings_with_kernel_plan_context()
                            )
                        except Exception as tool_err:
                            logger.error(f"[QueryEngine] Tool {func_name} error: {tool_err}")
                            tool_output = f"Error: {str(tool_err)}"

                        if tool_output is None:
                            # External tool — frontend must handle
                            ext_chunk = {
                                "id": "extra_tools",
                                "choices": [{
                                    "index": 0,
                                    "delta": {
                                        "role": "assistant",
                                        "content": "",
                                        "tool_calls": func_args_str,
                                    }
                                }]
                            }
                            self._flush_checkpoint_snapshot()
                            yield f"data: {json.dumps(ext_chunk)}\n\n"
                            return  # Interrupt — let frontend handle

                        # Emit result
                        result_chunk = {
                            "choices": [{
                                "delta": {
                                    "tool_call_id": tool_id,
                                    "tool_content": {
                                        "title": func_name,
                                        "content": str(tool_output),
                                        "type": "tool_result"
                                    }
                                }
                            }]
                        }
                        yield f"data: {json.dumps(result_chunk)}\n\n"

                        self.messages.append({
                            "role": "tool",
                            "tool_call_id": tool_id,
                            "name": func_name,
                            "content": str(tool_output),
                        })
                        self._flush_checkpoint_snapshot()

                    else:
                        # No handler found at all
                        logger.warning(f"[QueryEngine] No handler for tool: {func_name}")
                        self.messages.append({
                            "role": "tool",
                            "tool_call_id": tool_id,
                            "name": func_name,
                            "content": f"Error: Tool '{func_name}' not found in registry or legacy dispatch.",
                        })
                        self._flush_checkpoint_snapshot()

                # After processing all tool calls, loop back for LLM continuation
                self._set_state(QueryState.RESOLUTION)
                continue

            else:
                # No tool calls — turn is complete
                break

        yield "data: [DONE]\n\n"
