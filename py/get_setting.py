#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
Settings 设置管理 — 统一配置文件读写与热重载。

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

import io
import json
import logging
import os
import sys
import time
import asyncio
import hashlib
import shutil
import sqlite3
import aiosqlite
from pathlib import Path
from appdirs import user_data_dir
from py.provider_credentials import (
    apply_provider_credentials,
    redact_provider_credentials_for_persistence,
)
from py.search_credentials import (
    apply_search_credentials,
    redact_search_credentials_for_persistence,
)
from py.voice_credentials import (
    apply_voice_credentials,
    redact_voice_credentials_for_persistence,
)
from py.mcp_credentials import (
    apply_mcp_credentials,
    redact_mcp_credentials_for_persistence,
)
from py.http_tool_credentials import (
    apply_http_tool_credentials,
    redact_http_tool_credentials_for_persistence,
)
from py.telegram_credentials import (
    apply_telegram_credentials,
    redact_telegram_credentials_for_persistence,
)
from py.image_host_credentials import (
    apply_image_host_credentials,
    redact_image_host_credentials_for_persistence,
)
from py.live_platform_credentials import (
    apply_live_platform_credentials,
    redact_live_platform_credentials_for_persistence,
)
from py.code_sandbox_credentials import (
    apply_code_sandbox_credentials,
    redact_code_sandbox_credentials_for_persistence,
)
from py.home_assistant_credentials import (
    apply_home_assistant_credentials,
    redact_home_assistant_credentials_for_persistence,
)
from py.sql_credentials import (
    apply_sql_credentials,
    redact_sql_credentials_for_persistence,
)
from py.comfyui_credentials import (
    apply_comfyui_credentials,
    redact_comfyui_credentials_for_persistence,
)

# ----------------- 1. 基础环境检测 (极速版) -----------------
DEFAULT_APP_NAME = "OpenXnet"
SERVER_APP_NAME = "OpenXnet-Server"
APP_NAME = DEFAULT_APP_NAME
HOST = None
PORT = None
PUBLIC_RELEASE_CC_SWITCH_URL = "https://api.zhijule.cn/v1"
PUBLIC_RELEASE_BLOCKED_API_KEY_HASHES = {
    "0bde8aa9c3ff43545b868f39a9c039b556eeed100a6ad52c8774d7158a1cf609",
}
PUBLIC_RELEASE_CC_SWITCH_DEFAULT_MODELS = {
    "gpt-5.4",
}
PUBLIC_RELEASE_WORKSPACE_PREFIXES = (
    "d:/openxnet/github-clone/",
    "d:/openxnet/cc-source/",
)
PUBLIC_RELEASE_SANITIZE_ENV = "OPENXNET_PUBLIC_RELEASE_SANITIZE"
PUBLIC_RELEASE_SANITIZE_MARKER = "public_release_sanitize.flag"

IS_DOCKER = os.environ.get("IS_DOCKER", "").lower() in ("1", "true")

def in_docker():
    return IS_DOCKER

def get_base_path():
    if getattr(sys, 'frozen', False):
        return getattr(sys, "_MEIPASS", os.path.dirname(sys.executable))
    return str(Path(__file__).resolve().parent.parent)

base_path = get_base_path()


def _infer_runtime_profile(base_path_value: str) -> str:
    explicit_role = str(os.environ.get("OPENXNET_RUNTIME_ROLE", "")).strip().lower()
    if explicit_role in {"server", "backend"}:
        return "server"
    if explicit_role in {"desktop", "client"}:
        return "desktop"
    if explicit_role in {"execution-engine", "task-execution-engine"}:
        return "execution-engine"

    repo_name = Path(base_path_value).name.lower()
    if "openxnet-server" in repo_name:
        return "server"
    return "desktop"


RUNTIME_PROFILE = _infer_runtime_profile(base_path)
APP_NAME = str(os.environ.get("OPENXNET_APP_NAME", "")).strip() or (
    SERVER_APP_NAME if RUNTIME_PROFILE == "server" else DEFAULT_APP_NAME
)


def _normalize_user_data_dir(path_value: str) -> str:
    resolved = os.path.abspath(os.path.expanduser(str(path_value or "").strip()))
    if not resolved:
        return resolved
    path_obj = Path(resolved)
    app_name_lower = APP_NAME.lower()
    if path_obj.name.lower() == app_name_lower and path_obj.parent.name.lower() == app_name_lower:
        return str(path_obj.parent)
    return resolved


