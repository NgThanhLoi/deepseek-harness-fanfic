/** Distributed specialist orchestration for the fanfic Author Agent. @module @deepseek-ai/dsh-tool-fanfic-distributed */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { Agent, AgentOptions } from '@deepseek-ai/dsh-agent'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ObjectJsonSchema } from '@deepseek-ai/dsh-tools'
import type { SubagentResult, SubagentRun } from '@deepseek-ai/dsh-subagent'
import type {} from '@deepseek-ai/dsh-system-prompt'
import { FanficBranchId } from '@deepseek-ai/dsh-fanfic'
import type { FanficDraft } from '@deepseek-ai/dsh-fanfic'
import {
  FanficSpecialistRouter,
  FanficWorkerRunError,
  type FanficSpecialistDispatch,
  type FanficSpecialistRole,
  type FanficWorkerConfig,
} from './router.ts'

export const name = 'tool-fanfic-distributed'
export const inject = ['tools', 'fanfic', 'subagents', 'systemPrompt']

/** Distributed author-tool API exposed by this Consumer. */
export const FANFIC_DISTRIBUTED_API_VERSION = '0.8.0'

const PREPARATION_ROLES: readonly FanficSpecialistRole[] = ['canon', 'character', 'story']
const ALL_ROLES: readonly FanficSpecialistRole[] = [...PREPARATION_ROLES, 'critic']
const SYSTEM_PROMPT_ORDER = 117.5

/** One specialist worker configured for a role. */
interface WorkerConfig extends FanficWorkerConfig {
  /** Optional child-model override; omitted fields inherit the parent Author deployment. */
  readonly agentOptions?: AgentOptions
}

/** Distributed fanfic orchestration configuration. */
export interface Config {
  /** Ordered worker pool; each row binds one specialist role to one registered subagent provider and optional model route. */
  workers: Array<{
    /** Stable worker name used in health, fallback, and diagnostics. */
    readonly name: string
    /** Specialist responsibility; only its read-only tool allow-list is visible in the child. */
    readonly role: 'canon' | 'character' | 'story' | 'critic'
    /** Registered `ctx.subagents` provider name, normally `spawn` for in-process workers. */
    readonly subagentProvider: string
    /** Positive fallback order within the role; lower values are attempted first. */
    readonly priority: number
    /** Optional child LLM route; omitted fields inherit the parent Author agent. */
    readonly agentOptions?: {
      /** Optional LLM provider override for this specialist. */
      readonly provider?: string
      /** Optional model override for this specialist. */
      readonly model?: string
      /** Optional positive output-token ceiling for the specialist. */
      readonly maxTokens?: number
    }
  }>
  /** Base in-memory cooldown after one retryable worker failure, in milliseconds. */
  readonly failureCooldownMs: number
  /** Maximum fallback workers attempted for one specialist role dispatch. */
  readonly maxAttemptsPerRole: number
  /** Maximum specialist roles started concurrently by one preparation call. */
  readonly maxParallelSpecialists: number
  /** Lifetime of one successful state-sensitive specialist packet cache entry, in milliseconds. */
  readonly cacheTtlMs: number
  /** Maximum successful specialist packets retained by the in-memory cache. */
  readonly maxCacheEntries: number
  /** Hard serialized-size cap for one specialist structured packet. */
  readonly packetMaxChars: number
  /** Hard serialized-size cap for one complete parent-visible distributed tool result. */
  readonly resultMaxChars: number
}

const agentOptionsSchema = z.object({
  provider: z.string(),
  model: z.string(),
  maxTokens: z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER),
}).default(undefined as unknown as { provider: string; model: string; maxTokens: number })

export const Config: z<Config> = z.object({
  workers: z.array(z.object({
    name: z.string().min(1).required(),
    role: z.union(ALL_ROLES).required(),
    subagentProvider: z.string().min(1).required(),
    priority: z.number().step(1).min(1).required(),
    agentOptions: agentOptionsSchema,
  })).min(1).max(64).required(),
  failureCooldownMs: z.number().step(1).min(0).required(),
  maxAttemptsPerRole: z.number().step(1).min(1).required(),
  maxParallelSpecialists: z.number().step(1).min(1).required(),
  cacheTtlMs: z.number().step(1).min(0).required(),
  maxCacheEntries: z.number().step(1).min(1).required(),
  packetMaxChars: z.number().step(1).min(1000).required(),
  resultMaxChars: z.number().step(1).min(2000).required(),
})

