const BRAND = Symbol.for('@lickle/api.InputError')

/**
 * A caller-facing refusal: what was supplied does not work.
 *
 * Targets map it onto their own vocabulary — a command line exits `2` and points
 * at `--help`, a tool call answers `isError: true` so the model can correct
 * itself, an HTTP handler answers `400`. Throwing it from a handler is how an
 * operation that belongs to no target in particular says "the caller got this
 * wrong" portably, without reaching for a target's own error class.
 *
 * Binding does not throw it. `bind` reports its problems as data, because two
 * targets word the same problem differently; this is the channel a *handler*
 * has, where there is nothing to word differently.
 */
export class InputError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'InputError'
  }
}

Object.defineProperty(InputError.prototype, BRAND, { value: true })

/**
 * Branded rather than `instanceof`.
 *
 * Two copies of this package in one tree — an ordinary hazard of any workspace —
 * make `instanceof` answer `false` across the seam, and a target would silently
 * downgrade a usage error to a crash. A `name` check would not do either, since
 * a subclass sets its own.
 */
export const isInputError = (e: unknown): e is InputError =>
  typeof e === 'object' && e !== null && (e as Record<symbol, unknown>)[BRAND] === true
