#!/usr/bin/env node
/** Export active-state-aware fanfic review artifacts from a v0.7 state directory. */
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'

function usage() {
  console.error('Usage: node scripts/fanfic/export_live_review.mjs --state-dir <dir> --branch <uuid-or-unique-name> --out <dir> [--sessions-dir <dir>] [--contexts-dir <dir>]')
  process.exit(2)
}
function argsOf(argv) {
  const args = {}
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]
    const value = argv[index + 1]
    if (!key?.startsWith('--') || value === undefined) usage()
    args[key.slice(2)] = value
  }
  return args
}
function hanCount(text) { return [...text.matchAll(/\p{Script=Han}/gu)].length }
function activeVersionIds(branch) { return new Set(branch.chapterVersions.filter(item => item.status === 'active').map(item => item.id)) }
function activeRecords(records, ids) { return records.filter(item => ids.has(item.originChapterVersionId)) }
async function readJson(path) { return JSON.parse(await readFile(path, 'utf8')) }
async function copyOptionalDir(source, destination) {
  if (!source) return false
  await cp(resolve(source), destination, { recursive: true })
  return true
}

const args = argsOf(process.argv.slice(2))
if (!args['state-dir'] || !args.branch || !args.out) usage()
const stateDir = resolve(args['state-dir'])
const outDir = resolve(args.out)
const branchesDir = join(stateDir, 'branches')
const branchFiles = (await readdir(branchesDir)).filter(name => name.endsWith('.json'))
const branches = await Promise.all(branchFiles.map(async name => ({ name, branch: await readJson(join(branchesDir, name)) })))
const matches = branches.filter(({ branch }) => branch.id === args.branch || branch.name === args.branch)
if (matches.length !== 1) throw new Error(matches.length === 0 ? `branch not found: ${JSON.stringify(args.branch)}` : `branch name is ambiguous: ${JSON.stringify(args.branch)}`)
const branch = matches[0].branch
if (branch.version !== 3) throw new Error(`v0.7 review export requires branch format v3; got ${JSON.stringify(branch.version)}`)

await rm(outDir, { recursive: true, force: true })
for (const name of ['state', 'drafts', 'audits', 'sessions', 'contexts']) await mkdir(join(outDir, name), { recursive: true })
await writeFile(join(outDir, 'state', 'final-branch.json'), `${JSON.stringify(branch, null, 2)}\n`)
await writeFile(join(outDir, 'state', 'chapter-versions.json'), `${JSON.stringify(branch.chapterVersions, null, 2)}\n`)
await writeFile(join(outDir, 'state', 'story-director.json'), `${JSON.stringify(branch.storyDirector, null, 2)}\n`)
await writeFile(join(outDir, 'state', 'mystery-truth-ledger.json'), `${JSON.stringify(branch.storyDirector.mysteryTruths, null, 2)}\n`)
await writeFile(join(outDir, 'state', 'invention-registry.json'), `${JSON.stringify(branch.storyDirector.inventions, null, 2)}\n`)

const ids = activeVersionIds(branch)
const activeProjection = {
  branchId: branch.id,
  branchName: branch.name,
  revision: branch.revision,
  authorIntent: branch.authorIntent,
  divergences: branch.divergences,
  chapterVersions: branch.chapterVersions.filter(item => item.status === 'active'),
  facts: activeRecords(branch.facts, ids),
  knowledge: activeRecords(branch.knowledge, ids),
  characterStates: activeRecords(branch.characterStates, ids),
  relationships: activeRecords(branch.relationships, ids),
  causalThreads: activeRecords(branch.causalThreads, ids),
  chapterSummaries: branch.chapterSummaries.filter(item => ids.has(item.chapterVersionId)),
  storyDirector: branch.storyDirector,
}
await writeFile(join(outDir, 'state', 'active-projection.json'), `${JSON.stringify(activeProjection, null, 2)}\n`)

const draftRows = []
const uniqueDraftIds = [...new Set(branch.chapterVersions.map(item => item.draftId))]
for (const draftId of uniqueDraftIds) {
  const source = join(stateDir, 'drafts', `${draftId}.json`)
  const draft = await readJson(source)
  await writeFile(join(outDir, 'drafts', `${draftId}.json`), `${JSON.stringify(draft, null, 2)}\n`)
  const versions = branch.chapterVersions.filter(item => item.draftId === draftId)
  for (const version of versions) draftRows.push({
    draftId,
    chapterVersionId: version.id,
    fanficChapter: version.fanficChapter,
    status: version.status,
    rewriteMode: version.rewriteMode,
    draftHash: draft.draftHash,
    hanChars: hanCount(draft.text),
    textChars: draft.text.length,
  })
}

const receiptDir = join(stateDir, 'audit-receipts')
let remainingReceipts = 0
try {
  for (const name of (await readdir(receiptDir)).filter(item => item.endsWith('.json'))) {
    await cp(join(receiptDir, name), join(outDir, 'audits', name))
    remainingReceipts += 1
  }
} catch (error) {
  if (error?.code !== 'ENOENT') throw error
}

const copiedSessions = await copyOptionalDir(args['sessions-dir'], join(outDir, 'sessions', basename(resolve(args['sessions-dir'] ?? 'sessions'))))
const copiedContexts = await copyOptionalDir(args['contexts-dir'], join(outDir, 'contexts', basename(resolve(args['contexts-dir'] ?? 'contexts'))))
const manifest = {
  schemaVersion: 1,
  exportedAt: new Date().toISOString(),
  sourceStateDir: stateDir,
  branch: { id: branch.id, name: branch.name, revision: branch.revision, version: branch.version },
  activeChapters: branch.chapterVersions.filter(item => item.status === 'active').map(item => item.fanficChapter).sort((a, b) => a - b),
  counts: {
    chapterVersions: branch.chapterVersions.length,
    activeChapterVersions: ids.size,
    activeFacts: activeProjection.facts.length,
    activeKnowledge: activeProjection.knowledge.length,
    activeCharacterStates: activeProjection.characterStates.length,
    activeRelationships: activeProjection.relationships.length,
    activeCausalThreads: activeProjection.causalThreads.length,
    openDirectorReconciliations: branch.storyDirector.reconciliation.filter(item => item.status === 'open').length,
    remainingUnconsumedAuditReceipts: remainingReceipts,
  },
  drafts: draftRows.sort((a, b) => a.fanficChapter - b.fanficChapter || a.chapterVersionId.localeCompare(b.chapterVersionId)),
  optionalInputs: { copiedSessions, copiedContexts },
  securityNote: 'This exporter never copies environment variables, credentials, cookies, or provider configuration. Session/context inputs are copied verbatim and must be redacted by the caller before sharing.',
}
await writeFile(join(outDir, 'REVIEW_MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(JSON.stringify({ ok: true, outDir, branch: manifest.branch, counts: manifest.counts, drafts: draftRows.length }, null, 2))
