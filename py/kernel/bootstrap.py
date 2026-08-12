#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""Single bootstrap entry for OpenXnet kernel startup wiring."""

from __future__ import annotations

import logging
from typing import Any, Callable, Dict, Optional

from py.kernel.runtime import KernelRuntime, get_kernel_runtime


def bootstrap_kernel(
    *,
    settings: Optional[Dict[str, Any]] = None,
    symbol_store: Any = None,
    logger: Optional[logging.Logger] = None,
    schedule_task: Optional[Callable[[Any], Any]] = None,
) -> KernelRuntime:
    """Initialize the kernel runtime without making server.py own the details."""
    log = logger or logging.getLogger("app")
    runtime = get_kernel_runtime()
    runtime.configure(settings or {})

    if not runtime.enabled:
        runtime.mark_component("bootstrap", "skipped", reason="runtime_disabled")
        runtime.mark_initialized()
        log.info("[KernelRuntime] Bootstrap skipped because runtime is disabled")
        return runtime

    try:
        runtime.init_cortex()

        runtime.mark_component(
            "vector_index",
            "deferred",
            trigger="first_query",
            symbol_store_available=bool(symbol_store),
        )
        runtime.mark_component("bootstrap", "ready")
        runtime.mark_initialized()
        log.info(f"[KernelRuntime] Neural-Symbolic OS Kernel initialized in {runtime.mode} mode")
    except Exception as exc:
        runtime.degrade(str(exc), component="bootstrap")
        log.warning(f"[KernelRuntime] Initialization degraded (non-fatal): {exc}")
    return runtime
