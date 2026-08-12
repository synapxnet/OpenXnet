#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
Storage and asset management routes extracted from the monolithic server module.

This module groups together file upload/delete flows, VRM/VRMA/Gaussian asset
management, workflow file persistence, knowledge-base background jobs, and
memory record maintenance so server.py can keep shrinking without changing the
existing API contract.

Author: OpenAI Codex
Department: R&D
Date: 2026-04-15
Version: 1.0.0
Security Level: INTERNAL
"""

__version__ = "1.0.0"
__author__ = "OpenAI Codex"
__copyright__ = "Copyright 2026 Synapxnet"
__maintainer__ = "OpenAI Codex"
__email__ = "synapxnet@gmail.com"

# Modification History:
# 2026-04-15, v1.0.0, OpenAI Codex: Initial creation.

import asyncio
import json
import logging
import os
import re
import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List
from urllib.parse import quote, urljoin

from fastapi import APIRouter, BackgroundTasks, Body, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import aiofiles
import httpx

from py.get_setting import EXT_DIR, KB_DIR, MEMORY_CACHE_DIR, UPLOAD_FILES_DIR, DEFAULT_VRM_DIR, USER_DATA_DIR, load_settings, save_settings
from py.load_files import get_file_content
from py.memory.vector_worker_store import VectorWorkerStore

router = APIRouter(tags=["storage"])
logger = logging.getLogger("app")

ALLOWED_EXTENSIONS = [
    "txt",
    "md",
    "markdown",
    "json",
    "csv",
    "tsv",
    "py",
    "js",
    "ts",
    "html",
    "css",
    "xml",
    "yaml",
    "yml",
    "pdf",
    "docx",
    "pptx",
    "xlsx",
]
ALLOWED_IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "bmp"]
ALLOWED_VIDEO_EXTENSIONS = ["mp4", "webm", "ogg", "mov", "avi"]
ALLOWED_AUDIO_EXTENSIONS = ["wav", "mp3", "ogg", "flac", "aac"]
ALLOWED_VRM_EXTENSIONS = {"vrm"}
ALLOWED_VRMA_EXTENSIONS = {"vrma"}
ALLOWED_GAUSS = {"ply", "spz", "splat", "ksplat", "sog"}

ANIMATION_DIR = os.path.join(DEFAULT_VRM_DIR, "animations")
GAUSS_DIR = os.path.join(DEFAULT_VRM_DIR, "scene")
BUILTIN_VRM_DIR = os.path.join(DEFAULT_VRM_DIR, "vrm")
PREFERRED_DEFAULT_VRM_NAMES = {"Eku_VRM_v1_0_0"}
PACKAGED_BUILTIN_VRM_NAMES = {"Eku_VRM_v1_0_0"}
LEGACY_DEFAULT_VRM_IDS = {"alice", "bob"}
DEFAULT_VRM_RESOURCE_BASE_URL = "https://resources.openxnet.synapxnet.com/vrm/"
CLOUD_VRM_MODEL_PATHS = """
AdashinoKan-Bankara/AdashinoKan-Bankara.vrm
AdashinoKan-Normal/AdashinoKan-Normal.vrm
AdashinoKan-Roman/AdashinoKan-Roman.vrm
aldina/aldina.vrm
aldina_naked/aldina_naked.vrm
Amiya/Amiya.vrm
Ash1.0/Ash1.0.vrm
Astarte1.0.0-A3/Astarte1.0.0-A3.vrm
Azuki_Def/Azuki_Def.vrm
Azuki_T/Azuki_T.vrm
Azuki_T_Human/Azuki_T_Human.vrm
BlueMallow_39studio/BlueMallow_39studio.vrm
BlueMallow_BoneReducedVer_39studio/BlueMallow_BoneReducedVer_39studio.vrm
BlueMallow_PerfectSync_39studio/BlueMallow_PerfectSync_39studio.vrm
calmelo-mint/calmelo-mint.vrm
calmelo-pink/calmelo-pink.vrm
calmelo-vamp/calmelo-vamp.vrm
CH_001_imiut_v1.01/CH_001_imiut_v1.01.vrm
CH_004_kei_a_v1.01/CH_004_kei_a_v1.01.vrm
CH_004_kei_b_v1.01/CH_004_kei_b_v1.01.vrm
CH_007_unkt_off_bonnet_v1_00/CH_007_unkt_off_bonnet_v1_00.vrm
CH_007_unkt_v1_00/CH_007_unkt_v1_00.vrm
CH_02_kronos_v1.03/CH_02_kronos_v1.03.vrm
Churro_v2VRM/Churro_v2VRM.vrm
Elinyaa/Elinyaa.vrm
Ichijiku_VRM_sotai/Ichijiku_VRM_sotai.vrm
Ichijiku_VRM_Type1/Ichijiku_VRM_Type1.vrm
Ichijiku_VRM_Type2/Ichijiku_VRM_Type2.vrm
IMERIS/IMERIS.vrm
Kokoa_VRM/Kokoa_VRM.vrm
kyoko/kyoko.vrm
Lazlotte/Lazlotte.vrm
Lena_ver1.02(VRM)/Lena_ver1.02(VRM).vrm
Lilium_ver1.01 (VRM)/Lilium_ver1.01 (VRM).vrm
Lilou_VRM/Lilou_VRM.vrm
Maca/Maca.vrm
Maple_1.0/Maple_1.0.vrm
Mariel/Mariel.vrm
mill_lily/mill_lily.vrm
mill_lily_2/mill_lily_2.vrm
mill_lily_CV1/mill_lily_CV1.vrm
mill_lily_CV1_2/mill_lily_CV1_2.vrm
mill_lily_CV2/mill_lily_CV2.vrm
mill_lily_CV2_2/mill_lily_CV2_2.vrm
Mira chan VRM/Mira chan VRM.vrm
Mira chan VRM one piece dress/Mira chan VRM one piece dress.vrm
miru/miru.vrm
Misty_VRM/Misty_VRM.vrm
NecoMaid_Premium/NecoMaid_Premium.vrm
necomaid_rich/necomaid_rich.vrm
Neige/Neige.vrm
NEKONA.01/NEKONA.01.vrm
nitco/nitco.vrm
P03_Temebro_forVroid_A1/P03_Temebro_forVroid_A1.vrm
P03_Temebro_forVroid_A2/P03_Temebro_forVroid_A2.vrm
P03_Temebro_forVroid_B1/P03_Temebro_forVroid_B1.vrm
P03_Temebro_forVroid_B2/P03_Temebro_forVroid_B2.vrm
P03_Temebro_forVroid_C/P03_Temebro_forVroid_C.vrm
QuQu_U/QuQu_U.vrm
Rainy_1.00/Rainy_1.00.vrm
RearAlice_1.0/RearAlice_1.0.vrm
Rilian_vrm/Rilian_vrm.vrm
RINDO_Full/RINDO_Full.vrm
RINDO_Original/RINDO_Original.vrm
Rosetta/Rosetta.vrm
Ruiko/Ruiko.vrm
Rushina_1.00_VRM/Rushina_1.00_VRM.vrm
Sephira_Nomal_2.1b/Sephira_Nomal_2.1b.vrm
Sephira_Swimwear_2.1/Sephira_Swimwear_2.1.vrm
Shaclo_Winter/Shaclo_Winter.vrm
sikirei_Rei_VRM/sikirei_Rei_VRM.vrm
Strela_VRM/Strela_VRM.vrm
syaru/syaru.vrm
type-a/type-a.vrm
Uketsukejou_1.0/Uketsukejou_1.0.vrm
VRM_KAKO_V1.03_DEFF_T/VRM_KAKO_V1.03_DEFF_T.vrm
VRM_KAKO_V1.03_USUGI_T/VRM_KAKO_V1.03_USUGI_T.vrm
Wolf_ver1.00(VRM)/Wolf_ver1.00(VRM).vrm
Wolferia/Wolferia.vrm
Yawl_Dress/Yawl_Dress.vrm
YM_CH_03_Notia_v1.01/YM_CH_03_Notia_v1.01.vrm
YM_CH_06_Shiratori_v1.00/YM_CH_06_Shiratori_v1.00.vrm
Yuu/Yuu.vrm
Yuu uwaginasi/Yuu uwaginasi.vrm
Zwei_VRM/Zwei_VRM.vrm
モナ Ver.1/モナ Ver.1.vrm
モナ Ver.2/モナ Ver.2.vrm
""".strip().splitlines()
KB_STATUS: Dict[str, str] = {}


class FileNames(BaseModel):
    fileNames: List[str]


class TextUpdate(BaseModel):
    new_text: str


class KBQueryRequest(BaseModel):
    kbId: str
    query: str
    limit: int = 5


def make_file_url(request: Request, file_path: str) -> str:
    """Convert a relative asset path into a public URL."""
    return str(request.base_url) + file_path.lstrip("/")


def scan_motion_files(directory: str, allowed_ext: set[str]) -> List[dict]:
    """Scan a motion directory and normalize it into the existing API shape."""
    files = []
    if not os.path.exists(directory):
        return files

    for filename in os.listdir(directory):
        if filename.lower().endswith(tuple(allowed_ext)):
            file_id = Path(filename).stem
            file_path = os.path.join(directory, filename)
            files.append(
                {
                    "id": file_id,
                    "name": file_id,
                    "path": file_path,
                    "type": "default" if directory == ANIMATION_DIR else "user",
                }
            )

    files.sort(key=lambda item: item["name"])
    return files


def _stable_builtin_vrm_id(relative_path: str) -> str:
    normalized = Path(relative_path).as_posix()
    slug = re.sub(r"[^a-z0-9]+", "-", normalized.lower()).strip("-")
    digest = uuid.uuid5(uuid.NAMESPACE_URL, normalized).hex[:10]
    return f"builtin-{slug or 'model'}-{digest}"


def _build_static_asset_url(request: Request, relative_path: str) -> str:
    encoded_path = "/".join(quote(part) for part in Path(relative_path).as_posix().split("/"))
    return make_file_url(request, encoded_path)


def _cloud_vrm_model_id(relative_path: str) -> str:
    normalized = Path(relative_path).as_posix()
    return f"{uuid.uuid5(uuid.NAMESPACE_URL, f'openxnet-vrm-cloud:{normalized}')}.vrm"


def _cloud_vrm_base_url() -> str:
    configured = os.environ.get("OPENXNET_VRM_RESOURCE_BASE_URL", "").strip()
    base_url = configured or DEFAULT_VRM_RESOURCE_BASE_URL
    return base_url if base_url.endswith("/") else f"{base_url}/"


def _cloud_vrm_resource_url(relative_path: str) -> str:
    encoded_path = "/".join(quote(part) for part in Path(relative_path).as_posix().split("/"))
    return urljoin(_cloud_vrm_base_url(), encoded_path)


def _cloud_vrm_download_path(model_id: str) -> str:
    return os.path.join(UPLOAD_FILES_DIR, model_id)


def _cloud_vrm_catalog_lookup() -> Dict[str, dict]:
    catalog: Dict[str, dict] = {}
    for relative_path in CLOUD_VRM_MODEL_PATHS:
        normalized = Path(relative_path).as_posix().strip("/")
        if not normalized or Path(normalized).suffix.lower() != ".vrm":
            continue
        model_id = _cloud_vrm_model_id(normalized)
        catalog[model_id] = {
            "id": model_id,
            "name": Path(normalized).stem,
            "relativePath": normalized,
            "remoteUrl": _cloud_vrm_resource_url(normalized),
        }
    return catalog


def scan_cloud_vrm_models(request: Request) -> List[dict]:
    models: List[dict] = []
    for model in _cloud_vrm_catalog_lookup().values():
        local_path = _cloud_vrm_download_path(model["id"])
        downloaded = os.path.exists(local_path)
        item = {
            **model,
            "type": "cloud",
            "source": "cloud",
            "cloud": True,
            "downloadable": True,
            "downloaded": downloaded,
            "remoteBaseUrl": _cloud_vrm_base_url(),
        }
        if downloaded:
            item["path"] = make_file_url(request, f"uploaded_files/{model['id']}")
        models.append(item)
    models.sort(key=lambda item: item["name"].lower())
    return models


def _find_cloud_vrm_model(model_id: str) -> dict | None:
    return _cloud_vrm_catalog_lookup().get(str(model_id or "").strip())


def scan_builtin_vrm_models(request: Request) -> List[dict]:
    models: List[dict] = []
    if not os.path.exists(BUILTIN_VRM_DIR):
        os.makedirs(BUILTIN_VRM_DIR, exist_ok=True)
        return models

    for root, dirnames, filenames in os.walk(BUILTIN_VRM_DIR):
        dirnames.sort(key=str.lower)
        filenames.sort(key=str.lower)
        for filename in filenames:
            if Path(filename).suffix.lower().lstrip(".") not in ALLOWED_VRM_EXTENSIONS:
                continue

            absolute_path = os.path.join(root, filename)
            relative_path = os.path.relpath(absolute_path, DEFAULT_VRM_DIR)
            display_name = Path(filename).stem
            if display_name not in PACKAGED_BUILTIN_VRM_NAMES:
                continue
            models.append(
                {
                    "id": _stable_builtin_vrm_id(relative_path),
                    "name": display_name,
                    "path": _build_static_asset_url(request, f"vrm/{relative_path}"),
                    "type": "default",
                    "source": "packaged",
                    "downloaded": True,
                    "downloadable": False,
                }
            )

    models.sort(
        key=lambda item: (
            0 if item["name"] in PREFERRED_DEFAULT_VRM_NAMES else 1,
            item["name"].lower(),
            item["path"].lower(),
        )
    )
    return models


def _known_vrm_model_ids(vrm_config: Dict[str, Any]) -> set[str]:
    known_ids: set[str] = set()
    for collection_name in ("defaultModels", "userModels"):
        for model in vrm_config.get(collection_name) or []:
            model_id = str((model or {}).get("id", "")).strip()
            if model_id:
                known_ids.add(model_id)
    return known_ids


def _first_available_vrm_model_id(vrm_config: Dict[str, Any]) -> str:
    for collection_name in ("defaultModels", "userModels"):
        for model in vrm_config.get(collection_name) or []:
            model_id = str((model or {}).get("id", "")).strip()
            if model_id:
                return model_id
    return ""


def _normalize_selected_vrm_id(selected_model_id: Any, known_ids: set[str], fallback_id: str) -> str:
    normalized_id = str(selected_model_id or "").strip()
    if normalized_id and normalized_id not in LEGACY_DEFAULT_VRM_IDS and normalized_id in known_ids:
        return normalized_id
    return fallback_id


async def remove_kb(kb_id: str) -> None:
    """Delete a knowledge-base directory tree."""
    kb_dir = os.path.join(KB_DIR, str(kb_id))
    if os.path.exists(kb_dir):
        shutil.rmtree(kb_dir)
    else:
        logger.info("KB directory %s does not exist.", kb_dir)


async def process_kb(kb_id: str) -> None:
    """Run the async knowledge-base build job and track status."""
    KB_STATUS[kb_id] = "processing"
    try:
        from py.know_base import process_knowledge_base

        await process_knowledge_base(kb_id)
        KB_STATUS[kb_id] = "completed"
    except Exception as exc:
        KB_STATUS[kb_id] = f"failed: {exc}"


def get_dir(memory_id: str) -> str:
    """Resolve one memory directory below the configured cache root."""

    normalized_id = str(memory_id or "").strip()
    if not normalized_id:
        raise HTTPException(status_code=400, detail="memory id is required")
    root = Path(MEMORY_CACHE_DIR).resolve()
    memory_directory = (root / normalized_id).resolve()
    try:
        memory_directory.relative_to(root)
    except ValueError as error:
        raise HTTPException(status_code=400, detail="invalid memory id") from error
    return str(memory_directory)


def get_faiss_path(memory_id: str) -> str:
    """Return the legacy-compatible FAISS path for one memory collection."""

    return os.path.join(get_dir(memory_id), "agent-party.faiss")


def get_pkl_path(memory_id: str) -> str:
    """Return the legacy Mem0 metadata path used for one-time migration."""

    return os.path.join(get_dir(memory_id), "agent-party.pkl")


def load_memory_store(memory_id: str) -> VectorWorkerStore:
    """Load one Worker-backed memory store and migrate legacy metadata when needed."""

    memory_directory = Path(get_dir(memory_id))
    records_path = memory_directory / "agent-party.records.json"
    if not Path(get_faiss_path(memory_id)).is_file() or not (
        records_path.is_file() or Path(get_pkl_path(memory_id)).is_file()
    ):
        raise HTTPException(status_code=404, detail="memory not found")
    return VectorWorkerStore(collection_name="agent-party", path=str(memory_directory))


def fmt_iso8605_to_local(iso_value: str) -> str:
    """Convert ISO-8601 to local server time."""
    try:
        dt = datetime.fromisoformat(iso_value)
        dt = dt.astimezone()
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return iso_value


def flatten_records(meta: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Convert insertion-ordered memory metadata to the legacy route response shape."""

    flat: List[Dict[str, Any]] = []
    for record_uuid, record in meta.items():
        flat.append(
            {
                "idx": len(flat),
                "uuid": record_uuid,
                "text": record["data"],
                "created_at": fmt_iso8605_to_local(record["created_at"]),
                "timetamp": record["timetamp"],
            }
        )
    return flat


