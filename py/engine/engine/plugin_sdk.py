"""
OpenXnet v0.5.2 — Plugin SDK (plugin_sdk.py)
============================================

Inspired by OpenClaw's plugin-sdk architecture.
Provides the abstract base definitions for all internal OpenXnet Tools.
Every tool (weather, time, deep search, file execution) must inherit from `BaseTool`
and register via `PluginRegistry`.

Key capabilities:
- Native async `execute` method
- Declarative JSON Schema output for OpenAI tool calling
- Lifecycle hooks (on_register, on_unload)
- Dependency injection hooks
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List
from pydantic import BaseModel
import logging

logger = logging.getLogger("plugin_sdk")

class ToolExecutionResult(BaseModel):
    """
    Standardized payload returned by any internal Tool Execution.
    The QueryEngine uses this to determine if the tool finished gracefully
    and what to append to the LLM context.
    """
    success: bool
    data: Any
    error_message: Optional[str] = None
    ui_title: Optional[str] = None  # Brief title for the UI timeline (e.g. "✅ Got Time")

class BaseTool(ABC):
    """
    The Base Tool Plugin class. All internal OpenXnet tools must inherit from this.
    """
    
    @property
    @abstractmethod
    def name(self) -> str:
        """The tool name matching OpenAI regex `^[a-zA-Z0-9_-]{1,64}$`"""
        pass

    @property
    @abstractmethod
    def description(self) -> str:
        """Clear description of what the tool does and when the LLM should invoke it"""
        pass

    @property
    @abstractmethod
    def parameters_schema(self) -> Dict[str, Any]:
        """
        JSON schema dict defining the parameters this tool expects.
        Example:
        {
            "type": "object",
            "properties": {"city": {"type": "string"}},
            "required": ["city"]
        }
        """
        pass
        
    @property
    def requires_permission(self) -> bool:
        """
        [Inspired by CC-Source permissions] 
        If True, the QueryEngine must pause and ask the User for permission 
        before executing this tool locally.
        """
        return False

    @abstractmethod
    async def execute(self, **kwargs) -> ToolExecutionResult:
        """
        The core async logic of the tool.
        Returns a standardised ToolExecutionResult.
        """
        pass

    # Lifecycle hooks --------------------------------------------------------
    
    async def on_register(self, registry_context: Dict[str, Any]):
        """Fired when the tool is successfully loaded into the PluginRegistry."""
        pass

    async def on_unload(self):
        """Fired when the engine is shutting down or tearing down tools."""
        pass

    def to_openai_schema(self) -> Dict[str, Any]:
        """
        Export this plugin into the standard OpenAI Function Calling Dict.
        """
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters_schema
            }
        }
