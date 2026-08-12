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
Web Search — 多搜索引擎聚合搜索工具。

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
import ipaddress
import json
import os
import time
from urllib.parse import urlsplit
from bs4 import BeautifulSoup
import requests
from py.get_setting import load_settings
from py.load_files import check_robots_txt
try:
    from ddgs import DDGS
except ImportError:
    DDGS = None
try:
    from tavily import TavilyClient
except ImportError:
    TavilyClient = None


def _log_search_failure(context, error):
    """Log only one exception class so vendor credentials cannot enter logs."""

    error_name = type(error).__name__ or "SearchError"
    print(f"{context}: {error_name}")


MAX_DIRECT_SEARCH_RESPONSE_BYTES = 4 * 1024 * 1024
BING_SEARCH_URL = "https://api.bing.microsoft.com/v7.0/search"
BRAVE_SEARCH_URL = "https://api.search.brave.com/res/v1/web/search"
EXA_SEARCH_URL = "https://api.exa.ai/search"
SERPER_SEARCH_URL = "https://google.serper.dev/search"


def _normalize_search_limit(value, maximum=100):
    """规范搜索结果数量；输入未知值和上限，返回 1 至上限的整数，无副作用。"""

    try:
        return max(1, min(int(value), int(maximum)))
    except (TypeError, ValueError):
        return min(10, int(maximum))


def _read_direct_search_json(response, provider):
    """读取直接搜索响应；输入 HTTP 响应和供应商名，返回 JSON 对象，状态、体积或结构无效时抛出固定异常。"""

    response.raise_for_status()
    content = bytes(getattr(response, "content", b"") or b"")
    if len(content) > MAX_DIRECT_SEARCH_RESPONSE_BYTES:
        raise RuntimeError(f"{provider} search response exceeds the size limit.")
    payload = response.json()
    if not isinstance(payload, dict):
        raise RuntimeError(f"{provider} search response must be a JSON object.")
    return payload


def _validate_direct_search_endpoint(value, default_url):
    """验证直接搜索端点；输入配置值和默认地址，返回 HTTPS 或本机回环 URL，无效时抛出固定异常。"""

    endpoint = str(value or default_url).strip()
    parsed = urlsplit(endpoint)
    hostname = str(parsed.hostname or "").rstrip(".").lower()
    if parsed.scheme not in {"http", "https"} or not hostname:
        raise ValueError("Search endpoint must be an HTTP or HTTPS URL.")
    if parsed.username is not None or parsed.password is not None:
        raise ValueError("Search endpoint must not contain embedded credentials.")
    try:
        is_loopback = ipaddress.ip_address(hostname).is_loopback
    except ValueError:
        is_loopback = hostname == "localhost"
    if parsed.scheme != "https" and not is_loopback:
        raise ValueError("Search endpoint must use HTTPS unless it is a loopback URL.")
    return endpoint


async def DDGsearch(query):
    """执行 DuckDuckGo 搜索；输入查询文本，返回 JSON 文本，依赖或请求失败时返回固定空结果。"""

    settings = await load_settings()
    if DDGS is None:
        return "DuckDuckGo 搜索当前不可用：缺少 ddgs 依赖。"

    def sync_search():
        """在线程池执行同步 DDG 请求；无输入，返回 JSON 文本，失败只记录异常类型。"""

        max_results = settings['webSearch']['duckduckgo_max_results'] or 10
        try:
            results = list(DDGS().text(
                str(query),
                max_results=_normalize_search_limit(max_results),
            ))
            return json.dumps(results, indent=2, ensure_ascii=False)
        except Exception as e:
            _log_search_failure("DuckDuckGo search error", e)
            return ""

    try:
        # 使用默认executor在单独线程中执行同步操作
        return await asyncio.get_event_loop().run_in_executor(None, sync_search)
    except Exception as e:
        print(f"Event loop error: {e}")
        return ""
    
duckduckgo_tool = {
    "type": "function",
    "function": {
        "name": "DDGsearch",
        "description": f"通过关键词获得DuckDuckGo搜索上的信息。",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "需要搜索的关键词，可以是多个词语，多个词语之间用空格隔开。",
                },
            },
            "required": ["query"],
        },
    },
}