def dict_to_list(meta: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Preserve Faiss order while transforming to a mutable list."""
    return [{record_uuid: record} for record_uuid, record in meta.items()]


def list_to_dict(meta_list: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Collapse the ordered list back into the persisted dict shape."""
    new_meta: Dict[str, Any] = {}
    for item in meta_list:
        record_uuid, record = next(iter(item.items()))
        new_meta[record_uuid] = record
    return new_meta


@router.post("/load_file")
async def load_file_endpoint(request: Request, files: List[UploadFile] = File(None)):
    fastapi_base_url = str(request.base_url)
    file_links = []
    text_files = []
    image_files = []
    vedio_files = []

    def get_file_type(ext: str) -> str:
        ext = ext.lower().lstrip(".")
        if ext in ALLOWED_IMAGE_EXTENSIONS:
            return "image"
        if ext in ALLOWED_VIDEO_EXTENSIONS:
            return "video"
        return "file"

    content_type = request.headers.get("Content-Type", "")
    try:
        if "multipart/form-data" in content_type:
            for file in files or []:
                file_extension = os.path.splitext(file.filename)[1]
                unique_filename = f"{uuid.uuid4()}{file_extension}"
                destination = os.path.join(UPLOAD_FILES_DIR, unique_filename)

                with open(destination, "wb") as buffer:
                    buffer.write(await file.read())

                current_type = get_file_type(file_extension)
                file_links.append(
                    {
                        "path": f"{fastapi_base_url}uploaded_files/{unique_filename}",
                        "name": file.filename,
                        "type": current_type,
                    }
                )

                file_meta = {"unique_filename": unique_filename, "original_filename": file.filename}
                ext_clean = file_extension[1:].lower()
                if ext_clean in ALLOWED_EXTENSIONS:
                    text_files.append(file_meta)
                elif ext_clean in ALLOWED_IMAGE_EXTENSIONS:
                    image_files.append(file_meta)
                elif ext_clean in ALLOWED_VIDEO_EXTENSIONS:
                    vedio_files.append(file_meta)

        elif "application/json" in content_type:
            data = await request.json()
            for file_info in data.get("files", []):
                file_path = file_info.get("path")
                file_name = file_info.get("name", os.path.basename(file_path))
                file_extension = os.path.splitext(file_name)[1]

                unique_filename = f"{uuid.uuid4()}{file_extension}"
                destination = os.path.join(UPLOAD_FILES_DIR, unique_filename)

                with open(file_path, "rb") as src, open(destination, "wb") as dst:
                    dst.write(src.read())

                current_type = get_file_type(file_extension)
                file_links.append(
                    {
                        "path": f"{fastapi_base_url}uploaded_files/{unique_filename}",
                        "name": file_name,
                        "type": current_type,
                    }
                )

                file_meta = {"unique_filename": unique_filename, "original_filename": file_name}
                ext_clean = file_extension[1:].lower()
                if ext_clean in ALLOWED_EXTENSIONS:
                    text_files.append(file_meta)
                elif ext_clean in ALLOWED_IMAGE_EXTENSIONS:
                    image_files.append(file_meta)
                elif ext_clean in ALLOWED_VIDEO_EXTENSIONS:
                    vedio_files.append(file_meta)

        return JSONResponse(
            content={
                "success": True,
                "fileLinks": file_links,
                "textFiles": text_files,
                "imageFiles": image_files,
                "vedioFiles": vedio_files,
            }
        )
    except Exception as exc:
        logger.error("Error processing request: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.delete("/delete_file")
async def delete_file_endpoint(request: Request):
    data = await request.json()
    file_name = data.get("fileName")
    file_path = os.path.join(UPLOAD_FILES_DIR, file_name)
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
            return JSONResponse(content={"success": True})
        return JSONResponse(content={"success": False, "message": "File not found"})
    except Exception as exc:
        return JSONResponse(content={"success": False, "message": str(exc)})


@router.delete("/delete_files")
async def delete_files_endpoint(req: FileNames):
    success_files = []
    errors = []
    for name in req.fileNames:
        path = os.path.join(UPLOAD_FILES_DIR, name)
        try:
            if os.path.exists(path):
                os.remove(path)
                success_files.append(name)
            else:
                errors.append(f"{name} not found")
        except Exception as exc:
            errors.append(f"{name}: {exc}")

    return JSONResponse(
        content={
            "success": len(success_files) > 0,
            "successFiles": success_files,
            "errors": errors,
        }
    )


@router.post("/upload_gsv_ref_audio")
async def upload_gsv_ref_audio(request: Request, file: UploadFile = File(...)):
    fastapi_base_url = str(request.base_url)
    file_extension = file.filename.split(".")[-1].lower()
    if file_extension not in ALLOWED_AUDIO_EXTENSIONS:
        return JSONResponse(
            status_code=400,
            content={"success": False, "message": f"不支持的文件类型: {file_extension}"},
        )

    unique_filename = f"{uuid.uuid4()}.{file_extension}"
    destination = os.path.join(UPLOAD_FILES_DIR, unique_filename)

    try:
        with open(destination, "wb") as buffer:
            buffer.write(await file.read())

        file_link = f"{fastapi_base_url}uploaded_files/{unique_filename}"
        return JSONResponse(
            content={
                "success": True,
                "message": "参考音频上传成功",
                "file": {
                    "path": file_link,
                    "name": file.filename,
                    "unique_filename": unique_filename,
                },
            }
        )
    except Exception as exc:
        logger.error("参考音频上传失败: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"文件保存失败: {exc}"},
        )


@router.delete("/delete_audio/{filename}")
async def delete_audio(filename: str):
    try:
        file_path = os.path.join(UPLOAD_FILES_DIR, filename)
        if not re.match(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.\w+$", filename):
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": "Invalid filename"},
            )

        if os.path.exists(file_path):
            os.remove(file_path)
            return JSONResponse(content={"success": True, "message": "音频文件已删除"})
        return JSONResponse(status_code=404, content={"success": False, "message": "文件不存在"})
    except Exception as exc:
        logger.error("删除音频失败: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"删除失败: {exc}"},
        )


@router.post("/upload_vrm_model")
async def upload_vrm_model(request: Request, file: UploadFile = File(...), display_name: str = Form(...)):
    fastapi_base_url = str(request.base_url)
    file_extension = file.filename.split(".")[-1].lower()
    if file_extension not in ALLOWED_VRM_EXTENSIONS:
        return JSONResponse(
            status_code=400,
            content={"success": False, "message": f"不支持的文件类型: {file_extension}，只支持.vrm文件"},
        )

    unique_filename = f"{uuid.uuid4()}.{file_extension}"
    destination = os.path.join(UPLOAD_FILES_DIR, unique_filename)

    try:
        with open(destination, "wb") as buffer:
            buffer.write(await file.read())

        file_link = f"{fastapi_base_url}uploaded_files/{unique_filename}"
        return JSONResponse(
            content={
                "success": True,
                "message": "VRM模型上传成功",
                "file": {
                    "path": file_link,
                    "display_name": display_name,
                    "original_name": file.filename,
                    "unique_filename": unique_filename,
                },
            }
        )
    except Exception as exc:
        logger.error("VRM模型上传失败: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"文件保存失败: {exc}"},
        )


@router.get("/get_default_vrm_models")
async def get_default_vrm_models(request: Request):
    try:
        models = scan_builtin_vrm_models(request)
        cloud_models = scan_cloud_vrm_models(request)
        return JSONResponse(
            content={
                "success": True,
                "models": models,
                "cloudModels": cloud_models,
                "remoteBaseUrl": _cloud_vrm_base_url(),
            }
        )
    except Exception as exc:
        logger.error("获取默认VRM模型失败: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"获取默认模型失败: {exc}"},
        )


@router.post("/download_vrm_model/{model_id}")
async def download_vrm_model(request: Request, model_id: str):
    model = _find_cloud_vrm_model(model_id)
    if not model:
        return JSONResponse(
            status_code=404,
            content={"success": False, "message": "未找到可下载的 VRM 模型"},
        )

    os.makedirs(UPLOAD_FILES_DIR, exist_ok=True)
    destination = _cloud_vrm_download_path(model["id"])
    tmp_destination = f"{destination}.downloading"

    try:
        if not os.path.exists(destination):
            timeout = httpx.Timeout(connect=15.0, read=None, write=30.0, pool=30.0)
            async with httpx.AsyncClient(timeout=timeout, follow_redirects=True, trust_env=False) as client:
                async with client.stream("GET", model["remoteUrl"]) as response:
                    if response.status_code != 200:
                        raise HTTPException(
                            status_code=502,
                            detail=(
                                f"远程资源下载失败: HTTP {response.status_code}，"
                                "请确认 COS bucket、地域、权限和对象路径已配置正确"
                            ),
                        )
                    async with aiofiles.open(tmp_destination, "wb") as output:
                        async for chunk in response.aiter_bytes(1024 * 256):
                            if chunk:
                                await output.write(chunk)
            os.replace(tmp_destination, destination)

        file_link = make_file_url(request, f"uploaded_files/{model['id']}")
        settings = await load_settings()
        vrm_settings = dict(settings.get("VRMConfig", {}) or {})
        user_models = list(vrm_settings.get("userModels") or [])
        model_option = {
            "id": model["id"],
            "name": model["name"],
            "path": file_link,
            "type": "user",
            "source": "cloud",
            "cloud": True,
            "downloaded": True,
            "relativePath": model["relativePath"],
            "remoteUrl": model["remoteUrl"],
        }

        replaced = False
        for index, item in enumerate(user_models):
            if str((item or {}).get("id", "")) == model["id"]:
                user_models[index] = {**(item or {}), **model_option}
                replaced = True
                break
        if not replaced:
            user_models.append(model_option)

        vrm_settings["userModels"] = user_models
        vrm_settings["selectedModelId"] = model["id"]
        vrm_settings["selectedNewModelId"] = model["id"]
        vrm_settings.setdefault("name", "default")
        settings["VRMConfig"] = vrm_settings
        await save_settings(settings)

        return JSONResponse(
            content={
                "success": True,
                "message": "VRM 模型已下载",
                "model": model_option,
            }
        )
    except HTTPException as exc:
        if os.path.exists(tmp_destination):
            try:
                os.remove(tmp_destination)
            except Exception:
                pass
        return JSONResponse(
            status_code=exc.status_code,
            content={"success": False, "message": str(exc.detail)},
        )
    except Exception as exc:
        if os.path.exists(tmp_destination):
            try:
                os.remove(tmp_destination)
            except Exception:
                pass
        logger.error("下载 VRM 模型失败: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"下载失败: {exc}"},
        )


@router.delete("/delete_vrm_model/{filename}")
async def delete_vrm_model(filename: str):
    try:
        file_path = os.path.join(UPLOAD_FILES_DIR, filename)
        abs_upload = os.path.abspath(UPLOAD_FILES_DIR)
        abs_file = os.path.abspath(file_path)
        if not re.match(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.vrm$", filename):
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": "Invalid filename"},
            )
        if not abs_file.startswith(abs_upload):
            return JSONResponse(
                status_code=403,
                content={"success": False, "message": "Cannot delete default models"},
            )
        if os.path.exists(file_path):
            os.remove(file_path)
            return JSONResponse(content={"success": True, "message": "VRM模型文件已删除"})
        return JSONResponse(status_code=404, content={"success": False, "message": "文件不存在"})
    except Exception as exc:
        logger.error("删除VRM模型失败: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"删除失败: {exc}"},
        )


@router.get("/get_default_vrma_motions")
async def get_default_vrma_motions(request: Request):
    try:
        motions = scan_motion_files(ANIMATION_DIR, ALLOWED_VRMA_EXTENSIONS)
        for motion in motions:
            file_name = os.path.basename(motion["path"])
            motion["path"] = str(request.base_url) + f"vrm/animations/{file_name}"
        return {"success": True, "motions": motions}
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"获取默认动作失败: {exc}"},
        )


