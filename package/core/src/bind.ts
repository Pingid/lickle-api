import { hasDefault, isOptional, valuesOf } from './kind.ts'
import type { Choices, InputField, InputFields } from './types.ts'

/**
 * A caller-facing rejection: what was supplied does not match the operation.
 *
 * Targets map it onto their own vocabulary — a CLI exits `2` and points at
 * `--help`, an MCP server answers with `isError: true` so the model can correct
 * itself, an HTTP handler answers `400`. Throwing it from a command's `run` is
 * how that command says "the caller got this wrong" portably.
 */
export class InputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InputError'
  }
}

/**
 * How a target turns what it received into the declared types.
 *
 * Core walks the fields, applies defaults and checks `values`; the target says
 * what a value looks like on its wire and which absences it tolerates. The
 * split is deliberate: the traversal is the same everywhere, the judgement is
 * not.
 */
export interface Policy {
  /**
   * A stand-in when nothing was supplied and the field has no default — the
   * command line's `false` for a bool and `[]` for a list. Return `undefined`
   * to leave the key unset, which makes the input required.
   */
  fallback?: (field: InputField, key: string) => unknown
  /** Adapt and validate one supplied value. Throws `InputError` if it does not fit. */
  coerce: (field: InputField, raw: unknown, key: string) => unknown
  /** Message for a required input that was not supplied. */
  missing?: (field: InputField, key: string) => string
}

/**
 * Bind raw per-key values onto an operation's inputs: coerce what was given,
 * fill in defaults and fallbacks, reject what is missing or out of range.
 */
export const bind = (fields: InputFields, given: Record<string, unknown>, policy: Policy): Record<string, unknown> => {
  const out: Record<string, unknown> = {}

  for (const [key, field] of Object.entries(fields)) {
    const raw = given[key]
    if (raw !== undefined && raw !== null) {
      out[key] = checkChoice(key, field, policy.coerce(field, raw, key))
      continue
    }
    if (hasDefault(field)) {
      out[key] = field.default
      continue
    }
    const fallback = policy.fallback?.(field, key)
    if (fallback !== undefined) {
      out[key] = fallback
      continue
    }
    if (isOptional(field.type)) continue
    throw new InputError(policy.missing?.(field, key) ?? `missing required input '${key}'`)
  }

  return out
}

/**
 * Reject anything outside a `choice`, per element for a list.
 *
 * One implementation and one message for every target: the command line and a
 * tool call word this identically because neither writes it.
 */
const checkChoice = (key: string, field: InputField, value: unknown): unknown => {
  const values: Choices | undefined = valuesOf(field.type)
  if (values === undefined) return value

  const check = (v: unknown, label: string): void => {
    if (!(values as readonly unknown[]).includes(v))
      throw new InputError(`invalid value for '${label}': ${quote(v)} (expected ${oneOf(values)})`)
  }

  if (Array.isArray(value)) value.forEach((v, i) => check(v, `${key}[${i}]`))
  else check(value, key)
  return value
}

export const quote = (v: unknown): string => (typeof v === 'string' ? `'${v}'` : String(v))

/** `'a', 'b' or 'c'` — the tail of an "expected …" message. */
export const oneOf = (values: readonly unknown[]): string => {
  const quoted = values.map(quote)
  const last = quoted.pop()
  return quoted.length === 0 ? (last ?? '') : `${quoted.join(', ')} or ${last}`
}
