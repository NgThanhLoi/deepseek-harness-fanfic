/** Package-owned invariant companion for the fanfic authoring bundle. @module @deepseek-ai/dsh-fanfic-authoring/invariant */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'
const PACKAGE_NAME = '@deepseek-ai/dsh-fanfic-authoring'
export const name = 'fanfic-authoring-bundle-invariant'
export const inject = ['invariants']
// No runtime invariant: this package is a static Cordis patch carrier; inserted packages own their runtime invariants.
const install: InvariantInstaller = () => {}
export const apply = (ctx: Context): Promise<() => void> => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