@router.get("/get_user_vrma_motions")
async def get_user_vrma_motions(request: Request):
    try:
        motions = scan_motion_files(UPLOAD_FILES_DIR, ALLOWED_VRMA_EXTENSIONS)
        for motion in motions:
            file_name = os.path.basename(motion["path"])
            motion["path"] = str(request.base_url) + f"uploaded_files/{file_name}"
        return {"success": True, "motions": motions}
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"获取用户动作失败: {exc}"},
        )


@router.post("/upload_vrma_motion")
async def upload_vrma_motion(request: Request, file: UploadFile = File(...), display_name: str = Form(...)):
    file_extension = Path(file.filename).suffix.lower().lstrip(".")
    if file_extension not in ALLOWED_VRMA_EXTENSIONS:
        return JSONResponse(
            status_code=400,
            content={"success": False, "message": f"不支持的文件类型: {file_extension}"},
        )

    unique_filename = f"{uuid.uuid4()}.vrma"
    destination = os.path.join(UPLOAD_FILES_DIR, unique_filename)

    try:
        os.makedirs(UPLOAD_FILES_DIR, exist_ok=True)
        with open(destination, "wb") as buffer:
            buffer.write(await file.read())

        file_url = make_file_url(request, f"uploaded_files/{unique_filename}")
        return JSONResponse(
            content={
                "success": True,
                "message": "动作上传成功",
                "file": {
                    "unique_filename": unique_filename,
                    "display_name": display_name,
                    "path": file_url,
                },
            }
        )
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"保存文件失败: {exc}"},
        )


