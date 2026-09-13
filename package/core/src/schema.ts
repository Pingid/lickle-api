import type { StandardJSONSchemaV1, StandardSchemaV1 } from '@standard-schema/spec'
import { hasDefault } from './kind.ts'
import { TARGET, VENDOR, jsonSchemaOf, schemaOf, shapeOf } from './standard.ts'
import type { Field, FieldMap, InputField } from './types.ts'

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
 * The schema for one field's value.
 *
 * Core types derive it structurally; a foreign schema supplies its own through
 * `StandardJSONSchemaV1`. One that implements neither contributes an empty
 * schema, which is permissive rather than wrong.
 */
export const fieldSchema = (field: Field, target: string = TARGET): ValueSchema => {
  const schema: ValueSchema = { ...(jsonSchemaOf(field.type, target) ?? {}) }
  if (field.description !== '') schema.description = field.description
  return schema
}

/**
 * An object schema for a set of fields.
 *
 * A field is required unless it is optional or carries a `default` — nothing
 * else will supply a value. Note this is *not* the command line's rule, which
 * also exempts `bool` and `list` because its parser substitutes `false` and
 * `[]`; that substitution is a command-line convention, not part of the
 * operation.
 */
export const jsonSchema = (fields: FieldMap | undefined, target: string = TARGET): ObjectSchema => {
  const properties: Record<string, ValueSchema> = {}
  const required: string[] = []

  for (const [key, field] of Object.entries(fields ?? {})) {
    const schema = fieldSchema(field, target)
    const value = field as InputField
    if (hasDefault(value)) schema.default = value.default
    else if (!shapeOf(field.type).optional) required.push(key)
    properties[key] = schema
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
    additionalProperties: false,
  }
}

// ---------------- The map as a schema --------------------------
/** A field map that is also a Standard Schema for the object it describes. */
export type FieldsSchema<F extends FieldMap> = F &
  StandardSchemaV1<unknown, Record<string, unknown>> &
  StandardJSONSchemaV1<unknown, Record<string, unknown>>

/**
 * Make a field map a Standard Schema for the whole object, so it can be handed
 * to anything that speaks the spec.
 *
 * `op()` and `cmd()` call this on `inputs` and `outputs`, so writing a plain
 * object literal is enough. The validation rule here is the schema's — required
 * unless optional or defaulted — not any one target's; a target that
 * substitutes values for absent inputs uses `bind` with its own policy instead.
 */
export const fields = <F extends FieldMap>(map: F): FieldsSchema<F> => {
  if ('~standard' in map) return map as FieldsSchema<F>

  const props: StandardSchemaV1.Props<unknown, Record<string, unknown>> &
    StandardJSONSchemaV1.Props<unknown, Record<string, unknown>> = {
    version: 1,
    vendor: VENDOR,
    validate: async (value, options) => {
      if (typeof value !== 'object' || value === null || Array.isArray(value))
        return { issues: [{ message: 'expected an object' }] }

      const given = value as Record<string, unknown>
      const out: Record<string, unknown> = {}
      const issues: StandardSchemaV1.Issue[] = []

      for (const [key, field] of Object.entries(map)) {
        const raw = given[key]
        if (raw === undefined || raw === null) {
          const input = field as InputField
          if (hasDefault(input)) out[key] = input.default
          else if (!shapeOf(field.type).optional) issues.push({ message: 'is required', path: [key] })
          continue
        }
        const result = await schemaOf(field.type)['~standard'].validate(raw, options)
        if (result.issues === undefined) out[key] = result.value
        else issues.push(...result.issues.map((i) => ({ ...i, path: [key, ...(i.path ?? [])] })))
      }

      return issues.length > 0 ? { issues } : { value: out }
    },
    jsonSchema: {
      input: (options) => jsonSchema(map, options.target),
      output: (options) => jsonSchema(map, options.target),
    },
  }

  Object.defineProperty(map, '~standard', { value: props, enumerable: false })
  return map as FieldsSchema<F>
}
