# Agent Note: Fanfic authoring is an opt-in canon/branch capability seam

Status: implemented

English | [中文](2026-08-17-fanfic-authoring-capability.zh.md)

## Problem

Long-form fanfiction needs more than retrieval over source prose. A writer must distinguish immutable world truth, what canon has revealed by a particular narrative point, what the current POV actually knows, and what a fanfic branch changed. Treating every matching source chunk as equally available leaks future reveals. Treating later original canon as mandatory after a divergence railroads the branch. Persisting a whole generated story state without a second narrative cutoff also leaks later fanfic chapters backward when an author revises an earlier chapter.

The capability also needs to remain replaceable. Canon search may start as an in-memory chapter scan and later move to SQLite/FTS, vectors, or a remote service; branch storage may evolve independently. Putting those decisions directly into a model-facing tool would bind authoring behavior to one storage implementation.

## Decision

Fanfic authoring is a three-role capability seam plus an opt-in bundle:

- `@deepseek-ai/dsh-fanfic` is the Service Definition and provider registry exposed as `ctx.fanfic`.
- `@deepseek-ai/dsh-fanfic-local` is the initial filesystem Provider for immutable canon packs and mutable branch snapshots.
- `@deepseek-ai/dsh-tool-fanfic` is the model-facing Consumer and fixed authoring policy.
- `@deepseek-ai/dsh-fanfic-authoring` mounts the three as a patch layer; no agent-loop code changes.

The local provider keeps source canon read-only. Every mutable change goes into a branch JSON document identified by a branded `FanficBranchId`; writes use compare-and-set revisions and atomic replacement. `authorIntent` stores branch-owned premise, divergence mode, themes, tone, POV policy, character priorities, forbidden outcomes, and style notes separately from canon facts.

### Two temporal firewalls

Canon and fanfic use different clocks.

`asOfChapter` is the canon firewall. Source search drops chapters after this cutoff before scoring. Structured facts, identities, powers, relationships, events, timeline rules, and POV knowledge are filtered by temporal validity. `revealFromChapter` allows a world fact to be valid earlier while remaining invisible to the author/model until canon reveals it.

`fanficChapter` is the branch firewall. An author-context or branch-aware audit requested for fanfic chapter N filters overlay facts, knowledge, character state, relationships, causal threads, and chapter summaries to state available at N. Revising chapter 10 after drafting chapter 50 therefore cannot learn chapter-50 branch state through the safe authoring path.

The full `getBranch()` operation remains intentionally administrative and returns all persisted branch state for management and CAS writes. The model-facing description directs scene generation to `author_context`, not the raw branch reader.

### Divergence semantics

A divergence records the canon narrative chapter where the branch stops treating later original events as binding. `author_context` computes the earliest divergence and returns canon before it as `canonTruth`; if the requested canon point is later, the later source state is returned separately as `canonReference` with an explicit counterfactual flag.

Audit uses the same split. Post-divergence original reveals cannot establish a branch fact or POV knowledge by themselves. A later canon identity or power claim is a warning requiring branch evidence, while a POV knowledge claim without branch epistemic state remains an error. Structured fanfic knowledge can carry subject/predicate/object in addition to a summary so the audit can prove fanfic-origin knowledge without prose matching.

### Sparse verified canon graph

The included 《一世之尊》 pack has deterministic source chapters plus a deliberately sparse structured graph. Seed generation checks the exact source EPUB SHA, chapter SHA, and expected evidence phrase before admitting each graph row. Missing structured data means unverified, not false; the source-search/read tools remain the fallback authority.

This favors a future enrichment pipeline of model proposal → cited chapter → immutable source retrieval → verification → graph admission. Directly bulk-persisting LLM extraction as canon truth is not part of this implementation.

### Verified enrichment and author intelligence

The sparse graph now has a writable verified overlay under provider state rather than inside the immutable canon pack. A candidate carries a record family, source chapter, exact evidence excerpt, and structured payload. `validateEnrichment()` proves the evidence occurs in that chapter, runs the ordinary canon record parser, and returns a token bound to the candidate, source SHA, and chapter SHA. `commitEnrichment()` recomputes the token, rejects duplicate ids, serializes concurrent admissions, requires knowledge rows to reference an existing fact, and appends only the materialized record with provider-derived provenance. The next provider load merges base and verified rows by id.

Evidence validation establishes provenance and structural validity; it does not claim that every ambiguous sentence has one semantic interpretation. Consumers should use a second model or human review where that ambiguity matters.

Author context also gained a spoiler-safe discovery layer. Graph expansion traverses revealed identities, temporal relationships, shared events, visible fact edges, and relevant causal records to surface entities that the initial prompt omitted. `author_context` uses those entities when building binding canon and includes bounded character dossiers. Dedicated character, power, timeline, and divergence-impact queries expose evidence and explicit data gaps rather than manufacturing missing lore. Power assessment is intentionally constraint-oriented instead of converting cultivation realms into a numeric winner function; impact scanning is intentionally dependency discovery rather than prophecy.