def _resolve_user_data_dir() -> str:
    custom_dir = str(os.environ.get("OPENXNET_USER_DATA_DIR", "")).strip()
    if custom_dir:
        return _normalize_user_data_dir(custom_dir)
    if IS_DOCKER:
        return '/app/data'
    return _normalize_user_data_dir(user_data_dir(APP_NAME, roaming=True))

# ----------------- 2. 路径定义 -----------------
USER_DATA_DIR = _resolve_user_data_dir()

# --- 核心目录 ---
LOG_DIR = os.path.join(USER_DATA_DIR, 'logs')
MEMORY_CACHE_DIR = os.path.join(USER_DATA_DIR, 'memory_cache')
UPLOAD_FILES_DIR = os.path.join(USER_DATA_DIR, 'uploaded_files')
TOOL_TEMP_DIR = os.path.join(USER_DATA_DIR, 'tool_temp')
AGENT_DIR = os.path.join(USER_DATA_DIR, 'agents')
KB_DIR = os.path.join(USER_DATA_DIR, 'kb')
EXT_DIR = os.path.join(USER_DATA_DIR, "ext")
DEFAULT_ASR_DIR = os.path.join(USER_DATA_DIR, 'asr')
DEFAULT_EBD_DIR = os.path.join(USER_DATA_DIR, 'ebd')

# --- 跨平台全局Skills路径 ---
def get_global_skills_dir():
    """
    获取标准的全局Agent Skills目录，支持跨平台
    标准路径: ~/.agents/skills (macOS/Linux) 或 %USERPROFILE%\\.agents\\skills (Windows)
    """
    home_dir = Path.home()
    
    # 检查是否在Docker环境中
    if IS_DOCKER:
        # Docker环境中使用/app/.agents/skills
        docker_skills_dir = Path('/app/.agents/skills')
        docker_skills_dir.mkdir(parents=True, exist_ok=True)
        return str(docker_skills_dir)
    
    # 标准全局路径
    global_skills_dir = home_dir / '.agents' / 'skills'
    
    # 确保目录存在
    global_skills_dir.mkdir(parents=True, exist_ok=True)
    
    return str(global_skills_dir)

# 使用标准的全局skills路径
SKILLS_DIR = get_global_skills_dir()


# --- 配置文件 ---
SETTINGS_FILE = os.path.join(USER_DATA_DIR, 'settings.json')
CONFIG_BASE_PATH = os.path.join(base_path, 'config')
SETTINGS_TEMPLATE_FILE = os.path.join(CONFIG_BASE_PATH, 'settings_template.json')
BLOCKLIST_FILE = os.path.join(CONFIG_BASE_PATH, 'blocklist.json')

# --- 静态资源 ---
DEFAULT_VRM_DIR = os.path.abspath(
    os.getenv("OPENXNET_VRM_DIR") or os.path.join(base_path, "vrm")
)
STATIC_DIR = os.path.abspath(
    os.getenv("OPENXNET_STATIC_DIR") or os.path.join(base_path, "static")
)

# --- 数据库 ---
DATABASE_PATH = os.path.join(USER_DATA_DIR, 'super_agent_party.db')
COVS_PATH = os.path.join(USER_DATA_DIR, "conversations.db")

# 批量创建目录
dirs_to_create = [
    USER_DATA_DIR, LOG_DIR, MEMORY_CACHE_DIR, UPLOAD_FILES_DIR, 
    TOOL_TEMP_DIR, AGENT_DIR, KB_DIR, EXT_DIR, 
    DEFAULT_ASR_DIR, DEFAULT_EBD_DIR, CONFIG_BASE_PATH, SKILLS_DIR
]
for d in set(dirs_to_create):
    try:
        os.makedirs(d, exist_ok=True)
    except Exception:
        pass


def _candidate_database_paths(file_name: str):
    current_dir = Path(USER_DATA_DIR)
    variants = [
        current_dir,
        current_dir.parent,
        current_dir / APP_NAME,
        current_dir.parent / APP_NAME,
    ]
    seen = set()
    candidates = []
    for directory in variants:
        try:
            resolved = directory.resolve()
        except Exception:
            resolved = directory
        key = str(resolved).lower()
        if key in seen:
            continue
        seen.add(key)
        candidate = resolved / file_name
        if str(candidate).lower() != str(Path(USER_DATA_DIR) / file_name).lower():
            candidates.append(str(candidate))
    return candidates


