# -*- coding: utf-8 -*-
"""Profile isolation coverage for typed Desktop Connector Runtime controls."""

from __future__ import annotations

import unittest
from typing import Any

from py.routes import register_all_routes
from py.routes.bots import connector_router, router as telegram_router


class RecordingRouteHost:
    """Record routers included by the shared route registration helper."""

    def __init__(self) -> None:
        """Create one empty router list."""

        self.routers: list[Any] = []

    def include_router(self, router: Any) -> None:
        """Record one router without creating a live FastAPI application."""

        self.routers.append(router)


class ConnectorRuntimeProfileTests(unittest.TestCase):
    """Keep legacy Connector HTTP controls out of the Desktop route table."""

    def test_connector_http_routes_are_server_only(self) -> None:
        """Register Telegram everywhere and five Connector routes only for Server."""

        desktop = RecordingRouteHost()
        server = RecordingRouteHost()
        register_all_routes(desktop, include_connector_compatibility=False)  # type: ignore[arg-type]
        register_all_routes(server, include_connector_compatibility=True)  # type: ignore[arg-type]

        self.assertIn(telegram_router, desktop.routers)
        self.assertNotIn(connector_router, desktop.routers)
        self.assertIn(telegram_router, server.routers)
        self.assertIn(connector_router, server.routers)

        connector_paths = {route.path for route in connector_router.routes}
        telegram_paths = {route.path for route in telegram_router.routes}
        self.assertEqual(len(connector_paths), 20)
        self.assertTrue(all("telegram" not in path for path in connector_paths))
        self.assertEqual(telegram_paths, {
            "/start_telegram_bot",
            "/stop_telegram_bot",
            "/telegram_bot_status",
            "/reload_telegram_bot",
        })


if __name__ == "__main__":
    unittest.main()
