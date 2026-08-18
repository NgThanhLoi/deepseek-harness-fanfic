# `@deepseek-ai/dsh-fanfic-local`

English | [中文](README.zh.md)

Filesystem Provider for `ctx.fanfic`. It loads immutable source canon plus a separately persisted verified-enrichment overlay, enforces narrative cutoffs before retrieval, composes author intelligence, and stores mutable fanfic branches with atomic compare-and-set snapshots.

## Configuration

The local Provider takes explicit limits for source results/excerpts, structured records, automatic author-context expansion/search/dossier/evidence, recent Story Director summaries, dialogue fragments per voice sample, style-reference chapter count, style excerpt size, anti-copy draft/finding caps, and the broad style-deviation ratio. The bundle owns the shipped values so deployment policy is not hidden in Provider code. Service requests such as Story Director horizon size remain explicit at the `ctx.fanfic` boundary.

## Canon pack and verified enrichment

Required pack files are `manifest.json`, `source.json`, and `chapters.ndjson`. Optional base graph files under `graph/` are `facts.ndjson`, `knowledge.ndjson`, `characters.ndjson`, `identities.ndjson`, `powers.ndjson`, `relationships.ndjson`, `mysteries.ndjson`, `events.ndjson`, `timeline-rules.ndjson`, and `causality.ndjson`.

The base pack is never mutated. Model-assisted enrichment is written under `<stateDir>/enrichment/graph/` only after `validateEnrichment()` proves that the declared evidence exists in the exact immutable source chapter and the candidate passes the same record parser used for canon packs. Validation returns a token bound to the normalized candidate, source SHA, and chapter SHA; `commitEnrichment()` recomputes that token, rejects duplicate ids, and joins accepted rows with the base graph on the next load. Knowledge enrichment must reference an already admitted fact.

This makes an LLM extraction a source-backed structured overlay instead of silently changing canon. `fanfic_status` reports base+overlay graph totals and separate enrichment counts.

### Enrichment orchestration

The provider also persists `<stateDir>/enrichment/coverage.ndjson`. A checkpoint is keyed by source chapter and record family (`fact`, `knowledge`, `character`, `identity`, `power`, `relationship`, `mystery`, `event`, `timeline-rule`, or `causal-link`) and records the exact source/chapter hashes plus admitted record ids or an explicit `noFindings` result. `planEnrichment()` returns the next chapters/families with no effective checkpoint; `enrichmentProgress()` reports aggregate coverage; `checkpointEnrichment()` rejects ids that do not exist in the selected family or are sourced from a different chapter. Coverage means “this extraction pass reviewed the unit,” not “all truth in the chapter is now represented.”

`revealFromChapter` separates world truth from author-visible truth. A fact or identity may be valid earlier while remaining absent from snapshots until canon reveals it. POV knowledge is then filtered independently. Source search applies `asOfChapter` before scoring, so a highly relevant future chapter cannot enter ranking.

## Author intelligence

`expandContext()` traverses revealed identity edges, temporal relationships, shared events, visible facts, and relevant causal links to discover entities omitted by the initial scene prompt. `authorContext()` uses that expansion before composing canon snapshots and includes bounded character dossiers.

`characterIntelligence()` combines temporal state, values/ideology/decision notes when available, identities, relationships, epistemics, powers, branch overlay state, and source evidence. Missing categories are reported as gaps rather than invented. `characterVoiceContext()` returns bounded source windows and dialogue fragments near a character name plus structured `voiceNotes`; proximity is explicitly contextual evidence rather than guaranteed speaker attribution.

`assessPower()` returns actor-specific states/powers, system rules, timeline rules, and source evidence. It intentionally constrains a scene without declaring a winner from realm labels. `timelineContext()` separates narrative cutoff from worldline/history rules. `impactScan()` finds relevant canon causal links/events, adjacent entities, and open branch causal threads while explicitly remaining a dependency scan rather than prophecy.

## Narrative Style Bank and anti-copy

The optional `style/style-bank.json` is a text-free derivative index tied to the source SHA and every chapter SHA. It stores per-chapter measurements such as sentence/paragraph rhythm, dialogue ratio, punctuation rates, and heuristic scene-mode scores for `jianghu`, mystery, reincarnation missions, banter/introspection, combat, high-level strategy, cosmology/philosophy, exposition, ensemble/rumor, and emotional scenes. `scripts/fanfic/build_style_bank.py` regenerates it from `chapters.ndjson`. If the file is absent, the Provider derives an equivalent in-memory bank.

`narrativeStyleContext()` applies `asOfChapter` before choosing reference chapters, aggregates work-level metrics, returns bounded source windows, and merges branch `authorIntent.styleNotes`. It explicitly treats these as pacing/dialogue/paragraph/suspense guidance rather than instructions to imitate a living author exactly.

`antiCopyGuard()` normalizes whitespace and searches exact draft phrases against the entire immutable corpus. It scans future canon too so memorized source wording can be caught, but when a match is after `asOfChapter` it withholds the source chapter number. `auditNarrativeStyle()` combines broad metric-drift warnings with that exact-overlap guard. Exact overlap can fail the audit; metric drift remains advisory.

## Branch storage

Branches live under `<stateDir>/branches/<FanficBranchId>.json`. Divergences, author-intent replacements, Story Director replacements, and Observer/Reflector deltas require the caller's expected revision. A branch has its own narrative clock; branch-aware context/audit hide records from later fanfic chapters. Once a divergence is recorded, later source canon is counterfactual reference only unless branch state independently re-establishes it.

`storyDirector` is durable author metadata containing arcs, prioritized story threads, foreshadow/payoff promises, and a rolling chapter horizon. `storyDirectorContext()` derives active/due work plus deterministic attention items such as an overdue planted clue or a high-priority thread absent from the horizon. Plans are not world truth. When `fanfic_apply_delta` accepts a chapter it automatically marks the matching horizon entry accepted, and it can resolve existing branch causal-thread ids rather than appending a disconnected “resolved” row.

## Model Experience

Indirectly, through `@deepseek-ai/dsh-tool-fanfic`.

#### KV Cache effect

None directly; only Consumer-rendered results affect model history.

## Known Limitations and Deferred Work

- **In-memory source search** — chapter text is scanned after the spoiler cutoff. SQLite/FTS/vector/remote Providers can replace this without changing Consumers.
- **Sparse structured graph** — source text remains authoritative when a row is absent; deterministic audit reports unverified claims rather than treating missing extraction as false.
- **Evidence validation is deliberately mechanical** — it proves source presence and schema integrity, not that an ambiguous sentence has only one interpretation.
- **Style classification is heuristic** — scene-mode scores only help retrieve useful reference windows. They do not claim a chapter has one exclusive genre or that matching aggregate metrics guarantees good prose.

## v0.6 transactional provider behavior

Chapter settlement is now transactional. Passing canon/style/anti-copy audits can issue short-lived receipts bound to the exact draft hash, branch id, fanfic chapter, and branch revision; `applyDelta()` requires all three distinct receipt kinds and consumes them only after a successful atomic branch write. This prevents a model from persisting a draft that failed a required audit or was changed after auditing.

Rewrites declare `inherit` or `replace`. `inherit` clones the previous active version's chapter-owned structured records into the new version unless explicit record ids are dropped; `replace` starts empty and requires explicit confirmation when active structured state would be discarded. A later chapter cannot backfill an earlier chapter's ownership fields. Rewrites open a durable Story Director reconciliation issue. The provider also compacts `authorContext()` in stages to a configured hard JSON-character ceiling, keeping source evidence and full administrative branch state behind on-demand reads.
