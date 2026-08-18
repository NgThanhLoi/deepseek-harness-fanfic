# Fanfic Authoring

English | [中文](fanfic.zh.md)

`ctx.fanfic` ([`@deepseek-ai/dsh-fanfic`](../../packages/fanfic/fanfic)) is the opt-in fanfic authoring seam: an immutable source canon plus mutable author branches, with spoiler-safe lookups, verified enrichment, and transactional chapter settlement. It loads only through the [fanfic-authoring bundle patch](../../packages/bundle/fanfic-authoring), never a base composition.

The [package README](../../packages/fanfic/fanfic/README.md) owns composition and service config, [`@deepseek-ai/dsh-fanfic-local`](../../packages/fanfic/fanfic-local/README.md) owns the in-repo provider over the shipped [《一世之尊》 canon pack](../../canon-packs/yishizhizun), and the 39 model-facing tools are catalogued in the [tool schema catalog](../tool-catalog.md#deepseek-aidsh-tool-fanfic). The generated Cordis API below records the provider-selecting service contract and is the method-level authority for every operation.

## Canon and branches

The service registers provider implementations and dispatches each call to exactly one usable provider. Read-only canon access, divergence checks, and branch-state writes stay behind that provider seam, so tool schemas are provider-neutral and a consumer never depends on storage layout.

Immutable canon is the 1,409-chapter source pack; branches are mutable author state anchored to it. `fanfic_branch_create` names a branch, and every branch write carries a compare-and-set revision that makes conflicting concurrent writes fail loud instead of silently overwriting.

## Cutoff and POV knowledge

Two independent cutoffs bound every read. `asOfChapter` caps the immutable canon narrative; `fanficChapter` caps the mutable branch. Future source is excluded before ranking, so a query never leaks a chapter past the cutoff.

Canon truth binds the author as established history up to its cutoff; after a recorded divergence, `canonReference` is counterfactual reference only. Reader knowledge and hidden canon truth never become POV knowledge without source evidence, and `character_intelligence` records only facts with an evidence trail.

## Verified enrichment

`canon_enrichment_validate` checks a proposed structured record against an exact chapter excerpt and returns a verification token only when evidence and structure validate; `canon_enrichment_commit` writes the token-bound record into the provider overlay, never the base pack. `canon_enrichment_plan` yields a deterministic chapter work queue, and `canon_enrichment_checkpoint` marks reviewed units so `canon_enrichment_progress` reports persisted coverage instead of repeated digestion.

## Story Director

For long-form branches, `story_director_context` composes the active arcs, threads, foreshadows, rolling horizon, and attention items around one fanfic chapter. Arcs, threads, foreshadows, the horizon, author-only mystery truths, and original inventions are mutable author metadata managed through the granular `story_*`, `mystery_truth_upsert`, and `invention_upsert` tools; they are never POV knowledge.

## Chapter settlement

Final prose is staged once with `fanfic_draft_stage`, which assigns a durable `draftId`, revision, and SHA-256; `fanfic_draft_update` replaces text in a staged draft and invalidates receipts issued for the older text. `fanfic_audit`, `fanfic_style_audit`, and `anti_copy_guard` each return a deterministic receipt bound to that draft hash, the branch revision, and the branch's writing contract, and `fanfic_apply_delta` (or a rewrite) requires all three receipts for the same draft. Ad-hoc text remains inspectable but cannot receive a commit receipt. Rewrites choose `inherit`, which carries the previous active structured chapter state, or `replace`, which discards it and requires explicit confirmation when state would be lost; backfilling a later chapter's state into an earlier one is rejected. Metadata edits that follow a rewrite are reconciled explicitly through `story_reconciliation_resolve`.

## Writing Contract

Each branch persists a durable writing contract — `zh-CN`, 2,500–4,000 Han characters, `auto` style mode by default — carried on `fanfic_intent_update` with the author intent. `fanfic_style_audit` enforces the contract even when a caller passes weaker ad-hoc limits, binds its style receipts to the contract hash, and rejects drafts outside the Han range, so settlement cannot reuse a receipt after the contract changes.

## Prose quality guard

`fanfic_style_audit` deterministically checks consecutive ultra-short paragraphs, tail collapse, normalized repeated sentences, Han-bigram diversity collapse on long drafts, and repeated filler cadence. Revision-required degeneration, padding, or length failure cannot issue a style receipt; the thresholds are provider configuration, not source constants.

## Mystery reveal guard

Original mystery truths may register `protectedRevealTerms` and `revealConditions`. A full reveal in prose must be declared to `fanfic_audit` with a registered satisfied condition and exact short `conditionEvidence` that actually appears in the staged draft; an undeclared reveal or fabricated evidence is rejected, and a related planned payoff cannot settle unless the canon receipt authorizes that mystery id.

## Versioning

On-disk branches are format 3, author context packets are version 4, and the tool API is 0.7. Because DeepSeek Harness is pre-release, v0.7 branches reject older on-disk formats instead of migrating them; live tests use fresh state.

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — this section is byte-identical in both language sides of the page. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxfanfic--fanficruntime"></a>

### `ctx.fanfic` — `FanficRuntime`

Fanfic runtime selecting one registered provider without binding consumers to storage.

```ts cordis-catalog
/**
 * Register one provider for this service lifetime.
 * @param provider - provider implementation to register.
 * @returns disposer that unregisters this provider contribution.
 */
registerProvider(provider: FanficProvider): () => void

/**
 * Return active provider and canon-pack status.
 * @param signal - cancellation signal.
 * @returns provider status.
 */
status(signal?: AbortSignal): Promise<FanficStatus>

/**
 * Search spoiler-safe source canon.
 * @param request - bounded search request.
 * @param signal - cancellation signal.
 * @returns matching source excerpts.
 */
search(request: CanonSearchRequest, signal?: AbortSignal): Promise<readonly CanonSearchHit[]>

/**
 * Read one source chapter under a spoiler cutoff.
 * @param request - chapter read request.
 * @param signal - cancellation signal.
 * @returns source chapter.
 */
readChapter(request: CanonChapterReadRequest, signal?: AbortSignal): Promise<CanonChapter>

/**
 * Compose canon state at one narrative point.
 * @param request - snapshot request.
 * @param signal - cancellation signal.
 * @returns spoiler-safe snapshot.
 */
snapshot(request: CanonSnapshotRequest, signal?: AbortSignal): Promise<CanonSnapshot>

/**
 * Compose writer-facing canon and branch context.
 * @param request - scene context request.
 * @param signal - cancellation signal.
 * @returns author context packet.
 */
authorContext(request: AuthorContextRequest, signal?: AbortSignal): Promise<AuthorContext>

/**
 * Query source-backed causal links.
 * @param request - causal query.
 * @param signal - cancellation signal.
 * @returns bounded causal trace.
 */
traceCausality(request: CanonCausalityTraceRequest, signal?: AbortSignal): Promise<CanonCausalityTrace>

/**
 * Query worldline/timeline rules, relevant events, and source evidence at one cutoff.
 * @param request - timeline/worldline query.
 * @param signal - cancellation signal.
 * @returns bounded timeline context.
 */
timelineContext(request: CanonTimelineContextRequest, signal?: AbortSignal): Promise<CanonTimelineContext>

/**
 * Expand explicit scene entities through spoiler-safe structured graph edges.
 * @param request - seed entities and cutoff.
 * @param signal - cancellation signal.
 * @returns discovered related entities with reasons.
 */
expandContext(request: CanonContextExpansionRequest, signal?: AbortSignal): Promise<CanonContextExpansion>

/**
 * Build one source-backed character dossier at the requested cutoff.
 * @param request - character dossier request.
 * @param signal - cancellation signal.
 * @returns temporal state, epistemics, relationships, powers, evidence, and gaps.
 */
characterIntelligence(request: CharacterIntelligenceRequest, signal?: AbortSignal): Promise<CharacterIntelligence>

/**
 * Return bounded source-backed dialogue/voice evidence for one character.
 * @param request - character, cutoff, and sample limit.
 * @param signal - cancellation signal.
 * @returns contextual source windows and structured voice notes.
 */
characterVoiceContext(request: CharacterVoiceContextRequest, signal?: AbortSignal): Promise<CharacterVoiceContext>

/**
 * Compose cutoff-safe work-level narrative rhythm and scene-mode evidence.
 * @param request - scene mode, cutoff, participants, and sample limit.
 * @param signal - cancellation signal.
 * @returns high-level narrative style context.
 */
narrativeStyleContext(request: NarrativeStyleContextRequest, signal?: AbortSignal): Promise<NarrativeStyleContext>

/**
 * Detect exact draft overlap against immutable source text without exposing future-source locations.
 * @param request - draft, cutoff, and overlap thresholds.
 * @param signal - cancellation signal.
 * @returns corpus-wide anti-copy findings.
 */
antiCopyGuard(request: AntiCopyGuardRequest, signal?: AbortSignal): Promise<AntiCopyGuardResult>

/**
 * Audit high-level narrative drift and accidental source overlap.
 * @param request - draft plus style-context and anti-copy settings.
 * @param signal - cancellation signal.
 * @returns quantitative style and anti-copy findings.
 */
auditNarrativeStyle(request: NarrativeStyleAuditRequest, signal?: AbortSignal): Promise<NarrativeStyleAuditResult>

/**
 * Assess known power constraints without inventing a fight winner.
 * @param request - actors, scenario, and cutoff.
 * @param signal - cancellation signal.
 * @returns evidence-first capability assessment.
 */
assessPower(request: PowerAssessmentRequest, signal?: AbortSignal): Promise<PowerAssessment>

/**
 * Scan canon dependencies and branch threads affected by a proposed divergence.
 * @param request - proposed change, entities, and cutoff.
 * @param signal - cancellation signal.
 * @returns relevant dependencies and open branch threads.
 */
impactScan(request: FanficImpactScanRequest, signal?: AbortSignal): Promise<FanficImpactScan>

/**
 * Validate a structured enrichment candidate against immutable chapter evidence.
 * @param candidate - source-backed candidate to validate.
 * @param signal - cancellation signal.
 * @returns evidence result and token when valid.
 */
validateEnrichment(candidate: CanonEnrichmentCandidate, signal?: AbortSignal): Promise<CanonEnrichmentValidation>

/**
 * Commit a token-bound verified enrichment record into the provider overlay.
 * @param request - candidate plus validation token.
 * @param signal - cancellation signal.
 * @returns committed record metadata.
 */
commitEnrichment(request: CanonEnrichmentCommitRequest, signal?: AbortSignal): Promise<CanonEnrichmentCommitResult>

/**
 * Plan the next source chapters requiring structured enrichment review.
 * @param request - chapter range, record families, and batch size.
 * @param signal - cancellation signal.
 * @returns deterministic enrichment work queue.
 */
planEnrichment(request: CanonEnrichmentPlanRequest, signal?: AbortSignal): Promise<CanonEnrichmentPlan>

/**
 * Report persisted enrichment coverage over a chapter range.
 * @param request - chapter range and record families.
 * @param signal - cancellation signal.
 * @returns aggregate coverage and effective checkpoints.
 */
enrichmentProgress(request: CanonEnrichmentProgressRequest, signal?: AbortSignal): Promise<CanonEnrichmentProgress>

/**
 * Mark one chapter/record-family review complete after verified records have been admitted.
 * @param request - reviewed chapter, family, admitted ids, and review notes.
 * @param signal - cancellation signal.
 * @returns persisted coverage checkpoint.
 */
checkpointEnrichment(request: CanonEnrichmentCheckpointRequest, signal?: AbortSignal): Promise<CanonEnrichmentCoverage>

/**
 * List persisted fanfic branches.
 * @param signal - cancellation signal.
 * @returns branch snapshots.
 */
listBranches(signal?: AbortSignal): Promise<readonly FanficBranch[]>

/**
 * Create one branch over immutable canon.
 * @param request - branch creation request.
 * @param signal - cancellation signal.
 * @returns created branch.
 */
createBranch(request: CreateFanficBranchRequest, signal?: AbortSignal): Promise<FanficBranch>

/**
 * Read the full administrative branch state.
 * @param id - branch id.
 * @param signal - cancellation signal.
 * @returns branch snapshot.
 */
getBranch(id: FanficBranchId, signal?: AbortSignal): Promise<FanficBranch>

/**
 * Record a canon divergence using CAS revision.
 * @param request - divergence write.
 * @param signal - cancellation signal.
 * @returns updated branch.
 */
recordDivergence(request: RecordFanficDivergenceRequest, signal?: AbortSignal): Promise<FanficBranch>

/**
 * Replace branch author intent using CAS revision.
 * @param request - intent update.
 * @param signal - cancellation signal.
 * @returns updated branch.
 */
updateIntent(request: UpdateFanficIntentRequest, signal?: AbortSignal): Promise<FanficBranch>

/**
 * Replace durable long-form Story Director metadata using CAS revision.
 * @param request - complete director state and expected branch revision.
 * @param signal - cancellation signal.
 * @returns updated branch.
 */
updateStoryDirector(request: UpdateFanficStoryDirectorRequest, signal?: AbortSignal): Promise<FanficBranch>

/**
 * Upsert one Story Director arc.
 * @param request - arc payload and expected branch revision.
 * @param signal - cancellation signal.
 * @returns updated branch.
 */
upsertStoryArc(request: UpsertFanficStoryArcRequest, signal?: AbortSignal): Promise<FanficBranch>

/**
 * Upsert one Story Director thread.
 * @param request - thread payload and expected branch revision.
 * @param signal - cancellation signal.
 * @returns updated branch.
 */
upsertStoryThread(request: UpsertFanficStoryThreadRequest, signal?: AbortSignal): Promise<FanficBranch>

/**
 * Upsert one Story Director foreshadow.
 * @param request - foreshadow payload and expected branch revision.
 * @param signal - cancellation signal.
 * @returns updated branch.
 */
upsertForeshadow(request: UpsertFanficForeshadowRequest, signal?: AbortSignal): Promise<FanficBranch>

/**
 * Replace the rolling Story Director horizon.
 * @param request - chapter plans and expected branch revision.
 * @param signal - cancellation signal.
 * @returns updated branch.
 */
setStoryHorizon(request: SetFanficHorizonRequest, signal?: AbortSignal): Promise<FanficBranch>

/**
 * Upsert one author-only mystery truth.
 * @param request - private mystery truth and expected branch revision.
 * @param signal - cancellation signal.
 * @returns updated branch.
 */
upsertMysteryTruth(request: UpsertFanficMysteryTruthRequest, signal?: AbortSignal): Promise<FanficBranch>

/**
 * Upsert one fanfic-original invention record.
 * @param request - invention constraints and expected branch revision.
 * @param signal - cancellation signal.
 * @returns updated branch.
 */
upsertInvention(request: UpsertFanficInventionRequest, signal?: AbortSignal): Promise<FanficBranch>

/**
 * Resolve one open Story Director reconciliation issue after granular metadata has been updated.
 * @param request - branch revision and reconciliation id.
 * @param signal - cancellation signal.
 * @returns updated branch.
 */
resolveDirectorReconciliation(request: { readonly branchId: FanficBranchId; readonly expectedRevision: number; readonly reconciliationId: string }, signal?: AbortSignal): Promise<FanficBranch>

/**
 * Compose a bounded Story Director packet around one fanfic chapter.
 * @param request - branch, chapter, and rolling horizon size.
 * @param signal - cancellation signal.
 * @returns active arcs, threads, foreshadows, horizon, and attention items.
 */
storyDirectorContext(request: StoryDirectorContextRequest, signal?: AbortSignal): Promise<StoryDirectorContext>

/**
 * Stage prose for exact-hash audit and commit operations.
 * @param request - branch, chapter, and prose text.
 * @param signal - cancellation signal.
 * @returns staged draft metadata and text.
 */
stageDraft(request: StageFanficDraftRequest, signal?: AbortSignal): Promise<FanficDraft>

/**
 * Replace one staged draft while preserving its identity.
 * @param request - draft revision and replacement prose.
 * @param signal - cancellation signal.
 * @returns updated staged draft.
 */
updateDraft(request: UpdateFanficDraftRequest, signal?: AbortSignal): Promise<FanficDraft>

/**
 * Read one staged draft.
 * @param draftId - staged draft id.
 * @param signal - cancellation signal.
 * @returns staged draft.
 */
getDraft(draftId: string, signal?: AbortSignal): Promise<FanficDraft>

/**
 * Append Observer/Reflector state using CAS revision.
 * @param request - state delta.
 * @param signal - cancellation signal.
 * @returns updated branch.
 */
applyDelta(request: ApplyFanficDeltaRequest, signal?: AbortSignal): Promise<FanficBranch>

/**
 * Run deterministic canon and branch-state audit.
 * @param request - draft audit request.
 * @param signal - cancellation signal.
 * @returns audit findings.
 */
audit(request: FanficAuditRequest, signal?: AbortSignal): Promise<FanficAuditResult>
```

Source: [`packages/fanfic/fanfic/src/index.ts:95`](../../packages/fanfic/fanfic/src/index.ts)
<!-- END GENERATED cordis-surface -->