import { KIND, hasDefault, isList, isOptional, itemOf } from '@lickle/cmd-core'
import type { InputField, InputsSpec, Primitive, Spec } from '@lickle/cmd-core'

/**
 * A caller-facing rejection: the arguments did not match the spec.
 *
 * This travels back as a tool result with `isError: true`, not a protocol
 * error, so the model can read what was wrong and correct itself.
 */
export class ArgsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ArgsError'
  }
}

/**
 * Check an incoming `arguments` object against a spec's inputs and fill in
 * defaults. Values arrive already JSON-typed, so nothing is coerced from
 * strings the way the CLI parser must — a wrong type is an error, not a hint.
 */
export const parseArgs = (spec: Spec, args: Record<string, unknown> = {}): Record<string, unknown> => {
  const inputs: InputsSpec = spec.inputs ?? {}

  const unknown = Object.keys(args).filter((key) => !(key in inputs))
  if (unknown.length > 0)
    throw new ArgsError(`unknown ${plural('argument', unknown.length)} ${list(unknown)}; expected ${expected(inputs)}`)

  const result: Record<string, unknown> = {}
  for (const [key, field] of Object.entries(inputs)) {
    const given = args[key]
    if (given === undefined || given === null) {
      if (hasDefault(field)) result[key] = field.default
      else if (!isOptional(field.kind)) throw new ArgsError(`missing required argument '${key}'`)
      continue
    }
    result[key] = check(key, field, given)
  }
  return result
}

const check = (key: string, field: InputField, given: unknown): unknown => {
  const kind = field.kind
  if (isList(kind)) {
    if (!Array.isArray(given)) throw new ArgsError(`'${key}' expects an array, got ${typeName(given)}`)
    return given.map((item, i) => primitive(`${key}[${i}]`, kind.item, field, item))
  }
  return primitive(key, itemOf(kind), field, given)
}

const primitive = (label: string, kind: Primitive, field: InputField, given: unknown): unknown => {
  const want = kind.type === KIND.num ? 'number' : kind.type === KIND.bool ? 'boolean' : 'string'
  if (typeof given !== want) throw new ArgsError(`'${label}' expects a ${want}, got ${typeName(given)}`)
  if (want === 'number' && !Number.isFinite(given)) throw new ArgsError(`'${label}' expects a finite number`)

  const values = field.values
  if (values !== undefined && !values.includes(given as string))
    throw new ArgsError(`'${label}' expects one of ${list(values)}, got ${JSON.stringify(given)}`)

  return given
}

const typeName = (v: unknown): string => (v === null ? 'null' : Array.isArray(v) ? 'an array' : typeof v)

const list = (items: readonly string[]): string => items.map((i) => `'${i}'`).join(', ')

const expected = (inputs: InputsSpec): string => {
  const keys = Object.keys(inputs)
  return keys.length === 0 ? 'no arguments' : list(keys)
}

const plural = (word: string, n: number): string => (n === 1 ? word : `${word}s`)
