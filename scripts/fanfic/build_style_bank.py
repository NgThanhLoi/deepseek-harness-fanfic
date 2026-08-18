#!/usr/bin/env python3
"""Build a text-free narrative style metric bank from an ingested canon pack."""
from __future__ import annotations

import argparse
import json
import math
import re
import statistics
from pathlib import Path

SENTENCE_RE = re.compile(r"[^。！？!?…]+[。！？!?…]*")
DIALOGUE_RE = re.compile(r"[“\"]([^”\"]+)[”\"]")
PARAGRAPH_RE = re.compile(r"\n+")
HAN_RE = re.compile(r"[\u3400-\u9fff]")

MODE_KEYWORDS: dict[str, tuple[str, ...]] = {
    "jianghu": ("江湖", "客栈", "酒楼", "侠", "门派", "榜", "剑", "刀", "少侠", "大侠"),
    "mystery": ("秘密", "线索", "疑惑", "怀疑", "诡异", "古怪", "幕后", "真相", "谜", "踪迹"),
    "reincarnation-mission": ("六道轮回", "轮回任务", "善功", "兑换", "轮回世界", "任务", "彼岸符"),
    "banter-introspection": ("腹诽", "吐槽", "暗忖", "心中", "念头", "苦笑", "失笑", "调侃", "玩笑"),
    "combat": ("交手", "出刀", "出剑", "掌", "拳", "刀光", "剑光", "气机", "杀机", "轰", "斩", "战"),
    "high-level-strategy": ("布局", "谋划", "棋子", "博弈", "算计", "幕后", "因果", "天意", "大势", "局势"),
    "cosmology-philosophy": ("彼岸", "道果", "诸天万界", "真实界", "时光长河", "大道", "造化", "传说", "他我", "历史"),
    "exposition": ("所谓", "也就是说", "换言之", "分为", "境界", "层次", "体系", "意味着", "据说", "传闻"),
    "ensemble-rumor": ("众人", "江湖传闻", "据传", "传言", "说书", "人榜", "地榜", "天榜", "轰动", "议论"),
    "emotional": ("心疼", "温柔", "怅然", "悲伤", "欢喜", "微笑", "泪", "情意", "相拥", "牵手"),
}


def safe_mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def ratio(count: int, total: int) -> float:
    return count / total if total else 0.0


def quantize(value: float) -> float:
    return round(value, 6)


def metrics(text: str) -> dict[str, float | int]:
    stripped = text.strip()
    paragraphs = [p.strip() for p in PARAGRAPH_RE.split(stripped) if p.strip()]
    sentences = [m.group(0).strip() for m in SENTENCE_RE.finditer(stripped) if m.group(0).strip()]
    dialogue_chars = sum(len(m.group(1)) for m in DIALOGUE_RE.finditer(stripped))
    char_count = len(stripped)
    sentence_lengths = [len(s) for s in sentences]
    paragraph_lengths = [len(p) for p in paragraphs]
    punctuation_total = max(1, len(sentences))
    return {
        "charCount": char_count,
        "hanCharCount": len(HAN_RE.findall(stripped)),
        "paragraphCount": len(paragraphs),
        "sentenceCount": len(sentences),
        "dialogueCharRatio": quantize(ratio(dialogue_chars, char_count)),
        "meanSentenceChars": quantize(safe_mean([float(x) for x in sentence_lengths])),
        "medianSentenceChars": quantize(float(statistics.median(sentence_lengths)) if sentence_lengths else 0.0),
        "meanParagraphChars": quantize(safe_mean([float(x) for x in paragraph_lengths])),
        "medianParagraphChars": quantize(float(statistics.median(paragraph_lengths)) if paragraph_lengths else 0.0),
        "shortParagraphRatio": quantize(ratio(sum(1 for x in paragraph_lengths if x <= 16), len(paragraph_lengths))),
        "questionRate": quantize((stripped.count("？") + stripped.count("?")) / punctuation_total),
        "exclamationRate": quantize((stripped.count("！") + stripped.count("!")) / punctuation_total),
        "ellipsisRate": quantize((stripped.count("……") + stripped.count("…")) / punctuation_total),
    }


def mode_scores(text: str) -> dict[str, float]:
    length_scale = max(1.0, math.sqrt(max(1, len(text)) / 1000.0))
    scores: dict[str, float] = {}
    for mode, keywords in MODE_KEYWORDS.items():
        count = sum(text.count(keyword) for keyword in keywords)
        scores[mode] = quantize(count / length_scale)
    return scores


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("canon_pack")
    args = parser.parse_args()
    pack = Path(args.canon_pack).resolve()
    source = json.loads((pack / "source.json").read_text(encoding="utf-8"))
    rows = []
    with (pack / "chapters.ndjson").open(encoding="utf-8") as handle:
        for line in handle:
            if not line.strip():
                continue
            chapter = json.loads(line)
            text = chapter.get("text", "")
            rows.append({
                "chapter": chapter["index"],
                "chapterSha256": chapter["sha256"],
                "metrics": metrics(text),
                "modeScores": mode_scores(text),
            })
    output = {
        "schemaVersion": 2,
        "sourceSha256": source["sha256"],
        "chapterCount": len(rows),
        "modes": list(MODE_KEYWORDS),
        "chapterMetrics": rows,
        "notes": [
            "This bank stores text-free work-level narrative measurements, not prose samples.",
            "Mode scores are heuristic retrieval hints, not claims about author intent or chapter genre.",
            "Runtime must apply the requested canon cutoff before selecting reference chapters.",
        ],
    }
    target = pack / "style" / "style-bank.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"path": str(target), "chapters": len(rows), "modes": list(MODE_KEYWORDS)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
