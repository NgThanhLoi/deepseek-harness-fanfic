# `@deepseek-ai/dsh-tool-fanfic`

English | [中文](README.zh.md)

Model-facing Consumer for `ctx.fanfic`. It contributes the authoring policy plus tools for spoiler-safe canon research, automatic context expansion, character/power/timeline/causality intelligence, verified canon enrichment, branch overlays, Observer/Reflector persistence, and deterministic audit.

## Tools

The plugin currently exposes 39 tools: `fanfic_status`, `canon_search`, `canon_chapter_read`, `canon_snapshot`, `canon_causality_trace`, `canon_timeline_context`, `canon_context_expand`, `character_intelligence`, `character_voice_context`, `narrative_style_context`, `anti_copy_guard`, `fanfic_style_audit`, `power_assess`, `fanfic_impact_scan`, `canon_enrichment_validate`, `canon_enrichment_commit`, `canon_enrichment_plan`, `canon_enrichment_progress`, `canon_enrichment_checkpoint`, `author_context`, `fanfic_branch_list`, `fanfic_branch_create`, `fanfic_branch_get`, `fanfic_chapter_state`, `fanfic_draft_stage`, `fanfic_draft_update`, `fanfic_draft_get`, `fanfic_intent_update`, `story_director_context`, `story_arc_upsert`, `story_thread_upsert`, `story_foreshadow_upsert`, `story_horizon_set`, `mystery_truth_upsert`, `invention_upsert`, `story_reconciliation_resolve`, `fanfic_divergence_record`, `fanfic_apply_delta`, `fanfic_audit`. All execute through the selected `ctx.fanfic` Provider.

`author_context` is the safe Planner/Composer entry point. It applies both time firewalls, divergence semantics, graph-based context expansion, and bounded character dossiers. `fanfic_branch_get` is an administrative full-state read and can expose later fanfic state.

`canon_enrichment_validate` does not mutate canon. It verifies exact chapter evidence and returns a token. `canon_enrichment_commit` accepts only the same token-bound candidate and writes it to the Provider's verified overlay; the immutable source pack remains untouched. For systematic digestion, `canon_enrichment_plan` produces the next uncovered chapter/family work items, `canon_enrichment_checkpoint` records a reviewed unit only after accepted records are committed (or explicit `noFindings`), and `canon_enrichment_progress` prevents repeated digestion of completed units.

`character_voice_context` supplies bounded dialogue-adjacent source evidence without pretending proximity proves speaker attribution. `narrative_style_context` retrieves cutoff-safe work-level rhythm metrics and scene-mode evidence; `fanfic_style_audit` compares a draft against those broad metrics and incorporates `anti_copy_guard`, which scans exact phrase overlap across the full corpus while hiding future-source locations. `power_assess` deliberately reports constraints/evidence instead of declaring a fight winner from realm labels. `fanfic_impact_scan` deliberately reports dependencies instead of predicting the future.

`fanfic_draft_stage`, `fanfic_draft_update`, and `fanfic_draft_get` provide a staged Draft Store so the final chapter text is hashed once and referenced by `draftId` across canon/style/copy audits and settlement. A branch Writing Contract is durable author state; staged style audits cannot weaken its Han-character bounds.

`story_director_context` is the long-form planning read: active arcs, prioritized/due threads, live foreshadows, rolling horizon, recent accepted summaries, unresolved divergence consequences, and deterministic attention items. `story_arc_upsert`, `story_thread_upsert`, `story_foreshadow_upsert`, `story_horizon_set`, `mystery_truth_upsert`, and `invention_upsert` mutate that author metadata with explicit schemas and CAS revision. Rewrites create durable reconciliation issues; update affected Director metadata and close them with `story_reconciliation_resolve`. `fanfic_chapter_state` exposes the active record ids owned by one accepted chapter so a rewrite can explicitly inherit/drop/replace them.

## Configuration

All deployment-varying defaults are explicit Cordis config: source-search limit, context-expansion size, character-evidence count, voice-sample count, style-sample count, anti-copy phrase/finding defaults, power-evidence count, enrichment batch size, Story Director horizon size, and maximum audit claims. The shipped `fanfic-authoring` bundle supplies conservative values; profiles may replace them without changing tool code. Per-call limits such as `limit`, `maxEntities`, `batchSize`, and `horizonSize` can override those defaults and remain provider-capped.

## v0.8 distributed-aware author workflow

The tool API version is `0.8.0`, branch format is `3`, and author-context version is `4`. The optional sibling `@deepseek-ai/dsh-tool-fanfic-distributed` can offload canon/character/story preparation and draft critique to read-only subagents; these direct 39 tools remain the sole mutation/audit surface. Accepted prose is staged once and referenced by `draftId`; updating a staged draft changes its hash/revision and invalidates old receipts. The branch Writing Contract is a hard acceptance invariant, so staged style audits always enforce its Han-character range even if the caller supplies weaker ad-hoc limits.

`fanfic_style_audit` now includes a Provider-configurable Prose Quality Guard for ultra-short paragraph runs, tail collapse, repeated sentences, Han-bigram diversity collapse, and filler/padding cadence. Revision-required findings cannot produce a commit receipt. Original mystery truth is also enforceable: `mystery_truth_upsert` records protected reveal terms and reveal conditions; a full reveal declaration must name a registered satisfied condition and exact evidence excerpts present in the staged draft, and planned payoff settlement requires the canon-audit authorization.

