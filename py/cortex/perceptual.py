#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
Perceptual Cortex — 感知皮层。

统一多模态输入处理，将文本/图像/语音/桌面信号
提取为结构化感知结果（PerceptionResult）。

Author: Claude Code
Department: R&D
Date: 2026-04-19
Version: 1.0.0
Security Level: INTERNAL
"""

__version__ = "1.0.0"
__author__ = "Claude Code"
__copyright__ = "Copyright 2026 Synapxnet"

import re
from datetime import datetime
from typing import Any, Dict, List, Optional


class PerceptionResult:
    """Structured perception output from multi-modal input analysis."""

    def __init__(
        self,
        raw_input: str = "",
        intent: str = "",
        modality: str = "text",
        entities: List[str] = None,
        keywords: List[str] = None,
        language: str = "",
        sentiment: str = "neutral",
        urgency: str = "normal",
        has_question: bool = False,
        has_command: bool = False,
        has_code: bool = False,
        context_refs: List[str] = None,
    ):
        self.raw_input = raw_input
        self.intent = intent
        self.modality = modality
        self.entities = entities or []
        self.keywords = keywords or []
        self.language = language
        self.sentiment = sentiment
        self.urgency = urgency
        self.has_question = has_question
        self.has_command = has_command
        self.has_code = has_code
        self.context_refs = context_refs or []
        self.timestamp = datetime.now().isoformat()

    def to_dict(self) -> dict:
        return {
            "intent": self.intent,
            "modality": self.modality,
            "entities": self.entities,
            "keywords": self.keywords,
            "language": self.language,
            "sentiment": self.sentiment,
            "urgency": self.urgency,
            "has_question": self.has_question,
            "has_command": self.has_command,
            "has_code": self.has_code,
            "context_refs": self.context_refs,
            "timestamp": self.timestamp,
        }


_QUESTION_PATTERNS = re.compile(
    r"[？?]\s*$|^(what|how|why|when|where|who|which|can|could|would|should|is|are|do|does|"
    r"什么|怎么|为什么|哪|吗|呢|谁|几|多少)",
    re.IGNORECASE | re.MULTILINE,
)
_COMMAND_PATTERNS = re.compile(
    r"^(请|帮|执行|运行|创建|删除|修改|打开|关闭|启动|停止|安装|部署|"
    r"please|help|run|execute|create|delete|modify|open|close|start|stop|install|deploy)",
    re.IGNORECASE,
)
_CODE_PATTERNS = re.compile(r"```|def |function |class |import |from |const |let |var |async ")
_URGENT_PATTERNS = re.compile(
    r"紧急|马上|立刻|urgent|immediately|asap|right now|赶紧|快",
    re.IGNORECASE,
)
_CJK_PATTERN = re.compile(r"[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]")


class PerceptualCortex:
    """Unified multi-modal perception layer."""

    def perceive(self, text: str, metadata: Dict[str, Any] = None) -> PerceptionResult:
        meta = metadata or {}
        modality = str(meta.get("modality", "text"))
        if meta.get("has_image"):
            modality = "multimodal"
        elif meta.get("has_audio"):
            modality = "audio"

        result = PerceptionResult(
            raw_input=text,
            modality=modality,
            language=self._detect_language(text),
            has_question=bool(_QUESTION_PATTERNS.search(text)),
            has_command=bool(_COMMAND_PATTERNS.search(text)),
            has_code=bool(_CODE_PATTERNS.search(text)),
            urgency="urgent" if _URGENT_PATTERNS.search(text) else "normal",
        )

        result.keywords = self._extract_keywords(text)
        result.entities = self._extract_entities(text)
        result.intent = self._classify_intent(result)
        result.sentiment = self._detect_sentiment(text)
        result.context_refs = self._extract_refs(text)

        return result

    async def handle_signal(self, signal) -> Optional[Dict[str, Any]]:
        data = signal.data
        text = str(data.get("input", ""))
        metadata = data.get("metadata", {})
        result = self.perceive(text, metadata)
        return result.to_dict()

    def _detect_language(self, text: str) -> str:
        if _CJK_PATTERN.search(text):
            return "zh"
        return "en"

    def _extract_keywords(self, text: str, limit: int = 8) -> List[str]:
        words = re.findall(r"[\w\u4e00-\u9fff]{2,}", text.lower())
        stopwords = {
            "the", "is", "at", "in", "on", "to", "of", "and", "or", "a", "an",
            "for", "it", "this", "that", "with", "from", "by", "as", "be",
            "的", "了", "在", "是", "我", "有", "和", "就", "不", "人", "都",
            "一", "这", "上", "也", "要", "到", "说", "会", "为", "对",
        }
        seen = set()
        result = []
        for w in words:
            if w not in stopwords and w not in seen:
                seen.add(w)
                result.append(w)
        return result[:limit]

    def _extract_entities(self, text: str) -> List[str]:
        entities = []
        caps = re.findall(r"\b[A-Z][a-zA-Z]{2,}\b", text)
        entities.extend(caps[:5])
        paths = re.findall(r"[/\\][\w./\\-]+\.\w+", text)
        entities.extend(paths[:3])
        urls = re.findall(r"https?://\S+", text)
        entities.extend(urls[:2])
        return entities[:8]

    def _classify_intent(self, result: PerceptionResult) -> str:
        if result.has_code:
            return "code_task"
        if result.has_command:
            return "action_request"
        if result.has_question:
            return "information_query"
        return "conversation"

    def _detect_sentiment(self, text: str) -> str:
        positive = re.compile(
            r"谢谢|太好|不错|很好|感谢|棒|excellent|great|awesome|thanks|good|nice|perfect",
            re.IGNORECASE,
        )
        negative = re.compile(
            r"错误|失败|糟糕|问题|不行|坏|error|fail|bad|wrong|broken|issue|bug",
            re.IGNORECASE,
        )
        pos = len(positive.findall(text))
        neg = len(negative.findall(text))
        if pos > neg:
            return "positive"
        if neg > pos:
            return "negative"
        return "neutral"

    def _extract_refs(self, text: str) -> List[str]:
        refs = []
        file_refs = re.findall(r"`([^`]+\.\w+)`", text)
        refs.extend(file_refs[:3])
        func_refs = re.findall(r"`(\w+\(\))`", text)
        refs.extend(func_refs[:3])
        return refs


_cortex: Optional[PerceptualCortex] = None


def get_perceptual_cortex() -> PerceptualCortex:
    global _cortex
    if _cortex is None:
        _cortex = PerceptualCortex()
    return _cortex
