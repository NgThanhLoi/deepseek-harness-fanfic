/** Public fanfic capability types. @module @deepseek-ai/dsh-fanfic/types */
import type { FanficBranchId } from './brand.ts'

/** JSON-compatible scalar/object value persisted by canon and fanfic packs. */
export type FanficJsonValue = null | boolean | number | string | FanficJsonValue[] | { readonly [key: string]: FanficJsonValue }

/** Immutable source location backing a canon record. */
export interface CanonProvenance {
  readonly sourceSha256: string
  readonly chapter: number
  /** Optional structured event id when evidence is localized within a chapter. */
  readonly eventId?: string
  /** Optional 1-based event order within a chapter. */
  readonly eventOrdinal?: number
  /** Optional author-defined scene id within a chapter. */
  readonly sceneId?: string
  readonly chapterSha256?: string
  readonly href?: string
  readonly excerpt?: string
}

/** One source chapter in narrative order. */
export interface CanonChapter {
  readonly index: number
  readonly title: string
  readonly part?: string | null
  readonly href: string
  readonly sha256: string
  readonly text: string
}

/** Search result restricted to an explicit narrative cutoff. */
export interface CanonSearchHit {
  readonly chapter: number
  readonly title: string
  readonly score: number
  readonly excerpt: string
  readonly provenance: CanonProvenance
}

/** Temporal canon fact. */
export interface CanonFact {
  readonly id: string
  readonly subject: string
  readonly predicate: string
  readonly object: FanficJsonValue
  readonly validFromChapter: number
  readonly validUntilChapter?: number
  /** Earliest narrative chapter where this truth may be exposed to the author/model. */
  readonly revealFromChapter?: number
  readonly aliases?: readonly string[]
  readonly confidence?: number
  readonly provenance: CanonProvenance
}

/** What one character knows, suspects, or falsely believes about a fact. */
export interface CanonKnowledge {
  readonly id: string
  readonly character: string
  readonly factId: string
  readonly stance: 'knows' | 'suspects' | 'believes-false'
  readonly knownFromChapter: number
  readonly knownUntilChapter?: number
  readonly provenance?: CanonProvenance
}

/** Temporal state for a character at one range of canon. */
export interface CanonCharacterState {
  readonly id: string
  readonly name: string
  readonly aliases?: readonly string[]
  readonly validFromChapter: number
  readonly validUntilChapter?: number
  readonly realm?: string
  readonly location?: string
  readonly affiliations?: readonly string[]
  readonly goals?: readonly string[]
  readonly traits?: readonly string[]
  readonly ideology?: readonly string[]
  readonly values?: readonly string[]
  readonly fears?: readonly string[]
  readonly redLines?: readonly string[]
  readonly decisionRules?: readonly string[]
  readonly voiceNotes?: readonly string[]
  readonly emotionalState?: readonly string[]
  readonly techniques?: readonly string[]
  readonly possessions?: readonly string[]
  readonly injuries?: readonly string[]
  readonly provenance?: CanonProvenance
}

/** Temporal relation between two identities. */
export interface CanonIdentityEdge {
  readonly id: string
  readonly subject: string
  readonly relation: string
  readonly object: string
  readonly validFromChapter: number
  readonly validUntilChapter?: number
  readonly revealFromChapter?: number
  readonly provenance: CanonProvenance
}

/** Temporal power/capability record. */
export interface CanonPowerState {
  readonly id: string
  readonly subject: string
  readonly validFromChapter: number
  readonly validUntilChapter?: number
  readonly realm?: string
  readonly capabilities?: readonly string[]
  readonly techniques?: readonly string[]
  readonly artifacts?: readonly string[]
  readonly demonstratedFeats?: readonly string[]
  readonly prerequisites?: readonly string[]
  readonly constraints?: readonly string[]
  readonly exceptions?: readonly string[]
  readonly provenance?: CanonProvenance
}

/** Temporal relationship state. */
export interface CanonRelationshipState {
  readonly id: string
  readonly subject: string
  readonly object: string
  readonly validFromChapter: number
  readonly validUntilChapter?: number
  readonly relation?: string
  readonly publicState?: string
  readonly privateState?: string
  readonly provenance?: CanonProvenance
}

/** Mystery and reveal timing used to keep clues separate from revelations. */
export interface CanonMystery {
  readonly id: string
  readonly label: string
  readonly revealChapter: number
  readonly forbiddenBeforeReveal?: readonly string[]
  readonly clues?: readonly { readonly chapter: number; readonly summary: string }[]
  readonly provenance?: CanonProvenance
}

/** Canon event with narrative validity and dependency labels. */
export interface CanonEvent {
  readonly id: string
  readonly chapter: number
  /** Optional 1-based order used for same-chapter divergence boundaries. */
  readonly orderInChapter?: number
  readonly summary: string
  readonly participants?: readonly string[]
  readonly dependencies?: readonly string[]
  readonly consequences?: readonly string[]
  readonly provenance?: CanonProvenance
}


/** Global timeline/worldline rule learned at a specific narrative point. */
export interface CanonTimelineRule {
  readonly id: string
  readonly validFromChapter: number
  readonly validUntilChapter?: number
  readonly worldline?: string
  readonly rule: string
  readonly effects?: readonly string[]
  readonly provenance?: CanonProvenance
}

/** Source-backed causal relationship between canon conditions or events. */
export interface CanonCausalLink {
  readonly id: string
  readonly introducedByChapter: number
  readonly cause: string
  readonly effect: string
  readonly mechanism?: string
  readonly confidence?: number
  readonly provenance?: CanonProvenance
}

