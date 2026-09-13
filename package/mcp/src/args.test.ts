import { expect, test } from 'vitest'
import { bool, field, list, num, optional, op as makeOp, string } from '@lickle/cmd-core'
import { InputError } from '@lickle/cmd-core'
import { bindArgs } from './args.ts'

const spec = makeOp({
  name: 'x',
  description: 'x',
  inputs: {
    who: field({ description: 'Who.', type: string }),
    count: field({ description: 'How many.', type: num }),
    flag: field({ description: 'A flag.', type: bool }),
    tags: field({ description: 'Tags.', type: list(string) }),
    mode: field({ description: 'Mode.', type: string, values: ['fast', 'safe'], default: 'safe' }),
    note: field({ description: 'A note.', type: optional(string) }),
  },
})

const valid = { who: 'ada', count: 2, flag: true, tags: ['a'] }

test('valid arguments pass through, with defaults applied', () => {
  expect(bindArgs(spec, valid)).toEqual({ ...valid, mode: 'safe' })
})

test('an optional left out stays out rather than becoming undefined', () => {
  expect('note' in bindArgs(spec, valid)).toBe(false)
})

test('a missing required argument is rejected', () => {
  expect(() => bindArgs(spec, { count: 2, flag: true, tags: [] })).toThrow(/missing required argument 'who'/)
  expect(() => bindArgs(spec, valid)).not.toThrow()
})

test('values arrive JSON-typed, so a wrong type is an error and never coerced', () => {
  // Unlike the CLI, which must read everything out of argv strings.
  expect(() => bindArgs(spec, { ...valid, count: '2' })).toThrow(/'count' expects a number, got string/)
  expect(() => bindArgs(spec, { ...valid, flag: 'true' })).toThrow(/'flag' expects a boolean, got string/)
  expect(() => bindArgs(spec, { ...valid, who: 5 })).toThrow(/'who' expects a string, got number/)
})

test('list items are checked individually, and reported by index', () => {
  expect(() => bindArgs(spec, { ...valid, tags: 'a' })).toThrow(/'tags' expects an array, got string/)
  expect(() => bindArgs(spec, { ...valid, tags: ['a', 2] })).toThrow(/'tags\[1\]' expects a string, got number/)
})

test('a value outside the declared set is rejected', () => {
  expect(() => bindArgs(spec, { ...valid, mode: 'sloppy' })).toThrow(
    /invalid value for 'mode': 'sloppy' \(expected 'fast' or 'safe'\)/,
  )
})

test('unknown arguments are rejected, naming what was expected', () => {
  expect(() => bindArgs(spec, { ...valid, nope: 1 })).toThrow(/unknown argument 'nope'; expected 'who', 'count'/)
})

test('null is treated as absent, so a default still applies', () => {
  expect(bindArgs(spec, { ...valid, mode: null })['mode']).toBe('safe')
})

test('a non-finite number is rejected', () => {
  expect(() => bindArgs(spec, { ...valid, count: Number.NaN })).toThrow(/finite number/)
})

test('rejections are InputError, which the server turns into a tool result', () => {
  expect(() => bindArgs(spec, {})).toThrow(InputError)
})

test('a spec with no inputs accepts nothing', () => {
  const bare = makeOp({ name: 'b', description: 'b' })
  expect(bindArgs(bare, {})).toEqual({})
  expect(() => bindArgs(bare, { a: 1 })).toThrow(/expected no arguments/)
})
