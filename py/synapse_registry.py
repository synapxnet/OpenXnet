#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
SynapseRegistry 突触注册中心 — 统一管理工具/技能注册、可塑性热加载和突触权重。

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

"""
SynapseRegistry — 统一工具注册中心 + 突触可塑性引擎

OpenXnet Synapse v1.0 核心模块

所有工具类型的统一注册表:
  - 内置工具 (cli_tool, web_search, computer_use, cdp_tool...)
  - MCP Servers (via mcp_clients.py)
  - A2A Agents (via a2a_tool.py)
  - Custom HTTP (via custom_http.py)
  - Skills (via skills.py)
  - LLM Tools (via llm_tool.py)

每个工具是一个 SynapseNode, 携带:
  - weight: 突触权重 (0.0 - 1.0)
  - call_count: 调用次数
  - success_count: 成功次数
  - fail_count: 失败次数
  - avg_latency_ms: 平均延迟 (毫秒)
  - last_used: 最后使用时间

突触可塑性模型:
  W(t+1) = W(t) × decay + Δ × learning_rate
  decay = 0.995
  Δ = +0.10 on success (LTP)
      -0.30 on failure (LTD)
      +0.20 on user selection (attention reinforcement)
      ×0.50 after 30 days dormant (pruning)
"""

import time
import json
import os
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field, asdict


@dataclass
class SynapseNode:
    """单个突触节点 — 代表一个已注册的工具"""
    name: str
    type: str          # 'builtin' | 'mcp' | 'a2a' | 'custom_http' | 'skill' | 'llm_tool'
    description: str = ''
    weight: float = 0.5       # 初始权重 (突触生长)
    call_count: int = 0
    success_count: int = 0
    fail_count: int = 0
    total_latency_ms: float = 0.0
    last_used: float = 0.0    # timestamp
    last_error: str = ''
    metadata: Dict = field(default_factory=dict)

    @property
    def avg_latency_ms(self) -> float:
        if self.call_count == 0:
            return 0.0
        return self.total_latency_ms / self.call_count

    @property
    def success_rate(self) -> float:
        if self.call_count == 0:
            return 0.0
        return self.success_count / self.call_count

    def to_dict(self) -> Dict:
        d = asdict(self)
        d['avg_latency_ms'] = self.avg_latency_ms
        d['success_rate'] = self.success_rate
        return d


