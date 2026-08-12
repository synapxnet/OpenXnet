#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
WorldGen bridge for Quest/OpenXnet generated scenes.

WorldGen itself is GPU-heavy and should run on the desktop/server side. This
bridge keeps the VR route stable even when the real WorldGen package or CUDA
runtime is not installed by producing a tiny GLB placeholder scene.
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import importlib
import json
import math
import os
import shutil
import struct
import subprocess
import sys
import uuid
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional


REPO_ROOT = Path(__file__).resolve().parents[1]
GENERATED_SCENE_ROOT = REPO_ROOT / "data" / "generated_scenes"
WORLDGEN_WORKER_PATH = REPO_ROOT / "py" / "worldgen_worker.py"


@dataclass
class WorldGenSceneRequest:
    prompt: str
    scene_id: str = ""
    mode: str = "t2s"
    return_mesh: bool = True
    use_sharp: bool = False
    inpaint_bg: bool = False
    resolution: int = 1600
    low_vram: Optional[bool] = None
    source: str = "openxnet"


@dataclass(frozen=True)
class WorldGenRuntimeConfig:
    feature_enabled: bool
    enabled: bool
    backend: str
    api_url: str = ""
    python: str = ""
    repo: str = ""
    timeout_seconds: int = 1200
    device: str = "cuda"
    lora_path: str = ""


def now_iso() -> str:
    return datetime.now().isoformat()


def clean_text(value: Any, fallback: str = "") -> str:
    text = str(value or fallback).strip()
    return text if text else fallback


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


def _runtime_config() -> WorldGenRuntimeConfig:
    backend = clean_text(os.getenv("OPENXNET_WORLDGEN_BACKEND"), "auto").lower()
    if backend not in {"auto", "local", "subprocess", "http", "placeholder"}:
        backend = "auto"
    runtime_enabled = _env_bool("OPENXNET_WORLDGEN_ENABLED", False)
    return WorldGenRuntimeConfig(
        feature_enabled=_env_bool("OPENXNET_WORLDGEN_FEATURE_ENABLED", False) or runtime_enabled,
        enabled=runtime_enabled,
        backend=backend,
        api_url=clean_text(os.getenv("OPENXNET_WORLDGEN_API_URL")),
        python=clean_text(os.getenv("OPENXNET_WORLDGEN_PYTHON")),
        repo=clean_text(os.getenv("OPENXNET_WORLDGEN_REPO")),
        timeout_seconds=max(60, _env_int("OPENXNET_WORLDGEN_TIMEOUT_SECONDS", 1200)),
        device=clean_text(os.getenv("OPENXNET_WORLDGEN_DEVICE"), "cuda"),
        lora_path=clean_text(os.getenv("OPENXNET_WORLDGEN_LORA_PATH")),
    )


def _selected_backend(config: Optional[WorldGenRuntimeConfig] = None) -> str:
    cfg = config or _runtime_config()
    if not cfg.feature_enabled or not cfg.enabled or cfg.backend == "placeholder":
        return "placeholder"
    if cfg.backend != "auto":
        return cfg.backend
    if cfg.api_url:
        return "http"
    if cfg.python or cfg.repo:
        return "subprocess"
    return "local"


def worldgen_runtime_status() -> Dict[str, Any]:
    cfg = _runtime_config()
    backend = _selected_backend(cfg)
    python_path = cfg.python or sys.executable
    repo_path = Path(cfg.repo).expanduser() if cfg.repo else None
    return {
        "feature_enabled": cfg.feature_enabled,
        "enabled": cfg.enabled,
        "backend": backend,
        "configured_backend": cfg.backend,
        "api_url_configured": bool(cfg.api_url),
        "python": python_path,
        "python_exists": bool(shutil.which(python_path) or Path(python_path).exists()),
        "repo": cfg.repo,
        "repo_exists": bool(repo_path and repo_path.exists()),
        "worker": str(WORLDGEN_WORKER_PATH),
        "worker_exists": WORLDGEN_WORKER_PATH.is_file(),
        "timeout_seconds": cfg.timeout_seconds,
        "device": cfg.device,
        "lora_path_configured": bool(cfg.lora_path),
        "message": _worldgen_status_message(cfg, backend),
    }


