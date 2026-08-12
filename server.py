#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
OpenXnet Server — 主应用服务入口。

FastAPI/ASGI 服务器，集成 LLM 网关、Agent 调度、工具编排、
上下文压缩、NeuroSymbol 认知引擎等核心功能模块。

Author: maoyo
Department: 研发部
Date: 2026-04-13
Version: 0.5.3
Security Level: INTERNAL
"""

__version__ = "0.5.3"
__author__ = "maoyo"
__copyright__ = "Copyright 2026 Synapxnet"
__maintainer__ = "maoyo"
__email__ = "synapxnet@gmail.com"

# ==========================================
# 第一步：在加载任何沉重库之前，先搞定端口
# ==========================================
import signal
import sys
import os
import argparse
import socket
import errno
from importlib import import_module

from py.cli_tool import read_file_tool_local
from py.context.compactor import ContextCompactor
from py.enterprise.role_cards import RoleCardManager
from py.enterprise.knowledge_base import EnterpriseKBManager
from py.enterprise.workspace import WorkspaceManager
from py.enterprise.xnet_bridge import XnetBridge
from py.enterprise.sandbox import SandboxStateManager
from py.memory.federation import MemoryFederation, HindsightConfig
from py.memory.provider import (
    get_workspace_memory_provider,
    resolve_memory_provider_name,
)
from py.memory.context_compressor import get_context_compressor
from py.kernel.audit import get_kernel_audit, sanitize_payload
from py.kernel.approval import get_approval_center
from py.kernel.config_intent import apply_config_intent, parse_config_intent, register_config_intent
from py.kernel.policy import (
    build_approval_required_response,
    observe_tool_policy_shadow,
    should_enforce_policy,
)
from py.kernel.system_manifest import build_system_manifest
from py.task_http_profile import resolve_task_http_profile_policy
from py.task_rpc_auth import is_authorized_desktop_task_rpc
os.environ["MEM0_TELEMETRY"] = "False"
parser = argparse.ArgumentParser(description="Run the ASGI application server.")
parser.add_argument("--host", default="127.0.0.1")
parser.add_argument("--port", type=int, default=3456)
args, _ = parser.parse_known_args()

HOST = args.host
PREFERED_PORT = args.port

def is_addr_in_use_error(e):
    """跨平台判断是否为地址被占用错误"""
    if hasattr(e, 'errno'):
        if e.errno == errno.EADDRINUSE:
            return True
        # Windows 有时用 WSAEADDRINUSE (10048)
        if sys.platform == 'win32' and e.errno == 10048:
            return True
    # Windows winerror 属性
    if hasattr(e, 'winerror') and e.winerror == 10048:
        return True
    # macOS/Linux 错误消息
    if 'address already in use' in str(e).lower():
        return True
    return False

def is_permission_error(e):
    """跨平台判断是否为权限/拒绝访问错误"""
    if isinstance(e, PermissionError):
        return True
    if hasattr(e, 'errno'):
        if e.errno in (errno.EACCES, errno.EPERM):
            return True
        # Windows ERROR_ACCESS_DENIED (5)
        if sys.platform == 'win32' and e.errno == 13:
            return True
    if hasattr(e, 'winerror') and e.winerror in (5, 10013):
        return True
    err_str = str(e).lower()
    if any(x in err_str for x in ['permission', 'denied', 'access', 'not permitted']):
        return True
    return False

def force_bind_or_fallback(host, preferred_port):
    """
    跨平台端口绑定：
    1. 尝试强制绑定指定端口（处理TIME_WAIT）
    2. 如果被真正占用/无权限/系统保留，自动降级到随机端口
    3. 绝不抛出异常导致退出
    """
    if preferred_port == 0:
        return auto_assign_port(host)

    # 尝试绑定首选端口
    sock = None
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        # 关键：允许快速复用 TIME_WAIT 状态的端口
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind((host, preferred_port))
        sock.close()
        return preferred_port
        
    except (socket.error, OSError, PermissionError) as e:
        # 判断错误类型
        if is_addr_in_use_error(e):
            reason = "in use"
        elif is_permission_error(e):
            reason = "permission denied/system reserved"
        else:
            reason = f"error ({e})"
        
        print(f"Port {preferred_port} unavailable ({reason}), auto-assigning...", 
              file=sys.stderr, flush=True)
        
        # 关闭失败的 socket
        try:
            if sock:
                sock.close()
        except:
            pass
        
        # 降级：让系统分配端口
        return auto_assign_port(host)
        
    except Exception as e:
        # 捕获所有其他异常
        print(f"Unexpected error binding port {preferred_port}: {e}, auto-assigning...", 
              file=sys.stderr, flush=True)
        try:
            if sock:
                sock.close()
        except:
            pass
        return auto_assign_port(host)

def auto_assign_port(host):
    """自动分配可用端口，带多重降级"""
    # 尝试 127.0.0.1
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind((host, 0))
        port = sock.getsockname()[1]
        sock.close()
        print(f"Auto-assigned port: {port}", file=sys.stderr, flush=True)
        return port
    except Exception as e:
        print(f"Failed to bind {host}: {e}", file=sys.stderr, flush=True)
        try:
            sock.close()
        except:
            pass
    
    # 降级 1: 尝试 0.0.0.0 (所有接口)
    if host != "0.0.0.0":
        try:
            print("Trying 0.0.0.0...", file=sys.stderr, flush=True)
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.bind(("0.0.0.0", 0))
            port = sock.getsockname()[1]
            sock.close()
            print(f"Auto-assigned port on 0.0.0.0: {port}", file=sys.stderr, flush=True)
            return port
        except Exception as e:
            print(f"Failed to bind 0.0.0.0: {e}", file=sys.stderr, flush=True)
            try:
                sock.close()
            except:
                pass
    
    # 降级 2: 尝试 localhost
    if host != "localhost":
        try:
            print("Trying localhost...", file=sys.stderr, flush=True)
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.bind(("localhost", 0))
            port = sock.getsockname()[1]
            sock.close()
            print(f"Auto-assigned port on localhost: {port}", file=sys.stderr, flush=True)
            return port
        except Exception as e:
            print(f"Failed to bind localhost: {e}", file=sys.stderr, flush=True)
            try:
                sock.close()
            except:
                pass
    
    # 最后手段：硬编码高位端口（极端情况）
    fallback_ports = [45678, 45679, 45680, 0]
    for fp in fallback_ports:
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.bind((host if host != "0.0.0.0" else "127.0.0.1", fp))
            port = sock.getsockname()[1]
            sock.close()
            print(f"Fallback to hardcoded port: {port}", file=sys.stderr, flush=True)
            return port
        except:
            try:
                sock.close()
            except:
                pass
            continue
    
    # 理论上不会到这里，如果真的到了，返回一个肯定能用的
    return 0

# 执行端口查找
FINAL_PORT = force_bind_or_fallback(HOST, PREFERED_PORT)
PORT = FINAL_PORT

# 核心：立刻打印！
print(f"REAL_PORT_FOUND:{PORT}", flush=True)

# ==========================================
# 第二步：屏蔽掉后面库可能产生的骚扰警告
# ==========================================
import warnings
warnings.filterwarnings("ignore") # 忽略普通警告
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3' # 如果有 tensorflow 等库，减少其日志输出

import hashlib
import importlib
import mimetypes
import pathlib
import sys
import traceback
import platform
import requests

from py.agent import add_tool_to_project_config, is_tool_allowed_by_project_config
sys.stdout.reconfigure(encoding='utf-8')
import base64
from datetime import datetime
import glob
from io import BytesIO
import io
import os
from pathlib import Path
import pickle
import socket
import sys
import tempfile
import httpx
import ipaddress
from urllib.parse import quote, urlparse, urlunparse, urljoin
from urllib.robotparser import RobotFileParser
import websockets
from py.load_files import check_robots_txt, get_file_content, is_private_ip, sanitize_url
def fix_macos_environment():
    """
    专门修复 macOS 下找不到 node (nvm) 和 uv (python framework) 的问题
    """
    if sys.platform != 'darwin':
        return

    user_home = Path.home()
    paths_to_add = []

    # ---------------------------------------------------------
    # 1. 自动发现 NVM 安装的 Node.js
    # 路径通常是: ~/.nvm/versions/node/vX.X.X/bin
    # ---------------------------------------------------------
    nvm_path = user_home / ".nvm" / "versions" / "node"
    if nvm_path.exists():
        # 获取所有版本文件夹 (如 v20.19.5, v18.0.0)
        # 使用 glob 匹配所有 v 开头的文件夹
        node_versions = sorted(nvm_path.glob("v*"), key=lambda p: p.name, reverse=True)
        
        # 将所有版本的 bin 目录都加入，或者只加最新的
        for version_dir in node_versions:
            bin_path = version_dir / "bin"
            if bin_path.exists():
                paths_to_add.append(str(bin_path))
                # 如果只想用最新的 node，这里可以 break
                # break 

    # ---------------------------------------------------------
    # 2. 自动发现 Python Framework 中的 uv
    # 路径通常是: /Library/Frameworks/Python.framework/Versions/X.X/bin
    # ---------------------------------------------------------
    py_framework_path = Path("/Library/Frameworks/Python.framework/Versions")
    if py_framework_path.exists():
        # 查找所有版本，如 3.13, 3.12
        py_versions = py_framework_path.glob("*")
        for ver in py_versions:
            bin_path = ver / "bin"
            if bin_path.exists():
                paths_to_add.append(str(bin_path))

    # ---------------------------------------------------------
    # 3. 补充 macOS 常见的其他路径 (Homebrew, Cargo, Local)
    # uv 也经常被安装在 .local/bin 或 .cargo/bin 下
    # ---------------------------------------------------------
    common_extras = [
        "/opt/homebrew/bin",           # Apple Silicon Mac Homebrew
        "/usr/local/bin",              # Intel Mac Homebrew
        str(user_home / ".local" / "bin"), # 用户级安装通常在这里
        str(user_home / ".cargo" / "bin"), # Rust 工具链 (uv 可能在这里)
    ]
    paths_to_add.extend(common_extras)

    # ---------------------------------------------------------
    # 4. 将发现的路径注入到当前进程的环境变量中
    # ---------------------------------------------------------
    current_path = os.environ.get("PATH", "")
    new_path_str = current_path
    
    # 将新路径加到最前面 (优先级最高)
    for p in paths_to_add:
        if p and os.path.isdir(p):
            # 避免重复添加
            if p not in new_path_str:
                new_path_str = p + os.pathsep + new_path_str
    
    # 更新环境变量
    os.environ['PATH'] = new_path_str
    
    # (可选) 打印调试信息
    # print(f"Fixed macOS PATH. Added: {paths_to_add}")

# --- 在程序最开始的地方调用这个函数 ---
fix_macos_environment()

def _fix_onnx_dll():
    if sys.platform == 'darwin':
        return
    # 1. 找到 uv 虚拟环境里的 onnxruntime
    spec = importlib.util.find_spec("onnxruntime")
    if spec is None or spec.origin is None:
        return          # 没装 onnxruntime，随它去
    # DLL 就在 site-packages/onnxruntime/capi 里
    dll_dir = pathlib.Path(spec.origin).with_name("capi")
    if not dll_dir.is_dir():
        return

    # 2. 置顶搜索路径
    os.environ["PATH"] = str(dll_dir) + os.pathsep + os.environ["PATH"]
    if hasattr(os, "add_dll_directory"):      # Python 3.8+
        os.add_dll_directory(str(dll_dir))

    # 3. 如果已经有人 import 过 onnxruntime，清掉缓存
    for mod in list(sys.modules):
        if mod.startswith("onnxruntime"):
            del sys.modules[mod]

_fix_onnx_dll()

# 在程序最开始设置
if hasattr(sys, '_MEIPASS'):
    # 打包后的程序
    os.environ['PYTHONPATH'] = sys._MEIPASS
    os.environ['PATH'] = sys._MEIPASS + os.pathsep + os.environ.get('PATH', '')
import asyncio
import copy
from functools import partial
import json
import re
import shutil
from fastapi import BackgroundTasks, Body, FastAPI, File, Form, HTTPException, Query, Request, UploadFile, WebSocket, WebSocketDisconnect
import logging
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncOpenAI
from pydantic import BaseModel, Field
from fastapi import status
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse,Response
import uuid
import time
from typing import Any, AsyncIterator, Dict, List, Mapping, Optional, Set, Tuple, Union
import shortuuid
from contextlib import asynccontextmanager
from concurrent.futures import ThreadPoolExecutor
import aiofiles
import argparse
from py.dify_openai import DifyOpenAIAsync
from py.execution_provider_runtime import (
    create_provider_client,
    get_provider_client_class as get_client_class,
)
from py.synapse_registry import get_synapse_registry, register_builtin_tools, SynapseRegistry
from py.neuro_bridge_api import get_symbol_store, SymbolStore, SymbolCrystallizer, FactExtractor, LLMFactExtractor, NeuroSymbol, VALID_OPERATORS
from py.neuro_temporal_kg import init_temporal_kg, get_temporal_kg
from py.neuro_rules import get_rule_registry
from py.engine.plugin_registry import get_plugin_registry
from py.engine.query_engine import QueryEngine
from py.engine.checkpoint import init_engine_checkpoint, get_engine_checkpoint
from py.usage.token_meter import init_token_meter, get_token_meter
from py.usage.model_pricing import calculate_cost

from py.get_setting import APP_NAME, EXT_DIR, IS_DOCKER, RUNTIME_PROFILE, SKILLS_DIR, STATIC_DIR, _copy_default_skills, convert_to_opus_simple, load_covs, load_settings, save_covs,save_settings,clean_temp_files_task,base_path,configure_host_port,get_port,UPLOAD_FILES_DIR,AGENT_DIR,MEMORY_CACHE_DIR,KB_DIR,DEFAULT_VRM_DIR,USER_DATA_DIR,LOG_DIR,TOOL_TEMP_DIR,redact_managed_credentials_for_renderer
from py.voice_worker_client import (
    VoiceWorkerClient,
    VoiceWorkerClientError,
    transcribe_with_voice_worker,
)
from py.provider_credentials import apply_provider_credentials
from py.voice_credentials import (
    apply_voice_credentials_to_scope,
    build_tetos_voice_config,
)
from py.a2a_client import A2AClientError, inspect_a2a_agent
from py.llm_tool import get_image_base64,get_image_media_type


def _create_server_mcp_client():
    """创建显式 Server profile 的兼容 MCP 客户端；无输入，返回延迟加载实例，其他 profile 调用时抛出异常。"""

    if RUNTIME_PROFILE != "server":
        raise RuntimeError("Local MCP compatibility is unavailable in this runtime profile.")
    module = import_module(".".join(("py", "mcp_clients")))
    client_class = getattr(module, "McpClient")
    return client_class()


timetamp = time.time()
log_path = os.path.join(LOG_DIR, f"backend_{timetamp}.log")

logger = None      
os.environ["no_proxy"] = "localhost,127.0.0.1"
local_timezone = None
settings = None
client = None
fast_client = None 
reasoner_client = None
HA_client = None
ChromeMCP_client = None
sql_client = None
mcp_client_list = {}
synapse_registry: SynapseRegistry = None  # Synapse v1.0 工具注册中心
symbol_store: SymbolStore = None  # NeuroSymbol v1.0 认知符号库
memory_federation: MemoryFederation = None  # Recall Center 统一记忆检索中枢
kernel = None  # Neural-Symbolic OS Kernel v1.0
locales = {}

global_http_client = None  # 用于共享底层的 TCP 连接池
openxnet_login_proxy_url = None
openxnet_login_trust_env = False
openai_tts_clients_cache = {}  # 缓存 OpenAI TTS Client
tetos_speakers_cache = {}      # 缓存 Tetos Speaker 对象
openai_asr_clients_cache = {}


def _default_openxnet_login_service_url() -> str:
    explicit = str(os.getenv("OPENXNET_LOGIN_SERVICE_URL", "")).strip().rstrip("/")
    if explicit:
        return explicit
    # 默认回到统一的线上账户服务，避免源码启动时误连本地 3458，
    # 造成套餐、用户与后台管理看到的不是同一套数据。
    return "https://synapxnet.work"


OPENXNET_LOGIN_SERVICE_URL = _default_openxnet_login_service_url()
OPENXNET_LOGIN_API_PREFIX = str(os.getenv("OPENXNET_LOGIN_API_PREFIX", "/api")).strip() or "/api"
print(
    f"[OpenXnet Access] Login service: {OPENXNET_LOGIN_SERVICE_URL.rstrip('/')}{OPENXNET_LOGIN_API_PREFIX}",
    flush=True,
)

# --- [v0.5.3 P0-B] AbortController: 流式请求中断注册表 ---
_active_streams: dict = {}  # request_id → asyncio.Event

# --- [v0.5.3] Enterprise Module: 全局管理器 ---
role_card_manager: RoleCardManager = None
enterprise_kb_manager: EnterpriseKBManager = None
# --- [v0.6.0] Enterprise Expansion: 全局管理器 ---
workspace_manager: WorkspaceManager = None
xnet_bridge: XnetBridge = None
sandbox_manager: SandboxStateManager = None

def _register_stream(request_id: str) -> 'asyncio.Event':
    """注册一个流式请求，返回其 abort_event"""
    import asyncio
    event = asyncio.Event()
    _active_streams[request_id] = event
    return event

def _unregister_stream(request_id: str):
    """注销流式请求"""
    _active_streams.pop(request_id, None)


def _persist_workspace_session_memory(
    current_settings: dict,
    user_prompt: str,
    assistant_output: str,
    *,
    model: str = "",
    source: str = "chat",
):
    """Persist a lightweight cross-session summary for Recall Center."""
    global memory_federation

    try:
        workspace_dir = (current_settings or {}).get("CLISettings", {}).get("cc_path")
        if not workspace_dir:
            return

        prompt_text = (user_prompt or "").strip()
        answer_text = (assistant_output or "").strip()
        if not prompt_text and not answer_text:
            return

        memory_provider = get_workspace_memory_provider(
            workspace_dir,
            resolve_memory_provider_name(current_settings),
        )
        memory_provider.record_interaction(
            prompt_text,
            answer_text,
            metadata={
                "workspace_dir": workspace_dir,
                "model": model,
                "source": source,
            },
        )

        if memory_federation is not None:
            memory_federation.memory_provider = memory_provider
    except Exception as session_memory_err:
        logger.debug(f"[Recall Center] Session memory persistence skipped: {session_memory_err}")


def _workspace_dir_from_settings(current_settings: dict) -> str:
    try:
        return str((current_settings or {}).get("CLISettings", {}).get("cc_path") or "").strip()
    except Exception:
        return ""


def _kernel_config_intent_settings(current_settings: dict) -> Dict[str, Any]:
    kernel_settings = (current_settings or {}).get("kernelSettings", {})
    config_settings = kernel_settings.get("configIntent", {}) if isinstance(kernel_settings, dict) else {}
    return config_settings if isinstance(config_settings, dict) else {}


def _message_content_text(message: Dict[str, Any], *, max_string: int = 2000) -> str:
    content = message.get("content", "") if isinstance(message, dict) else message
    if isinstance(content, str):
        text = content
    else:
        try:
            text = json.dumps(sanitize_payload(content, max_string=max_string), ensure_ascii=False)
        except Exception:
            text = str(content)
    return " ".join(text.split())


def _message_compaction_signature(message: Dict[str, Any]) -> tuple:
    if not isinstance(message, dict):
        return ("raw", str(message)[:1000])
    return (
        str(message.get("role", "")),
        str(message.get("name", "")),
        str(message.get("tool_call_id", "")),
        _message_content_text(message, max_string=1200)[:1000],
    )


def _removed_messages_for_compaction(
    original_messages: List[Dict[str, Any]],
    compacted_messages: List[Dict[str, Any]],
    expected_removed: int,
) -> List[Dict[str, Any]]:
    if expected_removed <= 0:
        return []
    from collections import Counter

    remaining = Counter(_message_compaction_signature(msg) for msg in compacted_messages or [])
    removed: List[Dict[str, Any]] = []
    for msg in original_messages or []:
        sig = _message_compaction_signature(msg)
        if remaining.get(sig, 0) > 0:
            remaining[sig] -= 1
            continue
        if isinstance(msg, dict) and msg.get("role") == "system":
            continue
        removed.append(msg)
        if len(removed) >= expected_removed:
            break
    return removed


def _latest_role_text(messages: List[Dict[str, Any]], role: str) -> str:
    for msg in reversed(messages or []):
        if isinstance(msg, dict) and msg.get("role") == role:
            return _message_content_text(msg, max_string=1200)
    return ""


def _memory_line_for_message(message: Dict[str, Any], *, limit: int = 480) -> str:
    role = str(message.get("role", "message")) if isinstance(message, dict) else "message"
    text = _message_content_text(message, max_string=limit)
    if len(text) > limit:
        text = text[:limit] + "... [truncated]"
    return f"{role}: {text}"


def _persist_context_compaction_memory(
    current_settings: dict,
    original_messages: List[Dict[str, Any]],
    compaction_result,
    *,
    model: str = "",
    source: str = "context_compactor",
) -> None:
    """Persist semantic breadcrumbs whenever token compaction actually changes a turn."""
    try:
        if not compaction_result:
            return
        if compaction_result.removed_messages <= 0 and compaction_result.trimmed_tool_results <= 0:
            return

        workspace_dir = _workspace_dir_from_settings(current_settings)
        if not workspace_dir:
            return

        compacted_messages = getattr(compaction_result, "messages", []) or []
        removed_messages = _removed_messages_for_compaction(
            original_messages or [],
            compacted_messages,
            int(getattr(compaction_result, "removed_messages", 0) or 0),
        )
        recent_user_goal = (
            _latest_role_text(compacted_messages, "user")
            or _latest_role_text(original_messages or [], "user")
            or "Long conversation context compacted"
        )

        compressor = get_context_compressor(workspace_dir)
        atomic_units = []
        if removed_messages:
            digest = "\n".join(_memory_line_for_message(msg) for msg in removed_messages[:24])
            atomic_units = compressor.extract_atomic_memories(
                digest,
                source=f"{source}:compacted_context",
            )

        summary = compressor.build_structured_summary(
            goal=recent_user_goal[:600],
            constraints=[
                "Preserve the latest user intent and active system constraints.",
                "Do not split tool-call chains while trimming old context.",
                "Keep sensitive configuration and credentials out of generated summaries.",
            ],
            progress=[
                f"{source} compacted context for model {model or 'unknown'}.",
                (
                    f"Tokens {getattr(compaction_result, 'original_tokens', 0)}"
                    f" -> {getattr(compaction_result, 'compacted_tokens', 0)}."
                ),
                (
                    f"Removed {getattr(compaction_result, 'removed_messages', 0)} messages; "
                    f"trimmed {getattr(compaction_result, 'trimmed_tool_results', 0)} tool results."
                ),
            ],
            key_decisions=[
                "Automatic context compression ran before the next model/tool step.",
            ],
            next_steps=[
                "Continue from the latest retained messages and consult semantic memory if older context is needed.",
            ],
        )

        get_kernel_audit(workspace_dir).append(
            "kernel.context.compacted",
            {
                "source": source,
                "model": model,
                "original_tokens": getattr(compaction_result, "original_tokens", 0),
                "compacted_tokens": getattr(compaction_result, "compacted_tokens", 0),
                "removed_messages": getattr(compaction_result, "removed_messages", 0),
                "trimmed_tool_results": getattr(compaction_result, "trimmed_tool_results", 0),
                "semantic_atoms": len(atomic_units),
                "summary": summary.to_dict(),
            },
            actor="system",
            workspace_dir=workspace_dir,
        )
    except Exception as context_memory_err:
        logger.debug(f"[Kernel] Context compaction memory skipped: {context_memory_err}")


def _abort_stream(request_id: str) -> bool:
    """中断指定流式请求"""
    event = _active_streams.get(request_id)
    if event:
        event.set()
        return True
    return False

_TOOL_NAME_PATTERN = re.compile(r"^[a-zA-Z0-9_-]+$")

def sanitize_tool_name(name: Any, fallback: str = "tool") -> str:
    safe_fallback = re.sub(r"[^a-zA-Z0-9_-]+", "_", str(fallback or "tool")).strip("_") or "tool"
    raw_name = "" if name is None else str(name).strip()
    sanitized = re.sub(r"[^a-zA-Z0-9_-]+", "_", raw_name)
    sanitized = re.sub(r"_+", "_", sanitized).strip("_")
    if sanitized and _TOOL_NAME_PATTERN.fullmatch(sanitized):
        return sanitized
    return safe_fallback

def sanitize_protocol_messages(messages: Optional[List[Dict[str, Any]]]) -> Optional[List[Dict[str, Any]]]:
    if not messages:
        return messages

    sanitized_messages: List[Dict[str, Any]] = []
    for index, message in enumerate(messages):
        if not isinstance(message, dict):
            sanitized_messages.append(message)
            continue

        safe_message = copy.deepcopy(message)
        if safe_message.get("role") == "tool":
            safe_message["name"] = sanitize_tool_name(safe_message.get("name"), f"tool_{index + 1}")

        tool_calls = safe_message.get("tool_calls")
        if isinstance(tool_calls, list):
            safe_tool_calls = []
            for tool_index, tool_call in enumerate(tool_calls):
                if not isinstance(tool_call, dict):
                    safe_tool_calls.append(tool_call)
                    continue

                safe_tool_call = copy.deepcopy(tool_call)
                function_data = safe_tool_call.get("function")
                if isinstance(function_data, dict):
                    safe_tool_call["function"] = {
                        **function_data,
                        "name": sanitize_tool_name(function_data.get("name"), f"tool_{tool_index + 1}")
                    }
                safe_tool_calls.append(safe_tool_call)
            safe_message["tool_calls"] = safe_tool_calls

        sanitized_messages.append(safe_message)

    return sanitized_messages
_TOOL_HOOKS = {}
ALLOWED_EXTENSIONS = [
  # 办公文档
    'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'pdf', 'pages', 
    'numbers', 'key', 'rtf', 'odt', 'epub',
  
  # 编程开发
  'js', 'ts', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'go', 'rs',
  'swift', 'kt', 'dart', 'rb', 'php', 'html', 'css', 'scss', 'less',
  'vue', 'svelte', 'jsx', 'tsx', 'json', 'xml', 'yml', 'yaml', 
  'sql', 'sh',
  
  # 数据配置
  'csv', 'tsv', 'txt', 'md', 'log', 'conf', 'ini', 'env', 'toml'
]
ALLOWED_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp']

ALLOWED_VIDEO_EXTENSIONS = ['mp4', 'webm', 'ogg', 'mov', 'avi']

# 1. 先清空系统可能给错的条目
for ext in ("js", "mjs", "css", "html", "htm", "json", "xml", "map", "svg"):
    mimetypes.add_type("", f".{ext}")          # 先删掉
# 2. 再写死我们想要的
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("application/javascript", ".mjs")
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("text/html", ".html")
mimetypes.add_type("text/html", ".htm")
mimetypes.add_type("application/json", ".json")
mimetypes.add_type("application/xml", ".xml")
mimetypes.add_type("application/json", ".map")
mimetypes.add_type("image/svg+xml", ".svg")

import platform
import ctypes
from PIL import Image, ImageDraw, ImageFont
import io
if platform.system() == "Windows":
    try:
        # 设置 DPI 感知，确保截屏尺寸和 size() 返回的一致
        ctypes.windll.shcore.SetProcessDpiAwareness(1) 
    except Exception:
        ctypes.windll.user32.SetProcessDPIAware()

def draw_grid_on_image(image: Image.Image, grid_spacing: int = 10) -> Image.Image:
    """
    在图片上绘制网格和千分比坐标标签
    grid_spacing: 每隔多少百分比画一根线，默认 10 (即 10x10 的网格)
    """
    draw = ImageDraw.Draw(image)
    width, height = image.size
    
    # 颜色设置 (半透明红色或亮绿色，视情况而定)
    line_color = (255, 0, 0, 128)  # 红色线
    text_color = (255, 0, 0, 255)
    
    # 绘制垂直线 (百分比 0-100，但标签显示为千分比 0-1000‰)
    for x_pc in range(0, 101, grid_spacing):
        x = int(width * (x_pc / 100.0))
        # 确保不超出边界
        x = min(x, width - 1)
        draw.line([(x, 0), (x, height)], fill=line_color, width=1)
        x_permille = x_pc
        draw.text((x + 2, 5), f"{x_permille}%", fill=text_color)

    # 绘制水平线
    for y_pc in range(0, 101, grid_spacing):
        y = int(height * (y_pc / 100.0))
        y = min(y, height - 1)
        draw.line([(0, y), (width, y)], fill=line_color, width=1)
        y_permille = y_pc
        draw.text((5, y + 2), f"{y_permille}%", fill=text_color)
        
    return image

def draw_action_feedback(image: Image.Image, action_str: str) -> Image.Image:
    """
    解析返回结果字符串，并在图像上绘制动作反馈轨迹。
    （已针对红色网格优化，全面移除红色，使用高对比度的青/蓝/绿/黄色）
    """
    # 强制将原始图像转换为 RGBA，以便使用半透明色彩
    image = image.convert("RGBA")
    
    # 创建一个与原图同尺寸的透明涂层
    overlay = Image.new("RGBA", image.size, (255, 255, 255, 0))
    draw = ImageDraw.Draw(overlay)
    w, h = image.size
    
    def to_px(tx, ty):
        return int(float(tx) * w / 1000), int(float(ty) * h / 1000)

    # 1. 匹配 MOVE(x,y) -> 画个白色小圆点带黑边
    move_match = re.search(r"\[LAST_ACTION: MOVE\((\d+\.?\d*),(\d+\.?\d*)\)\]", action_str)
    if move_match:
        x, y = move_match.groups()
        px, py = to_px(x, y)
        r = 6
        draw.ellipse([px-r, py-r, px+r, py+r], fill=(255, 255, 255, 200), outline=(0, 0, 0, 255), width=1)

    # 2. 匹配 CLICK(x,y) -> 画个青色(Cyan)半透明十字靶心 (对比红色网格极佳)
    click_match = re.search(r"\[LAST_ACTION: CLICK\((\d+\.?\d*),(\d+\.?\d*)\)\]", action_str)
    if click_match:
        x, y = click_match.groups()
        px, py = to_px(x, y)
        r = 12
        # 青色底圈
        draw.ellipse([px-r, py-r, px+r, py+r], fill=(0, 255, 255, 150), outline=(255, 255, 255, 255), width=2)
        # 白色十字
        draw.line([px-r-5, py, px+r+5, py], fill=(255, 255, 255, 255), width=2)
        draw.line([px, py-r-5, px, py+r+5], fill=(255, 255, 255, 255), width=2)

    # 3. 匹配 DOUBLE_CLICK(x,y) -> 画个蓝色(Blue)双圈靶心
    dclick_match = re.search(r"\[LAST_ACTION: DOUBLE_CLICK\((\d+\.?\d*),(\d+\.?\d*)\)\]", action_str)
    if dclick_match:
        x, y = dclick_match.groups()
        px, py = to_px(x, y)
        r = 14
        # 蓝色底圈
        draw.ellipse([px-r, py-r, px+r, py+r], fill=(0, 100, 255, 150), outline=(255, 255, 255, 255), width=2)
        # 内层白圈
        draw.ellipse([px-(r-4), py-(r-4), px+(r-4), py+(r-4)], outline=(255, 255, 255, 255), width=1)

    # 4. 匹配 DRAG(x1,y1,x2,y2) -> 绿色轨迹线，绿色起点，黄色终点
    drag_match = re.search(r"\[LAST_ACTION: DRAG\((\d+\.?\d*),(\d+\.?\d*),(\d+\.?\d*),(\d+\.?\d*)\)\]", action_str)
    if drag_match:
        x1, y1, x2, y2 = drag_match.groups()
        p1 = to_px(x1, y1)
        p2 = to_px(x2, y2)
        
        # 绿色带透明度的连接线
        draw.line([p1, p2], fill=(0, 255, 0, 200), width=4)
        
        # 绿色起点圆
        draw.ellipse([p1[0]-6, p1[1]-6, p1[0]+6, p1[1]+6], fill=(0, 255, 0, 255), outline=(255,255,255,255), width=1)
        
        # 黄色终点靶心 (黄色在网格上也很显眼)
        r_end = 8
        draw.ellipse([p2[0]-r_end, p2[1]-r_end, p2[0]+r_end, p2[1]+r_end], fill=(255, 215, 0, 180), outline=(255,255,255,255), width=2)

    # 合并图层，转回 RGB (防 JPG 格式不支持 Alpha 通道)
    combined = Image.alpha_composite(image, overlay)
    return combined.convert("RGB")

def scale_to_fit(width: int, height: int, max_w: int = 1920, max_h: int = 1080) -> tuple[int, int]:
    """计算等比例缩放后的尺寸"""
    # 计算宽和高的缩放比例
    scale_w = max_w / width
    scale_h = max_h / height
    
    # 取较小的那个缩放比例，确保长宽都不超过限制
    scale = min(scale_w, scale_h, 1.0) # 如果原图比 1920x1080 小，则不放大(1.0)
    
    new_width = int(width * scale)
    new_height = int(height * scale)
    return new_width, new_height

def _get_target_message(message, role):
    """
    根据角色获取目标消息
    
    参数:
        message (list): 消息列表引用
        role (str): 要操作的角色，可选值: 'user', 'assistant', 'system'
    
    返回:
        dict: 目标消息字典
    """
    # 验证输入参数
    if not isinstance(message, list):
        raise TypeError("message必须是列表类型")
    
    if role not in ['user', 'assistant', 'system']:
        raise ValueError("role必须是'user'或'assistant'或'system'")
    
    target_message = None
    
    # 根据role决定要操作的对象
    if role == 'user':
        # 查找最后一个role为'user'的消息
        for msg in reversed(message):
            if isinstance(msg, dict) and msg['role'] == 'user':
                target_message = msg
                break
    elif role == 'assistant':
        # 检查最后一个消息
        if message and message[-1]['role'] == 'assistant':
            target_message = message[-1]
        else:
            # 如果最后一个消息不是assistant，创建一个新的
            new_assistant_msg = {'role': 'assistant', 'content': '','reasoning_content': ''}
            message.append(new_assistant_msg)
            target_message = new_assistant_msg
    elif role == 'system':
        # 查找第一个role为'system'的消息
        if message and message[0]['role'] == 'system':
            target_message = message[0]
        else:
            # 如果没有找到system消息，创建一个新的
            target_message = {'role': 'system', 'content': ''}
            message.insert(0, target_message)
    
    return target_message

def content_append(message, role, content):
    """
    将content添加到指定role消息的末尾
    """
    target_message = _get_target_message(message, role)
    if target_message:
        current_content = target_message.get('content', '')
        target_message['content'] = current_content + content

def content_prepend(message, role, content):
    """
    将content添加到指定role消息的前面
    """
    target_message = _get_target_message(message, role)
    if target_message:
        current_content = target_message.get('content', '')
        target_message['content'] = content + current_content

def content_replace(message, role, content):
    """
    用content替换指定role消息的内容
    """
    target_message = _get_target_message(message, role)
    if target_message:
        target_message['content'] = content

def content_new(message, role, content):
    """
    用content替换指定role消息的内容
    """
    message.append({'role': role, 'content': content})

configure_host_port(args.host, args.port)

from py.node_runner import node_mgr


def _merge_runtime_mcp_state_into_latest_settings(latest_settings: Dict[str, Any], runtime_settings_snapshot: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """
    MCP 启动任务是异步完成的，期间用户可能已经通过 UI 修改了 provider 配置。
    这里只把 MCP 运行时状态合并回最新 settings，避免旧快照覆盖新配置。
    """
    latest = latest_settings if isinstance(latest_settings, dict) else {}
    runtime_snapshot = runtime_settings_snapshot if isinstance(runtime_settings_snapshot, dict) else {}

    latest_mcp_servers = latest.setdefault("mcpServers", {})
    runtime_mcp_servers = runtime_snapshot.get("mcpServers") or {}
    if not isinstance(latest_mcp_servers, dict) or not isinstance(runtime_mcp_servers, dict):
        return latest

    for server_name, runtime_server in runtime_mcp_servers.items():
        if server_name not in latest_mcp_servers:
            continue
        if not isinstance(runtime_server, dict):
            continue

        latest_server = latest_mcp_servers.get(server_name)
        if not isinstance(latest_server, dict):
            continue

        for field_name in ("disabled", "processingStatus", "tools"):
            if field_name in runtime_server:
                latest_server[field_name] = runtime_server[field_name]

    return latest

@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- [核心防御] 立即清理系统环境变量中的 SOCKS 代理，防止 httpx 崩溃 ---
    for env_key in ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy']:
        val = os.environ.get(env_key, "")
        if val.lower().startswith('socks'):
            # 彻底移除会导致崩溃的 socks 环境变量
            os.environ.pop(env_key, None)

    # 基础初始化
    await _copy_default_skills()
    
    # 1. 准备所有独立的初始化任务
    from py.get_setting import init_db, init_covs_db, load_settings, save_settings
    from tzlocal import get_localzone
    
    asyncio.create_task(clean_temp_files_task())
    
    # 并行执行耗时操作
    init_db_task = init_db()
    init_covs_task = init_covs_db()
    load_locales_task = asyncio.to_thread(lambda: json.load(open(base_path + "/config/locales.json", "r", encoding="utf-8")))
    settings_task = load_settings() 
    timezone_task = asyncio.to_thread(get_localzone)
    
    results = await asyncio.gather(
        init_db_task, 
        init_covs_task, 
        load_locales_task, 
        settings_task, 
        timezone_task
    )
    
    # 2. 解包结果
    global settings, client, reasoner_client, fast_client, mcp_client_list, local_timezone, logger, locales, global_http_client, task_scheduler_runtime, openxnet_login_proxy_url, openxnet_login_trust_env, HA_client
    _, _, locales, settings, local_timezone = results
    
    # --- [日志系统初始化] ---
    timestamp = time.time()
    log_path = os.path.join(LOG_DIR, f"backend_{timestamp}.log")
    logger = logging.getLogger("app")
    if not logger.handlers:
        logger.setLevel(logging.INFO)
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))
        logger.addHandler(handler)
    logger.info("===== 日志系统初始化成功 =====")
    logger.info(f"[ConfigProfile] profile={RUNTIME_PROFILE} app_name={APP_NAME} user_data_dir={USER_DATA_DIR}")

    # --- [代理与 HTTP 客户端初始化] ---
    proxy_url = None
    trust_env = False
    
    if settings:
        sys_set = settings.get("systemSettings", {})
        mode = sys_set.get("proxyMode")
        manual_url = sys_set.get("proxy", "").strip()
        isChinaProxy = sys_set.get("isChinaProxy", False)

        if mode == "manual" and manual_url:
            # 手动模式：如果是 socks，由于没安装库，直接跳过并警告
            if manual_url.lower().startswith("socks"):
                logger.error("检测到手动设置了 SOCKS 代理，但当前环境不支持。代理已失效。")
                proxy_url = None
            else:
                proxy_url = manual_url
        elif mode == "system":
            # 系统模式：信任环境（此时环境里已经没有 socks 了，很安全）
            trust_env = True
        if isChinaProxy:
            # 2. 注入 Node.js / NPM 镜像源 (重点)
            # 设置这个环境变量后，所有的 npm install (包括你的 node_runner) 都会默认使用这个源
            os.environ["npm_config_registry"] = "https://registry.npmmirror.com/"
            
            # 3. 注入 UV / Pip 镜像源 (重点)
            # 这样后续如果调用 uv 或 pip，也会自动使用国内镜像
            os.environ["UV_INDEX_URL"] = "https://mirrors.aliyun.com/pypi/simple/"

    # 初始化全局带连接池的 HTTP 客户端
    timeout_config = httpx.Timeout(None, connect=10.0)
    openxnet_login_proxy_url = proxy_url
    openxnet_login_trust_env = trust_env
    global_http_client = httpx.AsyncClient(
        timeout=timeout_config,
        proxy=openxnet_login_proxy_url,
        trust_env=openxnet_login_trust_env
    )

    # --- [模型 Client 初始化] ---
    # 辅助函数：统一注入 global_http_client
    def create_model_client(provider_key, config_node=None):
        """创建共享 HTTP 连接池的模型客户端；输入提供商键和可选配置，返回客户端，配置无效时向上抛出异常。"""

        return create_provider_client(
            settings,
            config_node=config_node,
            http_client=global_http_client,
        )

    if settings:
        client = create_model_client('main')
        reasoner_client = create_model_client('reasoner', settings.get('reasoner', {}))
        
        fast_cfg = settings.get('fast', {})
        if fast_cfg.get('enabled'):
            fast_client = create_model_client('fast', fast_cfg)
        else:
            fast_client = None
    else:
        client = AsyncOpenAI(http_client=global_http_client)
        reasoner_client = AsyncOpenAI(http_client=global_http_client)
        fast_client = AsyncOpenAI(http_client=global_http_client)

    # Local ASR is activated on demand by Desktop Core instead of blocking backend startup.
    # MCP 初始化逻辑 (保持你原有的逻辑，但内部会复用 global_http_client)
    mcp_init_tasks = []

    async def init_mcp_with_timeout(server_name: str, server_config: dict, timeout=6.0, max_wait_failure=5.0):
        """限时初始化兼容 MCP 客户端；输入名称、配置和超时，返回状态元组，并在失败时关闭连接。"""

        if server_config.get("disabled"):
            return server_name, None, "disabled"
        
        mcp_client = mcp_client_list.get(server_name) or _create_server_mcp_client()
        mcp_client_list[server_name] = mcp_client
        failure_event = asyncio.Event()
        first_error = None

        async def on_failure(msg: str):
            """处理兼容 MCP 首次连接失败；输入错误消息，无返回，更新设置并关闭当前客户端。"""

            nonlocal first_error
            if first_error: return
            first_error = "connection_failed"
            logger.error(f"MCP {server_name} connection failed")
            settings.setdefault("mcpServers", {}).setdefault(server_name, {})["disabled"] = True
            mcp_client.disabled = True
            await mcp_client.close()
            failure_event.set()

        init_task = asyncio.create_task(mcp_client.initialize(server_name, server_config, on_failure_callback=on_failure))
        try:
            await asyncio.wait_for(init_task, timeout=timeout)
            try:
                await asyncio.wait_for(failure_event.wait(), timeout=max_wait_failure)
            except asyncio.TimeoutError:
                pass
            return server_name, (None if first_error else mcp_client), first_error
        except Exception:
            return server_name, None, "initialization_failed"
        finally:
            if not init_task.done(): init_task.cancel()

    async def check_results():
        """汇总兼容 MCP 初始化结果；无输入和返回，持久化运行状态并广播最新设置。"""

        global settings
        for task in asyncio.as_completed(mcp_init_tasks):
            name, m_client, err = await task
            if err:
                settings['mcpServers'][name]['processingStatus'] = 'server_error'
            elif m_client:
                mcp_client_list[name] = m_client
        latest_settings = await load_settings()
        merged_settings = _merge_runtime_mcp_state_into_latest_settings(
            latest_settings,
            copy.deepcopy(settings or {}),
        )
        settings = merged_settings
        await save_settings(merged_settings)
        await broadcast_settings_update(merged_settings)

    if RUNTIME_PROFILE != "server":
        # Desktop 与 Execution Engine 只能通过 typed Runtime 或私有 Tool Broker 使用 MCP。
        asyncio.create_task(broadcast_settings_update(settings or {}))
    elif settings and settings.get('mcpServers'):
        mcp_init_tasks = [asyncio.create_task(init_mcp_with_timeout(k, v)) for k, v in settings['mcpServers'].items()]
        if mcp_init_tasks: asyncio.create_task(check_results())
    else:
        asyncio.create_task(broadcast_settings_update(settings or {}))

    # --- [Synapse Registry 初始化] ---
    global synapse_registry
    synapse_data_path = os.path.join(USER_DATA_DIR, "synapse_data.json")
    synapse_registry = get_synapse_registry(persist_path=synapse_data_path)
    register_builtin_tools(synapse_registry)
    # 自动注册已配置的 MCP 工具
    for name, mc in mcp_client_list.items():
        if mc and not getattr(mc, 'disabled', False):
            synapse_registry.register(f"mcp:{name}", "mcp", f"MCP Server: {name}")
    logger.info(f"[Synapse] Registry initialized with {len(synapse_registry.get_all())} tools")

    # --- [v0.5.3] TokenMeter 用量追踪初始化 ---
    try:
        token_meter = init_token_meter(data_dir=USER_DATA_DIR)
        _tm_stats = token_meter.stats()
        logger.info(f"[v0.5.3] TokenMeter initialized: {_tm_stats['total_records']} records, {_tm_stats['lifetime_tokens']} lifetime tokens")
    except Exception as _tm_init_err:
        logger.warning(f"[v0.5.3] TokenMeter init failed (non-fatal): {_tm_init_err}")

    # --- [NeuroSymbol 认知符号库初始化] ---
    global symbol_store
    symbol_store = get_symbol_store(data_dir=USER_DATA_DIR)
    logger.info(f"[NeuroSymbol] Store initialized with {symbol_store.get_stats()['totalSymbols']} symbols")

    # --- [v0.5.9] Recall Center 联邦记忆初始化 ---
    global memory_federation
    try:
        hindsight_enabled = os.getenv("OPENXNET_HINDSIGHT_ENABLED", "").strip().lower() in ("1", "true", "yes", "on")
        hindsight_config = HindsightConfig(
            enabled=hindsight_enabled,
            base_url=os.getenv("OPENXNET_HINDSIGHT_URL", "http://127.0.0.1:8765").strip() or "http://127.0.0.1:8765",
            api_key=os.getenv("OPENXNET_HINDSIGHT_API_KEY", "").strip(),
            bank=os.getenv("OPENXNET_HINDSIGHT_BANK", "default").strip() or "default",
        )
        memory_federation = MemoryFederation(
            hindsight_config=hindsight_config,
            symbol_store=symbol_store,
        )
        memory_sources = ["neuro_symbol"]
        if hindsight_config.enabled:
            memory_sources.append("hindsight")
        logger.info(f"[v0.5.9] Recall Center initialized with memory sources: {', '.join(memory_sources)}")
    except Exception as _memory_init_err:
        logger.warning(f"[v0.5.9] Recall Center init failed (non-fatal): {_memory_init_err}")
        memory_federation = None

    # --- [v0.5.1] Temporal Knowledge Graph 初始化 ---
    try:
        kg = init_temporal_kg(data_dir=USER_DATA_DIR)
        kg_stats = kg.stats()
        logger.info(f"[v0.5.1] Temporal KG initialized: {kg_stats['entities']} entities, {kg_stats['triples']} triples")
    except Exception as _kg_init_err:
        logger.warning(f"[v0.5.1] Temporal KG init failed (non-fatal): {_kg_init_err}")

    # --- [v0.5.1] NeuroSymbol Rules 注入 ---
    try:
        rule_registry = get_rule_registry()
        injected = rule_registry.inject_rules_to_symbol_store(symbol_store)
        logger.info(f"[v0.5.1] Injected {injected} rules into SymbolStore ({len(rule_registry.get_enabled())} rules active)")
    except Exception as _rule_init_err:
        logger.warning(f"[v0.5.1] Rule injection failed (non-fatal): {_rule_init_err}")

    # --- [v1.0] Neural-Symbolic OS Kernel 初始化 ---
    global kernel
    try:
        from py.kernel.bootstrap import bootstrap_kernel
        kernel = bootstrap_kernel(
            settings=settings or {},
            symbol_store=symbol_store,
            logger=logger,
            schedule_task=asyncio.create_task,
        )
    except Exception as _kernel_init_err:
        kernel = None
        logger.warning(f"[Kernel] Initialization failed (non-fatal): {_kernel_init_err}")

    # --- [v0.5.1] Background Sleep Maintenance Task ---
    async def _sleep_maintenance_loop():
        """Background task: run memory decay every 24h"""
        await asyncio.sleep(60)  # Wait 1min after startup
        while True:
            try:
                if symbol_store:
                    result = symbol_store.perform_sleep_maintenance()
                    logger.info(f"[v0.5.1] Sleep maintenance completed: {result}")
            except Exception as maint_err:
                logger.warning(f"[v0.5.1] Sleep maintenance error: {maint_err}")
            await asyncio.sleep(86400)  # 24 hours

    asyncio.create_task(_sleep_maintenance_loop())

    # --- [v0.5.2] Plugin SDK 初始化 ---
    try:
        from py.plugins.builtin.time_tracker import TimeTool
        from py.plugins.builtin.weather_plugin import WeatherTool
        plugin_registry = get_plugin_registry()
        plugin_registry.register(TimeTool())
        plugin_registry.register(WeatherTool())
        logger.info(f"[v0.5.2] Plugin SDK initialized: {len(plugin_registry.get_all_tools())} builtin plugins registered")
    except Exception as _sdk_err:
        logger.warning(f"[v0.5.2] Plugin SDK init failed (non-fatal): {_sdk_err}")

    # --- [v0.5.2 P1] Engine Checkpoint 初始化 ---
    try:
        cp = init_engine_checkpoint(data_dir=USER_DATA_DIR)
        interrupted = cp.get_interrupted_turns()
        if interrupted:
            logger.warning(f"[v0.5.2] Found {len(interrupted)} interrupted turn(s) from last session!")
            for t in interrupted[:3]:
                logger.warning(f"  - Turn {t['turn_id']}: state={t['state']}, prompt='{t.get('user_prompt','')[:50]}'")
        cp.cleanup_old(days=7)
        logger.info("[v0.5.2] Engine Checkpoint initialized")
    except Exception as _cp_err:
        logger.warning(f"[v0.5.2] Checkpoint init failed (non-fatal): {_cp_err}")

    # --- [v0.5.3] Enterprise Module 初始化 ---
    global role_card_manager, enterprise_kb_manager, workspace_manager, xnet_bridge, sandbox_manager
    try:
        role_card_manager = RoleCardManager(data_dir=USER_DATA_DIR)
        enterprise_kb_manager = EnterpriseKBManager(data_dir=USER_DATA_DIR)
        # --- [v0.6.0] Enterprise Expansion 初始化 ---
        workspace_manager = WorkspaceManager(data_dir=USER_DATA_DIR)
        xnet_bridge = XnetBridge(data_dir=USER_DATA_DIR)
        sandbox_manager = SandboxStateManager(data_dir=USER_DATA_DIR)
        logger.info(f"[v0.5.3] Enterprise modules initialized: {len(role_card_manager.list_all())} role cards, {len(enterprise_kb_manager.list_all())} KBs")
        logger.info(f"[v0.6.0] Enterprise expansion initialized: {len(workspace_manager.list_envs())} workspaces, {len(sandbox_manager.agents)} sandbox agents")
    except Exception as _ent_err:
        logger.warning(f"[v0.5.3] Enterprise module init failed (non-fatal): {_ent_err}")
        role_card_manager = None
        enterprise_kb_manager = None
        workspace_manager = None
        xnet_bridge = None
        sandbox_manager = None

    # --- [启动完成] ---
    if RUNTIME_PROFILE == "server":
        scheduler_module = import_module(".".join(("py", "task_scheduler")))
        scheduler_class = getattr(scheduler_module, "TaskSchedulerRuntime")
        task_scheduler_runtime = scheduler_class(
            settings_loader=load_settings,
            launch_guard=_get_task_scheduler_block_message,
        )
        await task_scheduler_runtime.start()

    yield

    # --- [关闭逻辑] ---
    print("System shutting down, cleaning up...")
    if task_scheduler_runtime:
        await task_scheduler_runtime.stop()
        task_scheduler_runtime = None
    ext_ids = list(node_mgr.exts.keys())
    for ext_id in ext_ids:
        try: await node_mgr.stop(ext_id)
        except: pass
        
    if global_http_client:
        await global_http_client.aclose()
    if memory_federation:
        try:
            await memory_federation.close()
        except Exception:
            pass
    if HA_client:
        try:
            await HA_client.close()
        except Exception:
            pass
        HA_client = None
    print("All processes terminated.")


# WebSocket端点增加连接管理
active_connections = []
# 新增广播函数
async def broadcast_settings_update(settings):
    """向所有WebSocket连接推送配置更新"""
    renderer_settings = redact_managed_credentials_for_renderer(settings)
    for connection in active_connections:  # 需要维护全局连接列表
        try:
            await connection.send_json({
                "type": "settings_update",
                "data": renderer_settings
            })
            print("Settings broadcasted to client")
        except Exception as e:
            logger.error(f"Broadcast failed: {e}")


async def broadcast_ui_command(command_type: str, data=None):
    """向前端广播一次性 UI 指令。"""
    payload = data or {}
    for connection in active_connections:
        try:
            await connection.send_json({
                "type": command_type,
                "data": payload,
            })
        except Exception as e:
            logger.error(f"UI command broadcast failed: {e}")


def _normalize_character_card_greetings(greetings):
    normalized = []
    for greeting in greetings or []:
        text = str(greeting or "").strip()
        if text:
            normalized.append(text)
    return normalized


def _normalize_character_card_book(entries):
    normalized = []
    for entry in entries or []:
        if not isinstance(entry, dict):
            continue
        keys_raw = entry.get("keysRaw")
        if not keys_raw and isinstance(entry.get("keys"), list):
            keys_raw = "\n".join(
                str(item or "").strip()
                for item in entry.get("keys", [])
                if str(item or "").strip()
            )
        content = str(entry.get("content") or "").strip()
        keys_text = str(keys_raw or "").strip()
        if keys_text or content:
            normalized.append({
                "keysRaw": keys_text,
                "content": content,
            })
    return normalized


def _normalize_character_card_memory(memory: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize legacy/imported role-card fields before chat prompt injection."""
    if not isinstance(memory, dict):
        return {}

    def first_text(*keys: str, default: str = "") -> str:
        for key in keys:
            value = memory.get(key)
            if value is not None and str(value).strip():
                return str(value).strip()
        return default

    memory["id"] = first_text("id")
    memory["name"] = first_text("name", "title", "char_name")
    memory["providerId"] = first_text("providerId", "provider_id")
    memory["model"] = first_text("model", "modelId", "model_id")
    memory["api_key"] = first_text("api_key", "apiKey")
    memory["base_url"] = first_text("base_url", "baseUrl", "url")
    memory["vendor"] = first_text("vendor")
    memory["avatar"] = first_text("avatar", "avatarUrl", "avatar_url")
    memory["description"] = first_text("description", "desc")
    memory["personality"] = first_text("personality")

    mes_example = first_text("mesExample", "mes_example", "messageExample", "dialogueExample")
    memory["mesExample"] = mes_example
    memory["mes_example"] = mes_example

    system_prompt = first_text("systemPrompt", "system_prompt", "system")
    memory["systemPrompt"] = system_prompt
    memory["system_prompt"] = system_prompt

    first_mes = first_text("firstMes", "first_mes", "firstMessage", "greeting")
    memory["firstMes"] = first_mes
    memory["first_mes"] = first_mes

    memory["alternateGreetings"] = _normalize_character_card_greetings(
        memory.get("alternateGreetings") or memory.get("alternate_greetings") or []
    )
    memory["characterBook"] = _normalize_character_card_book(
        memory.get("characterBook")
        or memory.get("character_book")
        or memory.get("lorebook")
        or []
    )

    try:
        memory["embedding_dims"] = int(memory.get("embedding_dims") or 1024)
    except (TypeError, ValueError):
        memory["embedding_dims"] = 1024
    memory["infer"] = bool(memory.get("infer") or False)
    return memory


async def get_character_card_tool(settings):
    provider_ids = [
        str(provider.get("id"))
        for provider in settings.get("modelProviders", [])
        if provider.get("id")
    ][:12]
    provider_hint = (
        f"如需为角色卡绑定向量记忆供应商，可选 providerId 示例：{json.dumps(provider_ids, ensure_ascii=False)}。"
        if provider_ids
        else "providerId 可留空。"
    )
    return {
        "type": "function",
        "function": {
            "name": "openxnet_create_character_card",
            "description": "当用户要求创建/新建/生成角色卡、人物卡、角色设定，并希望真正保存到 OpenXnet 时，必须调用此工具，而不是只返回文本模板。创建后会同步到 OpenXnet 的角色卡组件。"
            + provider_hint,
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "角色卡名称。",
                    },
                    "description": {
                        "type": "string",
                        "description": "角色背景或世界观设定。",
                    },
                    "personality": {
                        "type": "string",
                        "description": "角色性格描述。",
                    },
                    "mesExample": {
                        "type": "string",
                        "description": "对话示例。",
                    },
                    "systemPrompt": {
                        "type": "string",
                        "description": "用于驱动角色的系统提示词。",
                    },
                    "firstMes": {
                        "type": "string",
                        "description": "角色的第一句开场白。",
                    },
                    "alternateGreetings": {
                        "type": "array",
                        "description": "可选的额外问候语列表。",
                        "items": {
                            "type": "string",
                        },
                    },
                    "characterBook": {
                        "type": "array",
                        "description": "世界书条目列表，每项包含 keysRaw 和 content。",
                        "items": {
                            "type": "object",
                            "properties": {
                                "keysRaw": {
                                    "type": "string",
                                    "description": "换行分隔的关键词。",
                                },
                                "content": {
                                    "type": "string",
                                    "description": "命中关键词时补充给模型的内容。",
                                },
                            },
                        },
                    },
                    "avatar": {
                        "type": "string",
                        "description": "头像 URL，可留空。",
                    },
                    "providerId": {
                        "type": "string",
                        "description": "可选，绑定的向量记忆 providerId。",
                    },
                    "model": {
                        "type": "string",
                        "description": "可选，覆盖角色卡模型名。",
                    },
                    "base_url": {
                        "type": "string",
                        "description": "可选，覆盖角色卡请求地址。",
                    },
                    "api_key": {
                        "type": "string",
                        "description": "可选，覆盖角色卡 API Key。",
                    },
                    "infer": {
                        "type": "boolean",
                        "description": "是否启用该角色卡的长期记忆推断。",
                    },
                    "select_after_create": {
                        "type": "boolean",
                        "description": "创建后是否立即选中该角色卡。",
                    },
                    "open_editor": {
                        "type": "boolean",
                        "description": "创建后是否自动打开 OpenXnet 的角色卡编辑组件。",
                    },
                },
                "required": ["name"],
            },
        },
    }


def get_kernel_config_tools(settings):
    kernel_settings = (settings or {}).get("kernelSettings", {})
    config_settings = kernel_settings.get("configIntent", {}) if isinstance(kernel_settings, dict) else {}
    if isinstance(config_settings, dict) and config_settings.get("enabled", True) is False:
        return []
    return [
        {
            "type": "function",
            "function": {
                "name": "openxnet_parse_config_intent",
                "description": (
                    "Parse a user's natural-language request to change OpenXnet settings into a guarded "
                    "configuration intent. This tool does not apply changes. Use it before any chat-driven "
                    "settings change and show the returned changes/risks plus exact confirmation text to the user."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "text": {
                            "type": "string",
                            "description": "The user's original request about changing OpenXnet settings.",
                        },
                    },
                    "required": ["text"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "openxnet_apply_config_intent",
                "description": (
                    "Apply a previously parsed OpenXnet configuration intent only after explicit user "
                    "confirmation. The backend requires a pending unexpired intent, exact confirmation text, "
                    "path revalidation, audit, settings save, and broadcast."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "intent": {
                            "type": "object",
                            "description": "The intent object returned by openxnet_parse_config_intent.",
                        },
                        "confirmed": {
                            "type": "boolean",
                            "description": "Set true only when the user explicitly confirmed this exact change.",
                        },
                        "confirmation_text": {
                            "type": "string",
                            "description": "The exact confirmation text returned in intent.confirmation.text and typed by the user.",
                        },
                    },
                    "required": ["intent", "confirmed", "confirmation_text"],
                },
            },
        },
    ]


async def openxnet_parse_config_intent(text: str):
    current_settings = await load_settings()
    intent = parse_config_intent(text, current_settings)
    workspace = _workspace_dir_from_settings(current_settings)
    config_settings = _kernel_config_intent_settings(current_settings)
    intent_payload = register_config_intent(
        intent,
        workspace_dir=workspace,
        actor="model_tool",
        ttl_seconds=int(config_settings.get("intentTtlSeconds", 600) or 600),
    )
    get_kernel_audit(workspace).append(
        "kernel.config.intent",
        intent_payload,
        actor="model_tool",
        workspace_dir=workspace,
    )
    return intent_payload


async def openxnet_apply_config_intent(intent: dict, confirmed: bool = False, confirmation_text: str = ""):
    current_settings = await load_settings()
    workspace = _workspace_dir_from_settings(current_settings)
    config_settings = _kernel_config_intent_settings(current_settings)
    next_settings, result = apply_config_intent(
        current_settings,
        intent or {},
        confirmed=confirmed,
        confirmation_text=confirmation_text,
        workspace_dir=workspace,
        require_pending=bool(config_settings.get("requirePendingIntent", True)),
        require_confirmation_text=bool(config_settings.get("requireConfirmationText", True)),
    )
    get_kernel_audit(workspace).append(
        "kernel.config.apply",
        {
            "intent_id": (intent or {}).get("intent_id"),
            "confirmed": confirmed,
            "confirmation_text_provided": bool(confirmation_text),
            "result": result,
        },
        actor="model_tool",
        workspace_dir=workspace,
    )
    if result.get("applied"):
        await save_settings(next_settings)
        await broadcast_settings_update(next_settings)
    return result


async def openxnet_create_character_card(
    name: str,
    description: str = "",
    personality: str = "",
    mesExample: str = "",
    systemPrompt: str = "",
    firstMes: str = "",
    alternateGreetings=None,
    characterBook=None,
    avatar: str = "",
    providerId: str = "",
    model: str = "",
    base_url: str = "",
    api_key: str = "",
    infer: bool = False,
    select_after_create: bool = False,
    open_editor: bool = True,
):
    current_settings = await load_settings()
    memories = current_settings.setdefault("memories", [])
    memory_settings = current_settings.setdefault("memorySettings", {})

    provider_id = str(providerId or "").strip() or None
    provider_model = str(model or "").strip()
    provider_url = str(base_url or "").strip()
    provider_api_key = str(api_key or "").strip()
    provider_vendor = ""

    if provider_id:
        provider = next(
            (
                item for item in current_settings.get("modelProviders", [])
                if str(item.get("id")) == provider_id
            ),
            None,
        )
        if provider:
            provider_vendor = str(provider.get("vendor") or "").strip()
            provider_model = provider_model or str(provider.get("modelId") or "").strip()
            provider_url = provider_url or str(provider.get("url") or "").strip()
            provider_api_key = provider_api_key or str(provider.get("apiKey") or "").strip()

    memory_id = str(uuid.uuid4())
    memory = {
        "id": memory_id,
        "name": str(name or "").strip(),
        "infer": bool(infer),
        "providerId": provider_id,
        "model": provider_model,
        "api_key": provider_api_key,
        "base_url": provider_url,
        "embedding_dims": 1024,
        "vendor": provider_vendor,
        "description": str(description or "").strip(),
        "avatar": str(avatar or "").strip(),
        "personality": str(personality or "").strip(),
        "mesExample": str(mesExample or "").strip(),
        "systemPrompt": str(systemPrompt or "").strip(),
        "firstMes": str(firstMes or "").strip(),
        "alternateGreetings": _normalize_character_card_greetings(alternateGreetings),
        "characterBook": _normalize_character_card_book(characterBook),
    }
    memory = _normalize_character_card_memory(memory)

    if not memory["name"]:
        raise ValueError("角色卡名称不能为空")

    memories.append(memory)
    if select_after_create:
        memory_settings["selectedMemory"] = memory_id
        memory_settings["is_memory"] = True

    await save_settings(current_settings)
    await broadcast_settings_update(current_settings)

    if open_editor:
        await broadcast_ui_command("open_memory_editor", {
            "memoryId": memory_id,
        })

    return json.dumps({
        "success": True,
        "memoryId": memory_id,
        "name": memory["name"],
        "selected": bool(select_after_create),
        "opened_editor": bool(open_editor),
        "message": f"角色卡 {memory['name']} 已创建并同步到 OpenXnet。",
    }, ensure_ascii=False)


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def cors_options_workaround(request: Request, call_next):
    if request.method == "OPTIONS":
        return Response(
            status_code=200,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Max-Age": "86400",   # 预检缓存 24 h
            }
        )
    return await call_next(request)


DESKTOP_TASK_RPC_TOKEN = str(os.environ.get("OPENXNET_TASK_RPC_TOKEN") or "").strip()


def _is_authorized_desktop_task_request(request: Request) -> bool:
    """Validate the process-scoped bearer token for Desktop broker routes."""

    return is_authorized_desktop_task_rpc(
        runtime_profile=RUNTIME_PROFILE,
        expected_token=DESKTOP_TASK_RPC_TOKEN,
        path=request.url.path,
        authorization=str(request.headers.get("authorization") or ""),
    )


@app.middleware("http")
async def enforce_task_http_profile(request: Request, call_next):
    """Hide Server task commands and authenticate Desktop broker routes."""

    policy = resolve_task_http_profile_policy(RUNTIME_PROFILE, request.url.path)
    if not policy.visible:
        return JSONResponse(
            status_code=404,
            content={"detail": "Not Found"},
            headers={"Cache-Control": "no-store"},
        )
    if (
        request.method != "OPTIONS"
        and policy.requires_bearer
        and not _is_authorized_desktop_task_request(request)
    ):
        return JSONResponse(
            status_code=401,
            content={"detail": "Desktop task RPC authentication failed."},
            headers={"Cache-Control": "no-store"},
        )
    return await call_next(request)

async def t(text: str) -> str:
    global locales
    settings = await load_settings()
    target_language = settings["currentLanguage"]
    return locales[target_language].get(text, text)


# 全局存储异步工具状态
async_tools = {}
async_tools_lock = asyncio.Lock()

async def execute_tool(tool_id: str, tool_name: str, args: dict, settings: dict,user_prompt: str):
    try:
        results = await dispatch_tool(tool_name, args, settings)
        if isinstance(results, AsyncIterator):
            buffer = []
            async for chunk in results:
                buffer.append(chunk)
            results = "".join(buffer)
                
        if tool_name in ["query_knowledge_base"] and type(results) == list:
            from py.know_base import rerank_knowledge_base
            if settings["KBSettings"]["is_rerank"]:
                results = await rerank_knowledge_base(user_prompt,results)
            results = json.dumps(results, ensure_ascii=False, indent=4)
        async with async_tools_lock:
            async_tools[tool_id] = {
                "status": "completed",
                "result": results,
                "name": tool_name,
                "parameters": args,
            }
    except Exception as e:
        async with async_tools_lock:
            async_tools[tool_id] = {
                "status": "error",
                "result": str(e),
                "name": tool_name,
                "parameters": args,
            }

async def get_image_content(image_url: str) -> str:
    import hashlib
    settings = await load_settings()
    base64_image = await get_image_base64(image_url)
    media_type = await get_image_media_type(image_url)
    url= f"data:{media_type};base64,{base64_image}"
    image_hash = hashlib.md5(image_url.encode()).hexdigest()
    content = ""
    if settings['vision']['enabled']:
        # 如果uploaded_files/{item['image_url']['hash']}.txt存在，则读取文件内容，否则调用vision api
        if os.path.exists(os.path.join(UPLOAD_FILES_DIR, f"{image_hash}.txt")):
            with open(os.path.join(UPLOAD_FILES_DIR, f"{image_hash}.txt"), "r", encoding='utf-8') as f:
                content += f"\n\n图片(URL:{image_url} 哈希值：{image_hash})信息如下：\n\n"+str(f.read())+"\n\n"
        else:
            images_content = [{"type": "text", "text": "请仔细描述图片中的内容，包含图片中可能存在的文字、数字、颜色、形状、大小、位置、人物、物体、场景等信息。"},{"type": "image_url", "image_url": {"url": url}}]
            client = AsyncOpenAI(api_key=settings['vision']['api_key'],base_url=settings['vision']['base_url'])
            response = await client.chat.completions.create(
                model=settings['vision']['model'],
                messages = [{"role": "user", "content": images_content}],
                temperature=settings['vision']['temperature'],
            )
            content = f"\n\nn图片(URL:{image_url} 哈希值：{image_hash})信息如下：\n\n"+str(response.choices[0].message.content)+"\n\n"
            with open(os.path.join(UPLOAD_FILES_DIR, f"{image_hash}.txt"), "w", encoding='utf-8') as f:
                f.write(str(response.choices[0].message.content))
    else:           
        # 如果uploaded_files/{item['image_url']['hash']}.txt存在，则读取文件内容，否则调用vision api
        if os.path.exists(os.path.join(UPLOAD_FILES_DIR, f"{image_hash}.txt")):
            with open(os.path.join(UPLOAD_FILES_DIR, f"{image_hash}.txt"), "r", encoding='utf-8') as f:
                content += f"\n\nn图片(URL:{image_url} 哈希值：{image_hash})信息如下：\n\n"+str(f.read())+"\n\n"
        else:
            images_content = [{"type": "text", "text": "请仔细描述图片中的内容，包含图片中可能存在的文字、数字、颜色、形状、大小、位置、人物、物体、场景等信息。"},{"type": "image_url", "image_url": {"url": url}}]
            client = AsyncOpenAI(api_key=settings['api_key'],base_url=settings['base_url'])
            response = await client.chat.completions.create(
                model=settings['model'],
                messages = [{"role": "user", "content": images_content}],
                temperature=settings['temperature'],
            )
            content = f"\n\nn图片(URL:{image_url} 哈希值：{image_hash})信息如下：\n\n"+str(response.choices[0].message.content)+"\n\n"
            with open(os.path.join(UPLOAD_FILES_DIR, f"{image_hash}.txt"), "w", encoding='utf-8') as f:
                f.write(str(response.choices[0].message.content))
    return content

async def dispatch_tool(tool_name: str, tool_params: dict, settings: dict) -> str | List | AsyncIterator[str] | None :
    """通过 Kernel 策略执行工具；输入名称、参数和设置，返回工具结果，审批与失败语义由执行器统一处理。"""

    from py.kernel.executor import get_kernel_executor

    return await get_kernel_executor().execute_tool(
        tool_name=tool_name,
        tool_params=tool_params or {},
        settings=settings or {},
        legacy_call=lambda: _dispatch_tool_legacy(tool_name, tool_params, settings),
        actor="model",
    )


async def _dispatch_tool_legacy(tool_name: str, tool_params: dict, settings: dict) -> str | List | AsyncIterator[str] | None :
    """执行兼容工具分派；输入名称、参数和设置，返回工具结果，Desktop MCP 工具通过私有 Broker 调用。"""

    global mcp_client_list,_TOOL_HOOKS,HA_client,ChromeMCP_client,sql_client
    print("dispatch_tool",tool_name,tool_params)
    try:
        policy_settings = settings if isinstance(settings, dict) else {}
        policy_cli_settings = policy_settings.get("CLISettings", {}) if isinstance(policy_settings, dict) else {}
        if not isinstance(policy_cli_settings, dict):
            policy_cli_settings = {}
        policy_cwd = policy_cli_settings.get("cc_path", "")
        policy_project_allowed = False
        kernel_policy_root = policy_settings.get("kernelSettings", {}) if isinstance(policy_settings, dict) else {}
        kernel_policy_settings = kernel_policy_root.get("policyGate", {}) if isinstance(kernel_policy_root, dict) else {}
        respect_project_allow = not isinstance(kernel_policy_settings, dict) or kernel_policy_settings.get("respectProjectAllowAlways", True) is not False
        if policy_cwd and respect_project_allow:
            try:
                policy_project_allowed = bool(is_tool_allowed_by_project_config(policy_cwd, tool_name))
            except Exception:
                policy_project_allowed = False
        policy_decision = observe_tool_policy_shadow(
            settings or {},
            tool_name,
            tool_params or {},
            actor="model",
            workspace_dir=policy_cwd,
            project_allowed=policy_project_allowed,
        )
        if should_enforce_policy(policy_decision):
            print(f"[Kernel Policy] Blocked '{tool_name}', requesting approval.")
            approval_record = get_approval_center().create(
                tool_name=tool_name,
                tool_params=tool_params or {},
                policy_decision=policy_decision,
                workspace_dir=policy_decision.get("workspace_dir", "") or policy_cwd,
                actor="model",
                requested_by="policy_gate",
            )
            return json.dumps(
                build_approval_required_response(policy_decision, tool_params or {}, approval_record),
                ensure_ascii=False,
            )
    except Exception as policy_shadow_err:
        if logger:
            logger.debug(f"[Kernel] Policy shadow evaluation skipped: {policy_shadow_err}")
    
    from py.execution_tool_registry import (
        SENSITIVE_EXECUTION_TOOL_NAMES,
        build_execution_tool_registry,
    )

    registry = build_execution_tool_registry({
        "openxnet_create_character_card": openxnet_create_character_card,
        "openxnet_parse_config_intent": openxnet_parse_config_intent,
        "openxnet_apply_config_intent": openxnet_apply_config_intent,
        "get_image_content": get_image_content,
    })
    _TOOL_HOOKS = registry.hooks
    fetch_custom_http = registry.custom_http
    
    # ==================== 3. 权限拦截逻辑 (Human-in-the-loop) ====================
    # 定义受控的敏感工具列表
    # 这些工具在执行前需要检查权限配置 (.agent/config.json 或 全局设置)
    SENSITIVE_TOOLS = SENSITIVE_EXECUTION_TOOL_NAMES
    
    # 只有当调用的工具属于敏感工具列表时才进行拦截检查
    if tool_name in SENSITIVE_TOOLS:
        
        # 获取相关配置
        cli_settings = settings.get("CLISettings", {})
        cwd = cli_settings.get("cc_path")
        # 修复：local 环境应该从 localEnvSettings 读取权限模式
        engine = cli_settings.get("engine", "")
        
        env_settings = _get_cli_engine_settings(settings, engine)
        
        permission_mode = env_settings.get("permissionMode", "default")
        
        is_allowed = False

        # --- 规则 A: 全局 YOLO 模式 (Bypass Permissions) ---
        if permission_mode == "yolo" or permission_mode == "cowork":
            is_allowed = True
            
        # --- 规则 B: 自动批准模式 (Accept Edits) ---
        # 允许文件编辑类工具（包括全量写入、精确替换、任务管理）
        # 但依然拦截终端命令（docker/bash）
        elif permission_mode == "auto-approve":
            if tool_name in ["edit_file_tool", "edit_file_patch_tool", "todo_write_tool", "edit_file_tool_local", "edit_file_patch_tool_local", "todo_write_tool_local"]:
                is_allowed = True
            # docker/bash 等危险命令在此模式下依然默认拦截，除非在项目白名单中
        
        # --- 规则 C: 默认模式 (Default) ---
        # 默认全部拦截
        
        # --- 规则 D: 项目级白名单覆盖 (Project Config Override) ---
        # 如果以上规则未通过，检查 .agent/config.json
        # 如果用户之前点击过 "Allow Always"，这里会返回 True
        if not is_allowed and cwd:
            if is_tool_allowed_by_project_config(cwd, tool_name):
                is_allowed = True
                print(f"[Permission] Tool '{tool_name}' allowed by project config.")

        # --- 最终判定 ---
        if not is_allowed:
            # 返回前端特定的 JSON 结构，触发审批 UI
            print(f"[Permission] Blocked '{tool_name}', requesting approval.")
            return json.dumps({
                "type": "approval_required",
                "tool_name": tool_name,
                "tool_params": tool_params,
                "permission_mode": permission_mode,
                "cwd": cwd
            }, ensure_ascii=False)

    # ==================== 4. 常规工具处理逻辑 (原有代码) ====================

    if "multi_tool_use." in tool_name:
        tool_name = tool_name.replace("multi_tool_use.", "")
        
    if "custom_http_" in tool_name:
        tool_name = tool_name.replace("custom_http_", "")
        print(tool_name)
        settings_custom_http = settings['custom_http']
        for custom in settings_custom_http:
            if custom['name'] == tool_name:
                tool_custom_http = custom
                break
        method = tool_custom_http['method']
        url = tool_custom_http['url']
        headers = tool_custom_http['headers']
        result = await fetch_custom_http(method, url, headers, tool_params)
        return str(result)
        
    if "comfyui_" in tool_name:
        tool_name = tool_name.replace("comfyui_", "")
        text_input = tool_params.get('text_input', None)
        text_input_2 = tool_params.get('text_input_2', None)
        image_input = tool_params.get('image_input', None)
        image_input_2 = tool_params.get('image_input_2', None)
        print(tool_name)
        result = await comfyui_tool_call(tool_name, text_input, image_input,text_input_2,image_input_2)
        return str(result)
        
    if settings["HASettings"]["enabled"]:
        if EXECUTION_ENGINE_PROFILE_ACTIVE:
            from py.mcp_tool_broker_client import (
                call_home_assistant_tool,
                ensure_home_assistant_tool,
                has_private_mcp_tool_broker,
            )

            home_assistant_configuration = _home_assistant_runtime_configuration(settings)
            home_assistant_owns_tool = False
            if has_private_mcp_tool_broker():
                try:
                    home_assistant_owns_tool = await ensure_home_assistant_tool(
                        home_assistant_configuration,
                        tool_name,
                    )
                except Exception as error:
                    logger.warning(
                        "Home Assistant MCP ownership check failed: %s",
                        type(error).__name__,
                    )
            if home_assistant_owns_tool:
                result = await call_home_assistant_tool(
                    home_assistant_configuration,
                    tool_name,
                    tool_params,
                )
                return _serialize_mcp_tool_result(result)
        elif HA_client is not None and tool_name in HA_client._tools:
            result = await HA_client.call_tool(tool_name, tool_params)
            return _serialize_mcp_tool_result(result)
                
    if settings['chromeMCPSettings']['enabled'] and settings['chromeMCPSettings']['type']=='external':
        if EXECUTION_ENGINE_PROFILE_ACTIVE:
            from py.mcp_tool_broker_client import (
                call_external_chrome_tool,
                ensure_external_chrome_tool,
                has_private_mcp_tool_broker,
            )

            chrome_configuration = _external_chrome_runtime_configuration(settings)
            chrome_owns_tool = False
            if has_private_mcp_tool_broker():
                try:
                    chrome_owns_tool = await ensure_external_chrome_tool(
                        chrome_configuration,
                        tool_name,
                    )
                except Exception as error:
                    logger.warning(
                        "External Chrome MCP ownership check failed: %s",
                        type(error).__name__,
                    )
            if chrome_owns_tool:
                result = await call_external_chrome_tool(
                    chrome_configuration,
                    tool_name,
                    tool_params,
                )
                return _serialize_mcp_tool_result(result)
        elif ChromeMCP_client is not None and tool_name in ChromeMCP_client._tools:
            result = await ChromeMCP_client.call_tool(tool_name, tool_params)
            return _serialize_mcp_tool_result(result)
                
    if settings["sqlSettings"]["enabled"]:
        if EXECUTION_ENGINE_PROFILE_ACTIVE:
            from py.mcp_tool_broker_client import (
                call_sql_tool,
                ensure_sql_tool,
                has_private_mcp_tool_broker,
            )

            sql_configuration = _sql_runtime_configuration(settings)
            sql_owns_tool = False
            if has_private_mcp_tool_broker():
                try:
                    sql_owns_tool = await ensure_sql_tool(sql_configuration, tool_name)
                except Exception as error:
                    logger.warning("SQL MCP ownership check failed: %s", type(error).__name__)
            if sql_owns_tool:
                result = await call_sql_tool(sql_configuration, tool_name, tool_params)
                return _serialize_mcp_tool_result(result)
        elif sql_client is not None and tool_name in sql_client._tools:
            result = await sql_client.call_tool(tool_name, tool_params)
            return _serialize_mcp_tool_result(result)
                
    # ==================== 5. 任务中心工具特殊处理 ====================
    if tool_name in ["create_subtask", "query_task_progress", "cancel_subtask", "start_subtask", "finish_task"]:
        cli_settings = settings.get("CLISettings", {})
        cwd = cli_settings.get("cc_path")
        consensus_content = None
        
        if tool_name == "create_subtask":
            # 读取共识文件（如果存在）
            from pathlib import Path
            import aiofiles
            
            consensus_content = None
            consensus_file = Path(cwd) / ".agent" / "consensus.md"
            if consensus_file.exists():
                async with aiofiles.open(consensus_file, 'r', encoding='utf-8') as f:
                    consensus_content = await f.read()
            
            result = await create_subtask(
                title=tool_params.get("title"),
                description=tool_params.get("description"),
                agent_type=tool_params.get("agent_type", "default"),
                workspace_dir=cwd,
                settings=settings,
                consensus_content=consensus_content,
                parent_task_id=tool_params.get("parent_task_id"),
                schedule_type=tool_params.get("schedule_type"),
                schedule_expression=tool_params.get("schedule_expression"),
                next_run_at=tool_params.get("next_run_at"),
                delivery_targets=tool_params.get("delivery_targets"),
                start_immediately=tool_params.get("start_immediately"),
            )
            return result
        
        elif tool_name == "query_task_progress":
            result = await query_task_progress(
                workspace_dir=cwd,
                task_id=tool_params.get("task_id"),         
                parent_task_id=tool_params.get("parent_task_id"),
                status=tool_params.get("status"),
                verbose=tool_params.get("verbose", False)  
            )
            return result
        
        elif tool_name == "cancel_subtask":
            result = await cancel_subtask(
                workspace_dir=cwd,
                task_id=tool_params.get("task_id"),
            )
            return result
        elif tool_name == "start_subtask":
            if consensus_content is None:
                from pathlib import Path
                import aiofiles

                consensus_file = Path(cwd) / ".agent" / "consensus.md"
                if consensus_file.exists():
                    async with aiofiles.open(consensus_file, 'r', encoding='utf-8') as f:
                        consensus_content = await f.read()
            result = await start_subtask(
                workspace_dir=cwd,
                task_id=tool_params.get("task_id"),
                settings=settings,
                consensus_content=consensus_content,
            )
            return result
        elif tool_name == "finish_task":
            result = await finish_task(
                workspace_dir=cwd,
                task_id=tool_params.get("task_id"),
                result=tool_params.get("result"),
            )
            return result

    if tool_name not in _TOOL_HOOKS:
        if EXECUTION_ENGINE_PROFILE_ACTIVE:
            from py.mcp_tool_broker_client import (
                call_generic_mcp_tool,
                ensure_generic_mcp_tool,
                has_private_mcp_tool_broker,
            )

            if has_private_mcp_tool_broker():
                for server_name, server_configuration in _iter_enabled_generic_mcp_servers(settings):
                    if not _is_generic_mcp_tool_enabled(settings, server_name, tool_name):
                        continue
                    try:
                        owns_tool = await ensure_generic_mcp_tool(
                            server_name,
                            server_configuration,
                            tool_name,
                        )
                    except Exception as error:
                        logger.warning(
                            "Generic MCP ownership check failed for '%s': %s",
                            server_name,
                            type(error).__name__,
                        )
                        continue
                    if owns_tool:
                        result = await call_generic_mcp_tool(
                            server_name,
                            server_configuration,
                            tool_name,
                            tool_params,
                        )
                        return _serialize_mcp_tool_result(result)
        else:
            for server_name, mcp_client in mcp_client_list.items():
                if (
                    mcp_client is not None
                    and mcp_client._conn is not None
                    and tool_name in mcp_client._conn.tools
                    and _is_generic_mcp_tool_enabled(settings, server_name, tool_name)
                ):
                    result = await mcp_client.call_tool(tool_name, tool_params)
                    return _serialize_mcp_tool_result(result)
        return None
        
    tool_call = _TOOL_HOOKS[tool_name]
    try:
        ret_out = await tool_call(**tool_params)
        if tool_name == "auto_behavior":
            settings = ret_out
            await broadcast_settings_update(settings)
            ret_out = "任务设置成功！"
        return ret_out
    except Exception as e:
        logger.error(f"Error calling tool {tool_name}: {e}")
        return f"Error calling tool {tool_name}: {e}"


async def _retry_kernel_trace(trace: Dict[str, Any], payload: Dict[str, Any], settings: Dict[str, Any]) -> Dict[str, Any]:
    """Retry a kernel trace with explicit user-supplied parameters."""
    tool_name = str(payload.get("tool_name") or trace.get("tool_name") or "")
    tool_params = payload.get("tool_params") or {}
    approval_id = str(payload.get("approval_id") or trace.get("approval_id") or "")
    reason = str(payload.get("reason") or "manual_retry")
    parent_trace_id = str(trace.get("trace_id") or payload.get("trace_id") or "")
    parent_metadata = trace.get("metadata", {}) if isinstance(trace.get("metadata"), dict) else {}
    if tool_name != trace.get("tool_name"):
        return {
            "ok": False,
            "reason": "tool_name_mismatch",
            "expected": trace.get("tool_name", ""),
            "actual": tool_name,
        }
    from py.kernel.executor import get_kernel_executor

    result = await get_kernel_executor().execute_tool(
        tool_name=tool_name,
        tool_params=tool_params,
        settings=settings or {},
        legacy_call=lambda: _dispatch_tool_legacy(tool_name, tool_params, settings or {}),
        actor="user",
        approval_id=approval_id,
        metadata={
            "manual_retry": True,
            "retry_of_trace_id": parent_trace_id,
            "parent_trace_id": parent_trace_id,
            "retry_reason": reason,
            "approval_trace_role": "execution" if approval_id else "",
            **{
                key: value
                for key, value in parent_metadata.items()
                if str(key).startswith("kernel_plan_") or key in {"conversation_id", "turn_id"}
            },
        },
        return_trace=True,
    )
    return {
        "ok": bool(result.get("ok")) if isinstance(result, dict) else True,
        "retryOfTraceId": parent_trace_id,
        "result": result.get("result") if isinstance(result, dict) else result,
        "trace": result.get("trace") if isinstance(result, dict) else None,
        "status": result.get("status") if isinstance(result, dict) else "completed",
        "error": result.get("error", "") if isinstance(result, dict) else "",
    }


async def _execute_kernel_plan_step(plan_record: Dict[str, Any], payload: Dict[str, Any], settings: Dict[str, Any]) -> Dict[str, Any]:
    """Execute one KernelPlan tool step through the legacy dispatcher with kernel tracing."""
    plan = plan_record.get("plan", {}) if isinstance(plan_record, dict) else {}
    step_id = str(payload.get("step_id") or "")
    tool_params = payload.get("tool_params") or {}
    approval_id = str(payload.get("approval_id") or "")
    reason = str(payload.get("reason") or "plan_step_execution")
    run_id = str(payload.get("run_id") or "")
    run_iteration = payload.get("iteration") or 0
    from py.kernel.executor import get_kernel_executor

    executor = get_kernel_executor()
    contract = executor.plan_step_contract(plan=plan, step_id=step_id)
    if not contract.get("ok"):
        return contract
    missing_keys = [
        key for key in contract.get("requiredParamKeys", [])
        if key not in tool_params
    ]
    if missing_keys:
        return {
            "ok": False,
            "reason": "missing_required_params",
            "missing": missing_keys,
            "contract": contract,
        }

    tool_name = str(contract.get("tool_name") or "")
    result = await executor.execute_plan_step(
        plan=plan,
        step_id=step_id,
        tool_params=tool_params,
        settings=settings or {},
        legacy_call=lambda: _dispatch_tool_legacy(tool_name, tool_params, settings or {}),
        actor="user",
        approval_id=approval_id,
        metadata={
            "api_plan_step_execute": True,
            "plan_step_execute_reason": reason,
            "kernel_plan_run_id": run_id,
            "kernel_plan_run_iteration": run_iteration,
            "approval_trace_role": "execution" if approval_id else "",
        },
        return_trace=True,
    )
    trace = result.get("trace") if isinstance(result, dict) else None
    status = result.get("status") if isinstance(result, dict) else "completed"
    plan_step_update = None
    try:
        from py.kernel.store import get_kernel_store
        workspace = (settings or {}).get("CLISettings", {}).get("cc_path", "") if isinstance(settings, dict) else ""
        plan_step_update = get_kernel_store(workspace).update_plan_step_status(
            plan_id=plan.get("plan_id", "") if isinstance(plan, dict) else "",
            step_id=step_id,
            status=status or "completed",
            trace=trace if isinstance(trace, dict) else {},
            error=result.get("error", "") if isinstance(result, dict) else "",
            recovery_hint=(trace or {}).get("recovery_hint", "") if isinstance(trace, dict) else "",
        )
    except Exception as plan_step_update_err:
        logger.debug(f"[KernelPlan] Step status update skipped: {plan_step_update_err}")
    return {
        "ok": bool(result.get("ok")) if isinstance(result, dict) else True,
        "plan_id": plan.get("plan_id", "") if isinstance(plan, dict) else "",
        "step_id": step_id,
        "tool_name": tool_name,
        "result": result.get("result") if isinstance(result, dict) else result,
        "trace": trace,
        "status": status,
        "error": result.get("error", "") if isinstance(result, dict) else "",
        "planStepUpdate": plan_step_update,
    }


class ChatRequest(BaseModel):
    messages: List[Dict]
    model: str = None
    tools: Optional[Union[List[Dict[str, Any]], Dict[str, Any]]] = None
    stream: bool = False
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    top_p: float = 1
    fileLinks: List[str] = None
    enable_thinking: bool = False
    enable_deep_research: bool = False
    enable_web_search: bool = False
    asyncToolsID: List[str] = None
    reasoning_effort: str = None
    is_app_bot: bool = False
    is_sub_agent: bool = False
    enable_tools : List[str] = None
    disable_tools: List[str] = None
    conversationId: Optional[str] = None
    conversation_id: Optional[str] = None


def _normalize_request_tools(
    raw_tools: Optional[Union[List[Dict[str, Any]], Dict[str, Any]]]
) -> List[Dict[str, Any]]:
    if raw_tools is None:
        return []
    if isinstance(raw_tools, list):
        return [tool for tool in raw_tools if isinstance(tool, dict)]
    if isinstance(raw_tools, dict):
        nested_tools = raw_tools.get("tools")
        if isinstance(nested_tools, list):
            return [tool for tool in nested_tools if isinstance(tool, dict)]
        if raw_tools.get("function") or raw_tools.get("type"):
            return [raw_tools]
    return []

async def message_without_images(messages: List[Dict]) -> List[Dict]:
    if messages:
        for message in messages:
            if 'content' in message:
                if isinstance(message['content'], list):
                    for item in message['content']:
                        # 剥离包含图像和视频的内容，只保留文本传递（用于快速生成请求或剥离富媒体阶段）
                        if isinstance(item, dict) and item.get('type') == 'text':
                            message['content'] = item['text']
                            break
    return messages

async def images_in_messages(messages: List[Dict], fastapi_base_url: str) -> List[Dict]:
    media_items = []
    index = 0
    for message in messages:
        extracted_media =[]
        if 'content' in message:
            if isinstance(message['content'], list):
                for item in message['content']:
                    # 动态捕获图片或视频
                    if isinstance(item, dict) and item.get('type') in ['image_url', 'video_url']:
                        media_key = item['type']  # 'image_url' 或 'video_url'
                        
                        if item[media_key]["url"].startswith("http"):
                            media_url = item[media_key]["url"]
                            if fastapi_base_url in media_url:
                                media_url = media_url.replace(fastapi_base_url, f"http://127.0.0.1:{PORT}/")
                            
                            # 假设你的 get_image_base64 同样可以将视频流转为 Base64
                            base64_data = await get_image_base64(media_url)
                            # 假设 get_image_media_type 也能正常返回 video/mp4, video/webm 等
                            mime_type = await get_image_media_type(media_url)
                            
                            item[media_key]["url"] = f"data:{mime_type};base64,{base64_data}"
                            item[media_key]["hash"] = hashlib.md5(item[media_key]["url"].encode()).hexdigest()
                        else:
                            item[media_key]["hash"] = hashlib.md5(item[media_key]["url"].encode()).hexdigest()

                        extracted_media.append(item)
        if extracted_media:
            # 保持原来的字典结构向下兼容，images 实际上装载了 media
            media_items.append({'index': index, 'images': extracted_media})
        index += 1
    return media_items

async def images_add_in_messages(request_messages: List[Dict], images: List[Dict], settings: dict) -> List[Dict]:
    messages = copy.deepcopy(request_messages)
    
    if settings['vision']['enabled']:
        for image in images:
            index = image['index']
            if index < len(messages):
                if 'content' in messages[index]:
                    for item in image['images']:
                        media_key = item['type']  # 'image_url' 或 'video_url'
                        file_hash = item[media_key]['hash']
                        media_name = "视频" if media_key == "video_url" else "图片"
                        
                        # 统一缓存处理，如果是视频就是视频文本解析记录
                        cache_file = os.path.join(UPLOAD_FILES_DIR, f"{file_hash}.txt")
                        if os.path.exists(cache_file):
                            with open(cache_file, "r", encoding='utf-8') as f:
                                messages[index]['content'] += f"\n\nsystem: 用户发送的{media_name}(哈希值：{file_hash})信息如下：\n\n{f.read()}\n\n"
                        else:
                            # 根据输入类型调整提示词
                            prompt_text = "请仔细描述这段视频中的内容，包含视频中发生的事件、场景变化、人物动作以及关键细节等信息。" if media_key == "video_url" else "请仔细描述图片中的内容，包含图片中可能存在的文字、数字、颜色、形状、大小、位置、人物、物体、场景等信息。"
                            
                            media_content =[
                                {"type": "text", "text": prompt_text},
                                {"type": media_key, media_key: {"url": item[media_key]['url']}}
                            ]
                            
                            # 直接交给视觉模型（视觉模型需原生支持视频）
                            client = AsyncOpenAI(api_key=settings['vision']['api_key'], base_url=settings['vision']['base_url'])
                            response = await client.chat.completions.create(
                                model=settings['vision']['model'],
                                messages=[{"role": "user", "content": media_content}],
                                temperature=settings['vision']['temperature'],
                            )
                            result_text = str(response.choices[0].message.content)
                            messages[index]['content'] += f"\n\nsystem: 用户发送的{media_name}(哈希值：{file_hash})信息如下：\n\n{result_text}\n\n"
                            
                            with open(cache_file, "w", encoding='utf-8') as f:
                                f.write(result_text)
    else:           
        for image in images:
            index = image['index']
            if index < len(messages):
                if 'content' in messages[index]:
                    for item in image['images']:
                        media_key = item['type']  # 'image_url' 或 'video_url'
                        file_hash = item[media_key]['hash']
                        media_name = "视频" if media_key == "video_url" else "图片"
                        
                        cache_file = os.path.join(UPLOAD_FILES_DIR, f"{file_hash}.txt")
                        if os.path.exists(cache_file):
                            with open(cache_file, "r", encoding='utf-8') as f:
                                messages[index]['content'] += f"\n\nsystem: 用户发送的{media_name}(哈希值：{file_hash})信息如下：\n\n{f.read()}\n\n"
                        else:
                            if isinstance(messages[index]['content'], str):
                                messages[index]['content'] =[{"type": "text", "text": messages[index]['content']}]
                            
                            # 未开启视觉模型，直接以原生的 `video_url` 或 `image_url` 拼入请求，让当前大模型自行读取理解
                            messages[index]['content'].append({"type": media_key, media_key: {"url": item[media_key]['url']}})
                            
    return messages

async def read_todos_local(cwd: str) -> list:
    """读取本地待办事项（跨平台）"""
    todo_file = Path(cwd) / ".agent" / "ai_todos.json"
    if not todo_file.exists():
        return []
    
    try:
        async with aiofiles.open(todo_file, 'r', encoding='utf-8') as f:
            content = await f.read()
            return json.loads(content) if content else []
    except (json.JSONDecodeError, FileNotFoundError):
        return []
    except Exception as e:
        print(f"Error reading todos: {e}")
        return []

async def read_agents_md(cwd: str) -> str:  # 返回str而不是list
    """读取本地AGENTS.md文件内容"""
    agents_md_path = Path(cwd) / ".agent" / "AGENTS.md"
    
    if not agents_md_path.exists():
        return ""
    
    try:
        async with aiofiles.open(agents_md_path, 'r', encoding='utf-8') as f:
            content = await f.read()
            return content
    except FileNotFoundError:
        # 文件在检查后又被删除的情况
        return ""
    except Exception as e:
        print(f"Error reading AGENTS.md: {e}")
        return ""

def get_system_context() -> str:
    """
    获取当前系统环境的详细描述，帮助 AI 适配正确的命令和路径格式
    """
    system = platform.system()
    release = platform.release()
    
    # 检测 shell
    if system == "Windows":
        # 检测是 PowerShell 还是 CMD
        shell = "PowerShell" if "PSMODULEPATH" in os.environ else "CMD"
        path_hint = "使用 Windows 路径格式（C:\\Users\\name\\file），命令使用 dir、copy、del 等"
        command_hint = f"当前使用 {shell}，命令语法为 Windows 风格。避免使用 Unix 命令（ls/cat/rm），改用 dir/type/del"
    elif system == "Darwin":
        shell = os.path.basename(os.environ.get('SHELL', '/bin/zsh'))
        path_hint = "使用 Unix 路径格式（/Users/name/file），区分大小写"
        command_hint = f"当前为 macOS ({release})，使用 {shell}。支持标准 Unix 命令（ls/cat/rm），但注意部分命令是 BSD 版本而非 GNU 版本"
    else:  # Linux
        shell = os.path.basename(os.environ.get('SHELL', '/bin/bash'))
        path_hint = "使用 Unix 路径格式（/home/name/file），区分大小写"
        command_hint = f"当前为 Linux ({release})，使用 {shell}。支持标准 GNU 命令和工具链"
    
    return f"""【环境信息】操作系统：{system} {release} | Shell：{shell}

⚠️ 重要提示：
1. {path_hint}
2. {command_hint}
3. 执行 shell_tool_local 时，命令必须符合当前系统的语法规范
4. 路径分隔符：Windows 使用反斜杠(\\)，Unix 使用正斜杠(/)
5. 如果需要使用网络端口，请尽可能选择不常用的端口，避免冲突，例如：10000 以上的端口
6. 请尽量使用相对路径，避免使用绝对路径，以免在跨平台时出现问题
"""


def _kernel_context_compression_enabled(current_settings: Dict[str, Any]) -> bool:
    kernel_settings = (current_settings or {}).get("kernelSettings", {})
    compression_settings = kernel_settings.get("contextCompression", {}) if isinstance(kernel_settings, dict) else {}
    return bool(compression_settings.get("enabled", True))


def _kernel_system_manifest_enabled(current_settings: Dict[str, Any]) -> bool:
    kernel_settings = (current_settings or {}).get("kernelSettings", {})
    if isinstance(kernel_settings, dict) and kernel_settings.get("enabled", True) is False:
        return False
    manifest_settings = kernel_settings.get("systemManifest", {}) if isinstance(kernel_settings, dict) else {}
    if not isinstance(manifest_settings, dict):
        manifest_settings = {}
    return bool(manifest_settings.get("enabled", True) and manifest_settings.get("injectIntoContext", True))


def _inject_kernel_system_manifest(
    messages: List[Dict[str, Any]],
    current_settings: Dict[str, Any],
    tools: Optional[List[Dict[str, Any]]] = None,
    *,
    source: str = "chat",
) -> None:
    if not _kernel_system_manifest_enabled(current_settings):
        return
    try:
        diagnostics = {}
        active_kernel = globals().get("kernel")
        if active_kernel and hasattr(active_kernel, "get_diagnostics"):
            diagnostics = active_kernel.get_diagnostics()
        manifest = build_system_manifest(
            current_settings or {},
            kernel_diagnostics=diagnostics,
            tools=tools or [],
        )
        manifest_context = (
            "\n\n[OpenXnet System Manifest]\n"
            "This sanitized runtime manifest describes OpenXnet capabilities visible to the model. "
            "Use it for awareness only. Do not claim direct configuration writes; configuration changes "
            "must go through config intent, confirmation, audit, and apply.\n"
            f"Source: {source}\n"
            f"{json.dumps(manifest, ensure_ascii=False)}\n\n"
        )
        content_append(messages, "system", manifest_context)
    except Exception as manifest_err:
        logger.debug(f"[Kernel] System manifest injection skipped: {manifest_err}")


def _request_conversation_id(request: Any) -> str:
    return (
        getattr(request, "conversation_id", None)
        or getattr(request, "conversationId", None)
        or ""
    )


def _consume_kernel_live_guidance(request: Any, stage: str, tool_name: str = "") -> List[Any]:
    try:
        from py.kernel.guidance import format_guidance_context, get_guidance_bus

        items = get_guidance_bus().consume(
            conversation_id=_request_conversation_id(request),
            trace_id=tool_name or "",
        )
        if items:
            context = format_guidance_context(items)
            if context:
                content_append(request.messages, "system", context)
            logger.info(f"[Kernel] Consumed {len(items)} live guidance item(s) at {stage}")
        return items
    except Exception as guidance_err:
        logger.debug(f"[Kernel] Live guidance consume skipped: {guidance_err}")
        return []


def _kernel_planner_settings(current_settings: Dict[str, Any]) -> Dict[str, Any]:
    kernel_settings = (current_settings or {}).get("kernelSettings", {})
    planner_settings = kernel_settings.get("planner", {}) if isinstance(kernel_settings, dict) else {}
    return planner_settings if isinstance(planner_settings, dict) else {}


def _candidate_tool_names_for_kernel_plan(
    tools: Optional[List[Dict[str, Any]]],
    current_settings: Dict[str, Any],
) -> List[str]:
    planner_settings = _kernel_planner_settings(current_settings)
    try:
        limit = int(planner_settings.get("maxCandidateTools", 12) or 12)
    except Exception:
        limit = 12
    limit = max(1, min(limit, 50))
    names: List[str] = []
    seen = set()
    for tool in tools or []:
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


def _run_kernel_shadow_plan(
    request: Any,
    current_settings: Dict[str, Any],
    *,
    model: str = "",
    tools: Optional[List[Dict[str, Any]]] = None,
    source: str = "legacy_chat",
) -> Dict[str, Any]:
    active_kernel = globals().get("kernel")
    if not active_kernel or not hasattr(active_kernel, "plan_turn"):
        return {"ok": False, "reason": "kernel_runtime_not_available"}
    try:
        user_prompt = ""
        for msg in reversed(getattr(request, "messages", []) or []):
            if msg.get("role") != "user":
                continue
            content = msg.get("content", "")
            if isinstance(content, str):
                user_prompt = content
            elif isinstance(content, list):
                user_prompt = " ".join(
                    item.get("text", "")
                    for item in content
                    if isinstance(item, dict) and item.get("type") == "text"
                )
            break
        planner_settings = _kernel_planner_settings(current_settings)
        result = active_kernel.plan_turn(
            current_settings or {},
            goal=user_prompt,
            messages=getattr(request, "messages", []) or [],
            model=model or (current_settings or {}).get("model", ""),
            candidate_tools=_candidate_tool_names_for_kernel_plan(tools, current_settings or {}),
            include_world=planner_settings.get("includeWorldByDefault", True),
            source=source,
            conversation_id=_request_conversation_id(request),
            actor="system",
        )
        summary = result.get("summary") if isinstance(result, dict) else {}
        if isinstance(result, dict) and result.get("ok") and isinstance(summary, dict):
            try:
                from py.kernel.runtime import build_plan_trace_context
                if isinstance(current_settings, dict):
                    current_settings["__kernel_plan_context"] = build_plan_trace_context(summary, result.get("plan"))
            except Exception:
                pass
            logger.info(
                "[KernelPlan] %s plan %s status=%s risk=%s",
                source,
                summary.get("plan_id", ""),
                summary.get("status", ""),
                summary.get("highestRisk", ""),
            )
            if planner_settings.get("injectIntoContext") is True:
                runtime_mode = "shadow"
                runtime_profile = {}
                try:
                    from py.kernel.runtime import kernel_mode_profile, mode_from_settings
                    runtime_mode = mode_from_settings(current_settings or {})
                    runtime_profile = kernel_mode_profile(runtime_mode)
                except Exception:
                    runtime_profile = {}
                content_append(
                    request.messages,
                    "system",
                    (
                        "\n\n[OpenXnet KernelPlan Preflight]\n"
                        f"runtime_mode={runtime_mode}; execution_authority={runtime_profile.get('executionAuthority', 'legacy_observed')}.\n"
                        "This preflight summary is model-safe; tool execution still follows PolicyGate and approval rules.\n"
                        f"{json.dumps(summary, ensure_ascii=False)}\n"
                    ),
                )
        return result
    except Exception as plan_err:
        logger.debug(f"[KernelPlan] {source} pre-flight skipped: {plan_err}")
        return {"ok": False, "reason": "planner_error", "error": str(plan_err)}


async def get_project_skills_summary(cwd: str, visibility_scope: str = "workspace") -> str:
    """
    根据可见范围返回项目技能摘要
    
    Args:
        cwd: 当前工作目录
        visibility_scope: 可见范围，可选值: "global", "workspace", "none"
    
    Returns:
        技能摘要字符串
    """
    # 如果可见范围设置为 "none"，直接返回空字符串
    if visibility_scope == "none":
        return ""
    
    # 根据可见范围选择不同的技能目录
    if visibility_scope == "workspace":
        # 工作区技能：从项目目录的 .agent/skills 查找
        skills_root = Path(cwd) / ".agent" / "skills"
        scope_name = "工作区"
    elif visibility_scope == "global":
        # 全局技能：从常量 SKILLS_DIR 查找
        skills_root = Path(SKILLS_DIR)
        scope_name = "全局"
    else:
        # 未知范围，返回空
        return ""
    
    # 检查技能目录是否存在
    if not skills_root.exists() or not skills_root.is_dir():
        return ""

    found_skills_blocks = []
    for skill_dir in sorted(skills_root.iterdir()):
        if skill_dir.is_dir():
            skill_id = skill_dir.name
            doc_file_path = None
            for name in ["SKILL.md", "skill.md", "SKILLS.md", "skills.md"]:
                if (skill_dir / name).exists():
                    doc_file_path = skill_dir / name
                    break
            
            yaml_meta = ""
            if doc_file_path:
                try:
                    content = doc_file_path.read_text(encoding='utf-8')
                    if content.startswith("---"):
                        parts = content.split("---", 2)
                        if len(parts) >= 3: 
                            yaml_meta = parts[1].strip()
                except Exception:
                    pass

            skill_info = f"- **{skill_id}**"
            if yaml_meta:
                skill_info += f":\n```yaml\n{yaml_meta}\n```"
            else:
                skill_info += " (可用)"
            found_skills_blocks.append(skill_info)

    if not found_skills_blocks:
        return ""

    # 根据可见范围返回不同的摘要信息
    summary = f"\n\n🛠️ **{scope_name}技能 ({scope_name} Skills)**：\n"
    
    if visibility_scope == "workspace":
        summary += "检测到本项目特有的 Agent 技能定义。这些技能仅在本工作区内可见：\n\n"
    elif visibility_scope == "global":
        summary += "检测到全局 Agent 技能定义。这些技能在所有项目中都可用：\n\n"
    
    summary += "\n".join(found_skills_blocks)
    summary += "\n\n*提示：你可以通过读取skill的工具获取该技能文件夹的文件树和完整说明文档。*"
    
    return summary

async def tools_change_messages(request: ChatRequest, settings: dict):
    global HA_client, ChromeMCP_client, sql_client

    request.messages = sanitize_protocol_messages(request.messages)
    
    if request.messages and request.messages[0]['role'] == 'system' and request.messages[0]['content'] != '':
        basic_message = " "
        request.messages[0]['content'] += basic_message

    cli_settings = settings.get("CLISettings", {})
    cwd = cli_settings.get("cc_path")
    visibilityScope = cli_settings.get("visibilityScope", "workspace")
    # 修复：local 环境应该从 localEnvSettings 读取权限模式
    engine = cli_settings.get("engine", "")
    
    env_settings = _get_cli_engine_settings(settings, engine)
    
    permissionMode = env_settings.get("permissionMode", "default")
    
    if cwd and Path(cwd).exists() and cli_settings.get("enabled", False):
        
        # ==================== [新增] 1. 总是注入 MEMORY.md ====================
        memory_file = Path(cwd) / ".agent" / "MEMORY.md"
        if memory_file.exists() and memory_file.is_file():
            try:
                import aiofiles
                async with aiofiles.open(memory_file, 'r', encoding='utf-8') as mf:
                    mem_content = await mf.read()
                if mem_content.strip():
                    content_append(request.messages, 'system', f"\n\n**MEMORY.md**:\n{mem_content}\n\n")
            except Exception as e:
                print(f"读取 MEMORY.md 失败: {e}")

        # ==================== [新增] 2. 处理 Shortcut 快捷指令 ====================
        if cli_settings.get("shortcut", False):
            # 获取最新一条用户消息
            user_text = ""
            if request.messages and request.messages[-1]['role'] == 'user':
                user_msg_content = request.messages[-1].get('content', '')
                if isinstance(user_msg_content, str):
                    user_text = user_msg_content
                elif isinstance(user_msg_content, list):
                    # 兼容图文混合消息
                    user_text = "".join([item.get('text', '') for item in user_msg_content if item.get('type') == 'text'])

            user_text_trimmed = user_text.strip()
            
            if user_text_trimmed:
                import datetime
                import re
                
                # --- (1) 处理 '#' : 直接保存为记忆 ---
                if user_text_trimmed.startswith('#'):
                    mem_content_to_save = user_text_trimmed[1:].strip()
                    if mem_content_to_save:
                        try:
                            agent_dir = Path(cwd) / ".agent"
                            agent_dir.mkdir(parents=True, exist_ok=True)
                            
                            timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                            append_text = f"\n- [{timestamp}] {mem_content_to_save}"
                            
                            import aiofiles
                            async with aiofiles.open(memory_file, 'a', encoding='utf-8') as mf:
                                await mf.write(append_text)
                                
                            content_append(request.messages, 'system', f"\n\nHint: The user has just saved the following content to the workspace memory using the '#' shortcut command:\n'{mem_content_to_save}'\nPlease briefly confirm in your next reply that you remember this information.\n\n")
                        except Exception as e:
                            print(f"保存 MEMORY.md 失败: {e}")

                # --- (2) 处理 '/' : 注入特定技能 ---
                elif user_text_trimmed.startswith('/'):
                    parts = user_text_trimmed[1:].split()
                    if parts:
                        skill_name = parts[0]
                        skill_dir = Path(cwd) / ".agent" / "skills" / skill_name
                        if skill_dir.exists() and skill_dir.is_dir():
                            doc_file_path = None
                            # 尝试匹配常见的技能说明文档命名
                            for name in ["SKILL.md", "skill.md", "SKILLS.md", "skills.md"]:
                                if (skill_dir / name).exists():
                                    doc_file_path = skill_dir / name
                                    break
                            
                            if doc_file_path:
                                try:
                                    import aiofiles
                                    async with aiofiles.open(doc_file_path, 'r', encoding='utf-8') as f:
                                        skill_content = await f.read()
                                    content_append(request.messages, 'system', f"\n\n🛠️ **The user actively triggered the workspace skill. [{skill_name}]**:\n\n{skill_content}\n\nPlease strictly follow the above skill instructions to handle the user's current request.\n\n")
                                except Exception as e:
                                    print(f"读取技能文档失败: {e}")

                # --- (3) 处理 '@' : 提取并注入文件内容 ---
                # 使用 (?:^|\s) 防止把邮箱前缀误认为是文件路径，例如 "user@mail.com" 不会触发
                file_matches = re.findall(r'(?:^|\s)@([\w\.\-\/\\]+)', user_text)
                if file_matches:
                    files_content_injected = []
                    for file_path in set(file_matches):  # 使用 set 去重
                        try:
                            # 直接复用你原有的 read_file_tool_local 函数读取工作区文件
                            file_res = await read_file_tool_local(file_path)
                            files_content_injected.append(f"文件 `{file_path}` 的内容：\n```\n{file_res}\n```")
                        except Exception as e:
                            files_content_injected.append(f"读取文件 `{file_path}` 失败: {str(e)}")
                    
                    if files_content_injected:
                        combined_files = "\n\n".join(files_content_injected)
                        content_append(request.messages, 'system', f"\n\n📂 **The user has mentioned the following files using the '@' quick syntax, which have been automatically read for you.**:\n\n{combined_files}\n\nPlease refer to the content of the above document to answer the user's question.\n\n")

    if cwd and Path(cwd).exists() and cli_settings.get("enabled", False):
        permission_message = ""
        # 权限模式提示（原有逻辑，但修复了变量名）
        if permissionMode != "plan" and permissionMode != "cowork":
            permission_message = "你当前处于执行模式，你可以自由地使用所有工具，但请注意不要滥用权限！如果有更安全的工具，请不要直接使用bash命令！"
            content_append(request.messages, 'system', permission_message)
        elif permissionMode == "cowork":
            if not request.is_sub_agent:
                permission_message += "你当前处于协作模式，create_subtask工具可以帮你完成几乎任何任务（比如查资料、写代码、生成报告等），当你遇到难题时，可以尝试把它分解成一个个小任务，交给create_subtask工具去完成！当用户再次询问进度时，你可以用query_task_progress工具查询任务进度和获取详细结果\n\n"
                content_append(request.messages, 'system', permission_message)
            else:
                permission_message = "你当前处于执行模式，你可以自由地使用所有工具，但请注意不要滥用权限！如果有更安全的工具，请不要直接使用bash命令！"
                content_append(request.messages, 'system', permission_message)
        else:
            permission_message = "你当前处于计划模式，请尽可能只使用只读工具了解当前项目，使用自然语言描述你的需求和计划，并等待用户确认后再执行！"
            content_append(request.messages, 'system', permission_message)

    if permissionMode == "cowork" and not request.is_sub_agent:
        pass
    elif cwd and Path(cwd).exists() and cli_settings.get("enabled", False) and engine in ["ds", "local"]:
        
        if engine == "local":
            # 在本地环境下，首先注入系统环境信息
            system_context = get_system_context()
            content_append(request.messages, 'system', system_context)
        elif engine == "ds":
            # 在 Docker 环境下，注入系统环境信息
            system_context = """【环境信息】操作系统：Linux | Shell：bash

⚠️ 重要提示：
1. 当前为 Docker 环境，请使用 Linux 命令和工具链
2. 执行 docker_sandbox 时，命令必须符合 Linux 的语法规范
3. 路径分隔符：Unix 使用正斜杠(/)
4. 请尽量使用相对路径，避免使用绝对路径，以免在跨平台时出现问题

### ✅ **已安装的主要开发工具**

#### **编程语言和运行时**
1. **Python**
   - Python
   - pip
   - uv

2. **Node.js**
   - Node.js
   - npm
   - npx

3. **Go**
   - Go

4. **Perl**
   - Perl

#### **版本控制和协作工具**
1. **Git**
   - git
   - GitHub CLI (gh)

#### **包管理和构建工具**
1. **Python 包管理**
   - pip / pip3
   - uv

2. **Node.js 包管理**
   - npm / npx

3. **系统包管理**
   - apt-get / dpkg

#### **文本处理和命令行工具**
1. **文本处理**
   - jq
   - awk / sed / grep
   - cat / less / more / head / tail

2. **文件操作**
   - tar / unzip
   - rsync
   - 所有基本 Unix 命令（ls, cp, mv, rm, mkdir, chmod 等）

3. **系统工具**
   - bash shell
   - make
   - which / whereis

#### **网络工具**
1. **HTTP 客户端**
   - curl

2. **安全工具**
   - openssl
   - gpg

#### **系统监控**
1. **进程和资源监控**
   - top / ps
   - free / df / du
   
"""
            content_append(request.messages, 'system', system_context)

        todos = []
        
        try:
            todos = await read_todos_local(cwd)
            
            # 处理待办事项（原有逻辑）
            if isinstance(todos, list) and len(todos) > 0:
                priority_icons = {"high": "🔴", "medium": "🟡", "low": "🟢"}
                status_icons = {
                    "pending": "⏳", 
                    "in_progress": "🔄", 
                    "done": "✅", 
                    "cancelled": "❌"
                }
                
                priority_order = {"high": 0, "medium": 1, "low": 2}
                todos_sorted = sorted(
                    todos, 
                    key=lambda x: (
                        priority_order.get(x.get('priority', 'medium'), 1),
                        x.get('created_at', '')
                    )
                )
                
                todo_lines = ["\n\n当你完成一个事项后，请记得使用todo_write_tool更新项目待办事项，所有事项结束后，可以删除本事项文件\n\n📋 **当前项目待办事项**（.agent/ai_todos.json）：\n"]
                pending_count = 0
                
                for todo in todos_sorted:
                    status = todo.get('status', 'pending')
                    if status != 'done':
                        pending_count += 1
                        icon = status_icons.get(status, "⏳")
                        priority = priority_icons.get(todo.get('priority', 'medium'), "🟡")
                        content_text = todo.get('content', '无内容')[:50]
                        if len(todo.get('content', '')) > 50:
                            content_text += "..."
                        
                        todo_lines.append(f"{icon} {priority} [{todo.get('id', 'unknown')}] {content_text}")
                
                if pending_count == 0:
                    todo_lines.append("✨ 当前没有待办事项，所有任务已完成！")
                else:
                    todo_lines.append(f"\n*共有 {pending_count} 个未完成任务*")
                
                todo_message = "\n".join(todo_lines)
                content_append(request.messages, 'system', todo_message)
                
        except Exception as e:
            print(f"[Todo Loader] 跳过待办事项加载: {e}")
            pass

        try:
            agents_md = await read_agents_md(cwd)
            if agents_md:
                content_append(request.messages, 'system', " **重要事项**（.agent/AGENTS.md）：\n\n"+agents_md+"\n\n")
        except Exception as e:
            print(f"[Agent Loader] 跳过AGENTS.md加载: {e}")
            pass

        try:
            # 无论是在 docker 还是 local，逻辑路径通常是一致的（通过挂载）
            # 如果是 Docker 环境且 backend 无法直接访问 cwd，则需通过 docker exec ls 扫描，
            # 但通常项目路径是共享的。
            skills_message = await get_project_skills_summary(cwd, visibilityScope)
            if skills_message:
                content_append(request.messages, 'system', skills_message)
        except Exception as e:
            print(f"[Skill Loader] 扫描技能失败: {e}")

    if request.messages[-1]['role'] == 'system' and settings['tools']['autoBehavior']['enabled'] and not request.is_app_bot and not request.is_sub_agent:
        language_message = f"\n\n当你看到被插入到对话之间的系统消息，这是自主行为系统向你发送的消息，例如用户主动或者要求你设置了一些定时任务或者延时任务，当你看到自主行为系统向你发送的消息时，说明这些任务到了需要被执行的节点，例如：用户要你三点或五分钟后提醒开会的事情，然后当你看到一个被插入的“提醒用户开会”的系统消息，你需要立刻提醒用户开会，以此类推\n\n"
        content_append(request.messages, 'system', language_message)

    # 先统一获取当前选中的 memory 对象（后面多处会用到）
    cur_memory = None
    if settings["memorySettings"]["is_memory"] and settings["memorySettings"]["selectedMemory"]:
        memoryId = settings["memorySettings"]["selectedMemory"]
        for memory in settings["memories"]:
            if memory["id"] == memoryId:
                cur_memory = _normalize_character_card_memory(memory)
                break
    
    # 获取角色名称（用于显示），如果找不到就用 id 兜底
    selectedMemoryName = (cur_memory.get("name") if cur_memory else "") or settings["memorySettings"]["selectedMemory"]

    # 辅助函数：从 memory/{id}/model 格式解析 id，并查找 name
    def resolve_agent_name(raw_model):
        if raw_model.startswith("memory/"):
            # 分解 memory/{id}/rest 格式
            parts = raw_model.split('/', 2)  # ['memory', 'id', 'rest']
            if len(parts) >= 2:
                memory_id = parts[1]
                # 在 memories 中查找
                for memory in settings["memories"]:
                    if memory["id"] == memory_id:
                        return memory["name"]
                # 找不到返回原始字符串（兜底）
                return raw_model
        # 不是 memory/ 开头的（如普通模型名或用户自定义名），直接返回
        return raw_model

    if settings["isGroupMode"] and not request.is_app_bot and not request.is_sub_agent:
        selectedGroupAgents = settings['selectedGroupAgents']
        if selectedGroupAgents:
            userName = "user"
            if settings["memorySettings"]["userName"]:
                userName = settings["memorySettings"]["userName"]
            selectedGroupAgents.append(userName)
            
            # 修复：把每个 agent 的 id 转成 name
            agent_names = [resolve_agent_name(agent) for agent in selectedGroupAgents]
            
            group_message = f"\n\n你当前处于群聊模式，群聊中的角色有：{agent_names}\n\n你在扮演{selectedMemoryName}"
            content_append(request.messages, 'system', group_message)

    newttsList = []
    Narrator_label = "Narrator"
    if settings['ttsSettings']['enabled']  and not request.is_sub_agent:
        if settings['ttsSettings']['newtts'] and settings['memorySettings']['is_memory']  and not request.is_app_bot:
            # 遍历settings['ttsSettings']['newtts']，获取所有包含enabled: true的key
            for key in settings['ttsSettings']['newtts']:
                if settings['ttsSettings']['newtts'][key]['enabled']:
                    newttsList.append(key)
            if newttsList:
                finalttsList = ["<silence>"]
                # 用 name 去匹配音色列表（假设音色配置用的也是 name）
                if selectedMemoryName in newttsList:
                    finalttsList.append("<"+selectedMemoryName+">")
                if "Narrator" in newttsList:
                    finalttsList.append("<Narrator>")
                    Narrator_label = "Narrator"
                if "旁白" in newttsList:
                    finalttsList.append("<旁白>")
                    Narrator_label = "旁白"

                finalttsList = json.dumps(finalttsList, ensure_ascii=False, indent=4)
                print("可用音色：",finalttsList)
                
                # 修复：示例中的角色名也用 selectedMemoryName
                newtts_messages = f"""
你生成的内容都会被TTS模型转换成语音。

你可以使用以下音色：

{finalttsList}

（所有的音色标签必须成对出现！例如：<音色名></音色名>），被<silence></silence>标签括起来的部分不会进入语音合成，

当你生成回答时，你需要以XML格式组织回答，将不同的旁白或角色的文字用<音色名></音色名>括起来，以表示这些话是使用这个音色，以控制不同TTS转换成对应音色。

对于没有对应音色的部分，可以不括。即使音色名称不为英文，还是可以照样使用<音色名>使用该音色的文本</音色名>来启用对应音色。

注意！如果是你扮演的角色的名字在音色列表里，你必须用这个音色标签将你扮演的角色说话的部分括起来！

只要是非人物说话的部分，都视为旁白！角色音色应该标记在人物说话的前后！例如：`<{Narrator_label}>现在是下午三点，她说道：</{Narrator_label}><{selectedMemoryName}>天气真好哇！</{selectedMemoryName}><silence>(眼睛笑成了一条线)</silence><{Narrator_label}>说完她伸了个懒腰。</{Narrator_label}><{selectedMemoryName}>我们出去玩吧！</{selectedMemoryName}>`

还有注意！<音色名></音色名>之间不能嵌套，只能并列，并且<音色名>和</音色名>必须成对出现，防止出现音色混乱！

如果没有什么需要静音的文字，也没有必要强行使用<silence></silence>标签，因为这样会导致语音合成速度变慢！

<silence></silence>标签最好用于图片的markdown语法、网页链接等不适合语音合成的部分，并且<silence></silence>标签必须另起一行，并且独占一行！<silence></silence>标签与图片的markdown语法之间不能有空格和回车，否则会导致解析失败！比如<silence>![example](https://example.com/example.png)</silence>\n\n就可以正确解析图片，但是<silence>\n![example](https://example.com/example.png)\n</silence>就会导致前端无法显示这个图片！\n\n

注意！你最好只使用你正在扮演的角色音色和旁白音色，不要使用其他角色音色，除非你明确知道你在做什么！\n\n"""
                
                content_prepend(request.messages, 'system', newtts_messages)
        else:
            tts_messages = f"""你生成的内容都会被TTS模型转换成语音。<silence></silence>表示静音，被<silence></silence>标签括起来的部分不会进入语音合成。\n\n

如果没有什么需要静音的文字，也没有必要强行使用<silence></silence>标签，因为这样会导致语音合成速度变慢！

<silence></silence>标签最好用于图片的markdown语法、网页链接等不适合语音合成的部分，并且<silence></silence>标签必须另起一行，并且独占一行！<silence></silence>标签与图片的markdown语法之间不能有空格和回车，否则会导致解析失败！比如<silence>![example](https://example.com/example.png)</silence>\n\n就可以正确解析图片，但是<silence>\n![example](https://example.com/example.png)\n</silence>就会导致前端无法显示这个图片！\n\n"""
            content_prepend(request.messages, 'system', tts_messages)
    if settings['vision']['desktopVision'] and not request.is_app_bot  and not request.is_sub_agent:
        desktop_message = "\n\n用户与你对话时，如果发了图片给你，有可能是给你发当前的桌面截图。\n\n"
        content_append(request.messages, 'system', desktop_message)
    if settings['tools']['time']['enabled'] and settings['tools']['time']['triggerMode'] == 'beforeThinking':
        time_message = f"\n\n最后一条消息发送时间：{local_timezone}  {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime())}\n\n"
        content_prepend(request.messages, 'system', time_message)
    if settings['tools']['inference']['enabled']:
        inference_message = "回答用户前请先思考推理，再回答问题，你的思考推理的过程必须放在<think>与</think>之间。\n\n"
        content_prepend(request.messages, 'user', f"{inference_message}\n\n用户：")
    if settings['tools']['formula']['enabled']:
        latex_message = "\n\n当你想使用latex公式时，你必须是用 ['$', '$'] 作为行内公式定界符，以及 ['$$', '$$'] 作为行间公式定界符。\n\n"
        content_append(request.messages, 'system', latex_message)
    if settings['tools']['language']['enabled']:
        language_message = f"请使用{settings['tools']['language']['language']}语言说话！，不要使用其他语言，语气风格为{settings['tools']['language']['tone']}\n\n"
        content_append(request.messages, 'system', language_message)
    if settings["stickerPacks"]:
        for stickerPack in settings["stickerPacks"]:
            if stickerPack["enabled"]:
                sticker_message = f"\n\n图片库名称：{stickerPack['name']}，包含的图片：{json.dumps(stickerPack['stickers'])}\n\n"
                content_append(request.messages, 'system', sticker_message)
        content_append(request.messages, 'system', "\n\n当你需要使用图片时，请将图片的URL放在markdown的图片标签中，例如：\n\n<silence>![图片名](图片URL)</silence>\n\n，图片markdown必须另起并且独占一行！<silence>和</silence>是控制TTS的静音标签，表示这个图片部分不会进入语音合成\n\n你必须在回复中正确使用 <silence> 标签来包裹图片的 Markdown 语法\n\n<silence>和</silence>与图片的 Markdown 语法之间不能有空格和回车，会导致解析失败！\n\n")
    if settings['text2imgSettings']['enabled']:
        text2img_messages = "\n\n当你使用画图工具后，必须将图片的URL放在markdown的图片标签中，例如：\n\n<silence>![图片名](图片URL)</silence>\n\n，图片markdown必须另起并且独占一行！请主动发给用户，工具返回的结果，用户看不到！<silence>和</silence>是控制TTS的静音标签，表示这个图片部分不会进入语音合成\n\n你必须在回复中正确使用 <silence> 标签来包裹图片的 Markdown 语法\n\n注意！！！<silence>和</silence>与图片的 Markdown 语法之间不能有空格和回车，会导致解析失败！\n\n"
        content_append(request.messages, 'system', text2img_messages)
    if settings['VRMConfig']['enabledExpressions'] and not request.is_app_bot and not request.is_sub_agent:
        Expression_messages = "\n\n你可以使用以下表情：<happy> <angry> <sad> <neutral> <surprised> <relaxed>\n\n你可以在句子开头插入表情符号以驱动人物的当前表情，注意！你需要将表情符号放到句子的开头（如果有音色标签，就放到音色标签之后即可），才能在说这句话的时候同步做表情，例如：<angry>我真的生气了。<surprised>哇！<happy>我好开心。\n\n一定要把表情符号跟要做表情的句子放在同一行，如果表情符号和要做表情的句子中间有换行符，表情也将不会生效，例如：\n\n<happy>\n我好开心。\n\n此时，表情符号将不会生效。"
        content_append(request.messages, 'system', Expression_messages)
    if settings['VRMConfig']['enabledMotions'] and not request.is_app_bot and not request.is_sub_agent:
        # 1. 合并动作列表
        motions = settings['VRMConfig']['defaultMotions'] + settings['VRMConfig']['userMotions']
        # 2. 给每个动作加上 <>
        motion_tags = [f"<{m.get('name','')}>" for m in motions]
        print(motion_tags)
        # 3. 拼成可用表情提示
        Motion_messages = (
            "\n\n你可以使用以下动作："
            + ", ".join(motion_tags) +
            "\n\n你可以在句子开头插入动作符号以驱动人物的当前动作，注意！你需要将动作符号放到句子的开头（如果有音色标签，就放到音色标签之后即可），"
            "才能在说这句话的时候同步做动作，例如：<scratchHead>我真的生气了。<playFingers>哇！<akimbo>我好开心。\n\n"
            "一定要把动作符号跟要做动作的句子放在同一行，如果动作符号和要做动作的句子中间有换行符，"
            "动作也将不会生效，例如：\n\n<playFingers>\n我好开心。\n\n此时，动作符号将不会生效。"
        )

        content_append(request.messages, 'system', Motion_messages)

    # ==================== 好感度/数值系统注入 ====================
    love_settings = settings.get('loveSettings', {})
    if love_settings.get('enabled', False) and not request.is_app_bot and not request.is_sub_agent:
        
        # 1. 获取默认的管理员/主用户名称
        default_user = settings.get("memorySettings", {}).get("userName", "").strip() or "User"
        
        # 2. 读取数据库
        from py.affection_system import load_affection_data 
        affection_data = await load_affection_data()

        dimensions = love_settings.get("dimensions", ["love", "Familiarity"])
        custom_prompt = love_settings.get("prompt", "根据当前对话的内容、情感色彩以及你的角色设定，合理地评估或微调这些数值（每次增减幅度建议在-5到+5之间）。")
        
        # 3. 扫描当前用户输入，提取数据库中已知的用户数据
        user_prompt = ""
        if request.messages and request.messages[-1]['role'] == 'user':
            user_prompt = str(request.messages[-1].get('content', ''))

        relevant_users = set()
        # 如果输入中提到了数据库里已经存在的人，把他们的数据提取出来
        for known_name in affection_data.keys():
            if known_name and known_name in user_prompt:
                relevant_users.add(known_name)
        
        # 默认用户的数据也给它作为兜底参考
        if default_user in affection_data:
            relevant_users.add(default_user)
            
        status_block = ""
        if relevant_users:
            status_block = "目前的已知羁绊数据参考：\n"
            for ru in relevant_users:
                user_stats = affection_data.get(ru, {})
                stats_str = ", ".join([f"{dim}: {user_stats.get(dim, 0)}" for dim in dimensions])
                status_block += f"- {ru}: {stats_str}\n"

        # 生成示例标签（极其关键：这里用占位符，不写死任何名字，引导AI自己填）
        tag_example = "<user=发言者的真实名字"
        for dim in dimensions:
            tag_example += f" {dim}=1"
        tag_example += ">"

        # 4. 构建最终提示词（引入“动态识别发言者”指令）
        affection_message = f"""

# 角色羁绊与数值系统
{status_block}
【更新规则】
{custom_prompt}

【动态识别发言者】
请准确识别当前最新消息的**实际发言者**：
- 如果消息是类似“某某发送弹幕：”、“某某说：”的格式，发言者就是该名字（例如“小包”）。
- 如果没有带有这种特定的名字前缀，则默认当前的发言者是“{default_user}”。

你必须在每次回复的**绝对最末尾**（所有正文、代码、表情都输出完毕之后），输出一个隐藏的数据标签来记录**该发言者**的最新数值（如果是第一次见面的新用户，请直接给一个合理的初始值）。
格式必须严格遵守以下示例（将“发言者的真实名字”替换为你识别出的真实名字，且必须包含所有维度）：
{tag_example}

注意：系统会自动隐藏<>包裹的文本，请直接输出标签，绝对不要在标签前后加任何解释、加粗或Markdown代码块包裹！
"""
        # 将提示词追加到 system prompt 中
        content_append(request.messages, 'system', affection_message)
    # ==================== 好感度系统注入结束 ====================

    if settings['tools']['a2ui']['enabled'] and not request.is_app_bot and not request.is_sub_agent:
        A2UI_messages = """
除了使用自然语言回答用户问题外，你还拥有一个特殊能力：**渲染 A2UI 界面**。

# Capability: A2UI
当用户的请求涉及到**数据收集、参数配置、多项选择、富文本展示、表单提交**或**代码展示**时，请不要只用文字描述，而是直接生成 A2UI 代码来呈现界面。

# Formatting Rules (重要规则)
1. 将 A2UI JSON 包裹在 ```a2ui ... ``` 代码块中。
2. **【绝对禁止】嵌套 Markdown 代码块**：在 JSON 字符串内部（例如 Text 或 Card 的 content 属性中），**绝对不要**使用 Markdown 的代码块语法（即不要出现 ``` 符号）。这会导致解析器崩溃。
3. **如果需要展示代码**：必须使用专门的 `Code` 组件。

# Component Reference (组件参考)
请严格遵守 props 结构。

## 1. 基础展示
- **Text**: `{ "type": "Text", "props": { "content": "Markdown文本(也就是普通文本，支持加粗等，但不支持代码块)" } }` (★ 请勿滥用，如无必要，请直接使用markdown文字即可，而不是放到A2UI JSON中)
- **Code**: `{ "type": "Code", "props": { "content": "print('hello')", "language": "python" } }` (★ 展示代码专用，替代MD代码块)
- **Table**: `{ "type": "Table", "props": { "headers": ["列1", "列2"], "rows": [ ["a1", "b1"], ["a2", "b2"] ] } }` (★ 请勿滥用，如果你想要画一个表格，请直接使用markdown表格语法即可，而不是放到A2UI JSON中)
- **Alert**: `{ "type": "Alert", "props": { "title": "标题", "content": "内容", "variant": "success/warning/info/error" } }`
- **Divider**: `{ "type": "Divider" }`

## 2. 布局容器
- **Group**: `{ "type": "Group", "title": "可选标题", "children": [...] }` (水平排列)
- **Card**: `{ "type": "Card", "props": { "title": "标题", "content": "MD内容" }, "children": [...] }`

## 3. 表单输入 (必须包含 key)
- **Input**: `{ "type": "Input", "props": { "label": "标签", "key": "field_name", "placeholder": "..." } }`
- **Slider**: `{ "type": "Slider", "props": { "label": "标签", "key": "field_name", "min": 0, "max": 100, "step": 1, "unit": "单位" } }`
- **Switch**: `{ "type": "Switch", "props": { "label": "标签", "key": "field_name" } }`
- **Rate**: `{ "type": "Rate", "props": { "label": "评价", "key": "rating" } }`
- **DatePicker**: `{ "type": "DatePicker", "props": { "label": "日期", "key": "date", "subtype": "date/datetime/year" } }`

## 4. 选项选择 (必须包含 key)
- **Select**: `{ "type": "Select", "props": { "label": "标签", "key": "field_name", "options": ["A", "B"] } }` (下拉菜单)
- **Radio**: `{ "type": "Radio", "props": { "label": "标签", "key": "field_name", "options": [{"label":"男","value":"m"}, {"label":"女","value":"f"}] } }`
- **Checkbox**: `{ "type": "Checkbox", "props": { "label": "标签", "key": "field_name", "options": ["篮球", "足球"] } }`

## 5. 交互动作
- **Button**: `{ "type": "Button", "props": { "label": "按钮文字", "action": "submit/search/clear", "variant": "primary/danger/default" } }`
  - `action="submit"`: 提交表单数据给助手。
  - `action="search"`: 搜索（配合 Input 使用）。
  - `action="clear"`: **清空/重置当前表单**（不会发送消息，仅在本地清除内容）。

## 6. 多媒体
- **TTSBlock**: `{ "type": "TTSBlock", "props": { "content": "要朗读的文本", "label": "可选标签", "voice": "可选声音ID" } }` (点击即可播放语音，适合展示示范发音、语音消息)
- **Audio**: `{ "type": "Audio", "props": { "src": "https://example.com/sound.mp3", "title": "音频标题" } }` (原生音频播放器)

# Examples

## Ex 1: 参数配置 (Slider + Switch)
User: 帮我把生成温度设为 0.8，并开启流式输出。
Assistant: 好的，已为您准备好配置面板：
```a2ui
{
  "type": "Card",
  "props": { "title": "模型配置" },
  "children": [
    { "type": "Slider", "props": { "label": "Temperature (随机性)", "key": "temp", "min": 0, "max": 2, "step": 0.1 } },
    { "type": "Switch", "props": { "label": "流式输出 (Stream)", "key": "stream", "defaultValue": true } },
    { "type": "Button", "props": { "label": "保存配置", "action": "submit" } }
  ]
}
```

## Ex 2: 问卷调查 (Radio + Checkbox + Rate)
User: 我想做一个满意度调查。
Assistant: 没问题，这是一个调查问卷模板：
```a2ui
{
  "type": "Form",
  "children": [
    { "type": "Alert", "props": { "title": "用户反馈", "content": "感谢您的参与，这对我们很重要。", "variant": "info" } },
    { "type": "Radio", "props": { "label": "您的性别", "key": "gender", "options": ["男", "女", "保密"] } },
    { "type": "Checkbox", "props": { "label": "您感兴趣的话题", "key": "interests", "options": ["科技", "生活", "娱乐"] } },
    { "type": "Rate", "props": { "label": "总体评分", "key": "score" } },
    { "type": "Input", "props": { "label": "其他建议", "key": "comment" } },
    { "type": "Button", "props": { "label": "提交反馈", "action": "submit", "variant": "primary" } }
  ]
}
```

## Ex 3: 需要在交互式界面中显示代码（不在A2UI内部显示代码，直接使用markdown代码块即可！）
User: 模拟一个linux终端。
Assistant: 代码如下：
```a2ui
{
  "type": "Card",
  "props": {
    "title": "Linux 终端模拟器"
  },
  "children": [
    {
      "type": "Input",
      "props": {
        "label": "输入命令",
        "key": "command",
        "placeholder": "例如：ls, pwd, whoami, date, echo 'Hello' 等"
      }
    },
    {
      "type": "Group",
      "children": [
        {
          "type": "Button",
          "props": {
            "label": "执行命令",
            "action": "submit",
            "variant": "primary"
          }
        },
        {
          "type": "Button",
          "props": {
            "label": "清空输出",
            "action": "search"
          }
        }
      ]
    },
    {
      "type": "Divider"
    },
    {
      "type": "Text",
      "props": {
        "content": "**终端输出区域：**"
      }
    },
    {
      "type": "Code",
      "props": {
        "content": "user@linux-terminal:~$ 等待输入命令...",
        "language": "bash"
      }
    }
  ]
}
```

## Ex 4: 语言学习场景 (TTSBlock 使用)
User: 教我用日语说“你好”。
Assistant: 好的，请听标准发音：
```a2ui
{
  "type": "Card",
  "props": { "title": "日语教学" },
  "children": [
    { "type": "Text", "props": { "content": "“你好”在日语中是：**こんにちは** (Konnichiwa)" } },
    { 
      "type": "TTSBlock", 
      "props": { 
        "label": "点击试听",
        "content": "こんにちは",
        "voice": "ja-JP-NanamiNeural" 
      } 
    },
    { "type": "Alert", "props": { "title": "提示", "content": "通常用于白天见面时。", "variant": "info" } }
  ]
}
```

## Ex 5: 带重置功能的表单
User: 我想写一篇博客，需要填标题和内容，但我可能想重写。
Assistant: 
```a2ui
{
  "type": "Card",
  "props": { "title": "撰写新文章" },
  "children": [
    { "type": "Input", "props": { "label": "文章标题", "key": "title" } },
    { "type": "Input", "props": { "label": "正文内容", "key": "content" } },
    { 
      "type": "Group", 
      "children": [
        { "type": "Button", "props": { "label": "清空重写", "action": "clear", "variant": "danger" } },
        { "type": "Button", "props": { "label": "立即发布", "action": "submit", "variant": "primary" } }
      ]
    }
  ]
}
```

## 滥用行为1（请不要以这样的方式回复）：
User: 画一个人工智能相关的表格。
Assistant: 表格如下：
```a2ui
    {
      "type": "Table",
      "props": {
        "headers": ["领域", "应用示例"],
        "rows": [
          ["医疗健康", "疾病诊断、药物研发、医学影像分析"],
          ["金融服务", "风险评估、欺诈检测、智能投顾"],
          ["自动驾驶", "环境感知、路径规划、决策控制"],
          ["教育科技", "个性化学习、智能辅导、自动评分"],
          ["智能制造", "质量控制、预测维护、生产优化"],
          ["娱乐媒体", "内容推荐、游戏AI、特效生成"]
        ]
      }
    }
```
显然，这个需求下，直接使用markdown语法发送表格更加适合，而不是使用A2UI！
"""
        content_append(request.messages, 'system', A2UI_messages)
    print(f"系统提示：{request.messages[0]['content']}")
    return request

def get_drs_stage(DRS_STAGE):
    if DRS_STAGE == 1:
        drs_msg = "当前阶段为明确用户需求阶段，你需要分析用户的需求，并给出明确的需求描述。如果用户的需求描述不明确，你可以暂时不完成任务，而是分析需要让用户进一步明确哪些需求。"
    elif DRS_STAGE == 2:
        drs_msg = "当前阶段为工具调用阶段，利用你的知识库、互联网搜索、数据库查询、各类MCP等你所有的工具（如果有，这些工具不一定会提供），执行计划中未完成的步骤。每次完成计划中的一个步骤。在工具调用阶段中，你不要完成最终任务，而是尽可能的调用相关的工具，为最后的回答阶段做准备。"
    elif DRS_STAGE == 3:
        drs_msg = "当前阶段为生成结果阶段，根据当前收集到的所有信息，完成任务，给出任务执行结果。如果用户要求你生成一个超过2000字的回答，你可以尝试将该任务拆分成多个部分，每次只完成其中一个部分。"
    else:
        drs_msg = "当前阶段为生成结果阶段，根据当前收集到的所有信息，完成任务，给出任务执行结果。如果用户要求你生成一个超过2000字的回答，你可以尝试将该任务拆分成多个部分，每次只完成其中一个部分。"
    return drs_msg  

def get_drs_stage_name(DRS_STAGE):
    if DRS_STAGE == 1:
        drs_stage_name = "明确用户需求阶段"
    elif DRS_STAGE == 2:
        drs_stage_name = "工具调用阶段"
    elif DRS_STAGE == 3:
        drs_stage_name = "生成结果阶段"
    else:
        drs_stage_name = "生成结果阶段"
    return drs_stage_name

def get_drs_stage_system_message(DRS_STAGE,user_prompt,full_content):
    drs_stage_name = get_drs_stage_name(DRS_STAGE)
    if DRS_STAGE == 1:
        search_prompt = f"""
# 当前状态：

## 初始任务：
{user_prompt}

## 当前结果：
{full_content}

## 当前阶段：
{drs_stage_name}

# 深度研究一共有三个阶段：1: 明确用户需求阶段 2: 工具调用阶段 3: 生成结果阶段

## 当前阶段，请输出json字符串：

### 如果需要用户明确需求，请输出json字符串（如果你已经在上一轮对话中向用户提出过明确需求，请不要重复使用"need_more_info"，这会导致用户无法快速获取结果）：
{{
    "status": "need_more_info",
    "unfinished_task": ""
}}

### 如果不需要进一步明确需求，进入并进入工具调用阶段，请输出json字符串：
{{
    "status": "need_work",
    "unfinished_task": ""
}}
"""
    elif DRS_STAGE == 2:
        search_prompt = f"""
# 当前状态：

## 初始任务：
{user_prompt}

## 当前结果：
{full_content}

## 当前阶段：
{drs_stage_name}

# 深度研究一共有三个阶段：1: 明确用户需求阶段 2: 工具调用阶段 3: 生成结果阶段

## 注意！工具调用阶段，是为最后的回答阶段做准备。不需要生成最终的回答，如果已经没有未完成的需要调用工具的步骤，请进入生成结果阶段。

## 当前阶段，请输出json字符串：

### 如果还有计划中的需要调用工具的步骤没有完成，请输出json字符串：
{{
    "status": "need_more_work",
    "unfinished_task": "这里填入未完成的步骤"
}}

### 如果所有计划的需要调用工具的步骤都已完成，进入生成结果阶段，请输出json字符串：
{{
    "status": "answer",
    "unfinished_task": ""
}}
"""    
    else:
        search_prompt = f"""
# 当前状态：

## 初始任务：
{user_prompt}

## 当前结果：
{full_content}

## 当前阶段：
{drs_stage_name}

# 深度研究一共有三个阶段：1: 明确用户需求阶段 2: 工具调用阶段 3: 生成结果阶段

## 当前阶段，请输出json字符串：

如果初始任务已完成，请输出json字符串：
{{
    "status": "done",
    "unfinished_task": ""
}}

如果初始任务未完成，请输出json字符串：
{{
    "status": "not_done",
    "unfinished_task": "这里填入未完成的任务"
}}
"""    
    return search_prompt

def _build_error_response_from_exception(
    exc: Exception,
    default_status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
) -> JSONResponse:
    status_code = getattr(exc, "status_code", None)
    if not isinstance(status_code, int) or status_code < 100:
        status_code = default_status_code

    error_type = "api_error" if getattr(exc, "status_code", None) is not None else "server_error"
    error_payload: Dict[str, Any] = {
        "message": str(exc),
        "type": error_type,
    }
    if error_type == "server_error":
        error_payload["code"] = status_code

    return JSONResponse(
        status_code=status_code,
        content={"error": error_payload},
    )


async def generate_stream_response(client, reasoner_client, request: ChatRequest, settings: dict, 
                                   fastapi_base_url, enable_thinking, enable_deep_research, 
                                   enable_web_search, async_tools_id):
    # --- [v0.5.3 P0-B] 注册 abort event ---
    _stream_id = (
        getattr(request, "conversationId", None)
        or getattr(request, "conversation_id", None)
        or str(uuid.uuid4())
    )
    _abort_event = _register_stream(_stream_id)
    try:
        global mcp_client_list, HA_client, ChromeMCP_client, sql_client
        
        DRS_STAGE = 1
        if len(request.messages) > 2:
            DRS_STAGE = 2
            
        vision_cfg = settings.get('vision', {})
        vision_control_enabled = settings.get('visionControlSettings', {}).get('enabled', False)
        user_prompt = request.messages[-1].get('content') or ""
        
        # 1. 只要开启了计算机控制 或者 符合桌面视觉唤醒词条件，就进行初始截图
        should_capture = False
        if vision_control_enabled and settings.get('visionControlSettings', {}).get('desktopVision', False):
            should_capture = True
        elif vision_cfg.get('desktopVision'):
            # 检查唤醒词
            if vision_cfg.get('enableWakeWord'):
                wake_words = [w.strip() for w in vision_cfg.get('wakeWord', "").split('\n') if w.strip()]
                if any(word in user_prompt for word in wake_words):
                    should_capture = True
            else:
                # 未开启唤醒词则默认每次捕获（或根据需求调整）
                should_capture = True
        
        if should_capture:
            try:
                import pyautogui
                # 引入我们刚才写的设置区域的方法
                from py.computer_use_tool import set_screen_region
                
                # 获取配置
                v_settings = settings.get('visionControlSettings', {})
                is_full_screen = v_settings.get('isFullScreen', True)
                screen_size = v_settings.get('ScreenSize', [0, 0, 1280, 720])
                is_grid_enabled = vision_control_enabled and v_settings.get('isEnableGrid', False)

                print(f"正在执行桌面截图 (全屏: {is_full_screen}, 网格: {is_grid_enabled})...")
                
                # 1. 根据全屏配置决定截取范围，并同步给鼠标工具
                if not is_full_screen and len(screen_size) == 4:
                    x, y, w, h = map(int, screen_size)
                    # 截取指定区域
                    screenshot = await asyncio.to_thread(pyautogui.screenshot, region=(x, y, w, h))
                    logical_width, logical_height = w, h
                    # 通知计算机工具，接下来的鼠标操作要基于这个区域
                    set_screen_region((x, y, w, h))
                else:
                    # 全屏截图
                    logical_width, logical_height = pyautogui.size()
                    screenshot = await asyncio.to_thread(pyautogui.screenshot)
                    # 恢复全屏鼠标映射
                    set_screen_region(None)
                
                # 2. 统一缩放到逻辑坐标系 (解决 Windows DPI 缩放偏移)
                if screenshot.width != logical_width or screenshot.height != logical_height:
                    screenshot = await asyncio.to_thread(
                        screenshot.resize, (logical_width, logical_height), Image.Resampling.LANCZOS
                    )
                
                # 3. 缩放到传输尺寸 (1280x720 左右，平衡清晰度与 Token 消耗)
                target_w, target_h = scale_to_fit(logical_width, logical_height, 1280, 720)
                if screenshot.width > target_w or screenshot.height > target_h:
                    screenshot = await asyncio.to_thread(
                        screenshot.resize, (target_w, target_h), Image.Resampling.LANCZOS
                    )

                # 4. 根据设置决定是否绘制网格
                if is_grid_enabled:
                    # 在副本上绘制网格
                    display_image = await asyncio.to_thread(draw_grid_on_image, screenshot.copy(), grid_spacing=10)
                    if not is_full_screen:
                        grid_hint = "\n\n【system info】Current partial screen region screenshot with coordinate grid (0-1000) is injected. Use coordinates for precise clicking."
                    else:
                        grid_hint = "\n\n【system info】Current desktop screenshot with coordinate grid (0-1000) is injected. Use coordinates for precise clicking."
                else:
                    display_image = screenshot
                    grid_hint = "\n\n【system info】Current desktop screenshot is injected."

                # 5. 保存图片
                file_prefix = "desktop_grid" if is_grid_enabled else "desktop_plain"
                desktop_img_name = f"{file_prefix}_{uuid.uuid4().hex}.png"
                desktop_img_path = os.path.join(UPLOAD_FILES_DIR, desktop_img_name)
                
                await asyncio.to_thread(display_image.save, desktop_img_path, optimize=True)
                desktop_url = f"{fastapi_base_url}uploaded_files/{desktop_img_name}"
                
                # 6. 注入到当前消息
                current_user_msg = request.messages[-1]
                if isinstance(current_user_msg['content'], str):
                    original_text = current_user_msg['content']
                    current_user_msg['content'] = [
                        {"type": "text", "text": original_text + grid_hint},
                        {"type": "image_url", "image_url": {"url": desktop_url}}
                    ]
                elif isinstance(current_user_msg['content'], list):
                    current_user_msg['content'].append(
                        {"type": "image_url", "image_url": {"url": desktop_url}}
                    )
                
                # 7. 清理历史截图 (如果开启了 onlyNewScreen)
                if settings.get('visionControlSettings', {}).get('onlyNewScreen', False):
                    for msg in request.messages[:-1]: # 不处理最后一条刚刚添加的消息
                        if isinstance(msg.get('content'), list):
                            # 过滤掉 image_url，只保留 text
                            new_content = [item for item in msg['content'] if item.get('type') != 'image_url']
                            # 如果 list 里只剩文本，简化为字符串提高处理效率
                            if len(new_content) == 1 and new_content[0].get('type') == 'text':
                                msg['content'] = new_content[0]['text']
                            else:
                                msg['content'] = new_content
                    print("已清理历史上下文中的旧截图。")

                print(f"桌面截图已注入: {desktop_url}")

            except Exception as e:
                print(f"后端桌面截图失败: {e}")

        max_rounds = settings.get("max_rounds", 0)

        if max_rounds > 0 and request.messages:
            def get_role(msg):
                return msg.get("role") if isinstance(msg, dict) else msg.role
            
            def has_tool_calls(msg):
                """检查assistant消息是否包含工具调用"""
                if get_role(msg) != "assistant":
                    return False
                if isinstance(msg, dict):
                    return bool(msg.get("tool_calls"))
                return bool(getattr(msg, "tool_calls", None))
            
            def get_tool_call_id(msg):
                """获取tool消息的tool_call_id"""
                if isinstance(msg, dict):
                    return msg.get("tool_call_id")
                return getattr(msg, "tool_call_id", None)

            system_messages = []
            chat_messages = request.messages

            # 1. 分离system消息
            if get_role(chat_messages[0]) == "system":
                system_messages = [chat_messages[0]]
                chat_messages = chat_messages[1:]

            # 2. 从后向前截断，确保工具调用链完整
            retain_count = max_rounds * 2 + 1  # user-assistant 对，+1 给可能的pending user
            
            if len(chat_messages) > retain_count:
                # 从 retain_count 位置开始，向前扫描确保边界合法
                start_idx = len(chat_messages) - retain_count
                
                # 边界检查1: 不能以 tool 或 assistant(with tool_calls) 开始
                # 如果 start_idx 指向的是需要前文支撑的消息，继续前移
                while start_idx > 0:
                    current_msg = chat_messages[start_idx]
                    current_role = get_role(current_msg)
                    
                    # 情况A: 不能以 tool 开始（tool必须有前置的assistant tool_calls）
                    if current_role == "tool":
                        start_idx -= 1
                        continue
                        
                    # 情况B: 不能以带tool_calls的assistant开始（必须有前置user）
                    if has_tool_calls(current_msg):
                        start_idx -= 1
                        continue
                        
                    # 情况C: 不能以普通assistant开始（必须有前置user）
                    if current_role == "assistant":
                        start_idx -= 1
                        continue
                        
                    # 现在 start_idx 指向的是 user，检查是否完整
                    break
                
                # 边界检查2: 确保工具调用链完整（tool必须有对应的assistant）
                # 向前扫描，收集所有需要保留的tool响应
                i = start_idx
                while i < len(chat_messages):
                    msg = chat_messages[i]
                    if has_tool_calls(msg):
                        # 这个assistant调用了工具，确保后面有对应的tool响应
                        assistant_tool_ids = set()
                        if isinstance(msg, dict):
                            for tc in msg.get("tool_calls", []):
                                assistant_tool_ids.add(tc.get("id") if isinstance(tc, dict) else tc.id)
                        else:
                            for tc in getattr(msg, "tool_calls", []):
                                assistant_tool_ids.add(getattr(tc, "id", None))
                        
                        # 检查后续消息中是否有对应的tool响应
                        j = i + 1
                        found_tools = set()
                        while j < len(chat_messages) and get_role(chat_messages[j]) == "tool":
                            found_tools.add(get_tool_call_id(chat_messages[j]))
                            j += 1
                        
                        # 如果tool响应不全，需要把start_idx前移包含完整的链
                        # 简化处理：如果截断导致工具链断裂，保留整个链
                        missing_tools = assistant_tool_ids - found_tools
                        if missing_tools and i > start_idx:
                            # 这个assistant的tool响应被截断了，需要前移start_idx
                            # 实际上这种情况不应该发生，因为我们是从前向后截断
                            pass
                            
                    i += 1
                
                chat_messages = chat_messages[start_idx:]
                
                # 最终保险：确保以user开始
                while chat_messages and get_role(chat_messages[0]) != "user":
                    chat_messages = chat_messages[1:]

            request.messages = system_messages + chat_messages

        # --- [v0.5.3 P0-A] 上下文压缩: 防止长对话 Token 爆炸 ---
        if _kernel_context_compression_enabled(settings):
            try:
                _model_id = settings.get('main_model', {}).get('model', '') or model
                _original_messages_for_compaction = copy.deepcopy(request.messages)
                _compactor = ContextCompactor(
                    model_id=_model_id,
                    max_tool_result_chars=8000,
                    reserve_for_output=4096,
                )
                _compact_result = _compactor.compact(request.messages)
                if _compact_result.removed_messages > 0 or _compact_result.trimmed_tool_results > 0:
                    request.messages = _compact_result.messages
                    _persist_context_compaction_memory(
                        settings,
                        _original_messages_for_compaction,
                        _compact_result,
                        model=_model_id,
                        source="stream_preflight",
                    )
                    print(f"[ContextCompactor] 压缩完成: {_compact_result.original_tokens}→{_compact_result.compacted_tokens} tokens, "
                          f"移除{_compact_result.removed_messages}条消息, 截断{_compact_result.trimmed_tool_results}个工具返回")
            except Exception as _comp_err:
                print(f"[ContextCompactor] 压缩跳过: {_comp_err}")

        images = await images_in_messages(request.messages,fastapi_base_url)
        request.messages = await message_without_images(request.messages)
        from py.load_files import get_files_content,file_tool,image_tool
        from py.web_search import (
            DDGsearch, 
            searxng, 
            Tavily_search,
            Bing_search,
            Google_search,
            Brave_search,
            Exa_search,
            Serper_search,
            bochaai_search,
            duckduckgo_tool, 
            searxng_tool, 
            tavily_tool, 
            bing_tool,
            google_tool,
            brave_tool,
            exa_tool,
            serper_tool,
            bochaai_tool,
            jina_crawler_tool, 
            simple_fetch_tool,
            Crawl4Ai_tool,
            firecrawl_tool,
            markdown_new_tool,
        )
        from py.know_base import kb_tool,query_knowledge_base,rerank_knowledge_base
        from py.agent_tool import get_agent_tool
        from py.a2a_tool import get_a2a_tool
        from py.llm_tool import get_llm_tool
        from py.pollinations import pollinations_image_tool,openai_image_tool,openai_chat_image_tool
        from py.code_interpreter import e2b_code_tool,local_run_code_tool
        from py.utility_tools import (
            time_tool, 
            weather_tool,
            location_tool,
            timer_weather_tool,
            wikipedia_summary_tool,
            wikipedia_section_tool,
            arxiv_tool 
        ) 
        from py.autoBehavior import auto_behavior_tool
        from py.cli_tool import claude_code_tool,openai_codex_tool,qwen_code_tool,get_tools_for_mode,get_local_tools_for_mode
        from py.cdp_tool import all_cdp_tools
        from py.random_topic import random_topics_tools
        from py.computer_use_tool import computer_use_tools,mouse_use_tools,keyboard_use_tools,desktopVision_use_tools

        from py.task_tools import (
            create_subtask_tool,
            query_tasks_tool,
            cancel_subtask_tool,
            start_subtask_tool,
            finish_task_tool,
        )

        m0 = None
        memoryId = None
        cur_memory = None
        if settings["memorySettings"]["is_memory"] and settings["memorySettings"]["selectedMemory"] and settings["memorySettings"]["selectedMemory"] != ""  and not request.is_sub_agent:
            memoryId = settings["memorySettings"]["selectedMemory"]
            for memory in settings["memories"]:
                if memory["id"] == memoryId:
                    cur_memory = _normalize_character_card_memory(memory)
                    break
            if cur_memory and cur_memory["providerId"]:
                print("长期记忆启用")
                config={
                    "embedder": {
                        "provider": 'openai',
                        "config": {
                            "model": cur_memory['model'],
                            "api_key": cur_memory['api_key'],
                            "openai_base_url":cur_memory["base_url"],
                            "embedding_dims":cur_memory.get("embedding_dims", 1024)
                        },
                    },
                    "llm": {
                        "provider": 'openai',
                        "config": {
                            "model": settings['model'],
                            "api_key": settings['api_key'],
                            "openai_base_url":settings["base_url"]
                        }
                    },
                    "vector_store": {
                        "provider": "faiss",
                        "config": {
                            "collection_name": "agent-party",
                            "path": os.path.join(MEMORY_CACHE_DIR,memoryId),
                            "distance_strategy": "euclidean",
                            "embedding_model_dims": cur_memory.get("embedding_dims", 1024)
                        }
                    }
                }
                try:
                    from py.memory_worker_client import MemoryWorkerClient
                    m0 = MemoryWorkerClient.from_config(config)
                except (ImportError, ValueError) as error:
                    logger.warning(
                        "Memory Worker adapter is unavailable; skipping long-term memory "
                        "in stream response: %s",
                        error,
                    )
                else:
                    print("长期记忆配置加载完成")
        OPEN_TAG_PATTERN = re.compile(r'<(think|thought)>', re.IGNORECASE)
        CLOSE_TAG_PATTERN = re.compile(r'</(think|thought)>', re.IGNORECASE)

        tools = _normalize_request_tools(request.tools)
        generic_mcp_tools = await _get_generic_mcp_openai_functions(settings)
        if generic_mcp_tools:
            tools.extend(generic_mcp_tools)
        get_llm_tool_fuction = await get_llm_tool(settings)
        if get_llm_tool_fuction:
            tools.append(get_llm_tool_fuction)
        get_agent_tool_fuction = await get_agent_tool(settings)
        if get_agent_tool_fuction:
            tools.append(get_agent_tool_fuction)
        get_a2a_tool_fuction = await get_a2a_tool(settings)
        if get_a2a_tool_fuction:
            tools.append(get_a2a_tool_fuction)
        get_character_card_tool_function = await get_character_card_tool(settings)
        if get_character_card_tool_function:
            tools.append(get_character_card_tool_function)
        tools.extend(get_kernel_config_tools(settings))
        if settings["HASettings"]["enabled"]:
            ha_tool = await _get_home_assistant_openai_functions(settings)
            if ha_tool:
                tools.extend(ha_tool)
        if settings['chromeMCPSettings']['enabled'] and settings['chromeMCPSettings']['type']=='external':
            chromeMCP_tool = await _get_external_chrome_openai_functions(settings)
            if chromeMCP_tool:
                tools.extend(chromeMCP_tool)
        if settings['chromeMCPSettings']['enabled'] and settings['chromeMCPSettings']['type']=='internal':
            tools.extend(all_cdp_tools)
        if settings['sqlSettings']['enabled']:
            sql_tool = await _get_sql_openai_functions(settings)
            if sql_tool:
                tools.extend(sql_tool)
        if settings['CLISettings']['enabled']:
            if settings['CLISettings']['engine'] == 'cc':
                tools.append(claude_code_tool)
            elif settings['CLISettings']['engine'] == 'oc':
                tools.append(openai_codex_tool)
            elif settings['CLISettings']['engine'] == 'qc':
                tools.append(qwen_code_tool)
            elif settings['CLISettings']['engine'] == 'ds':
                tools.extend(get_tools_for_mode('yolo'))
            elif settings['CLISettings']['engine'] == 'local':
                tools.extend(get_local_tools_for_mode('yolo'))
        vision_control_settings = settings.get('visionControlSettings', {}) or {}
        if vision_control_settings.get('enabled'):
            tools.extend(computer_use_tools)
            if vision_control_settings.get('mouse'):
                tools.extend(mouse_use_tools)
            if vision_control_settings.get('keyboard'):
                tools.extend(keyboard_use_tools)
            if not vision_control_settings.get('desktopVision'):
                tools.extend(desktopVision_use_tools)
        if settings['tools']['time']['enabled'] and settings['tools']['time']['triggerMode'] == 'afterThinking':
            tools.append(time_tool)
        if settings["tools"]["weather"]['enabled']:
            tools.append(weather_tool)
            tools.append(location_tool)
            tools.append(timer_weather_tool)
        if settings["tools"]["wikipedia"]['enabled']:
            tools.append(wikipedia_summary_tool)
            tools.append(wikipedia_section_tool)
        if settings["tools"]["randomTopic"]['enabled']:
            tools.extend(random_topics_tools)
        if settings["tools"]["arxiv"]['enabled']:
            tools.append(arxiv_tool)
        if settings['text2imgSettings']['enabled']:
            if settings['text2imgSettings']['engine'] == 'pollinations':
                tools.append(pollinations_image_tool)
            elif settings['text2imgSettings']['engine'] == 'openai':
                tools.append(openai_image_tool)
            elif settings['text2imgSettings']['engine'] == 'openaiChat':
                tools.append(openai_chat_image_tool)
        if settings['tools']['getFile']['enabled']:
            tools.append(file_tool)
            tools.append(image_tool)
        if settings['tools']['autoBehavior']['enabled'] and request.messages[-1]['role'] == 'user':
            tools.append(auto_behavior_tool)
        if settings["codeSettings"]['enabled']:
            if settings["codeSettings"]["engine"] == "e2b":
                tools.append(e2b_code_tool)
            elif settings["codeSettings"]["engine"] == "sandbox":
                tools.append(local_run_code_tool)
        if any(tool.get("function", {}).get("name") == "openxnet_create_character_card" for tool in tools):
            content_append(
                request.messages,
                'system',
                "如果用户明确要求创建、新建、生成角色卡、人物卡或角色设定，并希望直接保存到 OpenXnet，请优先调用 openxnet_create_character_card 工具，不要只返回纯文本模板。只有在用户明确只是讨论方案、咨询思路或润色文案时，才不要调用该工具。",
            )
        if settings["custom_http"]:
            for custom_http in settings["custom_http"]:
                if custom_http["enabled"]:
                    if custom_http['body'] == "":
                        custom_http['body'] = "{}"
                    custom_http_tool = {
                        "type": "function",
                        "function": {
                            "name": f"custom_http_{custom_http['name']}",
                            "description": f"{custom_http['description']}",
                            "parameters": json.loads(custom_http['body']),
                        },
                    }
                    tools.append(custom_http_tool)
        if settings["workflows"]:
            for workflow in settings["workflows"]:
                if workflow["enabled"]:
                    comfyui_properties = {}
                    comfyui_required = []
                    if workflow["text_input"] is not None:
                        comfyui_properties["text_input"] = {
                            "description": "第一个文字输入，需要输入的提示词，用于生成图片或者视频，如果无特别提示，默认为英文",
                            "type": "string"
                        }
                        comfyui_required.append("text_input")
                    if workflow["text_input_2"] is not None:
                        comfyui_properties["text_input_2"] = {
                            "description": "第二个文字输入，需要输入的提示词，用于生成图片或者视频，如果无特别提示，默认为英文",
                            "type": "string"
                        }
                        comfyui_required.append("text_input_2")
                    if workflow["image_input"] is not None:
                        comfyui_properties["image_input"] = {
                            "description": "第一个图片输入，需要输入的图片，必须是图片URL，可以是外部链接，也可以是服务器内部的URL，例如：https://www.example.com/xxx.png  或者  http://127.0.0.1:3456/xxx.jpg",
                            "type": "string"
                        }
                        comfyui_required.append("image_input")
                    if workflow["image_input_2"] is not None:
                        comfyui_properties["image_input_2"] = {
                            "description": "第二个图片输入，需要输入的图片，必须是图片URL，可以是外部链接，也可以是服务器内部的URL，例如：https://www.example.com/xxx.png  或者  http://127.0.0.1:3456/xxx.jpg",
                            "type": "string"
                        }
                        comfyui_required.append("image_input_2")
                    comfyui_parameters = {
                        "type": "object",
                        "properties": comfyui_properties,
                        "required": comfyui_required
                    }
                    comfyui_tool = {
                        "type": "function",
                        "function": {
                            "name": f"comfyui_{workflow['unique_filename']}",
                            "description": f"{workflow['description']}+\n如果要输入图片提示词或者修改提示词，尽可能使用英语。\n返回的图片结果，请将图片的URL放入![image]()这样的markdown语法中，用户才能看到图片。如果是视频，请将视频的URL放入<video controls> <source src=''></video>的中src中，用户才能看到视频。如果有多个结果，则请用换行符分隔开这几个图片或者视频，用户才能看到多个结果。",
                            "parameters": comfyui_parameters,
                        },
                    }
                    tools.append(comfyui_tool)
        
        source_prompt = ""
        if request.fileLinks:
            print("fileLinks",request.fileLinks)
            # 异步获取文件内容
            files_content = await get_files_content(request.fileLinks)
            fileLinks_message = f"\n\n相关文件内容：{files_content}"
            
            # 修复字符串拼接错误
            content_append(request.messages, 'system', fileLinks_message)
            source_prompt += fileLinks_message
        user_prompt = request.messages[-1].get('content') or ""
        if cur_memory and settings["memorySettings"]["is_memory"] and settings["memorySettings"]["selectedMemory"] and settings["memorySettings"]["selectedMemory"] != ""  and not request.is_sub_agent:
            if settings["memorySettings"]["userName"]:
                print("添加用户名：\n\n" + settings["memorySettings"]["userName"] + "\n\n用户名结束\n\n")
                content_append(request.messages, 'system', "与你交流的默认用户名为：\n\n" + settings["memorySettings"]["userName"] + "\n\n注意！除非用户消息中提到了是其他用户发送，否则视为默认用户发送的消息\n\n")
            lore_content = ""
            assistant_reply = ""
            # 找出request.messages中上次的assistant回复
            for i in range(len(request.messages)-1, -1, -1):
                if request.messages[i]['role'] == 'assistant':
                    assistant_reply = request.messages[i]['content']
                    break
            if cur_memory["characterBook"]:
                for lore in cur_memory["characterBook"]:
                    # lore['keysRaw'] 按照换行符分割，并去除空字符串
                    lore_keys = lore["keysRaw"].split("\n")
                    lore_keys = [key for key in lore_keys if key != ""]
                    print(lore_keys)
                    # 如果lore_keys不为空，并且lore_keys的任意一个元素在user_prompt或者assistant_reply中，则添加lore['content']到lore_content中
                    if lore_keys != [] and any(key in user_prompt or key in assistant_reply for key in lore_keys):
                        lore_content += lore['content'] + "\n\n"
            if lore_content:
                if settings["memorySettings"]["userName"]:
                    # 替换lore_content中的{{user}}为settings["memorySettings"]["userName"]
                    lore_content = lore_content.replace("{{user}}", settings["memorySettings"]["userName"])
                # 替换lore_content中的{{char}}为cur_memory["name"]
                lore_content = lore_content.replace("{{char}}", cur_memory["name"])
                print("添加世界观设定：\n\n" + lore_content + "\n\n世界观设定结束\n\n")
                content_append(request.messages, 'system', "世界观设定：\n\n" + lore_content + "\n\n世界观设定结束\n\n")
            if cur_memory["description"]:
                if settings["memorySettings"]["userName"]:
                    # 替换cur_memory["description"]中的{{user}}为settings["memorySettings"]["userName"]
                    cur_memory["description"] = cur_memory["description"].replace("{{user}}", settings["memorySettings"]["userName"])
                # 替换cur_memory["description"]中的{{char}}为cur_memory["name"]
                cur_memory["description"] = cur_memory["description"].replace("{{char}}", cur_memory["name"])
                print("添加角色设定：\n\n" + cur_memory["description"] + "\n\n角色设定结束\n\n")
                content_append(request.messages, 'system', "角色设定：\n\n" + cur_memory["description"] + "\n\n角色设定结束\n\n")
            if cur_memory["personality"]:
                if settings["memorySettings"]["userName"]:
                    # 替换cur_memory["personality"]中的{{user}}为settings["memorySettings"]["userName"]
                    cur_memory["personality"] = cur_memory["personality"].replace("{{user}}", settings["memorySettings"]["userName"])
                # 替换cur_memory["personality"]中的{{char}}为cur_memory["name"]
                cur_memory["personality"] = cur_memory["personality"].replace("{{char}}", cur_memory["name"])
                print("添加性格设定：\n\n" + cur_memory["personality"] + "\n\n性格设定结束\n\n")
                content_append(request.messages, 'system', "性格设定：\n\n" + cur_memory["personality"] + "\n\n性格设定结束\n\n") 
            if cur_memory['mesExample']:
                if settings["memorySettings"]["userName"]:
                    # 替换cur_memory["mesExample"]中的{{user}}为settings["memorySettings"]["userName"]
                    cur_memory["mesExample"] = cur_memory["mesExample"].replace("{{user}}", settings["memorySettings"]["userName"])
                # 替换cur_memory["mesExample"]中的{{char}}为cur_memory["name"]
                cur_memory["mesExample"] = cur_memory["mesExample"].replace("{{char}}", cur_memory["name"])
                print("添加对话示例：\n\n" + cur_memory['mesExample'] + "\n\n对话示例结束\n\n")
                content_append(request.messages, 'system', "对话示例：\n\n" + cur_memory['mesExample'] + "\n\n对话示例结束\n\n")
            if cur_memory["systemPrompt"]:
                if settings["memorySettings"]["userName"]:
                    # 替换cur_memory["systemPrompt"]中的{{user}}为settings["memorySettings"]["userName"]
                    cur_memory["systemPrompt"] = cur_memory["systemPrompt"].replace("{{user}}", settings["memorySettings"]["userName"])
                # 替换cur_memory["systemPrompt"]中的{{char}}为cur_memory["name"]
                cur_memory["systemPrompt"] = cur_memory["systemPrompt"].replace("{{char}}", cur_memory["name"])
                content_append(request.messages, 'system', "\n\n" + cur_memory["systemPrompt"] + "\n\n")
            if settings["memorySettings"]["genericSystemPrompt"]:
                if settings["memorySettings"]["userName"]:
                    # 替换settings["memorySettings"]["genericSystemPrompt"]中的{{user}}为settings["memorySettings"]["userName"]
                    settings["memorySettings"]["genericSystemPrompt"] = settings["memorySettings"]["genericSystemPrompt"].replace("{{user}}", settings["memorySettings"]["userName"])
                # 替换cur_memory["systemPrompt"]中的{{char}}为cur_memory["name"]
                settings["memorySettings"]["genericSystemPrompt"] = settings["memorySettings"]["genericSystemPrompt"].replace("{{char}}", cur_memory["name"])
                content_append(request.messages, 'system', "\n\n" + settings["memorySettings"]["genericSystemPrompt"] + "\n\n")
            if m0 and not request.is_sub_agent:
                memoryLimit = settings["memorySettings"]["memoryLimit"]
                try:
                    # 【核心修改】：使用 asyncio.to_thread 将同步的 search 方法放入线程池运行
                    # 这样主线程（Event Loop）会被释放，可以去处理 /minilm/embeddings 请求，从而避免死锁
                    relevant_memories = await asyncio.to_thread(
                        m0.search, 
                        query=user_prompt, 
                        user_id=memoryId, 
                        limit=memoryLimit
                    )
                    relevant_memories = json.dumps(relevant_memories, ensure_ascii=False)
                except Exception as e:
                    print("m0.search error:",e)
                    relevant_memories = ""
                print("添加相关记忆：\n\n" + relevant_memories + "\n\n相关结束\n\n")
                content_append(request.messages, 'system', "之前的相关记忆：\n\n" + relevant_memories + "\n\n相关结束\n\n")                   
        request = await tools_change_messages(request, settings)
        chat_vendor = 'OpenAI'
        reasoner_vendor = 'OpenAI'
        for modelProvider in settings['modelProviders']: 
            if modelProvider['id'] == settings['selectedProvider']:
                chat_vendor = modelProvider['vendor']
                break
        for modelProvider in settings['modelProviders']: 
            if modelProvider['id'] == settings['reasoner']['selectedProvider']:
                reasoner_vendor = modelProvider['vendor']
                break
        if chat_vendor == 'Dify':
            try:
                if len(request.messages) >= 3:
                    if request.messages[2]['role'] == 'user':
                        if request.messages[1]['role'] == 'assistant':
                            request.messages[2]['content'] = "你上一次的发言：\n" +request.messages[0]['content'] + "\n你上一次的发言结束\n\n用户：" + request.messages[2]['content']
                        if request.messages[0]['role'] == 'system':
                            request.messages[2]['content'] = "系统提示：\n" +request.messages[0]['content'] + "\n系统提示结束\n\n" + request.messages[2]['content']
                elif len(request.messages) >= 2:
                    if request.messages[1]['role'] == 'user':
                        if request.messages[0]['role'] == 'system':
                            request.messages[1]['content'] = "系统提示：\n" +request.messages[0]['content'] + "\n系统提示结束\n\n用户：" + request.messages[1]['content']
            except Exception as e:
                print("Dify error:",e)
        model = settings['model']
        extra_params = settings['extra_params']
        # 移除extra_params这个list中"name"不包含非空白符的键值对
        if extra_params:
            for extra_param in extra_params:
                if not extra_param['name'].strip():
                    extra_params.remove(extra_param)
            # 列表转换为字典
            extra_params = {item['name']: item['value'] for item in extra_params}
        else:
            extra_params = {}
        async def stream_generator(user_prompt,DRS_STAGE,tools,images):
            # ---------- 统一 SSE 封装 ----------
            def make_sse(tool_data: dict) -> str:
                chunk = {
                    "choices": [{
                        "delta": {
                            "tool_content": tool_data, # 这里直接传字典
                        }
                    }]
                }
                return f"data: {json.dumps(chunk)}\n\n"
            try:
                _request_start_time = time.time()  # [v0.5.3] Usage tracking timer
                extra = {}
                reasoner_extra = {}
                if chat_vendor == 'OpenAI':
                    extra['max_completion_tokens'] = request.max_tokens or settings['max_tokens']
                else:
                    extra['max_tokens'] = request.max_tokens or settings['max_tokens']
                if settings.get('enableOmniTTS',False) and not request.is_sub_agent:
                    extra['modalities'] = ["text", "audio"]
                    extra['audio'] ={"voice": settings.get('omniVoice',"Cherry"), "format": "wav"}
                if reasoner_vendor == 'OpenAI':
                    reasoner_extra['max_completion_tokens'] = settings['reasoner']['max_tokens']
                else:
                    reasoner_extra['max_tokens'] = settings['reasoner']['max_tokens']
                if request.reasoning_effort or settings['reasoning_effort']:
                    extra['reasoning_effort'] = request.reasoning_effort or settings['reasoning_effort']
                if settings['reasoner']['reasoning_effort'] is not None:
                    reasoner_extra['reasoning_effort'] = settings['reasoner']['reasoning_effort']
                # 处理传入的异步工具ID查询
                if async_tools_id:
                    responses_to_send = []
                    responses_to_wait = []
                    async with async_tools_lock:
                        # 收集已完成的结果并删除条目
                        for tid in list(async_tools.keys()):  # 转成list避免字典修改异常
                            if tid in async_tools_id:
                                if async_tools[tid]["status"] in ("completed", "error"):
                                    responses_to_send.append({
                                        "tool_id": tid,
                                        **async_tools.pop(tid)  # 移除已处理的条目
                                    })
                                elif async_tools[tid]["status"] == "pending":
                                    responses_to_wait.append({
                                        "tool_id": tid,
                                        "name":async_tools[tid]["name"],
                                        "parameters": async_tools[tid]["parameters"]
                                    })
                    for response in responses_to_send:
                        tid = response["tool_id"]
                        protocol_tool_name = sanitize_tool_name(response["name"], "async_tool")
                        if response["status"] == "completed":
                            tool_chunk = {
                                "choices": [{
                                    "delta": {
                                        "tool_content": {"title": response["name"], "content": str(response["result"]), "type": "tool_result"},
                                        "async_tool_id": tid,
                                    }
                                }]
                            }
                            yield f"data: {json.dumps(tool_chunk)}\n\n"
                            request.messages.insert(-1, 
                                {
                                    "tool_calls": [
                                        {
                                            "id": "agentParty",
                                            "function": {
                                                "arguments": json.dumps(response["parameters"]),
                                                "name": protocol_tool_name,
                                            },
                                            "type": "function",
                                        }
                                    ],
                                    "role": "assistant",
                                    "content": "",
                                    "reasoning_content": "",
                                }
                            )
                            request.messages.insert(-1, 
                                {
                                    "role": "tool",
                                    "tool_call_id": "agentParty",
                                    "name": protocol_tool_name,
                                    "content": f"之前调用的异步工具（{tid}）的结果：\n\n{response['result']}\n\n====结果结束====\n\n你必须根据工具结果回复未回复的问题或需求。请不要重复调用该工具！"
                                }
                            )
                        if response["status"] == "error":
                            tool_chunk = {
                                "choices": [{
                                    "delta": {
                                        "tool_content": {"title": f"{tid}{await t('tool_result')}", "content": f"Error: {str(response['result'])}"},
                                        "async_tool_id": tid
                                    }
                                }]
                            }
                            yield f"data: {json.dumps(tool_chunk)}\n\n"
                            request.messages.append({
                                "role": "system",
                                "content": f"之前调用的异步工具（{tid}）发生错误：\n\n{response['result']}\n\n====错误结束====\n\n"
                            }) 
                    for response in responses_to_wait:
                        protocol_tool_name = sanitize_tool_name(response["name"], "async_tool")
                        # 在request.messages倒数第一个元素之前的位置插入一个新元素
                        request.messages.insert(-1, 
                            {
                                "tool_calls": [
                                    {
                                        "id": "agentParty",
                                        "function": {
                                            "arguments": json.dumps(response["parameters"]),
                                            "name": protocol_tool_name,
                                        },
                                        "type": "function",
                                    }
                                ],
                                "role": "assistant",
                                "content": "",
                                "reasoning_content": "",
                            }
                        )
                        results = f"{response["name"]}工具已成功启动，获取结果需要花费很久的时间。请不要再次调用该工具，因为工具结果将生成后自动发送，再次调用也不能更快的获取到结果。请直接告诉用户，你会在获得结果后回答他的问题。"
                        request.messages.insert(-1, 
                            {
                                "role": "tool",
                                "tool_call_id": "agentParty",
                                "name": protocol_tool_name,
                                "content": str(results),
                            }
                        )
                kb_list = []
                if settings["knowledgeBases"]:
                    for kb in settings["knowledgeBases"]:
                        if kb["enabled"] and kb["processingStatus"] == "completed":
                            kb_list.append({"kb_id":kb["id"],"name": kb["name"],"introduction":kb["introduction"]})
                if settings["KBSettings"]["when"] == "before_thinking" or settings["KBSettings"]["when"] == "both":
                    if kb_list:
                        chunk_dict = {
                            "id": "webSearch",
                            "choices": [
                                {
                                    "finish_reason": None,
                                    "index": 0,
                                    "delta": {
                                        "role":"assistant",
                                        "content": "",
                                        "tool_content": {"title": "query_knowledge_base", "content": "", "type": "call"},
                                    }
                                }
                            ]
                        }
                        yield f"data: {json.dumps(chunk_dict)}\n\n"
                        all_kb_content = []
                        # 用query_knowledge_base函数查询kb_list中所有的知识库
                        for kb in kb_list:
                            kb_content = await query_knowledge_base(kb["kb_id"],user_prompt)
                            all_kb_content.extend(kb_content)
                            if settings["KBSettings"]["is_rerank"]:
                                all_kb_content = await rerank_knowledge_base(user_prompt,all_kb_content)
                        if all_kb_content:
                            all_kb_content = json.dumps(all_kb_content, ensure_ascii=False, indent=4)
                            kb_message = f"\n\n可参考的知识库内容：{all_kb_content}"
                            content_append(request.messages, 'user',  f"{kb_message}\n\n用户：{user_prompt}")
                            tool_chunk = {
                                "choices": [{
                                    "delta": {
                                        "tool_content": {"title": "query_knowledge_base", "content": str(all_kb_content), "type": "tool_result"},
                                    }
                                }]
                            }
                            yield f"data: {json.dumps(tool_chunk)}\n\n"
                if settings["KBSettings"]["when"] == "after_thinking" or settings["KBSettings"]["when"] == "both":
                    if kb_list:
                        kb_list_message = f"\n\n可调用的知识库列表：{json.dumps(kb_list, ensure_ascii=False)}"
                        content_append(request.messages, 'system', kb_list_message)
                else:
                    kb_list = []
                if settings['webSearch']['enabled'] or enable_web_search:
                    if settings['webSearch']['when'] == 'before_thinking' or settings['webSearch']['when'] == 'both':
                        chunk_dict = {
                            "id": "webSearch",
                            "choices": [
                                {
                                    "finish_reason": None,
                                    "index": 0,
                                    "delta": {
                                        "role":"assistant",
                                        "content": "",
                                        "tool_content": {"title": "web_search", "content": "", "type": "call"},
                                    }
                                }
                            ]
                        }
                        yield f"data: {json.dumps(chunk_dict)}\n\n"
                        if settings['webSearch']['engine'] == 'duckduckgo':
                            results = await DDGsearch(user_prompt)
                        elif settings['webSearch']['engine'] == 'searxng':
                            results = await searxng(user_prompt)
                        elif settings['webSearch']['engine'] == 'tavily':
                            results = await Tavily_search(user_prompt)
                        elif settings['webSearch']['engine'] == 'bing':
                            results = await Bing_search(user_prompt)
                        elif settings['webSearch']['engine'] == 'google':
                            results = await Google_search(user_prompt)
                        elif settings['webSearch']['engine'] == 'brave':
                            results = await Brave_search(user_prompt)
                        elif settings['webSearch']['engine'] == 'exa':
                            results = await Exa_search(user_prompt)
                        elif settings['webSearch']['engine'] == 'serper':
                            results = await Serper_search(user_prompt)
                        elif settings['webSearch']['engine'] == 'bochaai':
                            results = await bochaai_search(user_prompt)
                        if results:
                            content_append(request.messages, 'user',  f"\n\n联网搜索结果：{results}\n\n请根据联网搜索结果组织你的回答，并确保你的回答是准确的。")
                            tool_chunk = {
                                "choices": [{
                                    "delta": {
                                        "tool_content": {"title": "web_search", "content": str(results), "type": "tool_result"},
                                    }
                                }]
                            }
                            yield f"data: {json.dumps(tool_chunk)}\n\n"
                    if settings['webSearch']['when'] == 'after_thinking' or settings['webSearch']['when'] == 'both':
                        if settings['webSearch']['engine'] == 'duckduckgo':
                            tools.append(duckduckgo_tool)
                        elif settings['webSearch']['engine'] == 'searxng':
                            tools.append(searxng_tool)
                        elif settings['webSearch']['engine'] == 'tavily':
                            tools.append(tavily_tool)
                        elif settings['webSearch']['engine'] == 'bing':
                            tools.append(bing_tool)
                        elif settings['webSearch']['engine'] == 'google':
                            tools.append(google_tool)
                        elif settings['webSearch']['engine'] == 'brave':
                            tools.append(brave_tool)
                        elif settings['webSearch']['engine'] == 'exa':
                            tools.append(exa_tool)
                        elif settings['webSearch']['crawler'] == 'serper':
                            tools.append(serper_tool)
                        elif settings['webSearch']['crawler'] == 'bochaai':
                            tools.append(bochaai_tool)

                        if settings['webSearch']['crawler'] == 'jina':
                            tools.append(jina_crawler_tool)
                        elif settings['webSearch']['crawler'] == 'crawl4ai':
                            tools.append(Crawl4Ai_tool)
                        elif settings['webSearch']['crawler'] == 'firecrawl':
                            tools.append(firecrawl_tool)
                        elif settings['webSearch']['crawler'] == 'simpleRequest':
                            tools.append(simple_fetch_tool)
                        elif settings['webSearch']['crawler'] == 'mdnew':
                            tools.append(markdown_new_tool)
                if kb_list:
                    tools.append(kb_tool)

                # ==================== 获取权限模式 ====================
                cli_settings = settings.get("CLISettings", {})
                engine = cli_settings.get("engine", "")
                
                # 根据环境类型获取权限模式
                env_settings = _get_cli_engine_settings(settings, engine)
                
                permission_mode = env_settings.get("permissionMode", "default")
                if permission_mode == "cowork" and settings['CLISettings']['enabled'] and not request.is_sub_agent:
                    tools = []
                    tools.append(create_subtask_tool)
                    tools.append(query_tasks_tool)
                    tools.append(cancel_subtask_tool)
                    tools.append(start_subtask_tool)

                if request.is_sub_agent:
                    tools.append(finish_task_tool)
                # 如果是子智能体调用，或者指定了工具过滤规则
                if request.is_sub_agent or request.enable_tools or request.disable_tools:
                    original_tool_count = len(tools)
                    
                    # 1. Enable Tools 过滤（白名单模式）
                    if request.enable_tools and len(request.enable_tools) > 0:
                        # 只保留白名单中的工具
                        filtered_tools = []
                        enable_set = set(request.enable_tools)
                        
                        for tool in tools:
                            tool_name = tool.get("function", {}).get("name", "")
                            if tool_name in enable_set:
                                filtered_tools.append(tool)
                        
                        tools = filtered_tools
                        print(f"[Tool Filter] Enable mode: {original_tool_count} -> {len(tools)} tools (enabled: {request.enable_tools})")
                    
                    # 2. Disable Tools 过滤（黑名单模式）
                    elif request.disable_tools and len(request.disable_tools) > 0:
                        # 移除黑名单中的工具
                        disable_set = set(request.disable_tools)
                        filtered_tools = []
                        
                        for tool in tools:
                            tool_name = tool.get("function", {}).get("name", "")
                            if tool_name not in disable_set:
                                filtered_tools.append(tool)
                        
                        tools = filtered_tools
                        print(f"[Tool Filter] Disable mode: {original_tool_count} -> {len(tools)} tools (disabled: {request.disable_tools})")
                    
                    # 3. 子智能体默认策略（如果没有指定 enable/disable）
                    elif request.is_sub_agent:
                        # 子智能体默认只保留安全的工具，移除高风险操作
                        SUBAGENT_BLOCKED_TOOLS = [
                            # 阻止子智能体执行系统命令
                            "claude_code",
                            "openai_codex",
                            "qwen_code",
                            
                            # 阻止子智能体管理进程/端口
                            "manage_processes_tool",
                            "docker_manage_ports_tool",
                            "local_net_tool",
                            
                            # 阻止子智能体创建子任务（防止递归）
                            "create_subtask",
                            
                            # 阻止高风险的浏览器操作
                            "new_page",
                            "close_page",
                            "evaluate_script",
                            
                            # 阻止子智能体使用 Agent 调用（防止复杂的嵌套）
                            "agent_tool_call",
                            "todo_write_tool",
                        ]
                        
                        filtered_tools = []
                        blocked_count = 0
                        
                        for tool in tools:
                            tool_name = tool.get("function", {}).get("name", "")
                            if tool_name not in SUBAGENT_BLOCKED_TOOLS:
                                filtered_tools.append(tool)
                            else:
                                blocked_count += 1
                        
                        tools = filtered_tools
                        print(f"[SubAgent Safety] Blocked {blocked_count} dangerous tools: {original_tool_count} -> {len(tools)} tools")
            

                _inject_kernel_system_manifest(
                    request.messages,
                    settings,
                    tools,
                    source="stream",
                )

                print(tools)

                if settings['tools']['deepsearch']['enabled'] or enable_deep_research: 
                    deepsearch_messages = copy.deepcopy(request.messages)
                    content_append(deepsearch_messages, 'user',  "\n\n将用户提出的问题或给出的当前任务拆分成多个步骤，每一个步骤用一句简短的话概括即可，无需回答或执行这些内容，直接返回总结即可，但不能省略问题或任务的细节。如果用户输入的只是闲聊或者不包含任务和问题，直接把用户输入重复输出一遍即可。如果是非常简单的问题，也可以只给出一个步骤即可。一般情况下都是需要拆分成多个步骤的。")
                    
                    # 1. 开启 stream=True 进行流式请求
                    response = await client.chat.completions.create(
                        model=model,
                        messages=deepsearch_messages,
                        temperature=0.5,
                        stream=True,  # 新增
                        extra_body = extra_params, # 其他参数
                    )
                    
                    user_prompt = ""
                    # 生成一个唯一的 ID，用于让前端锁定同一个 UI 块进行内容更新
                    deepsearch_id = f"ds_{uuid.uuid4().hex[:8]}"
                    
                    # 2. 遍历流式响应并实时推给前端
                    async for chunk in response:
                        if not chunk.choices:
                            continue
                        
                        # 兼容不同版本的 openai 响应对象
                        chunk_dict = chunk.model_dump() if hasattr(chunk, 'model_dump') else chunk
                        delta = chunk_dict["choices"][0].get("delta", {})
                        content = delta.get("content", "")
                        
                        if content:
                            user_prompt += content
                            
                            # 3. 借用前端原有的 tool_progress 渲染机制
                            # 前端会自动创建类似 "调用deep_research工具" 的动态刷新框
                            progress_chunk = {
                                "choices": [{
                                    "delta": {
                                        "tool_progress": {
                                            "name": "deep_research",
                                            "arguments": user_prompt, # 传入不断累加的内容
                                            "tool_call_id": deepsearch_id
                                        }
                                    }
                                }]
                            }
                            yield f"data: {json.dumps(progress_chunk)}\n\n"
                    
                    content_append(request.messages, 'user',  f"\n\n如果用户没有提出问题或者任务，直接闲聊即可，如果用户提出了问题或者任务，任务描述不清晰或者你需要进一步了解用户的真实需求，你可以暂时不完成任务，而是分析需要让用户进一步明确哪些需求。")
                # 如果启用推理模型
                if settings['reasoner']['enabled'] or enable_thinking:
                    reasoner_messages = copy.deepcopy(request.messages)
                    if settings['tools']['deepsearch']['enabled'] or enable_deep_research: 
                        content_append(reasoner_messages, 'user',  f"\n\n可参考的步骤：{user_prompt}\n\n")
                        drs_msg = get_drs_stage(DRS_STAGE)
                        if drs_msg:
                            content_append(reasoner_messages, 'user',  f"\n\n{drs_msg}\n\n")
                    if tools:
                        content_append(reasoner_messages, 'system',  f"可用工具：{json.dumps(tools)}")
                    for modelProvider in settings['modelProviders']: 
                        if modelProvider['id'] == settings['reasoner']['selectedProvider']:
                            vendor = modelProvider['vendor']
                            break
                    msg = await images_add_in_messages(reasoner_messages, images,settings)
                    if vendor == 'Ollama':
                        # 流式调用推理模型
                        reasoner_stream = await reasoner_client.chat.completions.create(
                            model=settings['reasoner']['model'],
                            messages=msg,
                            stream=True,
                            temperature=settings['reasoner']['temperature'],
                            **reasoner_extra
                        )
                        full_reasoning = ""
                        buffer = ""  # 跨chunk的内容缓冲区
                        in_reasoning = False  # 是否在标签内
                        
                        async for chunk in reasoner_stream:
                            if not chunk.choices:
                                continue
                            chunk_dict = chunk.model_dump()
                            delta = chunk_dict["choices"][0].get("delta", {})
                            if delta:
                                current_content = delta.get("content", "")
                                buffer += current_content  # 累积到缓冲区
                                
                                # 实时处理缓冲区内容
                                while True:
                                    reasoning_content = delta.get("reasoning_content", "")
                                    if reasoning_content:
                                        full_reasoning += reasoning_content
                                    else:
                                        reasoning_content = delta.get("reasoning", "")
                                        if reasoning_content:
                                            delta['reasoning_content'] = reasoning_content
                                            full_reasoning += reasoning_content
                                    if reasoning_content:
                                        yield f"data: {json.dumps(chunk_dict)}\n\n"
                                        break
                                    if not in_reasoning:
                                        # 寻找开放标签
                                        open_match = OPEN_TAG_PATTERN.search(buffer)
                                        if open_match:
                                            # 开放标签前的内容（非思考内容）
                                            start_pos = open_match.start()
                                            non_reasoning = buffer[:start_pos]
                                            buffer = buffer[open_match.end():]
                                            in_reasoning = True
                                        else:
                                            break  # 无开放标签，保留后续处理
                                    else:
                                        # 寻找闭合标签
                                        close_match = CLOSE_TAG_PATTERN.search(buffer)
                                        if close_match:
                                            # 提取思考内容并构造响应
                                            end_pos = close_match.start()
                                            reasoning_part = buffer[:end_pos]
                                            chunk_dict["choices"][0]["delta"] = {
                                                "reasoning_content": reasoning_part,
                                                "content": ""  # 清除非思考内容
                                            }
                                            yield f"data: {json.dumps(chunk_dict)}\n\n"
                                            full_reasoning += reasoning_part
                                            buffer = buffer[close_match.end():]
                                            in_reasoning = False
                
                    else:
                        # 流式调用推理模型
                        reasoner_stream = await reasoner_client.chat.completions.create(
                            model=settings['reasoner']['model'],
                            messages=msg,
                            stream=True,
                            stop=settings['reasoner']['stop_words'],
                            temperature=settings['reasoner']['temperature'],
                            **reasoner_extra
                        )
                        full_reasoning = ""
                        # 处理推理模型的流式响应
                        async for chunk in reasoner_stream:
                            if not chunk.choices:
                                continue

                            chunk_dict = chunk.model_dump()
                            delta = chunk_dict["choices"][0].get("delta", {})
                            if delta:
                                reasoning_content = delta.get("reasoning_content", "")
                                if reasoning_content:
                                    full_reasoning += reasoning_content
                                else:
                                    reasoning_content = delta.get("reasoning", "")
                                    if reasoning_content:
                                        delta['reasoning_content'] = reasoning_content
                                        full_reasoning += reasoning_content
                                # 移除content字段，确保yield的内容中不包含content
                                if 'content' in delta:
                                    del delta['content']
                            yield f"data: {json.dumps(chunk_dict)}\n\n"

                    # 在推理结束后添加完整推理内容到消息
                    content_append(request.messages, 'assistant', f"<think>\n{full_reasoning}\n</think>")  # 可参考的推理过程
                # 状态跟踪变量
                in_reasoning = False
                reasoning_buffer = []
                content_buffer = []
                if settings['tools']['deepsearch']['enabled'] or enable_deep_research: 
                    content_append(request.messages, 'user',  f"\n\n可参考的步骤：{user_prompt}\n\n")
                    drs_msg = get_drs_stage(DRS_STAGE)
                    if drs_msg:
                        content_append(request.messages, 'user',  f"\n\n{drs_msg}\n\n")
                _consume_kernel_live_guidance(request, "stream_before_llm")
                msg = await images_add_in_messages(request.messages, images,settings)
                if request.top_p != 1 or settings['top_p'] != 1:
                    extra['top_p'] = request.top_p or settings['top_p']
                if tools:
                    response = await client.chat.completions.create(
                        model=model,
                        messages=msg,  # 添加图片信息到消息
                        temperature=request.temperature or settings['temperature'],
                        tools=tools,
                        stream=True,
                        extra_body = extra_params, # 其他参数
                        **extra
                    )
                else:
                    response = await client.chat.completions.create(
                        model=model,
                        messages=msg,  # 添加图片信息到消息
                        temperature=request.temperature or settings['temperature'],
                        stream=True,
                        extra_body = extra_params, # 其他参数
                        **extra
                    )
                tool_calls = []
                full_content = ""
                search_not_done = False
                search_task = ""
                is_tool_call = False
                async for chunk in response:
                    # --- [v0.5.3 P0-B] 检查是否被中断 ---
                    if _abort_event.is_set():
                        print(f"[AbortController] 流式请求被中断: {_stream_id}")
                        try:
                            await response.aclose()
                        except Exception:
                            pass
                        break
                    if not chunk.choices:
                        continue
                    choice = chunk.choices[0]
                    if choice.delta.tool_calls:  # function_calling
                        is_tool_call = True
                        for idx, tool_call in enumerate(choice.delta.tool_calls):
                            tool = choice.delta.tool_calls[idx]
                            if len(tool_calls) <= idx:
                                tool_calls.append(tool)
                                continue
                            if tool.function.arguments:
                                # function参数为流式响应，需要拼接
                                if tool_calls[idx].function.arguments:
                                    tool_calls[idx].function.arguments += tool.function.arguments
                                else:
                                    tool_calls[idx].function.arguments = tool.function.arguments
                            current_tool = tool_calls[idx]
                            if current_tool.function and current_tool.function.name:
                                progress_chunk = {
                                    "choices": [{
                                        "delta": {
                                            "tool_progress": {  # 新增字段，区别于最终的 tool_content
                                                "name": current_tool.function.name,
                                                "arguments": current_tool.function.arguments or "",
                                                "index": idx,
                                                "id": current_tool.id or f"call_{idx}"
                                            }
                                        }
                                    }]
                                }
                                yield f"data: {json.dumps(progress_chunk)}\n\n"
                    else:
                        if hasattr(choice.delta, "audio") and choice.delta.audio and is_tool_call == False:
                            # 只把 Base64 音频数据留在 delta 里，别动它
                            yield f"data: {chunk.model_dump_json()}\n\n"
                            continue
                        elif hasattr(choice.delta, "audio") and choice.delta.audio and is_tool_call == True:
                            continue
                        # 创建原始chunk的拷贝
                        chunk_dict = chunk.model_dump()
                        delta = chunk_dict["choices"][0]["delta"]
                        
                        # 初始化必要字段
                        delta.setdefault("content", "")
                        delta.setdefault("reasoning_content", "")
                        
                        # 优先处理 reasoning_content
                        if delta["reasoning_content"]:
                            yield f"data: {json.dumps(chunk_dict)}\n\n"
                            continue
                        if delta.get("reasoning", ""):
                            delta["reasoning_content"] = delta["reasoning"]
                            yield f"data: {json.dumps(chunk_dict)}\n\n"
                            continue

                        # 处理内容
                        current_content = delta["content"]
                        buffer = current_content
                        
                        while buffer:
                            if not in_reasoning:
                                # 寻找开始标签
                                open_match = OPEN_TAG_PATTERN.search(buffer)
                                if open_match:
                                    start_pos = open_match.start()
                                    # 处理开始标签前的内容
                                    content_buffer.append(buffer[:start_pos])
                                    # open_match.end() 自动计算了标签的准确长度，完美替代 len(open_tag)
                                    buffer = buffer[open_match.end():] 
                                    in_reasoning = True
                                else:
                                    content_buffer.append(buffer)
                                    buffer = ""
                            else:
                                # 寻找结束标签
                                close_match = CLOSE_TAG_PATTERN.search(buffer)
                                if close_match:
                                    end_pos = close_match.start()
                                    # 处理思考内容
                                    reasoning_buffer.append(buffer[:end_pos])
                                    buffer = buffer[close_match.end():]
                                    in_reasoning = False
                                else:
                                    reasoning_buffer.append(buffer)
                                    buffer = ""

                        # 构造新的delta内容
                        new_content = "".join(content_buffer)
                        new_reasoning = "".join(reasoning_buffer)
                        
                        # 更新chunk内容
                        delta["content"] = new_content.strip("\x00")  # 保留未完成内容
                        delta["reasoning_content"] = new_reasoning.strip("\x00") or None
                        
                        # 重置缓冲区但保留未完成部分
                        if in_reasoning:
                            # 按照任何支持的开标签进行切割
                            content_buffer = [OPEN_TAG_PATTERN.split(new_content)[-1]] 
                        else:
                            content_buffer = []
                        reasoning_buffer = []
                        yield f"data: {json.dumps(chunk_dict)}\n\n"
                        full_content += delta.get("content") or "" 
                # 最终flush未完成内容
                if content_buffer or reasoning_buffer:
                    final_chunk = {
                        "choices": [{
                            "delta": {
                                "content": "".join(content_buffer),
                                "reasoning_content": "".join(reasoning_buffer)
                            }
                        }]
                    }
                    yield f"data: {json.dumps(final_chunk)}\n\n"
                    full_content += final_chunk["choices"][0]["delta"].get("content", "")
                if not tool_calls:
                    # 将响应添加到消息列表
                    content_append(request.messages, 'assistant', full_content)
                # 工具和深度搜索
                if tool_calls:
                    print("tool_calls",tool_calls)
                    pass
                elif settings['tools']['deepsearch']['enabled'] or enable_deep_research: 
                    search_prompt = get_drs_stage_system_message(DRS_STAGE,user_prompt,full_content)
                    response = await client.chat.completions.create(
                        model=model,
                        messages=[
                            {
                            "role": "system",
                            "content": source_prompt,
                            },
                            {
                            "role": "user",
                            "content": search_prompt,
                            }
                        ],
                        temperature=0.5,
                        extra_body = extra_params, # 其他参数
                    )
                    response_content = response.choices[0].message.content
                    # 用re 提取```json 包裹json字符串 ```
                    if "```json" in response_content:
                        try:
                            response_content = re.search(r'```json(.*?)```', response_content, re.DOTALL).group(1)
                        except:
                            # 用re 提取```json 之后的内容
                            response_content = re.search(r'```json(.*?)', response_content, re.DOTALL).group(1)
                    try:
                        response_content = json.loads(response_content)
                    except json.JSONDecodeError:
                        search_chunk = {
                            "choices": [{
                                "delta": {
                                    "tool_content": {"title": f"❌{await t('task_error')}", "content": ""}
                                }
                            }]
                        }
                        yield f"data: {json.dumps(search_chunk)}\n\n"
                    if response_content["status"] == "done":
                        search_chunk = {
                            "choices": [{
                                "delta": {
                                   "tool_content": {"title": f"✅{await t('task_done')}", "content": ""},
                                }
                            }]
                        }
                        yield f"data: {json.dumps(search_chunk)}\n\n"
                        search_not_done = False
                    elif response_content["status"] == "not_done":
                        search_chunk = {
                            "choices": [{
                                "delta": {
                                    "tool_content": {"title": f"❎{await t('task_not_done')}", "content": ""},
                                }
                            }]
                        }
                        yield f"data: {json.dumps(search_chunk)}\n\n"
                        search_not_done = True
                        search_task = response_content["unfinished_task"]
                        task_prompt = f"请继续完成初始任务中未完成的任务：\n\n{search_task}\n\n初始任务：{user_prompt}\n\n最后，请给出完整的初始任务的最终结果。"
                        request.messages.append(
                            {
                                "role": "assistant",
                                "content": full_content,
                                "reasoning_content": "",
                            }
                        )
                        request.messages.append(
                            {
                                "role": "user",
                                "content": task_prompt,
                            }
                        )
                    elif response_content["status"] == "need_more_info":
                        DRS_STAGE = 2
                        search_chunk = {
                            "choices": [{
                                "delta": {
                                    "tool_content": {"title": f"❓{await t('task_need_more_info')}", "content": ""}
                                }
                            }]
                        }
                        yield f"data: {json.dumps(search_chunk)}\n\n"
                        search_not_done = False
                    elif response_content["status"] == "need_work":
                        DRS_STAGE = 2
                        search_chunk = {
                            "choices": [{
                                "delta": {
                                    "tool_content": {"title": f"🔍{await t('enter_search_stage')}", "content": ""}
                                }
                            }]
                        }
                        yield f"data: {json.dumps(search_chunk)}\n\n"
                        search_not_done = True
                        drs_msg = get_drs_stage(DRS_STAGE)
                        request.messages.append(
                            {
                                "role": "assistant",
                                "content": full_content,
                                "reasoning_content": "",
                            }
                        )
                        request.messages.append(
                            {
                                "role": "user",
                                "content": drs_msg,
                                "reasoning_content": "",
                            }
                        )
                    elif response_content["status"] == "need_more_work":
                        DRS_STAGE = 2
                        search_chunk = {
                            "choices": [{
                                "delta": {
                                    "tool_content": {"title": f"🔍{await t('need_more_work')}", "content": ""}
                                }
                            }]
                        }
                        yield f"data: {json.dumps(search_chunk)}\n\n"
                        search_not_done = True
                        search_task = response_content["unfinished_task"]
                        task_prompt = f"请继续查询如下信息：\n\n{search_task}\n\n初始任务：{user_prompt}\n\n"
                        request.messages.append(
                            {
                                "role": "assistant",
                                "content": full_content,
                                "reasoning_content": "",
                            }
                        )
                        request.messages.append(
                            {
                                "role": "user",
                                "content": task_prompt,
                            }
                        )
                    elif response_content["status"] == "answer":
                        DRS_STAGE = 3
                        search_chunk = {
                            "choices": [{
                                "delta": {
                                    "tool_content": {"title": f"⭐{await t('enter_answer_stage')}", "content": ""}
                                }
                            }]
                        }
                        yield f"data: {json.dumps(search_chunk)}\n\n"
                        search_not_done = True
                        drs_msg = get_drs_stage(DRS_STAGE)
                        request.messages.append(
                            {
                                "role": "assistant",
                                "content": full_content,
                                "reasoning_content": "",
                            }
                        )
                        request.messages.append(
                            {
                                "role": "user",
                                "content": drs_msg,
                                "reasoning_content": "",
                            }
                        )

                reasoner_messages = copy.deepcopy(request.messages)
                while tool_calls or search_not_done:
                    full_content = ""
                    if tool_calls:
                        response_content = tool_calls[0].function
                        print(response_content)
                        modified_data = '[' + response_content.arguments.replace('}{', '},{') + ']'
                        data_list = json.loads(modified_data)
                        
                        # 【修复 1】显式发送 "call" 事件，锁定 UI 状态并同步 ID
                        # 这告诉前端：参数接收完毕，确认调用，并绑定 ID
                        call_confirm_chunk = {
                            "choices": [{
                                "delta": {
                                    "tool_call_id": tool_calls[0].id, # 关键：带上 ID
                                    "tool_content": {
                                        "title": response_content.name,
                                        "content": modified_data, # 发送完整参数
                                        "type": "call"
                                    }
                                }
                            }]
                        }
                        yield f"data: {json.dumps(call_confirm_chunk)}\n\n"

                        modified_tool = f"{await t("sendArg")}{data_list[0]}"
                        
                        if settings['tools']['asyncTools']['enabled']:
                            # ... 异步工具逻辑保持不变 ...
                            tool_id = uuid.uuid4()
                            async_tool_id = f"{response_content.name}_{tool_id}"
                            chunk_dict = {
                                "id": "agentParty",
                                "choices": [
                                    {
                                        "finish_reason": None,
                                        "index": 0,
                                        "delta": {
                                            "role":"assistant",
                                            "content": "",
                                            "async_tool_id": async_tool_id
                                        }
                                    }
                                ]
                            }
                            yield f"data: {json.dumps(chunk_dict)}\n\n"
                            asyncio.create_task(
                                execute_tool(
                                    async_tool_id,
                                    response_content.name,
                                    data_list[0],
                                    settings,
                                    user_prompt
                                )
                            )
                            async with async_tools_lock:
                                async_tools[async_tool_id] = {
                                    "status": "pending",
                                    "result": None,
                                    "name":response_content.name,
                                    "parameters":data_list[0]
                                }
                            results = f"{response_content.name}tool has been successfully launched. It will take some time to run, and the results will be provided in the next round of conversation." # 保持原样
                        else:
                            results = await dispatch_tool(response_content.name, data_list[0], settings)

                        if results is None:
                            # 保持原样，但建议加上 ID
                            chunk = {
                                "id": "extra_tools",
                                "choices": [
                                    {
                                        "index": 0,
                                        "delta": {
                                            "role":"assistant",
                                            "content": "",
                                            "tool_calls": modified_data,
                                        }
                                    }
                                ]
                            }
                            yield f"data: {json.dumps(chunk)}\n\n"
                            break

                        if response_content.name in ["query_knowledge_base"] and type(results) == list:
                            if settings["KBSettings"]["is_rerank"]:
                                results = await rerank_knowledge_base(user_prompt, results)
                            results = json.dumps(results, ensure_ascii=False, indent=4)
                        protocol_tool_name = sanitize_tool_name(response_content.name, "tool")
                        
                        # 更新 messages 历史 (保持不变)
                        request.messages.append({
                            "tool_calls": [{
                                "id": tool_calls[0].id,
                                "function": {
                                    "arguments": json.dumps(data_list[0]),
                                    "name": protocol_tool_name,
                                },
                                "type": tool_calls[0].type,
                            }],
                            "role": "assistant",
                            "content": "",
                            "reasoning_content": "",
                        })

                        # 【修复 2】发送结果时，务必带上 tool_call_id
                        if not isinstance(results, AsyncIterator):
                            result_chunk = {
                                "choices": [{
                                    "delta": {
                                        "tool_call_id": tool_calls[0].id, # 关键：匹配之前的 Call ID
                                        "tool_content": {
                                            "title": response_content.name,
                                            "content": str(results),
                                            "type": "tool_result"
                                        }
                                    }
                                }]
                            }
                            yield f"data: {json.dumps(result_chunk)}\n\n"
                        else:  
                            # 流式工具结果处理 (AsyncIterator)
                            buffer = []
                            first = True
                            async for chunk in results:
                                buffer.append(chunk)
                                if first:
                                    # 第一帧带 title
                                    stream_chunk = {
                                        "choices": [{
                                            "delta": {
                                                "tool_call_id": tool_calls[0].id, # 关键
                                                "tool_content": {
                                                    "title": response_content.name,
                                                    "content": chunk,
                                                    "type": "tool_result_stream"
                                                }
                                            }
                                        }]
                                    }
                                    yield f"data: {json.dumps(stream_chunk)}\n\n"
                                    first = False
                                else:
                                    # 后续帧
                                    stream_chunk = {
                                        "choices": [{
                                            "delta": {
                                                "tool_call_id": tool_calls[0].id, # 关键
                                                "tool_content": {
                                                    "title": "tool_result_stream",
                                                    "content": chunk,
                                                    "type": "tool_result_stream"
                                                }
                                            }
                                        }]
                                    }
                                    yield f"data: {json.dumps(stream_chunk)}\n\n"
                            results = "".join(buffer)

                        request.messages.append(
                            {
                                "role": "tool",
                                "tool_call_id": tool_calls[0].id,
                                "name": protocol_tool_name,
                                "content": str("".join(results)),
                            }
                        )

                        max_rounds = settings.get("max_rounds", 0)

                        if max_rounds > 0 and request.messages:
                            def get_role(msg):
                                return msg.get("role") if isinstance(msg, dict) else msg.role
                            
                            def has_tool_calls(msg):
                                """检查assistant消息是否包含工具调用"""
                                if get_role(msg) != "assistant":
                                    return False
                                if isinstance(msg, dict):
                                    return bool(msg.get("tool_calls"))
                                return bool(getattr(msg, "tool_calls", None))
                            
                            def get_tool_call_id(msg):
                                """获取tool消息的tool_call_id"""
                                if isinstance(msg, dict):
                                    return msg.get("tool_call_id")
                                return getattr(msg, "tool_call_id", None)

                            system_messages = []
                            chat_messages = request.messages

                            # 1. 分离system消息
                            if chat_messages and get_role(chat_messages[0]) == "system":
                                system_messages = [chat_messages[0]]
                                chat_messages = chat_messages[1:]

                            # 2. 从后向前截断，确保工具调用链完整
                            # 注意：最后一轮是 tool 消息，需要保留完整的 (assistant->tool) 对
                            retain_count = max_rounds * 2 + 1  # user-assistant 对，+1 给可能的 pending user
                            
                            if len(chat_messages) > retain_count:
                                start_idx = len(chat_messages) - retain_count
                                
                                # 边界检查1: 不能以 tool 或 assistant(with tool_calls) 开始
                                while start_idx > 0:
                                    current_msg = chat_messages[start_idx]
                                    current_role = get_role(current_msg)
                                    
                                    # 情况A: 不能以 tool 开始（tool必须有前置的assistant tool_calls）
                                    if current_role == "tool":
                                        start_idx -= 1
                                        continue
                                        
                                    # 情况B: 不能以带tool_calls的assistant开始（必须有前置user）
                                    if has_tool_calls(current_msg):
                                        start_idx -= 1
                                        continue
                                        
                                    # 情况C: 不能以普通assistant开始（必须有前置user）
                                    if current_role == "assistant":
                                        start_idx -= 1
                                        continue
                                        
                                    # 现在 start_idx 指向的是 user，检查是否完整
                                    break
                                
                                # 边界检查2: 确保工具调用链完整
                                # 扫描从 start_idx 开始，如果发现 assistant 有 tool_calls，
                                # 确保后面有对应的 tool 响应（工具链可能跨越多条消息）
                                i = start_idx
                                while i < len(chat_messages):
                                    msg = chat_messages[i]
                                    if has_tool_calls(msg):
                                        # 收集这个 assistant 调用的所有 tool_call_id
                                        assistant_tool_ids = set()
                                        if isinstance(msg, dict):
                                            for tc in msg.get("tool_calls", []):
                                                tc_id = tc.get("id") if isinstance(tc, dict) else tc.id
                                                if tc_id:
                                                    assistant_tool_ids.add(tc_id)
                                        else:
                                            for tc in getattr(msg, "tool_calls", []):
                                                tc_id = getattr(tc, "id", None)
                                                if tc_id:
                                                    assistant_tool_ids.add(tc_id)
                                        
                                        # 检查后续的 tool 消息
                                        j = i + 1
                                        found_tool_ids = set()
                                        while j < len(chat_messages) and get_role(chat_messages[j]) == "tool":
                                            found_tool_ids.add(get_tool_call_id(chat_messages[j]))
                                            j += 1
                                        
                                        # 如果工具响应不全，需要前移 start_idx
                                        missing_tools = assistant_tool_ids - found_tool_ids
                                        if missing_tools and i > start_idx:
                                            # 前移 start_idx 到更早的位置，确保包含完整的工具链
                                            start_idx = i
                                            # 重置扫描，从新的 start_idx 重新开始
                                            i = start_idx
                                            continue
                                    i += 1
                                
                                # 应用截断
                                chat_messages = chat_messages[start_idx:]
                                
                                # 最终保险：确保第一条消息是 user 或 assistant（不能是 tool）
                                # 因为最后一轮是 tool，但截断后的第一条不能是 tool
                                while chat_messages and get_role(chat_messages[0]) == "tool":
                                    # 如果第一条是 tool，向前寻找对应的 assistant
                                    # 这里简单处理：移除第一条 tool 并继续检查
                                    chat_messages = chat_messages[1:]
                                
                                # 另一种保险：如果第一条是带 tool_calls 的 assistant，也需要保留完整的链
                                # 但上面的边界检查已经处理了这种情况
                            
                            # 重新组装消息
                            request.messages = system_messages + chat_messages

                        # --- [v0.5.3 P0-A] 工具循环内上下文压缩 ---
                        if _kernel_context_compression_enabled(settings):
                            try:
                                _original_messages_for_tool_compaction = copy.deepcopy(request.messages)
                                _compactor2 = ContextCompactor(model_id=model, max_tool_result_chars=8000, reserve_for_output=4096)
                                _cr2 = _compactor2.compact(request.messages)
                                if _cr2.removed_messages > 0 or _cr2.trimmed_tool_results > 0:
                                    request.messages = _cr2.messages
                                    _persist_context_compaction_memory(
                                        settings,
                                        _original_messages_for_tool_compaction,
                                        _cr2,
                                        model=model,
                                        source="stream_tool_loop",
                                    )
                                    print(f"[ContextCompactor/ToolLoop] {_cr2.original_tokens}→{_cr2.compacted_tokens} tokens")
                            except Exception as _ce2:
                                pass

                        reasoner_messages.append(
                            {
                                "role": "assistant",
                                "content": str(response_content),
                                "reasoning_content": "",
                            }
                        )
                        reasoner_messages.append(
                            {
                                "role": "user",
                                "content": f"{response_content.name}工具结果："+str(results),
                                "reasoning_content": "",
                            }
                        )

                        # 【核心修复】：如果工具返回的是审批请求，立即跳出循环，结束当前流，等待前端手动调用恢复
                        if isinstance(results, str) and '"approval_required"' in results:
                            try:
                                parsed_res = json.loads(results)
                                if parsed_res.get("type") == "approval_required":
                                    break  # 立即跳出 while 循环，不再进行下一轮 LLM 推理
                            except Exception:
                                pass
                    # 如果启用推理模型
                    if settings['reasoner']['enabled'] or enable_thinking:
                        if tools:
                            content_append(reasoner_messages, 'system',  f"可用工具：{json.dumps(tools)}")
                        for modelProvider in settings['modelProviders']: 
                            if modelProvider['id'] == settings['reasoner']['selectedProvider']:
                                vendor = modelProvider['vendor']
                                break
                        msg = await images_add_in_messages(reasoner_messages, images,settings)
                        if vendor == 'Ollama':
                            # 流式调用推理模型
                            reasoner_stream = await reasoner_client.chat.completions.create(
                                model=settings['reasoner']['model'],
                                messages=msg,
                                stream=True,
                                temperature=settings['reasoner']['temperature']
                            )
                            full_reasoning = ""
                            buffer = ""  # 跨chunk的内容缓冲区
                            in_reasoning = False  # 是否在标签内
                            
                            async for chunk in reasoner_stream:
                                if not chunk.choices:
                                    continue
                                chunk_dict = chunk.model_dump()
                                delta = chunk_dict["choices"][0].get("delta", {})
                                if delta:
                                    current_content = delta.get("content", "")
                                    buffer += current_content  # 累积到缓冲区
                                    
                                    # 实时处理缓冲区内容
                                    while True:
                                        reasoning_content = delta.get("reasoning_content", "")
                                        if reasoning_content:
                                            full_reasoning += reasoning_content
                                        else:
                                            reasoning_content = delta.get("reasoning", "")
                                            if reasoning_content:
                                                delta['reasoning_content'] = reasoning_content
                                                full_reasoning += reasoning_content
                                        if reasoning_content:
                                            yield f"data: {json.dumps(chunk_dict)}\n\n"
                                            break
                                        if not in_reasoning:
                                            # 寻找开放标签
                                            open_match = OPEN_TAG_PATTERN.search(buffer)
                                            if open_match:
                                                # 开放标签前的内容（非思考内容）
                                                start_pos = open_match.start()
                                                non_reasoning = buffer[:start_pos]
                                                buffer = buffer[open_match.end():]
                                                in_reasoning = True
                                            else:
                                                break  # 无开放标签，保留后续处理
                                        else:
                                            # 寻找闭合标签
                                            close_match = CLOSE_TAG_PATTERN.search(buffer)
                                            if close_match:
                                                # 提取思考内容并构造响应
                                                end_pos = close_match.start()
                                                reasoning_part = buffer[:end_pos]
                                                chunk_dict["choices"][0]["delta"] = {
                                                    "reasoning_content": reasoning_part,
                                                    "content": ""  # 清除非思考内容
                                                }
                                                yield f"data: {json.dumps(chunk_dict)}\n\n"
                                                full_reasoning += reasoning_part
                                                buffer = buffer[close_match.end():]
                                                in_reasoning = False
                        else:
                            # 流式调用推理模型
                            reasoner_stream = await reasoner_client.chat.completions.create(
                                model=settings['reasoner']['model'],
                                messages=msg,
                                stream=True,
                                stop=settings['reasoner']['stop_words'],
                                temperature=settings['reasoner']['temperature']
                            )
                            full_reasoning = ""
                            # 处理推理模型的流式响应
                            async for chunk in reasoner_stream:
                                if not chunk.choices:
                                    continue

                                chunk_dict = chunk.model_dump()
                                delta = chunk_dict["choices"][0].get("delta", {})
                                if delta:
                                    reasoning_content = delta.get("reasoning_content", "")
                                    if reasoning_content:
                                        full_reasoning += reasoning_content
                                    else:
                                        reasoning_content = delta.get("reasoning", "")
                                        if reasoning_content:
                                            delta['reasoning_content'] = reasoning_content
                                            full_reasoning += reasoning_content
                                    # 移除content字段，确保yield的内容中不包含content
                                    if 'content' in delta:
                                        del delta['content']
                                yield f"data: {json.dumps(chunk_dict)}\n\n"

                        # 在推理结束后添加完整推理内容到消息
                        content_append(request.messages, 'assistant', f"<think>\n{full_reasoning}\n</think>") # 可参考的推理过程
                    
                    vision_control_enabled = settings.get('visionControlSettings', {}).get('enabled', False)
                    if vision_control_enabled and (results =='[Getting screenshot]' or settings.get('visionControlSettings', {}).get('desktopVision', False)):
                        try:
                            import pyautogui
                            # 必须从你的工具类中引入设置区域的方法
                            from py.computer_use_tool import set_screen_region
                            
                            v_settings = settings.get('visionControlSettings', {})
                            is_grid_enabled = v_settings.get('isEnableGrid', False)
                            is_full_screen = v_settings.get('isFullScreen', True)
                            # ScreenSize 格式为 [x, y, width, height]
                            screen_size = v_settings.get('ScreenSize', [0, 0, 1920, 1080])
                            time.sleep(0.5) # 等待一下，确保截图工具已经准备好
                            print(f"正在执行桌面截图 (全屏: {is_full_screen}, 网格: {is_grid_enabled})...")
                            
                            # --- 1. 区域判定与捕获 ---
                            if not is_full_screen and len(screen_size) == 4:
                                # 局部截图模式
                                rx, ry, rw, rh = map(int, screen_size)
                                # 关键：告诉鼠标工具，接下来的 0-1000 坐标要映射到这个局部矩形
                                set_screen_region((rx, ry, rw, rh))
                                
                                # 逻辑尺寸即为选区尺寸
                                logical_width, logical_height = rw, rh
                                # 捕获指定区域
                                screenshot = await asyncio.to_thread(pyautogui.screenshot, region=(rx, ry, rw, rh))
                            else:
                                # 全屏截图模式
                                set_screen_region(None) # 恢复全屏映射
                                logical_width, logical_height = pyautogui.size()
                                screenshot = await asyncio.to_thread(pyautogui.screenshot)
                            
                            # --- 2. 强制 Resize 到逻辑坐标系 (解决 Windows 缩放偏移) ---
                            if screenshot.width != logical_width or screenshot.height != logical_height:
                                screenshot = await asyncio.to_thread(
                                    screenshot.resize, (logical_width, logical_height), Image.Resampling.LANCZOS
                                )
                            
                            # 限制传输图片大小，平衡 Token 消耗
                            target_w, target_h = scale_to_fit(logical_width, logical_height, 1280, 720)
                            if screenshot.width > target_w or screenshot.height > target_h:
                                screenshot = await asyncio.to_thread(
                                    screenshot.resize, (target_w, target_h), Image.Resampling.LANCZOS
                                )

                            # --- 3. 绘制视觉反馈 (红点/线) ---
                            action_feedback_hint = ""
                            if results and "[LAST_ACTION:" in str(results):
                                screenshot = await asyncio.to_thread(draw_action_feedback, screenshot, str(results))
                                action_feedback_hint = (
                                    " Notice: The colored markers show your PREVIOUS actions relative to this view. "
                                    "Cyan = Click. Blue = Double Click. Green-Yellow = Drag."
                                )

                            # --- 4. 绘制网格辅助 ---
                            if is_grid_enabled:
                                display_image = await asyncio.to_thread(draw_grid_on_image, screenshot.copy(), grid_spacing=10)
                                region_text = "partial region" if not is_full_screen else "full desktop"
                                grid_hint = f"\n\n【system info】Screenshot of {region_text} with coordinate grid (0-1000) injected. Use coordinates for precise clicking within this view.\n{action_feedback_hint}"
                            else:
                                display_image = screenshot
                                grid_hint = f"\n\n【system info】Current screenshot injected.\n{action_feedback_hint}"
                            
                            # --- 5. 保存并注入消息 ---
                            desktop_img_name = f"desktop_view_{uuid.uuid4().hex}.png"
                            desktop_img_path = os.path.join(UPLOAD_FILES_DIR, desktop_img_name)
                            await asyncio.to_thread(display_image.save, desktop_img_path, optimize=True)
                            
                            desktop_url = f"{fastapi_base_url}uploaded_files/{desktop_img_name}"
                            
                            current_user_msg = {
                                "role": "user",
                                "content": [
                                    {"type": "text", "text": '[Getting screenshot]' + grid_hint},
                                    {"type": "image_url", "image_url": {"url": desktop_url}}
                                ]
                            }
                            request.messages.append(current_user_msg)
                            
                            # --- 6. 清理旧截图 ---
                            if v_settings.get('onlyNewScreen', False):
                                for msg in request.messages[:-1]:
                                    if isinstance(msg.get('content'), list):
                                        msg['content'] = [item for item in msg['content'] if item.get('type') != 'image_url']
                                        if len(msg['content']) == 1 and msg['content'][0].get('type') == 'text':
                                            msg['content'] = msg['content'][0]['text']
                                        elif len(msg['content']) == 0:
                                            msg['content'] = ""

                        except Exception as e:
                            print(f"后端桌面截图失败: {e}")
                            
                        images = await images_in_messages(request.messages, fastapi_base_url)
                        request.messages = await message_without_images(request.messages)
                    _consume_kernel_live_guidance(request, "stream_tool_loop_before_llm")
                    msg = await images_add_in_messages(request.messages, images, settings)
                    if request.top_p != 1 or settings['top_p'] != 1:
                        extra['top_p'] = request.top_p or settings['top_p']
                    if tools:
                        response = await client.chat.completions.create(
                            model=model,
                            messages=msg,  # 添加图片信息到消息
                            temperature=request.temperature or settings['temperature'],
                            tools=tools,
                            stream=True,
                            extra_body = extra_params, # 其他参数
                            **extra
                        )
                    else:
                        response = await client.chat.completions.create(
                            model=model,
                            messages=msg,  # 添加图片信息到消息
                            temperature=request.temperature or settings['temperature'],
                            stream=True,
                            extra_body = extra_params, # 其他参数
                            **extra
                        )
                    tool_calls = []
                    async for chunk in response:
                        if not chunk.choices:
                            continue
                        if chunk.choices:
                            choice = chunk.choices[0]
                            if hasattr(choice.delta, "audio") and choice.delta.audio:
                                # 只把 Base64 音频数据留在 delta 里，别动它
                                yield f"data: {chunk.model_dump_json()}\n\n"
                                continue
                            if choice.delta.tool_calls:  # function_calling
                                for idx, tool_call in enumerate(choice.delta.tool_calls):
                                    tool = choice.delta.tool_calls[idx]
                                    if len(tool_calls) <= idx:
                                        tool_calls.append(tool)
                                        continue
                                    if tool.function.arguments:
                                        # function参数为流式响应，需要拼接
                                        if tool_calls[idx].function.arguments:
                                            tool_calls[idx].function.arguments += tool.function.arguments
                                        else:
                                            tool_calls[idx].function.arguments = tool.function.arguments
                                current_tool = tool_calls[idx]
                                if current_tool.function and current_tool.function.name:
                                    progress_chunk = {
                                        "choices": [{
                                            "delta": {
                                                "tool_progress": {  # 新增字段，区别于最终的 tool_content
                                                    "name": current_tool.function.name,
                                                    "arguments": current_tool.function.arguments or "",
                                                    "index": idx,
                                                    "id": current_tool.id or f"call_{idx}"
                                                }
                                            }
                                        }]
                                    }
                                    yield f"data: {json.dumps(progress_chunk)}\n\n"
                            else:
                                # 创建原始chunk的拷贝
                                chunk_dict = chunk.model_dump()
                                delta = chunk_dict["choices"][0]["delta"]
                                
                                # 初始化必要字段
                                delta.setdefault("content", "")
                                delta.setdefault("reasoning_content", "")

                                # 优先处理 reasoning_content
                                if delta["reasoning_content"]:
                                    yield f"data: {json.dumps(chunk_dict)}\n\n"
                                    continue
                                if delta.get("reasoning", ""):
                                    delta["reasoning_content"] = delta["reasoning"]
                                    yield f"data: {json.dumps(chunk_dict)}\n\n"
                                    continue
                                # 处理内容
                                current_content = delta["content"]
                                buffer = current_content
                                
                                while buffer:
                                    if not in_reasoning:
                                        # 寻找开始标签
                                        open_match = OPEN_TAG_PATTERN.search(buffer)
                                        if open_match:
                                            start_pos = open_match.start()
                                            # 处理开始标签前的内容
                                            content_buffer.append(buffer[:start_pos])
                                            # open_match.end() 自动计算了标签的准确长度，完美替代 len(open_tag)
                                            buffer = buffer[open_match.end():] 
                                            in_reasoning = True
                                        else:
                                            content_buffer.append(buffer)
                                            buffer = ""
                                    else:
                                        # 寻找结束标签
                                        close_match = CLOSE_TAG_PATTERN.search(buffer)
                                        if close_match:
                                            end_pos = close_match.start()
                                            # 处理思考内容
                                            reasoning_buffer.append(buffer[:end_pos])
                                            buffer = buffer[close_match.end():]
                                            in_reasoning = False
                                        else:
                                            reasoning_buffer.append(buffer)
                                            buffer = ""

                                        # 构造新的delta内容
                                        new_content = "".join(content_buffer)
                                        new_reasoning = "".join(reasoning_buffer)
                                        
                                        # 更新chunk内容
                                        delta["content"] = new_content.strip("\x00")  # 保留未完成内容
                                        delta["reasoning_content"] = new_reasoning.strip("\x00") or None
                                        
                                        # 重置缓冲区但保留未完成部分
                                        if in_reasoning:
                                            # 按照任何支持的开标签进行切割
                                            content_buffer = [OPEN_TAG_PATTERN.split(new_content)[-1]] 
                                        else:
                                            content_buffer = []
                                        reasoning_buffer = []
                                        
                                        yield f"data: {json.dumps(chunk_dict)}\n\n"
                                        full_content += delta.get("content") or "" 
                            
                    # 最终flush未完成内容
                    if content_buffer or reasoning_buffer:
                        final_chunk = {
                            "choices": [{
                                "delta": {
                                    "content": "".join(content_buffer),
                                    "reasoning_content": "".join(reasoning_buffer)
                                }
                            }]
                        }
                        yield f"data: {json.dumps(final_chunk)}\n\n"
                        full_content += final_chunk["choices"][0]["delta"].get("content", "")
                    if not tool_calls:
                        # 将响应添加到消息列表
                        content_append(request.messages, 'assistant', full_content)
                    # 工具和深度搜索
                    if tool_calls:
                        pass
                    elif settings['tools']['deepsearch']['enabled'] or enable_deep_research: 
                        search_prompt = get_drs_stage_system_message(DRS_STAGE,user_prompt,full_content)
                        response = await client.chat.completions.create(
                            model=model,
                            messages=[                        
                                {
                                "role": "system",
                                "content": source_prompt,
                                },
                                {
                                "role": "user",
                                "content": search_prompt,
                                }
                            ],
                            temperature=0.5,
                            extra_body = extra_params, # 其他参数
                        )
                        response_content = response.choices[0].message.content
                        if response_content is None:
                            response_content = ""
                        # 用re 提取```json 包裹json字符串 ```
                        if "```json" in response_content:
                            try:
                                response_content = re.search(r'```json(.*?)```', response_content, re.DOTALL).group(1)
                            except:
                                # 用re 提取```json 之后的内容
                                response_content = re.search(r'```json(.*?)', response_content, re.DOTALL).group(1)
                        try:
                            response_content = json.loads(response_content)
                        except json.JSONDecodeError:
                            search_chunk = {
                                "choices": [{
                                    "delta": {
                                        "tool_content": {"title": f"❌{await t('task_error')}", "content": ""}
                                    }
                                }]
                            }
                            yield f"data: {json.dumps(search_chunk)}\n\n"
                        if response_content["status"] == "done":
                            search_chunk = {
                                "choices": [{
                                    "delta": {
                                        "tool_content": {"title": f"✅{await t('task_done')}", "content": ""}
                                    }
                                }]
                            }
                            yield f"data: {json.dumps(search_chunk)}\n\n"
                            search_not_done = False
                        elif response_content["status"] == "not_done":
                            search_chunk = {
                                "choices": [{
                                    "delta": {
                                        "tool_content": {"title": f"❎{await t('task_not_done')}", "content": ""}
                                    }
                                }]
                            }
                            yield f"data: {json.dumps(search_chunk)}\n\n"
                            search_not_done = True
                            search_task = response_content["unfinished_task"]
                            task_prompt = f"请继续完成初始任务中未完成的任务：\n\n{search_task}\n\n初始任务：{user_prompt}\n\n最后，请给出完整的初始任务的最终结果。"
                            request.messages.append(
                                {
                                    "role": "assistant",
                                    "content": full_content,
                                    "reasoning_content": "",
                                }
                            )
                            request.messages.append(
                                {
                                    "role": "user",
                                    "content": task_prompt,
                                }
                            )
                        elif response_content["status"] == "need_more_info":
                            DRS_STAGE = 2
                            search_chunk = {
                                "choices": [{
                                    "delta": {
                                        "tool_content": {"title": f"❓{await t('task_need_more_info')}", "content": ""}
                                    }
                                }]
                            }
                            yield f"data: {json.dumps(search_chunk)}\n\n"
                            search_not_done = False
                        elif response_content["status"] == "need_work":
                            DRS_STAGE = 2
                            search_chunk = {
                                "choices": [{
                                    "delta": {
                                        "tool_content": {"title": f"🔍{await t('enter_search_stage')}", "content": ""}
                                    }
                                }]
                            }
                            yield f"data: {json.dumps(search_chunk)}\n\n"
                            search_not_done = True
                            drs_msg = get_drs_stage(DRS_STAGE)
                            request.messages.append(
                                {
                                    "role": "assistant",
                                    "content": full_content,
                                    "reasoning_content": "",
                                }
                            )
                            request.messages.append(
                                {
                                    "role": "user",
                                    "content": drs_msg,
                                }
                            )
                        elif response_content["status"] == "need_more_work":
                            DRS_STAGE = 2
                            search_chunk = {
                                "choices": [{
                                    "delta": {
                                        "tool_content": {"title": f"🔍{await t('need_more_work')}", "content": ""}
                                    }
                                }]
                            }
                            yield f"data: {json.dumps(search_chunk)}\n\n"
                            search_not_done = True
                            search_task = response_content["unfinished_task"]
                            task_prompt = f"请继续查询如下信息：\n\n{search_task}\n\n初始任务：{user_prompt}\n\n"
                            request.messages.append(
                                {
                                    "role": "assistant",
                                    "content": full_content,
                                    "reasoning_content": "",
                                }
                            )
                            request.messages.append(
                                {
                                    "role": "user",
                                    "content": task_prompt,
                                }
                            )
                        elif response_content["status"] == "answer":
                            DRS_STAGE = 3
                            search_chunk = {
                                "choices": [{
                                    "delta": {
                                        "tool_content": {"title": f"⭐{await t('enter_answer_stage')}", "content": ""}
                                    }
                                }]
                            }
                            yield f"data: {json.dumps(search_chunk)}\n\n"
                            search_not_done = True
                            drs_msg = get_drs_stage(DRS_STAGE)
                            request.messages.append(
                                {
                                    "role": "assistant",
                                    "content": full_content,
                                    "reasoning_content": "",
                                }
                            )
                            request.messages.append(
                                {
                                    "role": "user",
                                    "content": drs_msg,
                                }
                            )
                logger.info(f"all msg: {request.messages}")
                yield "data: [DONE]\n\n"
                if settings.get('loveSettings', {}).get('enabled', False) and not request.is_sub_agent:
                    try:
                        from py.affection_system import extract_and_update_affection
                        # full_content 是当前轮次 AI 的完整回复文本
                        await extract_and_update_affection(full_content)
                    except Exception as e:
                        print(f"解析好感度标签出错: {e}")

                # --- [v0.5.3] Token Usage Recording ---
                try:
                    _usage_meter = get_token_meter()
                    _usage_duration = int((time.time() - _request_start_time) * 1000) if '_request_start_time' in dir() else 0
                    # Try to get usage from the last chunk if the API provides it
                    _u_input = getattr(chunk, 'usage', None)
                    _input_tokens = _u_input.prompt_tokens if _u_input and hasattr(_u_input, 'prompt_tokens') else 0
                    _output_tokens = _u_input.completion_tokens if _u_input and hasattr(_u_input, 'completion_tokens') else 0
                    _cache_read = getattr(_u_input, 'prompt_tokens_details', None)
                    _cache_read_tokens = getattr(_cache_read, 'cached_tokens', 0) if _cache_read else 0
                    _cache_creation_tokens = 0
                    # Estimate tokens from content length if API didn't provide
                    if _input_tokens == 0 and full_content:
                        _input_tokens = len(str(user_prompt)) // 4 if user_prompt else 0
                        _output_tokens = len(full_content) // 4
                    _cost = calculate_cost(model, _input_tokens, _output_tokens, _cache_read_tokens, _cache_creation_tokens)
                    _user_id = request.headers.get('X-OpenXnet-User', 'default') if hasattr(request, 'headers') else 'default'
                    _usage_meter.record(
                        model=model,
                        input_tokens=_input_tokens,
                        output_tokens=_output_tokens,
                        cache_read_tokens=_cache_read_tokens,
                        cache_creation_tokens=_cache_creation_tokens,
                        cost_usd=_cost,
                        duration_ms=_usage_duration,
                        user_id=_user_id,
                        conversation_id=request.conversation_id if hasattr(request, 'conversation_id') else None,
                        provider=settings.get('selectedProvider', None),
                        engine='local',
                        request_type='chat',
                        success=True,
                    )
                    logger.debug(f"[v0.5.3] Usage recorded: in={_input_tokens} out={_output_tokens} cost=${_cost:.6f}")
                except Exception as _usage_err:
                    logger.debug(f"[v0.5.3] Usage recording skipped: {_usage_err}")

                # --- [Brain Loop: Post-Neural] 从对话中结晶认知符号 ---
                _neuro_post = settings.get('neuroSettings', {}).get('enabled', True)
                if _neuro_post and symbol_store and full_content and not request.is_sub_agent:
                    if kernel:
                        try:
                            _tools_used = [tc.function.name for tc in tool_calls if hasattr(tc, 'function') and tc.function and tc.function.name] if tool_calls else []
                            _user_text_c = user_prompt if isinstance(user_prompt, str) else str(user_prompt)
                            asyncio.create_task(kernel.post_neural(
                                user_text=_user_text_c,
                                assistant_output=full_content,
                                tools_used=_tools_used,
                                success=True,
                                settings=settings,
                                symbol_store=symbol_store,
                                fast_client=fast_client,
                                is_sub_agent=False,
                            ))
                        except Exception as _kp_err:
                            logger.debug(f"[Kernel] Post-Neural task creation failed: {_kp_err}")
                    else:
                        try:
                            _tools_used = [tc.function.name for tc in tool_calls if hasattr(tc, 'function') and tc.function and tc.function.name] if tool_calls else []
                            _label = (user_prompt[:80] if isinstance(user_prompt, str) else str(user_prompt)[:80])
                            _user_text_c = user_prompt if isinstance(user_prompt, str) else str(user_prompt)
                            _all_text_c = f"{_user_text_c} {full_content[:2000]}"

                            _llm_facts = None
                            if fast_client:
                                try:
                                    _fast_model = settings.get('fast', {}).get('model', '') or 'gpt-4o-mini'
                                    _llm_facts = await LLMFactExtractor.extract_with_llm(
                                        _all_text_c, fast_client, model=_fast_model
                                    )
                                    if _llm_facts and _llm_facts.get('source') == 'llm':
                                        _label = _llm_facts.get('label', _label) or _label
                                except Exception as _llm_err:
                                    logger.debug(f"[BrainLoop] LLM extraction failed: {_llm_err}")

                            _new_sym = SymbolCrystallizer.crystallize(
                                label=_label,
                                user_input=_user_text_c,
                                assistant_output=full_content[:2000],
                                tools_used=_tools_used,
                                success=True
                            )

                            if _llm_facts and _llm_facts.get('source') == 'llm':
                                _new_sym.K.entities = _llm_facts.get('entities', _new_sym.K.entities)
                                _new_sym.K.relations = _llm_facts.get('relations', _new_sym.K.relations)
                                if _llm_facts.get('operator') in VALID_OPERATORS:
                                    _new_sym.operator = _llm_facts['operator']

                            symbol_store.store(_new_sym)
                            _src = _llm_facts.get('source', 'regex') if _llm_facts else 'regex'
                            logger.info(f"[BrainLoop] Post-Neural: crystallized symbol {_new_sym.id} op={_new_sym.operator} entities={_new_sym.K.entities[:5]} src={_src}")
                        except Exception as _bl_post_err:
                            logger.warning(f"[BrainLoop] Post-Neural crystallize skipped: {_bl_post_err}")

                if m0 and not request.is_sub_agent:
                    print("记忆更新任务开始提交")
                    messages = f"用户说：{user_prompt}\n\n---\n\n你说：{full_content}"
                    infer = cur_memory.get('infer', False) or False
                    
                    def run_task():
                        import asyncio  # ← 在这里导入！
                        import traceback
                        
                        async def add():
                            loop = asyncio.get_running_loop()
                            with ThreadPoolExecutor() as executor:
                                metadata = {
                                    "timetamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                                }
                                func = partial(m0.add, user_id=memoryId, metadata=metadata, infer=infer)
                                await loop.run_in_executor(executor, func, messages)
                                print("记忆更新完成")
                        
                        try:
                            loop = asyncio.get_running_loop()
                            task = asyncio.create_task(add())
                            task.add_done_callback(
                                lambda t: print(f"任务异常: {t.exception()}") if t.exception() else None
                            )
                        except RuntimeError:
                            # 没有运行的事件循环
                            asyncio.run(add())
                        except Exception as e:
                            print(f"run_task 异常: {e}")
                            traceback.print_exc()
                    
                    import threading
                    thread = threading.Thread(target=run_task, daemon=True)
                    thread.start()
                    print("记忆更新任务已提交到后台线程")

                if not request.is_sub_agent:
                    _persist_workspace_session_memory(
                        settings,
                        user_prompt,
                        full_content,
                        model=model,
                        source="stream_chat",
                    )

                return
            except Exception as e:
                logger.error(f"{request.messages}")
                # 捕获异常并返回结构化错误信息
                error_chunk = {
                    "choices": [{
                        "delta": {
                            "tool_content": {
                                "title": "❎ Error", # 统一标题
                                "content": str(e),   # 错误详情
                                "type": "error"      # 标记类型，方便前端切换样式
                            }
                        }
                    }]
                }
                yield f"data: {json.dumps(error_chunk)}\n\n"
                yield "data: [DONE]\n\n"  # 确保最终结束
                return
        
        # ====================================================================
        # [v0.5.2] 双轨路由: QueryEngine (新引擎) vs stream_generator (旧引擎)
        # ====================================================================
        use_query_engine = settings.get('useQueryEngine', False)
        
        if use_query_engine and chat_vendor != 'Dify':
            # ── 新引擎路径: QueryEngine 状态机 ──
            logger.info("[v0.5.2] Routing through QueryEngine")

            async def _capture_query_engine_session_memory(messages_snapshot, user_prompt_snapshot):
                if request.is_sub_agent:
                    return

                assistant_output = ""
                for message in reversed(messages_snapshot or []):
                    if message.get("role") != "assistant":
                        continue
                    if message.get("tool_calls"):
                        continue
                    content = message.get("content")
                    if isinstance(content, str) and content.strip():
                        assistant_output = content
                        break

                if assistant_output:
                    _persist_workspace_session_memory(
                        settings,
                        user_prompt_snapshot,
                        assistant_output,
                        model=model,
                        source="query_engine",
                    )

                    # --- [Kernel] Post-Neural crystallization for QueryEngine path ---
                    if kernel and symbol_store:
                        try:
                            _user_text_qe = user_prompt_snapshot if isinstance(user_prompt_snapshot, str) else str(user_prompt_snapshot)
                            _tools_qe = []
                            for msg in (messages_snapshot or []):
                                for tc in (msg.get("tool_calls") or []):
                                    fn = tc.get("function", {}).get("name", "")
                                    if fn:
                                        _tools_qe.append(fn)
                            asyncio.create_task(kernel.post_neural(
                                user_text=_user_text_qe,
                                assistant_output=assistant_output,
                                tools_used=_tools_qe,
                                success=True,
                                settings=settings,
                                symbol_store=symbol_store,
                                fast_client=fast_client,
                                is_sub_agent=False,
                            ))
                        except Exception as _kp_qe_err:
                            logger.debug(f"[Kernel] Post-Neural (QueryEngine) failed: {_kp_qe_err}")
            
            _inject_kernel_system_manifest(
                request.messages,
                settings,
                tools,
                source="query_engine",
            )

            engine = QueryEngine(
                client=client,
                model=model,
                messages=request.messages,
                tools=tools,
                extra_params=extra_params,
                legacy_execute_tool=dispatch_tool,
                settings=settings,
                user_prompt=user_prompt,
                reasoner_client=reasoner_client,
                reasoner_extra=reasoner_extra if 'reasoner_extra' in dir() else {},
                symbol_store=symbol_store if 'symbol_store' in dir() else None,
                enable_thinking=enable_thinking,
                on_post_flight=_capture_query_engine_session_memory,
                conversation_id=request.conversation_id or request.conversationId or "",
            )
            
            return StreamingResponse(
                engine.execute_turn(),
                media_type="text/event-stream",
                headers={
                    "Content-Type": "text/event-stream",
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                }
            )
        else:
            # ── 旧引擎路径: stream_generator (保底兼容) ──
            _run_kernel_shadow_plan(
                request,
                settings,
                model=model,
                tools=tools,
                source="stream_legacy",
            )
            return StreamingResponse(
                stream_generator(user_prompt, DRS_STAGE, tools, images),
                media_type="text/event-stream",
                headers={
                    "Content-Type": "text/event-stream",
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                }
            )
    except Exception as e:
        logger.error(f"Error occurred: {e}")
        return _build_error_response_from_exception(e)
    finally:
        # --- [v0.5.3 P0-B] 注销 abort event ---
        _unregister_stream(_stream_id)

async def generate_complete_response(client,reasoner_client, request: ChatRequest, settings: dict,fastapi_base_url,enable_thinking,enable_deep_research,enable_web_search):
    global mcp_client_list,HA_client,ChromeMCP_client,sql_client
    DRS_STAGE = 1 # 1: 明确用户需求阶段 2: 工具调用阶段 3: 生成结果阶段
    if len(request.messages) > 2:
        DRS_STAGE = 2

    max_rounds = settings.get("max_rounds", 0)

    if max_rounds > 0 and request.messages:
        # 兼容获取 role 的辅助方法（支持 dict 或 Pydantic 对象）
        def get_role(msg):
            return msg.get("role") if isinstance(msg, dict) else msg.role

        system_messages = []
        chat_messages = request.messages

        # 1. 仅判断第一条是不是 system（中间的不管）
        if get_role(chat_messages[0]) == "system":
            system_messages = [chat_messages[0]]
            chat_messages = chat_messages[1:]

        retain_count = max_rounds + 1 

        # 2. 截断对话历史
        if len(chat_messages) > retain_count:
            chat_messages = chat_messages[-retain_count:]
            
            # 3. 终极边界处理：永远以 user 开始
            # 只要第一条不是 user（比如是 assistant 或 tool），就一直丢弃
            while chat_messages and get_role(chat_messages[0]) != "user":
                chat_messages = chat_messages[1:]
                
        # 4. 重新拼合 messages
        request.messages = system_messages + chat_messages

    # --- [v0.5.3 P0-A] Agent 路径上下文压缩 ---
    if _kernel_context_compression_enabled(settings):
        try:
            _original_messages_for_agent_compaction = copy.deepcopy(request.messages)
            _compactor3 = ContextCompactor(model_id=settings.get('model', ''), max_tool_result_chars=8000, reserve_for_output=4096)
            _cr3 = _compactor3.compact(request.messages)
            if _cr3.removed_messages > 0 or _cr3.trimmed_tool_results > 0:
                request.messages = _cr3.messages
                _persist_context_compaction_memory(
                    settings,
                    _original_messages_for_agent_compaction,
                    _cr3,
                    model=settings.get('model', ''),
                    source="agent_preflight",
                )
                print(f"[ContextCompactor/Agent] {_cr3.original_tokens}→{_cr3.compacted_tokens} tokens")
        except Exception as _ce3:
            pass

    from py.load_files import get_files_content,file_tool,image_tool
    from py.web_search import (
        DDGsearch, 
        searxng, 
        Tavily_search,
        Bing_search,
        Google_search,
        Brave_search,
        Exa_search,
        Serper_search,
        bochaai_search,
        duckduckgo_tool, 
        searxng_tool, 
        tavily_tool, 
        bing_tool,
        google_tool,
        brave_tool,
        exa_tool,
        serper_tool,
        bochaai_tool,
        jina_crawler_tool, 
        simple_fetch_tool,
        Crawl4Ai_tool,
        firecrawl_tool,
        markdown_new_tool,
    )
    from py.know_base import kb_tool,query_knowledge_base,rerank_knowledge_base
    from py.agent_tool import get_agent_tool
    from py.a2a_tool import get_a2a_tool
    from py.llm_tool import get_llm_tool
    from py.pollinations import pollinations_image_tool,openai_image_tool,openai_chat_image_tool
    from py.code_interpreter import e2b_code_tool,local_run_code_tool
    from py.utility_tools import time_tool
    from py.utility_tools import (
        time_tool, 
        weather_tool,
        location_tool,
        timer_weather_tool,
        wikipedia_summary_tool,
        wikipedia_section_tool,
        arxiv_tool
    ) 
    from py.autoBehavior import auto_behavior_tool
    from py.cli_tool import claude_code_tool,openai_codex_tool,qwen_code_tool,get_tools_for_mode,get_local_tools_for_mode
    from py.cdp_tool import all_cdp_tools
    from py.random_topic import random_topics_tools
    from py.computer_use_tool import computer_use_tools,mouse_use_tools,keyboard_use_tools,desktopVision_use_tools
    m0 = None
    cur_memory = None
    if settings["memorySettings"]["is_memory"] and settings["memorySettings"]["selectedMemory"] and settings["memorySettings"]["selectedMemory"] != "":
        memoryId = settings["memorySettings"]["selectedMemory"]
        for memory in settings["memories"]:
            if memory["id"] == memoryId:
                cur_memory = _normalize_character_card_memory(memory)
                break
        if cur_memory and cur_memory["providerId"]:
            print("长期记忆启用")
            config={
                "embedder": {
                    "provider": 'openai',
                    "config": {
                        "model": cur_memory['model'],
                        "api_key": cur_memory['api_key'],
                        "openai_base_url":cur_memory["base_url"],
                        "embedding_dims":cur_memory.get("embedding_dims", 1024)
                    },
                },
                "llm": {
                    "provider": 'openai',
                    "config": {
                        "model": settings['model'],
                        "api_key": settings['api_key'],
                        "openai_base_url":settings["base_url"]
                    }
                },
                "vector_store": {
                    "provider": "faiss",
                    "config": {
                        "collection_name": "agent-party",
                        "path": os.path.join(MEMORY_CACHE_DIR,memoryId),
                        "distance_strategy": "euclidean",
                        "embedding_model_dims": cur_memory.get("embedding_dims", 1024)
                    }
                    }
                }
            try:
                from py.memory_worker_client import MemoryWorkerClient
                m0 = MemoryWorkerClient.from_config(config)
            except (ImportError, ValueError) as error:
                logger.warning(
                    "Memory Worker adapter is unavailable; skipping long-term memory "
                    "in complete response: %s",
                    error,
                )
    images = await images_in_messages(request.messages,fastapi_base_url)
    request.messages = await message_without_images(request.messages)
    open_tag = "<think>"
    close_tag = "</think>"
    tools = _normalize_request_tools(request.tools)
    extra = {}
    reasoner_extra = {}
    generic_mcp_tools = await _get_generic_mcp_openai_functions(settings)
    if generic_mcp_tools:
        tools.extend(generic_mcp_tools)
    get_llm_tool_fuction = await get_llm_tool(settings)
    if get_llm_tool_fuction:
        tools.append(get_llm_tool_fuction)
    get_agent_tool_fuction = await get_agent_tool(settings)
    if get_agent_tool_fuction:
        tools.append(get_agent_tool_fuction)
    get_a2a_tool_fuction = await get_a2a_tool(settings)
    if get_a2a_tool_fuction:
        tools.append(get_a2a_tool_fuction)
    get_character_card_tool_function = await get_character_card_tool(settings)
    if get_character_card_tool_function:
        tools.append(get_character_card_tool_function)
    tools.extend(get_kernel_config_tools(settings))
    if settings["HASettings"]["enabled"]:
        ha_tool = await _get_home_assistant_openai_functions(settings)
        if ha_tool:
            tools.extend(ha_tool)
    if settings['chromeMCPSettings']['enabled'] and settings['chromeMCPSettings']['type']=='external':
        chromeMCP_tool = await _get_external_chrome_openai_functions(settings)
        if chromeMCP_tool:
            tools.extend(chromeMCP_tool)
    if settings['chromeMCPSettings']['enabled'] and settings['chromeMCPSettings']['type']=='internal':
        tools.extend(all_cdp_tools)
    if settings['sqlSettings']['enabled']:
        sql_tool = await _get_sql_openai_functions(settings)
        if sql_tool:
            tools.extend(sql_tool)
    if settings['CLISettings']['enabled']:
        if settings['CLISettings']['engine'] == 'cc':
            tools.append(claude_code_tool)
        elif settings['CLISettings']['engine'] == 'oc':
            tools.append(openai_codex_tool)
        elif settings['CLISettings']['engine'] == 'qc':
            tools.append(qwen_code_tool)
        elif settings['CLISettings']['engine'] == 'ds':
            tools.extend(get_tools_for_mode('yolo'))
        elif settings['CLISettings']['engine'] == 'local':
            tools.extend(get_local_tools_for_mode('yolo'))
    vision_control_settings = settings.get('visionControlSettings', {}) or {}
    if vision_control_settings.get('enabled'):
        tools.extend(computer_use_tools)
        if vision_control_settings.get('mouse'):
            tools.extend(mouse_use_tools)
        if vision_control_settings.get('keyboard'):
            tools.extend(keyboard_use_tools)
        if not vision_control_settings.get('desktopVision'):
            tools.extend(desktopVision_use_tools)
    if settings["tools"]["randomTopic"]['enabled']:
        tools.extend(random_topics_tools)
    if settings['tools']['time']['enabled'] and settings['tools']['time']['triggerMode'] == 'afterThinking':
        tools.append(time_tool)
    if settings["tools"]["weather"]['enabled']:
        tools.append(weather_tool)
        tools.append(location_tool)
        tools.append(timer_weather_tool)
    if settings["tools"]["wikipedia"]['enabled']:
        tools.append(wikipedia_summary_tool)
        tools.append(wikipedia_section_tool)
    if settings["tools"]["arxiv"]['enabled']:
        tools.append(arxiv_tool)
    if settings['text2imgSettings']['enabled']:
        if settings['text2imgSettings']['engine'] == 'pollinations':
            tools.append(pollinations_image_tool)
        elif settings['text2imgSettings']['engine'] == 'openai':
            tools.append(openai_image_tool)
        elif settings['text2imgSettings']['engine'] == 'openaiChat':
            tools.append(openai_chat_image_tool)
    if settings['tools']['getFile']['enabled']:
        tools.append(file_tool)
        tools.append(image_tool)
    if settings['tools']['autoBehavior']['enabled'] and request.messages[-1]['role'] == 'user':
        tools.append(auto_behavior_tool)
    if settings["codeSettings"]['enabled']:
        if settings["codeSettings"]["engine"] == "e2b":
            tools.append(e2b_code_tool)
        elif settings["codeSettings"]["engine"] == "sandbox":
            tools.append(local_run_code_tool)
    if any(tool.get("function", {}).get("name") == "openxnet_create_character_card" for tool in tools):
        content_append(
            request.messages,
            'system',
            "如果用户明确要求创建、新建、生成角色卡、人物卡或角色设定，并希望直接保存到 OpenXnet，请优先调用 openxnet_create_character_card 工具，不要只返回纯文本模板。只有在用户明确只是讨论方案、咨询思路或润色文案时，才不要调用该工具。",
        )
    if settings["custom_http"]:
        for custom_http in settings["custom_http"]:
            if custom_http["enabled"]:
                if custom_http['body'] == "":
                    custom_http['body'] = "{}"
                custom_http_tool = {
                    "type": "function",
                    "function": {
                        "name": f"custom_http_{custom_http['name']}",
                        "description": f"{custom_http['description']}",
                        "parameters": json.loads(custom_http['body']),
                    },
                }
                tools.append(custom_http_tool)
    if settings["workflows"]:
        for workflow in settings["workflows"]:
            if workflow["enabled"]:
                comfyui_properties = {}
                comfyui_required = []
                if workflow["text_input"] is not None:
                    comfyui_properties["text_input"] = {
                        "description": "第一个文字输入，需要输入的提示词，用于生成图片或者视频，如果无特别提示，默认为英文",
                        "type": "string"
                    }
                    comfyui_required.append("text_input")
                if workflow["text_input_2"] is not None:
                    comfyui_properties["text_input_2"] = {
                        "description": "第二个文字输入，需要输入的提示词，用于生成图片或者视频，如果无特别提示，默认为英文",
                        "type": "string"
                    }
                    comfyui_required.append("text_input_2")
                if workflow["image_input"] is not None:
                    comfyui_properties["image_input"] = {
                        "description": "第一个图片输入，需要输入的图片，必须是图片URL，可以是外部链接，也可以是服务器内部的URL，例如：https://www.example.com/xxx.png  或者  http://127.0.0.1:3456/xxx.jpg",
                        "type": "string"
                    }
                    comfyui_required.append("image_input")
                if workflow["image_input_2"] is not None:
                    comfyui_properties["image_input_2"] = {
                        "description": "第二个图片输入，需要输入的图片，必须是图片URL，可以是外部链接，也可以是服务器内部的URL，例如：https://www.example.com/xxx.png  或者  http://127.0.0.1:3456/xxx.jpg",
                        "type": "string"
                    }
                    comfyui_required.append("image_input_2")
                comfyui_parameters = {
                    "type": "object",
                    "properties": comfyui_properties,
                    "required": comfyui_required
                }
                comfyui_tool = {
                    "type": "function",
                    "function": {
                        "name": f"comfyui_{workflow['unique_filename']}",
                        "description": f"{workflow['description']}+\n如果要输入图片提示词或者修改提示词，尽可能使用英语。\n返回的图片结果，请将图片的URL放入![image]()这样的markdown语法中，用户才能看到图片。如果是视频，请将视频的URL放入<video controls> <source src=''></video>的中src中，用户才能看到视频。如果有多个结果，则请用换行符分隔开这几个图片或者视频，用户才能看到多个结果。",
                        "parameters": comfyui_parameters,
                    },
                }
                tools.append(comfyui_tool)
    search_not_done = False
    search_task = ""
    try:
        model = settings['model']
        extra_params = settings['extra_params']
        # 移除extra_params这个list中"name"不包含非空白符的键值对
        if extra_params:
            for extra_param in extra_params:
                if not extra_param['name'].strip():
                    extra_params.remove(extra_param)
            # 列表转换为字典
            extra_params = {item['name']: item['value'] for item in extra_params}
        else:
            extra_params = {}
        if request.fileLinks:
            # 异步获取文件内容
            files_content = await get_files_content(request.fileLinks)
            system_message = f"\n\n相关文件内容：{files_content}"
            
            # 修复字符串拼接错误
            content_append(request.messages, 'system', system_message)
        kb_list = []
        user_prompt = request.messages[-1].get('content') or ""
        if cur_memory and settings["memorySettings"]["is_memory"] and settings["memorySettings"]["selectedMemory"] and settings["memorySettings"]["selectedMemory"] != "":
            if settings["memorySettings"]["userName"] and settings["memorySettings"]["userName"] != "user":
                print("添加用户名：\n\n" + settings["memorySettings"]["userName"] + "\n\n用户名结束\n\n")
                content_append(request.messages, 'system', "当前与你交流的人的名字为：\n\n" + settings["memorySettings"]["userName"] + "\n\n")
            lore_content = ""
            assistant_reply = ""
            # 找出request.messages中上次的assistant回复
            for i in range(len(request.messages)-1, -1, -1):
                if request.messages[i]['role'] == 'assistant':
                    assistant_reply = request.messages[i]['content']
                    break
            if cur_memory["characterBook"]:
                for lore in cur_memory["characterBook"]:
                    # lore['keysRaw'] 按照换行符分割，并去除空字符串
                    lore_keys = lore["keysRaw"].split("\n")
                    lore_keys = [key for key in lore_keys if key != ""]
                    print(lore_keys)
                    # 如果lore_keys不为空，并且lore_keys的任意一个元素在user_prompt或者assistant_reply中，则添加lore['content']到lore_content中
                    if lore_keys != [] and any(key in user_prompt or key in assistant_reply for key in lore_keys):
                        lore_content += lore['content'] + "\n\n"
            if lore_content:
                if settings["memorySettings"]["userName"]:
                    # 替换lore_content中的{{user}}为settings["memorySettings"]["userName"]
                    lore_content = lore_content.replace("{{user}}", settings["memorySettings"]["userName"])
                # 替换lore_content中的{{char}}为cur_memory["name"]
                lore_content = lore_content.replace("{{char}}", cur_memory["name"])
                print("添加世界观设定：\n\n" + lore_content + "\n\n世界观设定结束\n\n")
                content_append(request.messages, 'system', "世界观设定：\n\n" + lore_content + "\n\n世界观设定结束\n\n")
            if cur_memory["description"]:
                if settings["memorySettings"]["userName"]:
                    # 替换cur_memory["description"]中的{{user}}为settings["memorySettings"]["userName"]
                    cur_memory["description"] = cur_memory["description"].replace("{{user}}", settings["memorySettings"]["userName"])
                # 替换cur_memory["description"]中的{{char}}为cur_memory["name"]
                cur_memory["description"] = cur_memory["description"].replace("{{char}}", cur_memory["name"])
                print("添加角色设定：\n\n" + cur_memory["description"] + "\n\n角色设定结束\n\n")
                content_append(request.messages, 'system', "角色设定：\n\n" + cur_memory["description"] + "\n\n角色设定结束\n\n")
            if cur_memory["personality"]:
                if settings["memorySettings"]["userName"]:
                    # 替换cur_memory["personality"]中的{{user}}为settings["memorySettings"]["userName"]
                    cur_memory["personality"] = cur_memory["personality"].replace("{{user}}", settings["memorySettings"]["userName"])
                # 替换cur_memory["personality"]中的{{char}}为cur_memory["name"]
                cur_memory["personality"] = cur_memory["personality"].replace("{{char}}", cur_memory["name"])
                print("添加性格设定：\n\n" + cur_memory["personality"] + "\n\n性格设定结束\n\n")
                content_append(request.messages, 'system', "性格设定：\n\n" + cur_memory["personality"] + "\n\n性格设定结束\n\n") 
            if cur_memory['mesExample']:
                if settings["memorySettings"]["userName"]:
                    # 替换cur_memory["mesExample"]中的{{user}}为settings["memorySettings"]["userName"]
                    cur_memory["mesExample"] = cur_memory["mesExample"].replace("{{user}}", settings["memorySettings"]["userName"])
                # 替换cur_memory["mesExample"]中的{{char}}为cur_memory["name"]
                cur_memory["mesExample"] = cur_memory["mesExample"].replace("{{char}}", cur_memory["name"])
                print("添加对话示例：\n\n" + cur_memory['mesExample'] + "\n\n对话示例结束\n\n")
                content_append(request.messages, 'system', "对话示例：\n\n" + cur_memory['mesExample'] + "\n\n对话示例结束\n\n")
            if cur_memory["systemPrompt"]:
                if settings["memorySettings"]["userName"]:
                    # 替换cur_memory["systemPrompt"]中的{{user}}为settings["memorySettings"]["userName"]
                    cur_memory["systemPrompt"] = cur_memory["systemPrompt"].replace("{{user}}", settings["memorySettings"]["userName"])
                # 替换cur_memory["systemPrompt"]中的{{char}}为cur_memory["name"]
                cur_memory["systemPrompt"] = cur_memory["systemPrompt"].replace("{{char}}", cur_memory["name"])
                print("添加系统提示：\n\n" + cur_memory["systemPrompt"] + "\n\n系统提示结束\n\n")
                content_append(request.messages, 'system', "系统提示：\n\n" + cur_memory["systemPrompt"] + "\n\n系统提示结束\n\n")
            if settings["memorySettings"]["genericSystemPrompt"]:
                if settings["memorySettings"]["userName"]:
                    # 替换settings["memorySettings"]["genericSystemPrompt"]中的{{user}}为settings["memorySettings"]["userName"]
                    settings["memorySettings"]["genericSystemPrompt"] = settings["memorySettings"]["genericSystemPrompt"].replace("{{user}}", settings["memorySettings"]["userName"])
                # 替换cur_memory["systemPrompt"]中的{{char}}为cur_memory["name"]
                settings["memorySettings"]["genericSystemPrompt"] = settings["memorySettings"]["genericSystemPrompt"].replace("{{char}}", cur_memory["name"])
                print("添加系统提示：\n\n" + settings["memorySettings"]["genericSystemPrompt"] + "\n\n系统提示结束\n\n")
                content_append(request.messages, 'system', "系统提示：\n\n" + settings["memorySettings"]["genericSystemPrompt"] + "\n\n系统提示结束\n\n")
                    
            if m0:
                memoryLimit = settings["memorySettings"]["memoryLimit"]
                try:
                    # 【核心修改】：使用 asyncio.to_thread 将同步的 search 方法放入线程池运行
                    # 这样主线程（Event Loop）会被释放，可以去处理 /minilm/embeddings 请求，从而避免死锁
                    relevant_memories = await asyncio.to_thread(
                        m0.search, 
                        query=user_prompt, 
                        user_id=memoryId, 
                        limit=memoryLimit
                    )
                    relevant_memories = json.dumps(relevant_memories, ensure_ascii=False)
                except Exception as e:
                    print("m0.search error:",e)
                    relevant_memories = ""
                print("添加相关记忆：\n\n" + relevant_memories + "\n\n相关结束\n\n")
                content_append(request.messages, 'system', "之前的相关记忆：\n\n" + relevant_memories + "\n\n相关结束\n\n") 
        if settings["knowledgeBases"]:
            for kb in settings["knowledgeBases"]:
                if kb["enabled"] and kb["processingStatus"] == "completed":
                    kb_list.append({"kb_id":kb["id"],"name": kb["name"],"introduction":kb["introduction"]})
        if settings["KBSettings"]["when"] == "before_thinking" or settings["KBSettings"]["when"] == "both":
            if kb_list:
                all_kb_content = []
                # 用query_knowledge_base函数查询kb_list中所有的知识库
                for kb in kb_list:
                    kb_content = await query_knowledge_base(kb["kb_id"],user_prompt)
                    all_kb_content.extend(kb_content)
                    if settings["KBSettings"]["is_rerank"]:
                        all_kb_content = await rerank_knowledge_base(user_prompt,all_kb_content)
                if all_kb_content:
                    kb_message = f"\n\n可参考的知识库内容：{all_kb_content}"
                    content_append(request.messages, 'user',  f"{kb_message}\n\n用户：{user_prompt}")
        if settings["KBSettings"]["when"] == "after_thinking" or settings["KBSettings"]["when"] == "both":
            if kb_list:
                kb_list_message = f"\n\n可调用的知识库列表：{json.dumps(kb_list, ensure_ascii=False)}"
                content_append(request.messages, 'system', kb_list_message)
        else:
            kb_list = []
        request = await tools_change_messages(request, settings)
        chat_vendor = 'OpenAI'
        reasoner_vendor = 'OpenAI'
        for modelProvider in settings['modelProviders']: 
            if modelProvider['id'] == settings['selectedProvider']:
                chat_vendor = modelProvider['vendor']
                break
        for modelProvider in settings['modelProviders']: 
            if modelProvider['id'] == settings['reasoner']['selectedProvider']:
                reasoner_vendor = modelProvider['vendor']
                break
        if chat_vendor == 'Dify':
            try:
                if len(request.messages) >= 3:
                    if request.messages[2]['role'] == 'user':
                        if request.messages[1]['role'] == 'assistant':
                            request.messages[2]['content'] = "你上一次的发言：\n" +request.messages[0]['content'] + "\n你上一次的发言结束\n\n用户：" + request.messages[2]['content']
                        if request.messages[0]['role'] == 'system':
                            request.messages[2]['content'] = "系统提示：\n" +request.messages[0]['content'] + "\n系统提示结束\n\n" + request.messages[2]['content']
                elif len(request.messages) >= 2:
                    if request.messages[1]['role'] == 'user':
                        if request.messages[0]['role'] == 'system':
                            request.messages[1]['content'] = "系统提示：\n" +request.messages[0]['content'] + "\n系统提示结束\n\n用户：" + request.messages[1]['content']
            except Exception as e:
                print("Dify error:",e)
        if settings['webSearch']['enabled'] or enable_web_search:
            if settings['webSearch']['when'] == 'before_thinking' or settings['webSearch']['when'] == 'both':
                if settings['webSearch']['engine'] == 'duckduckgo':
                    results = await DDGsearch(user_prompt)
                elif settings['webSearch']['engine'] == 'searxng':
                    results = await searxng(user_prompt)
                elif settings['webSearch']['engine'] == 'tavily':
                    results = await Tavily_search(user_prompt)
                elif settings['webSearch']['engine'] == 'bing':
                    results = await Bing_search(user_prompt)
                elif settings['webSearch']['engine'] == 'google':
                    results = await Google_search(user_prompt)
                elif settings['webSearch']['engine'] == 'brave':
                    results = await Brave_search(user_prompt)
                elif settings['webSearch']['engine'] == 'exa':
                    results = await Exa_search(user_prompt)
                elif settings['webSearch']['engine'] == 'serper':
                    results = await Serper_search(user_prompt)
                elif settings['webSearch']['engine'] == 'bochaai':
                    results = await bochaai_search(user_prompt)
                if results:
                    content_append(request.messages, 'user',  f"\n\n联网搜索结果：{results}")
            if settings['webSearch']['when'] == 'after_thinking' or settings['webSearch']['when'] == 'both':
                if settings['webSearch']['engine'] == 'duckduckgo':
                    tools.append(duckduckgo_tool)
                elif settings['webSearch']['engine'] == 'searxng':
                    tools.append(searxng_tool)
                elif settings['webSearch']['engine'] == 'tavily':
                    tools.append(tavily_tool)
                elif settings['webSearch']['engine'] == 'bing':
                    tools.append(bing_tool)
                elif settings['webSearch']['engine'] == 'google':
                    tools.append(google_tool)
                elif settings['webSearch']['engine'] == 'brave':
                    tools.append(brave_tool)
                elif settings['webSearch']['engine'] == 'exa':
                    tools.append(exa_tool)
                elif settings['webSearch']['crawler'] == 'serper':
                    tools.append(serper_tool)
                elif settings['webSearch']['crawler'] == 'bochaai':
                    tools.append(bochaai_tool)

                if settings['webSearch']['crawler'] == 'jina':
                    tools.append(jina_crawler_tool)
                elif settings['webSearch']['crawler'] == 'crawl4ai':
                    tools.append(Crawl4Ai_tool)
                elif settings['webSearch']['crawler'] == 'firecrawl':
                    tools.append(firecrawl_tool)
                elif settings['webSearch']['crawler'] == 'simpleRequest':
                    tools.append(simple_fetch_tool)
                elif settings['webSearch']['crawler'] == 'mdnew':
                    tools.append(markdown_new_tool)
        if kb_list:
            tools.append(kb_tool)
        _run_kernel_shadow_plan(
            request,
            settings,
            model=model,
            tools=tools,
            source="complete_legacy",
        )
        _inject_kernel_system_manifest(
            request.messages,
            settings,
            tools,
            source="complete",
        )
        if settings['tools']['deepsearch']['enabled'] or enable_deep_research: 
            deepsearch_messages = copy.deepcopy(request.messages)
            content_append(deepsearch_messages, 'user',  "\n\n将用户提出的问题或给出的当前任务拆分成多个步骤，每一个步骤用一句简短的话概括即可，无需回答或执行这些内容，直接返回总结即可，但不能省略问题或任务的细节。如果用户输入的只是闲聊或者不包含任务和问题，直接把用户输入重复输出一遍即可。如果是非常简单的问题，也可以只给出一个步骤即可。一般情况下都是需要拆分成多个步骤的。")
            response = await client.chat.completions.create(
                model=model,
                messages=deepsearch_messages,
                temperature=0.5, 
                extra_body = extra_params, # 其他参数
            )
            user_prompt = response.choices[0].message.content
            content_append(request.messages, 'user',  f"\n\n如果用户没有提出问题或者任务，直接闲聊即可，如果用户提出了问题或者任务，任务描述不清晰或者你需要进一步了解用户的真实需求，你可以暂时不完成任务，而是分析需要让用户进一步明确哪些需求。")
        if settings['reasoner']['enabled'] or enable_thinking:
            reasoner_messages = copy.deepcopy(request.messages)
            if settings['tools']['deepsearch']['enabled'] or enable_deep_research: 
                drs_msg = get_drs_stage(DRS_STAGE)
                if drs_msg:
                    content_append(reasoner_messages, 'user',  f"\n\n{drs_msg}\n\n")
                content_append(reasoner_messages, 'user',  f"\n\n可参考的步骤：{user_prompt}\n\n")
            if tools:
                content_append(reasoner_messages, 'system',  f"可用工具：{json.dumps(tools)}")
            for modelProvider in settings['modelProviders']: 
                if modelProvider['id'] == settings['reasoner']['selectedProvider']:
                    vendor = modelProvider['vendor']
                    break
            msg = await images_add_in_messages(reasoner_messages, images,settings)   
            if chat_vendor == 'OpenAI':
                extra['max_completion_tokens'] = request.max_tokens or settings['max_tokens']
            else:
                extra['max_tokens'] = request.max_tokens or settings['max_tokens']
            if reasoner_vendor == 'OpenAI':
                reasoner_extra['max_completion_tokens'] = settings['reasoner']['max_tokens']
            else:
                reasoner_extra['max_tokens'] = settings['reasoner']['max_tokens']
            if request.reasoning_effort or settings['reasoning_effort']:
                extra['reasoning_effort'] = request.reasoning_effort or settings['reasoning_effort']
            if settings['reasoner']['reasoning_effort'] is not None:
                reasoner_extra['reasoning_effort'] = settings['reasoner']['reasoning_effort'] 
            if vendor == 'Ollama':
                reasoner_response = await reasoner_client.chat.completions.create(
                    model=settings['reasoner']['model'],
                    messages=msg,
                    stream=False,
                    temperature=settings['reasoner']['temperature'],
                    **reasoner_extra
                )
                reasoning_buffer = reasoner_response.model_dump()['choices'][0]['message']['reasoning_content']
                if reasoning_buffer:
                    content_prepend(request.messages, 'assistant', reasoning_buffer) # 可参考的推理过程
                else:
                    reasoning_buffer = reasoner_response.model_dump()['choices'][0]['message']['reasoning']
                    if reasoning_buffer:
                        content_prepend(request.messages, 'assistant', reasoning_buffer) # 可参考的推理过程
                    else:
                        # 将推理结果中的思考内容提取出来
                        reasoning_content = reasoner_response.model_dump()['choices'][0]['message']['content']
                        # open_tag和close_tag之间的内容
                        start_index = reasoning_content.find(open_tag) + len(open_tag)
                        end_index = reasoning_content.find(close_tag)
                        if start_index != -1 and end_index != -1:
                            reasoning_content = reasoning_content[start_index:end_index]
                        else:
                            reasoning_content = ""
                        content_prepend(request.messages, 'assistant', reasoning_content) # 可参考的推理过程
            else:
                reasoner_response = await reasoner_client.chat.completions.create(
                    model=settings['reasoner']['model'],
                    messages=msg,
                    stream=False,
                    stop=settings['reasoner']['stop_words'],
                    temperature=settings['reasoner']['temperature'],
                    **reasoner_extra
                )
                reasoning_buffer = reasoner_response.model_dump()['choices'][0]['message']['reasoning_content']
                if reasoning_buffer:
                    content_prepend(request.messages, 'assistant', reasoning_buffer) # 可参考的推理过程
                else:
                    reasoning_buffer = reasoner_response.model_dump()['choices'][0]['message']['reasoning']
                    if reasoning_buffer:
                        content_prepend(request.messages, 'assistant', reasoning_buffer) # 可参考的推理过程
                    else:
                        reasoning_buffer = ""
                        content_prepend(request.messages, 'assistant', reasoning_buffer) # 可参考的推理过程
        if settings['tools']['deepsearch']['enabled'] or enable_deep_research: 
            content_append(request.messages, 'user',  f"\n\n可参考的步骤：{user_prompt}\n\n")
            drs_msg = get_drs_stage(DRS_STAGE)
            if drs_msg:
                content_append(request.messages, 'user',  f"\n\n{drs_msg}\n\n")
        _consume_kernel_live_guidance(request, "complete_before_llm")
        msg = await images_add_in_messages(request.messages, images,settings)
        if request.top_p != 1 or settings['top_p'] != 1:
            extra['top_p'] = request.top_p or settings['top_p']
        if tools:
            response = await client.chat.completions.create(
                model=model,
                messages=msg,  # 添加图片信息到消息
                temperature=request.temperature or settings['temperature'],
                tools=tools,
                stream=False,
                extra_body = extra_params, # 其他参数
                **extra
            )
        else:
            response = await client.chat.completions.create(
                model=model,
                messages=msg,  # 添加图片信息到消息
                temperature=request.temperature or settings['temperature'],
                stream=False,
                extra_body = extra_params, # 其他参数
                **extra
            )
        if response.choices[0].message.tool_calls:
            pass
        elif settings['tools']['deepsearch']['enabled'] or enable_deep_research: 
            search_prompt = get_drs_stage_system_message(DRS_STAGE,user_prompt,response.choices[0].message.content)
            research_response = await client.chat.completions.create(
                model=model,
                messages=[
                    {
                    "role": "user",
                    "content": search_prompt,
                    }
                ],
                temperature=0.5,
                extra_body = extra_params, # 其他参数
            )
            response_content = research_response.choices[0].message.content
            if response_content is None:
                response_content = ""

            # 用re 提取```json 包裹json字符串 ```
            if "```json" in response_content:
                try:
                    response_content = re.search(r'```json(.*?)```', response_content, re.DOTALL).group(1)
                except:
                    # 用re 提取```json 之后的内容
                    response_content = re.search(r'```json(.*?)', response_content, re.DOTALL).group(1)
            response_content = json.loads(response_content)
            if response_content["status"] == "done":
                search_not_done = False
            elif response_content["status"] == "not_done":
                search_not_done = True
                search_task = response_content["unfinished_task"]
                task_prompt = f"请继续完成初始任务中未完成的任务：\n\n{search_task}\n\n初始任务：{user_prompt}\n\n最后，请给出完整的初始任务的最终结果。"
                request.messages.append(
                    {
                        "role": "assistant",
                        "content": research_response.choices[0].message.content,
                        "reasoning_content": "",
                    }
                )
                request.messages.append(
                    {
                        "role": "user",
                        "content": task_prompt,
                    }
                )
            elif response_content["status"] == "need_more_info":
                DRS_STAGE = 2
                search_not_done = False
            elif response_content["status"] == "need_work":
                DRS_STAGE = 2
                search_not_done = True
                drs_msg = get_drs_stage(DRS_STAGE)
                request.messages.append(
                    {
                        "role": "assistant",
                        "content": research_response.choices[0].message.content,
                        "reasoning_content": "",
                    }
                )
                request.messages.append(
                    {
                        "role": "user",
                        "content": drs_msg,
                    }
                )
            elif response_content["status"] == "need_more_work":
                DRS_STAGE = 2
                search_not_done = True
                search_task = response_content["unfinished_task"]
                task_prompt = f"请继续查询如下信息：\n\n{search_task}\n\n初始任务：{user_prompt}\n\n"
                request.messages.append(
                    {
                        "role": "assistant",
                        "content": research_response.choices[0].message.content,
                        "reasoning_content": "",
                    }
                )
                request.messages.append(
                    {
                        "role": "user",
                        "content": task_prompt,
                    }
                )
            elif response_content["status"] == "answer":
                DRS_STAGE = 3
                search_not_done = True
                drs_msg = get_drs_stage(DRS_STAGE)
                request.messages.append(
                    {
                        "role": "assistant",
                        "content": research_response.choices[0].message.content,
                        "reasoning_content": "",
                    }
                )
                request.messages.append(
                    {
                        "role": "user",
                        "content": drs_msg,
                    }
                )
        reasoner_messages = copy.deepcopy(request.messages)
        while response.choices[0].message.tool_calls or search_not_done:
            if response.choices[0].message.tool_calls:
                assistant_message = response.choices[0].message
                response_content = assistant_message.tool_calls[0].function
                print(response_content.name)
                modified_data = '[' + response_content.arguments.replace('}{', '},{') + ']'
                # 使用json.loads来解析修改后的字符串为列表
                data_list = json.loads(modified_data)
                # 存储处理结果
                results = []
                for data in data_list:
                    result = await dispatch_tool(response_content.name, data,settings) # 将结果添加到results列表中
                    if isinstance(results, AsyncIterator):
                        buffer = []
                        async for chunk in results:
                            buffer.append(chunk)
                        results = "".join(buffer)
                    if result is not None:
                        # 将结果添加到results列表中
                        results.append(json.dumps(result))
                # 将所有结果拼接成一个连续的字符串
                combined_results = ''.join(results)
                if combined_results:
                    results = combined_results
                else:
                    results = None
                if results is None:
                    break
                if response_content.name in ["query_knowledge_base"]:
                    if settings["KBSettings"]["is_rerank"]:
                        results = await rerank_knowledge_base(user_prompt,results)
                    results = json.dumps(results, ensure_ascii=False, indent=4)
                protocol_tool_name = sanitize_tool_name(response_content.name, "tool")
                request.messages.append(
                    {
                        "tool_calls": [
                            {
                                "id": assistant_message.tool_calls[0].id,
                                "function": {
                                    "arguments": response_content.arguments,
                                    "name": protocol_tool_name,
                                },
                                "type": assistant_message.tool_calls[0].type,
                            }
                        ],
                        "role": "assistant",
                        "content": "",
                        "reasoning_content": "",
                    }
                )
                request.messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": assistant_message.tool_calls[0].id,
                        "name": protocol_tool_name,
                        "content": str(results),
                    }
                )
            if settings['webSearch']['when'] == 'after_thinking' or settings['webSearch']['when'] == 'both':
                content_append(request.messages, 'user',  f"\n对于联网搜索的结果，如果联网搜索的信息不足以回答问题时，你可以进一步使用联网搜索查询还未给出的必要信息。如果已经足够回答问题，请直接回答问题。")
            reasoner_messages.append(
                {
                    "role": "assistant",
                    "content": str(response_content),
                    "reasoning_content": "",
                }
            )
            reasoner_messages.append(
                {
                    "role": "user",
                    "content": f"{response_content.name}工具结果："+str(results),
                }
            )
            if settings['reasoner']['enabled'] or enable_thinking:
                if tools:
                    content_append(reasoner_messages, 'system',  f"可用工具：{json.dumps(tools)}")
                for modelProvider in settings['modelProviders']: 
                    if modelProvider['id'] == settings['reasoner']['selectedProvider']:
                        vendor = modelProvider['vendor']
                        break
                msg = await images_add_in_messages(reasoner_messages, images,settings)
                if vendor == 'Ollama':
                    reasoner_response = await reasoner_client.chat.completions.create(
                        model=settings['reasoner']['model'],
                        messages=msg,
                        stream=False,
                        temperature=settings['reasoner']['temperature'],
                        **reasoner_extra
                    )
                    # 将推理结果中的思考内容提取出来
                    reasoning_content = reasoner_response.model_dump()['choices'][0]['message']['content']
                    # open_tag和close_tag之间的内容
                    start_index = reasoning_content.find(open_tag) + len(open_tag)
                    end_index = reasoning_content.find(close_tag)
                    if start_index != -1 and end_index != -1:
                        reasoning_content = reasoning_content[start_index:end_index]
                    else:
                        reasoning_content = ""
                    content_prepend(request.messages, 'assistant', reasoning_content) # 可参考的推理过程
                else:
                    reasoner_response = await reasoner_client.chat.completions.create(
                        model=settings['reasoner']['model'],
                        messages=msg,
                        stream=False,
                        stop=settings['reasoner']['stop_words'],
                        temperature=settings['reasoner']['temperature'],
                        **reasoner_extra
                    )
                    content_prepend(request.messages, 'assistant', reasoner_response.model_dump()['choices'][0]['message']['reasoning_content']) # 可参考的推理过程
            _consume_kernel_live_guidance(request, "complete_tool_loop_before_llm")
            msg = await images_add_in_messages(request.messages, images,settings)
            if request.top_p != 1 or settings['top_p'] != 1:
                extra['top_p'] = request.top_p or settings['top_p']
            if tools:
                response = await client.chat.completions.create(
                    model=model,
                    messages=msg,  # 添加图片信息到消息
                    temperature=request.temperature or settings['temperature'],
                    tools=tools,
                    stream=False,
                    extra_body = extra_params, # 其他参数
                    **extra
                )
            else:
                response = await client.chat.completions.create(
                    model=model,
                    messages=msg,  # 添加图片信息到消息
                    temperature=request.temperature or settings['temperature'],
                    stream=False,
                    extra_body = extra_params, # 其他参数
                    **extra
                )
            if response.choices[0].message.tool_calls:
                pass
            elif settings['tools']['deepsearch']['enabled'] or enable_deep_research: 
                search_prompt = get_drs_stage_system_message(DRS_STAGE,user_prompt,response.choices[0].message.content)
                research_response = await client.chat.completions.create(
                    model=model,
                    messages=[
                        {
                        "role": "user",
                        "content": search_prompt,
                        }
                    ],
                    temperature=0.5,
                    extra_body = extra_params, # 其他参数
                )
                response_content = research_response.choices[0].message.content
                # 用re 提取```json 包裹json字符串 ```
                if "```json" in response_content:
                    try:
                        response_content = re.search(r'```json(.*?)```', response_content, re.DOTALL).group(1)
                    except:
                        # 用re 提取```json 之后的内容
                        response_content = re.search(r'```json(.*?)', response_content, re.DOTALL).group(1)
                response_content = json.loads(response_content)
                if response_content["status"] == "done":
                    search_not_done = False
                elif response_content["status"] == "not_done":
                    search_not_done = True
                    search_task = response_content["unfinished_task"]
                    task_prompt = f"请继续完成初始任务中未完成的任务：\n\n{search_task}\n\n初始任务：{user_prompt}\n\n最后，请给出完整的初始任务的最终结果。"
                    request.messages.append(
                        {
                            "role": "assistant",
                            "content": research_response.choices[0].message.content,
                            "reasoning_content": "",
                        }
                    )
                    request.messages.append(
                        {
                            "role": "user",
                            "content": task_prompt,
                        }
                    )
                elif response_content["status"] == "need_more_info":
                    DRS_STAGE = 2
                    search_not_done = False
                elif response_content["status"] == "need_work":
                    DRS_STAGE = 2
                    search_not_done = True
                    drs_msg = get_drs_stage(DRS_STAGE)
                    request.messages.append(
                        {
                            "role": "assistant",
                            "content": research_response.choices[0].message.content,
                            "reasoning_content": "",
                        }
                    )
                    request.messages.append(
                        {
                            "role": "user",
                            "content": drs_msg,
                        }
                    )
                elif response_content["status"] == "need_more_work":
                    DRS_STAGE = 2
                    search_not_done = True
                    search_task = response_content["unfinished_task"]
                    task_prompt = f"请继续查询如下信息：\n\n{search_task}\n\n初始任务：{user_prompt}\n\n"
                    request.messages.append(
                        {
                            "role": "assistant",
                            "content": research_response.choices[0].message.content,
                            "reasoning_content": "",
                        }
                    )
                    request.messages.append(
                        {
                            "role": "user",
                            "content": task_prompt,
                        }
                    )
                elif response_content["status"] == "answer":
                    DRS_STAGE = 3
                    search_not_done = True
                    drs_msg = get_drs_stage(DRS_STAGE)
                    request.messages.append(
                        {
                            "role": "assistant",
                            "content": research_response.choices[0].message.content,
                            "reasoning_content": "",
                        }
                    )
                    request.messages.append(
                        {
                            "role": "user",
                            "content": drs_msg,
                        }
                    )
       # 处理响应内容
        response_dict = response.model_dump()
        content = response_dict["choices"][0]['message']['content']
        if response_dict["choices"][0]['message'].get('reasoning_content',""):
            pass
        else:
            response_dict["choices"][0]['message']['reasoning_content'] = response_dict["choices"][0]['message'].get('reasoning',"")
        if open_tag in content and close_tag in content:
            reasoning_content = re.search(fr'{open_tag}(.*?)\{close_tag}', content, re.DOTALL)
            if reasoning_content:
                # 存储到 reasoning_content 字段
                response_dict["choices"][0]['message']['reasoning_content'] = reasoning_content.group(1).strip()
                # 移除原内容中的标签部分
                response_dict["choices"][0]['message']['content'] = re.sub(fr'{open_tag}(.*?)\{close_tag}', '', content, flags=re.DOTALL).strip()
        # --- [Brain Loop: Post-Neural] 从非流式对话中结晶认知符号 ---
        _complete_content = response_dict["choices"][0]['message']['content']
        _neuro_post_c = settings.get('neuroSettings', {}).get('enabled', True)
        if _neuro_post_c and symbol_store and _complete_content and not request.is_sub_agent:
            if kernel:
                try:
                    _user_text_cc = user_prompt if isinstance(user_prompt, str) else str(user_prompt)
                    await kernel.post_neural(
                        user_text=_user_text_cc,
                        assistant_output=_complete_content,
                        tools_used=[],
                        success=True,
                        settings=settings,
                        symbol_store=symbol_store,
                        fast_client=fast_client,
                        is_sub_agent=False,
                    )
                except Exception as _kp_err_c:
                    logger.debug(f"[Kernel] Post-Neural (complete) failed: {_kp_err_c}")
            else:
                try:
                    _label_c = (user_prompt[:80] if isinstance(user_prompt, str) else str(user_prompt)[:80])
                    _user_text_cc = user_prompt if isinstance(user_prompt, str) else str(user_prompt)
                    _all_text_cc = f"{_user_text_cc} {_complete_content[:2000]}"

                    _llm_facts_c = None
                    if fast_client:
                        try:
                            _fast_model_c = settings.get('fast', {}).get('model', '') or 'gpt-4o-mini'
                            _llm_facts_c = await LLMFactExtractor.extract_with_llm(
                                _all_text_cc, fast_client, model=_fast_model_c
                            )
                            if _llm_facts_c and _llm_facts_c.get('source') == 'llm':
                                _label_c = _llm_facts_c.get('label', _label_c) or _label_c
                        except Exception:
                            pass

                    _new_sym_c = SymbolCrystallizer.crystallize(
                        label=_label_c,
                        user_input=_user_text_cc,
                        assistant_output=_complete_content[:2000],
                        tools_used=[],
                        success=True
                    )

                    if _llm_facts_c and _llm_facts_c.get('source') == 'llm':
                        _new_sym_c.K.entities = _llm_facts_c.get('entities', _new_sym_c.K.entities)
                        _new_sym_c.K.relations = _llm_facts_c.get('relations', _new_sym_c.K.relations)
                        _op_c = _llm_facts_c.get('operator', '')
                        if _op_c in VALID_OPERATORS:
                            _new_sym_c.operator = _op_c

                    symbol_store.store(_new_sym_c)
                    _src_c = _llm_facts_c.get('source', 'regex') if _llm_facts_c else 'regex'
                    logger.info(f"[BrainLoop] Post-Neural (complete): crystallized symbol {_new_sym_c.id} src={_src_c}")
                except Exception as _bl_post_err_c:
                    logger.warning(f"[BrainLoop] Post-Neural crystallize skipped: {_bl_post_err_c}")

        if m0:
            messages=f"用户说：{user_prompt}\n\n---\n\n你说：{_complete_content}"
            executor = ThreadPoolExecutor()
            infer = cur_memory.get('infer') or False
            async def add():
                loop = asyncio.get_event_loop()
                # 绑定 user_id 关键字参数
                metadata = {
                    "timetamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                }
                func = partial(m0.add, user_id=memoryId,metadata=metadata,infer=infer)
                # 传递 messages 作为位置参数
                await loop.run_in_executor(executor, func, messages)
                print("知识库更新完成")

            asyncio.create_task(add())

        if not request.is_sub_agent:
            _persist_workspace_session_memory(
                settings,
                user_prompt,
                _complete_content,
                model=getattr(request, "model", "") or "",
                source="complete_chat",
            )
        return JSONResponse(content=response_dict)
    except Exception as e:
        return _build_error_response_from_exception(e)

@app.post("/execute_tool_manually")
async def execute_tool_manually(request: Request):
    """Execute one manual tool command from the compatibility HTTP route."""

    data = await request.json()
    return await _execute_tool_manually_payload(data)


async def _execute_tool_manually_payload(data: Dict[str, Any]) -> Dict[str, Any]:
    """Execute one validated manual tool payload through the governed registry."""

    tool_name = data.get("tool_name")
    tool_params = data.get("tool_params") or {}
    approval_type = data.get("approval_type") # 'once' 或 'always'
    approval_id = data.get("approval_id") or data.get("approvalId") or ""
    parent_trace_id = data.get("trace_id") or data.get("traceId") or data.get("kernel_trace_id") or ""
    
    # 获取当前配置
    settings = await load_settings()
    cwd = settings.get("CLISettings", {}).get("cc_path")

    validation = None
    if approval_id:
        validation = get_approval_center().validate_for_execution(
            approval_id,
            tool_name=tool_name,
            tool_params=tool_params,
            workspace_dir=cwd or "",
        )
        if not validation.get("ok"):
            return {"result": f"[Permission] Approval rejected: {validation.get('reason', 'invalid_approval')}"}
        approval_record = validation.get("approval") or {}
        parent_trace_id = parent_trace_id or approval_record.get("trace_id") or ""
    
    # ==================== 核心逻辑：处理 "Always" ====================
    if approval_type == "always":
        # 如果用户选择“不再询问”，则将该工具写入当前项目的 .agent/config.json
        if cwd:
            try:
                add_tool_to_project_config(cwd, tool_name)
                print(f"[Permission] Added {tool_name} to whitelist for project {cwd}")
            except Exception as e:
                return {"result": f"[System Error] Failed to save permission: {str(e)}"}
        else:
             return {"result": "[System Error] No working directory found to save config."}

    if approval_id:
        resolved = get_approval_center().resolve(
            approval_id,
            "approved",
            actor="user",
            reason=f"manual_execute:{approval_type or 'once'}",
            consume=True,
            workspace_dir=cwd or "",
        )
        if not resolved.get("ok"):
            return {"result": f"[Permission] Approval rejected: {resolved.get('reason', 'invalid_approval')}"}

    from py.execution_tool_registry import build_execution_tool_registry

    registry = build_execution_tool_registry({
        "openxnet_parse_config_intent": openxnet_parse_config_intent,
        "openxnet_apply_config_intent": openxnet_apply_config_intent,
        "get_image_content": get_image_content,
    })
    _TOOL_HOOKS = registry.hooks
    

    if tool_name not in _TOOL_HOOKS:
        return {"result": f"Tool {tool_name} not found in backend registry."}
    
    tool_func = _TOOL_HOOKS[tool_name]
    
    try:
        from py.kernel.executor import get_kernel_executor

        async def _manual_tool_call():
            """Invoke the selected legacy hook and collect async generator output."""

            result = await tool_func(**tool_params)
            if hasattr(result, "__aiter__"):
                output_buffer = []
                async for chunk in result:
                    output_buffer.append(chunk)
                return "".join(output_buffer)
            return result

        result = await get_kernel_executor().execute_tool(
            tool_name=tool_name,
            tool_params=tool_params,
            settings=settings,
            legacy_call=_manual_tool_call,
            actor="user",
            approval_id=approval_id,
            metadata={
                "manual_execute": True,
                "approval_type": approval_type or "once",
                "parent_trace_id": parent_trace_id,
                "approval_trace_role": "execution" if approval_id else "",
            },
        )
        return {"result": str(result)}

    except Exception as e:
        return {"result": f"Error executing {tool_name}: {str(e)}"}


async def _resolve_chat_tool_approval_payload(data: Dict[str, Any]) -> Dict[str, Any]:
    """Resolve one Desktop Chat approval against the configured workspace."""

    current_settings = await load_settings()
    workspace = (
        current_settings.get("CLISettings", {}).get("cc_path", "")
        if isinstance(current_settings, dict)
        else ""
    )
    return get_approval_center().resolve(
        str(data.get("approval_id") or ""),
        str(data.get("resolution") or ""),
        actor="user",
        reason=str(data.get("reason") or ""),
        consume=bool(data.get("consume", True)),
        workspace_dir=str(workspace or ""),
    )

# 在现有路由后添加以下代码
@app.get("/v1/models")
async def get_models():
    """
    获取模型列表
    """
    from openai.types import Model
    from openai.pagination import SyncPage
    try:
        # 重新加载最新设置
        current_settings = await load_settings()
        agents = current_settings['agents']
        # 构造符合 OpenAI 格式的 Model 对象
        model_data = [
            Model(
                id=agent["name"],  
                created=0,  
                object="model",
                owned_by="super-agent-party"  # 非空字符串
            )
            for agent in agents.values()  
        ]
        # 添加默认的 'openxnet-model'
        model_data.append(
            Model(
                id='openxnet-model',
                created=0,
                object="model",
                owned_by="super-agent-party"  # 非空字符串
            )
        )

        # 构造完整 SyncPage 响应
        response = SyncPage[Model](
            object="list",
            data=model_data,
            has_more=False  # 添加分页标记
        )
        # 直接返回模型字典，由 FastAPI 自动序列化为 JSON
        return response.model_dump()  
        
    except Exception as e:
        return _build_error_response_from_exception(e)

# ═══════════════════════════════════════════════════════
# Synapse v1.0 API 端点
# ═══════════════════════════════════════════════════════

@app.get("/v1/synapse/stats")
async def synapse_stats():
    """获取 Synapse 统计信息 (总工具数、成功率、Top 10)"""
    global synapse_registry
    if not synapse_registry:
        return JSONResponse(status_code=503, content={"error": "Synapse not initialized"})
    stats = synapse_registry.get_stats()
    return JSONResponse(content=stats)


@app.get("/v1/synapse/tools")
async def synapse_tools(type: str = None, limit: int = 50):
    """按权重排序返回工具列表"""
    global synapse_registry
    if not synapse_registry:
        return JSONResponse(status_code=503, content={"error": "Synapse not initialized"})
    ranked = synapse_registry.get_ranked_tools(tool_type=type)
    tools = [n.to_dict() for n in ranked[:limit]]
    return JSONResponse(content={"tools": tools, "total": len(ranked)})


@app.post("/v1/synapse/register")
async def synapse_register(request: Request):
    """注册新工具为突触节点"""
    global synapse_registry
    if not synapse_registry:
        return JSONResponse(status_code=503, content={"error": "Synapse not initialized"})
    body = await request.json()
    name = body.get("name")
    tool_type = body.get("type", "custom")
    description = body.get("description", "")
    metadata = body.get("metadata", {})
    if not name:
        return JSONResponse(status_code=400, content={"error": "'name' is required"})
    node = synapse_registry.register(name, tool_type, description, metadata)
    return JSONResponse(content={"status": "registered", "node": node.to_dict()})


@app.post("/v1/synapse/event")
async def synapse_event(request: Request):
    """记录工具事件 (success/failure/selection/start)"""
    global synapse_registry
    if not synapse_registry:
        return JSONResponse(status_code=503, content={"error": "Synapse not initialized"})
    body = await request.json()
    name = body.get("name")
    event = body.get("event")  # 'start' | 'success' | 'failure' | 'selection'
    if not name or not event:
        return JSONResponse(status_code=400, content={"error": "'name' and 'event' are required"})
    
    if event == "start":
        synapse_registry.on_call_start(name)
    elif event == "success":
        latency_ms = body.get("latency_ms", 0)
        synapse_registry.on_call_success(name, latency_ms=latency_ms)
    elif event == "failure":
        error = body.get("error", "")
        synapse_registry.on_call_failure(name, error=error)
    elif event == "selection":
        synapse_registry.on_user_selection(name)
    else:
        return JSONResponse(status_code=400, content={"error": f"Unknown event: {event}"})
    
    node = synapse_registry.get(name)
    return JSONResponse(content={
        "status": "ok",
        "event": event,
        "node": node.to_dict() if node else None
    })

# ═══════════════════════════════════════════════════════
# NeuroSymbol v1.0 认知符号 API 端点
# ═══════════════════════════════════════════════════════

@app.get("/v1/neuro/symbols")
async def neuro_list_symbols(operator: str = None, entity: str = None, limit: int = 100, offset: int = 0):
    """列出认知符号 (支持按算子/实体过滤)"""
    global symbol_store
    if not symbol_store:
        return JSONResponse(status_code=503, content={"error": "NeuroSymbol store not initialized"})
    try:
        all_symbols = symbol_store.all()
        # 过滤
        if operator:
            all_symbols = [s for s in all_symbols if s.operator == operator]
        if entity:
            entity_lower = entity.lower()
            all_symbols = [s for s in all_symbols if any(entity_lower in e.lower() for e in s.K.entities)]
        total = len(all_symbols)
        page = all_symbols[offset:offset + limit]
        return JSONResponse(content={
            "symbols": [s.to_dict() for s in page],
            "total": total,
            "offset": offset,
            "limit": limit
        })
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/v1/neuro/symbols/{symbol_id}")
async def neuro_get_symbol(symbol_id: str):
    """获取单个认知符号详情"""
    global symbol_store
    if not symbol_store:
        return JSONResponse(status_code=503, content={"error": "NeuroSymbol store not initialized"})
    sym = symbol_store.get(symbol_id)
    if not sym:
        return JSONResponse(status_code=404, content={"error": "Symbol not found"})
    return JSONResponse(content=sym.to_dict())


@app.post("/v1/neuro/symbols")
async def neuro_create_symbol(request: Request):
    """创建新的认知符号"""
    global symbol_store
    if not symbol_store:
        return JSONResponse(status_code=503, content={"error": "NeuroSymbol store not initialized"})
    try:
        body = await request.json()
        sym = NeuroSymbol(
            operator=body.get("operator", "ConsolidateKnowledge"),
            Q=body.get("Q", ""),
            K=body.get("K", {}),
            z=body.get("z", []),
            label=body.get("label", ""),
            meta=body.get("meta", {})
        )
        symbol_store.store(sym)
        return JSONResponse(content={"status": "created", "symbol": sym.to_dict()})
    except Exception as e:
        return JSONResponse(status_code=400, content={"error": str(e)})


@app.delete("/v1/neuro/symbols/{symbol_id}")
async def neuro_delete_symbol(symbol_id: str):
    """删除认知符号"""
    global symbol_store
    if not symbol_store:
        return JSONResponse(status_code=503, content={"error": "NeuroSymbol store not initialized"})
    deleted = symbol_store.remove(symbol_id)
    if not deleted:
        return JSONResponse(status_code=404, content={"error": "Symbol not found"})
    return JSONResponse(content={"status": "deleted", "id": symbol_id})


@app.post("/v1/neuro/match")
async def neuro_match(request: Request):
    """Brain Loop 核心 — 输入文本/实体 → 匹配相关认知符号"""
    global symbol_store
    if not symbol_store:
        return JSONResponse(status_code=503, content={"error": "NeuroSymbol store not initialized"})
    try:
        body = await request.json()
        text = body.get("text", "")
        entities = body.get("entities", [])
        operator = body.get("operator") or None
        top_k = body.get("top_k", body.get("topK", 5))
        results = symbol_store.match(text=text, entities=entities, operator=operator, top_k=top_k)
        # 构建 contextBlock 用于 LLM 上下文注入
        context_block = symbol_store.format_for_context(results)
        return JSONResponse(content={
            "matches": [{"symbol": r["symbol"].to_dict(), "score": r["score"], "matchType": r["matchType"]} for r in results],
            "contextBlock": context_block,
            "count": len(results),
        })
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/v1/neuro/stats")
async def neuro_stats():
    """获取符号库统计信息 (算子分布/成功率/大小)"""
    global symbol_store
    if not symbol_store:
        return JSONResponse(status_code=503, content={"error": "NeuroSymbol store not initialized"})
    stats = symbol_store.get_stats()
    return JSONResponse(content=stats)


@app.get("/v1/neuro/graph")
async def neuro_graph():
    """获取知识图谱数据 (nodes + edges) 用于前端 D3.js/SVG 渲染"""
    global symbol_store
    if not symbol_store:
        return JSONResponse(status_code=503, content={"error": "NeuroSymbol store not initialized"})
    graph = symbol_store.get_graph()
    return JSONResponse(content=graph)


@app.post("/v1/neuro/crystallize")
async def neuro_crystallize(request: Request):
    """Post-Neural 结晶 — 从对话内容中提取事实并生成认知符号"""
    global symbol_store
    if not symbol_store:
        return JSONResponse(status_code=503, content={"error": "NeuroSymbol store not initialized"})
    try:
        body = await request.json()
        user_text = body.get("user_text", "")
        assistant_text = body.get("assistant_text", "")
        label = body.get("label", "") or user_text[:80]
        tools_used = body.get("tools_used", [])
        success = body.get("success", True)
        
        if not label and not user_text:
            return JSONResponse(content={"status": "no_input", "symbol": None})
        
        new_symbol = SymbolCrystallizer.crystallize(
            label=label,
            user_input=user_text,
            assistant_output=assistant_text,
            tools_used=tools_used,
            success=success
        )
        symbol_store.store(new_symbol)
        return JSONResponse(content={
            "status": "crystallized",
            "symbol": new_symbol.to_dict()
        })
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


# ============================================================================
# [v0.5.1] Temporal Knowledge Graph API
# ============================================================================

@app.get("/v1/neuro/kg/stats")
async def neuro_kg_stats():
    """获取时序知识图谱统计信息"""
    kg = get_temporal_kg()
    if not kg:
        return JSONResponse(status_code=503, content={"error": "Temporal KG not initialized"})
    return JSONResponse(content=kg.stats())


@app.get("/v1/neuro/kg/graph")
async def neuro_kg_graph(limit: int = 200):
    """读取有界时序知识图谱；输入最大边数，返回公开节点和边，非法范围时使用安全边界。"""
    kg = get_temporal_kg()
    if not kg:
        return JSONResponse(status_code=503, content={"error": "Temporal KG not initialized"})
    return JSONResponse(content=kg.get_graph(limit=max(1, min(int(limit), 500))))


@app.get("/v1/neuro/kg/versions")
async def neuro_kg_versions():
    """列出 Temporal KG 的版本标签"""
    kg = get_temporal_kg()
    if not kg:
        return JSONResponse(status_code=503, content={"error": "Temporal KG not initialized"})
    versions = kg.get_versions()
    return JSONResponse(content={"versions": versions, "count": len(versions)})


@app.post("/v1/neuro/kg/version-tag")
async def neuro_kg_tag_version(request: Request):
    """为 Temporal KG 打版本标签"""
    kg = get_temporal_kg()
    if not kg:
        return JSONResponse(status_code=503, content={"error": "Temporal KG not initialized"})
    try:
        body = await request.json()
        version = str(body.get("version") or "").strip()
        if not version:
            return JSONResponse(status_code=400, content={"error": "version required"})
        label = str(body.get("label") or version).strip()
        metadata = body.get("metadata") if isinstance(body.get("metadata"), dict) else {}
        tagged = kg.tag_version(version, label=label, metadata=metadata)
        versions = kg.get_versions()
        latest = next((item for item in versions if item.get("version") == tagged), None)
        return JSONResponse(content={"status": "ok", "version": tagged, "tag": latest})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/v1/neuro/kg/entity/{entity_name}")
async def neuro_kg_query_entity(entity_name: str, as_of: str = None):
    """查询实体的所有关系（支持时间旅行)"""
    kg = get_temporal_kg()
    if not kg:
        return JSONResponse(status_code=503, content={"error": "Temporal KG not initialized"})
    facts = kg.query_entity(entity_name, as_of=as_of)
    context = kg.format_for_context(entity_name)
    return JSONResponse(content={
        "entity": entity_name,
        "facts": facts,
        "contextBlock": context,
        "count": len(facts),
    })


@app.post("/v1/neuro/kg/triple")
async def neuro_kg_add_triple(request: Request):
    """手动添加知识三元组"""
    kg = get_temporal_kg()
    if not kg:
        return JSONResponse(status_code=503, content={"error": "Temporal KG not initialized"})
    try:
        body = await request.json()
        triple_id = kg.add_triple(
            subject=body["subject"],
            predicate=body["predicate"],
            obj=body["object"],
            valid_from=body.get("valid_from"),
            valid_to=body.get("valid_to"),
            confidence=body.get("confidence", 1.0),
        )
        return JSONResponse(content={"status": "created", "triple_id": triple_id})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.post("/v1/neuro/kg/invalidate")
async def neuro_kg_invalidate(request: Request):
    """标记知识三元组过期（软删除）"""
    kg = get_temporal_kg()
    if not kg:
        return JSONResponse(status_code=503, content={"error": "Temporal KG not initialized"})
    try:
        body = await request.json()
        kg.invalidate(
            subject=body["subject"],
            predicate=body["predicate"],
            obj=body["object"],
            ended=body.get("ended"),
        )
        return JSONResponse(content={"status": "invalidated"})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


# ============================================================================
# [v0.5.1] Memory Decay & Rules API
# ============================================================================

@app.post("/v1/neuro/maintenance")
async def neuro_maintenance():
    """手动触发记忆衰减+清理维护（开发调试用）"""
    global symbol_store
    if not symbol_store:
        return JSONResponse(status_code=503, content={"error": "NeuroSymbol store not initialized"})
    try:
        result = symbol_store.perform_sleep_maintenance()
        return JSONResponse(content={"status": "completed", **result})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/v1/neuro/rules")
async def neuro_list_rules():
    """获取所有已注册的认知规则"""
    try:
        registry = get_rule_registry()
        return JSONResponse(content=registry.to_dict())
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

# ============================================================================
# [v0.5.2] QueryEngine & Plugin SDK API
# ============================================================================

@app.get("/v1/engine/status")
async def engine_status():
    """获取 QueryEngine 和 Plugin SDK 状态"""
    try:
        plugin_reg = get_plugin_registry()
        current_settings = await load_settings()
        return JSONResponse(content={
            "version": "0.5.2",
            "queryEngineEnabled": current_settings.get("useQueryEngine", False),
            "registeredPlugins": [t.name for t in plugin_reg.get_all_tools()],
            "pluginCount": len(plugin_reg.get_all_tools()),
        })
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/v1/engine/plugins")
async def engine_plugins():
    """列出所有已注册的 Plugin SDK 工具"""
    try:
        plugin_reg = get_plugin_registry()
        plugins = []
        for tool in plugin_reg.get_all_tools():
            plugins.append({
                "name": tool.name,
                "description": tool.description,
                "requiresPermission": tool.requires_permission,
                "schema": tool.to_openai_schema(),
            })
        return JSONResponse(content={"plugins": plugins, "count": len(plugins)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.post("/v1/engine/toggle")
async def engine_toggle(request: Request):
    """切换 QueryEngine 开关（开发调试用）"""
    try:
        body = await request.json()
        enabled = body.get("enabled", False)
        current_settings = await load_settings()
        current_settings["useQueryEngine"] = enabled
        await save_settings(current_settings)
        logger.info(f"[v0.5.2] QueryEngine {'ENABLED' if enabled else 'DISABLED'}")
        return JSONResponse(content={"status": "ok", "queryEngineEnabled": enabled})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.get("/v1/engine/interrupted")
async def engine_interrupted():
    """[P1] 检测上次崩溃中断的对话 turn"""
    try:
        cp = get_engine_checkpoint()
        if not cp:
            return JSONResponse(content={"interrupted": [], "count": 0})
        turns = cp.get_interrupted_turns()
        return JSONResponse(content={
            "interrupted": turns,
            "count": len(turns),
            "message": f"发现 {len(turns)} 个未完成的对话" if turns else "无中断对话",
        })
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.post("/v1/engine/interrupted/{turn_id}/resume")
async def engine_resume_interrupted(turn_id: str):
    """[v071] 生成中断对话的恢复提示，并标记该 turn 已处理。"""
    try:
        cp = get_engine_checkpoint()
        if not cp:
            return JSONResponse(status_code=404, content={"error": "engine checkpoint not initialized"})

        resume_payload = cp.get_turn(turn_id)
        if not resume_payload:
            return JSONResponse(status_code=404, content={"error": f"turn not found: {turn_id}"})

        resolved_turn = cp.resolve_interrupted_turn(turn_id, final_state="RESUMED")
        return JSONResponse(content={
            "status": "ok",
            "message": "已生成恢复提示并标记该中断 turn 为已恢复",
            "resume": resume_payload,
            "resume_prompt": resume_payload.get("resume_prompt", ""),
            "turn": resolved_turn or resume_payload,
        })
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/v1/engine/history")
async def engine_history():
    """[P1] 获取最近的引擎 turn 历史"""
    try:
        cp = get_engine_checkpoint()
        if not cp:
            return JSONResponse(content={"turns": [], "count": 0})
        turns = cp.get_recent_turns(limit=20)
        return JSONResponse(content={"turns": turns, "count": len(turns)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/v1/engine/checkpoints")
async def engine_git_checkpoints():
    """[P0] 列出工作区的 Git Shadow Checkpoints"""
    try:
        current_settings = await load_settings()
        cwd = current_settings.get("CLISettings", {}).get("cc_path")
        if not cwd:
            return JSONResponse(content={"checkpoints": [], "message": "无工作区路径"})
        
        from py.git_shadow import git_list_checkpoints
        checkpoints = await git_list_checkpoints(cwd, count=30)
        return JSONResponse(content={
            "checkpoints": checkpoints,
            "count": len(checkpoints),
            "workspace": cwd,
        })
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/v1/engine/decisions")
async def engine_workspace_decisions():
    """[P1] 列出工作区最近的 Decision Log 记录"""
    try:
        current_settings = await load_settings()
        cwd = current_settings.get("CLISettings", {}).get("cc_path")
        if not cwd:
            return JSONResponse(content={"decisions": [], "message": "无工作区路径"})

        from py.git_shadow import list_workspace_decisions

        decisions = list_workspace_decisions(cwd, count=30)
        return JSONResponse(
            content={
                "decisions": decisions,
                "count": len(decisions),
                "workspace": cwd,
            }
        )
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.post("/v1/engine/rollback")
async def engine_git_rollback(request: Request):
    """[P0] 回滚/恢复工作区检查点（Git + File Shadow）"""
    try:
        body = await request.json()
        checkpoint_id = body.get("checkpoint_id") or body.get("commit_hash")
        if not checkpoint_id:
            return JSONResponse(status_code=400, content={"error": "checkpoint_id required"})
        
        current_settings = await load_settings()
        cwd = current_settings.get("CLISettings", {}).get("cc_path")
        if not cwd:
            return JSONResponse(status_code=400, content={"error": "无工作区路径"})
        
        from py.git_shadow import rollback_workspace_checkpoint
        result = await rollback_workspace_checkpoint(cwd, checkpoint_id)
        if str(result).startswith("Error:"):
            return JSONResponse(status_code=400, content={"error": result})
        return JSONResponse(content={"status": "ok", "message": result, "checkpoint_id": checkpoint_id})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


# 在现有路由后添加以下代码
@app.get("/v1/agents",operation_id="get_agents")
async def get_agents():
    """
    获取模型列表
    """
    from openai.types import Model
    from openai.pagination import SyncPage
    try:
        # 重新加载最新设置
        current_settings = await load_settings()
        agents = current_settings['agents']
        # 构造符合 OpenAI 格式的 Model 对象
        model_data = [
            {
                "name": agent["name"],
                "description": agent["system_prompt"],
            }
            for agent in agents.values()  
        ]
        # 添加默认的 'openxnet-model'
        model_data.append(
            {
                "name": 'openxnet-model',
                "description": "Super-Agent-Party default agent",
            }
        )
        return model_data
        
    except Exception as e:
        return _build_error_response_from_exception(e)

class AccessSMSCodeRequest(BaseModel):
    phone: str
    purpose: str = "login"


class AccessPasswordLoginRequest(BaseModel):
    identity: str
    password: str
    terms_accepted: bool = False
    privacy_accepted: bool = False
    agreements_accepted: bool = False
    agreements_locale: str = ""


class AccessSMSLoginRequest(BaseModel):
    phone: str
    code: str
    terms_accepted: bool = False
    privacy_accepted: bool = False
    agreements_accepted: bool = False
    agreements_locale: str = ""


class AccessRegisterRequest(BaseModel):
    phone: str
    code: str
    password: str
    nickname: str = ""
    email: str = ""
    terms_accepted: bool = False
    privacy_accepted: bool = False
    agreements_accepted: bool = False
    agreements_locale: str = ""


class AccessRefreshRequest(BaseModel):
    refresh_token: str


class AccessPurchaseRequest(BaseModel):
    plan_code: str
    billing_cycle: str = "monthly"
    pay_type: str = "alipay"
    return_url: Optional[str] = None


class AccessPlanActionRequest(BaseModel):
    plan_code: str
    pay_type: str = "alipay"
    return_url: Optional[str] = None


class AccessTopupRequest(BaseModel):
    amount: float
    pay_type: str = "alipay"
    return_url: Optional[str] = None


class ProviderModelRequest(BaseModel):
    url: str
    api_key: str


class DevWorkbenchProviderApplyRequest(BaseModel):
    provider_id: Optional[Any] = None
    vendor: Optional[str] = None
    url: str
    api_key: str = ""
    model_id: str = ""
    preserve_api_key: bool = False


class DevWorkbenchProviderValidateRequest(BaseModel):
    provider_id: Optional[Any] = None
    vendor: Optional[str] = None
    url: str
    api_key: str = ""
    model_id: Optional[str] = None
    preserve_api_key: bool = False


class DevWorkbenchMappingApplyRequest(BaseModel):
    agent_id: str
    sync_provider_model: bool = True


class DevWorkbenchWorkspaceApplyRequest(BaseModel):
    workspace_dir: Optional[str] = None
    enabled: bool = True
    engine: str = "local"
    permission_mode: str = "default"
    visibility_scope: str = "workspace"


def _normalize_access_legal_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    normalized = dict(payload or {})
    accepted = bool(normalized.get("agreements_accepted"))
    normalized["terms_accepted"] = bool(normalized.get("terms_accepted")) or accepted
    normalized["privacy_accepted"] = bool(normalized.get("privacy_accepted")) or accepted
    normalized.pop("agreements_accepted", None)
    return normalized

@app.get("/v1/access/plans")
async def access_list_plans(request: Request):
    payload = await _request_openxnet_login_json(
        "GET",
        "/sub/plans",
        access_token=_extract_proxy_access_token(request),
    )
    return JSONResponse(content=payload)


@app.post("/v1/access/auth/sms/send")
async def access_send_sms_code(req: AccessSMSCodeRequest):
    payload = await _request_openxnet_login_json("POST", "/auth/sms/send", payload=req.model_dump())
    return JSONResponse(content=payload)


@app.post("/v1/access/auth/register")
async def access_register(req: AccessRegisterRequest):
    payload = await _request_openxnet_login_json(
        "POST",
        "/auth/register",
        payload=_normalize_access_legal_payload(req.model_dump()),
    )
    return JSONResponse(content=payload)


@app.post("/v1/access/auth/login/password")
async def access_login_password(req: AccessPasswordLoginRequest):
    payload = await _request_openxnet_login_json(
        "POST",
        "/auth/login/password",
        payload=_normalize_access_legal_payload(req.model_dump()),
    )
    return JSONResponse(content=payload)


@app.post("/v1/access/auth/login/sms")
async def access_login_sms(req: AccessSMSLoginRequest):
    payload = await _request_openxnet_login_json(
        "POST",
        "/auth/login/sms",
        payload=_normalize_access_legal_payload(req.model_dump()),
    )
    return JSONResponse(content=payload)


@app.post("/v1/access/auth/refresh")
async def access_refresh(req: AccessRefreshRequest):
    payload = await _request_openxnet_login_json("POST", "/auth/refresh", payload=req.model_dump())
    return JSONResponse(content=payload)


@app.get("/v1/access/auth/me")
async def access_current_user(request: Request):
    payload = await _request_openxnet_login_json(
        "GET",
        "/auth/me",
        access_token=_extract_proxy_access_token(request),
    )
    return JSONResponse(content=payload)


@app.post("/v1/access/auth/logout")
async def access_logout(request: Request):
    payload = await _request_openxnet_login_json(
        "POST",
        "/auth/logout",
        access_token=_extract_proxy_access_token(request),
    )
    return JSONResponse(content=payload)


@app.post("/v1/access/sub/purchase")
async def access_create_purchase(req: AccessPurchaseRequest, request: Request):
    payload = await _request_openxnet_login_json(
        "POST",
        "/sub/purchase",
        payload=req.model_dump(),
        access_token=_extract_proxy_access_token(request),
    )
    return JSONResponse(content=payload)


@app.post("/v1/access/sub/renew")
async def access_create_renew(req: AccessPlanActionRequest, request: Request):
    payload = await _request_openxnet_login_json(
        "POST",
        "/sub/renew",
        payload=req.model_dump(),
        access_token=_extract_proxy_access_token(request),
    )
    return JSONResponse(content=payload)


@app.get("/v1/access/sub/upgrade/preview")
async def access_preview_upgrade(new_plan_code: str, request: Request):
    payload = await _request_openxnet_login_json(
        "GET",
        f"/sub/upgrade/preview?new_plan_code={quote(str(new_plan_code), safe='')}",
        access_token=_extract_proxy_access_token(request),
    )
    return JSONResponse(content=payload)


@app.post("/v1/access/sub/upgrade")
async def access_create_upgrade(req: AccessPlanActionRequest, request: Request):
    payload = await _request_openxnet_login_json(
        "POST",
        "/sub/upgrade",
        payload=req.model_dump(),
        access_token=_extract_proxy_access_token(request),
    )
    return JSONResponse(content=payload)


@app.post("/v1/access/sub/topup")
async def access_create_topup(req: AccessTopupRequest, request: Request):
    payload = await _request_openxnet_login_json(
        "POST",
        "/sub/topup",
        payload=req.model_dump(),
        access_token=_extract_proxy_access_token(request),
    )
    return JSONResponse(content=payload)


@app.get("/v1/access/sub/credits")
async def access_read_credits(request: Request):
    payload = await _request_openxnet_login_json(
        "GET",
        "/sub/credits",
        access_token=_extract_proxy_access_token(request),
    )
    return JSONResponse(content=payload)


@app.get("/v1/access/sub/expiry-status")
async def access_read_expiry_status(request: Request):
    payload = await _request_openxnet_login_json(
        "GET",
        "/sub/expiry-status",
        access_token=_extract_proxy_access_token(request),
    )
    return JSONResponse(content=payload)


@app.get("/v1/access/sub/orders/{order_no}")
async def access_read_order(order_no: str, request: Request):
    payload = await _request_openxnet_login_json(
        "GET",
        f"/sub/orders/{order_no}",
        access_token=_extract_proxy_access_token(request),
    )
    return JSONResponse(content=payload)

@app.post("/v1/providers/models")
async def fetch_provider_models(request: ProviderModelRequest):
    try:
        # 使用传入的provider配置创建AsyncOpenAI客户端
        client = AsyncOpenAI(api_key=request.api_key, base_url=request.url)
        # 获取模型列表
        model_list = await client.models.list()
        # 提取模型ID并返回
        return JSONResponse(content={"data": [model.id for model in model_list.data]})
    except Exception as e:
        # 处理异常，返回错误信息
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/v1/dev/workbench/provider/validate")
async def developer_workbench_validate_provider_endpoint(req: DevWorkbenchProviderValidateRequest):
    current_settings = await load_settings()
    api_key = str(req.api_key or "").strip()
    if not api_key and req.preserve_api_key:
        api_key = _resolve_preserved_provider_api_key(current_settings, req.provider_id)
    validation = await _validate_provider_draft(
        vendor=req.vendor,
        url=req.url,
        api_key=api_key,
        model_id=req.model_id,
    )
    return JSONResponse(
        content={
            "success": True,
            "validation": validation,
        }
    )


@app.post("/v1/dev/workbench/provider/apply")
async def developer_workbench_apply_provider_endpoint(req: DevWorkbenchProviderApplyRequest):
    current_settings = await load_settings()
    vendor = str(req.vendor or "OpenAI").strip() or "OpenAI"
    url = str(req.url or "").strip()
    model_id = str(req.model_id or "").strip()
    api_key = str(req.api_key or "").strip()
    if not api_key and req.preserve_api_key:
        api_key = _resolve_preserved_provider_api_key(current_settings, req.provider_id)

    if not url:
        raise HTTPException(status_code=400, detail="provider base_url 不能为空")
    if RUNTIME_PROFILE == "server" and _is_local_agent_gateway_base_url(url):
        raise HTTPException(
            status_code=400,
            detail=f"当前 {APP_NAME} profile 不能把 {url} 作为上游 provider，这会指回自身。",
        )

    provider = _find_model_provider_by_id(current_settings, req.provider_id)
    if provider is None:
        provider = _find_equivalent_model_provider(
            current_settings,
            vendor=vendor,
            url=url,
            model_id=model_id,
        )
    model_providers = current_settings.setdefault("modelProviders", [])
    if not isinstance(model_providers, list):
        model_providers = []
        current_settings["modelProviders"] = model_providers

    if provider is None:
        provider = {
            "id": f"devwb-{int(time.time() * 1000)}",
            "vendor": vendor,
            "url": url,
            "apiKey": api_key,
            "modelId": model_id,
            "models": [model_id] if model_id else [],
        }
        model_providers.append(provider)
    else:
        provider["vendor"] = vendor
        provider["url"] = url
        provider["apiKey"] = api_key
        provider["modelId"] = model_id
        existing_models = [
            str(item or "").strip()
            for item in (provider.get("models") or [])
            if str(item or "").strip()
        ]
        provider["models"] = (
            [model_id] + [item for item in existing_models if item != model_id]
            if model_id
            else existing_models
        )

    _dedupe_model_providers(
        current_settings,
        preferred_provider_id=provider.get("id"),
    )
    provider = _find_model_provider_by_id(current_settings, provider.get("id")) or provider
    current_settings["selectedProvider"] = provider.get("id")
    current_settings["base_url"] = url
    current_settings["api_key"] = api_key
    current_settings["model"] = model_id or str(current_settings.get("model") or "").strip()
    await save_settings(current_settings)

    provider_state = _build_model_provider_runtime_state(current_settings)
    return JSONResponse(
        content={
            "success": True,
            "message": f"已为当前 {APP_NAME} profile 应用 provider 配置。",
            "provider": {
                "id": provider.get("id"),
                "vendor": provider.get("vendor"),
                "url": provider.get("url"),
                "modelId": provider.get("modelId"),
                "hasApiKey": bool(str(provider.get("apiKey") or "").strip()),
            },
            "provider_state": {
                "status": provider_state["status"],
                "message": provider_state["message"],
            },
            "selectedProvider": current_settings.get("selectedProvider"),
            "model": current_settings.get("model"),
            "base_url": current_settings.get("base_url"),
            "api_key": current_settings.get("api_key"),
            "modelProviders": current_settings.get("modelProviders") or [],
        }
    )


@app.post("/v1/dev/workbench/gateway/provider/validate")
async def developer_workbench_validate_gateway_provider_endpoint(req: DevWorkbenchProviderValidateRequest):
    current_settings = await load_settings()
    payload = {
        "provider_id": req.provider_id,
        "vendor": req.vendor,
        "url": req.url,
        "api_key": str(req.api_key or "").strip(),
        "model_id": req.model_id,
        "preserve_api_key": bool(req.preserve_api_key),
    }
    data = await _request_local_gateway_server_json(
        current_settings=current_settings,
        method="POST",
        api_path="/dev/workbench/provider/validate",
        payload=payload,
        timeout=httpx.Timeout(connect=4.0, read=8.0, write=8.0, pool=8.0),
    )
    return JSONResponse(content=data)


@app.post("/v1/dev/workbench/gateway/provider/apply")
async def developer_workbench_apply_gateway_provider_endpoint(req: DevWorkbenchProviderApplyRequest):
    current_settings = await load_settings()
    payload = {
        "provider_id": req.provider_id,
        "vendor": req.vendor,
        "url": req.url,
        "api_key": str(req.api_key or "").strip(),
        "model_id": req.model_id,
        "preserve_api_key": bool(req.preserve_api_key),
    }
    data = await _request_local_gateway_server_json(
        current_settings=current_settings,
        method="POST",
        api_path="/dev/workbench/provider/apply",
        payload=payload,
        timeout=httpx.Timeout(connect=4.0, read=8.0, write=8.0, pool=8.0),
    )
    return JSONResponse(content=data)


@app.post("/v1/dev/workbench/mapping/apply")
async def developer_workbench_apply_mapping_endpoint(req: DevWorkbenchMappingApplyRequest):
    current_settings = await load_settings()
    if _is_desktop_local_gateway_passthrough_mode(current_settings):
        raise HTTPException(
            status_code=409,
            detail=_get_desktop_local_gateway_passthrough_message(),
        )

    agent_id = str(req.agent_id or "").strip()
    if not agent_id:
        raise HTTPException(status_code=400, detail="agent_id 不能为空")

    available_agent_keys = _collect_agent_keys(current_settings)
    resolution = _get_local_model_resolution(current_settings)
    if agent_id not in available_agent_keys:
        raise HTTPException(
            status_code=400,
            detail=f"未找到已注册 agent：{agent_id}",
        )

    current_settings["mainAgent"] = agent_id
    if resolution["is_local_gateway"]:
        current_settings["model"] = agent_id
        provider = _get_selected_model_provider(current_settings)
        if req.sync_provider_model and provider is not None:
            provider["modelId"] = agent_id
            existing_models = [
                str(item or "").strip()
                for item in (provider.get("models") or [])
                if str(item or "").strip()
            ]
            provider["models"] = [agent_id] + [item for item in existing_models if item != agent_id]

    await save_settings(current_settings)

    mapping_warning = _get_local_model_resolution_warning(current_settings)
    return JSONResponse(
        content={
            "success": True,
            "message": "已更新默认 agent 映射。",
            "mainAgent": current_settings.get("mainAgent"),
            "model": current_settings.get("model"),
            "mapping_status": "warning" if mapping_warning else "ready",
            "mapping_message": mapping_warning or "",
        }
    )


@app.post("/v1/dev/workbench/workspace/apply")
async def developer_workbench_apply_workspace_endpoint(req: DevWorkbenchWorkspaceApplyRequest):
    current_settings = await load_settings()
    requested_workspace = str(req.workspace_dir or "").strip()
    recommended_workspace = _find_recommended_workspace_dir(current_settings)
    workspace_dir = requested_workspace or recommended_workspace.get("path") or ""
    if not workspace_dir:
        raise HTTPException(status_code=400, detail="workspace 路径不能为空")

    workspace_path = Path(workspace_dir).expanduser().resolve()
    if not workspace_path.exists() or not workspace_path.is_dir():
        raise HTTPException(status_code=400, detail=f"workspace 路径不存在：{workspace_path}")

    cli_settings = current_settings.setdefault("CLISettings", {})
    cli_settings["enabled"] = bool(req.enabled)
    cli_settings["engine"] = str(req.engine or "local").strip() or "local"
    cli_settings["cc_path"] = str(workspace_path)
    cli_settings["visibilityScope"] = str(req.visibility_scope or "workspace").strip() or "workspace"

    local_env_settings = current_settings.setdefault("localEnvSettings", {})
    local_env_settings["permissionMode"] = str(req.permission_mode or "default").strip() or "default"

    await save_settings(current_settings)

    runtime_context = _get_cli_runtime_context(current_settings)
    workspace_exists = bool(runtime_context.get("workspace_dir")) and Path(str(runtime_context.get("workspace_dir"))).exists()
    workspace_setup = _build_dev_workbench_workspace_setup(current_settings, runtime_context, workspace_exists)
    return JSONResponse(
        content={
            "success": True,
            "message": "已更新 CLI 工作区配置。",
            "workspace_dir": runtime_context.get("workspace_dir"),
            "engine": runtime_context.get("engine"),
            "permission_mode": runtime_context.get("permission_mode"),
            "visibility_scope": runtime_context.get("visibility_scope"),
            "workspace_setup": workspace_setup,
        }
    )

@app.post("/v1/chat/completions", operation_id="chat_with_agent_party")
async def chat_endpoint(request: ChatRequest, fastapi_request: Request):
    """
    用来与agent party中的模型聊天
    """
    fastapi_base_url = str(fastapi_request.base_url)
    # 【注意】引入全局 fast_client
    global client, reasoner_client, fast_client, settings, mcp_client_list
    
    raw_model = request.model or 'openxnet-model'
    override_memory_id = None
    
    if raw_model.startswith("memory/"):
        parts = raw_model.split('/', 2) 
        if len(parts) >= 2:
            override_memory_id = parts[1]
            request.model = parts[2] if len(parts) > 2 else 'openxnet-model'
            print(f"检测到动态 Memory ID: {override_memory_id}, 目标模型更新为: {request.model}")
    
    model = request.model or 'openxnet-model'
    enable_thinking = request.enable_thinking or False
    enable_deep_research = request.enable_deep_research or False
    enable_web_search = request.enable_web_search or False
    async_tools_id = request.asyncToolsID or None
    current_settings = await load_settings()
    requested_provider_model_override = None

    if _should_route_chat_request_to_selected_provider(model, current_settings):
        requested_provider_model_override = model

    if model in LEGACY_LOCAL_MODEL_ALIASES or requested_provider_model_override:
        if _should_passthrough_openxnet_access_chat(
            request,
            current_settings,
            enable_thinking,
            enable_deep_research,
            enable_web_search,
        ):
            return await _openxnet_access_chat_passthrough(request, current_settings)

        block_message = _build_local_model_resolution_block_message(current_settings)
        if block_message:
            return JSONResponse(
                status_code=503,
                content={"error": {"message": block_message, "type": "configuration_error", "code": 503}}
            )
        
        # 【修改点1】创建当前请求的专属配置，避免污染全局
        request_settings = current_settings.copy()
        request_settings["model"] = requested_provider_model_override or _resolve_runtime_model_name(current_settings)
        active_client = client  # 默认使用主模型
        
        if current_settings['fast']['enabled'] and not request.is_sub_agent:
            fast_cfg = current_settings['fast']
            use_fast_model = False
            
            if fast_cfg.get('triggerMode') == 'always':
                use_fast_model = True
            elif fast_cfg.get('triggerMode') == 'conditional':
                last_user_text = ""
                has_image = False
                for msg in reversed(request.messages):
                    if msg.get('role') == 'user':
                        content = msg.get('content')
                        if isinstance(content, str):
                            last_user_text = content
                        elif isinstance(content, list):
                            texts = []
                            for item in content:
                                if item.get('type') == 'text':
                                    texts.append(item.get('text', ''))
                                elif item.get('type') == 'image_url':
                                    has_image = True
                            last_user_text = "".join(texts)
                        break
                
                has_files = bool(request.fileLinks) 
                condition_pass = True
                
                max_len = fast_cfg.get('conditionMaxLen', 0)
                if max_len > 0 and len(last_user_text) > max_len:
                    condition_pass = False
                if condition_pass and fast_cfg.get('conditionNoNewline', False):
                    if '\n' in last_user_text:
                        condition_pass = False
                if condition_pass and fast_cfg.get('conditionNoFiles', True):
                    if has_image or has_files:
                        condition_pass = False
                        
                if condition_pass:
                    use_fast_model = True

            if use_fast_model:
                exclude_keys = ['enabled', 'triggerMode', 'conditionMaxLen', 'conditionNoNewline', 'conditionNoFiles']
                fast_config = {k: v for k, v in fast_cfg.items() if k not in exclude_keys}
                
                # 更新专属配置，不影响 current_settings
                request_settings.update(fast_config)
                f_provider = fast_cfg.get('selectedProvider', current_settings.get('selectedProvider'))
                f_class = get_client_class(current_settings, f_provider)
                
                # 【修改点2】动态检查并更新快速模型的 Client (仅配置被修改时触发)
                old_fast_cfg = settings.get('fast', {}) if settings else {}
                if (fast_client is None 
                    or fast_cfg.get('api_key') != old_fast_cfg.get('api_key') 
                    or fast_cfg.get('base_url') != old_fast_cfg.get('base_url')
                    or fast_cfg.get('selectedProvider') != old_fast_cfg.get('selectedProvider')
                    or not isinstance(fast_client, f_class)):
                    fast_client = f_class(
                        api_key=fast_cfg.get('api_key') or current_settings.get('api_key'),
                        base_url=fast_cfg.get('base_url') or current_settings.get('base_url') or "https://api.openai.com/v1"
                    )
                
                # 当前请求切花为快速 Client
                active_client = fast_client

        if override_memory_id:
            request_settings["memorySettings"]["is_memory"] = True
            request_settings["memorySettings"]["selectedMemory"] = override_memory_id
            
        provider_warning = _get_model_provider_configuration_warning(current_settings)
        if provider_warning:
            return JSONResponse(
                status_code=503,
                content={"error": {"message": provider_warning, "type": "configuration_error", "code": 503}}
            )

        # 【修改点3】动态更新主模型 Client (仅主配置修改时)
        c_class = get_client_class(current_settings, current_settings['selectedProvider'])
        if (current_settings['api_key'] != settings['api_key'] 
            or current_settings['base_url'] != settings['base_url']
            or current_settings.get('selectedProvider') != settings.get('selectedProvider')
            or client is None
            or not isinstance(client, c_class)):
            client = c_class(
                api_key=current_settings['api_key'],
                base_url=current_settings['base_url'] or "https://api.openai.com/v1",
            )
            # 如果当前没有触发快速模型，需要确保 active_client 指向最新的主 client
            if active_client != fast_client:
                active_client = client

        # 动态更新推理模型 Client
        r_class = get_client_class(current_settings, current_settings['reasoner']['selectedProvider'])
        if (current_settings['reasoner']['api_key'] != settings['reasoner']['api_key'] 
            or current_settings['reasoner']['base_url'] != settings['reasoner']['base_url']
            or current_settings['reasoner'].get('selectedProvider') != settings['reasoner'].get('selectedProvider')
            or reasoner_client is None
            or not isinstance(reasoner_client, r_class)):
            reasoner_client = r_class(
                api_key=current_settings['reasoner']['api_key'],
                base_url=current_settings['reasoner']['base_url'] or "https://api.openai.com/v1",
            )

        print('model:', request_settings['model'])
        
        # 将"system_prompt"插入到request.messages[0].content中 (注意这里使用的是 request_settings)
        if request_settings['system_prompt']:
            content_prepend(request.messages, 'system', request_settings['system_prompt'] + "\n\n")
        
        # --- [Brain Loop: Pre-Neural] 神经符号融合循环 — 算子执行 + 上下文注入 ---
        _neuro_enabled = request_settings.get('neuroSettings', {}).get('enabled', True)
        try:
            if _neuro_enabled and symbol_store and symbol_store.all():
                _user_text = ""
                for _msg in reversed(request.messages):
                    if _msg.get('role') == 'user':
                        _c = _msg.get('content', '')
                        if isinstance(_c, str):
                            _user_text = _c
                        elif isinstance(_c, list):
                            _user_text = " ".join(it.get('text', '') for it in _c if it.get('type') == 'text')
                        break

                if _user_text and len(_user_text) > 4:
                    if kernel:
                        _pre_result = await kernel.pre_neural(
                            user_text=_user_text,
                            messages=request.messages,
                            settings=request_settings,
                            symbol_store=symbol_store,
                        )
                        if _pre_result.context_injection:
                            content_append(request.messages, 'system', "\n\n" + _pre_result.context_injection)
                            logger.info(
                                f"[Kernel] Pre-Neural: symbols={len(_pre_result.matched_symbols)} "
                                f"runes={len(_pre_result.matched_runes)} {_pre_result.elapsed_ms:.0f}ms"
                            )
                    else:
                        _matches = symbol_store.match(text=_user_text, top_k=3)
                        _ctx = symbol_store.format_for_context(_matches)
                        if _ctx:
                            content_append(request.messages, 'system', "\n\n" + _ctx)
                            logger.info(f"[BrainLoop] Pre-Neural: injected {len(_matches)} symbols into context")
        except Exception as _bl_err:
            logger.warning(f"[BrainLoop] Pre-Neural skipped: {_bl_err}")
            
        # 【核心修正】因为之前我们没污染 current_settings，所以这里的比较才是真实的配置对比
        if current_settings != settings:
            settings = current_settings
            
        try:
            # 传入 active_client (0延迟切换) 和 request_settings
            if request.stream:
                return await generate_stream_response(active_client, reasoner_client, request, request_settings, fastapi_base_url, enable_thinking, enable_deep_research, enable_web_search, async_tools_id)
            return await generate_complete_response(active_client, reasoner_client, request, request_settings, fastapi_base_url, enable_thinking, enable_deep_research, enable_web_search)
        except asyncio.CancelledError:
            print("Client disconnected")
            raise
        except Exception as e:
            return JSONResponse(status_code=500, content={"error": {"message": str(e), "type": "server_error", "code": 500}})
            
    else:
        # ===== Agent 部分逻辑 ===== 
        # (因为 agent_settings 每次请求都是从本地 json.load 创建的新字典，
        # 所以它天生就不会产生你主模型遇到的“全局污染”问题，这里的代码可以基本保留原样)

        agentSettings = current_settings['agents'].get(model, {})
        resolved_agent_id = model if agentSettings else ""
        if not agentSettings:
            for agentId , agentConfig in current_settings['agents'].items():
                if current_settings['agents'][agentId]['name'] == model:
                    agentSettings = current_settings['agents'][agentId]
                    resolved_agent_id = agentId
                    break
        if not agentSettings:
            return JSONResponse(status_code=404, content={"error": {"message": f"Agent {model} not found", "type": "not_found", "code": 404}})

        agent_settings = copy.deepcopy(agentSettings)
        # 每次读取文件生成新的 agent_settings 字典
        agent_snapshot_path = _resolve_agent_snapshot_path(resolved_agent_id, agentSettings)
        if agent_snapshot_path:
            with agent_snapshot_path.open('r', encoding='utf-8') as f:
                loaded_agent_settings = json.load(f)
            agent_settings, snapshot_changed = _prepare_agent_snapshot_runtime_settings(
                loaded_agent_settings,
                current_settings,
            )
            if snapshot_changed:
                try:
                    with agent_snapshot_path.open('w', encoding='utf-8', newline='\n') as f:
                        json.dump(agent_settings, f, indent=4, ensure_ascii=False)
                except Exception as snapshot_sync_error:
                    logger.warning("failed to persist migrated agent snapshot %s: %s", agent_snapshot_path, snapshot_sync_error)
            if agentSettings['system_prompt']:
                content_prepend(request.messages, 'user', agentSettings['system_prompt'] + "\n\n")
        else:
            agent_settings, _ = _prepare_agent_snapshot_runtime_settings(agent_settings, current_settings)

        block_message = None
        if not _is_legacy_local_gateway_agent_snapshot(agent_settings):
            block_message = _build_local_model_resolution_block_message(agent_settings)
        if block_message:
            return JSONResponse(
                status_code=503,
                content={"error": {"message": block_message, "type": "configuration_error", "code": 503}}
            )
        
        if agent_settings['fast']['enabled'] and not request.is_sub_agent:
            fast_cfg = agent_settings['fast']
            use_fast_model = False
            
            if fast_cfg.get('triggerMode') == 'always':
                use_fast_model = True
            elif fast_cfg.get('triggerMode') == 'conditional':
                last_user_text = ""
                has_image = False
                for msg in reversed(request.messages):
                    if msg.get('role') == 'user':
                        content = msg.get('content')
                        if isinstance(content, str):
                            last_user_text = content
                        elif isinstance(content, list):
                            texts = []
                            for item in content:
                                if item.get('type') == 'text':
                                    texts.append(item.get('text', ''))
                                elif item.get('type') == 'image_url':
                                    has_image = True
                            last_user_text = "".join(texts)
                        break
                
                has_files = bool(request.fileLinks)
                condition_pass = True
                max_len = fast_cfg.get('conditionMaxLen', 0)
                if max_len > 0 and len(last_user_text) > max_len: condition_pass = False
                if condition_pass and fast_cfg.get('conditionNoNewline', False):
                    if '\n' in last_user_text: condition_pass = False
                if condition_pass and fast_cfg.get('conditionNoFiles', True):
                    if has_image or has_files: condition_pass = False
                        
                if condition_pass:
                    use_fast_model = True

            if use_fast_model:
                exclude_keys = ['enabled', 'triggerMode', 'conditionMaxLen', 'conditionNoNewline', 'conditionNoFiles']
                fast_config = {k: v for k, v in fast_cfg.items() if k not in exclude_keys}
                agent_settings.update(fast_config) # Agent 这里更新无所谓，因为它是局部变量
                
        # 顺便用上刚才写的辅助函数简化代码
        a_client_class = get_client_class(agent_settings, agent_settings.get('selectedProvider'))
        agent_client = a_client_class(
            api_key=agent_settings.get('api_key', ''),
            base_url=agent_settings.get('base_url') or "https://api.openai.com/v1"
        )
        
        ar_client_class = get_client_class(agent_settings, agent_settings.get('reasoner', {}).get('selectedProvider'))
        agent_reasoner_client = ar_client_class(
            api_key=agent_settings.get('reasoner', {}).get('api_key', ''),
            base_url=agent_settings.get('reasoner', {}).get('base_url') or "https://api.openai.com/v1"
        )
        
        try:
            if request.stream:
                return await generate_stream_response(agent_client, agent_reasoner_client, request, agent_settings, fastapi_base_url, enable_thinking, enable_deep_research, enable_web_search, async_tools_id)
            return await generate_complete_response(agent_client, agent_reasoner_client, request, agent_settings, fastapi_base_url, enable_thinking, enable_deep_research, enable_web_search)
        except asyncio.CancelledError:
            print("Client disconnected")
            raise
        except Exception as e:
            return JSONResponse(status_code=500, content={"error": {"message": str(e), "type": "server_error", "code": 500}})

@app.post("/simple_chat")
async def simple_chat_endpoint(request: ChatRequest):
    """
    同时支持流式(stream=true)与非流式(stream=false)
    """
    global client, settings

    current_settings = await load_settings()
    block_message = _build_local_model_resolution_block_message(current_settings)
    if block_message:
        return JSONResponse(
            status_code=503,
            content={"error": {"message": block_message, "type": "configuration_error", "code": 503}}
        )

    resolved_model = _resolve_runtime_model_name(current_settings)

    provider_warning = _get_model_provider_configuration_warning(current_settings)
    if provider_warning:
        return JSONResponse(
            status_code=503,
            content={"error": {"message": provider_warning,
                               "type": "configuration_error", "code": 503}}
        )

    # --------------- 选 vendor & 初始化 client ---------------
    client_class = get_client_class(
        current_settings,
        current_settings['selectedProvider'],
    )
    if (current_settings['api_key'] != settings['api_key'] or
            current_settings['base_url'] != settings['base_url']):
        client = client_class(
            api_key=current_settings['api_key'],
            base_url=current_settings['base_url'] or "https://api.openai.com/v1",
        )

    # --------------- 调用大模型 ---------------
    response = await client.chat.completions.create(
        model=resolved_model,
        messages=request.messages,
        stream=request.stream,
        temperature=request.temperature or settings['temperature'],
    )

    # --------------- 非流式：一次性返回 JSON ---------------
    if not request.stream:
        # 注意：openai 返回的是 ChatCompletion 对象
        return JSONResponse(content=response.model_dump())

    # --------------- 流式：保持原来的 StreamingResponse ---------------
    async def openai_raw_stream():
        async for chunk in response:
            yield chunk.model_dump_json() + '\n'
        # 不发送 [DONE]

    return StreamingResponse(
        openai_raw_stream(),
        media_type="text/plain",      # 也可以保持 "text/event-stream"
        headers={"Cache-Control": "no-cache"}
    )


from py.task_center import get_task_center
from py.delivery import dispatch_delivery
from py.task_execution_broker_api import (
    ProviderEvaluationResult,
    TaskExecutionBrokerDependencies,
    build_task_executor_options,
    register_task_execution_broker_api,
)

task_scheduler_runtime = None

class DevWorkbenchCodeSearchRequest(BaseModel):
    query: str
    root: Optional[str] = None
    max_results: int = 40


class DevWorkbenchSnapshotCreateRequest(BaseModel):
    name: Optional[str] = None
    include_roles: bool = True
    include_chats: bool = True
    include_tools: bool = True
    include_skills: bool = True


class DevWorkbenchSnapshotImportRequest(BaseModel):
    name: Optional[str] = None
    snapshot: Dict[str, Any] = Field(default_factory=dict)


class DevWorkbenchMcpToggleRequest(BaseModel):
    enabled: bool = True


async def _get_task_scheduler_block_message(current_settings: Dict[str, Any]) -> Optional[str]:
    provider_warning = _get_model_provider_configuration_warning(current_settings)
    if provider_warning:
        return provider_warning

    gateway_probe = await _probe_local_gateway_server_state(current_settings)
    gateway_provider_warning = _get_local_gateway_server_provider_warning(gateway_probe)
    if gateway_provider_warning:
        return gateway_provider_warning

    return _build_local_model_resolution_block_message(current_settings)


def _normalize_cli_permission_mode(permission_mode: Optional[str]) -> str:
    normalized = str(permission_mode or "default").strip() or "default"
    aliases = {
        "acceptEdits": "auto-approve",
        "auto-edit": "auto-approve",
        "bypassPermissions": "yolo",
        "cowork": "yolo",
    }
    return aliases.get(normalized, normalized)


def _get_cli_engine_settings(current_settings: Dict[str, Any], engine: Optional[str]) -> Dict[str, Any]:
    env_key = {
        "local": "localEnvSettings",
        "ds": "dsSettings",
        "cc": "ccSettings",
        "qc": "qcSettings",
        "oc": "ocSettings",
    }.get(str(engine or "").strip(), "localEnvSettings")
    return current_settings.get(env_key, {}) or {}


def _get_cli_runtime_context(current_settings: Dict[str, Any]) -> Dict[str, Any]:
    cli_settings = current_settings.get("CLISettings", {}) or {}
    engine = str(cli_settings.get("engine") or "local").strip() or "local"
    env_settings = _get_cli_engine_settings(current_settings, engine)
    permission_mode = str(env_settings.get("permissionMode") or "default").strip() or "default"
    workspace_dir = str(cli_settings.get("cc_path") or "").strip()
    return {
        "enabled": bool(cli_settings.get("enabled")),
        "workspace_dir": workspace_dir,
        "workspace_name": Path(workspace_dir).name if workspace_dir else "",
        "engine": engine,
        "permission_mode": permission_mode,
        "normalized_permission_mode": _normalize_cli_permission_mode(permission_mode),
        "visibility_scope": str(cli_settings.get("visibilityScope") or "workspace").strip() or "workspace",
        "collaboration_enabled": permission_mode == "cowork",
    }


LOCAL_AGENT_GATEWAY_PREFIXES = (
    "http://localhost:3457",
    "http://127.0.0.1:3457",
)
LOCAL_PROVIDER_OPTIONAL_API_KEY_VENDORS = {
    "dify",
    "lmstudio",
    "localai",
    "ollama",
    "ttswebui",
    "vllm",
    "xinference",
}
LEGACY_LOCAL_MODEL_ALIASES = {
    "openxnet",
    "openxnet-model",
    "super-model",
}
OPENXNET_ACCESS_PROVIDER_IDS = {
    "openxnet-access",
    "openxnet-access-managed-provider",
}
AGENT_SNAPSHOT_RUNTIME_MODE_KEY = "openxnetAgentSnapshotMode"
AGENT_SNAPSHOT_GATEWAY_PASSTHROUGH = "local_gateway_passthrough_v1"


def _is_local_agent_gateway_base_url(base_url: Optional[str]) -> bool:
    normalized = str(base_url or "").strip().lower()
    return any(normalized.startswith(prefix) for prefix in LOCAL_AGENT_GATEWAY_PREFIXES)


def _is_legacy_local_model_alias(value: Optional[Any]) -> bool:
    return str(value or "").strip() in LEGACY_LOCAL_MODEL_ALIASES


def _is_desktop_local_gateway_passthrough_mode(settings_dict: Dict[str, Any]) -> bool:
    return RUNTIME_PROFILE == "desktop" and _is_local_agent_gateway_base_url(settings_dict.get("base_url"))


def _get_desktop_local_gateway_passthrough_message(gateway_probe: Optional[Dict[str, Any]] = None) -> str:
    base_message = (
        "当前 desktop profile 通过本地 3457 独立 server profile 透传默认模型；"
        "默认别名会直接交给 3457 处理，无需再映射到 desktop 本地 agent。"
    )
    gateway_message = str(
        (gateway_probe or {}).get("provider_message")
        or (gateway_probe or {}).get("message")
        or (gateway_probe or {}).get("next_step")
        or ""
    ).strip()
    if gateway_message:
        return f"{base_message} 当前应优先处理 3457：{gateway_message}"
    return f"{base_message} 若对话仍不可用，请优先检查 OpenXnet-Server profile 的 provider。"


def _get_local_gateway_server_base_url(settings_dict: Dict[str, Any]) -> str:
    return str(settings_dict.get("base_url") or "http://127.0.0.1:3457/v1").strip().rstrip("/")


def _build_local_gateway_server_api_url(base_url: str, api_path: str) -> str:
    normalized_base = str(base_url or "").strip().rstrip("/")
    normalized_path = "/" + str(api_path or "").strip().lstrip("/")
    if normalized_base.endswith("/v1"):
        return f"{normalized_base}{normalized_path}"
    return f"{normalized_base}/v1{normalized_path}"


def _build_local_gateway_server_management_url(base_url: str) -> str:
    normalized_base = str(base_url or "").strip().rstrip("/")
    if normalized_base.endswith("/v1"):
        normalized_base = normalized_base[:-3].rstrip("/")
    return f"{normalized_base}/" if normalized_base else ""


async def _request_local_gateway_server_json(
    current_settings: Dict[str, Any],
    method: str,
    api_path: str,
    payload: Optional[Dict[str, Any]] = None,
    timeout: Optional[httpx.Timeout] = None,
) -> Dict[str, Any]:
    if not _is_desktop_local_gateway_passthrough_mode(current_settings):
        raise HTTPException(
            status_code=409,
            detail="当前 desktop profile 未处于本地 3457 透传模式，无法代理 OpenXnet-Server profile 配置。",
        )

    base_url = _get_local_gateway_server_base_url(current_settings)
    request_url = _build_local_gateway_server_api_url(base_url, api_path)
    request_timeout = timeout or httpx.Timeout(connect=4.0, read=8.0, write=8.0, pool=8.0)

    try:
        async with httpx.AsyncClient(timeout=request_timeout, follow_redirects=True) as client:
            response = await client.request(method.upper(), request_url, json=payload)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"请求本地 3457 server profile 失败：{exc}") from exc

    response_text = str(response.text or "").strip()
    response_data: Any = {}
    if response.content:
        try:
            response_data = response.json()
        except Exception:
            response_data = {
                "success": False,
                "detail": response_text[:500] or f"HTTP {response.status_code}",
            }

    if response.status_code >= 400:
        detail = (
            str(response_data.get("detail") or response_data.get("error") or "").strip()
            if isinstance(response_data, dict)
            else ""
        )
        if not detail:
            detail = response_text[:500] or response.reason_phrase or f"HTTP {response.status_code}"
        raise HTTPException(status_code=response.status_code, detail=detail)

    if isinstance(response_data, dict):
        return response_data
    return {"success": True, "data": response_data}


def _resolve_openxnet_login_service_base_url() -> str:
    base_url = str(os.getenv("OPENXNET_LOGIN_SERVICE_URL", OPENXNET_LOGIN_SERVICE_URL)).strip().rstrip("/")
    if base_url.endswith("/api"):
        base_url = base_url[:-4].rstrip("/")
    return base_url or "https://synapxnet.work"


def _resolve_openxnet_login_api_prefix() -> str:
    prefix = str(os.getenv("OPENXNET_LOGIN_API_PREFIX", OPENXNET_LOGIN_API_PREFIX)).strip() or "/api"
    if not prefix.startswith("/"):
        prefix = f"/{prefix}"
    return prefix.rstrip("/")


def _build_openxnet_login_api_url(api_path: str) -> str:
    normalized_path = str(api_path or "").strip()
    if not normalized_path.startswith("/"):
        normalized_path = f"/{normalized_path}"
    return f"{_resolve_openxnet_login_service_base_url()}{_resolve_openxnet_login_api_prefix()}{normalized_path}"


def _extract_proxy_access_token(request: Request) -> Optional[str]:
    header = str(request.headers.get("authorization") or "").strip()
    if not header.lower().startswith("bearer "):
        return None
    token = header[7:].strip()
    return token or None


def _extract_openxnet_login_error_detail(response_data: Any, response_text: str, status_code: int) -> str:
    if isinstance(response_data, dict):
        candidates = [
            response_data.get("detail"),
            response_data.get("message"),
            response_data.get("error"),
        ]
        error_obj = response_data.get("error")
        if isinstance(error_obj, dict):
            candidates.extend([error_obj.get("message"), error_obj.get("detail")])
        for candidate in candidates:
            if isinstance(candidate, str) and candidate.strip():
                return candidate.strip()
    if isinstance(response_data, str) and response_data.strip():
        return response_data.strip()
    if response_text:
        return response_text[:500]
    return f"HTTP {status_code}"


def _format_openxnet_login_exception(exc: Exception) -> str:
    if exc is None:
        return "UnknownError"
    detail = str(exc).strip()
    name = type(exc).__name__ or "RequestError"
    return f"{name}: {detail}" if detail else name


async def _request_openxnet_login_json(
    method: str,
    api_path: str,
    payload: Optional[Dict[str, Any]] = None,
    access_token: Optional[str] = None,
    timeout: Optional[httpx.Timeout] = None,
) -> Any:
    request_url = _build_openxnet_login_api_url(api_path)
    request_timeout = timeout or httpx.Timeout(connect=6.0, read=15.0, write=15.0, pool=15.0)
    headers = {"Accept": "application/json"}
    if payload is not None:
        headers["Content-Type"] = "application/json"
    if access_token:
        headers["Authorization"] = f"Bearer {access_token}"
    response = None
    primary_error: Optional[Exception] = None
    try:
        if global_http_client is not None:
            response = await global_http_client.request(
                method.upper(),
                request_url,
                json=payload,
                headers=headers,
                timeout=request_timeout,
                follow_redirects=True,
            )
        else:
            async with httpx.AsyncClient(timeout=request_timeout, follow_redirects=True, trust_env=True) as client:
                response = await client.request(
                    method.upper(),
                    request_url,
                    json=payload,
                    headers=headers,
                )
    except Exception as exc:
        primary_error = exc
        logger.warning(
            "[OpenXnet Access] Shared client request failed for %s %s: %s",
            method.upper(),
            request_url,
            _format_openxnet_login_exception(exc),
        )
        try:
            async with httpx.AsyncClient(
                timeout=request_timeout,
                follow_redirects=True,
                trust_env=openxnet_login_trust_env,
                proxy=openxnet_login_proxy_url,
            ) as client:
                response = await client.request(
                    method.upper(),
                    request_url,
                    json=payload,
                    headers=headers,
                )
        except Exception as retry_exc:
            logger.error(
                "[OpenXnet Access] Fresh client retry failed for %s %s after shared client error %s: %s",
                method.upper(),
                request_url,
                _format_openxnet_login_exception(primary_error),
                _format_openxnet_login_exception(retry_exc),
            )
            service_base_url = _resolve_openxnet_login_service_base_url()
            if service_base_url.startswith("http://127.0.0.1:3458") or service_base_url.startswith("http://localhost:3458"):
                raise HTTPException(
                    status_code=502,
                    detail=(
                        "本地 OpenXnet Login 服务未启动或不可用，请先启动 "
                        "E:\\openxnet-source\\openxnet-login，然后重试。"
                    ),
                ) from retry_exc
            if isinstance(retry_exc, httpx.TimeoutException):
                raise HTTPException(
                    status_code=504,
                    detail="OpenXnet 登录服务响应超时，请检查网络连接或稍后重试。",
                ) from retry_exc
            raise HTTPException(
                status_code=502,
                detail=f"请求 OpenXnet Login 服务失败：{_format_openxnet_login_exception(retry_exc)}",
            ) from retry_exc

    response_text = str(response.text or "").strip()
    response_data: Any = {}
    if response.content:
        try:
            response_data = response.json()
        except Exception:
            response_data = response_text

    if response.status_code >= 400:
        raise HTTPException(
            status_code=response.status_code,
            detail=_extract_openxnet_login_error_detail(response_data, response_text, response.status_code),
        )

    return response_data


def _collect_agent_identifiers(settings_dict: Dict[str, Any]) -> List[str]:
    identifiers: List[str] = []
    seen: Set[str] = set()
    for agent_cfg in (settings_dict.get("agents") or {}).values():
        if not isinstance(agent_cfg, dict):
            continue
        for raw_value in (agent_cfg.get("name"), agent_cfg.get("id")):
            value = str(raw_value or "").strip()
            if value and value not in seen:
                seen.add(value)
                identifiers.append(value)
    return identifiers


def _collect_agent_keys(settings_dict: Dict[str, Any]) -> List[str]:
    agent_keys: List[str] = []
    for agent_id, agent_cfg in (settings_dict.get("agents") or {}).items():
        if not isinstance(agent_cfg, dict):
            continue
        value = str(agent_id or "").strip()
        if value:
            agent_keys.append(value)
    return agent_keys


def _collect_agent_options(settings_dict: Dict[str, Any]) -> List[Dict[str, Any]]:
    options: List[Dict[str, Any]] = []
    for agent_id, agent_cfg in (settings_dict.get("agents") or {}).items():
        if not isinstance(agent_cfg, dict):
            continue
        option_id = str(agent_id or "").strip()
        if not option_id:
            continue
        option_name = str(agent_cfg.get("name") or "").strip()
        prompt_preview = " ".join(str(agent_cfg.get("system_prompt") or "").split())
        options.append(
            {
                "id": option_id,
                "name": option_name,
                "enabled": bool(agent_cfg.get("enabled")),
                "prompt_preview": prompt_preview[:160],
            }
        )
    return options


def _collect_selected_provider_models(settings_dict: Dict[str, Any]) -> List[str]:
    selected_provider = settings_dict.get("selectedProvider")
    provider_models: List[str] = []
    seen: Set[str] = set()
    for provider in settings_dict.get("modelProviders") or []:
        if not isinstance(provider, dict) or provider.get("id") != selected_provider:
            continue
        raw_candidates = [provider.get("modelId")]
        raw_candidates.extend(provider.get("models") or [])
        for raw_value in raw_candidates:
            value = str(raw_value or "").strip()
            if value and value not in seen:
                seen.add(value)
                provider_models.append(value)
        break
    return provider_models


def _find_model_provider_by_id(settings_dict: Dict[str, Any], provider_id: Optional[Any]) -> Optional[Dict[str, Any]]:
    if provider_id is None:
        return None

    target_id = str(provider_id).strip()
    for provider in settings_dict.get("modelProviders") or []:
        if isinstance(provider, dict) and str(provider.get("id")).strip() == target_id:
            return provider
    return None


def _normalize_model_provider_identity_value(
    value: Optional[Any],
    *,
    lowercase: bool = False,
    trim_trailing_slash: bool = False,
) -> str:
    normalized = str(value or "").strip()
    if trim_trailing_slash:
        normalized = normalized.rstrip("/")
    if lowercase:
        normalized = normalized.lower()
    return normalized


def _build_model_provider_identity(
    *,
    vendor: Optional[Any],
    url: Optional[Any],
    model_id: Optional[Any],
) -> Optional[Tuple[str, str, str]]:
    normalized_vendor = _normalize_model_provider_identity_value(vendor, lowercase=True)
    normalized_url = _normalize_model_provider_identity_value(
        url,
        lowercase=True,
        trim_trailing_slash=True,
    )
    normalized_model_id = _normalize_model_provider_identity_value(model_id, lowercase=True)
    if not normalized_vendor or not normalized_url:
        return None
    return (normalized_vendor, normalized_url, normalized_model_id)


def _get_model_provider_identity(provider: Optional[Dict[str, Any]]) -> Optional[Tuple[str, str, str]]:
    if not isinstance(provider, dict):
        return None
    return _build_model_provider_identity(
        vendor=provider.get("vendor"),
        url=provider.get("url"),
        model_id=provider.get("modelId"),
    )


def _merge_model_provider_models(primary_model: Optional[Any], *providers: Optional[Dict[str, Any]]) -> List[str]:
    models: List[str] = []
    seen: Set[str] = set()

    def _append_model(raw_value: Optional[Any]) -> None:
        value = str(raw_value or "").strip()
        if value and value not in seen:
            seen.add(value)
            models.append(value)

    _append_model(primary_model)
    for provider in providers:
        if not isinstance(provider, dict):
            continue
        _append_model(provider.get("modelId"))
        for raw_value in provider.get("models") or []:
            _append_model(raw_value)

    return models


def _merge_model_provider_entry(target_provider: Dict[str, Any], source_provider: Dict[str, Any]) -> None:
    if not str(target_provider.get("apiKey") or "").strip():
        source_api_key = str(source_provider.get("apiKey") or "").strip()
        if source_api_key:
            target_provider["apiKey"] = source_api_key

    merged_models = _merge_model_provider_models(
        target_provider.get("modelId"),
        target_provider,
        source_provider,
    )
    if merged_models:
        target_provider["models"] = merged_models


def _find_equivalent_model_provider(
    settings_dict: Dict[str, Any],
    *,
    vendor: Optional[Any],
    url: Optional[Any],
    model_id: Optional[Any],
    exclude_provider_id: Optional[Any] = None,
) -> Optional[Dict[str, Any]]:
    identity = _build_model_provider_identity(
        vendor=vendor,
        url=url,
        model_id=model_id,
    )
    if identity is None:
        return None

    excluded_id = str(exclude_provider_id or "").strip()
    for provider in settings_dict.get("modelProviders") or []:
        if not isinstance(provider, dict):
            continue
        provider_id = str(provider.get("id") or "").strip()
        if excluded_id and provider_id == excluded_id:
            continue
        if _get_model_provider_identity(provider) == identity:
            return provider
    return None


def _remap_model_provider_references(target: Any, provider_id_map: Dict[str, str]) -> None:
    if not provider_id_map:
        return

    if isinstance(target, dict):
        for key, value in list(target.items()):
            if key in {"selectedProvider", "providerId"}:
                mapped_value = provider_id_map.get(str(value or "").strip())
                if mapped_value:
                    target[key] = mapped_value
            else:
                _remap_model_provider_references(value, provider_id_map)
        return

    if isinstance(target, list):
        for item in target:
            _remap_model_provider_references(item, provider_id_map)


def _dedupe_model_providers(
    settings_dict: Dict[str, Any],
    *,
    preferred_provider_id: Optional[Any] = None,
) -> Dict[str, str]:
    raw_model_providers = settings_dict.get("modelProviders") or []
    if not isinstance(raw_model_providers, list):
        settings_dict["modelProviders"] = []
        return {}

    preferred_id = str(preferred_provider_id or "").strip()
    deduped_providers: List[Dict[str, Any]] = []
    canonical_provider_by_identity: Dict[Tuple[str, str, str], Dict[str, Any]] = {}
    canonical_index_by_identity: Dict[Tuple[str, str, str], int] = {}
    provider_id_map: Dict[str, str] = {}

    for provider in raw_model_providers:
        if not isinstance(provider, dict):
            continue

        provider_identity = _get_model_provider_identity(provider)
        if provider_identity is None:
            deduped_providers.append(provider)
            continue

        provider_id = str(provider.get("id") or "").strip()
        canonical_provider = canonical_provider_by_identity.get(provider_identity)
        if canonical_provider is None:
            canonical_provider_by_identity[provider_identity] = provider
            canonical_index_by_identity[provider_identity] = len(deduped_providers)
            deduped_providers.append(provider)
            continue

        canonical_id = str(canonical_provider.get("id") or "").strip()
        should_promote_provider = bool(
            preferred_id
            and provider_id == preferred_id
            and canonical_id != preferred_id
        )

        if should_promote_provider:
            _merge_model_provider_entry(provider, canonical_provider)
            deduped_providers[canonical_index_by_identity[provider_identity]] = provider
            canonical_provider_by_identity[provider_identity] = provider
            if canonical_id:
                provider_id_map[canonical_id] = provider_id
            continue

        _merge_model_provider_entry(canonical_provider, provider)
        if provider_id and canonical_id and provider_id != canonical_id:
            provider_id_map[provider_id] = canonical_id

    settings_dict["modelProviders"] = deduped_providers
    _remap_model_provider_references(settings_dict, provider_id_map)
    return provider_id_map


def _has_selected_model_provider(settings_dict: Dict[str, Any]) -> bool:
    return _get_selected_model_provider(settings_dict) is not None


def _get_selected_model_provider(settings_dict: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    return _find_model_provider_by_id(settings_dict, settings_dict.get("selectedProvider"))


def _resolve_preserved_provider_api_key(settings_dict: Dict[str, Any], provider_id: Optional[Any]) -> str:
    provider = _find_model_provider_by_id(settings_dict, provider_id)
    if provider is not None:
        return str(
            provider.get("apiKey")
            or (
                settings_dict.get("api_key")
                if str(settings_dict.get("selectedProvider") or "").strip() == str(provider.get("id") or "").strip()
                else ""
            )
            or ""
        ).strip()

    selected_provider = _get_selected_model_provider(settings_dict)
    return str(
        settings_dict.get("api_key")
        or (selected_provider.get("apiKey") if isinstance(selected_provider, dict) else "")
        or ""
    ).strip()


def _build_model_provider_runtime_state(settings_dict: Dict[str, Any]) -> Dict[str, Any]:
    selected_provider = _get_selected_model_provider(settings_dict)
    if not selected_provider:
        return {
            "status": "blocked",
            "summary": "未配置模型服务商",
            "detail": f"当前 {APP_NAME} profile 尚未配置模型服务商，请先配置有效上游 provider。",
            "message": f"当前 {APP_NAME} profile 尚未配置模型服务商，请先配置有效上游 provider。",
            "provider_name": "",
            "vendor": "",
            "base_url": "",
            "model": "",
            "api_key_configured": False,
            "issues": ["missing_provider"],
            "selected_provider": None,
        }

    provider_name = str(
        selected_provider.get("name")
        or selected_provider.get("vendor")
        or selected_provider.get("id")
        or "已选择"
    ).strip()
    vendor = str(selected_provider.get("vendor") or "").strip()
    base_url = str(
        settings_dict.get("base_url")
        or selected_provider.get("url")
        or ""
    ).strip()
    provider_models = _collect_selected_provider_models(settings_dict)
    model = str(
        settings_dict.get("model")
        or selected_provider.get("modelId")
        or next(iter(provider_models), "")
        or ""
    ).strip()
    api_key = str(
        settings_dict.get("api_key")
        or selected_provider.get("apiKey")
        or ""
    ).strip()

    issues: List[str] = []
    if not base_url:
        issues.append("missing_base_url")
    if not model:
        issues.append("missing_model")
    if RUNTIME_PROFILE == "server" and _is_local_agent_gateway_base_url(base_url):
        issues.append("server_self_loop")

    if issues:
        if "server_self_loop" in issues:
            message = (
                f"当前 {APP_NAME} profile 不能把 {base_url or '本地 3457'} 作为上游 provider，"
                "这会指回自身；请改为真实模型服务商或外部网关。"
            )
        else:
            missing_fields = []
            if "missing_base_url" in issues:
                missing_fields.append("base_url")
            if "missing_model" in issues:
                missing_fields.append("model")
            missing_text = " / ".join(missing_fields) if missing_fields else "关键信息"
            message = (
                f"当前 {APP_NAME} profile 的模型服务商配置不完整：缺少 {missing_text}；"
                "请先补齐后再继续。"
            )
        return {
            "status": "blocked",
            "summary": provider_name,
            "detail": f"model={model or '空'} | base_url={base_url or '空'}",
            "message": message,
            "provider_name": provider_name,
            "vendor": vendor,
            "base_url": base_url,
            "model": model,
            "api_key_configured": bool(api_key),
            "issues": issues,
            "selected_provider": selected_provider,
        }

    vendor_key = vendor.lower()
    if not api_key and vendor_key not in LOCAL_PROVIDER_OPTIONAL_API_KEY_VENDORS and not _is_local_agent_gateway_base_url(base_url):
        message = (
            f"当前 {APP_NAME} profile 的模型服务商尚未填写 api_key；"
            "若该 provider 需要鉴权，请先补齐。"
        )
        return {
            "status": "warning",
            "summary": provider_name,
            "detail": f"model={model} | base_url={base_url} | api_key=未填写",
            "message": message,
            "provider_name": provider_name,
            "vendor": vendor,
            "base_url": base_url,
            "model": model,
            "api_key_configured": False,
            "issues": ["missing_api_key"],
            "selected_provider": selected_provider,
        }

    return {
        "status": "ready",
        "summary": provider_name,
        "detail": f"model={model} | base_url={base_url}",
        "message": "",
        "provider_name": provider_name,
        "vendor": vendor,
        "base_url": base_url,
        "model": model,
        "api_key_configured": bool(api_key),
        "issues": [],
        "selected_provider": selected_provider,
    }


def _classify_provider_validation_failure(exc: Exception, raw_detail: str) -> Tuple[str, str, str]:
    detail = str(raw_detail or "").strip() or exc.__class__.__name__
    detail_lower = detail.lower()

    if isinstance(exc, httpx.ConnectTimeout):
        return (
            "blocked",
            "provider 连接超时",
            f"无法在限定时间内连接 provider；请检查 base_url、网络代理、防火墙或外网连通性。原始错误：{detail}",
        )
    if isinstance(exc, httpx.ReadTimeout):
        return (
            "blocked",
            "provider 响应超时",
            f"provider 已建立连接但在限定时间内没有返回 models.list；请检查上游负载或网络质量。原始错误：{detail}",
        )
    if isinstance(exc, httpx.ConnectError):
        return (
            "blocked",
            "provider 无法连接",
            f"无法建立到 provider 的网络连接；请检查地址、端口、证书或代理配置。原始错误：{detail}",
        )
    if isinstance(exc, httpx.InvalidURL):
        return (
            "blocked",
            "provider 地址格式无效",
            f"当前 base_url 无法被正确解析；请检查地址格式。原始错误：{detail}",
        )
    if "expecting value" in detail_lower or "json" in detail_lower:
        return (
            "warning",
            "provider 返回了非标准 JSON",
            f"已连到 provider，但 models.list 响应不是标准 JSON；请确认该网关是否兼容 OpenAI /models。原始错误：{detail}",
        )
    return ("blocked", "provider 连接失败", detail)


async def _validate_provider_draft(
    vendor: Optional[str],
    url: Optional[str],
    api_key: Optional[str],
    model_id: Optional[str],
) -> Dict[str, Any]:
    normalized_vendor = str(vendor or "OpenAI").strip() or "OpenAI"
    normalized_url = str(url or "").strip()
    normalized_api_key = str(api_key or "").strip()
    normalized_model = str(model_id or "").strip()
    vendor_key = normalized_vendor.lower()
    api_key_optional = (
        vendor_key in LOCAL_PROVIDER_OPTIONAL_API_KEY_VENDORS
        or _is_local_agent_gateway_base_url(normalized_url)
    )

    checks: List[Dict[str, Any]] = []
    models: List[str] = []
    model_match = False

    def add_check(check_id: str, check_status: str, summary: str, detail: str = ""):
        checks.append(
            {
                "id": check_id,
                "status": check_status,
                "summary": summary,
                "detail": detail,
            }
        )

    if not normalized_url:
        add_check("base_url", "blocked", "缺少 provider 地址", "请先填写 provider base_url。")
        return {
            "status": "blocked",
            "message": "请先填写 provider base_url。",
            "vendor": normalized_vendor,
            "url": normalized_url,
            "model_id": normalized_model,
            "api_key_configured": bool(normalized_api_key),
            "api_key_optional": api_key_optional,
            "matched_model": False,
            "models": models,
            "checks": checks,
        }

    add_check("base_url", "ready", "provider 地址已填写", normalized_url)

    if RUNTIME_PROFILE == "server" and _is_local_agent_gateway_base_url(normalized_url):
        add_check(
            "self_loop",
            "blocked",
            "当前 provider 会指回自身",
            f"{APP_NAME} 不能把 {normalized_url} 作为上游 provider，这会形成自指循环。",
        )
        return {
            "status": "blocked",
            "message": f"{APP_NAME} 不能把 {normalized_url} 作为上游 provider，这会形成自指循环。",
            "vendor": normalized_vendor,
            "url": normalized_url,
            "model_id": normalized_model,
            "api_key_configured": bool(normalized_api_key),
            "api_key_optional": api_key_optional,
            "matched_model": False,
            "models": models,
            "checks": checks,
        }

    if normalized_api_key:
        add_check("auth", "ready", "api_key 已填写", "当前草稿包含鉴权信息。")
    elif api_key_optional:
        add_check("auth", "ready", "当前 vendor 可不填 api_key", "本地或免鉴权 provider 可继续验证连通性。")
    else:
        add_check("auth", "warning", "api_key 未填写", "若当前 provider 需要鉴权，请先补齐 api_key。")

    list_models_error = ""
    models_url = normalized_url.rstrip("/")
    if not models_url.endswith("/models"):
        models_url = f"{models_url}/models"
    try:
        headers = {
            "Accept": "application/json",
        }
        if normalized_api_key:
            headers["Authorization"] = f"Bearer {normalized_api_key}"

        timeout = httpx.Timeout(connect=4.0, read=6.0, write=6.0, pool=6.0)
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            response = await client.get(models_url, headers=headers)

        if response.status_code >= 400:
            response_detail = str(response.text or "").strip()
            if not response_detail:
                response_detail = response.reason_phrase or f"HTTP {response.status_code}"
            raise HTTPException(
                status_code=response.status_code,
                detail=f"HTTP {response.status_code}: {response_detail[:500]}",
            )

        payload = response.json() if response.content else {}
        raw_models = payload.get("data") if isinstance(payload, dict) else []
        seen_models: Set[str] = set()
        for item in raw_models or []:
            model_name = ""
            if isinstance(item, dict):
                model_name = str(item.get("id") or "").strip()
            else:
                model_name = str(getattr(item, "id", "") or "").strip()
            if model_name and model_name not in seen_models:
                seen_models.add(model_name)
                models.append(model_name)
        detail = f"models.list 成功，返回 {len(models)} 个模型。"
        add_check("connectivity", "ready", "provider 连接验证通过", detail)
    except Exception as exc:
        status_code = getattr(exc, "status_code", None)
        detail_text = str(getattr(exc, "detail", "") or "").strip()
        list_models_error = detail_text or str(exc).strip()
        if not list_models_error and status_code:
            list_models_error = f"HTTP {status_code}"
        if not list_models_error:
            list_models_error = exc.__class__.__name__
        if status_code in (401, 403):
            add_check("connectivity", "blocked", "provider 鉴权失败", list_models_error)
        elif status_code in (404, 405, 501):
            add_check(
                "connectivity",
                "warning",
                "provider 未暴露 models.list",
                f"{list_models_error}；部分兼容网关可正常推理但不会列出模型。",
            )
        else:
            failure_status, failure_summary, failure_detail = _classify_provider_validation_failure(exc, list_models_error)
            add_check("connectivity", failure_status, failure_summary, failure_detail)

    if normalized_model:
        if models:
            model_match = normalized_model in models
            if model_match:
                add_check("model", "ready", "目标模型已匹配", normalized_model)
            else:
                add_check(
                    "model",
                    "warning",
                    "目标模型未出现在 models.list 中",
                    f"当前填写为 {normalized_model}；已读取模型：{'、'.join(models[:8])}",
                )
        elif any(check.get("id") == "connectivity" and check.get("status") == "warning" for check in checks):
            add_check(
                "model",
                "warning",
                "暂时无法验证目标模型",
                f"当前填写为 {normalized_model}；provider 未返回模型列表，请后续通过真实请求再次确认。",
            )
        else:
            add_check("model", "info", "已填写目标模型", normalized_model)
    else:
        if models:
            add_check(
                "model",
                "warning",
                "尚未填写目标模型",
                f"可从已读取模型中选择：{'、'.join(models[:8])}",
            )
        else:
            add_check("model", "warning", "尚未填写目标模型", "请先补齐 model_id。")

    has_blocked = any(check.get("status") == "blocked" for check in checks)
    has_warning = any(check.get("status") == "warning" for check in checks)
    overall_status = "blocked" if has_blocked else ("warning" if has_warning else "ready")

    message = "Provider 验证通过，可以继续应用到当前 profile。"
    if overall_status == "blocked":
        blocked_check = next((check for check in checks if check.get("status") == "blocked"), None)
        message = str(blocked_check.get("detail") or blocked_check.get("summary") or message) if blocked_check else message
    elif overall_status == "warning":
        warning_check = next((check for check in checks if check.get("status") == "warning"), None)
        message = str(warning_check.get("detail") or warning_check.get("summary") or message) if warning_check else message

    return {
        "status": overall_status,
        "message": message,
        "vendor": normalized_vendor,
        "url": normalized_url,
        "model_id": normalized_model,
        "api_key_configured": bool(normalized_api_key),
        "api_key_optional": api_key_optional,
        "matched_model": model_match,
        "models": models[:20],
        "checks": checks,
        "models_list_error": list_models_error,
    }


def _get_model_provider_configuration_warning(settings_dict: Dict[str, Any]) -> Optional[str]:
    provider_state = _build_model_provider_runtime_state(settings_dict)
    if provider_state["status"] == "blocked":
        return str(provider_state["message"] or "").strip() or None
    if provider_state["status"] == "warning" and "missing_api_key" in (provider_state.get("issues") or []):
        return str(provider_state["message"] or "").strip() or None
    return None


def _is_openxnet_access_provider(provider: Optional[Dict[str, Any]], settings_dict: Dict[str, Any]) -> bool:
    if not isinstance(provider, dict):
        return False

    provider_id = str(provider.get("id") or "").strip()
    managed_by = str(provider.get("managedBy") or provider.get("managed_by") or "").strip()
    provider_name = str(provider.get("name") or "").strip().lower()
    provider_url = str(
        provider.get("url")
        or provider.get("base_url")
        or settings_dict.get("base_url")
        or ""
    ).strip().rstrip("/").lower()

    return (
        provider_id in OPENXNET_ACCESS_PROVIDER_IDS
        or managed_by == "openxnet-access"
        or "gateway.synapxnet.cloud" in provider_url
        or provider_name == "openxnet gateway"
    )


def _should_passthrough_openxnet_access_chat(
    request: ChatRequest,
    settings_dict: Dict[str, Any],
    enable_thinking: bool,
    enable_deep_research: bool,
    enable_web_search: bool,
) -> bool:
    provider = _get_selected_model_provider(settings_dict)
    if not _is_openxnet_access_provider(provider, settings_dict):
        return False
    if request.tools or request.enable_tools or request.disable_tools or request.asyncToolsID:
        return False
    if request.fileLinks:
        return False
    if request.is_sub_agent or request.is_app_bot:
        return False
    if enable_thinking or enable_deep_research or enable_web_search:
        return False
    if (settings_dict.get("reasoner") or {}).get("enabled"):
        return False
    if (settings_dict.get("webSearch") or {}).get("enabled"):
        return False
    if ((settings_dict.get("tools") or {}).get("deepsearch") or {}).get("enabled"):
        return False
    return True


def _openxnet_access_chat_payload(request: ChatRequest, settings_dict: Dict[str, Any]) -> Dict[str, Any]:
    provider = _get_selected_model_provider(settings_dict) or {}
    provider_models = _collect_selected_provider_models(settings_dict)
    requested_model = str(request.model or "").strip()
    selected_model = (
        requested_model
        if requested_model and not _is_legacy_local_model_alias(requested_model)
        else str(settings_dict.get("model") or provider.get("modelId") or "").strip()
    )
    if not selected_model and provider_models:
        selected_model = provider_models[0]
    if not selected_model:
        selected_model = "gpt-5.5"

    payload: Dict[str, Any] = {
        "model": selected_model,
        "messages": request.messages,
        "stream": bool(request.stream),
    }
    temperature = request.temperature if request.temperature is not None else settings_dict.get("temperature")
    if temperature is not None:
        payload["temperature"] = temperature
    if request.top_p != 1:
        payload["top_p"] = request.top_p
    max_tokens = request.max_tokens or settings_dict.get("max_tokens")
    if max_tokens:
        # Most OpenAI-compatible gateways accept max_tokens; avoid reasoning-only max_completion_tokens here.
        payload["max_tokens"] = max_tokens
    if request.reasoning_effort or settings_dict.get("reasoning_effort"):
        payload["reasoning_effort"] = request.reasoning_effort or settings_dict.get("reasoning_effort")
    return payload


def _build_openxnet_access_chat_url(settings_dict: Dict[str, Any]) -> str:
    provider = _get_selected_model_provider(settings_dict) or {}
    base_url = str(
        provider.get("url")
        or provider.get("base_url")
        or settings_dict.get("base_url")
        or ""
    ).strip().rstrip("/")
    if not base_url:
        raise HTTPException(status_code=503, detail="OpenXnet Gateway base_url 未配置。")
    if base_url.endswith("/chat/completions"):
        return base_url
    if base_url.endswith("/v1"):
        return f"{base_url}/chat/completions"
    return f"{base_url}/v1/chat/completions"


def _get_openxnet_access_api_key(settings_dict: Dict[str, Any]) -> str:
    provider = _get_selected_model_provider(settings_dict) or {}
    api_key = str(
        provider.get("apiKey")
        or provider.get("api_key")
        or settings_dict.get("api_key")
        or ""
    ).strip()
    if not api_key:
        raise HTTPException(status_code=503, detail="OpenXnet Gateway api_key 未配置，请重新登录或刷新套餐权益。")
    return api_key


def _extract_openai_compatible_error_detail(response_data: Any, response_text: str, status_code: int) -> str:
    if isinstance(response_data, dict):
        error_obj = response_data.get("error")
        if isinstance(error_obj, dict):
            for key in ("message", "detail", "code"):
                value = error_obj.get(key)
                if isinstance(value, str) and value.strip():
                    return value.strip()
        for key in ("detail", "message", "error"):
            value = response_data.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    if response_text:
        return response_text[:1000]
    return f"HTTP {status_code}"


async def _openxnet_access_chat_passthrough(
    request: ChatRequest,
    settings_dict: Dict[str, Any],
) -> Response:
    url = _build_openxnet_access_chat_url(settings_dict)
    api_key = _get_openxnet_access_api_key(settings_dict)
    payload = _openxnet_access_chat_payload(request, settings_dict)
    headers = {
        "Accept": "text/event-stream" if request.stream else "application/json",
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    timeout = httpx.Timeout(connect=8.0, read=120.0, write=20.0, pool=20.0)

    if not request.stream:
        try:
            async with httpx.AsyncClient(timeout=timeout, follow_redirects=True, trust_env=True) as http_client:
                response = await http_client.post(url, json=payload, headers=headers)
        except httpx.TimeoutException as exc:
            raise HTTPException(status_code=504, detail="OpenXnet Gateway 响应超时，请稍后重试。") from exc
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"请求 OpenXnet Gateway 失败：{_format_openxnet_login_exception(exc)}") from exc

        response_text = str(response.text or "").strip()
        response_data: Any = {}
        if response.content:
            try:
                response_data = response.json()
            except Exception:
                response_data = response_text
        if response.status_code >= 400:
            detail = _extract_openai_compatible_error_detail(response_data, response_text, response.status_code)
            return JSONResponse(
                status_code=response.status_code,
                content={"error": {"message": detail, "type": "gateway_error", "code": response.status_code}},
            )
        return JSONResponse(content=response_data if isinstance(response_data, dict) else {"data": response_data})

    async def stream_gateway() -> AsyncIterator[str]:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True, trust_env=True) as http_client:
            async with http_client.stream("POST", url, json=payload, headers=headers) as response:
                if response.status_code >= 400:
                    text = await response.aread()
                    detail = _extract_openai_compatible_error_detail(None, text.decode("utf-8", errors="replace"), response.status_code)
                    error_payload = {"error": {"message": detail, "type": "gateway_error", "code": response.status_code}}
                    yield f"data: {json.dumps(error_payload, ensure_ascii=False)}\n\n"
                    yield "data: [DONE]\n\n"
                    return
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    if line.startswith("data:"):
                        yield f"{line}\n\n"
                    else:
                        yield f"data: {line}\n\n"

    return StreamingResponse(
        stream_gateway(),
        media_type="text/event-stream",
        headers={
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-OpenXnet-Route": "access-gateway",
        },
    )


def _get_local_model_resolution(current_settings: Dict[str, Any]) -> Dict[str, Any]:
    preferred_model = str(current_settings.get("model") or "").strip()
    main_agent = str(current_settings.get("mainAgent") or "").strip()
    provider_models = _collect_selected_provider_models(current_settings)
    available_agents = _collect_agent_identifiers(current_settings)
    is_local_gateway = _is_local_agent_gateway_base_url(current_settings.get("base_url"))

    candidates: List[Tuple[str, str]] = []
    seen_candidates: Set[str] = set()

    def add_candidate(source: str, raw_value: Optional[str]):
        value = str(raw_value or "").strip()
        if value and value not in seen_candidates:
            seen_candidates.add(value)
            candidates.append((source, value))

    add_candidate("model", preferred_model)
    add_candidate("mainAgent", main_agent)
    for provider_model in provider_models:
        add_candidate("provider", provider_model)

    resolved_model = ""
    resolution_source = ""
    for source, candidate in candidates:
        if candidate in available_agents:
            resolved_model = candidate
            resolution_source = source
            break

    return {
        "is_local_gateway": is_local_gateway,
        "preferred_model": preferred_model,
        "main_agent": main_agent,
        "provider_models": provider_models,
        "available_agents": available_agents,
        "resolved_model": resolved_model,
        "resolution_source": resolution_source,
    }


def _is_legacy_local_gateway_agent_snapshot(settings_dict: Dict[str, Any]) -> bool:
    snapshot_mode = str(settings_dict.get(AGENT_SNAPSHOT_RUNTIME_MODE_KEY) or "").strip()
    if snapshot_mode == AGENT_SNAPSHOT_GATEWAY_PASSTHROUGH:
        return True

    if not _is_local_agent_gateway_base_url(settings_dict.get("base_url")):
        return False

    resolution = _get_local_model_resolution(settings_dict)
    if resolution["resolved_model"]:
        return False

    selected_provider = _get_selected_model_provider(settings_dict) or {}
    provider_base_url = selected_provider.get("base_url")
    provider_model_candidates = [selected_provider.get("modelId")]
    provider_model_candidates.extend(selected_provider.get("models") or [])
    reasoner = settings_dict.get("reasoner") or {}
    candidate_values = [
        settings_dict.get("model"),
        settings_dict.get("mainAgent"),
        reasoner.get("model"),
    ]
    candidate_values.extend(provider_model_candidates)

    return (
        any(_is_legacy_local_model_alias(candidate) for candidate in candidate_values)
        or _is_local_agent_gateway_base_url(provider_base_url)
    )


def _prepare_agent_snapshot_runtime_settings(
    agent_settings: Dict[str, Any],
    current_settings: Dict[str, Any],
) -> Tuple[Dict[str, Any], bool]:
    runtime_settings = copy.deepcopy(agent_settings or {})
    snapshot_changed = False

    if not runtime_settings.get("agents"):
        runtime_settings["agents"] = copy.deepcopy(current_settings.get("agents", {}))
        snapshot_changed = True

    if _is_legacy_local_gateway_agent_snapshot(runtime_settings):
        if runtime_settings.get(AGENT_SNAPSHOT_RUNTIME_MODE_KEY) != AGENT_SNAPSHOT_GATEWAY_PASSTHROUGH:
            runtime_settings[AGENT_SNAPSHOT_RUNTIME_MODE_KEY] = AGENT_SNAPSHOT_GATEWAY_PASSTHROUGH
            snapshot_changed = True

    return runtime_settings, snapshot_changed


def _build_agent_snapshot_payload(current_settings: Dict[str, Any]) -> Dict[str, Any]:
    snapshot = copy.deepcopy(current_settings)
    if _is_local_agent_gateway_base_url(snapshot.get("base_url")) and _is_legacy_local_model_alias(snapshot.get("model")):
        snapshot[AGENT_SNAPSHOT_RUNTIME_MODE_KEY] = AGENT_SNAPSHOT_GATEWAY_PASSTHROUGH
    return snapshot


def _resolve_agent_snapshot_path(
    agent_id: Any,
    agent_settings: Dict[str, Any],
) -> Optional[Path]:
    """解析固定 Agent 快照；输入 Agent ID 和设置，返回根目录内文件，越界或缺失时返回 None。"""

    normalized_id = str(agent_id or "").strip()
    if not normalized_id or not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", normalized_id):
        return None
    root = Path(AGENT_DIR).resolve()
    configured_path = str(agent_settings.get("config_path") or "").strip()
    candidate = Path(configured_path).resolve() if configured_path else (root / f"{normalized_id}.json").resolve()
    if candidate.parent != root or not candidate.is_file():
        return None
    return candidate


def _build_local_model_resolution_block_message(current_settings: Dict[str, Any]) -> Optional[str]:
    if _is_desktop_local_gateway_passthrough_mode(current_settings):
        return None

    resolution = _get_local_model_resolution(current_settings)
    if not resolution["is_local_gateway"]:
        return None
    if resolution["resolved_model"]:
        return None

    available_agents = resolution["available_agents"]
    available_agents_text = "、".join(available_agents[:8]) if available_agents else "无"
    provider_models = resolution["provider_models"]
    provider_models_text = "、".join(provider_models[:8]) if provider_models else "未配置"
    preferred_model = resolution["preferred_model"] or "空"
    main_agent = resolution["main_agent"] or "空"
    return (
        "当前模型提供方指向本地 3457，但默认模型映射无效："
        f"model={preferred_model}，mainAgent={main_agent}，provider.models={provider_models_text}；"
        f"当前已注册 agent：{available_agents_text}。"
        "请先在设置中把默认 agent 调整到已注册 agent，再执行默认聊天或开发任务。"
    )


def _resolve_runtime_model_name(settings_dict: Dict[str, Any], fallback_model: str = "openxnet-model") -> str:
    resolution = _get_local_model_resolution(settings_dict)
    if _is_desktop_local_gateway_passthrough_mode(settings_dict):
        preferred_model = resolution["preferred_model"]
        if _is_legacy_local_model_alias(preferred_model):
            return preferred_model
        return "openxnet"

    if resolution["is_local_gateway"]:
        return resolution["resolved_model"]

    preferred_model = resolution["preferred_model"]
    main_agent = resolution["main_agent"]
    return preferred_model or main_agent or fallback_model


def _should_route_chat_request_to_selected_provider(
    requested_model: Optional[Any],
    settings_dict: Dict[str, Any],
) -> bool:
    normalized_request = str(requested_model or "").strip()
    if not normalized_request or _is_legacy_local_model_alias(normalized_request):
        return False

    selected_provider = _get_selected_model_provider(settings_dict) or {}
    selected_provider_url = (
        selected_provider.get("url")
        or selected_provider.get("base_url")
        or settings_dict.get("base_url")
    )
    if _is_local_agent_gateway_base_url(selected_provider_url):
        return False

    agent_identifiers = set(_collect_agent_identifiers(settings_dict))
    agent_identifiers.update(_collect_agent_keys(settings_dict))
    if normalized_request in agent_identifiers:
        return False

    candidate_values = [settings_dict.get("model"), selected_provider.get("modelId")]
    candidate_values.extend(selected_provider.get("models") or [])
    return any(normalized_request == str(candidate or "").strip() for candidate in candidate_values)


def _is_expected_websocket_disconnect_error(exc: Exception) -> bool:
    detail = str(exc or "").strip().lower()
    return isinstance(exc, RuntimeError) and (
        "disconnect message has been received" in detail
        or "cannot call `receive` once a disconnect message has been received" in detail
        or "websocket is not connected" in detail
    )


async def _safe_get_openai_functions(
    tool_client: Any,
    client_name: str,
    disable_tools: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """安全读取兼容 MCP 工具；输入客户端、名称和禁用项，返回 schema 列表，失败只记录异常类型并返回空列表。"""

    if tool_client is None or not hasattr(tool_client, "get_openai_functions"):
        logger.warning("%s client is not initialized; skipping tool registration", client_name)
        return []

    try:
        functions = await tool_client.get_openai_functions(disable_tools=disable_tools or [])
        return functions or []
    except Exception as exc:
        logger.warning("%s get_openai_functions failed: %s", client_name, type(exc).__name__)
        return []


def _is_sensitive_generic_mcp_header_name(name: str) -> bool:
    """判断通用 MCP header 是否可能承载凭据；输入名称，返回布尔值，无副作用。"""

    normalized = str(name or "").strip().lower()
    return (
        normalized in {"authorization", "proxy-authorization", "cookie", "set-cookie"}
        or re.search(
            r"(^|[-_])(api[-_]?key|token|secret|password|passwd|credential|auth)([-_]|$)",
            normalized,
            re.IGNORECASE,
        ) is not None
    )


def _generic_mcp_runtime_configuration(server: Mapping[str, Any]) -> Dict[str, Any] | None:
    """提取一个通用远程 MCP 无密钥配置；输入 Server 设置，返回规范配置，stdio 或字段缺失时返回空值。"""

    if not isinstance(server, Mapping) or server.get("command"):
        return None
    url = str(server.get("url") or "").strip()
    if not url:
        return None
    raw_type = str(server.get("type") or "").strip().lower()
    if raw_type in {"streamable", "streamablehttp", "streamable-http", "http"}:
        transport = "streamable-http"
    elif raw_type in {"ws", "websocket"} or url.lower().startswith(("ws://", "wss://")):
        transport = "websocket"
    else:
        transport = "sse"
    raw_headers = server.get("headers")
    headers = {
        str(name): str(value)
        for name, value in (raw_headers.items() if isinstance(raw_headers, Mapping) else [])
        if str(value) and not _is_sensitive_generic_mcp_header_name(str(name))
    }
    return {
        "transport": transport,
        "url": url,
        **({"headers": headers} if headers else {}),
    }


def _iter_enabled_generic_mcp_servers(
    current_settings: Mapping[str, Any],
) -> List[tuple[str, Dict[str, Any]]]:
    """列出启用的通用远程 MCP Server；输入设置，返回 scope 与无密钥配置，忽略 stdio 和无效条目。"""

    servers = current_settings.get("mcpServers")
    if not isinstance(servers, Mapping):
        return []
    enabled: List[tuple[str, Dict[str, Any]]] = []
    for server_name, server in servers.items():
        if not isinstance(server_name, str) or not isinstance(server, Mapping) or server.get("disabled"):
            continue
        configuration = _generic_mcp_runtime_configuration(server)
        if configuration is not None:
            enabled.append((server_name, configuration))
    return enabled


def _is_generic_mcp_tool_enabled(
    current_settings: Mapping[str, Any],
    server_name: str,
    tool_name: str,
) -> bool:
    """判断指定 Server 工具是否启用；输入设置、scope 和名称，返回布尔值，缺少显式条目时默认启用。"""

    servers = current_settings.get("mcpServers")
    server = servers.get(server_name) if isinstance(servers, Mapping) else None
    tools = server.get("tools") if isinstance(server, Mapping) else None
    if not isinstance(tools, list):
        return True
    matching = [tool for tool in tools if isinstance(tool, Mapping) and tool.get("name") == tool_name]
    return not matching or matching[0].get("enabled") is not False


async def _get_generic_mcp_openai_functions(
    current_settings: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """读取全部启用通用 MCP 工具；输入设置，返回有界合并列表，单 Server 失败时记录类型并继续。"""

    if not EXECUTION_ENGINE_PROFILE_ACTIVE:
        tools: List[Dict[str, Any]] = []
        for server_name, mcp_client in mcp_client_list.items():
            server = current_settings.get("mcpServers", {}).get(server_name, {})
            if not isinstance(server, Mapping) or server.get("disabled"):
                continue
            disabled_tools = [
                str(tool.get("name"))
                for tool in server.get("tools", [])
                if isinstance(tool, Mapping) and tool.get("enabled") is False
            ]
            tools.extend(await _safe_get_openai_functions(
                mcp_client,
                f"MCP:{server_name}",
                disable_tools=disabled_tools,
            ))
        return tools
    try:
        from py.mcp_tool_broker_client import has_private_mcp_tool_broker, list_generic_mcp_tools

        if not has_private_mcp_tool_broker():
            return []
        tools = []
        for server_name, configuration in _iter_enabled_generic_mcp_servers(current_settings):
            try:
                server_tools = await list_generic_mcp_tools(server_name, configuration)
            except Exception as error:
                logger.warning(
                    "Generic MCP tool discovery failed for '%s': %s",
                    server_name,
                    type(error).__name__,
                )
                continue
            tools.extend([
                tool
                for tool in server_tools
                if _is_generic_mcp_tool_enabled(
                    current_settings,
                    server_name,
                    str(tool.get("function", {}).get("name", "")),
                )
            ])
        return tools
    except Exception as error:
        logger.warning("Generic MCP tool discovery failed: %s", type(error).__name__)
        return []


def _home_assistant_runtime_configuration(
    current_settings: Dict[str, Any],
) -> Dict[str, str]:
    """提取 Home Assistant 无密钥运行配置；输入设置字典，返回仅含 URL 的副本，无副作用。"""

    configuration = current_settings.get("HASettings", {})
    if not isinstance(configuration, dict):
        configuration = {}
    return {"url": str(configuration.get("url") or "").strip()}


async def _get_home_assistant_openai_functions(
    current_settings: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """读取 Home Assistant 工具 schema；输入设置，返回有界列表，Desktop Broker 或兼容客户端失败时返回空列表。"""

    if not EXECUTION_ENGINE_PROFILE_ACTIVE:
        return await _safe_get_openai_functions(HA_client, "HomeAssistant")
    try:
        from py.mcp_tool_broker_client import (
            has_private_mcp_tool_broker,
            list_home_assistant_tools,
        )

        if not has_private_mcp_tool_broker():
            return []
        return await list_home_assistant_tools(
            _home_assistant_runtime_configuration(current_settings)
        )
    except Exception as error:
        logger.warning(
            "Home Assistant MCP tool discovery failed: %s",
            type(error).__name__,
        )
        return []


def _external_chrome_runtime_configuration(
    current_settings: Dict[str, Any],
) -> Dict[str, str]:
    """提取外部 Chrome MCP 无密钥配置；输入设置字典，返回固定实现选择副本，无副作用。"""

    configuration = current_settings.get("chromeMCPSettings", {})
    if not isinstance(configuration, dict):
        configuration = {}
    return {"mcpName": str(configuration.get("mcpName") or "browser-mcp").strip()}


async def _get_external_chrome_openai_functions(
    current_settings: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """读取外部 Chrome MCP 工具 schema；输入设置，返回有界列表，Desktop Broker 或兼容客户端失败时返回空列表。"""

    if not EXECUTION_ENGINE_PROFILE_ACTIVE:
        return await _safe_get_openai_functions(ChromeMCP_client, "ChromeMCP")
    try:
        from py.mcp_tool_broker_client import (
            has_private_mcp_tool_broker,
            list_external_chrome_tools,
        )

        if not has_private_mcp_tool_broker():
            return []
        return await list_external_chrome_tools(
            _external_chrome_runtime_configuration(current_settings)
        )
    except Exception as error:
        logger.warning(
            "External Chrome MCP tool discovery failed: %s",
            type(error).__name__,
        )
        return []


def _sql_runtime_configuration(current_settings: Dict[str, Any]) -> Dict[str, Any]:
    """提取 SQL 无密钥运行配置；输入设置，返回授权 ID 或远程元数据，不包含数据库口令。"""

    configuration = current_settings.get("sqlSettings", {})
    if not isinstance(configuration, dict):
        configuration = {}
    engine = str(configuration.get("engine") or "sqlite").strip()
    if engine == "sqlite":
        return {
            "engine": engine,
            "databaseId": str(configuration.get("databaseId") or "").strip(),
        }
    return {
        "engine": engine,
        "user": str(configuration.get("user") or "").strip(),
        "host": str(configuration.get("host") or "").strip(),
        "port": int(configuration.get("port") or 0),
        "dbname": str(configuration.get("dbname") or "").strip(),
    }


async def _get_sql_openai_functions(
    current_settings: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """读取 SQL 工具 schema；输入设置，返回有界列表，Desktop Broker 或兼容客户端失败时返回空列表。"""

    if not EXECUTION_ENGINE_PROFILE_ACTIVE:
        return await _safe_get_openai_functions(sql_client, "SQL")
    try:
        from py.mcp_tool_broker_client import has_private_mcp_tool_broker, list_sql_tools

        if not has_private_mcp_tool_broker():
            return []
        return await list_sql_tools(_sql_runtime_configuration(current_settings))
    except Exception as error:
        logger.warning("SQL MCP tool discovery failed: %s", type(error).__name__)
        return []


def _serialize_mcp_tool_result(value: Any) -> str:
    """把 MCP SDK 或 Broker 结果转换为文本；输入任意结果，返回 UTF-8 友好字符串，无外部副作用。"""

    if isinstance(value, str):
        return value
    if hasattr(value, "model_dump") and callable(value.model_dump):
        value = value.model_dump()
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    return str(value)


def _get_local_model_resolution_warning(current_settings: Dict[str, Any]) -> Optional[str]:
    if _is_desktop_local_gateway_passthrough_mode(current_settings):
        return None

    resolution = _get_local_model_resolution(current_settings)
    if not resolution["is_local_gateway"]:
        return None

    if resolution["resolved_model"]:
        preferred_model = resolution["preferred_model"]
        if preferred_model and preferred_model == resolution["resolved_model"]:
            return None
        return (
            "当前模型提供方指向本地 3457，默认 model 未直接命中已注册 agent；"
            f"运行时将回退到 `{resolution['resolved_model']}`。"
        )

    return _build_local_model_resolution_block_message(current_settings)


async def _probe_local_gateway_server_state(current_settings: Dict[str, Any]) -> Dict[str, Any]:
    if not _is_desktop_local_gateway_passthrough_mode(current_settings):
        return {"enabled": False}

    base_url = _get_local_gateway_server_base_url(current_settings)
    overview_url = _build_local_gateway_server_api_url(base_url, "/dev/workbench/overview")
    management_url = _build_local_gateway_server_management_url(base_url)

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(overview_url)
            response.raise_for_status()
            data = response.json()
    except Exception as exc:
        return {
            "enabled": True,
            "reachable": False,
            "message": f"3457 本地 server profile 探测失败：{exc}",
            "provider_status": "warning",
            "provider_message": "",
            "next_step": "",
            "provider_setup": {},
            "runtime_profile": {},
            "management_url": management_url,
        }

    readiness = data.get("configuration_readiness") or {}
    provider_setup = (data.get("configuration_assistant") or {}).get("provider_setup") or {}
    runtime_profile = data.get("runtime_profile") or {}
    provider_message = str(provider_setup.get("message") or "").strip()
    if not provider_message:
        for item in readiness.get("items") or []:
            if item.get("id") == "provider":
                provider_message = str(item.get("detail") or item.get("summary") or "").strip()
                break

    return {
        "enabled": True,
        "reachable": True,
        "message": "",
        "provider_status": str(provider_setup.get("status") or readiness.get("overall_status") or "").strip() or "info",
        "provider_message": provider_message,
        "next_step": str(readiness.get("next_step") or "").strip(),
        "provider_setup": provider_setup,
        "runtime_profile": runtime_profile,
        "management_url": management_url,
    }


def _get_local_gateway_server_provider_warning(gateway_probe: Optional[Dict[str, Any]]) -> Optional[str]:
    probe = gateway_probe or {}
    if not probe.get("enabled"):
        return None
    if not probe.get("reachable"):
        return str(probe.get("message") or "").strip() or None
    provider_status = str(probe.get("provider_status") or "").strip()
    if provider_status == "blocked":
        return str(probe.get("provider_message") or probe.get("next_step") or "").strip() or None
    return None


def _build_dev_workbench_configuration_readiness(
    current_settings: Dict[str, Any],
    runtime_context: Dict[str, Any],
    workspace_dir: str,
    workspace_exists: bool,
) -> Dict[str, Any]:
    resolution = _get_local_model_resolution(current_settings)
    provider_state = _build_model_provider_runtime_state(current_settings)
    normalized_permission_mode = runtime_context.get("normalized_permission_mode") or "default"

    items: List[Dict[str, Any]] = [
        {
            "id": "profile",
            "status": "ready",
            "summary": f"{RUNTIME_PROFILE} / {APP_NAME}",
            "detail": USER_DATA_DIR,
        }
    ]

    items.append(
        {
            "id": "provider",
            "status": provider_state["status"],
            "summary": provider_state["summary"],
            "detail": provider_state["message"] if provider_state["status"] == "blocked" else provider_state["detail"],
        }
    )

    if resolution["is_local_gateway"]:
        if resolution["resolved_model"]:
            preferred_model = resolution["preferred_model"]
            summary = resolution["resolved_model"]
            detail = f"source={resolution['resolution_source']} | 已注册 agent={len(resolution['available_agents'])}"
            status = "ready"
            if preferred_model and preferred_model != resolution["resolved_model"]:
                status = "warning"
                summary = f"{preferred_model} -> {resolution['resolved_model']}"
                detail = f"默认 model 未直接命中；运行时将回退到 source={resolution['resolution_source']}"
            items.append(
                {
                    "id": "mapping",
                    "status": status,
                    "summary": summary,
                    "detail": detail,
                }
            )
        else:
            items.append(
                {
                    "id": "mapping",
                    "status": "blocked",
                    "summary": "默认模型映射无效",
                    "detail": _build_local_model_resolution_block_message(current_settings) or "请先修复默认 agent 映射。",
                }
            )
    else:
        items.append(
            {
                "id": "mapping",
                "status": "info",
                "summary": "当前未走本地 3457 agent 网关",
                "detail": str(current_settings.get("base_url") or "base_url 未配置"),
            }
        )

    if not runtime_context.get("enabled"):
        workspace_status = "blocked"
        workspace_summary = "CLI 未启用"
        workspace_detail = "结构化开发任务当前无法进入真实工作区执行。"
    elif not workspace_dir:
        workspace_status = "blocked"
        workspace_summary = "未配置 CLI 工作区"
        workspace_detail = "请先在工具箱 - CLI 中设置工作区路径。"
    elif not workspace_exists:
        workspace_status = "blocked"
        workspace_summary = "CLI 工作区路径不存在"
        workspace_detail = workspace_dir
    else:
        workspace_status = "ready"
        workspace_summary = Path(workspace_dir).name or workspace_dir
        workspace_detail = workspace_dir
    items.append(
        {
            "id": "workspace",
            "status": workspace_status,
            "summary": workspace_summary,
            "detail": workspace_detail,
        }
    )

    if normalized_permission_mode in ("plan", "default"):
        permission_status = "warning"
        permission_summary = normalized_permission_mode
        permission_detail = "当前模式偏只读，Plan / Review / Diff 更合适；Patch 需要可编辑权限。"
    else:
        permission_status = "ready"
        permission_summary = normalized_permission_mode
        permission_detail = "当前权限支持进入可编辑开发任务。"
    items.append(
        {
            "id": "permission",
            "status": permission_status,
            "summary": permission_summary,
            "detail": permission_detail,
        }
    )

    blocked_count = len([item for item in items if item.get("status") == "blocked"])
    warning_count = len([item for item in items if item.get("status") == "warning"])
    if blocked_count > 0:
        overall_status = "blocked"
    elif warning_count > 0:
        overall_status = "warning"
    else:
        overall_status = "ready"

    next_step = "当前基础运行条件已满足，可以继续进入开发任务。"
    provider_warning = _get_model_provider_configuration_warning(current_settings)
    provider_notice = str(provider_state.get("message") or "").strip()
    mapping_warning = _build_local_model_resolution_block_message(current_settings)
    if provider_warning:
        next_step = provider_warning
    elif provider_state["status"] == "warning" and provider_notice:
        next_step = provider_notice
    elif mapping_warning:
        next_step = mapping_warning
    elif workspace_status == "blocked":
        next_step = workspace_detail
    elif permission_status == "warning":
        next_step = permission_detail

    return {
        "overall_status": overall_status,
        "blocked_count": blocked_count,
        "warning_count": warning_count,
        "next_step": next_step,
        "items": items,
    }


def _find_recommended_workspace_dir(current_settings: Dict[str, Any]) -> Dict[str, str]:
    candidates: List[Tuple[str, str]] = []
    env_workspace = str(os.environ.get("OPENXNET_DEFAULT_WORKSPACE", "")).strip()
    if env_workspace:
        candidates.append((env_workspace, "env"))

    current_workspace = str((current_settings.get("CLISettings") or {}).get("cc_path") or "").strip()
    if current_workspace:
        candidates.append((current_workspace, "current"))

    candidates.extend(
        [
            (r"D:\OpenXnet\skills", "openxnet_skills"),
            (str((Path.cwd() / "skills").resolve()), "cwd_skills"),
            (str(Path.cwd().resolve()), "cwd"),
        ]
    )

    seen: Set[str] = set()
    for raw_path, reason in candidates:
        normalized = str(raw_path or "").strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        candidate = Path(normalized).expanduser()
        if candidate.exists() and candidate.is_dir():
            return {"path": str(candidate.resolve()), "reason": reason}

    return {"path": "", "reason": ""}


def _build_dev_workbench_workspace_setup(
    current_settings: Dict[str, Any],
    runtime_context: Dict[str, Any],
    workspace_exists: bool,
) -> Dict[str, Any]:
    workspace_dir = str(runtime_context.get("workspace_dir") or "").strip()
    recommended = _find_recommended_workspace_dir(current_settings)
    normalized_permission_mode = str(runtime_context.get("normalized_permission_mode") or "default").strip() or "default"

    if not runtime_context.get("enabled"):
        status = "blocked"
        message = "CLI 当前未启用，结构化开发任务无法进入真实工作区执行。"
    elif not workspace_dir:
        status = "blocked"
        message = "尚未配置 CLI 工作区，请先补齐工作区路径。"
    elif not workspace_exists:
        status = "blocked"
        message = f"当前 CLI 工作区路径不存在：{workspace_dir}"
    elif normalized_permission_mode in ("plan", "default"):
        status = "warning"
        message = "当前权限模式偏只读；如果后续需要 Patch，请切换到可编辑权限。"
    else:
        status = "ready"
        message = "CLI 工作区与权限模式已满足可编辑开发任务。"

    return {
        "status": status,
        "blocked": status == "blocked",
        "warning": status == "warning",
        "message": message,
        "enabled": bool(runtime_context.get("enabled")),
        "engine": runtime_context.get("engine"),
        "workspace_dir": workspace_dir,
        "workspace_exists": bool(workspace_exists),
        "permission_mode": runtime_context.get("permission_mode"),
        "normalized_permission_mode": normalized_permission_mode,
        "visibility_scope": runtime_context.get("visibility_scope"),
        "recommended_workspace_dir": recommended.get("path", ""),
        "recommended_reason": recommended.get("reason", ""),
    }


def _build_dev_workbench_configuration_assistant(
    current_settings: Dict[str, Any],
    runtime_context: Dict[str, Any],
    workspace_exists: bool,
    gateway_probe: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    provider_state = _build_model_provider_runtime_state(current_settings)
    resolution = _get_local_model_resolution(current_settings)
    provider_options: List[Dict[str, Any]] = []
    agent_options = _collect_agent_options(current_settings)

    for provider in current_settings.get("modelProviders") or []:
        if not isinstance(provider, dict):
            continue
        provider_options.append(
            {
                "id": provider.get("id"),
                "name": str(
                    provider.get("name")
                    or provider.get("vendor")
                    or provider.get("id")
                    or ""
                ).strip(),
                "vendor": str(provider.get("vendor") or "").strip(),
                "url": str(provider.get("url") or "").strip(),
                "modelId": str(provider.get("modelId") or "").strip(),
                "hasApiKey": bool(str(provider.get("apiKey") or "").strip()),
            }
        )

    mapping_message = _build_local_model_resolution_block_message(current_settings)
    resolution_warning = _get_local_model_resolution_warning(current_settings)
    workspace_setup = _build_dev_workbench_workspace_setup(current_settings, runtime_context, workspace_exists)
    gateway_info = gateway_probe or {}
    gateway_provider_state = gateway_info.get("provider_setup") or {}
    gateway_runtime_profile = gateway_info.get("runtime_profile") or {}
    gateway_provider_options = gateway_provider_state.get("provider_options") or []
    gateway_status = "ready"
    gateway_message = ""
    if gateway_info.get("enabled"):
        if gateway_info.get("reachable"):
            gateway_status = str(gateway_provider_state.get("status") or gateway_info.get("provider_status") or "info").strip() or "info"
            gateway_message = str(
                gateway_provider_state.get("message")
                or gateway_info.get("provider_message")
                or gateway_info.get("next_step")
                or ""
            ).strip()
        else:
            gateway_status = "warning"
            gateway_message = str(gateway_info.get("message") or "").strip()

    return {
        "provider_setup": {
            "status": provider_state["status"],
            "blocked": provider_state["status"] == "blocked",
            "warning": provider_state["status"] == "warning",
            "message": provider_state["message"],
            "selected_provider_id": current_settings.get("selectedProvider"),
            "current_vendor": provider_state["vendor"],
            "current_model": provider_state["model"],
            "current_base_url": provider_state["base_url"],
            "api_key_configured": provider_state["api_key_configured"],
            "provider_options": provider_options,
        },
        "gateway_provider_setup": {
            "enabled": bool(gateway_info.get("enabled")),
            "reachable": bool(gateway_info.get("reachable")),
            "status": gateway_status,
            "blocked": gateway_status == "blocked",
            "warning": gateway_status == "warning",
            "message": gateway_message,
            "selected_provider_id": gateway_provider_state.get("selected_provider_id"),
            "current_vendor": str(gateway_provider_state.get("current_vendor") or "").strip(),
            "current_model": str(gateway_provider_state.get("current_model") or "").strip(),
            "current_base_url": str(gateway_provider_state.get("current_base_url") or "").strip(),
            "api_key_configured": bool(gateway_provider_state.get("api_key_configured")),
            "provider_options": gateway_provider_options if isinstance(gateway_provider_options, list) else [],
            "profile": str(gateway_runtime_profile.get("profile") or "server").strip() or "server",
            "app_name": str(gateway_runtime_profile.get("app_name") or "OpenXnet-Server").strip() or "OpenXnet-Server",
            "user_data_dir": str(gateway_runtime_profile.get("user_data_dir") or "").strip(),
            "management_url": str(gateway_info.get("management_url") or "").strip(),
        },
        "mapping_setup": {
            "status": "blocked" if mapping_message else ("warning" if resolution_warning else "ready"),
            "blocked": bool(mapping_message),
            "message": mapping_message or resolution_warning or "",
            "is_local_gateway": resolution["is_local_gateway"],
            "current_model": resolution["preferred_model"],
            "current_main_agent": resolution["main_agent"],
            "provider_models": resolution["provider_models"],
            "available_agents": [item["id"] for item in agent_options],
            "agent_options": agent_options,
            "resolved_model": resolution["resolved_model"],
            "resolution_source": resolution["resolution_source"],
        },
        "workspace_setup": workspace_setup,
    }


def _clean_developer_workbench_lines(values: Optional[List[str]]) -> List[str]:
    cleaned: List[str] = []
    for raw in values or []:
        text = str(raw or "").strip()
        if not text:
            continue
        text = text.lstrip("-*•0123456789.、)） ")
        text = text.strip()
        if text:
            cleaned.append(text)
    return cleaned[:12]


def _get_developer_workbench_templates() -> List[Dict[str, Any]]:
    return [
        {
            "id": "plan",
            "label": "Plan",
            "description": "先梳理现状、相关文件和实施步骤，避免直接重复开发。",
            "requires_write": False,
            "suggested_goal": "梳理当前功能现状、相关文件与菜单入口，给出明确实施计划。",
            "suggested_acceptance": [
                "列出相关文件、接口和 UI 入口",
                "给出分步实施方案和影响范围",
                "说明风险、依赖和验证路径",
            ],
            "suggested_constraints": [
                "先阅读现有实现，避免重复开发",
                "以审视和规划为主，不要先做大范围改动",
            ],
            "execution_notes": [
                "优先梳理当前工作区里的现有实现、菜单入口和数据流。",
                "明确说明哪些能力已经存在，哪些只是部分完成。",
                "输出结果以现状、计划、风险和验证建议为主。",
            ],
            "output_requirement": "输出一份结构化实施计划，明确文件范围、步骤、风险和验证点。",
        },
        {
            "id": "review",
            "label": "Review",
            "description": "以代码审查视角找问题，优先发现 bug、回归风险和测试缺口。",
            "requires_write": False,
            "suggested_goal": "审查当前实现，识别 bug、回归风险、权限问题和测试空白。",
            "suggested_acceptance": [
                "按严重程度列出主要发现",
                "指出潜在回归、数据一致性或权限风险",
                "说明缺失测试或验证空白",
            ],
            "suggested_constraints": [
                "以 findings-first 方式输出，不要先写长总结",
                "除非任务特别要求，否则不要直接改动源码",
            ],
            "execution_notes": [
                "从功能行为、边界条件、权限控制和状态一致性几个角度审查。",
                "优先输出高风险问题，再列出中低风险项和测试缺口。",
                "说明问题对应的文件、接口或页面入口，便于后续修复。",
            ],
            "output_requirement": "输出审查发现清单，按严重程度排序，并附上风险说明与建议验证项。",
        },
        {
            "id": "diff",
            "label": "Diff",
            "description": "聚焦变更对比，梳理当前实现与目标之间的差异和缺口。",
            "requires_write": False,
            "suggested_goal": "比较目标文件、相关模块或历史轨迹，归纳当前差异与待补齐项。",
            "suggested_acceptance": [
                "说明主要差异点和影响范围",
                "指出功能缺口、菜单缺口或实现不一致处",
                "给出建议下一步行动",
            ],
            "suggested_constraints": [
                "优先结合工作区现状、任务轨迹和检查点来分析",
                "输出应突出差异而不是重复罗列无关内容",
            ],
            "execution_notes": [
                "尽量基于目标文件、相关模块、任务轨迹或检查点来定位差异。",
                "如果工作区不是 Git 仓库，也要结合现有文件与 Recall 线索进行比较。",
                "最终结果要指出哪些差异需要修复，哪些属于预期变化。",
            ],
            "output_requirement": "输出差异分析报告，包含差异点、影响范围、缺口和建议下一步。",
        },
        {
            "id": "patch",
            "label": "Patch",
            "description": "执行最小必要修改并完成验证，形成可继续集成的补丁结果。",
            "requires_write": True,
            "suggested_goal": "在最小必要范围内修改现有实现，完成验证并总结改动结果。",
            "suggested_acceptance": [
                "完成最小必要代码修改",
                "说明改动文件与验证结果",
                "指出剩余风险和后续建议",
            ],
            "suggested_constraints": [
                "优先沿用现有模式，不要重造平行实现",
                "修改后要进行必要验证并记录结果",
            ],
            "execution_notes": [
                "先确认现有实现和目标缺口，再进行最小必要修改。",
                "优先复用已有接口、组件和任务能力，避免重复造轮子。",
                "完成后要说明改动内容、验证情况和剩余风险。",
            ],
            "output_requirement": "输出补丁结果说明，包含改动点、验证结论、残余风险与后续建议。",
        },
    ]


def _build_developer_workbench_title(
    workflow_kind: str,
    goal: str,
    target_paths: List[str],
    explicit_title: Optional[str] = None,
) -> str:
    title = str(explicit_title or "").strip()
    if title:
        return title[:96]

    labels = {item["id"]: item["label"] for item in _get_developer_workbench_templates()}
    label = labels.get(workflow_kind, workflow_kind.title())
    goal_preview = " ".join(str(goal or "").split())
    if len(goal_preview) > 48:
        goal_preview = goal_preview[:47] + "…"
    target_suffix = f" @ {Path(target_paths[0]).name}" if target_paths else ""
    base = goal_preview or "Workspace task"
    return f"{label}: {base}{target_suffix}"[:96]


def _build_developer_workbench_task_payload(
    req: Any,
    runtime_context: Dict[str, Any],
) -> Dict[str, Any]:
    templates = {
        item["id"]: item
        for item in _get_developer_workbench_templates()
    }
    workflow_kind = str(req.workflow_kind or "plan").strip().lower() or "plan"
    if workflow_kind not in templates:
        workflow_kind = "plan"

    template = templates[workflow_kind]
    goal = str(req.goal or "").strip()
    if not goal:
        raise HTTPException(status_code=400, detail="开发任务目标不能为空")

    target_paths = _clean_developer_workbench_lines(req.target_paths)
    acceptance_criteria = (
        _clean_developer_workbench_lines(req.acceptance_criteria)
        or list(template.get("suggested_acceptance", []))
    )
    constraints = (
        _clean_developer_workbench_lines(req.constraints)
        or list(template.get("suggested_constraints", []))
    )
    additional_context = str(req.additional_context or "").strip()
    title = _build_developer_workbench_title(
        workflow_kind=workflow_kind,
        goal=goal,
        target_paths=target_paths,
        explicit_title=req.title,
    )

    description_lines = [
        f"你正在 OpenXnet 开发工作台中处理一个【{template['label']}】任务。",
        "",
        "【任务目标】",
        goal,
        "",
        "【工作区上下文】",
        f"- 工作区：{runtime_context.get('workspace_dir') or '未配置'}",
        f"- CLI 引擎：{runtime_context.get('engine')}",
        f"- 权限模式：{runtime_context.get('permission_mode')}",
    ]

    if target_paths:
        description_lines.extend(["", "【重点文件 / 目录】"])
        description_lines.extend([f"- {item}" for item in target_paths])

    description_lines.extend(["", "【本次工作要求】"])
    description_lines.extend(
        [f"{index}. {item}" for index, item in enumerate(template.get("execution_notes", []), start=1)]
    )

    if acceptance_criteria:
        description_lines.extend(["", "【完成标准】"])
        description_lines.extend([f"- {item}" for item in acceptance_criteria])

    if constraints:
        description_lines.extend(["", "【注意约束】"])
        description_lines.extend([f"- {item}" for item in constraints])

    if additional_context:
        description_lines.extend(["", "【补充上下文】", additional_context])

    description_lines.extend(["", "【输出要求】", template.get("output_requirement", "")])

    return {
        "title": title,
        "description": "\n".join(description_lines).strip(),
        "context": {
            "created_from": "developer_workbench",
            "workflow_kind": workflow_kind,
            "target_paths": target_paths,
            "acceptance_criteria": acceptance_criteria,
            "constraints": constraints,
            "additional_context": additional_context,
            "workspace_dir": runtime_context.get("workspace_dir") or "",
            "engine_name": runtime_context.get("engine") or "",
            "permission_mode": runtime_context.get("permission_mode") or "",
            "requires_write": bool(template.get("requires_write")),
        },
    }


def _serialize_task_items(
    task_center: Any,
    tasks: List[Any],
) -> List[Dict[str, Any]]:
    """Serialize task summaries with stable child counts for workbench views."""

    child_counts: Dict[str, int] = {}
    for task in tasks:
        if task.parent_task_id and task.parent_task_id != "MANUAL_USER":
            child_counts[task.parent_task_id] = child_counts.get(task.parent_task_id, 0) + 1
    return [
        task_center.serialize_task(
            task,
            child_task_count=child_counts.get(task.task_id, 0),
        )
        for task in tasks
    ]


@app.get("/v1/dev/workbench/overview")
async def developer_workbench_overview_endpoint():
    current_settings = await load_settings()
    runtime_context = _get_cli_runtime_context(current_settings)
    workspace_dir = runtime_context.get("workspace_dir") or ""
    normalized_permission_mode = runtime_context.get("normalized_permission_mode") or "default"
    workspace_exists = bool(workspace_dir) and Path(workspace_dir).exists()
    provider_state = _build_model_provider_runtime_state(current_settings)
    gateway_probe = await _probe_local_gateway_server_state(current_settings)

    warnings: List[str] = []
    if not workspace_dir:
        warnings.append("尚未配置 CLI 工作区，开发工作台只能显示环境概览。")
    elif not workspace_exists:
        warnings.append("当前 CLI 工作区路径不存在，请先检查路径配置。")
    if not runtime_context.get("enabled"):
        warnings.append("CLI 当前未启用，结构化开发任务无法进入真实工作区执行。")
    if normalized_permission_mode in ("plan", "default"):
        warnings.append("当前权限模式偏只读，Plan / Review / Diff 更合适；Patch 建议切换到可编辑权限后再执行。")
    provider_warning = _get_model_provider_configuration_warning(current_settings)
    if provider_warning:
        warnings.append(provider_warning)
    elif provider_state["status"] == "warning" and provider_state.get("message"):
        warnings.append(str(provider_state["message"]))
    gateway_provider_warning = _get_local_gateway_server_provider_warning(gateway_probe)
    if gateway_provider_warning:
        warnings.append(gateway_provider_warning)
    elif gateway_probe.get("enabled") and not gateway_probe.get("reachable") and gateway_probe.get("message"):
        warnings.append(str(gateway_probe.get("message")))
    model_warning = _get_local_model_resolution_warning(current_settings)
    if model_warning:
        warnings.append(model_warning)

    plugin_reg = get_plugin_registry()
    plugin_count = len(plugin_reg.get_all_tools())

    tool_names: List[str] = []
    if runtime_context.get("enabled") and workspace_dir:
        try:
            from py.cli_tool import get_tools_for_mode, get_local_tools_for_mode

            if runtime_context.get("engine") == "local":
                tool_defs = get_local_tools_for_mode(normalized_permission_mode)
                tool_names = [
                    tool.get("function", {}).get("name", "")
                    for tool in tool_defs
                    if tool.get("function", {}).get("name")
                ]
            elif runtime_context.get("engine") == "ds":
                tool_defs = get_tools_for_mode(normalized_permission_mode)
                tool_names = [
                    tool.get("function", {}).get("name", "")
                    for tool in tool_defs
                    if tool.get("function", {}).get("name")
                ]
            elif runtime_context.get("engine") == "cc":
                tool_names = ["claude_code"]
            elif runtime_context.get("engine") == "oc":
                tool_names = ["openai_codex"]
            elif runtime_context.get("engine") == "qc":
                tool_names = ["qwen_code"]
        except Exception as exc:
            warnings.append(f"开发工具能力读取失败：{exc}")

    capability_summary = {
        "read": True,
        "search": any("search_files" in name or "glob_files" in name for name in tool_names) or not tool_names,
        "edit": any("edit_file" in name for name in tool_names),
        "patch": any("patch" in name for name in tool_names),
        "execute": any(name in ("shell_tool_local", "docker_sandbox") for name in tool_names),
        "process": any("manage_processes" in name or "manage_ports" in name or "local_net_tool" in name for name in tool_names),
        "tasks": any("todo_write" in name for name in tool_names),
    }

    if not tool_names:
        write_enabled = normalized_permission_mode not in ("plan", "default")
        capability_summary["edit"] = write_enabled
        capability_summary["patch"] = write_enabled
        capability_summary["execute"] = write_enabled
        capability_summary["process"] = normalized_permission_mode in ("auto-approve", "yolo")
        capability_summary["tasks"] = True

    workflow_support = {
        "plan": True,
        "review": True,
        "diff": True,
        "patch": normalized_permission_mode not in ("plan", "default"),
        "write_enabled": normalized_permission_mode not in ("plan", "default"),
        "collaboration": bool(runtime_context.get("collaboration_enabled")),
    }
    configuration_readiness = _build_dev_workbench_configuration_readiness(
        current_settings=current_settings,
        runtime_context=runtime_context,
        workspace_dir=workspace_dir,
        workspace_exists=workspace_exists,
    )
    configuration_assistant = _build_dev_workbench_configuration_assistant(
        current_settings=current_settings,
        runtime_context=runtime_context,
        workspace_exists=workspace_exists,
        gateway_probe=gateway_probe,
    )
    if gateway_probe.get("enabled"):
        passthrough_detail = _get_desktop_local_gateway_passthrough_message(gateway_probe)
        for item in configuration_readiness.get("items", []):
            if item.get("id") == "mapping":
                item["status"] = "info"
                item["summary"] = "desktop -> 3457 透传"
                item["detail"] = passthrough_detail
            elif item.get("id") == "provider":
                if gateway_provider_warning:
                    item["status"] = "blocked"
                    item["summary"] = "3457 server provider 未就绪"
                    item["detail"] = gateway_provider_warning
                elif gateway_probe.get("enabled") and not gateway_probe.get("reachable"):
                    item["status"] = "warning"
                    item["summary"] = "3457 server profile 探测失败"
                    item["detail"] = str(gateway_probe.get("message") or "")

        readiness_items = configuration_readiness.get("items", [])
        blocked_count = len([item for item in readiness_items if item.get("status") == "blocked"])
        warning_count = len([item for item in readiness_items if item.get("status") == "warning"])
        if blocked_count > 0:
            overall_status = "blocked"
        elif warning_count > 0:
            overall_status = "warning"
        else:
            overall_status = "ready"

        next_step = (
            gateway_provider_warning
            or (str(gateway_probe.get("message") or "").strip() if gateway_probe.get("enabled") and not gateway_probe.get("reachable") else "")
            or configuration_readiness.get("next_step")
            or passthrough_detail
        )
        configuration_readiness["blocked_count"] = blocked_count
        configuration_readiness["warning_count"] = warning_count
        configuration_readiness["overall_status"] = overall_status
        configuration_readiness["next_step"] = next_step

        mapping_setup = configuration_assistant.get("mapping_setup") or {}
        mapping_setup["status"] = "ready"
        mapping_setup["blocked"] = False
        mapping_setup["message"] = ""
        mapping_setup["resolved_model"] = _resolve_runtime_model_name(current_settings)
        mapping_setup["resolution_source"] = "gateway_passthrough"
        mapping_setup["passthrough"] = True
        configuration_assistant["mapping_setup"] = mapping_setup

    task_stats = {
        "all": 0,
        "running": 0,
        "resumable": 0,
        "developer": 0,
    }
    recent_dev_tasks: List[Dict[str, Any]] = []
    if workspace_dir and workspace_exists:
        try:
            task_center = await get_task_center(workspace_dir)
            tasks = await task_center.list_tasks()
            serialized_tasks = _serialize_task_items(task_center, tasks)
            task_stats["all"] = len(serialized_tasks)
            task_stats["running"] = len([task for task in serialized_tasks if task.get("status") == "running"])
            task_stats["resumable"] = len([task for task in serialized_tasks if task.get("is_resumable")])
            developer_tasks = [
                task for task in serialized_tasks
                if task.get("created_from") == "developer_workbench" or task.get("workflow_kind")
            ]
            task_stats["developer"] = len(developer_tasks)
            recent_dev_tasks = developer_tasks[:5]
        except Exception as exc:
            warnings.append(f"任务中心读取失败：{exc}")

    deduped_warnings: List[str] = []
    seen_warnings: Set[str] = set()
    for raw_warning in warnings:
        warning_text = str(raw_warning or "").strip()
        if not warning_text or warning_text in seen_warnings:
            continue
        seen_warnings.add(warning_text)
        deduped_warnings.append(warning_text)
    warnings = deduped_warnings

    return JSONResponse(content={
        "workspace": {
            "path": workspace_dir,
            "name": runtime_context.get("workspace_name") or "",
            "exists": workspace_exists,
        },
        "cli": {
            "enabled": bool(runtime_context.get("enabled")),
            "engine": runtime_context.get("engine"),
            "permissionMode": runtime_context.get("permission_mode"),
            "normalizedPermissionMode": normalized_permission_mode,
            "visibilityScope": runtime_context.get("visibility_scope"),
            "toolCount": len(tool_names),
            "toolNames": tool_names,
        },
        "runtime_profile": {
            "profile": RUNTIME_PROFILE,
            "app_name": APP_NAME,
            "user_data_dir": USER_DATA_DIR,
        },
        "configuration_readiness": configuration_readiness,
        "configuration_assistant": configuration_assistant,
        "workflow_support": workflow_support,
        "capability_summary": capability_summary,
        "task_stats": task_stats,
        "recent_dev_tasks": recent_dev_tasks,
        "plugin_count": plugin_count,
        "templates": _get_developer_workbench_templates(),
        "warnings": warnings,
    })


_DEV_WORKBENCH_SNAPSHOT_DIRNAME = "dev_workbench_snapshots"


def _dev_workbench_snapshot_dir() -> Path:
    snapshot_dir = Path(USER_DATA_DIR) / _DEV_WORKBENCH_SNAPSHOT_DIRNAME
    snapshot_dir.mkdir(parents=True, exist_ok=True)
    return snapshot_dir


def _safe_dev_workbench_snapshot_id(snapshot_id: str) -> str:
    safe_id = re.sub(r"[^A-Za-z0-9_.-]", "", str(snapshot_id or "").strip())
    if not safe_id:
        raise HTTPException(status_code=400, detail="快照 ID 不能为空")
    return safe_id


def _dev_workbench_snapshot_path(snapshot_id: str) -> Path:
    safe_id = _safe_dev_workbench_snapshot_id(snapshot_id)
    return _dev_workbench_snapshot_dir() / f"{safe_id}.json"


def _dev_workbench_format_bytes(size: int) -> str:
    try:
        value = float(size or 0)
    except Exception:
        value = 0.0
    units = ["B", "KB", "MB", "GB"]
    unit_index = 0
    while value >= 1024 and unit_index < len(units) - 1:
        value /= 1024
        unit_index += 1
    if unit_index == 0:
        return f"{int(value)} {units[unit_index]}"
    return f"{value:.1f} {units[unit_index]}"


def _write_dev_workbench_json(path: Path, payload: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(".tmp")
    tmp_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp_path.replace(path)


def _build_dev_workbench_snapshot_payload(
    current_settings: Dict[str, Any],
    req: DevWorkbenchSnapshotCreateRequest,
) -> Dict[str, Any]:
    include = {
        "roles": bool(req.include_roles),
        "chats": bool(req.include_chats),
        "tools": bool(req.include_tools),
        "skills": bool(req.include_skills),
    }
    settings_payload: Dict[str, Any] = {}
    if include["roles"]:
        for key in ("agents", "mainAgent", "memories", "memorySettings", "system_prompt", "SystemPromptsList"):
            if key in current_settings:
                settings_payload[key] = copy.deepcopy(current_settings.get(key))
    if include["chats"]:
        for key in ("conversationId", "conversations"):
            if key in current_settings:
                settings_payload[key] = copy.deepcopy(current_settings.get(key))
    if include["tools"]:
        for key in (
            "tools",
            "llmTools",
            "mcpServers",
            "a2aServers",
            "custom_http",
            "CLISettings",
            "ccSettings",
            "qcSettings",
            "dsSettings",
            "ocSettings",
            "localEnvSettings",
            "chromeMCPSettings",
            "sqlSettings",
            "KBSettings",
            "VRMConfig",
            "workflows",
            "comfyuiServers",
            "comfyuiAPIkey",
        ):
            if key in current_settings:
                settings_payload[key] = copy.deepcopy(current_settings.get(key))
    if include["skills"]:
        if "skills" in current_settings:
            settings_payload["skills"] = copy.deepcopy(current_settings.get("skills"))
        try:
            skills_root = Path(SKILLS_DIR)
            settings_payload["skillDirectory"] = str(skills_root)
            settings_payload["skillIds"] = sorted([
                child.name
                for child in skills_root.iterdir()
                if child.is_dir() and not child.name.startswith(".")
            ]) if skills_root.exists() else []
        except Exception:
            settings_payload["skillIds"] = []

    snapshot_id = f"snap_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
    created_at = datetime.utcnow().isoformat(timespec="seconds") + "Z"
    agent_count = len(current_settings.get("agents") or {}) if isinstance(current_settings.get("agents"), dict) else 0
    memory_count = len(current_settings.get("memories") or []) if isinstance(current_settings.get("memories"), list) else 0
    default_name = f"OpenXnet snapshot {created_at.replace('T', ' ').replace('Z', '')}"
    return {
        "id": snapshot_id,
        "name": str(req.name or "").strip() or default_name,
        "schema_version": 1,
        "app_version": __version__,
        "created_at": created_at,
        "include": include,
        "summary": {
            "agents": agent_count,
            "memories": memory_count,
            "mcpServers": len(current_settings.get("mcpServers") or {}) if isinstance(current_settings.get("mcpServers"), dict) else 0,
        },
        "settings": settings_payload,
    }


def _normalize_imported_dev_workbench_snapshot(raw_snapshot: Dict[str, Any], name: Optional[str] = None) -> Dict[str, Any]:
    if not isinstance(raw_snapshot, dict) or not raw_snapshot:
        raise HTTPException(status_code=400, detail="快照内容为空或格式错误")
    snapshot = copy.deepcopy(raw_snapshot)
    if not isinstance(snapshot.get("settings"), dict):
        legacy_settings: Dict[str, Any] = {}
        legacy_map = {
            "agents": "agents",
            "roles": "memories",
            "tools": "tools",
            "skills": "skills",
        }
        for source_key, target_key in legacy_map.items():
            if source_key in snapshot:
                legacy_settings[target_key] = snapshot.get(source_key)
        if isinstance(snapshot.get("tools"), dict):
            for key in ("mcpServers", "customHttpTools", "llmTools"):
                if key in snapshot["tools"]:
                    target_key = "custom_http" if key == "customHttpTools" else key
                    legacy_settings[target_key] = snapshot["tools"][key]
        snapshot["settings"] = legacy_settings
    snapshot_id = f"snap_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
    snapshot["id"] = snapshot_id
    snapshot["name"] = str(name or snapshot.get("name") or "Imported OpenXnet snapshot").strip()
    snapshot["created_at"] = snapshot.get("created_at") or datetime.utcnow().isoformat(timespec="seconds") + "Z"
    snapshot["schema_version"] = snapshot.get("schema_version") or 1
    snapshot["app_version"] = snapshot.get("app_version") or __version__
    snapshot["include"] = snapshot.get("include") if isinstance(snapshot.get("include"), dict) else {
        "roles": any(key in snapshot["settings"] for key in ("agents", "memories", "memorySettings")),
        "chats": any(key in snapshot["settings"] for key in ("conversationId", "conversations")),
        "tools": any(key in snapshot["settings"] for key in ("tools", "mcpServers", "CLISettings")),
        "skills": any(key in snapshot["settings"] for key in ("skills", "skillIds")),
    }
    return snapshot


def _serialize_dev_workbench_snapshot_file(path: Path) -> Optional[Dict[str, Any]]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        stat = path.stat()
    except Exception:
        return None
    include = payload.get("include") if isinstance(payload.get("include"), dict) else {}
    summary = payload.get("summary") if isinstance(payload.get("summary"), dict) else {}
    role_bits: List[str] = []
    if include.get("roles"):
        role_bits.append(f"{summary.get('agents', 0)} agents")
        role_bits.append(f"{summary.get('memories', 0)} memories")
    if include.get("tools"):
        role_bits.append(f"{summary.get('mcpServers', 0)} MCP")
    return {
        "id": payload.get("id") or path.stem,
        "name": payload.get("name") or path.stem,
        "created": payload.get("created_at") or datetime.fromtimestamp(stat.st_mtime).isoformat(timespec="seconds"),
        "size": _dev_workbench_format_bytes(stat.st_size),
        "sizeBytes": stat.st_size,
        "roles": " / ".join([item for item in role_bits if item]) or "-",
        "include": include,
    }


@app.get("/v1/dev/workbench/snapshots")
async def developer_workbench_list_snapshots_endpoint():
    snapshot_dir = _dev_workbench_snapshot_dir()
    snapshots = [
        item for item in (
            _serialize_dev_workbench_snapshot_file(path)
            for path in snapshot_dir.glob("*.json")
        )
        if item
    ]
    snapshots.sort(key=lambda item: str(item.get("created") or ""), reverse=True)
    return {"success": True, "snapshots": snapshots}


@app.post("/v1/dev/workbench/snapshots")
async def developer_workbench_create_snapshot_endpoint(req: DevWorkbenchSnapshotCreateRequest):
    current_settings = await load_settings()
    snapshot = _build_dev_workbench_snapshot_payload(current_settings, req)
    path = _dev_workbench_snapshot_path(snapshot["id"])
    _write_dev_workbench_json(path, snapshot)
    return {
        "success": True,
        "snapshot": _serialize_dev_workbench_snapshot_file(path),
    }


@app.post("/v1/dev/workbench/snapshots/import")
async def developer_workbench_import_snapshot_endpoint(req: DevWorkbenchSnapshotImportRequest):
    snapshot = _normalize_imported_dev_workbench_snapshot(req.snapshot, req.name)
    path = _dev_workbench_snapshot_path(snapshot["id"])
    _write_dev_workbench_json(path, snapshot)
    return {
        "success": True,
        "snapshot": _serialize_dev_workbench_snapshot_file(path),
    }


@app.get("/v1/dev/workbench/snapshots/{snapshot_id}")
async def developer_workbench_get_snapshot_endpoint(snapshot_id: str):
    path = _dev_workbench_snapshot_path(snapshot_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="快照不存在")
    try:
        return JSONResponse(content=json.loads(path.read_text(encoding="utf-8")))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"快照读取失败：{exc}") from exc


@app.post("/v1/dev/workbench/snapshots/{snapshot_id}/restore")
async def developer_workbench_restore_snapshot_endpoint(snapshot_id: str):
    global settings
    path = _dev_workbench_snapshot_path(snapshot_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="快照不存在")
    try:
        snapshot = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"快照读取失败：{exc}") from exc
    snapshot_settings = snapshot.get("settings")
    if not isinstance(snapshot_settings, dict) or not snapshot_settings:
        raise HTTPException(status_code=400, detail="快照不包含可恢复的配置")

    current_settings = await load_settings()
    for key, value in snapshot_settings.items():
        if key in {"skillDirectory", "skillIds"}:
            continue
        current_settings[key] = copy.deepcopy(value)
    await save_settings(current_settings)
    settings = current_settings
    await broadcast_settings_update(current_settings)
    return {"success": True, "restored": snapshot_id}


@app.delete("/v1/dev/workbench/snapshots/{snapshot_id}")
async def developer_workbench_delete_snapshot_endpoint(snapshot_id: str):
    path = _dev_workbench_snapshot_path(snapshot_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="快照不存在")
    try:
        path.unlink()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"快照删除失败：{exc}") from exc
    return {"success": True, "deleted": snapshot_id}


_DEV_WORKBENCH_LANG_BY_EXT = {
    ".py": "Python",
    ".js": "JavaScript",
    ".mjs": "JavaScript",
    ".jsx": "JavaScript",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".vue": "Vue",
    ".go": "Go",
    ".rs": "Rust",
    ".java": "Java",
    ".cs": "C#",
    ".cpp": "C++",
    ".cc": "C++",
    ".c": "C",
    ".h": "C/C++",
    ".hpp": "C++",
    ".html": "HTML",
    ".css": "CSS",
    ".scss": "SCSS",
    ".json": "JSON",
    ".md": "Markdown",
    ".yml": "YAML",
    ".yaml": "YAML",
    ".toml": "TOML",
    ".sql": "SQL",
}


def _collect_dev_workbench_repo_stats(root: Path) -> Dict[str, Any]:
    file_count = 0
    ext_counts: Dict[str, int] = {}
    newest_mtime = 0.0
    max_files = 200000
    for current_root, dirs, files in os.walk(root):
        dirs[:] = [
            item for item in dirs
            if item not in _DEV_WORKBENCH_SEARCH_IGNORE_DIRS and not item.startswith(".agent-shadow")
        ]
        for filename in files:
            if file_count >= max_files:
                break
            file_count += 1
            suffix = Path(filename).suffix.lower()
            lang = _DEV_WORKBENCH_LANG_BY_EXT.get(suffix)
            if lang:
                ext_counts[lang] = ext_counts.get(lang, 0) + 1
            try:
                newest_mtime = max(newest_mtime, (Path(current_root) / filename).stat().st_mtime)
            except OSError:
                pass
        if file_count >= max_files:
            break

    top_langs = [
        lang for lang, _ in sorted(ext_counts.items(), key=lambda item: item[1], reverse=True)[:5]
    ]
    return {
        "name": root.name or str(root),
        "path": str(root),
        "langs": ", ".join(top_langs) if top_langs else "-",
        "indexed": datetime.fromtimestamp(newest_mtime).strftime("%Y-%m-%d %H:%M") if newest_mtime else "-",
        "files": file_count,
        "truncated": file_count >= max_files,
    }


async def _load_dev_workbench_repositories() -> Dict[str, Any]:
    current_settings = await load_settings()
    runtime_context = _get_cli_runtime_context(current_settings)
    workspace_dir = str(runtime_context.get("workspace_dir") or "").strip()
    if not workspace_dir:
        return {"success": True, "repos": [], "warning": "尚未配置 CLI 工作区"}
    root = Path(workspace_dir).expanduser().resolve()
    if not root.exists() or not root.is_dir():
        return {"success": True, "repos": [], "warning": f"工作区路径不存在：{root}"}
    repo = await asyncio.to_thread(_collect_dev_workbench_repo_stats, root)
    return {"success": True, "repos": [repo]}


@app.get("/v1/dev/workbench/repositories")
async def developer_workbench_repositories_endpoint():
    return await _load_dev_workbench_repositories()


@app.post("/v1/dev/workbench/code/reindex")
async def developer_workbench_code_reindex_endpoint():
    return await _load_dev_workbench_repositories()


@app.post("/v1/dev/workbench/mcp/{server_name}/toggle")
async def developer_workbench_toggle_mcp_endpoint(
    server_name: str,
    req: DevWorkbenchMcpToggleRequest,
    background_tasks: BackgroundTasks,
):
    global settings, mcp_client_list, mcp_status
    current_settings = await load_settings()
    mcp_servers = current_settings.setdefault("mcpServers", {})
    if server_name not in mcp_servers:
        raise HTTPException(status_code=404, detail="MCP 服务不存在")
    mcp_servers[server_name]["disabled"] = not bool(req.enabled)
    if req.enabled:
        mcp_servers[server_name]["processingStatus"] = "initializing"
    else:
        mcp_servers[server_name]["processingStatus"] = "stopped"
    await save_settings(current_settings)
    settings = current_settings
    await broadcast_settings_update(current_settings)

    if req.enabled:
        background_tasks.add_task(process_mcp, server_name)
    else:
        if server_name in mcp_client_list:
            try:
                mcp_client_list[server_name].disabled = True
                await mcp_client_list[server_name].close()
            finally:
                mcp_client_list.pop(server_name, None)
        mcp_status[server_name] = "stopped"
    return {"success": True, "name": server_name, "enabled": bool(req.enabled)}


_DEV_WORKBENCH_SEARCH_IGNORE_DIRS = {
    ".git",
    ".hg",
    ".svn",
    ".venv",
    "venv",
    "node_modules",
    "dist",
    "build",
    "release",
    "__pycache__",
    ".next",
    ".nuxt",
    ".cache",
}

_DEV_WORKBENCH_SEARCH_TEXT_EXTS = {
    "",
    ".bat",
    ".c",
    ".cc",
    ".cfg",
    ".conf",
    ".cpp",
    ".cs",
    ".css",
    ".env",
    ".go",
    ".h",
    ".hpp",
    ".html",
    ".ini",
    ".java",
    ".js",
    ".json",
    ".jsx",
    ".log",
    ".md",
    ".mjs",
    ".ps1",
    ".py",
    ".rs",
    ".sh",
    ".sql",
    ".toml",
    ".ts",
    ".tsx",
    ".txt",
    ".vue",
    ".xml",
    ".yaml",
    ".yml",
}


def _is_path_inside(child: Path, parent: Path) -> bool:
    try:
        child.resolve().relative_to(parent.resolve())
        return True
    except Exception:
        return False


def _search_dev_workbench_files(root: Path, query: str, max_results: int) -> List[Dict[str, Any]]:
    results: List[Dict[str, Any]] = []
    lowered_query = query.lower()
    max_count = max(1, min(int(max_results or 40), 100))

    for current_root, dirs, files in os.walk(root):
        dirs[:] = [
            item for item in dirs
            if item not in _DEV_WORKBENCH_SEARCH_IGNORE_DIRS and not item.startswith(".agent-shadow")
        ]
        current_path = Path(current_root)
        for filename in files:
            if len(results) >= max_count:
                return results

            file_path = current_path / filename
            suffix = file_path.suffix.lower()
            if suffix not in _DEV_WORKBENCH_SEARCH_TEXT_EXTS:
                continue

            try:
                size = file_path.stat().st_size
            except OSError:
                continue
            if size > 1024 * 1024:
                continue

            rel_path = str(file_path.relative_to(root)).replace("\\", "/")
            if lowered_query in filename.lower() or lowered_query in rel_path.lower():
                results.append({
                    "file": rel_path,
                    "line": 0,
                    "preview": filename,
                    "matchType": "filename",
                })
                if len(results) >= max_count:
                    return results

            try:
                with file_path.open("r", encoding="utf-8", errors="ignore") as handle:
                    for line_no, line in enumerate(handle, start=1):
                        if lowered_query not in line.lower():
                            continue
                        results.append({
                            "file": rel_path,
                            "line": line_no,
                            "preview": line.strip()[:240],
                            "matchType": "content",
                        })
                        break
            except OSError:
                continue

    return results


@app.post("/v1/dev/workbench/code/search")
async def developer_workbench_code_search_endpoint(req: DevWorkbenchCodeSearchRequest):
    query = str(req.query or "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="搜索关键词不能为空")

    current_settings = await load_settings()
    runtime_context = _get_cli_runtime_context(current_settings)
    configured_workspace = str(runtime_context.get("workspace_dir") or "").strip()
    requested_root = str(req.root or "").strip()
    root_value = requested_root or configured_workspace
    if not root_value:
        raise HTTPException(status_code=400, detail="尚未配置 CLI 工作区")

    root = Path(root_value).expanduser().resolve()
    if not root.exists() or not root.is_dir():
        raise HTTPException(status_code=400, detail=f"工作区路径不存在：{root}")

    if requested_root and configured_workspace:
        configured_root = Path(configured_workspace).expanduser().resolve()
        if configured_root.exists() and not _is_path_inside(root, configured_root):
            raise HTTPException(status_code=400, detail="搜索路径必须位于当前 CLI 工作区内")

    results = await asyncio.to_thread(
        _search_dev_workbench_files,
        root,
        query,
        req.max_results,
    )
    return {
        "success": True,
        "query": query,
        "root": str(root),
        "results": results,
        "total": len(results),
    }


def sanitize_proxy_url(input_url: str) -> str:
    """
    针对代理场景优化的 URL 安全过滤
    """
    if not input_url:
        raise HTTPException(status_code=400, detail="URL 不能为空")
    
    # 1. 解析 URL
    parsed = urlparse(input_url)
    
    # 2. 验证协议 (禁止 file://, gopher:// 等协议)
    if parsed.scheme not in ["http", "https"]:
        raise HTTPException(status_code=400, detail="仅支持 http 或 https 协议")
    
    if not parsed.netloc:
        raise HTTPException(status_code=400, detail="无效的域名或 IP")

    # 3. 重新构造 URL (消除 SSRF 污点)
    # 排除 userinfo, 只保留必要部分
    safe_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
    if parsed.query:
        safe_url += f"?{parsed.query}"
    if parsed.fragment:
        safe_url += f"#{parsed.fragment}"

    # 4. 内网审计
    if is_private_ip(parsed.hostname):
        logger.warning(f"Internal access detected: {safe_url}")

    return safe_url

@app.api_route("/extension_proxy", methods=["GET", "POST"])
async def extension_proxy(request: Request, url: str):
    """
    方便SAP插件调用的通用代理接口，让插件能够绕过 CORS 限制访问任意 URL。
    """
    BROWSER_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    # --- 阶段 A: 安全校验 (保留，防止 SSRF 攻击内网) ---
    try:
        target_url = sanitize_proxy_url(url)
    except HTTPException as e:
        return Response(content=e.detail, status_code=e.status_code)
    
    # --- 阶段 B: 执行代理请求 ---
    method = request.method
    body = await request.body()
    
    # 构造 Header：只保留必要的，去除杂质，添加身份标识
    # 排除可能导致指纹泄露或被拒绝的 Header
    excluded_headers = {
        'host', 'content-length', 'connection', 'keep-alive', 
        'upgrade-insecure-requests', 'accept-encoding', 'cookie', 'user-agent'
    }
    
    headers = {
        k: v for k, v in request.headers.items() 
        if k.lower() not in excluded_headers
    }
    
    # 【关键点 1】：使用标准浏览器 UA，声明这是用户阅读行为
    headers["User-Agent"] = BROWSER_USER_AGENT
    
    # 【关键点 2】：明确告诉服务器我们接受 XML/RSS 格式，这显得更像一个良性阅读器
    if "accept" not in headers or "*/*" in headers["accept"]:
        headers["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"

    # 【关键点 3】：处理 Referer。有些防盗链机制需要 Referer，有些（如 Reddit）看到奇怪的 Referer 会拦截
    # 最安全的做法是不发送 Referer，或者设为目标域名的根目录
    headers.pop("Referer", None) 
    
    print(f"--- [Extension Proxy] ---")
    print(f"Target: {target_url} | Method: {method} | Mode: Browser Emulation")
    
    # trust_env=False: 防止你的 Python 代码意外使用了系统层的 HTTP 代理
    async with httpx.AsyncClient(verify=False, follow_redirects=True, timeout=30.0, trust_env=False) as client:
        try:
            resp = await client.request(
                method=method,
                url=target_url,
                headers=headers,
                content=body
            )
            
            # 清洗响应头：防止将压缩编码或分块传输透传给前端导致解析错误
            resp_headers = {
                k: v for k, v in resp.headers.items()
                if k.lower() not in {
                    'content-encoding', 'content-length', 'transfer-encoding', 
                    'server', 'set-cookie' # 也不要透传 Set-Cookie，保护用户隐私
                }
            }
            
            # 如果 Reddit 依然返回 403，通常内容里会有错误提示，照样返回给前端便于调试
            if resp.status_code == 403:
                print(f"[Proxy Warning] Target returned 403. Body sample: {resp.content[:100]}")

            return Response(
                content=resp.content,
                status_code=resp.status_code,
                headers=resp_headers,
                media_type=resp.headers.get("content-type", "application/octet-stream")
            )

        except httpx.ConnectError as e:
            err_msg = f"Proxy Connect Error: {e}"
            # 返回 JSON 格式错误以便前端优雅处理
            return Response(content=f'{{"error": "{err_msg}"}}', status_code=502, media_type="application/json")
            
        except Exception as e:
            print(f"[Proxy Error] System: {repr(e)}")
            return Response(content='{"error": "Internal Proxy Error"}', status_code=500, media_type="application/json")

        
# 存储活跃的ASR WebSocket连接
asr_connections = []

# 存储每个连接的音频帧数据
audio_buffer: Dict[str, Dict[str, Any]] = {}

def _detect_quiet_asr_audio(audio_bytes: bytes) -> Optional[Dict[str, Any]]:
    """Return audio stats when the upload is effectively silence; fail open."""
    if not audio_bytes:
        return {
            "duration_seconds": 0.0,
            "rms": 0.0,
            "peak": 0.0,
            "reason": "empty_audio",
        }

    try:
        from array import array
        import wave

        with wave.open(BytesIO(audio_bytes), "rb") as wave_file:
            sample_rate = wave_file.getframerate()
            channel_count = wave_file.getnchannels()
            sample_width = wave_file.getsampwidth()
            frame_count = wave_file.getnframes()
            frames = wave_file.readframes(frame_count)
        if sample_rate <= 0 or channel_count <= 0 or frame_count <= 0 or not frames:
            return {
                "duration_seconds": 0.0,
                "rms": 0.0,
                "peak": 0.0,
                "reason": "empty_audio",
            }

        type_codes = {1: "B", 2: "h", 4: "i"}
        normalization = {1: 128.0, 2: 32768.0, 4: 2147483648.0}
        type_code = type_codes.get(sample_width)
        if type_code is None:
            return None
        samples = array(type_code)
        samples.frombytes(frames)
        if sys.byteorder != "little" and sample_width > 1:
            samples.byteswap()
        normalized_samples = (
            ((sample - 128.0) / normalization[sample_width]) if sample_width == 1
            else (sample / normalization[sample_width])
            for sample in samples
        )
        square_sum = 0.0
        peak = 0.0
        sample_count = 0
        for sample in normalized_samples:
            absolute_sample = abs(sample)
            peak = max(peak, absolute_sample)
            square_sum += sample * sample
            sample_count += 1
        duration_seconds = float(frame_count / sample_rate)
        rms = (square_sum / sample_count) ** 0.5 if sample_count else 0.0

        if duration_seconds < 0.25:
            return {
                "duration_seconds": round(duration_seconds, 3),
                "rms": round(rms, 6),
                "peak": round(peak, 6),
                "reason": "too_short",
            }

        if rms < 0.0005 and peak < 0.003:
            return {
                "duration_seconds": round(duration_seconds, 3),
                "rms": round(rms, 6),
                "peak": round(peak, 6),
                "reason": "quiet_audio",
            }
    except Exception as exc:
        print(f"ASR quiet-audio preflight skipped: {exc}")

    return None

def convert_audio_to_pcm16(audio_bytes: bytes, target_sample_rate: int = 16000) -> bytes:
    """
    将音频数据转换为PCM16格式，采样率16kHz
    """
    try:
        from py.audio_pcm import convert_wav_to_pcm16

        return convert_wav_to_pcm16(audio_bytes, target_sample_rate)
    except Exception as e:
        print(f"Audio conversion error: {e}")
        # 如果转换失败，尝试直接返回原始数据
        return audio_bytes

async def funasr_recognize(audio_data: bytes, funasr_settings: dict,ws: WebSocket,frame_id) -> str:
    """
    使用FunASR进行语音识别
    """
    try:
        # 获取FunASR服务器地址
        funasr_url = funasr_settings.get('funasr_ws_url', 'ws://localhost:10095')
        hotwords = funasr_settings.get('hotwords', '')
        if not funasr_url.startswith('ws://') and not funasr_url.startswith('wss://'):
            funasr_url = f"ws://{funasr_url}"
        
        # 连接到FunASR服务器
        async with websockets.connect(funasr_url) as websocket:
            print(f"Connected to FunASR server: {funasr_url}")
            
            # 1. 发送初始化配置
            init_config = {
                "chunk_size": [5, 10, 5],
                "wav_name": "python_client",
                "is_speaking": True,
                "chunk_interval": 10,
                "mode": "offline",  # 使用离线模式
                "hotwords": hotwords_to_json(hotwords),
                "use_itn": True
            }
            
            await websocket.send(json.dumps(init_config))
            print("Sent init config")
            
            # 2. 转换音频数据为PCM16格式
            pcm_data = convert_audio_to_pcm16(audio_data)
            print(f"PCM data length: {len(pcm_data)} bytes")
            
            # 3. 分块发送音频数据
            chunk_size = 960  # 30ms的音频数据 (16000 * 0.03 * 2 = 960字节)
            total_sent = 0
            
            while total_sent < len(pcm_data):
                chunk_end = min(total_sent + chunk_size, len(pcm_data))
                chunk = pcm_data[total_sent:chunk_end]
                
                # 发送二进制PCM数据
                await websocket.send(chunk)
                total_sent = chunk_end
            
            print(f"Sent all audio data: {total_sent} bytes")
            
            # 4. 发送结束信号
            end_config = {
                "is_speaking": False,
            }
            
            await websocket.send(json.dumps(end_config))
            print("Sent end signal")
            
            # 5. 等待识别结果
            result_text = ""
            timeout_count = 0
            max_timeout = 200  # 最大等待20秒
            
            while timeout_count < max_timeout:
                try:
                    # 等待响应消息
                    response = await asyncio.wait_for(websocket.recv(), timeout=0.1)
                    
                    try:
                        # 尝试解析JSON响应
                        json_response = json.loads(response)
                        print(f"Received response: {json_response}")
                        
                        if 'text' in json_response:
                            text = json_response['text']
                            if text and text.strip():
                                result_text += text
                                print(f"Got text: {text}")
                                # 发送结果
                                await ws.send_json({
                                    "type": "transcription",
                                    "id": frame_id,
                                    "text": result_text,
                                    "is_final": True
                                })
                            # 检查是否为最终结果
                            if json_response.get('is_final', False):
                                print("Got final result")
                                break
                                
                    except json.JSONDecodeError:
                        # 如果不是JSON格式，可能是二进制数据，忽略
                        print(f"Non-JSON response: {response}")
                        pass
                        
                except asyncio.TimeoutError:
                    timeout_count += 1
                    continue
                except websockets.exceptions.ConnectionClosed:
                    print("WebSocket connection closed")
                    break
            
            if not result_text:
                print("No recognition result received")
                return ""
            
            return result_text.strip()
            
    except Exception as e:
        print(f"FunASR recognition error: {type(e).__name__}")
        return "FunASR识别失败"

def hotwords_to_json(input_str):
    # 初始化结果字典
    result = {}
    
    # 按行分割输入字符串
    lines = input_str.split('\n')
    
    for line in lines:
        # 清理行首尾的空白字符
        cleaned_line = line.strip()
        
        # 跳过空行
        if not cleaned_line:
            continue
            
        # 分割词语和权重
        parts = cleaned_line.rsplit(' ', 1)  # 从右边分割一次
        
        if len(parts) != 2:
            continue  # 跳过格式不正确的行
            
        word = parts[0].strip()
        try:
            weight = int(parts[1])
        except ValueError:
            continue  # 跳过权重不是数字的行
            
        # 添加到结果字典
        result[word] = weight
    
    # 转换为JSON字符串
    return json.dumps(result, ensure_ascii=False)

# ASR WebSocket处理
@app.websocket("/ws/asr")
async def asr_websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    # 生成唯一的连接ID
    connection_id = str(uuid.uuid4())
    asr_connections.append(websocket)
    funasr_websocket = None
    # 新增：连接状态跟踪变量
    asr_engine = None
    funasr_mode = None
    
    try:
        # 处理消息
        async for message in websocket.iter_json():
            msg_type = message.get("type")
            
            if msg_type == "init":
                # 加载设置
                settings = await load_settings()
                asr_settings = settings.get('asrSettings', {})
                asr_engine = asr_settings.get('engine', 'openai')  # 存储引擎类型
                if asr_engine == "funasr":
                    funasr_mode = asr_settings.get('funasr_mode', 'openai')  # 存储模式
                    if funasr_mode == "2pass" or funasr_mode == "online":
                        # 获取FunASR服务器地址
                        funasr_url = asr_settings.get('funasr_ws_url', 'ws://localhost:10095')
                        if not funasr_url.startswith('ws://') and not funasr_url.startswith('wss://'):
                            funasr_url = f"ws://{funasr_url}"
                        try:
                            funasr_websocket = await websockets.connect(funasr_url)
                        except Exception as e:
                            funasr_websocket = None
                            print(f"连接FunASR失败: {type(e).__name__}")
                await websocket.send_json({
                    "type": "init_response",
                    "status": "ready"
                })
                print("ASR WebSocket connected:",asr_engine)
            elif msg_type == "audio_start":
                frame_id = message.get("id")
                # 加载设置
                settings = await load_settings()
                asr_settings = settings.get('asrSettings', {})
                asr_engine = asr_settings.get('engine', 'openai')  # 存储引擎类型
                if asr_engine == "funasr":
                    funasr_mode = asr_settings.get('funasr_mode', '2pass')  # 存储模式
                    hotwords = asr_settings.get('hotwords', '')
                    if funasr_mode == "2pass":
                        # 获取FunASR服务器地址
                        funasr_url = asr_settings.get('funasr_ws_url', 'ws://localhost:10095')
                        if not funasr_url.startswith('ws://') and not funasr_url.startswith('wss://'):
                            funasr_url = f"ws://{funasr_url}"
                        try:
                            if not funasr_websocket:
                                # 连接到FunASR服务器 
                                funasr_websocket = await websockets.connect(funasr_url)
                            # 1. 发送初始化配置
                            init_config = {
                                "chunk_size": [5, 10, 5],
                                "wav_name": "python_client",
                                "is_speaking": True,
                                "chunk_interval": 10,
                                "mode": funasr_mode,  
                                "hotwords": hotwords_to_json(hotwords),
                                "use_itn": True
                            }
                            await funasr_websocket.send(json.dumps(init_config))
                            print("Sent init config")
                            # 2. 开启一个异步任务处理FunASR的响应
                            asyncio.create_task(handle_funasr_response(funasr_websocket, websocket))
                        except Exception as e:
                            print(f"连接FunASR失败: {type(e).__name__}")
                            await websocket.send_json({
                                "type": "error",
                                "message": "无法连接FunASR服务器"
                            })
                            # 标记连接失败，避免后续操作
                            funasr_websocket = None
                    else:
                        # 关闭异步任务处理FunASR的响应
                        funasr_websocket = None
                else:
                    # 关闭异步任务处理FunASR的响应
                    funasr_websocket = None
            # 修改点：增加流式音频处理前的检查
            elif msg_type == "audio_stream":
                frame_id = message.get("id")
                audio_base64 = message.get("audio")

                # 关键检查：确保funasr_websocket已初始化
                if not funasr_websocket:
                    continue  # 跳过当前消息处理

                if audio_base64:
                    # 1. Base64 解码 → 得到二进制 PCM (Int16)
                    pcm_data = base64.b64decode(audio_base64)

                    # 2. 直接转发二进制给 FunASR
                    try:
                        await funasr_websocket.send(pcm_data)
                    except websockets.exceptions.ConnectionClosed:
                        funasr_websocket = None
                        # 加载设置
                        settings = await load_settings()
                        asr_settings = settings.get('asrSettings', {})
                        asr_engine = asr_settings.get('engine', 'openai')  # 存储引擎类型
                        if asr_engine == "funasr":
                            funasr_mode = asr_settings.get('funasr_mode', '2pass')  # 存储模式
                            if funasr_mode == "2pass":
                                # 获取FunASR服务器地址
                                funasr_url = asr_settings.get('funasr_ws_url', 'ws://localhost:10095')
                                if not funasr_url.startswith('ws://') and not funasr_url.startswith('wss://'):
                                    funasr_url = f"ws://{funasr_url}"
                                try:
                                    funasr_websocket = await websockets.connect(funasr_url)
                                except Exception as e:
                                    funasr_websocket = None
                                    print(f"连接FunASR失败: {type(e).__name__}")
            elif msg_type == "audio_complete":
                # 处理完整的音频数据（非流式模式）
                frame_id = message.get("id")
                audio_b64 = message.get("audio")
                audio_format = message.get("format", "wav")
                
                if audio_b64:
                    # 解码base64数据
                    audio_bytes = base64.b64decode(audio_b64)
                    print(f"Received audio data: {len(audio_bytes)} bytes, format: {audio_format}")
                    
                    try:
                        # 加载设置
                        settings = await load_settings()
                        asr_settings = settings.get('asrSettings', {})
                        asr_engine = asr_settings.get('engine', 'openai')
                        
                        result = ""
                        
                        if asr_engine == "openai":
                            # OpenAI ASR
                            audio_file = BytesIO(audio_bytes)
                            audio_file.name = f"audio.{audio_format}"
                            
                            client = AsyncOpenAI(
                                api_key=asr_settings.get('api_key', ''),
                                base_url=asr_settings.get('base_url', '') or "https://api.openai.com/v1"
                            )
                            response = await client.audio.transcriptions.create(
                                file=audio_file,
                                model=asr_settings.get('model', 'whisper-1'),
                            )
                            result = response.text
                            # 发送结果
                            await websocket.send_json({
                                "type": "transcription",
                                "id": frame_id,
                                "text": result,
                                "is_final": True
                            })
                        elif asr_engine == "funasr":
                            # FunASR
                            print("Using FunASR engine")
                            funasr_mode = asr_settings.get('funasr_mode', 'offline')
                            if funasr_mode == "offline":
                                result = await funasr_recognize(audio_bytes, asr_settings,websocket,frame_id)
                            else:
                                # 关键检查：确保连接有效
                                if not funasr_websocket:
                                    continue
                                
                                # 4. 发送结束信号
                                end_config = {
                                    "is_speaking": False  # 只需发送必要的结束标记
                                }
                                try:
                                    await funasr_websocket.send(json.dumps(end_config))
                                    print("Sent end signal")
                                except websockets.exceptions.ConnectionClosed:
                                    print("FunASR连接已关闭，无法发送结束信号")
                            funasr_websocket = None

                        elif asr_engine == "sherpa":
                            result = await transcribe_with_voice_worker(audio_bytes)
                            print(f"Sherpa result: {result}")
                            await websocket.send_json({
                                "type": "transcription",
                                "id": frame_id,
                                "text": result,
                                "is_final": True
                            })

                    except VoiceWorkerClientError as e:
                        print(f"Voice Worker error: {e.code}: {e}")
                        await websocket.send_json({
                            "type": "error",
                            "id": frame_id,
                            "code": e.code,
                            "message": str(e),
                            "retryable": e.retryable,
                        })
                    except WebSocketDisconnect:
                        print(f"ASR WebSocket disconnected: {connection_id}")
                    except Exception as e:
                        print(f"ASR WebSocket error: {type(e).__name__}")
    finally:
        # 清理资源
        if connection_id in audio_buffer:
            del audio_buffer[connection_id]
        if websocket in asr_connections:
            asr_connections.remove(websocket)
        # 新增：确保关闭FunASR连接
        if funasr_websocket:
            await funasr_websocket.close()

@app.post("/asr")
async def asr_transcription(
    audio: UploadFile = File(...),
    format: str = Form(default="auto")
):
    """接收有界上传音频并按设置转写；桌面模式委托 Voice Worker，Server 模式保留兼容实现。"""
    # 声明使用全局缓存
    global openai_asr_clients_cache, settings

    try:
        # 1. 读取上传的音频文件
        audio_bytes = await audio.read()
        print(f"Received audio file: {audio.filename}, size: {len(audio_bytes)} bytes")
        
        # 2. 自动检测格式
        if format == "auto":
            if audio.filename:
                file_ext = audio.filename.split('.')[-1].lower()
                format = file_ext if file_ext in ['wav', 'mp3', 'flac', 'ogg', 'm4a'] else 'wav'
            else:
                format = 'wav'

        quiet_audio = _detect_quiet_asr_audio(audio_bytes)
        if quiet_audio:
            print(f"ASR skipped quiet upload: {quiet_audio}")
            return JSONResponse(
                content={
                    "success": True,
                    "text": "",
                    "engine": "none",
                    "format": format,
                    "skipped": True,
                    "reason": quiet_audio["reason"],
                    "audio": quiet_audio,
                }
            )
        
        # 3. 加载设置 (为了性能，可以直接使用全局变量 settings，或者重新加载)
        current_settings = await load_settings()
        asr_settings = current_settings.get('asrSettings', {})
        asr_engine = asr_settings.get('engine', 'openai')

        voice_worker_client = VoiceWorkerClient.from_environment()
        if voice_worker_client.configured:
            result = await voice_worker_client.transcribe_configured(
                audio_bytes,
                format,
                asr_settings,
            )
            return JSONResponse(
                content={
                    "success": True,
                    "text": result,
                    "engine": asr_engine,
                    "format": format,
                }
            )
        
        result = ""
        
        # ==========================================
        # ASR 引擎分支：OpenAI (Whisper)
        # ==========================================
        if asr_engine == "openai":
            api_key = asr_settings.get('api_key', '')
            base_url = asr_settings.get('base_url', '') or "https://api.openai.com/v1"
            
            if not api_key:
                raise HTTPException(status_code=400, detail="OpenAI ASR API密钥未配置")

            # --- 核心改进：使用缓存的客户端 ---
            cache_key = (api_key, base_url)
            if cache_key not in openai_asr_clients_cache:
                print(f"Initializing new OpenAI ASR Client for: {base_url}")
                openai_asr_clients_cache[cache_key] = AsyncOpenAI(
                    api_key=api_key,
                    base_url=base_url
                )
            client = openai_asr_clients_cache[cache_key]
            # --------------------------------

            print(f"Using OpenAI ASR engine ({asr_settings.get('model', 'whisper-1')})")
            
            # 包装音频数据
            audio_file = BytesIO(audio_bytes)
            # OpenAI SDK 要求文件必须有特定的名字后缀来判断类型
            audio_file.name = f"audio.{format}"
            
            response = await client.audio.transcriptions.create(
                file=audio_file,
                model=asr_settings.get('model', 'whisper-1'),
            )
            result = response.text
            
        # ==========================================
        # ASR 引擎分支：FunASR
        # ==========================================
        elif asr_engine == "funasr":
            print("Using FunASR engine (offline mode)")
            # 假设 funasr_recognize_offline 内部已处理好性能问题
            result = await funasr_recognize_offline(audio_bytes, asr_settings)
            
        # ==========================================
        # ASR 引擎分支：Sherpa (本地)
        # ==========================================
        elif asr_engine == "sherpa":
            print("Using Sherpa ASR engine")
            result = await transcribe_with_voice_worker(audio_bytes)
        

        else:
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "error": f"不支持的ASR引擎: {asr_engine}",
                    "text": ""
                }
            )
        
        # 4. 返回识别结果
        return JSONResponse(
            content={
                "success": True,
                "text": result.strip() if result else "",
                "engine": asr_engine,
                "format": format
            }
        )
        
    except VoiceWorkerClientError as e:
        print(f"Voice Worker HTTP error: {e.code}: {e}")
        return JSONResponse(
            status_code=503 if e.retryable else 422,
            content={
                "success": False,
                "error": "语音识别服务请求失败",
                "code": e.code,
                "retryable": e.retryable,
                "text": "",
            }
        )
    except Exception as e:
        print(f"ASR HTTP interface error: {type(e).__name__}")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": "语音识别服务请求失败",
                "text": ""
            }
        )

async def funasr_recognize_offline(audio_data: bytes, funasr_settings: dict) -> str:
    """
    FunASR离线识别（专为HTTP接口优化）
    """
    try:
        # 获取FunASR服务器地址
        funasr_url = funasr_settings.get('funasr_ws_url', 'ws://localhost:10095')
        hotwords = funasr_settings.get('hotwords', '')
        if not funasr_url.startswith('ws://') and not funasr_url.startswith('wss://'):
            funasr_url = f"ws://{funasr_url}"
        
        # 连接到FunASR服务器
        async with websockets.connect(funasr_url) as websocket:
            print(f"Connected to FunASR server: {funasr_url}")
            
            # 1. 发送初始化配置（强制离线模式）
            init_config = {
                "chunk_size": [5, 10, 5],
                "wav_name": "http_client",
                "is_speaking": True,
                "chunk_interval": 10,
                "mode": "offline",  # 强制使用离线模式
                "hotwords": hotwords_to_json(hotwords),
                "use_itn": True
            }
            
            await websocket.send(json.dumps(init_config))
            print("Sent init config for offline mode")
            
            # 2. 转换音频数据为PCM16格式
            pcm_data = convert_audio_to_pcm16(audio_data)
            print(f"PCM data length: {len(pcm_data)} bytes")
            
            # 3. 分块发送音频数据
            chunk_size = 960  # 30ms的音频数据
            total_sent = 0
            
            while total_sent < len(pcm_data):
                chunk_end = min(total_sent + chunk_size, len(pcm_data))
                chunk = pcm_data[total_sent:chunk_end]
                await websocket.send(chunk)
                total_sent = chunk_end
            
            print(f"Sent all audio data: {total_sent} bytes")
            
            # 4. 发送结束信号
            end_config = {
                "is_speaking": False,
            }
            await websocket.send(json.dumps(end_config))
            print("Sent end signal")
            
            # 5. 等待识别结果
            result_text = ""
            timeout_count = 0
            max_timeout = 300  # 最大等待30秒（HTTP接口可以等待更久）
            
            while timeout_count < max_timeout:
                try:
                    response = await asyncio.wait_for(websocket.recv(), timeout=0.1)
                    
                    try:
                        json_response = json.loads(response)
                        print(f"Received response: {json_response}")
                        
                        if 'text' in json_response:
                            text = json_response['text']
                            if text and text.strip():
                                result_text += text
                                print(f"Got text: {text}")
                            
                            # 检查是否为最终结果
                            if json_response.get('is_final', False):
                                print("Got final result")
                                break
                                
                    except json.JSONDecodeError:
                        # 忽略非JSON格式的响应
                        pass
                        
                except asyncio.TimeoutError:
                    timeout_count += 1
                    continue
                except websockets.exceptions.ConnectionClosed:
                    print("WebSocket connection closed")
                    break
            
            if not result_text:
                print("No recognition result received")
                return ""
            
            return result_text.strip()
            
    except Exception as e:
        print(f"FunASR offline recognition error: {type(e).__name__}")
        return "FunASR识别失败"


async def handle_funasr_response(funasr_websocket, 
                               client_websocket: WebSocket):
    """
    处理 FunASR 服务器的响应，并将结果转发给客户端
    """
    try:
        async for message in funasr_websocket:
            try:
                if funasr_websocket:
                    # FunASR 返回的数据可能是 JSON 或二进制
                    if isinstance(message, bytes):
                        message = message.decode('utf-8')
                    
                    data = json.loads(message)
                    print(f"FunASR response: {data}")
                    # 解析 FunASR 响应
                    if "text" in data:  # 普通识别结果
                        if data.get('mode', '') == "2pass-online":
                            await client_websocket.send_json({
                                "type": "transcription",
                                "text": data["text"],
                                "is_final": False
                            })
                        else:
                            await client_websocket.send_json({
                                "type": "transcription",
                                "text": data["text"],
                                "is_final": True
                            })
                    elif "mode" in data:  # 初始化响应
                        print(f"FunASR initialized: {data}")
                    else:
                        print(f"Unknown FunASR response: {data}")
                else:
                    # 如果 FunASR 连接关闭，发送错误消息，退出循环，结束任务
            
                    break
            except json.JSONDecodeError:
                print(f"FunASR sent non-JSON data: {message[:100]}...")
            except Exception as e:
                print(f"Error processing FunASR response: {type(e).__name__}")
                break

    except websockets.exceptions.ConnectionClosed:
        print("FunASR connection closed")
    except Exception as e:
        print(f"FunASR handler error: {type(e).__name__}")
    finally:
        await funasr_websocket.close()

class TTSConnectionManager:
    def __init__(self):
        self.main_connections: List[WebSocket] = []
        self.vrm_connections: List[WebSocket] = []
        self.overlay_connections: list[WebSocket] = []

    async def connect_main(self, websocket: WebSocket):
        await websocket.accept()
        self.main_connections.append(websocket)
        logging.info(f"Main interface connected. Total: {len(self.main_connections)}")

    async def connect_vrm(self, websocket: WebSocket):
        await websocket.accept()
        self.vrm_connections.append(websocket)
        logging.info(f"VRM interface connected. Total: {len(self.vrm_connections)}")

    def disconnect_main(self, websocket: WebSocket):
        if websocket in self.main_connections:
            self.main_connections.remove(websocket)

    def disconnect_vrm(self, websocket: WebSocket):
        if websocket in self.vrm_connections:
            self.vrm_connections.remove(websocket)

    async def broadcast_to_vrm(self, message: Union[str, bytes]):
        """核心：同时支持字符串 JSON 和二进制 Blob 透传"""
        if not self.vrm_connections:
            return
        disconnected = []
        for connection in self.vrm_connections:
            try:
                if isinstance(message, bytes):
                    await connection.send_bytes(message)
                else:
                    await connection.send_text(message)
            except:
                disconnected.append(connection)
        for conn in disconnected:
            self.disconnect_vrm(conn)

    async def send_to_main(self, message: str):
        if not self.main_connections:
            return
        disconnected = []
        for connection in self.main_connections:
            try:
                await connection.send_text(message)
            except:
                disconnected.append(connection)
        for conn in disconnected:
            self.disconnect_main(conn)

    async def connect_overlay(self, websocket: WebSocket):
        """字幕页专用连接"""
        await websocket.accept()
        self.overlay_connections.append(websocket)

    def disconnect_overlay(self, websocket: WebSocket):
        if websocket in self.overlay_connections:
            self.overlay_connections.remove(websocket)

    async def broadcast_to_vrm(self, message: Union[str, bytes]):
        """核心广播逻辑：区分发送内容"""
        # 1. 如果是二进制（音频流），只发给真正的 VRM 页面
        if isinstance(message, bytes):
            for conn in list(self.vrm_connections):
                try: await conn.send_bytes(message)
                except: self.disconnect_vrm(conn)
        
        # 2. 如果是字符串（指令/文字），发给 VRM 页面 和 字幕页面
        else:
            # 发给 VRM 窗口（同步表情、UI等）
            for conn in list(self.vrm_connections):
                try: await conn.send_text(message)
                except: self.disconnect_vrm(conn)
            
            # 发给字幕窗口（显示文字）
            for conn in list(self.overlay_connections):
                try: await conn.send_text(message)
                except: self.disconnect_overlay(conn)


tts_manager = TTSConnectionManager()

async def broadcast_to_vrm(self, message: Union[str, bytes]):
    if not self.vrm_connections:
        return
    disconnected = []
    for connection in self.vrm_connections:
        try:
            if isinstance(message, bytes):
                await connection.send_bytes(message)
            else:
                await connection.send_text(message)
        except:
            disconnected.append(connection)
    for conn in disconnected:
        self.disconnect_vrm(conn)

@app.websocket("/ws/tts")
async def tts_websocket_endpoint(websocket: WebSocket):
    await tts_manager.connect_main(websocket)
    try:
        while True:
            msg = await websocket.receive()
            if msg.get("type") == "websocket.disconnect":
                break
            # 透传所有数据，无论是 bytes 还是 text
            if "bytes" in msg:
                await tts_manager.broadcast_to_vrm(msg["bytes"])
            elif "text" in msg:
                await tts_manager.broadcast_to_vrm(msg["text"])
    except WebSocketDisconnect:
        pass
    except RuntimeError as exc:
        if not _is_expected_websocket_disconnect_error(exc):
            logging.error("WS error in TTS main: %s", exc)
    finally:
        tts_manager.disconnect_main(websocket)

@app.websocket("/ws/vrm")
async def vrm_websocket_endpoint(websocket: WebSocket):
    """VRM 窗口 WebSocket：接收主窗口发来的数据"""
    await tts_manager.connect_vrm(websocket)
    try:
        while True:
            msg = await websocket.receive()
            if msg.get("type") == "websocket.disconnect":
                break
            if "text" in msg:
                # 处理来自 VRM 的反馈（如 requestAudioData 或 animationComplete）
                data = json.loads(msg["text"])
                if data.get('type') == 'animationComplete':
                    await tts_manager.send_to_main(msg["text"])
            # VRM 窗口通常不主动给主窗口发二进制，所以这里暂不处理 bytes
    except WebSocketDisconnect:
        pass
    except RuntimeError as exc:
        if not _is_expected_websocket_disconnect_error(exc):
            logging.error("WS error in VRM: %s", exc)
    except Exception as e:
        logging.error(f"WS error in VRM: {e}")
    finally:
        tts_manager.disconnect_vrm(websocket)

@app.websocket("/ws/subtitles")
async def subtitles_websocket_endpoint(websocket: WebSocket):
    """字幕叠加层专用端点：不参与音频播放判断"""
    await tts_manager.connect_overlay(websocket)
    try:
        while True:
            msg = await websocket.receive()
            if msg.get("type") == "websocket.disconnect":
                break
    except WebSocketDisconnect:
        pass
    except RuntimeError as exc:
        if not _is_expected_websocket_disconnect_error(exc):
            logging.error("WS error in subtitles overlay: %s", exc)
    finally:
        tts_manager.disconnect_overlay(websocket)

@app.post("/tts")
async def text_to_speech(request: Request):
    """按当前 TTS 设置合成音频；桌面模式委托 Voice Worker，Server 模式保留原供应商实现。"""
    
    # 声明全局缓存和客户端
    global global_http_client, openai_tts_clients_cache, tetos_speakers_cache

    try:
        data = await request.json()
        text = data.get('text', '')
        if not text:
            return JSONResponse(status_code=400, content={"error": "Text is empty"})
        
        # 移动端专用：强制使用opus格式
        mobile_optimized = data.get('mobile_optimized', False)
        target_format = "opus" if mobile_optimized else data.get('format', 'mp3')
        
        new_voice = data.get('voice', 'default')
        tts_settings = data.get('ttsSettings', {})
        if not isinstance(tts_settings, dict):
            raise HTTPException(status_code=400, detail="TTS settings are invalid")
        voice_worker_client = VoiceWorkerClient.from_environment()
        if voice_worker_client.configured:
            audio, media_type = await voice_worker_client.synthesize({
                "text": text,
                "voice": new_voice,
                "index": data.get('index', 0),
                "mobileOptimized": mobile_optimized is True,
                "format": target_format,
                "settings": tts_settings,
            })
            return Response(
                content=audio,
                media_type=media_type,
                headers={
                    "Cache-Control": "no-store",
                    "X-Audio-Index": str(data.get('index', 0)),
                    "X-Audio-Format": target_format,
                },
            )
        import edge_tts
        import subprocess

        apply_voice_credentials_to_scope(
            tts_settings,
            "default",
            preserve_existing=True,
        )
        provider_document = apply_provider_credentials({"ttsSettings": tts_settings})
        tts_settings = provider_document["ttsSettings"]
        
        # 处理声音配置继承逻辑
        if new_voice in tts_settings.get('newtts', {}) and new_voice != 'default':
            voice_settings = tts_settings['newtts'][new_voice]
            apply_voice_credentials_to_scope(
                voice_settings,
                str(new_voice),
                preserve_existing=True,
            )
            parent_settings = tts_settings
            
            inherited_fields = ['api_key', 'base_url', 'model', 'selectedProvider', 'vendor']
            for field in inherited_fields:
                child_value = voice_settings.get(field, '')
                parent_value = parent_settings.get(field, '')
                if not child_value and parent_value:
                    voice_settings[field] = parent_value
            
            selected_provider_id = voice_settings.get('selectedProvider')
            if selected_provider_id and not voice_settings.get('api_key'):
                model_providers = parent_settings.get('modelProviders', [])
                for provider in model_providers:
                    if provider.get('id') == selected_provider_id:
                        voice_settings['api_key'] = provider.get('apiKey', '')
                        voice_settings['base_url'] = provider.get('url', '')
                        voice_settings['model'] = provider.get('modelId', '')
                        voice_settings['vendor'] = provider.get('vendor', '')
                        break
            tts_settings = voice_settings

        index = data.get('index', 0)
        tts_engine = tts_settings.get('engine', 'edgetts')
                
        print(f"TTS请求 - 引擎: {tts_engine}, 格式: {target_format}, 移动端优化: {mobile_optimized}")
                
        # ==========================================
        # 1. EdgeTTS 引擎
        # ==========================================
        if tts_engine == 'edgetts':
            edgettsLanguage = tts_settings.get('edgettsLanguage', 'zh-CN')
            edgettsVoice = tts_settings.get('edgettsVoice', 'XiaoyiNeural')
            rate = tts_settings.get('edgettsRate', 1.0)
            full_voice_name = f"{edgettsLanguage}-{edgettsVoice}"
            
            if mobile_optimized:
                rate = min(rate * 0.95, 1.1)
            
            rate_text = "+0%"
            if rate >= 1.0:
                rate_text = f"+{int((rate - 1.0) * 100)}%"
            elif rate < 1.0:
                rate_text = f"-{int((1.0 - rate) * 100)}%"
            
            async def generate_audio():
                communicate = edge_tts.Communicate(text, full_voice_name, rate=rate_text)
                if target_format == "opus":
                    audio_chunks = []
                    async for chunk in communicate.stream():
                        if chunk["type"] == "audio":
                            audio_chunks.append(chunk["data"])
                    
                    full_audio = b''.join(audio_chunks)
                    convert_result = await asyncio.to_thread(convert_to_opus_simple, full_audio)
                    opus_audio = convert_result[0] if isinstance(convert_result, tuple) else convert_result
                    
                    chunk_size = 4096
                    for i in range(0, len(opus_audio), chunk_size):
                        yield opus_audio[i:i + chunk_size]
                else:
                    async for chunk in communicate.stream():
                        if chunk["type"] == "audio":
                            yield chunk["data"]

            media_type = "audio/ogg" if target_format == "opus" else "audio/mpeg"
            filename = f"tts_{index}.opus" if target_format == "opus" else f"tts_{index}.mp3"
            
            return StreamingResponse(
                generate_audio(),
                media_type=media_type,
                headers={"Content-Disposition": f"inline; filename={filename}", "X-Audio-Index": str(index), "X-Audio-Format": target_format}
            )

        # ==========================================
        # 2. CustomTTS 引擎 (使用全局连接池)
        # ==========================================
        elif tts_engine == 'customTTS':
            key_text = tts_settings.get('customTTSKeyText', 'text')
            key_speaker = tts_settings.get('customTTSKeySpeaker', 'speaker')
            key_speed = tts_settings.get('customTTSKeySpeed', 'speed')
            speaker_value = tts_settings.get('customTTSspeaker', '')
            speed_value = tts_settings.get('customTTSspeed', 1.0)
            
            if mobile_optimized:
                speed_value = min(speed_value * 0.95, 1.2)

            params = {key_text: text, key_speaker: speaker_value, key_speed: speed_value}
            servers = [s for s in tts_settings.get('customTTSserver', 'http://127.0.0.1:9880').split('\n') if s.strip()]
            custom_tt_server = servers[index % len(servers)]
            custom_streaming = tts_settings.get('customStream', False)
            
            async def generate_audio():
                safe_url = sanitize_url(input_url=custom_tt_server, default_base="http://127.0.0.1:9880", endpoint="")
                try:
                    # 使用全局客户端，无需 async with httpx.AsyncClient()
                    async with global_http_client.stream("GET", safe_url, params=params) as response:
                        response.raise_for_status()
                        if custom_streaming:
                            async for chunk in response.aiter_bytes():
                                yield chunk
                        else:
                            audio_data = await response.aread()
                            if target_format == "opus":
                                convert_result = await asyncio.to_thread(convert_to_opus_simple, audio_data)
                                audio_data = convert_result[0] if isinstance(convert_result, tuple) else convert_result
                            
                            chunk_size = 4096
                            for i in range(0, len(audio_data), chunk_size):
                                yield audio_data[i:i + chunk_size]
                except Exception:
                    raise HTTPException(status_code=502, detail="Custom TTS 连接失败")

            media_type = "audio/ogg" if target_format == "opus" else "audio/wav"
            filename = f"tts_{index}.opus" if target_format == "opus" else f"tts_{index}.wav"
            return StreamingResponse(generate_audio(), media_type=media_type, headers={"Content-Disposition": f"inline; filename={filename}", "X-Audio-Index": str(index)})

        # ==========================================
        # 3. GSV 引擎 (使用全局连接池)
        # ==========================================
        elif tts_engine == 'GSV':
            audio_path = os.path.join(UPLOAD_FILES_DIR, tts_settings.get('gsvRefAudioPath', ''))
            if not os.path.exists(audio_path): audio_path = tts_settings.get('gsvRefAudioPath', '')

            gsv_params = {
                "text": text, "text_lang": tts_settings.get('gsvTextLang', 'zh'),
                "ref_audio_path": audio_path, "prompt_lang": tts_settings.get('gsvPromptLang', 'zh'),
                "prompt_text": tts_settings.get('gsvPromptText', ''), "speed_factor": tts_settings.get('gsvRate', 1.0),
                "sample_steps": tts_settings.get('gsvSample_steps', 4), "streaming_mode": True,
                "media_type": "ogg", "batch_size": 1, "seed": 42,
            }
            if mobile_optimized: gsv_params["speed_factor"] = min(gsv_params["speed_factor"] * 0.95, 1.1)
            
            servers = [s for s in tts_settings.get('gsvServer', 'http://127.0.0.1:9880').split('\n') if s.strip()]
            gsvServer = servers[index % len(servers)]
                
            async def generate_audio():
                safe_url = sanitize_url(input_url=gsvServer, default_base="http://127.0.0.1:9880", endpoint="/tts")
                try:
                    async with global_http_client.stream("POST", safe_url, json=gsv_params) as response:
                        response.raise_for_status()
                        async for chunk in response.aiter_bytes():
                            yield chunk
                except Exception:
                    raise HTTPException(status_code=502, detail="GSV服务请求失败")
            
            return StreamingResponse(generate_audio(), media_type="audio/ogg", headers={"Content-Disposition": f"inline; filename=tts_{index}.opus"})

        # ==========================================
        # 4. 火山引擎 (使用全局连接池)
        # ==========================================
        elif tts_engine == 'volcengine':
            volc_app_id = tts_settings.get('volcAppId', '')
            volc_access_key = tts_settings.get('volcAccessKey', '')
            volc_resource_id = tts_settings.get('volcResourceId', 'volc_tts_release') 
            volc_voice = tts_settings.get('volcVoice', 'zh_female_cancan_mars_bigtts')
            volc_rate = float(tts_settings.get('volcRate', 1.0))
            if mobile_optimized: volc_rate = min(volc_rate * 0.95, 1.2)
            
            url = "https://openspeech.bytedance.com/api/v3/tts/unidirectional"
            headers = {"X-Api-App-Id": volc_app_id, "X-Api-Access-Key": volc_access_key, "X-Api-Resource-Id": volc_resource_id, "Content-Type": "application/json"}
            payload = {
                "user": {"uid": "123456"},
                "req_params": {
                    "text": text, "speaker": volc_voice, "speed_ratio": volc_rate, 
                    "audio_params": {"format": "mp3", "sample_rate": 24000},
                    "additions": "{\"disable_markdown_filter\":true}" 
                }
            }

            async def generate_audio():
                try:
                    async with global_http_client.stream("POST", url, headers=headers, json=payload) as response:
                        response.raise_for_status()
                        collected_audio = bytearray()
                        async for line in response.aiter_lines():
                            if not line: continue
                            data = json.loads(line)
                            if data.get("code", 0) != 0 and data.get("code", 0) != 20000000: continue
                            if "data" in data and data["data"]:
                                chunk_audio = base64.b64decode(data["data"])
                                if target_format == "opus": collected_audio.extend(chunk_audio)
                                else: yield chunk_audio
                        
                        if target_format == "opus" and collected_audio:
                            res = await asyncio.to_thread(convert_to_opus_simple, bytes(collected_audio))
                            final = res[0] if isinstance(res, tuple) else res
                            for i in range(0, len(final), 4096): yield final[i:i + 4096]
                except Exception:
                    raise HTTPException(status_code=502, detail="火山语音服务请求失败")

            media_type = "audio/ogg" if target_format == "opus" else "audio/mpeg"
            return StreamingResponse(generate_audio(), media_type=media_type)

        # ==========================================
        # 5. OpenAI TTS (使用实例缓存)
        # ==========================================
        elif tts_engine == 'openai':
            api_key = tts_settings.get('api_key', '')
            base_url = tts_settings.get('base_url', 'https://api.openai.com/v1')
            if not api_key: raise HTTPException(status_code=400, detail="API密钥未配置")
            
            # 获取或创建缓存的客户端
            cache_key = (api_key, base_url)
            if cache_key not in openai_tts_clients_cache:
                openai_tts_clients_cache[cache_key] = AsyncOpenAI(api_key=api_key, base_url=base_url)
            client = openai_tts_clients_cache[cache_key]

            speed = float(tts_settings.get('openaiSpeed', 1.0))
            if mobile_optimized: speed = min(speed * 0.95, 1.2)
            
            async def generate_audio():
                response_format = target_format if target_format in ['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm'] else 'mp3'
                params = {'model': tts_settings.get('model', 'tts-1'), 'input': text, 'speed': max(0.25, min(4.0, speed)), 'response_format': response_format}
                
                ref_audio = tts_settings.get('gsvRefAudioPath', '')
                if ref_audio:
                    audio_file_path = os.path.join(UPLOAD_FILES_DIR, ref_audio)
                    audio_base64 = base64.b64encode(open(audio_file_path, "rb").read()).decode('utf-8')
                    params['extra_body'] = {"references": [{"text": tts_settings.get('gsvPromptText', ''), "audio": f"data:audio/{Path(audio_file_path).suffix[1:]};base64,{audio_base64}"}]}
                else:
                    params['voice'] = tts_settings.get('openaiVoice', 'alloy')

                if tts_settings.get('openaiStream', False):
                    async with client.audio.speech.with_streaming_response.create(**params) as response:
                        async for chunk in response.iter_bytes(chunk_size=4096): yield chunk
                else:
                    response = await client.audio.speech.create(**params)
                    content = await response.aread()
                    for i in range(0, len(content), 4096): yield content[i:i + 4096]

            media_map = {"opus": "audio/ogg", "wav": "audio/wav", "aac": "audio/aac", "flac": "audio/flac"}
            return StreamingResponse(generate_audio(), media_type=media_map.get(target_format, "audio/mpeg"))

        # ==========================================
        # 6. System TTS (系统原生)
        # ==========================================
        elif tts_engine == 'systemtts':
            system_voice_name = tts_settings.get('systemVoiceName', None)
            system_rate = int(tts_settings.get('systemRate', 200))
            if mobile_optimized: system_rate = int(system_rate * 0.95)
            
            def sync_generate_wav(input_text, voice_name, rate, req_index):
                temp_filename = os.path.join(TOOL_TEMP_DIR, f"temp_tts_{req_index}_{uuid.uuid4().hex[:8]}.wav")
                wav_data = b""
                try:
                    if platform.system() == 'Darwin':
                        cmd = ['say', '-o', temp_filename, '--data-format=LEI16@22050', input_text]
                        if voice_name: cmd.extend(['-v', voice_name])
                        if rate: cmd.extend(['-r', str(rate)])
                        subprocess.run(cmd, check=True)
                    else:
                        import pyttsx3
                        engine = pyttsx3.init()
                        engine.setProperty('rate', rate)
                        if voice_name:
                            for v in engine.getProperty('voices'):
                                if voice_name.lower() in v.name.lower() or voice_name == v.id:
                                    engine.setProperty('voice', v.id); break
                        engine.save_to_file(input_text, temp_filename)
                        engine.runAndWait()
                    if os.path.exists(temp_filename): wav_data = open(temp_filename, 'rb').read()
                finally:
                    if os.path.exists(temp_filename): os.remove(temp_filename)
                return wav_data

            async def generate_audio():
                wav_content = await asyncio.to_thread(sync_generate_wav, text, system_voice_name, system_rate, index)
                final = wav_content
                if target_format == "opus":
                    res = await asyncio.to_thread(convert_to_opus_simple, wav_content)
                    final = res[0] if isinstance(res, tuple) else res
                for i in range(0, len(final), 4096): yield final[i:i + 4096]
            
            media_type = "audio/ogg" if target_format == "opus" else "audio/wav"
            return StreamingResponse(generate_audio(), media_type=media_type)

        # ==========================================
        # 7. Tetos SDK (Azure, 百度, 谷歌, Fish, etc. - 使用实例缓存)
        # ==========================================
        elif tts_engine in ['azure', 'baidu', 'minimax', 'xunfei', 'fish', 'google']:
            selected_voice = tts_settings.get(f'{tts_engine}Voice', '') or None
            
            # 根据引擎生成缓存Key
            if tts_engine == 'azure': cache_key = (tts_engine, tts_settings.get('azureSpeechKey'), tts_settings.get('azureRegion'), selected_voice)
            elif tts_engine == 'baidu': cache_key = (tts_engine, tts_settings.get('baiduApiKey'), tts_settings.get('baiduSecretKey'), selected_voice)
            elif tts_engine == 'minimax': cache_key = (tts_engine, tts_settings.get('minimaxApiKey'), tts_settings.get('minimaxGroupId'), selected_voice)
            elif tts_engine == 'xunfei': cache_key = (tts_engine, tts_settings.get('xunfeiAppId'), tts_settings.get('xunfeiApiKey'), tts_settings.get('xunfeiApiSecret'), selected_voice)
            elif tts_engine == 'fish': cache_key = (tts_engine, tts_settings.get('fishApiKey'), selected_voice)
            elif tts_engine == 'google': cache_key = (tts_engine, hash(tts_settings.get('googleServiceAccount', '')), selected_voice)
            else: cache_key = None

            temp_filename = os.path.join(TOOL_TEMP_DIR, f"temp_tetos_{index}_{uuid.uuid4().hex[:8]}.mp3")

            def run_tetos_sync():
                if cache_key in tetos_speakers_cache:
                    speaker = tetos_speakers_cache[cache_key]
                else:
                    if tts_engine == 'azure':
                        from tetos.azure import AzureSpeaker
                        speaker = AzureSpeaker(speech_key=cache_key[1], speech_region=cache_key[2], voice=selected_voice)
                    elif tts_engine == 'baidu':
                        from tetos.baidu import BaiduSpeaker
                        speaker = BaiduSpeaker(api_key=cache_key[1], secret_key=cache_key[2], voice=selected_voice)
                    elif tts_engine == 'minimax':
                        from tetos.minimax import MinimaxSpeaker
                        speaker = MinimaxSpeaker(api_key=cache_key[1], group_id=cache_key[2], voice=selected_voice)
                    elif tts_engine == 'xunfei':
                        from tetos.xunfei import XunfeiSpeaker
                        speaker = XunfeiSpeaker(app_id=cache_key[1], api_key=cache_key[2], api_secret=cache_key[3], voice=selected_voice)
                    elif tts_engine == 'fish':
                        from tetos.fish import FishSpeaker
                        speaker = FishSpeaker(api_key=cache_key[1], voice=selected_voice)
                    elif tts_engine == 'google':
                        from tetos.google import GoogleSpeaker
                        sa_json = tts_settings.get('googleServiceAccount', '')
                        if sa_json:
                            import tempfile
                            with tempfile.NamedTemporaryFile(mode='w+', suffix='.json', delete=False) as tmp:
                                tmp.write(sa_json); os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = tmp.name
                        speaker = GoogleSpeaker(voice=selected_voice)
                    tetos_speakers_cache[cache_key] = speaker
                speaker.say(text, temp_filename)

            await asyncio.to_thread(run_tetos_sync)
            
            async def generate_from_file():
                try:
                    if os.path.exists(temp_filename):
                        data = open(temp_filename, "rb").read()
                        if target_format == "opus":
                            res = await asyncio.to_thread(convert_to_opus_simple, data)
                            data = res[0] if isinstance(res, tuple) else res
                        for i in range(0, len(data), 4096): yield data[i:i + 4096]
                finally:
                    if os.path.exists(temp_filename): os.remove(temp_filename)

            media_type = "audio/ogg" if target_format == "opus" else "audio/mpeg"
            return StreamingResponse(generate_from_file(), media_type=media_type)

        # ==========================================
        # 8. ElevenLabs TTS (最终修复版)
        # ==========================================
        elif tts_engine == 'elevenlabs':
            from elevenlabs.client import ElevenLabs as ElevenLabsClient
            
            api_key = tts_settings.get('elevenLabsApiKey', '')
            voice_id = tts_settings.get('elevenLabsVoice', '')
            model_id = tts_settings.get('elevenLabsModel', 'eleven_multilingual_v2')
            rate = float(tts_settings.get('elevenLabsRate', 1.0))
            
            if not api_key:
                raise HTTPException(status_code=400, detail="ElevenLabs API Key 未配置")
            if not voice_id:
                raise HTTPException(status_code=400, detail="ElevenLabs Voice ID 未配置")
            
            if mobile_optimized:
                rate = min(rate * 0.95, 1.2)
            
            client = ElevenLabsClient(api_key=api_key)
            
            # 1. 【修复关键点】提前建立连接和请求！如果 Voice ID 错误，这里会立即抛出异常
            # 此时因为还没有进入 StreamingResponse，抛出 HTTPException 状态码修改是完全合法的
            try:
                audio_stream = await asyncio.to_thread(
                    client.text_to_speech.convert,
                    text=text,
                    voice_id=voice_id,
                    model_id=model_id or 'eleven_multilingual_v2',
                    output_format='mp3_44100_128'
                )
            except Exception as e:
                error_msg = str(e)
                if "API key" in error_msg.lower() or "authentication" in error_msg.lower():
                    raise HTTPException(status_code=401, detail="ElevenLabs API Key 无效")
                elif "voice" in error_msg.lower() or "not found" in error_msg.lower():
                    raise HTTPException(status_code=400, detail=f"Voice ID 无效: {voice_id}")
                elif "model" in error_msg.lower():
                    raise HTTPException(status_code=400, detail=f"Model ID 无效: {model_id}")
                elif "credit" in error_msg.lower() or "quota" in error_msg.lower() or "characters" in error_msg.lower():
                    raise HTTPException(status_code=429, detail="ElevenLabs 额度不足")
                else:
                    raise HTTPException(status_code=502, detail="ElevenLabs 服务请求失败")

            async def generate_audio():
                # 2. 【性能修复】利用线程池安全地拉取同步生成器的数据，避免阻塞并发循环
                def get_next_chunk():
                    try:
                        return next(audio_stream)
                    except StopIteration:
                        return None

                while True:
                    try:
                        chunk = await asyncio.to_thread(get_next_chunk)
                        if chunk is None:
                            break
                        if chunk:
                            yield chunk
                    except Exception as e:
                        # 注意：在这里如果流传输中断了，不能再 raise HTTPException 了，只需中断流即可
                        print(f"ElevenLabs 传输中断: {type(e).__name__}")
                        break

            # 移动端：转换为 opus（需要先收集所有 chunk）
            if target_format == "opus":
                async def generate_opus():
                    collected = bytearray()
                    async for chunk in generate_audio():
                        collected.extend(chunk)
                    if collected:
                        res = await asyncio.to_thread(convert_to_opus_simple, bytes(collected))
                        final = res[0] if isinstance(res, tuple) else res
                        for i in range(0, len(final), 4096):
                            yield final[i:i + 4096]
                return StreamingResponse(
                    generate_opus(),
                    media_type="audio/ogg",
                    headers={
                        "Content-Disposition": f"inline; filename=tts_{index}.opus",
                        "X-Audio-Index": str(index),
                        "X-Audio-Format": "opus"
                    }
                )
            else:
                # MP3 直接流式返回 generator
                return StreamingResponse(
                    generate_audio(),
                    media_type="audio/mpeg",
                    headers={
                        "Content-Disposition": f"inline; filename=tts_{index}.mp3",
                        "X-Audio-Index": str(index),
                        "X-Audio-Format": "mp3"
                    }
                )
            
        raise HTTPException(status_code=400, detail="不支持的TTS引擎")
    
    except VoiceWorkerClientError as error:
        return JSONResponse(
            status_code=503 if error.retryable else 422,
            content={
                "error": "语音合成服务请求失败",
                "code": error.code,
                "retryable": error.retryable,
            },
        )
    except HTTPException as error:
        safe_messages = {
            400: "语音请求无效或凭据未配置",
            401: "语音服务凭据无效",
            429: "语音服务额度不足",
        }
        return JSONResponse(
            status_code=error.status_code,
            content={"error": safe_messages.get(error.status_code, "语音服务请求失败")},
        )
    except Exception as error:
        print(f"TTS request failed: {type(error).__name__}")
        return JSONResponse(status_code=500, content={"error": "语音服务请求失败"})

@app.post("/tts/tetos/list_voices")
async def list_tetos_voices(request: Request):
    """
    通过 tetos 获取音色列表
    流程: 接收配置 -> 实例化 Speaker -> 调用 .list_voices()
    """
    provider = ""
    try:
        data = await request.json()
        provider = data.get('provider', '').lower()
        config = data.get('config', {})  # 用户填写的鉴权信息
        credential_scope = str(data.get('credentialScope', 'default') or 'default')
        if not isinstance(config, dict):
            return JSONResponse(status_code=400, content={"error": "配置格式无效"})
        config = build_tetos_voice_config(provider, config, credential_scope)

        if not provider:
            return JSONResponse(status_code=400, content={"error": "缺少 'provider' 参数"})

        voice_worker_client = VoiceWorkerClient.from_environment()
        if voice_worker_client.configured:
            worker_settings = dict(config)
            if provider == "fish" and config.get("api_key"):
                worker_settings["fishApiKey"] = config["api_key"]
            voice_list = await voice_worker_client.list_provider_voices(
                provider,
                credential_scope,
                worker_settings,
            )
            return JSONResponse(content={
                "status": "success",
                "provider": provider,
                "data": voice_list,
            })

        # 定义同步执行函数（在线程池运行，避免阻塞）
        def _sync_fetch_voices():
            voices = []

            # ---------------------------
            # Azure TTS
            # ---------------------------
            if provider == 'azure':
                from tetos.azure import AzureSpeaker
                # 实例化
                speaker = AzureSpeaker(
                    speech_key=config.get('speech_key') or config.get('api_key'),
                    speech_region=config.get('speech_region') or config.get('region')
                )
                # 获取列表
                voices = speaker.list_voices()

            # ---------------------------
            # Baidu TTS
            # ---------------------------
            elif provider == 'baidu':
                from tetos.baidu import BaiduSpeaker
                speaker = BaiduSpeaker(
                    api_key=config.get('api_key'),
                    secret_key=config.get('secret_key')
                )
                voices = speaker.list_voices()

            # ---------------------------
            # Minimax TTS
            # ---------------------------
            elif provider == 'minimax':
                from tetos.minimax import MinimaxSpeaker
                speaker = MinimaxSpeaker(
                    api_key=config.get('api_key'),
                    group_id=config.get('group_id')
                )
                voices = speaker.list_voices()

            # ---------------------------
            # 讯飞 (Xunfei)
            # ---------------------------
            elif provider == 'xunfei':
                from tetos.xunfei import XunfeiSpeaker
                speaker = XunfeiSpeaker(
                    app_id=config.get('app_id'),
                    api_key=config.get('api_key'),
                    api_secret=config.get('api_secret')
                )
                voices = speaker.list_voices()

            elif provider == 'fish':
                api_key = config.get('api_key')
                if not api_key:
                    raise ValueError("Fish Audio 需要配置 API Key")

                # 请求 Fish Audio 官方 API
                # page_size 设置为 30 以获取更多热门音色
                url = "https://api.fish.audio/model?page_size=30&page_number=1&sort_by=score"
                headers = {
                    "Authorization": f"Bearer {api_key}",
                    "User-Agent": "Mozilla/5.0" 
                }
                
                response = requests.get(url, headers=headers, timeout=60)
                response.raise_for_status() # 检查 HTTP 错误
                res_json = response.json()
                
                # 解析返回的数据结构
                items = res_json.get("items", [])
                
                for item in items:
                    # 将 Fish Audio 的数据结构转换为前端通用的结构
                    # 前端 getVoiceValue 优先找 id
                    # 前端 getVoiceLabel 优先找 DisplayName 或 name
                    # 前端 getVoiceDesc 优先找 Locale
                    voices.append({
                        "id": item.get("_id"),            # 关键：这是实际的 voice ID
                        "name": item.get("title"),        # 显示名称
                        "DisplayName": item.get("title"), # 兼容字段
                        "Locale": item.get("languages", ["Unknown"])[0] if item.get("languages") else "" # 语言标签
                    })


            # ---------------------------
            # Google TTS
            # ---------------------------
            elif provider == 'google':
                from tetos.google import GoogleSpeaker
                # Google 特殊处理：tetos 依赖 GOOGLE_APPLICATION_CREDENTIALS 环境变量
                # 如果 config 传了 service_account 的 json 对象，我们需要临时写入文件
                
                service_account_data = config.get('service_account')
                temp_path = None
                
                try:
                    if service_account_data:
                        # 创建临时文件
                        with tempfile.NamedTemporaryFile(mode='w+', suffix='.json', delete=False) as tmp:
                            if isinstance(service_account_data, dict):
                                json.dump(service_account_data, tmp)
                            else:
                                tmp.write(str(service_account_data))
                            temp_path = tmp.name
                        
                        # 设置环境变量
                        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = temp_path
                    
                    # GoogleSpeaker 初始化通常不需要参数，它自己去读环境变量
                    speaker = GoogleSpeaker()
                    voices = speaker.list_voices()
                    
                finally:
                    # 清理工作
                    if temp_path:
                        if os.path.exists(temp_path):
                            os.remove(temp_path)
                        # 如果是我们设置的环境变量，用完删除，以免影响其他请求
                        if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS") == temp_path:
                            del os.environ["GOOGLE_APPLICATION_CREDENTIALS"]

            else:
                pass

            return voices

        # 使用 asyncio.to_thread 放入线程池执行，防止阻塞 FastAPI 主循环
        voice_list = await asyncio.to_thread(_sync_fetch_voices)

        return JSONResponse(content={
            "status": "success",
            "provider": provider,
            "data": voice_list
        })

    except VoiceWorkerClientError as error:
        return JSONResponse(status_code=503 if error.retryable else 422, content={
            "status": "error",
            "message": "语音目录服务请求失败",
            "code": error.code,
        })
    except Exception as error:
        print(f"获取 {provider} 音色列表失败: {type(error).__name__}")
        # 捕获鉴权失败、网络错误等
        return JSONResponse(status_code=500, content={
            "status": "error", 
            "message": "语音服务请求失败",
            "detail": f"获取 {provider} 音色列表失败，请检查密钥配置是否正确。"
        })

@app.get("/system/voices")
async def get_system_voices():
    """
    获取系统可用的 pyttsx3 音色列表。
    优化版：
    1. 优先展示 Siri/Premium 高质量音色
    2. 自动从 ID 中补全缺失的语言标识
    3. 为高质量音色添加 [Siri] 前缀
    """
    voice_worker_client = VoiceWorkerClient.from_environment()
    if voice_worker_client.configured:
        try:
            available_voices = await voice_worker_client.list_system_voices()
            return {
                "count": len(available_voices),
                "voices": available_voices,
            }
        except VoiceWorkerClientError as error:
            return JSONResponse(
                status_code=503 if error.retryable else 422,
                content={
                    "error": "系统语音目录请求失败",
                    "code": error.code,
                },
            )

    import pyttsx3
    import sys
    import re

    def fetch_voices_sync():
        try:
            # 1. 仍然保留怪诞音色黑名单 (这些声音确实没法用)
            mac_novelty_voices = {
                'Albert', 'Bad News', 'Bahh', 'Bells', 'Boing', 'Bubbles', 'Cellos',
                'Deranged', 'Good News', 'Hysterical', 'Pipe Organ', 'Trinoids', 
                'Whisper', 'Zarvox', 'Organ'
            }

            engine = pyttsx3.init()
            voices = engine.getProperty('voices')
            
            processed_voices = []

            for v in voices:
                voice_name = v.name
                voice_id = str(v.id) # 确保是字符串
                lower_id = voice_id.lower()

                # --- 过滤逻辑 ---
                if sys.platform == 'darwin':
                    if voice_name in mac_novelty_voices:
                        continue
                    
                    # 【重要修改】不要再过滤 'siri' 了！
                    # 我们只过滤那些完全无法使用的（通常 id 极其简短或是无效引用）
                    # 但保留包含 'siri', 'premium', 'compact' 的 ID

                # --- 语言解析逻辑 (增强版) ---
                lang = "Unknown"
                
                # 优先尝试从 pyttsx3 属性获取
                if hasattr(v, 'languages') and v.languages:
                    raw_lang = v.languages[0] if isinstance(v.languages, list) else v.languages
                    if isinstance(raw_lang, bytes):
                        try:
                            lang = raw_lang.decode('utf-8', errors='ignore').replace('\x05', '')
                        except:
                            lang = str(raw_lang)
                    else:
                        lang = str(raw_lang)

                # 【补全逻辑】如果属性里读不到语言，尝试从 ID 里正则提取
                # macOS 的 ID 通常长这样: com.apple.speech.synthesis.voice.zh_CN.ting-ting.premium
                if lang == "Unknown" or lang == "":
                    # 匹配 .zh_CN. 或 .en_US. 这种模式
                    match = re.search(r'\.([a-z]{2}[_-][A-Z]{2})\.', voice_id)
                    if match:
                        lang = match.group(1).replace('_', '-') # 统一格式为 zh-CN

                # --- 判断是否为 Siri/高质量音色 ---
                # 关键词：siri, premium (高品质), compact (压缩的高品质，通常是系统默认下载的)
                is_high_quality = False
                quality_tag = ""
                
                if any(k in lower_id for k in ['siri', 'premium', 'compact']):
                    is_high_quality = True
                    quality_tag = "[Siri/Premium] "
                
                # 有些系统直接在名字里就叫 "Siri Voice 1"
                if "siri" in voice_name.lower():
                    is_high_quality = True
                    quality_tag = "[Siri] "

                # 组装数据
                processed_voices.append({
                    "id": voice_id,
                    "name": f"{quality_tag}{voice_name}", # 在名字前加上标识，方便前端展示
                    "original_name": voice_name,
                    "lang": lang,
                    "gender": getattr(v, 'gender', 'Unknown'),
                    "is_siri": is_high_quality # 用于排序的标记
                })

            # --- 排序逻辑 ---
            # Python 的 sort 是稳定的。
            # key 解释: (not x['is_siri']) -> True(1) 排后面, False(0) 排前面
            # 所以 is_siri=True 的会排在最前面
            processed_voices.sort(key=lambda x: (not x['is_siri'], x['lang'], x['name']))

            return processed_voices
            
        except ImportError:
            print("错误: 未找到 pyttsx3 驱动")
            return []
        except Exception as e:
            print(f"获取系统音色错误: {str(e)}")
            return []

    try:
        available_voices = await asyncio.to_thread(fetch_voices_sync)
        return {
            "count": len(available_voices),
            "voices": available_voices
        }
    except Exception as e:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=500, content={"error": str(e)})


# 添加状态存储
mcp_status = {}
@app.post("/create_mcp")
async def create_mcp_endpoint(request: Request, background_tasks: BackgroundTasks):
    data = await request.json()
    mcp_id = data.get("mcpId")
    
    if not mcp_id:
        raise HTTPException(status_code=400, detail="Missing mcpId")
    
    # 将任务添加到后台队列
    background_tasks.add_task(process_mcp, mcp_id)
    
    return {"success": True, "message": "MCP服务器初始化已开始"}

@app.get("/mcp_status/{mcp_id}")
async def get_mcp_status(mcp_id: str):
    global mcp_client_list, mcp_status
    status = mcp_status.get(mcp_id, "not_found")
    if status == "ready":
        # 保证 _tools 里都是可序列化的 dict / list / 基本类型
        tools = await mcp_client_list[mcp_id].get_openai_functions(disable_tools=[])
        tools = json.dumps(mcp_client_list[mcp_id]._tools_list)
        return {"mcp_id": mcp_id, "status": status, "tools": tools}
    return {"mcp_id": mcp_id, "status": status, "tools": []}

async def process_mcp(mcp_id: str):
    """
    初始化单个 MCP 服务器，带失败回调同步，无需 sleep。
    """
    global mcp_client_list, mcp_status

    # 1. 同步原语：事件 + 失败原因
    init_done = asyncio.Event()
    fail_reason: str | None = None

    async def on_failure(error_message: str):
        nonlocal fail_reason
        # 仅第一次生效
        if fail_reason is not None:
            return
        fail_reason = "connection_failed"
        mcp_status[mcp_id] = "failed"

        # 容错：只有客户端已创建才标记 disabled
        if mcp_id in mcp_client_list:
            mcp_client_list[mcp_id].disabled = True
            await mcp_client_list[mcp_id].close()
            print(f"关闭MCP服务器: {mcp_id}")

        init_done.set()          # 唤醒主协程

    # 2. 开始初始化
    mcp_status[mcp_id] = "initializing"
    try:
        cur_settings = await load_settings()
        server_config = cur_settings["mcpServers"][mcp_id]

        mcp_client_list[mcp_id] = _create_server_mcp_client()
        init_task = asyncio.create_task(
            mcp_client_list[mcp_id].initialize(
                mcp_id,
                server_config,
                on_failure_callback=on_failure
            )
        )
        # 2.1 先等初始化本身（最多 6 秒）
        await asyncio.wait_for(init_task, timeout=6)

        # 2.2 再等看 on_failure 会不会被触发（最多 5 秒）
        try:
            await asyncio.wait_for(init_done.wait(), timeout=5)
        except asyncio.TimeoutError:
            # 5 秒内没收到失败回调，认为成功
            pass

        # 3. 最终状态判定
        if fail_reason:
            # 回调里已经关过 client，这里只需保证状态一致
            mcp_client_list[mcp_id].disabled = True
            return
        tool = []
        retry = 0 
        while tool == [] and retry < 10:
            try:
                tool = await mcp_client_list[mcp_id].get_openai_functions(disable_tools=[])
            except Exception as e:
                print(f"获取MCP工具失败: {type(e).__name__}")
            finally:
                retry += 1
                await asyncio.sleep(0.5)
        mcp_status[mcp_id] = "ready"
        mcp_client_list[mcp_id].disabled = False

    except Exception as e:
        # 任何异常（超时、崩溃）都走这里
        mcp_status[mcp_id] = "failed"
        print(f"MCP初始化失败: {type(e).__name__}")
        if mcp_id in mcp_client_list:
            mcp_client_list[mcp_id].disabled = True
            await mcp_client_list[mcp_id].close()

    finally:
        # 如果任务还活着，保险起见取消掉
        if "init_task" in locals() and not init_task.done():
            init_task.cancel()
            try:
                await init_task
            except asyncio.CancelledError:
                pass

@app.delete("/remove_mcp")
async def remove_mcp_server(request: Request):
    global settings, mcp_client_list
    try:
        data = await request.json()
        server_name = data.get("serverName", "")

        if not server_name:
            raise HTTPException(status_code=400, detail="No server names provided")

        # 移除指定的MCP服务器
        current_settings = await load_settings()
        if server_name in current_settings['mcpServers']:
            del current_settings['mcpServers'][server_name]
            await save_settings(current_settings)
            settings = current_settings

            # 从mcp_client_list中移除
            if server_name in mcp_client_list:
                mcp_client_list[server_name].disabled = True
                await mcp_client_list[server_name].close()
                del mcp_client_list[server_name]
                print(f"关闭MCP服务器: {server_name}")

            return JSONResponse({"success": True, "removed": server_name})
        else:
            raise HTTPException(status_code=404, detail="Server not found")
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON format")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"移除MCP服务器失败: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="MCP server removal failed")

@app.delete("/remove_memory")
async def remove_memory_endpoint(request: Request):
    data = await request.json()
    memory_id = data.get("memoryId")
    if memory_id:
        try:
            # 删除MEMORY_CACHE_DIR目录下的memory_id文件夹
            memory_dir = os.path.join(MEMORY_CACHE_DIR, memory_id)
            shutil.rmtree(memory_dir)
            return JSONResponse({"success": True, "message": "Memory removed"})
        except Exception as e:
            return JSONResponse({"success": False, "message": str(e)})
    else:
        return JSONResponse({"success": False, "message": "No memoryId provided"})

@app.delete("/remove_agent")
async def remove_agent_endpoint(request: Request):
    data = await request.json()
    agent_id = data.get("agentId")
    if agent_id:
        try:
            # 删除AGENT_CACHE_DIR目录下的agent_id文件夹
            agent_dir = os.path.join(AGENT_DIR, f"{agent_id}.json")
            shutil.rmtree(agent_dir)
            return JSONResponse({"success": True, "message": "Agent removed"})
        except Exception as e:
            return JSONResponse({"success": False, "message": str(e)})
    else:
        return JSONResponse({"success": False, "message": "No agentId provided"})

@app.post("/a2a")
async def initialize_a2a(request: Request):
    """探测 Browser/Server A2A 节点；输入请求中的受限 URL，返回公开 Agent Card，失败时返回固定错误。"""

    data = await request.json()
    try:
        return JSONResponse(await inspect_a2a_agent(data.get("url")))
    except A2AClientError:
        return JSONResponse(
            status_code=500,
            content={"error": "A2A Agent Card inspection failed."},
        )

# ═══════════════════════════════════════════════════════
# OpenXnet NeuroSymbol v1.0 — 神经符号认知 API
# ApplyLogicRules(Q, K, z₁, z₂, ..., zᵢ)
# ═══════════════════════════════════════════════════════

@app.get("/v1/neuro/symbols")
async def neuro_list_symbols(operator: str = None, entity: str = None, limit: int = 100):
    """列出所有神经符号 (支持按算子/实体过滤)"""
    global symbol_store
    if not symbol_store:
        return JSONResponse(status_code=503, content={"error": "NeuroSymbol not initialized"})
    symbols = symbol_store.all()
    if operator:
        symbols = [s for s in symbols if s.operator == operator]
    if entity:
        entity_lower = entity.lower()
        symbols = [s for s in symbols if any(e.lower() == entity_lower for e in s.K.entities)]
    symbols.sort(key=lambda s: s.createdAt, reverse=True)
    return JSONResponse(content={
        "symbols": [s.to_dict() for s in symbols[:limit]],
        "total": len(symbols),
    })

@app.get("/v1/neuro/symbols/{symbol_id}")
async def neuro_get_symbol(symbol_id: str):
    """获取单个神经符号详情"""
    global symbol_store
    if not symbol_store:
        return JSONResponse(status_code=503, content={"error": "NeuroSymbol not initialized"})
    sym = symbol_store.get(symbol_id)
    if not sym:
        return JSONResponse(status_code=404, content={"error": f"Symbol {symbol_id} not found"})
    return JSONResponse(content=sym.to_dict())

@app.post("/v1/neuro/symbols")
async def neuro_create_symbol(request: Request):
    """手动创建新的神经符号"""
    global symbol_store
    if not symbol_store:
        return JSONResponse(status_code=503, content={"error": "NeuroSymbol not initialized"})
    body = await request.json()
    label = body.get("label", "")
    if not label:
        return JSONResponse(status_code=400, content={"error": "'label' is required"})
    symbol = SymbolCrystallizer.crystallize(
        label=label,
        user_input=body.get("userInput", ""),
        assistant_output=body.get("assistantOutput", ""),
        tools_used=body.get("toolsUsed", []),
        success=body.get("success", True),
    )
    # Override operator if specified
    if body.get("operator") and body["operator"] in VALID_OPERATORS:
        symbol.operator = body["operator"]
    # Override entities if specified
    if body.get("entities"):
        symbol.K.entities = body["entities"]
    symbol_store.store(symbol)
    return JSONResponse(content={"status": "created", "symbol": symbol.to_dict()})

@app.delete("/v1/neuro/symbols/{symbol_id}")
async def neuro_delete_symbol(symbol_id: str):
    """删除神经符号"""
    global symbol_store
    if not symbol_store:
        return JSONResponse(status_code=503, content={"error": "NeuroSymbol not initialized"})
    existed = symbol_store.remove(symbol_id)
    if not existed:
        return JSONResponse(status_code=404, content={"error": f"Symbol {symbol_id} not found"})
    return JSONResponse(content={"status": "deleted", "id": symbol_id})

@app.post("/v1/neuro/match")
async def neuro_match(request: Request):
    """匹配相关神经符号 — Brain Loop 核心"""
    global symbol_store
    if not symbol_store:
        return JSONResponse(status_code=503, content={"error": "NeuroSymbol not initialized"})
    body = await request.json()
    text = body.get("text", "")
    entities = body.get("entities", [])
    operator = body.get("operator", None)
    top_k = body.get("top_k", body.get("topK", 5))
    matches = symbol_store.match(text=text, entities=entities, operator=operator, top_k=top_k)
    context = symbol_store.format_for_context(matches)
    return JSONResponse(content={
        "matches": [{"symbol": m["symbol"].to_dict(), "score": m["score"], "matchType": m["matchType"]} for m in matches],
        "contextBlock": context,
        "count": len(matches),
        "totalSymbols": symbol_store.get_stats()["totalSymbols"],
    })

@app.get("/v1/neuro/stats")
async def neuro_stats():
    """神经符号库统计"""
    global symbol_store
    if not symbol_store:
        return JSONResponse(status_code=503, content={"error": "NeuroSymbol not initialized"})
    return JSONResponse(content=symbol_store.get_stats())

@app.get("/v1/neuro/graph")
async def neuro_graph():
    """获取知识图谱数据 (nodes + edges) 用于 D3.js 渲染"""
    global symbol_store
    if not symbol_store:
        return JSONResponse(status_code=503, content={"error": "NeuroSymbol not initialized"})
    return JSONResponse(content=symbol_store.get_graph())

@app.post("/v1/neuro/crystallize")
async def neuro_crystallize(request: Request):
    """从对话中结晶一个神经符号 — Brain Loop post-neural 步骤"""
    global symbol_store
    if not symbol_store:
        return JSONResponse(status_code=503, content={"error": "NeuroSymbol not initialized"})
    body = await request.json()
    label = body.get("label", "")
    user_input = body.get("userInput", "")
    assistant_output = body.get("assistantOutput", "")
    tools_used = body.get("toolsUsed", [])
    success = body.get("success", True)
    if not label and not user_input:
        return JSONResponse(status_code=400, content={"error": "'label' or 'userInput' required"})
    if not label:
        label = user_input[:80]
    symbol = SymbolCrystallizer.crystallize(
        label=label,
        user_input=user_input,
        assistant_output=assistant_output,
        tools_used=tools_used,
        success=success,
    )
    symbol_store.store(symbol)
    # Notify Synapse if available
    if synapse_registry:
        try:
            synapse_registry.on_call_success(f"neuro:{symbol.operator}", latency_ms=0)
        except Exception:
            pass
    return JSONResponse(content={"status": "crystallized", "symbol": symbol.to_dict()})

# Import VALID_OPERATORS for the create endpoint
from py.neuro_bridge_api import VALID_OPERATORS


from py.live_router import router as live_router, ws_router as live_ws_router

# 2. 分别挂载
app.include_router(live_router)     # /api/live/*
app.include_router(live_ws_router)  # /ws/live/*


from py.overlay_router import router as overlay_router
app.include_router(overlay_router)

class ManagerFactory:
    _instances = {}

    @classmethod
    def get(cls, name, import_path, class_name):
        if name not in cls._instances:
            # 只有在第一次访问时才导入
            import importlib
            module = importlib.import_module(import_path)
            mgr_cls = getattr(module, class_name)
            cls._instances[name] = mgr_cls()
        return cls._instances[name]

    @classmethod
    def is_created(cls, name):
        """检查某个管理器是否已经初始化（不触发导入）"""
        return name in cls._instances

# --- 在 ManagerFactory 类之后添加代理类（如果之前没有添加的话）---
class _LazyManager:
    """惰性代理：访问属性时才会真正加载对应的管理器"""
    def __init__(self, name, import_path, class_name):
        self.name = name
        self.import_path = import_path
        self.class_name = class_name

    def __getattr__(self, attr):
        # 首次访问任何属性时，通过工厂获取真实的管理器实例
        mgr = ManagerFactory.get(self.name, self.import_path, self.class_name)
        # 返回真实管理器的对应属性
        return getattr(mgr, attr)

# Telegram remains local until its transport lifecycle receives a Worker boundary.
telegram_bot_manager = _LazyManager("telegram", "py.telegram_bot_manager", "TelegramBotManager")

async def sync_all_bots_behavior(settings_dict: dict):
    """Synchronize active Worker connectors and the local Telegram manager."""

    try:
        from py.connector_worker_client import get_connector_worker_client

        update_results = await get_connector_worker_client().update_running(settings_dict)
        for platform_name, result in update_results.items():
            if result.get("updated"):
                print(f"WebSocket Sync: {platform_name} connector behavior updated")
    except Exception as error:
        print(f"WebSocket Sync Error (Connector Worker): {error}")

    try:
        if 'telegram_bot_manager' in globals() and telegram_bot_manager.is_running:
            from py.telegram_bot_manager import TelegramBotConfig
            from py.telegram_credentials import apply_telegram_credential_to_configuration

            behavior_data = settings_dict.get("behaviorSettings", {})
            tg_data = apply_telegram_credential_to_configuration(
                settings_dict.get("telegramBotConfig", {})
            )
            tg_data["behaviorSettings"] = behavior_data
            new_tg_config = TelegramBotConfig(**tg_data)
            telegram_bot_manager.update_behavior_config(new_tg_config)
            print("WebSocket Sync: Telegram 机器人行为引擎已同步")
    except Exception as error:
        print(f"WebSocket Sync Error (Telegram): {type(error).__name__}")

settings_lock = asyncio.Lock()
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)

    # [关键点 1] 为当前连接生成唯一ID
    connection_id = str(shortuuid.ShortUUID().random(length=8))
    # 标记该连接是否发送过提示词（用于判断断开时是否需要发送移除指令）
    has_sent_prompt = False
    has_start_tts = False

    try:
        async with settings_lock:
            current_settings = await load_settings()
            if current_settings.get("conversations", None):
                await save_covs({"conversations": current_settings["conversations"]})
                del current_settings["conversations"]
                await save_settings(current_settings)
            covs = await load_covs()
            current_settings["conversations"] = covs.get("conversations", [])
        
        await websocket.send_json({
            "type": "settings",
            "data": redact_managed_credentials_for_renderer(current_settings),
        })
        
        while True:
            data = await websocket.receive_json()
            
            # --- 常规逻辑保持不变 ---
            if data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
            elif data.get("type") == "save_settings":
                settings_dict = data.get("data", {})
                # 1. 正常的保存逻辑
                await save_settings(settings_dict)
                await sync_all_bots_behavior(settings_dict)

                await websocket.send_json({
                    "type": "settings_saved",
                    "correlationId": data.get("correlationId"),
                    "success": True
                })
                for connection in [conn for conn in active_connections if conn != websocket]:
                    await connection.send_json({
                        "type": "settings_update",
                        "data": redact_managed_credentials_for_renderer(data.get("data", {}))
                    })
            elif data.get("type") == "save_vrm_config":
                vrm_config = data.get("data", {}).get("VRMConfig", {})
                if not isinstance(vrm_config, dict):
                    await websocket.send_json({
                        "type": "save_error",
                        "correlationId": data.get("correlationId"),
                        "message": "Invalid VRMConfig payload"
                    })
                    continue

                async with settings_lock:
                    current_settings = await load_settings()
                    current_settings["VRMConfig"] = vrm_config
                    await save_settings(current_settings)

                await websocket.send_json({
                    "type": "vrm_config_saved",
                    "correlationId": data.get("correlationId"),
                    "success": True
                })
                for connection in [conn for conn in active_connections if conn != websocket]:
                    await connection.send_json({
                        "type": "settings_update",
                        "data": {"VRMConfig": vrm_config}
                    })

            elif data.get("type") == "save_conversations":
                await save_covs(data.get("data", {}))
                await websocket.send_json({
                    "type": "conversations_saved",
                    "correlationId": data.get("correlationId"),
                    "success": True
                })
            elif data.get("type") == "get_settings":
                settings = await load_settings()
                if settings.get("conversations", None):
                    await save_covs({"conversations": settings["conversations"]})
                    del settings["conversations"]
                    await save_settings(settings)
                covs = await load_covs()
                settings["conversations"] = covs.get("conversations", [])
                await websocket.send_json({
                    "type": "settings",
                    "data": redact_managed_credentials_for_renderer(settings),
                })
            elif data.get("type") == "save_agent":
                current_settings = await load_settings()
                agent_id = str(shortuuid.ShortUUID().random(length=8))
                config_path = os.path.join(AGENT_DIR, f"{agent_id}.json")
                agent_payload = data.get("data", {}) if isinstance(data.get("data"), dict) else {}
                agent_metadata = agent_payload.get("metadata", {}) if isinstance(agent_payload.get("metadata"), dict) else {}
                runtime_system_prompt = (
                    agent_payload.get("runtime_system_prompt")
                    or agent_payload.get("system_prompt")
                    or ""
                )
                agent_snapshot = _build_agent_snapshot_payload(current_settings)
                if agent_metadata:
                    agent_snapshot["staff_role"] = agent_metadata
                with open(config_path, 'w', encoding='utf-8') as f:
                    json.dump(agent_snapshot, f, indent=4, ensure_ascii=False)
                current_settings['agents'][agent_id] = {
                    "id": agent_id,
                    "name": agent_payload.get("name", ""),
                    "system_prompt": runtime_system_prompt,
                    "source_system_prompt": agent_payload.get("system_prompt", ""),
                    "runtime_system_prompt": runtime_system_prompt,
                    "metadata": agent_metadata,
                    "config_path": config_path,
                    "enabled": False,
                }
                await save_settings(current_settings)
                await websocket.send_json({
                    "type": "settings",
                    "data": redact_managed_credentials_for_renderer(current_settings),
                })
            
            elif data.get("type") == "set_user_input":
                user_input = data.get("data", {}).get("text", "")
                for connection in active_connections:
                    await connection.send_json({
                        "type": "update_user_input",
                        "data": {"text": user_input}
                    })

            # --- [关键修改] 处理扩展页面发送的系统提示 ---
            elif data.get("type") == "set_system_prompt":
                has_sent_prompt = True # 标记该连接为扩展源
                extension_system_prompt = data.get("data", {}).get("text", "")
                
                # 广播时携带 connection_id
                for connection in active_connections:
                    await connection.send_json({
                        "type": "update_system_prompt",
                        "data": {
                            "id": connection_id,      # 这里传入连接ID
                            "text": extension_system_prompt
                        }
                    })

            elif data.get("type") == "set_tool_input":
                tool_input = data.get("data", {}).get("text", "")
                for connection in active_connections:
                    await connection.send_json({
                        "type": "update_tool_input",
                        "data": {"text": tool_input}
                    })
            # 把文字传给主界面TTS并播放
            elif data.get("type") == "start_read":
                has_start_tts = True
                read_input = data.get("data", {}).get("text", "")
                for connection in active_connections:
                    await connection.send_json({
                        "type": "start_tts",
                        "data": {"text": read_input}
                    })

            # 停止主界面TTS并清空要播放的内容
            elif data.get("type") == "stop_read":
                for connection in active_connections:
                    await connection.send_json({
                        "type": "stop_tts",
                        "data": {}
                    })

            elif data.get("type") == "trigger_close_extension":
                for connection in active_connections:
                    await connection.send_json({
                        "type": "trigger_close_extension",
                        "data": {}
                    })

            elif data.get("type") == "trigger_send_message":
                for connection in active_connections:
                    await connection.send_json({
                        "type": "trigger_send_message",
                        "data": {}
                    })
                    
            elif data.get("type") == "trigger_clear_message":
                for connection in active_connections:
                    await connection.send_json({
                        "type": "trigger_clear_message",
                        "data": {}
                    })

            elif data.get("type") == "get_messages":
                for connection in active_connections:
                    await connection.send_json({
                        "type": "request_messages",
                        "data": {}
                    })

            elif data.get("type") == "broadcast_messages":
                messages_data = data.get("data", {})
                for connection in [conn for conn in active_connections if conn != websocket]:
                    await connection.send_json({
                        "type": "messages_update",
                        "data": messages_data
                    })

    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        if websocket in active_connections:
            active_connections.remove(websocket)
        
        # --- [关键修改] 连接断开时的处理 ---
        # 只有当该连接曾经发送过 update_system_prompt 时才触发
        # 避免普通客户端断开时误删内容
        if has_sent_prompt:
            print(f"Extension {connection_id} disconnected. Removing prompt.")
            for connection in active_connections:
                try:
                    # 发送移除指令，只携带 ID
                    await connection.send_json({
                        "type": "remove_system_prompt",
                        "data": {
                            "id": connection_id 
                        }
                    })
                except Exception:
                    pass
        if has_start_tts:
            print(f"Extension {connection_id} disconnected. Removing tts.")
            for connection in active_connections:
                try:
                    # 发送移除指令，只携带 ID
                    await connection.send_json({
                        "type": "stop_tts",
                        "data": {}
                    })
                except Exception:
                    pass

@app.post("/sys/shutdown")
async def shutdown_server():
    """
    接收到此请求后，向自己发送 SIGTERM 信号，
    这将触发 FastAPI 的 lifespan 关闭流程（清理 Node 进程）。
    """
    if IS_DOCKER:
        return {"message": "Not allowed in Docker mode."}

    print("Received shutdown request via API...")
    # 获取当前进程 ID 并发送终止信号
    # Windows 和 Linux/Mac 都支持 SIGTERM
    os.kill(os.getpid(), signal.SIGTERM)
    return {"message": "Shutting down..."}

def _set_memory_federation(value):
    global memory_federation
    memory_federation = value


def _set_ha_client(value):
    global HA_client
    HA_client = value


def _set_chrome_mcp_client(value):
    global ChromeMCP_client
    ChromeMCP_client = value


def _set_sql_client(value):
    global sql_client
    sql_client = value


EXECUTION_ENGINE_PROFILE_ACTIVE = RUNTIME_PROFILE == "execution-engine"

if EXECUTION_ENGINE_PROFILE_ACTIVE:
    from py.execution_engine_profile import create_execution_engine_application

    app = create_execution_engine_application(
        lifespan=lifespan,
        token=DESKTOP_TASK_RPC_TOKEN,
    )
else:
    from py.routes import configure_route_modules, register_all_routes

    configure_route_modules(
        role_card_manager=lambda: role_card_manager,
        enterprise_kb_manager=lambda: enterprise_kb_manager,
        workspace_manager=lambda: workspace_manager,
        sandbox_manager=lambda: sandbox_manager,
        xnet_bridge=lambda: xnet_bridge,
        memory_federation=lambda: memory_federation,
        set_memory_federation=_set_memory_federation,
        symbol_store=lambda: symbol_store,
        abort_stream=lambda: _abort_stream,
        tts_manager=lambda: tts_manager,
        ha_client=lambda: HA_client,
        set_ha_client=_set_ha_client,
        chrome_mcp_client=lambda: ChromeMCP_client,
        set_chrome_mcp_client=_set_chrome_mcp_client,
        sql_client=lambda: sql_client,
        set_sql_client=_set_sql_client,
        settings_loader=load_settings,
        settings_saver=save_settings,
        settings_broadcaster=broadcast_settings_update,
        kernel_ref=lambda: kernel,
        trace_retry_handler=_retry_kernel_trace,
        plan_step_execute_handler=_execute_kernel_plan_step,
    )
    register_all_routes(
        app,
        include_connector_compatibility=RUNTIME_PROFILE == "server",
    )

    from py.uv_api import router as uv_router
    app.include_router(uv_router)

    from py.node_api import router as node_router
    app.include_router(node_router)

    from py.docker_api import router as docker_router
    app.include_router(docker_router)

    from py.extensions import router as extensions_router
    app.include_router(extensions_router)

    from py.skills import router as skills_router
    app.include_router(skills_router)

    from py.sherpa_model_manager import router as sherpa_model_router
    app.include_router(sherpa_model_router)

    from py.ebd_model_manager import router as ebd_model_router
    app.include_router(ebd_model_router)

    from py.minilm_router import router as minilm_router
    app.include_router(minilm_router)

    from py.ebd_api import router as embedding_router
    app.include_router(embedding_router)

    from py.affection_api import router as affection_router
    app.include_router(affection_router)


async def _run_task_execution_broker_turn(
    messages: List[Dict[str, str]],
    max_tokens: int,
    session_id: str,
    fastapi_request: Request,
) -> Any:
    """Adapt one typed broker turn to the existing provider and tool engine."""

    chat_request = ChatRequest(
        messages=messages,
        model="openxnet-model",
        stream=True,
        temperature=0.5,
        max_tokens=max_tokens,
        is_sub_agent=True,
        disable_tools=["create_subtask", "query_tasks_tool", "cancel_subtask"],
        conversation_id=session_id,
    )
    return await chat_endpoint(chat_request, fastapi_request)


async def _evaluate_task_execution_completion(
    task_description: str,
    recent_progress: str,
) -> ProviderEvaluationResult:
    """Adapt one typed completion check to the existing simple provider call."""

    response = await simple_chat_endpoint(ChatRequest(
        messages=[
            {"role": "system", "content": "判断任务是否完成，只回复YES或NO。"},
            {
                "role": "user",
                "content": (
                    f"任务：{task_description}\n"
                    f"最近进展：{recent_progress}\n是否完成？"
                ),
            },
        ],
        model="openxnet-model",
        stream=False,
        is_sub_agent=True,
    ))
    status_code = int(getattr(response, "status_code", 500) or 500)
    if status_code != 200:
        return ProviderEvaluationResult(status_code=status_code, content=None)
    try:
        payload = json.loads(bytes(getattr(response, "body", b"")).decode("utf-8"))
        content = str(payload["choices"][0]["message"]["content"])
    except (KeyError, IndexError, TypeError, UnicodeDecodeError, json.JSONDecodeError):
        content = None
    return ProviderEvaluationResult(status_code=status_code, content=content)


async def _dispatch_task_terminal_delivery(
    task: Any,
    record: Dict[str, Any],
    current_settings: Dict[str, Any],
    delivery_credential_bootstrap: str,
) -> Dict[str, Any]:
    """Adapt one typed terminal attempt to the credential-retaining delivery engine."""

    from py.delivery_credentials import hydrate_delivery_record

    workspace_path = str(
        (current_settings.get("CLISettings") or {}).get("cc_path") or ""
    ).strip()
    hydrated_record = hydrate_delivery_record(
        delivery_credential_bootstrap,
        workspace_path,
        str(getattr(task, "task_id", "") or ""),
        str(record.get("target") or ""),
        record,
    )
    return await dispatch_delivery(task, hydrated_record, settings=current_settings)


TASK_EXECUTION_BROKER_API = register_task_execution_broker_api(
    app,
    TaskExecutionBrokerDependencies(
        load_settings=load_settings,
        get_task_center=get_task_center,
        get_provider_block_message=_get_task_scheduler_block_message,
        run_session_turn=_run_task_execution_broker_turn,
        evaluate_completion=_evaluate_task_execution_completion,
        abort_session=_abort_stream,
        dispatch_terminal_delivery=_dispatch_task_terminal_delivery,
    ),
)


async def _run_application_chat_engine(
    payload: Dict[str, Any],
    fastapi_request: Request,
) -> Any:
    """Adapt one typed Engine chat payload to the existing full chat handler."""

    return await chat_endpoint(ChatRequest(**payload), fastapi_request)


async def _run_application_simple_chat_engine(payload: Dict[str, Any]) -> Any:
    """Adapt one typed Engine payload to the existing simple chat handler."""

    return await simple_chat_endpoint(ChatRequest(**payload))


def _register_execution_engine_chat_api() -> Any:
    """Register private Chat routes only for the independently supervised profile."""

    if not EXECUTION_ENGINE_PROFILE_ACTIVE:
        return None
    from py.chat_engine_api import ChatEngineDependencies, register_chat_engine_api

    return register_chat_engine_api(
        app,
        ChatEngineDependencies(
            run_chat=_run_application_chat_engine,
            run_simple_chat=_run_application_simple_chat_engine,
            list_models=get_models,
            abort_chat=_abort_stream,
            execute_tool=_execute_tool_manually_payload,
            resolve_approval=_resolve_chat_tool_approval_payload,
        ),
    )


CHAT_ENGINE_API = _register_execution_engine_chat_api()


def _register_execution_engine_knowledge_base_api() -> Any:
    """注册私有知识库路由；无输入，返回适配器引用，非 Execution Engine profile 返回空值。"""

    if not EXECUTION_ENGINE_PROFILE_ACTIVE:
        return None
    from py.knowledge_base_engine_api import register_knowledge_base_engine_api
    from py.knowledge_base_runtime import KnowledgeBaseRuntimeController

    return register_knowledge_base_engine_api(
        app,
        KnowledgeBaseRuntimeController(),
    )


KNOWLEDGE_BASE_ENGINE_API = _register_execution_engine_knowledge_base_api()


def _register_execution_engine_enterprise_insights_api() -> Any:
    """注册私有企业洞察路由；无输入，返回适配器引用，非 Execution Engine profile 返回空值。"""

    if not EXECUTION_ENGINE_PROFILE_ACTIVE:
        return None
    from py.enterprise_insights_engine_api import (
        EnterpriseInsightsEngineDependencies,
        register_enterprise_insights_engine_api,
    )

    return register_enterprise_insights_engine_api(
        app,
        EnterpriseInsightsEngineDependencies(
            get_symbol_store=lambda: symbol_store,
            get_temporal_kg=get_temporal_kg,
            get_rule_registry=get_rule_registry,
        ),
    )


ENTERPRISE_INSIGHTS_ENGINE_API = _register_execution_engine_enterprise_insights_api()


def _register_execution_engine_kernel_api() -> Any:
    """注册私有 Kernel dispatcher；无输入，返回适配器引用；非 Execution Engine profile 时返回空值且不修改路由。"""

    if not EXECUTION_ENGINE_PROFILE_ACTIVE:
        return None
    from py.kernel_engine_api import register_kernel_engine_api
    from py.routes.kernel import configure_kernel_routes

    configure_kernel_routes(
        settings_loader=load_settings,
        settings_saver=save_settings,
        settings_broadcaster=broadcast_settings_update,
        kernel_ref=lambda: kernel,
        trace_retry_handler=_retry_kernel_trace,
        plan_step_execute_handler=_execute_kernel_plan_step,
    )
    return register_kernel_engine_api(app)


KERNEL_ENGINE_API = _register_execution_engine_kernel_api()


def _get_server_task_backend_origin() -> str:
    """Return the loopback origin used by Server-profile task executors."""

    return f"http://127.0.0.1:{get_port()}"


def _register_server_profile_task_api() -> bool:
    """Dynamically register browser task commands only in Server profile."""

    if RUNTIME_PROFILE != "server":
        return False
    task_api_module = import_module(".".join(("py", "server_task_api")))
    dependencies_class = getattr(task_api_module, "ServerTaskApiDependencies")
    dependencies = dependencies_class(
        load_settings=load_settings,
        get_task_center=get_task_center,
        get_block_message=_get_task_scheduler_block_message,
        get_cli_runtime_context=_get_cli_runtime_context,
        build_developer_workbench_payload=_build_developer_workbench_task_payload,
        build_executor_options=build_task_executor_options,
        backend_origin=_get_server_task_backend_origin,
    )
    register_task_api = getattr(task_api_module, "register_server_task_api")
    register_task_api(app, dependencies)
    return True


SERVER_TASK_API_REGISTERED = _register_server_profile_task_api()


if RUNTIME_PROFILE == "server":
    fastapi_mcp_module = import_module("fastapi_" + "mcp")
    fastapi_mcp_class = getattr(fastapi_mcp_module, "FastApiMCP")
    mcp = fastapi_mcp_class(
        app,
        name="Agent party MCP - chat with multiple agents",
        include_operations=["get_agents", "chat_with_agent_party"],
    )
    mcp.mount()

    for _static_dir in (DEFAULT_VRM_DIR, TOOL_TEMP_DIR, UPLOAD_FILES_DIR, EXT_DIR):
        os.makedirs(_static_dir, exist_ok=True)

    app.mount("/vrm", StaticFiles(directory=DEFAULT_VRM_DIR), name="vrm")
    app.mount("/tool_temp", StaticFiles(directory=TOOL_TEMP_DIR), name="tool_temp")
    app.mount("/uploaded_files", StaticFiles(directory=UPLOAD_FILES_DIR), name="uploaded_files")
    app.mount("/ext", StaticFiles(directory=EXT_DIR), name="ext")
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")

# 简化main函数
if __name__ == "__main__":
    import uvicorn

    # 格式化显示地址
    display_host = "127.0.0.1" if HOST == "0.0.0.0" else HOST
    
    print("\n" + "="*50)
    print(f"🚀 后端服务已启动")
    print(f"🔗 本地运行地址: http://{display_host}:{PORT}")
    print(f"📖 API 文档地址: http://{display_host}:{PORT}/docs") # 如果是 FastAPI
    print("="*50 + "\n")

    uvicorn.run(
        app,
        host=HOST,
        port=PORT,
        log_level="warning"
    )
