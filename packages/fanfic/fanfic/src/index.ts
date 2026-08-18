/**
 * Fanfic authoring capability seam: provider registration and provider-selecting dispatch.
 * @module @deepseek-ai/dsh-fanfic
 */
import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {
  ApplyFanficDeltaRequest,
  AuthorContext,
  AuthorContextRequest,
  CanonChapter,
  CanonChapterReadRequest,
  CanonContextExpansion,
  CanonContextExpansionRequest,
  CanonCausalityTrace,
  CanonCausalityTraceRequest,
  CanonSearchHit,
  CanonSearchRequest,
  CanonSnapshot,
  CanonSnapshotRequest,
  CanonTimelineContext,
  CanonTimelineContextRequest,
  CanonEnrichmentCandidate,
  CanonEnrichmentCommitRequest,
  CanonEnrichmentCommitResult,
  CanonEnrichmentValidation,
  CanonEnrichmentCoverage,
  CanonEnrichmentCheckpointRequest,
  CanonEnrichmentPlan,
  CanonEnrichmentPlanRequest,
  CanonEnrichmentProgress,
  CanonEnrichmentProgressRequest,
  CharacterIntelligence,
  CharacterIntelligenceRequest,
  CharacterVoiceContext,
  CharacterVoiceContextRequest,
  NarrativeStyleContext,
  NarrativeStyleContextRequest,
  NarrativeStyleAuditRequest,
  NarrativeStyleAuditResult,
  AntiCopyGuardRequest,
  AntiCopyGuardResult,
  CreateFanficBranchRequest,
  FanficAuditRequest,
  FanficAuditResult,
  FanficBranch,
  FanficImpactScan,
  FanficImpactScanRequest,
  FanficProvider,
  FanficStatus,
  PowerAssessment,
  PowerAssessmentRequest,
  RecordFanficDivergenceRequest,
  StoryDirectorContext,
  StoryDirectorContextRequest,
  UpdateFanficIntentRequest,
  UpdateFanficStoryDirectorRequest,
  UpsertFanficStoryArcRequest,
  UpsertFanficStoryThreadRequest,
  UpsertFanficForeshadowRequest,
  SetFanficHorizonRequest,
  UpsertFanficMysteryTruthRequest,
  UpsertFanficInventionRequest,
  FanficDraft,
  StageFanficDraftRequest,
  UpdateFanficDraftRequest,
} from './types.ts'
import type { FanficBranchId } from './brand.ts'

export type * from './types.ts'
export { FanficBranchId } from './brand.ts'
export type { FanficBranchId as FanficBranchIdValue } from './brand.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    fanfic: FanficRuntime
  }
}

/** Fanfic seam failure with a stable code for host diagnostics. */
export class FanficError extends Error {
  constructor(message: string, readonly code: string) {
    super(message)
    this.name = 'FanficError'
  }
}

/** Provider selection config. Omit when exactly one usable provider is mounted. */
export interface FanficRuntimeConfig {
  /** Registered provider id to select; omitted when only one provider is mounted. */
  readonly provider?: string
}

/** Fanfic runtime selecting one registered provider without binding consumers to storage. */
export class FanficRuntime extends Service {
  static Config: z<FanficRuntimeConfig> = z.object({ provider: z.string() })

  private readonly providers = new Map<string, FanficProvider>()
  private readonly providerId: string | undefined

  constructor(ctx: Context, config: FanficRuntimeConfig = {}) {
    super(ctx, 'fanfic')
    this.providerId = config.provider
  }

  /**
   * Register one provider for this service lifetime.
   * @param provider - provider implementation to register.
   * @returns disposer that unregisters this provider contribution.
   */
  registerProvider(provider: FanficProvider): () => void {
    if (this.providers.has(provider.id)) {
      throw new FanficError(`fanfic provider ${JSON.stringify(provider.id)} is already registered`, 'FANFIC_DUPLICATE_PROVIDER')
    }
    const providers = this.providers
    const dispose = this.ctx.effect(function* () {
      providers.set(provider.id, provider)
      yield () => providers.delete(provider.id)
    }, 'fanfic.registerProvider()')
    return () => void dispose()
  }

  private provider(): FanficProvider {
    if (this.providerId !== undefined) {
      const provider = this.providers.get(this.providerId)
      if (provider === undefined) {
        throw new FanficError(`configured fanfic provider ${JSON.stringify(this.providerId)} is not registered`, 'FANFIC_PROVIDER_CONFIGURED_MISSING')
      }
      if (!provider.available()) {
        throw new FanficError(`configured fanfic provider ${JSON.stringify(this.providerId)} is unavailable`, 'FANFIC_PROVIDER_CONFIGURED_UNAVAILABLE')
      }
      return provider
    }
    const usable = [...this.providers.values()].filter(provider => provider.available())
    if (usable.length === 0) throw new FanficError('no usable fanfic provider is registered', 'FANFIC_PROVIDER_UNAVAILABLE')
    if (usable.length > 1) {
      throw new FanficError(`multiple usable fanfic providers are registered (${usable.map(provider => provider.id).join(', ')})`, 'FANFIC_PROVIDER_AMBIGUOUS')
    }
    return usable[0]!
  }

