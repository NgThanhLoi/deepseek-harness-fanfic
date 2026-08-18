/** Model-facing fanfic authoring tools over `ctx.fanfic`. @module @deepseek-ai/dsh-tool-fanfic */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import {
  FanficBranchId,
  type CanonEnrichmentKind,
  type FanficAuditClaim,
  type FanficAuthorIntent,
  type FanficBranch,
  type FanficJsonValue,
  type NarrativeStyleMode,
  type FanficStateDelta,
  type FanficStoryArc,
  type FanficStoryThread,
  type FanficForeshadow,
  type FanficChapterPlan,
  type FanficMysteryTruth,
  type FanficInvention,
} from '@deepseek-ai/dsh-fanfic'

export const name = 'tool-fanfic'
export const inject = ['fanfic', 'tools', 'systemPrompt']

const FANFIC_TOOL_API_VERSION = '0.6.0'
const FANFIC_BRANCH_FORMAT_VERSION = 2
const FANFIC_AUTHOR_CONTEXT_VERSION = 3

/** Model-facing fanfic-tool limits. */
export interface Config {
  /** Search limit used when the model omits `limit`. */
  defaultSearchLimit: number
  /** Default graph-expansion entity limit. */
  defaultContextExpansionLimit: number
  /** Default source-evidence count for character dossiers. */
  defaultCharacterEvidenceLimit: number
  /** Default number of contextual voice samples. */
  defaultVoiceSampleLimit: number
  /** Default number of work-level narrative style samples. */
  defaultStyleSampleLimit: number
  /** Default minimum exact-overlap length used by anti-copy checks. */
  defaultAntiCopyMinPhraseChars: number
  /** Default maximum anti-copy findings returned to the model. */
  defaultAntiCopyMaxFindings: number
  /** Default source-evidence count for power assessment. */
  defaultPowerEvidenceLimit: number
  /** Default chapter/family work-item count returned by enrichment planning. */
  defaultEnrichmentBatchSize: number
  /** Default Story Director horizon used when the model omits a horizon size. */
  defaultStoryHorizonSize: number
  /** Maximum structured claims accepted by one deterministic audit call. */
  maxAuditClaims: number
}

export const Config: z<Config> = z.object({
  defaultSearchLimit: z.number().min(1).required(),
  defaultContextExpansionLimit: z.number().min(1).required(),
  defaultCharacterEvidenceLimit: z.number().min(1).required(),
  defaultVoiceSampleLimit: z.number().min(1).required(),
  defaultStyleSampleLimit: z.number().min(1).required(),
  defaultAntiCopyMinPhraseChars: z.number().min(12).required(),
  defaultAntiCopyMaxFindings: z.number().min(1).required(),
  defaultPowerEvidenceLimit: z.number().min(1).required(),
  defaultEnrichmentBatchSize: z.number().min(1).required(),
  defaultStoryHorizonSize: z.number().min(1).required(),
  maxAuditClaims: z.number().min(1).required(),
})

const FANFIC_POLICY = `Fanfic authoring policy (tool API ${FANFIC_TOOL_API_VERSION}):
- At the start of a live authoring run, call fanfic_status. If toolApiVersion is missing or not ${FANFIC_TOOL_API_VERSION}, STOP: the runtime bundle is stale and must be rebuilt before writing.
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
- After fanfic_apply_delta, inspect story_director_context. Rewrites create a Director reconciliation issue; update affected horizon/thread/foreshadow/arc metadata with granular tools, then resolve the reconciliation issue before planning further chapters. Style warnings are advisory unless marked revision-required; exact source overlap must be rewritten.`

