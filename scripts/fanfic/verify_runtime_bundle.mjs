#!/usr/bin/env node
/** Fail-fast preflight that detects stale/missing built fanfic tool artifacts before a live LLM run. */
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const EXPECTED_API_VERSION = '0.8.0'
const EXPECTED_DISTRIBUTED_API_VERSION = '0.8.0'
const repo = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const directSourcePath = resolve(repo, 'packages/fanfic/tool-fanfic/src/index.ts')
const directBuiltPath = resolve(repo, 'packages/fanfic/tool-fanfic/lib/index.js')
const distributedSourcePath = resolve(repo, 'packages/fanfic/tool-fanfic-distributed/src/index.ts')
const distributedBuiltPath = resolve(repo, 'packages/fanfic/tool-fanfic-distributed/lib/index.js')
const providerBuiltPath = resolve(repo, 'packages/fanfic/fanfic-local/lib/index.js')

const directSource = await readFile(directSourcePath, 'utf8')
const directToolNames = extractTools(directSource, 'tool:fanfic')
if (directToolNames.length === 0) throw new Error('fanfic source exposes no direct model-facing tools')
if (!directSource.includes(`FANFIC_TOOL_API_VERSION = '${EXPECTED_API_VERSION}'`)) {
  throw new Error(`fanfic source API version does not match expected ${EXPECTED_API_VERSION}`)
}

const distributedSource = await readFile(distributedSourcePath, 'utf8')
const distributedToolNames = extractTools(distributedSource, 'tool:fanfic-distributed')
if (distributedToolNames.length === 0) throw new Error('distributed fanfic source exposes no model-facing tools')
if (!distributedSource.includes(`FANFIC_DISTRIBUTED_API_VERSION = '${EXPECTED_DISTRIBUTED_API_VERSION}'`)) {
  throw new Error(`distributed fanfic source API version does not match expected ${EXPECTED_DISTRIBUTED_API_VERSION}`)
}

const directBuilt = await readBuilt(directBuiltPath, 'fanfic tool')
const distributedBuilt = await readBuilt(distributedBuiltPath, 'distributed fanfic tool')
await readBuilt(providerBuiltPath, 'fanfic provider')

assertBuiltFace('fanfic', directBuilt, EXPECTED_API_VERSION, directToolNames)
assertBuiltFace('distributed fanfic', distributedBuilt, EXPECTED_DISTRIBUTED_API_VERSION, distributedToolNames)

const tools = [...directToolNames, ...distributedToolNames]
if (new Set(tools).size !== tools.length) throw new Error('fanfic runtime declares duplicate direct/distributed tool names')
console.log(JSON.stringify({
  ok: true,
  toolApiVersion: EXPECTED_API_VERSION,
  distributedApiVersion: EXPECTED_DISTRIBUTED_API_VERSION,
  directToolCount: directToolNames.length,
  distributedToolCount: distributedToolNames.length,
  toolCount: tools.length,
  tools,
}, null, 2))

function extractTools(source, promptSectionName) {
  return [...source.matchAll(/name:\s*'([^']+)'/gu)]
    .map(match => match[1])
    .filter(name => name !== promptSectionName)
}

async function readBuilt(path, label) {
  try { return await readFile(path, 'utf8') } catch {
    throw new Error(`built ${label} artifact is missing: ${path}; run pnpm run build before a live model test`)
  }
}

function assertBuiltFace(label, built, version, toolNames) {
  if (!built.includes(version)) {
    throw new Error(`stale ${label} runtime: built artifact does not contain API ${version}; rebuild before launch`)
  }
  const missing = toolNames.filter(name => !built.includes(name))
  if (missing.length > 0) throw new Error(`stale ${label} runtime: built artifact is missing tools: ${missing.join(', ')}`)
}