  /**
   * Return active provider and canon-pack status.
   * @param signal - cancellation signal.
   * @returns provider status.
   */
  status(signal?: AbortSignal): Promise<FanficStatus> { return this.provider().status(signal) }
  /**
   * Search spoiler-safe source canon.
   * @param request - bounded search request.
   * @param signal - cancellation signal.
   * @returns matching source excerpts.
   */
  search(request: CanonSearchRequest, signal?: AbortSignal): Promise<readonly CanonSearchHit[]> { return this.provider().search(request, signal) }
  /**
   * Read one source chapter under a spoiler cutoff.
   * @param request - chapter read request.
   * @param signal - cancellation signal.
   * @returns source chapter.
   */
  readChapter(request: CanonChapterReadRequest, signal?: AbortSignal): Promise<CanonChapter> { return this.provider().readChapter(request, signal) }
  /**
   * Compose canon state at one narrative point.
   * @param request - snapshot request.
   * @param signal - cancellation signal.
   * @returns spoiler-safe snapshot.
   */
  snapshot(request: CanonSnapshotRequest, signal?: AbortSignal): Promise<CanonSnapshot> { return this.provider().snapshot(request, signal) }
  /**
   * Compose writer-facing canon and branch context.
   * @param request - scene context request.
   * @param signal - cancellation signal.
   * @returns author context packet.
   */
  authorContext(request: AuthorContextRequest, signal?: AbortSignal): Promise<AuthorContext> { return this.provider().authorContext(request, signal) }
  /**
   * Query source-backed causal links.
   * @param request - causal query.
   * @param signal - cancellation signal.
   * @returns bounded causal trace.
   */
  traceCausality(request: CanonCausalityTraceRequest, signal?: AbortSignal): Promise<CanonCausalityTrace> { return this.provider().traceCausality(request, signal) }
  /**
   * Query worldline/timeline rules, relevant events, and source evidence at one cutoff.
   * @param request - timeline/worldline query.
   * @param signal - cancellation signal.
   * @returns bounded timeline context.
   */
  timelineContext(request: CanonTimelineContextRequest, signal?: AbortSignal): Promise<CanonTimelineContext> { return this.provider().timelineContext(request, signal) }
  /**
   * Expand explicit scene entities through spoiler-safe structured graph edges.
   * @param request - seed entities and cutoff.
   * @param signal - cancellation signal.
   * @returns discovered related entities with reasons.
   */
  expandContext(request: CanonContextExpansionRequest, signal?: AbortSignal): Promise<CanonContextExpansion> { return this.provider().expandContext(request, signal) }
  /**
   * Build one source-backed character dossier at the requested cutoff.
   * @param request - character dossier request.
   * @param signal - cancellation signal.
   * @returns temporal state, epistemics, relationships, powers, evidence, and gaps.
   */
  characterIntelligence(request: CharacterIntelligenceRequest, signal?: AbortSignal): Promise<CharacterIntelligence> { return this.provider().characterIntelligence(request, signal) }
  /**
   * Return bounded source-backed dialogue/voice evidence for one character.
   * @param request - character, cutoff, and sample limit.
   * @param signal - cancellation signal.
   * @returns contextual source windows and structured voice notes.
   */
  characterVoiceContext(request: CharacterVoiceContextRequest, signal?: AbortSignal): Promise<CharacterVoiceContext> { return this.provider().characterVoiceContext(request, signal) }
  /**
   * Compose cutoff-safe work-level narrative rhythm and scene-mode evidence.
   * @param request - scene mode, cutoff, participants, and sample limit.
   * @param signal - cancellation signal.
   * @returns high-level narrative style context.
   */
  narrativeStyleContext(request: NarrativeStyleContextRequest, signal?: AbortSignal): Promise<NarrativeStyleContext> { return this.provider().narrativeStyleContext(request, signal) }
  /**
   * Detect exact draft overlap against immutable source text without exposing future-source locations.
   * @param request - draft, cutoff, and overlap thresholds.
   * @param signal - cancellation signal.
   * @returns corpus-wide anti-copy findings.
   */
  antiCopyGuard(request: AntiCopyGuardRequest, signal?: AbortSignal): Promise<AntiCopyGuardResult> { return this.provider().antiCopyGuard(request, signal) }
  /**
   * Audit high-level narrative drift and accidental source overlap.
   * @param request - draft plus style-context and anti-copy settings.
   * @param signal - cancellation signal.
   * @returns quantitative style and anti-copy findings.
   */
  auditNarrativeStyle(request: NarrativeStyleAuditRequest, signal?: AbortSignal): Promise<NarrativeStyleAuditResult> { return this.provider().auditNarrativeStyle(request, signal) }
  /**
   * Assess known power constraints without inventing a fight winner.
   * @param request - actors, scenario, and cutoff.
   * @param signal - cancellation signal.
   * @returns evidence-first capability assessment.
   */
  assessPower(request: PowerAssessmentRequest, signal?: AbortSignal): Promise<PowerAssessment> { return this.provider().assessPower(request, signal) }
  /**
   * Scan canon dependencies and branch threads affected by a proposed divergence.
   * @param request - proposed change, entities, and cutoff.
   * @param signal - cancellation signal.
   * @returns relevant dependencies and open branch threads.
   */
  impactScan(request: FanficImpactScanRequest, signal?: AbortSignal): Promise<FanficImpactScan> { return this.provider().impactScan(request, signal) }
  /**
   * Validate a structured enrichment candidate against immutable chapter evidence.
   * @param candidate - source-backed candidate to validate.
   * @param signal - cancellation signal.
   * @returns evidence result and token when valid.
   */
  validateEnrichment(candidate: CanonEnrichmentCandidate, signal?: AbortSignal): Promise<CanonEnrichmentValidation> { return this.provider().validateEnrichment(candidate, signal) }
  /**
   * Commit a token-bound verified enrichment record into the provider overlay.
   * @param request - candidate plus validation token.
   * @param signal - cancellation signal.
   * @returns committed record metadata.
   */
  commitEnrichment(request: CanonEnrichmentCommitRequest, signal?: AbortSignal): Promise<CanonEnrichmentCommitResult> { return this.provider().commitEnrichment(request, signal) }
  /**
   * Plan the next source chapters requiring structured enrichment review.
   * @param request - chapter range, record families, and batch size.
   * @param signal - cancellation signal.
   * @returns deterministic enrichment work queue.
   */
  planEnrichment(request: CanonEnrichmentPlanRequest, signal?: AbortSignal): Promise<CanonEnrichmentPlan> { return this.provider().planEnrichment(request, signal) }
  /**
   * Report persisted enrichment coverage over a chapter range.
   * @param request - chapter range and record families.
   * @param signal - cancellation signal.
   * @returns aggregate coverage and effective checkpoints.
   */
  enrichmentProgress(request: CanonEnrichmentProgressRequest, signal?: AbortSignal): Promise<CanonEnrichmentProgress> { return this.provider().enrichmentProgress(request, signal) }
  /**
   * Mark one chapter/record-family review complete after verified records have been admitted.
   * @param request - reviewed chapter, family, admitted ids, and review notes.
   * @param signal - cancellation signal.
   * @returns persisted coverage checkpoint.
   */
  checkpointEnrichment(request: CanonEnrichmentCheckpointRequest, signal?: AbortSignal): Promise<CanonEnrichmentCoverage> { return this.provider().checkpointEnrichment(request, signal) }
  /**
   * List persisted fanfic branches.
   * @param signal - cancellation signal.
   * @returns branch snapshots.
   */
  listBranches(signal?: AbortSignal): Promise<readonly FanficBranch[]> { return this.provider().listBranches(signal) }
  /**
   * Create one branch over immutable canon.
   * @param request - branch creation request.
   * @param signal - cancellation signal.
   * @returns created branch.
   */
  createBranch(request: CreateFanficBranchRequest, signal?: AbortSignal): Promise<FanficBranch> { return this.provider().createBranch(request, signal) }
  /**
   * Read the full administrative branch state.
   * @param id - branch id.
   * @param signal - cancellation signal.
   * @returns branch snapshot.
   */
  getBranch(id: FanficBranchId, signal?: AbortSignal): Promise<FanficBranch> { return this.provider().getBranch(id, signal) }
  /**
   * Record a canon divergence using CAS revision.
   * @param request - divergence write.
   * @param signal - cancellation signal.
   * @returns updated branch.
   */
  recordDivergence(request: RecordFanficDivergenceRequest, signal?: AbortSignal): Promise<FanficBranch> { return this.provider().recordDivergence(request, signal) }
  /**
   * Replace branch author intent using CAS revision.
   * @param request - intent update.
   * @param signal - cancellation signal.
   * @returns updated branch.
   */
  updateIntent(request: UpdateFanficIntentRequest, signal?: AbortSignal): Promise<FanficBranch> { return this.provider().updateIntent(request, signal) }
  /**
   * Replace durable long-form Story Director metadata using CAS revision.
   * @param request - complete director state and expected branch revision.
   * @param signal - cancellation signal.
   * @returns updated branch.
   */
  updateStoryDirector(request: UpdateFanficStoryDirectorRequest, signal?: AbortSignal): Promise<FanficBranch> { return this.provider().updateStoryDirector(request, signal) }
  /**
   * Upsert one Story Director arc.
   * @param request - arc payload and expected branch revision.
   * @param signal - cancellation signal.
   * @returns updated branch.
   */
  upsertStoryArc(request: UpsertFanficStoryArcRequest, signal?: AbortSignal): Promise<FanficBranch> { return this.provider().upsertStoryArc(request, signal) }
  /**
   * Upsert one Story Director thread.
   * @param request - thread payload and expected branch revision.
   * @param signal - cancellation signal.
   * @returns updated branch.
   */
  upsertStoryThread(request: UpsertFanficStoryThreadRequest, signal?: AbortSignal): Promise<FanficBranch> { return this.provider().upsertStoryThread(request, signal) }
  /**
   * Upsert one Story Director foreshadow.
   * @param request - foreshadow payload and expected branch revision.
   * @param signal - cancellation signal.
   * @returns updated branch.
   */
  upsertForeshadow(request: UpsertFanficForeshadowRequest, signal?: AbortSignal): Promise<FanficBranch> { return this.provider().upsertForeshadow(request, signal) }
  /**
   * Replace the rolling Story Director horizon.
   * @param request - chapter plans and expected branch revision.
   * @param signal - cancellation signal.
   * @returns updated branch.
   */
  setStoryHorizon(request: SetFanficHorizonRequest, signal?: AbortSignal): Promise<FanficBranch> { return this.provider().setStoryHorizon(request, signal) }
  /**
   * Upsert one author-only mystery truth.
   * @param request - private mystery truth and expected branch revision.
   * @param signal - cancellation signal.
   * @returns updated branch.
   */
  upsertMysteryTruth(request: UpsertFanficMysteryTruthRequest, signal?: AbortSignal): Promise<FanficBranch> { return this.provider().upsertMysteryTruth(request, signal) }
  /**
   * Upsert one fanfic-original invention record.
   * @param request - invention constraints and expected branch revision.
   * @param signal - cancellation signal.
   * @returns updated branch.
   */
  upsertInvention(request: UpsertFanficInventionRequest, signal?: AbortSignal): Promise<FanficBranch> { return this.provider().upsertInvention(request, signal) }
  /**
   * Resolve one open Story Director reconciliation issue after granular metadata has been updated.
   * @param request - branch revision and reconciliation id.
   * @param signal - cancellation signal.
   * @returns updated branch.
   */
  resolveDirectorReconciliation(request: { readonly branchId: FanficBranchId; readonly expectedRevision: number; readonly reconciliationId: string }, signal?: AbortSignal): Promise<FanficBranch> { return this.provider().resolveDirectorReconciliation(request, signal) }
  /**
   * Compose a bounded Story Director packet around one fanfic chapter.
   * @param request - branch, chapter, and rolling horizon size.
   * @param signal - cancellation signal.
   * @returns active arcs, threads, foreshadows, horizon, and attention items.
   */
  storyDirectorContext(request: StoryDirectorContextRequest, signal?: AbortSignal): Promise<StoryDirectorContext> { return this.provider().storyDirectorContext(request, signal) }
  /**
   * Stage prose for exact-hash audit and commit operations.
   * @param request - branch, chapter, and prose text.
   * @param signal - cancellation signal.
   * @returns staged draft metadata and text.
   */
  stageDraft(request: StageFanficDraftRequest, signal?: AbortSignal): Promise<FanficDraft> { return this.provider().stageDraft(request, signal) }
  /**
   * Replace one staged draft while preserving its identity.
   * @param request - draft revision and replacement prose.
   * @param signal - cancellation signal.
   * @returns updated staged draft.
   */
  updateDraft(request: UpdateFanficDraftRequest, signal?: AbortSignal): Promise<FanficDraft> { return this.provider().updateDraft(request, signal) }
  /**
   * Read one staged draft.
   * @param draftId - staged draft id.
   * @param signal - cancellation signal.
   * @returns staged draft.
   */
  getDraft(draftId: string, signal?: AbortSignal): Promise<FanficDraft> { return this.provider().getDraft(draftId, signal) }
  /**
   * Append Observer/Reflector state using CAS revision.
   * @param request - state delta.
   * @param signal - cancellation signal.
   * @returns updated branch.
   */
  applyDelta(request: ApplyFanficDeltaRequest, signal?: AbortSignal): Promise<FanficBranch> { return this.provider().applyDelta(request, signal) }
  /**
   * Run deterministic canon and branch-state audit.
   * @param request - draft audit request.
   * @param signal - cancellation signal.
   * @returns audit findings.
   */
  audit(request: FanficAuditRequest, signal?: AbortSignal): Promise<FanficAuditResult> { return this.provider().audit(request, signal) }
}

export default FanficRuntime
