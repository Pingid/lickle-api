import type { StandardJSONSchemaV1, StandardSchemaV1 } from '@standard-schema/spec'
import { KIND } from './types.ts'
import type { Choices, Primitive, Type, TypeOf } from './types.ts'
import { fold, isType } from './kind.ts'

export type { StandardJSONSchemaV1, StandardSchemaV1 }

export const VENDOR = 'lickle-cmd'

/** The JSON Schema dialect core emits. */
export const TARGET = 'draft-2020-12'

/**
 * A core type, which is also a Standard Schema.
 *
 * All three spec interfaces share one `~standard` property, so a single object
 * implements `StandardSchemaV1` and `StandardJSONSchemaV1` by carrying both
 * `validate` and `jsonSchema` in the same props.
 */
export type Schema<T extends Type = Type> = T &
  StandardSchemaV1<unknown, TypeOf<T>> &
  StandardJSONSchemaV1<unknown, TypeOf<T>>

/** What a field's `type` may be: one of core's, or anything that validates. */
export type FieldType = Type | StandardSchemaV1

/** The value a field type describes — core's own inference, or the schema's. */
export type ValueOf<T extends FieldType> = T extends Type
  ? TypeOf<T>
  : T extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<T>
    : never

// ---------------- Recognising schemas --------------------------
export const isStandardSchema = (v: unknown): v is StandardSchemaV1 =>
  typeof (v as StandardSchemaV1 | undefined)?.['~standard']?.validate === 'function'

export const isStandardJsonSchema = (v: unknown): v is StandardJSONSchemaV1 =>
  typeof (v as StandardJSONSchemaV1 | undefined)?.['~standard']?.jsonSchema?.input === 'function'

/**
 * The Standard Schema for a field type.
 *
 * Core's constructors attach one, so this is normally the value itself; a type
 * written as a bare literal rather than through a constructor gets one built on
 * the spot.
 */
export const schemaOf = (t: FieldType): StandardSchemaV1 =>
  isStandardSchema(t) ? t : attach({ ...(t as Type) } as Type)

/** The JSON Schema for a field type, or `undefined` when it cannot say. */
export const jsonSchemaOf = (t: FieldType, target: string = TARGET): Record<string, unknown> | undefined => {
  if (isType(t)) return typeSchema(t)
  if (isStandardJsonSchema(t)) return bare(t['~standard'].jsonSchema.input({ target }))
  return undefined
}

/** `$schema` belongs on a document root, not on a property inside one. */
const bare = (schema: Record<string, unknown>): Record<string, unknown> => {
  const { $schema: _drop, ...rest } = schema
  return rest
}

// ---------------- Shape --------------------------
/**
 * The only questions a target actually asks about a field: is it a list, is it
 * optional, what JSON type does it carry, and is it drawn from a closed set.
 *
 * Core types answer structurally. A foreign schema answers through the JSON
 * Schema it already knows how to emit — which is how `z.enum([…])` still gets
 * completions and `z.boolean()` still becomes a flag that takes no value.
 * A schema that implements neither degrades to a required, value-taking,
 * non-repeatable flag.
 */
export interface Shape {
  /** The JSON type of the value, or of a list's items. */
  type?: 'string' | 'number' | 'boolean'
  list: boolean
  optional: boolean
  values?: Choices
}

export const shapeOf = (t: FieldType): Shape => {
  if (isType(t)) return coreShape(t)
  const optional = admitsUndefined(t)
  const json = jsonSchemaOf(t)
  return json === undefined ? { list: false, optional } : { ...jsonShape(json), optional }
}

/**
 * Whether a foreign schema treats "not supplied" as acceptable.
 *
 * JSON Schema cannot say: a library spells optionality in the *parent object's*
 * `required` array, so `z.string()` and `z.string().optional()` emit the very
 * same value schema. The validator can, though — so ask it. A schema that
 * answers asynchronously is taken as required, since nothing here can wait.
 */
const admitsUndefined = (s: StandardSchemaV1): boolean => {
  try {
    const result = s['~standard'].validate(undefined)
    return result instanceof Promise ? false : result.issues === undefined
  } catch {
    return false
  }
}

const coreShape = (t: Type): Shape =>
  fold<Shape>(t, {
    bool: () => ({ type: 'boolean', list: false, optional: false }),
    string: () => ({ type: 'string', list: false, optional: false }),
    num: () => ({ type: 'number', list: false, optional: false }),
    choice: (values) => ({
      type: typeof values[0] === 'number' ? 'number' : 'string',
      list: false,
      optional: false,
      values,
    }),
    optional: (item) => ({ ...coreShape(item), optional: true }),
    list: (item) => ({ ...coreShape(item), list: true }),
  })

const jsonShape = (json: Record<string, unknown>): Omit<Shape, 'optional'> => {
  if (jsonType(json) === 'array') {
    const items = (json['items'] ?? {}) as Record<string, unknown>
    return { ...scalarShape(items), list: true }
  }
  return { ...scalarShape(json), list: false }
}

/**
 * The JSON Schema type, normalised.
 *
 * `type` may be a union — `["string","null"]` is how nullable is often spelled —
 * and `integer` is a distinct JSON Schema type that a target should still treat
 * as a number.
 */
const jsonType = (json: Record<string, unknown>): unknown => {
  const type = json['type']
  const one = Array.isArray(type) ? type.find((t) => t !== 'null') : type
  return one === 'integer' ? 'number' : one
}

