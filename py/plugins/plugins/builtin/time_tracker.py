"""
OpenXnet v0.5.2 — Time Plugin (time_tracker.py)
===============================================
Migrated from the legacy utility_tools.py to the new Plugin-SDK structure.
"""

from datetime import datetime
from zoneinfo import ZoneInfo
from tzlocal import get_localzone
from typing import Dict, Any

from py.engine.plugin_sdk import BaseTool, ToolExecutionResult

class TimeTool(BaseTool):
    @property
    def name(self) -> str:
        return "time"

    @property
    def description(self) -> str:
        return "获取当前时间（带时区信息）"

    @property
    def parameters_schema(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "timezone": {
                    "type": "string",
                    "description": "当前时区，默认为本地时区，格式为：Asia/Shanghai",
                },
            },
            "required": [],
        }

    @property
    def requires_permission(self) -> bool:
        return False

    async def execute(self, **kwargs) -> ToolExecutionResult:
        timezone = kwargs.get("timezone")
        try:
            local_timezone = get_localzone()
            tz = ZoneInfo(timezone) if timezone else local_timezone
            now = datetime.now(tz=tz)
            time_message = f"当前时间：{now.strftime('%Y-%m-%d %H:%M:%S')}，时区：{tz}"
            
            return ToolExecutionResult(
                success=True,
                data=time_message,
                ui_title=f"🕒 获取时间 ({tz})"
            )
        except Exception as e:
            return ToolExecutionResult(
                success=False,
                data=None,
                error_message=f"时间获取失败: {str(e)}",
                ui_title="❌ 时间获取失败"
            )
