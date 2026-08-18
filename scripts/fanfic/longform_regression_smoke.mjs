#!/usr/bin/env node
/** v0.7 quality-enforced transactional author-workflow regression smoke. */
import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LocalFanficProvider } from '../../packages/fanfic/fanfic-local/lib/types/provider.js'

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const state = resolve(root, '.dsh-fanfic-state-v07-regression')
await rm(state, { recursive: true, force: true })
const baseConfig = {
  providerId: 'v07-regression', canonPackDir: resolve(root, 'canon-packs/yishizhizun'), stateDir: state,
  maxSearchResults: 12, maxExcerptChars: 1000, maxStructuredRecords: 64,
  authorContextMaxEntities: 12, authorContextSearchLimit: 8, authorContextCharacterLimit: 8, authorContextEvidenceLimit: 3,
  storyRecentSummaryLimit: 5, voiceDialogueFragmentLimit: 6, styleReferenceChapterLimit: 32, styleSampleExcerptChars: 700,
  antiCopyMaxDraftChars: 24000, antiCopyMaxFindings: 8, styleDeviationRatio: 0.7, styleRevisionRequiredRatio: 10,
  authorContextBranchRecordLimit: 12, authorContextSourceExcerptLimit: 1, authorContextMaxJsonChars: 20000,
  proseQualityUltraShortHanChars: 8, proseQualityMaxUltraShortRun: 8, proseQualityTailUltraShortRatio: 0.6,
  proseQualityMinBigramDiversity: 0.58, proseQualityTailFillerLimit: 6,
}
const provider = new LocalFanficProvider(baseConfig)
const ok = (value, message) => { if (!value) throw new Error(message) }
const smallContract = { language: 'zh-CN', minHanChars: 10, maxHanChars: 5000, defaultStyleMode: 'auto' }
async function branch(name, baseChapter = 41, contract = smallContract) {
  return provider.createBranch({ name, baseChapter, notes: '', authorIntent: { writingContract: contract } })
}
async function stage(p, b, chapter, text) {
  return p.stageDraft({ branchId: b.id, fanficChapter: chapter, text })
}
async function receipts(p, b, draft, asOf = 41, extraAudit = {}) {
  const canon = await p.audit({ draftId: draft.id, asOfChapter: asOf, povCharacter: '孟奇', participants: [], claims: [], ...extraAudit })
  const style = await p.auditNarrativeStyle({ draftId: draft.id, asOfChapter: asOf, mode: 'auto', query: '', participants: [], sampleLimit: 1, antiCopyMinPhraseChars: 24, antiCopyMaxFindings: 3 })
  const copy = await p.antiCopyGuard({ draftId: draft.id, asOfChapter: asOf, minPhraseChars: 24, maxFindings: 3 })
  ok(canon.ok && canon.auditReceipt, `missing canon receipt ${JSON.stringify(canon.issues)}`)
  ok(style.ok && style.auditReceipt, `missing style receipt ${JSON.stringify({ deviations: style.deviations, quality: style.quality, length: style.lengthContract })}`)
  ok(copy.ok && copy.auditReceipt, `missing anti-copy receipt ${JSON.stringify(copy.findings)}`)
  return [canon.auditReceipt.id, style.auditReceipt.id, copy.auditReceipt.id]
}
async function commit(p, b, delta, text, extra = {}, auditExtra = {}) {
  const draft = await stage(p, b, delta.fanficChapter, text)
  const auditReceiptIds = await receipts(p, b, draft, 41, auditExtra)
  return p.applyDelta({ branchId: b.id, expectedRevision: b.revision, delta, draftId: draft.id, auditReceiptIds, ...extra })
}