### Resumable canon-enrichment orchestration

A verified-record overlay alone still leaves a long-running agent with a coordination problem: it can forget which chapters and record families it already reviewed and repeatedly spend tokens on the same source. The local Provider therefore owns a separate enrichment coverage ledger under `<stateDir>/enrichment/coverage.ndjson`. Coverage is keyed by source chapter and canon record family. Each checkpoint stores the immutable source/chapter hashes plus either admitted record ids or explicit `noFindings`.

`planEnrichment()` returns the next uncovered chapter/family work items inside a bounded range. `enrichmentProgress()` folds the append-only checkpoint ledger to its latest effective row per key. `checkpointEnrichment()` accepts admitted ids only when they exist in the selected record family and their provenance points to the exact reviewed chapter; `noFindings` is mutually exclusive with ids. A checkpoint therefore proves only that an extraction pass reviewed the unit, not that all semantic truth in that chapter has been captured. The model still must read the chapter, validate and commit source-backed records, then checkpoint the family.

### Long-form Story Director and voice evidence

Fanfic branches now carry `storyDirector`, a durable author-metadata object distinct from canon and in-world branch facts. It stores arcs, prioritized plot/character/mystery/relationship/theme threads, foreshadow/payoff promises, and a rolling chapter horizon. `storyDirectorContext()` derives active and due work, recent accepted summaries, unresolved branch causal threads, and deterministic attention items such as a high-priority thread due inside the horizon but not advanced by any plan, or a planted foreshadow past its target payoff.

The Director is explicitly non-prophetic: planned beats may point into future fanfic chapters because they are author intentions, but they do not establish world truth or POV knowledge. `author_context` includes a compact Director packet when a branch and fanfic chapter are supplied. `fanfic_apply_delta` marks a matching horizon entry accepted after chapter settlement and can resolve existing causal-thread ids, avoiding the previous failure mode where a second disconnected “resolved” row left the original open thread alive. Consequences can then invalidate and replace the remaining horizon without rewriting branch truth.

`characterVoiceContext()` adds another author-facing evidence path. It returns structured `voiceNotes` plus bounded source windows and dialogue fragments around a character occurrence at the requested canon cutoff. Because textual proximity is not reliable speaker attribution, results are explicitly contextual evidence; ambiguous fragments must be verified with the source chapter before they become a durable voice rule.

### Work-level narrative style and exact-overlap guard

Character voice evidence does not by itself describe narration, scene pacing, dialogue density, paragraph rhythm, or suspense cadence. The canon pack can therefore include `style/style-bank.json`, a text-free derivative index bound to the source SHA and every chapter SHA. Each row stores chapter-level rhythm metrics and heuristic scores for broad scene modes such as jianghu, mystery, reincarnation mission, banter/introspection, combat, high-level strategy, cosmology/philosophy, exposition, ensemble/rumor, and emotional scenes. The mode labels are retrieval hints, not claims that one chapter has a single genre.

`narrativeStyleContext()` applies the canon cutoff before choosing reference chapters, aggregates work-level measurements, and returns only bounded cutoff-safe source windows plus branch `authorIntent.styleNotes`. `author_context` embeds this packet so ordinary Planner/Composer calls do not need a separate style lookup. The guidance is intentionally about high-level properties of the work rather than exact imitation of a living author's distinctive expression.

`auditNarrativeStyle()` compares a draft against the selected reference envelope. Metric drift is advisory because matching averages cannot prove literary quality. Exact source reuse is a different invariant: `antiCopyGuard()` normalizes whitespace and scans the draft against the entire immutable corpus. It may scan chapters after `asOfChapter` so memorized future source wording is still caught, but a future match reports only that it is beyond the cutoff and withholds the source chapter number. The finding contains draft-side overlap and a fingerprint rather than source prose. This permits anti-copy enforcement without using the guard as a spoiler oracle.

## Alternatives considered

**Put all logic in one model-facing tool plugin.** Rejected because it couples source indexing, branch persistence, and authoring policy and prevents provider replacement.

**Use one vector database and prompt the model not to read future chunks.** Rejected because spoiler safety would depend on model compliance. The source cutoff must be applied before ranking, and structured reveals require independent author-visible timing.

**Continue later canon after divergence and only overlay changed facts.** Rejected because later canon events depend on conditions the branch may have invalidated. Original canon after divergence is useful as a counterfactual reference, not prophecy.

**Expose the entire branch state to every scene.** Rejected because ordinary revision workflows would leak the fanfic's own future into earlier chapters.

