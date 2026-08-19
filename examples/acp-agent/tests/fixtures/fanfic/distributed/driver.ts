#!/usr/bin/env node
/** Inspect the public distributed-fanfic Loader composition without starting a child. */

import { boot, resolveConfigPath } from '@deepseek-ai/dsh-app-boot'
import type {} from '@deepseek-ai/dsh-fanfic'
import type {} from '@deepseek-ai/dsh-subagent'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-tools'

const configPath = process.argv[2]
if (configPath === undefined) throw new Error('distributed fanfic Loader composition driver requires a config path')

const ctx = await boot('fanfic-distributed-loader-composition', resolveConfigPath(configPath, undefined))
try {
  const wanted = ['fanfic_prepare_chapter', 'fanfic_review_draft', 'fanfic_worker_status']
  const tools = ctx.tools.schemas()
    .filter(tool => wanted.includes(tool.name))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(tool => ({
      name: tool.name,
      parameterNames: Object.keys(tool.parameters.properties ?? {}).sort(),
      required: [...(Array.isArray(tool.parameters.required) ? tool.parameters.required as string[] : [])].sort(),
    }))
  const policy = (await ctx.systemPrompt.assemble()).sections.find(section => section.name === 'tool:fanfic-distributed')
  if (policy === undefined || typeof policy.text !== 'string') throw new Error('distributed fanfic policy was not registered')

  process.stdout.write(`${JSON.stringify({
    tools,
    policy: {
      hasApi: policy.text.includes('API 0.8.0'),
      centralAuthor: policy.text.includes('sole Author/Coordinator'),
      readOnlySpecialists: policy.text.includes('Specialists are read-only'),
      deterministicAuditsRemainMandatory: policy.text.includes('remain mandatory'),
    },
  })}\n`)
} finally {
  await ctx.fiber.dispose()
}
