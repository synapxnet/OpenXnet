# -*- coding: utf-8 -*-
"""Lazy provider-tool registry owned by the independent Execution Engine boundary."""

from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import dataclass
from typing import Any


SENSITIVE_EXECUTION_TOOL_NAMES = frozenset({
    "docker_sandbox",
    "edit_file_tool",
    "edit_file_patch_tool",
    "todo_write_tool",
    "shell_tool_local",
    "edit_file_tool_local",
    "edit_file_patch_tool_local",
    "todo_write_tool_local",
    "manage_processes_tool",
    "docker_manage_ports_tool",
    "local_net_tool",
})

ALLOWED_EXTRA_TOOL_NAMES = frozenset({
    "get_image_content",
    "openxnet_apply_config_intent",
    "openxnet_create_character_card",
    "openxnet_parse_config_intent",
})


@dataclass(frozen=True)
class ExecutionToolRegistry:
    """Resolved lazy tool hooks and the custom HTTP adapter used by dispatch."""

    hooks: dict[str, Callable[..., Any]]
    custom_http: Callable[..., Any]


def build_execution_tool_registry(
    extra_hooks: Mapping[str, Callable[..., Any]] | None = None,
) -> ExecutionToolRegistry:
    """Import the complete provider-tool closure only when a tool is requested."""

    normalized_extra_hooks = dict(extra_hooks or {})
    for name, callback in normalized_extra_hooks.items():
        if name not in ALLOWED_EXTRA_TOOL_NAMES or not callable(callback):
            raise ValueError(f"Execution Engine extra tool hook '{name}' is not allowed.")

    from py.a2a_tool import a2a_tool_call
    from py.agent_tool import agent_tool_call
    from py.autoBehavior import auto_behavior
    from py.cdp_tool import (
        click,
        close_page,
        drag,
        evaluate_script,
        fill,
        fill_form,
        handle_dialog,
        hover,
        list_pages,
        navigate_page,
        new_page,
        press_key,
        select_page,
        take_screenshot,
        take_snapshot,
        wait_for,
    )
    from py.cli_tool import (
        claude_code,
        docker_manage_ports_tool,
        docker_sandbox,
        edit_file_patch_tool,
        edit_file_patch_tool_local,
        edit_file_tool,
        edit_file_tool_local,
        glob_files_tool,
        glob_files_tool_local,
        list_files_tool,
        list_files_tool_local,
        local_net_tool,
        manage_processes_tool,
        openai_codex,
        qwen_code,
        read_file_range_tool,
        read_file_range_tool_local,
        read_file_tool,
        read_file_tool_local,
        read_skill_tool,
        read_skill_tool_local,
        search_files_tool,
        search_files_tool_local,
        shell_tool_local,
        tail_file_tool,
        tail_file_tool_local,
        todo_write_tool,
        todo_write_tool_local,
    )
    from py.code_interpreter import e2b_code, local_run_code
    from py.comfyui_tool import comfyui_tool_call
    from py.computer_use_tool import (
        copy_to_input_box,
        keyboard_hold,
        keyboard_hotkey,
        keyboard_press,
        keyboard_sequence,
        mouse_click,
        mouse_double_click,
        mouse_drag,
        mouse_hold,
        mouse_move,
        mouse_scroll,
        screenshot,
        wait,
    )
    from py.custom_http import fetch_custom_http
    from py.know_base import query_knowledge_base
    from py.llm_tool import custom_llm_tool
    from py.load_files import get_file_content
    from py.pollinations import openai_chat_image, openai_image, pollinations_image
    from py.random_topic import get_categories, get_random_topics
    from py.task_tools import (
        cancel_subtask,
        create_subtask,
        finish_task,
        query_task_progress,
        start_subtask,
    )
    from py.utility_tools import (
        get_location_coordinates,
        get_weather,
        get_weather_by_city,
        get_wikipedia_section_content,
        get_wikipedia_summary_and_sections,
        search_arxiv_papers,
        time,
    )
    from py.web_search import (
        Bing_search,
        Brave_search,
        Crawl4Ai_search,
        DDGsearch,
        Exa_search,
        Google_search,
        Serper_search,
        Tavily_search,
        bochaai_search,
        firecrawl_search,
        jina_crawler,
        markdown_new,
        searxng,
        simple_fetch,
    )

    hooks = {
        "DDGsearch": DDGsearch,
        "searxng": searxng,
        "Tavily_search": Tavily_search,
        "query_knowledge_base": query_knowledge_base,
        "jina_crawler": jina_crawler,
        "Crawl4Ai_search": Crawl4Ai_search,
        "firecrawl_search": firecrawl_search,
        "simple_fetch": simple_fetch,
        "markdown_new": markdown_new,
        "agent_tool_call": agent_tool_call,
        "a2a_tool_call": a2a_tool_call,
        "custom_llm_tool": custom_llm_tool,
        "pollinations_image": pollinations_image,
        "get_file_content": get_file_content,
        "e2b_code": e2b_code,
        "local_run_code": local_run_code,
        "openai_image": openai_image,
        "openai_chat_image": openai_chat_image,
        "Bing_search": Bing_search,
        "Google_search": Google_search,
        "Brave_search": Brave_search,
        "Exa_search": Exa_search,
        "Serper_search": Serper_search,
        "bochaai_search": bochaai_search,
        "comfyui_tool_call": comfyui_tool_call,
        "time": time,
        "get_weather": get_weather,
        "get_location_coordinates": get_location_coordinates,
        "get_weather_by_city": get_weather_by_city,
        "get_wikipedia_summary_and_sections": get_wikipedia_summary_and_sections,
        "get_wikipedia_section_content": get_wikipedia_section_content,
        "search_arxiv_papers": search_arxiv_papers,
        "auto_behavior": auto_behavior,
        "claude_code": claude_code,
        "openai_codex": openai_codex,
        "qwen_code": qwen_code,
        "list_pages": list_pages,
        "new_page": new_page,
        "close_page": close_page,
        "select_page": select_page,
        "navigate_page": navigate_page,
        "take_snapshot": take_snapshot,
        "click": click,
        "fill": fill,
        "evaluate_script": evaluate_script,
        "take_screenshot": take_screenshot,
        "hover": hover,
        "press_key": press_key,
        "wait_for": wait_for,
        "fill_form": fill_form,
        "drag": drag,
        "handle_dialog": handle_dialog,
        "get_random_topics": get_random_topics,
        "get_categories": get_categories,
        "docker_sandbox": docker_sandbox,
        "list_files_tool": list_files_tool,
        "read_file_tool": read_file_tool,
        "read_file_range_tool": read_file_range_tool,
        "tail_file_tool": tail_file_tool,
        "search_files_tool": search_files_tool,
        "edit_file_tool": edit_file_tool,
        "edit_file_patch_tool": edit_file_patch_tool,
        "glob_files_tool": glob_files_tool,
        "todo_write_tool": todo_write_tool,
        "manage_processes_tool": manage_processes_tool,
        "docker_manage_ports_tool": docker_manage_ports_tool,
        "read_skill_tool": read_skill_tool,
        "shell_tool_local": shell_tool_local,
        "list_files_tool_local": list_files_tool_local,
        "read_file_tool_local": read_file_tool_local,
        "read_file_range_tool_local": read_file_range_tool_local,
        "tail_file_tool_local": tail_file_tool_local,
        "search_files_tool_local": search_files_tool_local,
        "edit_file_tool_local": edit_file_tool_local,
        "edit_file_patch_tool_local": edit_file_patch_tool_local,
        "glob_files_tool_local": glob_files_tool_local,
        "todo_write_tool_local": todo_write_tool_local,
        "local_net_tool": local_net_tool,
        "read_skill_tool_local": read_skill_tool_local,
        "create_subtask": create_subtask,
        "query_task_progress": query_task_progress,
        "cancel_subtask": cancel_subtask,
        "start_subtask": start_subtask,
        "finish_task": finish_task,
        "mouse_move": mouse_move,
        "mouse_click": mouse_click,
        "mouse_double_click": mouse_double_click,
        "mouse_drag": mouse_drag,
        "mouse_scroll": mouse_scroll,
        "mouse_hold": mouse_hold,
        "copy_to_input_box": copy_to_input_box,
        "keyboard_press": keyboard_press,
        "keyboard_sequence": keyboard_sequence,
        "keyboard_hotkey": keyboard_hotkey,
        "keyboard_hold": keyboard_hold,
        "wait": wait,
        "screenshot": screenshot,
    }
    for name, callback in normalized_extra_hooks.items():
        hooks[name] = callback
    return ExecutionToolRegistry(hooks=hooks, custom_http=fetch_custom_http)