interface SpecialistPacket {
  readonly summary: string
  readonly findings: readonly string[]
  readonly constraints: readonly string[]
  readonly risks: readonly string[]
  readonly recommendations: readonly string[]
  readonly evidence: readonly string[]
  readonly gaps: readonly string[]
}

interface RoleFailure {
  readonly role: FanficSpecialistRole
  readonly error: string
}

const PACKET_SCHEMA: ObjectJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    findings: { type: 'array', items: { type: 'string' } },
    constraints: { type: 'array', items: { type: 'string' } },
    risks: { type: 'array', items: { type: 'string' } },
    recommendations: { type: 'array', items: { type: 'string' } },
    evidence: { type: 'array', items: { type: 'string' } },
    gaps: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'findings', 'constraints', 'risks', 'recommendations', 'evidence', 'gaps'],
}

const ROLE_TOOLS: Readonly<Record<FanficSpecialistRole, readonly string[]>> = {
  canon: [
    'canon_search', 'canon_chapter_read', 'canon_snapshot', 'canon_causality_trace',
    'canon_timeline_context', 'canon_context_expand', 'power_assess', 'fanfic_impact_scan',
  ],
  character: [
    'character_intelligence', 'character_voice_context', 'author_context', 'power_assess',
    'fanfic_impact_scan', 'canon_search', 'canon_chapter_read',
  ],
  story: [
    'story_director_context', 'author_context', 'fanfic_impact_scan', 'canon_causality_trace',
    'canon_timeline_context', 'canon_search', 'canon_chapter_read',
  ],
  critic: [
    'fanfic_draft_get', 'character_voice_context', 'narrative_style_context', 'story_director_context',
    'author_context', 'power_assess', 'fanfic_impact_scan', 'canon_search', 'canon_chapter_read',
  ],
}

const DISTRIBUTED_POLICY = `Distributed fanfic authoring (API ${FANFIC_DISTRIBUTED_API_VERSION}):
- At the parent author scope, you are the sole Author/Coordinator. If your current task explicitly identifies you as a distributed specialist child, that specialist task takes precedence: act only as a read-only advisory worker, use only visible child tools, return the required packet, and never write final prose or mutate/settle author state.
- Before a substantial chapter plan, prefer fanfic_prepare_chapter to fan out canon, character, and story analysis in parallel. Treat specialist packets as advice/evidence summaries, not authoritative branch state; resolve conflicts yourself against author_context and canon evidence.
- Specialists are read-only by enforced tool filters. If preparation returns complete=false, inspect failedRoles and retry rather than silently inventing missing canon constraints.
- After staging a meaningful draft, fanfic_review_draft may obtain an independent critic packet from another configured model/provider. Deterministic fanfic_audit, fanfic_style_audit, and anti_copy_guard remain mandatory and cannot be replaced by the critic.
- fanfic_worker_status shows the configured worker pool, provider capability availability, cooldowns, and cache state. Different worker models/providers are deployment configuration; the Author model remains the parent agent.
- Specialist success packets are cached only against state-sensitive keys (branch revision or staged-draft hash). Branch/draft changes therefore require fresh work automatically.`