def _settings_table_score(db_path: str) -> int:
    if not os.path.isfile(db_path) or os.path.getsize(db_path) <= 0:
        return -1
    try:
        with sqlite3.connect(db_path) as conn:
            table_exists = conn.execute(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name='settings' LIMIT 1"
            ).fetchone()
            if not table_exists:
                return 0
            row = conn.execute("SELECT COUNT(1) FROM settings").fetchone()
            row_count = int(row[0] or 0) if row else 0
            return 2 if row_count > 0 else 1
    except Exception:
        return -1


def _recover_database_from_candidates(target_path: str, file_name: str):
    try:
        target_score = _settings_table_score(target_path)
        best_path = None
        best_score = target_score
        for candidate in _candidate_database_paths(file_name):
            candidate_score = _settings_table_score(candidate)
            if candidate_score > best_score:
                best_score = candidate_score
                best_path = candidate
        if best_path and best_score > target_score:
            Path(target_path).parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(best_path, target_path)
            logging.info(
                f"[DB Recovery] Restored {file_name} from {best_path} to {target_path}"
            )
    except Exception as error:
        logging.warning(f"[DB Recovery] Failed to repair {file_name}: {error}")

# ----------------- 3. 关键修复：恢复全局 BLOCKLIST 变量 -----------------
# 兼容 py/load_files.py 的导入需求
# 虽然有一点点 I/O，但为了保证不报错，这里必须直接执行
blocklist_data = []
if os.path.exists(BLOCKLIST_FILE):
    try:
        with open(BLOCKLIST_FILE, 'r', encoding='utf-8') as f:
            blocklist_data = json.load(f)
    except Exception:
        pass
BLOCKLIST = set(blocklist_data)

# ----------------- 4. 工具函数 -----------------

_cached_default_settings = None
_db_init_done = False
_covs_db_init_done = False

def get_blocklist():
    """保留这个函数供未来使用"""
    return BLOCKLIST

def configure_host_port(host, port):
    global HOST, PORT
    HOST = host
    PORT = port

def get_host():
    return HOST or "127.0.0.1"

def get_port():
    return PORT or 3456

def get_default_settings_sync():
    global _cached_default_settings
    if _cached_default_settings is not None:
        return _cached_default_settings
    
    if os.path.exists(SETTINGS_TEMPLATE_FILE):
        try:
            with open(SETTINGS_TEMPLATE_FILE, 'r', encoding='utf-8') as f:
                _cached_default_settings = json.load(f)
        except Exception:
            _cached_default_settings = {}
    else:
        _cached_default_settings = {}
    return _cached_default_settings


def _normalize_path_text(value) -> str:
    return str(value or "").strip().replace("\\", "/").lower()


def _looks_like_bundled_workspace_path(path_value) -> bool:
    normalized = _normalize_path_text(path_value)
    if not normalized:
        return False
    return any(normalized.startswith(prefix) for prefix in PUBLIC_RELEASE_WORKSPACE_PREFIXES)


def _is_blocked_public_release_api_key(api_key_value) -> bool:
    api_key = str(api_key_value or "").strip()
    if not api_key:
        return False
    digest = hashlib.sha256(api_key.encode("utf-8")).hexdigest()
    return digest in PUBLIC_RELEASE_BLOCKED_API_KEY_HASHES


def _looks_like_bundled_provider_config(base_url_value, api_key_value, model_value="") -> bool:
    base_url = str(base_url_value or "").strip().rstrip("/")
    api_key = str(api_key_value or "").strip()
    model = str(model_value or "").strip()

    if _is_blocked_public_release_api_key(api_key):
        return True
    if base_url != PUBLIC_RELEASE_CC_SWITCH_URL:
        return False
    if api_key:
        return False
    return not model or model in PUBLIC_RELEASE_CC_SWITCH_DEFAULT_MODELS


