import { expect, test } from 'vitest'
import { bool, field, list, num, optional, string } from './cons.ts'
import { hasDefault, isList, isOptional, itemOf } from './kind.ts'

test('isOptional and isList discriminate the wrappers', () => {
  expect(isOptional(optional(string))).toBe(true)
  expect(isOptional(string)).toBe(false)
  expect(isList(list(string))).toBe(true)
  expect(isList(optional(string))).toBe(false)
})

test('itemOf unwraps to the primitive', () => {
  expect(itemOf(string)).toEqual({ type: 'string' })
  expect(itemOf(optional(num))).toEqual({ type: 'num' })
  expect(itemOf(list(bool))).toEqual({ type: 'bool' })
})

test('hasDefault distinguishes a declared default from none', () => {
  expect(hasDefault(field({ d: 'x', kind: string }))).toBe(false)
  expect(hasDefault(field({ d: 'x', kind: string, default: 'y' }))).toBe(true)
  // A falsy default still counts as declared.
  expect(hasDefault(field({ d: 'x', kind: bool, default: false }))).toBe(true)
  expect(hasDefault(field({ d: 'x', kind: num, default: 0 }))).toBe(true)
})

test('values rides on an input field', () => {
  expect(field({ d: 'x', kind: string, values: ['a', 'b'] }).values).toEqual(['a', 'b'])
})