/** Register distributed fanfic preparation/review tools. @param ctx - plugin context. @param config - validated worker-pool configuration. */
export function apply(ctx: Context, config: Config): void {
  const workers = validateWorkers(config.workers)
  const maxParallel = positiveInteger(config.maxParallelSpecialists, 'maxParallelSpecialists')
  const resultMaxChars = positiveInteger(config.resultMaxChars, 'resultMaxChars')
  const router = new FanficSpecialistRouter(workers, {
    failureCooldownMs: nonNegativeInteger(config.failureCooldownMs, 'failureCooldownMs'),
    maxAttemptsPerRole: positiveInteger(config.maxAttemptsPerRole, 'maxAttemptsPerRole'),
    cacheTtlMs: nonNegativeInteger(config.cacheTtlMs, 'cacheTtlMs'),
    maxCacheEntries: positiveInteger(config.maxCacheEntries, 'maxCacheEntries'),
    packetMaxChars: positiveInteger(config.packetMaxChars, 'packetMaxChars'),
  })

  ctx.systemPrompt.section({ name: 'tool:fanfic-distributed', order: SYSTEM_PROMPT_ORDER, text: DISTRIBUTED_POLICY })

  ctx.tools.register(defineTool({
    name: 'fanfic_worker_status',
    description: 'Inspect distributed fanfic specialist workers, provider capabilities, cooldown/failure health, and packet-cache size. Does not run a model.',
    parameters: {},
    output: jsonObjectOutput(),
    execute: async () => boundedToolObject({
      distributedApiVersion: FANFIC_DISTRIBUTED_API_VERSION,
      cacheEntries: router.cacheSize(),
      workers: router.status().map(row => {
        const worker = workers.find(item => item.name === row.name)!
        const provider = ctx.subagents.getProvider(worker.subagentProvider)
        return {
          ...row,
          subagentProvider: worker.subagentProvider,
          agentProvider: worker.agentOptions?.provider ?? 'inherit-parent',
          model: worker.agentOptions?.model ?? 'inherit-parent',
          providerAvailable: provider !== undefined,
          supportsRequiredCapabilities: provider?.capabilities.outputSchema === true && provider.capabilities.toolFilter === true,
        }
      }),
    }, resultMaxChars, 'fanfic_worker_status'),
    presentCall: () => ({ card: 'generic', title: 'Inspect fanfic specialist pool', kind: 'read' }),
  }))

  ctx.tools.register(defineTool({
    name: 'fanfic_prepare_chapter',
    description: 'Fan out read-only canon, character, and story specialists for one planned fanfic chapter, with parallel execution, fallback workers, cooldowns, and revision-keyed caching. The Author remains responsible for the final plan.',
    parameters: {
      branchId: { type: 'string', required: true, description: 'Branch UUID or unique branch name.' },
      fanficChapter: { type: 'integer', required: true },
      asOfChapter: { type: 'integer', required: true },
      povCharacter: { type: 'string', required: true },
      participants: { type: 'array', items: { type: 'string' } },
      sceneGoal: { type: 'string', required: true },
      query: { type: 'string' },
      roles: { type: 'array', items: { type: 'string', enum: PREPARATION_ROLES }, description: 'Defaults to canon + character + story.' },
      forceRefresh: { type: 'boolean', description: 'Ignore cached specialist packets for this exact branch revision/scene request.' },
    },
    output: jsonObjectOutput(),
    async execute(args, exec) {
      const parent = requireParent(exec.agent)
      const branchId = await resolveBranchRef(ctx, args.branchId, exec.signal)
      const branch = await ctx.fanfic.getBranch(branchId, exec.signal)
      const roles = normalizePreparationRoles(args.roles ?? PREPARATION_ROLES)
      const request = {
        branchId: String(branchId),
        branchRevision: branch.revision,
        fanficChapter: positiveInteger(args.fanficChapter, 'fanficChapter'),
        asOfChapter: positiveInteger(args.asOfChapter, 'asOfChapter'),
        povCharacter: nonEmpty(args.povCharacter, 'povCharacter'),
        participants: uniqueStrings(args.participants ?? []),
        sceneGoal: nonEmpty(args.sceneGoal, 'sceneGoal'),
        query: args.query?.trim() ?? '',
      }
      const results = await mapLimit(roles, maxParallel, async role => runRoleSafely(
        role,
        router,
        preparationCacheKey(role, request),
        args.forceRefresh ?? false,
        worker => runSpecialist(ctx, worker, parent, role, specialistPrompt(role, request), exec.signal),
        exec.signal,
      ))
      const packets: Partial<Record<FanficSpecialistRole, SpecialistPacket>> = {}
      const dispatches: FanficSpecialistDispatch<SpecialistPacket>[] = []
      const failedRoles: RoleFailure[] = []
      for (const result of results) {
        if ('error' in result) failedRoles.push({ role: result.role, error: result.error })
        else {
          packets[result.role] = result.packet
          dispatches.push(result)
        }
      }
      return boundedToolObject({
        distributedApiVersion: FANFIC_DISTRIBUTED_API_VERSION,
        complete: failedRoles.length === 0,
        branchId: String(branchId),
        branchRevision: branch.revision,
        fanficChapter: request.fanficChapter,
        asOfChapter: request.asOfChapter,
        packets,
        dispatches: dispatches.map(compactDispatch),
        failedRoles,
        cautions: failedRoles.length === 0 ? [] : ['One or more requested specialist roles failed after fallback. Do not invent the missing evidence; retry or research it directly before writing.'],
      }, resultMaxChars, 'fanfic_prepare_chapter')
    },
    presentCall: args => ({ card: 'generic', title: `Prepare fanfic chapter ${args.fanficChapter}`, kind: 'read', rawInput: args.sceneGoal }),
  }))

  ctx.tools.register(defineTool({
    name: 'fanfic_review_draft',
    description: 'Run an independent read-only critic specialist over one staged draft. This complements but never replaces deterministic canon/style/anti-copy audits.',
    parameters: {
      branchId: { type: 'string', required: true, description: 'Branch UUID or unique branch name.' },
      draftId: { type: 'string', required: true },
      asOfChapter: { type: 'integer', required: true },
      povCharacter: { type: 'string', required: true },
      participants: { type: 'array', items: { type: 'string' } },
      sceneGoal: { type: 'string', required: true },
      forceRefresh: { type: 'boolean' },
    },
    output: jsonObjectOutput(),
    async execute(args, exec) {
      const parent = requireParent(exec.agent)
      const branchId = await resolveBranchRef(ctx, args.branchId, exec.signal)
      const branch = await ctx.fanfic.getBranch(branchId, exec.signal)
      const draft = await ctx.fanfic.getDraft(nonEmpty(args.draftId, 'draftId'), exec.signal)
      if (String(draft.branchId) !== String(branchId)) throw new Error('draftId belongs to a different fanfic branch')
      if (draft.branchRevision !== branch.revision) {
        throw new Error(`draftId was staged at branch revision ${draft.branchRevision}, but the branch is now revision ${branch.revision}; update/restage the draft before distributed review`)
      }
      const request = {
        branchId: String(branchId),
        branchRevision: branch.revision,
        draft,
        asOfChapter: positiveInteger(args.asOfChapter, 'asOfChapter'),
        povCharacter: nonEmpty(args.povCharacter, 'povCharacter'),
        participants: uniqueStrings(args.participants ?? []),
        sceneGoal: nonEmpty(args.sceneGoal, 'sceneGoal'),
      }
      const result = await runRoleSafely(
        'critic',
        router,
        criticCacheKey(request),
        args.forceRefresh ?? false,
        worker => runSpecialist(ctx, worker, parent, 'critic', criticPrompt(request), exec.signal),
        exec.signal,
      )
      if ('error' in result) {
        return boundedToolObject({
          distributedApiVersion: FANFIC_DISTRIBUTED_API_VERSION,
          complete: false,
          draftId: draft.id,
          draftHash: draft.draftHash,
          failedRoles: [{ role: 'critic', error: result.error }],
          cautions: ['Independent critic unavailable after fallback. Deterministic audits are still required; retry the critic if independent model review is desired.'],
        }, resultMaxChars, 'fanfic_review_draft')
      }
      return boundedToolObject({
        distributedApiVersion: FANFIC_DISTRIBUTED_API_VERSION,
        complete: true,
        draftId: draft.id,
        draftHash: draft.draftHash,
        packet: result.packet,
        dispatch: compactDispatch(result),
        cautions: ['This is advisory model critique. fanfic_audit, fanfic_style_audit, and anti_copy_guard remain the commit authority.'],
      }, resultMaxChars, 'fanfic_review_draft')
    },
    presentCall: args => ({ card: 'generic', title: `Critique staged fanfic draft ${args.draftId}`, kind: 'read' }),
  }))
}

