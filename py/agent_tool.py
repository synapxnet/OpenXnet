#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
Agent 工具 — Agent 间调用与委托的工具函数。

Author: maoyo
Department: 研发部
Date: 2026-04-13
Version: 1.0.0
Security Level: INTERNAL
"""

__version__ = "1.0.0"
__author__ = "maoyo"
__copyright__ = "Copyright 2026 Synapxnet"
__maintainer__ = "maoyo"
__email__ = "synapxnet@gmail.com"

import json
from py.get_setting import get_host, get_port
from openai import AsyncOpenAI
async def get_agent_tool(settings):
    tool_agent_list = []
    for agent_id,agent_config in settings['agents'].items():
        if agent_config['enabled']:
            tool_agent_list.append({"agent_id": agent_id, "agent_skill": agent_config["system_prompt"]})
    if len(tool_agent_list) > 0:
        tool_agent_list = json.dumps(tool_agent_list, ensure_ascii=False, indent=4)
        agent_tool = {
            "type": "function",
            "function": {
                "name": "agent_tool_call",
                "description": f"根据Agent给出的agent_skill调用指定Agent工具，返回结果。当前可用的Agent工具ID以及Agent工具的agent_skill有：{tool_agent_list}",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "agent_id": {
                            "type": "string",
                            "description": "需要调用的Agent工具ID",
                        },
                        "query": {
                            "type": "string",
                            "description": "需要向Agent工具发送的问题",
                        }
                    },
                    "required": ["agent_id", "query"]
                }
            }
        }
    else:
        agent_tool = None
    return agent_tool

async def agent_tool_call(agent_id, query):
    try:
        host = get_host()
        if host == "0.0.0.0":
            host = "127.0.0.1"
        port = get_port()
        client = AsyncOpenAI(
            api_key="openxnet-local",
            base_url=f"http://{host}:{port}/v1"
        )
        response = await client.chat.completions.create(
            model=agent_id,
            messages=[
                {"role": "user", "content": query}
            ]
        )
        res = response.choices[0].message.content
        return str(res)
    except Exception as e:
        print(f"Error: {e}")
        return str(e)
