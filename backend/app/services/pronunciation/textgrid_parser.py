from __future__ import annotations

from pathlib import Path
import re

_INTERVAL_MARK = re.compile(r"intervals \[(\d+)\]:")
_NAME_MARK = re.compile(r"name = \"([^\"]+)\"")
_TEXT_MARK = re.compile(r"text = \"([^\"]*)\"")
_MIN_MARK = re.compile(r"xmin = ([0-9.]+)")
_MAX_MARK = re.compile(r"xmax = ([0-9.]+)")


def parse_textgrid(textgrid_path: str | Path) -> dict:
    path = Path(textgrid_path)
    content = path.read_text(encoding="utf-8")
    lines = content.splitlines()

    tiers: dict[str, list[dict]] = {}
    current_tier = None
    current_item: dict | None = None

    for raw_line in lines:
        line = raw_line.strip()
        name_match = _NAME_MARK.match(line)
        if name_match:
            current_tier = name_match.group(1)
            tiers.setdefault(current_tier, [])
            continue

        if _INTERVAL_MARK.match(line):
            current_item = {}
            if current_tier is not None:
                tiers[current_tier].append(current_item)
            continue

        if current_item is None:
            continue

        min_match = _MIN_MARK.match(line)
        max_match = _MAX_MARK.match(line)
        text_match = _TEXT_MARK.match(line)

        if min_match:
            current_item["start_ms"] = int(float(min_match.group(1)) * 1000)
        elif max_match:
            current_item["end_ms"] = int(float(max_match.group(1)) * 1000)
        elif text_match:
            current_item["text"] = text_match.group(1)
            current_item["duration_ms"] = current_item.get("end_ms", 0) - current_item.get("start_ms", 0)

    words = [item for item in tiers.get("words", []) if item.get("text")]
    phones = [item for item in tiers.get("phones", []) if item.get("text")]

    # Assign each phone to the word interval it overlaps.
    for phone in phones:
        ps = phone.get("start_ms", 0)
        pe = phone.get("end_ms", 0)
        best_word = None
        best_overlap = 0
        for word in words:
            ws = word.get("start_ms", 0)
            we = word.get("end_ms", 0)
            overlap = max(0, min(pe, we) - max(ps, ws))
            if overlap > best_overlap:
                best_overlap = overlap
                best_word = word.get("text")
        phone["word"] = best_word

    return {
        "words": words,
        "phones": phones,
    }
