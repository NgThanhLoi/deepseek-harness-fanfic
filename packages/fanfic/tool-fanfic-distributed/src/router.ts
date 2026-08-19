/** Deterministic worker-pool routing for distributed fanfic specialists. @module @deepseek-ai/dsh-tool-fanfic-distributed/router */

/** Specialist jobs supported by the distributed author workflow. */
export type FanficSpecialistRole = 'canon' | 'character' | 'story' | 'critic'

/** One configured specialist worker backed by a named subagent provider. */
export interface FanficWorkerConfig {
  readonly name: string
  readonly role: FanficSpecialistRole
  readonly subagentProvider: string
  readonly priority: number
  readonly agentOptions?: {
    readonly provider?: string
    readonly model?: string
    readonly maxTokens?: number
  }
}

/** Runtime routing tunables owned by the distributed tool Consumer. */
export interface FanficRouterConfig {
  readonly failureCooldownMs: number
  readonly maxAttemptsPerRole: number
  readonly cacheTtlMs: number
  readonly maxCacheEntries: number
  readonly packetMaxChars: number
}

/** One failed worker attempt retained for parent diagnostics. */
export interface FanficWorkerAttempt {
  readonly worker: string
  readonly error: string
}

/** Successful specialist dispatch, including fallback/cache diagnostics. */
export interface FanficSpecialistDispatch<T> {
  readonly role: FanficSpecialistRole
  readonly worker: string
  readonly packet: T
  readonly attempts: readonly FanficWorkerAttempt[]
  readonly cacheHit: boolean
  readonly durationMs: number
}

/** Public health projection for one configured worker. */
export interface FanficWorkerHealth {
  readonly name: string
  readonly role: FanficSpecialistRole
  readonly priority: number
  readonly consecutiveFailures: number
  readonly cooldownUntil?: string
  readonly inFlight: number
  readonly lastFailure?: string
  readonly lastSuccessAt?: string
}

interface WorkerState {
  consecutiveFailures: number
  cooldownUntilMs: number
  inFlight: number
  lastFailure?: string
  lastSuccessAtMs?: number
}

interface CacheEntry {
  readonly value: FanficSpecialistDispatch<unknown>
  readonly expiresAtMs: number
}

/** Error a worker runner can mark non-retryable, notably parent cancellation. */
export class FanficWorkerRunError extends Error {
  /** Whether another configured worker may be attempted for the same role. */
  readonly retryable: boolean

  /** Create a worker-run error. @param message - diagnostic. @param retryable - whether fallback is allowed. */
  constructor(message: string, retryable = true) {
    super(message)
    this.name = 'FanficWorkerRunError'
    this.retryable = retryable
  }
}

/**
 * In-memory role router. Branch revision/draft hash belong in caller cache keys,
 * so stale specialist packets naturally stop matching after author state changes.
 */
export class FanficSpecialistRouter {
  private readonly workers: readonly FanficWorkerConfig[]
  private readonly states = new Map<string, WorkerState>()
  private readonly cache = new Map<string, CacheEntry>()

  /** Create a router over validated workers. @param workers - configured pool. @param config - routing bounds. */
  constructor(
    workers: readonly FanficWorkerConfig[],
    private readonly config: FanficRouterConfig,
  ) {
    this.workers = [...workers]
    for (const worker of workers) this.states.set(worker.name, { consecutiveFailures: 0, cooldownUntilMs: 0, inFlight: 0 })
  }