async def searxng(query,categories="general"):
    settings = await load_settings()
    def sync_search(query):
        max_results = settings['webSearch']['searxng_max_results'] or 10
        api_url = settings['webSearch']['searxng_url'] or "http://127.0.0.1:8080"
        engines = settings['webSearch']['searxng_engines'] or None
        is_select = settings['webSearch']['searxng_is_select'] or False
        headers = {"User-Agent": "Mozilla/5.0"}
        params = {
            "q": query, 
            "categories": categories,
            "count": max_results
        }
        if engines and is_select:
            params["engines"] = engines

        try:
            response = requests.get(api_url + "/search", headers=headers, params=params)
            html_content = response.text

            soup = BeautifulSoup(html_content, 'html.parser')
            results = []

            for result in soup.find_all('article', class_='result'):
                title = result.find('h3').get_text() if result.find('h3') else 'No title'
                
                # 修复：使用正确的选择器
                link_elem = result.find('a', class_='url_header')
                if not link_elem:
                    # 备用方案：从h3内的链接获取
                    h3 = result.find('h3')
                    link_elem = h3.find('a') if h3 else None
                
                link = link_elem['href'] if link_elem and link_elem.get('href') else 'No link'
                
                snippet = result.find('p', class_='content').get_text() if result.find('p', class_='content') else 'No snippet'
                
                results.append({
                    'title': title,
                    'link': link,
                    'snippet': snippet
                })

            return json.dumps(results, indent=2, ensure_ascii=False)
            
        except Exception as e:
            print(f"Search error: {e}")
            return f"Search error: {e}"

    try:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, sync_search, query)
    except Exception as e:
        print(f"Async error: {e}")
        return f"Async error: {e}"

searxng_tool = {
    "type": "function",
    "function": {
        "name": "searxng",
        "description": "通过SearXNG开源元搜索引擎获取网络信息。",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "搜索关键词，支持自然语言和多关键词组合查询",
                },
                "categories": {
                    "type": "string",
                    "description": "搜索类别，请根据用户意图选择最合适的分类。可选值：'general'(综合/默认，适合大部分百科与常识查询), 'news'(新闻，适合搜近期发生的事件), 'images'(图片，适合找图), 'videos'(视频，适合找视频资源), 'it'(IT技术，适合搜代码报错、编程开发相关), 'science'(科学，适合搜学术论文与科学资料)。",
                    "enum": ["general", "news", "images", "videos", "it", "science"],
                    "default": "general"
                },
            },
            "required": ["query"],
        },
    },
}

async def bochaai_search(query):
    settings = await load_settings()
    def sync_search():
        max_results = settings['webSearch']['bochaai_max_results'] or 10
        api_key = settings['webSearch'].get('bochaai_api_key', "")
        
        if not api_key:
            return "API key未配置"

        url = "https://api.bochaai.com/v1/web-search"
        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }
        payload = json.dumps({
            "query": query,
            "summary": True,
            "count": max_results
        })

        try:
            response = requests.post(url, headers=headers, data=payload, timeout=30)
            if response.status_code == 200:
                result_data = response.json()
                
                # 解析新版API返回格式
                formatted_results = []
                search_results = result_data.get('data', {}).get('webPages', {}).get('value', [])
                
                for item in search_results:
                    # 构建更丰富的结果信息
                    formatted_item = {
                        'title': item.get('name', '无标题'),
                        'link': item.get('url', ''),
                        'displayUrl': item.get('displayUrl', ''),
                        'snippet': item.get('snippet', '无内容摘要'),
                        'siteName': item.get('siteName', '未知来源'),
                    }
                    # 自动生成简洁的来源名称
                    if not formatted_item['siteName']:
                        formatted_item['siteName'] = formatted_item['displayUrl'].split('//')[-1].split('/')[0]
                    formatted_results.append(formatted_item)
                
                return json.dumps(formatted_results, indent=2, ensure_ascii=False)
            else:
                return f"请求失败，状态码：{response.status_code}"
        except Exception as e:
            _log_search_failure("博查得搜索错误", e)
            return ""

    try:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, sync_search)
    except Exception as e:
        print(f"异步执行错误: {e}")
        return ""

bochaai_tool = {
    "type": "function",
    "function": {
        "name": "bochaai_search",
        "description": "通过博查得智能搜索API获取网络信息，支持深度语义理解。",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "需要搜索的自然语言查询语句，支持复杂语义和长句（示例：阿里巴巴最新财报要点）",
                }
            },
            "required": ["query"],
        },
    }
}

async def Tavily_search(query):
    settings = await load_settings()
    if TavilyClient is None:
        return "Tavily 搜索当前不可用：缺少 tavily 依赖。"
    def sync_search():
        max_results = settings['webSearch']['tavily_max_results'] or 10
        try:
            api_key = settings['webSearch'].get('tavily_api_key', "")
            client = TavilyClient(api_key)
            response = client.search(
                query=query,
                max_results=max_results
            )
            return json.dumps(response, indent=2, ensure_ascii=False)
        except Exception as e:
            _log_search_failure("Tavily search error", e)
            return ""

    try:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, sync_search)
    except Exception as e:
        print(f"Async execution error: {e}")
        return ""