async function runSpecialist(
  ctx: Context,
  worker: WorkerConfig,
  parent: Agent,
  role: FanficSpecialistRole,
  prompt: string,
  signal: AbortSignal,
): Promise<SpecialistPacket> {
  const provider = ctx.subagents.getProvider(worker.subagentProvider)
  if (provider === undefined) throw new FanficWorkerRunError(`subagent provider ${JSON.stringify(worker.subagentProvider)} is not registered`)
  if (!provider.capabilities.outputSchema || !provider.capabilities.toolFilter) {
    throw new FanficWorkerRunError(`subagent provider ${JSON.stringify(worker.subagentProvider)} lacks required outputSchema/toolFilter capabilities`)
  }
  const run = await ctx.subagents.start(worker.subagentProvider, {
    label: `fanfic-${role}:${worker.name}`,
    prompt: [{ type: 'text', text: prompt }] as ContentBlock[],
    parent,
    signal,
    outputSchema: PACKET_SCHEMA,
    toolFilter: { allow: [...ROLE_TOOLS[role]] },
    ...(provider.capabilities.persona ? { persona: specialistPersona(role) } : {}),
    ...(worker.agentOptions === undefined ? {} : { agentOptions: worker.agentOptions }),
  })
  return settleStructuredRun(run, signal)
}

