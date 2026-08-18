#!/usr/bin/env node
/** v0.6 transactional author-workflow regression smoke. */
import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LocalFanficProvider } from '../../packages/fanfic/fanfic-local/lib/types/provider.js'

const root=resolve(fileURLToPath(new URL('../..', import.meta.url)))
const state=resolve(root,'.dsh-fanfic-state-v06-regression')
const strictState=resolve(root,'.dsh-fanfic-state-v06-style-regression')
await rm(state,{recursive:true,force:true}); await rm(strictState,{recursive:true,force:true})
const baseConfig={
 providerId:'v06-regression', canonPackDir:resolve(root,'canon-packs/yishizhizun'), stateDir:state,
 maxSearchResults:12,maxExcerptChars:1000,maxStructuredRecords:64,
 authorContextMaxEntities:12,authorContextSearchLimit:8,authorContextCharacterLimit:8,authorContextEvidenceLimit:3,
 storyRecentSummaryLimit:5,voiceDialogueFragmentLimit:6,styleReferenceChapterLimit:32,styleSampleExcerptChars:700,
 antiCopyMaxDraftChars:24000,antiCopyMaxFindings:8,styleDeviationRatio:0.7,styleRevisionRequiredRatio:10,
 authorContextBranchRecordLimit:12,authorContextSourceExcerptLimit:1,authorContextMaxJsonChars:20000,
}
const provider=new LocalFanficProvider(baseConfig)
const ok=(v,m)=>{if(!v) throw new Error(m)}
async function receipts(p, branch, chapter, draft, asOf=41) {
  const canon=await p.audit({draft,asOfChapter:asOf,povCharacter:'孟奇',branchId:branch.id,fanficChapter:chapter,participants:[],claims:[]})
  const style=await p.auditNarrativeStyle({draft,asOfChapter:asOf,mode:'auto',query:'',participants:[],branchId:branch.id,fanficChapter:chapter,sampleLimit:1,antiCopyMinPhraseChars:24,antiCopyMaxFindings:3})
  const copy=await p.antiCopyGuard({draft,asOfChapter:asOf,branchId:branch.id,fanficChapter:chapter,minPhraseChars:24,maxFindings:3})
  ok(canon.ok&&canon.auditReceipt,`missing canon receipt ${JSON.stringify(canon.issues)}`)
  ok(style.ok&&style.auditReceipt,`missing style receipt ${JSON.stringify(style.deviations)}`)
  ok(copy.ok&&copy.auditReceipt,`missing anti-copy receipt ${JSON.stringify(copy.findings)}`)
  return [canon.auditReceipt.id,style.auditReceipt.id,copy.auditReceipt.id]
}
async function commit(p, branch, delta, draft, extra={}) {
  return p.applyDelta({branchId:branch.id,expectedRevision:branch.revision,delta,draft,auditReceiptIds:await receipts(p,branch,delta.fanficChapter,draft),...extra})
}
try {
  // Receipt gate: unaudited state cannot commit; valid receipts are bound to the exact draft/revision and consumed once.
  let gate=await provider.createBranch({name:'receipt-gate',baseChapter:41,notes:''})
  let blocked=false
  try { await provider.applyDelta({branchId:gate.id,expectedRevision:gate.revision,delta:{fanficChapter:1},draft:'未审计文本',auditReceiptIds:[]}) } catch { blocked=true }
  ok(blocked,'unaudited chapter commit was accepted')
  const gateDraft='孟奇在路边停了一瞬，随后继续前行。'
  const gateReceipts=await receipts(provider,gate,1,gateDraft)
  let wrongDraft=false
  try { await provider.applyDelta({branchId:gate.id,expectedRevision:gate.revision,delta:{fanficChapter:1},draft:'另一份文本',auditReceiptIds:gateReceipts}) } catch { wrongDraft=true }
  ok(wrongDraft,'audit receipts authorized a different draft')
  gate=await provider.applyDelta({branchId:gate.id,expectedRevision:gate.revision,delta:{fanficChapter:1,chapterSummary:'receipt gate'},draft:gateDraft,auditReceiptIds:gateReceipts})
  let reused=false
  try { await provider.applyDelta({branchId:gate.id,expectedRevision:gate.revision,delta:{fanficChapter:2},draft:gateDraft,auditReceiptIds:gateReceipts}) } catch { reused=true }
  ok(reused,'consumed audit receipts were reusable')

  // Rewrite inherit keeps old structured state unless explicitly dropped; rewrite author_context still hides same-chapter old state.
  let b=await provider.createBranch({name:'rewrite-inherit',baseChapter:41,notes:''})
  const d1='孟奇收起测试物，记住它仍是旧状态。'
  b=await commit(provider,b,{fanficChapter:1,chapterSummary:'OLD SUMMARY',facts:[{subject:'测试物',predicate:'state',object:'old',validFromFanficChapter:1}],characterStates:[{character:'孟奇',summary:'保持警惕',fromFanficChapter:1}]},d1)
  const oldVersion=b.chapterVersions.find(v=>v.status==='active'&&v.fanficChapter===1); ok(oldVersion,'missing v1')
  const oldFact=b.facts.find(f=>f.originChapterVersionId===oldVersion.id); ok(oldFact,'missing old fact')
  const rewriteCtx=await provider.authorContext({asOfChapter:41,povCharacter:'孟奇',participants:['测试物'],sceneGoal:'rewrite',query:'测试物',branchId:b.id,fanficChapter:1,storyHorizonSize:3,styleMode:'auto',styleSampleLimit:1})
  ok(rewriteCtx.branch?.facts.length===0&&rewriteCtx.branch?.characterStates.length===0,'same-chapter old state leaked into rewrite context')
  const d2='孟奇重新检查测试物，确认它现在表现为新状态。'
  b=await commit(provider,b,{fanficChapter:1,chapterSummary:'NEW SUMMARY',facts:[{subject:'测试物',predicate:'state',object:'new',validFromFanficChapter:1}]},d2,{rewriteMode:'inherit',dropInheritedRecordIds:[oldFact.id]})
  const active=b.chapterVersions.find(v=>v.status==='active'&&v.fanficChapter===1); ok(active?.rewriteMode==='inherit','rewrite mode not persisted')
  const activeFacts=b.facts.filter(f=>f.originChapterVersionId===active.id); const activeChars=b.characterStates.filter(c=>c.originChapterVersionId===active.id)
  ok(activeFacts.length===1&&activeFacts[0].object==='new','inherit rewrite did not replace explicitly dropped fact')
  ok(activeChars.some(c=>c.summary==='保持警惕'),'inherit rewrite lost unchanged structured state')
  ok(b.storyDirector.reconciliation.some(r=>r.status==='open'&&r.fanficChapter===1),'rewrite did not create Director reconciliation issue')

  // Replace rewrite refuses silent state loss, then allows explicit confirmed replacement.
  const replaceDraft='孟奇放弃此前记录，只保留新的章节摘要。'
  const replaceReceipts=await receipts(provider,b,1,replaceDraft)
  let replaceBlocked=false
  try { await provider.applyDelta({branchId:b.id,expectedRevision:b.revision,delta:{fanficChapter:1,chapterSummary:'REPLACED'},draft:replaceDraft,auditReceiptIds:replaceReceipts,rewriteMode:'replace'}) } catch (e) { replaceBlocked=String(e).includes('discard active structured state') }
  ok(replaceBlocked,'replace rewrite silently discarded active structured state')
  b=await provider.applyDelta({branchId:b.id,expectedRevision:b.revision,delta:{fanficChapter:1,chapterSummary:'REPLACED'},draft:replaceDraft,auditReceiptIds:replaceReceipts,rewriteMode:'replace',confirmDroppedState:true})
  const replaced=b.chapterVersions.find(v=>v.status==='active'&&v.fanficChapter===1); ok(replaced?.rewriteMode==='replace','replace rewrite mode missing')
  ok(b.facts.filter(f=>f.originChapterVersionId===replaced.id).length===0&&b.characterStates.filter(c=>c.originChapterVersionId===replaced.id).length===0,'replace rewrite retained discarded state')

  // Backfill protection: chapter 2 cannot silently recreate chapter 1 state.
  const backfillDraft='第二章只应记录第二章产生的新状态。'
  const backfillReceipts=await receipts(provider,b,2,backfillDraft)
  let backfillBlocked=false
  try { await provider.applyDelta({branchId:b.id,expectedRevision:b.revision,delta:{fanficChapter:2,facts:[{subject:'测试物',predicate:'backfill',object:'bad',validFromFanficChapter:1}]},draft:backfillDraft,auditReceiptIds:backfillReceipts}) } catch (e) { backfillBlocked=String(e).includes('cannot backfill') }
  ok(backfillBlocked,'later chapter silently backfilled earlier state')

  // Director reconciliation can be explicitly cleared after granular metadata updates.
  const openRec=b.storyDirector.reconciliation.find(r=>r.status==='open'); ok(openRec,'missing open reconciliation')
  b=await provider.resolveDirectorReconciliation({branchId:b.id,expectedRevision:b.revision,reconciliationId:openRec.id})
  ok(b.storyDirector.reconciliation.find(r=>r.id===openRec.id)?.status==='resolved','Director reconciliation did not resolve')

  // Same-chapter divergence remains spoiler-safe.
  let d=await provider.createBranch({name:'event-divergence-v06',baseChapter:41,notes:''})
  d=await provider.recordDivergence({branchId:d.id,expectedRevision:d.revision,atChapter:41,afterEventId:'event-xiaozi-reveals-guxiaosang',summary:'diverge after reveal',immediateConsequences:['new event follows'],openQuestions:[]})
  const dc=await provider.authorContext({asOfChapter:41,povCharacter:'孟奇',participants:['顾小桑'],sceneGoal:'after reveal',query:'顾小桑',branchId:d.id,fanficChapter:1,storyHorizonSize:3,styleMode:'mystery',styleSampleLimit:2})
  ok(dc.version===3,'author context version is not v3')
  ok(dc.canonTruth.asOfChapter===40&&dc.canonSameChapterTruth?.events.some(e=>e.id==='event-xiaozi-reveals-guxiaosang'),'same-chapter divergence regressed')
  ok(dc.canonSameChapterTruth?.sourceExcerpts.length===0,'same-chapter raw source leaked')
  ok(JSON.stringify(dc).length<=21000,`author context budget not compacted: ${JSON.stringify(dc).length}`)

  // Independent audit precision: explicit supernatural capability is risky; ordinary sword probing and a mention of an identity token are not.
  const risky=await provider.audit({draft:'顾小桑抬手催动白雾封住井口。',asOfChapter:41,povCharacter:'孟奇',participants:['顾小桑'],claims:[]})
  ok(risky.coverage.uncoveredRiskyClaims.some(c=>c.kind==='power'),'explicit power claim was not extracted')
  const ordinary=await provider.audit({draft:'齐正言用剑尖轻触地面，又看了看顾小桑手里的身份牌。',asOfChapter:41,povCharacter:'孟奇',participants:['齐正言','顾小桑'],claims:[]})
  ok(!ordinary.coverage.extractedClaims.some(c=>c.kind==='power'),'ordinary sword probing was misclassified as a power claim')
  ok(!ordinary.coverage.extractedClaims.some(c=>c.kind==='identity'),'mere mention of 身份牌 was misclassified as identity assertion')

  // Strict style policy: very large core rhythm drift becomes revision-required and cannot issue a style receipt.
  const strictProvider=new LocalFanficProvider({...baseConfig,providerId:'v06-strict-style',stateDir:strictState,styleRevisionRequiredRatio:1.0})
  let sb=await strictProvider.createBranch({name:'strict-style',baseChapter:41,notes:''})
  const shortDraft='孟奇停步。\n\n没有声音。\n\n太安静了。\n\n他又停步。\n\n还是没有声音。'
  const sa=await strictProvider.auditNarrativeStyle({draft:shortDraft,asOfChapter:41,mode:'mystery',query:'顾小桑',participants:['顾小桑'],branchId:sb.id,fanficChapter:1,sampleLimit:3,antiCopyMinPhraseChars:24,antiCopyMaxFindings:4})
  ok(sa.deviations.some(x=>x.severity==='revision-required'),'large core style drift remained advisory')
  ok(!sa.ok&&!sa.auditReceipt,'revision-required style drift still produced a passing commit receipt')

  console.log(JSON.stringify({ok:true,receipts:'transactional',rewrite:{mode:active.rewriteMode,inheritedCharacterState:activeChars.length,replaceDropped:true},backfillBlocked,reconciliationResolved:true,contextChars:JSON.stringify(dc).length,auditPrecision:{risky:risky.coverage.extractedClaims,ordinary:ordinary.coverage.extractedClaims},style:{ok:sa.ok,required:sa.deviations.filter(x=>x.severity==='revision-required').map(x=>x.metric)}},null,2))
} finally { await rm(state,{recursive:true,force:true}); await rm(strictState,{recursive:true,force:true}) }