tavily_tool = {
    "type": "function",
    "function": {
        "name": "Tavily_search",
        "description": "通过Tavily专业搜索API获取高质量的网络信息，特别适合获取实时数据和专业分析。",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "需要搜索的关键词或自然语言查询语句",
                }
            },
            "required": ["query"],
        },
    },
}

async def Bing_search(query):
    """执行 Bing REST 搜索；输入查询文本，返回规范 JSON 文本，凭据或请求失败时返回空文本。"""

    settings = await load_settings()

    def sync_search():
        """在线程池执行同步 Bing 请求；无输入，返回标题、链接和摘要数组，不记录凭据或响应正文。"""

        max_results = settings['webSearch']['bing_max_results'] or 10
        try:
            api_key = settings['webSearch'].get('bing_api_key', "")
            if not str(api_key or "").strip():
                raise ValueError("Bing API key is missing.")
            bing_search_url = _validate_direct_search_endpoint(
                settings['webSearch'].get('bing_search_url', ""),
                BING_SEARCH_URL,
            )
            response = requests.get(
                bing_search_url,
                params={"q": str(query), "count": _normalize_search_limit(max_results, 50)},
                headers={
                    "Accept": "application/json",
                    "Ocp-Apim-Subscription-Key": api_key,
                    "User-Agent": "OpenXnet/1.0",
                },
                timeout=15,
            )
            payload = _read_direct_search_json(response, "Bing")
            raw_results = (payload.get("webPages") or {}).get("value", [])
            if not isinstance(raw_results, list):
                raise RuntimeError("Bing search results must be an array.")
            results = [
                {
                    "title": str(item.get("name") or ""),
                    "link": str(item.get("url") or ""),
                    "snippet": str(item.get("snippet") or ""),
                }
                for item in raw_results
                if isinstance(item, dict)
            ]
            return json.dumps(results, indent=2, ensure_ascii=False)
        except Exception as e:
            _log_search_failure("Bing search error", e)
            return ""

    try:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, sync_search)
    except Exception as e:
        print(f"Async execution error: {e}")
        return ""


bing_tool = {
    "type": "function",
    "function": {
        "name": "Bing_search",
        "description": "通过Bing搜索API获取网络信息。",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "需要搜索的关键词或自然语言查询语句",
                }
            },
            "required": ["query"],
        },
    }
}

GOOGLE_CUSTOM_SEARCH_URL = "https://www.googleapis.com/customsearch/v1"


class GoogleSearchError(RuntimeError):
    """Credential-safe Google Custom Search transport or response failure."""


def _google_custom_search_results(
    query,
    api_key,
    google_cse_id,
    max_results,
    *,
    request_get=None,
):
    """Return normalized Google Custom Search results through direct REST calls."""

    if not str(query or "").strip():
        return []
    if not str(api_key or "").strip() or not str(google_cse_id or "").strip():
        raise GoogleSearchError("Google Custom Search requires an API key and CSE ID.")
    try:
        result_limit = max(1, min(int(max_results), 100))
    except (TypeError, ValueError):
        result_limit = 10
    http_get = request_get or requests.get
    results = []
    start_index = 1
    while len(results) < result_limit:
        page_size = min(10, result_limit - len(results))
        try:
            response = http_get(
                GOOGLE_CUSTOM_SEARCH_URL,
                params={
                    "key": api_key,
                    "cx": google_cse_id,
                    "q": query,
                    "num": page_size,
                    "start": start_index,
                },
                headers={"Accept": "application/json", "User-Agent": "OpenXnet/1.0"},
                timeout=15,
            )
            response.raise_for_status()
            payload = response.json()
        except requests.RequestException as error:
            status_code = getattr(getattr(error, "response", None), "status_code", None)
            status_text = f" HTTP {status_code}" if status_code else ""
            raise GoogleSearchError(f"Google Custom Search request failed{status_text}.") from error
        except (ValueError, json.JSONDecodeError) as error:
            raise GoogleSearchError("Google Custom Search returned invalid JSON.") from error
        if not isinstance(payload, dict):
            raise GoogleSearchError("Google Custom Search response must be a JSON object.")
        items = payload.get("items", [])
        if not isinstance(items, list):
            raise GoogleSearchError("Google Custom Search response field 'items' must be an array.")
        for item in items:
            if not isinstance(item, dict):
                continue
            results.append(
                {
                    "title": str(item.get("title") or ""),
                    "link": str(item.get("link") or ""),
                    "snippet": str(item.get("snippet") or ""),
                }
            )
            if len(results) >= result_limit:
                break
        if len(items) < page_size:
            break
        start_index += len(items)
    return results


