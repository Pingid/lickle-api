import { InputError, bind, foldPrimitive, isList, itemOf } from '@lickle/cmd-core'
import type { InputFields, Operation, Policy, Primitive } from '@lickle/cmd-core'

/**
 * Check an incoming `arguments` object against an operation's inputs and fill in
 * defaults.
 *
 * Values arrive already JSON-typed, so nothing is coerced from strings the way
 * the CLI parser must — a wrong type is an error, not a hint. Everything past
 * that (defaults, `values`, naming a missing input) is core's `bind`, so the two
 * targets cannot drift apart on the parts that are not policy.
 */
export const bindArgs = (op: Operation, args: Record<string, unknown> = {}): Record<string, unknown> => {
  const inputs: InputFields = op.inputs ?? {}

  const unknown = Object.keys(args).filter((key) => !(key in inputs))
  if (unknown.length > 0)
    throw new InputError(`unknown ${plural('argument', unknown.length)} ${list(unknown)}; expected ${expected(inputs)}`)

  return bind(inputs, args, POLICY)
}

/** No fallbacks: an absent bool or list is absent, not `false` or `[]`. */
const POLICY: Policy = {
  coerce: (field, given, key) => {
    const type = field.type
    if (isList(type)) {
      if (!Array.isArray(given)) throw new InputError(`'${key}' expects an array, got ${typeName(given)}`)
      return given.map((item, i) => checkPrimitive(`${key}[${i}]`, type.item, item))
    }
    return checkPrimitive(key, itemOf(type), given)
  },
  missing: (_field, key) => `missing required argument '${key}'`,
}

const checkPrimitive = (label: string, kind: Primitive, given: unknown): unknown => {
  const want = foldPrimitive(kind, { num: () => 'number', bool: () => 'boolean', string: () => 'string' })

  if (typeof given !== want) throw new InputError(`'${label}' expects a ${want}, got ${typeName(given)}`)
  if (want === 'number' && !Number.isFinite(given)) throw new InputError(`'${label}' expects a finite number`)

  return given
}

const typeName = (v: unknown): string => (v === null ? 'null' : Array.isArray(v) ? 'an array' : typeof v)

const list = (items: readonly string[]): string => items.map((i) => `'${i}'`).join(', ')

const expected = (inputs: InputFields): string => {
  const keys = Object.keys(inputs)
  return keys.length === 0 ? 'no arguments' : list(keys)
}

const plural = (word: string, n: number): string => (n === 1 ? word : `${word}s`)