try {
  // Durable Writing Contract: a caller cannot omit the branch 2500-Han minimum.
  const defaultBranch = await provider.createBranch({ name: 'durable-contract', baseChapter: 41, notes: '' })
  const tooShort = await stage(provider, defaultBranch, 1, '孟奇停步片刻，随后继续前行。')
  const shortStyle = await provider.auditNarrativeStyle({ draftId: tooShort.id, asOfChapter: 41, mode: 'auto', query: '', participants: [], sampleLimit: 1, antiCopyMinPhraseChars: 24, antiCopyMaxFindings: 3, targetMinHanChars: 1, targetMaxHanChars: 9999 })
  ok(shortStyle.lengthContract?.minHanChars === 2500, 'staged branch style audit did not enforce durable minHanChars')
  ok(!shortStyle.ok && !shortStyle.auditReceipt, 'short staged draft received a style commit receipt')

  // Draft Store + receipt binding: modifying a staged draft invalidates prior receipts.
  let gate = await branch('draft-store-gate')
  const stagedA = await stage(provider, gate, 1, '孟奇沿着官道前行，始终留意身后的脚步声。')
  const receiptsA = await receipts(provider, gate, stagedA)
  const stagedB = await provider.updateDraft({ draftId: stagedA.id, expectedDraftRevision: stagedA.draftRevision, text: '孟奇沿着官道前行，又在岔路前停下确认方向。' })
  ok(stagedB.id === stagedA.id && stagedB.draftHash !== stagedA.draftHash, 'draft update did not retain id/change hash')
  let staleReceiptBlocked = false
  try { await provider.applyDelta({ branchId: gate.id, expectedRevision: gate.revision, delta: { fanficChapter: 1 }, draftId: stagedB.id, auditReceiptIds: receiptsA }) } catch { staleReceiptBlocked = true }
  ok(staleReceiptBlocked, 'receipts for an older staged-draft revision authorized modified prose')
  const receiptsB = await receipts(provider, gate, stagedB)
  gate = await provider.applyDelta({ branchId: gate.id, expectedRevision: gate.revision, delta: { fanficChapter: 1, chapterSummary: 'draft store gate' }, draftId: stagedB.id, auditReceiptIds: receiptsB })
  ok(gate.chapterVersions.find(item => item.status === 'active')?.draftId === stagedB.id, 'accepted chapter version did not bind staged draftId')

  // Prose Quality Guard: synthetic padding/degeneration cannot obtain a style receipt despite satisfying length.
  const qualityBranch = await provider.createBranch({ name: 'quality-guard', baseChapter: 41, notes: '', authorIntent: { writingContract: { language: 'zh-CN', minHanChars: 1000, maxHanChars: 5000, defaultStyleMode: 'auto' } } })
  const body = '孟奇沿着山路缓步而行，留意四周风声与脚印变化，也不急着给眼前异象下结论。'.repeat(45)
  const padding = ['一天结束。','明天继续。','生活继续。','调查继续。','一步一步。','慢慢来。','不急。','就这样。','好的。','嗯。','继续。','继续。'].join('\n\n')
  const degenerate = await stage(provider, qualityBranch, 1, `${body}\n\n${padding}`)
  const qualityAudit = await provider.auditNarrativeStyle({ draftId: degenerate.id, asOfChapter: 41, mode: 'auto', query: '', participants: [], sampleLimit: 1, antiCopyMinPhraseChars: 24, antiCopyMaxFindings: 3 })
  ok(qualityAudit.quality.findings.some(item => item.severity === 'revision-required'), 'degenerate prose did not trigger revision-required quality finding')
  ok(!qualityAudit.ok && !qualityAudit.auditReceipt, 'degenerate prose obtained style receipt')

  // Rewrite inherit preserves unaffected structured state and rewrite context hides old same-chapter state.
  let rw = await branch('rewrite-inherit')
  rw = await commit(provider, rw, { fanficChapter: 1, chapterSummary: 'OLD', facts: [{ subject: '测试物', predicate: 'state', object: 'old', validFromFanficChapter: 1 }], characterStates: [{ character: '孟奇', summary: '保持警惕', fromFanficChapter: 1 }] }, '孟奇收起测试物，并把异常记在心里。')
  const oldVersion = rw.chapterVersions.find(item => item.status === 'active' && item.fanficChapter === 1)
  const oldFact = rw.facts.find(item => item.originChapterVersionId === oldVersion?.id)
  ok(oldVersion && oldFact, 'missing old rewrite state')
  const rewriteCtx = await provider.authorContext({ asOfChapter: 41, povCharacter: '孟奇', participants: ['测试物'], sceneGoal: 'rewrite', query: '测试物', branchId: rw.id, fanficChapter: 1, storyHorizonSize: 3, styleMode: 'auto', styleSampleLimit: 1 })
  ok(rewriteCtx.branch?.facts.length === 0 && rewriteCtx.branch?.characterStates.length === 0, 'same-chapter old state leaked into rewrite context')
  rw = await commit(provider, rw, { fanficChapter: 1, chapterSummary: 'NEW', facts: [{ subject: '测试物', predicate: 'state', object: 'new', validFromFanficChapter: 1 }] }, '孟奇重新检查测试物，确认此前判断需要修正。', { rewriteMode: 'inherit', dropInheritedRecordIds: [oldFact.id] })
  const active = rw.chapterVersions.find(item => item.status === 'active' && item.fanficChapter === 1)
  ok(rw.characterStates.some(item => item.originChapterVersionId === active?.id && item.summary === '保持警惕'), 'inherit rewrite lost unaffected character state')

  // Replace rewrite refuses silent state loss, then permits explicit confirmed replacement.
  const replaceDraft = await stage(provider, rw, 1, '孟奇决定舍弃旧记录，只保留新的判断。')
  const replaceReceipts = await receipts(provider, rw, replaceDraft)
  let replaceBlocked = false
  try { await provider.applyDelta({ branchId: rw.id, expectedRevision: rw.revision, delta: { fanficChapter: 1, chapterSummary: 'REPLACED' }, draftId: replaceDraft.id, auditReceiptIds: replaceReceipts, rewriteMode: 'replace' }) } catch (error) { replaceBlocked = String(error).includes('discard active structured state') }
  ok(replaceBlocked, 'replace rewrite silently discarded active structured state')
  rw = await provider.applyDelta({ branchId: rw.id, expectedRevision: rw.revision, delta: { fanficChapter: 1, chapterSummary: 'REPLACED' }, draftId: replaceDraft.id, auditReceiptIds: replaceReceipts, rewriteMode: 'replace', confirmDroppedState: true })
  const replaced = rw.chapterVersions.find(item => item.status === 'active' && item.fanficChapter === 1)
  ok(rw.facts.filter(item => item.originChapterVersionId === replaced?.id).length === 0, 'replace rewrite retained discarded facts')

  // Backfill protection.
  const backfillDraft = await stage(provider, rw, 2, '第二章只记录第二章真正发生的新变化。')
  const backfillReceipts = await receipts(provider, rw, backfillDraft)
  let backfillBlocked = false
  try { await provider.applyDelta({ branchId: rw.id, expectedRevision: rw.revision, delta: { fanficChapter: 2, facts: [{ subject: '测试物', predicate: 'backfill', object: 'bad', validFromFanficChapter: 1 }] }, draftId: backfillDraft.id, auditReceiptIds: backfillReceipts }) } catch (error) { backfillBlocked = String(error).includes('cannot backfill') }
  ok(backfillBlocked, 'later chapter silently backfilled earlier state')

  // Mystery Reveal Guard + payoff authorization.
  let mystery = await branch('mystery-guard')
  mystery = await provider.upsertStoryThread({ branchId: mystery.id, expectedRevision: mystery.revision, thread: { id: 'thread-jade', kind: 'mystery', status: 'open', priority: 1, summary: '追查残玉用途', entities: ['孟奇'], openedFanficChapter: 1, targetFanficChapter: 1, dependencies: [], resolutionCriteria: ['确认残玉真正用途'] } })
  mystery = await provider.upsertForeshadow({ branchId: mystery.id, expectedRevision: mystery.revision, foreshadow: { id: 'foreshadow-jade', status: 'planned', clue: '残玉逐渐失去光泽', payoff: '确认残玉是标记并能暴露位置', relatedThreads: ['thread-jade'], targetFanficChapter: 1, subtlety: 'noticeable' } })
  mystery = await provider.upsertMysteryTruth({ branchId: mystery.id, expectedRevision: mystery.revision, mysteryTruth: { id: 'mystery-jade', status: 'active', label: '残玉用途', secretTruth: '残玉是顾小桑留下的标记，可辅助感知孟奇位置', mechanism: '残玉以有限残留联系传递方位线索', allowedClues: ['残玉逐渐失去光泽'], falseLeads: [], revealConditions: ['残玉耗尽'], protectedRevealTerms: ['残玉是标记', '感知孟奇位置'], plannedPayoff: '孟奇在残玉耗尽后确认用途', relatedThreads: ['thread-jade'] } })
  mystery = await provider.setStoryHorizon({ branchId: mystery.id, expectedRevision: mystery.revision, horizon: [{ fanficChapter: 1, status: 'planned', goal: '完成残玉用途 payoff', pov: '孟奇', beats: ['残玉耗尽'], advanceThreads: ['thread-jade'], plantForeshadows: [], payoffForeshadows: ['foreshadow-jade'], constraints: [] }] })
  const revealDraft = await stage(provider, mystery, 1, '残玉彻底耗尽后，孟奇终于确认残玉是标记，而且它此前能够帮助对方感知孟奇位置。')
  const undeclared = await provider.audit({ draftId: revealDraft.id, asOfChapter: 41, povCharacter: '孟奇', participants: [], claims: [] })
  ok(!undeclared.ok && undeclared.issues.some(item => item.code === 'MYSTERY_REVEAL_UNDECLARED'), 'protected mystery truth leaked without declaration')
  const unmet = await provider.audit({ draftId: revealDraft.id, asOfChapter: 41, povCharacter: '孟奇', participants: [], claims: [], mysteryReveals: [{ mysteryId: 'mystery-jade', level: 'truth', satisfiedConditions: [], conditionEvidence: [] }] })
  ok(!unmet.ok && unmet.issues.some(item => item.code === 'MYSTERY_REVEAL_CONDITION_NOT_MET'), 'full reveal passed without satisfied reveal condition')
  const fakeEvidence = await provider.audit({ draftId: revealDraft.id, asOfChapter: 41, povCharacter: '孟奇', participants: [], claims: [], mysteryReveals: [{ mysteryId: 'mystery-jade', level: 'truth', satisfiedConditions: ['残玉耗尽'], conditionEvidence: ['不存在于正文的证据'] }] })
  ok(!fakeEvidence.ok && fakeEvidence.issues.some(item => item.code === 'MYSTERY_REVEAL_EVIDENCE_NOT_IN_DRAFT'), 'fabricated reveal-condition evidence was accepted')
  const authorized = await provider.audit({ draftId: revealDraft.id, asOfChapter: 41, povCharacter: '孟奇', participants: [], claims: [], mysteryReveals: [{ mysteryId: 'mystery-jade', level: 'truth', satisfiedConditions: ['残玉耗尽'], conditionEvidence: ['残玉彻底耗尽'] }] })
  ok(authorized.ok && authorized.auditReceipt && authorized.authorizedMysteryRevealIds.includes('mystery-jade'), 'satisfied reveal did not receive mystery authorization')
  const mStyle = await provider.auditNarrativeStyle({ draftId: revealDraft.id, asOfChapter: 41, mode: 'auto', query: '', participants: [], sampleLimit: 1, antiCopyMinPhraseChars: 24, antiCopyMaxFindings: 3 })
  const mCopy = await provider.antiCopyGuard({ draftId: revealDraft.id, asOfChapter: 41, minPhraseChars: 24, maxFindings: 3 })
  ok(mStyle.ok && mStyle.auditReceipt && mCopy.ok && mCopy.auditReceipt, 'mystery payoff supporting receipts missing')
  mystery = await provider.applyDelta({ branchId: mystery.id, expectedRevision: mystery.revision, delta: { fanficChapter: 1, chapterSummary: '残玉耗尽，谜底揭示' }, draftId: revealDraft.id, auditReceiptIds: [authorized.auditReceipt.id, mStyle.auditReceipt.id, mCopy.auditReceipt.id] })
  ok(mystery.storyDirector.mysteryTruths.find(item => item.id === 'mystery-jade')?.status === 'revealed', 'authorized mystery truth did not transition to revealed')
  ok(mystery.storyDirector.foreshadows.find(item => item.id === 'foreshadow-jade')?.status === 'paid-off', 'authorized planned payoff did not transition')

  // Same-chapter divergence + hard Author Context telemetry/budget.
  let divergence = await branch('event-divergence')
  divergence = await provider.recordDivergence({ branchId: divergence.id, expectedRevision: divergence.revision, atChapter: 41, afterEventId: 'event-xiaozi-reveals-guxiaosang', summary: 'diverge after reveal', immediateConsequences: ['new event follows'], openQuestions: [] })
  const context = await provider.authorContext({ asOfChapter: 41, povCharacter: '孟奇', participants: ['顾小桑'], sceneGoal: 'after reveal', query: '顾小桑', branchId: divergence.id, fanficChapter: 1, storyHorizonSize: 3, styleMode: 'mystery', styleSampleLimit: 2 })
  const serialized = JSON.stringify(context).length
  ok(context.version === 4, 'author context version is not v4')
  ok(context.canonTruth.asOfChapter === 40 && context.canonSameChapterTruth?.events.some(item => item.id === 'event-xiaozi-reveals-guxiaosang'), 'same-chapter divergence regressed')
  ok(context.canonSameChapterTruth?.sourceExcerpts.length === 0, 'same-chapter raw source leaked')
  ok(serialized <= baseConfig.authorContextMaxJsonChars, `author context exceeded hard budget: ${serialized}`)
  ok(context.telemetry.serializedChars === serialized, `telemetry serializedChars mismatch: ${context.telemetry.serializedChars} != ${serialized}`)
  ok(context.telemetry.budgetChars === baseConfig.authorContextMaxJsonChars, 'telemetry budget does not report configured hard ceiling')

  // Independent audit precision retained.
  const risky = await provider.audit({ draft: '顾小桑抬手催动白雾封住井口。', asOfChapter: 41, povCharacter: '孟奇', participants: ['顾小桑'], claims: [] })
  const ordinary = await provider.audit({ draft: '齐正言用剑尖轻触地面，又看了看顾小桑手里的身份牌。', asOfChapter: 41, povCharacter: '孟奇', participants: ['齐正言', '顾小桑'], claims: [] })
  ok(risky.coverage.uncoveredRiskyClaims.some(item => item.kind === 'power'), 'explicit power claim was not extracted')
  ok(!ordinary.coverage.extractedClaims.some(item => item.kind === 'power' || item.kind === 'identity'), 'ordinary action/token mention was misclassified')

  console.log(JSON.stringify({
    ok: true,
    version: '0.7',
    writingContract: { shortDraftRejected: true, enforcedMinHanChars: shortStyle.lengthContract?.minHanChars },
    draftStore: { staleReceiptBlocked, acceptedDraftId: stagedB.id },
    proseQuality: { rejected: !qualityAudit.ok, findings: qualityAudit.quality.findings.map(item => item.code) },
    rewrite: { inherit: true, replaceDropBlocked: replaceBlocked, backfillBlocked },
    mysteryReveal: { undeclaredBlocked: true, unmetConditionBlocked: true, fakeEvidenceBlocked: true, authorizedPayoff: true },
    authorContext: { version: context.version, chars: serialized, telemetry: context.telemetry },
    auditPrecision: { riskyCount: risky.coverage.uncoveredRiskyClaims.length, ordinaryCount: ordinary.coverage.extractedClaims.length },
  }, null, 2))
} finally {
  await rm(state, { recursive: true, force: true })
}