def _looks_like_bundled_provider(provider: dict) -> bool:
    if not isinstance(provider, dict):
        return False

    provider_id = str(provider.get("id") or "").strip().lower()
    vendor = str(provider.get("vendor") or "").strip().lower()
    provider_name = str(provider.get("name") or "").strip().lower()
    api_key = str(provider.get("apiKey") or "").strip()
    base_url = str(provider.get("url") or "").strip().rstrip("/")
    model_candidates = []
    for raw_value in [provider.get("modelId")] + list(provider.get("models") or []):
        value = str(raw_value or "").strip()
        if value and value not in model_candidates:
            model_candidates.append(value)

    if _is_blocked_public_release_api_key(api_key):
        return True
    if base_url != PUBLIC_RELEASE_CC_SWITCH_URL:
        return False
    if api_key:
        return False
    if (
        vendor not in {"", "cc switch"}
        and provider_name != "cc switch"
        and not provider_id.startswith("release-migrated-")
    ):
        return False
    return not model_candidates or all(
        candidate in PUBLIC_RELEASE_CC_SWITCH_DEFAULT_MODELS
        for candidate in model_candidates
    )


def _clear_provider_reference(config, removed_provider_ids, *, selected_key="selectedProvider", base_url_key="base_url", api_key_key="api_key", model_key="model"):
    if not isinstance(config, dict):
        return False

    changed = False
    selected_provider = str(config.get(selected_key) or "").strip()
    selected_provider_removed = selected_provider in removed_provider_ids
    base_url = str(config.get(base_url_key) or "").strip().rstrip("/")
    api_key = str(config.get(api_key_key) or "").strip()
    model = str(config.get(model_key) or "").strip()

    if selected_provider_removed or _looks_like_bundled_provider_config(base_url, api_key, model):
        if config.get(selected_key) is not None:
            config[selected_key] = None
            changed = True
        if base_url:
            config[base_url_key] = ""
            changed = True
        if api_key:
            config[api_key_key] = ""
            changed = True
        if model:
            config[model_key] = ""
            changed = True
        return changed

    if _is_blocked_public_release_api_key(api_key):
        config[api_key_key] = ""
        changed = True
    return changed


def _collect_provider_model_candidates(provider: dict):
    if not isinstance(provider, dict):
        return []

    candidates = []
    raw_candidates = [provider.get("modelId")]
    raw_candidates.extend(provider.get("models") or [])
    for raw_value in raw_candidates:
        value = str(raw_value or "").strip()
        if value and value not in candidates:
            candidates.append(value)
    return candidates


def _infer_provider_vendor_from_base_url(base_url_value) -> str:
    normalized = str(base_url_value or "").strip().rstrip("/")
    normalized_lower = normalized.lower()
    if normalized == PUBLIC_RELEASE_CC_SWITCH_URL:
        return "CC Switch"
    if normalized_lower == "https://api.openai.com/v1":
        return "OpenAI"
    return "custom"


def _restore_selected_provider_binding(settings) -> bool:
    if not isinstance(settings, dict):
        return False

    changed = False
    model_providers = settings.get("modelProviders")
    if model_providers is None:
        model_providers = []
        settings["modelProviders"] = model_providers
        changed = True
    elif not isinstance(model_providers, list):
        return changed

    normalized_base_url = str(settings.get("base_url") or "").strip().rstrip("/")
    desired_model = str(settings.get("model") or "").strip()
    selected_provider_id = str(settings.get("selectedProvider") or "").strip()

    dict_providers = []
    selected_provider = None
    for provider in model_providers:
        if not isinstance(provider, dict):
            continue
        dict_providers.append(provider)
        provider_id = str(provider.get("id") or "").strip()
        if provider_id and provider_id == selected_provider_id:
            selected_provider = provider

    matched_provider = selected_provider
    if matched_provider is None:
        for provider in dict_providers:
            provider_id = str(provider.get("id") or "").strip()
            if not provider_id:
                continue

            provider_url = str(provider.get("url") or "").strip().rstrip("/")
            provider_models = _collect_provider_model_candidates(provider)
            url_matches = not normalized_base_url or provider_url == normalized_base_url
            model_matches = not desired_model or not provider_models or desired_model in provider_models
            if url_matches and model_matches:
                matched_provider = provider
                if normalized_base_url and desired_model:
                    break

    if matched_provider is None and len(dict_providers) == 1:
        matched_provider = dict_providers[0]

    if matched_provider is None and (normalized_base_url or desired_model):
        provider_id = f"release-migrated-{int(time.time() * 1000)}"
        matched_provider = {
            "id": provider_id,
            "vendor": _infer_provider_vendor_from_base_url(normalized_base_url),
            "url": normalized_base_url,
            "apiKey": str(settings.get("api_key") or "").strip(),
            "modelId": desired_model,
            "models": [desired_model] if desired_model else [],
        }
        model_providers.append(matched_provider)
        changed = True

    if matched_provider is None:
        return changed

    matched_provider_id = str(matched_provider.get("id") or "").strip()
    if matched_provider_id and selected_provider_id != matched_provider_id:
        settings["selectedProvider"] = matched_provider_id
        changed = True

    matched_url = str(matched_provider.get("url") or "").strip()
    matched_models = _collect_provider_model_candidates(matched_provider)
    matched_api_key = str(matched_provider.get("apiKey") or "").strip()
    if not normalized_base_url and matched_url:
        settings["base_url"] = matched_url
        changed = True
    if not desired_model and matched_models:
        settings["model"] = matched_models[0]
        changed = True
    if not str(settings.get("api_key") or "").strip() and matched_api_key:
        settings["api_key"] = matched_api_key
        changed = True

    return changed