`author_context` reports actual serialization/compaction telemetry under its hard budget. `scripts/fanfic/export_live_review.mjs` exports active-state-aware branch state, chapter versions, staged drafts, Director/Mystery/Invention state, remaining receipts, and a manifest; optional pre-redacted session/context directories can be included without copying environment credentials.

## Model Experience

### System prompt

#### What the model sees

When mounted, the fixed `tool:fanfic` section is:

##### Fanfic authoring policy

```markdown
Fanfic authoring policy (tool API 0.8.0):
- At the start of a live authoring run, call fanfic_status. If toolApiVersion is missing or not 0.8.0, STOP: the runtime bundle is stale and must be rebuilt before writing.
- If your current task explicitly identifies you as a read-only distributed specialist child, follow that specialist task instead of the Author settlement workflow below: use only the tools visible in your child scope, do not write final chapter prose, and never attempt author-state mutation.
- Before planning or writing a scene, call author_context with the exact canon cutoff, POV, participants, scene goal, and branch when one exists; for a branch, always pass the fanficChapter being written.
- When fanfic_prepare_chapter is available, use it before substantial chapter planning to delegate canon/character/story analysis to read-only specialists; you remain the sole Author and must reconcile their advice against author_context. After staging prose, fanfic_review_draft may add independent critique but never replaces deterministic audits.
- Treat canonTruth as binding established history. After a recorded divergence, canonReference is counterfactual reference only; never force later canon events back onto the branch.
- Never use source material after the requested canon cutoff. Do not turn suspicion, reader knowledge, or hidden canon truth into POV knowledge without evidence.
- Prefer character motivation, ideology, relationships, and known capabilities over plot railroading. Read branch authorIntent as the project-level premise/theme/tone policy. Use character_intelligence and power_assess when a scene depends on characterization or combat feasibility; use character_voice_context before dialogue-heavy scenes when voice fidelity matters.
- Treat narrativeStyle as high-level work guidance for pacing, dialogue balance, paragraph rhythm, suspense, and scene-mode conventions. Do not imitate a living author exactly and do not reuse distinctive source wording. Use narrative_style_context when planning prose-heavy scenes.
- Inspect author_context.contextExpansion for relevant entities omitted by the initial prompt. Use canon_timeline_context for cross-world/history questions. When a divergence touches established dependencies, use fanfic_impact_scan/canon_causality_trace and branch causal threads instead of copying canon events.
- Use canon_search/canon_chapter_read for evidence when structured graph data is incomplete. For systematic digestion, use canon_enrichment_plan -> canon_chapter_read -> validate/commit accepted records -> canon_enrichment_checkpoint; inspect canon_enrichment_progress instead of repeatedly digesting completed chapter/family units. Never commit unsupported interpretation as canon.
- For long-form branches, call story_director_context before chapter planning. Maintain arcs/threads/foreshadows/horizon with the granular story_* tools; use mystery_truth_upsert for author-only answers behind original mysteries and invention_upsert for original artifacts/techniques/mechanisms. Treat Director state as mutable author metadata, never as POV knowledge.
- Use a branch UUID or its unique branch name; prefer the stable branch name in model-authored calls to avoid UUID transcription errors.
- Before auditing final prose, stage it once with fanfic_draft_stage. Use the returned draftId for fanfic_audit, fanfic_style_audit, anti_copy_guard, and fanfic_apply_delta; update the same staged draft with fanfic_draft_update after revisions. Receipts are hash-bound to the staged draft, branch revision, and durable writing contract.
- The branch writingContract is an acceptance invariant, not a prompt suggestion. fanfic_style_audit automatically enforces its Han-character range and prose-quality guard; revision-required degeneration, padding, or length failure cannot produce a commit receipt.
- Original mystery truth is protected author metadata. Register protectedRevealTerms and revealConditions; any full reveal in prose must be declared to fanfic_audit with a registered satisfied condition plus exact short conditionEvidence that appears in the staged draft. A planned mystery payoff cannot be committed without canon-audit authorization.
- For rewrites, choose rewriteMode explicitly: inherit carries the previous active structured chapter state (optionally dropping named record ids), while replace discards it and requires explicit confirmation when state would be lost. Never backfill chapter N state from chapter N+1; rewrite the owning chapter.
- After fanfic_apply_delta, inspect story_director_context. Rewrites create a Director reconciliation issue; update affected horizon/thread/foreshadow/arc metadata with granular tools, then resolve the reconciliation issue before planning further chapters. Style warnings are advisory unless marked revision-required; exact source overlap must be rewritten.
```

#### Token effect

The policy is fixed and small. Tool results are conditional and bounded by provider/tool limits, except `canon_chapter_read`, which intentionally returns one requested full source chapter through the normal tool-result spill path. Character dossiers and automatic context expansion are bounded before entering model history.

#### KV Cache effect

The static policy is prefix-stable for a fixed composition. Tool results append to session history.

## Known Limitations and Deferred Work

- **Literary judgment remains model work** — the style auditor can flag broad metric drift and exact copying, but it cannot certify literary quality, emotional truth, or exact character voice. The intended target is high-level work conventions, not exact imitation of a living author.
- **Sparse graph can still force source reads** — enrichment now provides the safe path to improve this over time.
- **Full branch reads can reveal later fanfic state** — scene generation should use `author_context(..., fanficChapter)`.