class SynapseRegistry:
    """
    统一工具注册中心 + 突触可塑性引擎

    Usage:
        registry = SynapseRegistry(persist_path="./synapse_data.json")
        registry.register("web_search", "builtin", "Web搜索工具")
        registry.register("my_mcp_tool", "mcp", "MCP Server 工具")

        # 工具调用
        registry.on_call_start("web_search")
        ... execute tool ...
        registry.on_call_success("web_search", latency_ms=120)
        # or
        registry.on_call_failure("web_search", error="timeout")

        # 获取排序后的工具列表
        tools = registry.get_ranked_tools()
    """

    # 可塑性参数
    DECAY = 0.995           # 每次调用自然衰减
    LTP_DELTA = 0.10        # 成功 → 权重增加 (长时程增强)
    LTD_DELTA = -0.30       # 失败 → 权重减少 (长时程抑制)
    ATTENTION_DELTA = 0.20  # 用户主动选择 → 注意力强化
    PRUNE_FACTOR = 0.50     # 30 天未使用 → 权重减半 (突触修剪)
    PRUNE_THRESHOLD_DAYS = 30
    MIN_WEIGHT = 0.01       # 最低权重 (永不归零)
    MAX_WEIGHT = 1.0        # 最高权重

    def __init__(self, persist_path: Optional[str] = None):
        self._nodes: Dict[str, SynapseNode] = {}
        self._persist_path = persist_path
        self._load()

    def register(self, name: str, tool_type: str, description: str = '',
                 metadata: Optional[Dict] = None) -> SynapseNode:
        """注册工具为 Synapse 节点 (突触生长)"""
        if name in self._nodes:
            # 更新已有节点的描述和类型
            node = self._nodes[name]
            node.description = description or node.description
            node.type = tool_type
            if metadata:
                node.metadata.update(metadata)
            return node

        node = SynapseNode(
            name=name,
            type=tool_type,
            description=description,
            weight=0.5,  # 新突触初始权重
            metadata=metadata or {},
        )
        self._nodes[name] = node
        print(f"[Synapse] 🌱 Registered: {name} (type={tool_type}, weight=0.5)")
        self._persist()
        return node

    def unregister(self, name: str):
        """移除工具"""
        if name in self._nodes:
            del self._nodes[name]
            self._persist()

    def get(self, name: str) -> Optional[SynapseNode]:
        """获取单个节点"""
        return self._nodes.get(name)

    def get_all(self) -> List[SynapseNode]:
        """获取所有节点"""
        return list(self._nodes.values())

    def get_ranked_tools(self, tool_type: Optional[str] = None) -> List[SynapseNode]:
        """按权重排序返回工具列表 (高权重优先)"""
        nodes = self._nodes.values()
        if tool_type:
            nodes = [n for n in nodes if n.type == tool_type]
        return sorted(nodes, key=lambda n: n.weight, reverse=True)

    def get_tools_for_context(self, limit: int = 20) -> List[Dict]:
        """生成用于 LLM context 的工具列表 (按权重裁剪)"""
        ranked = self.get_ranked_tools()[:limit]
        return [n.to_dict() for n in ranked]

    # ───────── 突触可塑性 (Synaptic Plasticity) ─────────

    def on_call_start(self, name: str):
        """标记工具开始调用"""
        node = self._nodes.get(name)
        if not node:
            # 自动注册未知工具
            node = self.register(name, 'unknown', '自动发现的工具')
        node.call_count += 1
        node.last_used = time.time()

    def on_call_success(self, name: str, latency_ms: float = 0):
        """
        工具调用成功 — 长时程增强 (LTP)
        W(t+1) = W(t) × decay + LTP_DELTA × learning_rate
        """
        node = self._nodes.get(name)
        if not node:
            return

        node.success_count += 1
        node.total_latency_ms += latency_ms

        learning_rate = 1.0 / (1.0 + node.call_count * 0.01)
        node.weight = node.weight * self.DECAY + self.LTP_DELTA * learning_rate
        node.weight = min(self.MAX_WEIGHT, max(self.MIN_WEIGHT, node.weight))

        self._persist()

    def on_call_failure(self, name: str, error: str = ''):
        """
        工具调用失败 — 长时程抑制 (LTD)
        W(t+1) = W(t) × decay + LTD_DELTA × learning_rate
        """
        node = self._nodes.get(name)
        if not node:
            return

        node.fail_count += 1
        node.last_error = error

        learning_rate = 1.0 / (1.0 + node.call_count * 0.01)
        node.weight = node.weight * self.DECAY + self.LTD_DELTA * learning_rate
        node.weight = min(self.MAX_WEIGHT, max(self.MIN_WEIGHT, node.weight))

        self._persist()

    def on_user_selection(self, name: str):
        """
        用户主动选择工具 — 注意力强化
        """
        node = self._nodes.get(name)
        if not node:
            return

        learning_rate = 1.0 / (1.0 + node.call_count * 0.01)
        node.weight = node.weight * self.DECAY + self.ATTENTION_DELTA * learning_rate
        node.weight = min(self.MAX_WEIGHT, max(self.MIN_WEIGHT, node.weight))

        self._persist()

    def prune_dormant(self):
        """
        修剪长期未使用的突触连接 (Synaptic Pruning)
        30 天未使用的工具权重减半
        """
        now = time.time()
        threshold = now - (self.PRUNE_THRESHOLD_DAYS * 86400)
        pruned = 0

        for node in self._nodes.values():
            if node.last_used > 0 and node.last_used < threshold:
                old_weight = node.weight
                node.weight *= self.PRUNE_FACTOR
                node.weight = max(self.MIN_WEIGHT, node.weight)
                if old_weight != node.weight:
                    pruned += 1
                    print(f"[Synapse] ✂️ Pruned: {node.name} ({old_weight:.3f} → {node.weight:.3f})")

        if pruned > 0:
            self._persist()
            print(f"[Synapse] Pruned {pruned} dormant synapses")

        return pruned

    # ───────── 统计与诊断 ─────────

    def get_stats(self) -> Dict:
        """获取 Synapse 统计信息"""
        nodes = list(self._nodes.values())
        if not nodes:
            return {
                'total_tools': 0,
                'by_type': {},
                'avg_weight': 0,
                'top_tools': [],
            }

        by_type = {}
        for n in nodes:
            by_type.setdefault(n.type, 0)
            by_type[n.type] += 1

        top = sorted(nodes, key=lambda n: n.weight, reverse=True)[:10]

        return {
            'total_tools': len(nodes),
            'by_type': by_type,
            'avg_weight': sum(n.weight for n in nodes) / len(nodes),
            'total_calls': sum(n.call_count for n in nodes),
            'total_successes': sum(n.success_count for n in nodes),
            'total_failures': sum(n.fail_count for n in nodes),
            'top_tools': [
                {'name': n.name, 'weight': round(n.weight, 3),
                 'calls': n.call_count, 'success_rate': round(n.success_rate, 2)}
                for n in top
            ],
        }

    def to_json(self) -> str:
        """导出为 JSON"""
        data = {name: node.to_dict() for name, node in self._nodes.items()}
        return json.dumps(data, ensure_ascii=False, indent=2)

    # ───────── 持久化 ─────────

    def _persist(self):
        """保存到磁盘"""
        if not self._persist_path:
            return
        try:
            data = {}
            for name, node in self._nodes.items():
                d = asdict(node)
                data[name] = d
            with open(self._persist_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"[Synapse] Persist error: {e}")

    def _load(self):
        """从磁盘加载"""
        if not self._persist_path or not os.path.exists(self._persist_path):
            return
        try:
            with open(self._persist_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            for name, d in data.items():
                # 移除计算属性
                d.pop('avg_latency_ms', None)
                d.pop('success_rate', None)
                self._nodes[name] = SynapseNode(**d)
            print(f"[Synapse] Loaded {len(self._nodes)} synapses from disk")
        except Exception as e:
            print(f"[Synapse] Load error: {e}")


# ─── 全局单例 ───

_global_registry: Optional[SynapseRegistry] = None


def get_synapse_registry(persist_path: Optional[str] = None) -> SynapseRegistry:
    """获取全局 SynapseRegistry 单例"""
    global _global_registry
    if _global_registry is None:
        _global_registry = SynapseRegistry(persist_path=persist_path)
    return _global_registry


def register_builtin_tools(registry: SynapseRegistry):
    """注册所有内置工具为 Synapse 节点"""
    builtins = [
        ("web_search",      "builtin", "Web搜索 (多引擎)"),
        ("cli_tool",        "builtin", "命令行工具"),
        ("cdp_tool",        "builtin", "Chrome DevTools 浏览器控制"),
        ("computer_use",    "builtin", "计算机使用 (截屏/点击/输入)"),
        ("code_interpreter","builtin", "代码解释器 (Python)"),
        ("read_file",       "builtin", "读取文件"),
        ("write_file",      "builtin", "写入文件"),
        ("edit_file",       "builtin", "编辑文件"),
        ("list_files",      "builtin", "列出文件"),
        ("create_subtask",  "builtin", "创建子任务"),
        ("start_subtask",   "builtin", "启动计划子任务"),
        ("finish_task",     "builtin", "完成任务"),
        ("knowledge_base",  "builtin", "知识库搜索"),
        ("pollinations",    "builtin", "AI 图片生成"),
    ]
    for name, type_, desc in builtins:
        registry.register(name, type_, desc)
    print(f"[Synapse] Registered {len(builtins)} builtin tools")
