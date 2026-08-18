# Fanfic capability build report — v0.7 Quality Enforcement & Reviewability

Source lineage: DeepSeek Harness `master` at `47f943859bef60e4160492346772ded9b24f765a`, continued from v0.6 after reviewing the raw artefacts from a real ten-chapter live-model endurance run.

## Why v0.7 exists

The v0.6 endurance run showed that transaction/state correctness had improved, but prose-quality correctness was still partly prompt-enforced. Several accepted chapters were shorter than the intended 2,500–4,000 Han-character range because the caller omitted optional target arguments; one 2,500-Han chapter visibly degenerated into repeated ultra-short filler while still receiving all settlement receipts; and an original mystery payoff exposed its private answer before the registered reveal condition occurred. The review archive also lacked enough raw branch/context state for some report claims to be independently verified, while exact-draft receipts required repeatedly copying an entire chapter across tool calls.

## Implemented

- **Durable Writing Contract.** Branch author intent now persists `language`, `minHanChars`, `maxHanChars`, and `defaultStyleMode`. The default contract is `zh-CN`, 2,500–4,000 Han characters, `auto`. A staged style audit always enforces the branch contract, even if a caller supplies weaker ad-hoc limits. Audit receipts carry the Writing Contract hash, so settlement cannot reuse a receipt after the contract changes.
- **Staged Draft Store.** `fanfic_draft_stage`, `fanfic_draft_update`, and `fanfic_draft_get` give each final prose candidate one durable `draftId`, draft revision, branch revision, and SHA-256. Canon/style/copy audits and `fanfic_apply_delta` reference that identity instead of copying the chapter between tool calls. Updating prose changes the hash/revision and invalidates old receipts. Direct ad-hoc text remains usable for inspection but cannot produce a commit receipt.
- **Prose Quality Guard.** Narrative-style audit now deterministically checks consecutive ultra-short paragraph runs, tail collapse, normalized repeated sentences, Han-bigram diversity collapse on sufficiently long drafts, and repeated filler/padding cadence. Revision-required degeneration cannot issue a style receipt. Thresholds are Provider configuration, not source-code constants.
- **Enforceable Mystery Reveal Guard.** Mystery truths may register `protectedRevealTerms` and `revealConditions`. A full reveal must be declared to canon audit, name a registered satisfied condition, and include exact short `conditionEvidence` that actually occurs in the staged draft. Protected truth text without a declaration is rejected, fabricated condition evidence is rejected, and a related planned payoff cannot settle unless the canon receipt explicitly authorizes that mystery id.
- **Author Context telemetry.** Author packet version 4 reports actual serialized JSON characters, configured hard budget, compaction level, and omitted source/character/branch/Director categories. The hard budget remains an invariant rather than an estimate.
- **Active-state-aware review export.** `scripts/fanfic/export_live_review.mjs` exports the selected v3 branch, active-only projection, chapter-version history, every staged draft referenced by accepted/superseded versions, Director/Mystery/Invention state, remaining unconsumed receipts, and a machine-readable manifest. Pre-redacted session/context directories can be copied explicitly; environment secrets are never collected automatically. `review_export_smoke.mjs` exercises this path.
- **Release versioning.** Tool API is `0.7.0`, on-disk branch format is `3`, Author Context version is `4`, and there are **39** model-facing tools. Because DeepSeek Harness is pre-release, v0.7 deliberately rejects old branch formats instead of maintaining speculative migration compatibility; live tests should use fresh state.

The v0.6 transaction guarantees remain: exact-draft three-receipt settlement, `inherit`/`replace` rewrite modes, dropped-state confirmation, no silent historical backfill, unique branch-name resolution, same-chapter divergence, Story Director reconciliation, independent risky-claim extraction, and hard Author Context budgeting.

## Verification actually run

The following checks were executed against the final v0.7 source in this sandbox:

- Focused TypeScript project build passed for `packages/fanfic/fanfic`, `fanfic-local`, and `tool-fanfic` using TypeScript 5.8.3. Temporary local type/workspace stubs were required because the supplied checkout has no dependency install; they are removed from the distribution.
- `node scripts/fanfic/provider_smoke.mjs` passed against all **1,409** derived 《一世之尊》 chapters and retained the previous cutoff/epistemics/enrichment/voice/power/timeline/causality/style/branch checks.
- `node scripts/fanfic/longform_regression_smoke.mjs` passed durable Writing Contract enforcement, stale-receipt invalidation after draft update, deterministic rejection of a synthetic v0.6-style degeneration sample, rewrite inherit, replace silent-drop rejection, backfill rejection, mystery undeclared/unmet/fabricated-evidence rejection, authorized mystery payoff settlement, same-chapter divergence, audit precision, and hard Author Context telemetry. Its 20,000-character test packet serialized to **17,860** characters at compaction level 3.
- `node scripts/fanfic/review_export_smoke.mjs` passed active-only projection/export and staged-draft manifest checks.
- Manual Cordis patch/schema parity passed exactly: **26** Provider config keys and **11** tool-Consumer config keys.
- Harness repository gates passed for workspace constraints; package invariants (`223 hand-owned package companion(s) conform`); package licenses (`226 DSH package(s) checked; all declare MIT`); Agent Note format/classification (`542` notes). `verify-export-jsdoc` reports **zero fanfic violations** and the same eight pre-existing upstream violations in `packages/subagent/subagent-claude-code/src/process.ts`.
- The fixed model policy block is synchronized exactly between source and both EN/ZH tool READMEs; bilingual Git-blob pairing hashes are regenerated before packaging.

## Blocked / not claimed

A repository-wide dependency install/build/test is not claimed. The sandbox has Node `22.16.0`, while this checkout requires `^22.19 || >=24`; `pnpm` is not installed here and npm registry access is unavailable. Therefore the normal tsdown bundle `packages/fanfic/tool-fanfic/lib/index.js` cannot be produced in this environment. `verify_runtime_bundle.mjs` correctly fails loud until a normal build is run.

The Markdown README gates are blocked by missing `mdast-util-from-markdown`, and the repository Cordis verifier is blocked by missing `js-yaml`; the fanfic Cordis config was therefore validated independently with PyYAML and exact source-schema comparison. No result is represented as a pass when its required dependency was unavailable.

## Recommended next live test

Use Node 24, install/build the repository, run `verify_runtime_bundle.mjs`, both fanfic smokes, and `review_export_smoke.mjs`, then start with a **fresh v0.7 state directory**. Repeat a ten-chapter live endurance test using **one model for the entire run**. The key live targets are now narrower: prove that a short chapter cannot commit without the model explicitly changing the durable Writing Contract; provoke one degeneration attempt and observe the quality guard force revision; execute one real `replace` rewrite; complete one registered mystery payoff only after evidence of its reveal condition appears; and export the final review bundle with real branch/context/session artefacts. If those remain correct and prose quality is stable, the next scale target can move to 30 chapters.
