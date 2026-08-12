"""从当前 Python 环境生成可复现的第三方许可证清单。"""

from __future__ import annotations

import csv
from importlib import metadata
from pathlib import Path


def normalize_license_value(value: object) -> str:
    """把许可证元数据压缩为适合写入单行 CSV 的稳定文本。"""

    return " ".join(str(value or "").replace("\r", " ").replace("\n", " ").split())


def identify_standard_license(text: str) -> str:
    """从发行包自带的标准许可证正文识别常见 SPDX 标识。"""

    normalized = text.lstrip("\ufeff\r\n ")
    if normalized.startswith("MIT License"):
        return "MIT"
    if normalized.startswith("Mozilla Public License Version 2.0"):
        return "MPL-2.0"
    if normalized.startswith("Apache License") and "Version 2.0" in normalized[:300]:
        return "Apache-2.0"
    return "UNKNOWN"


def resolve_license_file(distribution: metadata.Distribution) -> str:
    """读取发行包声明的 License-File，并仅识别具有明确标准正文的许可证。"""

    declared_files = {
        Path(item).as_posix().casefold()
        for item in distribution.metadata.get_all("License-File") or []
        if str(item).strip()
    }
    if not declared_files:
        return "UNKNOWN"
    for package_file in distribution.files or []:
        relative_path = Path(str(package_file)).as_posix()
        folded_path = relative_path.casefold()
        if not any(folded_path == item or folded_path.endswith(f"/{item}") for item in declared_files):
            continue
        try:
            license_text = distribution.locate_file(package_file).read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        identified = identify_standard_license(license_text)
        if identified != "UNKNOWN":
            return identified
    return "UNKNOWN"


def is_metadata_only_distribution(distribution: metadata.Distribution) -> bool:
    """判断发行包是否只包含 dist-info 元数据而不携带可执行或导入代码。"""

    package_files = [Path(str(item)).as_posix().casefold() for item in distribution.files or []]
    return bool(package_files) and all(".dist-info/" in item or item.endswith(".dist-info") for item in package_files)


def resolve_license(distribution: metadata.Distribution) -> str:
    """按 PEP 639、传统元数据、分类器和许可证文件顺序解析许可证。"""

    expression = normalize_license_value(distribution.metadata.get("License-Expression"))
    if expression and expression.upper() != "UNKNOWN":
        return expression
    declared = normalize_license_value(distribution.metadata.get("License"))
    if declared and declared.upper() != "UNKNOWN":
        return declared
    classifiers = distribution.metadata.get_all("Classifier") or []
    licenses = [item.split(" :: ")[-1].strip() for item in classifiers if item.startswith("License ::")]
    if licenses:
        return "; ".join(dict.fromkeys(licenses))
    license_from_file = resolve_license_file(distribution)
    if license_from_file != "UNKNOWN":
        return license_from_file
    if is_metadata_only_distribution(distribution):
        return "NO-CODE-METAPACKAGE"
    return "UNKNOWN"


def collect_inventory() -> list[tuple[str, str, str]]:
    """收集当前解释器可见发行包的名称、版本和许可证并稳定排序。"""

    records = {
        (
            str(distribution.metadata.get("Name") or "UNKNOWN").strip(),
            str(distribution.version or "UNKNOWN").strip(),
            resolve_license(distribution),
        )
        for distribution in metadata.distributions()
    }
    return sorted(records, key=lambda item: (item[0].casefold(), item[1]))


def write_inventory(output_path: Path, records: list[tuple[str, str, str]]) -> None:
    """把 Python 许可证记录写为 UTF-8 无 BOM、LF 换行的 CSV。"""

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.writer(stream, lineterminator="\n")
        writer.writerow(["Name", "Version", "License"])
        writer.writerows(records)


def main() -> None:
    """生成仓库默认 Python 许可证清单并输出总包数与未知许可证数。"""

    project_root = Path(__file__).resolve().parent.parent
    output_path = project_root / "LICENSE-third-party" / "py_licenses.csv"
    records = collect_inventory()
    write_inventory(output_path, records)
    unknown = sum(1 for _, _, license_name in records if license_name == "UNKNOWN")
    print(f'{{"outputPath":"{output_path.as_posix()}","packages":{len(records)},"unknownLicenses":{unknown}}}')


if __name__ == "__main__":
    main()