async function settleStructuredRun(run: SubagentRun, signal: AbortSignal): Promise<SpecialistPacket> {
  let result: SubagentResult | undefined
  let resultError: unknown
  try {
    result = await run.result
  } catch (error: unknown) {
    resultError = error
  }
  let disposeError: unknown
  try {
    await run.dispose()
  } catch (error: unknown) {
    disposeError = error
  }
  if (signal.aborted) throw new FanficWorkerRunError('specialist run aborted by parent', false)
  if (resultError !== undefined && disposeError !== undefined) throw new FanficWorkerRunError(`specialist run and disposal failed: ${String(resultError)}; ${String(disposeError)}`)
  if (resultError !== undefined) throw new FanficWorkerRunError(`specialist run failed: ${String(resultError)}`)
  if (disposeError !== undefined) throw new FanficWorkerRunError(`specialist disposal failed: ${String(disposeError)}`)
  if (result === undefined) throw new FanficWorkerRunError('specialist run produced no terminal result')
  if (result.stopReason === 'aborted') throw new FanficWorkerRunError('specialist run aborted', false)
  if (result.stopReason !== 'completed') throw new FanficWorkerRunError(`specialist stopped with ${result.stopReason}: ${contentText(result.output)}`)
  if (result.structured === undefined) throw new FanficWorkerRunError('specialist completed without the required structured packet')
  return result.structured as SpecialistPacket
}

async function runRoleSafely(
  role: FanficSpecialistRole,
  router: FanficSpecialistRouter,
  cacheKey: string,
  forceRefresh: boolean,
  runner: (worker: WorkerConfig) => Promise<SpecialistPacket>,
  signal: AbortSignal,
): Promise<FanficSpecialistDispatch<SpecialistPacket> | RoleFailure> {
  try {
    return await router.dispatch(role, cacheKey, forceRefresh, worker => runner(worker as WorkerConfig), signal)
  } catch (error: unknown) {
    if (signal.aborted || (error instanceof FanficWorkerRunError && !error.retryable)) throw error
    return { role, error: String(error instanceof Error ? error.message : error).slice(0, 1200) }
  }
}


function specialistPersona(role: FanficSpecialistRole): string {
  return `You are a read-only fanfic ${role} specialist. The parent agent is the sole Author/Coordinator. Do not write final chapter prose, mutate author state, or make settlement decisions; ground the assigned analysis with only the tools visible in this child scope and return the requested structured packet.`
}