async def Google_search(query):
    """Search Google Custom Search and preserve the existing JSON text contract."""

    settings = await load_settings()
    def sync_search():
        """Run blocking Google REST pagination outside the event loop."""

        max_results = settings['webSearch']['google_max_results'] or 10
        try:
            api_key = settings['webSearch'].get('google_api_key', "")
            google_cse_id = settings['webSearch'].get('google_cse_id', "")
            response = _google_custom_search_results(
                query,
                api_key,
                google_cse_id,
                max_results,
            )
            return json.dumps(response, indent=2, ensure_ascii=False)
        except Exception as e:
            _log_search_failure("Google search error", e)
            return ""

    try:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, sync_search)
    except Exception as e:
        print(f"Async execution error: {e}")
        return ""


google_tool = {
    "type": "function",
    "function": {
        "name": "Google_search",
        "description": "通过Google搜索API获取网络信息。",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "需要搜索的关键词或自然语言查询语句",
                }
            },
            "required": ["query"],
        }
    }
}

async def Brave_search(query):
    """执行 Brave REST 搜索；输入查询文本，返回规范 JSON 文本，凭据或请求失败时返回空文本。"""

    settings = await load_settings()

    def sync_search():
        """在线程池执行同步 Brave 请求；无输入，返回标题、链接和描述数组，不记录凭据或正文。"""

        max_results = settings['webSearch']['brave_max_results'] or 10
        try:
            api_key = settings['webSearch'].get('brave_api_key', "")
            if not str(api_key or "").strip():
                raise ValueError("Brave API key is missing.")
            response = requests.get(
                BRAVE_SEARCH_URL,
                params={"q": str(query), "count": _normalize_search_limit(max_results, 20)},
                headers={
                    "Accept": "application/json",
                    "X-Subscription-Token": api_key,
                    "User-Agent": "OpenXnet/1.0",
                },
                timeout=15,
            )
            payload = _read_direct_search_json(response, "Brave")
            raw_results = (payload.get("web") or {}).get("results", [])
            if not isinstance(raw_results, list):
                raise RuntimeError("Brave search results must be an array.")
            results = [
                {
                    "title": str(item.get("title") or ""),
                    "link": str(item.get("url") or ""),
                    "snippet": str(item.get("description") or ""),
                }
                for item in raw_results
                if isinstance(item, dict)
            ]
            return json.dumps(results, indent=2, ensure_ascii=False)
        except Exception as e:
            _log_search_failure("Brave search error", e)
            return ""

    try:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, sync_search)
    except Exception as e:
        print(f"Async execution error: {e}")
        return ""
    
brave_tool = {
    "type": "function",
    "function": {
        "name": "Brave_search",
        "description": "通过Brave搜索API获取网络信息。",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "需要搜索的关键词或自然语言查询语句",
                }
            },
            "required": ["query"],
        },
    }
}

async def Exa_search(query):
    """执行 Exa REST 搜索；输入查询文本，返回供应商结果 JSON 文本，凭据或请求失败时返回空文本。"""

    settings = await load_settings()

    def sync_search():
        """在线程池执行同步 Exa 请求；无输入，返回有界结果数组，不记录凭据或响应正文。"""

        max_results = settings['webSearch']['exa_max_results'] or 10
        try:
            api_key = settings['webSearch'].get('exa_api_key', "")
            if not str(api_key or "").strip():
                raise ValueError("Exa API key is missing.")
            response = requests.post(
                EXA_SEARCH_URL,
                json={
                    "query": str(query),
                    "numResults": _normalize_search_limit(max_results, 100),
                },
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "x-api-key": api_key,
                    "User-Agent": "OpenXnet/1.0",
                },
                timeout=15,
            )
            payload = _read_direct_search_json(response, "Exa")
            results = payload.get("results", [])
            if not isinstance(results, list):
                raise RuntimeError("Exa search results must be an array.")
            return json.dumps(results, indent=2, ensure_ascii=False)
        except Exception as e:
            _log_search_failure("Exa search error", e)
            return ""

    try:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, sync_search)
    except Exception as e:
        print(f"Async execution error: {e}")
        return ""

exa_tool = {
    "type": "function", 
    "function": {
        "name": "Exa_search",
        "description": "通过Exa搜索API获取网络信息。",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "需要搜索的关键词或自然语言查询语句",
                }
            },
            "required": ["query"],
            }
    }
}