  /**
   * Dispatch one role with ordered fallback and success caching.
   * @param role - specialist role.
   * @param cacheKey - state-sensitive caller cache key.
   * @param forceRefresh - bypass a valid cached success.
   * @param runner - one concrete worker attempt.
   * @param signal - parent cancellation.
   * @returns successful dispatch metadata and packet.
   */
  async dispatch<T>(
    role: FanficSpecialistRole,
    cacheKey: string,
    forceRefresh: boolean,
    runner: (worker: FanficWorkerConfig) => Promise<T>,
    signal?: AbortSignal,
  ): Promise<FanficSpecialistDispatch<T>> {
    const startedAt = Date.now()
    this.pruneCache(startedAt)
    if (!forceRefresh) {
      const cached = this.cache.get(cacheKey)
      if (cached !== undefined && cached.expiresAtMs > startedAt) {
        const value = cached.value as FanficSpecialistDispatch<T>
        return { ...value, cacheHit: true, durationMs: Date.now() - startedAt }
      }
    }

    const candidates = this.workers
      .filter(worker => worker.role === role && (this.states.get(worker.name)?.cooldownUntilMs ?? 0) <= startedAt)
      .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name))
    if (candidates.length === 0) {
      throw new FanficWorkerRunError(`no ${role} specialist is currently available (missing worker or all workers cooling down)`)
    }

    const attempts: FanficWorkerAttempt[] = []
    const limit = Math.min(this.config.maxAttemptsPerRole, candidates.length)
    for (const worker of candidates.slice(0, limit)) {
      if (isAborted(signal)) throw new FanficWorkerRunError('distributed fanfic dispatch aborted by parent', false)
      const state = this.states.get(worker.name)!
      state.inFlight += 1
      try {
        const packet = await runner(worker)
        const serialized = JSON.stringify(packet)
        if (serialized.length > this.config.packetMaxChars) {
          throw new FanficWorkerRunError(`specialist packet exceeds packetMaxChars (${serialized.length} > ${this.config.packetMaxChars})`)
        }
        state.consecutiveFailures = 0
        state.cooldownUntilMs = 0
        delete state.lastFailure
        state.lastSuccessAtMs = Date.now()
        const value: FanficSpecialistDispatch<T> = {
          role,
          worker: worker.name,
          packet,
          attempts,
          cacheHit: false,
          durationMs: Date.now() - startedAt,
        }
        this.cache.set(cacheKey, { value: value as FanficSpecialistDispatch<unknown>, expiresAtMs: Date.now() + this.config.cacheTtlMs })
        this.trimCache()
        return value
      } catch (error: unknown) {
        if (isAborted(signal)) throw new FanficWorkerRunError('distributed fanfic dispatch aborted by parent', false)
        if (error instanceof FanficWorkerRunError && !error.retryable) throw error
        state.consecutiveFailures += 1
        const multiplier = Math.min(8, 2 ** Math.max(0, state.consecutiveFailures - 1))
        state.cooldownUntilMs = Date.now() + this.config.failureCooldownMs * multiplier
        const diagnostic = boundedDiagnostic(error)
        state.lastFailure = diagnostic
        attempts.push({ worker: worker.name, error: diagnostic })
      } finally {
        state.inFlight -= 1
      }
    }
    throw new FanficWorkerRunError(`all ${role} specialist attempts failed: ${attempts.map(item => `${item.worker}: ${item.error}`).join(' | ')}`)
  }

  /** Return current routing health without exposing credentials or prompts. @returns worker health rows. */
  status(): readonly FanficWorkerHealth[] {
    const now = Date.now()
    return this.workers
      .slice()
      .sort((a, b) => a.role.localeCompare(b.role) || a.priority - b.priority || a.name.localeCompare(b.name))
      .map(worker => {
        const state = this.states.get(worker.name)!
        return {
          name: worker.name,
          role: worker.role,
          priority: worker.priority,
          consecutiveFailures: state.consecutiveFailures,
          ...(state.cooldownUntilMs > now ? { cooldownUntil: new Date(state.cooldownUntilMs).toISOString() } : {}),
          inFlight: state.inFlight,
          ...(state.lastFailure === undefined ? {} : { lastFailure: state.lastFailure }),
          ...(state.lastSuccessAtMs === undefined ? {} : { lastSuccessAt: new Date(state.lastSuccessAtMs).toISOString() }),
        }
      })
  }

  /** Number of currently retained success-cache entries. @returns cache entry count after expiry pruning. */
  cacheSize(): number {
    this.pruneCache(Date.now())
    return this.cache.size
  }

  private pruneCache(now: number): void {
    for (const [key, entry] of this.cache) if (entry.expiresAtMs <= now) this.cache.delete(key)
  }

  private trimCache(): void {
    while (this.cache.size > this.config.maxCacheEntries) {
      const first = this.cache.keys().next().value as string | undefined
      if (first === undefined) return
      this.cache.delete(first)
    }
  }
}

function boundedDiagnostic(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)
  return text
    .replace(/Bearer\s+[^\s]+/giu, 'Bearer [REDACTED]')
    .replace(/(api[_-]?key|token|secret)\s*[=:]\s*[^\s,;]+/giu, '$1=[REDACTED]')
    .slice(0, 600)
}

function isAborted(signal: AbortSignal | undefined): boolean { return signal?.aborted ?? false }
