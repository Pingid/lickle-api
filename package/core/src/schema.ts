import { KIND } from './types.ts'
import { hasDefault, isList, isOptional, itemOf } from './kind.ts'
import type { Field, FieldsSpec, InputField, Primitive, Type } from './types.ts'

/**
 * A JSON Schema 2020-12 object schema, as every consumer of the spec wants it:
 * MCP's `Tool.inputSchema`, an OpenAPI parameter set, a generated form.
 */
export interface ObjectSchema {
  type: 'object'
  properties: Record<string, ValueSchema>
  required?: string[]
  additionalProperties: false
  /** JSON Schema is open: any 2020-12 keyword may appear alongside these. */
  [key: string]: unknown
}

export interface ValueSchema {
  type?: 'string' | 'number' | 'boolean' | 'array'
  description?: string
  enum?: string[]
  items?: ValueSchema
  default?: unknown
  [key: string]: unknown
}

const JSON_TYPE = {
  [KIND.string]: 'string',
  [KIND.num]: 'number',
  [KIND.bool]: 'boolean',
} as const satisfies Record<Primitive['type'], ValueSchema['type']>

/** The schema for one field's value, unwrapping `optional` and `list`. */
export const fieldSchema = (field: Field): ValueSchema => {
  const kind: Type = field.kind
  const values = (field as InputField).values

  const item: ValueSchema = { type: JSON_TYPE[itemOf(kind).type] }
  if (values !== undefined) item.enum = [...values]

  const schema: ValueSchema = isList(kind) ? { type: 'array', items: item } : item
  if (field.d !== '') schema.description = field.d
  return schema
}

/**
 * An object schema for a set of fields.
 *
 * A field is required unless it is `optional` or carries a `default` — nothing
 * else will supply a value. Note this is *not* the CLI's rule, which also
 * exempts `bool` and `list` because its parser substitutes `false` and `[]`;
 * that substitution is a command-line convention, not part of the spec.
 */
export const jsonSchema = (fields: FieldsSpec | undefined): ObjectSchema => {
  const entries = Object.entries(fields ?? {})

  const properties: Record<string, ValueSchema> = {}
  const required: string[] = []
  for (const [key, field] of entries) {
    const schema = fieldSchema(field)
    const value = field as InputField
    if (hasDefault(value)) schema.default = value.default
    else if (!isOptional(field.kind)) required.push(key)
    properties[key] = schema
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
    additionalProperties: false,
  }
}