def _worldgen_status_message(config: WorldGenRuntimeConfig, backend: str) -> str:
    if backend == "placeholder":
        if not config.feature_enabled:
            return "WorldGen scene generation is disabled by default; set OPENXNET_WORLDGEN_FEATURE_ENABLED=1 to enable it"
        return "placeholder backend active; set OPENXNET_WORLDGEN_ENABLED=1 to use real generation"
    if backend == "http":
        return "using external WorldGen HTTP service" if config.api_url else "OPENXNET_WORLDGEN_API_URL is required"
    if backend == "subprocess":
        return "using isolated WorldGen worker subprocess"
    return "using in-process WorldGen import"


def make_scene_id(prompt: str) -> str:
    digest = hashlib.sha1(prompt.encode("utf-8")).hexdigest()[:8]
    return f"worldgen_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{digest}_{uuid.uuid4().hex[:6]}"


def scene_dir(scene_id: str) -> Path:
    safe = "".join(ch for ch in clean_text(scene_id) if ch.isalnum() or ch in {"_", "-"})
    if not safe:
        raise ValueError("scene_id is empty")
    return GENERATED_SCENE_ROOT / safe


def scene_asset_path(scene_id: str, filename: str) -> Path:
    root = scene_dir(scene_id).resolve()
    path = (root / filename).resolve()
    if root not in path.parents and path != root:
        raise ValueError("asset path escapes generated scene directory")
    return path


def load_manifest(scene_id: str) -> Dict[str, Any]:
    path = scene_asset_path(scene_id, "manifest.json")
    if not path.is_file():
        raise FileNotFoundError(f"generated scene manifest not found: {scene_id}")
    return json.loads(path.read_text(encoding="utf-8"))


def prepare_scene(
    request: WorldGenSceneRequest,
    *,
    base_url: str = "",
) -> Dict[str, Any]:
    scene_id = clean_text(request.scene_id) or make_scene_id(request.prompt)
    request.scene_id = scene_id
    out_dir = scene_dir(scene_id)
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest = _base_manifest(request, scene_id, base_url)
    _write_manifest(out_dir, manifest)
    return manifest


def manifest_path(scene_id: str) -> Path:
    return scene_asset_path(scene_id, "manifest.json")


def public_scene_urls(base_url: str, scene_id: str) -> Dict[str, str]:
    origin = clean_text(base_url).rstrip("/")
    prefix = f"{origin}/v1/vr/worldgen/scenes/{scene_id}"
    return {
        "manifest_url": f"{prefix}/manifest",
        "mesh_url": f"{prefix}/assets/scene.glb",
        "preview_url": f"{prefix}/assets/preview.png",
    }


async def generate_scene(
    request: WorldGenSceneRequest,
    *,
    base_url: str = "",
) -> Dict[str, Any]:
    scene_id = clean_text(request.scene_id) or make_scene_id(request.prompt)
    out_dir = scene_dir(scene_id)
    out_dir.mkdir(parents=True, exist_ok=True)

    manifest = _base_manifest(request, scene_id, base_url)
    _write_manifest(out_dir, manifest)

    try:
        if _worldgen_enabled():
            manifest = await _run_worldgen(request, scene_id, out_dir, base_url)
        else:
            manifest = await asyncio.to_thread(_write_placeholder_scene, request, scene_id, out_dir, base_url)
    except Exception as exc:
        manifest = _with_urls(
            {
                **manifest,
                "status": "failed",
                "error": {
                    "code": "WORLDGEN_FAILED",
                    "message": str(exc)[:1000],
                },
                "updated_at": now_iso(),
            },
            scene_id,
            base_url,
        )
        _write_manifest(out_dir, manifest)

    return manifest


