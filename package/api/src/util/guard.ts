import type { Operation, Namespace } from '../types.ts'

export const operation = (n: Namespace | Operation.Any): n is Operation.Any => 'handle' in n

export const namespace = (n: Namespace | Operation.Any): n is Namespace => !operation(n)

/**
 * Observed rather than declared: a handler may hand back an iterable whatever
 * its `out` says, and once a value exists the value is the better authority.
 */
export const stream = (v: unknown): v is AsyncIterable<unknown> =>
  typeof v === 'object' && v !== null && Symbol.asyncIterator in v
