#!/usr/bin/env node
/** Smoke the active-state-aware v0.7 review exporter. */
import { access, readFile, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { LocalFanficProvider } from '../../packages/fanfic/fanfic-local/lib/types/provider.js'

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const stateDir = resolve(root, '.dsh-fanfic-state-v07-export-smoke')
const outDir = resolve(root, '.dsh-fanfic-review-v07-export-smoke')
await rm(stateDir, { recursive: true, force: true }); await rm(outDir, { recursive: true, force: true })
const provider = new LocalFanficProvider({
  providerId: 'export-smoke', canonPackDir: resolve(root, 'canon-packs/yishizhizun'), stateDir,
  maxSearchResults: 12, maxExcerptChars: 1000, maxStructuredRecords: 64,
  authorContextMaxEntities: 12, authorContextSearchLimit: 8, authorContextCharacterLimit: 8, authorContextEvidenceLimit: 3,
  storyRecentSummaryLimit: 5, voiceDialogueFragmentLimit: 6, styleReferenceChapterLimit: 32, styleSampleExcerptChars: 700,
  antiCopyMaxDraftChars: 24000, antiCopyMaxFindings: 8, styleDeviationRatio: 0.7, styleRevisionRequiredRatio: 10,
  authorContextBranchRecordLimit: 12, authorContextSourceExcerptLimit: 1, authorContextMaxJsonChars: 20000,
  proseQualityUltraShortHanChars: 8, proseQualityMaxUltraShortRun: 8, proseQualityTailUltraShortRatio: 0.6,
  proseQualityMinBigramDiversity: 0.58, proseQualityTailFillerLimit: 6,
})
const assert = (v, m) => { if (!v) throw new Error(m) }
try {
  let branch = await provider.createBranch({ name: 'review-export-smoke', baseChapter: 41, notes: '', authorIntent: { writingContract: { language: 'zh-CN', minHanChars: 10, maxHanChars: 5000, defaultStyleMode: 'auto' } } })
  const draft = await provider.stageDraft({ branchId: branch.id, fanficChapter: 1, text: '孟奇记下异常，却没有急着对它作出结论。' })
  const canon = await provider.audit({ draftId: draft.id, asOfChapter: 41, povCharacter: '孟奇', participants: [], claims: [] })
  const style = await provider.auditNarrativeStyle({ draftId: draft.id, asOfChapter: 41, mode: 'auto', query: '', participants: [], sampleLimit: 1, antiCopyMinPhraseChars: 24, antiCopyMaxFindings: 3 })
  const copy = await provider.antiCopyGuard({ draftId: draft.id, asOfChapter: 41, minPhraseChars: 24, maxFindings: 3 })
  assert(canon.auditReceipt && style.auditReceipt && copy.auditReceipt, 'review export setup audits did not pass')
  branch = await provider.applyDelta({ branchId: branch.id, expectedRevision: branch.revision, delta: { fanficChapter: 1, chapterSummary: '记录异常', facts: [{ subject: '异常', predicate: 'noticed_by', object: '孟奇', validFromFanficChapter: 1 }] }, draftId: draft.id, auditReceiptIds: [canon.auditReceipt.id, style.auditReceipt.id, copy.auditReceipt.id] })
  const result = spawnSync(process.execPath, [resolve(root, 'scripts/fanfic/export_live_review.mjs'), '--state-dir', stateDir, '--branch', branch.name, '--out', outDir], { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`review exporter failed: ${result.stderr || result.stdout}`)
  await access(resolve(outDir, 'state/final-branch.json'))
  await access(resolve(outDir, 'state/active-projection.json'))
  await access(resolve(outDir, 'REVIEW_MANIFEST.json'))
  const manifest = JSON.parse(await readFile(resolve(outDir, 'REVIEW_MANIFEST.json'), 'utf8'))
  assert(manifest.counts.activeChapterVersions === 1 && manifest.counts.activeFacts === 1, 'review manifest active projection counts are wrong')
  assert(manifest.drafts.length === 1 && manifest.drafts[0].status === 'active', 'review manifest did not bind active draft')
  console.log(JSON.stringify({ ok: true, activeChapterVersions: manifest.counts.activeChapterVersions, activeFacts: manifest.counts.activeFacts, draftHanChars: manifest.drafts[0].hanChars }, null, 2))
} finally {
  await rm(stateDir, { recursive: true, force: true }); await rm(outDir, { recursive: true, force: true })
}
