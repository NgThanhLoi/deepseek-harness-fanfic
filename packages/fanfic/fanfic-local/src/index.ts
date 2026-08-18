/** Local filesystem provider plugin for fanfic authoring. @module @deepseek-ai/dsh-fanfic-local */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { LocalFanficProvider } from './provider.ts'
import type { ProviderConfig } from './provider.ts'

export { LocalFanficProvider } from './provider.ts'
/** Local provider plugin configuration. */
export type Config = ProviderConfig

export const name = 'fanfic-local'
export const inject = ['fanfic']

/** Runtime configuration validated by the Cordis loader. */
export const Config: z<Config> = z.object({
  providerId: z.string().min(1).required(),
  canonPackDir: z.string().min(1).required(),
  stateDir: z.string().min(1).required(),
  maxSearchResults: z.number().min(1).required(),
  maxExcerptChars: z.number().min(200).required(),
  maxStructuredRecords: z.number().min(1).required(),
  authorContextMaxEntities: z.number().min(1).required(),
  authorContextSearchLimit: z.number().min(1).required(),
  authorContextCharacterLimit: z.number().min(1).required(),
  authorContextEvidenceLimit: z.number().min(1).required(),
  storyRecentSummaryLimit: z.number().min(1).required(),
  voiceDialogueFragmentLimit: z.number().min(1).required(),
  styleReferenceChapterLimit: z.number().min(1).required(),
  styleSampleExcerptChars: z.number().min(200).required(),
  antiCopyMaxDraftChars: z.number().min(1000).required(),
  antiCopyMaxFindings: z.number().min(1).required(),
  styleDeviationRatio: z.number().min(0.05).required(),
  styleRevisionRequiredRatio: z.number().min(0.1).required(),
  authorContextBranchRecordLimit: z.number().min(1).required(),
  authorContextSourceExcerptLimit: z.number().min(1).required(),
  authorContextMaxJsonChars: z.number().min(10000).required(),
  proseQualityUltraShortHanChars: z.number().min(1).required(),
  proseQualityMaxUltraShortRun: z.number().min(2).required(),
  proseQualityTailUltraShortRatio: z.number().min(0.05).max(1).required(),
  proseQualityMinBigramDiversity: z.number().min(0.05).max(1).required(),
  proseQualityTailFillerLimit: z.number().min(1).required(),
})

/** Register one filesystem provider. @param ctx - plugin context. @param config - validated provider config. */
export function apply(ctx: Context, config: Config): void {
  ctx.fanfic.registerProvider(new LocalFanficProvider(config))
}
