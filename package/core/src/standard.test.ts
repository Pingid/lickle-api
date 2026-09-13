import { expect, test } from 'vitest'
import { z } from 'zod'
import { InputError, bind } from './bind.ts'
import { bool, choice, field, list, num, optional, string } from './cons.ts'
import { fieldSchema, fields, jsonSchema } from './schema.ts'
import { VENDOR, jsonSchemaOf, schemaOf, shapeOf, withJsonSchema } from './standard.ts'
import type { Type } from './types.ts'

const CORE: Type[] = [string, num, bool, choice(['a', 'b']), choice([1, 2]), optional(string), list(string)]

test('every core type implements StandardSchemaV1 and StandardJSONSchemaV1', () => {
  for (const t of CORE) {
    const props = schemaOf(t)['~standard']
    expect(props.version).toBe(1)
    expect(props.vendor).toBe(VENDOR)
    expect(typeof props.validate).toBe('function')
    expect(typeof (props as { jsonSchema?: unknown }).jsonSchema).toBe('object')
  }
})

test('the jsonSchema converter agrees with fieldSchema', () => {
  for (const t of CORE) {
    const viaSpec = (schemaOf(t) as never as { '~standard': { jsonSchema: { input: (o: object) => object } } })[
      '~standard'
    ].jsonSchema.input({ target: 'draft-2020-12' })
    expect(viaSpec).toEqual(fieldSchema({ description: '', type: t }))
  }
})

// `~standard` is defined non-enumerably so a type stays plain, comparable,
// serialisable data whose `kind` is the source of truth.
test('attaching a schema leaves the type’s data shape untouched', () => {
  expect(Object.keys(string)).toEqual(['kind'])
  expect(JSON.stringify(list(choice(['a', 'b'])))).toBe('{"kind":"list","item":{"kind":"choice","values":["a","b"]}}')
  expect(string).toStrictEqual({ kind: 'string' })
  expect(Object.entries({ a: field({ description: 'x', type: string }) }).map(([k]) => k)).toEqual(['a'])
})

test('a field map is itself a Standard Schema for the object', async () => {
  const map = {
    title: field({ description: 'What.', type: string }),
    n: field({ description: 'How many.', type: num, default: 3 }),
    note: field({ description: 'A note.', type: optional(string) }),
  }

  const props = fields(map)['~standard']
  expect(props.vendor).toBe(VENDOR)
  expect(await props.validate({ title: 'x' })).toEqual({ value: { title: 'x', n: 3 } })
  expect(props.jsonSchema.input({ target: 'draft-2020-12' })).toEqual(jsonSchema(map))

  const bad = await props.validate({})
  expect(bad.issues?.[0]).toMatchObject({ message: 'is required', path: ['title'] })
})

// ---------------- Foreign schemas --------------------------
test('a zod schema validates in a field', async () => {
  const inputs = {
    email: field({ description: 'Where to write.', type: z.string().email() }),
    count: field({ description: 'How many.', type: z.coerce.number() }),
  }

  expect(await bind(inputs, { email: 'a@b.com', count: '42' })).toEqual({ email: 'a@b.com', count: 42 })
  await expect(bind(inputs, { email: 'nope', count: 1 })).rejects.toThrow(InputError)
  await expect(bind(inputs, { email: 'nope', count: 1 })).rejects.toThrow("invalid value for 'email'")
})

// Standard Schema is validate-only, so the CLI's questions are answered through
// the JSON Schema a library already knows how to emit.
test('shapeOf recovers a foreign schema’s shape from its JSON Schema', () => {
  expect(shapeOf(z.enum(['fast', 'safe']))).toMatchObject({ type: 'string', list: false, values: ['fast', 'safe'] })
  expect(shapeOf(z.array(z.string()))).toMatchObject({ type: 'string', list: true })
  expect(shapeOf(z.boolean())).toMatchObject({ type: 'boolean', list: false })
  expect(shapeOf(z.string().optional())).toMatchObject({ optional: true })
})

test('a foreign schema contributes its own JSON Schema to the object schema', () => {
  const schema = jsonSchema({ email: field({ description: 'Where to write.', type: z.string().email() }) })
  expect(schema.properties['email']).toMatchObject({ type: 'string', format: 'email', description: 'Where to write.' })
  // `$schema` belongs on a document root, not on a property inside one.
  expect(schema.properties['email']).not.toHaveProperty('$schema')
  expect(schema.required).toEqual(['email'])
})

test('a validator with no JSON Schema degrades, and withJsonSchema repairs it', () => {
  const opaque = {
    '~standard': {
      version: 1 as const,
      vendor: 'diy',
      validate: (v: unknown) => (v === undefined ? { issues: [{ message: 'is required' }] } : { value: v }),
    },
  }
  expect(shapeOf(opaque)).toEqual({ list: false, optional: false })
  expect(jsonSchema({ x: field({ description: '', type: opaque }) }).properties['x']).toEqual({})

  const repaired = withJsonSchema(opaque, { type: 'string', enum: ['a', 'b'] })
  expect(shapeOf(repaired)).toMatchObject({ type: 'string', values: ['a', 'b'] })
})

test('optionality is probed from the validator, since JSON Schema cannot say it', () => {
  // z.string() and z.string().optional() emit the identical value schema —
  // optionality lives in the parent object's `required` array.
  const required = z.string()
  const opt = z.string().optional()
  expect(jsonSchemaOf(required)).toEqual(jsonSchemaOf(opt))
  expect(shapeOf(required).optional).toBe(false)
  expect(shapeOf(opt).optional).toBe(true)
})

test('an optional foreign schema is left out of `required`', () => {
  const schema = jsonSchema({
    a: field({ description: '', type: z.string() }),
    b: field({ description: '', type: z.string().optional() }),
  })
  expect(schema.required).toEqual(['a'])
})

test('nested issue paths are labelled from the root key', async () => {
  const inputs = { where: field({ description: 'Filter.', type: z.object({ since: z.string() }) }) }
  await expect(bind(inputs, { where: { since: 1 } })).rejects.toThrow("invalid value for 'where.since'")
})
