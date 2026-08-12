#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
Execution Cortex — 执行皮层。

并行/串行工具调度、结果融合、执行追踪。
将认知皮层的计划转化为实际工具调用。

Author: Claude Code
Department: R&D
Date: 2026-04-19
Version: 1.0.0
Security Level: INTERNAL
"""

__version__ = "1.0.0"
__author__ = "Claude Code"
__copyright__ = "Copyright 2026 Synapxnet"

import asyncio
import logging
import time
from datetime import datetime
from typing import Any, Callable, Coroutine, Dict, List, Optional

logger = logging.getLogger("app")

ToolExecutor = Callable[[str, Dict[str, Any]], Coroutine[Any, Any, Dict[str, Any]]]


class ExecutionTrace:
    """Record of a single tool execution."""

    def __init__(self, tool: str, args: Dict[str, Any]):
        self.tool = tool
        self.args = args
        self.start_time = time.monotonic()
        self.started_at = datetime.now().isoformat()
        self.result: Optional[Dict[str, Any]] = None
        self.error: Optional[str] = None
        self.elapsed_ms: float = 0

    def complete(self, result: Dict[str, Any]) -> None:
        self.result = result
        self.elapsed_ms = round((time.monotonic() - self.start_time) * 1000, 1)

    def fail(self, error: str) -> None:
        self.error = error
        self.elapsed_ms = round((time.monotonic() - self.start_time) * 1000, 1)

    def to_dict(self) -> dict:
        return {
            "tool": self.tool,
            "started_at": self.started_at,
            "elapsed_ms": self.elapsed_ms,
            "success": self.error is None,
            "error": self.error,
        }


class ExecutionCortex:
    """Parallel/serial tool dispatch with result fusion."""

    def __init__(self):
        self._executors: Dict[str, ToolExecutor] = {}
        self._traces: List[Dict[str, Any]] = []
        self._stats = {
            "total_dispatches": 0,
            "parallel_dispatches": 0,
            "serial_dispatches": 0,
            "total_tools_run": 0,
            "total_errors": 0,
        }

    def register_executor(self, tool_name: str, executor: ToolExecutor) -> None:
        self._executors[tool_name] = executor

    async def dispatch_parallel(
        self, tasks: List[Dict[str, Any]], timeout: float = 30.0
    ) -> List[Dict[str, Any]]:
        """Execute multiple tool calls in parallel."""
        self._stats["total_dispatches"] += 1
        self._stats["parallel_dispatches"] += 1

        async def _run_one(task: Dict[str, Any]) -> Dict[str, Any]:
            tool = task.get("tool", "")
            args = task.get("args", {})
            trace = ExecutionTrace(tool, args)
            executor = self._executors.get(tool)
            if not executor:
                trace.fail(f"No executor registered for tool: {tool}")
                self._stats["total_errors"] += 1
                return {"tool": tool, "success": False, "error": trace.error}
            try:
                result = await executor(tool, args)
                trace.complete(result)
                self._stats["total_tools_run"] += 1
                return {"tool": tool, "success": True, "result": result}
            except Exception as exc:
                trace.fail(str(exc))
                self._stats["total_errors"] += 1
                return {"tool": tool, "success": False, "error": str(exc)}
            finally:
                self._traces.append(trace.to_dict())

        results = await asyncio.gather(
            *[asyncio.wait_for(_run_one(t), timeout=timeout) for t in tasks],
            return_exceptions=True,
        )
        return [
            r if isinstance(r, dict) else {"success": False, "error": str(r)}
            for r in results
        ]

    async def dispatch_serial(
        self, tasks: List[Dict[str, Any]], stop_on_error: bool = True
    ) -> List[Dict[str, Any]]:
        """Execute tool calls sequentially."""
        self._stats["total_dispatches"] += 1
        self._stats["serial_dispatches"] += 1
        results = []
        for task in tasks:
            tool = task.get("tool", "")
            args = task.get("args", {})
            trace = ExecutionTrace(tool, args)
            executor = self._executors.get(tool)
            if not executor:
                trace.fail(f"No executor for: {tool}")
                self._stats["total_errors"] += 1
                results.append({"tool": tool, "success": False, "error": trace.error})
                if stop_on_error:
                    break
                continue
            try:
                result = await executor(tool, args)
                trace.complete(result)
                self._stats["total_tools_run"] += 1
                results.append({"tool": tool, "success": True, "result": result})
            except Exception as exc:
                trace.fail(str(exc))
                self._stats["total_errors"] += 1
                results.append({"tool": tool, "success": False, "error": str(exc)})
                if stop_on_error:
                    break
            finally:
                self._traces.append(trace.to_dict())
        return results

    def fuse_results(self, results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Merge multiple tool results into a unified output."""
        successful = [r for r in results if r.get("success")]
        failed = [r for r in results if not r.get("success")]
        return {
            "total": len(results),
            "successful": len(successful),
            "failed": len(failed),
            "results": successful,
            "errors": [{"tool": f.get("tool"), "error": f.get("error")} for f in failed],
            "fused_at": datetime.now().isoformat(),
        }

    async def handle_signal(self, signal) -> Optional[Dict[str, Any]]:
        data = signal.data
        plan = data.get("plan", {})
        steps = plan.get("steps", [])
        if not steps:
            return {"dispatched": 0, "note": "no steps in plan"}
        strategy = plan.get("strategy", "direct")
        if strategy == "decompose":
            results = await self.dispatch_parallel(
                [{"tool": s.get("action", ""), "args": s} for s in steps]
            )
        else:
            results = await self.dispatch_serial(
                [{"tool": s.get("action", ""), "args": s} for s in steps],
                stop_on_error=False,
            )
        return self.fuse_results(results)

    def get_diagnostics(self) -> Dict[str, Any]:
        return {
            "registered_executors": list(self._executors.keys()),
            "stats": self._stats,
            "trace_count": len(self._traces),
            "recent_traces": self._traces[-10:],
        }

    def trim_traces(self, max_count: int = 200) -> int:
        if len(self._traces) <= max_count:
            return 0
        removed = len(self._traces) - max_count
        self._traces = self._traces[-max_count:]
        return removed


_cortex: Optional[ExecutionCortex] = None


def get_execution_cortex() -> ExecutionCortex:
    global _cortex
    if _cortex is None:
        _cortex = ExecutionCortex()
    return _cortex