def _worldgen_enabled() -> bool:
    return _selected_backend() != "placeholder"


def worldgen_feature_enabled() -> bool:
    return _runtime_config().feature_enabled


async def _run_worldgen(
    request: WorldGenSceneRequest,
    scene_id: str,
    out_dir: Path,
    base_url: str,
) -> Dict[str, Any]:
    return await asyncio.to_thread(_run_worldgen_sync, request, scene_id, out_dir, base_url)


def _run_worldgen_sync(
    request: WorldGenSceneRequest,
    scene_id: str,
    out_dir: Path,
    base_url: str,
) -> Dict[str, Any]:
    config = _runtime_config()
    backend = _selected_backend(config)
    if backend == "http":
        return _run_worldgen_http_sync(request, scene_id, out_dir, base_url, config)
    if backend == "subprocess":
        return _run_worldgen_subprocess_sync(request, scene_id, out_dir, base_url, config)
    if backend == "local":
        return _run_worldgen_local_sync(request, scene_id, out_dir, base_url, config)
    return _write_placeholder_scene(request, scene_id, out_dir, base_url)


def _worldgen_worker_payload(
    request: WorldGenSceneRequest,
    scene_id: str,
    out_dir: Path,
    config: WorldGenRuntimeConfig,
) -> Dict[str, Any]:
    return {
        "scene_id": scene_id,
        "prompt": clean_text(request.prompt),
        "mode": clean_text(request.mode, "t2s"),
        "return_mesh": True,
        "use_sharp": bool(request.use_sharp),
        "inpaint_bg": bool(request.inpaint_bg),
        "resolution": int(request.resolution or 1600),
        "low_vram": request.low_vram,
        "output_dir": str(out_dir),
        "worldgen_repo": config.repo,
        "device": config.device,
        "lora_path": config.lora_path,
    }


