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
知识库 — 向量化知识库的创建、查询与管理。

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

import asyncio
from dataclasses import dataclass, field
import httpx # 核心修复：使用异步 HTTP 客户端
from typing import Any, Dict, List, Optional, Union
import json
import os
from pathlib import Path

from py.load_files import get_files_json
from py.get_setting import load_settings, base_path, KB_DIR
from py.knowledge_base_store import (
    KB_DOCUMENTS_SCHEMA,
    load_vector_document_records,
    rank_bm25_documents,
    read_json_object,
    serialize_document_records,
    weighted_reciprocal_rank_fusion,
    write_json_atomic,
)
from py.vector_worker_client import VectorWorkerClient


@dataclass(slots=True)
class Document:
    """保存一个知识库文本分块及其公开元数据，不依赖第三方文档模型。"""

    page_content: str
    metadata: Dict = field(default_factory=dict)


def _split_text_with_overlap(
    text: str,
    chunk_size: int,
    chunk_overlap: int,
    separators: List[str],
) -> List[str]:
    """按优先分隔符切分文本；输入文本、块大小、重叠和分隔符，返回非空块，非法尺寸时抛出 ValueError。"""

    if chunk_size < 1:
        raise ValueError("Knowledge-base chunk size must be positive.")
    overlap = max(0, min(int(chunk_overlap), chunk_size - 1))
    chunks: List[str] = []
    start = 0
    while start < len(text):
        target_end = min(start + chunk_size, len(text))
        end = target_end
        if target_end < len(text):
            for separator in separators:
                boundary = text.rfind(separator, start + 1, target_end + 1)
                if boundary >= start + 1:
                    end = boundary + len(separator)
                    break
        if end <= start:
            end = target_end
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)
    return chunks
    
# --- Tiktoken 缓存设置（保留）---
def get_tiktoken_cache_path():
    """Create and return the application-owned Tiktoken cache directory."""

    cache_path = os.path.join(base_path, "tiktoken_cache")
    os.makedirs(cache_path, exist_ok=True)
    return cache_path

os.environ["TIKTOKEN_CACHE_DIR"] = get_tiktoken_cache_path()
# ---------------------------------

# --- 新增：清洗文本辅助函数 ---
def clean_text(text: str) -> str:
    """
    清洗文本，移除无法编码的 Unicode 代理字符（surrogates）。
    解决 'utf-8' codec can't encode character ... surrogates not allowed 错误。
    """
    if not isinstance(text, str):
        return str(text)
    # encode('utf-8', 'ignore') 会忽略掉非法的 surrogate 字符
    return text.encode('utf-8', 'ignore').decode('utf-8')


