/** Package-owned invariant companion for the fanfic provider registry. @module @deepseek-ai/dsh-fanfic/invariant */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-fanfic'
export const name = 'fanfic-invariant'
export const inject = ['invariants']
// No runtime invariant: this Service Definition owns only provider
// registration/selection; concrete providers own persisted data validation.
const install: InvariantInstaller = () => {}
export const apply = (ctx: Context): Promise<() => void> => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
