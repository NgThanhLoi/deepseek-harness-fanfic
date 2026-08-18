import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { FanficBranch, FanficStateDelta, FanficRewriteMode } from '@deepseek-ai/dsh-fanfic'
import { LocalFanficProvider } from '../src/provider.ts'

const roots: string[] = []
const sha = (text: string): string => createHash('sha256').update(text).digest('hex')
const SOURCE_SHA = sha('Test Canon source')

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function harness() {
  const root = await mkdtemp(join(tmpdir(), 'dsh-fanfic-'))
  roots.push(root)
  const pack = join(root, 'canon')
  const graph = join(pack, 'graph')
  const state = join(root, 'state')
  await mkdir(graph, { recursive: true })
  await writeFile(join(pack, 'manifest.json'), JSON.stringify({ schemaVersion: 1, canonPackId: 'test', graphVersion: 1 }))
  await writeFile(join(pack, 'source.json'), JSON.stringify({ title: 'Test Canon', creator: 'Test', sha256: SOURCE_SHA, chapterCount: 3 }))
  await writeNdjson(join(pack, 'chapters.ndjson'), [
    chapter(1, 'One', 'alpha'),
    chapter(2, 'Two', 'beta distinctive canonical phrase for overlap checking and rhythm'),
    chapter(3, 'Three', 'secret omega future canonical phrase that must stay hidden from the cutoff'),
  ])
  await writeNdjson(join(graph, 'facts.ndjson'), [{
    id: 'secret-fact', subject: 'A', predicate: 'identity_is', object: 'B', validFromChapter: 1, revealFromChapter: 3,
    provenance: provenance(3),
  }, {
    id: 'event-fact', subject: 'A', predicate: 'met', object: 'C', validFromChapter: 2,
    provenance: { ...provenance(2), eventId: 'event-a-c', eventOrdinal: 1 },
  }])
  await writeNdjson(join(graph, 'knowledge.ndjson'), [{
    id: 'secret-knowledge', character: 'POV', factId: 'secret-fact', stance: 'knows', knownFromChapter: 3, provenance: provenance(3),
  }])
  await writeNdjson(join(graph, 'identities.ndjson'), [{
    id: 'secret-identity', subject: 'A', relation: 'identity_is', object: 'B', validFromChapter: 1, revealFromChapter: 3,
    provenance: provenance(3),
  }])
  await writeNdjson(join(graph, 'mysteries.ndjson'), [{
    id: 'secret-mystery', label: 'A identity', revealChapter: 3, forbiddenBeforeReveal: ['A就是B'], provenance: provenance(3),
  }])
  await writeNdjson(join(graph, 'relationships.ndjson'), [{
    id: 'relation-pov-a', subject: 'POV', object: 'A', validFromChapter: 1, relation: 'knows', provenance: provenance(1),
  }])
  await writeNdjson(join(graph, 'events.ndjson'), [{
    id: 'event-a-c', chapter: 2, orderInChapter: 1, summary: 'A meets C', participants: ['A', 'C'], consequences: ['C learns about A'], provenance: provenance(2),
  }])
  await writeNdjson(join(graph, 'powers.ndjson'), [{
    id: 'power-system', subject: '修炼体系', validFromChapter: 1, realm: 'low→high', capabilities: ['higher realms may unlock new capabilities'], provenance: provenance(1),
  }])
  await writeNdjson(join(graph, 'causality.ndjson'), [{
    id: 'cause-a-c', introducedByChapter: 2, cause: 'A meets C', effect: 'C learns about A', provenance: provenance(2),
  }])

  return new LocalFanficProvider({
    providerId: 'test', canonPackDir: pack, stateDir: state,
    maxSearchResults: 10, maxExcerptChars: 500, maxStructuredRecords: 32,
    authorContextMaxEntities: 12, authorContextSearchLimit: 8, authorContextCharacterLimit: 8,
    authorContextEvidenceLimit: 3, storyRecentSummaryLimit: 5, voiceDialogueFragmentLimit: 6,
    styleReferenceChapterLimit: 8, styleSampleExcerptChars: 300,
    antiCopyMaxDraftChars: 10000, antiCopyMaxFindings: 6, styleDeviationRatio: 0.8,
    styleRevisionRequiredRatio: 100, authorContextBranchRecordLimit: 24,
    authorContextSourceExcerptLimit: 2, authorContextMaxJsonChars: 40000,
  })
}

