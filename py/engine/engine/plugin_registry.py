"""
OpenXnet v0.5.2 — Plugin Registry (plugin_registry.py)
======================================================
"""

from typing import Dict, List, Optional
import logging
from .plugin_sdk import BaseTool

logger = logging.getLogger("plugin_registry")

class PluginRegistry:
    """
    Central repository for all OpenXnet Tools mimicking OpenClaw's plugin-sdk architecture.
    """
    
    def __init__(self):
        self._tools: Dict[str, BaseTool] = {}

    def register(self, tool: BaseTool):
        """Register a locally implemented tool that inherits from BaseTool."""
        if tool.name in self._tools:
            logger.warning(f"Tool {tool.name} is already registered. Overwriting.")
        self._tools[tool.name] = tool
        logger.info(f"[PluginRegistry] Registered tool: {tool.name}")

    def get_tool(self, name: str) -> Optional[BaseTool]:
        return self._tools.get(name)

    def get_all_tools(self) -> List[BaseTool]:
        return list(self._tools.values())

    def get_openai_tools(self) -> List[Dict]:
        """Convert all registered tools to the OpenAI Tools format for passing to the API."""
        return [t.to_openai_schema() for t in self._tools.values()]

    async def execute_tool(self, name: str, **kwargs) -> Dict:
        """
        Execute a tool by name and return its standard ToolExecutionResult directly
        converted to dict format for serialization or LLM context appending.
        """
        tool = self.get_tool(name)
        if not tool:
            return {"success": False, "data": None, "error_message": f"Plugin {name} not found in registry."}
            
        try:
            result = await tool.execute(**kwargs)
            return result.model_dump()
        except Exception as e:
            return {"success": False, "data": None, "error_message": f"Plugin Execution Error: {str(e)}"}

# Global singleton
_global_plugin_registry = PluginRegistry()

def get_plugin_registry() -> PluginRegistry:
    return _global_plugin_registry
