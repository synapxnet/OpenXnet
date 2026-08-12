# -*- coding: utf-8 -*-
"""定义基础客户端与独立 Worker 共同使用的稳定、无运行时依赖能力常量。"""

PORTABLE_DOCUMENT_FORMATS = ("pdf", "docx", "xlsx", "xls", "rtf", "odt", "pptx", "epub")
WINDOWS_DOCUMENT_FORMATS = ("doc", "ppt")
SUPPORTED_DOCUMENT_FORMATS = PORTABLE_DOCUMENT_FORMATS + WINDOWS_DOCUMENT_FORMATS
DEFAULT_MINILM_MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"
