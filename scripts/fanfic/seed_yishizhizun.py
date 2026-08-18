#!/usr/bin/env python3
"""Seed a small source-verified structured graph for the bundled 一世之尊 canon pack.

This deliberately writes only records whose evidence is asserted against exact EPUB chapter hashes
and source phrases. It is a bootstrap corpus for tests and LLM-assisted enrichment, not a claim that
the full novel has been structurally extracted.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PACK = ROOT / "canon-packs" / "yishizhizun"
SOURCE_SHA = "760489c4ea428faa5d629fa0219ab7975424efa67d5e3b33dc8fc56d08224135"

EXPECTED = {
    16: ("237d5972bea1ac2cee565fa1ec9f4f85c0cf479ff7f20504d293a9bceffb9fd5", "孟奇大概拼凑出了这个世界的修炼等级"),
    31: ("63708e3f57f9a40fd47675f01bfbdc4a94c3b07abeb524b683c061f45c80001c", "全天下最坏最坏的坏蛋"),
    41: ("b49d44cf5fe43b73d71fbb3940f44439eb27183115880b5c478a51772c5ac7a0", "我是顾小桑"),
    737: ("227b7dba84df966ac7a4275c400bcb6ff96ca5395dd64345c610f3740905a2f6", "传说确实是修炼必经之境"),
    738: ("bb8729f12ad1f9e1896bdeeadd4dee0d4b0c3335dbca9523082fba65d9e0d360", "所谓的“真实界”包括本源之道"),
    928: ("293c3bff23cbea2db7fd0c2c0d3f18a81f173b30a6a32560131a391daa560985", "小师弟真慧竟然是清源妙道真君杨戬"),
    1049: ("a54165521dbc295bf74705999f0a7973175da431afd9cebad2290df587c9bd5f", "一切历史都是当代史"),
    1250: ("d78b28cf0c99d51dd6896f0c827741e773a60c1076ecc0c3457a76a15a8bdd18", "造化要渡过苦海"),
    1349: ("e2935d58b5d89eacaa80639dd83d04eba4149102604e0579d387b152de4653eb", "境界之别，不仅仅在于实力"),
    1398: ("fec12d7898092b0e0012d8b494f8974bdce738674aa9a2d8667bae9f7c845ed6", "一世的初衷就是写人写理念"),
}


def load_chapters() -> dict[int, dict]:
    rows: dict[int, dict] = {}
    with (PACK / "chapters.ndjson").open(encoding="utf-8") as handle:
        for line in handle:
            row = json.loads(line)
            rows[row["index"]] = row
    return rows


def excerpt(text: str, needle: str, radius: int = 180) -> str:
    at = text.find(needle)
    if at < 0:
        raise AssertionError(f"needle not found: {needle}")
    start = max(0, at - radius)
    end = min(len(text), at + len(needle) + radius)
    return " ".join(text[start:end].split())


def prov(chapters: dict[int, dict], chapter: int, needle: str, *, event_id: str | None = None, event_ordinal: int | None = None, scene_id: str | None = None) -> dict:
    row = chapters[chapter]
    value = {
        "sourceSha256": SOURCE_SHA,
        "chapter": chapter,
        "chapterSha256": row["sha256"],
        "href": row["href"],
        "excerpt": excerpt(row["text"], needle),
    }
    if event_id is not None:
        value["eventId"] = event_id
    if event_ordinal is not None:
        value["eventOrdinal"] = event_ordinal
    if scene_id is not None:
        value["sceneId"] = scene_id
    return value


def write_ndjson(name: str, rows: list[dict]) -> None:
    path = PACK / "graph" / name
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")


def main() -> None:
    source = json.loads((PACK / "source.json").read_text(encoding="utf-8"))
    assert source["sha256"] == SOURCE_SHA, "unexpected source EPUB; refusing to seed"
    chapters = load_chapters()
    for chapter, (sha, needle) in EXPECTED.items():
        row = chapters[chapter]
        assert row["sha256"] == sha, f"chapter {chapter} hash mismatch"
        assert needle in row["text"], f"chapter {chapter} evidence missing"

    facts = [
        {
            "id": "fact-xiaozi-warns-mengqi-about-guxiaosang",
            "subject": "小紫",
            "predicate": "warns_about",
            "object": "顾小桑",
            "validFromChapter": 31,
            "aliases": ["顾小桑"],
            "confidence": 1.0,
            "provenance": prov(chapters, 31, "全天下最坏最坏的坏蛋"),
        },
        {
            "id": "fact-xiaozi-identity-guxiaosang",
            "subject": "小紫",
            "predicate": "identity_is",
            "object": "顾小桑",
            "validFromChapter": 1,
            "revealFromChapter": 41,
            "aliases": ["顾小桑"],
            "confidence": 1.0,
            "provenance": prov(chapters, 41, "我是顾小桑", event_id="event-xiaozi-reveals-guxiaosang", event_ordinal=1),
        },
        {
            "id": "fact-zhenhui-consciousness-yangjian",
            "subject": "真慧",
            "predicate": "consciousness_fragment_of",
            "object": "杨戬",
            "validFromChapter": 1,
            "revealFromChapter": 928,
            "aliases": ["清源妙道真君", "杨戬"],
            "confidence": 1.0,
            "provenance": prov(chapters, 928, "真慧就是我一缕意识所化", event_id="event-zhenhui-yangjian-reveal", event_ordinal=1),
        },
        {
            "id": "fact-pian-post-realm-ontological-gap",
            "subject": "彼岸",
            "predicate": "difference_from_lower_realms",
            "object": "境界之别不仅在于实力；彼岸与之下存在最大的本质差异",
            "validFromChapter": 1349,
            "aliases": ["境界", "造化", "传说"],
            "confidence": 1.0,
            "provenance": prov(chapters, 1349, "境界之别，不仅仅在于实力"),
        },
    ]

    knowledge = [
        {
            "id": "knowledge-mengqi-warning-guxiaosang",
            "character": "孟奇",
            "factId": "fact-xiaozi-warns-mengqi-about-guxiaosang",
            "stance": "knows",
            "knownFromChapter": 31,
            "provenance": prov(chapters, 31, "日后千万得小心一个叫做顾小桑的女孩子"),
        },
        {
            "id": "knowledge-mengqi-xiaozi-guxiaosang",
            "character": "孟奇",
            "factId": "fact-xiaozi-identity-guxiaosang",
            "stance": "knows",
            "knownFromChapter": 41,
            "provenance": prov(chapters, 41, "我是顾小桑", event_id="event-xiaozi-reveals-guxiaosang", event_ordinal=1),
        },
        {
            "id": "knowledge-mengqi-zhenhui-yangjian",
            "character": "孟奇",
            "factId": "fact-zhenhui-consciousness-yangjian",
            "stance": "knows",
            "knownFromChapter": 928,
            "provenance": prov(chapters, 928, "小师弟真慧竟然是清源妙道真君杨戬", event_id="event-zhenhui-yangjian-reveal", event_ordinal=1),
        },
    ]

    identities = [
        {
            "id": "identity-xiaozi-guxiaosang",
            "subject": "小紫",
            "relation": "revealed_as",
            "object": "顾小桑",
            "validFromChapter": 1,
            "revealFromChapter": 41,
            "provenance": prov(chapters, 41, "我是顾小桑", event_id="event-xiaozi-reveals-guxiaosang", event_ordinal=1),
        },
        {
            "id": "identity-zhenhui-yangjian-consciousness",
            "subject": "真慧",
            "relation": "consciousness_fragment_of",
            "object": "杨戬",
            "validFromChapter": 1,
            "revealFromChapter": 928,
            "provenance": prov(chapters, 928, "真慧就是我一缕意识所化", event_id="event-zhenhui-yangjian-reveal", event_ordinal=1),
        },
    ]

    mysteries = [
        {
            "id": "mystery-xiaozi-guxiaosang",
            "label": "小紫与顾小桑的身份关系",
            "revealChapter": 41,
            "forbiddenBeforeReveal": ["小紫就是顾小桑", "小紫是顾小桑", "我是顾小桑"],
            "clues": [{"chapter": 31, "summary": "小紫梦中反复喊小桑，并警告孟奇小心顾小桑。"}],
            "provenance": prov(chapters, 41, "我是顾小桑", event_id="event-xiaozi-reveals-guxiaosang", event_ordinal=1),
        },
        {
            "id": "mystery-zhenhui-yangjian",
            "label": "真慧的真实本质",
            "revealChapter": 928,
            "forbiddenBeforeReveal": ["真慧就是杨戬", "真慧是杨戬", "真慧是杨戬一缕意识", "小师弟真慧竟然是清源妙道真君杨戬"],
            "clues": [],
            "provenance": prov(chapters, 928, "小师弟真慧竟然是清源妙道真君杨戬", event_id="event-zhenhui-yangjian-reveal", event_ordinal=1),
        },
    ]

    events = [
        {
            "id": "event-xiaozi-reveals-guxiaosang",
            "chapter": 41,
            "orderInChapter": 1,
            "summary": "小紫形貌的少女向孟奇等人自称顾小桑。",
            "participants": ["孟奇", "小紫", "顾小桑", "张远山", "江芷微", "齐正言"],
            "consequences": ["孟奇确认小紫与顾小桑存在直接身份关联。"],
            "provenance": prov(chapters, 41, "我是顾小桑", event_id="event-xiaozi-reveals-guxiaosang", event_ordinal=1),
        },
        {
            "id": "event-zhenhui-yangjian-reveal",
            "chapter": 928,
            "orderInChapter": 1,
            "summary": "孟奇在玉清宫确认真慧与杨戬的关系；杨戬说明真慧是其一缕意识所化。",
            "participants": ["孟奇", "真慧", "杨戬"],
            "consequences": ["孟奇重新解释早期与真慧相处时的诸多异常与巧合。"],
            "provenance": prov(chapters, 928, "真慧就是我一缕意识所化", event_id="event-zhenhui-yangjian-reveal", event_ordinal=1),
        },
    ]

    # Global power-system records use subject names rather than pretending every character has been extracted.
    powers = [
        {
            "id": "power-system-early-progression",
            "subject": "修炼体系",
            "validFromChapter": 16,
            "realm": "百日筑基→蓄气锻体→开窍→外景→法身",
            "capabilities": ["开窍后续为外景；跨过外景为法身，法身有不同法身、道体与金身。"],
            "constraints": ["第16章时孟奇明确不知道法身之后是否还有其他境界。"],
            "provenance": prov(chapters, 16, "孟奇大概拼凑出了这个世界的修炼等级"),
        },
        {
            "id": "power-system-post-fashen-revelation",
            "subject": "修炼体系",
            "validFromChapter": 737,
            "realm": "人仙→地仙→天仙→传说",
            "capabilities": ["传说通常涉及感应并点悟他我、诸界唯一。"],
            "constraints": ["这是孟奇在第737章首次系统了解法身之后道路时得到的知识，不得向更早POV泄露。"],
            "provenance": prov(chapters, 737, "首次系统了解法身之后的道路"),
        },
        {
            "id": "power-system-creation-to-pian",
            "subject": "修炼体系",
            "validFromChapter": 1250,
            "realm": "传说→造化→彼岸",
            "capabilities": ["造化渡苦海登彼岸涉及触及时光长河并有限回溯过去、窥视未来，以及自身之道达到近道并结虚幻道果。"],
            "constraints": ["具体能力受境界、道路与个体特征影响；不可把层级名称当作单纯数值战力。"],
            "provenance": prov(chapters, 1250, "造化要渡过苦海"),
        },
    ]

    characters = [
        {
            "id": "character-mengqi-early-knowledge",
            "name": "孟奇",
            "aliases": ["真定"],
            "validFromChapter": 16,
            "validUntilChapter": 16,
            "goals": ["借助六道轮回之主的兑换机会获得更高深武功。"],
            "traits": ["会用现代/游戏/小说经验理解轮回任务与兑换机制。"],
            "provenance": prov(chapters, 16, "终于有机会兑换高深武功了"),
        },
        {
            "id": "character-mengqi-pian-self",
            "name": "孟奇",
            "aliases": ["苏孟", "元始天尊"],
            "validFromChapter": 1349,
            "ideology": ["他人之道非我之道；即使代价巨大也要保全作为‘我’的人性与选择。"],
            "goals": ["避免被彼岸境界同化为失去人味的高高在上天意。"],
            "provenance": prov(chapters, 1349, "他人之道非‘我’之道"),
        },
    ]

    relationships: list[dict] = [
        {
            "id": "relationship-mengqi-guxiaosang-first-direct-encounter",
            "subject": "孟奇",
            "object": "顾小桑",
            "validFromChapter": 41,
            "validUntilChapter": 41,
            "relation": "首次直接确认身份后的警惕与不确定",
            "publicState": "张远山、江芷微、齐正言均对顾小桑明显戒备。",
            "privateState": "孟奇觉得小紫与顾小桑几乎相同的容貌十分诡异，并意识到顾小桑名头极大。",
            "provenance": prov(chapters, 41, "顾小桑看来名头极大", event_id="event-xiaozi-reveals-guxiaosang", event_ordinal=1),
        },
        {
            "id": "relationship-mengqi-guxiaosang-pian",
            "subject": "孟奇",
            "object": "顾小桑",
            "validFromChapter": 1349,
            "relation": "夫妻",
            "privateState": "二人能直接讨论彼岸、金皇与彼此未来，仍保留熟悉的相公/为夫式调侃。",
            "provenance": prov(chapters, 1349, "相公这种语气说话"),
        },
    ]

    timeline_rules: list[dict] = [
        {
            "id": "timeline-real-world-derived-worlds",
            "validFromChapter": 738,
            "worldline": "诸天万界",
            "rule": "真实界及其外露法理与诸方衍生天地存在层级关系；衍生世界的法理可随真实界相关变化而改变。",
            "effects": ["不能把所有轮回世界当成同一套固定物理/修炼规则。", "跨界人物能力必须结合目标世界法理。"],
            "provenance": prov(chapters, 738, "所谓的“真实界”包括本源之道"),
        },
        {
            "id": "timeline-history-rewrite-memory",
            "validFromChapter": 1049,
            "worldline": "主世界/诸天万界",
            "rule": "彼岸大人物对弈变化可导致历史相应改变；低于足够层次者甚至无法察觉并会逐渐遗忘被改写历史。",
            "effects": ["时间线改变不仅修改事件，也可能修改角色记忆。", "历史版本与角色知识状态必须分开建模。"],
            "provenance": prov(chapters, 1049, "当前彼岸大人物的对弈出现变化"),
        },
        {
            "id": "timeline-rewrite-awareness-by-realm",
            "validFromChapter": 1349,
            "worldline": "主世界/诸天万界",
            "rule": "重大历史改变后，传说可残留部分与自身无关的记忆；直接牵涉自身时认知会被混淆；造化能有所感但真实体验仍弱。",
            "effects": ["同一历史版本变化对不同境界角色的记忆保留程度不同。"],
            "provenance": prov(chapters, 1349, "到了传说境界，历史改变若是极大"),
        },
    ]

    causal_links: list[dict] = [
        {
            "id": "causal-gold-mother-shapes-mengqi-choice",
            "introducedByChapter": 1349,
            "cause": "金皇从顾小桑出世、孟奇被魔佛放入棋局开始，长期操纵人心与命运，营造关键选择条件。",
            "effect": "孟奇在关键局面愿意斩出那一刀；金皇由此同时削弱其当前纪元道途并拖延元始相关进程。",
            "mechanism": "利用孟奇无论有无成道之恩都会帮助顾小桑、且宁愿保全自我也不接受他人之道的稳定性格与关系选择。",
            "confidence": 1.0,
            "provenance": prov(chapters, 1349, "这个关键点，从最开始就是金皇刻操纵人心与命运刻意营造出来的"),
        },
    ]

    for filename, rows in {
        "facts.ndjson": facts,
        "knowledge.ndjson": knowledge,
        "characters.ndjson": characters,
        "identities.ndjson": identities,
        "powers.ndjson": powers,
        "relationships.ndjson": relationships,
        "mysteries.ndjson": mysteries,
        "events.ndjson": events,
        "timeline-rules.ndjson": timeline_rules,
        "causality.ndjson": causal_links,
    }.items():
        write_ndjson(filename, rows)

    manifest = json.loads((PACK / "manifest.json").read_text(encoding="utf-8"))
    manifest["canonPackId"] = "yishizhizun"
    manifest["graphVersion"] = 1
    (PACK / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "ok": True,
        "canonPackId": manifest["canonPackId"],
        "graphVersion": manifest["graphVersion"],
        "counts": {name: len(rows) for name, rows in {
            "facts": facts, "knowledge": knowledge, "characters": characters, "identities": identities,
            "powers": powers, "relationships": relationships, "mysteries": mysteries, "events": events,
            "timelineRules": timeline_rules, "causalLinks": causal_links,
        }.items()},
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