async function settlementReceipts(
  provider: LocalFanficProvider,
  branch: FanficBranch,
  fanficChapter: number,
  draft: string,
): Promise<readonly string[]> {
  const canon = await provider.audit({ draft, asOfChapter: 3, povCharacter: 'POV', branchId: branch.id, fanficChapter, participants: [], claims: [] })
  const style = await provider.auditNarrativeStyle({
    draft, asOfChapter: 3, mode: 'auto', query: '', participants: [], branchId: branch.id, fanficChapter,
    sampleLimit: 2, antiCopyMinPhraseChars: 16, antiCopyMaxFindings: 4,
  })
  const copy = await provider.antiCopyGuard({
    draft, asOfChapter: 3, branchId: branch.id, fanficChapter, minPhraseChars: 16, maxFindings: 4,
  })
  if (!canon.ok || !canon.auditReceipt || !style.ok || !style.auditReceipt || !copy.ok || !copy.auditReceipt) {
    throw new Error('test settlement audits did not produce three passing receipts')
  }
  return [canon.auditReceipt.id, style.auditReceipt.id, copy.auditReceipt.id]
}

async function settle(
  provider: LocalFanficProvider,
  branch: FanficBranch,
  delta: FanficStateDelta,
  draft: string,
  rewriteMode?: FanficRewriteMode,
  confirmDroppedState?: boolean,
): Promise<FanficBranch> {
  const auditReceiptIds = await settlementReceipts(provider, branch, delta.fanficChapter, draft)
  return provider.applyDelta({
    branchId: branch.id,
    expectedRevision: branch.revision,
    delta,
    draft,
    auditReceiptIds,
    ...(rewriteMode === undefined ? {} : { rewriteMode }),
    ...(confirmDroppedState === undefined ? {} : { confirmDroppedState }),
  })
}

