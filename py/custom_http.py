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
自定义 HTTP 工具 — 用户自定义 HTTP 请求工具。

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

import aiohttp
import json

# 安全解析 JSON 的函数（用于 headers 是字符串的情况）
def safe_json_loads(s):
    """Parse a JSON object without exposing malformed input details."""

    try:
        return json.loads(s)
    except (json.JSONDecodeError, TypeError):
        return {}

async def fetch_custom_http(method, url, headers=None, body=None):
    """Execute one custom HTTP request without logging credentials or response bodies."""

    # 处理 headers
    if headers is None or headers == "":
        headers = {}
    elif isinstance(headers, str):
        headers = safe_json_loads(headers)

    # 自动处理 Content-Type，默认为 application/json
    content_type = headers.get('Content-Type', 'application/json')

    # 准备参数
    kwargs = {
        'headers': headers,
    }

    # 根据 Content-Type 决定使用 data 还是 json
    if content_type == 'application/json':
        kwargs['json'] = body
    else:
        kwargs['data'] = body

    try:
        async with aiohttp.ClientSession() as session:
            async with session.request(method, url, **kwargs) as response:
                print(f'Status: {response.status}')
                response_text = await response.text()
                return response_text
    except Exception as e:
        print(f'Custom HTTP request failed: {type(e).__name__}')
        return 'Custom HTTP request failed'
