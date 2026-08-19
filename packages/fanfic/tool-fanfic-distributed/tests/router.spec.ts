import { describe, expect, it } from 'vitest'
import { FanficSpecialistRouter, FanficWorkerRunError } from '../src/router.ts'

const workers = [
  { name: 'canon-a', role: 'canon' as const, subagentProvider: 'spawn', priority: 1 },
  { name: 'canon-b', role: 'canon' as const, subagentProvider: 'spawn', priority: 2 },
]

function router() {
  return new FanficSpecialistRouter(workers, {
    failureCooldownMs: 60_000,
    maxAttemptsPerRole: 2,
    cacheTtlMs: 60_000,
    maxCacheEntries: 8,
    packetMaxChars: 2_000,
  })
}

describe('FanficSpecialistRouter', () => {
  it('falls back after a retryable worker failure and cools the failed worker', async () => {
    const subject = router()
    const result = await subject.dispatch('canon', 'k1', false, async worker => {
      if (worker.name === 'canon-a') throw new FanficWorkerRunError('429 rate limited')
      return { summary: 'ok' }
    })
    expect(result.worker).toBe('canon-b')
    expect(result.attempts).toEqual([{ worker: 'canon-a', error: '429 rate limited' }])
    expect(subject.status().find(item => item.name === 'canon-a')?.consecutiveFailures).toBe(1)
  })

  it('reuses a success packet for the same state-sensitive cache key', async () => {
    const subject = router()
    let calls = 0
    const runner = async () => { calls += 1; return { summary: 'cached' } }
    const first = await subject.dispatch('canon', 'branch-rev-1', false, runner)
    const second = await subject.dispatch('canon', 'branch-rev-1', false, runner)
    expect(first.cacheHit).toBe(false)
    expect(second.cacheHit).toBe(true)
    expect(calls).toBe(1)
  })

  it('does not retry a non-retryable cancellation-style failure', async () => {
    const subject = router()
    let calls = 0
    await expect(subject.dispatch('canon', 'k2', false, async () => {
      calls += 1
      throw new FanficWorkerRunError('aborted', false)
    })).rejects.toThrow('aborted')
    expect(calls).toBe(1)
  })

  it('rejects oversized specialist packets before caching them', async () => {
    const subject = router()
    await expect(subject.dispatch('canon', 'k3', false, async () => ({ text: 'x'.repeat(3000) }))).rejects.toThrow(/all canon specialist attempts failed/)
    expect(subject.cacheSize()).toBe(0)
  })
})