/** Canon pack health and loaded graph counts. */
export interface FanficStatus {
  readonly providerId: string
  readonly canonPackId: string
  readonly title: string
  readonly creator: string
  readonly sourceSha256: string
  readonly chapterCount: number
  readonly graphCounts: Readonly<Record<string, number>>
  readonly enrichmentCounts: Readonly<Record<CanonEnrichmentKind, number>>
  readonly styleBank: {
    readonly chapterMetrics: number
    readonly modes: readonly string[]
  }
  readonly stateDir: string
}

/** Request to search immutable source text. */
export interface CanonSearchRequest {
  readonly query: string
  readonly asOfChapter: number
  readonly limit: number
}

/** Request to read one chapter without crossing the caller's spoiler cutoff. */
export interface CanonChapterReadRequest {
  readonly chapter: number
  readonly asOfChapter: number
}

/** Request for a structured, spoiler-safe canon snapshot. */
export interface CanonSnapshotRequest {
  readonly asOfChapter: number
  readonly povCharacter?: string
  readonly entities?: readonly string[]
  readonly query?: string
  readonly searchLimit: number
}

/** Structured canon snapshot at one narrative point. */
export interface CanonSnapshot {
  readonly asOfChapter: number
  readonly spoilerFirewall: {
    readonly maxNarrativeChapter: number
    readonly futureCanonBlocked: true
  }
  readonly povCharacter?: string
  readonly characterStates: readonly CanonCharacterState[]
  readonly facts: readonly CanonFact[]
  readonly povKnowledge: readonly CanonKnowledge[]
  readonly identities: readonly CanonIdentityEdge[]
  readonly powers: readonly CanonPowerState[]
  readonly relationships: readonly CanonRelationshipState[]
  readonly mysteries: readonly CanonMystery[]
  readonly events: readonly CanonEvent[]
  readonly timelineRules: readonly CanonTimelineRule[]
  readonly causalLinks: readonly CanonCausalLink[]
  readonly sourceExcerpts: readonly CanonSearchHit[]
}


/** A precise canon location; optional event/scene fields refine a chapter boundary. */
export interface CanonPoint {
  readonly chapter: number
  readonly eventOrdinal?: number
  readonly afterEventId?: string
  readonly sceneId?: string
}

/** One divergence from immutable source canon. */
export interface FanficDivergence {
  readonly id: string
  readonly atChapter: number
  /** Optional same-chapter boundary. Canon at/before this point remains truth. */
  readonly eventOrdinal?: number
  readonly afterEventId?: string
  readonly sceneId?: string
  readonly summary: string
  readonly immediateConsequences: readonly string[]
  readonly openQuestions: readonly string[]
  readonly recordedAt: string
}

/** One fanfic-world fact appended by Observer/Reflector. */
export interface FanficOverlayFact {
  readonly id: string
  readonly originFanficChapter: number
  readonly originChapterVersionId: string
  readonly subject: string
  readonly predicate: string
  readonly object: FanficJsonValue
  readonly validFromFanficChapter: number
  readonly validUntilFanficChapter?: number
  readonly recordedAt: string
}

/** Fanfic-only epistemic update. */
export interface FanficOverlayKnowledge {
  readonly id: string
  readonly originFanficChapter: number
  readonly originChapterVersionId: string
  readonly character: string
  /** Optional structured subject this epistemic update concerns. */
  readonly subject?: string
  /** Optional structured predicate this epistemic update concerns. */
  readonly predicate?: string
  /** Optional structured object text this epistemic update concerns. */
  readonly object?: string
  readonly summary: string
  readonly stance: 'knows' | 'suspects' | 'believes-false'
  readonly fromFanficChapter: number
  readonly recordedAt: string
}

/** Fanfic-only character-state update. */
export interface FanficOverlayCharacterState {
  readonly id: string
  readonly originFanficChapter: number
  readonly originChapterVersionId: string
  readonly character: string
  readonly fromFanficChapter: number
  readonly summary: string
  readonly recordedAt: string
}

/** Fanfic-only relationship update. */
export interface FanficOverlayRelationship {
  readonly id: string
  readonly originFanficChapter: number
  readonly originChapterVersionId: string
  readonly subject: string
  readonly object: string
  readonly fromFanficChapter: number
  readonly summary: string
  readonly recordedAt: string
}

/** Open or resolved consequence thread produced by a divergence. */
export interface FanficCausalThread {
  readonly id: string
  readonly originFanficChapter: number
  readonly originChapterVersionId: string
  readonly fromFanficChapter: number
  readonly summary: string
  readonly status: 'open' | 'resolved'
  readonly recordedAt: string
  readonly resolvedAt?: string
}


/** Author-owned project intent; unlike canon records this is mutable branch policy. */
export interface FanficAuthorIntent {
  readonly premise: string
  readonly divergenceMode: 'canon-compliant' | 'soft-divergence' | 'hard-au'
  readonly themes: readonly string[]
  readonly tone: readonly string[]
  readonly povPolicy: readonly string[]
  readonly characterPriorities: readonly string[]
  readonly forbiddenOutcomes: readonly string[]
  readonly styleNotes: readonly string[]
}

/** One long-form story arc owned by the author, not by source canon. */
export interface FanficStoryArc {
  readonly id: string
  readonly title: string
  readonly status: 'planned' | 'active' | 'completed' | 'abandoned'
  readonly objective: string
  readonly centralConflict: string
  readonly themes: readonly string[]
  readonly characters: readonly string[]
  readonly startFanficChapter?: number
  readonly targetEndFanficChapter?: number
  readonly plannedPayoffs: readonly string[]
  readonly notes: readonly string[]
}

