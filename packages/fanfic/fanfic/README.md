# `@deepseek-ai/dsh-fanfic`

English | [中文](README.zh.md)

Service Definition for fanfic authoring. It registers `ctx.fanfic`, owns provider selection, and defines typed requests/results shared by storage providers and model-facing consumers. It does not read EPUB files or persist branches itself.

## API

`FanficRuntime.registerProvider()` mounts a provider through Cordis effects. With no configured provider id, exactly one usable provider auto-selects; zero or multiple usable providers fail explicitly.

The service exposes four groups of operations:

- spoiler-safe canon search/read/snapshot plus timeline and causality queries;
- `expandContext()`, `characterIntelligence()`, `characterVoiceContext()`, `narrativeStyleContext()`, `antiCopyGuard()`, `auditNarrativeStyle()`, `assessPower()`, and `impactScan()` for author-facing reasoning and prose guardrails;
- evidence-validated canon enrichment plus `planEnrichment()`, `enrichmentProgress()`, and `checkpointEnrichment()` for resumable chapter×record-family digestion;
- mutable fanfic branches, author intent, durable Story Director state/context, Observer/Reflector deltas, `authorContext()`, and deterministic audit.

Canon and branch time are separate. `asOfChapter` limits immutable source canon. `fanficChapter` limits mutable branch state so rewriting an earlier fanfic chapter does not reveal facts, knowledge, relationships, causal threads, or summaries recorded later in the same branch. A recorded divergence also splits `AuthorContext` into binding `canonTruth` and optional counterfactual `canonReference`.

`AuthorContext` additionally carries spoiler-safe graph expansion, source-backed character dossiers, and a cutoff-safe `narrativeStyle` packet built from work-level metrics and bounded source evidence. Narrative style is treated as high-level guidance rather than exact imitation, and anti-copy checking remains a separate corpus-wide guardrail. When a branch and fanfic chapter are supplied it also carries a compact Story Director packet, so the current scene can be reconciled with active arcs, due threads, live foreshadows, recent accepted chapters, unresolved divergence consequences, and the rolling chapter horizon. The Consumer therefore does not need to know every relevant entity or long-form promise before composing a scene.

## Quality-enforced author workflow (v0.7)

Branch format is v3 and `AuthorContext` is version 4. A branch owns a durable `FanficWritingContract`; accepted chapter versions bind the staged `draftId` and `draftHash`. Providers expose `stageDraft()`, `updateDraft()`, and `getDraft()` so all three settlement audits and the final commit refer to one persisted prose identity instead of repeatedly copying the chapter text.

Audit receipts remain draft/revision/branch-bound and now also bind the Writing Contract. Provider implementations may reject prose degeneration before issuing the style receipt and may enforce author-private mystery reveal conditions before issuing the canon receipt. Rewrite `inherit`/`replace`, historical-ownership protection, and Story Director reconciliation remain mandatory.

`AuthorContext` v4 reports serialization telemetry (actual chars, hard budget, compaction level, and omitted categories), making context scaling measurable rather than inferred from logs.

## Model Experience

Indirectly, through `@deepseek-ai/dsh-tool-fanfic`, which owns the fanfic prompt policy, tool schemas, and rendered results.

#### KV Cache effect

None directly; this Service Definition registers no model-facing content.

## Known Limitations and Deferred Work

- **One provider per operation** — the current seam selects one complete provider rather than composing separate canon-search and branch-storage providers; split only when a real consumer needs independent replacement.
- **Administrative branch reads are unbounded in branch time** — `getBranch()` intentionally returns the complete persisted branch for management and CAS writes. Scene generation must use `authorContext(..., fanficChapter)` instead.
- **Enrichment validates evidence, not literary interpretation** — a provider can prove that cited text exists and that the structured record is valid, but a second model/human review may still be useful for ambiguous semantic extraction.
- **Style metrics are diagnostics, not authorship emulation** — the seam exposes work-level rhythm/context and exact-overlap detection, but literary quality and character-specific voice still require model reasoning and source-backed voice evidence.