@router.delete("/delete_vrma_motion/{filename}")
async def delete_vrma_motion(filename: str):
    try:
        if not re.match(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.vrma$", filename):
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": "Invalid filename"},
            )

        file_path = os.path.join(UPLOAD_FILES_DIR, filename)
        abs_upload = os.path.abspath(UPLOAD_FILES_DIR)
        abs_file = os.path.abspath(file_path)
        if not abs_file.startswith(abs_upload):
            return JSONResponse(
                status_code=403,
                content={"success": False, "message": "禁止删除系统文件"},
            )

        if os.path.exists(file_path):
            os.remove(file_path)
            return {"success": True, "message": "动作文件已删除"}
        return JSONResponse(status_code=404, content={"success": False, "message": "文件不存在"})
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"删除失败: {exc}"},
        )


@router.post("/upload_gauss_scene")
async def upload_gauss_scene(request: Request, file: UploadFile = File(...), display_name: str = Form(...)):
    ext = Path(file.filename).suffix.lower().lstrip(".")
    if ext not in ALLOWED_GAUSS:
        return JSONResponse(status_code=400, content={"success": False, "message": f"不支持的文件类型: {ext}"})

    unique_filename = f"{uuid.uuid4()}.{ext}"
    destination = os.path.join(UPLOAD_FILES_DIR, unique_filename)
    try:
        os.makedirs(UPLOAD_FILES_DIR, exist_ok=True)
        with open(destination, "wb") as handle:
            handle.write(await file.read())
        url = str(request.base_url) + f"uploaded_files/{unique_filename}"
        return JSONResponse(
            content={
                "success": True,
                "file": {
                    "unique_filename": unique_filename,
                    "display_name": display_name,
                    "path": url,
                },
            }
        )
    except Exception as exc:
        return JSONResponse(status_code=500, content={"success": False, "message": str(exc)})