/** Durable plot/character/mystery/relationship/theme thread tracked across chapters. */
export interface FanficStoryThread {
  readonly id: string
  readonly kind: 'plot' | 'character' | 'mystery' | 'relationship' | 'theme'
  readonly status: 'open' | 'dormant' | 'resolved' | 'abandoned'
  readonly priority: number
  readonly summary: string
  readonly entities: readonly string[]
  readonly openedFanficChapter: number
  readonly targetFanficChapter?: number
  readonly dependencies: readonly string[]
  readonly resolutionCriteria: readonly string[]
}

/** One planted or planned narrative promise and its intended payoff. */
export interface FanficForeshadow {
  readonly id: string
  readonly status: 'planned' | 'planted' | 'paid-off' | 'retired'
  readonly clue: string
  readonly payoff: string
  readonly relatedThreads: readonly string[]
  readonly plantedFanficChapter?: number
  readonly targetFanficChapter?: number
  readonly payoffFanficChapter?: number
  readonly subtlety: 'background' | 'noticeable' | 'explicit'
}

/** One planned chapter in the rolling author horizon. */
export interface FanficChapterPlan {
  readonly fanficChapter: number
  readonly status: 'planned' | 'drafted' | 'accepted'
  readonly goal: string
  readonly pov: string
  readonly beats: readonly string[]
  readonly advanceThreads: readonly string[]
  readonly plantForeshadows: readonly string[]
  readonly payoffForeshadows: readonly string[]
  readonly constraints: readonly string[]
}

/** Author-only truth behind an original mystery; never exposed as POV knowledge by itself. */
export interface FanficMysteryTruth {
  readonly id: string
  readonly status: 'planned' | 'active' | 'revealed' | 'retired'
  readonly label: string
  readonly secretTruth: string
  readonly mechanism: string
  readonly allowedClues: readonly string[]
  readonly falseLeads: readonly string[]
  readonly revealConditions: readonly string[]
  readonly plannedPayoff: string
  readonly relatedThreads: readonly string[]
}

/** Registry entry for fanfic-original world elements that need stable constraints. */
export interface FanficInvention {
  readonly id: string
  readonly kind: 'artifact' | 'technique' | 'organization' | 'mechanism' | 'character' | 'location' | 'other'
  readonly name: string
  readonly originFanficChapter: number
  readonly summary: string
  readonly capabilities: readonly string[]
  readonly constraints: readonly string[]
  readonly costs: readonly string[]
  readonly powerSource: string
  readonly owner?: string
  readonly canonCompatibility: readonly string[]
  readonly relatedThreads: readonly string[]
}

/** One accepted/superseded version of a fanfic chapter. */
export type FanficRewriteMode = 'inherit' | 'replace'

/** One accepted/superseded version of a fanfic chapter. */
export interface FanficChapterVersion {
  readonly id: string
  readonly fanficChapter: number
  readonly status: 'active' | 'superseded'
  readonly rewriteMode: 'initial' | FanficRewriteMode
  readonly replacesVersionId?: string
  /** Existing causal-thread ids resolved by this accepted chapter version. */
  readonly resolvedCausalThreadIds: readonly string[]
  readonly createdAt: string
  readonly supersededAt?: string
}

/** Durable accepted chapter summary tied to one chapter version. */
export interface FanficChapterSummary {
  readonly fanficChapter: number
  readonly chapterVersionId: string
  readonly summary: string
  readonly recordedAt: string
}

/** Durable Story Director state; this is author metadata and never in-world character knowledge. */
export interface FanficDirectorReconciliation {
  readonly id: string
  readonly fanficChapter: number
  readonly chapterVersionId: string
  readonly reason: 'rewrite' | 'accepted-chapter'
  readonly status: 'open' | 'resolved'
  readonly message: string
  readonly createdAt: string
  readonly resolvedAt?: string
}

/** Durable Story Director state; this is author metadata and never in-world character knowledge. */
export interface FanficStoryDirectorState {
  readonly arcs: readonly FanficStoryArc[]
  readonly threads: readonly FanficStoryThread[]
  readonly foreshadows: readonly FanficForeshadow[]
  readonly horizon: readonly FanficChapterPlan[]
  readonly mysteryTruths: readonly FanficMysteryTruth[]
  readonly inventions: readonly FanficInvention[]
  readonly reconciliation: readonly FanficDirectorReconciliation[]
}

/** Persistent mutable branch over immutable canon. */
export interface FanficBranch {
  readonly version: 2
  readonly id: FanficBranchId
  readonly name: string
  readonly baseChapter: number
  readonly revision: number
  readonly notes: string
  readonly authorIntent: FanficAuthorIntent
  readonly storyDirector: FanficStoryDirectorState
  readonly createdAt: string
  readonly updatedAt: string
  readonly divergences: readonly FanficDivergence[]
  readonly chapterVersions: readonly FanficChapterVersion[]
  readonly facts: readonly FanficOverlayFact[]
  readonly knowledge: readonly FanficOverlayKnowledge[]
  readonly characterStates: readonly FanficOverlayCharacterState[]
  readonly relationships: readonly FanficOverlayRelationship[]
  readonly causalThreads: readonly FanficCausalThread[]
  readonly chapterSummaries: readonly FanficChapterSummary[]
}

/** Create one mutable branch at a canonical starting point. */
export interface CreateFanficBranchRequest {
  readonly name: string
  readonly baseChapter: number
  readonly notes: string
  readonly authorIntent?: Partial<FanficAuthorIntent>
}

