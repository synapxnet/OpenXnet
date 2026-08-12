# -*- coding: utf-8 -*-
"""Pure runtime-profile policy for task HTTP route families."""

from __future__ import annotations

from dataclasses import dataclass


TASK_HTTP_FAMILY_BROKER = "desktop_broker"
TASK_HTTP_FAMILY_SERVER = "server_compatibility"
TASK_HTTP_FAMILY_UNRELATED = "unrelated"

TASK_EXECUTION_BROKER_PATHS = frozenset({
    "/v1/tasks/executor/preflight",
    "/v1/tasks/executor/session/turn",
    "/v1/tasks/executor/session/evaluate",
    "/v1/tasks/executor/session/cancel",
    "/v1/tasks/executor/delivery/dispatch",
})


@dataclass(frozen=True)
class TaskHttpProfilePolicy:
    """Describe visibility and authentication for one task HTTP path."""

    family: str
    visible: bool
    requires_bearer: bool


def classify_task_http_path(path: str) -> str:
    """Classify one exact request path into a stable task route family."""

    normalized = str(path or "").strip()
    if normalized in TASK_EXECUTION_BROKER_PATHS:
        return TASK_HTTP_FAMILY_BROKER
    if (
        normalized == "/v1/tasks"
        or normalized.startswith("/v1/tasks/")
        or normalized == "/v1/dev/workbench/tasks/create"
    ):
        return TASK_HTTP_FAMILY_SERVER
    return TASK_HTTP_FAMILY_UNRELATED


def resolve_task_http_profile_policy(
    runtime_profile: str,
    path: str,
) -> TaskHttpProfilePolicy:
    """Resolve route visibility and bearer requirements for one profile."""

    family = classify_task_http_path(path)
    normalized_profile = str(runtime_profile or "").strip().lower()
    is_desktop_boundary = normalized_profile in {"desktop", "execution-engine"}
    if family == TASK_HTTP_FAMILY_BROKER:
        return TaskHttpProfilePolicy(
            family=family,
            visible=True,
            requires_bearer=is_desktop_boundary,
        )
    if family == TASK_HTTP_FAMILY_SERVER:
        return TaskHttpProfilePolicy(
            family=family,
            visible=not is_desktop_boundary,
            requires_bearer=False,
        )
    return TaskHttpProfilePolicy(
        family=family,
        visible=True,
        requires_bearer=False,
    )
