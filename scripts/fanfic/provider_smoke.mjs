#!/usr/bin/env node
/** Keyless end-to-end smoke for the compiled local fanfic provider and bundled 一世之尊 pack. */
import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LocalFanficProvider } from '../../packages/fanfic/fanfic-local/lib/types/provider.js'

const repo = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const state = resolve(repo, '.dsh-fanfic-state-smoke')
await rm(state, { recursive: true, force: true })

const provider = new LocalFanficProvider({
  providerId: 'local-smoke',
  canonPackDir: resolve(repo, 'canon-packs/yishizhizun'),
  stateDir: state,
  maxSearchResults: 12,
  maxExcerptChars: 1000,
  maxStructuredRecords: 64,
  authorContextMaxEntities: 12,
  authorContextSearchLimit: 8,
  authorContextCharacterLimit: 8,
  authorContextEvidenceLimit: 3,
  storyRecentSummaryLimit: 5,
  voiceDialogueFragmentLimit: 6,
  styleReferenceChapterLimit: 32,
  styleSampleExcerptChars: 700,
  antiCopyMaxDraftChars: 24000,
  antiCopyMaxFindings: 8,
  styleDeviationRatio: 0.7,
  styleRevisionRequiredRatio: 100,
  authorContextBranchRecordLimit: 24,
  authorContextSourceExcerptLimit: 2,
  authorContextMaxJsonChars: 40000,
})


async function auditReceipts(branch, fanficChapter, draft, asOfChapter = 150) {
  const canon = await provider.audit({ draft, asOfChapter, povCharacter: '孟奇', branchId: branch.id, fanficChapter, participants: [], claims: [] })
  const style = await provider.auditNarrativeStyle({ draft, asOfChapter, mode: 'auto', query: '', participants: [], branchId: branch.id, fanficChapter, sampleLimit: 2, antiCopyMinPhraseChars: 24, antiCopyMaxFindings: 4 })
  const copy = await provider.antiCopyGuard({ draft, asOfChapter, branchId: branch.id, fanficChapter, minPhraseChars: 24, maxFindings: 4 })
  assert(canon.ok && canon.auditReceipt, `canon audit receipt missing: ${JSON.stringify(canon.issues)}`)
  assert(style.ok && style.auditReceipt, `style audit receipt missing: ${JSON.stringify(style.deviations)}`)
  assert(copy.ok && copy.auditReceipt, `anti-copy audit receipt missing: ${JSON.stringify(copy.findings)}`)
  return [canon.auditReceipt.id, style.auditReceipt.id, copy.auditReceipt.id]
}

