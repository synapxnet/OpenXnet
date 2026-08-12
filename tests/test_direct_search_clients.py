# -*- coding: utf-8 -*-
"""验证不依赖 LangChain 的直接搜索客户端映射与响应边界。"""

from __future__ import annotations

import json
import unittest
from unittest.mock import AsyncMock, patch

from py import web_search


class _FakeResponse:
    """提供 requests 响应所需的最小 JSON 接口。"""

    def __init__(self, payload, *, content: bytes | None = None) -> None:
        """保存 JSON 载荷和可选原始字节；输入测试值，无返回和外部副作用。"""

        self._payload = payload
        self.content = content if content is not None else json.dumps(payload).encode("utf-8")

    def raise_for_status(self) -> None:
        """模拟成功 HTTP 状态；无输入和返回，不抛出异常。"""

    def json(self):
        """返回预设 JSON 载荷；无输入，返回测试对象，不复制内容。"""

        return self._payload


class _FakeDdgs:
    """提供固定 DuckDuckGo 文本结果。"""

    def text(self, query, *, max_results):
        """返回固定搜索结果；输入查询和数量，返回可迭代对象，不访问网络。"""

        return [{"title": str(query), "href": "https://example.test", "body": str(max_results)}]


class DirectSearchClientTests(unittest.IsolatedAsyncioTestCase):
    """验证五种直接搜索传输的字段、结果和错误上限。"""

    async def test_duckduckgo_uses_ddgs_without_langchain(self) -> None:
        """确认 DDG 使用轻量客户端并返回 JSON 文本，不依赖 LangChain 工具包装。"""

        settings = {"webSearch": {"duckduckgo_max_results": 3}}
        with (
            patch("py.web_search.load_settings", AsyncMock(return_value=settings)),
            patch.object(web_search, "DDGS", _FakeDdgs),
        ):
            result = json.loads(await web_search.DDGsearch("openxnet"))
        self.assertEqual(result[0]["title"], "openxnet")
        self.assertEqual(result[0]["body"], "3")

    async def test_bing_and_brave_normalize_public_results(self) -> None:
        """确认 Bing 与 Brave 把供应商字段规范为标题、链接和摘要，响应中不包含 API Key。"""

        settings = {"webSearch": {
            "bing_max_results": 5,
            "bing_api_key": "bing-secret",
            "bing_search_url": "",
            "brave_max_results": 4,
            "brave_api_key": "brave-secret",
        }}
        bing_response = _FakeResponse({"webPages": {"value": [{
            "name": "Bing title",
            "url": "https://bing.example.test",
            "snippet": "Bing snippet",
        }]}})
        brave_response = _FakeResponse({"web": {"results": [{
            "title": "Brave title",
            "url": "https://brave.example.test",
            "description": "Brave snippet",
        }]}})
        with (
            patch("py.web_search.load_settings", AsyncMock(return_value=settings)),
            patch("py.web_search.requests.get", side_effect=[bing_response, brave_response]),
        ):
            bing = json.loads(await web_search.Bing_search("query"))
            brave = json.loads(await web_search.Brave_search("query"))
        self.assertEqual(bing[0]["title"], "Bing title")
        self.assertEqual(brave[0]["snippet"], "Brave snippet")
        self.assertNotIn("secret", json.dumps([bing, brave]))

    async def test_bing_rejects_insecure_non_loopback_endpoint(self) -> None:
        """确认 Bing 拒绝外部 HTTP 自定义端点；输入不安全配置，返回空文本且不发起网络请求。"""

        settings = {"webSearch": {
            "bing_max_results": 5,
            "bing_api_key": "bing-secret",
            "bing_search_url": "http://search.example.test/v7.0/search",
        }}
        with (
            patch("py.web_search.load_settings", AsyncMock(return_value=settings)),
            patch("py.web_search.requests.get") as request_get,
        ):
            result = await web_search.Bing_search("query")
        self.assertEqual(result, "")
        request_get.assert_not_called()

    def test_direct_endpoint_allows_https_and_loopback_only(self) -> None:
        """验证直接搜索端点策略；输入公网 HTTPS 或回环地址时返回原值，其他协议和凭据地址抛出异常。"""

        https_url = "https://search.example.test/v7.0/search"
        loopback_url = "http://127.0.0.1:8080/search"
        self.assertEqual(
            web_search._validate_direct_search_endpoint(https_url, ""),
            https_url,
        )
        self.assertEqual(
            web_search._validate_direct_search_endpoint(loopback_url, ""),
            loopback_url,
        )
        for endpoint in (
            "http://search.example.test/search",
            "ftp://search.example.test/search",
            "https://user:password@search.example.test/search",
        ):
            with self.subTest(endpoint=endpoint), self.assertRaises(ValueError):
                web_search._validate_direct_search_endpoint(endpoint, "")

    async def test_exa_and_serper_use_bounded_json_posts(self) -> None:
        """确认 Exa 与 Serper 使用直接 JSON POST，并保留供应商结构化结果。"""

        settings = {"webSearch": {
            "exa_max_results": 2,
            "exa_api_key": "exa-secret",
            "serper_max_results": 6,
            "serper_api_key": "serper-secret",
        }}
        exa_response = _FakeResponse({"results": [{"title": "Exa title"}]})
        serper_response = _FakeResponse({"organic": [{"title": "Serper title"}]})
        with (
            patch("py.web_search.load_settings", AsyncMock(return_value=settings)),
            patch("py.web_search.requests.post", side_effect=[exa_response, serper_response]),
        ):
            exa = json.loads(await web_search.Exa_search("query"))
            serper = json.loads(await web_search.Serper_search("query"))
        self.assertEqual(exa[0]["title"], "Exa title")
        self.assertEqual(serper["organic"][0]["title"], "Serper title")

    def test_direct_response_rejects_oversized_or_non_object_json(self) -> None:
        """拒绝超过 4 MiB 或顶层不是对象的搜索响应，异常消息不包含响应正文。"""

        oversized = _FakeResponse(
            {},
            content=b"x" * (web_search.MAX_DIRECT_SEARCH_RESPONSE_BYTES + 1),
        )
        with self.assertRaises(RuntimeError):
            web_search._read_direct_search_json(oversized, "Test")
        with self.assertRaises(RuntimeError):
            web_search._read_direct_search_json(_FakeResponse([]), "Test")


if __name__ == "__main__":
    unittest.main()
