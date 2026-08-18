/** Package-owned invariant companion for fanfic tools. @module @deepseek-ai/dsh-tool-fanfic/invariant */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'
const PACKAGE_NAME = '@deepseek-ai/dsh-tool-fanfic'
export const name = 'tool-fanfic-invariant'
export const inject = ['invariants']
// No runtime invariant: tool calls/results are already owned and validated by
// dsh-tools; this consumer owns no additional durable event relation.
const install: InvariantInstaller = () => {}
export const apply = (ctx: Context): Promise<() => void> => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
