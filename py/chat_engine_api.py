# -*- coding: utf-8 -*-
"""Typed chat routes owned by the private Desktop Execution Engine."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union

from fastapi import APIRouter, FastAPI, Request
from pydantic import BaseModel, Field


CHAT_ENGINE_PATHS = frozenset({
    "/v1/chat/completions",
    "/simple_chat",
    "/v1/chat/abort",
    "/v1/models",
    "/execute_tool_manually",
    "/v1/chat/tools/approval",
})

ChatHandler = Callable[[Dict[str, Any], Request], Awaitable[Any]]
SimpleChatHandler = Callable[[Dict[str, Any]], Awaitable[Any]]
EmptyCommandHandler = Callable[[], Awaitable[Any]]
AbortHandler = Callable[[str], bool]
PayloadCommandHandler = Callable[[Dict[str, Any]], Awaitable[Any]]


class ApplicationChatRequest(BaseModel):
    """Exact provider request accepted from the typed Main-process transport."""

    model_config = {"extra": "forbid"}
    messages: List[Dict[str, Any]] = Field(min_length=1, max_length=256)
    model: Optional[str] = None
    tools: Optional[Union[List[Dict[str, Any]], Dict[str, Any]]] = None
    stream: bool = False
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    top_p: Optional[float] = 1
    fileLinks: Optional[List[str]] = None
    enable_thinking: bool = False
    enable_deep_research: bool = False
    enable_web_search: bool = False
    asyncToolsID: Optional[List[str]] = None
    reasoning_effort: Optional[str] = None
    is_app_bot: bool = False
    is_sub_agent: bool = False
    behavior_trigger: bool = False
    enable_tools: Optional[List[str]] = None
    disable_tools: Optional[List[str]] = None
    conversationId: Optional[str] = None
    conversation_id: Optional[str] = None


class ApplicationChatAbortRequest(BaseModel):
    """Exact provider conversation cancellation command."""

    model_config = {"extra": "forbid"}
    conversationId: str = Field(min_length=1, max_length=128)


class ApplicationChatToolRequest(BaseModel):
    """Exact manual tool execution command accepted from Electron Main."""

    model_config = {"extra": "forbid"}
    tool_name: str = Field(min_length=1, max_length=128)
    tool_params: Dict[str, Any] = Field(default_factory=dict)
    approval_type: str = Field(default="", max_length=512)
    approval_id: str = Field(default="", max_length=512)
    trace_id: str = Field(default="", max_length=512)


class ApplicationChatApprovalRequest(BaseModel):
    """Exact tool approval resolution command accepted from Electron Main."""

    model_config = {"extra": "forbid"}
    approval_id: str = Field(min_length=1, max_length=128)
    resolution: str = Field(pattern="^(approved|denied)$")
    reason: str = Field(default="", max_length=512)
    consume: bool = True


@dataclass(frozen=True)
class ChatEngineDependencies:
    """Explicit adapters from private routes to the existing provider runtime."""

    run_chat: ChatHandler
    run_simple_chat: SimpleChatHandler
    list_models: EmptyCommandHandler
    abort_chat: AbortHandler
    execute_tool: PayloadCommandHandler
    resolve_approval: PayloadCommandHandler


class ChatEngineApi:
    """Own the six exact Desktop Chat routes without exposing the monolith."""

    def __init__(self, dependencies: ChatEngineDependencies) -> None:
        """Create one stateless typed Chat API."""

        self._dependencies = dependencies

    def create_router(self) -> APIRouter:
        """Create the exact private Chat router."""

        router = APIRouter()
        router.add_api_route("/v1/chat/completions", self.chat, methods=["POST"])
        router.add_api_route("/simple_chat", self.simple_chat, methods=["POST"])
        router.add_api_route("/v1/chat/abort", self.abort, methods=["POST"])
        router.add_api_route("/v1/models", self.models, methods=["POST"])
        router.add_api_route("/execute_tool_manually", self.execute_tool, methods=["POST"])
        router.add_api_route("/v1/chat/tools/approval", self.resolve_approval, methods=["POST"])
        return router

    async def chat(self, req: ApplicationChatRequest, request: Request) -> Any:
        """Run one full chat request through the credential-retaining provider adapter."""

        return await self._dependencies.run_chat(req.model_dump(), request)

    async def simple_chat(self, req: ApplicationChatRequest) -> Any:
        """Run one simple chat request through the credential-retaining provider adapter."""

        return await self._dependencies.run_simple_chat(req.model_dump())

    async def abort(self, req: ApplicationChatAbortRequest) -> Dict[str, Any]:
        """Abort one provider conversation without exposing internal stream state."""

        cancelled = bool(self._dependencies.abort_chat(req.conversationId))
        return {"aborted": cancelled, "conversationId": req.conversationId}

    async def models(self) -> Any:
        """Return the provider and agent model catalog."""

        return await self._dependencies.list_models()

    async def execute_tool(self, req: ApplicationChatToolRequest) -> Any:
        """Execute one typed manual tool command through the governed runtime."""

        return await self._dependencies.execute_tool(req.model_dump())

    async def resolve_approval(self, req: ApplicationChatApprovalRequest) -> Any:
        """Resolve one governed tool approval through a narrow adapter."""

        return await self._dependencies.resolve_approval(req.model_dump())


def register_chat_engine_api(
    application: FastAPI,
    dependencies: ChatEngineDependencies,
) -> ChatEngineApi:
    """Register the typed Chat routes and return their stateless owner."""

    api = ChatEngineApi(dependencies)
    application.include_router(api.create_router())
    return api
