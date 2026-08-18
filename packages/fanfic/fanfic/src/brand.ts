/** Fanfic-owned opaque identifiers. @module @deepseek-ai/dsh-fanfic/brand */
import type { Branded } from '@deepseek-ai/dsh-brand'

/** Opaque id of one mutable fanfic branch. */
export type FanficBranchId = Branded<'FanficBranchId'>

/**
 * Construct a branch id after the owning boundary validates its syntax.
 * @param value - syntactically validated branch id.
 * @returns opaque fanfic branch id.
 */
export const FanficBranchId = (value: string): FanficBranchId => value as FanficBranchId