function specialistPrompt(role: FanficSpecialistRole, request: {
  readonly branchId: string
  readonly branchRevision: number
  readonly fanficChapter: number
  readonly asOfChapter: number
  readonly povCharacter: string
  readonly participants: readonly string[]
  readonly sceneGoal: string
  readonly query: string
}): string {
  const roleInstruction = role === 'canon'
    ? 'Research canon constraints, cutoff-safe evidence, power/timeline/causal dependencies, and epistemic risks. Do not invent missing canon.'
    : role === 'character'
      ? 'Analyze character goals, current knowledge, red lines, relationship dynamics, voice constraints, and plausible choices. Character logic outranks plot convenience.'
      : 'Analyze Story Director priorities, due threads, foreshadows, branch consequences, and 2–3 viable scene progressions. Recommend without mutating author state.'
  return `You are the ${role} specialist inside a distributed fanfic Author Brain. You are NOT the final writer and MUST NOT write chapter prose or mutate branch state.\n\n${roleInstruction}\nUse the read-only tools available to ground every canon-specific or branch-specific assertion; pretrained memory is not evidence. Treat canon after divergence as counterfactual reference, never destiny. If evidence is incomplete, put it in gaps instead of guessing. Keep evidence concise: chapter/event anchors and paraphrased support, no long source quotations.\n\nTask:\n- branchId: ${request.branchId}\n- branchRevision: ${request.branchRevision}\n- fanficChapter: ${request.fanficChapter}\n- canon asOfChapter: ${request.asOfChapter}\n- POV: ${request.povCharacter}\n- participants: ${request.participants.join(', ') || '(none supplied)'}\n- sceneGoal: ${request.sceneGoal}\n- extra query: ${request.query || '(none)'}\n\nReturn the required structured packet. Prefer at most 8 concise items per array. recommendations are options/advice to the Author, never state mutations.`
}

function criticPrompt(request: {
  readonly branchId: string
  readonly branchRevision: number
  readonly draft: FanficDraft
  readonly asOfChapter: number
  readonly povCharacter: string
  readonly participants: readonly string[]
  readonly sceneGoal: string
}): string {
  return `You are an independent critic specialist inside a distributed fanfic Author Brain. You are NOT the writer and MUST NOT mutate branch state or issue commit decisions. Read staged draft ${request.draft.id} with fanfic_draft_get and use the available read-only context tools as needed.\n\nReview for character logic, POV knowledge leakage, continuity, unsupported capability claims, mystery over-reveal, dialogue/voice, exposition, scene rhythm, and obvious LLM-like degeneration. Do not replace deterministic fanfic_audit/fanfic_style_audit/anti_copy_guard.\n\nContext:\n- branchId: ${request.branchId}\n- branchRevision: ${request.branchRevision}\n- fanficChapter: ${request.draft.fanficChapter}\n- draftHash: ${request.draft.draftHash}\n- canon asOfChapter: ${request.asOfChapter}\n- POV: ${request.povCharacter}\n- participants: ${request.participants.join(', ') || '(none supplied)'}\n- sceneGoal: ${request.sceneGoal}\n\nReturn the required structured packet. Put must-fix problems first in risks/recommendations, keep strengths/findings concise, and use gaps when evidence is insufficient.`
}

function preparationCacheKey(role: FanficSpecialistRole, request: {
  readonly branchId: string
  readonly branchRevision: number
  readonly fanficChapter: number
  readonly asOfChapter: number
  readonly povCharacter: string
  readonly participants: readonly string[]
  readonly sceneGoal: string
  readonly query: string
}): string {
  return JSON.stringify(['prepare', role, request.branchId, request.branchRevision, request.fanficChapter, request.asOfChapter, request.povCharacter, request.participants, request.sceneGoal, request.query])
}

function criticCacheKey(request: { readonly branchId: string; readonly branchRevision: number; readonly draft: FanficDraft; readonly asOfChapter: number; readonly povCharacter: string; readonly participants: readonly string[]; readonly sceneGoal: string }): string {
  return JSON.stringify(['critic', request.branchId, request.branchRevision, request.draft.id, request.draft.draftHash, request.asOfChapter, request.povCharacter, request.participants, request.sceneGoal])
}

function compactDispatch(dispatch: FanficSpecialistDispatch<SpecialistPacket>) {
  return { role: dispatch.role, worker: dispatch.worker, attempts: dispatch.attempts, cacheHit: dispatch.cacheHit, durationMs: dispatch.durationMs }
}

