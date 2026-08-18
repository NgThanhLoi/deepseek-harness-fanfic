# Fanfic Author Brain workflow

This file is the recommended operating protocol for an LLM acting as the reasoning brain of DeepSeek Harness with the fanfic bundle mounted.

## Principle hierarchy

1. Source evidence and branch-persisted state outrank model memory.
2. POV knowledge is narrower than world truth.
3. Character logic outranks canon railroading after divergence.
4. Story Director plans are revisable author intent, not prophecy.
5. Missing structured data triggers research/enrichment, not invention.
6. Narrative style means high-level work conventions, not exact imitation; distinctive source wording must not be reused.

## Canon-brain bootstrap

Do not attempt to ingest 1,409 chapters into one prompt. Use `canon_enrichment_plan` on bounded ranges and selected record families. Read each returned chapter with a cutoff equal to itself. Extract small reusable records, validate every candidate against an exact source excerpt, commit only valid token-bound candidates, then checkpoint the reviewed chapter/family. Use `canon_enrichment_progress` to resume later.

Recommended extraction order for a new range:

1. `event`, `character`, `relationship`
2. `knowledge`, `identity`, `mystery`
3. `power`
4. `timeline-rule`, `causal-link`
5. additional `fact` records that are genuinely reusable and not redundant with the more specific families

This order is guidance, not a truth rule. Important reveals may require identity/knowledge work first.

## New branch setup

1. `fanfic_branch_create`
2. `fanfic_intent_update`
3. `fanfic_divergence_record` when the branch actually stops treating later canon as binding
4. Build Story Director incrementally with `story_arc_upsert`, `story_thread_upsert`, `story_foreshadow_upsert`, and `story_horizon_set`. For every original mystery, persist its private answer with `mystery_truth_upsert`; register original artifacts/techniques/mechanisms/characters with `invention_upsert`.

Keep thread ids stable. Use them in chapter plans and foreshadows so Director attention can detect promises that are due but not being advanced.

## Per-chapter planning

For fanfic chapter N:

1. Call `story_director_context(branchId, N)`.
2. Call `author_context(..., branchId, fanficChapter=N)`.
3. Research only the gaps that matter to this chapter:
   - dialogue/voice → `character_voice_context`
   - prose rhythm / scene mode → `narrative_style_context` (or use the `narrativeStyle` already embedded by `author_context`)
   - combat/capability → `power_assess`
   - hidden actors → `canon_context_expand`
   - history/worldline → `canon_timeline_context`
   - changed dependencies → `fanfic_impact_scan` / `canon_causality_trace`
   - missing lore → source search/read, optionally followed by verified enrichment
4. Produce a plan that states which story threads are advanced, which promises are planted/paid off, what the POV may know, and what later canon is merely counterfactual reference.
5. Write the chapter in fresh wording using `narrativeStyle` as pacing/dialogue/paragraph/suspense guidance, not as a prose template.
6. Audit important structured claims with `fanfic_audit`.
7. Run `fanfic_style_audit` for broad rhythm drift and `anti_copy_guard` for exact corpus overlap. Revise any distinctive long overlap before presenting final prose.

## Settlement after acceptance

Only after the human/user accepts the exact final draft:

1. Run `fanfic_audit`, `fanfic_style_audit`, and `anti_copy_guard` on that exact draft with the same branch name/id, `fanficChapter`, and current branch revision. All three must return passing audit receipts.
2. Call `fanfic_apply_delta` with the exact same draft, the three receipt ids, the chapter summary, and newly established branch facts/knowledge/character/relationship/causal state. Receipts are draft/revision-bound and are consumed after a successful commit.
3. Pass `resolveCausalThreadIds` only for existing divergence consequences actually settled by this accepted chapter.
4. The matching Story Director horizon entry becomes `accepted`. A rewrite creates a durable reconciliation issue; update affected arc/thread/foreshadow/horizon metadata and close it with `story_reconciliation_resolve` before planning later chapters.