async def Serper_search(query):
    """执行 Serper REST 搜索；输入查询文本，返回供应商 JSON 文本，凭据或请求失败时返回空文本。"""

    settings = await load_settings()

    def sync_search():
        """在线程池执行同步 Serper 请求；无输入，返回有界 JSON 对象，不记录凭据或响应正文。"""

        max_results = settings['webSearch']['serper_max_results'] or 10
        try:
            api_key = settings['webSearch'].get('serper_api_key', "")
            if not str(api_key or "").strip():
                raise ValueError("Serper API key is missing.")
            response = requests.post(
                SERPER_SEARCH_URL,
                json={"q": str(query), "num": _normalize_search_limit(max_results, 100)},
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "X-API-KEY": api_key,
                    "User-Agent": "OpenXnet/1.0",
                },
                timeout=15,
            )
            payload = _read_direct_search_json(response, "Serper")
            return json.dumps(payload, indent=2, ensure_ascii=False)
        except Exception as e:
            _log_search_failure("Serper search error", e)
            return ""

    try:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, sync_search)
    except Exception as e:
        print(f"Async execution error: {e}")
        return ""
    
serper_tool = {
    "type": "function",
    "function": {
        "name": "Serper_search",
        "description": "通过Serper搜索API获取网络信息。",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "需要搜索的关键词或自然语言查询语句",
                }
            },
            "required": ["query"],
        },
    }
}

async def jina_crawler(original_url):
    settings = await load_settings()
    def sync_crawler():
        detail_url = "https://r.jina.ai/"
        url = f"{detail_url}{original_url}"
        try:
            jina_api_key = settings['webSearch'].get('jina_api_key', "")
            if jina_api_key:
                headers = {
                    'Authorization': f'Bearer {jina_api_key}',
                }
                response = requests.get(url, headers=headers)
            else:
                response = requests.get(url)
            if response.status_code == 200:
                return response.text
            else:
                return f"获取{original_url}网页信息失败，状态码：{response.status_code}"
        except requests.RequestException as e:
            _log_search_failure("Jina crawler request failed", e)
            return "网页抓取请求失败"

    try:
        if not await check_robots_txt(original_url):
            raise PermissionError(f"合规拒绝: 目标网站禁止抓取")
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, sync_crawler)
    except Exception as e:
        _log_search_failure("Jina crawler execution failed", e)
        return "网页抓取执行失败"

jina_crawler_tool = {
    "type": "function",
    "function": {
        "name": "jina_crawler",
        "description": "通过Jina AI的网页爬取API获取指定URL的网页内容。指定URL可以为其他搜索引擎搜索出来的网页链接，也可以是用户给出的网站链接。但不要将本机地址或内网地址开头的URL作为参数传入，因为jina将无法访问到这些URL。",
        "parameters": {
            "type": "object",
            "properties": {
                "original_url": {
                    "type": "string",
                    "description": "需要爬取的原始URL地址。",
                },
            },
            "required": ["original_url"],
        },
    },
}

class Crawl4AiTester:
    def __init__(self, base_url: str = "http://localhost:11235"):
        self.base_url = base_url

    def submit_and_wait(self, request_data: dict,headers: dict = None, timeout: int = 300) -> dict:
        # Submit crawl job
        response = requests.post(f"{self.base_url}/crawl", json=request_data,headers=headers)
        task_id = response.json()["task_id"]
        print(f"Task ID: {task_id}")

        # Poll for result
        start_time = time.time()
        while True:
            if time.time() - start_time > timeout:
                raise TimeoutError(f"Task {task_id} timeout")

            result = requests.get(f"{self.base_url}/task/{task_id}",headers=headers)
            status = result.json()

            if status["status"] == "completed":
                return status

            time.sleep(2)

async def Crawl4Ai_search(original_url):
    settings = await load_settings()
    def sync_search():
        try:
            tester = Crawl4AiTester()
            api_key = settings['webSearch'].get('Crawl4Ai_api_key', "")
            headers = {"Authorization": f"Bearer {api_key}"} if api_key else None
            request = {
                "urls": original_url,
                "priority": 10
            }
            result = tester.submit_and_wait(request, headers=headers)
            return result['result']['markdown']
        except Exception as e:
            _log_search_failure("Crawl4AI request failed", e)
            return "网页抓取请求失败"

    try:
        if not await check_robots_txt(original_url):
            raise PermissionError(f"合规拒绝: 目标网站禁止抓取")
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, sync_search)
    except Exception as e:
        _log_search_failure("Crawl4AI execution failed", e)
        return "网页抓取执行失败"

Crawl4Ai_tool = {
    "type": "function",
    "function": {
        "name": "Crawl4Ai_search",
        "description": "通过Crawl4Ai服务爬取指定URL的网页内容，返回Markdown格式的文本。",
        "parameters": {
            "type": "object",
            "properties": {
                "original_url": {
                    "type": "string",
                    "description": "需要爬取的目标URL地址。",
                }
            },
            "required": ["original_url"],
        },
    },
}

