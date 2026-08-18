# DeepSeek Harness Fanfic Authoring Quickstart

This checkout contains an opt-in fanfic capability implemented directly in DeepSeek Harness. The included canon pack is 《一世之尊》 by 爱潜水的乌贼. The original EPUB is not included; the derived 1,409-chapter pack records its source SHA-256 for provenance.

## 1. Install ordinary Harness dependencies

Use the repository-supported runtime (`node ^22.19 || >=24`) and pnpm from `packageManager`:

```sh
corepack enable
pnpm install
pnpm run typecheck
pnpm run build
node scripts/fanfic/verify_runtime_bundle.mjs
node scripts/fanfic/provider_smoke.mjs
node scripts/fanfic/longform_regression_smoke.mjs
```

The keyless smoke exercises source/reveal/POV cutoffs, branch-time isolation, divergence semantics, context expansion, character voice/style/power/timeline/causality intelligence, corpus-wide anti-copy protection, token-bound enrichment, enrichment coverage orchestration, Story Director persistence/attention, CAS writes, causal-thread resolution, and deterministic audit against all 1,409 chapters.

## 2. Mount the bundle

```sh
DSH_FANFIC_CANON_PACK="$PWD/canon-packs/yishizhizun" \
DSH_FANFIC_STATE_DIR="$PWD/.dsh-fanfic-state" \
pnpm dsh --profile web --patch packages/bundle/fanfic-authoring/cordis.patch.yml
```

Headless works the same way with `--profile headless`. Model selection remains ordinary Harness configuration; the fanfic stack is model-provider neutral.

## 3. Recommended first model test

```text
We are writing a long-form fanfic of 一世之尊.
1. Call fanfic_status.
2. Create a branch at canon chapter 31.
3. Set author intent: preserve character logic; limited 孟奇 POV; 江湖/mystery tone; never railroad later canon.
4. Initialize Story Director with `story_arc_upsert`, `story_thread_upsert`, optional `story_foreshadow_upsert`, and `story_horizon_set`. Define `mystery_truth_upsert` for original mysteries and `invention_upsert` for original mechanisms/artifacts/techniques/characters before relying on them.
5. For the chapter being written, call story_director_context and author_context with the exact fanficChapter before planning.
6. Inspect contextExpansion, characterIntelligence, and narrativeStyle. For dialogue-heavy scenes use character_voice_context; for a specific prose mode use narrative_style_context; for combat use power_assess; for history/cross-world questions use canon_timeline_context.
7. If divergence changes dependencies, call fanfic_impact_scan and canon_causality_trace.
8. Show the scene/chapter plan first. Do not write final prose yet.
9. Before settlement, run fanfic_audit, fanfic_style_audit, and anti_copy_guard on the exact final draft using the same branch/fanficChapter. Keep the three passing receipt ids; revision-required style drift or exact source overlap must be revised first.
10. After I accept the chapter, call fanfic_apply_delta with that exact draft + the three receipt ids, resolve only causal-thread ids actually settled, then reconcile Story Director metadata before continuing.
```

## 4. Safe systematic canon-enrichment loop

The immutable base canon pack is never changed. Verified rows live under `.dsh-fanfic-state/enrichment/graph/`; review coverage lives in `.dsh-fanfic-state/enrichment/coverage.ndjson`.

```text
canon_enrichment_plan(range, record families)
            ↓
for each returned chapter:
  canon_chapter_read(chapter, asOfChapter=chapter)
            ↓
  LLM proposes zero or more source-supported records
            ↓
  canon_enrichment_validate(candidate)
            ↓ token only if exact evidence + schema validate
  canon_enrichment_commit(same candidate + token)
            ↓
  canon_enrichment_checkpoint(chapter, family, committed ids)
  OR checkpoint(noFindings=true) after an actual review found none
            ↓
canon_enrichment_progress
```

A checkpoint means the selected extraction pass reviewed that chapter/family. It does **not** mean every truth in the chapter is now represented. A record referenced by a checkpoint must exist in that family and have provenance from the exact chapter.

## 5. Long-form Story Director loop

Story Director is author metadata, not world truth or character knowledge. Keep it compact and revisable.

```text
authorIntent
   ↓
story_arc_upsert / story_thread_upsert
  + story_foreshadow_upsert
  + mystery_truth_upsert / invention_upsert
  + story_horizon_set
   ↓
for chapter N:
  story_director_context(N)
  author_context(..., fanficChapter=N)
   ↓
  plan → write → exact-final fanfic_audit + fanfic_style_audit + anti_copy_guard
   ↓ three passing receipts
  fanfic_apply_delta(N, exact draft, receipts)
    - persist accepted facts/knowledge/state transactionally
    - resolve causal-thread ids actually settled
    - matching horizon plan auto-becomes accepted
   ↓
  granular Story Director updates
  + story_reconciliation_resolve after rewrites
```

`story_director_context` deterministically calls attention to issues such as a due high-priority thread absent from the horizon or a planted foreshadow past its target payoff.

## 6. Tool map