def _should_sanitize_settings_for_public_release() -> bool:
    env_value = str(os.environ.get(PUBLIC_RELEASE_SANITIZE_ENV, "")).strip().lower()
    if env_value in {"1", "true", "yes", "on"}:
        return True

    marker_path = os.path.join(CONFIG_BASE_PATH, PUBLIC_RELEASE_SANITIZE_MARKER)
    return os.path.exists(marker_path)


def sanitize_settings_for_public_release(settings):
    if not isinstance(settings, dict):
        return settings, False
    if not _should_sanitize_settings_for_public_release():
        # Public release cleanup must be an explicit release action.
        # Otherwise manually entered provider/workspace settings can be
        # mistaken for bundled defaults and silently cleared at runtime.
        return settings, False

    changed = False

    cli_settings = settings.get("CLISettings")
    if isinstance(cli_settings, dict) and _looks_like_bundled_workspace_path(cli_settings.get("cc_path")):
        cli_settings["cc_path"] = ""
        cli_settings["enabled"] = False
        changed = True

    model_providers = settings.get("modelProviders")
    removed_provider_ids = set()
    if isinstance(model_providers, list):
        kept_providers = []
        for provider in model_providers:
            if _looks_like_bundled_provider(provider):
                provider_id = str(provider.get("id") or "").strip()
                if provider_id:
                    removed_provider_ids.add(provider_id)
                changed = True
                continue
            kept_providers.append(provider)
        if len(kept_providers) != len(model_providers):
            settings["modelProviders"] = kept_providers

    if _clear_provider_reference(settings, removed_provider_ids, selected_key="selectedProvider", base_url_key="base_url", api_key_key="api_key", model_key="model"):
        changed = True

    for key in ("reasoner", "fast", "KBSettings", "ccSettings", "qcSettings", "ocSettings"):
        if _clear_provider_reference(settings.get(key), removed_provider_ids):
            changed = True

    if _restore_selected_provider_binding(settings):
        changed = True

    return settings, changed

# ----------------- Agent Skills 初始化 -----------------

async def _copy_default_skills():
    """
    将项目根目录的 skills/ 复制到 USER_DATA_DIR/skills/。
    核心逻辑：若目标子目录已存在，则跳过该目录；不覆盖用户已有文件。
    """
    # 源目录：项目根目录下的 skills
    src_skills_root = os.path.join(base_path, 'skills')
    # 目标目录：用户数据目录下的 skills
    dst_skills_root = SKILLS_DIR  # 你在路径定义中已配置

    # 如果源目录根本不存在，说明这个版本没带默认技能，直接跳过
    if not os.path.isdir(src_skills_root):
        logging.info("[Skills] 项目根目录无 skills/ 文件夹，跳过初始化复制。")
        return

    # 确保目标根目录存在（你在 dirs_to_create 已包含，这里双重保障）
    os.makedirs(dst_skills_root, exist_ok=True)

    # 遍历源目录下的每一项（一级子目录/文件）
    try:
        for item_name in os.listdir(src_skills_root):
            src_path = os.path.join(src_skills_root, item_name)
            dst_path = os.path.join(dst_skills_root, item_name)

            # 仅处理目录 —— Skill 的根必须是文件夹
            if os.path.isdir(src_path):
                # 核心判断：如果目标目录已存在，完全跳过该 Skill 的复制
                if os.path.exists(dst_path):
                    logging.debug(f"[Skills] 目标技能已存在，跳过: {item_name}")
                    continue
                
                # 不存在则完整复制整个 Skill 文件夹
                # 使用 shutil.copytree，且不覆盖（因为已判断不存在）
                import shutil
                shutil.copytree(src_path, dst_path)
                logging.info(f"[Skills] 已安装默认技能: {item_name}")
            else:
                # 源根目录下的孤立文件（非标准 Skill 结构），根据你的策略可忽略或复制
                # 标准 Agent Skills 只认文件夹，这里建议忽略
                logging.debug(f"[Skills] 忽略非文件夹项: {item_name}")
    except Exception as e:
        logging.error(f"[Skills] 复制默认技能时发生错误: {e}", exc_info=True)