def _run_worldgen_subprocess_sync(
    request: WorldGenSceneRequest,
    scene_id: str,
    out_dir: Path,
    base_url: str,
    config: WorldGenRuntimeConfig,
) -> Dict[str, Any]:
    python = config.python or sys.executable
    if not shutil.which(python) and not Path(python).exists():
        raise RuntimeError(f"WorldGen Python executable not found: {python}")
    if not WORLDGEN_WORKER_PATH.is_file():
        raise RuntimeError(f"WorldGen worker not found: {WORLDGEN_WORKER_PATH}")

    input_path = out_dir / "worldgen_request.json"
    result_path = out_dir / "worldgen_result.json"
    log_path = out_dir / "worldgen_worker.log"
    input_path.write_text(
        json.dumps(_worldgen_worker_payload(request, scene_id, out_dir, config), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    env = os.environ.copy()
    if config.repo:
        env["OPENXNET_WORLDGEN_REPO"] = config.repo
    if config.device:
        env["OPENXNET_WORLDGEN_DEVICE"] = config.device
    if config.lora_path:
        env["OPENXNET_WORLDGEN_LORA_PATH"] = config.lora_path

    proc = subprocess.run(
        [python, str(WORLDGEN_WORKER_PATH), "--input", str(input_path), "--output", str(result_path)],
        cwd=config.repo or str(REPO_ROOT),
        env=env,
        text=True,
        encoding="utf-8",
        errors="replace",
        capture_output=True,
        timeout=config.timeout_seconds,
    )
    log_path.write_text(
        "COMMAND: " + " ".join([python, str(WORLDGEN_WORKER_PATH)]) + "\n\n"
        + "STDOUT:\n"
        + (proc.stdout or "")
        + "\n\nSTDERR:\n"
        + (proc.stderr or ""),
        encoding="utf-8",
    )

    result = _load_worker_result(result_path, proc.stdout)
    if proc.returncode != 0 or clean_text(result.get("status")) != "ready":
        message = _worker_error_message(result) or (proc.stderr or proc.stdout or "WorldGen worker failed")
        raise RuntimeError(message[:2000])

    return _worldgen_ready_manifest(
        request,
        scene_id,
        out_dir,
        base_url,
        backend="worldgen-subprocess",
        message="WorldGen mesh generated by worker subprocess.",
        runtime=result.get("runtime") if isinstance(result.get("runtime"), dict) else {},
        worker_log=str(log_path),
    )


def _run_worldgen_http_sync(
    request: WorldGenSceneRequest,
    scene_id: str,
    out_dir: Path,
    base_url: str,
    config: WorldGenRuntimeConfig,
) -> Dict[str, Any]:
    if not config.api_url:
        raise RuntimeError("OPENXNET_WORLDGEN_API_URL is required for the http backend")
    httpx = importlib.import_module("httpx")
    payload = _worldgen_worker_payload(request, scene_id, out_dir, config)
    payload.pop("output_dir", None)
    response = httpx.post(
        config.api_url.rstrip("/") + "/v1/worldgen/generate",
        json=payload,
        timeout=config.timeout_seconds,
    )
    if response.status_code >= 400:
        raise RuntimeError(f"WorldGen HTTP service failed: {response.status_code} {response.text[:1000]}")

    mesh_path = out_dir / "scene.glb"
    preview_path = out_dir / "preview.png"
    result: Dict[str, Any] = {}
    if "application/json" in response.headers.get("content-type", ""):
        result = response.json()
        if clean_text(result.get("mesh_glb_base64")):
            mesh_path.write_bytes(base64.b64decode(result["mesh_glb_base64"]))
        elif clean_text(result.get("mesh_url")):
            mesh_response = httpx.get(result["mesh_url"], timeout=config.timeout_seconds)
            mesh_response.raise_for_status()
            mesh_path.write_bytes(mesh_response.content)
        else:
            raise RuntimeError("WorldGen HTTP service response did not include mesh_glb_base64 or mesh_url")
        if clean_text(result.get("preview_png_base64")):
            preview_path.write_bytes(base64.b64decode(result["preview_png_base64"]))
    else:
        mesh_path.write_bytes(response.content)

    if not mesh_path.is_file() or mesh_path.stat().st_size <= 0:
        raise RuntimeError("WorldGen HTTP service produced an empty scene.glb")
    if not preview_path.exists():
        _write_preview_png(preview_path)

    return _worldgen_ready_manifest(
        request,
        scene_id,
        out_dir,
        base_url,
        backend="worldgen-http",
        message="WorldGen mesh generated by external HTTP service.",
        runtime=result.get("runtime") if isinstance(result.get("runtime"), dict) else {"api_url": config.api_url},
    )


def _run_worldgen_local_sync(
    request: WorldGenSceneRequest,
    scene_id: str,
    out_dir: Path,
    base_url: str,
    config: WorldGenRuntimeConfig,
) -> Dict[str, Any]:
    if config.repo:
        repo = Path(config.repo).expanduser().resolve()
        for candidate in (str(repo / "src"), str(repo)):
            if candidate not in sys.path:
                sys.path.insert(0, candidate)
    module = importlib.import_module("worldgen")
    worldgen_cls = getattr(module, "WorldGen")
    kwargs = {
        "mode": clean_text(request.mode, "t2s"),
        "use_sharp": bool(request.use_sharp),
        "inpaint_bg": bool(request.inpaint_bg) and not bool(request.return_mesh),
        "resolution": int(request.resolution or 1600),
        "low_vram": request.low_vram,
    }
    if config.device:
        torch = importlib.import_module("torch")
        kwargs["device"] = torch.device(config.device if torch.cuda.is_available() or config.device == "cpu" else "cpu")
    if config.lora_path:
        kwargs["lora_path"] = config.lora_path
    worldgen = worldgen_cls(**kwargs)
    mesh = worldgen.generate_world(prompt=clean_text(request.prompt), return_mesh=True)
    mesh_path = out_dir / "scene.glb"

    open3d = importlib.import_module("open3d")
    ok = open3d.io.write_triangle_mesh(str(mesh_path), mesh)
    if not ok:
        raise RuntimeError("open3d failed to write scene.glb")

    preview_path = out_dir / "preview.png"
    if not preview_path.exists():
        _write_preview_png(preview_path)

    return _worldgen_ready_manifest(
        request,
        scene_id,
        out_dir,
        base_url,
        backend="worldgen-local",
        message="WorldGen mesh generated in-process.",
        runtime={"repo": config.repo, "device": config.device},
    )


def _load_worker_result(result_path: Path, stdout: str) -> Dict[str, Any]:
    if result_path.is_file():
        return json.loads(result_path.read_text(encoding="utf-8"))
    for line in reversed((stdout or "").splitlines()):
        try:
            value = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(value, dict):
            return value
    return {}


def _worker_error_message(result: Dict[str, Any]) -> str:
    error = result.get("error") if isinstance(result.get("error"), dict) else {}
    return clean_text(error.get("message"))


def _worldgen_ready_manifest(
    request: WorldGenSceneRequest,
    scene_id: str,
    out_dir: Path,
    base_url: str,
    *,
    backend: str,
    message: str,
    runtime: Optional[Dict[str, Any]] = None,
    worker_log: str = "",
) -> Dict[str, Any]:
    mesh_path = out_dir / "scene.glb"
    preview_path = out_dir / "preview.png"
    if not mesh_path.is_file():
        raise RuntimeError("WorldGen did not produce scene.glb")
    if not preview_path.exists():
        _write_preview_png(preview_path)

    manifest = _with_urls(
        {
            **_base_manifest(request, scene_id, base_url),
            "status": "ready",
            "backend": backend,
            "message": message,
            "updated_at": now_iso(),
            "assets": {
                "mesh": {
                    "path": "scene.glb",
                    "format": "glb",
                    "content_type": "model/gltf-binary",
                    "bytes": mesh_path.stat().st_size,
                },
                "preview": {
                    "path": "preview.png",
                    "format": "png",
                    "content_type": "image/png",
                    "bytes": preview_path.stat().st_size,
                },
            },
            "interaction": _default_interaction(scene_id, request.prompt),
        },
        scene_id,
        base_url,
    )
    worldgen = manifest.setdefault("worldgen", {})
    if isinstance(runtime, dict):
        worldgen["runtime"] = runtime
    if worker_log:
        worldgen["worker_log"] = worker_log
    _write_manifest(out_dir, manifest)
    return manifest


def _base_manifest(request: WorldGenSceneRequest, scene_id: str, base_url: str) -> Dict[str, Any]:
    runtime_status = worldgen_runtime_status()
    return _with_urls(
        {
            "schema": "openxnet.worldgen.scene.v1",
            "scene_id": scene_id,
            "prompt": clean_text(request.prompt),
            "status": "queued",
            "backend": clean_text(runtime_status.get("backend"), "placeholder"),
            "source": clean_text(request.source, "openxnet"),
            "created_at": now_iso(),
            "updated_at": now_iso(),
            "worldgen": {
                "mode": clean_text(request.mode, "t2s"),
                "return_mesh": True,
                "use_sharp": bool(request.use_sharp),
                "inpaint_bg": bool(request.inpaint_bg),
                "resolution": int(request.resolution or 1600),
                "low_vram": request.low_vram,
                "enabled": _worldgen_enabled(),
                "feature_enabled": bool(runtime_status.get("feature_enabled")),
                "backend": clean_text(runtime_status.get("backend"), "placeholder"),
                "configured_backend": clean_text(runtime_status.get("configured_backend"), "auto"),
            },
            "placement": {
                "mode": "front_of_user",
                "distance_m": 2.2,
                "vertical_offset_m": -0.35,
                "uniform_scale": 1.0,
            },
            "assets": {},
            "interaction": _default_interaction(scene_id, request.prompt),
        },
        scene_id,
        base_url,
    )


def _with_urls(manifest: Dict[str, Any], scene_id: str, base_url: str) -> Dict[str, Any]:
    if not clean_text(base_url):
        return manifest
    urls = public_scene_urls(base_url, scene_id)
    manifest["manifest_url"] = urls["manifest_url"]
    assets = manifest.setdefault("assets", {})
    mesh = assets.setdefault("mesh", {})
    mesh["url"] = urls["mesh_url"]
    preview = assets.setdefault("preview", {})
    preview["url"] = urls["preview_url"]
    return manifest


def _write_manifest(out_dir: Path, manifest: Dict[str, Any]) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _write_placeholder_scene(
    request: WorldGenSceneRequest,
    scene_id: str,
    out_dir: Path,
    base_url: str,
) -> Dict[str, Any]:
    mesh_path = out_dir / "scene.glb"
    preview_path = out_dir / "preview.png"
    _write_placeholder_glb(mesh_path, request.prompt)
    _write_preview_png(preview_path)

    manifest = _with_urls(
        {
            **_base_manifest(request, scene_id, base_url),
            "status": "ready",
            "backend": "placeholder",
            "message": (
                "WorldGen runtime is not enabled. Set OPENXNET_WORLDGEN_ENABLED=1 "
                "and install WorldGen dependencies on a CUDA desktop/server to use real generation."
            ),
            "updated_at": now_iso(),
            "assets": {
                "mesh": {
                    "path": "scene.glb",
                    "format": "glb",
                    "content_type": "model/gltf-binary",
                    "bytes": mesh_path.stat().st_size,
                },
                "preview": {
                    "path": "preview.png",
                    "format": "png",
                    "content_type": "image/png",
                    "bytes": preview_path.stat().st_size,
                },
            },
            "interaction": _default_interaction(scene_id, request.prompt),
        },
        scene_id,
        base_url,
    )
    _write_manifest(out_dir, manifest)
    return manifest


def _default_interaction(scene_id: str, prompt: str) -> Dict[str, Any]:
    return {
        "object_id": f"generated_scene_{scene_id}",
        "label": "WorldGen Scene",
        "object_type": "generated_world",
        "semantic_action": "assistant_prompt",
        "semantic_prompt": (
            "The user is interacting with a generated 3D scene. "
            f"Scene prompt: {clean_text(prompt)}. "
            "Explain what can be explored and suggest concrete interactions."
        ),
        "task_title": "Explore generated WorldGen scene",
        "task_agent_type": "default",
        "start_task_immediately": False,
    }


def _write_preview_png(path: Path) -> None:
    # 1x1 transparent PNG.
    raw = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mP8z8BQDwAFgwJ/l4t9NwAAAABJRU5ErkJggg=="
    path.write_bytes(base64.b64decode(raw))


def _write_placeholder_glb(path: Path, prompt: str) -> None:
    gltf, binary = _placeholder_gltf_and_bin(prompt)
    json_bytes = json.dumps(gltf, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    json_bytes += b" " * ((4 - len(json_bytes) % 4) % 4)
    binary += b"\x00" * ((4 - len(binary) % 4) % 4)

    chunks = [
        struct.pack("<I4s", len(json_bytes), b"JSON") + json_bytes,
        struct.pack("<I4s", len(binary), b"BIN\x00") + binary,
    ]
    total_length = 12 + sum(len(chunk) for chunk in chunks)
    header = struct.pack("<4sII", b"glTF", 2, total_length)
    path.write_bytes(header + b"".join(chunks))


def _placeholder_gltf_and_bin(prompt: str) -> tuple[Dict[str, Any], bytes]:
    vertices, indices = _scene_mesh()
    positions = b"".join(struct.pack("<3f", *vertex) for vertex in vertices)
    index_bytes = b"".join(struct.pack("<H", index) for index in indices)
    binary = positions + index_bytes
    min_pos = [min(v[i] for v in vertices) for i in range(3)]
    max_pos = [max(v[i] for v in vertices) for i in range(3)]
    prompt_hint = clean_text(prompt, "generated scene")[:72]

    gltf: Dict[str, Any] = {
        "asset": {"version": "2.0", "generator": "OpenXnet WorldGen bridge placeholder"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"name": f"OpenXnet WorldGen Placeholder - {prompt_hint}", "mesh": 0}],
        "meshes": [
            {
                "name": "GeneratedScenePlaceholder",
                "primitives": [
                    {
                        "attributes": {"POSITION": 0},
                        "indices": 1,
                        "material": 0,
                        "mode": 4,
                    }
                ],
            }
        ],
        "materials": [
            {
                "name": "OpenXnetGeneratedSceneMaterial",
                "pbrMetallicRoughness": {
                    "baseColorFactor": [0.18, 0.62, 0.78, 1.0],
                    "metallicFactor": 0.0,
                    "roughnessFactor": 0.78,
                },
                "emissiveFactor": [0.0, 0.08, 0.1],
            }
        ],
        "buffers": [{"byteLength": len(binary)}],
        "bufferViews": [
            {"buffer": 0, "byteOffset": 0, "byteLength": len(positions), "target": 34962},
            {"buffer": 0, "byteOffset": len(positions), "byteLength": len(index_bytes), "target": 34963},
        ],
        "accessors": [
            {
                "bufferView": 0,
                "byteOffset": 0,
                "componentType": 5126,
                "count": len(vertices),
                "type": "VEC3",
                "min": [round(v, 4) for v in min_pos],
                "max": [round(v, 4) for v in max_pos],
            },
            {
                "bufferView": 1,
                "byteOffset": 0,
                "componentType": 5123,
                "count": len(indices),
                "type": "SCALAR",
            },
        ],
    }
    return gltf, binary


def _scene_mesh() -> tuple[list[tuple[float, float, float]], list[int]]:
    vertices: list[tuple[float, float, float]] = []
    indices: list[int] = []

    def add_box(cx: float, cy: float, cz: float, sx: float, sy: float, sz: float) -> None:
        start = len(vertices)
        x0, x1 = cx - sx / 2, cx + sx / 2
        y0, y1 = cy - sy / 2, cy + sy / 2
        z0, z1 = cz - sz / 2, cz + sz / 2
        vertices.extend(
            [
                (x0, y0, z0),
                (x1, y0, z0),
                (x1, y1, z0),
                (x0, y1, z0),
                (x0, y0, z1),
                (x1, y0, z1),
                (x1, y1, z1),
                (x0, y1, z1),
            ]
        )
        faces = [
            (0, 1, 2, 2, 3, 0),
            (4, 6, 5, 6, 4, 7),
            (0, 4, 5, 5, 1, 0),
            (3, 2, 6, 6, 7, 3),
            (1, 5, 6, 6, 2, 1),
            (0, 3, 7, 7, 4, 0),
        ]
        for face in faces:
            indices.extend(start + item for item in face)

    add_box(0.0, -0.03, 0.0, 2.2, 0.06, 2.2)
    add_box(-0.62, 0.32, -0.15, 0.34, 0.7, 0.34)
    add_box(0.35, 0.2, 0.42, 0.5, 0.42, 0.5)
    add_box(0.0, 0.9, 0.0, 0.08, 1.8, 0.08)

    radius = 0.42
    center = (0.0, 1.25, 0.0)
    start = len(vertices)
    vertices.append(center)
    ring_count = 20
    for i in range(ring_count):
        angle = math.tau * i / ring_count
        vertices.append((math.cos(angle) * radius, center[1], math.sin(angle) * radius))
    for i in range(ring_count):
        a = start + 1 + i
        b = start + 1 + ((i + 1) % ring_count)
        indices.extend([start, a, b])

    return vertices, indices
