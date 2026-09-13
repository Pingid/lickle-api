import { expect, test } from 'vitest'
import { choice, bool, field, list, num, optional, string } from './cons.ts'
import {
  fold,
  isChoice,
  foldPrimitive,
  hasDefault,
  isList,
  isOptional,
  isOutputField,
  itemOf,
  valuesOf,
  outputField,
  outputFields,
} from './kind.ts'
import type { TypeOf } from './types.ts'

test('isOptional and isList discriminate the wrappers', () => {
  expect(isOptional(optional(string))).toBe(true)
  expect(isOptional(string)).toBe(false)
  expect(isList(list(string))).toBe(true)
  expect(isList(optional(string))).toBe(false)
})

test('itemOf unwraps to the primitive', () => {
  expect(itemOf(string)).toEqual({ kind: 'string' })
  expect(itemOf(optional(num))).toEqual({ kind: 'num' })
  expect(itemOf(list(bool))).toEqual({ kind: 'bool' })
})

test('hasDefault distinguishes a declared default from none', () => {
  expect(hasDefault(field({ description: 'x', type: string }))).toBe(false)
  expect(hasDefault(field({ description: 'x', type: string, default: 'y' }))).toBe(true)
  // A falsy default still counts as declared.
  expect(hasDefault(field({ description: 'x', type: bool, default: false }))).toBe(true)
  expect(hasDefault(field({ description: 'x', type: num, default: 0 }))).toBe(true)
})

test('valuesOf reports a choice, through optional and list', () => {
  expect(valuesOf(choice(['a', 'b']))).toEqual(['a', 'b'])
  expect(valuesOf(choice([1, 2]))).toEqual([1, 2])
  expect(valuesOf(optional(choice(['a', 'b'])))).toEqual(['a', 'b'])
  expect(valuesOf(list(choice(['a', 'b'])))).toEqual(['a', 'b'])
  expect(valuesOf(string)).toBeUndefined()
  expect(valuesOf(list(string))).toBeUndefined()
})

test('isChoice discriminates', () => {
  expect(isChoice(choice(['a']))).toBe(true)
  expect(isChoice(string)).toBe(false)
})

test('fold covers every kind and hands wrappers their item', () => {
  const label = <T extends Parameters<typeof fold>[0]>(t: T): string =>
    fold(t, {
      bool: () => 'bool',
      string: () => 'string',
      num: () => 'num',
      choice: (values) => values.join('|'),
      optional: (i) => `${label(i)}?`,
      list: (i) => `${label(i)}[]`,
    })

  expect(label(bool)).toBe('bool')
  expect(label(string)).toBe('string')
  expect(label(num)).toBe('num')
  expect(label(optional(string))).toBe('string?')
  expect(label(list(num))).toBe('num[]')
  expect(label(choice(['fast', 'safe']))).toBe('fast|safe')
  expect(label(list(choice(['a', 'b'])))).toBe('a|b[]')
})

test('foldPrimitive covers the three primitives', () => {
  const json = <P extends Parameters<typeof foldPrimitive>[0]>(p: P) =>
    foldPrimitive(p, {
      bool: () => 'boolean',
      string: () => 'string',
      num: () => 'number',
      choice: (values) => (typeof values[0] === 'number' ? 'number' : 'string'),
    })
  expect(json(num)).toBe('number')
  expect(json(choice(['a', 'b']))).toBe('string')
  expect(json(choice([1, 2]))).toBe('number')
})

test('outputs narrow to a map or a single field', () => {
  const single = field({ description: 'The script.', type: string })
  const map = { id: field({ description: 'New id.', type: num }) }

  expect(isOutputField(single)).toBe(true)
  expect(isOutputField(map)).toBe(false)
  expect(outputField(single)).toBe(single)
  expect(outputFields(single)).toBeUndefined()
  expect(outputFields(map)).toBe(map)
  expect(outputField(map)).toBeUndefined()
  expect(outputFields(undefined)).toBeUndefined()
})

test('a field map holding keys named `type` or `description` is still a map', () => {
  const shadowed = {
    type: field({ description: 'A kind of thing.', type: string }),
    description: field({ description: 'Prose.', type: string }),
  }
  expect(isOutputField(shadowed)).toBe(false)
  expect(outputFields(shadowed)).toBe(shadowed)
})

// The point of `choice` being a type rather than a field annotation: `TypeOf`
// can report the members, so a handler receives the union. A `values` property
// on the field was invisible to the type system and left this as `string`.
test('a choice narrows the value it describes, through optional and list', () => {
  const Mode = choice(['fast', 'safe'])

  const check = <T>(_v: T) => true
  expect(check<TypeOf<typeof Mode>>('fast')).toBe(true)
  expect(check<TypeOf<ReturnType<typeof optional<typeof Mode>>>>(undefined)).toBe(true)
  expect(check<TypeOf<ReturnType<typeof list<typeof Mode>>>>(['fast', 'safe'])).toBe(true)

  // @ts-expect-error 'sloppy' is not a member
  expect(check<TypeOf<typeof Mode>>('sloppy')).toBe(true)
  // @ts-expect-error members must be all strings or all numbers
  expect(choice(['a', 1])).toBeDefined()
})