/** Replace author intent with compare-and-set branch revision. */
export interface UpdateFanficIntentRequest {
  readonly branchId: FanficBranchId
  readonly expectedRevision: number
  readonly authorIntent: FanficAuthorIntent
}

/** Replace durable Story Director metadata with compare-and-set branch revision. */
export interface UpdateFanficStoryDirectorRequest {
  readonly branchId: FanficBranchId
  readonly expectedRevision: number
  readonly storyDirector: FanficStoryDirectorState
}

/** Upsert one story arc with compare-and-set branch revision. */
export interface UpsertFanficStoryArcRequest {
  readonly branchId: FanficBranchId
  readonly expectedRevision: number
  readonly arc: FanficStoryArc
}
/** Upsert one story thread with compare-and-set branch revision. */
export interface UpsertFanficStoryThreadRequest {
  readonly branchId: FanficBranchId
  readonly expectedRevision: number
  readonly thread: FanficStoryThread
}
/** Upsert one foreshadow with compare-and-set branch revision. */
export interface UpsertFanficForeshadowRequest {
  readonly branchId: FanficBranchId
  readonly expectedRevision: number
  readonly foreshadow: FanficForeshadow
}
/** Replace the rolling chapter horizon with compare-and-set branch revision. */
export interface SetFanficHorizonRequest {
  readonly branchId: FanficBranchId
  readonly expectedRevision: number
  readonly horizon: readonly FanficChapterPlan[]
}
/** Upsert one author-only mystery truth record. */
export interface UpsertFanficMysteryTruthRequest {
  readonly branchId: FanficBranchId
  readonly expectedRevision: number
  readonly mysteryTruth: FanficMysteryTruth
}
/** Upsert one fanfic-original invention record. */
export interface UpsertFanficInventionRequest {
  readonly branchId: FanficBranchId
  readonly expectedRevision: number
  readonly invention: FanficInvention
}

/** Request a compact Director packet around one fanfic chapter. */
export interface StoryDirectorContextRequest {
  readonly branchId: FanficBranchId
  readonly fanficChapter: number
  readonly horizonSize: number
}

/** Compact long-form planning state consumed before chapter planning. */
export interface StoryDirectorContext {
  readonly branchId: FanficBranchId
  readonly revision: number
  readonly fanficChapter: number
  readonly activeArcs: readonly FanficStoryArc[]
  readonly activeThreads: readonly FanficStoryThread[]
  readonly dueThreads: readonly FanficStoryThread[]
  readonly liveForeshadows: readonly FanficForeshadow[]
  readonly mysteryTruths: readonly FanficMysteryTruth[]
  readonly inventions: readonly FanficInvention[]
  readonly horizon: readonly FanficChapterPlan[]
  readonly recentChapterSummaries: readonly { readonly fanficChapter: number; readonly summary: string }[]
  readonly unresolvedCausalThreads: readonly FanficCausalThread[]
  readonly reconciliation: readonly FanficDirectorReconciliation[]
  readonly attention: readonly string[]
  readonly cautions: readonly string[]
}

/** Append a divergence with compare-and-set branch revision. */
export interface RecordFanficDivergenceRequest {
  readonly branchId: FanficBranchId
  readonly expectedRevision: number
  readonly atChapter: number
  readonly eventOrdinal?: number
  readonly afterEventId?: string
  readonly sceneId?: string
  readonly summary: string
  readonly immediateConsequences: readonly string[]
  readonly openQuestions: readonly string[]
}

/** Observer/Reflector delta committed after a generated chapter. */
export interface FanficStateDelta {
  readonly fanficChapter: number
  readonly chapterSummary?: string
  readonly facts?: readonly Omit<FanficOverlayFact, 'id' | 'recordedAt' | 'originFanficChapter' | 'originChapterVersionId'>[]
  readonly knowledge?: readonly Omit<FanficOverlayKnowledge, 'id' | 'recordedAt' | 'originFanficChapter' | 'originChapterVersionId'>[]
  readonly characterStates?: readonly Omit<FanficOverlayCharacterState, 'id' | 'recordedAt' | 'originFanficChapter' | 'originChapterVersionId'>[]
  readonly relationships?: readonly Omit<FanficOverlayRelationship, 'id' | 'recordedAt' | 'originFanficChapter' | 'originChapterVersionId'>[]
  readonly causalThreads?: readonly Omit<FanficCausalThread, 'id' | 'recordedAt' | 'resolvedAt' | 'originFanficChapter' | 'originChapterVersionId'>[]
  readonly resolveCausalThreadIds?: readonly string[]
}

/** Compare-and-set fanfic state update. */
export interface ApplyFanficDeltaRequest {
  readonly branchId: FanficBranchId
  readonly expectedRevision: number
  readonly delta: FanficStateDelta
  /** Required for a rewrite; inherit clones active structured state, replace starts from an empty chapter state. */
  readonly rewriteMode?: FanficRewriteMode
  /** Old chapter record ids not inherited when rewriteMode=inherit. */
  readonly dropInheritedRecordIds?: readonly string[]
  /** Explicit acknowledgement required when replace would discard active structured state. */
  readonly confirmDroppedState?: boolean
  /** Exact accepted draft whose audit receipts authorize this state transaction. */
  readonly draft: string
  /** Canon/style/anti-copy receipt ids issued for the exact draft and branch revision. */
  readonly auditReceiptIds: readonly string[]
}

