# -*- coding: utf-8 -*-
"""Tests for dependency-free YouTube and Google Custom Search REST clients."""

from __future__ import annotations

from io import BytesIO
from io import StringIO
from contextlib import redirect_stdout
import json
from urllib import error as urllib_error
from urllib import parse as urllib_parse
import unittest
from unittest.mock import AsyncMock, patch

import requests

from py.web_search import Google_search, GoogleSearchError, _google_custom_search_results, _log_search_failure
from py.ytdm import YouTubeApiError, YouTubeDMClient, _load_json_url


class FakeGoogleResponse:
    """Small requests-compatible response double."""

    def __init__(self, payload: dict, status_code: int = 200) -> None:
        """Create one fake response with JSON content and status."""

        self._payload = payload
        self.status_code = status_code

    def raise_for_status(self) -> None:
        """Raise requests.HTTPError for configured failure statuses."""

        if self.status_code >= 400:
            error = requests.HTTPError(f"HTTP {self.status_code}")
            error.response = self  # type: ignore[assignment]
            raise error

    def json(self) -> dict:
        """Return the configured JSON object."""

        return self._payload


class YouTubeRestClientTests(unittest.TestCase):
    """Validate YouTube REST URLs, normalization, and credential-safe errors."""

    def test_resolves_chat_and_emits_messages_without_google_sdk(self) -> None:
        """Preserve live-chat lookup, pagination token, and callback message fields."""

        requested_urls: list[str] = []
        messages: list[dict] = []

        def transport(url: str, _timeout: float) -> dict:
            """Return deterministic video and live-chat responses by URL path."""

            requested_urls.append(url)
            if "/videos?" in url:
                return {
                    "items": [
                        {"liveStreamingDetails": {"activeLiveChatId": "chat-one"}}
                    ]
                }
            return {
                "items": [
                    {
                        "authorDetails": {"displayName": "Alice"},
                        "snippet": {"displayMessage": "Hello"},
                    }
                ],
                "nextPageToken": "page-two",
            }

        client = YouTubeDMClient(
            "secret-key",
            "video-one",
            messages.append,
            json_transport=transport,
        )
        client._chat_id = client._get_live_chat_id()
        client._poll_once()

        self.assertEqual(client._chat_id, "chat-one")
        self.assertEqual(client._page_token, "page-two")
        self.assertEqual(messages[0]["content"], "Alice said: Hello")
        self.assertEqual(messages[0]["platform"], "youtube")
        video_query = urllib_parse.parse_qs(urllib_parse.urlparse(requested_urls[0]).query)
        chat_query = urllib_parse.parse_qs(urllib_parse.urlparse(requested_urls[1]).query)
        self.assertEqual(video_query["id"], ["video-one"])
        self.assertEqual(video_query["key"], ["secret-key"])
        self.assertEqual(chat_query["liveChatId"], ["chat-one"])
        self.assertEqual(chat_query["maxResults"], ["2000"])

    def test_http_errors_do_not_leak_api_key(self) -> None:
        """Exclude request query credentials from surfaced YouTube errors."""

        body = BytesIO(json.dumps({"error": {"message": "quota exceeded"}}).encode("utf-8"))
        error = urllib_error.HTTPError(
            "https://example.invalid?key=secret-key",
            403,
            "Forbidden",
            {},
            body,
        )
        with patch("py.ytdm.urllib_request.urlopen", side_effect=error):
            with self.assertRaises(YouTubeApiError) as captured:
                _load_json_url("https://example.invalid?key=secret-key", 1.0)

        self.assertNotIn("secret-key", str(captured.exception))
        self.assertIn("HTTP 403", str(captured.exception))


class GoogleCustomSearchTests(unittest.IsolatedAsyncioTestCase):
    """Validate direct Google Custom Search pagination and legacy JSON output."""

    def test_paginates_and_normalizes_results(self) -> None:
        """Request at most ten items per page and preserve title/link/snippet fields."""

        calls: list[dict] = []

        def request_get(_url: str, **options) -> FakeGoogleResponse:
            """Return two deterministic Custom Search pages."""

            calls.append(options)
            start = int(options["params"]["start"])
            count = int(options["params"]["num"])
            items = [
                {
                    "title": f"Title {index}",
                    "link": f"https://example.com/{index}",
                    "snippet": f"Snippet {index}",
                }
                for index in range(start, start + count)
            ]
            return FakeGoogleResponse({"items": items})

        results = _google_custom_search_results(
            "openxnet",
            "secret-key",
            "cse-one",
            12,
            request_get=request_get,
        )

        self.assertEqual(len(results), 12)
        self.assertEqual(calls[0]["params"]["start"], 1)
        self.assertEqual(calls[0]["params"]["num"], 10)
        self.assertEqual(calls[1]["params"]["start"], 11)
        self.assertEqual(calls[1]["params"]["num"], 2)
        self.assertEqual(results[0]["title"], "Title 1")

    def test_transport_errors_do_not_leak_api_key(self) -> None:
        """Return a credential-safe Google error even when requests stores its URL."""

        def request_get(_url: str, **_options) -> FakeGoogleResponse:
            """Raise one HTTP error containing a credential in its raw request text."""

            response = FakeGoogleResponse({}, status_code=403)
            error = requests.HTTPError("https://example.invalid?key=secret-key")
            error.response = response  # type: ignore[assignment]
            raise error

        with self.assertRaises(GoogleSearchError) as captured:
            _google_custom_search_results(
                "openxnet",
                "secret-key",
                "cse-one",
                10,
                request_get=request_get,
            )

        self.assertNotIn("secret-key", str(captured.exception))
        self.assertIn("HTTP 403", str(captured.exception))

    async def test_public_google_search_keeps_json_text_contract(self) -> None:
        """Keep the model-facing Google_search result as formatted JSON text."""

        settings = {
            "webSearch": {
                "google_max_results": 1,
                "google_api_key": "secret-key",
                "google_cse_id": "cse-one",
            }
        }
        normalized = [
            {"title": "OpenXnet", "link": "https://example.com", "snippet": "Result"}
        ]
        with patch("py.web_search.load_settings", new_callable=AsyncMock, return_value=settings):
            with patch("py.web_search._google_custom_search_results", return_value=normalized):
                result = await Google_search("openxnet")

        self.assertEqual(json.loads(result), normalized)

    def test_search_diagnostics_do_not_log_exception_messages(self) -> None:
        """Log only exception classes when an SDK message contains a search key."""

        output = StringIO()
        with redirect_stdout(output):
            _log_search_failure("Search failed", RuntimeError("credential=secret-key"))

        self.assertIn("RuntimeError", output.getvalue())
        self.assertNotIn("secret-key", output.getvalue())


if __name__ == "__main__":
    unittest.main()
