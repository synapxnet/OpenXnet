# -*- coding: utf-8 -*-
"""从已验证的 Memory V3 存储生成可随发行版分发的完整性迁移包。"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
from uuid import uuid4


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from py.memory.synapxnet_v3_runtime import SynapXnetMemoryV3Runtime


def parse_arguments() -> argparse.Namespace:
    """解析源存储、导出 Agent、输出文件和必需标签。"""

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--storage-root", type=Path, required=True)
    parser.add_argument("--requester-agent", default="incident-commander")
    parser.add_argument("--required-tag", default="goai-staging")
    parser.add_argument("--output", type=Path, required=True)
    return parser.parse_args()


def build_transfer(
    storage_root: Path,
    requester_agent: str,
    required_tag: str,
) -> dict[str, object]:
    """读取源库并只导出匹配必需标签且当前可访问的长期记忆。"""

    runtime = SynapXnetMemoryV3Runtime(storage_root.resolve())
    listing = runtime.list_memories(
        {
            "requesterAgent": requester_agent,
            "query": "",
            "ownerAgent": "",
            "includeRetired": False,
            "limit": 100,
        }
    )
    records = [
        item
        for item in listing["items"]
        if required_tag in item.get("tags", ())
    ]
    records.sort(key=lambda item: (str(item.get("taskId", "")), str(item.get("memoryId", ""))))
    memory_ids = [str(item["memoryId"]) for item in records]
    if not memory_ids:
        raise RuntimeError("源存储中没有符合标签条件的可导出记忆。")
    document = runtime.export_memories(
        {
            "requesterAgent": requester_agent,
            "memoryIds": memory_ids,
        }
    )
    verification = runtime.verify_integrity(
        {
            "requesterAgent": requester_agent,
            "memoryId": "",
        }
    )
    if not verification["healthy"]:
        raise RuntimeError("源 Memory V3 记录链或审计链校验失败。")
    return document


def write_utf8_json(path: Path, document: dict[str, object]) -> None:
    """以 UTF-8 无 BOM 和原子替换方式写入迁移文档。"""

    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = path.with_name(f"{path.name}.{uuid4().hex}.tmp")
    try:
        temporary_path.write_text(
            json.dumps(document, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        temporary_path.replace(path)
    finally:
        temporary_path.unlink(missing_ok=True)


def main() -> int:
    """生成迁移包并输出用于发行版固定校验的清单摘要。"""

    arguments = parse_arguments()
    document = build_transfer(
        arguments.storage_root,
        str(arguments.requester_agent).strip(),
        str(arguments.required_tag).strip(),
    )
    write_utf8_json(arguments.output.resolve(), document)
    print(
        json.dumps(
            {
                "output": str(arguments.output.resolve()),
                "manifestSha256": document["manifestSha256"],
                "versionCount": len(document["entries"]),
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