- `canon_search`, `canon_chapter_read` — immutable source evidence with a hard canon cutoff.
- `canon_snapshot` — temporal facts, POV knowledge, identities, powers, relationships, mysteries, events, timeline rules, causal links.
- `canon_context_expand` — graph-neighbor discovery for relevant-but-omitted entities.
- `character_intelligence` — source-backed character dossier with explicit missing-data gaps.
- `character_voice_context` — bounded dialogue-adjacent evidence + structured voice notes; proximity is not guaranteed speaker attribution.
- `narrative_style_context` — cutoff-safe work-level rhythm metrics + bounded scene-mode evidence; not exact author imitation.
- `fanfic_style_audit` — advisory high-level metric drift plus integrated anti-copy result.
- `anti_copy_guard` — exact normalized overlap against the full canon corpus; future-source locations stay hidden.
- `power_assess` — capability constraints and source evidence; no fake numeric winner prediction.
- `canon_timeline_context` — worldline/history rules, relevant events, identities, evidence.
- `canon_causality_trace`, `fanfic_impact_scan` — dependency discovery around divergences.
- `canon_enrichment_validate`, `canon_enrichment_commit` — verified structured canon overlay.
- `canon_enrichment_plan`, `canon_enrichment_progress`, `canon_enrichment_checkpoint` — resumable chapter×record-family digestion.
- `author_context` — safe Planner/Composer packet; after divergence separates binding `canonTruth` from counterfactual `canonReference`, includes Story Director context, and embeds `narrativeStyle` for the requested scene.
- `fanfic_branch_*`, `fanfic_chapter_state`, `fanfic_intent_update`, `fanfic_divergence_record` — project/branch administration and active chapter-owned state inspection; model calls may use a unique branch name instead of copying UUIDs.
- `story_director_context`, `story_arc_upsert`, `story_thread_upsert`, `story_foreshadow_upsert`, `story_horizon_set`, `story_reconciliation_resolve`, `mystery_truth_upsert`, `invention_upsert` — long-form author planning, rewrite reconciliation, private mystery truth, and constrained inventions.
- `fanfic_apply_delta` — transactional Observer/Reflector persistence with CAS revision and three exact-draft audit receipts; rewrites use explicit `inherit`/`replace` semantics.
- `fanfic_audit` — deterministic spoiler/reveal/POV/identity/fact/power guardrail.

## 7. Important semantics

There are two independent story clocks. `asOfChapter` prevents future original canon from entering retrieval or structured state. `fanficChapter` prevents later branch state from leaking backward during revisions.

After a recorded divergence, later original canon is counterfactual reference, not prophecy. Character/world consequences must be recomputed from branch state and motivations.

Story Director plans are a third category: mutable **author intentions**. They can point into the future because they are planning metadata, but they never establish an in-world fact or what a POV knows.

The bundled structured graph remains deliberately sparse. v0.3 adds a resumable, verifiable way for the connected brain to digest the 1,409 chapters systematically instead of repeatedly rediscovering the same lore from raw text.

## 8. Narrative style bank

The included `canon-packs/yishizhizun/style/style-bank.json` contains metrics for all 1,409 chapters but no prose text. It is tied to the source SHA and every chapter SHA. Regenerate it after rebuilding the canon pack:

```sh
python scripts/fanfic/build_style_bank.py canon-packs/yishizhizun
```

Runtime retrieval still enforces `asOfChapter` before selecting style references. Anti-copy checking intentionally scans the complete corpus, including future chapters, because its job is to catch memorized wording; matches after the cutoff are reported without a source chapter number.

## 9. v0.7 staged draft, quality gate, and transactional settlement

Run `fanfic_status` first and require tool API `0.7.0`, branch format `3`, and author-context version `4`. Prefer a unique branch name in model-authored calls.

A branch has a durable Writing Contract; defaults are Chinese prose, 2500–4000 Han characters, and automatic scene-style mode. Before settlement:

```text
fanfic_draft_stage(final prose)
  -> draftId
fanfic_audit(draftId)
fanfic_style_audit(draftId)
anti_copy_guard(draftId)
  -> three passing receipts
fanfic_apply_delta(draftId, receipts, structured state)
```

If prose changes, call `fanfic_draft_update(draftId, expectedDraftRevision, newText)` and re-run all three audits. Old receipts are hash-bound and cannot authorize the revised draft. `fanfic_style_audit` automatically enforces the branch Han range and Prose Quality Guard; revision-required length, degeneration, or style failures do not yield a receipt.

For original mysteries, register private truth with `protectedRevealTerms` plus `revealConditions`. When a full truth is actually revealed, declare it in `fanfic_audit` with the satisfied registered condition and exact short `conditionEvidence` excerpts from the staged draft. Planned payoff settlement cannot bypass this authorization.

For rewrites, inspect `fanfic_chapter_state`, choose `inherit` or `replace`, and reconcile Story Director afterward. `replace` cannot silently discard active state; later chapters cannot backfill earlier chapter ownership.

Inspect actual context scaling from `author_context.telemetry`. To prepare a reviewer bundle from persistent state:

```bash
node scripts/fanfic/export_live_review.mjs \
  --state-dir .dsh-fanfic-state \
  --branch my-branch-name \
  --out fanfic-live-review
```

Optionally add pre-redacted `--sessions-dir` and `--contexts-dir`. The exporter produces an active-state-aware `REVIEW_MANIFEST.json` rather than relying on hand-counted report arithmetic.