/** Durable proof that one exact draft passed one required authoring gate. */
export interface FanficAuditReceipt {
  readonly id: string
  readonly kind: 'canon' | 'style' | 'anti-copy'
  readonly draftHash: string
  readonly branchId: FanficBranchId
  readonly fanficChapter: number
  readonly branchRevision: number
  readonly ok: boolean
  readonly issuedAt: string
}


/** Query source-backed causal links that were available by a canon cutoff. */
export interface CanonCausalityTraceRequest {
  readonly query: string
  readonly asOfChapter: number
  readonly limit: number
}

/** Bounded causal graph slice. */
export interface CanonCausalityTrace {
  readonly asOfChapter: number
  readonly query: string
  readonly links: readonly CanonCausalLink[]
}

/** Request for worldline/timeline rules and source-backed events at one canon cutoff. */
export interface CanonTimelineContextRequest {
  readonly asOfChapter: number
  readonly worldline?: string
  readonly query?: string
  readonly entities?: readonly string[]
  readonly limit: number
}

/** Timeline/worldline intelligence slice for planning scenes involving history or cross-world rules. */
export interface CanonTimelineContext {
  readonly asOfChapter: number
  readonly worldline?: string
  readonly rules: readonly CanonTimelineRule[]
  readonly events: readonly CanonEvent[]
  readonly identities: readonly CanonIdentityEdge[]
  readonly sourceEvidence: readonly CanonSearchHit[]
  readonly cautions: readonly string[]
}

/** Author-facing context composed from canon, epistemics, and a branch overlay. */
export interface AuthorContextRequest {
  readonly asOfChapter: number
  readonly povCharacter: string
  readonly participants: readonly string[]
  readonly sceneGoal: string
  readonly query: string
  readonly branchId?: FanficBranchId
  readonly fanficChapter?: number
  /** Rolling Story Director horizon included when branch context is requested. */
  readonly storyHorizonSize: number
  /** Work-level style mode selected for this scene. */
  readonly styleMode: NarrativeStyleMode
  /** Number of bounded source evidence windows to include in style context. */
  readonly styleSampleLimit: number
}

/** The packet a planner/writer consumes before generating a scene. */
export interface AuthorContext {
  readonly version: 3
  readonly scene: {
    readonly canonPoint: CanonPoint
    readonly fanficChapter?: number
    readonly pov: string
    readonly participants: readonly string[]
    readonly goal: string
  }
  readonly canonTruth: CanonSnapshot
  /** Same-chapter structured canon known before a precise divergence boundary. */
  readonly canonSameChapterTruth?: CanonSnapshot
  readonly canonReference?: CanonSnapshot
  readonly contextExpansion: CanonContextExpansion
  readonly characterIntelligence: readonly CharacterIntelligence[]
  readonly narrativeStyle: NarrativeStyleContext
  readonly storyDirector?: StoryDirectorContext
  /** Bounded active branch working set; full administrative state stays behind fanfic_branch_get. */
  readonly branch?: FanficBranch
  readonly divergencePolicy: {
    readonly diverged: boolean
    readonly canonStableThroughChapter: number
    readonly sameChapterTruthThroughEventOrdinal?: number
    readonly laterCanonIsCounterfactualReference: boolean
  }
  readonly hardConstraints: readonly string[]
  readonly workflow: readonly string[]
}

/** Structured claim extracted from a draft for deterministic validation. */
export interface FanficAuditClaim {
  readonly kind: 'knowledge' | 'canon-fact' | 'identity' | 'power'
  readonly subject: string
  readonly predicate?: string
  readonly object?: string
}

/** Draft audit request. */
export interface FanficAuditRequest {
  readonly draft: string
  readonly asOfChapter: number
  readonly povCharacter: string
  readonly branchId?: FanficBranchId
  /** Fanfic narrative chapter being audited; hides later branch state when supplied. */
  readonly fanficChapter?: number
  readonly claims: readonly FanficAuditClaim[]
  /** Known scene participants used by the independent draft claim extractor. */
  readonly participants?: readonly string[]
}

/** One deterministic audit finding. */
export interface FanficAuditIssue {
  readonly severity: 'error' | 'warning'
  readonly code: string
  readonly message: string
  readonly claim?: FanficAuditClaim
}

/** Deterministic draft audit result. */
export interface FanficAuditCoverage {
  readonly extractedClaims: readonly FanficAuditClaim[]
  readonly submittedClaims: readonly FanficAuditClaim[]
  readonly uncoveredRiskyClaims: readonly FanficAuditClaim[]
  readonly coveredCount: number
  readonly extractedCount: number
}

/** Full deterministic draft-audit result including independently measured claim coverage. */
export interface FanficAuditResult {
  readonly ok: boolean
  readonly auditReceipt?: FanficAuditReceipt
  readonly issues: readonly FanficAuditIssue[]
  readonly coverage: FanficAuditCoverage
  readonly limitations: readonly string[]
}


/** Supported structured canon record families for verified enrichment overlays. */
export type CanonEnrichmentKind = 'fact' | 'knowledge' | 'character' | 'identity' | 'power' | 'relationship' | 'mystery' | 'event' | 'timeline-rule' | 'causal-link'

/** Model- or human-proposed structured canon record backed by an exact source chapter excerpt. */
export interface CanonEnrichmentCandidate {
  readonly kind: CanonEnrichmentKind
  readonly chapter: number
  readonly evidence: string
  readonly payload: Readonly<Record<string, FanficJsonValue>>
  readonly rationale?: string
}

/** Deterministic evidence-validation result. A token binds the candidate to the exact source chapter. */
export interface CanonEnrichmentValidation {
  readonly valid: boolean
  readonly token?: string
  readonly chapter: number
  readonly chapterTitle?: string
  readonly chapterSha256?: string
  readonly normalizedEvidence?: string
  readonly errors: readonly string[]
  readonly warnings: readonly string[]
}