@router.get("/get_default_gauss_scenes")
async def get_default_gauss_scenes(request: Request):
    try:
        os.makedirs(GAUSS_DIR, exist_ok=True)
        scenes = []
        for filename in os.listdir(GAUSS_DIR):
            ext = Path(filename).suffix.lower().lstrip(".")
            if ext in ALLOWED_GAUSS:
                scenes.append(
                    {
                        "id": Path(filename).stem,
                        "name": Path(filename).stem,
                        "path": str(request.base_url) + f"vrm/scene/{filename}",
                        "type": "default",
                    }
                )
        scenes.sort(key=lambda item: item["name"])
        return {"success": True, "scenes": scenes}
    except Exception as exc:
        return JSONResponse(status_code=500, content={"success": False, "message": str(exc)})


@router.get("/get_user_gauss_scenes")
async def get_user_gauss_scenes(request: Request):
    try:
        scenes = []
        for filename in os.listdir(UPLOAD_FILES_DIR):
            ext = Path(filename).suffix.lower().lstrip(".")
            if ext in ALLOWED_GAUSS:
                scenes.append(
                    {
                        "id": Path(filename).stem,
                        "name": Path(filename).stem,
                        "path": str(request.base_url) + f"uploaded_files/{filename}",
                        "type": "user",
                    }
                )
        scenes.sort(key=lambda item: item["name"])
        return {"success": True, "scenes": scenes}
    except Exception as exc:
        return JSONResponse(status_code=500, content={"success": False, "message": str(exc)})


