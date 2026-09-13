import { foldPrimitive, hasDefault, isList, isOptional, itemOf, valuesOf } from './kind.ts'
import type { Field, FieldMap, InputField, Primitive } from './types.ts'

/**
 * A JSON Schema 2020-12 object schema, as every consumer of an operation wants
 * it: MCP's `Tool.inputSchema`, an OpenAPI parameter set, a generated form.
 *
 * This lives in core because JSON Schema belongs to nobody — it is a projection
 * onto a standard, not one target's policy. The test is whether core would
 * still want it with every adapter deleted, and it would.
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
  enum?: unknown[]
  items?: ValueSchema
  default?: unknown
  [key: string]: unknown
}

/**
 * The JSON type a primitive carries. A `choice` takes it from its members,
 * which is why this folds rather than reading a static map.
 */
const jsonType = (p: Primitive): ValueSchema['type'] =>
  foldPrimitive(p, {
    string: () => 'string',
    num: () => 'number',
    bool: () => 'boolean',
    choice: (values) => (typeof values[0] === 'number' ? 'number' : 'string'),
  })

/** The schema for one field's value, unwrapping `optional` and `list`. */
export const fieldSchema = (field: Field): ValueSchema => {
  const type = field.type

  const item: ValueSchema = { type: jsonType(itemOf(type)) }
  const values = valuesOf(type)
  if (values !== undefined) item.enum = [...values]

  const schema: ValueSchema = isList(type) ? { type: 'array', items: item } : item
  if (field.description !== '') schema.description = field.description
  return schema
}

/**
 * An object schema for a set of fields.
 *
 * A field is required unless it is `optional` or carries a `default` — nothing
 * else will supply a value. Note this is *not* the command line's rule, which
 * also exempts `bool` and `list` because its parser substitutes `false` and
 * `[]`; that substitution is a command-line convention, not part of the
 * operation.
 */
export const jsonSchema = (fields: FieldMap | undefined): ObjectSchema => {
  const properties: Record<string, ValueSchema> = {}
  const required: string[] = []

  for (const [key, field] of Object.entries(fields ?? {})) {
    const schema = fieldSchema(field)
    const value = field as InputField
    if (hasDefault(value)) schema.default = value.default
    else if (!isOptional(field.type)) required.push(key)
    properties[key] = schema
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
    additionalProperties: false,
  }
}
