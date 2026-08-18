# `@deepseek-ai/dsh-tool-fanfic`

English | [中文](README.zh.md)

Model-facing Consumer for `ctx.fanfic`. It contributes the authoring policy plus tools for spoiler-safe canon research, automatic context expansion, character/power/timeline/causality intelligence, verified canon enrichment, branch overlays, Observer/Reflector persistence, and deterministic audit.

## Tools

The plugin currently exposes 36 tools: `fanfic_status, canon_search, canon_chapter_read, canon_snapshot, canon_causality_trace, canon_timeline_context, canon_context_expand, character_intelligence, character_voice_context, narrative_style_context, anti_copy_guard, fanfic_style_audit, power_assess, fanfic_impact_scan, canon_enrichment_validate, canon_enrichment_commit, canon_enrichment_plan, canon_enrichment_progress, canon_enrichment_checkpoint, author_context, fanfic_branch_list, fanfic_branch_create, fanfic_branch_get, fanfic_chapter_state, fanfic_intent_update, story_director_context, story_arc_upsert, story_thread_upsert, story_foreshadow_upsert, story_horizon_set, story_reconciliation_resolve, mystery_truth_upsert, invention_upsert, fanfic_divergence_record, fanfic_apply_delta, fanfic_audit`. All execute through the selected `ctx.fanfic` Provider.

`author_context` is the safe Planner/Composer entry point. It applies both time firewalls, divergence semantics, graph-based context expansion, and bounded character dossiers. `fanfic_branch_get` is an administrative full-state read and can expose later fanfic state.

`canon_enrichment_validate` does not mutate canon. It verifies exact chapter evidence and returns a token. `canon_enrichment_commit` accepts only the same token-bound candidate and writes it to the Provider's verified overlay; the immutable source pack remains untouched. For systematic digestion, `canon_enrichment_plan` produces the next uncovered chapter/family work items, `canon_enrichment_checkpoint` records a reviewed unit only after accepted records are committed (or explicit `noFindings`), and `canon_enrichment_progress` prevents repeated digestion of completed units.

`character_voice_context` supplies bounded dialogue-adjacent source evidence without pretending proximity proves speaker attribution. `narrative_style_context` retrieves cutoff-safe work-level rhythm metrics and scene-mode evidence; `fanfic_style_audit` compares a draft against those broad metrics and incorporates `anti_copy_guard`, which scans exact phrase overlap across the full corpus while hiding future-source locations. `power_assess` deliberately reports constraints/evidence instead of declaring a fight winner from realm labels. `fanfic_impact_scan` deliberately reports dependencies instead of predicting the future.

`story_director_context` is the long-form planning read: active arcs, prioritized/due threads, live foreshadows, rolling horizon, recent accepted summaries, unresolved divergence consequences, and deterministic attention items. `story_arc_upsert`, `story_thread_upsert`, `story_foreshadow_upsert`, `story_horizon_set`, `mystery_truth_upsert`, and `invention_upsert` mutate that author metadata with explicit schemas and CAS revision. Rewrites create durable reconciliation issues; update affected Director metadata and close them with `story_reconciliation_resolve`. `fanfic_chapter_state` exposes the active record ids owned by one accepted chapter so a rewrite can explicitly inherit/drop/replace them.

## Configuration

All deployment-varying defaults are explicit Cordis config: source-search limit, context-expansion size, character-evidence count, voice-sample count, style-sample count, anti-copy phrase/finding defaults, power-evidence count, enrichment batch size, Story Director horizon size, and maximum audit claims. The shipped `fanfic-authoring` bundle supplies conservative values; profiles may replace them without changing tool code. Per-call limits such as `limit`, `maxEntities`, `batchSize`, and `horizonSize` can override those defaults and remain provider-capped.

## Model Experience

### System prompt

#### What the model sees

When mounted, the fixed `tool:fanfic` section is:

```markdown
Fanfic authoring policy (tool API 0.6.0):
- At the start of a live authoring run, call fanfic_status. If toolApiVersion is missing or not 0.6.0, STOP: the runtime bundle is stale and must be rebuilt before writing.
- Before planning or writing a scene, call author_context with the exact canon cutoff, POV, participants, scene goal, and branch when one exists; for a branch, always pass the fanficChapter being written.
- Treat canonTruth as binding established history. After a recorded divergence, canonReference is counterfactual reference only; never force later canon events back onto the branch.
- Never use source material after the requested canon cutoff. Do not turn suspicion, reader knowledge, or hidden canon truth into POV knowledge without evidence.
- Prefer character motivation, ideology, relationships, and known capabilities over plot railroading. Read branch authorIntent as the project-level premise/theme/tone policy. Use character_intelligence and power_assess when a scene depends on characterization or combat feasibility; use character_voice_context before dialogue-heavy scenes when voice fidelity matters.
- Treat narrativeStyle as high-level work guidance for pacing, dialogue balance, paragraph rhythm, suspense, and scene-mode conventions. Do not imitate a living author exactly and do not reuse distinctive source wording. Use narrative_style_context when planning prose-heavy scenes.
- Inspect author_context.contextExpansion for relevant entities omitted by the initial prompt. Use canon_timeline_context for cross-world/history questions. When a divergence touches established dependencies, use fanfic_impact_scan/canon_causality_trace and branch causal threads instead of copying canon events.
- Use canon_search/canon_chapter_read for evidence when structured graph data is incomplete. For systematic digestion, use canon_enrichment_plan -> canon_chapter_read -> validate/commit accepted records -> canon_enrichment_checkpoint; inspect canon_enrichment_progress instead of repeatedly digesting completed chapter/family units. Never commit unsupported interpretation as canon.
- For long-form branches, call story_director_context before chapter planning. Maintain arcs/threads/foreshadows/horizon with the granular story_* tools; use mystery_truth_upsert for author-only answers behind original mysteries and invention_upsert for original artifacts/techniques/mechanisms. Treat Director state as mutable author metadata, never as POV knowledge.
- Use a branch UUID or its unique branch name; prefer the stable branch name in model-authored calls to avoid UUID transcription errors.
- Before committing an accepted chapter, run fanfic_audit, fanfic_style_audit, and anti_copy_guard on the EXACT final draft with the same branch/fanficChapter. fanfic_apply_delta requires all three passing receipt ids for that draft and branch revision; a failed or stale audit cannot be bypassed.
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

## v0.6 transactional author workflow

The tool API version is `0.6.0` and author-context version is `3`. Branch arguments accept either the opaque UUID or the unique branch name; model-authored calls should prefer the stable name. `fanfic_apply_delta` is now a commit gate: the exact final draft must first receive passing `fanfic_audit`, `fanfic_style_audit`, and `anti_copy_guard` receipts at the same branch revision, and those receipts are consumed by a successful commit.

A rewrite must declare `rewriteMode`. `inherit` carries the previous active chapter-owned structured state forward, with optional explicit record drops; `replace` discards it and requires `confirmDroppedState=true` when active state would disappear. Later chapters cannot silently backfill earlier chapter-owned state. Rewrite settlement opens a Story Director reconciliation issue that remains visible until affected planning metadata is updated and `story_reconciliation_resolve` closes it. Core style deviations can be marked `revision-required`, and `author_context` is compacted to the configured hard JSON-character budget instead of allowing branch/evidence growth without a ceiling.
