import { expect, test } from 'vitest'
import { bool, field, list, num, optional, spec as makeSpec, string } from '@lickle/cmd-core'
import { ArgsError, parseArgs } from './args.ts'

const spec = makeSpec({
  name: 'x',
  description: 'x',
  inputs: {
    who: field({ d: 'Who.', kind: string }),
    count: field({ d: 'How many.', kind: num }),
    flag: field({ d: 'A flag.', kind: bool }),
    tags: field({ d: 'Tags.', kind: list(string) }),
    mode: field({ d: 'Mode.', kind: string, values: ['fast', 'safe'], default: 'safe' }),
    note: field({ d: 'A note.', kind: optional(string) }),
  },
})

const valid = { who: 'ada', count: 2, flag: true, tags: ['a'] }

test('valid arguments pass through, with defaults applied', () => {
  expect(parseArgs(spec, valid)).toEqual({ ...valid, mode: 'safe' })
})

test('an optional left out stays out rather than becoming undefined', () => {
  expect('note' in parseArgs(spec, valid)).toBe(false)
})

test('a missing required argument is rejected', () => {
  expect(() => parseArgs(spec, { count: 2, flag: true, tags: [] })).toThrow(/missing required argument 'who'/)
  expect(() => parseArgs(spec, valid)).not.toThrow()
})

test('values arrive JSON-typed, so a wrong type is an error and never coerced', () => {
  // Unlike the CLI, which must read everything out of argv strings.
  expect(() => parseArgs(spec, { ...valid, count: '2' })).toThrow(/'count' expects a number, got string/)
  expect(() => parseArgs(spec, { ...valid, flag: 'true' })).toThrow(/'flag' expects a boolean, got string/)
  expect(() => parseArgs(spec, { ...valid, who: 5 })).toThrow(/'who' expects a string, got number/)
})

test('list items are checked individually, and reported by index', () => {
  expect(() => parseArgs(spec, { ...valid, tags: 'a' })).toThrow(/'tags' expects an array, got string/)
  expect(() => parseArgs(spec, { ...valid, tags: ['a', 2] })).toThrow(/'tags\[1\]' expects a string, got number/)
})

test('a value outside the declared set is rejected', () => {
  expect(() => parseArgs(spec, { ...valid, mode: 'sloppy' })).toThrow(/'mode' expects one of 'fast', 'safe'/)
})

test('unknown arguments are rejected, naming what was expected', () => {
  expect(() => parseArgs(spec, { ...valid, nope: 1 })).toThrow(/unknown argument 'nope'; expected 'who', 'count'/)
})

test('null is treated as absent, so a default still applies', () => {
  expect(parseArgs(spec, { ...valid, mode: null })['mode']).toBe('safe')
})

test('a non-finite number is rejected', () => {
  expect(() => parseArgs(spec, { ...valid, count: Number.NaN })).toThrow(/finite number/)
})

test('rejections are ArgsError, which the server turns into a tool result', () => {
  expect(() => parseArgs(spec, {})).toThrow(ArgsError)
})

test('a spec with no inputs accepts nothing', () => {
  const bare = makeSpec({ name: 'b', description: 'b' })
  expect(parseArgs(bare, {})).toEqual({})
  expect(() => parseArgs(bare, { a: 1 })).toThrow(/expected no arguments/)
})
