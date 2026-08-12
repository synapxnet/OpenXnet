#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations

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
YTDM — YouTube/Bilibili 视频下载工具。

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

# py/ytdm.py
from collections.abc import Callable, Mapping
import json
import logging
import threading
import uuid
from typing import Any, Optional
from urllib import error as urllib_error
from urllib import parse as urllib_parse
from urllib import request as urllib_request


YOUTUBE_DATA_API_ORIGIN = "https://www.googleapis.com/youtube/v3"


class YouTubeApiError(RuntimeError):
    """YouTube Data API failure that never includes credentials in its message."""


def _load_json_url(url: str, timeout_seconds: float) -> Mapping[str, Any]:
    """Load one YouTube JSON object while converting transport errors safely."""

    request = urllib_request.Request(
        url,
        headers={"Accept": "application/json", "User-Agent": "OpenXnet/1.0"},
        method="GET",
    )
    try:
        with urllib_request.urlopen(request, timeout=timeout_seconds) as response:
            value = json.loads(response.read().decode("utf-8"))
    except urllib_error.HTTPError as error:
        raise YouTubeApiError(f"YouTube API request failed with HTTP {error.code}.") from error
    except (OSError, urllib_error.URLError) as error:
        raise YouTubeApiError("YouTube API connection failed.") from error
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        raise YouTubeApiError("YouTube API returned invalid UTF-8 JSON.") from error
    if not isinstance(value, Mapping):
        raise YouTubeApiError("YouTube API response must be a JSON object.")
    return value

class YouTubeDMClient:
    """
    极简轮询客户端
    用法：client = YouTubeDMClient(api_key, video_id, on_message)
          client.start()   # 非阻塞，内部启动线程
          ...
          client.stop()    # 线程安全退出
    """
    def __init__(
        self,
        api_key: str,
        video_id: str,
        on_message: Callable[[dict[str, Any]], None],
        poll_interval: int = 5,
        *,
        request_timeout: float = 15.0,
        api_origin: str = YOUTUBE_DATA_API_ORIGIN,
        json_transport: Callable[[str, float], Mapping[str, Any]] | None = None,
    ):
        """Create a non-blocking live-chat poller using YouTube REST endpoints."""

        self.api_key = api_key
        self.video_id = video_id
        self.on_message = on_message
        self.poll_interval = max(1, int(poll_interval))
        self.request_timeout = max(1.0, float(request_timeout))
        self.api_origin = api_origin.rstrip("/")
        self._json_transport = json_transport or _load_json_url

        self._chat_id: Optional[str] = None
        self._page_token: Optional[str] = None
        self._stop_evt = threading.Event()
        self._thread: Optional[threading.Thread] = None

    # --------- 外部调用 ---------
    def start(self) -> None:
        """Start the polling thread without blocking the caller."""

        if self._thread and self._thread.is_alive():
            return
        self._stop_evt.clear()
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        """Request thread-safe shutdown and wait for one polling interval."""

        self._stop_evt.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=self.poll_interval + 1)

    # --------- 内部轮询 ---------
    def _run(self) -> None:
        """Resolve the active chat and poll until shutdown is requested."""

        self._chat_id = self._get_live_chat_id()
        if not self._chat_id:
            logging.info("YouTube live chat is not active")
            return

        while not self._stop_evt.is_set():
            try:
                self._poll_once()
            except Exception as error:
                logging.error("YouTube live-chat polling failed: %s", type(error).__name__)
            self._stop_evt.wait(self.poll_interval)

    def _get_live_chat_id(self) -> Optional[str]:
        """Return the active live-chat identifier for the configured video."""

        response = self._request_resource(
            "videos",
            {"id": self.video_id, "part": "liveStreamingDetails"},
        )
        items = response.get("items")
        if not isinstance(items, list) or not items:
            return None
        first_item = items[0]
        if not isinstance(first_item, Mapping):
            return None
        details = first_item.get("liveStreamingDetails")
        if not isinstance(details, Mapping):
            return None
        chat_id = details.get("activeLiveChatId")
        return str(chat_id) if chat_id else None

    def _poll_once(self) -> None:
        """Fetch one live-chat page and emit normalized callback messages."""

        if not self._chat_id:
            return
        parameters: dict[str, Any] = {
            "liveChatId": self._chat_id,
            "part": "snippet,authorDetails",
            "maxResults": 2000,
        }
        if self._page_token:
            parameters["pageToken"] = self._page_token
        response = self._request_resource("liveChat/messages", parameters)

        items = response.get("items", [])
        if not isinstance(items, list):
            raise YouTubeApiError("YouTube live-chat response field 'items' must be an array.")
        for item in items:
            if not isinstance(item, Mapping):
                continue
            author_details = item.get("authorDetails")
            snippet = item.get("snippet")
            if not isinstance(author_details, Mapping) or not isinstance(snippet, Mapping):
                continue
            author = str(author_details.get("displayName") or "")
            text = str(snippet.get("displayMessage") or "")
            msg = {
                'id': str(uuid.uuid4()),
                "type": "message",
                "content": f"{author} said: {text}",
                "danmu_type": "danmaku",
                "platform": "youtube"
            }
            self.on_message(msg)

        next_token = response.get("nextPageToken")
        self._page_token = str(next_token) if next_token else None

    def _request_resource(
        self,
        resource: str,
        parameters: Mapping[str, Any],
    ) -> Mapping[str, Any]:
        """Request one allow-listed YouTube API resource with encoded parameters."""

        if resource not in {"videos", "liveChat/messages"}:
            raise ValueError(f"Unsupported YouTube API resource '{resource}'.")
        query = urllib_parse.urlencode({**dict(parameters), "key": self.api_key})
        url = f"{self.api_origin}/{resource}?{query}"
        return self._json_transport(url, self.request_timeout)