/** Commit one previously validated enrichment candidate into the local verified overlay. */
export interface CanonEnrichmentCommitRequest {
  readonly candidate: CanonEnrichmentCandidate
  readonly token: string
}

/** Result of admitting one verified record into the local structured overlay. */
export interface CanonEnrichmentCommitResult {
  readonly accepted: true
  readonly kind: CanonEnrichmentKind
  readonly id: string
  readonly provenance: CanonProvenance
  readonly overlayPath: string
}

/** One completed chapter × record-family review checkpoint in the enrichment ledger. */
export interface CanonEnrichmentCoverage {
  readonly chapter: number
  readonly kind: CanonEnrichmentKind
  readonly sourceSha256: string
  readonly chapterSha256: string
  readonly recordIds: readonly string[]
  readonly noFindings: boolean
  readonly notes: string
  readonly updatedAt: string
}

/** Ask the orchestrator for the next chapters whose selected record families have not been reviewed. */
export interface CanonEnrichmentPlanRequest {
  readonly fromChapter: number
  readonly toChapter: number
  readonly kinds: readonly CanonEnrichmentKind[]
  readonly batchSize: number
}

/** One source chapter and record families still requiring structured review. */
export interface CanonEnrichmentWorkItem {
  readonly chapter: number
  readonly title: string
  readonly chapterSha256: string
  readonly pendingKinds: readonly CanonEnrichmentKind[]
  readonly existingRecordIds: Readonly<Record<string, readonly string[]>>
}

/** Bounded deterministic work queue for LLM-driven canon digestion. */
export interface CanonEnrichmentPlan {
  readonly fromChapter: number
  readonly toChapter: number
  readonly kinds: readonly CanonEnrichmentKind[]
  readonly work: readonly CanonEnrichmentWorkItem[]
  readonly remainingUnits: number
  readonly instructions: readonly string[]
}

/** Persist one reviewed chapter/family checkpoint after all accepted candidates have been committed. */
export interface CanonEnrichmentCheckpointRequest {
  readonly chapter: number
  readonly kind: CanonEnrichmentKind
  readonly recordIds: readonly string[]
  readonly noFindings: boolean
  readonly notes: string
}

/** Request aggregate enrichment coverage for a range. */
export interface CanonEnrichmentProgressRequest {
  readonly fromChapter: number
  readonly toChapter: number
  readonly kinds: readonly CanonEnrichmentKind[]
}

/** Aggregate coverage; checkpoints assert review completion, not truth beyond admitted records. */
export interface CanonEnrichmentProgress {
  readonly fromChapter: number
  readonly toChapter: number
  readonly kinds: readonly CanonEnrichmentKind[]
  readonly totalUnits: number
  readonly completedUnits: number
  readonly completionRatio: number
  readonly byKind: Readonly<Record<string, { readonly completed: number; readonly total: number }>>
  readonly checkpoints: readonly CanonEnrichmentCoverage[]
}

/** Request to discover graph-adjacent entities the scene planner did not explicitly name. */
export interface CanonContextExpansionRequest {
  readonly asOfChapter: number
  readonly seeds: readonly string[]
  readonly query?: string
  readonly maxEntities: number
}

/** One automatically discovered scene-relevant entity. */
export interface CanonDiscoveredEntity {
  readonly entity: string
  readonly score: number
  readonly reasons: readonly string[]
}

/** Spoiler-safe graph expansion from explicit scene seeds. */
export interface CanonContextExpansion {
  readonly asOfChapter: number
  readonly seeds: readonly string[]
  readonly discovered: readonly CanonDiscoveredEntity[]
}

/** Request for a consolidated author-facing dossier for one character. */
export interface CharacterIntelligenceRequest {
  readonly character: string
  readonly asOfChapter: number
  readonly povCharacter?: string
  readonly branchId?: FanficBranchId
  readonly fanficChapter?: number
  readonly evidenceLimit: number
}

/** Consolidated, source-backed character dossier without inventing missing traits. */
export interface CharacterIntelligence {
  readonly character: string
  readonly asOfChapter: number
  readonly states: readonly CanonCharacterState[]
  readonly identities: readonly CanonIdentityEdge[]
  readonly powers: readonly CanonPowerState[]
  readonly relationships: readonly CanonRelationshipState[]
  readonly knowledge: readonly CanonKnowledge[]
  readonly facts: readonly CanonFact[]
  readonly branchState?: {
    readonly characterStates: readonly FanficOverlayCharacterState[]
    readonly relationships: readonly FanficOverlayRelationship[]
    readonly knowledge: readonly FanficOverlayKnowledge[]
  }
  readonly sourceEvidence: readonly CanonSearchHit[]
  readonly gaps: readonly string[]
}

/** One short source window useful for studying a character's dialogue/inner-voice tendencies. */
export interface CharacterVoiceSample {
  readonly chapter: number
  readonly title: string
  readonly excerpt: string
  readonly dialogueFragments: readonly string[]
  readonly provenance: CanonProvenance
}

/** Request bounded source-backed voice evidence for one character. */
export interface CharacterVoiceContextRequest {
  readonly character: string
  readonly asOfChapter: number
  readonly limit: number
}

/** Voice evidence plus structured notes; contextual excerpts do not assert exact speaker attribution. */
export interface CharacterVoiceContext {
  readonly character: string
  readonly asOfChapter: number
  readonly structuredVoiceNotes: readonly string[]
  readonly samples: readonly CharacterVoiceSample[]
  readonly cautions: readonly string[]
}

