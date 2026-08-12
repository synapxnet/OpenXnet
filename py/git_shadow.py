#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
Git Shadow - 本地 Git 操作封装，支持自动提交和分支管理。
Author: maoyo
Department: 研发部
Date: 2026-04-13
Version: 1.0.0
Security Level: INTERNAL
"""

__version__ = "1.0.0"
__author__ = "maoyo"
__copyright__ = "Copyright 2026 Synapxnet"
__maintainer__ = "maoyo"
__email__ = "synapxnet@gmail.com"

"""
OpenXnet v0.5.2 - Git Shadow Commit (git_shadow.py)
====================================================

P0 韧性机制：在每次文件编辑工具执行前，自动创建 git checkpoint。
本轮继续补强为：
1. Git 仓库可用时优先走 git checkpoint
2. 非 Git 工作区或 git checkpoint 跳过时，自动落 File Shadow 快照
3. Recall Center 统一读取 workspace checkpoints（Git + File Shadow）
"""

import asyncio
import hashlib
import json
import logging
import os
import re
import shutil
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

from py.get_setting import USER_DATA_DIR

logger = logging.getLogger("git_shadow")

FILE_SHADOW_DIR = Path(USER_DATA_DIR) / "file_shadow"
FILE_SHADOW_INDEX = FILE_SHADOW_DIR / "index.jsonl"

# Git commit rate limiter: only for git commits, not for file shadow snapshots.
_last_git_checkpoint_time: float = 0.0
_CHECKPOINT_MIN_GAP_SECONDS = 2.0
_last_shadow_fingerprints: dict[str, str] = {}


def _decision_log_path(cwd: str) -> Path:
    return Path(cwd).resolve() / ".agent" / "decision_log.jsonl"


async def _run_git(cwd: str, *args) -> tuple[int, str, str]:
    """Execute a git command asynchronously, return (returncode, stdout, stderr)."""
    try:
        proc = await asyncio.create_subprocess_exec(
            "git",
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=cwd,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=10)
        return (
            proc.returncode,
            stdout.decode("utf-8", errors="replace").strip(),
            stderr.decode("utf-8", errors="replace").strip(),
        )
    except asyncio.TimeoutError:
        logger.warning("[GitShadow] git command timed out")
        return (-1, "", "timeout")
    except FileNotFoundError:
        logger.debug("[GitShadow] git not installed")
        return (-1, "", "git not found")
    except Exception as e:
        logger.debug(f"[GitShadow] git command failed: {e}")
        return (-1, "", str(e))


async def is_git_repo(cwd: str) -> bool:
    """Check if cwd is inside a git repository."""
    code, _, _ = await _run_git(cwd, "rev-parse", "--is-inside-work-tree")
    return code == 0


def _workspace_key(cwd: str) -> str:
    resolved = str(Path(cwd).resolve())
    return hashlib.sha1(resolved.encode("utf-8")).hexdigest()[:16]


def _normalize_file_path(cwd: str, file_path: str) -> tuple[Path, str]:
    candidate = Path(file_path)
    if not candidate.is_absolute():
        candidate = Path(cwd) / candidate
    candidate = candidate.resolve(strict=False)

    try:
        relative = candidate.relative_to(Path(cwd).resolve())
        rel_path = str(relative).replace("\\", "/")
    except Exception:
        rel_path = candidate.name
    return candidate, rel_path


def _ensure_file_shadow_storage():
    FILE_SHADOW_DIR.mkdir(parents=True, exist_ok=True)
    FILE_SHADOW_INDEX.parent.mkdir(parents=True, exist_ok=True)


def _append_shadow_record(record: dict):
    _ensure_file_shadow_storage()
    with open(FILE_SHADOW_INDEX, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


def _parse_checkpoint_timestamp(value: str) -> float:
    if not value:
        return 0.0
    for parser in (
        lambda raw: datetime.fromisoformat(raw),
        lambda raw: datetime.strptime(raw, "%Y-%m-%d %H:%M:%S %z"),
    ):
        try:
            return parser(value).timestamp()
        except Exception:
            continue
    return 0.0


def _read_shadow_records(
    workspace_key: str, count: Optional[int] = 20
) -> list[dict]:
    if not FILE_SHADOW_INDEX.exists():
        return []

    records: list[dict] = []
    with open(FILE_SHADOW_INDEX, "r", encoding="utf-8") as f:
        for line in f:
            raw = line.strip()
            if not raw:
                continue
            try:
                entry = json.loads(raw)
            except Exception:
                continue
            if entry.get("workspace_key") != workspace_key:
                continue
            entry["source"] = "file_shadow"
            snapshot_path = str(entry.get("snapshot_path") or "").strip()
            rollback_supported = bool(snapshot_path and Path(snapshot_path).exists())
            if entry.get("existed_before_edit") is False:
                rollback_supported = True
            entry["rollback_supported"] = rollback_supported
            records.append(entry)

    records.sort(
        key=lambda item: _parse_checkpoint_timestamp(item.get("timestamp", "")),
        reverse=True,
    )
    if count is None:
        return records
    return records[:count]


def _find_shadow_record(workspace_key: str, checkpoint_id: str) -> Optional[dict]:
    checkpoint_id = str(checkpoint_id or "").strip()
    if not checkpoint_id:
        return None

    for record in _read_shadow_records(workspace_key=workspace_key, count=None):
        if str(record.get("id") or "").strip() == checkpoint_id:
            return record
    return None


def _write_bytes_atomic(target: Path, raw: bytes):
    target.parent.mkdir(parents=True, exist_ok=True)
    temp_path = target.with_suffix(
        target.suffix + f".restore.{int(time.time() * 1000)}.tmp"
    )
    try:
        temp_path.write_bytes(raw)
        os.replace(temp_path, target)
    finally:
        if temp_path.exists():
            temp_path.unlink(missing_ok=True)


def _append_workspace_decision(cwd: str, record: dict):
    path = _decision_log_path(cwd)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


def _log_workspace_decision(
    cwd: str,
    action: str,
    source: str,
    message: str,
    file_path: str = "",
    tool_name: str = "",
    checkpoint_id: str = "",
    description: str = "",
    metadata: Optional[dict] = None,
):
    record = {
        "id": f"decision_{int(time.time() * 1000)}_{hashlib.sha1((cwd + action + file_path + checkpoint_id + message).encode('utf-8')).hexdigest()[:8]}",
        "timestamp": datetime.now().isoformat(),
        "workspace": str(Path(cwd).resolve()),
        "source": source,
        "action": action,
        "file_path": file_path,
        "tool_name": tool_name,
        "checkpoint_id": checkpoint_id,
        "message": message,
        "description": description,
        "metadata": metadata or {},
    }
    _append_workspace_decision(cwd, record)
    return record


def list_workspace_decisions(cwd: str, count: int = 20) -> list[dict]:
    path = _decision_log_path(cwd)
    if not path.exists():
        return []

    records: list[dict] = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            raw = line.strip()
            if not raw:
                continue
            try:
                entry = json.loads(raw)
            except Exception:
                continue
            records.append(entry)

    records.sort(
        key=lambda item: _parse_checkpoint_timestamp(item.get("timestamp", "")),
        reverse=True,
    )
    return records[:count]


async def file_shadow_checkpoint(
    cwd: str,
    file_path: str,
    tool_name: str,
    description: str = "",
) -> Optional[dict]:
    """
    Persist a lightweight pre-edit file snapshot for non-git or git-skip cases.
    """
    try:
        full_path, rel_path = _normalize_file_path(cwd, file_path)
        workspace_key = _workspace_key(cwd)
        fingerprint_key = f"{workspace_key}:{rel_path}"

        existed_before_edit = full_path.exists()
        if existed_before_edit:
            raw = full_path.read_bytes()
            content_hash = hashlib.sha1(raw).hexdigest()
        else:
            raw = b""
            content_hash = "missing"

        if _last_shadow_fingerprints.get(fingerprint_key) == content_hash:
            logger.debug(
                f"[GitShadow] File shadow skipped (unchanged): {rel_path}"
            )
            return None

        snapshot_dir = FILE_SHADOW_DIR / workspace_key
        snapshot_dir.mkdir(parents=True, exist_ok=True)

        snapshot_path = ""
        if existed_before_edit:
            suffix = full_path.suffix or ".txt"
            snapshot_name = (
                f"{datetime.now().strftime('%Y%m%dT%H%M%S%f')}_"
                f"{hashlib.sha1(rel_path.encode('utf-8')).hexdigest()[:8]}"
                f"{suffix}.shadow"
            )
            snapshot_file = snapshot_dir / snapshot_name
            snapshot_file.write_bytes(raw)
            snapshot_path = str(snapshot_file)

        timestamp = datetime.now().isoformat()
        message = description or f"Before {tool_name} on {rel_path}"
        record = {
            "id": f"shadow_{int(time.time() * 1000)}_{hashlib.sha1((workspace_key + rel_path + content_hash).encode('utf-8')).hexdigest()[:8]}",
            "source": "file_shadow",
            "workspace": str(Path(cwd).resolve()),
            "workspace_key": workspace_key,
            "file_path": rel_path,
            "tool_name": tool_name,
            "description": description,
            "message": message,
            "timestamp": timestamp,
            "hash": content_hash[:8] if existed_before_edit else "missing",
            "full_hash": content_hash,
            "snapshot_path": snapshot_path,
            "existed_before_edit": existed_before_edit,
            "rollback_supported": True,
        }
        _append_shadow_record(record)
        _last_shadow_fingerprints[fingerprint_key] = content_hash
        _log_workspace_decision(
            cwd,
            action="checkpoint_created",
            source="file_shadow",
            message=message,
            file_path=rel_path,
            tool_name=tool_name,
            checkpoint_id=record["id"],
            description=description,
            metadata={
                "hash": record["hash"],
                "full_hash": record["full_hash"],
                "snapshot_path": snapshot_path,
                "existed_before_edit": existed_before_edit,
            },
        )
        logger.info(f"[GitShadow] File shadow stored: {rel_path}")
        return record
    except Exception as e:
        logger.warning(f"[GitShadow] File shadow failed (non-fatal): {e}")
        return None


async def git_checkpoint(
    cwd: str,
    file_path: str,
    tool_name: str,
    description: str = "",
) -> Optional[str]:
    """
    Create a git shadow checkpoint before a file operation.

    Returns a git commit hash when git checkpoint succeeds.
    Falls back to a file shadow snapshot id when git is unavailable or skipped.
    """

    global _last_git_checkpoint_time
    shadow_record: Optional[dict] = None

    async def ensure_shadow_record() -> Optional[dict]:
        nonlocal shadow_record
        if shadow_record is None:
            shadow_record = await file_shadow_checkpoint(
                cwd, file_path, tool_name, description
            )
        return shadow_record

    git_available = bool(shutil.which("git"))
    inside_git = git_available and await is_git_repo(cwd)

    if not git_available:
        logger.debug("[GitShadow] git not installed, using file shadow")
        shadow = await ensure_shadow_record()
        return shadow.get("id") if shadow else None

    if not inside_git:
        logger.debug(f"[GitShadow] {cwd} is not a git repo, using file shadow")
        shadow = await ensure_shadow_record()
        return shadow.get("id") if shadow else None

    now = time.time()
    if now - _last_git_checkpoint_time < _CHECKPOINT_MIN_GAP_SECONDS:
        logger.debug("[GitShadow] git checkpoint skipped (rate limited), using file shadow")
        shadow = await ensure_shadow_record()
        return shadow.get("id") if shadow else None

    try:
        full_path = os.path.join(cwd, file_path)
        if os.path.exists(full_path):
            code, _, err = await _run_git(cwd, "add", file_path)
            if code != 0:
                logger.debug(f"[GitShadow] git add failed: {err}")
                shadow = await ensure_shadow_record()
                return shadow.get("id") if shadow else None
        else:
            code, _, err = await _run_git(cwd, "add", "-A")
            if code != 0:
                logger.debug(f"[GitShadow] git add -A failed: {err}")
                shadow = await ensure_shadow_record()
                return shadow.get("id") if shadow else None

        # If there is nothing staged before the edit, keep a file shadow snapshot instead.
        code, _, _ = await _run_git(cwd, "diff", "--cached", "--quiet")
        if code == 0:
            logger.debug("[GitShadow] No staged changes before edit, using file shadow")
            shadow = await ensure_shadow_record()
            return shadow.get("id") if shadow else None

        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        msg = f"OpenXnet checkpoint [{tool_name}] {timestamp}"
        if description:
            msg += f"\n\n{description}"

        code, _, err = await _run_git(cwd, "commit", "-m", msg, "--no-verify")
        if code == 0:
            _, commit_hash, _ = await _run_git(cwd, "rev-parse", "--short", "HEAD")
            _last_git_checkpoint_time = now
            _log_workspace_decision(
                cwd,
                action="checkpoint_created",
                source="git",
                message=f"OpenXnet checkpoint before {tool_name} on {file_path}",
                file_path=file_path,
                tool_name=tool_name,
                checkpoint_id=commit_hash,
                description=description,
                metadata={"hash": commit_hash[:8]},
            )
            logger.info(
                f"[GitShadow] Git checkpoint created: {commit_hash} (before {tool_name} on {file_path})"
            )
            return commit_hash

        logger.debug(f"[GitShadow] git commit failed: {err}")
        shadow = await ensure_shadow_record()
        return shadow.get("id") if shadow else None

    except Exception as e:
        logger.warning(f"[GitShadow] Error (non-fatal): {e}")
        shadow = await ensure_shadow_record()
        return shadow.get("id") if shadow else None


async def git_list_checkpoints(cwd: str, count: int = 20) -> list[dict]:
    """
    List recent workspace checkpoints.

    - Git repo: returns git checkpoints, plus any file shadow fallbacks
    - Non-git workspace: returns file shadow snapshots
    """
    results: list[dict] = []
    workspace_key = _workspace_key(cwd)

    if await is_git_repo(cwd):
        code, stdout, _ = await _run_git(
            cwd,
            "log",
            f"--max-count={count}",
            "--grep=OpenXnet checkpoint",
            "--pretty=format:%H|%s|%ai",
        )
        if code == 0 and stdout:
            for line in stdout.split("\n"):
                parts = line.split("|", 2)
                if len(parts) != 3:
                    continue
                subject = parts[1]
                tool_match = re.search(r"\[(.*?)\]", subject)
                results.append(
                    {
                        "source": "git",
                        "hash": parts[0][:8],
                        "full_hash": parts[0],
                        "message": subject,
                        "description": "",
                        "timestamp": parts[2],
                        "tool_name": tool_match.group(1) if tool_match else "",
                        "file_path": "",
                        "rollback_supported": True,
                    }
                )

    shadow_results = _read_shadow_records(workspace_key=workspace_key, count=count)
    results.extend(shadow_results)
    results.sort(
        key=lambda item: _parse_checkpoint_timestamp(item.get("timestamp", "")),
        reverse=True,
    )
    return results[:count]


async def git_rollback_to(cwd: str, commit_hash: str) -> str:
    """
    Rollback the working directory to a specific checkpoint.
    Creates a new commit (safe rollback, doesn't rewrite history).
    """
    if not await is_git_repo(cwd):
        return "Error: Not a git repository"

    await _run_git(cwd, "add", "-A")
    await _run_git(
        cwd,
        "commit",
        "-m",
        f"OpenXnet pre-rollback checkpoint {time.strftime('%Y-%m-%d %H:%M:%S')}",
        "--no-verify",
        "--allow-empty",
    )

    code, _, stderr = await _run_git(cwd, "checkout", commit_hash, "--", ".")
    if code != 0:
        return f"Error: git checkout failed: {stderr}"

    await _run_git(cwd, "add", "-A")
    code, _, stderr = await _run_git(
        cwd,
        "commit",
        "-m",
        f"OpenXnet rollback to {commit_hash[:8]} | {time.strftime('%Y-%m-%d %H:%M:%S')}",
        "--no-verify",
    )

    if code == 0:
        _log_workspace_decision(
            cwd,
            action="checkpoint_restored",
            source="git",
            message=f"Successfully rolled back workspace to {commit_hash[:8]}",
            checkpoint_id=commit_hash,
            tool_name="rollback_checkpoint",
            metadata={"hash": commit_hash[:8]},
        )
        return f"Successfully rolled back to checkpoint {commit_hash[:8]}"
    _log_workspace_decision(
        cwd,
        action="checkpoint_restored",
        source="git",
        message=f"Rollback committed with warning: {stderr}",
        checkpoint_id=commit_hash,
        tool_name="rollback_checkpoint",
        metadata={"hash": commit_hash[:8], "warning": stderr},
    )
    return f"Rollback committed with warning: {stderr}"


async def file_shadow_rollback_to(cwd: str, checkpoint_id: str) -> str:
    """
    Restore a file from a File Shadow checkpoint.
    """
    workspace_key = _workspace_key(cwd)
    record = _find_shadow_record(workspace_key, checkpoint_id)
    if not record:
        return f"Error: File shadow checkpoint not found: {checkpoint_id}"

    file_path = str(record.get("file_path") or "").strip()
    if not file_path:
        return "Error: File shadow checkpoint missing file_path"

    full_path, rel_path = _normalize_file_path(cwd, file_path)
    fingerprint_key = f"{workspace_key}:{rel_path}"

    # Keep a pre-restore checkpoint when possible, so the restore itself is reversible.
    await file_shadow_checkpoint(
        cwd,
        rel_path,
        "restore_checkpoint",
        f"Before restoring checkpoint {checkpoint_id}",
    )

    if record.get("existed_before_edit") is False:
        try:
            if full_path.exists():
                if full_path.is_dir():
                    return f"Error: Cannot restore missing state for directory path: {rel_path}"
                full_path.unlink()
            _last_shadow_fingerprints.pop(fingerprint_key, None)
            _log_workspace_decision(
                cwd,
                action="checkpoint_restored",
                source="file_shadow",
                message=f"Successfully restored {rel_path} to its previous missing state",
                file_path=rel_path,
                tool_name="restore_checkpoint",
                checkpoint_id=checkpoint_id,
                metadata={"restored_from": "missing_state"},
            )
            return f"Successfully restored {rel_path} to its previous missing state"
        except Exception as e:
            return f"Error: failed to restore missing state for {rel_path}: {e}"

    snapshot_path = str(record.get("snapshot_path") or "").strip()
    if not snapshot_path:
        return f"Error: File shadow snapshot missing for {rel_path}"

    snapshot_file = Path(snapshot_path)
    if not snapshot_file.exists():
        return f"Error: File shadow snapshot file not found for {rel_path}"

    try:
        _write_bytes_atomic(full_path, snapshot_file.read_bytes())
        _last_shadow_fingerprints.pop(fingerprint_key, None)
        _log_workspace_decision(
            cwd,
            action="checkpoint_restored",
            source="file_shadow",
            message=f"Successfully restored {rel_path} from file shadow {checkpoint_id[:8]}",
            file_path=rel_path,
            tool_name="restore_checkpoint",
            checkpoint_id=checkpoint_id,
            metadata={"restored_from": "snapshot"},
        )
        return f"Successfully restored {rel_path} from file shadow {checkpoint_id[:8]}"
    except Exception as e:
        return f"Error: failed to restore {rel_path} from file shadow: {e}"


async def rollback_workspace_checkpoint(cwd: str, checkpoint_id: str) -> str:
    """
    Restore a workspace checkpoint from either Git or File Shadow.
    """
    checkpoint_id = str(checkpoint_id or "").strip()
    if not checkpoint_id:
        return "Error: checkpoint_id required"

    if checkpoint_id.startswith("shadow_"):
        return await file_shadow_rollback_to(cwd, checkpoint_id)

    workspace_key = _workspace_key(cwd)
    if _find_shadow_record(workspace_key, checkpoint_id):
        return await file_shadow_rollback_to(cwd, checkpoint_id)

    return await git_rollback_to(cwd, checkpoint_id)
