#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright 2026 Synapxnet
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
# ==============================================================================
"""
A2A 工具 — Agent-to-Agent 协议工具函数。

Author: maoyo
Date: 2026-04-13
Version: 1.0.0
"""

__version__ = "1.0.0"
__author__ = "maoyo"
__copyright__ = "Copyright 2026 Synapxnet"
__license__ = "Apache-2.0"
__maintainer__ = "maoyo"
__email__ = "synapxnet@gmail.com"

import json

from py.a2a_client import A2AClientError, ask_a2a_agent

async def get_a2a_tool(settings):
    """构建 A2A 工具定义；输入运行设置，返回启用节点说明，没有节点时返回 None。"""

    a2a_agent_list = []
    for a2a_agent_url, a2a_agent_config in (settings.get("a2aServers") or {}).items():
        if isinstance(a2a_agent_config, dict) and a2a_agent_config.get("enabled"):
            a2a_agent_list.append({
                "agent_url": a2a_agent_url,
                "agent_description": a2a_agent_config.get("description", ""),
                "agent_skills": a2a_agent_config.get("skills", []),
            })
    if len(a2a_agent_list) > 0:
        a2a_agent_list = json.dumps(a2a_agent_list, ensure_ascii=False, indent=4)
        agent_tool = {
            "type": "function",
            "function": {
                "name": "a2a_tool_call",
                "description": f"参考A2A智能体中的配置信息调用指定A2A服务，返回结果。当前可用的A2A服务器有：{a2a_agent_list}",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "agent_url": {
                            "type": "string",
                            "description": "需要调用的A2A智能体URL",
                        },
                        "query": {
                            "type": "string",
                            "description": "需要向A2A智能体发送的问题",
                        }
                    },
                    "required": ["agent_url", "query"]
                }
            }
        }
        return agent_tool
    else:
        return None

async def a2a_tool_call(agent_url, query):
    """调用远程 A2A Agent；输入端点和问题，返回文本结果，失败时返回固定公开错误。"""

    try:
        return await ask_a2a_agent(agent_url, query)
    except A2AClientError:
        return "A2A 调用失败。"
