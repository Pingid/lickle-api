import { expect, test } from 'vitest'
import { bool, field, list, num, optional, string } from './cons.ts'
import { fieldSchema, jsonSchema } from './schema.ts'

test('primitives map to JSON Schema types, with the description carried over', () => {
  expect(fieldSchema(field({ description: 'Who to greet.', type: string }))).toEqual({
    type: 'string',
    description: 'Who to greet.',
  })
  expect(fieldSchema(field({ description: 'How many.', type: num }))).toEqual({
    type: 'number',
    description: 'How many.',
  })
  expect(fieldSchema(field({ description: 'Force it.', type: bool }))).toEqual({
    type: 'boolean',
    description: 'Force it.',
  })
})

test('optional unwraps to its item — optionality lives in `required`', () => {
  expect(fieldSchema(field({ description: 'A note.', type: optional(string) }))).toEqual({
    type: 'string',
    description: 'A note.',
  })
})

test('list becomes an array with typed items', () => {
  expect(fieldSchema(field({ description: 'Tags.', type: list(string) }))).toEqual({
    type: 'array',
    items: { type: 'string' },
    description: 'Tags.',
  })
})

test('values becomes enum, on the item for a list', () => {
  expect(fieldSchema(field({ description: 'Mode.', type: string, values: ['fast', 'safe'] }))).toEqual({
    type: 'string',
    enum: ['fast', 'safe'],
    description: 'Mode.',
  })
  expect(fieldSchema(field({ description: 'Modes.', type: list(string), values: ['fast', 'safe'] }))).toEqual({
    type: 'array',
    items: { type: 'string', enum: ['fast', 'safe'] },
    description: 'Modes.',
  })
})

test('an object schema lists properties, required keys and defaults', () => {
  expect(
    jsonSchema({
      who: field({ description: 'Who to greet.', type: string }),
      greeting: field({ description: 'What to say.', type: string, default: 'hello' }),
      title: field({ description: 'A title.', type: optional(string) }),
    }),
  ).toEqual({
    type: 'object',
    properties: {
      who: { type: 'string', description: 'Who to greet.' },
      greeting: { type: 'string', description: 'What to say.', default: 'hello' },
      title: { type: 'string', description: 'A title.' },
    },
    required: ['who'],
    additionalProperties: false,
  })
})

test('required covers exactly what nothing else will supply', () => {
  // Not the CLI's rule: there, `bool` and `list` are never demanded because the
  // parser substitutes `false` and `[]`. That is a command-line convention, and
  // reconciling the two would be wrong — see the note in core/src/kind.ts.
  const { required } = jsonSchema({
    plain: field({ description: 'x', type: string }),
    flag: field({ description: 'x', type: bool }),
    many: field({ description: 'x', type: list(string) }),
    defaulted: field({ description: 'x', type: string, default: 'y' }),
    opt: field({ description: 'x', type: optional(string) }),
  })
  expect(required).toEqual(['plain', 'flag', 'many'])
})

test('no fields yields an empty object schema with no required key', () => {
  expect(jsonSchema(undefined)).toEqual({ type: 'object', properties: {}, additionalProperties: false })
})

test('an empty description is omitted rather than emitted blank', () => {
  expect(fieldSchema(field({ description: '', type: string }))).toEqual({ type: 'string' })
})
