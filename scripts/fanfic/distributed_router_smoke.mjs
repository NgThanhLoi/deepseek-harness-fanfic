#!/usr/bin/env node
/** Keyless smoke coverage for the distributed Author Brain router and specialist tool policy. */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FanficSpecialistRouter, FanficWorkerRunError } from '../../packages/fanfic/tool-fanfic-distributed/lib/types/router.js'

const repo = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const sourcePath = resolve(repo, 'packages/fanfic/tool-fanfic-distributed/src/index.ts')
const directSourcePath = resolve(repo, 'packages/fanfic/tool-fanfic/src/index.ts')
const source = await readFile(sourcePath, 'utf8')
const directSource = await readFile(directSourcePath, 'utf8')
const workers = [
  { name: 'canon-a', role: 'canon', subagentProvider: 'spawn', priority: 1 },
  { name: 'canon-b', role: 'canon', subagentProvider: 'spawn', priority: 2 },
]
const makeRouter = (overrides = {}) => new FanficSpecialistRouter(workers, {
  failureCooldownMs: 60_000,
  maxAttemptsPerRole: 2,
  cacheTtlMs: 60_000,
  maxCacheEntries: 8,
  packetMaxChars: 2_000,
  ...overrides,
})

// Retryable failure falls back and cools the failing worker.
{
  const router = makeRouter()
  const result = await router.dispatch('canon', 'branch:1', false, async worker => {
    if (worker.name === 'canon-a') throw new FanficWorkerRunError('429 token rate limit')
    return { summary: 'fallback ok' }
  })
  assert.equal(result.worker, 'canon-b')
  assert.deepEqual(result.attempts, [{ worker: 'canon-a', error: '429 token rate limit' }])
  const failed = router.status().find(row => row.name === 'canon-a')
  assert.equal(failed?.consecutiveFailures, 1)
  assert.ok(failed?.cooldownUntil)
}

// Cache is keyed by caller state: same key reuses work, new revision key reruns.
{
  const router = makeRouter({ failureCooldownMs: 0 })
  let calls = 0
  const runner = async () => { calls += 1; return { summary: `call-${calls}` } }
  const first = await router.dispatch('canon', 'branch-rev:1', false, runner)
  const cached = await router.dispatch('canon', 'branch-rev:1', false, runner)
  const changed = await router.dispatch('canon', 'branch-rev:2', false, runner)
  assert.equal(first.cacheHit, false)
  assert.equal(cached.cacheHit, true)
  assert.equal(changed.cacheHit, false)
  assert.equal(calls, 2)
}

// Non-retryable parent cancellation does not run another worker.
{
  const router = makeRouter()
  let calls = 0
  await assert.rejects(
    router.dispatch('canon', 'abort', false, async () => {
      calls += 1
      throw new FanficWorkerRunError('parent aborted', false)
    }),
    /parent aborted/,
  )
  assert.equal(calls, 1)
}

// Oversized packets never become cached successes.
{
  const router = makeRouter({ failureCooldownMs: 0, packetMaxChars: 1_000 })
  await assert.rejects(
    router.dispatch('canon', 'oversized', false, async () => ({ summary: 'x'.repeat(2_000) })),
    /all canon specialist attempts failed/,
  )
  assert.equal(router.cacheSize(), 0)
}

// Source-level capability policy: specialist scopes are allow-only and cannot mutate author state.
{
  assert.match(source, /toolFilter:\s*\{\s*allow:\s*\[\.\.\.ROLE_TOOLS\[role\]\]\s*\}/u)
  assert.match(source, /outputSchema:\s*PACKET_SCHEMA/u)
  const roleBlock = source.match(/const ROLE_TOOLS:[\s\S]*?\n\}\n\nconst DISTRIBUTED_POLICY/u)?.[0]
  assert.ok(roleBlock, 'ROLE_TOOLS policy block missing')
  const forbidden = [
    'fanfic_apply_delta', 'fanfic_intent_update', 'fanfic_divergence_record',
    'fanfic_draft_stage', 'fanfic_draft_update',
    'story_arc_upsert', 'story_thread_upsert', 'story_foreshadow_upsert', 'story_horizon_set',
    'story_reconciliation_resolve', 'mystery_truth_upsert', 'invention_upsert',
    'canon_enrichment_commit', 'canon_enrichment_checkpoint',
    'subagent', 'send_message', 'interrupt_agent',
  ]
  for (const name of forbidden) assert.equal(roleBlock.includes(`'${name}'`), false, `${name} leaked into specialist allow list`)
  assert.match(directSource, /read-only distributed specialist child/u, 'direct fanfic policy lacks the specialist-child exception')
}

// Diagnostics redact common credential spellings before status/result exposure.
{
  const router = makeRouter({ failureCooldownMs: 60_000 })
  await assert.rejects(router.dispatch('canon', 'secret', false, async () => {
    throw new Error('token=SUPERSECRET Bearer ALSOSECRET')
  }))
  const row = router.status().find(item => item.name === 'canon-a')
  assert.equal(row?.lastFailure?.includes('SUPERSECRET'), false)
  assert.equal(row?.lastFailure?.includes('ALSOSECRET'), false)
  assert.match(row?.lastFailure ?? '', /token=\[REDACTED\].*Bearer \[REDACTED\]/u)
}

console.log(JSON.stringify({
  ok: true,
  checks: [
    'retryable fallback + cooldown',
    'state-sensitive cache invalidation',
    'non-retryable cancellation',
    'packet-size cap',
    'read-only specialist tool policy + direct-policy specialist exception',
    'diagnostic credential redaction',
  ],
}, null, 2))