/** High-level scene-mode labels used to retrieve work-level style evidence without copying prose. */
export type NarrativeStyleMode = 'auto' | 'jianghu' | 'mystery' | 'reincarnation-mission' | 'banter-introspection' | 'combat' | 'high-level-strategy' | 'cosmology-philosophy' | 'exposition' | 'ensemble-rumor' | 'emotional'

/** Text-level measurements used for work-level narrative rhythm comparisons. */
export interface NarrativeStyleMetrics {
  readonly charCount: number
  readonly hanCharCount: number
  readonly paragraphCount: number
  readonly sentenceCount: number
  readonly dialogueCharRatio: number
  readonly meanSentenceChars: number
  readonly medianSentenceChars: number
  readonly meanParagraphChars: number
  readonly medianParagraphChars: number
  readonly shortParagraphRatio: number
  readonly questionRate: number
  readonly exclamationRate: number
  readonly ellipsisRate: number
}

/** One cutoff-safe source window selected as contextual style evidence. */
export interface NarrativeStyleSample {
  readonly chapter: number
  readonly title: string
  readonly modeScore: number
  readonly metrics: NarrativeStyleMetrics
  readonly excerpt: string
  readonly provenance: CanonProvenance
}

/** Request for high-level work-style context at one spoiler cutoff. */
export interface NarrativeStyleContextRequest {
  readonly asOfChapter: number
  readonly mode: NarrativeStyleMode
  readonly query: string
  readonly povCharacter?: string
  readonly participants: readonly string[]
  readonly branchId?: FanficBranchId
  readonly fanficChapter?: number
  readonly sampleLimit: number
}

/** Work-level narrative guidance derived from cutoff-safe metrics and bounded source evidence. */
export interface NarrativeStyleContext {
  readonly asOfChapter: number
  readonly requestedMode: NarrativeStyleMode
  readonly resolvedMode: Exclude<NarrativeStyleMode, 'auto'>
  readonly referenceMetrics: NarrativeStyleMetrics
  readonly globalMetrics: NarrativeStyleMetrics
  readonly projectStyleNotes: readonly string[]
  readonly guidance: readonly string[]
  readonly samples: readonly NarrativeStyleSample[]
  readonly cautions: readonly string[]
}

/** Exact-overlap request used to prevent accidental source copying, including future-canon text. */
export interface AntiCopyGuardRequest {
  readonly draft: string
  readonly asOfChapter: number
  readonly branchId?: FanficBranchId
  readonly fanficChapter?: number
  readonly minPhraseChars: number
  readonly maxFindings: number
}

/** One exact phrase from the draft that also occurs in immutable source text. */
export interface AntiCopyFinding {
  readonly draftExcerpt: string
  readonly overlapChars: number
  readonly sourceChapter?: number
  readonly beyondCutoff: boolean
  readonly sourceFingerprint: string
}

/** Corpus-wide anti-copy result; future source locations stay hidden behind the cutoff. */
export interface AntiCopyGuardResult {
  readonly ok: boolean
  readonly auditReceipt?: FanficAuditReceipt
  readonly checkedDraftChars: number
  readonly minPhraseChars: number
  readonly findings: readonly AntiCopyFinding[]
  readonly cautions: readonly string[]
}

/** Request for quantitative style drift plus anti-copy checks. */
export interface NarrativeStyleAuditRequest extends NarrativeStyleContextRequest {
  readonly draft: string
  readonly targetMinHanChars?: number
  readonly targetMaxHanChars?: number
  readonly antiCopyMinPhraseChars: number
  readonly antiCopyMaxFindings: number
}

/** One draft metric that falls outside the broad reference envelope. */
export interface NarrativeStyleDeviation {
  readonly metric: keyof NarrativeStyleMetrics
  readonly severity: 'warning' | 'revision-required'
  readonly draftValue: number
  readonly referenceValue: number
  readonly message: string
}

/** Style audit constrains high-level work conventions without claiming exact author imitation. */
export interface NarrativeStyleAuditResult {
  readonly ok: boolean
  readonly auditReceipt?: FanficAuditReceipt
  readonly mode: Exclude<NarrativeStyleMode, 'auto'>
  readonly draftMetrics: NarrativeStyleMetrics
  readonly referenceMetrics: NarrativeStyleMetrics
  readonly deviations: readonly NarrativeStyleDeviation[]
  readonly antiCopy: AntiCopyGuardResult
  readonly lengthContract: {
    readonly actualHanChars: number
    readonly minHanChars?: number
    readonly maxHanChars?: number
    readonly withinTarget: boolean
  }
  readonly revisionGuidance: readonly string[]
  readonly limitations: readonly string[]
}

/** Request for evidence-first power/capability assessment. */
export interface PowerAssessmentRequest {
  readonly actors: readonly string[]
  readonly asOfChapter: number
  readonly scenario?: string
  readonly branchId?: FanficBranchId
  readonly fanficChapter?: number
  readonly evidenceLimit: number
}

/** One actor's known capabilities at the requested cutoff. */
export interface PowerActorAssessment {
  readonly actor: string
  readonly states: readonly CanonCharacterState[]
  readonly powers: readonly CanonPowerState[]
  readonly sourceEvidence: readonly CanonSearchHit[]
}

/** Power assessment that constrains writing but does not hallucinate a winner. */
export interface PowerAssessment {
  readonly asOfChapter: number
  readonly scenario: string
  readonly actors: readonly PowerActorAssessment[]
  readonly systemRules: readonly CanonPowerState[]
  readonly timelineRules: readonly CanonTimelineRule[]
  readonly verdict: 'constraints-found' | 'insufficient-structured-data'
  readonly cautions: readonly string[]
}

