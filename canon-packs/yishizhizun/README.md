# 一世之尊 canon pack

English | [中文](README.zh.md)

Derived local canon pack for the DeepSeek Harness fanfic provider.

- Title: `一世之尊`
- Creator: `爱潜水的乌贼`
- Narrative records: `1409`
- Source EPUB SHA-256: `760489c4ea428faa5d629fa0219ab7975424efa67d5e3b33dc8fc56d08224135`
- Original EPUB: not included in this workspace

`chapters.ndjson` is a deterministic extraction in narrative spine order. `graph/*.ndjson` is deliberately sparse. `scripts/fanfic/seed_yishizhizun.py` admits only seed records whose expected chapter hash and evidence phrase match the extracted source, so a seed cannot silently move to a different edition or chapter.

`style/style-bank.json` is a deterministic text-free derivative index over the same 1,409 chapters. It stores chapter hashes, rhythm/dialogue/punctuation measurements, and heuristic broad scene-mode scores; it contains no source prose. `scripts/fanfic/build_style_bank.py` regenerates it from `chapters.ndjson`. Runtime style retrieval still applies `asOfChapter` before selecting reference windows, while the separate anti-copy guard can scan the whole immutable corpus without revealing a future match location.

Current verified anchors cover early cultivation exposition, 小紫/顾小桑 reveal timing, the first systematic post-法身 explanation, 真实界/诸天万界 framing, 真慧/杨戬 reveal timing, history-rewrite semantics, 传说→造化→彼岸 progression, late-realm memory semantics, relationship state, timeline rules, and one source-backed high-level causal link.

For larger graph enrichment, treat LLM extraction as a proposal stage. Require chapter provenance, retrieve the immutable source, verify the evidence, then admit the structured record. Do not bulk-write model output directly into the graph as canon truth.