from typing import Optional, Dict, Any

# ============== 2. Firecrawl ==============

class FirecrawlClient:
    """
    Firecrawl API 客户端
    支持官方API和自部署实例
    """
    
    def __init__(self, base_url: str, api_key: Optional[str] = None):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.headers = {
            'Content-Type': 'application/json',
        }
        if api_key:
            self.headers['Authorization'] = f'Bearer {api_key}'
    
    def _get_api_path(self, endpoint: str) -> str:
        """根据基础URL自动判断API版本路径"""
        if '/v2/' in self.base_url:
            # 官方API v2
            return f"{self.base_url}/{endpoint}"
        elif '/v1/' in self.base_url:
            # 自部署通常是v1
            return f"{self.base_url}/{endpoint}"
        else:
            # 默认追加路径
            return f"{self.base_url}/{endpoint}"
    
    def scrape(self, url: str, formats: list = None, **kwargs) -> Dict[str, Any]:
        """
        单页面抓取 (Scrape)
        """
        formats = formats or ["markdown"]
        endpoint = self._get_api_path("scrape")
        
        payload = {
            "url": url,
            "formats": formats,
            **kwargs
        }
        
        response = requests.post(
            endpoint,
            headers=self.headers,
            json=payload,
            timeout=60
        )
        response.raise_for_status()
        return response.json()
    
    def crawl(self, url: str, limit: int = 10, **kwargs) -> str:
        """
        整站爬取 (Crawl) - 异步作业，需要轮询
        """
        # 提交爬取任务
        submit_endpoint = self._get_api_path("crawl")
        payload = {
            "url": url,
            "limit": limit,
            **kwargs
        }
        
        submit_resp = requests.post(
            submit_endpoint,
            headers=self.headers,
            json=payload,
            timeout=30
        )
        submit_resp.raise_for_status()
        job_data = submit_resp.json()
        
        if not job_data.get("success"):
            raise Exception(f"Failed to submit crawl job: {job_data}")
        
        job_id = job_data.get("id")
        check_url = job_data.get("url") or f"{self.base_url}/crawl/{job_id}"
        
        # 轮询等待完成
        max_wait = 300  # 5分钟超时
        interval = 2
        start_time = time.time()
        
        while time.time() - start_time < max_wait:
            status_resp = requests.get(
                check_url,
                headers=self.headers,
                timeout=30
            )
            status_resp.raise_for_status()
            status_data = status_resp.json()
            
            if status_data.get("status") == "completed":
                return status_data
            elif status_data.get("status") == "failed":
                raise Exception(f"Crawl job failed: {status_data.get('error', 'Unknown error')}")
            
            time.sleep(interval)
        
        raise TimeoutError(f"Crawl job {job_id} timeout after {max_wait}s")
    
    def search(self, query: str, limit: int = 5, scrape_options: dict = None) -> Dict[str, Any]:
        """
        搜索 (Search)
        """
        endpoint = self._get_api_path("search")
        
        payload = {
            "query": query,
            "limit": limit
        }
        if scrape_options:
            payload["scrapeOptions"] = scrape_options
        
        response = requests.post(
            endpoint,
            headers=self.headers,
            json=payload,
            timeout=60
        )
        response.raise_for_status()
        return response.json()
    
    def map(self, url: str, search: str = None) -> Dict[str, Any]:
        """
        网站地图 (Map)
        """
        endpoint = self._get_api_path("map")
        
        payload = {"url": url}
        if search:
            payload["search"] = search
        
        response = requests.post(
            endpoint,
            headers=self.headers,
            json=payload,
            timeout=60
        )
        response.raise_for_status()
        return response.json()


