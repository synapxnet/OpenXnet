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

        # [P1] Unique turn ID for checkpoint tracking
        self.turn_id = f"turn_{int(time.time()*1000)}_{uuid.uuid4().hex[:6]}"

    def _set_state(self, new_state: QueryState, tool_name: str = None):
        """Transition to a new state with optional checkpoint persistence."""
        self.state = new_state
        try:
            cp = get_engine_checkpoint()
            if cp:
                cp.update_state(self.turn_id, new_state.value, tool_name)
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
        # [Future] NeuroSymbol pre-neural context injection goes here

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
                    cp.fail_turn(self.turn_id, str(e))
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
        # [Future] NeuroSymbol post-neural crystallization goes here
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
                cp.complete_turn(self.turn_id)
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

            # ─── 2. Consume stream ───
            async for chunk in stream:
                if not chunk.choices:
                    continue

                delta = chunk.choices[0].delta

                # A: Text content delta
                if getattr(delta, 'content', None):
                    assistant_content += delta.content
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

                # Execute each tool
                for tc in tool_calls_list:
                    func_name = tc["function"]["name"]
                    func_args_str = tc["function"]["arguments"]
                    tool_id = tc["id"]

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

                    # ── Route: Plugin SDK first, then legacy ──
                    plugin = self.registry.get_tool(func_name)

                    if plugin:
                        # New Plugin SDK path
                        logger.info(f"[QueryEngine] SDK plugin: {func_name}")
                        self._set_state(QueryState.TOOL_EXECUTION, func_name)
                        result = await self.registry.execute_tool(func_name, **kwargs)
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

                    elif self.legacy_execute_tool:
                        # Bridge to old dispatch system
                        logger.info(f"[QueryEngine] Legacy dispatch: {func_name}")
                        self._set_state(QueryState.TOOL_EXECUTION, func_name)
                        try:
                            tool_output = await self.legacy_execute_tool(
                                func_name, kwargs, self.settings
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

                    else:
                        # No handler found at all
                        logger.warning(f"[QueryEngine] No handler for tool: {func_name}")
                        self.messages.append({
                            "role": "tool",
                            "tool_call_id": tool_id,
                            "name": func_name,
                            "content": f"Error: Tool '{func_name}' not found in registry or legacy dispatch.",
                        })

                # After processing all tool calls, loop back for LLM continuation
                self._set_state(QueryState.RESOLUTION)
                continue

            else:
                # No tool calls — turn is complete
                break

        yield "data: [DONE]\n\n"
