#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright 2026 Synapxnet
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
# ==============================================================================
"""
图片托管 — 图片上传至图床并获取 URL。

Author: maoyo
Date: 2026-04-13
Version: 1.0.0
"""

__version__ = "1.0.0"
__author__ = "maoyo"
__copyright__ = "Copyright 2026 Synapxnet"
__license__ = "Apache-2.0"
__maintainer__ = "maoyo"
__email__ = "synapxnet@gmail.com"

import asyncio
import logging
import os
import tempfile
from typing import Any, Dict, Optional

import requests
from py.get_setting import UPLOAD_FILES_DIR, load_settings


SMMS_UPLOAD_URL = "https://sm.ms/api/v2/upload"
MAX_IMAGE_HOST_DOWNLOAD_BYTES = 25 * 1024 * 1024
IMAGE_HOST_REQUEST_TIMEOUT_SECONDS = 30


async def upload_image_host(url: str) -> str:
    """Upload one local or remote image when image hosting is enabled."""

    settings = await load_settings()
    configuration = settings.get("BotConfig", {})
    if not isinstance(configuration, dict) or not configuration.get("imgHost_enabled"):
        return url

    if "uploaded_files" in url:
        file_name = url.split("/")[-1]
        file_path = os.path.join(UPLOAD_FILES_DIR, file_name)
        return await _upload_file(settings, file_path, cleanup_after=False)

    temporary_path: Optional[str] = None
    try:
        temporary_path = await asyncio.to_thread(_download_external_image, url)
        if temporary_path is None:
            return url
        return await _upload_file(settings, temporary_path, cleanup_after=True)
    except Exception as error:
        logging.error("External image hosting failed: %s", type(error).__name__)
        if temporary_path and os.path.exists(temporary_path):
            _remove_temporary_file(temporary_path)
        return url


def _download_external_image(url: str) -> Optional[str]:
    """Download one bounded remote image into the application upload directory."""

    response = None
    temporary_path: Optional[str] = None
    try:
        response = requests.get(url, stream=True, timeout=10)
        if response.status_code != 200:
            logging.error("External image download rejected with status %s", response.status_code)
            return None
        content_type = str(response.headers.get("Content-Type", "")).split(";", 1)[0].lower()
        extension = {
            "image/jpeg": ".jpg",
            "image/png": ".png",
            "image/gif": ".gif",
            "image/webp": ".webp",
            "image/svg+xml": ".svg",
        }.get(content_type)
        if extension is None:
            logging.error("External image download returned an unsupported content type")
            return None
        declared_length = int(response.headers.get("Content-Length", "0") or 0)
        if declared_length > MAX_IMAGE_HOST_DOWNLOAD_BYTES:
            logging.error("External image download exceeds the size budget")
            return None
        os.makedirs(UPLOAD_FILES_DIR, exist_ok=True)
        total_bytes = 0
        with tempfile.NamedTemporaryFile(
            suffix=extension,
            dir=UPLOAD_FILES_DIR,
            delete=False,
        ) as temporary_file:
            temporary_path = temporary_file.name
            for chunk in response.iter_content(chunk_size=8192):
                if not chunk:
                    continue
                total_bytes += len(chunk)
                if total_bytes > MAX_IMAGE_HOST_DOWNLOAD_BYTES:
                    raise ValueError("External image download exceeds the size budget.")
                temporary_file.write(chunk)
        return temporary_path
    except Exception as error:
        logging.error("External image download failed: %s", type(error).__name__)
        if temporary_path and os.path.exists(temporary_path):
            _remove_temporary_file(temporary_path)
        return None
    finally:
        if response is not None:
            response.close()


async def _upload_file(
    settings: Dict[str, Any],
    file_path: str,
    *,
    cleanup_after: bool,
) -> str:
    """Upload one validated file through the selected image-host provider."""

    if not os.path.exists(file_path):
        logging.error("Image-host upload source is unavailable")
        return "图床上传文件不可用"
    configuration = settings.get("BotConfig", {})
    if not isinstance(configuration, dict):
        return "图床配置无效"
    provider = str(configuration.get("imgHost", "")).strip().lower()
    try:
        if provider == "smms":
            return await asyncio.to_thread(_upload_smms, configuration, file_path)
        if provider in {"ei2", "easyimage2"}:
            return await asyncio.to_thread(_upload_easy_image, configuration, file_path)
        logging.warning("Unsupported image-host provider")
        return "图床服务商不受支持"
    except Exception as error:
        logging.error("Image-host upload failed: %s", type(error).__name__)
        return "图床上传失败"
    finally:
        if cleanup_after and os.path.exists(file_path):
            _remove_temporary_file(file_path)


def _upload_smms(configuration: Dict[str, Any], file_path: str) -> str:
    """Upload one image to SM.MS without exposing its API credential."""

    credential = str(configuration.get("SMMS_api_key", "") or "").strip()
    if not credential:
        return "SM.MS 图床凭据未配置"
    with open(file_path, "rb") as source:
        response = requests.post(
            SMMS_UPLOAD_URL,
            headers={"Authorization": credential},
            files={"smfile": (os.path.basename(file_path), source)},
            timeout=IMAGE_HOST_REQUEST_TIMEOUT_SECONDS,
        )
    if response.status_code != 200:
        logging.error("SM.MS upload rejected with status %s", response.status_code)
        return "SM.MS 图床上传失败"
    payload = response.json()
    image_url = payload.get("data", {}).get("url") if isinstance(payload, dict) else None
    if not isinstance(image_url, str) or not image_url.startswith(("http://", "https://")):
        return "SM.MS 图床返回无效"
    return image_url


def _upload_easy_image(configuration: Dict[str, Any], file_path: str) -> str:
    """Upload one image to an EasyImage 2 endpoint with its scoped token."""

    endpoint = str(configuration.get("EI2_base_url", "") or "").strip()
    credential = str(configuration.get("EI2_api_key", "") or "").strip()
    if not endpoint or not credential:
        return "EasyImage 图床配置不完整"
    with open(file_path, "rb") as source:
        response = requests.post(
            endpoint,
            data={"token": credential},
            files={"image": (os.path.basename(file_path), source)},
            timeout=IMAGE_HOST_REQUEST_TIMEOUT_SECONDS,
        )
    if response.status_code != 200:
        logging.error("EasyImage upload rejected with status %s", response.status_code)
        return "EasyImage 图床上传失败"
    payload = response.json()
    image_url = payload.get("url") if isinstance(payload, dict) else None
    if not isinstance(image_url, str) or not image_url.startswith(("http://", "https://")):
        return "EasyImage 图床返回无效"
    return image_url


def _remove_temporary_file(file_path: str) -> None:
    """Remove one application-created temporary image without logging its path."""

    try:
        os.remove(file_path)
    except Exception as error:
        logging.error("Image-host temporary cleanup failed: %s", type(error).__name__)