async def firecrawl_search(original_url: str, query: str = None) -> str:
    """
    Firecrawl 主函数
    支持多种模式：scrape(单页), crawl(整站), search(搜索), map(地图)
    """
    settings = await load_settings()
    
    def sync_crawler():
        try:
            # 获取配置
            base_url = settings['webSearch'].get('firecrawl_url', 'https://api.firecrawl.dev/v2')
            api_key = settings['webSearch'].get('firecrawl_api_key', '')
            mode = settings['webSearch'].get('firecrawl_mode', 'scrape')
            
            # 初始化客户端
            client = FirecrawlClient(base_url, api_key)
            
            # 根据模式执行不同操作
            if mode == 'scrape':
                # 单页抓取
                result = client.scrape(
                    original_url,
                    formats=["markdown", "html"],
                    onlyMainContent=True  # 只获取主要内容
                )
                
                if result.get("success") and result.get("data"):
                    data = result["data"]
                    markdown = data.get("markdown", "")
                    metadata = data.get("metadata", {})
                    title = metadata.get("title", "未命名页面")
                    
                    return f"# {title}\n\n{markdown}"
                else:
                    return "Firecrawl抓取失败"
            
            elif mode == 'crawl':
                # 整站爬取
                result = client.crawl(
                    original_url,
                    limit=10,  # 限制页面数避免过长
                    scrapeOptions={
                        "formats": ["markdown"],
                        "onlyMainContent": True
                    }
                )
                
                if result.get("status") == "completed":
                    pages = result.get("data", [])
                    total = result.get("total", 0)
                    
                    content_parts = [f"# 站点爬取结果\n\n共获取 {total} 个页面：\n"]
                    
                    for i, page in enumerate(pages[:5], 1):  # 最多显示5页
                        md = page.get("markdown", "")
                        meta = page.get("metadata", {})
                        title = meta.get("title", f"页面{i}")
                        url = meta.get("sourceURL", original_url)
                        
                        content_parts.append(f"\n## {title}\n{md[:2000]}...\n[来源]({url})")
                    
                    return "\n".join(content_parts)
                else:
                    return "Firecrawl爬取失败"
            
            elif mode == 'search':
                # 搜索模式 - 当传入的是查询词而非URL时
                search_query = query or original_url  # 如果没有单独提供query，将URL作为查询词
                result = client.search(
                    search_query,
                    limit=5,
                    scrape_options={"formats": ["markdown"]}
                )
                
                if result.get("success") and result.get("data"):
                    items = result["data"]
                    content_parts = [f"# 搜索结果: {search_query}\n"]
                    
                    for i, item in enumerate(items, 1):
                        title = item.get("title", "无标题")
                        url = item.get("url", "")
                        desc = item.get("description", "")
                        markdown = item.get("markdown", "")
                        
                        content_parts.append(f"\n## {i}. {title}\n{desc}\n")
                        if markdown:
                            content_parts.append(f"{markdown[:1500]}...")
                        content_parts.append(f"[来源]({url})")
                    
                    return "\n".join(content_parts)
                else:
                    return "Firecrawl搜索失败"
            
            elif mode == 'map':
                # 网站地图模式
                result = client.map(original_url)
                
                if result.get("success") and result.get("links"):
                    links = result["links"]
                    content_parts = [f"# 网站地图: {original_url}\n\n发现 {len(links)} 个链接：\n"]
                    
                    for link in links[:20]:  # 限制显示数量
                        title = link.get("title", "无标题")
                        url = link.get("url", "")
                        desc = link.get("description", "")
                        content_parts.append(f"- [{title}]({url}) - {desc}")
                    
                    return "\n".join(content_parts)
                else:
                    return "Firecrawl地图生成失败"
            
            else:
                return f"未知的Firecrawl模式: {mode}"
                
        except requests.RequestException as e:
            _log_search_failure("Firecrawl request failed", e)
            return "Firecrawl请求失败"
        except Exception as e:
            _log_search_failure("Firecrawl processing failed", e)
            return "Firecrawl处理失败"

    try:
        # Firecrawl自部署版本通常不需要检查robots.txt（由服务内部处理）
        # 但官方API版本建议保留检查
        settings = await load_settings()
        base_url = settings['webSearch'].get('firecrawl_url', '')
        
        # 如果是官方API，检查robots.txt
        if 'api.firecrawl.dev' in base_url:
            if not await check_robots_txt(original_url):
                raise PermissionError(f"合规拒绝: 目标网站禁止抓取")
        
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, sync_crawler)
    except Exception as e:
        _log_search_failure("Firecrawl execution failed", e)
        return "Firecrawl执行失败"


firecrawl_tool = {
    "type": "function",
    "function": {
        "name": "firecrawl_search",
        "description": "通过Firecrawl服务获取网页内容。支持单页抓取、整站爬取、搜索和网站地图模式。可以处理JavaScript渲染的页面，返回结构化的Markdown内容。",
        "parameters": {
            "type": "object",
            "properties": {
                "original_url": {
                    "type": "string",
                    "description": "需要处理的URL地址或搜索查询词（当模式为search时）。",
                },
                "query": {
                    "type": "string",
                    "description": "可选，当使用search模式时的具体搜索词。如果不提供，将使用original_url作为查询词。",
                }
            },
            "required": ["original_url"],
        },
    },
}

from bs4 import BeautifulSoup
import re