class MyOpenAICompatibleEmbeddings:
    """
    OpenAI 兼容的词嵌入类，使用 httpx 异步客户端进行非阻塞网络请求。
    """
    def __init__(self, base_url: str, model: str, api_key: str = "empty"):
        """Create an embedding adapter for one OpenAI-compatible endpoint."""

        self.base_url = base_url
        self.model = model
        self.api_key = api_key
        # 假设 base_url 已经是 http://127.0.0.1:8000/minilm
        self.endpoint = f"{self.base_url}/embeddings"

    # --- 异步核心方法 ---
    async def _aembed(self, texts: Union[str, List[str]]) -> List[Dict]:
        """异步发送嵌入请求并处理响应"""
        
        headers = {"Authorization": f"Bearer {self.api_key}"}
        json_data = {"model": self.model, "input": texts}
        
        # 使用 httpx.AsyncClient 发送请求
        async with httpx.AsyncClient(timeout=None) as client:
            try:
                # 调用词嵌入接口
                response = await client.post(self.endpoint, headers=headers, json=json_data)
                
                # 检查 HTTP 状态码
                response.raise_for_status() 
                
                return response.json()["data"]
                
            except httpx.HTTPStatusError as e:
                detail = e.response.json().get('detail', e.response.text) if e.response.text else 'Unknown error'
                raise RuntimeError(f"Embedding API HTTP Error {e.response.status_code}: {detail}")
            except Exception as e:
                raise ConnectionError(f"Embedding API connection failed: {e.__class__.__name__}: {e}")

    # --- LangChain 兼容的同步方法 ---
    def embed_query(self, text: str) -> List[float]:
        """Synchronously embed one query for compatibility callers."""

        data = asyncio.run(self.aembed_query(text))
        return data

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Synchronously embed one text batch for compatibility callers."""

        data = asyncio.run(self.aembed_documents(texts))
        return data

    # --- 暴露异步 LangChain 方法 ---
    async def aembed_query(self, text: str) -> List[float]:
        """Asynchronously embed one query string."""

        data = await self._aembed(text)
        return data[0]["embedding"]

    async def aembed_documents(self, texts: List[str]) -> List[List[float]]:
        """Asynchronously embed one document batch."""

        data = await self._aembed(texts)
        return [r["embedding"] for r in data]


def chunk_documents(results: List[Dict], cur_kb) -> List[Document]:
    """为每个文件单独分块并添加元数据"""
    chunk_size = int(cur_kb["chunk_size"])
    chunk_overlap = int(cur_kb["chunk_overlap"])
    separators = ["\n\n", "\n", "。", "！", "？", "!", "?", "."]
    
    all_docs = []
    for doc in results:
        # 在分块前也可以简单清洗一下，防止 text_splitter 报错
        clean_content = clean_text(doc["content"])
        chunks = _split_text_with_overlap(
            clean_content,
            chunk_size,
            chunk_overlap,
            separators,
        )
        for chunk in chunks:
            all_docs.append(Document(
                page_content=chunk,
                metadata={
                    "file_path": doc["file_path"],
                    "file_name": doc["file_name"],
                    "doc_id": f"{doc['file_path']}_{len(all_docs)}" 
                }
            ))
    return all_docs

# 核心修改：增加容错和数据清洗
async def build_vector_store(docs: List[Document], kb_id, cur_kb: Dict, cur_vendor: str):
    """Build BM25 metadata and a Worker-owned persistent vector index."""

    if not isinstance(docs, list) or not all(isinstance(d, Document) for d in docs):
        raise ValueError("Input must be a list of Document objects")
    del cur_vendor
    kb_dir = Path(KB_DIR)
    kb_dir.mkdir(parents=True, exist_ok=True)
    save_dir = kb_dir / str(kb_id)
    save_dir.mkdir(parents=True, exist_ok=True)
    clean_docs_data = serialize_document_records(docs)

    try:
        bm25_path = save_dir / "bm25_index.json"
        if not docs:
            print("Warning: No documents provided for BM25.")
        await asyncio.to_thread(
            write_json_atomic,
            bm25_path,
            {"docs": clean_docs_data},
        )
        print(f"BM25 index saved successfully for KB {kb_id}")
    except Exception as e:
        print(f"⚠️ BM25 Index failed (Skipping): {str(e)}")
        if 'bm25_path' in locals() and bm25_path.exists():
            try:
                os.remove(bm25_path)
            except:
                pass

    try:
        documents_path = save_dir / "index.docs.json"
        index_path = save_dir / "index.faiss"
        client = VectorWorkerClient.from_environment()
        if not docs:
            if index_path.is_file():
                await client.persistent_delete(index_path)
            await asyncio.to_thread(
                write_json_atomic,
                documents_path,
                {"schema": KB_DOCUMENTS_SCHEMA, "documents": []},
            )
            return
        embeddings = MyOpenAICompatibleEmbeddings(
            model=cur_kb["model"],
            api_key=cur_kb["api_key"],
            base_url=cur_kb["base_url"],
        )
        batch_size = 20
        vectors: list[list[float]] = []
        for i in range(0, len(docs), batch_size):
            batch = docs[i:i+batch_size]
            vectors.extend(
                await embeddings.aembed_documents([document.page_content for document in batch])
            )
            print(f"Processed {min(i+batch_size, len(docs))}/{len(docs)} documents")
        if len(vectors) != len(clean_docs_data):
            raise ValueError("Embedding count does not match knowledge-base document count.")
        await client.persistent_build(index_path, vectors, distance="euclidean")
        await asyncio.to_thread(
            write_json_atomic,
            documents_path,
            {"schema": KB_DOCUMENTS_SCHEMA, "documents": clean_docs_data},
        )
        print(f"Vector store saved successfully for KB {kb_id}")
    except Exception as e:
        raise RuntimeError(f"Vector store build failed: {str(e)}")


async def load_retrievers(kb_id, cur_kb, cur_vendor):
    """Load BM25 plus safe positional documents for Worker vector retrieval."""

    del cur_vendor
    kb_path = Path(KB_DIR) / str(kb_id)
    bm25_path = kb_path / "bm25_index.json"
    bm25_documents: list[dict[str, Any]] = []
    try:
        if bm25_path.exists():
            bm25_data = await asyncio.to_thread(read_json_object, bm25_path)
            raw_documents = bm25_data.get("docs")
            if isinstance(raw_documents, list):
                bm25_documents = [dict(document) for document in raw_documents if isinstance(document, dict)]
    except Exception as e:
        print(f"Error loading BM25 (will fallback): {e}")
    vector_documents = await asyncio.to_thread(load_vector_document_records, kb_path)
    embeddings = MyOpenAICompatibleEmbeddings(
        model=cur_kb["model"],
        api_key=cur_kb["api_key"],
        base_url=cur_kb["base_url"],
    )
    return bm25_documents, vector_documents, embeddings

async def query_vector_store(query: str, kb_id, cur_kb, cur_vendor):
    """Fuse BM25 ranks with Worker persistent-vector ranks."""

    bm25_documents, vector_documents, embeddings = await load_retrievers(
        kb_id,
        cur_kb,
        cur_vendor,
    )
    result_limit = max(1, int(cur_kb.get("chunk_k", 5)))
    query_vector = await embeddings.aembed_query(query)
    vector_response = await VectorWorkerClient.from_environment().persistent_search(
        Path(KB_DIR) / str(kb_id) / "index.faiss",
        [query_vector],
        top_k=result_limit,
    )
    vector_ranked = [
        vector_documents[int(match["position"])]
        for match in vector_response.get("results", [])
        if isinstance(match, dict)
        and isinstance(match.get("position"), int)
        and 0 <= int(match["position"]) < len(vector_documents)
    ]
    bm25_ranked = await asyncio.to_thread(
        rank_bm25_documents,
        query,
        bm25_documents,
        result_limit,
    )
    vector_weight = max(0.0, min(float(cur_kb.get("weight", 0.5)), 1.0))
    docs = weighted_reciprocal_rank_fusion(
        [bm25_ranked, vector_ranked],
        [1.0 - vector_weight, vector_weight],
        result_limit,
    )
    return [
        {"content": str(doc.get("page_content", "")), "metadata": dict(doc.get("metadata", {}))}
        for doc in docs
    ]


async def process_knowledge_base(kb_id):
    """异步处理知识库的完整流程"""
    settings = await load_settings()
    cur_kb = None
    providerId = None
    for kb in settings["knowledgeBases"]:
        if kb["id"] == kb_id:
            cur_kb = kb
            providerId = kb["providerId"]
            break
    cur_vendor = None
    for provider in settings["modelProviders"]:
        if provider["id"] == providerId:
            cur_vendor = provider["vendor"]
            break
    
    if not cur_kb:
        raise ValueError(f"Knowledge base {kb_id} not found in settings")
        
    processed_results = await get_files_json(cur_kb["files"])
    
    chunks = chunk_documents(processed_results, cur_kb)
    
    # 调用异步版本的 build_vector_store
    await build_vector_store(chunks, kb_id, cur_kb, cur_vendor)

    return "知识库处理完成"

async def query_knowledge_base(kb_id, query: str):
    """查询知识库"""
    settings = await load_settings()
    cur_kb = None
    providerId = None
    for kb in settings["knowledgeBases"]:
        if kb["id"] == kb_id:
            cur_kb = kb
            providerId = kb["providerId"]
            break
    cur_vendor = None
    for provider in settings["modelProviders"]:
        if provider["id"] == providerId:
            cur_vendor = provider["vendor"]
            break
    
    if not cur_kb:
        return f"Knowledge base {kb_id} not found in settings"
        
    # 调用异步版本的 query_vector_store
    results = await query_vector_store(query, kb_id, cur_kb, cur_vendor)
    return results

async def rerank_knowledge_base(query: str , docs: List[Dict]) -> List[Dict]:
    """Rerank retrieved documents through the configured external rerank provider."""

    settings = await load_settings()
    providerId = settings["KBSettings"]["selectedProvider"]
    cur_vendor = None
    for provider in settings["modelProviders"]:
        if provider["id"] == providerId:
            cur_vendor = provider["vendor"]
            break
    if cur_vendor == "jina":
        jina_api_key = settings["KBSettings"]["api_key"]
        model_name = settings["KBSettings"]["model"]
        top_n = settings["KBSettings"]["top_n"]
        documents = [doc.get("content", "") for doc in docs]
        url = settings["KBSettings"]["base_url"] + "/rerank"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {jina_api_key}"
        }
        data = {
            "model": model_name,
            "query": query,
            "top_n": top_n,
            "documents": documents,
            "return_documents": False
        }
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=data)
        if response.status_code != 200:
            raise Exception(f"Jina reranking failed: {response.text}")
        result = response.json()
        ranked_indices = [item['index'] for item in result.get('results', [])]
        ranked_docs = [docs[i] for i in ranked_indices]
        return ranked_docs
    elif cur_vendor == "Vllm":
        model_name = settings["KBSettings"]["model"]
        top_n = settings["KBSettings"]["top_n"]
        documents = [doc.get("content", "") for doc in docs]
        url = settings["KBSettings"]["base_url"] + "/rerank"
        headers = {"accept": "application/json", "Content-Type": "application/json"}
        data = {
            "model": model_name,
            "query": query,
            "top_n": top_n,
            "documents": documents,
        }
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=data)
        if response.status_code != 200:
            raise Exception(f"Vllm reranking failed: {response.text}")
        result = response.json()
        ranked_indices = [item['index'] for item in result.get('results', [])]
        ranked_docs = [docs[i] for i in ranked_indices]
        return ranked_docs
    else:
        return docs

kb_tool = {
    "type": "function",
    "function": {
        "name": "query_knowledge_base",
        "description": f"通过自然语言获取的对应ID的知识库信息。回答时，在回答的最下方给出信息来源。以链接的形式给出信息来源，格式为：[file_name](file_path)。file_path可以是外部资源，也可以是127.0.0.1上的资源。返回链接时，不要让()内出现空格。如果需要实现引用位置到跳转脚注链接的功能，请用句末用`[^1]`加脚注用`[^1]: [file_name](file_path)`的markdown语法。",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "需要搜索的问题。",
                },
                "kb_id": {
                    "type": "string",
                    "description": "知识库的ID。"
                }
            },
            "required": ["kb_id","query"],
        },
    },
}