describe('LocalFanficProvider temporal isolation', () => {
  it('filters future canon before source ranking and structured snapshots', async () => {
    const provider = await harness()
    expect(await provider.search({ query: 'secret', asOfChapter: 2, limit: 10 })).toEqual([])
    const before = await provider.snapshot({ asOfChapter: 2, povCharacter: 'POV', entities: ['A'], query: 'A B', searchLimit: 4 })
    expect(before.facts.map(fact => fact.id)).toEqual(['event-fact'])
    expect(before.identities).toEqual([])
    expect(before.povKnowledge).toEqual([])

    const after = await provider.snapshot({ asOfChapter: 3, povCharacter: 'POV', entities: ['A'], query: 'A B', searchLimit: 4 })
    expect(after.facts.map(fact => fact.id)).toContain('secret-fact')
    expect(after.identities.map(edge => edge.id)).toContain('secret-identity')
    expect(after.povKnowledge.map(item => item.id)).toContain('secret-knowledge')
  })

  it('treats post-divergence canon as counterfactual and accepts branch-established replacements', async () => {
    const provider = await harness()
    let branch = await provider.createBranch({ name: 'branch', baseChapter: 1, notes: '' })
    branch = await provider.recordDivergence({
      branchId: branch.id, expectedRevision: branch.revision, atChapter: 2,
      summary: 'branch leaves canon', immediateConsequences: [], openQuestions: [],
    })

    const unestablished = await provider.audit({
      draft: 'A就是B', asOfChapter: 3, povCharacter: 'POV', branchId: branch.id, fanficChapter: 1,
      claims: [{ kind: 'identity', subject: 'A', object: 'B' }],
    })
    expect(unestablished.ok).toBe(true)
    expect(unestablished.issues.map(issue => issue.code)).toContain('COUNTERFACTUAL_IDENTITY_UNESTABLISHED')

    branch = await settle(provider, branch, {
      fanficChapter: 2,
      facts: [{ subject: 'A', predicate: 'identity_is', object: 'B', validFromFanficChapter: 2 }],
      knowledge: [{ character: 'POV', subject: 'A', predicate: 'identity_is', object: 'B', summary: 'A就是B', stance: 'knows', fromFanficChapter: 2 }],
    }, 'branch establishes A identity as B')
    const established = await provider.audit({
      draft: 'A就是B', asOfChapter: 3, povCharacter: 'POV', branchId: branch.id, fanficChapter: 3,
      claims: [
        { kind: 'identity', subject: 'A', object: 'B' },
        { kind: 'knowledge', subject: 'A', predicate: 'identity_is', object: 'B' },
      ],
    })
    expect(established.ok).toBe(true)
    expect(established.issues).toEqual([])
  })

  it('hides later branch state from an earlier fanfic chapter', async () => {
    const provider = await harness()
    let branch = await provider.createBranch({ name: 'branch', baseChapter: 1, notes: '' })
    branch = await settle(provider, branch, {
      fanficChapter: 2,
      chapterSummary: 'future state',
      facts: [{ subject: 'OC', predicate: 'alive', object: true, validFromFanficChapter: 2 }],
      knowledge: [{ character: 'POV', subject: 'OC', predicate: 'alive', object: 'true', summary: 'knows future', stance: 'knows', fromFanficChapter: 2 }],
    }, 'future branch state')
    const context = await provider.authorContext({
      asOfChapter: 2, povCharacter: 'POV', participants: ['OC'], sceneGoal: 'rewrite chapter one', query: 'OC',
      branchId: branch.id, fanficChapter: 1,

      storyHorizonSize: 5, styleMode: 'auto', styleSampleLimit: 2,
    })
    expect(context.branch?.facts).toEqual([])
    expect(context.branch?.knowledge).toEqual([])
    expect(context.branch?.chapterSummaries).toEqual([])
  })


  it('expands omitted scene entities and composes character/power intelligence', async () => {
    const provider = await harness()
    const expansion = await provider.expandContext({ asOfChapter: 2, seeds: ['POV'], query: 'A', maxEntities: 8 })
    expect(expansion.discovered.map(item => item.entity)).toContain('A')

    const context = await provider.authorContext({
      asOfChapter: 2, povCharacter: 'POV', participants: [], sceneGoal: 'investigate A', query: 'A',

      storyHorizonSize: 5, styleMode: 'auto', styleSampleLimit: 2,
    })
    expect(context.contextExpansion.discovered.map(item => item.entity)).toContain('A')
    expect(context.characterIntelligence.map(item => item.character)).toContain('A')

    const voice = await provider.characterVoiceContext({ character: 'A', asOfChapter: 2, limit: 2 })
    expect(voice.samples.every(sample => sample.chapter <= 2)).toBe(true)
    const power = await provider.assessPower({ actors: ['A'], asOfChapter: 2, scenario: 'A attempts a difficult technique', evidenceLimit: 2 })
    expect(power.systemRules.map(rule => rule.id)).toContain('power-system')
    expect(power.verdict).toBe('insufficient-structured-data')

    const style = await provider.narrativeStyleContext({ asOfChapter: 2, mode: 'auto', query: 'A beta', participants: ['A'], sampleLimit: 2 })
    expect(style.samples.every(sample => sample.chapter <= 2)).toBe(true)
    expect(style.guidance.length).toBeGreaterThan(0)
    const overlap = await provider.antiCopyGuard({ draft: 'beta distinctive canonical phrase for overlap checking and rhythm', asOfChapter: 2, minPhraseChars: 16, maxFindings: 4 })
    expect(overlap.ok).toBe(false)
    expect(overlap.findings[0]?.sourceChapter).toBe(2)
    const futureOverlap = await provider.antiCopyGuard({ draft: 'secret omega future canonical phrase that must stay hidden from the cutoff', asOfChapter: 2, minPhraseChars: 16, maxFindings: 4 })
    expect(futureOverlap.ok).toBe(false)
    expect(futureOverlap.findings[0]?.beyondCutoff).toBe(true)
    expect(futureOverlap.findings[0]?.sourceChapter).toBeUndefined()
    const styleAudit = await provider.auditNarrativeStyle({
      draft: 'beta distinctive canonical phrase for overlap checking and rhythm', asOfChapter: 2, mode: 'auto', query: 'beta', participants: ['A'], sampleLimit: 2,
      antiCopyMinPhraseChars: 16, antiCopyMaxFindings: 4,
    })
    expect(styleAudit.ok).toBe(false)
    expect(styleAudit.antiCopy.findings.length).toBeGreaterThan(0)
  })

  it('scans causal dependencies without claiming a future outcome', async () => {
    const provider = await harness()
    const impact = await provider.impactScan({ asOfChapter: 2, summary: 'A does not meet C', entities: ['A'], limit: 8 })
    expect(impact.relatedCanonLinks.map(link => link.id)).toContain('cause-a-c')
    expect(impact.relatedEvents.map(event => event.id)).toContain('event-a-c')
    expect(impact.limitations.length).toBeGreaterThan(0)
  })

  it('orchestrates chapter-family enrichment coverage without treating checkpoints as canon truth', async () => {
    const provider = await harness()
    const initial = await provider.planEnrichment({ fromChapter: 1, toChapter: 2, kinds: ['fact', 'event'], batchSize: 4 })
    expect(initial.remainingUnits).toBe(4)
    expect(initial.work).toHaveLength(2)

    await provider.checkpointEnrichment({ chapter: 1, kind: 'fact', recordIds: [], noFindings: true, notes: 'reviewed facts' })
    await provider.checkpointEnrichment({ chapter: 2, kind: 'event', recordIds: ['event-a-c'], noFindings: false, notes: 'reviewed events' })
    await expect(provider.checkpointEnrichment({ chapter: 1, kind: 'event', recordIds: ['event-a-c'], noFindings: false, notes: 'wrong chapter' })).rejects.toThrow(/chapter 2/u)

    const progress = await provider.enrichmentProgress({ fromChapter: 1, toChapter: 2, kinds: ['fact', 'event'] })
    expect(progress.completedUnits).toBe(2)
    expect(progress.totalUnits).toBe(4)
    expect(progress.completionRatio).toBe(0.5)
    const next = await provider.planEnrichment({ fromChapter: 1, toChapter: 2, kinds: ['fact', 'event'], batchSize: 4 })
    expect(next.remainingUnits).toBe(2)
    expect(next.work.find(item => item.chapter === 1)?.pendingKinds).toEqual(['event'])
    expect(next.work.find(item => item.chapter === 2)?.pendingKinds).toEqual(['fact'])
  })

  it('persists Story Director metadata and surfaces long-form attention in author context', async () => {
    const provider = await harness()
    let branch = await provider.createBranch({ name: 'director', baseChapter: 1, notes: '' })
    branch = await provider.updateStoryDirector({
      branchId: branch.id,
      expectedRevision: branch.revision,
      storyDirector: {
        arcs: [{
          id: 'arc-main', title: 'Main arc', status: 'active', objective: 'Change one canon dependency', centralConflict: 'Choice versus inertia',
          themes: ['choice'], characters: ['POV', 'A'], startFanficChapter: 1, targetEndFanficChapter: 4, plannedPayoffs: ['observer revealed'], notes: [],
        }],
        threads: [{
          id: 'thread-observer', kind: 'mystery', status: 'open', priority: 5, summary: 'Who notices the divergence?', entities: ['POV', 'A'],
          openedFanficChapter: 1, targetFanficChapter: 2, dependencies: [], resolutionCriteria: ['identify observer'],
        }],
        foreshadows: [{
          id: 'foreshadow-observer', status: 'planted', clue: 'odd delay', payoff: 'observer identified', relatedThreads: ['thread-observer'],
          plantedFanficChapter: 1, targetFanficChapter: 2, subtlety: 'background',
        }],
        horizon: [{
          fanficChapter: 1, status: 'planned', goal: 'establish divergence', pov: 'POV', beats: ['notice anomaly'], advanceThreads: [],
          plantForeshadows: [], payoffForeshadows: [], constraints: ['limited POV'],
        }],
        mysteryTruths: [],
        inventions: [],
        reconciliation: [],
      },
    })
    const director = await provider.storyDirectorContext({ branchId: branch.id, fanficChapter: 1, horizonSize: 3 })
    expect(director.activeArcs.map(arc => arc.id)).toContain('arc-main')
    expect(director.attention.some(item => item.includes('thread-observer'))).toBe(true)

    const context = await provider.authorContext({
      asOfChapter: 2, povCharacter: 'POV', participants: ['A'], sceneGoal: 'continue branch', query: 'A', branchId: branch.id, fanficChapter: 1,

      storyHorizonSize: 5, styleMode: 'auto', styleSampleLimit: 2,
    })
    expect(context.storyDirector?.activeThreads.map(thread => thread.id)).toContain('thread-observer')
  })

  it('supersedes rewritten chapter state and excludes the current chapter while rewriting', async () => {
    const provider = await harness()
    let branch = await provider.createBranch({ name: 'rewrite', baseChapter: 1, notes: '' })
    branch = await settle(provider, branch, { fanficChapter: 1, chapterSummary: 'old', facts: [{ subject: 'OC', predicate: 'state', object: 'old', validFromFanficChapter: 1 }] }, 'old chapter one')
    const oldVersion = branch.chapterVersions.find(item => item.fanficChapter === 1 && item.status === 'active')!
    const whileRewriting = await provider.authorContext({
      asOfChapter: 2, povCharacter: 'POV', participants: ['OC'], sceneGoal: 'rewrite', query: 'OC', branchId: branch.id, fanficChapter: 1,
      storyHorizonSize: 3, styleMode: 'auto', styleSampleLimit: 2,
    })
    expect(whileRewriting.branch?.facts).toEqual([])
    expect(whileRewriting.branch?.chapterSummaries).toEqual([])

    branch = await settle(provider, branch, { fanficChapter: 1, chapterSummary: 'new', facts: [{ subject: 'OC', predicate: 'state', object: 'new', validFromFanficChapter: 1 }] }, 'new chapter one', 'replace', true)
    expect(branch.chapterVersions.find(item => item.id === oldVersion.id)?.status).toBe('superseded')
    expect(branch.chapterVersions.filter(item => item.fanficChapter === 1 && item.status === 'active')).toHaveLength(1)
    const downstream = await provider.authorContext({
      asOfChapter: 2, povCharacter: 'POV', participants: ['OC'], sceneGoal: 'continue', query: 'OC', branchId: branch.id, fanficChapter: 2,
      storyHorizonSize: 3, styleMode: 'auto', styleSampleLimit: 2,
    })
    expect(downstream.branch?.facts.map(item => item.object)).toEqual(['new'])
    expect(downstream.branch?.chapterSummaries.map(item => item.summary)).toEqual(['new'])
  })

  it('versions causal-thread resolutions so rewriting the resolving chapter restores prior state', async () => {
    const provider = await harness()
    let branch = await provider.createBranch({ name: 'causal rewrite', baseChapter: 1, notes: '' })
    branch = await settle(provider, branch, { fanficChapter: 1, causalThreads: [{ summary: 'open consequence', status: 'open', fromFanficChapter: 1 }] }, 'open causal consequence')
    const threadId = branch.causalThreads[0]!.id
    branch = await settle(provider, branch, { fanficChapter: 2, resolveCausalThreadIds: [threadId] }, 'resolve causal consequence')
    expect(branch.causalThreads.find(item => item.id === threadId)?.status).toBe('resolved')

    branch = await settle(provider, branch, { fanficChapter: 2, chapterSummary: 'rewrite without resolution' }, 'rewrite without resolution', 'replace', true)
    const downstream = await provider.authorContext({
      asOfChapter: 2, povCharacter: 'POV', participants: [], sceneGoal: 'after rewrite', query: '', branchId: branch.id, fanficChapter: 3,
      storyHorizonSize: 3, styleMode: 'auto', styleSampleLimit: 1,
    })
    expect(downstream.branch?.causalThreads.find(item => item.id === threadId)?.status).toBe('open')
  })

  it('preserves structured events before a same-chapter divergence without exposing raw chapter text as truth', async () => {
    const provider = await harness()
    let branch = await provider.createBranch({ name: 'same chapter', baseChapter: 2, notes: '' })
    branch = await provider.recordDivergence({
      branchId: branch.id, expectedRevision: branch.revision, atChapter: 2, afterEventId: 'event-a-c',
      summary: 'diverge after meeting', immediateConsequences: [], openQuestions: [],
    })
    const context = await provider.authorContext({
      asOfChapter: 2, povCharacter: 'POV', participants: ['A', 'C'], sceneGoal: 'after meeting', query: 'A C', branchId: branch.id, fanficChapter: 1,
      storyHorizonSize: 3, styleMode: 'auto', styleSampleLimit: 2,
    })
    expect(context.canonTruth.asOfChapter).toBe(1)
    expect(context.canonSameChapterTruth?.events.map(item => item.id)).toContain('event-a-c')
    expect(context.canonSameChapterTruth?.facts.map(item => item.id)).toContain('event-fact')
    expect(context.canonSameChapterTruth?.sourceExcerpts).toEqual([])
    expect(context.canonReference?.asOfChapter).toBe(2)
  })

  it('independently extracts undeclared risky draft claims and enforces Han-character length', async () => {
    const provider = await harness()
    const audit = await provider.audit({ draft: 'A催动剑气封住门口。', asOfChapter: 2, povCharacter: 'POV', participants: ['A'], claims: [] })
    expect(audit.coverage.uncoveredRiskyClaims.some(claim => claim.kind === 'power')).toBe(true)
    expect(audit.issues.map(issue => issue.code)).toContain('AUDIT_COVERAGE_UNDECLARED_POWER')

    const style = await provider.auditNarrativeStyle({
      draft: '短句。\n\n又一句。', asOfChapter: 2, mode: 'auto', query: 'A', participants: ['A'], sampleLimit: 2,
      antiCopyMinPhraseChars: 16, antiCopyMaxFindings: 4, targetMinHanChars: 100, targetMaxHanChars: 200,
    })
    expect(style.lengthContract.actualHanChars).toBeLessThan(100)
    expect(style.lengthContract.withinTarget).toBe(false)
    expect(style.ok).toBe(false)
  })

  it('admits only token-bound structured enrichment backed by source evidence', async () => {
    const provider = await harness()
    const candidate = {
      kind: 'fact' as const,
      chapter: 2,
      evidence: 'beta distinctive',
      payload: { id: 'enriched-beta', subject: 'A', predicate: 'saw', object: 'beta', validFromChapter: 2 },
    }
    const invalid = await provider.validateEnrichment({ ...candidate, evidence: 'not in source' })
    expect(invalid.valid).toBe(false)

    const validation = await provider.validateEnrichment(candidate)
    expect(validation.valid).toBe(true)
    expect(validation.token).toBeTruthy()
    await expect(provider.commitEnrichment({ candidate, token: 'wrong' })).rejects.toThrow(/token/u)
    await provider.commitEnrichment({ candidate, token: validation.token! })

    const status = await provider.status()
    expect(status.enrichmentCounts.fact).toBe(1)
    const snapshot = await provider.snapshot({ asOfChapter: 2, entities: ['A'], query: 'beta', searchLimit: 2 })
    expect(snapshot.facts.map(fact => fact.id)).toContain('enriched-beta')
  })

})

function chapter(index: number, title: string, text: string) {
  return { index, title, part: 'Part', href: `ch-${index}.html`, sha256: sha(`chapter-${index}`), text }
}

function provenance(chapterIndex: number) {
  return { sourceSha256: SOURCE_SHA, chapter: chapterIndex, chapterSha256: sha(`chapter-${chapterIndex}`), href: `ch-${chapterIndex}.html` }
}

async function writeNdjson(path: string, rows: readonly unknown[]): Promise<void> {
  await writeFile(path, `${rows.map(row => JSON.stringify(row)).join('\n')}\n`)
}
