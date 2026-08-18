# Fanfic capability build report — v0.6 Transactional Author Workflow

Source lineage: DeepSeek Harness `master` at `47f943859bef60e4160492346772ded9b24f765a`, continued from v0.5 after reviewing a real three-chapter LLM run with a chapter-2 rewrite.

## Why v0.6 exists

The live run showed that v0.5 chapter-version filtering worked, but workflow correctness was still partly prompt-enforced. A rewrite could accidentally drop the previous chapter's structured state, the model could mistype opaque branch UUIDs and lose Author Context, Story Director metadata could remain stale after rewrite, and `fanfic_apply_delta` could persist a draft even after a required style audit failed. Context size was also already growing noticeably after only three chapters.

## Implemented

- **Transactional chapter settlement.** Passing `fanfic_audit`, `fanfic_style_audit`, and `anti_copy_guard` can issue receipts bound to the exact draft SHA-256, branch, fanfic chapter, and branch revision. `fanfic_apply_delta` requires all three kinds and consumes them only after a successful write. Changed drafts, stale revisions, failed audits, missing receipts, and reused receipts are rejected.
- **Explicit rewrite semantics.** `rewriteMode=inherit` clones the previous active chapter-owned facts/knowledge/character state/relationships/causal threads before explicit drops and additions. `rewriteMode=replace` starts empty and requires `confirmDroppedState=true` when active structured state would disappear. `fanfic_chapter_state` exposes the current chapter-owned record ids before rewrite.
- **No silent backfill.** A chapter-N settlement cannot create records whose ownership/effective fanfic chapter claims an earlier chapter; revise the owning chapter instead.
- **Stable branch references.** Model-facing tools accept either the branded UUID or a unique branch name; policy prefers names to avoid transcription failures observed in the live run.
- **Story Director reconciliation.** Rewrites create durable open reconciliation items. Granular Director metadata must be updated and the issue closed with `story_reconciliation_resolve`; it remains visible in `story_director_context` until resolved.
- **Audit precision v2.** Explicit supernatural/capability language remains risky, while ordinary weapon probing and lexical mentions such as `身份牌` no longer become power/identity claims by keyword alone.
- **Style commit gate.** Core dialogue/sentence/paragraph deviations may become `revision-required`; a failing style audit cannot issue the receipt needed for chapter settlement.
- **Hard Author Context budget.** Author packet version 3 compacts source/style evidence, snapshot families, character dossiers, branch working rows, and Director rows in stages until the configured JSON-character ceiling is satisfied; it fails rather than silently exceed the deployment limit.
- **Runtime versioning.** Tool API is `0.6.0`, branch format remains `2`, author-context version is `3`, and the stale-runtime preflight now expects API `0.6.0`.

## Verification actually run

Focused TypeScript builds for the fanfic Service Definition, local Provider, and model-facing Consumer passed. `provider_smoke.mjs` passed against all **1,409** derived 《一世之尊》 chapters. `longform_regression_smoke.mjs` passed receipt binding/consumption, rewrite inherit/replace, dropped-state confirmation, backfill rejection, reconciliation, same-chapter divergence, audit precision, revision-required style drift, and a 20k test Author Context hard ceiling (actual packet about 17.3k JSON characters).

Repository checks passed: workspace constraints; package invariants (`223 hand-owned package companion(s) conform`); package license gate (`226 DSH package(s) checked; all MIT`); Agent Note format/classification (`542` notes). `verify-export-jsdoc` has **zero fanfic violations** and the same eight pre-existing upstream violations in `packages/subagent/subagent-claude-code/src/process.ts`.

Package README Markdown gates remain blocked because the supplied checkout has no workspace dependency install and `mdast-util-from-markdown` is unavailable. Their bilingual Git-blob pairing hashes were regenerated manually.

## Sandbox limitation

A repository-wide `pnpm install && pnpm run typecheck && pnpm run build && pnpm test` is not claimed: this sandbox runs Node `22.16.0` while the checkout requires `^22.19 || >=24`, and npm registry access is unavailable. On Node 24, run the normal build first, then `node scripts/fanfic/verify_runtime_bundle.mjs`, `provider_smoke.mjs`, and `longform_regression_smoke.mjs` before attaching a model.

## Recommended next live test

Use a completely new branch and run a **10-chapter endurance test**. Use the unique branch name in model calls; require three exact-final audit receipts before each settlement; include at least one `inherit` rewrite and one intentional Director reconciliation. Measure tool-call count and `author_context` serialized size per chapter. If that run stays correct and bounded, the next meaningful scale target is 30 chapters rather than another architecture milestone.