/** Request to scan downstream impact of a proposed divergence. */
export interface FanficImpactScanRequest {
  readonly asOfChapter: number
  readonly summary: string
  readonly entities: readonly string[]
  readonly branchId?: FanficBranchId
  readonly fanficChapter?: number
  readonly limit: number
}

/** Deterministic dependency scan; likely/possible consequences remain planning hypotheses. */
export interface FanficImpactScan {
  readonly asOfChapter: number
  readonly summary: string
  readonly relatedCanonLinks: readonly CanonCausalLink[]
  readonly relatedEvents: readonly CanonEvent[]
  readonly discoveredEntities: readonly CanonDiscoveredEntity[]
  readonly openBranchThreads: readonly FanficCausalThread[]
  readonly limitations: readonly string[]
}

/** Provider implementation behind the fanfic capability seam. */
export interface FanficProvider {
  readonly id: string
  available(): boolean
  status(signal?: AbortSignal): Promise<FanficStatus>
  search(request: CanonSearchRequest, signal?: AbortSignal): Promise<readonly CanonSearchHit[]>
  readChapter(request: CanonChapterReadRequest, signal?: AbortSignal): Promise<CanonChapter>
  snapshot(request: CanonSnapshotRequest, signal?: AbortSignal): Promise<CanonSnapshot>
  authorContext(request: AuthorContextRequest, signal?: AbortSignal): Promise<AuthorContext>
  traceCausality(request: CanonCausalityTraceRequest, signal?: AbortSignal): Promise<CanonCausalityTrace>
  timelineContext(request: CanonTimelineContextRequest, signal?: AbortSignal): Promise<CanonTimelineContext>
  expandContext(request: CanonContextExpansionRequest, signal?: AbortSignal): Promise<CanonContextExpansion>
  characterIntelligence(request: CharacterIntelligenceRequest, signal?: AbortSignal): Promise<CharacterIntelligence>
  characterVoiceContext(request: CharacterVoiceContextRequest, signal?: AbortSignal): Promise<CharacterVoiceContext>
  narrativeStyleContext(request: NarrativeStyleContextRequest, signal?: AbortSignal): Promise<NarrativeStyleContext>
  antiCopyGuard(request: AntiCopyGuardRequest, signal?: AbortSignal): Promise<AntiCopyGuardResult>
  auditNarrativeStyle(request: NarrativeStyleAuditRequest, signal?: AbortSignal): Promise<NarrativeStyleAuditResult>
  assessPower(request: PowerAssessmentRequest, signal?: AbortSignal): Promise<PowerAssessment>
  impactScan(request: FanficImpactScanRequest, signal?: AbortSignal): Promise<FanficImpactScan>
  validateEnrichment(candidate: CanonEnrichmentCandidate, signal?: AbortSignal): Promise<CanonEnrichmentValidation>
  commitEnrichment(request: CanonEnrichmentCommitRequest, signal?: AbortSignal): Promise<CanonEnrichmentCommitResult>
  planEnrichment(request: CanonEnrichmentPlanRequest, signal?: AbortSignal): Promise<CanonEnrichmentPlan>
  enrichmentProgress(request: CanonEnrichmentProgressRequest, signal?: AbortSignal): Promise<CanonEnrichmentProgress>
  checkpointEnrichment(request: CanonEnrichmentCheckpointRequest, signal?: AbortSignal): Promise<CanonEnrichmentCoverage>
  listBranches(signal?: AbortSignal): Promise<readonly FanficBranch[]>
  createBranch(request: CreateFanficBranchRequest, signal?: AbortSignal): Promise<FanficBranch>
  getBranch(id: FanficBranchId, signal?: AbortSignal): Promise<FanficBranch>
  recordDivergence(request: RecordFanficDivergenceRequest, signal?: AbortSignal): Promise<FanficBranch>
  updateIntent(request: UpdateFanficIntentRequest, signal?: AbortSignal): Promise<FanficBranch>
  updateStoryDirector(request: UpdateFanficStoryDirectorRequest, signal?: AbortSignal): Promise<FanficBranch>
  upsertStoryArc(request: UpsertFanficStoryArcRequest, signal?: AbortSignal): Promise<FanficBranch>
  upsertStoryThread(request: UpsertFanficStoryThreadRequest, signal?: AbortSignal): Promise<FanficBranch>
  upsertForeshadow(request: UpsertFanficForeshadowRequest, signal?: AbortSignal): Promise<FanficBranch>
  setStoryHorizon(request: SetFanficHorizonRequest, signal?: AbortSignal): Promise<FanficBranch>
  upsertMysteryTruth(request: UpsertFanficMysteryTruthRequest, signal?: AbortSignal): Promise<FanficBranch>
  upsertInvention(request: UpsertFanficInventionRequest, signal?: AbortSignal): Promise<FanficBranch>
  resolveDirectorReconciliation(request: {
    readonly branchId: FanficBranchId
    readonly expectedRevision: number
    readonly reconciliationId: string
  }, signal?: AbortSignal): Promise<FanficBranch>
  storyDirectorContext(request: StoryDirectorContextRequest, signal?: AbortSignal): Promise<StoryDirectorContext>
  applyDelta(request: ApplyFanficDeltaRequest, signal?: AbortSignal): Promise<FanficBranch>
  audit(request: FanficAuditRequest, signal?: AbortSignal): Promise<FanficAuditResult>
}
