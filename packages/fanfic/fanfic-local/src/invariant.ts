/** Package-owned invariant companion for local fanfic storage. @module @deepseek-ai/dsh-fanfic-local/invariant */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'
const PACKAGE_NAME = '@deepseek-ai/dsh-fanfic-local'
export const name = 'fanfic-local-invariant'
export const inject = ['invariants']
// No runtime invariant: canon/branch files are validated at their file parser
// boundary and branch writes publish complete CAS snapshots atomically.
const install: InvariantInstaller = () => {}
export const apply = (ctx: Context): Promise<() => void> => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
