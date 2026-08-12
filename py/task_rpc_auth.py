# -*- coding: utf-8 -*-
"""Pure authorization policy for desktop task RPC routes."""

from __future__ import annotations

import secrets

from py.task_http_profile import resolve_task_http_profile_policy


def is_desktop_task_rpc_path(path: str) -> bool:
    """Return whether one path is an authenticated Desktop task broker."""

    return resolve_task_http_profile_policy("desktop", path).requires_bearer


def is_authorized_desktop_task_rpc(
    *,
    runtime_profile: str,
    expected_token: str,
    path: str,
    authorization: str,
) -> bool:
    """Validate the process-scoped bearer token for a protected desktop route."""

    policy = resolve_task_http_profile_policy(runtime_profile, path)
    if not policy.visible:
        return False
    if not policy.requires_bearer:
        return True
    token = str(expected_token or "").strip()
    if not token:
        return False
    header = str(authorization or "").strip()
    prefix = "Bearer "
    if not header.startswith(prefix):
        return False
    return secrets.compare_digest(header[len(prefix):], token)
