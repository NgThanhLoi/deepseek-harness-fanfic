/** Package-owned invariant companion for distributed fanfic tools. @module @deepseek-ai/dsh-tool-fanfic-distributed/invariant */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'
const PACKAGE_NAME = '@deepseek-ai/dsh-tool-fanfic-distributed'
export const name = 'tool-fanfic-distributed-invariant'
export const inject = ['invariants']
// No runtime invariant: subagent lifecycle is owned by dsh-subagent and tool
// calls/results by dsh-tools; this Consumer owns no additional durable event pair.
const install: InvariantInstaller = () => {}
/** Register the package invariant companion. @param ctx - plugin context. @returns disposer registration. */
export const apply = (ctx: Context): Promise<() => void> => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
