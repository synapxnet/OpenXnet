# -*- coding: utf-8 -*-
"""Safe positional metadata and rank fusion for Worker-backed knowledge bases."""

from __future__ import annotations

from collections import Counter
import json
import math
import os
from pathlib import Path
import pickle
from typing import Any, Sequence
from uuid import uuid4


KB_DOCUMENTS_SCHEMA = "openxnet.knowledge-base.documents.v1"
ALLOWED_LEGACY_KB_GLOBALS = {
    ("langchain_community.docstore.in_memory", "InMemoryDocstore"),
    ("langchain_core.documents.base", "Document"),
}


class _LegacyInMemoryDocstore:
    """承接旧 LangChain Docstore pickle 状态；不执行构造逻辑，只允许 Unpickler 写入实例字段。"""


class _LegacyDocument:
    """承接旧 LangChain Document pickle 状态；不执行构造逻辑，只读取文本与公开元数据字段。"""


LEGACY_KB_CLASS_SHIMS = {
    ("langchain_community.docstore.in_memory", "InMemoryDocstore"): _LegacyInMemoryDocstore,
    ("langchain_core.documents.base", "Document"): _LegacyDocument,
}


class RestrictedKnowledgeBaseUnpickler(pickle.Unpickler):
    """Load only the two classes present in legacy LangChain FAISS metadata."""

    def find_class(self, module: str, name: str) -> Any:
        """解析允许的旧知识库类型；输入模块和类名，返回无行为 shim，其他全局对象全部拒绝。"""

        if (module, name) not in ALLOWED_LEGACY_KB_GLOBALS:
            raise pickle.UnpicklingError(
                f"Legacy knowledge-base metadata global is not allowed: {module}.{name}"
            )
        return LEGACY_KB_CLASS_SHIMS[(module, name)]


def clean_text(text: Any) -> str:
    """Convert one value to UTF-8 text while discarding invalid surrogate code points."""

    value = text if isinstance(text, str) else str(text)
    return value.encode("utf-8", "ignore").decode("utf-8")


def serialize_document_records(documents: Sequence[Any]) -> list[dict[str, Any]]:
    """Convert document-like objects to safe JSON values in positional order."""

    values: list[dict[str, Any]] = []
    for document in documents:
        raw_metadata = getattr(document, "metadata", {}) or {}
        if not isinstance(raw_metadata, dict):
            raise ValueError("Knowledge-base document metadata must be an object.")
        metadata = {
            str(key): clean_text(value) if isinstance(value, str) else value
            for key, value in raw_metadata.items()
        }
        values.append(
            {
                "page_content": clean_text(getattr(document, "page_content", "")),
                "metadata": metadata,
            }
        )
    return values


def write_json_atomic(path: Path, value: dict[str, Any]) -> None:
    """Write one sibling UTF-8 JSON temporary file and atomically replace the target."""

    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = path.with_name(f".{path.name}.{uuid4().hex}.tmp")
    try:
        temporary_path.write_text(
            json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n",
            encoding="utf-8",
        )
        os.replace(temporary_path, path)
    finally:
        temporary_path.unlink(missing_ok=True)


def read_json_object(path: Path) -> dict[str, Any]:
    """Read one UTF-8 JSON object from disk."""

    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"Expected a JSON object: {path}")
    return value


def load_vector_document_records(kb_path: Path) -> list[dict[str, Any]]:
    """Load safe positional metadata or migrate a supported legacy source."""

    documents_path = kb_path / "index.docs.json"
    if documents_path.is_file():
        value = read_json_object(documents_path)
        if value.get("schema") != KB_DOCUMENTS_SCHEMA:
            raise ValueError(f"Unsupported knowledge-base document schema: {documents_path}")
        raw_documents = value.get("documents")
    else:
        bm25_path = kb_path / "bm25_index.json"
        legacy_path = kb_path / "index.pkl"
        if bm25_path.is_file():
            raw_documents = read_json_object(bm25_path).get("docs")
            if not isinstance(raw_documents, list):
                raise ValueError(f"Invalid legacy BM25 document metadata: {bm25_path}")
        elif legacy_path.is_file():
            raw_documents = load_legacy_langchain_documents(legacy_path)
        else:
            raise FileNotFoundError(
                f"Knowledge-base positional metadata is unavailable: {documents_path}"
            )
        write_json_atomic(
            documents_path,
            {"schema": KB_DOCUMENTS_SCHEMA, "documents": raw_documents},
        )
    return validate_document_records(raw_documents, documents_path)


