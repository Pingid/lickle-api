import type { Schema, Type } from '../types.ts'

export const getJson = (schema: Schema): any =>
  schema['~standard'].jsonSchema.output({ target: 'draft-07' }) as JsonSchema

export const getMeta = (schema: Schema): { default?: unknown; description?: string } => {
  const js = getJson(schema)
  return { default: js?.default, description: js?.description }
}

export const getDefault = (object: Type.Object<any>, field: string): { value: any } | undefined => {
  const json = getJson(object) as JsonSchema
  if ((object.properties[field] as any)?.optional) return { value: undefined }
  if (!json.required?.includes(field)) return { value: undefined }
  if (json.default) return { value: json.default }

  const schema = object?.properties?.[field]
  if (!schema) return undefined
  if (schema.default) return { value: schema.default }

  const s = object?.properties?.[field] as Type.Builtin | undefined
  if (s) {
    if (s.type === 'undefined') return { value: undefined }
    if (s.type === 'union') {
      for (const item of s.oneOf) {
        if (item.type === 'undefined') return { value: undefined }
        const json = getJson(item) as JsonSchema
        if (json.default) return { value: json.default }
      }
    }
  }

  if (json.oneOf) for (const item of json.oneOf) if (item.default) return { value: item.default }
  if (json.anyOf) for (const item of json.anyOf) if (item.default) return { value: item.default }

  return undefined
}

type JsonSchema = {
  type: string
  properties?: Record<string, JsonSchema>
  required?: string[]
  default?: unknown
  description?: string
  oneOf?: JsonSchema[]
  anyOf?: JsonSchema[]
}