**Automatically extract the whole novel into structured truth with an LLM.** Rejected for the initial provider because silent extraction errors are more damaging than sparse data; the source remains authoritative and provenance must survive enrichment.

## Verification

The keyless real-pack smoke loads all 1,409 derived 《一世之尊》 chapters and verifies search cutoff, the 真慧/杨戬 reveal boundary, POV knowledge timing, deterministic premature-reveal audit, source-backed causality, graph context expansion, character/voice/style/power/timeline/impact intelligence, cutoff-safe style references, visible/future exact-copy detection with future-location hiding, token-bound enrichment admission, enrichment planning/progress/checkpoint semantics, author intent, Story Director persistence/attention, divergence-to-counterfactual conversion, branch delta persistence, causal-thread resolution, automatic horizon settlement, stale-revision rejection, and fanfic-chapter backward-leak prevention. It also verifies that a later canonical reveal is only a counterfactual warning after an earlier divergence and becomes valid only after the branch independently persists matching fact and knowledge state.

A synthetic Vitest suite covers the same temporal isolation without depending on the novel pack. The fanfic Service Definition, local Provider, and model-facing Consumer pass a focused TypeScript project build in the available sandbox. Full pnpm repository gates require a normal dependency install and supported Node version; this sandbox could not resolve the npm registry.

## Consequences

The writer-facing safe primitive remains `author_context`, not raw retrieval. It now composes established canon, POV epistemics, branch intent/state, bounded Story Director context, cutoff-safe narrative-style guidance, a counterfactual reference when needed, and explicit constraints without modifying the agent loop. Systematic canon digestion is separately resumable through the enrichment coverage ledger instead of being encoded in model memory.

The first provider is intentionally simple: in-memory source scan and JSON branch files. Those choices are now behind `ctx.fanfic`, so a later indexed/remote provider can change acquisition and persistence without changing the tool vocabulary or authoring policy. Deterministic audit remains a guardrail rather than a replacement for model reasoning about voice, ideology, pacing, or causal plausibility. Style metrics are diagnostic rather than a mechanism for exact authorship emulation, and exact-overlap scanning remains a separate source-copy guard.

## Long-form correctness revision

The first live-model run exposed correctness failures that keyless happy-path tests did not: rewriting an already accepted chapter duplicated active state and let the old draft contaminate its replacement; a chapter-number-only divergence discarded valid events earlier in the same source chapter; draft audit trusted the writer to enumerate its own risky claims; one opaque Story Director payload forced the model to infer nested validation through repeated failures; and style acceptance counted punctuation rather than the requested Han-character length while underweighting paragraph/dialogue drift.

Branch format v2 addresses rewrites with active/superseded chapter versions. Every fanfic overlay row identifies its originating chapter version, and planning/audit for fanfic chapter N excludes state produced by N itself. Causal-thread resolutions are effects recorded by the resolving chapter version and are materialized from currently active versions, so superseding that chapter can reopen the prior thread without duplicate thread records. Legacy v1 JSON is migrated in memory and written as v2 on the next mutation.

Canon divergence can now identify a structured event boundary with `afterEventId`/`eventOrdinal`. Fully stable earlier chapters remain `canonTruth`; provenance-tagged records from the divergence chapter at or before the boundary form `canonSameChapterTruth`; the whole chapter remains only counterfactual `canonReference`, and no raw same-chapter excerpt is promoted across the boundary. Seeded reveal events carry event order/provenance so this behavior is executable against the real pack.

Draft audit now performs an independent heuristic claim pass over participants and risky action/knowledge/identity/world-fact language. Submitted claims remain useful, but uncovered extracted claims create explicit audit-coverage findings and are independently checked where possible. This is a guardrail rather than a semantic proof system; its purpose is to prevent the writer from defining the audit surface by omission.

Story Director mutation is split into explicit-schema arc/thread/foreshadow/horizon tools plus an author-private Mystery Truth Ledger and constrained Invention Registry. Active mystery threads without an author truth become deterministic attention items. Style metrics schema v2 adds Han-character count, paragraph median and short-paragraph ratio; optional Han-length targets are hard acceptance conditions while rhythm deviations remain advisory. Model-facing write results are compact, and a build preflight checks tool API `0.6.0` plus the built tool manifest to fail before a source-new/runtime-stale live test.

## Transactional author workflow revision

A three-chapter live-model run after the long-form-correctness revision exposed a different class of failure: the chapter-version projection correctly hid superseded state, but a rewrite that submitted only a new summary unintentionally dropped the old version's structured facts and knowledge; the model then tried to reconstruct historical chapter-one state from chapter two. The same run showed that copying opaque branch UUIDs into every tool call caused continuity failures, that Story Director metadata could remain stale after a rewrite, and that prompt-only instructions could not prevent the model from persisting a draft whose style audit had failed.