def validate_document_records(value: Any, source_path: Path) -> list[dict[str, Any]]:
    """Validate positional document JSON and return defensive copies."""

    if not isinstance(value, list):
        raise ValueError(f"Invalid knowledge-base document metadata: {source_path}")
    records: list[dict[str, Any]] = []
    for item in value:
        if not isinstance(item, dict) or not isinstance(item.get("metadata", {}), dict):
            raise ValueError(f"Invalid knowledge-base document record: {source_path}")
        records.append(
            {
                "page_content": clean_text(item.get("page_content", "")),
                "metadata": dict(item.get("metadata", {})),
            }
        )
    return records


def load_legacy_langchain_documents(path: Path) -> list[dict[str, Any]]:
    """Extract positional documents from a strictly allow-listed LangChain pickle."""

    with path.open("rb") as source:
        value = RestrictedKnowledgeBaseUnpickler(source).load()
    if not isinstance(value, tuple) or len(value) != 2:
        raise ValueError(f"Invalid legacy LangChain metadata tuple: {path}")
    docstore, positions = value
    stored_documents = getattr(docstore, "_dict", None)
    if not isinstance(stored_documents, dict) or not isinstance(positions, dict):
        raise ValueError(f"Invalid legacy LangChain metadata content: {path}")
    documents: list[dict[str, Any]] = []
    for position in sorted(positions, key=int):
        document_id = positions[position]
        document = stored_documents.get(document_id)
        if document is None:
            raise ValueError(f"Legacy LangChain document '{document_id}' is missing.")
        documents.append(
            {
                "page_content": clean_text(getattr(document, "page_content", "")),
                "metadata": dict(getattr(document, "metadata", {}) or {}),
            }
        )
    return documents


def weighted_reciprocal_rank_fusion(
    rankings: Sequence[Sequence[dict[str, Any]]],
    weights: Sequence[float],
    limit: int,
) -> list[dict[str, Any]]:
    """Combine ranked record lists using deterministic weighted reciprocal rank."""

    scores: dict[str, float] = {}
    documents: dict[str, dict[str, Any]] = {}
    for ranking, weight in zip(rankings, weights):
        for rank, document in enumerate(ranking, start=1):
            identity = json.dumps(document, ensure_ascii=False, sort_keys=True, default=str)
            documents.setdefault(identity, dict(document))
            scores[identity] = scores.get(identity, 0.0) + (float(weight) / (rank + 60))
    ordered_ids = sorted(scores, key=lambda identity: scores[identity], reverse=True)
    return [documents[identity] for identity in ordered_ids[:limit]]


def rank_bm25_documents(
    query: str,
    documents: Sequence[dict[str, Any]],
    limit: int,
    *,
    k1: float = 1.5,
    b: float = 0.75,
    epsilon: float = 0.25,
) -> list[dict[str, Any]]:
    """Rank safe document records with the dependency-free BM25Okapi formula."""

    if limit <= 0 or not documents:
        return []
    tokenized_documents = [str(document.get("page_content", "")).split() for document in documents]
    if not any(tokenized_documents):
        return []
    document_frequencies = [Counter(tokens) for tokens in tokenized_documents]
    document_lengths = [len(tokens) for tokens in tokenized_documents]
    average_length = sum(document_lengths) / len(document_lengths)
    corpus_frequency: Counter[str] = Counter()
    for frequencies in document_frequencies:
        corpus_frequency.update(frequencies.keys())

    inverse_document_frequencies: dict[str, float] = {}
    negative_terms: list[str] = []
    corpus_size = len(documents)
    for term, frequency in corpus_frequency.items():
        inverse_frequency = math.log(corpus_size - frequency + 0.5) - math.log(frequency + 0.5)
        inverse_document_frequencies[term] = inverse_frequency
        if inverse_frequency < 0:
            negative_terms.append(term)
    average_inverse_frequency = sum(inverse_document_frequencies.values()) / len(
        inverse_document_frequencies
    )
    floor = epsilon * average_inverse_frequency
    for term in negative_terms:
        inverse_document_frequencies[term] = floor

    scores = [0.0] * corpus_size
    for term in str(query).split():
        inverse_frequency = inverse_document_frequencies.get(term, 0.0)
        for index, frequencies in enumerate(document_frequencies):
            term_frequency = frequencies.get(term, 0)
            denominator = term_frequency + k1 * (
                1.0 - b + (b * document_lengths[index] / average_length)
            )
            if denominator:
                scores[index] += inverse_frequency * (
                    term_frequency * (k1 + 1.0) / denominator
                )

    ranked_indices = sorted(
        range(corpus_size),
        key=lambda index: (scores[index], index),
        reverse=True,
    )
    return [dict(documents[index]) for index in ranked_indices[:limit]]
