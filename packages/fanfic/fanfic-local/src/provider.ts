/** Filesystem-backed fanfic provider implementation. @module @deepseek-ai/dsh-fanfic-local/provider */
import { createHash, randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { appendFile, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { FanficBranchId } from '@deepseek-ai/dsh-fanfic/brand'
import type {
  ApplyFanficDeltaRequest,
  AntiCopyFinding,
  AntiCopyGuardRequest,
  AntiCopyGuardResult,
  AuthorContext,
  AuthorContextRequest,
  CanonChapter,
  CanonChapterReadRequest,
  CanonContextExpansion,
  CanonContextExpansionRequest,
  CanonDiscoveredEntity,
  CanonCausalLink,
  CanonCausalityTrace,
  CanonCausalityTraceRequest,
  CanonCharacterState,
  CanonEvent,
  CanonFact,
  CanonIdentityEdge,
  CanonKnowledge,
  CanonMystery,
  CanonPowerState,
  CanonProvenance,
  CanonRelationshipState,
  CanonSearchHit,
  CanonSearchRequest,
  CanonSnapshot,
  CanonSnapshotRequest,
  CanonTimelineRule,
  CanonTimelineContext,
  CanonTimelineContextRequest,
  CanonEnrichmentCandidate,
  CanonEnrichmentCommitRequest,
  CanonEnrichmentCommitResult,
  CanonEnrichmentKind,
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
  CharacterVoiceSample,
  NarrativeStyleAuditRequest,
  NarrativeStyleAuditResult,
  NarrativeStyleContext,
  NarrativeStyleContextRequest,
  NarrativeStyleMetrics,
  NarrativeStyleMode,
  NarrativeStyleSample,
  NarrativeStyleDeviation,
  CreateFanficBranchRequest,
  FanficAuditClaim,
  FanficAuditReceipt,
  FanficAuditIssue,
  FanficAuditRequest,
  FanficAuditResult,
  FanficAuthorIntent,
  FanficDraft,
  FanficMysteryRevealDeclaration,
  FanficWritingContract,
  FanficBranch,
  FanficBranchIdValue,
  FanficCausalThread,
  FanficImpactScan,
  FanficImpactScanRequest,
  FanficDivergence,
  FanficJsonValue,
  FanficOverlayCharacterState,
  FanficOverlayFact,
  FanficOverlayKnowledge,
  FanficOverlayRelationship,
  FanficProvider,
  FanficStateDelta,
  FanficStatus,
  FanficChapterPlan,
  FanficChapterVersion,
  FanficChapterSummary,
  FanficMysteryTruth,
  FanficInvention,
  FanficForeshadow,
  FanficStoryArc,
  FanficStoryDirectorState,
  FanficStoryThread,
  FanficDirectorReconciliation,
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
  StageFanficDraftRequest,
  UpdateFanficDraftRequest,
  ProseQualityResult,
  ProseQualityFinding,
} from '@deepseek-ai/dsh-fanfic'

/** Local canon-pack and branch-storage configuration. */
export interface ProviderConfig {
  /** Provider id registered on `ctx.fanfic`. */
  providerId: string
  /** Directory containing manifest.json, source.json, chapters.ndjson, and graph/*.ndjson. */
  canonPackDir: string
  /** Writable root whose branches/ child stores fanfic overlays. */
  stateDir: string
  /** Hard cap on source hits returned by one search. */
  maxSearchResults: number
  /** Hard cap on characters in one returned source excerpt. */
  maxExcerptChars: number
  /** Per-category cap on structured records in one snapshot. */
  maxStructuredRecords: number
  /** Maximum graph-expanded entities automatically admitted into one author context. */
  authorContextMaxEntities: number
  /** Source-search limit used while composing author context. */
  authorContextSearchLimit: number
  /** Maximum character dossiers composed into one author context. */
  authorContextCharacterLimit: number
  /** Source-evidence hits requested for each automatic character dossier. */
  authorContextEvidenceLimit: number
  /** Number of accepted chapter summaries returned by Story Director context. */
  storyRecentSummaryLimit: number
  /** Maximum dialogue fragments extracted from one character voice sample. */
  voiceDialogueFragmentLimit: number
  /** Maximum source chapters used to form one narrative-style reference aggregate. */
  styleReferenceChapterLimit: number
  /** Maximum characters returned in one source style-evidence excerpt. */
  styleSampleExcerptChars: number
  /** Maximum draft characters scanned by one anti-copy request. */
  antiCopyMaxDraftChars: number
  /** Hard cap on anti-copy findings returned to a caller. */
  antiCopyMaxFindings: number
  /** Relative drift ratio used for broad quantitative style warnings. */
  styleDeviationRatio: number
  /** Larger core-metric drift that requires revision before a style receipt may be issued. */
  styleRevisionRequiredRatio: number
  /** Maximum active records from each branch category admitted into author_context. */
  authorContextBranchRecordLimit: number
  /** Maximum source excerpts admitted into canonTruth inside author_context. */
  authorContextSourceExcerptLimit: number
  /** Hard serialized JSON budget for author_context; compaction removes optional evidence first. */
  authorContextMaxJsonChars: number
  /** Maximum Han characters in a paragraph still considered ultra-short by the prose-quality guard. */
  proseQualityUltraShortHanChars: number
  /** Consecutive ultra-short paragraphs that require revision. */
  proseQualityMaxUltraShortRun: number
  /** Tail ultra-short paragraph ratio that requires revision. */
  proseQualityTailUltraShortRatio: number
  /** Minimum Han-bigram diversity accepted for long drafts. */
  proseQualityMinBigramDiversity: number
  /** Filler-phrase hits in the draft tail that require revision. */
  proseQualityTailFillerLimit: number
}

interface CanonPackManifest {
  readonly schemaVersion: number
  readonly canonPackId: string
  readonly graphVersion: number
}

interface CanonPackSource {
  readonly title: string
  readonly creator: string
  readonly sha256: string
  readonly chapterCount: number
}

interface NarrativeStyleBankChapter {
  readonly chapter: number
  readonly chapterSha256: string
  readonly metrics: NarrativeStyleMetrics
  readonly modeScores: Readonly<Record<string, number>>
}

interface NarrativeStyleBank {
  readonly schemaVersion: number
  readonly sourceSha256: string
  readonly chapterCount: number
  readonly modes: readonly Exclude<NarrativeStyleMode, 'auto'>[]
  readonly chapterMetrics: readonly NarrativeStyleBankChapter[]
}

interface CopyCorpusSpan {
  readonly chapter: number
  readonly start: number
  readonly end: number
}

interface CopyCorpus {
  readonly text: string
  readonly spans: readonly CopyCorpusSpan[]
}

interface LoadedCanonPack {
  readonly manifest: CanonPackManifest
  readonly source: CanonPackSource
  readonly chapters: readonly CanonChapter[]
  readonly facts: readonly CanonFact[]
  readonly knowledge: readonly CanonKnowledge[]
  readonly characters: readonly CanonCharacterState[]
  readonly identities: readonly CanonIdentityEdge[]
  readonly powers: readonly CanonPowerState[]
  readonly relationships: readonly CanonRelationshipState[]
  readonly mysteries: readonly CanonMystery[]
  readonly events: readonly CanonEvent[]
  readonly timelineRules: readonly CanonTimelineRule[]
  readonly causalLinks: readonly CanonCausalLink[]
  readonly enrichmentCounts: Readonly<Record<CanonEnrichmentKind, number>>
  readonly styleBank: NarrativeStyleBank
}

interface LoadedGraphRows {
  readonly facts: readonly CanonFact[]
  readonly knowledge: readonly CanonKnowledge[]
  readonly characters: readonly CanonCharacterState[]
  readonly identities: readonly CanonIdentityEdge[]
  readonly powers: readonly CanonPowerState[]
  readonly relationships: readonly CanonRelationshipState[]
  readonly mysteries: readonly CanonMystery[]
  readonly events: readonly CanonEvent[]
  readonly timelineRules: readonly CanonTimelineRule[]
  readonly causalLinks: readonly CanonCausalLink[]
}

/** Filesystem-backed implementation with immutable canon and CAS branch writes. */
export class LocalFanficProvider implements FanficProvider {
  readonly id: string
  private readonly canonPackDir: string
  private readonly stateDir: string
  private readonly branchesDir: string
  private readonly enrichmentGraphDir: string
  private readonly enrichmentCoveragePath: string
  private readonly auditReceiptsDir: string
  private readonly draftsDir: string
  private readonly maxSearchResults: number
  private readonly maxExcerptChars: number
  private readonly maxStructuredRecords: number
  private readonly authorContextMaxEntities: number
  private readonly authorContextSearchLimit: number
  private readonly authorContextCharacterLimit: number
  private readonly authorContextEvidenceLimit: number
  private readonly storyRecentSummaryLimit: number
  private readonly voiceDialogueFragmentLimit: number
  private readonly styleReferenceChapterLimit: number
  private readonly styleSampleExcerptChars: number
  private readonly antiCopyMaxDraftChars: number
  private readonly antiCopyMaxFindings: number
  private readonly styleDeviationRatio: number
  private readonly styleRevisionRequiredRatio: number
  private readonly authorContextBranchRecordLimit: number
  private readonly authorContextSourceExcerptLimit: number
  private readonly authorContextMaxJsonChars: number
  private readonly proseQualityUltraShortHanChars: number
  private readonly proseQualityMaxUltraShortRun: number
  private readonly proseQualityTailUltraShortRatio: number
  private readonly proseQualityMinBigramDiversity: number
  private readonly proseQualityTailFillerLimit: number
  private loadPromise: Promise<LoadedCanonPack> | undefined
  private enrichmentTail: Promise<void> = Promise.resolve()
  private copyCorpusPromise: Promise<CopyCorpus> | undefined
  private readonly branchLocks = new Map<string, Promise<void>>()

  constructor(config: ProviderConfig) {
    this.id = config.providerId.trim()
    this.canonPackDir = resolve(config.canonPackDir)
    this.stateDir = resolve(config.stateDir)
    this.branchesDir = join(this.stateDir, 'branches')
    this.enrichmentGraphDir = join(this.stateDir, 'enrichment', 'graph')
    this.enrichmentCoveragePath = join(this.stateDir, 'enrichment', 'coverage.ndjson')
    this.auditReceiptsDir = join(this.stateDir, 'audit-receipts')
    this.draftsDir = join(this.stateDir, 'drafts')
    this.maxSearchResults = positiveSafeInteger(config.maxSearchResults, 'maxSearchResults')
    this.maxExcerptChars = positiveSafeInteger(config.maxExcerptChars, 'maxExcerptChars')
    this.maxStructuredRecords = positiveSafeInteger(config.maxStructuredRecords, 'maxStructuredRecords')
    this.authorContextMaxEntities = positiveSafeInteger(config.authorContextMaxEntities, 'authorContextMaxEntities')
    this.authorContextSearchLimit = positiveSafeInteger(config.authorContextSearchLimit, 'authorContextSearchLimit')
    this.authorContextCharacterLimit = positiveSafeInteger(config.authorContextCharacterLimit, 'authorContextCharacterLimit')
    this.authorContextEvidenceLimit = positiveSafeInteger(config.authorContextEvidenceLimit, 'authorContextEvidenceLimit')
    this.storyRecentSummaryLimit = positiveSafeInteger(config.storyRecentSummaryLimit, 'storyRecentSummaryLimit')
    this.voiceDialogueFragmentLimit = positiveSafeInteger(config.voiceDialogueFragmentLimit, 'voiceDialogueFragmentLimit')
    this.styleReferenceChapterLimit = positiveSafeInteger(config.styleReferenceChapterLimit, 'styleReferenceChapterLimit')
    this.styleSampleExcerptChars = positiveSafeInteger(config.styleSampleExcerptChars, 'styleSampleExcerptChars')
    this.antiCopyMaxDraftChars = positiveSafeInteger(config.antiCopyMaxDraftChars, 'antiCopyMaxDraftChars')
    this.antiCopyMaxFindings = positiveSafeInteger(config.antiCopyMaxFindings, 'antiCopyMaxFindings')
    this.styleDeviationRatio = finiteNumber(config.styleDeviationRatio, 'styleDeviationRatio')
    this.styleRevisionRequiredRatio = finiteNumber(config.styleRevisionRequiredRatio, 'styleRevisionRequiredRatio')
    this.authorContextBranchRecordLimit = positiveSafeInteger(config.authorContextBranchRecordLimit, 'authorContextBranchRecordLimit')
    this.authorContextSourceExcerptLimit = positiveSafeInteger(config.authorContextSourceExcerptLimit, 'authorContextSourceExcerptLimit')
    this.authorContextMaxJsonChars = positiveSafeInteger(config.authorContextMaxJsonChars, 'authorContextMaxJsonChars')
    this.proseQualityUltraShortHanChars = positiveSafeInteger(config.proseQualityUltraShortHanChars, 'proseQualityUltraShortHanChars')
    this.proseQualityMaxUltraShortRun = positiveSafeInteger(config.proseQualityMaxUltraShortRun, 'proseQualityMaxUltraShortRun')
    this.proseQualityTailUltraShortRatio = finiteNumber(config.proseQualityTailUltraShortRatio, 'proseQualityTailUltraShortRatio')
    this.proseQualityMinBigramDiversity = finiteNumber(config.proseQualityMinBigramDiversity, 'proseQualityMinBigramDiversity')
    this.proseQualityTailFillerLimit = positiveSafeInteger(config.proseQualityTailFillerLimit, 'proseQualityTailFillerLimit')
    if (this.styleDeviationRatio <= 0) throw new Error('styleDeviationRatio must be greater than zero')
    if (this.styleRevisionRequiredRatio <= this.styleDeviationRatio) throw new Error('styleRevisionRequiredRatio must be greater than styleDeviationRatio')
    if (!(this.proseQualityTailUltraShortRatio > 0 && this.proseQualityTailUltraShortRatio <= 1)) throw new Error('proseQualityTailUltraShortRatio must be in (0, 1]')
    if (!(this.proseQualityMinBigramDiversity > 0 && this.proseQualityMinBigramDiversity <= 1)) throw new Error('proseQualityMinBigramDiversity must be in (0, 1]')
    if (!existsSync(join(this.canonPackDir, 'manifest.json'))
      || !existsSync(join(this.canonPackDir, 'source.json'))
      || !existsSync(join(this.canonPackDir, 'chapters.ndjson'))) {
      throw new Error(`fanfic canon pack is incomplete: ${this.canonPackDir}`)
    }
  }

  available(): boolean {
    return existsSync(join(this.canonPackDir, 'manifest.json'))
      && existsSync(join(this.canonPackDir, 'source.json'))
      && existsSync(join(this.canonPackDir, 'chapters.ndjson'))
  }

  async status(signal?: AbortSignal): Promise<FanficStatus> {
    const pack = await this.load(signal)
    return {
      providerId: this.id,
      canonPackId: pack.manifest.canonPackId,
      title: pack.source.title,
      creator: pack.source.creator,
      sourceSha256: pack.source.sha256,
      chapterCount: pack.chapters.length,
      graphCounts: {
        facts: pack.facts.length,
        knowledge: pack.knowledge.length,
        characters: pack.characters.length,
        identities: pack.identities.length,
        powers: pack.powers.length,
        relationships: pack.relationships.length,
        mysteries: pack.mysteries.length,
        events: pack.events.length,
        timelineRules: pack.timelineRules.length,
        causalLinks: pack.causalLinks.length,
      },
      enrichmentCounts: pack.enrichmentCounts,
      styleBank: { chapterMetrics: pack.styleBank.chapterMetrics.length, modes: pack.styleBank.modes },
      stateDir: this.stateDir,
    }
  }

  async search(request: CanonSearchRequest, signal?: AbortSignal): Promise<readonly CanonSearchHit[]> {
    const pack = await this.load(signal)
    signal?.throwIfAborted()
    const query = nonEmpty(request.query, 'query')
    const cutoff = cutoffChapter(request.asOfChapter, pack.chapters.length)
    const limit = Math.min(positiveSafeInteger(request.limit, 'limit'), this.maxSearchResults)
    const terms = searchTerms(query)
    return pack.chapters
      .filter(chapter => chapter.index <= cutoff)
      .map(chapter => ({ chapter, score: scoreChapter(chapter, terms) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || b.chapter.index - a.chapter.index)
      .slice(0, limit)
      .map(({ chapter, score }) => ({
        chapter: chapter.index,
        title: chapter.title,
        score,
        excerpt: makeExcerpt(chapter.text, terms, this.maxExcerptChars),
        provenance: provenance(pack.source.sha256, chapter),
      }))
  }

  async readChapter(request: CanonChapterReadRequest, signal?: AbortSignal): Promise<CanonChapter> {
    const pack = await this.load(signal)
    signal?.throwIfAborted()
    const cutoff = cutoffChapter(request.asOfChapter, pack.chapters.length)
    const chapter = positiveSafeInteger(request.chapter, 'chapter')
    if (chapter > cutoff) {
      throw new Error(`chapter ${chapter} exceeds spoiler cutoff ${cutoff}`)
    }
    const found = pack.chapters[chapter - 1]
    if (found === undefined || found.index !== chapter) throw new Error(`canon chapter ${chapter} does not exist`)
    return found
  }

  async snapshot(request: CanonSnapshotRequest, signal?: AbortSignal): Promise<CanonSnapshot> {
    const pack = await this.load(signal)
    return this.snapshotFromPack(pack, request, signal)
  }

  async authorContext(request: AuthorContextRequest, signal?: AbortSignal): Promise<AuthorContext> {
    const pack = await this.load(signal)
    signal?.throwIfAborted()
    const requestedCutoff = cutoffChapter(request.asOfChapter, pack.chapters.length)
    const pov = nonEmpty(request.povCharacter, 'povCharacter')
    const participants = uniqueStrings(request.participants)
    const storedBranch = request.branchId === undefined ? undefined : await this.getBranch(request.branchId, signal)
    const branch = storedBranch === undefined ? undefined : branchView(storedBranch, request.fanficChapter, true)
    const earliestDivergence = storedBranch === undefined ? undefined : earliestDivergencePoint(storedBranch)
    const stableThrough = earliestDivergence === undefined || earliestDivergence.atChapter > requestedCutoff
      ? requestedCutoff
      : Math.max(1, Math.min(requestedCutoff, earliestDivergence.atChapter - 1))
    const contextExpansion = expandContextFromPack(pack, {
      asOfChapter: stableThrough,
      seeds: uniqueStrings([pov, ...participants]),
      query: request.query || request.sceneGoal,
      maxEntities: Math.min(this.authorContextMaxEntities, this.maxStructuredRecords),
    })
    const contextEntities = uniqueStrings([...participants, ...contextExpansion.discovered.map(item => item.entity)])
    const canonTruth = await this.snapshotFromPack(pack, {
      asOfChapter: stableThrough,
      povCharacter: pov,
      entities: contextEntities,
      query: request.query || `${pov} ${contextEntities.join(' ')} ${request.sceneGoal}`,
      searchLimit: Math.min(this.authorContextSearchLimit, this.maxSearchResults),
    }, signal)
    const canonSameChapterTruth = earliestDivergence !== undefined
      && earliestDivergence.atChapter <= requestedCutoff
      && preciseDivergenceBoundary(earliestDivergence) !== undefined
      ? await this.sameChapterTruthBeforeDivergence(pack, earliestDivergence, {
        povCharacter: pov, entities: contextEntities,
      }, signal)
      : undefined
    const canonReference = stableThrough === requestedCutoff ? undefined : await this.snapshotFromPack(pack, {
      asOfChapter: requestedCutoff,
      povCharacter: pov,
      entities: contextEntities,
      query: request.query || `${pov} ${contextEntities.join(' ')} ${request.sceneGoal}`,
      searchLimit: Math.min(this.authorContextSearchLimit, this.maxSearchResults),
    }, signal)
    const dossierNames = uniqueStrings([pov, ...participants, ...contextExpansion.discovered.map(item => item.entity)]).slice(0, Math.min(this.authorContextCharacterLimit, this.maxStructuredRecords))
    const characterIntelligence: CharacterIntelligence[] = []
    for (const character of dossierNames) {
      characterIntelligence.push(await this.characterIntelligence({
        character, asOfChapter: stableThrough, povCharacter: pov,
        ...(request.branchId === undefined ? {} : { branchId: request.branchId }),
        ...(request.fanficChapter === undefined ? {} : { fanficChapter: request.fanficChapter }),
        evidenceLimit: Math.min(this.authorContextEvidenceLimit, this.maxSearchResults),
      }, signal))
    }
    const narrativeStyle = await this.narrativeStyleContext({
      asOfChapter: requestedCutoff,
      mode: request.styleMode,
      query: request.query || request.sceneGoal,
      povCharacter: pov,
      participants: contextEntities,
      ...(request.branchId === undefined ? {} : { branchId: request.branchId }),
      ...(request.fanficChapter === undefined ? {} : { fanficChapter: request.fanficChapter }),
      sampleLimit: request.styleSampleLimit,
    }, signal)
    const storyDirector = request.branchId === undefined || request.fanficChapter === undefined
      ? undefined
      : await this.storyDirectorContext({ branchId: request.branchId, fanficChapter: request.fanficChapter, horizonSize: request.storyHorizonSize }, signal)
    const authorPacket: AuthorContext = {
      version: 4,
      scene: {
        canonPoint: { chapter: requestedCutoff },
        ...request.fanficChapter === undefined ? {} : { fanficChapter: positiveSafeInteger(request.fanficChapter, 'fanficChapter') },
        pov,
        participants,
        goal: nonEmpty(request.sceneGoal, 'sceneGoal'),
      },
      canonTruth,
      ...canonSameChapterTruth === undefined ? {} : { canonSameChapterTruth },
      ...canonReference === undefined ? {} : { canonReference },
      contextExpansion,
      characterIntelligence,
      narrativeStyle,
      ...storyDirector === undefined ? {} : { storyDirector },
      ...branch === undefined ? {} : { branch: compactBranchForAuthor(branch, uniqueStrings([pov, ...contextEntities]), this.authorContextBranchRecordLimit, this.storyRecentSummaryLimit) },
      divergencePolicy: {
        diverged: earliestDivergence !== undefined && earliestDivergence.atChapter <= requestedCutoff,
        canonStableThroughChapter: stableThrough,
        ...earliestDivergence?.eventOrdinal === undefined ? {} : { sameChapterTruthThroughEventOrdinal: earliestDivergence.eventOrdinal },
        laterCanonIsCounterfactualReference: earliestDivergence !== undefined && earliestDivergence.atChapter <= requestedCutoff,
      },
      hardConstraints: [
        `Do not use canon information from narrative chapters after ${requestedCutoff}.`,
        ...(branch === undefined ? [] : [`Accepted prose must satisfy the branch writing contract: ${branch.authorIntent.writingContract.minHanChars}–${branch.authorIntent.writingContract.maxHanChars} Han characters in ${branch.authorIntent.writingContract.language}.`]),
        'Do not upgrade suspicion, hearsay, or reader knowledge into POV knowledge without evidence.',
        'Preserve character motivation and ideology even when that changes the expected canon plot.',
        'Use narrativeStyle as high-level work guidance; do not reproduce distinctive source phrasing or treat source samples as prose templates.',
        ...(earliestDivergence === undefined ? [] : [
          `Canon after chapter ${stableThrough} is counterfactual reference only because this branch diverged.`,
          'Recompute consequences from branch state instead of forcing later canon events to happen.',
        ]),
      ],
      workflow: [
        'Plan from canonTruth plus the bounded active branch working set and inspect contextExpansion for relevant entities the initial prompt omitted.',
        'Use canonReference only to understand what would have happened without divergence.',
        'Stage the complete prose once with fanfic_draft_stage; use its draftId for all audits and fanfic_apply_delta.',
        'Audit important knowledge, identity, canon-fact, power, and mystery-reveal claims before finalizing prose.',
        'Run fanfic_style_audit and anti_copy_guard on the staged draft; prose-quality or writing-contract failure cannot produce a commit receipt.',
        'After all three receipts pass for the same staged draft, persist accepted world state with fanfic_apply_delta.',
      ],
      telemetry: { serializedChars: 0, budgetChars: this.authorContextMaxJsonChars, compactionLevel: 0, omitted: { sourceExcerpts: 0, characterEvidence: 0, olderBranchRecords: 0, storyDirectorRecords: 0 } },
    }
    return compactAuthorContextToBudget(authorPacket, this.authorContextSourceExcerptLimit, this.authorContextMaxJsonChars)
  }

  async traceCausality(request: CanonCausalityTraceRequest, signal?: AbortSignal): Promise<CanonCausalityTrace> {
    const pack = await this.load(signal)
    const cutoff = cutoffChapter(request.asOfChapter, pack.chapters.length)
    const query = nonEmpty(request.query, 'query')
    const terms = searchTerms(query)
    const limit = Math.min(positiveSafeInteger(request.limit, 'limit'), this.maxStructuredRecords)
    const links = pack.causalLinks
      .filter(link => link.introducedByChapter <= cutoff)
      .map(link => ({ link, score: scoreText(`${link.cause} ${link.effect} ${link.mechanism ?? ''}`, terms) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || b.link.introducedByChapter - a.link.introducedByChapter)
      .slice(0, limit)
      .map(item => item.link)
    return { asOfChapter: cutoff, query, links }
  }

  async timelineContext(request: CanonTimelineContextRequest, signal?: AbortSignal): Promise<CanonTimelineContext> {
    const pack = await this.load(signal)
    signal?.throwIfAborted()
    const cutoff = cutoffChapter(request.asOfChapter, pack.chapters.length)
    const limit = Math.min(positiveSafeInteger(request.limit, 'limit'), this.maxStructuredRecords)
    const worldline = request.worldline?.trim() ?? ''
    const query = request.query?.trim() ?? ''
    const entities = uniqueStrings(request.entities ?? [])
    const terms = query.length === 0 ? [] : searchTerms(query)
    const rules = pack.timelineRules
      .filter(rule => rule.validFromChapter <= cutoff && (rule.validUntilChapter === undefined || cutoff <= rule.validUntilChapter))
      .filter(rule => worldline.length === 0 || rule.worldline === undefined || rule.worldline.includes(worldline) || worldline.includes(rule.worldline))
      .map(rule => ({ rule, score: terms.length === 0 ? 1 : scoreText(`${rule.worldline ?? ''} ${rule.rule} ${(rule.effects ?? []).join(' ')}`, terms) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || b.rule.validFromChapter - a.rule.validFromChapter)
      .slice(0, limit)
      .map(item => item.rule)
    const eventTerms = searchTerms(`${query} ${entities.join(' ')}`.trim() || 'timeline')
    const events = pack.events
      .filter(event => event.chapter <= cutoff)
      .map(event => ({ event, score: entities.some(entity => (event.participants ?? []).some(participant => sameName(participant, entity)))
        ? 20 + scoreText(event.summary, eventTerms)
        : scoreText(`${event.summary} ${(event.dependencies ?? []).join(' ')} ${(event.consequences ?? []).join(' ')}`, eventTerms) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || b.event.chapter - a.event.chapter)
      .slice(0, limit)
      .map(item => item.event)
    const identities = pack.identities
      .filter(edge => edge.validFromChapter <= cutoff && (edge.validUntilChapter === undefined || cutoff <= edge.validUntilChapter))
      .filter(edge => edge.revealFromChapter === undefined || edge.revealFromChapter <= cutoff)
      .filter(edge => entities.length === 0 || entities.some(entity => sameName(entity, edge.subject) || sameName(entity, edge.object)))
      .slice(0, limit)
    const sourceQuery = `${worldline} ${query} ${entities.join(' ')}`.trim()
    const sourceEvidence = sourceQuery.length === 0 ? [] : await this.search({ query: sourceQuery, asOfChapter: cutoff, limit: Math.min(limit, this.maxSearchResults) }, signal)
    return {
      asOfChapter: cutoff,
      ...(worldline.length === 0 ? {} : { worldline }),
      rules, events, identities, sourceEvidence,
      cautions: [
        'Narrative chapter order is not identical to in-world chronology or worldline identity.',
        'History rewrites can alter both events and what lower-realm characters remember; use epistemic state separately.',
        'Missing structured timeline rows mean inspect source evidence rather than assuming one universal world rule.',
      ],
    }
  }

  async expandContext(request: CanonContextExpansionRequest, signal?: AbortSignal): Promise<CanonContextExpansion> {
    const pack = await this.load(signal)
    signal?.throwIfAborted()
    return expandContextFromPack(pack, {
      asOfChapter: cutoffChapter(request.asOfChapter, pack.chapters.length),
      seeds: uniqueStrings(request.seeds),
      query: request.query?.trim() ?? '',
      maxEntities: Math.min(positiveSafeInteger(request.maxEntities, 'maxEntities'), this.maxStructuredRecords),
    })
  }

  async characterIntelligence(request: CharacterIntelligenceRequest, signal?: AbortSignal): Promise<CharacterIntelligence> {
    const pack = await this.load(signal)
    signal?.throwIfAborted()
    const character = nonEmpty(request.character, 'character')
    const cutoff = cutoffChapter(request.asOfChapter, pack.chapters.length)
    const evidenceLimit = Math.min(positiveSafeInteger(request.evidenceLimit, 'evidenceLimit'), this.maxSearchResults)
    const temporal = <T extends { readonly validFromChapter: number; readonly validUntilChapter?: number }>(records: readonly T[]): T[] =>
      records.filter(record => record.validFromChapter <= cutoff && (record.validUntilChapter === undefined || cutoff <= record.validUntilChapter))
    const facts = temporal(pack.facts.filter(fact => sameName(fact.subject, character) || (fact.aliases ?? []).some(alias => sameName(alias, character))))
      .filter(fact => fact.revealFromChapter === undefined || fact.revealFromChapter <= cutoff)
      .slice(0, this.maxStructuredRecords)
    const visibleFactIds = new Set(pack.facts
      .filter(fact => fact.validFromChapter <= cutoff && (fact.validUntilChapter === undefined || cutoff <= fact.validUntilChapter))
      .filter(fact => fact.revealFromChapter === undefined || fact.revealFromChapter <= cutoff)
      .map(fact => fact.id))
    const knowledge = pack.knowledge
      .filter(record => sameName(record.character, character))
      .filter(record => visibleFactIds.has(record.factId))
      .filter(record => record.knownFromChapter <= cutoff && (record.knownUntilChapter === undefined || cutoff <= record.knownUntilChapter))
      .slice(0, this.maxStructuredRecords)
    const states = temporal(pack.characters.filter(state => sameName(state.name, character) || (state.aliases ?? []).some(alias => sameName(alias, character))))
      .slice(0, this.maxStructuredRecords)
    const identities = temporal(pack.identities.filter(edge => sameName(edge.subject, character) || sameName(edge.object, character)))
      .filter(edge => edge.revealFromChapter === undefined || edge.revealFromChapter <= cutoff)
      .slice(0, this.maxStructuredRecords)
    const powers = temporal(pack.powers.filter(power => sameName(power.subject, character)))
      .slice(0, this.maxStructuredRecords)
    const relationships = temporal(pack.relationships.filter(relation => sameName(relation.subject, character) || sameName(relation.object, character)))
      .slice(0, this.maxStructuredRecords)
    const storedBranch = request.branchId === undefined ? undefined : await this.getBranch(request.branchId, signal)
    const branch = storedBranch === undefined ? undefined : branchView(storedBranch, request.fanficChapter, true)
    const branchState = branch === undefined ? undefined : {
      characterStates: branch.characterStates.filter(state => sameName(state.character, character)),
      relationships: branch.relationships.filter(relation => sameName(relation.subject, character) || sameName(relation.object, character)),
      knowledge: branch.knowledge.filter(record => sameName(record.character, character)),
    }
    const sourceEvidence = await this.search({ query: character, asOfChapter: cutoff, limit: evidenceLimit }, signal)
    const gaps: string[] = []
    if (states.length === 0) gaps.push('No structured temporal character state is available at this cutoff.')
    if (powers.length === 0) gaps.push('No character-specific structured power state is available at this cutoff.')
    if (relationships.length === 0) gaps.push('No structured relationship state is available at this cutoff.')
    if (knowledge.length === 0) gaps.push('No structured epistemic records are available for this character at this cutoff.')
    return {
      character, asOfChapter: cutoff, states, identities, powers, relationships, knowledge, facts,
      ...(branchState === undefined ? {} : { branchState }), sourceEvidence, gaps,
    }
  }

  async characterVoiceContext(request: CharacterVoiceContextRequest, signal?: AbortSignal): Promise<CharacterVoiceContext> {
    const pack = await this.load(signal)
    signal?.throwIfAborted()
    const character = nonEmpty(request.character, 'character')
    const cutoff = cutoffChapter(request.asOfChapter, pack.chapters.length)
    const limit = Math.min(positiveSafeInteger(request.limit, 'limit'), this.maxSearchResults)
    const structuredVoiceNotes = uniqueStrings(pack.characters
      .filter(state => state.validFromChapter <= cutoff && (state.validUntilChapter === undefined || cutoff <= state.validUntilChapter))
      .filter(state => sameName(state.name, character) || (state.aliases ?? []).some(alias => sameName(alias, character)))
      .flatMap(state => state.voiceNotes ?? []))
    const hits = await this.search({ query: character, asOfChapter: cutoff, limit: Math.min(this.maxSearchResults, Math.max(limit * 2, limit)) }, signal)
    const samples: CharacterVoiceSample[] = []
    for (const hit of hits) {
      const chapter = pack.chapters[hit.chapter - 1]
      if (chapter === undefined) continue
      const sample = extractCharacterVoiceSample(pack.source.sha256, chapter, character, this.maxExcerptChars, this.voiceDialogueFragmentLimit)
      if (sample !== undefined) samples.push(sample)
      if (samples.length >= limit) break
    }
    return {
      character, asOfChapter: cutoff, structuredVoiceNotes, samples,
      cautions: [
        'Dialogue fragments are extracted from a source window around the character name; contextual proximity does not prove the character spoke every fragment.',
        'Use structured voiceNotes when available and verify ambiguous speaker attribution by reading the chapter before treating a fragment as a voice rule.',
        'Voice evidence constrains diction and interaction tendencies; do not copy long source passages into generated prose.',
      ],
    }
  }

  async narrativeStyleContext(request: NarrativeStyleContextRequest, signal?: AbortSignal): Promise<NarrativeStyleContext> {
    const pack = await this.load(signal)
    signal?.throwIfAborted()
    const cutoff = cutoffChapter(request.asOfChapter, pack.chapters.length)
    const sampleLimit = Math.min(positiveSafeInteger(request.sampleLimit, 'sampleLimit'), this.maxSearchResults)
    const requestedMode = normalizeNarrativeStyleMode(request.mode)
    const query = request.query.trim()
    const resolvedMode = resolveNarrativeStyleMode(pack, cutoff, requestedMode, query)
    const queryTerms = searchTerms(`${query} ${request.povCharacter ?? ''} ${request.participants.join(' ')}`.trim())
    const queryScores = new Map<number, number>()
    if (queryTerms.length > 0) {
      for (const chapter of pack.chapters) {
        if (chapter.index > cutoff) break
        const score = scoreChapter(chapter, queryTerms)
        if (score > 0) queryScores.set(chapter.index, score)
      }
    }
    const candidates = pack.styleBank.chapterMetrics
      .filter(row => row.chapter <= cutoff)
      .map(row => ({ row, score: (row.modeScores[resolvedMode] ?? 0) * 10 + (queryScores.get(row.chapter) ?? 0) }))
      .sort((a, b) => b.score - a.score || b.row.chapter - a.row.chapter)
      .slice(0, Math.min(this.styleReferenceChapterLimit, cutoff))
    const referenceRows = candidates.length > 0 ? candidates.map(item => item.row) : pack.styleBank.chapterMetrics.filter(row => row.chapter <= cutoff).slice(-this.styleReferenceChapterLimit)
    const globalRows = pack.styleBank.chapterMetrics.filter(row => row.chapter <= cutoff)
    const referenceMetrics = aggregateNarrativeStyleMetrics(referenceRows.map(row => row.metrics))
    const globalMetrics = aggregateNarrativeStyleMetrics(globalRows.map(row => row.metrics))
    const samples: NarrativeStyleSample[] = []
    const styleTerms = searchTerms(`${query} ${styleKeywords(resolvedMode).join(' ')}`.trim())
    for (const item of candidates.slice(0, sampleLimit)) {
      const chapter = pack.chapters[item.row.chapter - 1]
      if (chapter === undefined) continue
      samples.push({
        chapter: chapter.index,
        title: chapter.title,
        modeScore: item.row.modeScores[resolvedMode] ?? 0,
        metrics: item.row.metrics,
        excerpt: makeExcerpt(chapter.text, styleTerms, Math.min(this.styleSampleExcerptChars, this.maxExcerptChars)),
        provenance: provenance(pack.source.sha256, chapter),
      })
    }
    const storedBranch = request.branchId === undefined ? undefined : await this.getBranch(request.branchId, signal)
    const branch = storedBranch === undefined ? undefined : branchView(storedBranch, request.fanficChapter, true)
    return {
      asOfChapter: cutoff,
      requestedMode,
      resolvedMode,
      referenceMetrics,
      globalMetrics,
      projectStyleNotes: branch?.authorIntent.styleNotes ?? [],
      guidance: narrativeStyleGuidance(resolvedMode, referenceMetrics, globalMetrics),
      samples,
      cautions: [
        'This context describes high-level work conventions such as pacing, dialogue balance, paragraph rhythm, and scene-mode tendencies; it is not an instruction to imitate a living author exactly.',
        'Source excerpts are bounded evidence, not templates. Re-express ideas in original wording and run anti_copy_guard on finished prose.',
        `All returned style samples are restricted to canon chapters at or before ${cutoff}.`,
        'Heuristic scene-mode scores support retrieval only; they do not assert the original author intended one exclusive genre label for a chapter.',
      ],
    }
  }

  async antiCopyGuard(request: AntiCopyGuardRequest, signal?: AbortSignal): Promise<AntiCopyGuardResult> {
    const pack = await this.load(signal)
    signal?.throwIfAborted()
    const resolvedDraft = await this.resolveDraftInput(request, signal)
    const stagedDraft = resolvedDraft.stagedDraft
    const fanficChapter = stagedDraft?.fanficChapter ?? request.fanficChapter
    const branch = await this.auditBranchForDraft(stagedDraft, request.branchId, fanficChapter, signal)
    const cutoff = cutoffChapter(request.asOfChapter, pack.chapters.length)
    const minPhraseChars = positiveSafeInteger(request.minPhraseChars, 'minPhraseChars')
    if (minPhraseChars < MIN_ANTI_COPY_PHRASE_CHARS) throw new Error(`minPhraseChars must be at least ${MIN_ANTI_COPY_PHRASE_CHARS}`)
    const maxFindings = Math.min(positiveSafeInteger(request.maxFindings, 'maxFindings'), this.antiCopyMaxFindings)
    const draft = normalizeCopyText(resolvedDraft.text)
    if (draft.length > this.antiCopyMaxDraftChars) throw new Error(`draft exceeds anti-copy limit of ${this.antiCopyMaxDraftChars} normalized characters`)
    const corpus = await this.copyCorpus(pack)
    signal?.throwIfAborted()
    const findings = findAntiCopyOverlaps(draft, corpus, cutoff, minPhraseChars, maxFindings)
    const ok = findings.length === 0
    const auditReceipt = branch === undefined || fanficChapter === undefined || stagedDraft === undefined || !ok
      ? undefined
      : await this.issueAuditReceipt('anti-copy', stagedDraft, branch, fanficChapter, [], signal)
    return {
      ok,
      ...(auditReceipt === undefined ? {} : { auditReceipt }),
      checkedDraftChars: draft.length,
      minPhraseChars,
      findings,
      cautions: [
        'This guard detects exact normalized phrase overlap; it does not detect close paraphrase or semantic imitation.',
        'Matches against source chapters after the spoiler cutoff are reported without revealing their chapter locations.',
        'Commit receipts are issued only for staged drafts so the model never has to recopy accepted prose between audit tools.',
      ],
    }
  }

  async auditNarrativeStyle(request: NarrativeStyleAuditRequest, signal?: AbortSignal): Promise<NarrativeStyleAuditResult> {
    signal?.throwIfAborted()
    const resolvedDraft = await this.resolveDraftInput(request, signal)
    const stagedDraft = resolvedDraft.stagedDraft
    const fanficChapter = stagedDraft?.fanficChapter ?? request.fanficChapter
    const branch = await this.auditBranchForDraft(stagedDraft, request.branchId, fanficChapter, signal)
    const context = await this.narrativeStyleContext({
      ...request,
      ...(branch === undefined ? {} : { branchId: branch.id }),
      ...(fanficChapter === undefined ? {} : { fanficChapter }),
    }, signal)
    const draftMetrics = measureNarrativeStyle(resolvedDraft.text)
    const deviations = narrativeStyleDeviations(draftMetrics, context.referenceMetrics, this.styleDeviationRatio)
      .map(item => styleDeviationWithSeverity(item, this.styleRevisionRequiredRatio))
    const quality = assessProseQuality(resolvedDraft.text, {
      ultraShortHanChars: this.proseQualityUltraShortHanChars,
      maxUltraShortRun: this.proseQualityMaxUltraShortRun,
      tailUltraShortRatio: this.proseQualityTailUltraShortRatio,
      minBigramDiversity: this.proseQualityMinBigramDiversity,
      tailFillerLimit: this.proseQualityTailFillerLimit,
    })
    const antiCopy = await this.antiCopyGuard({
      ...(stagedDraft === undefined ? { draft: resolvedDraft.text } : { draftId: stagedDraft.id }),
      asOfChapter: request.asOfChapter,
      minPhraseChars: request.antiCopyMinPhraseChars,
      maxFindings: request.antiCopyMaxFindings,
    }, signal)
    const durableContract = branch?.authorIntent.writingContract
    const minHan = durableContract?.minHanChars ?? (request.targetMinHanChars === undefined ? undefined : positiveSafeInteger(request.targetMinHanChars, 'targetMinHanChars'))
    const maxHan = durableContract?.maxHanChars ?? (request.targetMaxHanChars === undefined ? undefined : positiveSafeInteger(request.targetMaxHanChars, 'targetMaxHanChars'))
    if (minHan !== undefined && maxHan !== undefined && maxHan < minHan) throw new Error('targetMaxHanChars must be >= targetMinHanChars')
    const withinTarget = (minHan === undefined || draftMetrics.hanCharCount >= minHan) && (maxHan === undefined || draftMetrics.hanCharCount <= maxHan)
    const ok = antiCopy.ok && quality.ok && withinTarget && !deviations.some(item => item.severity === 'revision-required')
    const auditReceipt = branch === undefined || fanficChapter === undefined || stagedDraft === undefined || !ok
      ? undefined
      : await this.issueAuditReceipt('style', stagedDraft, branch, fanficChapter, [], signal)
    return {
      ok,
      ...(auditReceipt === undefined ? {} : { auditReceipt }),
      mode: context.resolvedMode,
      draftMetrics,
      referenceMetrics: context.referenceMetrics,
      deviations,
      quality,
      antiCopy,
      lengthContract: { actualHanChars: draftMetrics.hanCharCount, ...(minHan === undefined ? {} : { minHanChars: minHan }), ...(maxHan === undefined ? {} : { maxHanChars: maxHan }), withinTarget },
      revisionGuidance: [
        ...context.guidance,
        ...deviations.map(styleDeviationGuidance),
        ...quality.findings.map(item => item.message),
        ...(withinTarget ? [] : [`Adjust chapter length to the branch writing contract; current Han-character count is ${draftMetrics.hanCharCount}.`]),
        ...(antiCopy.ok ? [] : ['Rewrite exact source-overlap regions in fresh wording while preserving only the underlying story information.']),
      ],
      limitations: [
        'Style similarity and prose-quality checks are separate: a draft may match reference rhythm yet still fail repetition/degeneration checks.',
        'The audit intentionally targets high-level conventions rather than exact imitation of a living author.',
        'Character voice still requires character_voice_context and canon/epistemic correctness still requires fanfic_audit.',
      ],
    }
  }

  async assessPower(request: PowerAssessmentRequest, signal?: AbortSignal): Promise<PowerAssessment> {
    const pack = await this.load(signal)
    signal?.throwIfAborted()
    const cutoff = cutoffChapter(request.asOfChapter, pack.chapters.length)
    const actors = uniqueStrings(request.actors)
    if (actors.length === 0) throw new Error('actors must contain at least one character')
    const evidenceLimit = Math.min(positiveSafeInteger(request.evidenceLimit, 'evidenceLimit'), this.maxSearchResults)
    const assessments = []
    for (const actor of actors) {
      const dossier = await this.characterIntelligence({
        character: actor, asOfChapter: cutoff,
        ...(request.branchId === undefined ? {} : { branchId: request.branchId }),
        ...(request.fanficChapter === undefined ? {} : { fanficChapter: request.fanficChapter }),
        evidenceLimit,
      }, signal)
      assessments.push({ actor, states: dossier.states, powers: dossier.powers, sourceEvidence: dossier.sourceEvidence })
    }
    const systemRules = pack.powers
      .filter(power => power.subject === '修炼体系')
      .filter(power => power.validFromChapter <= cutoff && (power.validUntilChapter === undefined || cutoff <= power.validUntilChapter))
      .slice(0, this.maxStructuredRecords)
    const timelineRules = pack.timelineRules
      .filter(rule => rule.validFromChapter <= cutoff && (rule.validUntilChapter === undefined || cutoff <= rule.validUntilChapter))
      .slice(0, this.maxStructuredRecords)
    const hasActorConstraints = assessments.some(actor => actor.powers.length > 0 || actor.states.some(state => state.realm !== undefined || (state.techniques?.length ?? 0) > 0 || (state.possessions?.length ?? 0) > 0))
    return {
      asOfChapter: cutoff, scenario: request.scenario?.trim() ?? '', actors: assessments, systemRules, timelineRules,
      verdict: hasActorConstraints ? 'constraints-found' : 'insufficient-structured-data',
      cautions: [
        'This assessment constrains capabilities; it does not infer a deterministic fight winner from realm labels.',
        'Missing structured power data means inspect source evidence before asserting an ability is absent.',
        'Environment, artifacts, injuries, information advantage, and exceptional interactions can dominate nominal realm comparisons.',
      ],
    }
  }

  async impactScan(request: FanficImpactScanRequest, signal?: AbortSignal): Promise<FanficImpactScan> {
    const pack = await this.load(signal)
    signal?.throwIfAborted()
    const cutoff = cutoffChapter(request.asOfChapter, pack.chapters.length)
    const summary = nonEmpty(request.summary, 'summary')
    const entities = uniqueStrings(request.entities)
    const limit = Math.min(positiveSafeInteger(request.limit, 'limit'), this.maxStructuredRecords)
    const query = `${summary} ${entities.join(' ')}`.trim()
    const terms = searchTerms(query)
    const relatedCanonLinks = (await this.traceCausality({ query, asOfChapter: cutoff, limit }, signal)).links
    const relatedEvents = pack.events
      .filter(event => event.chapter <= cutoff)
      .map(event => ({ event, score: scoreText(`${event.summary} ${(event.participants ?? []).join(' ')} ${(event.dependencies ?? []).join(' ')} ${(event.consequences ?? []).join(' ')}`, terms) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || b.event.chapter - a.event.chapter)
      .slice(0, limit)
      .map(item => item.event)
    const expansion = expandContextFromPack(pack, { asOfChapter: cutoff, seeds: entities, query: summary, maxEntities: limit })
    const storedBranch = request.branchId === undefined ? undefined : await this.getBranch(request.branchId, signal)
    const branch = storedBranch === undefined ? undefined : branchView(storedBranch, request.fanficChapter, true)
    return {
      asOfChapter: cutoff, summary, relatedCanonLinks, relatedEvents, discoveredEntities: expansion.discovered,
      openBranchThreads: (branch?.causalThreads ?? []).filter(thread => thread.status === 'open').slice(-limit),
      limitations: [
        'This is a dependency scan, not an oracle of future events.',
        'Likely and possible consequences still require model reasoning from character goals, knowledge, and the branch state.',
        'Sparse causal graph data should trigger source search/enrichment rather than canon railroading.',
      ],
    }
  }

  async validateEnrichment(candidate: CanonEnrichmentCandidate, signal?: AbortSignal): Promise<CanonEnrichmentValidation> {
    const pack = await this.load(signal)
    signal?.throwIfAborted()
    const normalized = normalizeEnrichmentCandidate(candidate, pack.chapters.length)
    const chapter = pack.chapters[normalized.chapter - 1]
    if (chapter === undefined) return { valid: false, chapter: normalized.chapter, errors: ['Source chapter does not exist.'], warnings: [] }
    const errors: string[] = []
    const warnings: string[] = []
    const evidence = normalizeEvidence(normalized.evidence)
    if (evidence.length < 8) errors.push('Evidence is too short; provide a distinctive source excerpt.')
    if (!normalizeEvidence(chapter.text).includes(evidence)) errors.push('Evidence does not occur in the declared source chapter.')
    try {
      materializeEnrichmentRecord(normalized, provenanceWithExcerpt(pack.source.sha256, chapter, normalized.evidence))
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }
    const temporalStart = candidateTemporalStart(normalized)
    if (temporalStart !== undefined && temporalStart > normalized.chapter) warnings.push('Record begins after its evidence chapter; verify this is intentional.')
    const token = errors.length === 0 ? enrichmentToken(normalized, pack.source.sha256, chapter.sha256) : undefined
    return {
      valid: errors.length === 0, ...(token === undefined ? {} : { token }), chapter: normalized.chapter, chapterTitle: chapter.title,
      chapterSha256: chapter.sha256, normalizedEvidence: evidence, errors, warnings,
    }
  }

  async commitEnrichment(request: CanonEnrichmentCommitRequest, signal?: AbortSignal): Promise<CanonEnrichmentCommitResult> {
    return this.withEnrichmentLock(async () => {
      const validation = await this.validateEnrichment(request.candidate, signal)
      if (!validation.valid || validation.token === undefined) throw new Error(`cannot commit unverified canon enrichment: ${validation.errors.join('; ')}`)
      if (request.token !== validation.token) throw new Error('canon enrichment validation token does not match candidate/source evidence')
      const pack = await this.load(signal)
      const candidate = normalizeEnrichmentCandidate(request.candidate, pack.chapters.length)
      const chapter = pack.chapters[candidate.chapter - 1]!
      const provenanceRecord = provenanceWithExcerpt(pack.source.sha256, chapter, candidate.evidence)
      const materialized = materializeEnrichmentRecord(candidate, provenanceRecord)
      const id = enrichmentRecordId(materialized)
      if (canonRecordIdExists(pack, id)) throw new Error(`canon enrichment id ${JSON.stringify(id)} already exists`)
      if (candidate.kind === 'knowledge') {
        const factId = (materialized as unknown as CanonKnowledge).factId
        if (!pack.facts.some(fact => fact.id === factId)) throw new Error(`knowledge enrichment references unknown fact id ${JSON.stringify(factId)}; commit the fact first`)
      }
      const path = join(this.enrichmentGraphDir, enrichmentFilename(candidate.kind))
      await mkdir(this.enrichmentGraphDir, { recursive: true })
      signal?.throwIfAborted()
      await appendFile(path, `${JSON.stringify(materialized)}\n`, 'utf8')
      this.loadPromise = undefined
      return { accepted: true, kind: candidate.kind, id, provenance: provenanceRecord, overlayPath: path }
    })
  }

  async planEnrichment(request: CanonEnrichmentPlanRequest, signal?: AbortSignal): Promise<CanonEnrichmentPlan> {
    const pack = await this.load(signal)
    signal?.throwIfAborted()
    const fromChapter = sourceChapter(request.fromChapter, pack.chapters.length, 'fromChapter')
    const toChapter = sourceChapter(request.toChapter, pack.chapters.length, 'toChapter')
    if (toChapter < fromChapter) throw new Error('toChapter must be greater than or equal to fromChapter')
    const kinds = normalizeEnrichmentKinds(request.kinds)
    const batchSize = Math.min(positiveSafeInteger(request.batchSize, 'batchSize'), this.maxStructuredRecords)
    const checkpoints = await this.readEnrichmentCoverage(signal)
    const effective = effectiveCoverage(checkpoints)
    const work = []
    let remainingUnits = 0
    for (let chapterNumber = fromChapter; chapterNumber <= toChapter; chapterNumber++) {
      const pendingKinds = kinds.filter(kind => !effective.has(coverageKey(chapterNumber, kind)))
      remainingUnits += pendingKinds.length
      if (pendingKinds.length === 0 || work.length >= batchSize) continue
      const chapter = pack.chapters[chapterNumber - 1]!
      const existingRecordIds: Record<string, readonly string[]> = {}
      for (const kind of pendingKinds) {
        existingRecordIds[kind] = recordsForKind(pack, kind)
          .filter(record => recordProvenanceChapter(record) === chapterNumber)
          .map(record => record.id)
      }
      work.push({ chapter: chapterNumber, title: chapter.title, chapterSha256: chapter.sha256, pendingKinds, existingRecordIds })
    }
    return {
      fromChapter, toChapter, kinds, work, remainingUnits,
      instructions: [
        'For each work item, read that exact chapter under an asOfChapter cutoff equal to the chapter being reviewed.',
        'Propose only source-supported structured records; validate and commit every accepted record before checkpointing its family.',
        'Use noFindings only after reviewing the chapter for that family and finding no record worth admitting.',
        'A checkpoint records review coverage only; it never makes an uncommitted proposition canonical truth.',
      ],
    }
  }

  async enrichmentProgress(request: CanonEnrichmentProgressRequest, signal?: AbortSignal): Promise<CanonEnrichmentProgress> {
    const pack = await this.load(signal)
    signal?.throwIfAborted()
    const fromChapter = sourceChapter(request.fromChapter, pack.chapters.length, 'fromChapter')
    const toChapter = sourceChapter(request.toChapter, pack.chapters.length, 'toChapter')
    if (toChapter < fromChapter) throw new Error('toChapter must be greater than or equal to fromChapter')
    const kinds = normalizeEnrichmentKinds(request.kinds)
    const effective = effectiveCoverage(await this.readEnrichmentCoverage(signal))
    const checkpoints = [...effective.values()]
      .filter(item => item.chapter >= fromChapter && item.chapter <= toChapter && kinds.includes(item.kind))
      .sort((a, b) => a.chapter - b.chapter || a.kind.localeCompare(b.kind))
    const chapterCount = toChapter - fromChapter + 1
    const totalUnits = chapterCount * kinds.length
    const byKind: Record<string, { completed: number; total: number }> = {}
    for (const kind of kinds) {
      byKind[kind] = { completed: checkpoints.filter(item => item.kind === kind).length, total: chapterCount }
    }
    const completedUnits = checkpoints.length
    return {
      fromChapter, toChapter, kinds, totalUnits, completedUnits,
      completionRatio: totalUnits === 0 ? 1 : completedUnits / totalUnits,
      byKind, checkpoints,
    }
  }

  async checkpointEnrichment(request: CanonEnrichmentCheckpointRequest, signal?: AbortSignal): Promise<CanonEnrichmentCoverage> {
    return this.withEnrichmentLock(async () => {
      const pack = await this.load(signal)
      signal?.throwIfAborted()
      const chapterNumber = sourceChapter(request.chapter, pack.chapters.length, 'chapter')
      const kind = normalizeEnrichmentKind(request.kind)
      const recordIds = uniqueStrings(request.recordIds)
      const noFindings = request.noFindings === true
      if (noFindings && recordIds.length > 0) throw new Error('noFindings cannot be true when recordIds are supplied')
      if (!noFindings && recordIds.length === 0) throw new Error('recordIds must contain admitted records unless noFindings is true')
      const records = recordsForKind(pack, kind)
      for (const id of recordIds) {
        const record = records.find(item => item.id === id)
        if (record === undefined) throw new Error(`enrichment checkpoint references unknown ${kind} record ${JSON.stringify(id)}`)
        const sourceChapterNumber = recordProvenanceChapter(record)
        if (sourceChapterNumber !== chapterNumber) {
          throw new Error(`enrichment checkpoint record ${JSON.stringify(id)} is sourced from chapter ${sourceChapterNumber ?? 'unknown'}, not chapter ${chapterNumber}`)
        }
      }
      const chapter = pack.chapters[chapterNumber - 1]!
      const checkpoint: CanonEnrichmentCoverage = {
        chapter: chapterNumber, kind, sourceSha256: pack.source.sha256, chapterSha256: chapter.sha256,
        recordIds, noFindings, notes: request.notes.trim(), updatedAt: new Date().toISOString(),
      }
      await mkdir(join(this.stateDir, 'enrichment'), { recursive: true })
      signal?.throwIfAborted()
      await appendFile(this.enrichmentCoveragePath, `${JSON.stringify(checkpoint)}\n`, 'utf8')
      return checkpoint
    })
  }

  async listBranches(signal?: AbortSignal): Promise<readonly FanficBranch[]> {
    await mkdir(this.branchesDir, { recursive: true })
    signal?.throwIfAborted()
    const names = (await readdir(this.branchesDir, { withFileTypes: true }))
      .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
      .map(entry => entry.name)
      .sort()
    const branches: FanficBranch[] = []
    for (const name of names) {
      signal?.throwIfAborted()
      branches.push(await this.readBranchFile(join(this.branchesDir, name), signal))
    }
    return branches.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async createBranch(request: CreateFanficBranchRequest, signal?: AbortSignal): Promise<FanficBranch> {
    const pack = await this.load(signal)
    await mkdir(this.branchesDir, { recursive: true })
    signal?.throwIfAborted()
    const name = nonEmpty(request.name, 'name')
    const existing = await this.listBranches(signal)
    if (existing.some(branch => branch.name === name)) throw new Error(`fanfic branch name must be unique: ${JSON.stringify(name)}`)
    const now = new Date().toISOString()
    const branch: FanficBranch = {
      version: 3,
      id: FanficBranchId(`fanfic-${randomUUID()}`),
      name,
      baseChapter: cutoffChapter(request.baseChapter, pack.chapters.length),
      revision: 1,
      notes: request.notes.trim(),
      authorIntent: normalizeAuthorIntent(request.authorIntent),
      storyDirector: emptyStoryDirector(),
      createdAt: now,
      updatedAt: now,
      divergences: [],
      chapterVersions: [],
      facts: [],
      knowledge: [],
      characterStates: [],
      relationships: [],
      causalThreads: [],
      chapterSummaries: [],
    }
    await this.writeBranch(branch, signal)
    return branch
  }

  async getBranch(id: FanficBranchIdValue, signal?: AbortSignal): Promise<FanficBranch> {
    validateBranchId(id)
    await mkdir(this.branchesDir, { recursive: true })
    return this.readBranchFile(this.branchPath(id), signal)
  }

  async recordDivergence(request: RecordFanficDivergenceRequest, signal?: AbortSignal): Promise<FanficBranch> {
    return this.withBranchLock(request.branchId, async () => {
      const [branch, pack] = await Promise.all([this.getBranch(request.branchId, signal), this.load(signal)])
      assertRevision(branch, request.expectedRevision)
      const atChapter = cutoffChapter(request.atChapter, pack.chapters.length)
      if (atChapter < branch.baseChapter) {
        throw new Error(`divergence chapter ${atChapter} precedes branch base chapter ${branch.baseChapter}`)
      }
      const now = new Date().toISOString()
      let eventOrdinal = request.eventOrdinal === undefined ? undefined : positiveSafeInteger(request.eventOrdinal, 'eventOrdinal')
      if (request.afterEventId !== undefined) {
        const event = pack.events.find(item => item.id === request.afterEventId)
        if (event === undefined) throw new Error(`divergence afterEventId does not exist: ${JSON.stringify(request.afterEventId)}`)
        if (event.chapter !== atChapter) throw new Error(`divergence afterEventId belongs to chapter ${event.chapter}, not ${atChapter}`)
        if (eventOrdinal !== undefined && event.orderInChapter !== undefined && eventOrdinal !== event.orderInChapter) throw new Error('eventOrdinal conflicts with afterEventId orderInChapter')
        eventOrdinal ??= event.orderInChapter
        if (eventOrdinal === undefined) throw new Error('afterEventId requires the canon event to define orderInChapter or an explicit eventOrdinal')
      }
      const divergence: FanficDivergence = {
        id: `div-${randomUUID()}`,
        atChapter,
        ...(eventOrdinal === undefined ? {} : { eventOrdinal }),
        ...(request.afterEventId === undefined ? {} : { afterEventId: nonEmpty(request.afterEventId, 'afterEventId') }),
        ...(request.sceneId === undefined ? {} : { sceneId: nonEmpty(request.sceneId, 'sceneId') }),
        summary: nonEmpty(request.summary, 'summary'),
        immediateConsequences: uniqueStrings(request.immediateConsequences),
        openQuestions: uniqueStrings(request.openQuestions),
        recordedAt: now,
      }
      const next: FanficBranch = {
        ...branch,
        revision: branch.revision + 1,
        updatedAt: now,
        divergences: [...branch.divergences, divergence],
      }
      await this.writeBranch(next, signal)
      return next
    })
  }

  async updateIntent(request: UpdateFanficIntentRequest, signal?: AbortSignal): Promise<FanficBranch> {
    return this.withBranchLock(request.branchId, async () => {
      const branch = await this.getBranch(request.branchId, signal)
      assertRevision(branch, request.expectedRevision)
      const now = new Date().toISOString()
      const next: FanficBranch = {
        ...branch,
        revision: branch.revision + 1,
        updatedAt: now,
        authorIntent: normalizeAuthorIntent(request.authorIntent),
      }
      await this.writeBranch(next, signal)
      return next
    })
  }

  async updateStoryDirector(request: UpdateFanficStoryDirectorRequest, signal?: AbortSignal): Promise<FanficBranch> {
    return this.withBranchLock(request.branchId, async () => {
      const branch = await this.getBranch(request.branchId, signal)
      assertRevision(branch, request.expectedRevision)
      const now = new Date().toISOString()
      const next: FanficBranch = {
        ...branch, revision: branch.revision + 1, updatedAt: now,
        storyDirector: normalizeStoryDirector(request.storyDirector),
      }
      await this.writeBranch(next, signal)
      return next
    })
  }

  async upsertStoryArc(request: UpsertFanficStoryArcRequest, signal?: AbortSignal): Promise<FanficBranch> {
    return this.updateDirectorPart(request.branchId, request.expectedRevision, 'arcs', parseStoryArc(request.arc, 'arc'), signal)
  }

  async upsertStoryThread(request: UpsertFanficStoryThreadRequest, signal?: AbortSignal): Promise<FanficBranch> {
    return this.updateDirectorPart(request.branchId, request.expectedRevision, 'threads', parseStoryThread(request.thread, 'thread'), signal)
  }

  async upsertForeshadow(request: UpsertFanficForeshadowRequest, signal?: AbortSignal): Promise<FanficBranch> {
    return this.updateDirectorPart(request.branchId, request.expectedRevision, 'foreshadows', parseForeshadow(request.foreshadow, 'foreshadow'), signal)
  }

  async setStoryHorizon(request: SetFanficHorizonRequest, signal?: AbortSignal): Promise<FanficBranch> {
    return this.withBranchLock(request.branchId, async () => {
      const branch = await this.getBranch(request.branchId, signal); assertRevision(branch, request.expectedRevision)
      const nextDirector = normalizeStoryDirector({ ...branch.storyDirector, horizon: request.horizon })
      const now = new Date().toISOString(); const next = { ...branch, revision: branch.revision + 1, updatedAt: now, storyDirector: nextDirector }
      await this.writeBranch(next, signal); return next
    })
  }

  async upsertMysteryTruth(request: UpsertFanficMysteryTruthRequest, signal?: AbortSignal): Promise<FanficBranch> {
    return this.updateDirectorPart(request.branchId, request.expectedRevision, 'mysteryTruths', parseMysteryTruth(request.mysteryTruth, 'mysteryTruth'), signal)
  }

  async upsertInvention(request: UpsertFanficInventionRequest, signal?: AbortSignal): Promise<FanficBranch> {
    return this.updateDirectorPart(request.branchId, request.expectedRevision, 'inventions', parseInvention(request.invention, 'invention'), signal)
  }

  async resolveDirectorReconciliation(request: { readonly branchId: FanficBranchIdValue; readonly expectedRevision: number; readonly reconciliationId: string }, signal?: AbortSignal): Promise<FanficBranch> {
    return this.withBranchLock(request.branchId, async () => {
      const branch = await this.getBranch(request.branchId, signal); assertRevision(branch, request.expectedRevision)
      const id = nonEmpty(request.reconciliationId, 'reconciliationId')
      const target = branch.storyDirector.reconciliation.find(item => item.id === id)
      if (target === undefined) throw new Error(`Story Director reconciliation does not exist: ${JSON.stringify(id)}`)
      if (target.status === 'resolved') return branch
      const now = new Date().toISOString()
      const next: FanficBranch = { ...branch, revision: branch.revision + 1, updatedAt: now, storyDirector: { ...branch.storyDirector, reconciliation: branch.storyDirector.reconciliation.map(item => item.id === id ? { ...item, status: 'resolved' as const, resolvedAt: now } : item) } }
      await this.writeBranch(next, signal); return next
    })
  }

  private async updateDirectorPart<K extends 'arcs' | 'threads' | 'foreshadows' | 'mysteryTruths' | 'inventions'>(
    branchId: FanficBranchIdValue, expectedRevision: number, key: K, value: FanficStoryDirectorState[K][number], signal?: AbortSignal,
  ): Promise<FanficBranch> {
    return this.withBranchLock(branchId, async () => {
      const branch = await this.getBranch(branchId, signal); assertRevision(branch, expectedRevision)
      const rows = branch.storyDirector[key] as readonly { readonly id: string }[]
      const nextRows = [...rows.filter(item => item.id !== (value as { readonly id: string }).id), value]
      const nextDirector = normalizeStoryDirector({ ...branch.storyDirector, [key]: nextRows })
      const now = new Date().toISOString(); const next = { ...branch, revision: branch.revision + 1, updatedAt: now, storyDirector: nextDirector }
      await this.writeBranch(next, signal); return next
    })
  }

  async storyDirectorContext(request: StoryDirectorContextRequest, signal?: AbortSignal): Promise<StoryDirectorContext> {
    const storedBranch = await this.getBranch(request.branchId, signal)
    signal?.throwIfAborted()
    const fanficChapter = positiveSafeInteger(request.fanficChapter, 'fanficChapter')
    const branch = branchView(storedBranch, fanficChapter, true)
    const horizonSize = Math.min(positiveSafeInteger(request.horizonSize, 'horizonSize'), this.maxStructuredRecords)
    const director = branch.storyDirector
    const horizonEnd = fanficChapter + horizonSize - 1
    const activeArcs = director.arcs
      .filter(arc => arc.status === 'active' || (arc.status === 'planned' && (arc.startFanficChapter ?? fanficChapter) <= horizonEnd))
      .slice(0, this.maxStructuredRecords)
    const activeThreads = director.threads
      .filter(thread => thread.status === 'open' || thread.status === 'dormant')
      .sort((a, b) => b.priority - a.priority || a.openedFanficChapter - b.openedFanficChapter)
      .slice(0, this.maxStructuredRecords)
    const dueThreads = activeThreads
      .filter(thread => thread.targetFanficChapter !== undefined && thread.targetFanficChapter <= horizonEnd)
    const liveForeshadows = director.foreshadows
      .filter(item => item.status === 'planned' || item.status === 'planted')
      .slice(0, this.maxStructuredRecords)
    const horizon = director.horizon
      .filter(plan => plan.fanficChapter >= fanficChapter && plan.fanficChapter <= horizonEnd)
      .sort((a, b) => a.fanficChapter - b.fanficChapter)
    const recentChapterSummaries = branch.chapterSummaries
      .filter(item => item.fanficChapter < fanficChapter)
      .slice(-Math.min(this.storyRecentSummaryLimit, this.maxStructuredRecords))
      .map(item => ({ fanficChapter: item.fanficChapter, summary: item.summary }))
    const unresolvedCausalThreads = branch.causalThreads
      .filter(item => item.fromFanficChapter <= fanficChapter && item.status === 'open')
      .slice(-this.maxStructuredRecords)
    const plannedThreadIds = new Set(horizon.flatMap(plan => plan.advanceThreads))
    const attention: string[] = []
    if (activeArcs.length === 0) attention.push('No active/planned story arc covers the current horizon.')
    if (horizon.length === 0) attention.push('Rolling chapter horizon is empty; plan the next 3–5 chapters before drafting long-form prose.')
    for (const thread of dueThreads) {
      if (!plannedThreadIds.has(thread.id)) attention.push(`Due story thread ${thread.id} is not advanced by the current horizon: ${thread.summary}`)
    }
    for (const item of liveForeshadows) {
      if (item.status === 'planted' && item.targetFanficChapter !== undefined && item.targetFanficChapter < fanficChapter) {
        attention.push(`Planted foreshadow ${item.id} is past its target payoff chapter ${item.targetFanficChapter}.`)
      }
    }
    const truthThreadIds = new Set(director.mysteryTruths.flatMap(item => item.relatedThreads))
    for (const thread of activeThreads) {
      if (thread.kind === 'mystery' && !truthThreadIds.has(thread.id)) attention.push(`Mystery thread ${thread.id} has no author-only mystery truth; define its mechanism/payoff before expanding the mystery.`)
    }
    for (const item of director.reconciliation.filter(item => item.status === 'open')) attention.push(`Story Director reconciliation ${item.id}: ${item.message}`)
    if (unresolvedCausalThreads.length > 0 && horizon.every(plan => plan.advanceThreads.length === 0)) {
      attention.push('Open divergence consequences exist but the rolling horizon does not explicitly advance any story thread.')
    }
    return {
      branchId: branch.id, revision: branch.revision, fanficChapter, activeArcs, activeThreads, dueThreads,
      liveForeshadows, mysteryTruths: director.mysteryTruths, inventions: director.inventions, horizon, recentChapterSummaries, unresolvedCausalThreads, attention,
      reconciliation: director.reconciliation.filter(item => item.status === 'open'),
      cautions: [
        'Story Director state is author metadata, not in-world truth or character knowledge.',
        'Planned beats are intentions, not immutable events; recompute them when divergence consequences or character logic change.',
        'Do not force a planned payoff when source-backed character motivation makes the setup implausible.',
      ],
    }
  }

  async stageDraft(request: StageFanficDraftRequest, signal?: AbortSignal): Promise<FanficDraft> {
    const branch = await this.getBranch(request.branchId, signal)
    const fanficChapter = positiveSafeInteger(request.fanficChapter, 'fanficChapter')
    const text = nonEmpty(request.text, 'text')
    const now = new Date().toISOString()
    const draft: FanficDraft = {
      id: `draft-${randomUUID()}`,
      branchId: branch.id,
      fanficChapter,
      branchRevision: branch.revision,
      draftRevision: 1,
      text,
      draftHash: draftHash(text),
      createdAt: now,
      updatedAt: now,
    }
    await mkdir(this.draftsDir, { recursive: true })
    await writeFile(this.draftPath(draft.id), `${JSON.stringify(draft, null, 2)}\n`, { encoding: 'utf8', signal })
    return draft
  }

  async updateDraft(request: UpdateFanficDraftRequest, signal?: AbortSignal): Promise<FanficDraft> {
    const draft = await this.getDraft(request.draftId, signal)
    const branch = await this.getBranch(draft.branchId, signal)
    if (branch.revision !== draft.branchRevision) {
      throw new Error(`staged draft ${draft.id} belongs to branch revision ${draft.branchRevision}, current revision is ${branch.revision}; stage a fresh draft after branch mutations`)
    }
    const expected = positiveSafeInteger(request.expectedDraftRevision, 'expectedDraftRevision')
    if (draft.draftRevision !== expected) throw new Error(`fanfic draft revision conflict: expected ${expected}, current ${draft.draftRevision}`)
    const text = nonEmpty(request.text, 'text')
    const next: FanficDraft = {
      ...draft,
      draftRevision: draft.draftRevision + 1,
      text,
      draftHash: draftHash(text),
      updatedAt: new Date().toISOString(),
    }
    await writeFile(this.draftPath(next.id), `${JSON.stringify(next, null, 2)}\n`, { encoding: 'utf8', signal })
    return next
  }

  async getDraft(draftId: string, signal?: AbortSignal): Promise<FanficDraft> {
    const id = validateDraftId(draftId)
    await mkdir(this.draftsDir, { recursive: true })
    let raw: string
    try { raw = await readFile(this.draftPath(id), { encoding: 'utf8', signal }) }
    catch (error) { if (isNodeError(error) && error.code === 'ENOENT') throw new Error(`fanfic draft does not exist: ${JSON.stringify(id)}`); throw error }
    return parseDraft(JSON.parse(raw), 'draft')
  }

  async applyDelta(request: ApplyFanficDeltaRequest, signal?: AbortSignal): Promise<FanficBranch> {
    return this.withBranchLock(request.branchId, async () => {
      const branch = await this.getBranch(request.branchId, signal)
      assertRevision(branch, request.expectedRevision)
      const delta = normalizeDelta(request.delta)
      assertDeltaChapterAlignment(delta)
      const stagedDraft = await this.getDraft(request.draftId, signal)
      if (stagedDraft.branchId !== branch.id || stagedDraft.fanficChapter !== delta.fanficChapter) throw new Error('staged draft belongs to a different branch/chapter')
      if (stagedDraft.branchRevision !== branch.revision) throw new Error(`staged draft was created at branch revision ${stagedDraft.branchRevision}, current revision is ${branch.revision}; stage a fresh draft`)
      const receipts = await this.verifyAuditReceipts(request.auditReceiptIds, stagedDraft, branch, delta.fanficChapter, signal)
      const now = new Date().toISOString()
      const chapterVersionId = `chapter-${delta.fanficChapter}-${randomUUID()}`
      const previousActive = branch.chapterVersions.filter(version => version.fanficChapter === delta.fanficChapter && version.status === 'active')
      if (previousActive.length > 1) throw new Error(`branch has multiple active versions for fanfic chapter ${delta.fanficChapter}`)
      const previousVersion = previousActive[0]
      const laterActive = branch.chapterVersions.filter(version => version.status === 'active' && version.fanficChapter > delta.fanficChapter)
      if (previousVersion !== undefined && laterActive.length > 0) {
        throw new Error(`cannot rewrite fanfic chapter ${delta.fanficChapter} while later active chapters exist (${laterActive.map(item => item.fanficChapter).join(', ')}); fork or rewrite from the tail so downstream state is not silently invalidated`)
      }
      if (previousVersion !== undefined && request.rewriteMode === undefined) throw new Error('rewriteMode is required when accepting a new version of an existing fanfic chapter')
      if (previousVersion === undefined && request.rewriteMode !== undefined) throw new Error('rewriteMode is only valid when the fanfic chapter already has an active version')
      const rewriteMode = previousVersion === undefined ? 'initial' as const : request.rewriteMode!
      const dropIds = new Set(uniqueStrings(request.dropInheritedRecordIds ?? []))
      const previousRecords = previousVersion === undefined ? emptyChapterRecordSet() : chapterRecords(branch, previousVersion.id)
      const previousRecordIds = new Set([...previousRecords.facts, ...previousRecords.knowledge, ...previousRecords.characterStates, ...previousRecords.relationships, ...previousRecords.causalThreads].map(item => item.id))
      for (const id of dropIds) if (!previousRecordIds.has(id)) throw new Error(`dropInheritedRecordIds contains record not owned by the active chapter version: ${JSON.stringify(id)}`)
      if (rewriteMode === 'replace' && totalRecordCount(previousRecords) > 0 && request.confirmDroppedState !== true) {
        throw new Error(`replace rewrite would discard active structured state; retry with confirmDroppedState=true after reviewing dropped counts ${JSON.stringify(chapterRecordCounts(previousRecords))}`)
      }
      const inherited = rewriteMode === 'inherit'
        ? cloneChapterRecords(previousRecords, chapterVersionId, delta.fanficChapter, now, dropIds)
        : emptyChapterRecordSet()
      const activeBeforeChapter = branchView(branch, delta.fanficChapter, true)
      assertNoSemanticDuplicates(activeBeforeChapter, inherited, delta)
      const resolveThreadIds = new Set(delta.resolveCausalThreadIds ?? [])
      for (const id of resolveThreadIds) {
        if (!activeBeforeChapter.causalThreads.some(thread => thread.id === id)) throw new Error(`cannot resolve unknown or superseded causal thread ${JSON.stringify(id)}`)
      }
      const newCausalThreads: FanficCausalThread[] = (delta.causalThreads ?? []).map(item => ({
        ...item, id: `cause-${randomUUID()}`, originFanficChapter: delta.fanficChapter, originChapterVersionId: chapterVersionId,
        recordedAt: now, ...(item.status === 'resolved' ? { resolvedAt: now } : {}),
      }))
      const inheritedResolved = rewriteMode === 'inherit' && previousVersion !== undefined ? previousVersion.resolvedCausalThreadIds.map(id => inherited.causalIdMap.get(id) ?? id) : []
      const version: FanficChapterVersion = {
        id: chapterVersionId, fanficChapter: delta.fanficChapter, status: 'active', rewriteMode,
        ...(previousVersion === undefined ? {} : { replacesVersionId: previousVersion.id }),
        resolvedCausalThreadIds: uniqueStrings([...inheritedResolved, ...resolveThreadIds, ...newCausalThreads.filter(item => item.status === 'resolved').map(item => item.id)]),
        draftId: stagedDraft.id,
        draftHash: stagedDraft.draftHash,
        createdAt: now,
      }
      const chapterVersions: FanficChapterVersion[] = [
        ...branch.chapterVersions.map(item => item.fanficChapter === delta.fanficChapter && item.status === 'active'
          ? { ...item, status: 'superseded' as const, supersededAt: now }
          : item),
        version,
      ]
      const currentPlan = branch.storyDirector.horizon.find(plan => plan.fanficChapter === delta.fanficChapter)
      const canonReceipt = receipts.find(item => item.kind === 'canon')
      const authorizedMysteryRevealIds = new Set(canonReceipt?.authorizedMysteryRevealIds ?? [])
      for (const payoffId of currentPlan?.payoffForeshadows ?? []) {
        const foreshadow = branch.storyDirector.foreshadows.find(item => item.id === payoffId)
        if (foreshadow === undefined) continue
        const relatedMysteries = branch.storyDirector.mysteryTruths.filter(truth => truth.status !== 'revealed' && truth.status !== 'retired'
          && truth.relatedThreads.some(threadId => foreshadow.relatedThreads.includes(threadId)))
        const unauthorized = relatedMysteries.filter(truth => !authorizedMysteryRevealIds.has(truth.id))
        if (unauthorized.length > 0) {
          throw new Error(`mystery payoff ${JSON.stringify(payoffId)} is not authorized by the canon audit receipt; satisfy and declare reveal conditions for ${unauthorized.map(item => item.id).join(', ')}`)
        }
      }
      const foreshadows = branch.storyDirector.foreshadows.map(item => {
        if (currentPlan?.payoffForeshadows.includes(item.id)) return { ...item, status: 'paid-off' as const, payoffFanficChapter: delta.fanficChapter }
        if (currentPlan?.plantForeshadows.includes(item.id) && item.status === 'planned') return { ...item, status: 'planted' as const, plantedFanficChapter: delta.fanficChapter }
        return item
      })
      const reconciliation: FanficDirectorReconciliation[] = [...branch.storyDirector.reconciliation]
      if (previousVersion !== undefined) reconciliation.push({
        id: `reconcile-${randomUUID()}`, fanficChapter: delta.fanficChapter, chapterVersionId,
        reason: 'rewrite', status: 'open', createdAt: now,
        message: `Chapter ${delta.fanficChapter} was rewritten (${rewriteMode}); reconcile horizon beats, story-thread progress, foreshadow/payoff status, arc notes, and causal assumptions against the new active version.`,
      })
      if (currentPlan === undefined) reconciliation.push({
        id: `reconcile-${randomUUID()}`, fanficChapter: delta.fanficChapter, chapterVersionId,
        reason: 'accepted-chapter', status: 'open', createdAt: now,
        message: `Accepted chapter ${delta.fanficChapter} had no Story Director horizon entry; reconcile long-form thread and payoff metadata before planning further chapters.`,
      })
      const storyDirector: FanficStoryDirectorState = {
        ...branch.storyDirector,
        foreshadows,
        mysteryTruths: branch.storyDirector.mysteryTruths.map(item => authorizedMysteryRevealIds.has(item.id) ? { ...item, status: 'revealed' as const } : item),
        reconciliation,
        horizon: branch.storyDirector.horizon.map(plan => plan.fanficChapter === delta.fanficChapter ? { ...plan, status: 'accepted' as const } : plan),
      }
      const inheritedSummary = rewriteMode === 'inherit' && previousVersion !== undefined
        ? branch.chapterSummaries.find(item => item.chapterVersionId === previousVersion.id)?.summary
        : undefined
      const causalThreads = materializeCausalThreadStatus([...branch.causalThreads, ...inherited.causalThreads, ...newCausalThreads], chapterVersions)
      const next: FanficBranch = {
        ...branch,
        version: 3,
        revision: branch.revision + 1,
        updatedAt: now,
        storyDirector,
        chapterVersions,
        facts: [...branch.facts, ...inherited.facts, ...(delta.facts ?? []).map(item => ({ ...item, id: `fact-${randomUUID()}`, originFanficChapter: delta.fanficChapter, originChapterVersionId: chapterVersionId, recordedAt: now }))],
        knowledge: [...branch.knowledge, ...inherited.knowledge, ...(delta.knowledge ?? []).map(item => ({ ...item, id: `know-${randomUUID()}`, originFanficChapter: delta.fanficChapter, originChapterVersionId: chapterVersionId, recordedAt: now }))],
        characterStates: [...branch.characterStates, ...inherited.characterStates, ...(delta.characterStates ?? []).map(item => ({ ...item, id: `char-${randomUUID()}`, originFanficChapter: delta.fanficChapter, originChapterVersionId: chapterVersionId, recordedAt: now }))],
        relationships: [...branch.relationships, ...inherited.relationships, ...(delta.relationships ?? []).map(item => ({ ...item, id: `rel-${randomUUID()}`, originFanficChapter: delta.fanficChapter, originChapterVersionId: chapterVersionId, recordedAt: now }))],
        causalThreads,
        chapterSummaries: (delta.chapterSummary ?? inheritedSummary) === undefined
          ? branch.chapterSummaries
          : [...branch.chapterSummaries, { fanficChapter: delta.fanficChapter, chapterVersionId, summary: (delta.chapterSummary ?? inheritedSummary)!, recordedAt: now }],
      }
      await this.writeBranch(next, signal)
      await this.consumeAuditReceipts(receipts, signal)
      return next
    })
  }

  async audit(request: FanficAuditRequest, signal?: AbortSignal): Promise<FanficAuditResult> {
    const pack = await this.load(signal)
    const requestedCutoff = cutoffChapter(request.asOfChapter, pack.chapters.length)
    const resolvedDraft = await this.resolveDraftInput(request, signal)
    const stagedDraft = resolvedDraft.stagedDraft
    const fanficChapter = stagedDraft?.fanficChapter ?? request.fanficChapter
    const draft = resolvedDraft.text.trim()
    const issues: FanficAuditIssue[] = []
    if (draft.length === 0) issues.push({ severity: 'error', code: 'EMPTY_DRAFT', message: 'Draft is empty.' })

    const storedBranch = await this.auditBranchForDraft(stagedDraft, request.branchId, fanficChapter, signal)
    const branch = storedBranch === undefined ? undefined : branchView(storedBranch, fanficChapter, true)
    const divergence = storedBranch === undefined ? undefined : earliestDivergencePoint(storedBranch)
    const stableCutoff = divergence === undefined || divergence.atChapter > requestedCutoff
      ? requestedCutoff
      : Math.max(1, Math.min(requestedCutoff, divergence.atChapter - 1))
    const sameChapterTruth = divergence !== undefined && divergence.atChapter <= requestedCutoff && preciseDivergenceBoundary(divergence) !== undefined
      ? await this.sameChapterTruthBeforeDivergence(pack, divergence, { povCharacter: request.povCharacter, entities: uniqueStrings([request.povCharacter, ...(request.participants ?? [])]) }, signal)
      : undefined
    const counterfactualCanon = stableCutoff < requestedCutoff

    for (const mystery of pack.mysteries) {
      const revealedBeforeBoundary = sameChapterTruth !== undefined && mystery.provenance !== undefined && sameChapterTruth.mysteries.some(item => item.id === mystery.id)
      if (stableCutoff >= mystery.revealChapter || revealedBeforeBoundary) continue
      for (const term of mystery.forbiddenBeforeReveal ?? []) {
        if (term.length === 0 || !draft.includes(term)) continue
        if (counterfactualCanon) {
          if (!branchEstablishesReveal(branch, request.povCharacter, term)) {
            issues.push({
              severity: 'warning',
              code: 'COUNTERFACTUAL_REVEAL_UNESTABLISHED',
              message: `Draft uses ${JSON.stringify(term)} after the branch diverged but before that reveal was established in branch state. Later canon reveal timing is counterfactual, so persist branch evidence or verify the scene explicitly.`,
            })
          }
          continue
        }
        issues.push({
          severity: 'error',
          code: 'PREMATURE_REVEAL',
          message: `Draft contains ${JSON.stringify(term)} before mystery ${JSON.stringify(mystery.label)} reveals at chapter ${mystery.revealChapter}.`,
        })
      }
    }

    const mysteryDeclarations = normalizeMysteryRevealDeclarations(request.mysteryReveals ?? [])
    const authorizedMysteryRevealIds: string[] = []
    if (storedBranch !== undefined) {
      const truthById = new Map(storedBranch.storyDirector.mysteryTruths.map(item => [item.id, item]))
      for (const declaration of mysteryDeclarations) {
        const truth = truthById.get(declaration.mysteryId)
        if (truth === undefined) {
          issues.push({ severity: 'error', code: 'MYSTERY_REVEAL_UNKNOWN', message: `Mystery reveal declaration references unknown author truth ${JSON.stringify(declaration.mysteryId)}.` })
          continue
        }
        const invalidConditions = declaration.satisfiedConditions.filter(item => !truth.revealConditions.includes(item))
        if (invalidConditions.length > 0) {
          issues.push({ severity: 'error', code: 'MYSTERY_REVEAL_CONDITION_UNKNOWN', message: `Mystery ${truth.id} declaration names conditions not present in its revealConditions: ${invalidConditions.join('; ')}` })
          continue
        }
        const missingEvidence = declaration.conditionEvidence.filter(item => !draft.includes(item))
        if (missingEvidence.length > 0) {
          issues.push({ severity: 'error', code: 'MYSTERY_REVEAL_EVIDENCE_NOT_IN_DRAFT', message: `Mystery ${truth.id} reveal evidence is not an exact excerpt of the staged draft: ${missingEvidence.map(item => JSON.stringify(item)).join(', ')}` })
          continue
        }
        if (declaration.level === 'truth') {
          if (truth.revealConditions.length > 0 && declaration.satisfiedConditions.length === 0) {
            issues.push({ severity: 'error', code: 'MYSTERY_REVEAL_CONDITION_NOT_MET', message: `Full reveal of mystery ${truth.id} requires at least one declared satisfied reveal condition.` })
          } else if (truth.revealConditions.length > 0 && declaration.conditionEvidence.length === 0) {
            issues.push({ severity: 'error', code: 'MYSTERY_REVEAL_EVIDENCE_REQUIRED', message: `Full reveal of mystery ${truth.id} requires exact staged-draft evidence for the declared reveal condition.` })
          } else {
            authorizedMysteryRevealIds.push(truth.id)
          }
        }
      }
      for (const truth of storedBranch.storyDirector.mysteryTruths) {
        if (truth.status === 'revealed' || truth.status === 'retired') continue
        const protectedTerms = truth.protectedRevealTerms.filter(term => term.length > 0 && draft.includes(term))
        if (protectedTerms.length === 0) continue
        const declaration = mysteryDeclarations.find(item => item.mysteryId === truth.id)
        if (declaration === undefined) {
          issues.push({
            severity: 'error',
            code: 'MYSTERY_REVEAL_UNDECLARED',
            message: `Draft exposes protected author-truth term(s) for mystery ${truth.id} without a reveal declaration: ${protectedTerms.map(term => JSON.stringify(term)).join(', ')}`,
          })
        } else if (declaration.level !== 'truth') {
          issues.push({
            severity: 'error',
            code: 'MYSTERY_REVEAL_LEVEL_TOO_LOW',
            message: `Draft exposes protected author-truth term(s) for mystery ${truth.id}; declare a full truth reveal and satisfy its reveal condition before using them.`,
          })
        }
      }
    }

    const snapshotBase = await this.snapshotFromPack(pack, {
      asOfChapter: stableCutoff,
      povCharacter: request.povCharacter,
      entities: uniqueStrings([request.povCharacter, ...(request.participants ?? [])]),
      query: request.povCharacter,
      searchLimit: 1,
    }, signal)
    const snapshot = sameChapterTruth === undefined ? snapshotBase : mergeAuditSnapshots(snapshotBase, sameChapterTruth)
    const extractedClaims = extractDraftClaims(draft, uniqueStrings([request.povCharacter, ...(request.participants ?? []), ...snapshot.characterStates.map(item => item.name)]))
    const uncoveredRiskyClaims = extractedClaims.filter(extracted => !request.claims.some(submitted => auditClaimCovers(submitted, extracted)))
    for (const claim of request.claims) {
      const issue = validateClaim(claim, snapshot, pack, stableCutoff, requestedCutoff, branch, request.povCharacter)
      if (issue !== undefined) issues.push(issue)
    }
    for (const claim of uncoveredRiskyClaims) {
      issues.push({
        severity: 'warning',
        code: `AUDIT_COVERAGE_UNDECLARED_${claim.kind.toUpperCase().replace('-', '_')}`,
        message: `Independent draft scan found a risky ${claim.kind} claim that was not declared for audit coverage: ${claim.subject}${claim.object === undefined ? '' : ` — ${claim.object}`}`,
        claim,
      })
      const issue = validateClaim(claim, snapshot, pack, stableCutoff, requestedCutoff, branch, request.povCharacter)
      if (issue !== undefined && !issues.some(existing => existing.code === issue.code && existing.claim?.subject === claim.subject && existing.claim?.object === claim.object)) issues.push(issue)
    }

    const ok = !issues.some(issue => issue.severity === 'error')
    const auditReceipt = storedBranch === undefined || fanficChapter === undefined || stagedDraft === undefined || !ok
      ? undefined
      : await this.issueAuditReceipt('canon', stagedDraft, storedBranch, fanficChapter, authorizedMysteryRevealIds, signal)
    return {
      ok,
      ...(auditReceipt === undefined ? {} : { auditReceipt }),
      issues,
      coverage: {
        extractedClaims, submittedClaims: request.claims, uncoveredRiskyClaims,
        coveredCount: extractedClaims.length - uncoveredRiskyClaims.length, extractedCount: extractedClaims.length,
      },
      authorizedMysteryRevealIds: uniqueStrings(authorizedMysteryRevealIds),
      limitations: [
        'Mystery Reveal Guard enforces declared protected terms and branch reveal conditions; it cannot prove that a natural-language condition actually occurred unless branch state or the model declaration records it.',
        'A missing structured canon record is not proof that a claim is false; inspect source evidence when the graph is incomplete.',
        ...(counterfactualCanon ? ['Canon after the branch divergence is counterfactual reference and cannot establish branch facts or POV knowledge by itself.'] : []),
        'Causal plausibility after divergence still requires model reasoning over the branch state and canon reference.',
      ],
    }
  }

  private async load(signal?: AbortSignal): Promise<LoadedCanonPack> {
    signal?.throwIfAborted()
    this.loadPromise ??= this.loadCanonPack()
    const pack = await this.loadPromise
    signal?.throwIfAborted()
    return pack
  }

  private async loadCanonPack(): Promise<LoadedCanonPack> {
    const manifest = parseManifest(await readJson(join(this.canonPackDir, 'manifest.json')))
    const source = parseSource(await readJson(join(this.canonPackDir, 'source.json')))
    const chapters = await readNdjson(join(this.canonPackDir, 'chapters.ndjson'), parseChapter)
    if (chapters.length === 0) throw new Error('fanfic canon pack contains no narrative chapters')
    for (let index = 0; index < chapters.length; index++) {
      if (chapters[index]!.index !== index + 1) throw new Error(`canon chapters must be contiguous from 1; got ${chapters[index]!.index} at row ${index + 1}`)
    }
    if (source.chapterCount !== chapters.length) {
      throw new Error(`source chapterCount ${source.chapterCount} does not match chapters.ndjson ${chapters.length}`)
    }
    const styleBank = await loadNarrativeStyleBank(join(this.canonPackDir, 'style', 'style-bank.json'), source, chapters)
    const graphDir = join(this.canonPackDir, 'graph')
    const base = await loadGraphDirectory(graphDir)
    const enrichment = await loadGraphDirectory(this.enrichmentGraphDir)
    const enrichmentCounts: Record<CanonEnrichmentKind, number> = {
      fact: enrichment.facts.length,
      knowledge: enrichment.knowledge.length,
      character: enrichment.characters.length,
      identity: enrichment.identities.length,
      power: enrichment.powers.length,
      relationship: enrichment.relationships.length,
      mystery: enrichment.mysteries.length,
      event: enrichment.events.length,
      'timeline-rule': enrichment.timelineRules.length,
      'causal-link': enrichment.causalLinks.length,
    }
    return {
      manifest, source, chapters,
      facts: mergeById(base.facts, enrichment.facts),
      knowledge: mergeById(base.knowledge, enrichment.knowledge),
      characters: mergeById(base.characters, enrichment.characters),
      identities: mergeById(base.identities, enrichment.identities),
      powers: mergeById(base.powers, enrichment.powers),
      relationships: mergeById(base.relationships, enrichment.relationships),
      mysteries: mergeById(base.mysteries, enrichment.mysteries),
      events: mergeById(base.events, enrichment.events),
      timelineRules: mergeById(base.timelineRules, enrichment.timelineRules),
      causalLinks: mergeById(base.causalLinks, enrichment.causalLinks),
      enrichmentCounts,
      styleBank,
    }
  }

  private async snapshotFromPack(pack: LoadedCanonPack, request: CanonSnapshotRequest, signal?: AbortSignal): Promise<CanonSnapshot> {
    signal?.throwIfAborted()
    const cutoff = cutoffChapter(request.asOfChapter, pack.chapters.length)
    const names = uniqueStrings([request.povCharacter ?? '', ...(request.entities ?? [])]).filter(Boolean)
    const matches = (values: readonly string[]): boolean => names.length === 0 || values.some(value => names.some(name => sameName(value, name)))
    const temporal = <T extends { readonly validFromChapter: number; readonly validUntilChapter?: number }>(records: readonly T[]): T[] =>
      records.filter(record => record.validFromChapter <= cutoff && (record.validUntilChapter === undefined || cutoff <= record.validUntilChapter))
        .slice(0, this.maxStructuredRecords)
    const facts = temporal(pack.facts.filter(fact => matches([fact.subject, ...(fact.aliases ?? [])])))
      .filter(fact => fact.revealFromChapter === undefined || fact.revealFromChapter <= cutoff)
    const characters = temporal(pack.characters.filter(character => matches([character.name, ...(character.aliases ?? [])])))
    const identities = temporal(pack.identities.filter(edge => matches([edge.subject, edge.object])))
      .filter(edge => edge.revealFromChapter === undefined || edge.revealFromChapter <= cutoff)
    const powers = temporal(pack.powers.filter(power => power.subject === '修炼体系' || matches([power.subject])))
    const relationships = temporal(pack.relationships.filter(relationship => matches([relationship.subject, relationship.object])))
    const visibleFactIds = new Set(facts.map(fact => fact.id))
    const povKnowledge = request.povCharacter === undefined ? [] : pack.knowledge
      .filter(record => sameName(record.character, request.povCharacter!))
      .filter(record => visibleFactIds.has(record.factId))
      .filter(record => record.knownFromChapter <= cutoff && (record.knownUntilChapter === undefined || cutoff <= record.knownUntilChapter))
      .slice(0, this.maxStructuredRecords)
    const mysteries = pack.mysteries
      .filter(mystery => mystery.revealChapter <= cutoff || (mystery.clues ?? []).some(clue => clue.chapter <= cutoff))
      .slice(0, this.maxStructuredRecords)
    const events = pack.events.filter(event => event.chapter <= cutoff && (names.length === 0 || matches(event.participants ?? [])))
      .slice(-this.maxStructuredRecords)
    const timelineRules = temporal(pack.timelineRules)
    const causalLinks = pack.causalLinks.filter(link => link.introducedByChapter <= cutoff)
      .slice(-this.maxStructuredRecords)
    const query = request.query?.trim() ?? ''
    const sourceExcerpts = query.length === 0 ? [] : await this.search({ query, asOfChapter: cutoff, limit: request.searchLimit }, signal)
    return {
      asOfChapter: cutoff,
      spoilerFirewall: { maxNarrativeChapter: cutoff, futureCanonBlocked: true },
      ...request.povCharacter === undefined ? {} : { povCharacter: request.povCharacter },
      characterStates: characters,
      facts,
      povKnowledge,
      identities,
      powers,
      relationships,
      mysteries,
      events,
      timelineRules,
      causalLinks,
      sourceExcerpts,
    }
  }

  private async sameChapterTruthBeforeDivergence(
    pack: LoadedCanonPack,
    divergence: FanficDivergence,
    request: { readonly povCharacter: string; readonly entities: readonly string[] },
    signal?: AbortSignal,
  ): Promise<CanonSnapshot> {
    const boundary = preciseDivergenceBoundary(divergence)
    if (boundary === undefined) throw new Error('same-chapter truth requires a precise event boundary')
    const full = await this.snapshotFromPack(pack, {
      asOfChapter: divergence.atChapter, povCharacter: request.povCharacter, entities: request.entities, query: '', searchLimit: 1,
    }, signal)
    const provenanceBefore = (provenance: CanonProvenance | undefined): boolean => provenance?.chapter === divergence.atChapter && provenance.eventOrdinal !== undefined && provenance.eventOrdinal <= boundary
    const events = full.events.filter(event => event.chapter === divergence.atChapter && event.orderInChapter !== undefined && event.orderInChapter <= boundary)
    return {
      ...full,
      characterStates: full.characterStates.filter(item => provenanceBefore(item.provenance)),
      facts: full.facts.filter(item => provenanceBefore(item.provenance)),
      povKnowledge: full.povKnowledge.filter(item => provenanceBefore(item.provenance)),
      identities: full.identities.filter(item => provenanceBefore(item.provenance)),
      powers: full.powers.filter(item => provenanceBefore(item.provenance)),
      relationships: full.relationships.filter(item => provenanceBefore(item.provenance)),
      mysteries: full.mysteries.filter(item => provenanceBefore(item.provenance)),
      events,
      timelineRules: full.timelineRules.filter(item => provenanceBefore(item.provenance)),
      causalLinks: full.causalLinks.filter(item => provenanceBefore(item.provenance)),
      sourceExcerpts: [],
    }
  }

  private async copyCorpus(pack: LoadedCanonPack): Promise<CopyCorpus> {
    this.copyCorpusPromise ??= Promise.resolve(buildCopyCorpus(pack.chapters))
    return this.copyCorpusPromise
  }

  private async withEnrichmentLock<T>(operation: () => Promise<T>): Promise<T> {
    const prior = this.enrichmentTail
    let release!: () => void
    const current = new Promise<void>(resolveLock => { release = resolveLock })
    const tail = prior.then(() => current)
    this.enrichmentTail = tail
    await prior
    try { return await operation() } finally {
      release()
      if (this.enrichmentTail === tail) this.enrichmentTail = Promise.resolve()
    }
  }

  private async readEnrichmentCoverage(signal?: AbortSignal): Promise<readonly CanonEnrichmentCoverage[]> {
    signal?.throwIfAborted()
    const rows = await readOptionalNdjson(this.enrichmentCoveragePath, parseEnrichmentCoverage)
    signal?.throwIfAborted()
    return rows
  }

  private branchPath(id: FanficBranchIdValue): string { return join(this.branchesDir, `${id}.json`) }

  private async readBranchFile(path: string, signal?: AbortSignal): Promise<FanficBranch> {
    try {
      return parseBranch(JSON.parse(await readFile(path, { encoding: 'utf8', signal })))
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') throw new Error(`fanfic branch does not exist: ${basename(path, '.json')}`)
      throw error
    }
  }

  private async writeBranch(branch: FanficBranch, signal?: AbortSignal): Promise<void> {
    await mkdir(this.branchesDir, { recursive: true })
    signal?.throwIfAborted()
    const path = this.branchPath(branch.id)
    const temp = `${path}.${randomUUID()}.tmp`
    try {
      await writeFile(temp, `${JSON.stringify(branch, null, 2)}\n`, { encoding: 'utf8', signal })
      signal?.throwIfAborted()
      await rename(temp, path)
    } catch (error) {
      // A failed temp cleanup is harmless residue and must not mask the owning write failure.
      try { await rm(temp, { force: true }) } catch (_cleanupFailed) { /* best-effort cleanup cannot replace the write failure */ }
      throw error
    }
  }

  private async resolveDraftInput(input: { readonly draftId?: string; readonly draft?: string }, signal?: AbortSignal): Promise<{ readonly text: string; readonly stagedDraft?: FanficDraft }> {
    if (input.draftId !== undefined && input.draft !== undefined) throw new Error('provide draftId or draft, not both')
    if (input.draftId !== undefined) {
      const stagedDraft = await this.getDraft(input.draftId, signal)
      return { text: stagedDraft.text, stagedDraft }
    }
    if (input.draft === undefined) throw new Error('draftId or draft is required')
    return { text: nonEmpty(input.draft, 'draft') }
  }

  private async auditBranchForDraft(
    stagedDraft: FanficDraft | undefined,
    branchId: FanficBranchIdValue | undefined,
    fanficChapter: number | undefined,
    signal?: AbortSignal,
  ): Promise<FanficBranch | undefined> {
    const id = stagedDraft?.branchId ?? branchId
    if (id === undefined) return undefined
    const branch = await this.getBranch(id, signal)
    if (stagedDraft !== undefined) {
      if (branchId !== undefined && branchId !== stagedDraft.branchId) throw new Error('draftId and branchId refer to different branches')
      if (fanficChapter !== undefined && fanficChapter !== stagedDraft.fanficChapter) throw new Error('draftId and fanficChapter refer to different chapters')
      if (stagedDraft.branchRevision !== branch.revision) throw new Error(`staged draft was created at branch revision ${stagedDraft.branchRevision}, current revision is ${branch.revision}; stage a fresh draft`)
    }
    return branch
  }

  private async issueAuditReceipt(
    kind: FanficAuditReceipt['kind'],
    stagedDraft: FanficDraft,
    branch: FanficBranch,
    fanficChapter: number,
    authorizedMysteryRevealIds: readonly string[] = [],
    signal?: AbortSignal,
  ): Promise<FanficAuditReceipt> {
    if (stagedDraft.branchId !== branch.id || stagedDraft.fanficChapter !== fanficChapter) throw new Error('staged draft does not match audit branch/chapter')
    if (stagedDraft.branchRevision !== branch.revision) throw new Error(`staged draft was created at branch revision ${stagedDraft.branchRevision}, current revision is ${branch.revision}; stage a fresh draft`)
    const receipt: FanficAuditReceipt = {
      id: `receipt-${kind}-${randomUUID()}`,
      kind,
      draftHash: stagedDraft.draftHash,
      draftId: stagedDraft.id,
      writingContractHash: writingContractHash(branch.authorIntent.writingContract),
      authorizedMysteryRevealIds: uniqueStrings(authorizedMysteryRevealIds),
      branchId: branch.id,
      fanficChapter: positiveSafeInteger(fanficChapter, 'fanficChapter'),
      branchRevision: branch.revision,
      ok: true,
      issuedAt: new Date().toISOString(),
    }
    await mkdir(this.auditReceiptsDir, { recursive: true })
    await writeFile(join(this.auditReceiptsDir, `${receipt.id}.json`), `${JSON.stringify(receipt, null, 2)}\n`, { encoding: 'utf8', signal })
    return receipt
  }

  private async verifyAuditReceipts(ids: readonly string[], stagedDraft: FanficDraft, branch: FanficBranch, fanficChapter: number, signal?: AbortSignal): Promise<readonly FanficAuditReceipt[]> {
    const uniqueIds = uniqueStrings(ids)
    if (uniqueIds.length !== 3) throw new Error('fanfic_apply_delta requires exactly three distinct audit receipts: canon, style, and anti-copy')
    const receipts: FanficAuditReceipt[] = []
    for (const id of uniqueIds) {
      if (!/^receipt-(?:canon|style|anti-copy)-[0-9a-f-]+$/u.test(id)) throw new Error(`invalid audit receipt id ${JSON.stringify(id)}`)
      let raw: string
      try { raw = await readFile(join(this.auditReceiptsDir, `${id}.json`), { encoding: 'utf8', signal }) }
      catch (error) { if (isNodeError(error) && error.code === 'ENOENT') throw new Error(`audit receipt does not exist or was already consumed: ${JSON.stringify(id)}`); throw error }
      receipts.push(parseAuditReceipt(JSON.parse(raw), 'auditReceipt'))
    }
    const kinds = new Set(receipts.map(item => item.kind))
    for (const required of ['canon', 'style', 'anti-copy'] as const) if (!kinds.has(required)) throw new Error(`missing required ${required} audit receipt`)
    const contractHash = writingContractHash(branch.authorIntent.writingContract)
    for (const receipt of receipts) {
      if (!receipt.ok) throw new Error(`audit receipt ${receipt.id} did not pass`)
      if (receipt.draftHash !== stagedDraft.draftHash || receipt.draftId !== stagedDraft.id) throw new Error(`audit receipt ${receipt.id} belongs to a different staged draft`)
      if (receipt.writingContractHash !== contractHash) throw new Error(`audit receipt ${receipt.id} belongs to a different writing contract`)
      if (receipt.branchId !== branch.id || receipt.fanficChapter !== fanficChapter) throw new Error(`audit receipt ${receipt.id} belongs to a different branch/chapter`)
      if (receipt.branchRevision !== branch.revision) throw new Error(`audit receipt ${receipt.id} was issued at branch revision ${receipt.branchRevision}, current revision is ${branch.revision}; re-audit after branch mutations`)
    }
    return receipts
  }

  private async consumeAuditReceipts(receipts: readonly FanficAuditReceipt[], signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted()
    await Promise.all(receipts.map(receipt => rm(join(this.auditReceiptsDir, `${receipt.id}.json`), { force: true })))
  }

  private draftPath(draftId: string): string { return join(this.draftsDir, `${validateDraftId(draftId)}.json`) }

  private async withBranchLock<T>(id: FanficBranchIdValue, operation: () => Promise<T>): Promise<T> {
    validateBranchId(id)
    const key = String(id)
    const prior = this.branchLocks.get(key) ?? Promise.resolve()
    let release!: () => void
    const current = new Promise<void>(resolveLock => { release = resolveLock })
    const tail = prior.then(() => current)
    this.branchLocks.set(key, tail)
    await prior
    try {
      return await operation()
    } finally {
      release()
      if (this.branchLocks.get(key) === tail) this.branchLocks.delete(key)
    }
  }
}

interface ChapterRecordSet {
  readonly facts: FanficOverlayFact[]
  readonly knowledge: FanficOverlayKnowledge[]
  readonly characterStates: FanficOverlayCharacterState[]
  readonly relationships: FanficOverlayRelationship[]
  readonly causalThreads: FanficCausalThread[]
}

interface ClonedChapterRecordSet extends ChapterRecordSet { readonly causalIdMap: ReadonlyMap<string, string> }

function emptyChapterRecordSet(): ClonedChapterRecordSet { return { facts: [], knowledge: [], characterStates: [], relationships: [], causalThreads: [], causalIdMap: new Map() } }

function chapterRecords(branch: FanficBranch, chapterVersionId: string): ChapterRecordSet {
  return {
    facts: branch.facts.filter(item => item.originChapterVersionId === chapterVersionId),
    knowledge: branch.knowledge.filter(item => item.originChapterVersionId === chapterVersionId),
    characterStates: branch.characterStates.filter(item => item.originChapterVersionId === chapterVersionId),
    relationships: branch.relationships.filter(item => item.originChapterVersionId === chapterVersionId),
    causalThreads: branch.causalThreads.filter(item => item.originChapterVersionId === chapterVersionId),
  }
}

function cloneChapterRecords(records: ChapterRecordSet, chapterVersionId: string, fanficChapter: number, recordedAt: string, dropIds: ReadonlySet<string>): ClonedChapterRecordSet {
  const causalIdMap = new Map<string, string>()
  const causalThreads = records.causalThreads.filter(item => !dropIds.has(item.id)).map(item => {
    const id = `cause-${randomUUID()}`; causalIdMap.set(item.id, id)
    return { ...item, id, originFanficChapter: fanficChapter, originChapterVersionId: chapterVersionId, recordedAt, ...(item.status === 'resolved' ? { resolvedAt: recordedAt } : {}) }
  })
  return {
    facts: records.facts.filter(item => !dropIds.has(item.id)).map(item => ({ ...item, id: `fact-${randomUUID()}`, originFanficChapter: fanficChapter, originChapterVersionId: chapterVersionId, recordedAt })),
    knowledge: records.knowledge.filter(item => !dropIds.has(item.id)).map(item => ({ ...item, id: `know-${randomUUID()}`, originFanficChapter: fanficChapter, originChapterVersionId: chapterVersionId, recordedAt })),
    characterStates: records.characterStates.filter(item => !dropIds.has(item.id)).map(item => ({ ...item, id: `char-${randomUUID()}`, originFanficChapter: fanficChapter, originChapterVersionId: chapterVersionId, recordedAt })),
    relationships: records.relationships.filter(item => !dropIds.has(item.id)).map(item => ({ ...item, id: `rel-${randomUUID()}`, originFanficChapter: fanficChapter, originChapterVersionId: chapterVersionId, recordedAt })),
    causalThreads,
    causalIdMap,
  }
}

function chapterRecordCounts(records: ChapterRecordSet, dropped?: ReadonlySet<string>): Readonly<Record<string, number>> {
  const count = <T extends { readonly id: string }>(rows: readonly T[]): number => dropped === undefined ? rows.length : rows.filter(item => dropped.has(item.id)).length
  return { facts: count(records.facts), knowledge: count(records.knowledge), characterStates: count(records.characterStates), relationships: count(records.relationships), causalThreads: count(records.causalThreads) }
}
function totalRecordCount(records: ChapterRecordSet): number { return records.facts.length + records.knowledge.length + records.characterStates.length + records.relationships.length + records.causalThreads.length }

function assertDeltaChapterAlignment(delta: FanficStateDelta): void {
  const chapter = delta.fanficChapter
  for (const item of delta.facts ?? []) {
    if (item.validFromFanficChapter !== chapter) throw new Error(`fanfic_apply_delta cannot backfill facts from chapter ${chapter} to ${item.validFromFanficChapter}; rewrite the owning chapter instead`)
    if (item.validUntilFanficChapter !== undefined && item.validUntilFanficChapter < chapter) throw new Error('fact validUntilFanficChapter precedes its owning chapter')
  }
  for (const item of delta.knowledge ?? []) if (item.fromFanficChapter !== chapter) throw new Error(`fanfic_apply_delta cannot backfill knowledge from chapter ${chapter} to ${item.fromFanficChapter}; rewrite the owning chapter instead`)
  for (const item of delta.characterStates ?? []) if (item.fromFanficChapter !== chapter) throw new Error(`fanfic_apply_delta cannot backfill character state from chapter ${chapter} to ${item.fromFanficChapter}; rewrite the owning chapter instead`)
  for (const item of delta.relationships ?? []) if (item.fromFanficChapter !== chapter) throw new Error(`fanfic_apply_delta cannot backfill relationship state from chapter ${chapter} to ${item.fromFanficChapter}; rewrite the owning chapter instead`)
  for (const item of delta.causalThreads ?? []) if (item.fromFanficChapter !== chapter) throw new Error(`fanfic_apply_delta cannot backfill causal threads from chapter ${chapter} to ${item.fromFanficChapter}; rewrite the owning chapter instead`)
}

function assertUniqueSemantic<T>(existing: readonly T[], incoming: readonly T[], key: (item: T) => string, label: string): void {
  const seen = new Set(existing.map(key))
  for (const item of incoming) { const value = key(item); if (seen.has(value)) throw new Error(`duplicate semantic ${label} record in active branch state: ${value}`); seen.add(value) }
}
function assertNoSemanticDuplicates(activeBefore: FanficBranch, inherited: ChapterRecordSet, delta: FanficStateDelta): void {
  assertUniqueSemantic([...activeBefore.facts, ...inherited.facts], (delta.facts ?? []) as readonly FanficOverlayFact[], item => JSON.stringify([item.subject, item.predicate, item.object]), 'fact')
  assertUniqueSemantic([...activeBefore.knowledge, ...inherited.knowledge], (delta.knowledge ?? []) as readonly FanficOverlayKnowledge[], item => JSON.stringify([item.character, item.subject, item.predicate, item.object, item.summary, item.stance]), 'knowledge')
  assertUniqueSemantic([...activeBefore.characterStates, ...inherited.characterStates], (delta.characterStates ?? []) as readonly FanficOverlayCharacterState[], item => JSON.stringify([item.character, item.summary]), 'character-state')
  assertUniqueSemantic([...activeBefore.relationships, ...inherited.relationships], (delta.relationships ?? []) as readonly FanficOverlayRelationship[], item => JSON.stringify([item.subject, item.object, item.summary]), 'relationship')
  assertUniqueSemantic([...activeBefore.causalThreads, ...inherited.causalThreads], (delta.causalThreads ?? []) as readonly FanficCausalThread[], item => JSON.stringify([item.summary]), 'causal-thread')
}

function draftHash(draft: string): string { return createHash('sha256').update(draft, 'utf8').digest('hex') }
function writingContractHash(contract: FanficWritingContract): string { return createHash('sha256').update(JSON.stringify(contract), 'utf8').digest('hex') }
function validateDraftId(value: unknown): string {
  const id = nonEmpty(value, 'draftId')
  if (!/^draft-[0-9a-f-]+$/u.test(id)) throw new Error(`invalid fanfic draft id ${JSON.stringify(id)}`)
  return id
}
function parseDraft(value: unknown, label: string): FanficDraft {
  const record = objectRecord(value, label)
  const branchId = nonEmpty(record['branchId'], `${label}.branchId`); validateBranchId(branchId)
  const text = nonEmpty(record['text'], `${label}.text`)
  const draftHashValue = nonEmpty(record['draftHash'], `${label}.draftHash`)
  if (draftHashValue !== draftHash(text)) throw new Error(`${label}.draftHash does not match staged text`)
  return {
    id: validateDraftId(record['id']),
    branchId: FanficBranchId(branchId),
    fanficChapter: positiveSafeInteger(record['fanficChapter'], `${label}.fanficChapter`),
    branchRevision: positiveSafeInteger(record['branchRevision'], `${label}.branchRevision`),
    draftRevision: positiveSafeInteger(record['draftRevision'], `${label}.draftRevision`),
    text,
    draftHash: draftHashValue,
    createdAt: isoDate(record['createdAt'], `${label}.createdAt`),
    updatedAt: isoDate(record['updatedAt'], `${label}.updatedAt`),
  }
}
function normalizeMysteryRevealDeclarations(values: readonly FanficMysteryRevealDeclaration[]): FanficMysteryRevealDeclaration[] {
  const seen = new Set<string>()
  return values.map((value, index) => {
    const mysteryId = nonEmpty(value.mysteryId, `mysteryReveals[${index}].mysteryId`)
    if (seen.has(mysteryId)) throw new Error(`mysteryReveals contains duplicate mystery id ${JSON.stringify(mysteryId)}`)
    seen.add(mysteryId)
    if (value.level !== 'partial' && value.level !== 'truth') throw new Error(`mysteryReveals[${index}].level is invalid`)
    return { mysteryId, level: value.level, satisfiedConditions: uniqueStrings(value.satisfiedConditions), conditionEvidence: uniqueStrings(value.conditionEvidence) }
  })
}
function parseAuditReceipt(value: unknown, label: string): FanficAuditReceipt {
  const record = objectRecord(value, label)
  const branchId = nonEmpty(record['branchId'], `${label}.branchId`); validateBranchId(branchId)
  return {
    id: nonEmpty(record['id'], `${label}.id`),
    kind: enumString(record['kind'], `${label}.kind`, ['canon', 'style', 'anti-copy'] as const),
    draftHash: nonEmpty(record['draftHash'], `${label}.draftHash`),
    draftId: validateDraftId(record['draftId']),
    writingContractHash: nonEmpty(record['writingContractHash'], `${label}.writingContractHash`),
    authorizedMysteryRevealIds: uniqueStrings(stringArray(record['authorizedMysteryRevealIds'] ?? [], `${label}.authorizedMysteryRevealIds`)),
    branchId: FanficBranchId(branchId),
    fanficChapter: positiveSafeInteger(record['fanficChapter'], `${label}.fanficChapter`),
    branchRevision: positiveSafeInteger(record['branchRevision'], `${label}.branchRevision`),
    ok: record['ok'] === true,
    issuedAt: isoDate(record['issuedAt'], `${label}.issuedAt`),
  }
}

function compactBranchForAuthor(branch: FanficBranch, relevantEntities: readonly string[], recordLimit: number, summaryLimit: number): FanficBranch {
  const relevant = (values: readonly string[]): boolean => relevantEntities.length === 0 || values.some(value => relevantEntities.some(entity => sameName(value, entity)))
  const tail = <T>(rows: readonly T[]): T[] => rows.slice(-recordLimit)
  const facts = tail(branch.facts.filter(item => relevant([item.subject])))
  const knowledge = tail(branch.knowledge.filter(item => relevant([item.character, item.subject ?? ''])))
  const characterStates = tail(branch.characterStates.filter(item => relevant([item.character])))
  const relationships = tail(branch.relationships.filter(item => relevant([item.subject, item.object])))
  const causalThreads = tail(branch.causalThreads.filter(item => item.status === 'open' || relevant([item.summary])))
  const chapterSummaries = branch.chapterSummaries.slice(-summaryLimit)
  const versionIds = new Set([...facts, ...knowledge, ...characterStates, ...relationships, ...causalThreads].map(item => item.originChapterVersionId).concat(chapterSummaries.map(item => item.chapterVersionId)))
  return { ...branch, storyDirector: emptyStoryDirector(), chapterVersions: branch.chapterVersions.filter(item => item.status === 'active' && (versionIds.has(item.id) || item.fanficChapter >= Math.max(1, (chapterSummaries.at(-1)?.fanficChapter ?? 1) - summaryLimit))), facts, knowledge, characterStates, relationships, causalThreads, chapterSummaries }
}

function compactAuthorContextToBudget(context: AuthorContext, sourceExcerptLimit: number, maxJsonChars: number): AuthorContext {
  const trimSnapshot = (snapshot: CanonSnapshot, sourceLimit: number, recordLimit?: number): CanonSnapshot => {
    const limit = <T>(rows: readonly T[]): readonly T[] => recordLimit === undefined ? rows : rows.slice(0, recordLimit)
    return {
      ...snapshot,
      characterStates: limit(snapshot.characterStates),
      facts: limit(snapshot.facts),
      povKnowledge: limit(snapshot.povKnowledge),
      identities: limit(snapshot.identities),
      powers: limit(snapshot.powers),
      relationships: limit(snapshot.relationships),
      mysteries: limit(snapshot.mysteries),
      events: limit(snapshot.events),
      timelineRules: limit(snapshot.timelineRules),
      causalLinks: limit(snapshot.causalLinks),
      sourceExcerpts: snapshot.sourceExcerpts.slice(0, sourceLimit),
    }
  }
  const trimIntelligence = (rows: readonly CharacterIntelligence[], dossierLimit: number, recordLimit: number): readonly CharacterIntelligence[] => rows.slice(0, dossierLimit).map(item => ({
    ...item,
    states: item.states.slice(0, recordLimit),
    identities: item.identities.slice(0, recordLimit),
    powers: item.powers.slice(0, recordLimit),
    relationships: item.relationships.slice(0, recordLimit),
    knowledge: item.knowledge.slice(0, recordLimit),
    facts: item.facts.slice(0, recordLimit),
    sourceEvidence: [],
    ...(item.branchState === undefined ? {} : {
      branchState: {
        characterStates: item.branchState.characterStates.slice(0, recordLimit),
        relationships: item.branchState.relationships.slice(0, recordLimit),
        knowledge: item.branchState.knowledge.slice(0, recordLimit),
      },
    }),
  }))
  const minimalBranch = (branch: FanficBranch | undefined): FanficBranch | undefined => branch === undefined ? undefined : {
    ...branch,
    storyDirector: emptyStoryDirector(),
    divergences: branch.divergences.slice(-2),
    chapterVersions: branch.chapterVersions.slice(-4),
    facts: [],
    knowledge: [],
    characterStates: [],
    relationships: [],
    causalThreads: branch.causalThreads.filter(item => item.status === 'open').slice(-4),
    chapterSummaries: branch.chapterSummaries.slice(-3),
  }
  const counts = (value: AuthorContext) => ({
    sourceExcerpts: value.canonTruth.sourceExcerpts.length
      + (value.canonSameChapterTruth?.sourceExcerpts.length ?? 0)
      + (value.canonReference?.sourceExcerpts.length ?? 0)
      + value.narrativeStyle.samples.length,
    characterEvidence: value.characterIntelligence.reduce((sum, item) => sum + item.sourceEvidence.length, 0),
    olderBranchRecords: value.branch === undefined ? 0 : value.branch.facts.length + value.branch.knowledge.length + value.branch.characterStates.length
      + value.branch.relationships.length + value.branch.causalThreads.length + value.branch.chapterSummaries.length + value.branch.chapterVersions.length,
    storyDirectorRecords: value.storyDirector === undefined ? 0 : value.storyDirector.activeArcs.length + value.storyDirector.activeThreads.length
      + value.storyDirector.dueThreads.length + value.storyDirector.liveForeshadows.length + value.storyDirector.mysteryTruths.length
      + value.storyDirector.inventions.length + value.storyDirector.horizon.length + value.storyDirector.recentChapterSummaries.length
      + value.storyDirector.unresolvedCausalThreads.length + value.storyDirector.reconciliation.length,
  })
  const baseline = counts(context)
  const finalize = (value: AuthorContext, compactionLevel: number): AuthorContext => {
    const current = counts(value)
    const omitted = {
      sourceExcerpts: Math.max(0, baseline.sourceExcerpts - current.sourceExcerpts),
      characterEvidence: Math.max(0, baseline.characterEvidence - current.characterEvidence),
      olderBranchRecords: Math.max(0, baseline.olderBranchRecords - current.olderBranchRecords),
      storyDirectorRecords: Math.max(0, baseline.storyDirectorRecords - current.storyDirectorRecords),
    }
    let candidate: AuthorContext = { ...value, telemetry: { serializedChars: 0, budgetChars: maxJsonChars, compactionLevel, omitted } }
    for (let index = 0; index < 3; index++) {
      const serializedChars = JSON.stringify(candidate).length
      if (candidate.telemetry.serializedChars === serializedChars) break
      candidate = { ...candidate, telemetry: { ...candidate.telemetry, serializedChars } }
    }
    return candidate
  }
  const fit = (value: AuthorContext, level: number): AuthorContext | undefined => {
    const candidate = finalize(value, level)
    return JSON.stringify(candidate).length <= maxJsonChars ? candidate : undefined
  }
  const budgetNotice = `Author context was compacted to the configured ${maxJsonChars}-character hard budget. Fetch omitted evidence on demand with canon_search/canon_chapter_read/character_voice_context.`

  let value: AuthorContext = {
    ...context,
    canonTruth: trimSnapshot(context.canonTruth, sourceExcerptLimit),
    ...(context.canonSameChapterTruth === undefined ? {} : { canonSameChapterTruth: trimSnapshot(context.canonSameChapterTruth, 0) }),
    ...(context.canonReference === undefined ? {} : { canonReference: trimSnapshot(context.canonReference, 0) }),
    characterIntelligence: context.characterIntelligence.map(item => ({ ...item, sourceEvidence: item.sourceEvidence.slice(0, 1) })),
  }
  let result = fit(value, 0)
  if (result !== undefined) return result

  value = {
    ...value,
    narrativeStyle: { ...value.narrativeStyle, samples: [] },
    characterIntelligence: value.characterIntelligence.map(item => ({ ...item, sourceEvidence: [] })),
    hardConstraints: [...value.hardConstraints, budgetNotice],
  }
  result = fit(value, 1)
  if (result !== undefined) return result

  value = {
    ...value,
    canonTruth: trimSnapshot(value.canonTruth, 0, 8),
    ...(value.canonSameChapterTruth === undefined ? {} : { canonSameChapterTruth: trimSnapshot(value.canonSameChapterTruth, 0, 8) }),
    ...(value.canonReference === undefined ? {} : { canonReference: trimSnapshot(value.canonReference, 0, 4) }),
    contextExpansion: { ...value.contextExpansion, discovered: value.contextExpansion.discovered.slice(0, 8) },
    characterIntelligence: trimIntelligence(value.characterIntelligence, 4, 4),
  }
  result = fit(value, 2)
  if (result !== undefined) return result

  value = {
    ...value,
    canonTruth: trimSnapshot(value.canonTruth, 0, 3),
    ...(value.canonSameChapterTruth === undefined ? {} : { canonSameChapterTruth: trimSnapshot(value.canonSameChapterTruth, 0, 3) }),
    ...(value.canonReference === undefined ? {} : { canonReference: trimSnapshot(value.canonReference, 0, 0) }),
    contextExpansion: { ...value.contextExpansion, discovered: value.contextExpansion.discovered.slice(0, 4) },
    characterIntelligence: trimIntelligence(value.characterIntelligence, 2, 2),
    ...(value.branch === undefined ? {} : { branch: minimalBranch(value.branch) as FanficBranch }),
    ...(value.storyDirector === undefined ? {} : { storyDirector: {
      ...value.storyDirector,
      activeArcs: value.storyDirector.activeArcs.slice(0, 2),
      activeThreads: value.storyDirector.activeThreads.slice(0, 4),
      dueThreads: value.storyDirector.dueThreads.slice(0, 4),
      liveForeshadows: value.storyDirector.liveForeshadows.slice(0, 4),
      mysteryTruths: value.storyDirector.mysteryTruths.slice(0, 2),
      inventions: value.storyDirector.inventions.slice(0, 2),
      horizon: value.storyDirector.horizon.slice(0, 3),
      recentChapterSummaries: value.storyDirector.recentChapterSummaries.slice(-2),
      unresolvedCausalThreads: value.storyDirector.unresolvedCausalThreads.slice(0, 4),
      reconciliation: value.storyDirector.reconciliation.filter(item => item.status === 'open').slice(0, 4),
    } }),
  }
  result = fit(value, 3)
  if (result !== undefined) return result

  value = {
    ...value,
    canonTruth: trimSnapshot(value.canonTruth, 0, 1),
    ...(value.canonSameChapterTruth === undefined ? {} : { canonSameChapterTruth: trimSnapshot(value.canonSameChapterTruth, 0, 1) }),
    contextExpansion: { ...value.contextExpansion, discovered: [] },
    characterIntelligence: [],
    ...(value.branch === undefined ? {} : { branch: minimalBranch(value.branch) as FanficBranch }),
  }
  result = fit(value, 4)
  if (result !== undefined) return result
  throw new Error(`author context cannot satisfy configured hard budget of ${maxJsonChars} JSON characters; raise authorContextMaxJsonChars or request less scene context`)
}

function styleDeviationWithSeverity(deviation: NarrativeStyleDeviation, requiredRatio: number): NarrativeStyleDeviation {
  const core = new Set<keyof NarrativeStyleMetrics>(['dialogueCharRatio', 'meanSentenceChars', 'medianSentenceChars', 'meanParagraphChars', 'medianParagraphChars', 'shortParagraphRatio'])
  if (!core.has(deviation.metric)) return deviation
  const relative = Math.abs(deviation.draftValue - deviation.referenceValue) / Math.max(Math.abs(deviation.referenceValue), 0.01)
  return relative >= requiredRatio ? { ...deviation, severity: 'revision-required' } : deviation
}

const NARRATIVE_STYLE_MODES = ['jianghu', 'mystery', 'reincarnation-mission', 'banter-introspection', 'combat', 'high-level-strategy', 'cosmology-philosophy', 'exposition', 'ensemble-rumor', 'emotional'] as const satisfies readonly Exclude<NarrativeStyleMode, 'auto'>[]
const MIN_ANTI_COPY_PHRASE_CHARS = 12

const STYLE_MODE_KEYWORDS: Readonly<Record<Exclude<NarrativeStyleMode, 'auto'>, readonly string[]>> = {
  jianghu: ['江湖', '客栈', '酒楼', '侠', '门派', '榜', '剑', '刀', '少侠', '大侠'],
  mystery: ['秘密', '线索', '疑惑', '怀疑', '诡异', '古怪', '幕后', '真相', '谜', '踪迹'],
  'reincarnation-mission': ['六道轮回', '轮回任务', '善功', '兑换', '轮回世界', '任务', '彼岸符'],
  'banter-introspection': ['腹诽', '吐槽', '暗忖', '心中', '念头', '苦笑', '失笑', '调侃', '玩笑'],
  combat: ['交手', '出刀', '出剑', '掌', '拳', '刀光', '剑光', '气机', '杀机', '轰', '斩', '战'],
  'high-level-strategy': ['布局', '谋划', '棋子', '博弈', '算计', '幕后', '因果', '天意', '大势', '局势'],
  'cosmology-philosophy': ['彼岸', '道果', '诸天万界', '真实界', '时光长河', '大道', '造化', '传说', '他我', '历史'],
  exposition: ['所谓', '也就是说', '换言之', '分为', '境界', '层次', '体系', '意味着', '据说', '传闻'],
  'ensemble-rumor': ['众人', '江湖传闻', '据传', '传言', '说书', '人榜', '地榜', '天榜', '轰动', '议论'],
  emotional: ['心疼', '温柔', '怅然', '悲伤', '欢喜', '微笑', '泪', '情意', '相拥', '牵手'],
}

async function loadNarrativeStyleBank(path: string, source: CanonPackSource, chapters: readonly CanonChapter[]): Promise<NarrativeStyleBank> {
  if (!existsSync(path)) return buildNarrativeStyleBank(source, chapters)
  const record = objectRecord(await readJson(path), 'styleBank')
  const schemaVersion = positiveSafeInteger(record['schemaVersion'], 'styleBank.schemaVersion')
  const sourceSha256 = sha256(record['sourceSha256'], 'styleBank.sourceSha256')
  if (sourceSha256 !== source.sha256) throw new Error('style bank sourceSha256 does not match canon source')
  const chapterCount = positiveSafeInteger(record['chapterCount'], 'styleBank.chapterCount')
  if (chapterCount !== chapters.length) throw new Error(`style bank chapterCount ${chapterCount} does not match canon ${chapters.length}`)
  const modes = stringArray(record['modes'], 'styleBank.modes').map(normalizeConcreteNarrativeStyleMode)
  const rows = parseArray(record['chapterMetrics'], 'styleBank.chapterMetrics', (value, label): NarrativeStyleBankChapter => {
    const row = objectRecord(value, label)
    const chapter = positiveSafeInteger(row['chapter'], `${label}.chapter`)
    const chapterSha256 = sha256(row['chapterSha256'], `${label}.chapterSha256`)
    const modeRecord = objectRecord(row['modeScores'], `${label}.modeScores`)
    const modeScores: Record<string, number> = {}
    for (const mode of NARRATIVE_STYLE_MODES) modeScores[mode] = finiteNumber(modeRecord[mode] ?? 0, `${label}.modeScores.${mode}`)
    return { chapter, chapterSha256, metrics: parseNarrativeStyleMetrics(row['metrics'], `${label}.metrics`), modeScores }
  })
  if (rows.length !== chapters.length) throw new Error(`style bank has ${rows.length} chapter rows, expected ${chapters.length}`)
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index]!
    const chapter = chapters[index]!
    if (row.chapter !== chapter.index || row.chapterSha256 !== chapter.sha256) throw new Error(`style bank row ${index + 1} does not match canon chapter ${chapter.index}`)
  }
  return { schemaVersion, sourceSha256, chapterCount, modes, chapterMetrics: rows }
}

function buildNarrativeStyleBank(source: CanonPackSource, chapters: readonly CanonChapter[]): NarrativeStyleBank {
  return {
    schemaVersion: 1,
    sourceSha256: source.sha256,
    chapterCount: chapters.length,
    modes: [...NARRATIVE_STYLE_MODES],
    chapterMetrics: chapters.map(chapter => ({
      chapter: chapter.index,
      chapterSha256: chapter.sha256,
      metrics: measureNarrativeStyle(chapter.text),
      modeScores: scoreNarrativeModes(chapter.text),
    })),
  }
}

function parseNarrativeStyleMetrics(value: unknown, label: string): NarrativeStyleMetrics {
  const record = objectRecord(value, label)
  return {
    charCount: nonNegativeSafeInteger(record['charCount'], `${label}.charCount`),
    hanCharCount: nonNegativeSafeInteger(record['hanCharCount'], `${label}.hanCharCount`),
    paragraphCount: nonNegativeSafeInteger(record['paragraphCount'], `${label}.paragraphCount`),
    sentenceCount: nonNegativeSafeInteger(record['sentenceCount'], `${label}.sentenceCount`),
    dialogueCharRatio: finiteNumber(record['dialogueCharRatio'], `${label}.dialogueCharRatio`),
    meanSentenceChars: finiteNumber(record['meanSentenceChars'], `${label}.meanSentenceChars`),
    medianSentenceChars: finiteNumber(record['medianSentenceChars'], `${label}.medianSentenceChars`),
    meanParagraphChars: finiteNumber(record['meanParagraphChars'], `${label}.meanParagraphChars`),
    medianParagraphChars: finiteNumber(record['medianParagraphChars'], `${label}.medianParagraphChars`),
    shortParagraphRatio: finiteNumber(record['shortParagraphRatio'], `${label}.shortParagraphRatio`),
    questionRate: finiteNumber(record['questionRate'], `${label}.questionRate`),
    exclamationRate: finiteNumber(record['exclamationRate'], `${label}.exclamationRate`),
    ellipsisRate: finiteNumber(record['ellipsisRate'], `${label}.ellipsisRate`),
  }
}

function normalizeNarrativeStyleMode(value: unknown): NarrativeStyleMode {
  if (value === 'auto') return value
  return normalizeConcreteNarrativeStyleMode(value)
}

function normalizeConcreteNarrativeStyleMode(value: unknown): Exclude<NarrativeStyleMode, 'auto'> {
  if (typeof value !== 'string' || !NARRATIVE_STYLE_MODES.includes(value as Exclude<NarrativeStyleMode, 'auto'>)) throw new Error(`invalid narrative style mode ${JSON.stringify(value)}`)
  return value as Exclude<NarrativeStyleMode, 'auto'>
}

function styleKeywords(mode: Exclude<NarrativeStyleMode, 'auto'>): readonly string[] { return STYLE_MODE_KEYWORDS[mode] ?? [] }

function scoreNarrativeModes(text: string): Readonly<Record<string, number>> {
  const scale = Math.max(1, Math.sqrt(Math.max(1, text.length) / 1000))
  const result: Record<string, number> = {}
  for (const mode of NARRATIVE_STYLE_MODES) {
    let count = 0
    for (const keyword of styleKeywords(mode)) count += countTextOccurrences(text, keyword)
    result[mode] = count / scale
  }
  return result
}

function resolveNarrativeStyleMode(pack: LoadedCanonPack, cutoff: number, requested: NarrativeStyleMode, query: string): Exclude<NarrativeStyleMode, 'auto'> {
  if (requested !== 'auto') return requested
  const scores = new Map<Exclude<NarrativeStyleMode, 'auto'>, number>(NARRATIVE_STYLE_MODES.map(mode => [mode, 0]))
  for (const mode of NARRATIVE_STYLE_MODES) {
    for (const keyword of styleKeywords(mode)) scores.set(mode, scores.get(mode)! + countTextOccurrences(query, keyword) * 25)
  }
  const terms = searchTerms(query)
  if (terms.length > 0) {
    for (const chapter of pack.chapters) {
      if (chapter.index > cutoff) break
      const queryScore = scoreChapter(chapter, terms)
      if (queryScore <= 0) continue
      const row = pack.styleBank.chapterMetrics[chapter.index - 1]
      if (row === undefined) continue
      for (const mode of NARRATIVE_STYLE_MODES) scores.set(mode, scores.get(mode)! + (row.modeScores[mode] ?? 0) * queryScore)
    }
  }
  if ([...scores.values()].every(value => value === 0)) {
    for (const row of pack.styleBank.chapterMetrics) {
      if (row.chapter > cutoff) break
      for (const mode of NARRATIVE_STYLE_MODES) scores.set(mode, scores.get(mode)! + (row.modeScores[mode] ?? 0))
    }
  }
  return [...scores.entries()].sort((a, b) => b[1] - a[1] || NARRATIVE_STYLE_MODES.indexOf(a[0]) - NARRATIVE_STYLE_MODES.indexOf(b[0]))[0]?.[0] ?? 'jianghu'
}

function measureNarrativeStyle(text: string): NarrativeStyleMetrics {
  const stripped = text.trim()
  const paragraphs = stripped.length === 0 ? [] : stripped.split(/\n+/u).map(value => value.trim()).filter(Boolean)
  const sentences = stripped.match(/[^。！？!?…]+[。！？!?…]*/gu)?.map(value => value.trim()).filter(Boolean) ?? []
  let dialogueChars = 0
  for (const match of stripped.matchAll(/[“"]([^”"]+)[”"]/gu)) dialogueChars += match[1]?.length ?? 0
  const sentenceLengths = sentences.map(value => value.length)
  const paragraphLengths = paragraphs.map(value => value.length)
  const denominator = Math.max(1, sentences.length)
  return {
    charCount: stripped.length,
    hanCharCount: [...stripped].filter(char => /[\u3400-\u9fff]/u.test(char)).length,
    paragraphCount: paragraphs.length,
    sentenceCount: sentences.length,
    dialogueCharRatio: stripped.length === 0 ? 0 : dialogueChars / stripped.length,
    meanSentenceChars: average(sentenceLengths),
    medianSentenceChars: median(sentenceLengths),
    meanParagraphChars: average(paragraphLengths),
    medianParagraphChars: median(paragraphLengths),
    shortParagraphRatio: paragraphs.length === 0 ? 0 : paragraphLengths.filter(length => length <= 16).length / paragraphs.length,
    questionRate: (countTextOccurrences(stripped, '？') + countTextOccurrences(stripped, '?')) / denominator,
    exclamationRate: (countTextOccurrences(stripped, '！') + countTextOccurrences(stripped, '!')) / denominator,
    ellipsisRate: (countTextOccurrences(stripped, '……') + countTextOccurrences(stripped, '…')) / denominator,
  }
}

interface ProseQualityThresholds {
  readonly ultraShortHanChars: number
  readonly maxUltraShortRun: number
  readonly tailUltraShortRatio: number
  readonly minBigramDiversity: number
  readonly tailFillerLimit: number
}

function assessProseQuality(text: string, thresholds: ProseQualityThresholds): ProseQualityResult {
  const paragraphs = text.trim().split(/\n+/u).map(value => value.trim()).filter(Boolean)
  const hanCount = (value: string): number => [...value].filter(char => /[\u3400-\u9fff]/u.test(char)).length
  const paragraphHan = paragraphs.map(hanCount)
  const ultraShort = paragraphHan.map(value => value > 0 && value <= 8)
  let maxUltraShortParagraphRun = 0
  let currentRun = 0
  for (const value of ultraShort) {
    currentRun = value ? currentRun + 1 : 0
    maxUltraShortParagraphRun = Math.max(maxUltraShortParagraphRun, currentRun)
  }
  const sentences = (text.match(/[^。！？!?…\n]+[。！？!?…]*/gu) ?? [])
    .map(value => value.normalize('NFKC').replace(/[\s。！？!?…，,；;：“”"'（）()、]/gu, ''))
    .filter(value => hanCount(value) >= 2)
  const sentenceCounts = new Map<string, number>()
  for (const sentence of sentences) sentenceCounts.set(sentence, (sentenceCounts.get(sentence) ?? 0) + 1)
  const repeatedSentenceCount = [...sentenceCounts.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0)
  const han = [...text].filter(char => /[\u3400-\u9fff]/u.test(char)).join('')
  const bigrams: string[] = []
  for (let index = 0; index + 1 < han.length; index++) bigrams.push(han.slice(index, index + 2))
  const hanBigramDiversity = bigrams.length === 0 ? 1 : new Set(bigrams).size / bigrams.length
  const tail = paragraphs.slice(-Math.min(24, paragraphs.length))
  const tailUltraShortParagraphRatio = tail.length === 0 ? 0 : tail.filter(value => {
    const count = hanCount(value)
    return count > 0 && count <= 8
  }).length / tail.length
  const fillerPhrases = ['继续', '慢慢来', '不急', '就这样', '好的', '嗯', '一步一步', '新的一天', '生活继续', '调查继续']
  const tailText = tail.join('\n')
  const fillerHits = fillerPhrases.reduce((sum, phrase) => sum + countTextOccurrences(tailText, phrase), 0)
  const findings: ProseQualityFinding[] = []
  if (maxUltraShortParagraphRun >= thresholds.maxUltraShortRun) findings.push({
    severity: 'revision-required',
    code: 'PROSE_DEGENERATION_SHORT_PARAGRAPH_RUN',
    message: `Revise the draft: it contains ${maxUltraShortParagraphRun} consecutive ultra-short paragraphs, a strong generation-degeneration/padding signal.`,
  })
  if (tail.length >= 12 && tailUltraShortParagraphRatio >= 0.6) findings.push({
    severity: 'revision-required',
    code: 'PROSE_DEGENERATION_TAIL_COLLAPSE',
    message: `Revise the ending: ${Math.round(tailUltraShortParagraphRatio * 100)}% of the final ${tail.length} paragraphs are eight Han characters or shorter.`,
  })
  if (repeatedSentenceCount >= 5) findings.push({
    severity: 'revision-required',
    code: 'PROSE_DEGENERATION_REPEATED_SENTENCES',
    message: `Revise repeated prose: the draft repeats ${repeatedSentenceCount} normalized sentence units.`,
  })
  if (han.length >= 1200 && hanBigramDiversity < thresholds.minBigramDiversity) findings.push({
    severity: 'revision-required',
    code: 'PROSE_DEGENERATION_LEXICAL_COLLAPSE',
    message: `Revise repetitive wording: Han-bigram diversity fell to ${hanBigramDiversity.toFixed(3)}.`,
  })
  if (tail.length >= 12 && fillerHits >= 6) findings.push({
    severity: 'revision-required',
    code: 'PROSE_DEGENERATION_PADDING_CADENCE',
    message: `Revise the ending: repeated generic continuation/padding phrases occur ${fillerHits} times in the final ${tail.length} paragraphs.`,
    evidence: fillerPhrases.filter(phrase => tailText.includes(phrase)).join(' / '),
  })
  const ultraShortParagraphRatio = paragraphs.length === 0 ? 0 : ultraShort.filter(Boolean).length / paragraphs.length
  if (ultraShortParagraphRatio >= 0.45 && !findings.some(item => item.code === 'PROSE_DEGENERATION_SHORT_PARAGRAPH_RUN')) findings.push({
    severity: 'warning',
    code: 'PROSE_SHORT_PARAGRAPH_DENSITY',
    message: `${Math.round(ultraShortParagraphRatio * 100)}% of paragraphs are eight Han characters or shorter; verify that dramatic breaks are intentional rather than generic suspense cadence.`,
  })
  return {
    ok: !findings.some(item => item.severity === 'revision-required'),
    findings,
    metrics: {
      paragraphCount: paragraphs.length,
      ultraShortParagraphRatio,
      maxUltraShortParagraphRun,
      repeatedSentenceCount,
      hanBigramDiversity,
      tailUltraShortParagraphRatio,
    },
  }
}

function aggregateNarrativeStyleMetrics(metrics: readonly NarrativeStyleMetrics[]): NarrativeStyleMetrics {
  if (metrics.length === 0) return measureNarrativeStyle('')
  const mean = (key: keyof NarrativeStyleMetrics): number => average(metrics.map(item => item[key]))
  return {
    charCount: Math.round(mean('charCount')),
    hanCharCount: Math.round(mean('hanCharCount')),
    paragraphCount: Math.round(mean('paragraphCount')),
    sentenceCount: Math.round(mean('sentenceCount')),
    dialogueCharRatio: mean('dialogueCharRatio'),
    meanSentenceChars: mean('meanSentenceChars'),
    medianSentenceChars: mean('medianSentenceChars'),
    meanParagraphChars: mean('meanParagraphChars'),
    medianParagraphChars: mean('medianParagraphChars'),
    shortParagraphRatio: mean('shortParagraphRatio'),
    questionRate: mean('questionRate'),
    exclamationRate: mean('exclamationRate'),
    ellipsisRate: mean('ellipsisRate'),
  }
}

function narrativeStyleGuidance(mode: Exclude<NarrativeStyleMode, 'auto'>, reference: NarrativeStyleMetrics, global: NarrativeStyleMetrics): string[] {
  const guidance = [`Treat ${mode} as a scene-mode retrieval label and target the work's high-level pacing conventions rather than distinctive phrasing.`]
  if (reference.dialogueCharRatio > global.dialogueCharRatio) guidance.push('This scene mode is more dialogue-forward than the cutoff-wide baseline; let interaction carry information instead of explaining every implication in narration.')
  else guidance.push('This scene mode is at least as narration-forward as the cutoff-wide baseline; dialogue does not need to carry every beat.')
  if (reference.meanSentenceChars > global.meanSentenceChars) guidance.push('Reference passages use longer sentence units than the cutoff-wide baseline; preserve clause variation and avoid reducing everything to short declarative beats.')
  else guidance.push('Reference passages use comparatively tighter sentence units; keep action and perception moving without excessive clause stacking.')
  if (reference.meanParagraphChars > global.meanParagraphChars) guidance.push('Paragraphs in the selected evidence run denser than the cutoff-wide baseline; group closely related perception/action before breaking.')
  else guidance.push('Paragraphs in the selected evidence break relatively often; use paragraph turns to control beats, reactions, and reveals.')
  if (reference.shortParagraphRatio < global.shortParagraphRatio) guidance.push('Avoid overusing one-line dramatic paragraphs; the selected evidence tends to sustain beats across denser paragraphs.')
  if (reference.ellipsisRate > global.ellipsisRate) guidance.push('Pauses and trailing beats occur more often in this mode; use them selectively for hesitation/subtext rather than as a generic mannerism.')
  return guidance
}

function narrativeStyleDeviations(draft: NarrativeStyleMetrics, reference: NarrativeStyleMetrics, ratio: number): NarrativeStyleDeviation[] {
  const keys: readonly (keyof NarrativeStyleMetrics)[] = ['dialogueCharRatio', 'meanSentenceChars', 'medianSentenceChars', 'meanParagraphChars', 'medianParagraphChars', 'shortParagraphRatio', 'questionRate', 'exclamationRate', 'ellipsisRate']
  const deviations: NarrativeStyleDeviation[] = []
  for (const metric of keys) {
    const expected = reference[metric]
    const actual = draft[metric]
    const floor = typeof metric === 'string' && (metric.endsWith('Rate') || metric.endsWith('Ratio')) ? 0.03 : 1
    const relative = Math.abs(actual - expected) / Math.max(Math.abs(expected), floor)
    const punctuation = metric === 'questionRate' || metric === 'exclamationRate' || metric === 'ellipsisRate'
    if (relative <= ratio * (punctuation ? 1.5 : 1)) continue
    deviations.push({
      metric,
      severity: 'warning',
      draftValue: actual,
      referenceValue: expected,
      message: `${String(metric)} differs from the selected high-level reference envelope by ${Math.round(relative * 100)}%.`,
    })
  }
  return deviations
}

function styleDeviationGuidance(deviation: NarrativeStyleDeviation): string {
  switch (deviation.metric) {
    case 'dialogueCharRatio': return 'Rebalance dialogue and narration toward the selected scene-mode evidence; preserve subtext instead of converting all information into explicit speech.'
    case 'meanSentenceChars':
    case 'medianSentenceChars': return 'Vary sentence and clause length toward the reference rhythm without copying any source sentence construction verbatim.'
    case 'meanParagraphChars':
    case 'medianParagraphChars': return 'Adjust paragraph breaks to better match the selected scene-mode beat density.'
    case 'shortParagraphRatio': return 'Review one-line/very-short dramatic paragraphs; avoid using them as a generic suspense cadence when the selected evidence sustains denser beats.'
    case 'questionRate': return 'Review rhetorical and spoken questions; avoid using questions as a repetitive substitute for uncertainty or exposition.'
    case 'exclamationRate': return 'Review emphatic punctuation and keep intensity grounded in scene action and character reaction.'
    case 'ellipsisRate': return 'Review trailing pauses and ellipses; keep them tied to genuine hesitation, interruption, or subtext.'
    case 'hanCharCount':
    case 'charCount':
    case 'paragraphCount':
    case 'sentenceCount': return 'Review overall scene length separately from local narrative rhythm.'
    default: return 'Review the flagged high-level narrative metric against the selected reference context.'
  }
}

function normalizeCopyText(text: string): string { return text.normalize('NFKC').replace(/\s+/gu, '') }

function buildCopyCorpus(chapters: readonly CanonChapter[]): CopyCorpus {
  const spans: CopyCorpusSpan[] = []
  const parts: string[] = []
  let offset = 0
  for (const chapter of chapters) {
    const normalized = normalizeCopyText(chapter.text)
    const start = offset
    parts.push(normalized)
    offset += normalized.length
    const end = offset
    spans.push({ chapter: chapter.index, start, end })
    parts.push('\u0000')
    offset += 1
  }
  return { text: parts.join(''), spans }
}

function findAntiCopyOverlaps(draft: string, corpus: CopyCorpus, cutoff: number, minPhraseChars: number, maxFindings: number): AntiCopyFinding[] {
  if (draft.length < minPhraseChars) return []
  const findings: AntiCopyFinding[] = []
  const seen = new Set<string>()
  const stride = Math.max(1, Math.floor(minPhraseChars / 2))
  let position = 0
  while (position + minPhraseChars <= draft.length && findings.length < maxFindings) {
    const seed = draft.slice(position, position + minPhraseChars)
    if (meaningfulCharacterCount(seed) < Math.ceil(minPhraseChars * 0.7)) { position += stride; continue }
    const sourceIndex = corpus.text.indexOf(seed)
    if (sourceIndex < 0) { position += stride; continue }
    let draftStart = position
    let sourceStart = sourceIndex
    while (draftStart > 0 && sourceStart > 0 && corpus.text[sourceStart - 1] !== '\u0000' && draft[draftStart - 1] === corpus.text[sourceStart - 1]) { draftStart--; sourceStart-- }
    let draftEnd = position + minPhraseChars
    let sourceEnd = sourceIndex + minPhraseChars
    while (draftEnd < draft.length && sourceEnd < corpus.text.length && corpus.text[sourceEnd] !== '\u0000' && draft[draftEnd] === corpus.text[sourceEnd]) { draftEnd++; sourceEnd++ }
    const span = corpus.spans.find(item => sourceStart >= item.start && sourceEnd <= item.end)
    if (span === undefined) { position += stride; continue }
    const sourceSlice = corpus.text.slice(sourceStart, sourceEnd)
    const fingerprint = createHash('sha256').update(sourceSlice).digest('hex').slice(0, 16)
    if (!seen.has(fingerprint)) {
      seen.add(fingerprint)
      const overlap = draft.slice(draftStart, draftEnd)
      findings.push({
        draftExcerpt: overlap.length <= 72 ? overlap : `${overlap.slice(0, 69)}…`,
        overlapChars: overlap.length,
        ...(span.chapter <= cutoff ? { sourceChapter: span.chapter } : {}),
        beyondCutoff: span.chapter > cutoff,
        sourceFingerprint: fingerprint,
      })
    }
    position = Math.max(position + stride, draftEnd)
  }
  return findings
}

function meaningfulCharacterCount(value: string): number { return value.match(/[\p{L}\p{N}]/gu)?.length ?? 0 }
function countTextOccurrences(text: string, term: string): number { if (term.length === 0) return 0; let count = 0; let offset = 0; while ((offset = text.indexOf(term, offset)) >= 0) { count++; offset += term.length } return count }
function average(values: readonly number[]): number { return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length }
function median(values: readonly number[]): number { if (values.length === 0) return 0; const sorted = [...values].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2); return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]! }

function parseManifest(value: unknown): CanonPackManifest {
  const record = objectRecord(value, 'manifest')
  return {
    schemaVersion: positiveSafeInteger(record['schemaVersion'], 'manifest.schemaVersion'),
    canonPackId: nonEmpty(record['canonPackId'], 'manifest.canonPackId'),
    graphVersion: nonNegativeSafeInteger(record['graphVersion'] ?? 0, 'manifest.graphVersion'),
  }
}

function parseSource(value: unknown): CanonPackSource {
  const record = objectRecord(value, 'source')
  return {
    title: nonEmpty(record['title'], 'source.title'),
    creator: typeof record['creator'] === 'string' ? record['creator'] : '',
    sha256: sha256(record['sha256'], 'source.sha256'),
    chapterCount: positiveSafeInteger(record['chapterCount'], 'source.chapterCount'),
  }
}

function parseChapter(value: unknown, label: string): CanonChapter {
  const record = objectRecord(value, label)
  return {
    index: positiveSafeInteger(record['index'], `${label}.index`),
    title: nonEmpty(record['title'], `${label}.title`),
    ...(record['part'] === null || typeof record['part'] === 'string' ? { part: record['part'] } : {}),
    href: nonEmpty(record['href'], `${label}.href`),
    sha256: sha256(record['sha256'], `${label}.sha256`),
    text: typeof record['text'] === 'string' ? record['text'] : '',
  }
}

function parseFact(value: unknown, label: string): CanonFact {
  const record = objectRecord(value, label)
  return {
    id: nonEmpty(record['id'], `${label}.id`),
    subject: nonEmpty(record['subject'], `${label}.subject`),
    predicate: nonEmpty(record['predicate'], `${label}.predicate`),
    object: jsonValue(record['object'], `${label}.object`),
    validFromChapter: positiveSafeInteger(record['validFromChapter'], `${label}.validFromChapter`),
    ...optionalPositiveInteger(record['validUntilChapter'], `${label}.validUntilChapter`, 'validUntilChapter'),
    ...optionalPositiveInteger(record['revealFromChapter'], `${label}.revealFromChapter`, 'revealFromChapter'),
    ...optionalStringArray(record['aliases'], `${label}.aliases`, 'aliases'),
    ...(record['confidence'] === undefined ? {} : { confidence: finiteNumber(record['confidence'], `${label}.confidence`) }),
    provenance: parseProvenance(record['provenance'], `${label}.provenance`),
  }
}

function parseKnowledge(value: unknown, label: string): CanonKnowledge {
  const record = objectRecord(value, label)
  const stance = record['stance']
  if (stance !== 'knows' && stance !== 'suspects' && stance !== 'believes-false') throw new Error(`${label}.stance is invalid`)
  return {
    id: nonEmpty(record['id'], `${label}.id`),
    character: nonEmpty(record['character'], `${label}.character`),
    factId: nonEmpty(record['factId'], `${label}.factId`),
    stance,
    knownFromChapter: positiveSafeInteger(record['knownFromChapter'], `${label}.knownFromChapter`),
    ...optionalPositiveInteger(record['knownUntilChapter'], `${label}.knownUntilChapter`, 'knownUntilChapter'),
    ...(record['provenance'] === undefined ? {} : { provenance: parseProvenance(record['provenance'], `${label}.provenance`) }),
  }
}

function parseCharacter(value: unknown, label: string): CanonCharacterState {
  const record = objectRecord(value, label)
  return {
    id: nonEmpty(record['id'], `${label}.id`),
    name: nonEmpty(record['name'], `${label}.name`),
    ...optionalStringArray(record['aliases'], `${label}.aliases`, 'aliases'),
    validFromChapter: positiveSafeInteger(record['validFromChapter'], `${label}.validFromChapter`),
    ...optionalPositiveInteger(record['validUntilChapter'], `${label}.validUntilChapter`, 'validUntilChapter'),
    ...optionalString(record['realm'], 'realm'),
    ...optionalString(record['location'], 'location'),
    ...optionalStringArray(record['affiliations'], `${label}.affiliations`, 'affiliations'),
    ...optionalStringArray(record['goals'], `${label}.goals`, 'goals'),
    ...optionalStringArray(record['traits'], `${label}.traits`, 'traits'),
    ...optionalStringArray(record['ideology'], `${label}.ideology`, 'ideology'),
    ...optionalStringArray(record['values'], `${label}.values`, 'values'),
    ...optionalStringArray(record['fears'], `${label}.fears`, 'fears'),
    ...optionalStringArray(record['redLines'], `${label}.redLines`, 'redLines'),
    ...optionalStringArray(record['decisionRules'], `${label}.decisionRules`, 'decisionRules'),
    ...optionalStringArray(record['voiceNotes'], `${label}.voiceNotes`, 'voiceNotes'),
    ...optionalStringArray(record['emotionalState'], `${label}.emotionalState`, 'emotionalState'),
    ...optionalStringArray(record['techniques'], `${label}.techniques`, 'techniques'),
    ...optionalStringArray(record['possessions'], `${label}.possessions`, 'possessions'),
    ...optionalStringArray(record['injuries'], `${label}.injuries`, 'injuries'),
    ...(record['provenance'] === undefined ? {} : { provenance: parseProvenance(record['provenance'], `${label}.provenance`) }),
  }
}

function parseIdentity(value: unknown, label: string): CanonIdentityEdge {
  const record = objectRecord(value, label)
  return {
    id: nonEmpty(record['id'], `${label}.id`),
    subject: nonEmpty(record['subject'], `${label}.subject`),
    relation: nonEmpty(record['relation'], `${label}.relation`),
    object: nonEmpty(record['object'], `${label}.object`),
    validFromChapter: positiveSafeInteger(record['validFromChapter'], `${label}.validFromChapter`),
    ...optionalPositiveInteger(record['validUntilChapter'], `${label}.validUntilChapter`, 'validUntilChapter'),
    ...optionalPositiveInteger(record['revealFromChapter'], `${label}.revealFromChapter`, 'revealFromChapter'),
    provenance: parseProvenance(record['provenance'], `${label}.provenance`),
  }
}

function parsePower(value: unknown, label: string): CanonPowerState {
  const record = objectRecord(value, label)
  return {
    id: nonEmpty(record['id'], `${label}.id`),
    subject: nonEmpty(record['subject'], `${label}.subject`),
    validFromChapter: positiveSafeInteger(record['validFromChapter'], `${label}.validFromChapter`),
    ...optionalPositiveInteger(record['validUntilChapter'], `${label}.validUntilChapter`, 'validUntilChapter'),
    ...optionalString(record['realm'], 'realm'),
    ...optionalStringArray(record['capabilities'], `${label}.capabilities`, 'capabilities'),
    ...optionalStringArray(record['techniques'], `${label}.techniques`, 'techniques'),
    ...optionalStringArray(record['artifacts'], `${label}.artifacts`, 'artifacts'),
    ...optionalStringArray(record['demonstratedFeats'], `${label}.demonstratedFeats`, 'demonstratedFeats'),
    ...optionalStringArray(record['prerequisites'], `${label}.prerequisites`, 'prerequisites'),
    ...optionalStringArray(record['constraints'], `${label}.constraints`, 'constraints'),
    ...optionalStringArray(record['exceptions'], `${label}.exceptions`, 'exceptions'),
    ...(record['provenance'] === undefined ? {} : { provenance: parseProvenance(record['provenance'], `${label}.provenance`) }),
  }
}

function parseRelationship(value: unknown, label: string): CanonRelationshipState {
  const record = objectRecord(value, label)
  return {
    id: nonEmpty(record['id'], `${label}.id`),
    subject: nonEmpty(record['subject'], `${label}.subject`),
    object: nonEmpty(record['object'], `${label}.object`),
    validFromChapter: positiveSafeInteger(record['validFromChapter'], `${label}.validFromChapter`),
    ...optionalPositiveInteger(record['validUntilChapter'], `${label}.validUntilChapter`, 'validUntilChapter'),
    ...optionalString(record['relation'], 'relation'),
    ...optionalString(record['publicState'], 'publicState'),
    ...optionalString(record['privateState'], 'privateState'),
    ...(record['provenance'] === undefined ? {} : { provenance: parseProvenance(record['provenance'], `${label}.provenance`) }),
  }
}

function parseMystery(value: unknown, label: string): CanonMystery {
  const record = objectRecord(value, label)
  const cluesValue = record['clues']
  let clues: { chapter: number; summary: string }[] | undefined
  if (cluesValue !== undefined) {
    if (!Array.isArray(cluesValue)) throw new Error(`${label}.clues must be an array`)
    clues = cluesValue.map((item, index) => {
      const clue = objectRecord(item, `${label}.clues[${index}]`)
      return { chapter: positiveSafeInteger(clue['chapter'], `${label}.clues[${index}].chapter`), summary: nonEmpty(clue['summary'], `${label}.clues[${index}].summary`) }
    })
  }
  return {
    id: nonEmpty(record['id'], `${label}.id`),
    label: nonEmpty(record['label'], `${label}.label`),
    revealChapter: positiveSafeInteger(record['revealChapter'], `${label}.revealChapter`),
    ...optionalStringArray(record['forbiddenBeforeReveal'], `${label}.forbiddenBeforeReveal`, 'forbiddenBeforeReveal'),
    ...(clues === undefined ? {} : { clues }),
    ...(record['provenance'] === undefined ? {} : { provenance: parseProvenance(record['provenance'], `${label}.provenance`) }),
  }
}

function parseEvent(value: unknown, label: string): CanonEvent {
  const record = objectRecord(value, label)
  return {
    id: nonEmpty(record['id'], `${label}.id`),
    chapter: positiveSafeInteger(record['chapter'], `${label}.chapter`),
    ...optionalPositiveInteger(record['orderInChapter'], `${label}.orderInChapter`, 'orderInChapter'),
    summary: nonEmpty(record['summary'], `${label}.summary`),
    ...optionalStringArray(record['participants'], `${label}.participants`, 'participants'),
    ...optionalStringArray(record['dependencies'], `${label}.dependencies`, 'dependencies'),
    ...optionalStringArray(record['consequences'], `${label}.consequences`, 'consequences'),
    ...(record['provenance'] === undefined ? {} : { provenance: parseProvenance(record['provenance'], `${label}.provenance`) }),
  }
}

function parseTimelineRule(value: unknown, label: string): CanonTimelineRule {
  const record = objectRecord(value, label)
  return {
    id: nonEmpty(record['id'], `${label}.id`),
    validFromChapter: positiveSafeInteger(record['validFromChapter'], `${label}.validFromChapter`),
    ...optionalPositiveInteger(record['validUntilChapter'], `${label}.validUntilChapter`, 'validUntilChapter'),
    ...optionalString(record['worldline'], 'worldline'),
    rule: nonEmpty(record['rule'], `${label}.rule`),
    ...optionalStringArray(record['effects'], `${label}.effects`, 'effects'),
    ...(record['provenance'] === undefined ? {} : { provenance: parseProvenance(record['provenance'], `${label}.provenance`) }),
  }
}

function parseCausalLink(value: unknown, label: string): CanonCausalLink {
  const record = objectRecord(value, label)
  return {
    id: nonEmpty(record['id'], `${label}.id`),
    introducedByChapter: positiveSafeInteger(record['introducedByChapter'], `${label}.introducedByChapter`),
    cause: nonEmpty(record['cause'], `${label}.cause`),
    effect: nonEmpty(record['effect'], `${label}.effect`),
    ...optionalString(record['mechanism'], 'mechanism'),
    ...(record['confidence'] === undefined ? {} : { confidence: finiteNumber(record['confidence'], `${label}.confidence`) }),
    ...(record['provenance'] === undefined ? {} : { provenance: parseProvenance(record['provenance'], `${label}.provenance`) }),
  }
}

function parseProvenance(value: unknown, label: string): CanonProvenance {
  const record = objectRecord(value, label)
  return {
    sourceSha256: sha256(record['sourceSha256'], `${label}.sourceSha256`),
    chapter: positiveSafeInteger(record['chapter'], `${label}.chapter`),
    ...optionalNamedString(record['eventId'], `${label}.eventId`, 'eventId'),
    ...optionalPositiveInteger(record['eventOrdinal'], `${label}.eventOrdinal`, 'eventOrdinal'),
    ...optionalNamedString(record['sceneId'], `${label}.sceneId`, 'sceneId'),
    ...(typeof record['chapterSha256'] === 'string' ? { chapterSha256: sha256(record['chapterSha256'], `${label}.chapterSha256`) } : {}),
    ...optionalString(record['href'], 'href'),
    ...optionalString(record['excerpt'], 'excerpt'),
  }
}


function materializeCausalThreadStatus(threads: readonly FanficCausalThread[], versions: readonly FanficChapterVersion[]): FanficCausalThread[] {
  const resolvedAt = new Map<string, string>()
  for (const version of versions) {
    if (version.status !== 'active') continue
    for (const id of version.resolvedCausalThreadIds) resolvedAt.set(id, version.createdAt)
  }
  return threads.map(thread => {
    const at = resolvedAt.get(thread.id)
    if (at !== undefined) return { ...thread, status: 'resolved' as const, resolvedAt: at }
    const { resolvedAt: _resolvedAt, ...open } = thread
    return { ...open, status: 'open' as const }
  })
}

function branchView(branch: FanficBranch, fanficChapter: number | undefined, excludeCurrentChapter = false): FanficBranch {
  const cutoff = fanficChapter === undefined ? undefined : positiveSafeInteger(fanficChapter, 'fanficChapter')
  const activeVersionIds = new Set(branch.chapterVersions.filter(version => version.status === 'active').map(version => version.id))
  const versionVisible = (originChapter: number, versionId: string): boolean => {
    if (!activeVersionIds.has(versionId)) return false
    if (cutoff === undefined) return true
    return excludeCurrentChapter ? originChapter < cutoff : originChapter <= cutoff
  }
  const visibleVersions = branch.chapterVersions.filter(version => version.status === 'active' && (cutoff === undefined || (excludeCurrentChapter ? version.fanficChapter < cutoff : version.fanficChapter <= cutoff)))
  const visibleVersionIds = new Set(visibleVersions.map(version => version.id))
  const visibleCausalThreads = branch.causalThreads.filter(item => visibleVersionIds.has(item.originChapterVersionId)
    && (cutoff === undefined || item.fromFanficChapter <= cutoff))
  const causalThreads = materializeCausalThreadStatus(visibleCausalThreads, visibleVersions)
  return {
    ...branch,
    chapterVersions: visibleVersions,
    facts: branch.facts.filter(item => versionVisible(item.originFanficChapter, item.originChapterVersionId)
      && (cutoff === undefined || (item.validFromFanficChapter <= cutoff && (item.validUntilFanficChapter === undefined || cutoff <= item.validUntilFanficChapter)))),
    knowledge: branch.knowledge.filter(item => versionVisible(item.originFanficChapter, item.originChapterVersionId)
      && (cutoff === undefined || item.fromFanficChapter <= cutoff)),
    characterStates: branch.characterStates.filter(item => versionVisible(item.originFanficChapter, item.originChapterVersionId)
      && (cutoff === undefined || item.fromFanficChapter <= cutoff)),
    relationships: branch.relationships.filter(item => versionVisible(item.originFanficChapter, item.originChapterVersionId)
      && (cutoff === undefined || item.fromFanficChapter <= cutoff)),
    causalThreads,
    chapterSummaries: branch.chapterSummaries.filter(item => activeVersionIds.has(item.chapterVersionId)
      && (cutoff === undefined || (excludeCurrentChapter ? item.fanficChapter < cutoff : item.fanficChapter <= cutoff))),
  }
}

function parseBranch(value: unknown): FanficBranch {
  const record = objectRecord(value, 'branch')
  if (record['version'] !== 3) throw new Error(`unsupported fanfic branch version ${JSON.stringify(record['version'])}; v0.7 requires a fresh branch format v3 state directory`)
  const id = nonEmpty(record['id'], 'branch.id')
  validateBranchId(id)
  const divergences = parseArray(record['divergences'], 'branch.divergences', parseStoredDivergence)
  const chapterVersions = parseArray(record['chapterVersions'], 'branch.chapterVersions', parseChapterVersion)
  const activeByChapter = new Map<number, string>()
  for (const version of chapterVersions) {
    if (version.status !== 'active') continue
    if (activeByChapter.has(version.fanficChapter)) throw new Error(`branch has multiple active chapter versions for fanfic chapter ${version.fanficChapter}`)
    activeByChapter.set(version.fanficChapter, version.id)
  }
  const facts = parseArray(record['facts'], 'branch.facts', parseStoredFact)
  const knowledge = parseArray(record['knowledge'], 'branch.knowledge', parseStoredKnowledge)
  const characterStates = parseArray(record['characterStates'], 'branch.characterStates', parseStoredCharacter)
  const relationships = parseArray(record['relationships'], 'branch.relationships', parseStoredRelationship)
  const causalThreads = parseArray(record['causalThreads'], 'branch.causalThreads', parseStoredThread)
  assertUniqueIds(causalThreads, 'branch.causalThreads')
  const causalThreadIds = new Set(causalThreads.map(item => item.id))
  for (const version of chapterVersions) {
    for (const id of version.resolvedCausalThreadIds) {
      const thread = causalThreads.find(item => item.id === id)
      if (!causalThreadIds.has(id) || thread === undefined) throw new Error(`chapter version ${version.id} resolves unknown causal thread ${JSON.stringify(id)}`)
      if (thread.fromFanficChapter > version.fanficChapter) throw new Error(`chapter version ${version.id} resolves causal thread ${JSON.stringify(id)} before it exists`)
    }
  }
  const chapterSummaries = parseArray(record['chapterSummaries'], 'branch.chapterSummaries', parseChapterSummary)
  const knownVersionIds = new Set(chapterVersions.map(item => item.id))
  for (const item of [...facts, ...knowledge, ...characterStates, ...relationships, ...causalThreads]) {
    if (!knownVersionIds.has(item.originChapterVersionId)) throw new Error(`branch record references unknown chapter version ${JSON.stringify(item.originChapterVersionId)}`)
  }
  for (const item of chapterSummaries) if (!knownVersionIds.has(item.chapterVersionId)) throw new Error(`chapter summary references unknown chapter version ${JSON.stringify(item.chapterVersionId)}`)
  return {
    version: 3,
    id: FanficBranchId(id),
    name: nonEmpty(record['name'], 'branch.name'),
    baseChapter: positiveSafeInteger(record['baseChapter'], 'branch.baseChapter'),
    revision: positiveSafeInteger(record['revision'], 'branch.revision'),
    notes: typeof record['notes'] === 'string' ? record['notes'] : '',
    authorIntent: normalizeAuthorIntent(record['authorIntent']),
    storyDirector: normalizeStoryDirector(record['storyDirector'] ?? {}),
    createdAt: isoDate(record['createdAt'], 'branch.createdAt'),
    updatedAt: isoDate(record['updatedAt'], 'branch.updatedAt'),
    divergences,
    chapterVersions,
    facts,
    knowledge,
    characterStates,
    relationships,
    causalThreads,
    chapterSummaries,
  }
}

function parseChapterVersion(value: unknown, label: string): FanficChapterVersion {
  const record = objectRecord(value, label)
  const status = enumString(record['status'], `${label}.status`, ['active', 'superseded'] as const)
  return {
    id: nonEmpty(record['id'], `${label}.id`),
    fanficChapter: positiveSafeInteger(record['fanficChapter'], `${label}.fanficChapter`),
    status,
    rewriteMode: enumString(record['rewriteMode'] ?? 'initial', `${label}.rewriteMode`, ['initial', 'inherit', 'replace'] as const),
    ...optionalNamedString(record['replacesVersionId'], `${label}.replacesVersionId`, 'replacesVersionId'),
    resolvedCausalThreadIds: uniqueStrings(stringArray(record['resolvedCausalThreadIds'] ?? [], `${label}.resolvedCausalThreadIds`)),
    draftId: validateDraftId(record['draftId']),
    draftHash: nonEmpty(record['draftHash'], `${label}.draftHash`),
    createdAt: isoDate(record['createdAt'], `${label}.createdAt`),
    ...(record['supersededAt'] === undefined ? {} : { supersededAt: isoDate(record['supersededAt'], `${label}.supersededAt`) }),
  }
}

function parseChapterSummary(value: unknown, label: string): FanficChapterSummary {
  const record = objectRecord(value, label)
  return {
    fanficChapter: positiveSafeInteger(record['fanficChapter'], `${label}.fanficChapter`),
    chapterVersionId: nonEmpty(record['chapterVersionId'], `${label}.chapterVersionId`),
    summary: nonEmpty(record['summary'], `${label}.summary`),
    recordedAt: isoDate(record['recordedAt'], `${label}.recordedAt`),
  }
}

function parseStoredDivergence(value: unknown, label: string): FanficDivergence {
  const record = objectRecord(value, label)
  return {
    id: nonEmpty(record['id'], `${label}.id`),
    atChapter: positiveSafeInteger(record['atChapter'], `${label}.atChapter`),
    ...optionalPositiveInteger(record['eventOrdinal'], `${label}.eventOrdinal`, 'eventOrdinal'),
    ...optionalNamedString(record['afterEventId'], `${label}.afterEventId`, 'afterEventId'),
    ...optionalNamedString(record['sceneId'], `${label}.sceneId`, 'sceneId'),
    summary: nonEmpty(record['summary'], `${label}.summary`),
    immediateConsequences: stringArray(record['immediateConsequences'], `${label}.immediateConsequences`),
    openQuestions: stringArray(record['openQuestions'], `${label}.openQuestions`),
    recordedAt: isoDate(record['recordedAt'], `${label}.recordedAt`),
  }
}

function parseStoredFact(value: unknown, label: string): FanficOverlayFact {
  const record = objectRecord(value, label)
  return {
    id: nonEmpty(record['id'], `${label}.id`), originFanficChapter: positiveSafeInteger(record['originFanficChapter'], `${label}.originFanficChapter`), originChapterVersionId: nonEmpty(record['originChapterVersionId'], `${label}.originChapterVersionId`), subject: nonEmpty(record['subject'], `${label}.subject`), predicate: nonEmpty(record['predicate'], `${label}.predicate`), object: jsonValue(record['object'], `${label}.object`),
    validFromFanficChapter: positiveSafeInteger(record['validFromFanficChapter'], `${label}.validFromFanficChapter`),
    ...optionalPositiveInteger(record['validUntilFanficChapter'], `${label}.validUntilFanficChapter`, 'validUntilFanficChapter'),
    recordedAt: isoDate(record['recordedAt'], `${label}.recordedAt`),
  }
}

function parseStoredKnowledge(value: unknown, label: string): FanficOverlayKnowledge {
  const record = objectRecord(value, label)
  const stance = record['stance']
  if (stance !== 'knows' && stance !== 'suspects' && stance !== 'believes-false') throw new Error(`${label}.stance is invalid`)
  return {
    id: nonEmpty(record['id'], `${label}.id`),
    originFanficChapter: positiveSafeInteger(record['originFanficChapter'], `${label}.originFanficChapter`),
    originChapterVersionId: nonEmpty(record['originChapterVersionId'], `${label}.originChapterVersionId`),
    character: nonEmpty(record['character'], `${label}.character`),
    ...optionalNamedString(record['subject'], `${label}.subject`, 'subject'),
    ...optionalNamedString(record['predicate'], `${label}.predicate`, 'predicate'),
    ...optionalNamedString(record['object'], `${label}.object`, 'object'),
    summary: nonEmpty(record['summary'], `${label}.summary`),
    stance,
    fromFanficChapter: positiveSafeInteger(record['fromFanficChapter'], `${label}.fromFanficChapter`),
    recordedAt: isoDate(record['recordedAt'], `${label}.recordedAt`),
  }
}

function parseStoredCharacter(value: unknown, label: string): FanficOverlayCharacterState {
  const record = objectRecord(value, label)
  return { id: nonEmpty(record['id'], `${label}.id`), originFanficChapter: positiveSafeInteger(record['originFanficChapter'], `${label}.originFanficChapter`), originChapterVersionId: nonEmpty(record['originChapterVersionId'], `${label}.originChapterVersionId`), character: nonEmpty(record['character'], `${label}.character`), summary: nonEmpty(record['summary'], `${label}.summary`), fromFanficChapter: positiveSafeInteger(record['fromFanficChapter'], `${label}.fromFanficChapter`), recordedAt: isoDate(record['recordedAt'], `${label}.recordedAt`) }
}

function parseStoredRelationship(value: unknown, label: string): FanficOverlayRelationship {
  const record = objectRecord(value, label)
  return { id: nonEmpty(record['id'], `${label}.id`), originFanficChapter: positiveSafeInteger(record['originFanficChapter'], `${label}.originFanficChapter`), originChapterVersionId: nonEmpty(record['originChapterVersionId'], `${label}.originChapterVersionId`), subject: nonEmpty(record['subject'], `${label}.subject`), object: nonEmpty(record['object'], `${label}.object`), summary: nonEmpty(record['summary'], `${label}.summary`), fromFanficChapter: positiveSafeInteger(record['fromFanficChapter'], `${label}.fromFanficChapter`), recordedAt: isoDate(record['recordedAt'], `${label}.recordedAt`) }
}

function parseStoredThread(value: unknown, label: string): FanficCausalThread {
  const record = objectRecord(value, label)
  const status = record['status']
  if (status !== 'open' && status !== 'resolved') throw new Error(`${label}.status is invalid`)
  return { id: nonEmpty(record['id'], `${label}.id`), originFanficChapter: positiveSafeInteger(record['originFanficChapter'], `${label}.originFanficChapter`), originChapterVersionId: nonEmpty(record['originChapterVersionId'], `${label}.originChapterVersionId`), summary: nonEmpty(record['summary'], `${label}.summary`), status, fromFanficChapter: positiveSafeInteger(record['fromFanficChapter'], `${label}.fromFanficChapter`), recordedAt: isoDate(record['recordedAt'], `${label}.recordedAt`), ...(record['resolvedAt'] === undefined ? {} : { resolvedAt: isoDate(record['resolvedAt'], `${label}.resolvedAt`) }) }
}


function normalizeDelta(delta: FanficStateDelta): FanficStateDelta {
  const fanficChapter = positiveSafeInteger(delta.fanficChapter, 'delta.fanficChapter')
  return {
    fanficChapter,
    ...(delta.chapterSummary === undefined ? {} : { chapterSummary: nonEmpty(delta.chapterSummary, 'delta.chapterSummary') }),
    ...(delta.facts === undefined ? {} : { facts: delta.facts.map((item, index) => ({ subject: nonEmpty(item.subject, `delta.facts[${index}].subject`), predicate: nonEmpty(item.predicate, `delta.facts[${index}].predicate`), object: jsonValue(item.object, `delta.facts[${index}].object`), validFromFanficChapter: positiveSafeInteger(item.validFromFanficChapter, `delta.facts[${index}].validFromFanficChapter`), ...(item.validUntilFanficChapter === undefined ? {} : { validUntilFanficChapter: positiveSafeInteger(item.validUntilFanficChapter, `delta.facts[${index}].validUntilFanficChapter`) }) })) }),
    ...(delta.knowledge === undefined ? {} : { knowledge: delta.knowledge.map((item, index) => ({
      character: nonEmpty(item.character, `delta.knowledge[${index}].character`),
      ...(item.subject === undefined ? {} : { subject: nonEmpty(item.subject, `delta.knowledge[${index}].subject`) }),
      ...(item.predicate === undefined ? {} : { predicate: nonEmpty(item.predicate, `delta.knowledge[${index}].predicate`) }),
      ...(item.object === undefined ? {} : { object: nonEmpty(item.object, `delta.knowledge[${index}].object`) }),
      summary: nonEmpty(item.summary, `delta.knowledge[${index}].summary`),
      stance: item.stance,
      fromFanficChapter: positiveSafeInteger(item.fromFanficChapter, `delta.knowledge[${index}].fromFanficChapter`),
    })) }),
    ...(delta.characterStates === undefined ? {} : { characterStates: delta.characterStates.map((item, index) => ({ character: nonEmpty(item.character, `delta.characterStates[${index}].character`), summary: nonEmpty(item.summary, `delta.characterStates[${index}].summary`), fromFanficChapter: positiveSafeInteger(item.fromFanficChapter, `delta.characterStates[${index}].fromFanficChapter`) })) }),
    ...(delta.relationships === undefined ? {} : { relationships: delta.relationships.map((item, index) => ({ subject: nonEmpty(item.subject, `delta.relationships[${index}].subject`), object: nonEmpty(item.object, `delta.relationships[${index}].object`), summary: nonEmpty(item.summary, `delta.relationships[${index}].summary`), fromFanficChapter: positiveSafeInteger(item.fromFanficChapter, `delta.relationships[${index}].fromFanficChapter`) })) }),
    ...(delta.causalThreads === undefined ? {} : { causalThreads: delta.causalThreads.map((item, index) => ({ summary: nonEmpty(item.summary, `delta.causalThreads[${index}].summary`), status: item.status, fromFanficChapter: positiveSafeInteger(item.fromFanficChapter, `delta.causalThreads[${index}].fromFanficChapter`) })) }),
    ...(delta.resolveCausalThreadIds === undefined ? {} : { resolveCausalThreadIds: uniqueStrings(delta.resolveCausalThreadIds) }),
  }
}

function validateClaim(
  claim: FanficAuditClaim,
  snapshot: CanonSnapshot,
  pack: LoadedCanonPack,
  canonCutoff: number,
  requestedCutoff: number,
  branch: FanficBranch | undefined,
  povCharacter: string,
): FanficAuditIssue | undefined {
  const counterfactualCanon = canonCutoff < requestedCutoff
  switch (claim.kind) {
    case 'knowledge': {
      const branchKnowledge = matchingBranchKnowledge(branch, povCharacter, claim)
      if (branchKnowledge.some(record => record.stance === 'knows')) return undefined
      if (branchKnowledge.length > 0) {
        return {
          severity: 'error',
          code: 'POV_BRANCH_KNOWLEDGE_NOT_KNOWN',
          message: `Branch state records ${povCharacter} as ${branchKnowledge.map(record => record.stance).join('/')} rather than knowing this claim.`,
          claim,
        }
      }

      const matchingFacts = snapshot.facts.filter(fact => factMatchesClaim(fact, claim))
      if (matchingFacts.length === 0) {
        const hidden = pack.facts.some(fact => factMatchesClaim(fact, claim)
          && fact.validFromChapter <= requestedCutoff
          && fact.revealFromChapter !== undefined
          && fact.revealFromChapter > canonCutoff)
        if (hidden) {
          return counterfactualCanon
            ? { severity: 'error', code: 'POV_BRANCH_KNOWLEDGE_UNESTABLISHED', message: `Later canon contains this information, but canon after chapter ${canonCutoff} is counterfactual for this branch and cannot establish ${povCharacter}'s knowledge.`, claim }
            : { severity: 'error', code: 'POV_FUTURE_KNOWLEDGE_LEAK', message: `Claim about ${claim.subject} depends on canon truth not revealed by chapter ${canonCutoff}.`, claim }
        }
        if (branchFactMatchesClaim(branch, claim)) {
          return { severity: 'error', code: 'POV_BRANCH_KNOWLEDGE_UNESTABLISHED', message: `The branch establishes the world fact about ${claim.subject}, but no branch epistemic record says ${povCharacter} knows it.`, claim }
        }
        return { severity: 'warning', code: 'POV_KNOWLEDGE_UNVERIFIED', message: `No visible structured fact or structured branch knowledge verifies POV knowledge about ${claim.subject}; inspect source or branch evidence.`, claim }
      }
      const knownFactIds = new Set(snapshot.povKnowledge.filter(record => record.stance === 'knows').map(record => record.factId))
      if (matchingFacts.every(fact => !knownFactIds.has(fact.id))) {
        return { severity: 'error', code: 'POV_KNOWLEDGE_LEAK', message: `POV has no structured knowledge record for claim about ${claim.subject}.`, claim }
      }
      return undefined
    }
    case 'canon-fact': {
      if (branchFactMatchesClaim(branch, claim)) return undefined
      if (snapshot.facts.some(fact => factMatchesClaim(fact, claim))) return undefined
      const hidden = pack.facts.some(fact => factMatchesClaim(fact, claim)
        && fact.validFromChapter <= requestedCutoff
        && (fact.revealFromChapter ?? fact.validFromChapter) > canonCutoff)
      if (hidden) {
        return counterfactualCanon
          ? { severity: 'warning', code: 'COUNTERFACTUAL_CANON_FACT_UNESTABLISHED', message: `Later canon supports this fact, but canon after chapter ${canonCutoff} is counterfactual for the branch. Persist branch evidence before treating it as true.`, claim }
          : { severity: 'error', code: 'PREMATURE_CANON_FACT_REVEAL', message: `Canon fact about ${claim.subject} exists but is not revealed by chapter ${canonCutoff}.`, claim }
      }
      return { severity: 'warning', code: 'CANON_FACT_UNVERIFIED', message: `No structured canon or branch fact verifies claim about ${claim.subject}; inspect source evidence.`, claim }
    }
    case 'identity': {
      if (branchIdentityMatchesClaim(branch, claim)) return undefined
      if (snapshot.identities.some(edge => identityMatchesClaim(edge, claim))) return undefined
      const hidden = pack.identities.some(edge => identityMatchesClaim(edge, claim)
        && edge.validFromChapter <= requestedCutoff
        && (edge.revealFromChapter ?? edge.validFromChapter) > canonCutoff)
      if (hidden) {
        return counterfactualCanon
          ? { severity: 'warning', code: 'COUNTERFACTUAL_IDENTITY_UNESTABLISHED', message: `Later canon reveals this identity, but that reveal is counterfactual after branch divergence. Persist a branch identity fact before using it as established truth.`, claim }
          : { severity: 'error', code: 'PREMATURE_IDENTITY_REVEAL', message: `Identity claim about ${claim.subject} is a future reveal at this cutoff.`, claim }
      }
      return { severity: 'warning', code: 'IDENTITY_UNVERIFIED', message: `No revealed canon identity edge or structured branch fact verifies claim about ${claim.subject}.`, claim }
    }
    case 'power': {
      if (branchPowerMatchesClaim(branch, claim)) return undefined
      if (snapshot.powers.some(power => powerMatchesClaim(power, claim))) return undefined
      const future = pack.powers.some(power => powerMatchesClaim(power, claim) && power.validFromChapter > canonCutoff && power.validFromChapter <= requestedCutoff)
      if (future) {
        return counterfactualCanon
          ? { severity: 'warning', code: 'COUNTERFACTUAL_POWER_UNESTABLISHED', message: `Later canon supports this power claim, but it is not binding after branch divergence. Persist the changed branch capability before relying on it.`, claim }
          : { severity: 'error', code: 'PREMATURE_POWER_CLAIM', message: `Power claim about ${claim.subject} is only supported by later canon.`, claim }
      }
      return { severity: 'warning', code: 'POWER_UNVERIFIED', message: `No structured canon or branch power record verifies claim about ${claim.subject}.`, claim }
    }
  }
}

function preciseDivergenceBoundary(divergence: FanficDivergence): number | undefined { return divergence.eventOrdinal }

function earliestDivergencePoint(branch: FanficBranch): FanficDivergence | undefined {
  return [...branch.divergences].sort((a, b) => a.atChapter - b.atChapter || (a.eventOrdinal ?? 0) - (b.eventOrdinal ?? 0))[0]
}


function mergeAuditSnapshots(base: CanonSnapshot, supplement: CanonSnapshot): CanonSnapshot {
  const merge = <T extends { readonly id: string }>(left: readonly T[], right: readonly T[]): T[] => {
    const values = new Map(left.map(item => [item.id, item])); for (const item of right) values.set(item.id, item); return [...values.values()]
  }
  return {
    ...base,
    asOfChapter: Math.max(base.asOfChapter, supplement.asOfChapter),
    spoilerFirewall: supplement.spoilerFirewall,
    characterStates: merge(base.characterStates, supplement.characterStates), facts: merge(base.facts, supplement.facts),
    povKnowledge: merge(base.povKnowledge, supplement.povKnowledge), identities: merge(base.identities, supplement.identities), powers: merge(base.powers, supplement.powers),
    relationships: merge(base.relationships, supplement.relationships), mysteries: merge(base.mysteries, supplement.mysteries), events: merge(base.events, supplement.events),
    timelineRules: merge(base.timelineRules, supplement.timelineRules), causalLinks: merge(base.causalLinks, supplement.causalLinks), sourceExcerpts: base.sourceExcerpts,
  }
}

function extractDraftClaims(draft: string, entities: readonly string[]): FanficAuditClaim[] {
  const sentences = draft.match(/[^。！？!?\n]+[。！？!?]?/gu)?.map(item => item.trim()).filter(Boolean) ?? []
  const claims: FanficAuditClaim[] = []
  const push = (claim: FanficAuditClaim): void => { if (!claims.some(item => item.kind === claim.kind && sameName(item.subject, claim.subject) && item.object === claim.object)) claims.push(claim) }
  for (const sentence of sentences) {
    const subject = entities.find(entity => entity.length > 0 && sentence.includes(entity))
    if (subject === undefined) continue
    const excerpt = sentence.length > 96 ? `${sentence.slice(0, 96)}…` : sentence
    const explicitPower = /(施展|使出|催动|运转(?:真气|内力|功法|心法)|驱使|操纵|引动|发动(?:秘术|神通|阵法)|激发(?:神兵|法宝|符箓)|剑气|刀光|掌力|真气|内力|罡气|法相|神通|秘术|绝学)/u.test(sentence)
      || (/(封住|镇压|摄取|牵引|冻结|焚烧)/u.test(sentence) && /(白雾|黑线|真气|内力|剑气|刀光|气机|神兵|法宝|符|阵)/u.test(sentence))
    if (explicitPower) push({ kind: 'power', subject, object: excerpt })
    if (/(知道|明白|意识到|察觉|发现|认出|确认|看出|猜到)/u.test(sentence)) push({ kind: 'knowledge', subject, object: excerpt })
    const explicitIdentity = new RegExp(`${escapeRegExp(subject)}(?:真正)?(?:就是|乃是|其实是|原来是)|${escapeRegExp(subject)}(?:的)?真实身份`, 'u').test(sentence)
    if (explicitIdentity) push({ kind: 'identity', subject, object: excerpt })
    if (/(能够|可以|会让|会使|导致|意味着)/u.test(sentence) && !claims.some(item => item.object === excerpt)) push({ kind: 'canon-fact', subject, object: excerpt })
  }
  return claims
}

function escapeRegExp(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&') }

function auditClaimCovers(submitted: FanficAuditClaim, extracted: FanficAuditClaim): boolean {
  if (submitted.kind !== extracted.kind || !sameName(submitted.subject, extracted.subject)) return false
  if (submitted.object === undefined || extracted.object === undefined) return true
  return extracted.object.includes(submitted.object) || submitted.object.includes(extracted.object) || submitted.object.length >= 2
}

function matchingBranchKnowledge(branch: FanficBranch | undefined, povCharacter: string, claim: FanficAuditClaim): readonly FanficOverlayKnowledge[] {
  if (branch === undefined) return []
  return branch.knowledge.filter(record => sameName(record.character, povCharacter)
    && record.subject !== undefined
    && sameName(record.subject, claim.subject)
    && (claim.predicate === undefined || record.predicate === claim.predicate)
    && (claim.object === undefined || record.object === claim.object))
}

function branchFactMatchesClaim(branch: FanficBranch | undefined, claim: FanficAuditClaim): boolean {
  if (branch === undefined) return false
  return branch.facts.some(fact => sameName(fact.subject, claim.subject)
    && (claim.predicate === undefined || fact.predicate === claim.predicate)
    && (claim.object === undefined || jsonContains(fact.object, claim.object)))
}

function branchIdentityMatchesClaim(branch: FanficBranch | undefined, claim: FanficAuditClaim): boolean {
  if (branch === undefined) return false
  return branch.facts.some(fact => {
    if (!sameName(fact.subject, claim.subject)) return false
    if (claim.object !== undefined && !jsonContains(fact.object, claim.object)) return false
    if (claim.predicate !== undefined) return fact.predicate === claim.predicate
    const predicate = fact.predicate.toLowerCase()
    return predicate.includes('identity') || predicate.includes('alias') || predicate.includes('incarnation') || predicate.includes('consciousness') || predicate === 'is'
  })
}

function branchPowerMatchesClaim(branch: FanficBranch | undefined, claim: FanficAuditClaim): boolean {
  if (branch === undefined) return false
  return branch.facts.some(fact => {
    if (!sameName(fact.subject, claim.subject)) return false
    if (claim.object !== undefined && !jsonContains(fact.object, claim.object)) return false
    if (claim.predicate !== undefined) return fact.predicate === claim.predicate
    const predicate = fact.predicate.toLowerCase()
    return predicate.includes('power') || predicate.includes('realm') || predicate.includes('capability') || predicate.includes('technique')
  })
}

function branchEstablishesReveal(branch: FanficBranch | undefined, povCharacter: string, term: string): boolean {
  if (branch === undefined) return false
  const fact = branch.facts.find(record => {
    const objectText = typeof record.object === 'string' ? record.object : JSON.stringify(record.object)
    return `${record.subject} ${record.predicate} ${objectText}`.includes(term)
      || (term.includes(record.subject) && objectText.length > 0 && term.includes(objectText))
  })
  if (fact === undefined) return false
  return branch.knowledge.some(record => sameName(record.character, povCharacter)
    && record.stance === 'knows'
    && (
      `${record.subject ?? ''} ${record.predicate ?? ''} ${record.object ?? ''} ${record.summary}`.includes(term)
      || (record.subject !== undefined && sameName(record.subject, fact.subject)
        && (record.object === undefined || jsonContains(fact.object, record.object)))
    ))
}

function factMatchesClaim(fact: CanonFact, claim: FanficAuditClaim): boolean {
  return sameName(fact.subject, claim.subject)
    && (claim.predicate === undefined || fact.predicate === claim.predicate)
    && (claim.object === undefined || jsonContains(fact.object, claim.object))
}

function identityMatchesClaim(edge: CanonIdentityEdge, claim: FanficAuditClaim): boolean {
  return sameName(edge.subject, claim.subject) && (claim.object === undefined || sameName(edge.object, claim.object))
}

function powerMatchesClaim(power: CanonPowerState, claim: FanficAuditClaim): boolean {
  return sameName(power.subject, claim.subject)
    && (claim.object === undefined || power.realm === claim.object || (power.capabilities ?? []).some(capability => capability.includes(claim.object!)))
}

function jsonContains(value: FanficJsonValue, needle: string): boolean {
  return (typeof value === 'string' ? value : JSON.stringify(value)).includes(needle)
}

const DEFAULT_WRITING_CONTRACT: FanficWritingContract = {
  language: 'zh-CN',
  minHanChars: 2500,
  maxHanChars: 4000,
  defaultStyleMode: 'auto',
}

const DEFAULT_AUTHOR_INTENT: FanficAuthorIntent = {
  premise: '',
  divergenceMode: 'soft-divergence',
  themes: [],
  tone: [],
  povPolicy: [],
  characterPriorities: [],
  forbiddenOutcomes: [],
  styleNotes: [],
  writingContract: DEFAULT_WRITING_CONTRACT,
}

type CanonRecordWithProvenance = { readonly id: string; readonly provenance?: CanonProvenance }

function normalizeEnrichmentKind(value: unknown): CanonEnrichmentKind {
  if (typeof value !== 'string' || !ENRICHMENT_KINDS.includes(value as CanonEnrichmentKind)) {
    throw new Error(`invalid canon enrichment kind ${JSON.stringify(value)}`)
  }
  return value as CanonEnrichmentKind
}

function normalizeEnrichmentKinds(values: readonly CanonEnrichmentKind[]): CanonEnrichmentKind[] {
  if (!Array.isArray(values) || values.length === 0) throw new Error('kinds must contain at least one canon enrichment family')
  return [...new Set(values.map(normalizeEnrichmentKind))]
}

function coverageKey(chapter: number, kind: CanonEnrichmentKind): string { return `${chapter}:${kind}` }

function effectiveCoverage(rows: readonly CanonEnrichmentCoverage[]): Map<string, CanonEnrichmentCoverage> {
  const result = new Map<string, CanonEnrichmentCoverage>()
  for (const row of rows) result.set(coverageKey(row.chapter, row.kind), row)
  return result
}

function parseEnrichmentCoverage(value: unknown, label: string): CanonEnrichmentCoverage {
  const record = objectRecord(value, label)
  return {
    chapter: positiveSafeInteger(record['chapter'], `${label}.chapter`),
    kind: normalizeEnrichmentKind(record['kind']),
    sourceSha256: sha256(record['sourceSha256'], `${label}.sourceSha256`),
    chapterSha256: sha256(record['chapterSha256'], `${label}.chapterSha256`),
    recordIds: stringArray(record['recordIds'], `${label}.recordIds`),
    noFindings: booleanValue(record['noFindings'], `${label}.noFindings`),
    notes: typeof record['notes'] === 'string' ? record['notes'] : '',
    updatedAt: isoDate(record['updatedAt'], `${label}.updatedAt`),
  }
}

function recordsForKind(pack: LoadedCanonPack, kind: CanonEnrichmentKind): readonly CanonRecordWithProvenance[] {
  switch (kind) {
    case 'fact': return pack.facts
    case 'knowledge': return pack.knowledge
    case 'character': return pack.characters
    case 'identity': return pack.identities
    case 'power': return pack.powers
    case 'relationship': return pack.relationships
    case 'mystery': return pack.mysteries
    case 'event': return pack.events
    case 'timeline-rule': return pack.timelineRules
    case 'causal-link': return pack.causalLinks
  }
}

function recordProvenanceChapter(record: CanonRecordWithProvenance): number | undefined { return record.provenance?.chapter }

function emptyStoryDirector(): FanficStoryDirectorState { return { arcs: [], threads: [], foreshadows: [], horizon: [], mysteryTruths: [], inventions: [], reconciliation: [] } }

function normalizeStoryDirector(value: FanficStoryDirectorState | unknown): FanficStoryDirectorState {
  const record = value === undefined ? {} : objectRecord(value, 'storyDirector')
  const arcs = parseArray(record['arcs'] ?? [], 'storyDirector.arcs', parseStoryArc)
  const threads = parseArray(record['threads'] ?? [], 'storyDirector.threads', parseStoryThread)
  const foreshadows = parseArray(record['foreshadows'] ?? [], 'storyDirector.foreshadows', parseForeshadow)
  const horizon = parseArray(record['horizon'] ?? [], 'storyDirector.horizon', parseChapterPlan)
  const mysteryTruths = parseArray(record['mysteryTruths'] ?? [], 'storyDirector.mysteryTruths', parseMysteryTruth)
  const inventions = parseArray(record['inventions'] ?? [], 'storyDirector.inventions', parseInvention)
  const reconciliation = parseArray(record['reconciliation'] ?? [], 'storyDirector.reconciliation', parseDirectorReconciliation)
  assertUniqueIds(arcs, 'storyDirector.arcs')
  assertUniqueIds(threads, 'storyDirector.threads')
  assertUniqueIds(foreshadows, 'storyDirector.foreshadows')
  assertUniqueIds(mysteryTruths, 'storyDirector.mysteryTruths')
  assertUniqueIds(inventions, 'storyDirector.inventions')
  assertUniqueIds(reconciliation, 'storyDirector.reconciliation')
  const chapterNumbers = new Set<number>()
  for (const plan of horizon) {
    if (chapterNumbers.has(plan.fanficChapter)) throw new Error(`storyDirector.horizon contains duplicate fanfic chapter ${plan.fanficChapter}`)
    chapterNumbers.add(plan.fanficChapter)
  }
  const threadIds = new Set(threads.map(item => item.id))
  const foreshadowIds = new Set(foreshadows.map(item => item.id))
  for (const foreshadow of foreshadows) {
    for (const id of foreshadow.relatedThreads) if (!threadIds.has(id)) throw new Error(`foreshadow ${foreshadow.id} references unknown story thread ${JSON.stringify(id)}`)
  }
  for (const mysteryTruth of mysteryTruths) {
    for (const id of mysteryTruth.relatedThreads) if (!threadIds.has(id)) throw new Error(`mystery truth ${mysteryTruth.id} references unknown story thread ${JSON.stringify(id)}`)
  }
  for (const invention of inventions) {
    for (const id of invention.relatedThreads) if (!threadIds.has(id)) throw new Error(`invention ${invention.id} references unknown story thread ${JSON.stringify(id)}`)
  }
  for (const plan of horizon) {
    for (const id of plan.advanceThreads) if (!threadIds.has(id)) throw new Error(`chapter plan ${plan.fanficChapter} references unknown story thread ${JSON.stringify(id)}`)
    for (const id of [...plan.plantForeshadows, ...plan.payoffForeshadows]) if (!foreshadowIds.has(id)) throw new Error(`chapter plan ${plan.fanficChapter} references unknown foreshadow ${JSON.stringify(id)}`)
  }
  return { arcs, threads, foreshadows, horizon: [...horizon].sort((a, b) => a.fanficChapter - b.fanficChapter), mysteryTruths, inventions, reconciliation }
}

function parseDirectorReconciliation(value: unknown, label: string): FanficDirectorReconciliation {
  const record = objectRecord(value, label)
  return {
    id: nonEmpty(record['id'], `${label}.id`),
    fanficChapter: positiveSafeInteger(record['fanficChapter'], `${label}.fanficChapter`),
    chapterVersionId: nonEmpty(record['chapterVersionId'], `${label}.chapterVersionId`),
    reason: enumString(record['reason'], `${label}.reason`, ['rewrite', 'accepted-chapter'] as const),
    status: enumString(record['status'], `${label}.status`, ['open', 'resolved'] as const),
    message: nonEmpty(record['message'], `${label}.message`),
    createdAt: isoDate(record['createdAt'], `${label}.createdAt`),
    ...(record['resolvedAt'] === undefined ? {} : { resolvedAt: isoDate(record['resolvedAt'], `${label}.resolvedAt`) }),
  }
}

function parseStoryArc(value: unknown, label: string): FanficStoryArc {
  const record = objectRecord(value, label)
  const status = enumString(record['status'], `${label}.status`, ['planned', 'active', 'completed', 'abandoned'] as const)
  const startFanficChapter = optionalPositiveValue(record['startFanficChapter'], `${label}.startFanficChapter`)
  const targetEndFanficChapter = optionalPositiveValue(record['targetEndFanficChapter'], `${label}.targetEndFanficChapter`)
  if (startFanficChapter !== undefined && targetEndFanficChapter !== undefined && targetEndFanficChapter < startFanficChapter) {
    throw new Error(`${label}.targetEndFanficChapter must not precede startFanficChapter`)
  }
  return {
    id: nonEmpty(record['id'], `${label}.id`), title: nonEmpty(record['title'], `${label}.title`), status,
    objective: nonEmpty(record['objective'], `${label}.objective`), centralConflict: nonEmpty(record['centralConflict'], `${label}.centralConflict`),
    themes: stringArray(record['themes'] ?? [], `${label}.themes`), characters: stringArray(record['characters'] ?? [], `${label}.characters`),
    ...(startFanficChapter === undefined ? {} : { startFanficChapter }),
    ...(targetEndFanficChapter === undefined ? {} : { targetEndFanficChapter }),
    plannedPayoffs: stringArray(record['plannedPayoffs'] ?? [], `${label}.plannedPayoffs`), notes: stringArray(record['notes'] ?? [], `${label}.notes`),
  }
}

function parseStoryThread(value: unknown, label: string): FanficStoryThread {
  const record = objectRecord(value, label)
  const priority = positiveSafeInteger(record['priority'], `${label}.priority`)
  if (priority > 5) throw new Error(`${label}.priority must be between 1 and 5`)
  return {
    id: nonEmpty(record['id'], `${label}.id`),
    kind: enumString(record['kind'], `${label}.kind`, ['plot', 'character', 'mystery', 'relationship', 'theme'] as const),
    status: enumString(record['status'], `${label}.status`, ['open', 'dormant', 'resolved', 'abandoned'] as const),
    priority, summary: nonEmpty(record['summary'], `${label}.summary`), entities: stringArray(record['entities'] ?? [], `${label}.entities`),
    openedFanficChapter: positiveSafeInteger(record['openedFanficChapter'], `${label}.openedFanficChapter`),
    ...optionalPositiveNamedValue(record['targetFanficChapter'], `${label}.targetFanficChapter`, 'targetFanficChapter'),
    dependencies: stringArray(record['dependencies'] ?? [], `${label}.dependencies`),
    resolutionCriteria: stringArray(record['resolutionCriteria'] ?? [], `${label}.resolutionCriteria`),
  }
}

function parseForeshadow(value: unknown, label: string): FanficForeshadow {
  const record = objectRecord(value, label)
  return {
    id: nonEmpty(record['id'], `${label}.id`),
    status: enumString(record['status'], `${label}.status`, ['planned', 'planted', 'paid-off', 'retired'] as const),
    clue: nonEmpty(record['clue'], `${label}.clue`), payoff: nonEmpty(record['payoff'], `${label}.payoff`),
    relatedThreads: stringArray(record['relatedThreads'] ?? [], `${label}.relatedThreads`),
    ...optionalPositiveNamedValue(record['plantedFanficChapter'], `${label}.plantedFanficChapter`, 'plantedFanficChapter'),
    ...optionalPositiveNamedValue(record['targetFanficChapter'], `${label}.targetFanficChapter`, 'targetFanficChapter'),
    ...optionalPositiveNamedValue(record['payoffFanficChapter'], `${label}.payoffFanficChapter`, 'payoffFanficChapter'),
    subtlety: enumString(record['subtlety'], `${label}.subtlety`, ['background', 'noticeable', 'explicit'] as const),
  }
}

function parseMysteryTruth(value: unknown, label: string): FanficMysteryTruth {
  const record = objectRecord(value, label)
  return {
    id: nonEmpty(record['id'], `${label}.id`), status: enumString(record['status'], `${label}.status`, ['planned', 'active', 'revealed', 'retired'] as const),
    label: nonEmpty(record['label'], `${label}.label`), secretTruth: nonEmpty(record['secretTruth'], `${label}.secretTruth`), mechanism: nonEmpty(record['mechanism'], `${label}.mechanism`),
    allowedClues: stringArray(record['allowedClues'] ?? [], `${label}.allowedClues`), falseLeads: stringArray(record['falseLeads'] ?? [], `${label}.falseLeads`),
    revealConditions: stringArray(record['revealConditions'] ?? [], `${label}.revealConditions`),
    protectedRevealTerms: stringArray(record['protectedRevealTerms'] ?? [], `${label}.protectedRevealTerms`),
    plannedPayoff: nonEmpty(record['plannedPayoff'], `${label}.plannedPayoff`), relatedThreads: stringArray(record['relatedThreads'] ?? [], `${label}.relatedThreads`),
  }
}

function parseInvention(value: unknown, label: string): FanficInvention {
  const record = objectRecord(value, label)
  return {
    id: nonEmpty(record['id'], `${label}.id`), kind: enumString(record['kind'], `${label}.kind`, ['artifact', 'technique', 'organization', 'mechanism', 'character', 'location', 'other'] as const),
    name: nonEmpty(record['name'], `${label}.name`), originFanficChapter: positiveSafeInteger(record['originFanficChapter'], `${label}.originFanficChapter`), summary: nonEmpty(record['summary'], `${label}.summary`),
    capabilities: stringArray(record['capabilities'] ?? [], `${label}.capabilities`), constraints: stringArray(record['constraints'] ?? [], `${label}.constraints`), costs: stringArray(record['costs'] ?? [], `${label}.costs`),
    powerSource: nonEmpty(record['powerSource'], `${label}.powerSource`), ...optionalNamedString(record['owner'], `${label}.owner`, 'owner'), canonCompatibility: stringArray(record['canonCompatibility'] ?? [], `${label}.canonCompatibility`), relatedThreads: stringArray(record['relatedThreads'] ?? [], `${label}.relatedThreads`),
  }
}

function parseChapterPlan(value: unknown, label: string): FanficChapterPlan {
  const record = objectRecord(value, label)
  return {
    fanficChapter: positiveSafeInteger(record['fanficChapter'], `${label}.fanficChapter`),
    status: enumString(record['status'], `${label}.status`, ['planned', 'drafted', 'accepted'] as const),
    goal: nonEmpty(record['goal'], `${label}.goal`), pov: nonEmpty(record['pov'], `${label}.pov`),
    beats: stringArray(record['beats'] ?? [], `${label}.beats`), advanceThreads: stringArray(record['advanceThreads'] ?? [], `${label}.advanceThreads`),
    plantForeshadows: stringArray(record['plantForeshadows'] ?? [], `${label}.plantForeshadows`),
    payoffForeshadows: stringArray(record['payoffForeshadows'] ?? [], `${label}.payoffForeshadows`),
    constraints: stringArray(record['constraints'] ?? [], `${label}.constraints`),
  }
}

function assertUniqueIds(values: readonly { readonly id: string }[], label: string): void {
  const seen = new Set<string>()
  for (const value of values) {
    if (seen.has(value.id)) throw new Error(`${label} contains duplicate id ${JSON.stringify(value.id)}`)
    seen.add(value.id)
  }
}

function enumString<const T extends readonly string[]>(value: unknown, label: string, allowed: T): T[number] {
  if (typeof value !== 'string' || !allowed.includes(value)) throw new Error(`${label} must be one of ${allowed.join(', ')}`)
  return value as T[number]
}

function optionalPositiveValue(value: unknown, label: string): number | undefined { return value === undefined ? undefined : positiveSafeInteger(value, label) }
function optionalPositiveNamedValue(value: unknown, label: string, key: string): Record<string, number> { return value === undefined ? {} : { [key]: positiveSafeInteger(value, label) } }

function normalizeAuthorIntent(value: Partial<FanficAuthorIntent> | unknown): FanficAuthorIntent {
  if (value === undefined || value === null) return DEFAULT_AUTHOR_INTENT
  const record = objectRecord(value, 'authorIntent')
  const mode = record['divergenceMode'] ?? DEFAULT_AUTHOR_INTENT.divergenceMode
  if (mode !== 'canon-compliant' && mode !== 'soft-divergence' && mode !== 'hard-au') throw new Error('authorIntent.divergenceMode is invalid')
  return {
    premise: typeof record['premise'] === 'string' ? record['premise'].trim() : '',
    divergenceMode: mode,
    themes: optionalStringsOrEmpty(record['themes'], 'authorIntent.themes'),
    tone: optionalStringsOrEmpty(record['tone'], 'authorIntent.tone'),
    povPolicy: optionalStringsOrEmpty(record['povPolicy'], 'authorIntent.povPolicy'),
    characterPriorities: optionalStringsOrEmpty(record['characterPriorities'], 'authorIntent.characterPriorities'),
    forbiddenOutcomes: optionalStringsOrEmpty(record['forbiddenOutcomes'], 'authorIntent.forbiddenOutcomes'),
    styleNotes: optionalStringsOrEmpty(record['styleNotes'], 'authorIntent.styleNotes'),
    writingContract: normalizeWritingContract(record['writingContract']),
  }
}

function normalizeWritingContract(value: unknown): FanficWritingContract {
  if (value === undefined || value === null) return DEFAULT_WRITING_CONTRACT
  const record = objectRecord(value, 'authorIntent.writingContract')
  const language = record['language'] ?? DEFAULT_WRITING_CONTRACT.language
  if (language !== 'zh-CN') throw new Error('authorIntent.writingContract.language must be zh-CN')
  const minHanChars = positiveSafeInteger(record['minHanChars'] ?? DEFAULT_WRITING_CONTRACT.minHanChars, 'authorIntent.writingContract.minHanChars')
  const maxHanChars = positiveSafeInteger(record['maxHanChars'] ?? DEFAULT_WRITING_CONTRACT.maxHanChars, 'authorIntent.writingContract.maxHanChars')
  if (maxHanChars < minHanChars) throw new Error('authorIntent.writingContract.maxHanChars must be >= minHanChars')
  return {
    language,
    minHanChars,
    maxHanChars,
    defaultStyleMode: normalizeNarrativeStyleMode(record['defaultStyleMode'] ?? DEFAULT_WRITING_CONTRACT.defaultStyleMode),
  }
}

function optionalStringsOrEmpty(value: unknown, label: string): string[] {
  return value === undefined ? [] : uniqueStrings(stringArray(value, label))
}

function scoreText(text: string, terms: readonly string[]): number {
  const lower = text.toLocaleLowerCase()
  return terms.reduce((score, term) => score + countOccurrences(lower, term, 100), 0)
}

function assertRevision(branch: FanficBranch, expected: number): void {
  const revision = positiveSafeInteger(expected, 'expectedRevision')
  if (branch.revision !== revision) throw new Error(`fanfic branch revision conflict: expected ${revision}, current ${branch.revision}`)
}

function validateBranchId(value: string): void {
  if (!/^fanfic-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)) throw new Error(`invalid fanfic branch id ${JSON.stringify(value)}`)
}

async function loadGraphDirectory(graphDir: string): Promise<LoadedGraphRows> {
  const [facts, knowledge, characters, identities, powers, relationships, mysteries, events, timelineRules, causalLinks] = await Promise.all([
    readOptionalNdjson(join(graphDir, 'facts.ndjson'), parseFact),
    readOptionalNdjson(join(graphDir, 'knowledge.ndjson'), parseKnowledge),
    readOptionalNdjson(join(graphDir, 'characters.ndjson'), parseCharacter),
    readOptionalNdjson(join(graphDir, 'identities.ndjson'), parseIdentity),
    readOptionalNdjson(join(graphDir, 'powers.ndjson'), parsePower),
    readOptionalNdjson(join(graphDir, 'relationships.ndjson'), parseRelationship),
    readOptionalNdjson(join(graphDir, 'mysteries.ndjson'), parseMystery),
    readOptionalNdjson(join(graphDir, 'events.ndjson'), parseEvent),
    readOptionalNdjson(join(graphDir, 'timeline-rules.ndjson'), parseTimelineRule),
    readOptionalNdjson(join(graphDir, 'causality.ndjson'), parseCausalLink),
  ])
  return { facts, knowledge, characters, identities, powers, relationships, mysteries, events, timelineRules, causalLinks }
}

function mergeById<T extends { readonly id: string }>(base: readonly T[], overlay: readonly T[]): T[] {
  const rows = new Map<string, T>()
  for (const row of base) rows.set(row.id, row)
  for (const row of overlay) {
    if (rows.has(row.id)) throw new Error(`verified enrichment duplicates canon id ${JSON.stringify(row.id)}`)
    rows.set(row.id, row)
  }
  return [...rows.values()]
}

function expandContextFromPack(pack: LoadedCanonPack, request: CanonContextExpansionRequest): CanonContextExpansion {
  const cutoff = cutoffChapter(request.asOfChapter, pack.chapters.length)
  const seeds = uniqueStrings(request.seeds)
  const seedSet = new Set(seeds.map(value => value.toLocaleLowerCase()))
  const scores = new Map<string, { score: number; reasons: Set<string> }>()
  const add = (entity: string, score: number, reason: string): void => {
    const name = entity.trim()
    if (name.length === 0 || seedSet.has(name.toLocaleLowerCase())) return
    const existing = scores.get(name) ?? { score: 0, reasons: new Set<string>() }
    existing.score += score
    existing.reasons.add(reason)
    scores.set(name, existing)
  }
  const touches = (value: string): boolean => seeds.some(seed => sameName(seed, value))
  const visibleFacts = pack.facts.filter(fact => fact.validFromChapter <= cutoff
    && (fact.validUntilChapter === undefined || cutoff <= fact.validUntilChapter)
    && (fact.revealFromChapter === undefined || fact.revealFromChapter <= cutoff))
  for (const edge of pack.identities) {
    if (edge.validFromChapter > cutoff || (edge.validUntilChapter !== undefined && cutoff > edge.validUntilChapter)
      || (edge.revealFromChapter !== undefined && edge.revealFromChapter > cutoff)) continue
    if (touches(edge.subject)) add(edge.object, 8, `revealed identity edge from ${edge.subject}`)
    if (touches(edge.object)) add(edge.subject, 8, `revealed identity edge to ${edge.object}`)
  }
  for (const relation of pack.relationships) {
    if (relation.validFromChapter > cutoff || (relation.validUntilChapter !== undefined && cutoff > relation.validUntilChapter)) continue
    if (touches(relation.subject)) add(relation.object, 7, `relationship with ${relation.subject}`)
    if (touches(relation.object)) add(relation.subject, 7, `relationship with ${relation.object}`)
  }
  for (const event of pack.events) {
    if (event.chapter > cutoff) continue
    const participants = event.participants ?? []
    if (participants.some(touches)) for (const participant of participants) add(participant, 5, `shared canon event ${event.id}`)
  }
  for (const fact of visibleFacts) {
    if (touches(fact.subject) && typeof fact.object === 'string') add(fact.object, 4, `structured fact ${fact.id}`)
    if (typeof fact.object === 'string' && touches(fact.object)) add(fact.subject, 4, `structured fact ${fact.id}`)
  }
  const terms = request.query?.trim() ? searchTerms(request.query) : []
  if (terms.length > 0) {
    const knownEntities = new Set<string>()
    for (const state of pack.characters) if (state.validFromChapter <= cutoff) knownEntities.add(state.name)
    for (const relation of pack.relationships) { knownEntities.add(relation.subject); knownEntities.add(relation.object) }
    for (const edge of pack.identities) if ((edge.revealFromChapter ?? edge.validFromChapter) <= cutoff) { knownEntities.add(edge.subject); knownEntities.add(edge.object) }
    for (const event of pack.events) if (event.chapter <= cutoff) for (const participant of event.participants ?? []) knownEntities.add(participant)
    for (const fact of visibleFacts) { knownEntities.add(fact.subject); if (typeof fact.object === 'string' && fact.object.length <= 40) knownEntities.add(fact.object) }
    for (const link of pack.causalLinks) {
      if (link.introducedByChapter > cutoff) continue
      const text = `${link.cause} ${link.effect} ${link.mechanism ?? ''}`
      const relevance = scoreText(text, terms)
      if (relevance === 0) continue
      for (const entity of knownEntities) if (entity.length > 1 && text.includes(entity)) add(entity, Math.min(10, relevance), `causal link ${link.id}`)
    }
  }
  return {
    asOfChapter: cutoff,
    seeds,
    discovered: [...scores.entries()]
      .map(([entity, value]): CanonDiscoveredEntity => ({ entity, score: value.score, reasons: [...value.reasons] }))
      .sort((a, b) => b.score - a.score || a.entity.localeCompare(b.entity))
      .slice(0, request.maxEntities),
  }
}

function normalizeEnrichmentCandidate(candidate: CanonEnrichmentCandidate, chapterCount: number): CanonEnrichmentCandidate {
  const kind = candidate.kind
  if (!ENRICHMENT_KINDS.includes(kind)) throw new Error(`unsupported canon enrichment kind ${JSON.stringify(kind)}`)
  const payloadRecord = objectRecord(candidate.payload, 'candidate.payload')
  const payload: Record<string, FanficJsonValue> = {}
  for (const [key, value] of Object.entries(payloadRecord)) {
    if (key === 'provenance') throw new Error('candidate.payload must not provide provenance; the provider derives it from source evidence')
    payload[key] = jsonValue(value, `candidate.payload.${key}`)
  }
  return {
    kind,
    chapter: sourceChapter(candidate.chapter, chapterCount, 'candidate.chapter'),
    evidence: nonEmpty(candidate.evidence, 'candidate.evidence'),
    payload,
    ...(candidate.rationale === undefined ? {} : { rationale: candidate.rationale.trim() }),
  }
}

const ENRICHMENT_KINDS: readonly CanonEnrichmentKind[] = ['fact', 'knowledge', 'character', 'identity', 'power', 'relationship', 'mystery', 'event', 'timeline-rule', 'causal-link']

function enrichmentFilename(kind: CanonEnrichmentKind): string {
  switch (kind) {
    case 'fact': return 'facts.ndjson'
    case 'knowledge': return 'knowledge.ndjson'
    case 'character': return 'characters.ndjson'
    case 'identity': return 'identities.ndjson'
    case 'power': return 'powers.ndjson'
    case 'relationship': return 'relationships.ndjson'
    case 'mystery': return 'mysteries.ndjson'
    case 'event': return 'events.ndjson'
    case 'timeline-rule': return 'timeline-rules.ndjson'
    case 'causal-link': return 'causality.ndjson'
  }
}

function materializeEnrichmentRecord(candidate: CanonEnrichmentCandidate, source: CanonProvenance): { readonly id: string } & Record<string, unknown> {
  const raw = { ...candidate.payload, provenance: source }
  switch (candidate.kind) {
    case 'fact': return parseFact(raw, 'candidate.payload') as CanonFact & Record<string, unknown>
    case 'knowledge': return parseKnowledge(raw, 'candidate.payload') as CanonKnowledge & Record<string, unknown>
    case 'character': return parseCharacter(raw, 'candidate.payload') as CanonCharacterState & Record<string, unknown>
    case 'identity': return parseIdentity(raw, 'candidate.payload') as CanonIdentityEdge & Record<string, unknown>
    case 'power': return parsePower(raw, 'candidate.payload') as CanonPowerState & Record<string, unknown>
    case 'relationship': return parseRelationship(raw, 'candidate.payload') as CanonRelationshipState & Record<string, unknown>
    case 'mystery': return parseMystery(raw, 'candidate.payload') as CanonMystery & Record<string, unknown>
    case 'event': return parseEvent(raw, 'candidate.payload') as CanonEvent & Record<string, unknown>
    case 'timeline-rule': return parseTimelineRule(raw, 'candidate.payload') as CanonTimelineRule & Record<string, unknown>
    case 'causal-link': return parseCausalLink(raw, 'candidate.payload') as CanonCausalLink & Record<string, unknown>
  }
}

function candidateTemporalStart(candidate: CanonEnrichmentCandidate): number | undefined {
  const keys = candidate.kind === 'event' ? ['chapter'] : candidate.kind === 'knowledge' ? ['knownFromChapter'] : candidate.kind === 'mystery' ? ['revealChapter'] : candidate.kind === 'causal-link' ? ['introducedByChapter'] : ['validFromChapter']
  for (const key of keys) {
    const value = candidate.payload[key]
    if (typeof value === 'number' && Number.isSafeInteger(value)) return value
  }
  return undefined
}

function enrichmentToken(candidate: CanonEnrichmentCandidate, sourceSha256: string, chapterSha256: string): string {
  return createHash('sha256').update(canonicalJson({ candidate, sourceSha256, chapterSha256 })).digest('hex')
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`
}

function normalizeEvidence(value: string): string { return value.replace(/\s+/gu, '').trim() }
function provenanceWithExcerpt(sourceSha256: string, chapter: CanonChapter, excerpt: string): CanonProvenance {
  return { sourceSha256, chapter: chapter.index, chapterSha256: chapter.sha256, href: chapter.href, excerpt: excerpt.trim() }
}
function enrichmentRecordId(record: { readonly id: string }): string { return nonEmpty(record.id, 'enrichment.id') }
function canonRecordIdExists(pack: LoadedCanonPack, id: string): boolean {
  return [pack.facts, pack.knowledge, pack.characters, pack.identities, pack.powers, pack.relationships, pack.mysteries, pack.events, pack.timelineRules, pack.causalLinks]
    .some(records => records.some(record => record.id === id))
}

async function readJson(path: string): Promise<unknown> { return JSON.parse(await readFile(path, 'utf8')) }

async function readNdjson<T>(path: string, parse: (value: unknown, label: string) => T): Promise<T[]> {
  const text = await readFile(path, 'utf8')
  return parseNdjson(text, path, parse)
}

async function readOptionalNdjson<T>(path: string, parse: (value: unknown, label: string) => T): Promise<T[]> {
  try { return await readNdjson(path, parse) } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return []
    throw error
  }
}

function parseNdjson<T>(text: string, path: string, parse: (value: unknown, label: string) => T): T[] {
  const rows: T[] = []
  for (const [index, line] of text.split(/\r?\n/u).entries()) {
    if (line.trim().length === 0) continue
    let value: unknown
    try { value = JSON.parse(line) } catch (error) { throw new Error(`invalid NDJSON ${path}:${index + 1}: ${String(error)}`) }
    rows.push(parse(value, `${path}:${index + 1}`))
  }
  return rows
}

function extractCharacterVoiceSample(sourceSha256: string, chapter: CanonChapter, character: string, maxChars: number, maxDialogueFragments: number): CharacterVoiceSample | undefined {
  const at = chapter.text.indexOf(character)
  if (at < 0) return undefined
  const radius = Math.max(80, Math.floor(maxChars / 2))
  const start = Math.max(0, at - radius)
  const end = Math.min(chapter.text.length, at + character.length + radius)
  const excerpt = chapter.text.slice(start, end).trim()
  const dialogueFragments: string[] = []
  for (const match of excerpt.matchAll(/“([^”]{1,160})”/gu)) {
    const fragment = match[1]?.trim()
    if (fragment !== undefined && fragment.length > 0) dialogueFragments.push(fragment)
    if (dialogueFragments.length >= maxDialogueFragments) break
  }
  return {
    chapter: chapter.index, title: chapter.title, excerpt, dialogueFragments: uniqueStrings(dialogueFragments),
    provenance: provenance(sourceSha256, chapter),
  }
}

function scoreChapter(chapter: CanonChapter, terms: readonly string[]): number {
  const title = chapter.title.toLocaleLowerCase()
  const body = chapter.text.toLocaleLowerCase()
  let score = 0
  for (const term of terms) {
    score += countOccurrences(title, term, 20) * 12
    score += countOccurrences(body, term, 200)
  }
  return score
}

function countOccurrences(text: string, term: string, cap: number): number {
  let count = 0
  let offset = 0
  while (count < cap) {
    const index = text.indexOf(term, offset)
    if (index < 0) break
    count++
    offset = index + Math.max(1, term.length)
  }
  return count
}

function searchTerms(query: string): string[] {
  const lower = query.toLocaleLowerCase().trim()
  const words = lower.split(/\s+/u).filter(Boolean)
  return [...new Set([lower, ...words])].sort((a, b) => b.length - a.length)
}

function makeExcerpt(text: string, terms: readonly string[], maxChars: number): string {
  const lower = text.toLocaleLowerCase()
  let first = -1
  for (const term of terms) {
    const index = lower.indexOf(term)
    if (index >= 0 && (first < 0 || index < first)) first = index
  }
  const start = first < 0 ? 0 : Math.max(0, first - Math.floor(maxChars / 2))
  const end = Math.min(text.length, start + maxChars)
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`
}

function provenance(sourceSha256: string, chapter: CanonChapter): CanonProvenance {
  return { sourceSha256, chapter: chapter.index, chapterSha256: chapter.sha256, href: chapter.href }
}

function cutoffChapter(value: number, chapterCount: number): number {
  const chapter = positiveSafeInteger(value, 'asOfChapter')
  return Math.min(chapter, chapterCount)
}
function sourceChapter(value: number, chapterCount: number, label: string): number {
  const chapter = positiveSafeInteger(value, label)
  if (chapter > chapterCount) throw new Error(`${label} ${chapter} exceeds source chapter count ${chapterCount}`)
  return chapter
}

function sameName(left: string, right: string): boolean { return left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase() }
function uniqueStrings(values: readonly string[]): string[] { return [...new Set(values.map(value => value.trim()).filter(Boolean))] }
function nonEmpty(value: unknown, label: string): string { if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${label} must be a non-empty string`); return value.trim() }
function positiveSafeInteger(value: unknown, label: string): number { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) throw new Error(`${label} must be a positive safe integer`); return value }
function nonNegativeSafeInteger(value: unknown, label: string): number { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative safe integer`); return value }
function booleanValue(value: unknown, label: string): boolean { if (typeof value !== 'boolean') throw new Error(`${label} must be boolean`); return value }
function finiteNumber(value: unknown, label: string): number { if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label} must be finite`); return value }
function objectRecord(value: unknown, label: string): Record<string, unknown> { if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${label} must be an object`); return value as Record<string, unknown> }
function stringArray(value: unknown, label: string): string[] { if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) throw new Error(`${label} must be a string array`); return uniqueStrings(value as string[]) }
function sha256(value: unknown, label: string): string { const text = nonEmpty(value, label); if (!/^[0-9a-f]{64}$/iu.test(text)) throw new Error(`${label} must be a sha256 hex string`); return text.toLowerCase() }
function isoDate(value: unknown, label: string): string { const text = nonEmpty(value, label); if (Number.isNaN(Date.parse(text))) throw new Error(`${label} must be an ISO date string`); return text }
function isNodeError(error: unknown): error is NodeJS.ErrnoException { return error instanceof Error && 'code' in error }
function optionalString(value: unknown, key: string): Record<string, string> { return value === undefined ? {} : { [key]: nonEmpty(value, key) } }
function optionalNamedString(value: unknown, label: string, key: string): Record<string, string> { return value === undefined ? {} : { [key]: nonEmpty(value, label) } }
function optionalStringArray(value: unknown, label: string, key: string): Record<string, readonly string[]> { return value === undefined ? {} : { [key]: stringArray(value, label) } }
function optionalPositiveInteger(value: unknown, label: string, key: string): Record<string, number> { return value === undefined ? {} : { [key]: positiveSafeInteger(value, label) } }
function parseArray<T>(value: unknown, label: string, parser: (item: unknown, itemLabel: string) => T): T[] { if (!Array.isArray(value)) throw new Error(`${label} must be an array`); return value.map((item, index) => parser(item, `${label}[${index}]`)) }
function jsonValue(value: unknown, label: string): FanficJsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') { if (!Number.isFinite(value)) throw new Error(`${label} must contain finite JSON numbers`); return value }
  if (Array.isArray(value)) return value.map((item, index) => jsonValue(item, `${label}[${index}]`))
  if (typeof value === 'object') {
    const result: Record<string, FanficJsonValue> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) result[key] = jsonValue(item, `${label}.${key}`)
    return result
  }
  throw new Error(`${label} must be JSON-compatible`)
}
