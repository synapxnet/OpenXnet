# -*- coding: utf-8 -*-
"""Kernel 私有 Execution Engine dispatcher 回归测试。"""

from __future__ import annotations

import unittest
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException

from py.kernel_engine_api import KernelCommandRequest, KernelEngineApi


class KernelEngineApiTests(unittest.IsolatedAsyncioTestCase):
    """验证固定操作映射、双层校验和公开结果脱敏。"""

    def setUp(self) -> None:
        """创建无状态私有 API；无输入和返回，不访问真实 Kernel 存储。"""

        self._api = KernelEngineApi()

    async def test_status_dispatch_redacts_secrets_without_truncating_lists(self) -> None:
        """验证状态操作调用固定函数，并脱敏密钥且保留 120 条有界事件。"""

        status = {
            "ok": True,
            "api_key": "must-not-return",
            "events": list(range(120)),
        }
        with patch.object(
            __import__("py.kernel_engine_api", fromlist=["kernel_routes"]).kernel_routes,
            "kernel_status",
            AsyncMock(return_value=status),
        ) as mocked:
            result = await self._api.command(KernelCommandRequest(
                operation="status",
                payload={},
            ))
        mocked.assert_awaited_once_with()
        self.assertEqual(result["schema"], "openxnet.kernel-runtime.v1")
        self.assertEqual(result["data"]["api_key"], "[REDACTED]")
        self.assertEqual(len(result["data"]["events"]), 120)

    async def test_action_queue_maps_camel_case_to_fixed_route_arguments(self) -> None:
        """验证动作队列结构化参数映射为固定函数参数，不接受 URL 或方法字段。"""

        module = __import__("py.kernel_engine_api", fromlist=["kernel_routes"])
        with patch.object(
            module.kernel_routes,
            "kernel_plan_action_queue",
            AsyncMock(return_value={"ok": True, "actions": []}),
        ) as mocked:
            result = await self._api.command(KernelCommandRequest(
                operation="action-queue",
                payload={
                    "limit": 12,
                    "status": "",
                    "source": "",
                    "allowLowRisk": True,
                    "maxSteps": 3,
                    "includeComplete": False,
                    "actionType": "",
                    "queueStatus": "",
                    "sort": "priority",
                },
            ))
        mocked.assert_awaited_once_with(
            limit=12,
            status="",
            source="",
            allow_low_risk=True,
            max_steps=3,
            include_complete=False,
            action_type="",
            queue_status="",
            sort="priority",
        )
        self.assertEqual(result["data"], {"ok": True, "actions": []})

    async def test_operation_payload_rejects_extra_authority_fields(self) -> None:
        """验证操作载荷拒绝 endpoint；输入非法字段时抛出固定 422，且不调用旧路由。"""

        with self.assertRaises(HTTPException) as context:
            await self._api.command(KernelCommandRequest(
                operation="status",
                payload={"endpoint": "/v1/kernel/status"},
            ))
        self.assertEqual(context.exception.status_code, 422)


if __name__ == "__main__":
    unittest.main()