/** Register the fanfic workflow policy and its model-facing tools. */
export function apply(ctx: Context, config: Config): void {
  const defaultSearchLimit = positiveInteger(config.defaultSearchLimit, 'defaultSearchLimit')
  const defaultContextExpansionLimit = positiveInteger(config.defaultContextExpansionLimit, 'defaultContextExpansionLimit')
  const defaultCharacterEvidenceLimit = positiveInteger(config.defaultCharacterEvidenceLimit, 'defaultCharacterEvidenceLimit')
  const defaultVoiceSampleLimit = positiveInteger(config.defaultVoiceSampleLimit, 'defaultVoiceSampleLimit')
  const defaultStyleSampleLimit = positiveInteger(config.defaultStyleSampleLimit, 'defaultStyleSampleLimit')
  const defaultAntiCopyMinPhraseChars = positiveInteger(config.defaultAntiCopyMinPhraseChars, 'defaultAntiCopyMinPhraseChars')
  const defaultAntiCopyMaxFindings = positiveInteger(config.defaultAntiCopyMaxFindings, 'defaultAntiCopyMaxFindings')
  const defaultPowerEvidenceLimit = positiveInteger(config.defaultPowerEvidenceLimit, 'defaultPowerEvidenceLimit')
  const defaultEnrichmentBatchSize = positiveInteger(config.defaultEnrichmentBatchSize, 'defaultEnrichmentBatchSize')
  const defaultStoryHorizonSize = positiveInteger(config.defaultStoryHorizonSize, 'defaultStoryHorizonSize')
  const maxAuditClaims = positiveInteger(config.maxAuditClaims, 'maxAuditClaims')

  ctx.systemPrompt.section({ name: 'tool:fanfic', order: 117, text: FANFIC_POLICY })

  ctx.tools.register(defineTool({
    name: 'fanfic_status',
    description: 'Inspect the active canon pack, structured graph counts, and branch-state directory.',
    parameters: {},
    output: jsonObjectOutput('Loaded fanfic provider status.'),
    execute: async (_args, exec) => toolObject({
      ...(await ctx.fanfic.status(exec.signal)),
      toolApiVersion: FANFIC_TOOL_API_VERSION,
      branchFormatVersion: FANFIC_BRANCH_FORMAT_VERSION,
      authorContextVersion: FANFIC_AUTHOR_CONTEXT_VERSION,
    }),
    presentCall: () => ({ card: 'generic', title: 'Inspect fanfic status', kind: 'read' }),
  }))

  ctx.tools.register(defineTool({
    name: 'canon_search',
    description: 'Search immutable canon source text up to an explicit narrative chapter cutoff. Future chapters are excluded before ranking.',
    parameters: {
      query: { type: 'string', required: true, description: 'Names, techniques, events, or phrases to find.' },
      asOfChapter: { type: 'integer', required: true, description: 'Maximum canon narrative chapter the result may use.' },
      limit: { type: 'integer', description: `Maximum hits; defaults to ${defaultSearchLimit}.` },
    },
    output: {
      schema: { type: 'array', items: { type: 'object', additionalProperties: true } },
      render: (_args, value) => jsonText(value),
    },
    async execute(args, exec) {
      return toolObjectArray(await ctx.fanfic.search({
        query: nonEmpty(args.query, 'query'),
        asOfChapter: positiveInteger(args.asOfChapter, 'asOfChapter'),
        limit: positiveInteger(args.limit ?? defaultSearchLimit, 'limit'),
      }, exec.signal))
    },
    presentCall: args => ({ card: 'generic', title: `Search canon through chapter ${args.asOfChapter}`, kind: 'search', rawInput: args.query }),
  }))

  ctx.tools.register(defineTool({
    name: 'canon_chapter_read',
    description: 'Read one exact canon chapter only when it is at or before the caller-supplied spoiler cutoff.',
    parameters: {
      chapter: { type: 'integer', required: true },
      asOfChapter: { type: 'integer', required: true },
    },
    output: jsonObjectOutput('Canon chapter with provenance and source text.'),
    async execute(args, exec) {
      return toolObject(await ctx.fanfic.readChapter({ chapter: positiveInteger(args.chapter, 'chapter'), asOfChapter: positiveInteger(args.asOfChapter, 'asOfChapter') }, exec.signal))
    },
    presentCall: args => ({ card: 'generic', title: `Read canon chapter ${args.chapter}`, kind: 'read', rawInput: { cutoff: args.asOfChapter } }),
  }))

  ctx.tools.register(defineTool({
    name: 'canon_snapshot',
    description: 'Build a structured spoiler-safe canon snapshot: temporal facts, POV knowledge, identities, powers, relationships, mysteries, events, and bounded source evidence.',
    parameters: {
      asOfChapter: { type: 'integer', required: true },
      povCharacter: { type: 'string' },
      entities: { type: 'array', items: { type: 'string' } },
      query: { type: 'string' },
      searchLimit: { type: 'integer' },
    },
    output: jsonObjectOutput('Structured canon snapshot.'),
    async execute(args, exec) {
      return toolObject(await ctx.fanfic.snapshot({
        asOfChapter: positiveInteger(args.asOfChapter, 'asOfChapter'),
        ...(args.povCharacter === undefined ? {} : { povCharacter: nonEmpty(args.povCharacter, 'povCharacter') }),
        ...(args.entities === undefined ? {} : { entities: uniqueStrings(args.entities) }),
        ...(args.query === undefined ? {} : { query: args.query.trim() }),
        searchLimit: positiveInteger(args.searchLimit ?? defaultSearchLimit, 'searchLimit'),
      }, exec.signal))
    },
    presentCall: args => ({ card: 'generic', title: `Compose canon snapshot @ ${args.asOfChapter}`, kind: 'read', rawInput: args.povCharacter ?? args.entities ?? [] }),
  }))

  ctx.tools.register(defineTool({
    name: 'canon_causality_trace',
    description: 'Search source-backed canonical cause/effect links that had been established by a narrative cutoff. Use this after a divergence to identify dependencies that may no longer hold.',
    parameters: {
      query: { type: 'string', required: true },
      asOfChapter: { type: 'integer', required: true },
      limit: { type: 'integer' },
    },
    output: jsonObjectOutput('Bounded canonical causality slice.'),
    async execute(args, exec) {
      return toolObject(await ctx.fanfic.traceCausality({
        query: nonEmpty(args.query, 'query'),
        asOfChapter: positiveInteger(args.asOfChapter, 'asOfChapter'),
        limit: positiveInteger(args.limit ?? defaultSearchLimit, 'limit'),
      }, exec.signal))
    },
    presentCall: args => ({ card: 'generic', title: `Trace canon causality @ ${args.asOfChapter}`, kind: 'search', rawInput: args.query }),
  }))

  ctx.tools.register(defineTool({
    name: 'canon_timeline_context',
    description: 'Query spoiler-safe timeline/worldline rules, relevant events, revealed identities, and source evidence at one canon cutoff.',
    parameters: {
      asOfChapter: { type: 'integer', required: true }, worldline: { type: 'string' }, query: { type: 'string' },
      entities: { type: 'array', items: { type: 'string' } }, limit: { type: 'integer' },
    },
    output: jsonObjectOutput('Timeline/worldline context.'),
    async execute(args, exec) {
      return toolObject(await ctx.fanfic.timelineContext({
        asOfChapter: positiveInteger(args.asOfChapter, 'asOfChapter'),
        ...(args.worldline === undefined ? {} : { worldline: nonEmpty(args.worldline, 'worldline') }),
        ...(args.query === undefined ? {} : { query: args.query.trim() }),
        ...(args.entities === undefined ? {} : { entities: uniqueStrings(args.entities) }),
        limit: positiveInteger(args.limit ?? defaultSearchLimit, 'limit'),
      }, exec.signal))
    },
    presentCall: args => ({ card: 'generic', title: `Timeline context @ ${args.asOfChapter}`, kind: 'search', rawInput: args.query ?? args.worldline ?? args.entities ?? [] }),
  }))

  ctx.tools.register(defineTool({
    name: 'canon_context_expand',
    description: 'Discover spoiler-safe graph-adjacent entities that may matter to a scene even when the initial prompt did not name them.',
    parameters: {
      asOfChapter: { type: 'integer', required: true },
      seeds: { type: 'array', required: true, items: { type: 'string' } },
      query: { type: 'string' },
      maxEntities: { type: 'integer' },
    },
    output: jsonObjectOutput('Spoiler-safe context expansion.'),
    async execute(args, exec) {
      return toolObject(await ctx.fanfic.expandContext({
        asOfChapter: positiveInteger(args.asOfChapter, 'asOfChapter'), seeds: uniqueStrings(args.seeds),
        ...(args.query === undefined ? {} : { query: args.query.trim() }),
        maxEntities: positiveInteger(args.maxEntities ?? defaultContextExpansionLimit, 'maxEntities'),
      }, exec.signal))
    },
    presentCall: args => ({ card: 'generic', title: `Expand canon context @ ${args.asOfChapter}`, kind: 'search', rawInput: args.seeds }),
  }))

  ctx.tools.register(defineTool({
    name: 'character_intelligence',
    description: 'Build a cutoff-safe character dossier from temporal state, identities, powers, relationships, epistemics, branch overlays, and source evidence. Missing data is reported as gaps rather than invented.',
    parameters: {
      character: { type: 'string', required: true }, asOfChapter: { type: 'integer', required: true }, povCharacter: { type: 'string' },
      branchId: { type: 'string' }, fanficChapter: { type: 'integer' }, evidenceLimit: { type: 'integer' },
    },
    output: jsonObjectOutput('Character intelligence dossier.'),
    async execute(args, exec) {
      return toolObject(await ctx.fanfic.characterIntelligence({
        character: nonEmpty(args.character, 'character'), asOfChapter: positiveInteger(args.asOfChapter, 'asOfChapter'),
        ...(args.povCharacter === undefined ? {} : { povCharacter: nonEmpty(args.povCharacter, 'povCharacter') }),
        ...(args.branchId === undefined ? {} : { branchId: await resolveBranchRef(ctx, args.branchId, exec.signal) }),
        ...(args.fanficChapter === undefined ? {} : { fanficChapter: positiveInteger(args.fanficChapter, 'fanficChapter') }),
        evidenceLimit: positiveInteger(args.evidenceLimit ?? defaultCharacterEvidenceLimit, 'evidenceLimit'),
      }, exec.signal))
    },
    presentCall: args => ({ card: 'generic', title: `Character dossier: ${args.character}`, kind: 'read', rawInput: { cutoff: args.asOfChapter } }),
  }))

  ctx.tools.register(defineTool({
    name: 'character_voice_context',
    description: 'Retrieve bounded source-backed dialogue/voice evidence around a character at a canon cutoff plus any structured voice notes. Contextual snippets do not assert exact speaker attribution; verify ambiguous fragments with canon_chapter_read.',
    parameters: {
      character: { type: 'string', required: true }, asOfChapter: { type: 'integer', required: true }, limit: { type: 'integer' },
    },
    output: jsonObjectOutput('Character voice evidence.'),
    async execute(args, exec) {
      return toolObject(await ctx.fanfic.characterVoiceContext({
        character: nonEmpty(args.character, 'character'), asOfChapter: positiveInteger(args.asOfChapter, 'asOfChapter'), limit: positiveInteger(args.limit ?? defaultVoiceSampleLimit, 'limit'),
      }, exec.signal))
    },
    presentCall: args => ({ card: 'generic', title: `Voice evidence: ${args.character}`, kind: 'read', rawInput: { cutoff: args.asOfChapter } }),
  }))

  ctx.tools.register(defineTool({
    name: 'narrative_style_context',
    description: 'Retrieve spoiler-safe, work-level narrative rhythm guidance for a scene mode. Returns aggregate metrics and bounded evidence windows; it is not an instruction to imitate a living author exactly or copy source wording.',
    parameters: {
      asOfChapter: { type: 'integer', required: true },
      mode: { type: 'string', enum: ['auto', 'jianghu', 'mystery', 'reincarnation-mission', 'banter-introspection', 'combat', 'high-level-strategy', 'cosmology-philosophy', 'exposition', 'ensemble-rumor', 'emotional'] },
      query: { type: 'string' }, povCharacter: { type: 'string' }, participants: { type: 'array', items: { type: 'string' } },
      branchId: { type: 'string' }, fanficChapter: { type: 'integer' }, sampleLimit: { type: 'integer' },
    },
    output: jsonObjectOutput('High-level work-style context and source evidence.'),
    async execute(args, exec) {
      return toolObject(await ctx.fanfic.narrativeStyleContext({
        asOfChapter: positiveInteger(args.asOfChapter, 'asOfChapter'),
        mode: (args.mode ?? 'auto') as NarrativeStyleMode,
        query: args.query?.trim() ?? '',
        ...(args.povCharacter === undefined ? {} : { povCharacter: nonEmpty(args.povCharacter, 'povCharacter') }),
        participants: uniqueStrings(args.participants ?? []),
        ...(args.branchId === undefined ? {} : { branchId: await resolveBranchRef(ctx, args.branchId, exec.signal) }),
        ...(args.fanficChapter === undefined ? {} : { fanficChapter: positiveInteger(args.fanficChapter, 'fanficChapter') }),
        sampleLimit: positiveInteger(args.sampleLimit ?? defaultStyleSampleLimit, 'sampleLimit'),
      }, exec.signal))
    },
    presentCall: args => ({ card: 'generic', title: `Narrative style context @ ${args.asOfChapter}`, kind: 'read', rawInput: { mode: args.mode ?? 'auto', query: args.query ?? '' } }),
  }))

  ctx.tools.register(defineTool({
    name: 'anti_copy_guard',
    description: 'Detect exact normalized phrase overlap between a draft and the entire immutable canon corpus. Future-source match locations remain hidden behind the spoiler cutoff.',
    parameters: {
      draft: { type: 'string', required: true }, asOfChapter: { type: 'integer', required: true },
      branchId: { type: 'string', description: 'Optional branch UUID or unique branch name; required with fanficChapter to issue an anti-copy commit receipt.' }, fanficChapter: { type: 'integer' },
      minPhraseChars: { type: 'integer' }, maxFindings: { type: 'integer' },
    },
    output: jsonObjectOutput('Exact source-overlap findings.'),
    async execute(args, exec) {
      return toolObject(await ctx.fanfic.antiCopyGuard({
        draft: args.draft,
        asOfChapter: positiveInteger(args.asOfChapter, 'asOfChapter'),
        ...(args.branchId === undefined ? {} : { branchId: await resolveBranchRef(ctx, args.branchId, exec.signal) }),
        ...(args.fanficChapter === undefined ? {} : { fanficChapter: positiveInteger(args.fanficChapter, 'fanficChapter') }),
        minPhraseChars: positiveInteger(args.minPhraseChars ?? defaultAntiCopyMinPhraseChars, 'minPhraseChars'),
        maxFindings: positiveInteger(args.maxFindings ?? defaultAntiCopyMaxFindings, 'maxFindings'),
      }, exec.signal))
    },
    presentCall: args => ({ card: 'generic', title: 'Check source overlap', kind: 'read', rawInput: { cutoff: args.asOfChapter } }),
  }))

  ctx.tools.register(defineTool({
    name: 'fanfic_style_audit',
    description: 'Audit a draft against high-level work-style metrics for the selected scene mode and run the corpus-wide anti-copy guard. Style drift is advisory; exact source overlap should be rewritten.',
    parameters: {
      draft: { type: 'string', required: true }, asOfChapter: { type: 'integer', required: true },
      mode: { type: 'string', enum: ['auto', 'jianghu', 'mystery', 'reincarnation-mission', 'banter-introspection', 'combat', 'high-level-strategy', 'cosmology-philosophy', 'exposition', 'ensemble-rumor', 'emotional'] },
      query: { type: 'string' }, povCharacter: { type: 'string' }, participants: { type: 'array', items: { type: 'string' } },
      branchId: { type: 'string' }, fanficChapter: { type: 'integer' }, sampleLimit: { type: 'integer' },
      antiCopyMinPhraseChars: { type: 'integer' }, antiCopyMaxFindings: { type: 'integer' },
      targetMinHanChars: { type: 'integer', description: 'Optional minimum Han-character count for the accepted chapter.' },
      targetMaxHanChars: { type: 'integer', description: 'Optional maximum Han-character count for the accepted chapter.' },
    },
    output: jsonObjectOutput('Narrative style drift and anti-copy audit.'),
    async execute(args, exec) {
      return toolObject(await ctx.fanfic.auditNarrativeStyle({
        draft: args.draft,
        asOfChapter: positiveInteger(args.asOfChapter, 'asOfChapter'),
        mode: (args.mode ?? 'auto') as NarrativeStyleMode,
        query: args.query?.trim() ?? '',
        ...(args.povCharacter === undefined ? {} : { povCharacter: nonEmpty(args.povCharacter, 'povCharacter') }),
        participants: uniqueStrings(args.participants ?? []),
        ...(args.branchId === undefined ? {} : { branchId: await resolveBranchRef(ctx, args.branchId, exec.signal) }),
        ...(args.fanficChapter === undefined ? {} : { fanficChapter: positiveInteger(args.fanficChapter, 'fanficChapter') }),
        sampleLimit: positiveInteger(args.sampleLimit ?? defaultStyleSampleLimit, 'sampleLimit'),
        antiCopyMinPhraseChars: positiveInteger(args.antiCopyMinPhraseChars ?? defaultAntiCopyMinPhraseChars, 'antiCopyMinPhraseChars'),
        antiCopyMaxFindings: positiveInteger(args.antiCopyMaxFindings ?? defaultAntiCopyMaxFindings, 'antiCopyMaxFindings'),
        ...(args.targetMinHanChars === undefined ? {} : { targetMinHanChars: positiveInteger(args.targetMinHanChars, 'targetMinHanChars') }),
        ...(args.targetMaxHanChars === undefined ? {} : { targetMaxHanChars: positiveInteger(args.targetMaxHanChars, 'targetMaxHanChars') }),
      }, exec.signal))
    },
    presentCall: args => ({ card: 'generic', title: `Audit narrative style @ ${args.asOfChapter}`, kind: 'read', rawInput: { mode: args.mode ?? 'auto' } }),
  }))

  ctx.tools.register(defineTool({
    name: 'power_assess',
    description: 'Assess source-backed capability constraints for one or more actors at a canon cutoff. It deliberately does not infer a deterministic winner from realm labels.',
    parameters: {
      actors: { type: 'array', required: true, items: { type: 'string' } }, asOfChapter: { type: 'integer', required: true }, scenario: { type: 'string' },
      branchId: { type: 'string' }, fanficChapter: { type: 'integer' }, evidenceLimit: { type: 'integer' },
    },
    output: jsonObjectOutput('Evidence-first power assessment.'),
    async execute(args, exec) {
      return toolObject(await ctx.fanfic.assessPower({
        actors: uniqueStrings(args.actors), asOfChapter: positiveInteger(args.asOfChapter, 'asOfChapter'), scenario: args.scenario?.trim() ?? '',
        ...(args.branchId === undefined ? {} : { branchId: await resolveBranchRef(ctx, args.branchId, exec.signal) }),
        ...(args.fanficChapter === undefined ? {} : { fanficChapter: positiveInteger(args.fanficChapter, 'fanficChapter') }),
        evidenceLimit: positiveInteger(args.evidenceLimit ?? defaultPowerEvidenceLimit, 'evidenceLimit'),
      }, exec.signal))
    },
    presentCall: args => ({ card: 'generic', title: `Assess power @ ${args.asOfChapter}`, kind: 'read', rawInput: args.actors }),
  }))

  ctx.tools.register(defineTool({
    name: 'fanfic_impact_scan',
    description: 'Scan source-backed causal links, dependent canon events, graph-adjacent entities, and current branch causal threads for a proposed divergence. This is dependency discovery, not future prophecy.',
    parameters: {
      asOfChapter: { type: 'integer', required: true }, summary: { type: 'string', required: true }, entities: { type: 'array', items: { type: 'string' } },
      branchId: { type: 'string' }, fanficChapter: { type: 'integer' }, limit: { type: 'integer' },
    },
    output: jsonObjectOutput('Divergence dependency scan.'),
    async execute(args, exec) {
      return toolObject(await ctx.fanfic.impactScan({
        asOfChapter: positiveInteger(args.asOfChapter, 'asOfChapter'), summary: nonEmpty(args.summary, 'summary'), entities: uniqueStrings(args.entities ?? []),
        ...(args.branchId === undefined ? {} : { branchId: await resolveBranchRef(ctx, args.branchId, exec.signal) }),
        ...(args.fanficChapter === undefined ? {} : { fanficChapter: positiveInteger(args.fanficChapter, 'fanficChapter') }),
        limit: positiveInteger(args.limit ?? defaultSearchLimit, 'limit'),
      }, exec.signal))
    },
    presentCall: args => ({ card: 'generic', title: `Scan divergence impact @ ${args.asOfChapter}`, kind: 'search', rawInput: args.summary }),
  }))

  ctx.tools.register(defineTool({
    name: 'canon_enrichment_validate',
    description: 'Validate a proposed structured canon record against an exact immutable chapter excerpt. Returns a token only when evidence and record structure validate.',
    parameters: {
      kind: { type: 'string', required: true, enum: ['fact', 'knowledge', 'character', 'identity', 'power', 'relationship', 'mystery', 'event', 'timeline-rule', 'causal-link'] },
      chapter: { type: 'integer', required: true }, evidence: { type: 'string', required: true }, rationale: { type: 'string' },
      payload: { type: 'object', required: true, additionalProperties: true, properties: {} },
    },
    output: jsonObjectOutput('Canon enrichment evidence validation.'),
    async execute(args, exec) {
      return toolObject(await ctx.fanfic.validateEnrichment({
        kind: args.kind as CanonEnrichmentKind,
        chapter: positiveInteger(args.chapter, 'chapter'), evidence: nonEmpty(args.evidence, 'evidence'),
        payload: args.payload as Record<string, FanficJsonValue>,
        ...(args.rationale === undefined ? {} : { rationale: args.rationale.trim() }),
      }, exec.signal))
    },
    presentCall: args => ({ card: 'generic', title: `Validate ${args.kind} enrichment`, kind: 'read', rawInput: { chapter: args.chapter } }),
  }))

  ctx.tools.register(defineTool({
    name: 'canon_enrichment_commit',
    description: 'Commit a previously token-validated structured canon record into the local verified enrichment overlay. The immutable base canon pack is never modified.',
    parameters: {
      token: { type: 'string', required: true }, kind: { type: 'string', required: true, enum: ['fact', 'knowledge', 'character', 'identity', 'power', 'relationship', 'mystery', 'event', 'timeline-rule', 'causal-link'] },
      chapter: { type: 'integer', required: true }, evidence: { type: 'string', required: true }, rationale: { type: 'string' },
      payload: { type: 'object', required: true, additionalProperties: true, properties: {} },
    },
    output: jsonObjectOutput('Committed verified canon enrichment.'),
    async execute(args, exec) {
      const candidate = {
        kind: args.kind as CanonEnrichmentKind,
        chapter: positiveInteger(args.chapter, 'chapter'), evidence: nonEmpty(args.evidence, 'evidence'),
        payload: args.payload as Record<string, FanficJsonValue>,
        ...(args.rationale === undefined ? {} : { rationale: args.rationale.trim() }),
      }
      return toolObject(await ctx.fanfic.commitEnrichment({ candidate, token: nonEmpty(args.token, 'token') }, exec.signal))
    },
    presentCall: args => ({ card: 'generic', title: `Commit ${args.kind} enrichment`, kind: 'edit', rawInput: { chapter: args.chapter } }),
  }))

  ctx.tools.register(defineTool({
    name: 'canon_enrichment_plan',
    description: 'Return the next source chapters whose selected structured record families have not been reviewed. This is a deterministic work queue for LLM-driven canon digestion.',
    parameters: {
      fromChapter: { type: 'integer', required: true }, toChapter: { type: 'integer', required: true },
      kinds: { type: 'array', required: true, items: { type: 'string', enum: ['fact', 'knowledge', 'character', 'identity', 'power', 'relationship', 'mystery', 'event', 'timeline-rule', 'causal-link'] } },
      batchSize: { type: 'integer' },
    },
    output: jsonObjectOutput('Deterministic canon-enrichment work queue.'),
    async execute(args, exec) {
      return toolObject(await ctx.fanfic.planEnrichment({
        fromChapter: positiveInteger(args.fromChapter, 'fromChapter'), toChapter: positiveInteger(args.toChapter, 'toChapter'),
        kinds: (args.kinds as CanonEnrichmentKind[]), batchSize: positiveInteger(args.batchSize ?? defaultEnrichmentBatchSize, 'batchSize'),
      }, exec.signal))
    },
    presentCall: args => ({ card: 'generic', title: `Plan canon enrichment ${args.fromChapter}–${args.toChapter}`, kind: 'search', rawInput: args.kinds }),
  }))

  ctx.tools.register(defineTool({
    name: 'canon_enrichment_progress',
    description: 'Inspect effective chapter × record-family enrichment coverage so already-reviewed source units are not repeatedly digested.',
    parameters: {
      fromChapter: { type: 'integer', required: true }, toChapter: { type: 'integer', required: true },
      kinds: { type: 'array', required: true, items: { type: 'string', enum: ['fact', 'knowledge', 'character', 'identity', 'power', 'relationship', 'mystery', 'event', 'timeline-rule', 'causal-link'] } },
    },
    output: jsonObjectOutput('Canon-enrichment coverage report.'),
    async execute(args, exec) {
      return toolObject(await ctx.fanfic.enrichmentProgress({
        fromChapter: positiveInteger(args.fromChapter, 'fromChapter'), toChapter: positiveInteger(args.toChapter, 'toChapter'), kinds: args.kinds as CanonEnrichmentKind[],
      }, exec.signal))
    },
    presentCall: args => ({ card: 'generic', title: `Enrichment progress ${args.fromChapter}–${args.toChapter}`, kind: 'read', rawInput: args.kinds }),
  }))

  ctx.tools.register(defineTool({
    name: 'canon_enrichment_checkpoint',
    description: 'Mark one chapter and structured record family reviewed after all accepted records for that pass have been committed. Referenced record ids must exist and be sourced from that exact chapter; use noFindings only after an actual review found nothing worth admitting.',
    parameters: {
      chapter: { type: 'integer', required: true },
      kind: { type: 'string', required: true, enum: ['fact', 'knowledge', 'character', 'identity', 'power', 'relationship', 'mystery', 'event', 'timeline-rule', 'causal-link'] },
      recordIds: { type: 'array', items: { type: 'string' } }, noFindings: { type: 'boolean', required: true }, notes: { type: 'string' },
    },
    output: jsonObjectOutput('Persisted canon-enrichment coverage checkpoint.'),
    async execute(args, exec) {
      return toolObject(await ctx.fanfic.checkpointEnrichment({
        chapter: positiveInteger(args.chapter, 'chapter'), kind: args.kind as CanonEnrichmentKind,
        recordIds: uniqueStrings(args.recordIds ?? []), noFindings: args.noFindings, notes: args.notes?.trim() ?? '',
      }, exec.signal))
    },
    presentCall: args => ({ card: 'generic', title: `Checkpoint ${args.kind} @ chapter ${args.chapter}`, kind: 'edit', rawInput: { recordIds: args.recordIds ?? [], noFindings: args.noFindings } }),
  }))

  ctx.tools.register(defineTool({
    name: 'author_context',
    description: 'Compose the scene packet a fanfic planner/writer should use: established canon truth, POV epistemics, source evidence, divergence policy, optional branch overlay, and workflow constraints.',
    parameters: {
      asOfChapter: { type: 'integer', required: true },
      povCharacter: { type: 'string', required: true },
      participants: { type: 'array', items: { type: 'string' } },
      sceneGoal: { type: 'string', required: true },
      query: { type: 'string' },
      branchId: { type: 'string' },
      fanficChapter: { type: 'integer' },
      storyHorizonSize: { type: 'integer', description: `Rolling Director horizon; defaults to ${defaultStoryHorizonSize}.` },
      styleMode: { type: 'string', enum: ['auto', 'jianghu', 'mystery', 'reincarnation-mission', 'banter-introspection', 'combat', 'high-level-strategy', 'cosmology-philosophy', 'exposition', 'ensemble-rumor', 'emotional'] },
      styleSampleLimit: { type: 'integer', description: `Narrative style evidence windows; defaults to ${defaultStyleSampleLimit}.` },
    },
    output: jsonObjectOutput('Author scene context.'),
    async execute(args, exec) {
      return toolObject(await ctx.fanfic.authorContext({
        asOfChapter: positiveInteger(args.asOfChapter, 'asOfChapter'),
        povCharacter: nonEmpty(args.povCharacter, 'povCharacter'),
        participants: uniqueStrings(args.participants ?? []),
        sceneGoal: nonEmpty(args.sceneGoal, 'sceneGoal'),
        query: args.query?.trim() ?? '',
        ...(args.branchId === undefined ? {} : { branchId: await resolveBranchRef(ctx, args.branchId, exec.signal) }),
        ...(args.fanficChapter === undefined ? {} : { fanficChapter: positiveInteger(args.fanficChapter, 'fanficChapter') }),
        storyHorizonSize: positiveInteger(args.storyHorizonSize ?? defaultStoryHorizonSize, 'storyHorizonSize'),
        styleMode: (args.styleMode ?? 'auto') as NarrativeStyleMode,
        styleSampleLimit: positiveInteger(args.styleSampleLimit ?? defaultStyleSampleLimit, 'styleSampleLimit'),
      }, exec.signal))
    },
    presentCall: args => ({ card: 'generic', title: `Build author context @ canon ${args.asOfChapter}`, kind: 'read', rawInput: { pov: args.povCharacter, goal: args.sceneGoal } }),
  }))

  ctx.tools.register(defineTool({
    name: 'fanfic_branch_list',
    description: 'List existing local fanfic branches and their latest revisions.',
    parameters: {},
    output: { schema: { type: 'array', items: { type: 'object', additionalProperties: true } }, render: (_args, value) => jsonText(value) },
    execute: async (_args, exec) => toolObjectArray(
      (await ctx.fanfic.listBranches(exec.signal)).map(branch => compactBranchSummary(branch)),
    ),
    presentCall: () => ({ card: 'generic', title: 'List fanfic branches', kind: 'read' }),
  }))

  ctx.tools.register(defineTool({
    name: 'fanfic_branch_create',
    description: 'Create an isolated mutable fanfic branch at a canon starting chapter. Original canon remains immutable.',
    parameters: {
      name: { type: 'string', required: true },
      baseChapter: { type: 'integer', required: true },
      notes: { type: 'string' },
      premise: { type: 'string' },
      divergenceMode: { type: 'string', enum: ['canon-compliant', 'soft-divergence', 'hard-au'] },
    },
    output: jsonObjectOutput('Created branch snapshot.'),
    async execute(args, exec) {
      const authorIntent = args.premise === undefined && args.divergenceMode === undefined ? undefined : {
        ...(args.premise === undefined ? {} : { premise: args.premise.trim() }),
        ...(args.divergenceMode === undefined ? {} : { divergenceMode: args.divergenceMode as FanficAuthorIntent['divergenceMode'] }),
      }
      const branch = await ctx.fanfic.createBranch({
        name: nonEmpty(args.name, 'name'),
        baseChapter: positiveInteger(args.baseChapter, 'baseChapter'),
        notes: args.notes?.trim() ?? '',
        ...(authorIntent === undefined ? {} : { authorIntent }),
      }, exec.signal)
      return toolObject(compactBranchSummary(branch))
    },
    presentCall: args => ({ card: 'generic', title: `Create fanfic branch ${args.name}`, kind: 'edit', rawInput: { baseChapter: args.baseChapter } }),
  }))

  ctx.tools.register(defineTool({
    name: 'fanfic_branch_get',
    description: 'Read the full administrative branch snapshot, including later fanfic state. Do not use this as scene context; use author_context with fanficChapter to avoid fanfic-future leakage.',
    parameters: { branchId: { type: 'string', required: true, description: 'Branch UUID or unique branch name.' } },
    output: jsonObjectOutput('Fanfic branch snapshot.'),
    async execute(args, exec) {
      const branchId = await resolveBranchRef(ctx, args.branchId, exec.signal)
      return toolObject(await ctx.fanfic.getBranch(branchId, exec.signal))
    },
    presentCall: args => ({ card: 'generic', title: 'Read fanfic branch', kind: 'read', rawInput: args.branchId }),
  }))

  ctx.tools.register(defineTool({
    name: 'fanfic_chapter_state',
    description: 'Inspect the active structured state owned by one fanfic chapter version. Use this before a rewrite to decide what to inherit, drop, or replace without fetching the entire branch.',
    parameters: { branchId: { type: 'string', required: true, description: 'Branch UUID or unique branch name.' }, fanficChapter: { type: 'integer', required: true } },
    output: jsonObjectOutput('Active chapter-version state with record ids.'),
    async execute(args, exec) {
      const branch = await ctx.fanfic.getBranch(await resolveBranchRef(ctx, args.branchId, exec.signal), exec.signal)
      const chapter = positiveInteger(args.fanficChapter, 'fanficChapter')
      const version = branch.chapterVersions.find(item => item.status === 'active' && item.fanficChapter === chapter)
      if (version === undefined) throw new Error(`fanfic chapter ${chapter} has no active accepted version`)
      return toolObject({
        branchId: branch.id, revision: branch.revision, fanficChapter: chapter, version,
        facts: branch.facts.filter(item => item.originChapterVersionId === version.id),
        knowledge: branch.knowledge.filter(item => item.originChapterVersionId === version.id),
        characterStates: branch.characterStates.filter(item => item.originChapterVersionId === version.id),
        relationships: branch.relationships.filter(item => item.originChapterVersionId === version.id),
        causalThreads: branch.causalThreads.filter(item => item.originChapterVersionId === version.id),
        summary: branch.chapterSummaries.find(item => item.chapterVersionId === version.id)?.summary ?? null,
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'fanfic_intent_update',
    description: 'Replace the branch author intent with compare-and-set revision. This is project policy for premise, divergence mode, themes, tone, POV, character priorities, forbidden outcomes, and style notes.',
    parameters: {
      branchId: { type: 'string', required: true, description: 'Branch UUID or unique branch name.' },
      expectedRevision: { type: 'integer', required: true },
      premise: { type: 'string', required: true },
      divergenceMode: { type: 'string', required: true, enum: ['canon-compliant', 'soft-divergence', 'hard-au'] },
      themes: { type: 'array', items: { type: 'string' } },
      tone: { type: 'array', items: { type: 'string' } },
      povPolicy: { type: 'array', items: { type: 'string' } },
      characterPriorities: { type: 'array', items: { type: 'string' } },
      forbiddenOutcomes: { type: 'array', items: { type: 'string' } },
      styleNotes: { type: 'array', items: { type: 'string' } },
    },
    output: jsonObjectOutput('Updated branch author intent.'),
    async execute(args, exec) {
      const authorIntent: FanficAuthorIntent = {
        premise: args.premise.trim(),
        divergenceMode: args.divergenceMode as FanficAuthorIntent['divergenceMode'],
        themes: uniqueStrings(args.themes ?? []),
        tone: uniqueStrings(args.tone ?? []),
        povPolicy: uniqueStrings(args.povPolicy ?? []),
        characterPriorities: uniqueStrings(args.characterPriorities ?? []),
        forbiddenOutcomes: uniqueStrings(args.forbiddenOutcomes ?? []),
        styleNotes: uniqueStrings(args.styleNotes ?? []),
      }
      const branch = await ctx.fanfic.updateIntent({
        branchId: await resolveBranchRef(ctx, args.branchId, exec.signal),
        expectedRevision: positiveInteger(args.expectedRevision, 'expectedRevision'),
        authorIntent,
      }, exec.signal)
      return toolObject(compactMutation(branch, 'author-intent'))
    },
    presentCall: args => ({ card: 'generic', title: 'Update fanfic author intent', kind: 'edit', rawInput: { branchId: args.branchId, divergenceMode: args.divergenceMode } }),
  }))

  ctx.tools.register(defineTool({
    name: 'story_director_context',
    description: 'Build the compact long-form planning packet for a branch: active arcs, prioritized threads, due promises, live foreshadows, rolling chapter horizon, recent summaries, unresolved divergence consequences, and deterministic attention items.',
    parameters: {
      branchId: { type: 'string', required: true, description: 'Branch UUID or unique branch name.' }, fanficChapter: { type: 'integer', required: true }, horizonSize: { type: 'integer' },
    },
    output: jsonObjectOutput('Long-form Story Director context.'),
    async execute(args, exec) {
      return toolObject(await ctx.fanfic.storyDirectorContext({
        branchId: await resolveBranchRef(ctx, args.branchId, exec.signal), fanficChapter: positiveInteger(args.fanficChapter, 'fanficChapter'), horizonSize: positiveInteger(args.horizonSize ?? defaultStoryHorizonSize, 'horizonSize'),
      }, exec.signal))
    },
    presentCall: args => ({ card: 'generic', title: `Story Director @ fanfic ${args.fanficChapter}`, kind: 'read', rawInput: args.branchId }),
  }))

  ctx.tools.register(defineTool({
    name: 'story_arc_upsert',
    description: 'Create or replace one Story Director arc using an explicit schema and compare-and-set branch revision.',
    parameters: { branchId: { type: 'string', required: true, description: 'Branch UUID or unique branch name.' }, expectedRevision: { type: 'integer', required: true }, arc: storyArcSchema() },
    output: jsonObjectOutput('Compact branch update result.'),
    async execute(args, exec) { const branch = await ctx.fanfic.upsertStoryArc({ branchId: await resolveBranchRef(ctx, args.branchId, exec.signal), expectedRevision: positiveInteger(args.expectedRevision, 'expectedRevision'), arc: args.arc as unknown as FanficStoryArc }, exec.signal); return toolObject(compactMutation(branch, 'story-arc')) },
  }))

  ctx.tools.register(defineTool({
    name: 'story_thread_upsert',
    description: 'Create or replace one plot/character/mystery/relationship/theme thread with explicit fields.',
    parameters: { branchId: { type: 'string', required: true, description: 'Branch UUID or unique branch name.' }, expectedRevision: { type: 'integer', required: true }, thread: storyThreadSchema() },
    output: jsonObjectOutput('Compact branch update result.'),
    async execute(args, exec) { const branch = await ctx.fanfic.upsertStoryThread({ branchId: await resolveBranchRef(ctx, args.branchId, exec.signal), expectedRevision: positiveInteger(args.expectedRevision, 'expectedRevision'), thread: args.thread as unknown as FanficStoryThread }, exec.signal); return toolObject(compactMutation(branch, 'story-thread')) },
  }))

  ctx.tools.register(defineTool({
    name: 'story_foreshadow_upsert',
    description: 'Create or replace one foreshadow/payoff promise with explicit reveal timing metadata.',
    parameters: { branchId: { type: 'string', required: true, description: 'Branch UUID or unique branch name.' }, expectedRevision: { type: 'integer', required: true }, foreshadow: foreshadowSchema() },
    output: jsonObjectOutput('Compact branch update result.'),
    async execute(args, exec) { const branch = await ctx.fanfic.upsertForeshadow({ branchId: await resolveBranchRef(ctx, args.branchId, exec.signal), expectedRevision: positiveInteger(args.expectedRevision, 'expectedRevision'), foreshadow: args.foreshadow as unknown as FanficForeshadow }, exec.signal); return toolObject(compactMutation(branch, 'foreshadow')) },
  }))

  ctx.tools.register(defineTool({
    name: 'story_horizon_set',
    description: 'Replace the rolling 3–5 chapter horizon with explicitly validated chapter plans.',
    parameters: { branchId: { type: 'string', required: true, description: 'Branch UUID or unique branch name.' }, expectedRevision: { type: 'integer', required: true }, horizon: { type: 'array', required: true, items: chapterPlanSchema() } },
    output: jsonObjectOutput('Compact branch update result.'),
    async execute(args, exec) { const branch = await ctx.fanfic.setStoryHorizon({ branchId: await resolveBranchRef(ctx, args.branchId, exec.signal), expectedRevision: positiveInteger(args.expectedRevision, 'expectedRevision'), horizon: args.horizon as unknown as FanficChapterPlan[] }, exec.signal); return toolObject(compactMutation(branch, 'story-horizon')) },
  }))

  ctx.tools.register(defineTool({
    name: 'mystery_truth_upsert',
    description: 'Persist the author-only truth behind a fanfic-original mystery. This is writer metadata and MUST NOT be treated as POV knowledge.',
    parameters: { branchId: { type: 'string', required: true, description: 'Branch UUID or unique branch name.' }, expectedRevision: { type: 'integer', required: true }, mysteryTruth: mysteryTruthSchema() },
    output: jsonObjectOutput('Compact branch update result.'),
    async execute(args, exec) { const branch = await ctx.fanfic.upsertMysteryTruth({ branchId: await resolveBranchRef(ctx, args.branchId, exec.signal), expectedRevision: positiveInteger(args.expectedRevision, 'expectedRevision'), mysteryTruth: args.mysteryTruth as unknown as FanficMysteryTruth }, exec.signal); return toolObject(compactMutation(branch, 'mystery-truth')) },
  }))

  ctx.tools.register(defineTool({
    name: 'invention_upsert',
    description: 'Register a fanfic-original artifact, technique, organization, mechanism, character, or location with stable capabilities, constraints, costs, source, and canon-compatibility notes.',
    parameters: { branchId: { type: 'string', required: true, description: 'Branch UUID or unique branch name.' }, expectedRevision: { type: 'integer', required: true }, invention: inventionSchema() },
    output: jsonObjectOutput('Compact branch update result.'),
    async execute(args, exec) { const branch = await ctx.fanfic.upsertInvention({ branchId: await resolveBranchRef(ctx, args.branchId, exec.signal), expectedRevision: positiveInteger(args.expectedRevision, 'expectedRevision'), invention: args.invention as unknown as FanficInvention }, exec.signal); return toolObject(compactMutation(branch, 'invention')) },
  }))

  ctx.tools.register(defineTool({
    name: 'story_reconciliation_resolve',
    description: 'Mark one Story Director reconciliation issue resolved after the affected horizon/thread/foreshadow/arc metadata has been reviewed and updated.',
    parameters: { branchId: { type: 'string', required: true, description: 'Branch UUID or unique branch name.' }, expectedRevision: { type: 'integer', required: true }, reconciliationId: { type: 'string', required: true } },
    output: jsonObjectOutput('Compact branch update result.'),
    async execute(args, exec) { const branch = await ctx.fanfic.resolveDirectorReconciliation({ branchId: await resolveBranchRef(ctx, args.branchId, exec.signal), expectedRevision: positiveInteger(args.expectedRevision, 'expectedRevision'), reconciliationId: nonEmpty(args.reconciliationId, 'reconciliationId') }, exec.signal); return toolObject(compactMutation(branch, 'story-reconciliation')) },
  }))

  ctx.tools.register(defineTool({
    name: 'fanfic_divergence_record',
    description: 'Record the event where a branch stops following canon. Requires the latest branch revision so concurrent writers cannot overwrite each other.',
    parameters: {
      branchId: { type: 'string', required: true, description: 'Branch UUID or unique branch name.' },
      expectedRevision: { type: 'integer', required: true },
      atChapter: { type: 'integer', required: true },
      eventOrdinal: { type: 'integer', description: 'Optional 1-based canon event order within the chapter; use for mid-chapter divergence.' },
      afterEventId: { type: 'string', description: 'Optional structured canon event id after which divergence begins.' },
      sceneId: { type: 'string' },
      summary: { type: 'string', required: true },
      immediateConsequences: { type: 'array', items: { type: 'string' } },
      openQuestions: { type: 'array', items: { type: 'string' } },
    },
    output: jsonObjectOutput('Updated branch snapshot.'),
    async execute(args, exec) {
      const branch = await ctx.fanfic.recordDivergence({
        branchId: await resolveBranchRef(ctx, args.branchId, exec.signal),
        expectedRevision: positiveInteger(args.expectedRevision, 'expectedRevision'),
        atChapter: positiveInteger(args.atChapter, 'atChapter'),
        ...(args.eventOrdinal === undefined ? {} : { eventOrdinal: positiveInteger(args.eventOrdinal, 'eventOrdinal') }),
        ...(args.afterEventId === undefined ? {} : { afterEventId: nonEmpty(args.afterEventId, 'afterEventId') }),
        ...(args.sceneId === undefined ? {} : { sceneId: nonEmpty(args.sceneId, 'sceneId') }),
        summary: nonEmpty(args.summary, 'summary'),
        immediateConsequences: uniqueStrings(args.immediateConsequences ?? []),
        openQuestions: uniqueStrings(args.openQuestions ?? []),
      }, exec.signal)
      return toolObject(compactMutation(branch, 'divergence'))
    },
    presentCall: args => ({ card: 'generic', title: `Record divergence @ canon ${args.atChapter}`, kind: 'edit', rawInput: args.summary }),
  }))

  ctx.tools.register(defineTool({
    name: 'fanfic_apply_delta',
    description: 'Transactional accepted-chapter commit. Requires passing canon/style/anti-copy receipts for the exact draft. New chapters persist structured state; rewrites explicitly inherit or replace the prior active chapter version.',
    parameters: {
      branchId: { type: 'string', required: true, description: 'Branch UUID or unique branch name.' },
      expectedRevision: { type: 'integer', required: true },
      fanficChapter: { type: 'integer', required: true },
      draft: { type: 'string', required: true, description: 'Exact accepted prose that produced the audit receipts.' },
      auditReceiptIds: { type: 'array', required: true, items: { type: 'string' }, description: 'Exactly three receipts from fanfic_audit, fanfic_style_audit, and anti_copy_guard for this draft/revision.' },
      rewriteMode: { type: 'string', enum: ['inherit', 'replace'], description: 'Required only when rewriting an existing chapter. inherit carries prior structured state; replace discards it.' },
      dropInheritedRecordIds: { type: 'array', items: { type: 'string' }, description: 'When rewriteMode=inherit, old chapter record ids to omit from the inherited state.' },
      confirmDroppedState: { type: 'boolean', description: 'Required true when rewriteMode=replace would discard active structured state.' },
      chapterSummary: { type: 'string' },
      facts: {
        type: 'array', items: {
          type: 'object', additionalProperties: false, properties: {
            subject: { type: 'string', required: true }, predicate: { type: 'string', required: true }, object: { type: 'string', required: true },
            validFromFanficChapter: { type: 'integer', required: true }, validUntilFanficChapter: { type: 'integer' },
          },
        },
      },
      knowledge: {
        type: 'array', items: {
          type: 'object', additionalProperties: false, properties: {
            character: { type: 'string', required: true },
            subject: { type: 'string' }, predicate: { type: 'string' }, object: { type: 'string' },
            summary: { type: 'string', required: true },
            stance: { type: 'string', required: true, enum: ['knows', 'suspects', 'believes-false'] }, fromFanficChapter: { type: 'integer', required: true },
          },
        },
      },
      characterStates: {
        type: 'array', items: { type: 'object', additionalProperties: false, properties: { character: { type: 'string', required: true }, summary: { type: 'string', required: true }, fromFanficChapter: { type: 'integer', required: true } } },
      },
      relationships: {
        type: 'array', items: { type: 'object', additionalProperties: false, properties: { subject: { type: 'string', required: true }, object: { type: 'string', required: true }, summary: { type: 'string', required: true }, fromFanficChapter: { type: 'integer', required: true } } },
      },
      causalThreads: {
        type: 'array', items: { type: 'object', additionalProperties: false, properties: { summary: { type: 'string', required: true }, status: { type: 'string', required: true, enum: ['open', 'resolved'] }, fromFanficChapter: { type: 'integer', required: true } } },
      },
      resolveCausalThreadIds: { type: 'array', items: { type: 'string' }, description: 'Existing branch causal-thread ids to mark resolved by this accepted chapter.' },
    },
    output: jsonObjectOutput('Updated branch snapshot.'),
    async execute(args, exec) {
      const delta: FanficStateDelta = {
        fanficChapter: positiveInteger(args.fanficChapter, 'fanficChapter'),
        ...(args.chapterSummary === undefined ? {} : { chapterSummary: nonEmpty(args.chapterSummary, 'chapterSummary') }),
        ...(args.facts === undefined ? {} : { facts: args.facts.map(item => ({ subject: nonEmpty(item.subject, 'fact.subject'), predicate: nonEmpty(item.predicate, 'fact.predicate'), object: item.object as FanficJsonValue, validFromFanficChapter: positiveInteger(item.validFromFanficChapter, 'fact.validFromFanficChapter'), ...(item.validUntilFanficChapter === undefined ? {} : { validUntilFanficChapter: positiveInteger(item.validUntilFanficChapter, 'fact.validUntilFanficChapter') }) })) }),
        ...(args.knowledge === undefined ? {} : { knowledge: args.knowledge.map(item => ({
          character: nonEmpty(item.character, 'knowledge.character'),
          ...(item.subject === undefined ? {} : { subject: nonEmpty(item.subject, 'knowledge.subject') }),
          ...(item.predicate === undefined ? {} : { predicate: nonEmpty(item.predicate, 'knowledge.predicate') }),
          ...(item.object === undefined ? {} : { object: nonEmpty(item.object, 'knowledge.object') }),
          summary: nonEmpty(item.summary, 'knowledge.summary'),
          stance: item.stance as 'knows' | 'suspects' | 'believes-false',
          fromFanficChapter: positiveInteger(item.fromFanficChapter, 'knowledge.fromFanficChapter'),
        })) }),
        ...(args.characterStates === undefined ? {} : { characterStates: args.characterStates.map(item => ({ character: nonEmpty(item.character, 'characterState.character'), summary: nonEmpty(item.summary, 'characterState.summary'), fromFanficChapter: positiveInteger(item.fromFanficChapter, 'characterState.fromFanficChapter') })) }),
        ...(args.relationships === undefined ? {} : { relationships: args.relationships.map(item => ({ subject: nonEmpty(item.subject, 'relationship.subject'), object: nonEmpty(item.object, 'relationship.object'), summary: nonEmpty(item.summary, 'relationship.summary'), fromFanficChapter: positiveInteger(item.fromFanficChapter, 'relationship.fromFanficChapter') })) }),
        ...(args.causalThreads === undefined ? {} : { causalThreads: args.causalThreads.map(item => ({ summary: nonEmpty(item.summary, 'causalThread.summary'), status: item.status as 'open' | 'resolved', fromFanficChapter: positiveInteger(item.fromFanficChapter, 'causalThread.fromFanficChapter') })) }),
        ...(args.resolveCausalThreadIds === undefined ? {} : { resolveCausalThreadIds: uniqueStrings(args.resolveCausalThreadIds) }),
      }
      const branch = await ctx.fanfic.applyDelta({
        branchId: await resolveBranchRef(ctx, args.branchId, exec.signal), expectedRevision: positiveInteger(args.expectedRevision, 'expectedRevision'), delta,
        draft: nonEmpty(args.draft, 'draft'), auditReceiptIds: uniqueStrings(args.auditReceiptIds),
        ...(args.rewriteMode === undefined ? {} : { rewriteMode: args.rewriteMode as 'inherit' | 'replace' }),
        ...(args.dropInheritedRecordIds === undefined ? {} : { dropInheritedRecordIds: uniqueStrings(args.dropInheritedRecordIds) }),
        ...(args.confirmDroppedState === undefined ? {} : { confirmDroppedState: args.confirmDroppedState }),
      }, exec.signal)
      return toolObject(compactChapterCommit(branch, delta))
    },
    presentCall: args => ({ card: 'generic', title: `Commit fanfic state for chapter ${args.fanficChapter}`, kind: 'edit', rawInput: { branchId: args.branchId, expectedRevision: args.expectedRevision } }),
  }))

  ctx.tools.register(defineTool({
    name: 'fanfic_audit',
    description: 'Run deterministic spoiler/reveal checks and validate structured knowledge, identity, canon-fact, and power claims against the current canon snapshot. Missing graph data yields warnings, not invented facts.',
    parameters: {
      draft: { type: 'string', required: true },
      asOfChapter: { type: 'integer', required: true },
      povCharacter: { type: 'string', required: true },
      branchId: { type: 'string' },
      fanficChapter: { type: 'integer', description: 'Fanfic chapter being audited; state from this chapter and later is hidden so rewrites cannot self-justify.' },
      participants: { type: 'array', items: { type: 'string' }, description: 'Scene participants used by the independent claim extractor.' },
      claims: {
        type: 'array', items: {
          type: 'object', additionalProperties: false, properties: {
            kind: { type: 'string', required: true, enum: ['knowledge', 'canon-fact', 'identity', 'power'] },
            subject: { type: 'string', required: true }, predicate: { type: 'string' }, object: { type: 'string' },
          },
        },
      },
    },
    output: jsonObjectOutput('Deterministic fanfic audit result.'),
    async execute(args, exec) {
      const claims = (args.claims ?? []).map((claim): FanficAuditClaim => ({
        kind: claim.kind as FanficAuditClaim['kind'], subject: nonEmpty(claim.subject, 'claim.subject'),
        ...(claim.predicate === undefined ? {} : { predicate: nonEmpty(claim.predicate, 'claim.predicate') }),
        ...(claim.object === undefined ? {} : { object: nonEmpty(claim.object, 'claim.object') }),
      }))
      if (claims.length > maxAuditClaims) throw new Error(`fanfic_audit accepts at most ${maxAuditClaims} claims`)
      return toolObject(await ctx.fanfic.audit({
        draft: args.draft,
        asOfChapter: positiveInteger(args.asOfChapter, 'asOfChapter'),
        povCharacter: nonEmpty(args.povCharacter, 'povCharacter'),
        ...(args.branchId === undefined ? {} : { branchId: await resolveBranchRef(ctx, args.branchId, exec.signal) }),
        ...(args.fanficChapter === undefined ? {} : { fanficChapter: positiveInteger(args.fanficChapter, 'fanficChapter') }),
        participants: uniqueStrings(args.participants ?? []),
        claims,
      }, exec.signal))
    },
    presentCall: args => ({ card: 'generic', title: `Audit fanfic @ canon ${args.asOfChapter}`, kind: 'read', rawInput: { pov: args.povCharacter, claims: args.claims?.length ?? 0 } }),
  }))
}


function compactBranchSummary(branch: FanficBranch) {
  const activeVersions = branch.chapterVersions.filter(item => item.status === 'active')
  return {
    id: branch.id, name: branch.name, revision: branch.revision, baseChapter: branch.baseChapter,
    latestFanficChapter: activeVersions.reduce((max, item) => Math.max(max, item.fanficChapter), 0),
    activeChapterVersions: activeVersions.length, divergenceCount: branch.divergences.length, updatedAt: branch.updatedAt,
  }
}

function compactMutation(branch: FanficBranch, changed: string) {
  return { branchId: branch.id, revision: branch.revision, changed, updatedAt: branch.updatedAt }
}

function compactChapterCommit(branch: FanficBranch, delta: FanficStateDelta) {
  const version = branch.chapterVersions.find(item => item.fanficChapter === delta.fanficChapter && item.status === 'active')
  const versionId = version?.id ?? ''
  return {
    branchId: branch.id, revision: branch.revision, fanficChapter: delta.fanficChapter, chapterVersionId: versionId, rewriteMode: version?.rewriteMode ?? 'initial',
    activeState: {
      facts: branch.facts.filter(item => item.originChapterVersionId === versionId).length,
      knowledge: branch.knowledge.filter(item => item.originChapterVersionId === versionId).length,
      characterStates: branch.characterStates.filter(item => item.originChapterVersionId === versionId).length,
      relationships: branch.relationships.filter(item => item.originChapterVersionId === versionId).length,
      causalThreads: branch.causalThreads.filter(item => item.originChapterVersionId === versionId).length,
    },
    applied: {
      facts: delta.facts?.length ?? 0,
      knowledge: delta.knowledge?.length ?? 0,
      characterStates: delta.characterStates?.length ?? 0,
      relationships: delta.relationships?.length ?? 0,
      causalThreads: delta.causalThreads?.length ?? 0,
      resolvedCausalThreads: delta.resolveCausalThreadIds?.length ?? 0,
      chapterSummary: delta.chapterSummary !== undefined,
    },
    openDirectorReconciliations: branch.storyDirector.reconciliation.filter(item => item.status === 'open').length,
  }
}

function storyArcSchema() { return { type: 'object' as const, required: true as const, additionalProperties: false as const, properties: {
  id: { type: 'string' as const, required: true as const }, title: { type: 'string' as const, required: true as const }, status: { type: 'string' as const, required: true as const, enum: ['planned', 'active', 'completed', 'abandoned'] },
  objective: { type: 'string' as const, required: true as const }, centralConflict: { type: 'string' as const, required: true as const }, themes: { type: 'array' as const, items: { type: 'string' as const } }, characters: { type: 'array' as const, items: { type: 'string' as const } }, startFanficChapter: { type: 'integer' as const }, targetEndFanficChapter: { type: 'integer' as const }, plannedPayoffs: { type: 'array' as const, items: { type: 'string' as const } }, notes: { type: 'array' as const, items: { type: 'string' as const } },
} } }
function storyThreadSchema() { return { type: 'object' as const, required: true as const, additionalProperties: false as const, properties: {
  id: { type: 'string' as const, required: true as const }, kind: { type: 'string' as const, required: true as const, enum: ['plot', 'character', 'mystery', 'relationship', 'theme'] }, status: { type: 'string' as const, required: true as const, enum: ['open', 'dormant', 'resolved', 'abandoned'] }, priority: { type: 'integer' as const, required: true as const }, summary: { type: 'string' as const, required: true as const }, entities: { type: 'array' as const, items: { type: 'string' as const } }, openedFanficChapter: { type: 'integer' as const, required: true as const }, targetFanficChapter: { type: 'integer' as const }, dependencies: { type: 'array' as const, items: { type: 'string' as const } }, resolutionCriteria: { type: 'array' as const, items: { type: 'string' as const } },
} } }
function foreshadowSchema() { return { type: 'object' as const, required: true as const, additionalProperties: false as const, properties: {
  id: { type: 'string' as const, required: true as const }, status: { type: 'string' as const, required: true as const, enum: ['planned', 'planted', 'paid-off', 'retired'] }, clue: { type: 'string' as const, required: true as const }, payoff: { type: 'string' as const, required: true as const }, relatedThreads: { type: 'array' as const, items: { type: 'string' as const } }, plantedFanficChapter: { type: 'integer' as const }, targetFanficChapter: { type: 'integer' as const }, payoffFanficChapter: { type: 'integer' as const }, subtlety: { type: 'string' as const, required: true as const, enum: ['background', 'noticeable', 'explicit'] },
} } }
function chapterPlanSchema() { return { type: 'object' as const, additionalProperties: false as const, properties: {
  fanficChapter: { type: 'integer' as const, required: true as const }, status: { type: 'string' as const, required: true as const, enum: ['planned', 'drafted', 'accepted'] }, goal: { type: 'string' as const, required: true as const }, pov: { type: 'string' as const, required: true as const }, beats: { type: 'array' as const, items: { type: 'string' as const } }, advanceThreads: { type: 'array' as const, items: { type: 'string' as const } }, plantForeshadows: { type: 'array' as const, items: { type: 'string' as const } }, payoffForeshadows: { type: 'array' as const, items: { type: 'string' as const } }, constraints: { type: 'array' as const, items: { type: 'string' as const } },
} } }
function mysteryTruthSchema() { return { type: 'object' as const, required: true as const, additionalProperties: false as const, properties: {
  id: { type: 'string' as const, required: true as const }, status: { type: 'string' as const, required: true as const, enum: ['planned', 'active', 'revealed', 'retired'] }, label: { type: 'string' as const, required: true as const }, secretTruth: { type: 'string' as const, required: true as const }, mechanism: { type: 'string' as const, required: true as const }, allowedClues: { type: 'array' as const, items: { type: 'string' as const } }, falseLeads: { type: 'array' as const, items: { type: 'string' as const } }, revealConditions: { type: 'array' as const, items: { type: 'string' as const } }, plannedPayoff: { type: 'string' as const, required: true as const }, relatedThreads: { type: 'array' as const, items: { type: 'string' as const } },
} } }
function inventionSchema() { return { type: 'object' as const, required: true as const, additionalProperties: false as const, properties: {
  id: { type: 'string' as const, required: true as const }, kind: { type: 'string' as const, required: true as const, enum: ['artifact', 'technique', 'organization', 'mechanism', 'character', 'location', 'other'] }, name: { type: 'string' as const, required: true as const }, originFanficChapter: { type: 'integer' as const, required: true as const }, summary: { type: 'string' as const, required: true as const }, capabilities: { type: 'array' as const, items: { type: 'string' as const } }, constraints: { type: 'array' as const, items: { type: 'string' as const } }, costs: { type: 'array' as const, items: { type: 'string' as const } }, powerSource: { type: 'string' as const, required: true as const }, owner: { type: 'string' as const }, canonCompatibility: { type: 'array' as const, items: { type: 'string' as const } }, relatedThreads: { type: 'array' as const, items: { type: 'string' as const } },
} } }


type ToolJsonValue = null | boolean | number | string | ToolJsonValue[] | { [key: string]: ToolJsonValue }

function toolJson(value: unknown): ToolJsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('tool output contains a non-finite number')
    return value
  }
  if (Array.isArray(value)) return value.map(toolJson)
  if (typeof value === 'object') {
    const output: Record<string, ToolJsonValue> = {}
    for (const [key, entry] of Object.entries(value)) {
      if (entry !== undefined) output[key] = toolJson(entry)
    }
    return output
  }
  throw new Error(`tool output contains non-JSON value of type ${typeof value}`)
}

function toolObject(value: unknown): Record<string, ToolJsonValue> {
  const output = toolJson(value)
  if (output === null || Array.isArray(output) || typeof output !== 'object') throw new Error('tool output must be an object')
  return output
}

function toolObjectArray(value: readonly unknown[]): Record<string, ToolJsonValue>[] {
  return value.map(toolObject)
}

function jsonObjectOutput(_description: string) {
  return {
    schema: { type: 'object' as const, additionalProperties: true as const },
    render: (_args: unknown, value: unknown) => jsonText(value),
  }
}
function jsonText(value: unknown) { return [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] }
function nonEmpty(value: string, label: string): string { const trimmed = value.trim(); if (trimmed.length === 0) throw new Error(`${label} must be non-empty`); return trimmed }
function positiveInteger(value: number, label: string): number { if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${label} must be a positive safe integer`); return value }
function uniqueStrings(values: readonly string[]): string[] { return [...new Set(values.map(value => value.trim()).filter(Boolean))] }
async function resolveBranchRef(ctx: Context, value: string, signal?: AbortSignal) {
  const ref = nonEmpty(value, 'branchId')
  if (/^fanfic-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(ref)) return FanficBranchId(ref)
  const matches = (await ctx.fanfic.listBranches(signal)).filter(branch => branch.name === ref)
  const match = matches[0]
  if (match === undefined) throw new Error(`fanfic branch name does not exist: ${JSON.stringify(ref)}`)
  if (matches.length > 1) throw new Error(`fanfic branch name is ambiguous: ${JSON.stringify(ref)}`)
  return match.id
}