Chapter settlement is therefore an explicit transaction. Canon audit, narrative-style audit, and anti-copy audit can issue receipts only on passing results. A receipt is bound to the exact draft hash, branch id, fanfic chapter, and branch revision. `fanfic_apply_delta` requires one receipt of each kind and consumes them only after the branch write succeeds. A modified draft, stale branch, failed audit, or previously consumed receipt cannot authorize persistence.

Rewrites choose `inherit` or `replace`. `inherit` clones the previous active chapter version's structured rows into the replacement before applying explicit drops and new rows. `replace` intentionally starts from empty chapter-owned state and must acknowledge dropped state when the prior version owned structured records. Ownership fields must match the chapter being settled, so a later chapter cannot silently backfill an earlier chapter. `fanfic_chapter_state` exposes the active chapter-owned record ids before rewrite without exposing later fanfic history.

Every rewrite also creates a durable Story Director reconciliation item. Planning metadata does not silently mutate to match new prose; granular arc/thread/foreshadow/horizon changes are applied deliberately and `story_reconciliation_resolve` closes the issue once the author accepts the new plan. Model-facing branch references resolve either the branded id or a unique branch name, with the stable name preferred to avoid transcription failures.

The author packet is now version 3 and has a configured hard serialized-size ceiling. Compaction first removes optional source/style evidence, then bounds structured snapshot families, dossiers, branch working rows, and Director rows. If the provider cannot produce a useful packet under the configured ceiling it fails rather than silently exceeding deployment policy. Full evidence and administrative branch history remain available through explicit reads.

Independent audit extraction was narrowed after live false positives: an ordinary weapon probe is not a supernatural power claim and a lexical mention such as `身份牌` is not an identity assertion. Stronger capability/identity cues still enter uncovered-risky-claim audit. Core style drift can be marked `revision-required`; such a result cannot issue the style receipt required by chapter settlement. Tool API `0.6.0` and the runtime bundle preflight make these behaviors observable before attaching a model.

## Quality-enforcement and reviewability revision

The ten-chapter live-model endurance run after the transactional revision showed that state correctness was no longer the dominant failure mode. A caller could omit the optional Han-length target and persist chapters far below the intended 2,500–4,000 Han range; one chapter reached the numeric minimum by degenerating into repetitive ultra-short filler; an original-mystery payoff exposed the private answer even though its registered reveal conditions had not occurred; and the review bundle lacked enough raw state/context evidence to independently verify several report claims. Re-copying the full chapter through every audit call also made exact-draft transaction safety unnecessarily expensive and error-prone.

Branch format v3 therefore makes a `FanficWritingContract` durable author intent and binds accepted chapter versions to a persisted staged draft id/hash. `stageDraft()` creates one prose identity at the current branch revision; `updateDraft()` preserves the id but advances draft revision/hash. Canon/style/copy audits can still inspect ad-hoc text, but only staged drafts can obtain commit receipts. Receipt verification also binds the current Writing Contract, so per-call arguments cannot weaken the branch's accepted Han range.

Narrative-style audit now includes a Provider-configurable deterministic Prose Quality Guard. It can require revision for excessive consecutive ultra-short paragraphs, tail collapse into ultra-short fragments, repeated normalized sentences, low Han-bigram diversity in long drafts, and repeated filler cadence. These signals intentionally target mechanical generation degeneration rather than claiming to score literary merit. Deployment-varying thresholds live in Provider configuration and the bundle supplies defaults.

The Mystery Truth Ledger is now an enforcement input instead of author memory alone. A truth can declare protected reveal terms and natural-language reveal conditions. When final prose performs a full reveal, the canon audit declaration must identify a registered satisfied condition and provide exact short evidence excerpts that actually occur in the staged draft. Canon audit receipts carry authorized mystery ids, and settlement refuses a related planned payoff without that authorization. This does not prove arbitrary semantic conditions automatically, but it prevents undeclared payoff and fabricated evidence from bypassing the ledger.

`AuthorContext` version 4 includes deterministic serialization telemetry: actual JSON chars, configured hard budget, compaction level, and omitted source/character/branch/Director categories. Reviewability is also explicit: `scripts/fanfic/export_live_review.mjs` exports the selected v3 branch, active-only projection, chapter-version history, all referenced staged drafts, Story Director, Mystery Truth Ledger, Invention Registry, remaining unconsumed receipts, and a machine-readable manifest. Optional session/context directories are copied only when explicitly supplied; environment variables and credentials are never collected by the exporter.

The model-facing tool API is `0.7.0` and now exposes 39 tools, adding staged-draft operations while preserving the Service Definition / Provider / Consumer split. Pre-release storage policy intentionally rejects older on-disk branch formats for v0.7 instead of carrying migration code whose behavior has not earned a compatibility contract.