const scalarShape = (json: Record<string, unknown>): Pick<Shape, 'type' | 'values'> => {
  const type = jsonType(json)
  const values = json['enum']
  return {
    ...(type === 'string' || type === 'number' || type === 'boolean' ? { type } : {}),
    ...(Array.isArray(values) ? { values: values as unknown as Choices } : {}),
  }
}

// ---------------- Validation --------------------------
const ok = (value: unknown): StandardSchemaV1.Result<unknown> => ({ value })

/**
 * Issues are worded without the key; `bind` prefixes it from the path, so one
 * phrasing serves `'mode'` and `'tag[1]'` alike.
 */
const bad = (message: string): StandardSchemaV1.FailureResult => ({ issues: [{ message }] })

export const quote = (v: unknown): string => (typeof v === 'string' ? `'${v}'` : String(v))

/** `'a', 'b' or 'c'` — the tail of an "expected …" message. */
export const oneOf = (values: readonly unknown[]): string => {
  const quoted = values.map(quote)
  const last = quoted.pop()
  return quoted.length === 0 ? (last ?? '') : `${quoted.join(', ')} or ${last}`
}

const shown = (v: unknown): string => (typeof v === 'object' && v !== null ? JSON.stringify(v) : quote(v))

const TRUE = new Set(['true', '1', 'yes'])
const FALSE = new Set(['false', '0', 'no'])

/**
 * Every core type coerces: the same validator serves a command line handing it
 * `'42'` and a tool call handing it `42`. A `list` still demands a real array —
 * the command line builds one from repeated flags before validating, so nothing
 * needs the leniency and a wrong-shaped argument keeps a useful error.
 */
const validateType = (t: Type, value: unknown): StandardSchemaV1.Result<unknown> =>
  fold<StandardSchemaV1.Result<unknown>>(t, {
    string: () => (typeof value === 'object' ? bad(`${shown(value)} (expected a string)`) : ok(String(value))),
    num: () => {
      const n = typeof value === 'boolean' ? Number.NaN : Number(value)
      return typeof value === 'object' || String(value).trim() === '' || !Number.isFinite(n)
        ? bad(`${shown(value)} (expected a number)`)
        : ok(n)
    },
    bool: () => {
      if (typeof value === 'boolean') return ok(value)
      const v = String(value).toLowerCase()
      if (TRUE.has(v)) return ok(true)
      if (FALSE.has(v)) return ok(false)
      return bad(`${shown(value)} (expected a boolean)`)
    },
    choice: (values) => {
      const wanted = typeof values[0] === 'number' ? KIND.num : KIND.string
      const coerced = validateType({ kind: wanted } as Primitive, value)
      if (coerced.issues !== undefined) return coerced
      return (values as readonly unknown[]).includes(coerced.value)
        ? ok(coerced.value)
        : bad(`${quote(coerced.value)} (expected ${oneOf(values)})`)
    },
    optional: (item) => (value === undefined || value === null ? ok(undefined) : validateType(item, value)),
    list: (item) => {
      if (!Array.isArray(value)) return bad(`${shown(value)} (expected an array)`)
      const out: unknown[] = []
      const issues: StandardSchemaV1.Issue[] = []
      value.forEach((v, i) => {
        const r = validateType(item, v)
        if (r.issues === undefined) out.push(r.value)
        else issues.push(...r.issues.map((is) => ({ ...is, path: [i, ...(is.path ?? [])] })))
      })
      return issues.length > 0 ? { issues } : ok(out)
    },
  })

// ---------------- JSON Schema --------------------------
/** The JSON Schema for one core type, unwrapping `optional` and `list`. */
export const typeSchema = (t: Type): Record<string, unknown> =>
  fold<Record<string, unknown>>(t, {
    string: () => ({ type: 'string' }),
    num: () => ({ type: 'number' }),
    bool: () => ({ type: 'boolean' }),
    choice: (values) => ({ type: typeof values[0] === 'number' ? 'number' : 'string', enum: [...values] }),
    optional: (item) => typeSchema(item),
    list: (item) => ({ type: 'array', items: typeSchema(item) }),
  })

// ---------------- Attaching --------------------------
/**
 * Give a core type its `~standard` props.
 *
 * Defined non-enumerably on purpose: a type stays plain, comparable,
 * serialisable data whose `kind` is the source of truth, and `Object.entries`
 * over a field map still yields only fields.
 */
export const attach = <T extends Type>(t: T): Schema<T> => {
  const props: StandardSchemaV1.Props<unknown, TypeOf<T>> & StandardJSONSchemaV1.Props<unknown, TypeOf<T>> = {
    version: 1,
    vendor: VENDOR,
    validate: (value) => validateType(t, value) as StandardSchemaV1.Result<TypeOf<T>>,
    jsonSchema: { input: () => typeSchema(t), output: () => typeSchema(t) },
  }
  Object.defineProperty(t, '~standard', { value: props, enumerable: false })
  return t as Schema<T>
}

/**
 * Attach a JSON Schema to a validator that ships none, so it can still answer
 * the CLI's questions and appear in an MCP tool's `inputSchema`.
 */
export const withJsonSchema = <S extends StandardSchemaV1>(schema: S, json: Record<string, unknown>): S => {
  const props = { ...schema['~standard'], jsonSchema: { input: () => json, output: () => json } }
  return Object.defineProperty({ ...schema }, '~standard', { value: props, enumerable: false }) as S
}
