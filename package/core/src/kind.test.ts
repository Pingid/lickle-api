import { expect, test } from 'vitest'
import { bool, field, list, num, optional, string } from './cons.ts'
import {
  fold,
  foldPrimitive,
  hasDefault,
  isList,
  isOptional,
  isOutputField,
  itemOf,
  outputField,
  outputFields,
} from './kind.ts'

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

test('values rides on any field', () => {
  expect(field({ description: 'x', type: string, values: ['a', 'b'] }).values).toEqual(['a', 'b'])
  expect(field({ description: 'x', type: num, values: [1, 2] }).values).toEqual([1, 2])
})

test('fold covers every kind and hands wrappers their item', () => {
  const label = <T extends Parameters<typeof fold>[0]>(t: T): string =>
    fold(t, {
      bool: () => 'bool',
      string: () => 'string',
      num: () => 'num',
      optional: (i) => `${label(i)}?`,
      list: (i) => `${label(i)}[]`,
    })

  expect(label(bool)).toBe('bool')
  expect(label(string)).toBe('string')
  expect(label(num)).toBe('num')
  expect(label(optional(string))).toBe('string?')
  expect(label(list(num))).toBe('num[]')
})

test('foldPrimitive covers the three primitives', () => {
  const json = foldPrimitive(num, { bool: () => 'boolean', string: () => 'string', num: () => 'number' })
  expect(json).toBe('number')
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