async def simple_fetch(url):
    """
    改进的网页抓取工具，返回结构化的清洗后内容
    支持抓取内网和外网页面
    """
    def sync_fetch():
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
            response = requests.get(url, headers=headers, timeout=30)
            if response.status_code == 200:
                return response.text
            else:
                return None, f"获取{url}网页信息失败，状态码：{response.status_code}"
        except requests.RequestException as e:
            return None, f"获取{url}网页信息失败，错误信息：{str(e)}"
    
    def clean_and_extract(html_content):
        """提取并清洗HTML内容，返回结构化数据"""
        if not html_content:
            return None
        
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # 移除不需要的标签
        for tag in soup(['script', 'style', 'nav', 'footer', 'header', 'aside', 'iframe', 'noscript']):
            tag.decompose()
        
        structured_content = {
            'title': '',
            'sections': []
        }
        
        # 提取页面标题
        title_tag = soup.find('title')
        if title_tag:
            structured_content['title'] = title_tag.get_text().strip()
        
        # 提取主要内容区域（优先查找main, article, 或id/class包含content的div）
        main_content = soup.find('main') or soup.find('article') or \
                      soup.find('div', {'id': re.compile(r'content|main', re.I)}) or \
                      soup.find('div', {'class': re.compile(r'content|main|article', re.I)}) or \
                      soup.body or soup
        
        # 提取所有标题和段落
        for element in main_content.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p']):
            text = element.get_text(separator=' ', strip=True)
            
            # 清洗文本：移除多余空白
            text = re.sub(r'\s+', ' ', text).strip()
            
            # 过滤掉过短的内容（可能是噪音）
            if len(text) < 3:
                continue
            
            if element.name.startswith('h'):
                # 标题
                level = int(element.name[1])
                structured_content['sections'].append({
                    'type': 'heading',
                    'level': level,
                    'content': text
                })
            else:
                # 段落
                structured_content['sections'].append({
                    'type': 'paragraph',
                    'content': text
                })
        
        return structured_content
    
    try:
        # 检查 robots.txt 合规性
        if not await check_robots_txt(url):
            return {
                'error': 'PermissionError',
                'message': '合规拒绝: 目标网站禁止抓取'
            }
        
        loop = asyncio.get_event_loop()
        html_content = await loop.run_in_executor(None, sync_fetch)
        
        if isinstance(html_content, tuple):
            # 返回的是错误信息
            return {
                'error': 'FetchError',
                'message': html_content[1]
            }
        
        # 清洗并提取结构化内容
        structured_data = clean_and_extract(html_content)
        
        if not structured_data or not structured_data['sections']:
            return {
                'error': 'ParseError',
                'message': '无法从页面中提取有效内容'
            }
        
        return structured_data
        
    except Exception as e:
        return {
            'error': 'UnexpectedError',
            'message': str(e)
        }


# OpenAI function 定义
simple_fetch_tool = {
    "type": "function",
    "function": {
        "name": "simple_fetch",
        "description": "抓取指定URL的网页内容。支持内网和外网地址。",
        "parameters": {
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": "需要抓取的URL地址。",
                },
            },
            "required": ["url"],
        },
    },
}

async def markdown_new(original_url):
    """
    通过 markdown.new 服务将网页转换为 Markdown 格式
    """
    
    def sync_crawler():
        # 拼接 markdown.new 的服务地址
        detail_url = "https://markdown.new/"
        url = f"{detail_url}{original_url}"
        
        try:
            # 添加一个基础的 User-Agent 防屏蔽
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
            
            # 发起请求
            response = requests.get(url, headers=headers, timeout=60)
            
            if response.status_code == 200:
                # markdown.new 默认直接返回纯文本的 markdown 内容
                return response.text
            else:
                return f"获取{original_url}网页信息失败，状态码：{response.status_code}"
                
        except requests.RequestException as e:
            return f"获取{original_url}网页信息失败，错误信息：{str(e)}"

    try:
        # 检查 robots.txt 合规性（保持与你原有逻辑一致）
        if not await check_robots_txt(original_url):
            raise PermissionError(f"合规拒绝: 目标网站禁止抓取")
            
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, sync_crawler)
    except Exception as e:
        print(f"Async execution error in markdown_new: {e}")
        return str(e)
    
markdown_new_tool = {
    "type": "function",
    "function": {
        "name": "markdown_new",
        "description": "通过 markdown.new 服务获取指定URL的网页内容，并自动转换为结构化的 Markdown 文本。此工具非常轻量高效，适用于外网链接。请勿传入本机地址或内网地址（会无法访问）。",
        "parameters": {
            "type": "object",
            "properties": {
                "original_url": {
                    "type": "string",
                    "description": "需要爬取的原始URL地址。必须是完整的 http 或 https 开头的网址。",
                },
            },
            "required": ["original_url"],
        },
    },
}
