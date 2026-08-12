"""
OpenXnet v0.5.2 — Weather Plugin (weather_plugin.py)
====================================================
Migrated from the legacy utility_tools.py to the new Plugin-SDK structure.
"""

from typing import Dict, Any
import aiohttp
from py.engine.plugin_sdk import BaseTool, ToolExecutionResult

class WeatherTool(BaseTool):
    @property
    def name(self) -> str:
        return "get_weather"

    @property
    def description(self) -> str:
        return "查询城市天气（实时或预报）"

    @property
    def parameters_schema(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "city": {
                    "type": "string",
                    "description": "城市名称，如：北京、New York",
                },
                "forecast": {
                    "type": "boolean",
                    "description": "是否为天气预报（false为实时天气）",
                    "default": False
                },
                "days": {
                    "type": "integer",
                    "description": "预报天数为1到7天",
                    "default": 1,
                    "minimum": 1,
                    "maximum": 7
                },
            },
            "required": ["city"],
        }

    async def execute(self, **kwargs) -> ToolExecutionResult:
        city = kwargs.get("city")
        forecast = kwargs.get("forecast", False)
        days = kwargs.get("days", 1)

        try:
            # 1. 经纬度
            geo = await self._get_lat_lon(city)

            # 2. 天气数据
            data = await self._call_open_meteo(
                geo["latitude"], geo["longitude"], geo["timezone"], forecast, days
            )

            if forecast:
                daily = data["daily"]
                result = [
                    f"{city}的{days}天天气预报:",
                    "概况: 基于Open-Meteo全球模式",
                    "每日预报:",
                ]
                for i in range(days):
                    date = daily["time"][i]
                    tmax = daily["temperature_2m_max"][i]
                    tmin = daily["temperature_2m_min"][i]
                    code = daily["weathercode"][i]
                    result.append(
                        f"- {date}: 白天{tmax}°C/{self._desc(code)}, 夜间{tmin}°C/{self._desc(code)}"
                    )
                content = "\n".join(result)
            else:
                cw = data["current_weather"]
                content = (
                    f"{city}实时天气:\n"
                    f"温度: {cw['temperature']}°C\n"
                    f"天气状况: {self._desc(cw['weathercode'])}\n"
                    f"风速: {cw['windspeed']} km/h"
                )

            return ToolExecutionResult(
                success=True,
                data=content,
                ui_title=f"☁️ 获取 {city} 天气"
            )

        except Exception as e:
            return ToolExecutionResult(
                success=False,
                data=None,
                error_message=f"查询天气时出错: {str(e)}",
                ui_title=f"❌ 获取 {city} 天气失败"
            )

    # 内部辅助方法
    async def _get_lat_lon(self, city: str) -> Dict[str, float]:
        url = "https://geocoding-api.open-meteo.com/v1/search"
        params = {"name": city, "count": 1, "language": "zh"}
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params) as resp:
                if resp.status != 200:
                    raise RuntimeError("地理编码请求失败")
                data = await resp.json()
        if not data.get("results"):
            raise RuntimeError(f"未找到城市: {city}")
        r = data["results"][0]
        return {
            "latitude": r["latitude"],
            "longitude": r["longitude"],
            "timezone": r.get("timezone", "Asia/Shanghai"),
        }

    async def _call_open_meteo(self, lat: float, lon: float, timezone: str, forecast: bool, days: int):
        if forecast:
            url = "https://api.open-meteo.com/v1/forecast"
            params = {
                "latitude": lat,
                "longitude": lon,
                "daily": "temperature_2m_max,temperature_2m_min,weathercode",
                "timezone": timezone,
                "forecast_days": days,
            }
        else:
            url = "https://api.open-meteo.com/v1/forecast"
            params = {
                "latitude": lat,
                "longitude": lon,
                "current_weather": "true",
                "timezone": timezone,
            }

        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params) as resp:
                if resp.status != 200:
                    raise RuntimeError("天气接口请求失败")
                return await resp.json()

    def _desc(self, code: int) -> str:
        _WCODE_MAP = {
            0: "晴", 1: "多云", 2: "少云", 3: "晴间多云", 45: "雾", 48: "雾凇",
            51: "毛毛雨", 53: "小雨", 55: "中雨", 61: "小雨", 63: "中雨",
            65: "大雨", 71: "小雪", 73: "中雪", 75: "大雪", 95: "雷暴",
            96: "雷暴伴冰雹", 99: "强雷暴伴冰雹",
        }
        return _WCODE_MAP.get(code, "未知")