function validateWorkers(values: readonly WorkerConfig[]): readonly WorkerConfig[] {
  if (values.length === 0) throw new Error('workers must contain at least one specialist')
  const names = new Set<string>()
  for (const worker of values) {
    const workerName = nonEmpty(worker.name, 'worker.name')
    if (names.has(workerName)) throw new Error(`duplicate fanfic specialist worker name: ${JSON.stringify(workerName)}`)
    names.add(workerName)
    if (!ALL_ROLES.includes(worker.role)) throw new Error(`unsupported fanfic specialist role: ${JSON.stringify(worker.role)}`)
    nonEmpty(worker.subagentProvider, 'worker.subagentProvider')
    positiveInteger(worker.priority, 'worker.priority')
    if (worker.agentOptions?.maxTokens !== undefined) positiveInteger(worker.agentOptions.maxTokens, 'worker.agentOptions.maxTokens')
  }
  return [...values]
}

function normalizePreparationRoles(values: readonly string[]): FanficSpecialistRole[] {
  const roles = uniqueStrings(values)
  if (roles.length === 0) throw new Error('roles must contain at least one preparation role')
  for (const role of roles) if (!PREPARATION_ROLES.includes(role as FanficSpecialistRole)) throw new Error(`unsupported preparation role: ${JSON.stringify(role)}`)
  return roles as FanficSpecialistRole[]
}

async function resolveBranchRef(ctx: Context, value: string, signal?: AbortSignal) {
  const ref = nonEmpty(value, 'branchId')
  if (/^fanfic-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(ref)) return FanficBranchId(ref)
  const matches = (await ctx.fanfic.listBranches(signal)).filter(branch => branch.name === ref)
  if (matches.length === 0) throw new Error(`fanfic branch name does not exist: ${JSON.stringify(ref)}`)
  if (matches.length > 1) throw new Error(`fanfic branch name is ambiguous: ${JSON.stringify(ref)}`)
  return matches[0]!.id
}

async function mapLimit<T, R>(values: readonly T[], limit: number, fn: (value: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(values.length)
  let next = 0
  const worker = async (): Promise<void> => {
    while (next < values.length) {
      const index = next++
      results[index] = await fn(values[index]!)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, () => worker()))
  return results
}

type ToolJsonValue = null | boolean | number | string | ToolJsonValue[] | { [key: string]: ToolJsonValue }
function toolJson(value: unknown): ToolJsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') { if (!Number.isFinite(value)) throw new Error('tool output contains a non-finite number'); return value }
  if (Array.isArray(value)) return value.map(toolJson)
  if (typeof value === 'object') {
    const output: Record<string, ToolJsonValue> = {}
    for (const [key, entry] of Object.entries(value)) if (entry !== undefined) output[key] = toolJson(entry)
    return output
  }
  throw new Error(`tool output contains non-JSON value of type ${typeof value}`)
}
function toolObject(value: unknown): Record<string, ToolJsonValue> {
  const output = toolJson(value)
  if (output === null || Array.isArray(output) || typeof output !== 'object') throw new Error('tool output must be an object')
  return output
}
function boundedToolObject(value: unknown, maxChars: number, label: string): Record<string, ToolJsonValue> {
  const output = toolObject(value)
  const chars = JSON.stringify(output).length
  if (chars > maxChars) throw new Error(`${label} result exceeds resultMaxChars (${chars} > ${maxChars}); reduce worker packet size/pool output before retrying`)
  return output
}
function jsonObjectOutput() {
  return {
    schema: { type: 'object' as const, additionalProperties: true as const },
    render: (_args: unknown, value: unknown) => [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
  }
}
function contentText(blocks: readonly ContentBlock[]): string { return blocks.filter((block): block is Extract<ContentBlock, { type: 'text' }> => block.type === 'text').map(block => block.text).join('').slice(0, 800) }
function requireParent(agent: Agent | undefined): Agent { if (agent === undefined) throw new Error('distributed fanfic tools require a calling Author Agent'); return agent }
function nonEmpty(value: string, label: string): string { const trimmed = value.trim(); if (trimmed.length === 0) throw new Error(`${label} must be non-empty`); return trimmed }
function positiveInteger(value: number, label: string): number { if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${label} must be a positive safe integer`); return value }
function nonNegativeInteger(value: number, label: string): number { if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative safe integer`); return value }
function uniqueStrings(values: readonly string[]): string[] { return [...new Set(values.map(value => value.trim()).filter(Boolean))] }