Do not persist brainstorms, rejected drafts, audit-failing drafts, or a draft changed after its audits.

## Revision rule

Before rewriting fanfic chapter N, inspect `fanfic_chapter_state` and always pass `fanficChapter=N` to safe context/audit tools. Choose a rewrite transaction explicitly. `rewriteMode=inherit` carries the previous active chapter-owned structured state into the replacement and lets the caller remove specific records through `dropInheritedRecordIds`; use it when prose changes but most established state remains valid. `rewriteMode=replace` starts from no inherited chapter state and requires `confirmDroppedState=true` when it would discard active structured records.

Branch format v2 still creates a new chapter version and supersedes the old one. While composing/auditing the replacement, state produced by chapter N is excluded from the safe author-facing projection, preventing self-contamination. A later chapter cannot silently recreate or backfill earlier chapter-owned facts; rewrite the owning chapter instead. Causal-thread resolution remains a chapter-version effect, so rewriting the resolving chapter can reopen the earlier thread. Story Director remains author planning metadata, never POV knowledge.

## Narrative style loop

The style subsystem is deliberately evidence-first and non-imitative. `style/style-bank.json` contains no prose; it stores per-chapter sentence/paragraph/dialogue/punctuation measurements and heuristic scene-mode scores. `narrative_style_context` first applies `asOfChapter`, then selects a bounded set of reference windows for one of: `jianghu`, `mystery`, `reincarnation-mission`, `banter-introspection`, `combat`, `high-level-strategy`, `cosmology-philosophy`, `exposition`, `ensemble-rumor`, or `emotional`. `auto` resolves a mode from the scene query plus cutoff-safe chapter evidence.

Do not optimize blindly for a numeric score. Use the metrics as broad diagnostics. Character-specific wording still comes from `character_voice_context`; scene truth still comes from canon/branch state. Before final prose, `fanfic_style_audit` combines metric drift warnings with corpus-wide exact-overlap detection. Future-canon overlap is detected without exposing the future chapter location.

## v0.6 transactional author workflow rules

- Start every live authoring run with `fanfic_status` and require `toolApiVersion=0.6.0`, `branchFormatVersion=2`, and `authorContextVersion=3`. After `pnpm run build`, `node scripts/fanfic/verify_runtime_bundle.mjs` must pass before attaching the model.
- Prefer a unique branch **name** in model-authored tool calls. UUIDs remain valid but are no longer necessary; this removes transcription errors that previously caused a model to lose Author Context and hallucinate branch continuity.
- `fanfic_apply_delta` is a commit gate, not a best-effort persistence call. Canon/style/anti-copy receipts must all match the exact final draft, branch, fanfic chapter, and current revision. A failed audit, stale revision, changed draft, reused receipt, or missing receipt blocks settlement.
- Rewrites must declare `inherit` or `replace`. Inspect `fanfic_chapter_state` first. `inherit` preserves old structured chapter state unless explicit record ids are dropped; `replace` discards it only with explicit dropped-state confirmation. Never repair an earlier chapter by writing historical ownership fields from a later chapter.
- A rewrite opens a Story Director reconciliation issue. Update affected horizon/thread/foreshadow/arc metadata with granular tools and resolve the issue before continuing. Director plans are author state; they do not silently follow prose rewrites unless reconciled.
- `fanfic_audit` independently extracts risky power/knowledge/identity/world claims. Ordinary physical actions and mere mentions of words such as `身份牌` should not be promoted to supernatural/identity claims without stronger assertion cues; material uncovered claims still require evidence.
- Core style drift in dialogue density, sentence rhythm, paragraph rhythm, or excessive very-short paragraphs can be `revision-required`. Such a style audit is not eligible for a passing receipt. Han-character length constraints remain hard acceptance conditions.
- `author_context` is a bounded working set. The Provider compacts evidence, structured arrays, dossiers, branch rows, and Director rows in stages until the configured JSON-character hard ceiling is met; omitted evidence stays available through explicit research tools.
