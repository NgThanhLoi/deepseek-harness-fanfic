#!/usr/bin/env node
/** Fail-fast preflight that detects stale/missing built fanfic tool artifacts before a live LLM run. */
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const EXPECTED_API_VERSION = '0.6.0'
const repo = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const sourcePath = resolve(repo, 'packages/fanfic/tool-fanfic/src/index.ts')
const builtPath = resolve(repo, 'packages/fanfic/tool-fanfic/lib/index.js')
const providerBuiltPath = resolve(repo, 'packages/fanfic/fanfic-local/lib/index.js')

const source = await readFile(sourcePath, 'utf8')
const toolNames = [...source.matchAll(/name:\s*'([^']+)'/gu)].map(match => match[1]).filter(name => name !== 'tool:fanfic')
if (toolNames.length === 0) throw new Error('fanfic source exposes no model-facing tools')
if (!source.includes(`FANFIC_TOOL_API_VERSION = '${EXPECTED_API_VERSION}'`)) {
  throw new Error(`fanfic source API version does not match expected ${EXPECTED_API_VERSION}`)
}

let built
try { built = await readFile(builtPath, 'utf8') } catch {
  throw new Error(`built fanfic tool artifact is missing: ${builtPath}; run pnpm run build before a live model test`)
}
try { await readFile(providerBuiltPath, 'utf8') } catch {
  throw new Error(`built fanfic provider artifact is missing: ${providerBuiltPath}; run pnpm run build before a live model test`)
}
if (!built.includes(EXPECTED_API_VERSION)) {
  throw new Error(`stale fanfic runtime: built tool artifact does not contain API ${EXPECTED_API_VERSION}; rebuild before launch`)
}
const missing = toolNames.filter(name => !built.includes(name))
if (missing.length > 0) throw new Error(`stale fanfic runtime: built artifact is missing tools: ${missing.join(', ')}`)

console.log(JSON.stringify({ ok: true, toolApiVersion: EXPECTED_API_VERSION, toolCount: toolNames.length, tools: toolNames }, null, 2))