# ----------------- 5. 初始化逻辑 -----------------

async def init_db():
    global _db_init_done
    if _db_init_done: return

    Path(USER_DATA_DIR).mkdir(parents=True, exist_ok=True)
    _recover_database_from_candidates(DATABASE_PATH, 'super_agent_party.db')
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.execute('''
            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY,
                data TEXT NOT NULL
            )
        ''')
        await db.commit()
    _db_init_done = True

async def init_covs_db():
    global _covs_db_init_done
    if _covs_db_init_done: return
    
    Path(USER_DATA_DIR).mkdir(parents=True, exist_ok=True)
    _recover_database_from_candidates(COVS_PATH, 'conversations.db')
    async with aiosqlite.connect(COVS_PATH) as db:
        await db.execute('''
            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY,
                data TEXT NOT NULL
            )
        ''')
        await db.commit()
    _covs_db_init_done = True

# ----------------- 6. 业务功能函数 -----------------

async def clean_temp_files_task():
    try:
        await asyncio.to_thread(_clean_temp_files_sync)
    except Exception:
        pass

def _clean_temp_files_sync():
    if not os.path.exists(TOOL_TEMP_DIR): return
    threshold = time.time() - 7 * 24 * 60 * 60
    for filename in os.listdir(TOOL_TEMP_DIR):
        file_path = os.path.join(TOOL_TEMP_DIR, filename)
        try:
            if os.path.isfile(file_path):
                if os.path.getmtime(file_path) < threshold:
                    os.remove(file_path)
        except Exception:
            pass

def convert_to_opus_simple(audio_data):
    try:
        from pydub import AudioSegment
        import imageio_ffmpeg
        
        if not getattr(AudioSegment, 'converter_configured', False):
            try:
                ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()
                AudioSegment.converter = ffmpeg_path
                AudioSegment.converter_configured = True
            except Exception:
                logging.warning("imageio-ffmpeg execution failed")

        audio = None
        # 1. Container format
        try:
            audio_io = io.BytesIO(audio_data)
            audio = AudioSegment.from_file(audio_io)
        except Exception:
            pass
            
        # 2. Raw PCM
        if audio is None:
            try:
                audio = AudioSegment(
                    data=audio_data,
                    sample_width=2,
                    frame_rate=24000,
                    channels=1
                )
            except Exception as e:
                logging.error(f"Raw PCM read failed: {e}")
                return audio_data, False

        # 3. Export Opus
        audio = audio.set_frame_rate(16000).set_channels(1)
        out_io = io.BytesIO()
        audio.export(
            out_io,
            format="opus",
            codec="libopus",
            parameters=["-b:a", "16k", "-application", "voip"]
        )
        return out_io.getvalue(), True
    except ImportError:
        logging.error("pydub/ffmpeg not installed")
        return _wrap_pcm_to_wav(audio_data), False
    except Exception as e:
        logging.error(f"Opus conversion failed: {e}")
        return _wrap_pcm_to_wav(audio_data), False

def _wrap_pcm_to_wav(pcm_data):
    try:
        import wave
        wav_io = io.BytesIO()
        with wave.open(wav_io, 'wb') as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(24000)
            wav_file.writeframes(pcm_data)
        return wav_io.getvalue()
    except Exception:
        return pcm_data

# ----------------- 7. 配置读写 -----------------


