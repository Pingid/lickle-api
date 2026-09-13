import type { StandardSchemaV1 } from '@standard-schema/spec'
import { hasDefault } from './kind.ts'
import { schemaOf, shapeOf } from './standard.ts'
import type { InputField, InputFields } from './types.ts'

export { oneOf, quote } from './standard.ts'

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
 * What a target decides about absent inputs.
 *
 * Validation is no longer here: a field's `type` is a Standard Schema and
 * validates itself, which is what lets a zod schema sit where a core type does.
 * What is left is genuinely per-target — the command line substitutes `false`
 * for an absent bool and `[]` for an absent list, a tool call substitutes
 * nothing — and how each names an input it did not get.
 */
export interface Policy {
  /**
   * A stand-in when nothing was supplied and the field has no default. Return
   * `undefined` to leave the key unset, which makes the input required.
   */
  fallback?: (field: InputField, key: string) => unknown
  /** Message for a required input that was not supplied. */
  missing?: (field: InputField, key: string) => string
  /** Vendor options passed through to every validator. */
  options?: StandardSchemaV1.Options
}

/**
 * Bind raw per-key values onto an operation's inputs: validate what was given,
 * fill in defaults and fallbacks, reject what is missing.
 *
 * Asynchronous because `StandardSchemaV1.validate` may be — an async refinement
 * is a large part of why anyone reaches for an outside schema library.
 */
export const bind = async (
  fields: InputFields,
  given: Record<string, unknown>,
  policy: Policy = {},
): Promise<Record<string, unknown>> => {
  const out: Record<string, unknown> = {}

  for (const [key, field] of Object.entries(fields)) {
    const raw = given[key]
    if (raw !== undefined && raw !== null) {
      out[key] = await validate(key, field, raw, policy)
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
    if (shapeOf(field.type).optional) continue
    throw new InputError(policy.missing?.(field, key) ?? `missing required input '${key}'`)
  }

  return out
}

const validate = async (key: string, field: InputField, raw: unknown, policy: Policy): Promise<unknown> => {
  const result = await schemaOf(field.type)['~standard'].validate(raw, policy.options)
  if (result.issues === undefined) return result.value

  const first = result.issues[0]!
  throw new InputError(`invalid value for '${label(key, first.path)}': ${first.message}`)
}

/** `tag[1]`, `where.since` — the key, then wherever inside it the issue was. */
const label = (key: string, path: StandardSchemaV1.Issue['path']): string =>
  (path ?? []).reduce<string>((acc, segment) => {
    const at = typeof segment === 'object' ? segment.key : segment
    return typeof at === 'number' ? `${acc}[${at}]` : `${acc}.${String(at)}`
  }, key)
