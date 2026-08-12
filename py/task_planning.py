#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
Task planning metadata helpers.

This module keeps schedule and delivery target normalization in one place so
Task Center, APIs, and UI can share the same lightweight planning skeleton
before a full scheduler is introduced.
"""

__version__ = "1.0.0"
__author__ = "maoyo"
__copyright__ = "Copyright 2026 Synapxnet"
__maintainer__ = "maoyo"
__email__ = "synapxnet@gmail.com"

from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional

SCHEDULE_TYPE_MANUAL = "manual"
SCHEDULE_TYPE_ONCE = "once"
SCHEDULE_TYPE_RECURRING = "recurring"

DELIVERY_TARGET_TASK_CENTER = "task_center"
DELIVERY_TARGET_DESKTOP_NOTIFICATION = "desktop_notification"
DELIVERY_TARGET_IM_BOT = "im_bot"
DELIVERY_TARGET_DYNAMIC_ISLAND = "dynamic_island"
DELIVERY_TARGET_TELEGRAM = "telegram"
DELIVERY_TARGET_DISCORD = "discord"
DELIVERY_TARGET_WEBHOOK = "webhook"
DELIVERY_TARGET_NONE = "none"

VALID_SCHEDULE_TYPES = {
    SCHEDULE_TYPE_MANUAL,
    SCHEDULE_TYPE_ONCE,
    SCHEDULE_TYPE_RECURRING,
}

VALID_DELIVERY_TARGETS = {
    DELIVERY_TARGET_TASK_CENTER,
    DELIVERY_TARGET_DESKTOP_NOTIFICATION,
    DELIVERY_TARGET_IM_BOT,
    DELIVERY_TARGET_DYNAMIC_ISLAND,
    DELIVERY_TARGET_TELEGRAM,
    DELIVERY_TARGET_DISCORD,
    DELIVERY_TARGET_WEBHOOK,
    DELIVERY_TARGET_NONE,
}

VALID_DELIVERY_STATUSES = {
    "configured",
    "scheduled",
    "queued",
    "retry_scheduled",
    "in_progress",
    "delivered",
    "failed",
    "disabled",
}

SCHEDULE_TYPE_ALIASES = {
    "": SCHEDULE_TYPE_MANUAL,
    "manual": SCHEDULE_TYPE_MANUAL,
    "on_demand": SCHEDULE_TYPE_MANUAL,
    "ondemand": SCHEDULE_TYPE_MANUAL,
    "manual_only": SCHEDULE_TYPE_MANUAL,
    "once": SCHEDULE_TYPE_ONCE,
    "single": SCHEDULE_TYPE_ONCE,
    "one_time": SCHEDULE_TYPE_ONCE,
    "one-time": SCHEDULE_TYPE_ONCE,
    "scheduled_once": SCHEDULE_TYPE_ONCE,
    "recurring": SCHEDULE_TYPE_RECURRING,
    "repeat": SCHEDULE_TYPE_RECURRING,
    "repeating": SCHEDULE_TYPE_RECURRING,
    "cron": SCHEDULE_TYPE_RECURRING,
    "interval": SCHEDULE_TYPE_RECURRING,
    "scheduled": SCHEDULE_TYPE_RECURRING,
}

DELIVERY_TARGET_ALIASES = {
    "task_center": DELIVERY_TARGET_TASK_CENTER,
    "task-center": DELIVERY_TARGET_TASK_CENTER,
    "taskcenter": DELIVERY_TARGET_TASK_CENTER,
    "center": DELIVERY_TARGET_TASK_CENTER,
    "desktop_notification": DELIVERY_TARGET_DESKTOP_NOTIFICATION,
    "desktop-notification": DELIVERY_TARGET_DESKTOP_NOTIFICATION,
    "desktop": DELIVERY_TARGET_DESKTOP_NOTIFICATION,
    "notification": DELIVERY_TARGET_DESKTOP_NOTIFICATION,
    "im_bot": DELIVERY_TARGET_IM_BOT,
    "im-bot": DELIVERY_TARGET_IM_BOT,
    "imbot": DELIVERY_TARGET_IM_BOT,
    "robot": DELIVERY_TARGET_IM_BOT,
    "dynamic_island": DELIVERY_TARGET_DYNAMIC_ISLAND,
    "dynamic-island": DELIVERY_TARGET_DYNAMIC_ISLAND,
    "dynamicisland": DELIVERY_TARGET_DYNAMIC_ISLAND,
    "island": DELIVERY_TARGET_DYNAMIC_ISLAND,
    "telegram": DELIVERY_TARGET_TELEGRAM,
    "tg": DELIVERY_TARGET_TELEGRAM,
    "discord": DELIVERY_TARGET_DISCORD,
    "dc": DELIVERY_TARGET_DISCORD,
    "webhook": DELIVERY_TARGET_WEBHOOK,
    "http": DELIVERY_TARGET_WEBHOOK,
    "none": DELIVERY_TARGET_NONE,
    "disabled": DELIVERY_TARGET_NONE,
    "off": DELIVERY_TARGET_NONE,
}

DELIVERY_TARGET_LABELS = {
    DELIVERY_TARGET_TASK_CENTER: "Task Center",
    DELIVERY_TARGET_DESKTOP_NOTIFICATION: "Desktop Notification",
    DELIVERY_TARGET_IM_BOT: "IM Bot",
    DELIVERY_TARGET_DYNAMIC_ISLAND: "Dynamic Island",
    DELIVERY_TARGET_TELEGRAM: "Telegram",
    DELIVERY_TARGET_DISCORD: "Discord",
    DELIVERY_TARGET_WEBHOOK: "Webhook",
    DELIVERY_TARGET_NONE: "None",
}

DELIVERY_STATUS_LABELS = {
    "configured": "Configured",
    "scheduled": "Scheduled",
    "queued": "Queued",
    "retry_scheduled": "Retry Scheduled",
    "in_progress": "In Progress",
    "delivered": "Delivered",
    "failed": "Failed",
    "disabled": "Disabled",
}


def normalize_schedule_type(value: Optional[Any]) -> str:
    normalized = str(value or "").strip().lower()
    return SCHEDULE_TYPE_ALIASES.get(normalized, SCHEDULE_TYPE_MANUAL)


def normalize_iso_datetime(value: Optional[Any]) -> Optional[str]:
    text = str(value or "").strip()
    if not text:
        return None

    candidate = text.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(candidate).isoformat()
    except ValueError:
        return None


def normalize_schedule_expression(value: Optional[Any], max_length: int = 240) -> str:
    text = " ".join(str(value or "").split())
    return text[:max_length]


def _coerce_string_items(value: Optional[Any]) -> List[str]:
    if value is None:
        return []
    if isinstance(value, str):
        raw_text = value.replace(";", ",").replace("\n", ",")
        return [item.strip() for item in raw_text.split(",") if item.strip()]
    if isinstance(value, Iterable) and not isinstance(value, (bytes, bytearray, dict)):
        items: List[str] = []
        for item in value:
            normalized = str(item or "").strip()
            if normalized:
                items.append(normalized)
        return items
    normalized = str(value or "").strip()
    return [normalized] if normalized else []


def normalize_delivery_targets(
    value: Optional[Any],
    default_targets: Optional[List[str]] = None,
) -> List[str]:
    normalized_targets: List[str] = []
    for item in _coerce_string_items(value):
        target = DELIVERY_TARGET_ALIASES.get(item.strip().lower())
        if not target or target in normalized_targets:
            continue
        normalized_targets.append(target)

    if DELIVERY_TARGET_NONE in normalized_targets and len(normalized_targets) > 1:
        normalized_targets = [target for target in normalized_targets if target != DELIVERY_TARGET_NONE]

    if not normalized_targets:
        fallback = default_targets or [DELIVERY_TARGET_TASK_CENTER]
        normalized_targets = [
            DELIVERY_TARGET_ALIASES.get(str(item or "").strip().lower(), str(item or "").strip().lower())
            for item in fallback
            if str(item or "").strip()
        ]
        normalized_targets = [item for item in normalized_targets if item in VALID_DELIVERY_TARGETS]

    if not normalized_targets:
        normalized_targets = [DELIVERY_TARGET_TASK_CENTER]

    return normalized_targets


def get_delivery_target_label(target: Optional[str]) -> str:
    normalized = str(target or "").strip().lower()
    return DELIVERY_TARGET_LABELS.get(normalized, normalized.replace("_", " ").title())


def get_delivery_status_label(status: Optional[str]) -> str:
    normalized = str(status or "").strip().lower()
    return DELIVERY_STATUS_LABELS.get(normalized, normalized.replace("_", " ").title())


def is_planned_task_context(context: Optional[Dict[str, Any]]) -> bool:
    payload = dict(context or {})
    schedule_type = normalize_schedule_type(payload.get("schedule_type"))
    schedule_expression = normalize_schedule_expression(payload.get("schedule_expression"))
    next_run_at = normalize_iso_datetime(payload.get("next_run_at"))
    return bool(
        schedule_type in {SCHEDULE_TYPE_ONCE, SCHEDULE_TYPE_RECURRING}
        or schedule_expression
        or next_run_at
    )


def build_schedule_summary(
    schedule_type: str,
    schedule_expression: str = "",
    next_run_at: Optional[str] = None,
) -> str:
    if schedule_type == SCHEDULE_TYPE_MANUAL:
        return "Run on demand"
    if schedule_type == SCHEDULE_TYPE_ONCE:
        if next_run_at:
            return f"One-time run at {next_run_at}"
        if schedule_expression:
            return f"One-time plan: {schedule_expression}"
        return "One-time planned task"
    if next_run_at and schedule_expression:
        return f"Recurring: {schedule_expression} | Next: {next_run_at}"
    if schedule_expression:
        return f"Recurring: {schedule_expression}"
    if next_run_at:
        return f"Recurring task | Next: {next_run_at}"
    return "Recurring planned task"


def normalize_task_plan_context(
    context: Optional[Dict[str, Any]],
    default_delivery_targets: Optional[List[str]] = None,
) -> Dict[str, Any]:
    normalized = dict(context or {})

    schedule_expression = normalize_schedule_expression(normalized.get("schedule_expression"))
    next_run_at = normalize_iso_datetime(normalized.get("next_run_at"))
    last_run_at = normalize_iso_datetime(normalized.get("last_run_at"))
    last_delivery_at = normalize_iso_datetime(normalized.get("last_delivery_at"))
    schedule_type = normalize_schedule_type(normalized.get("schedule_type"))

    if schedule_type == SCHEDULE_TYPE_MANUAL:
        if schedule_expression:
            schedule_type = SCHEDULE_TYPE_RECURRING
        elif next_run_at:
            schedule_type = SCHEDULE_TYPE_ONCE

    delivery_targets = normalize_delivery_targets(
        normalized.get("delivery_targets"),
        default_targets=default_delivery_targets,
    )

    delivery_status = str(normalized.get("delivery_status") or "").strip().lower()
    if delivery_targets == [DELIVERY_TARGET_NONE]:
        delivery_status = "disabled"
        last_delivery_at = None
    elif delivery_status not in VALID_DELIVERY_STATUSES:
        delivery_status = "scheduled" if (
            schedule_type in {SCHEDULE_TYPE_ONCE, SCHEDULE_TYPE_RECURRING}
            or next_run_at
        ) else "configured"

    normalized.update(
        {
            "schedule_type": schedule_type,
            "schedule_expression": schedule_expression,
            "schedule_summary": build_schedule_summary(
                schedule_type=schedule_type,
                schedule_expression=schedule_expression,
                next_run_at=next_run_at,
            ),
            "schedule_timezone": str(normalized.get("schedule_timezone") or "").strip(),
            "next_run_at": next_run_at,
            "last_run_at": last_run_at,
            "delivery_targets": delivery_targets,
            "delivery_status": delivery_status,
            "delivery_status_label": get_delivery_status_label(delivery_status),
            "delivery_target_labels": [get_delivery_target_label(item) for item in delivery_targets],
            "last_delivery_at": last_delivery_at,
            "is_planned_task": bool(
                schedule_type in {SCHEDULE_TYPE_ONCE, SCHEDULE_TYPE_RECURRING}
                or schedule_expression
                or next_run_at
            ),
        }
    )
    return normalized