def _hydrate_managed_credentials(settings):
    """把 Main 注入的各域凭据补入内存设置；输入设置，返回分离副本，不写入数据库。"""

    hydrated = apply_provider_credentials(settings)
    hydrated = apply_search_credentials(hydrated)
    hydrated = apply_voice_credentials(hydrated)
    hydrated = apply_mcp_credentials(hydrated)
    hydrated = apply_http_tool_credentials(hydrated)
    hydrated = apply_telegram_credentials(hydrated)
    hydrated = apply_image_host_credentials(hydrated)
    hydrated = apply_live_platform_credentials(hydrated)
    hydrated = apply_code_sandbox_credentials(hydrated)
    hydrated = apply_home_assistant_credentials(hydrated)
    hydrated = apply_sql_credentials(hydrated)
    return apply_comfyui_credentials(hydrated)


def _redact_managed_credentials(settings):
    """持久化或 IPC 前移除各域 Main 凭据；输入设置，返回脱敏副本，不修改原对象。"""

    redacted = redact_provider_credentials_for_persistence(settings)
    redacted = redact_search_credentials_for_persistence(redacted)
    redacted = redact_voice_credentials_for_persistence(redacted)
    redacted = redact_mcp_credentials_for_persistence(redacted)
    redacted = redact_http_tool_credentials_for_persistence(redacted)
    redacted = redact_telegram_credentials_for_persistence(redacted)
    redacted = redact_image_host_credentials_for_persistence(redacted)
    redacted = redact_live_platform_credentials_for_persistence(redacted)
    redacted = redact_code_sandbox_credentials_for_persistence(redacted)
    redacted = redact_home_assistant_credentials_for_persistence(redacted)
    redacted = redact_sql_credentials_for_persistence(redacted)
    return redact_comfyui_credentials_for_persistence(redacted)


async def load_settings():
    """Load merged settings and hydrate only credentials authorized for this process."""

    await init_db()
    defaults = get_default_settings_sync().copy()
    
    async with aiosqlite.connect(DATABASE_PATH) as db:
        async with db.execute('SELECT data FROM settings WHERE id = 1') as cursor:
            row = await cursor.fetchone()
            if row:
                try:
                    user_settings = json.loads(row[0])
                except Exception:
                    user_settings = {}
                
                # Merge logic
                has_changes = [False]
                def merge_defaults(default_dict, target_dict):
                    """Recursively add missing default values to one settings document."""

                    for key, value in default_dict.items():
                        if key not in target_dict:
                            target_dict[key] = value
                            has_changes[0] = True
                        elif isinstance(value, dict) and isinstance(target_dict.get(key), dict):
                            merge_defaults(value, target_dict[key])
                
                merge_defaults(defaults, user_settings)
                user_settings, sanitized = sanitize_settings_for_public_release(user_settings)
                if has_changes[0] or sanitized:
                    asyncio.create_task(save_settings(user_settings))
                return _hydrate_managed_credentials(user_settings)
            else:
                if IS_DOCKER:
                    defaults["isdocker"] = True
                defaults, _ = sanitize_settings_for_public_release(defaults)
                await save_settings(defaults)
                return _hydrate_managed_credentials(defaults)

async def save_settings(settings):
    """Persist one settings document after removing every Main-managed credential."""

    persisted_settings = _redact_managed_credentials(settings)
    data = json.dumps(persisted_settings, ensure_ascii=False, indent=2)
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.execute('INSERT OR REPLACE INTO settings (id, data) VALUES (1, ?)', (data,))
        await db.commit()


def redact_managed_credentials_for_renderer(settings):
    """Return settings without any Main-managed desktop credential secrets."""

    return _redact_managed_credentials(settings)

async def load_covs():
    try:
        await init_covs_db()
        async with aiosqlite.connect(COVS_PATH) as db:
            async with db.execute('SELECT data FROM settings WHERE id = 1') as cursor:
                row = await cursor.fetchone()
                return json.loads(row[0]) if row else {"conversations": []}
    except Exception:
        return {"conversations": []}

async def save_covs(settings):
    data = json.dumps(settings, ensure_ascii=False, indent=2)
    async with aiosqlite.connect(COVS_PATH) as db:
        await db.execute('INSERT OR REPLACE INTO settings (id, data) VALUES (1, ?)', (data,))
        await db.commit()
