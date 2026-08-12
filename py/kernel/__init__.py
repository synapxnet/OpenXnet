#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.

"""OpenXnet Neural-Symbolic OS Kernel."""

__version__ = "1.0.0"

from py.kernel.facade import KernelFacade, get_kernel
from py.kernel.bootstrap import bootstrap_kernel
from py.kernel.runtime import (
    KernelRuntime,
    apply_runtime_mode_profile,
    build_plan_trace_context,
    get_kernel_runtime,
    kernel_mode_profile,
    normalize_runtime_mode,
)
from py.kernel.approval import get_approval_center
from py.kernel.config_intent import parse_config_intent, apply_config_intent
from py.kernel.event_bus import get_kernel_event_bus
from py.kernel.executor import get_kernel_executor
from py.kernel.guidance import get_guidance_bus
from py.kernel.planner import build_kernel_plan
from py.kernel.policy import get_policy_gate, should_enforce_policy
from py.kernel.system_manifest import build_system_manifest
from py.kernel.timeline import build_plan_timeline