@router.delete("/delete_gauss_scene/{filename}")
async def delete_gauss_scene(filename: str):
    if not re.match(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(ply|spz|splat|ksplat|sog)$", filename):
        return JSONResponse(status_code=400, content={"success": False, "message": "Invalid filename"})

    file_path = os.path.join(UPLOAD_FILES_DIR, filename)
    if os.path.exists(file_path):
        os.remove(file_path)
        return {"success": True, "message": "场景已删除"}
    return JSONResponse(status_code=404, content={"success": False, "message": "文件不存在"})


@router.get("/update_storage")
async def update_storage_endpoint():
    settings = await load_settings()
    text_files = settings.get("textFiles") or []
    image_files = settings.get("imageFiles") or []
    video_files = settings.get("videoFiles") or []

    for filename in os.listdir(UPLOAD_FILES_DIR):
        file_path = os.path.join(UPLOAD_FILES_DIR, filename)
        if not os.path.isfile(file_path):
            continue
        file_extension = os.path.splitext(filename)[1][1:]
        if file_extension in ALLOWED_EXTENSIONS:
            if filename not in [item["unique_filename"] for item in text_files]:
                text_files.append({"unique_filename": filename, "original_filename": filename})
        elif file_extension in ALLOWED_IMAGE_EXTENSIONS:
            if filename not in [item["unique_filename"] for item in image_files]:
                image_files.append({"unique_filename": filename, "original_filename": filename})
        elif file_extension in ALLOWED_VIDEO_EXTENSIONS:
            if filename not in [item["unique_filename"] for item in video_files]:
                video_files.append({"unique_filename": filename, "original_filename": filename})

    return JSONResponse(content={"textFiles": text_files, "imageFiles": image_files, "videoFiles": video_files})


@router.get("/get_file_content")
async def get_file_content_endpoint(file_url: str):
    file_path = os.path.join(UPLOAD_FILES_DIR, file_url)
    content = await get_file_content(file_path)
    return JSONResponse(content={"content": content})


@router.post("/create_kb")
async def create_kb_endpoint(request: Request, background_tasks: BackgroundTasks):
    data = await request.json()
    kb_id = data.get("kbId")
    if not kb_id:
        raise HTTPException(status_code=400, detail="Missing kbId")

    background_tasks.add_task(process_kb, kb_id)
    return {"success": True, "message": "知识库处理已开始，请稍后查询状态"}


@router.delete("/remove_kb")
async def remove_kb_endpoint(request: Request, background_tasks: BackgroundTasks):
    data = await request.json()
    kb_id = data.get("kbId")
    if not kb_id:
        raise HTTPException(status_code=400, detail="Missing kbId")

    try:
        background_tasks.add_task(remove_kb, kb_id)
    except Exception as exc:
        return {"success": False, "message": str(exc)}
    return {"success": True, "message": "知识库已删除"}


@router.get("/kb_status/{kb_id}")
async def get_kb_status(kb_id: str):
    status = KB_STATUS.get(kb_id, "not_found")
    logger.info("kb_status: %s - %s", kb_id, status)
    return {"kb_id": kb_id, "status": status}


@router.post("/query_kb")
async def query_kb_endpoint(payload: KBQueryRequest):
    kb_id = str(payload.kbId or "").strip()
    query = str(payload.query or "").strip()
    limit = max(1, min(int(payload.limit or 5), 20))
    if not kb_id:
      raise HTTPException(status_code=400, detail="Missing kbId")
    if not query:
      raise HTTPException(status_code=400, detail="Missing query")

    from py.know_base import query_knowledge_base, rerank_knowledge_base

    results = await query_knowledge_base(kb_id, query)
    if isinstance(results, str):
        raise HTTPException(status_code=400, detail=results)

    settings = await load_settings()
    kb_settings = settings.get("KBSettings", {}) if isinstance(settings, dict) else {}
    if kb_settings.get("is_rerank"):
        try:
            results = await rerank_knowledge_base(query, results)
        except Exception as exc:
            logger.warning("Rerank knowledge base failed: %s", exc)

    normalized_results = []
    for index, item in enumerate((results or [])[:limit]):
        metadata = item.get("metadata", {}) if isinstance(item, dict) else {}
        content = str(item.get("content", "") if isinstance(item, dict) else "")
        summary = re.sub(r"\s+", " ", content).strip()
        normalized_results.append(
            {
                "id": f"{kb_id}:{index}",
                "content": content,
                "summary": summary[:360] + ("..." if len(summary) > 360 else ""),
                "metadata": metadata,
                "file_name": str(metadata.get("file_name", "")),
                "file_path": str(metadata.get("file_path", "")),
            }
        )

    return {
        "success": True,
        "kbId": kb_id,
        "query": query,
        "count": len(normalized_results),
        "results": normalized_results,
    }


@router.post("/create_sticker_pack")
async def create_sticker_pack(
    request: Request,
    files: List[UploadFile] = File(..., description="表情文件列表"),
    pack_name: str = Form(..., description="表情包名称"),
    descriptions: List[str] = Form(..., description="表情描述列表"),
):
    fastapi_base_url = str(request.base_url)
    image_files = []
    stickers_data = []

    try:
        if not pack_name:
            raise HTTPException(status_code=400, detail="表情包名称不能为空")
        if len(files) == 0:
            raise HTTPException(status_code=400, detail="至少需要上传一个表情")
        if len(descriptions) != len(files):
            raise HTTPException(
                status_code=400,
                detail=f"描述数量({len(descriptions)})与文件数量({len(files)})不匹配",
            )

        for idx, file in enumerate(files):
            file_extension = os.path.splitext(file.filename)[1].lower()
            if file_extension not in [".png", ".jpg", ".jpeg", ".gif", ".webp"]:
                raise HTTPException(status_code=400, detail=f"不支持的文件类型: {file_extension}")

            unique_filename = f"{uuid.uuid4()}{file_extension}"
            destination = os.path.join(UPLOAD_FILES_DIR, unique_filename)
            with open(destination, "wb") as buffer:
                buffer.write(await file.read())

            image_files.append({"unique_filename": unique_filename, "original_filename": file.filename})
            description = descriptions[idx] if idx < len(descriptions) else ""
            stickers_data.append(
                {
                    "unique_filename": unique_filename,
                    "original_filename": file.filename,
                    "url": f"{fastapi_base_url}uploaded_files/{unique_filename}",
                    "description": description,
                }
            )

        sticker_pack_id = str(uuid.uuid4())
        return JSONResponse(
            content={
                "success": True,
                "id": sticker_pack_id,
                "name": pack_name,
                "stickers": stickers_data,
                "imageFiles": image_files,
                "cover": stickers_data[0]["url"] if stickers_data else None,
            }
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("创建表情包时出错: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"服务器错误: {exc}")


@router.post("/add_workflow")
async def add_workflow(file: UploadFile = File(...), workflow_data: str = Form(...)):
    if file.content_type != "application/json":
        raise HTTPException(status_code=400, detail="Only JSON files are allowed.")

    unique_filename = str(uuid.uuid4()).replace("-", "")
    file_path = os.path.join(UPLOAD_FILES_DIR, unique_filename + ".json")
    try:
        with open(file_path, "wb") as buffer:
            buffer.write(await file.read())
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {exc}") from exc

    workflow_data_dict = json.loads(workflow_data)
    return JSONResponse(
        status_code=200,
        content={
            "success": True,
            "message": "File uploaded successfully",
            "file": {
                "unique_filename": unique_filename,
                "original_filename": file.filename,
                "url": f"/uploaded_files/{unique_filename}",
                "enabled": True,
                "text_input": workflow_data_dict.get("textInput"),
                "text_input_2": workflow_data_dict.get("textInput2"),
                "image_input": workflow_data_dict.get("imageInput"),
                "image_input_2": workflow_data_dict.get("imageInput2"),
                "seed_input": workflow_data_dict.get("seedInput"),
                "seed_input2": workflow_data_dict.get("seedInput2"),
                "description": workflow_data_dict.get("description"),
            },
        },
    )


@router.delete("/delete_workflow/{filename}")
async def delete_workflow(filename: str):
    file_path = os.path.join(UPLOAD_FILES_DIR, filename + ".json")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    try:
        os.remove(file_path)
        return JSONResponse(status_code=200, content={"success": True, "message": "File deleted successfully"})
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {exc}") from exc


@router.get("/vrm_config")
async def vrm_config(request: Request):
    settings = await load_settings()
    vrm_config = dict(settings.get("VRMConfig", {}) or {})
    vrm_config["defaultModels"] = scan_builtin_vrm_models(request)
    vrm_config["cloudModels"] = scan_cloud_vrm_models(request)
    vrm_config["remoteResourceBaseUrl"] = _cloud_vrm_base_url()

    known_ids = _known_vrm_model_ids(vrm_config)
    fallback_id = _first_available_vrm_model_id(vrm_config)
    vrm_config["selectedModelId"] = _normalize_selected_vrm_id(
        vrm_config.get("selectedModelId"),
        known_ids,
        fallback_id,
    )
    vrm_config["selectedNewModelId"] = _normalize_selected_vrm_id(
        vrm_config.get("selectedNewModelId"),
        known_ids,
        vrm_config["selectedModelId"],
    )

    new_vrm = vrm_config.get("newVRM")
    if isinstance(new_vrm, dict):
        for appearance in new_vrm.values():
            if isinstance(appearance, dict):
                appearance["selectedModelId"] = _normalize_selected_vrm_id(
                    appearance.get("selectedModelId"),
                    known_ids,
                    vrm_config["selectedModelId"],
                )

    return {"VRMConfig": vrm_config}


@router.get("/memory/{memory_id}")
async def read_memory(memory_id: str) -> List[Dict[str, Any]]:
    """Return memory records without loading FAISS in the backend process."""

    return flatten_records(load_memory_store(memory_id).export_records())


@router.put("/memory/{memory_id}/{idx}")
async def update_text(memory_id: str, idx: int, body: TextUpdate = Body(...)) -> dict:
    """Update one memory payload while preserving its existing vector."""

    store = load_memory_store(memory_id)
    meta_dict = store.export_records()
    meta_list = dict_to_list(meta_dict)
    if not (0 <= idx < len(meta_list)):
        raise HTTPException(status_code=404, detail="index out of range")

    record_uuid, record = next(iter(meta_list[idx].items()))
    record["data"] = body.new_text
    await asyncio.to_thread(store.update, record_uuid, payload=record)
    return {"message": "updated", "idx": idx}


@router.delete("/memory/{memory_id}/{idx}")
async def delete_text(memory_id: str, idx: int) -> dict:
    """Delete one memory record and its Worker-owned positional vector."""

    store = load_memory_store(memory_id)
    meta_dict = store.export_records()
    meta_list = dict_to_list(meta_dict)
    if not (0 <= idx < len(meta_list)):
        raise HTTPException(status_code=404, detail="index out of range")

    record_uuid, _record = next(iter(meta_list[idx].items()))
    await asyncio.to_thread(store.delete, record_uuid)
    return {"message": "deleted", "idx": idx}


@router.get("/api/get_userfile")
async def get_userfile():
    try:
        return {"message": "Userfile loaded successfully", "userfile": USER_DATA_DIR, "success": True}
    except Exception as exc:
        return {"message": str(exc), "success": False}


@router.get("/api/get_extfile")
async def get_extfile():
    try:
        return {"message": "Extfile loaded successfully", "extfile": EXT_DIR, "success": True}
    except Exception as exc:
        return {"message": str(exc), "success": False}