try {
  const status = await provider.status()
  assert(status.chapterCount === 1409, `expected 1409 chapters, got ${status.chapterCount}`)
  assert(status.graphCounts.timelineRules === 3, 'timeline-rule seeds not loaded')
  assert(status.graphCounts.causalLinks === 1, 'causal-link seeds not loaded')

  const beforeRevealSearch = await provider.search({ query: '真慧 杨戬', asOfChapter: 927, limit: 12 })
  assert(beforeRevealSearch.every(hit => hit.chapter <= 927), 'source search crossed spoiler cutoff')
  const atRevealSearch = await provider.search({ query: '真慧 杨戬', asOfChapter: 928, limit: 12 })
  assert(atRevealSearch.some(hit => hit.chapter === 928), 'source search missed the reveal chapter at its cutoff')

  const before = await provider.snapshot({ asOfChapter: 927, povCharacter: '孟奇', entities: ['真慧'], query: '真慧 杨戬', searchLimit: 6 })
  const after = await provider.snapshot({ asOfChapter: 928, povCharacter: '孟奇', entities: ['真慧'], query: '真慧 杨戬', searchLimit: 6 })
  assert(!before.identities.some(edge => edge.object === '杨戬'), 'identity leaked before reveal')
  assert(!before.facts.some(fact => fact.id === 'fact-zhenhui-consciousness-yangjian'), 'hidden fact leaked before reveal')
  assert(!before.povKnowledge.some(item => item.factId === 'fact-zhenhui-consciousness-yangjian'), 'POV future knowledge leaked')
  assert(after.identities.some(edge => edge.object === '杨戬'), 'identity missing at reveal')
  assert(after.facts.some(fact => fact.id === 'fact-zhenhui-consciousness-yangjian'), 'fact missing at reveal')
  assert(after.povKnowledge.some(item => item.factId === 'fact-zhenhui-consciousness-yangjian'), 'POV knowledge missing at reveal')

  const proseAudit = await provider.audit({ draft: '孟奇早就知道真慧就是杨戬。', asOfChapter: 927, povCharacter: '孟奇', claims: [] })
  assert(!proseAudit.ok && proseAudit.issues.some(issue => issue.code === 'PREMATURE_REVEAL'), 'audit missed premature prose reveal')
  const claimAudit = await provider.audit({
    draft: 'test',
    asOfChapter: 927,
    povCharacter: '孟奇',
    claims: [{ kind: 'identity', subject: '真慧', object: '杨戬' }],
  })
  assert(!claimAudit.ok && claimAudit.issues.some(issue => issue.code === 'PREMATURE_IDENTITY_REVEAL'), 'audit missed structured future identity claim')

  let branch = await provider.createBranch({
    name: 'smoke divergence',
    baseChapter: 100,
    notes: 'keyless smoke',
    authorIntent: { premise: 'OC survives and changes the board', divergenceMode: 'soft-divergence' },
  })
  branch = await provider.updateIntent({
    branchId: branch.id,
    expectedRevision: branch.revision,
    authorIntent: {
      premise: 'OC survives and changes the board',
      divergenceMode: 'soft-divergence',
      themes: ['自由与操纵'],
      tone: ['江湖', '悬疑'],
      povPolicy: ['limited POV'],
      characterPriorities: ['孟奇 character logic'],
      forbiddenOutcomes: ['railroad canon'],
      styleNotes: ['show consequences through outsiders when useful'],
    },
  })
  branch = await provider.recordDivergence({
    branchId: branch.id,
    expectedRevision: branch.revision,
    atChapter: 100,
    summary: 'OC救下原本会死亡的人物',
    immediateConsequences: ['该人物继续存活'],
    openQuestions: ['谁会发现？'],
  })

  branch = await provider.updateStoryDirector({
    branchId: branch.id,
    expectedRevision: branch.revision,
    storyDirector: {
      arcs: [{
        id: 'arc-survival-ripple', title: '存活者的涟漪', status: 'active', objective: '追踪一次救援如何改变孟奇周围的局势',
        centralConflict: '保持人物逻辑的同时承受偏离原著后的连锁反应', themes: ['自由与操纵'], characters: ['孟奇', 'OC'],
        startFanficChapter: 1, targetEndFanficChapter: 5, plannedPayoffs: ['揭示谁最先注意到异常'], notes: [],
      }],
      threads: [{
        id: 'thread-who-notices', kind: 'mystery', status: 'open', priority: 5, summary: '谁会最先发现OC本应死亡却仍然存活？',
        entities: ['OC', '孟奇'], openedFanficChapter: 1, targetFanficChapter: 3, dependencies: ['OC存活'], resolutionCriteria: ['至少确认一个观察者及其证据来源'],
      }],
      foreshadows: [{
        id: 'foreshadow-unseen-observer', status: 'planted', clue: '一次不自然的视线或消息传播延迟', payoff: '确认隐藏观察者已经注意到偏差',
        relatedThreads: ['thread-who-notices'], plantedFanficChapter: 1, targetFanficChapter: 3, subtlety: 'background',
      }],
      horizon: [{
        fanficChapter: 2, status: 'planned', goal: '让孟奇确认OC仍活着但不立即揭开原因', pov: '孟奇', beats: ['会面', '验证存活事实'],
        advanceThreads: [], plantForeshadows: [], payoffForeshadows: [], constraints: ['保持limited POV'],
      }],
    },
  })
  const director = await provider.storyDirectorContext({ branchId: branch.id, fanficChapter: 2, horizonSize: 5 })
  assert(director.activeArcs.some(arc => arc.id === 'arc-survival-ripple'), 'Story Director lost active arc')
  assert(director.attention.some(item => item.includes('thread-who-notices')), 'Story Director did not flag a due thread omitted from horizon')

  const trace = await provider.traceCausality({ query: '金皇 孟奇', asOfChapter: 1349, limit: 5 })
  assert(trace.links.some(link => link.id === 'causal-gold-mother-shapes-mengqi-choice'), 'verified causality seed not found')

  const expansion = await provider.expandContext({ asOfChapter: 41, seeds: ['孟奇'], query: '顾小桑', maxEntities: 10 })
  assert(expansion.discovered.some(item => item.entity === '顾小桑'), 'context expansion did not discover 顾小桑 from 孟奇')
  const dossier = await provider.characterIntelligence({ character: '顾小桑', asOfChapter: 41, evidenceLimit: 4 })
  assert(dossier.relationships.some(relation => relation.subject === '孟奇' || relation.object === '孟奇'), 'character intelligence missed verified relationship')
  const voice = await provider.characterVoiceContext({ character: '顾小桑', asOfChapter: 41, limit: 3 })
  assert(voice.samples.length > 0 && voice.samples.every(sample => sample.chapter <= 41), 'voice evidence missing or crossed spoiler cutoff')
  assert(voice.samples.some(sample => sample.dialogueFragments.length > 0), 'voice evidence did not extract any contextual dialogue fragment')
  const styleContext = await provider.narrativeStyleContext({ asOfChapter: 41, mode: 'mystery', query: '顾小桑 身份', povCharacter: '孟奇', participants: ['顾小桑'], sampleLimit: 4 })
  assert(styleContext.resolvedMode === 'mystery', 'explicit narrative style mode changed unexpectedly')
  assert(styleContext.samples.length > 0 && styleContext.samples.every(sample => sample.chapter <= 41), 'style evidence crossed spoiler cutoff')
  assert(styleContext.referenceMetrics.meanSentenceChars > 0, 'style bank did not produce reference metrics')
  const chapterOne = await provider.readChapter({ chapter: 1, asOfChapter: 1 })
  const copiedVisible = chapterOne.text.replace(/\s+/gu, '').slice(20, 70)
  const visibleCopy = await provider.antiCopyGuard({ draft: copiedVisible, asOfChapter: 41, minPhraseChars: 24, maxFindings: 4 })
  assert(!visibleCopy.ok && visibleCopy.findings.some(item => item.sourceChapter === 1), 'anti-copy guard missed visible source overlap')
  const futureChapter = await provider.readChapter({ chapter: 928, asOfChapter: 928 })
  const copiedFuture = futureChapter.text.replace(/\s+/gu, '').slice(30, 90)
  const futureCopy = await provider.antiCopyGuard({ draft: copiedFuture, asOfChapter: 927, minPhraseChars: 24, maxFindings: 4 })
  assert(!futureCopy.ok && futureCopy.findings.some(item => item.beyondCutoff && item.sourceChapter === undefined), 'anti-copy guard leaked or missed future-source overlap')
  const styleAudit = await provider.auditNarrativeStyle({
    draft: copiedVisible, asOfChapter: 41, mode: 'mystery', query: '顾小桑 身份', povCharacter: '孟奇', participants: ['顾小桑'], sampleLimit: 3,
    antiCopyMinPhraseChars: 24, antiCopyMaxFindings: 4,
  })
  assert(!styleAudit.ok && styleAudit.antiCopy.findings.length > 0, 'style audit did not incorporate anti-copy findings')
  const powerAssessment = await provider.assessPower({ actors: ['孟奇', '顾小桑'], asOfChapter: 41, scenario: '轮回任务交手', evidenceLimit: 3 })
  assert(powerAssessment.systemRules.length > 0, 'power assessment missed cultivation-system rules')
  const timeline = await provider.timelineContext({ asOfChapter: 1349, worldline: '诸天万界', query: '历史改变', entities: ['孟奇'], limit: 8 })
  assert(timeline.rules.some(rule => rule.id === 'timeline-history-rewrite-memory' || rule.id === 'timeline-rewrite-awareness-by-realm'), 'timeline intelligence missed history-rewrite rules')
  const impact = await provider.impactScan({ asOfChapter: 1349, summary: '金皇操纵局势逼迫孟奇作出关键选择', entities: ['金皇', '孟奇'], limit: 8 })
  assert(impact.relatedCanonLinks.some(link => link.id === 'causal-gold-mother-shapes-mengqi-choice'), 'impact scan missed verified causal link')

  const context = await provider.authorContext({
    asOfChapter: 150,
    povCharacter: '孟奇',
    participants: ['顾小桑'],
    sceneGoal: 'exercise divergence policy',
    query: '孟奇 顾小桑',
    branchId: branch.id,
    fanficChapter: 2,

    storyHorizonSize: 5,
    styleMode: 'auto',
    styleSampleLimit: 4,
  })
  assert(context.divergencePolicy.diverged, 'author context did not detect divergence')
  assert(context.divergencePolicy.canonStableThroughChapter === 99, 'canonTruth did not stop before divergence')
  assert(context.canonTruth.asOfChapter === 99, 'canonTruth snapshot uses wrong cutoff')
  assert(context.canonReference?.asOfChapter === 150, 'counterfactual canonReference missing')
  assert(context.branch?.authorIntent.themes.includes('自由与操纵') === true, 'author intent missing from author context')
  assert(context.contextExpansion.discovered.length > 0, 'author context did not expose context expansion')
  assert(context.characterIntelligence.some(item => item.character === '孟奇'), 'author context did not include POV character intelligence')
  assert(context.storyDirector?.activeThreads.some(thread => thread.id === 'thread-who-notices') === true, 'author context did not include Story Director state')
  assert(context.narrativeStyle.samples.every(sample => sample.chapter <= 150), 'author context style evidence crossed canon cutoff')
  assert(context.narrativeStyle.guidance.length > 0, 'author context did not include narrative style guidance')

  const previousRevision = branch.revision
  const chapter2Draft = '孟奇确认OC仍然活着，并把这件事记在心里。'
  branch = await provider.applyDelta({
    branchId: branch.id, expectedRevision: previousRevision, draft: chapter2Draft, auditReceiptIds: await auditReceipts(branch, 2, chapter2Draft),
    delta: {
      fanficChapter: 2,
      chapterSummary: 'OC与孟奇会面。',
      facts: [{ subject: 'OC', predicate: 'alive', object: true, validFromFanficChapter: 2 }],
      knowledge: [{ character: '孟奇', subject: 'OC', predicate: 'alive', object: 'true', summary: '知道OC仍活着', stance: 'knows', fromFanficChapter: 2 }],
      causalThreads: [{ summary: '调查OC存活原因', status: 'open', fromFanficChapter: 2 }],
    },
  })
  assert(branch.revision === previousRevision + 1 && branch.facts.length === 1 && branch.causalThreads.length === 1, 'Observer/Reflector delta did not persist')
  assert(branch.storyDirector.horizon.find(plan => plan.fanficChapter === 2)?.status === 'accepted', 'accepted chapter did not settle matching Story Director horizon entry')
  const causalThreadId = branch.causalThreads[0].id

  const chapterOneContext = await provider.authorContext({
    asOfChapter: 150,
    povCharacter: '孟奇',
    participants: ['OC'],
    sceneGoal: 'edit the first fanfic chapter without seeing chapter two state',
    query: 'OC',
    branchId: branch.id,
    fanficChapter: 1,

    storyHorizonSize: 5,
    styleMode: 'auto',
    styleSampleLimit: 4,
  })
  assert(chapterOneContext.branch?.facts.length === 0, 'fanfic fact leaked backward from chapter two into chapter one')
  assert(chapterOneContext.branch?.knowledge.length === 0, 'fanfic knowledge leaked backward from chapter two into chapter one')
  assert(chapterOneContext.branch?.chapterSummaries.length === 0, 'fanfic chapter summary leaked backward from chapter two into chapter one')

  const counterfactualAudit = await provider.audit({
    draft: '真慧就是杨戬。',
    asOfChapter: 928,
    povCharacter: '孟奇',
    branchId: branch.id,
    fanficChapter: 2,
    claims: [{ kind: 'identity', subject: '真慧', object: '杨戬' }],
  })
  assert(counterfactualAudit.ok, 'counterfactual later canon should not be a hard error after divergence')
  assert(counterfactualAudit.issues.some(issue => issue.code === 'COUNTERFACTUAL_IDENTITY_UNESTABLISHED'), 'audit did not flag counterfactual identity as branch-unestablished')

  const chapter3Draft = '分支中的新证据使孟奇确认了一个身份事实。'
  branch = await provider.applyDelta({
    branchId: branch.id, expectedRevision: branch.revision, draft: chapter3Draft, auditReceiptIds: await auditReceipts(branch, 3, chapter3Draft, 928),
    delta: {
      fanficChapter: 3,
      facts: [{ subject: '真慧', predicate: 'identity_is', object: '杨戬', validFromFanficChapter: 3 }],
      knowledge: [{ character: '孟奇', subject: '真慧', predicate: 'identity_is', object: '杨戬', summary: '真慧就是杨戬', stance: 'knows', fromFanficChapter: 3 }],
      resolveCausalThreadIds: [causalThreadId],
    },
  })
  assert(branch.causalThreads.find(thread => thread.id === causalThreadId)?.status === 'resolved', 'Observer/Reflector did not resolve existing causal thread by id')
  const branchEstablishedAudit = await provider.audit({
    draft: '真慧就是杨戬。',
    asOfChapter: 928,
    povCharacter: '孟奇',
    branchId: branch.id,
    fanficChapter: 4,
    claims: [
      { kind: 'identity', subject: '真慧', object: '杨戬' },
      { kind: 'knowledge', subject: '真慧', predicate: 'identity_is', object: '杨戬' },
    ],
  })
  assert(branchEstablishedAudit.ok, `branch-established reveal should pass audit: ${JSON.stringify(branchEstablishedAudit.issues)}`)
  let staleRevisionRejected = false
  try {
    await provider.applyDelta({ branchId: branch.id, expectedRevision: previousRevision, draft: 'stale', auditReceiptIds: ['x','y','z'], delta: { fanficChapter: 3 } })
  } catch {
    staleRevisionRejected = true
  }
  assert(staleRevisionRejected, 'stale branch revision was accepted')

  const enrichmentPlanBefore = await provider.planEnrichment({ fromChapter: 41, toChapter: 41, kinds: ['fact', 'identity'], batchSize: 2 })
  assert(enrichmentPlanBefore.remainingUnits === 2, 'fresh enrichment coverage did not expose both review units')
  assert(enrichmentPlanBefore.work[0]?.pendingKinds.includes('fact') === true && enrichmentPlanBefore.work[0]?.pendingKinds.includes('identity') === true, 'enrichment work item missing pending families')

  const enrichmentCandidate = {
    kind: 'fact',
    chapter: 41,
    evidence: '“我是顾小桑。”',
    payload: { id: 'fact-smoke-guxiaosang-self-id', subject: '顾小桑', predicate: 'self_identifies_as', object: '顾小桑', validFromChapter: 41, revealFromChapter: 41, confidence: 1 },
    rationale: 'keyless smoke',
  }
  const invalidEnrichment = await provider.validateEnrichment({ ...enrichmentCandidate, evidence: '不存在的原文证据' })
  assert(!invalidEnrichment.valid, 'non-source enrichment evidence was accepted')
  const enrichmentValidation = await provider.validateEnrichment(enrichmentCandidate)
  assert(enrichmentValidation.valid && enrichmentValidation.token !== undefined, 'valid enrichment evidence did not produce a token')
  const enrichmentCommit = await provider.commitEnrichment({ candidate: enrichmentCandidate, token: enrichmentValidation.token })
  const finalStatus = await provider.status()
  assert(finalStatus.enrichmentCounts.fact === 1, 'verified enrichment overlay did not reload after commit')
  const enrichedSnapshot = await provider.snapshot({ asOfChapter: 41, entities: ['顾小桑'], query: '顾小桑', searchLimit: 2 })
  assert(enrichedSnapshot.facts.some(fact => fact.id === enrichmentCommit.id), 'verified enrichment did not join canon snapshots')

  let wrongCheckpointRejected = false
  try {
    await provider.checkpointEnrichment({ chapter: 31, kind: 'fact', recordIds: [enrichmentCommit.id], noFindings: false, notes: 'wrong chapter smoke' })
  } catch {
    wrongCheckpointRejected = true
  }
  assert(wrongCheckpointRejected, 'enrichment checkpoint accepted a record sourced from another chapter')
  await provider.checkpointEnrichment({ chapter: 41, kind: 'fact', recordIds: [enrichmentCommit.id, 'fact-xiaozi-identity-guxiaosang'], noFindings: false, notes: 'fact pass reviewed' })
  const enrichmentPlanMid = await provider.planEnrichment({ fromChapter: 41, toChapter: 41, kinds: ['fact', 'identity'], batchSize: 2 })
  assert(enrichmentPlanMid.remainingUnits === 1 && enrichmentPlanMid.work[0]?.pendingKinds.length === 1 && enrichmentPlanMid.work[0]?.pendingKinds[0] === 'identity', 'enrichment planner did not honor completed fact checkpoint')
  await provider.checkpointEnrichment({ chapter: 41, kind: 'identity', recordIds: ['identity-xiaozi-guxiaosang'], noFindings: false, notes: 'identity pass reviewed' })
  const enrichmentProgress = await provider.enrichmentProgress({ fromChapter: 41, toChapter: 41, kinds: ['fact', 'identity'] })
  assert(enrichmentProgress.completedUnits === 2 && enrichmentProgress.completionRatio === 1, 'enrichment progress did not reach complete coverage')

  console.log(JSON.stringify({
    ok: true,
    status,
    cutoff: { beforeRevealMaxSourceChapter: Math.max(0, ...beforeRevealSearch.map(hit => hit.chapter)), revealChapterFound: atRevealSearch.some(hit => hit.chapter === 928) },
    epistemics: { beforeReveal: { facts: before.facts.length, identities: before.identities.length, povKnowledge: before.povKnowledge.length }, atReveal: { facts: after.facts.length, identities: after.identities.length, povKnowledge: after.povKnowledge.length } },
    audits: { prose: proseAudit.issues.map(issue => issue.code), structured: claimAudit.issues.map(issue => issue.code), counterfactual: counterfactualAudit.issues.map(issue => issue.code), branchEstablished: branchEstablishedAudit.issues.map(issue => issue.code) },
    causalityLinks: trace.links.length,
    intelligence: {
      expansion: expansion.discovered.slice(0, 5).map(item => item.entity),
      dossierEvidence: dossier.sourceEvidence.length,
      voiceSamples: voice.samples.length,
      powerVerdict: powerAssessment.verdict,
      timelineRules: timeline.rules.length,
      impactLinks: impact.relatedCanonLinks.length,
      styleMode: styleContext.resolvedMode,
      styleSamples: styleContext.samples.length,
      visibleCopyFindings: visibleCopy.findings.length,
      futureCopyHidden: futureCopy.findings.some(item => item.beyondCutoff && item.sourceChapter === undefined),
      styleAuditOk: styleAudit.ok,
    },
    enrichment: { accepted: enrichmentCommit.accepted, id: enrichmentCommit.id, count: finalStatus.enrichmentCounts.fact, coverage: enrichmentProgress.completionRatio },
    director: { activeArcs: director.activeArcs.length, activeThreads: director.activeThreads.length, attention: director.attention },
    branch: { revision: branch.revision, theme: branch.authorIntent.themes[0], canonStableThrough: context.divergencePolicy.canonStableThroughChapter, canonReference: context.canonReference?.asOfChapter },
  }, null, 2))
} finally {
  await rm(state, { recursive: true, force: true })
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
